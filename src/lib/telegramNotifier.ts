const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

export interface SnapshotNotification {
  date: Date;
  netWorth: number;
  changePercent: number;
  previousNetWorth?: number;
}

export async function sendTelegramMessage(message: string): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error("Telegram credentials not configured");
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
      throw new Error(`HTTP error! status: ${response.status}`);
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

  if (snapshot.previousNetWorth) {
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
  const message = `❌ <b>Investment Tracker Error</b>\n\n${error}`;
  return sendTelegramMessage(message);
}
