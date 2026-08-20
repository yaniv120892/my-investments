import { AssetClass, Liquidity, PriceSource } from "@prisma/client";

export const SHEET_FX_RATE = 3.04635;

export interface SheetHolding {
  platform: string;
  assetName: string;
  assetClass: AssetClass;
  liquidity: Liquidity;
  quantity: number;
  priceSource: PriceSource;
  sourceSymbol: string | null;
  currency: string;
  sheetPrice: number | null;
  targetPercent: number | null;
  manualValueNis: number | null;
}

export const SHEET_PLATFORMS = [
  { name: "Interactive Brokers", baseCurrency: "USD" },
  { name: "Binance", baseCurrency: "USD" },
  { name: "Excellence Pro", baseCurrency: "NIS" },
  { name: "Other", baseCurrency: "NIS" },
];

const ibkr = (
  assetName: string,
  quantity: number,
  sourceSymbol: string,
  sheetPrice: number
): SheetHolding => ({
  platform: "Interactive Brokers",
  assetName,
  assetClass: AssetClass.EQUITY,
  liquidity: Liquidity.LIQUID,
  quantity,
  priceSource: PriceSource.FINNHUB,
  sourceSymbol,
  currency: "USD",
  sheetPrice,
  targetPercent: null,
  manualValueNis: null,
});

const irish = (
  assetName: string,
  quantity: number,
  sheetPrice: number,
  manualValueNis: number
): SheetHolding => ({
  platform: "Interactive Brokers",
  assetName,
  assetClass: AssetClass.EQUITY,
  liquidity: Liquidity.LIQUID,
  quantity,
  priceSource: PriceSource.MANUAL,
  sourceSymbol: null,
  currency: "NIS",
  sheetPrice,
  targetPercent: null,
  manualValueNis,
});

const crypto = (
  symbol: string,
  quantity: number,
  targetPercent: number | null
): SheetHolding => ({
  platform: "Binance",
  assetName: symbol,
  assetClass: AssetClass.CRYPTO,
  liquidity: Liquidity.LIQUID,
  quantity,
  priceSource: PriceSource.BINANCE,
  sourceSymbol: symbol,
  currency: "USD",
  sheetPrice: null,
  targetPercent,
  manualValueNis: null,
});

const excellence = (
  assetName: string,
  priceSource: PriceSource,
  sourceSymbol: string,
  quantity: number,
  sheetPrice: number,
  targetPercent: number
): SheetHolding => ({
  platform: "Excellence Pro",
  assetName,
  assetClass: AssetClass.EQUITY,
  liquidity: Liquidity.LIQUID,
  quantity,
  priceSource,
  sourceSymbol,
  currency: "NIS",
  sheetPrice,
  targetPercent,
  manualValueNis: null,
});

export const SHEET_HOLDINGS: SheetHolding[] = [
  ibkr("S&P", 148, "IVV", 741.2),
  ibkr("NASDAQ", 89, "QQQ", 682.99),
  ibkr("Dow Jones", 68, "DIA", 518.52),
  ibkr("MSCI", 239, "EEM", 63.27),
  ibkr("VNQ", 137, "VNQ", 100.92),
  ibkr("Boeing", 5, "BA", 209.61),
  ibkr("Disney", 6, "DIS", 94.77),
  irish("Irish MSCI", 18, 52.15, 2860),
  irish("Irish S&P", 5, 801.39, 12207),
  irish("Irish NASDAQ", 4, 682.99, 8323),

  excellence("iShares CORE S&P 500", PriceSource.MAYA_ETF, "1159250", 126, 2442.9, 54.0),
  excellence("iShares CORE MSCI EUROPE", PriceSource.MAYA_ETF, "1159094", 342, 363.4, 22.5),
  excellence("iShares CORE MSCI EM IMI", PriceSource.MAYA_ETF, "1159169", 573, 160.9, 13.5),
  excellence("TLV 125", PriceSource.MAYA_FUND, "5109889", 13240, 4.5921, 10.0),

  crypto("BTC", 0.319043, 35),
  crypto("ETH", 2.84245873, 25),
  crypto("ADA", 2129.13, 15),
  crypto("BNB", 2.23062261, 4),
  crypto("DOGE", 2441.4, 3),
  crypto("DOT", 28.09343628, 3),
  crypto("SHIB", 41837962.57, 3),
  crypto("CAKE", 85.82799929, 3),
  crypto("1INCH", 107.3157289, 3),
  crypto("SOL", 3.06246084, 2),
  crypto("DAR", 185.8019098, 1),
  crypto("MATIC", 698.029446, null),
  crypto("POL", 701.8623572, null),

  {
    platform: "Other",
    assetName: "שרה",
    assetClass: AssetClass.EQUITY,
    liquidity: Liquidity.ILLIQUID,
    quantity: 1,
    priceSource: PriceSource.MANUAL,
    sourceSymbol: null,
    currency: "NIS",
    sheetPrice: null,
    targetPercent: null,
    manualValueNis: 84919,
  },
  {
    platform: "Other",
    assetName: "BTB - הלוואות חברתיות",
    assetClass: AssetClass.NON_EQUITY,
    liquidity: Liquidity.ILLIQUID,
    quantity: 1,
    priceSource: PriceSource.MANUAL,
    sourceSymbol: null,
    currency: "NIS",
    sheetPrice: null,
    targetPercent: null,
    manualValueNis: 0,
  },
];

export const SHEET_TOTALS = {
  interactiveBrokers: 743264,
  excellencePro: 585083,
  binanceExcludingMatic: 85743,
  manual: 84919,
  grandTotal: 1499009,
};
