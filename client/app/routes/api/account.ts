import { fetchAccountEvaluation } from "@brain-lock/kiwoom";

export async function loader() {
  const account = await fetchAccountEvaluation();
  return Response.json(account);
}
