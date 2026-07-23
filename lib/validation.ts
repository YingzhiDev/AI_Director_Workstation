import type { ApiConfig } from "@/types";

export function isApiConfigEmpty(config: ApiConfig) {
  return !config.modelName.trim() && !config.apiKey.trim() && !config.requestUrl.trim();
}

export function isApiConfigComplete(config: ApiConfig) {
  return Boolean(
    config.modelName.trim() && config.apiKey.trim() && config.requestUrl.trim(),
  );
}

export function assertValidRequestUrl(requestUrl: string) {
  let url: URL;

  try {
    url = new URL(requestUrl);
  } catch {
    throw new Error("The request URL is invalid.");
  }

  const isLocalDevelopment =
    url.hostname === "localhost" || url.hostname === "127.0.0.1";

  if (url.protocol !== "https:" && !(isLocalDevelopment && url.protocol === "http:")) {
    throw new Error("The request URL must use HTTPS.");
  }

  return url.toString();
}
