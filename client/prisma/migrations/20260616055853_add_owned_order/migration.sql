-- CreateTable
CREATE TABLE "OwnedOrder" (
    "orderNo" TEXT NOT NULL PRIMARY KEY,
    "stockCode" TEXT NOT NULL,
    "stockName" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "orderQty" INTEGER NOT NULL,
    "filledQty" INTEGER NOT NULL DEFAULT 0,
    "closed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
