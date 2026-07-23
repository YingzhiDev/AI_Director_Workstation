"use client";

import { useEffect, useRef, useState } from "react";
import type {
  AssetKind,
  AssetRecord,
  OutputLanguage,
  PromptKind,
  PromptVersion,
} from "@/types";

type OutputPanelProps = {
  versions: PromptVersion[];
  copiedId: string | null;
  copyErrorId: string | null;
  refiningId: string | null;
  refinementError: string | null;
  canRefine: boolean;
  assetSaveFeedback: string | null;
  assetSaveError: string | null;
  onConfirm: (id: string, promptText: string) => void;
  onRefine: (version: PromptVersion) => void;
  onCopy: (id: string, text: string) => void;
  onSaveAsset: (
    name: string,
    promptText: string,
    sourcePromptKind: PromptKind,
    assetKind: AssetKind,
  ) => Promise<AssetRecord | null>;
  language: OutputLanguage;
};

function CopyIcon({ checked }: { checked: boolean }) {
  return checked ? (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-4 w-4"
    >
      <path d="m4 10 4 4 8-8" />
    </svg>
  ) : (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="h-4 w-4"
    >
      <rect x="6.5" y="6.5" width="9" height="9" rx="2" />
      <path d="M13.5 6.5V5A2 2 0 0 0 11.5 3h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2H6" />
    </svg>
  );
}

function inferAssetKindFromText(text: string): AssetKind {
  if (/主角|配角|人物|角色|人形|机器人|男孩|女孩|男人|女人|老人|少年|少女/u.test(text)) {
    return "character";
  }

  if (/场景|空间|房间|城市|街|巷|公寓|学校|医院|天台|室内|室外|地点|环境|世界/u.test(text)) {
    return "scene";
  }

  if (/道具|物件|武器|手机|相机|车|伞|门|钥匙|箱|项链|眼镜|书|装置|机器/u.test(text)) {
    return "prop";
  }

  return "character";
}

const assetKindOptions: Array<{
  value: AssetKind;
  label: Record<OutputLanguage, string>;
}> = [
  { value: "character", label: { zh: "人物", en: "Character" } },
  { value: "prop", label: { zh: "道具", en: "Prop" } },
  { value: "scene", label: { zh: "场景", en: "Scene" } },
];

function extractAssetCandidate(text: string, promptKind: PromptKind = "video") {
  if (promptKind === "video") {
    const assetHeading = text.match(
      /【\s*(?:资产设定|Asset Lock)\s*\/\s*ASSET LOCK\s*】/u,
    );
    if (!assetHeading || assetHeading.index === undefined) return "";

    const start = assetHeading.index + assetHeading[0].length;
    const rest = text.slice(start);
    const nextHeading = rest.search(/\n【[^】]+】/u);
    return (nextHeading >= 0 ? rest.slice(0, nextHeading) : rest).trim();
  }

  if (promptKind === "image") {
    const positiveHeading = text.match(
      /【\s*(?:正向提示词|Positive Prompt)\s*\/\s*POSITIVE PROMPT\s*】/u,
    );
    if (!positiveHeading || positiveHeading.index === undefined) return "";

    const start = positiveHeading.index + positiveHeading[0].length;
    const rest = text.slice(start);
    const negativeHeading = rest.search(
      /\n【\s*(?:负面提示词|Negative Prompt)\s*\/\s*NEGATIVE PROMPT\s*】/u,
    );
    return (negativeHeading >= 0 ? rest.slice(0, negativeHeading) : rest).trim();
  }

  return "";
}

