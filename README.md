# Pisa Particle Physics Journal Club — website

Static website for the journal club, published with GitHub Pages.
There is no build step and there are no dependencies: plain HTML, CSS and JavaScript.
All content lives in JSON files under `data/`. Scheduled jobs update them automatically, and you can also edit them by hand.

## How it works

| What | Where | Updated by |
|---|---|---|
| New arXiv announcements (raw feed) | `feeds/arxiv.json` | GitHub Actions (`arxiv.yml`), weekdays ~06:15 Rome |
| Daily paper digest (with "May interest" names) | `data/papers.json` | Claude routine, weekdays 08:00 Rome, reading `feeds/arxiv.json` |
| Programme of next Tuesday | `data/sessions.json` | Claude routine, Mondays 09:30 Rome |
| Weekly email to the mailing list | push notification to the chair | Claude routine, Mondays 09:30 Rome |
| Votes 👍/👎 on papers | GitHub Discussions (category Announcements), via giscus | participants, signed in with GitHub |
| Vote counts shown on the site | `data/votes.json` | GitHub Actions, every 3 hours |
| Ideas of the week | GitHub Discussions (category Ideas), via giscus | participants |
| Next speaker | `data/sessions.json` | the chair, by hand (see below) |
| Participants' research interests | `data/members.json` | seeded from INSPIRE; the digest routine updates `declared` and `learned` |
| Who voted what, and posts in "Research interests" | `feeds/github.json` | GitHub Actions, every 3 hours (public GitHub data) |

### How the selection learns

Each participant has an entry in `data/members.json` with INSPIRE-based `keywords`.
Every morning the digest routine reads `feeds/github.json` and updates that entry:
- `declared` holds what the person wrote in the **Ideas → Your research interests** board;
- `learned.likes` and `learned.dislikes` hold the topics of the papers they voted 👍 or 👎.

It links a GitHub account to a participant when the post includes the person's name.
"May interest" tags and the daily and Monday selections use all three: the keywords, what people declared, and what they learned from votes.
To add or remove a participant, edit `data/members.json` (never put email addresses there).

### Paper explanations

For the papers selected for a session, the Monday routine adds an `explain` list of four short steps (question, method, result, why it matters) to `data/papers.json`.
The session board shows the steps on each card and on the presentation slides.

The routines are managed at https://claude.ai/code/routines; from there you can pause or edit them.

```
index.html            page shell
jc.html               session board: the selected papers, with a full-screen presentation mode (jc.html?present)
assets/style.css      layout, light/dark theme
assets/app.js         reads data/*.json and renders the sections
data/site.json        title, default day/time/room, agenda, About text
data/sessions.json    one entry per journal-club session
data/papers.json      paper digest (arXiv papers)
data/votes.json       vote totals copied from GitHub Discussions (do not edit)
tools/fetch_votes.py  reads the 👍/👎 reactions (run by the workflow)
tools/fetch_arxiv.py  downloads the day's new arXiv papers into feeds/arxiv.json (not published on the site)
tools/check_data.py   checks the JSON files (also run before every deploy)
.github/workflows/pages.yml   deploys to GitHub Pages on every push to main
```

## Updating the content

The quickest way is to edit the file directly on GitHub (open it, click the pencil icon, then "Commit changes").
The site redeploys automatically within a minute or two. You can follow the progress in the **Actions** tab.

### Add or edit a session: `data/sessions.json`

```json
{
  "date": "2026-12-01",
  "speaker": "A. Rossi",
  "talkTitle": "Instantons at the LHC",
  "papers": ["2611.22092", "2611.23370"],
  "notes": ""
}
```

| Field | Required | Meaning |
|---|---|---|
| `date` | yes | `YYYY-MM-DD`. Sessions are sorted by date automatically. |
| `speaker`, `talkTitle` | no | Leave `""` if there is no talk. Sessions with a speaker appear on the Speakers page. |
| `papers` | no | arXiv ids of the papers to discuss. Each id should also be in `papers.json`. |
| `notes` | no | Short note shown on the Schedule page. |
| `time`, `room`, `durationMinutes` | no | Only if different from the defaults in `site.json`. |
| `pilot` | no | `true` shows a "pilot content" banner. |

"Next JC" always shows the first session whose date is today or later.
Past sessions move to "Past sessions" automatically, so there is nothing to archive by hand.

### Add papers: `data/papers.json`

```json
{
  "id": "2611.23370",
  "title": "A Positive Metric on Four-Dimensional QFTs",
  "authors": "T. Hartman, G. Mathys, A. Stergiou",
  "area": "hep-th",
  "announced": "2026-11-19",
  "digest": "2026-11-20",
  "gist": "One or two plain sentences on what the paper does."
}
```

`digest` is the date of the digest the paper belongs to (it is used for grouping and for the date filter).
`announced` is the arXiv announcement date and is optional.
`interest` is an optional list of participants' surnames shown as "May interest".

### Record the next speaker (after the draw)

At the end of each session, draw the speaker for the following week however you like, then add the name to that session in `data/sessions.json`:

```json
{ "date": "2026-12-01", "speaker": "A. Rossi", "talkTitle": "", "papers": [], "notes": "" }
```

The Monday routine keeps `speaker` and `talkTitle` and only fills in `papers`. Add the talk title later, when the speaker sends it.

### Voting and ideas

Each paper card has a **Vote & discuss** button. It opens the paper's discussion on GitHub through giscus.
Participants sign in with GitHub and react with 👍 (worth discussing) or 👎 (not for the JC). They can also leave comments.
The first reaction creates the discussion automatically.
The Ideas page works the same way, with a single "Ideas board" discussion. Each comment there is one post.
The counts on the site are refreshed every 3 hours. Votes cast on Monday morning count for that week's selection.

### General settings: `data/site.json`

Here you set the default weekday, time, room and timezone, the agenda items, the About text, and the `updated` date shown in the footer.
Two optional links:
- `repoUrl` (the GitHub repository) adds a footer link;
- `proposeUrl` (for example a Google Form, or the repository's "new issue" page) adds a "Suggest a paper" button on About.

### JSON pitfalls

- Strings use double quotes `"…"`.
- Items are separated by commas, and there is **no comma after the last item**.
- Dates are `YYYY-MM-DD`.

Before committing, run `python3 tools/check_data.py`. It reports the file, the item and the problem.
The same check runs on GitHub, so a broken file never replaces the live site: the deploy just fails, and the error appears in the Actions tab.

## Privacy

The repository and the site are public, and so are votes and comments on GitHub Discussions.
Never put email addresses or phone numbers in the repository.
Participants' names and research interests (`data/members.json`), speaker names, talk titles and the "May interest" surnames are public by choice. If a participant prefers not to appear, remove them from `data/members.json`.
Files named `*.local.json` and the `private/` folder are git-ignored. You can use them for a local list, for example the members for the speaker draw.

## Preview locally

The page loads JSON with `fetch`, so opening `index.html` by double-clicking does not work. Start a local server instead:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

## First-time GitHub Pages setup

1. Create an empty public repository on GitHub and push this folder to it (see below).
2. In the repository, go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
3. Push to `main` (or run the workflow by hand from the Actions tab). The site will be at `https://<user>.github.io/<repository>/`.

```sh
git remote add origin https://github.com/<user>/<repository>.git
git push -u origin main
```
