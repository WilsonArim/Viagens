-- CreateTable
CREATE TABLE "AgencyCheck" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tripId" TEXT,
    "cacheKey" TEXT NOT NULL,
    "input" TEXT NOT NULL,
    "rnavt" TEXT,
    "agencyName" TEXT,
    "verdict" TEXT NOT NULL,
    "verdictText" TEXT NOT NULL,
    "rnavtStatus" TEXT NOT NULL,
    "rnavtData" JSONB,
    "onlineData" JSONB,
    "complaints" JSONB,
    "redFlags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "greenFlags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "detectiveNote" TEXT NOT NULL,
    "rawReport" TEXT NOT NULL,
    "usedGrok" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgencyCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgencyCheck_cacheKey_idx" ON "AgencyCheck"("cacheKey");

-- CreateIndex
CREATE INDEX "AgencyCheck_userId_idx" ON "AgencyCheck"("userId");

-- AddForeignKey
ALTER TABLE "AgencyCheck" ADD CONSTRAINT "AgencyCheck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgencyCheck" ADD CONSTRAINT "AgencyCheck_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE SET NULL ON UPDATE CASCADE;
