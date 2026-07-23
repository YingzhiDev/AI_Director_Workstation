export type PromptField = {
  label: string;
  value: string;
};

export type PromptSection = {
  id: string;
  index: string;
  title: string;
  englishTitle: string;
  description: string;
  fields: PromptField[];
};

export type ApiStatus = "idle" | "testing" | "connected" | "failed";

export type CliStatus = "idle" | "testing" | "connected" | "failed";

export type ApiConfig = {
  modelName: string;
  apiKey: string;
  requestUrl: string;
};

export type CliConfig = {
  commandPath: string;
  configDir: string;
};

export type ApiConnectionSource = "built-in" | "custom";

export type CliConnectionSource = "built-in" | "custom";

export type OutputLanguage = "zh" | "en";

export type KnowledgeSourceFamily =
  | "showcase-craft"
  | "showcase-continuity"
  | "showcase-story"
  | "asset-locks"
  | "formal";

export type PromptKind = "video" | "image" | "screenwriting";

export type ReferenceAttachmentKind =
  | "text"
  | "code"
  | "image"
  | "video"
  | "document"
  | "other";

export type ReferenceAttachment = {
  id: string;
  name: string;
  kind: ReferenceAttachmentKind;
  mimeType: string;
  size: number;
  textPreview?: string;
  storageProvider?: "local" | "supabase";
  storagePath?: string;
  storageBucket?: string;
};

export type AssetKind = "character" | "prop" | "scene";

export type AssetRecord = {
  id: string;
  name: string;
  promptText: string;
  createdAt: string;
  updatedAt: string;
  sourcePromptKind?: PromptKind;
  assetKind?: AssetKind;
};

export type PromptVersion = {
  id: string;
  promptText: string;
  isMock: boolean;
  promptKind?: PromptKind;
  knowledgeMatchCount: number;
  compilerMethodCount?: number;
  compilerStrategy?: string;
  knowledgeHighlights?: KnowledgeHighlight[];
  knowledgeUsage?: KnowledgeUsageItem[];
  isRevealing?: boolean;
  revealStatus?: string;
  streamPreviewText?: string;
  durationSeconds?: number;
};

export type KnowledgeHighlight = {
  start: number;
  end: number;
  label: string;
  source: "knowledge" | "compiler";
  matchedSources: string[];
  sourceFamily: KnowledgeSourceFamily;
};

export type KnowledgeUsageItem = {
  id: string;
  title: string;
  sourceLabel: string;
  sourceFamily: KnowledgeSourceFamily;
  role: "prompt-compiler" | "knowledge-retrieval";
  reason: string;
};

export type HistoryRecord = {
  id: string;
  createdAt: string;
  action:
    | "generate"
    | "refine"
    | "image-generate"
    | "image-refine"
    | "screenwriting-generate"
    | "screenwriting-optimize";
  promptKind?: PromptKind;
  userIdea: string;
  durationSeconds?: number;
  promptText: string;
  knowledgeMatchCount: number;
  compilerMethodCount: number;
  compilerStrategy?: string;
  knowledgeHighlights: KnowledgeHighlight[];
  knowledgeUsage: KnowledgeUsageItem[];
};
