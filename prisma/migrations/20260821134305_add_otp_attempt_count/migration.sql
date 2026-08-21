-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_OtpChallenge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "consumedAt" DATETIME,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_OtpChallenge" ("codeHash", "consumedAt", "createdAt", "expiresAt", "id", "phone") SELECT "codeHash", "consumedAt", "createdAt", "expiresAt", "id", "phone" FROM "OtpChallenge";
DROP TABLE "OtpChallenge";
ALTER TABLE "new_OtpChallenge" RENAME TO "OtpChallenge";
CREATE INDEX "OtpChallenge_phone_idx" ON "OtpChallenge"("phone");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
