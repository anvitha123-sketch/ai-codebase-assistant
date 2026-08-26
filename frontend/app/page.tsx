"use client";

import { useEffect, useState } from "react";

type Analysis = {
  totalFiles: number;
  languages: Record<string, number>;
  files: string[];
};

type ArchitectureComponent = {
  id: string;
  name: string;
  technology: string;
  responsibility: string;
  files: string[];
};

type ArchitectureConnection = {
  from: string;
  to: string;
  label: string;
};

type ArchitectureData = {
  architectureType: string;
  summary: string;
  components: ArchitectureComponent[];
  connections: ArchitectureConnection[];
  dataFlow: string[];
};

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [backendMessage, setBackendMessage] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);

  const [selectedProjectFile, setSelectedProjectFile] =
    useState<string | null>(null);

  const [uploadMessage, setUploadMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const [projectId, setProjectId] = useState<string | null>(null);
  const [githubUrl, setGithubUrl] = useState("");
  const [isImportingGithub, setIsImportingGithub] = useState(false);
  const [filePreview, setFilePreview] = useState("");
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // =========================================================
  // ASK CODEMIND
  // =========================================================

  type ChatMessage = {
    role: "user" | "assistant";
    content: string;
  };

  const [question, setQuestion] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [aiAnswer, setAiAnswer] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [aiError, setAiError] = useState("");

  // =========================================================
  // AI PROJECT INSIGHTS
  // =========================================================

  const [projectInsights, setProjectInsights] = useState("");
  const [isLoadingInsights, setIsLoadingInsights] =
    useState(false);

  const [insightsError, setInsightsError] = useState("");

  // =========================================================
  // AI ARCHITECTURE
  // =========================================================

  const [architecture, setArchitecture] = useState<ArchitectureData | null>(null);
  const [isLoadingArchitecture, setIsLoadingArchitecture] =
    useState(false);

  const [architectureError, setArchitectureError] =
    useState("");

  // =========================================================
  // BACKEND CONNECTION
  // =========================================================

  useEffect(() => {
    fetch("https://ai-codebase-assistant-production-59c5.up.railway.app")
      .then((response) => response.json())
      .then((data) => {
        setBackendMessage(data.message);
      })
      .catch(() => {
        setBackendMessage(
          "Backend connection failed"
        );
      });
  }, []);

  // =========================================================
  // GENERATE AI PROJECT INSIGHTS
  // =========================================================

  const generateProjectInsights = async (
    id: string
  ) => {
    setIsLoadingInsights(true);
    setProjectInsights("");
    setInsightsError("");

    try {
      console.log(
        "Generating AI project insights..."
      );

      const response = await fetch(
        `https://ai-codebase-assistant-production-59c5.up.railway.app/api/projects/${encodeURIComponent(
          id
        )}/insights`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
        }
      );

      const data = await response.json();

      console.log(
        "PROJECT INSIGHTS RESPONSE:",
        data
      );

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Failed to generate project insights."
        );
      }

      setProjectInsights(
        data.insights ||
          "No insights generated."
      );
    } catch (error) {
      console.error(
        "Insights generation failed:",
        error
      );

      setInsightsError(
        error instanceof Error
          ? error.message
          : "Failed to generate project insights."
      );
    } finally {
      setIsLoadingInsights(false);
    }
  };

  // =========================================================
  // GENERATE ARCHITECTURE
  // =========================================================

  const generateArchitecture = async (
    id: string
  ) => {
    setIsLoadingArchitecture(true);
    setArchitecture(null);
    setArchitectureError("");

    try {
      console.log(
        "Generating architecture analysis..."
      );

      const response = await fetch(
        `https://ai-codebase-assistant-production-59c5.up.railway.app/api/projects/${encodeURIComponent(
          id
        )}/architecture`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
        }
      );

      const data = await response.json();

      console.log(
        "ARCHITECTURE RESPONSE:",
        data
      );

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Failed to generate architecture."
        );
      }

      setArchitecture(
        data.architecture ||
          "No architecture analysis generated."
      );
    } catch (error) {
      console.error(
        "Architecture generation failed:",
        error
      );

      setArchitectureError(
        error instanceof Error
          ? error.message
          : "Failed to generate architecture."
      );
    } finally {
      setIsLoadingArchitecture(false);
    }
  };

  // =========================================================
  // UPLOAD PROJECT
  // =========================================================

  const handleProjectUpload = (
    file: File
  ) => {
    setSelectedFile(file);

    setAnalysis(null);
    setSelectedProjectFile(null);

    setUploadMessage("");
    setProjectId(null);

    setFilePreview("");

    setQuestion("");
    setChatMessages([]);
    setAiAnswer("");
    setAiError("");

    setProjectInsights("");
    setInsightsError("");

    setArchitecture(null);
    setArchitectureError("");

    setIsUploading(true);

    const formData = new FormData();

    formData.append(
      "project",
      file
    );

    console.log(
      "UPLOADING FILE:",
      file.name
    );

    fetch(
      "https://ai-codebase-assistant-production-59c5.up.railway.app/api/projects/upload",
      {
        method: "POST",
        body: formData,
      }
    )
      .then(async (response) => {
        const data =
          await response.json();

        console.log(
          "UPLOAD RESPONSE:",
          data
        );

        if (!response.ok) {
          throw new Error(
            data.error ||
              data.message ||
              "Upload failed"
          );
        }

        return data;
      })
      .then(async (data) => {
        setUploadMessage(
          data.message ||
            "Project uploaded successfully!"
        );

        let id: string | null = null;

        if (data.project?.id) {
          id = data.project.id;
        } else if (
          data.project?.projectId
        ) {
          id =
            data.project.projectId;
        }

        if (id) {
          setProjectId(id);
        }

        if (
          data.project?.analysis
        ) {
          setAnalysis(
            data.project.analysis
          );
        }

        // Generate Project Insights
        if (id) {
          await generateProjectInsights(
            id
          );

          // Generate Architecture
          await generateArchitecture(
            id
          );
        }
      })
      .catch((error) => {
        console.error(
          "Upload failed:",
          error
        );

        setUploadMessage(
          `Upload failed: ${
            error instanceof Error
              ? error.message
              : "Unknown error"
          }`
        );
      })
      .finally(() => {
        setIsUploading(false);
      });
  };
  // =========================================================
  // IMPORT GITHUB REPOSITORY
  // =========================================================

  const handleGitHubImport = async () => {
    const trimmedUrl = githubUrl.trim();

    if (!trimmedUrl) {
      setUploadMessage("Please enter a GitHub repository URL.");
      return;
    }

    setIsImportingGithub(true);
    setUploadMessage("");
    setAnalysis(null);
    setSelectedProjectFile(null);
    setProjectId(null);
    setFilePreview("");

    setQuestion("");
    setChatMessages([]);
    setAiAnswer("");
    setAiError("");

    setProjectInsights("");
    setInsightsError("");

    setArchitecture(null);
    setArchitectureError("");

    try {
      const response = await fetch(
        "https://ai-codebase-assistant-production-59c5.up.railway.app/api/projects/github",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url: trimmedUrl,
          }),
        }
      );

      const data = await response.json();

      console.log("GITHUB IMPORT RESPONSE:", data);

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Failed to import GitHub repository."
        );
      }

      setUploadMessage(
        data.message ||
          "GitHub repository imported successfully!"
      );

      let id: string | null = null;

      if (data.project?.id) {
        id = data.project.id;
      } else if (data.project?.projectId) {
        id = data.project.projectId;
      }

      if (id) {
        setProjectId(id);
      }

      if (data.project?.analysis) {
        setAnalysis(data.project.analysis);
      }

      setGithubUrl("");

      if (id) {
        await generateProjectInsights(id);
        await generateArchitecture(id);
      }

    } catch (error) {
      console.error(
        "GitHub import failed:",
        error
      );

      setUploadMessage(
        `GitHub import failed: ${
          error instanceof Error
            ? error.message
            : "Unknown error"
        }`
      );

    } finally {
      setIsImportingGithub(false);
    }
  };
  // =========================================================
  // OPEN PROJECT FILE
  // =========================================================

  const handleFileClick = async (
    file: string
  ) => {
    setSelectedProjectFile(file);
    setFilePreview("");
    setIsLoadingPreview(true);

    try {
      if (!projectId) {
        throw new Error(
          "Project ID not available."
        );
      }

      console.log(
        "Opening project file:",
        file
      );

      const response =
        await fetch(
          `https://ai-codebase-assistant-production-59c5.up.railway.app/api/projects/${encodeURIComponent(
            projectId
          )}/file?path=${encodeURIComponent(
            file
          )}`
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Failed to load file."
        );
      }

      setFilePreview(
        data.content || ""
      );
    } catch (error) {
      console.error(
        "Preview failed:",
        error
      );

      setFilePreview(
        `Unable to preview this file.\n\n${
          error instanceof Error
            ? error.message
            : "Unknown error"
        }`
      );
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // =========================================================
  // ASK CODEMIND
  // =========================================================

  const handleAskCodeMind = async () => {
    const trimmedQuestion = question.trim();

    if (!trimmedQuestion) {
      setAiError("Please enter a question.");
      return;
    }

    if (!projectId) {
      setAiError("Please upload a project first.");
      return;
    }

    setIsAsking(true);
    setAiAnswer("");
    setAiError("");

    setChatMessages((previous) => [
      ...previous,
      { role: "user", content: trimmedQuestion },
    ]);

    setQuestion("");

    try {
      const response = await fetch(
        `https://ai-codebase-assistant-production-59c5.up.railway.app/api/projects/${encodeURIComponent(
          projectId
        )}/ask`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            question: trimmedQuestion,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to get AI response."
        );
      }

      const answer = data.answer || "No answer received.";

      setAiAnswer(answer);

      setChatMessages((previous) => [
        ...previous,
        { role: "assistant", content: answer },
      ]);
    } catch (error) {
      console.error("AI request failed:", error);

      setAiError(
        error instanceof Error
          ? error.message
          : "AI request failed."
      );
    } finally {
      setIsAsking(false);
    }
  };

  const clearChat = () => {
    setChatMessages([]);
    setAiAnswer("");
    setAiError("");
  };

  const useSuggestedQuestion = (value: string) => {
    setQuestion(value);
    setAiError("");
  };
  // =========================================================
  // ENTER KEY
  // =========================================================

  const handleQuestionKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleAskCodeMind();
    }
  };
  // =========================================================
  // RENDER
  // =========================================================

  return (
    <main className="min-h-screen bg-[#0b0f19] text-white">

      {/* =====================================================
          BACKEND STATUS
      ===================================================== */}

      <div className="mx-auto mt-4 max-w-7xl px-6">

        <p
          className={`text-sm ${
            backendMessage.includes(
              "running"
            )
              ? "text-green-400"
              : "text-red-400"
          }`}
        >
          {backendMessage}
        </p>

      </div>

      {/* =====================================================
          NAVIGATION
      ===================================================== */}

      <nav className="border-b border-white/10">

        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">

          <div className="flex items-center gap-3">

            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 font-bold">
              C
            </div>

            <span className="text-xl font-semibold tracking-tight">
              CodeMind
            </span>

          </div>

          <div className="flex items-center gap-8 text-sm text-gray-400">

            <span className="cursor-pointer text-white">
              Dashboard
            </span>

            <span className="cursor-pointer hover:text-white">
              Projects
            </span>

            <span className="cursor-pointer hover:text-white">
              GitHub
            </span>

          </div>

        </div>

      </nav>

      {/* =====================================================
          HERO
      ===================================================== */}

      <section className="mx-auto max-w-7xl px-6 pb-16 pt-20">

        <div className="max-w-3xl">

          <div className="mb-5 inline-flex items-center rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm text-blue-300">
            AI-powered codebase intelligence
          </div>

          <h1 className="text-5xl font-bold leading-tight tracking-tight md:text-6xl">

            Understand any

            <span className="text-blue-500">
              {" "}
              codebase.
            </span>

          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-gray-400">

            Upload your software project and
            ask questions about its architecture,
            APIs, authentication, database, and
            implementation using natural language.

          </p>

        </div>

        {/* =================================================
            UPLOAD
        ================================================= */}

        <div className="mt-12 max-w-4xl">

          <div className="rounded-2xl border border-dashed border-white/20 bg-white/[0.03] p-10 text-center transition hover:border-blue-500/50 hover:bg-white/[0.05]">

            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/10 text-3xl">
              ↑
            </div>

            <h2 className="mt-5 text-xl font-semibold">
              Upload your project
            </h2>

            <p className="mt-2 text-sm text-gray-400">
              Upload a ZIP file containing
              your source code
            </p>

            <label className="mt-6 inline-block cursor-pointer rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium transition hover:bg-blue-500">

              {isUploading
                ? "Analyzing..."
                : "Choose Project"}

              <input
                type="file"
                accept=".zip"
                className="hidden"
                disabled={isUploading}
                onChange={(event) => {

                  const file =
                    event.target.files?.[0];

                  if (file) {
                    handleProjectUpload(
                      file
                    );
                  }

                }}
              />

            </label>

            {selectedFile && (
              <div className="mt-5 rounded-lg border border-green-500/20 bg-green-500/10 px-4 py-3 text-left">

                <p className="text-sm font-medium text-green-300">
                  Project selected
                </p>

                <p className="mt-1 text-sm text-gray-300">
                  {selectedFile.name}
                </p>

                <p className="mt-1 text-xs text-gray-500">

                  {(
                    selectedFile.size /
                    1024 /
                    1024
                  ).toFixed(2)}{" "}
                  MB

                </p>

              </div>
            )}

            {uploadMessage && (
              <div
                className={`mt-4 rounded-lg px-4 py-3 text-sm ${
                  uploadMessage
                    .toLowerCase()
                    .includes("failed")
                    ? "border border-red-500/20 bg-red-500/10 text-red-300"
                    : "border border-green-500/20 bg-green-500/10 text-green-300"
                }`}
              >
                {uploadMessage}
              </div>
            )}

            <p className="mt-4 text-xs text-gray-500">
              Supported: ZIP files • Maximum
              size: 50 MB
            </p>
            {(isUploading ||
  isImportingGithub ||
  isLoadingInsights ||
  isLoadingArchitecture) && (
  <div className="mt-5 rounded-xl border border-blue-500/20 bg-blue-500/5 p-5 text-left">

    <div className="flex items-center gap-3">

      <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />

      <div>
        <p className="text-sm font-medium text-blue-300">
          {isUploading || isImportingGithub
            ? "Importing project..."
            : isLoadingInsights
            ? "Generating AI insights..."
            : "Building architecture..."}
        </p>

        <p className="mt-1 text-xs text-gray-500">
          CodeMind is processing your codebase. Please wait...
        </p>
      </div>

    </div>

  </div>
)}

          </div>

          <div className="mt-5 flex items-center gap-4">

            <div className="h-px flex-1 bg-white/10" />

            <span className="text-xs text-gray-500">
              OR
            </span>

            <div className="h-px flex-1 bg-white/10" />

          </div>

         

        </div>

        {/* =================================================
            PROJECT ANALYSIS
        ================================================= */}
<div className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] p-5">

  <div className="flex items-center gap-3">

    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10 text-lg text-purple-400">
      ◉
    </div>

    <div>
      <h3 className="font-medium">
        Import from GitHub
      </h3>

      <p className="text-xs text-gray-500">
        Analyze a public GitHub repository
      </p>
    </div>

  </div>

  <div className="mt-4 flex flex-col gap-3 sm:flex-row">

    <input
      type="text"
      value={githubUrl}
      onChange={(event) =>
        setGithubUrl(event.target.value)
      }
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          handleGitHubImport();
        }
      }}
      placeholder="https://github.com/username/repository"
      disabled={isImportingGithub}
      className="flex-1 rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-gray-600 focus:border-purple-500/50 disabled:opacity-50"
    />

    <button
      type="button"
      onClick={handleGitHubImport}
      disabled={
        isImportingGithub ||
        !githubUrl.trim()
      }
      className="rounded-lg bg-purple-600 px-6 py-3 text-sm font-medium transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {isImportingGithub
        ? "Importing..."
        : "Import Repository"}
    </button>

  </div>

  <p className="mt-3 text-xs text-gray-600">
    Only public GitHub repositories are supported.
  </p>

