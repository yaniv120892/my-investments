import { prisma } from "@/lib/db";
import { sendErrorNotification } from "@/lib/telegramNotifier";
import type { AdvisorTurnRecord } from "@/lib/advisor/advisorTurnLog.types";

export type { AdvisorTurnRecord } from "@/lib/advisor/advisorTurnLog.types";

const ALERTED_NUMBER_LIMIT = 5;

/**
 * Writing the turn and alerting on it are both non-critical: the answer has
 * already been streamed, and losing the record must never turn a good answer
 * into a failed request.
 */
export async function recordAdvisorTurn(
  record: AdvisorTurnRecord
): Promise<void> {
  try {
    await prisma.advisorTurn.create({ data: record });
  } catch (error) {
    console.error("Failed to record an advisor turn:", error);
  }

  if (record.isGrounded) {
    return;
  }

  console.error(
    `Advisor stated ${record.ungrounded.length} figure(s) no tool produced (userId: ${record.userId}, figures: ${record.ungrounded.join(", ")})`
  );

  try {
    await sendErrorNotification(describeViolation(record));
  } catch (error) {
    console.error("Failed to alert on an ungrounded advisor answer:", error);
  }
}

function describeViolation(record: AdvisorTurnRecord): string {
  const figures = record.ungrounded.slice(0, ALERTED_NUMBER_LIMIT).join(", ");
  const overflow =
    record.ungrounded.length > ALERTED_NUMBER_LIMIT
      ? ` (+${record.ungrounded.length - ALERTED_NUMBER_LIMIT} more)`
      : "";

  return [
    "Advisor stated a figure no tool produced.",
    `Figures: ${figures}${overflow}`,
    `Tools called: ${record.toolIds.join(", ") || "none"}`,
  ].join("\n");
}
