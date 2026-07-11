from __future__ import annotations

from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from threading import Lock
from typing import Any

from .. import database
from ..config import get_settings
from ..seed import THEMES
from .akshare_client import AkshareClient
from .analytics import (
    build_events,
    change_distribution,
    comparison_payload,
    market_temperature,
    slice_history,
    stock_analytics,
)
from .providers import FreeMarketProvider, normalize_code, normalize_symbol


_CACHE_LOCKS: defaultdict[str, Lock] = defaultdict(Lock)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class MarketService:
    def __init__(self, client: AkshareClient | None = None, provider: FreeMarketProvider | None = None) -> None:
        self.client = client or AkshareClient()
        self.provider = provider or FreeMarketProvider()
        self.ttl = get_settings().cache_ttl_seconds

    def _cached(self, key: str, loader, ttl_seconds: int | None = None):
        with _CACHE_LOCKS[key]:
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
        return self._cached("sectors:all", self.client.sectors, ttl_seconds=5 * 60)

    def news(self) -> tuple[list[dict[str, Any]], str, str]:
        return self._cached("news:all", self.client.news, ttl_seconds=3 * 60)

    def announcements(self) -> tuple[list[dict[str, Any]], str, str]:
        return self._cached("announcements:all", self.client.announcements, ttl_seconds=10 * 60)

    def stock_history(self, code: str) -> tuple[list[dict[str, Any]], str, str]:
        normalized, normalized_market = normalize_symbol(code)
        return self._cached(
            f"stock:history:{normalized_market}:{normalized}",
            lambda: self.client.stock_history(normalized),
            ttl_seconds=5 * 60,
        )

    def index_history(self, code: str) -> tuple[list[dict[str, Any]], str, str]:
        normalized = normalize_code(code)
        return self._cached(
            f"index:history:{normalized}",
            lambda: self.client.index_history(normalized),
            ttl_seconds=10 * 60,
        )

    def overview(self) -> dict[str, Any]:
        with ThreadPoolExecutor(max_workers=4) as executor:
            stocks_future = executor.submit(self.stocks)
            indices_future = executor.submit(self.indices)
            sectors_future = executor.submit(self.sectors)
            index_history_future = executor.submit(self.index_history, "000001")
            stocks, stock_source, stock_updated = stocks_future.result()
            indices, index_source, _ = indices_future.result()
            sectors, sector_source, _ = sectors_future.result()
            index_history, _, _ = index_history_future.result()
        up_count = sum(1 for item in stocks if item.get("change_pct", 0) > 0)
        down_count = sum(1 for item in stocks if item.get("change_pct", 0) < 0)
        flat_count = max(0, len(stocks) - up_count - down_count)
        total_amount = sum(float(item.get("amount") or 0) for item in stocks)
        hot_sectors = sorted(sectors, key=lambda item: (item.get("change_pct") or 0, item.get("amount") or 0), reverse=True)[:8]
        return {
            "updated_at": stock_updated,
            "source": f"{stock_source}; {index_source}; {sector_source}",
            "indices": indices,
            "index_history": index_history,
            "breadth": {"up": up_count, "down": down_count, "flat": flat_count, "total": len(stocks)},
            "total_amount": total_amount,
            "hot_sectors": hot_sectors,
            "market_temperature": market_temperature(stocks, sectors),
            "change_distribution": change_distribution(stocks),
            "themes": [{"key": key, **value} for key, value in THEMES.items()],
        }

    def get_index_history(self, code: str, days: int = 60) -> dict[str, Any]:
        rows, source, updated_at = self.index_history(code)
        return {
            "code": normalize_code(code),
            "items": slice_history(rows, days),
            "source": source,
            "updated_at": updated_at,
            "stale": source.startswith("seed") or "stale-cache" in source,
        }

    def get_stocks(
        self,
        q: str | None = None,
        theme: str | None = None,
        sector: str | None = None,
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
        if sector:
            sector_lower = sector.strip().lower()
            filtered = [item for item in filtered if sector_lower == str(item.get("sector", "")).lower()]
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

    def _profile(self, code: str, name: str = "", market: str = "") -> tuple[dict[str, Any], str, str]:
        normalized, normalized_market = normalize_symbol(code, market)
        return self._cached(
            f"stock:profile:{normalized_market}:{normalized}",
            lambda: self.provider.profile(normalized, name, normalized_market),
            ttl_seconds=60 * 60 * 12,
        )

    def resolve_stock(self, code: str, market: str = "") -> dict[str, Any]:
        normalized, normalized_market = normalize_symbol(code, market)
        payload, source, updated_at = self._cached(
            f"stock:resolve:{normalized_market}:{normalized}",
            lambda: (self._resolve_stock_uncached(normalized, normalized_market), "free-provider:resolve"),
        )
        payload["source"] = payload.get("source") or source
        payload["updated_at"] = payload.get("updated_at") or updated_at
        if isinstance(payload.get("quote"), dict):
            payload["quote"]["source"] = payload["quote"].get("source") or payload["source"]
            payload["quote"]["market"] = payload["quote"].get("market") or normalized_market
        return payload

    def _resolve_stock_uncached(self, code: str, market: str = "") -> dict[str, Any]:
        quote, quote_source = self.provider.quote(code, market)
        with ThreadPoolExecutor(max_workers=4) as executor:
            history_future = executor.submit(self.stock_history, code)
            profile_future = executor.submit(self._profile, code, quote.get("name", ""), market)
            news_future = executor.submit(self.news)
            announcements_future = executor.submit(self.announcements)
            history, history_source, _ = history_future.result()
            profile, profile_source, _ = profile_future.result()
            news, _, _ = news_future.result()
            announcements, _, _ = announcements_future.result()
        if quote.get("price") and history_source.startswith("seed") and not any(point.get("date") for point in history[-3:]):
            history = self.provider.synthetic_history(code, quote.get("price"), market)
        elif quote.get("price") and history_source.startswith("seed"):
            history = self.provider.synthetic_history(code, quote.get("price"), market)
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
            "events": build_events(related_news, related_announcements),
            "analytics": stock_analytics(history),
            "source": f"{quote_source}; {history_source}; {profile_source}",
            "updated_at": quote.get("updated_at") or now_iso(),
        }
        payload["quote"]["source"] = payload["quote"].get("source") or quote_source
        payload["quote"]["market"] = payload["quote"].get("market") or market
        return payload

    def stock_detail(self, code: str, market: str = "") -> dict[str, Any]:
        normalized, normalized_market = normalize_symbol(code, market)
        if normalized_market == "HK":
            return self.resolve_stock(normalized, normalized_market)
        stocks, source, updated_at = self.stocks()
        quote = next((item for item in stocks if item["code"] == normalized), None)
        if quote is None:
            resolved = self.resolve_stock(normalized, normalized_market)
            return resolved
        quote["market"] = quote.get("market") or normalized_market
        with ThreadPoolExecutor(max_workers=4) as executor:
            history_future = executor.submit(self.stock_history, normalized)
            profile_future = executor.submit(self._profile, normalized, quote.get("name", ""), normalized_market)
            news_future = executor.submit(self.news)
            announcements_future = executor.submit(self.announcements)
            history, history_source, _ = history_future.result()
            profile, profile_source, _ = profile_future.result()
            news, _, _ = news_future.result()
            announcements, _, _ = announcements_future.result()
        related_news = [
            item
            for item in news
            if item.get("theme") in {quote.get("theme"), "market"} or quote.get("name", "") in item.get("title", "")
        ][:8]
        related_announcements = [
            item for item in announcements if item.get("code") == normalized or item.get("name") == quote.get("name")
        ][:8]
        payload = {
            "quote": quote,
            "history": history,
            "profile": profile,
            "news": related_news,
            "announcements": related_announcements,
            "events": build_events(related_news, related_announcements),
            "analytics": stock_analytics(history),
            "source": f"{source}; {history_source}; {profile_source}",
            "updated_at": updated_at,
        }
        payload["quote"]["source"] = payload["quote"].get("source") or source
        return payload

    def detail_with_window(self, code: str, market: str = "", history_days: int = 120, resolve: bool = False) -> dict[str, Any]:
        detail = self.resolve_stock(code, market) if resolve else self.stock_detail(code, market)
        payload = dict(detail)
        full_history = detail.get("history") or []
        payload["history"] = slice_history(full_history, history_days)
        payload["analytics"] = stock_analytics(full_history)
        payload["events"] = detail.get("events") or build_events(
            detail.get("news") or [], detail.get("announcements") or []
        )
        return payload

    def compare(self, symbols: list[dict[str, str]], benchmark: str = "000300", window: int = 60) -> dict[str, Any]:
        stocks, stock_source, stock_updated = self.stocks()
        stock_by_code = {item.get("code", ""): item for item in stocks}

        def comparison_detail(symbol: dict[str, str]) -> dict[str, Any]:
            code, market = normalize_symbol(symbol.get("code", ""), symbol.get("market", ""))
            quote = dict(stock_by_code.get(code) or {}) if market != "HK" else {}
            quote_source = stock_source
            if not quote:
                quote, quote_source = self.provider.quote(code, market)
            quote["market"] = quote.get("market") or market
            history, history_source, history_updated = self.stock_history(code)
            if quote.get("price") and history_source.startswith("seed"):
                history = self.provider.synthetic_history(code, quote.get("price"), market)
            return {
                "quote": quote,
                "history": history,
                "source": f"{quote_source}; {history_source}",
                "updated_at": quote.get("updated_at") or history_updated or stock_updated,
            }

        sources: list[str] = []
        updated_values: list[str] = []
        with ThreadPoolExecutor(max_workers=min(6, len(symbols) + 1)) as executor:
            detail_futures = [executor.submit(comparison_detail, symbol) for symbol in symbols]
            benchmark_future = executor.submit(self.index_history, benchmark)
            details = [future.result() for future in detail_futures]
            benchmark_history, benchmark_source, benchmark_updated = benchmark_future.result()
        for detail in details:
            sources.append(str(detail.get("source", "")))
            updated_values.append(str(detail.get("updated_at", "")))
        result = comparison_payload(details, benchmark_history, normalize_code(benchmark), window)
        sources.append(benchmark_source)
        updated_values.append(benchmark_updated)
        result.update(
            {
                "source": "; ".join(source for source in sources if source),
                "updated_at": max((value for value in updated_values if value), default=now_iso()),
                "stale": any(
                    "seed" in source or "stale-cache" in source or "fallback" in source
                    for source in sources
                ),
            }
        )
        return result

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

    def get_news(
        self,
        theme: str | None = None,
        q: str | None = None,
        date_from: str | None = None,
        date_to: str | None = None,
    ) -> dict[str, Any]:
        rows, source, updated_at = self.news()
        filtered = rows
        if theme:
            filtered = [item for item in filtered if item.get("theme") in {theme, "market"}]
        if q:
            q_lower = q.lower()
            filtered = [item for item in filtered if q_lower in item.get("title", "").lower()]
        filtered = _filter_dates(filtered, date_from, date_to)
        return {"items": filtered[:80], "source": source, "updated_at": updated_at}

    def get_announcements(
        self,
        code: str | None = None,
        q: str | None = None,
        announcement_type: str | None = None,
        date_from: str | None = None,
        date_to: str | None = None,
    ) -> dict[str, Any]:
        rows, source, updated_at = self.announcements()
        filtered = rows
        if code:
            filtered = [item for item in filtered if item.get("code") == code.zfill(6)]
        if q:
            q_lower = q.lower()
            filtered = [item for item in filtered if q_lower in item.get("title", "").lower() or q_lower in item.get("name", "").lower()]
        if announcement_type:
            type_lower = announcement_type.lower()
            filtered = [item for item in filtered if type_lower in str(item.get("type", "")).lower()]
        filtered = _filter_dates(filtered, date_from, date_to)
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


def _filter_dates(
    rows: list[dict[str, Any]], date_from: str | None, date_to: str | None
) -> list[dict[str, Any]]:
    if not date_from and not date_to:
        return rows
    result: list[dict[str, Any]] = []
    for row in rows:
        value = str(row.get("published_at", ""))[:10]
        if date_from and value and value < date_from:
            continue
        if date_to and value and value > date_to:
            continue
        result.append(row)
    return result
