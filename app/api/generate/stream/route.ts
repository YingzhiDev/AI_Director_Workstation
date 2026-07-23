import { consumeDemoRateLimit } from "@/lib/rateLimit";
import type { ShowcaseRequestBody } from "@/lib/showcaseRuntime";
import { createShowcaseStreamResponse } from "@/lib/showcaseStream";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  const rateLimitResponse = consumeDemoRateLimit(request, "video-generate");
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = (await request.json()) as ShowcaseRequestBody;
    return createShowcaseStreamResponse({
      request,
      body,
      workflow: "video",
      mode: "generate",
      statusMessage: "Connecting to the model and building the public director structure...",
    });
  } catch {
    return Response.json({ message: "Invalid request format." }, { status: 400 });
  }
}
