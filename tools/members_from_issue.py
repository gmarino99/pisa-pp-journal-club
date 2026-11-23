#!/usr/bin/env python3
"""Apply an "Add or remove a participant" issue to data/members.json.

Runs in GitHub Actions (members.yml) only for issues opened by the repository owner.
For an addition with an INSPIRE link, saves the titles of the person's recent papers in
feeds/inspire.json; the daily digest routine turns them into research keywords.
Prints one line that the workflow posts as a comment on the issue."""
import json
import os
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
event = json.loads(Path(os.environ["GITHUB_EVENT_PATH"]).read_text(encoding="utf-8"))
body = event["issue"].get("body") or ""


def field(label):
    m = re.search(r"###\s*" + re.escape(label) + r"[^\n]*\n+(.*?)(?=\n###|\Z)", body, re.S)
    v = (m.group(1).strip() if m else "")
    return "" if v == "_No response_" else v


def out(msg, code=0):
    Path(os.environ.get("RESULT_FILE", "/tmp/result.txt")).write_text(msg, encoding="utf-8")
    print(msg)
    sys.exit(code)


action = field("Action").lower()
name = re.sub(r"\s+", " ", field("Full name"))[:80]
link = field("INSPIRE profile")
if not name or re.search(r"[<>@`]", name):
    out("Could not read a valid name from the form; nothing changed.", 1)

path = ROOT / "data/members.json"
data = json.loads(path.read_text(encoding="utf-8"))
members = data["members"]


def norm(x):
    return re.sub(r"\s+", " ", x).strip().lower()


if action == "remove":
    keep = [m for m in members if norm(m["name"]) != norm(name)]
    if len(keep) == len(members):
        same = [m for m in members if norm(m.get("surname", "")) == norm(name.split(" ")[-1])]
        if len(same) == 1:
            keep = [m for m in members if m is not same[0]]
            name = same[0]["name"]
        else:
            out(f"No participant called {name} in the list; nothing changed.", 1)
    data["members"] = keep
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    out(f"Removed {name} from the participants. Past talks stay in the Speakers page.")

if action != "add":
    out("Action must be Add or Remove; nothing changed.", 1)

recid = None
if link:
    m = re.search(r"inspirehep\.net/authors/(\d+)", link) or re.fullmatch(r"(\d+)", link)
    if not m:
        out("The INSPIRE link should look like https://inspirehep.net/authors/1234567; nothing changed.", 1)
    recid = int(m.group(1))

if any(norm(m["name"]) == norm(name) for m in members):
    entry = next(m for m in members if norm(m["name"]) == norm(name))
    msg = f"{name} was already in the list"
else:
    entry = {"name": name, "surname": name.split(" ")[-1], "inspire": None, "github": "", "keywords": [], "declared": "", "learned": {"likes": [], "dislikes": []}}
    members.append(entry)
    msg = f"Added {name} to the participants"

titles = []
if recid:
    entry["inspire"] = recid
    try:
        url = f"https://inspirehep.net/api/literature?sort=mostrecent&size=25&q=authors.recid:{recid}&fields=titles"
        with urllib.request.urlopen(urllib.request.Request(url, headers={"Accept": "application/json"}), timeout=30) as r:
            hits = json.load(r)["hits"]["hits"]
        titles = [h["metadata"]["titles"][0]["title"][:300] for h in hits if h["metadata"].get("titles")]
    except Exception as e:  # keep the member even if INSPIRE is unreachable
        msg += f" (INSPIRE could not be read: {e.__class__.__name__})"
    if titles:
        fp = ROOT / "feeds/inspire.json"
        feed = json.loads(fp.read_text(encoding="utf-8")) if fp.exists() else {}
        feed[str(recid)] = {"name": entry["name"], "titles": titles}
        fp.parent.mkdir(exist_ok=True)
        fp.write_text(json.dumps(feed, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
        msg += f"; read {len(titles)} recent papers from INSPIRE, the next daily digest turns them into research keywords"

path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
out(msg + ".")
