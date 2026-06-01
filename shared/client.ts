import axios from "axios";
import { REST_BASE_URL, getAuthorizationHeader } from "./auth.js";
import type { KiwoomEnvironment, KiwoomResponseBase } from "./types.js";

const BASE_URL = REST_BASE_URL["production"];

export const kiwoomClient = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json;charset=UTF-8" },
});

kiwoomClient.interceptors.request.use(async (req) => {
  req.headers.Authorization = await getAuthorizationHeader(BASE_URL);
  return req;
});

kiwoomClient.interceptors.response.use((res) => {
  const data = res.data as KiwoomResponseBase;
  if (data?.return_code !== undefined && Number(data.return_code) !== 0) {
    throw new Error(
      `Kiwoom API error [${data.return_code}]: ${data.return_msg ?? ""}`
    );
  }
  return res;
});
