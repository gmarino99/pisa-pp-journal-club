#!/usr/bin/env python3
"""Sanity checks for data/*.json. Run before committing:  python3 tools/check_data.py
Exits with a non-zero status (and a readable message) if something is wrong.
The same check runs in the GitHub Actions workflow before every deploy."""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "data"
DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
TIME = re.compile(r"^\d{2}:\d{2}$")
errors = []


def load(name):
    path = ROOT / name
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        errors.append(f"{name}: invalid JSON at line {e.lineno}, column {e.colno}: {e.msg}")
    except FileNotFoundError:
        errors.append(f"{name}: file missing")
    return None


site = load("site.json")
sessions = load("sessions.json")
papers = load("papers.json")

if isinstance(site, dict):
    for key in ("title", "defaults"):
        if key not in site:
            errors.append(f"site.json: missing '{key}'")
    for key in ("weekday", "time", "room", "timezone"):
        if key not in site.get("defaults", {}):
            errors.append(f"site.json: missing 'defaults.{key}'")

ids = set()
if isinstance(papers, list):
    for i, p in enumerate(papers):
        where = f"papers.json item {i + 1} ({p.get('id', '?')})"
        for key in ("id", "title", "authors", "area", "digest"):
            if not p.get(key):
                errors.append(f"{where}: missing '{key}'")
        for key in ("digest", "announced"):
            if p.get(key) and not DATE.match(p[key]):
                errors.append(f"{where}: '{key}' must be YYYY-MM-DD, got {p[key]!r}")
        if p.get("id") in ids:
            errors.append(f"{where}: duplicate id")
        ids.add(p.get("id"))
elif papers is not None:
    errors.append("papers.json: must be a list [ ... ]")

if isinstance(sessions, list):
    seen = set()
    for i, s in enumerate(sessions):
        where = f"sessions.json item {i + 1} ({s.get('date', '?')})"
        if not DATE.match(str(s.get("date", ""))):
            errors.append(f"{where}: 'date' must be YYYY-MM-DD")
        if s.get("date") in seen:
            errors.append(f"{where}: two sessions on the same date")
        seen.add(s.get("date"))
        if "time" in s and not TIME.match(str(s["time"])):
            errors.append(f"{where}: 'time' must be HH:MM")
        for pid in s.get("papers", []):
            if pid not in ids:
                errors.append(f"{where}: paper {pid} is not in papers.json (it will show as a bare arXiv link)")
elif sessions is not None:
    errors.append("sessions.json: must be a list [ ... ]")

if errors:
    print("Data check failed:\n  - " + "\n  - ".join(errors))
    sys.exit(1)
print(f"Data OK: {len(sessions)} sessions, {len(papers)} papers.")
