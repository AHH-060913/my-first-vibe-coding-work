import { Component, Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type ErrorInfo, type ReactNode } from "react";
import { Activity, BarChart3, Database, GitCompareArrows, Layers, LineChart, Newspaper, RefreshCw, Search, ShieldAlert, Star, TrendingUp, X } from "lucide-react";
import { api } from "./api";
import { SkeletonGrid } from "./components/Common";
import { formatDateTime } from "./format";
import { navigate, useHashRoute, type Section } from "./router";
import { allWatchKeys, inferMarket, loadCompareKeys, loadNotes, loadSamplePool, loadWatchState, makeStockKey, parseStockKey, saveCompareKeys, saveResearchNote, saveSamplePool, saveWatchState, type WatchState } from "./storage";
import type { ContentFilters } from "./pages/NewsPage";
import type { RankingType } from "./pages/RankingsPage";
import type { Announcement, CompareResponse, ListResponse, NewsItem, Overview, Prediction, ResearchNote, Sector, Stock, StockDetail, StockSearchResult, ThemeKey } from "./types";

const OverviewPage = lazy(() => import("./pages/OverviewPage"));
const SectorsPage = lazy(() => import("./pages/SectorsPage"));
const StocksPage = lazy(() => import("./pages/StocksPage"));
const StockDetailPage = lazy(() => import("./pages/StockDetailPage"));
const ComparePage = lazy(() => import("./pages/ComparePage"));
const RankingsPage = lazy(() => import("./pages/RankingsPage"));
const NewsPage = lazy(() => import("./pages/NewsPage"));
const PredictionsPage = lazy(() => import("./pages/PredictionsPage"));
const WatchlistPage = lazy(() => import("./pages/WatchlistPage"));

const navItems: Array<{ key: Section; label: string; icon: typeof Activity }> = [
  { key: "overview", label: "总览", icon: Activity },
  { key: "sectors", label: "行业主题", icon: Layers },
  { key: "stocks", label: "个股行情", icon: LineChart },
  { key: "compare", label: "股票对比", icon: GitCompareArrows },
  { key: "rankings", label: "排行榜", icon: BarChart3 },
  { key: "news", label: "新闻公告", icon: Newspaper },
  { key: "predictions", label: "模型预测", icon: TrendingUp },
  { key: "watchlist", label: "自选股", icon: Star }
];

const themeLabels: Record<string, string> = { tech: "科技", new_energy: "新能源", display: "显示", pv: "光伏", market: "全市场" };

