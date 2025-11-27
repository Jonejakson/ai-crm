-- CreateTable
CREATE TABLE "WebForm" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "fields" JSONB NOT NULL,
    "successMessage" TEXT,
    "redirectUrl" TEXT,
    "companyId" INTEGER NOT NULL,
    "sourceId" INTEGER,
    "pipelineId" INTEGER,
    "initialStage" TEXT,
    "defaultAssigneeId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebFormSubmission" (
    "id" SERIAL NOT NULL,
    "webFormId" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "status" TEXT NOT NULL DEFAULT 'success',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebFormSubmission_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "webFormId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "WebForm_token_key" ON "WebForm"("token");

-- AddForeignKey
ALTER TABLE "WebForm" ADD CONSTRAINT "WebForm_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebForm" ADD CONSTRAINT "WebForm_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "DealSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebForm" ADD CONSTRAINT "WebForm_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebForm" ADD CONSTRAINT "WebForm_defaultAssigneeId_fkey" FOREIGN KEY ("defaultAssigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebFormSubmission" ADD CONSTRAINT "WebFormSubmission_webFormId_fkey" FOREIGN KEY ("webFormId") REFERENCES "WebForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_webFormId_fkey" FOREIGN KEY ("webFormId") REFERENCES "WebForm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

