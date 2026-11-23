/* Shared by the main site (app.js) and the session board (jc.js):
   - programme(site, session): the agenda of one session, with one slot per talk;
   - tally(sessions, members, today): how many times each participant has presented;
   - drawPool(...) / drawOne(pool): the fair draw of next week's speaker. */
(function () {
  "use strict";

  // A session lists its talks in "talks": [{speaker, title, minutes}].
  // Older entries with a single "speaker" / "talkTitle" still work.
  function talksOf(s) {
    if (Array.isArray(s.talks)) return s.talks.filter(function (t) { return t && t.speaker; });
    return s.speaker ? [{ speaker: s.speaker, title: s.talkTitle || "", minutes: 0 }] : [];
  }
  function kindOf(a) {
    var t = a.title || "";
    return /talk/i.test(t) ? "talk" : /paper/i.test(t) ? "papers" : /draw/i.test(t) ? "draw" : "other";
  }

  // The talk block of the agenda is split into one slot per talk; the time left in the block
  // after the talks' own minutes is shared out as questions.
  function programme(site, s) {
    var out = [];
    (site.agenda || []).forEach(function (a) {
      var k = kindOf(a), block = a.minutes || 0;
      if (k !== "talk") { out.push({ kind: k, title: a.title, minutes: block, detail: a.detail || "" }); return; }
      var ts = talksOf(s);
      if (!ts.length) { out.push({ kind: "talk", title: "Talk", minutes: block, talk: null, detail: a.detail || "" }); return; }
      var own = ts.reduce(function (n, t) { return n + (t.minutes || 0); }, 0);
      var spare = Math.max(0, block - own), used = 0;
      ts.forEach(function (t, i) {
        var slot = t.minutes ? t.minutes + Math.floor(spare / ts.length) : Math.floor(block / ts.length);
        if (i === ts.length - 1) slot = Math.max(slot, block - used);
        used += slot;
        out.push({ kind: "talk", title: ts.length > 1 ? "Talk " + (i + 1) : "Talk", minutes: slot, talkMinutes: t.minutes || 0, talk: t });
      });
    });
    return out;
  }
  function totalMinutes(prog) { return prog.reduce(function (n, x) { return n + (x.minutes || 0); }, 0); }

  function norm(x) { return String(x || "").toLowerCase().replace(/\s+/g, " ").trim(); }

  // One row per person: every participant in members.json, plus anyone else who gave a talk.
  // A talk on a date before `today` counts as given; today or later counts as scheduled.
  function tally(sessions, members, today) {
    var rows = [], byName = {}, bySurname = {};
    (members || []).forEach(function (m) {
      var r = { name: m.name, surname: m.surname || "", inspire: m.inspire || "", member: true, given: 0, planned: 0, talks: {} };
      rows.push(r); byName[norm(m.name)] = r;
      var sn = norm(m.surname);
      if (sn) bySurname[sn] = bySurname[sn] ? null : r;   // null marks an ambiguous surname
    });
    function find(name) {
      var n = norm(name);
      if (byName[n]) return byName[n];
      var last = n.split(" ").pop();
      if (bySurname[n]) return bySurname[n];
      if (bySurname[last]) return bySurname[last];
      var r = { name: String(name).trim(), surname: String(name).trim().split(" ").pop(), member: false, given: 0, planned: 0, talks: {} };
      rows.push(r); byName[n] = r;
      return r;
    }
    var dates = [];
    (sessions || []).slice().sort(function (a, b) { return a.date.localeCompare(b.date); }).forEach(function (s) {
      var ts = talksOf(s);
      if (!ts.length) return;
      dates.push(s.date);
      ts.forEach(function (t) {
        var r = find(t.speaker), done = s.date < today;
        r.talks[s.date] = { title: t.title || "", done: done };
        if (done) r.given += 1; else r.planned += 1;
      });
    });
    rows.forEach(function (r) { r.total = r.given + r.planned; });
    rows.sort(function (a, b) { return b.total - a.total || a.surname.localeCompare(b.surname); });
    return { rows: rows, dates: dates };
  }

  // Fair draw: participants not already scheduled, among those who have presented least.
  function drawPool(sessions, members, today) {
    var t = tally(sessions, members, today);
    var free = t.rows.filter(function (r) { return r.member && !r.planned; });
    if (!free.length) return { pool: [], min: 0, free: 0 };
    var min = Math.min.apply(null, free.map(function (r) { return r.total; }));
    return { pool: free.filter(function (r) { return r.total === min; }), min: min, free: free.length };
  }
  function drawOne(pool) {
    if (!pool.length) return null;
    var k;
    try { var a = new Uint32Array(1); crypto.getRandomValues(a); k = a[0] % pool.length; }
    catch (e) { k = Math.floor(Math.random() * pool.length); }
    return pool[k];
  }

  window.JCAgenda = { talksOf: talksOf, kindOf: kindOf, programme: programme, totalMinutes: totalMinutes, tally: tally, drawPool: drawPool, drawOne: drawOne };
})();
