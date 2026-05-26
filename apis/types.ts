export type KiwoomEnvironment = 'production' | 'mock';
export type KiwoomExchange = 'KRX' | 'NXT' | 'SOR';

export type KiwoomOrderType =
  | '0'   // 보통
  | '3'   // 시장가
  | '5'   // 조건부지정가
  | '81'  // 장마감후시간외
  | '61'  // 장시작전시간외
  | '62'  // 시간외단일가
  | '6'   // 최유리지정가
  | '7'   // 최우선지정가
  | '10'  // 보통 IOC
  | '13'  // 시장가 IOC
  | '16'  // 최유리 IOC
  | '20'  // 보통 FOK
  | '23'  // 시장가 FOK
  | '26'  // 최유리 FOK
  | '28'  // 스톱지정가
  | '29'  // 중간가
  | '30'  // 중간가 IOC
  | '31'; // 중간가 FOK

export interface KiwoomCredentials {
  appkey: string;
  secretkey: string;
}

export interface KiwoomConfig {
  /** 직접 발급받은 토큰을 넣고 싶을 때 사용 */
  accessToken?: string;
  /** appkey/secretkey로 SDK가 토큰을 발급/재사용하게 할 때 사용 */
  credentials?: KiwoomCredentials;
  environment?: KiwoomEnvironment;
}

export interface KiwoomTokenIssueRequest extends KiwoomCredentials {
  grant_type: 'client_credentials';
}

export interface KiwoomTokenIssueResponse extends KiwoomResponseBase {
  expires_dt: string;
  token_type: string;
  token: string;
}

export interface KiwoomTokenRevokeRequest extends KiwoomCredentials {
  token: string;
}

export interface KiwoomResponseBase {
  return_code?: number | string;
  return_msg?: string;
  [key: string]: unknown;
}

export interface StockOrderRequest {
  dmst_stex_tp?: KiwoomExchange;
  stk_cd: string;
  ord_qty: number | string;
  ord_uv?: number | string;
  trde_tp: KiwoomOrderType;
  cond_uv?: number | string;
}

export interface StockModifyOrderRequest {
  dmst_stex_tp?: KiwoomExchange;
  orig_ord_no: string;
  stk_cd: string;
  mdfy_qty: number | string;
  mdfy_uv: number | string;
  mdfy_cond_uv?: number | string;
}

export interface StockCancelOrderRequest {
  dmst_stex_tp?: KiwoomExchange;
  orig_ord_no: string;
  stk_cd: string;
  /** '0'이면 잔량 전부 취소 */
  cncl_qty: number | string;
}

export interface StockOrderResponse extends KiwoomResponseBase {
  ord_no?: string;
  dmst_stex_tp?: string;
}

export interface StockModifyOrderResponse extends KiwoomResponseBase {
  ord_no?: string;
  base_orig_ord_no?: string;
  mdfy_qty?: string;
  dmst_stex_tp?: string;
}

export interface StockCancelOrderResponse extends KiwoomResponseBase {
  ord_no?: string;
  base_orig_ord_no?: string;
  cncl_qty?: string;
}

export type RealtimeType =
  | '00' // 주문체결
  | '04' // 잔고
  | '0B' // 주식체결
  | '0C' // 주식우선호가
  | '0D'; // 주식호가잔량

export interface RealtimeRegisterItem {
  item: string[];
  type: RealtimeType[];
}

export interface RealtimeRegisterRequest {
  trnm: 'REG' | 'REMOVE';
  grp_no: string;
  refresh?: '0' | '1';
  data: RealtimeRegisterItem[];
}

export interface RealtimeMessage {
  trnm?: 'REG' | 'REMOVE' | 'REAL' | string;
  return_code?: number | string;
  return_msg?: string;
  data?: Array<{
    type: string;
    name?: string;
    item?: string;
    values?: Record<string, string>;
  }>;
  [key: string]: unknown;
}

export type KiwoomMarketType = '000' | '001' | '101';
// 000: 전체, 001: 코스피, 101: 코스닥

export type KiwoomStockExchangeType = '1' | '2' | '3';
// 1: KRX, 2: NXT, 3: 통합

export interface GetTopTradingValueParams {
  marketType?: KiwoomMarketType;
  includeManagedStocks?: boolean;
  exchangeType?: KiwoomStockExchangeType;
}

export interface TopTradingValueItem {
  stk_cd: string;
  now_rank: string;
  pred_rank: string;
  stk_nm: string;
  cur_prc: string;
  pred_pre_sig: string;
  pred_pre: string;
  flu_rt: string;
  sel_bid: string;
  buy_bid: string;
  now_trde_qty: string;
  pred_trde_qty: string;
  trde_prica: string;
}

export interface GetTopTradingValueResponse extends KiwoomResponseBase {
  trde_prica_upper: TopTradingValueItem[];
}
