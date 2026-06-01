import { useCallback, useEffect, useState } from "react";
import type { KiwoomStockMasterItem } from "../../../../apis/stocks";

const STORAGE_KEY = "brainlock:recent-stocks";
const MAX_ITEMS = 8;

function readStorage(): KiwoomStockMasterItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is KiwoomStockMasterItem =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as KiwoomStockMasterItem).code === "string"
    );
  } catch {
    return [];
  }
}

export function useRecentStocks() {
  const [recent, setRecent] = useState<KiwoomStockMasterItem[]>([]);

  useEffect(() => {
    setRecent(readStorage());
  }, []);

  const addRecent = useCallback(
    (stock: KiwoomStockMasterItem) => {
      setRecent((prev) => {
        const next = [
          stock,
          ...prev.filter((item) => item.code !== stock.code),
        ].slice(0, MAX_ITEMS);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        }
        return next;
      });
    },
    []
  );

  const removeRecent = useCallback(
    (code: string) => {
      setRecent((prev) => {
        const next = prev.filter((item) => item.code !== code);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        }
        return next;
      });
    },
    []
  );

  return { recent, addRecent, removeRecent };
}
