import type { ResearchNote, StockDetail, WatchGroup } from "./types";

export const SAMPLE_POOL_KEY = "a-share-sample-pool";
export const COMPARE_POOL_KEY = "a-share-compare-pool";
export const WATCHLIST_KEY = "a-share-watchlist-v2";
export const NOTES_KEY = "a-share-research-notes-v1";

export interface WatchState {
  groups: WatchGroup[];
  activeGroupId: string;
}

const defaultWatchState: WatchState = {
  activeGroupId: "focus",
  groups: [
    { id: "focus", name: "重点观察", codes: ["SZ:300750", "SZ:300308", "SZ:300274"] },
    { id: "research", name: "待研究", codes: [] }
  ]
};

export function makeStockKey(code: string, market = "") {
  return `${market || inferMarket(code)}:${code}`;
}

export function parseStockKey(key: string) {
  const [market, code] = key.includes(":") ? key.split(":", 2) : [inferMarket(key), key];
  return { market, code };
}

export function inferMarket(code: string) {
  if (code.length === 5) return "HK";
  if (code.startsWith("6")) return "SH";
  if (code.startsWith("4") || code.startsWith("8")) return "BJ";
  return "SZ";
}

export function loadSamplePool(): StockDetail[] {
  return readJson<StockDetail[]>(SAMPLE_POOL_KEY, []);
}

export function saveSamplePool(details: StockDetail[]) {
  const unique = Array.from(new Map(details.map((item) => [makeStockKey(item.quote.code, item.quote.market), item])).values()).slice(0, 20);
  writeJson(SAMPLE_POOL_KEY, unique);
  return unique;
}

export function loadCompareKeys(): string[] {
  return readJson<string[]>(COMPARE_POOL_KEY, ["SZ:300750", "SZ:300308"]).slice(0, 5);
}

export function saveCompareKeys(keys: string[]) {
  writeJson(COMPARE_POOL_KEY, keys.slice(0, 5));
}

export function loadWatchState(): WatchState {
  const state = readJson<WatchState>(WATCHLIST_KEY, defaultWatchState);
  if (!state.groups?.length) return defaultWatchState;
  return state;
}

export function saveWatchState(state: WatchState) {
  writeJson(WATCHLIST_KEY, state);
}

export function allWatchKeys(state: WatchState) {
  return Array.from(new Set(state.groups.flatMap((group) => group.codes)));
}

export function loadNotes(): Record<string, ResearchNote> {
  return readJson<Record<string, ResearchNote>>(NOTES_KEY, {});
}

export function saveResearchNote(note: ResearchNote) {
  const notes = loadNotes();
  const key = makeStockKey(note.code, note.market);
  if (!note.text.trim() && !note.tags.length) delete notes[key];
  else notes[key] = note;
  writeJson(NOTES_KEY, notes);
  return notes;
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Browser privacy settings can disable storage; the current session still works.
  }
}
