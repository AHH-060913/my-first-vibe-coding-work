import { Component, Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type ErrorInfo, type ReactNode } from "react";
import {
  Activity,
  BarChart3,
  Bell,
  Database,
  GitCompareArrows,
  Layers,
  LineChart as LineChartIcon,
  Newspaper,
  RefreshCw,
  Search,
  ShieldAlert,
  Star,
  TrendingUp,
  X
} from "lucide-react";
import { api } from "./api";
import { formatAmount, formatDateTime, formatPct, probability } from "./format";
import type { Announcement, HistoryPoint, ListResponse, NewsItem, Overview, Prediction, Sector, Stock, StockDetail, StockSearchResult, ThemeKey } from "./types";

const LazyLineChart = lazy(() => import("./components/Charts").then((module) => ({ default: module.LineChart })));
const LazySectorBarChart = lazy(() => import("./components/Charts").then((module) => ({ default: module.SectorBarChart })));
const LazyComparisonLineChart = lazy(() => import("./components/Charts").then((module) => ({ default: module.ComparisonLineChart })));

type Section = "overview" | "sectors" | "stocks" | "compare" | "rankings" | "news" | "predictions" | "watchlist";
type RankingType = "gainers" | "losers" | "turnover" | "volume_ratio" | "hot_sector" | "model_score";

const themeLabels: Record<string, string> = {
  tech: "科技",
  new_energy: "新能源",
  display: "显示",
  pv: "光伏",
  market: "全市场"
};

const navItems: Array<{ key: Section; label: string; icon: typeof Activity }> = [
  { key: "overview", label: "总览", icon: Activity },
  { key: "sectors", label: "行业主题", icon: Layers },
  { key: "stocks", label: "个股行情", icon: LineChartIcon },
  { key: "compare", label: "股票对比", icon: GitCompareArrows },
  { key: "rankings", label: "排行榜", icon: BarChart3 },
  { key: "news", label: "新闻公告", icon: Newspaper },
  { key: "predictions", label: "模型预测", icon: TrendingUp },
  { key: "watchlist", label: "自选股", icon: Star }
];

const rankingLabels: Record<RankingType, string> = {
  gainers: "涨幅榜",
  losers: "跌幅榜",
  turnover: "成交额榜",
  volume_ratio: "量比榜",
  hot_sector: "板块热度",
  model_score: "模型评分"
};

const SAMPLE_POOL_KEY = "a-share-sample-pool";
const COMPARE_POOL_KEY = "a-share-compare-pool";
const MAX_COMPARE = 5;

