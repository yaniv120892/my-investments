-- CreateTable
CREATE TABLE "public"."AdvisorTurn" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "toolIds" TEXT[],
    "plannedCount" INTEGER NOT NULL,
    "refusalReasons" TEXT[],
    "isGrounded" BOOLEAN NOT NULL,
    "ungrounded" TEXT[],
    "replyChars" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL,

    CONSTRAINT "AdvisorTurn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdvisorTurn_userId_createdAt_idx" ON "public"."AdvisorTurn"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."AdvisorTurn" ADD CONSTRAINT "AdvisorTurn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
