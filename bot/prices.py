"""
prices.py — OilSentinel price fetching module.
Pulls live commodity prices from Yahoo Finance.
"""
import logging
from dataclasses import dataclass
from typing import Optional
import requests

log = logging.getLogger(__name__)

COMMODITIES = [
    {"ticker": "BZ=F",  "symbol": "BRT", "name": "Brent Crude",    "unit": "USD/bbl"},
    {"ticker": "CL=F",  "symbol": "WTI", "name": "WTI Crude",      "unit": "USD/bbl"},
    {"ticker": "NG=F",  "symbol": "HH",  "name": "Henry Hub Gas",  "unit": "USD/MMBtu"},
    {"ticker": "HO=F",  "symbol": "GO",  "name": "Gasoil / Diesel","unit": "USD/gal"},
    {"ticker": "RB=F",  "symbol": "RB",  "name": "RBOB Gasoline",  "unit": "USD/gal"},
]

_FALLBACK_PRICES = {
    "BRT": 82.0, "WTI": 78.0, "HH": 2.35, "GO": 2.72, "RB": 2.50,
}


@dataclass
class PriceSnapshot:
    symbol:     str
    name:       str
    price:      float
    change:     float
    change_pct: float
    high:       float
    low:        float
    unit:       str
    trend:      str   # "up" | "down" | "flat"
    source:     str = "yahoo"


def fetch_yahoo_quote(ticker: str, timeout: int = 7) -> Optional[dict]:
    url = (
        f"https://query1.finance.yahoo.com/v8/finance/chart/"
        f"{ticker}?interval=1d&range=5d"
    )
    try:
        r = requests.get(
            url,
            headers={"User-Agent": "Mozilla/5.0"},
            timeout=timeout,
        )
        r.raise_for_status()
        return r.json()
    except requests.exceptions.Timeout:
        log.warning("Timeout fetching %s", ticker)
    except Exception as e:
        log.warning("Error fetching %s: %s", ticker, e)
    return None


def fetch_all_prices(timeout: int = 7) -> list[PriceSnapshot]:
    """
    Fetch all commodity prices concurrently.
    Falls back to last known or mock price on failure.
    """
    import concurrent.futures

    results: list[PriceSnapshot] = []

    def _fetch(commodity: dict) -> Optional[PriceSnapshot]:
        data = fetch_yahoo_quote(commodity["ticker"], timeout)
        if not data:
            fallback = _FALLBACK_PRICES.get(commodity["symbol"], 0.0)
            return PriceSnapshot(
                symbol=commodity["symbol"], name=commodity["name"],
                price=fallback, change=0, change_pct=0,
                high=fallback, low=fallback, unit=commodity["unit"],
                trend="flat", source="fallback",
            )
        try:
            meta  = data["chart"]["result"][0]["meta"]
            price = meta.get("regularMarketPrice", 0)
            prev  = meta.get("chartPreviousClose", price)
            chg   = price - prev
            pct   = (chg / prev * 100) if prev else 0
            return PriceSnapshot(
                symbol=commodity["symbol"],
                name=commodity["name"],
                price=round(price, 2),
                change=round(chg, 2),
                change_pct=round(pct, 2),
                high=round(meta.get("regularMarketDayHigh", price), 2),
                low=round(meta.get("regularMarketDayLow", price), 2),
                unit=commodity["unit"],
                trend="up" if pct > 0.1 else "down" if pct < -0.1 else "flat",
            )
        except (KeyError, IndexError, TypeError) as e:
            log.warning("Parse error for %s: %s", commodity["symbol"], e)
            fallback = _FALLBACK_PRICES.get(commodity["symbol"], 0.0)
            return PriceSnapshot(
                symbol=commodity["symbol"], name=commodity["name"],
                price=fallback, change=0, change_pct=0,
                high=fallback, low=fallback, unit=commodity["unit"],
                trend="flat", source="fallback",
            )

    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        futs = [pool.submit(_fetch, c) for c in COMMODITIES]
        for fut in concurrent.futures.as_completed(futs):
            snap = fut.result()
            if snap:
                results.append(snap)

    # Sort in preferred display order
    order = ["BRT", "WTI", "HH", "GO", "RB"]
    results.sort(key=lambda p: order.index(p.symbol) if p.symbol in order else 99)
    return results


def price_moved(snap: PriceSnapshot, threshold_pct: float = 1.5) -> bool:
    return abs(snap.change_pct) >= threshold_pct
