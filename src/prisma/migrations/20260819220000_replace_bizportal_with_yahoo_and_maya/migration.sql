-- Bizportal answers only Israeli IPs, so it 403s from every Vercel region. The four
-- TASE holdings move to sources that answer from anywhere: the ETFs to their European
-- listings on Yahoo, the mutual fund to Maya, the TASE system Bizportal was reporting.
-- Each security number becomes the symbol its new source uses, so the remap has to run
-- here — dropping BIZPORTAL without it would orphan the rows.

CREATE TYPE "PriceSource_new" AS ENUM ('FINNHUB', 'BINANCE', 'YAHOO', 'MAYA', 'MANUAL');

ALTER TABLE "Holding" ALTER COLUMN "priceSource" TYPE text;

UPDATE "Holding" SET "priceSource" = 'YAHOO', "sourceSymbol" = 'CSPX.L'
  WHERE "priceSource" = 'BIZPORTAL' AND "sourceSymbol" = '1159250';
UPDATE "Holding" SET "priceSource" = 'YAHOO', "sourceSymbol" = 'EIMI.L'
  WHERE "priceSource" = 'BIZPORTAL' AND "sourceSymbol" = '1159169';
UPDATE "Holding" SET "priceSource" = 'YAHOO', "sourceSymbol" = 'IMAE.AS'
  WHERE "priceSource" = 'BIZPORTAL' AND "sourceSymbol" = '1159094';
UPDATE "Holding" SET "priceSource" = 'MAYA'
  WHERE "priceSource" = 'BIZPORTAL' AND "sourceSymbol" = '5109889';

-- A BIZPORTAL row the remap above did not cover fails this cast, which aborts the
-- migration rather than leaving a holding pointing at a source that no longer exists.
ALTER TABLE "Holding" ALTER COLUMN "priceSource" TYPE "PriceSource_new"
  USING ("priceSource"::"PriceSource_new");

DROP TYPE "PriceSource";
ALTER TYPE "PriceSource_new" RENAME TO "PriceSource";
