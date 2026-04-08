-- CreateTable
CREATE TABLE "TeamListing" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "pricePerDay" DECIMAL(18,6) NOT NULL,
    "minDays" INTEGER NOT NULL DEFAULT 1,
    "maxDays" INTEGER NOT NULL DEFAULT 30,
    "availableFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "availableUntil" TIMESTAMP(3),
    "status" "ListingStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ownerId" TEXT NOT NULL,

    CONSTRAINT "TeamListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamListingAxie" (
    "id" TEXT NOT NULL,
    "axieId" TEXT NOT NULL,
    "axieClass" TEXT,
    "axieName" TEXT,
    "axieGenes" TEXT,
    "fortuneSlips" INTEGER,
    "teamListingId" TEXT NOT NULL,

    CONSTRAINT "TeamListingAxie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamRental" (
    "id" TEXT NOT NULL,
    "totalPrice" DECIMAL(18,6) NOT NULL,
    "rentalDays" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "escrowTxHash" TEXT,
    "delegationTxHash" TEXT,
    "releaseTxHash" TEXT,
    "refundTxHash" TEXT,
    "delegationDeadline" TIMESTAMP(3),
    "status" "RentalStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "teamListingId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "borrowerId" TEXT NOT NULL,

    CONSTRAINT "TeamRental_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeamListing_status_idx" ON "TeamListing"("status");

-- CreateIndex
CREATE INDEX "TeamListingAxie_teamListingId_idx" ON "TeamListingAxie"("teamListingId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamListingAxie_teamListingId_axieId_key" ON "TeamListingAxie"("teamListingId", "axieId");

-- CreateIndex
CREATE INDEX "TeamRental_status_idx" ON "TeamRental"("status");

-- CreateIndex
CREATE INDEX "TeamRental_ownerId_idx" ON "TeamRental"("ownerId");

-- CreateIndex
CREATE INDEX "TeamRental_borrowerId_idx" ON "TeamRental"("borrowerId");

-- AddForeignKey
ALTER TABLE "TeamListing" ADD CONSTRAINT "TeamListing_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamListingAxie" ADD CONSTRAINT "TeamListingAxie_teamListingId_fkey" FOREIGN KEY ("teamListingId") REFERENCES "TeamListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamRental" ADD CONSTRAINT "TeamRental_teamListingId_fkey" FOREIGN KEY ("teamListingId") REFERENCES "TeamListing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamRental" ADD CONSTRAINT "TeamRental_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamRental" ADD CONSTRAINT "TeamRental_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
