#!/usr/bin/env python3
"""Sync the site with the GitHub Discussions used by giscus.

1. Creates a discussion for every recent paper that has none yet (title "arXiv:<id>",
   in the papers category), plus the "Ideas board" and "Research interests" discussions,
   so voting works from the first click and every paper has a GitHub link.
2. Writes data/votes.json: 👍/👎 totals, discussion links and the latest comments,
   shown on the site to everyone, signed in or not.
3. Writes feeds/github.json: who reacted to which paper and the "Research interests"
   posts, which the digest routine uses to learn participants' interests.

Everything stored is already public on GitHub. Runs in GitHub Actions
(GITHUB_TOKEN with discussions: write)."""
import hashlib
import json
import os
import sys
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
site = json.loads((ROOT / "data/site.json").read_text(encoding="utf-8"))
papers = json.loads((ROOT / "data/papers.json").read_text(encoding="utf-8"))
sessions = json.loads((ROOT / "data/sessions.json").read_text(encoding="utf-8"))
g = site.get("giscus") or {}
token = os.environ.get("GITHUB_TOKEN")
if not token or not g.get("repo") or not g.get("papersCategoryId"):
    print("fetch_votes: missing GITHUB_TOKEN or giscus settings; nothing to do")
    sys.exit(0)
owner, name = g["repo"].split("/", 1)
IDEAS_TERM = g.get("ideasTerm", "Ideas board")
INTERESTS_TERM = g.get("interestsTerm", "Research interests")


def gql(query, variables):
    req = urllib.request.Request(
        "https://api.github.com/graphql",
        data=json.dumps({"query": query, "variables": variables}).encode(),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        out = json.load(r)
    if out.get("errors"):
        raise RuntimeError(f"GraphQL error: {out['errors']}")
    return out["data"]


LIST = """
query($owner:String!, $name:String!, $cat:ID!, $after:String) {
  repository(owner:$owner, name:$name) {
    discussions(first:50, after:$after, categoryId:$cat, orderBy:{field:CREATED_AT, direction:DESC}) {
      pageInfo { hasNextPage endCursor }
      nodes { title url
        reactions(first:100) { nodes { content user { login } } }
        comments(last:30) { totalCount nodes { author { login } body createdAt } } }
    }
  }
}"""
CREATE = """
mutation($repo:ID!, $cat:ID!, $title:String!, $body:String!) {
  createDiscussion(input:{repositoryId:$repo, categoryId:$cat, title:$title, body:$body}) { discussion { url } }
}"""


def list_discussions(cat, pages=10):
    out, after = [], None
    for _ in range(pages):
        d = gql(LIST, {"owner": owner, "name": name, "cat": cat, "after": after})["repository"]["discussions"]
        out += d["nodes"]
        if not d["pageInfo"]["hasNextPage"]:
            break
        after = d["pageInfo"]["endCursor"]
    return out


def strict_marker(term):
    # giscus "strict" matching looks for the SHA-1 of the term in the discussion body.
    return f"<!-- sha1: {hashlib.sha1(term.encode()).hexdigest()} -->"


def create(cat, title, body):
    try:
        url = gql(CREATE, {"repo": g["repoId"], "cat": cat, "title": title, "body": body + "\n\n" + strict_marker(title)})["createDiscussion"]["discussion"]["url"]
        print(f"created discussion {title}")
        return url
    except Exception as e:  # keep going: votes still work through giscus
        print(f"could not create {title}: {e}")
        return None


def comments(c):
    return [{"login": (x.get("author") or {}).get("login", "ghost"), "at": x["createdAt"][:10], "text": x["body"][:1500]} for x in c["nodes"]]


# ---- papers ----
existing = {d["title"].strip(): d for d in list_discussions(g["papersCategoryId"])}
recent = (date.today() - timedelta(days=21)).isoformat()
wanted = [p for p in papers if (p.get("digest") or "") >= recent]
scheduled = {pid for s in sessions if s.get("date", "") >= date.today().isoformat() for pid in s.get("papers", [])}
wanted += [p for p in papers if p["id"] in scheduled and p not in wanted]
made = 0
for p in wanted:
    term = "arXiv:" + p["id"]
    if term in existing or made >= 40:
        continue
    body = (f"**{p['title']}**\n\n{p.get('authors', '')} · `{p.get('area', '')}` · https://arxiv.org/abs/{p['id']}\n\n"
            f"{p.get('gist', '')}\n\nReact with 👍 if it is worth discussing at the journal club, 👎 if not. Comments are welcome.")
    url = create(g["papersCategoryId"], term, body)
    made += 1
    if url:
        existing[term] = {"title": term, "url": url, "reactions": {"nodes": []}, "comments": {"totalCount": 0, "nodes": []}}

totals, reactions = {}, {}
for title, d in existing.items():
    if not title.startswith("arXiv:"):
        continue
    pid = title[len("arXiv:"):]
    up = sorted({r["user"]["login"] for r in d["reactions"]["nodes"] if r["content"] == "THUMBS_UP" and r.get("user")})
    down = sorted({r["user"]["login"] for r in d["reactions"]["nodes"] if r["content"] == "THUMBS_DOWN" and r.get("user")})
    cs = comments(d["comments"])
    totals[pid] = {"up": len(up), "down": len(down), "url": d["url"], "ncomments": d["comments"]["totalCount"],
                   "comments": [dict(c, text=c["text"][:280]) for c in cs[-3:]]}
    reactions[pid] = {"up": up, "down": down, "comments": cs}

# ---- ideas board and research interests ----
ideas, interests, ideas_url = [], [], ""
if g.get("ideasCategoryId"):
    boards = {d["title"].strip(): d for d in list_discussions(g["ideasCategoryId"], pages=2)}
    for term, text in ((IDEAS_TERM, "Short ideas, questions and pointers for the journal club. One comment per idea."),
                       (INTERESTS_TERM, "Write your name and the topics you work on or want to follow. The daily digest reads this to tag papers for you.")):
        if term not in boards:
            url = create(g["ideasCategoryId"], term, text)
            if url:
                boards[term] = {"title": term, "url": url, "comments": {"totalCount": 0, "nodes": []}}
    if IDEAS_TERM in boards:
        ideas, ideas_url = comments(boards[IDEAS_TERM]["comments"]), boards[IDEAS_TERM]["url"]
    if INTERESTS_TERM in boards:
        interests = comments(boards[INTERESTS_TERM]["comments"])


def write_if_changed(path, payload):
    try:
        old = json.loads(path.read_text(encoding="utf-8"))
        old.pop("updated", None)
    except (FileNotFoundError, json.JSONDecodeError):
        old = None
    if old == payload:
        return False
    path.parent.mkdir(exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ")
    path.write_text(json.dumps({"updated": stamp, **payload}, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    return True


a = write_if_changed(ROOT / "data/votes.json", {"papers": dict(sorted(totals.items())), "ideas": {"url": ideas_url, "comments": ideas[::-1]}})
b = write_if_changed(ROOT / "feeds/github.json", {"papers": dict(sorted(reactions.items())), "interests": interests})
print(f"fetch_votes: {len(totals)} paper discussions ({made} new), {len(ideas)} ideas, {len(interests)} interest posts" + ("" if a or b else " (no change)"))
