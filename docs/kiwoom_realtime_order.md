# Kiwoom 주문체결 (00)

국내주식 > 실시간시세 > 주문체결

---

# Request

```ts
export type OrderExecutionRegisterRequest = {
  trnm: "REG";

  grp_no: string;

  refresh: "0" | "1";

  data: Array<{
    /**
     * 계좌 이벤트는 종목코드 사용 안함
     */
    item: [""];

    type: ["00"];
  }>;
};
```

## Example

```json
{
  "trnm": "REG",
  "grp_no": "1",
  "refresh": "1",
  "data": [
    {
      "item": [""],
      "type": ["00"]
    }
  ]
}
```

---

# Remove Request

```ts
export type OrderExecutionRemoveRequest = {
  trnm: "REMOVE";

  grp_no: string;

  data: Array<{
    item: [""];

    type: ["00"];
  }>;
};
```

---

# Register Response

```ts
export type OrderExecutionRegisterResponse = {
  trnm: "REG";

  return_code: number;

  return_msg: string;
};
```

---

# Realtime Message

```ts
export type OrderExecutionRealtimeMessage = {
  trnm: "REAL";

  data: Array<{
    type: "00";

    name: string;

    item: string;

    values: {
      /**
       * 계좌번호
       */
      "9201": string;

      /**
       * 주문번호
       */
      "9203": string;

      /**
       * 관리자사번
       */
      "9205": string;

      /**
       * 종목코드
       */
      "9001": string;

      /**
       * 주문업무분류
       */
      "912": string;

      /**
       * 주문상태
       */
      "913": string;

      /**
       * 종목명
       */
      "302": string;

      /**
       * 주문수량
       */
      "900": string;

      /**
       * 주문가격
       */
      "901": string;

      /**
       * 미체결수량
       */
      "902": string;

      /**
       * 체결누계금액
       */
      "903": string;

      /**
       * 원주문번호
       */
      "904": string;

      /**
       * 주문구분
       */
      "905": string;

      /**
       * 매매구분
       */
      "906": string;

      /**
       * 매도수구분
       */
      "907": string;

      /**
       * 주문/체결시간
       */
      "908": string;

      /**
       * 체결번호
       */
      "909": string;

      /**
       * 체결가
       */
      "910": string;

      /**
       * 체결량
       */
      "911": string;

      /**
       * 현재가
       */
      "10": string;

      /**
       * 최우선매도호가
       */
      "27": string;

      /**
       * 최우선매수호가
       */
      "28": string;

      /**
       * 단위체결가
       */
      "914": string;

      /**
       * 단위체결량
       */
      "915": string;

      /**
       * 당일매매수수료
       */
      "938": string;

      /**
       * 당일매매세금
       */
      "939": string;

      /**
       * 거부사유
       */
      "919": string;

      /**
       * 화면번호
       */
      "920": string;

      /**
       * 터미널번호
       */
      "921": string;

      /**
       * 신용구분
       */
      "922": string;

      /**
       * 대출일
       */
      "923": string;
    };
  }>;
};
```

---

# 프로젝트용 Domain Type

```ts
export type OrderExecution = {
  accountNo: string;

  orderNo: string;

  stockCode: string;

  stockName: string;

  orderStatus: string;

  orderType: string;

  side: "BUY" | "SELL";

  orderQuantity: number;

  orderPrice: number;

  unfilledQuantity: number;

  executedQuantity: number;

  executedPrice: number;

  currentPrice: number;

  executionTime: string;

  raw: unknown;
};
```

---

# Mapper

```ts
export function parseOrderExecution(
  message: OrderExecutionRealtimeMessage
): OrderExecution[] {
  if (message.trnm !== "REAL") {
    return [];
  }

  return message.data
    .filter((item) => item.type === "00")
    .map((item) => ({
      accountNo: item.values["9201"],

      orderNo: item.values["9203"],

      stockCode: item.values["9001"],

      stockName: item.values["302"],

      orderStatus: item.values["913"],

      orderType: item.values["905"],

      side: item.values["907"] === "2" ? "BUY" : "SELL",

      orderQuantity: Number(item.values["900"]),

      orderPrice: Number(item.values["901"]),

      unfilledQuantity: Number(item.values["902"]),

      executedPrice: Number(item.values["910"]),

      executedQuantity: Number(item.values["911"]),

      currentPrice: Number(item.values["10"]),

      executionTime: item.values["908"],

      raw: item,
    }));
}
```
