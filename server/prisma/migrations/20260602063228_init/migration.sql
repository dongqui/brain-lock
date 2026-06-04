-- CreateTable
CREATE TABLE "Theme" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Stock" (
    "code" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "ThemeStock" (
    "themeId" INTEGER NOT NULL,
    "stockCode" TEXT NOT NULL,

    PRIMARY KEY ("themeId", "stockCode"),
    CONSTRAINT "ThemeStock_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "Theme" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ThemeStock_stockCode_fkey" FOREIGN KEY ("stockCode") REFERENCES "Stock" ("code") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Theme_name_key" ON "Theme"("name");
