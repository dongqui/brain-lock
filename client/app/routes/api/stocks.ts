import { fetchKoreanStockMaster } from "@brain-lock/kiwoom";

export async function loader() {
  const stocks = await fetchKoreanStockMaster();
  return Response.json(stocks);
}
