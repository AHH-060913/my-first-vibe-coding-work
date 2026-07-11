import { useMemo, useState } from "react";
import { FolderPlus, GitCompareArrows, NotebookPen, Plus, Star, Trash2 } from "lucide-react";
import { EmptyState, PanelHead, StockTable } from "../components/Common";
import { formatPct } from "../format";
import { makeStockKey } from "../storage";
import type { ResearchNote, Stock, WatchGroup } from "../types";

export default function WatchlistPage({ groups, activeGroupId, stocks, notes, comparedKeys, onSelectGroup, onCreateGroup, onDeleteGroup, onMoveStock, onSelectStock, onToggleCompare, onToggleWatch }: {
  groups: WatchGroup[];
  activeGroupId: string;
  stocks: Stock[];
  notes: Record<string, ResearchNote>;
  comparedKeys: string[];
  onSelectGroup: (id: string) => void;
  onCreateGroup: (name: string) => void;
  onDeleteGroup: (id: string) => void;
  onMoveStock: (key: string, groupId: string) => void;
  onSelectStock: (stock: Stock) => void;
  onToggleCompare: (stock: Stock) => void;
  onToggleWatch: (stock: Stock) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [groupName, setGroupName] = useState("");
  const active = groups.find((item) => item.id === activeGroupId) ?? groups[0];
  const activeKeys = active?.codes ?? [];
  const visible = useMemo(() => stocks.filter((stock) => activeKeys.includes(makeStockKey(stock.code, stock.market))), [activeKeys, stocks]);
  const strongest = [...visible].sort((a, b) => b.change_pct - a.change_pct)[0];
  const weakest = [...visible].sort((a, b) => a.change_pct - b.change_pct)[0];
  const saveGroup = () => {
    if (!groupName.trim()) return;
    onCreateGroup(groupName.trim());
    setGroupName("");
    setCreating(false);
  };
  return <section className="pageGrid watchlistV2">
    <article className="panel full watchHeader"><PanelHead title="个人研究清单" meta="分组、标签和笔记仅保存在当前浏览器" actions={<button className="secondaryButton iconText" onClick={() => setCreating((value) => !value)}><FolderPlus size={15} />新建分组</button>} />
      <div className="watchGroupTabs">{groups.map((group) => <span key={group.id} className={group.id === active?.id ? "selected" : ""}><button onClick={() => onSelectGroup(group.id)}>{group.name}<small>{group.codes.length}</small></button>{groups.length > 1 && group.id === active?.id && <button onClick={() => onDeleteGroup(group.id)} title="删除当前分组"><Trash2 size={12} /></button>}</span>)}</div>
      {creating && <div className="inlineCreate"><input value={groupName} onChange={(event) => setGroupName(event.target.value)} onKeyDown={(event) => event.key === "Enter" && saveGroup()} placeholder="输入分组名称" autoFocus /><button className="primaryButton iconText" onClick={saveGroup}><Plus size={14} />创建</button></div>}
    </article>
    <div className="watchSummary full">
      <article><Star size={17} /><span>当前分组</span><strong>{active?.name || "暂无"}</strong><small>{visible.length} 只股票</small></article>
      <article><span>表现最强</span><strong>{strongest?.name || "--"}</strong><small className="up">{strongest ? formatPct(strongest.change_pct) : "--"}</small></article>
      <article><span>表现最弱</span><strong>{weakest?.name || "--"}</strong><small className="down">{weakest ? formatPct(weakest.change_pct) : "--"}</small></article>
      <article><NotebookPen size={17} /><span>研究笔记</span><strong>{activeKeys.filter((key) => notes[key]?.text).length}</strong><small>已记录</small></article>
      <article><GitCompareArrows size={17} /><span>已加入对比</span><strong>{activeKeys.filter((key) => comparedKeys.includes(key)).length}</strong><small>当前分组</small></article>
    </div>
    <article className="panel full"><PanelHead title={active?.name || "自选股"} meta="可快速打开详情、加入对比或移动分组" />
      {visible.length ? <>
        <StockTable stocks={visible} comparedKeys={comparedKeys} watchedKeys={activeKeys} onSelect={onSelectStock} onToggleCompare={onToggleCompare} onToggleWatch={onToggleWatch} />
        <div className="watchManagement">{visible.map((stock) => { const key = makeStockKey(stock.code, stock.market); return <div key={key}><button className="stockLink" onClick={() => onSelectStock(stock)}>{stock.name}</button><span>{notes[key]?.tags.length ? notes[key].tags.map((tag) => <i key={tag}>{tag}</i>) : "暂无标签"}</span><label>移动到<select value={active?.id} onChange={(event) => onMoveStock(key, event.target.value)}>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label></div>; })}</div>
      </> : <EmptyState text="当前分组暂无股票，可在行情或详情页点击星标添加" />}
    </article>
  </section>;
}
