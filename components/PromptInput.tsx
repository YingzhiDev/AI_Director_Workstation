import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent as ReactDragEvent,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import {
  getReferenceAcceptForWorkspace,
  getReferenceFormatLabel,
  isAllowedReferenceDocument,
  isAllowedReferenceImage,
  isReferenceFileAllowedForWorkspace,
  maxReferenceDocumentSizeBytes,
  maxReferenceImageSizeBytes,
} from "@/lib/referenceFilePolicy";
import type {
  AssetKind,
  AssetRecord,
  OutputLanguage,
  ReferenceAttachment,
} from "@/types";

type PromptInputProps = {
  value: string;
  durationSeconds: number;
  isBusy: boolean;
  generationMode:
    | "video"
    | "image"
    | "screenwriting-generate"
    | "screenwriting-optimize"
    | null;
  canGenerate: boolean;
  demoMode?: boolean;
  error: string | null;
  assets: AssetRecord[];
  referenceAttachments: ReferenceAttachment[];
  workspaceMode?: "director" | "screenwriting";
  language: OutputLanguage;
  promptOutputLanguage: OutputLanguage;
  onChange: (value: string) => void;
  onPromptOutputLanguageChange: (language: OutputLanguage) => void;
  onDurationChange: (value: number) => void;
  onGenerate: () => void;
  onGenerateImage: () => void;
  onGenerateScreenwriting: () => void;
  onOptimizeScreenwriting: () => void;
  onCancelGeneration: () => void;
  onReferenceAttachmentsChange: (attachments: ReferenceAttachment[]) => void;
  onDeleteAsset: (id: string) => void;
  onClearAssets: () => void;
  onUpdateAsset: (
    asset: AssetRecord,
    promptText: string,
  ) => Promise<AssetRecord | null>;
  referenceUploadsEnabled?: boolean;
};

async function writeTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through for browsers that block the async Clipboard API.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();

  const copied = document.execCommand("copy");
  textarea.remove();
  return copied;
}

function ImageIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      className="h-4 w-4"
    >
      <rect x="3" y="4" width="14" height="12" rx="2.2" />
      <path d="m5.8 13 3.1-3.1 2.2 2.2 1.4-1.4 2.7 2.3" />
      <circle cx="13.2" cy="7.8" r="1.1" />
    </svg>
  );
}

function ClapperboardIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.55"
      className="h-4 w-4"
    >
      <rect x="3.5" y="6.5" width="13" height="10" rx="2" />
      <path d="M4.3 6.8 6.8 3.5h3l-2.5 3.3M9.7 6.8l2.5-3.3h3l-2.5 3.3M3.8 10h12.4" />
    </svg>
  );
}

function ScriptIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.55"
      className="h-4 w-4"
    >
      <path d="M5.2 3.5h7.1l2.5 2.5v10.5H5.2z" />
      <path d="M12.2 3.8v2.5h2.5M7.4 8.3h5.2M7.4 11h5.2M7.4 13.7h3.6" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.55"
      className="h-4 w-4"
    >
      <path d="M10 13.5V4.8M6.8 8 10 4.8 13.2 8" />
      <path d="M4.3 12.4v2.8c0 .9.7 1.6 1.6 1.6h8.2c.9 0 1.6-.7 1.6-1.6v-2.8" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      className="h-3.5 w-3.5"
    >
      <path d="M4.6 6h10.8M8 6V4.4h4V6M6.2 6.2l.6 9.2c.1.8.7 1.3 1.5 1.3h3.4c.8 0 1.4-.5 1.5-1.3l.6-9.2M8.7 8.8v5M11.3 8.8v5" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      className="h-4 w-4"
    >
      <rect x="6" y="6" width="8" height="8" rx="1.6" />
    </svg>
  );
}

function RailArrowIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-4 w-4"
    >
      {direction === "left" ? (
        <path d="M12.5 5 7.5 10l5 5" />
      ) : (
        <path d="m7.5 5 5 5-5 5" />
      )}
    </svg>
  );
}

function inferAssetKind(asset: AssetRecord): AssetKind {
  if (asset.assetKind) return asset.assetKind;

  const text = `${asset.name} ${asset.promptText}`;

  if (/主角|配角|人物|角色|人形|机器人|男孩|女孩|男人|女人|老人|少年|少女|character|hero|person|robot|man|woman|boy|girl/u.test(text)) {
    return "character";
  }

  if (/场景|空间|房间|城市|街|巷|公寓|学校|医院|天台|室内|室外|地点|环境|世界|scene|location|space|room|city|street|apartment|school|hospital|rooftop|interior|exterior|world/u.test(text)) {
    return "scene";
  }

  if (/道具|物件|武器|手机|相机|车|伞|门|钥匙|箱|项链|眼镜|书|装置|机器|prop|object|weapon|phone|camera|car|umbrella|door|key|box|necklace|glasses|book|device|machine/u.test(text)) {
    return "prop";
  }

  return "character";
}

function getAssetKindLabel(assetKind: AssetKind, language: OutputLanguage) {
  if (language === "en") {
    if (assetKind === "prop") return "Prop";
    if (assetKind === "scene") return "Scene";
    return "Character";
  }

  if (assetKind === "prop") return "道具";
  if (assetKind === "scene") return "场景";
  return "人物";
}

function AssetKindIcon({ assetKind }: { assetKind: AssetKind }) {
  if (assetKind === "scene") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        className="h-4 w-4"
      >
        <rect x="3.5" y="5" width="13" height="10.5" rx="2" />
        <path d="m5.5 13 3-3 2.1 2.1 1.3-1.3 2.6 2.2M12.7 7.7h.1" />
      </svg>
    );
  }

  if (assetKind === "prop") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        className="h-4 w-4"
      >
        <path d="m10 3.8 5.4 3.1v6.2L10 16.2l-5.4-3.1V6.9L10 3.8Z" />
        <path d="M4.9 7 10 10l5.1-3M10 10v5.8" />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      className="h-4 w-4"
    >
      <circle cx="10" cy="7.1" r="2.6" />
      <path d="M4.8 16.1c.8-3 2.5-4.5 5.2-4.5s4.4 1.5 5.2 4.5" />
    </svg>
  );
}

function getAssetPreviewText(asset: AssetRecord) {
  return asset.promptText.replace(/\s+/gu, " ").trim();
}

type AssetMentionRange = {
  start: number;
  end: number;
  query: string;
};

type AssetMentionPosition = {
  top: number;
  left: number;
  placement: "above" | "below";
};

const MAX_ASSET_MENTION_OPTIONS = 6;
const ASSET_MENTION_MENU_WIDTH = 360;

