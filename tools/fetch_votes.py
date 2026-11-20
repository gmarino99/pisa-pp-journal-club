#!/usr/bin/env python3
"""Count 👍/👎 reactions on the paper discussions created by giscus and write data/votes.json.

Runs in GitHub Actions (needs GITHUB_TOKEN with discussions: read). Each paper has a discussion
titled "arXiv:<id>" in the papers category set in data/site.json (giscus.papersCategoryId).
Only totals are stored, never who voted."""
import json
import os
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
site = json.loads((ROOT / "data/site.json").read_text(encoding="utf-8"))
g = site.get("giscus") or {}
token = os.environ.get("GITHUB_TOKEN")
if not token or not g.get("repo") or not g.get("papersCategoryId"):
    print("fetch_votes: missing GITHUB_TOKEN or giscus settings; leaving votes.json unchanged")
    sys.exit(0)

owner, name = g["repo"].split("/", 1)
QUERY = """
query($owner:String!, $name:String!, $cat:ID!, $after:String) {
  repository(owner:$owner, name:$name) {
    discussions(first:100, after:$after, categoryId:$cat, orderBy:{field:CREATED_AT, direction:DESC}) {
      pageInfo { hasNextPage endCursor }
      nodes { title url reactionGroups { content reactors { totalCount } } }
    }
  }
}"""


def gql(variables):
    req = urllib.request.Request(
        "https://api.github.com/graphql",
        data=json.dumps({"query": QUERY, "variables": variables}).encode(),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        out = json.load(r)
    if out.get("errors"):
        raise SystemExit(f"GraphQL error: {out['errors']}")
    return out["data"]["repository"]["discussions"]


papers, after = {}, None
for _ in range(5):  # newest 500 discussions are plenty
    page = gql({"owner": owner, "name": name, "cat": g["papersCategoryId"], "after": after})
    for d in page["nodes"]:
        title = d["title"].strip()
        if not title.startswith("arXiv:"):
            continue
        counts = {rg["content"]: rg["reactors"]["totalCount"] for rg in d["reactionGroups"]}
        papers[title[len("arXiv:"):]] = {"up": counts.get("THUMBS_UP", 0), "down": counts.get("THUMBS_DOWN", 0), "url": d["url"]}
    if not page["pageInfo"]["hasNextPage"]:
        break
    after = page["pageInfo"]["endCursor"]

path = ROOT / "data/votes.json"
old = {}
try:
    old = json.loads(path.read_text(encoding="utf-8")).get("papers", {})
except (FileNotFoundError, json.JSONDecodeError):
    pass
if old == papers and path.exists():
    print(f"fetch_votes: no change ({len(papers)} discussions)")
    sys.exit(0)
stamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ")
path.write_text(json.dumps({"updated": stamp, "papers": dict(sorted(papers.items()))}, indent=2) + "\n", encoding="utf-8")
print(f"fetch_votes: wrote {len(papers)} discussions")
