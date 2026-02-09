-- Подтверждение email для админа при регистрации компании
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerificationToken" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerificationExpires" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "User_emailVerificationToken_idx" ON "User"("emailVerificationToken");
