import { useState } from "react";
import { CalendarRange, ExternalLink, Filter, Newspaper, Search } from "lucide-react";
import { EmptyState, PanelHead } from "../components/Common";
import type { Announcement, NewsItem, Stock } from "../types";

export interface ContentFilters {
  q: string;
  type: string;
  dateFrom: string;
  dateTo: string;
}

export default function NewsPage({ news, announcements, loading, onApply, onSelectStock }: {
  news: NewsItem[];
  announcements: Announcement[];
  loading: boolean;
  onApply: (filters: ContentFilters) => void;
  onSelectStock: (stock: Stock) => void;
}) {
  const [filters, setFilters] = useState<ContentFilters>({ q: "", type: "", dateFrom: "", dateTo: "" });
  const update = (key: keyof ContentFilters, value: string) => setFilters((current) => ({ ...current, [key]: value }));
  return <section className="newsV2">
    <div className="contentFilterBar">
      <label className="wide"><Search size={16} /><input value={filters.q} onChange={(event) => update("q", event.target.value)} onKeyDown={(event) => event.key === "Enter" && onApply(filters)} placeholder="搜索新闻标题、股票名称或代码" /></label>
      <label><Filter size={15} /><select value={filters.type} onChange={(event) => update("type", event.target.value)} aria-label="公告类型"><option value="">全部公告类型</option><option value="经营公告">经营公告</option><option value="重大合同">重大合同</option><option value="回购">回购</option><option value="调研">调研纪要</option></select></label>
      <label><CalendarRange size={15} /><input type="date" value={filters.dateFrom} onChange={(event) => update("dateFrom", event.target.value)} aria-label="开始日期" /></label>
      <label><CalendarRange size={15} /><input type="date" value={filters.dateTo} onChange={(event) => update("dateTo", event.target.value)} aria-label="结束日期" /></label>
      <button className="primaryButton" onClick={() => onApply(filters)}>{loading ? "筛选中" : "应用筛选"}</button>
    </div>
    <div className="newsColumns">
      <article className="panel"><PanelHead title="财经新闻" meta={`${news.length} 条`} actions={<Newspaper size={16} />} />
        {news.length ? <div className="editorialFeed">{news.map((item, index) => <a key={`${item.title}-${index}`} href={item.url || undefined} target={item.url ? "_blank" : undefined} rel="noreferrer"><time>{item.published_at}</time><strong>{item.title}</strong><span>{item.source} · {themeName(item.theme)}</span>{item.url && <ExternalLink size={14} />}</a>)}</div> : <EmptyState text="没有符合筛选条件的新闻" />}
      </article>
      <article className="panel"><PanelHead title="公司公告" meta={`${announcements.length} 条`} />
        {announcements.length ? <div className="announcementFeed">{announcements.map((item, index) => <div key={`${item.code}-${item.title}-${index}`}><time>{item.published_at}</time><button onClick={() => onSelectStock({ code: item.code, name: item.name, market: item.code.startsWith("6") ? "SH" : "SZ", price: 0, change_pct: 0, amount: 0, turnover_rate: 0, volume_ratio: 0, pe: 0, pb: 0, market_cap: 0, sector: "", theme: "" })}>{item.name || item.code}</button><a href={item.url || undefined} target={item.url ? "_blank" : undefined} rel="noreferrer"><strong>{item.title}</strong><span>{item.type}</span>{item.url && <ExternalLink size={14} />}</a></div>)}</div> : <EmptyState text="没有符合筛选条件的公告" />}
      </article>
    </div>
  </section>;
}

function themeName(theme: string) {
  return ({ tech: "科技", new_energy: "新能源", display: "显示", pv: "光伏", market: "全市场" } as Record<string, string>)[theme] || "市场";
}
