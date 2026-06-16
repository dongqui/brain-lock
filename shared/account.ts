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
  cur_qty?: string;
  cur_prc?: string;
  buy_uv?: string;
  evlt_amt?: string;
  evltv_prft?: string;
  pl_rt?: string;
};

type RawAccountResponse = {
  return_code?: number;
  return_msg?: string;
  ord_alowa?: string;
  stk_buy_tot_amt?: string;
  evlt_amt_tot?: string;
  tot_pl_tot?: string;
  tot_pl_rt?: string;
  stk_cntr_remn?: RawHolding[];
};

export async function fetchAccountEvaluation(): Promise<AccountEvaluationResponse> {
  const { data } = await kiwoomClient.post<RawAccountResponse>(
    "/api/dostk/acnt",
    { dmst_stex_tp: "KRX" },
    { headers: { "api-id": "kt00005" } }
  );
  return {
    orderableCash: Number(data.ord_alowa ?? 0),
    totalPurchaseAmount: Number(data.stk_buy_tot_amt ?? 0),
    totalEvaluationAmount: Number(data.evlt_amt_tot ?? 0),
    totalProfitAmount: Number(data.tot_pl_tot ?? 0),
    totalProfitRate: Number(data.tot_pl_rt ?? 0),
    holdings: (data.stk_cntr_remn ?? []).map((h) => {
      const quantity = Number(h.cur_qty ?? 0);
      return {
        stockCode: (h.stk_cd ?? "").replace(/^[A-Z]/, ""),
        stockName: h.stk_nm ?? "",
        quantity,
        currentPrice: Number(h.cur_prc ?? 0),
        buyPrice: Number(h.buy_uv ?? 0),
        evaluationAmount: Number(h.evlt_amt ?? 0),
        profitAmount: Number(h.evltv_prft ?? 0),
        profitRate: Number(h.pl_rt ?? 0),
        orderableQuantity: quantity,
      };
    }),
  };
}

