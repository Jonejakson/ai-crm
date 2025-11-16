-- AlterTable
ALTER TABLE "Company" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Contact" ALTER COLUMN "email" DROP NOT NULL;
