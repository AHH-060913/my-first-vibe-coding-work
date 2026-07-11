import type { Announcement, CompareSymbol, IndexHistoryResponse, ListResponse, NewsItem, Overview, Prediction, Sector, Stock, StockDetail, StockProfile, StockSearchResult, ThemeMeta } from "./types";
import { buildEvents, calculateAnalytics, calculateComparison, calculateDistribution, calculateTemperature } from "./lib/marketMath";

const updated_at = "2026-06-25T03:44:51.000Z";
const source = "static-demo:seed";

const themes: ThemeMeta[] = [
  { key: "tech", label: "科技", keywords: ["半导体", "芯片", "软件", "人工智能"], boards: ["半导体", "软件开发", "通信设备", "人工智能"] },
  { key: "new_energy", label: "新能源", keywords: ["新能源", "电池", "锂电", "储能"], boards: ["电池", "新能源车", "储能"] },
  { key: "display", label: "显示", keywords: ["面板", "OLED", "MiniLED"], boards: ["面板", "OLED", "光学光电子"] },
  { key: "pv", label: "光伏", keywords: ["光伏", "硅片", "组件", "逆变器"], boards: ["光伏设备", "逆变器", "TOPCon电池"] }
];

const stocks: Stock[] = [
  { code: "688981", name: "中芯国际", theme: "tech", sector: "半导体", price: 58.42, change_pct: 2.86, turnover_rate: 2.13, volume_ratio: 1.28, amount: 3200000000, pe: 82.6, pb: 3.2, market_cap: 466000000000 },
  { code: "002371", name: "北方华创", theme: "tech", sector: "半导体", price: 338.75, change_pct: 1.74, turnover_rate: 1.83, volume_ratio: 1.16, amount: 2100000000, pe: 44.8, pb: 7.8, market_cap: 181000000000 },
  { code: "300308", name: "中际旭创", theme: "tech", sector: "通信设备", price: 173.28, change_pct: 4.12, turnover_rate: 4.96, volume_ratio: 1.88, amount: 5200000000, pe: 51.3, pb: 9.4, market_cap: 194000000000 },
  { code: "688041", name: "海光信息", theme: "tech", sector: "芯片", price: 92.54, change_pct: -0.63, turnover_rate: 2.31, volume_ratio: 0.92, amount: 1400000000, pe: 116.1, pb: 10.7, market_cap: 215000000000 },
  { code: "300750", name: "宁德时代", theme: "new_energy", sector: "电池", price: 214.88, change_pct: 1.08, turnover_rate: 0.83, volume_ratio: 1.05, amount: 4100000000, pe: 20.4, pb: 4.1, market_cap: 945000000000 },
  { code: "002594", name: "比亚迪", theme: "new_energy", sector: "新能源汽车", price: 298.45, change_pct: -1.21, turnover_rate: 1.36, volume_ratio: 0.86, amount: 3600000000, pe: 24.9, pb: 5.3, market_cap: 869000000000 },
  { code: "300014", name: "亿纬锂能", theme: "new_energy", sector: "电池", price: 42.63, change_pct: 3.54, turnover_rate: 3.42, volume_ratio: 1.42, amount: 980000000, pe: 22.2, pb: 2.8, market_cap: 87200000000 },
  { code: "000725", name: "京东方A", theme: "display", sector: "面板", price: 4.18, change_pct: 2.2, turnover_rate: 1.84, volume_ratio: 1.35, amount: 1760000000, pe: 34.2, pb: 1.3, market_cap: 157000000000 },
  { code: "000100", name: "TCL科技", theme: "display", sector: "面板", price: 4.87, change_pct: 1.67, turnover_rate: 2.04, volume_ratio: 1.21, amount: 1180000000, pe: 29.6, pb: 1.7, market_cap: 91400000000 },
  { code: "002456", name: "欧菲光", theme: "display", sector: "光学光电子", price: 11.92, change_pct: -2.14, turnover_rate: 6.92, volume_ratio: 1.73, amount: 2320000000, pe: 61.5, pb: 5.4, market_cap: 38800000000 },
  { code: "601012", name: "隆基绿能", theme: "pv", sector: "光伏设备", price: 18.26, change_pct: -0.44, turnover_rate: 1.19, volume_ratio: 0.79, amount: 1650000000, pe: 27.8, pb: 1.9, market_cap: 138000000000 },
  { code: "300274", name: "阳光电源", theme: "pv", sector: "逆变器", price: 83.92, change_pct: 3.91, turnover_rate: 2.86, volume_ratio: 1.52, amount: 3050000000, pe: 21.6, pb: 5.2, market_cap: 173000000000 },
  { code: "688599", name: "天合光能", theme: "pv", sector: "光伏组件", price: 19.38, change_pct: 1.26, turnover_rate: 1.72, volume_ratio: 1.12, amount: 680000000, pe: 19.8, pb: 1.5, market_cap: 42100000000 },
  { code: "601899", name: "紫金矿业", theme: "market", sector: "有色金属", price: 18.61, change_pct: 2.49, turnover_rate: 1.11, volume_ratio: 1.25, amount: 4030000000, pe: 17.9, pb: 4.2, market_cap: 492000000000 }
];

