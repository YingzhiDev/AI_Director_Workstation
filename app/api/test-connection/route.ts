

import {
  getConfiguredModelNames,
  LlmClientError,
  requestChatCompletion,
  resolveApiConfig,
} from "@/lib/llmClient";
import type { ApiConfig } from "@/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { apiConfig?: ApiConfig };
    const config = resolveApiConfig(
      body.apiConfig ?? { modelName: "", apiKey: "", requestUrl: "" },
    );

    await requestChatCompletion({
      config,
      messages: [
        {
          role: "user",
          content: "This is a connectivity test. Reply with OK only.",
        },
      ],
      maxTokens: 16,
      timeoutMs: 20_000,
      requireContent: false,
    });

    return Response.json({
      connected: true,
      source: config.source,
      modelName: config.modelName,
      modelNames: getConfiguredModelNames(config),
    });
  } catch (error) {
    const message =
      error instanceof LlmClientError ? error.message : "API connection test failed.";

    return Response.json({ connected: false, message }, { status: 400 });
  }
}
