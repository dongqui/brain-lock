````md
# Kiwoom Chart API

국내주식 차트 조회 API 정리

---

# 공통 정보

## Base URL

운영

```txt
https://api.kiwoom.com
```
````

모의투자

```txt
https://mockapi.kiwoom.com
```

## Endpoint

```txt
POST /api/dostk/chart
```

## Header

```ts
type ChartApiHeaders = {
  authorization: `Bearer ${string}`;
  "api-id": "ka10080" | "ka10081" | "ka10082" | "ka10083";

  "Content-Type": "application/json;charset=UTF-8";

  "cont-yn"?: "Y" | "N";

  "next-key"?: string;
};
```

---

# ka10080

## 주식분봉차트조회요청

### API

```txt
POST /api/dostk/chart
api-id: ka10080
```

---

### Request

```ts
export type StockMinuteChartRequest = {
  /**
   * 종목코드
   *
   * KRX
   * 039490
   *
   * NXT
   * 039490_NX
   *
   * SOR
   * 039490_AL
   */
  stk_cd: string;

  /**
   * 틱범위
   *
   * 1
   * 3
   * 5
   * 10
   * 15
   * 30
   * 45
   * 60
   */
  tic_scope: "1" | "3" | "5" | "10" | "15" | "30" | "45" | "60";

  /**
   * 수정주가구분
   *
   * 0
   * 1
   */
  upd_stkpc_tp: "0" | "1";

  /**
   * 기준일자
   *
   * YYYYMMDD
   */
  base_dt: string;
};
```

---

### Response

```ts
export type StockMinuteChartResponse = {
  stk_cd: string;

  stk_min_pole_chart_qry: StockMinuteChartCandle[];

  return_code: number;

  return_msg: string;
};

export type StockMinuteChartCandle = {
  /**
   * 현재가
   */
  cur_prc: string;

  /**
   * 거래량
   */
  trde_qty: string;

  /**
   * 체결시간
   *
   * YYYYMMDDHHmmss
   */
  cntr_tm: string;

  /**
   * 시가
   */
  open_pric: string;

  /**
   * 고가
   */
  high_pric: string;

  /**
   * 저가
   */
  low_pric: string;

  /**
   * 누적거래량
   */
  acc_trde_qty: string;

  /**
   * 전일대비
   */
  pred_pre: string;

  /**
   * 전일대비기호
   *
   * 1 상한
   * 2 상승
   * 3 보합
   * 4 하한
   * 5 하락
   */
  pred_pre_sig: string;
};
```

---

# ka10081

## 주식일봉차트조회요청

### API

```txt
POST /api/dostk/chart
api-id: ka10081
```

---

### Request

```ts
export type StockDailyChartRequest = {
  /**
   * 종목코드
   *
   * KRX
   * 039490
   *
   * NXT
   * 039490_NX
   *
   * SOR
   * 039490_AL
   */
  stk_cd: string;

  /**
   * 기준일자
   *
   * YYYYMMDD
   */
  base_dt: string;

  /**
   * 수정주가구분
   */
  upd_stkpc_tp: "0" | "1";
};
```

---

### Response

```ts
export type StockDailyChartResponse = {
  stk_cd: string;

  stk_dt_pole_chart_qry: StockPeriodChartCandle[];

  return_code: number;

  return_msg: string;
};
```

---

# ka10082

## 주식주봉차트조회요청

### API

```txt
POST /api/dostk/chart
api-id: ka10082
```

---

### Request

```ts
export type StockWeeklyChartRequest = {
  /**
   * 종목코드
   *
   * KRX
   * 039490
   *
   * NXT
   * 039490_NX
   *
   * SOR
   * 039490_AL
   */
  stk_cd: string;

  /**
   * 기준일자
   *
   * YYYYMMDD
   */
  base_dt: string;

  /**
   * 수정주가구분
   */
  upd_stkpc_tp: "0" | "1";
};
```

---

### Response

```ts
export type StockWeeklyChartResponse = {
  stk_cd: string;

  stk_stk_pole_chart_qry: StockPeriodChartCandle[];

  return_code: number;

  return_msg: string;
};
```

---

# ka10083

## 주식월봉차트조회요청

### API

```txt
POST /api/dostk/chart
api-id: ka10083
```

---

### Request

```ts
export type StockMonthlyChartRequest = {
  /**
   * 종목코드
   *
   * KRX
   * 039490
   *
   * NXT
   * 039490_NX
   *
   * SOR
   * 039490_AL
   */
  stk_cd: string;

  /**
   * 기준일자
   *
   * YYYYMMDD
   */
  base_dt: string;

  /**
   * 수정주가구분
   */
  upd_stkpc_tp: "0" | "1";
};
```

---

### Response

```ts
export type StockMonthlyChartResponse = {
  stk_cd: string;

  stk_stk_pole_chart_qry: StockPeriodChartCandle[];

  return_code: number;

  return_msg: string;
};
```

---

# 공통 봉 타입

일봉 / 주봉 / 월봉 공통

```ts
export type StockPeriodChartCandle = {
  /**
   * 현재가
   */
  cur_prc: string;

  /**
   * 거래량
   */
  trde_qty: string;

  /**
   * 거래대금
   */
  trde_prica: string;

  /**
   * 일자
   *
   * YYYYMMDD
   */
  dt: string;

  /**
   * 시가
   */
  open_pric: string;

  /**
   * 고가
   */
  high_pric: string;

  /**
   * 저가
   */
  low_pric: string;

  /**
   * 전일대비
   */
  pred_pre: string;

  /**
   * 전일대비기호
   *
   * 1 상한
   * 2 상승
   * 3 보합
   * 4 하한
   * 5 하락
   */
  pred_pre_sig: string;

  /**
   * 거래회전율
   */
  trde_tern_rt?: string;
};
```

---

# 사용 예시

## 1분봉 조회

```ts
const { data } = await kiwoomClient.post<StockMinuteChartResponse>(
  "/api/dostk/chart",
  {
    stk_cd: "005930",
    tic_scope: "1",
    upd_stkpc_tp: "1",
    base_dt: "20260604",
  },
  {
    headers: {
      "api-id": "ka10080",
    },
  }
);
```

## 일봉 조회

```ts
const { data } = await kiwoomClient.post<StockDailyChartResponse>(
  "/api/dostk/chart",
  {
    stk_cd: "005930",
    base_dt: "20260604",
    upd_stkpc_tp: "
```
