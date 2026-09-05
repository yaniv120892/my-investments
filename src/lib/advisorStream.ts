import {
  EVENT_STREAM_CONTENT_TYPE,
  FRAME_SEPARATOR,
  decodeFrame,
} from "@/lib/advisor/advisorStreamProtocol";
import type { ContributionPlanAccepted } from "@/lib/pricing/contributionPlanner.types";
import type { AdvisorChatMessage } from "@/lib/advisor/advisorMessages.types";

const ADVISOR_CHAT_PATH = "/api/advisor/chat";
const UNAUTHORIZED = 401;

export interface AdvisorStreamHandlers {
  onDelta: (delta: string) => void;
  onPlan: (plan: ContributionPlanAccepted) => void;
  onError: (message: string) => void;
  onSessionExpired: () => void;
}

/**
 * Kept out of `api.ts`, which is JSON-only and buffers a whole response body.
 */
export async function streamAdvisorMessage(
  messages: AdvisorChatMessage[],
  handlers: AdvisorStreamHandlers,
  signal: AbortSignal
): Promise<void> {
  const response = await fetch(ADVISOR_CHAT_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
    signal,
  });

  if (response.status === UNAUTHORIZED) {
    handlers.onSessionExpired();
    return;
  }

  const isEventStream = response.headers
    .get("content-type")
    ?.includes(EVENT_STREAM_CONTENT_TYPE);
  if (!isEventStream) {
    handlers.onError(await readErrorMessage(response));
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    handlers.onError("The advisor returned an empty response");
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let isComplete = false;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const rawFrames = buffer.split(FRAME_SEPARATOR);
    buffer = rawFrames.pop() ?? "";

    for (const rawFrame of rawFrames) {
      isComplete = applyFrame(rawFrame, handlers) || isComplete;
    }
  }

  // The stream closing is not proof the answer finished: a dropped connection
  // or a killed function looks identical without the sentinel frame.
  if (!isComplete) {
    handlers.onError("\n\nThe answer was cut off before it finished.");
  }
}

function applyFrame(
  rawFrame: string,
  handlers: AdvisorStreamHandlers
): boolean {
  const frame = decodeFrame(rawFrame);
  if (!frame) {
    return false;
  }

  switch (frame.type) {
    case "delta":
      handlers.onDelta(frame.value);
      return false;
    case "plan":
      handlers.onPlan(frame.value);
      return false;
    case "error":
      handlers.onError(frame.message);
      return true;
    case "done":
      return true;
    default:
      return false;
  }
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body === "object" && body !== null && "error" in body) {
      return String(body.error);
    }
  } catch {
    // Not JSON — fall through to the generic message.
  }
  return "The advisor is not available right now";
}
