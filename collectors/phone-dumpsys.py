#!/usr/bin/env python3
"""Parse Android dumpsys usagestats and POST timed phone sessions to Daymeter.

Usage:
  adb shell dumpsys usagestats | ./collectors/phone-dumpsys.py
  ./collectors/phone-dumpsys.py usagestats.txt
  cat dump.txt | DAYMETER_INGEST_URL=https://daymeter.vercel.app/api/ingest ./collectors/phone-dumpsys.py

Does not invent sessions. Foreground without a later pause/resume is dropped.
Writer day-summaries still belong on Origin; this is the clocked grain.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request

FG = re.compile(
    r"MOVE_TO_FOREGROUND|ACTIVITY_RESUMED|ACTIVITY_STARTED|(?:^|[^\d])type=1(?:[^\d]|$)",
    re.I,
)
BG = re.compile(
    r"MOVE_TO_BACKGROUND|ACTIVITY_PAUSED|ACTIVITY_STOPPED|ACTIVITY_DESTROYED|(?:^|[^\d])type=(?:2|23|24)(?:[^\d]|$)",
    re.I,
)
ISO = re.compile(r"(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})")
NUMBERED = re.compile(r"(\d{1,2})-(\d{1,2})-(\d{4})[ T](\d{2}:\d{2}:\d{2})")
EPOCH = re.compile(r"""\btime[=:]?\s*["']?(\d{12,13})\b""")
PKG = re.compile(r"""\bpackage[=:]?\s*["']?([A-Za-z][A-Za-z0-9._]+)""")
SLASH = re.compile(r"\b([a-z][A-Za-z0-9_]*(?:\.[A-Za-z0-9_]+)+)/")


def ist_from_ms(ms: int) -> str:
    # IST = UTC+05:30
    shifted = ms + 5 * 60 * 60 * 1000 + 30 * 60 * 1000
    from datetime import datetime, timezone

    dt = datetime.fromtimestamp(shifted / 1000, tz=timezone.utc)
    return dt.strftime("%Y-%m-%dT%H:%M:%S") + "+0530"


def coerce_ts(line: str) -> str | None:
    iso = ISO.search(line)
    if iso:
        return f"{iso.group(1)}T{iso.group(2)}+0530"
    epoch = EPOCH.search(line)
    if epoch:
        n = int(epoch.group(1))
        ms = n if n >= 1_000_000_000_000 else n * 1000
        return ist_from_ms(ms)
    numbered = NUMBERED.search(line)
    if not numbered:
        return None
    a, b, year, clock = numbered.groups()
    a_i, b_i = int(a), int(b)
    day_first = a_i > 12
    month = b_i if day_first else a_i
    day = a_i if day_first else b_i
    if month < 1 or month > 12 or day < 1 or day > 31:
        return None
    return f"{year}-{month:02d}-{day:02d}T{clock}+0530"


def pkg(line: str) -> str | None:
    named = PKG.search(line)
    if named:
        return named.group(1)
    slash = SLASH.search(line)
    return slash.group(1) if slash else None


def kind(line: str) -> str | None:
    if BG.search(line):
        return "bg"
    if FG.search(line):
        return "fg"
    return None


def parse_ms(ts: str) -> int:
    from datetime import datetime

    normalized = ts.replace("+0530", "+05:30")
    return int(datetime.fromisoformat(normalized).timestamp() * 1000)


def parse_dump(text: str) -> list[dict]:
    events: list[tuple[int, str, str, str]] = []
    for line in text.splitlines():
        k = kind(line)
        app = pkg(line)
        ts = coerce_ts(line)
        if not k or not app or not ts:
            continue
        events.append((parse_ms(ts), ts, app, k))
    events.sort()
    open_apps: dict[str, str] = {}
    sessions: list[dict] = []

    def close(app: str, end: str) -> None:
        start = open_apps.pop(app, None)
        if not start:
            return
        seconds = (parse_ms(end) - parse_ms(start)) / 1000
        if seconds <= 0:
            return
        sessions.append(
            {
                "ts": start,
                "end": end,
                "app": app,
                "seconds": seconds,
            }
        )

    for _ms, ts, app, k in events:
        if k == "fg":
            for other in list(open_apps):
                if other != app:
                    close(other, ts)
            if app in open_apps:
                close(app, ts)
            open_apps[app] = ts
        else:
            close(app, ts)
    return sessions


def read_input(argv: list[str]) -> str:
    if len(argv) > 1 and argv[1] not in ("-", "--adb"):
        return open(argv[1], encoding="utf-8", errors="replace").read()
    if len(argv) > 1 and argv[1] == "--adb":
        return subprocess.check_output(["adb", "shell", "dumpsys", "usagestats"], text=True)
    if sys.stdin.isatty():
        return subprocess.check_output(["adb", "shell", "dumpsys", "usagestats"], text=True)
    return sys.stdin.read()


def main() -> int:
    raw = read_input(sys.argv)
    sessions = parse_dump(raw)
    url = os.environ.get("DAYMETER_INGEST_URL", "https://daymeter.vercel.app/api/ingest")
    token = os.environ.get("DAYMETER_INGEST_TOKEN", "")
    payload = json.dumps({"device": "phone", "sessions": sessions}).encode("utf-8")
    req = urllib.request.Request(url, data=payload, method="POST")
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("x-daymeter-token", token)
    print(f"sessions={len(sessions)} -> {url}", file=sys.stderr)
    if not sessions:
        print("no timed sessions (foreground without an end is dropped)", file=sys.stderr)
        return 2
    try:
        with urllib.request.urlopen(req) as res:
            print(res.read().decode("utf-8"))
    except urllib.error.HTTPError as err:
        print(err.read().decode("utf-8", errors="replace"), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
