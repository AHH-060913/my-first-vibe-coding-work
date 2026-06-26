import { Component, useCallback, useEffect, useMemo, useState, type ErrorInfo, type ReactNode } from "react";
import {
  Activity,
  BarChart3,
  Bell,
  Database,
  Layers,
  LineChart as LineChartIcon,
  Newspaper,
  RefreshCw,
  Search,
  ShieldAlert,
  Star,
  TrendingUp
} from "lucide-react";
import { api } from "./api";
import { LineChart, SectorBarChart } from "./components/Charts";
import { formatAmount, formatDateTime, formatPct, probability } from "./format";
import type { Announcement, ListResponse, NewsItem, Overview, Prediction, Sector, Stock, StockDetail, StockSearchResult, ThemeKey } from "./types";

type Section = "overview" | "sectors" | "stocks" | "rankings" | "news" | "predictions" | "watchlist";
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
  const [detail, setDetail] = useState<StockDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const themes = overview?.themes ?? [
    { key: "tech" as ThemeKey, label: "科技", keywords: [], boards: [] },
    { key: "new_energy" as ThemeKey, label: "新能源", keywords: [], boards: [] },
    { key: "display" as ThemeKey, label: "显示", keywords: [], boards: [] },
    { key: "pv" as ThemeKey, label: "光伏", keywords: [], boards: [] }
  ];

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const stockParams = new URLSearchParams({ page_size: "40", sort: "change_pct", order: "desc" });
      if (theme) stockParams.set("theme", theme);

      const newsParams = new URLSearchParams();
      if (theme) newsParams.set("theme", theme);
      if (query && section === "news") newsParams.set("q", query);

      const announcementParams = new URLSearchParams();
      if (query && section === "news") announcementParams.set("q", query);

      const predictionParams = new URLSearchParams({ horizon: String(horizon) });
      if (theme) predictionParams.set("theme", theme);

      const [overviewData, stocksData, sectorData, rankingData, newsData, announcementData, predictionData, watchData] =
        await Promise.all([
          api.overview(),
          api.stocks(stockParams),
          api.sectors(theme || undefined),
          api.rankings(rankingType),
          api.news(newsParams),
          api.announcements(announcementParams),
          api.predictions(predictionParams),
          api.watchlist()
        ]);
      setOverview(overviewData);
      setStocks(stocksData);
      setSectors(sectorData);
      setRankings(rankingData);
      setNews(newsData);
      setAnnouncements(announcementData);
      setPredictions(predictionData);
      setWatchlist(watchData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "数据加载失败");
    } finally {
      setLoading(false);
    }
  }, [horizon, query, rankingType, section, theme]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    let active = true;
    const localDetail = samplePool.find((item) => item.quote.code === selectedCode);
    if (localDetail) {
      setDetail(localDetail);
    }
    api
      .stockDetail(selectedCode)
      .then((payload) => {
        if (active) setDetail(payload);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "个股详情加载失败");
      });
    return () => {
      active = false;
    };
  }, [samplePool, selectedCode]);

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
        const resolved = await api.resolveStock(result.code, result.market);
        persistSamplePool([resolved, ...samplePool]);
        setSelectedCode(resolved.quote.code);
        setSection("stocks");
      } catch (err) {
        setError(err instanceof Error ? err.message : "添加股票失败");
      } finally {
        setSearching(false);
      }
    },
    [persistSamplePool, samplePool]
  );

  const handleSelectStock = useCallback((code: string) => {
    setSelectedCode(code);
    setSection("stocks");
  }, []);

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
            <button className="iconButton" onClick={loadAll} title="刷新数据" aria-label="刷新数据">
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
        <ErrorBoundary key={`${section}-${selectedCode}`}>
          {section === "overview" && <OverviewPage overview={overview} stocks={displayStocks} sectors={overview?.hot_sectors ?? sectors?.items ?? []} onSelectStock={handleSelectStock} />}
          {section === "sectors" && <SectorsPage sectors={sectors?.items ?? []} stocks={displayStocks} onSelectStock={handleSelectStock} />}
          {section === "stocks" && (
            <StocksPage
              stocks={displayStocks}
              detail={detail}
              watchCodes={watchlist?.codes ?? []}
              onSelectStock={handleSelectStock}
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
          {section === "rankings" && <RankingsPage rankingType={rankingType} setRankingType={setRankingType} rankings={displayRankings} onSelectStock={handleSelectStock} />}
          {section === "news" && <NewsPage news={news?.items ?? []} announcements={announcements?.items ?? []} />}
          {section === "predictions" && <PredictionsPage horizon={horizon} setHorizon={setHorizon} predictions={displayPredictions} onSelectStock={handleSelectStock} />}
          {section === "watchlist" && <WatchlistPage stocks={displayWatchlist} codes={[...(watchlist?.codes ?? []), ...poolStocks.map((item) => item.code)]} onSelectStock={handleSelectStock} />}
        </ErrorBoundary>
      </main>
    </div>
  );
}

