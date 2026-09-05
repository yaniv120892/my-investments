import type { ContributionPlanAccepted } from "@/lib/pricing/contributionPlanner.types";
import type { AdvisorStreamFrame } from "@/lib/advisor/advisorStreamProtocol.types";

export type { AdvisorStreamFrame } from "@/lib/advisor/advisorStreamProtocol.types";

export const EVENT_STREAM_CONTENT_TYPE = "text/event-stream";
export const FRAME_PREFIX = "data: ";
export const FRAME_SEPARATOR = "\n\n";

const encoder = new TextEncoder();

export function encodeFrame(frame: AdvisorStreamFrame): Uint8Array {
  return encoder.encode(
    `${FRAME_PREFIX}${JSON.stringify(frame)}${FRAME_SEPARATOR}`
  );
}

export function decodeFrame(rawFrame: string): AdvisorStreamFrame | null {
  if (!rawFrame.startsWith(FRAME_PREFIX)) {
    return null;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawFrame.slice(FRAME_PREFIX.length));
  } catch {
    return null;
  }

  if (typeof payload !== "object" || payload === null || !("type" in payload)) {
    return null;
  }

  switch (payload.type) {
    case "delta":
      return "value" in payload && typeof payload.value === "string"
        ? { type: "delta", value: payload.value }
        : null;
    case "plan":
      return "value" in payload && isContributionPlan(payload.value)
        ? { type: "plan", value: payload.value }
        : null;
    case "done":
      return { type: "done" };
    case "error":
      return {
        type: "error",
        message:
          "message" in payload && typeof payload.message === "string"
            ? payload.message
            : "Something went wrong while answering",
      };
    default:
      return null;
  }
}

function isContributionPlan(value: unknown): value is ContributionPlanAccepted {
  return (
    typeof value === "object" &&
    value !== null &&
    "status" in value &&
    value.status === "planned" &&
    "byAssetClass" in value &&
    Array.isArray(value.byAssetClass) &&
    "byHolding" in value &&
    Array.isArray(value.byHolding)
  );
}
