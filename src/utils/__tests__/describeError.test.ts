import { describe, expect, it } from "vitest";
import { describeError } from "@/utils/describeError";

describe("describeError", () => {
  it("returns the message of an Error", () => {
    expect(describeError(new Error("boom"))).toBe("boom");
  });

  it("stringifies non-Error values", () => {
    expect(describeError("plain string")).toBe("plain string");
    expect(describeError(42)).toBe("42");
  });
});
