require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");
const { execFile } = require("child_process");
const { promisify } = require("util");
const { GoogleGenAI } = require("@google/genai");

const execFileAsync = promisify(execFile);

const app = express();
const PORT = 5000;

/* =========================================================
   GEMINI AI
========================================================= */

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

/* =========================================================
   LANGUAGE MAPPING
========================================================= */

const LANGUAGE_MAP = {
  ".js": "JavaScript",
  ".jsx": "JavaScript",
  ".ts": "TypeScript",
  ".tsx": "TypeScript",

  ".py": "Python",

  ".java": "Java",

  ".c": "C",
  ".cpp": "C++",
  ".cc": "C++",
  ".h": "C/C++",
  ".hpp": "C/C++",

  ".css": "CSS",

  ".html": "HTML",
  ".htm": "HTML",

  ".json": "JSON",

  ".sql": "SQL",

  ".php": "PHP",

  ".csv": "CSV",

  ".txt": "Text",

  ".md": "Markdown",

  ".xml": "XML",

  ".yaml": "YAML",
  ".yml": "YAML",
};

/* =========================================================
   MIDDLEWARE
========================================================= */

app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

app.use(express.json());

/* =========================================================
   DIRECTORIES
========================================================= */

const uploadDirectory = path.join(
  __dirname,
  "uploads"
);

const projectsDirectory = path.join(
  __dirname,
  "projects"
);

if (!fs.existsSync(uploadDirectory)) {
  fs.mkdirSync(uploadDirectory, {
    recursive: true,
  });
}

if (!fs.existsSync(projectsDirectory)) {
  fs.mkdirSync(projectsDirectory, {
    recursive: true,
  });
}

/* =========================================================
   PROJECT SCANNER
========================================================= */

function scanProject(directory) {
  const languageCounts = {};
  const files = [];

  const ignoredDirectories = new Set([
    "node_modules",
    ".git",
    ".next",
    "dist",
    "build",
    "coverage",
  ]);

  function scanDirectory(currentDirectory) {
    const entries = fs.readdirSync(
      currentDirectory,
      {
        withFileTypes: true,
      }
    );

    for (const entry of entries) {
      const fullPath = path.join(
        currentDirectory,
        entry.name
      );

      /* Ignore unwanted folders */

      if (
        entry.isDirectory() &&
        ignoredDirectories.has(entry.name)
      ) {
        continue;
      }

      /* Scan folders */

      if (entry.isDirectory()) {
        scanDirectory(fullPath);
        continue;
      }

      /* Process files */

      if (entry.isFile()) {
        const extension = path
          .extname(entry.name)
          .toLowerCase();

        const language =
          LANGUAGE_MAP[extension];

        if (language) {
          languageCounts[language] =
            (languageCounts[language] || 0) + 1;
        }

        files.push(
          path.relative(
            directory,
            fullPath
          )
        );
      }
    }
  }

  scanDirectory(directory);

  return {
    totalFiles: files.length,
    languages: languageCounts,
    files,
  };
}
/* =========================================================
   GITHUB REPOSITORY IMPORT HELPERS
========================================================= */

function normalizeGitHubUrl(value) {
  if (typeof value !== "string") {
    throw new Error("GitHub repository URL is required.");
  }

  let url;

  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("Please enter a valid GitHub repository URL.");
  }

  if (
    url.protocol !== "https:" ||
    url.hostname.toLowerCase() !== "github.com"
  ) {
    throw new Error(
      "Only public GitHub HTTPS repository URLs are supported."
    );
  }

  const parts = url.pathname
    .split("/")
    .filter(Boolean);

  if (parts.length !== 2) {
    throw new Error(
      "Use a repository URL like https://github.com/username/repository"
    );
  }

  const owner = parts[0];
  const repo = parts[1].replace(/\.git$/i, "");

  if (
    !/^[A-Za-z0-9_.-]+$/.test(owner) ||
    !/^[A-Za-z0-9_.-]+$/.test(repo)
  ) {
    throw new Error("Invalid GitHub repository URL.");
  }

  return {
    owner,
    repo,
    url: `https://github.com/${owner}/${repo}.git`,
  };
}

