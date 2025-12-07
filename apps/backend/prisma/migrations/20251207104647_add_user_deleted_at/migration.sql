-- DropIndex
DROP INDEX "public"."users_email_key";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "users_deletedAt_idx" ON "users"("deletedAt");

-- Story 1.14 AC6: Create partial unique index for email where user is not soft-deleted
-- This allows re-registration with the same email after account deletion
CREATE UNIQUE INDEX "users_email_active_idx" ON "users"("email") WHERE "deletedAt" IS NULL;
