import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

function mockFetch(ok = true, body: unknown = { ok: true }): void {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue({ ok, status: ok ? 200 : 400, json: async () => body })
  );
}

function sentText(): string {
  const [, options] = vi.mocked(fetch).mock.calls[0];
  return JSON.parse(String(options?.body)).text;
}

describe("sendErrorNotification", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.TELEGRAM_BOT_TOKEN = "token";
    process.env.TELEGRAM_CHAT_ID = "chat";
    mockFetch();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...ORIGINAL_ENV };
  });

  it("escapes the ampersand in a provider error URL, which HTML parse mode would reject", async () => {
    const { sendErrorNotification } = await import("@/lib/telegramNotifier");
    await sendErrorNotification(
      "Maya request failed (url: https://mayaapi.tase.co.il/api/etf/tradedata?fundId=1159250&lang=en)"
    );
    expect(sentText()).toContain("fundId=1159250&amp;lang=en");
    expect(sentText()).not.toMatch(/&(?!amp;|lt;|gt;)/);
  });

  it("escapes angle brackets so an error cannot inject markup", async () => {
    const { sendErrorNotification } = await import("@/lib/telegramNotifier");
    await sendErrorNotification("broke <b>badly</b>");
    expect(sentText()).toContain("&lt;b&gt;badly&lt;/b&gt;");
  });

  it("keeps the heading's own markup intact", async () => {
    const { sendErrorNotification } = await import("@/lib/telegramNotifier");
    await sendErrorNotification("plain");
    expect(sentText()).toContain("<b>Investment Tracker Error</b>");
  });

  it("reports failure instead of throwing when Telegram rejects the message", async () => {
    mockFetch(false, { ok: false });
    const { sendErrorNotification } = await import("@/lib/telegramNotifier");
    await expect(sendErrorNotification("anything")).resolves.toBe(false);
  });
});