function getAssetMentionRange(
  text: string,
  cursorPosition: number,
): AssetMentionRange | null {
  const beforeCursor = text.slice(0, cursorPosition);
  const atIndex = beforeCursor.lastIndexOf("@");

  if (atIndex < 0) return null;

  const query = beforeCursor.slice(atIndex + 1);

  if (/[\s@]/u.test(query)) return null;

  return {
    start: atIndex,
    end: cursorPosition,
    query,
  };
}

function getAssetMentionOptions(assets: AssetRecord[], query: string) {
  const normalizedQuery = query.trim().toLocaleLowerCase();

  return assets
    .filter((asset) => {
      if (!normalizedQuery) return true;

      return (
        asset.name.toLocaleLowerCase().includes(normalizedQuery) ||
        asset.promptText.toLocaleLowerCase().includes(normalizedQuery)
      );
    })
    .slice(0, MAX_ASSET_MENTION_OPTIONS);
}

function getTextareaCaretPosition(
  textarea: HTMLTextAreaElement,
  text: string,
  cursorPosition: number,
): AssetMentionPosition {
  const computedStyle = window.getComputedStyle(textarea);
  const mirror = document.createElement("div");
  const marker = document.createElement("span");

  mirror.style.position = "absolute";
  mirror.style.visibility = "hidden";
  mirror.style.pointerEvents = "none";
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.overflowWrap = "anywhere";
  mirror.style.wordBreak = "break-all";
  mirror.style.boxSizing = computedStyle.boxSizing;
  mirror.style.width = `${textarea.clientWidth}px`;
  mirror.style.font = computedStyle.font;
  mirror.style.lineHeight = computedStyle.lineHeight;
  mirror.style.letterSpacing = computedStyle.letterSpacing;
  mirror.style.padding = computedStyle.padding;
  mirror.style.border = computedStyle.border;
  mirror.style.left = "-9999px";
  mirror.style.top = "0";

  mirror.appendChild(
    document.createTextNode(text.slice(0, cursorPosition) || "\u200b"),
  );
  marker.textContent = "\u200b";
  mirror.appendChild(marker);
  document.body.appendChild(mirror);

  const textareaRect = textarea.getBoundingClientRect();
  const mirrorRect = mirror.getBoundingClientRect();
  const markerRect = marker.getBoundingClientRect();
  const markerTop = markerRect.top - mirrorRect.top - textarea.scrollTop;
  const markerLeft = markerRect.left - mirrorRect.left - textarea.scrollLeft;
  const lineHeight = Number.parseFloat(computedStyle.lineHeight) || 28;
  const viewportTop = textareaRect.top + markerTop;
  const viewportLeft = textareaRect.left + markerLeft;
  const placement = viewportTop > 150 ? "above" : "below";
  const top =
    placement === "above" ? viewportTop - 10 : viewportTop + lineHeight + 10;
  const left = Math.min(
    Math.max(viewportLeft + 12, 8),
    Math.max(8, window.innerWidth - ASSET_MENTION_MENU_WIDTH - 8),
  );

  document.body.removeChild(mirror);

  return { top, left, placement };
}

function getAttachmentKindLabel(
  kind: ReferenceAttachment["kind"],
  language: OutputLanguage,
) {
  if (language === "en") {
    if (kind === "image") return "Image";
    if (kind === "video") return "Video";
    if (kind === "code") return "Code";
    if (kind === "document") return "Document";
    if (kind === "text") return "Text";
    return "File";
  }

  if (kind === "image") return "图片";
  if (kind === "video") return "视频";
  if (kind === "code") return "代码";
  if (kind === "document") return "文档";
  if (kind === "text") return "文本";
  return "文件";
}

const promptInputCopy = {
  zh: {
    briefMode: "结构化提案",
    promptOutputLanguageLabel: "提示词输出语言",
    setPromptOutputZh: "设定输出内容为中文",
    setPromptOutputEn: "设定输出内容为英文",
    screenwritingPlaceholder:
      "输入故事创意、人物关系、场景片段，或粘贴需要优化的剧本文本……",
    directorPlaceholder: "描述你脑海中的画面、角色、动作或情绪……",
    screenwritingAria: "剧本创意或剧本文本",
    directorAria: "视频创意描述",
    uploadAria: "上传参考文件",
    uploadSaving: "保存中...",
    uploadReference: "上传参考",
    uploadPaused: "上传参考已暂停",
    referenceHint: "支持图片与文本文档作为参考，禁止上传视频",
    referencePausedHint: "公开 Demo 暂不接收文件",
    clearReference: "清空参考",
    maxReferenceError: "最多同时引用 8 个参考文件。",
    uploadFailed: "参考文件上传失败",
    uploadRetry: "参考文件上传失败，请稍后重试",
    removePrefix: "移除",
    scriptMode: "剧本结构模式",
    duration: "时长",
    durationAria: "选择视频所需时长",
    generateScript: "生成剧本",
    generatingScript: "正在生成剧本",
    optimizeScript: "优化剧本",
    optimizingScript: "正在优化剧本",
    imagePrompt: "图片提示词",
    generatingImage: "正在生成图片",
    videoPrompt: "视频提示词",
    directing: "正在导演化",
    cancelGeneration: "取消生成",
    readyDemoScript: "AI 已连接，可生成、优化剧本；本产品不会生成视频",
    readyDemoDirector: "AI 已连接，可生成提示词；本产品不会生成视频",
    readyApiScript: "API 已连接，可生成、优化剧本；本产品不会生成视频",
    readyApiDirector: "API 已连接，可生成提示词；本产品不会生成视频",
    connecting: "正在连接后台 AI 模型",
    connectApi: "请先在右上角完成 API 连接测试",
    savedAssets: "存储资产",
    clickToInsert: "点击查看资产内容",
    assetMentionTitle: "引用资产",
    clearAll: "全部清空",
    assetFallback: "资产设定",
    assetDetailTitle: "资产内容",
    assetDetailHint: "文本可复制，也可修改后保存到资产库。",
    assetDetailAria: "资产设定内容",
    copyAsset: "复制",
    copiedAsset: "已复制",
    insertReference: "插入引用",
    saveAssetEdits: "保存修改",
    savingAsset: "保存中...",
    closeAssetDetail: "关闭",
    assetSaveFailed: "资产修改保存失败",
    noAssets: "暂无存储资产",
    viewAssetsLeft: "向左查看资产",
    viewAssetsRight: "向右查看资产",
    deletePrefix: "删除",
  },
  en: {
    briefMode: "Structured treatment",
    promptOutputLanguageLabel: "Prompt output language",
    setPromptOutputZh: "Set output content to Chinese",
    setPromptOutputEn: "Set output content to English",
    screenwritingPlaceholder:
      "Enter a story idea, character relationship, scene fragment, or paste a script you want to improve...",
    directorPlaceholder:
      "Describe the image in your head: subject, character, action, mood, or visual style...",
    screenwritingAria: "Story idea or script text",
    directorAria: "Video idea description",
    uploadAria: "Upload reference files",
    uploadSaving: "Saving...",
    uploadReference: "Add reference",
    uploadPaused: "References paused",
    referenceHint:
      "Images and text documents can be used as references. Video uploads are blocked.",
    referencePausedHint: "Public demo does not accept files yet",
    clearReference: "Clear references",
    maxReferenceError: "You can reference up to 8 files at once.",
    uploadFailed: "Reference upload failed",
    uploadRetry: "Reference upload failed. Please try again later.",
    removePrefix: "Remove",
    scriptMode: "Script structure mode",
    duration: "Duration",
    durationAria: "Select target video duration",
    generateScript: "Generate script",
    generatingScript: "Writing script",
    optimizeScript: "Optimize script",
    optimizingScript: "Optimizing script",
    imagePrompt: "Image prompt",
    generatingImage: "Writing image prompt",
    videoPrompt: "Video prompt",
    directing: "Directing",
    cancelGeneration: "Cancel",
    readyDemoScript:
      "AI is connected. Generate or improve scripts; this product does not render video.",
    readyDemoDirector:
      "AI is connected. Generate prompts; this product does not render video.",
    readyApiScript:
      "API is connected. Generate or improve scripts; this product does not render video.",
    readyApiDirector:
      "API is connected. Generate prompts; this product does not render video.",
    connecting: "Connecting to the hosted AI model",
    connectApi: "Connect an API in the top-right panel first",
    savedAssets: "Saved assets",
    clickToInsert: "Click to view asset",
    assetMentionTitle: "Reference asset",
    clearAll: "Clear all",
    assetFallback: "Asset lock",
    assetDetailTitle: "Asset content",
    assetDetailHint: "Copy the text, or edit it and save back to assets.",
    assetDetailAria: "Asset lock content",
    copyAsset: "Copy",
    copiedAsset: "Copied",
    insertReference: "Insert reference",
    saveAssetEdits: "Save edits",
    savingAsset: "Saving...",
    closeAssetDetail: "Close",
    assetSaveFailed: "Failed to save asset edits",
    noAssets: "No saved assets",
    viewAssetsLeft: "View assets to the left",
    viewAssetsRight: "View assets to the right",
    deletePrefix: "Delete",
  },
} as const;

