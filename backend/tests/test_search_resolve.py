from __future__ import annotations

from app.services.market import MarketService
from app.services.providers import normalize_symbol


class FakeClient:
    def stock_history(self, code: str):
        return ([{"date": "2026-06-25", "close": 10.2, "amount": 1000000}], "fake:history")

    def news(self):
        return ([{"title": "测试公司行业景气改善", "theme": "market", "source": "fake", "published_at": "2026-06-25", "url": ""}], "fake:news")

    def announcements(self):
        return ([{"code": "123456", "name": "测试股份", "title": "测试公告", "type": "公告", "published_at": "2026-06-25", "url": ""}], "fake:announcements")


class FakeProvider:
    def search_stocks(self, query: str, limit: int = 12):
        return [{"code": "123456", "name": "测试股份", "market": "SH", "source": "fake:search"}]

    def quote(self, code: str, market: str = ""):
        return (
            {
                "code": code,
                "name": "测试股份",
                "price": 10.2,
                "change_pct": 1.2,
                "amount": 120000000,
                "turnover_rate": 1.1,
                "volume_ratio": 1.0,
                "pe": 18,
                "pb": 2,
                "market_cap": 10000000000,
                "theme": "market",
                "sector": "测试行业",
                "updated_at": "2026-06-25 15:00:00",
            },
            "fake:quote",
        )

    def profile(self, code: str, name: str = "", market: str = ""):
        return (
            {
                "code": code,
                "name": name,
                "full_name": "测试股份有限公司",
                "listing_date": "2020-01-01",
                "region": "上海",
                "industry": "测试行业",
                "main_business": "测试主营业务",
                "business_scope": "测试经营范围",
                "website": "https://example.com",
                "total_shares": 1,
                "float_shares": 1,
                "source": "fake:profile",
                "updated_at": "2026-06-25",
                "stale": False,
            },
            "fake:profile",
        )

    def synthetic_history(self, code: str, price: float | None = None, market: str = ""):
        return [{"date": "2026-06-25", "close": price or 10}]


def test_search_stocks_uses_provider() -> None:
    service = MarketService(client=FakeClient(), provider=FakeProvider())
    payload = service.search_stocks("测试")
    assert payload["items"][0]["code"] == "123456"
    assert payload["items"][0]["source"] == "fake:search"


def test_normalize_symbol_keeps_hk_codes() -> None:
    assert normalize_symbol("01810") == ("01810", "HK")
    assert normalize_symbol("HK01810") == ("01810", "HK")
    assert normalize_symbol("300308") == ("300308", "SZ")


def test_resolve_stock_contains_quote_profile_and_related_content() -> None:
    service = MarketService(client=FakeClient(), provider=FakeProvider())
    payload = service._resolve_stock_uncached("123456")
    assert payload["quote"]["name"] == "测试股份"
    assert payload["profile"]["main_business"] == "测试主营业务"
    assert payload["history"]
    assert "announcements" in payload
