from __future__ import annotations

from typing import Any

import pandas as pd


def safe_float(value: Any, default: float = 0.0) -> float:
    if value is None or value == "-":
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def safe_int(value: Any, default: int = 0) -> int:
    if value is None or value == "-":
        return default
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


def normalize_stock_spot(df: pd.DataFrame) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for raw in df.to_dict(orient="records"):
        code = str(raw.get("代码") or raw.get("证券代码") or raw.get("code") or "").zfill(6)
        if not code.strip("0"):
            continue
        rows.append(
            {
                "code": code,
                "name": str(raw.get("名称") or raw.get("证券简称") or raw.get("name") or code),
                "price": safe_float(raw.get("最新价") or raw.get("最新")),
                "change_pct": safe_float(raw.get("涨跌幅")),
                "change": safe_float(raw.get("涨跌额")),
                "volume": safe_int(raw.get("成交量")),
                "amount": safe_float(raw.get("成交额")),
                "amplitude": safe_float(raw.get("振幅")),
                "high": safe_float(raw.get("最高")),
                "low": safe_float(raw.get("最低")),
                "open": safe_float(raw.get("今开")),
                "previous_close": safe_float(raw.get("昨收")),
                "volume_ratio": safe_float(raw.get("量比")),
                "turnover_rate": safe_float(raw.get("换手率")),
                "pe": safe_float(raw.get("市盈率-动态") or raw.get("市盈率")),
                "pb": safe_float(raw.get("市净率")),
                "market_cap": safe_float(raw.get("总市值")),
                "float_market_cap": safe_float(raw.get("流通市值")),
                "speed": safe_float(raw.get("涨速")),
                "sector": str(raw.get("sector") or ""),
                "theme": str(raw.get("theme") or ""),
            }
        )
    return rows


def normalize_index_spot(df: pd.DataFrame) -> list[dict[str, Any]]:
    wanted = {"000001", "399001", "399006", "000688", "000300", "000905", "000852"}
    rows: list[dict[str, Any]] = []
    for raw in df.to_dict(orient="records"):
        code = str(raw.get("代码") or raw.get("指数代码") or raw.get("symbol") or "").zfill(6)
        if code not in wanted:
            continue
        price = safe_float(raw.get("最新价") or raw.get("最新点位") or raw.get("点位") or raw.get("close"))
        rows.append(
            {
                "code": code,
                "name": str(raw.get("名称") or raw.get("指数名称") or raw.get("name") or code),
                "price": price,
                "change_pct": safe_float(raw.get("涨跌幅") or raw.get("涨幅")),
                "amount": safe_float(raw.get("成交额") or raw.get("amount")),
            }
        )
    return rows


def normalize_sector(df: pd.DataFrame, theme_by_name: dict[str, str]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for raw in df.to_dict(orient="records"):
        name = str(raw.get("板块名称") or raw.get("名称") or raw.get("name") or "")
        if not name:
            continue
        rows.append(
            {
                "name": name,
                "theme": theme_by_name.get(name, ""),
                "change_pct": safe_float(raw.get("涨跌幅")),
                "amount": safe_float(raw.get("成交额")),
                "turnover_rate": safe_float(raw.get("换手率")),
                "up_count": safe_int(raw.get("上涨家数")),
                "down_count": safe_int(raw.get("下跌家数")),
                "leader": str(raw.get("领涨股票") or ""),
                "leader_change_pct": safe_float(raw.get("领涨股票-涨跌幅")),
            }
        )
    return rows


def normalize_history(df: pd.DataFrame) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for raw in df.to_dict(orient="records"):
        date_value = raw.get("日期") or raw.get("date")
        if date_value is None:
            continue
        rows.append(
            {
                "date": str(date_value)[:10],
                "open": safe_float(raw.get("开盘")),
                "close": safe_float(raw.get("收盘")),
                "high": safe_float(raw.get("最高")),
                "low": safe_float(raw.get("最低")),
                "volume": safe_int(raw.get("成交量")),
                "amount": safe_float(raw.get("成交额")),
                "change_pct": safe_float(raw.get("涨跌幅")),
                "turnover_rate": safe_float(raw.get("换手率")),
            }
        )
    return rows
