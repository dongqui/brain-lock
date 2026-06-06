import assert from "node:assert/strict";
import { getMarketType } from "./utils";
import type { KiwoomStockMasterItem } from "@brain-lock/kiwoom";

function stock(market?: "0" | "1"): KiwoomStockMasterItem {
  return { code: "005930", name: "삼성전자", market, raw: {} };
}

assert.equal(getMarketType(stock("0")), "0");
assert.equal(getMarketType(stock("1")), "1");
assert.equal(getMarketType(stock(undefined)), null);
assert.equal(getMarketType(null), null);

console.log("utils.test.ts OK");
