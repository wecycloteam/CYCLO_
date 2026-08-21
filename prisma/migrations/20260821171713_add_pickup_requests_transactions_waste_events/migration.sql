-- CreateTable
CREATE TABLE "PickupRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "producerId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "listingId" TEXT,
    "estimatedWeightKg" REAL NOT NULL,
    "verifiedWeightKg" REAL,
    "weightRecordedByUserId" TEXT,
    "weightRecordedAt" DATETIME,
    "weightMethod" TEXT,
    "preferredTime" DATETIME,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "assignedCollectorId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PickupRequest_producerId_fkey" FOREIGN KEY ("producerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PickupRequest_assignedCollectorId_fkey" FOREIGN KEY ("assignedCollectorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PickupRequest_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PickupRequest_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "WasteMaterial" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PickupRequest_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "WasteListing" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reference" TEXT NOT NULL,
    "pickupRequestId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "collectorId" TEXT,
    "buyerId" TEXT,
    "materialId" TEXT NOT NULL,
    "verifiedWeightKg" REAL NOT NULL,
    "agreedPrice" REAL,
    "platformFee" REAL NOT NULL DEFAULT 0,
    "grossAmount" REAL,
    "netAmount" REAL,
    "paymentStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Transaction_pickupRequestId_fkey" FOREIGN KEY ("pickupRequestId") REFERENCES "PickupRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Transaction_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Transaction_collectorId_fkey" FOREIGN KEY ("collectorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transaction_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "WasteMaterial" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WasteEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pickupRequestId" TEXT,
    "transactionId" TEXT,
    "eventType" TEXT NOT NULL,
    "actorId" TEXT,
    "notes" TEXT,
    "previousState" TEXT,
    "newState" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WasteEvent_pickupRequestId_fkey" FOREIGN KEY ("pickupRequestId") REFERENCES "PickupRequest" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "WasteEvent_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "WasteEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PickupRequest_producerId_idx" ON "PickupRequest"("producerId");

-- CreateIndex
CREATE INDEX "PickupRequest_assignedCollectorId_idx" ON "PickupRequest"("assignedCollectorId");

-- CreateIndex
CREATE INDEX "PickupRequest_status_idx" ON "PickupRequest"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_reference_key" ON "Transaction"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_pickupRequestId_key" ON "Transaction"("pickupRequestId");

-- CreateIndex
CREATE INDEX "Transaction_sellerId_idx" ON "Transaction"("sellerId");

-- CreateIndex
CREATE INDEX "WasteEvent_pickupRequestId_idx" ON "WasteEvent"("pickupRequestId");

-- CreateIndex
CREATE INDEX "WasteEvent_transactionId_idx" ON "WasteEvent"("transactionId");
