import type { NextRequest } from "next/server";
import { NextResponse, after } from "next/server";
import { advisorChatService } from "@/lib/advisor/advisorChatService";
import { advisorChatRequestSchema } from "@/lib/advisor/advisorMessages";
import {
  isAdvisorModelConfigured,
  requiredApiKeyName,
} from "@/lib/advisor/advisorModel";
import { AdvisorTurnRecorder } from "@/lib/advisor/advisorTurnRecorder";
import { recordAdvisorTurn } from "@/lib/advisor/advisorTurnLog";
import { checkNumericGrounding } from "@/lib/advisor/eval/numericGrounding";
import {
  EVENT_STREAM_CONTENT_TYPE,
  encodeFrame,
} from "@/lib/advisor/advisorStreamProtocol";
import type { AdvisorTurnRecord } from "@/lib/advisor/advisorTurnLog.types";
import type { AdvisorChatMessage } from "@/lib/advisor/advisorMessages.types";
import { USER_ID_HEADER } from "@/lib/authTokens";

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
  const recorder = new AdvisorTurnRecorder();
  const startedAt = Date.now();

  // The turn record is written after the response completes, so it needs the
  // platform to keep the invocation alive — work started from the stream's
  // `finally` alone is frozen with the function once the body is done.
  let settleTurn: (record: AdvisorTurnRecord | null) => void = () => {};
  const turn = new Promise<AdvisorTurnRecord | null>((resolve) => {
    settleTurn = resolve;
  });
  after(async () => {
    const record = await turn;
    if (record) {
      await recordAdvisorTurn(record);
    }
  });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let replyText = "";
      let failed = false;

      try {
        const run = await advisorChatService.streamAdvisorResponse(
          parsed.data.messages,
          userId,
          recorder,
          abortSignal
        );

        for await (const delta of run.textStream) {
          replyText += delta;
          safeEnqueue(controller, encodeFrame({ type: "delta", value: delta }));
        }

        // A failed run closes its stream normally and reports here, so without
        // this a bad API key or a rate limit reads as an empty answer.
        if (run.error) {
          throw run.error;
        }

        for (const plan of recorder.plans) {
          safeEnqueue(controller, encodeFrame({ type: "plan", value: plan }));
        }
        safeEnqueue(controller, encodeFrame({ type: "done" }));
      } catch (error) {
        failed = true;
        if (!abortSignal.aborted) {
          // The 200 and its headers are long gone, so this failure reaches
          // neither an error response nor Next's error reporting.
          console.error("Advisor chat failed mid-stream:", error);
          safeEnqueue(
            controller,
            encodeFrame({
              // Neutral by design: a provider failure carries the host, the
              // model id and sometimes a key fragment. It belongs in the log.
              type: "error",
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
        settleTurn(
          abortSignal.aborted || failed
            ? null
            : buildTurnRecord(
                userId,
                replyText,
                recorder,
                parsed.data.messages,
                startedAt
              )
        );
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

function buildTurnRecord(
  userId: string,
  replyText: string,
  recorder: AdvisorTurnRecorder,
  messages: AdvisorChatMessage[],
  startedAt: number
): AdvisorTurnRecord {
  // Graded against what the tools returned *and* what the user typed: an amount
  // the user named is not fabricated when the model repeats it back. A turn
  // that called no grounding tool cannot be graded at all — with memory on, a
  // follow-up is answered from the thread — so it is not judged rather than
  // judged wrong.
  const grounding = recorder.hasGroundingResults
    ? checkNumericGrounding(replyText, [
        ...recorder.groundingResults,
        ...messages.map((message) => message.text),
      ])
    : null;
  const summary = recorder.summary;

  return {
    userId,
    toolIds: summary.toolIds,
    plannedCount: summary.plannedCount,
    refusalReasons: summary.refusalReasons,
    isGrounded: grounding?.isGrounded ?? true,
    ungrounded: (grounding?.ungrounded ?? []).map((entry) => entry.text),
    replyChars: replyText.length,
    durationMs: Date.now() - startedAt,
  };
}

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
