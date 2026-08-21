-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WasteListing" (
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
    "moderationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "moderationReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "expiresAt" DATETIME,
    CONSTRAINT "WasteListing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WasteListing_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "WasteMaterial" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WasteListing_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_WasteListing" ("askingPrice", "condition", "createdAt", "description", "estimatedWeightKg", "expiresAt", "grade", "id", "locationId", "materialId", "photos", "pickupOption", "purity", "sellerId", "status", "updatedAt", "verifiedWeightKg") SELECT "askingPrice", "condition", "createdAt", "description", "estimatedWeightKg", "expiresAt", "grade", "id", "locationId", "materialId", "photos", "pickupOption", "purity", "sellerId", "status", "updatedAt", "verifiedWeightKg" FROM "WasteListing";
DROP TABLE "WasteListing";
ALTER TABLE "new_WasteListing" RENAME TO "WasteListing";
CREATE INDEX "WasteListing_sellerId_idx" ON "WasteListing"("sellerId");
CREATE INDEX "WasteListing_materialId_idx" ON "WasteListing"("materialId");
CREATE INDEX "WasteListing_status_idx" ON "WasteListing"("status");
CREATE INDEX "WasteListing_moderationStatus_idx" ON "WasteListing"("moderationStatus");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
