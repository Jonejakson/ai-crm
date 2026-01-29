-- CreateTable
CREATE TABLE IF NOT EXISTS "DealMoyskladItem" (
    "id" SERIAL NOT NULL,
    "dealId" INTEGER NOT NULL,
    "moyskladOrderId" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "assortmentId" TEXT,
    "name" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "priceKopecks" INTEGER NOT NULL DEFAULT 0,
    "sumKopecks" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealMoyskladItem_pkey" PRIMARY KEY ("id")
);

-- ForeignKey
DO $$ BEGIN
  ALTER TABLE "DealMoyskladItem"
  ADD CONSTRAINT "DealMoyskladItem_dealId_fkey"
  FOREIGN KEY ("dealId") REFERENCES "Deal"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "DealMoyskladItem_dealId_positionId_key" ON "DealMoyskladItem"("dealId", "positionId");
CREATE INDEX IF NOT EXISTS "DealMoyskladItem_dealId_idx" ON "DealMoyskladItem"("dealId");
CREATE INDEX IF NOT EXISTS "DealMoyskladItem_moyskladOrderId_idx" ON "DealMoyskladItem"("moyskladOrderId");

