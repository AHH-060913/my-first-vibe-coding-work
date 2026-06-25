from __future__ import annotations

from datetime import date
from typing import Any

import pandas as pd

from ..config import get_settings
from ..seed import SEED_ANNOUNCEMENTS, SEED_INDICES, SEED_NEWS, SEED_SECTORS, SEED_STOCKS, THEMES, seed_history, seed_index_history
from .normalizers import normalize_history, normalize_index_spot, normalize_sector, normalize_stock_spot


class AkshareClient:
    def __init__(self) -> None:
        self.settings = get_settings()

    @property
    def live_enabled(self) -> bool:
        return self.settings.data_mode.lower() in {"live", "auto"}

    def _load_akshare(self):
        import akshare as ak

        return ak

    def stock_spot(self) -> tuple[list[dict[str, Any]], str]:
        if self.live_enabled:
            try:
                ak = self._load_akshare()
                rows = normalize_stock_spot(ak.stock_zh_a_spot_em())
                if rows:
                    return self._enrich_theme(rows), "akshare:stock_zh_a_spot_em"
            except Exception:
                if self.settings.data_mode.lower() == "live":
                    raise
        return list(SEED_STOCKS), "seed:stock_spot"

    def index_spot(self) -> tuple[list[dict[str, Any]], str]:
        if self.live_enabled:
            try:
                ak = self._load_akshare()
                rows = normalize_index_spot(ak.stock_zh_index_spot_em(symbol="沪深重要指数"))
                if rows:
                    return rows, "akshare:stock_zh_index_spot_em"
            except Exception:
                if self.settings.data_mode.lower() == "live":
                    raise
        return list(SEED_INDICES), "seed:index_spot"

    def stock_history(self, code: str) -> tuple[list[dict[str, Any]], str]:
        if self.live_enabled:
            try:
                ak = self._load_akshare()
                rows = normalize_history(ak.stock_zh_a_hist(symbol=code, period="daily", start_date="20240101", adjust="qfq"))
                if rows:
                    return rows[-180:], "akshare:stock_zh_a_hist"
            except Exception:
                if self.settings.data_mode.lower() == "live":
                    raise
        return seed_history(code), "seed:stock_history"

    def index_history(self, code: str) -> tuple[list[dict[str, Any]], str]:
        if self.live_enabled:
            try:
                ak = self._load_akshare()
                raw = ak.stock_zh_index_daily_em(symbol=code, start_date="20240101")
                df = pd.DataFrame(raw)
                rows = []
                for item in df.to_dict(orient="records"):
                    rows.append(
                        {
                            "date": str(item.get("date") or item.get("日期"))[:10],
                            "close": float(item.get("close") or item.get("收盘") or 0),
                            "amount": float(item.get("amount") or item.get("成交额") or 0),
                        }
                    )
                if rows:
                    return rows[-120:], "akshare:stock_zh_index_daily_em"
            except Exception:
                if self.settings.data_mode.lower() == "live":
                    raise
        return seed_index_history(code), "seed:index_history"

    def sectors(self) -> tuple[list[dict[str, Any]], str]:
        if self.live_enabled:
            try:
                ak = self._load_akshare()
                industry = normalize_sector(ak.stock_board_industry_name_em(), self._theme_by_board())
                concept = normalize_sector(ak.stock_board_concept_name_em(), self._theme_by_board())
                rows = [row for row in industry + concept if row["theme"]]
                if rows:
                    return rows, "akshare:stock_board_industry_name_em+stock_board_concept_name_em"
            except Exception:
                if self.settings.data_mode.lower() == "live":
                    raise
        return list(SEED_SECTORS), "seed:sectors"

    def news(self) -> tuple[list[dict[str, Any]], str]:
        if self.live_enabled:
            try:
                ak = self._load_akshare()
                rows: list[dict[str, Any]] = []
                raw = ak.stock_news_main_cx()
                for item in raw.head(60).to_dict(orient="records"):
                    title = str(item.get("标题") or item.get("title") or "")
                    rows.append(
                        {
                            "title": title,
                            "source": str(item.get("来源") or item.get("source") or "财新/AKShare"),
                            "published_at": str(item.get("发布时间") or item.get("时间") or ""),
                            "theme": self._infer_theme(title),
                            "url": str(item.get("链接") or item.get("url") or ""),
                        }
                    )
                if rows:
                    return rows, "akshare:stock_news_main_cx"
            except Exception:
                if self.settings.data_mode.lower() == "live":
                    raise
        return list(SEED_NEWS), "seed:news"

    def announcements(self) -> tuple[list[dict[str, Any]], str]:
        if self.live_enabled:
            try:
                ak = self._load_akshare()
                today = date.today().strftime("%Y%m%d")
                raw = ak.stock_notice_report(symbol="全部", date=today)
                rows = []
                for item in raw.head(80).to_dict(orient="records"):
                    title = str(item.get("公告标题") or item.get("标题") or "")
                    code = str(item.get("代码") or item.get("证券代码") or "").zfill(6)
                    rows.append(
                        {
                            "code": code,
                            "name": str(item.get("名称") or item.get("证券简称") or ""),
                            "title": title,
                            "type": str(item.get("公告类型") or item.get("类型") or "公告"),
                            "published_at": str(item.get("公告日期") or item.get("日期") or ""),
                            "url": str(item.get("公告链接") or item.get("链接") or ""),
                        }
                    )
                if rows:
                    return rows, "akshare:stock_notice_report"
            except Exception:
                if self.settings.data_mode.lower() == "live":
                    raise
        return list(SEED_ANNOUNCEMENTS), "seed:announcements"

    def _theme_by_board(self) -> dict[str, str]:
        mapping: dict[str, str] = {}
        for theme_key, theme in THEMES.items():
            for board in theme["boards"]:
                mapping[board] = theme_key
        return mapping

    def _infer_theme(self, text: str) -> str:
        for theme_key, theme in THEMES.items():
            if any(keyword.lower() in text.lower() for keyword in theme["keywords"]):
                return theme_key
        return "market"

    def _enrich_theme(self, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        seed_by_code = {item["code"]: item for item in SEED_STOCKS}
        for row in rows:
            seed = seed_by_code.get(row["code"])
            if seed:
                row["theme"] = seed["theme"]
                row["sector"] = seed["sector"]
        return rows
