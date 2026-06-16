import { test } from "node:test";
import assert from "node:assert/strict";
import { computeForeignSells, type Holding } from "./computeForeign";

const h = (
  stockCode: string,
  quantity: number,
  orderableQuantity: number,
  stockName = stockCode
): Holding => ({ stockCode, stockName, quantity, orderableQuantity });

test("승인량이 보유량 이상이면 매도 없음", () => {
  const out = computeForeignSells([h("005930", 10, 10)], new Map([["005930", 10]]), new Map());
  assert.deepEqual(out, []);
});

test("승인량 0이면 보유 전량이 외부", () => {
  const out = computeForeignSells([h("005930", 7, 7)], new Map(), new Map());
  assert.deepEqual(out, [{ stockCode: "005930", stockName: "005930", qty: 7 }]);
});

test("초과분만 매도", () => {
  const out = computeForeignSells([h("005930", 15, 15)], new Map([["005930", 10]]), new Map());
  assert.deepEqual(out, [{ stockCode: "005930", stockName: "005930", qty: 5 }]);
});

test("pending 수량은 차감되어 중복 매도 안 함", () => {
  const out = computeForeignSells(
    [h("005930", 15, 15)],
    new Map([["005930", 10]]),
    new Map([["005930", 5]])
  );
  assert.deepEqual(out, []);
});

test("매도 가능 수량(orderableQuantity)으로 상한", () => {
  const out = computeForeignSells([h("005930", 15, 3)], new Map(), new Map());
  assert.deepEqual(out, [{ stockCode: "005930", stockName: "005930", qty: 3 }]);
});

test("여러 종목 동시 처리, 음수/0은 스킵", () => {
  const out = computeForeignSells(
    [h("005930", 5, 5, "삼성전자"), h("000660", 10, 10, "SK하이닉스")],
    new Map([["005930", 5]]),
    new Map()
  );
  assert.deepEqual(out, [{ stockCode: "000660", stockName: "SK하이닉스", qty: 10 }]);
});