async function cloneGitHubRepository(
  repositoryUrl,
  destination
) {
  console.log("Cloning GitHub repository...");
  console.log(repositoryUrl);

  await execFileAsync(
    "git",
    [
      "clone",
      "--depth",
      "1",
      "--single-branch",
      repositoryUrl,
      destination,
    ],
    {
      timeout: 120000,
      windowsHide: true,
      maxBuffer: 10 * 1024 * 1024,
    }
  );

  console.log(
    "GitHub repository cloned successfully."
  );
}

/* =========================================================
   MULTER CONFIGURATION
========================================================= */

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDirectory);
  },

  filename: (req, file, cb) => {
    const uniqueName =
      `${Date.now()}-${file.originalname}`;

    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,

  limits: {
    fileSize: 50 * 1024 * 1024,
  },

  fileFilter: (req, file, cb) => {
    const extension = path
      .extname(file.originalname)
      .toLowerCase();

    if (extension !== ".zip") {
      return cb(
        new Error(
          "Only ZIP files are allowed."
        )
      );
    }

    cb(null, true);
  },
});


/* =========================================================
   HEALTH CHECK
========================================================= */

app.get("/", (req, res) => {
  res.json({
    message:
      "CodeMind backend is running!",
    status: "OK",
    port: PORT,
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message:
      "Backend connection successful!",
  });
});
/* =========================================================
   GITHUB REPOSITORY IMPORT
========================================================= */

app.post(
  "/api/projects/github",
  async (req, res) => {
    let projectDirectory = null;

    try {
      const { url: repositoryUrl } =
        normalizeGitHubUrl(req.body?.url);

      const { owner, repo } =
        normalizeGitHubUrl(repositoryUrl);

      const projectId =
        `${Date.now()}-${repo}`;

      projectDirectory = path.join(
        projectsDirectory,
        projectId
      );

      fs.mkdirSync(projectDirectory, {
        recursive: true,
      });

      console.log("");
      console.log("=================================");
      console.log("GITHUB IMPORT REQUEST RECEIVED");
      console.log("=================================");
      console.log(
        `Repository: ${repositoryUrl}`
      );

      console.log(
        `Project ID: ${projectId}`
      );

      await cloneGitHubRepository(
        repositoryUrl,
        projectDirectory
      );

      const analysis =
        scanProject(projectDirectory);

      // Remove Git metadata after cloning
      const gitDirectory =
        path.join(
          projectDirectory,
          ".git"
        );

      if (fs.existsSync(gitDirectory)) {
        fs.rmSync(gitDirectory, {
          recursive: true,
          force: true,
        });
      }

      console.log(
        `GitHub project scanned: ${analysis.totalFiles} files`
      );

      return res.status(201).json({
        success: true,

        message:
          "GitHub repository imported successfully!",

        project: {
          id: projectId,

          projectId: projectId,

          name: repo,

          source: "github",

          repositoryUrl:
            `https://github.com/${owner}/${repo}`,

          originalFile: null,

          size: null,

          extractedPath:
            projectDirectory,

          analysis: {
            totalFiles:
              analysis.totalFiles,

            languages:
              analysis.languages,

            files:
              analysis.files,
          },
        },
      });

    } catch (error) {

      console.error(
        "GITHUB IMPORT FAILED:"
      );

      console.error(error);

      if (
        projectDirectory &&
        fs.existsSync(projectDirectory)
      ) {
        try {

          fs.rmSync(
            projectDirectory,
            {
              recursive: true,
              force: true,
            }
          );

        } catch (cleanupError) {

          console.error(
            "Could not remove failed GitHub project:",
            cleanupError.message
          );

        }
      }

      let message =
        "Failed to import GitHub repository.";

      if (error.code === 128) {
        message =
          "Could not clone the GitHub repository. Make sure the repository is public and the URL is correct.";
      } else if (error.message) {
        message = error.message;
      }

      return res.status(400).json({
        success: false,
        message: message,
      });
    }
  }
);

/* =========================================================
   PROJECT UPLOAD
========================================================= */

