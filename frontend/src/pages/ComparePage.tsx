import { Suspense, lazy, useMemo, useState } from "react";
import { GitCompareArrows, Plus, X } from "lucide-react";
import { DataBadge, EmptyState, PanelHead, Segmented } from "../components/Common";
import { formatAmount, formatPct } from "../format";
import { makeStockKey } from "../storage";
import type { CompareResponse, Stock } from "../types";

const charts = import("../components/CompareCharts");
const PerformanceChart = lazy(() => charts.then((module) => ({ default: module.PerformanceChart })));
const RiskReturnChart = lazy(() => charts.then((module) => ({ default: module.RiskReturnChart })));
const CorrelationChart = lazy(() => charts.then((module) => ({ default: module.CorrelationChart })));

export default function ComparePage({ data, candidates, selectedKeys, range, loading, message, onRangeChange, onToggle, onSelectStock }: {
  data: CompareResponse | null;
  candidates: Stock[];
  selectedKeys: string[];
  range: number;
  loading: boolean;
  message: string;
  onRangeChange: (days: number) => void;
  onToggle: (stock: Stock) => void;
  onSelectStock: (stock: Stock) => void;
}) {
  const [candidateKey, setCandidateKey] = useState("");
  const selected = new Set(selectedKeys);
  const available = useMemo(() => candidates.filter((item) => !selected.has(makeStockKey(item.code, item.market))), [candidates, selectedKeys]);
  const addCandidate = () => {
    const stock = available.find((item) => makeStockKey(item.code, item.market) === candidateKey);
    if (stock) onToggle(stock);
    setCandidateKey("");
  };
  return (
    <section className="pageGrid compareV2">
      <article className="panel full compareToolbar">
        <PanelHead title="多股对比" meta={`${selectedKeys.length} / 5 只 · 默认沪深300基准`} actions={<Segmented value={range} label="对比周期" options={[20, 60, 120].map((value) => ({ value, label: `${value}日` }))} onChange={onRangeChange} />} />
        <div className="comparePicker">
          <select value={candidateKey} onChange={(event) => setCandidateKey(event.target.value)} aria-label="选择对比股票"><option value="">选择一只股票加入对比</option>{available.map((stock) => <option key={makeStockKey(stock.code, stock.market)} value={makeStockKey(stock.code, stock.market)}>{stock.name} · {stock.code}</option>)}</select>
          <button className="primaryButton iconText" disabled={!candidateKey || selectedKeys.length >= 5} onClick={addCandidate}><Plus size={16} />加入</button>
          {data && <DataBadge source={data.source} stale={data.stale} />}
        </div>
        <div className="compareChips">{selectedKeys.map((key) => {
          const parsed = key.includes(":") ? key.split(":", 2) : ["", key];
          const stock = candidates.find((item) => makeStockKey(item.code, item.market) === key) ?? { code: parsed[1], market: parsed[0], name: key, price: 0, change_pct: 0, amount: 0, turnover_rate: 0, volume_ratio: 0, pe: 0, pb: 0, market_cap: 0, sector: "", theme: "" } as Stock;
          return <span key={key}><button onClick={() => onSelectStock(stock)}>{stock.name || key}</button><button onClick={() => onToggle(stock)} title="移出对比"><X size={13} /></button></span>;
        })}</div>
        {message && <p className="compareMessage">{message}</p>}
      </article>

      {selectedKeys.length < 2 ? <article className="panel full"><EmptyState text="至少选择两只股票后生成对比分析" /></article> : loading && !data ? <article className="panel full"><div className="detailLoading"><span className="largeSpinner" />正在对齐行情与计算相关性</div></article> : data && <>
        <article className="panel full"><PanelHead title="相对表现" meta={`${data.window} 个交易日 · 沪深300虚线基准`} /><Suspense fallback={<div className="chartPlaceholder tall" />}><PerformanceChart data={data} /></Suspense></article>
        <article className="panel twoThird"><PanelHead title="关键指标对比" meta="收益、风险与估值使用同一行情窗口" /><div className="tableWrap compareMetricsTable"><table><thead><tr><th>股票</th><th>区间收益</th><th>超额收益</th><th>年化波动</th><th>最大回撤</th><th>基准相关</th><th>成交额</th><th>PE / PB</th></tr></thead><tbody>{data.metrics.map((item) => <tr key={`${item.market}:${item.code}`}><td><button className="stockLink" onClick={() => { const stock = candidates.find((candidate) => candidate.code === item.code && (candidate.market || "") === item.market); if (stock) onSelectStock(stock); }}>{item.name}</button><small>{item.code}</small></td><td className={item.return_pct >= 0 ? "up" : "down"}>{formatPct(item.return_pct)}</td><td className={item.excess_return_pct >= 0 ? "up" : "down"}>{formatPct(item.excess_return_pct)}</td><td>{item.annualized_volatility == null ? "--" : formatPct(item.annualized_volatility)}</td><td className="down">{item.max_drawdown == null ? "--" : formatPct(item.max_drawdown)}</td><td>{item.correlation_to_benchmark == null ? "--" : item.correlation_to_benchmark.toFixed(2)}</td><td>{formatAmount(item.amount)}</td><td>{item.pe.toFixed(1)} / {item.pb.toFixed(1)}</td></tr>)}</tbody></table></div></article>
        <article className="panel oneThird"><PanelHead title="风险收益分布" meta="气泡大小代表成交额" /><Suspense fallback={<div className="chartPlaceholder" />}><RiskReturnChart data={data} /></Suspense></article>
        <article className="panel full"><PanelHead title="收益相关性" meta="越接近 1 走势越同步，不能直接代表因果关系" /><Suspense fallback={<div className="chartPlaceholder" />}><CorrelationChart data={data} /></Suspense></article>
      </>}
    </section>
  );
}
