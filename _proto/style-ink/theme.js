/*
 * Тема оформления «КВЕСТ»: «тушь» (гравюра / лубок тушью).
 * Реализует API темы из kvest-contract: drawScene, drawHero, drawNpc, drawThought, drawIcon, drawCursor, drawUI.
 * Файл самодостаточен (копируется в kvest/js/themes/ink.js).
 *
 * Приёмы: бумага цвета слоновой кости (процедурный шум + волокна, offscreen), контур кистью переменной толщины,
 * штриховка с плотностью по функции (параллельная — полутон, перекрёстная — тень), сплошная тушь с «крапом»
 * как в оттиске, два акцента — киноварь и охра — с лёгким несовмещением печати, рамка-клише.
 * «Кипение» штриха: каждый статичный элемент кэшируется в 3 вариантах дрожания, варианты сменяются 8 раз в секунду.
 *
 * opts.pass: 'back' (фон, слои 0..2, объекты) | 'front' (слой 3) | 'all' (по умолчанию).
 * opts.npcSeparate: true — объекты kind:'npc' не рисуются в drawScene (их рисует drawNpc).
 * drawThought(ctx, x, y, icons, t): x,y — точка у головы; t — секунды с появления мысли (или общее время).
 * Рамка-клише рисуется в drawUI (поверх всего).
 */
