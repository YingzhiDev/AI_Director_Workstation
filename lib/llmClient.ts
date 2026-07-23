import { existsSync, readFileSync } from "node:fs";
import https from "node:https";
import type { IncomingHttpHeaders } from "node:http";
import path from "node:path";
import type { ApiConfig, ApiConnectionSource } from "@/types";
import { shouldAllowCustomApiConfig } from "@/lib/demoMode";
import {
  assertValidRequestUrl,
  isApiConfigComplete,
  isApiConfigEmpty,
} from "@/lib/validation";

type ResolvedApiConfig = ApiConfig & {
  source: ApiConnectionSource;
  fallbackModelNames?: string[];
};

type ChatMessageContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    >;

type ChatMessage = {
  role: "system" | "user";
  content: ChatMessageContent;
};

type CompletionOptions = {
  config: ResolvedApiConfig;
  messages: ChatMessage[];
  maxTokens: number;
  timeoutMs: number;
  requireContent?: boolean;
  signal?: AbortSignal;
  temperature?: number;
};

type StreamCompletionOptions = CompletionOptions & {
  onDelta: (delta: string) => void;
};

type ChatCompletionPayload = {
  choices?: Array<{
    delta?: {
      content?: string | Array<{ type?: string; text?: string }>;
      reasoning_content?: string;
    };
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
      reasoning_content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

export class LlmClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmClientError";
  }
}

const RETRY_DELAYS_MS = [900, 1_800, 3_200];
const BUILT_IN_FALLBACK_MAX_ROUNDS = 2;
const BUILT_IN_FALLBACK_RETRY_DELAY_MS = 1_500;
const BUILT_IN_FALLBACK_RETRY_WINDOW_MS = 75_000;
const DEFAULT_BUILT_IN_FALLBACK_MODEL_NAMES: string[] = [];

type LocalLlmApiConfig = {
  apiKey: string;
  modelNames: string[];
  requestUrl: string;
};

function getLocalLlmApiFileCandidates() {
  const explicitPath = process.env.LLM_API_FILE?.trim();
  const cwd = process.cwd();

  return Array.from(
    new Set(
      [
        explicitPath,
        path.join(cwd, "LLM_API.txt"),
        path.resolve(cwd, "..", "LLM_API.txt"),
      ].filter((candidate): candidate is string => Boolean(candidate)),
    ),
  );
}

function extractLabelValue(section: string, labelPattern: string) {
  return section
    .match(new RegExp(`${labelPattern}[：:]\\s*([^\\r\\n]+)`, "iu"))?.[1]
    ?.trim();
}

function parseTokenPlanConfig(text: string): LocalLlmApiConfig | null {
  const markers = Array.from(
    text.matchAll(/接入应用[：:]\s*TokenPlan/giu),
  );
  const marker = markers.at(-1);
  if (!marker || marker.index === undefined) return null;

  const markerEnd = marker.index + marker[0].length;
  const remainder = text.slice(markerEnd);
  const nextSection = remainder.match(/\r?\n\s*接入应用[：:]/u);
  const sectionEnd =
    nextSection?.index === undefined
      ? text.length
      : markerEnd + nextSection.index;
  const section = text.slice(marker.index, sectionEnd);

  const apiKey = extractLabelValue(section, "APP\\s*key");
  const requestUrl =
    extractLabelValue(
      section,
      "Base\\s*URL\\s*[（(]\\s*文本\\s*[)）]",
    ) ?? extractLabelValue(section, "标准模型请求地址");
  const modelMarker = section.match(/Model\s*ID[：:]\s*/iu);

  if (!apiKey || !requestUrl || !modelMarker || modelMarker.index === undefined) {
    return null;
  }

  const modelBlockStart = modelMarker.index + modelMarker[0].length;
  const modelRemainder = section.slice(modelBlockStart);
  const nextLabel = modelRemainder.match(
    /^\s*[^：:\r\n]{1,80}[：:]/mu,
  );
  const modelBlock =
    nextLabel?.index === undefined
      ? modelRemainder
      : modelRemainder.slice(0, nextLabel.index);
  const modelNames = dedupeModelNames(
    modelBlock
      .split(/\r?\n/u)
      .map((modelName) => modelName.trim())
      .filter((modelName) =>
        /^[A-Za-z0-9][A-Za-z0-9._/-]{0,127}$/u.test(modelName),
      ),
  );

  if (!modelNames.length) return null;

  return { apiKey, modelNames, requestUrl };
}