const xiaomiStock: Stock = {
  code: "01810",
  market: "HK",
  name: "小米集团-W",
  theme: "tech",
  sector: "港股科技",
  price: 21.58,
  change_pct: -3.23,
  turnover_rate: 0,
  volume_ratio: 0,
  amount: 2068885591,
  pe: 12.07,
  pb: 0,
  market_cap: 460544310000,
  stale: true,
  source: "static-demo:hk"
};

const sectors: Sector[] = [
  { name: "半导体", theme: "tech", change_pct: 2.74, amount: 84200000000, turnover_rate: 3.18, up_count: 86, down_count: 24, leader: "中际旭创", leader_change_pct: 4.12 },
  { name: "人工智能", theme: "tech", change_pct: 2.18, amount: 77600000000, turnover_rate: 3.42, up_count: 74, down_count: 29, leader: "海光信息", leader_change_pct: 3.26 },
  { name: "电池", theme: "new_energy", change_pct: 1.81, amount: 69800000000, turnover_rate: 2.64, up_count: 58, down_count: 33, leader: "亿纬锂能", leader_change_pct: 3.54 },
  { name: "面板", theme: "display", change_pct: 1.68, amount: 31600000000, turnover_rate: 1.95, up_count: 31, down_count: 11, leader: "京东方A", leader_change_pct: 2.2 },
  { name: "OLED", theme: "display", change_pct: 1.12, amount: 27200000000, turnover_rate: 2.23, up_count: 43, down_count: 19, leader: "TCL科技", leader_change_pct: 1.67 },
  { name: "逆变器", theme: "pv", change_pct: 1.93, amount: 30800000000, turnover_rate: 2.58, up_count: 22, down_count: 8, leader: "阳光电源", leader_change_pct: 3.91 },
  { name: "光伏设备", theme: "pv", change_pct: 0.87, amount: 54800000000, turnover_rate: 2.06, up_count: 39, down_count: 28, leader: "阳光电源", leader_change_pct: 3.91 }
];

const news: NewsItem[] = [
  { title: "多家半导体设备公司披露订单景气度改善", source: "财联社样例", published_at: "2026-06-25 10:18", theme: "tech", url: "https://example.com/news/tech-order" },
  { title: "储能招标规模维持高位，电池材料价格企稳", source: "财经样例", published_at: "2026-06-25 09:42", theme: "new_energy", url: "https://example.com/news/storage" },
  { title: "面板厂商二季度稼动率提升，大尺寸价格小幅上行", source: "行业样例", published_at: "2026-06-24 18:05", theme: "display", url: "https://example.com/news/display" },
  { title: "光伏组件排产环比回升，逆变器出口延续增长", source: "财经样例", published_at: "2026-06-24 16:20", theme: "pv", url: "https://example.com/news/pv" },
  { title: "沪深两市成交额突破万亿元，科技成长方向活跃", source: "市场样例", published_at: "2026-06-25 11:05", theme: "market", url: "https://example.com/news/market" }
];

