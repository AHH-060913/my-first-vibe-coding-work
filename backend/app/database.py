from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator

from .config import get_settings


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def init_db() -> None:
    db_path = Path(get_settings().db_path)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(db_path) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS cache_entries (
                key TEXT PRIMARY KEY,
                payload TEXT NOT NULL,
                source TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS watchlist (
                code TEXT PRIMARY KEY,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS prediction_runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code TEXT NOT NULL,
                horizon INTEGER NOT NULL,
                payload TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS model_metrics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                model_name TEXT NOT NULL,
                horizon INTEGER NOT NULL,
                payload TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        conn.commit()


@contextmanager
def connect() -> Iterator[sqlite3.Connection]:
    init_db()
    conn = sqlite3.connect(get_settings().db_path)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def get_cache(key: str) -> dict[str, Any] | None:
    with connect() as conn:
        row = conn.execute("SELECT payload, source, updated_at FROM cache_entries WHERE key = ?", (key,)).fetchone()
    if row is None:
        return None
    return {"payload": json.loads(row["payload"]), "source": row["source"], "updated_at": row["updated_at"]}


def set_cache(key: str, payload: Any, source: str) -> None:
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO cache_entries (key, payload, source, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET
                payload = excluded.payload,
                source = excluded.source,
                updated_at = excluded.updated_at
            """,
            (key, json.dumps(payload, ensure_ascii=False), source, utc_now_iso()),
        )


def add_watchlist(code: str) -> None:
    with connect() as conn:
        conn.execute(
            "INSERT OR IGNORE INTO watchlist (code, created_at) VALUES (?, ?)",
            (code, utc_now_iso()),
        )


def remove_watchlist(code: str) -> None:
    with connect() as conn:
        conn.execute("DELETE FROM watchlist WHERE code = ?", (code,))


def list_watchlist() -> list[str]:
    with connect() as conn:
        rows = conn.execute("SELECT code FROM watchlist ORDER BY created_at DESC").fetchall()
    return [row["code"] for row in rows]


def save_prediction(code: str, horizon: int, payload: dict[str, Any]) -> None:
    with connect() as conn:
        conn.execute(
            "INSERT INTO prediction_runs (code, horizon, payload, updated_at) VALUES (?, ?, ?, ?)",
            (code, horizon, json.dumps(payload, ensure_ascii=False), utc_now_iso()),
        )


def save_metric(model_name: str, horizon: int, payload: dict[str, Any]) -> None:
    with connect() as conn:
        conn.execute(
            "INSERT INTO model_metrics (model_name, horizon, payload, updated_at) VALUES (?, ?, ?, ?)",
            (model_name, horizon, json.dumps(payload, ensure_ascii=False), utc_now_iso()),
        )