function readLocalLlmApiConfig() {
  for (const candidate of getLocalLlmApiFileCandidates()) {
    if (!existsSync(candidate)) continue;

    try {
      const config = parseTokenPlanConfig(readFileSync(candidate, "utf8"));
      if (config) return config;
    } catch {
      // Continue to the next safe local candidate, then report one generic
      // configuration error if no usable source can be resolved.
    }
  }

  return null;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class ModelRequestTimeoutError extends Error {
  constructor() {
    super("Model request timed out");
    this.name = "TimeoutError";
  }
}

function isTimeoutLikeError(error: unknown) {
  if (!(error instanceof Error)) return false;

  return (
    error.name === "TimeoutError" ||
    error.name === "AbortError" ||
    /aborted|timeout|timed out/iu.test(error.message)
  );
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs: number,
  signal?: AbortSignal,
) {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const abortFromCaller = () => controller.abort();

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(new ModelRequestTimeoutError());
    }, timeoutMs);
  });

  try {
    if (signal?.aborted) {
      controller.abort();
      throw new ModelRequestTimeoutError();
    }

    signal?.addEventListener("abort", abortFromCaller, { once: true });

    return await Promise.race([
      fetch(input, { ...init, signal: controller.signal }),
      timeoutPromise,
    ]);
  } catch (error) {
    if (controller.signal.aborted || isTimeoutLikeError(error)) {
      throw new ModelRequestTimeoutError();
    }

    throw error;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    signal?.removeEventListener("abort", abortFromCaller);
  }
}

function buildResponseHeaders(headers: IncomingHttpHeaders) {
  const responseHeaders = new Headers();

  for (const [key, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      value.forEach((item) => responseHeaders.append(key, item));
      continue;
    }

    if (value !== undefined) {
      responseHeaders.set(key, String(value));
    }
  }

  return responseHeaders;
}

function fetchWithNodeHttps(
  input: string,
  init: RequestInit,
  timeoutMs: number,
  streamResponse = false,
  signal?: AbortSignal,
) {
  const url = new URL(input);

  if (url.protocol !== "https:") {
    return fetchWithTimeout(input, init, timeoutMs, signal);
  }

  return new Promise<Response>((resolve, reject) => {
    const body = typeof init.body === "string" ? init.body : undefined;
    let settled = false;
    const request = https.request(
      url,
      {
        family: 4,
        headers: init.headers as Record<string, string>,
        method: init.method ?? "GET",
        timeout: timeoutMs,
      },
      (response) => {
        if (streamResponse) {
          const stream = new ReadableStream<Uint8Array>({
            start(controller) {
              response.on("data", (chunk: Buffer | string) => {
                controller.enqueue(
                  Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk),
                );
              });
              response.on("end", () => controller.close());
              response.on("error", (error) => controller.error(error));
            },
            cancel() {
              request.destroy();
            },
          });

          settled = true;
          resolve(
            new Response(stream, {
              headers: buildResponseHeaders(response.headers),
              status: response.statusCode ?? 502,
              statusText: response.statusMessage,
            }),
          );
          return;
        }

        const chunks: Buffer[] = [];

        response.on("data", (chunk: Buffer | string) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        response.on("end", () => {
          settled = true;
          resolve(
            new Response(Buffer.concat(chunks), {
              headers: buildResponseHeaders(response.headers),
              status: response.statusCode ?? 502,
              statusText: response.statusMessage,
            }),
          );
        });
      },
    );
    const abortFromCaller = () => {
      request.destroy(new ModelRequestTimeoutError());
    };

    request.on("timeout", () => {
      request.destroy(new ModelRequestTimeoutError());
    });
    request.on("error", (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    });
    request.on("close", () => {
      signal?.removeEventListener("abort", abortFromCaller);
    });
    if (signal?.aborted) {
      request.destroy(new ModelRequestTimeoutError());
    } else {
      signal?.addEventListener("abort", abortFromCaller, { once: true });
    }

    if (body) request.write(body);
    request.end();
  });
}

