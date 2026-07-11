import type {
  Announcement,
  ChangeDistributionBucket,
  CompareResponse,
  HistoryPoint,
  MarketTemperature,
  NewsItem,
  Sector,
  Stock,
  StockAnalytics,
  StockDetail,
  StockEvent
} from "../types";

const n = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function calculateAnalytics(history: HistoryPoint[]): StockAnalytics {
  const rows = history.filter((item) => item.date && n(item.close) > 0).slice(-260);
  const closes = rows.map((item) => n(item.close));
  const returns = closes.slice(1).map((value, index) => (closes[index] ? value / closes[index] - 1 : 0));
  const periodReturn = (days: number) => closes.length > days && closes[closes.length - days - 1]
    ? Number(((closes[closes.length - 1] / closes[closes.length - days - 1] - 1) * 100).toFixed(2))
    : null;
  const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  const returnAverage = average(returns);
  const variance = returns.length > 1 ? average(returns.map((value) => (value - returnAverage) ** 2)) : 0;
  let peak = closes[0] ?? 0;
  let maxDrawdown = 0;
  closes.forEach((value) => {
    peak = Math.max(peak, value);
    if (peak) maxDrawdown = Math.min(maxDrawdown, value / peak - 1);
  });
  const low = closes.length ? Math.min(...closes) : 0;
  const high = closes.length ? Math.max(...closes) : 0;
  const amounts = rows.map((item) => n(item.amount));
  const recentAmount = average(amounts.slice(-5));
  const priorAmount = average(amounts.slice(-10, -5));
  return {
    return_5d: periodReturn(5),
    return_20d: periodReturn(20),
    return_60d: periodReturn(60),
    annualized_volatility: returns.length > 1 ? Number((Math.sqrt(variance) * Math.sqrt(252) * 100).toFixed(2)) : null,
    max_drawdown: closes.length ? Number((maxDrawdown * 100).toFixed(2)) : null,
    price_position: high > low ? Number((((closes[closes.length - 1] - low) / (high - low)) * 100).toFixed(2)) : null,
    amount_change_5d: priorAmount ? Number(((recentAmount / priorAmount - 1) * 100).toFixed(2)) : null,
    sample_size: rows.length
  };
}

export function buildEvents(news: NewsItem[], announcements: Announcement[]): StockEvent[] {
  return [
    ...news.map((item): StockEvent => ({ kind: "news", title: item.title, published_at: item.published_at, source: item.source, url: item.url, type: "新闻" })),
    ...announcements.map((item): StockEvent => ({ kind: "announcement", title: item.title, published_at: item.published_at, source: item.name || item.code, url: item.url, type: item.type }))
  ].sort((a, b) => b.published_at.localeCompare(a.published_at));
}

export function calculateDistribution(stocks: Stock[]): ChangeDistributionBucket[] {
  const buckets: ChangeDistributionBucket[] = [
    { label: "<-5%", min: null, max: -5, count: 0 },
    { label: "-5~-3%", min: -5, max: -3, count: 0 },
    { label: "-3~-1%", min: -3, max: -1, count: 0 },
    { label: "-1~0%", min: -1, max: 0, count: 0 },
    { label: "0~1%", min: 0, max: 1, count: 0 },
    { label: "1~3%", min: 1, max: 3, count: 0 },
    { label: "3~5%", min: 3, max: 5, count: 0 },
    { label: ">=5%", min: 5, max: null, count: 0 }
  ];
  stocks.forEach((stock) => {
    const value = n(stock.change_pct);
    const bucket = buckets.find((item) => (item.min == null || value >= item.min) && (item.max == null || value < item.max));
    if (bucket) bucket.count += 1;
  });
  return buckets;
}

export function calculateTemperature(stocks: Stock[], sectors: Sector[]): MarketTemperature {
  const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  const clamp = (value: number) => Math.max(0, Math.min(1, value));
  const breadth = stocks.length ? stocks.filter((item) => item.change_pct > 0).length / stocks.length : 0.5;
  const momentum = clamp((average(stocks.map((item) => item.change_pct)) + 3) / 6);
  const sectorStrength = sectors.length ? sectors.filter((item) => item.change_pct > 0).length / sectors.length : 0.5;
  const activity = clamp((average(stocks.map((item) => item.volume_ratio || 1)) - 0.5) / 1);
  const score = Math.round((breadth * 0.45 + momentum * 0.25 + sectorStrength * 0.15 + activity * 0.15) * 100);
  const label = score < 30 ? "偏冷" : score < 45 ? "谨慎" : score < 56 ? "中性" : score < 70 ? "活跃" : "偏热";
  return {
    score,
    label,
    components: {
      breadth: Number((breadth * 100).toFixed(1)),
      momentum: Number((momentum * 100).toFixed(1)),
      sector_strength: Number((sectorStrength * 100).toFixed(1)),
      activity: Number((activity * 100).toFixed(1))
    }
  };
}

