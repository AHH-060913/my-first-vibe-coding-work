import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Building2, CalendarDays, ExternalLink, FileText, GitCompareArrows, NotebookPen, Share2, Star, TrendingUp } from "lucide-react";
import { AnimatedNumber, DataBadge, EmptyState, PanelHead, Segmented } from "../components/Common";
import type { IndicatorMode } from "../components/StockTechnicalChart";
import { formatAmount, formatDateTime, formatPct, probability } from "../format";
import type { ResearchNote, StockDetail } from "../types";

const TechnicalChart = lazy(() => import("../components/StockTechnicalChart"));
type DetailTab = "analysis" | "profile" | "events" | "prediction" | "notes";

const tabs: Array<{ key: DetailTab; label: string; icon: typeof TrendingUp }> = [
  { key: "analysis", label: "行情分析", icon: TrendingUp },
  { key: "profile", label: "公司资料", icon: Building2 },
  { key: "events", label: "资讯公告", icon: CalendarDays },
  { key: "prediction", label: "模型预测", icon: FileText },
  { key: "notes", label: "研究笔记", icon: NotebookPen }
];

export default function StockDetailPage({ detail, loading, note, watched, compared, onBack, onToggleWatch, onToggleCompare, onSaveNote }: {
  detail: StockDetail | null;
  loading: boolean;
  note?: ResearchNote;
  watched: boolean;
  compared: boolean;
  onBack: () => void;
  onToggleWatch: () => void;
  onToggleCompare: () => void;
  onSaveNote: (note: ResearchNote) => void;
}) {
  const [tab, setTab] = useState<DetailTab>("analysis");
  const [range, setRange] = useState(60);
  const [indicator, setIndicator] = useState<IndicatorMode>("macd");
  const [noteText, setNoteText] = useState(note?.text ?? "");
  const [tagText, setTagText] = useState(note?.tags.join("、") ?? "");
  const [shareMessage, setShareMessage] = useState("");
  useEffect(() => {
    setNoteText(note?.text ?? "");
    setTagText(note?.tags.join("、") ?? "");
  }, [note?.code, note?.text, note?.tags]);
  const history = useMemo(() => detail?.history.slice(-range) ?? [], [detail?.history, range]);
  if (!detail) return <div className="detailLoading"><span className="largeSpinner" />{loading ? "正在加载个股分析" : "暂未取得个股资料"}</div>;
  const { quote, profile, analytics } = detail;
  const saveNote = () => onSaveNote({ code: quote.code, market: quote.market || "", text: noteText.trim(), tags: tagText.split(/[、,，]/).map((item) => item.trim()).filter(Boolean).slice(0, 8), updated_at: new Date().toISOString() });
  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareMessage("链接已复制");
      window.setTimeout(() => setShareMessage(""), 1600);
    } catch {
      setShareMessage("可直接复制地址栏链接");
    }
  };
  return (
    <section className="stockDetailPage">
      <button className="backButton" onClick={onBack}><ArrowLeft size={17} />返回个股列表</button>
      <header className="stockHero" style={{ viewTransitionName: `stock-${quote.code}` }}>
        <div className="stockIdentity">
          <span className="marketToken">{quote.market || "A"}</span>
          <div><span>{quote.code} · {profile?.industry || quote.sector}</span><h1>{quote.name}</h1><p>{profile?.full_name || "公开市场资料"}</p></div>
        </div>
        <div className="heroQuote">
          <strong><AnimatedNumber value={quote.price} digits={2} /></strong>
          <em className={quote.change_pct >= 0 ? "up" : "down"}>{formatPct(quote.change_pct)}</em>
          <small>更新于 {formatDateTime(detail.updated_at)}</small>
        </div>
        <div className="heroActions">
          <DataBadge source={detail.source} stale={quote.stale} />
          <button className={watched ? "selected" : ""} onClick={onToggleWatch} title={watched ? "移出自选" : "加入自选"}><Star size={17} fill={watched ? "currentColor" : "none"} /></button>
          <button className={compared ? "selected" : ""} onClick={onToggleCompare} title={compared ? "移出对比" : "加入对比"}><GitCompareArrows size={17} /></button>
          <button onClick={share} title="复制详情页链接"><Share2 size={17} /></button>
          {shareMessage && <span className="actionToast">{shareMessage}</span>}
        </div>
      </header>

      <nav className="detailTabs" aria-label="个股详情页签">
        {tabs.map((item) => { const Icon = item.icon; return <button key={item.key} className={tab === item.key ? "selected" : ""} onClick={() => setTab(item.key)}><Icon size={15} />{item.label}</button>; })}
      </nav>

      <div className="detailTabStage" key={tab}>
        {tab === "analysis" && <>
          <div className="analyticsGrid">
            <AnalyticsMetric label="5日收益" value={analytics?.return_5d} suffix="%" tone />
            <AnalyticsMetric label="20日收益" value={analytics?.return_20d} suffix="%" tone />
            <AnalyticsMetric label="60日收益" value={analytics?.return_60d} suffix="%" tone />
            <AnalyticsMetric label="年化波动" value={analytics?.annualized_volatility} suffix="%" />
            <AnalyticsMetric label="最大回撤" value={analytics?.max_drawdown} suffix="%" tone />
            <AnalyticsMetric label="区间位置" value={analytics?.price_position} suffix="%" />
          </div>
          <article className="panel technicalPanel">
            <PanelHead
              title="技术走势"
              meta={`${range} 个交易日 · 前复权/样例口径随数据源`}
              actions={<div className="dualControls"><Segmented value={range} label="K线周期" options={[20, 60, 120].map((value) => ({ value, label: `${value}日` }))} onChange={setRange} /><Segmented value={indicator} label="副图指标" options={[{ value: "macd", label: "MACD" }, { value: "rsi", label: "RSI" }]} onChange={setIndicator} /></div>}
            />
            <Suspense fallback={<div className="chartPlaceholder tall" />}><TechnicalChart data={history} indicator={indicator} /></Suspense>
          </article>
          <div className="quoteFacts">
            <Fact label="成交额" value={formatAmount(quote.amount)} />
            <Fact label="换手率" value={`${quote.turnover_rate.toFixed(2)}%`} />
            <Fact label="量比" value={quote.volume_ratio.toFixed(2)} />
            <Fact label="PE / PB" value={`${quote.pe.toFixed(1)} / ${quote.pb.toFixed(1)}`} />
            <Fact label="总市值" value={formatAmount(quote.market_cap)} />
            <Fact label="成交额变化" value={analytics?.amount_change_5d == null ? "样本不足" : formatPct(analytics.amount_change_5d)} />
          </div>
        </>}

        {tab === "profile" && <div className="profileLayout">
          <article className="panel profileNarrative"><PanelHead title="公司背景" meta={profile?.source || "暂无资料源"} /><p className="leadCopy">{profile?.main_business || "暂无主营业务资料。"}</p><h3>经营范围</h3><p>{profile?.business_scope || "暂无经营范围资料。"}</p></article>
          <article className="panel profileFacts"><PanelHead title="基础资料" />
            <Fact label="公司全称" value={profile?.full_name || "暂无"} /><Fact label="所属行业" value={profile?.industry || quote.sector || "暂无"} /><Fact label="地区" value={profile?.region || "暂无"} /><Fact label="上市日期" value={profile?.listing_date || "暂无"} /><Fact label="总股本" value={profile?.total_shares ? formatAmount(profile.total_shares) : "暂无"} /><Fact label="流通股本" value={profile?.float_shares ? formatAmount(profile.float_shares) : "暂无"} />
            {profile?.website && <a className="websiteLink" href={profile.website} target="_blank" rel="noreferrer">访问公司官网 <ExternalLink size={14} /></a>}
          </article>
        </div>}

        {tab === "events" && <article className="panel"><PanelHead title="公司事件时间轴" meta={`${detail.events?.length ?? 0} 条`} />
          {detail.events?.length ? <div className="eventTimeline">{detail.events.map((event, index) => {
            const content = <><i className={event.kind} /><time>{event.published_at}</time><div><span>{event.type} · {event.source}</span><strong>{event.title}</strong></div>{event.url && <ExternalLink size={14} />}</>;
            return event.url ? <a key={`${event.title}-${index}`} href={event.url} target="_blank" rel="noreferrer">{content}</a> : <div key={`${event.title}-${index}`}>{content}</div>;
          })}</div> : <EmptyState text="暂无关联新闻或公告" />}
        </article>}

        {tab === "prediction" && <PredictionDetail detail={detail} />}

        {tab === "notes" && <div className="notesLayout">
          <article className="panel noteEditor"><PanelHead title="个人研究笔记" meta="仅保存在当前浏览器" /><textarea value={noteText} onChange={(event) => setNoteText(event.target.value)} placeholder="记录核心逻辑、需要验证的假设和风险点…" rows={10} /><label><span>标签</span><input value={tagText} onChange={(event) => setTagText(event.target.value)} placeholder="例如：AI、业绩、估值" /></label><button className="primaryButton" onClick={saveNote}>保存笔记</button></article>
          <article className="panel noteGuide"><PanelHead title="研究检查清单" /><ul><li>主营业务与行业景气是否一致</li><li>估值变化是否由盈利预期支撑</li><li>成交量与价格趋势是否互相验证</li><li>公告和新闻是否改变原始假设</li><li>预测置信度与样本量是否足够</li></ul></article>
        </div>}
      </div>
    </section>
  );
}

