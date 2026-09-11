-- AlterTable
ALTER TABLE "public"."Holding" ADD COLUMN     "withinClassWeight" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "public"."AssetClassTarget" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assetClass" "public"."AssetClass" NOT NULL,
    "targetPercent" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetClassTarget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AssetClassTarget_userId_assetClass_key" ON "public"."AssetClassTarget"("userId", "assetClass");

-- AddForeignKey
ALTER TABLE "public"."AssetClassTarget" ADD CONSTRAINT "AssetClassTarget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
