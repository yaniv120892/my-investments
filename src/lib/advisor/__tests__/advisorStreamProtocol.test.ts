import { describe, expect, it } from "vitest";
import {
  FRAME_PREFIX,
  decodeFrame,
  encodeFrame,
} from "@/lib/advisor/advisorStreamProtocol";
import type { AdvisorStreamFrame } from "@/lib/advisor/advisorStreamProtocol";
import type { ContributionPlanAccepted } from "@/lib/pricing/contributionPlanner.types";

const PLAN: ContributionPlanAccepted = {
  status: "planned",
  contributionNis: 50_000,
  investableValueNis: 1_574_185,
  byAssetClass: [],
  byHolding: [],
  dropped: [],
};

function roundTrip(frame: AdvisorStreamFrame): AdvisorStreamFrame | null {
  const encoded = new TextDecoder().decode(encodeFrame(frame));
  return decodeFrame(encoded.trimEnd());
}

describe("advisor stream protocol", () => {
  it("round-trips every frame the route can send", () => {
    const frames: AdvisorStreamFrame[] = [
      { type: "delta", value: "hello" },
      { type: "plan", value: PLAN },
      { type: "done" },
      { type: "error", message: "nope" },
    ];

    for (const frame of frames) {
      expect(roundTrip(frame)).toEqual(frame);
    }
  });

  it("rejects anything that is not a framed payload", () => {
    expect(decodeFrame("<!doctype html>")).toBeNull();
    expect(decodeFrame(`${FRAME_PREFIX}not json`)).toBeNull();
    expect(decodeFrame(`${FRAME_PREFIX}{"type":"unknown"}`)).toBeNull();
    expect(decodeFrame(`${FRAME_PREFIX}{"type":"delta"}`)).toBeNull();
  });

  it("rejects a plan frame whose payload is not a plan", () => {
    expect(
      decodeFrame(`${FRAME_PREFIX}{"type":"plan","value":{"status":"refused"}}`)
    ).toBeNull();
  });

  it("falls back to a neutral message when an error frame carries none", () => {
    const frame = decodeFrame(`${FRAME_PREFIX}{"type":"error"}`);

    expect(frame).toEqual({
      type: "error",
      message: "Something went wrong while answering",
    });
  });
});
