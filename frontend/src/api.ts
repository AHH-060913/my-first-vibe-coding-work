import type {
  Announcement,
  ListResponse,
  NewsItem,
  Overview,
  Prediction,
  Sector,
  Stock,
  StockSearchResult,
  StockDetail
} from "./types";
import { staticApi } from "./staticData";

const API_ROOT = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");
const STATIC_DEMO = import.meta.env.VITE_STATIC_DEMO === "true";
const CACHE_PREFIX = "a-share-api-cache:";
const memoryCache = new Map<string, { expiresAt: number; value: unknown }>();
const pendingRequests = new Map<string, Promise<unknown>>();

function cacheTtl(path: string) {
  if (path.includes("/stocks/") && !path.includes("/search/")) return 5 * 60_000;
  if (path.startsWith("/news") || path.startsWith("/announcements")) return 2 * 60_000;
  if (path.startsWith("/search/")) return 30_000;
  return 45_000;
}

function readStored<T>(key: string, ttl: number): T | null {
  try {
    const raw = window.localStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt: number; value: T };
    if (!parsed?.savedAt || Date.now() - parsed.savedAt > ttl) return null;
    return parsed.value;
  } catch {
    return null;
  }
}

function storeResponse(key: string, value: unknown, ttl: number) {
  memoryCache.set(key, { expiresAt: Date.now() + ttl, value });
  try {
    window.localStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify({ savedAt: Date.now(), value }));
  } catch {
    // Storage can be unavailable or full; memory caching still works.
  }
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method || "GET").toUpperCase();
  const cacheable = method === "GET";
  const key = `${API_ROOT}${path}`;
  const ttl = cacheTtl(path);

  if (cacheable) {
    const cached = memoryCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.value as T;
    const stored = readStored<T>(key, ttl);
    if (stored) {
      memoryCache.set(key, { expiresAt: Date.now() + ttl, value: stored });
      return stored;
    }
    const pending = pendingRequests.get(key);
    if (pending) return pending as Promise<T>;
  }

  const request = (async () => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 55_000);
    try {
      const response = await fetch(key, {
        headers: { "Content-Type": "application/json" },
        signal: init?.signal || controller.signal,
        ...init
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `HTTP ${response.status}`);
      }
      const value = (await response.json()) as T;
      if (cacheable) storeResponse(key, value, ttl);
      return value;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new Error("数据服务响应超时，请稍后重试");
      }
      throw error;
    } finally {
      window.clearTimeout(timeout);
      pendingRequests.delete(key);
    }
  })();

  if (cacheable) pendingRequests.set(key, request);
  return request;
}

function withMarket(path: string, market?: string, includePredictions = true) {
  const params = new URLSearchParams();
  if (market) params.set("market", market);
  if (!includePredictions) params.set("include_predictions", "false");
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

export const api = {
  overview: () => (STATIC_DEMO ? staticApi.overview() : fetchJson<Overview>("/market/overview")),
  stocks: (params: URLSearchParams) => (STATIC_DEMO ? staticApi.stocks(params) : fetchJson<ListResponse<Stock>>(`/stocks?${params.toString()}`)),
  searchStocks: (q: string) => (STATIC_DEMO ? staticApi.searchStocks(q) : fetchJson<ListResponse<StockSearchResult>>(`/search/stocks?q=${encodeURIComponent(q)}`)),
  stockDetail: (code: string, market?: string, includePredictions = true) =>
    STATIC_DEMO ? staticApi.stockDetail(code, market) : fetchJson<StockDetail>(withMarket(`/stocks/${code}`, market, includePredictions)),
  resolveStock: (code: string, market?: string, includePredictions = true) =>
    STATIC_DEMO ? staticApi.resolveStock(code, market) : fetchJson<StockDetail>(withMarket(`/stocks/${code}/resolve`, market, includePredictions)),
  sectors: (theme?: string) => (STATIC_DEMO ? staticApi.sectors(theme) : fetchJson<ListResponse<Sector>>(`/sectors${theme ? `?theme=${theme}` : ""}`)),
  rankings: (type: string) => (STATIC_DEMO ? staticApi.rankings(type) : fetchJson<ListResponse<Stock | Sector | Prediction>>(`/rankings?type=${type}`)),
  news: (params: URLSearchParams) => (STATIC_DEMO ? staticApi.news(params) : fetchJson<ListResponse<NewsItem>>(`/news?${params.toString()}`)),
  announcements: (params: URLSearchParams) => (STATIC_DEMO ? staticApi.announcements(params) : fetchJson<ListResponse<Announcement>>(`/announcements?${params.toString()}`)),
  predictions: (params: URLSearchParams) => (STATIC_DEMO ? staticApi.predictions(params) : fetchJson<ListResponse<Prediction>>(`/predictions?${params.toString()}`)),
  watchlist: () => (STATIC_DEMO ? staticApi.watchlist() : fetchJson<ListResponse<Stock> & { codes: string[] }>("/watchlist")),
  addWatch: async (code: string) => {
    const result = STATIC_DEMO ? await staticApi.addWatch(code) : await fetchJson<{ ok: boolean; code: string }>("/watchlist", { method: "POST", body: JSON.stringify({ code }) });
    api.clearCache("/watchlist");
    return result;
  },
  removeWatch: async (code: string) => {
    const result = STATIC_DEMO ? await staticApi.removeWatch(code) : await fetchJson<{ ok: boolean; code: string }>(`/watchlist/${code}`, { method: "DELETE" });
    api.clearCache("/watchlist");
    return result;
  },
  clearCache: (path = "") => {
    const target = `${API_ROOT}${path}`;
    for (const key of memoryCache.keys()) {
      if (!path || key.startsWith(target)) memoryCache.delete(key);
    }
    try {
      for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
        const storageKey = window.localStorage.key(index);
        if (!storageKey?.startsWith(CACHE_PREFIX)) continue;
        const requestKey = storageKey.slice(CACHE_PREFIX.length);
        if (!path || requestKey.startsWith(target)) window.localStorage.removeItem(storageKey);
      }
    } catch {
      // Ignore storage access failures.
    }
  }
};
