import { consumeDemoRateLimit } from "@/lib/rateLimit";
import {
  executeShowcaseGeneration,
  getShowcaseErrorMessage,
  type ShowcaseRequestBody,
} from "@/lib/showcaseRuntime";
import { createShowcaseStreamResponse } from "@/lib/showcaseStream";

export const runtime = "nodejs";
export const maxDuration = 300;

type RouteContext = {
  params: Promise<{ action: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const action = (await context.params).action;
  if (!action || !["stream", "generate", "refine"].includes(action)) {
    return Response.json({ message: "Unknown image-prompt action." }, { status: 404 });
  }

  const rateLimitResponse = consumeDemoRateLimit(request, `image-${action}`);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = (await request.json()) as ShowcaseRequestBody;
    if (action === "stream") {
      return createShowcaseStreamResponse({
        request,
        body,
        workflow: "image",
        mode: "generate",
        statusMessage: "Connecting to the model and building the public visual structure...",
      });
    }

    return Response.json(
      await executeShowcaseGeneration({
        body,
        workflow: "image",
        mode: action === "refine" ? "refine" : "generate",
        request,
      }),
    );
  } catch (error) {
    return Response.json({ message: getShowcaseErrorMessage(error) }, { status: 400 });
  }
}
