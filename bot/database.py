"""
database.py — OilSentinel SQLite persistence layer.
Stores articles, price snapshots, sent alerts, and scheduler state.
"""
import sqlite3
import logging
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Optional

log = logging.getLogger(__name__)


def init_db(db_path: str) -> None:
    """Create all tables if they don't exist."""
    with _connect(db_path) as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS articles (
                id          TEXT PRIMARY KEY,
                title       TEXT NOT NULL,
                source      TEXT,
                url         TEXT,
                published   TEXT,
                summary     TEXT,
                score       INTEGER DEFAULT 0,
                tier        TEXT,
                direction   TEXT,
                drivers     TEXT,
                category    TEXT,
                is_breaking INTEGER DEFAULT 0,
                alerted     INTEGER DEFAULT 0,
                created_at  TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS price_snapshots (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                symbol      TEXT NOT NULL,
                price       REAL NOT NULL,
                change_pct  REAL,
                recorded_at TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS sent_alerts (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                alert_type  TEXT,
                ref_id      TEXT,
                message_hash TEXT,
                sent_at     TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS scheduler_log (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                event_name  TEXT,
                fired_at    TEXT DEFAULT (datetime('now')),
                message_sent INTEGER DEFAULT 0
            );

            CREATE INDEX IF NOT EXISTS idx_articles_score    ON articles(score DESC);
            CREATE INDEX IF NOT EXISTS idx_articles_created  ON articles(created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_prices_symbol     ON price_snapshots(symbol, recorded_at DESC);
            CREATE INDEX IF NOT EXISTS idx_alerts_ref        ON sent_alerts(ref_id);
        """)
    log.info("Database initialised at %s", db_path)


@contextmanager
def _connect(db_path: str):
    conn = sqlite3.connect(db_path, detect_types=sqlite3.PARSE_DECLTYPES)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# ── Articles ─────────────────────────────────────────────────────────────────

def save_article(db_path: str, article: dict) -> bool:
    """Insert article. Returns True if new, False if already existed."""
    try:
        with _connect(db_path) as conn:
            conn.execute("""
                INSERT OR IGNORE INTO articles
                    (id, title, source, url, published, summary, score, tier,
                     direction, drivers, category, is_breaking)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                article["id"], article["title"], article.get("source", ""),
                article.get("url", ""), article.get("published", ""),
                article.get("summary", ""), article.get("score", 0),
                article.get("tier", "standard"), article.get("direction", "neutral"),
                ",".join(article.get("drivers", [])), article.get("category", "general"),
                int(article.get("is_breaking", False)),
            ))
            return conn.execute(
                "SELECT changes()"
            ).fetchone()[0] > 0
    except Exception as e:
        log.error("save_article error: %s", e)
        return False


def mark_alerted(db_path: str, article_id: str) -> None:
    with _connect(db_path) as conn:
        conn.execute("UPDATE articles SET alerted=1 WHERE id=?", (article_id,))


def already_alerted(db_path: str, article_id: str) -> bool:
    with _connect(db_path) as conn:
        row = conn.execute(
            "SELECT alerted FROM articles WHERE id=?", (article_id,)
        ).fetchone()
        return bool(row and row["alerted"])


def get_recent_articles(db_path: str, hours: int = 24, min_score: int = 0) -> list[dict]:
    with _connect(db_path) as conn:
        rows = conn.execute("""
            SELECT * FROM articles
            WHERE created_at > datetime('now', ? || ' hours')
            AND score >= ?
            ORDER BY score DESC, created_at DESC
            LIMIT 50
        """, (f"-{hours}", min_score)).fetchall()
        return [dict(r) for r in rows]


# ── Prices ────────────────────────────────────────────────────────────────────

def save_price(db_path: str, symbol: str, price: float, change_pct: float) -> None:
    with _connect(db_path) as conn:
        conn.execute(
            "INSERT INTO price_snapshots (symbol, price, change_pct) VALUES (?, ?, ?)",
            (symbol, price, change_pct),
        )


def get_last_price(db_path: str, symbol: str) -> Optional[dict]:
    with _connect(db_path) as conn:
        row = conn.execute("""
            SELECT * FROM price_snapshots
            WHERE symbol=?
            ORDER BY recorded_at DESC LIMIT 1
        """, (symbol,)).fetchone()
        return dict(row) if row else None


# ── Alert deduplication ───────────────────────────────────────────────────────

def was_sent(db_path: str, msg_hash: str, hours: int = 6) -> bool:
    """Return True if this message hash was sent in the last N hours."""
    with _connect(db_path) as conn:
        row = conn.execute("""
            SELECT 1 FROM sent_alerts
            WHERE message_hash=?
            AND sent_at > datetime('now', ? || ' hours')
        """, (msg_hash, f"-{hours}")).fetchone()
        return row is not None


def record_sent(db_path: str, alert_type: str, ref_id: str, msg_hash: str) -> None:
    with _connect(db_path) as conn:
        conn.execute(
            "INSERT INTO sent_alerts (alert_type, ref_id, message_hash) VALUES (?, ?, ?)",
            (alert_type, ref_id, msg_hash),
        )


def log_scheduler_event(db_path: str, event_name: str, sent: bool) -> None:
    with _connect(db_path) as conn:
        conn.execute(
            "INSERT INTO scheduler_log (event_name, message_sent) VALUES (?, ?)",
            (event_name, int(sent)),
        )
