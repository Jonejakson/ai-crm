-- AlterTable: Добавляем поля для типа пользователя (физ/юр лицо)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastName" TEXT;

-- AlterTable: Добавляем поля для компании (ИНН и флаг юр лица)
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "inn" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "isLegalEntity" BOOLEAN NOT NULL DEFAULT false;

