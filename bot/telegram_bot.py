"""
telegram_bot.py — OilSentinel Telegram notification module.
Handles chat ID discovery, message formatting, and delivery.
"""
import logging
import hashlib
import time
import requests
from typing import Optional

log = logging.getLogger(__name__)

_BASE = "https://api.telegram.org/bot{token}/{method}"

# Character limits
MAX_MSG_LEN = 4096


class TelegramBot:
    def __init__(self, token: str, chat_id: Optional[str] = None):
        self.token   = token
        self.chat_id = chat_id
        self._discovered_ids: list[str] = []
        if chat_id:
            self._discovered_ids = [chat_id]

    # ── Low-level API ──────────────────────────────────────────────────────────

    def _api(self, method: str, payload: dict, retries: int = 2) -> Optional[dict]:
        url = _BASE.format(token=self.token, method=method)
        for attempt in range(retries + 1):
            try:
                r = requests.post(url, json=payload, timeout=10)
                data = r.json()
                if data.get("ok"):
                    return data
                log.warning("Telegram API error [%s]: %s", method, data.get("description"))
                return None
            except requests.exceptions.Timeout:
                log.warning("Telegram timeout on attempt %d/%d", attempt + 1, retries + 1)
                if attempt < retries:
                    time.sleep(1.5)
            except Exception as e:
                log.error("Telegram request error: %s", e)
                return None
        return None

    # ── Chat ID discovery ──────────────────────────────────────────────────────

    def discover_chat_ids(self) -> list[str]:
        """
        Pull recent updates from the bot to discover chat IDs.
        Works for private chats, groups, and channels.
        """
        data = self._api("getUpdates", {"limit": 100, "offset": -100})
        if not data:
            return self._discovered_ids

        ids: set[str] = set()
        for update in data.get("result", []):
            for key in ("message", "channel_post", "my_chat_member", "edited_message"):
                chat = (update.get(key) or {}).get("chat")
                if chat and chat.get("id"):
                    ids.add(str(chat["id"]))

        if ids:
            self._discovered_ids = list(ids)
            log.info("Discovered Telegram chat IDs: %s", self._discovered_ids)

        return self._discovered_ids

    def get_chat_ids(self) -> list[str]:
        if not self._discovered_ids:
            self.discover_chat_ids()
        return self._discovered_ids

    # ── Send ──────────────────────────────────────────────────────────────────

    def send(self, text: str, parse_mode: str = "HTML") -> bool:
        """Send text to all known chat IDs. Returns True if at least one succeeded."""
        ids = self.get_chat_ids()
        if not ids:
            log.warning("No Telegram chat IDs available — message not sent")
            return False

        text = text[:MAX_MSG_LEN]
        success = False
        for cid in ids:
            result = self._api("sendMessage", {
                "chat_id":    cid,
                "text":       text,
                "parse_mode": parse_mode,
                "disable_web_page_preview": True,
            })
            if result:
                success = True
        return success

    # ── Formatted message builders ────────────────────────────────────────────

    def flash_alert(self, article: dict) -> str:
        direction_icon = (
            "🔴" if article.get("direction") == "bearish"
            else "🟢" if article.get("direction") == "bullish"
            else "🟡"
        )
        drivers = ", ".join(article.get("drivers", [])[:3]) or "general"
        return (
            f"⚡ <b>FLASH ALERT — OIL SENTINEL</b>\n"
            f"{'━' * 32}\n"
            f"<b>{article['title']}</b>\n\n"
            f"📡 Source: {article.get('source', 'Unknown')}\n"
            f"🎯 Score: {article.get('score', 0)}/100  |  "
            f"{direction_icon} {article.get('direction', 'neutral').upper()}\n"
            f"🔑 Drivers: {drivers}\n\n"
            f"📝 {article.get('summary', '')[:280]}\n\n"
            f"<b>📊 Bias:</b> {article.get('bias_label', '')}\n"
            f"<b>⚡ Action:</b> {article.get('action_text', '')}\n\n"
            f"🔗 <a href='{article.get('url', '')}'>Read more</a>"
        )

    def analysis_alert(self, article: dict) -> str:
        direction_icon = (
            "📉" if article.get("direction") == "bearish"
            else "📈" if article.get("direction") == "bullish"
            else "↔️"
        )
        drivers = ", ".join(article.get("drivers", [])[:3]) or "general"
        return (
            f"📊 <b>OIL SENTINEL — Analysis</b>\n"
            f"{'─' * 28}\n"
            f"<b>{article['title']}</b>\n\n"
            f"📡 Source: {article.get('source', 'Unknown')}\n"
            f"🎯 Score: {article.get('score', 0)}/100  "
            f"{direction_icon} {article.get('direction', 'neutral').upper()}\n"
            f"🔑 Drivers: {drivers}\n\n"
            f"<b>📊 Bias:</b> {article.get('bias_label', '')}\n"
            f"<b>⚡ Next step:</b> {article.get('action_text', '')}\n\n"
            f"🔗 <a href='{article.get('url', '')}'>Source</a>"
        )

    def price_alert(
        self,
        symbol: str,
        price: float,
        change_pct: float,
        prev_price: float,
    ) -> str:
        icon = "🔺" if change_pct > 0 else "🔻"
        move = abs(change_pct)
        return (
            f"{icon} <b>PRICE ALERT — {symbol}</b>\n"
            f"{'─' * 24}\n"
            f"Current: <b>${price:.2f}</b>\n"
            f"Move:    {'+' if change_pct>0 else ''}{change_pct:.2f}%  "
            f"(prev ${prev_price:.2f})\n\n"
            f"<b>⚡ Action:</b> "
            + (
                f"Brent {'+' if change_pct > 0 else ''}{move:.1f}% — "
                f"watch for momentum continuation or fade at key levels."
                if symbol in ("BRT", "WTI")
                else f"{symbol} moved {move:.1f}% — monitor for correlated moves."
            )
        )

    def digest(self, articles: list[dict], prices: list[dict]) -> str:
        lines = [
            "🛢 <b>OIL SENTINEL — 2-Hour Digest</b>",
            "━" * 32,
            "",
        ]

        # Prices
        if prices:
            lines.append("💹 <b>PRICES</b>")
            for p in prices[:4]:
                arrow = "▲" if p.get("change_pct", 0) > 0 else "▼" if p.get("change_pct", 0) < 0 else "─"
                lines.append(
                    f"  {p['symbol']:5s}  ${p['price']:.2f}  "
                    f"{arrow} {p.get('change_pct', 0):+.2f}%"
                )
            lines.append("")

        # Top stories
        if articles:
            lines.append("📰 <b>TOP STORIES</b>")
            for a in articles[:5]:
                direction_icon = "🟢" if a.get("direction") == "bullish" else "🔴" if a.get("direction") == "bearish" else "🟡"
                lines.append(f"  {direction_icon} {a['title'][:75]}")
                lines.append(f"     Score {a.get('score',0)} · {a.get('source','')}")
                lines.append("")

        # Bias summary
        bullish = sum(1 for a in articles if a.get("direction") == "bullish")
        bearish = sum(1 for a in articles if a.get("direction") == "bearish")
        if bullish + bearish > 0:
            lines.append("📊 <b>SENTIMENT</b>")
            lines.append(
                f"  Bullish signals: {bullish}  |  Bearish: {bearish}  "
                f"|  Ratio: {bullish/(bullish+bearish):.0%} bull"
            )
            lines.append("")

        lines.append("⏰ Next digest in ~2 hours")
        return "\n".join(lines)

    def daily_briefing(self, articles: list[dict], prices: list[dict]) -> str:
        from datetime import datetime, timezone
        today = datetime.now(timezone.utc).strftime("%A %d %B %Y")

        lines = [
            f"🌅 <b>OIL SENTINEL — DAILY BRIEFING</b>",
            f"📅 {today} UTC",
            "━" * 36,
            "",
        ]

        # Price overview
        if prices:
            lines.append("💹 <b>MARKET OVERVIEW</b>")
            for p in prices:
                arrow = "▲" if p.get("change_pct", 0) > 0 else "▼" if p.get("change_pct", 0) < 0 else "─"
                lines.append(
                    f"  {p['symbol']:5s}  ${p['price']:.2f}  "
                    f"{arrow} {p.get('change_pct', 0):+.2f}%"
                )
            lines.append("")

        # Top 7 stories
        if articles:
            lines.append("📰 <b>KEY DEVELOPMENTS (Last 24h)</b>")
            for a in articles[:7]:
                d_icon = "🟢" if a.get("direction") == "bullish" else "🔴" if a.get("direction") == "bearish" else "🟡"
                lines.append(f"  {d_icon} {a['title'][:80]}")
                lines.append(f"     ↳ {a.get('source','')} · Score {a.get('score',0)}")
                if a.get("bias_label"):
                    lines.append(f"     ↳ {a['bias_label']}")
                lines.append("")

        # Outlook
        bullish = sum(1 for a in articles if a.get("direction") == "bullish")
        bearish = sum(1 for a in articles if a.get("direction") == "bearish")
        total   = bullish + bearish
        if total:
            overall = "BULLISH" if bullish/total > 0.6 else "BEARISH" if bearish/total > 0.6 else "MIXED"
            lines.append(f"🔮 <b>24h OUTLOOK: {overall}</b>")
            lines.append(
                f"  {bullish} bullish vs {bearish} bearish signals "
                f"({bullish/total:.0%} bull tone)"
            )
            lines.append("")

        lines.append("💡 Sent by OilSentinel · All information for analysis only")
        return "\n".join(lines)

    def weekly_calendar(self, events: list[dict]) -> str:
        """Format this week's market event calendar."""
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc)
        week_str = now.strftime("Week of %d %b %Y")

        lines = [
            f"📅 <b>OIL MARKET CALENDAR — {week_str}</b>",
            "━" * 36,
            "",
        ]

        if not events:
            lines.append("  No scheduled events this week.")
        else:
            for evt in events:
                dt_str  = evt.get("display_time", evt.get("name", ""))
                name    = evt.get("name", "")
                icon    = evt.get("icon", "📌")
                detail  = evt.get("detail", "")
                lines.append(f"{icon} <b>{name}</b>")
                if dt_str:
                    lines.append(f"   ⏰ {dt_str}")
                if detail:
                    lines.append(f"   ℹ️ {detail}")
                lines.append("")

        lines.append("⚡ Reminders sent 30 min before each release")
        return "\n".join(lines)

    def startup_message(self, version: str = "3.0") -> str:
        return (
            f"🚀 <b>OilSentinel v{version} — ONLINE</b>\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"✅ News ingestion: {len(__import__('ingestion').RSS_FEEDS)} feeds\n"
            f"✅ Analysis engine: active\n"
            f"✅ Price tracking: Yahoo Finance\n"
            f"✅ Scheduler: market calendar loaded\n"
            f"✅ Telegram: connected\n\n"
            f"📡 Monitoring oil markets 24/7\n"
            f"⚡ Flash alerts · 📊 Analysis · 📅 Events\n"
            f"🛢 <i>Intelligence, not summaries.</i>"
        )
