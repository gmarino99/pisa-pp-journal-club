#!/usr/bin/env python3
"""Download today's new arXiv announcements for the JC categories and save them to feeds/arxiv.json.

Runs in GitHub Actions every weekday morning (GitHub has open network access, the Claude
routines do not). The daily digest routine then reads feeds/arxiv.json from the repository.
Only public arXiv metadata is stored."""
import json
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

CATEGORIES = ["hep-ph", "hep-th", "hep-ex", "hep-lat", "astro-ph.CO", "astro-ph.HE", "gr-qc"]
URL = "https://rss.arxiv.org/rss/" + "+".join(CATEGORIES)
NS = {"arxiv": "http://arxiv.org/schemas/atom", "dc": "http://purl.org/dc/elements/1.1/"}
OUT = Path(__file__).resolve().parent.parent / "feeds" / "arxiv.json"

req = urllib.request.Request(URL, headers={"User-Agent": "journal-club-digest/1.0"})
with urllib.request.urlopen(req, timeout=60) as r:
    root = ET.fromstring(r.read())

channel = root.find("channel")
announced = ""
pub = channel.findtext("pubDate") if channel is not None else None
if pub:
    announced = parsedate_to_datetime(pub).date().isoformat()

items = []
for it in root.iter("item"):
    kind = (it.findtext("arxiv:announce_type", default="", namespaces=NS) or "").strip()
    if kind not in ("new", "cross"):
        continue
    desc = it.findtext("description", default="") or ""
    m = re.search(r"arXiv:(\d{4}\.\d{4,5})", desc) or re.search(r"(\d{4}\.\d{4,5})", it.findtext("link", default=""))
    if not m:
        continue
    abstract = desc.split("Abstract:", 1)[1].strip() if "Abstract:" in desc else desc.strip()
    items.append({
        "id": m.group(1),
        "title": " ".join((it.findtext("title") or "").split()),
        "authors": " ".join((it.findtext("dc:creator", default="", namespaces=NS) or "").split()),
        "categories": [c.text for c in it.findall("category") if c.text],
        "announce_type": kind,
        "abstract": " ".join(abstract.split())[:700],
    })

if not items:
    print(f"fetch_arxiv: no new announcements (announced={announced or 'unknown'}); keeping the previous file")
    sys.exit(0)

OUT.parent.mkdir(exist_ok=True)
OUT.write_text(json.dumps({
    "fetched": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ"),
    "announced": announced,
    "categories": CATEGORIES,
    "count": len(items),
    "items": items,
}, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
print(f"fetch_arxiv: {len(items)} items announced {announced}")
