import { useMemo, useState } from "react";
import { AlertTriangle, BarChart3, BrainCircuit } from "lucide-react";
import { EmptyState, PanelHead } from "../components/Common";
import { probability } from "../format";
import type { Prediction, Stock } from "../types";

export default function PredictionsPage({ predictions, loading, onSelectStock }: { predictions: Prediction[]; loading: boolean; onSelectStock: (stock: Stock) => void }) {
  const grouped = useMemo(() => {
    const map = new Map<string, Prediction[]>();
    predictions.forEach((item) => map.set(item.code, [...(map.get(item.code) ?? []), item].sort((a, b) => a.horizon - b.horizon)));
    return [...map.entries()].map(([code, rows]) => ({ code, name: rows[0].name, rows, score: rows.reduce((sum, item) => sum + item.excess_probability, 0) / rows.length })).sort((a, b) => b.score - a.score);
  }, [predictions]);
  const [selectedCode, setSelectedCode] = useState("");
  const selected = grouped.find((item) => item.code === selectedCode) ?? grouped[0];
  if (!predictions.length && !loading) return <section className="panel"><EmptyState text="暂无预测结果" /></section>;
  return <section className="pageGrid predictionsV2">
    <article className="panel full"><PanelHead title="1 / 3 / 5 日模型观察" meta="按平均跑赢概率排序，不展示买入或卖出建议" actions={<BrainCircuit size={17} />} />
      <div className="predictionLeaderboard">{grouped.slice(0, 8).map((item, index) => <button key={item.code} className={selected?.code === item.code ? "selected" : ""} onClick={() => setSelectedCode(item.code)}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{item.name}</strong><small>{item.code}</small></div><b>{probability(item.score)}</b><i><em style={{ width: `${item.score * 100}%` }} /></i></button>)}</div>
    </article>
    {selected && <>
      <article className="panel twoThird"><PanelHead title={`${selected.name} · 多周期概率`} meta="概率变化比单一数值更重要" />
        <div className="probabilityComparison">{selected.rows.map((item) => <div key={item.horizon}><span>{item.horizon}日</span><strong>{probability(item.excess_probability)}</strong><p>跑赢基准</p><i><b style={{ height: `${item.excess_probability * 100}%` }} /></i><small>上涨 {probability(item.up_probability)}</small></div>)}</div>
      </article>
      <article className="panel oneThird"><PanelHead title="模型质量" actions={<BarChart3 size={16} />} />
        <div className="modelQuality"><span>置信度<strong>{selected.rows[0].confidence}</strong></span><span>命中率<strong>{selected.rows[0].metrics.accuracy == null ? "--" : probability(selected.rows[0].metrics.accuracy)}</strong></span><span>AUC<strong>{selected.rows[0].metrics.auc == null ? "--" : selected.rows[0].metrics.auc.toFixed(2)}</strong></span><span>样本量<strong>{selected.rows[0].metrics.sample_size ?? 0}</strong></span></div>
        <button className="secondaryButton" onClick={() => onSelectStock({ code: selected.code, name: selected.name, market: selected.code.startsWith("6") ? "SH" : "SZ", price: 0, change_pct: 0, amount: 0, turnover_rate: 0, volume_ratio: 0, pe: 0, pb: 0, market_cap: 0, sector: "", theme: "" })}>打开个股详情</button>
      </article>
      <article className="panel twoThird"><PanelHead title="贡献因子" meta={selected.rows[0].model} />{selected.rows[0].factors.map((factor) => <div className="factorContribution" key={factor.name}><span>{factor.name}</span><i><b className={factor.direction} style={{ width: `${Math.min(100, 20 + Math.abs(factor.value) * 8)}%` }} /></i><em>{factor.value}{factor.unit}</em></div>)}</article>
      <article className="panel oneThird"><PanelHead title="风险提示" actions={<AlertTriangle size={16} />} /><ul className="riskList">{selected.rows.flatMap((item) => item.risks).filter((risk, index, rows) => rows.indexOf(risk) === index).map((risk) => <li key={risk}>{risk}</li>)}</ul></article>
    </>}
  </section>;
}