export function PromptInput({
  value,
  durationSeconds,
  isBusy,
  generationMode,
  canGenerate,
  demoMode = false,
  error,
  assets,
  referenceAttachments,
  workspaceMode = "director",
  language,
  promptOutputLanguage,
  onChange,
  onPromptOutputLanguageChange,
  onDurationChange,
  onGenerate,
  onGenerateImage,
  onGenerateScreenwriting,
  onOptimizeScreenwriting,
  onCancelGeneration,
  onReferenceAttachmentsChange,
  onDeleteAsset,
  onClearAssets,
  onUpdateAsset,
  referenceUploadsEnabled = true,
}: PromptInputProps) {
  const disabled = !value.trim() || isBusy || !canGenerate;
  const isScreenwritingWorkspace = workspaceMode === "screenwriting";
  const copy = promptInputCopy[language];
  const referenceAccept = getReferenceAcceptForWorkspace(workspaceMode);
  const referenceFormatHint = getReferenceFormatLabel(workspaceMode, language);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const assetRailRef = useRef<HTMLDivElement>(null);
  const suppressAssetMentionSelectionRef = useRef(false);
  const [assetRailCanScroll, setAssetRailCanScroll] = useState(false);
  const [assetRailAtStart, setAssetRailAtStart] = useState(true);
  const [assetRailAtEnd, setAssetRailAtEnd] = useState(true);
  const [referenceUploading, setReferenceUploading] = useState(false);
  const [referenceUploadError, setReferenceUploadError] = useState<string | null>(
    null,
  );
  const [assetMentionRange, setAssetMentionRange] =
    useState<AssetMentionRange | null>(null);
  const [assetMentionPosition, setAssetMentionPosition] =
    useState<AssetMentionPosition | null>(null);
  const [assetMentionIndex, setAssetMentionIndex] = useState(0);
  const [openAssetId, setOpenAssetId] = useState<string | null>(null);
  const [assetDetailDraft, setAssetDetailDraft] = useState("");
  const [assetDetailSaving, setAssetDetailSaving] = useState(false);
  const [assetDetailCopied, setAssetDetailCopied] = useState(false);
  const [assetDetailError, setAssetDetailError] = useState<string | null>(null);
  const assetMentionOptions = assetMentionRange
    ? getAssetMentionOptions(assets, assetMentionRange.query)
    : [];
  const assetMentionOpen =
    Boolean(assetMentionRange) && assetMentionOptions.length > 0 && !isBusy;
  const selectedAssetMentionIndex =
    assetMentionOptions.length > 0
      ? Math.min(assetMentionIndex, assetMentionOptions.length - 1)
      : 0;
  const openAsset = assets.find((asset) => asset.id === openAssetId) ?? null;

  function updateAssetRailState() {
    const rail = assetRailRef.current;
    if (!rail) {
      setAssetRailCanScroll(false);
      setAssetRailAtStart(true);
      setAssetRailAtEnd(true);
      return;
    }

    const maxScrollLeft = rail.scrollWidth - rail.clientWidth;
    setAssetRailCanScroll(maxScrollLeft > 4);
    setAssetRailAtStart(rail.scrollLeft <= 4);
    setAssetRailAtEnd(rail.scrollLeft >= maxScrollLeft - 4);
  }

  useEffect(() => {
    updateAssetRailState();
  }, [assets.length]);

  useEffect(() => {
    window.addEventListener("resize", updateAssetRailState);

    return () => window.removeEventListener("resize", updateAssetRailState);
  }, []);

  useEffect(() => {
    function preventDocumentFileDrop(event: DragEvent) {
      if (Array.from(event.dataTransfer?.types ?? []).includes("Files")) {
        event.preventDefault();
      }
    }

    document.addEventListener("dragover", preventDocumentFileDrop);
    document.addEventListener("drop", preventDocumentFileDrop);

    return () => {
      document.removeEventListener("dragover", preventDocumentFileDrop);
      document.removeEventListener("drop", preventDocumentFileDrop);
    };
  }, []);

  function insertAssetReference(assetName: string) {
    const reference = `@${assetName}`;
    const textarea = textareaRef.current;

    if (!textarea) {
      onChange(`${value}${value.endsWith(" ") || !value ? "" : " "}${reference}`);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = value.slice(0, start);
    const after = value.slice(end);
    const prefix = before && !/\s$/u.test(before) ? " " : "";
    const suffix = after && !/^\s/u.test(after) ? " " : "";
    const nextValue = `${before}${prefix}${reference}${suffix}${after}`;
    const nextCursor = before.length + prefix.length + reference.length;

    onChange(nextValue);
    setAssetMentionRange(null);
    setAssetMentionPosition(null);
    setAssetMentionIndex(0);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(nextCursor, nextCursor);
    });
  }

  function toggleAssetDetail(asset: AssetRecord) {
    setAssetMentionRange(null);
    setAssetMentionPosition(null);
    setAssetMentionIndex(0);
    setAssetDetailCopied(false);
    setAssetDetailError(null);

    if (openAssetId === asset.id) {
      setOpenAssetId(null);
      return;
    }

    setAssetDetailDraft(asset.promptText);
    setOpenAssetId(asset.id);
  }

  async function copyAssetDetailText() {
    if (!assetDetailDraft.trim()) return;

    try {
      const copied = await writeTextToClipboard(assetDetailDraft);
      if (!copied) throw new Error("copy failed");
      setAssetDetailCopied(true);
      window.setTimeout(() => setAssetDetailCopied(false), 1500);
    } catch {
      setAssetDetailCopied(false);
    }
  }

  async function saveAssetDetailText() {
    if (!openAsset || !assetDetailDraft.trim()) return;

    setAssetDetailSaving(true);
    setAssetDetailError(null);

    try {
      const savedAsset = await onUpdateAsset(openAsset, assetDetailDraft);
      if (savedAsset) {
        setOpenAssetId(savedAsset.id);
        setAssetDetailDraft(savedAsset.promptText);
      }
    } catch (error) {
      setAssetDetailError(
        error instanceof Error ? error.message : copy.assetSaveFailed,
      );
    } finally {
      setAssetDetailSaving(false);
    }
  }

  function updateAssetMention(text: string, cursorPosition: number) {
    const nextRange = getAssetMentionRange(text, cursorPosition);
    const textarea = textareaRef.current;

    if (!nextRange) {
      setAssetMentionRange(null);
      setAssetMentionPosition(null);
      setAssetMentionIndex(0);
      return;
    }

    setAssetMentionRange(nextRange);
    setAssetMentionPosition(
      textarea
        ? getTextareaCaretPosition(textarea, text, nextRange.start + 1)
        : null,
    );
    setAssetMentionIndex(0);
  }

  function handleTextChange(event: ChangeEvent<HTMLTextAreaElement>) {
    const nextValue = event.target.value;

    onChange(nextValue);
    updateAssetMention(nextValue, event.target.selectionStart);
  }

  function handleTextSelection() {
    if (suppressAssetMentionSelectionRef.current) {
      suppressAssetMentionSelectionRef.current = false;
      return;
    }

    const textarea = textareaRef.current;
    if (!textarea) return;

    updateAssetMention(textarea.value, textarea.selectionStart);
  }

  function insertMentionAssetReference(asset: AssetRecord) {
    const textarea = textareaRef.current;
    const range =
      assetMentionRange ??
      (textarea ? getAssetMentionRange(value, textarea.selectionStart) : null);

    if (!range) {
      insertAssetReference(asset.name);
      return;
    }

    const reference = `@${asset.name}`;
    const before = value.slice(0, range.start);
    const after = value.slice(range.end);
    const suffix =
      !after || !/^[\s,.;:!?，。；、！？）)\]}]/u.test(after) ? " " : "";
    const nextValue = `${before}${reference}${suffix}${after}`;
    const nextCursor = before.length + reference.length + suffix.length;

    onChange(nextValue);
    setAssetMentionRange(null);
    setAssetMentionPosition(null);
    setAssetMentionIndex(0);
    suppressAssetMentionSelectionRef.current = true;

    requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(nextCursor, nextCursor);
    });
  }

  function handleTextKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (!assetMentionOpen) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      suppressAssetMentionSelectionRef.current = true;
      setAssetMentionIndex((current) =>
        (current + 1) % assetMentionOptions.length,
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      suppressAssetMentionSelectionRef.current = true;
      setAssetMentionIndex((current) =>
        (current - 1 + assetMentionOptions.length) %
        assetMentionOptions.length,
      );
      return;
    }

    if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      suppressAssetMentionSelectionRef.current = true;
      const selectedAsset = assetMentionOptions[selectedAssetMentionIndex];
      if (selectedAsset) insertMentionAssetReference(selectedAsset);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      suppressAssetMentionSelectionRef.current = true;
      setAssetMentionRange(null);
      setAssetMentionPosition(null);
      setAssetMentionIndex(0);
    }
  }

  function scrollAssetRail(direction: "left" | "right") {
    const rail = assetRailRef.current;
    if (!rail) return;

    rail.scrollBy({
      left: direction === "left" ? -rail.clientWidth * 0.72 : rail.clientWidth * 0.72,
      behavior: "smooth",
    });
    window.setTimeout(updateAssetRailState, 260);
  }

  async function handleSelectFiles(files: FileList | null) {
    if (!files?.length) return;

    const incomingFiles = Array.from(files);
    const unsupportedFiles = incomingFiles.filter(
      (file) => !isReferenceFileAllowedForWorkspace(file, workspaceMode),
    );

    if (unsupportedFiles.length) {
      setReferenceUploadError(
        language === "en"
          ? `Unsupported file type: ${unsupportedFiles
              .map((file) => file.name)
              .join(", ")}`
          : `暂不支持这些文件：${unsupportedFiles
              .map((file) => file.name)
              .join("、")}`,
      );
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    const oversizedFiles = incomingFiles.filter((file) => {
      if (isAllowedReferenceImage(file)) {
        return file.size > maxReferenceImageSizeBytes;
      }

      if (isAllowedReferenceDocument(file)) {
        return file.size > maxReferenceDocumentSizeBytes;
      }

      return true;
    });

    if (oversizedFiles.length) {
      setReferenceUploadError(
        language === "en"
          ? `File too large: ${oversizedFiles
              .map((file) => file.name)
              .join(", ")}`
          : `文件过大：${oversizedFiles.map((file) => file.name).join("、")}`,
      );
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    const availableSlots = Math.max(0, 8 - referenceAttachments.length);
    if (availableSlots === 0) {
      setReferenceUploadError(copy.maxReferenceError);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    const selectedFiles = incomingFiles.slice(0, availableSlots);
    const formData = new FormData();

    for (const file of selectedFiles) {
      formData.append("files", file);
    }

    setReferenceUploading(true);
    setReferenceUploadError(null);

    try {
      const response = await fetch("/api/reference-files", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json()) as {
        attachments?: ReferenceAttachment[];
        message?: string;
      };

      if (!response.ok) {
        throw new Error(data.message ?? copy.uploadFailed);
      }

      const merged = [
        ...referenceAttachments,
        ...(data.attachments ?? []),
      ].slice(0, 8);
      onReferenceAttachmentsChange(merged);
    } catch (uploadError) {
      setReferenceUploadError(
        uploadError instanceof Error
          ? uploadError.message
          : copy.uploadRetry,
      );
    } finally {
      setReferenceUploading(false);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleReferenceDragOver(event: ReactDragEvent<HTMLDivElement>) {
    if (!referenceUploadsEnabled || isBusy || referenceUploading) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }

  function handleReferenceDrop(event: ReactDragEvent<HTMLDivElement>) {
    if (!referenceUploadsEnabled || isBusy || referenceUploading) return;

    event.preventDefault();
    void handleSelectFiles(event.dataTransfer.files);
  }

  async function removeReferenceAttachment(id: string) {
    const attachment = referenceAttachments.find((item) => item.id === id);

    if (!attachment) return;

    const remaining = referenceAttachments.filter((item) => item.id !== id);
    onReferenceAttachmentsChange(remaining);

    if (!attachment.storagePath) return;

    try {
      const response = await fetch(
        `/api/reference-files?id=${encodeURIComponent(attachment.id)}`,
        { method: "DELETE" },
      );
      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(
          data.message ?? "Unable to delete the reference file. Please try again later.",
        );
      }
    } catch (deleteError) {
      onReferenceAttachmentsChange(referenceAttachments);
      setReferenceUploadError(
        deleteError instanceof Error ? deleteError.message : copy.uploadRetry,
      );
    }
  }

  return (
    <section className="mx-auto mt-12 w-full max-w-[980px] min-w-0 px-4 sm:mt-16 sm:px-8">
      <div className="prompt-card glass-panel soft-shadow min-w-0 overflow-hidden rounded-[28px] sm:rounded-[34px]">
        <div className="flex min-w-0 items-center justify-between gap-3 border-b border-[#1A2C26]/9 px-4 py-4 sm:px-7">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="h-2 w-2 rounded-full bg-[#C68A4A]" />
            <span className="min-w-0 truncate text-[10px] font-semibold tracking-[0.18em] text-[#2B4A3F]/60">
              {isScreenwritingWorkspace
                ? "SCREENWRITER'S BRIEF"
                : "DIRECTOR'S BRIEF"}
            </span>
          </div>
          <div className="flex shrink-0 items-start gap-3">
            <span className="hidden pt-1.5 text-[10px] tracking-[0.12em] text-[#2B4A3F]/45 sm:inline">
              {copy.briefMode}
            </span>
            <div
              className="-my-4 flex items-start gap-1.5"
              aria-label={copy.promptOutputLanguageLabel}
            >
              {(["zh", "en"] as const).map((languageOption) => {
                const active = promptOutputLanguage === languageOption;
                const tooltip =
                  languageOption === "zh"
                    ? copy.setPromptOutputZh
                    : copy.setPromptOutputEn;

                return (
                  <span
                    key={languageOption}
                    className="group/bookmark relative inline-flex"
                  >
                    <button
                      type="button"
                      title={tooltip}
                      aria-label={tooltip}
                      aria-pressed={active}
                      onClick={() =>
                        onPromptOutputLanguageChange(languageOption)
                      }
                      className={`flex h-12 w-8 origin-top items-start justify-center pt-2 text-[12px] font-black tracking-[0.04em] shadow-[0_10px_20px_rgba(26,44,38,0.12)] transition-transform duration-300 ease-out group-hover/bookmark:translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C68A4A]/55 ${
                        active
                          ? "bg-[#1A2C26] text-[#F4E8D4]"
                          : "bg-[#EBD8B9] text-[#2B4A3F]/68 hover:bg-[#D6A15F] hover:text-[#1A2C26]"
                      }`}
                      style={{
                        clipPath:
                          "polygon(0 0, 100% 0, 100% 100%, 50% 82%, 0 100%)",
                      }}
                    >
                      {languageOption === "zh" ? "中" : "英"}
                    </button>
                    <span className="pointer-events-none absolute right-full top-5 z-20 mr-2 whitespace-nowrap rounded-full border border-[#1A2C26]/10 bg-[#1A2C26] px-3 py-1.5 text-[10px] font-semibold tracking-[0.06em] text-[#F4E8D4] opacity-0 shadow-[0_12px_24px_rgba(26,44,38,0.18)] transition-opacity duration-200 group-hover/bookmark:opacity-100 group-focus-within/bookmark:opacity-100">
                      {tooltip}
                    </span>
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        <div className="min-w-0 px-4 pb-5 pt-5 sm:px-7 sm:pb-7 sm:pt-6">
          <textarea
            ref={textareaRef}
            value={value}
            wrap="soft"
            onChange={handleTextChange}
            onKeyDown={handleTextKeyDown}
            onClick={handleTextSelection}
            onKeyUp={handleTextSelection}
            className="prompt-textarea min-h-40 w-full min-w-0 bg-transparent text-base leading-7 font-medium text-[#1A2C26] placeholder:text-[#2B4A3F]/28 sm:min-h-44 sm:text-[21px] sm:leading-9"
            placeholder={
              isScreenwritingWorkspace
                ? copy.screenwritingPlaceholder
                : copy.directorPlaceholder
            }
            aria-label={
              isScreenwritingWorkspace
                ? copy.screenwritingAria
                : copy.directorAria
            }
          />

          {assetMentionOpen && typeof document !== "undefined"
            ? createPortal(
                <div
                  style={{
                    top: assetMentionPosition?.top ?? 0,
                    left: assetMentionPosition?.left ?? 8,
                    transform:
                      assetMentionPosition?.placement === "above"
                        ? "translateY(calc(-100% - 8px))"
                        : "none",
                  }}
                  className="fixed z-50 w-[360px] max-w-[calc(100vw-16px)] rounded-[18px] border border-[#1A2C26]/10 bg-[#F8EFDF]/96 p-2 shadow-[0_18px_44px_rgba(26,44,38,0.18)]"
                >
              <div className="mb-1 px-2 text-[9px] font-semibold tracking-[0.16em] text-[#9A632D]">
                {copy.assetMentionTitle}
              </div>
              <div className="grid gap-1">
                {assetMentionOptions.map((asset, index) => {
                  const assetKind = inferAssetKind(asset);
                  const previewText = getAssetPreviewText(asset);
                  const active = index === selectedAssetMentionIndex;

                  return (
                    <button
                      key={asset.id}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => insertMentionAssetReference(asset)}
                      className={`flex min-h-12 w-full min-w-0 items-center gap-2 rounded-[12px] px-2.5 py-2 text-left transition ${
                        active
                          ? "bg-[#1A2C26] text-[#F4E8D4]"
                          : "bg-white/28 text-[#1A2C26] hover:bg-white/48"
                      }`}
                    >
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
                          active
                            ? "border-[#F4E8D4]/22 bg-[#F4E8D4]/10 text-[#F4E8D4]"
                            : "border-[#1A2C26]/10 bg-white/34 text-[#9A632D]"
                        }`}
                      >
                        <AssetKindIcon assetKind={assetKind} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-[12px] font-semibold">
                            @{asset.name}
                          </span>
                          <span
                            className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[8px] font-semibold ${
                              active
                                ? "border-[#F4E8D4]/20 text-[#F4E8D4]/72"
                                : "border-[#C68A4A]/18 text-[#9A632D]"
                            }`}
                          >
                            {getAssetKindLabel(assetKind, language)}
                          </span>
                        </span>
                        <span
                          className={`mt-0.5 block truncate text-[10px] leading-4 ${
                            active ? "text-[#F4E8D4]/62" : "text-[#2B4A3F]/52"
                          }`}
                        >
                          {previewText || copy.assetFallback}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
                </div>,
                document.body,
              )
            : null}

          <div
            onDragOver={handleReferenceDragOver}
            onDrop={handleReferenceDrop}
            className="mt-4 flex flex-col gap-3 rounded-[18px] border border-[#1A2C26]/8 bg-white/14 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {referenceUploadsEnabled ? (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept={referenceAccept}
                    className="hidden"
                    onChange={(event) =>
                      void handleSelectFiles(event.target.files)
                    }
                    aria-label={copy.uploadAria}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isBusy || referenceUploading}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-[#1A2C26]/10 bg-white/28 px-3 text-[11px] font-semibold text-[#2B4A3F] transition-all hover:border-[#C68A4A]/40 hover:bg-white/46 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <UploadIcon />
                    {referenceUploading ? copy.uploadSaving : copy.uploadReference}
                  </button>
                </>
              ) : (
                <span className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-[#1A2C26]/10 bg-white/24 px-3 text-[11px] font-semibold text-[#2B4A3F]/52">
                  <UploadIcon />
                  {copy.uploadPaused}
                </span>
              )}

              {referenceAttachments.length > 0 ? (
                referenceAttachments.map((attachment) => (
                  <span
                    key={attachment.id}
                    className="inline-flex h-9 max-w-[210px] items-center gap-2 rounded-full border border-[#1A2C26]/9 bg-[#F8EFDF]/52 px-3 text-[10px] font-semibold text-[#2B4A3F]/65"
                    title={attachment.name}
                  >
                    <span className="shrink-0 text-[#9A632D]">
                      {getAttachmentKindLabel(attachment.kind, language)}
                    </span>
                    <span className="min-w-0 truncate">{attachment.name}</span>
                    <button
                      type="button"
                      onClick={() => void removeReferenceAttachment(attachment.id)}
                      aria-label={`${copy.removePrefix} ${attachment.name}`}
                      className="shrink-0 rounded-full p-1 text-[#2B4A3F]/45 transition hover:bg-[#1A2C26]/8 hover:text-[#873B31]"
                    >
                      <TrashIcon />
                    </button>
                  </span>
                ))
              ) : (
                <span className="text-[10px] font-medium text-[#2B4A3F]/38">
                  {referenceUploadsEnabled
                    ? referenceFormatHint
                    : copy.referencePausedHint}
                </span>
              )}
            </div>
            {referenceAttachments.length > 0 ? (
              <button
                type="button"
                onClick={() => onReferenceAttachmentsChange([])}
                disabled={isBusy || referenceUploading}
                className="self-start rounded-full px-2 py-1 text-[10px] font-semibold text-[#2B4A3F]/42 transition hover:bg-[#1A2C26]/7 hover:text-[#873B31] disabled:cursor-not-allowed disabled:opacity-45 sm:self-auto"
              >
                {copy.clearReference}
              </button>
            ) : null}
          </div>
          {referenceUploadError ? (
            <p className="mt-2 text-[10px] font-medium text-[#873B31]">
              {referenceUploadError}
            </p>
          ) : null}

          <div className="mt-4 flex min-w-0 flex-col gap-4 border-t border-[#1A2C26]/9 pt-5 sm:flex-row sm:items-center sm:justify-between">
            {isScreenwritingWorkspace ? (
              <div className="flex min-h-12 w-full max-w-[260px] min-w-0 items-center rounded-[18px] border border-[#1A2C26]/10 bg-white/18 px-4 text-[11px] font-medium leading-5 text-[#2B4A3F]/55 sm:max-w-[300px]">
                {copy.scriptMode}
              </div>
            ) : (
              <div className="duration-mini flex h-12 w-full max-w-[214px] min-w-0 items-center gap-2.5 rounded-full border border-[#1A2C26]/10 bg-white/22 px-3.5 sm:max-w-[218px]">
                <span className="shrink-0 text-[10px] font-semibold tracking-[0.12em] text-[#2B4A3F]/55">
                  {copy.duration}
                </span>
                <input
                  type="range"
                  min={4}
                  max={15}
                  step={1}
                  value={durationSeconds}
                  disabled={isBusy}
                  onChange={(event) =>
                    onDurationChange(Number(event.target.value))
                  }
                  aria-label={copy.durationAria}
                  className="duration-slider h-1.5 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-[#1A2C26]/12 accent-[#C68A4A] disabled:cursor-not-allowed disabled:opacity-45"
                />
                <span className="shrink-0 rounded-full border border-[#C68A4A]/25 bg-[#C68A4A]/10 px-2.5 py-1 text-[11px] font-semibold text-[#9A632D]">
                  {durationSeconds}s
                </span>
              </div>
            )}

            <div className="flex w-full min-w-0 flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
              {generationMode ? (
                <button
                  type="button"
                  onClick={onCancelGeneration}
                  className="flex h-12 w-full min-w-0 items-center justify-center gap-2.5 rounded-full border border-[#A84D3E]/24 bg-[#A84D3E]/10 px-5 text-sm font-semibold text-[#873B31] shadow-[0_10px_24px_rgba(168,77,62,0.1)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#A84D3E]/16 sm:w-auto sm:min-w-[138px]"
                >
                  <StopIcon />
                  <span>{copy.cancelGeneration}</span>
                </button>
              ) : null}
              {isScreenwritingWorkspace ? (
                <>
                  <button
                type="button"
                onClick={onGenerateScreenwriting}
                disabled={disabled}
                className="flex h-12 w-full min-w-0 items-center justify-center gap-2.5 rounded-full border border-[#C68A4A]/36 bg-[#C68A4A]/18 px-5 text-sm font-semibold text-[#8A5F16] shadow-[0_10px_26px_rgba(198,138,74,0.12)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[#A84D3E]/38 hover:bg-[#C68A4A]/26 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0 sm:w-auto sm:min-w-[150px]"
              >
                {generationMode === "screenwriting-generate" ? (
                  <>
                    <span>{copy.generatingScript}</span>
                    <span className="flex gap-1">
                      <span className="loading-dot h-1 w-1 rounded-full bg-[#8A5F16]" />
                      <span className="loading-dot h-1 w-1 rounded-full bg-[#8A5F16]" />
                      <span className="loading-dot h-1 w-1 rounded-full bg-[#8A5F16]" />
                    </span>
                  </>
                ) : (
                  <>
                    <span>{copy.generateScript}</span>
                    <ScriptIcon />
                  </>
                )}
                  </button>

                  <button
                type="button"
                onClick={onOptimizeScreenwriting}
                disabled={disabled}
                className="flex h-12 w-full min-w-0 items-center justify-center gap-2.5 rounded-full bg-[#1A2C26] px-5 text-sm font-semibold text-[#F4E8D4] shadow-[0_14px_32px_rgba(26,44,38,0.18)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#2B4A3F] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0 sm:w-auto sm:min-w-[150px]"
              >
                {generationMode === "screenwriting-optimize" ? (
                  <>
                    <span>{copy.optimizingScript}</span>
                    <span className="flex gap-1">
                      <span className="loading-dot h-1 w-1 rounded-full bg-[#F4E8D4]" />
                      <span className="loading-dot h-1 w-1 rounded-full bg-[#F4E8D4]" />
                      <span className="loading-dot h-1 w-1 rounded-full bg-[#F4E8D4]" />
                    </span>
                  </>
                ) : (
                  <>
                    <span>{copy.optimizeScript}</span>
                    <ScriptIcon />
                  </>
                )}
                  </button>
                </>
              ) : (
                <>

              <button
                type="button"
                onClick={onGenerateImage}
                disabled={disabled}
                className="flex h-12 w-full min-w-0 items-center justify-center gap-2.5 rounded-full border border-[#C68A4A]/36 bg-[#C68A4A]/18 px-5 text-sm font-semibold text-[#8A5F16] shadow-[0_10px_26px_rgba(198,138,74,0.12)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[#A84D3E]/38 hover:bg-[#C68A4A]/26 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0 sm:w-auto sm:min-w-[176px]"
              >
                {generationMode === "image" ? (
                  <>
                    <span>{copy.generatingImage}</span>
                    <span className="flex gap-1">
                      <span className="loading-dot h-1 w-1 rounded-full bg-[#8A5F16]" />
                      <span className="loading-dot h-1 w-1 rounded-full bg-[#8A5F16]" />
                      <span className="loading-dot h-1 w-1 rounded-full bg-[#8A5F16]" />
                    </span>
                  </>
                ) : (
                  <>
                    <span>{copy.imagePrompt}</span>
                    <ImageIcon />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onGenerate}
                disabled={disabled}
                className="generate-glow flex h-12 w-full min-w-0 items-center justify-center gap-3 rounded-full bg-[#1A2C26] px-6 text-sm font-semibold text-[#F4E8D4] shadow-[0_14px_34px_rgba(26,44,38,0.2)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#2B4A3F] hover:shadow-[0_18px_42px_rgba(26,44,38,0.26)] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0 sm:w-auto sm:min-w-[194px]"
              >
                {generationMode === "video" ? (
                  <>
                    <span>{copy.directing}</span>
                    <span className="flex gap-1">
                      <span className="loading-dot h-1 w-1 rounded-full bg-[#F4E8D4]" />
                      <span className="loading-dot h-1 w-1 rounded-full bg-[#F4E8D4]" />
                      <span className="loading-dot h-1 w-1 rounded-full bg-[#F4E8D4]" />
                    </span>
                  </>
                ) : (
                  <>
                    <span>{copy.videoPrompt}</span>
                    <ClapperboardIcon />
                  </>
                )}
              </button>
                </>
              )}
            </div>
          </div>

          {error ? (
            <p className="mt-4 rounded-xl border border-[#A84D3E]/18 bg-[#A84D3E]/8 px-4 py-3 text-xs leading-5 text-[#873B31]">
              {error}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-2 text-[10px] tracking-[0.1em] text-[#2B4A3F]/45">
        <span className="h-px w-7 bg-[#C68A4A]/45" />
        {canGenerate
          ? demoMode
            ? isScreenwritingWorkspace
              ? copy.readyDemoScript
              : copy.readyDemoDirector
            : isScreenwritingWorkspace
              ? copy.readyApiScript
              : copy.readyApiDirector
          : demoMode
            ? copy.connecting
            : copy.connectApi}
        <span className="h-px w-7 bg-[#C68A4A]/45" />
      </div>

      {assets.length > 0 ? (
        <div className="asset-preview-shell mt-4 w-full rounded-[18px] border border-[#1A2C26]/10 bg-white/18 px-3 py-2.5">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-[10px] font-semibold tracking-[0.12em] text-[#2B4A3F]/55">
              {copy.savedAssets}
            </span>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-medium text-[#2B4A3F]/42">
                {copy.clickToInsert}
              </span>
              <button
                type="button"
                onClick={onClearAssets}
                disabled={isBusy}
                className="rounded-full px-2 py-1 text-[10px] font-semibold text-[#2B4A3F]/42 transition hover:bg-[#1A2C26]/7 hover:text-[#873B31] disabled:cursor-not-allowed disabled:opacity-45"
              >
                {copy.clearAll}
              </button>
            </div>
          </div>

          <div className="relative">
            {assetRailCanScroll ? (
              <button
                type="button"
                onClick={() => scrollAssetRail("left")}
                disabled={assetRailAtStart}
                aria-label={copy.viewAssetsLeft}
                title={copy.viewAssetsLeft}
                className="absolute left-0 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-[#1A2C26]/12 bg-[#F8EFDF]/92 text-[#2B4A3F] shadow-[0_10px_24px_rgba(26,44,38,0.12)] transition-all hover:-translate-x-0.5 hover:bg-white disabled:pointer-events-none disabled:opacity-0"
              >
                <RailArrowIcon direction="left" />
              </button>
            ) : null}

            <div
              ref={assetRailRef}
              onScroll={updateAssetRailState}
              className="asset-preview-rail flex w-full snap-x gap-2 overflow-x-auto scroll-smooth"
            >
              {assets.map((asset) => {
                const previewText = getAssetPreviewText(asset);
                const assetKind = inferAssetKind(asset);
                const isOpen = openAssetId === asset.id;

                return (
                  <div
                    key={asset.id}
                    title={asset.promptText}
                    className={`group relative h-[62px] w-[178px] shrink-0 snap-start rounded-[14px] border text-left transition-all hover:-translate-y-0.5 sm:w-[198px] ${
                      isOpen
                        ? "border-[#C68A4A]/50 bg-white/62 shadow-[0_10px_26px_rgba(26,44,38,0.12)]"
                        : "border-[#1A2C26]/10 bg-[#F8EFDF]/42 hover:border-[#C68A4A]/38 hover:bg-white/52"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleAssetDetail(asset)}
                      disabled={isBusy}
                      aria-expanded={isOpen}
                      className="flex h-full w-full flex-col justify-center px-3 text-left disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#1A2C26]/10 bg-white/32 text-[#9A632D]">
                          <AssetKindIcon assetKind={assetKind} />
                        </span>
                        <span className="max-w-[86px] truncate text-[12px] font-semibold text-[#1A2C26] sm:max-w-[104px]">
                          @{asset.name}
                        </span>
                        <span className="shrink-0 rounded-full border border-[#C68A4A]/18 bg-[#C68A4A]/9 px-1.5 py-0.5 text-[8px] font-semibold text-[#9A632D]">
                          {getAssetKindLabel(assetKind, language)}
                        </span>
                      </span>
                      <span className="mt-1 line-clamp-1 text-[10px] leading-4 text-[#2B4A3F]/52">
                        {previewText || copy.assetFallback}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteAsset(asset.id)}
                      disabled={isBusy}
                      aria-label={`${copy.deletePrefix} ${asset.name}`}
                      className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border border-[#A84D3E]/14 bg-[#F8EFDF]/92 text-[#873B31] opacity-0 shadow-[0_8px_18px_rgba(26,44,38,0.12)] transition group-hover:opacity-100 hover:bg-white disabled:cursor-not-allowed disabled:opacity-0"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                );
              })}
            </div>

            {assetRailCanScroll ? (
              <button
                type="button"
                onClick={() => scrollAssetRail("right")}
                disabled={assetRailAtEnd}
                aria-label={copy.viewAssetsRight}
                title={copy.viewAssetsRight}
                className="absolute right-0 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-[#1A2C26]/12 bg-[#F8EFDF]/92 text-[#2B4A3F] shadow-[0_10px_24px_rgba(26,44,38,0.12)] transition-all hover:translate-x-0.5 hover:bg-white disabled:pointer-events-none disabled:opacity-0"
              >
                <RailArrowIcon direction="right" />
              </button>
            ) : null}
          </div>

          {openAsset ? (
            <div className="mt-3 rounded-[16px] border border-[#1A2C26]/10 bg-[#F8EFDF]/78 p-3 shadow-[0_18px_44px_rgba(26,44,38,0.12)]">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-semibold tracking-[0.12em] text-[#9A632D]">
                    {copy.assetDetailTitle} · @{openAsset.name}
                  </p>
                  <p className="mt-0.5 text-[10px] leading-4 text-[#2B4A3F]/48">
                    {copy.assetDetailHint}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpenAssetId(null)}
                  className="rounded-full border border-[#1A2C26]/10 bg-white/34 px-3 py-1.5 text-[10px] font-semibold text-[#2B4A3F]/62 transition hover:bg-white/60"
                >
                  {copy.closeAssetDetail}
                </button>
              </div>
              <textarea
                value={assetDetailDraft}
                onChange={(event) => {
                  setAssetDetailDraft(event.target.value);
                  setAssetDetailError(null);
                }}
                aria-label={`${copy.assetDetailAria}: ${openAsset.name}`}
                spellCheck={false}
                className="h-36 w-full resize-y rounded-[12px] border border-[#1A2C26]/10 bg-white/42 px-3 py-2.5 text-[12px] leading-5 text-[#1A2C26] outline-none transition focus:border-[#C68A4A]/45 focus:bg-white/62"
              />
              {assetDetailError ? (
                <p className="mt-2 rounded-[10px] border border-[#A84D3E]/16 bg-[#A84D3E]/8 px-3 py-2 text-[10px] leading-4 text-[#873B31]">
                  {assetDetailError}
                </p>
              ) : null}
              <div className="mt-2 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={copyAssetDetailText}
                  className="rounded-full border border-[#1A2C26]/10 bg-white/34 px-3 py-1.5 text-[10px] font-semibold text-[#2B4A3F]/68 transition hover:bg-white/62"
                >
                  {assetDetailCopied ? copy.copiedAsset : copy.copyAsset}
                </button>
                <button
                  type="button"
                  onClick={() => insertAssetReference(openAsset.name)}
                  disabled={isBusy}
                  className="rounded-full border border-[#C68A4A]/22 bg-[#C68A4A]/12 px-3 py-1.5 text-[10px] font-semibold text-[#8A5F16] transition hover:bg-[#C68A4A]/20 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {copy.insertReference}
                </button>
                <button
                  type="button"
                  onClick={() => void saveAssetDetailText()}
                  disabled={
                    assetDetailSaving ||
                    !assetDetailDraft.trim() ||
                    assetDetailDraft === openAsset.promptText
                  }
                  className="rounded-full bg-[#1A2C26] px-3 py-1.5 text-[10px] font-semibold text-[#F4E8D4] transition hover:bg-[#2B4A3F] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {assetDetailSaving ? copy.savingAsset : copy.saveAssetEdits}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 flex justify-start">
          <div
            title={copy.noAssets}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#1A2C26]/10 bg-white/18 text-[#2B4A3F]/42"
          >
            <AssetKindIcon assetKind="character" />
          </div>
        </div>
      )}
    </section>
  );
}
