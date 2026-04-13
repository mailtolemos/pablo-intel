"""
eia_fetcher.py — OilSentinel EIA API integration.
Fetches live inventory and production data when EIA_API_KEY is set.
API docs: https://www.eia.gov/opendata/
"""
import logging
from typing import Optional
import requests

log = logging.getLogger(__name__)

EIA_BASE = "https://api.eia.gov/v2"


class EIAFetcher:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.session = requests.Session()
        self.session.headers["User-Agent"] = "OilSentinelBot/3.0"

    def _get(self, endpoint: str, params: dict) -> Optional[dict]:
        params["api_key"] = self.api_key
        try:
            r = self.session.get(
                f"{EIA_BASE}/{endpoint}",
                params=params,
                timeout=10,
            )
            r.raise_for_status()
            return r.json()
        except Exception as e:
            log.warning("EIA API error [%s]: %s", endpoint, e)
            return None

    def crude_inventory_latest(self) -> Optional[dict]:
        """
        Fetch latest weekly US crude oil inventory figure.
        Series: PET.WCESTUS1.W  (Weekly US Ending Stocks of Crude Oil, kb)
        """
        data = self._get("petroleum/sum/sndw/data/", {
            "frequency":    "weekly",
            "data[]":       "value",
            "facets[series][]": "WCESTUS1",
            "sort[0][column]": "period",
            "sort[0][direction]": "desc",
            "length": 5,
            "offset": 0,
        })
        if not data:
            return None
        try:
            rows  = data["response"]["data"]
            latest = rows[0]
            prev   = rows[1]
            change = float(latest["value"]) - float(prev["value"])
            return {
                "period":  latest["period"],
                "value_kb": float(latest["value"]),
                "change_kb": change,
                "direction": "draw" if change < 0 else "build",
            }
        except (KeyError, IndexError, TypeError) as e:
            log.warning("EIA parse error: %s", e)
            return None

    def us_production_latest(self) -> Optional[dict]:
        """
        Fetch latest US crude oil production.
        Series: PET.WCRFPUS2.W (Weekly US Field Production, kb/d)
        """
        data = self._get("petroleum/sum/sndw/data/", {
            "frequency":    "weekly",
            "data[]":       "value",
            "facets[series][]": "WCRFPUS2",
            "sort[0][column]": "period",
            "sort[0][direction]": "desc",
            "length": 4,
            "offset": 0,
        })
        if not data:
            return None
        try:
            rows   = data["response"]["data"]
            latest = rows[0]
            return {
                "period":   latest["period"],
                "kbd":      float(latest["value"]),
            }
        except (KeyError, IndexError, TypeError) as e:
            log.warning("EIA production parse error: %s", e)
            return None

    def format_inventory_alert(self, inv: dict) -> str:
        direction = inv["direction"].upper()
        icon      = "🟢" if direction == "DRAW" else "🔴"
        chg_mb    = abs(inv["change_kb"]) / 1000
        return (
            f"{icon} <b>EIA Crude Inventory — {direction}</b>\n"
            f"{'─' * 30}\n"
            f"Week ending: {inv['period']}\n"
            f"Change: <b>{'+' if inv['change_kb']>0 else ''}{inv['change_kb']/1000:.1f} Mb</b>  "
            f"({direction})\n"
            f"Stocks: {inv['value_kb']/1000:.0f} Mb\n\n"
            f"<b>⚡ Impact:</b> "
            + (
                f"Draw of {chg_mb:.1f} Mb tightens supply — "
                f"bullish if vs consensus. Watch Brent for gap-up."
                if direction == "DRAW"
                else
                f"Build of {chg_mb:.1f} Mb signals demand softness — "
                f"bearish. Monitor crack spreads for refinery response."
            )
        )
