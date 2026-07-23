import type {
  ApiConfig,
  ApiConnectionSource,
  ApiStatus,
  OutputLanguage,
} from "@/types";

type ApiPanelProps = {
  open: boolean;
  config: ApiConfig;
  status: ApiStatus;
  source: ApiConnectionSource | null;
  error: string | null;
  hasSavedConfig: boolean;
  saveFeedback: boolean;
  onToggle: () => void;
  onChange: (field: keyof ApiConfig, value: string) => void;
  onFillSaved: () => void;
  onSave: () => void;
  onTest: () => void;
  demoMode?: boolean;
  language: OutputLanguage;
};

function PlugIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      className="h-5 w-5"
    >
      <path d="M8 3v4M16 3v4M6 7h12v3a6 6 0 0 1-6 6v0a6 6 0 0 1-6-6V7Z" />
      <path d="M12 16v5M9 21h6" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      className={`h-4 w-4 transition-transform duration-300 ${
        open ? "rotate-0" : "rotate-180"
      }`}
    >
      <path d="m5 12 5-5 5 5" />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      className="h-3.5 w-3.5"
    >
      <path d="M4 3.5h9l3 3V16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" />
      <path d="M6 3.5V8h7V3.5M6.5 17v-5h7v5" />
    </svg>
  );
}

const apiPanelCopy = {
  zh: {
    status: {
      idle: "API 未连接",
      testing: "正在连接内置模型",
      connected: "API 已连接",
      failed: "API 连接失败",
      aiConnected: "AI 已连接",
    },
    viewAiStatus: "查看 AI 连接状态",
    expandApi: "展开 API 配置",
    collapseAi: "收起 AI 状态",
    collapseApi: "收起 API 配置",
    backendModel: "后台 AI 模型",
    apiAccess: "API 接入",
    demoNote: "Demo 版由服务端统一接入模型，前端不保存或填写 API。",
    modelName: "模型名称",
    modelPlaceholder: "例如：gemini-3.5-flash",
    apiKeyPlaceholder: "请输入 API Key",
    requestUrl: "请求地址",
    fillSaved: "填入已保存 API",
    saved: "已保存",
    saveApi: "保存 API",
    connecting: "连接中...",
    testCustom: "测试此 API",
    testBuiltin: "测试内置 API",
    customNote: "当前使用自定义服务；保存内容仅存于本机浏览器。",
    builtinNote: "内置 API 已由服务端安全接入，打开产品即可直接使用。",
  },
  en: {
    status: {
      idle: "API not connected",
      testing: "Connecting hosted model",
      connected: "API connected",
      failed: "API connection failed",
      aiConnected: "AI connected",
    },
    viewAiStatus: "View AI connection status",
    expandApi: "Open API settings",
    collapseAi: "Collapse AI status",
    collapseApi: "Collapse API settings",
    backendModel: "Hosted AI model",
    apiAccess: "API access",
    demoNote:
      "The demo uses a server-side model connection. No API key is stored or entered in the browser.",
    modelName: "Model name",
    modelPlaceholder: "Example: gemini-3.5-flash",
    apiKeyPlaceholder: "Enter API key",
    requestUrl: "Request URL",
    fillSaved: "Use saved API",
    saved: "Saved",
    saveApi: "Save API",
    connecting: "Connecting...",
    testCustom: "Test this API",
    testBuiltin: "Test hosted API",
    customNote:
      "Custom service is active; saved settings stay only in this browser.",
    builtinNote:
      "Hosted API is connected securely on the server. Open the product and use it directly.",
  },
} as const;

const statusBadge: Record<ApiStatus, { dotClass: string; badge: string }> = {
  idle: { dotClass: "bg-[#A84D3E]", badge: "OFFLINE" },
  testing: { dotClass: "bg-[#C68A4A] status-pulse", badge: "CONNECTING" },
  connected: { dotClass: "bg-[#4F7B61]", badge: "READY" },
  failed: { dotClass: "bg-[#A84D3E]", badge: "FAILED" },
};

