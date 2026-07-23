"use client";

import type { HistoryRecord, OutputLanguage } from "@/types";

type HistoryPanelProps = {
  records: HistoryRecord[];
  loading: boolean;
  copiedId: string | null;
  copyErrorId: string | null;
  onBack: () => void;
  boardLabel?: string;
  onRefresh: () => void;
  onUseRecord: (record: HistoryRecord) => void;
  onDeleteRecord: (id: string) => void;
  onClearRecords: () => void;
  onCopy: (id: string, text: string) => void;
  language: OutputLanguage;
};

function formatHistoryTime(value: string, language: OutputLanguage) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(language === "en" ? "en-US" : "zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getRecordKind(record: HistoryRecord) {
  if (record.promptKind) return record.promptKind;
  if (record.action === "image-generate" || record.action === "image-refine") {
    return "image";
  }
  if (
    record.action === "screenwriting-generate" ||
    record.action === "screenwriting-optimize"
  ) {
    return "screenwriting";
  }
  return "video";
}

function getActionLabel(record: HistoryRecord, language: OutputLanguage) {
  if (language === "en") {
    if (record.action === "refine") return "Refinement";
    if (record.action === "image-generate") return "Image prompt";
    if (record.action === "image-refine") return "Image direction";
    if (record.action === "screenwriting-generate") return "Script generation";
    if (record.action === "screenwriting-optimize") return "Script revision";
    return "First generation";
  }

  if (record.action === "refine") return "继续指导";
  if (record.action === "image-generate") return "图片提示词";
  if (record.action === "image-refine") return "摄影指导";
  if (record.action === "screenwriting-generate") return "剧本生成";
  if (record.action === "screenwriting-optimize") return "剧本优化";
  return "首次生成";
}

function getKindLabel(record: HistoryRecord, language: OutputLanguage) {
  const kind = getRecordKind(record);
  if (language === "en") {
    if (kind === "image") return "Image prompt";
    if (kind === "screenwriting") {
      return record.action === "screenwriting-generate"
        ? "Generated script"
        : "Script revision";
    }
    return record.durationSeconds
      ? `${record.durationSeconds} sec`
      : "Video prompt";
  }

  if (kind === "image") return "图片提示词";
  if (kind === "screenwriting") {
    return record.action === "screenwriting-generate" ? "生成剧本" : "剧本优化";
  }
  return record.durationSeconds ? `${record.durationSeconds} 秒` : "视频提示词";
}

function getImportLabel(record: HistoryRecord, language: OutputLanguage) {
  if (language === "en") {
    return getRecordKind(record) === "screenwriting"
      ? "Send to Writer"
      : "Send to Director";
  }

  return getRecordKind(record) === "screenwriting" ? "导入编剧板" : "导入导演板";
}

const historyCopy = {
  zh: {
    title: "同一 IP 历史记录",
    intro: "同一网络/IP 下持续保留，刷新或关闭页面后仍可读取。",
    clearAll: "全部删除",
    refreshing: "刷新中...",
    refresh: "刷新记录",
    back: "返回",
    emptyTitle: "还没有历史记录",
    emptyIntro: "生成第一条提示词后，这里会自动出现记录。",
    deleteAria: "删除历史记录",
    userBrief: "USER BRIEF",
    generatedResult: "GENERATED RESULT · 点击展开/收起",
    copied: "已复制",
    copyFailed: "复制失败",
    copyPrompt: "复制提示词",
  },
  en: {
    title: "Same-IP History",
    intro: "Saved for the same network/IP and remains after refresh or reopening.",
    clearAll: "Clear all",
    refreshing: "Refreshing...",
    refresh: "Refresh",
    back: "Back to ",
    emptyTitle: "No history yet",
    emptyIntro: "Generate your first result and it will appear here.",
    deleteAria: "Delete history record",
    userBrief: "USER BRIEF",
    generatedResult: "GENERATED RESULT · click to expand/collapse",
    copied: "Copied",
    copyFailed: "Copy failed",
    copyPrompt: "Copy result",
  },
} as const;

