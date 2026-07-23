import {
  executeShowcaseGeneration,
  getShowcaseErrorMessage,
  type ShowcaseMode,
  type ShowcaseRequestBody,
  type ShowcaseWorkflow,
} from "@/lib/showcaseRuntime";

function encodeEvent(event: string, payload: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

export function createShowcaseStreamResponse(options: {
  request: Request;
  body: ShowcaseRequestBody;
  workflow: ShowcaseWorkflow;
  mode: ShowcaseMode;
  statusMessage: string;
}) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const send = (event: string, payload: unknown) => {
        if (!open) return;
        controller.enqueue(encoder.encode(encodeEvent(event, payload)));
      };

      try {
        send("status", {
          message: options.statusMessage,
          promptKind: options.workflow,
        });
        const result = await executeShowcaseGeneration({
          body: options.body,
          workflow: options.workflow,
          mode: options.mode,
          request: options.request,
          onDelta: (delta) =>
            send("delta", { delta, promptKind: options.workflow }),
        });
        send("complete", { ...result, promptKind: options.workflow });
      } catch (error) {
        send("error", { message: getShowcaseErrorMessage(error) });
      } finally {
        open = false;
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
  });
}
