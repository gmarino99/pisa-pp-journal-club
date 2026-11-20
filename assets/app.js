/* Pisa Particle Physics Journal Club — static site.
   All content comes from data/*.json; this file only renders it. */
(function () {
  "use strict";

  var ROUTES = ["next", "papers", "ideas", "schedule", "speakers", "about"];
  var TITLES = { next: "Next JC", papers: "Papers", ideas: "Ideas", schedule: "Schedule", speakers: "Speakers", about: "About" };
  var $main = document.getElementById("main");
  var S = { site: null, sessions: [], papers: [], byId: {}, votes: { papers: {} } };
  var filters = { q: "", area: "", digest: "" };

  /* ---------- helpers ---------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function todayISO() {
    var d = new Date();
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function parseISO(iso) { var p = iso.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function fmtDate(iso, opts) {
    try { return parseISO(iso).toLocaleDateString("en-GB", opts || { weekday: "short", day: "numeric", month: "short", year: "numeric" }); }
    catch (e) { return iso; }
  }
  function sessTime(s) { return s.time || S.site.defaults.time; }
  function sessRoom(s) { return s.room || S.site.defaults.room; }
  function arxivUrl(id) { return "https://arxiv.org/abs/" + encodeURIComponent(id); }

  /* ---------- theme ---------- */
  var THEMES = ["auto", "light", "dark"];
  var THEME_UI = { auto: ["◐", "Auto"], light: ["☀", "Light"], dark: ["☾", "Dark"] };
  function currentTheme() { return document.documentElement.dataset.theme || "auto"; }
  function applyTheme(t) {
    if (t === "auto") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = t;
    try { if (t === "auto") localStorage.removeItem("jc-theme"); else localStorage.setItem("jc-theme", t); } catch (e) {}
    document.getElementById("theme-icon").textContent = THEME_UI[t][0];
    document.getElementById("theme-label").textContent = THEME_UI[t][1];
    document.getElementById("theme-toggle").setAttribute("aria-label", "Colour theme: " + THEME_UI[t][1].toLowerCase() + ". Click to change.");
    syncGiscusTheme();
  }
  document.getElementById("theme-toggle").addEventListener("click", function () {
    applyTheme(THEMES[(THEMES.indexOf(currentTheme()) + 1) % THEMES.length]);
  });
  applyTheme(currentTheme());
  try { matchMedia("(prefers-color-scheme: dark)").addEventListener("change", syncGiscusTheme); } catch (e) {}

  /* ---------- giscus (GitHub Discussions: votes and ideas) ---------- */
  function effectiveTheme() {
    var t = currentTheme();
    if (t !== "auto") return t;
    try { return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"; } catch (e) { return "light"; }
  }
  function syncGiscusTheme() {
    var f = document.querySelector("iframe.giscus-frame");
    if (f && f.contentWindow) f.contentWindow.postMessage({ giscus: { setConfig: { theme: effectiveTheme() } } }, "https://giscus.app");
  }
  // giscus attaches to the first ".giscus" element, so only one widget is open at a time.
  function mountGiscus(container, opts) {
    var g = S.site && S.site.giscus;
    if (!g || !g.repoId) { container.innerHTML = '<p class="warn">Voting and comments are not configured yet.</p>'; return; }
    document.querySelectorAll(".giscus-slot").forEach(function (el) { el.innerHTML = ""; el.hidden = true; });
    document.querySelectorAll("[data-discuss][aria-expanded=true]").forEach(function (b) { b.setAttribute("aria-expanded", "false"); });
    container.hidden = false;
    container.innerHTML = '<div class="giscus"></div>';
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
    var slot = document.getElementById("gs-" + b.dataset.discuss.replace(/[^\w]/g, "_") + "-" + b.dataset.ctx);
    if (!slot) return;
    if (b.getAttribute("aria-expanded") === "true") { slot.innerHTML = ""; slot.hidden = true; b.setAttribute("aria-expanded", "false"); return; }
    var g = S.site.giscus || {};
    mountGiscus(slot, { category: g.papersCategory, categoryId: g.papersCategoryId, term: "arXiv:" + b.dataset.discuss });
    b.setAttribute("aria-expanded", "true");
  });

  /* ---------- calendar (.ics) ---------- */
  function icsText(s) {
    return String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
  }
  function icsFor(s) {
    var d = S.site.defaults;
    var t = sessTime(s).split(":");
    var start = parseISO(s.date); start.setHours(+t[0], +t[1], 0, 0);
    var end = new Date(start.getTime() + (s.durationMinutes || d.durationMinutes || 60) * 60000);
    function local(x) { return x.getFullYear() + pad(x.getMonth() + 1) + pad(x.getDate()) + "T" + pad(x.getHours()) + pad(x.getMinutes()) + "00"; }
    var stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
    var desc = s.speaker ? "Talk: " + s.speaker + (s.talkTitle ? " — " + s.talkTitle : "") : "Papers of the week and discussion";
    var lines = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Pisa PP Journal Club//EN", "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      "UID:" + s.date + "@pisa-pp-journal-club",
      "DTSTAMP:" + stamp,
      "DTSTART;TZID=" + d.timezone + ":" + local(start),
      "DTEND;TZID=" + d.timezone + ":" + local(end),
      "SUMMARY:" + icsText(S.site.title),
      "LOCATION:" + icsText(sessRoom(s)),
      "DESCRIPTION:" + icsText(desc + "\n" + location.href.split("#")[0]),
      "END:VEVENT", "END:VCALENDAR"
    ];
    return lines.join("\r\n") + "\r\n";
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

  /* ---------- building blocks ---------- */
  function votesOf(id) { var v = (S.votes.papers || {})[id] || {}; return { up: v.up || 0, down: v.down || 0, net: (v.up || 0) - (v.down || 0) }; }
  var cardSeq = 0;
  function paperCard(p, headingLevel, opts) {
    opts = opts || {};
    var h = "h" + (headingLevel || 3);
    var v = votesOf(p.id);
    var ctx = "c" + (++cardSeq);
    var slotId = "gs-" + String(p.id).replace(/[^\w]/g, "_") + "-" + ctx;
    return '<article class="card">'
      + "<" + h + '><a href="' + arxivUrl(p.id) + '" rel="noopener">' + esc(p.title) + "</a></" + h + ">"
      + '<div class="meta"><span class="badge">' + esc(p.area) + "</span>" + esc(p.authors)
      + " · arXiv:" + esc(p.id) + (p.announced ? " · " + esc(fmtDate(p.announced, { day: "numeric", month: "short" })) : "") + "</div>"
      + (p.gist ? '<p class="gist">' + esc(p.gist) + "</p>" : "")
      + (p.interest && p.interest.length ? '<p class="aff"><b>May interest:</b> ' + p.interest.map(esc).join(", ") + "</p>" : "")
      + (opts.noVote ? "" : '<div class="vote-row"><span class="tally" title="Reactions on GitHub, refreshed every few hours">'
        + "👍 " + v.up + " · 👎 " + v.down + "</span>"
        + '<button type="button" class="btn" data-discuss="' + esc(p.id) + '" data-ctx="' + ctx + '" aria-expanded="false" aria-controls="' + slotId + '">Vote &amp; discuss</button></div>'
        + '<div class="giscus-slot" id="' + slotId + '" hidden></div>')
      + "</article>";
  }
  function papersOf(s) {
    return (s.papers || []).map(function (id) {
      return S.byId[id] || { id: id, title: "arXiv:" + id, authors: "", area: "arXiv" };
    });
  }
  function talkLine(s) {
    if (!s.speaker) return "No talk scheduled yet";
    return esc(s.speaker) + (s.talkTitle ? " — <i>" + esc(s.talkTitle) + "</i>" : "");
  }
  function upcoming() {
    var t = todayISO();
    return S.sessions.filter(function (s) { return s.date >= t; });
  }
  function past() {
    var t = todayISO();
    return S.sessions.filter(function (s) { return s.date < t; }).reverse();
  }

  /* ---------- views ---------- */
  function viewNext() {
    var s = upcoming()[0];
    if (!s) return '<h2>Next session</h2><p class="empty">The next session has not been scheduled yet.</p>';
    var agenda = (S.site.agenda || []).map(function (a) {
      var title = a.title;
      var extra = "";
      if (/talk/i.test(a.title)) extra = ": " + talkLine(s);
      if (/paper/i.test(a.title)) extra = " · " + (s.papers || []).length + " selected";
      return "<li><b>" + esc(title) + "</b>" + (a.minutes ? " (~" + esc(a.minutes) + "′)" : "") + extra + "</li>";
    }).join("");
    var list = papersOf(s);
    return '<h2 class="visually-hidden">Next session</h2>'
      + '<p class="big">' + esc(fmtDate(s.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })) + "</p>"
      + '<p class="meta">' + esc(sessTime(s)) + " · " + esc(sessRoom(s)) + "</p>"
      + (s.pilot ? '<p class="warn">Pilot content: sample selection to test the page.</p>' : "")
      + (s.notes && !s.pilot ? '<p class="note">' + esc(s.notes) + "</p>" : "")
      + '<section class="card" aria-labelledby="prog-h"><h3 id="prog-h">Programme</h3><ol class="agenda">' + agenda + "</ol>"
      + '<div class="actions"><button type="button" class="btn" data-ics="' + esc(s.date) + '">Add to calendar (.ics)</button>'
      + '<a class="btn" href="jc.html#' + esc(s.date) + '">Open session board</a></div></section>'
      + "<h2>Papers to discuss</h2>"
      + (list.length ? list.map(function (p) { return paperCard(p, 3); }).join("") : '<p class="empty">Selection pending.</p>')
      + mostVoted(s);
  }
  function mostVoted(s) {
    var since = new Date(Date.now() - 8 * 864e5); var lim = since.getFullYear() + "-" + pad(since.getMonth() + 1) + "-" + pad(since.getDate());
    var best = S.papers.filter(function (p) { return (p.digest || "") >= lim; })
      .map(function (p) { return { p: p, v: votesOf(p.id) }; })
      .filter(function (x) { return x.v.up > 0; })
      .sort(function (a, b) { return b.v.net - a.v.net || b.v.up - a.v.up; })[0];
    if (!best) return "";
    return "<h2>Most voted this week</h2>" + paperCard(best.p, 3);
  }

  function viewIdeas() {
    return "<h2>Ideas of the week</h2>"
      + "<p>Share a short idea, question or pointer for the group (about 150 words at most). Posting and reacting need a GitHub account: sign in inside the box below.</p>"
      + '<div class="giscus-slot" id="ideas-slot"></div>';
  }

  function sessionCard(s, isPast) {
    var list = papersOf(s);
    return '<article class="card">'
      + "<h3>" + esc(fmtDate(s.date)) + " " + (isPast ? '<span class="badge past">past</span>' : "") + (s.pilot ? '<span class="badge">pilot</span>' : "") + "</h3>"
      + '<div class="meta">' + esc(sessTime(s)) + " · " + esc(sessRoom(s)) + "</div>"
      + "<p class=\"gist\">" + talkLine(s) + "</p>"
      + (s.notes ? '<p class="meta">' + esc(s.notes) + "</p>" : "")
      + (list.length ? "<details><summary>" + list.length + " paper" + (list.length > 1 ? "s" : "") + "</summary><ul>"
        + list.map(function (p) { return '<li><a href="' + arxivUrl(p.id) + '" rel="noopener">' + esc(p.title) + '</a> <span class="meta">' + esc(p.area) + "</span></li>"; }).join("")
        + "</ul></details>" : "")
      + (!isPast ? '<div class="actions"><button type="button" class="btn" data-ics="' + esc(s.date) + '">Add to calendar (.ics)</button></div>' : "")
      + "</article>";
  }
  function viewSchedule() {
    var up = upcoming(), pa = past();
    return "<h2>Upcoming</h2>" + (up.length ? up.map(function (s) { return sessionCard(s, false); }).join("") : '<p class="empty">No upcoming sessions.</p>')
      + "<h2>Past sessions</h2>" + (pa.length ? pa.map(function (s) { return sessionCard(s, true); }).join("") : '<p class="empty">No past sessions yet.</p>');
  }

  function viewPapers() {
    var areas = Array.from(new Set(S.papers.map(function (p) { return p.area; }))).sort();
    var digests = Array.from(new Set(S.papers.map(function (p) { return p.digest; }))).sort().reverse();
    function opts(list, sel, all, fmt) {
      return '<option value="">' + all + "</option>" + list.map(function (v) {
        return '<option value="' + esc(v) + '"' + (v === sel ? " selected" : "") + ">" + esc(fmt ? fmt(v) : v) + "</option>";
      }).join("");
    }
    return "<h2>Paper digest</h2>"
      + '<p class="meta">Recent arXiv papers collected for the journal club. Titles link to arXiv.</p>'
      + '<form class="filters" role="search" onsubmit="return false">'
      + '<div><label for="f-q">Search title, authors or summary</label><input id="f-q" type="search" value="' + esc(filters.q) + '" autocomplete="off"></div>'
      + '<div><label for="f-area">Area</label><select id="f-area">' + opts(areas, filters.area, "All areas") + "</select></div>"
      + '<div><label for="f-digest">Digest</label><select id="f-digest">' + opts(digests, filters.digest, "All dates", function (d) { return fmtDate(d); }) + "</select></div>"
      + "</form>"
      + '<p class="meta" id="paper-count" role="status" aria-live="polite"></p>'
      + '<div id="paper-list"></div>';
  }
  function renderPaperList() {
    var q = filters.q.trim().toLowerCase();
    var list = S.papers.filter(function (p) {
      if (filters.area && p.area !== filters.area) return false;
      if (filters.digest && p.digest !== filters.digest) return false;
      if (q && (p.title + " " + p.authors + " " + p.gist + " " + p.id).toLowerCase().indexOf(q) < 0) return false;
      return true;
    }).sort(function (a, b) { return (b.digest || "").localeCompare(a.digest || "") || a.area.localeCompare(b.area) || a.id.localeCompare(b.id); });
    document.getElementById("paper-count").textContent = list.length + " of " + S.papers.length + " papers";
    var html = "", last = null;
    list.forEach(function (p) {
      if (p.digest !== last) { html += "<h3 class=\"meta\">Digest of " + esc(fmtDate(p.digest)) + "</h3>"; last = p.digest; }
      html += paperCard(p, 4);
    });
    document.getElementById("paper-list").innerHTML = html || '<p class="empty">No papers match these filters.</p>';
  }
  document.addEventListener("input", function (e) {
    if (e.target.id === "f-q") filters.q = e.target.value;
    else if (e.target.id === "f-area") filters.area = e.target.value;
    else if (e.target.id === "f-digest") filters.digest = e.target.value;
    else return;
    renderPaperList();
  });

  function viewSpeakers() {
    var rows = S.sessions.filter(function (s) { return s.speaker; }).slice().reverse();
    if (!rows.length) return '<h2>Speakers</h2><p class="empty">No talks recorded yet.</p>';
    var t = todayISO();
    return '<h2>Speakers</h2><div class="table-wrap"><table><caption class="visually-hidden">Talks by date</caption>'
      + '<thead><tr><th scope="col">Date</th><th scope="col">Speaker</th><th scope="col">Talk</th></tr></thead><tbody>'
      + rows.map(function (s) {
        return "<tr><td>" + esc(fmtDate(s.date)) + (s.date >= t ? ' <span class="badge">upcoming</span>' : "") + "</td><td>" + esc(s.speaker) + "</td><td>" + esc(s.talkTitle || "—") + "</td></tr>";
      }).join("") + "</tbody></table></div>";
  }

  function viewAbout() {
    var d = S.site.defaults;
    return "<h2>About</h2>"
      + (S.site.about || []).map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("")
      + '<section class="card"><h3>When and where</h3><p class="gist">Every ' + esc(d.weekday) + " at " + esc(d.time) + " · " + esc(d.room) + "</p></section>"
      + (S.site.proposeUrl ? '<p><a class="btn" href="' + esc(S.site.proposeUrl) + '" rel="noopener">Suggest a paper</a></p>' : "");
  }

  /* ---------- router ---------- */
  var VIEWS = { next: viewNext, papers: viewPapers, ideas: viewIdeas, schedule: viewSchedule, speakers: viewSpeakers, about: viewAbout };
  function route() {
    var r = (location.hash || "#next").slice(1);
    return ROUTES.indexOf(r) >= 0 ? r : "next";
  }
  function render(moveFocus) {
    var r = route();
    document.querySelectorAll("#nav a").forEach(function (a) {
      if (a.getAttribute("href") === "#" + r) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    $main.innerHTML = VIEWS[r]();
    if (r === "papers") renderPaperList();
    if (r === "ideas") { var g = S.site.giscus || {}; mountGiscus(document.getElementById("ideas-slot"), { category: g.ideasCategory, categoryId: g.ideasCategoryId, term: g.ideasTerm || "Ideas board" }); }
    document.title = (r === "next" ? "" : TITLES[r] + " · ") + S.site.title;
    if (moveFocus) $main.focus({ preventScroll: false });
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
               getJSON("data/votes.json").catch(function () { return { papers: {} }; })])
    .then(function (res) {
      S.site = res[0];
      S.sessions = res[1].slice().sort(function (a, b) { return a.date.localeCompare(b.date); });
      S.papers = res[2];
      S.papers.forEach(function (p) { S.byId[p.id] = p; });
      S.votes = res[3] && res[3].papers ? res[3] : { papers: {} };
      var d = S.site.defaults;
      document.getElementById("site-title").textContent = S.site.title;
      document.getElementById("site-sub").textContent = d.weekday + "s " + d.time + " · " + d.room;
      var foot = document.getElementById("footer-text");
      foot.innerHTML = (S.site.updated ? "Last updated " + esc(fmtDate(S.site.updated)) + ". " : "")
        + (S.site.repoUrl ? '<a href="' + esc(S.site.repoUrl) + '" rel="noopener">Source and data on GitHub</a>.' : "");
      render(false);
    })
    .catch(function (err) {
      $main.innerHTML = '<p class="warn">Could not load the programme data (' + esc(err.message) + ").</p>"
        + (location.protocol === "file:" ? '<p class="meta">Opening the file directly does not work: run <code>python3 -m http.server</code> in the site folder and open http://localhost:8000.</p>' : "");
    });
})();
