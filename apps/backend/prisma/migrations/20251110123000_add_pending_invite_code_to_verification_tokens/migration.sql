-- Add optional pendingInviteCode column to email verification tokens
ALTER TABLE "email_verification_tokens"
ADD COLUMN "pendingInviteCode" TEXT;
