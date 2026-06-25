export function formatAmount(value?: number) {
  const amount = Number(value || 0);
  if (Math.abs(amount) >= 1_0000_0000) return `${(amount / 1_0000_0000).toFixed(1)}亿`;
  if (Math.abs(amount) >= 10_000) return `${(amount / 10_000).toFixed(1)}万`;
  return amount.toFixed(0);
}

export function formatPct(value?: number) {
  const number = Number(value || 0);
  const prefix = number > 0 ? "+" : "";
  return `${prefix}${number.toFixed(2)}%`;
}

export function formatDateTime(value?: string) {
  if (!value) return "无更新时间";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("zh-CN", { hour12: false });
}

export function probability(value: number) {
  return `${Math.round(value * 100)}%`;
}
