#!/usr/bin/env python3
"""Read the GitHub Discussions used by giscus and write:

- data/votes.json   👍/👎 totals per paper (shown on the site);
- feeds/github.json who reacted to which paper, and the comments in the "Research interests"
                    discussion. The digest routine uses it to learn each participant's interests.
                    Everything in it is already public on GitHub.

Runs in GitHub Actions (needs GITHUB_TOKEN with discussions: read)."""
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
    print("fetch_votes: missing GITHUB_TOKEN or giscus settings; nothing to do")
    sys.exit(0)
owner, name = g["repo"].split("/", 1)

PAPERS = """
query($owner:String!, $name:String!, $cat:ID!, $after:String) {
  repository(owner:$owner, name:$name) {
    discussions(first:50, after:$after, categoryId:$cat, orderBy:{field:CREATED_AT, direction:DESC}) {
      pageInfo { hasNextPage endCursor }
      nodes { title url
        reactions(first:100) { nodes { content user { login } } }
        comments(first:30) { nodes { author { login } body createdAt } } }
    }
  }
}"""
INTERESTS = """
query($owner:String!, $name:String!, $cat:ID!) {
  repository(owner:$owner, name:$name) {
    discussions(first:20, categoryId:$cat) {
      nodes { title comments(first:100) { nodes { author { login } body createdAt } } }
    }
  }
}"""


def gql(query, variables):
    req = urllib.request.Request(
        "https://api.github.com/graphql",
        data=json.dumps({"query": query, "variables": variables}).encode(),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        out = json.load(r)
    if out.get("errors"):
        raise SystemExit(f"GraphQL error: {out['errors']}")
    return out["data"]["repository"]["discussions"]


def comments(nodes):
    return [{"login": (c.get("author") or {}).get("login", "ghost"), "at": c["createdAt"][:10], "text": c["body"][:1500]} for c in nodes]


totals, reactions, after = {}, {}, None
for _ in range(10):  # newest 500 paper discussions
    page = gql(PAPERS, {"owner": owner, "name": name, "cat": g["papersCategoryId"], "after": after})
    for d in page["nodes"]:
        title = d["title"].strip()
        if not title.startswith("arXiv:"):
            continue
        pid = title[len("arXiv:"):]
        up = sorted({r["user"]["login"] for r in d["reactions"]["nodes"] if r["content"] == "THUMBS_UP" and r.get("user")})
        down = sorted({r["user"]["login"] for r in d["reactions"]["nodes"] if r["content"] == "THUMBS_DOWN" and r.get("user")})
        totals[pid] = {"up": len(up), "down": len(down), "url": d["url"]}
        reactions[pid] = {"up": up, "down": down, "comments": comments(d["comments"]["nodes"])}
    if not page["pageInfo"]["hasNextPage"]:
        break
    after = page["pageInfo"]["endCursor"]

interests = []
if g.get("ideasCategoryId"):
    term = g.get("interestsTerm", "Research interests")
    for d in gql(INTERESTS, {"owner": owner, "name": name, "cat": g["ideasCategoryId"]})["nodes"]:
        if d["title"].strip() == term:
            interests = comments(d["comments"]["nodes"])

changed = False
votes_path = ROOT / "data/votes.json"
try:
    old = json.loads(votes_path.read_text(encoding="utf-8")).get("papers", {})
except (FileNotFoundError, json.JSONDecodeError):
    old = None
if old != totals:
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ")
    votes_path.write_text(json.dumps({"updated": stamp, "papers": dict(sorted(totals.items()))}, indent=2) + "\n", encoding="utf-8")
    changed = True

feed_path = ROOT / "feeds/github.json"
feed = {"papers": dict(sorted(reactions.items())), "interests": interests}
try:
    old_feed = json.loads(feed_path.read_text(encoding="utf-8"))
    old_feed.pop("updated", None)
except (FileNotFoundError, json.JSONDecodeError):
    old_feed = None
if old_feed != feed:
    feed_path.parent.mkdir(exist_ok=True)
    feed_path.write_text(json.dumps({"updated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ"), **feed}, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    changed = True

print(f"fetch_votes: {len(totals)} paper discussions, {len(interests)} interest posts" + ("" if changed else " (no change)"))
