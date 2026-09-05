import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AssetClass } from "@prisma/client";
import { AdvisorTurnRecorder } from "@/lib/advisor/advisorTurnRecorder";
import { checkNumericGrounding } from "@/lib/advisor/eval/numericGrounding";

/**
 * Graded against the real model, so it costs money and cannot gate anything —
 * `npm run eval`, never CI. It answers the question the mock harness cannot:
 * whether the prompt still routes real language to the right tool.
 */
const { loadInvestablePortfolio, findClassTargets } = vi.hoisted(() => ({
  loadInvestablePortfolio: vi.fn(),
  findClassTargets: vi.fn(),
}));

vi.mock("@/lib/pricing/investablePortfolio", () => ({
  loadInvestablePortfolio,
  createInvestablePortfolioLoader: (userId: string) => () =>
    loadInvestablePortfolio(userId),
}));

vi.mock("@/lib/targets/targetRepository", () => ({
  targetRepository: { findClassTargets },
}));

const PORTFOLIO = {
  investableHoldings: [
    {
      holdingId: "equity-1",
      assetName: "S&P 500",
      assetClass: AssetClass.EQUITY,
      platformName: "Interactive Brokers",
      valueInNis: 1_364_219,
      withinClassWeight: 1,
    },
    {
      holdingId: "crypto-1",
      assetName: "BTC",
      assetClass: AssetClass.CRYPTO,
      platformName: "Binance",
      valueInNis: 109_966,
      withinClassWeight: 1,
    },
    {
      holdingId: "cash-1",
      assetName: "קרן חירום כספית",
      assetClass: AssetClass.NON_EQUITY,
      platformName: "Cash & short term",
      valueInNis: 100_000,
      withinClassWeight: 1,
    },
  ],
  investableValueNis: 1_574_185,
  illiquidValueNis: 2_197_156,
  illiquidPositions: [
    {
      assetName: "פנסיה יניב סה״כ",
      platformName: "Long-term savings",
      valueInNis: 909_592,
    },
  ],
  byAssetClass: [],
  totalValueNis: 1_574_185,
  failures: [],
  usdToNisRate: 3.7,
};

const TARGETS = [
  { assetClass: AssetClass.EQUITY, targetPercent: 70 },
  { assetClass: AssetClass.CRYPTO, targetPercent: 10 },
  { assetClass: AssetClass.NON_EQUITY, targetPercent: 20 },
];

const scores: { name: string; passed: boolean }[] = [];

async function ask(
  message: string
): Promise<{ replyText: string; recorder: AdvisorTurnRecorder }> {
  const { advisorChatService } =
    await import("@/lib/advisor/advisorChatService");
  const recorder = new AdvisorTurnRecorder();
  const stream = await advisorChatService.streamAdvisorResponse(
    [{ sender: "user", text: message }],
    "eval-user",
    recorder
  );

  let replyText = "";
  for await (const delta of stream.textStream) {
    replyText += delta;
  }
  return { replyText, recorder };
}

function grade(name: string, passed: boolean): void {
  scores.push({ name, passed });
  // Soft, so one failed grade does not hide the rest of the case and leave the
  // summary reporting fewer checks instead of a failure.
  expect.soft(passed, name).toBe(true);
}

describe.skipIf(!process.env.OPENAI_API_KEY)(
  "advisor quality (real model)",
  () => {
    beforeAll(() => {
      delete process.env.ASSISTANT_MODEL_URL;
      delete process.env.MASTRA_DB_URL;
      delete process.env.DIRECT_URL;
      loadInvestablePortfolio.mockResolvedValue(PORTFOLIO);
      findClassTargets.mockResolvedValue(TARGETS);
    });

    afterAll(() => {
      const passed = scores.filter((score) => score.passed).length;
      console.log(`\nAdvisor eval: ${passed}/${scores.length} passed`);
      for (const score of scores) {
        console.log(`  ${score.passed ? "✓" : "✗"} ${score.name}`);
      }
    });

    it("routes a plain contribution question to planContribution", async () => {
      const { recorder } = await ask(
        "I have ₪50,000 to invest. Where should it go?"
      );

      grade(
        "routes to planContribution",
        recorder.summary.toolIds.includes("planContribution")
      );
      grade("produced a plan", recorder.plans.length > 0);
    });

    it("states no figure the tools did not produce", async () => {
      const { replyText, recorder } = await ask(
        "I have ₪50,000 to invest. Where should it go?"
      );
      const grounding = checkNumericGrounding(
        replyText,
        recorder.groundingResults
      );

      grade(
        `every figure grounded (${grounding.ungrounded.map((entry) => entry.text).join(", ")})`,
        grounding.isGrounded
      );
    });

    it("passes a stated constraint through as a tool argument", async () => {
      const { recorder } = await ask(
        "I have ₪50,000 to invest, but skip crypto entirely and nothing under ₪500."
      );
      const plan = recorder.plans.at(-1);

      grade("planned with crypto excluded", plan !== undefined);
      grade(
        "crypto received nothing",
        (plan?.byAssetClass ?? []).every(
          (allocation) =>
            allocation.assetClass !== AssetClass.CRYPTO ||
            allocation.contributionNis === 0
        )
      );
    });

    it("refuses rather than planning when the portfolio cannot be priced", async () => {
      loadInvestablePortfolio.mockResolvedValueOnce({
        ...PORTFOLIO,
        totalValueNis: null,
        failures: [{ assetName: "פנסיה יניב סה״כ", reason: "no stored value" }],
      });

      const { replyText, recorder } = await ask(
        "I have ₪50,000 to invest. Where should it go?"
      );

      grade("did not plan", recorder.plans.length === 0);
      grade(
        "named the failing holding",
        replyText.includes("פנסיה") || replyText.toLowerCase().includes("price")
      );
    });

    it("explains that illiquid holdings cannot receive money", async () => {
      const { replyText } = await ask("Why is my pension not in the plan?");

      grade(
        "explained the illiquid exclusion",
        /pension|illiquid|liquid/i.test(replyText)
      );
    });
  }
);