const announcements: Announcement[] = [
  { code: "688981", name: "中芯国际", title: "关于资本开支计划进展的公告", type: "经营公告", published_at: "2026-06-24", url: "https://example.com/notice/688981" },
  { code: "300750", name: "宁德时代", title: "关于海外储能项目合作进展的公告", type: "重大合同", published_at: "2026-06-24", url: "https://example.com/notice/300750" },
  { code: "000725", name: "京东方A", title: "关于回购股份实施进展的公告", type: "回购", published_at: "2026-06-23", url: "https://example.com/notice/000725" },
  { code: "300274", name: "阳光电源", title: "投资者关系活动记录表", type: "调研纪要", published_at: "2026-06-23", url: "https://example.com/notice/300274" }
];

const indices = [
  { code: "000001", name: "上证指数", price: 3318.42, change_pct: 0.62, amount: 432000000000 },
  { code: "399001", name: "深证成指", price: 10572.18, change_pct: 0.93, amount: 586000000000 },
  { code: "399006", name: "创业板指", price: 2146.77, change_pct: 1.24, amount: 238000000000 },
  { code: "000688", name: "科创50", price: 1018.34, change_pct: 1.71, amount: 78400000000 },
  { code: "000300", name: "沪深300", price: 3972.66, change_pct: 0.58, amount: 278000000000 },
  { code: "000905", name: "中证500", price: 5851.22, change_pct: 0.76, amount: 149000000000 },
  { code: "000852", name: "中证1000", price: 6248.91, change_pct: 1.05, amount: 168000000000 }
];