export function ApiPanel({
  open,
  config,
  status,
  source,
  error,
  hasSavedConfig,
  saveFeedback,
  onToggle,
  onChange,
  onFillSaved,
  onSave,
  onTest,
  demoMode = false,
  language,
}: ApiPanelProps) {
  const copy = apiPanelCopy[language];
  const currentStatus = {
    ...statusBadge[status],
    label: copy.status[status],
  };
  const hasCustomInput = Boolean(
    config.modelName || config.apiKey || config.requestUrl,
  );
  const customConfigComplete = Boolean(
    config.modelName.trim() &&
      config.apiKey.trim() &&
      config.requestUrl.trim(),
  );

  if (!open) {
    return (
      <div className="api-panel">
        <button
          type="button"
          onClick={onToggle}
          aria-label={demoMode ? copy.viewAiStatus : copy.expandApi}
          className="group flex h-12 items-center gap-2 rounded-full border border-[#1A2C26]/15 bg-[#1A2C26] px-4 text-[#F4E8D4] shadow-[0_14px_38px_rgba(26,44,38,0.24)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#2B4A3F]"
        >
          <span className="relative">
            <PlugIcon />
            <span
              className={`absolute -right-1 -top-1 h-2 w-2 rounded-full ring-2 ring-[#1A2C26] ${currentStatus.dotClass}`}
            />
          </span>
          <span className="text-[11px] font-semibold tracking-[0.16em]">
            {demoMode ? "AI" : "API"}
          </span>
        </button>
      </div>
    );
  }

  if (demoMode) {
    return (
      <aside className="api-panel">
        <div className="api-panel-card glass-panel relative overflow-hidden rounded-[24px]">
          <div className="flex items-center justify-between border-b border-[#1A2C26]/10 px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1A2C26] text-[#F4E8D4]">
                <PlugIcon />
              </span>
              <div>
                <p className="text-[10px] font-semibold tracking-[0.2em] text-[#2B4A3F]/55">
                  MODEL GATEWAY
                </p>
              <p className="mt-0.5 text-sm font-semibold text-[#1A2C26]">
                  {copy.backendModel}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onToggle}
              aria-label={copy.collapseAi}
              title={copy.collapseAi}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-[#1A2C26]/10 text-[#1A2C26]/65 transition-all duration-300 hover:border-[#C68A4A]/50 hover:bg-white/35 hover:text-[#1A2C26]"
            >
              <ChevronIcon open={open} />
            </button>
          </div>

          <div className="px-5 pb-5 pt-4">
            <div className="flex items-center justify-between rounded-xl bg-[#2B4A3F]/8 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${currentStatus.dotClass}`}
                />
                <span className="text-xs font-medium text-[#1A2C26]">
                  {status === "connected"
                    ? copy.status.aiConnected
                    : currentStatus.label}
                </span>
              </div>
              <span className="rounded-full border border-[#C68A4A]/25 bg-[#C68A4A]/10 px-2 py-1 text-[9px] font-bold tracking-[0.12em] text-[#9A632D]">
                {currentStatus.badge}
              </span>
            </div>

            {error ? (
              <p className="mt-3 rounded-xl border border-[#A84D3E]/18 bg-[#A84D3E]/8 px-3 py-2 text-[10px] leading-4 text-[#873B31]">
                {error}
              </p>
            ) : null}

            <div className="mt-4 flex items-start gap-2 border-t border-[#1A2C26]/8 pt-3">
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#C68A4A]"
              >
                <path d="M6.5 9V6.7a3.5 3.5 0 0 1 7 0V9" />
                <rect x="4.5" y="9" width="11" height="7.5" rx="2" />
              </svg>
              <p className="text-[10px] leading-4 text-[#2B4A3F]/55">
                {copy.demoNote}
              </p>
            </div>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="api-panel">
      <div className="api-panel-card glass-panel relative overflow-hidden rounded-[24px]">
          <div className="flex items-center justify-between border-b border-[#1A2C26]/10 px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1A2C26] text-[#F4E8D4]">
                <PlugIcon />
              </span>
              <div>
                <p className="text-[10px] font-semibold tracking-[0.2em] text-[#2B4A3F]/55">
                  MODEL GATEWAY
                </p>
                <p className="mt-0.5 text-sm font-semibold text-[#1A2C26]">
                  {copy.apiAccess}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onToggle}
              aria-label={copy.collapseApi}
              title={copy.collapseApi}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-[#1A2C26]/10 text-[#1A2C26]/65 transition-all duration-300 hover:border-[#C68A4A]/50 hover:bg-white/35 hover:text-[#1A2C26]"
            >
              <ChevronIcon open={open} />
            </button>
          </div>

          <div className="px-5 pb-5 pt-4">
            <div className="mb-4 flex items-center justify-between rounded-xl bg-[#2B4A3F]/8 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${currentStatus.dotClass}`}
                />
                <span className="text-xs font-medium text-[#1A2C26]">
                  {currentStatus.label}
                </span>
              </div>
              <span className="rounded-full border border-[#C68A4A]/25 bg-[#C68A4A]/10 px-2 py-1 text-[9px] font-bold tracking-[0.12em] text-[#9A632D]">
                {currentStatus.badge}
              </span>
            </div>

            <div className="space-y-3">
              <label className="block">
                <span className="mb-1.5 block text-[10px] font-semibold tracking-[0.12em] text-[#2B4A3F]/60">
                  {copy.modelName}
                </span>
                <input
                  className="panel-field h-10 w-full rounded-xl border border-[#1A2C26]/12 bg-white/30 px-3 text-xs text-[#1A2C26]"
                  value={config.modelName}
                  onChange={(event) => onChange("modelName", event.target.value)}
                  placeholder={copy.modelPlaceholder}
                  aria-label={copy.modelName}
                  autoComplete="off"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[10px] font-semibold tracking-[0.12em] text-[#2B4A3F]/60">
                  API KEY
                </span>
                <input
                  className="panel-field h-10 w-full rounded-xl border border-[#1A2C26]/12 bg-white/30 px-3 text-xs tracking-[0.08em] text-[#1A2C26]"
                  type="password"
                  value={config.apiKey}
                  onChange={(event) => onChange("apiKey", event.target.value)}
                  placeholder={copy.apiKeyPlaceholder}
                  aria-label="API Key"
                  autoComplete="new-password"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[10px] font-semibold tracking-[0.12em] text-[#2B4A3F]/60">
                  {copy.requestUrl}
                </span>
                <input
                  className="panel-field h-10 w-full rounded-xl border border-[#1A2C26]/12 bg-white/30 px-3 text-xs text-[#1A2C26]"
                  value={config.requestUrl}
                  onChange={(event) => onChange("requestUrl", event.target.value)}
                  placeholder="https://api.example.com/v1/chat/completions"
                  aria-label={copy.requestUrl}
                  autoComplete="off"
                />
              </label>
            </div>

            {hasSavedConfig ? (
              <button
                type="button"
                onClick={onFillSaved}
                className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#4F7B61]/18 bg-[#4F7B61]/8 text-xs font-semibold text-[#2B4A3F] transition-all duration-300 hover:-translate-y-0.5 hover:border-[#C68A4A]/45 hover:bg-[#4F7B61]/13"
              >
                <SaveIcon />
                {copy.fillSaved}
              </button>
            ) : null}

            {error ? (
              <p className="mt-3 rounded-xl border border-[#A84D3E]/18 bg-[#A84D3E]/8 px-3 py-2 text-[10px] leading-4 text-[#873B31]">
                {error}
              </p>
            ) : null}

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onSave}
                disabled={!customConfigComplete}
                className="flex h-10 items-center justify-center gap-2 rounded-xl border border-[#1A2C26]/14 bg-white/25 text-xs font-semibold text-[#1A2C26] transition-all duration-300 hover:-translate-y-0.5 hover:border-[#C68A4A]/45 hover:bg-white/45 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:translate-y-0"
              >
                <SaveIcon />
                {saveFeedback ? copy.saved : copy.saveApi}
              </button>
              <button
                type="button"
                onClick={onTest}
                disabled={status === "testing"}
                className="flex h-10 items-center justify-center rounded-xl bg-[#1A2C26] text-xs font-semibold text-[#F4E8D4] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#2B4A3F] disabled:cursor-wait disabled:opacity-55"
              >
                {status === "testing"
                  ? copy.connecting
                  : hasCustomInput
                    ? copy.testCustom
                    : copy.testBuiltin}
              </button>
            </div>

            <div className="mt-4 flex items-start gap-2 border-t border-[#1A2C26]/8 pt-3">
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#C68A4A]"
              >
                <path d="M6.5 9V6.7a3.5 3.5 0 0 1 7 0V9" />
                <rect x="4.5" y="9" width="11" height="7.5" rx="2" />
              </svg>
              <p className="text-[10px] leading-4 text-[#2B4A3F]/55">
                {source === "custom"
                  ? copy.customNote
                  : copy.builtinNote}
              </p>
            </div>
          </div>

        </div>
    </aside>
  );
}