export default function App() {
  const [section, setSection] = useState<Section>("overview");
  const [theme, setTheme] = useState<ThemeKey | "">("");
  const [query, setQuery] = useState("");
  const [horizon, setHorizon] = useState(3);
  const [rankingType, setRankingType] = useState<RankingType>("gainers");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [stocks, setStocks] = useState<ListResponse<Stock> | null>(null);
  const [sectors, setSectors] = useState<ListResponse<Sector> | null>(null);
  const [rankings, setRankings] = useState<ListResponse<Stock | Sector | Prediction> | null>(null);
  const [news, setNews] = useState<ListResponse<NewsItem> | null>(null);
  const [announcements, setAnnouncements] = useState<ListResponse<Announcement> | null>(null);
  const [predictions, setPredictions] = useState<ListResponse<Prediction> | null>(null);
  const [watchlist, setWatchlist] = useState<(ListResponse<Stock> & { codes: string[] }) | null>(null);
  const [samplePool, setSamplePool] = useState<StockDetail[]>(loadSamplePool);
  const [searchResults, setSearchResults] = useState<StockSearchResult[]>([]);
  const [searchMessage, setSearchMessage] = useState("");
  const [searching, setSearching] = useState(false);
  const [selectedCode, setSelectedCode] = useState("300750");
  const [selectedMarket, setSelectedMarket] = useState("SZ");
  const [detail, setDetail] = useState<StockDetail | null>(null);
  const [compareKeys, setCompareKeys] = useState<string[]>(loadCompareKeys);
  const [compareDetails, setCompareDetails] = useState<StockDetail[]>([]);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareMessage, setCompareMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const loadSequence = useRef(0);

  const themes = overview?.themes ?? [
    { key: "tech" as ThemeKey, label: "科技", keywords: [], boards: [] },
    { key: "new_energy" as ThemeKey, label: "新能源", keywords: [], boards: [] },
    { key: "display" as ThemeKey, label: "显示", keywords: [], boards: [] },
    { key: "pv" as ThemeKey, label: "光伏", keywords: [], boards: [] }
  ];

  const loadCurrent = useCallback(async () => {
    const sequence = ++loadSequence.current;
    setLoading(true);
    setError(null);
    try {
      const stockParams = new URLSearchParams({ page_size: "40", sort: "change_pct", order: "desc" });
      if (theme) stockParams.set("theme", theme);

      if (section === "overview") {
        const [overviewData, stocksData] = await Promise.all([api.overview(), api.stocks(stockParams)]);
        if (sequence !== loadSequence.current) return;
        setOverview(overviewData);
        setStocks(stocksData);
      } else if (section === "sectors") {
        const [sectorData, stocksData] = await Promise.all([api.sectors(theme || undefined), api.stocks(stockParams)]);
        if (sequence !== loadSequence.current) return;
        setSectors(sectorData);
        setStocks(stocksData);
      } else if (section === "stocks") {
        const [stocksData, watchData] = await Promise.all([api.stocks(stockParams), api.watchlist()]);
        if (sequence !== loadSequence.current) return;
        setStocks(stocksData);
        setWatchlist(watchData);
      } else if (section === "compare") {
        const stocksData = await api.stocks(stockParams);
        if (sequence !== loadSequence.current) return;
        setStocks(stocksData);
      } else if (section === "rankings") {
        const rankingData = await api.rankings(rankingType);
        if (sequence !== loadSequence.current) return;
        setRankings(rankingData);
      } else if (section === "news") {
        const newsParams = new URLSearchParams();
        if (theme) newsParams.set("theme", theme);
        const [newsData, announcementData] = await Promise.all([api.news(newsParams), api.announcements(new URLSearchParams())]);
        if (sequence !== loadSequence.current) return;
        setNews(newsData);
        setAnnouncements(announcementData);
      } else if (section === "predictions") {
        const predictionParams = new URLSearchParams({ horizon: String(horizon) });
        if (theme) predictionParams.set("theme", theme);
        const predictionData = await api.predictions(predictionParams);
        if (sequence !== loadSequence.current) return;
        setPredictions(predictionData);
      } else if (section === "watchlist") {
        const watchData = await api.watchlist();
        if (sequence !== loadSequence.current) return;
        setWatchlist(watchData);
      }
    } catch (err) {
      if (sequence === loadSequence.current) setError(err instanceof Error ? err.message : "数据加载失败");
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  }, [horizon, rankingType, refreshVersion, section, theme]);

  useEffect(() => {
    loadCurrent();
  }, [loadCurrent]);

  const refreshCurrent = useCallback(() => {
    api.clearCache();
    setRefreshVersion((value) => value + 1);
  }, []);

  useEffect(() => {
    if (section !== "stocks") return;
    let active = true;
    const selectedKey = stockKey({ code: selectedCode, market: selectedMarket });
    const localDetail = samplePool.find((item) => stockKey(item.quote) === selectedKey);
    if (localDetail) {
      setDetail(localDetail);
    } else {
      setDetail(null);
    }
    api
      .stockDetail(selectedCode, selectedMarket, false)
      .then((payload) => {
        if (!active) return;
        setDetail((current) => ({
          ...payload,
          predictions: current && stockKey(current.quote) === selectedKey ? current.predictions ?? [] : []
        }));
        const predictionParams = new URLSearchParams({ code: selectedCode, horizon: "3" });
        api.predictions(predictionParams).then((predictionPayload) => {
          if (!active) return;
          setDetail((current) => current && stockKey(current.quote) === selectedKey ? { ...current, predictions: predictionPayload.items } : current);
        }).catch(() => undefined);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "个股详情加载失败");
      });
    return () => {
      active = false;
    };
  }, [samplePool, section, selectedCode, selectedMarket]);

  useEffect(() => {
    if (section !== "compare") return;
    let active = true;
    const refs = compareKeys.map(parseStockKey).filter((item) => item.code);
    const localByKey = new Map(samplePool.map((item) => [stockKey(item.quote), item]));
    const localDetails = refs.map((item) => localByKey.get(stockKey(item))).filter((item): item is StockDetail => Boolean(item));
    if (localDetails.length) setCompareDetails(localDetails);
    if (!refs.length) {
      setCompareDetails([]);
      setCompareLoading(false);
      return;
    }
    setCompareLoading(true);
    setCompareMessage("");
    Promise.allSettled(refs.map((item) => api.stockDetail(item.code, item.market, false)))
      .then((results) => {
        if (!active) return;
        const resolved = results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
        const resolvedByKey = new Map([...localDetails, ...resolved].map((item) => [stockKey(item.quote), item]));
        setCompareDetails(refs.map((item) => resolvedByKey.get(stockKey(item))).filter((item): item is StockDetail => Boolean(item)));
        const failed = results.filter((result) => result.status === "rejected").length;
        if (failed) setCompareMessage(`${failed} 只股票暂未取得最新详情，已保留其他可用数据。`);
      })
      .finally(() => {
        if (active) setCompareLoading(false);
      });
    return () => {
      active = false;
    };
  }, [compareKeys, samplePool, section]);

  const persistSamplePool = useCallback((next: StockDetail[]) => {
    const unique = Array.from(new Map(next.map((item) => [stockKey(item.quote), item])).values());
    setSamplePool(unique);
    window.localStorage.setItem(SAMPLE_POOL_KEY, JSON.stringify(unique));
  }, []);

  const runOnlineSearch = useCallback(async () => {
    const value = query.trim();
    if (!value) return;
      setSearching(true);
      setError(null);
      setSearchMessage("");
      try {
        const payload = await api.searchStocks(value);
        setSearchResults(payload.items);
        setSearchMessage(payload.items.length ? "" : `没有找到“${value}”，可换股票代码、简称或完整名称再试。`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "在线搜索失败");
        setSearchMessage("在线搜索失败，请稍后重试。");
      } finally {
        setSearching(false);
      }
  }, [query]);

  const addSearchResult = useCallback(
    async (result: StockSearchResult) => {
      setSearching(true);
      setError(null);
      try {
        const resolved = await api.resolveStock(result.code, result.market, false);
        persistSamplePool([resolved, ...samplePool]);
        setSelectedCode(resolved.quote.code);
        setSelectedMarket(resolved.quote.market || result.market);
        setSection("stocks");
      } catch (err) {
        setError(err instanceof Error ? err.message : "添加股票失败");
      } finally {
        setSearching(false);
      }
    },
    [persistSamplePool, samplePool]
  );

  const handleSelectStock = useCallback((code: string, market?: string) => {
    setSelectedCode(code);
    setSelectedMarket(market || inferMarket(code));
    setSection("stocks");
  }, []);

  const toggleCompare = useCallback(
    (stock: Pick<Stock, "code" | "market">) => {
      const key = stockKey(stock);
      const exists = compareKeys.includes(key);
      if (!exists && compareKeys.length >= MAX_COMPARE) {
        setCompareMessage(`最多同时比较 ${MAX_COMPARE} 只股票，请先移除一只。`);
        return;
      }
      const next = exists ? compareKeys.filter((item) => item !== key) : [...compareKeys, key];
      setCompareKeys(next);
      setCompareMessage("");
      window.localStorage.setItem(COMPARE_POOL_KEY, JSON.stringify(next));
    },
    [compareKeys]
  );

  const poolStocks = useMemo(() => samplePool.map((item) => item.quote), [samplePool]);
  const displayStocks = useMemo(() => mergeStocks(stocks?.items ?? [], poolStocks), [poolStocks, stocks]);
  const displayPredictions = useMemo(() => mergePredictions(predictions?.items ?? [], samplePool), [predictions, samplePool]);
  const displayRankings = useMemo(
    () => mergeRankingItems(rankings?.items ?? [], poolStocks, samplePool, rankingType),
    [poolStocks, rankings, rankingType, samplePool]
  );
  const displayWatchlist = useMemo(() => mergeStocks(watchlist?.items ?? [], poolStocks), [poolStocks, watchlist]);

  const selectedThemeName = theme ? themeLabels[theme] : "全市场";
  const freshness = overview?.updated_at || stocks?.updated_at || sectors?.updated_at;
  const source = overview?.source || stocks?.source || "未连接";

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brandMark">A</div>
          <div>
            <strong>我的第一个vibe coding作品</strong>
            <span>A股个人投研看板</span>
          </div>
        </div>
        <nav>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.key} className={section === item.key ? "active" : ""} onClick={() => setSection(item.key)}>
                <Icon size={18} />
                <span>{item.label}</span>
                {item.key === "compare" && <small className="navCount">{compareKeys.length}</small>}
              </button>
            );
          })}
        </nav>
        <div className="sidebarFoot">
          <Database size={16} />
          <span>{source}</span>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h1>{sectionTitle(section)}</h1>
            <p>我的第一个vibe coding作品 · {selectedThemeName} · 更新时间 {formatDateTime(freshness)}</p>
          </div>
          <div className="toolbar">
            <label className="searchBox">
              <Search size={18} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") runOnlineSearch();
                }}
                placeholder="搜索任意A股代码或名称"
              />
            </label>
            <button className="searchAction" onClick={runOnlineSearch} disabled={searching}>
              {searching ? "搜索中" : "在线搜索"}
            </button>
            <button className="iconButton" onClick={refreshCurrent} title="刷新当前页面数据" aria-label="刷新当前页面数据">
              <RefreshCw size={18} className={loading ? "spin" : ""} />
            </button>
          </div>
        </header>

        {searchResults.length > 0 && (
          <div className="searchResults">
            <div className="panelHead">
              <h2>搜索结果</h2>
              <span>添加后进入全局样本池</span>
            </div>
            <div className="searchResultList">
              {searchResults.map((item) => (
                <button key={`${item.market}-${item.code}`} onClick={() => addSearchResult(item)}>
                  <strong>{item.name}</strong>
                  <span>{item.code} · {item.market} · {item.source}</span>
                  <em>添加</em>
                </button>
              ))}
            </div>
          </div>
        )}
        {searchMessage && <div className="searchResults emptySearch">{searchMessage}</div>}

        <div className="notice">
          <ShieldAlert size={16} />
          <span>量化预测仅用于研究展示，不构成投资建议；免费数据源可能存在延迟、缺失或临时失效。</span>
        </div>

        <div className="themeRow">
          <button className={!theme ? "selected" : ""} onClick={() => setTheme("")}>
            全市场
          </button>
          {themes.map((item) => (
            <button key={item.key} className={theme === item.key ? "selected" : ""} onClick={() => setTheme(item.key)}>
              {item.label}
            </button>
          ))}
        </div>

        {error && <div className="error">{error}</div>}
        <ErrorBoundary key={`${section}-${selectedMarket}-${selectedCode}`}>
          {section === "overview" && (
            <OverviewPage
              overview={overview}
              stocks={displayStocks}
              sectors={overview?.hot_sectors ?? sectors?.items ?? []}
              onSelectStock={handleSelectStock}
              compareKeys={compareKeys}
              onToggleCompare={toggleCompare}
            />
          )}
          {section === "sectors" && (
            <SectorsPage sectors={sectors?.items ?? []} stocks={displayStocks} onSelectStock={handleSelectStock} compareKeys={compareKeys} onToggleCompare={toggleCompare} />
          )}
          {section === "stocks" && (
            <StocksPage
              stocks={displayStocks}
              detail={detail}
              watchCodes={watchlist?.codes ?? []}
              onSelectStock={handleSelectStock}
              compareKeys={compareKeys}
              onToggleCompare={toggleCompare}
              onAddWatch={async (code) => {
                await api.addWatch(code);
                setWatchlist(await api.watchlist());
              }}
              onRemoveWatch={async (code) => {
                await api.removeWatch(code);
                setWatchlist(await api.watchlist());
              }}
            />
          )}
          {section === "compare" && (
            <ComparePage
              details={compareDetails}
              candidates={displayStocks}
              compareKeys={compareKeys}
              loading={compareLoading}
              message={compareMessage}
              onToggleCompare={toggleCompare}
              onSelectStock={handleSelectStock}
            />
          )}
          {section === "rankings" && (
            <RankingsPage
              rankingType={rankingType}
              setRankingType={setRankingType}
              rankings={displayRankings}
              onSelectStock={handleSelectStock}
              compareKeys={compareKeys}
              onToggleCompare={toggleCompare}
            />
          )}
          {section === "news" && <NewsPage news={news?.items ?? []} announcements={announcements?.items ?? []} />}
          {section === "predictions" && <PredictionsPage horizon={horizon} setHorizon={setHorizon} predictions={displayPredictions} onSelectStock={handleSelectStock} />}
          {section === "watchlist" && (
            <WatchlistPage
              stocks={displayWatchlist}
              codes={[...(watchlist?.codes ?? []), ...poolStocks.map((item) => item.code)]}
              onSelectStock={handleSelectStock}
              compareKeys={compareKeys}
              onToggleCompare={toggleCompare}
            />
          )}
        </ErrorBoundary>
      </main>
    </div>
  );
}

