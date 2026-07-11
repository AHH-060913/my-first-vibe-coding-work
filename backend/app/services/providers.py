from __future__ import annotations

import re
from datetime import datetime
from typing import Any
from urllib.parse import quote

import requests

from ..seed import SEED_STOCKS, THEMES, seed_history
from .normalizers import safe_float, safe_int

DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0",
    "Referer": "https://finance.sina.com.cn",
}

PROFILE_FALLBACKS: dict[str, str] = {
    "688981": "公司主要从事集成电路晶圆代工及配套服务，是 A 股半导体制造方向的重要样本。",
    "002371": "公司主要覆盖半导体装备、真空装备和精密电子工艺装备，受益于国产半导体设备替代进程。",
    "300308": "公司主要从事高速光通信模块研发、生产和销售，关注 AI 算力、数据中心和光模块景气度。",
    "688041": "公司聚焦高端处理器和相关芯片产品，属于国产计算芯片和服务器产业链样本。",
    "300750": "公司主要从事动力电池、储能电池及相关电池材料和回收业务，是新能源车和储能产业链核心公司。",
    "002594": "公司业务覆盖新能源汽车、电池、电子和轨道交通等领域，是新能源整车与电池一体化样本。",
    "300014": "公司主要从事消费电池、动力电池和储能电池研发制造，属于锂电池产业链样本。",
    "300124": "公司聚焦工业自动化控制、新能源汽车电驱和工业机器人等方向。",
    "000725": "公司主要从事半导体显示器件、物联网创新业务和智慧医工业务，是面板显示产业链样本。",
    "000100": "公司主要布局半导体显示、新能源光伏材料和产业金融投资等方向。",
    "002456": "公司主要覆盖光学光电子、智能汽车和消费电子相关产品。",
    "300433": "公司主要从事消费电子与智能终端防护玻璃、结构件及相关材料业务。",
    "601012": "公司主要从事单晶硅片、电池和组件等光伏产品研发制造。",
    "300274": "公司主要从事光伏逆变器、储能系统和新能源电源设备，是逆变器方向核心样本。",
    "688599": "公司主要从事光伏组件、系统产品和智慧能源解决方案。",
    "600438": "公司业务覆盖高纯晶硅、太阳能电池及农业食品相关业务，是硅料和光伏产业链样本。",
    "600519": "公司主要从事贵州茅台酒及系列酒生产销售，是消费蓝筹和白酒行业代表。",
    "601318": "公司业务覆盖保险、银行、资产管理和科技服务，是金融板块权重样本。",
    "600036": "公司主要从事商业银行业务，是银行板块核心样本。",
    "601899": "公司主要从事金、铜、锌等矿产资源勘查、开发和冶炼加工，是有色金属板块代表。",
    "HK:01810": "小米集团主要从事智能手机、IoT 与生活消费产品、互联网服务及智能电动汽车等业务，收入结构与消费电子、智能硬件和生态服务高度相关。",
}


def market_prefix(code: str, market: str = "") -> str:
    if market.upper() == "HK" or code.upper().startswith("HK"):
        return "hk"
    normalized = code.zfill(6)
    if normalized.startswith(("6", "9")):
        return "sh"
    if normalized.startswith(("4", "8")):
        return "bj"
    return "sz"


def normalize_code(value: str) -> str:
    digits = re.sub(r"\D", "", value or "")
    return digits[-6:].zfill(6) if digits else ""


def normalize_symbol(value: str, market: str = "") -> tuple[str, str]:
    raw = (value or "").strip()
    upper_market = market.upper()
    if raw.upper().startswith("HK"):
        digits = re.sub(r"\D", "", raw)
        return digits[-5:].zfill(5), "HK"
    digits = re.sub(r"\D", "", raw)
    if upper_market == "HK":
        return digits[-5:].zfill(5), "HK"
    if upper_market in {"SH", "SZ", "BJ"}:
        return digits[-6:].zfill(6), upper_market
    if digits and len(digits) <= 5 and raw.startswith("0"):
        return digits[-5:].zfill(5), "HK"
    code = digits[-6:].zfill(6) if digits else ""
    return code, market_prefix(code).upper() if code else upper_market


