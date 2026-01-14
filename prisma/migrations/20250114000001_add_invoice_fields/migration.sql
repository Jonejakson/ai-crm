-- Add missing fields to Invoice table
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "paymentPeriodMonths" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "companyId" INTEGER;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "payerType" "PayerType" NOT NULL DEFAULT 'INDIVIDUAL';

-- Create index for companyId
CREATE INDEX IF NOT EXISTS "Invoice_companyId_idx" ON "Invoice"("companyId");

-- Add foreign key for companyId if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'Invoice_companyId_fkey'
    ) THEN
        ALTER TABLE "Invoice" 
        ADD CONSTRAINT "Invoice_companyId_fkey" 
        FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL;
    END IF;
END $$;
