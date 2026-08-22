-- CreateTable
CREATE TABLE "AiScan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subtype" TEXT,
    "label" TEXT NOT NULL,
    "confidence" REAL NOT NULL,
    "recyclable" BOOLEAN NOT NULL,
    "mock" BOOLEAN NOT NULL DEFAULT true,
    "finalMaterialId" TEXT,
    "acceptedResult" BOOLEAN,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiScan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AiScan_finalMaterialId_fkey" FOREIGN KEY ("finalMaterialId") REFERENCES "WasteMaterial" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "verificationStatus" TEXT NOT NULL DEFAULT 'unverified',
    "locale" TEXT NOT NULL DEFAULT 'en',
    "country" TEXT NOT NULL DEFAULT 'TZ',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("country", "createdAt", "email", "id", "locale", "name", "passwordHash", "phone", "role", "updatedAt") SELECT "country", "createdAt", "email", "id", "locale", "name", "passwordHash", "phone", "role", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_role_idx" ON "User"("role");
CREATE INDEX "User_verificationStatus_idx" ON "User"("verificationStatus");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "AiScan_userId_idx" ON "AiScan"("userId");
