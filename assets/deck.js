/* Paper decks: renders explanatory slides (text with $math$, display formulas, animated figures)
   from data/decks/<arXiv id>.json. Used by the presentation stage in jc.html.
   Figure types: diagram, curves, histogram, events, hierarchy, waves, potential, flow, spectrum.
   All figures are schematic illustrations; the deck JSON says so on each slide that uses one. */
(function () {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";
  var raf = [];          // running animation frames of the current slide
  function stopAll() { raf.forEach(function (s) { s.stop = true; }); raf = []; }
  function loop(fn) { var st = { stop: false }; raf.push(st); (function f(t) { if (st.stop) return; fn(t); requestAnimationFrame(f); })(performance.now()); return st; }
  var reduce = false;
  try { reduce = matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function el(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (parent) parent.appendChild(n);
    return n;
  }
  function text(parent, x, y, s, attrs) {
    var t = el("text", Object.assign({ x: x, y: y }, attrs || {}), parent);
    String(s).split("\n").forEach(function (line, i) {
      var sp = el("tspan", { x: x, dy: i ? "1.2em" : "0" }, t); sp.textContent = line;
    });
    return t;
  }
  function svgRoot(host, w, h, label) {
    var s = el("svg", { viewBox: "0 0 " + w + " " + h, role: "img", "aria-label": label || "Figure", class: "fig-svg" });
    host.appendChild(s);
    return s;
  }
  function canvas(host, w, h, label) {
    var c = document.createElement("canvas");
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = w * dpr; c.height = h * dpr; c.className = "fig-canvas";
    c.setAttribute("role", "img"); c.setAttribute("aria-label", label || "Animated figure");
    host.appendChild(c);
    var ctx = c.getContext("2d"); ctx.scale(dpr, dpr);
    return ctx;
  }
  function areaColor(host) { return getComputedStyle(host).getPropertyValue("--area").trim() || "#8fb8e0"; }
  function rnd(seed) { var s = seed || 1; return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

  /* ---------- axes for curves / histogram ---------- */
  function scale(range, px, log) {
    var a = log ? Math.log10(range[0]) : range[0], b = log ? Math.log10(range[1]) : range[1];
    return function (v) { var x = log ? Math.log10(v) : v; return px[0] + (x - a) / (b - a) * (px[1] - px[0]); };
  }
  function ticks(range, log) {
    if (log) { var out = []; for (var e = Math.ceil(Math.log10(range[0])); e <= Math.floor(Math.log10(range[1])); e++) out.push(Math.pow(10, e)); return out; }
    var span = range[1] - range[0], step = Math.pow(10, Math.floor(Math.log10(span / 4)));
    if (span / step > 8) step *= 2; if (span / step > 8) step *= 2.5;
    var t = [], v = Math.ceil(range[0] / step) * step; for (; v <= range[1] + 1e-9; v += step) t.push(+v.toPrecision(6));
    return t;
  }
  function fmtTick(v, log) {
    if (log) { var e = Math.round(Math.log10(v)); return e === 0 ? "1" : e === 1 ? "10" : "10" + String(e).split("").map(function (c) { return "⁰¹²³⁴⁵⁶⁷⁸⁹"["0123456789".indexOf(c)] || (c === "-" ? "⁻" : c); }).join(""); }
    return Math.abs(v) >= 1000 || (Math.abs(v) < 0.01 && v !== 0) ? v.toExponential(0) : String(v);
  }
  function axes(s, f, W, H, m) {
    var g = el("g", { class: "fig-axes" }, s);
    el("line", { x1: m.l, y1: H - m.b, x2: W - m.r, y2: H - m.b }, g);
    el("line", { x1: m.l, y1: m.t, x2: m.l, y2: H - m.b }, g);
    ticks(f.xrange, f.xlog).forEach(function (v) { var x = m.sx(v); el("line", { x1: x, y1: H - m.b, x2: x, y2: H - m.b + 4 }, g); text(g, x, H - m.b + 16, fmtTick(v, f.xlog), { "text-anchor": "middle", class: "fig-tick" }); });
    ticks(f.yrange, f.ylog).forEach(function (v) { var y = m.sy(v); el("line", { x1: m.l - 4, y1: y, x2: m.l, y2: y }, g); text(g, m.l - 7, y + 4, fmtTick(v, f.ylog), { "text-anchor": "end", class: "fig-tick" }); });
    if (f.xlabel) text(g, (m.l + W - m.r) / 2, H - 4, f.xlabel, { "text-anchor": "middle", class: "fig-label" });
    if (f.ylabel) { var t = text(g, 0, 0, f.ylabel, { "text-anchor": "middle", class: "fig-label" }); t.setAttribute("transform", "translate(12," + (m.t + H - m.b) / 2 + ") rotate(-90)"); }
  }

  var FIG = {};

  FIG.curves = function (host, f) {
    var W = 440, H = 280, m = { l: 52, r: 14, t: 14, b: 40 };
    var s = svgRoot(host, W, H, f.caption);
    m.sx = scale(f.xrange, [m.l, W - m.r], f.xlog); m.sy = scale(f.yrange, [H - m.b, m.t], f.ylog);
    axes(s, f, W, H, m);
    (f.curves || []).forEach(function (c, i) {
      var pts = c.points.map(function (p) { return [m.sx(p[0]), m.sy(p[1])]; });
      var d = "M" + pts.map(function (p) { return p[0].toFixed(1) + "," + p[1].toFixed(1); }).join("L");
      if (c.fill) {
        var edge = c.fill === "above" ? m.t : H - m.b;
        el("path", { d: d + "L" + pts[pts.length - 1][0] + "," + edge + "L" + pts[0][0] + "," + edge + "Z", class: "fig-fill c" + (i % 4), style: "animation-delay:" + (0.6 + i * 0.5) + "s" }, s);
      }
      el("path", { d: d, class: "fig-curve c" + (i % 4) + (c.dashed ? " dashed" : ""), pathLength: 1, style: "animation-delay:" + (i * 0.5) + "s" }, s);
      if (c.label) {
        var lp = c.labelAt != null ? pts[Math.min(pts.length - 1, c.labelAt)] : pts[Math.floor(pts.length * 0.6)];
        var right = lp[0] > W - 150, ly = c.labelY != null ? m.sy(c.labelY) : lp[1] - 8;
        text(s, right ? lp[0] - 4 : lp[0] + 4, Math.max(m.t + 12, ly), c.label, { "text-anchor": right ? "end" : "start", class: "fig-clabel c" + (i % 4), style: "animation-delay:" + (0.4 + i * 0.5) + "s" });
      }
    });
    (f.markers || []).forEach(function (mk, i) {
      var x = m.sx(mk.x), y = m.sy(mk.y);
      el("circle", { cx: x, cy: y, r: 5, class: "fig-marker", style: "animation-delay:" + (1.2 + i * 0.3) + "s" }, s);
      if (mk.label) text(s, x + 8, y - 8, mk.label, { class: "fig-clabel", style: "animation-delay:" + (1.2 + i * 0.3) + "s" });
    });
  };

  FIG.histogram = function (host, f) {
    var W = 440, H = 280, m = { l: 52, r: 14, t: 14, b: 40 };
    var s = svgRoot(host, W, H, f.caption);
    var n = f.background.length, max = 0;
    f.background.forEach(function (b, i) { max = Math.max(max, b + ((f.signal || [])[i] || 0), (f.data || [])[i] || 0); });
    f.xrange = f.xrange || [0, n]; f.yrange = f.yrange || [0, max * 1.15];
    m.sx = scale(f.xrange, [m.l, W - m.r]); m.sy = scale(f.yrange, [H - m.b, m.t]);
    axes(s, f, W, H, m);
    var bw = (W - m.r - m.l) / n;
    f.background.forEach(function (b, i) {
      var sig = (f.signal || [])[i] || 0, x = m.l + i * bw + 1;
      el("rect", { x: x, y: m.sy(b), width: bw - 2, height: (H - m.b) - m.sy(b), class: "fig-bar bg", style: "animation-delay:" + (i * 0.04) + "s" }, s);
      if (sig) el("rect", { x: x, y: m.sy(b + sig), width: bw - 2, height: m.sy(b) - m.sy(b + sig), class: "fig-bar sig", style: "animation-delay:" + (0.9 + i * 0.04) + "s" }, s);
      if (f.data) el("circle", { cx: x + bw / 2 - 1, cy: m.sy(f.data[i]), r: 3, class: "fig-marker", style: "animation-delay:" + (1.6 + i * 0.03) + "s" }, s);
    });
    var lg = el("g", { class: "fig-legend" }, s);
    [["bg", f.bgLabel || "Background"], ["sig", f.sigLabel || "Signal"]].forEach(function (L, k) {
      el("rect", { x: W - m.r - 130, y: m.t + 4 + k * 18, width: 12, height: 12, class: "fig-bar " + L[0] + " static" }, lg);
      text(lg, W - m.r - 112, m.t + 14 + k * 18, L[1], { class: "fig-tick" });
    });
  };

  FIG.diagram = function (host, f) {
    var W = f.width || 440, H = f.height || 280;
    var s = svgRoot(host, W, H, f.caption);
    var defs = el("defs", {}, s), mk = el("marker", { id: "arr" + Math.random().toString(36).slice(2), viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" }, defs);
    el("path", { d: "M0,0 L10,5 L0,10 z", class: "fig-arrowhead" }, mk);
    var pos = {}, order = {};
    (f.nodes || []).forEach(function (n, i) { pos[n.id] = n; order[n.id] = n.step != null ? n.step : i; });
    (f.edges || []).forEach(function (e) {
      var a = pos[e.from], b = pos[e.to]; if (!a || !b) return;
      var x1 = a.x / 100 * W, y1 = a.y / 100 * H, x2 = b.x / 100 * W, y2 = b.y / 100 * H;
      var dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, pad = 34;
      var step = Math.max(order[e.from], order[e.to]);
      el("line", { x1: x1 + dx / L * pad, y1: y1 + dy / L * pad * 0.6, x2: x2 - dx / L * pad, y2: y2 - dy / L * pad * 0.6, class: "fig-edge" + (e.dashed ? " dashed" : ""), "marker-end": "url(#" + mk.id + ")", pathLength: 1, style: "animation-delay:" + (step * 0.55 + 0.2) + "s" }, s);
      if (e.label) text(s, (x1 + x2) / 2, (y1 + y2) / 2 - 6, e.label, { "text-anchor": "middle", class: "fig-elabel", style: "animation-delay:" + (step * 0.55 + 0.4) + "s" });
    });
    (f.nodes || []).forEach(function (n) {
      var g = el("g", { class: "fig-node" + (n.accent ? " accent" : ""), style: "animation-delay:" + (order[n.id] * 0.55) + "s" }, s);
      var lines = String(n.label).split("\n"), w = Math.max(70, Math.max.apply(null, lines.map(function (l) { return l.length; })) * 7.2 + 20), h = 18 * lines.length + 14;
      var x = n.x / 100 * W, y = n.y / 100 * H;
      el("rect", { x: x - w / 2, y: y - h / 2, width: w, height: h, rx: 10 }, g);
      text(g, x, y - h / 2 + 22, n.label, { "text-anchor": "middle" });
    });
  };

  FIG.hierarchy = function (host, f) {
    var W = 440, H = 290, s = svgRoot(host, W, H, f.caption);
    var sets = f.sets || [], n = sets.length;
    sets.forEach(function (st, i) {
      var k = i / Math.max(1, n), rx = 205 - k * 150, ry = 105 - k * 62, cx = 220 + k * 60, cy = 112 + k * 18;
      el("ellipse", { cx: cx, cy: cy, rx: rx, ry: ry, class: "fig-set s" + i, style: "animation-delay:" + (i * 0.6) + "s" }, s);
      text(s, cx - rx + 16 + (i ? 6 : 0), cy - ry + 26 + i * 4, st.label + (st.note ? "  " + st.note : ""), { class: "fig-setlabel", style: "animation-delay:" + (i * 0.6 + 0.2) + "s" });
    });
    if (f.axis) {
      var y = 258, x0 = 30, x1 = 410, ax = f.axis;
      el("line", { x1: x0, y1: y, x2: x1, y2: y, class: "fig-axisline" }, s);
      text(s, x0, y + 24, ax.label || "", { class: "fig-tick" });
      (ax.marks || []).forEach(function (mk, i) {
        var x = x0 + (mk.at - ax.range[0]) / (ax.range[1] - ax.range[0]) * (x1 - x0);
        el("line", { x1: x, y1: y - 7, x2: x, y2: y + 7, class: "fig-markline s" + (i + 1) }, s);
        text(s, x, y - 12, mk.label, { "text-anchor": "middle", class: "fig-tick" });
      });
      var dot = el("circle", { cx: x0, cy: y, r: 7, class: "fig-sweep" }, s);
      var lab = text(s, x0, y + 24, "", { "text-anchor": "middle", class: "fig-clabel", visibility: "hidden" });
      if (!reduce) loop(function (t) {
        var u = (t / 6000) % 1, v = ax.range[0] + u * (ax.range[1] - ax.range[0]);
        var x = x0 + u * (x1 - x0); dot.setAttribute("cx", x);
        var level = 0; (ax.marks || []).forEach(function (mk, i) { if (v > mk.at) level = i + 1; });
        sets.forEach(function (_, i) { var e = s.querySelector(".fig-set.s" + i); if (e) e.classList.toggle("lit", i < level || (i === 0 && level > 0)); });
      });
      void lab;
    }
  };

  FIG.events = function (host, f) {
    var W = 460, H = 250, ctx = canvas(host, W, H, f.caption), col = areaColor(host), R = rnd(7);
    var panels = f.panels || [{ label: "QCD jets", mode: "jets" }, { label: "Instanton-like", mode: "isotropic" }];
    var tracks = panels.map(function (p) {
      var out = [], n = p.n || (p.mode === "jets" ? 22 : 34);
      for (var i = 0; i < n; i++) {
        var ang = p.mode === "jets" ? (i % 2 ? 0.35 : Math.PI + 0.35) + (R() - 0.5) * 0.5 : R() * Math.PI * 2;
        out.push({ a: ang, len: 0.55 + R() * 0.4, curv: (R() - 0.5) * 0.9 });
      }
      return out;
    });
    loop(function (t) {
      ctx.clearRect(0, 0, W, H);
      var u = reduce ? 1 : Math.min(1, ((t / 2600) % 1.35));
      panels.forEach(function (p, k) {
        var cx = W / 4 + k * W / 2, cy = H / 2 + 8, r = 92;
        ctx.strokeStyle = "rgba(160,170,190,.35)"; ctx.lineWidth = 1;
        [r, r * 0.62, r * 0.25].forEach(function (rr) { ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.stroke(); });
        ctx.strokeStyle = k ? col : "rgba(220,226,235,.85)"; ctx.lineWidth = 1.6;
        tracks[k].forEach(function (tr) {
          var L = r * tr.len * u, ex = cx + Math.cos(tr.a) * L, ey = cy + Math.sin(tr.a) * L;
          var mx = cx + Math.cos(tr.a + tr.curv * 0.5) * L * 0.5, my = cy + Math.sin(tr.a + tr.curv * 0.5) * L * 0.5;
          ctx.beginPath(); ctx.moveTo(cx, cy); ctx.quadraticCurveTo(mx, my, ex, ey); ctx.stroke();
        });
        ctx.fillStyle = "rgba(230,235,242,.9)"; ctx.font = "600 13px Inter, sans-serif"; ctx.textAlign = "center";
        ctx.fillText(p.label, cx, 18);
      });
    });
  };

  FIG.waves = function (host, f) {
    var W = 460, H = 260, ctx = canvas(host, W, H, f.caption), col = areaColor(host), R = rnd(11);
    var gx = 92, gy = 52, modes = [];
    for (var i = 0; i < 14; i++) { var a = R() * Math.PI * 2, k = 0.18 + R() * 0.16; modes.push({ kx: Math.cos(a) * k, ky: Math.sin(a) * k, w: 0.4 + R() * 0.8, p: R() * 6.28 }); }
    var img = ctx.createImageData(gx, gy), off = document.createElement("canvas"); off.width = gx; off.height = gy;
    var octx = off.getContext("2d");
    var rgb = (function (c) { var m = /#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(c); return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [143, 184, 224]; })(col);
    loop(function (t) {
      var tt = reduce ? 0 : t / 1000;
      for (var y = 0; y < gy; y++) for (var x = 0; x < gx; x++) {
        var re = 0, im = 0;
        for (var j = 0; j < modes.length; j++) { var ph = modes[j].kx * x * 3 + modes[j].ky * y * 3 - modes[j].w * tt + modes[j].p; re += Math.cos(ph); im += Math.sin(ph); }
        var I = (re * re + im * im) / modes.length / 2.2, o = (y * gx + x) * 4, v = Math.min(1, I);
        img.data[o] = rgb[0] * v; img.data[o + 1] = rgb[1] * v; img.data[o + 2] = rgb[2] * v; img.data[o + 3] = 40 + 200 * v;
      }
      octx.putImageData(img, 0, 0);
      ctx.clearRect(0, 0, W, H); ctx.imageSmoothingEnabled = true; ctx.drawImage(off, 0, 0, W, H);
      if (f.mode === "diffraction") {
        var front = ((tt * 60) % (W + 120)) - 60;
        ctx.strokeStyle = "rgba(240,244,250,.85)"; ctx.lineWidth = 2;
        for (var w = 0; w < 4; w++) {
          var X = front - w * 26; if (X < 0 || X > W) continue;
          ctx.beginPath();
          for (var yy = 0; yy <= H; yy += 4) {
            var gxI = Math.max(0, Math.min(gx - 1, Math.floor(X / W * gx))), gyI = Math.max(0, Math.min(gy - 1, Math.floor(yy / H * gy)));
            var bump = (img.data[(gyI * gx + gxI) * 4 + 3] - 120) / 30;
            if (yy === 0) ctx.moveTo(X + bump, yy); else ctx.lineTo(X + bump, yy);
          }
          ctx.stroke();
        }
      }
      if (f.label) { ctx.fillStyle = "rgba(240,244,250,.92)"; ctx.font = "600 13px Inter, sans-serif"; ctx.fillText(f.label, 12, H - 12); }
    });
  };

  FIG.potential = function (host, f) {
    var W = 440, H = 270, s = svgRoot(host, W, H, f.caption), x0 = 30, x1 = 410, base = 196, amp = 120;
    var px = function (n) { return x0 + (n + 1.5) / 3 * (x1 - x0); };     // N_CS from -1.5 to 1.5
    var py = function (n) { return base - amp * (1 - Math.cos(2 * Math.PI * n)) / 2; };
    var d = ""; for (var n = -1.5; n <= 1.5001; n += 0.02) d += (d ? "L" : "M") + px(n).toFixed(1) + "," + py(n).toFixed(1);
    el("path", { d: d, class: "fig-curve c0", pathLength: 1 }, s);
    [-1, 0, 1].forEach(function (k) { text(s, px(k), base + 22, "N_CS = " + k, { "text-anchor": "middle", class: "fig-tick" }); });
    text(s, px(0.5), py(0.5) - 10, f.barrierLabel || "sphaleron barrier", { "text-anchor": "middle", class: "fig-tick" });
    el("line", { x1: px(0), y1: base, x2: px(1), y2: base, class: "fig-edge dashed static", pathLength: 1 }, s);
    text(s, px(0.5), base + 48, f.tunnelLabel || "- - -  instanton: tunnelling, ΔN_CS = 1", { "text-anchor": "middle", class: "fig-clabel" });
    var ball = el("circle", { cx: px(0), cy: base - 8, r: 8, class: "fig-sweep" }, s);
    if (!reduce) loop(function (t) {
      var u = (t / 4200) % 1, n, op = 1;
      if (u < 0.45) n = 0.12 * Math.sin(u / 0.45 * Math.PI * 4);              // oscillate in the well
      else if (u < 0.75) { n = (u - 0.45) / 0.3; op = 0.45; }                    // tunnel under the barrier
      else n = 1 + 0.12 * Math.sin((u - 0.75) / 0.25 * Math.PI * 2);
      ball.setAttribute("cx", px(n)); ball.setAttribute("cy", (op < 1 ? base : py(n)) - 8); ball.style.opacity = op;
    });
  };

  FIG.flow = function (host, f) {
    var W = 440, H = 280, s = svgRoot(host, W, H, f.caption);
    var uv = [70, 50], ir = [370, 230];
    var paths = [[uv, [150, 30], [300, 120], ir], [uv, [110, 160], [260, 250], ir], [uv, [200, 70], [250, 200], ir]];
    paths.forEach(function (p, i) {
      var d = "M" + p[0] + " C" + p[1] + " " + p[2] + " " + p[3];
      var path = el("path", { d: d, id: "fl" + i + Math.random().toString(36).slice(2), class: "fig-curve c" + (i % 3), pathLength: 1, style: "animation-delay:" + i * 0.4 + "s" }, s);
      if (!reduce) { var c = el("circle", { r: 5, class: "fig-sweep" }, s); var am = el("animateMotion", { dur: (3 + i) + "s", repeatCount: "indefinite", begin: (i * 0.7) + "s" }, c); el("mpath", { href: "#" + path.id }, am); }
    });
    [[uv, f.uvLabel || "UV CFT", "a_UV"], [ir, f.irLabel || "IR CFT", "a_IR"]].forEach(function (q) {
      el("circle", { cx: q[0][0], cy: q[0][1], r: 10, class: "fig-fixed" }, s);
      text(s, q[0][0], q[0][1] - 18, q[1], { "text-anchor": "middle", class: "fig-clabel static" });
      text(s, q[0][0], q[0][1] + 28, q[2], { "text-anchor": "middle", class: "fig-tick" });
    });
    text(s, 230, 268, f.note || "ã decreases monotonically along every flow", { "text-anchor": "middle", class: "fig-tick" });
  };

  FIG.spectrum = function (host, f) {
    var W = 440, H = 220, m = { l: 30, r: 20 }, s = svgRoot(host, W, H, f.caption), y = 150;
    var sx = scale(f.xrange, [m.l, W - m.r]);
    var grad = el("linearGradient", { id: "sp" + Math.random().toString(36).slice(2) }, el("defs", {}, s));
    [["0%", "#5b3fd1"], ["20%", "#3b6fe0"], ["40%", "#2fae8a"], ["60%", "#d8c43a"], ["80%", "#e47b2c"], ["100%", "#c8352f"]].forEach(function (c) { el("stop", { offset: c[0], "stop-color": c[1], "stop-opacity": 0.35 }, grad); });
    el("rect", { x: sx(380), y: y - 70, width: sx(750) - sx(380), height: 70, fill: "url(#" + grad.id + ")", rx: 4 }, s);
    el("line", { x1: m.l, y1: y, x2: W - m.r, y2: y, class: "fig-axisline" }, s);
    ticks(f.xrange).forEach(function (v) { el("line", { x1: sx(v), y1: y, x2: sx(v), y2: y + 5, class: "fig-axisline" }, s); text(s, sx(v), y + 18, v, { "text-anchor": "middle", class: "fig-tick" }); });
    text(s, (m.l + W - m.r) / 2, y + 40, f.xlabel || "wavelength [nm]", { "text-anchor": "middle", class: "fig-label" });
    var fx = sx(f.fixed.x);
    el("line", { x1: fx, y1: y - 86, x2: fx, y2: y, class: "fig-line-fixed" }, s);
    text(s, fx, y - 92, f.fixed.label, { "text-anchor": "middle", class: "fig-clabel static" });
    var mv = el("line", { x1: sx(f.moving.from), y1: y - 60, x2: sx(f.moving.from), y2: y, class: "fig-line-moving" }, s);
    var ml = text(s, sx(f.moving.from), y - 66, f.moving.label, { "text-anchor": "middle", class: "fig-tick" });
    if (!reduce) loop(function (t) {
      var u = (Math.sin(t / 1600) + 1) / 2, x = sx(f.moving.from + u * (f.moving.to - f.moving.from));
      mv.setAttribute("x1", x); mv.setAttribute("x2", x); ml.querySelectorAll("tspan").forEach(function (sp) { sp.setAttribute("x", x); }); ml.setAttribute("x", x);
    });
  };

  /* ---------- slide rendering ---------- */
  function math(node) {
    if (window.renderMathInElement) {
      try { window.renderMathInElement(node, { delimiters: [{ left: "$$", right: "$$", display: true }, { left: "$", right: "$", display: false }], throwOnError: false }); } catch (e) {}
    }
  }
  function render(host, slide, paper) {
    stopAll();
    host.innerHTML = "";
    host.classList.add("deck");
    var hasFig = !!slide.figure;
    host.classList.toggle("has-fig", hasFig);
    var main = document.createElement("div"); main.className = "deck-main";
    main.innerHTML = (slide.kicker ? '<span class="area"><span class="dot"></span>' + esc(slide.kicker) + "</span>" : "")
      + "<h2>" + esc(slide.title) + "</h2>"
      + (slide.text || []).map(function (p) { return '<p class="deck-text">' + esc(p) + "</p>"; }).join("")
      + (slide.math || []).map(function () { return '<div class="deck-math"></div>'; }).join("")
      + (slide.bullets ? '<ul class="deck-bullets">' + slide.bullets.map(function (b, i) { return '<li style="animation-delay:' + (0.25 * i + 0.2) + 's">' + esc(b) + "</li>"; }).join("") + "</ul>" : "");
    host.appendChild(main);
    var mathEls = main.querySelectorAll(".deck-math");
    (slide.math || []).forEach(function (m, i) {
      var box = mathEls[i]; box.style.animationDelay = (0.3 + i * 0.35) + "s";
      if (window.katex) { try { window.katex.render(m, box, { displayMode: true, throwOnError: false }); } catch (e) { box.textContent = m; } }
      else box.textContent = m;
    });
    math(main);
    if (hasFig) {
      var fig = document.createElement("figure"); fig.className = "deck-fig";
      host.appendChild(fig);
      var kind = FIG[slide.figure.type];
      if (kind) { try { kind(fig, slide.figure); } catch (e) { fig.textContent = "Figure unavailable"; } }
      var cap = document.createElement("figcaption");
      cap.innerHTML = esc(slide.figure.caption || "") + (slide.figure.schematic === false ? "" : ' <span class="schem">schematic</span>');
      fig.appendChild(cap); math(cap);
    }
    void paper;
  }
  window.JCDeck = { render: render, stop: stopAll, types: Object.keys(FIG) };
})();
