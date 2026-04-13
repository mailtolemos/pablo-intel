"""
main.py — OilSentinel v3.0 main runtime.

Usage:
    python main.py            # Run continuously
    python main.py --test     # Test mode (no Telegram sends)
    python main.py --digest   # Send a single digest and exit
    python main.py --briefing # Send daily briefing and exit
    python main.py --calendar # Send weekly calendar and exit
"""
import argparse
import dataclasses
import hashlib
import logging
import signal
import sys
import time
from datetime import datetime, timezone
from typing import Optional

from config import get_config
from database import (
    init_db, save_article, mark_alerted, already_alerted,
    get_recent_articles, save_price, get_last_price,
    was_sent, record_sent, log_scheduler_event,
)
from ingestion import ingest_all
from analysis import AnalysisEngine
from telegram_bot import TelegramBot
from scheduler import EventScheduler, EVENTS
from prices import fetch_all_prices, price_moved, PriceSnapshot

# ── Optional EIA fetcher ───────────────────────────────────────────────────────
try:
    from eia_fetcher import EIAFetcher
    HAS_EIA = True
except ImportError:
    HAS_EIA = False


VERSION = "3.0"


def setup_logging(level: str, log_file: str) -> None:
    fmt = "%(asctime)s [%(levelname)-8s] %(name)s — %(message)s"
    handlers = [
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(log_file, encoding="utf-8"),
    ]
    logging.basicConfig(level=getattr(logging, level, logging.INFO),
                        format=fmt, handlers=handlers)


log = logging.getLogger("oil_sentinel")


