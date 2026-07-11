from __future__ import annotations

from math import sqrt
from statistics import mean, pstdev
from typing import Any


def number(value: Any, default: float = 0.0) -> float:
    try:
        parsed = float(value)
        return parsed if parsed == parsed else default
    except (TypeError, ValueError):
        return default


def slice_history(history: list[dict[str, Any]], days: int) -> list[dict[str, Any]]:
    clean = [row for row in history if row.get("date") and number(row.get("close")) > 0]
    return clean[-max(1, days) :]


def stock_analytics(history: list[dict[str, Any]]) -> dict[str, Any]:
    rows = slice_history(history, 260)
    closes = [number(row.get("close")) for row in rows]
    amounts = [number(row.get("amount")) for row in rows]
    daily_returns = [closes[index] / closes[index - 1] - 1 for index in range(1, len(closes)) if closes[index - 1]]

    def period_return(days: int) -> float | None:
        if len(closes) <= days or not closes[-days - 1]:
            return None
        return round((closes[-1] / closes[-days - 1] - 1) * 100, 2)

    volatility = pstdev(daily_returns) * sqrt(252) * 100 if len(daily_returns) >= 2 else None
    max_drawdown = _max_drawdown(closes) * 100 if closes else None
    low = min(closes) if closes else 0
    high = max(closes) if closes else 0
    price_position = ((closes[-1] - low) / (high - low) * 100) if closes and high > low else None
    recent_amount = mean(amounts[-5:]) if amounts else 0
    prior_amount = mean(amounts[-10:-5]) if len(amounts) >= 10 else 0
    amount_change = ((recent_amount / prior_amount) - 1) * 100 if prior_amount else None

    return {
        "return_5d": period_return(5),
        "return_20d": period_return(20),
        "return_60d": period_return(60),
        "annualized_volatility": round(volatility, 2) if volatility is not None else None,
        "max_drawdown": round(max_drawdown, 2) if max_drawdown is not None else None,
        "price_position": round(price_position, 2) if price_position is not None else None,
        "amount_change_5d": round(amount_change, 2) if amount_change is not None else None,
        "sample_size": len(rows),
    }


