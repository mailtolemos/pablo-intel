"""
config.py — OilSentinel configuration
All values loaded from environment variables with safe defaults.
"""
import os
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class Config:
    # ── Telegram ────────────────────────────────────────────────────────────────
    telegram_token: str = field(
        default_factory=lambda: os.getenv(
            "TELEGRAM_TOKEN",
            "8765231096:AAHpncIbzIu2c9-i7ZQ9l5AwoKvdX1LxfV4",
        )
    )
    telegram_chat_id: Optional[str] = field(
        default_factory=lambda: os.getenv("TELEGRAM_CHAT_ID")
    )

    # ── EIA API ──────────────────────────────────────────────────────────────────
    eia_api_key: Optional[str] = field(
        default_factory=lambda: os.getenv("EIA_API_KEY")
    )

    # ── Polling intervals (seconds) ──────────────────────────────────────────────
    news_poll_interval: int = int(os.getenv("NEWS_POLL_INTERVAL", "300"))      # 5 min
    price_poll_interval: int = int(os.getenv("PRICE_POLL_INTERVAL", "120"))    # 2 min
    digest_interval: int = int(os.getenv("DIGEST_INTERVAL", "7200"))          # 2 hours

    # ── Alert thresholds ─────────────────────────────────────────────────────────
    flash_score_threshold: int = int(os.getenv("FLASH_SCORE", "75"))
    analysis_score_threshold: int = int(os.getenv("ANALYSIS_SCORE", "50"))
    price_move_pct: float = float(os.getenv("PRICE_MOVE_PCT", "1.5"))         # % move triggers alert

    # ── Database ─────────────────────────────────────────────────────────────────
    db_path: str = os.getenv("DB_PATH", "oil_sentinel.db")

    # ── Logging ──────────────────────────────────────────────────────────────────
    log_level: str = os.getenv("LOG_LEVEL", "INFO")
    log_file: str = os.getenv("LOG_FILE", "oil_sentinel.log")

    # ── Feed request timeout ──────────────────────────────────────────────────────
    feed_timeout: int = int(os.getenv("FEED_TIMEOUT", "8"))

    # ── Event reminders ─────────────────────────────────────────────────────────
    reminder_minutes_before: int = int(os.getenv("REMINDER_MINUTES", "30"))

    def validate(self) -> list[str]:
        """Return list of warning messages for missing optional config."""
        warnings = []
        if not self.telegram_token:
            warnings.append("TELEGRAM_TOKEN not set — Telegram alerts disabled")
        if not self.telegram_chat_id:
            warnings.append("TELEGRAM_CHAT_ID not set — will discover from bot updates")
        if not self.eia_api_key:
            warnings.append("EIA_API_KEY not set — live EIA data disabled (using schedule only)")
        return warnings


# Singleton
_config: Optional[Config] = None


def get_config() -> Config:
    global _config
    if _config is None:
        _config = Config()
    return _config
