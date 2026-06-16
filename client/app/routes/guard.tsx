import { Form, useLoaderData } from "react-router";
import type { Route } from "./+types/guard";
import { fetchAccountEvaluation } from "@brain-lock/kiwoom";
import {
  getGuardSetting,
  setGuardEnabled,
  markActivated,
  seedApproved,
} from "~/guard/ledger.server";

export async function loader() {
  const [setting, acct] = await Promise.all([
    getGuardSetting(),
    fetchAccountEvaluation(),
  ]);
  return {
    setting,
    holdings: acct.holdings.map((h) => ({
      stockCode: h.stockCode,
      stockName: h.stockName,
      quantity: h.quantity,
    })),
  };
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const intent = String(form.get("intent"));

  if (intent === "toggle") {
    await setGuardEnabled(String(form.get("enabled")) === "true");
    return { ok: true };
  }

  if (intent === "activate") {
    const acct = await fetchAccountEvaluation();
    // 체크된 종목 = keep. 보유분을 승인량으로 시드.
    for (const h of acct.holdings) {
      if (form.get(`keep:${h.stockCode}`) === "on") {
        await seedApproved(h.stockCode, h.stockName, h.quantity);
      }
    }
    // keep 안 한 종목은 승인량 0 → 워처가 다음 틱에 시장가 청산.
    await markActivated();
    return { ok: true };
  }

  return { ok: false };
}

export default function Guard() {
  const { setting, holdings } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center py-10 gap-6">
      <h1 className="text-lg font-semibold">Balance Guard</h1>

      <div className="text-sm text-gray-400">
        상태: {setting.enabled ? "🟢 ON" : "⚪ OFF"}
        {setting.activated ? "" : " (미활성화)"}
      </div>

      {!setting.activated ? (
        <Form method="post" className="w-full max-w-sm space-y-3">
          <input type="hidden" name="intent" value="activate" />
          <p className="text-xs text-gray-500">
            유지할 종목만 체크하세요. 체크 안 한 종목은 활성화 후 시장가로 매도됩니다.
          </p>
          {holdings.length === 0 && (
            <p className="text-sm text-gray-400">현재 보유 종목 없음.</p>
          )}
          {holdings.map((h) => (
            <label
              key={h.stockCode}
              className="flex items-center justify-between bg-gray-900 border border-gray-700 rounded-lg px-3 py-2"
            >
              <span className="text-sm">
                {h.stockName}
                <span className="text-gray-500"> ({h.stockCode})</span> · {h.quantity}주
              </span>
              <input type="checkbox" name={`keep:${h.stockCode}`} defaultChecked />
            </label>
          ))}
          <button
            type="submit"
            className="w-full bg-red-600 hover:bg-red-500 rounded-lg py-2.5 text-sm font-semibold"
          >
            활성화 (이후 외부 포지션 자동 시장가 매도)
          </button>
        </Form>
      ) : (
        <Form method="post" className="w-full max-w-sm">
          <input type="hidden" name="intent" value="toggle" />
          <input type="hidden" name="enabled" value={(!setting.enabled).toString()} />
          <button
            type="submit"
            className={`w-full rounded-lg py-2.5 text-sm font-semibold ${
              setting.enabled ? "bg-gray-700 hover:bg-gray-600" : "bg-green-600 hover:bg-green-500"
            }`}
          >
            {setting.enabled ? "가드 끄기 (OFF)" : "가드 켜기 (ON)"}
          </button>
        </Form>
      )}
    </div>
  );
}