function shouldUseNodeHttpsTransport(config: ResolvedApiConfig) {
  const transport = process.env.LLM_HTTP_TRANSPORT?.trim().toLowerCase();

  if (transport) return transport === "node-https";

  return config.source === "built-in";
}

function describeTransportFailure(error: unknown) {
  if (!(error instanceof Error)) {
    return { name: "UnknownError" };
  }

  const cause = (error as Error & { cause?: unknown }).cause;
  const causeCode =
    cause &&
    typeof cause === "object" &&
    "code" in cause &&
    typeof (cause as { code?: unknown }).code === "string"
      ? (cause as { code: string }).code
      : undefined;

  return {
    name: error.name,
    message: error.message.slice(0, 240),
    ...(cause instanceof Error
      ? {
          causeName: cause.name,
          causeMessage: cause.message.slice(0, 240),
        }
      : {}),
    ...(causeCode ? { causeCode } : {}),
  };
}

async function fetchModelEndpoint(
  config: ResolvedApiConfig,
  init: RequestInit,
  timeoutMs: number,
  streamResponse = false,
  signal?: AbortSignal,
) {
  const useNodeHttps = shouldUseNodeHttpsTransport(config);

  try {
    if (useNodeHttps) {
      return await fetchWithNodeHttps(
        config.requestUrl,
        init,
        timeoutMs,
        streamResponse,
        signal,
      );
    }

    return await fetchWithTimeout(config.requestUrl, init, timeoutMs, signal);
  } catch (error) {
    console.warn("[llm] upstream transport failure", {
      transport: useNodeHttps ? "node-https-ipv4" : "fetch",
      ...describeTransportFailure(error),
    });
    throw error;
  }
}

function getConnectionErrorMessage(error: unknown) {
  if (isTimeoutLikeError(error)) {
    return "The model request timed out. Please try again.";
  }

  return "Unable to connect to the model service. Check the network and request URL.";
}

function shouldRetryStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function buildRequestBody({
  config,
  messages,
  maxTokens,
  temperature,
  stream,
}: {
  config: ResolvedApiConfig;
  messages: ChatMessage[];
  maxTokens: number;
  temperature: number;
  stream?: boolean;
}) {
  const shouldDisableThinking = /\bglm\b|qwen/iu.test(config.modelName);
  const payload = {
    model: config.modelName,
    messages,
    max_tokens: maxTokens,
    temperature,
    ...(stream ? { stream: true } : {}),
    ...(shouldDisableThinking ? { thinking: { type: "disabled" } } : {}),
  };

  return JSON.stringify(payload);
}

function parseModelNames(value: string | undefined) {
  return (
    value
      ?.split(/[,，\s]+/u)
      .map((modelName) => modelName.trim())
      .filter(Boolean) ?? []
  );
}

function dedupeModelNames(modelNames: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const modelName of modelNames) {
    const key = modelName.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    result.push(modelName);
  }

  return result;
}

function getBuiltInFallbackModelNames(primaryModelName: string) {
  const configuredFallbacks = parseModelNames(
    process.env.LLM_FALLBACK_MODEL_NAMES ??
      process.env.LLM_MODEL_FALLBACKS,
  );
  const fallbackModelNames = configuredFallbacks.length
    ? configuredFallbacks
    : DEFAULT_BUILT_IN_FALLBACK_MODEL_NAMES;

  return dedupeModelNames([primaryModelName, ...fallbackModelNames]).slice(1);
}

