import type {
  Announcement,
  ListResponse,
  NewsItem,
  Overview,
  Prediction,
  Sector,
  Stock,
  StockDetail
} from "./types";
import { staticApi } from "./staticData";

const API_ROOT = "/api";
const STATIC_DEMO = import.meta.env.VITE_STATIC_DEMO === "true";

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_ROOT}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  overview: () => (STATIC_DEMO ? staticApi.overview() : fetchJson<Overview>("/market/overview")),
  stocks: (params: URLSearchParams) => (STATIC_DEMO ? staticApi.stocks(params) : fetchJson<ListResponse<Stock>>(`/stocks?${params.toString()}`)),
  stockDetail: (code: string) => (STATIC_DEMO ? staticApi.stockDetail(code) : fetchJson<StockDetail>(`/stocks/${code}`)),
  sectors: (theme?: string) => (STATIC_DEMO ? staticApi.sectors(theme) : fetchJson<ListResponse<Sector>>(`/sectors${theme ? `?theme=${theme}` : ""}`)),
  rankings: (type: string) => (STATIC_DEMO ? staticApi.rankings(type) : fetchJson<ListResponse<Stock | Sector | Prediction>>(`/rankings?type=${type}`)),
  news: (params: URLSearchParams) => (STATIC_DEMO ? staticApi.news(params) : fetchJson<ListResponse<NewsItem>>(`/news?${params.toString()}`)),
  announcements: (params: URLSearchParams) => (STATIC_DEMO ? staticApi.announcements(params) : fetchJson<ListResponse<Announcement>>(`/announcements?${params.toString()}`)),
  predictions: (params: URLSearchParams) => (STATIC_DEMO ? staticApi.predictions(params) : fetchJson<ListResponse<Prediction>>(`/predictions?${params.toString()}`)),
  watchlist: () => (STATIC_DEMO ? staticApi.watchlist() : fetchJson<ListResponse<Stock> & { codes: string[] }>("/watchlist")),
  addWatch: (code: string) => (STATIC_DEMO ? staticApi.addWatch(code) : fetchJson<{ ok: boolean; code: string }>("/watchlist", { method: "POST", body: JSON.stringify({ code }) })),
  removeWatch: (code: string) => (STATIC_DEMO ? staticApi.removeWatch(code) : fetchJson<{ ok: boolean; code: string }>(`/watchlist/${code}`, { method: "DELETE" }))
};
