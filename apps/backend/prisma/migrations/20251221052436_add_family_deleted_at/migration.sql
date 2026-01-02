-- AlterTable
ALTER TABLE "families" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "families_deletedAt_idx" ON "families"("deletedAt");
