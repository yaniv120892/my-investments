import type { SnapshotNotification } from "@/lib/telegramNotifier.types";

export type { SnapshotNotification } from "@/lib/telegramNotifier.types";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

export async function sendTelegramMessage(message: string): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error(
      `Cannot send the Telegram message: credentials are not configured (TELEGRAM_BOT_TOKEN set: ${Boolean(
        TELEGRAM_BOT_TOKEN
      )}, TELEGRAM_CHAT_ID set: ${Boolean(TELEGRAM_CHAT_ID)})`
    );
    return false;
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: message,
          parse_mode: "HTML",
        }),
      }
    );

    if (!response.ok) {
      const failureBody = await readResponseBody(response);
      throw new Error(
        `Telegram rejected the message (status: ${response.status}, body: ${failureBody})`
      );
    }

    const result = await response.json();
    return result.ok === true;
  } catch (error) {
    console.error("Error sending Telegram message:", error);
    return false;
  }
}

export function formatSnapshotMessage(snapshot: SnapshotNotification): string {
  const date = snapshot.date.toLocaleDateString("he-IL");
  const time = snapshot.date.toLocaleTimeString("he-IL");

  let message = `📊 <b>Portfolio Snapshot</b>\n\n`;
  message += `📅 Date: ${date} ${time}\n`;
  message += `💰 Net Worth: ₪${snapshot.netWorth.toLocaleString("he-IL")}\n`;

  if (snapshot.previousNetWorth !== undefined) {
    const change = snapshot.netWorth - snapshot.previousNetWorth;
    const changeSymbol = change >= 0 ? "📈" : "📉";
    const changeText = change >= 0 ? "+" : "";

    message += `${changeSymbol} Change: ${changeText}₪${change.toLocaleString(
      "he-IL"
    )}\n`;
    message += `📊 Change: ${changeText}${snapshot.changePercent.toFixed(
      2
    )}%\n`;
  }

  return message;
}

export async function sendSnapshotNotification(
  snapshot: SnapshotNotification
): Promise<boolean> {
  const message = formatSnapshotMessage(snapshot);
  return sendTelegramMessage(message);
}

export async function sendErrorNotification(error: string): Promise<boolean> {
  const message = `❌ <b>Investment Tracker Error</b>\n\n${escapeHtml(error)}`;
  return sendTelegramMessage(message);
}

/**
 * Messages go out with parse_mode HTML, so an unescaped character in an error
 * detail makes Telegram reject the whole message with a 400. Provider failures
 * routinely carry a query string — `...chart/CSPX.L?interval=1d&range=1d` — and
 * that bare ampersand alone is enough to lose the alert.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function readResponseBody(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "<unreadable>";
  }
}
