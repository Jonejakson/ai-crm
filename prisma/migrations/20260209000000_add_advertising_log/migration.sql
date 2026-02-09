-- CreateTable
CREATE TABLE IF NOT EXISTS "AdvertisingLog" (
    "id" SERIAL NOT NULL,
    "advertisingId" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "response" JSONB,
    "status" TEXT NOT NULL DEFAULT 'success',
    "errorMessage" TEXT,
    "contactId" INTEGER,
    "dealId" INTEGER,
    "leadId" TEXT,
    "campaignId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvertisingLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AdvertisingLog_advertisingId_createdAt_idx" ON "AdvertisingLog"("advertisingId", "createdAt");

-- AddForeignKey (only if constraint doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdvertisingLog_advertisingId_fkey') THEN
    ALTER TABLE "AdvertisingLog"
      ADD CONSTRAINT "AdvertisingLog_advertisingId_fkey"
      FOREIGN KEY ("advertisingId") REFERENCES "AdvertisingIntegration"("id") ON DELETE CASCADE;
  END IF;
END $$;
