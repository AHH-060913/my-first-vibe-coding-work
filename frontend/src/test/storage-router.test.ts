import { beforeEach, describe, expect, it } from "vitest";
import { parseHash } from "../router";
import { loadNotes, loadWatchState, makeStockKey, saveResearchNote, saveWatchState } from "../storage";

describe("local research storage and hash routing", () => {
  beforeEach(() => window.localStorage.clear());

  it("parses shareable stock detail routes", () => {
    expect(parseHash("#/stock/SZ/300750")).toEqual({ section: "stock-detail", market: "SZ", code: "300750" });
    expect(parseHash("#/compare").section).toBe("compare");
  });

  it("persists watch groups and research notes in the browser", () => {
    const state = { activeGroupId: "one", groups: [{ id: "one", name: "测试组", codes: ["SZ:300750"] }] };
    saveWatchState(state);
    expect(loadWatchState()).toEqual(state);
    saveResearchNote({ code: "300750", market: "SZ", text: "跟踪订单", tags: ["新能源"], updated_at: "2026-01-01" });
    expect(loadNotes()[makeStockKey("300750", "SZ")].text).toBe("跟踪订单");
  });
});
