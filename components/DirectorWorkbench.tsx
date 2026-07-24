"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiPanel } from "@/components/ApiPanel";
import { HistoryPanel } from "@/components/HistoryPanel";
import { OutputPanel } from "@/components/OutputPanel";
import { PromptInput } from "@/components/PromptInput";
import {
  DEFAULT_DURATION_SECONDS,
  normalizeDurationSeconds,
} from "@/lib/duration";
import { getFullPromptText, getInitialIdea, initialIdea, initialIdeaEn } from "@/lib/mockPrompt";
import type {
  ApiConfig,
  ApiConnectionSource,
  ApiStatus,
  AssetKind,
  AssetRecord,
  HistoryRecord,
  KnowledgeHighlight,
  KnowledgeUsageItem,
  OutputLanguage,
  PromptVersion,
  PromptKind,
  ReferenceAttachment,
} from "@/types";

const EMPTY_API_CONFIG: ApiConfig = {
  modelName: "",
  apiKey: "",
  requestUrl: "",
};

const SAVED_API_STORAGE_KEY = "director-workspace-saved-api";
const API_SESSION_STORAGE_KEY = "director-workspace-api-session";
const HISTORY_IMPORT_STORAGE_KEY = "director-workspace-pending-history-import";
const SESSION_ASSET_STORAGE_KEY = "director-workspace-session-assets";
const DEMO_MODE = false;
const REFERENCE_UPLOADS_ENABLED = true;

type GenerationStreamPayload = {
  delta?: string;
  message?: string;
  promptText?: string;
  promptKind?: "video" | "image" | "screenwriting";
  knowledge?: {
    databaseVersion?: string;
    matchedEntryIds?: string[];
  };
  promptCompiler?: {
    version?: string;
    strategy?: string;
    selectedMethodIds?: string[];
    selectedMethodTags?: string[];
  };
  durationSeconds?: number;
  historyRecord?: HistoryRecord;
  knowledgeHighlights?: KnowledgeHighlight[];
  knowledgeUsage?: KnowledgeUsageItem[];
};

type DirectorWorkbenchProps = {
  workspaceMode?: "director" | "screenwriting";
};

type ApiSessionState = {
  connected: boolean;
  source: ApiConnectionSource;
  config: ApiConfig;
};

type PendingHistoryImport = {
  targetWorkspace: "director" | "screenwriting";
  record: HistoryRecord;
};

const screenwritingIdeaZh =
  "一个人物在关键选择前，被旧关系与新目标同时拉扯。";
const screenwritingIdeaEn =
  "A character stands before a decisive choice, pulled between an old relationship and a new goal.";

const workbenchCopy = {
  zh: {
    directorBoard: "导演板",
    screenwritingBoard: "编剧板",
    history: "历史记录",
    backToTop: "返回主页",
    languageLabel: "界面语言",
    heroDirectorTitle: "影视级创作工作站",
    heroScreenwritingTitle: "剧本创作工作站",
    heroDirectorLead: "把一句普通想法，转译成",
    heroCinemaWord: "电影级",
    heroDirectorProduct: "AI 创作提示词",
    heroScreenwritingProduct: "剧本方案",
    heroDirectorSub:
      "不是把提示词写长，而是把你的直觉变成可执行的镜头、资产、动作因果与风险控制。",
    heroScreenwritingSub:
      "把故事直觉整理成可推进的人物、场景、对白与结构。",
    statuses: {
      buildingDirector: "正在建立导演结构...",
      outputScript: "正在输出剧本...",
      outputImage: "正在输出图片提示词...",
      outputDirector: "正在按导演结构输出文字...",
      done: "生成完成",
      failed: "生成失败",
      canceled: "已取消生成",
      optimizingDone: "优化完成",
      optimizingFailed: "优化失败",
      connectVideo: "正在连接模型与数据库...",
      connectImage: "正在连接模型与图片数据库...",
      connectScriptGenerate: "正在连接剧本生成数据库...",
      connectScriptOptimize: "正在连接剧本数据库...",
    },
    errors: {
      builtinApiFailed: "内置 API 连接失败",
      apiTestFailed: "API 连接测试失败",
      streamMissing: "生成接口没有返回可读取的数据流",
      generateFailed: "提示词生成失败",
      generateRetry: "提示词生成失败，请稍后重试",
      imageFailed: "图片提示词生成失败",
      imageRetry: "图片提示词生成失败，请稍后重试",
      scriptFailed: "剧本生成失败",
      scriptRetry: "剧本生成失败，请稍后重试",
      scriptOptimizeFailed: "剧本优化失败",
      scriptOptimizeRetry: "剧本优化失败，请稍后重试",
      refineDirector: "导演继续指导失败",
      refineImage: "摄影继续指导失败",
      refineScript: "编剧继续指导失败",
      refineDirectorRetry: "导演继续指导失败，请稍后重试",
      refineImageRetry: "摄影继续指导失败，请稍后重试",
      refineScriptRetry: "编剧继续指导失败，请稍后重试",
    },
  },
  en: {
    directorBoard: "Director",
    screenwritingBoard: "Writer",
    history: "History",
    backToTop: "Back to home",
    languageLabel: "Interface language",
    heroDirectorTitle: "Cinematic Creation Workstation",
    heroScreenwritingTitle: "Script Creation Workstation",
    heroDirectorLead: "Turn a simple idea into a",
    heroCinemaWord: "cinematic",
    heroDirectorProduct: "AI creation prompt",
    heroScreenwritingProduct: "script treatment",
    heroDirectorSub:
      "Not longer prompts for their own sake, but executable shots, assets, action logic, and risk control.",
    heroScreenwritingSub:
      "Shape story instinct into characters, scenes, dialogue, and structure that can keep moving.",
    statuses: {
      buildingDirector: "Building the director structure...",
      outputScript: "Writing the script...",
      outputImage: "Writing the image prompt...",
      outputDirector: "Writing the director-ready prompt...",
      done: "Complete",
      failed: "Failed",
      canceled: "Canceled",
      optimizingDone: "Optimized",
      optimizingFailed: "Optimization failed",
      connectVideo: "Connecting the model and public showcase workflow...",
      connectImage: "Connecting the model and image workflow...",
      connectScriptGenerate: "Connecting the model and writing workflow...",
      connectScriptOptimize: "Connecting the model and revision workflow...",
    },
    errors: {
      builtinApiFailed: "Built-in API connection failed",
      apiTestFailed: "API connection test failed",
      streamMissing: "The generation endpoint did not return a readable stream",
      generateFailed: "Prompt generation failed",
      generateRetry: "Prompt generation failed. Please try again later.",
      imageFailed: "Image prompt generation failed",
      imageRetry: "Image prompt generation failed. Please try again later.",
      scriptFailed: "Script generation failed",
      scriptRetry: "Script generation failed. Please try again later.",
      scriptOptimizeFailed: "Script optimization failed",
      scriptOptimizeRetry: "Script optimization failed. Please try again later.",
      refineDirector: "Director refinement failed",
      refineImage: "Image direction refinement failed",
      refineScript: "Script refinement failed",
      refineDirectorRetry: "Director refinement failed. Please try again later.",
      refineImageRetry:
        "Image direction refinement failed. Please try again later.",
      refineScriptRetry: "Script refinement failed. Please try again later.",
    },
  },
} as const;

function getInitialScreenwritingIdea(outputLanguage: OutputLanguage) {
  return outputLanguage === "en" ? screenwritingIdeaEn : screenwritingIdeaZh;
}

