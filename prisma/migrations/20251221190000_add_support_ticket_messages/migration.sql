-- AlterTable
ALTER TABLE "SupportTicket" ADD COLUMN "ticketId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "SupportTicket_ticketId_key" ON "SupportTicket"("ticketId");

-- CreateIndex
CREATE INDEX "SupportTicket_ticketId_idx" ON "SupportTicket"("ticketId");

-- CreateTable
CREATE TABLE "SupportTicketMessage" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "fromName" TEXT,
    "isFromAdmin" BOOLEAN NOT NULL DEFAULT false,
    "emailMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportTicketMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupportTicketMessage_ticketId_idx" ON "SupportTicketMessage"("ticketId");

-- AddForeignKey
ALTER TABLE "SupportTicketMessage" ADD CONSTRAINT "SupportTicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Генерируем ticketId для существующих тикетов
UPDATE "SupportTicket" 
SET "ticketId" = 'TKT-' || "id" || '-' || EXTRACT(EPOCH FROM "createdAt")::BIGINT
WHERE "ticketId" IS NULL;



