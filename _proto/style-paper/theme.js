/*
 * Тема оформления «КВЕСТ»: «бумага» (аппликация из вырезанной цветной бумаги).
 * Реализует API темы из kvest-contract: drawScene, drawHero, drawNpc, drawThought, drawIcon, drawCursor, drawUI.
 * Файл самодостаточен (копируется в kvest/js/themes/paper.js).
 *
 * Приёмы: плоские вырезки с неровным краем (ножницы — мелкие грани, рваный край — белая «сердцевина»),
 * мягкая тень между слоями, процедурная фактура бумаги (шум + волокна) в offscreen-канве,
 * скотч и нитяные швы как детали. Статика каждого элемента сцены кэшируется спрайтом
 * (ключ — kind+данные+настроение+масштаб), в кадре только drawImage + живые детали
 * (дым, свет, шестерни). Герой — марионетка из вырезок на латунных шпильках, анимация «стоп-моушн» 12 к/с.
 *
 * opts.pass: 'back' (фон, слои 0..2, объекты) | 'front' (слой 3) | 'all' (по умолчанию).
 * opts.npcSeparate: true — объекты kind:'npc' не рисуются в drawScene (их рисует drawNpc).
 * drawThought(ctx, x, y, icons, t): x,y — точка у головы; t — секунды с появления мысли (или общее время).
 */