function LogoMark() {
  return (
    <span className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-[#1A2C26] text-[#F4E8D4] shadow-[0_12px_28px_rgba(26,44,38,0.16)]">
      <span className="absolute inset-[5px] rounded-full border border-[#C68A4A]/45" />
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.45"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-6 w-6"
      >
        <path d="M5.2 8.2h13.6v7.9a2 2 0 0 1-2 2H7.2a2 2 0 0 1-2-2V8.2Z" />
        <path d="m5.8 8.2 2-3.8h3.1l-2 3.8M11.3 8.2l2-3.8h3.1l-2 3.8M5.2 11.6h13.6" />
        <path d="M10.2 14.1 14 16.1l-3.8 2.1v-4.1Z" />
      </svg>
    </span>
  );
}

function HeroTitle({ children }: { children: string }) {
  return (
    <h1 className="hero-title-display" data-title={children}>
      <span className="hero-title-text">{children}</span>
    </h1>
  );
}

function getInitialPromptVersions(
  workspaceMode: "director" | "screenwriting",
  outputLanguage: OutputLanguage,
) {
  if (workspaceMode === "screenwriting") {
    return [
      {
        id: "screenwriting-preview",
        promptText:
          outputLanguage === "en"
            ? "【Script Draft / SCRIPT DRAFT】\n\nCharacter Goal:\n\nCore Conflict:\n\nScene Progression:\n\nDialogue Texture:"
            : "【剧本草案 / SCRIPT DRAFT】\n\n人物目标：\n\n核心冲突：\n\n场景推进：\n\n对白质感：",
        isMock: true,
        promptKind: "screenwriting" as const,
        knowledgeMatchCount: 0,
      },
    ];
  }

  return [
    {
      id: "mock-preview",
      promptText: getFullPromptText(outputLanguage),
      isMock: true,
      promptKind: "video" as const,
      knowledgeMatchCount: 0,
      durationSeconds: DEFAULT_DURATION_SECONDS,
    },
  ];
}

function getHistoryRecordPromptKind(record: HistoryRecord): PromptKind {
  return (
    record.promptKind ??
    (record.action === "image-generate" || record.action === "image-refine"
      ? "image"
      : record.action === "screenwriting-generate" ||
          record.action === "screenwriting-optimize"
        ? "screenwriting"
        : "video")
  );
}

function getHistoryRecordTargetWorkspace(record: HistoryRecord) {
  return getHistoryRecordPromptKind(record) === "screenwriting"
    ? "screenwriting"
    : "director";
}

function readSessionAssetRecords() {
  try {
    const raw = window.sessionStorage.getItem(SESSION_ASSET_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as AssetRecord[]) : [];

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    window.sessionStorage.removeItem(SESSION_ASSET_STORAGE_KEY);
    return [];
  }
}

function writeSessionAssetRecords(records: AssetRecord[]) {
  window.sessionStorage.setItem(
    SESSION_ASSET_STORAGE_KEY,
    JSON.stringify(records.slice(0, 120)),
  );
}

function normalizeAssetReferenceName(name: string) {
  return name.trim().replace(/^@+/u, "").replace(/\s+/gu, "");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function textReferencesAssetName(text: string, assetName: string) {
  const referencePattern = new RegExp(
    `@${escapeRegExp(assetName)}(?![\\p{L}\\p{N}_-])`,
    "u",
  );

  return referencePattern.test(text);
}

function getReferencedAssets(text: string, assetRecords: AssetRecord[]) {
  return assetRecords.filter((asset) =>
    textReferencesAssetName(text, asset.name),
  );
}

function mergeAssetRecords(
  primaryRecords: AssetRecord[],
  secondaryRecords: AssetRecord[],
) {
  const seen = new Set<string>();
  const merged: AssetRecord[] = [];

  for (const asset of [...primaryRecords, ...secondaryRecords]) {
    const key = asset.id || asset.name;
    if (seen.has(key) || seen.has(asset.name)) continue;
    seen.add(key);
    seen.add(asset.name);
    merged.push(asset);
  }

  return merged.slice(0, 120);
}

async function saveAssetRecordToServer(input: {
  name: string;
  promptText: string;
  sourcePromptKind: PromptKind;
  assetKind: AssetKind;
}) {
  const response = await fetch("/api/assets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = (await response.json()) as {
    asset?: AssetRecord;
    message?: string;
  };

  if (!response.ok || !data.asset) {
    const error = new Error(data.message ?? "Unable to save the asset.") as Error & {
      status?: number;
    };
    error.status = response.status;
    throw error;
  }

  return data.asset;
}

export function DirectorWorkbench({
  workspaceMode = "director",
}: DirectorWorkbenchProps) {
  const isScreenwritingWorkspace = workspaceMode === "screenwriting";
  const [outputLanguage, setOutputLanguage] = useState<OutputLanguage>("en");
  const [promptOutputLanguage, setPromptOutputLanguage] =
    useState<OutputLanguage>("en");
  const [idea, setIdea] = useState(
    isScreenwritingWorkspace
      ? getInitialScreenwritingIdea("en")
      : getInitialIdea("en"),
  );
  const [durationSeconds, setDurationSeconds] = useState(
    DEFAULT_DURATION_SECONDS,
  );
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyRecords, setHistoryRecords] = useState<HistoryRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [assetSaveFeedback, setAssetSaveFeedback] = useState<string | null>(
    null,
  );
  const [assetSaveError, setAssetSaveError] = useState<string | null>(null);
  const [apiOpen, setApiOpen] = useState(true);
  const [apiConfig, setApiConfig] = useState<ApiConfig>(EMPTY_API_CONFIG);
  const [apiStatus, setApiStatus] = useState<ApiStatus>("testing");
  const [apiSource, setApiSource] = useState<ApiConnectionSource | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [savedApiConfig, setSavedApiConfig] = useState<ApiConfig | null>(null);
  const [saveFeedback, setSaveFeedback] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generationMode, setGenerationMode] = useState<
    | "video"
    | "image"
    | "screenwriting-generate"
    | "screenwriting-optimize"
    | null
  >(null);
  const [referenceAttachments, setReferenceAttachments] = useState<
    ReferenceAttachment[]
  >([]);
  const [promptVersions, setPromptVersions] = useState<PromptVersion[]>(
    getInitialPromptVersions(workspaceMode, "en"),
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copyErrorId, setCopyErrorId] = useState<string | null>(null);
  const [refiningId, setRefiningId] = useState<string | null>(null);
  const [refinementError, setRefinementError] = useState<string | null>(null);
  const saveFeedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const assetFeedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generationAbortRef = useRef<AbortController | null>(null);
  const finalRevealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generationRunIdRef = useRef<string | null>(null);
  const copy = workbenchCopy[outputLanguage];

  function applyOutputLanguage(nextLanguage: OutputLanguage) {
    setOutputLanguage(nextLanguage);

    setIdea((currentIdea) => {
      const zhDefault = isScreenwritingWorkspace
        ? screenwritingIdeaZh
        : initialIdea;
      const enDefault = isScreenwritingWorkspace
        ? screenwritingIdeaEn
        : initialIdeaEn;

      if (currentIdea === zhDefault || currentIdea === enDefault) {
        return isScreenwritingWorkspace
          ? getInitialScreenwritingIdea(nextLanguage)
          : getInitialIdea(nextLanguage);
      }

      return currentIdea;
    });

  }

  function applyPromptOutputLanguage(nextLanguage: OutputLanguage) {
    setPromptOutputLanguage(nextLanguage);
    setPromptVersions((current) =>
      current.every((version) => version.isMock)
        ? getInitialPromptVersions(workspaceMode, nextLanguage)
        : current,
    );
  }

  const applyHistoryRecord = useCallback((record: HistoryRecord) => {
    const promptKind = getHistoryRecordPromptKind(record);
    const normalizedRecordDuration =
      promptKind === "video"
        ? normalizeDurationSeconds(record.durationSeconds)
        : undefined;
    setIdea(record.userIdea);
    if (promptKind === "video") {
      setDurationSeconds(normalizedRecordDuration || DEFAULT_DURATION_SECONDS);
    }
    setPromptVersions([
      {
        id: record.id,
        promptText: record.promptText,
        isMock: false,
        promptKind,
        knowledgeMatchCount: record.knowledgeMatchCount,
        compilerMethodCount: record.compilerMethodCount,
        compilerStrategy: record.compilerStrategy,
        durationSeconds: normalizedRecordDuration,
        knowledgeHighlights: record.knowledgeHighlights,
        knowledgeUsage: record.knowledgeUsage,
      },
    ]);
    setHistoryOpen(false);
    requestAnimationFrame(() => {
      document
        .getElementById("director-output")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  useEffect(() => {
    const startupTimer = window.setTimeout(async () => {
      if (!DEMO_MODE) {
        try {
          const storedConfig = window.localStorage.getItem(SAVED_API_STORAGE_KEY);
          if (storedConfig) {
            setSavedApiConfig(JSON.parse(storedConfig) as ApiConfig);
          }
        } catch {
          window.localStorage.removeItem(SAVED_API_STORAGE_KEY);
        }

        try {
          const sessionState = window.sessionStorage.getItem(
            API_SESSION_STORAGE_KEY,
          );
          if (sessionState) {
            const parsed = JSON.parse(sessionState) as ApiSessionState;
            if (parsed.connected && parsed.source && parsed.config) {
              setApiConfig(parsed.config);
              setApiStatus("connected");
              setApiSource(parsed.source);
              setApiError(null);
              setApiOpen(false);
              return;
            }
          }
        } catch {
          window.sessionStorage.removeItem(API_SESSION_STORAGE_KEY);
        }
      } else {
        window.localStorage.removeItem(SAVED_API_STORAGE_KEY);
        window.sessionStorage.removeItem(API_SESSION_STORAGE_KEY);
      }

      try {
        const response = await fetch("/api/test-connection", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apiConfig: EMPTY_API_CONFIG }),
        });
        const data = (await response.json()) as {
          connected?: boolean;
          source?: ApiConnectionSource;
          message?: string;
        };

        if (!response.ok || !data.connected || !data.source) {
          throw new Error(data.message ?? copy.errors.builtinApiFailed);
        }

        setApiStatus("connected");
        setApiSource(data.source);
        setApiError(null);
        setApiOpen(false);
        window.sessionStorage.setItem(
          API_SESSION_STORAGE_KEY,
          JSON.stringify({
            connected: true,
            source: data.source,
            config: EMPTY_API_CONFIG,
          } satisfies ApiSessionState),
        );
      } catch (error) {
        window.sessionStorage.removeItem(API_SESSION_STORAGE_KEY);
        setApiStatus("failed");
        setApiSource(null);
        setApiError(
          error instanceof Error ? error.message : copy.errors.builtinApiFailed,
        );
      }
    }, 0);

    return () => window.clearTimeout(startupTimer);
  }, [copy.errors.builtinApiFailed]);

  useEffect(() => {
    void loadHistoryRecords();
  }, []);

  useEffect(() => {
    void loadAssets();
  }, []);

  useEffect(() => {
    return () => {
      generationAbortRef.current?.abort();
      clearFinalRevealTimer();
    };
  }, []);

  useEffect(() => {
    try {
      const pendingImport = window.sessionStorage.getItem(
        HISTORY_IMPORT_STORAGE_KEY,
      );
      if (!pendingImport) return;

      const parsed = JSON.parse(pendingImport) as PendingHistoryImport;
      if (parsed.targetWorkspace !== workspaceMode) return;

      window.sessionStorage.removeItem(HISTORY_IMPORT_STORAGE_KEY);
      window.setTimeout(() => applyHistoryRecord(parsed.record), 0);
    } catch {
      window.sessionStorage.removeItem(HISTORY_IMPORT_STORAGE_KEY);
    }
  }, [applyHistoryRecord, workspaceMode]);

  async function loadHistoryRecords() {
    setHistoryLoading(true);

    try {
      const response = await fetch("/api/history", { cache: "no-store" });
      const data = (await response.json()) as {
        records?: HistoryRecord[];
        message?: string;
      };

      if (!response.ok) {
        throw new Error(data.message ?? "Unable to load history.");
      }

      setHistoryRecords(Array.isArray(data.records) ? data.records : []);
    } catch {
      setHistoryRecords([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  function rememberHistoryRecord(record?: HistoryRecord) {
    if (!record) return;

    setHistoryRecords((current) => {
      const nextRecords = [
        record,
        ...current.filter((currentRecord) => currentRecord.id !== record.id),
      ].slice(0, 80);

      return nextRecords;
    });
  }

  async function loadAssets() {
    const sessionAssets = readSessionAssetRecords();

    try {
      const response = await fetch("/api/assets", { cache: "no-store" });
      const data = (await response.json()) as {
        assets?: AssetRecord[];
        message?: string;
      };

      if (!response.ok) {
        throw new Error(data.message ?? "Unable to load assets.");
      }

      let serverAssets = Array.isArray(data.assets) ? data.assets : [];

      if (sessionAssets.length > 0) {
        const syncedAssets: AssetRecord[] = [];

        for (const asset of sessionAssets) {
          try {
            syncedAssets.push(
              await saveAssetRecordToServer({
                name: asset.name,
                promptText: asset.promptText,
                sourcePromptKind: asset.sourcePromptKind ?? "video",
                assetKind: asset.assetKind ?? "character",
              }),
            );
          } catch {
            // Keep browser-session assets visible if the server is read-only.
          }
        }

        if (syncedAssets.length > 0) {
          serverAssets = mergeAssetRecords(syncedAssets, serverAssets);
          writeSessionAssetRecords(
            sessionAssets.filter(
              (asset) =>
                !syncedAssets.some(
                  (syncedAsset) => syncedAsset.name === asset.name,
                ),
            ),
          );
        }
      }

      setAssets(
        serverAssets.length > 0
          ? mergeAssetRecords(serverAssets, sessionAssets)
          : sessionAssets,
      );
    } catch {
      setAssets(DEMO_MODE ? sessionAssets : []);
    }
  }

  function showAssetFeedback(message: string | null, error: string | null) {
    setAssetSaveFeedback(message);
    setAssetSaveError(error);

    if (assetFeedbackTimer.current) {
      clearTimeout(assetFeedbackTimer.current);
    }

    assetFeedbackTimer.current = setTimeout(() => {
      setAssetSaveFeedback(null);
      setAssetSaveError(null);
    }, 2600);
  }

  async function handleSaveAsset(
    name: string,
    promptText: string,
    sourcePromptKind: PromptKind,
    assetKind: AssetKind,
  ) {
    const cleanName = normalizeAssetReferenceName(name);
    const cleanPromptText = promptText.trim();

    if (!cleanName || !cleanPromptText) {
      showAssetFeedback(null, "Asset name and asset lock text are required.");
      return null;
    }

    try {
      const savedAsset = await saveAssetRecordToServer({
        name: cleanName,
        promptText: cleanPromptText,
        sourcePromptKind,
        assetKind,
      });
      setAssets((current) => {
        const existingIndex = current.findIndex(
          (asset) => asset.id === savedAsset.id || asset.name === savedAsset.name,
        );

        if (existingIndex < 0) return [savedAsset, ...current];

        return current.map((asset, index) =>
          index === existingIndex ? savedAsset : asset,
        );
      });
      showAssetFeedback(`Saved asset @${savedAsset.name}`, null);
      return savedAsset;
    } catch (error) {
      if (DEMO_MODE && (error as { status?: number }).status === 403) {
        const now = new Date().toISOString();
        const savedAsset: AssetRecord = {
          id: crypto.randomUUID(),
          name: cleanName,
          promptText: cleanPromptText,
          createdAt: now,
          updatedAt: now,
          sourcePromptKind,
          assetKind,
        };

        setAssets((current) => {
          const nextRecords = [
            savedAsset,
            ...current.filter((asset) => asset.name !== savedAsset.name),
          ].slice(0, 120);

          writeSessionAssetRecords(nextRecords);
          return nextRecords;
        });
        showAssetFeedback(`Saved to this session: @${savedAsset.name}`, null);
        return savedAsset;
      }

      showAssetFeedback(
        null,
        error instanceof Error ? error.message : "Unable to save the asset. Please try again later.",
      );
      return null;
    }
  }

  async function handleDeleteAsset(id: string) {
    setAssets((current) => {
      const nextRecords = current.filter((asset) => asset.id !== id);
      if (DEMO_MODE) {
        writeSessionAssetRecords(nextRecords);
      }
      return nextRecords;
    });

    try {
      await fetch(`/api/assets?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
    } catch {
      void loadAssets();
    }
  }

  async function handleClearAssets() {
    setAssets([]);

    if (DEMO_MODE) {
      writeSessionAssetRecords([]);
    }

    try {
      await fetch("/api/assets?all=1", { method: "DELETE" });
    } catch {
      void loadAssets();
    }
  }

  async function handleUpdateAsset(asset: AssetRecord, promptText: string) {
    return handleSaveAsset(
      asset.name,
      promptText,
      asset.sourcePromptKind ?? "video",
      asset.assetKind ?? "character",
    );
  }

  function handleApiChange(field: keyof ApiConfig, value: string) {
    window.sessionStorage.removeItem(API_SESSION_STORAGE_KEY);
    setApiConfig((current) => ({ ...current, [field]: value }));
    setApiStatus("idle");
    setApiSource(null);
    setApiError(null);
    setApiOpen(true);
  }

  async function testConnection(config: ApiConfig) {
    setApiStatus("testing");
    setApiError(null);

    try {
      const response = await fetch("/api/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiConfig: config }),
      });
      const data = (await response.json()) as {
        connected?: boolean;
        source?: ApiConnectionSource;
        message?: string;
      };

      if (!response.ok || !data.connected || !data.source) {
        throw new Error(data.message ?? copy.errors.apiTestFailed);
      }

      setApiStatus("connected");
      setApiSource(data.source);
      setApiError(null);
      setApiOpen(false);
      window.sessionStorage.setItem(
        API_SESSION_STORAGE_KEY,
        JSON.stringify({
          connected: true,
          source: data.source,
          config,
        } satisfies ApiSessionState),
      );
    } catch (error) {
      window.sessionStorage.removeItem(API_SESSION_STORAGE_KEY);
      setApiStatus("failed");
      setApiSource(null);
      setApiError(error instanceof Error ? error.message : copy.errors.apiTestFailed);
      setApiOpen(true);
    }
  }

  function handleTestConnection() {
    void testConnection(apiConfig);
  }

  function handleSaveApi() {
    const configToSave = {
      modelName: apiConfig.modelName.trim(),
      apiKey: apiConfig.apiKey.trim(),
      requestUrl: apiConfig.requestUrl.trim(),
    };

    if (
      !configToSave.modelName ||
      !configToSave.apiKey ||
      !configToSave.requestUrl
    ) {
      return;
    }

    window.localStorage.setItem(
      SAVED_API_STORAGE_KEY,
      JSON.stringify(configToSave),
    );
    setSavedApiConfig(configToSave);
    setSaveFeedback(true);

    if (saveFeedbackTimer.current) {
      clearTimeout(saveFeedbackTimer.current);
    }
    saveFeedbackTimer.current = setTimeout(
      () => setSaveFeedback(false),
      1800,
    );
  }

  function handleFillSavedApi() {
    if (!savedApiConfig) return;

    setApiConfig(savedApiConfig);
    window.sessionStorage.removeItem(API_SESSION_STORAGE_KEY);
    setApiStatus("idle");
    setApiSource(null);
    setApiError(null);
  }

  function applyStreamPayload(
    versionId: string,
    eventName: string,
    payload: GenerationStreamPayload,
  ) {
    if (eventName === "status") {
      setPromptVersions((current) =>
        current.map((version) =>
          version.id === versionId
            ? {
                ...version,
                revealStatus: payload.message ?? copy.statuses.buildingDirector,
                knowledgeMatchCount:
                  payload.knowledge?.matchedEntryIds?.length ??
                  version.knowledgeMatchCount,
                compilerMethodCount:
                  payload.promptCompiler?.selectedMethodIds?.length ??
                  version.compilerMethodCount,
                compilerStrategy:
                  payload.promptCompiler?.strategy ?? version.compilerStrategy,
              }
            : version,
        ),
      );
      return;
    }

    if (eventName === "delta" && payload.delta) {
      setPromptVersions((current) =>
        current.map((version) =>
          version.id === versionId
            ? {
                ...version,
                streamPreviewText:
                  `${version.streamPreviewText ?? ""}${payload.delta}`.slice(
                    -6_000,
                  ),
                isRevealing: true,
                revealStatus:
                  (payload.promptKind ?? version.promptKind) === "screenwriting"
                    ? copy.statuses.outputScript
                    : (payload.promptKind ?? version.promptKind) === "image"
                    ? copy.statuses.outputImage
                    : copy.statuses.outputDirector,
              }
            : version,
        ),
      );
      return;
    }

    if (eventName === "complete" && payload.promptText) {
      setPromptVersions((current) =>
        current.map((version) =>
          version.id === versionId
            ? {
                ...version,
                promptText: "",
                promptKind:
                  payload.promptKind ?? version.promptKind ?? "video",
                isRevealing: true,
                revealStatus:
                  (payload.promptKind ?? version.promptKind) === "screenwriting"
                    ? copy.statuses.outputScript
                    : (payload.promptKind ?? version.promptKind) === "image"
                    ? copy.statuses.outputImage
                    : copy.statuses.outputDirector,
                streamPreviewText: undefined,
                durationSeconds:
                  payload.durationSeconds ?? version.durationSeconds,
                knowledgeMatchCount:
                  payload.knowledge?.matchedEntryIds?.length ?? 0,
                compilerMethodCount:
                  payload.promptCompiler?.selectedMethodIds?.length ?? 0,
                compilerStrategy: payload.promptCompiler?.strategy,
                knowledgeHighlights: payload.knowledgeHighlights ?? [],
                knowledgeUsage: payload.knowledgeUsage ?? [],
              }
            : version,
        ),
      );
      rememberHistoryRecord(payload.historyRecord);
      return;
    }

    if (eventName === "error") {
      throw new Error(payload.message ?? copy.errors.generateFailed);
    }
  }

  function getGenerationErrorMessage(error: unknown, fallbackMessage: string) {
    return error instanceof Error ? error.message : fallbackMessage;
  }

  function clearFinalRevealTimer() {
    if (finalRevealTimerRef.current) {
      clearTimeout(finalRevealTimerRef.current);
      finalRevealTimerRef.current = null;
    }
  }

  function parseStreamEvent(rawEvent: string) {
    const eventLines = rawEvent.split(/\r?\n/u);
    let eventName = "message";
    const dataLines: string[] = [];

    for (const line of eventLines) {
      if (!line || line.startsWith(":")) continue;

      if (line.startsWith("event:")) {
        eventName = line.replace(/^event:\s?/u, "").trim() || "message";
        continue;
      }

      if (line.startsWith("data:")) {
        dataLines.push(line.replace(/^data:\s?/u, ""));
      }
    }

    if (!dataLines.length) return null;

    return {
      eventName,
      payload: JSON.parse(dataLines.join("\n")) as GenerationStreamPayload,
    };
  }

  async function readGenerationStream(response: Response, versionId: string) {
    if (!response.body) {
      throw new Error(copy.errors.streamMissing);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let completePayload: GenerationStreamPayload | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split(/\n\n|\r\n\r\n/u);
      buffer = events.pop() ?? "";

      for (const rawEvent of events) {
        const parsedEvent = parseStreamEvent(rawEvent);
        if (!parsedEvent) continue;

        applyStreamPayload(
          versionId,
          parsedEvent.eventName,
          parsedEvent.payload,
        );

        if (parsedEvent.eventName === "complete") {
          completePayload = parsedEvent.payload;
        }
      }
    }

    buffer += decoder.decode();

    if (buffer.trim()) {
      const parsedEvent = parseStreamEvent(buffer);
      if (parsedEvent) {
        applyStreamPayload(versionId, parsedEvent.eventName, parsedEvent.payload);
        if (parsedEvent.eventName === "complete") {
          completePayload = parsedEvent.payload;
        }
      }
    }

    return completePayload;
  }

  function revealFinalPromptText(
    versionId: string,
    promptText: string,
    promptKind: PromptKind,
  ) {
    clearFinalRevealTimer();

    return new Promise<void>((resolve) => {
      const chunkSize =
        promptText.length > 4_000 ? 12 : promptText.length > 1_600 ? 6 : 3;
      const delayMs = promptText.length > 4_000 ? 6 : 10;
      let cursor = 0;

      const tick = () => {
        if (generationRunIdRef.current !== versionId) {
          resolve();
          return;
        }

        cursor = Math.min(promptText.length, cursor + chunkSize);
        setPromptVersions((current) =>
          current.map((version) =>
            version.id === versionId
              ? {
                  ...version,
                  promptText: promptText.slice(0, cursor),
                  promptKind,
                  isRevealing: cursor < promptText.length,
                  revealStatus:
                    cursor < promptText.length
                      ? promptKind === "screenwriting"
                        ? copy.statuses.outputScript
                        : promptKind === "image"
                          ? copy.statuses.outputImage
                          : copy.statuses.outputDirector
                      : copy.statuses.done,
                  streamPreviewText: undefined,
                }
              : version,
          ),
        );

        if (cursor >= promptText.length) {
          finalRevealTimerRef.current = null;
          resolve();
          return;
        }

        finalRevealTimerRef.current = setTimeout(tick, delayMs);
      };

      tick();
    });
  }

  function handleCancelGeneration() {
    const activeRunId = generationRunIdRef.current;

    generationAbortRef.current?.abort();
    generationAbortRef.current = null;
    generationRunIdRef.current = null;
    clearFinalRevealTimer();
    setGenerationMode(null);

    if (activeRunId) {
      setPromptVersions((current) =>
        current.map((version) =>
          version.id === activeRunId
            ? {
                ...version,
                isRevealing: false,
                revealStatus: copy.statuses.canceled,
                streamPreviewText: undefined,
              }
            : version,
        ),
      );
    }
  }

  async function runStreamedGeneration({
    endpoint,
    versionId,
    requestBody,
    fallbackError,
  }: {
    endpoint: string;
    versionId: string;
    requestBody: Record<string, unknown>;
    fallbackError: string;
  }) {
    const controller = new AbortController();
    generationAbortRef.current = controller;
    generationRunIdRef.current = versionId;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    if (!response.ok) {
      const data = (await response.json()) as { message?: string };
      throw new Error(data.message ?? fallbackError);
    }

    const completePayload = await readGenerationStream(response, versionId);

    if (!completePayload?.promptText) {
      throw new Error(fallbackError);
    }

    const promptKind = completePayload.promptKind ?? "video";
    await revealFinalPromptText(versionId, completePayload.promptText, promptKind);
  }

  async function handleGenerate() {
    if (
      !idea.trim() ||
      generationMode ||
      refiningId ||
      apiStatus !== "connected"
    ) {
      return;
    }

    setGenerationMode("video");
    setGenerationError(null);
    const versionId = crypto.randomUUID();
    const referencedAssets = getReferencedAssets(idea, assets);
    const referencedAssetIds = referencedAssets.map((asset) => asset.id);

    setPromptVersions([
      {
        id: versionId,
        promptText: "",
        isMock: false,
        promptKind: "video",
        knowledgeMatchCount: 0,
        compilerMethodCount: 0,
        durationSeconds,
        isRevealing: true,
        revealStatus: copy.statuses.connectVideo,
        streamPreviewText: "",
      },
    ]);

    requestAnimationFrame(() => {
      document
        .getElementById("director-output")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    try {
      await runStreamedGeneration({
        endpoint: "/api/generate/stream",
        versionId,
        fallbackError: copy.errors.generateFailed,
        requestBody: {
          userIdea: idea,
          apiConfig,
          durationSeconds,
          referenceAttachments,
          referencedAssetIds,
          referencedAssets,
          outputLanguage: promptOutputLanguage,
        },
      });
    } catch (error) {
      if (
        generationRunIdRef.current !== versionId ||
        (error instanceof Error &&
          (error.name === "AbortError" || error.message === "Generation canceled."))
      ) {
        return;
      }

      const message = getGenerationErrorMessage(
        error,
        copy.errors.generateRetry,
      );
      setGenerationError(message);
      setPromptVersions((current) =>
        current.map((version) =>
          version.id === versionId
            ? {
                ...version,
                isRevealing: false,
                revealStatus: copy.statuses.failed,
                streamPreviewText: undefined,
              }
            : version,
        ),
      );
    } finally {
      if (generationRunIdRef.current === versionId) {
        generationAbortRef.current = null;
        generationRunIdRef.current = null;
        setGenerationMode(null);
      }
    }
  }

  async function handleGenerateImage() {
    if (
      !idea.trim() ||
      generationMode ||
      refiningId ||
      apiStatus !== "connected"
    ) {
      return;
    }

    setGenerationMode("image");
    setGenerationError(null);
    const versionId = crypto.randomUUID();
    const referencedAssets = getReferencedAssets(idea, assets);
    const referencedAssetIds = referencedAssets.map((asset) => asset.id);

    setPromptVersions([
      {
        id: versionId,
        promptText: "",
        isMock: false,
        promptKind: "image",
        knowledgeMatchCount: 0,
        compilerMethodCount: 0,
        isRevealing: true,
        revealStatus: copy.statuses.connectImage,
        streamPreviewText: "",
      },
    ]);

    requestAnimationFrame(() => {
      document
        .getElementById("director-output")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    try {
      await runStreamedGeneration({
        endpoint: "/api/image-prompt/stream",
        versionId,
        fallbackError: copy.errors.imageFailed,
        requestBody: {
          userIdea: idea,
          apiConfig,
          referenceAttachments,
          referencedAssetIds,
          referencedAssets,
          outputLanguage: promptOutputLanguage,
        },
      });
    } catch (error) {
      if (
        generationRunIdRef.current !== versionId ||
        (error instanceof Error &&
          (error.name === "AbortError" || error.message === "Generation canceled."))
      ) {
        return;
      }

      setGenerationError(
        error instanceof Error
          ? error.message
          : copy.errors.imageRetry,
      );
      setPromptVersions((current) =>
        current.map((version) =>
          version.id === versionId
            ? {
                ...version,
                isRevealing: false,
                revealStatus: copy.statuses.failed,
                streamPreviewText: undefined,
              }
            : version,
        ),
      );
    } finally {
      if (generationRunIdRef.current === versionId) {
        generationAbortRef.current = null;
        generationRunIdRef.current = null;
        setGenerationMode(null);
      }
    }
  }

  async function handleGenerateScreenwriting() {
    if (
      !idea.trim() ||
      generationMode ||
      refiningId ||
      apiStatus !== "connected"
    ) {
      return;
    }

    setGenerationMode("screenwriting-generate");
    setGenerationError(null);
    const versionId = crypto.randomUUID();
    const controller = new AbortController();
    generationAbortRef.current = controller;
    generationRunIdRef.current = versionId;

    setPromptVersions([
      {
        id: versionId,
        promptText: "",
        isMock: false,
        promptKind: "screenwriting",
        knowledgeMatchCount: 0,
        compilerMethodCount: 0,
        isRevealing: true,
        revealStatus: copy.statuses.connectScriptGenerate,
      },
    ]);

    requestAnimationFrame(() => {
      document
        .getElementById("director-output")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    try {
      const response = await fetch("/api/screenwriting/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          storyIdea: idea,
          apiConfig,
          referenceAttachments,
          outputLanguage: promptOutputLanguage,
        }),
      });
      const data = (await response.json()) as {
        promptText?: string;
        generatedText?: string;
        message?: string;
        historyRecord?: HistoryRecord;
        knowledge?: {
          databaseVersion?: string;
          matchedEntryIds?: string[];
        };
        knowledgeHighlights?: KnowledgeHighlight[];
        knowledgeUsage?: KnowledgeUsageItem[];
      };
      const promptText = data.promptText ?? data.generatedText;

      if (!response.ok || !promptText) {
        throw new Error(data.message ?? copy.errors.scriptFailed);
      }

      if (generationRunIdRef.current !== versionId) return;

      setPromptVersions((current) =>
        current.map((version) =>
          version.id === versionId
            ? {
                ...version,
                promptText,
                promptKind: "screenwriting",
                isRevealing: false,
                revealStatus: copy.statuses.done,
                knowledgeMatchCount:
                  data.knowledge?.matchedEntryIds?.length ?? 0,
                compilerMethodCount: 0,
                compilerStrategy: "showcase_screenwriting_generation",
                knowledgeHighlights: data.knowledgeHighlights ?? [],
                knowledgeUsage: data.knowledgeUsage ?? [],
              }
            : version,
        ),
      );
      rememberHistoryRecord(data.historyRecord);
    } catch (error) {
      if (
        generationRunIdRef.current !== versionId ||
        (error instanceof Error && error.name === "AbortError")
      ) {
        return;
      }

      setGenerationError(
        error instanceof Error ? error.message : copy.errors.scriptRetry,
      );
      setPromptVersions((current) =>
        current.map((version) =>
          version.id === versionId
            ? {
                ...version,
                isRevealing: false,
                revealStatus: copy.statuses.failed,
                streamPreviewText: undefined,
              }
            : version,
        ),
      );
    } finally {
      if (generationRunIdRef.current === versionId) {
        generationAbortRef.current = null;
        generationRunIdRef.current = null;
        setGenerationMode(null);
      }
    }
  }

  async function handleOptimizeScreenwriting() {
    if (
      !idea.trim() ||
      generationMode ||
      refiningId ||
      apiStatus !== "connected"
    ) {
      return;
    }

    setGenerationMode("screenwriting-optimize");
    setGenerationError(null);
    const versionId = crypto.randomUUID();
    const controller = new AbortController();
    generationAbortRef.current = controller;
    generationRunIdRef.current = versionId;

    setPromptVersions([
      {
        id: versionId,
        promptText: "",
        isMock: false,
        promptKind: "screenwriting",
        knowledgeMatchCount: 0,
        compilerMethodCount: 0,
        isRevealing: true,
        revealStatus: copy.statuses.connectScriptOptimize,
      },
    ]);

    requestAnimationFrame(() => {
      document
        .getElementById("director-output")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    try {
      const response = await fetch("/api/screenwriting/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          scriptText: idea,
          apiConfig,
          referenceAttachments,
          outputLanguage: promptOutputLanguage,
        }),
      });
      const data = (await response.json()) as {
        promptText?: string;
        optimizedText?: string;
        message?: string;
        historyRecord?: HistoryRecord;
        knowledge?: {
          databaseVersion?: string;
          matchedEntryIds?: string[];
        };
        knowledgeHighlights?: KnowledgeHighlight[];
        knowledgeUsage?: KnowledgeUsageItem[];
      };
      const promptText = data.promptText ?? data.optimizedText;

      if (!response.ok || !promptText) {
        throw new Error(data.message ?? copy.errors.scriptOptimizeFailed);
      }

      if (generationRunIdRef.current !== versionId) return;

      setPromptVersions((current) =>
        current.map((version) =>
          version.id === versionId
            ? {
                ...version,
                promptText,
                promptKind: "screenwriting",
                isRevealing: false,
                revealStatus: copy.statuses.optimizingDone,
                knowledgeMatchCount:
                  data.knowledge?.matchedEntryIds?.length ?? 0,
                compilerMethodCount: 0,
                compilerStrategy: "showcase_screenwriting_revision",
                knowledgeHighlights: data.knowledgeHighlights ?? [],
                knowledgeUsage: data.knowledgeUsage ?? [],
              }
            : version,
        ),
      );
      rememberHistoryRecord(data.historyRecord);
    } catch (error) {
      if (
        generationRunIdRef.current !== versionId ||
        (error instanceof Error && error.name === "AbortError")
      ) {
        return;
      }

      setGenerationError(
        error instanceof Error ? error.message : copy.errors.scriptOptimizeRetry,
      );
      setPromptVersions((current) =>
        current.map((version) =>
          version.id === versionId
            ? {
                ...version,
                isRevealing: false,
                revealStatus: copy.statuses.optimizingFailed,
                streamPreviewText: undefined,
              }
            : version,
        ),
      );
    } finally {
      if (generationRunIdRef.current === versionId) {
        generationAbortRef.current = null;
        generationRunIdRef.current = null;
        setGenerationMode(null);
      }
    }
  }

  function handleConfirmPrompt(id: string, promptText: string) {
    setPromptVersions((current) =>
      current.map((version) =>
        version.id === id
          ? {
              ...version,
              promptText,
              durationSeconds:
                (version.promptKind ?? "video") === "video"
                  ? version.durationSeconds ?? durationSeconds
                  : undefined,
              promptKind: version.promptKind ?? "video",
              knowledgeHighlights: [],
              knowledgeUsage: [],
            }
          : version,
      ),
    );
  }

  async function handleRefinePrompt(version: PromptVersion) {
    const promptKind = version.promptKind ?? "video";
    const referencedAssets = getReferencedAssets(
      `${idea}\n${version.promptText}`,
      assets,
    );
    const referencedAssetIds = referencedAssets.map((asset) => asset.id);

    if (
      !version.promptText.trim() ||
      generationMode ||
      refiningId ||
      apiStatus !== "connected"
    ) {
      return;
    }

    setRefiningId(version.id);
    setRefinementError(null);

    try {
      const endpoint =
        promptKind === "screenwriting"
          ? "/api/screenwriting/optimize"
          : promptKind === "image"
            ? "/api/image-prompt/refine"
            : "/api/refine";
      const requestBody =
        promptKind === "screenwriting"
          ? {
              scriptText: version.promptText,
              apiConfig,
              referenceAttachments,
              outputLanguage: promptOutputLanguage,
            }
          : {
              userIdea: idea,
              currentPrompt: version.promptText,
              apiConfig,
              referenceAttachments,
              referencedAssetIds,
              referencedAssets,
              outputLanguage: promptOutputLanguage,
              durationSeconds:
                promptKind === "video"
                  ? version.durationSeconds ?? durationSeconds
                  : undefined,
            };
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const data = (await response.json()) as {
        promptText?: string;
        optimizedText?: string;
        message?: string;
        durationSeconds?: number;
        knowledge?: {
          databaseVersion?: string;
          matchedEntryIds?: string[];
        };
        promptCompiler?: {
          version?: string;
          strategy?: string;
          selectedMethodIds?: string[];
          selectedMethodTags?: string[];
        };
        knowledgeHighlights?: KnowledgeHighlight[];
        knowledgeUsage?: KnowledgeUsageItem[];
        historyRecord?: HistoryRecord;
      };
      const promptText = data.promptText ?? data.optimizedText;

      if (!response.ok || !promptText) {
        throw new Error(
          data.message ??
            (promptKind === "screenwriting"
              ? copy.errors.refineScript
              : promptKind === "image"
                ? copy.errors.refineImage
                : copy.errors.refineDirector),
        );
      }

      const nextVersion: PromptVersion = {
        id: crypto.randomUUID(),
        promptText,
        isMock: false,
        promptKind,
        knowledgeMatchCount: data.knowledge?.matchedEntryIds?.length ?? 0,
        compilerMethodCount:
          data.promptCompiler?.selectedMethodIds?.length ?? 0,
        compilerStrategy: data.promptCompiler?.strategy,
        durationSeconds:
          promptKind === "video"
            ? data.durationSeconds ?? version.durationSeconds
            : undefined,
        knowledgeHighlights: data.knowledgeHighlights ?? [],
        knowledgeUsage: data.knowledgeUsage ?? [],
      };
      setPromptVersions((current) => [...current, nextVersion]);
      rememberHistoryRecord(data.historyRecord);

      requestAnimationFrame(() => {
        document
          .getElementById(`prompt-version-${nextVersion.id}`)
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (error) {
      setRefinementError(
        error instanceof Error
          ? error.message
          : promptKind === "screenwriting"
            ? copy.errors.refineScriptRetry
            : promptKind === "image"
              ? copy.errors.refineImageRetry
              : copy.errors.refineDirectorRetry,
      );
    } finally {
      setRefiningId(null);
    }
  }

  function fallbackCopy(text: string) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "0";
    textarea.style.fontSize = "16px";
    document.body.appendChild(textarea);
    textarea.focus({ preventScroll: true });
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    let copied = false;

    try {
      copied = document.execCommand("copy");
    } catch {
      copied = false;
    }

    document.body.removeChild(textarea);
    return copied;
  }

  async function handleCopy(id: string, text: string) {
    setCopyErrorId(null);
    let copied = fallbackCopy(text);

    try {
      if (!copied && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        copied = true;
      }
    } catch {
      copied = false;
    }

    if (copied) {
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 1700);
    } else {
      setCopiedId(null);
      setCopyErrorId(id);
      window.setTimeout(() => setCopyErrorId(null), 2200);
    }
  }

  function handleUseHistoryRecord(record: HistoryRecord) {
    const targetWorkspace = getHistoryRecordTargetWorkspace(record);

    if (targetWorkspace !== workspaceMode) {
      window.sessionStorage.setItem(
        HISTORY_IMPORT_STORAGE_KEY,
        JSON.stringify({
          targetWorkspace,
          record,
        } satisfies PendingHistoryImport),
      );
      window.location.href =
        targetWorkspace === "screenwriting" ? "/screenwriting" : "/";
      return;
    }

    applyHistoryRecord(record);
  }

  async function handleDeleteHistoryRecord(id: string) {
    setHistoryRecords((current) => current.filter((record) => record.id !== id));

    try {
      const response = await fetch(`/api/history?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as {
        records?: HistoryRecord[];
        message?: string;
      };

      if (!response.ok) {
        throw new Error(data.message ?? "Unable to delete the history record.");
      }

      if (Array.isArray(data.records)) {
        setHistoryRecords(data.records);
      }
    } catch {
      void loadHistoryRecords();
    }
  }

  async function handleClearHistoryRecords() {
    setHistoryRecords([]);

    try {
      const response = await fetch("/api/history?all=1", {
        method: "DELETE",
      });
      const data = (await response.json()) as {
        records?: HistoryRecord[];
        message?: string;
      };

      if (!response.ok) {
        throw new Error(data.message ?? "Unable to clear history.");
      }

      if (Array.isArray(data.records)) {
        setHistoryRecords(data.records);
      }
    } catch {
      void loadHistoryRecords();
    }
  }

  return (
    <main className="studio-shell">
      <div className="content-layer">
        <header className="mx-auto grid w-full max-w-[1440px] grid-cols-[auto_1fr] items-center gap-3 px-4 py-5 sm:grid-cols-[1fr_auto_1fr] sm:px-8 sm:py-7">
          <Link
            href="/"
            className="min-w-0 flex items-center gap-3 text-[#1A2C26]"
            aria-label={copy.backToTop}
          >
            <LogoMark />
            <div>
              <p className="text-[11px] font-bold tracking-[0.2em]">
                {isScreenwritingWorkspace
                  ? "AI DIRECTOR WORKSTATION · WRITER"
                  : "AI DIRECTOR WORKSTATION"}
              </p>
              <p className="mt-0.5 text-[9px] tracking-[0.14em] text-[#2B4A3F]/48">
                {isScreenwritingWorkspace
                  ? "SCRIPT CREATION WORKSTATION"
                  : "FILM CREATION WORKSTATION"}
              </p>
            </div>
          </Link>

          <div className="order-3 col-span-2 flex min-w-0 flex-wrap items-center justify-center gap-3 justify-self-center sm:order-none sm:col-span-1">
            <Link
              href="/"
              onClick={() => setHistoryOpen(false)}
              className={`flex h-10 min-w-[112px] items-center justify-center rounded-full px-4 text-sm font-bold tracking-[0.08em] transition-all duration-300 sm:h-11 sm:min-w-[118px] sm:px-5 ${
                !isScreenwritingWorkspace && !historyOpen
                  ? "border border-[#1A2C26]/14 bg-[#1A2C26] text-[#F4E8D4] shadow-[0_14px_30px_rgba(26,44,38,0.16)]"
                  : "border border-[#1A2C26]/16 bg-white/28 text-[#2B4A3F]/70 hover:border-[#C68A4A]/38 hover:bg-white/42 hover:text-[#1A2C26]"
              }`}
            >
              {copy.directorBoard}
            </Link>
            <Link
              href="/screenwriting"
              onClick={() => setHistoryOpen(false)}
              className={`flex h-10 min-w-[112px] items-center justify-center rounded-full px-4 text-sm font-bold tracking-[0.08em] transition-all duration-300 sm:h-11 sm:min-w-[118px] sm:px-5 ${
                isScreenwritingWorkspace && !historyOpen
                  ? "border border-[#1A2C26]/14 bg-[#1A2C26] text-[#F4E8D4] shadow-[0_14px_30px_rgba(26,44,38,0.16)]"
                  : "border border-[#1A2C26]/16 bg-white/28 text-[#2B4A3F]/70 hover:border-[#C68A4A]/38 hover:bg-white/42 hover:text-[#1A2C26]"
              }`}
            >
              {copy.screenwritingBoard}
            </Link>
          </div>

          <div className="flex items-center gap-2 justify-self-end">
            <div
              className="flex h-10 items-center rounded-full border border-[#1A2C26]/10 bg-white/18 p-1 sm:h-11"
              aria-label={copy.languageLabel}
            >
              {(["zh", "en"] as const).map((languageOption) => (
                <button
                  key={languageOption}
                  type="button"
                  onClick={() => applyOutputLanguage(languageOption)}
                  aria-pressed={outputLanguage === languageOption}
                  className={`flex h-8 min-w-9 items-center justify-center rounded-full px-2.5 text-[10px] font-bold tracking-[0.08em] transition-all duration-300 sm:h-9 sm:min-w-10 ${
                    outputLanguage === languageOption
                      ? "bg-[#1A2C26] text-[#F4E8D4] shadow-[0_8px_18px_rgba(26,44,38,0.14)]"
                      : "text-[#2B4A3F]/58 hover:bg-white/34 hover:text-[#1A2C26]"
                  }`}
                >
                  {languageOption === "zh" ? "中" : "EN"}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                setHistoryOpen(true);
                void loadHistoryRecords();
              }}
              className={`flex h-10 max-w-[70px] min-w-0 items-center justify-center overflow-hidden whitespace-nowrap rounded-full px-3 text-xs font-bold tracking-[0.08em] transition-all duration-300 sm:h-11 sm:max-w-none sm:min-w-[104px] sm:px-5 sm:text-sm ${
                historyOpen
                  ? "border border-[#1A2C26]/14 bg-[#1A2C26] text-[#F4E8D4]"
                  : "border border-[#1A2C26]/10 bg-white/18 text-[#2B4A3F]/58 hover:border-[#C68A4A]/35 hover:text-[#2B4A3F]/78"
              }`}
            >
              {copy.history}
            </button>
          </div>
        </header>

        <div className="connection-dock">
          <div className="connection-stack api-connection-stack">
            <ApiPanel
              open={apiOpen}
              config={apiConfig}
              status={apiStatus}
              source={apiSource}
              error={apiError}
              hasSavedConfig={Boolean(savedApiConfig)}
              saveFeedback={saveFeedback}
              onToggle={() => setApiOpen((open) => !open)}
              onChange={handleApiChange}
              onFillSaved={handleFillSavedApi}
              onSave={handleSaveApi}
              onTest={handleTestConnection}
              demoMode={DEMO_MODE}
              language={outputLanguage}
            />
          </div>
        </div>

        {historyOpen ? (
          <HistoryPanel
            records={historyRecords}
            loading={historyLoading}
            copiedId={copiedId}
            copyErrorId={copyErrorId}
            onBack={() => setHistoryOpen(false)}
            boardLabel={
              isScreenwritingWorkspace
                ? copy.screenwritingBoard
                : copy.directorBoard
            }
            language={outputLanguage}
            onRefresh={loadHistoryRecords}
            onUseRecord={handleUseHistoryRecord}
            onDeleteRecord={handleDeleteHistoryRecord}
            onClearRecords={handleClearHistoryRecords}
            onCopy={handleCopy}
          />
        ) : (
          <>
            <section
              id="top"
              className="mx-auto w-full max-w-[1040px] min-w-0 px-4 pt-12 text-center sm:px-8 sm:pt-20 lg:pt-24"
            >
              <div className="mb-7 inline-flex items-center gap-3 rounded-full border border-[#1A2C26]/10 bg-white/20 px-4 py-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[#C68A4A]" />
                <span className="text-[10px] font-semibold tracking-[0.19em] text-[#2B4A3F]/65">
                  {isScreenwritingWorkspace
                    ? "AI DIRECTOR WORKSTATION · WRITER"
                    : "AI DIRECTOR WORKSTATION · DIRECTOR"}
                </span>
              </div>

              <HeroTitle>
                {isScreenwritingWorkspace
                  ? copy.heroScreenwritingTitle
                  : copy.heroDirectorTitle}
              </HeroTitle>

              <div className="amber-line mx-auto mt-8 h-px w-28" />

              <p className="mx-auto mt-7 max-w-[330px] break-words text-base leading-7 font-medium text-[#2B4A3F]/68 sm:max-w-2xl sm:text-lg sm:leading-8">
                {copy.heroDirectorLead}
                {outputLanguage === "en" ? " " : null}
                <span className="mx-1 text-[#9A632D]">
                  {copy.heroCinemaWord}
                </span>
                {outputLanguage === "en" ? " " : null}
                {isScreenwritingWorkspace
                  ? copy.heroScreenwritingProduct
                  : copy.heroDirectorProduct}
              </p>
              <p className="mx-auto mt-3 max-w-[340px] break-words text-xs leading-6 tracking-[0.03em] text-[#2B4A3F]/44 sm:max-w-xl">
                {isScreenwritingWorkspace
                  ? copy.heroScreenwritingSub
                  : copy.heroDirectorSub}
              </p>
            </section>

            <PromptInput
              value={idea}
              durationSeconds={durationSeconds}
              isBusy={Boolean(generationMode) || Boolean(refiningId)}
              generationMode={generationMode}
              canGenerate={apiStatus === "connected"}
              demoMode={DEMO_MODE}
              error={generationError}
              assets={assets}
              referenceAttachments={referenceAttachments}
              workspaceMode={workspaceMode}
              language={outputLanguage}
              promptOutputLanguage={promptOutputLanguage}
              onPromptOutputLanguageChange={applyPromptOutputLanguage}
              onChange={setIdea}
              onDurationChange={setDurationSeconds}
              onGenerate={handleGenerate}
              onGenerateImage={handleGenerateImage}
              onGenerateScreenwriting={handleGenerateScreenwriting}
              onOptimizeScreenwriting={handleOptimizeScreenwriting}
              onCancelGeneration={handleCancelGeneration}
              onReferenceAttachmentsChange={setReferenceAttachments}
              onDeleteAsset={handleDeleteAsset}
              onClearAssets={handleClearAssets}
              onUpdateAsset={handleUpdateAsset}
              referenceUploadsEnabled={REFERENCE_UPLOADS_ENABLED}
            />

            <OutputPanel
              versions={promptVersions}
              copiedId={copiedId}
              copyErrorId={copyErrorId}
              refiningId={refiningId}
              refinementError={refinementError}
              canRefine={apiStatus === "connected"}
              assetSaveFeedback={assetSaveFeedback}
              assetSaveError={assetSaveError}
              onConfirm={handleConfirmPrompt}
              onRefine={handleRefinePrompt}
              onCopy={handleCopy}
              onSaveAsset={handleSaveAsset}
              language={outputLanguage}
            />
          </>
        )}

        <footer className="border-t border-[#1A2C26]/9 px-5 py-7 sm:px-8">
          <div className="mx-auto flex max-w-[1380px] flex-col gap-3 text-[9px] tracking-[0.14em] text-[#2B4A3F]/42 sm:flex-row sm:items-center sm:justify-between">
            <p>AI DIRECTOR WORKSTATION © 2026 · CREATE THE SCENE</p>
            <p>FILM PROMPT CREATION · V1</p>
          </div>
        </footer>
      </div>
    </main>
  );
}
