# Kiwoom 전업종지수요청 (ka20003)

## API 정보

### API ID

```txt
ka20003
```

### API 명

```txt
전업종지수요청
```

### 메뉴 위치

```txt
국내주식 > 업종 > 전업종지수요청
```

### Endpoint

```http
POST /api/dostk/sector
```

### Domain

```txt
운영
https://api.kiwoom.com

모의
https://mockapi.kiwoom.com
```

---

# Header

```ts
export type IndustryIndexHeaders = {
  authorization: `Bearer ${string}`;

  "api-id": "ka20003";

  "Content-Type": "application/json;charset=UTF-8";

  "cont-yn"?: "Y" | "N";

  "next-key"?: string;
};
```

---

# Request

```ts
export type IndustryIndexRequest = {
  /**
   * 시장구분
   *
   * 0 : 코스피
   * 1 : 코스닥
   */
  mrkt_tp: "0" | "1";
};
```

### Example

```json
{
  "mrkt_tp": "0"
}
```

---

# Response

```ts
export type IndustryIndexResponse = {
  /**
   * 업종지수 목록
   */
  upjong_index: IndustryIndexItem[];

  return_code: number;

  return_msg: string;
};
```

---

# Industry Index Item

```ts
export type IndustryIndexItem = {
  /**
   * 업종코드
   */
  upjong_cd: string;

  /**
   * 업종명
   */
  upjong_nm: string;

  /**
   * 현재지수
   */
  cur_idx: string;

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
   * 등락률
   */
  flu_rt: string;

  /**
   * 거래량
   */
  trde_qty: string;

  /**
   * 거래대금
   */
  trde_prica: string;

  /**
   * 상승종목수
   */
  up_cnt: string;

  /**
   * 하락종목수
   */
  down_cnt: string;

  /**
   * 보합종목수
   */
  flat_cnt: string;
};
```

---

# Domain Type

```ts
export type IndustryTheme = {
  code: string;

  name: string;

  index: number;

  change: number;

  changeRate: number;

  tradingVolume: number;

  tradingAmount: number;

  upCount: number;

  downCount: number;

  flatCount: number;
};
```

---

# Mapper

```ts
export function toIndustryTheme(item: IndustryIndexItem): IndustryTheme {
  return {
    code: item.upjong_cd,
    name: item.upjong_nm,

    index: Number(item.cur_idx),

    change: Number(item.pred_pre),

    changeRate: Number(item.flu_rt),

    tradingVolume: Number(item.trde_qty),

    tradingAmount: Number(item.trde_prica),

    upCount: Number(item.up_cnt),

    downCount: Number(item.down_cnt),

    flatCount: Number(item.flat_cnt),
  };
}
```

---

# 사용 예시

```ts
const { data } = await kiwoomClient.post<IndustryIndexResponse>(
  "/api/dostk/sector",
  {
    mrkt_tp: "0",
  },
  {
    headers: {
      "api-id": "ka20003",
    },
  }
);
```

---

# 활용 예시 (뇌동방지 프로젝트)

```txt
거래대금 상위 종목 조회
↓
전업종지수 조회
↓
가장 강한 업종 찾기
↓
해당 업종 내 거래대금 1위 종목인지 검사
↓
통과 시 매수 가능
```

예)

```txt
반도체 +3.2%
2차전지 +0.4%
로봇 -1.1%
```

현재 시장 주도 업종

```txt
반도체
```

삼성전자
SK하이닉스
한미반도체

중 거래대금/상승률 기준 최강 종목인지 추가 검증 가능.
