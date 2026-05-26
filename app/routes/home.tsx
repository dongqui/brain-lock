import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  return [{ title: "BrainLock" }];
}

export async function action({}: Route.ActionArgs) {
  const { getTopTradingValue } = await import("../../apis/ranking.js");
  const result = await getTopTradingValue();
  console.log("[ranking]", JSON.stringify(result, null, 2));
  return null;
}

// 임시 데이터 — 추후 종목 검색 연동
const STOCK = { name: "삼성전자", code: "005930", currentPrice: 73400 };

type OrderType = "limit" | "market";

export default function Home() {
  const fetcher = useFetcher();
  const [orderType, setOrderType] = useState<OrderType>("limit");
  const [price, setPrice] = useState(String(STOCK.currentPrice));
  const [qty, setQty] = useState("");

  const parsedPrice = Number(price.replace(/,/g, "")) || 0;
  const parsedQty = Number(qty) || 0;
  const totalAmount = parsedPrice * parsedQty;

  function handleOrderTypeChange(type: OrderType) {
    setOrderType(type);
    if (type === "limit") setPrice(String(STOCK.currentPrice));
  }

  function handlePriceChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/[^0-9]/g, "");
    setPrice(raw);
  }

  function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    fetcher.submit({}, { method: "post" });
    // TODO: Rule Engine 검증 후 주문 실행
    alert(
      `주문 요청\n종목: ${STOCK.name}\n유형: ${orderType === "limit" ? "지정가" : "시장가"}\n가격: ${parsedPrice.toLocaleString()}원\n수량: ${parsedQty}주`
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-sm p-6 space-y-5"
      >
        {/* 종목명 */}
        <div>
          <p className="text-xs text-gray-500 mb-0.5">{STOCK.code}</p>
          <p className="text-lg font-semibold text-white">{STOCK.name}</p>
          <p className="text-sm text-blue-400 font-mono mt-0.5">
            {STOCK.currentPrice.toLocaleString()}원
          </p>
        </div>

        <div className="border-t border-gray-700" />

        {/* 주문 유형 */}
        <div className="space-y-1.5">
          <p className="text-xs text-gray-400">주문 유형</p>
          <div className="flex gap-4">
            {(["limit", "market"] as const).map((type) => (
              <label
                key={type}
                className="flex items-center gap-2 cursor-pointer"
              >
                <input
                  type="radio"
                  name="orderType"
                  value={type}
                  checked={orderType === type}
                  onChange={() => handleOrderTypeChange(type)}
                  className="accent-blue-500"
                />
                <span className="text-sm text-gray-200">
                  {type === "limit" ? "현재가" : "시장가"}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* 가격 */}
        <div className="space-y-1.5">
          <label className="text-xs text-gray-400">가격</label>
          <div className="relative">
            <input
              type="text"
              inputMode="numeric"
              value={orderType === "market" ? "시장가" : price}
              onChange={handlePriceChange}
              disabled={orderType === "market"}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2.5 text-right text-white text-sm pr-8 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:border-blue-500"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
              원
            </span>
          </div>
        </div>

        {/* 수량 */}
        <div className="space-y-1.5">
          <label className="text-xs text-gray-400">수량</label>
          <div className="relative">
            <input
              type="text"
              inputMode="numeric"
              value={qty}
              onChange={(e) => setQty(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="0"
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2.5 text-right text-white text-sm pr-8 focus:outline-none focus:border-blue-500"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
              주
            </span>
          </div>
        </div>

        {/* 주문금액 */}
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-400">주문금액</span>
          <span className="text-white font-mono">
            {totalAmount > 0 ? totalAmount.toLocaleString() + "원" : "—"}
          </span>
        </div>

        {/* 매수 버튼 */}
        <button
          type="submit"
          disabled={parsedQty === 0}
          className="w-full bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold rounded-lg py-3 text-sm transition-colors"
        >
          매수 주문
        </button>
      </form>
    </div>
  );
}
