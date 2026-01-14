-- Add invoiceNumber column to Invoice table
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "invoiceNumber" TEXT;

-- Create unique index on invoiceNumber
CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS "Invoice_invoiceNumber_idx" ON "Invoice"("invoiceNumber");
