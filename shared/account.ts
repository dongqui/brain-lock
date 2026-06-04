import { kiwoomClient } from "./client.js";

export type HoldingStock = {
  stockCode: string;
  stockName: string;
  quantity: number;
  currentPrice: number;
  buyPrice: number;
  evaluationAmount: number;
  profitAmount: number;
  profitRate: number;
  orderableQuantity: number;
};

export type AccountEvaluationResponse = {
  orderableCash: number;
  totalPurchaseAmount: number;
  totalEvaluationAmount: number;
  totalProfitAmount: number;
  totalProfitRate: number;
  holdings: HoldingStock[];
};

type RawHolding = {
  stk_cd?: string;
  stk_nm?: string;
  hldg_qty?: string;
  prpr?: string;
  pchs_avg_pric?: string;
  evlu_amt?: string;
  evlu_pfls_amt?: string;
  evlu_pfls_rt?: string;
  ord_psbl_qty?: string;
};

type RawAccountResponse = {
  return_code?: number;
  return_msg?: string;
  ord_psbl_cash?: string;
  pchs_amt_smtl_amt?: string;
  evlu_amt_smtl_amt?: string;
  evlu_pfls_smtl_amt?: string;
  acnt_evlu_pfls_rt?: string;
  acnt_evlu_remn_item_list?: RawHolding[];
};

export async function fetchAccountEvaluation(): Promise<AccountEvaluationResponse> {
  const { data } = await kiwoomClient.post<RawAccountResponse>(
    "/api/dostk/acnt",
    { dmst_stex_tp: "KRX" },
    { headers: { "api-id": "kt00005" } }
  );

  return {
    orderableCash: Number(data.ord_psbl_cash ?? 0),
    totalPurchaseAmount: Number(data.pchs_amt_smtl_amt ?? 0),
    totalEvaluationAmount: Number(data.evlu_amt_smtl_amt ?? 0),
    totalProfitAmount: Number(data.evlu_pfls_smtl_amt ?? 0),
    totalProfitRate: Number(data.acnt_evlu_pfls_rt ?? 0),
    holdings: (data.acnt_evlu_remn_item_list ?? []).map((h) => ({
      stockCode: h.stk_cd ?? "",
      stockName: h.stk_nm ?? "",
      quantity: Number(h.hldg_qty ?? 0),
      currentPrice: Number(h.prpr ?? 0),
      buyPrice: Number(h.pchs_avg_pric ?? 0),
      evaluationAmount: Number(h.evlu_amt ?? 0),
      profitAmount: Number(h.evlu_pfls_amt ?? 0),
      profitRate: Number(h.evlu_pfls_rt ?? 0),
      orderableQuantity: Number(h.ord_psbl_qty ?? 0),
    })),
  };
}