function normalizeSelectedAssetText(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

const outputPanelCopy = {
  zh: {
    editMode: "编辑模式",
    revealing: "正在输出",
    doubleClickEdit: "双击正文可编辑",
    seconds: "秒",
    compiler: "编译器",
    method: "法",
    mockPreview: "SAMPLE PREVIEW",
    assetBindingTitle: "ASSET BINDING",
    assetBindingText: "可将本次资产设定保存为长期复用资产",
    bindAsset: "绑定资产设定",
    assetNamePlaceholder: "资产名称，例如：小明、母亲公寓、旧相机",
    assetNameAria: "资产名称",
    assetTextAria: "资产设定文本",
    assetNameFallback: "资产名",
    assetUsagePrefix: "保存后可在输入框使用",
    assetUsageSuffix: "直接调用这段资产设定。",
    cancel: "取消",
    savingAsset: "保存中...",
    saveAsset: "保存资产",
    editingTitle: "正在编辑，完成后点击确定",
    confirm: "确定",
    refineUnavailable: "继续指导暂未开放",
    copied: "已复制",
    copyFailed: "复制失败",
    copy: "复制",
    waiting: "正在等待模型返回第一段文字...",
    modelProcess: "模型思考中...",
    processWaiting: "等待模型开始输出...",
    doubleClickTitle: "双击进入编辑模式",
    refine: {
      video: "导演继续指导",
      image: "继续摄影指导",
      screenwriting: "编剧继续指导",
      videoBusy: "导演指导中...",
      imageBusy: "摄影指导中...",
      screenwritingBusy: "编剧指导中...",
    },
  },
  en: {
    editMode: "Edit mode",
    revealing: "Writing",
    doubleClickEdit: "Double-click text to edit",
    seconds: "sec",
    compiler: "Compiler",
    method: "methods",
    mockPreview: "SAMPLE PREVIEW",
    assetBindingTitle: "ASSET BINDING",
    assetBindingText: "Save this asset lock for future reuse",
    bindAsset: "Save asset lock",
    assetNamePlaceholder:
      "Asset name, e.g. Maya, mother apartment, old camera",
    assetNameAria: "Asset name",
    assetTextAria: "Asset lock text",
    assetNameFallback: "asset-name",
    assetUsagePrefix: "After saving, type",
    assetUsageSuffix: "in the input box to reuse this asset lock.",
    cancel: "Cancel",
    savingAsset: "Saving...",
    saveAsset: "Save asset",
    editingTitle: "Editing. Confirm when finished.",
    confirm: "Confirm",
    refineUnavailable: "Further direction is not available yet",
    copied: "Copied",
    copyFailed: "Copy failed",
    copy: "Copy",
    waiting: "Waiting for the model to return the first text chunk...",
    modelProcess: "Model thinking...",
    processWaiting: "Waiting for the model to start writing...",
    doubleClickTitle: "Double-click to edit",
    refine: {
      video: "Continue directing",
      image: "Continue image direction",
      screenwriting: "Continue script direction",
      videoBusy: "Directing...",
      imageBusy: "Directing image...",
      screenwritingBusy: "Reviewing script...",
    },
  },
} as const;

function getPromptKindMeta(
  promptKind: PromptKind = "video",
  language: OutputLanguage,
) {
  if (language === "en") {
    if (promptKind === "image") {
      return {
        eyebrow: "IMAGE PROMPT TREATMENT",
        panelTitle: "Image Prompt Treatment",
        panelIntro:
          "Double-click the text to edit it. The public workflow returns a structured result ready for external image models.",
        cardTitle: "COMPLETE IMAGE PROMPT",
        copyLabel: "image prompt",
        versionTag: "IMAGE GENERATED",
      };
    }

    if (promptKind === "screenwriting") {
      return {
        eyebrow: "SCREENWRITING TREATMENT",
        panelTitle: "Script Development Treatment",
        panelIntro:
          "Double-click the text to edit it. The public workflow organizes structure, character, scene, and dialogue guidance.",
        cardTitle: "COMPLETE SCRIPT DRAFT",
        copyLabel: "script text",
        versionTag: "SCRIPT GENERATED",
      };
    }

    return {
      eyebrow: "DIRECTOR'S TREATMENT",
      panelTitle: "Cinematic Prompt Treatment",
      panelIntro:
        "Double-click any version to edit it. Confirm the text, then continue directing; new versions stay below in order.",
      cardTitle: "COMPLETE CINEMATIC PROMPT",
      copyLabel: "cinematic prompt",
      versionTag: "AI GENERATED",
    };
  }

  if (promptKind === "image") {
    return {
      eyebrow: "IMAGE PROMPT TREATMENT",
      panelTitle: "图片提示词提案",
      panelIntro:
        "双击正文即可编辑；公开展示流程会生成可直接复制到外部图片模型的结构化成品。",
      cardTitle: "COMPLETE IMAGE PROMPT",
      copyLabel: "图片提示词",
      versionTag: "IMAGE GENERATED",
    };
  }

  if (promptKind === "screenwriting") {
    return {
      eyebrow: "SCREENWRITING TREATMENT",
      panelTitle: "剧本创作提案",
      panelIntro:
        "双击正文即可编辑；公开展示流程会围绕结构、人物、场景与对白生成或优化剧本文本。",
      cardTitle: "COMPLETE SCRIPT DRAFT",
      copyLabel: "剧本文本",
      versionTag: "SCRIPT GENERATED",
    };
  }

  return {
    eyebrow: "DIRECTOR'S TREATMENT",
    panelTitle: "影视级提示词提案",
    panelIntro:
      "双击任一版本正文即可编辑；确认后可继续让导演优化，新版本会按顺序保留在下方。",
    cardTitle: "COMPLETE CINEMATIC PROMPT",
    copyLabel: "影视级提示词",
    versionTag: "AI GENERATED",
  };
}

function buildPromptLines(text: string) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let lineStart = 0;

  return lines.map((line, lineIndex) => {
    const start = lineStart;
    const end = start + line.length;

    lineStart = end + 1;

    return {
      key: `${lineIndex}-${start}`,
      text: line,
    };
  });
}

