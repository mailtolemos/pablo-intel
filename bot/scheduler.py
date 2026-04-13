"""
scheduler.py — OilSentinel market event scheduler.
Tracks weekly/monthly oil market data releases.
Fires reminders N minutes before, and announcements on release.
"""
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Callable, Optional

log = logging.getLogger(__name__)

# ── Event definitions ─────────────────────────────────────────────────────────

@dataclass
class MarketEvent:
    name:         str
    icon:         str
    detail:       str
    recurrence:   str        # "weekly" | "monthly" | "biweekly"
    weekday:      Optional[int] = None   # 0=Mon … 6=Sun
    hour_et:      int = 10              # hour in US/Eastern (approx UTC-4 summer)
    minute_et:    int = 30
    day_of_month: Optional[int] = None  # for monthly events
    week_of_month:Optional[int] = None  # 1-5, for "Nth weekday of month"
    last_fired:   Optional[datetime] = field(default=None, repr=False)
    last_reminded:Optional[datetime] = field(default=None, repr=False)


# All major oil market data releases
EVENTS: list[MarketEvent] = [
    MarketEvent(
        name         = "API Weekly Crude Inventories",
        icon         = "⛽",
        detail       = "American Petroleum Institute weekly crude oil and product stock changes. Published Tuesday ~4:30 PM ET. Market-moving if vs consensus.",
        recurrence   = "weekly",
        weekday      = 1,    # Tuesday
        hour_et      = 16,
        minute_et    = 30,
    ),
    MarketEvent(
        name         = "EIA Weekly Petroleum Status Report",
        icon         = "📊",
        detail       = "US Energy Information Administration official weekly crude + product inventories. Published Wednesday ~10:30 AM ET. Most closely watched weekly release.",
        recurrence   = "weekly",
        weekday      = 2,    # Wednesday
        hour_et      = 10,
        minute_et    = 30,
    ),
    MarketEvent(
        name         = "Baker Hughes Rig Count",
        icon         = "⚙️",
        detail       = "Weekly count of active US oil and gas drilling rigs. Published Friday ~1:00 PM ET. Leading indicator of US output growth/decline.",
        recurrence   = "weekly",
        weekday      = 4,    # Friday
        hour_et      = 13,
        minute_et    = 0,
    ),
    MarketEvent(
        name         = "CFTC Commitments of Traders (COT)",
        icon         = "📋",
        detail       = "CFTC speculative positioning report for WTI and Brent futures. Published Friday, data as of Tuesday, released ~3:30 PM ET. Watch net-long positioning for crowding signals.",
        recurrence   = "weekly",
        weekday      = 4,    # Friday
        hour_et      = 15,
        minute_et    = 30,
    ),
    MarketEvent(
        name         = "EIA Short-Term Energy Outlook (STEO)",
        icon         = "🔮",
        detail       = "Monthly EIA forecast for US/global oil and gas supply, demand, and price projections. Published first Tuesday after the 6th of each month.",
        recurrence   = "monthly",
        weekday      = 1,    # Tuesday (first after 6th)
        week_of_month= 2,    # approx second week
        hour_et      = 12,
        minute_et    = 0,
    ),
    MarketEvent(
        name         = "OPEC Monthly Oil Market Report (MOMR)",
        icon         = "🛢",
        detail       = "OPEC's official monthly supply/demand assessment, output data, and compliance table. Published mid-month. Includes individual member production figures.",
        recurrence   = "monthly",
        day_of_month = 13,
        hour_et      = 10,
        minute_et    = 0,
    ),
    MarketEvent(
        name         = "IEA Oil Market Report (OMR)",
        icon         = "🌍",
        detail       = "International Energy Agency monthly demand forecast and supply assessment. Published mid-month. Often diverges from OPEC — compare the two for full picture.",
        recurrence   = "monthly",
        day_of_month = 14,
        hour_et      = 9,
        minute_et    = 0,
    ),
]


def _et_to_utc_offset() -> int:
    """Rough ET→UTC offset. Summer (EDT) = +4, Winter (EST) = +5."""
    now = datetime.now()
    # Daylight saving: second Sunday of March → first Sunday of November
    year = now.year
    dst_start = _second_sunday(year, 3)
    dst_end   = _first_sunday(year, 11)
    if dst_start <= now.date() < dst_end:
        return 4   # EDT
    return 5       # EST


def _second_sunday(year: int, month: int) -> datetime.date.__class__:
    from datetime import date
    d = date(year, month, 1)
    sundays = 0
    while True:
        if d.weekday() == 6:
            sundays += 1
            if sundays == 2:
                return d
        d += timedelta(days=1)


def _first_sunday(year: int, month: int) -> datetime.date.__class__:
    from datetime import date
    d = date(year, month, 1)
    while d.weekday() != 6:
        d += timedelta(days=1)
    return d


def next_occurrence(event: MarketEvent, after: Optional[datetime] = None) -> datetime:
    """
    Calculate the next occurrence of a MarketEvent in UTC.
    """
    if after is None:
        after = datetime.now(timezone.utc)

    et_offset = _et_to_utc_offset()
    now_utc   = after

    if event.recurrence == "weekly":
        # Find next weekday ≥ today with correct hour
        for delta in range(8):
            candidate = now_utc + timedelta(days=delta)
            if candidate.weekday() == event.weekday:
                fire_utc = candidate.replace(
                    hour=event.hour_et + et_offset,
                    minute=event.minute_et,
                    second=0, microsecond=0,
                )
                if fire_utc > now_utc:
                    return fire_utc
        # Shouldn't reach here
        return now_utc + timedelta(days=7)

    elif event.recurrence == "monthly":
        # Simple: use day_of_month
        if event.day_of_month:
            for month_offset in range(3):
                y = now_utc.year + (now_utc.month + month_offset - 1) // 12
                m = (now_utc.month + month_offset - 1) % 12 + 1
                try:
                    candidate = now_utc.replace(
                        year=y, month=m, day=event.day_of_month,
                        hour=event.hour_et + et_offset,
                        minute=event.minute_et,
                        second=0, microsecond=0,
                    )
                    if candidate > now_utc:
                        return candidate
                except ValueError:
                    continue

    return now_utc + timedelta(days=30)