function OverviewPage({ overview, stocks, sectors, onSelectStock }: { overview: Overview | null; stocks: Stock[]; sectors: Sector[]; onSelectStock: (code: string) => void }) {
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
        {overview?.index_history?.length ? <LineChart data={overview.index_history} height={250} /> : <EmptyState text="等待指数历史数据" />}
      </div>

      <div className="panel oneThird">
        <div className="panelHead">
          <h2>热门板块</h2>
          <span>涨跌幅排序</span>
        </div>
        <SectorBarChart data={sectors} height={300} />
      </div>

      <div className="panel full">
        <div className="panelHead">
          <h2>强势个股</h2>
          <span>按涨跌幅</span>
        </div>
        <StockTable stocks={topStocks} compact onSelectStock={onSelectStock} />
      </div>
    </section>
  );
}

function SectorsPage({ sectors, stocks, onSelectStock }: { sectors: Sector[]; stocks: Stock[]; onSelectStock: (code: string) => void }) {
  return (
    <section className="pageGrid">
      <div className="panel twoThird">
        <div className="panelHead">
          <h2>主题热度</h2>
          <span>{sectors.length} 个板块</span>
        </div>
        <SectorBarChart data={sectors} height={360} />
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
        <StockTable stocks={stocks} onSelectStock={onSelectStock} />
      </div>
    </section>
  );
}

function StocksPage({
  stocks,
  detail,
  watchCodes,
  onSelectStock,
  onAddWatch,
  onRemoveWatch
}: {
  stocks: Stock[];
  detail: StockDetail | null;
  watchCodes: string[];
  onSelectStock: (code: string) => void;
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
        <StockTable stocks={stocks} onSelectStock={onSelectStock} watchCodes={watchCodes} onAddWatch={onAddWatch} onRemoveWatch={onRemoveWatch} />
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
            <LineChart data={detail.history ?? []} height={240} color="#8a5a00" />
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

function RankingsPage({
  rankingType,
  setRankingType,
  rankings,
  onSelectStock
}: {
  rankingType: RankingType;
  setRankingType: (type: RankingType) => void;
  rankings: Array<Stock | Sector | Prediction>;
  onSelectStock: (code: string) => void;
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
      {rankingType === "hot_sector" ? <SectorTable sectors={rankings as Sector[]} /> : rankingType === "model_score" ? <PredictionTable predictions={rankings as Prediction[]} onSelectStock={onSelectStock} /> : <StockTable stocks={rankings as Stock[]} onSelectStock={onSelectStock} />}
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

function WatchlistPage({ stocks, codes, onSelectStock }: { stocks: Stock[]; codes: string[]; onSelectStock: (code: string) => void }) {
  return (
    <section className="panel">
      <div className="panelHead">
        <h2>自选股</h2>
        <span>{codes.length} 个代码</span>
      </div>
      {stocks.length ? <StockTable stocks={stocks} onSelectStock={onSelectStock} /> : <EmptyState text="在个股行情页点击星标加入自选" />}
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
  onAddWatch,
  onRemoveWatch
}: {
  stocks: Stock[];
  compact?: boolean;
  onSelectStock?: (code: string) => void;
  watchCodes?: string[];
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
            {onAddWatch && <th>自选</th>}
          </tr>
        </thead>
        <tbody>
          {stocks.map((item) => {
            const watched = watchCodes.includes(item.code);
            return (
              <tr key={stockKey(item)} onClick={() => onSelectStock?.(item.code)}>
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
                <td>{themeLabels[item.theme] ?? "市场"} / {item.sector || "未分组"}</td>
                <td>{formatNumber(item.price, 2)}</td>
                <td className={num(item.change_pct) >= 0 ? "up" : "down"}>{formatPct(num(item.change_pct))}</td>
                <td>{formatAmount(num(item.amount))}</td>
                {!compact && <td>{formatPct(num(item.turnover_rate))}</td>}
                {!compact && <td>{formatNumber(item.volume_ratio, 2)}</td>}
                {!compact && <td>{formatNumber(item.pe, 1)} / {formatNumber(item.pb, 1)}</td>}
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

function stockKey(stock: Pick<Stock, "code" | "market">) {
  return `${stock.market || ""}:${stock.code}`;
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
