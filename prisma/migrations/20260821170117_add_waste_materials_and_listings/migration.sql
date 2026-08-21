-- CreateTable
CREATE TABLE "WasteMaterial" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category" TEXT NOT NULL,
    "subtype" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "recyclable" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "WasteListing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sellerId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "estimatedWeightKg" REAL NOT NULL,
    "verifiedWeightKg" REAL,
    "condition" TEXT,
    "grade" TEXT,
    "purity" REAL,
    "photos" TEXT,
    "askingPrice" REAL,
    "pickupOption" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "expiresAt" DATETIME,
    CONSTRAINT "WasteListing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WasteListing_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "WasteMaterial" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WasteListing_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "WasteMaterial_category_idx" ON "WasteMaterial"("category");

-- CreateIndex
CREATE UNIQUE INDEX "WasteMaterial_category_subtype_key" ON "WasteMaterial"("category", "subtype");

-- CreateIndex
CREATE INDEX "WasteListing_sellerId_idx" ON "WasteListing"("sellerId");

-- CreateIndex
CREATE INDEX "WasteListing_materialId_idx" ON "WasteListing"("materialId");

-- CreateIndex
CREATE INDEX "WasteListing_status_idx" ON "WasteListing"("status");
