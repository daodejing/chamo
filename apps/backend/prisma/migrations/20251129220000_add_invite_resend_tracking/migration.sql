-- Add resend tracking columns to invites table
ALTER TABLE "invites" ADD COLUMN "resendCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "invites" ADD COLUMN "lastResendAt" TIMESTAMP(3);