export function getConfiguredModelNames(config: ResolvedApiConfig) {
  return dedupeModelNames([
    config.modelName,
    ...(config.source === "built-in" ? config.fallbackModelNames ?? [] : []),
  ]);
}

function getModelAttemptConfigs(config: ResolvedApiConfig) {
  return getConfiguredModelNames(config).map((modelName) => ({
    ...config,
    modelName,
    fallbackModelNames: [],
  }));
}

function formatAttemptFailure(config: ResolvedApiConfig, error: unknown) {
  const message =
    error instanceof Error ? error.message : "Unknown model-service error";
  return `${config.modelName}: ${message}`;
}

function isTransientBuiltInModelError(error: unknown) {
  if (!(error instanceof LlmClientError)) return false;

  return /Unable to connect to the model service|model request timed out|Model service returned HTTP (?:408|425|429|5\d{2})/iu.test(
    error.message,
  );
}

async function withModelFallback<T>(
  config: ResolvedApiConfig,
  execute: (attemptConfig: ResolvedApiConfig) => Promise<T>,
) {
  const attemptConfigs = getModelAttemptConfigs(config);
  const failures: string[] = [];
  const errors: unknown[] = [];
  const startedAt = Date.now();
  const maxRounds =
    config.source === "built-in" ? BUILT_IN_FALLBACK_MAX_ROUNDS : 1;

  for (let round = 0; round < maxRounds; round += 1) {
    const roundErrors: unknown[] = [];

    for (let index = 0; index < attemptConfigs.length; index += 1) {
      const attemptConfig = attemptConfigs[index];

      try {
        return await execute(attemptConfig);
      } catch (error) {
        if (error instanceof LlmClientError && error.message === "Generation canceled.") {
          throw error;
        }

        const failure = formatAttemptFailure(attemptConfig, error);
        failures.push(failure);
        errors.push(error);
        roundErrors.push(error);

        if (index < attemptConfigs.length - 1) {
          console.warn(`[llm] ${failure}; trying next configured model`);
        }
      }
    }

    const canRetryRound =
      round < maxRounds - 1 &&
      Date.now() - startedAt < BUILT_IN_FALLBACK_RETRY_WINDOW_MS &&
      roundErrors.length === attemptConfigs.length &&
      roundErrors.every(isTransientBuiltInModelError);

    if (!canRetryRound) break;

    console.warn(
      "[llm] all configured models had transient connection failures; retrying the model chain once",
    );
    await wait(BUILT_IN_FALLBACK_RETRY_DELAY_MS);
  }

  const lastError = errors.at(-1);

  if (failures.length <= 1 && lastError) {
    throw lastError;
  }

  throw new LlmClientError(
    `The model request failed after trying ${attemptConfigs
      .map((item) => item.modelName)
      .join(", ")}. Last error: ${
      lastError instanceof Error ? lastError.message : "Unknown model-service error"
    }`,
  );
}

