import { describe, expect, it } from "vitest";
import { computeAllocation, groupBy } from "@/lib/pricing/allocation";

describe("computeAllocation", () => {
  it("computes actual percentages that sum to 100", () => {
    const slices = computeAllocation([
      { key: "a", valueInNis: 250, targetPercent: null },
      { key: "b", valueInNis: 750, targetPercent: null },
    ]);
    expect(
      slices.find((slice) => slice.key === "a")?.actualPercent
    ).toBeCloseTo(25);
    expect(
      slices.find((slice) => slice.key === "b")?.actualPercent
    ).toBeCloseTo(75);
  });

  it("computes drift and the rebalance amount against a target", () => {
    const slices = computeAllocation([
      { key: "over", valueInNis: 600, targetPercent: 50 },
      { key: "under", valueInNis: 400, targetPercent: 50 },
    ]);
    const over = slices.find((slice) => slice.key === "over");
    expect(over?.driftPercent).toBeCloseTo(10);
    expect(over?.rebalanceAmountNis).toBeCloseTo(-100);

    const under = slices.find((slice) => slice.key === "under");
    expect(under?.driftPercent).toBeCloseTo(-10);
    expect(under?.rebalanceAmountNis).toBeCloseTo(100);
  });

  it("matches the real Excellence Pro drift from the spreadsheet", () => {
    const slices = computeAllocation([
      { key: "1159250", valueInNis: 307805, targetPercent: 54.0 },
      { key: "1159094", valueInNis: 124283, targetPercent: 22.5 },
      { key: "1159169", valueInNis: 92196, targetPercent: 13.5 },
      { key: "5109889", valueInNis: 60799, targetPercent: 10.0 },
    ]);
    expect(
      slices.find((slice) => slice.key === "1159250")?.actualPercent
    ).toBeCloseTo(52.61, 1);
    expect(
      slices.find((slice) => slice.key === "1159094")?.actualPercent
    ).toBeCloseTo(21.24, 1);
    expect(
      slices.find((slice) => slice.key === "1159169")?.actualPercent
    ).toBeCloseTo(15.76, 1);
    expect(
      slices.find((slice) => slice.key === "5109889")?.actualPercent
    ).toBeCloseTo(10.39, 1);
  });

  it("rebalance amounts sum to zero when every item has a target", () => {
    const slices = computeAllocation([
      { key: "a", valueInNis: 307805, targetPercent: 54.0 },
      { key: "b", valueInNis: 124283, targetPercent: 22.5 },
      { key: "c", valueInNis: 92196, targetPercent: 13.5 },
      { key: "d", valueInNis: 60799, targetPercent: 10.0 },
    ]);
    const total = slices.reduce(
      (sum, slice) => sum + (slice.rebalanceAmountNis ?? 0),
      0
    );
    expect(total).toBeCloseTo(0, 6);
  });

  it("leaves target-derived fields null when no target is set", () => {
    const slices = computeAllocation([
      { key: "a", valueInNis: 100, targetPercent: null },
    ]);
    expect(slices[0].targetPercent).toBeNull();
    expect(slices[0].driftPercent).toBeNull();
    expect(slices[0].rebalanceAmountNis).toBeNull();
  });

  it("returns an empty array for no items", () => {
    expect(computeAllocation([])).toEqual([]);
  });

  it("reports zero percentages when the total is zero rather than dividing by zero", () => {
    const slices = computeAllocation([
      { key: "btb", valueInNis: 0, targetPercent: null },
    ]);
    expect(slices[0].actualPercent).toBe(0);
  });

  it("sorts slices by value descending", () => {
    const slices = computeAllocation([
      { key: "small", valueInNis: 1, targetPercent: null },
      { key: "big", valueInNis: 100, targetPercent: null },
    ]);
    expect(slices.map((slice) => slice.key)).toEqual(["big", "small"]);
  });
});

describe("groupBy", () => {
  it("sums values per key", () => {
    const totals = groupBy(
      [
        { platform: "IBKR", value: 10 },
        { platform: "IBKR", value: 5 },
        { platform: "Binance", value: 3 },
      ],
      (row) => row.platform,
      (row) => row.value
    );
    expect(totals).toEqual({ IBKR: 15, Binance: 3 });
  });

  it("returns an empty object for no items", () => {
    expect(
      groupBy(
        [],
        () => "k",
        () => 1
      )
    ).toEqual({});
  });
});
