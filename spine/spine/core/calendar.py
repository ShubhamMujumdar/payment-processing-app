"""Working-calendar arithmetic.

Custody time is measured in working hours, not wall-clock. A span running from
Friday 18:00 to Monday 10:00 is 64 raw hours and roughly 8 working ones, and
reporting the former makes every individual comparison meaningless.

Programme default is Asia/Kolkata, Mon-Fri, 09:30-18:30, taken from the
governance forum times in docs/requirements/index.md. IST has no daylight
saving, which removes the worst class of edge case.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone

IST = timezone(timedelta(minutes=330))


@dataclass(slots=True)
class WorkCalendar:
    tz: timezone = IST
    start_minute: int = 9 * 60 + 30
    end_minute: int = 18 * 60 + 30
    working_weekdays: frozenset[int] = frozenset({0, 1, 2, 3, 4})  # Mon-Fri
    holidays: frozenset[date] = field(default_factory=frozenset)
    #: True where the person's real calendar is unknown and this is the
    #: programme default. Spans derived with it are flagged rather than
    #: silently presented as measured.
    assumed: bool = False

    @property
    def working_seconds_per_day(self) -> int:
        return (self.end_minute - self.start_minute) * 60


PROGRAMME_DEFAULT = WorkCalendar(assumed=True)


def working_seconds(start: datetime, end: datetime, cal: WorkCalendar = PROGRAMME_DEFAULT) -> int:
    """Intersection of [start, end] with the calendar's working windows.

    Steps a day at a time rather than a minute at a time; the naive version is
    millions of iterations over a realistic span set.
    """
    if end <= start:
        return 0

    local_start = start.astimezone(cal.tz)
    local_end = end.astimezone(cal.tz)

    total = 0.0
    day = local_start.date()
    last_day = local_end.date()

    while day <= last_day:
        if day.weekday() in cal.working_weekdays and day not in cal.holidays:
            open_at = datetime.combine(day, datetime.min.time(), tzinfo=cal.tz) + timedelta(
                minutes=cal.start_minute
            )
            close_at = datetime.combine(day, datetime.min.time(), tzinfo=cal.tz) + timedelta(
                minutes=cal.end_minute
            )
            overlap_start = max(local_start, open_at)
            overlap_end = min(local_end, close_at)
            if overlap_end > overlap_start:
                total += (overlap_end - overlap_start).total_seconds()
        day += timedelta(days=1)

    return int(round(total))


def cluster_sessions(
    timestamps: list[datetime],
    idle_gap_minutes: int = 30,
    session_floor_minutes: int = 15,
) -> int:
    """Estimated minutes of active engagement, inferred from activity timestamps.

    Timestamps within ``idle_gap_minutes`` of each other are one session; each
    session is credited at least ``session_floor_minutes``, since a single
    commit still represents real work.

    This is an inference and is always presented as one. It never replaces the
    custody measurement -- if the inference is challenged, the underlying number
    still stands. An empty input returns 0, and callers must distinguish that
    from "no signal" before display: they mean different things.
    """
    if not timestamps:
        return 0

    ordered = sorted(timestamps)
    gap = timedelta(minutes=idle_gap_minutes)
    floor = float(session_floor_minutes)

    total = 0.0
    session_start = ordered[0]
    previous = ordered[0]

    for stamp in ordered[1:]:
        if stamp - previous > gap:
            span = (previous - session_start).total_seconds() / 60
            total += max(span, floor)
            session_start = stamp
        previous = stamp

    total += max((previous - session_start).total_seconds() / 60, floor)
    return int(round(total))
