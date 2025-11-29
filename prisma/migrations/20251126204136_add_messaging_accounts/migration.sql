-- CreateEnum
CREATE TYPE "MessagingPlatform" AS ENUM ('TELEGRAM', 'WHATSAPP', 'INTERNAL');

-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "telegramChatId" TEXT,
ADD COLUMN     "whatsappId" TEXT;

-- AlterTable
ALTER TABLE "Dialog" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "platform" "MessagingPlatform" NOT NULL DEFAULT 'INTERNAL';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "phone" TEXT;

-- CreateTable
CREATE TABLE "MessagingIntegration" (
    "id" SERIAL NOT NULL,
    "platform" "MessagingPlatform" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "botToken" TEXT,
    "webhookUrl" TEXT,
    "webhookSecret" TEXT,
    "settings" JSONB,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessagingIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserMessagingAccount" (
    "id" SERIAL NOT NULL,
    "platform" "MessagingPlatform" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "phone" TEXT,
    "telegramApiId" TEXT,
    "telegramApiHash" TEXT,
    "telegramSession" TEXT,
    "whatsappSession" TEXT,
    "settings" JSONB,
    "lastSyncAt" TIMESTAMP(3),
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserMessagingAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MessagingIntegration_companyId_platform_key" ON "MessagingIntegration"("companyId", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "UserMessagingAccount_userId_platform_key" ON "UserMessagingAccount"("userId", "platform");

-- AddForeignKey
ALTER TABLE "MessagingIntegration" ADD CONSTRAINT "MessagingIntegration_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMessagingAccount" ADD CONSTRAINT "UserMessagingAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
