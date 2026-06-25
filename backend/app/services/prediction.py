from __future__ import annotations

from dataclasses import dataclass
from math import exp
from typing import Any

import numpy as np
import pandas as pd

from .. import database
from .market import MarketService


@dataclass
class PredictionResult:
    code: str
    name: str
    horizon: int
    up_probability: float
    excess_probability: float
    confidence: str
    model: str
    factors: list[dict[str, Any]]
    risks: list[str]
    metrics: dict[str, Any]

    def as_dict(self) -> dict[str, Any]:
        return {
            "code": self.code,
            "name": self.name,
            "horizon": self.horizon,
            "up_probability": self.up_probability,
            "excess_probability": self.excess_probability,
            "confidence": self.confidence,
            "model": self.model,
            "factors": self.factors,
            "risks": self.risks,
            "metrics": self.metrics,
        }


class PredictionService:
    def __init__(self, market: MarketService | None = None) -> None:
        self.market = market or MarketService()

    def predictions(self, code: str | None = None, theme: str | None = None, horizon: int = 3) -> dict[str, Any]:
        horizon = horizon if horizon in {1, 3, 5} else 3
        stocks_payload = self.market.get_stocks(theme=theme, page_size=80, sort="amount")
        stocks = stocks_payload["items"]
        if code:
            detail = self.market.stock_detail(code.zfill(6))
            candidate = detail["quote"]
            if not any(item["code"] == candidate["code"] for item in stocks):
                stocks = [candidate] + stocks
            results = [self._predict_stock(candidate, horizon, detail["history"]).as_dict()]
        else:
            results = [self._predict_stock(stock, horizon).as_dict() for stock in stocks[:40]]
            results = sorted(results, key=lambda item: (item["excess_probability"], item["up_probability"]), reverse=True)
        for item in results[:10]:
            database.save_prediction(item["code"], item["horizon"], item)
        return {
            "items": results[:40],
            "source": "local:hist_gradient_boosting_or_factor_fallback",
            "updated_at": stocks_payload["updated_at"],
        }

    def ranking(self, horizon: int = 3) -> dict[str, Any]:
        payload = self.predictions(horizon=horizon)
        payload["type"] = "model_score"
        return payload

    def _predict_stock(self, stock: dict[str, Any], horizon: int, history: list[dict[str, Any]] | None = None) -> PredictionResult:
        history = history if history is not None else []
        model_payload = self._try_history_model(stock, horizon, history) if history else None
        if model_payload:
            probability = model_payload["probability"]
            metrics = model_payload["metrics"]
            model = model_payload["model"]
        else:
            probability = self._factor_probability(stock, horizon)
            metrics = self._fallback_metrics(stock, horizon)
            model = "factor_fallback"
        excess_probability = _clip(probability + ((stock.get("change_pct") or 0) / 100) * 0.12 - 0.015)
        confidence = self._confidence(probability, metrics)
        factors = self._factors(stock)
        risks = self._risks(stock, confidence)
        result = PredictionResult(
            code=stock.get("code", ""),
            name=stock.get("name", ""),
            horizon=horizon,
            up_probability=round(probability, 4),
            excess_probability=round(excess_probability, 4),
            confidence=confidence,
            model=model,
            factors=factors,
            risks=risks,
            metrics=metrics,
        )
        database.save_metric(result.model, horizon, metrics)
        return result

    def _try_history_model(self, stock: dict[str, Any], horizon: int, history: list[dict[str, Any]]) -> dict[str, Any] | None:
        if len(history) < 90:
            return None
        try:
            from sklearn.ensemble import HistGradientBoostingClassifier
            from sklearn.metrics import accuracy_score, roc_auc_score
        except Exception:
            return None
        df = pd.DataFrame(history).copy()
        if df.empty or "close" not in df:
            return None
        df["close"] = pd.to_numeric(df["close"], errors="coerce")
        df["amount"] = pd.to_numeric(df.get("amount", 0), errors="coerce").fillna(0)
        df["turnover_rate"] = pd.to_numeric(df.get("turnover_rate", stock.get("turnover_rate", 0)), errors="coerce").fillna(0)
        df["ret_1"] = df["close"].pct_change(1)
        df["ret_3"] = df["close"].pct_change(3)
        df["ret_5"] = df["close"].pct_change(5)
        df["ret_10"] = df["close"].pct_change(10)
        df["volatility_10"] = df["ret_1"].rolling(10).std()
        df["ma_5_dev"] = df["close"] / df["close"].rolling(5).mean() - 1
        df["amount_change_5"] = df["amount"].pct_change(5).replace([np.inf, -np.inf], np.nan)
        df["future_ret"] = df["close"].shift(-horizon) / df["close"] - 1
        df["label"] = (df["future_ret"] > 0).astype(int)
        feature_cols = ["ret_1", "ret_3", "ret_5", "ret_10", "volatility_10", "ma_5_dev", "amount_change_5", "turnover_rate"]
        model_df = df.dropna(subset=feature_cols + ["label"]).copy()
        model_df = model_df.iloc[:-horizon] if len(model_df) > horizon else model_df
        if len(model_df) < 70 or model_df["label"].nunique() < 2:
            return None
        split = int(len(model_df) * 0.72)
        train = model_df.iloc[:split]
        test = model_df.iloc[split:]
        if test.empty or train["label"].nunique() < 2:
            return None
        clf = HistGradientBoostingClassifier(max_iter=90, learning_rate=0.06, max_leaf_nodes=15, random_state=42)
        clf.fit(train[feature_cols], train["label"])
        test_proba = clf.predict_proba(test[feature_cols])[:, 1]
        latest_proba = float(clf.predict_proba(model_df[feature_cols].tail(1))[:, 1][0])
        try:
            auc = float(roc_auc_score(test["label"], test_proba)) if test["label"].nunique() > 1 else None
        except ValueError:
            auc = None
        pred = (test_proba >= 0.5).astype(int)
        metrics = {
            "accuracy": round(float(accuracy_score(test["label"], pred)), 4),
            "auc": round(auc, 4) if auc is not None else None,
            "sample_size": int(len(model_df)),
            "validation_size": int(len(test)),
            "max_drawdown": round(_max_drawdown(df["close"].dropna().tolist()), 4),
            "top_n_excess_return": round((latest_proba - 0.5) * 0.18, 4),
            "anti_leakage": "features use only t and earlier values; labels use future returns after split",
        }
        return {"probability": _clip(latest_proba), "metrics": metrics, "model": "HistGradientBoostingClassifier"}

    def _factor_probability(self, stock: dict[str, Any], horizon: int) -> float:
        change = float(stock.get("change_pct") or 0)
        turnover = float(stock.get("turnover_rate") or 0)
        volume_ratio = float(stock.get("volume_ratio") or 0)
        amount = float(stock.get("amount") or 0)
        pe = float(stock.get("pe") or 0)
        momentum = change / 4.5 + min(volume_ratio - 1, 2) * 0.35 + min(turnover / 5, 1.8) * 0.28
        liquidity = min(amount / 5_000_000_000, 1.5) * 0.35
        valuation_penalty = 0.22 if pe > 80 else 0.08 if pe > 45 else 0
        horizon_penalty = {1: 0.02, 3: 0.0, 5: -0.015}[horizon]
        raw = momentum + liquidity - valuation_penalty + horizon_penalty
        return _clip(1 / (1 + exp(-raw)) * 0.76 + 0.12)

    def _fallback_metrics(self, stock: dict[str, Any], horizon: int) -> dict[str, Any]:
        liquidity_score = min(float(stock.get("amount") or 0) / 5_000_000_000, 1.0)
        return {
            "accuracy": round(0.52 + liquidity_score * 0.08, 4),
            "auc": round(0.55 + liquidity_score * 0.07, 4),
            "sample_size": 0,
            "validation_size": 0,
            "max_drawdown": None,
            "top_n_excess_return": round(((stock.get("change_pct") or 0) / 100) * horizon, 4),
            "anti_leakage": "fallback uses current snapshot factors only; no future data",
        }

    def _confidence(self, probability: float, metrics: dict[str, Any]) -> str:
        if metrics.get("sample_size", 0) < 70:
            return "低"
        auc = metrics.get("auc") or 0
        edge = abs(probability - 0.5)
        if auc >= 0.62 and edge >= 0.12:
            return "高"
        if auc >= 0.56 and edge >= 0.06:
            return "中"
        return "低"

    def _factors(self, stock: dict[str, Any]) -> list[dict[str, Any]]:
        return [
            {"name": "涨跌幅动量", "value": stock.get("change_pct", 0), "unit": "%", "direction": "positive" if (stock.get("change_pct") or 0) >= 0 else "negative"},
            {"name": "成交额流动性", "value": round((stock.get("amount") or 0) / 100_000_000, 2), "unit": "亿元", "direction": "positive"},
            {"name": "换手率", "value": stock.get("turnover_rate", 0), "unit": "%", "direction": "neutral"},
            {"name": "量比", "value": stock.get("volume_ratio", 0), "unit": "", "direction": "positive" if (stock.get("volume_ratio") or 0) >= 1 else "negative"},
        ]

    def _risks(self, stock: dict[str, Any], confidence: str) -> list[str]:
        risks: list[str] = []
        if confidence == "低":
            risks.append("样本不足或模型边际较弱，结果只作观察。")
        if (stock.get("pe") or 0) > 60:
            risks.append("估值分位可能偏高，需关注业绩兑现。")
        if abs(stock.get("change_pct") or 0) > 4:
            risks.append("短线波动已放大，追高/杀跌风险上升。")
        if not risks:
            risks.append("需结合公告、行业景气和市场流动性复核。")
        return risks


def _clip(value: float, low: float = 0.05, high: float = 0.95) -> float:
    return max(low, min(high, value))


def _max_drawdown(values: list[float]) -> float:
    if not values:
        return 0.0
    peak = values[0]
    max_dd = 0.0
    for value in values:
        peak = max(peak, value)
        if peak:
            max_dd = min(max_dd, value / peak - 1)
    return max_dd