class EventScheduler:
    def __init__(
        self,
        events: list[MarketEvent],
        reminder_minutes: int = 30,
        on_reminder: Optional[Callable[[MarketEvent, datetime], None]] = None,
        on_fire:     Optional[Callable[[MarketEvent, datetime], None]] = None,
    ):
        self.events           = events
        self.reminder_minutes = reminder_minutes
        self.on_reminder      = on_reminder
        self.on_fire          = on_fire

    def tick(self) -> None:
        """
        Call this every minute (or frequently).
        Fires reminders and event announcements as appropriate.
        """
        now = datetime.now(timezone.utc)

        for event in self.events:
            next_occ = next_occurrence(event, after=now - timedelta(minutes=1))

            # ── Reminder ──────────────────────────────────────────────────────
            reminder_time = next_occ - timedelta(minutes=self.reminder_minutes)
            if (
                self.on_reminder
                and reminder_time <= now < next_occ
                and (
                    event.last_reminded is None
                    or (now - event.last_reminded).total_seconds() > 3600
                )
            ):
                log.info("Firing reminder for: %s", event.name)
                event.last_reminded = now
                self.on_reminder(event, next_occ)

            # ── Event fire ────────────────────────────────────────────────────
            window_start = next_occ - timedelta(seconds=30)
            window_end   = next_occ + timedelta(minutes=2)
            if (
                self.on_fire
                and window_start <= now <= window_end
                and (
                    event.last_fired is None
                    or (now - event.last_fired).total_seconds() > 3600
                )
            ):
                log.info("Firing event: %s", event.name)
                event.last_fired = now
                self.on_fire(event, now)

    def list_today(self) -> list[dict]:
        """Return today's scheduled events as dicts."""
        now = datetime.now(timezone.utc)
        today_events = []
        for event in self.events:
            occ = next_occurrence(event, after=now - timedelta(days=1))
            if occ.date() == now.date():
                today_events.append({
                    "name":         event.name,
                    "icon":         event.icon,
                    "detail":       event.detail,
                    "display_time": occ.strftime("%H:%M UTC"),
                    "dt":           occ,
                })
        today_events.sort(key=lambda e: e["dt"])
        return today_events

    def list_week(self) -> list[dict]:
        """Return all events in the next 7 days."""
        now    = datetime.now(timezone.utc)
        cutoff = now + timedelta(days=7)
        week_events = []

        for event in self.events:
            # Get up to 2 occurrences per event within the window
            cursor = now
            for _ in range(2):
                occ = next_occurrence(event, after=cursor)
                if occ > cutoff:
                    break
                week_events.append({
                    "name":         event.name,
                    "icon":         event.icon,
                    "detail":       event.detail,
                    "display_time": occ.strftime("%a %d %b %H:%M UTC"),
                    "dt":           occ,
                })
                cursor = occ + timedelta(hours=1)

        week_events.sort(key=lambda e: e["dt"])
        return week_events

    def format_today(self) -> str:
        events = self.list_today()
        if not events:
            return "📅 No major oil market releases scheduled today."
        lines = ["📅 <b>Today's Oil Market Events</b>\n"]
        for e in events:
            lines.append(f"{e['icon']} <b>{e['name']}</b>")
            lines.append(f"   ⏰ {e['display_time']}")
            lines.append(f"   ℹ️ {e['detail'][:120]}")
            lines.append("")
        return "\n".join(lines)

    def format_week(self) -> str:
        events = self.list_week()
        if not events:
            return "📅 No major oil market releases this week."
        lines = [
            f"📅 <b>This Week's Oil Market Calendar</b>\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        ]
        for e in events:
            lines.append(f"{e['icon']} <b>{e['name']}</b>")
            lines.append(f"   ⏰ {e['display_time']}")
            lines.append(f"   ℹ️ {e['detail'][:120]}")
            lines.append("")
        lines.append("⚡ Reminders sent 30 min before each release")
        return "\n".join(lines)

    def reminder_message(self, event: MarketEvent, fire_time: datetime) -> str:
        return (
            f"⏰ <b>REMINDER — {event.icon} {event.name}</b>\n"
            f"{'─' * 30}\n"
            f"Releases in <b>30 minutes</b> at {fire_time.strftime('%H:%M UTC')}\n\n"
            f"ℹ️ {event.detail}\n\n"
            f"💡 <i>Prepare your analysis. Price moves often occur within minutes of release.</i>"
        )

    def announcement_message(self, event: MarketEvent) -> str:
        return (
            f"{event.icon} <b>{event.name} — NOW RELEASED</b>\n"
            f"{'─' * 30}\n"
            f"ℹ️ {event.detail}\n\n"
            f"📡 Check Reuters, Bloomberg, or OilPrice.com for the data print.\n"
            f"⚡ <b>Action:</b> Compare actual vs consensus. Trade the deviation."
        )
