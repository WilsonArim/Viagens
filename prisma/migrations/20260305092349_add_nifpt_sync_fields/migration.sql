-- AlterTable
ALTER TABLE "Agency" ADD COLUMN     "nifptLastChecked" TIMESTAMP(3),
ADD COLUMN     "nifptStatus" TEXT,
ADD COLUMN     "nifptWebsite" TEXT;

-- CreateIndex
CREATE INDEX "Agency_nifptLastChecked_idx" ON "Agency"("nifptLastChecked");
