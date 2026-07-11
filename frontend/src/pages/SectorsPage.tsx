import { ChevronRight, Flame, Users } from "lucide-react";
import { EmptyState, PanelHead, StockTable } from "../components/Common";
import { SectorTreemap } from "../components/OverviewCharts";
import { formatAmount, formatPct } from "../format";
import type { Sector, Stock } from "../types";

export default function SectorsPage({
  sectors,
  stocks,
  selectedSector,
  comparedKeys,
  watchedKeys,
  onSelectSector,
  onSelectStock,
  onToggleCompare,
  onToggleWatch
}: {
  sectors: Sector[];
  stocks: Stock[];
  selectedSector: string;
  comparedKeys: string[];
  watchedKeys: string[];
  onSelectSector: (sector: string) => void;
  onSelectStock: (stock: Stock) => void;
  onToggleCompare: (stock: Stock) => void;
  onToggleWatch: (stock: Stock) => void;
}) {
  const active = sectors.find((item) => item.name === selectedSector) ?? sectors[0];
  return (
    <section className="pageGrid sectorsV2">
      <article className="panel twoThird">
        <PanelHead title="主题板块热力" meta="点击板块查看成分样本" />
        {sectors.length ? <SectorTreemap data={sectors} height={390} onSelect={onSelectSector} /> : <EmptyState text="暂无板块数据" />}
      </article>
      <article className="panel oneThird sectorFocus">
        <PanelHead title={active?.name || "板块概览"} meta={active ? formatPct(active.change_pct) : ""} />
        {active ? <>
          <div className="sectorLeader"><Flame size={18} /><span>领涨股</span><strong>{active.leader}</strong><em className={active.leader_change_pct >= 0 ? "up" : "down"}>{formatPct(active.leader_change_pct)}</em></div>
          <div className="sectorStats">
            <div><span>成交额</span><b>{formatAmount(active.amount)}</b></div>
            <div><span>换手率</span><b>{active.turnover_rate.toFixed(2)}%</b></div>
            <div><span>上涨家数</span><b className="up">{active.up_count}</b></div>
            <div><span>下跌家数</span><b className="down">{active.down_count}</b></div>
          </div>
          <div className="breadthBar"><i style={{ width: `${(active.up_count / Math.max(1, active.up_count + active.down_count)) * 100}%` }} /></div>
          <p className="panelNote"><Users size={15} />板块宽度反映当前样本涨跌结构，不代表资金净流入。</p>
        </> : <EmptyState text="选择一个板块" />}
      </article>
      <article className="panel full">
        <PanelHead title={active ? `${active.name} · 成分样本` : "成分样本"} meta={`${stocks.length} 只`} actions={active && <button className="textAction" onClick={() => onSelectSector(active.name)}>刷新筛选 <ChevronRight size={14} /></button>} />
        <StockTable stocks={stocks} comparedKeys={comparedKeys} watchedKeys={watchedKeys} onSelect={onSelectStock} onToggleCompare={onToggleCompare} onToggleWatch={onToggleWatch} />
      </article>
    </section>
  );
}
