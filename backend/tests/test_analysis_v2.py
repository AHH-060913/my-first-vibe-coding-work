from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app
from app.services.analytics import change_distribution, market_temperature, stock_analytics


client = TestClient(app)


def test_market_derivatives_are_deterministic() -> None:
    stocks = [
        {"change_pct": -6, "volume_ratio": 0.8},
        {"change_pct": -2, "volume_ratio": 1.0},
        {"change_pct": 0.5, "volume_ratio": 1.2},
        {"change_pct": 4, "volume_ratio": 1.4},
    ]
    sectors = [{"change_pct": 1}, {"change_pct": -1}]
    distribution = change_distribution(stocks)
    temperature = market_temperature(stocks, sectors)
    assert sum(bucket["count"] for bucket in distribution) == len(stocks)
    assert 0 <= temperature["score"] <= 100
    assert set(temperature["components"]) == {"breadth", "momentum", "sector_strength", "activity"}


def test_stock_analytics_only_uses_available_history() -> None:
    history = [
        {"date": f"2026-01-{index:02d}", "close": 100 + index, "amount": 1_000_000 + index * 10_000}
        for index in range(1, 22)
    ]
    analytics = stock_analytics(history)
    assert analytics["sample_size"] == 21
    assert analytics["return_5d"] is not None
    assert analytics["return_20d"] is not None
    assert analytics["max_drawdown"] == 0


def test_v2_overview_detail_and_index_history() -> None:
    overview = client.get("/api/market/overview")
    assert overview.status_code == 200
    overview_data = overview.json()
    assert overview_data["market_temperature"]["label"]
    assert sum(item["count"] for item in overview_data["change_distribution"]) == overview_data["breadth"]["total"]

    detail = client.get("/api/stocks/300750", params={"history_days": 60, "include_predictions": "false"})
    assert detail.status_code == 200
    detail_data = detail.json()
    assert len(detail_data["history"]) <= 60
    assert detail_data["analytics"]["sample_size"] >= len(detail_data["history"])
    assert isinstance(detail_data["events"], list)

    history = client.get("/api/market/indices/000300/history", params={"days": 20})
    assert history.status_code == 200
    assert 0 < len(history.json()["items"]) <= 20


def test_batch_compare_aligns_series_and_returns_metrics() -> None:
    response = client.post(
        "/api/analysis/compare",
        json={
            "symbols": [
                {"code": "300750", "market": "SZ"},
                {"code": "300308", "market": "SZ"},
            ],
            "benchmark": "000300",
            "window": 60,
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert len(payload["series"]) == 2
    assert len(payload["metrics"]) == 2
    assert payload["benchmark"]["values"]
    assert len(payload["correlation"]["values"]) == 2
    assert "source" in payload

    invalid = client.post(
        "/api/analysis/compare",
        json={"symbols": [{"code": "300750", "market": "SZ"}]},
    )
    assert invalid.status_code == 422


def test_prediction_horizons_and_content_filters() -> None:
    predictions = client.get("/api/predictions", params={"code": "300750", "horizons": "1,3,5"})
    assert predictions.status_code == 200
    assert {item["horizon"] for item in predictions.json()["items"]} == {1, 3, 5}

    announcements = client.get("/api/announcements", params={"type": "重大合同", "date_from": "2026-01-01"})
    assert announcements.status_code == 200
    assert all("重大合同" in item["type"] for item in announcements.json()["items"])
