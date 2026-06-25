from __future__ import annotations

from datetime import date, timedelta
from math import sin
from typing import Any


THEMES: dict[str, dict[str, Any]] = {
    "tech": {
        "label": "科技",
        "keywords": ["半导体", "芯片", "软件", "人工智能", "服务器", "通信", "科创"],
        "boards": ["半导体", "软件开发", "通信设备", "消费电子", "人工智能"],
    },
    "new_energy": {
        "label": "新能源",
        "keywords": ["新能源", "电池", "锂电", "汽车", "储能", "充电"],
        "boards": ["电池", "汽车零部件", "能源金属", "储能", "新能源车"],
    },
    "display": {
        "label": "显示",
        "keywords": ["显示", "面板", "OLED", "MiniLED", "光学", "消费电子"],
        "boards": ["光学光电子", "消费电子", "OLED", "MiniLED", "面板"],
    },
    "pv": {
        "label": "光伏",
        "keywords": ["光伏", "硅片", "组件", "逆变器", "HJT", "TOPCon"],
        "boards": ["光伏设备", "电网设备", "TOPCon电池", "HJT电池", "逆变器"],
    },
}


SEED_STOCKS: list[dict[str, Any]] = [
    {"code": "688981", "name": "中芯国际", "theme": "tech", "sector": "半导体", "price": 58.42, "change_pct": 2.86, "turnover_rate": 2.13, "volume_ratio": 1.28, "amount": 3200000000, "pe": 82.6, "pb": 3.2, "market_cap": 466000000000},
    {"code": "002371", "name": "北方华创", "theme": "tech", "sector": "半导体", "price": 338.75, "change_pct": 1.74, "turnover_rate": 1.83, "volume_ratio": 1.16, "amount": 2100000000, "pe": 44.8, "pb": 7.8, "market_cap": 181000000000},
    {"code": "300308", "name": "中际旭创", "theme": "tech", "sector": "通信设备", "price": 173.28, "change_pct": 4.12, "turnover_rate": 4.96, "volume_ratio": 1.88, "amount": 5200000000, "pe": 51.3, "pb": 9.4, "market_cap": 194000000000},
    {"code": "688041", "name": "海光信息", "theme": "tech", "sector": "芯片", "price": 92.54, "change_pct": -0.63, "turnover_rate": 2.31, "volume_ratio": 0.92, "amount": 1400000000, "pe": 116.1, "pb": 10.7, "market_cap": 215000000000},
    {"code": "300750", "name": "宁德时代", "theme": "new_energy", "sector": "电池", "price": 214.88, "change_pct": 1.08, "turnover_rate": 0.83, "volume_ratio": 1.05, "amount": 4100000000, "pe": 20.4, "pb": 4.1, "market_cap": 945000000000},
    {"code": "002594", "name": "比亚迪", "theme": "new_energy", "sector": "新能源汽车", "price": 298.45, "change_pct": -1.21, "turnover_rate": 1.36, "volume_ratio": 0.86, "amount": 3600000000, "pe": 24.9, "pb": 5.3, "market_cap": 869000000000},
    {"code": "300014", "name": "亿纬锂能", "theme": "new_energy", "sector": "电池", "price": 42.63, "change_pct": 3.54, "turnover_rate": 3.42, "volume_ratio": 1.42, "amount": 980000000, "pe": 22.2, "pb": 2.8, "market_cap": 87200000000},
    {"code": "300124", "name": "汇川技术", "theme": "new_energy", "sector": "工控设备", "price": 61.37, "change_pct": 0.58, "turnover_rate": 1.02, "volume_ratio": 1.01, "amount": 760000000, "pe": 33.7, "pb": 7.1, "market_cap": 165000000000},
    {"code": "000725", "name": "京东方A", "theme": "display", "sector": "面板", "price": 4.18, "change_pct": 2.20, "turnover_rate": 1.84, "volume_ratio": 1.35, "amount": 1760000000, "pe": 34.2, "pb": 1.3, "market_cap": 157000000000},
    {"code": "000100", "name": "TCL科技", "theme": "display", "sector": "面板", "price": 4.87, "change_pct": 1.67, "turnover_rate": 2.04, "volume_ratio": 1.21, "amount": 1180000000, "pe": 29.6, "pb": 1.7, "market_cap": 91400000000},
    {"code": "002456", "name": "欧菲光", "theme": "display", "sector": "光学光电子", "price": 11.92, "change_pct": -2.14, "turnover_rate": 6.92, "volume_ratio": 1.73, "amount": 2320000000, "pe": 61.5, "pb": 5.4, "market_cap": 38800000000},
    {"code": "300433", "name": "蓝思科技", "theme": "display", "sector": "消费电子", "price": 18.74, "change_pct": 0.94, "turnover_rate": 1.55, "volume_ratio": 0.98, "amount": 920000000, "pe": 28.4, "pb": 2.5, "market_cap": 93200000000},
    {"code": "601012", "name": "隆基绿能", "theme": "pv", "sector": "光伏设备", "price": 18.26, "change_pct": -0.44, "turnover_rate": 1.19, "volume_ratio": 0.79, "amount": 1650000000, "pe": 27.8, "pb": 1.9, "market_cap": 138000000000},
    {"code": "300274", "name": "阳光电源", "theme": "pv", "sector": "逆变器", "price": 83.92, "change_pct": 3.91, "turnover_rate": 2.86, "volume_ratio": 1.52, "amount": 3050000000, "pe": 21.6, "pb": 5.2, "market_cap": 173000000000},
    {"code": "688599", "name": "天合光能", "theme": "pv", "sector": "光伏组件", "price": 19.38, "change_pct": 1.26, "turnover_rate": 1.72, "volume_ratio": 1.12, "amount": 680000000, "pe": 19.8, "pb": 1.5, "market_cap": 42100000000},
    {"code": "600438", "name": "通威股份", "theme": "pv", "sector": "硅料", "price": 22.17, "change_pct": -1.06, "turnover_rate": 1.47, "volume_ratio": 0.91, "amount": 1460000000, "pe": 18.3, "pb": 1.7, "market_cap": 99800000000},
    {"code": "600519", "name": "贵州茅台", "theme": "market", "sector": "白酒", "price": 1518.12, "change_pct": 0.37, "turnover_rate": 0.24, "volume_ratio": 0.83, "amount": 2700000000, "pe": 22.8, "pb": 8.5, "market_cap": 1907000000000},
    {"code": "601318", "name": "中国平安", "theme": "market", "sector": "保险", "price": 49.72, "change_pct": -0.52, "turnover_rate": 0.48, "volume_ratio": 0.92, "amount": 1860000000, "pe": 8.3, "pb": 0.9, "market_cap": 905000000000},
    {"code": "600036", "name": "招商银行", "theme": "market", "sector": "银行", "price": 37.84, "change_pct": 0.82, "turnover_rate": 0.38, "volume_ratio": 0.76, "amount": 1880000000, "pe": 6.4, "pb": 0.9, "market_cap": 954000000000},
    {"code": "601899", "name": "紫金矿业", "theme": "market", "sector": "有色金属", "price": 18.61, "change_pct": 2.49, "turnover_rate": 1.11, "volume_ratio": 1.25, "amount": 4030000000, "pe": 17.9, "pb": 4.2, "market_cap": 492000000000},
]