def infer_theme(name: str, sector: str = "") -> str:
    text = f"{name} {sector}".lower()
    for key, meta in THEMES.items():
        if any(keyword.lower() in text for keyword in meta["keywords"] + meta["boards"]):
            return key
    return "market"


def seed_stock_by_code(code: str) -> dict[str, Any] | None:
    return next((item for item in SEED_STOCKS if item["code"] == code), None)


class FreeMarketProvider:
    def __init__(self, timeout: float = 2.5) -> None:
        self.timeout = timeout

    def search_stocks(self, query: str, limit: int = 12) -> list[dict[str, Any]]:
        q = query.strip()
        if not q:
            return []
        results: list[dict[str, Any]] = []
        if q.isdigit():
            code, market = normalize_symbol(q)
            if code:
                seeded = seed_stock_by_code(code)
                results.append(
                    {
                        "code": code,
                        "name": seeded["name"] if seeded else code,
                        "market": market,
                        "source": "local:code",
                    }
                )
        for loader in (self._search_tencent, self._search_sina):
            try:
                remote_results = loader(q, limit)
                results.extend(remote_results)
                if remote_results:
                    break
            except Exception:
                continue
        results.extend(self._search_seed(q, limit))
        unique: dict[str, dict[str, Any]] = {}
        for item in results:
            market = (item.get("market") or "").upper()
            code, market = normalize_symbol(item.get("code", ""), market)
            if not code:
                continue
            if market not in {"SH", "SZ", "BJ", "HK"}:
                continue
            unique.setdefault(f"{market}:{code}", {**item, "code": code, "market": market})
        return list(unique.values())[:limit]

    def quote(self, code: str, market: str = "") -> tuple[dict[str, Any], str]:
        normalized, normalized_market = normalize_symbol(code, market)
        errors: list[str] = []
        loaders = (
            (self._quote_tencent_hk, self._quote_sina_hk)
            if normalized_market == "HK"
            else (self._quote_tencent, self._quote_sina)
        )
        for loader in loaders:
            try:
                quote_data, source = loader(normalized)
                seeded = seed_stock_by_code(normalized) or {}
                quote_data["sector"] = quote_data.get("sector") or seeded.get("sector", "")
                quote_data["theme"] = quote_data.get("theme") or seeded.get("theme") or infer_theme(quote_data.get("name", ""), quote_data.get("sector", ""))
                quote_data["pe"] = quote_data.get("pe") or seeded.get("pe", 0)
                quote_data["pb"] = quote_data.get("pb") or seeded.get("pb", 0)
                quote_data["market_cap"] = quote_data.get("market_cap") or seeded.get("market_cap", 0)
                quote_data["volume_ratio"] = quote_data.get("volume_ratio") or seeded.get("volume_ratio", 0)
                quote_data["turnover_rate"] = quote_data.get("turnover_rate") or seeded.get("turnover_rate", 0)
                quote_data["stale"] = False
                quote_data["source"] = source
                quote_data["market"] = normalized_market
                return quote_data, source
            except Exception as exc:
                errors.append(f"{loader.__name__}:{type(exc).__name__}")
        seeded = seed_stock_by_code(normalized)
        if seeded:
            source = f"seed:stock:{';'.join(errors)}"
            return {**seeded, "stale": True, "updated_at": "", "source": source}, source
        source = f"fallback:empty:{';'.join(errors)}"
        return (
            {
                "code": normalized,
                "name": normalized,
                "price": 0,
                "change_pct": 0,
                "change": 0,
                "volume": 0,
                "amount": 0,
                "high": 0,
                "low": 0,
                "open": 0,
                "previous_close": 0,
                "volume_ratio": 0,
                "turnover_rate": 0,
                "pe": 0,
                "pb": 0,
                "market_cap": 0,
                "sector": "",
                "theme": "market",
                "stale": True,
                "source": source,
                "market": normalized_market,
                "updated_at": "",
            },
            source,
        )

    def profile(self, code: str, name: str = "", market: str = "") -> tuple[dict[str, Any], str]:
        normalized, normalized_market = normalize_symbol(code, market)
        seeded = seed_stock_by_code(normalized) if normalized_market != "HK" else None
        if seeded:
            return self._seed_profile(seeded), "seed:profile"
        known_profile = self._known_profile(normalized, name, normalized_market)
        if known_profile:
            return known_profile, "local:profile"

        profile = self._blank_profile(normalized, name)
        profile["market"] = normalized_market
        if normalized_market == "HK":
            return profile, "fallback:profile"
        sources: list[str] = []
        for loader in (self._profile_eastmoney, self._profile_ths):
            try:
                remote_profile, source = loader(normalized, name)
                self._merge_profile(profile, remote_profile)
                sources.append(source)
            except Exception:
                continue
        if sources:
            if not profile["main_business"] or profile["main_business"] == "暂无资料":
                industry = profile.get("industry") or "A股"
                profile["main_business"] = f"{profile['name']}属于{industry}相关公司；免费资料源暂未返回更详细主营介绍。"
            profile["source"] = "+".join(sources)
            profile["updated_at"] = datetime.now().isoformat(timespec="seconds")
            profile["stale"] = False
            return profile, profile["source"]

        return profile, "fallback:profile"

    def synthetic_history(self, code: str, price: float | None = None, market: str = "") -> list[dict[str, Any]]:
        normalized, normalized_market = normalize_symbol(code, market)
        rows = seed_history(normalized)
        if price and rows:
            scale = price / rows[-1]["close"] if rows[-1]["close"] else 1
            for row in rows:
                row["open"] = round(row["open"] * scale, 2)
                row["close"] = round(row["close"] * scale, 2)
                row["high"] = round(row["high"] * scale, 2)
                row["low"] = round(row["low"] * scale, 2)
        return rows

    def _quote_sina(self, code: str) -> tuple[dict[str, Any], str]:
        symbol = f"{market_prefix(code)}{code}"
        url = f"http://hq.sinajs.cn/list={symbol}"
        response = requests.get(url, timeout=self.timeout, headers=DEFAULT_HEADERS)
        response.encoding = "gb18030"
        match = re.search(r'="(.*)"', response.text)
        if not match:
            raise ValueError("empty sina response")
        fields = match.group(1).split(",")
        if len(fields) < 32 or not fields[0]:
            raise ValueError("invalid sina quote")
        name = fields[0].strip()
        open_price = safe_float(fields[1])
        previous_close = safe_float(fields[2])
        price = safe_float(fields[3])
        high = safe_float(fields[4])
        low = safe_float(fields[5])
        volume = safe_int(fields[8])
        amount = safe_float(fields[9])
        updated_at = f"{fields[30]} {fields[31]}" if len(fields) > 31 else datetime.now().isoformat(timespec="seconds")
        change = price - previous_close if previous_close else 0
        change_pct = change / previous_close * 100 if previous_close else 0
        return (
            {
                "code": code,
                "name": name,
                "price": round(price, 3),
                "change_pct": round(change_pct, 2),
                "change": round(change, 3),
                "volume": volume,
                "amount": amount,
                "high": high,
                "low": low,
                "open": open_price,
                "previous_close": previous_close,
                "updated_at": updated_at,
            },
            "sina:hq.sinajs.cn",
        )

    def _quote_tencent(self, code: str) -> tuple[dict[str, Any], str]:
        symbol = f"{market_prefix(code)}{code}"
        response = requests.get(f"https://qt.gtimg.cn/q={symbol}", timeout=self.timeout, headers=DEFAULT_HEADERS)
        response.encoding = "gbk"
        match = re.search(r'="(.*)"', response.text)
        if not match:
            raise ValueError("empty tencent response")
        fields = match.group(1).split("~")
        if len(fields) < 39 or not fields[1]:
            raise ValueError("invalid tencent quote")
        amount = safe_float(fields[37]) * 10000
        updated_at = fields[30] if len(fields) > 30 else datetime.now().isoformat(timespec="seconds")
        return (
            {
                "code": code,
                "name": fields[1],
                "price": safe_float(fields[3]),
                "previous_close": safe_float(fields[4]),
                "open": safe_float(fields[5]),
                "volume": safe_int(fields[36]) * 100,
                "amount": amount,
                "change": safe_float(fields[31]),
                "change_pct": safe_float(fields[32]),
                "high": safe_float(fields[33]),
                "low": safe_float(fields[34]),
                "turnover_rate": safe_float(fields[38]),
                "pe": safe_float(fields[39]) if len(fields) > 39 else 0,
                "amplitude": safe_float(fields[45]) if len(fields) > 45 else 0,
                "updated_at": updated_at,
            },
            "tencent:qt.gtimg.cn",
        )

    def _quote_sina_hk(self, code: str) -> tuple[dict[str, Any], str]:
        response = requests.get(f"http://hq.sinajs.cn/list=hk{code}", timeout=self.timeout, headers=DEFAULT_HEADERS)
        response.encoding = "gb18030"
        match = re.search(r'="(.*)"', response.text)
        if not match:
            raise ValueError("empty sina hk response")
        fields = match.group(1).split(",")
        if len(fields) < 18 or not fields[1]:
            raise ValueError("invalid sina hk quote")
        price = safe_float(fields[6])
        previous_close = safe_float(fields[3])
        change = safe_float(fields[7])
        change_pct = safe_float(fields[8])
        return (
            {
                "code": code,
                "name": _clean_hk_name(fields[1]),
                "price": price,
                "change_pct": change_pct,
                "change": change,
                "volume": safe_int(fields[11]),
                "amount": safe_float(fields[10]),
                "high": safe_float(fields[4]),
                "low": safe_float(fields[5]),
                "open": safe_float(fields[2]),
                "previous_close": previous_close,
                "sector": "港股科技",
                "theme": "tech",
                "pe": 0,
                "pb": 0,
                "market_cap": 0,
                "volume_ratio": 0,
                "turnover_rate": 0,
                "updated_at": f"{fields[17]} {fields[18]}" if len(fields) > 18 else datetime.now().isoformat(timespec="seconds"),
            },
            "sina:hq.sinajs.cn:hk",
        )

    def _quote_tencent_hk(self, code: str) -> tuple[dict[str, Any], str]:
        response = requests.get(f"https://qt.gtimg.cn/q=hk{code}", timeout=self.timeout, headers=DEFAULT_HEADERS)
        response.encoding = "gbk"
        match = re.search(r'="(.*)"', response.text)
        if not match:
            raise ValueError("empty tencent hk response")
        fields = match.group(1).split("~")
        if len(fields) < 38 or not fields[1]:
            raise ValueError("invalid tencent hk quote")
        return (
            {
                "code": code,
                "name": _clean_hk_name(fields[1]),
                "price": safe_float(fields[3]),
                "previous_close": safe_float(fields[4]),
                "open": safe_float(fields[5]),
                "volume": safe_int(fields[36]),
                "amount": safe_float(fields[37]),
                "change": safe_float(fields[31]),
                "change_pct": safe_float(fields[32]),
                "high": safe_float(fields[33]),
                "low": safe_float(fields[34]),
                "turnover_rate": safe_float(fields[38]) if len(fields) > 38 else 0,
                "pe": safe_float(fields[39]) if len(fields) > 39 else 0,
                "market_cap": safe_float(fields[44]) * 100000000 if len(fields) > 44 else 0,
                "sector": "港股科技",
                "theme": "tech",
                "updated_at": fields[30] if len(fields) > 30 else datetime.now().isoformat(timespec="seconds"),
            },
            "tencent:qt.gtimg.cn:hk",
        )

    def _search_tencent(self, query: str, limit: int) -> list[dict[str, Any]]:
        url = f"http://smartbox.gtimg.cn/s3/?q={quote(query)}&t=all"
        response = requests.get(url, timeout=self.timeout, headers=DEFAULT_HEADERS)
        response.encoding = "utf-8"
        match = re.search(r'v_hint="(.*)"', response.text)
        if not match:
            return []
        rows: list[dict[str, Any]] = []
        for part in match.group(1).split("^"):
            bits = part.split("~")
            if len(bits) < 5:
                continue
            market, code, name, pinyin, kind = bits[:5]
            if market not in {"sh", "sz", "bj", "hk"} or "GP" not in kind:
                continue
            if market in {"sh", "sz", "bj"} and "GP-A" not in kind:
                continue
            rows.append({"code": code, "name": _decode_text(_clean_hk_name(name)), "market": market.upper(), "pinyin": pinyin, "source": "tencent:smartbox"})
        return rows[:limit]

    def _search_sina(self, query: str, limit: int) -> list[dict[str, Any]]:
        url = f"http://suggest3.sinajs.cn/suggest/type=11&key={quote(query)}"
        response = requests.get(url, timeout=self.timeout, headers=DEFAULT_HEADERS)
        response.encoding = "gbk"
        match = re.search(r'="(.*)"', response.text)
        if not match:
            return []
        rows: list[dict[str, Any]] = []
        for part in match.group(1).split(";"):
            bits = part.split(",")
            if len(bits) < 5:
                continue
            symbol = bits[3] or bits[0]
            market = symbol[:2].upper()
            code = normalize_code(bits[2])
            if market not in {"SH", "SZ", "BJ"} or not code:
                continue
            rows.append({"code": code, "name": bits[4], "market": market, "source": "sina:suggest"})
        return rows[:limit]

    def _search_seed(self, query: str, limit: int) -> list[dict[str, Any]]:
        q = query.lower()
        rows = []
        for item in SEED_STOCKS:
            if q in item["code"].lower() or q in item["name"].lower():
                rows.append({"code": item["code"], "name": item["name"], "market": market_prefix(item["code"]).upper(), "source": "seed:search"})
        if q in {"小米", "小米集团", "xiaomi", "xmjt", "01810"}:
            rows.append({"code": "01810", "name": "小米集团-W", "market": "HK", "source": "local:search"})
        return rows[:limit]

    def _profile_eastmoney(self, code: str, name: str = "") -> tuple[dict[str, Any], str]:
        market_code = 1 if code.startswith(("6", "9")) else 0
        params = {
            "fltt": "2",
            "invt": "2",
            "fields": "f57,f58,f84,f85,f127,f116,f117,f189",
            "secid": f"{market_code}.{code}",
        }
        response = requests.get(
            "https://push2.eastmoney.com/api/qt/stock/get",
            params=params,
            timeout=min(self.timeout, 2.0),
            headers={**DEFAULT_HEADERS, "Referer": "https://quote.eastmoney.com/"},
        )
        data = response.json().get("data") or {}
        if not data:
            raise ValueError("empty eastmoney profile")
        return (
            {
                "code": code,
                "name": str(data.get("f58") or name or code),
                "full_name": str(data.get("f58") or name or code),
                "listing_date": _format_yyyymmdd(data.get("f189")),
                "industry": _clean_text(data.get("f127")),
                "total_shares": safe_float(data.get("f84")),
                "float_shares": safe_float(data.get("f85")),
            },
            "eastmoney:stock_info",
        )

    def _profile_ths(self, code: str, name: str = "") -> tuple[dict[str, Any], str]:
        response = requests.get(
            f"https://basic.10jqka.com.cn/new/{code}/operate.html",
            timeout=min(self.timeout, 2.0),
            headers={
                "User-Agent": DEFAULT_HEADERS["User-Agent"],
                "Referer": f"https://basic.10jqka.com.cn/new/{code}/",
            },
        )
        response.encoding = "gb2312"
        items = re.findall(r"<li[^>]*>(.*?)</li>", response.text, flags=re.S)
        values: dict[str, str] = {}
        for item in items:
            text = _strip_tags(item)
            if "：" not in text:
                continue
            key, value = text.split("：", 1)
            values[key.strip()] = value.strip()
        if not values:
            raise ValueError("empty ths profile")
        main_business = values.get("主营业务") or values.get("产品类型") or values.get("产品名称") or ""
        business_scope = values.get("经营范围") or values.get("主营业务") or ""
        return (
            {
                "code": code,
                "name": name or code,
                "main_business": main_business,
                "business_scope": business_scope,
            },
            "ths:operate",
        )

    def _seed_profile(self, stock: dict[str, Any]) -> dict[str, Any]:
        sector = stock.get("sector", "")
        business = PROFILE_FALLBACKS.get(stock["code"], f"公司主营业务与{sector or '所属行业'}相关，公开演示版使用样例资料展示。")
        return {
            "code": stock["code"],
            "name": stock["name"],
            "full_name": f"{stock['name']}股份有限公司",
            "listing_date": "",
            "region": "",
            "industry": sector,
            "main_business": business,
            "business_scope": "资料源暂不可用时显示占位介绍；本地实时模式会优先尝试公开资料源。",
            "website": "",
            "total_shares": 0,
            "float_shares": 0,
            "source": "seed:profile",
            "updated_at": datetime.now().isoformat(timespec="seconds"),
            "stale": True,
        }

    def _known_profile(self, code: str, name: str = "", market: str = "") -> dict[str, Any] | None:
        business = PROFILE_FALLBACKS.get(f"{market}:{code}")
        if not business:
            return None
        company_name = name or ("小米集团-W" if code == "01810" else code)
        return {
            "code": code,
            "name": company_name,
            "full_name": "小米集团",
            "listing_date": "2018-07-09" if code == "01810" else "",
            "region": "香港",
            "industry": "消费电子 / 互联网服务",
            "main_business": business,
            "business_scope": "智能手机、IoT 与生活消费产品、互联网服务、智能电动汽车及相关生态业务。",
            "website": "https://www.mi.com",
            "total_shares": 0,
            "float_shares": 0,
            "source": "local:profile",
            "updated_at": datetime.now().isoformat(timespec="seconds"),
            "stale": True,
            "market": market,
        }

    def _blank_profile(self, code: str, name: str = "") -> dict[str, Any]:
        return {
            "code": code,
            "name": name or code,
            "full_name": name or code,
            "listing_date": "",
            "region": "",
            "industry": "",
            "main_business": "暂无资料",
            "business_scope": "暂无资料",
            "website": "",
            "total_shares": 0,
            "float_shares": 0,
            "source": "fallback:profile",
            "updated_at": datetime.now().isoformat(timespec="seconds"),
            "stale": True,
        }

    def _merge_profile(self, target: dict[str, Any], incoming: dict[str, Any]) -> None:
        for key, value in incoming.items():
            if value not in (None, "", 0, "0", "-", "--", "暂无资料"):
                target[key] = value


def _format_yyyymmdd(value: Any) -> str:
    text = str(value or "")
    if len(text) == 8 and text.isdigit():
        return f"{text[:4]}-{text[4:6]}-{text[6:]}"
    return "" if text in {"0", "-", "--"} else text


def _clean_text(value: Any) -> str:
    text = str(value or "").strip()
    return "" if text in {"-", "--", "None"} else text


def _strip_tags(value: str) -> str:
    text = re.sub(r"<[^>]+>", "", value)
    return re.sub(r"\s+", "", text)


def _decode_text(value: str) -> str:
    if "\\u" not in value:
        return value
    try:
        return value.encode("utf-8").decode("unicode_escape")
    except UnicodeDecodeError:
        return value


def _clean_hk_name(value: str) -> str:
    return value.replace("－", "-").replace("Ｗ", "W").replace("w", "-W") if value.endswith("w") else value
