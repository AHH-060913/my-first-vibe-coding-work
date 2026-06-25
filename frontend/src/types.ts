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
  news: NewsItem[];
  announcements: Announcement[];
  predictions: Prediction[];
  source: string;
  updated_at: string;
}
