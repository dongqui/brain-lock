import { fetchKoreanStockMaster } from "../../../apis/stocks.js";

export async function loader() {
  const stocks = await fetchKoreanStockMaster();
  return Response.json(stocks);
}