app.post(
  "/api/projects/upload",
  upload.single("project"),
  (req, res) => {
    console.log("");
    console.log(
      "================================="
    );
    console.log(
      "UPLOAD REQUEST RECEIVED"
    );
    console.log(
      "================================="
    );

    try {
      /* Check uploaded file */

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message:
            "No project ZIP file uploaded.",
        });
      }

      console.log(
        `Received file: ${req.file.originalname}`
      );

      /* Project name */

      const projectName =
        path.basename(
          req.file.originalname,
          path.extname(
            req.file.originalname
          )
        );

      /* Create project ID */

      const projectId =
        `${Date.now()}-${projectName}`;

      const projectDirectory =
        path.join(
          projectsDirectory,
          projectId
        );

      fs.mkdirSync(
        projectDirectory,
        {
          recursive: true,
        }
      );

      console.log(
        "Project directory created:"
      );

      console.log(
        projectDirectory
      );

      console.log(
        `Project ID: ${projectId}`
      );

      /* Extract ZIP */

      console.log(
        "Extracting project..."
      );

      const zip = new AdmZip(
        req.file.path
      );

      zip.extractAllTo(
        projectDirectory,
        true
      );

      console.log(
        "Project extracted successfully."
      );

      /* Scan project */

      console.log(
        "Scanning project..."
      );

      const analysis =
        scanProject(
          projectDirectory
        );

      console.log(
        `Total files: ${analysis.totalFiles}`
      );

      console.log(
        "Languages:",
        analysis.languages
      );

      /* Delete temporary ZIP */

      try {
        fs.unlinkSync(
          req.file.path
        );

        console.log(
          "Temporary ZIP deleted."
        );
      } catch (deleteError) {
        console.log(
          "Could not delete temporary ZIP:",
          deleteError.message
        );
      }

      /* Response */

      return res.status(201).json({
        success: true,

        message:
          "Project uploaded, extracted and scanned successfully!",

        project: {
          id: projectId,

          projectId: projectId,

          name: projectName,

          originalFile:
            req.file.originalname,

          size: req.file.size,

          extractedPath:
            projectDirectory,

          analysis: {
            totalFiles:
              analysis.totalFiles,

            languages:
              analysis.languages,

            files:
              analysis.files,
          },
        },
      });

    } catch (error) {

      console.error(
        "PROJECT PROCESSING FAILED:",
        error
      );

      if (
        req.file &&
        fs.existsSync(
          req.file.path
        )
      ) {
        try {
          fs.unlinkSync(
            req.file.path
          );
        } catch (deleteError) {
          console.log(
            "Could not delete failed upload:",
            deleteError.message
          );
        }
      }

      return res.status(500).json({
        success: false,

        message:
          "Failed to upload, extract or scan project.",

        error:
          error.message,
      });
    }
  }
);

/* =========================================================
   FILE PREVIEW API
========================================================= */

app.get(
  "/api/projects/:projectId/file",
  (req, res) => {

    try {

      const projectId =
        req.params.projectId;

      const requestedFile =
        req.query.path;

      console.log("");
      console.log(
        "FILE PREVIEW REQUEST"
      );

      console.log(
        "Project ID:",
        projectId
      );

      console.log(
        "Requested file:",
        requestedFile
      );

      if (!requestedFile) {
        return res.status(400).json({
          success: false,
          message:
            "File path is required.",
        });
      }

      const projectDirectory =
        path.join(
          projectsDirectory,
          projectId
        );

      if (
        !fs.existsSync(
          projectDirectory
        )
      ) {
        return res.status(404).json({
          success: false,
          message:
            "Project not found.",
        });
      }

      const filePath =
        path.resolve(
          projectDirectory,
          requestedFile
        );

      /* Security check */

      const projectRoot =
        path.resolve(
          projectDirectory
        );

      if (
        !filePath.startsWith(
          projectRoot +
            path.sep
        )
      ) {
        return res.status(403).json({
          success: false,
          message:
            "Access denied.",
        });
      }

      if (
        !fs.existsSync(
          filePath
        )
      ) {
        return res.status(404).json({
          success: false,
          message:
            "File not found.",
        });
      }

      const stats =
        fs.statSync(
          filePath
        );

      if (!stats.isFile()) {
        return res.status(400).json({
          success: false,
          message:
            "Requested path is not a file.",
        });
      }

      const extension =
        path
          .extname(filePath)
          .toLowerCase();

      const allowedExtensions =
        new Set([
          ".js",
          ".jsx",
          ".ts",
          ".tsx",

          ".py",

          ".java",

          ".c",
          ".cpp",
          ".cc",
          ".h",
          ".hpp",

          ".css",

          ".html",
          ".htm",

          ".json",

          ".sql",

          ".php",

          ".csv",

          ".txt",

          ".md",

          ".xml",

          ".yaml",
          ".yml",
        ]);

      if (
        !allowedExtensions.has(
          extension
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Preview is not supported for this file type.",
        });
      }

      const MAX_PREVIEW_SIZE =
        2 * 1024 * 1024;

      if (
        stats.size >
        MAX_PREVIEW_SIZE
      ) {
        return res.status(400).json({
          success: false,
          message:
            "File is too large to preview.",
        });
      }

      const content =
        fs.readFileSync(
          filePath,
          "utf8"
        );

      console.log(
        "File preview loaded successfully."
      );

      return res.json({
        success: true,

        file: requestedFile,

        extension: extension,

        size: stats.size,

        content: content,
      });

    } catch (error) {

      console.error(
        "FILE PREVIEW ERROR:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Failed to read file.",

        error:
          error.message,
      });
    }
  }
);

