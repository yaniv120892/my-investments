import { beforeEach, describe, expect, it, vi } from "vitest";
import { AssetClass } from "@prisma/client";

const { loadInvestablePortfolio, findClassTargets } = vi.hoisted(() => ({
  loadInvestablePortfolio: vi.fn(),
  findClassTargets: vi.fn(),
}));

vi.mock("@/lib/pricing/investablePortfolio", () => ({
  loadInvestablePortfolio,
}));

vi.mock("@/lib/targets/targetRepository", () => ({
  targetRepository: { findClassTargets },
}));

const {
  buildAdvisorTools,
  USER_ID_CONTEXT_KEY,
  PLAN_SINK_CONTEXT_KEY,
  PORTFOLIO_LOADER_CONTEXT_KEY,
} = await import("@/lib/advisor/advisorTools");

const AUTHENTICATED_CONTEXT = {
  requestContext: {
    get: (key: string) => (key === USER_ID_CONTEXT_KEY ? "user-1" : undefined),
  },
};

const ANONYMOUS_CONTEXT = {
  requestContext: { get: () => undefined },
};

interface ToolLike {
  execute?: (input: never, context: never) => unknown;
}

async function invoke(
  tool: ToolLike,
  input: unknown,
  context: unknown
): Promise<Record<string, unknown>> {
  if (!tool.execute) {
    throw new Error("tool has no execute");
  }
  const result = await tool.execute(input as never, context as never);
  return result as Record<string, unknown>;
}

function buildPortfolio(totalValueNis: number | null) {
  return {
    investableHoldings: [
      {
        holdingId: "equity-1",
        assetName: "S&P 500",
        assetClass: AssetClass.EQUITY,
        platformName: "Interactive Brokers",
        valueInNis: 1_000,
        withinClassWeight: 1,
      },
    ],
    investableValueNis: 1_000,
    illiquidValueNis: 2_197_156,
    illiquidPositions: [],
    byAssetClass: [
      {
        assetClass: AssetClass.EQUITY,
        valueInNis: 1_000,
        percentOfInvestable: 100,
      },
    ],
    totalValueNis,
    failures:
      totalValueNis === null
        ? [{ assetName: "פנסיה יניב", reason: "no stored value" }]
        : [],
    usdToNisRate: 3.7,
  };
}

const BALANCED_TARGETS = [
  { assetClass: AssetClass.EQUITY, targetPercent: 100 },
  { assetClass: AssetClass.CRYPTO, targetPercent: 0 },
  { assetClass: AssetClass.NON_EQUITY, targetPercent: 0 },
];

describe("advisor tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findClassTargets.mockResolvedValue(BALANCED_TARGETS);
  });

  it("refuses to read a portfolio without an authenticated user in the request context", async () => {
    const tools = buildAdvisorTools();

    await expect(
      invoke(tools.getInvestablePortfolio, {}, ANONYMOUS_CONTEXT)
    ).rejects.toThrow("without an authenticated user");
    expect(loadInvestablePortfolio).not.toHaveBeenCalled();
  });

  it("refuses to plan without an authenticated user", async () => {
    const tools = buildAdvisorTools();

    await expect(
      invoke(
        tools.planContribution,
        { contributionNis: 1_000 },
        ANONYMOUS_CONTEXT
      )
    ).rejects.toThrow("without an authenticated user");
  });

  it("refuses to plan on partial data and names the failing holding", async () => {
    loadInvestablePortfolio.mockResolvedValue(buildPortfolio(null));
    const tools = buildAdvisorTools();
    const planSink: unknown[] = [];

    const result = await invoke(
      tools.planContribution,
      { contributionNis: 1_000 },
      {
        requestContext: {
          get: (key: string) => {
            switch (key) {
              case USER_ID_CONTEXT_KEY:
                return "user-1";
              case PLAN_SINK_CONTEXT_KEY:
                return planSink;
              default:
                return undefined;
            }
          },
        },
      }
    );

    expect(result.status).toBe("refused");
    expect(result.reason).toBe("PRICING_INCOMPLETE");
    expect(String(result.explanation)).toContain("פנסיה יניב");
    expect(planSink).toHaveLength(0);
  });

  it("refuses to plan when no targets are stored", async () => {
    loadInvestablePortfolio.mockResolvedValue(buildPortfolio(1_000));
    findClassTargets.mockResolvedValue([]);
    const tools = buildAdvisorTools();

    const result = await invoke(
      tools.planContribution,
      { contributionNis: 1_000 },
      AUTHENTICATED_CONTEXT
    );

    expect(result.status).toBe("refused");
    expect(result.reason).toBe("NO_TARGETS_SET");
  });

  it("pushes an accepted plan into the sink so the route can render it", async () => {
    loadInvestablePortfolio.mockResolvedValue(buildPortfolio(1_000));
    const tools = buildAdvisorTools();
    const planSink: unknown[] = [];

    const result = await invoke(
      tools.planContribution,
      { contributionNis: 500 },
      {
        requestContext: {
          get: (key: string) => {
            switch (key) {
              case USER_ID_CONTEXT_KEY:
                return "user-1";
              case PLAN_SINK_CONTEXT_KEY:
                return planSink;
              default:
                return undefined;
            }
          },
        },
      }
    );

    expect(result.status).toBe("planned");
    expect(planSink).toHaveLength(1);
  });

  it("reads the portfolio through the request loader, never pricing directly", async () => {
    const portfolio = buildPortfolio(1_000);
    loadInvestablePortfolio.mockResolvedValue(portfolio);
    const tools = buildAdvisorTools();

    let loads = 0;
    const loader = () => {
      loads += 1;
      return Promise.resolve(portfolio);
    };
    const context = {
      requestContext: {
        get: (key: string) => {
          switch (key) {
            case USER_ID_CONTEXT_KEY:
              return "user-1";
            case PORTFOLIO_LOADER_CONTEXT_KEY:
              return loader;
            default:
              return undefined;
          }
        },
      },
    };

    await invoke(tools.getInvestablePortfolio, {}, context);
    await invoke(tools.planContribution, { contributionNis: 500 }, context);
    await invoke(tools.planContribution, { contributionNis: 900 }, context);

    expect(loads).toBe(3);
    // The tools go through the request's loader rather than pricing directly.
    expect(loadInvestablePortfolio).not.toHaveBeenCalled();
  });
});
