-- Fix missing enum types + integration tables/constraints (idempotent)

-- 1) Ensure enum types exist (PostgreSQL has no CREATE TYPE IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AdvertisingPlatform') THEN
    CREATE TYPE "AdvertisingPlatform" AS ENUM ('YANDEX_DIRECT', 'AVITO', 'GOOGLE_ADS');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AccountingPlatform') THEN
    CREATE TYPE "AccountingPlatform" AS ENUM ('MOYSKLAD', 'ONE_C', 'BITRIX24');
  END IF;
END $$;

-- 2) Add missing columns to MessagingIntegration (if table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'MessagingIntegration'
  ) THEN
    ALTER TABLE "MessagingIntegration"
      ADD COLUMN IF NOT EXISTS "autoCreateContact" BOOLEAN NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS "autoCreateDeal" BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "defaultSourceId" INTEGER,
      ADD COLUMN IF NOT EXISTS "defaultPipelineId" INTEGER,
      ADD COLUMN IF NOT EXISTS "defaultAssigneeId" INTEGER;
  END IF;
END $$;

-- 3) Foreign keys for MessagingIntegration (add only if missing)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='MessagingIntegration')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MessagingIntegration_defaultSourceId_fkey') THEN
    ALTER TABLE "MessagingIntegration"
      ADD CONSTRAINT "MessagingIntegration_defaultSourceId_fkey"
      FOREIGN KEY ("defaultSourceId") REFERENCES "DealSource"("id") ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='MessagingIntegration')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MessagingIntegration_defaultPipelineId_fkey') THEN
    ALTER TABLE "MessagingIntegration"
      ADD CONSTRAINT "MessagingIntegration_defaultPipelineId_fkey"
      FOREIGN KEY ("defaultPipelineId") REFERENCES "Pipeline"("id") ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='MessagingIntegration')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MessagingIntegration_defaultAssigneeId_fkey') THEN
    ALTER TABLE "MessagingIntegration"
      ADD CONSTRAINT "MessagingIntegration_defaultAssigneeId_fkey"
      FOREIGN KEY ("defaultAssigneeId") REFERENCES "User"("id") ON DELETE SET NULL;
  END IF;
END $$;

-- 4) Create AccountingIntegration table (if missing)
CREATE TABLE IF NOT EXISTS "AccountingIntegration" (
  "id" SERIAL NOT NULL,
  "platform" "AccountingPlatform" NOT NULL,
  "name" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "apiToken" TEXT,
  "apiSecret" TEXT,
  "baseUrl" TEXT,
  "accountId" TEXT,
  "syncContacts" BOOLEAN NOT NULL DEFAULT true,
  "syncDeals" BOOLEAN NOT NULL DEFAULT true,
  "syncProducts" BOOLEAN NOT NULL DEFAULT false,
  "autoSync" BOOLEAN NOT NULL DEFAULT false,
  "syncInterval" INTEGER NOT NULL DEFAULT 60,
  "contactMapping" JSONB,
  "dealMapping" JSONB,
  "productMapping" JSONB,
  "settings" JSONB,
  "lastSyncAt" TIMESTAMP(3),
  "companyId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AccountingIntegration_pkey" PRIMARY KEY ("id")
);

-- 5) Create AdvertisingIntegration table (if missing)
CREATE TABLE IF NOT EXISTS "AdvertisingIntegration" (
  "id" SERIAL NOT NULL,
  "platform" "AdvertisingPlatform" NOT NULL,
  "name" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "apiToken" TEXT,
  "apiSecret" TEXT,
  "accountId" TEXT,
  "autoCreateContact" BOOLEAN NOT NULL DEFAULT true,
  "autoCreateDeal" BOOLEAN NOT NULL DEFAULT false,
  "defaultSourceId" INTEGER,
  "defaultPipelineId" INTEGER,
  "defaultAssigneeId" INTEGER,
  "webhookUrl" TEXT,
  "webhookSecret" TEXT,
  "settings" JSONB,
  "companyId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdvertisingIntegration_pkey" PRIMARY KEY ("id")
);

-- 6) Create WebhookIntegration table (if missing)
CREATE TABLE IF NOT EXISTS "WebhookIntegration" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "description" TEXT,
  "autoCreateContact" BOOLEAN NOT NULL DEFAULT true,
  "autoCreateDeal" BOOLEAN NOT NULL DEFAULT false,
  "defaultSourceId" INTEGER,
  "defaultPipelineId" INTEGER,
  "defaultAssigneeId" INTEGER,
  "fieldMapping" JSONB,
  "settings" JSONB,
  "companyId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WebhookIntegration_pkey" PRIMARY KEY ("id")
);

-- 7) Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "WebhookIntegration_token_key" ON "WebhookIntegration"("token");
CREATE UNIQUE INDEX IF NOT EXISTS "AccountingIntegration_companyId_platform_key" ON "AccountingIntegration"("companyId", "platform");
CREATE UNIQUE INDEX IF NOT EXISTS "AdvertisingIntegration_companyId_platform_key" ON "AdvertisingIntegration"("companyId", "platform");

-- 8) Foreign keys (add only if missing)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AccountingIntegration_companyId_fkey') THEN
    ALTER TABLE "AccountingIntegration"
      ADD CONSTRAINT "AccountingIntegration_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdvertisingIntegration_companyId_fkey') THEN
    ALTER TABLE "AdvertisingIntegration"
      ADD CONSTRAINT "AdvertisingIntegration_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdvertisingIntegration_defaultSourceId_fkey') THEN
    ALTER TABLE "AdvertisingIntegration"
      ADD CONSTRAINT "AdvertisingIntegration_defaultSourceId_fkey"
      FOREIGN KEY ("defaultSourceId") REFERENCES "DealSource"("id") ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdvertisingIntegration_defaultPipelineId_fkey') THEN
    ALTER TABLE "AdvertisingIntegration"
      ADD CONSTRAINT "AdvertisingIntegration_defaultPipelineId_fkey"
      FOREIGN KEY ("defaultPipelineId") REFERENCES "Pipeline"("id") ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdvertisingIntegration_defaultAssigneeId_fkey') THEN
    ALTER TABLE "AdvertisingIntegration"
      ADD CONSTRAINT "AdvertisingIntegration_defaultAssigneeId_fkey"
      FOREIGN KEY ("defaultAssigneeId") REFERENCES "User"("id") ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WebhookIntegration_companyId_fkey') THEN
    ALTER TABLE "WebhookIntegration"
      ADD CONSTRAINT "WebhookIntegration_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WebhookIntegration_defaultSourceId_fkey') THEN
    ALTER TABLE "WebhookIntegration"
      ADD CONSTRAINT "WebhookIntegration_defaultSourceId_fkey"
      FOREIGN KEY ("defaultSourceId") REFERENCES "DealSource"("id") ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WebhookIntegration_defaultPipelineId_fkey') THEN
    ALTER TABLE "WebhookIntegration"
      ADD CONSTRAINT "WebhookIntegration_defaultPipelineId_fkey"
      FOREIGN KEY ("defaultPipelineId") REFERENCES "Pipeline"("id") ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WebhookIntegration_defaultAssigneeId_fkey') THEN
    ALTER TABLE "WebhookIntegration"
      ADD CONSTRAINT "WebhookIntegration_defaultAssigneeId_fkey"
      FOREIGN KEY ("defaultAssigneeId") REFERENCES "User"("id") ON DELETE SET NULL;
  END IF;
END $$;