/* =========================================================
   ASK CODEMIND - GEMINI AI
========================================================= */

app.post(
  "/api/projects/:projectId/ask",
  async (req, res) => {

    try {

      const { projectId } =
        req.params;

      const { question } =
        req.body;

      if (
        !question ||
        !question.trim()
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Question is required.",
        });
      }

      const projectDirectory =
        path.join(
          projectsDirectory,
          projectId
        );

      if (
        !fs.existsSync(
          projectDirectory
        )
      ) {
        return res.status(404).json({
          success: false,
          message:
            "Project not found.",
        });
      }

      const analysis =
        scanProject(
          projectDirectory
        );

      let projectContent = "";

      for (
        const relativeFile
        of analysis.files
      ) {

        const fullPath =
          path.join(
            projectDirectory,
            relativeFile
          );

        if (
          !fs.existsSync(
            fullPath
          )
        ) {
          continue;
        }

        const stats =
          fs.statSync(
            fullPath
          );

        if (
          stats.size >
          500 * 1024
        ) {
          continue;
        }

        try {

          const content =
            fs.readFileSync(
              fullPath,
              "utf8"
            );

          projectContent +=
            `\n\n===== ${relativeFile} =====\n`;

          projectContent +=
            content;

        } catch {
          // Ignore binary/unreadable files
        }
      }

      const MAX_CONTEXT =
        100000;

      if (
        projectContent.length >
        MAX_CONTEXT
      ) {
        projectContent =
          projectContent.substring(
            0,
            MAX_CONTEXT
          ) +
          "\n\n[Remaining project content omitted due to size limit]";
      }

      const prompt = `
You are CodeMind, an AI-powered codebase assistant.

Analyze the uploaded project and answer the user's question
using the project files provided below.

Be accurate and practical.

If the answer cannot be determined from the provided project,
say so instead of inventing information.

User question:
${question}

Project files:
${projectContent}
`;

      const response =
        await ai.models.generateContent({
          model:
            "gemini-2.5-flash",

          contents:
            prompt,
        });

      const answer =
        response.text;

      return res.json({
        success: true,

        question,

        answer,
      });

    } catch (error) {

      console.error(
        "CODEMIND AI ERROR:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Failed to generate AI response.",

        error:
          error.message,
      });
    }
  }
);

/* =========================================================
   AI PROJECT INSIGHTS
========================================================= */

