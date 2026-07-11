import { Suspense, type CSSProperties } from "react";
import { Activity, ArrowUpRight, Gauge, RefreshCw } from "lucide-react";
import { AnimatedNumber, DataBadge, EmptyState, PanelHead, Segmented, SkeletonGrid, StockTable } from "../components/Common";
import { DistributionChart, IndexTrendChart, SectorTreemap } from "../components/OverviewCharts";
import { formatAmount, formatPct } from "../format";
import type { HistoryPoint, Overview, Sector, Stock } from "../types";

export default function OverviewPage({
  overview,
  stocks,
  sectors,
  indexHistory,
  selectedIndex,
  range,
  loading,
  comparedKeys,
  watchedKeys,
  onSelectIndex,
  onRangeChange,
  onSelectStock,
  onToggleCompare,
  onToggleWatch,
  onSelectSector
}: {
  overview: Overview | null;
  stocks: Stock[];
  sectors: Sector[];
  indexHistory: HistoryPoint[];
  selectedIndex: string;
  range: number;
  loading: boolean;
  comparedKeys: string[];
  watchedKeys: string[];
  onSelectIndex: (code: string) => void;
  onRangeChange: (days: number) => void;
  onSelectStock: (stock: Stock) => void;
  onToggleCompare: (stock: Stock) => void;
  onToggleWatch: (stock: Stock) => void;
  onSelectSector: (sector: string) => void;
}) {
  if (!overview && !stocks.length) return <SkeletonGrid cards={8} />;
  const breadth = overview?.breadth ?? { up: 0, down: 0, flat: 0, total: 0 };
  const temperature = overview?.market_temperature ?? { score: 50, label: "中性", components: { breadth: 50, momentum: 50, sector_strength: 50, activity: 50 } };
  const distribution = overview?.change_distribution ?? [];
  const activeIndex = overview?.indices.find((item) => item.code === selectedIndex) ?? overview?.indices[0];
  return (
    <section className="pageGrid overviewV2">
      <div className="marketRibbon full">
        {(overview?.indices ?? []).map((item) => (
          <button key={item.code} className={item.code === activeIndex?.code ? "selected" : ""} onClick={() => onSelectIndex(item.code)}>
            <span>{item.name}</span>
            <strong><AnimatedNumber value={item.price} digits={2} /></strong>
            <em className={item.change_pct >= 0 ? "up" : "down"}>{formatPct(item.change_pct)}</em>
          </button>
        ))}
      </div>

      <article className="panel temperaturePanel oneThird">
        <PanelHead title="市场温度" meta={<DataBadge source={overview?.source} stale={overview?.source.includes("seed")} />} />
        <div className="temperatureDial" style={{ "--temperature-fill": `${temperature.score * 0.75}%` } as CSSProperties}>
          <div><Gauge size={20} /><strong><AnimatedNumber value={temperature.score} /></strong><span>{temperature.label}</span></div>
        </div>
        <div className="temperatureComponents">
          {Object.entries({ 市场宽度: temperature.components.breadth, 动量: temperature.components.momentum, 板块强度: temperature.components.sector_strength, 活跃度: temperature.components.activity }).map(([label, value]) => (
            <div key={label}><span>{label}</span><b>{value.toFixed(0)}</b><i><em style={{ width: `${Math.max(3, Math.min(100, value))}%` }} /></i></div>
          ))}
        </div>
      </article>

      <article className="panel twoThird indexTrendPanel">
        <PanelHead
          title={activeIndex?.name || "指数走势"}
          meta={activeIndex ? `${activeIndex.price.toFixed(2)} · ${formatAmount(activeIndex.amount)}` : ""}
          actions={<Segmented value={range} label="指数周期" options={[20, 60, 120].map((value) => ({ value, label: `${value}日` }))} onChange={onRangeChange} />}
        />
        {indexHistory.length ? <IndexTrendChart data={indexHistory} height={286} /> : <EmptyState text="正在准备指数历史数据" />}
      </article>

      <article className="panel twoThird sectorHeatmapPanel">
        <PanelHead title="行业热力图" meta="面积代表成交额，颜色代表涨跌" actions={loading ? <RefreshCw size={15} className="spin" /> : <Activity size={15} />} />
        <Suspense fallback={<div className="chartPlaceholder" />}>
          {sectors.length ? <SectorTreemap data={sectors} height={330} onSelect={onSelectSector} /> : <EmptyState text="暂无板块数据" />}
        </Suspense>
      </article>

      <article className="panel oneThird distributionPanel">
        <PanelHead title="涨跌分布" meta={`${breadth.total} 个样本`} />
        {distribution.length ? <DistributionChart data={distribution} height={250} /> : <EmptyState text="暂无分布数据" />}
        <div className="breadthMini">
          <span><b className="up"><AnimatedNumber value={breadth.up} /></b>上涨</span>
          <span><b><AnimatedNumber value={breadth.flat} /></b>平盘</span>
          <span><b className="down"><AnimatedNumber value={breadth.down} /></b>下跌</span>
        </div>
      </article>

      <article className="panel full">
        <PanelHead title="强势个股" meta="综合主题样本按涨跌幅排序" actions={<button className="textAction" onClick={() => stocks[0] && onSelectStock(stocks[0])}>查看详情 <ArrowUpRight size={14} /></button>} />
        <StockTable stocks={stocks.slice(0, 8)} comparedKeys={comparedKeys} watchedKeys={watchedKeys} compact onSelect={onSelectStock} onToggleCompare={onToggleCompare} onToggleWatch={onToggleWatch} />
      </article>
    </section>
  );
}
