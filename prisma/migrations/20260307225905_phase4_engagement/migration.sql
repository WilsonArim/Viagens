-- AlterTable: add shareToken to AgencyCheck
ALTER TABLE "AgencyCheck" ADD COLUMN "shareToken" TEXT;

-- CreateIndex: unique shareToken
CREATE UNIQUE INDEX "AgencyCheck_shareToken_key" ON "AgencyCheck"("shareToken");

-- CreateTable: SavedAgency
CREATE TABLE "SavedAgency" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedAgency_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: unique userId+agencyId combo
CREATE UNIQUE INDEX "SavedAgency_userId_agencyId_key" ON "SavedAgency"("userId", "agencyId");

-- CreateIndex: index on userId
CREATE INDEX "SavedAgency_userId_idx" ON "SavedAgency"("userId");

-- AddForeignKey: SavedAgency → User
ALTER TABLE "SavedAgency" ADD CONSTRAINT "SavedAgency_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: SavedAgency → Agency
ALTER TABLE "SavedAgency" ADD CONSTRAINT "SavedAgency_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
