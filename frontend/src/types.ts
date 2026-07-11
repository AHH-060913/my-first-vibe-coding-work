export type ThemeKey = "tech" | "new_energy" | "display" | "pv" | "market";

export interface ThemeMeta {
  key: ThemeKey;
  label: string;
  keywords: string[];
  boards: string[];
}

export interface IndexQuote {
  code: string;
  name: string;
  price: number;
  change_pct: number;
  amount: number;
}

export interface Stock {
  code: string;
  name: string;
  market?: string;
  price: number;
  change_pct: number;
  change?: number;
  volume?: number;
  amount: number;
  amplitude?: number;
  high?: number;
  low?: number;
  open?: number;
  previous_close?: number;
  volume_ratio: number;
  turnover_rate: number;
  pe: number;
  pb: number;
  market_cap: number;
  float_market_cap?: number;
  speed?: number;
  sector: string;
  theme: ThemeKey | "";
  source?: string;
  updated_at?: string;
  stale?: boolean;
}

export interface StockSearchResult {
  code: string;
  name: string;
  market: "SH" | "SZ" | "BJ" | string;
  pinyin?: string;
  source: string;
}

export interface StockProfile {
  code: string;
  name: string;
  full_name: string;
  listing_date: string;
  region: string;
  industry: string;
  main_business: string;
  business_scope: string;
  website: string;
  total_shares: number;
  float_shares: number;
  source: string;
  updated_at: string;
  stale?: boolean;
}

export interface Sector {
  name: string;
  theme: ThemeKey | "";
  change_pct: number;
  amount: number;
  turnover_rate: number;
  up_count: number;
  down_count: number;
  leader: string;
  leader_change_pct: number;
}

export interface HistoryPoint {
  date: string;
  open?: number;
  close: number;
  high?: number;
  low?: number;
  volume?: number;
  amount?: number;
  change_pct?: number;
  turnover_rate?: number;
}

export interface NewsItem {
  title: string;
  source: string;
  published_at: string;
  theme: ThemeKey | "market";
  url: string;
}

export interface Announcement {
  code: string;
  name: string;
  title: string;
  type: string;
  published_at: string;
  url: string;
}

export interface Factor {
  name: string;
  value: number;
  unit: string;
  direction: "positive" | "negative" | "neutral";
}

export interface Prediction {
  code: string;
  name: string;
  horizon: number;
  up_probability: number;
  excess_probability: number;
  confidence: "低" | "中" | "高";
  model: string;
  factors: Factor[];
  risks: string[];
  metrics: {
    accuracy?: number;
    auc?: number | null;
    sample_size?: number;
    validation_size?: number;
    max_drawdown?: number | null;
    top_n_excess_return?: number;
    anti_leakage?: string;
  };
}

export interface Overview {
  updated_at: string;
  source: string;
  indices: IndexQuote[];
  breadth: {
    up: number;
    down: number;
    flat: number;
    total: number;
  };
  total_amount: number;
  hot_sectors: Sector[];
  themes: ThemeMeta[];
  index_history?: HistoryPoint[];
  market_temperature?: MarketTemperature;
  change_distribution?: ChangeDistributionBucket[];
}

export interface MarketTemperature {
  score: number;
  label: string;
  components: {
    breadth: number;
    momentum: number;
    sector_strength: number;
    activity: number;
  };
}

export interface ChangeDistributionBucket {
  label: string;
  min: number | null;
  max: number | null;
  count: number;
}

export interface StockAnalytics {
  return_5d: number | null;
  return_20d: number | null;
  return_60d: number | null;
  annualized_volatility: number | null;
  max_drawdown: number | null;
  price_position: number | null;
  amount_change_5d: number | null;
  sample_size: number;
}

export interface StockEvent {
  kind: "news" | "announcement";
  title: string;
  published_at: string;
  source: string;
  url: string;
  type: string;
}

export interface ListResponse<T> {
  items: T[];
  total?: number;
  page?: number;
  page_size?: number;
  type?: string;
  source: string;
  updated_at: string;
}

export interface StockDetail {
  quote: Stock;
  history: HistoryPoint[];
  profile?: StockProfile;
  news: NewsItem[];
  announcements: Announcement[];
  predictions: Prediction[];
  analytics?: StockAnalytics;
  events?: StockEvent[];
  source: string;
  updated_at: string;
}

export interface IndexHistoryResponse extends ListResponse<HistoryPoint> {
  code: string;
  stale?: boolean;
}

export interface CompareSymbol {
  code: string;
  market?: string;
}

export interface CompareSeries {
  code: string;
  market: string;
  name: string;
  values: Array<{ date: string; value: number }>;
}

export interface CompareMetric {
  code: string;
  market: string;
  name: string;
  return_pct: number;
  excess_return_pct: number;
  annualized_volatility: number | null;
  max_drawdown: number | null;
  correlation_to_benchmark: number | null;
  amount: number;
  pe: number;
  pb: number;
}

export interface CompareResponse {
  window: number;
  benchmark: {
    code: string;
    name: string;
    values: Array<{ date: string; value: number }>;
  };
  series: CompareSeries[];
  metrics: CompareMetric[];
  correlation: {
    labels: string[];
    values: Array<Array<number | null>>;
  };
  source: string;
  updated_at: string;
  stale: boolean;
}

export interface ResearchNote {
  code: string;
  market: string;
  text: string;
  tags: string[];
  updated_at: string;
}

export interface WatchGroup {
  id: string;
  name: string;
  codes: string[];
}
