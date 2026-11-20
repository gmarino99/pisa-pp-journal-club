# Pisa Particle Physics Journal Club — website

Static website for the journal club, published with GitHub Pages.
There is no build step and there are no dependencies: plain HTML, CSS and JavaScript.
All content lives in three JSON files under `data/`, which you edit by hand.

```
index.html            page shell
assets/style.css      layout, light/dark theme
assets/app.js         reads data/*.json and renders the sections
data/site.json        title, default day/time/room, agenda, About text
data/sessions.json    one entry per journal-club session
data/papers.json      paper digest (arXiv papers)
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

The repository is public. Do not put email addresses, phone numbers, member lists or availability in it.
Speaker names and talk titles are meant to be public. Anything else about people belongs elsewhere.
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
