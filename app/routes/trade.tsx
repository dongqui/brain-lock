import { useState } from "react";
import { useFetcher } from "react-router";
import type { Route } from "./+types/trade";
import { TradeConfirmModal } from "./trade/components/TradeConfirmModal";
import { useStockSearch } from "./trade/hooks/queries/useStockSearch";
import { useRecentStocks } from "./trade/hooks/useRecentStocks";
import type { KiwoomStockMasterItem } from "../../apis/stocks";
import { parsePrice } from "../shared/utils";

export function meta({}: Route.MetaArgs) {
  return [{ title: "BrainLock" }];
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const stk_cd = String(formData.get("stk_cd") ?? "");
  const ord_qty = String(formData.get("ord_qty") ?? "");
  const ord_uv = String(formData.get("ord_uv") ?? "");
  const trde_tp = String(
    formData.get("trde_tp") ?? "0"
  ) as import("../../apis/types.js").KiwoomOrderType;

  const { buyStock } = await import("../../apis/orders.js");
  const result = await buyStock({ stk_cd, ord_qty, ord_uv, trde_tp });
  return { result };
}

type OrderType = "limit" | "market";

export default function Trade() {
  const fetcher = useFetcher();
  const [orderType, setOrderType] = useState<OrderType>("limit");
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const [keyword, setKeyword] = useState("");
  const [focused, setFocused] = useState(false);
  const [selected, setSelected] = useState<KiwoomStockMasterItem | null>(null);
  const { results, isLoading, isError } = useStockSearch(keyword);
  const { recent, addRecent, removeRecent } = useRecentStocks();

  const currentPrice = parsePrice(selected?.lastPrice);
  const parsedPrice = Number(price.replace(/,/g, "")) || 0;
  const parsedQty = Number(qty) || 0;
  const totalAmount = parsedPrice * parsedQty;

  function handleSelectStock(stock: KiwoomStockMasterItem) {
    setSelected(stock);
    setKeyword("");
    setFocused(false);
    setPrice(String(parsePrice(stock.lastPrice)));
    addRecent(stock);
  }

  function handleOrderTypeChange(type: OrderType) {
    setOrderType(type);
    if (type === "limit") setPrice(String(currentPrice));
  }

  function handlePriceChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/[^0-9]/g, "");
    setPrice(raw);
  }

  function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
    setModalOpen(true);
  }

  function handleConfirm() {
    if (!selected) return;
    setModalOpen(false);
    fetcher.submit(
      {
        stk_cd: selected.code,
        ord_qty: String(parsedQty),
        ord_uv: orderType === "market" ? "" : String(parsedPrice),
        trde_tp: orderType === "market" ? "3" : "0",
      },
      { method: "post" }
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-sm p-6 space-y-5"
      >
        {/* 종목 검색 */}
        <div className="space-y-1.5">
          <label className="text-xs text-gray-400">종목 검색</label>
          <div className="relative">
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setTimeout(() => setFocused(false), 150)}
              placeholder="종목명 또는 종목코드"
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
            />
            {keyword ? (
              <ul className="absolute z-10 left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-gray-800 border border-gray-600 rounded-lg shadow-lg">
                {isLoading && (
                  <li className="px-3 py-2 text-xs text-gray-400">
                    종목 데이터를 불러오는 중...
                  </li>
                )}
                {isError && (
                  <li className="px-3 py-2 text-xs text-red-400">
                    종목 데이터를 불러오지 못했습니다.
                  </li>
                )}
                {!isLoading && !isError && results.length === 0 && (
                  <li className="px-3 py-2 text-xs text-gray-400">
                    검색 결과가 없습니다.
                  </li>
                )}
                {results.map((stock) => (
                  <li key={stock.code}>
                    <button
                      type="button"
                      onClick={() => handleSelectStock(stock)}
                      className="w-full text-left px-3 py-2 hover:bg-gray-700 flex justify-between items-center"
                    >
                      <span className="text-sm text-white">{stock.name}</span>
                      <span className="text-xs text-gray-400 font-mono">
                        {stock.code}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              focused &&
              recent.length > 0 && (
                <ul className="absolute z-10 left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-gray-800 border border-gray-600 rounded-lg shadow-lg">
                  <li className="px-3 py-1.5 text-[11px] text-gray-500">
                    최근 검색
                  </li>
                  {recent.map((stock) => (
                    <li
                      key={stock.code}
                      className="flex items-center hover:bg-gray-700"
                    >
                      <button
                        type="button"
                        onClick={() => handleSelectStock(stock)}
                        className="flex-1 text-left px-3 py-2 flex justify-between items-center"
                      >
                        <span className="text-sm text-white">{stock.name}</span>
                        <span className="text-xs text-gray-400 font-mono">
                          {stock.code}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeRecent(stock.code)}
                        aria-label="최근 검색 삭제"
                        className="px-3 py-2 text-gray-500 hover:text-white"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )
            )}
          </div>
        </div>

        {/* 종목명 */}
        {selected ? (
          <div>
            <p className="text-xs text-gray-500 mb-0.5">{selected.code}</p>
            <p className="text-lg font-semibold text-white">{selected.name}</p>
            {currentPrice > 0 && (
              <p className="text-sm text-blue-400 font-mono mt-0.5">
                {currentPrice.toLocaleString()}원
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-500">종목을 검색해 선택하세요.</p>
        )}

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

        {/* fetcher 결과 */}
        {fetcher.data && (
          <p className="text-xs text-green-400 text-center">
            주문 접수:{" "}
            {(fetcher.data as { result: { ord_no?: string } }).result?.ord_no ??
              "완료"}
          </p>
        )}

        {/* 매수 버튼 */}
        <button
          type="submit"
          disabled={!selected || parsedQty === 0 || fetcher.state !== "idle"}
          className="w-full bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold rounded-lg py-3 text-sm transition-colors"
        >
          {fetcher.state !== "idle" ? "주문 중..." : "매수 주문"}
        </button>
      </form>

      <TradeConfirmModal
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onConfirm={handleConfirm}
      />
    </div>
  );
}
