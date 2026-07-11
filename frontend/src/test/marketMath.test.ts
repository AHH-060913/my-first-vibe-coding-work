import { describe, expect, it } from "vitest";
import { calculateAnalytics, calculateComparison, calculateDistribution, calculateTechnicalSeries } from "../lib/marketMath";
import type { HistoryPoint, Stock, StockDetail } from "../types";
import { staticApi } from "../staticData";

const history = (days = 80): HistoryPoint[] => Array.from({ length: days }, (_, index) => ({
  date: `2026-01-${String(index + 1).padStart(3, "0")}`,
  open: 100 + index * 0.4,
  close: 100 + index * 0.5 + Math.sin(index / 4),
  high: 102 + index * 0.5,
  low: 98 + index * 0.5,
  volume: 100_000 + index * 1_000,
  amount: 10_000_000 + index * 100_000
}));

const stock = (code: string, name: string): Stock => ({ code, name, market: "SZ", price: 120, change_pct: 1, amount: 100_000_000, turnover_rate: 1, volume_ratio: 1, pe: 20, pb: 2, market_cap: 10_000_000_000, sector: "测试", theme: "tech" });
const detail = (code: string, name: string): StockDetail => ({ quote: stock(code, name), history: history(), news: [], announcements: [], predictions: [], source: "test", updated_at: "2026-01-01" });

describe("market math", () => {
  it("calculates indicators without changing earlier values when future rows are appended", () => {
    const base = history(40);
    const baseSeries = calculateTechnicalSeries(base);
    const extendedSeries = calculateTechnicalSeries([...base, ...history(5).map((item, index) => ({ ...item, date: `2027-01-0${index + 1}`, close: 200 + index }))]);
    expect(baseSeries[39].ma20).toBe(extendedSeries[39].ma20);
    expect(baseSeries[39].macd).toBe(extendedSeries[39].macd);
    expect(baseSeries[20].rsi).not.toBeNull();
  });

  it("calculates return, risk and distribution summaries", () => {
    const analytics = calculateAnalytics(history());
    expect(analytics.sample_size).toBe(80);
    expect(analytics.return_20d).not.toBeNull();
    expect(analytics.annualized_volatility).not.toBeNull();
    const rows = [stock("000001", "A"), { ...stock("000002", "B"), change_pct: -4 }];
    expect(calculateDistribution(rows).reduce((sum, item) => sum + item.count, 0)).toBe(2);
  });

  it("builds comparison metrics and a square correlation matrix", () => {
    const result = calculateComparison([detail("300001", "甲"), detail("300002", "乙")], 60);
    expect(result.series).toHaveLength(2);
    expect(result.metrics).toHaveLength(2);
    expect(result.correlation.values).toHaveLength(2);
    expect(result.correlation.values[0]).toHaveLength(2);
  });

  it("keeps Xiaomi search and company profile available in fallback mode", async () => {
    const results = await staticApi.searchStocks("小米集团");
    expect(results.items[0]).toMatchObject({ code: "01810", market: "HK" });
    const xiaomi = await staticApi.stockDetail("01810", "HK");
    expect(xiaomi.profile?.main_business).toContain("智能手机");
    expect(xiaomi.history).toHaveLength(120);
  });
});
