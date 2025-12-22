-- AlterTable
ALTER TABLE "File" ADD COLUMN IF NOT EXISTS "messageId" INTEGER;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "SupportTicketMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

