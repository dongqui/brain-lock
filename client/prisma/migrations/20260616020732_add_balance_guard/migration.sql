-- CreateTable
CREATE TABLE "LedgerPosition" (
    "stockCode" TEXT NOT NULL PRIMARY KEY,
    "stockName" TEXT NOT NULL,
    "approvedQty" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PendingSell" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "stockCode" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "orderNo" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "GuardSetting" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "activated" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL
);