function ChartFallback({ height }: { height: number }) {
  return <div className="chartPlaceholder" style={{ height }}><RefreshCw size={18} className="spin" /></div>;
}

function DeferredLineChart({ data, height = 260, color }: { data: HistoryPoint[]; height?: number; color?: string }) {
  return (
    <Suspense fallback={<ChartFallback height={height} />}>
      <LazyLineChart data={data} height={height} color={color} />
    </Suspense>
  );
}

function DeferredSectorBarChart({ data, height = 260 }: { data: Sector[]; height?: number }) {
  return (
    <Suspense fallback={<ChartFallback height={height} />}>
      <LazySectorBarChart data={data} height={height} />
    </Suspense>
  );
}

function DeferredComparisonLineChart({ details, days, height = 360 }: { details: StockDetail[]; days: number; height?: number }) {
  return (
    <Suspense fallback={<ChartFallback height={height} />}>
      <LazyComparisonLineChart details={details} days={days} height={height} />
    </Suspense>
  );
}

function OverviewPage({
  overview,
  stocks,
  sectors,
  onSelectStock,
  compareKeys,
  onToggleCompare
}: {
  overview: Overview | null;
  stocks: Stock[];
  sectors: Sector[];
  onSelectStock: (code: string, market?: string) => void;
  compareKeys: string[];
  onToggleCompare: (stock: Pick<Stock, "code" | "market">) => void;
}) {
  const topStocks = stocks.slice(0, 6);
  const amount = overview?.total_amount ?? stocks.reduce((sum, item) => sum + (item.amount || 0), 0);
  const breadth = overview?.breadth ?? { up: 0, down: 0, flat: 0, total: 0 };
  return (
    <section className="pageGrid">
      <div className="indexGrid">
        {(overview?.indices ?? []).map((item) => (
          <article key={item.code} className="metricCard">
            <span>{item.name}</span>
            <strong>{item.price.toFixed(2)}</strong>
            <em className={item.change_pct >= 0 ? "up" : "down"}>{formatPct(item.change_pct)}</em>
          </article>
        ))}
      </div>

      <div className="panel twoThird">
        <div className="panelHead">
          <h2>市场温度</h2>
          <span>成交额 {formatAmount(amount)}</span>
        </div>
        <div className="breadth">
          <div>
            <strong>{breadth.up}</strong>
            <span>上涨</span>
          </div>
          <div>
            <strong>{breadth.down}</strong>
            <span>下跌</span>
          </div>
          <div>
            <strong>{breadth.flat}</strong>
            <span>平盘</span>
          </div>
          <div>
            <strong>{breadth.total}</strong>
            <span>样本</span>
          </div>
        </div>
        {overview?.index_history?.length ? <DeferredLineChart data={overview.index_history} height={250} /> : <EmptyState text="等待指数历史数据" />}
      </div>

      <div className="panel oneThird">
        <div className="panelHead">
          <h2>热门板块</h2>
          <span>涨跌幅排序</span>
        </div>
        <DeferredSectorBarChart data={sectors} height={300} />
      </div>

      <div className="panel full">
        <div className="panelHead">
          <h2>强势个股</h2>
          <span>按涨跌幅</span>
        </div>
        <StockTable stocks={topStocks} compact onSelectStock={onSelectStock} compareKeys={compareKeys} onToggleCompare={onToggleCompare} />
      </div>
    </section>
  );
}