(function () {
  'use strict';
  var W = 960, H = 540, TAU = Math.PI * 2;
  var INK = '#1e1915', IVORY = '#efe5cb', VERM = '#c63d26', OCHRE = '#cf9a32';

  function rng(seed) {
    var a = (seed * 2654435761) >>> 0 || 1;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function poly(g, p) { g.beginPath(); g.moveTo(p[0][0], p[0][1]); for (var i = 1; i < p.length; i++) g.lineTo(p[i][0], p[i][1]); g.closePath(); }
  function rectP(x, y, w, h) { return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]; }
  function ell(cx, cy, rx, ry, n, a0, a1) {
    n = n || 26; a0 = a0 || 0; a1 = a1 == null ? TAU : a1;
    var p = [], full = Math.abs(a1 - a0 - TAU) < 1e-6, m = full ? n : n + 1;
    for (var i = 0; i < m; i++) { var a = a0 + (a1 - a0) * i / n; p.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
    return p;
  }
  function blob(cx, cy, r, seed, lobes, amp) {
    var R = rng(seed), p = [], ph = R() * TAU, ph2 = R() * TAU, n = 40;
    for (var i = 0; i < n; i++) {
      var a = i / n * TAU, k = 1 + amp * Math.sin(lobes * a + ph) * 0.6 + amp * 0.4 * Math.sin((lobes + 2) * a + ph2);
      p.push([cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * k * 0.92]);
    }
    return p;
  }
  function scallop(cx, cy, r, n, depth) { // «кудрявая» крона/облако лубка
    var p = [];
    for (var i = 0; i < n; i++) {
      var a0 = i / n * TAU, a1 = (i + 1) / n * TAU;
      for (var k = 0; k <= 5; k++) { var f = k / 5, a = a0 + (a1 - a0) * f, rr = r * (1 + depth * Math.sin(f * Math.PI)); p.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.9]); }
    }
    return p;
  }
  function rotP(p, cx, cy, a) { var c = Math.cos(a), s = Math.sin(a); return p.map(function (q) { var x = q[0] - cx, y = q[1] - cy; return [cx + x * c - y * s, cy + x * s + y * c]; }); }
  function bbox(p) {
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (var i = 0; i < p.length; i++) { var q = p[i]; if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1]; }
    return [x0, y0, x1 - x0, y1 - y0];
  }

  // ---------- вариант «кипения» ----------
  var J = { v: 0 };
  function subdiv(pts, step, closed, amp, seed) {
    var R = rng(seed + J.v * 7919), out = [], n = pts.length, m = closed ? n : n - 1;
    for (var i = 0; i < m; i++) {
      var a = pts[i], b = pts[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, k = Math.max(1, Math.ceil(L / step));
      for (var j = 0; j < k; j++) { var f = j / k; out.push([a[0] + dx * f + (R() - 0.5) * amp, a[1] + dy * f + (R() - 0.5) * amp]); }
    }
    if (!closed) out.push([pts[n - 1][0] + (R() - 0.5) * amp, pts[n - 1][1] + (R() - 0.5) * amp]);
    return out;
  }
  function jit(pts, amp, seed) { var R = rng(seed + J.v * 3571); return pts.map(function (q) { return [q[0] + (R() - 0.5) * amp, q[1] + (R() - 0.5) * amp]; }); }

  // ---------- бумага ----------
  var PAPER = null, SPECK = null, PS = 1.5;
  function paper() {
    if (PAPER) return PAPER;
    var w = Math.round(W * PS), h = Math.round(H * PS), c = document.createElement('canvas'); c.width = w; c.height = h;
    var g = c.getContext('2d'), id = g.createImageData(w, h), R = rng(17), base = [239, 229, 203];
    var gs = 18, grid = []; for (var i = 0; i < (gs + 1) * (gs + 1); i++) grid.push(R());
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var gx = x / w * gs, gy = y / h * gs, x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0;
      var v0 = grid[y0 * (gs + 1) + x0] * (1 - fx) + grid[y0 * (gs + 1) + x0 + 1] * fx, v1 = grid[(y0 + 1) * (gs + 1) + x0] * (1 - fx) + grid[(y0 + 1) * (gs + 1) + x0 + 1] * fx;
      var low = (v0 * (1 - fy) + v1 * fy - 0.5) * 14, n = (R() - 0.5) * 12 + low;
      var k = (y * w + x) * 4; id.data[k] = base[0] + n; id.data[k + 1] = base[1] + n * 0.95; id.data[k + 2] = base[2] + n * 0.85; id.data[k + 3] = 255;
    }
    g.putImageData(id, 0, 0);
    g.lineCap = 'round';
    for (var f = 0; f < 900; f++) {
      var fx2 = R() * w, fy2 = R() * h, len = 5 + R() * 18, a = R() * TAU;
      g.strokeStyle = f % 4 ? 'rgba(255,252,240,0.4)' : 'rgba(120,95,60,0.16)'; g.lineWidth = 0.5 + R() * 0.7;
      g.beginPath(); g.moveTo(fx2, fy2); g.quadraticCurveTo(fx2 + Math.cos(a) * len / 2 + (R() - 0.5) * 8, fy2 + Math.sin(a) * len / 2 + (R() - 0.5) * 8, fx2 + Math.cos(a) * len, fy2 + Math.sin(a) * len); g.stroke();
    }
    for (var s = 0; s < 22; s++) { // «рыжие» пятнышки старой бумаги
      var sx = R() * w, sy = R() * h, sr = 3 + R() * 14, gr = g.createRadialGradient(sx, sy, 0, sx, sy, sr);
      gr.addColorStop(0, 'rgba(170,120,60,0.12)'); gr.addColorStop(1, 'rgba(170,120,60,0)'); g.fillStyle = gr; g.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
    }
    var vg = g.createRadialGradient(w / 2, h / 2, h * 0.45, w / 2, h / 2, w * 0.62);
    vg.addColorStop(0, 'rgba(150,110,60,0)'); vg.addColorStop(1, 'rgba(150,110,60,0.22)'); g.fillStyle = vg; g.fillRect(0, 0, w, h);
    PAPER = c; return c;
  }
  function speck() {
    if (SPECK) return SPECK;
    var n = 128, c = document.createElement('canvas'); c.width = c.height = n;
    var g = c.getContext('2d'), R = rng(5);
    for (var i = 0; i < 160; i++) { g.fillStyle = 'rgba(239,229,203,' + (0.25 + R() * 0.5) + ')'; var r = 0.3 + R() * 0.9; g.beginPath(); g.ellipse(R() * n, R() * n, r * (1 + R() * 2), r, R() * 3, 0, TAU); g.fill(); }
    SPECK = c; return c;
  }
  var PATS = new WeakMap();
  function pats(g) {
    var p = PATS.get(g);
    if (!p) {
      p = { paper: g.createPattern(paper(), 'repeat'), speck: g.createPattern(speck(), 'repeat') };
      if (p.paper.setTransform) p.paper.setTransform(new DOMMatrix([1 / PS, 0, 0, 1 / PS, 0, 0]));
      PATS.set(g, p);
    }
    return p;
  }
  // заливка «чистой бумагой» (совпадает с фоном — перекрывает то, что позади)
  function fillPaper(g, pts) { poly(g, pts); g.fillStyle = pats(g).paper; g.fill(); }
  function fillInk(g, pts, alpha) {
    poly(g, pts); g.fillStyle = INK; g.globalAlpha = alpha || 1; g.fill(); g.globalAlpha = 1;
    var sp = pats(g).speck; if (sp.setTransform) sp.setTransform(new DOMMatrix([1, 0, 0, 1, J.v * 37 % 128, J.v * 53 % 128]));
    poly(g, pts); g.fillStyle = sp; g.fill();
  }
  function wash(g, pts, col, a, ox, oy) { // акцент с несовмещением печати
    g.save(); g.globalCompositeOperation = 'multiply'; g.globalAlpha = a == null ? 0.88 : a;
    g.translate(ox == null ? 1.8 : ox, oy == null ? 1.3 : oy); poly(g, pts); g.fillStyle = col; g.fill(); g.restore();
  }

  // ---------- штрих ----------
  function outline(g, pts, w, seed, open) {
    var p = subdiv(pts, 7, !open, 0.9, seed), R = rng(seed + 11), ph = R() * 6, n = p.length, segs = open ? n - 1 : n;
    g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = INK;
    for (var i = 0; i < segs; i += 2) {
      g.beginPath(); g.moveTo(p[i][0], p[i][1]);
      for (var k = 1; k <= 2 && i + k <= segs; k++) { var q = p[(i + k) % n]; g.lineTo(q[0], q[1]); }
      g.lineWidth = w * (0.55 + 0.9 * (0.5 + 0.5 * Math.sin(i * 0.23 + ph)) * (0.85 + R() * 0.3)); g.stroke();
    }
  }
  function stroke(g, pts, w, seed) { outline(g, pts, w, seed, true); }
  // штриховка: ang — направление линий, sp — шаг, d — плотность 0..1 (число или функция (x,y))
  function hatch(g, pts, o) {
    var b = bbox(pts), cx = b[0] + b[2] / 2, cy = b[1] + b[3] / 2, Rr = Math.hypot(b[2], b[3]) / 2 + 3;
    var seed = o.seed || 1, R = rng(seed + J.v * 977), ca = Math.cos(o.ang || 0), sa = Math.sin(o.ang || 0);
    var sp = o.sp || 4, dfn = typeof o.d === 'function' ? o.d : null, dc = o.d == null ? 1 : o.d, i = 0;
    g.save(); poly(g, pts); g.clip(); g.beginPath();
    for (var c = -Rr; c <= Rr; c += sp, i++) {
      var th = (i * 0.618034 + seed * 0.37) % 1, ox = cx - sa * c, oy = cy + ca * c;
      if (!dfn) {
        if (dc <= th) continue;
        var j1 = (R() - 0.5) * 1.4, j2 = (R() - 0.5) * 1.4, jm = (R() - 0.5) * 1.1;
        g.moveTo(ox - ca * Rr - sa * j1, oy - sa * Rr + ca * j1); g.lineTo(ox - sa * jm, oy + ca * jm); g.lineTo(ox + ca * Rr - sa * j2, oy + sa * Rr + ca * j2);
        continue;
      }
      var on = false;
      for (var s = -Rr; s <= Rr; s += 5) {
        var x = ox + ca * s, y = oy + sa * s, vis = dfn(x, y) > th;
        if (vis && !on) { g.moveTo(x, y); on = true; } else if (vis) g.lineTo(x + (R() - 0.5) * 0.6, y + (R() - 0.5) * 0.6); else on = false;
      }
    }
    g.lineWidth = o.lw || 0.85; g.strokeStyle = o.col || INK; g.lineCap = 'round'; g.globalAlpha = o.a || 0.92; g.stroke();
    g.restore();
  }
  function tone(g, pts, lvl, ang, seed, lw) {
    if (lvl <= 0) return;
    ang = ang == null ? 0.8 : ang;
    var sp = [0, 6.5, 4.4, 4.2, 3.2][Math.min(4, lvl)] || 3.2;
    hatch(g, pts, { ang: ang, sp: sp, seed: seed, lw: lw || 0.85 });
    if (lvl >= 3) hatch(g, pts, { ang: ang + 1.25, sp: lvl >= 4 ? 3.6 : 5.2, seed: seed + 3, lw: (lw || 0.85) * 0.9 });
  }
  // фигура «как в оттиске»: бумага/тушь/акцент + штриховка + контур
  function shape(g, pts, o) {
    o = o || {};
    var seed = o.seed || 1, p = o.jit === 0 ? pts : jit(pts, o.jit || 0.6, seed);
    if (o.fill === 'ink') { fillInk(g, p); if (o.w) outline(g, p, o.w, seed); return p; }
    if (o.fill !== 'none') fillPaper(g, p);
    if (o.fill === 'verm' || o.fill === 'ochre') wash(g, p, o.fill === 'verm' ? VERM : OCHRE, o.wa);
    if (o.d != null) hatch(g, p, { ang: o.ang == null ? 0.8 : o.ang, sp: o.sp || 4, d: o.d, seed: seed + 5, lw: o.lw });
    else if (o.h) tone(g, p, o.h, o.ang, seed + 5, o.lw);
    if (o.w !== 0) outline(g, p, o.w || 1.8, seed);
    return p;
  }
  function dot(g, x, y, r) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = INK; g.fill(); }

  // ---------- кэш (3 варианта «кипения») ----------
  var RES = { r: 1 }, cache = new Map(), BOIL = 3;
  function sprite(key, bx, by, bw, bh, v, draw) {
    var r = RES.r, k = key + '@' + r + '#' + v, s = cache.get(k);
    if (s) return s;
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(bw * r)); c.height = Math.max(1, Math.ceil(bh * r));
    var g = c.getContext('2d');
    g.setTransform(c.width / bw, 0, 0, c.height / bh, -bx * c.width / bw, -by * c.height / bh);
    g.lineJoin = 'round'; g.lineCap = 'round';
    var old = J.v; J.v = v; draw(g); J.v = old;
    s = { c: c, x: bx, y: by, w: bw, h: bh };
    cache.set(k, s);
    if (cache.size > 700) cache.delete(cache.keys().next().value);
    return s;
  }
  function blit(ctx, s) { ctx.drawImage(s.c, s.x, s.y, s.w, s.h); }
  function boilV(t) { return Math.floor(t * 8) % BOIL; }

  // ---------- элементы окружения ----------
  var K = {};

  function sunAt(g, cx, cy, r, seed) {
    var rays = 20;
    g.lineCap = 'round';
    for (var i = 0; i < rays; i++) {
      var a = Math.PI + i / (rays - 1) * Math.PI, long = i % 2 === 0, r0 = r + 8, r1 = r + (long ? 46 : 26);
      stroke(g, [[cx + Math.cos(a) * r0, cy + Math.sin(a) * r0], [cx + Math.cos(a) * r1, cy + Math.sin(a) * r1]], long ? 1.8 : 1.1, seed + i);
    }
    var d = ell(cx, cy, r, r, 40);
    fillPaper(g, d); wash(g, d, OCHRE, 0.85);
    hatch(g, d, { ang: 0, sp: 3.4, d: function (x, y) { return (y - cy + r) / (2 * r) * 0.9; }, seed: seed + 50, lw: 0.7 });
    outline(g, d, 2.2, seed);
  }

  K.sky = function (g, it, sc) {
    var m = sc.mood;
    g.fillStyle = pats(g).paper; g.fillRect(0, 0, W, H);
    if (m === 'dawn' || m === 'dusk') { // размытая охра у горизонта — «подкраска» лубка
      g.save(); g.globalCompositeOperation = 'multiply';
      var gr = g.createLinearGradient(0, 140, 0, 330); gr.addColorStop(0, 'rgba(207,154,50,0)'); gr.addColorStop(1, m === 'dusk' ? 'rgba(198,61,38,0.38)' : 'rgba(207,154,50,0.42)');
      g.fillStyle = gr; g.fillRect(0, 140, W, 200); g.restore();
    }
    var full = rectP(0, 0, W, H), sunX = 600, sunY = 262;
    var dens = m === 'night' ? function () { return 0.95; } : function (x, y) {
      var d = 1 - y / 290; var ds = Math.hypot(x - sunX, (y - sunY) * 1.4); if (ds < 150) d *= Math.max(0, (ds - 70) / 80);
      return d * 0.9;
    };
    hatch(g, full, { ang: 0, sp: 3.2, d: dens, seed: 3, lw: 0.75 });
    hatch(g, rectP(0, 0, W, 120), { ang: 0, sp: 6.4, d: function (x, y) { return 1 - y / 110; }, seed: 6, lw: 1.1 });
    hatch(g, full, { ang: 0.55, sp: 4.2, d: function (x, y) { var e = Math.min(x, W - x) / 260; return (1 - y / 150) * 0.9 - e; }, seed: 7, lw: 0.7 });
    if (m === 'night') hatch(g, full, { ang: 0.9, sp: 4, d: 0.8, seed: 4 });
    if (m === 'dawn' || m === 'day' || m === 'dusk') sunAt(g, sunX, sunY, 44, 70);
    [[250, 190, 1], [284, 174, 0.7]].forEach(function (b, k) {
      var x = b[0], y = b[1], s = b[2];
      stroke(g, [[x - 12 * s, y - 2 * s], [x - 5 * s, y - 3 * s], [x, y + 2 * s]], 1.6, 90 + k);
      stroke(g, [[x, y + 2 * s], [x + 5 * s, y - 3 * s], [x + 12 * s, y - 3 * s]], 1.6, 95 + k);
    });
  };

  K.moon = function (g, it) {
    var r = it.w / 2, cx = it.x + r, cy = it.y + r, d = ell(cx, cy, r, r, 30);
    fillPaper(g, d);
    hatch(g, d, { ang: 0.5, sp: 3, d: function (x, y) { return Math.hypot(x - cx - r * 0.45, y - cy + r * 0.2) < r * 0.95 ? 0 : 0.95; }, seed: 31 });
    outline(g, d, 1.6, 30);
  };

  function cloudPts(x, y, w, h, seed) {
    var R = rng(seed), n = 3 + Math.floor(R() * 2), bumps = [], bot = y + h * 0.86;
    for (var i = 0; i < n; i++) { var f = (i + 0.5) / n, r = h * (0.32 + R() * 0.32) * (i === 1 || i === 2 ? 1.25 : 1); bumps.push([x + w * (0.08 + f * 0.84), bot - r * 0.35, Math.min(r, w * 0.32)]); }
    var top = [];
    for (var xx = x; xx <= x + w; xx += 4) { var yy = bot; bumps.forEach(function (b) { var d = xx - b[0]; if (Math.abs(d) < b[2]) yy = Math.min(yy, b[1] - Math.sqrt(b[2] * b[2] - d * d)); }); top.push([xx, yy]); }
    return { pts: top.concat([[x + w, bot], [x, bot]]), bumps: bumps, bot: bot };
  }
  K.cloud = function (g, it) {
    var c = cloudPts(it.x, it.y, it.w, it.h, it.seed || 1), p = jit(c.pts, 0.6, it.seed);
    fillPaper(g, p);
    hatch(g, p, { ang: 0, sp: 3, d: function (x, y) { return (y - it.y - it.h * 0.45) / (it.h * 0.45); }, seed: (it.seed || 1) + 4, lw: 0.75 });
    c.bumps.forEach(function (b, i) { // завитки внутри
      var a0 = Math.PI * 0.75, pts = [];
      for (var k = 0; k <= 8; k++) { var a = a0 + k / 8 * 1.6, rr = b[2] * (0.55 - k * 0.025); pts.push([b[0] + Math.cos(a) * rr, b[1] + Math.sin(a) * rr]); }
      stroke(g, pts, 1.1, 120 + i);
    });
    outline(g, p, 2, it.seed || 1);
  };

  K.hill = function (g, it, sc) {
    var R = rng(it.seed || 1), tone_ = it.tone || 0, x = it.x, y = it.y, w = it.w, h = it.h;
    var amp = tone_ ? 18 : 30, ph1 = R() * 6, ph2 = R() * 6, top = [];
    function ry(xx) { return y + amp * (1 + Math.sin(xx * 0.0062 + ph1)) * 0.55 + amp * 0.35 * Math.sin(xx * 0.019 + ph2); }
    for (var xx = x; xx <= x + w + 1; xx += 12) top.push([xx, ry(xx)]);
    var pts = top.concat([[x + w, y + h + 30], [x, y + h + 30]]);
    fillPaper(g, pts);
    g.save(); poly(g, pts); g.clip();
    if (!tone_) {
      hatch(g, pts, { ang: -0.6, sp: 3.8, d: function (xx, yy) { return 0.22 + (yy - ry(xx)) / 110; }, seed: 140, lw: 0.75 });
      for (var i = 0; i < 4; i++) { // поля бороздами
        var fy = y + 50 + i * 22 + R() * 8, fx = x + 60 + R() * (w - 360), fw = 140 + R() * 220;
        var f = [[fx, fy], [fx + fw, fy - 8], [fx + fw + 20, fy + 14], [fx + 10, fy + 20]];
        fillPaper(g, f);
        if (i % 2) wash(g, f, OCHRE, 0.35, 0, 0);
        hatch(g, f, { ang: i % 2 ? 0.08 : -0.12, sp: 2.6, seed: 150 + i, lw: 0.6, a: 0.6 });
      }
    } else {
      for (var k = 1; k < 26; k++) { // контурные линии вдоль гребня, гуще книзу
        var cl = [], gap = 4 + k * 0.9 + k * k * 0.06, off = 0;
        for (var c = 0; c < top.length; c++) { off = k * gap * 0.55; cl.push([top[c][0], top[c][1] + off + Math.sin(c * 0.7 + k) * 1.2]); }
        var R2 = rng(170 + k + J.v * 31), seg = [];
        for (var c2 = 0; c2 < cl.length; c2++) {
          if (R2() < 0.08 && seg.length > 1) { stroke(g, seg, 0.8 + k * 0.03, 180 + k * 3 + c2); seg = []; }
          else seg.push(cl[c2]);
        }
        if (seg.length > 1) stroke(g, seg, 0.8 + k * 0.03, 199 + k);
      }
      var path = [];
      for (var q = 0; q <= 12; q++) { var f2 = q / 12; path.push([x + 520 + Math.sin(f2 * 3 + 1) * 70 - f2 * 40 + f2 * f2 * 40, y + 30 + f2 * (h - 30)]); }
      var left = path.map(function (p, k2) { return [p[0] - 4 - k2 * 2.2, p[1]]; }), right = path.map(function (p, k2) { return [p[0] + 4 + k2 * 2.2, p[1]]; }).reverse();
      var road = left.concat(right); fillPaper(g, road); stroke(g, left, 1.3, 210); stroke(g, right.slice().reverse(), 1.3, 211);
      for (var j = 0; j < 14; j++) {
        var hx = x + 80 + j * 30 + R() * 8, hy = y + 48 + Math.sin(j * 0.6) * 10;
        if (hx > x + 470 && hx < x + 640) continue;
        shape(g, scallop(hx, hy, 12 + R() * 4, 6, 0.18), { h: 3, seed: 220 + j, w: 1.3, ang: 0.7 });
      }
    }
    g.restore();
    outline(g, top, tone_ ? 2.6 : 2.1, (it.seed || 1) + 300, true);
    if (!tone_) for (var t2 = 0; t2 < 9; t2++) {
      var idx = Math.floor(3 + (t2 + R() * 0.8) / 9 * (top.length - 6)), p0 = top[idx], s = 1.1 + R() * 0.7;
      stroke(g, [[p0[0], p0[1] + 3], [p0[0], p0[1] - 10 * s]], 1.5, 400 + t2);
      if (t2 % 2) shape(g, [[p0[0], p0[1] - 30 * s], [p0[0] + 8 * s, p0[1] - 7 * s], [p0[0] - 8 * s, p0[1] - 7 * s]], { h: 2, ang: 1.2, seed: 410 + t2, w: 1.3 });
      else shape(g, ell(p0[0], p0[1] - 15 * s, 8 * s, 9 * s, 16), { d: 0.5, sp: 2.6, ang: 1.57, seed: 420 + t2, w: 1.3 });
    }
  };

  K.ground = function (g, it) {
    var x = it.x, y = it.y, w = it.w, h = it.h, R = rng(it.seed || 1), top = [];
    for (var xx = x - 10; xx <= x + w + 10; xx += 20) top.push([xx, y + Math.sin(xx * 0.02) * 2]);
    var pts = top.concat([[x + w + 10, y + h + 10], [x - 10, y + h + 10]]);
    fillPaper(g, pts);
    hatch(g, pts, { ang: 0.04, sp: 3.6, d: function (xx, yy) { return 0.15 + (yy - y) / h * 0.85; }, seed: 500, lw: 0.8 });
    outline(g, top, 2.4, 501, true);
    for (var i = 0; i < 9; i++) {
      var sx = x + 40 + i * 110 + R() * 40, sy = y + 40 + R() * 30, rx = 18 + R() * 12, st = ell(sx, sy, rx, rx * 0.4, 16);
      fillPaper(g, st);
      hatch(g, st, { ang: 0.3, sp: 3, d: function (px, py) { return (py - sy) / (rx * 0.4) + 0.2; }, seed: 510 + i, lw: 0.7 });
      outline(g, st, 1.3, 520 + i);
    }
    for (var j = 0; j < 34; j++) { // пучки травы «галочкой»
      var bx = x + R() * w, by = y + 4 + R() * (h - 20), bh = 5 + R() * 7;
      stroke(g, [[bx - 4, by - bh], [bx, by]], 1.2, 560 + j); stroke(g, [[bx, by], [bx + 1, by - bh * 1.2]], 1.2, 600 + j); stroke(g, [[bx, by], [bx + 5, by - bh * 0.8]], 1.2, 640 + j);
    }
  };

  K.house = function (g, it) {
    var x = it.x, y = it.y, w = it.w, h = it.h, st = it.state || {};
    var roofY = y + h * 0.42, wx0 = x + 20, wx1 = x + w - 20;
    var chx = x + w * 0.68, ch = rectP(chx, y + h * 0.06, w * 0.09, h * 0.3);
    var chp = shape(g, ch, { fill: 'verm', wa: 0.8, w: 1.8, seed: 601 });
    g.save(); poly(g, chp); g.clip(); g.beginPath();
    for (var by2 = y + h * 0.06 + 6, r = 0; by2 < roofY; by2 += 8, r++) { g.moveTo(chx, by2); g.lineTo(chx + w * 0.09, by2); for (var bx2 = chx + (r % 2) * 6; bx2 < chx + w * 0.09; bx2 += 12) { g.moveTo(bx2, by2); g.lineTo(bx2, by2 + 8); } }
    g.lineWidth = 0.8; g.strokeStyle = INK; g.stroke(); g.restore();
    shape(g, rectP(chx - 4, y + h * 0.05, w * 0.09 + 8, 8), { fill: 'ink', seed: 602 });
    var wall = rectP(wx0, roofY - 6, wx1 - wx0, y + h - roofY + 6);
    shape(g, wall, { d: function (px) { return (px - wx0) / (wx1 - wx0) > 0.72 ? 0.65 : 0.0; }, ang: 1.57, sp: 3.4, w: 2.2, seed: 603 });
    // фахверк — сплошная тушь
    [rectP(wx0, roofY + 2, 11, y + h - roofY - 2), rectP(wx1 - 11, roofY + 2, 11, y + h - roofY - 2), rectP(wx0, y + h * 0.6, wx1 - wx0, 8),
      [[wx0 + 11, y + h * 0.6 + 8], [wx0 + 19, y + h * 0.6 + 8], [x + w * 0.5, y + h - 2], [x + w * 0.5 - 8, y + h - 2]]].forEach(function (p, i) { shape(g, p, { fill: 'ink', seed: 604 + i }); });
    for (var f = 0; f < 7; f++) shape(g, rectP(wx0 - 4 + f * (wx1 - wx0 + 8) / 7, y + h - 12, (wx1 - wx0 + 8) / 7 - 2, 12), { h: f % 2 ? 2 : 1, ang: 0.6, w: 1.2, seed: 610 + f });
    var wx = x + w * 0.2, wy = y + h * 0.48, ww = w * 0.26, wh = h * 0.2;
    shape(g, rectP(wx - 6, wy - 6, ww + 12, wh + 12), { fill: 'ink', seed: 620 });
    var glass = rectP(wx, wy, ww, wh);
    if (st.windowLit) {
      fillPaper(g, glass); wash(g, glass, OCHRE, 0.9, 0, 0);
      g.save(); poly(g, glass); g.clip(); g.beginPath();
      for (var a = 0; a < 16; a++) { var an = a / 16 * TAU; g.moveTo(wx + ww / 2 + Math.cos(an) * 6, wy + wh / 2 + Math.sin(an) * 6); g.lineTo(wx + ww / 2 + Math.cos(an) * 60, wy + wh / 2 + Math.sin(an) * 60); }
      g.lineWidth = 0.7; g.strokeStyle = 'rgba(30,25,21,0.6)'; g.stroke(); g.restore();
    } else shape(g, glass, { h: 4, w: 0, seed: 621 });
    shape(g, rectP(wx + ww / 2 - 2.5, wy, 5, wh), { fill: 'ink', seed: 622 });
    shape(g, rectP(wx, wy + wh / 2 - 2.5, ww, 5), { fill: 'ink', seed: 623 });
    shape(g, rectP(wx - 10, wy + wh + 6, ww + 20, 13), { fill: 'verm', h: 1, ang: 1.57, w: 1.6, seed: 624 });
    for (var fl = 0; fl < 5; fl++) { var fx = wx - 2 + fl * (ww + 4) / 4; shape(g, scallop(fx, wy + wh + 2, 5, 5, 0.3), { fill: fl % 2 ? 'verm' : 'ochre', w: 1.2, seed: 630 + fl }); dot(g, fx, wy + wh + 2, 1.4); }
    var dx = x + w * 0.6, dy = y + h * 0.64, dw = w * 0.21, dh = y + h - dy - 2;
    var arch = [[dx, dy + dh]].concat(ell(dx + dw / 2, dy + dw / 2, dw / 2, dw / 2, 14, Math.PI, TAU)).concat([[dx + dw, dy + dh]]);
    shape(g, arch.map(function (q) { return [q[0] + (q[0] - dx - dw / 2) * 0.14, q[1] - 5]; }), { fill: 'ink', seed: 640 });
    var dp = shape(g, arch, { h: 3, ang: 1.45, w: 1.6, seed: 641 });
    g.save(); poly(g, dp); g.clip(); g.beginPath(); for (var pl = 1; pl < 4; pl++) { g.moveTo(dx + dw * pl / 4, dy); g.lineTo(dx + dw * pl / 4, dy + dh); } g.lineWidth = 1.6; g.strokeStyle = INK; g.stroke(); g.restore();
    var kn = ell(dx + dw * 0.78, dy + dh * 0.55, 3.2, 3.2, 10); fillPaper(g, kn); wash(g, kn, OCHRE, 0.9, 0, 0); outline(g, kn, 1.2, 642);
    var sx = dx + dw / 2, sy = dy - 26, sg = ell(sx, sy, 17, 17, 28);
    shape(g, sg, { w: 2, seed: 650 });
    g.save(); g.translate(sx - 13, sy - 13); g.scale(0.26, 0.26); g.fillStyle = VERM; g.globalCompositeOperation = 'multiply'; g.fill(new Path2D(gearD(50, 50, 40, 31, 9) + circD(50, 50, 12)), 'evenodd'); g.restore();
    stroke(g, [[sx - 10, sy - 26], [sx, sy - 17], [sx + 10, sy - 26]], 1.2, 651);
    // крыша: киноварь + ряды черепицы-дуг
    var rx0 = x - 8, rx1 = x + w + 8, apx = x + w * 0.5, roof = [[apx, y], [rx1, roofY], [rx0, roofY]];
    var rp = jit(roof, 0.6, 660); fillPaper(g, rp); wash(g, rp, VERM, 0.85);
    g.save(); poly(g, rp); g.clip();
    for (var row = 0; row < 8; row++) {
      var ryy = y + 18 + row * (roofY - y - 10) / 7.2;
      for (var s2 = rx0 - 10 + (row % 2) * 10; s2 < rx1 + 10; s2 += 20) stroke(g, ell(s2, ryy, 10, 7, 8, 0, Math.PI), 1, 670 + row * 50 + Math.floor(s2));
    }
    hatch(g, rp, { ang: 0.5, sp: 3.4, d: function (px, py) { return (py - y) / (roofY - y) * 0.25 + (px > apx ? 0.35 : 0); }, seed: 690, lw: 0.75 });
    g.restore();
    outline(g, rp, 2.6, 691);
    shape(g, [[apx, y - 4], [rx1 + 6, roofY + 2], [rx1 - 6, roofY + 4], [apx, y + 9], [rx0 + 6, roofY + 4], [rx0 - 6, roofY + 2]], { fill: 'ink', seed: 692 });
  };

  K.tower = function (g, it) {
    var x = it.x, y = it.y, w = it.w, h = it.h;
    shape(g, rectP(x + w * 0.15, y + h * 0.2, w * 0.7, h * 0.8), { d: function (px) { return px > x + w * 0.6 ? 0.7 : 0.1; }, ang: 1.57, w: 2, seed: 700 });
    shape(g, [[x + w / 2, y], [x + w, y + h * 0.22], [x, y + h * 0.22]], { fill: 'verm', w: 2, seed: 701 });
  };

  K.tree = function (g, it) {
    var x = it.x, y = it.y, w = it.w, h = it.h, R = rng(it.seed || 4), cx = x + w * 0.5;
    var trunk = [[cx - 14, y + h], [cx + 16, y + h], [cx + 8, y + h * 0.55], [cx + 34, y + h * 0.38], [cx + 28, y + h * 0.35], [cx + 4, y + h * 0.5], [cx + 2, y + h * 0.3], [cx - 4, y + h * 0.3], [cx - 6, y + h * 0.5], [cx - 30, y + h * 0.36], [cx - 34, y + h * 0.4], [cx - 8, y + h * 0.58]];
    var tp = shape(g, trunk, { w: 2.2, seed: 800, fill: 'paper' });
    g.save(); poly(g, tp); g.clip();
    for (var b = 0; b < 7; b++) { var bx = cx - 12 + b * 4.5, pts = []; for (var k = 0; k <= 8; k++) pts.push([bx + Math.sin(k * 1.3 + b) * 1.5 + (b > 3 ? 2 : 0), y + h * 0.5 + k * h * 0.065]); stroke(g, pts, b > 3 ? 1.3 : 0.8, 810 + b); }
    g.restore();
    var crowns = [[cx - w * 0.24, y + h * 0.32, w * 0.27, 3], [cx + w * 0.22, y + h * 0.3, w * 0.27, 3], [cx, y + h * 0.2, w * 0.33, 1], [cx - w * 0.12, y + h * 0.38, w * 0.22, 2], [cx + w * 0.14, y + h * 0.42, w * 0.2, 2]];
    crowns.forEach(function (c, i) {
      var p = jit(scallop(c[0], c[1], c[2], 9 + i, 0.14), 0.7, 820 + i);
      fillPaper(g, p);
      hatch(g, p, { ang: 0.85, sp: 3.4, d: function (px, py) { return 0.08 * c[3] + ((px - c[0]) + (py - c[1])) / (c[2] * 2.2) + 0.15; }, seed: 830 + i, lw: 0.8 });
      if (c[3] === 3) hatch(g, p, { ang: -0.6, sp: 4.4, d: function (px, py) { return ((px - c[0]) + (py - c[1])) / (c[2] * 1.6); }, seed: 835 + i, lw: 0.75 });
      for (var l = 0; l < 7; l++) { var a = R() * TAU, rr = R() * c[2] * 0.7, lx = c[0] + Math.cos(a) * rr, ly = c[1] + Math.sin(a) * rr * 0.8; stroke(g, ell(lx, ly, 4, 3, 6, 0.2, Math.PI - 0.2), 1, 850 + i * 10 + l); }
      outline(g, p, 2.1, 840 + i);
    });
    for (var f = 0; f < 7; f++) { var a2 = R() * TAU, r2 = R() * w * 0.3, ap = ell(cx + Math.cos(a2) * r2, y + h * 0.3 + Math.sin(a2) * r2 * 0.6, 5, 5, 12); fillPaper(g, ap); wash(g, ap, VERM, 0.95); outline(g, ap, 1.3, 870 + f); }
  };

  K.plant = function (g, it, sc) {
    var x = it.x, y = it.y, w = it.w, h = it.h, R = rng(it.seed || 1), bx = x + w / 2, by = y + h, indoor = sc.mood === 'indoor';
    if (indoor) {
      by = y + h - h * 0.34;
      shape(g, [[bx - w * 0.3, by], [bx + w * 0.3, by], [bx + w * 0.22, y + h], [bx - w * 0.22, y + h]], { fill: 'verm', h: 1, ang: 1.57, w: 1.8, seed: 900 });
      shape(g, rectP(bx - w * 0.34, by - 6, w * 0.68, 8), { fill: 'ink', seed: 901 });
    }
    var n = indoor ? 7 : 9;
    for (var i = 0; i < n; i++) {
      var a = -Math.PI / 2 + (i / (n - 1) - 0.5) * 1.9 + (R() - 0.5) * 0.25, L = (indoor ? h * 0.7 : h * 0.95) * (0.65 + R() * 0.4), wd = indoor ? 9 : 8;
      var tip = [bx + Math.cos(a) * L, by + Math.sin(a) * L], nx = -Math.sin(a), ny = Math.cos(a), mid = [bx + Math.cos(a) * L * 0.5, by + Math.sin(a) * L * 0.5], bend = (i - n / 2) * 2;
      var leaf = [[bx - nx * 2, by - ny * 2], [mid[0] - nx * wd + bend, mid[1] - ny * wd], [tip[0] + bend * 1.5, tip[1]], [mid[0] + nx * wd + bend, mid[1] + ny * wd], [bx + nx * 2, by + ny * 2]];
      if (indoor) { var lp = shape(g, leaf, { h: i % 2 ? 2 : 1, ang: a + 0.6, w: 1.4, seed: 910 + i }); stroke(g, [[bx, by], [tip[0] + bend * 1.5, tip[1]]], 0.8, 915 + i); void lp; }
      else shape(g, leaf, { fill: 'ink', seed: 910 + i });
    }
    if (!indoor) for (var k = 0; k < 2; k++) {
      var fx = bx + (k ? 18 : -14), fy = y + 14 + k * 16;
      stroke(g, [[bx + (k ? 4 : -4), by], [fx, fy]], 2, 930 + k);
      shape(g, scallop(fx, fy, 8, 6, 0.35), { fill: k ? 'ochre' : 'verm', w: 1.6, seed: 950 + k });
      dot(g, fx, fy, 2.2);
    }
  };

  K.rock = function (g, it) {
    var x = it.x, y = it.y, w = it.w, h = it.h;
    var p = [[x, y + h], [x + w * 0.08, y + h * 0.45], [x + w * 0.3, y + h * 0.1], [x + w * 0.62, y], [x + w * 0.88, y + h * 0.3], [x + w, y + h]];
    shape(g, p, { d: function (px) { return (px - x) / w * 1.1 - 0.1; }, ang: -0.7, sp: 3, w: 2.2, seed: 1000 });
    stroke(g, [[x + w * 0.3, y + h * 0.12], [x + w * 0.45, y + h * 0.6], [x + w * 0.42, y + h]], 1.1, 1001);
  };

  K.water = function (g, it) {
    var x = it.x, y = it.y, w = it.w, h = it.h, p = rectP(x, y, w, h);
    fillPaper(g, p);
    for (var i = 0; i < h / 6; i++) { var pts = []; for (var xx = x; xx <= x + w; xx += 10) pts.push([xx, y + 4 + i * 6 + Math.sin(xx * 0.08 + i) * 1.6]); stroke(g, pts, 0.8, 1100 + i); }
    outline(g, [[x, y], [x + w, y]], 2, 1120, true);
  };

  K.bridge = function (g, it) {
    var x = it.x, y = it.y, w = it.w, h = it.h;
    var p = [[x, y], [x + w, y], [x + w, y + h], [x + w * 0.85, y + h]].concat(ell(x + w / 2, y + h, w * 0.35, h * 0.6, 20, 0, -Math.PI)).concat([[x + w * 0.15, y + h], [x, y + h]]);
    shape(g, p, { h: 2, ang: 1.57, w: 2, seed: 1200 });
    shape(g, rectP(x - 6, y - 8, w + 12, 9), { fill: 'ink', seed: 1201 });
  };

  K.fence = function (g, it) {
    var x = it.x, y = it.y, w = it.w, h = it.h, R = rng(it.seed || 2);
    shape(g, rectP(x - 4, y + h * 0.3, w + 8, 8), { h: 3, ang: 0, w: 1.4, seed: 1300 });
    shape(g, rectP(x - 4, y + h * 0.68, w + 8, 8), { h: 3, ang: 0, w: 1.4, seed: 1301 });
    var n = Math.max(2, Math.round(w / 22));
    for (var i = 0; i < n; i++) {
      var px = x + i * w / n + 3, pw = w / n - 6, ph = h * (0.86 + R() * 0.14), top = y + h - ph;
      var pk = rotP([[px, top + 8], [px + pw / 2, top], [px + pw, top + 8], [px + pw, y + h], [px, y + h]], px + pw / 2, y + h, (R() - 0.5) * 0.06);
      (function (px0, pw0) { shape(g, pk, { d: function (qx) { return (qx - px0) / pw0 > 0.62 ? 0.8 : 0; }, ang: 1.57, sp: 2.6, w: 1.6, seed: 1310 + i + it.seed * 20 }); })(px, pw);
      dot(g, px + pw / 2, y + h * 0.34, 1.3); dot(g, px + pw / 2, y + h * 0.72, 1.3);
    }
  };

  K.pipe = function (g, it) {
    var x = it.x, y = it.y, w = it.w, h = it.h, p = rectP(x, y, w, h);
    shape(g, p, { d: function (px) { var f = (px - x) / w; return f > 0.62 ? (f - 0.5) * 2 : (f < 0.12 ? 0.3 : 0); }, ang: 1.57, sp: 2.8, w: 2, seed: 1400, fill: 'ochre', wa: 0.55 });
    for (var r = y + 40; r < y + h - 10; r += 74) { shape(g, rectP(x - 5, r, w + 10, 13), { h: 3, ang: 1.57, w: 1.6, seed: 1410 + r }); dot(g, x + 1, r + 6.5, 1.6); dot(g, x + w - 1, r + 6.5, 1.6); }
  };

  K.lamp = function (g, it) {
    var x = it.x, y = it.y, w = it.w, h = it.h, lit = !it.state || it.state.lit !== false;
    if (it.variant === 'hang') {
      var cx = x + w / 2, sy = y + h * 0.66;
      stroke(g, [[cx, y], [cx, sy - 8]], 1.4, 1500);
      shape(g, [[cx - 7, sy - 8], [cx + 7, sy - 8], [cx + 6, sy], [cx - 6, sy]], { fill: 'ink', seed: 1501 });
      var bulb = ell(cx, sy + h * 0.2 + 4, 8, 8, 16); fillPaper(g, bulb); if (lit) wash(g, bulb, OCHRE, 0.7, 0, 0); outline(g, bulb, 1.3, 1502);
      shape(g, [[cx - 9, sy], [cx + 9, sy], [cx + w / 2, sy + h * 0.2], [cx - w / 2, sy + h * 0.2]], { fill: 'verm', d: function (px) { return (px - cx) / (w / 2); }, ang: 1.2, sp: 3, w: 2, seed: 1503 });
      return;
    }
    var px = x + w / 2;
    shape(g, [[px - 4, y + 40], [px + 4, y + 40], [px + 5, y + h - 10], [px - 5, y + h - 10]], { fill: 'ink', seed: 1510 });
    shape(g, [[px - 11, y + h - 14], [px + 11, y + h - 14], [px + 14, y + h], [px - 14, y + h]], { fill: 'ink', seed: 1511 });
    var gl = [[px - 13, y + 14], [px + 13, y + 14], [px + 10, y + 44], [px - 10, y + 44]];
    shape(g, gl, { fill: lit ? 'ochre' : 'paper', h: lit ? 0 : 3, w: 1.8, seed: 1513 });
    stroke(g, [[px, y + 14], [px, y + 44]], 1.6, 1514);
    shape(g, [[px, y - 2], [px + 18, y + 15], [px - 18, y + 15]], { fill: 'ink', seed: 1515 });
    shape(g, rectP(px - 12, y + 42, 24, 6), { fill: 'ink', seed: 1516 });
  };

  K.wall = function (g, it) {
    var x = it.x, y = it.y, w = it.w, h = it.h, R = rng(it.seed || 2), lx = 330, ly = 170;
    var all = rectP(x - 10, y - 10, w + 20, h + 20);
    g.fillStyle = pats(g).paper; g.fillRect(x - 10, y - 10, w + 20, h + 20);
    var shade = function (px, py) { return Math.min(1, Math.max(0, (Math.hypot(px - lx, (py - ly) * 1.3) - 120) / 520)); };
    hatch(g, all, { ang: 1.57, sp: 3.2, d: function (px, py) { return 0.12 + shade(px, py) * 0.95; }, seed: 1600, lw: 0.75 });
    hatch(g, all, { ang: 0.7, sp: 4, d: function (px, py) { return shade(px, py) * 1.3 - 0.35; }, seed: 1601, lw: 0.75 });
    var px = x - 10, i = 0;
    while (px < x + w + 10) { var pw = 58 + R() * 26; stroke(g, [[px, y - 10], [px, y + h * 0.74]], 1.8, 1610 + i); var gx = px + pw * 0.5, pts = []; for (var k = 0; k <= 10; k++) pts.push([gx + Math.sin(k * 0.9 + i) * 3, y + k * h * 0.07]); stroke(g, pts, 0.7, 1620 + i); px += pw; i++; }
    var wy = y + h * 0.74, wain = rectP(x - 10, wy, w + 20, h - h * 0.74 + 10);
    fillPaper(g, wain); tone(g, wain, 3, 0.75, 1650);
    shape(g, rectP(x - 10, wy - 4, w + 20, 9), { fill: 'ink', seed: 1651 });
    for (var b = 0; b < 8; b++) stroke(g, [[x + 20 + b * 120, wy + 8], [x + 20 + b * 120, y + h]], 1.6, 1660 + b);
    // лист с чертежом шестерни, прибит гвоздиками; киноварная печать
    var bx = 70, by = 70, sheet = rotP(rectP(bx, by, 118, 86), bx + 59, by + 43, -0.04);
    shape(g, sheet, { w: 1.8, seed: 1670 });
    stroke(g, ell(bx + 44, by + 46, 20, 20, 24), 1.2, 1671); stroke(g, ell(bx + 44, by + 46, 7, 7, 12), 1, 1672);
    for (var a = 0; a < 8; a++) { var an = a / 8 * TAU; stroke(g, [[bx + 44 + Math.cos(an) * 20, by + 46 + Math.sin(an) * 20], [bx + 44 + Math.cos(an) * 27, by + 46 + Math.sin(an) * 27]], 1, 1680 + a); }
    [20, 32, 44].forEach(function (yy, k) { stroke(g, [[bx + 76, by + yy], [bx + 106 - k * 4, by + yy]], 0.9, 1690 + k); });
    var seal = ell(bx + 96, by + 68, 9, 9, 16); fillPaper(g, seal); wash(g, seal, VERM, 0.9, 0, 0);
    dot(g, bx + 4, by + 4, 2); dot(g, bx + 114, by + 2, 2);
    // молот и клещи — силуэты тушью
    var tx = 560, ty = 70;
    shape(g, rectP(tx + 7, ty + 6, 6, 70), { fill: 'ochre', w: 1.4, seed: 1700 });
    shape(g, rectP(tx - 4, ty + 4, 28, 14), { fill: 'ink', seed: 1701 });
    shape(g, [[tx + 46, ty + 4], [tx + 52, ty + 4], [tx + 56, ty + 74], [tx + 50, ty + 74]], { fill: 'ink', seed: 1702 });
    shape(g, [[tx + 58, ty + 4], [tx + 52, ty + 4], [tx + 44, ty + 74], [tx + 50, ty + 74]], { fill: 'ink', seed: 1703 });
  };

  K.floor = function (g, it) {
    var x = it.x, y = it.y, w = it.w, h = it.h, R = rng(it.seed || 4), p = rectP(x - 10, y, w + 20, h + 10);
    fillPaper(g, p);
    hatch(g, p, { ang: 0.02, sp: 3, d: function (px, py) { return 0.35 + (py - y) / h * 0.6; }, seed: 1750, lw: 0.8 });
    outline(g, [[x - 10, y], [x + w + 10, y]], 2.6, 1751, true);
    var rows = [y + 4, y + 26, y + 52, y + 82];
    rows.forEach(function (ry, i) { stroke(g, [[x - 10, ry], [x + w + 10, ry]], 1.4, 1760 + i); var ox = R() * 120; for (var bx = x - ox; bx < x + w; bx += 150 + R() * 60) stroke(g, [[bx, ry], [bx, (rows[i + 1] || y + h)]], 1.2, 1770 + i * 20 + Math.floor(bx)); });
    var rx = 300, ry2 = 480, rw = 380, rh = 44, rug = rectP(rx, ry2, rw, rh);
    fillPaper(g, rug); wash(g, rug, VERM, 0.85);
    var inner = rectP(rx + 12, ry2 + 8, rw - 24, rh - 16); fillPaper(g, inner); wash(g, inner, OCHRE, 0.8);
    var zz = []; for (var s = 0; s <= 36; s++) zz.push([rx + 20 + s * (rw - 40) / 36, ry2 + rh / 2 + (s % 2 ? -6 : 6)]);
    stroke(g, zz, 1.4, 1790);
    outline(g, rug, 2, 1791); outline(g, inner, 1.3, 1792);
    for (var f = 0; f < 19; f++) { stroke(g, [[rx + f * rw / 18, ry2 + rh], [rx + f * rw / 18 + 1, ry2 + rh + 6]], 1, 1800 + f); stroke(g, [[rx + f * rw / 18, ry2], [rx + f * rw / 18 - 1, ry2 - 6]], 1, 1830 + f); }
  };

  K.window = function (g, it) {
    var x = it.x, y = it.y, w = it.w, h = it.h, view = rectP(x, y, w, h);
    shape(g, rectP(x - 12, y - 12, w + 24, h + 24), { fill: 'ink', seed: 1850 });
    fillPaper(g, view);
    g.save(); poly(g, view); g.clip();
    g.globalCompositeOperation = 'multiply'; var gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, 'rgba(207,154,50,0)'); gr.addColorStop(1, 'rgba(207,154,50,0.5)'); g.fillStyle = gr; g.fillRect(x, y, w, h); g.globalCompositeOperation = 'source-over';
    hatch(g, view, { ang: 0, sp: 3, d: function (px, py) { return 0.9 - (py - y) / h * 1.4; }, seed: 1851, lw: 0.7 });
    var sun = ell(x + w * 0.62, y + h * 0.74, 16, 16, 20); fillPaper(g, sun); wash(g, sun, OCHRE, 0.9); outline(g, sun, 1.4, 1852);
    var ridge = []; for (var xx = x - 5; xx <= x + w + 5; xx += 8) ridge.push([xx, y + h * 0.74 + Math.sin(xx * 0.04) * 6]);
    var hp = ridge.concat([[x + w + 5, y + h + 5], [x - 5, y + h + 5]]); fillPaper(g, hp); hatch(g, hp, { ang: -0.6, sp: 3.6, seed: 1853, d: 0.5 }); outline(g, ridge, 1.6, 1854, true);
    g.restore();
    shape(g, rectP(x + w / 2 - 4, y, 8, h), { fill: 'ink', seed: 1855 });
    shape(g, rectP(x, y + h * 0.45, w, 7), { fill: 'ink', seed: 1856 });
    shape(g, rectP(x - 20, y + h + 8, w + 40, 12), { h: 3, ang: 0.3, w: 1.8, seed: 1857 });
    [[x - 26, 1], [x + w + 26, -1]].forEach(function (c, k) {
      var cx = c[0], d = c[1], p = [[cx, y - 18], [cx + d * 44, y - 18]];
      for (var s = 0; s <= 12; s++) { var f = s / 12; p.push([cx + d * (44 - 30 * Math.sin(f * Math.PI * 0.9)), y - 18 + f * (h + 30)]); }
      p.push([cx, y + h + 12]);
      var pp = shape(g, p, { fill: 'verm', w: 1.8, seed: 1860 + k });
      g.save(); poly(g, pp); g.clip();
      for (var fo = 1; fo < 5; fo++) stroke(g, [[cx + d * fo * 8, y - 18], [cx + d * fo * 4, y + h * 0.5], [cx + d * fo * 6, y + h + 12]], 1, 1870 + k * 10 + fo);
      hatch(g, pp, { ang: 1.4, sp: 3, d: function (px) { return d > 0 ? 0.7 - (px - cx) / 40 : 0.7 + (px - cx) / 40; }, seed: 1880 + k, lw: 0.7 });
      g.restore();
      shape(g, rectP(Math.min(cx, cx + d * 30) + d * 2, y + h * 0.48, 30, 7), { fill: 'ochre', w: 1.3, seed: 1890 + k });
    });
    shape(g, rectP(x - 40, y - 24, w + 80, 7), { fill: 'ink', seed: 1895 });
  };

  K.shelf = function (g, it) {
    var x = it.x, y = it.y, w = it.w, h = it.h, R = rng(it.seed || 3), boards = [y + 4, y + 74, y + 144];
    boards.forEach(function (by, bi) {
      if (bi > 0) {
        var px = x + 10, k = 0;
        while (px < x + w - 24) {
          var t = Math.floor(R() * 4), iw, ih;
          if (t === 0) {
            iw = 22 + R() * 8; ih = 30 + R() * 14;
            shape(g, rectP(px, by - ih, iw, ih), { d: function (qx) { return 0; }, w: 1.6, seed: 1900 + k + bi * 30 });
            (function (p0, w0, h0) { hatch(g, rectP(p0, by - h0, w0, h0), { ang: 1.57, sp: 2.6, d: function (qx) { return (qx - p0) / w0 > 0.7 ? 0.8 : 0; }, seed: 1905 + k }); })(px, iw, ih);
            shape(g, rectP(px - 2, by - ih - 6, iw + 4, 6), { fill: k % 2 ? 'verm' : 'ink', w: 1.2, seed: 1950 + k + bi * 30 });
            shape(g, rectP(px + 4, by - ih * 0.6, iw - 8, ih * 0.3), { fill: 'ochre', w: 1, seed: 1960 + k + bi * 30 });
          } else if (t === 1) {
            iw = 18; ih = 40 + R() * 10;
            shape(g, [[px, by], [px, by - ih * 0.6], [px + 6, by - ih * 0.72], [px + 6, by - ih], [px + 12, by - ih], [px + 12, by - ih * 0.72], [px + 18, by - ih * 0.6], [px + 18, by]], { h: k % 3 === 0 ? 4 : 2, ang: 1.57, w: 1.6, seed: 1970 + k + bi * 30 });
          } else {
            iw = 0; var nb = 2 + Math.floor(R() * 3);
            for (var b = 0; b < nb; b++) {
              var bw = 8 + R() * 6, bh = 34 + R() * 20, lean = b === nb - 1 ? 0.2 : 0, kind = Math.floor(R() * 4);
              var bp = rotP(rectP(px + iw, by - bh, bw, bh), px + iw + bw, by, lean);
              shape(g, bp, { fill: kind === 0 ? 'verm' : kind === 1 ? 'ochre' : kind === 2 ? 'ink' : 'paper', h: kind === 3 ? 3 : 0, ang: 0.3, w: 1.4, seed: 1990 + b + k * 7 + bi * 50 });
              iw += bw + 1;
            }
            iw += 4;
          }
          px += iw + 6 + R() * 8; k++;
        }
      } else {
        shape(g, rectP(x + 14, by - 26, 40, 26), { h: 1, ang: 0.9, w: 1.6, seed: 1880 });
        stroke(g, [[x + 34, by - 26], [x + 34, by]], 1.4, 1881); stroke(g, [[x + 14, by - 13], [x + 54, by - 13]], 1.4, 1882);
        shape(g, ell(x + 80, by - 10, 16, 10, 18), { fill: 'ochre', h: 1, w: 1.6, seed: 1883 });
      }
      shape(g, rectP(x - 6, by, w + 12, 9), { fill: 'ink', seed: 2100 + bi });
      [x + 16, x + w - 26].forEach(function (bxx, j) { shape(g, [[bxx, by + 9], [bxx + 10, by + 9], [bxx + 10, by + 24]], { fill: 'ink', seed: 2110 + bi * 2 + j }); });
    });
  };

  K.box = function (g, it) {
    var x = it.x, y = it.y, w = it.w, h = it.h, s = it.seed || 1;
    shape(g, rectP(x, y, w, h), { d: function (px, py) { return (py - y) / h * 0.5; }, ang: 0.02, sp: 3.4, w: 2, seed: 2200 + s });
    shape(g, rectP(x, y, w, 8), { h: 3, ang: 0, w: 1.4, seed: 2201 + s });
    shape(g, rectP(x, y + h - 8, w, 8), { h: 3, ang: 0, w: 1.4, seed: 2202 + s });
    shape(g, [[x + 4, y + h - 8], [x + 13, y + h - 8], [x + w - 4, y + 8], [x + w - 13, y + 8]], { fill: 'ochre', w: 1.4, seed: 2203 + s });
    [[x + 5, y + 4], [x + w - 5, y + 4], [x + 5, y + h - 4], [x + w - 5, y + h - 4]].forEach(function (q) { dot(g, q[0], q[1], 1.4); });
  };

  K._unknown = function (g, it) {
    var x = it.x || 0, y = it.y || 0, w = it.w || 40, h = it.h || 40;
    shape(g, rectP(x, y, w, h), { h: 1, ang: 0.8, w: 1.4, seed: 2300 });
  };

  // ---------- объекты ----------
  K.gate = function (g, it) {
    var x = it.x, y = it.y, w = it.w, h = it.h, open = it.state && it.state.open, lx = x + 12, lw = w - 24;
    if (!open) {
      for (var i = 0; i < 5; i++) {
        var px = lx + i * lw / 5, pw = lw / 5 - 2;
        shape(g, [[px, y + 22 - (i === 2 ? 6 : 0)], [px + pw, y + 22 - (i === 2 ? 6 : 0)], [px + pw, y + h - 4], [px, y + h - 4]], { fill: 'ochre', wa: 0.75, d: (function (p0, w0) { return function (qx) { return (qx - p0) / w0 > 0.6 ? 0.7 : 0; }; })(px, pw), ang: 1.57, sp: 2.6, w: 1.6, seed: 2400 + i });
      }
      shape(g, rectP(lx - 2, y + 40, lw + 4, 10), { fill: 'ink', seed: 2410 });
      shape(g, rectP(lx - 2, y + h - 34, lw + 4, 10), { fill: 'ink', seed: 2411 });
      shape(g, [[lx + 4, y + h - 34], [lx + 16, y + h - 34], [lx + lw - 4, y + 50], [lx + lw - 16, y + 50]], { fill: 'ink', seed: 2412 });
      var ring = ell(lx + lw - 14, y + h * 0.55, 6, 6, 12); fillPaper(g, ring); wash(g, ring, VERM, 0.9, 0, 0); outline(g, ring, 1.6, 2413);
    } else {
      var ow = lw * 0.26;
      shape(g, [[lx, y + 18], [lx + ow, y + 30], [lx + ow, y + h + 6], [lx, y + h - 4]], { fill: 'ochre', h: 3, ang: 1.4, w: 1.8, seed: 2420 });
      shape(g, [[lx, y + 38], [lx + ow, y + 50], [lx + ow, y + 59], [lx, y + 48]], { fill: 'ink', seed: 2421 });
      shape(g, [[lx, y + h - 36], [lx + ow, y + h - 26], [lx + ow, y + h - 17], [lx, y + h - 26]], { fill: 'ink', seed: 2422 });
    }
    [[x, 0], [x + w - 14, 1]].forEach(function (p, k) {
      shape(g, rectP(p[0], y, 14, h + 2), { h: 4, ang: 1.57, w: 2, seed: 2430 + k });
      shape(g, [[p[0] - 4, y + 2], [p[0] + 7, y - 10], [p[0] + 18, y + 2]], { fill: 'verm', w: 1.6, seed: 2432 + k });
    });
  };

  K.door = function (g, it) {
    var x = it.x, y = it.y, w = it.w, h = it.h, open = it.state && it.state.open;
    shape(g, rectP(x - 12, y - 14, w + 24, h + 14), { fill: 'ink', seed: 2500 });
    if (open) {
      var o = rectP(x, y, w, h); fillPaper(g, o);
      g.save(); poly(g, o); g.clip();
      g.globalCompositeOperation = 'multiply'; g.fillStyle = 'rgba(207,154,50,0.35)'; g.fillRect(x, y, w, h); g.globalCompositeOperation = 'source-over';
      var r1 = []; for (var xx = x; xx <= x + w; xx += 8) r1.push([xx, y + h * 0.62 + Math.sin(xx * 0.05) * 5]);
      var hp = r1.concat([[x + w, y + h], [x, y + h]]); fillPaper(g, hp); hatch(g, hp, { ang: -0.5, sp: 3.6, d: 0.5, seed: 2501 }); outline(g, r1, 1.8, 2502, true);
      g.restore();
      shape(g, [[x, y], [x + w * 0.22, y + 10], [x + w * 0.22, y + h + 8], [x, y + h]], { h: 4, ang: 1.5, w: 2, seed: 2504 });
      g.beginPath(); for (var a = 0; a < 7; a++) { var f = a / 6; g.moveTo(x + w, y + h); g.lineTo(x + w + 40 + f * 140, y + h + 10 + f * 30); }
      g.lineWidth = 0.8; g.strokeStyle = 'rgba(30,25,21,0.5)'; g.stroke();
    } else {
      var dp = shape(g, rectP(x, y, w, h), { h: 2, ang: 1.5, w: 2, seed: 2510 });
      g.save(); poly(g, dp); g.clip(); for (var i = 1; i < 4; i++) stroke(g, [[x + i * w / 4, y], [x + i * w / 4, y + h]], 1.6, 2511 + i); g.restore();
      shape(g, rectP(x - 2, y + 30, w + 4, 11), { fill: 'ink', seed: 2520 });
      shape(g, rectP(x - 2, y + h - 50, w + 4, 11), { fill: 'ink', seed: 2521 });
      shape(g, [[x + 6, y + h - 50], [x + 20, y + h - 50], [x + w - 6, y + 41], [x + w - 20, y + 41]], { fill: 'ink', seed: 2522 });
      var kn = ell(x + w - 18, y + h * 0.55, 6, 6, 14); fillPaper(g, kn); wash(g, kn, OCHRE, 0.95, 0, 0); outline(g, kn, 1.6, 2523);
    }
  };

  K.lever = function (g, it) {
    var x = it.x, y = it.y, w = it.w, h = it.h, down = it.state && it.state.down;
    var px = x + w / 2, py = y + h - 22, a = down ? 0.95 : -0.35, L = h - 30;
    shape(g, rotP([[px - 3.5, py], [px + 3.5, py], [px + 3, py - L], [px - 3, py - L]], px, py, a), { w: 1.6, seed: 2600, h: 1, ang: a + 1.57 });
    var tip = rotP([[px, py - L]], px, py, a)[0];
    shape(g, ell(tip[0], tip[1], 10, 10, 18), { fill: 'verm', d: function (qx, qy) { return ((qx - tip[0]) + (qy - tip[1])) / 14; }, ang: -0.8, sp: 2.6, w: 1.8, seed: 2601 });
    shape(g, [[x, y + h], [x + 4, y + h - 26], [x + w - 4, y + h - 26], [x + w, y + h]], { h: 4, ang: 0.8, w: 2, seed: 2602 });
    shape(g, rectP(x + w / 2 - 12, y + h - 30, 24, 7), { fill: 'ink', seed: 2603 });
    dot(g, px, py, 3);
  };

  K.machine = function (g, it) {
    var x = it.x, y = it.y, w = it.w, h = it.h, hx = x + 82;
    shape(g, [[hx - 14, y + 6], [hx + 50, y + 6], [hx + 34, y + 52], [hx + 2, y + 52]], { fill: 'ochre', wa: 0.6, d: function (px) { return (px - hx) / 50; }, ang: 1.3, sp: 2.8, w: 2, seed: 2700 });
    shape(g, rectP(hx - 18, y, 72, 9), { fill: 'ink', seed: 2701 });
    var bx = x + 18, by = y + 50, bw = w - 60, bh = h - 72;
    var body = [[bx + 10, by], [bx + bw - 10, by], [bx + bw, by + 10], [bx + bw, by + bh], [bx, by + bh], [bx, by + 10]];
    shape(g, body, { d: function (px, py) { return 0.25 + (px - bx) / bw * 0.5 + (py - by) / bh * 0.2; }, ang: 0.75, sp: 3.2, w: 2.6, seed: 2702 });
    hatch(g, body, { ang: -0.75, sp: 4.4, d: function (px, py) { return (px - bx) / bw * 1.2 - 0.4; }, seed: 2703 });
    shape(g, rectP(bx, by + bh - 20, bw, 20), { fill: 'ink', seed: 2704 });
    [bx + 10, bx + bw - 34].forEach(function (lx, k) { shape(g, [[lx, by + bh], [lx + 24, by + bh], [lx + 28, y + h], [lx - 4, y + h]], { fill: 'ink', seed: 2705 + k }); });
    shape(g, rectP(bx + 18, by + 18, 92, 76), { w: 1.8, seed: 2707 });
    var dial = shape(g, ell(bx + 50, by + 54, 26, 26, 30), { w: 2, seed: 2708 });
    var arc = ell(bx + 50, by + 54, 22, 22, 12, Math.PI * 1.55, Math.PI * 2.2); arc = arc.concat(ell(bx + 50, by + 54, 17, 17, 12, Math.PI * 2.2, Math.PI * 1.55)); wash(g, arc, VERM, 0.85, 0, 0);
    for (var t = 0; t < 9; t++) { var a = Math.PI * (0.8 + t * 0.175); stroke(g, [[bx + 50 + Math.cos(a) * 18, by + 54 + Math.sin(a) * 18], [bx + 50 + Math.cos(a) * 24, by + 54 + Math.sin(a) * 24]], t % 4 === 0 ? 1.8 : 1, 2710 + t); }
    void dial;
    [VERM, OCHRE].forEach(function (c, k) { var b = ell(bx + 92, by + 34 + k * 26, 7, 7, 14); fillPaper(g, b); wash(g, b, c, 0.95, 0, 0); outline(g, b, 1.5, 2720 + k); });
    for (var r = 0; r < 6; r++) { dot(g, bx + 8 + r * (bw - 16) / 5, by + 6, 1.8); dot(g, bx + 8 + r * (bw - 16) / 5, by + bh - 28, 1.8); }
    shape(g, [[bx + bw, by + bh - 70], [bx + bw + 34, by + bh - 52], [bx + bw + 34, by + bh - 40], [bx + bw, by + bh - 46]], { fill: 'ochre', h: 2, ang: 0.4, w: 1.6, seed: 2730 });
    shape(g, ell(bx + bw - 44, by + 44, 10, 10, 16), { fill: 'ink', seed: 2731 });
    shape(g, rectP(bx + bw - 30, by - 22, 14, 24), { h: 3, ang: 1.57, w: 1.6, seed: 2732 });
    shape(g, rectP(bx + bw - 36, by - 28, 26, 7), { fill: 'ink', seed: 2733 });
    shape(g, rectP(bx + 124, by + 84, 52, 16), { fill: 'ochre', w: 1.4, seed: 2734 });
    stroke(g, [[bx + 130, by + 92], [bx + 170, by + 92]], 1.2, 2735);
  };

  // ---------- живые детали ----------
  var LIVE = {};
  LIVE.house = function (ctx, it, t) {
    var x = it.x, y = it.y, w = it.w, h = it.h, chx = x + w * 0.68 + w * 0.045, chy = y + h * 0.05, v = Math.floor(t * 8);
    J.v = v;
    for (var i = 0; i < 4; i++) { // дым — завитки
      var f = ((t * 0.2 + i / 4) % 1), r = 5 + f * 12, sx = chx + Math.sin(f * 5 + i) * 6 + f * 26, sy = chy - 8 - f * 84;
      ctx.globalAlpha = 1 - f;
      var c = ell(sx, sy, r, r * 0.8, 14, 0.4, TAU - 0.6); stroke(ctx, c, 1.3, 3000 + i);
      stroke(ctx, ell(sx + r * 0.2, sy, r * 0.45, r * 0.4, 8, Math.PI, TAU * 0.9), 1, 3010 + i);
      ctx.globalAlpha = 1;
    }
  };
  LIVE.lamp = function (ctx, it, t) {
    if (it.state && it.state.lit === false) return;
    var x = it.x, y = it.y, w = it.w, h = it.h, v = Math.floor(t * 8); J.v = v;
    var R = rng(4000 + v);
    if (it.variant === 'hang') {
      var cx = x + w / 2, ly = y + h * 0.66 + h * 0.2;
      ctx.save(); ctx.globalCompositeOperation = 'multiply';
      var gr = ctx.createRadialGradient(cx, ly, 4, cx, ly + 120, 320); gr.addColorStop(0, 'rgba(207,154,50,0.32)'); gr.addColorStop(1, 'rgba(207,154,50,0)');
      ctx.fillStyle = gr; poly(ctx, [[cx - 30, ly], [cx + 30, ly], [cx + 250, 540], [cx - 250, 540]]); ctx.fill(); ctx.restore();
      ctx.beginPath();
      for (var i = 0; i < 9; i++) { var a = Math.PI * 0.3 + i / 8 * Math.PI * 0.4 + (R() - 0.5) * 0.04, r0 = 22, r1 = 34 + R() * 10 + (i % 2) * 8; ctx.moveTo(cx + Math.cos(a) * r0, ly + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a) * r1, ly + Math.sin(a) * r1); }
      ctx.lineWidth = 1.1; ctx.strokeStyle = INK; ctx.stroke();
      return;
    }
    var px = x + w / 2, gy = y + 29;
    ctx.beginPath();
    for (var k = 0; k < 14; k++) { var a2 = k / 14 * TAU + (R() - 0.5) * 0.05, ra = 24 + R() * 3, rb = ra + 10 + (k % 2) * 9 + R() * 4; ctx.moveTo(px + Math.cos(a2) * ra, gy + Math.sin(a2) * ra); ctx.lineTo(px + Math.cos(a2) * rb, gy + Math.sin(a2) * rb); }
    ctx.lineWidth = 1.1; ctx.strokeStyle = INK; ctx.stroke();
  };
  function gearPts(cx, cy, r, teeth, a0) { var p = [], n = teeth * 4; for (var i = 0; i < n; i++) { var a = a0 + i / n * TAU, rr = (i % 4 < 2) ? r : r * 0.78; p.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); } return p; }
  function liveGear(ctx, cx, cy, r, teeth, a, fill, seed) {
    var p = gearPts(cx, cy, r, teeth, a);
    fillPaper(ctx, p); wash(ctx, p, fill, 0.85, 0, 0);
    hatch(ctx, p, { ang: 0.8, sp: 3, d: function (px, py) { return ((px - cx) + (py - cy)) / (r * 1.6); }, seed: seed, lw: 0.75 });
    outline(ctx, p, 1.8, seed);
    var hub = ell(cx, cy, r * 0.3, r * 0.3, 12); fillInk(ctx, hub);
    dot(ctx, cx, cy, 1);
  }
  LIVE.machine = function (ctx, it, t) {
    var x = it.x, y = it.y, w = it.w, h = it.h, on = it.state && it.state.on, bx = x + 18, by = y + 50, bw = w - 60, tq = Math.floor(t * 8) / 8;
    J.v = Math.floor(t * 8);
    var a = on ? tq * 1.6 : 0;
    liveGear(ctx, bx + bw + 6, by + 96, 30, 10, a, OCHRE, 3100);
    liveGear(ctx, bx + bw - 44, by + 44, 19, 8, -a * 1.55 + 0.2, VERM, 3120);
    var na = on ? -0.5 + Math.sin(tq * 3) * 0.25 : Math.PI * 0.82, cx = bx + 50, cy = by + 54;
    stroke(ctx, [[cx - Math.cos(na) * 4, cy - Math.sin(na) * 4], [cx + Math.cos(na) * 20, cy + Math.sin(na) * 20]], 2, 3130);
    dot(ctx, cx, cy, 3);
    var lx = bx + bw - 23, ly = by - 34, bulb = ell(lx, ly, 7, 7, 14, Math.PI, TAU);
    fillPaper(ctx, bulb); if (on) wash(ctx, bulb, OCHRE, 0.95, 0, 0); else hatch(ctx, bulb, { ang: 0.8, sp: 2.4, seed: 3140 }); outline(ctx, bulb, 1.4, 3141);
    if (on) {
      var R = rng(3150 + J.v); ctx.beginPath();
      for (var k = 0; k < 7; k++) { var aa = Math.PI + k / 6 * Math.PI, r0 = 10, r1 = 16 + R() * 6; ctx.moveTo(lx + Math.cos(aa) * r0, ly + Math.sin(aa) * r0); ctx.lineTo(lx + Math.cos(aa) * r1, ly + Math.sin(aa) * r1); }
      ctx.lineWidth = 1; ctx.strokeStyle = INK; ctx.stroke();
      for (var i = 0; i < 3; i++) { var f = (t * 0.6 + i / 3) % 1, sx = lx + 14 + f * 30, sy = ly - 6 - f * 64, r = 4 + f * 9; ctx.globalAlpha = 1 - f; stroke(ctx, ell(sx, sy, r, r * 0.8, 12, 0.3, TAU - 0.4), 1.2, 3160 + i); ctx.globalAlpha = 1; }
    }
  };
  LIVE.item = function (ctx, it, t) {
    if (it.state && it.state.taken) return;
    var cx = it.x + it.w / 2, cy = it.y + it.h / 2, s = Math.max(it.w, it.h) * 1.25;
    J.v = Math.floor(t * 8);
    stroke(ctx, [[cx - s * 0.45, it.y + it.h + 2], [cx + s * 0.45, it.y + it.h + 1]], 1.2, 3200);
    api.drawIcon(ctx, it.item || 'question', cx, cy - 2, s);
    var k = (t * 0.7) % 1;
    if (k < 0.4) { var r = Math.sin(k / 0.4 * Math.PI) * 7, sx = cx + s * 0.38, sy = cy - s * 0.38; stroke(ctx, [[sx - r, sy], [sx + r, sy]], 1.2, 3210); stroke(ctx, [[sx, sy - r], [sx, sy + r]], 1.2, 3211); }
  };

  function motion(it, t) {
    var s = it.seed || 1;
    switch (it.kind) {
      case 'cloud': return { dx: Math.sin(t * 0.13 + s) * 14, dy: 0, a: 0 };
      case 'tree': return { dx: 0, dy: 0, a: Math.sin(t * 0.9 + s) * 0.005, px: it.x + it.w / 2, py: it.y + it.h };
      case 'plant': return { dx: 0, dy: 0, a: Math.sin(t * 1.3 + s) * 0.02, px: it.x + it.w / 2, py: it.y + it.h };
      default: return null;
    }
  }
  var PAD = { sky: 0, ground: 30, wall: 0, floor: 30, house: 40, tree: 40, door: 60, plant: 30, hill: 30 };
  function itemBox(it) {
    if (it.kind === 'sky') return [0, 0, W, H];
    var p = PAD[it.kind] == null ? 36 : PAD[it.kind], x = it.x || 0, y = it.y || 0, w = it.w || 40, h = it.h || 40;
    if (it.kind === 'house') return [x - p, y - 110, w + 2 * p, h + 110 + p];
    if (it.kind === 'wall' || it.kind === 'floor') return [Math.min(0, x) - 12, y - 12, Math.max(w, W) + 24, h + 24];
    if (it.kind === 'window') return [x - 50, y - 30, w + 100, h + 60];
    if (it.kind === 'machine') return [x - p, y - p, w + 2 * p + 20, h + 2 * p];
    return [x - p, y - p, w + 2 * p, h + 2 * p];
  }
  function drawItem(ctx, it, sc, t) {
    var fn = K[it.kind] || K._unknown, b = itemBox(it), v = boilV(t);
    var s = sprite(sc.mood + '|' + JSON.stringify(it), b[0], b[1], b[2], b[3], v, function (g) { fn(g, it, sc); });
    var m = motion(it, t);
    if (m) { ctx.save(); if (m.a) { ctx.translate(m.px, m.py); ctx.rotate(m.a); ctx.translate(-m.px, -m.py); } ctx.translate(m.dx, m.dy); blit(ctx, s); ctx.restore(); }
    else blit(ctx, s);
    if (LIVE[it.kind]) LIVE[it.kind](ctx, it, t, sc);
  }
  // контактные тени штрихом под тем, что стоит на земле/полу (один спрайт на сцену)
  var SHADOW_KINDS = { house: 1, fence: 1, lamp: 1, tree: 1, rock: 1, box: 1, gate: 1, machine: 1, lever: 1, door: 1, tower: 1 };
  function contactShadows(g, sc) {
    var list = [];
    (sc.layers || []).forEach(function (L) { if ((L.depth || 0) <= 2) L.items.forEach(function (it) { if (SHADOW_KINDS[it.kind]) list.push(it); }); });
    (sc.objects || []).forEach(function (o) { if (SHADOW_KINDS[o.kind]) list.push(o); });
    list.forEach(function (it, i) {
      var x0 = it.x, x1 = it.x + it.w, y = it.y + it.h, d = 12;
      if (it.kind === 'lamp') { x0 = it.x + it.w / 2 - 14; x1 = it.x + it.w / 2 + 14; }
      if (it.kind === 'tree') { x0 = it.x + it.w * 0.5 - 18; x1 = it.x + it.w * 0.5 + 18; }
      if (it.kind === 'house') { x0 += 16; x1 -= 16; d = 16; }
      if (it.kind === 'box' && it.y + it.h < 430) return;
      var p1 = [[x0 - 2, y - 1], [x1 + 2, y - 1], [x1 + d * 0.8, y + d * 0.35], [x0 + d * 0.3, y + d * 0.35]];
      var p2 = [[x0 + d * 0.3, y + d * 0.35], [x1 + d * 0.8, y + d * 0.35], [x1 + d * 1.6, y + d * 0.75], [x0 + d * 0.7, y + d * 0.75]];
      tone(g, p1, 4, 0.05, 7700 + i, 0.8);
      hatch(g, p2, { ang: 0.05, sp: 2.4, seed: 7750 + i, lw: 0.7 });
    });
  }
  function drawObject(ctx, o, sc, t, opts) {
    if (o.kind === 'npc') { if (!opts.npcSeparate) api.drawNpc(ctx, o, 'idle', t); return; }
    if (o.kind === 'item') { LIVE.item(ctx, o, t); return; }
    var fn = K[o.kind] || K._unknown, b = itemBox(o), v = boilV(t);
    var key = 'obj|' + o.kind + '|' + o.x + ',' + o.y + ',' + o.w + ',' + o.h + '|' + JSON.stringify(o.state || {});
    var s = sprite(key, b[0], b[1], b[2], b[3], v, function (g) { fn(g, o, sc); });
    if (o.kind === 'machine' && o.state && o.state.on) {
      var q = Math.floor(t * 16);
      ctx.save(); ctx.translate((q % 3) - 1, (q % 2) - 0.5); blit(ctx, s); LIVE.machine(ctx, o, t); ctx.restore(); return;
    }
    blit(ctx, s);
    if (LIVE[o.kind]) LIVE[o.kind](ctx, o, t, sc);
  }

  // ---------- риг персонажей (общая геометрия с темой «бумага»; анимация 12 к/с) ----------
  // Матрица [a,b,c,d,e,f]; части — полигоны в мировых координатах.
  function M(a, b, c, d, e, f) { return [a, b, c, d, e, f]; }
  function mul(m, n) { return [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]]; }
  function tr(m, x, y) { return mul(m, M(1, 0, 0, 1, x, y)); }
  function ro(m, a) { var c = Math.cos(a), s = Math.sin(a); return mul(m, M(c, s, -s, c, 0, 0)); }
  function ap(m, p) { return p.map(function (q) { return [m[0] * q[0] + m[2] * q[1] + m[4], m[1] * q[0] + m[3] * q[1] + m[5]]; }); }
  function pin(m, x, y) { return ap(m, [[x, y]])[0]; }

  function heroRig(pose, t, hx, hy, dir) {
    var parts = [], pins = [];
    var tq = Math.floor(t * 12) / 12;
    var lean = 0, bob = 0, lb = 0, lf = 0, ab1 = 0.15, ab2 = -0.2, af1 = -0.1, af2 = -0.25, head = 0, braid = 0.5, eye = 'n', mouth = 'n', lamp = 0;
    var blink = (t % 3.7) < 0.12;
    if (pose === 'walk') {
      var p = tq * 11.5, s = Math.sin(p);
      lb = s * 0.5; lf = -s * 0.5; bob = -Math.abs(Math.cos(p)) * 3; ab1 = -s * 0.55; af1 = s * 0.55; ab2 = -0.35; af2 = -0.35;
      lean = 0.05; braid = 0.7 + Math.sin(p * 2) * 0.12; lamp = Math.sin(p) * 0.35; head = Math.sin(p * 2) * 0.03;
    } else if (pose === 'reach') {
      af1 = -2.05; af2 = -0.15; lean = 0.08; lf = -0.25; lb = 0.15; head = -0.08; ab1 = 0.35; braid = 0.65;
    } else if (pose === 'think') {
      af1 = -0.6; af2 = -2.35; head = -0.12 + Math.sin(tq * 1.5) * 0.03; eye = 'up'; ab1 = 0.1; braid = 0.45 + Math.sin(tq * 1.2) * 0.05; mouth = 'o';
    } else if (pose === 'happy') {
      var j = Math.abs(Math.sin(tq * 8)); bob = -j * 12; af1 = -2.7; af2 = -0.3; ab1 = 2.5; ab2 = 0.3; lb = 0.3 * j; lf = -0.3 * j; mouth = 'smile'; eye = 'closed'; braid = 0.5 + j * 0.5;
    } else { // idle
      bob = Math.sin(tq * 2.2) * 0.8; ab1 = 0.12 + Math.sin(tq * 1.1) * 0.04; af1 = -0.08 - Math.sin(tq * 1.1) * 0.04; braid = 0.45 + Math.sin(tq * 1.4) * 0.06; lamp = Math.sin(tq * 1.7) * 0.08;
    }
    if (blink && eye === 'n') eye = 'closed';
    var root = M(dir * 1.16, 0, 0, 1.16, hx, hy);
    var body = tr(root, 0, bob); body = tr(body, 0, -36); body = ro(body, lean); body = tr(body, 0, 36);
    function add(m, pts, role, z, opt) { parts.push({ pts: ap(m, pts), role: role, z: z, o: opt || {} }); }
    function arm(shx, a1, a2, back) {
      var u = ro(tr(body, shx, -82), a1);
      add(u, [[-4.5, -3], [4.5, -3], [4, 17], [-4, 17]], back ? 'shirtB' : 'shirt', back ? 1 : 9);
      var f = ro(tr(u, 0, 16), a2);
      add(f, [[-3.4, -1], [3.4, -1], [3, 13], [-3, 13]], back ? 'skinB' : 'skin', back ? 0.9 : 9.1);
      add(f, ell(0, 15, 4.6, 4.6, 12), back ? 'skinB' : 'skin', back ? 0.95 : 9.2);
      if (!back) pins.push(pin(u, 0, 0), pin(f, 0, 0)); else pins.push(pin(u, 0, 0));
    }
    function leg(hipx, a, back) {
      var l = ro(tr(body, hipx, -36), a);
      add(l, [[-5, -3], [5, -3], [5, 27], [-5, 27]], back ? 'legB' : 'leg', back ? 2 : 6);
      add(l, [[-6, 25], [6, 25], [13, 30], [13, 36], [-7, 36], [-7, 28]], back ? 'bootB' : 'boot', back ? 2.1 : 6.1);
      pins.push(pin(l, 0, 0));
    }
    arm(-4, ab1, ab2, true);
    leg(-5, lb, true);
    // сумка за спиной + ремень
    add(body, [[-30, -60], [-12, -60], [-11, -40], [-31, -40]], 'bag', 3);
    add(body, [[-31, -60], [-11, -60], [-12, -50], [-30, -49]], 'bagFlap', 3.1);
    add(body, [[7, -86], [11, -84], [-14, -50], [-18, -53]], 'strap', 4.6);
    // коса
    var hd = ro(tr(body, 0, -88), head);
    var bm = ro(tr(hd, -13, -24), braid + 0.85);
    for (var k = 0; k < 3; k++) {
      add(bm, ell(0, 4 + k * 7, 5.4 - k * 0.7, 4.8, 12), 'hair', 4 + k * 0.01);
      bm = ro(tr(bm, 0, 6.5), Math.sin(tq * 3 + k) * 0.05 + (pose === 'walk' ? 0.05 : 0));
    }
    add(bm, [[-4, 3], [4, 3], [3, 8], [-3, 8]], 'ribbon', 4.1);
    add(bm, [[-3, 8], [3, 8], [5, 15], [0, 13], [-5, 15]], 'hair', 4.05);
    // туловище
    add(body, [[-12, -86], [11, -86], [14, -80], [16, -40], [-17, -40], [-14, -80]], 'shirt', 5);
    add(body, [[-6, -76], [12, -76], [16, -32], [-11, -32]], 'apron', 5.5);
    add(body, [[2, -58], [13, -58], [13, -47], [2, -47]], 'pocket', 5.6);
    add(body, [[5, -68], [8, -68], [8, -58], [5, -58]], 'wood', 5.55);
    add(body, [[2, -71], [11, -71], [11, -66.5], [2, -66.5]], 'metal', 5.57);
    add(body, [[-17, -45], [16, -45], [16, -40.5], [-17, -40.5]], 'belt', 5.7);
    add(body, [[-3, -92], [3, -92], [3, -84], [-3, -84]], 'skin', 4.9);
    // фонарик на поясе
    var lm = ro(tr(body, 12, -42), lamp);
    add(lm, [[-0.8, 0], [0.8, 0], [0.8, 4], [-0.8, 4]], 'metal', 7);
    add(lm, [[-4.5, 4], [4.5, 4], [3.5, 6], [-3.5, 6]], 'metalD', 7.1);
    add(lm, [[-3.6, 6], [3.6, 6], [4, 15], [-4, 15]], 'glass', 7.2, { glow: true });
    add(lm, [[-4.6, 15], [4.6, 15], [4.6, 17.5], [-4.6, 17.5]], 'metalD', 7.3);
    leg(5, lf, false);
    // голова
    add(hd, ell(2, -17, 16, 16, 28), 'skin', 8);
    var hair = ell(1, -19, 18, 18, 22, Math.PI * 0.62, Math.PI * 1.88);
    hair.push([11, -26], [6, -22], [2, -27], [-3, -21], [-8, -25], [-11, -15], [-9, -6]);
    add(hd, hair, 'hair', 8.1);
    add(hd, ell(8, -9.5, 3.2, 2.4, 10), 'cheek', 8.2, { flat: true });
    add(hd, [[6, -24.5], [13.5, -25], [13.5, -23.4], [6, -22.9]], 'eye', 8.22, { flat: true });
    add(hd, [[16, -19], [21, -15], [16.5, -13.5]], 'skin', 8.25);
    if (eye === 'closed') add(hd, [[7, -18.2], [12, -18.2], [12, -16.8], [7, -16.8]], 'eye', 8.3, { flat: true });
    else { var ey = eye === 'up' ? -20 : -18; add(hd, ell(10, ey, 2.5, 3.2, 10), 'eye', 8.3, { flat: true, hl: true }); }
    if (mouth === 'smile') add(hd, ell(11, -9, 4.5, 3.5, 10, 0, Math.PI), 'mouth', 8.35, { flat: true });
    else if (mouth === 'o') add(hd, ell(12, -8, 1.8, 2, 8), 'mouth', 8.35, { flat: true });
    else add(hd, [[8, -8], [14, -9], [14, -7.8], [8, -6.9]], 'mouth', 8.35, { flat: true });
    pins.push(pin(hd, 0, 0));
    arm(5, af1, af2, false);
    parts.sort(function (a, b) { return a.z - b.z; });
    return { parts: parts, pins: pins, glow: pin(lm, 0, 10.5) };
  }

  function keeperRig(pose, t, fx, fy, dir) {
    var parts = [], pins = [], tq = Math.floor(t * 12) / 12;
    var breath = Math.sin(tq * 1.8) * 0.8, head = Math.sin(tq * 0.7) * 0.02, a1 = 0.1, a2 = -0.6, eye = 'n', broom = Math.sin(tq * 0.9) * 0.03;
    if (pose === 'think') { a1 = -0.75; a2 = -2.2; head = -0.14 + Math.sin(tq * 1.3) * 0.03; eye = 'up'; }
    if ((t % 4.3) < 0.13) eye = 'closed';
    var root = M(dir * 1.1, 0, 0, 1.1, fx, fy), body = tr(root, 0, breath * 0.3);
    function add(m, pts, role, z, opt) { parts.push({ pts: ap(m, pts), role: role, z: z, o: opt || {} }); }
    // метла (в дальней руке)
    var bm = ro(tr(body, -20, -70), broom);
    add(bm, [[-1.8, -46], [1.8, -46], [1.8, 62], [-1.8, 62]], 'wood', 0.5);
    add(bm, [[-4, 58], [4, 58], [12, 74], [-12, 74]], 'straw', 0.6);
    add(bm, [[-4, 56], [4, 56], [4, 61], [-4, 61]], 'band', 0.65);
    add(body, [[-26, -84], [-16, -84], [-17, -62], [-24, -62]], 'coatB', 0.7);
    add(body, ell(-21, -64, 4.5, 4.5, 10), 'skinB', 0.8);
    // ноги и сапоги
    add(body, [[-11, -30], [-2, -30], [-2, -6], [-11, -6]], 'trous', 1);
    add(body, [[2, -30], [11, -30], [11, -6], [2, -6]], 'trous', 1.1);
    add(body, [[-12, -8], [-1, -8], [4, -2], [4, 0], [-13, 0]], 'boot', 1.2);
    add(body, [[1, -8], [12, -8], [17, -2], [17, 0], [0, 0]], 'boot', 1.3);
    // пальто
    add(tr(body, 0, -breath * 0.4), [[-15, -96], [15, -96], [19, -84], [23, -24], [-23, -24], [-19, -84]], 'coat', 2);
    add(body, [[-23, -30], [23, -30], [23, -24], [-23, -24]], 'coatD', 2.1);
    add(body, [[-2, -94], [6, -94], [8, -26], [0, -26]], 'coatD', 2.2);
    [-80, -62, -44].forEach(function (yy) { pins.push(pin(body, 10, yy)); });
    // голова
    var hd = ro(tr(body, 0, -96), head);
    add(hd, ell(0, -14, 13, 14, 24), 'skin', 3);
    add(hd, [[-12, -14], [12, -14], [16, 2], [6, 24], [0, 36], [-6, 22], [-14, 4]], 'beard', 3.2);
    add(hd, [[0, -7], [14, -8], [18, -3], [8, -2], [0, -4]], 'beard', 3.3);
    add(hd, ell(13, -11, 5, 4.4, 12), 'nose', 3.4);
    add(hd, [[2, -20], [14, -22], [15, -18], [3, -16]], 'beard', 3.35);
    if (eye === 'closed') add(hd, [[7, -16], [12, -16], [12, -15], [7, -15]], 'eye', 3.5, { flat: true });
    else add(hd, ell(9, eye === 'up' ? -17.5 : -15.5, 1.8, 2.2, 8), 'eye', 3.5, { flat: true, hl: true });
    add(hd, [[-26, -24], [26, -24], [24, -19], [-24, -19]], 'hat', 3.6);
    add(hd, [[-13, -42], [11, -42], [14, -24], [-15, -24]], 'hat', 3.7);
    add(hd, [[-14.5, -30], [13.5, -30], [14, -25], [-15, -25]], 'band', 3.75);
    pins.push(pin(hd, 0, 0));
    // ближняя рука
    var u = ro(tr(body, 8, -88), a1);
    add(u, [[-5, -3], [5, -3], [4.5, 22], [-4.5, 22]], 'coat', 4);
    var f = ro(tr(u, 0, 21), a2);
    add(f, [[-4, -1], [4, -1], [3.6, 16], [-3.6, 16]], 'coat', 4.1);
    add(f, ell(0, 19, 5, 5, 12), 'skin', 4.2);
    pins.push(pin(u, 0, 0), pin(f, 0, 0));
    parts.sort(function (a, b) { return a.z - b.z; });
    return { parts: parts, pins: pins };
  }
  function catRig(pose, t, fx, fy, dir) {
    var parts = [], pins = [], tq = Math.floor(t * 12) / 12;
    var tail = Math.sin(tq * 1.6) * 0.18, head = Math.sin(tq * 0.8) * 0.04, eye = (t % 5.1) < 0.14 ? 'closed' : 'n';
    if (pose === 'think') { head = -0.2 + Math.sin(tq * 2) * 0.04; tail = Math.sin(tq * 3.4) * 0.3; eye = eye === 'closed' ? eye : 'up'; }
    var root = M(dir * 1.3, 0, 0, 1.3, fx, fy);
    function add(m, pts, role, z, opt) { parts.push({ pts: ap(m, pts), role: role, z: z, o: opt || {} }); }
    // хвост: поднят вверх и закручен
    var tm = ro(tr(root, -14, -4), tail);
    var c1 = [], c2 = [];
    for (var i = 0; i <= 10; i++) {
      var f = i / 10, a = -2.2 + f * 2.6, r = 6 + f * 12, cx = -10 + f * 2, cy = -12 - f * 22;
      var px = cx + Math.cos(a) * r * 0.4 - f * 6, py = cy;
      var w = 3.6 - f * 1.2;
      c1.push([px - w, py]); c2.push([px + w, py]);
    }
    add(tm, c1.concat(c2.reverse()), 'fur', 0);
    add(tm, [[c1[10][0], c1[10][1]], [c1[10][0] + 4, c1[10][1] - 5], [c1[10][0] + 9, c1[10][1] - 2], [c1[10][0] + 7, c1[10][1] + 2]], 'stripe', 0.1);
    // тело-«груша»
    add(root, [[-18, 0], [-20, -12], [-16, -26], [-8, -34], [6, -35], [13, -27], [16, -12], [15, 0]], 'fur', 1);
    add(root, [[-17, -14], [-9, -18], [-8, -14], [-16, -10]], 'stripe', 1.1);
    add(root, [[-18, -5], [-9, -8], [-8, -4], [-17, -2]], 'stripe', 1.1);
    add(root, [[-12, -26], [-5, -29], [-4, -25], [-11, -22]], 'stripe', 1.1);
    add(root, [[1, -31], [10, -25], [11, -4], [2, -2], [-2, -16]], 'chest', 1.2);
    add(root, ell(1, -2.5, 5.2, 3.2, 10), 'chest', 1.3);
    add(root, ell(11, -2.5, 5.2, 3.2, 10), 'chest', 1.3);
    // голова
    var hd = ro(tr(root, 3, -34), head);
    add(hd, [[-12, -6], [-11, -24], [-2, -14]], 'fur', 2);
    add(hd, [[12, -6], [12, -24], [3, -14]], 'fur', 2);
    add(hd, [[-9, -10], [-9.5, -19], [-5, -13]], 'pink', 2.05, { flat: true });
    add(hd, [[9, -10], [10, -19], [5, -13]], 'pink', 2.05, { flat: true });
    add(hd, ell(0, -8, 13.5, 11, 24), 'fur', 2.1);
    add(hd, [[-3.5, -18], [-1, -12], [1, -12], [3.5, -18], [0, -15]], 'stripe', 2.15, { flat: true });
    add(hd, [[-7, -2], [-3, -6], [3, -6], [7, -2], [3, 2], [-3, 2]], 'chest', 2.2);
    add(hd, [[-2, -5.2], [2, -5.2], [0, -3]], 'nose', 2.3, { flat: true });
    if (eye === 'closed') { add(hd, [[-8.5, -10], [-3, -9.5], [-3, -8.6], [-8.5, -9]], 'pupil', 2.4, { flat: true }); add(hd, [[3, -9.5], [8.5, -10], [8.5, -9], [3, -8.6]], 'pupil', 2.4, { flat: true }); }
    else {
      var ey = eye === 'up' ? -11.5 : -9.5;
      add(hd, ell(-5.5, ey, 3.4, 3.8, 12), 'eyeY', 2.4, { flat: true }); add(hd, ell(5.5, ey, 3.4, 3.8, 12), 'eyeY', 2.4, { flat: true });
      add(hd, ell(-5.2, ey, 1, 3.2, 8), 'pupil', 2.5, { flat: true }); add(hd, ell(5.8, ey, 1, 3.2, 8), 'pupil', 2.5, { flat: true });
    }
    pins.push(pin(tm, 0, 0));
    parts.sort(function (a, b) { return a.z - b.z; });
    return { parts: parts, pins: pins, whisk: [pin(hd, -5, -3), pin(hd, 5, -3)] };
  }

  // стиль частей персонажей: fill paper|ink|verm|ochre, h — уровень штриховки, ang — угол
  var HERO_INK = { shirt: { fill: 'verm', h: 1, ang: 1.1 }, shirtB: { fill: 'verm', h: 3, ang: 1.1 }, skin: {}, skinB: { h: 2 }, leg: { fill: 'ink' }, legB: { fill: 'ink' }, boot: { fill: 'ink' }, bootB: { fill: 'ink' },
    bag: { h: 3, ang: -0.8 }, bagFlap: { fill: 'ochre', h: 1, ang: 0.4 }, strap: { fill: 'ink' }, hair: { fill: 'ink' }, ribbon: { fill: 'ochre' }, apron: { h: 2, ang: -1.0 }, pocket: { h: 4 }, wood: { fill: 'ochre' },
    metal: { h: 2 }, metalD: { fill: 'ink' }, belt: { fill: 'ink' }, glass: { fill: 'ochre' }, cheek: { flat: 'rgba(198,61,38,0.4)' }, eye: { flat: INK }, mouth: { flat: INK } };
  var KEEPER_INK = { wood: { fill: 'ochre' }, straw: { fill: 'ochre', h: 1, ang: 1.57 }, band: { fill: 'verm' }, coat: { h: 4, ang: 0.9 }, coatB: { fill: 'ink' }, coatD: { fill: 'ink' }, skin: {}, skinB: { h: 2 },
    trous: { fill: 'ink' }, boot: { fill: 'ink' }, beard: { curls: true }, nose: { fill: 'verm', wa: 0.45 }, eye: { flat: INK }, hat: { h: 3, ang: 0.3 } };
  var CAT_INK = { fur: { fill: 'ochre', h: 1, ang: 0.9 }, stripe: { fill: 'ink' }, chest: {}, pink: { flat: 'rgba(198,61,38,0.6)' }, nose: { flat: INK }, eyeY: { flat: '#d9a83f' }, pupil: { flat: INK } };

  function drawRigInk(ctx, rig, styles, t, seed) {
    J.v = Math.floor(t * 8);
    for (var i = 0; i < rig.parts.length; i++) {
      var p = rig.parts[i], st = styles[p.role] || {}, sd = seed + i * 17;
      if (st.flat) { poly(ctx, p.pts); ctx.fillStyle = st.flat; ctx.fill(); continue; }
      var pts = jit(p.pts, 0.5, sd);
      if (st.fill === 'ink') { fillInk(ctx, pts); continue; }
      fillPaper(ctx, pts);
      if (st.fill === 'verm' || st.fill === 'ochre') wash(ctx, pts, st.fill === 'verm' ? VERM : OCHRE, st.wa || 0.9, 1, 0.8);
      if (st.h) tone(ctx, pts, st.h, st.ang, sd, 0.75);
      if (st.curls) { var b = bbox(pts); for (var c = 0; c < 6; c++) { var cx = b[0] + b[2] * (0.25 + (c % 2) * 0.4), cy = b[1] + b[3] * (0.2 + c * 0.12); stroke(ctx, ell(cx, cy, 3, 2.5, 6, 0.3, Math.PI * 1.4), 0.9, sd + c); } }
      outline(ctx, pts, 1.5, sd);
    }
  }

  function gearD(cx, cy, r1, r2, n) {
    var d = '', m = n * 4;
    for (var i = 0; i < m; i++) { var a = i / m * TAU - Math.PI / 2, r = (i % 4 < 2) ? r1 : r2; d += (i ? 'L' : 'M') + (cx + Math.cos(a) * r).toFixed(1) + ' ' + (cy + Math.sin(a) * r).toFixed(1); }
    return d + 'Z';
  }
  function circD(cx, cy, r) { return 'M' + (cx - r) + ' ' + cy + 'a' + r + ' ' + r + ' 0 1 0 ' + 2 * r + ' 0a' + r + ' ' + r + ' 0 1 0 ' + (-2 * r) + ' 0Z'; }
  function starD(cx, cy, r1, r2, n) {
    var d = ''; for (var i = 0; i < n * 2; i++) { var a = i / (n * 2) * TAU - Math.PI / 2, r = i % 2 ? r2 : r1; d += (i ? 'L' : 'M') + (cx + Math.cos(a) * r).toFixed(1) + ' ' + (cy + Math.sin(a) * r).toFixed(1); }
    return d + 'Z';
  }
  // роли: m — основной, a — акцент, d — тёмная деталь, l — светлая, g — зелень, k — толстая линия, s — тонкая линия
  var ICONS = {
    key: [['a', circD(30, 50, 19) + circD(30, 50, 8)], ['a', 'M46 45H90V55H86V67H77V55H71V63H62V55H46Z']],
    gear: [['m', gearD(50, 50, 40, 31, 9) + circD(50, 50, 12)]],
    cup: [['m', 'M70 40C88 38 90 64 70 64V56C80 56 80 46 70 47Z'], ['m', 'M22 34H72V58C72 72 62 80 47 80C32 80 22 72 22 58Z'], ['a', 'M12 82H82L75 90H19Z'], ['l', 'M30 42H64V48H30Z'], ['s', 'M38 26C33 20 43 16 38 9M52 26C47 20 57 16 52 9']],
    star: [['a', starD(50, 52, 42, 18, 5)]],
    bird: [['m', 'M8 44L28 52C32 38 48 32 62 34C74 35 82 43 82 50C82 66 64 74 46 72C34 71 24 64 22 58Z'], ['a', 'M80 44L94 49L80 54Z'], ['l', 'M36 54C44 44 58 46 62 56C52 61 42 61 36 54Z'], ['d', circD(68, 45, 3.5)]],
    note: [['m', 'M27 76C25 66 36 60 46 62C49 63 51 64 52 66V18H60C62 28 74 32 76 44C70 38 64 36 60 36V70C60 80 48 86 38 84C32 83 28 80 27 76Z']],
    door: [['m', 'M24 90V36C24 20 36 12 50 12C64 12 76 20 76 36V90Z'], ['k', 'M37 22V88M50 14V88M63 22V88', 3], ['a', circD(66, 56, 5)]],
    lamp: [['k', 'M40 18C40 6 60 6 60 18', 5], ['d', 'M34 26H66L58 17H42Z'], ['a', 'M35 26H65L68 70H32Z'], ['k', 'M50 26V70', 3], ['d', 'M28 70H72V80H28Z']],
    fish: [['m', 'M12 50C24 30 56 28 72 50C56 72 24 70 12 50Z'], ['a', 'M70 50L92 32V68Z'], ['l', 'M40 40C46 46 46 54 40 60', 0], ['d', circD(26, 47, 3.5)], ['s', 'M40 38C47 45 47 55 40 62']],
    flower: [['g', 'M47 58H53V94H47Z'], ['g', 'M50 80C40 70 28 72 24 78C32 84 42 84 50 80Z'], ['a', circD(50, 22, 13) + circD(68, 36, 13) + circD(61, 56, 13) + circD(39, 56, 13) + circD(32, 36, 13)], ['m', circD(50, 41, 11)]],
    heart: [['a', 'M50 86C20 64 10 46 16 32C22 18 42 16 50 32C58 16 78 18 84 32C90 46 80 64 50 86Z'], ['l', 'M26 34C28 28 34 26 38 28C34 30 30 34 28 38Z']],
    eye: [['l', 'M8 50C24 24 76 24 92 50C76 76 24 76 8 50Z'], ['m', circD(50, 50, 17)], ['d', circD(50, 50, 7)], ['l', circD(44, 44, 3.5)]],
    hand: [['m', 'M30 88V56L21 43C18 37 25 32 30 37L36 44V22C36 14 46 14 46 22V44V16C46 8 56 8 56 16V44V20C56 12 66 12 66 20V48V30C66 22 76 22 76 30V62C76 78 66 88 52 88Z']],
    question: [['k', 'M33 36C33 18 67 16 67 36C67 50 50 50 50 64', 9], ['a', circD(50, 80, 7)]],
    arrow: [['a', 'M10 42H56V24L90 50L56 76V58H10Z']],
    sun: [['a', starD(50, 50, 44, 30, 12)], ['m', circD(50, 50, 25)]],
    moon: [['m', 'M62 10C36 14 20 38 26 62C32 84 58 94 78 82C56 80 40 64 42 44C44 28 54 18 62 10Z']],
    gate: [['d', 'M14 18H24V90H14ZM76 18H86V90H76Z'], ['m', 'M26 30H74V84H26Z'], ['k', 'M26 42H74M26 72H74M28 82L72 34', 4]],
    lever: [['k', 'M48 80L70 26', 7], ['a', circD(70, 24, 10)], ['d', 'M22 76H78L84 90H16Z']],
    cat: [['m', 'M28 90C20 72 24 52 34 44L32 18L46 32H58L72 18L70 44C80 52 82 72 74 90Z'], ['l', circD(42, 46, 4) + circD(62, 46, 4)], ['k', 'M74 84C92 78 94 60 84 52', 6]],
    bulb: [['a', 'M50 8C30 8 20 24 22 38C24 50 34 56 36 66H64C66 56 76 50 78 38C80 24 70 8 50 8Z'], ['d', 'M36 70H64V78H36ZM40 82H60V90H40Z'], ['l', 'M36 30C38 22 44 18 50 18C46 22 42 26 40 34Z']],
    pointer: [['l', 'M14 6L14 74L32 58L44 86L56 80L44 54L68 52Z']]
  };

  var ICON_ST = { m: 'paperH', a: 'verm', d: 'ink', l: 'paper', g: 'paperH' };
  var ICON_ACC = { key: { a: 'ochre' }, gear: { m: 'ochre' }, lamp: { a: 'ochre' }, sun: { a: 'ochre', m: 'ochre' }, star: { a: 'ochre' }, bulb: { a: 'ochre' }, flower: { m: 'ochre' }, cat: { m: 'ochre' }, gate: { m: 'ochre' }, cup: { a: 'verm' }, door: { m: 'paperH', a: 'ochre' } };
  function iconSprite(id, size, v) {
    var pad = size * 0.2;
    return sprite('icon|' + id + '|' + Math.round(size), -size / 2 - pad, -size / 2 - pad, size + pad * 2, size + pad * 2, v, function (g) {
      var k = size / 100, defs = ICONS[id] || ICONS.question, acc = ICON_ACC[id] || {}, R = rng(id.length * 31 + v * 7);
      g.save(); g.translate(-size / 2, -size / 2); g.scale(k, k);
      g.translate(50, 50); g.rotate((R() - 0.5) * 0.04); g.translate(-50 + (R() - 0.5) * 1.5, -50 + (R() - 0.5) * 1.5);
      var lw = Math.max(1.3 / k, 4.2);
      defs.forEach(function (e, i) {
        var role = e[0], p = new Path2D(e[1]);
        if (role === 'k' || role === 's') { g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = INK; g.lineWidth = role === 'k' ? (e[2] || 4) * 1.15 : lw * 0.7; g.stroke(p); return; }
        var st = acc[role] || ICON_ST[role];
        g.save(); g.clip(p, 'evenodd');
        g.fillStyle = pats(g).paper; g.fillRect(0, 0, 100, 100);
        if (st === 'ink') { g.fillStyle = INK; g.fillRect(0, 0, 100, 100); }
        else if (st === 'verm' || st === 'ochre') { g.globalCompositeOperation = 'multiply'; g.fillStyle = st === 'verm' ? VERM : OCHRE; g.translate(2.5, 2); g.fill(p, 'evenodd'); g.globalCompositeOperation = 'source-over'; g.setTransform(g.getTransform()); }
        if (st === 'paperH' || st === 'verm' || st === 'ochre') {
          g.beginPath(); var sp = st === 'paperH' ? 7 : 9;
          for (var c = -100; c < 200; c += sp) { g.moveTo(c + (R() - 0.5) * 2, 100); g.lineTo(c + 100 + (R() - 0.5) * 2, 0); }
          g.lineWidth = Math.max(0.7 / k, 1.6); g.strokeStyle = INK; g.globalAlpha = st === 'paperH' ? 0.75 : 0.45; g.stroke(); g.globalAlpha = 1;
        }
        g.restore();
        g.lineWidth = lw; g.lineJoin = 'round'; g.strokeStyle = INK; g.stroke(p);
      });
      g.restore();
    });
  }

  // персонажи меняются 8 раз в секунду (шаг «кипения») — рисуем в offscreen один раз на шаг
  var FIG = {};
  function figure(ctx, id, key, x, y, bx, by, bw, bh, draw) {
    var r = RES.r, e = FIG[id] || (FIG[id] = { c: document.createElement('canvas'), key: null }), k = key + '@' + r;
    if (e.key !== k) {
      e.c.width = Math.ceil(bw * r); e.c.height = Math.ceil(bh * r);
      var g = e.c.getContext('2d'); g.setTransform(r, 0, 0, r, -bx * r, -by * r); g.lineJoin = 'round'; g.lineCap = 'round';
      draw(g); e.key = k;
    }
    ctx.drawImage(e.c, x + bx, y + by, bw, bh);
  }

  // ---------- рамка-клише ----------
  function frame(g) {
    var o = 7, i2 = 15;
    var outer = rectP(o, o, W - 2 * o, H - 2 * o), inner = rectP(i2, i2, W - 2 * i2, H - 2 * i2);
    g.save(); g.beginPath(); g.rect(-20, -20, W + 40, H + 40); g.moveTo(inner[0][0], inner[0][1]); for (var q = 1; q < 4; q++) g.lineTo(inner[q][0], inner[q][1]); g.closePath(); g.clip('evenodd');
    g.fillStyle = pats(g).paper; g.fillRect(-20, -20, W + 40, H + 40);
    g.beginPath(); for (var x = o; x < W - o; x += 6) { g.moveTo(x, o); g.lineTo(x + 8, i2); g.moveTo(x, H - i2); g.lineTo(x + 8, H - o); }
    for (var y = o; y < H - o; y += 6) { g.moveTo(o, y); g.lineTo(i2, y + 8); g.moveTo(W - i2, y); g.lineTo(W - o, y + 8); }
    g.lineWidth = 0.9; g.strokeStyle = INK; g.stroke();
    g.restore();
    g.fillStyle = INK; g.fillRect(0, 0, W, 4); g.fillRect(0, H - 4, W, 4); g.fillRect(0, 0, 4, H); g.fillRect(W - 4, 0, 4, H);
    outline(g, outer.concat([outer[0]]), 2.4, 9001, true);
    outline(g, inner.concat([inner[0]]), 1.8, 9002, true);
    [[i2, i2], [W - i2, i2], [W - i2, H - i2], [i2, H - i2]].forEach(function (c, k) { // угловые розетки
      var r = ell(c[0], c[1], 13, 13, 24); fillPaper(g, r); wash(g, r, k % 2 ? OCHRE : VERM, 0.9, 0, 0); outline(g, r, 1.8, 9010 + k);
      for (var a = 0; a < 4; a++) { var an = a / 4 * TAU + Math.PI / 4; stroke(g, [[c[0] + Math.cos(an) * 4, c[1] + Math.sin(an) * 4], [c[0] + Math.cos(an) * 10, c[1] + Math.sin(an) * 10]], 1.4, 9020 + k * 4 + a); }
      dot(g, c[0], c[1], 2.4);
    });
    [[W / 2, o + 4], [W / 2, H - o - 4]].forEach(function (c, k) { var d = [[c[0] - 12, c[1]], [c[0], c[1] - 6], [c[0] + 12, c[1]], [c[0], c[1] + 6]]; fillPaper(g, d); wash(g, d, VERM, 0.9, 0, 0); outline(g, d, 1.4, 9040 + k); });
  }

  // ---------- API ----------
  var api = {
    id: 'ink',
    name: { ru: 'Тушь', en: 'Ink' },

    drawScene: function (ctx, sc, t, opts) {
      opts = opts || {};
      RES.r = Math.max(1, Math.round((opts.pixelRatio || 1) * 4) / 4);
      var pass = opts.pass || 'all', layers = (sc.layers || []).slice().sort(function (a, b) { return (a.depth || 0) - (b.depth || 0); });
      if (pass !== 'front') {
        ctx.fillStyle = IVORY; ctx.fillRect(0, 0, W, H);
        layers.forEach(function (L) { if ((L.depth || 0) <= 2) L.items.forEach(function (it) { drawItem(ctx, it, sc, t); }); });
        blit(ctx, sprite('shadows|' + sc.id, 0, 0, W, H, boilV(t), function (g) { contactShadows(g, sc); }));
        (sc.objects || []).forEach(function (o) { drawObject(ctx, o, sc, t, opts); });
      }
      if (pass !== 'back') layers.forEach(function (L) { if ((L.depth || 0) > 2) L.items.forEach(function (it) { drawItem(ctx, it, sc, t); }); });
    },

    drawHero: function (ctx, hero, pose, t) {
      var dir = hero.dir < 0 ? -1 : 1, step = Math.floor(t * 8), ts = step / 8;
      pose = pose || 'idle';
      figure(ctx, 'hero', pose + '|' + step + '|' + dir, hero.x, hero.y, -70, -180, 140, 196, function (g) {
        J.v = step;
        hatch(g, ell(0, 1, 22, 4.5, 16), { ang: 0, sp: 1.8, seed: 4400, lw: 0.8 });
        var rig = heroRig(pose, ts, 0, 0, dir);
        drawRigInk(g, rig, HERO_INK, ts, 4500);
        var gl = rig.glow, R = rng(4600 + step); g.beginPath();
        for (var k = 0; k < 8; k++) { var a = k / 8 * TAU, r0 = 9, r1 = 13 + R() * 4; g.moveTo(gl[0] + Math.cos(a) * r0, gl[1] + Math.sin(a) * r0); g.lineTo(gl[0] + Math.cos(a) * r1, gl[1] + Math.sin(a) * r1); }
        g.lineWidth = 0.9; g.strokeStyle = INK; g.stroke();
        rig.pins.forEach(function (p) { dot(g, p[0], p[1], 1.1); });
      });
    },

    drawNpc: function (ctx, npc, pose, t) {
      var fx = npc.x + npc.w / 2, fy = npc.y + npc.h, step = Math.floor(t * 8), ts = step / 8, key = (npc.id || npc.npc) + '|' + pose + '|' + step;
      if (npc.npc === 'cat') {
        figure(ctx, 'npc:' + (npc.id || 'cat'), key, fx, fy, -60, -110, 120, 124, function (g) {
          J.v = step;
          var rig = catRig(pose, ts, 0, -2, npc.dir || 1);
          drawRigInk(g, rig, CAT_INK, ts, 4800);
          rig.whisk.forEach(function (w, k) { var s = k ? 1 : -1; for (var i = -1; i <= 1; i++) stroke(g, [[w[0], w[1]], [w[0] + s * 13, w[1] + i * 3]], 0.7, 4900 + k * 3 + i); });
        });
        return;
      }
      if (npc.npc === 'keeper' || !npc.npc) {
        figure(ctx, 'npc:' + (npc.id || 'keeper'), key, fx, fy, -80, -190, 160, 206, function (g) {
          J.v = step;
          hatch(g, ell(0, 1, 28, 5, 16), { ang: 0, sp: 1.8, seed: 4950, lw: 0.8 });
          drawRigInk(g, keeperRig(pose, ts, 0, 0, npc.dir || -1), KEEPER_INK, ts, 5000);
        });
        return;
      }
      J.v = step;
      shape(ctx, rectP(npc.x, npc.y, npc.w, npc.h), { h: 1, seed: 5100 });
    },

    drawThought: function (ctx, x, y, icons, t) {
      icons = icons && icons.length ? icons : ['question'];
      J.v = Math.floor(t * 8);
      var n = icons.length, cw = 30 + n * 50, ch = 58, below = y < 170;
      var cx = Math.max(cw / 2 + 34, Math.min(W - cw / 2 - 34, x + (below ? 70 : 40))), cy = below ? y + 96 : y - 84;
      cy = Math.max(ch / 2 + 82, cy);
      var k = Math.min(1, Math.max(0, t / 0.4)), ux = k < 1 ? 0.15 + 0.85 * (1 - Math.pow(1 - k, 3)) : 1;
      // нить-завиток от головы к свитку
      var sx = x + 4, sy = below ? y + 6 : y - 4, ex = cx - cw * 0.25 * ux, ey = cy + (below ? -ch / 2 : ch / 2);
      var path = [];
      for (var i = 0; i <= 24; i++) { var f = i / 24, px = sx + (ex - sx) * f, py = sy + (ey - sy) * f; var loop = Math.sin(f * Math.PI) * 10; path.push([px + Math.sin(f * TAU * 1.5) * loop, py + Math.cos(f * TAU * 1.5) * loop * 0.5]); }
      var cut2 = Math.floor(path.length * Math.min(1, t / 0.25));
      if (cut2 > 1) stroke(ctx, path.slice(0, cut2), 1.4, 5200);
      var oy = cy + Math.sin(t * 1.3) * 1.5, hw = cw / 2, hh = ch / 2;
      function T(p) { return p.map(function (q) { return [cx + q[0] * ux, oy + q[1]]; }); }
      [-1, 1].forEach(function (s) { // свёрнутые концы свитка (позади)
        var ex2 = s * hw, curl = [[ex2, -hh + 6], [ex2 + s * 18, -hh + 14], [ex2 + s * 14, hh + 6], [ex2, hh - 2]];
        shape(ctx, T(curl), { h: 3, ang: 0.9 * s, w: 1.6, seed: 5210 + s, jit: 0.4 });
        shape(ctx, T(ell(ex2 + s * 16, hh + 4, 5, 8, 14)), { fill: 'verm', w: 1.4, seed: 5220 + s, jit: 0.3 });
      });
      var band = [];
      for (var bx = -hw; bx <= hw; bx += 8) band.push([bx, -hh + Math.sin(bx * 0.04) * 2.5]);
      for (var bx2 = hw; bx2 >= -hw; bx2 -= 8) band.push([bx2, hh + Math.sin(bx2 * 0.04 + 1) * 2.5]);
      var bp = jit(T(band), 0.5, 5230); fillPaper(ctx, bp);
      hatch(ctx, bp, { ang: 0, sp: 3, d: function (px, py) { return ((py - oy) / hh) * 0.9 - 0.45; }, seed: 5231, lw: 0.6 });
      outline(ctx, bp, 2, 5232);
      stroke(ctx, T(band.slice(0, Math.floor(band.length / 2)).map(function (q) { return [q[0], q[1] + 5]; })), 0.8, 5233);
      for (var j = 0; j < n; j++) {
        var ix = cx + (-cw / 2 + 40 + j * 50) * ux, pop = Math.min(1, Math.max(0, (t - 0.25 - j * 0.12) / 0.15));
        if (pop > 0 && ux > 0.95) api.drawIcon(ctx, icons[j], ix, oy, 38 * (0.7 + 0.3 * pop));
      }
    },

    drawIcon: function (ctx, id, x, y, size) {
      size = size || 32;
      var v = Math.floor((typeof performance !== 'undefined' ? performance.now() / 1000 : 0) * 8) % BOIL;
      var s = iconSprite(ICONS[id] ? id : 'question', size, v);
      ctx.drawImage(s.c, x + s.x, y + s.y, s.w, s.h);
    },

    drawCursor: function (ctx, kind, x, y) {
      var map = { use: 'gear', take: 'hand', go: 'arrow', look: 'eye' }, id = map[kind];
      if (!id) { api.drawIcon(ctx, 'pointer', x + 12, y + 14, 32); return; }
      J.v = Math.floor(performance.now() / 125);
      stroke(ctx, [[x - 5, y], [x + 5, y]], 1.4, 5300); stroke(ctx, [[x, y - 5], [x, y + 5]], 1.4, 5301);
      api.drawIcon(ctx, id, x + 16 - (kind === 'go' ? 8 : 0), y + 16, 34);
    },

    drawUI: function (ctx, st, t) {
      var v = boilV(t), slots = st.slots || [], hb = st.hintBtn;
      blit(ctx, sprite('frame', -4, -4, W + 8, H + 8, v, frame));
      if (slots.length) {
        var s0 = slots[0], s1 = slots[slots.length - 1];
        blit(ctx, sprite('ui|' + slots.length + '|' + s0.x + ',' + s0.y, s0.x - 40, s0.y - 20, s1.x + s1.w - s0.x + 80, s0.h + 40, v, function (g) {
          var strip = rectP(s0.x - 16, s0.y - 6, s1.x + s1.w - s0.x + 32, s0.h + 12);
          shape(g, strip, { h: 3, ang: 0.8, w: 2.2, seed: 8000 });
          slots.forEach(function (sl, i) {
            var p = rectP(sl.x + 2, sl.y + 2, sl.w - 4, sl.h - 4); shape(g, p, { w: 1.8, seed: 8010 + i });
            stroke(g, rectP(sl.x + 6, sl.y + 6, sl.w - 12, sl.h - 12).concat([[sl.x + 6, sl.y + 6]]), 0.7, 8020 + i);
          });
          [[s0.x - 16, s0.y + s0.h / 2], [s1.x + s1.w + 16, s1.y + s1.h / 2]].forEach(function (c, k) { var d = [[c[0] - 10, c[1]], [c[0], c[1] - 12], [c[0] + 10, c[1]], [c[0], c[1] + 12]]; shape(g, d, { fill: 'verm', w: 1.6, seed: 8030 + k }); });
        }));
        (st.inventory || []).forEach(function (id, i) { var sl = slots[i]; if (sl) api.drawIcon(ctx, id, sl.x + sl.w / 2, sl.y + sl.h / 2, sl.w * 0.7); });
      }
      if (hb) {
        var hov = st.hover === 'hint', cx = hb.x + hb.w / 2, cy = hb.y + hb.h / 2;
        blit(ctx, sprite('hint|' + hov + '|' + hb.x, hb.x - 12, hb.y - 12, hb.w + 24, hb.h + 24, v, function (g) {
          var R = rng(8100), seal = [];
          for (var i = 0; i < 36; i++) { var a = i / 36 * TAU, r = hb.w / 2 + (R() - 0.5) * 2.4; seal.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
          fillPaper(g, seal); wash(g, seal, VERM, hov ? 1 : 0.9, 0, 0);
          if (hov) hatch(g, seal, { ang: 0.8, sp: 3, seed: 8101, lw: 0.7 });
          var inner = ell(cx, cy, hb.w / 2 - 7, hb.h / 2 - 7, 28); fillPaper(g, inner); outline(g, inner, 1.4, 8102); outline(g, seal, 2, 8103);
        }));
        api.drawIcon(ctx, 'bulb', cx, cy, hb.w * 0.56);
      }
    }
  };

  window.KvestTheme = api;
})();
