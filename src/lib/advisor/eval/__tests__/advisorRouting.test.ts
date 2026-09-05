import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AssetClass } from "@prisma/client";
import {
  startMockModelServer,
  type MockModelServer,
} from "@/lib/advisor/eval/mockModelServer";
import { AdvisorTurnRecorder } from "@/lib/advisor/advisorTurnRecorder";
import { checkNumericGrounding } from "@/lib/advisor/eval/numericGrounding";

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
  illiquidPositions: [],
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

let mockServer: MockModelServer;

async function runTurn(
  script: Parameters<typeof startMockModelServer>[0],
  message: string
): Promise<{ replyText: string; recorder: AdvisorTurnRecorder }> {
  mockServer = await startMockModelServer(script);
  process.env.ASSISTANT_MODEL_URL = mockServer.url;

  const { advisorChatService } =
    await import("@/lib/advisor/advisorChatService");
  const recorder = new AdvisorTurnRecorder();
  const stream = await advisorChatService.streamAdvisorResponse(
    [{ sender: "user", text: message }],
    "user-1",
    recorder
  );

  let replyText = "";
  for await (const delta of stream) {
    replyText += delta;
  }
  return { replyText, recorder };
}

describe("advisor routing against a scripted model", () => {
  beforeAll(() => {
    process.env.AI_PROVIDER = "chatgpt";
    process.env.OPENAI_API_KEY = "test-key";
    delete process.env.MASTRA_DB_URL;
    delete process.env.DIRECT_URL;
    loadInvestablePortfolio.mockResolvedValue(PORTFOLIO);
    findClassTargets.mockResolvedValue(TARGETS);
  });

  afterAll(async () => {
    await mockServer?.close();
    delete process.env.ASSISTANT_MODEL_URL;
  });

  it("offers every advisor tool to the model", async () => {
    await runTurn([{ text: "Hello." }], "hi");

    expect(mockServer.requests[0].toolNames.sort()).toEqual([
      "getHoldingPriceTrend",
      "getInvestablePortfolio",
      "getTargets",
      "planContribution",
      "validateClassTargets",
    ]);
  });

  it("routes a contribution question through planContribution and records the plan", async () => {
    const { recorder } = await runTurn(
      [
        {
          toolCalls: [
            {
              name: "planContribution",
              arguments: { contributionNis: 50_000 },
            },
          ],
        },
        { text: "Put the whole ₪50,000 into non-equity." },
      ],
      "I have 50000 to invest"
    );

    expect(recorder.summary.toolIds).toEqual(["planContribution"]);
    expect(recorder.plans).toHaveLength(1);
    expect(recorder.plans[0].byAssetClass).not.toHaveLength(0);
  });

  it("passes a stated constraint through as a tool argument", async () => {
    const { recorder } = await runTurn(
      [
        {
          toolCalls: [
            {
              name: "planContribution",
              arguments: {
                contributionNis: 50_000,
                excludedAssetClasses: ["CRYPTO"],
                minimumTicketNis: 500,
              },
            },
          ],
        },
        { text: "Skipping crypto." },
      ],
      "same but skip crypto, nothing under 500"
    );

    const plan = recorder.plans[0];
    expect(
      plan.byAssetClass.map((allocation) => allocation.assetClass)
    ).not.toContain(AssetClass.CRYPTO);
  });

  it("relays a refusal instead of planning when pricing is incomplete", async () => {
    loadInvestablePortfolio.mockResolvedValueOnce({
      ...PORTFOLIO,
      totalValueNis: null,
      failures: [{ assetName: "פנסיה יניב", reason: "no stored value" }],
    });

    const { recorder } = await runTurn(
      [
        {
          toolCalls: [
            {
              name: "planContribution",
              arguments: { contributionNis: 50_000 },
            },
          ],
        },
        { text: "I cannot plan that yet." },
      ],
      "I have 50000 to invest"
    );

    expect(recorder.summary.refusalReasons).toEqual(["PRICING_INCOMPLETE"]);
    expect(recorder.plans).toHaveLength(0);
  });

  it("grades the reply's figures against what the tools actually returned", async () => {
    const { replyText, recorder } = await runTurn(
      [
        {
          toolCalls: [
            {
              name: "planContribution",
              arguments: { contributionNis: 50_000 },
            },
          ],
        },
        { text: "Put ₪50,000 into non-equity — nothing anywhere else." },
      ],
      "I have 50000 to invest"
    );

    const grounding = checkNumericGrounding(replyText, recorder.toolResults);
    expect(grounding.isGrounded).toBe(true);

    const fabricated = checkNumericGrounding(
      "Put ₪37,500 into equity.",
      recorder.toolResults
    );
    expect(fabricated.isGrounded).toBe(false);
  });
});
