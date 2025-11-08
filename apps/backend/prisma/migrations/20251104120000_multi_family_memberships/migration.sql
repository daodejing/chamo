-- Drop old user->family relationship
DROP INDEX IF EXISTS "users_familyId_idx";

ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_familyId_fkey";

ALTER TABLE "users" DROP COLUMN IF EXISTS "familyId";

-- Add activeFamilyId column
ALTER TABLE "users"
ADD COLUMN "activeFamilyId" TEXT;

CREATE INDEX "users_activeFamilyId_idx" ON "users"("activeFamilyId");

ALTER TABLE "users"
ADD CONSTRAINT "users_activeFamilyId_fkey"
FOREIGN KEY ("activeFamilyId") REFERENCES "families"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create family_memberships table
DROP TABLE IF EXISTS "family_memberships";

CREATE TABLE "family_memberships" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "family_memberships_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "family_memberships_userId_familyId_key"
ON "family_memberships"("userId", "familyId");

CREATE INDEX "family_memberships_familyId_idx"
ON "family_memberships"("familyId");

CREATE INDEX "family_memberships_userId_idx"
ON "family_memberships"("userId");

ALTER TABLE "family_memberships"
ADD CONSTRAINT "family_memberships_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "family_memberships"
ADD CONSTRAINT "family_memberships_familyId_fkey"
FOREIGN KEY ("familyId") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;
