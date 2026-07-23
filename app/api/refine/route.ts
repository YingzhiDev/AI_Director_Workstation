import { consumeDemoRateLimit } from "@/lib/rateLimit";
import {
  executeShowcaseGeneration,
  getShowcaseErrorMessage,
  type ShowcaseRequestBody,
} from "@/lib/showcaseRuntime";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  const rateLimitResponse = consumeDemoRateLimit(request, "video-refine");
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = (await request.json()) as ShowcaseRequestBody;
    return Response.json(
      await executeShowcaseGeneration({
        body,
        workflow: "video",
        mode: "refine",
        request,
      }),
    );
  } catch (error) {
    return Response.json({ message: getShowcaseErrorMessage(error) }, { status: 400 });
  }
}
