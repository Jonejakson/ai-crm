-- Add performance indexes for frequently used queries

-- Contact indexes
CREATE INDEX IF NOT EXISTS "Contact_email_idx" ON "Contact"("email");
CREATE INDEX IF NOT EXISTS "Contact_phone_idx" ON "Contact"("phone");
CREATE INDEX IF NOT EXISTS "Contact_userId_idx" ON "Contact"("userId");
CREATE INDEX IF NOT EXISTS "Contact_createdAt_idx" ON "Contact"("createdAt");

-- Task indexes
CREATE INDEX IF NOT EXISTS "Task_userId_idx" ON "Task"("userId");
CREATE INDEX IF NOT EXISTS "Task_contactId_idx" ON "Task"("contactId");
CREATE INDEX IF NOT EXISTS "Task_status_idx" ON "Task"("status");
CREATE INDEX IF NOT EXISTS "Task_dueDate_idx" ON "Task"("dueDate");
CREATE INDEX IF NOT EXISTS "Task_userId_status_idx" ON "Task"("userId", "status");

-- Deal indexes
CREATE INDEX IF NOT EXISTS "Deal_userId_idx" ON "Deal"("userId");
CREATE INDEX IF NOT EXISTS "Deal_contactId_idx" ON "Deal"("contactId");
CREATE INDEX IF NOT EXISTS "Deal_stage_idx" ON "Deal"("stage");
CREATE INDEX IF NOT EXISTS "Deal_pipelineId_idx" ON "Deal"("pipelineId");
CREATE INDEX IF NOT EXISTS "Deal_createdAt_idx" ON "Deal"("createdAt");
CREATE INDEX IF NOT EXISTS "Deal_userId_stage_idx" ON "Deal"("userId", "stage");
CREATE INDEX IF NOT EXISTS "Deal_pipelineId_stage_idx" ON "Deal"("pipelineId", "stage");

-- Event indexes
CREATE INDEX IF NOT EXISTS "Event_userId_idx" ON "Event"("userId");
CREATE INDEX IF NOT EXISTS "Event_contactId_idx" ON "Event"("contactId");
CREATE INDEX IF NOT EXISTS "Event_startDate_idx" ON "Event"("startDate");
CREATE INDEX IF NOT EXISTS "Event_userId_startDate_idx" ON "Event"("userId", "startDate");

-- User indexes
CREATE INDEX IF NOT EXISTS "User_companyId_idx" ON "User"("companyId");
CREATE INDEX IF NOT EXISTS "User_role_idx" ON "User"("role");
CREATE INDEX IF NOT EXISTS "User_passwordResetToken_idx" ON "User"("passwordResetToken");

-- ActivityLog indexes
CREATE INDEX IF NOT EXISTS "ActivityLog_userId_idx" ON "ActivityLog"("userId");
CREATE INDEX IF NOT EXISTS "ActivityLog_companyId_idx" ON "ActivityLog"("companyId");
CREATE INDEX IF NOT EXISTS "ActivityLog_entityType_entityId_idx" ON "ActivityLog"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");
CREATE INDEX IF NOT EXISTS "ActivityLog_companyId_createdAt_idx" ON "ActivityLog"("companyId", "createdAt");

-- EmailMessage indexes
CREATE INDEX IF NOT EXISTS "EmailMessage_fromEmail_idx" ON "EmailMessage"("fromEmail");
CREATE INDEX IF NOT EXISTS "EmailMessage_toEmail_idx" ON "EmailMessage"("toEmail");
CREATE INDEX IF NOT EXISTS "EmailMessage_contactId_idx" ON "EmailMessage"("contactId");
CREATE INDEX IF NOT EXISTS "EmailMessage_dealId_idx" ON "EmailMessage"("dealId");
CREATE INDEX IF NOT EXISTS "EmailMessage_userId_idx" ON "EmailMessage"("userId");
CREATE INDEX IF NOT EXISTS "EmailMessage_createdAt_idx" ON "EmailMessage"("createdAt");