function AnalyticsMetric({ label, value, suffix, tone = false }: { label: string; value?: number | null; suffix: string; tone?: boolean }) {
  const numeric = value ?? 0;
  return <article className="analyticsMetric"><span>{label}</span><strong className={tone ? numeric >= 0 ? "up" : "down" : ""}>{value == null ? "--" : <AnimatedNumber value={numeric} digits={2} suffix={suffix} />}</strong></article>;
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div className="factRow"><span>{label}</span><strong>{value}</strong></div>;
}

function PredictionDetail({ detail }: { detail: StockDetail }) {
  const predictions = [...(detail.predictions ?? [])].sort((a, b) => a.horizon - b.horizon);
  if (!predictions.length) return <article className="panel"><EmptyState text="暂无模型预测" /></article>;
  return <section className="predictionDetailGrid">
    <article className="panel full"><PanelHead title="多周期概率" meta="仅作研究展示，不构成投资建议" /><div className="horizonCards">{predictions.map((item) => <div key={item.horizon}><span>{item.horizon} 个交易日</span><strong>{probability(item.excess_probability)}</strong><em>跑赢基准概率</em><i><b style={{ width: `${item.excess_probability * 100}%` }} /></i><small>上涨概率 {probability(item.up_probability)} · 置信度 {item.confidence}</small></div>)}</div></article>
    <article className="panel"><PanelHead title="主要贡献因子" />{predictions[0].factors.map((factor) => <div className="factorBar" key={factor.name}><span>{factor.name}</span><i><b className={factor.direction} style={{ width: `${Math.min(100, 25 + Math.abs(factor.value) * 8)}%` }} /></i><em>{factor.value}{factor.unit}</em></div>)}</article>
    <article className="panel"><PanelHead title="模型与风险" /><div className="modelMetrics"><Fact label="模型" value={predictions[0].model} /><Fact label="命中率" value={predictions[0].metrics.accuracy == null ? "暂无" : probability(predictions[0].metrics.accuracy)} /><Fact label="AUC" value={predictions[0].metrics.auc == null ? "暂无" : predictions[0].metrics.auc.toFixed(2)} /><Fact label="样本数" value={String(predictions[0].metrics.sample_size ?? 0)} /></div><ul className="riskList">{predictions.flatMap((item) => item.risks).filter((item, index, rows) => rows.indexOf(item) === index).map((risk) => <li key={risk}>{risk}</li>)}</ul></article>
  </section>;
}
