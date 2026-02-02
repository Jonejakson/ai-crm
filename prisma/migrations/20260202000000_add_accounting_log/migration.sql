-- CreateTable
CREATE TABLE IF NOT EXISTS "AccountingLog" (
    "id" SERIAL NOT NULL,
    "accountingId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" INTEGER,
    "externalId" TEXT,
    "payload" JSONB,
    "response" JSONB,
    "status" TEXT NOT NULL DEFAULT 'success',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountingLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AccountingLog_accountingId_createdAt_idx" ON "AccountingLog"("accountingId", "createdAt");
CREATE INDEX IF NOT EXISTS "AccountingLog_entityType_entityId_idx" ON "AccountingLog"("entityType", "entityId");

-- AddForeignKey (only if missing)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AccountingLog_accountingId_fkey') THEN
    ALTER TABLE "AccountingLog"
      ADD CONSTRAINT "AccountingLog_accountingId_fkey"
      FOREIGN KEY ("accountingId") REFERENCES "AccountingIntegration"("id") ON DELETE CASCADE;
  END IF;
END $$;