def change_distribution(stocks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    buckets = [
        (None, -5, "<-5%"),
        (-5, -3, "-5~-3%"),
        (-3, -1, "-3~-1%"),
        (-1, 0, "-1~0%"),
        (0, 1, "0~1%"),
        (1, 3, "1~3%"),
        (3, 5, "3~5%"),
        (5, None, ">=5%"),
    ]
    result: list[dict[str, Any]] = []
    for low, high, label in buckets:
        count = 0
        for stock in stocks:
            value = number(stock.get("change_pct"))
            if low is None and value < number(high):
                count += 1
            elif high is None and value >= number(low):
                count += 1
            elif low is not None and high is not None and number(low) <= value < number(high):
                count += 1
        result.append({"label": label, "min": low, "max": high, "count": count})
    return result


def market_temperature(stocks: list[dict[str, Any]], sectors: list[dict[str, Any]]) -> dict[str, Any]:
    total = max(1, len(stocks))
    breadth = sum(1 for stock in stocks if number(stock.get("change_pct")) > 0) / total
    changes = [number(stock.get("change_pct")) for stock in stocks]
    momentum = _clamp(((mean(changes) if changes else 0) + 3) / 6)
    sector_strength = (
        sum(1 for sector in sectors if number(sector.get("change_pct")) > 0) / len(sectors) if sectors else 0.5
    )
    volume_ratios = [number(stock.get("volume_ratio"), 1) for stock in stocks if stock.get("volume_ratio") is not None]
    activity = _clamp(((mean(volume_ratios) if volume_ratios else 1) - 0.5) / 1.0)
    score = round((breadth * 0.45 + momentum * 0.25 + sector_strength * 0.15 + activity * 0.15) * 100)
    if score < 30:
        label = "偏冷"
    elif score < 45:
        label = "谨慎"
    elif score < 56:
        label = "中性"
    elif score < 70:
        label = "活跃"
    else:
        label = "偏热"
    return {
        "score": score,
        "label": label,
        "components": {
            "breadth": round(breadth * 100, 1),
            "momentum": round(momentum * 100, 1),
            "sector_strength": round(sector_strength * 100, 1),
            "activity": round(activity * 100, 1),
        },
    }


def build_events(
    news: list[dict[str, Any]], announcements: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    for item in news:
        events.append(
            {
                "kind": "news",
                "title": item.get("title", ""),
                "published_at": item.get("published_at", ""),
                "source": item.get("source", ""),
                "url": item.get("url", ""),
                "type": "新闻",
            }
        )
    for item in announcements:
        events.append(
            {
                "kind": "announcement",
                "title": item.get("title", ""),
                "published_at": item.get("published_at", ""),
                "source": item.get("name", "") or item.get("code", ""),
                "url": item.get("url", ""),
                "type": item.get("type", "公告"),
            }
        )
    return sorted(events, key=lambda item: str(item.get("published_at", "")), reverse=True)


def comparison_payload(
    details: list[dict[str, Any]],
    benchmark_history: list[dict[str, Any]],
    benchmark_code: str,
    window: int,
) -> dict[str, Any]:
    benchmark_rows = slice_history(benchmark_history, window)
    benchmark_map = _return_map(benchmark_rows)
    benchmark_returns = _daily_return_map(benchmark_rows)
    series: list[dict[str, Any]] = []
    metrics: list[dict[str, Any]] = []
    daily_maps: list[dict[str, float]] = []

    for detail in details:
        quote = detail.get("quote", {})
        rows = slice_history(detail.get("history") or [], window)
        return_map = _return_map(rows)
        daily_map = _daily_return_map(rows)
        daily_maps.append(daily_map)
        analytics = stock_analytics(rows)
        total_return = next(reversed(return_map.values()), 0.0) if return_map else 0.0
        benchmark_return = next(reversed(benchmark_map.values()), 0.0) if benchmark_map else 0.0
        series.append(
            {
                "code": quote.get("code", ""),
                "market": quote.get("market", ""),
                "name": quote.get("name", ""),
                "values": [{"date": date, "value": value} for date, value in return_map.items()],
            }
        )
        metrics.append(
            {
                "code": quote.get("code", ""),
                "market": quote.get("market", ""),
                "name": quote.get("name", ""),
                "return_pct": round(total_return, 2),
                "excess_return_pct": round(total_return - benchmark_return, 2),
                "annualized_volatility": analytics["annualized_volatility"],
                "max_drawdown": analytics["max_drawdown"],
                "correlation_to_benchmark": _correlation(daily_map, benchmark_returns),
                "amount": number(quote.get("amount")),
                "pe": number(quote.get("pe")),
                "pb": number(quote.get("pb")),
            }
        )

    labels = [item["name"] for item in metrics]
    matrix: list[list[float | None]] = []
    for left in daily_maps:
        matrix.append([_correlation(left, right) for right in daily_maps])
    return {
        "window": window,
        "benchmark": {
            "code": benchmark_code,
            "name": "沪深300" if benchmark_code == "000300" else benchmark_code,
            "values": [{"date": date, "value": value} for date, value in benchmark_map.items()],
        },
        "series": series,
        "metrics": metrics,
        "correlation": {"labels": labels, "values": matrix},
    }


def _return_map(rows: list[dict[str, Any]]) -> dict[str, float]:
    if not rows:
        return {}
    first = number(rows[0].get("close"), 1)
    if not first:
        return {}
    return {str(row["date"]): round((number(row.get("close")) / first - 1) * 100, 3) for row in rows}


def _daily_return_map(rows: list[dict[str, Any]]) -> dict[str, float]:
    result: dict[str, float] = {}
    for index in range(1, len(rows)):
        previous = number(rows[index - 1].get("close"))
        current = number(rows[index].get("close"))
        if previous:
            result[str(rows[index]["date"])] = current / previous - 1
    return result


def _correlation(left: dict[str, float], right: dict[str, float]) -> float | None:
    dates = sorted(set(left).intersection(right))
    if len(dates) < 3:
        return None
    left_values = [left[date] for date in dates]
    right_values = [right[date] for date in dates]
    left_mean = mean(left_values)
    right_mean = mean(right_values)
    numerator = sum((a - left_mean) * (b - right_mean) for a, b in zip(left_values, right_values))
    left_scale = sqrt(sum((value - left_mean) ** 2 for value in left_values))
    right_scale = sqrt(sum((value - right_mean) ** 2 for value in right_values))
    if not left_scale or not right_scale:
        return None
    return round(numerator / (left_scale * right_scale), 4)


def _max_drawdown(values: list[float]) -> float:
    if not values:
        return 0.0
    peak = values[0]
    drawdown = 0.0
    for value in values:
        peak = max(peak, value)
        if peak:
            drawdown = min(drawdown, value / peak - 1)
    return drawdown


def _clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))
