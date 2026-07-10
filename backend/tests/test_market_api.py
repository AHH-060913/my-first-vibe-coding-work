from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_market_overview_has_required_fields() -> None:
    response = client.get("/api/market/overview")
    assert response.status_code == 200
    data = response.json()
    assert data["indices"]
    assert data["breadth"]["total"] > 0
    assert "source" in data


def test_stock_search_and_detail() -> None:
    response = client.get("/api/stocks", params={"q": "宁德", "page_size": 5})
    assert response.status_code == 200
    items = response.json()["items"]
    assert any(item["code"] == "300750" for item in items)

    detail = client.get("/api/stocks/300750")
    assert detail.status_code == 200
    payload = detail.json()
    assert payload["quote"]["code"] == "300750"
    assert payload["history"]
    assert payload["predictions"]

    comparison_detail = client.get("/api/stocks/300750", params={"include_predictions": "false"})
    assert comparison_detail.status_code == 200
    assert comparison_detail.json()["predictions"] == []


def test_rankings_and_predictions_shape() -> None:
    rankings = client.get("/api/rankings", params={"type": "gainers"})
    assert rankings.status_code == 200
    assert rankings.json()["items"]

    predictions = client.get("/api/predictions", params={"theme": "tech", "horizon": 3})
    assert predictions.status_code == 200
    item = predictions.json()["items"][0]
    assert 0 <= item["up_probability"] <= 1
    assert item["factors"]


def test_watchlist_round_trip() -> None:
    created = client.post("/api/watchlist", json={"code": "688981"})
    assert created.status_code == 200
    listed = client.get("/api/watchlist")
    assert "688981" in listed.json()["codes"]
    deleted = client.delete("/api/watchlist/688981")
    assert deleted.status_code == 200
