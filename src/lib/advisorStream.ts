import type { ContributionPlanAccepted } from "@/lib/pricing/contributionPlanner.types";
import type { AdvisorChatMessage } from "@/lib/advisor/advisorMessages.types";

const ADVISOR_CHAT_PATH = "/api/advisor/chat";
const EVENT_STREAM_CONTENT_TYPE = "text/event-stream";
const FRAME_SEPARATOR = "\n\n";
const FRAME_PREFIX = "data: ";

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

  // The middleware answers an unauthenticated API request with a redirect to
  // the login page, not a 401, and fetch follows it — so a 200 here can still
  // be HTML. The content type is the only reliable signal.
  const isEventStream = response.headers
    .get("content-type")
    ?.includes(EVENT_STREAM_CONTENT_TYPE);
  if (!isEventStream) {
    if (response.redirected || response.status === 401) {
      handlers.onSessionExpired();
      return;
    }
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

  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split(FRAME_SEPARATOR);
    buffer = frames.pop() ?? "";

    for (const frame of frames) {
      applyFrame(frame, handlers);
    }
  }
}

function applyFrame(frame: string, handlers: AdvisorStreamHandlers): void {
  if (!frame.startsWith(FRAME_PREFIX)) {
    return;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(frame.slice(FRAME_PREFIX.length));
  } catch {
    return;
  }

  if (typeof payload !== "object" || payload === null || !("type" in payload)) {
    return;
  }

  switch (payload.type) {
    case "delta":
      if ("value" in payload && typeof payload.value === "string") {
        handlers.onDelta(payload.value);
      }
      return;
    case "plan":
      if ("value" in payload) {
        handlers.onPlan(payload.value as ContributionPlanAccepted);
      }
      return;
    case "error":
      handlers.onError(
        "message" in payload && typeof payload.message === "string"
          ? payload.message
          : "Something went wrong while answering"
      );
      return;
    default:
      return;
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