</div>
        {analysis && (

          <section className="mt-12 max-w-4xl">

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8">

              <div className="flex items-center justify-between">

                <div>

                  <p className="text-sm text-blue-400">
                    Analysis complete
                  </p>

                  <h2 className="mt-1 text-2xl font-semibold">
                    Project Analysis
                  </h2>

                </div>

                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-blue-500/10 text-xl font-bold text-blue-400">

                  {analysis.totalFiles}

                </div>

              </div>

              {/* =================================================
                  STATISTICS
              ================================================= */}

              <div className="mt-8 grid gap-4 md:grid-cols-2">

                <div className="rounded-xl border border-white/10 bg-black/20 p-5">

                  <p className="text-sm text-gray-500">
                    Total Files
                  </p>

                  <p className="mt-2 text-3xl font-bold">
                    {analysis.totalFiles}
                  </p>

                </div>

                <div className="rounded-xl border border-white/10 bg-black/20 p-5">

                  <p className="text-sm text-gray-500">
                    File Types
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">

                    {Object.entries(
                      analysis.languages
                    ).map(
                      ([language, count]) => (

                        <div
                          key={language}
                          className="rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-2"
                        >

                          <span className="text-sm text-blue-300">
                            {language}
                          </span>

                          <span className="ml-2 text-sm font-semibold text-white">
                            {count}
                          </span>

                        </div>

                      )
                    )}

                  </div>

                </div>

              </div>

              {/* =================================================
                  AI PROJECT INSIGHTS
              ================================================= */}

              <div className="mt-8 rounded-xl border border-blue-500/20 bg-blue-500/5 p-6">

                <div className="flex items-center gap-3">

                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 font-bold">
                    C
                  </div>

                  <div>

                    <p className="text-sm text-blue-400">
                      AI-powered analysis
                    </p>

                    <h3 className="text-xl font-semibold">
                      Project Insights
                    </h3>

                  </div>

                </div>

                {isLoadingInsights && (

                  <div className="mt-6 rounded-lg border border-white/10 bg-black/20 p-5">

                    <div className="flex items-center gap-3">

                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />

                      <p className="text-sm text-gray-400">
                        CodeMind is analyzing
                        your project...
                      </p>

                    </div>

                  </div>

                )}

                {insightsError && (

                  <div className="mt-5 rounded-lg border border-red-500/20 bg-red-500/10 p-4">

                    <p className="text-sm text-red-300">
                      {insightsError}
                    </p>

                  </div>

                )}

                {projectInsights && (

                  <div className="mt-5 rounded-xl border border-white/10 bg-[#080b12] p-5">

                    <div className="whitespace-pre-wrap text-sm leading-7 text-gray-300">

                      {projectInsights}

                    </div>

                  </div>

                )}

              </div>

              {/* =================================================
                  ARCHITECTURE OVERVIEW
              ================================================= */}

              <div className="mt-8 rounded-xl border border-purple-500/20 bg-purple-500/5 p-6">

                <div className="flex items-center gap-3">

                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-600 font-bold">
                    A
                  </div>

                  <div>

                    <p className="text-sm text-purple-400">
                      AI architecture analysis
                    </p>

                    <h3 className="text-xl font-semibold">
                      Architecture Overview
                    </h3>

                  </div>

                </div>

                {isLoadingArchitecture && (

                  <div className="mt-6 rounded-lg border border-white/10 bg-black/20 p-5">

                    <div className="flex items-center gap-3">

                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />

                      <p className="text-sm text-gray-400">
                        CodeMind is mapping your
                        project architecture...
                      </p>

                    </div>

                  </div>

                )}

                {architectureError && (

                  <div className="mt-5 rounded-lg border border-red-500/20 bg-red-500/10 p-4">

                    <p className="text-sm text-red-300">
                      {architectureError}
                    </p>

                  </div>

                )}

                {architecture && (

                  <div className="mt-5 space-y-5">

                    {/* Architecture type + summary */}

                    <div className="rounded-xl border border-white/10 bg-[#080b12] p-5">

                      <div className="flex flex-wrap items-center gap-3">

                        <span className="rounded-md bg-purple-500/10 px-3 py-1 text-xs text-purple-300">
                          AI Generated
                        </span>

                        <span className="rounded-md bg-blue-500/10 px-3 py-1 text-xs text-blue-300">
                          {architecture.architectureType}
                        </span>

                      </div>

                      <p className="mt-4 text-sm leading-7 text-gray-300">
                        {architecture.summary}
                      </p>

                    </div>

                    {/* Visual architecture */}

                    {architecture.components.length > 0 && (

                      <div className="rounded-xl border border-white/10 bg-[#080b12] p-5">

                        <p className="text-sm font-medium text-gray-400">
                          System Components
                        </p>

                        <div className="mt-5 flex flex-col items-center">

                          {architecture.components.map(
                            (component, index) => (

                              <div
                                key={component.id}
                                className="w-full max-w-2xl"
                              >

                                <div className="rounded-xl border border-purple-500/30 bg-[#0d1322] p-5 transition hover:border-purple-400/70">

                                  <div className="flex items-start gap-4">

                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 font-semibold text-purple-300">
                                      {index + 1}
                                    </div>

                                    <div className="min-w-0">

                                      <h4 className="font-semibold text-white">
                                        {component.name}
                                      </h4>

                                      <p className="mt-1 text-xs text-purple-300">
                                        {component.technology}
                                      </p>

                                      <p className="mt-3 text-sm leading-6 text-gray-400">
                                        {component.responsibility}
                                      </p>

                                    </div>

                                  </div>

                                  {component.files?.length > 0 && (

                                    <div className="mt-4 flex flex-wrap gap-2">

                                      {component.files.slice(0, 6).map(
                                        (file) => (

                                          <span
                                            key={file}
                                            className="rounded-md border border-white/10 bg-black/30 px-2 py-1 text-xs text-gray-500"
                                          >
                                            {file}
                                          </span>

                                        )
                                      )}

                                    </div>

                                  )}

                                </div>

                                {index <
                                  architecture.components.length - 1 && (

                                  <div className="flex flex-col items-center py-2">

                                    <div className="h-6 w-px bg-purple-500/50" />

                                    <span className="text-purple-400">
                                      ↓
                                    </span>

                                  </div>

                                )}

                              </div>

                            )
                          )}

                        </div>

                      </div>

                    )}

                    {/* Relationships */}

                    {architecture.connections.length > 0 && (

                      <div className="rounded-xl border border-white/10 bg-[#080b12] p-5">

                        <p className="text-sm font-medium text-gray-400">
                          Component Relationships
                        </p>

                        <div className="mt-4 space-y-3">

                          {architecture.connections.map(
                            (connection, index) => {

                              const from =
                                architecture.components.find(
                                  (component) =>
                                    component.id === connection.from
                                );

                              const to =
                                architecture.components.find(
                                  (component) =>
                                    component.id === connection.to
                                );

                              return (

                                <div
                                  key={`${connection.from}-${connection.to}-${index}`}
                                  className="flex flex-wrap items-center gap-2 text-sm"
                                >

                                  <span className="rounded-md bg-purple-500/10 px-3 py-2 text-purple-300">
                                    {from?.name || connection.from}
                                  </span>

                                  <span className="text-purple-400">
                                    →
                                  </span>

                                  <span className="text-xs text-gray-500">
                                    {connection.label}
                                  </span>

                                  <span className="text-purple-400">
                                    →
                                  </span>

                                  <span className="rounded-md bg-blue-500/10 px-3 py-2 text-blue-300">
                                    {to?.name || connection.to}
                                  </span>

                                </div>

                              );
                            }
                          )}

                        </div>

                      </div>

                    )}

                    {/* Data flow */}

                    {architecture.dataFlow.length > 0 && (

                      <div className="rounded-xl border border-white/10 bg-[#080b12] p-5">

                        <p className="text-sm font-medium text-gray-400">
                          Data Flow
                        </p>

                        <div className="mt-4 space-y-3">

                          {architecture.dataFlow.map(
                            (step, index) => (

                              <div
                                key={index}
                                className="flex items-start gap-3"
                              >

                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-xs text-blue-300">
                                  {index + 1}
                                </div>

                                <p className="text-sm leading-6 text-gray-400">
                                  {step}
                                </p>

                              </div>

                            )
                          )}

                        </div>

                      </div>

                    )}

                  </div>

                )}

              </div>

              {/* =================================================
                  PROJECT FILES
              ================================================= */}

              <div className="mt-8">

                <div className="flex items-center justify-between">

                  <h3 className="text-lg font-semibold">
                    Project Files
                  </h3>

                  <span className="text-xs text-gray-500">
                    {analysis.files.length} files
                  </span>

                </div>

                <div className="mt-4 space-y-2">

                  {analysis.files.map(
                    (file) => (

                      <button
                        key={file}
                        type="button"
                        onClick={() =>
                          handleFileClick(
                            file
                          )
                        }
                        className="flex w-full items-center gap-3 rounded-lg border border-white/5 bg-black/20 px-4 py-3 text-left transition hover:border-blue-500/40 hover:bg-blue-500/5"
                      >

                        <span className="text-green-400">
                          ✓
                        </span>

                        <span className="text-sm text-gray-300">
                          {file}
                        </span>

                        <span className="ml-auto text-xs text-blue-400">
                          Open →
                        </span>

                      </button>

                    )
                  )}

                </div>

              </div>

              {/* =================================================
                  FILE PREVIEW
              ================================================= */}

              {selectedProjectFile && (

                <div className="mt-5 overflow-hidden rounded-xl border border-blue-500/20 bg-blue-500/5">

                  <div className="border-b border-white/10 p-5">

                    <p className="text-sm text-blue-400">
                      Selected file
                    </p>

                    <p className="mt-1 font-medium text-white">
                      {selectedProjectFile}
                    </p>

                  </div>

                  <div className="bg-[#080b12] p-5">

                    {isLoadingPreview ? (

                      <div className="py-8 text-center">

                        <p className="text-sm text-blue-400">
                          Loading file preview...
                        </p>

                      </div>

                    ) : (

                      <pre className="max-h-[500px] overflow-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-black/30 p-4 text-left text-sm leading-6 text-gray-300">

                        {filePreview ||
                          "No preview available."}

                      </pre>

                    )}

                  </div>

                </div>

              )}

              {/* =================================================
                  ASK CODEMIND
              ================================================= */}

              <div className="mt-8 overflow-hidden rounded-2xl border border-blue-500/20 bg-gradient-to-b from-blue-500/10 to-transparent">

                <div className="border-b border-white/10 p-6">
                  <div className="flex items-start justify-between gap-4">

                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 font-bold shadow-lg shadow-blue-600/20">
                        C
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-blue-400">
                            CodeMind AI
                          </p>

                          <span className="rounded-full border border-green-500/20 bg-green-500/10 px-2 py-0.5 text-[10px] text-green-400">
                            Online
                          </span>
                        </div>

                        <h3 className="mt-1 text-xl font-semibold">
                          Ask about your project
                        </h3>
                      </div>
                    </div>

                    {chatMessages.length > 0 && (
                      <button
                        type="button"
                        onClick={clearChat}
                        className="rounded-lg border border-white/10 px-3 py-2 text-xs text-gray-400 transition hover:border-white/20 hover:bg-white/5 hover:text-white"
                      >
                        Clear chat
                      </button>
                    )}

                  </div>

                  <p className="mt-4 text-sm leading-6 text-gray-400">
                    Ask CodeMind questions about the uploaded codebase.
                    Answers are generated from the project files analyzed by
                    your backend AI.
                  </p>
                </div>

                <div className="border-b border-white/10 px-6 py-5">
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                    Try asking
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {[
                      "What is this project about?",
                      "Explain the data flow.",
                      "What are the important files?",
                      "How can I improve this project?",
                    ].map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => useSuggestedQuestion(suggestion)}
                        disabled={!projectId || isAsking}
                        className="rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-2 text-left text-xs text-blue-300 transition hover:border-blue-500/40 hover:bg-blue-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>

                {chatMessages.length > 0 && (
                  <div className="max-h-[520px] space-y-4 overflow-y-auto p-6">
                    {chatMessages.map((message, index) => (
                      <div
                        key={`${message.role}-${index}`}
                        className={
                          message.role === "user"
                            ? "flex justify-end"
                            : "flex justify-start"
                        }
                      >
                        <div
                          className={
                            message.role === "user"
                              ? "max-w-[85%] rounded-2xl rounded-br-md border border-blue-500/20 bg-blue-600/10 px-4 py-3"
                              : "max-w-[90%] rounded-2xl rounded-bl-md border border-white/10 bg-[#080b12] px-4 py-4"
                          }
                        >
                          <div className="mb-2 flex items-center gap-2">
                            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-600 text-[10px] font-bold">
                              {message.role === "user" ? "U" : "C"}
                            </div>

                            <span className="text-xs font-medium text-gray-500">
                              {message.role === "user" ? "You" : "CodeMind"}
                            </span>
                          </div>

                          <div className="whitespace-pre-wrap text-sm leading-7 text-gray-300">
                            {message.content}
                          </div>
                        </div>
                      </div>
                    ))}

                    {isAsking && (
                      <div className="flex justify-start">
                        <div className="rounded-2xl rounded-bl-md border border-white/10 bg-[#080b12] px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex gap-1">
                              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" />
                              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400 [animation-delay:150ms]" />
                              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400 [animation-delay:300ms]" />
                            </div>

                            <span className="text-xs text-gray-500">
                              CodeMind is analyzing your project...
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {aiError && (
                  <div className="mx-6 mt-5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
                    <p className="text-sm text-red-300">
                      {aiError}
                    </p>
                  </div>
                )}

                <div className="p-6">
                  <div className="rounded-2xl border border-white/10 bg-[#080b12] p-3 transition focus-within:border-blue-500/40">

                    <textarea
                      value={question}
                      onChange={(event) => setQuestion(event.target.value)}
                      onKeyDown={handleQuestionKeyDown}
                      disabled={isAsking || !projectId}
                      rows={3}
                      placeholder={
                        projectId
                          ? "Ask anything about your codebase..."
                          : "Upload a project first to start chatting..."
                      }
                      className="w-full resize-none bg-transparent px-2 py-1 text-sm leading-6 text-white outline-none placeholder:text-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
                    />

                    <div className="mt-2 flex items-center justify-between gap-3">
                      <p className="text-[11px] text-gray-600">
                        Press Enter to ask • Shift + Enter for a new line
                      </p>

                      <button
                        type="button"
                        onClick={handleAskCodeMind}
                        disabled={
                          isAsking ||
                          !projectId ||
                          !question.trim()
                        }
                        className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {isAsking ? "Thinking..." : "Ask CodeMind"}
                      </button>
                    </div>
                  </div>

                  {!projectId && (
                    <p className="mt-3 text-xs text-yellow-500">
                      Upload a project first to use CodeMind AI.
                    </p>
                  )}
                </div>
              </div>

            </div>

          </section>

        )}

      </section>

      {/* =====================================================
          RECENT PROJECTS
      ===================================================== */}

      <section className="mx-auto max-w-7xl border-t border-white/10 px-6 py-12">

        <div className="flex items-center justify-between">

          <div>

            <h2 className="text-2xl font-semibold">
              Your Projects
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Recently analyzed codebases
            </p>

          </div>

          <button className="text-sm text-blue-400 hover:text-blue-300">
            View all →
          </button>

        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-3">

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-white/20">

            <div className="flex items-center justify-between">

              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400">
                JS
              </div>

              <span className="text-xs text-gray-500">
                Demo
              </span>

            </div>

            <h3 className="mt-5 font-semibold">
              E-Commerce Platform
            </h3>

            <p className="mt-2 text-sm text-gray-500">
              Full-stack application
            </p>

            <div className="mt-5 flex gap-4 text-xs text-gray-500">

              <span>
                124 files
              </span>

              <span>•</span>

              <span>
                12.4k lines
              </span>

            </div>

          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-white/20">

            <div className="flex items-center justify-between">

              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10 text-green-400">
                PY
              </div>

              <span className="text-xs text-gray-500">
                Demo
              </span>

            </div>

            <h3 className="mt-5 font-semibold">
              FastAPI Service
            </h3>

            <p className="mt-2 text-sm text-gray-500">
              Python backend application
            </p>

            <div className="mt-5 flex gap-4 text-xs text-gray-500">

              <span>
                67 files
              </span>

              <span>•</span>

              <span>
                5.8k lines
              </span>

            </div>

          </div>

          <div className="flex min-h-[210px] flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-center">

            <div className="text-3xl text-gray-600">
              +
            </div>

            <h3 className="mt-3 font-medium text-gray-400">
              Analyze a new project
            </h3>

            <p className="mt-1 text-xs text-gray-600">
              Upload a codebase to get started
            </p>

          </div>

        </div>

      </section>

    </main>
  );
}