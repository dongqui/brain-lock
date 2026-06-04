export function getTickSize(price: number): number {
  if (price < 2_000) return 1;
  if (price < 5_000) return 5;
  if (price < 20_000) return 10;
  if (price < 50_000) return 50;
  if (price < 200_000) return 100;
  if (price < 500_000) return 500;
  return 1_000;
}

export function parsePrice(value?: string) {
  return Number(String(value ?? "").replace(/[^0-9]/g, "")) || 0;
}

export function isMarketHours(): boolean {
  const now = new Date()
  const kstOffset = 9 * 60
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes()
  const kstMinutes = (utcMinutes + kstOffset) % (24 * 60)
  return kstMinutes >= 9 * 60 && kstMinutes <= 15 * 60 + 30
}
