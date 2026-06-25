from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from .. import database
from ..config import get_settings
from ..seed import THEMES
from .akshare_client import AkshareClient
from .providers import FreeMarketProvider, normalize_code


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class MarketService:
    def __init__(self, client: AkshareClient | None = None, provider: FreeMarketProvider | None = None) -> None:
        self.client = client or AkshareClient()
        self.provider = provider or FreeMarketProvider()
        self.ttl = get_settings().cache_ttl_seconds

    def _cached(self, key: str, loader, ttl_seconds: int | None = None):
        ttl = self.ttl if ttl_seconds is None else ttl_seconds
        cached = database.get_cache(key)
        if cached:
            try:
                updated = datetime.fromisoformat(cached["updated_at"])
                age = (datetime.now(timezone.utc) - updated).total_seconds()
                if age <= ttl:
                    return cached["payload"], cached["source"], cached["updated_at"]
            except ValueError:
                pass
        try:
            payload, source = loader()
        except Exception:
            if cached:
                payload = _mark_stale(cached["payload"], True)
                return payload, f"{cached['source']}; stale-cache", cached["updated_at"]
            raise
        payload = _mark_stale(payload, source.startswith("seed"))
        database.set_cache(key, payload, source)
        fresh = database.get_cache(key)
        return fresh["payload"], fresh["source"], fresh["updated_at"]

    def stocks(self) -> tuple[list[dict[str, Any]], str, str]:
        return self._cached("stocks:spot", self.client.stock_spot)

    def indices(self) -> tuple[list[dict[str, Any]], str, str]:
        return self._cached("indices:spot", self.client.index_spot)

    def sectors(self) -> tuple[list[dict[str, Any]], str, str]:
        return self._cached("sectors:all", self.client.sectors)

    def news(self) -> tuple[list[dict[str, Any]], str, str]:
        return self._cached("news:all", self.client.news)

    def announcements(self) -> tuple[list[dict[str, Any]], str, str]:
        return self._cached("announcements:all", self.client.announcements)

    def overview(self) -> dict[str, Any]:
        stocks, stock_source, stock_updated = self.stocks()
        indices, index_source, _ = self.indices()
        sectors, sector_source, _ = self.sectors()
        up_count = sum(1 for item in stocks if item.get("change_pct", 0) > 0)
        down_count = sum(1 for item in stocks if item.get("change_pct", 0) < 0)
        flat_count = max(0, len(stocks) - up_count - down_count)
        total_amount = sum(float(item.get("amount") or 0) for item in stocks)
        hot_sectors = sorted(sectors, key=lambda item: (item.get("change_pct") or 0, item.get("amount") or 0), reverse=True)[:8]
        index_history: list[dict[str, Any]] = []
        if indices:
            index_history, _ = self.client.index_history(indices[0]["code"])
        return {
            "updated_at": stock_updated,
            "source": f"{stock_source}; {index_source}; {sector_source}",
            "indices": indices,
            "index_history": index_history,
            "breadth": {"up": up_count, "down": down_count, "flat": flat_count, "total": len(stocks)},
            "total_amount": total_amount,
            "hot_sectors": hot_sectors,
            "themes": [{"key": key, **value} for key, value in THEMES.items()],
        }

    def get_stocks(
        self,
        q: str | None = None,
        theme: str | None = None,
        sort: str = "change_pct",
        order: str = "desc",
        page: int = 1,
        page_size: int = 30,
    ) -> dict[str, Any]:
        rows, source, updated_at = self.stocks()
        filtered = rows
        if q:
            q_lower = q.strip().lower()
            filtered = [item for item in filtered if q_lower in item.get("code", "").lower() or q_lower in item.get("name", "").lower()]
        if theme:
            filtered = [item for item in filtered if item.get("theme") == theme]
        reverse = order.lower() != "asc"
        filtered = sorted(filtered, key=lambda item: _sort_value(item, sort), reverse=reverse)
        total = len(filtered)
        page = max(1, page)
        page_size = min(max(1, page_size), 100)
        start = (page - 1) * page_size
        return {"items": filtered[start : start + page_size], "total": total, "page": page, "page_size": page_size, "source": source, "updated_at": updated_at}

    def search_stocks(self, q: str) -> dict[str, Any]:
        rows = self.provider.search_stocks(q)
        return {"items": rows, "source": "free-provider:search", "updated_at": now_iso()}

    def _profile(self, code: str, name: str = "") -> tuple[dict[str, Any], str, str]:
        normalized = normalize_code(code)
        return self._cached(
            f"stock:profile:{normalized}",
            lambda: self.provider.profile(normalized, name),
            ttl_seconds=60 * 60 * 12,
        )

    def resolve_stock(self, code: str) -> dict[str, Any]:
        normalized = normalize_code(code)
        payload, source, updated_at = self._cached(
            f"stock:resolve:{normalized}",
            lambda: (self._resolve_stock_uncached(normalized), "free-provider:resolve"),
        )
        payload["source"] = payload.get("source") or source
        payload["updated_at"] = payload.get("updated_at") or updated_at
        if isinstance(payload.get("quote"), dict):
            payload["quote"]["source"] = payload["quote"].get("source") or payload["source"]
        return payload

    def _resolve_stock_uncached(self, code: str) -> dict[str, Any]:
        quote, quote_source = self.provider.quote(code)
        history, history_source = self.client.stock_history(code)
        if quote.get("price") and history_source.startswith("seed") and not any(point.get("date") for point in history[-3:]):
            history = self.provider.synthetic_history(code, quote.get("price"))
        elif quote.get("price") and history_source.startswith("seed"):
            history = self.provider.synthetic_history(code, quote.get("price"))
        profile, profile_source, _ = self._profile(code, quote.get("name", ""))
        news, _, _ = self.news()
        announcements, _, _ = self.announcements()
        related_news = [
            item
            for item in news
            if item.get("theme") in {quote.get("theme"), "market"} or quote.get("name", "") in item.get("title", "")
        ][:8]
        related_announcements = [
            item for item in announcements if item.get("code") == code or item.get("name") == quote.get("name")
        ][:8]
        payload = {
            "quote": quote,
            "history": history,
            "profile": profile,
            "news": related_news,
            "announcements": related_announcements,
            "source": f"{quote_source}; {history_source}; {profile_source}",
            "updated_at": quote.get("updated_at") or now_iso(),
        }
        payload["quote"]["source"] = payload["quote"].get("source") or quote_source
        return payload

    def stock_detail(self, code: str) -> dict[str, Any]:
        stocks, source, updated_at = self.stocks()
        quote = next((item for item in stocks if item["code"] == code), None)
        if quote is None:
            resolved = self.resolve_stock(code)
            return resolved
        history, history_source = self.client.stock_history(code)
        profile, profile_source, _ = self._profile(code, quote.get("name", ""))
        news, _, _ = self.news()
        announcements, _, _ = self.announcements()
        related_news = [
            item
            for item in news
            if item.get("theme") in {quote.get("theme"), "market"} or quote.get("name", "") in item.get("title", "")
        ][:8]
        related_announcements = [
            item for item in announcements if item.get("code") == code or item.get("name") == quote.get("name")
        ][:8]
        payload = {
            "quote": quote,
            "history": history,
            "profile": profile,
            "news": related_news,
            "announcements": related_announcements,
            "source": f"{source}; {history_source}; {profile_source}",
            "updated_at": updated_at,
        }
        payload["quote"]["source"] = payload["quote"].get("source") or source
        return payload

    def get_sectors(self, theme: str | None = None) -> dict[str, Any]:
        rows, source, updated_at = self.sectors()
        filtered = [item for item in rows if not theme or item.get("theme") == theme]
        filtered = sorted(filtered, key=lambda item: (item.get("change_pct") or 0, item.get("amount") or 0), reverse=True)
        return {"items": filtered, "source": source, "updated_at": updated_at}

    def ranking(self, ranking_type: str) -> dict[str, Any]:
        stocks, source, updated_at = self.stocks()
        sectors, sector_source, _ = self.sectors()
        if ranking_type == "losers":
            items = sorted(stocks, key=lambda item: item.get("change_pct") or 0)[:30]
        elif ranking_type == "turnover":
            items = sorted(stocks, key=lambda item: item.get("amount") or 0, reverse=True)[:30]
        elif ranking_type == "volume_ratio":
            items = sorted(stocks, key=lambda item: item.get("volume_ratio") or 0, reverse=True)[:30]
        elif ranking_type == "hot_sector":
            items = sorted(sectors, key=lambda item: (item.get("change_pct") or 0, item.get("amount") or 0), reverse=True)[:30]
            source = sector_source
        else:
            items = sorted(stocks, key=lambda item: item.get("change_pct") or 0, reverse=True)[:30]
        return {"type": ranking_type, "items": items, "source": source, "updated_at": updated_at}

    def get_news(self, theme: str | None = None, q: str | None = None) -> dict[str, Any]:
        rows, source, updated_at = self.news()
        filtered = rows
        if theme:
            filtered = [item for item in filtered if item.get("theme") in {theme, "market"}]
        if q:
            q_lower = q.lower()
            filtered = [item for item in filtered if q_lower in item.get("title", "").lower()]
        return {"items": filtered[:80], "source": source, "updated_at": updated_at}

    def get_announcements(self, code: str | None = None, q: str | None = None) -> dict[str, Any]:
        rows, source, updated_at = self.announcements()
        filtered = rows
        if code:
            filtered = [item for item in filtered if item.get("code") == code.zfill(6)]
        if q:
            q_lower = q.lower()
            filtered = [item for item in filtered if q_lower in item.get("title", "").lower() or q_lower in item.get("name", "").lower()]
        return {"items": filtered[:80], "source": source, "updated_at": updated_at}


def _sort_value(item: dict[str, Any], key: str) -> Any:
    value = item.get(key)
    if value is None:
        return 0
    return value


def _mark_stale(payload: Any, stale: bool) -> Any:
    if isinstance(payload, list):
        return [_mark_stale(item, stale) if isinstance(item, dict) else item for item in payload]
    if isinstance(payload, dict):
        marked = dict(payload)
        if "items" in marked and isinstance(marked["items"], list):
            marked["items"] = [_mark_stale(item, stale) if isinstance(item, dict) else item for item in marked["items"]]
        elif "quote" in marked and isinstance(marked["quote"], dict):
            marked["quote"] = {**marked["quote"], "stale": stale or marked["quote"].get("stale", False)}
        else:
            marked.setdefault("stale", stale)
        return marked
    return payload
