import { z } from "zod";
import type { AdvisorChatMessage } from "@/lib/advisor/advisorMessages.types";

export type {
  AdvisorChatMessage,
  AdvisorMessageSender,
} from "@/lib/advisor/advisorMessages.types";

export const MAX_ADVISOR_MESSAGES = 100;
export const MAX_ADVISOR_MESSAGE_LENGTH = 4000;

export const advisorChatRequestSchema = z.strictObject({
  messages: z
    .array(
      z.strictObject({
        sender: z.enum(["user", "advisor"]),
        text: z.string().min(1).max(MAX_ADVISOR_MESSAGE_LENGTH),
      })
    )
    .min(1)
    .max(MAX_ADVISOR_MESSAGES),
});

/**
 * Trimmed to the same caps the request schema enforces: without this a single
 * long reply makes every later send fail validation forever.
 */
export function fitChatHistory(
  messages: AdvisorChatMessage[]
): AdvisorChatMessage[] {
  return messages.slice(-MAX_ADVISOR_MESSAGES).map((message) => ({
    sender: message.sender,
    text: message.text.slice(0, MAX_ADVISOR_MESSAGE_LENGTH),
  }));
}
