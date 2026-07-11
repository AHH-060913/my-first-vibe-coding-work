import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import NewsPage from "../pages/NewsPage";
import StockDetailPage from "../pages/StockDetailPage";
import type { StockDetail } from "../types";

vi.mock("../components/StockTechnicalChart", () => ({
  default: ({ indicator }: { indicator: string }) => <div>technical-chart-{indicator}</div>
}));

const detail: StockDetail = {
  quote: { code: "300750", name: "宁德时代", market: "SZ", price: 200, change_pct: 1.2, amount: 1_000_000_000, turnover_rate: 1, volume_ratio: 1.1, pe: 20, pb: 4, market_cap: 800_000_000_000, sector: "电池", theme: "new_energy" },
  history: Array.from({ length: 70 }, (_, index) => ({ date: `2026-${index}`, open: 100 + index, close: 101 + index, high: 102 + index, low: 99 + index, volume: 1000, amount: 100000 })),
  profile: { code: "300750", name: "宁德时代", full_name: "宁德时代新能源科技股份有限公司", listing_date: "2018-06-11", region: "福建", industry: "电池", main_business: "动力电池和储能电池", business_scope: "新能源电池研发与制造", website: "https://example.com", total_shares: 1, float_shares: 1, source: "test", updated_at: "2026-01-01" },
  news: [], announcements: [], events: [], predictions: [], analytics: { return_5d: 1, return_20d: 2, return_60d: 3, annualized_volatility: 18, max_drawdown: -8, price_position: 70, amount_change_5d: 4, sample_size: 70 }, source: "test", updated_at: "2026-01-01"
};

describe("interactive pages", () => {
  it("switches technical indicators and saves local notes", async () => {
    const save = vi.fn();
    render(<StockDetailPage detail={detail} loading={false} watched={false} compared={false} onBack={() => undefined} onToggleWatch={() => undefined} onToggleCompare={() => undefined} onSaveNote={save} />);
    expect(await screen.findByText("technical-chart-macd")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "RSI" }));
    expect(await screen.findByText("technical-chart-rsi")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "研究笔记" }));
    fireEvent.change(screen.getByPlaceholderText("记录核心逻辑、需要验证的假设和风险点…"), { target: { value: "跟踪储能订单" } });
    fireEvent.change(screen.getByPlaceholderText("例如：AI、业绩、估值"), { target: { value: "储能,订单" } });
    fireEvent.click(screen.getByRole("button", { name: "保存笔记" }));
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ text: "跟踪储能订单", tags: ["储能", "订单"] }));
  });

  it("submits news and announcement filters", async () => {
    const apply = vi.fn();
    render(<NewsPage news={[]} announcements={[]} loading={false} onApply={apply} onSelectStock={() => undefined} />);
    fireEvent.change(screen.getByPlaceholderText("搜索新闻标题、股票名称或代码"), { target: { value: "宁德时代" } });
    fireEvent.click(screen.getByRole("button", { name: "应用筛选" }));
    await waitFor(() => expect(apply).toHaveBeenCalledWith(expect.objectContaining({ q: "宁德时代" })));
  });
});