SEED_INDICES: list[dict[str, Any]] = [
    {"code": "000001", "name": "上证指数", "price": 3318.42, "change_pct": 0.62, "amount": 432000000000},
    {"code": "399001", "name": "深证成指", "price": 10572.18, "change_pct": 0.93, "amount": 586000000000},
    {"code": "399006", "name": "创业板指", "price": 2146.77, "change_pct": 1.24, "amount": 238000000000},
    {"code": "000688", "name": "科创50", "price": 1018.34, "change_pct": 1.71, "amount": 78400000000},
    {"code": "000300", "name": "沪深300", "price": 3972.66, "change_pct": 0.58, "amount": 278000000000},
    {"code": "000905", "name": "中证500", "price": 5851.22, "change_pct": 0.76, "amount": 149000000000},
    {"code": "000852", "name": "中证1000", "price": 6248.91, "change_pct": 1.05, "amount": 168000000000},
]


SEED_SECTORS: list[dict[str, Any]] = [
    {"name": "半导体", "theme": "tech", "change_pct": 2.74, "amount": 84200000000, "turnover_rate": 3.18, "up_count": 86, "down_count": 24, "leader": "中际旭创", "leader_change_pct": 4.12},
    {"name": "人工智能", "theme": "tech", "change_pct": 2.18, "amount": 77600000000, "turnover_rate": 3.42, "up_count": 74, "down_count": 29, "leader": "海光信息", "leader_change_pct": 3.26},
    {"name": "电池", "theme": "new_energy", "change_pct": 1.81, "amount": 69800000000, "turnover_rate": 2.64, "up_count": 58, "down_count": 33, "leader": "亿纬锂能", "leader_change_pct": 3.54},
    {"name": "新能源车", "theme": "new_energy", "change_pct": 0.94, "amount": 64200000000, "turnover_rate": 2.11, "up_count": 63, "down_count": 42, "leader": "宁德时代", "leader_change_pct": 1.08},
    {"name": "面板", "theme": "display", "change_pct": 1.68, "amount": 31600000000, "turnover_rate": 1.95, "up_count": 31, "down_count": 11, "leader": "京东方A", "leader_change_pct": 2.20},
    {"name": "OLED", "theme": "display", "change_pct": 1.12, "amount": 27200000000, "turnover_rate": 2.23, "up_count": 43, "down_count": 19, "leader": "TCL科技", "leader_change_pct": 1.67},
    {"name": "光伏设备", "theme": "pv", "change_pct": 0.87, "amount": 54800000000, "turnover_rate": 2.06, "up_count": 39, "down_count": 28, "leader": "阳光电源", "leader_change_pct": 3.91},
    {"name": "逆变器", "theme": "pv", "change_pct": 1.93, "amount": 30800000000, "turnover_rate": 2.58, "up_count": 22, "down_count": 8, "leader": "阳光电源", "leader_change_pct": 3.91},
]


