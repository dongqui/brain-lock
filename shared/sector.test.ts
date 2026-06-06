import assert from "node:assert/strict";
import { pickCompositeIndex, toIndustryTheme } from "./sector.js";
import type { IndustryIndexItem, IndustryTheme } from "./types.js";

function theme(code: string, index: number): IndustryTheme {
  return {
    code,
    name: code,
    index,
    change: 0,
    changeRate: 0,
    tradingVolume: 0,
    tradingAmount: 0,
    upCount: 0,
    downCount: 0,
    flatCount: 0,
  };
}

assert.equal(
  pickCompositeIndex([theme("002", 1), theme("001", 100)], "0")?.code,
  "001"
);
assert.equal(
  pickCompositeIndex([theme("105", 1), theme("101", 200)], "1")?.code,
  "101"
);
assert.equal(
  pickCompositeIndex([theme("999", 1), theme("888", 2)], "0")?.code,
  "999"
);
assert.equal(pickCompositeIndex([], "0"), undefined);

const item: IndustryIndexItem = {
  upjong_cd: "001",
  upjong_nm: "종합(KOSPI)",
  cur_idx: "2500.12",
  pred_pre: "-3.4",
  pred_pre_sig: "5",
  flu_rt: "-0.14",
  trde_qty: "1000",
  trde_prica: "2000",
  up_cnt: "100",
  down_cnt: "800",
  flat_cnt: "50",
};
const mapped = toIndustryTheme(item);
assert.equal(mapped.code, "001");
assert.equal(mapped.index, 2500.12);
assert.equal(mapped.changeRate, -0.14);
assert.equal(mapped.downCount, 800);

console.log("sector.test.ts OK");