(function () {
  'use strict';
  var W = 960, H = 540, TAU = Math.PI * 2;

  // ---------- утилиты ----------
  function rng(seed) {
    var a = (seed * 2654435761) >>> 0 || 1;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hex(c) { var n = parseInt(c.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function mix(c, k, f) { // k: '#000' / '#fff' или любой hex; f 0..1
    var a = hex(c), b = hex(k);
    return 'rgb(' + Math.round(a[0] + (b[0] - a[0]) * f) + ',' + Math.round(a[1] + (b[1] - a[1]) * f) + ',' + Math.round(a[2] + (b[2] - a[2]) * f) + ')';
  }
  function dark(c, f) { return mix(c, '#2a160c', f); }
  function light(c, f) { return mix(c, '#fff8e8', f); }

  function poly(g, p) {
    g.beginPath(); g.moveTo(p[0][0], p[0][1]);
    for (var i = 1; i < p.length; i++) g.lineTo(p[i][0], p[i][1]);
    g.closePath();
  }
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
  function rotP(p, cx, cy, a) {
    var c = Math.cos(a), s = Math.sin(a);
    return p.map(function (q) { var x = q[0] - cx, y = q[1] - cy; return [cx + x * c - y * s, cy + x * s + y * c]; });
  }
  function bbox(p) {
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (var i = 0; i < p.length; i++) { var q = p[i]; if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1]; }
    return [x0, y0, x1 - x0, y1 - y0];
  }
  // неровный край: подразбиение + смещение по нормали
  function wob(pts, seed, amp, step) {
    var R = rng(seed), out = [], n = pts.length, ph = R() * TAU, acc = 0;
    for (var i = 0; i < n; i++) {
      var a = pts[i], b = pts[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
      var m = Math.max(1, Math.ceil(L / step)), nx = -dy / L, ny = dx / L;
      for (var j = 0; j < m; j++) {
        var f = j / m; acc += L / m;
        var o = (R() - 0.5) * 2 * amp * 0.6 + Math.sin(acc * 0.045 + ph) * amp * 0.5;
        if (j === 0) o *= 0.4;
        out.push([a[0] + dx * f + nx * o, a[1] + dy * f + ny * o]);
      }
    }
    return out;
  }

  // ---------- фактура бумаги (один раз, offscreen) ----------
  var TEX = null;
  function tex() {
    if (TEX) return TEX;
    var n = 256, c = document.createElement('canvas'); c.width = c.height = n;
    var g = c.getContext('2d'), id = g.createImageData(n, n), R = rng(99);
    function grid(sz) {
      var a = []; for (var i = 0; i < sz * sz; i++) a.push(R());
      return function (x, y) {
        x = x / n * sz; y = y / n * sz;
        var x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
        fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
        var x1 = (x0 + 1) % sz, y1 = (y0 + 1) % sz; x0 %= sz; y0 %= sz;
        var v0 = a[y0 * sz + x0] * (1 - fx) + a[y0 * sz + x1] * fx, v1 = a[y1 * sz + x0] * (1 - fx) + a[y1 * sz + x1] * fx;
        return v0 * (1 - fy) + v1 * fy;
      };
    }
    var g1 = grid(6), g2 = grid(24), g3 = grid(64);
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) {
      var v = 128 + (g1(x, y) - 0.5) * 26 + (g2(x, y) - 0.5) * 16 + (g3(x, y) - 0.5) * 12 + (R() - 0.5) * 14;
      var k = (y * n + x) * 4; id.data[k] = id.data[k + 1] = id.data[k + 2] = v; id.data[k + 3] = 255;
    }
    g.putImageData(id, 0, 0);
    // волокна
    g.lineCap = 'round';
    for (var f = 0; f < 340; f++) {
      var x0 = R() * n, y0 = R() * n, len = 4 + R() * 14, a = R() * TAU, bend = (R() - 0.5) * 8;
      var lightF = f % 3 !== 0;
      g.strokeStyle = lightF ? 'rgba(255,255,255,0.32)' : 'rgba(40,25,10,0.22)';
      g.lineWidth = 0.4 + R() * 0.6;
      for (var ox = -1; ox <= 1; ox++) for (var oy = -1; oy <= 1; oy++) {
        var sx = x0 + ox * n, sy = y0 + oy * n;
        g.beginPath(); g.moveTo(sx, sy);
        g.quadraticCurveTo(sx + Math.cos(a) * len / 2 - Math.sin(a) * bend, sy + Math.sin(a) * len / 2 + Math.cos(a) * bend, sx + Math.cos(a) * len, sy + Math.sin(a) * len);
        g.stroke();
      }
    }
    TEX = c; return c;
  }
  var PATS = new WeakMap();
  function patFor(g) { var p = PATS.get(g); if (!p) { p = g.createPattern(tex(), 'repeat'); PATS.set(g, p); } return p; }
  function applyTex(g, pts, alpha, seed) {
    var R = rng(seed + 7), b = bbox(pts);
    g.save(); poly(g, pts); g.clip();
    g.globalCompositeOperation = 'overlay'; g.globalAlpha = alpha;
    var p = patFor(g);
    if (p.setTransform) p.setTransform(new DOMMatrix([1, 0, 0, 1, R() * 256, R() * 256]));
    g.fillStyle = p; g.fillRect(b[0] - 2, b[1] - 2, b[2] + 4, b[3] + 4);
    g.restore();
  }

  // ---------- вырезка ----------
  // o: lift (тень), sx/sy (направление тени), torn (рваный край с белой сердцевиной), amp/step (край),
  //    live (без blur — для живых частей), raw (не искажать край), tex/texA, edge
  function cut(g, pts, color, o) {
    o = o || {};
    var seed = o.seed || 1, lift = o.lift == null ? 3 : o.lift;
    var base = o.raw ? pts : wob(pts, seed, o.amp == null ? 0.7 : o.amp, o.step || 9);
    if (lift > 0) {
      g.save();
      g.translate((o.sx == null ? 0.45 : o.sx) * lift, (o.sy == null ? 0.9 : o.sy) * lift);
      poly(g, base);
      g.fillStyle = 'rgba(48,26,12,' + (o.sh || 0.32) + ')';
      if (!o.live) g.filter = 'blur(' + Math.max(1, lift * 0.75).toFixed(1) + 'px)';
      g.fill(); g.restore();
    }
    if (o.torn) {
      var rim = wob(pts, seed + 31, o.tornAmp || 2.3, 3);
      poly(g, rim); g.fillStyle = o.rim || '#f6eedb'; g.fill();
    }
    poly(g, base); g.fillStyle = color; g.fill();
    if (o.tex !== false) applyTex(g, base, o.texA || 0.6, seed);
    if (o.edge !== false) { poly(g, base); g.lineWidth = 0.6; g.strokeStyle = 'rgba(255,246,226,0.3)'; g.stroke(); }
    return base;
  }
  function brad(g, x, y, r) { // латунная шпилька
    g.beginPath(); g.arc(x + 0.6, y + 0.9, r, 0, TAU); g.fillStyle = 'rgba(40,20,8,0.35)'; g.fill();
    var gr = g.createRadialGradient(x - r * 0.35, y - r * 0.35, 0.2, x, y, r);
    gr.addColorStop(0, '#fbe9a8'); gr.addColorStop(0.5, '#c9a24a'); gr.addColorStop(1, '#7d5f22');
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = gr; g.fill();
  }
  function tape(g, x, y, w, h, a, seed) { // полоска скотча
    var R = rng(seed || 3), p = [];
    var zig = function (x0, y0, x1, y1) { for (var i = 0; i <= 5; i++) { var f = i / 5; p.push([x0 + (x1 - x0) * f + (i % 2 ? 1.6 : -1.6) * (R() + 0.3), y0 + (y1 - y0) * f]); } };
    p.push([-w / 2, -h / 2], [w / 2, -h / 2]); zig(w / 2, -h / 2, w / 2, h / 2);
    p.push([-w / 2, h / 2]); var q = []; zig(-w / 2, h / 2, -w / 2, -h / 2);
    p = rotP(p, 0, 0, a).map(function (v) { return [v[0] + x, v[1] + y]; });
    poly(g, p); g.fillStyle = 'rgba(244,236,206,0.62)'; g.fill();
    g.save(); poly(g, p); g.clip(); g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(x - w, y - h, w * 2, h * 0.8); g.restore();
    poly(g, p); g.lineWidth = 0.6; g.strokeStyle = 'rgba(160,140,100,0.35)'; g.stroke();
  }
  function stitch(g, pts, color, lw) { // нитяной шов (штрихами)
    g.save(); g.setLineDash([5, 4]); g.lineCap = 'round'; g.lineWidth = lw || 1.4;
    g.strokeStyle = 'rgba(40,20,8,0.25)'; g.beginPath();
    pts.forEach(function (q, i) { if (i) g.lineTo(q[0] + 0.6, q[1] + 1); else g.moveTo(q[0] + 0.6, q[1] + 1); }); g.stroke();
    g.strokeStyle = color; g.beginPath();
    pts.forEach(function (q, i) { if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); }); g.stroke();
    g.restore();
  }

  // ---------- палитры настроений ----------
  var MOODS = {
    dawn: { bands: ['#8fa4a3', '#b8b4a1', '#dcb69c', '#ecc9a1', '#f4dcb2'], bandY: [0, 96, 168, 222, 262], sun: '#e9ae49', halo: '#f6dca2',
      hillFar: '#b2ad80', hillNear: '#848f50', field1: '#cdb874', field2: '#a2a86d', grass: '#6f7e3f', earth: '#a97e4f', glow: '255,190,105', amb: 0 },
    day: { bands: ['#9fbdbb', '#b9cfc2', '#d6dcc6', '#e7e3cc'], bandY: [0, 120, 200, 260], sun: '#efc461', halo: '#f6e6b4',
      hillFar: '#a9b07c', hillNear: '#7f8f4b', field1: '#cfc078', field2: '#9fae6c', grass: '#6d813f', earth: '#ad8553', glow: '255,220,150', amb: 0 },
    dusk: { bands: ['#5c6680', '#8b7486', '#c78d7c', '#e4ab80', '#efc993'], bandY: [0, 90, 160, 215, 255], sun: '#e3854a', halo: '#f0b98a',
      hillFar: '#8c7f73', hillNear: '#5d6447', field1: '#a98a62', field2: '#7f7b5a', grass: '#4f5b35', earth: '#7f5d40', glow: '255,170,95', amb: 0.12 },
    night: { bands: ['#232c42', '#2b3650', '#36425c', '#414c64'], bandY: [0, 110, 190, 250], sun: null, halo: null,
      hillFar: '#3f4a52', hillNear: '#2f3a35', field1: '#4a5248', field2: '#3c463d', grass: '#2b3a2a', earth: '#3f3428', glow: '255,200,120', amb: 0.35 },
    indoor: { bands: ['#4a3426'], bandY: [0], sun: null, halo: null,
      hillFar: '#a2a27a', hillNear: '#7c874c', field1: '#c3b06e', field2: '#9a9f66', grass: '#6a7a3c', earth: '#8a6544', glow: '255,186,100', amb: 0.2 },
    cave: { bands: ['#2c2622', '#352d27'], bandY: [0, 200], sun: null, halo: null,
      hillFar: '#4a423a', hillNear: '#3a332d', field1: '#4c443b', field2: '#423a32', grass: '#3a3a2c', earth: '#3c3128', glow: '255,180,100', amb: 0.4 }
  };
  function pal(sc) { return MOODS[sc && sc.mood] || MOODS.dawn; }

  var C = {
    cream: '#f2e5c7', paper: '#f7efdc', kraft: '#c49a64', kraftD: '#9a7046', brown: '#6b4630', dbrown: '#4a3024', ink: '#33241b',
    rust: '#b3533a', rustD: '#8e3c2b', terra: '#cf7a4f', mustard: '#dca543', mustardL: '#f1c96a', sage: '#a7a878', olive: '#7c8650',
    oliveD: '#56603b', oliveDD: '#3e4830', teal: '#4f7472', tealD: '#3b5756', skin: '#efc8a0', pink: '#df9a86', iron: '#3f3832'
  };

  // ---------- кэш спрайтов ----------
  var RES = { r: 1 }, cache = new Map();
  function sprite(key, bx, by, bw, bh, draw) {
    var r = RES.r, k = key + '@' + r, s = cache.get(k);
    if (s) return s;
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(bw * r)); c.height = Math.max(1, Math.ceil(bh * r));
    var g = c.getContext('2d');
    g.setTransform(c.width / bw, 0, 0, c.height / bh, -bx * c.width / bw, -by * c.height / bh);
    g.lineJoin = 'round';
    draw(g);
    s = { c: c, x: bx, y: by, w: bw, h: bh };
    cache.set(k, s);
    if (cache.size > 500) cache.delete(cache.keys().next().value);
    return s;
  }
  function blit(ctx, s) { ctx.drawImage(s.c, s.x, s.y, s.w, s.h); }

  // ---------- элементы окружения (статичные спрайты) ----------
  var K = {};

  K.sky = function (g, it, sc) {
    var P = pal(sc);
    for (var i = 0; i < P.bands.length; i++) {
      var y0 = P.bandY[i], R = rng(11 + i), ph = R() * 6, top = [];
      if (i === 0) top = [[-20, -20], [980, -20]];
      else for (var x = -20; x <= 980; x += 20) top.push([x, y0 + Math.sin(x * 0.011 + ph) * 7 + Math.sin(x * 0.031 + ph * 2) * 3]);
      var pts = top.concat([[980, 560], [-20, 560]]);
      cut(g, pts, P.bands[i], { seed: 40 + i, torn: i > 0, lift: i ? 5 : 0, sx: 0, sy: -0.5, sh: 0.16, texA: 0.5, tornAmp: 2 });
      if (i === P.bands.length - 3 && P.sun) {
        cut(g, ell(600, 262, 74, 74, 44), P.halo, { seed: 51, torn: true, lift: 4, sx: 0, sy: 0, sh: 0.12 });
        cut(g, ell(600, 262, 46, 46, 40), P.sun, { seed: 52, lift: 3, sx: 0, sy: 0.4, sh: 0.2, amp: 0.9 });
      }
    }
    if (sc.mood === 'night') {
      var Rs = rng(5);
      for (var s = 0; s < 40; s++) { g.fillStyle = 'rgba(245,235,200,' + (0.4 + Rs() * 0.5) + ')'; g.fillRect(Rs() * 960, Rs() * 260, 1.6, 1.6); }
    }
    if (sc.mood === 'dawn' || sc.mood === 'day' || sc.mood === 'dusk') { // две вырезанные птички
      [[250, 190, 1], [282, 176, 0.7]].forEach(function (b, k) {
        var x = b[0], y = b[1], s = b[2];
        var p = [[x - 12 * s, y - 3 * s], [x - 5 * s, y - 1 * s], [x, y + 3 * s], [x + 5 * s, y - 1 * s], [x + 12 * s, y - 4 * s], [x + 5 * s, y + 2 * s], [x, y + 6 * s], [x - 5 * s, y + 2 * s]];
        cut(g, p, '#5b4a3e', { seed: 60 + k, lift: 1.5, raw: true });
      });
    }
  };

  K.moon = function (g, it) {
    var r = it.w / 2, cx = it.x + r, cy = it.y + r;
    cut(g, ell(cx, cy, r, r, 36), '#f5ebd2', { seed: it.seed || 2, lift: 3, sh: 0.18, amp: 0.8 });
    cut(g, ell(cx - r * 0.3, cy - r * 0.15, r * 0.22, r * 0.2, 16), '#e7d8b6', { seed: 3, lift: 0.8, sh: 0.12 });
    cut(g, ell(cx + r * 0.25, cy + r * 0.3, r * 0.14, r * 0.13, 14), '#e7d8b6', { seed: 4, lift: 0.8, sh: 0.12 });
  };

  function cloudPts(x, y, w, h, seed) {
    var R = rng(seed), n = 3 + Math.floor(R() * 2), bumps = [], bot = y + h * 0.86;
    for (var i = 0; i < n; i++) {
      var f = (i + 0.5) / n, r = h * (0.32 + R() * 0.32) * (i === 1 || i === 2 ? 1.25 : 1);
      bumps.push([x + w * (0.08 + f * 0.84), bot - r * 0.35, Math.min(r, w * 0.32)]);
    }
    var top = [];
    for (var xx = x; xx <= x + w; xx += 4) {
      var yy = bot;
      bumps.forEach(function (b) { var d = xx - b[0]; if (Math.abs(d) < b[2]) yy = Math.min(yy, b[1] - Math.sqrt(b[2] * b[2] - d * d)); });
      top.push([xx, yy]);
    }
    return top.concat([[x + w, bot], [x, bot]]);
  }
  K.cloud = function (g, it, sc) {
    var back = sc.mood === 'dawn' ? '#ecc4a6' : sc.mood === 'dusk' ? '#c99288' : '#e4dccb';
    cut(g, cloudPts(it.x - it.w * 0.06, it.y - it.h * 0.14, it.w * 0.92, it.h, (it.seed || 1) + 5), back, { seed: it.seed + 8, torn: true, lift: 3, sh: 0.14, sx: 0.3, sy: 0.6 });
    cut(g, cloudPts(it.x, it.y, it.w, it.h, it.seed || 1), '#f7ecd6', { seed: it.seed + 2, torn: true, lift: 4, sh: 0.18, sx: 0.3, sy: 0.7 });
  };

  K.hill = function (g, it, sc) {
    var P = pal(sc), R = rng(it.seed || 1), tone = it.tone || 0, x = it.x, y = it.y, w = it.w, h = it.h;
    var amp = tone ? 18 : 30, ph1 = R() * 6, ph2 = R() * 6, top = [];
    for (var xx = x; xx <= x + w + 1; xx += 16) top.push([xx, y + amp * (1 + Math.sin(xx * 0.0062 + ph1)) * 0.55 + amp * 0.35 * Math.sin(xx * 0.019 + ph2)]);
    var pts = top.concat([[x + w, y + h + 30], [x, y + h + 30]]);
    var base = cut(g, pts, tone ? P.hillNear : P.hillFar, { seed: (it.seed || 1) + 100, torn: true, lift: 6, sx: 0, sy: -0.35, sh: 0.22 });
    g.save(); poly(g, base); g.clip();
    var rimL = top.map(function (q) { return [q[0], q[1] - 4]; }), rimB = top.map(function (q, k) { return [q[0], q[1] + 7 + Math.sin(k * 1.7) * 3]; }).reverse();
    cut(g, rimL.concat(rimB), light(tone ? P.hillNear : P.hillFar, 0.3), { seed: (it.seed || 1) + 140, lift: 0, amp: 1.4, step: 5 });
    if (!tone) { // лоскутные поля
      for (var i = 0; i < 4; i++) {
        var fy = y + 46 + i * 22 + R() * 8, fx = x + 60 + R() * (w - 360), fw = 140 + R() * 220;
        var f = [[fx, fy], [fx + fw, fy - 8], [fx + fw + 20, fy + 14], [fx + 10, fy + 20]];
        cut(g, f, i % 2 ? P.field1 : P.field2, { seed: 200 + i, lift: 2, sh: 0.2 });
        stitch(g, [[fx + 8, fy + 8], [fx + fw + 4, fy + 1]], 'rgba(250,240,215,0.55)', 0.9);
      }
    } else { // тропинка и живая изгородь
      var path = [];
      for (var k = 0; k <= 12; k++) { var f2 = k / 12; path.push([x + 520 + Math.sin(f2 * 3 + 1) * 70 - f2 * 40 + f2 * f2 * 40, y + 30 + f2 * (h - 30)]); }
      var left = path.map(function (q, k2) { return [q[0] - 4 - k2 * 2.2, q[1]]; }), right = path.map(function (q, k2) { return [q[0] + 4 + k2 * 2.2, q[1]]; }).reverse();
      cut(g, left.concat(right), light(P.earth, 0.35), { seed: 300, lift: 2, sh: 0.18 });
      for (var j = 0; j < 14; j++) {
        var hx = x + 80 + j * 30 + R() * 8, hy = y + 48 + Math.sin(j * 0.6) * 10;
        if (hx > x + 470 && hx < x + 640) continue;
        cut(g, ell(hx, hy, 14 + R() * 5, 11 + R() * 3, 18), dark(P.hillNear, 0.25), { seed: 320 + j, lift: 2, amp: 1.2, sh: 0.25 });
      }
    }
    g.restore();
    if (!tone) { // деревца на гребне
      for (var t2 = 0; t2 < 9; t2++) {
        var idx = Math.floor(3 + (t2 + R() * 0.8) / 9 * (top.length - 6)), q = top[idx], s = 1.1 + R() * 0.7;
        cut(g, [[q[0] - 1.5, q[1] + 4], [q[0] + 1.5, q[1] + 4], [q[0] + 1.2, q[1] - 10 * s], [q[0] - 1.2, q[1] - 10 * s]], '#6b5440', { seed: 400 + t2, lift: 1, raw: true });
        if (t2 % 2) cut(g, [[q[0], q[1] - 30 * s], [q[0] + 8 * s, q[1] - 6 * s], [q[0] - 8 * s, q[1] - 6 * s]], '#6f7a50', { seed: 410 + t2, lift: 2, sh: 0.2 });
        else cut(g, ell(q[0], q[1] - 15 * s, 9 * s, 10 * s, 16), '#7f8a5b', { seed: 420 + t2, lift: 2, amp: 0.9, sh: 0.2 });
      }
    }
  };

  K.ground = function (g, it, sc) {
    var P = pal(sc), x = it.x, y = it.y, w = it.w, h = it.h, R = rng(it.seed || 1);
    var top = [];
    for (var xx = x - 10; xx <= x + w + 10; xx += 20) top.push([xx, y + Math.sin(xx * 0.02) * 2]);
    cut(g, top.concat([[x + w + 10, y + h + 10], [x - 10, y + h + 10]]), P.earth, { seed: 500, lift: 5, sx: 0, sy: -0.6, sh: 0.25 });
    // полоса травы с рваным краем
    var gt = [];
    for (var x2 = x - 10; x2 <= x + w + 10; x2 += 12) gt.push([x2, y - 6 + Math.sin(x2 * 0.05) * 2 - (R() * 5)]);
    var gb = [];
    for (var x3 = x + w + 10; x3 >= x - 10; x3 -= 24) gb.push([x3, y + 12 + R() * 6]);
    cut(g, gt.concat(gb), P.grass, { seed: 510, torn: true, lift: 3, sh: 0.3, rim: '#e8e0bf' });
    stitch(g, gt.map(function (q) { return [q[0], q[1] + 10]; }), 'rgba(246,236,205,0.5)', 1);
    // тёмная полоса земли у края кадра
    var ft = [];
    for (var x4 = x - 10; x4 <= x + w + 10; x4 += 16) ft.push([x4, y + h - 26 + Math.sin(x4 * 0.03) * 4 + R() * 3]);
    cut(g, ft.concat([[x + w + 10, y + h + 10], [x - 10, y + h + 10]]), dark(P.earth, 0.28), { seed: 515, torn: true, lift: 4, sx: 0, sy: -0.6, rim: '#d9c49c', tornAmp: 1.8 });
    // плоские камни дорожки
    for (var i = 0; i < 9; i++) {
      var sx = x + 40 + i * 110 + R() * 40, sy = y + 40 + R() * 30, rx = 18 + R() * 12;
      cut(g, ell(sx, sy, rx, rx * 0.42, 14), i % 2 ? '#cdbd99' : '#c1ae88', { seed: 520 + i, lift: 2, amp: 1.1, sh: 0.25 });
    }
    // травинки
    for (var j = 0; j < 26; j++) {
      var bx = x + R() * w, by = y + 20 + R() * (h - 30), bh2 = 6 + R() * 6;
      cut(g, [[bx - 3, by], [bx - 1, by - bh2], [bx + 1, by - bh2 * 0.4], [bx + 3, by - bh2 * 0.9], [bx + 4, by]], dark(P.grass, 0.1), { seed: 560 + j, lift: 1, raw: true, sh: 0.2 });
    }
  };

  K.house = function (g, it, sc) {
    var x = it.x, y = it.y, w = it.w, h = it.h, R = rng(it.seed || 7), st = it.state || {};
    var roofY = y + h * 0.42, wallX0 = x + 20, wallX1 = x + w - 20;
    // труба
    var chx = x + w * 0.68;
    cut(g, rectP(chx, y + h * 0.06, w * 0.09, h * 0.3), C.rustD, { seed: 601, lift: 3 });
    cut(g, rectP(chx - 4, y + h * 0.05, w * 0.09 + 8, 9), C.dbrown, { seed: 602, lift: 2 });
    // стены
    cut(g, rectP(wallX0, roofY - 6, wallX1 - wallX0, y + h - roofY + 6), '#d8b37b', { seed: 603, lift: 6, sh: 0.3 });
    // фахверк
    var beam = C.brown;
    cut(g, rectP(wallX0, roofY + 2, 12, y + h - roofY - 2), beam, { seed: 604, lift: 1.5 });
    cut(g, rectP(wallX1 - 12, roofY + 2, 12, y + h - roofY - 2), beam, { seed: 605, lift: 1.5 });
    cut(g, rectP(wallX0, y + h * 0.6, wallX1 - wallX0, 9), beam, { seed: 606, lift: 1.5 });
    cut(g, [[wallX0 + 12, y + h * 0.6 + 9], [wallX0 + 20, y + h * 0.6 + 9], [x + w * 0.5, y + h - 2], [x + w * 0.5 - 8, y + h - 2]], beam, { seed: 607, lift: 1.5 });
    // фундамент
    for (var f = 0; f < 7; f++) cut(g, rectP(wallX0 - 4 + f * (wallX1 - wallX0 + 8) / 7, y + h - 12, (wallX1 - wallX0 + 8) / 7 - 2, 13), f % 2 ? '#a99a80' : '#b8a98c', { seed: 610 + f, lift: 1.5 });
    // окно с ящиком цветов
    var wx = x + w * 0.2, wy = y + h * 0.48, ww = w * 0.26, wh = h * 0.2;
    cut(g, rectP(wx - 6, wy - 6, ww + 12, wh + 12), C.dbrown, { seed: 620, lift: 2.5 });
    cut(g, rectP(wx, wy, ww, wh), st.windowLit ? '#f3c866' : '#4c5c5d', { seed: 621, lift: 0, amp: 0.4 });
    if (st.windowLit) { g.save(); poly(g, rectP(wx, wy, ww, wh)); g.clip(); var gr = g.createRadialGradient(wx + ww / 2, wy + wh * 0.6, 2, wx + ww / 2, wy + wh / 2, ww * 0.7); gr.addColorStop(0, 'rgba(255,240,190,0.9)'); gr.addColorStop(1, 'rgba(230,150,60,0)'); g.fillStyle = gr; g.fillRect(wx, wy, ww, wh); g.restore(); }
    cut(g, rectP(wx + ww / 2 - 3, wy, 6, wh), C.dbrown, { seed: 622, lift: 1.2, raw: true });
    cut(g, rectP(wx, wy + wh / 2 - 3, ww, 6), C.dbrown, { seed: 623, lift: 1.2, raw: true });
    cut(g, rectP(wx - 10, wy + wh + 6, ww + 20, 14), C.terra, { seed: 624, lift: 2.5 });
    for (var fl = 0; fl < 5; fl++) {
      var fx = wx - 2 + fl * (ww + 4) / 4;
      cut(g, ell(fx, wy + wh + 2, 6, 6, 10), fl % 2 ? C.rust : C.mustard, { seed: 630 + fl, lift: 1.5, amp: 0.8 });
      brad(g, fx, wy + wh + 2, 1.6);
    }
    // дверь с аркой
    var dx = x + w * 0.6, dy = y + h * 0.64, dw = w * 0.21, dh = y + h - dy - 2;
    var arch = [[dx, dy + dh]].concat(ell(dx + dw / 2, dy + dw / 2, dw / 2, dw / 2, 14, Math.PI, TAU)).concat([[dx + dw, dy + dh]]);
    cut(g, arch.map(function (q) { return [q[0] + (q[0] - dx - dw / 2) * 0.14, q[1] - 5]; }), C.dbrown, { seed: 640, lift: 2.5 });
    var door = cut(g, arch, '#80553a', { seed: 641, lift: 1.5 });
    g.save(); poly(g, door); g.clip(); g.strokeStyle = 'rgba(40,20,10,0.35)'; g.lineWidth = 1;
    for (var pl = 1; pl < 4; pl++) { g.beginPath(); g.moveTo(dx + dw * pl / 4, dy); g.lineTo(dx + dw * pl / 4, dy + dh); g.stroke(); }
    g.restore();
    brad(g, dx + dw * 0.78, dy + dh * 0.55, 3);
    // вывеска мастерской: круг с шестернёй на скотче
    var sx = dx + dw / 2, sy = dy - 26;
    cut(g, ell(sx, sy, 17, 17, 26), C.cream, { seed: 650, lift: 3 });
    g.save(); g.translate(sx, sy); g.scale(0.26, 0.26); g.translate(-50, -50); g.fillStyle = C.rustD; g.fill(P2('gear'), 'evenodd'); g.restore();
    tape(g, sx, sy - 17, 22, 8, -0.15, 651);
    // крыша — ряды «черепицы» из полосок с фестонами
    var rx0 = x - 8, rx1 = x + w + 8, apx = x + w * 0.5;
    var roof = [[apx, y], [rx1, roofY], [rx0, roofY]];
    var rbase = cut(g, roof, C.rustD, { seed: 660, lift: 6, sh: 0.32 });
    g.save(); poly(g, rbase); g.clip();
    for (var row = 0; row < 7; row++) {
      var ry = y + 14 + row * (roofY - y - 10) / 6.4, strip = [[rx0 - 10, ry - 16]], sc2 = 20;
      strip.push([rx1 + 10, ry - 16]);
      for (var s2 = rx1 + 10; s2 >= rx0 - 10; s2 -= sc2) {
        for (var a = 0; a <= 6; a++) { var an = a / 6 * Math.PI; strip.push([s2 - sc2 / 2 + Math.cos(an) * sc2 / 2, ry + Math.sin(an) * 8]); }
      }
      cut(g, strip, row % 2 ? C.rust : mix(C.rust, C.terra, 0.35), { seed: 670 + row, lift: 2.2, sh: 0.32, raw: true });
    }
    g.restore();
    cut(g, [[apx, y - 4], [rx1 + 6, roofY + 2], [rx1 - 6, roofY + 4], [apx, y + 10], [rx0 + 6, roofY + 4], [rx0 - 6, roofY + 2]], C.dbrown, { seed: 690, lift: 2 });
  };

  K.tower = function (g, it) {
    var x = it.x, y = it.y, w = it.w, h = it.h;
    cut(g, rectP(x + w * 0.15, y + h * 0.2, w * 0.7, h * 0.8), '#c9a878', { seed: 700, lift: 5 });
    cut(g, [[x + w / 2, y], [x + w, y + h * 0.22], [x, y + h * 0.22]], C.rust, { seed: 701, lift: 4 });
    for (var i = 0; i < 3; i++) cut(g, [[x + w * 0.4, y + h * (0.35 + i * 0.2)]].concat(ell(x + w * 0.5, y + h * (0.35 + i * 0.2), w * 0.1, w * 0.1, 10, Math.PI, TAU)).concat([[x + w * 0.6, y + h * (0.43 + i * 0.2)], [x + w * 0.4, y + h * (0.43 + i * 0.2)]]), C.dbrown, { seed: 702 + i, lift: 1.5 });
  };

  K.tree = function (g, it) {
    var x = it.x, y = it.y, w = it.w, h = it.h, R = rng(it.seed || 4), cx = x + w * 0.5;
    var trunk = [[cx - 14, y + h], [cx + 16, y + h], [cx + 8, y + h * 0.55], [cx + 34, y + h * 0.38], [cx + 28, y + h * 0.35], [cx + 4, y + h * 0.5], [cx + 2, y + h * 0.3], [cx - 4, y + h * 0.3], [cx - 6, y + h * 0.5], [cx - 30, y + h * 0.36], [cx - 34, y + h * 0.4], [cx - 8, y + h * 0.58]];
    cut(g, trunk, '#6b4a33', { seed: 800, lift: 4 });
    cut(g, [[cx - 4, y + h * 0.62], [cx + 4, y + h * 0.62], [cx + 3, y + h * 0.9], [cx - 2, y + h * 0.92]], '#54392a', { seed: 801, lift: 0, amp: 0.4 });
    var crowns = [[cx - w * 0.24, y + h * 0.32, w * 0.3, '#56613a'], [cx + w * 0.22, y + h * 0.3, w * 0.3, '#5d6a3d'], [cx, y + h * 0.2, w * 0.36, '#6f7c46'], [cx - w * 0.12, y + h * 0.36, w * 0.26, '#7d8a4e'], [cx + w * 0.14, y + h * 0.4, w * 0.22, '#8b9757']];
    crowns.forEach(function (c, i) { cut(g, blob(c[0], c[1], c[2], 810 + i, 5 + i % 3, 0.16), c[3], { seed: 820 + i, lift: 4.5, sh: 0.3, torn: i >= 2, rim: '#dfe0b5', tornAmp: 1.8 }); });
    for (var f = 0; f < 7; f++) {
      var a = R() * TAU, rr = R() * w * 0.32;
      var fx = cx + Math.cos(a) * rr, fy = y + h * 0.3 + Math.sin(a) * rr * 0.6;
      cut(g, ell(fx, fy, 5.5, 5.5, 12), f % 3 ? '#c1593a' : '#d98a48', { seed: 840 + f, lift: 2, amp: 0.5 });
      g.fillStyle = 'rgba(255,240,210,0.6)'; g.beginPath(); g.arc(fx - 1.8, fy - 1.8, 1.4, 0, TAU); g.fill();
    }
  };

  K.plant = function (g, it, sc) {
    var x = it.x, y = it.y, w = it.w, h = it.h, R = rng(it.seed || 1), bx = x + w / 2, by = y + h;
    var indoor = sc.mood === 'indoor';
    if (indoor) {
      by = y + h - h * 0.34;
      cut(g, [[bx - w * 0.3, by], [bx + w * 0.3, by], [bx + w * 0.22, y + h], [bx - w * 0.22, y + h]], C.terra, { seed: 900, lift: 4 });
      cut(g, rectP(bx - w * 0.34, by - 6, w * 0.68, 9), mix(C.terra, C.rustD, 0.3), { seed: 901, lift: 2 });
    }
    var n = indoor ? 7 : 9;
    for (var i = 0; i < n; i++) {
      var a = -Math.PI / 2 + (i / (n - 1) - 0.5) * 1.9 + (R() - 0.5) * 0.25, L = (indoor ? h * 0.7 : h * 0.95) * (0.65 + R() * 0.4), wd = indoor ? 10 : 9;
      var tip = [bx + Math.cos(a) * L, by + Math.sin(a) * L], nx = -Math.sin(a), ny = Math.cos(a), mid = [bx + Math.cos(a) * L * 0.5, by + Math.sin(a) * L * 0.5];
      var bend = (i - n / 2) * 2;
      var leaf = [[bx - nx * 2, by - ny * 2], [mid[0] - nx * wd + bend, mid[1] - ny * wd], [tip[0] + bend * 1.5, tip[1]], [mid[0] + nx * wd + bend, mid[1] + ny * wd], [bx + nx * 2, by + ny * 2]];
      var col = indoor ? (i % 2 ? '#5f6d3f' : '#71804a') : (i % 2 ? C.oliveDD : '#4b5636');
      cut(g, leaf, col, { seed: 910 + i, lift: indoor ? 3 : 6, sh: 0.35, amp: 0.8 });
    }
    if (!indoor) for (var k = 0; k < 2; k++) {
      var fx = bx + (k ? 18 : -14), fy = y + 14 + k * 16;
      cut(g, [[bx + (k ? 4 : -4), by], [fx - 1, fy], [fx + 1, fy], [bx + (k ? 6 : -2), by]], C.oliveDD, { seed: 930 + k, lift: 3, raw: true });
      cut(g, blob(fx, fy, 9, 940 + k, 5, 0.3), k ? C.mustard : C.rust, { seed: 950 + k, lift: 4, sh: 0.3 });
      brad(g, fx, fy, 2.2);
    }
  };

  K.rock = function (g, it) {
    var x = it.x, y = it.y, w = it.w, h = it.h;
    var p = [[x, y + h], [x + w * 0.08, y + h * 0.45], [x + w * 0.3, y + h * 0.1], [x + w * 0.62, y], [x + w * 0.88, y + h * 0.3], [x + w, y + h]];
    cut(g, p, '#8a7e6c', { seed: 1000 + (it.seed || 0), lift: 4, sh: 0.32 });
    cut(g, [[x + w * 0.3, y + h * 0.16], [x + w * 0.6, y + h * 0.06], [x + w * 0.66, y + h * 0.5], [x + w * 0.36, y + h * 0.58]], '#a69983', { seed: 1001, lift: 1, sh: 0.2 });
  };

  K.water = function (g, it) {
    var x = it.x, y = it.y, w = it.w, h = it.h;
    cut(g, rectP(x, y, w, h), '#6d9393', { seed: 1100, lift: 3, sx: 0, sy: -0.5, torn: true });
    for (var i = 0; i < 5; i++) cut(g, rectP(x + 20 + i * w / 5, y + 10 + (i % 3) * h / 4, w / 7, 4), '#a8c4bd', { seed: 1101 + i, lift: 1, amp: 1 });
  };

  K.bridge = function (g, it) {
    var x = it.x, y = it.y, w = it.w, h = it.h;
    var arc = [[x, y + h]].concat(ell(x + w / 2, y + h, w / 2, h * 0.8, 24, Math.PI, TAU)).concat([[x + w, y + h], [x + w, y + h * 0.1], [x, y + h * 0.1]]);
    cut(g, [[x, y], [x + w, y], [x + w, y + h], [x + w * 0.85, y + h]].concat(ell(x + w / 2, y + h, w * 0.35, h * 0.6, 20, 0, -Math.PI).map(function (q) { return [q[0], q[1]]; })).concat([[x + w * 0.15, y + h], [x, y + h]]), '#b9a17c', { seed: 1200, lift: 4 });
    cut(g, rectP(x - 6, y - 8, w + 12, 10), C.brown, { seed: 1201, lift: 2 });
    void arc;
  };

  K.fence = function (g, it) {
    var x = it.x, y = it.y, w = it.w, h = it.h, R = rng(it.seed || 2);
    cut(g, rectP(x - 4, y + h * 0.3, w + 8, 9), '#9a7650', { seed: 1300 + it.seed, lift: 2 });
    cut(g, rectP(x - 4, y + h * 0.68, w + 8, 9), '#9a7650', { seed: 1301 + it.seed, lift: 2 });
    var n = Math.max(2, Math.round(w / 22));
    for (var i = 0; i < n; i++) {
      var px = x + i * w / n + 3, pw = w / n - 6, ph = h * (0.86 + R() * 0.14), top = y + h - ph;
      var pk = [[px, top + 8], [px + pw / 2, top], [px + pw, top + 8], [px + pw, y + h], [px, y + h]];
      pk = rotP(pk, px + pw / 2, y + h, (R() - 0.5) * 0.06);
      var col = mix('#d8c095', '#b99d72', R() * 0.6);
      cut(g, pk, col, { seed: 1310 + i + it.seed * 20, lift: 2.5, sh: 0.3 });
      brad(g, px + pw / 2, y + h * 0.34, 1.5); brad(g, px + pw / 2, y + h * 0.72, 1.5);
    }
  };

  K.pipe = function (g, it) {
    var x = it.x, y = it.y, w = it.w, h = it.h;
    cut(g, rectP(x, y, w, h), '#ad6a40', { seed: 1400, lift: 4 });
    cut(g, rectP(x + w * 0.12, y, w * 0.18, h), '#cf8c5c', { seed: 1401, lift: 0, amp: 0.5 });
    cut(g, rectP(x + w * 0.72, y, w * 0.2, h), '#86492b', { seed: 1402, lift: 0, amp: 0.5 });
    for (var r = y + 40; r < y + h - 10; r += 74) {
      cut(g, rectP(x - 5, r, w + 10, 14), '#7f4a2e', { seed: 1410 + r, lift: 2 });
      brad(g, x + 2, r + 7, 2.2); brad(g, x + w - 2, r + 7, 2.2);
    }
  };

  K.lamp = function (g, it, sc) {
    var x = it.x, y = it.y, w = it.w, h = it.h, lit = !it.state || it.state.lit !== false;
    if (it.variant === 'hang') {
      var cx = x + w / 2, sy = y + h * 0.66;
      cut(g, rectP(cx - 1.2, y, 2.4, sy - y), C.ink, { seed: 1500, lift: 1.5, raw: true });
      cut(g, [[cx - 7, sy - 8], [cx + 7, sy - 8], [cx + 6, sy], [cx - 6, sy]], C.iron, { seed: 1501, lift: 2 });
      cut(g, ell(cx, sy + 20, 9, 9, 16), lit ? '#fbe2a0' : '#d8d0b8', { seed: 1502, lift: 1 });
      cut(g, [[cx - 9, sy], [cx + 9, sy], [cx + w / 2, sy + h * 0.2], [cx - w / 2, sy + h * 0.2]], C.rust, { seed: 1503, lift: 3 });
      cut(g, rectP(cx - w / 2, sy + h * 0.2 - 4, w, 5), C.rustD, { seed: 1504, lift: 1 });
      return;
    }
    var px = x + w / 2;
    cut(g, [[px - 4, y + 40], [px + 4, y + 40], [px + 5, y + h - 10], [px - 5, y + h - 10]], C.iron, { seed: 1510, lift: 3 });
    cut(g, [[px - 11, y + h - 14], [px + 11, y + h - 14], [px + 14, y + h], [px - 14, y + h]], C.iron, { seed: 1511, lift: 2.5 });
    cut(g, [[px - 6, y + 70], [px + 6, y + 70], [px + 8, y + 78], [px - 8, y + 78]], '#5a5048', { seed: 1512, lift: 1.5 });
    // фонарь
    cut(g, [[px - 13, y + 14], [px + 13, y + 14], [px + 10, y + 44], [px - 10, y + 44]], lit ? '#f6cd6c' : '#71756b', { seed: 1513, lift: 2.5 });
    cut(g, rectP(px - 1.5, y + 14, 3, 30), C.iron, { seed: 1514, lift: 1, raw: true });
    cut(g, [[px, y - 2], [px + 18, y + 15], [px - 18, y + 15]], C.iron, { seed: 1515, lift: 2.5 });
    cut(g, rectP(px - 12, y + 42, 24, 6), C.iron, { seed: 1516, lift: 1.5 });
    brad(g, px, y - 2, 2.4);
  };

  K.wall = function (g, it, sc) {
    var x = it.x, y = it.y, w = it.w, h = it.h, R = rng(it.seed || 2);
    cut(g, rectP(x - 10, y - 10, w + 20, h + 20), '#7f5a3c', { seed: 1600, lift: 0, raw: true });
    var px = x - 10, i = 0;
    while (px < x + w + 10) {
      var pw = 58 + R() * 26, cols = ['#a8794c', '#9d6f45', '#b0845a', '#a27648'];
      cut(g, rectP(px + 1, y - 10, pw - 2, h * 0.74 + 10), cols[i % 4], { seed: 1610 + i, lift: 3, sx: 0.8, sy: 0.3, sh: 0.3, amp: 0.6, step: 14 });
      for (var k = 0; k < 2; k++) { var kx = px + 10 + R() * (pw - 20), ky = y + 30 + R() * h * 0.6; g.fillStyle = 'rgba(60,35,20,0.25)'; g.beginPath(); g.ellipse(kx, ky, 3 + R() * 2, 1.6, 0, 0, TAU); g.fill(); }
      px += pw; i++;
    }
    // панель снизу
    var wy = y + h * 0.74;
    cut(g, rectP(x - 10, wy, w + 20, h - h * 0.74 + 10), '#7a5235', { seed: 1650, lift: 4, sx: 0, sy: -0.6 });
    cut(g, rectP(x - 10, wy - 4, w + 20, 10), '#5c3c28', { seed: 1651, lift: 2 });
    for (var b = 0; b < 8; b++) stitch(g, [[x + 20 + b * 120, wy + 22], [x + 20 + b * 120, wy + h * 0.24 - 12]], 'rgba(240,210,170,0.35)', 1);
    // чертёж на скотче
    var bx = 70, by = 70;
    var bp = cut(g, rotP(rectP(bx, by, 118, 86), bx + 59, by + 43, -0.04), '#4f7a78', { seed: 1660, lift: 4 });
    g.save(); poly(g, bp); g.clip(); g.strokeStyle = 'rgba(230,240,225,0.75)'; g.lineWidth = 1.3;
    g.beginPath(); g.arc(bx + 44, by + 46, 20, 0, TAU); g.stroke();
    g.beginPath(); g.arc(bx + 44, by + 46, 7, 0, TAU); g.stroke();
    for (var a = 0; a < 8; a++) { var an = a / 8 * TAU; g.beginPath(); g.moveTo(bx + 44 + Math.cos(an) * 20, by + 46 + Math.sin(an) * 20); g.lineTo(bx + 44 + Math.cos(an) * 27, by + 46 + Math.sin(an) * 27); g.stroke(); }
    g.setLineDash([3, 3]); g.beginPath(); g.moveTo(bx + 76, by + 20); g.lineTo(bx + 108, by + 20); g.moveTo(bx + 76, by + 34); g.lineTo(bx + 104, by + 34); g.moveTo(bx + 76, by + 48); g.lineTo(bx + 100, by + 48); g.stroke();
    g.restore();
    tape(g, bx + 6, by + 2, 26, 9, -0.6, 1661); tape(g, bx + 114, by + 4, 26, 9, 0.5, 1662);
    // инструмент на стене: молот и клещи
    var tx = 560, ty = 70;
    brad(g, tx + 10, ty, 2.5); brad(g, tx + 52, ty, 2.5);
    cut(g, rectP(tx + 7, ty + 6, 6, 70), '#7b5638', { seed: 1670, lift: 3 });
    cut(g, rectP(tx - 4, ty + 4, 28, 14), '#57524b', { seed: 1671, lift: 3 });
    cut(g, [[tx + 46, ty + 4], [tx + 52, ty + 4], [tx + 56, ty + 74], [tx + 50, ty + 74]], '#57524b', { seed: 1672, lift: 3 });
    cut(g, [[tx + 58, ty + 4], [tx + 52, ty + 4], [tx + 44, ty + 74], [tx + 50, ty + 74]], '#68625a', { seed: 1673, lift: 3 });
    brad(g, tx + 52, ty + 22, 2.6);
    // тёплая виньетка от лампы
    var gr = g.createRadialGradient(330, 200, 60, 420, 260, 640);
    gr.addColorStop(0, 'rgba(255,220,160,0)'); gr.addColorStop(0.55, 'rgba(60,30,15,0.18)'); gr.addColorStop(1, 'rgba(30,14,6,0.6)');
    g.fillStyle = gr; g.fillRect(x - 10, y - 10, w + 20, h + 20);
  };

  K.floor = function (g, it) {
    var x = it.x, y = it.y, w = it.w, h = it.h, R = rng(it.seed || 4);
    cut(g, rectP(x - 10, y, w + 20, h + 10), '#5d402c', { seed: 1700, lift: 5, sx: 0, sy: -0.7, sh: 0.35 });
    var rows = [y + 4, y + 26, y + 52, y + 82], i;
    for (i = 0; i < rows.length; i++) {
      var rh = (rows[i + 1] || y + h + 10) - rows[i] - 2, ox = R() * 120;
      for (var bx = x - 10 - ox; bx < x + w + 10; bx += 150 + R() * 60) {
        cut(g, rectP(bx + 1, rows[i], 148, rh), ['#73513a', '#6a4a33', '#7c5a40'][Math.floor(R() * 3)], { seed: 1710 + i * 20 + Math.floor(bx), lift: 1.5, amp: 0.5 });
      }
    }
    // половик с зубчатым краем (ножницы-зигзаг)
    var rx = 300, ry = 480, rw = 380, rh2 = 44, pk = [];
    for (var s = 0; s <= 38; s++) pk.push([rx + s * rw / 38, ry + (s % 2 ? -4 : 0)]);
    for (var s2 = 0; s2 <= 6; s2++) pk.push([rx + rw + (s2 % 2 ? 4 : 0), ry + s2 * rh2 / 6]);
    for (var s3 = 38; s3 >= 0; s3--) pk.push([rx + s3 * rw / 38, ry + rh2 + (s3 % 2 ? 4 : 0)]);
    for (var s4 = 6; s4 >= 0; s4--) pk.push([rx + (s4 % 2 ? -4 : 0), ry + s4 * rh2 / 6]);
    cut(g, pk, C.rustD, { seed: 1790, lift: 2.5, raw: true });
    cut(g, rectP(rx + 12, ry + 8, rw - 24, rh2 - 16), C.mustard, { seed: 1791, lift: 1.5 });
    cut(g, rectP(rx + 22, ry + 14, rw - 44, rh2 - 28), C.rust, { seed: 1792, lift: 1 });
    stitch(g, [[rx + 6, ry + 4], [rx + rw - 6, ry + 4]], 'rgba(250,225,170,0.6)', 1);
    stitch(g, [[rx + 6, ry + rh2 - 4], [rx + rw - 6, ry + rh2 - 4]], 'rgba(250,225,170,0.6)', 1);
  };

  K.window = function (g, it, sc) {
    var x = it.x, y = it.y, w = it.w, h = it.h, P = MOODS.dawn;
    cut(g, rectP(x - 12, y - 12, w + 24, h + 24), C.dbrown, { seed: 1800, lift: 4 });
    var view = rectP(x, y, w, h);
    g.save(); poly(g, view); g.clip();
    var bands = P.bands;
    for (var i = 0; i < bands.length; i++) cut(g, rectP(x - 5, y + i * h * 0.16 - 5, w + 10, h + 10), bands[i], { seed: 1810 + i, lift: i ? 2 : 0, sx: 0, sy: -0.5, torn: i > 0 });
    cut(g, ell(x + w * 0.62, y + h * 0.72, 18, 18, 20), P.sun, { seed: 1820, lift: 2 });
    var ridge = []; for (var xx = x - 5; xx <= x + w + 5; xx += 10) ridge.push([xx, y + h * 0.72 + Math.sin(xx * 0.04) * 6]);
    cut(g, ridge.concat([[x + w + 5, y + h + 5], [x - 5, y + h + 5]]), P.hillFar, { seed: 1821, lift: 3, sx: 0, sy: -0.5, torn: true });
    var r2 = []; for (var x2 = x - 5; x2 <= x + w + 5; x2 += 10) r2.push([x2, y + h * 0.86 + Math.sin(x2 * 0.07 + 2) * 4]);
    cut(g, r2.concat([[x + w + 5, y + h + 5], [x - 5, y + h + 5]]), P.hillNear, { seed: 1822, lift: 3, sx: 0, sy: -0.5, torn: true });
    g.restore();
    cut(g, rectP(x + w / 2 - 4, y, 8, h), C.dbrown, { seed: 1830, lift: 2, raw: true });
    cut(g, rectP(x, y + h * 0.45, w, 8), C.dbrown, { seed: 1831, lift: 2, raw: true });
    cut(g, rectP(x - 20, y + h + 8, w + 40, 12), '#6b4630', { seed: 1832, lift: 3 });
    // занавески с зигзагом
    [[x - 26, 1], [x + w + 26, -1]].forEach(function (c, k) {
      var cx = c[0], d = c[1], p = [[cx, y - 18], [cx + d * 44, y - 18]];
      for (var s = 0; s <= 12; s++) { var f = s / 12, xx2 = cx + d * (44 - 30 * Math.sin(f * Math.PI * 0.9)) + (s % 2 ? d * 3 : 0); p.push([xx2, y - 18 + f * (h + 30)]); }
      p.push([cx, y + h + 12]);
      cut(g, p, k ? '#b65a3e' : '#a8503a', { seed: 1840 + k, lift: 4, raw: true });
      g.save(); poly(g, p); g.clip(); g.strokeStyle = 'rgba(60,20,10,0.25)'; g.lineWidth = 1.2;
      for (var fo = 1; fo < 4; fo++) { g.beginPath(); g.moveTo(cx + d * fo * 9, y - 18); g.quadraticCurveTo(cx + d * fo * 4, y + h * 0.5, cx + d * fo * 6, y + h + 12); g.stroke(); }
      g.restore();
      cut(g, rectP(cx - 4 + d * 4, y + h * 0.48, 30 * d || 30, 8).map(function (q) { return q; }), C.mustard, { seed: 1850 + k, lift: 2 });
    });
    cut(g, rectP(x - 40, y - 24, w + 80, 8), C.iron, { seed: 1860, lift: 2.5 });
    brad(g, x - 36, y - 20, 3); brad(g, x + w + 36, y - 20, 3);
  };

  K.shelf = function (g, it) {
    var x = it.x, y = it.y, w = it.w, h = it.h, R = rng(it.seed || 3);
    var boards = [y + 4, y + 74, y + 144];
    boards.forEach(function (by, bi) {
      // предметы, стоящие на полке
      if (bi > 0) {
        var px = x + 10, k = 0;
        while (px < x + w - 24) {
          var t = Math.floor(R() * 4), iw, ih, col;
          if (t === 0) { // банка
            iw = 22 + R() * 8; ih = 30 + R() * 14; col = ['#d6d9bf', '#cdbf96', '#b8c7b4'][k % 3];
            cut(g, rectP(px, by - ih, iw, ih), col, { seed: 1900 + k + bi * 30, lift: 2.5 });
            cut(g, rectP(px - 2, by - ih - 6, iw + 4, 7), C.rust, { seed: 1950 + k + bi * 30, lift: 1.5 });
            cut(g, rectP(px + 4, by - ih * 0.6, iw - 8, ih * 0.3), C.cream, { seed: 1960 + k + bi * 30, lift: 0.8 });
          } else if (t === 1) { // бутыль
            iw = 18; ih = 40 + R() * 10; col = ['#557876', '#6a8a5a', '#8a5a3c'][k % 3];
            cut(g, [[px, by], [px, by - ih * 0.6], [px + 6, by - ih * 0.72], [px + 6, by - ih], [px + 12, by - ih], [px + 12, by - ih * 0.72], [px + 18, by - ih * 0.6], [px + 18, by]], col, { seed: 1970 + k + bi * 30, lift: 2.5 });
          } else { // книги
            iw = 0; var nb = 2 + Math.floor(R() * 3);
            for (var b = 0; b < nb; b++) {
              var bw = 8 + R() * 6, bh = 34 + R() * 20, lean = b === nb - 1 ? 0.2 : 0;
              var bp = rotP(rectP(px + iw, by - bh, bw, bh), px + iw + bw, by, lean);
              cut(g, bp, [C.teal, C.rustD, C.mustard, '#6c7a48', C.kraftD][Math.floor(R() * 5)], { seed: 1990 + b + k * 7 + bi * 50, lift: 2 });
              iw += bw + 1;
            }
            iw += 4;
          }
          px += iw + 6 + R() * 8; k++;
        }
      } else { // верхняя полка: свёрток и ящичек (справа — место кошки)
        cut(g, rectP(x + 14, by - 26, 40, 26), C.kraft, { seed: 1880, lift: 2.5 });
        tape(g, x + 34, by - 14, 10, 30, 0, 1881);
        cut(g, ell(x + 80, by - 10, 16, 10, 18), '#c9b48a', { seed: 1882, lift: 2.5 });
      }
      cut(g, rectP(x - 6, by, w + 12, 10), '#5c3d2a', { seed: 2100 + bi, lift: 3.5 });
      [x + 16, x + w - 26].forEach(function (bxx, j) {
        cut(g, [[bxx, by + 10], [bxx + 10, by + 10], [bxx + 10, by + 26]], C.iron, { seed: 2110 + bi * 2 + j, lift: 2 });
        brad(g, bxx + 6, by + 14, 1.6);
      });
    });
  };

  K.box = function (g, it) {
    var x = it.x, y = it.y, w = it.w, h = it.h, s = it.seed || 1;
    cut(g, rectP(x, y, w, h), '#b78a57', { seed: 2200 + s, lift: 4 });
    cut(g, rectP(x, y, w, 9), '#9c7246', { seed: 2201 + s, lift: 1.5 });
    cut(g, rectP(x, y + h - 9, w, 9), '#9c7246', { seed: 2202 + s, lift: 1.5 });
    cut(g, [[x + 4, y + h - 9], [x + 13, y + h - 9], [x + w - 4, y + 9], [x + w - 13, y + 9]], '#a57a4c', { seed: 2203 + s, lift: 1.5 });
    if (s % 2 === 0) tape(g, x + w * 0.7, y + 4, 12, 26, 0.2, 2204 + s);
    brad(g, x + 5, y + 4.5, 1.6); brad(g, x + w - 5, y + 4.5, 1.6); brad(g, x + 5, y + h - 4.5, 1.6); brad(g, x + w - 5, y + h - 4.5, 1.6);
  };

  K._unknown = function (g, it) { // нейтрально: пустая картонка с пунктиром
    var x = it.x || 0, y = it.y || 0, w = it.w || 40, h = it.h || 40;
    var p = cut(g, rectP(x, y, w, h), '#cfc2a4', { seed: 2300, lift: 3 });
    g.save(); g.setLineDash([4, 4]); poly(g, p); g.strokeStyle = 'rgba(80,60,40,0.4)'; g.lineWidth = 1; g.stroke(); g.restore();
    tape(g, x + w / 2, y, Math.min(30, w * 0.6), 9, 0.1, 2301);
  };

  // ---------- объекты (кэш по состоянию) ----------
  K.gate = function (g, it) {
    var x = it.x, y = it.y, w = it.w, h = it.h, open = it.state && it.state.open;
    var lx = x + 12, lw = w - 24;
    if (!open) {
      for (var i = 0; i < 5; i++) {
        var px = lx + i * lw / 5, pw = lw / 5 - 2;
        cut(g, [[px, y + 22 - (i === 2 ? 6 : Math.abs(i - 2) * -1)], [px + pw, y + 22 - (i === 2 ? 6 : 0)], [px + pw, y + h - 4], [px, y + h - 4]], i % 2 ? '#c59f69' : '#d1ad78', { seed: 2400 + i, lift: 2 });
      }
      cut(g, rectP(lx - 2, y + 40, lw + 4, 11), '#8f6a44', { seed: 2410, lift: 2 });
      cut(g, rectP(lx - 2, y + h - 34, lw + 4, 11), '#8f6a44', { seed: 2411, lift: 2 });
      cut(g, [[lx + 4, y + h - 34], [lx + 16, y + h - 34], [lx + lw - 4, y + 51], [lx + lw - 16, y + 51]], '#9b7550', { seed: 2412, lift: 2 });
      cut(g, ell(lx + lw - 14, y + h * 0.55, 6, 6, 12), C.iron, { seed: 2413, lift: 2 });
      brad(g, lx + lw - 14, y + h * 0.55, 2);
    } else { // створка развёрнута к зрителю — узкая, в перспективе
      var ow = lw * 0.26;
      cut(g, [[lx, y + 18], [lx + ow, y + 30], [lx + ow, y + h + 6], [lx, y + h - 4]], '#a8834f', { seed: 2420, lift: 3 });
      cut(g, [[lx, y + 38], [lx + ow, y + 50], [lx + ow, y + 60], [lx, y + 49]], '#7d5a38', { seed: 2421, lift: 1.5, raw: true });
      cut(g, [[lx, y + h - 36], [lx + ow, y + h - 26], [lx + ow, y + h - 16], [lx, y + h - 25]], '#7d5a38', { seed: 2422, lift: 1.5, raw: true });
    }
    [[x, 0], [x + w - 14, 1]].forEach(function (p, k) {
      cut(g, rectP(p[0], y, 14, h + 2), C.brown, { seed: 2430 + k, lift: 3.5 });
      cut(g, [[p[0] - 4, y + 2], [p[0] + 7, y - 10], [p[0] + 18, y + 2]], C.dbrown, { seed: 2432 + k, lift: 2 });
    });
    brad(g, x + 7, y + 44, 2.2); brad(g, x + 7, y + h - 28, 2.2);
  };

  K.door = function (g, it) {
    var x = it.x, y = it.y, w = it.w, h = it.h, open = it.state && it.state.open;
    cut(g, rectP(x - 12, y - 14, w + 24, h + 14), C.dbrown, { seed: 2500, lift: 4 });
    if (open) {
      var o = cut(g, rectP(x, y, w, h), '#f3d6a6', { seed: 2501, lift: 0, amp: 0.4 });
      g.save(); poly(g, o); g.clip();
      cut(g, rectP(x - 4, y + h * 0.62, w + 8, h), '#b2ad80', { seed: 2502, lift: 2, torn: true, sx: 0, sy: -0.5 });
      cut(g, rectP(x - 4, y + h * 0.82, w + 8, h), '#6f7e3f', { seed: 2503, lift: 2, torn: true, sx: 0, sy: -0.5 });
      g.restore();
      cut(g, [[x, y], [x + w * 0.22, y + 10], [x + w * 0.22, y + h + 8], [x, y + h]], '#7e5537', { seed: 2504, lift: 4 });
      g.save(); g.globalCompositeOperation = 'lighter';
      var gr = g.createLinearGradient(x + w, y + h, x + w + 160, y + h + 20);
      gr.addColorStop(0, 'rgba(255,200,120,0.28)'); gr.addColorStop(1, 'rgba(255,200,120,0)');
      g.fillStyle = gr; poly(g, [[x, y + h], [x + w, y + h], [x + w + 170, y + h + 40], [x + 40, y + h + 40]]); g.fill();
      g.restore();
    } else {
      for (var i = 0; i < 4; i++) cut(g, rectP(x + i * w / 4, y, w / 4 - 1, h), i % 2 ? '#86593a' : '#8f6241', { seed: 2510 + i, lift: 1.5 });
      cut(g, rectP(x - 2, y + 30, w + 4, 12), '#64432c', { seed: 2520, lift: 2 });
      cut(g, rectP(x - 2, y + h - 50, w + 4, 12), '#64432c', { seed: 2521, lift: 2 });
      cut(g, [[x + 6, y + h - 50], [x + 20, y + h - 50], [x + w - 6, y + 42], [x + w - 20, y + 42]], '#6e4a31', { seed: 2522, lift: 2 });
      cut(g, ell(x + w - 18, y + h * 0.55, 7, 7, 14), C.iron, { seed: 2523, lift: 2 });
      brad(g, x + w - 18, y + h * 0.55, 3);
      [y + 36, y + h - 44].forEach(function (yy) { brad(g, x + 8, yy, 2.4); brad(g, x + w - 8, yy, 2.4); });
    }
  };

  K.lever = function (g, it) {
    var x = it.x, y = it.y, w = it.w, h = it.h, down = it.state && it.state.down;
    var px = x + w / 2, py = y + h - 22, a = down ? 0.95 : -0.35, L = h - 30;
    var rod = rotP([[px - 3.5, py], [px + 3.5, py], [px + 3, py - L], [px - 3, py - L]], px, py, a);
    cut(g, rod, '#cfc4aa', { seed: 2600, lift: 3 });
    var tip = rotP([[px, py - L]], px, py, a)[0];
    cut(g, ell(tip[0], tip[1], 10, 10, 18), C.rust, { seed: 2601, lift: 3 });
    g.fillStyle = 'rgba(255,240,215,0.6)'; g.beginPath(); g.arc(tip[0] - 3, tip[1] - 3, 2.6, 0, TAU); g.fill();
    cut(g, [[x, y + h], [x + 4, y + h - 26], [x + w - 4, y + h - 26], [x + w, y + h]], C.dbrown, { seed: 2602, lift: 3.5 });
    cut(g, rectP(x + w / 2 - 12, y + h - 30, 24, 8), C.iron, { seed: 2603, lift: 2 });
    brad(g, px, py, 3.5);
    // метка «вниз» — стрелка-вырезка на основании
    cut(g, [[x + 8, y + h - 16], [x + 16, y + h - 16], [x + 12, y + h - 8]], down ? C.mustard : '#8a7a62', { seed: 2604, lift: 1, raw: true });
  };

  K.machine = function (g, it) {
    var x = it.x, y = it.y, w = it.w, h = it.h, on = it.state && it.state.on;
    // бункер под трубой
    var hx = x + 82;
    cut(g, [[hx - 14, y + 6], [hx + 50, y + 6], [hx + 34, y + 52], [hx + 2, y + 52]], '#a8653c', { seed: 2700, lift: 3 });
    cut(g, rectP(hx - 18, y, 72, 10), '#7f4a2e', { seed: 2701, lift: 2 });
    // корпус
    var bx = x + 18, by = y + 50, bw = w - 60, bh = h - 72;
    var body = [[bx + 10, by], [bx + bw - 10, by], [bx + bw, by + 10], [bx + bw, by + bh], [bx, by + bh], [bx, by + 10]];
    cut(g, body, on ? '#557c79' : C.teal, { seed: 2702, lift: 6, sh: 0.34 });
    cut(g, rectP(bx, by + bh - 20, bw, 20), C.tealD, { seed: 2703, lift: 1.5 });
    // ножки
    [bx + 10, bx + bw - 34].forEach(function (lx, k) { cut(g, [[lx, by + bh], [lx + 24, by + bh], [lx + 28, y + h], [lx - 4, y + h]], C.iron, { seed: 2704 + k, lift: 3 }); });
    // панель с циферблатом
    cut(g, rectP(bx + 18, by + 18, 92, 76), '#e7d6b0', { seed: 2706, lift: 2.5 });
    cut(g, ell(bx + 50, by + 54, 26, 26, 30), C.cream, { seed: 2707, lift: 2 });
    for (var t = 0; t < 9; t++) { var a = Math.PI * (0.8 + t * 0.175); g.strokeStyle = C.ink; g.lineWidth = t % 4 === 0 ? 2 : 1; g.beginPath(); g.moveTo(bx + 50 + Math.cos(a) * 20, by + 54 + Math.sin(a) * 20); g.lineTo(bx + 50 + Math.cos(a) * 24, by + 54 + Math.sin(a) * 24); g.stroke(); }
    cut(g, [[bx + 64, by + 54 - 26 * 0.78], [bx + 74, by + 54 - 26 * 0.4], [bx + 74, by + 54 - 26 * 0.2]], C.rust, { seed: 2708, lift: 0, raw: true });
    // кнопки и заклёпки
    [C.rust, C.mustard].forEach(function (c, k) { cut(g, ell(bx + 92, by + 34 + k * 26, 7, 7, 14), c, { seed: 2710 + k, lift: 2 }); });
    for (var r = 0; r < 6; r++) { brad(g, bx + 8 + r * (bw - 16) / 5, by + 6, 2); brad(g, bx + 8 + r * (bw - 16) / 5, by + bh - 28, 2); }
    // лоток выдачи справа
    cut(g, [[bx + bw, by + bh - 70], [bx + bw + 34, by + bh - 52], [bx + bw + 34, by + bh - 40], [bx + bw, by + bh - 46]], '#a8653c', { seed: 2720, lift: 3 });
    // гнездо для шестерни (ось)
    cut(g, ell(bx + bw - 44, by + 44, 10, 10, 16), C.tealD, { seed: 2721, lift: 0 });
    // вентиль пара
    cut(g, rectP(bx + bw - 30, by - 22, 14, 24), C.iron, { seed: 2722, lift: 2.5 });
    cut(g, rectP(bx + bw - 36, by - 28, 26, 8), '#5a5048', { seed: 2723, lift: 2 });
    // табличка с полосками (без текста)
    cut(g, rectP(bx + 124, by + 84, 52, 16), C.mustard, { seed: 2724, lift: 1.5 });
    stitch(g, [[bx + 130, by + 92], [bx + 170, by + 92]], C.rustD, 1.4);
  };

  // ---------- живые детали ----------
  var LIVE = {};
  LIVE.house = function (ctx, it, t) {
    var x = it.x, y = it.y, w = it.w, h = it.h;
    var chx = x + w * 0.68 + w * 0.045, chy = y + h * 0.05;
    for (var i = 0; i < 5; i++) {
      var f = ((t * 0.22 + i / 5) % 1), r = 6 + f * 16;
      var sx = chx + Math.sin(f * 5 + i) * 6 + f * 28, sy = chy - 6 - f * 90;
      ctx.globalAlpha = (1 - f) * 0.85;
      var p = blob(sx, sy, r, 3000 + i, 4, 0.12);
      ctx.fillStyle = 'rgba(60,35,20,0.18)'; ctx.save(); ctx.translate(1.2, 2); poly(ctx, p); ctx.fill(); ctx.restore();
      ctx.fillStyle = '#f2e7d0'; poly(ctx, p); ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (it.state && it.state.windowLit) {
      var wx = x + w * 0.33, wy = y + h * 0.58, fl = 0.8 + 0.2 * Math.sin(t * 7) * Math.sin(t * 3.1);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      var gr = ctx.createRadialGradient(wx, wy, 4, wx, wy, 90);
      gr.addColorStop(0, 'rgba(255,190,100,' + (0.22 * fl) + ')'); gr.addColorStop(1, 'rgba(255,190,100,0)');
      ctx.fillStyle = gr; ctx.fillRect(wx - 90, wy - 90, 180, 180); ctx.restore();
    }
  };
  LIVE.lamp = function (ctx, it, t, sc) {
    if (it.state && it.state.lit === false) return;
    var x = it.x, y = it.y, w = it.w, h = it.h, fl = 0.85 + 0.15 * Math.sin(t * 9 + 1) * Math.sin(t * 2.3), P = pal(sc);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    if (it.variant === 'hang') {
      var cx = x + w / 2, ly = y + h * 0.66 + h * 0.2;
      var gr = ctx.createRadialGradient(cx, ly, 4, cx, ly + 120, 330);
      gr.addColorStop(0, 'rgba(' + P.glow + ',' + (0.26 * fl) + ')'); gr.addColorStop(1, 'rgba(' + P.glow + ',0)');
      ctx.fillStyle = gr; poly(ctx, [[cx - 30, ly], [cx + 30, ly], [cx + 260, 540], [cx - 260, 540]]); ctx.fill();
      var g2 = ctx.createRadialGradient(cx, ly, 2, cx, ly, 60);
      g2.addColorStop(0, 'rgba(255,230,170,' + (0.5 * fl) + ')'); g2.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.fillStyle = g2; ctx.fillRect(cx - 60, ly - 60, 120, 120);
    } else {
      var px = x + w / 2, gy = y + 30;
      var g3 = ctx.createRadialGradient(px, gy, 3, px, gy, 80);
      g3.addColorStop(0, 'rgba(' + P.glow + ',' + (0.45 * fl) + ')'); g3.addColorStop(1, 'rgba(' + P.glow + ',0)');
      ctx.fillStyle = g3; ctx.fillRect(px - 80, gy - 80, 160, 160);
    }
    ctx.restore();
  };
  function gearPts(cx, cy, r, teeth, a0) {
    var p = [], n = teeth * 4;
    for (var i = 0; i < n; i++) { var a = a0 + i / n * TAU, rr = (i % 4 < 2) ? r : r * 0.78; p.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); }
    return p;
  }
  function liveGear(ctx, cx, cy, r, teeth, a, col) {
    var p = gearPts(cx, cy, r, teeth, a);
    cut(ctx, p, col, { live: true, raw: true, lift: 3, seed: 3100 + teeth });
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.32, 0, TAU); ctx.fillStyle = dark(col, 0.3); ctx.fill();
    brad(ctx, cx, cy, Math.max(2, r * 0.14));
  }
  LIVE.machine = function (ctx, it, t) {
    var x = it.x, y = it.y, w = it.w, h = it.h, on = it.state && it.state.on;
    var bx = x + 18, by = y + 50, bw = w - 60, tq = Math.floor(t * 12) / 12;
    // шестерни (вращаются, когда машина работает)
    var a = on ? tq * 1.6 : 0;
    liveGear(ctx, bx + bw + 6, by + 96, 30, 10, a, C.mustard);
    liveGear(ctx, bx + bw - 44, by + 44, 19, 8, -a * 1.55 + 0.2, '#c07a46');
    // стрелка прибора
    var na = on ? -0.5 + Math.sin(t * 3) * 0.25 : Math.PI * 0.82;
    var cx = bx + 50, cy = by + 54;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(na);
    cut(ctx, [[-3, 2], [20, 0], [-3, -2]], C.ink, { live: true, raw: true, lift: 1.5, tex: false });
    ctx.restore(); brad(ctx, cx, cy, 3);
    // лампочка-индикатор
    var lx = bx + bw - 23, ly = by - 34;
    ctx.beginPath(); ctx.arc(lx, ly, 7, Math.PI, TAU); ctx.fillStyle = on ? '#ffd772' : '#8b8676'; ctx.fill();
    if (on) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      var gr = ctx.createRadialGradient(lx, ly, 1, lx, ly, 50); gr.addColorStop(0, 'rgba(255,210,120,0.55)'); gr.addColorStop(1, 'rgba(255,200,110,0)');
      ctx.fillStyle = gr; ctx.fillRect(lx - 50, ly - 50, 100, 100); ctx.restore();
      for (var i = 0; i < 4; i++) { // пар
        var f = (t * 0.6 + i / 4) % 1, sx = lx + 10 + f * 30 + Math.sin(f * 6 + i) * 5, sy = ly - 6 - f * 70;
        ctx.globalAlpha = (1 - f) * 0.9; poly(ctx, blob(sx, sy, 5 + f * 12, 3200 + i, 4, 0.15)); ctx.fillStyle = '#f4ead6'; ctx.fill(); ctx.globalAlpha = 1;
      }
    }
  };
  LIVE.item = function (ctx, it, t) {
    if (it.state && it.state.taken) return;
    var cx = it.x + it.w / 2, cy = it.y + it.h / 2, s = Math.max(it.w, it.h) * 1.25;
    ctx.fillStyle = 'rgba(50,28,12,0.25)'; ctx.beginPath(); ctx.ellipse(cx + 2, it.y + it.h, s * 0.45, 4, 0, 0, TAU); ctx.fill();
    api.drawIcon(ctx, it.item || 'question', cx, cy - 2 + Math.sin(t * 2) * 1.2, s);
    var k = (t * 0.7) % 1;
    if (k < 0.35) { // блик-звёздочка
      var sc = Math.sin(k / 0.35 * Math.PI) * 6, sx = cx + s * 0.35, sy = cy - s * 0.35;
      ctx.fillStyle = '#fff6d8'; poly(ctx, [[sx, sy - sc], [sx + sc * 0.25, sy - sc * 0.25], [sx + sc, sy], [sx + sc * 0.25, sy + sc * 0.25], [sx, sy + sc], [sx - sc * 0.25, sy + sc * 0.25], [sx - sc, sy], [sx - sc * 0.25, sy - sc * 0.25]]); ctx.fill();
    }
  };

  // покачивание: смещение/поворот спрайта по kind
  function motion(it, depth, t) {
    var s = it.seed || 1;
    switch (it.kind) {
      case 'cloud': return { dx: Math.sin(t * 0.13 + s) * 14, dy: Math.sin(t * 0.5 + s) * 1.5, a: 0 };
      case 'moon': return { dx: 0, dy: Math.sin(t * 0.4) * 1.2, a: 0 };
      case 'tree': return { dx: 0, dy: 0, a: Math.sin(t * 0.9 + s) * 0.006, px: it.x + it.w / 2, py: it.y + it.h };
      case 'plant': return { dx: 0, dy: 0, a: Math.sin(t * 1.3 + s) * 0.022, px: it.x + it.w / 2, py: it.y + it.h };
      case 'hill': return { dx: Math.sin(t * 0.35 + (it.tone || 0) * 2) * 0.8, dy: Math.sin(t * 0.5 + (it.tone || 0)) * 0.6, a: 0 };
      case 'house': case 'fence': case 'lamp': case 'shelf': case 'box':
        return { dx: 0, dy: 0, a: Math.sin(t * 0.7 + depth * 1.7 + s) * 0.0016, px: it.x + it.w / 2, py: it.y + (it.h || 0) };
      default: return null;
    }
  }

  var PAD = { sky: 0, ground: 30, wall: 0, floor: 30, house: 40, tree: 40, door: 60, plant: 30, hill: 30 };
  function itemBox(it) {
    if (it.kind === 'sky') return [0, 0, W, H];
    var p = PAD[it.kind] == null ? 36 : PAD[it.kind];
    var x = it.x || 0, y = it.y || 0, w = it.w || 40, h = it.h || 40;
    if (it.kind === 'house') return [x - p, y - 110, w + 2 * p, h + 110 + p];
    if (it.kind === 'wall' || it.kind === 'floor') return [Math.min(0, x) - 12, y - 12, Math.max(w, W) + 24, h + 24];
    if (it.kind === 'window') return [x - 50, y - 30, w + 100, h + 60];
    return [x - p, y - p, w + 2 * p, h + 2 * p];
  }

  function drawItem(ctx, it, sc, t, depth) {
    var fn = K[it.kind] || K._unknown, b = itemBox(it);
    var key = sc.mood + '|' + JSON.stringify(it);
    var s = sprite(key, b[0], b[1], b[2], b[3], function (g) { fn(g, it, sc); });
    var m = motion(it, depth, t);
    if (m) {
      ctx.save();
      if (m.a) { ctx.translate(m.px, m.py); ctx.rotate(m.a); ctx.translate(-m.px, -m.py); }
      ctx.translate(m.dx, m.dy); blit(ctx, s); ctx.restore();
    } else blit(ctx, s);
    if (LIVE[it.kind]) LIVE[it.kind](ctx, it, t, sc);
  }

  function drawObject(ctx, o, sc, t, opts) {
    if (o.kind === 'npc') { if (!opts.npcSeparate) api.drawNpc(ctx, o, 'idle', t); return; }
    if (o.kind === 'item') { LIVE.item(ctx, o, t); return; }
    var fn = K[o.kind] || K._unknown, b = itemBox(o);
    var key = 'obj|' + o.kind + '|' + o.x + ',' + o.y + ',' + o.w + ',' + o.h + '|' + JSON.stringify(o.state || {});
    var s = sprite(key, b[0], b[1], b[2], b[3], function (g) { fn(g, o, sc); });
    if (o.kind === 'machine' && o.state && o.state.on) {
      var q = Math.floor(t * 24);
      ctx.save(); ctx.translate((q % 3) - 1, (q % 2) * 0.8 - 0.4); blit(ctx, s); LIVE.machine(ctx, o, t); ctx.restore();
      return;
    }
    blit(ctx, s);
    if (LIVE[o.kind]) LIVE[o.kind](ctx, o, t, sc);
  }

  // ---------- риг персонажей (марионетка из частей) ----------
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

  var HERO_COL = { shirt: '#b9563b', shirtB: '#94432f', skin: '#efc8a0', skinB: '#d9ad86', leg: '#46595b', legB: '#384849', boot: '#5b3b29', bootB: '#47301f',
    bag: '#8c6340', bagFlap: '#76512f', strap: '#5a3a28', hair: '#4b2f22', ribbon: '#dca543', apron: '#c79d63', pocket: '#a87d4a', wood: '#7b5638', metal: '#8b8478', metalD: '#5a544c',
    belt: '#5a3a28', glass: '#f6cf70', cheek: 'rgba(214,110,90,0.32)', eye: '#2c1d16', mouth: '#7a2e22' };

  function drawRig(ctx, rig, cols) {
    for (var i = 0; i < rig.parts.length; i++) {
      var p = rig.parts[i], col = cols[p.role] || '#999';
      if (p.o.flat) { poly(ctx, p.pts); ctx.fillStyle = col; ctx.fill(); if (p.o.hl) { var c = p.pts[0]; ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(c[0] - 1.6, c[1] - 1.4, 0.8, 0, TAU); ctx.fill(); } continue; }
      cut(ctx, p.pts, col, { live: true, lift: 2.2, seed: 5000 + i * 13, amp: 0.45, step: 7, sh: 0.3, texA: 0.5 });
      if (p.role === 'apron') stitch(ctx, [p.pts[0], p.pts[3]].map(function (q, k) { return [q[0] + (k ? 2.5 : 2) * (rig.dir || 1), q[1] + (k ? -3 : 3)]; }), 'rgba(255,240,210,0.7)', 0.9);
    }
    for (var j = 0; j < rig.pins.length; j++) brad(ctx, rig.pins[j][0], rig.pins[j][1], 1.7);
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
  var KEEPER_COL = { wood: '#7b5638', straw: '#d9ad4f', band: '#b3533a', coat: '#3f5f5d', coatB: '#314a49', coatD: '#2f4645', skin: '#e9c09a', skinB: '#d2a582', trous: '#4a4038', boot: '#3b2a20', beard: '#f2e9d4', nose: '#d9907a', eye: '#2c1d16', hat: '#7a5a3c' };

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
  var CAT_COL = { pink: '#e6a08e', fur: '#c4693b', stripe: '#97492a', chest: '#f1e2c6', nose: '#d9807a', eyeY: '#e8c04f', pupil: '#2a1a12' };

  // ---------- пиктограммы (SVG-пути в поле 100×100, роли цвета) ----------
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
  var P2cache = {};
  function P2(id) { // объединённый Path2D для силуэта (тень)
    if (P2cache[id]) return P2cache[id];
    var p = new Path2D();
    (ICONS[id] || ICONS.question).forEach(function (e) { if (e[0] !== 'k' && e[0] !== 's') p.addPath(new Path2D(e[1])); });
    return (P2cache[id] = p);
  }
  var ICOL = { m: '#d9b27a', a: '#c9553a', d: '#4a3024', l: '#f6eedb', g: '#6f7d45', k: '#4a3024', s: '#8a7a62' };
  var ICOL_ID = { gear: { m: '#dca543' }, key: { a: '#d7a33f' }, cup: { m: '#f2e5c7', a: '#4f7472' }, fish: { m: '#5f8a88', a: '#3f6260' }, bird: { m: '#4f7472' },
    note: { m: '#4a3024' }, door: { m: '#8f6241', a: '#dca543', k: '#64432c' }, lamp: { a: '#f1c96a' }, sun: { a: '#e9ae49', m: '#f1c96a' }, moon: { m: '#f2e5c7' },
    star: { a: '#dca543' }, gate: { m: '#c59f69', k: '#8f6a44' }, cat: { m: '#c4693b', l: '#e8c04f', k: '#c4693b' }, eye: { m: '#4f7472' }, hand: { m: '#efc8a0' },
    lever: { k: '#cfc4aa', a: '#b3533a' }, bulb: { a: '#f1c96a' }, question: { k: '#4a3024', a: '#b3533a' } };

  function iconSprite(id, size) {
    var r = RES.r, key = 'icon|' + id + '|' + Math.round(size);
    var pad = size * 0.18;
    return sprite(key, -size / 2 - pad, -size / 2 - pad, size + pad * 2, size + pad * 2, function (g) {
      var k = size / 100, defs = ICONS[id] || ICONS.question, cols = ICOL_ID[id] || {};
      g.save(); g.translate(-size / 2, -size / 2); g.scale(k, k);
      // тень вырезки
      g.save(); g.translate(2.5, 4); g.filter = 'blur(' + (1.2 / k * 0.35).toFixed(1) + 'px)'; g.fillStyle = 'rgba(45,25,10,0.38)';
      defs.forEach(function (e) { if (e[0] === 'k' || e[0] === 's') { g.lineWidth = e[2] || 3; g.lineCap = 'round'; g.strokeStyle = g.fillStyle; g.stroke(new Path2D(e[1])); } else g.fill(new Path2D(e[1]), 'evenodd'); });
      g.restore();
      defs.forEach(function (e, i) {
        var col = cols[e[0]] || ICOL[e[0]], p = new Path2D(e[1]);
        if (e[0] === 'k' || e[0] === 's') { g.lineWidth = e[0] === 'k' ? (e[2] || 4) : 2.5; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = col; g.stroke(p); return; }
        g.fillStyle = col; g.fill(p, 'evenodd');
        g.save(); g.clip(p, 'evenodd'); g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.6;
        var pt = g.createPattern(tex(), 'repeat'); if (pt.setTransform) pt.setTransform(new DOMMatrix([1 / k * 0.5, 0, 0, 1 / k * 0.5, i * 37, i * 53]));
        g.fillStyle = pt; g.fillRect(0, 0, 100, 100); g.restore();
        g.lineWidth = 1.4; g.strokeStyle = 'rgba(255,246,226,0.35)'; g.stroke(p);
      });
      g.restore();
    });
  }

  // ---------- API ----------
  var api = {
    id: 'paper',
    name: { ru: 'Бумага', en: 'Paper' },

    drawScene: function (ctx, sc, t, opts) {
      opts = opts || {};
      RES.r = Math.max(1, Math.round((opts.pixelRatio || 1) * 4) / 4);
      var pass = opts.pass || 'all';
      var layers = (sc.layers || []).slice().sort(function (a, b) { return (a.depth || 0) - (b.depth || 0); });
      if (pass !== 'front') {
        if (!layers.length || !layers[0].items.some(function (i) { return i.kind === 'sky' || i.kind === 'wall'; })) {
          ctx.fillStyle = pal(sc).bands[0]; ctx.fillRect(0, 0, W, H);
        }
        layers.forEach(function (L) { if ((L.depth || 0) <= 2) L.items.forEach(function (it) { drawItem(ctx, it, sc, t, L.depth || 0); }); });
        (sc.objects || []).forEach(function (o) { drawObject(ctx, o, sc, t, opts); });
      }
      if (pass !== 'back') {
        layers.forEach(function (L) { if ((L.depth || 0) > 2) L.items.forEach(function (it) { drawItem(ctx, it, sc, t, L.depth); }); });
      }
    },

    drawHero: function (ctx, hero, pose, t) {
      var dir = hero.dir < 0 ? -1 : 1;
      ctx.fillStyle = 'rgba(45,25,10,0.28)'; ctx.beginPath(); ctx.ellipse(hero.x, hero.y + 1, 20, 4.5, 0, 0, TAU); ctx.fill();
      var rig = heroRig(pose || 'idle', t, hero.x, hero.y, dir); rig.dir = dir;
      drawRig(ctx, rig, HERO_COL);
      var g = rig.glow, fl = 0.8 + 0.2 * Math.sin(t * 8);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      var gr = ctx.createRadialGradient(g[0], g[1], 1, g[0], g[1], 26); gr.addColorStop(0, 'rgba(255,200,110,' + 0.5 * fl + ')'); gr.addColorStop(1, 'rgba(255,190,100,0)');
      ctx.fillStyle = gr; ctx.fillRect(g[0] - 26, g[1] - 26, 52, 52); ctx.restore();
    },

    drawNpc: function (ctx, npc, pose, t) {
      var fx = npc.x + npc.w / 2, fy = npc.y + npc.h, dir = npc.dir || -1;
      if (npc.npc === 'cat') {
        var rig = catRig(pose, t, fx, fy - 2, npc.dir || 1);
        drawRig(ctx, rig, CAT_COL);
        ctx.strokeStyle = 'rgba(250,240,220,0.8)'; ctx.lineWidth = 0.8;
        rig.whisk.forEach(function (w, k) { var s = k ? 1 : -1; for (var i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(w[0], w[1]); ctx.lineTo(w[0] + s * 12, w[1] + i * 3); ctx.stroke(); } });
        return;
      }
      if (npc.npc === 'keeper' || !npc.npc) {
        ctx.fillStyle = 'rgba(45,25,10,0.28)'; ctx.beginPath(); ctx.ellipse(fx, fy + 1, 26, 5, 0, 0, TAU); ctx.fill();
        drawRig(ctx, keeperRig(pose, t, fx, fy, dir), KEEPER_COL);
        return;
      }
      cut(ctx, rectP(npc.x, npc.y, npc.w, npc.h), '#cfc2a4', { live: true, seed: 6000 });
    },

    drawThought: function (ctx, x, y, icons, t) {
      icons = icons && icons.length ? icons : ['question'];
      var n = icons.length, cw = 26 + n * 50, ch = 70;
      var below = y < 170;
      var cx = Math.max(cw / 2 + 12, Math.min(W - cw / 2 - 12, x + (below ? 70 : 40))), cy = below ? y + 98 : y - 86;
      cy = Math.max(ch / 2 + 78, cy);
      var k = Math.min(1, Math.max(0, t / 0.35)), sc = k < 1 ? 1 + 0.12 * Math.sin(k * Math.PI) * (1 - k) * 3 - (1 - k) : 1;
      sc = Math.max(0.01, k < 1 ? k * (1 + 0.25 * Math.sin(k * Math.PI)) : 1);
      // нить из трёх «конфетти»
      for (var i = 0; i < 3; i++) {
        var f = (i + 1) / 4, dx = x + (cx - x) * f * 0.85, dy = (below ? y + 8 : y - 6) + (cy - y) * f * 0.8, rr = 3 + i * 2.2;
        if (t > 0.08 * i) cut(ctx, ell(dx, dy, rr, rr * 0.9, 12), '#f7efdc', { live: true, lift: 2, seed: 7000 + i });
      }
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.sin(t * 1.4) * 0.025 - 0.02); ctx.scale(sc, sc);
      var card = cut(ctx, rectP(-cw / 2, -ch / 2, cw, ch), '#f7efdc', { live: true, lift: 4, seed: 7010, torn: true, rim: '#fffaf0', tornAmp: 1.8, amp: 1.2, step: 5, sh: 0.3 });
      ctx.save(); poly(ctx, card); ctx.clip(); ctx.strokeStyle = 'rgba(120,150,160,0.22)'; ctx.lineWidth = 1;
      for (var ly = -ch / 2 + 14; ly < ch / 2; ly += 12) { ctx.beginPath(); ctx.moveTo(-cw / 2, ly); ctx.lineTo(cw / 2, ly); ctx.stroke(); }
      ctx.restore();
      tape(ctx, 0, -ch / 2 + 1, 34, 11, 0.06, 7020);
      for (var j = 0; j < n; j++) {
        var ix = -cw / 2 + 38 + j * 50, bob = Math.sin(t * 2.4 + j) * 1.5, pop = Math.min(1, Math.max(0, (t - 0.2 - j * 0.12) / 0.2));
        if (pop > 0) api.drawIcon(ctx, icons[j], ix, 4 + bob, 40 * (0.6 + 0.4 * pop));
      }
      ctx.restore();
    },

    drawIcon: function (ctx, id, x, y, size) {
      size = size || 32;
      var s = iconSprite(ICONS[id] ? id : 'question', size);
      ctx.drawImage(s.c, x + s.x, y + s.y, s.w, s.h);
    },

    drawCursor: function (ctx, kind, x, y) {
      var map = { use: 'gear', take: 'hand', go: 'arrow', look: 'eye' }, id = map[kind];
      if (!id) { api.drawIcon(ctx, 'pointer', x + 12, y + 14, 32); return; }
      ctx.save(); ctx.translate(x, y);
      if (kind === 'go') ctx.translate(-10, 0);
      cut(ctx, ell(0, 0, 3, 3, 10), '#fff6dc', { live: true, lift: 1.5, raw: true, tex: false });
      api.drawIcon(ctx, id, 14, 14, 34);
      ctx.restore();
    },

    drawUI: function (ctx, st, t) {
      // виньетка «диорамы»
      var v = sprite('vignette|' + (st.mood || ''), 0, 0, W, H, function (g) {
        var gr = g.createRadialGradient(W / 2, H * 0.52, H * 0.42, W / 2, H / 2, W * 0.66);
        gr.addColorStop(0, 'rgba(40,20,8,0)'); gr.addColorStop(1, st.mood === 'indoor' ? 'rgba(30,14,6,0.45)' : 'rgba(40,20,8,0.3)');
        g.fillStyle = gr; g.fillRect(0, 0, W, H);
      });
      blit(ctx, v);
      var slots = st.slots || [], hb = st.hintBtn;
      var key = 'ui|' + slots.length + '|' + (slots[0] ? slots[0].x + ',' + slots[0].y : '');
      if (slots.length) {
        var s0 = slots[0], s1 = slots[slots.length - 1];
        var s = sprite(key, s0.x - 40, s0.y - 20, s1.x + s1.w - s0.x + 80, s0.h + 40, function (g) {
          cut(g, rectP(s0.x - 18, s0.y - 6, s1.x + s1.w - s0.x + 36, s0.h + 12), '#a88052', { seed: 8000, torn: true, lift: 4, sh: 0.35 });
          slots.forEach(function (sl, i) {
            var p = rotP(rectP(sl.x + 2, sl.y + 2, sl.w - 4, sl.h - 4), sl.x + sl.w / 2, sl.y + sl.h / 2, (i % 2 ? 1 : -1) * 0.03);
            cut(g, p, '#f2e5c7', { seed: 8010 + i, lift: 2, amp: 0.8 });
          });
          tape(g, s0.x - 14, s0.y + s0.h / 2, 12, 34, 0.1, 8030); tape(g, s1.x + s1.w + 14, s1.y + s1.h / 2, 12, 34, -0.1, 8031);
        });
        blit(ctx, s);
        (st.inventory || []).forEach(function (id, i) { var sl = slots[i]; if (sl) api.drawIcon(ctx, id, sl.x + sl.w / 2, sl.y + sl.h / 2, sl.w * 0.72); });
      }
      if (hb) {
        var hov = st.hover === 'hint', lift = hov ? 5 : 3, bob = hov ? -2 : 0, cx = hb.x + hb.w / 2, cy = hb.y + hb.h / 2 + bob;
        cut(ctx, ell(cx, cy, hb.w / 2, hb.h / 2, 30), hov ? '#e8b452' : C.mustard, { live: true, lift: lift, seed: 8040, amp: 0.8 });
        cut(ctx, ell(cx, cy, hb.w / 2 - 6, hb.h / 2 - 6, 26), '#f2e5c7', { live: true, lift: 1.5, seed: 8041, amp: 0.6 });
        api.drawIcon(ctx, 'bulb', cx, cy, hb.w * 0.62);
      }
    }
  };

  window.KvestTheme = api;
})();
