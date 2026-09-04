import { describe, expect, it } from "vitest";
import {
  MAX_ADVISOR_MESSAGES,
  MAX_ADVISOR_MESSAGE_LENGTH,
  advisorChatRequestSchema,
  fitChatHistory,
} from "@/lib/advisor/advisorMessages";
import type { AdvisorChatMessage } from "@/lib/advisor/advisorMessages.types";

function buildMessages(count: number, text = "hello"): AdvisorChatMessage[] {
  return Array.from({ length: count }, () => ({
    sender: "user" as const,
    text,
  }));
}

describe("fitChatHistory", () => {
  it("keeps a history the schema would accept, acceptable", () => {
    const fitted = fitChatHistory(buildMessages(3));

    expect(
      advisorChatRequestSchema.safeParse({ messages: fitted }).success
    ).toBe(true);
  });

  it("trims an over-long reply to a length the schema still accepts", () => {
    const tooLong = "x".repeat(MAX_ADVISOR_MESSAGE_LENGTH + 500);

    const fitted = fitChatHistory([{ sender: "advisor", text: tooLong }]);

    expect(fitted[0].text).toHaveLength(MAX_ADVISOR_MESSAGE_LENGTH);
    expect(
      advisorChatRequestSchema.safeParse({ messages: fitted }).success
    ).toBe(true);
  });

  it("drops the oldest messages once the conversation exceeds the cap", () => {
    const fitted = fitChatHistory(buildMessages(MAX_ADVISOR_MESSAGES + 10));

    expect(fitted).toHaveLength(MAX_ADVISOR_MESSAGES);
    expect(
      advisorChatRequestSchema.safeParse({ messages: fitted }).success
    ).toBe(true);
  });

  it("rejects an unfitted history, so the caps are worth applying", () => {
    const unfitted = buildMessages(MAX_ADVISOR_MESSAGES + 1);

    expect(
      advisorChatRequestSchema.safeParse({ messages: unfitted }).success
    ).toBe(false);
  });
});