export default function App() {
  const route = useHashRoute();
  const activeSection: Section = route.section === "stock-detail" ? "stocks" : route.section;
  const [theme, setTheme] = useState<ThemeKey | "">("");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [stocks, setStocks] = useState<ListResponse<Stock> | null>(null);
  const [sectors, setSectors] = useState<ListResponse<Sector> | null>(null);
  const [rankings, setRankings] = useState<ListResponse<Stock | Sector | Prediction> | null>(null);
  const [news, setNews] = useState<ListResponse<NewsItem> | null>(null);
  const [announcements, setAnnouncements] = useState<ListResponse<Announcement> | null>(null);
  const [predictions, setPredictions] = useState<ListResponse<Prediction> | null>(null);
  const [detail, setDetail] = useState<StockDetail | null>(null);
  const [indexHistory, setIndexHistory] = useState<Overview["index_history"]>([]);
  const [selectedIndex, setSelectedIndex] = useState("000001");
  const [indexRange, setIndexRange] = useState(60);
  const [selectedSector, setSelectedSector] = useState("");
  const [compareRange, setCompareRange] = useState(60);
  const [compareData, setCompareData] = useState<CompareResponse | null>(null);
  const [compareKeys, setCompareKeys] = useState<string[]>(loadCompareKeys);
  const [compareMessage, setCompareMessage] = useState("");
  const [rankingType, setRankingType] = useState<RankingType>("gainers");
  const [contentFilters, setContentFilters] = useState<ContentFilters>({ q: "", type: "", dateFrom: "", dateTo: "" });
  const [samplePool, setSamplePool] = useState<StockDetail[]>(loadSamplePool);
  const [watchState, setWatchState] = useState<WatchState>(loadWatchState);
  const [notes, setNotes] = useState<Record<string, ResearchNote>>(loadNotes);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<StockSearchResult[]>([]);
  const [searchMessage, setSearchMessage] = useState("");
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refreshVersion, setRefreshVersion] = useState(0);
  const loadSequence = useRef(0);

  useEffect(() => { api.warm().catch(() => undefined); }, []);

  const applyDemoForRoute = useCallback(async () => {
    const stockParams = stockParamsFor(theme);
    if (route.section === "overview") {
      const [overviewData, stockData, sectorData] = await Promise.all([api.demo.overview(), api.demo.stocks(stockParams), api.demo.sectors(theme || undefined)]);
      setOverview(overviewData); setStocks(stockData); setSectors(sectorData);
    } else if (route.section === "sectors") {
      const [sectorData, stockData] = await Promise.all([api.demo.sectors(theme || undefined), api.demo.stocks(stockParams)]);
      setSectors(sectorData); setStocks(stockData);
      if (!selectedSector && sectorData.items[0]) setSelectedSector(sectorData.items[0].name);
    } else if (["stocks", "compare", "watchlist"].includes(route.section)) {
      setStocks(await api.demo.stocks(stockParams));
    } else if (route.section === "rankings") {
      setRankings(await api.demo.rankings(rankingType));
    } else if (route.section === "news") {
      const [newsData, announcementData] = await Promise.all([api.demo.news(contentParams(theme, contentFilters, false)), api.demo.announcements(contentParams(theme, contentFilters, true))]);
      setNews(newsData); setAnnouncements(announcementData);
    } else if (route.section === "predictions") {
      setPredictions(await api.demo.predictions(predictionParams(theme)));
    } else if (route.section === "stock-detail" && route.code) {
      const key = makeStockKey(route.code, route.market);
      const local = loadSamplePool().find((item) => makeStockKey(item.quote.code, item.quote.market) === key);
      setDetail(local ?? await api.demo.stockDetail(route.code, route.market, 120));
    }
  }, [contentFilters, rankingType, route.code, route.market, route.section, selectedSector, theme]);

  const loadLiveForRoute = useCallback(async (signal?: AbortSignal) => {
    const stockParams = stockParamsFor(theme);
    if (route.section === "overview") {
      const [overviewData, stockData, sectorData] = await Promise.all([api.overview(signal), api.stocks(stockParams, signal), api.sectors(theme || undefined, signal)]);
      setOverview(overviewData); setStocks(stockData); setSectors(sectorData);
    } else if (route.section === "sectors") {
      const sectorData = await api.sectors(theme || undefined, signal);
      setSectors(sectorData);
      const sectorName = sectorData.items.some((item) => item.name === selectedSector) ? selectedSector : sectorData.items[0]?.name || "";
      if (sectorName !== selectedSector) setSelectedSector(sectorName);
      const params = stockParamsFor(theme, sectorName);
      setStocks(await api.stocks(params, signal));
    } else if (["stocks", "compare", "watchlist"].includes(route.section)) {
      setStocks(await api.stocks(stockParams, signal));
    } else if (route.section === "rankings") {
      setRankings(await api.rankings(rankingType, signal));
    } else if (route.section === "news") {
      const [newsData, announcementData] = await Promise.all([api.news(contentParams(theme, contentFilters, false), signal), api.announcements(contentParams(theme, contentFilters, true), signal)]);
      setNews(newsData); setAnnouncements(announcementData);
    } else if (route.section === "predictions") {
      setPredictions(await api.predictions(predictionParams(theme), signal));
    } else if (route.section === "stock-detail" && route.code) {
      const liveDetail = await api.stockDetail(route.code, route.market, false, 120, signal);
      const predictionData = await api.predictions(new URLSearchParams({ code: route.code, market: route.market || "", horizons: "1,3,5" }), signal).catch(() => null);
      const resolved = { ...liveDetail, predictions: predictionData?.items ?? liveDetail.predictions ?? [] };
      setDetail(resolved);
      setSamplePool((current) => saveSamplePool([resolved, ...current]));
    }
  }, [contentFilters, rankingType, route.code, route.market, route.section, selectedSector, theme]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const sequence = ++loadSequence.current;
    setLoading(true); setError("");
    (async () => {
      await applyDemoForRoute();
      if (!active || sequence !== loadSequence.current) return;
      try { await loadLiveForRoute(controller.signal); }
      catch (reason) {
        if (active && sequence === loadSequence.current) setError(`云端数据暂未完成更新，当前继续展示可用缓存。${reason instanceof Error ? ` ${reason.message}` : ""}`);
      } finally {
        if (active && sequence === loadSequence.current) setLoading(false);
      }
    })();
    return () => { active = false; controller.abort(); };
  }, [applyDemoForRoute, loadLiveForRoute, refreshVersion]);

  useEffect(() => {
    if (route.section !== "overview") return;
    let active = true;
    const controller = new AbortController();
    (async () => {
      const demo = await api.demo.indexHistory(selectedIndex, indexRange);
      if (active) setIndexHistory(demo.items);
      try { const live = await api.indexHistory(selectedIndex, indexRange, controller.signal); if (active) setIndexHistory(live.items); } catch { /* keep demo history */ }
    })();
    return () => { active = false; controller.abort(); };
  }, [indexRange, refreshVersion, route.section, selectedIndex]);

  useEffect(() => {
    if (route.section !== "sectors" || !selectedSector) return;
    let active = true;
    const controller = new AbortController();
    const params = stockParamsFor(theme, selectedSector);
    (async () => {
      const demo = await api.demo.stocks(params);
      if (active) setStocks(demo);
      try { const live = await api.stocks(params, controller.signal); if (active) setStocks(live); } catch { /* retain fallback */ }
    })();
    return () => { active = false; controller.abort(); };
  }, [refreshVersion, route.section, selectedSector, theme]);

  useEffect(() => {
    if (route.section !== "compare" || compareKeys.length < 2) { setCompareData(null); return; }
    let active = true;
    const controller = new AbortController();
    const symbols = compareKeys.map(parseStockKey);
    setLoading(true);
    (async () => {
      const demo = await api.demo.compare(symbols, compareRange);
      if (active) setCompareData(demo);
      try { const live = await api.compare(symbols, compareRange, "000300", controller.signal); if (active) setCompareData(live); }
      catch { if (active) setCompareMessage("云端批量对比暂不可用，当前展示演示计算结果。"); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; controller.abort(); };
  }, [compareKeys, compareRange, refreshVersion, route.section]);

  const poolStocks = useMemo(() => samplePool.map((item) => item.quote), [samplePool]);
  const stockUniverse = useMemo(() => mergeStocks(stocks?.items ?? [], poolStocks), [poolStocks, stocks?.items]);
  const watchedKeys = useMemo(() => allWatchKeys(watchState), [watchState]);
  const displayRankings = useMemo(() => mergeRankings(rankings?.items ?? [], poolStocks, samplePool, rankingType), [poolStocks, rankings?.items, rankingType, samplePool]);
  const activeSectorStocks = useMemo(() => selectedSector ? stockUniverse.filter((item) => item.sector === selectedSector) : stockUniverse, [selectedSector, stockUniverse]);
  const watchStocks = useMemo(() => stockUniverse.filter((item) => watchedKeys.includes(makeStockKey(item.code, item.market))), [stockUniverse, watchedKeys]);

  const openStock = useCallback((stock: Pick<Stock, "code" | "market">) => navigate(`stock/${stock.market || inferMarket(stock.code)}/${stock.code}`), []);
  const selectSector = useCallback((sector: string) => { setSelectedSector(sector); navigate("sectors"); }, []);
  const toggleCompare = useCallback((stock: Pick<Stock, "code" | "market">) => {
    const key = makeStockKey(stock.code, stock.market);
    setCompareKeys((current) => {
      if (!current.includes(key) && current.length >= 5) { setCompareMessage("最多同时比较 5 只股票，请先移除一只。"); return current; }
      const next = current.includes(key) ? current.filter((item) => item !== key) : [...current, key];
      saveCompareKeys(next); setCompareMessage(""); return next;
    });
  }, []);
  const toggleWatch = useCallback((stock: Pick<Stock, "code" | "market">) => {
    const key = makeStockKey(stock.code, stock.market);
    setWatchState((current) => {
      const activeId = current.activeGroupId || current.groups[0]?.id;
      const next = { ...current, groups: current.groups.map((group) => group.id !== activeId ? group : { ...group, codes: group.codes.includes(key) ? group.codes.filter((item) => item !== key) : [...group.codes, key] }) };
      saveWatchState(next); return next;
    });
  }, []);

  const runSearch = useCallback(async () => {
    const value = query.trim(); if (!value) return;
    setSearching(true); setSearchMessage(""); setError("");
    try {
      const demo = await api.demo.searchStocks(value);
      if (demo.items.length) setSearchResults(demo.items);
      const payload = await api.searchStocks(value);
      setSearchResults(payload.items);
      if (!payload.items.length) setSearchMessage(`没有找到“${value}”，请尝试股票代码或完整名称。`);
    } catch (reason) {
      if (!searchResults.length) setSearchMessage("在线搜索暂不可用，请稍后重试。");
      setError(reason instanceof Error ? reason.message : "在线搜索失败");
    } finally { setSearching(false); }
  }, [query, searchResults.length]);

  const addSearchResult = useCallback(async (result: StockSearchResult) => {
    setSearching(true); setError("");
    try {
      const resolved = result.source.includes("static-demo") ? await api.demo.resolveStock(result.code, result.market, 120) : await api.resolveStock(result.code, result.market, false, 120);
      setSamplePool((current) => saveSamplePool([resolved, ...current]));
      setSearchResults([]); setQuery(""); openStock(resolved.quote);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "股票解析失败"); }
    finally { setSearching(false); }
  }, [openStock]);

  const saveNote = useCallback((note: ResearchNote) => setNotes(saveResearchNote(note)), []);
  const createGroup = useCallback((name: string) => setWatchState((current) => {
    const id = `group-${Date.now()}`; const next = { activeGroupId: id, groups: [...current.groups, { id, name, codes: [] }] }; saveWatchState(next); return next;
  }), []);
  const deleteGroup = useCallback((id: string) => setWatchState((current) => {
    if (current.groups.length <= 1) return current;
    const removed = current.groups.find((group) => group.id === id); const remaining = current.groups.filter((group) => group.id !== id);
    remaining[0] = { ...remaining[0], codes: Array.from(new Set([...remaining[0].codes, ...(removed?.codes ?? [])])) };
    const next = { activeGroupId: remaining[0].id, groups: remaining }; saveWatchState(next); return next;
  }), []);
  const moveWatch = useCallback((key: string, groupId: string) => setWatchState((current) => {
    const next = { activeGroupId: groupId, groups: current.groups.map((group) => ({ ...group, codes: group.id === groupId ? Array.from(new Set([...group.codes, key])) : group.codes.filter((item) => item !== key) })) };
    saveWatchState(next); return next;
  }), []);

  useRevealAnimations(`${route.section}-${theme}-${loading}-${detail?.quote.code ?? ""}`);

  const currentSource = route.section === "stock-detail" ? detail?.source : route.section === "overview" ? overview?.source : route.section === "sectors" ? sectors?.source : route.section === "news" ? news?.source : route.section === "predictions" ? predictions?.source : stocks?.source;
  const sourceIsDemo = !currentSource || currentSource.includes("seed") || currentSource.includes("static-demo");
  const title = route.section === "stock-detail" ? "个股深度分析" : sectionTitle(activeSection);
  const themes = overview?.themes ?? [{ key: "tech" as ThemeKey, label: "科技" }, { key: "new_energy" as ThemeKey, label: "新能源" }, { key: "display" as ThemeKey, label: "显示" }, { key: "pv" as ThemeKey, label: "光伏" }];

  return <div className="shell">
    <header className="globalNav"><div className="navInner">
      <button className="brand" onClick={() => navigate("overview")} aria-label="返回市场总览"><span className="brandMark">A</span><span className="brandText"><strong>Vibe 投研</strong><small>我的第一个作品</small></span></button>
      <nav className="primaryNav" aria-label="主要导航">{navItems.map((item) => { const Icon = item.icon; return <button key={item.key} className={activeSection === item.key ? "active" : ""} onClick={() => navigate(item.key)}><Icon size={15} /><span>{item.label}</span>{item.key === "compare" && <small className="navCount">{compareKeys.length}</small>}</button>; })}</nav>
      <div className="dataStatus" title={currentSource || "正在连接数据源"}><Database size={14} /><span className={`statusDot ${loading ? "waiting" : sourceIsDemo ? "demo" : ""}`} /><span>{loading && sourceIsDemo ? "云端唤醒中" : sourceIsDemo ? "演示数据" : "数据在线"}</span></div>
    </div>{loading && <div className="loadProgress" />}</header>

    <main className="main">
      <header className="topbar"><div className="titleBlock"><span className="eyebrow">A-SHARE RESEARCH WORKSPACE</span><h1>{title}</h1><p>{theme ? themeLabels[theme] : "全市场"} · 更新于 {formatDateTime(detail?.updated_at || overview?.updated_at || stocks?.updated_at || sectors?.updated_at)}</p></div>
        <div className="toolbar"><label className="searchBox"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && runSearch()} placeholder="搜索股票代码或名称" /></label><button className="searchAction" onClick={runSearch} disabled={searching}>{searching ? "搜索中" : "在线搜索"}</button><button className="iconButton" onClick={() => { api.clearCache(); setRefreshVersion((value) => value + 1); }} title="刷新当前页面数据"><RefreshCw size={18} className={loading ? "spin" : ""} /></button></div>
      </header>

      {!!searchResults.length && <div className="searchResults"><div className="searchResultsHeader"><strong>搜索结果</strong><button onClick={() => setSearchResults([])} title="关闭搜索结果"><X size={15} /></button></div><div className="searchResultList">{searchResults.map((item) => <button key={`${item.market}:${item.code}`} onClick={() => addSearchResult(item)}><strong>{item.name}</strong><span>{item.code} · {item.market} · {item.source}</span><em>打开详情</em></button>)}</div></div>}
      {searchMessage && <div className="searchResults emptySearch">{searchMessage}</div>}

      {route.section !== "stock-detail" && <div className="controlBar"><div className="themeRow" aria-label="主题筛选"><button className={!theme ? "selected" : ""} onClick={() => setTheme("")}>全市场</button>{themes.map((item) => <button key={item.key} className={theme === item.key ? "selected" : ""} onClick={() => setTheme(item.key)}>{item.label}</button>)}</div><div className="notice"><ShieldAlert size={15} /><span>研究展示，不构成投资建议</span></div></div>}
      {error && <div className="errorBanner"><span>{error}</span><button onClick={() => setError("")}><X size={14} /></button></div>}

      <div className="pageStage" key={`${route.section}-${route.code || ""}`}><ErrorBoundary><Suspense fallback={<SkeletonGrid cards={7} />}>
        {route.section === "overview" && <OverviewPage overview={overview} stocks={stockUniverse} sectors={sectors?.items ?? overview?.hot_sectors ?? []} indexHistory={indexHistory ?? []} selectedIndex={selectedIndex} range={indexRange} loading={loading} comparedKeys={compareKeys} watchedKeys={watchedKeys} onSelectIndex={setSelectedIndex} onRangeChange={setIndexRange} onSelectStock={openStock} onToggleCompare={toggleCompare} onToggleWatch={toggleWatch} onSelectSector={selectSector} />}
        {route.section === "sectors" && <SectorsPage sectors={sectors?.items ?? []} stocks={activeSectorStocks} selectedSector={selectedSector} comparedKeys={compareKeys} watchedKeys={watchedKeys} onSelectSector={setSelectedSector} onSelectStock={openStock} onToggleCompare={toggleCompare} onToggleWatch={toggleWatch} />}
        {route.section === "stocks" && <StocksPage stocks={stockUniverse} comparedKeys={compareKeys} watchedKeys={watchedKeys} onSelect={openStock} onToggleCompare={toggleCompare} onToggleWatch={toggleWatch} />}
        {route.section === "stock-detail" && <StockDetailPage detail={detail} loading={loading} note={route.code ? notes[makeStockKey(route.code, route.market)] : undefined} watched={route.code ? watchedKeys.includes(makeStockKey(route.code, route.market)) : false} compared={route.code ? compareKeys.includes(makeStockKey(route.code, route.market)) : false} onBack={() => navigate("stocks")} onToggleWatch={() => detail && toggleWatch(detail.quote)} onToggleCompare={() => detail && toggleCompare(detail.quote)} onSaveNote={saveNote} />}
        {route.section === "compare" && <ComparePage data={compareData} candidates={stockUniverse} selectedKeys={compareKeys} range={compareRange} loading={loading} message={compareMessage} onRangeChange={setCompareRange} onToggle={toggleCompare} onSelectStock={openStock} />}
        {route.section === "rankings" && <RankingsPage type={rankingType} items={displayRankings} comparedKeys={compareKeys} watchedKeys={watchedKeys} onTypeChange={setRankingType} onSelectStock={openStock} onToggleCompare={toggleCompare} onToggleWatch={toggleWatch} />}
        {route.section === "news" && <NewsPage news={news?.items ?? []} announcements={announcements?.items ?? []} loading={loading} onApply={setContentFilters} onSelectStock={openStock} />}
        {route.section === "predictions" && <PredictionsPage predictions={predictions?.items ?? []} loading={loading} onSelectStock={openStock} />}
        {route.section === "watchlist" && <WatchlistPage groups={watchState.groups} activeGroupId={watchState.activeGroupId} stocks={watchStocks} notes={notes} comparedKeys={compareKeys} onSelectGroup={(id) => setWatchState((current) => { const next = { ...current, activeGroupId: id }; saveWatchState(next); return next; })} onCreateGroup={createGroup} onDeleteGroup={deleteGroup} onMoveStock={moveWatch} onSelectStock={openStock} onToggleCompare={toggleCompare} onToggleWatch={toggleWatch} />}
      </Suspense></ErrorBoundary></div>
    </main>
    <footer className="siteFooter"><span>Vibe 投研 · A股研究工作台</span><span>所有概率、指标与资料仅供研究参考</span></footer>
  </div>;
}