function HighlightedPromptText({
  text,
  onDoubleClick,
  isRevealing,
  language,
  promptKind = "video",
  showWaiting = true,
}: {
  text: string;
  onDoubleClick: () => void;
  isRevealing?: boolean;
  language: OutputLanguage;
  promptKind?: PromptKind;
  showWaiting?: boolean;
}) {
  const lines = buildPromptLines(text);
  const copy = outputPanelCopy[language];
  const isScreenwriting = promptKind === "screenwriting";

  return (
    <div
      role="textbox"
      tabIndex={0}
      aria-readonly="true"
      onDoubleClick={onDoubleClick}
      title={copy.doubleClickTitle}
      className={`min-h-40 w-full cursor-text px-6 py-8 text-[15px] text-[#3F5048] outline-none transition-colors duration-300 selection:bg-[#C68A4A]/24 sm:px-10 sm:py-10 sm:text-[16px] ${
        isScreenwriting ? "leading-[1.72]" : "leading-[2.05]"
      }`}
    >
      {text ? (
        lines.map((line, index) => {
          const trimmedLine = line.text.trim();
          if (!trimmedLine) {
            return (
              <div
                key={line.key}
                className={isScreenwriting ? "h-2 sm:h-2.5" : "h-4 sm:h-5"}
              />
            );
          }

          const isSectionHeading = /^【[^】]+】$/u.test(trimmedLine);

          return (
            <div
              key={line.key}
              className={
                isSectionHeading
                  ? `${
                      index === 0
                        ? ""
                        : isScreenwriting
                          ? "mt-4 sm:mt-5"
                          : "mt-5 sm:mt-7"
                    } mb-1 font-normal tracking-[0] text-[#3F5048]`
                  : "font-normal tracking-[0] text-[#3F5048]"
              }
            >
              {line.text}
            </div>
          );
        })
      ) : showWaiting ? (
        <span className="text-[#2B4A3F]/42">{copy.waiting}</span>
      ) : (
        <span className="sr-only">{copy.waiting}</span>
      )}
      {isRevealing ? (
        <span className="ml-1 inline-block h-4 w-1 animate-pulse rounded-full bg-[#C68A4A] align-[-2px]" />
      ) : null}
    </div>
  );
}

