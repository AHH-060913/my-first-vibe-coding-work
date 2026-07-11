import { PanelHead, Segmented, StockTable } from "../components/Common";
import { formatAmount, formatPct, probability } from "../format";
import type { Prediction, Sector, Stock } from "../types";

export type RankingType = "gainers" | "losers" | "turnover" | "volume_ratio" | "hot_sector" | "model_score";
const options: Array<{ value: RankingType; label: string }> = [
  { value: "gainers", label: "涨幅" }, { value: "losers", label: "跌幅" }, { value: "turnover", label: "成交额" }, { value: "volume_ratio", label: "量比" }, { value: "hot_sector", label: "板块" }, { value: "model_score", label: "模型" }
];

export default function RankingsPage({ type, items, comparedKeys, watchedKeys, onTypeChange, onSelectStock, onToggleCompare, onToggleWatch }: {
  type: RankingType;
  items: Array<Stock | Sector | Prediction>;
  comparedKeys: string[];
  watchedKeys: string[];
  onTypeChange: (type: RankingType) => void;
  onSelectStock: (stock: Stock) => void;
  onToggleCompare: (stock: Stock) => void;
  onToggleWatch: (stock: Stock) => void;
}) {
  return <section className="panel rankingsV2"><PanelHead title="市场排行榜" meta="支持主题筛选后的实时样本" actions={<Segmented value={type} label="排行类型" options={options} onChange={onTypeChange} />} />
    {type === "hot_sector" ? <div className="tableWrap"><table><thead><tr><th>排名</th><th>板块</th><th>涨跌幅</th><th>成交额</th><th>换手率</th><th>上涨 / 下跌</th><th>领涨股</th></tr></thead><tbody>{(items as Sector[]).map((item, index) => <tr key={item.name}><td className="rankNumber">{index + 1}</td><td>{item.name}</td><td className={item.change_pct >= 0 ? "up" : "down"}>{formatPct(item.change_pct)}</td><td>{formatAmount(item.amount)}</td><td>{item.turnover_rate.toFixed(2)}%</td><td>{item.up_count} / {item.down_count}</td><td>{item.leader} <em className={item.leader_change_pct >= 0 ? "up" : "down"}>{formatPct(item.leader_change_pct)}</em></td></tr>)}</tbody></table></div>
      : type === "model_score" ? <div className="tableWrap"><table><thead><tr><th>排名</th><th>股票</th><th>周期</th><th>上涨概率</th><th>跑赢概率</th><th>置信度</th><th>模型</th></tr></thead><tbody>{(items as Prediction[]).map((item, index) => <tr key={`${item.code}-${item.horizon}`}><td className="rankNumber">{index + 1}</td><td><button className="stockLink" onClick={() => onSelectStock({ code: item.code, name: item.name, market: item.code.startsWith("6") ? "SH" : "SZ", price: 0, change_pct: 0, amount: 0, turnover_rate: 0, volume_ratio: 0, pe: 0, pb: 0, market_cap: 0, sector: "", theme: "" })}>{item.name}</button><small>{item.code}</small></td><td>{item.horizon}日</td><td>{probability(item.up_probability)}</td><td><b>{probability(item.excess_probability)}</b></td><td>{item.confidence}</td><td>{item.model}</td></tr>)}</tbody></table></div>
      : <StockTable stocks={items as Stock[]} comparedKeys={comparedKeys} watchedKeys={watchedKeys} onSelect={onSelectStock} onToggleCompare={onToggleCompare} onToggleWatch={onToggleWatch} />}
  </section>;
}
