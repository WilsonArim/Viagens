-- AlterTable
ALTER TABLE "AgencyCheck" ADD COLUMN     "agencyId" TEXT;

-- CreateTable
CREATE TABLE "Agency" (
    "id" TEXT NOT NULL,
    "rnavt" TEXT NOT NULL,
    "nif" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "commercialName" TEXT,
    "address" TEXT,
    "city" TEXT,
    "district" TEXT,
    "postalCode" TEXT,
    "phone" TEXT,
    "googleRating" DOUBLE PRECISION,
    "googleReviewCount" INTEGER,
    "googleReviews" JSONB,
    "googlePlaceId" TEXT,
    "googleCachedAt" TIMESTAMP(3),
    "complaintsSummary" JSONB,
    "complaintsCachedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgencyExternalLink" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgencyExternalLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Agency_rnavt_key" ON "Agency"("rnavt");

-- CreateIndex
CREATE INDEX "Agency_nif_idx" ON "Agency"("nif");

-- CreateIndex
CREATE INDEX "Agency_legalName_idx" ON "Agency"("legalName");

-- CreateIndex
CREATE INDEX "Agency_commercialName_idx" ON "Agency"("commercialName");

-- CreateIndex
CREATE UNIQUE INDEX "AgencyExternalLink_agencyId_source_key" ON "AgencyExternalLink"("agencyId", "source");

-- AddForeignKey
ALTER TABLE "AgencyExternalLink" ADD CONSTRAINT "AgencyExternalLink_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgencyCheck" ADD CONSTRAINT "AgencyCheck_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;