function GenerationProcessBox({
  text,
  status,
  language,
}: {
  text: string;
  status?: string;
  language: OutputLanguage;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const copy = outputPanelCopy[language];
  const displayText = text.trim() || status || copy.processWaiting;

  useEffect(() => {
    const element = contentRef.current;
    if (!element) return;

    element.scrollTop = element.scrollHeight;
  }, [displayText]);

  return (
    <div className="border-b border-[#1A2C26]/8 bg-[#F8EFDF]/36 px-5 py-4 sm:px-8">
      <div className="mx-auto w-full max-w-[960px]">
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="text-[10px] font-semibold tracking-[0.16em] text-[#9A632D]">
            {copy.modelProcess}
          </span>
          <span className="flex gap-1">
            <span className="loading-dot h-1 w-1 rounded-full bg-[#9A632D]" />
            <span className="loading-dot h-1 w-1 rounded-full bg-[#9A632D]" />
            <span className="loading-dot h-1 w-1 rounded-full bg-[#9A632D]" />
          </span>
        </div>
        <div
          ref={contentRef}
          className="h-36 w-full overflow-y-auto rounded-[16px] border border-[#1A2C26]/10 bg-white/54 px-4 py-3 text-[12px] leading-6 text-[#2B4A3F]/72 shadow-inner sm:h-40"
        >
          <pre className="whitespace-pre-wrap break-words font-sans">
            {displayText}
          </pre>
        </div>
      </div>
    </div>
  );
}

function PromptVersionCard({
  version,
  index,
  copiedId,
  copyErrorId,
  refining,
  canRefine,
  assetSaveFeedback,
  assetSaveError,
  onConfirm,
  onRefine,
  onCopy,
  onSaveAsset,
  language,
}: {
  version: PromptVersion;
  index: number;
  copiedId: string | null;
  copyErrorId: string | null;
  refining: boolean;
  canRefine: boolean;
  assetSaveFeedback: string | null;
  assetSaveError: string | null;
  onConfirm: (id: string, promptText: string) => void;
  onRefine: (version: PromptVersion) => void;
  onCopy: (id: string, text: string) => void;
  onSaveAsset: (
    name: string,
    promptText: string,
    sourcePromptKind: PromptKind,
    assetKind: AssetKind,
  ) => Promise<AssetRecord | null>;
  language: OutputLanguage;
}) {
  const [draft, setDraft] = useState(version.promptText);
  const [isEditing, setIsEditing] = useState(false);
  const [assetFormOpen, setAssetFormOpen] = useState(false);
  const [assetName, setAssetName] = useState("");
  const [assetText, setAssetText] = useState("");
  const [assetKind, setAssetKind] = useState<AssetKind>("character");
  const [assetSaving, setAssetSaving] = useState(false);
  const outputRef = useRef<HTMLTextAreaElement>(null);
  const promptSelectionRef = useRef<HTMLDivElement>(null);
  const copyId = `prompt-${version.id}`;
  const currentText = isEditing ? draft : version.promptText;
  const promptKind = version.promptKind ?? "video";
  const copy = outputPanelCopy[language];
  const promptMeta = getPromptKindMeta(promptKind, language);
  const showProcessBox =
    version.isRevealing && version.streamPreviewText !== undefined;
  const showTerminalStatus =
    !version.isRevealing && !currentText.trim() && Boolean(version.revealStatus);
  const canRefineVersion =
    promptKind === "video" ||
    promptKind === "image" ||
    promptKind === "screenwriting";
  const refineIdleLabel =
    promptKind === "image"
      ? copy.refine.image
      : promptKind === "screenwriting"
        ? copy.refine.screenwriting
        : copy.refine.video;
  const refineBusyLabel =
    promptKind === "image"
      ? copy.refine.imageBusy
      : promptKind === "screenwriting"
        ? copy.refine.screenwritingBusy
        : copy.refine.videoBusy;
  const assetCandidate = extractAssetCandidate(version.promptText, promptKind);
  function startEditing() {
    if (version.isRevealing) return;

    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const restoreScroll = () => window.scrollTo(scrollX, scrollY);
    setDraft(version.promptText);
    setIsEditing(true);
    requestAnimationFrame(() => {
      outputRef.current?.focus({ preventScroll: true });
      restoreScroll();
      requestAnimationFrame(restoreScroll);
      window.setTimeout(restoreScroll, 60);
      window.setTimeout(restoreScroll, 140);
    });
  }

  function confirmEditing() {
    if (!isEditing) return;

    const nextPrompt = draft.trim();
    if (!nextPrompt) return;

    onConfirm(version.id, nextPrompt);
    setDraft(nextPrompt);
    setIsEditing(false);
  }

  function getSelectedPromptText() {
    const textArea = outputRef.current;

    if (textArea && textArea.selectionStart !== textArea.selectionEnd) {
      return normalizeSelectedAssetText(
        textArea.value.slice(textArea.selectionStart, textArea.selectionEnd),
      );
    }

    const selection = window.getSelection();
    const selectionRoot = promptSelectionRef.current;

    if (
      !selection ||
      selection.isCollapsed ||
      !selectionRoot ||
      !selection.anchorNode ||
      !selection.focusNode ||
      !selectionRoot.contains(selection.anchorNode) ||
      !selectionRoot.contains(selection.focusNode)
    ) {
      return "";
    }

    return normalizeSelectedAssetText(selection.toString());
  }

  function openAssetForm() {
    const selectedText = getSelectedPromptText();

    setAssetText(selectedText);
    setAssetName("");
    setAssetKind(inferAssetKindFromText(selectedText));
    setAssetFormOpen(true);
  }

  async function saveAsset() {
    if (!assetName.trim() || !assetText.trim() || assetSaving) return;

    setAssetSaving(true);
    const saved = await onSaveAsset(assetName, assetText, promptKind, assetKind);
    setAssetSaving(false);

    if (saved) {
      setAssetName(saved.name);
      setAssetFormOpen(false);
    }
  }

  return (
    <div id={`prompt-version-${version.id}`} className="relative">
      <article className="glass-panel soft-shadow overflow-hidden rounded-[28px]">
      <div className="flex flex-col gap-3 border-b border-[#1A2C26]/9 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <div className="flex items-center gap-2.5">
          <span className="h-2 w-2 rounded-full bg-[#C68A4A]" />
          <span className="text-[10px] font-semibold tracking-[0.18em] text-[#2B4A3F]/60">
            {promptMeta.cardTitle} · VERSION {index + 1}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isEditing ? (
            <span className="rounded-full border border-[#C68A4A]/25 bg-[#C68A4A]/10 px-2.5 py-1 text-[9px] font-semibold tracking-[0.08em] text-[#9A632D]">
              {copy.editMode}
            </span>
          ) : version.isRevealing || showTerminalStatus ? (
            <span className="rounded-full border border-[#C68A4A]/25 bg-[#C68A4A]/10 px-2.5 py-1 text-[9px] font-semibold tracking-[0.08em] text-[#9A632D]">
              {version.revealStatus ?? copy.revealing}
            </span>
          ) : (
            <span className="text-[9px] text-[#2B4A3F]/42">
              {copy.doubleClickEdit}
            </span>
          )}
          {promptKind === "video" && version.durationSeconds ? (
            <span className="rounded-full border border-[#1A2C26]/10 bg-white/25 px-2.5 py-1 text-[9px] font-semibold tracking-[0.08em] text-[#2B4A3F]/58">
              {version.durationSeconds} {copy.seconds}
            </span>
          ) : null}
          {!version.isMock && version.compilerMethodCount ? (
            <span className="rounded-full border border-[#C68A4A]/22 bg-[#C68A4A]/10 px-2.5 py-1 text-[9px] font-semibold tracking-[0.08em] text-[#9A632D]">
              {copy.compiler} · {version.compilerMethodCount} {copy.method} ·{" "}
              {version.compilerStrategy}
            </span>
          ) : null}
          <span className="font-mono text-[10px] text-[#2B4A3F]/40">
            V1 / {version.isMock ? copy.mockPreview : promptMeta.versionTag}
          </span>
        </div>
      </div>

      {!version.isMock && !version.isRevealing && assetCandidate ? (
        <div className="border-b border-[#1A2C26]/8 bg-white/24 px-5 py-4 sm:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold tracking-[0.18em] text-[#9A632D]">
                {copy.assetBindingTitle}
              </p>
              <p className="mt-1 text-sm font-semibold text-[#1A2C26]">
                {copy.assetBindingText}
              </p>
            </div>
            <button
              type="button"
              onClick={openAssetForm}
              className="rounded-full border border-[#C68A4A]/28 bg-[#C68A4A]/12 px-4 py-2 text-xs font-semibold text-[#9A632D] transition-all hover:-translate-y-0.5 hover:bg-[#C68A4A]/18"
            >
              {copy.bindAsset}
            </button>
          </div>

          {assetFormOpen ? (
            <div className="mt-4 grid gap-3">
              <input
                value={assetName}
                onChange={(event) => setAssetName(event.target.value)}
                placeholder={copy.assetNamePlaceholder}
                aria-label={copy.assetNameAria}
                className="h-11 rounded-2xl border border-[#1A2C26]/10 bg-white/48 px-4 text-sm font-medium text-[#1A2C26] outline-none transition-colors focus:border-[#C68A4A]/55"
              />
              <div className="flex flex-wrap gap-2">
                {assetKindOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setAssetKind(option.value)}
                    className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-all ${
                      assetKind === option.value
                        ? "border-[#C68A4A]/40 bg-[#C68A4A]/16 text-[#9A632D]"
                        : "border-[#1A2C26]/10 bg-white/24 text-[#2B4A3F]/58 hover:bg-white/42"
                    }`}
                  >
                    {option.label[language]}
                  </button>
                ))}
              </div>
              <textarea
                value={assetText}
                onChange={(event) => setAssetText(event.target.value)}
                aria-label={copy.assetTextAria}
                spellCheck={false}
                className="min-h-36 resize-y rounded-2xl border border-[#1A2C26]/10 bg-white/48 px-4 py-3 text-xs leading-6 text-[#1A2C26]/82 outline-none transition-colors focus:border-[#C68A4A]/55"
              />
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[11px] leading-5 text-[#2B4A3F]/58">
                  {copy.assetUsagePrefix} @{assetName.trim() || copy.assetNameFallback}{" "}
                  {copy.assetUsageSuffix}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAssetFormOpen(false)}
                    className="rounded-full border border-[#1A2C26]/10 bg-white/24 px-4 py-2 text-xs font-semibold text-[#2B4A3F]/68 transition-all hover:bg-white/42"
                  >
                    {copy.cancel}
                  </button>
                  <button
                    type="button"
                    onClick={saveAsset}
                    disabled={!assetName.trim() || !assetText.trim() || assetSaving}
                    className="rounded-full bg-[#1A2C26] px-4 py-2 text-xs font-semibold text-[#F4E8D4] transition-all hover:bg-[#2B4A3F] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {assetSaving ? copy.savingAsset : copy.saveAsset}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {assetSaveFeedback ? (
            <p className="mt-3 rounded-xl border border-[#4F7B61]/18 bg-[#4F7B61]/8 px-3 py-2 text-xs text-[#2B4A3F]">
              {assetSaveFeedback}
            </p>
          ) : null}
          {assetSaveError ? (
            <p className="mt-3 rounded-xl border border-[#A84D3E]/18 bg-[#A84D3E]/8 px-3 py-2 text-xs text-[#873B31]">
              {assetSaveError}
            </p>
          ) : null}
        </div>
      ) : null}

      {showProcessBox ? (
        <GenerationProcessBox
          text={version.streamPreviewText ?? ""}
          status={version.revealStatus}
          language={language}
        />
      ) : null}

      <div ref={promptSelectionRef}>
        {isEditing ? (
          <div className="relative">
            <div
              aria-hidden="true"
              className={`invisible min-h-40 w-full whitespace-pre-wrap px-6 py-8 text-[15px] font-normal sm:px-10 sm:py-10 sm:text-[16px] ${
                promptKind === "screenwriting" ? "leading-[1.72]" : "leading-[2.05]"
              }`}
            >
              {draft || " "}
            </div>
            <textarea
              ref={outputRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              aria-label={`${promptMeta.copyLabel} version ${index + 1}`}
              title={copy.editingTitle}
              spellCheck={false}
              className={`output-textarea absolute inset-0 h-full w-full resize-none overflow-hidden bg-white/42 px-6 py-8 text-[15px] font-normal text-[#3F5048] outline-none ring-2 ring-inset ring-[#C68A4A]/25 transition-colors duration-300 sm:px-10 sm:py-10 sm:text-[16px] ${
                promptKind === "screenwriting" ? "leading-[1.72]" : "leading-[2.05]"
              }`}
            />
          </div>
        ) : (
          <HighlightedPromptText
            text={version.promptText}
            onDoubleClick={startEditing}
            isRevealing={version.isRevealing}
            language={language}
            promptKind={promptKind}
            showWaiting={!showProcessBox && !showTerminalStatus}
          />
        )}
      </div>

      <div className="grid grid-cols-3 border-t border-[#F4E8D4]/12 bg-[#1A2C26] text-[#F4E8D4]">
        <button
          type="button"
          onClick={confirmEditing}
          disabled={!isEditing || !draft.trim() || version.isRevealing}
          className="flex min-h-12 items-center justify-center border-r border-[#F4E8D4]/12 px-3 text-xs font-semibold transition-colors hover:bg-[#2B4A3F] disabled:cursor-not-allowed disabled:text-[#F4E8D4]/28 disabled:hover:bg-transparent"
        >
          {copy.confirm}
        </button>
        <button
          type="button"
          onClick={() => onRefine({ ...version, promptText: currentText.trim() })}
          disabled={
            !canRefine ||
            !canRefineVersion ||
            isEditing ||
            refining ||
            !currentText.trim() ||
            version.isRevealing
          }
          className="flex min-h-12 items-center justify-center border-r border-[#F4E8D4]/12 px-3 text-center text-xs font-semibold transition-colors hover:bg-[#2B4A3F] disabled:cursor-not-allowed disabled:text-[#F4E8D4]/28 disabled:hover:bg-transparent"
        >
          {!canRefineVersion
            ? copy.refineUnavailable
            : refining
              ? refineBusyLabel
              : refineIdleLabel}
        </button>
        <button
          type="button"
          onClick={() => onCopy(copyId, currentText)}
          disabled={version.isRevealing || !currentText.trim()}
          className="flex min-h-12 items-center justify-center gap-2 px-3 text-xs font-semibold transition-colors hover:bg-[#2B4A3F] disabled:cursor-not-allowed disabled:text-[#F4E8D4]/28 disabled:hover:bg-transparent"
        >
          <CopyIcon checked={copiedId === copyId} />
          {copiedId === copyId
            ? copy.copied
            : copyErrorId === copyId
              ? copy.copyFailed
              : copy.copy}
        </button>
      </div>
      </article>
    </div>
  );
}

export function OutputPanel({
  versions,
  copiedId,
  copyErrorId,
  refiningId,
  refinementError,
  canRefine,
  assetSaveFeedback,
  assetSaveError,
  onConfirm,
  onRefine,
  onCopy,
  onSaveAsset,
  language,
}: OutputPanelProps) {
  const promptKind =
    versions.find((version) => !version.isMock)?.promptKind ??
    versions[0]?.promptKind ??
    "video";
  const promptMeta = getPromptKindMeta(promptKind, language);

  return (
    <section
      id="director-output"
      className="output-reveal mx-auto mt-24 w-full max-w-[1080px] px-5 pb-24 sm:px-8 sm:pb-32"
    >
      <div className="mb-8">
        <div className="mb-3 flex items-center gap-3">
          <span className="text-[10px] font-semibold tracking-[0.22em] text-[#C68A4A]">
            {promptMeta.eyebrow}
          </span>
          <span className="h-px w-12 bg-[#C68A4A]/45" />
        </div>
        <h2 className="text-3xl font-semibold tracking-[-0.04em] text-[#1A2C26] sm:text-4xl">
          {promptMeta.panelTitle}
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[#2B4A3F]/58">
          {promptMeta.panelIntro}
        </p>
      </div>

      <div className="space-y-7">
        {versions.map((version, index) => (
          <PromptVersionCard
            key={version.id}
            version={version}
            index={index}
            copiedId={copiedId}
            copyErrorId={copyErrorId}
            refining={refiningId === version.id}
            canRefine={canRefine}
            assetSaveFeedback={assetSaveFeedback}
            assetSaveError={assetSaveError}
            onConfirm={onConfirm}
            onRefine={onRefine}
            onCopy={onCopy}
            onSaveAsset={onSaveAsset}
            language={language}
          />
        ))}

        {refinementError ? (
          <p className="rounded-2xl border border-[#A84D3E]/18 bg-[#A84D3E]/8 px-4 py-3 text-xs leading-5 text-[#873B31]">
            {refinementError}
          </p>
        ) : null}
      </div>
    </section>
  );
}