function SectorsPage({
  sectors,
  stocks,
  onSelectStock,
  compareKeys,
  onToggleCompare
}: {
  sectors: Sector[];
  stocks: Stock[];
  onSelectStock: (code: string, market?: string) => void;
  compareKeys: string[];
  onToggleCompare: (stock: Pick<Stock, "code" | "market">) => void;
}) {
  return (
    <section className="pageGrid">
      <div className="panel twoThird">
        <div className="panelHead">
          <h2>主题热度</h2>
          <span>{sectors.length} 个板块</span>
        </div>
        <DeferredSectorBarChart data={sectors} height={360} />
      </div>
      <div className="sectorCards">
        {sectors.slice(0, 8).map((item) => (
          <article key={item.name} className="sectorCard">
            <div>
              <strong>{item.name}</strong>
              <span>{themeLabels[item.theme] ?? "主题"}</span>
            </div>
            <em className={item.change_pct >= 0 ? "up" : "down"}>{formatPct(item.change_pct)}</em>
            <p>领涨：{item.leader || "无"} {formatPct(item.leader_change_pct)}</p>
            <small>上涨 {item.up_count} · 下跌 {item.down_count} · 成交 {formatAmount(item.amount)}</small>
          </article>
        ))}
      </div>
      <div className="panel full">
        <div className="panelHead">
          <h2>主题成分观察</h2>
          <span>点击行查看详情</span>
        </div>
        <StockTable stocks={stocks} onSelectStock={onSelectStock} compareKeys={compareKeys} onToggleCompare={onToggleCompare} />
      </div>
    </section>
  );
}

function StocksPage({
  stocks,
  detail,
  watchCodes,
  onSelectStock,
  compareKeys,
  onToggleCompare,
  onAddWatch,
  onRemoveWatch
}: {
  stocks: Stock[];
  detail: StockDetail | null;
  watchCodes: string[];
  onSelectStock: (code: string, market?: string) => void;
  compareKeys: string[];
  onToggleCompare: (stock: Pick<Stock, "code" | "market">) => void;
  onAddWatch: (code: string) => Promise<void>;
  onRemoveWatch: (code: string) => Promise<void>;
}) {
  return (
    <section className="stockLayout">
      <div className="panel">
        <div className="panelHead">
          <h2>个股行情</h2>
          <span>{stocks.length} 条</span>
        </div>
        <StockTable
          stocks={stocks}
          onSelectStock={onSelectStock}
          watchCodes={watchCodes}
          compareKeys={compareKeys}
          onToggleCompare={onToggleCompare}
          onAddWatch={onAddWatch}
          onRemoveWatch={onRemoveWatch}
        />
      </div>
      <aside className="detailPanel">
        {detail ? (
          <>
            <div className="quoteHead">
              <div>
                <h2>{detail.quote.name}</h2>
                <span>{[detail.quote.market, detail.quote.code, detail.quote.sector].filter(Boolean).join(" · ")}</span>
              </div>
              <strong className={num(detail.quote.change_pct) >= 0 ? "up" : "down"}>{formatPct(num(detail.quote.change_pct))}</strong>
            </div>
            <DeferredLineChart data={detail.history ?? []} height={240} color="#8a5a00" />
            <div className="quoteStats">
              <span>最新价 <b>{formatNumber(detail.quote.price, 2)}</b></span>
              <span>成交额 <b>{formatAmount(num(detail.quote.amount))}</b></span>
              <span>换手率 <b>{formatPct(num(detail.quote.turnover_rate))}</b></span>
              <span>量比 <b>{formatNumber(detail.quote.volume_ratio, 2)}</b></span>
              <span>PE <b>{formatNumber(detail.quote.pe, 1)}</b></span>
              <span>PB <b>{formatNumber(detail.quote.pb, 1)}</b></span>
            </div>
            {detail.quote.stale && <div className="staleBadge">当前展示最近可用数据，请关注更新时间</div>}
            <ProfileBlock detail={detail} />
            <PredictionMini predictions={detail.predictions ?? []} />
            <RelatedList title="相关新闻" items={(detail.news ?? []).map((item) => item.title)} />
            <RelatedList title="公告" items={(detail.announcements ?? []).map((item) => item.title)} />
          </>
        ) : (
          <EmptyState text="选择股票后显示详情" />
        )}
      </aside>
    </section>
  );
}

