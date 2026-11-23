/* Session board: shows the papers selected for a JC session and presents them full screen.
   Reads the same data/*.json files as the main site. */
(function () {
  "use strict";

  var S = { site: null, sessions: [], byId: {}, papers: [], votes: {}, decks: {}, members: [], current: null, filter: "" };
  var A = window.JCAgenda;
  var $ = function (id) { return document.getElementById(id); };

  /* ---------- helpers ---------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function iso(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function parseISO(s) { var p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function fmt(s, o) { return parseISO(s).toLocaleDateString("en-GB", o); }
  function timeOf(s) { return s.time || S.site.defaults.time; }
  function roomOf(s) { return s.room || S.site.defaults.room; }
  function startOf(s) { var d = parseISO(s.date), t = timeOf(s).split(":"); d.setHours(+t[0], +t[1], 0, 0); return d; }
  function durOf(s) { return (s.durationMinutes || S.site.defaults.durationMinutes || 60) * 60000; }
  function votesOf(id) { var v = S.votes[id] || {}; return { up: v.up || 0, down: v.down || 0 }; }
  function paperOf(id) { return S.byId[id] || { id: id, title: "arXiv:" + id, authors: "", area: "arXiv" }; }
  function absUrl(id) { return "https://arxiv.org/abs/" + encodeURIComponent(id); }
  function pdfUrl(id) { return "https://arxiv.org/pdf/" + encodeURIComponent(id); }

  /* ---------- theme ---------- */
  var THEMES = ["auto", "light", "dark"], ICON = { auto: "◐", light: "☀", dark: "☾" };
  function theme() { return document.documentElement.dataset.theme || "auto"; }
  function setTheme(t) {
    if (t === "auto") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
    try { if (t === "auto") localStorage.removeItem("jc-theme"); else localStorage.setItem("jc-theme", t); } catch (e) {}
    $("theme-toggle").textContent = ICON[t];
    $("theme-toggle").setAttribute("aria-label", "Colour theme: " + t + ". Click to change.");
  }
  $("theme-toggle").addEventListener("click", function () { setTheme(THEMES[(THEMES.indexOf(theme()) + 1) % 3]); });
  setTheme(theme());

  /* ---------- status line ---------- */
  function status(s) {
    var now = Date.now(), st = startOf(s).getTime(), end = st + durOf(s);
    if (now >= st && now < end) return "In session now · " + roomOf(s);
    if (now >= end) return "Past session";
    var mins = Math.round((st - now) / 60000);
    if (mins < 60) return "Starts in " + mins + " min";
    if (iso(new Date()) === s.date) return "Today · starts in " + Math.round(mins / 60) + " h";
    var days = Math.round((parseISO(s.date) - parseISO(iso(new Date()))) / 864e5);
    return (days === 1 ? "Tomorrow" : "In " + days + " days") + (s === upcoming() ? " · next session" : "");
  }
  function upcoming() {
    var now = Date.now();
    return S.sessions.find(function (s) { return startOf(s).getTime() + durOf(s) > now; }) || null;
  }

  /* ---------- rendering ---------- */
  function areaLabel(a) { return a || "arXiv"; }
  function card(p, i) {
    var v = votesOf(p.id);
    return '<li class="paper" data-area="' + esc(p.area) + '" style="--i:' + i + '">'
      + '<div class="paper-head"><span class="num" aria-hidden="true">' + pad(i + 1) + '</span>'
      + '<span class="area"><span class="dot"></span>' + esc(areaLabel(p.area)) + "</span></div>"
      + '<h3><a href="' + absUrl(p.id) + '" target="_blank" rel="noopener">' + esc(p.title) + "</a></h3>"
      + (p.authors ? '<p class="authors">' + esc(p.authors) + "</p>" : "")
      + (p.gist ? '<p class="gist">' + esc(p.gist) + "</p>" : "")
      + stepsHtml(p)
      + (p.interest && p.interest.length ? '<p class="aff"><b>May interest</b> ' + p.interest.map(esc).join(", ") + "</p>" : "")
      + '<div class="paper-foot"><span class="id">arXiv:' + esc(p.id) + "</span>"
      + '<span class="votes" title="Votes on GitHub">👍 ' + v.up + " · 👎 " + v.down + "</span>"
      + '<span class="links"><a href="' + absUrl(p.id) + '" target="_blank" rel="noopener">Abstract</a><a href="' + pdfUrl(p.id) + '" target="_blank" rel="noopener">PDF</a></span></div>'
      + deckButton(p)
      + "</li>";
  }

  function deckButton(p) {
    var d = S.decks[p.id], k = ((S.current && S.current.papers) || []).indexOf(p.id) + 1;
    if (!d || !d.slides || !k) return "";
    return '<button type="button" class="primary deck-btn" data-open-deck="' + k + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>Explain in ' + d.slides.length + " slides</button>";
  }
  function stepsHtml(p) {
    if (!p.explain || !p.explain.length) return "";
    return '<p class="steps-label">In ' + p.explain.length + ' steps</p><ol class="steps">'
      + p.explain.map(function (x) { return "<li><span>" + esc(x) + "</span></li>"; }).join("") + "</ol>";
  }
  function render() {
    var s = S.current;
    if (!s) {
      $("hero-status").textContent = "No sessions yet";
      $("hero-date").textContent = "Journal Club";
      $("papers").innerHTML = '<li class="empty">No session has been scheduled.</li>';
      return;
    }
    var list = (s.papers || []).map(paperOf);
    $("hero-status").textContent = status(s) + (s.pilot ? " · pilot selection" : "");
    $("hero-date").textContent = fmt(s.date, { weekday: "long", day: "numeric", month: "long" });
    $("hero-meta").innerHTML = "<b>" + esc(timeOf(s)) + "</b> · " + esc(roomOf(s)) + " · " + esc(fmt(s.date, { year: "numeric" }))
      + " · " + list.length + " paper" + (list.length === 1 ? "" : "s");
    $("present-btn").disabled = false;
    document.title = "JC " + fmt(s.date, { day: "numeric", month: "short" }) + " · Session Board";

    // timeline
    var t0 = startOf(s);
    var bar = "", items = "", acc = 0, nt = 0;
    A.programme(S.site, s).forEach(function (a) {
      var jump = a.kind === "talk" && a.talk ? "t" + (++nt) : a.kind === "papers" && list.length ? "p1" : a.kind === "draw" && S.members.length ? "d" : "";
      var kind = a.kind === "draw" ? "other" : a.kind;
      var from = new Date(t0.getTime() + acc * 60000); acc += a.minutes || 0;
      bar += '<span class="seg-' + kind + '" style="flex:' + (a.minutes || 1) + '"></span>';
      var detail = a.kind === "talk" ? (a.talk ? "<b>" + esc(a.talk.speaker) + "</b>" + (a.talk.title ? " — <i>" + esc(a.talk.title) + "</i>" : "") + (a.talkMinutes ? "<br>" + a.talkMinutes + "′ + questions" : "") : "No talk this week")
        : a.kind === "papers" ? list.length + " papers, about " + Math.max(2, Math.round((a.minutes || 15) / Math.max(1, list.length))) + " min each"
        : esc(a.detail || "");
      var tag = jump ? "button" : "div";
      items += "<" + tag + ' class="tl-item' + (jump ? ' tl-jump" type="button" data-jump="' + jump + '" title="Present from here' : "") + '"><span class="t">' + pad(from.getHours()) + ":" + pad(from.getMinutes()) + " · " + (a.minutes || "") + "′</span>"
        + "<h3>" + esc(a.title) + "</h3><p>" + detail + "</p>" + (jump ? '<span class="tl-go">Present from here →</span>' : "") + "</" + tag + ">";
    });
    $("timeline").innerHTML = '<div class="tl-bar" aria-hidden="true">' + bar + '</div><div class="tl-items">' + items + "</div>";
    var showDraw = s.date >= iso(new Date()) && S.members.length > 0;
    $("draw").hidden = !showDraw;
    if (showDraw) drawPanel($("draw"), false);

    // area chips
    var areas = Array.from(new Set(list.map(function (p) { return p.area; })));
    if (S.filter && areas.indexOf(S.filter) < 0) S.filter = "";
    $("area-chips").innerHTML = areas.length > 1
      ? ['<button type="button" class="chip" data-area="" aria-pressed="' + (!S.filter) + '">All</button>'].concat(areas.map(function (a) {
          return '<button type="button" class="chip paper-chip" data-area="' + esc(a) + '" aria-pressed="' + (S.filter === a) + '" style="--area:var(--a-' + chipVar(a) + ')"><span class="dot"></span>' + esc(a) + "</button>";
        })).join("")
      : "";

    var shown = list.map(function (p, i) { return { p: p, i: i }; }).filter(function (x) { return !S.filter || x.p.area === S.filter; });
    $("papers").innerHTML = shown.length ? shown.map(function (x) { return card(x.p, x.i); }).join("")
      : '<li class="empty">The selection for this session is not ready yet. It is published on the Monday before.</li>';

    // most voted in the week before the session
    var lim = iso(new Date(parseISO(s.date).getTime() - 8 * 864e5));
    var best = S.papers.filter(function (p) { return (p.digest || "") >= lim && (p.digest || "") <= s.date && (s.papers || []).indexOf(p.id) < 0; })
      .map(function (p) { var v = votesOf(p.id); return { p: p, net: v.up - v.down, up: v.up }; })
      .filter(function (x) { return x.up > 0; })
      .sort(function (a, b) { return b.net - a.net || b.up - a.up; })[0];
    $("top-voted-wrap").hidden = !best;
    $("top-voted").innerHTML = best ? '<ol class="papers" style="margin:16px 0 40px">' + card(best.p, 0).replace('<span class="num" aria-hidden="true">01</span>', '<span class="num" aria-hidden="true">★</span>') + "</ol>" : "";
  }
  function chipVar(a) {
    return { "hep-ph": "hep-ph", "hep-th": "hep-th", "hep-ex": "hep-ex", "hep-lat": "hep-lat", "astro-ph.CO": "astro-co", "astro-ph.HE": "astro-he", "gr-qc": "gr-qc" }[a] || "other";
  }

  $("area-chips").addEventListener("click", function (e) {
    var b = e.target.closest(".chip"); if (!b) return;
    S.filter = b.dataset.area; render();
  });
  $("session-select").addEventListener("change", function (e) { location.hash = e.target.value; });
  window.addEventListener("hashchange", function () { pick(); render(); loadDecks().then(render); });

  function loadDecks() {
    var ids = ((S.current && S.current.papers) || []).filter(function (id) { return !(id in S.decks); });
    return Promise.all(ids.map(function (id) {
      return fetch("data/decks/" + encodeURIComponent(id) + ".json", { cache: "no-cache" })
        .then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
        .then(function (d) { S.decks[id] = d; });
    }));
  }
  function pick() {
    var h = decodeURIComponent(location.hash.slice(1));
    S.current = S.sessions.find(function (s) { return s.date === h; }) || upcoming() || S.sessions[S.sessions.length - 1] || null;
    if (S.current) $("session-select").value = S.current.date;
  }

  /* ---------- draw of next week's speaker ---------- */
  // By default the draw is among participants not already scheduled who have presented least.
  // The chair can tick names in or out, add a name, or pick a volunteer directly.
  // Nothing is saved: the chair records the result in data/sessions.json.
  function nextSession(s) { return S.sessions.find(function (x) { return x.date > s.date; }); }
  function drawState() {
    var s = S.current;
    if (S.draw && S.draw.date === s.date) return S.draw;
    var d = A.drawPool(S.sessions, S.members, s.date);
    var T = A.tally(S.sessions, S.members, s.date);
    var names = T.rows.filter(function (r) { return r.member; }).map(function (r) { return { name: r.name, total: r.total, planned: r.planned }; })
      .sort(function (x, y) { return x.total - y.total || x.name.localeCompare(y.name); });
    var on = {};
    d.pool.forEach(function (r) { on[r.name] = true; });
    S.draw = { date: s.date, names: names, on: on, min: d.min, result: "" };
    return S.draw;
  }
  function drawPanel(el, onStage) {
    var s = S.current, st = drawState(), nx = nextSession(s);
    var when = nx ? fmt(nx.date, { weekday: "long", day: "numeric", month: "long" }) : "next week";
    var pool = st.names.filter(function (r) { return st.on[r.name]; });
    el.innerHTML = '<h2 id="' + (onStage ? "draw-h-stage" : "draw-h") + '">Next week\'s speaker</h2>'
      + "<p>A short presentation on " + esc(when) + ". Pre-selected: who has presented least and is not already scheduled. "
      + "Click a name to put it in or take it out of the draw; the number is how many times that person has presented.</p>"
      + '<div class="draw-row"><button type="button" class="primary" data-draw' + (pool.length ? "" : " disabled") + ">Draw among " + pool.length + "</button>"
      + '<span class="draw-name' + (st.result ? " picked" : "") + '" aria-live="polite">' + esc(st.result) + "</span></div>"
      + '<div class="draw-pool" role="group" aria-label="Names in the draw">' + st.names.map(function (r, i) {
          return '<button type="button" data-toggle="' + i + '" aria-pressed="' + !!st.on[r.name] + '" class="' + (st.on[r.name] ? "in" : "") + (r.name === st.result ? " on" : "") + '">'
            + esc(r.name) + " <small>" + r.total + (r.planned ? "*" : "") + "</small></button>";
        }).join("") + "</div>"
      + '<div class="draw-tools">'
      + '<button type="button" class="ghost" data-pool="all">Everyone</button><button type="button" class="ghost" data-pool="none">No one</button><button type="button" class="ghost" data-pool="fair">Reset</button>'
      + '<form class="draw-add" data-add><label class="visually-hidden" for="add-' + (onStage ? "s" : "b") + '">Add a name</label>'
      + '<input id="add-' + (onStage ? "s" : "b") + '" placeholder="Add a name" maxlength="60" autocomplete="off"><button type="submit" class="ghost">Add</button></form>'
      + '<span class="draw-vol"><label for="vol-' + (onStage ? "s" : "b") + '">Volunteer</label><select id="vol-' + (onStage ? "s" : "b") + '" data-volunteer><option value="">choose…</option>'
      + st.names.map(function (r, i) { return '<option value="' + i + '">' + esc(r.name) + "</option>"; }).join("") + "</select></span>"
      + "</div>"
      + (S.site.repoUrl ? '<p class="draw-note">Changes here last until the page is reloaded. To change the list for good: <a href="' + esc(S.site.repoUrl + "/issues/new?template=participant.yml") + '" target="_blank" rel="noopener">add or remove a participant ↗</a>.</p>' : "")
      + (st.names.some(function (r) { return r.planned; }) ? '<p class="draw-note">* already scheduled in a coming session.</p>' : "");
  }
  function redrawPanels() { document.querySelectorAll(".draw").forEach(function (el) { if (!el.hidden) drawPanel(el, !!el.closest(".slide")); }); }
  var rolling = null;
  document.addEventListener("click", function (e) {
    var st = S.draw; if (!st || rolling) return;
    var t = e.target.closest("[data-toggle]");
    if (t) { var r = st.names[+t.dataset.toggle]; st.on[r.name] = !st.on[r.name]; redrawPanels(); return; }
    var pb = e.target.closest("[data-pool]");
    if (pb) {
      var m = pb.dataset.pool;
      st.names.forEach(function (r) { st.on[r.name] = m === "all" ? !r.planned : m === "none" ? false : (!r.planned && r.total === st.min); });
      redrawPanels(); return;
    }
    var b = e.target.closest("[data-draw]"); if (!b) return;
    var box = b.closest(".draw"), out = box.querySelector(".draw-name");
    var pool = st.names.filter(function (r) { return st.on[r.name]; });
    if (!pool.length) return;
    var chips = Array.prototype.filter.call(box.querySelectorAll("[data-toggle]"), function (c) { return st.on[st.names[+c.dataset.toggle].name]; });
    var win = A.drawOne(pool), k = 0, n = 0, steps = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 22;
    b.disabled = true; out.className = "draw-name rolling";
    function done() { rolling = null; st.result = win.name; redrawPanels(); }
    if (!steps) { done(); return; }
    (function tick() {
      k = (k + 1) % pool.length; n += 1;
      chips.forEach(function (c, j) { c.classList.toggle("on", j === k); });
      out.textContent = pool[k].name;
      rolling = n < steps ? setTimeout(tick, 40 + n * n / 3) : (done(), null);
    })();
  });
  document.addEventListener("submit", function (e) {
    var f = e.target.closest("[data-add]"); if (!f) return;
    e.preventDefault();
    var st = S.draw, v = f.querySelector("input").value.replace(/\s+/g, " ").trim();
    if (!st || !v) return;
    var ex = st.names.find(function (r) { return r.name.toLowerCase() === v.toLowerCase(); });
    if (!ex) { ex = { name: v, total: 0, planned: 0 }; st.names.push(ex); }
    st.on[ex.name] = true; redrawPanels();
  });
  document.addEventListener("change", function (e) {
    var sel = e.target.closest("[data-volunteer]"); if (!sel || !S.draw || sel.value === "") return;
    S.draw.result = S.draw.names[+sel.value].name + " (volunteer)"; redrawPanels();
  });

  /* ---------- presentation ---------- */
  var P = { idx: 0, slides: [], secs: 300, left: 300, timerId: null };
  function perPaperSecs() {
    var a = (S.site.agenda || []).find(function (x) { return /paper/i.test(x.title); });
    var n = Math.max(1, (S.current.papers || []).length);
    return Math.max(2, Math.round(((a && a.minutes) || 25) / n)) * 60;
  }
  function buildSlides() {
    var s = S.current, out = [{ intro: true, key: "o" }];
    A.talksOf(s).forEach(function (t, ti) { out.push({ kind: "talk", talk: t, ti: ti + 1, key: "t" + (ti + 1) }); });
    (s.papers || []).forEach(function (id, pi) {
      var p = paperOf(id), deck = S.decks[id];
      out.push({ paper: p, pi: pi + 1, kind: "title", key: "p" + (pi + 1) });
      ((deck && deck.slides) || []).forEach(function (sl, k, arr) { out.push({ paper: p, pi: pi + 1, kind: "deck", slide: sl, k: k + 1, n: arr.length, key: "p" + (pi + 1) }); });
    });
    if (S.members.length) out.push({ kind: "draw", key: "d" });
    return out;
  }
  function keyIndex(key) {
    for (var j = 0; j < P.slides.length; j++) if (P.slides[j].key === key) return j;
    return -1;
  }
  function jumpTo(key) { var j = keyIndex(key); if (j >= 0) show(j); }
  function openStage(paperIndex) {
    var s = S.current; if (!s) return;
    P.slides = buildSlides();
    P.paper = "";
    $("stage").hidden = false;
    document.body.style.overflow = "hidden";
    try { if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(function () {}); } catch (e) {}
    var start = 0;
    if (typeof paperIndex === "string") start = Math.max(0, keyIndex(paperIndex));
    else if (paperIndex) P.slides.some(function (x, k) { if (x.kind === "title" && x.pi === paperIndex) { start = k; return true; } return false; });
    show(start);
    $("next").focus();
  }
  function closeStage() {
    stopTimer();
    if (window.JCDeck) window.JCDeck.stop();
    $("stage").hidden = true;
    document.body.style.overflow = "";
    try { if (document.fullscreenElement) document.exitFullscreen().catch(function () {}); } catch (e) {}
    $("present-btn").focus();
  }
  function show(i) {
    P.idx = Math.max(0, Math.min(P.slides.length - 1, i));
    var s = S.current, x = P.slides[P.idx], el = $("slide");
    if (window.JCDeck) window.JCDeck.stop();
    el.className = "slide"; el.removeAttribute("data-area");
    var nTalks = A.talksOf(s).length;
    void el.offsetWidth; // restart the entry animation
    var nPapers = (s.papers || []).length;
    if (x.intro) {
      el.classList.add("intro");
      el.innerHTML = '<p class="eyebrow">' + esc(S.site.title) + "</p>"
        + "<h2>" + esc(fmt(s.date, { weekday: "long", day: "numeric", month: "long" })) + "</h2>"
        + '<p class="authors">' + esc(timeOf(s)) + " · " + esc(roomOf(s)) + "</p>"
        + '<ol class="agenda">' + A.programme(S.site, s).map(function (a) {
            var d = a.kind === "talk" ? (a.talk ? a.talk.speaker + (a.talk.title ? " — " + a.talk.title : "") : "no talk this week")
              : a.kind === "papers" ? nPapers + " papers" : a.kind === "draw" ? "next week's speaker" : (a.detail || "");
            return "<li><span>" + esc(a.minutes) + "′</span>" + esc(a.title) + (d ? " · " + esc(d) : "") + "</li>";
          }).join("") + "</ol>";
      $("stage-count").textContent = "Overview";
    } else if (x.kind === "talk") {
      el.classList.add("intro");
      el.innerHTML = '<p class="eyebrow">Talk ' + x.ti + (nTalks > 1 ? " of " + nTalks : "") + (x.talk.minutes ? " · " + x.talk.minutes + " min" : "") + "</p>"
        + "<h2>" + esc(x.talk.title || "Talk") + "</h2>"
        + '<p class="authors">' + esc(x.talk.speaker) + "</p>";
      $("stage-count").textContent = "Talk " + x.ti + " of " + nTalks;
    } else if (x.kind === "draw") {
      el.classList.add("drawslide");
      el.innerHTML = '<div class="draw"></div>';
      drawPanel(el.firstChild, true);
      $("stage-count").textContent = "Draw";
    } else if (x.kind === "deck") {
      el.setAttribute("data-area", x.paper.area);
      window.JCDeck.render(el, Object.assign({ kicker: x.paper.area + " · " + shortTitle(x.paper.title) }, x.slide), x.paper);
      $("stage-count").textContent = "Paper " + x.pi + " of " + nPapers + " · slide " + x.k + "/" + x.n;
    } else {
      var p = x.paper, v = votesOf(p.id), deck = S.decks[p.id];
      el.setAttribute("data-area", p.area);
      var hasSteps = !!(p.explain && p.explain.length);
      if (hasSteps) el.classList.add("has-steps");
      el.innerHTML = '<div class="slide-main"><span class="area"><span class="dot"></span>' + esc(areaLabel(p.area)) + "</span>"
        + "<h2>" + esc(p.title) + "</h2>"
        + (p.authors ? '<p class="authors">' + esc(p.authors) + "</p>" : "")
        + (hasSteps ? "" : (p.gist ? '<p class="gist">' + esc(p.gist) + "</p>" : ""))
        + (p.interest && p.interest.length ? '<p class="aff"><b>May interest</b> ' + p.interest.map(esc).join(", ") + "</p>" : "")
        + '<div class="meta-row"><span>arXiv:' + esc(p.id) + "</span><span>👍 " + v.up + " · 👎 " + v.down + "</span>"
        + '<a href="' + absUrl(p.id) + '" target="_blank" rel="noopener">abstract ↗</a><a href="' + pdfUrl(p.id) + '" target="_blank" rel="noopener">pdf ↗</a></div>'
        + (deck && deck.slides ? '<p class="deck-count">' + deck.slides.length + " explanatory slides follow →</p>" : "") + "</div>"
        + (hasSteps ? '<div class="slide-steps">' + stepsHtml(p) + "</div>" : "");
      $("stage-count").textContent = "Paper " + x.pi + " of " + nPapers;
    }
    var keys = [];
    P.slides.forEach(function (y) { if (keys.indexOf(y.key) < 0) keys.push(y.key); });
    var talks = A.talksOf(s), html = "", inPapers = false;
    keys.forEach(function (k) {
      var cur = k === x.key ? ' aria-current="true"' : "";
      if (k[0] === "p") {
        if (!inPapers) { html += '<span class="nav-group"><span class="nav-lab">Papers</span>'; inPapers = true; }
        html += '<button type="button" class="nav-num" data-k="' + k + '" aria-label="Paper ' + k.slice(1) + '"' + cur + ">" + k.slice(1) + "</button>";
        return;
      }
      if (inPapers) { html += "</span>"; inPapers = false; }
      var t = k[0] === "t" ? talks[+k.slice(1) - 1] : null;
      var lab = k === "o" ? "Overview" : k === "d" ? "Draw" : "Talk " + k.slice(1) + (t ? " · " + String(t.speaker).split(" ").pop() : "");
      html += '<button type="button" class="nav-pill" data-k="' + k + '"' + cur + ">" + esc(lab) + "</button>";
    });
    if (inPapers) html += "</span>";
    $("dots").innerHTML = html;
    $("progress-bar").style.width = (P.slides.length > 1 ? (P.idx / (P.slides.length - 1)) * 100 : 100) + "%";
    var timed = x.kind === "talk" ? !!x.talk.minutes : x.kind === "title" || x.kind === "deck";
    $("timer").style.visibility = timed ? "visible" : "hidden";
    if (x.key !== P.paper) {   // the timer runs per talk or per paper, across all its slides
      P.paper = x.key;
      P.secs = x.kind === "talk" ? (x.talk.minutes || 15) * 60 : perPaperSecs();
      resetTimer();
    }
  }
  function shortTitle(t) { t = String(t || ""); return t.length > 48 ? t.slice(0, 46) + "…" : t; }

  // timer
  var CIRC = 2 * Math.PI * 52;
  function drawTimer() {
    var m = Math.floor(Math.max(0, P.left) / 60), sec = Math.max(0, P.left) % 60;
    $("timer-text").textContent = (P.left < 0 ? "+" : "") + m + ":" + pad(P.left < 0 ? Math.abs(P.left) % 60 : sec);
    if (P.left < 0) $("timer-text").textContent = "+" + Math.floor(-P.left / 60) + ":" + pad(-P.left % 60);
    $("timer-arc").style.strokeDashoffset = String(CIRC * (1 - Math.max(0, P.left) / P.secs));
    var t = $("timer");
    t.classList.toggle("low", P.left <= 60 && P.left > 0);
    t.classList.toggle("done", P.left <= 0);
    t.classList.toggle("running", !!P.timerId);
    $("timer-btn").setAttribute("aria-label", (P.timerId ? "Pause" : "Start") + " timer, " + $("timer-text").textContent + " left");
  }
  function startTimer() { if (P.timerId) return; P.timerId = setInterval(function () { P.left -= 1; drawTimer(); }, 1000); drawTimer(); }
  function stopTimer() { clearInterval(P.timerId); P.timerId = null; drawTimer(); }
  function resetTimer() { stopTimer(); P.left = P.secs; drawTimer(); }
  $("timer-arc").style.strokeDasharray = String(CIRC);

  $("present-btn").addEventListener("click", function () { openStage(0); });
  document.addEventListener("click", function (e) { var b = e.target.closest("[data-open-deck]"); if (b) openStage(+b.dataset.openDeck); });
  document.addEventListener("click", function (e) { var b = e.target.closest("[data-jump]"); if (b) openStage(b.dataset.jump); });
  $("stage-close").addEventListener("click", closeStage);
  $("prev").addEventListener("click", function () { show(P.idx - 1); });
  $("next").addEventListener("click", function () { show(P.idx + 1); });
  $("timer-btn").addEventListener("click", function () { if (P.timerId) stopTimer(); else startTimer(); });
  $("dots").addEventListener("click", function (e) {
    var b = e.target.closest("[data-k]"); if (!b) return;
    jumpTo(b.dataset.k);
  });
  document.addEventListener("keydown", function (e) {
    if ($("stage").hidden) return;
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName) && e.key !== "Escape") return;   // typing a name in the draw
    if (e.key === "Escape") { e.preventDefault(); closeStage(); }
    else if (e.key === "ArrowRight" || e.key === "PageDown") { e.preventDefault(); show(P.idx + 1); }
    else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); show(P.idx - 1); }
    else if (e.key === " " && e.target.tagName !== "BUTTON") { e.preventDefault(); if (P.timerId) stopTimer(); else startTimer(); }
    else if (e.key === "r" || e.key === "R") { resetTimer(); }
    else if (e.key === "o" || e.key === "O" || e.key === "Home") { e.preventDefault(); show(0); }
    else if (e.key === "t" || e.key === "T") { jumpTo("t1"); }
    else if (e.key === "p" || e.key === "P") { jumpTo("p1"); }
    else if (e.key === "d" || e.key === "D" || e.key === "End") { e.preventDefault(); jumpTo("d"); }
    else if (/^[1-9]$/.test(e.key)) { jumpTo("p" + e.key); }
  });
  // swipe on touch screens
  var touchX = null;
  $("stage").addEventListener("touchstart", function (e) { touchX = e.touches[0].clientX; }, { passive: true });
  $("stage").addEventListener("touchend", function (e) {
    if (touchX == null) return; var dx = e.changedTouches[0].clientX - touchX; touchX = null;
    if (Math.abs(dx) > 50) show(P.idx + (dx < 0 ? 1 : -1));
  });

  /* ---------- load ---------- */
  function getJSON(p) { return fetch(p, { cache: "no-cache" }).then(function (r) { if (!r.ok) throw new Error(p + ": HTTP " + r.status); return r.json(); }); }
  Promise.all([getJSON("data/site.json"), getJSON("data/sessions.json"), getJSON("data/papers.json"),
               getJSON("data/votes.json").catch(function () { return { papers: {} }; }),
               getJSON("data/members.json").catch(function () { return { members: [] }; })])
    .then(function (r) {
      S.members = (r[4] && r[4].members) || [];
      S.site = r[0];
      S.sessions = r[1].slice().sort(function (a, b) { return a.date.localeCompare(b.date); });
      S.papers = r[2]; S.papers.forEach(function (p) { S.byId[p.id] = p; });
      S.votes = (r[3] && r[3].papers) || {};
      var up = upcoming();
      $("session-select").innerHTML = S.sessions.slice().reverse().map(function (s) {
        return '<option value="' + esc(s.date) + '">' + esc(fmt(s.date, { weekday: "short", day: "numeric", month: "short", year: "numeric" }))
          + (s === up ? " · next" : startOf(s) < new Date() ? "" : " · upcoming") + "</option>";
      }).join("");
      pick(); render();
      loadDecks().then(function () {
        render();
        var pm2 = /[?&]present(?:=(\d+))?/.exec(location.search);
        if (pm2 && S.current) { openStage(0); if (pm2[1]) show(+pm2[1]); }
      });
      setInterval(function () { if (S.current) $("hero-status").textContent = status(S.current) + (S.current.pilot ? " · pilot selection" : ""); }, 30000);
    })
    .catch(function (err) {
      $("hero-status").textContent = "Could not load the programme";
      $("papers").innerHTML = '<li class="empty">' + esc(err.message) + (location.protocol === "file:" ? " — run python3 -m http.server and open http://localhost:8000/jc.html" : "") + "</li>";
    });
})();
