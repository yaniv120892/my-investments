import { PriceSource } from "@prisma/client";
import type { Holding } from "@prisma/client";
import { getProvider } from "@/lib/providers/providerRegistry";
import { NIS_TO_NIS_RATE, NisRateBook } from "@/lib/pricing/nisRateBook";
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

export {
  SUPPORTED_CURRENCIES,
  isSupportedCurrency,
} from "@/lib/pricing/supportedCurrencies";

export async function priceHoldings(
  holdings: Holding[]
): Promise<PricingResult> {
  const rateBook = new NisRateBook();

  // The dashboard converts every displayed figure with this one rate, so it is
  // fetched whether or not a holding happens to be quoted in USD.
  const usdToNisRate = await rateBook.getRateToNis("USD");

  const valuations: HoldingValuation[] = [];
  const failures: PricingFailure[] = [];

  for (const holding of holdings) {
    try {
      valuations.push(await valueHolding(holding, rateBook));
    } catch (error) {
      failures.push({
        holdingId: holding.id,
        assetName: holding.assetName,
        sourceSymbol: holding.sourceSymbol,
        reason: describeError(error),
      });
    }
  }

  if (failures.length > 0) {
    logPricingFailures(failures);
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

/**
 * Failures are returned to the caller instead of thrown, so nothing else on the
 * server records them: a production run that prices 22 of 29 holdings otherwise
 * looks identical in the logs to one that prices all 29. Logged at error level
 * because any failure suppresses the portfolio total, and because Vercel retains
 * error output long after the raw runtime logs have rolled off.
 */
function logPricingFailures(failures: PricingFailure[]): void {
  const details = failures
    .map(
      (failure) =>
        `${failure.assetName} (${failure.sourceSymbol ?? "no source symbol"}): ${
          failure.reason
        }`
    )
    .join("; ");

  console.error(
    `Pricing failed for ${failures.length} of the portfolio's holdings: ${details}`
  );
}

async function valueHolding(
  holding: Holding,
  rateBook: NisRateBook
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
  const fxRateUsed = await rateBook.getRateToNis(quote.currency);

  return {
    holdingId: holding.id,
    assetName: holding.assetName,
    valueInNis: holding.quantity * quote.price * fxRateUsed,
    unitPrice: quote.price,
    currency: quote.currency,
    fxRateUsed,
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
    fxRateUsed: NIS_TO_NIS_RATE,
    fetchedAt: holding.manualValueUpdatedAt ?? holding.updatedAt,
  };
}
