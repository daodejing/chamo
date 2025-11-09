-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');

-- CreateTable
CREATE TABLE "invites" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "inviteeEmail" TEXT NOT NULL,
    "encryptedFamilyKey" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "inviteCode" TEXT NOT NULL,
    "status" "InviteStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invites_inviteCode_key" ON "invites"("inviteCode");

-- CreateIndex
CREATE INDEX "invites_inviteCode_idx" ON "invites"("inviteCode");

-- CreateIndex
CREATE INDEX "invites_inviteeEmail_idx" ON "invites"("inviteeEmail");

-- CreateIndex
CREATE INDEX "invites_familyId_idx" ON "invites"("familyId");

-- CreateIndex
CREATE INDEX "invites_status_idx" ON "invites"("status");

-- AddForeignKey
ALTER TABLE "invites" ADD CONSTRAINT "invites_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invites" ADD CONSTRAINT "invites_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
