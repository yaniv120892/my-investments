import { PriceSource } from "@prisma/client";
import type { Holding } from "@prisma/client";
import { getProvider } from "@/lib/providers/providerRegistry";
import { fxRateProvider } from "@/lib/providers/FxRateProvider";
import { describeError } from "@/utils/describeError";
import type {
  HoldingValuation,
  PricingFailure,
  PricingResult,
} from "@/lib/pricing/portfolioPricingService.types";

export type {
  HoldingValuation,
  PricingFailure,
  PricingResult,
} from "@/lib/pricing/portfolioPricingService.types";

export async function priceHoldings(
  holdings: Holding[]
): Promise<PricingResult> {
  const rate = await fxRateProvider.getUsdToNisRate();
  const usdToNisRate = rate.price;

  const valuations: HoldingValuation[] = [];
  const failures: PricingFailure[] = [];

  for (const holding of holdings) {
    try {
      valuations.push(await valueHolding(holding, usdToNisRate));
    } catch (error) {
      failures.push({
        holdingId: holding.id,
        assetName: holding.assetName,
        sourceSymbol: holding.sourceSymbol,
        reason: describeError(error),
      });
    }
  }

  const pricedValueNis = valuations.reduce(
    (sum, valuation) => sum + valuation.valueInNis,
    0
  );

  return {
    valuations,
    failures,
    usdToNisRate,
    totalValueNis: failures.length === 0 ? pricedValueNis : null,
    pricedValueNis,
  };
}

export function convertToNis(
  amount: number,
  fromCurrency: string,
  usdToNisRate: number
): number {
  switch (fromCurrency) {
    case "NIS":
      return amount;
    case "USD":
      return amount * usdToNisRate;
    default:
      throw new Error(
        `Cannot convert to NIS from unsupported currency (currency: ${fromCurrency}, amount: ${amount})`
      );
  }
}

async function valueHolding(
  holding: Holding,
  usdToNisRate: number
): Promise<HoldingValuation> {
  if (holding.priceSource === PriceSource.MANUAL) {
    return valueManualHolding(holding);
  }

  if (!holding.sourceSymbol) {
    throw new Error(
      `Holding has no source symbol but its price source is ${holding.priceSource} (holding: ${holding.assetName})`
    );
  }

  const provider = getProvider(holding.priceSource);
  const quote = await provider.fetchQuote(holding.sourceSymbol);

  return {
    holdingId: holding.id,
    assetName: holding.assetName,
    valueInNis: convertToNis(
      holding.quantity * quote.price,
      quote.currency,
      usdToNisRate
    ),
    unitPrice: quote.price,
    currency: quote.currency,
    fetchedAt: quote.fetchedAt,
  };
}

function valueManualHolding(holding: Holding): HoldingValuation {
  if (
    holding.manualValueNis === null ||
    !Number.isFinite(holding.manualValueNis)
  ) {
    throw new Error(
      `Manual holding has no stored value; set one in settings (holding: ${holding.assetName})`
    );
  }

  return {
    holdingId: holding.id,
    assetName: holding.assetName,
    valueInNis: holding.manualValueNis,
    unitPrice: null,
    currency: "NIS",
    fetchedAt: holding.manualValueUpdatedAt ?? holding.updatedAt,
  };
}
