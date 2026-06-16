import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/trade.tsx"),
  route("themes", "routes/themes.tsx"),
  route("guard", "routes/guard.tsx"),
  route("api/stocks", "routes/api/stocks.ts"),
  route("api/index", "routes/api/index.ts"),
  route("api/account", "routes/api/account.ts"),
  route("api/themes", "routes/api/themes.ts"),
  route("api/themes/reorder", "routes/api/themes.reorder.ts"),
  route("api/themes/:id", "routes/api/themes.$id.ts"),
  route("api/themes/:id/stocks", "routes/api/themes.$id.stocks.ts"),
  route("api/themes/:id/stocks/reorder", "routes/api/themes.$id.stocks.reorder.ts"),
  route("api/themes/:id/stocks/:code", "routes/api/themes.$id.stocks.$code.ts"),
  route(".well-known/appspecific/com.chrome.devtools.json", "routes/api/devtools.ts"),
] satisfies RouteConfig;
