import { useMemo, useState } from "react";
import { Filter, Search } from "lucide-react";
import { PanelHead, Segmented, StockTable } from "../components/Common";
import type { Stock } from "../types";

type SortKey = "change_pct" | "amount" | "turnover_rate" | "volume_ratio" | "market_cap";

export default function StocksPage({ stocks, comparedKeys, watchedKeys, onSelect, onToggleCompare, onToggleWatch }: {
  stocks: Stock[];
  comparedKeys: string[];
  watchedKeys: string[];
  onSelect: (stock: Stock) => void;
  onToggleCompare: (stock: Stock) => void;
  onToggleWatch: (stock: Stock) => void;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("change_pct");
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...stocks]
      .filter((item) => !q || item.code.includes(q) || item.name.toLowerCase().includes(q) || item.sector.toLowerCase().includes(q))
      .sort((a, b) => Number(b[sort] || 0) - Number(a[sort] || 0));
  }, [query, sort, stocks]);
  return (
    <section className="panel stockUniverse">
      <PanelHead
        title="个股行情"
        meta={`${visible.length} 只样本 · 点击名称进入深度分析`}
        actions={<Segmented value={sort} label="个股排序" options={[
          { value: "change_pct", label: "涨跌幅" }, { value: "amount", label: "成交额" }, { value: "turnover_rate", label: "换手率" }, { value: "volume_ratio", label: "量比" }, { value: "market_cap", label: "市值" }
        ]} onChange={setSort} />}
      />
      <div className="tableFilters">
        <label><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="在当前样本中筛选代码、名称或行业" /></label>
        <span><Filter size={14} />当前按{sort === "change_pct" ? "涨跌幅" : sort === "amount" ? "成交额" : sort === "turnover_rate" ? "换手率" : sort === "volume_ratio" ? "量比" : "总市值"}降序</span>
      </div>
      <StockTable stocks={visible} comparedKeys={comparedKeys} watchedKeys={watchedKeys} onSelect={onSelect} onToggleCompare={onToggleCompare} onToggleWatch={onToggleWatch} />
    </section>
  );
}
