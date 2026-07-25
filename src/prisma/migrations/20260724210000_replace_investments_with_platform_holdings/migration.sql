-- CreateEnum
CREATE TYPE "public"."AssetClass" AS ENUM ('EQUITY', 'CRYPTO', 'NON_EQUITY');

-- CreateEnum
CREATE TYPE "public"."Liquidity" AS ENUM ('LIQUID', 'ILLIQUID');

-- CreateEnum
CREATE TYPE "public"."PriceSource" AS ENUM ('FINNHUB', 'BINANCE', 'BIZPORTAL', 'MANUAL');

-- DropForeignKey
ALTER TABLE "public"."Investment" DROP CONSTRAINT "Investment_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."InvestmentSnapshot" DROP CONSTRAINT "InvestmentSnapshot_investmentId_fkey";

-- DropTable
DROP TABLE "public"."Investment";

-- DropTable
DROP TABLE "public"."InvestmentSnapshot";

-- DropEnum
DROP TYPE "public"."InvestmentType";

-- CreateTable
CREATE TABLE "public"."Platform" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseCurrency" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Platform_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Holding" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platformId" TEXT NOT NULL,
    "assetName" TEXT NOT NULL,
    "assetClass" "public"."AssetClass" NOT NULL,
    "liquidity" "public"."Liquidity" NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "priceSource" "public"."PriceSource" NOT NULL,
    "sourceSymbol" TEXT,
    "currency" TEXT NOT NULL,
    "targetPercent" DOUBLE PRECISION,
    "manualValueNis" DOUBLE PRECISION,
    "manualValueUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Holding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."HoldingSnapshot" (
    "id" TEXT NOT NULL,
    "holdingId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "fxRateUsed" DOUBLE PRECISION NOT NULL,
    "valueNis" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "HoldingSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Platform_userId_name_key" ON "public"."Platform"("userId", "name");

-- CreateIndex
CREATE INDEX "Holding_userId_idx" ON "public"."Holding"("userId");

-- CreateIndex
CREATE INDEX "HoldingSnapshot_date_idx" ON "public"."HoldingSnapshot"("date");

-- CreateIndex
CREATE UNIQUE INDEX "HoldingSnapshot_holdingId_date_key" ON "public"."HoldingSnapshot"("holdingId", "date");

-- AddForeignKey
ALTER TABLE "public"."Platform" ADD CONSTRAINT "Platform_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Holding" ADD CONSTRAINT "Holding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Holding" ADD CONSTRAINT "Holding_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "public"."Platform"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."HoldingSnapshot" ADD CONSTRAINT "HoldingSnapshot_holdingId_fkey" FOREIGN KEY ("holdingId") REFERENCES "public"."Holding"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

