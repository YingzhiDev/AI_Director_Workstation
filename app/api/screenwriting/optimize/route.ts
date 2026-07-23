import { consumeDemoRateLimit } from "@/lib/rateLimit";
import {
  executeShowcaseGeneration,
  getShowcaseErrorMessage,
  type ShowcaseRequestBody,
} from "@/lib/showcaseRuntime";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  const rateLimitResponse = consumeDemoRateLimit(request, "screenwriting-optimize");
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = (await request.json()) as ShowcaseRequestBody;
    const result = await executeShowcaseGeneration({
      body,
      workflow: "screenwriting",
      mode: "optimize",
      request,
    });
    return Response.json({ ...result, optimizedText: result.promptText });
  } catch (error) {
    return Response.json({ message: getShowcaseErrorMessage(error) }, { status: 400 });
  }
}