function ComparePage({
  details,
  candidates,
  compareKeys,
  loading,
  message,
  onToggleCompare,
  onSelectStock
}: {
  details: StockDetail[];
  candidates: Stock[];
  compareKeys: string[];
  loading: boolean;
  message: string;
  onToggleCompare: (stock: Pick<Stock, "code" | "market">) => void;
  onSelectStock: (code: string, market?: string) => void;
}) {
  const [days, setDays] = useState(60);
  const selected = new Set(compareKeys);
  const available = candidates.filter((item) => !selected.has(stockKey(item)));
  const stockByKey = new Map<string, Stock>();
  candidates.forEach((item) => stockByKey.set(stockKey(item), item));
  details.forEach((item) => stockByKey.set(stockKey(item.quote), item.quote));
  const statsByKey = new Map(details.map((item) => [stockKey(item.quote), comparisonStats(item, days)]));
  const enough = compareKeys.length >= 2;

  return (
    <section className="pageGrid comparePage">
      <div className="panel full compareSelector">
        <div className="panelHead">
          <div>
            <h2>对比标的</h2>
            <span>{compareKeys.length} / {MAX_COMPARE} 只</span>
          </div>
          <select
            aria-label="添加股票到对比"
            value=""
            disabled={!available.length || compareKeys.length >= MAX_COMPARE}
            onChange={(event) => {
              const stock = stockByKey.get(event.target.value);
              if (stock) onToggleCompare(stock);
            }}
          >
            <option value="">添加股票到对比</option>
            {available.map((item) => (
              <option key={stockKey(item)} value={stockKey(item)}>{item.name} · {item.code}</option>
            ))}
          </select>
        </div>
        <div className="compareChips">
          {compareKeys.map((key) => {
            const ref = parseStockKey(key);
            const stock = stockByKey.get(key);
            return (
              <button key={key} onClick={() => onToggleCompare(stock ?? ref)} title="移出对比" aria-label={`移出 ${stock?.name || ref.code}`}>
                <span><strong>{stock?.name || ref.code}</strong><small>{ref.market} · {ref.code}</small></span>
                <X size={15} />
              </button>
            );
          })}
        </div>
        {message && <p className="compareMessage">{message}</p>}
      </div>

      {!enough && <div className="panel full"><EmptyState text="至少选择 2 只股票后显示对比" /></div>}
      {enough && loading && !details.length && <div className="panel full"><LoadingState text="正在加载对比数据" /></div>}

      {enough && details.length > 0 && (
        <>
          <div className="compareCards full">
            {details.map((item) => {
              const stats = statsByKey.get(stockKey(item.quote));
              return (
                <article key={stockKey(item.quote)} className="compareCard">
                  <button className="nameButton" onClick={() => onSelectStock(item.quote.code, item.quote.market)}>{item.quote.name}</button>
                  <span>{item.quote.market || inferMarket(item.quote.code)} · {item.quote.code}</span>
                  <strong>{formatNumber(item.quote.price, 2)}</strong>
                  <div>
                    <em className={num(item.quote.change_pct) >= 0 ? "up" : "down"}>今日 {formatPct(num(item.quote.change_pct))}</em>
                    <em className={(stats?.periodReturn ?? 0) >= 0 ? "up" : "down"}>{days}日 {formatPct(stats?.periodReturn ?? 0)}</em>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="panel full">
            <div className="panelHead">
              <div>
                <h2>相对收益走势</h2>
                <span>各标的区间首日归零</span>
              </div>
              <div className="segmented small">
                {[20, 60, 120].map((item) => (
                  <button key={item} className={days === item ? "selected" : ""} onClick={() => setDays(item)}>{item}日</button>
                ))}
              </div>
            </div>
            <DeferredComparisonLineChart details={details} days={days} height={360} />
          </div>

          <div className="panel full">
            <div className="panelHead">
              <h2>核心指标横向比较</h2>
              <span>行情、估值、流动性与波动</span>
            </div>
            <div className="tableWrap compareTable">
              <table>
                <thead>
                  <tr>
                    <th>指标</th>
                    {details.map((item) => <th key={stockKey(item.quote)}>{item.quote.name}</th>)}
                  </tr>
                </thead>
                <tbody>
                  <CompareMetricRow label="最新价" details={details} render={(item) => formatNumber(item.quote.price, 2)} />
                  <CompareMetricRow label="今日涨跌" details={details} render={(item) => formatPct(num(item.quote.change_pct))} tone={(item) => num(item.quote.change_pct)} />
                  <CompareMetricRow label={`${days}日收益`} details={details} render={(item) => formatPct(statsByKey.get(stockKey(item.quote))?.periodReturn ?? 0)} tone={(item) => statsByKey.get(stockKey(item.quote))?.periodReturn ?? 0} />
                  <CompareMetricRow label="年化波动" details={details} render={(item) => formatPct(statsByKey.get(stockKey(item.quote))?.volatility ?? 0)} />
                  <CompareMetricRow label="区间最大回撤" details={details} render={(item) => formatPct(statsByKey.get(stockKey(item.quote))?.maxDrawdown ?? 0)} tone={(item) => statsByKey.get(stockKey(item.quote))?.maxDrawdown ?? 0} />
                  <CompareMetricRow label="成交额" details={details} render={(item) => formatAmount(num(item.quote.amount))} />
                  <CompareMetricRow label="换手率" details={details} render={(item) => formatPct(num(item.quote.turnover_rate))} />
                  <CompareMetricRow label="量比" details={details} render={(item) => formatNumber(item.quote.volume_ratio, 2)} />
                  <CompareMetricRow label="PE / PB" details={details} render={(item) => `${formatNumber(item.quote.pe, 1)} / ${formatNumber(item.quote.pb, 1)}`} />
                  <CompareMetricRow label="总市值" details={details} render={(item) => formatAmount(num(item.quote.market_cap))} />
                </tbody>
              </table>
            </div>
          </div>

          <div className="compareProfiles full">
            {details.map((item) => (
              <article key={stockKey(item.quote)}>
                <div><strong>{item.quote.name}</strong><span>{item.profile?.industry || item.quote.sector || "暂无行业"}</span></div>
                <p>{item.profile?.main_business || "暂无主营业务资料"}</p>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function CompareMetricRow({
  label,
  details,
  render,
  tone
}: {
  label: string;
  details: StockDetail[];
  render: (detail: StockDetail) => ReactNode;
  tone?: (detail: StockDetail) => number;
}) {
  return (
    <tr>
      <th>{label}</th>
      {details.map((item) => {
        const value = tone?.(item);
        return <td key={stockKey(item.quote)} className={value == null ? "" : value >= 0 ? "up" : "down"}>{render(item)}</td>;
      })}
    </tr>
  );
}

function RankingsPage({
  rankingType,
  setRankingType,
  rankings,
  onSelectStock,
  compareKeys,
  onToggleCompare
}: {
  rankingType: RankingType;
  setRankingType: (type: RankingType) => void;
  rankings: Array<Stock | Sector | Prediction>;
  onSelectStock: (code: string, market?: string) => void;
  compareKeys: string[];
  onToggleCompare: (stock: Pick<Stock, "code" | "market">) => void;
}) {
  return (
    <section className="panel">
      <div className="panelHead">
        <h2>排行</h2>
        <div className="segmented">
          {(Object.keys(rankingLabels) as RankingType[]).map((key) => (
            <button key={key} className={rankingType === key ? "selected" : ""} onClick={() => setRankingType(key)}>
              {rankingLabels[key]}
            </button>
          ))}
        </div>
      </div>
      {rankingType === "hot_sector" ? (
        <SectorTable sectors={rankings as Sector[]} />
      ) : rankingType === "model_score" ? (
        <PredictionTable predictions={rankings as Prediction[]} onSelectStock={onSelectStock} />
      ) : (
        <StockTable stocks={rankings as Stock[]} onSelectStock={onSelectStock} compareKeys={compareKeys} onToggleCompare={onToggleCompare} />
      )}
    </section>
  );
}

function NewsPage({ news, announcements }: { news: NewsItem[]; announcements: Announcement[] }) {
  return (
    <section className="newsGrid">
      <div className="panel">
        <div className="panelHead">
          <h2>财经新闻</h2>
          <span>{news.length} 条</span>
        </div>
        <div className="feedList">
          {news.map((item) => (
            <a href={item.url || "#"} target="_blank" rel="noreferrer" key={`${item.title}-${item.published_at}`} className="feedItem">
              <strong>{item.title}</strong>
              <span>{themeLabels[item.theme] ?? "市场"} · {item.source} · {item.published_at}</span>
            </a>
          ))}
        </div>
      </div>
      <div className="panel">
        <div className="panelHead">
          <h2>公司公告</h2>
          <span>{announcements.length} 条</span>
        </div>
        <div className="feedList">
          {announcements.map((item) => (
            <a href={item.url || "#"} target="_blank" rel="noreferrer" key={`${item.code}-${item.title}`} className="feedItem">
              <strong>{item.name || item.code} · {item.title}</strong>
              <span>{item.type} · {item.published_at}</span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

function PredictionsPage({ horizon, setHorizon, predictions, onSelectStock }: { horizon: number; setHorizon: (horizon: number) => void; predictions: Prediction[]; onSelectStock: (code: string) => void }) {
  const top = useMemo(() => predictions.slice(0, 4), [predictions]);
  return (
    <section className="pageGrid">
      <div className="panel full">
        <div className="panelHead">
          <h2>1-5 个交易日模型评分</h2>
          <div className="segmented small">
            {[1, 3, 5].map((item) => (
              <button key={item} className={horizon === item ? "selected" : ""} onClick={() => setHorizon(item)}>
                {item}日
              </button>
            ))}
          </div>
        </div>
        <div className="predictionCards">
          {top.map((item) => (
            <article className="predictionCard" key={`${item.code}-${item.horizon}`}>
              <div>
                <strong>{item.name}</strong>
                <span>{item.code} · 置信度 {item.confidence}</span>
              </div>
              <b>{probability(item.excess_probability)}</b>
              <p>跑赢概率 · {item.model}</p>
              <div className="factorList">
                {item.factors.slice(0, 3).map((factor) => (
                  <span key={factor.name}>{factor.name} {factor.value}{factor.unit}</span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>
      <div className="panel full">
        <PredictionTable predictions={predictions} onSelectStock={onSelectStock} />
      </div>
    </section>
  );
}

function WatchlistPage({
  stocks,
  codes,
  onSelectStock,
  compareKeys,
  onToggleCompare
}: {
  stocks: Stock[];
  codes: string[];
  onSelectStock: (code: string, market?: string) => void;
  compareKeys: string[];
  onToggleCompare: (stock: Pick<Stock, "code" | "market">) => void;
}) {
  return (
    <section className="panel">
      <div className="panelHead">
        <h2>自选股</h2>
        <span>{codes.length} 个代码</span>
      </div>
      {stocks.length ? (
        <StockTable stocks={stocks} onSelectStock={onSelectStock} compareKeys={compareKeys} onToggleCompare={onToggleCompare} />
      ) : (
        <EmptyState text="在个股行情页点击星标加入自选" />
      )}
    </section>
  );
}

function ProfileBlock({ detail }: { detail: StockDetail }) {
  const profile = detail.profile;
  return (
    <div className="profileBlock">
      <h3>公司背景</h3>
      {profile ? (
        <>
          <div className="profileGrid">
            <span>公司全称 <b>{profile.full_name || detail.quote.name}</b></span>
            <span>所属行业 <b>{profile.industry || detail.quote.sector || "暂无"}</b></span>
            <span>上市日期 <b>{profile.listing_date || "暂无"}</b></span>
            <span>地区 <b>{profile.region || "暂无"}</b></span>
          </div>
          <p>{profile.main_business || "暂无主营业务资料"}</p>
          <small>{profile.source} · {formatDateTime(profile.updated_at)}</small>
        </>
      ) : (
        <span>暂无公司背景资料</span>
      )}
    </div>
  );
}

function StockTable({
  stocks,
  compact,
  onSelectStock,
  watchCodes = [],
  compareKeys = [],
  onToggleCompare,
  onAddWatch,
  onRemoveWatch
}: {
  stocks: Stock[];
  compact?: boolean;
  onSelectStock?: (code: string, market?: string) => void;
  watchCodes?: string[];
  compareKeys?: string[];
  onToggleCompare?: (stock: Pick<Stock, "code" | "market">) => void;
  onAddWatch?: (code: string) => Promise<void>;
  onRemoveWatch?: (code: string) => Promise<void>;
}) {
  return (
    <div className="tableWrap">
      <table>
        <thead>
          <tr>
            <th>代码</th>
            <th>名称</th>
            <th>主题/行业</th>
            <th>最新价</th>
            <th>涨跌幅</th>
            <th>成交额</th>
            {!compact && <th>换手</th>}
            {!compact && <th>量比</th>}
            {!compact && <th>PE/PB</th>}
            {onToggleCompare && <th>对比</th>}
            {onAddWatch && <th>自选</th>}
          </tr>
        </thead>
        <tbody>
          {stocks.map((item) => {
            const watched = watchCodes.includes(item.code);
            const compared = compareKeys.includes(stockKey(item));
            return (
              <tr key={stockKey(item)} onClick={() => onSelectStock?.(item.code, item.market)}>
                <td>{item.code}</td>
                <td>
                  <button
                    className="nameButton"
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelectStock?.(item.code, item.market);
                    }}
                  >
                    {item.name}
                  </button>
                </td>
                <td>{themeLabels[item.theme] ?? "市场"} / {item.sector || "未分组"}</td>
                <td>{formatNumber(item.price, 2)}</td>
                <td className={num(item.change_pct) >= 0 ? "up" : "down"}>{formatPct(num(item.change_pct))}</td>
                <td>{formatAmount(num(item.amount))}</td>
                {!compact && <td>{formatPct(num(item.turnover_rate))}</td>}
                {!compact && <td>{formatNumber(item.volume_ratio, 2)}</td>}
                {!compact && <td>{formatNumber(item.pe, 1)} / {formatNumber(item.pb, 1)}</td>}
                {onToggleCompare && (
                  <td>
                    <button
                      className={`compareButton ${compared ? "selected" : ""}`}
                      title={compared ? "移出股票对比" : "加入股票对比"}
                      aria-label={compared ? "移出股票对比" : "加入股票对比"}
                      onClick={(event) => {
                        event.stopPropagation();
                        onToggleCompare(item);
                      }}
                    >
                      <GitCompareArrows size={16} />
                    </button>
                  </td>
                )}
                {onAddWatch && (
                  <td>
                    <button
                      className={`starButton ${watched ? "selected" : ""}`}
                      title={watched ? "移出自选" : "加入自选"}
                      aria-label={watched ? "移出自选" : "加入自选"}
                      onClick={(event) => {
                        event.stopPropagation();
                        watched ? onRemoveWatch?.(item.code) : onAddWatch(item.code);
                      }}
                    >
                      <Star size={16} />
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SectorTable({ sectors }: { sectors: Sector[] }) {
  return (
    <div className="tableWrap">
      <table>
        <thead>
          <tr>
            <th>板块</th>
            <th>主题</th>
            <th>涨跌幅</th>
            <th>成交额</th>
            <th>换手率</th>
            <th>涨/跌家数</th>
            <th>领涨股</th>
          </tr>
        </thead>
        <tbody>
          {sectors.map((item) => (
            <tr key={item.name}>
              <td><strong>{item.name}</strong></td>
              <td>{themeLabels[item.theme] ?? "市场"}</td>
              <td className={item.change_pct >= 0 ? "up" : "down"}>{formatPct(item.change_pct)}</td>
              <td>{formatAmount(item.amount)}</td>
              <td>{formatPct(item.turnover_rate)}</td>
              <td>{item.up_count} / {item.down_count}</td>
              <td>{item.leader} {formatPct(item.leader_change_pct)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PredictionTable({ predictions, onSelectStock }: { predictions: Prediction[]; onSelectStock?: (code: string) => void }) {
  return (
    <div className="tableWrap">
      <table>
        <thead>
          <tr>
            <th>代码</th>
            <th>名称</th>
            <th>周期</th>
            <th>上涨概率</th>
            <th>跑赢概率</th>
            <th>置信度</th>
            <th>模型</th>
            <th>AUC/准确率</th>
            <th>主要风险</th>
          </tr>
        </thead>
        <tbody>
          {predictions.map((item) => (
            <tr key={`${item.code}-${item.horizon}`} onClick={() => onSelectStock?.(item.code)}>
              <td>{item.code}</td>
              <td>
                <button
                  className="nameButton"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelectStock?.(item.code);
                  }}
                >
                  {item.name}
                </button>
              </td>
              <td>{item.horizon}日</td>
              <td>{probability(item.up_probability)}</td>
              <td>{probability(item.excess_probability)}</td>
              <td><span className={`confidence c${item.confidence}`}>{item.confidence}</span></td>
              <td>{item.model}</td>
              <td>{item.metrics.auc ?? "-"} / {item.metrics.accuracy ?? "-"}</td>
              <td>{item.risks[0]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PredictionMini({ predictions }: { predictions: Prediction[] }) {
  if (!predictions.length) return <EmptyState text="暂无预测" />;
  return (
    <div className="miniPredictions">
      {predictions.map((item) => (
        <div key={`${item.code}-${item.horizon}`}>
          <span>{item.horizon}日跑赢概率</span>
          <strong>{probability(item.excess_probability)}</strong>
          <em>置信度 {item.confidence}</em>
        </div>
      ))}
    </div>
  );
}

function RelatedList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="related">
      <h3>{title}</h3>
      {items.length ? items.map((item) => <p key={item}>{item}</p>) : <span>暂无相关内容</span>}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="empty">
      <Bell size={18} />
      <span>{text}</span>
    </div>
  );
}

function LoadingState({ text }: { text: string }) {
  return (
    <div className="empty">
      <RefreshCw size={18} className="spin" />
      <span>{text}</span>
    </div>
  );
}

function loadSamplePool(): StockDetail[] {
  try {
    const raw = window.localStorage.getItem(SAMPLE_POOL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StockDetail[];
    return Array.isArray(parsed) ? parsed.filter((item) => item?.quote?.code) : [];
  } catch {
    return [];
  }
}

function loadCompareKeys(): string[] {
  try {
    const raw = window.localStorage.getItem(COMPARE_POOL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as string[];
      if (Array.isArray(parsed)) {
        return Array.from(new Set(parsed.map((item) => stockKey(parseStockKey(item))))).slice(0, MAX_COMPARE);
      }
    }
  } catch {
    // Fall through to the useful first-run comparison.
  }
  return [stockKey({ code: "300750", market: "SZ" }), stockKey({ code: "300308", market: "SZ" })];
}

function mergeStocks(primary: Stock[], extra: Stock[]) {
  return Array.from(new Map([...extra, ...primary].map((item) => [stockKey(item), item])).values());
}

function mergePredictions(primary: Prediction[], pool: StockDetail[]) {
  const extra = pool.flatMap((item) => item.predictions ?? []);
  return Array.from(new Map([...extra, ...primary].map((item) => [`${item.code}-${item.horizon}`, item])).values()).sort(
    (a, b) => b.excess_probability - a.excess_probability
  );
}

function mergeRankingItems(items: Array<Stock | Sector | Prediction>, poolStocks: Stock[], pool: StockDetail[], rankingType: RankingType) {
  if (rankingType === "hot_sector") return items;
  if (rankingType === "model_score") return mergePredictions(items as Prediction[], pool);
  const merged = mergeStocks(items as Stock[], poolStocks);
  const key = rankingType === "turnover" ? "amount" : rankingType === "volume_ratio" ? "volume_ratio" : "change_pct";
  return merged.sort((a, b) => {
    const left = Number(a[key] ?? 0);
    const right = Number(b[key] ?? 0);
    return rankingType === "losers" ? left - right : right - left;
  });
}

function sectionTitle(section: Section) {
  return (
    {
      overview: "市场总览",
      sectors: "行业主题",
      stocks: "个股行情",
      compare: "多股可视化对比",
      rankings: "涨跌与热度排行",
      news: "财经新闻与公告",
      predictions: "量化模型预测",
      watchlist: "自选股"
    } satisfies Record<Section, string>
  )[section];
}

function num(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatNumber(value: unknown, digits = 2) {
  return num(value).toFixed(digits);
}

function inferMarket(code: string) {
  if (code.length === 5) return "HK";
  if (code.startsWith("6") || code.startsWith("9")) return "SH";
  if (code.startsWith("4") || code.startsWith("8")) return "BJ";
  return "SZ";
}

function stockKey(stock: Pick<Stock, "code" | "market">) {
  return `${(stock.market || inferMarket(stock.code)).toUpperCase()}:${stock.code}`;
}

function parseStockKey(value: string): { code: string; market: string } {
  const [market = "", code = value] = value.includes(":") ? value.split(":", 2) : ["", value];
  return { code, market: (market || inferMarket(code)).toUpperCase() };
}

function comparisonStats(detail: StockDetail, days: number) {
  const closes = (detail.history ?? [])
    .filter((item) => Number(item.close) > 0)
    .slice(-days)
    .map((item) => Number(item.close));
  if (closes.length < 2) return { periodReturn: 0, volatility: 0, maxDrawdown: 0 };
  const periodReturn = ((closes[closes.length - 1] / closes[0]) - 1) * 100;
  const returns = closes.slice(1).map((value, index) => (value / closes[index]) - 1);
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / returns.length;
  const volatility = Math.sqrt(variance) * Math.sqrt(252) * 100;
  let peak = closes[0];
  let maxDrawdown = 0;
  closes.forEach((value) => {
    peak = Math.max(peak, value);
    maxDrawdown = Math.min(maxDrawdown, (value / peak) - 1);
  });
  return { periodReturn, volatility, maxDrawdown: maxDrawdown * 100 };
}

class ErrorBoundary extends Component<{ children: ReactNode }, { message: string | null }> {
  state = { message: null };

  static getDerivedStateFromError(error: Error) {
    return { message: error.message || "页面渲染失败" };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Page render failed", error, info.componentStack);
  }

  render() {
    if (this.state.message) {
      return <div className="errorBoundary">页面局部渲染失败：{this.state.message}</div>;
    }
    return this.props.children;
  }
}
