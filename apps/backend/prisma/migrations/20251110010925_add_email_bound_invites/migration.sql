-- CreateTable
CREATE TABLE "family_invites" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(22) NOT NULL,
    "codeHash" VARCHAR(64) NOT NULL,
    "familyId" TEXT NOT NULL,
    "inviteeEmailEncrypted" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "redeemedAt" TIMESTAMP(3),
    "redeemedByUserId" TEXT,

    CONSTRAINT "family_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "family_invites_code_key" ON "family_invites"("code");

-- CreateIndex
CREATE UNIQUE INDEX "family_invites_codeHash_key" ON "family_invites"("codeHash");

-- CreateIndex
CREATE INDEX "family_invites_codeHash_idx" ON "family_invites"("codeHash");

-- CreateIndex
CREATE INDEX "family_invites_familyId_idx" ON "family_invites"("familyId");

-- CreateIndex
CREATE INDEX "family_invites_inviteeEmailEncrypted_idx" ON "family_invites"("inviteeEmailEncrypted");

-- AddForeignKey
ALTER TABLE "family_invites" ADD CONSTRAINT "family_invites_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_invites" ADD CONSTRAINT "family_invites_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_invites" ADD CONSTRAINT "family_invites_redeemedByUserId_fkey" FOREIGN KEY ("redeemedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