function history(code = "300750") {
  const stock = code === "01810" ? xiaomiStock : stocks.find((item) => item.code === code) ?? stocks[0];
  const indexQuote = indices.find((item) => item.code === code);
  const targetPrice = indexQuote?.price ?? stock.price;
  const targetAmount = indexQuote?.amount ?? stock.amount;
  return Array.from({ length: 140 }, (_, index) => {
    const date = new Date(Date.UTC(2026, 0, 2 + index));
    const close = targetPrice * (0.76 + index / 610 + Math.sin(index / 5) * 0.025 + Math.sin(index / 17) * 0.012);
    const open = close * (1 - Math.sin(index / 4) * 0.009);
    const high = Math.max(open, close) * (1.008 + Math.abs(Math.sin(index / 9)) * 0.008);
    const low = Math.min(open, close) * (0.992 - Math.abs(Math.cos(index / 11)) * 0.006);
    const amount = targetAmount * (0.65 + Math.abs(Math.sin(index / 7)) * 0.5);
    return {
      date: date.toISOString().slice(0, 10),
      open: Number(open.toFixed(2)),
      close: Number(close.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      volume: Math.round(amount / close),
      amount: Number(amount.toFixed(2)),
      change_pct: Number(((close / open - 1) * 100).toFixed(2)),
      turnover_rate: stock.turnover_rate
    };
  });
}

function predict(stock: Stock, horizon = 3): Prediction {
  const score = Math.max(0.05, Math.min(0.95, 0.48 + stock.change_pct / 18 + Math.min(stock.volume_ratio, 2) / 12 + Math.min(stock.turnover_rate, 6) / 45));
  return {
    code: stock.code,
    name: stock.name,
    horizon,
    up_probability: Number(Math.min(0.95, score + 0.015).toFixed(4)),
    excess_probability: Number(score.toFixed(4)),
    confidence: "低",
    model: "static_factor_demo",
    factors: [
      { name: "涨跌幅动量", value: stock.change_pct, unit: "%", direction: stock.change_pct >= 0 ? "positive" : "negative" },
      { name: "成交额流动性", value: Number((stock.amount / 100000000).toFixed(1)), unit: "亿元", direction: "positive" },
      { name: "换手率", value: stock.turnover_rate, unit: "%", direction: "neutral" }
    ],
    risks: ["静态演示数据仅用于展示产品形态，不能作为投资依据。"],
    metrics: { accuracy: 0.56, auc: 0.6, sample_size: 0, validation_size: 0, anti_leakage: "static demo only" }
  };
}

function profile(stock: Stock): StockProfile {
  if (stock.market === "HK" && stock.code === "01810") {
    return {
      code: stock.code,
      name: stock.name,
      full_name: "小米集团",
      listing_date: "2018-07-09",
      region: "香港",
      industry: "消费电子 / 互联网服务",
      main_business: "小米集团主要从事智能手机、IoT 与生活消费产品、互联网服务及智能电动汽车等业务，收入结构与消费电子、智能硬件和生态服务高度相关。",
      business_scope: "智能手机、IoT 与生活消费产品、互联网服务、智能电动汽车及相关生态业务。",
      website: "https://www.mi.com",
      total_shares: 0,
      float_shares: 0,
      source: "static-demo:profile",
      updated_at,
      stale: true
    };
  }
  return {
    code: stock.code,
    name: stock.name,
    full_name: `${stock.name}股份有限公司`,
    listing_date: "",
    region: "",
    industry: stock.sector,
    main_business: `公司主营业务与${stock.sector || "所属行业"}相关，公开静态演示使用样例资料。`,
    business_scope: "静态演示模式不连接实时资料源；本地/公网后端模式会优先尝试公开资料接口。",
    website: "",
    total_shares: 0,
    float_shares: 0,
    source: "static-demo:profile",
    updated_at,
    stale: true
  };
}

function filterStocks(params: URLSearchParams) {
  const q = params.get("q")?.trim().toLowerCase();
  const theme = params.get("theme");
  const sector = params.get("sector");
  const sort = params.get("sort") || "change_pct";
  const order = params.get("order") || "desc";
  const rows = stocks
    .filter((item) => !theme || item.theme === theme)
    .filter((item) => !sector || item.sector === sector)
    .filter((item) => !q || item.code.includes(q) || item.name.toLowerCase().includes(q))
    .sort((a, b) => Number(a[sort as keyof Stock] || 0) - Number(b[sort as keyof Stock] || 0));
  if (order !== "asc") rows.reverse();
  return rows;
}

function detailForCode(code: string, market?: string, historyDays = 120): StockDetail {
  const found = stocks.find((item) => item.code === code);
  const quote = market === "HK" || code === "01810"
    ? xiaomiStock
    : found ?? { ...stocks[0], code, name: `股票 ${code}`, market: market || (code.startsWith("6") ? "SH" : "SZ"), stale: true, source };
  const fullHistory = history(quote.code);
  const relatedNews = news.filter((item) => item.theme === quote.theme || item.theme === "market");
  const relatedAnnouncements = announcements.filter((item) => item.code === quote.code);
  return {
    quote,
    history: fullHistory.slice(-historyDays),
    profile: profile(quote),
    news: relatedNews,
    announcements: relatedAnnouncements,
    events: buildEvents(relatedNews, relatedAnnouncements),
    analytics: calculateAnalytics(fullHistory),
    predictions: [1, 3, 5].map((horizon) => predict(quote, horizon)),
    source,
    updated_at
  };
}

export const staticApi = {
  async overview(): Promise<Overview> {
    return {
      updated_at,
      source,
      indices,
      index_history: history("000001"),
      breadth: { up: stocks.filter((item) => item.change_pct > 0).length, down: stocks.filter((item) => item.change_pct < 0).length, flat: 0, total: stocks.length },
      total_amount: stocks.reduce((sum, item) => sum + item.amount, 0),
      hot_sectors: sectors,
      market_temperature: calculateTemperature(stocks, sectors),
      change_distribution: calculateDistribution(stocks),
      themes
    };
  },
  async stocks(params: URLSearchParams): Promise<ListResponse<Stock>> {
    const items = filterStocks(params);
    return { items, total: items.length, page: 1, page_size: items.length, source, updated_at };
  },
  async searchStocks(q: string): Promise<ListResponse<StockSearchResult>> {
    const query = q.trim().toLowerCase();
    const items: StockSearchResult[] = stocks
      .filter((item) => item.code.includes(query) || item.name.toLowerCase().includes(query) || item.sector.toLowerCase().includes(query))
      .map((item) => ({ code: item.code, name: item.name, market: item.code.startsWith("6") ? "SH" : "SZ", source: "static-demo:search" }));
    if (["小米", "小米集团", "xiaomi", "01810"].some((keyword) => query.includes(keyword))) {
      items.unshift({ code: "01810", name: "小米集团-W", market: "HK", source: "static-demo:search" });
    }
    return { items, source, updated_at };
  },
  async stockDetail(code: string, market?: string, historyDays = 120): Promise<StockDetail> {
    return detailForCode(code, market, historyDays);
  },
  async resolveStock(code: string, market?: string, historyDays = 120): Promise<StockDetail> {
    return detailForCode(code, market, historyDays);
  },
  async indexHistory(code: string, days = 60): Promise<IndexHistoryResponse> {
    return { code, items: history(code).slice(-days), source, updated_at, stale: true };
  },
  async compare(symbols: CompareSymbol[], window = 60, benchmark = "000300") {
    const details = symbols.map((item) => detailForCode(item.code, item.market, window));
    return calculateComparison(details, window, benchmark);
  },
  async sectors(theme?: string): Promise<ListResponse<Sector>> {
    const items = sectors.filter((item) => !theme || item.theme === theme);
    return { items, source, updated_at };
  },
  async rankings(type: string): Promise<ListResponse<Stock | Sector | Prediction>> {
    if (type === "hot_sector") return { items: [...sectors].sort((a, b) => b.change_pct - a.change_pct), source, updated_at };
    if (type === "model_score") return { items: stocks.map((item) => predict(item)).sort((a, b) => b.excess_probability - a.excess_probability), source, updated_at };
    const key = type === "turnover" ? "amount" : type === "volume_ratio" ? "volume_ratio" : "change_pct";
    const items = [...stocks].sort((a, b) => Number(a[key]) - Number(b[key]));
    if (type !== "losers") items.reverse();
    return { items, source, updated_at };
  },
  async news(params: URLSearchParams): Promise<ListResponse<NewsItem>> {
    const theme = params.get("theme");
    const q = params.get("q")?.trim();
    const dateFrom = params.get("date_from");
    const dateTo = params.get("date_to");
    const items = news.filter((item) =>
      (!theme || item.theme === theme || item.theme === "market")
      && (!q || item.title.includes(q))
      && (!dateFrom || item.published_at.slice(0, 10) >= dateFrom)
      && (!dateTo || item.published_at.slice(0, 10) <= dateTo)
    );
    return { items, source, updated_at };
  },
  async announcements(params: URLSearchParams): Promise<ListResponse<Announcement>> {
    const q = params.get("q")?.trim();
    const type = params.get("type");
    const dateFrom = params.get("date_from");
    const dateTo = params.get("date_to");
    const items = announcements.filter((item) =>
      (!q || item.title.includes(q) || item.name.includes(q) || item.code.includes(q))
      && (!type || item.type.includes(type))
      && (!dateFrom || item.published_at.slice(0, 10) >= dateFrom)
      && (!dateTo || item.published_at.slice(0, 10) <= dateTo)
    );
    return { items, source, updated_at };
  },
  async predictions(params: URLSearchParams): Promise<ListResponse<Prediction>> {
    const theme = params.get("theme");
    const requestedHorizons = params.get("horizons")?.split(",").map(Number).filter((item) => [1, 3, 5].includes(item));
    const horizons = requestedHorizons?.length ? requestedHorizons : [Number(params.get("horizon") || 3)];
    const code = params.get("code");
    const candidates = stocks.filter((item) => (!theme || item.theme === theme) && (!code || item.code === code));
    const items = horizons.flatMap((horizon) => candidates.map((item) => predict(item, horizon))).sort((a, b) => a.horizon - b.horizon || b.excess_probability - a.excess_probability);
    return { items, source, updated_at };
  },
  async watchlist(): Promise<ListResponse<Stock> & { codes: string[] }> {
    const codes = ["300750", "300308", "300274"];
    return { codes, items: stocks.filter((item) => codes.includes(item.code)), source, updated_at };
  },
  async addWatch(code: string) {
    return { ok: true, code };
  },
  async removeWatch(code: string) {
    return { ok: true, code };
  }
};
