import { prisma } from "@/lib/db";
import { sendErrorNotification } from "@/lib/telegramNotifier";
import { describeError } from "@/utils/describeError";
import type { AdvisorTurnRecord } from "@/lib/advisor/advisorTurnLog.types";

export type { AdvisorTurnRecord } from "@/lib/advisor/advisorTurnLog.types";

const ALERTED_NUMBER_LIMIT = 5;

/**
 * Writing the turn and alerting on it are both non-critical: the answer has
 * already been streamed, and losing either must never turn a good answer
 * into a failed request. They run concurrently since neither depends on the
 * other's outcome.
 */
export async function recordAdvisorTurn(
  record: AdvisorTurnRecord
): Promise<void> {
  if (record.isGrounded) {
    await writeTurn(record);
    return;
  }

  console.error(
    `Advisor stated ${record.ungrounded.length} figure(s) no tool produced (userId: ${record.userId}, figures: ${record.ungrounded.join(", ")})`
  );

  await Promise.allSettled([writeTurn(record), alertOnViolation(record)]);
}

async function writeTurn(record: AdvisorTurnRecord): Promise<void> {
  try {
    await prisma.advisorTurn.create({ data: record });
  } catch (error) {
    console.error(`Failed to record an advisor turn: ${describeError(error)}`);
  }
}

/** `sendErrorNotification` reports failure by returning false rather than throwing. */
async function alertOnViolation(record: AdvisorTurnRecord): Promise<void> {
  const wasSent = await sendErrorNotification(describeViolation(record));
  if (!wasSent) {
    console.error(
      `Failed to alert on an ungrounded advisor answer (userId: ${record.userId})`
    );
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
