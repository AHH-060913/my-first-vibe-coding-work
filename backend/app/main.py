from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .config import get_settings
from .database import add_watchlist, init_db, list_watchlist, remove_watchlist
from .services.market import MarketService
from .services.prediction import PredictionService
from .services.providers import normalize_symbol

settings = get_settings()
_market_service = MarketService()
_prediction_service = PredictionService(_market_service)


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class WatchlistItem(BaseModel):
    code: str


def market_service() -> MarketService:
    return _market_service


def prediction_service() -> PredictionService:
    return _prediction_service


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {"status": "ok", "data_mode": settings.data_mode, "app": settings.app_name}


@app.get("/api/market/overview")
def market_overview() -> dict[str, Any]:
    return market_service().overview()


@app.get("/api/stocks")
def stocks(
    q: str | None = None,
    theme: str | None = None,
    sort: str = "change_pct",
    order: str = "desc",
    page: int = Query(1, ge=1),
    page_size: int = Query(30, ge=1, le=100),
) -> dict[str, Any]:
    return market_service().get_stocks(q=q, theme=theme, sort=sort, order=order, page=page, page_size=page_size)


@app.get("/api/search/stocks")
def search_stocks(q: str = Query("", min_length=1)) -> dict[str, Any]:
    return market_service().search_stocks(q)


@app.get("/api/stocks/{code}")
def stock_detail(code: str, market: str = "", include_predictions: bool = True) -> dict[str, Any]:
    normalized, normalized_market = normalize_symbol(code, market)
    detail = market_service().stock_detail(normalized, normalized_market)
    detail["predictions"] = (
        prediction_service().prediction_for_detail(detail)["items"] if include_predictions else []
    )
    return detail


@app.get("/api/stocks/{code}/resolve")
def resolve_stock(code: str, market: str = "", include_predictions: bool = True) -> dict[str, Any]:
    normalized, normalized_market = normalize_symbol(code, market)
    detail = market_service().resolve_stock(normalized, normalized_market)
    detail["predictions"] = (
        prediction_service().prediction_for_detail(detail)["items"] if include_predictions else []
    )
    return detail


@app.get("/api/sectors")
def sectors(theme: str | None = None) -> dict[str, Any]:
    return market_service().get_sectors(theme=theme)


@app.get("/api/rankings")
def rankings(type: str = "gainers") -> dict[str, Any]:
    if type == "model_score":
        return prediction_service().ranking()
    return market_service().ranking(type)


@app.get("/api/news")
def news(theme: str | None = None, q: str | None = None) -> dict[str, Any]:
    return market_service().get_news(theme=theme, q=q)


@app.get("/api/announcements")
def announcements(code: str | None = None, q: str | None = None) -> dict[str, Any]:
    return market_service().get_announcements(code=code, q=q)


@app.get("/api/predictions")
def predictions(code: str | None = None, theme: str | None = None, horizon: int = Query(3, ge=1, le=5)) -> dict[str, Any]:
    return prediction_service().predictions(code=code, theme=theme, horizon=horizon)


@app.get("/api/watchlist")
def get_watchlist() -> dict[str, Any]:
    codes = list_watchlist()
    stocks_payload = market_service().get_stocks(page_size=100)
    by_code = {item["code"]: item for item in stocks_payload["items"]}
    return {
        "codes": codes,
        "items": [by_code[code] for code in codes if code in by_code],
        "source": stocks_payload["source"],
        "updated_at": stocks_payload["updated_at"],
    }


@app.post("/api/watchlist")
def create_watchlist_item(item: WatchlistItem) -> dict[str, Any]:
    code = item.code.zfill(6)
    if not code.isdigit() or len(code) != 6:
        raise HTTPException(status_code=400, detail="code must be a 6 digit A-share code")
    add_watchlist(code)
    return {"ok": True, "code": code}


@app.delete("/api/watchlist/{code}")
def delete_watchlist_item(code: str) -> dict[str, Any]:
    remove_watchlist(code.zfill(6))
    return {"ok": True, "code": code.zfill(6)}
