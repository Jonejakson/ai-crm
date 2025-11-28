-- CreateEnum
CREATE TYPE "EmailProvider" AS ENUM ('GMAIL', 'OUTLOOK', 'IMAP_SMTP', 'YANDEX');

-- AlterTable
ALTER TABLE "EmailMessage" ADD COLUMN "fromEmail" TEXT,
ADD COLUMN "messageId" TEXT,
ADD COLUMN "threadId" TEXT,
ADD COLUMN "isIncoming" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "emailIntegrationId" INTEGER,
ADD COLUMN "dealId" INTEGER;

-- CreateTable
CREATE TABLE "EmailIntegration" (
    "id" SERIAL NOT NULL,
    "provider" "EmailProvider" NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isIncomingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isOutgoingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "imapHost" TEXT,
    "imapPort" INTEGER,
    "imapUsername" TEXT,
    "imapPassword" TEXT,
    "smtpHost" TEXT,
    "smtpPort" INTEGER,
    "smtpUsername" TEXT,
    "smtpPassword" TEXT,
    "useSSL" BOOLEAN NOT NULL DEFAULT true,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "syncInterval" INTEGER NOT NULL DEFAULT 5,
    "autoCreateContact" BOOLEAN NOT NULL DEFAULT true,
    "autoCreateDeal" BOOLEAN NOT NULL DEFAULT false,
    "defaultSourceId" INTEGER,
    "defaultPipelineId" INTEGER,
    "defaultAssigneeId" INTEGER,
    "settings" JSONB,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailIntegration_companyId_email_provider_key" ON "EmailIntegration"("companyId", "email", "provider");

-- AddForeignKey
ALTER TABLE "EmailIntegration" ADD CONSTRAINT "EmailIntegration_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailIntegration" ADD CONSTRAINT "EmailIntegration_defaultAssigneeId_fkey" FOREIGN KEY ("defaultAssigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailIntegration" ADD CONSTRAINT "EmailIntegration_defaultSourceId_fkey" FOREIGN KEY ("defaultSourceId") REFERENCES "DealSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailIntegration" ADD CONSTRAINT "EmailIntegration_defaultPipelineId_fkey" FOREIGN KEY ("defaultPipelineId") REFERENCES "Pipeline"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_emailIntegrationId_fkey" FOREIGN KEY ("emailIntegrationId") REFERENCES "EmailIntegration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