function stockParamsFor(theme: ThemeKey | "", sector = "") {
  const params = new URLSearchParams({ page_size: "100", sort: "change_pct", order: "desc" });
  if (theme) params.set("theme", theme); if (sector) params.set("sector", sector); return params;
}

function contentParams(theme: ThemeKey | "", filters: ContentFilters, announcements: boolean) {
  const params = new URLSearchParams();
  if (theme && !announcements) params.set("theme", theme); if (filters.q) params.set("q", filters.q); if (announcements && filters.type) params.set("type", filters.type); if (filters.dateFrom) params.set("date_from", filters.dateFrom); if (filters.dateTo) params.set("date_to", filters.dateTo); return params;
}

function predictionParams(theme: ThemeKey | "") {
  const params = new URLSearchParams({ horizons: "1,3,5" }); if (theme) params.set("theme", theme); return params;
}

function mergeStocks(base: Stock[], extras: Stock[]) {
  return Array.from(new Map([...extras, ...base].map((item) => [makeStockKey(item.code, item.market), item])).values());
}

function mergeRankings(items: Array<Stock | Sector | Prediction>, poolStocks: Stock[], pool: StockDetail[], type: RankingType) {
  if (type === "hot_sector") return items;
  if (type === "model_score") {
    const extras = pool.flatMap((item) => item.predictions ?? []);
    return Array.from(new Map([...(items as Prediction[]), ...extras].map((item) => [`${item.code}:${item.horizon}`, item])).values()).sort((a, b) => b.excess_probability - a.excess_probability);
  }
  const merged = mergeStocks(items as Stock[], poolStocks);
  const key: keyof Stock = type === "turnover" ? "amount" : type === "volume_ratio" ? "volume_ratio" : "change_pct";
  return merged.sort((a, b) => type === "losers" ? Number(a[key] || 0) - Number(b[key] || 0) : Number(b[key] || 0) - Number(a[key] || 0));
}

