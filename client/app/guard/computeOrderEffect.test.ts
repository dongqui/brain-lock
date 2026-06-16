import { test } from "node:test";
import assert from "node:assert/strict";
import { computeOrderEffect, type ExecutionInput, type OwnedOrderState } from "./computeOrderEffect";

const exec = (over: Partial<ExecutionInput> = {}): ExecutionInput => ({
  orderNo: "A1",
  stockCode: "005930",
  stockName: "삼성전자",
  side: "BUY",
  orderQuantity: 10,
  unfilledQuantity: 0,
  orderStatus: "체결",
  ...over,
});

test("외부 주문(매칭 없음)은 효과 없음", () => {
  assert.deepEqual(computeOrderEffect(exec(), null, false), { type: "none" });
});

test("내 매수 전량 체결 → approved 전량 적립 + close", () => {
  const owned: OwnedOrderState = { side: "BUY", filledQty: 0 };
  assert.deepEqual(computeOrderEffect(exec({ unfilledQuantity: 0 }), owned, false), {
    type: "approved", stockCode: "005930", stockName: "삼성전자", delta: 10, newFilled: 10, close: true,
  });
});

test("내 매수 부분 체결 → 델타만 적립, close 아님", () => {
  const owned: OwnedOrderState = { side: "BUY", filledQty: 4 };
  // 누계 = 10 - 4(미체결) = 6, 이전 filled 4 → 델타 2
  assert.deepEqual(computeOrderEffect(exec({ unfilledQuantity: 4 }), owned, false), {
    type: "approved", stockCode: "005930", stockName: "삼성전자", delta: 2, newFilled: 6, close: false,
  });
});

test("내 매도 체결 → approved 차감(음수 델타)", () => {
  const owned: OwnedOrderState = { side: "SELL", filledQty: 0 };
  assert.deepEqual(computeOrderEffect(exec({ side: "SELL", unfilledQuantity: 0 }), owned, false), {
    type: "approved", stockCode: "005930", stockName: "삼성전자", delta: -10, newFilled: 10, close: true,
  });
});

test("자동매도(PendingSell 매칭) 부분 체결 → 잔여 갱신, 제거 아님", () => {
  assert.deepEqual(computeOrderEffect(exec({ side: "SELL", unfilledQuantity: 3 }), null, true), {
    type: "pending", remaining: 3, remove: false,
  });
});

test("자동매도 전량 체결 → 잔여 0, 제거", () => {
  assert.deepEqual(computeOrderEffect(exec({ side: "SELL", unfilledQuantity: 0 }), null, true), {
    type: "pending", remaining: 0, remove: true,
  });
});

test("내 매수 취소(부분 체결 후) → 체결분만 적립 + close", () => {
  const owned: OwnedOrderState = { side: "BUY", filledQty: 6 };
  // 취소 시점 미체결 4 → 누계 6, 이전 6 → 델타 0, close true
  assert.deepEqual(computeOrderEffect(exec({ unfilledQuantity: 4, orderStatus: "취소확인" }), owned, false), {
    type: "approved", stockCode: "005930", stockName: "삼성전자", delta: 0, newFilled: 6, close: true,
  });
});