async function fetchWithRetries({
  config,
  messages,
  maxTokens,
  timeoutMs,
  temperature,
  stream,
  signal,
}: {
  config: ResolvedApiConfig;
  messages: ChatMessage[];
  maxTokens: number;
  timeoutMs: number;
  temperature: number;
  stream?: boolean;
  signal?: AbortSignal;
}) {
  let lastConnectionMessage =
    "Unable to connect to the model service. Check the network and request URL.";
  let lastResponseText = "";
  let lastStatus = 0;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    let response: Response;

    try {
      if (signal?.aborted) {
        throw new ModelRequestTimeoutError();
      }

      response = await fetchModelEndpoint(
        config,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            "Content-Type": "application/json",
          },
          body: buildRequestBody({
            config,
            messages,
            maxTokens,
            temperature,
            stream,
          }),
          cache: "no-store",
        },
        timeoutMs,
        Boolean(stream),
        signal,
      );
    } catch (error) {
      lastConnectionMessage = getConnectionErrorMessage(error);

      const isTimeoutError = isTimeoutLikeError(error);

      if (!isTimeoutError && attempt < RETRY_DELAYS_MS.length) {
        if (signal?.aborted) throw new LlmClientError("Generation canceled.");
        await wait(RETRY_DELAYS_MS[attempt]);
        continue;
      }

      if (signal?.aborted) throw new LlmClientError("Generation canceled.");

      throw new LlmClientError(lastConnectionMessage);
    }

    if (response.ok) return response;

    lastStatus = response.status;
    lastResponseText = await response.text();

    if (shouldRetryStatus(response.status) && attempt < RETRY_DELAYS_MS.length) {
      if (signal?.aborted) throw new LlmClientError("Generation canceled.");
      await wait(RETRY_DELAYS_MS[attempt]);
      continue;
    }

    const upstreamMessage = extractErrorMessage(lastResponseText);
    throw new LlmClientError(
      upstreamMessage
        ? `Model service error: ${upstreamMessage}`
        : `Model service returned HTTP ${response.status}`,
    );
  }

  const upstreamMessage = extractErrorMessage(lastResponseText);
  throw new LlmClientError(
    upstreamMessage
      ? `Model service error: ${upstreamMessage}`
      : lastStatus
      ? `Model service returned HTTP ${lastStatus}`
      : lastConnectionMessage,
  );
}

function normalizeRequestUrl(requestUrl: string) {
  const checkedUrl = assertValidRequestUrl(requestUrl);
  const url = new URL(checkedUrl);

  if (!/\/chat\/completions\/?$/u.test(url.pathname)) {
    const basePath = url.pathname.replace(/\/+$/u, "");
    url.pathname = `${basePath}/v1/chat/completions`.replace(
      /\/{2,}/gu,
      "/",
    );
  }

  return url.toString();
}

export function resolveApiConfig(config: ApiConfig): ResolvedApiConfig {
  const allowCustomApiConfig = shouldAllowCustomApiConfig();

  if (
    allowCustomApiConfig &&
    !isApiConfigEmpty(config) &&
    !isApiConfigComplete(config)
  ) {
    throw new LlmClientError("Complete all three custom API fields.");
  }

  if (allowCustomApiConfig && isApiConfigComplete(config)) {
    return {
      modelName: config.modelName.trim(),
      apiKey: config.apiKey.trim(),
      requestUrl: normalizeRequestUrl(config.requestUrl.trim()),
      source: "custom",
    };
  }

  const modelName = process.env.LLM_MODEL_NAME?.trim();
  const apiKey = process.env.LLM_API_KEY?.trim();
  const requestUrl = process.env.LLM_REQUEST_URL?.trim();

  if (modelName && apiKey && requestUrl) {
    return {
      modelName,
      apiKey,
      requestUrl: normalizeRequestUrl(requestUrl),
      source: "built-in",
      fallbackModelNames: getBuiltInFallbackModelNames(modelName),
    };
  }

  const localConfig = readLocalLlmApiConfig();
  if (localConfig) {
    const [localModelName, ...localFallbackModelNames] =
      localConfig.modelNames;

    return {
      modelName: localModelName,
      apiKey: localConfig.apiKey,
      requestUrl: normalizeRequestUrl(localConfig.requestUrl),
      source: "built-in",
      fallbackModelNames: dedupeModelNames([
        ...localFallbackModelNames,
        ...getBuiltInFallbackModelNames(localModelName),
      ]),
    };
  }

  throw new LlmClientError(
    "The hosted model is not configured. Provide LLM_MODEL_NAME, LLM_API_KEY, and LLM_REQUEST_URL, or a readable LLM_API.txt file.",
  );
}

function extractErrorMessage(rawText: string) {
  try {
    const payload = JSON.parse(rawText) as ChatCompletionPayload;
    return payload.error?.message?.slice(0, 240);
  } catch {
    return undefined;
  }
}

function extractContent(payload: ChatCompletionPayload) {
  const content = payload.choices?.[0]?.message?.content;

  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => part.text ?? "")
      .join("")
      .trim();
  }

  return "";
}

