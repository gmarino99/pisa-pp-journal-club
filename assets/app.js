/* Pisa Particle Physics Journal Club — main site.
   All content comes from data/*.json; this file only renders it. Shares its look with jc.html (assets/jc.css). */
(function () {
  "use strict";

  var ROUTES = ["next", "papers", "ideas", "schedule", "speakers", "about"];
  var TITLES = { next: "Next JC", papers: "Papers", ideas: "Ideas", schedule: "Schedule", speakers: "Speakers", about: "About" };
  var $main = document.getElementById("main");
  var S = { site: null, sessions: [], papers: [], byId: {}, votes: {}, members: [] };
  var A = window.JCAgenda;
  var filters = { q: "", area: "", digest: "" };
  var ideasTab = "ideas";

  /* ---------- helpers ---------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function iso(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function todayISO() { return iso(new Date()); }
  function parseISO(s) { var p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function fmtDate(s, o) {
    try { return parseISO(s).toLocaleDateString("en-GB", o || { weekday: "short", day: "numeric", month: "short", year: "numeric" }); }
    catch (e) { return s; }
  }
  function sessTime(s) { return s.time || S.site.defaults.time; }
  function sessRoom(s) { return s.room || S.site.defaults.room; }
  function startOf(s) { var d = parseISO(s.date), t = sessTime(s).split(":"); d.setHours(+t[0], +t[1], 0, 0); return d; }
  function absUrl(id) { return "https://arxiv.org/abs/" + encodeURIComponent(id); }
  function pdfUrl(id) { return "https://arxiv.org/pdf/" + encodeURIComponent(id); }
  function votesOf(id) { var v = S.votes[id] || {}; return { up: v.up || 0, down: v.down || 0, net: (v.up || 0) - (v.down || 0), url: v.url || "", n: v.ncomments || 0, comments: v.comments || [] }; }
  function excerpt(t, n) { t = String(t || "").replace(/<!--[\s\S]*?-->/g, "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1) + "…" : t; }
  function paperOf(id) { return S.byId[id] || { id: id, title: "arXiv:" + id, authors: "", area: "arXiv" }; }
  function hero(eyebrow, title, lede) {
    return '<section class="hero small"><p class="eyebrow">' + esc(eyebrow) + "</p><h1>" + title + "</h1>" + (lede ? '<p class="lede">' + lede + "</p>" : "") + "</section>";
  }

  /* ---------- theme ---------- */
  var THEMES = ["auto", "light", "dark"], ICON = { auto: "◐", light: "☀", dark: "☾" };
  function currentTheme() { return document.documentElement.dataset.theme || "auto"; }
  function applyTheme(t) {
    if (t === "auto") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
    try { if (t === "auto") localStorage.removeItem("jc-theme"); else localStorage.setItem("jc-theme", t); } catch (e) {}
    var b = document.getElementById("theme-toggle");
    b.textContent = ICON[t];
    b.setAttribute("aria-label", "Colour theme: " + t + ". Click to change.");
    syncGiscusTheme();
  }
  document.getElementById("theme-toggle").addEventListener("click", function () {
    applyTheme(THEMES[(THEMES.indexOf(currentTheme()) + 1) % THEMES.length]);
  });

  /* ---------- giscus (GitHub Discussions: votes, ideas, interests) ---------- */
  function effectiveTheme() {
    var t = currentTheme();
    if (t !== "auto") return t;
    try { return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"; } catch (e) { return "light"; }
  }
  function syncGiscusTheme() {
    var f = document.querySelector("iframe.giscus-frame");
    if (f && f.contentWindow) f.contentWindow.postMessage({ giscus: { setConfig: { theme: effectiveTheme() } } }, "https://giscus.app");
  }
  applyTheme(currentTheme());
  try { matchMedia("(prefers-color-scheme: dark)").addEventListener("change", syncGiscusTheme); } catch (e) {}

  // giscus attaches to the first ".giscus" element, so only one widget is open at a time.
  function mountGiscus(container, opts) {
    var g = S.site && S.site.giscus;
    if (!g || !g.repoId) { container.innerHTML = '<p class="empty">Voting and comments are not configured yet.</p>'; return; }
    document.querySelectorAll(".giscus-slot").forEach(function (el) { el.innerHTML = ""; if (el.dataset.collapsible) el.hidden = true; });
    document.querySelectorAll("[data-discuss][aria-expanded=true]").forEach(function (b) { b.setAttribute("aria-expanded", "false"); });
    container.hidden = false;
    container.innerHTML = (opts.hint ? '<p class="vote-hint">' + opts.hint + "</p>" : "") + '<div class="giscus"></div>';
    var sc = document.createElement("script");
    sc.src = "https://giscus.app/client.js";
    var attrs = {
      "data-repo": g.repo, "data-repo-id": g.repoId,
      "data-category": opts.category, "data-category-id": opts.categoryId,
      "data-mapping": "specific", "data-term": opts.term, "data-strict": "1",
      "data-reactions-enabled": "1", "data-emit-metadata": "0", "data-input-position": "top",
      "data-theme": effectiveTheme(), "data-lang": "en", "data-loading": "lazy"
    };
    Object.keys(attrs).forEach(function (k) { sc.setAttribute(k, attrs[k]); });
    sc.crossOrigin = "anonymous"; sc.async = true;
    container.appendChild(sc);
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-discuss]");
    if (!b) return;
    var slot = document.getElementById(b.getAttribute("aria-controls"));
    if (!slot) return;
    if (b.getAttribute("aria-expanded") === "true") { slot.innerHTML = ""; slot.hidden = true; b.setAttribute("aria-expanded", "false"); return; }
    var g = S.site.giscus || {};
    var url = slot.dataset.url;
    mountGiscus(slot, { category: g.papersCategory, categoryId: g.papersCategoryId, term: "arXiv:" + b.dataset.discuss,
      hint: "<b>To vote:</b> click the <b>☺︎</b> button in the reactions bar just below and choose 👍 or 👎. The first time, GitHub asks you to sign in. <b>Your vote shows up in the counts on this page within 3 hours.</b> Comments are visible to everyone."
        + (url ? ' <a href="' + esc(url) + '" target="_blank" rel="noopener">Or vote on GitHub ↗</a>' : "") });
    b.setAttribute("aria-expanded", "true");
  });

  /* ---------- calendar (.ics) ---------- */
  function icsText(s) { return String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n"); }
  function icsFor(s) {
    var d = S.site.defaults, start = startOf(s);
    var end = new Date(start.getTime() + (s.durationMinutes || d.durationMinutes || 60) * 60000);
    function local(x) { return x.getFullYear() + pad(x.getMonth() + 1) + pad(x.getDate()) + "T" + pad(x.getHours()) + pad(x.getMinutes()) + "00"; }
    var stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
    var ts = A.talksOf(s);
    var desc = ts.length ? ts.map(function (t) { return "Talk: " + t.speaker + (t.title ? " — " + t.title : ""); }).join("\n") : "Papers of the week and discussion";
    return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Pisa PP Journal Club//EN", "CALSCALE:GREGORIAN", "BEGIN:VEVENT",
      "UID:" + s.date + "@pisa-pp-journal-club", "DTSTAMP:" + stamp,
      "DTSTART;TZID=" + d.timezone + ":" + local(start), "DTEND;TZID=" + d.timezone + ":" + local(end),
      "SUMMARY:" + icsText(S.site.title), "LOCATION:" + icsText(sessRoom(s)),
      "DESCRIPTION:" + icsText(desc + "\n" + location.href.split("#")[0] + "jc.html#" + s.date),
      "END:VEVENT", "END:VCALENDAR"].join("\r\n") + "\r\n";
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-ics]");
    if (!b) return;
    var s = S.sessions.find(function (x) { return x.date === b.dataset.ics; });
    if (!s) return;
    var url = URL.createObjectURL(new Blob([icsFor(s)], { type: "text/calendar" }));
    var a = document.createElement("a");
    a.href = url; a.download = "journal-club-" + s.date + ".ics";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  });

  /* ---------- paper card (same design as the session board) ---------- */
  var cardSeq = 0;
  function paperCard(p, i, opts) {
    opts = opts || {};
    var v = votesOf(p.id), slot = "gs-" + (++cardSeq);
    var steps = p.explain && p.explain.length
      ? (opts.openSteps
        ? '<ol class="steps">' + p.explain.map(function (x) { return "<li><span>" + esc(x) + "</span></li>"; }).join("") + "</ol>"
        : '<details class="explain"><summary>In ' + p.explain.length + " steps</summary><ol class=\"steps\">" + p.explain.map(function (x) { return "<li><span>" + esc(x) + "</span></li>"; }).join("") + "</ol></details>")
      : "";
    return '<li class="paper" data-area="' + esc(p.area) + '" style="--i:' + (i || 0) + '">'
      + '<div class="paper-head">' + (opts.num ? '<span class="num" aria-hidden="true">' + pad(i + 1) + "</span>" : "<span></span>")
      + '<span class="area"><span class="dot"></span>' + esc(p.area || "arXiv") + "</span></div>"
      + '<h3><a href="' + absUrl(p.id) + '" target="_blank" rel="noopener">' + esc(p.title) + "</a></h3>"
      + (p.authors ? '<p class="authors">' + esc(p.authors) + "</p>" : "")
      + (p.gist ? '<p class="gist">' + esc(p.gist) + "</p>" : "")
      + steps
      + (p.interest && p.interest.length ? '<p class="aff"><b>May interest</b> ' + p.interest.map(esc).join(", ") + "</p>" : "")
      + (v.n ? '<div class="cpreview"><span class="cpreview-n">💬 ' + v.n + " comment" + (v.n > 1 ? "s" : "") + "</span>"
        + v.comments.slice(-2).map(function (c) { return '<p><b>@' + esc(c.login) + "</b> " + esc(excerpt(c.text, 160)) + "</p>"; }).join("") + "</div>" : "")
      + '<div class="paper-foot"><span class="id">arXiv:' + esc(p.id) + "</span>"
      + '<span class="links"><a href="' + absUrl(p.id) + '" target="_blank" rel="noopener">Abstract</a><a href="' + pdfUrl(p.id) + '" target="_blank" rel="noopener">PDF</a></span></div>'
      + '<div class="vote-bar" role="group" aria-label="Vote on this paper">'
      + '<button type="button" class="vote-btn up" data-discuss="' + esc(p.id) + '" aria-expanded="false" aria-controls="' + slot + '" title="Worth discussing">👍 <b>' + v.up + "</b></button>"
      + '<button type="button" class="vote-btn down" data-discuss="' + esc(p.id) + '" aria-expanded="false" aria-controls="' + slot + '" title="Not for the JC">👎 <b>' + v.down + "</b></button>"
      + '<button type="button" class="vote-btn talk" data-discuss="' + esc(p.id) + '" aria-expanded="false" aria-controls="' + slot + '">💬 ' + (v.n ? "Comments" : "Comment") + "</button></div>"
      + '<div class="giscus-slot" id="' + slot + '" data-collapsible="1" data-url="' + esc(v.url) + '" hidden></div>'
      + "</li>";
  }
  function grid(list, opts) {
    return '<ol class="papers">' + list.map(function (p, i) { return paperCard(p, i, opts); }).join("") + "</ol>";
  }

  /* ---------- sessions ---------- */
  function upcoming() { var t = todayISO(); return S.sessions.filter(function (s) { return s.date >= t; }); }
  function past() { var t = todayISO(); return S.sessions.filter(function (s) { return s.date < t; }).reverse(); }
  function talkLine(s) {
    var ts = A.talksOf(s);
    if (!ts.length) return "No talk scheduled yet";
    return ts.map(function (t) { return esc(t.speaker) + (t.title ? " — <i>" + esc(t.title) + "</i>" : "") + (t.minutes ? " · " + t.minutes + "′" : ""); }).join("<br>");
  }
  function timeline(s) {
    var n = (s.papers || []).length, t0 = startOf(s), acc = 0, bar = "", items = "";
    A.programme(S.site, s).forEach(function (a) {
      var kind = a.kind === "draw" ? "other" : a.kind;
      var from = new Date(t0.getTime() + acc * 60000); acc += a.minutes || 0;
      bar += '<span class="seg-' + kind + '" style="flex:' + (a.minutes || 1) + '"></span>';
      var detail = a.kind === "talk" ? (a.talk ? "<b>" + esc(a.talk.speaker) + "</b>" + (a.talk.title ? " — <i>" + esc(a.talk.title) + "</i>" : "") + (a.talkMinutes ? "<br>" + a.talkMinutes + "′ + questions" : "") : "No talk scheduled yet")
        : a.kind === "papers" ? (n ? n + " papers, about " + Math.max(2, Math.round((a.minutes || 15) / n)) + " min each" : "Selection published on Monday")
        : esc(a.detail || "");
      items += '<div class="tl-item"><span class="t">' + pad(from.getHours()) + ":" + pad(from.getMinutes()) + " · " + (a.minutes || "") + "′</span><h3>" + esc(a.title) + "</h3><p>" + detail + "</p></div>";
    });
    return '<section class="timeline" aria-label="Programme"><div class="tl-bar" aria-hidden="true">' + bar + '</div><div class="tl-items">' + items + "</div></section>";
  }
  function countdown(s) {
    var days = Math.round((parseISO(s.date) - parseISO(todayISO())) / 864e5);
    return days <= 0 ? "Today" : days === 1 ? "Tomorrow" : "In " + days + " days";
  }

  /* ---------- views ---------- */
  function viewNext() {
    var s = upcoming()[0];
    if (!s) return hero("Next session", "Not scheduled yet", "The next session will appear here as soon as it is planned.");
    var list = (s.papers || []).map(paperOf);
    return '<section class="hero"><p class="eyebrow">' + esc(countdown(s)) + " · next session" + (s.pilot ? " · pilot selection" : "") + "</p>"
      + "<h1>" + esc(fmtDate(s.date, { weekday: "long", day: "numeric", month: "long" })) + "</h1>"
      + '<p class="hero-meta"><b>' + esc(sessTime(s)) + "</b> · " + esc(sessRoom(s)) + " · " + list.length + " paper" + (list.length === 1 ? "" : "s") + "</p>"
      + '<div class="hero-actions"><a class="primary" href="jc.html#' + esc(s.date) + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>Open session board</a>'
      + '<button type="button" class="ghost" data-ics="' + esc(s.date) + '">Add to calendar</button></div></section>'
      + timeline(s)
      + '<div class="section-head"><h2>Papers to discuss</h2></div>'
      + (list.length ? grid(list, { num: true, openSteps: false }) : '<p class="empty">The selection is published on the Monday before the session. Meanwhile, vote on the papers of the week.</p>')
      + mostVoted(s);
  }
  function mostVoted(s) {
    var since = iso(new Date(Date.now() - 8 * 864e5));
    var best = S.papers.filter(function (p) { return (p.digest || "") >= since && (s.papers || []).indexOf(p.id) < 0; })
      .map(function (p) { return { p: p, v: votesOf(p.id) }; })
      .filter(function (x) { return x.v.up > 0; })
      .sort(function (a, b) { return b.v.net - a.v.net || b.v.up - a.v.up; })[0];
    return best ? '<div class="section-head"><h2>Most voted this week</h2></div>' + grid([best.p]) : "";
  }

  function viewPapers() {
    var areas = Array.from(new Set(S.papers.map(function (p) { return p.area; }))).sort();
    var digests = Array.from(new Set(S.papers.map(function (p) { return p.digest; }))).sort().reverse();
    function opts(list, sel, all, fmt) {
      return '<option value="">' + all + "</option>" + list.map(function (v) {
        return '<option value="' + esc(v) + '"' + (v === sel ? " selected" : "") + ">" + esc(fmt ? fmt(v) : v) + "</option>";
      }).join("");
    }
    return hero("Daily digest", "Papers", "New arXiv papers picked every weekday morning, balanced across areas and tagged with the participants they may interest. Vote 👍 on the ones worth discussing: the Monday selection favours them. Vote counts on the site are refreshed every 3 hours.")
      + '<form class="filters" role="search" onsubmit="return false">'
      + '<div><label for="f-q">Search</label><input id="f-q" type="search" placeholder="Title, authors or topic" value="' + esc(filters.q) + '" autocomplete="off"></div>'
      + '<div><label for="f-area">Area</label><select id="f-area">' + opts(areas, filters.area, "All areas") + "</select></div>"
      + '<div><label for="f-digest">Digest</label><select id="f-digest">' + opts(digests, filters.digest, "All dates", function (d) { return fmtDate(d); }) + "</select></div>"
      + "</form>"
      + '<p class="status" id="paper-count" role="status" aria-live="polite"></p>'
      + '<div id="paper-list"></div>';
  }
  function renderPaperList() {
    var q = filters.q.trim().toLowerCase();
    var list = S.papers.filter(function (p) {
      if (filters.area && p.area !== filters.area) return false;
      if (filters.digest && p.digest !== filters.digest) return false;
      if (q && (p.title + " " + p.authors + " " + p.gist + " " + p.id + " " + (p.interest || []).join(" ")).toLowerCase().indexOf(q) < 0) return false;
      return true;
    }).sort(function (a, b) { return (b.digest || "").localeCompare(a.digest || "") || a.area.localeCompare(b.area) || a.id.localeCompare(b.id); });
    document.getElementById("paper-count").textContent = list.length + " of " + S.papers.length + " papers";
    var groups = {}, order = [];
    list.forEach(function (p) { if (!groups[p.digest]) { groups[p.digest] = []; order.push(p.digest); } groups[p.digest].push(p); });
    document.getElementById("paper-list").innerHTML = order.length ? order.map(function (d) {
      return '<h2 class="group">' + esc(fmtDate(d, { weekday: "long", day: "numeric", month: "long" })) + ' <span class="count">' + groups[d].length + " papers</span></h2>" + grid(groups[d]);
    }).join("") : '<p class="empty">No papers match these filters.</p>';
  }
  document.addEventListener("input", function (e) {
    if (e.target.id === "f-q") filters.q = e.target.value;
    else if (e.target.id === "f-area") filters.area = e.target.value;
    else if (e.target.id === "f-digest") filters.digest = e.target.value;
    else return;
    renderPaperList();
  });

  function viewIdeas() {
    return hero("Between sessions", "Ideas", "Post short ideas, questions and pointers for the group, and tell the digest what you work on so it can tag papers for you. Everyone can read the posts; writing one needs a GitHub account (sign in inside the box).")
      + '<div class="seg" role="group" aria-label="Board"><button type="button" data-ideas="ideas" aria-pressed="' + (ideasTab === "ideas") + '">Ideas of the week</button>'
      + '<button type="button" data-ideas="interests" aria-pressed="' + (ideasTab === "interests") + '">Your research interests</button></div>'
      + '<section class="panel">' + (ideasTab === "ideas"
        ? "<h3>Ideas of the week</h3><p>About 150 words at most. Each comment is one post; react to the ones you like.</p>"
        : "<h3>Your research interests</h3><p>Write your name and a few topics you work on or want to follow, for example: <i>Giulio Marino: thermal dark matter, 511 keV line, perovskite detectors</i>. The digest reads this every morning and updates your “May interest” tags; it also learns from your votes. Post again whenever your interests change.</p>")
      + '<div class="giscus-slot" id="ideas-slot"></div></section>'
      + (ideasTab === "ideas" ? ideaPosts() : "");
  }
  function ideaPosts() {
    var list = (S.ideas && S.ideas.comments) || [];
    if (!list.length) return "";
    return '<div class="section-head"><h2>Recent ideas</h2></div><div class="posts">' + list.map(function (c) {
      return '<article class="post"><p class="post-meta"><b>@' + esc(c.login) + "</b> · " + esc(fmtDate(c.at)) + '</p><p class="post-text">' + esc(excerpt(c.text, 900)) + "</p></article>";
    }).join("") + "</div>";
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-ideas]");
    if (!b) return;
    ideasTab = b.dataset.ideas; render(false);
  });

  function sessionItem(s, isPast) {
    var d = parseISO(s.date), list = (s.papers || []).map(paperOf);
    return '<li class="session' + (isPast ? " past" : "") + '"><div class="datebox"><span class="d">' + d.getDate() + '</span><span class="m">' + esc(d.toLocaleDateString("en-GB", { month: "short" })) + "</span></div><div>"
      + "<h3>" + esc(fmtDate(s.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })) + (s.pilot ? '<span class="badge">pilot</span>' : "") + "</h3>"
      + '<p class="meta">' + esc(sessTime(s)) + " · " + esc(sessRoom(s)) + "</p>"
      + '<p class="talk">' + talkLine(s) + "</p>"
      + (s.notes ? '<p class="meta">' + esc(s.notes) + "</p>" : "")
      + (list.length ? "<details><summary>" + list.length + " paper" + (list.length > 1 ? "s" : "") + "</summary><ul>"
        + list.map(function (p) { return '<li><a href="' + absUrl(p.id) + '" target="_blank" rel="noopener">' + esc(p.title) + '</a> <span class="id">' + esc(p.area) + "</span></li>"; }).join("") + "</ul></details>" : "")
      + '<div class="row"><a class="ghost" href="jc.html#' + esc(s.date) + '">Session board</a>' + (!isPast ? '<button type="button" class="ghost" data-ics="' + esc(s.date) + '">Add to calendar</button>' : "") + "</div>"
      + "</div></li>";
  }
  function viewSchedule() {
    var up = upcoming(), pa = past();
    return hero("Every " + S.site.defaults.weekday + " · " + S.site.defaults.time + " · " + S.site.defaults.room, "Schedule", "")
      + '<div class="section-head"><h2>Upcoming</h2></div>'
      + (up.length ? '<ol class="sessions">' + up.map(function (s) { return sessionItem(s, false); }).join("") + "</ol>" : '<p class="empty">No upcoming sessions.</p>')
      + '<div class="section-head"><h2>Past sessions</h2></div>'
      + (pa.length ? '<ol class="sessions">' + pa.map(function (s) { return sessionItem(s, true); }).join("") + "</ol>" : '<p class="empty">No past sessions yet.</p>');
  }

  function viewSpeakers() {
    var t = todayISO(), T = A.tally(S.sessions, S.members, t);
    var talks = [];
    S.sessions.slice().reverse().forEach(function (s) { A.talksOf(s).forEach(function (x) { talks.push({ date: s.date, t: x }); }); });
    var cols = T.dates;
    var gridHtml = '<div class="section-head"><h2>Who has presented</h2></div>'
      + '<p class="lede-s">One row per participant: <span class="mk done">●</span> talk given, <span class="mk plan">○</span> scheduled. The draw at the end of each session picks among those with the fewest presentations.</p>'
      + (S.site.repoUrl ? '<p class="lede-s"><a href="' + esc(S.site.repoUrl + "/issues/new?template=participant.yml") + '" target="_blank" rel="noopener">Add or remove a participant ↗</a> (a short form on GitHub: name and INSPIRE link; the list updates in a few minutes).</p>' : "")
      + '<div class="table-wrap"><table class="tally"><caption class="visually-hidden">Presentations per participant</caption><thead><tr><th scope="col">Participant</th>'
      + cols.map(function (d) { return '<th scope="col" class="c">' + esc(fmtDate(d, { day: "numeric", month: "short" })) + "</th>"; }).join("")
      + '<th scope="col" class="c">Total</th></tr></thead><tbody>'
      + T.rows.map(function (r) {
          return "<tr" + (r.total ? "" : ' class="zero"') + '><th scope="row">' + esc(r.name) + (r.member ? "" : ' <span class="guest">guest</span>') + "</th>"
            + cols.map(function (d) {
                var x = r.talks[d];
                return '<td class="c">' + (x ? '<span class="mk ' + (x.done ? "done" : "plan") + '" title="' + esc((x.done ? "Talk given" : "Scheduled") + (x.title ? ": " + x.title : "")) + '">' + (x.done ? "●" : "○") + "</span>" : "") + "</td>";
              }).join("")
            + '<td class="c n">' + r.given + (r.planned ? '<small> +' + r.planned + "</small>" : "") + "</td></tr>";
        }).join("") + "</tbody></table></div>";
    var listHtml = '<div class="section-head"><h2>All talks</h2></div>'
      + (talks.length ? '<div class="table-wrap"><table><caption class="visually-hidden">Talks by date</caption>'
        + '<thead><tr><th scope="col">Date</th><th scope="col">Speaker</th><th scope="col">Talk</th></tr></thead><tbody>'
        + talks.map(function (x) {
            return '<tr><td class="date">' + esc(fmtDate(x.date)) + (x.date >= t ? '<span class="badge">next</span>' : "") + "</td><td>" + esc(x.t.speaker) + "</td><td>" + esc(x.t.title || "—") + (x.t.minutes ? ' <span class="mins">' + x.t.minutes + "′</span>" : "") + "</td></tr>";
          }).join("") + "</tbody></table></div>"
        : '<p class="empty">No talks recorded yet.</p>');
    return hero("Drawn at the end of each session", "Speakers", "Each session opens with one or two talks. At the end, a name is drawn for a short presentation the following week, among the participants who have presented least.")
      + gridHtml + listHtml;
  }

  function viewAbout() {
    var d = S.site.defaults;
    return hero("About", esc(S.site.title), esc(S.site.tagline || ""))
      + '<div class="facts">'
      + '<div class="fact"><div class="k">When</div><div class="v">' + esc(d.weekday) + "s, " + esc(d.time) + '</div><p>About one hour.</p></div>'
      + '<div class="fact"><div class="k">Where</div><div class="v">' + esc(d.room) + '</div><p>Department of Physics, Pisa.</p></div>'
      + '<div class="fact"><div class="k">Format</div><div class="v">Talk · papers · ideas</div><p>' + (S.site.agenda || []).map(function (a) { return esc(a.minutes) + "′ " + esc(a.title.toLowerCase()); }).join(", ") + ".</p></div>"
      + "</div>"
      + '<div class="prose">' + (S.site.about || []).map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("") + "</div>"
      + (S.site.proposeUrl ? '<p><a class="primary" href="' + esc(S.site.proposeUrl) + '" rel="noopener">Suggest a paper</a></p>' : "");
  }

  /* ---------- router ---------- */
  var VIEWS = { next: viewNext, papers: viewPapers, ideas: viewIdeas, schedule: viewSchedule, speakers: viewSpeakers, about: viewAbout };
  function route() { var r = (location.hash || "#next").slice(1); return ROUTES.indexOf(r) >= 0 ? r : "next"; }
  function render(moveFocus) {
    var r = route();
    document.querySelectorAll("#nav a").forEach(function (a) {
      if (a.getAttribute("href") === "#" + r) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    var cur = document.querySelector('#nav a[aria-current="page"]');
    if (cur && cur.scrollIntoView) try { cur.scrollIntoView({ block: "nearest", inline: "center" }); } catch (e) {}
    cardSeq = 0;
    $main.innerHTML = VIEWS[r]();
    if (r === "papers") renderPaperList();
    if (r === "ideas") {
      var g = S.site.giscus || {};
      mountGiscus(document.getElementById("ideas-slot"), ideasTab === "ideas"
        ? { category: g.ideasCategory, categoryId: g.ideasCategoryId, term: g.ideasTerm || "Ideas board" }
        : { category: g.ideasCategory, categoryId: g.ideasCategoryId, term: g.interestsTerm || "Research interests" });
    }
    document.title = (r === "next" ? "" : TITLES[r] + " · ") + S.site.title;
    if (moveFocus) { $main.focus({ preventScroll: true }); window.scrollTo(0, 0); }
  }
  window.addEventListener("hashchange", function () { render(true); });

  /* ---------- load data ---------- */
  function getJSON(path) {
    return fetch(path, { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error(path + ": HTTP " + r.status);
      return r.json();
    });
  }
  Promise.all([getJSON("data/site.json"), getJSON("data/sessions.json"), getJSON("data/papers.json"),
               getJSON("data/votes.json").catch(function () { return { papers: {} }; }),
               getJSON("data/members.json").catch(function () { return { members: [] }; })])
    .then(function (res) {
      S.members = (res[4] && res[4].members) || [];
      S.site = res[0];
      S.sessions = res[1].slice().sort(function (a, b) { return a.date.localeCompare(b.date); });
      S.papers = res[2];
      S.papers.forEach(function (p) { S.byId[p.id] = p; });
      S.votes = (res[3] && res[3].papers) || {};
      S.ideas = (res[3] && res[3].ideas) || null;
      document.getElementById("site-title").textContent = S.site.title;
      document.getElementById("footer-text").innerHTML = (S.site.updated ? "Last updated " + esc(fmtDate(S.site.updated)) + ". " : "")
        + (S.site.repoUrl ? '<a href="' + esc(S.site.repoUrl) + '" rel="noopener">Source and data on GitHub</a>.' : "");
      render(false);
    })
    .catch(function (err) {
      $main.innerHTML = '<p class="empty">Could not load the programme data (' + esc(err.message) + ").</p>"
        + (location.protocol === "file:" ? '<p class="empty">Opening the file directly does not work: run <code>python3 -m http.server</code> in the site folder and open http://localhost:8000.</p>' : "");
    });
})();
