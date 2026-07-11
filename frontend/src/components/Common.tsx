import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { GitCompareArrows, Star } from "lucide-react";
import { formatAmount, formatPct } from "../format";
import { makeStockKey } from "../storage";
import type { Stock } from "../types";

export function AnimatedNumber({ value, digits = 0, suffix = "" }: { value: number; digits?: number; suffix?: string }) {
  const [display, setDisplay] = useState(value);
  const previous = useRef(value);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(value);
      previous.current = value;
      return;
    }
    const from = previous.current;
    const started = window.performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / 620);
      const eased = 1 - (1 - progress) ** 4;
      setDisplay(from + (value - from) * eased);
      if (progress < 1) frame = window.requestAnimationFrame(tick);
      else previous.current = value;
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [value]);
  return <>{display.toFixed(digits)}{suffix}</>;
}

export function PanelHead({ title, meta, actions }: { title: string; meta?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="panelHead">
      <div><h2>{title}</h2>{meta && <span>{meta}</span>}</div>
      {actions && <div className="panelActions">{actions}</div>}
    </div>
  );
}

export function EmptyState({ text }: { text: string }) {
  return <div className="emptyState"><span className="emptyPulse" />{text}</div>;
}

export function DataBadge({ source, stale }: { source?: string; stale?: boolean }) {
  const isDemo = stale || source?.includes("seed") || source?.includes("static-demo");
  return <span className={`dataBadge ${isDemo ? "stale" : "live"}`}>{isDemo ? "演示 / 缓存" : "在线数据"}</span>;
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div className="segmented" aria-label={label}>
      {options.map((item) => (
        <button key={String(item.value)} className={value === item.value ? "selected" : ""} onClick={() => onChange(item.value)}>
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function StockTable({
  stocks,
  comparedKeys = [],
  watchedKeys = [],
  compact = false,
  onSelect,
  onToggleCompare,
  onToggleWatch
}: {
  stocks: Stock[];
  comparedKeys?: string[];
  watchedKeys?: string[];
  compact?: boolean;
  onSelect: (stock: Stock) => void;
  onToggleCompare?: (stock: Stock) => void;
  onToggleWatch?: (stock: Stock) => void;
}) {
  if (!stocks.length) return <EmptyState text="暂无符合条件的股票" />;
  const compared = new Set(comparedKeys);
  const watched = new Set(watchedKeys);
  return (
    <div className="tableWrap">
      <table className={compact ? "compactTable" : ""}>
        <thead>
          <tr>
            <th>代码</th><th>名称</th><th>行业</th><th>最新价</th><th>涨跌幅</th>
            {!compact && <><th>成交额</th><th>换手率</th><th>量比</th><th>PE / PB</th></>}
            <th className="actionColumn">操作</th>
          </tr>
        </thead>
        <tbody>
          {stocks.map((stock, index) => {
            const key = makeStockKey(stock.code, stock.market);
            return (
              <tr key={key} style={{ "--row-index": index } as CSSProperties}>
                <td className="codeCell">{stock.code}</td>
                <td><button className="stockLink" onClick={() => onSelect(stock)} style={{ viewTransitionName: `stock-${stock.code}` }}>{stock.name}</button></td>
                <td><span className="sectorTag">{stock.sector || "未分类"}</span></td>
                <td>{Number(stock.price || 0).toFixed(2)}</td>
                <td className={stock.change_pct >= 0 ? "up" : "down"}>{formatPct(stock.change_pct)}</td>
                {!compact && <>
                  <td>{formatAmount(stock.amount)}</td>
                  <td>{Number(stock.turnover_rate || 0).toFixed(2)}%</td>
                  <td>{Number(stock.volume_ratio || 0).toFixed(2)}</td>
                  <td>{Number(stock.pe || 0).toFixed(1)} / {Number(stock.pb || 0).toFixed(1)}</td>
                </>}
                <td className="rowActions">
                  {onToggleWatch && <button className={watched.has(key) ? "selected" : ""} onClick={() => onToggleWatch(stock)} title={watched.has(key) ? "移出自选" : "加入自选"}><Star size={15} fill={watched.has(key) ? "currentColor" : "none"} /></button>}
                  {onToggleCompare && <button className={compared.has(key) ? "selected" : ""} onClick={() => onToggleCompare(stock)} title={compared.has(key) ? "移出对比" : "加入对比"}><GitCompareArrows size={15} /></button>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function SkeletonGrid({ cards = 4 }: { cards?: number }) {
  return <div className="skeletonGrid" aria-label="正在加载">{Array.from({ length: cards }, (_, index) => <span key={index} />)}</div>;
}