function stringifyContent(
  content?: string | Array<{ type?: string; text?: string }>,
) {
  if (typeof content === "string") return content;

  if (Array.isArray(content)) {
    return content.map((part) => part.text ?? "").join("");
  }

  return "";
}

function extractDelta(payload: ChatCompletionPayload) {
  return stringifyContent(payload.choices?.[0]?.delta?.content);
}

function emitChunkedText(text: string, onDelta: (delta: string) => void) {
  const cleanText = text.trim();
  const chunkSize = Math.max(10, Math.ceil(cleanText.length / 240));

  for (let index = 0; index < cleanText.length; index += chunkSize) {
    onDelta(cleanText.slice(index, index + chunkSize));
  }
}

export async function requestChatCompletion({
  config,
  messages,
  maxTokens,
  timeoutMs,
  requireContent = true,
  signal,
  temperature = 0.65,
}: CompletionOptions) {
  return withModelFallback(config, async (attemptConfig) => {
    const response = await fetchWithRetries({
      config: attemptConfig,
      messages,
      maxTokens,
      timeoutMs,
      temperature,
      signal,
    });

    const rawText = await response.text();

    let payload: ChatCompletionPayload;

    try {
      payload = JSON.parse(rawText) as ChatCompletionPayload;
    } catch {
      throw new LlmClientError("The model service returned unparseable data.");
    }

    if (!requireContent) {
      return "";
    }

    const content = extractContent(payload);

    if (!content) {
      throw new LlmClientError("The model connected but returned no usable result.");
    }

    return content;
  });
}

export async function requestChatCompletionStream({
  config,
  messages,
  maxTokens,
  timeoutMs,
  requireContent = true,
  signal,
  temperature = 0.65,
  onDelta,
}: StreamCompletionOptions) {
  return withModelFallback(config, async (attemptConfig) => {
    const response = await fetchWithRetries({
      config: attemptConfig,
      messages,
      maxTokens,
      timeoutMs,
      temperature,
      stream: true,
      signal,
    });

    if (!response.body) {
      throw new LlmClientError("The model service returned no readable stream.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let content = "";
    let sawStreamEvent = false;

    function handleDataPayload(rawData: string) {
      const data = rawData.trim();
      if (!data || data === "[DONE]") return;

      try {
        const payload = JSON.parse(data) as ChatCompletionPayload;
        const delta = extractDelta(payload);

        if (delta) {
          content += delta;
          onDelta(delta);
          return;
        }

        const finalContent = extractContent(payload);
        if (finalContent) {
          content += finalContent;
          emitChunkedText(finalContent, onDelta);
        }
      } catch {
        // Keep buffering. Some providers split JSON in unusual places.
      }
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      if (buffer.includes("data:")) {
        sawStreamEvent = true;
        const events = buffer.split(/\n\n|\r\n\r\n/u);
        buffer = events.pop() ?? "";

        for (const event of events) {
          const dataLines = event
            .split(/\r?\n/u)
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.replace(/^data:\s?/u, ""));

          for (const dataLine of dataLines) {
            handleDataPayload(dataLine);
          }
        }
      }
    }

    buffer += decoder.decode();

    if (sawStreamEvent && buffer.includes("data:")) {
      const dataLines = buffer
        .split(/\r?\n/u)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.replace(/^data:\s?/u, ""));

      for (const dataLine of dataLines) {
        handleDataPayload(dataLine);
      }
    } else if (!sawStreamEvent && buffer.trim()) {
      try {
        const payload = JSON.parse(buffer) as ChatCompletionPayload;
        content = extractContent(payload);
        if (content) emitChunkedText(content, onDelta);
      } catch {
        throw new LlmClientError("The model service returned an unparseable stream.");
      }
    }

    const finalContent = content.trim();

    if (requireContent && !finalContent) {
      throw new LlmClientError("The model connected but returned no usable result.");
    }

    return finalContent;
  });
}
