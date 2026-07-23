import { consumeDemoRateLimit } from "@/lib/rateLimit";
import {
  executeShowcaseGeneration,
  getShowcaseErrorMessage,
  type ShowcaseRequestBody,
} from "@/lib/showcaseRuntime";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  const rateLimitResponse = consumeDemoRateLimit(request, "screenwriting-generate");
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = (await request.json()) as ShowcaseRequestBody;
    const result = await executeShowcaseGeneration({
      body,
      workflow: "screenwriting",
      mode: "generate",
      request,
    });
    return Response.json({ ...result, generatedText: result.promptText });
  } catch (error) {
    return Response.json({ message: getShowcaseErrorMessage(error) }, { status: 400 });
  }
}
