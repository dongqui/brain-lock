import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/trade.tsx"),
  route("api/stocks", "routes/api/stocks.ts"),
  route(".well-known/appspecific/com.chrome.devtools.json", "routes/api/devtools.ts"),
] satisfies RouteConfig;