export function HistoryPanel({
  records,
  loading,
  copiedId,
  copyErrorId,
  onBack,
  boardLabel = "Director",
  onRefresh,
  onUseRecord,
  onDeleteRecord,
  onClearRecords,
  onCopy,
  language,
}: HistoryPanelProps) {
  const copy = historyCopy[language];

  return (
    <section className="mx-auto min-h-[72vh] w-full max-w-[1120px] px-5 pb-24 pt-14 sm:px-8 sm:pb-32 sm:pt-20">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-3 flex items-center gap-3">
            <span className="text-[10px] font-semibold tracking-[0.22em] text-[#C68A4A]">
              SESSION HISTORY
            </span>
            <span className="h-px w-12 bg-[#C68A4A]/45" />
          </div>
          <h2 className="text-3xl font-semibold tracking-[-0.04em] text-[#1A2C26] sm:text-4xl">
            {copy.title}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#2B4A3F]/58">
            {copy.intro}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClearRecords}
            disabled={loading || records.length === 0}
            className="rounded-full border border-[#A84D3E]/14 bg-[#A84D3E]/7 px-4 py-2 text-xs font-semibold text-[#873B31] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#A84D3E]/10 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0"
          >
            {copy.clearAll}
          </button>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="rounded-full border border-[#1A2C26]/12 bg-white/22 px-4 py-2 text-xs font-semibold text-[#2B4A3F] transition-all duration-300 hover:-translate-y-0.5 hover:border-[#C68A4A]/45 hover:bg-white/42 disabled:cursor-wait disabled:opacity-45 disabled:hover:translate-y-0"
          >
            {loading ? copy.refreshing : copy.refresh}
          </button>
          <button
            type="button"
            onClick={onBack}
            className="rounded-full bg-[#1A2C26] px-4 py-2 text-xs font-semibold text-[#F4E8D4] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#2B4A3F]"
          >
            {copy.back}{boardLabel}
          </button>
        </div>
      </div>

      {records.length === 0 ? (
        <div className="glass-panel soft-shadow rounded-[28px] px-6 py-14 text-center">
          <p className="text-sm font-semibold text-[#1A2C26]">
            {copy.emptyTitle}
          </p>
          <p className="mt-2 text-xs leading-5 text-[#2B4A3F]/52">
            {copy.emptyIntro}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {records.map((record, index) => {
            const copyId = `history-${record.id}`;

            return (
              <article
                key={record.id}
                className="group relative glass-panel soft-shadow overflow-hidden rounded-[28px]"
              >
                <button
                  type="button"
                  onClick={() => onDeleteRecord(record.id)}
                  aria-label={copy.deleteAria}
                  className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-[#A84D3E]/14 bg-[#F8EFDF]/92 text-[#873B31] opacity-0 shadow-[0_10px_24px_rgba(26,44,38,0.13)] transition group-hover:opacity-100 hover:bg-white"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    className="h-4 w-4"
                  >
                    <path d="M4.6 6h10.8M8 6V4.4h4V6M6.2 6.2l.6 9.2c.1.8.7 1.3 1.5 1.3h3.4c.8 0 1.4-.5 1.5-1.3l.6-9.2M8.7 8.8v5M11.3 8.8v5" />
                  </svg>
                </button>
                <div className="flex flex-col gap-3 border-b border-[#1A2C26]/9 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
                  <div>
                    <p className="text-[10px] font-semibold tracking-[0.18em] text-[#2B4A3F]/55">
                      HISTORY #{records.length - index} ·{" "}
                      {getActionLabel(record, language)}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[#1A2C26]">
                      {formatHistoryTime(record.createdAt, language)} ·{" "}
                      {getKindLabel(record, language)} ·{" "}
                      {record.compilerStrategy ?? "controlled_cinematic_shot"}
                    </p>
                  </div>
                </div>

                <div className="grid gap-0 lg:grid-cols-[0.9fr_1.35fr]">
                  <div className="border-b border-[#1A2C26]/8 px-5 py-5 lg:border-r lg:border-b-0 sm:px-7">
                    <p className="text-[10px] font-semibold tracking-[0.16em] text-[#C68A4A]">
                      {copy.userBrief}
                    </p>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#1A2C26]/78">
                      {record.userIdea}
                    </p>
                  </div>

                  <details className="group px-5 py-5 sm:px-7" open={index === 0}>
                    <summary className="cursor-pointer list-none text-[10px] font-semibold tracking-[0.16em] text-[#C68A4A]">
                      {copy.generatedResult}
                    </summary>
                    <div className="mt-3 whitespace-pre-wrap text-[12px] leading-6 text-[#1A2C26]/78">
                      {record.promptText}
                    </div>
                  </details>
                </div>

                <div className="grid grid-cols-2 border-t border-[#F4E8D4]/12 bg-[#1A2C26] text-[#F4E8D4]">
                  <button
                    type="button"
                    onClick={() => onUseRecord(record)}
                    className="flex min-h-11 items-center justify-center border-r border-[#F4E8D4]/12 px-3 text-xs font-semibold transition-colors hover:bg-[#2B4A3F]"
                  >
                    {getImportLabel(record, language)}
                  </button>
                  <button
                    type="button"
                    onClick={() => onCopy(copyId, record.promptText)}
                    className="flex min-h-11 items-center justify-center px-3 text-xs font-semibold transition-colors hover:bg-[#2B4A3F]"
                  >
                    {copiedId === copyId
                      ? copy.copied
                      : copyErrorId === copyId
                        ? copy.copyFailed
                        : copy.copyPrompt}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
