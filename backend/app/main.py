from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

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


class CompareSymbol(BaseModel):
    code: str
    market: str = ""


class CompareRequest(BaseModel):
    symbols: list[CompareSymbol] = Field(min_length=2, max_length=5)
    benchmark: str = "000300"
    window: int = Field(default=60, ge=20, le=120)


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
    sector: str | None = None,
    sort: str = "change_pct",
    order: str = "desc",
    page: int = Query(1, ge=1),
    page_size: int = Query(30, ge=1, le=100),
) -> dict[str, Any]:
    return market_service().get_stocks(q=q, theme=theme, sector=sector, sort=sort, order=order, page=page, page_size=page_size)


@app.get("/api/search/stocks")
def search_stocks(q: str = Query("", min_length=1)) -> dict[str, Any]:
    return market_service().search_stocks(q)


@app.get("/api/market/indices/{code}/history")
def index_history(code: str, days: int = Query(60, ge=20, le=120)) -> dict[str, Any]:
    return market_service().get_index_history(code, days)


@app.get("/api/stocks/{code}")
def stock_detail(
    code: str,
    market: str = "",
    include_predictions: bool = True,
    history_days: int = Query(120, ge=20, le=180),
) -> dict[str, Any]:
    normalized, normalized_market = normalize_symbol(code, market)
    detail = market_service().detail_with_window(normalized, normalized_market, history_days)
    detail["predictions"] = (
        prediction_service().prediction_for_detail(detail)["items"] if include_predictions else []
    )
    return detail


@app.get("/api/stocks/{code}/resolve")
def resolve_stock(
    code: str,
    market: str = "",
    include_predictions: bool = True,
    history_days: int = Query(120, ge=20, le=180),
) -> dict[str, Any]:
    normalized, normalized_market = normalize_symbol(code, market)
    detail = market_service().detail_with_window(normalized, normalized_market, history_days, resolve=True)
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


@app.post("/api/analysis/compare")
def compare_stocks(request: CompareRequest) -> dict[str, Any]:
    return market_service().compare(
        [symbol.model_dump() for symbol in request.symbols],
        benchmark=request.benchmark,
        window=request.window,
    )


@app.get("/api/news")
def news(
    theme: str | None = None,
    q: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> dict[str, Any]:
    return market_service().get_news(theme=theme, q=q, date_from=date_from, date_to=date_to)


@app.get("/api/announcements")
def announcements(
    code: str | None = None,
    q: str | None = None,
    type: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> dict[str, Any]:
    return market_service().get_announcements(
        code=code,
        q=q,
        announcement_type=type,
        date_from=date_from,
        date_to=date_to,
    )


@app.get("/api/predictions")
def predictions(
    code: str | None = None,
    theme: str | None = None,
    market: str = "",
    horizon: int = Query(3, ge=1, le=5),
    horizons: str | None = None,
) -> dict[str, Any]:
    parsed_horizons = None
    if horizons:
        parsed_horizons = [int(value) for value in horizons.split(",") if value.strip().isdigit()]
    return prediction_service().predictions(
        code=code,
        theme=theme,
        market=market,
        horizon=horizon,
        horizons=parsed_horizons,
    )


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
