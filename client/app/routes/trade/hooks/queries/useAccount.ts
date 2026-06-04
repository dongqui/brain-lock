import { useQuery } from "@tanstack/react-query";
import type { AccountEvaluationResponse } from "@brain-lock/kiwoom";

async function fetchAccount(): Promise<AccountEvaluationResponse> {
  const res = await fetch("/api/account");
  console.log(res);
  if (!res.ok) throw new Error("계좌 정보를 불러오지 못했습니다.");
  return res.json();
}

export const accountQueryKey = ["account"] as const;

export function useAccount() {
  return useQuery({
    queryKey: accountQueryKey,
    queryFn: fetchAccount,
    staleTime: 30_000,
  });
}
