import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { advisorChatService } from "@/lib/advisor/advisorChatService";
import { advisorChatRequestSchema } from "@/lib/advisor/advisorMessages";
import {
  isAdvisorModelConfigured,
  requiredApiKeyName,
} from "@/lib/advisor/advisorModel";
import {
  EVENT_STREAM_CONTENT_TYPE,
  encodeFrame,
} from "@/lib/advisor/advisorStreamProtocol";
import type { PlanSink } from "@/lib/advisor/advisorTools.types";
import { withUser } from "@/lib/requestUser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// The caller's id is captured before the stream is built: `start` runs after
// the Response is returned, by which point reaching back into the request
// headers is not safe.
export const POST = withUser(async (userId, request) => {
  if (!isAdvisorModelConfigured()) {
    return NextResponse.json(
      {
        error: `The advisor has no model configured. Set ${requiredApiKeyName()} to enable it.`,
      },
      { status: 503 }
    );
  }

  const parsed = advisorChatRequestSchema.safeParse(await readBody(request));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "That conversation could not be read" },
      { status: 400 }
    );
  }

  const abortSignal = request.signal;
  const planSink: PlanSink = [];

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const run = await advisorChatService.streamAdvisorResponse(
          parsed.data.messages,
          userId,
          planSink,
          abortSignal
        );

        for await (const delta of run.textStream) {
          safeEnqueue(controller, encodeFrame({ type: "delta", value: delta }));
        }

        // A failed run closes its stream normally and reports here, so without
        // this a bad API key or a rate limit reads as an empty answer.
        if (run.error) {
          throw run.error;
        }

        for (const plan of planSink) {
          safeEnqueue(controller, encodeFrame({ type: "plan", value: plan }));
        }
        safeEnqueue(controller, encodeFrame({ type: "done" }));
      } catch (error) {
        if (!abortSignal.aborted) {
          // The 200 and its headers are long gone, so this failure reaches
          // neither an error response nor Next's error reporting.
          console.error("Advisor chat failed mid-stream:", error);
          controller.enqueue(
            encodeFrame({
              type: "error",
              // Neutral by design: a provider failure carries the host, the
              // model id and sometimes a key fragment. It belongs in the log.
              message:
                "Something went wrong while answering. Please try again.",
            })
          );
        }
      } finally {
        try {
          controller.close();
        } catch {
          // Already closed by a client disconnect.
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": EVENT_STREAM_CONTENT_TYPE,
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
});

/** A client disconnect errors the stream, after which enqueue throws. */
function safeEnqueue(
  controller: ReadableStreamDefaultController<Uint8Array>,
  frame: Uint8Array
): void {
  try {
    controller.enqueue(frame);
  } catch {
    // The reader is gone; nothing left to write to.
  }
}

async function readBody(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