app.post(
  "/api/projects/:projectId/insights",
  async (req, res) => {

    try {

      const { projectId } =
        req.params;

      const projectDirectory =
        path.join(
          projectsDirectory,
          projectId
        );

      if (
        !fs.existsSync(
          projectDirectory
        )
      ) {
        return res.status(404).json({
          success: false,
          message:
            "Project not found.",
        });
      }

      console.log("");
      console.log(
        "GENERATING PROJECT INSIGHTS..."
      );

      console.log(
        "Project:",
        projectId
      );

      const analysis =
        scanProject(
          projectDirectory
        );

      let projectContent = "";

      for (
        const relativeFile
        of analysis.files
      ) {

        const fullPath =
          path.join(
            projectDirectory,
            relativeFile
          );

        if (
          !fs.existsSync(
            fullPath
          )
        ) {
          continue;
        }

        const stats =
          fs.statSync(
            fullPath
          );

        if (
          stats.size >
          500 * 1024
        ) {
          continue;
        }

        try {

          const content =
            fs.readFileSync(
              fullPath,
              "utf8"
            );

          projectContent +=
            `\n\n===== ${relativeFile} =====\n`;

          projectContent +=
            content;

        } catch {
          // Ignore unreadable/binary files
        }
      }

      const MAX_CONTEXT =
        100000;

      if (
        projectContent.length >
        MAX_CONTEXT
      ) {
        projectContent =
          projectContent.substring(
            0,
            MAX_CONTEXT
          ) +
          "\n\n[Additional files omitted because the project is large.]";
      }

      const prompt = `
You are CodeMind, an AI-powered codebase intelligence assistant.

Analyze the uploaded project and create a concise project
insights report.

Use ONLY the project information provided below.

Return the response using exactly these sections:

PROJECT OVERVIEW:
Give a short explanation of what the project appears to be.

TECHNOLOGIES:
List the programming languages, frameworks, libraries,
or important file types that can be identified.

IMPORTANT FILES:
List the most important files and briefly explain what
each appears to contain.

AI OBSERVATIONS:
Give 3 to 5 useful observations about the project.

If something cannot be determined from the files,
say "Not identifiable from the provided files."

Project analysis:
Total files: ${analysis.totalFiles}

Detected languages/file types:
${JSON.stringify(
  analysis.languages,
  null,
  2
)}

Project files:
${analysis.files.join("\n")}

Project content:
${projectContent}
`;

      const response =
        await ai.models.generateContent({
          model:
            "gemini-2.5-flash",

          contents:
            prompt,
        });

      const insights =
        response.text;

      console.log(
        "PROJECT INSIGHTS GENERATED"
      );

      return res.json({
        success: true,

        projectId,

        insights,

        analysis: {
          totalFiles:
            analysis.totalFiles,

          languages:
            analysis.languages,

          files:
            analysis.files,
        },
      });

    } catch (error) {

      console.error(
        "PROJECT INSIGHTS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Failed to generate project insights.",

        error:
          error.message,
      });
    }
  }
);

/* =========================================================
   AI ARCHITECTURE ANALYSIS
   STRUCTURED JSON FOR VISUAL DIAGRAM
========================================================= */

