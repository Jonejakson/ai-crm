-- Add visibility scope and pipeline assignment to User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "visibilityScope" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "assignedPipelineIds" JSONB;