SEED_NEWS: list[dict[str, Any]] = [
    {"title": "多家半导体设备公司披露订单景气度改善", "source": "财联社样例", "published_at": "2026-06-25 10:18", "theme": "tech", "url": "https://example.com/news/tech-order"},
    {"title": "储能招标规模维持高位，电池材料价格企稳", "source": "财经样例", "published_at": "2026-06-25 09:42", "theme": "new_energy", "url": "https://example.com/news/storage"},
    {"title": "面板厂商二季度稼动率提升，大尺寸价格小幅上行", "source": "行业样例", "published_at": "2026-06-24 18:05", "theme": "display", "url": "https://example.com/news/display"},
    {"title": "光伏组件排产环比回升，逆变器出口延续增长", "source": "财经样例", "published_at": "2026-06-24 16:20", "theme": "pv", "url": "https://example.com/news/pv"},
    {"title": "沪深两市成交额突破万亿元，科技成长方向活跃", "source": "市场样例", "published_at": "2026-06-25 11:05", "theme": "market", "url": "https://example.com/news/market"},
]


SEED_ANNOUNCEMENTS: list[dict[str, Any]] = [
    {"code": "688981", "name": "中芯国际", "title": "关于资本开支计划进展的公告", "type": "经营公告", "published_at": "2026-06-24", "url": "https://example.com/notice/688981"},
    {"code": "300750", "name": "宁德时代", "title": "关于海外储能项目合作进展的公告", "type": "重大合同", "published_at": "2026-06-24", "url": "https://example.com/notice/300750"},
    {"code": "000725", "name": "京东方A", "title": "关于回购股份实施进展的公告", "type": "回购", "published_at": "2026-06-23", "url": "https://example.com/notice/000725"},
    {"code": "300274", "name": "阳光电源", "title": "投资者关系活动记录表", "type": "调研纪要", "published_at": "2026-06-23", "url": "https://example.com/notice/300274"},
]


def seed_history(code: str, days: int = 160) -> list[dict[str, Any]]:
    stock = next((item for item in SEED_STOCKS if item["code"] == code), SEED_STOCKS[0])
    today = date(2026, 6, 25)
    base = float(stock["price"]) * 0.82
    theme_bias = {"tech": 0.0025, "new_energy": 0.001, "display": 0.0016, "pv": 0.0007}.get(stock["theme"], 0.0004)
    rows: list[dict[str, Any]] = []
    close = base
    for i in range(days):
        current = today - timedelta(days=days - i)
        if current.weekday() >= 5:
            continue
        wave = sin(i / 5.0) * 0.012 + sin(i / 17.0) * 0.009
        drift = theme_bias + ((i % 11) - 5) * 0.0005
        close = max(1.0, close * (1 + wave + drift))
        open_price = close * (1 - wave / 2)
        high = max(open_price, close) * (1 + 0.012 + abs(wave) / 2)
        low = min(open_price, close) * (1 - 0.011 - abs(wave) / 2)
        volume = int(18_000_000 * (1 + stock["turnover_rate"] / 8) * (1 + abs(wave) * 16))
        rows.append(
            {
                "date": current.isoformat(),
                "open": round(open_price, 2),
                "close": round(close, 2),
                "high": round(high, 2),
                "low": round(low, 2),
                "volume": volume,
                "amount": round(volume * close, 2),
                "change_pct": round((close / open_price - 1) * 100, 2),
                "turnover_rate": round(stock["turnover_rate"] * (0.75 + abs(wave) * 8), 2),
            }
        )
    if rows:
        scale = float(stock["price"]) / rows[-1]["close"]
        for row in rows:
            row["open"] = round(row["open"] * scale, 2)
            row["close"] = round(row["close"] * scale, 2)
            row["high"] = round(row["high"] * scale, 2)
            row["low"] = round(row["low"] * scale, 2)
            row["amount"] = round(row["volume"] * row["close"], 2)
    return rows[-days:]


def seed_index_history(code: str, days: int = 90) -> list[dict[str, Any]]:
    index = next((item for item in SEED_INDICES if item["code"] == code), SEED_INDICES[0])
    today = date(2026, 6, 25)
    base = float(index["price"]) * 0.94
    rows: list[dict[str, Any]] = []
    close = base
    for i in range(days):
        current = today - timedelta(days=days - i)
        if current.weekday() >= 5:
            continue
        wave = sin(i / 9.0) * 0.005 + sin(i / 23.0) * 0.004
        close = close * (1 + 0.0007 + wave)
        rows.append({"date": current.isoformat(), "close": round(close, 2), "amount": int(index["amount"] * (0.85 + abs(wave) * 20))})
    if rows:
        scale = float(index["price"]) / rows[-1]["close"]
        for row in rows:
            row["close"] = round(row["close"] * scale, 2)
    return rows