app.post(
  "/api/projects/:projectId/architecture",
  async (req, res) => {

    try {

      const { projectId } =
        req.params;

      const projectDirectory =
        path.join(
          projectsDirectory,
          projectId
        );

      if (
        !fs.existsSync(
          projectDirectory
        )
      ) {
        return res.status(404).json({
          success: false,
          message:
            "Project not found.",
        });
      }

      console.log("");
      console.log(
        "================================="
      );
      console.log(
        "GENERATING VISUAL ARCHITECTURE"
      );
      console.log(
        "================================="
      );

      console.log(
        "Project:",
        projectId
      );

      /* -------------------------------------------------
         SCAN PROJECT
      ------------------------------------------------- */

      const analysis =
        scanProject(
          projectDirectory
        );

      let projectContent = "";

      /* -------------------------------------------------
         READ PROJECT FILES
      ------------------------------------------------- */

      for (
        const relativeFile
        of analysis.files
      ) {

        const fullPath =
          path.join(
            projectDirectory,
            relativeFile
          );

        if (
          !fs.existsSync(
            fullPath
          )
        ) {
          continue;
        }

        const stats =
          fs.statSync(
            fullPath
          );

        /* Skip very large files */

        if (
          stats.size >
          300 * 1024
        ) {
          continue;
        }

        try {

          const content =
            fs.readFileSync(
              fullPath,
              "utf8"
            );

          projectContent +=
            `\n\n===== ${relativeFile} =====\n`;

          projectContent +=
            content;

        } catch {
          // Ignore binary/unreadable files
        }
      }

      /* -------------------------------------------------
         LIMIT GEMINI CONTEXT
      ------------------------------------------------- */

      const MAX_CONTEXT =
        100000;

      if (
        projectContent.length >
        MAX_CONTEXT
      ) {

        projectContent =
          projectContent.substring(
            0,
            MAX_CONTEXT
          ) +
          "\n\n[Additional project content omitted because the project is large.]";
      }

      /* -------------------------------------------------
         STRUCTURED GEMINI PROMPT
      ------------------------------------------------- */

      const prompt = `
You are CodeMind, an AI-powered codebase architecture analyzer.

Analyze the uploaded software project using ONLY the files
provided below.

Your job is to identify the actual architecture of the project.

IMPORTANT RULES:

1. Do NOT invent technologies.
2. Do NOT invent databases.
3. Do NOT invent APIs.
4. Do NOT invent frameworks.
5. Use actual filenames whenever possible.
6. Only describe components supported by the project.
7. If something cannot be confidently determined, say so.
8. Return ONLY valid JSON.
9. Do NOT use markdown.
10. Do NOT wrap the JSON in \`\`\`.

Return EXACTLY this structure:

{
  "architectureType": "string",
  "summary": "string",
  "components": [
    {
      "id": "component-1",
      "name": "string",
      "technology": "string",
      "responsibility": "string",
      "files": [
        "file1",
        "file2"
      ]
    }
  ],
  "connections": [
    {
      "from": "component-1",
      "to": "component-2",
      "label": "string"
    }
  ],
  "dataFlow": [
    "step 1",
    "step 2",
    "step 3"
  ]
}

ARCHITECTURE TYPE:

Examples include:

- Monolithic
- Client-Server
- Layered
- MVC
- Full-stack
- Data/ML pipeline
- Microservices
- Other

If uncertain, use:

"Architecture type cannot be confidently determined."

COMPONENTS:

Identify 2 to 8 major components.

For each component include:

- unique id
- name
- technology
- responsibility
- important files

CONNECTIONS:

Describe how the components interact.

Every "from" and "to" value MUST match an existing
component id.

DATA FLOW:

Explain how information moves through the project.

For a machine-learning project, this might be:

Dataset → Preprocessing → Model Training → Prediction → Output

For a web application, it might be:

Frontend → API → Backend → Database

Only use a flow that is actually supported by the files.

PROJECT FILES:

${analysis.files.join("\n")}

DETECTED FILE TYPES:

${JSON.stringify(
  analysis.languages,
  null,
  2
)}

PROJECT CONTENT:

${projectContent}
`;

      /* -------------------------------------------------
         ASK GEMINI
      ------------------------------------------------- */

      const response =
        await ai.models.generateContent({
          model:
            "gemini-2.5-flash",

          contents:
            prompt,
        });

      let rawArchitecture =
        response.text.trim();

      console.log(
        "Raw architecture response received."
      );

      /* -------------------------------------------------
         REMOVE MARKDOWN CODE FENCES
      ------------------------------------------------- */

      rawArchitecture =
        rawArchitecture
          .replace(
            /^```json\s*/i,
            ""
          )
          .replace(
            /^```\s*/i,
            ""
          )
          .replace(
            /\s*```$/i,
            ""
          )
          .trim();

      /* -------------------------------------------------
         PARSE JSON
      ------------------------------------------------- */

      let architectureData;

      try {

        architectureData =
          JSON.parse(
            rawArchitecture
          );

      } catch (parseError) {

        console.error(
          "GEMINI RETURNED INVALID JSON"
        );

        console.error(
          rawArchitecture
        );

        return res.status(500).json({
          success: false,

          message:
            "Gemini returned invalid architecture data.",

          error:
            "Architecture response could not be parsed as JSON.",
        });
      }

      /* -------------------------------------------------
         VALIDATE STRUCTURE
      ------------------------------------------------- */

      if (
        !architectureData ||
        typeof architectureData !==
          "object"
      ) {

        return res.status(500).json({
          success: false,

          message:
            "Invalid architecture structure returned by AI.",
        });
      }

      if (
        !Array.isArray(
          architectureData.components
        )
      ) {

        architectureData.components =
          [];
      }

      if (
        !Array.isArray(
          architectureData.connections
        )
      ) {

        architectureData.connections =
          [];
      }

      if (
        !Array.isArray(
          architectureData.dataFlow
        )
      ) {

        architectureData.dataFlow =
          [];
      }

      if (
        !architectureData.architectureType
      ) {

        architectureData.architectureType =
          "Unknown";
      }

      if (
        !architectureData.summary
      ) {

        architectureData.summary =
          "Architecture summary could not be determined.";
      }

      /* -------------------------------------------------
         CLEAN COMPONENTS
      ------------------------------------------------- */

      architectureData.components =
        architectureData.components
          .slice(0, 8)
          .map(
            (
              component,
              index
            ) => {

              return {
                id:
                  component.id ||
                  `component-${index + 1}`,

                name:
                  component.name ||
                  `Component ${
                    index + 1
                  }`,

                technology:
                  component.technology ||
                  "Unknown",

                responsibility:
                  component.responsibility ||
                  "No responsibility identified.",

                files:
                  Array.isArray(
                    component.files
                  )
                    ? component.files
                    : [],
              };
            }
          );

      /* -------------------------------------------------
         VALID COMPONENT IDS
      ------------------------------------------------- */

      const componentIds =
        new Set(
          architectureData.components.map(
            (component) =>
              component.id
          )
        );

      /* -------------------------------------------------
         CLEAN CONNECTIONS
      ------------------------------------------------- */

      architectureData.connections =
        architectureData.connections
          .filter(
            (connection) =>
              connection &&
              componentIds.has(
                connection.from
              ) &&
              componentIds.has(
                connection.to
              )
          )
          .map(
            (connection) => {

              return {
                from:
                  connection.from,

                to:
                  connection.to,

                label:
                  connection.label ||
                  "communicates with",
              };
            }
          );

      /* -------------------------------------------------
         CLEAN DATA FLOW
      ------------------------------------------------- */

      architectureData.dataFlow =
        architectureData.dataFlow
          .slice(0, 10)
          .map(
            (step) =>
              String(step)
          );

      console.log(
        "Architecture components:",
        architectureData.components.length
      );

      console.log(
        "Architecture connections:",
        architectureData.connections.length
      );

      console.log(
        "Architecture generated successfully."
      );

      /* -------------------------------------------------
         SEND STRUCTURED RESPONSE
      ------------------------------------------------- */

      return res.json({
        success: true,

        projectId,

        architecture:
          architectureData,

        analysis: {
          totalFiles:
            analysis.totalFiles,

          languages:
            analysis.languages,

          files:
            analysis.files,
        },
      });

    } catch (error) {

      console.error(
        "ARCHITECTURE ANALYSIS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Failed to generate architecture analysis.",

        error:
          error.message,
      });
    }
  }
);

/* =========================================================
   MULTER ERROR HANDLER
========================================================= */

app.use(
  (error, req, res, next) => {

    console.error(
      "UPLOAD ERROR:",
      error
    );

    /* File size error */

    if (
      error instanceof
      multer.MulterError
    ) {

      if (
        error.code ===
        "LIMIT_FILE_SIZE"
      ) {

        return res.status(400).json({
          success: false,

          message:
            "File is too large. Maximum size is 50 MB.",
        });
      }

      return res.status(400).json({
        success: false,

        message:
          error.message,
      });
    }

    /* Other upload errors */

    if (error) {

      return res.status(400).json({
        success: false,

        message:
          error.message,
      });
    }

    next();
  }
);

/* =========================================================
   START SERVER
========================================================= */

app.listen(
  PORT,
  () => {

    console.log("");

    console.log(
      "================================="
    );

    console.log(
      "       CODEMIND BACKEND"
    );

    console.log(
      "================================="
    );

    console.log(
      `Backend running at: http://localhost:${PORT}`
    );

    console.log(
      "Frontend allowed: http://localhost:3000"
    );

    console.log(
      "Upload API: http://localhost:5000/api/projects/upload"
    );

    console.log(
      "File Preview API: http://localhost:5000/api/projects/:projectId/file"
    );

    console.log(
      "Ask CodeMind API: http://localhost:5000/api/projects/:projectId/ask"
    );

    console.log(
      "Insights API: http://localhost:5000/api/projects/:projectId/insights"
    );

    console.log(
      "Architecture API: http://localhost:5000/api/projects/:projectId/architecture"
    );

    console.log(
      "================================="
    );

    console.log("");
  }
);