export function calculateComparison(details: StockDetail[], window = 60, benchmarkCode = "000300"): CompareResponse {
  const rowsByStock = details.map((detail) => detail.history.slice(-window));
  const series = details.map((detail, index) => {
    const rows = rowsByStock[index];
    const first = n(rows[0]?.close) || 1;
    return {
      code: detail.quote.code,
      market: detail.quote.market || "",
      name: detail.quote.name,
      values: rows.map((row) => ({ date: row.date, value: Number(((n(row.close) / first - 1) * 100).toFixed(3)) }))
    };
  });
  const dailyMaps = rowsByStock.map(dailyReturnMap);
  const benchmarkValues = series[0]?.values.map((item) => ({ ...item, value: Number((item.value * 0.55).toFixed(3)) })) ?? [];
  const benchmarkDaily = new Map(benchmarkValues.slice(1).map((item, index) => [item.date, (item.value - benchmarkValues[index].value) / 100]));
  const metrics = details.map((detail, index) => {
    const analytics = calculateAnalytics(rowsByStock[index]);
    const returnPct = series[index]?.values[series[index].values.length - 1]?.value ?? 0;
    const benchmarkReturn = benchmarkValues[benchmarkValues.length - 1]?.value ?? 0;
    return {
      code: detail.quote.code,
      market: detail.quote.market || "",
      name: detail.quote.name,
      return_pct: returnPct,
      excess_return_pct: Number((returnPct - benchmarkReturn).toFixed(2)),
      annualized_volatility: analytics.annualized_volatility,
      max_drawdown: analytics.max_drawdown,
      correlation_to_benchmark: correlation(dailyMaps[index], benchmarkDaily),
      amount: detail.quote.amount,
      pe: detail.quote.pe,
      pb: detail.quote.pb
    };
  });
  return {
    window,
    benchmark: { code: benchmarkCode, name: "沪深300", values: benchmarkValues },
    series,
    metrics,
    correlation: {
      labels: metrics.map((item) => item.name),
      values: dailyMaps.map((left) => dailyMaps.map((right) => correlation(left, right)))
    },
    source: "static-demo:derived",
    updated_at: new Date().toISOString(),
    stale: true
  };
}

export interface TechnicalPoint extends HistoryPoint {
  ma5: number | null;
  ma10: number | null;
  ma20: number | null;
  macd: number | null;
  signal: number | null;
  histogram: number | null;
  rsi: number | null;
}

export function calculateTechnicalSeries(history: HistoryPoint[]): TechnicalPoint[] {
  const closes = history.map((item) => n(item.close));
  const ma = (index: number, window: number) => index + 1 >= window
    ? Number((closes.slice(index + 1 - window, index + 1).reduce((sum, value) => sum + value, 0) / window).toFixed(3))
    : null;
  const ema12 = exponentialAverage(closes, 12);
  const ema26 = exponentialAverage(closes, 26);
  const diff = closes.map((_, index) => ema12[index] - ema26[index]);
  const signal = exponentialAverage(diff, 9);
  const rsi = relativeStrength(closes, 14);
  return history.map((item, index) => ({
    ...item,
    ma5: ma(index, 5),
    ma10: ma(index, 10),
    ma20: ma(index, 20),
    macd: Number(diff[index].toFixed(4)),
    signal: Number(signal[index].toFixed(4)),
    histogram: Number(((diff[index] - signal[index]) * 2).toFixed(4)),
    rsi: rsi[index]
  }));
}

function exponentialAverage(values: number[], period: number) {
  const multiplier = 2 / (period + 1);
  return values.reduce<number[]>((result, value, index) => {
    result.push(index ? value * multiplier + result[index - 1] * (1 - multiplier) : value);
    return result;
  }, []);
}

function relativeStrength(values: number[], period: number) {
  return values.map((_, index) => {
    if (index < period) return null;
    const changes = values.slice(index - period + 1, index + 1).map((value, itemIndex, rows) => itemIndex ? value - rows[itemIndex - 1] : 0).slice(1);
    const gains = changes.filter((value) => value > 0).reduce((sum, value) => sum + value, 0) / period;
    const losses = Math.abs(changes.filter((value) => value < 0).reduce((sum, value) => sum + value, 0)) / period;
    if (!losses) return 100;
    return Number((100 - 100 / (1 + gains / losses)).toFixed(2));
  });
}

function dailyReturnMap(rows: HistoryPoint[]) {
  return new Map(rows.slice(1).map((item, index) => [item.date, rows[index].close ? item.close / rows[index].close - 1 : 0]));
}

function correlation(left: Map<string, number>, right: Map<string, number>): number | null {
  const dates = [...left.keys()].filter((date) => right.has(date));
  if (dates.length < 3) return null;
  const leftValues = dates.map((date) => left.get(date) ?? 0);
  const rightValues = dates.map((date) => right.get(date) ?? 0);
  const avg = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const leftAverage = avg(leftValues);
  const rightAverage = avg(rightValues);
  const numerator = leftValues.reduce((sum, value, index) => sum + (value - leftAverage) * (rightValues[index] - rightAverage), 0);
  const leftScale = Math.sqrt(leftValues.reduce((sum, value) => sum + (value - leftAverage) ** 2, 0));
  const rightScale = Math.sqrt(rightValues.reduce((sum, value) => sum + (value - rightAverage) ** 2, 0));
  return leftScale && rightScale ? Number((numerator / (leftScale * rightScale)).toFixed(4)) : null;
}
