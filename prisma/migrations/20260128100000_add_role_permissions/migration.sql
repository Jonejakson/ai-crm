-- Add role permissions to Company (JSON: default permissions per role)
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "rolePermissions" JSONB;

-- Add per-user permission overrides to User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "permissions" JSONB;
