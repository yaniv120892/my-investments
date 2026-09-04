import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { advisorChatService } from "@/lib/advisor/advisorChatService";
import { advisorChatRequestSchema } from "@/lib/advisor/advisorMessages";
import { isAdvisorModelConfigured } from "@/lib/advisor/advisorModel";
import type { PlanSink } from "@/lib/advisor/advisorTools.types";
import { readJsonBody } from "@/lib/holdings/requestBody";
import { USER_ID_HEADER } from "@/lib/authTokens";
import { describeError } from "@/utils/describeError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  // Read before the stream starts: `start` runs after the Response is built,
  // by which point reaching back into the request headers is not safe.
  const userId = request.headers.get(USER_ID_HEADER);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAdvisorModelConfigured()) {
    return NextResponse.json(
      {
        error:
          "The advisor has no model configured. Set OPENAI_API_KEY to enable it.",
      },
      { status: 503 }
    );
  }

  const parsed = advisorChatRequestSchema.safeParse(
    await readJsonBody(request)
  );
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
        const textStream = await advisorChatService.streamAdvisorResponse(
          parsed.data.messages,
          userId,
          planSink,
          abortSignal
        );

        for await (const delta of textStream) {
          controller.enqueue(sseFrame({ type: "delta", value: delta }));
        }

        for (const plan of planSink) {
          controller.enqueue(sseFrame({ type: "plan", value: plan }));
        }
        controller.enqueue(sseFrame({ type: "done" }));
      } catch (error) {
        if (!abortSignal.aborted) {
          // The 200 and its headers are long gone, so this failure reaches
          // neither an error response nor Next's error reporting.
          console.error("Advisor chat failed mid-stream:", error);
          controller.enqueue(
            sseFrame({
              type: "error",
              message: `Something went wrong while answering (${describeError(
                error
              )})`,
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
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

function sseFrame(payload: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`);
}
