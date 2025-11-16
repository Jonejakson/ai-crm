-- CreateTable: Создаем таблицу Company
CREATE TABLE "Company" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- Создаем дефолтную компанию для существующих данных
INSERT INTO "Company" ("name", "createdAt", "updatedAt") 
VALUES ('Default Company', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Добавляем companyId как nullable сначала
ALTER TABLE "User" ADD COLUMN "companyId" INTEGER;
ALTER TABLE "Pipeline" ADD COLUMN "companyId" INTEGER;

-- Заполняем companyId для существующих записей (используем ID дефолтной компании = 1)
UPDATE "User" SET "companyId" = 1 WHERE "companyId" IS NULL;
UPDATE "Pipeline" SET "companyId" = 1 WHERE "companyId" IS NULL;

-- Делаем companyId обязательным
ALTER TABLE "User" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "Pipeline" ALTER COLUMN "companyId" SET NOT NULL;

-- Добавляем foreign keys
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Pipeline" ADD CONSTRAINT "Pipeline_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
