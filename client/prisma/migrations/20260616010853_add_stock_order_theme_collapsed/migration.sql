-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Theme" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "collapsed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Theme" ("createdAt", "id", "name", "order") SELECT "createdAt", "id", "name", "order" FROM "Theme";
DROP TABLE "Theme";
ALTER TABLE "new_Theme" RENAME TO "Theme";
CREATE UNIQUE INDEX "Theme_name_key" ON "Theme"("name");
CREATE TABLE "new_ThemeStock" (
    "themeId" INTEGER NOT NULL,
    "stockCode" TEXT NOT NULL,
    "stockName" TEXT NOT NULL,
    "manualLeader" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("themeId", "stockCode"),
    CONSTRAINT "ThemeStock_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "Theme" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ThemeStock" ("createdAt", "manualLeader", "stockCode", "stockName", "themeId") SELECT "createdAt", "manualLeader", "stockCode", "stockName", "themeId" FROM "ThemeStock";
DROP TABLE "ThemeStock";
ALTER TABLE "new_ThemeStock" RENAME TO "ThemeStock";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
