-- Yahoo answers this app's Vercel region with 429s, so the three TASE-listed
-- iShares ETFs move to Maya, which already serves the mutual fund. MAYA splits
-- into MAYA_FUND and MAYA_ETF because Maya's two products live on endpoints
-- that reject each other's ids (see mayaApi.ts).
--
-- The symbols go back to the TASE security ids these holdings used before the
-- move to Yahoo, and back to being quoted in agorot — the same series the
-- history already holds, so the chart does not step when the source changes.

CREATE TYPE "PriceSource_new" AS ENUM ('FINNHUB', 'BINANCE', 'MAYA_ETF', 'MAYA_FUND', 'MANUAL');

ALTER TABLE "Holding" ALTER COLUMN "priceSource" TYPE text;

UPDATE "Holding" SET "priceSource"='MAYA_ETF', "sourceSymbol"='1159250' WHERE "priceSource"='YAHOO' AND "sourceSymbol"='CSPX.L';
UPDATE "Holding" SET "priceSource"='MAYA_ETF', "sourceSymbol"='1159169' WHERE "priceSource"='YAHOO' AND "sourceSymbol"='EIMI.L';
UPDATE "Holding" SET "priceSource"='MAYA_ETF', "sourceSymbol"='1159094' WHERE "priceSource"='YAHOO' AND "sourceSymbol"='IMAE.AS';
UPDATE "Holding" SET "priceSource"='MAYA_FUND' WHERE "priceSource"='MAYA';

-- Any YAHOO or MAYA row not remapped above fails this cast and aborts the
-- migration, rather than reaching a client that no longer knows the value.
ALTER TABLE "Holding" ALTER COLUMN "priceSource" TYPE "PriceSource_new" USING ("priceSource"::"PriceSource_new");

DROP TYPE "PriceSource";
ALTER TYPE "PriceSource_new" RENAME TO "PriceSource";
