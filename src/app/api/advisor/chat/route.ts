import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { advisorChatService } from "@/lib/advisor/advisorChatService";
import { advisorChatRequestSchema } from "@/lib/advisor/advisorMessages";
import { isAdvisorModelConfigured } from "@/lib/advisor/advisorModel";
import { AdvisorTurnRecorder } from "@/lib/advisor/advisorTurnRecorder";
import { recordAdvisorTurn } from "@/lib/advisor/advisorTurnLog";
import { checkNumericGrounding } from "@/lib/advisor/eval/numericGrounding";
import {
  EVENT_STREAM_CONTENT_TYPE,
  encodeFrame,
} from "@/lib/advisor/advisorStreamProtocol";
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

  const parsed = advisorChatRequestSchema.safeParse(await readBody(request));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "That conversation could not be read" },
      { status: 400 }
    );
  }

  const abortSignal = request.signal;
  const recorder = new AdvisorTurnRecorder();
  const startedAt = Date.now();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let replyText = "";

      try {
        const textStream = await advisorChatService.streamAdvisorResponse(
          parsed.data.messages,
          userId,
          recorder,
          abortSignal
        );

        for await (const delta of textStream) {
          replyText += delta;
          controller.enqueue(encodeFrame({ type: "delta", value: delta }));
        }

        for (const plan of recorder.plans) {
          controller.enqueue(encodeFrame({ type: "plan", value: plan }));
        }
        controller.enqueue(encodeFrame({ type: "done" }));
      } catch (error) {
        if (!abortSignal.aborted) {
          // The 200 and its headers are long gone, so this failure reaches
          // neither an error response nor Next's error reporting.
          console.error("Advisor chat failed mid-stream:", error);
          controller.enqueue(
            encodeFrame({
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
        // After close, so the reader never waits on the write or the alert.
        if (!abortSignal.aborted) {
          await logTurn(userId, replyText, recorder, startedAt);
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
}

async function logTurn(
  userId: string,
  replyText: string,
  recorder: AdvisorTurnRecorder,
  startedAt: number
): Promise<void> {
  const grounding = checkNumericGrounding(replyText, recorder.toolResults);
  const summary = recorder.summary;

  await recordAdvisorTurn({
    userId,
    toolIds: summary.toolIds,
    plannedCount: summary.plannedCount,
    refusalReasons: summary.refusalReasons,
    isGrounded: grounding.isGrounded,
    ungrounded: grounding.ungrounded.map((entry) => entry.text),
    replyChars: replyText.length,
    durationMs: Date.now() - startedAt,
  });
}

async function readBody(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