// 메뉴 위치 국내주식 > 계좌 > 체결잔고요청(kt00005)
// API 명 체결잔고요청
// API ID kt00005
// 기본정보
// Method POST
// 운영 도메인 https://api.kiwoom.com
// 모의투자 도메인 https://mockapi.kiwoom.com(KRX만 지원가능)
// URL /api/dostk/acnt
// Format JSON
// Content-Type application/json;charset=UTF-8
// 개요
// 체결 잔고 정보를 조회합니다.
// Request
// 구분 Element 한글명 Type Require
// d
// Length Description
// Header api-id TR명 String Y 10 7자리 TR코드, ex) ka00001
// Header authorization 접근토큰 String Y 1000 토큰 지정시 토큰타입("Bearer") 붙혀서 호출
//  예) Bearer Egicyx...
// Header cont-yn 연속조회여부 String N 1
// 응답 Header의 연속조회여부값이 Y일 경우 다음데이터
// 요청시 응답 Header의 cont-yn값 세팅
// Header next-key 연속조회키 String N 50 응답 Header의 연속조회여부값이 Y일 경우 다음데이터
// 요청시 응답 Header의 next-key값 세팅
// Body dmst_stex_tp 국내거래소구분 String Y 6 KRX:한국거래소,NXT:넥스트트레이드
// Response
// 구분 Element 한글명 Type Require
// d
// Length Description
// Header api-id TR명 String Y 10 7자리 TR코드, ex) ka00001
// Header cont-yn 연속조회여부 String N 1 다음 데이터가 있을시 Y값 전달
// Header next-key 연속조회키 String N 50 다음 데이터가 있을시 다음 키값 전달
// Body entr 예수금 String N 12 단위: 원, 좌측 0-padding 처리된 부호 포함 12자리 숫자
// Body entr_d1 예수금D+1 String N 12 단위: 원, 좌측 0-padding 처리된 부호 포함 12자리 숫자
// Body entr_d2 예수금D+2 String N 12 단위: 원, 좌측 0-padding 처리된 부호 포함 12자리 숫자
// Body pymn_alow_amt 출금가능금액 String N 12 단위: 원, 좌측 0-padding 처리된 부호 포함 12자리 숫자
// Body uncl_stk_amt 미수확보금 String N 12 단위: 원, 좌측 0-padding 처리된 부호 포함 12자리 숫자
// Body repl_amt 대용금 String N 12 단위: 원, 좌측 0-padding 처리된 부호 포함 12자리 숫자
// Body rght_repl_amt 권리대용금 String N 12 단위: 원, 좌측 0-padding 처리된 부호 포함 12자리 숫자
// Body ord_alowa 주문가능현금 String N 12 단위: 원, 좌측 0-padding 처리된 부호 포함 12자리 숫자
// Body ch_uncla 현금미수금 String N 12 단위: 원, 좌측 0-padding 처리된 부호 포함 12자리 숫자
// Body crd_int_npay_gold 신용이자미납금 String N 12 단위: 원, 좌측 0-padding 처리된 부호 포함 12자리 숫자
// Body etc_loana 기타대여금 String N 12 단위: 원, 좌측 0-padding 처리된 부호 포함 12자리 숫자
// 388 / 528
// Response
// 구분 Element 한글명 Type Require
// d
// Length Description
// Body nrpy_loan 미상환융자금 String N 12 단위: 원, 좌측 0-padding 처리된 부호 포함 12자리 숫자
// Body profa_ch 증거금현금 String N 12 단위: 원, 좌측 0-padding 처리된 부호 포함 12자리 숫자
// Body repl_profa 증거금대용 String N 12 단위: 원, 좌측 0-padding 처리된 부호 포함 12자리 숫자
// Body stk_buy_tot_amt 주식매수총액 String N 12 단위: 원, 좌측 0-padding 처리된 부호 포함 12자리 숫자
// Body evlt_amt_tot 평가금액합계 String N 12 단위: 원, 좌측 0-padding 처리된 부호 포함 12자리 숫자
// Body tot_pl_tot 총손익합계 String N 12 단위: 원, 좌측 0-padding 처리된 부호 포함 12자리 숫자
// Body tot_pl_rt 총손익률 String N 12 단위: %, 소수점 넷째 자리까지 포맷된 백분율
// Body tot_re_buy_alowa 총재매수가능금액 String N 12 단위: 원, 좌측 0-padding 처리된 부호 포함 12자리 숫자
// Body 20ord_alow_amt 20%주문가능금액 String N 12 단위: 원, 좌측 0-padding 처리된 부호 포함 12자리 숫자
// Body 30ord_alow_amt 30%주문가능금액 String N 12 단위: 원, 좌측 0-padding 처리된 부호 포함 12자리 숫자
// Body 40ord_alow_amt 40%주문가능금액 String N 12 단위: 원, 좌측 0-padding 처리된 부호 포함 12자리 숫자
// Body 50ord_alow_amt 50%주문가능금액 String N 12 단위: 원, 좌측 0-padding 처리된 부호 포함 12자리 숫자
// Body 60ord_alow_amt 60%주문가능금액 String N 12 단위: 원, 좌측 0-padding 처리된 부호 포함 12자리 숫자
// Body 100ord_alow_amt 100%주문가능금액 String N 12 단위: 원, 좌측 0-padding 처리된 부호 포함 12자리 숫자
// Body crd_loan_tot 신용융자합계 String N 12 단위: 원, 좌측 0-padding 처리된 부호 포함 12자리 숫자
// Body crd_loan_ls_tot 신용융자대주합계 String N 12 단위: 원, 좌측 0-padding 처리된 부호 포함 12자리 숫자
// Body crd_grnt_rt 신용담보비율 String N 12 단위: %, 소수점 둘째 자리까지 포맷된 백분율
// Body dpst_grnt_use_amt_a
// mt 예탁담보대출금액 String N 12 단위: 원, 좌측 0-padding 처리된 부호 포함 12자리 숫자
// Body grnt_loan_amt 매도담보대출금액 String N 12 단위: 원, 좌측 0-padding 처리된 부호 포함 12자리 숫자
// Body stk_cntr_remn 종목별체결잔고 LIST N
// Body - crd_tp 신용구분 String N 2
// Body - loan_dt 대출일 String N 8 YYYMMDD
// Body - expr_dt 만기일 String N 8 YYYMMDD
// Body - stk_cd 종목번호 String N 12 접두어 1자리 + 종목코드 6자리, 접두어(A: 주식 / J: ELW /
// Q: ETN)
// Body - stk_nm 종목명 String N 30
// Body - setl_remn 결제잔고 String N 12 단위: 1주, 좌측 0-padding 처리된 부호 포함 12자리 숫자
// Body - cur_qty 현재잔고 String N 12 단위: 1주, 좌측 0-padding 처리된 부호 포함 12자리 숫자
// Body - cur_prc 현재가 String N 12 단위: 원, 좌측 0-padding 처리된 부호 포함 12자리 숫자
// Body - buy_uv 매입단가 String N 12 단위: 원, 좌측 0-padding 처리된 부호 포함 12자리 숫자
// Body - pur_amt 매입금액 String N 12 단위: 원, 좌측 0-padding 처리된 부호 포함 12자리 숫자
// Body - evlt_amt 평가금액 String N 12 단위: 원, 좌측 0-padding 처리된 부호 포함 12자리 숫자
// Body - evltv_prft 평가손익 String N 12 단위: 원, 좌측 0-padding 처리된 부호 포함 12자리 숫자
// Body - pl_rt 손익률 String N 12 단위: %, 소수점 넷째 자리까지 포맷된 백분율
