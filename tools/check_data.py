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
members = load("members.json")
if isinstance(members, dict):
    for i, m in enumerate(members.get("members", [])):
        if not m.get("surname") or not isinstance(m.get("keywords", []), list):
            errors.append(f"members.json item {i + 1}: needs 'surname' and a 'keywords' list")
        if "@" in json.dumps(m):
            errors.append(f"members.json item {i + 1}: looks like it contains an email address")
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
        if "interest" in p and not (isinstance(p["interest"], list) and all(isinstance(x, str) for x in p["interest"])):
            errors.append(f"{where}: 'interest' must be a list of names")
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
        talks = s.get("talks", [])
        if not isinstance(talks, list):
            errors.append(f"{where}: 'talks' must be a list")
            talks = []
        for k, t in enumerate(talks):
            if not isinstance(t, dict) or not t.get("speaker"):
                errors.append(f"{where}: talk {k + 1} needs a 'speaker'")
            elif "minutes" in t and not (isinstance(t["minutes"], int) and 0 < t["minutes"] <= 60):
                errors.append(f"{where}: talk {k + 1}: 'minutes' must be a whole number between 1 and 60")
            if isinstance(t, dict) and "slides" in t:
                sl = str(t["slides"])
                if not re.fullmatch(r"data/talks/[A-Za-z0-9._-]+\.html", sl):
                    errors.append(f"{where}: talk {k + 1}: 'slides' must look like data/talks/<name>.html")
                elif not (ROOT.parent / sl).is_file():
                    errors.append(f"{where}: talk {k + 1}: slides file {sl} not found")
        for pid in s.get("papers", []):
            if pid not in ids:
                errors.append(f"{where}: paper {pid} is not in papers.json (it will show as a bare arXiv link)")
elif sessions is not None:
    errors.append("sessions.json: must be a list [ ... ]")

FIGS = {"diagram", "curves", "histogram", "events", "hierarchy", "waves", "potential", "flow", "spectrum"}
for f in sorted((ROOT / "decks").glob("*.json")) if (ROOT / "decks").exists() else []:
    try:
        deck = json.loads(f.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        errors.append(f"decks/{f.name}: invalid JSON at line {e.lineno}: {e.msg}")
        continue
    for i, sl in enumerate(deck.get("slides", [])):
        if not sl.get("title"):
            errors.append(f"decks/{f.name} slide {i + 1}: missing 'title'")
        fig = sl.get("figure")
        if fig and fig.get("type") not in FIGS:
            errors.append(f"decks/{f.name} slide {i + 1}: unknown figure type {fig.get('type')!r}")

if errors:
    print("Data check failed:\n  - " + "\n  - ".join(errors))
    sys.exit(1)
print(f"Data OK: {len(sessions)} sessions, {len(papers)} papers.")