class OilSentinel:
    """
    Main controller class. Orchestrates ingestion, scoring,
    Telegram delivery, price monitoring, and event scheduling.
    """

    def __init__(self, test_mode: bool = False):
        self.cfg        = get_config()
        self.test_mode  = test_mode
        self.running    = False
        self._last_digest   = datetime.now(timezone.utc)
        self._last_briefing: Optional[datetime] = None

        # Warn on missing config
        for warning in self.cfg.validate():
            log.warning(warning)

        # Init subsystems
        init_db(self.cfg.db_path)
        self.engine = AnalysisEngine(
            flash_threshold=self.cfg.flash_score_threshold,
            analysis_threshold=self.cfg.analysis_score_threshold,
        )
        self.bot = TelegramBot(
            token=self.cfg.telegram_token,
            chat_id=self.cfg.telegram_chat_id,
        )
        self.scheduler = EventScheduler(
            events=EVENTS,
            reminder_minutes=self.cfg.reminder_minutes_before,
            on_reminder=self._on_reminder,
            on_fire=self._on_event_fire,
        )
        self.eia: Optional[object] = None
        if HAS_EIA and self.cfg.eia_api_key:
            self.eia = EIAFetcher(self.cfg.eia_api_key)
            log.info("EIA fetcher active")

    # ── Scheduler callbacks ───────────────────────────────────────────────────

    def _on_reminder(self, event, fire_time) -> None:
        msg = self.scheduler.reminder_message(event, fire_time)
        self._send(msg, "reminder", event.name)
        log_scheduler_event(self.cfg.db_path, event.name + " [reminder]", True)

    def _on_event_fire(self, event, now) -> None:
        msg = self.scheduler.announcement_message(event)
        self._send(msg, "event", event.name)
        log_scheduler_event(self.cfg.db_path, event.name, True)

        # If EIA fires and we have API key, fetch live data
        if self.eia and "EIA Weekly" in event.name:
            self._fetch_and_send_eia()

    # ── EIA live fetch ────────────────────────────────────────────────────────

    def _fetch_and_send_eia(self) -> None:
        if not self.eia:
            return
        try:
            inv = self.eia.crude_inventory_latest()
            if inv:
                msg = self.eia.format_inventory_alert(inv)
                self._send(msg, "eia_inventory", inv["period"])
        except Exception as e:
            log.error("EIA fetch error: %s", e)

    # ── Send helper ───────────────────────────────────────────────────────────

    def _send(self, text: str, alert_type: str = "general", ref_id: str = "") -> bool:
        msg_hash = hashlib.sha1(text[:200].encode()).hexdigest()[:16]

        # Deduplicate: don't send same message twice within 6h
        if was_sent(self.cfg.db_path, msg_hash, hours=6):
            log.debug("Skipping duplicate: %s", ref_id)
            return False

        if self.test_mode:
            log.info("[TEST MODE] Would send:\n%s\n", text[:300])
            return True

        ok = self.bot.send(text)
        if ok:
            record_sent(self.cfg.db_path, alert_type, ref_id, msg_hash)
        return ok

    # ── News cycle ────────────────────────────────────────────────────────────

    def poll_news(self) -> None:
        log.info("Polling %d RSS feeds…", len(__import__("ingestion").RSS_FEEDS))
        raw_articles = ingest_all(timeout=self.cfg.feed_timeout)

        flash_sent = 0
        analysis_sent = 0

        for raw in raw_articles:
            scored = self.engine.process(
                id=raw["id"],
                title=raw["title"],
                source=raw.get("source", ""),
                url=raw.get("url", ""),
                published=raw.get("published", ""),
                summary=raw.get("summary", ""),
                topic=raw.get("topic", ""),
            )

            # Persist
            is_new = save_article(self.cfg.db_path, dataclasses.asdict(scored))
            if not is_new:
                continue  # already processed

            if scored.tier == "ignore":
                continue

            already = already_alerted(self.cfg.db_path, scored.id)
            if already:
                continue

            # Send alerts
            if scored.tier == "flash":
                msg = self.bot.flash_alert(dataclasses.asdict(scored))
                if self._send(msg, "flash", scored.id):
                    mark_alerted(self.cfg.db_path, scored.id)
                    flash_sent += 1

            elif scored.tier == "analysis" and not already:
                msg = self.bot.analysis_alert(dataclasses.asdict(scored))
                if self._send(msg, "analysis", scored.id):
                    mark_alerted(self.cfg.db_path, scored.id)
                    analysis_sent += 1

        log.info(
            "News cycle: %d articles, %d flash, %d analysis alerts sent",
            len(raw_articles), flash_sent, analysis_sent,
        )

    # ── Price cycle ───────────────────────────────────────────────────────────

    def poll_prices(self) -> list[dict]:
        snapshots = fetch_all_prices(timeout=7)

        price_dicts = []
        for snap in snapshots:
            save_price(self.cfg.db_path, snap.symbol, snap.price, snap.change_pct)
            price_dicts.append(dataclasses.asdict(snap))

            # Alert on significant moves
            if price_moved(snap, self.cfg.price_move_pct):
                last = get_last_price(self.cfg.db_path, snap.symbol)
                if last:
                    prev_price = last["price"]
                    if abs(snap.price - prev_price) / prev_price * 100 >= self.cfg.price_move_pct:
                        msg = self.bot.price_alert(
                            snap.symbol, snap.price, snap.change_pct, prev_price
                        )
                        self._send(msg, "price_alert", f"{snap.symbol}:{snap.price}")

        log.info(
            "Prices: %s",
            "  ".join(f"{p['symbol']} ${p['price']:.2f} ({p['change_pct']:+.1f}%)"
                      for p in price_dicts[:3]),
        )
        return price_dicts

    # ── Digest ────────────────────────────────────────────────────────────────

    def send_digest(self) -> None:
        articles = get_recent_articles(self.cfg.db_path, hours=2, min_score=30)
        prices   = self.poll_prices()
        msg = self.bot.digest(articles, prices)
        self._send(msg, "digest", "2h")
        self._last_digest = datetime.now(timezone.utc)
        log.info("Sent 2h digest with %d articles", len(articles))

    # ── Daily briefing ────────────────────────────────────────────────────────

    def send_briefing(self) -> None:
        articles = get_recent_articles(self.cfg.db_path, hours=24, min_score=25)
        prices   = self.poll_prices()
        msg = self.bot.daily_briefing(articles, prices)
        self._send(msg, "daily_briefing", datetime.now(timezone.utc).date().isoformat())
        self._last_briefing = datetime.now(timezone.utc)
        log.info("Sent daily briefing with %d articles", len(articles))

    # ── Calendar ──────────────────────────────────────────────────────────────

    def send_calendar(self) -> None:
        events = self.scheduler.list_week()
        msg    = self.bot.weekly_calendar(events)
        self._send(msg, "calendar", "weekly")
        log.info("Sent weekly calendar with %d events", len(events))

    # ── Startup ───────────────────────────────────────────────────────────────

    def startup(self) -> None:
        log.info("OilSentinel v%s starting", VERSION)
        startup_msg = self.bot.startup_message(VERSION)
        self._send(startup_msg, "startup", "boot")
        self.send_calendar()

    # ── Main loop ─────────────────────────────────────────────────────────────

    def run(self) -> None:
        self.running = True
        self.startup()

        last_news_poll  = 0.0
        last_price_poll = 0.0

        log.info("Entering main loop. Ctrl-C to stop.")

        while self.running:
            now_ts = time.time()

            # ── News polling ──────────────────────────────────────────────────
            if now_ts - last_news_poll >= self.cfg.news_poll_interval:
                try:
                    self.poll_news()
                except Exception as e:
                    log.error("News poll error: %s", e)
                last_news_poll = now_ts

            # ── Price polling ─────────────────────────────────────────────────
            if now_ts - last_price_poll >= self.cfg.price_poll_interval:
                try:
                    self.poll_prices()
                except Exception as e:
                    log.error("Price poll error: %s", e)
                last_price_poll = now_ts

            # ── Scheduler tick ────────────────────────────────────────────────
            try:
                self.scheduler.tick()
            except Exception as e:
                log.error("Scheduler tick error: %s", e)

            # ── 2-hour digest ─────────────────────────────────────────────────
            now_utc = datetime.now(timezone.utc)
            elapsed_digest = (now_utc - self._last_digest).total_seconds()
            if elapsed_digest >= self.cfg.digest_interval:
                try:
                    self.send_digest()
                except Exception as e:
                    log.error("Digest error: %s", e)

            # ── Daily briefing (once per day at 06:00 UTC) ────────────────────
            if (
                now_utc.hour == 6 and now_utc.minute < 5
                and (
                    self._last_briefing is None
                    or (now_utc - self._last_briefing).total_seconds() > 82800  # 23h
                )
            ):
                try:
                    self.send_briefing()
                except Exception as e:
                    log.error("Briefing error: %s", e)

            time.sleep(60)  # tick every minute

    def shutdown(self) -> None:
        log.info("Shutting down OilSentinel…")
        self.running = False


# ── Entry point ───────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="OilSentinel v3.0")
    parser.add_argument("--test",     action="store_true", help="Test mode — no Telegram sends")
    parser.add_argument("--digest",   action="store_true", help="Send a digest and exit")
    parser.add_argument("--briefing", action="store_true", help="Send daily briefing and exit")
    parser.add_argument("--calendar", action="store_true", help="Send weekly calendar and exit")
    args = parser.parse_args()

    cfg = get_config()
    setup_logging(cfg.log_level, cfg.log_file)

    sentinel = OilSentinel(test_mode=args.test)

    # Graceful shutdown on SIGTERM / SIGINT
    def _handle_signal(sig, frame):
        log.info("Signal %s received — shutting down", sig)
        sentinel.shutdown()
        sys.exit(0)

    signal.signal(signal.SIGINT,  _handle_signal)
    signal.signal(signal.SIGTERM, _handle_signal)

    # CLI single-shot modes
    if args.digest:
        sentinel.send_digest()
        return
    if args.briefing:
        sentinel.send_briefing()
        return
    if args.calendar:
        sentinel.send_calendar()
        return

    # Continuous run
    sentinel.run()


if __name__ == "__main__":
    main()