function sectionTitle(section: Section) {
  return ({ overview: "市场总览", sectors: "行业主题", stocks: "个股行情", compare: "多股可视化对比", rankings: "市场排行榜", news: "财经新闻与公告", predictions: "量化模型预测", watchlist: "个人研究清单" } as Record<Section, string>)[section];
}

function useRevealAnimations(key: string) {
  useEffect(() => {
    let observer: IntersectionObserver | undefined;
    const frame = window.requestAnimationFrame(() => {
      const root = document.querySelector(".pageStage"); if (!root) return;
      const targets = root.querySelectorAll<HTMLElement>(".panel, .marketRibbon button, .analyticsMetric, .watchSummary article, .sectorCard, .eventTimeline > *, .predictionLeaderboard button");
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      observer = new IntersectionObserver((entries) => entries.forEach((entry) => { if (entry.isIntersecting) { entry.target.classList.add("isVisible"); observer?.unobserve(entry.target); } }), { threshold: 0.06, rootMargin: "0px 0px -4% 0px" });
      targets.forEach((target, index) => { target.classList.add("revealItem"); target.style.setProperty("--reveal-delay", `${Math.min(index, 9) * 38}ms`); if (reduced) target.classList.add("isVisible"); else observer?.observe(target); });
    });
    return () => { window.cancelAnimationFrame(frame); observer?.disconnect(); };
  }, [key]);
}

class ErrorBoundary extends Component<{ children: ReactNode }, { error: string }> {
  state = { error: "" };
  static getDerivedStateFromError(error: Error) { return { error: error.message || "页面渲染失败" }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error(error, info); }
  render() { return this.state.error ? <div className="errorBoundary">当前模块暂时无法显示：{this.state.error}</div> : this.props.children; }
}
