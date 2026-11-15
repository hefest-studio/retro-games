/* МАЯЧНИЦА · themes/paper.js — оформление «бумага» (аппликация из вырезанной цветной бумаги) по API темы контракта «КВЕСТ».
   Основа — прототип _proto/style-paper/theme.js (вырезки с неровным краем, рваный край с белой сердцевиной, мягкая тень
   между слоями, процедурная фактура бумаги, скотч, латунные шпильки, нитяные швы), доведённая до всех состояний пилота.

   Читаемость прежде всего:
   - интерактивные объекты сцены — «наклейки»: светлый бумажный контур + тень-подложка; при наведении (opts.hover) — пульсирующий ореол;
   - цвет-метки связывают части головоломок: птицы на площади и колокольчики маяка (нота = цвет + высота), рычаги крана
     и части крана (state.tint), красный — всегда «стопор/замок»;
   - выходы без двери помечены бумажными флажками-стрелками с пиктограммой сцены назначения.
   Производительность: фактура, статичные слои (подряд идущие неподвижные элементы сцены склеиваются в один offscreen-холст),
   спрайты объектов (ключ — kind + состояние), ореолы и пиктограммы кэшируются; в кадре — drawImage + живые детали
   (огонь, свет, волны, туман, персонажи «стоп-моушн» 12 к/с). Без DOM (Node, тесты) тема рисует напрямую в ctx, без кэша.

   Настроения: палитра выбирается по scene.id (если сцена известна главе), иначе по mood. Палитра цельная на главу:
   тёплая охра мастерской → пасмурная площадь → ветреный серо-синий причал → сумерки тропы → ночь маяка → тёплый свет в финале.
   opts: { debug, light:{x,y,r}, hover:{x,y,kind}, pass:'back'|'front'|'all' }. Тема не меняет состояние игры. */
(function (global) {
  'use strict';
  var API = (global.KVEST && global.KVEST.ThemeAPI) || null;
  var HAS_DOM = typeof document !== 'undefined' && !!document.createElement;
  var W = 960, H = 540, TAU = Math.PI * 2;

  // ---------- утилиты ----------
  function rng(seed) {
    var a = ((seed || 1) * 2654435761) >>> 0 || 1;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hex(c) { if (c[0] !== '#') return [128, 128, 128]; var n = parseInt(c.length === 4 ? c[1] + c[1] + c[2] + c[2] + c[3] + c[3] : c.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function toHex(r, g, b) { return '#' + ((1 << 24) + (Math.round(r) << 16) + (Math.round(g) << 8) + Math.round(b)).toString(16).slice(1); }
  function mix(c, k, f) { var a = hex(c), b = hex(k); return toHex(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f); }
  function dark(c, f) { return mix(c, '#2a160c', f); }
  function light(c, f) { return mix(c, '#fff8e8', f); }
  function rgba(c, a) { var h = hex(c); return 'rgba(' + h[0] + ',' + h[1] + ',' + h[2] + ',' + a + ')'; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rnd(seed, i) { var x = Math.sin((seed || 1) * 127.1 + i * 311.7) * 43758.5453; return x - Math.floor(x); }

  function poly(g, p) { g.beginPath(); g.moveTo(p[0][0], p[0][1]); for (var i = 1; i < p.length; i++) g.lineTo(p[i][0], p[i][1]); g.closePath(); }
  function rectP(x, y, w, h) { return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]; }
  function rrP(x, y, w, h, r, n) { // скруглённый прямоугольник полигоном
    r = Math.min(r, w / 2, h / 2); n = n || 4; var p = [], cs = [[x + w - r, y + r, -Math.PI / 2], [x + w - r, y + h - r, 0], [x + r, y + h - r, Math.PI / 2], [x + r, y + r, Math.PI]];
    cs.forEach(function (c) { for (var i = 0; i <= n; i++) { var a = c[2] + i / n * Math.PI / 2; p.push([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r]); } });
    return p;
  }
  function ell(cx, cy, rx, ry, n, a0, a1) {
    n = n || 26; a0 = a0 || 0; a1 = a1 == null ? TAU : a1;
    var p = [], full = Math.abs(a1 - a0 - TAU) < 1e-6, m = full ? n : n + 1;
    for (var i = 0; i < m; i++) { var a = a0 + (a1 - a0) * i / n; p.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
    return p;
  }
  function lump(cx, cy, r, seed, lobes, amp) {
    var R = rng(seed), p = [], ph = R() * TAU, ph2 = R() * TAU, n = 36;
    for (var i = 0; i < n; i++) { var a = i / n * TAU, k = 1 + amp * Math.sin(lobes * a + ph) * 0.6 + amp * 0.4 * Math.sin((lobes + 2) * a + ph2); p.push([cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * k * 0.92]); }
    return p;
  }
  function rotP(p, cx, cy, a) { var c = Math.cos(a), s = Math.sin(a); return p.map(function (q) { var x = q[0] - cx, y = q[1] - cy; return [cx + x * c - y * s, cy + x * s + y * c]; }); }
  function movP(p, dx, dy) { return p.map(function (q) { return [q[0] + dx, q[1] + dy]; }); }
  function bbox(p) { var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (var i = 0; i < p.length; i++) { var q = p[i]; if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1]; } return [x0, y0, x1 - x0, y1 - y0]; }
  function band(pts, w) { // полоса вдоль ломаной (для «нитей», верёвок, труб из бумаги)
    var L = [], Rr = [];
    for (var i = 0; i < pts.length; i++) {
      var a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l * w / 2, ny = dx / l * w / 2;
      L.push([pts[i][0] + nx, pts[i][1] + ny]); Rr.push([pts[i][0] - nx, pts[i][1] - ny]);
    }
    return L.concat(Rr.reverse());
  }
  // неровный край ножниц: подразбиение + смещение по нормали
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

  // ---------- холсты и фактура бумаги (один раз, offscreen) ----------
  function mkCanvas(w, h) { if (!HAS_DOM) return null; var c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }
  // ---------- HiDPI: масштаб кэшей ----------
  // RES — во сколько раз физическое разрешение спрайтов больше логического (960×540). Все кэши (спрайты, ореолы, актёры,
  // фактура, пиктограммы) создаются в масштабе RES и рисуются в логических координатах, поэтому на ретине/4K они чёткие.
  // Оболочка (main.js) зовёт theme.setResolution(res) при смене размера канвы; смена RES сбрасывает кэши.
  var RES = 1, TEXK = 1, LOWQ = false;   // LOWQ — облегчённые эффекты для слабых устройств (без виньетки, туман — две полосы)
  function setResolution(r) {
    r = Math.max(0.5, Math.min(4, +r || 1)); r = Math.round(r * 8) / 8;
    if (r === RES) return false;
    RES = r; clearCaches(); return true;
  }
  var TEX = null, TEX_TRIED = false;
  function tex() {
    if (TEX || TEX_TRIED) return TEX; TEX_TRIED = true;
    // фактура — 256 логических пикселей; при RES ≥ 1,5 — вдвое плотнее (паттерн масштабируется обратно, волокна чёткие)
    TEXK = RES >= 1.5 && typeof DOMMatrix !== 'undefined' ? 2 : 1;
    var n = 256 * TEXK, c = mkCanvas(n, n); if (!c) return null;
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
    g.lineCap = 'round';
    for (var f = 0; f < 340; f++) { // волокна
      var x0 = R() * n, y0 = R() * n, len = (4 + R() * 14) * TEXK, a = R() * TAU, bend = (R() - 0.5) * 8 * TEXK;
      g.strokeStyle = f % 3 ? 'rgba(255,255,255,0.32)' : 'rgba(40,25,10,0.22)'; g.lineWidth = (0.4 + R() * 0.6) * TEXK;
      for (var ox = -1; ox <= 1; ox++) for (var oy = -1; oy <= 1; oy++) {
        var sx = x0 + ox * n, sy = y0 + oy * n;
        g.beginPath(); g.moveTo(sx, sy);
        g.quadraticCurveTo(sx + Math.cos(a) * len / 2 - Math.sin(a) * bend, sy + Math.sin(a) * len / 2 + Math.cos(a) * bend, sx + Math.cos(a) * len, sy + Math.sin(a) * len);
        g.stroke();
      }
    }
    TEX = c; return c;
  }
  var PATS = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  function patFor(g) {
    var t = tex(); if (!t || !PATS) return null;
    var p = PATS.get(g); if (!p) { p = g.createPattern(t, 'repeat'); if (TEXK !== 1 && p && p.setTransform) p.setTransform(new DOMMatrix([1 / TEXK, 0, 0, 1 / TEXK, 0, 0])); PATS.set(g, p); } return p;
  }
  function applyTex(g, pts, alpha, seed) {
    var p = patFor(g); if (!p) return;
    var R = rng(seed + 7), b = bbox(pts), ox = Math.floor(R() * 256), oy = Math.floor(R() * 256);
    g.save(); poly(g, pts); g.clip();
    g.globalCompositeOperation = 'overlay'; g.globalAlpha = alpha;
    g.translate(ox, oy); g.fillStyle = p; g.fillRect(b[0] - 2 - ox, b[1] - 2 - oy, b[2] + 4, b[3] + 4);
    g.restore();
  }
  // фактура поверх уже нарисованного (только по непрозрачному) — для персонажей и пиктограмм
  function texOver(g, x, y, w, h, alpha) {
    var p = patFor(g); if (!p) return;
    g.save(); g.globalCompositeOperation = 'source-atop'; g.globalAlpha = alpha * 0.55; g.fillStyle = p; g.fillRect(x, y, w, h);
    g.globalCompositeOperation = 'source-atop'; g.globalAlpha = 1; g.restore();
  }

  // ---------- вырезка ----------
  // o: lift (тень), sx/sy (направление тени), torn (рваный край с белой сердцевиной), amp/step (край), live (без blur),
  //    raw (не искажать край), tex/texA, edge, sh (плотность тени), rim (цвет сердцевины)
  function cut(g, pts, color, o) {
    o = o || {};
    var seed = o.seed || 1, lift = o.lift == null ? 3 : o.lift;
    var base = o.raw ? pts : wob(pts, seed, o.amp == null ? 0.7 : o.amp, o.step || 9);
    if (lift > 0) { // мягкая тень: три смещённых слоя вместо дорогого filter: blur
      var tx = (o.sx == null ? 0.45 : o.sx) * lift, ty = (o.sy == null ? 0.9 : o.sy) * lift, sa = o.sh || 0.32;
      g.save(); g.fillStyle = 'rgba(40,22,10,' + (o.live ? sa : sa * 0.42).toFixed(3) + ')';
      if (o.live) { g.translate(tx, ty); poly(g, base); g.fill(); }
      else { var sp = Math.max(0.6, lift * 0.35); 
        for (var k = 0; k < 3; k++) { var dx = k === 0 ? tx : k === 1 ? tx + sp : tx - sp * 0.6, dy = k === 0 ? ty : k === 1 ? ty + sp : ty + sp * 0.5; g.translate(dx, dy); poly(g, base); g.fill(); g.translate(-dx, -dy); } }
      g.restore();
    }
    if (o.torn) { poly(g, wob(pts, seed + 31, o.tornAmp || 2.3, 3)); g.fillStyle = o.rim || '#f6eedb'; g.fill(); }
    poly(g, base); g.fillStyle = color; g.fill();
    if (o.tex !== false && !o.live) applyTex(g, base, o.texA || 0.6, seed);
    if (o.edge !== false) { poly(g, base); g.lineWidth = 0.7; g.strokeStyle = 'rgba(255,246,226,0.3)'; g.stroke(); }
    return base;
  }
  function flat(g, pts, color) { poly(g, pts); g.fillStyle = color; g.fill(); }
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
    p.push([-w / 2, h / 2]); zig(-w / 2, h / 2, -w / 2, -h / 2);
    p = rotP(p, 0, 0, a).map(function (v) { return [v[0] + x, v[1] + y]; });
    poly(g, p); g.fillStyle = 'rgba(244,236,206,0.62)'; g.fill();
    poly(g, p); g.lineWidth = 0.6; g.strokeStyle = 'rgba(160,140,100,0.35)'; g.stroke();
  }
  function stitch(g, pts, color, lw) { // нитяной шов
    g.save(); if (g.setLineDash) g.setLineDash([5, 4]); g.lineCap = 'round'; g.lineWidth = lw || 1.4;
    g.strokeStyle = 'rgba(40,20,8,0.25)'; g.beginPath();
    pts.forEach(function (q, i) { if (i) g.lineTo(q[0] + 0.6, q[1] + 1); else g.moveTo(q[0] + 0.6, q[1] + 1); }); g.stroke();
    g.strokeStyle = color; g.beginPath();
    pts.forEach(function (q, i) { if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); }); g.stroke();
    g.restore();
  }
  function strokeL(g, pts, color, lw) { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (var i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.strokeStyle = color; g.lineWidth = lw || 2; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke(); }
  function glowAt(g, x, y, r, rgb, a) {
    var gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(' + rgb + ',' + a + ')'); gr.addColorStop(1, 'rgba(' + rgb + ',0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  function addGlow(g, x, y, r, rgb, a) { g.save(); g.globalCompositeOperation = 'lighter'; glowAt(g, x, y, r, rgb, a); g.restore(); }

  // ---------- кэш спрайтов ----------
  // LRU по площади (в физических пикселях): бюджет задаёт оболочка — setCacheBudget(px), по умолчанию 12 млн (≈48 МБ),
  // давно не нужные спрайты вытесняются вместе со своими ореолами. Ореолы и кадры персонажей входят в тот же бюджет.
  var LAST_SC = null, cache = new Map(), haloCache = new Map(), AREA = 0, MAX_AREA = 12e6, MAXC = 1500, HALO_AREA = 0, PEAK = 0, BUILT = 0, WARMING = false;
  function evict() {
    while ((AREA + HALO_AREA + ACT_AREA > MAX_AREA || cache.size > MAXC) && cache.size > 1) {
      var k0 = cache.keys().next().value, s0 = cache.get(k0); if (s0.use >= FRAME - 1) break;
      cache.delete(k0); AREA -= s0.area;
      if (s0.halos) for (var i = 0; i < s0.halos.length; i++) { var hk = s0.halos[i], hh = haloCache.get(hk); if (hh) { HALO_AREA -= hh.area; haloCache.delete(hk); } }
    }
  }
  // rc — потолок масштаба для этого спрайта (мягкие крупные слои — виньетка, туман — не требуют полного разрешения)
  function sprite(key, bx, by, bw, bh, draw, rc) {
    if (!HAS_DOM) return { fn: draw, x: bx, y: by, w: bw, h: bh };
    var s = cache.get(key);
    if (s) { if (s.use !== FRAME) { s.use = FRAME; cache.delete(key); cache.set(key, s); } return s; }
    var r = rc ? Math.min(RES, rc) : RES, c = mkCanvas(bw * r, bh * r), g = c.getContext('2d');
    g.scale(c.width / bw, c.height / bh); g.translate(-bx, -by); g.lineJoin = 'round';
    draw(g);
    s = { c: c, x: bx, y: by, w: bw, h: bh, key: key, use: WARMING ? FRAME - 5 : FRAME, area: c.width * c.height, halos: null };
    cache.set(key, s); AREA += s.area; BUILT++;
    evict(); PEAK = Math.max(PEAK, AREA + HALO_AREA + ACT_AREA);
    return s;
  }
  function clearCaches() {
    cache.clear(); haloCache.clear(); AREA = 0; HALO_AREA = 0; ACTORS.clear(); ACT_AREA = 0; ACT = null; DARK = null;
    TEX = null; TEX_TRIED = false; PATS = typeof WeakMap !== 'undefined' ? new WeakMap() : null; WARM = null; warmStart.sched = 0;
  }
  // статистика кэша: число спрайтов, физические пиксели и оценка памяти (4 байта на пиксель)
  function cacheStats() {
    var px = AREA + HALO_AREA + ACT_AREA, live = 0;   // live — пиксели спрайтов, нужных последним кадрам (рабочий набор сцены)
    cache.forEach(function (v) { if (v.use >= FRAME - 2) live += v.area; });
    ACTORS.forEach(function (v) { if (v.use >= FRAME - 2) live += v.area; });
    return { sprites: cache.size, halos: haloCache.size, actors: ACTORS.size, px: px, mb: +(px * 4 / 1048576).toFixed(1), peakMb: +(PEAK * 4 / 1048576).toFixed(1),
      budgetMb: +(MAX_AREA * 4 / 1048576).toFixed(1), res: RES, built: BUILT, liveMb: +(live * 4 / 1048576).toFixed(1) };
  }
  var FRAME = 0;
  function blit(ctx, s) { if (s.c) ctx.drawImage(s.c, s.x, s.y, s.w, s.h); else if (s.fn) { ctx.save(); s.fn(ctx); ctx.restore(); } }
  // «наклейка»: силуэт спрайта, расширенный на r пикселей (светлый контур / ореол при наведении)
  function halo(s, r, color) {
    if (!s.c) return null;
    var key = s.key + '|halo' + r + color, h = haloCache.get(key); if (h) return h;
    var c = mkCanvas((s.w + r * 2) * RES, (s.h + r * 2) * RES), g = c.getContext('2d'), n = 12;
    g.scale(c.width / (s.w + r * 2), c.height / (s.h + r * 2));
    for (var i = 0; i < n; i++) { var a = i / n * TAU; g.drawImage(s.c, r + Math.cos(a) * r, r + Math.sin(a) * r, s.w, s.h); }
    g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, s.w + r * 2, s.h + r * 2);
    h = { c: c, x: s.x - r, y: s.y - r, w: s.w + r * 2, h: s.h + r * 2, area: c.width * c.height }; haloCache.set(key, h); HALO_AREA += h.area;
    if (s.key) { var own = cache.get(s.key); if (own) (own.halos || (own.halos = [])).push(key); }
    return h;
  }
  // актёр (персонаж) — рисуется плоско на рабочем холсте, затем одной операцией фактура и тень.
  // Кадр персонажа кэшируется по ключу: перерисовка — только когда меняется кадр «стоп-моушн» (12 к/с), поза или состояние
  // (подпись sig); между ними — один drawImage готового кадра с уже запечённой тенью (сдвиг по x/y — переносом).
  var ACT = null, ACTORS = new Map(), ACT_AREA = 0, APAD = 6;
  function actorFlat(x, y, w, h, draw) {
    var pw = Math.ceil(w * RES), ph = Math.ceil(h * RES);
    if (!ACT || ACT.width < pw || ACT.height < ph) ACT = mkCanvas(Math.max(pw, ACT ? ACT.width : 0), Math.max(ph, ACT ? ACT.height : 0));
    var g = ACT.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, pw + 2, ph + 2);
    g.setTransform(RES, 0, 0, RES, 0, 0);
    g.save(); g.translate(-x, -y); g.lineJoin = 'round'; draw(g); g.restore();
    texOver(g, 0, 0, w, h, 0.9);
    g.setTransform(1, 0, 0, 1, 0, 0);
    return { pw: pw, ph: ph };
  }
  function actor(ctx, x, y, w, h, draw, key, sig) {
    if (!HAS_DOM) { ctx.save(); draw(ctx); ctx.restore(); return; }
    w = Math.ceil(w); h = Math.ceil(h);
    if (key) {
      var e = ACTORS.get(key);
      if (!e || e.w !== w || e.h !== h) {
        if (e) ACT_AREA -= e.area;
        var c = mkCanvas((w + APAD * 2) * RES, (h + APAD * 2) * RES); e = { c: c, w: w, h: h, sig: null, x: 0, y: 0, area: c.width * c.height, use: FRAME };
        ACTORS.set(key, e); ACT_AREA += e.area;
        var stale = []; ACTORS.forEach(function (v, k) { if (v.use < FRAME - 90) stale.push(k); });   // персонажи прошлых сцен
        stale.forEach(function (k) { ACT_AREA -= ACTORS.get(k).area; ACTORS.delete(k); });
      }
      e.use = FRAME;
      if (e.sig !== sig) {
        var f = actorFlat(x, y, w, h, draw), g2 = e.c.getContext('2d');
        g2.setTransform(1, 0, 0, 1, 0, 0); g2.clearRect(0, 0, e.c.width, e.c.height);
        g2.shadowColor = 'rgba(40,20,8,0.38)'; g2.shadowBlur = 3 * RES; g2.shadowOffsetX = 1.5 * RES; g2.shadowOffsetY = 2.5 * RES;
        g2.drawImage(ACT, 0, 0, f.pw, f.ph, APAD * RES, APAD * RES, f.pw, f.ph); g2.shadowColor = 'rgba(0,0,0,0)';
        e.sig = sig; e.x = x; e.y = y;
      }
      ctx.drawImage(e.c, x - APAD, y - APAD, w + APAD * 2, h + APAD * 2);
      return;
    }
    var fl = actorFlat(x, y, w, h, draw), k = ctxScale(ctx);
    ctx.save(); ctx.shadowColor = 'rgba(40,20,8,0.38)'; ctx.shadowBlur = 3 * k; ctx.shadowOffsetX = 1.5 * k; ctx.shadowOffsetY = 2.5 * k;
    ctx.drawImage(ACT, 0, 0, fl.pw, fl.ph, x, y, w, h); ctx.restore();
  }
  function ctxScale(ctx) { try { var m = ctx.getTransform && ctx.getTransform(); return m ? Math.hypot(m.a, m.b) || 1 : 1; } catch (e) { return 1; } }

  // ---------- цвета бумаги (одна коробка на всю главу) ----------
  var C = {
    cream: '#f2e5c7', paper: '#f7efdc', kraft: '#c49a64', kraftD: '#9a7046', brown: '#6b4630', dbrown: '#4a3024', ink: '#33241b',
    rust: '#b3533a', rustD: '#8e3c2b', terra: '#cf7a4f', mustard: '#dca543', mustardL: '#f1c96a', sage: '#a7a878', olive: '#7c8650',
    oliveD: '#56603b', oliveDD: '#3e4830', teal: '#4f7472', tealD: '#3b5756', tealL: '#7fa3a0', skin: '#efc8a0', pink: '#df9a86',
    iron: '#4a423b', ironL: '#6f665d', steel: '#8c8a84', brass: '#c9a24a', glass: '#f6dc8a', oil: '#5b3e1e', oilL: '#9a6a2c',
    red: '#c0442e', green: '#6f8f4a', greenL: '#a9c27a', stone: '#9b927f', stoneD: '#6f6758', water: '#5f8a8c'
  };
  var GLOW = '255,196,110';
  // ноты: цвет и высота — общий язык птиц на площади и колокольчиков в маяке (0 — низкая … 4 — высокая)
  var NOTE = ['#4f6f8f', '#5f8f6a', '#d8a63c', '#cf6f3f', '#b04a6a'];

  // ---------- палитры сцен ----------
  // bands — полосы неба сверху вниз; hillFar/hillNear — дальние планы; earth/grass — земля; wall/wallD/floor — интерьер;
  // tint — общий тон-«свет» поверх сцены (rgba), fog — сила тумана над водой (0..1); stars — звёзды.
  var PALS = {
    warm: { bands: ['#4a3426'], wall: ['#a8794c', '#9d6f45', '#b0845a', '#a27648'], wallD: '#7a5235', floor: ['#73513a', '#6a4a33', '#7c5a40'], floorD: '#5d402c',
      win: 'storm', glow: '255,186,100', tint: null, vign: 'rgba(30,14,6,0.42)' },
    shed: { bands: ['#3a3430'], wall: ['#7d6a55', '#73614e', '#86735c', '#6e5d4b'], wallD: '#4f4336', floor: ['#5e5245', '#564b40', '#665849'], floorD: '#44392f',
      win: 'sea', glow: '255,196,120', tint: null, vign: 'rgba(20,16,12,0.45)' },
    stone: { bands: ['#2f3236'], wall: ['#8b8c86', '#83847e', '#93948d', '#7c7d77'], wallD: '#5a5b57', floor: ['#6d6a62', '#64615a', '#76736a'], floorD: '#4d4b46',
      win: 'night', glow: '255,200,130', tint: null, vign: 'rgba(14,16,22,0.5)', stone: true },
    craft: { bands: ['#5a4232'], wall: ['#b48a5c', '#a98053', '#bb9164', '#ad8457'], wallD: '#7a5235', floor: ['#73513a', '#6a4a33', '#7c5a40'], floorD: '#5d402c',
      win: 'storm', glow: '255,186,100', tint: null, vign: 'rgba(30,14,6,0.35)' },
    overcast: { bands: ['#a9b3b4', '#bcc3bf', '#ccd0c6', '#dad9cb'], bandY: [0, 110, 190, 250], sun: null,
      hillFar: '#9aa48a', hillNear: '#7d8b5c', field1: '#b9b07c', field2: '#94a072', grass: '#6c7f45', earth: '#a58560', cloud: '#e9e6dc', cloudB: '#c9cbc4',
      water: '#6f8f92', glow: '255,214,150', tint: null, fog: 0.15 },
    wind: { bands: ['#55667a', '#6e7f90', '#8a98a2', '#a7afaf', '#c9c3ab'], bandY: [0, 80, 150, 210, 262], sun: '#e8d29a', sunY: 268, sunX: 720,
      hillFar: '#5f6d6f', hillNear: '#4c5a55', grass: '#56664a', earth: '#6c5a48', cloud: '#c4cbd0', cloudB: '#8e9aa5', water: '#4c6d78',
      glow: '255,200,120', tint: 'rgba(40,60,90,0.10)', fog: 0.45 },
    dusk: { bands: ['#4b5274', '#76678a', '#b07e86', '#d99a7a', '#ebbd86'], bandY: [0, 80, 150, 205, 250], sun: '#e3854a', sunY: 260, sunX: 300,
      hillFar: '#76666e', hillNear: '#4f4c4c', grass: '#4a5235', earth: '#6b5040', cloud: '#e2b6a2', cloudB: '#9f7f8e', water: '#55607a',
      glow: '255,170,95', tint: 'rgba(70,40,60,0.10)', fog: 0.5, rock: '#6d5f5a', rockL: '#8b7a72' },
    night: { bands: ['#1c2338', '#232c45', '#2c3752', '#36425e'], bandY: [0, 110, 190, 250], sun: null, stars: true,
      hillFar: '#2f3a48', hillNear: '#262f38', grass: '#2b3a32', earth: '#3a3430', cloud: '#56607a', cloudB: '#3a4258', water: '#26364a',
      glow: '255,200,120', tint: 'rgba(10,16,40,0.18)', fog: 0.7, rock: '#3c3a40', rockL: '#4f4c52' },
    lit: { bands: ['#232a44', '#2e3552', '#41465f', '#5a5466'], bandY: [0, 110, 190, 250], sun: null, stars: true,
      hillFar: '#3a4250', hillNear: '#2e3540', grass: '#33402f', earth: '#463a30', cloud: '#7a7488', cloudB: '#4d4a62', water: '#2f4256',
      glow: '255,206,130', tint: null, fog: 0.12, rock: '#46424a', rockL: '#5c5660' },
    cave: { bands: ['#211c19'], wall: null, earth: '#3a3029', grass: '#3a3a2c', water: '#2e4448', glow: '255,180,100', tint: null, rock: '#4a4038', rockL: '#5e5246' },
    dawn: { bands: ['#8fa4a3', '#b8b4a1', '#dcb69c', '#ecc9a1', '#f4dcb2'], bandY: [0, 96, 168, 222, 262], sun: '#e9ae49', sunY: 262, sunX: 600,
      hillFar: '#b2ad80', hillNear: '#848f50', field1: '#cdb874', field2: '#a2a86d', grass: '#6f7e3f', earth: '#a97e4f', cloud: '#f7ecd6', cloudB: '#ecc4a6',
      water: '#6d9393', glow: '255,190,105', tint: null, fog: 0.2 },
    // побережье (движок глав): утро на берегу, марево солеварни, вечер на косе, комната старого маяка до и после огня, лист карты
    morning: { bands: ['#a9c4cc', '#c3d6d4', '#dfe3d2', '#f0e6cc'], bandY: [0, 100, 180, 240], sun: '#f4cf7a', sunY: 200, sunX: 180,
      hillFar: '#9fb1a8', hillNear: '#7f927e', grass: null, earth: '#d6bd8c', sand: '#c9ae7a', cloud: '#fbf3e2', cloudB: '#e3e0d6', water: '#5f949a',
      glow: '255,220,150', tint: null, fog: 0.18, rock: '#8d8a80', rockL: '#a9a598' },
    haze: { bands: ['#c9d6d8', '#d9e1dc', '#e8e8dc', '#f1ecdc'], bandY: [0, 110, 190, 250], sun: '#f6e2a2', sunY: 120, sunX: 700,
      hillFar: '#b9c2b4', hillNear: '#9aa48e', grass: '#8f9a63', earth: '#c8b89a', sand: '#d9cba8', cloud: '#fbf8f0', cloudB: '#e6e6de', water: '#7aa2a8',
      glow: '255,220,150', tint: null, fog: 0.08, rock: '#a39a88', rockL: '#bdb5a3' },
    evening: { bands: ['#4b5274', '#76678a', '#b07e86', '#d99a7a', '#ebbd86'], bandY: [0, 80, 150, 205, 250], sun: '#e3854a', sunY: 250, sunX: 640,
      hillFar: '#76666e', hillNear: '#4f4c4c', grass: null, earth: '#9a7a5c', sand: '#b8977a', cloud: '#e2b6a2', cloudB: '#9f7f8e', water: '#55607a',
      glow: '255,170,95', tint: 'rgba(70,40,60,0.08)', fog: 0.35, rock: '#6d5f5a', rockL: '#8b7a72' },
    predawn: { bands: ['#2b3140'], wall: ['#6f7480', '#676c78', '#777c88', '#62666f'], wallD: '#4a4e58', floor: ['#5d5a55', '#56534e', '#66625c'], floorD: '#44423e',
      win: 'night', glow: '255,200,130', tint: 'rgba(20,30,60,0.12)', vign: 'rgba(14,16,30,0.5)', stone: true },
    sunroom: { bands: ['#6a4a3a'], wall: ['#b08a6a', '#a8805f', '#b89474', '#a37b5c'], wallD: '#7a5a44', floor: ['#7c6450', '#735c49', '#856c57'], floorD: '#5f4a3a',
      win: 'dawn', glow: '255,200,120', tint: null, vign: 'rgba(40,20,10,0.35)', stone: true },
    map: { bands: ['#6f5a44'], glow: '255,210,140', tint: null, fog: 0 },
    day: { bands: ['#9fbdbb', '#b9cfc2', '#d6dcc6', '#e7e3cc'], bandY: [0, 120, 200, 260], sun: '#efc461', sunY: 150, sunX: 760,
      hillFar: '#a9b07c', hillNear: '#7f8f4b', field1: '#cfc078', field2: '#9fae6c', grass: '#6d813f', earth: '#ad8553', cloud: '#f7ecd6', cloudB: '#e4dccb',
      water: '#6d9393', glow: '255,220,150', tint: null, fog: 0 }
  };
  var SCENE_PAL = { workshop: 'warm', square: 'overcast', pier: 'wind', boathouse: 'shed', cave: 'cave', cliff: 'dusk', tower: 'night', stairs: 'stone', lantern: 'night' };
  var MOOD_PAL = { dawn: 'dawn', day: 'day', dusk: 'dusk', night: 'night', cave: 'cave', indoor: 'craft' };
  // ключ палитры: по сцене главы, затем по mood; финал (свет маяка горит) — «lit»
  function palKey(sc) {
    if (!sc) return 'day';
    var k = SCENE_PAL[sc.id] || (sc.pal && PALS[sc.pal] ? sc.pal : null) || MOOD_PAL[sc.mood] || 'day';
    if (k === 'night' && sceneLit(sc)) k = 'lit';
    if (k === 'predawn' && (sc.objects || []).some(function (o) { return o.kind === 'beacon' && o.state && o.state.lit; })) k = 'sunroom';
    if (sc.id && sc.id.indexOf('mini_') === 0) k = sc.mood === 'night' ? 'night' : 'craft';
    return k;
  }
  function sceneLit(sc) { var o = sc.objects || []; for (var i = 0; i < o.length; i++) { var s = o[i].state; if (s && s.lit && (o[i].kind === 'tower' || (o[i].kind === 'lamp' && s.big))) return true; } return false; }
  function pal(sc) { return PALS[palKey(sc)] || PALS.day; }
  var INDOOR = { warm: 1, shed: 1, stone: 1, craft: 1, predawn: 1, sunroom: 1, map: 1 };

  // ================= окружение (статичные спрайты) =================
  var K = {};
  K.sky = function (g, it, sc, P) {
    var bands = P.bands, by = P.bandY || [0];
    for (var i = 0; i < bands.length; i++) {
      var y0 = by[i] || 0, R = rng(11 + i), ph = R() * 6, top = [];
      if (i === 0) top = [[-20, -20], [980, -20]];
      else for (var x = -20; x <= 980; x += 20) top.push([x, y0 + Math.sin(x * 0.011 + ph) * 7 + Math.sin(x * 0.031 + ph * 2) * 3]);
      cut(g, top.concat([[980, 560], [-20, 560]]), bands[i], { seed: 40 + i, torn: i > 0, lift: i ? 5 : 0, sx: 0, sy: -0.5, sh: 0.16, texA: 0.5, tornAmp: 2, rim: light(bands[i], 0.55) });
      if (P.sun && i === bands.length - 3) {
        var sx = P.sunX || 600, sy = P.sunY || 262;
        cut(g, ell(sx, sy, 70, 70, 44), light(P.sun, 0.45), { seed: 51, torn: true, lift: 4, sx: 0, sy: 0, sh: 0.12 });
        cut(g, ell(sx, sy, 44, 44, 40), P.sun, { seed: 52, lift: 3, sx: 0, sy: 0.4, sh: 0.2, amp: 0.9 });
      }
    }
    if (P.stars) {
      var Rs = rng(5);
      for (var s = 0; s < 46; s++) {
        var x0 = Rs() * 960, y0b = Rs() * 280, r0 = 1 + Rs() * 2.2;
        if (r0 > 2.6) { cut(g, starPts(x0, y0b, r0 * 1.8, r0 * 0.7, 4), '#f3e6bf', { seed: 70 + s, lift: 1, raw: true, sh: 0.3 }); }
        else { g.fillStyle = 'rgba(245,235,200,' + (0.45 + Rs() * 0.5) + ')'; g.beginPath(); g.arc(x0, y0b, r0 * 0.7, 0, TAU); g.fill(); }
      }
    }
  };
  function starPts(cx, cy, r1, r2, n) { var p = []; for (var i = 0; i < n * 2; i++) { var a = i / (n * 2) * TAU - Math.PI / 2, r = i % 2 ? r2 : r1; p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return p; }

  K.moon = function (g, it) {
    var r = (it.w || 40) / 2, cx = it.x + r, cy = it.y + r;
    cut(g, ell(cx, cy, r * 1.5, r * 1.5, 36), 'rgba(245,235,210,0.12)', { seed: 1, lift: 0, tex: false, edge: false });
    cut(g, ell(cx, cy, r, r, 36), '#f5ebd2', { seed: it.seed || 2, lift: 3, sh: 0.25, amp: 0.8 });
    cut(g, ell(cx - r * 0.3, cy - r * 0.15, r * 0.22, r * 0.2, 16), '#e4d5b2', { seed: 3, lift: 0.8, sh: 0.12 });
    cut(g, ell(cx + r * 0.25, cy + r * 0.3, r * 0.14, r * 0.13, 14), '#e4d5b2', { seed: 4, lift: 0.8, sh: 0.12 });
  };

  function cloudPts(x, y, w, h, seed) {
    var R = rng(seed), n = 3 + Math.floor(R() * 2), bumps = [], bot = y + h * 0.86;
    for (var i = 0; i < n; i++) { var f = (i + 0.5) / n, r = h * (0.32 + R() * 0.32) * (i === 1 || i === 2 ? 1.25 : 1); bumps.push([x + w * (0.08 + f * 0.84), bot - r * 0.35, Math.min(r, w * 0.32)]); }
    var top = [];
    for (var xx = x; xx <= x + w; xx += 4) { var yy = bot; bumps.forEach(function (b) { var d = xx - b[0]; if (Math.abs(d) < b[2]) yy = Math.min(yy, b[1] - Math.sqrt(b[2] * b[2] - d * d)); }); top.push([xx, yy]); }
    return top.concat([[x + w, bot], [x, bot]]);
  }
  K.cloud = function (g, it, sc, P) {
    var s = it.seed || 1;
    cut(g, cloudPts(it.x - it.w * 0.06, it.y - it.h * 0.14, it.w * 0.92, it.h, s + 5), P.cloudB || '#d8d0c0', { seed: s + 8, torn: true, lift: 3, sh: 0.14, sx: 0.3, sy: 0.6 });
    cut(g, cloudPts(it.x, it.y, it.w, it.h, s), P.cloud || '#f2e8d4', { seed: s + 2, torn: true, lift: 4, sh: 0.18, sx: 0.3, sy: 0.7 });
  };

  K.hill = function (g, it, sc, P) {
    var R = rng(it.seed || 1), x = it.x, y = it.y, w = it.w, h = it.h, amp = Math.min(30, h * 0.2), ph1 = R() * 6, ph2 = R() * 6, top = [];
    for (var xx = x; xx <= x + w + 1; xx += 16) top.push([xx, y + amp * (1 + Math.sin(xx * 0.0062 + ph1)) * 0.55 + amp * 0.35 * Math.sin(xx * 0.019 + ph2)]);
    var col = P.hillFar || '#8a8a70';
    var base = cut(g, top.concat([[x + w, H + 20], [x, H + 20]]), col, { seed: (it.seed || 1) + 100, torn: true, lift: 6, sx: 0, sy: -0.35, sh: 0.22, rim: light(col, 0.5) });
    g.save(); poly(g, base); g.clip();
    var rimB = top.map(function (q, k) { return [q[0], q[1] + 7 + Math.sin(k * 1.7) * 3]; }).reverse();
    cut(g, top.map(function (q) { return [q[0], q[1] - 4]; }).concat(rimB), light(col, 0.25), { seed: (it.seed || 1) + 140, lift: 0, amp: 1.4, step: 5 });
    if (h > 150 && P.field1) { // лоскутные поля на большом холме
      for (var i = 0; i < 4; i++) {
        var fy = y + 50 + i * 24 + R() * 8, fx = x + 60 + R() * (w - 360), fw = 140 + R() * 220;
        cut(g, [[fx, fy], [fx + fw, fy - 8], [fx + fw + 20, fy + 14], [fx + 10, fy + 20]], i % 2 ? P.field1 : P.field2, { seed: 200 + i, lift: 2, sh: 0.2 });
        stitch(g, [[fx + 8, fy + 8], [fx + fw + 4, fy + 1]], 'rgba(250,240,215,0.5)', 0.9);
      }
    }
    if (P.hillNear) { // ближняя гряда снизу
      var t2 = []; for (var x2 = x; x2 <= x + w + 1; x2 += 20) t2.push([x2, y + h * 0.55 + Math.sin(x2 * 0.011 + ph2) * h * 0.08]);
      cut(g, t2.concat([[x + w, y + h + 30], [x, y + h + 30]]), P.hillNear, { seed: (it.seed || 1) + 160, torn: true, lift: 4, sx: 0, sy: -0.4, sh: 0.2, rim: light(P.hillNear, 0.45) });
    }
    g.restore();
    if (P.water && y + h < 420 && sc && !INDOOR[palKey(sc)]) { // ниже мыса — море до горизонта ущелья
      var sea = []; for (var x5 = x - 10; x5 <= x + w + 10; x5 += 16) sea.push([x5, y + h + 6 + Math.sin(x5 * 0.02) * 2]);
      cut(g, sea.concat([[x + w + 10, H + 20], [x - 10, H + 20]]), P.water, { seed: (it.seed || 1) + 180, torn: true, rim: light(P.water, 0.5), lift: 3, sx: 0, sy: -0.5 });
      var Rw = rng((it.seed || 1) + 190);
      for (var wv = 0; wv < 26; wv++) { var wx = x + Rw() * w, wy2 = y + h + 20 + Rw() * (H - y - h - 20), ww = 16 + Rw() * 26; cut(g, [[wx, wy2], [wx + ww / 2, wy2 - 2.5], [wx + ww, wy2], [wx + ww / 2, wy2 + 2]], light(P.water, 0.3), { seed: 200 + wv, lift: 0.8, raw: true, sh: 0.2 }); }
      var dg = g.createLinearGradient(0, y + h, 0, H); dg.addColorStop(0, 'rgba(20,20,40,0)'); dg.addColorStop(1, 'rgba(20,20,40,0.45)'); g.fillStyle = dg; g.fillRect(x, y + h, w, H - y - h);
    }
    if (h > 150) { // деревца на гребне
      for (var k = 0; k < 7; k++) {
        var q = top[Math.floor(3 + (k + R() * 0.8) / 7 * (top.length - 6))], s = 1 + R() * 0.6;
        cut(g, [[q[0] - 1.5, q[1] + 4], [q[0] + 1.5, q[1] + 4], [q[0] + 1.2, q[1] - 10 * s], [q[0] - 1.2, q[1] - 10 * s]], '#5b4a3a', { seed: 400 + k, lift: 1, raw: true });
        cut(g, k % 2 ? [[q[0], q[1] - 30 * s], [q[0] + 8 * s, q[1] - 6 * s], [q[0] - 8 * s, q[1] - 6 * s]] : ell(q[0], q[1] - 15 * s, 9 * s, 10 * s, 16), dark(col, 0.2), { seed: 410 + k, lift: 2, sh: 0.2 });
      }
    }
  };

  K.ground = function (g, it, sc, P) {
    var x = it.x, y = it.y, w = it.w, h = it.h, R = rng(it.seed || 1), cave = palKey(sc) === 'cave', earth = P.earth || '#8a6a48';
    var top = []; for (var xx = x - 10; xx <= x + w + 10; xx += 20) top.push([xx, y + Math.sin(xx * 0.02) * 2]);
    cut(g, top.concat([[x + w + 10, y + h + 10], [x - 10, y + h + 10]]), earth, { seed: 500, lift: 5, sx: 0, sy: -0.6, sh: 0.25 });
    if (!cave && P.grass) {
      var gt = [], gb = [];
      for (var x2 = x - 10; x2 <= x + w + 10; x2 += 12) gt.push([x2, y - 6 + Math.sin(x2 * 0.05) * 2 - (R() * 5)]);
      for (var x3 = x + w + 10; x3 >= x - 10; x3 -= 24) gb.push([x3, y + 10 + R() * 6]);
      cut(g, gt.concat(gb), P.grass, { seed: 510, torn: true, lift: 3, sh: 0.3, rim: light(P.grass, 0.55) });
      stitch(g, gt.map(function (q) { return [q[0], q[1] + 9]; }), 'rgba(246,236,205,0.4)', 1);
    }
    var ft = []; for (var x4 = x - 10; x4 <= x + w + 10; x4 += 16) ft.push([x4, y + h - 26 + Math.sin(x4 * 0.03) * 4 + R() * 3]);
    cut(g, ft.concat([[x + w + 10, y + h + 10], [x - 10, y + h + 10]]), dark(earth, 0.3), { seed: 515, torn: true, lift: 4, sx: 0, sy: -0.6, rim: light(earth, 0.35), tornAmp: 1.8 });
    for (var i = 0; i < 8; i++) { // плоские камни
      var sx = x + 40 + i * 120 + R() * 40, sy = y + 34 + R() * 24, rx = 16 + R() * 12;
      cut(g, ell(sx, sy, rx, rx * 0.42, 14), cave ? (i % 2 ? '#5a4e44' : '#4e443b') : (i % 2 ? light(earth, 0.35) : light(earth, 0.25)), { seed: 520 + i, lift: 2, amp: 1.1, sh: 0.25 });
    }
  };

  // дом: «пекарня» (окно-прилавок под навесом, где выглядывает пекарша) или «лодочный сарай» (на причале)
  K.house = function (g, it, sc, P) {
    var x = it.x, y = it.y, w = it.w, h = it.h, st = it.state || {}, shed = sc && sc.id === 'pier';
    var roofH = shed ? h * 0.36 : Math.min(62, h * 0.24), roofY = y + roofH, wallX0 = x + 14, wallX1 = x + w - 14;
    if (!shed) { var chx = x + w * 0.74; cut(g, rectP(chx, y - 16, 22, roofH), C.rustD, { seed: 601, lift: 3 }); cut(g, rectP(chx - 4, y - 20, 30, 8), C.dbrown, { seed: 602, lift: 2 }); }
    var wallCol = shed ? '#7f8f92' : '#e0c08c';
    cut(g, rectP(wallX0, roofY - 6, wallX1 - wallX0, y + h - roofY + 6), wallCol, { seed: 603, lift: 6, sh: 0.3 });
    if (shed) { // доски
      for (var b = 0; b < 9; b++) { var bx = wallX0 + b * (wallX1 - wallX0) / 9; cut(g, rectP(bx + 1, roofY, (wallX1 - wallX0) / 9 - 2, y + h - roofY - 2), b % 2 ? '#768789' : '#839396', { seed: 604 + b, lift: 1.2, amp: 0.5 }); }
      var ox = x + w * 0.5, oy = roofY - roofH * 0.35; // круглое окно на фронтоне
      cut(g, ell(ox, oy, 20, 20, 24), C.dbrown, { seed: 620, lift: 2 }); cut(g, ell(ox, oy, 14, 14, 20), st.windowLit ? C.glass : '#3e4f57', { seed: 621, lift: 0 });
      cut(g, rectP(ox - 1.5, oy - 14, 3, 28), C.dbrown, { seed: 622, raw: true, lift: 0.8 }); cut(g, rectP(ox - 14, oy - 1.5, 28, 3), C.dbrown, { seed: 623, raw: true, lift: 0.8 });
      // спасательный круг и вёсла на стене
      var lx = x + w * 0.2, ly = y + h * 0.55;
      cut(g, ell(lx, ly, 18, 18, 22), '#e9e2d0', { seed: 624, lift: 3 }); cut(g, ell(lx, ly, 9, 9, 18), wallCol, { seed: 625, lift: 0 });
      [0, 1, 2, 3].forEach(function (k) { var a = k * Math.PI / 2 + 0.4; cut(g, rotP(rectP(lx + Math.cos(a) * 13 - 4, ly + Math.sin(a) * 13 - 3, 8, 6), lx + Math.cos(a) * 13, ly + Math.sin(a) * 13, a), C.red, { seed: 626 + k, raw: true, lift: 0.5 }); });
      cut(g, rotP(rectP(x + w * 0.83, y + h * 0.42, 7, 110), x + w * 0.83, y + h * 0.42, 0.12), C.kraft, { seed: 630, lift: 2.5 });
      cut(g, rotP(ell(x + w * 0.83 - 7, y + h * 0.42 + 112, 9, 18, 14), x + w * 0.83, y + h * 0.42, 0.12), C.kraft, { seed: 631, lift: 2.5 });
    } else {
      cut(g, rectP(wallX0, roofY + 2, 10, y + h - roofY - 2), C.brown, { seed: 604, lift: 1.5 });
      cut(g, rectP(wallX1 - 10, roofY + 2, 10, y + h - roofY - 2), C.brown, { seed: 605, lift: 1.5 });
      cut(g, rectP(wallX0, y + h * 0.62, wallX1 - wallX0, 8), C.brown, { seed: 606, lift: 1.5 });
      // окно-прилавок (здесь пекарша): тёмная глубина, полка, навес в полоску
      var hx = x + w * 0.27, hy = y + h * 0.24, hw = w * 0.42, hh = h * 0.27;
      cut(g, rectP(hx - 7, hy - 7, hw + 14, hh + 14), C.dbrown, { seed: 640, lift: 3 });
      cut(g, rectP(hx, hy, hw, hh), st.windowLit ? '#8a6038' : '#5a3d2a', { seed: 641, lift: 0, amp: 0.4 });
      cut(g, rectP(hx + 6, hy + hh * 0.35, hw - 12, 5), '#3f2a1d', { seed: 642, lift: 0.5, raw: true });
      if (st.fish) for (var fb = 0; fb < 5; fb++) { var fxx = hx + 12 + fb * (hw - 24) / 4; strokeL(g, [[fxx, hy + 2], [fxx, hy + 10]], '#3f2a1d', 1.2); cut(g, [[fxx - 4, hy + 10], [fxx + 4, hy + 10], [fxx + 3, hy + hh * 0.62], [fxx, hy + hh * 0.72], [fxx - 3, hy + hh * 0.62]], fb % 2 ? '#b98a4a' : '#a8743a', { seed: 643 + fb, lift: 1.2 }); } // вяленая рыба (рыбацкий дом, коптильня)
      else if (st.salt) for (var sb = 0; sb < 4; sb++) { var sxx = hx + 16 + sb * (hw - 32) / 3, syy = hy + hh * 0.35; cut(g, [[sxx - 9, syy], [sxx, syy - 16], [sxx + 9, syy]], '#f6f4ee', { seed: 643 + sb, lift: 1.2 }); } // соль конусами (солеварня)
      else for (var lb = 0; lb < 4; lb++) cut(g, ell(hx + 16 + lb * (hw - 32) / 3, hy + hh * 0.35 - 6, 9, 6, 12), '#d39a55', { seed: 643 + lb, lift: 1.2 }); // караваи на полке
      cut(g, rectP(hx - 12, hy + hh, hw + 24, 10), '#b98d58', { seed: 648, lift: 3 }); // прилавок
      var aw = [], na = 8; aw.push([hx - 18, hy - 12]); aw.push([hx + hw + 18, hy - 12]);
      for (var k2 = na; k2 >= 0; k2--) { var fx = hx - 18 + k2 * (hw + 36) / na; aw.push([fx, hy + 16]); if (k2) aw.push([fx - (hw + 36) / na / 2, hy + 10]); }
      cut(g, aw, C.cream, { seed: 650, lift: 3.5, raw: true });
      g.save(); poly(g, aw); g.clip(); for (var s2 = 0; s2 < na; s2 += 2) flat(g, rectP(hx - 18 + s2 * (hw + 36) / na, hy - 14, (hw + 36) / na, 34), st.fish ? C.teal : st.salt ? '#8fa3b0' : C.rust); g.restore();
      // вывеска пекарни: крендель на круге
      var sgx = x + w * 0.86, sgy = roofY + 26;
      cut(g, rectP(sgx - 20, sgy - 26, 30, 4), C.iron, { seed: 655, raw: true, lift: 1.5 });
      cut(g, ell(sgx, sgy, 16, 16, 24), C.cream, { seed: 656, lift: 3 }); if (st.fish || st.salt) drawIconRaw(g, st.fish ? 'fish' : 'salt', sgx, sgy, 24); else cut(g, ell(sgx, sgy + 2, 10, 7, 18), '#c98a45', { seed: 657, lift: 1.2 });
      // дверь
      var dx = x + w * 0.74, dw = w * 0.17, dh = h * 0.3, dy = y + h - dh - 2;
      cut(g, rectP(dx - 5, dy - 5, dw + 10, dh + 5), C.dbrown, { seed: 660, lift: 2.5 });
      cut(g, rectP(dx, dy, dw, dh), '#80553a', { seed: 661, lift: 1.5 }); brad(g, dx + dw * 0.8, dy + dh * 0.55, 2.5);
    }
    for (var f = 0; f < 7; f++) cut(g, rectP(wallX0 - 4 + f * (wallX1 - wallX0 + 8) / 7, y + h - 12, (wallX1 - wallX0 + 8) / 7 - 2, 13), f % 2 ? '#8f8670' : '#a39a82', { seed: 670 + f, lift: 1.5 });
    // крыша
    var rx0 = x - 10, rx1 = x + w + 10, apx = x + w * 0.5, roofCol = shed ? '#3f5560' : C.rustD;
    var rbase = cut(g, [[apx, y], [rx1, roofY], [rx0, roofY]], roofCol, { seed: 680, lift: 6, sh: 0.32 });
    g.save(); poly(g, rbase); g.clip();
    for (var row = 0; row < 6; row++) {
      var ry = y + 12 + row * (roofY - y) / 5.5, strip = [[rx0 - 10, ry - 16], [rx1 + 10, ry - 16]], scw = 20;
      for (var s3 = rx1 + 10; s3 >= rx0 - 10; s3 -= scw) for (var a = 0; a <= 6; a++) { var an = a / 6 * Math.PI; strip.push([s3 - scw / 2 + Math.cos(an) * scw / 2, ry + Math.sin(an) * 7]); }
      cut(g, strip, shed ? (row % 2 ? '#4a6470' : '#557380') : (row % 2 ? C.rust : mix(C.rust, C.terra, 0.35)), { seed: 690 + row, lift: 2, sh: 0.3, raw: true });
    }
    g.restore();
    cut(g, [[apx, y - 4], [rx1 + 6, roofY + 2], [rx1 - 6, roofY + 4], [apx, y + 10], [rx0 + 6, roofY + 4], [rx0 - 6, roofY + 2]], C.dbrown, { seed: 699, lift: 2 });
  };

  // маяк: белые и терракотовые полосы, галерея, фонарная со стеклом (тёмным или горящим)
  K.tower = function (g, it, sc, P) {
    var x = it.x, y = it.y, w = it.w, h = it.h, cx = x + w / 2, lit = it.state && it.state.lit, top = h * 0.2, big = w > 100;
    var body = [[x + w * 0.16, y + h], [x + w * 0.84, y + h], [x + w * 0.68, y + top], [x + w * 0.32, y + top]];
    if (!big) { var mc = P.rock || dark(P.hillFar || '#7a7466', 0.25); cut(g, [[x - w * 0.9, y + h + 110], [x - w * 0.5, y + h + 30], [x - w * 0.1, y + h - 6], [x + w * 0.3, y + h - 12], [x + w * 0.9, y + h - 8], [x + w * 1.3, y + h + 24], [x + w * 1.9, y + h + 110]], mc, { seed: 760 + (it.seed || 0), lift: 4, sh: 0.3 }); cut(g, [[x - w * 0.3, y + h + 6], [x + w * 0.4, y + h - 8], [x + w * 0.2, y + h + 40]], light(mc, 0.15), { seed: 761, lift: 1, sh: 0.2 }); }
    var base = cut(g, body, '#ede2c8', { seed: 700 + (it.seed || 0), lift: 5, sh: 0.3 });
    g.save(); poly(g, base); g.clip();
    for (var i = 0; i < 4; i++) { var yy = y + top + (h - top) * (i * 2 + 1) / 8; cut(g, [[x - 5, yy + (h - top) / 8], [x + w + 5, yy + (h - top) / 8 - 6], [x + w + 5, yy - 6], [x - 5, yy]], C.rust, { seed: 710 + i, lift: 1.5, sh: 0.25 }); }
    flat(g, [[cx + w * 0.06, y + top], [x + w * 0.68, y + top], [x + w * 0.84, y + h], [cx + w * 0.1, y + h]], 'rgba(40,30,40,0.14)'); // теневая сторона
    g.restore();
    if (big) { // окошки на башне
      [0.42, 0.62].forEach(function (f, k) { var wy = y + h * f; cut(g, rrP(cx - 9, wy, 18, 26, 9), C.dbrown, { seed: 720 + k, lift: 1.5 }); cut(g, rrP(cx - 6, wy + 3, 12, 20, 6), lit ? C.glass : '#2e3442', { seed: 722 + k, lift: 0 }); });
    }
    cut(g, rectP(x + w * 0.18, y + top - 6, w * 0.64, Math.max(5, h * 0.025)), C.iron, { seed: 730, lift: 2.5 }); // галерея
    for (var r = 0; r < 7; r++) cut(g, rectP(x + w * 0.2 + r * w * 0.6 / 6 - 1, y + top - 6 - h * 0.035, 2, h * 0.035), C.iron, { seed: 731 + r, raw: true, lift: 1 });
    cut(g, rectP(x + w * 0.18, y + top - 6 - h * 0.04, w * 0.64, 2.5), C.iron, { seed: 739, raw: true, lift: 1 });
    var gx = x + w * 0.33, gw = w * 0.34, gy = y + top * 0.32, gh = top * 0.52;
    cut(g, rectP(gx, gy, gw, gh), lit ? '#fff0b8' : '#2c3546', { seed: 740, lift: 2 });
    if (!lit) cut(g, [[gx + gw * 0.15, gy + gh * 0.1], [gx + gw * 0.35, gy + gh * 0.1], [gx + gw * 0.2, gy + gh * 0.9], [gx + gw * 0.05, gy + gh * 0.9]], 'rgba(160,180,200,0.35)', { seed: 741, lift: 0, raw: true, tex: false });
    for (var m = 1; m < 3; m++) cut(g, rectP(gx + gw * m / 3 - 1, gy, 2, gh), C.iron, { seed: 742 + m, raw: true, lift: 0.5 });
    cut(g, [[x + w * 0.26, gy + 2], [cx, y], [x + w * 0.74, gy + 2]], C.rustD, { seed: 750, lift: 3 });
    brad(g, cx, y + 2, big ? 4 : 2);
  };

  K.tree = function (g, it, sc, P) {
    var x = it.x, y = it.y, w = it.w, h = it.h, R = rng(it.seed || 4), cx = x + w * 0.5, base = P.hillNear || '#6f7c46', dusk = palKey(sc) === 'dusk';
    var k = w / 90;
    cut(g, [[cx - 9 * k, y + h], [cx + 11 * k, y + h], [cx + 6 * k, y + h * 0.55], [cx + 24 * k, y + h * 0.4], [cx + 20 * k, y + h * 0.37], [cx + 3 * k, y + h * 0.5], [cx + 2 * k, y + h * 0.3], [cx - 3 * k, y + h * 0.3], [cx - 4 * k, y + h * 0.5], [cx - 22 * k, y + h * 0.38], [cx - 24 * k, y + h * 0.42], [cx - 6 * k, y + h * 0.58]], '#5f4632', { seed: 800, lift: 4 });
    var cols = dusk ? ['#4a5240', '#555d44', '#606a4a', '#6c754f'] : [dark(base, 0.15), base, light(base, 0.12), light(base, 0.25)];
    var crowns = [[cx - w * 0.24, y + h * 0.3, w * 0.32], [cx + w * 0.22, y + h * 0.28, w * 0.32], [cx, y + h * 0.18, w * 0.38], [cx - w * 0.1, y + h * 0.36, w * 0.26]];
    crowns.forEach(function (c, i) { cut(g, lump(c[0], c[1], c[2], 810 + i + (it.seed || 0) * 7, 5 + i % 3, 0.16), cols[i], { seed: 820 + i, lift: 4.5, sh: 0.3, torn: i >= 2, rim: light(cols[i], 0.5), tornAmp: 1.8 }); });
    if (!dusk) for (var f = 0; f < 5; f++) { var a = R() * TAU, rr = R() * w * 0.3; cut(g, ell(cx + Math.cos(a) * rr, y + h * 0.28 + Math.sin(a) * rr * 0.6, 4.5, 4.5, 12), f % 2 ? '#c1593a' : '#d98a48', { seed: 840 + f, lift: 2, amp: 0.5 }); }
  };

  K.plant = function (g, it, sc, P) {
    var x = it.x, y = it.y, w = it.w, h = it.h, R = rng(it.seed || 1), bx = x + w / 2, by = y + h, n = 8, night = palKey(sc) === 'night' || palKey(sc) === 'lit';
    for (var i = 0; i < n; i++) {
      var a = -Math.PI / 2 + (i / (n - 1) - 0.5) * 1.9 + (R() - 0.5) * 0.25, L = h * 0.95 * (0.65 + R() * 0.4), wd = 8;
      var tip = [bx + Math.cos(a) * L, by + Math.sin(a) * L], nx = -Math.sin(a), ny = Math.cos(a), mid = [bx + Math.cos(a) * L * 0.5, by + Math.sin(a) * L * 0.5], bend = (i - n / 2) * 2;
      var col = night ? (i % 2 ? '#2c3a30' : '#34443a') : (i % 2 ? C.oliveDD : '#4b5636');
      cut(g, [[bx - nx * 2, by - ny * 2], [mid[0] - nx * wd + bend, mid[1] - ny * wd], [tip[0] + bend * 1.5, tip[1]], [mid[0] + nx * wd + bend, mid[1] + ny * wd], [bx + nx * 2, by + ny * 2]], col, { seed: 910 + i, lift: 5, sh: 0.35, amp: 0.8 });
    }
    if (!night && palKey(sc) !== 'cave') { var fx = bx + 10, fy = y + 12; cut(g, lump(fx, fy, 7, 940, 5, 0.3), C.mustard, { seed: 950, lift: 3, sh: 0.3 }); brad(g, fx, fy, 1.8); }
  };

  // камень: широкий — скальный массив с плоским верхом (по нему ходят); иначе — валун
  K.rock = function (g, it, sc, P) {
    var x = it.x, y = it.y, w = it.w, h = it.h, R = rng(it.seed || 1), col = P.rock || '#8a7e6c', colL = P.rockL || light(col, 0.2);
    if (w > h * 2.4) {
      var top = []; for (var xx = x; xx <= x + w; xx += 18) top.push([xx, y - 2 + R() * 4]);
      cut(g, top.concat([[x + w, y + h + 20], [x, y + h + 20]]), col, { seed: 1000 + (it.seed || 0), lift: 5, sx: 0, sy: -0.4, sh: 0.3 });
      for (var s = 0; s < 3; s++) { var sy = y + 18 + s * 26, pts = []; for (var x2 = x - 4; x2 <= x + w + 4; x2 += 22) pts.push([x2, sy + Math.sin(x2 * 0.02 + s) * 4 + R() * 3]); cut(g, pts.concat(pts.slice().reverse().map(function (q) { return [q[0], q[1] + 9 + R() * 4]; })), s % 2 ? dark(col, 0.12) : colL, { seed: 1010 + s, lift: 1.5, sh: 0.2 }); }
      [[x, -1], [x + w, 1]].forEach(function (e, k) { // обрыв: если край камня в кадре — скальная стенка уходит вниз
        if (e[0] <= 4 || e[0] >= W - 4) return; var d = e[1], fx = e[0], face = [[fx, y - 2]];
        for (var yy = y; yy <= H + 20; yy += 16) face.push([fx + d * (4 + R() * 10 + (yy - y) * 0.12), yy]);
        face.push([fx - d * 30, H + 20], [fx - d * 30, y]);
        cut(g, face, dark(col, 0.25), { seed: 1015 + k, lift: 4, sx: d * 0.8, sy: 0.2, sh: 0.45 });
      });
      var lip = []; for (var x3 = x; x3 <= x + w; x3 += 14) lip.push([x3, y - 3 + Math.sin(x3 * 0.1) * 1.5]);
      cut(g, lip.concat(lip.slice().reverse().map(function (q) { return [q[0], q[1] + 8]; })), light(col, 0.3), { seed: 1020, lift: 2, sh: 0.25 });
      return;
    }
    var p = [[x, y + h], [x + w * 0.06, y + h * 0.45], [x + w * 0.28, y + h * 0.1], [x + w * 0.6, y], [x + w * 0.9, y + h * 0.3], [x + w, y + h]];
    cut(g, p, col, { seed: 1030 + (it.seed || 0), lift: 4, sh: 0.32 });
    cut(g, [[x + w * 0.3, y + h * 0.16], [x + w * 0.6, y + h * 0.06], [x + w * 0.66, y + h * 0.5], [x + w * 0.36, y + h * 0.58]], colL, { seed: 1031 + (it.seed || 0), lift: 1, sh: 0.2 });
  };

  // вода: основа (статично) — волны живые (LIVE.water)
  K.water = function (g, it, sc, P) {
    var x = it.x, y = it.y, w = it.w, h = it.h, col = P.water || C.water, top = [];
    for (var xx = x - 4; xx <= x + w + 4; xx += 16) top.push([xx, y + Math.sin(xx * 0.03 + (it.seed || 0)) * 2]);
    cut(g, top.concat([[x + w + 4, y + h + 4], [x - 4, y + h + 4]]), col, { seed: 1100 + (it.seed || 0), lift: 3, sx: 0, sy: -0.5, torn: true, rim: light(col, 0.5) });
    if (h > 60) { var b2 = []; for (var x2 = x - 4; x2 <= x + w + 4; x2 += 24) b2.push([x2, y + h * 0.45 + Math.sin(x2 * 0.02) * 4]); cut(g, b2.concat([[x + w + 4, y + h + 4], [x - 4, y + h + 4]]), dark(col, 0.15), { seed: 1120, lift: 2, sx: 0, sy: -0.5, torn: true, rim: light(col, 0.3), tornAmp: 1.4 }); }
  };

  // настил: причал на сваях
  K.bridge = function (g, it, sc, P) {
    var x = it.x, y = it.y, w = it.w, h = it.h || 20, st = it.state || {};
    if (st.pier) {
      for (var j = 30; j < w; j += 110) cut(g, rectP(x + j, y + h - 4, 14, 80), '#4e3a2c', { seed: 1210 + j, lift: 3 });
      for (var i = 0; i < w; i += 46) cut(g, rectP(x + i, y, 45, h), i % 92 ? '#8b6a4c' : '#82624a', { seed: 1200 + i, lift: 2.5, amp: 0.6 });
      cut(g, rectP(x - 4, y - 3, w + 8, 5), '#a07e5c', { seed: 1290, lift: 1.5, amp: 0.6 });
      return;
    }
    K._drawbridge(g, it, P);
  };

  K.fence = function (g, it, sc, P) {
    var x = it.x, y = it.y, w = it.w, h = it.h, st = it.state || {}, R = rng(it.seed || 2);
    if (st.rack) return rackDraw(g, it);
    if (st.ladder) {
      cut(g, rectP(x + 4, y - 10, 7, h + 10), C.brown, { seed: 1300, lift: 3 }); cut(g, rectP(x + w - 11, y - 10, 7, h + 10), C.brown, { seed: 1301, lift: 3 });
      for (var i = 8; i < h; i += 22) cut(g, rectP(x + 6, y + i, w - 12, 6), '#a07e5c', { seed: 1302 + i, lift: 2 });
      return;
    }
    if (st.stairs) { // винтовая лестница маяка: ступени-пластины вдоль стены
      var n = 9;
      for (var k = 0; k < n; k++) {
        var sw = w / n, sx = x + k * sw, sh = h * (k + 1) / n;
        cut(g, rectP(sx, y + h - sh, sw + 2, sh), k % 2 ? '#7c7a73' : '#86847c', { seed: 1320 + k, lift: 3, sh: 0.3, sx: -0.6 });
        cut(g, rectP(sx - 2, y + h - sh - 4, sw + 6, 7), '#a5a298', { seed: 1340 + k, lift: 2 });
      }
      cut(g, [[x, y + h - h / n - 30], [x + w, y - 30], [x + w, y - 24], [x, y + h - h / n - 24]], C.iron, { seed: 1360, lift: 2, raw: true }); // перила
      for (var p = 0; p <= n; p += 2) cut(g, rectP(x + p * w / n - 1.5, y + h - h * (p + 1) / n - 28, 3, 30), C.iron, { seed: 1361 + p, raw: true, lift: 1 });
      return;
    }
    cut(g, rectP(x - 4, y + h * 0.3, w + 8, 8), '#9a7650', { seed: 1370, lift: 2 }); cut(g, rectP(x - 4, y + h * 0.68, w + 8, 8), '#9a7650', { seed: 1371, lift: 2 });
    var m = Math.max(2, Math.round(w / 22));
    for (var q = 0; q < m; q++) {
      var px = x + q * w / m + 3, pw = w / m - 6, ph = h * (0.8 + R() * 0.12), tp = y + h - ph;
      cut(g, rotP([[px, tp + 7], [px + pw / 2, tp], [px + pw, tp + 7], [px + pw, y + h], [px, y + h]], px + pw / 2, y + h, (R() - 0.5) * 0.05), mix('#cbb48a', '#a99068', R() * 0.6), { seed: 1380 + q, lift: 2.5, sh: 0.3 });
    }
  };

  // простая труба (в сарае) и плитка мини-игры «трубы»
  K.pipe = function (g, it, sc, P) {
    var x = it.x, y = it.y, w = it.w, h = it.h, st = it.state || {};
    if (st.shape) return pipeTile(g, it, P);
    cut(g, rectP(x, y, w, h), '#ad6a40', { seed: 1400, lift: 3 }); cut(g, rectP(x, y + h * 0.15, w, h * 0.25), '#cf8c5c', { seed: 1401, lift: 0, amp: 0.4 });
    for (var r = x + 20; r < x + w - 6; r += 60) { cut(g, rectP(r, y - 3, 10, h + 6), '#7f4a2e', { seed: 1410 + r, lift: 1.5 }); }
  };

  // плитка мини-игры «трубы»: картонка с медной трубой; масло — янтарная сердцевина; закреплённая — железная с заклёпками;
  // поворачиваемая — с маленькой круговой стрелкой в углу
  var PDIR = [[0, -1], [1, 0], [0, 1], [-1, 0]], POPEN = { I: [0, 2], L: [0, 1], T: [0, 1, 2], X: [0, 1, 2, 3], cap: [1], sink: [3] };
  function pipeTile(g, it, P) {
    var st = it.state, x = it.x, y = it.y, w = it.w, h = it.h, cx = x + w / 2, cy = y + h / 2, r = Math.min(w, h) / 2, open = POPEN[st.shape];
    var endp = st.shape === 'cap' || st.shape === 'sink';
    if (!endp) cut(g, rrP(x + 2, y + 2, w - 4, h - 4, 8), st.fixed ? '#6f665d' : '#d8c29a', { seed: 1420 + ((x * 7 + y) | 0) % 50, lift: 3.5, sh: 0.38 });
    if (!open) { drawIconRaw(g, 'question', cx, cy, r); return; }
    var rot = endp ? 0 : (st.rot || 0), arms = open.map(function (d0) { return PDIR[(d0 + rot) % 4]; });
    arms.forEach(function (d) { cut(g, band([[cx, cy], [cx + d[0] * r, cy + d[1] * r]], 30), '#7f4a2e', { seed: 1430, lift: 2.5, raw: true }); });
    arms.forEach(function (d) { cut(g, band([[cx, cy], [cx + d[0] * (r - 1), cy + d[1] * (r - 1)]], 22), '#c47a48', { seed: 1431, lift: 0, raw: true }); });
    cut(g, ell(cx, cy, 17, 17, 18), '#7f4a2e', { seed: 1432, lift: 1, raw: true }); cut(g, ell(cx, cy, 12.5, 12.5, 16), '#c47a48', { seed: 1433, lift: 0, raw: true });
    var inner = st.wet ? C.oilL : '#3a2a20';
    arms.forEach(function (d) { flat(g, band([[cx, cy], [cx + d[0] * (r - 2), cy + d[1] * (r - 2)]], 9), inner); });
    flat(g, ell(cx, cy, 6.5, 6.5, 12), inner);
    if (st.wet) arms.forEach(function (d) { flat(g, band([[cx + d[0] * 4, cy + d[1] * 4 - 1.5], [cx + d[0] * (r - 6), cy + d[1] * (r - 6) - 1.5]], 2.5), 'rgba(255,230,150,0.6)'); });
    arms.forEach(function (d) { var ex = cx + d[0] * (r - 4), ey = cy + d[1] * (r - 4); cut(g, band([[ex - d[1] * 17, ey - d[0] * 17 + 0], [ex + d[1] * 17, ey + d[0] * 17]], 6), '#9a5a34', { seed: 1434, lift: 1, raw: true }); });
    if (st.fixed) [[x + 11, y + 11], [x + w - 11, y + 11], [x + 11, y + h - 11], [x + w - 11, y + h - 11]].forEach(function (q) { brad(g, q[0], q[1], 4); });
    else if (!endp) { g.save(); g.beginPath(); g.arc(x + w - 15, y + 15, 7, -2.6, 1.4); g.strokeStyle = 'rgba(90,60,35,0.75)'; g.lineWidth = 2.2; g.stroke(); flat(g, [[x + w - 15 + Math.cos(1.4) * 7 - 4, y + 15 + Math.sin(1.4) * 7 - 1], [x + w - 15 + Math.cos(1.4) * 7 + 3, y + 15 + Math.sin(1.4) * 7 + 4], [x + w - 15 + Math.cos(1.4) * 7 + 3, y + 15 + Math.sin(1.4) * 7 - 4]], 'rgba(90,60,35,0.75)'); g.restore(); }
    if (st.shape === 'sink') { // воронка над маслёнкой
      cut(g, [[cx - 34, cy - 30], [cx + 30, cy - 30], [cx + 8, cy + 8], [cx - 10, cy + 8]], '#a7a49a', { seed: 1440, lift: 3 });
      cut(g, rectP(cx - 7, cy + 6, 12, 22), '#8a877e', { seed: 1441, lift: 2 });
    }
  }

  K.wall = function (g, it, sc, P) {
    var x = it.x, y = it.y, w = it.w, h = it.h, R = rng(it.seed || 2), st = it.state || {};
    if (st.cave) return caveWall(g, it, P);
    if (w < 700) { // подложка крупного плана: картонный поднос с бортиком
      cut(g, rrP(x, y, w, h, 10), '#7a5a3c', { seed: 1590, lift: 6, sh: 0.45 });
      cut(g, rrP(x + 8, y + 8, w - 16, h - 16, 6), '#a88052', { seed: 1591, lift: 0, amp: 0.5 });
      [[x + 8, y + 8], [x + w - 8, y + 8], [x + 8, y + h - 8], [x + w - 8, y + h - 8]].forEach(function (q) { brad(g, q[0], q[1], 3.5); });
      return;
    }
    if (!P.wall) P = PALS.craft;
    var cols = P.wall;
    cut(g, rectP(x - 10, y - 10, w + 20, h + 20), P.wallD, { seed: 1600, lift: 0, raw: true });
    if (P.stone) { // каменная кладка маяка — ряды блоков
      for (var row = 0, yy = y - 10; yy < y + h; row++, yy += 46) {
        for (var bx = x - 10 - (row % 2) * 40; bx < x + w + 10; bx += 80) { var bw2 = 76 * (0.55 + 0.45 * Math.sin(Math.PI * clamp((bx + 40) / W, 0.02, 0.98))); cut(g, rectP(bx + 2 + (76 - bw2) / 2, yy + 2, bw2 + 1, 42), cols[(row + Math.floor(bx / 80)) & 3], { seed: 1610 + row * 20 + Math.floor(bx), lift: 2.2, sh: 0.3, amp: 0.8 }); }
      }
      var cyl = g.createLinearGradient(x, 0, x + w, 0); cyl.addColorStop(0, 'rgba(10,12,20,0.5)'); cyl.addColorStop(0.3, 'rgba(10,12,20,0)'); cyl.addColorStop(0.7, 'rgba(10,12,20,0)'); cyl.addColorStop(1, 'rgba(10,12,20,0.5)');
      g.fillStyle = cyl; g.fillRect(x - 10, y - 10, w + 20, h + 20);
    } else {
      var px = x - 10, i = 0;
      while (px < x + w + 10) {
        var pw = 58 + R() * 26;
        cut(g, rectP(px + 1, y - 10, pw - 2, h + 10), cols[i % 4], { seed: 1610 + i, lift: 3, sx: 0.8, sy: 0.3, sh: 0.3, amp: 0.6, step: 14 });
        for (var k = 0; k < 2; k++) { var kx = px + 10 + R() * (pw - 20), ky = y + 30 + R() * h * 0.6; g.fillStyle = 'rgba(60,35,20,0.22)'; g.beginPath(); g.ellipse(kx, ky, 3 + R() * 2, 1.6, 0, 0, TAU); g.fill(); }
        px += pw; i++;
      }
      if (h > 300) { // панель снизу
        var wy = y + h * 0.78;
        cut(g, rectP(x - 10, wy, w + 20, h - h * 0.78 + 10), P.wallD, { seed: 1650, lift: 4, sx: 0, sy: -0.6 });
        cut(g, rectP(x - 10, wy - 4, w + 20, 9), dark(P.wallD, 0.25), { seed: 1651, lift: 2 });
      }
    }
    var gr = g.createRadialGradient(x + w * 0.45, y + h * 0.45, 60, x + w * 0.5, y + h * 0.5, Math.max(w, h) * 0.75);
    gr.addColorStop(0, 'rgba(255,220,160,0)'); gr.addColorStop(1, P.vign || 'rgba(30,14,6,0.4)');
    g.fillStyle = gr; g.fillRect(x - 10, y - 10, w + 20, h + 20);
  };
  function caveWall(g, it, P) {
    var x = it.x, y = it.y, w = it.w, h = it.h, R = rng(it.seed || 6), cols = ['#3e3530', '#463c35', '#4f443b', '#3a312c'];
    cut(g, rectP(x - 10, y - 10, w + 20, h + 20), '#2a231f', { seed: 1700, lift: 0, raw: true });
    for (var i = 0; i < 9; i++) { // слои скалы
      var yy = y + i * h / 8 - 20, pts = []; for (var xx = x - 20; xx <= x + w + 20; xx += 30) pts.push([xx, yy + Math.sin(xx * 0.008 + i) * 22 + R() * 10]);
      cut(g, pts.concat([[x + w + 20, y + h + 20], [x - 20, y + h + 20]]), cols[i % 4], { seed: 1710 + i, torn: i > 0, lift: 4, sx: 0, sy: -0.5, sh: 0.4, rim: '#6a5d50', tornAmp: 1.6 });
    }
    for (var k = 0; k < 10; k++) { var sx = x + w * rnd(it.seed || 6, k + 7), L = 30 + 60 * rnd(it.seed || 6, k + 3); cut(g, [[sx - 12, y - 10], [sx + 12, y - 10], [sx + 2, y + L], [sx - 1, y + L]], '#4a3f37', { seed: 1730 + k, lift: 3, sh: 0.4 }); }
    // светлые прожилки (перламутр в скале — намёк на ракушки)
    for (var v = 0; v < 6; v++) { var vx = x + R() * w, vy = y + 60 + R() * (h - 120); cut(g, ell(vx, vy, 6 + R() * 6, 2 + R() * 2, 10), '#6d6a74', { seed: 1750 + v, lift: 1, sh: 0.2 }); }
  }

  K.floor = function (g, it, sc, P) {
    var x = it.x, y = it.y, w = it.w, h = it.h, R = rng(it.seed || 4);
    if (!P.floor) P = palKey(sc) === 'lit' || palKey(sc) === 'night' ? { floor: ['#4e4a46', '#46423e', '#56524d'], floorD: '#33302d' } : PALS.craft;
    cut(g, rectP(x - 10, y, w + 20, h + 10), P.floorD, { seed: 1800, lift: 5, sx: 0, sy: -0.7, sh: 0.35 });
    var rows = [y + 4, y + 26, y + 52, y + 82];
    for (var i = 0; i < rows.length; i++) {
      var rh = (rows[i + 1] || y + h + 10) - rows[i] - 2, ox = R() * 120;
      for (var bx = x - 10 - ox; bx < x + w + 10; bx += 150 + R() * 60) cut(g, rectP(bx + 1, rows[i], 148, rh), P.floor[Math.floor(R() * 3)], { seed: 1810 + i * 20 + Math.floor(bx), lift: 1.5, amp: 0.5 });
    }
    if (sc && sc.id === 'workshop') { // половик с зигзагом
      var rx = 300, ry = 482, rw = 360, rh2 = 40, pk = [];
      for (var s = 0; s <= 36; s++) pk.push([rx + s * rw / 36, ry + (s % 2 ? -4 : 0)]);
      for (var s3 = 36; s3 >= 0; s3--) pk.push([rx + s3 * rw / 36, ry + rh2 + (s3 % 2 ? 4 : 0)]);
      cut(g, pk, C.rustD, { seed: 1890, lift: 2.5, raw: true }); cut(g, rectP(rx + 12, ry + 8, rw - 24, rh2 - 16), C.mustard, { seed: 1891, lift: 1.5 });
      stitch(g, [[rx + 6, ry + 4], [rx + rw - 6, ry + 4]], 'rgba(250,225,170,0.6)', 1);
    }
  };

  // окно: вид наружу по палитре сцены (шторм с погасшим маяком / море / ночь); frameOnly — только рама (окна фонарной)
  K.window = function (g, it, sc, P) {
    var x = it.x, y = it.y, w = it.w, h = it.h, st = it.state || {};
    if (st.frameOnly) {
      [[x, y, w, 10], [x, y + h - 10, w, 10], [x, y, 10, h], [x + w - 10, y, 10, h], [x + w / 2 - 5, y, 10, h], [x, y + h / 2 - 5, w, 10]].forEach(function (r, i) { cut(g, rectP(r[0], r[1], r[2], r[3]), C.iron, { seed: 1900 + i + (it.seed || 0) * 10, lift: 4, sh: 0.4 }); });
      [[x + 5, y + 5], [x + w - 5, y + 5], [x + 5, y + h - 5], [x + w - 5, y + h - 5], [x + w / 2, y + h / 2]].forEach(function (q) { brad(g, q[0], q[1], 3); });
      return;
    }
    var view = st.dawn ? 'dawn' : (P.win || 'storm');
    cut(g, rectP(x - 10, y - 10, w + 20, h + 20), C.dbrown, { seed: 1910, lift: 4 });
    g.save(); poly(g, rectP(x, y, w, h)); g.clip();
    var sky = view === 'night' ? ['#1c2338', '#2c3752'] : view === 'sea' ? ['#7d8c96', '#a9b1ad'] : view === 'dawn' ? ['#e7a77e', '#f4d3a0'] : ['#5d6875', '#7e8790'];
    flat(g, rectP(x, y, w, h), sky[0]); cut(g, rectP(x - 5, y + h * 0.3, w + 10, h), sky[1], { seed: 1911, torn: true, lift: 2, sx: 0, sy: -0.5, rim: light(sky[1], 0.4) });
    if (view === 'dawn') { cut(g, ell(x + w * 0.35, y + h * 0.68, w * 0.16, w * 0.16, 30), '#f8e3a0', { seed: 1916, lift: 2, torn: true, rim: '#fff6d8' }); }
    if (view === 'night') { for (var s = 0; s < 6; s++) { g.fillStyle = '#efe3bf'; g.beginPath(); g.arc(x + rnd(3, s) * w, y + rnd(4, s) * h * 0.6, 1.2, 0, TAU); g.fill(); } }
    var seaY = y + h * 0.68;
    cut(g, rectP(x - 5, seaY, w + 10, h), view === 'night' ? '#26364a' : view === 'dawn' ? '#7a8f9a' : '#4d6670', { seed: 1912, torn: true, lift: 2, sx: 0, sy: -0.5, rim: '#c8d0cc', tornAmp: 1.5 });
    if (view === 'storm' && w > 100) { // в шторм: тёмный маяк вдалеке и косой дождь
      var tx = x + w * 0.74; cut(g, [[tx - 7, seaY + 2], [tx + 7, seaY + 2], [tx + 4, seaY - 40], [tx - 4, seaY - 40]], '#cfc6b0', { seed: 1913, lift: 1.5 });
      cut(g, rectP(tx - 6, seaY - 50, 12, 10), '#2c3546', { seed: 1914, lift: 1 }); cut(g, [[tx - 8, seaY - 50], [tx, seaY - 58], [tx + 8, seaY - 50]], C.rustD, { seed: 1915, lift: 1 });
      g.strokeStyle = 'rgba(220,230,240,0.35)'; g.lineWidth = 1; for (var r = 0; r < 18; r++) { var rx = x + rnd(9, r) * w, ry = y + rnd(8, r) * h; g.beginPath(); g.moveTo(rx, ry); g.lineTo(rx - 5, ry + 12); g.stroke(); }
    }
    g.restore();
    cut(g, rectP(x + w / 2 - 4, y, 8, h), C.dbrown, { seed: 1920, lift: 2, raw: true });
    cut(g, rectP(x, y + h * 0.45, w, 8), C.dbrown, { seed: 1921, lift: 2, raw: true });
    cut(g, rectP(x - 18, y + h + 8, w + 36, 10), '#6b4630', { seed: 1922, lift: 3 });
  };

  K.shelf = function (g, it, sc, P) {
    var x = it.x, y = it.y, w = it.w, h = it.h || 12;
    cut(g, rectP(x - 6, y, w + 12, h), '#6a4630', { seed: 2100, lift: 4 });
    cut(g, rectP(x - 6, y, w + 12, 3), '#8a6448', { seed: 2101, lift: 0, raw: true });
    [x + 12, x + w - 22].forEach(function (bx, j) { cut(g, [[bx, y + h], [bx + 10, y + h], [bx + 10, y + h + 26]], C.iron, { seed: 2110 + j, lift: 2 }); brad(g, bx + 5, y + h + 5, 1.8); });
    if (w < 300) { // свёрток и банка на полке мастерской (не мешают маслёнке справа)
      cut(g, rectP(x + 6, y - 22, 26, 22), '#d6d9bf', { seed: 2120, lift: 2.5 }); cut(g, rectP(x + 4, y - 27, 30, 6), C.rust, { seed: 2121, lift: 1.5 });
      cut(g, rectP(x + 126, y - 18, 36, 18), C.kraft, { seed: 2122, lift: 2.5 }); tape(g, x + 144, y - 9, 8, 22, 0, 2123);
    }
  };

  // ================= интерактивные объекты (спрайт по состоянию + живые детали) =================
  var TINT = { pin: C.red, boom: C.mustard, hook: C.teal };
  function ghostIcon(g, id, x, y, size) { // «пустое гнездо»: пунктирный круг и бледный силуэт нужной детали
    g.save(); g.globalAlpha = 0.85; if (g.setLineDash) g.setLineDash([5, 4]);
    g.beginPath(); g.arc(x, y, size * 0.62, 0, TAU); g.strokeStyle = 'rgba(250,236,200,0.9)'; g.lineWidth = 2; g.stroke();
    if (g.setLineDash) g.setLineDash([]); g.globalAlpha = 0.4; drawIconRaw(g, id, x, y, size); g.restore();
  }

  K.lamp = function (g, it, sc, P) {
    var x = it.x, y = it.y, w = it.w, h = it.h, st = it.state || {}, cx = x + w / 2, lit = !!st.lit;
    if (st.big) {
      cut(g, rectP(x + w * 0.06, y + h * 0.84, w * 0.88, h * 0.16), '#8a6a3a', { seed: 2200, lift: 4 }); // постамент
      cut(g, rectP(x - 4, y + h * 0.82, w + 8, 8), C.brass, { seed: 2201, lift: 2 });
      var gx = x + w * 0.08, gy = y + h * 0.12, gw = w * 0.84, gh = h * 0.7;
      cut(g, rrP(gx, gy, gw, gh, 24), lit ? '#fff1c0' : '#4d5a66', { seed: 2202, lift: 3, sh: 0.35 }); // стекло
      if (!lit) cut(g, [[gx + gw * 0.1, gy + 14], [gx + gw * 0.24, gy + 14], [gx + gw * 0.14, gy + gh - 14], [gx + gw * 0.02, gy + gh - 14]], 'rgba(200,215,230,0.25)', { seed: 2203, lift: 0, raw: true, tex: false });
      for (var k = 0; k < 4; k++) cut(g, rectP(gx + gw * (k + 0.5) / 4 - 2, gy, 4, gh), 'rgba(60,50,40,0.55)', { seed: 2204 + k, lift: 0, raw: true, tex: false });
      cut(g, [[x - 10, gy + 4], [cx, y - 14], [x + w + 10, gy + 4]], C.rustD, { seed: 2210, lift: 4 }); brad(g, cx, y - 10, 4);
      cut(g, rectP(x - 6, gy - 2, w + 12, 8), C.iron, { seed: 2211, lift: 2 });
      // гнёзда: линза (круг), фитиль (стержень), масло (резервуар)
      var ly = y + h * 0.38, lr = w * 0.28;
      if (st.lens) { cut(g, ell(cx, ly, lr + 6, lr + 6, 30), C.brass, { seed: 2220, lift: 2 }); cut(g, ell(cx, ly, lr, lr, 30), lit ? '#fff6d8' : '#cfe3e6', { seed: 2221, lift: 0 }); for (var r = 1; r < 4; r++) { g.beginPath(); g.arc(cx, ly, lr * r / 4, 0, TAU); g.strokeStyle = 'rgba(80,110,120,0.35)'; g.lineWidth = 1.2; g.stroke(); } }
      else ghostIcon(g, 'lens', cx, ly, lr * 1.3);
      var wy = y + h * 0.58;
      if (st.wick) { cut(g, rectP(cx - 5, wy - 6, 10, 26), '#efe2c4', { seed: 2230, lift: 1.5 }); cut(g, rectP(cx - 3, wy - 12, 6, 7), '#3a2a20', { seed: 2231, lift: 0.5, raw: true }); }
      else ghostIcon(g, 'wick', cx, wy + 6, 26);
      var oy = y + h * 0.7;
      cut(g, rrP(cx - 34, oy, 68, 26, 8), st.oil ? C.oil : 'rgba(210,220,225,0.35)', { seed: 2240, lift: 2 });
      if (st.oil) cut(g, rectP(cx - 28, oy + 4, 56, 5), C.oilL, { seed: 2241, raw: true, lift: 0 }); else ghostIcon(g, 'oilcan_full', cx + 52, oy + 12, 24);
      return;
    }
    if (st.small) {
      cut(g, rectP(cx - w * 0.35, y + h * 0.6, w * 0.7, h * 0.4), C.brass, { seed: 2250, lift: 2 });
      cut(g, ell(cx, y + h * 0.42, w * 0.46, h * 0.42, 18), lit ? '#ffe28a' : '#5c574f', { seed: 2251, lift: 2, sh: 0.35 });
      if (lit) cut(g, ell(cx - w * 0.12, y + h * 0.32, w * 0.12, h * 0.1, 10), '#fffbe8', { seed: 2252, lift: 0, raw: true, tex: false });
      return;
    }
    if (st.hang) {
      var sy = y + h * 0.62;
      cut(g, rectP(cx - 1.2, y - 2, 2.4, sy - y + 2), C.ink, { seed: 2260, lift: 1.5, raw: true });
      cut(g, ell(cx, sy + 18, 9, 9, 16), lit ? '#fbe2a0' : '#bdb5a0', { seed: 2261, lift: 1 });
      cut(g, [[cx - 8, sy], [cx + 8, sy], [cx + w / 2, sy + h * 0.2], [cx - w / 2, sy + h * 0.2]], C.rust, { seed: 2262, lift: 3 });
      return;
    }
    cut(g, [[cx - 4, y + 40], [cx + 4, y + 40], [cx + 5, y + h - 10], [cx - 5, y + h - 10]], C.iron, { seed: 2270, lift: 3 });
    cut(g, [[cx - 11, y + h - 14], [cx + 11, y + h - 14], [cx + 14, y + h], [cx - 14, y + h]], C.iron, { seed: 2271, lift: 2.5 });
    cut(g, [[cx - 12, y + 14], [cx + 12, y + 14], [cx + 9, y + 42], [cx - 9, y + 42]], lit ? '#f6cd6c' : '#5f6866', { seed: 2272, lift: 2.5 });
    cut(g, [[cx, y - 2], [cx + 17, y + 15], [cx - 17, y + 15]], C.iron, { seed: 2273, lift: 2.5 });
    cut(g, rectP(cx - 11, y + 40, 22, 5), C.iron, { seed: 2274, lift: 1.5 });
  };

  K.lever = function (g, it, sc, P) {
    var x = it.x, y = it.y, w = it.w, h = it.h, st = it.state || {}, on = !!st.on, px = x + w / 2, py = y + h - 10;
    // вентиль (state.pips): открыт — рукоять вертикально вверх, закрыт — лежит влево (положения не спутать и рукояти не перекрещиваются)
    var a = st.pips ? (on ? 0 : -1.2) : (on ? 0.55 : -0.55), L = h - 12, knob = st.tint && TINT[st.tint] ? TINT[st.tint] : (on ? C.mustardL : C.rust);
    cut(g, [[x - 6, y + h + 2], [x - 2, y + h - 14], [x + w + 2, y + h - 14], [x + w + 6, y + h + 2]], C.dbrown, { seed: 2300, lift: 3 });
    var rod = rotP([[px - 3, py], [px + 3, py], [px + 2.5, py - L], [px - 2.5, py - L]], px, py, a);
    cut(g, rod, '#cfc4aa', { seed: 2301, lift: 3 });
    var tip = rotP([[px, py - L]], px, py, a)[0];
    cut(g, ell(tip[0], tip[1], 8, 8, 16), knob, { seed: 2302, lift: 3 });
    g.fillStyle = 'rgba(255,245,220,0.6)'; g.beginPath(); g.arc(tip[0] - 2.5, tip[1] - 2.5, 2.2, 0, TAU); g.fill();
    brad(g, px, py, 3);
    // индикатор положения на основании: зелёная — включено
    cut(g, ell(x + w + 1, y + h - 6, 3.2, 3.2, 10), on ? '#9fd27a' : '#4b3b30', { seed: 2303, lift: 0.8, raw: true, tex: false });
    if (st.pips) for (var i = 0; i < st.pips; i++) brad(g, x - 4 + (i % 2) * 7 + (w - 4) / 2 - 2, y + h + 9 + Math.floor(i / 2) * 6, 2.2); // вес вентиля
  };

  K.door = function (g, it, sc, P) {
    var x = it.x, y = it.y, w = it.w, h = it.h, st = it.state || {}, open = !!st.open;
    if (st.hatch) { // люк в полу: тёмный проём, из него торчит лестница, крышка откинута назад
      var fy = y + h;
      if (open) { cut(g, [[x - 6, fy - 44], [x + w - 26, fy - 44], [x + w - 4, fy - 2], [x + 16, fy - 2]], '#7a5a3e', { seed: 2403, lift: 3 }); for (var hb = 0; hb < 2; hb++) cut(g, [[x + 4 + hb * 30, fy - 40], [x + 12 + hb * 30, fy - 40], [x + 30 + hb * 30, fy - 4], [x + 22 + hb * 30, fy - 4]], '#5e432c', { seed: 2406 + hb, lift: 0.8, raw: true }); }
      cut(g, [[x - 2, fy - 2], [x + w + 2, fy - 2], [x + w - 6, fy + 12], [x + 6, fy + 12]], '#17120e', { seed: 2400, lift: 0 });
      if (open) { [x + 18, x + w - 24].forEach(function (lx, k) { cut(g, rectP(lx, fy - 30, 6, 40), C.brown, { seed: 2401 + k, lift: 2 }); }); for (var r = 0; r < 3; r++) cut(g, rectP(x + 18, fy - 24 + r * 10, w - 36, 4), '#a07e5c', { seed: 2405 + r, raw: true, lift: 1 }); }
      else cut(g, [[x, fy - 3], [x + w, fy - 3], [x + w - 4, fy + 8], [x + 4, fy + 8]], '#7a5a3e', { seed: 2404, lift: 2 });
      return;
    }
    var arch = h > w * 1.7;
    var frame = arch ? [[x - 10, y + h], [x - 10, y + w * 0.5]].concat(ell(x + w / 2, y + w * 0.5, w / 2 + 10, w / 2 + 10, 14, Math.PI, TAU)).concat([[x + w + 10, y + h]]) : rectP(x - 10, y - 10, w + 20, h + 10);
    cut(g, frame, C.dbrown, { seed: 2410, lift: 4 });
    var leaf = arch ? [[x, y + h], [x, y + w * 0.5]].concat(ell(x + w / 2, y + w * 0.5, w / 2, w / 2, 14, Math.PI, TAU)).concat([[x + w, y + h]]) : rectP(x, y, w, h);
    if (open) {
      cut(g, leaf, '#1f1914', { seed: 2411, lift: 0, amp: 0.4 });
      g.save(); poly(g, leaf); g.clip(); var gr = g.createLinearGradient(x, y + h, x, y + h * 0.4); gr.addColorStop(0, 'rgba(' + (P.glow || GLOW) + ',0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x, y, w, h); g.restore();
      cut(g, [[x, y + 4], [x + w * 0.24, y + 14], [x + w * 0.24, y + h + 6], [x, y + h]], '#7e5537', { seed: 2412, lift: 4 });
    } else {
      var lb = cut(g, leaf, '#8f6241', { seed: 2413, lift: 1.5 });
      g.save(); poly(g, lb); g.clip(); for (var i = 1; i < 4; i++) flat(g, rectP(x + i * w / 4 - 1, y, 2, h), 'rgba(50,25,10,0.35)'); g.restore();
      cut(g, rectP(x - 2, y + h * 0.25, w + 4, 10), '#64432c', { seed: 2414, lift: 2 }); cut(g, rectP(x - 2, y + h * 0.72, w + 4, 10), '#64432c', { seed: 2415, lift: 2 });
      cut(g, ell(x + w - 14, y + h * 0.52, 6, 6, 12), C.iron, { seed: 2416, lift: 2 }); brad(g, x + w - 14, y + h * 0.52, 2.5);
      if (st.lock) { // висячий замок — читается издалека
        var lx = x + w - 14, lyy = y + h * 0.52 + 14;
        g.beginPath(); g.arc(lx, lyy, 7, Math.PI, 0); g.strokeStyle = '#3a342e'; g.lineWidth = 3.5; g.stroke();
        cut(g, rrP(lx - 11, lyy - 1, 22, 18, 4), C.brass, { seed: 2417, lift: 3 });
        cut(g, [[lx - 2, lyy + 5], [lx + 2, lyy + 5], [lx + 1.5, lyy + 13], [lx - 1.5, lyy + 13]], '#3a2a1c', { seed: 2418, lift: 0, raw: true });
      }
    }
  };

  K.gate = function (g, it, sc, P) {
    var x = it.x, y = it.y, w = it.w, h = it.h, st = it.state || {}, oy = st.open ? -h * 0.8 : 0;
    cut(g, rectP(x, y, w, h), '#1f1b18', { seed: 2500, lift: 0, amp: 0.5 });
    g.save(); poly(g, rectP(x - 4, y - 4, w + 8, h + 8)); g.clip();
    for (var i = 10; i < w; i += 22) cut(g, rectP(x + i - 3, y + oy, 6, h), C.ironL, { seed: 2501 + i, lift: 2, raw: true });
    [0.3, 0.62, 0.95].forEach(function (f, k) { cut(g, rectP(x, y + h * f - 6 + oy, w, 8), C.iron, { seed: 2540 + k, lift: 2 }); });
    g.restore();
    cut(g, rectP(x - 10, y - 14, w + 20, 16), C.iron, { seed: 2550, lift: 3 });
    cut(g, rectP(x - 12, y - 14, 10, h + 14), C.stoneD, { seed: 2551, lift: 3 }); cut(g, rectP(x + w + 2, y - 14, 10, h + 14), C.stoneD, { seed: 2552, lift: 3 });
    // латунная табличка с нотой — решётку открывает мелодия
    cut(g, ell(x + w / 2, y - 6, 16, 13, 18), C.brass, { seed: 2553, lift: 3 }); drawIconRaw(g, st.icon || 'note', x + w / 2, y - 6, 20);
  };

  // ---------- ящики и мебель ----------
  K.box = function (g, it, sc, P) {
    var x = it.x, y = it.y, w = it.w, h = it.h, st = it.state || {};
    if (st.pic) return picTile(g, it);
    if (st.icon && !st.variant) { // кодовый диск
      var cx = x + w / 2, cy = y + h / 2, r = Math.min(w, h) / 2;
      cut(g, ell(cx, cy, r + 3, r + 3, 24), C.iron, { seed: 2600, lift: 3 });
      cut(g, gearPtsP(cx, cy, r, 12, 0), C.brass, { seed: 2601, lift: 2, raw: true });
      cut(g, ell(cx, cy, r * 0.74, r * 0.74, 22), C.cream, { seed: 2602, lift: 1.5 });
      cut(g, [[cx - 4, y - 5], [cx + 4, y - 5], [cx, y + 3]], C.red, { seed: 2603, lift: 1.5, raw: true }); // указатель
      drawIconRaw(g, st.icon, cx, cy, r * 1.2);
      return;
    }
    switch (st.variant) {
      case 'stool':
        cut(g, rrP(x, y, w, 11, 4), '#b88a58', { seed: 2610, lift: 3 });
        cut(g, [[x + 6, y + 10], [x + 13, y + 10], [x + 9, y + h], [x + 2, y + h]], '#8e6640', { seed: 2611, lift: 2.5 });
        cut(g, [[x + w - 13, y + 10], [x + w - 6, y + 10], [x + w - 2, y + h], [x + w - 9, y + h]], '#8e6640', { seed: 2612, lift: 2.5 });
        cut(g, rectP(x + 6, y + h * 0.62, w - 12, 5), '#7a5636', { seed: 2613, lift: 1.5 });
        return;
      case 'bench':
        cut(g, rectP(x + 6, y + 14, 12, h - 14), '#6e4c33', { seed: 2620, lift: 3 }); cut(g, rectP(x + w - 18, y + 14, 12, h - 14), '#6e4c33', { seed: 2621, lift: 3 });
        cut(g, rectP(x + 6, y + 14, w - 12, 40), '#8a6346', { seed: 2622, lift: 2.5 });
        cut(g, rectP(x - 10, y, w + 20, 16), '#b88a58', { seed: 2623, lift: 4 }); // столешница
        for (var t = 0; t < 3; t++) brad(g, x + 14 + t * (w - 28) / 2, y + 8, 2);
        if (st.open) {
          cut(g, rectP(x + 18, y + 24, w - 36, 26), '#2a1e16', { seed: 2624, lift: 0 });
          cut(g, rectP(x + 8, y + 42, w - 16, 34), '#a07650', { seed: 2625, lift: 4 }); cut(g, rectP(x + 14, y + 44, w - 28, 8), '#6a4a32', { seed: 2626, lift: 0, raw: true });
          if (!st.empty) { drawIconRaw(g, 'wick', x + w * 0.36, y + 40, 34); drawIconRaw(g, 'flint', x + w * 0.64, y + 40, 34); }
        } else {
          cut(g, rectP(x + 18, y + 22, w - 36, 28), '#a07650', { seed: 2627, lift: 2 });
          cut(g, rrP(x + w / 2 - 16, y + 32, 32, 8, 4), C.brass, { seed: 2628, lift: 1.5 });
        }
        return;
      case 'logs': {
        if (st.peat) { for (var pq = 0; pq < (st.empty ? 2 : 9); pq++) { var pc = pq % 3, pr2 = (pq / 3) | 0; cut(g, rectP(x + 8 + pc * 30 + pr2 * 6, y + h - 22 - pr2 * 18, 28, 16), pq % 2 ? '#6a4a33' : '#7c5a40', { seed: 2620 + pq, lift: 2.5 }); } return; }   // торф брикетами
        var n = st.empty ? 2 : 10, R = rng(3);
        for (var i = 0; i < n; i++) {
          var col = i % 4, row = (i / 4) | 0, lx = x + 18 + col * 26 + row * 13, ly = y + h - 14 - row * 22;
          cut(g, ell(lx, ly, 13, 12, 16), '#c79a62', { seed: 2630 + i, lift: 2.5 });
          cut(g, ell(lx, ly, 8, 7.5, 14), '#e0bc86', { seed: 2650 + i, lift: 0 }); cut(g, ell(lx + R() - 0.5, ly, 3, 3, 8), '#9a7046', { seed: 2670 + i, lift: 0, raw: true });
        }
        return; }
      case 'net': {
        cut(g, rectP(x - 6, y - 6, w + 12, 8), C.brown, { seed: 2680, lift: 3 }); // жердь
        g.save(); g.strokeStyle = '#d9c9a0'; g.lineWidth = 1.6;
        for (var k = 0; k <= 6; k++) { g.beginPath(); g.moveTo(x + k * w / 6, y); g.quadraticCurveTo(x + w / 2 + (k - 3) * w / 12, y + h * 0.8, x + w / 2 + (k - 3) * w / 16, y + h); g.stroke(); }
        for (var j = 1; j < 5; j++) { g.beginPath(); g.moveTo(x + j * 4, y + j * h / 5); g.quadraticCurveTo(x + w / 2, y + j * h / 5 + 6, x + w - j * 4, y + j * h / 5); g.stroke(); }
        g.restore();
        [[x + 4, y + 2], [x + w - 4, y + 2]].forEach(function (q, m) { cut(g, ell(q[0], q[1] + 6, 6, 6, 12), C.red, { seed: 2690 + m, lift: 2 }); });
        if (!st.empty) drawIconRaw(g, 'fish', x + w / 2, y + h * 0.6, 38);
        return; }
      case 'panel': { // щит с трубами: поле 5×3 плиток (как в мини-игре), вход слева — от бака, выход справа — к носику
        cut(g, rectP(x, y, w, h), '#8a7d6a', { seed: 2700, lift: 4 }); cut(g, rectP(x + 6, y + 6, w - 12, h - 12), '#a39580', { seed: 2701, lift: 1 });
        [[x + 8, y + 8], [x + w - 8, y + 8], [x + 8, y + h - 8], [x + w - 8, y + h - 8]].forEach(function (q) { brad(g, q[0], q[1], 2.5); });
        var pc = st.ok ? C.oil : '#5e4f40', T2 = 26, gx = x + (w - 5 * T2) / 2, gy = y + 36, my = gy + 1.5 * T2;
        for (var pr = 0; pr < 3; pr++) for (var pq = 0; pq < 5; pq++) cut(g, rectP(gx + pq * T2 + 1.5, gy + pr * T2 + 1.5, T2 - 3, T2 - 3), (pr + pq) % 2 ? '#e3d7bd' : '#d8cbb0', { seed: 2710 + pr * 5 + pq, lift: 0.8, amp: 0.4 });
        cut(g, band([[x - 2, y + 21], [gx - 7, y + 21], [gx - 7, my], [gx + 4, my]], 9), pc, { seed: 2702, lift: 2, raw: true });          // вход (от бака)
        cut(g, band([[gx + 5 * T2 - 4, my], [x + w - 9, my], [x + w - 9, y + 41], [x + w + 2, y + 41]], 9), pc, { seed: 2703, lift: 2, raw: true }); // выход (к носику)
        // плитки среднего ряда: собрано — прямая труба с маслом; не собрано — плитки повёрнуты, путь разорван
        var rot = st.ok ? [0, 0, 0, 0, 0] : [1, 0, 3, 1, 2], shp = st.ok ? ['I', 'I', 'I', 'I', 'I'] : ['I', 'L', 'I', 'L', 'I'];
        for (var pk2 = 0; pk2 < 5; pk2++) {
          var tcx = gx + pk2 * T2 + T2 / 2, tcy = my, hh2 = T2 / 2 - 2, seg;
          if (shp[pk2] === 'I') seg = rot[pk2] % 2 ? [[tcx, tcy - hh2], [tcx, tcy + hh2]] : [[tcx - hh2, tcy], [tcx + hh2, tcy]];
          else seg = rotP([[tcx - hh2, tcy], [tcx, tcy], [tcx, tcy - hh2]], tcx, tcy, rot[pk2] * Math.PI / 2);
          cut(g, band(seg, 8), pc, { seed: 2720 + pk2, lift: 1.5, raw: true });
        }
        // декоративные плитки верхнего и нижнего ряда
        [[0, 0, 'L', 1], [2, 0, 'I', 0], [4, 0, 'L', 2], [1, 2, 'I', 1], [3, 2, 'L', 3]].forEach(function (q, m) {
          var tcx = gx + q[0] * T2 + T2 / 2, tcy = gy + q[1] * T2 + T2 / 2, hh2 = T2 / 2 - 2;
          var seg = q[2] === 'I' ? (q[3] % 2 ? [[tcx, tcy - hh2], [tcx, tcy + hh2]] : [[tcx - hh2, tcy], [tcx + hh2, tcy]]) : rotP([[tcx - hh2, tcy], [tcx, tcy], [tcx, tcy - hh2]], tcx, tcy, q[3] * Math.PI / 2);
          cut(g, band(seg, 7), '#a8987f', { seed: 2730 + m, lift: 1, raw: true });
        });
        drawIconRaw(g, st.ok ? 'check' : 'question', x + w - 24, y + 22, 24);
        return; }
    }
    // обычный ящик (на нём кошка)
    cut(g, rectP(x, y, w, h), '#b78a57', { seed: 2720, lift: 4 });
    cut(g, rectP(x, y, w, 7), '#9c7246', { seed: 2721, lift: 1.5 }); cut(g, rectP(x, y + h - 7, w, 7), '#9c7246', { seed: 2722, lift: 1.5 });
    cut(g, [[x + 4, y + h - 7], [x + 12, y + h - 7], [x + w - 4, y + 7], [x + w - 12, y + 7]], '#a57a4c', { seed: 2723, lift: 1.5 });
    brad(g, x + 5, y + 4, 1.6); brad(g, x + w - 5, y + 4, 1.6);
    if (st.icon) drawIconRaw(g, st.icon, x + w / 2, y + h / 2, Math.min(w, h) * 0.7);
  };
  function gearPtsP(cx, cy, r, teeth, a0) { var p = [], n = teeth * 4; for (var i = 0; i < n; i++) { var a = a0 + i / n * TAU, rr = (i % 4 < 2) ? r : r * 0.82; p.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); } return p; }

  // фрагмент «оправы линзы» для сдвижной головоломки: кольцо с зубцами, спицы, линза, 4 латунных клёпки — на синей кальке
  function picTile(g, it) {
    var st = it.state, n = st.n || 3, part = st.part, x = it.x, y = it.y, w = it.w, h = it.h, full = part < 0;
    var S = full ? w : w * n, ox = full ? x : x - (part % n) * w, oy = full ? y : y - ((part / n) | 0) * h, cx = ox + S / 2, cy = oy + S / 2;
    var card = cut(g, rectP(x, y, w, h), '#3f6a7a', { seed: 2800 + (part + 2), lift: 4, sh: 0.4 });
    g.save(); poly(g, card); g.clip();
    g.strokeStyle = 'rgba(220,235,240,0.18)'; g.lineWidth = 1; for (var gx = ox; gx < ox + S; gx += S / 12) { g.beginPath(); g.moveTo(gx, oy); g.lineTo(gx, oy + S); g.stroke(); g.beginPath(); g.moveTo(ox, oy + gx - ox); g.lineTo(ox + S, oy + gx - ox); g.stroke(); }
    cut(g, gearPtsP(cx, cy, S * 0.46, 16, 0.1), C.brass, { seed: 2810, lift: 3, raw: true, live: true });
    cut(g, ell(cx, cy, S * 0.38, S * 0.38, 40), '#3f6a7a', { seed: 2811, lift: 0, raw: true, live: true });
    cut(g, ell(cx, cy, S * 0.33, S * 0.33, 40), C.rust, { seed: 2812, lift: 2, raw: true, live: true });
    cut(g, ell(cx, cy, S * 0.27, S * 0.27, 40), '#3f6a7a', { seed: 2813, lift: 0, raw: true, live: true });
    for (var i = 0; i < 6; i++) { var a = i * TAU / 6 + 0.3; cut(g, rotP(rectP(cx - S * 0.015, cy - S * 0.3, S * 0.03, S * 0.2), cx, cy, a), C.cream, { seed: 2820 + i, lift: 1.5, raw: true, live: true }); }
    cut(g, ell(cx, cy, S * 0.12, S * 0.12, 30), '#d9eef0', { seed: 2830, lift: 2, raw: true, live: true });
    cut(g, ell(cx - S * 0.04, cy - S * 0.04, S * 0.035, S * 0.03, 12), '#ffffff', { seed: 2831, lift: 0, raw: true, live: true });
    for (var k = 0; k < 4; k++) { var b = k * TAU / 4 + TAU / 8; brad(g, cx + Math.cos(b) * S * 0.42, cy + Math.sin(b) * S * 0.42, S * 0.035); }
    cut(g, starPts(cx, oy + S * 0.06, S * 0.05, S * 0.02, 4), C.mustardL, { seed: 2840, lift: 1, raw: true, live: true }); // метка «верх»
    g.restore();
    if (full) { tape(g, x + 14, y + 6, 30, 10, -0.5, 2850); tape(g, x + w - 14, y + 6, 30, 10, 0.5, 2851); }
    else { g.strokeStyle = 'rgba(255,248,230,0.55)'; g.lineWidth = 1.5; poly(g, card); g.stroke(); }
  }

  // ---------- механизмы ----------
  K.machine = function (g, it, sc, P) {
    var x = it.x, y = it.y, w = it.w, h = it.h, st = it.state || {}, cx = x + w / 2;
    switch (st.variant) {
      case 'stove': {
        cut(g, rectP(cx - 14, -10, 28, y + 30), C.iron, { seed: 2900, lift: 3 }); cut(g, rectP(cx - 18, y * 0.4, 36, 8), C.ironL, { seed: 2901, lift: 2 });
        cut(g, rrP(x, y + 20, w, h - 34, 10), '#4f4741', { seed: 2902, lift: 5, sh: 0.4 });
        cut(g, rectP(x - 6, y + 14, w + 12, 12), '#5d544c', { seed: 2903, lift: 3 });
        cut(g, rectP(x + 6, y + h - 16, 14, 16), C.iron, { seed: 2904, lift: 2 }); cut(g, rectP(x + w - 20, y + h - 16, 14, 16), C.iron, { seed: 2905, lift: 2 });
        var fx = x + 18, fy = y + h * 0.44, fw = w - 36, fh = h * 0.32;
        cut(g, rrP(fx - 5, fy - 5, fw + 10, fh + 10, 8), C.ironL, { seed: 2906, lift: 2 });
        cut(g, rrP(fx, fy, fw, fh, 6), st.fire ? '#5a2a14' : '#1d1915', { seed: 2907, lift: 0 });
        if (st.wood) for (var l = 0; l < 3; l++) { cut(g, ell(fx + fw * (0.25 + l * 0.25), fy + fh - 12, 11, 10, 14), '#c79a62', { seed: 2910 + l, lift: 1.5 }); cut(g, ell(fx + fw * (0.25 + l * 0.25), fy + fh - 12, 6, 5.5, 12), '#e0bc86', { seed: 2913 + l, lift: 0 }); }
        else ghostIcon(g, 'logs', fx + fw / 2, fy + fh / 2, 30);
        for (var r = 0; r < 4; r++) brad(g, x + 12 + r * (w - 24) / 3, y + h * 0.36, 2.2);
        cut(g, rectP(fx + 6, fy - 22, fw - 12, 6), '#2a2420', { seed: 2920, raw: true, lift: 0 });
        return; }
      case 'well': { // колодец без ведра: верёвка с пустым крюком
        cut(g, rectP(x + 6, y - 10, 9, h * 0.55), C.brown, { seed: 2930, lift: 3 }); cut(g, rectP(x + w - 15, y - 10, 9, h * 0.55), C.brown, { seed: 2931, lift: 3 });
        cut(g, [[x - 12, y + 2], [cx, y - 34], [x + w + 12, y + 2]], C.rustD, { seed: 2932, lift: 4 });
        cut(g, rectP(x + 10, y + 6, w - 20, 9), '#8a6448', { seed: 2933, lift: 2 }); // ворот
        cut(g, band([[x + w - 10, y + 10], [x + w + 6, y + 10], [x + w + 6, y + 26]], 4), C.iron, { seed: 2934, lift: 1.5, raw: true });
        cut(g, rectP(cx - 1, y + 14, 2, h * 0.3), '#d9c9a0', { seed: 2935, lift: 1, raw: true });
        drawIconRaw(g, 'hook', cx, y + 14 + h * 0.3, 18);
        var ring = cut(g, rrP(x - 4, y + h * 0.48, w + 8, h * 0.52, 10), C.stone, { seed: 2936, lift: 5 });
        g.save(); poly(g, ring); g.clip();
        for (var row = 0; row < 3; row++) for (var b = -1; b < 5; b++) cut(g, rectP(x - 4 + b * (w + 8) / 4 + (row % 2) * 12, y + h * 0.5 + row * h * 0.17, (w + 8) / 4 - 3, h * 0.16), (row + b) % 2 ? '#a69c88' : '#8f8673', { seed: 2940 + row * 10 + b, lift: 1.5 });
        g.restore();
        cut(g, rectP(x - 8, y + h * 0.46, w + 16, 9), C.stoneD, { seed: 2960, lift: 3 });
        return; }
      case 'crane': {
        var prog = st.prog || 0, pin = prog >= 1, swung = prog >= 2, low = prog >= 3;
        cut(g, rectP(x, y + h - 22, 76, 22), C.stoneD, { seed: 2970, lift: 3 });
        cut(g, rectP(x + 22, y + 34, 24, h - 54), '#6a5848', { seed: 2971, lift: 4 });
        for (var b2 = 0; b2 < 5; b2++) cut(g, [[x + 24, y + 48 + b2 * 44], [x + 44, y + 48 + b2 * 44 + 30], [x + 42, y + 48 + b2 * 44 + 34], [x + 22, y + 48 + b2 * 44 + 6]], '#56463a', { seed: 2972 + b2, lift: 0.8, raw: true });
        var ang = swung ? 0 : -0.8, ax = x + 34, ay = y + 42, len = w - 24, ex = ax + Math.cos(ang) * len, ey = ay + Math.sin(ang) * len;
        cut(g, band([[ax, ay], [ex, ey]], 14), '#8a7058', { seed: 2980, lift: 4, raw: true });
        cut(g, band([[ax + Math.cos(ang) * 30, ay + Math.sin(ang) * 30], [ax + Math.cos(ang) * 70, ay + Math.sin(ang) * 70]], 15), TINT.boom, { seed: 2981, lift: 1.5, raw: true }); // метка стрелы
        brad(g, ax, ay, 5);
        // стопор (красный): вставлен — стрела заперта
        if (!pin) { cut(g, rectP(ax - 30, ay - 7, 46, 14), TINT.pin, { seed: 2985, lift: 3 }); cut(g, ell(ax - 32, ay, 9, 9, 12), TINT.pin, { seed: 2986, lift: 3 }); drawIconRaw(g, 'lock', ax - 32, ay - 22, 20); }
        else { cut(g, rotP(rectP(ax - 46, ay + 14, 28, 10), ax - 32, ay + 19, 0.4), TINT.pin, { seed: 2987, lift: 2 }); }
        var hy = ey + (low ? 150 : 36);
        cut(g, rectP(ex - 2.5, ey, 5, hy - ey), TINT.hook, { seed: 2988, lift: 1.5, raw: true }); cut(g, ell(ex, hy - 4, 8, 6, 12), TINT.hook, { seed: 2990, lift: 1.5 }); // трос и обойма (метка крюка)
        cut(g, ell(ex, ey, 7, 7, 12), C.iron, { seed: 2989, lift: 2 });
        drawIconRaw(g, 'hook', ex, hy + 8, 24);
        if (st.load) drawIconRaw(g, 'bucket', ex, hy + 30, 36);
        return; }
      case 'tank': {
        var tk = cut(g, rrP(x, y + 20, w, h - 20, 26), '#7b5a3c', { seed: 3000, lift: 5, sh: 0.4 });
        g.save(); poly(g, tk); g.clip(); for (var s = 0; s < 6; s++) flat(g, rectP(x + s * w / 6, y, 2, h), 'rgba(40,20,8,0.25)'); g.restore();
        [0.3, 0.75].forEach(function (f, k) { cut(g, rectP(x - 4, y + 20 + (h - 20) * f, w + 8, 9), C.iron, { seed: 3001 + k, lift: 2 }); });
        var wx = x + w * 0.62, wy = y + h * 0.36, wh = h * 0.42; // смотровое окошко — видно масло
        cut(g, rrP(wx - 8, wy - 4, 24, wh + 8, 6), C.iron, { seed: 3003, lift: 2 }); cut(g, rrP(wx - 4, wy, 16, wh, 4), '#d9cfb8', { seed: 3004, lift: 0 });
        cut(g, rrP(wx - 4, wy + wh * 0.3, 16, wh * 0.7, 4), C.oil, { seed: 3005, lift: 0 });
        cut(g, rectP(x + w * 0.2, y + 6, w * 0.3, 18), C.ironL, { seed: 3006, lift: 2 });
        drawIconRaw(g, 'oilcan_full', x + w * 0.3, y + h * 0.55, Math.min(44, w * 0.3));
        return; }
      case 'gauge': {
        cut(g, rrP(x, y, w, h, 12), '#5d544c', { seed: 3010, lift: 4 });
        var gx2 = cx, gy2 = y + h * 0.74, rr = Math.min(w * 0.42, h * 0.6);
        cut(g, ell(gx2, gy2, rr + 6, rr + 6, 30, Math.PI, TAU).concat([[gx2 + rr + 6, gy2 + 8], [gx2 - rr - 6, gy2 + 8]]), C.brass, { seed: 3011, lift: 2 });
        cut(g, ell(gx2, gy2, rr, rr, 30, Math.PI, TAU).concat([[gx2 + rr, gy2 + 4], [gx2 - rr, gy2 + 4]]), C.cream, { seed: 3012, lift: 0 });
        for (var tq = 0; tq <= 8; tq++) { var ta = Math.PI + tq / 8 * Math.PI; strokeL(g, [[gx2 + Math.cos(ta) * rr * 0.8, gy2 + Math.sin(ta) * rr * 0.8], [gx2 + Math.cos(ta) * rr * 0.95, gy2 + Math.sin(ta) * rr * 0.95]], '#4a3024', tq % 4 ? 1.2 : 2); }
        var ma = Math.PI + (st.mark || 0) * Math.PI;
        g.beginPath(); g.arc(gx2, gy2, rr * 0.7, ma - 0.15, ma + 0.15); g.lineTo(gx2, gy2); g.closePath(); g.fillStyle = st.ok ? '#8fcf6a' : '#7fa860'; g.fill(); // зелёная отметка — цель
        var na = Math.PI + (st.gauge || 0) * Math.PI;
        cut(g, rotP([[gx2 - 3, gy2], [gx2 + 3, gy2], [gx2 + 0.8, gy2 - rr * 0.9], [gx2 - 0.8, gy2 - rr * 0.9]], gx2, gy2, na + Math.PI / 2), st.ok ? '#3f6f2d' : C.red, { seed: 3013, lift: 1.5, raw: true });
        brad(g, gx2, gy2, 4.5);
        if (st.ok) drawIconRaw(g, 'check', x + w - 14, y + 14, 22);
        return; }
      case 'spout': {
        cut(g, band([[x - 20, y + 6], [cx, y + 6], [cx, y + h * 0.55]], 14), '#ad6a40', { seed: 3020, lift: 3, raw: true });
        cut(g, [[cx - 11, y + h * 0.55], [cx + 11, y + h * 0.55], [cx + 5, y + h * 0.66], [cx - 5, y + h * 0.66]], '#7f4a2e', { seed: 3021, lift: 2 });
        cut(g, ell(cx + 14, y + 20, 9, 9, 14), C.red, { seed: 3022, lift: 2 }); // кран-вентиль
        cut(g, rectP(cx - 22, y + h - 8, 44, 8), C.brown, { seed: 3023, lift: 2 }); // поддон под маслёнку
        if (!st.drip) ghostIcon(g, 'oilcan', cx, y + h - 28, 30);
        return; }
      case 'winch': {
        var p2 = st.prog || 0, rot = Math.max(0, p2 - 1) * 1.6;
        cut(g, rectP(x, y + h - 24, w, 24), C.stoneD, { seed: 3030, lift: 3 });
        cut(g, [[x + 6, y + h - 24], [x + 16, y + h - 24], [cx - 2, y + 30], [cx - 10, y + 30]], '#6a5848', { seed: 3031, lift: 3 });
        cut(g, [[x + w - 16, y + h - 24], [x + w - 6, y + h - 24], [cx + 10, y + 30], [cx + 2, y + 30]], '#6a5848', { seed: 3032, lift: 3 });
        var dy = y + 44;
        cut(g, gearPtsP(cx, dy, 30, 12, rot), C.ironL, { seed: 3033, lift: 3, raw: true }); // храповик
        cut(g, ell(cx, dy, 20, 20, 22), '#8a6448', { seed: 3034, lift: 1.5 });
        for (var rw = 0; rw < 4; rw++) strokeL(g, [[cx - 18, dy - 12 + rw * 8], [cx + 18, dy - 10 + rw * 8]], '#d9c9a0', 2); // намотанный трос
        brad(g, cx, dy, 4);
        if (st.crank) { var ca = rot + 0.5; cut(g, band([[cx, dy], [cx + Math.cos(ca) * 40, dy + Math.sin(ca) * 40]], 8), C.iron, { seed: 3035, lift: 3, raw: true }); cut(g, ell(cx + Math.cos(ca) * 40, dy + Math.sin(ca) * 40, 7, 7, 12), C.brown, { seed: 3036, lift: 2 }); }
        else ghostIcon(g, 'crank', cx + 32, dy + 28, 28);
        return; }
      case 'carriage': {
        cut(g, rrP(x, y + 18, w, h - 18, 10), '#5d544c', { seed: 3040, lift: 4 });
        cut(g, rectP(x + 10, y + 28, w - 20, 6), C.brass, { seed: 3041, lift: 1 });
        for (var gq = 0; gq < 5; gq++) { var gx3 = x + 34 + gq * (w - 68) / 4, broken = !st.ok && gq % 2; cut(g, gearPtsP(gx3, y + 20 + (broken ? 6 : 0), 15, 9, gq), broken ? '#8a7a62' : C.brass, { seed: 3042 + gq, lift: 2.5, raw: true }); brad(g, gx3, y + 20 + (broken ? 6 : 0), 3); }
        if (!st.ok) { drawIconRaw(g, 'gear', x + w - 22, y - 12, 30); drawIconRaw(g, 'question', x + 22, y - 12, 26); }
        return; }
    }
    if (coastMachine(g, it, st, x, y, w, h, cx)) return;
    cut(g, rrP(x, y, w, h, 8), '#6a5848', { seed: 3050, lift: 3 }); drawIconRaw(g, 'gear', cx, y + h / 2, Math.min(w, h) * 0.6);
  };

  K._drawbridge = function (g, it, P) {
    var x = it.x, y = it.y, w = it.w, h = it.h || 18, st = it.state || {};
    var lift = st.lift != null ? st.lift : (st.down ? 0 : 1); if (st.down) lift = 0;
    var ang = -lift * 1.25;
    cut(g, rectP(x - 30, y - 170, 14, 176), '#5b4636', { seed: 3060, lift: 4 }); // столб
    cut(g, [[x - 36, y - 172], [x - 10, y - 172], [x - 23, y - 186]], C.rustD, { seed: 3061, lift: 2 });
    var deck = [];
    for (var i = 0; i < w; i += 36) deck.push(rotP(rectP(x + i, y, 35, h), x, y, ang));
    deck.forEach(function (d, k) { cut(g, d, k % 2 ? '#a07e5c' : '#96755a', { seed: 3070 + k, lift: 3, amp: 0.5 }); });
    var ex = x + Math.cos(ang) * w, ey = y + Math.sin(ang) * w;
    cut(g, band([[x - 23, y - 160], [ex, ey]], 3), '#3a3430', { seed: 3080, lift: 1.5, raw: true }); // цепь
    brad(g, x + 4, y + h / 2, 4);
  };

  K.rockObj = function (g, it, sc, P) {
    var x = it.x, y = it.y, w = it.w, h = it.h, st = it.state || {}, col = P.rock || C.stone, colL = P.rockL || light(col, 0.2);
    if (st.plate) { // плита в полу + каменная стела со знаком над ней
      var dn = st.down, dy = dn ? 5 : 0;
      cut(g, rrP(x + w / 2 - 22, y - 58, 44, 50, 10), colL, { seed: 3100 + (it.seed || 0), lift: 3 });
      cut(g, ell(x + w / 2, y - 34, 17, 17, 18), dn ? '#f3d58a' : '#d8cfbf', { seed: 3101 + (it.seed || 0), lift: 0 });
      if (st.icon) drawIconRaw(g, st.icon, x + w / 2, y - 34, 26);
      cut(g, rrP(x - 3, y + dy - 2, w + 6, h + 6, 4), '#2a2420', { seed: 3102, lift: 0 });
      cut(g, rrP(x, y + dy, w, h, 4), dn ? '#c9a45a' : colL, { seed: 3103 + (it.seed || 0), lift: dn ? 0.5 : 3 });
      return;
    }
    if (st.variant === 'steps') {
      var n = 3, up = st.up;
      for (var i = 0; i < n; i++) { var sh = up ? (h / n) * (i + 1) : 12, sx = x + i * (w / n); cut(g, rectP(sx, y + h - sh, w / n - 2, sh), i % 2 ? col : colL, { seed: 3110 + i, lift: 3 }); cut(g, rectP(sx - 1, y + h - sh, w / n, 5), light(colL, 0.2), { seed: 3113 + i, lift: 0, raw: true }); }
      if (!up) { g.save(); if (g.setLineDash) g.setLineDash([5, 5]); g.strokeStyle = 'rgba(240,225,190,0.55)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y + h); for (var j = 0; j < 3; j++) { g.lineTo(x + j * w / 3, y + h - h * (j + 1) / 3); g.lineTo(x + (j + 1) * w / 3, y + h - h * (j + 1) / 3); } g.lineTo(x + w, y + h); g.stroke(); g.restore(); } // пунктир — ступени поднимутся
      return;
    }
    if (st.variant === 'pillar') {
      var p = [[x + w * 0.12, y + h], [x + w * 0.2, y + h * 0.3], [x + w * 0.08, y + 14], [x + w * 0.5, y], [x + w * 0.92, y + 12], [x + w * 0.8, y + h * 0.35], [x + w * 0.9, y + h]];
      cut(g, p, col, { seed: 3120, lift: 5, sh: 0.4 });
      cut(g, [[x + w * 0.5, y + 6], [x + w * 0.85, y + 16], [x + w * 0.72, y + h * 0.6], [x + w * 0.56, y + h * 0.5]], colL, { seed: 3121, lift: 1, sh: 0.2 });
      cut(g, ell(x + w / 2, y + 8, w * 0.5, 14, 20, Math.PI, TAU).concat([[x + w, y + 14], [x, y + 14]]), '#8a7a5a', { seed: 3122, lift: 3 }); // гнездо
      for (var s = 0; s < 7; s++) strokeL(g, [[x + w * 0.05 + s * w * 0.14, y + 12], [x + w * 0.15 + s * w * 0.13, y + 4]], '#c9b88a', 1.5);
      return;
    }
    if (st.icon) { K.rock(g, it, sc, P); drawIconRaw(g, st.icon, x + w / 2, y + h * 0.6, Math.min(w, h) * 0.5); return; }
    K.rock(g, it, sc, P);
  };

  K.waterObj = function (g, it, sc, P) { // лужа в гроте
    var x = it.x, y = it.y, w = it.w, h = it.h;
    cut(g, ell(x + w / 2, y + h / 2, w / 2 + 6, h / 2 + 3, 30), '#2a2420', { seed: 3130, lift: 0 });
    cut(g, ell(x + w / 2, y + h / 2, w / 2, h / 2, 30), '#3e5a60', { seed: 3131, lift: 0, torn: true, rim: '#7c9aa0', tornAmp: 1.5 });
    if (it.state && it.state.shell) drawIconRaw(g, 'shell', x + w * 0.6, y + h * 0.55, 26);
  };

  K.chime = function (g, it, sc, P) { // статичная трубка (качание и звон — LIVE)
    var st = it.state || {}, n = st.n || 5, k = st.note || 0, mini = it.h > 160;
    // выше нота — короче трубка (как выше столбик у птицы); цвет и число точек — те же, что у птицы
    var f = 1 - 0.5 * k / Math.max(1, n - 1), len = (mini ? 236 : it.h - 16) * f, tw = mini ? it.w * 0.44 : it.w * 0.62, cx = it.x + it.w / 2, col = NOTE[k % NOTE.length];
    cut(g, rectP(cx - 1, it.y, 2, 16), C.ink, { seed: 3140, raw: true, lift: 1 });
    cut(g, rectP(cx - tw / 2, it.y + 16, tw, len), col, { seed: 3141 + k, lift: 3, sh: 0.35, amp: 0.5 });
    cut(g, rectP(cx - tw / 2 + 3, it.y + 20, Math.max(3, tw * 0.16), len - 10), light(col, 0.45), { seed: 3150 + k, lift: 0, raw: true });
    cut(g, rectP(cx + tw / 2 - Math.max(3, tw * 0.14) - 2, it.y + 20, Math.max(3, tw * 0.14), len - 10), dark(col, 0.2), { seed: 3155 + k, lift: 0, raw: true });
    cut(g, rectP(cx - tw / 2 - 3, it.y + 12, tw + 6, 8), C.brass, { seed: 3160, lift: 1.5 });
    cut(g, rectP(cx - tw / 2 - 2, it.y + 16 + len - 6, tw + 4, 7), C.brass, { seed: 3161, lift: 1.5 });
    // метка-нота: столько же точек, сколько ступень высоты (как у птиц на площади)
    for (var d = 0; d <= k; d++) cut(g, ell(cx, it.y + 30 + d * 11, 3.2, 3.2, 10), C.cream, { seed: 3170 + d, lift: 0.8, raw: true });
  };

  K.sign = function (g, it, sc, P) {
    var st = it.state || {}, icons = st.icons || [], x = it.x, y = it.y, w = it.w, h = it.h, chart = sc && sc.id === 'workshop';
    var card = cut(g, rotP(rectP(x, y, w, h), x + w / 2, y + h / 2, chart ? -0.02 : 0.015), chart ? '#4f7a78' : '#c9a878', { seed: 3200, lift: 4, sh: 0.35 });
    if (chart) { g.save(); poly(g, card); g.clip(); g.strokeStyle = 'rgba(230,240,225,0.18)'; g.lineWidth = 1; for (var gx = x; gx < x + w; gx += 12) { g.beginPath(); g.moveTo(gx, y); g.lineTo(gx, y + h); g.stroke(); } for (var gy = y; gy < y + h; gy += 12) { g.beginPath(); g.moveTo(x, gy); g.lineTo(x + w, gy); g.stroke(); } g.restore(); tape(g, x + 8, y + 2, 26, 9, -0.6, 3201); tape(g, x + w - 8, y + 4, 26, 9, 0.5, 3202); }
    else { stitch(g, [[x + 6, y + 6], [x + w - 6, y + 6]], 'rgba(90,60,30,0.5)', 1); brad(g, x + 8, y + 8, 2.5); brad(g, x + w - 8, y + 8, 2.5); }
    var n = Math.max(1, icons.length), step = (w - 16) / n, sz = Math.min(step, h) * 0.66;
    icons.forEach(function (ic, i) {
      var ix = x + 8 + step * (i + 0.5), iy = y + h / 2 + 2;
      cut(g, ell(ix, iy, sz * 0.62, sz * 0.62, 20), C.cream, { seed: 3210 + i, lift: 1.5 });
      drawIconRaw(g, ic, ix, iy, sz);
      if (i < n - 1) cut(g, [[ix + step / 2 - 5, iy - 5], [ix + step / 2 + 4, iy], [ix + step / 2 - 5, iy + 5]], chart ? C.cream : C.dbrown, { seed: 3220 + i, lift: 0.8, raw: true });
    });
    if (chart) { // подсказка, к чему код: маленькая дверь маяка в углу
      cut(g, ell(x + w - 12, y + h - 10, 10, 10, 14), C.cream, { seed: 3230, lift: 1.5 }); drawIconRaw(g, 'tower', x + w - 12, y + h - 10, 16);
    }
  };

  // ================= пиктограммы =================
  // Геометрия — общая с серым макетом (проверенная читаемость в 40×40), но в «бумажном» цвете: у каждой пиктограммы свой
  // цвет бумаги (ICOL), контур — тёмно-коричневый «срез», затем спрайт получает тень-подложку и фактуру (iconSprite).
  var IC = (function () {
    var ICON_INK = '#3b2618', ICON_FILL = '#e9dcc0', ICON_DIM = '#9a8b74', OIL = '#5b3e1e', GLOW = '#f2b84e', GLOW2 = 'rgba(255,196,110,';
    function rr(c, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
    function fillRR(c, x, y, w, h, r, f, s, lw) { rr(c, x, y, w, h, r); if (f) { c.fillStyle = f; c.fill(); } if (s) { c.strokeStyle = s; c.lineWidth = lw || 2; c.stroke(); } }
    function circ(c, x, y, r, f, s, lw) { c.beginPath(); c.arc(x, y, Math.max(0.1, r), 0, TAU); if (f) { c.fillStyle = f; c.fill(); } if (s) { c.strokeStyle = s; c.lineWidth = lw || 2; c.stroke(); } }
    function line(c, pts, s, lw) { c.beginPath(); c.moveTo(pts[0], pts[1]); for (var i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.strokeStyle = s; c.lineWidth = lw || 2; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke(); }
    function poly(c, pts, f, s, lw) { c.beginPath(); c.moveTo(pts[0], pts[1]); for (var i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.closePath(); if (f) { c.fillStyle = f; c.fill(); } if (s) { c.strokeStyle = s; c.lineWidth = lw || 2; c.lineJoin = 'round'; c.stroke(); } }
    function glow(c, x, y, r, a) { var g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, GLOW2 + (a == null ? 0.55 : a) + ')'); g.addColorStop(1, GLOW2 + '0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); }
    function flame(c, x, y, s) { poly(c, [x - 7 * s, y, x - 4 * s, y - 12 * s, x, y - 20 * s, x + 5 * s, y - 11 * s, x + 7 * s, y], GLOW, '#a8521e', 1.2); poly(c, [x - 3 * s, y, x, y - 10 * s, x + 3 * s, y], '#fff3c8'); }
  var IC = {
    key: function (c) { circ(c, -9, 0, 7, null, ICON_INK, 3.5); line(c, [-2, 0, 15, 0, 15, 6, 10, 0, 10, 5], ICON_INK, 3.5); },
    gear: function (c) { for (var i = 0; i < 8; i++) { var a = i * TAU / 8; line(c, [Math.cos(a) * 9, Math.sin(a) * 9, Math.cos(a) * 15, Math.sin(a) * 15], ICON_INK, 5); } circ(c, 0, 0, 10, ICON_FILL, ICON_INK, 3); circ(c, 0, 0, 3.5, ICON_INK); },
    cup: function (c) { fillRR(c, -10, -8, 18, 20, 3, ICON_FILL, ICON_INK, 3); c.beginPath(); c.arc(9, 2, 5, -1.3, 1.3); c.strokeStyle = ICON_INK; c.lineWidth = 3; c.stroke(); },
    star: function (c) { var p = []; for (var i = 0; i < 10; i++) { var r = i % 2 ? 7 : 16, a = -Math.PI / 2 + i * Math.PI / 5; p.push(Math.cos(a) * r, Math.sin(a) * r); } poly(c, p, ICON_FILL, ICON_INK, 2.5); },
    bird: function (c) { c.beginPath(); c.ellipse(0, 3, 12, 8, 0, 0, TAU); c.fillStyle = ICON_FILL; c.fill(); c.strokeStyle = ICON_INK; c.lineWidth = 2.5; c.stroke(); circ(c, 9, -5, 6, ICON_FILL, ICON_INK, 2.5); poly(c, [14, -6, 20, -4, 14, -2], ICON_INK); line(c, [-12, 2, -18, -3], ICON_INK, 3); line(c, [-4, 0, 4, 4], ICON_INK, 2); },
    note: function (c) { circ(c, -6, 10, 6, ICON_INK); line(c, [0, 10, 0, -14, 12, -10], ICON_INK, 3.5); },
    door: function (c) { fillRR(c, -10, -16, 20, 32, 2, ICON_FILL, ICON_INK, 3); circ(c, 5, 2, 2, ICON_INK); poly(c, [12, -2, 18, 4, 12, 10], ICON_INK); },
    lamp: function (c) { glow(c, 0, -2, 20, 0.6); fillRR(c, -8, -12, 16, 20, 3, '#fff1c4', ICON_INK, 3); line(c, [-10, -12, 10, -12], ICON_INK, 3); line(c, [-6, 12, 6, 12], ICON_INK, 3); line(c, [0, -18, 0, -12], ICON_INK, 3); flame(c, 0, 6, 0.5, 0); },
    lamp_off: function (c) { fillRR(c, -8, -12, 16, 20, 3, ICON_DIM, ICON_INK, 3); line(c, [-10, -12, 10, -12], ICON_INK, 3); line(c, [-6, 12, 6, 12], ICON_INK, 3); line(c, [0, -18, 0, -12], ICON_INK, 3); line(c, [-14, -16, 14, 16], ICON_INK, 2.5); },
    fish: function (c) { c.beginPath(); c.ellipse(-2, 0, 12, 7, 0, 0, TAU); c.fillStyle = ICON_FILL; c.fill(); c.strokeStyle = ICON_INK; c.lineWidth = 2.5; c.stroke(); poly(c, [9, 0, 17, -7, 17, 7], ICON_FILL, ICON_INK, 2.5); circ(c, -8, -2, 1.8, ICON_INK); },
    flower: function (c) { for (var i = 0; i < 5; i++) { var a = i * TAU / 5; circ(c, Math.cos(a) * 7, -6 + Math.sin(a) * 7, 5, ICON_FILL, ICON_INK, 2); } circ(c, 0, -6, 3.5, ICON_INK); line(c, [0, 2, 0, 16], ICON_INK, 3); },
    oilcan: function (c) { poly(c, [-12, 14, 8, 14, 8, -2, -12, -2], ICON_FILL, ICON_INK, 3); poly(c, [-8, -2, 4, -2, -2, -10], ICON_FILL, ICON_INK, 3); line(c, [8, 2, 18, -10], ICON_INK, 3); },
    oilcan_full: function (c) { poly(c, [-12, 14, 8, 14, 8, -2, -12, -2], OIL, ICON_INK, 3); poly(c, [-8, -2, 4, -2, -2, -10], OIL, ICON_INK, 3); line(c, [8, 2, 18, -10], ICON_INK, 3); circ(c, 18, -6, 2.5, OIL); },
    wick: function (c) { circ(c, 0, 2, 11, ICON_FILL, ICON_INK, 3); circ(c, 0, 2, 4, null, ICON_INK, 2); line(c, [10, -4, 16, -14], ICON_INK, 2.5); },
    flint: function (c) { poly(c, [-14, 6, -6, -8, 6, -6, 10, 8], ICON_DIM, ICON_INK, 2.5); fillRR(c, 2, -14, 14, 7, 2, ICON_FILL, ICON_INK, 2.5); circ(c, 14, 10, 2, GLOW); circ(c, 18, 4, 1.5, GLOW); },
    logs: function (c) { circ(c, -8, 6, 7, ICON_FILL, ICON_INK, 2.5); circ(c, 7, 6, 7, ICON_FILL, ICON_INK, 2.5); circ(c, 0, -6, 7, ICON_FILL, ICON_INK, 2.5); circ(c, -8, 6, 2, ICON_INK); circ(c, 7, 6, 2, ICON_INK); circ(c, 0, -6, 2, ICON_INK); },
    lantern: function (c) { fillRR(c, -9, -10, 18, 22, 3, ICON_DIM, ICON_INK, 3); c.beginPath(); c.arc(0, -12, 7, Math.PI, 0); c.strokeStyle = ICON_INK; c.lineWidth = 3; c.stroke(); line(c, [-9, 2, 9, 2], ICON_INK, 2); },
    lantern_lit: function (c) { glow(c, 0, 2, 22, 0.7); fillRR(c, -9, -10, 18, 22, 3, '#fff1c4', ICON_INK, 3); c.beginPath(); c.arc(0, -12, 7, Math.PI, 0); c.strokeStyle = ICON_INK; c.lineWidth = 3; c.stroke(); flame(c, 0, 8, 0.55, 0); },
    bucket: function (c) { poly(c, [-12, -8, 12, -8, 8, 14, -8, 14], ICON_FILL, ICON_INK, 3); c.beginPath(); c.arc(0, -8, 12, Math.PI, 0); c.strokeStyle = ICON_INK; c.lineWidth = 2; c.stroke(); },
    bucket_water: function (c) { poly(c, [-12, -8, 12, -8, 8, 14, -8, 14], ICON_FILL, ICON_INK, 3); poly(c, [-11, -4, 11, -4, 9, 4, -9, 4], '#8fa3b0'); c.beginPath(); c.arc(0, -8, 12, Math.PI, 0); c.strokeStyle = ICON_INK; c.lineWidth = 2; c.stroke(); circ(c, 14, 8, 2.5, '#8fa3b0'); },
    bread: function (c) { c.beginPath(); c.ellipse(0, 2, 16, 10, 0, 0, TAU); c.fillStyle = '#cbb79a'; c.fill(); c.strokeStyle = ICON_INK; c.lineWidth = 2.5; c.stroke(); line(c, [-8, -4, -4, 4], ICON_INK, 2); line(c, [0, -6, 4, 2], ICON_INK, 2); line(c, [8, -4, 11, 3], ICON_INK, 2); },
    rope: function (c) { c.beginPath(); c.ellipse(0, 0, 14, 9, 0, 0, TAU); c.strokeStyle = ICON_INK; c.lineWidth = 4; c.stroke(); c.beginPath(); c.ellipse(0, 0, 8, 5, 0, 0, TAU); c.lineWidth = 3; c.stroke(); line(c, [12, 4, 18, 14], ICON_INK, 3); },
    hook: function (c) { line(c, [0, -16, 0, 4], ICON_INK, 4); c.beginPath(); c.arc(-6, 4, 6, 0, Math.PI); c.strokeStyle = ICON_INK; c.lineWidth = 4; c.stroke(); line(c, [-12, 4, -12, 0], ICON_INK, 4); circ(c, 0, -16, 3, null, ICON_INK, 2); },
    grapple: function (c) { c.beginPath(); c.ellipse(-6, -4, 9, 6, 0, 0, TAU); c.strokeStyle = ICON_INK; c.lineWidth = 3; c.stroke(); line(c, [2, -2, 10, 6], ICON_INK, 3); c.beginPath(); c.arc(8, 10, 5, 0, Math.PI); c.lineWidth = 3.5; c.stroke(); },
    shell: function (c) { poly(c, [0, 12, -15, -4, -6, -12, 6, -12, 15, -4], '#e8e2f0', ICON_INK, 2.5); for (var i = -2; i <= 2; i++) line(c, [0, 12, i * 5, -11], ICON_INK, 1.5); },
    lens: function (c) { circ(c, 0, 0, 14, '#eef3f6', ICON_INK, 3); c.beginPath(); c.arc(0, 0, 9, 3.6, 4.6); c.strokeStyle = '#ffffff'; c.lineWidth = 3; c.stroke(); poly(c, [12, -14, 14, -10, 18, -12], GLOW); },
    lens_dirty: function (c) { circ(c, 0, 0, 14, '#9d9a92', ICON_INK, 3); circ(c, -4, -3, 3, '#7b776f'); circ(c, 5, 4, 4, '#7b776f'); circ(c, 4, -6, 2, '#7b776f'); },
    cloth: function (c) { poly(c, [-14, -8, 12, -12, 16, 8, -10, 12], ICON_FILL, ICON_INK, 2.5); line(c, [-8, -2, 8, -5], ICON_DIM, 2); line(c, [-6, 4, 10, 2], ICON_DIM, 2); },
    crank: function (c) { line(c, [-12, 10, -12, -6, 10, -6, 10, -14], ICON_INK, 4.5); circ(c, -12, 12, 4, ICON_FILL, ICON_INK, 2.5); fillRR(c, 6, -18, 8, 8, 2, ICON_FILL, ICON_INK, 2); },
    moon: function (c) { circ(c, 0, 0, 14, '#ecead8', ICON_INK, 2.5); circ(c, 7, -4, 11, ICON_DIM); },
    bell: function (c) { poly(c, [-12, 10, -8, -8, 0, -14, 8, -8, 12, 10], ICON_FILL, ICON_INK, 2.5); line(c, [-14, 10, 14, 10], ICON_INK, 3); circ(c, 0, 14, 3, ICON_INK); },
    goat: function (c) { c.beginPath(); c.ellipse(-2, 4, 12, 8, 0, 0, TAU); c.fillStyle = ICON_FILL; c.fill(); c.strokeStyle = ICON_INK; c.lineWidth = 2.5; c.stroke(); circ(c, 12, -4, 5, ICON_FILL, ICON_INK, 2.5); line(c, [11, -9, 6, -16], ICON_INK, 2.5); line(c, [14, -9, 13, -17], ICON_INK, 2.5); line(c, [-10, 10, -10, 17], ICON_INK, 2.5); line(c, [6, 10, 6, 17], ICON_INK, 2.5); },
    cat: function (c) { c.beginPath(); c.ellipse(0, 6, 10, 9, 0, 0, TAU); c.fillStyle = ICON_FILL; c.fill(); c.strokeStyle = ICON_INK; c.lineWidth = 2.5; c.stroke(); circ(c, 0, -8, 7, ICON_FILL, ICON_INK, 2.5); poly(c, [-6, -12, -6, -19, -1, -14], ICON_INK); poly(c, [6, -12, 6, -19, 1, -14], ICON_INK); line(c, [9, 10, 17, 2], ICON_INK, 3); },
    gull: function (c) { c.beginPath(); c.ellipse(0, 4, 13, 7, 0, 0, TAU); c.fillStyle = '#f0efec'; c.fill(); c.strokeStyle = ICON_INK; c.lineWidth = 2.5; c.stroke(); circ(c, 11, -4, 5, '#f0efec', ICON_INK, 2.5); poly(c, [15, -4, 22, -2, 15, 0], GLOW); line(c, [-6, 0, -16, -10], ICON_INK, 3); },
    stool: function (c) { fillRR(c, -14, -8, 28, 6, 2, ICON_FILL, ICON_INK, 2.5); line(c, [-10, -2, -12, 14], ICON_INK, 3); line(c, [10, -2, 12, 14], ICON_INK, 3); line(c, [-11, 7, 11, 7], ICON_INK, 2); },
    up: function (c) { poly(c, [0, -16, 12, -2, 5, -2, 5, 14, -5, 14, -5, -2, -12, -2], ICON_FILL, ICON_INK, 2.5); },
    cross: function (c) { line(c, [-11, -11, 11, 11], '#6a3b35', 5); line(c, [11, -11, -11, 11], '#6a3b35', 5); },
    check: function (c) { line(c, [-12, 0, -3, 10, 13, -10], '#3f5f3d', 5); },
    question: function (c) { c.beginPath(); c.arc(0, -6, 8, Math.PI * 1.1, Math.PI * 2.4); c.strokeStyle = ICON_INK; c.lineWidth = 4; c.stroke(); line(c, [2, 2, 0, 6], ICON_INK, 4); circ(c, 0, 13, 2.5, ICON_INK); },
    eye: function (c) { c.beginPath(); c.moveTo(-16, 0); c.quadraticCurveTo(0, -14, 16, 0); c.quadraticCurveTo(0, 14, -16, 0); c.fillStyle = ICON_FILL; c.fill(); c.strokeStyle = ICON_INK; c.lineWidth = 2.5; c.stroke(); circ(c, 0, 0, 5, ICON_INK); },
    fire: function (c) { glow(c, 0, 0, 20, 0.5); flame(c, 0, 14, 1.4, 0); },
    cold: function (c) { for (var i = 0; i < 3; i++) { var a = i * Math.PI / 3; line(c, [Math.cos(a) * 15, Math.sin(a) * 15, -Math.cos(a) * 15, -Math.sin(a) * 15], '#6c7d8a', 3); } circ(c, 0, 0, 3, '#6c7d8a'); },
    heart: function (c) { c.beginPath(); c.moveTo(0, 14); c.bezierCurveTo(-20, 0, -12, -16, 0, -6); c.bezierCurveTo(12, -16, 20, 0, 0, 14); c.fillStyle = '#b77b70'; c.fill(); c.strokeStyle = ICON_INK; c.lineWidth = 2; c.stroke(); },
    boat: function (c) { poly(c, [-18, 2, 18, 2, 12, 12, -12, 12], ICON_FILL, ICON_INK, 2.5); line(c, [0, 2, 0, -16], ICON_INK, 2.5); poly(c, [1, -15, 12, -2, 1, -2], ICON_FILL, ICON_INK, 2); },
    fog: function (c) { line(c, [-16, -6, 16, -6], ICON_DIM, 4); line(c, [-12, 2, 18, 2], ICON_DIM, 4); line(c, [-18, 10, 10, 10], ICON_DIM, 4); },
    tower: function (c) { poly(c, [-8, 16, 8, 16, 5, -8, -5, -8], ICON_FILL, ICON_INK, 2.5); fillRR(c, -7, -16, 14, 8, 2, '#fff1c4', ICON_INK, 2); line(c, [-6, 2, 6, 2], ICON_INK, 2); },
    hammer: function (c) { line(c, [-10, 14, 6, -2], ICON_INK, 4); fillRR(c, -2, -16, 20, 9, 2, ICON_FILL, ICON_INK, 2.5); },
    well: function (c) { fillRR(c, -12, 0, 24, 14, 3, ICON_FILL, ICON_INK, 2.5); line(c, [-10, 0, -10, -12, 10, -12, 10, 0], ICON_INK, 2.5); poly(c, [-14, -12, 0, -20, 14, -12], ICON_INK); line(c, [0, -12, 0, -2], ICON_INK, 1.5); },
    barrel: function (c) { c.beginPath(); c.ellipse(0, 0, 11, 15, 0, 0, TAU); c.fillStyle = ICON_FILL; c.fill(); c.strokeStyle = ICON_INK; c.lineWidth = 2.5; c.stroke(); line(c, [-11, -6, 11, -6], ICON_INK, 2); line(c, [-11, 6, 11, 6], ICON_INK, 2); },
    cave: function (c) { c.beginPath(); c.moveTo(-18, 14); c.quadraticCurveTo(-16, -16, 0, -16); c.quadraticCurveTo(16, -16, 18, 14); c.closePath(); c.fillStyle = ICON_DIM; c.fill(); c.strokeStyle = ICON_INK; c.lineWidth = 2.5; c.stroke(); c.beginPath(); c.moveTo(-8, 14); c.quadraticCurveTo(0, -6, 8, 14); c.fillStyle = ICON_INK; c.fill(); },
    bridge: function (c) { line(c, [-18, 8, 18, 8], ICON_INK, 4); c.beginPath(); c.moveTo(-18, 8); c.quadraticCurveTo(0, -14, 18, 8); c.strokeStyle = ICON_INK; c.lineWidth = 2.5; c.stroke(); for (var i = -2; i <= 2; i++) line(c, [i * 6, 8, i * 6, -2 + Math.abs(i) * 3], ICON_INK, 1.5); },
    stairs: function (c) { line(c, [-16, 14, -16, 6, -6, 6, -6, -2, 4, -2, 4, -10, 14, -10, 14, -16], ICON_INK, 3.5); },
    gauge: function (c) { circ(c, 0, 2, 14, ICON_FILL, ICON_INK, 2.5); line(c, [0, 2, 8, -6], ICON_INK, 3); c.beginPath(); c.arc(0, 2, 10, -0.9, -0.3); c.strokeStyle = '#3f5f3d'; c.lineWidth = 4; c.stroke(); },
    pipe: function (c) { line(c, [-16, -6, 4, -6, 4, 14], ICON_INK, 9); line(c, [-16, -6, 4, -6, 4, 14], ICON_FILL, 4); },
    lock: function (c) { fillRR(c, -11, -2, 22, 16, 3, ICON_FILL, ICON_INK, 2.5); c.beginPath(); c.arc(0, -2, 7, Math.PI, 0); c.strokeStyle = ICON_INK; c.lineWidth = 3; c.stroke(); circ(c, 0, 6, 2.5, ICON_INK); },
    lever: function (c) { fillRR(c, -12, 8, 24, 8, 2, ICON_FILL, ICON_INK, 2.5); line(c, [0, 8, 8, -12], ICON_INK, 3.5); circ(c, 8, -12, 4, ICON_INK); poly(c, [-14, -16, -6, -16, -10, -8], ICON_INK); },
    lever_on: function (c) { fillRR(c, -12, 8, 24, 8, 2, ICON_FILL, ICON_INK, 2.5); line(c, [0, 8, 0, -14], ICON_INK, 3.5); circ(c, 0, -14, 4, ICON_INK); },
    lever_off: function (c) { fillRR(c, -12, -16, 24, 8, 2, ICON_FILL, ICON_INK, 2.5); line(c, [0, -8, 0, 14], ICON_INK, 3.5); circ(c, 0, 14, 4, ICON_INK); },
    dot1: function (c) { circ(c, 0, 0, 5, ICON_INK); },
    dot2: function (c) { circ(c, -7, 0, 5, ICON_INK); circ(c, 7, 0, 5, ICON_INK); },
    dot3: function (c) { circ(c, -11, 0, 4.5, ICON_INK); circ(c, 0, 0, 4.5, ICON_INK); circ(c, 11, 0, 4.5, ICON_INK); },
    firefly: function (c, t) { glow(c, 0, 0, 22, 0.8); circ(c, 0, 0, 5, '#fff3c8'); c.globalAlpha = 0.6; circ(c, -5, -6, 5, ICON_FILL); circ(c, 5, -6, 5, ICON_FILL); c.globalAlpha = 1; },
    water: function (c) { c.beginPath(); c.moveTo(0, -15); c.quadraticCurveTo(13, 4, 0, 14); c.quadraticCurveTo(-13, 4, 0, -15); c.fillStyle = '#8fa3b0'; c.fill(); c.strokeStyle = ICON_INK; c.lineWidth = 2; c.stroke(); },
    book: function (c) { poly(c, [-16, -12, 0, -8, 16, -12, 16, 12, 0, 16, -16, 12], ICON_FILL, ICON_INK, 2.5); line(c, [0, -8, 0, 16], ICON_INK, 2); line(c, [-11, -3, -4, -1], ICON_DIM, 2); line(c, [4, -1, 11, -3], ICON_DIM, 2); },
    hint: function (c) { circ(c, 0, -4, 11, '#fff1c4', ICON_INK, 2.5); fillRR(c, -5, 7, 10, 7, 2, ICON_DIM, ICON_INK, 2); },
    close: function (c) { line(c, [-9, -9, 9, 9], ICON_INK, 4); line(c, [9, -9, -9, 9], ICON_INK, 4); },
    prev: function (c) { poly(c, [8, -12, -8, 0, 8, 12], ICON_INK); },
    next: function (c) { poly(c, [-8, -12, 8, 0, -8, 12], ICON_INK); },
    timer: function (c) { circ(c, 0, 2, 13, ICON_FILL, ICON_INK, 2.5); line(c, [0, 2, 0, -6], ICON_INK, 2.5); line(c, [0, 2, 6, 5], ICON_INK, 2.5); line(c, [-4, -14, 4, -14], ICON_INK, 3); }
  };
  for (var nn = 0; nn < 5; nn++) (function (n) { IC['n' + n] = function (c) { line(c, [-16, 12, 16, 12], ICON_DIM, 1.5); line(c, [-16, -16, 16, -16], ICON_DIM, 1.5); var y = 8 - n * 6; circ(c, -2, y, 5, ICON_INK); line(c, [3, y, 3, y - 14], ICON_INK, 2.5); }; })(nn);
    IC.__fill = function (f) { ICON_FILL = f || '#e9dcc0'; };
    // пиктограммы движка глав (общие с серым макетом): themes/icons-ext.js
    var KX = global.KVEST && global.KVEST.IconsExt;
    if (KX) { var EX = KX({ circ: circ, line: line, poly: poly, fillRR: fillRR, glow: glow, flame: flame, ink: function () { return ICON_INK; }, fill: function () { return ICON_FILL; }, dim: function () { return ICON_DIM; } }); for (var ek in EX) if (!IC[ek]) IC[ek] = EX[ek]; }
    return IC;
  })();
  // цвет бумаги каждой пиктограммы
  var ICOL = { key: '#d8a640', gear: '#dca543', cup: '#7fa3a0', star: '#e9b949', bird: '#7fa3a0', door: '#a8774e', fish: '#7fa3b4', flower: '#e38b6a',
    oilcan: '#a7a49a', oilcan_full: '#a7a49a', wick: '#efe2c4', flint: '#c8c2b6', logs: '#d2a874', lantern: '#9c968a', lantern_lit: '#9c968a', bucket: '#b48a5c',
    bucket_water: '#b48a5c', rope: '#d9c18e', hook: '#b9b6ae', grapple: '#d9c18e', shell: '#f1d9df', cloth: '#d97a63', crank: '#b9b6ae', moon: '#f4ebcf',
    bell: '#d9b14a', goat: '#f1ead8', cat: '#d8834c', gull: '#f6f3ea', stool: '#c69a66', up: '#f1c96a', eye: '#f6efe0', boat: '#e6d2a8', tower: '#efe5cc',
    hammer: '#b9b6ae', well: '#b3a993', barrel: '#b4824e', cave: '#857a6c', gauge: '#f2e5c7', pipe: '#cf8c5c', lock: '#d9b14a', lever: '#cfc4aa',
    lever_on: '#cfc4aa', lever_off: '#cfc4aa', book: '#f2e5c7', hint: '#f8e7a8', timer: '#f2e5c7', bread: '#d39a55', water: '#7fb0c4', lens: '#e2f1f4' };
  (function () { var X = global.KVEST && global.KVEST.IconsExtCol; if (X) for (var k in X) if (!ICOL[k]) ICOL[k] = X[k]; })();
  function drawIconRaw(g, id, x, y, size) { // вектор без кэша (внутри спрайтов)
    var f = IC[id], s = (size || 40) / 40;
    g.save(); g.translate(x, y); g.scale(s, s); IC.__fill(ICOL[id]);
    if (f) f(g, 0); else { g.beginPath(); g.arc(0, 0, 15, 0, TAU); g.fillStyle = '#e9dcc0'; g.fill(); IC.question(g); }
    g.restore();
  }
  function iconSprite(id, size) {
    size = Math.max(8, Math.round(size));
    var pad = Math.ceil(size * 0.22) + 3, key = 'icon|' + id + '|' + size;
    return sprite(key, -size / 2 - pad, -size / 2 - pad, size + pad * 2, size + pad * 2, function (g) {
      if (!HAS_DOM) { drawIconRaw(g, id, 0, 0, size); return; }
      var c2 = mkCanvas((size + pad * 2) * RES, (size + pad * 2) * RES), g2 = c2.getContext('2d');
      g2.scale(RES, RES); g2.translate(size / 2 + pad, size / 2 + pad); drawIconRaw(g2, id, 0, 0, size);
      texOver(g2, -size, -size, size * 2 + pad * 2, size * 2 + pad * 2, 0.7);
      g.save(); g.shadowColor = 'rgba(40,20,8,0.42)'; g.shadowBlur = Math.max(1.5, size * 0.05) * RES; g.shadowOffsetX = size * 0.03 * RES; g.shadowOffsetY = size * 0.06 * RES;
      g.drawImage(c2, -size / 2 - pad, -size / 2 - pad, size + pad * 2, size + pad * 2); g.restore();
    });
  }
  function drawIcon(ctx, id, x, y, size) {
    var s = iconSprite(IC[id] ? id : (id === 'hand' ? 'hand' : 'question_' + id), size || 40);
    if (!s.c) { ctx.save(); ctx.translate(x, y); s.fn(ctx); ctx.restore(); return; }
    ctx.drawImage(s.c, x + s.x, y + s.y, s.w, s.h);
  }

  // ================= персонажи: марионетки из вырезок на латунных шпильках, «стоп-моушн» 12 к/с =================
  function M(a, b, c, d, e, f) { return [a, b, c, d, e, f]; }
  function mul(m, n) { return [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]]; }
  function tr(m, x, y) { return mul(m, M(1, 0, 0, 1, x, y)); }
  function ro(m, a) { var c = Math.cos(a), s = Math.sin(a); return mul(m, M(c, s, -s, c, 0, 0)); }
  function ap(m, p) { return p.map(function (q) { return [m[0] * q[0] + m[2] * q[1] + m[4], m[1] * q[0] + m[3] * q[1] + m[5]]; }); }
  function pin(m, x, y) { return ap(m, [[x, y]])[0]; }
  function Rig() { this.parts = []; this.pins = []; }
  Rig.prototype.add = function (m, pts, col, z, o) { this.parts.push({ pts: ap(m, pts), col: col, z: z, o: o || {} }); };
  Rig.prototype.draw = function (g) {
    this.parts.sort(function (a, b) { return a.z - b.z; });
    for (var i = 0; i < this.parts.length; i++) {
      var p = this.parts[i];
      if (p.o.flat) { flat(g, p.pts, p.col); if (p.o.hl) { var c0 = p.pts[0]; g.fillStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); g.arc(c0[0] - 1.4, c0[1] - 1.2, 0.8, 0, TAU); g.fill(); } continue; }
      cut(g, p.pts, p.col, { live: true, lift: p.o.lift == null ? 1.8 : p.o.lift, seed: 5000 + i * 13, amp: 0.45, step: 7, sh: 0.28 });
    }
    for (var j = 0; j < this.pins.length; j++) brad(g, this.pins[j][0], this.pins[j][1], 1.6);
  };
  function q12(t) { return Math.floor(t * 12) / 12; }

  // ---------- героиня Тая: коса с лентой, длинное пальто, шарф, сумка через плечо ----------
  var HERO = { coat: '#b9563b', coatB: '#94432f', coatD: '#8e3c2b', skin: '#efc8a0', skinB: '#d9ad86', leg: '#3e4d55', boot: '#4a3022', bag: '#8c6340', bagD: '#76512f',
    strap: '#5a3a28', hair: '#4b2f22', ribbon: '#e2b04a', scarf: '#e2b04a', scarfD: '#c48f2c', eye: '#2c1d16', mouth: '#7a2e22', cheek: 'rgba(214,110,90,0.35)' };
  function heroRig(pose, t, hx, hy, dir) {
    var R = new Rig(), tq = q12(t), lean = 0, bob = 0, lb = 0, lf = 0, ab1 = 0.12, ab2 = -0.2, af1 = -0.08, af2 = -0.25, head = 0, braid = 0.5, eye = 'n', mouth = 'n', scarf = 0.2;
    if (pose === 'walk') { var p = tq * 11.5, s = Math.sin(p); lb = s * 0.5; lf = -s * 0.5; bob = -Math.abs(Math.cos(p)) * 3; ab1 = -s * 0.5; af1 = s * 0.5; ab2 = -0.35; af2 = -0.35; lean = 0.05; braid = 0.75 + Math.sin(p * 2) * 0.12; head = Math.sin(p * 2) * 0.03; scarf = 0.5 + Math.sin(p * 2) * 0.15; }
    else if (pose === 'reach') { af1 = -2.1; af2 = -0.15; lean = 0.08; lf = -0.25; lb = 0.15; head = -0.1; ab1 = 0.35; braid = 0.65; scarf = 0.35; }
    else if (pose === 'think') { af1 = -0.55; af2 = -2.4; head = -0.12 + Math.sin(tq * 1.5) * 0.03; eye = 'up'; braid = 0.45 + Math.sin(tq * 1.2) * 0.05; mouth = 'o'; }
    else if (pose === 'happy') { var j = Math.abs(Math.sin(tq * 8)); bob = -j * 11; af1 = -2.7; af2 = -0.3; ab1 = 2.5; ab2 = 0.3; lb = 0.3 * j; lf = -0.3 * j; mouth = 'smile'; eye = 'closed'; braid = 0.5 + j * 0.5; scarf = 0.3 + j * 0.4; }
    else { bob = Math.sin(tq * 2.2) * 0.8; ab1 = 0.12 + Math.sin(tq * 1.1) * 0.04; af1 = -0.08 - Math.sin(tq * 1.1) * 0.04; braid = 0.45 + Math.sin(tq * 1.4) * 0.06; scarf = 0.2 + Math.sin(tq * 1.3) * 0.06; }
    if ((t % 3.7) < 0.12 && eye === 'n') eye = 'closed';
    var root = M(dir, 0, 0, 1, hx, hy), body = tr(root, 0, bob); body = tr(body, 0, -36); body = ro(body, lean); body = tr(body, 0, 36);
    function arm(shx, a1, a2, back) {
      var u = ro(tr(body, shx, -82), a1);
      R.add(u, [[-5, -3], [5, -3], [4.5, 18], [-4.5, 18]], back ? HERO.coatB : HERO.coat, back ? 1 : 9);
      var f = ro(tr(u, 0, 17), a2);
      R.add(f, [[-4, -1], [4, -1], [3.6, 13], [-3.6, 13]], back ? HERO.coatB : HERO.coat, back ? 0.9 : 9.1);
      R.add(f, ell(0, 15.5, 4.4, 4.4, 10), back ? HERO.skinB : HERO.skin, back ? 0.95 : 9.2);
      if (!back) R.pins.push(pin(u, 0, 0), pin(f, 0, 0));
    }
    function leg(hipx, a, back) {
      var l = ro(tr(body, hipx, -30), a);
      R.add(l, [[-4.5, -3], [4.5, -3], [4.5, 22], [-4.5, 22]], back ? dark(HERO.leg, 0.2) : HERO.leg, back ? 2 : 6);
      R.add(l, [[-5.5, 19], [5.5, 19], [12, 24], [12, 30], [-6.5, 30], [-6.5, 23]], back ? dark(HERO.boot, 0.2) : HERO.boot, back ? 2.1 : 6.1);
    }
    arm(-4, ab1, ab2, true); leg(-5, lb, true);
    R.add(body, [[-30, -62], [-12, -62], [-11, -40], [-31, -40]], HERO.bag, 3); R.add(body, [[-31, -62], [-11, -62], [-12, -52], [-30, -51]], HERO.bagD, 3.1);
    var hd = ro(tr(body, 0, -88), head), bm = ro(tr(hd, -12, -12), 0.2 + braid * 0.35);
    for (var k = 0; k < 4; k++) { R.add(bm, ell(0, 3 + k * 6.5, 5 - k * 0.5, 4.4, 12), HERO.hair, 5.6 + k * 0.01); bm = ro(tr(bm, 0, 6), Math.sin(tq * 3 + k) * 0.05 + (pose === 'walk' ? 0.06 : 0)); }
    R.add(bm, [[-4, 2], [4, 2], [3, 7], [-3, 7]], HERO.ribbon, 5.65); R.add(bm, [[-3, 7], [3, 7], [5, 14], [0, 12], [-5, 14]], HERO.hair, 5.64);
    // длинное пальто до колен, полы расходятся при ходьбе
    var fl = pose === 'walk' ? Math.abs(Math.sin(tq * 11.5)) * 3 : 0;
    R.add(body, [[-12, -86], [11, -86], [14, -78], [18 + fl, -16], [-19 - fl, -16], [-15, -78]], HERO.coat, 5);
    R.add(body, [[1, -84], [5, -84], [6, -16], [2, -16]], HERO.coatD, 5.1, { lift: 0.5 });
    [-70, -56, -42].forEach(function (yy) { R.pins.push(pin(body, 8, yy)); });
    R.add(body, [[-15, -46], [15, -46], [16, -41], [-16, -41]], HERO.strap, 5.2, { lift: 0.8 });
    R.add(body, [[7, -86], [11, -84], [-14, -50], [-18, -53]], HERO.strap, 5.3, { lift: 1 });
    leg(5, lf, false);
    // шарф: кольцо и развевающийся хвост
    R.add(body, [[-11, -90], [11, -90], [12, -82], [-12, -82]], HERO.scarf, 7.5);
    var sm = ro(tr(body, -8, -84), 0.25 + scarf);
    R.add(sm, [[-4, 0], [4, 0], [5, 22], [0, 20], [-4, 23]], HERO.scarfD, 7.4);
    R.add(hd, ell(2, -17, 16, 16, 26), HERO.skin, 8);
    var hair = ell(1, -19, 18, 18, 22, Math.PI * 0.62, Math.PI * 1.88); hair.push([11, -26], [6, -22], [2, -27], [-3, -21], [-8, -25], [-11, -15], [-9, -6]);
    R.add(hd, hair, HERO.hair, 8.1);
    R.add(hd, ell(8, -9.5, 3.2, 2.4, 10), HERO.cheek, 8.2, { flat: true });
    R.add(hd, [[6, -24.5], [13.5, -25], [13.5, -23.4], [6, -22.9]], HERO.eye, 8.22, { flat: true });
    R.add(hd, [[16, -19], [21, -15], [16.5, -13.5]], HERO.skin, 8.25, { lift: 0.6 });
    if (eye === 'closed') R.add(hd, [[7, -18.2], [12, -18.2], [12, -16.8], [7, -16.8]], HERO.eye, 8.3, { flat: true });
    else R.add(hd, ell(10, eye === 'up' ? -20 : -18, 2.5, 3.2, 10), HERO.eye, 8.3, { flat: true, hl: true });
    if (mouth === 'smile') R.add(hd, ell(11, -9, 4.5, 3.5, 10, 0, Math.PI), HERO.mouth, 8.35, { flat: true });
    else if (mouth === 'o') R.add(hd, ell(12, -8, 1.8, 2, 8), HERO.mouth, 8.35, { flat: true });
    else R.add(hd, [[8, -8], [14, -9], [14, -7.8], [8, -6.9]], HERO.mouth, 8.35, { flat: true });
    R.pins.push(pin(hd, 0, 0));
    arm(5, af1, af2, false);
    return R;
  }
  function drawHero(ctx, hero, pose, t) {
    var dir = hero.dir < 0 ? -1 : 1, x = hero.x, y = hero.y;
    ctx.fillStyle = 'rgba(40,22,10,0.28)'; ctx.beginPath(); ctx.ellipse(x, y + 1, 20, 4.5, 0, 0, TAU); ctx.fill();
    actor(ctx, x - 60, y - 160, 120, 172, function (g) { heroRig(pose || 'idle', t || 0, x, y, dir).draw(g); }, 'hero', Math.floor((t || 0) * 12) + '|' + pose + '|' + dir + '|' + (((t || 0) % 3.7) < 0.12 ? 1 : 0));
  }

  // ---------- персонажи сцены ----------
  var NPC = {};
  NPC.master = function (g, o, pose, t) { // старый мастер в кресле, под пледом; мёрзнет, пока печь холодная
    var st = o.state || {}, x = o.x, y = o.y, w = o.w, h = o.h, cx = x + w / 2, by = y + h, tq = q12(t), warm = !!st.warm;
    var sh = warm ? 0 : Math.sin(tq * 40) * 1.2, happy = pose === 'happy', R = new Rig(), root = M(1, 0, 0, 1, cx + sh, by);
    cut(g, rrP(x - 6, by - 112, w + 12, 74, 14), '#4f7472', { seed: 5600, lift: 4, live: true }); // спинка кресла
    cut(g, rectP(x - 10, by - 56, 16, 56), '#3b5756', { seed: 5601, lift: 3, live: true }); cut(g, rectP(x + w - 6, by - 56, 16, 56), '#3b5756', { seed: 5602, lift: 3, live: true });
    var breath = Math.sin(tq * 1.6) * 1.2;
    R.add(root, [[-26, -78 + breath], [26, -78 + breath], [32, -30], [-32, -30]], '#5d4a3c', 2); // туловище в кофте
    R.add(root, [[-34, -48], [34, -48], [38, -6], [-38, -6]], warm ? '#c98a4a' : '#b3533a', 3); // плед
    for (var k = 0; k < 4; k++) R.add(root, [[-34 + k * 18, -48], [-29 + k * 18, -48], [-27 + k * 18, -6], [-32 + k * 18, -6]], '#efe2c4', 3.1, { lift: 0.3 });
    R.add(root, [[-34, -30], [34, -30], [35, -25], [-35, -25]], '#efe2c4', 3.2, { lift: 0.3 });
    var hd = ro(tr(root, 0, -82 + breath), happy ? Math.sin(tq * 6) * 0.08 : (warm ? 0.05 : -0.05));
    R.add(hd, ell(0, -16, 15, 16, 22), C.skin, 4);
    R.add(hd, [[-14, -14], [14, -14], [16, 2], [6, 18], [0, 24], [-6, 18], [-16, 2]], '#f2ece0', 4.2); // борода
    R.add(hd, ell(9, -12, 4.5, 4, 10), warm ? '#d9907a' : '#e07a6a', 4.3);
    R.add(hd, [[-17, -22], [17, -22], [15, -36], [0, -42], [-15, -36]], C.mustard, 4.4); // вязаная шапка
    R.add(hd, [[-18, -24], [18, -24], [18, -19], [-18, -19]], '#c48f2c', 4.45);
    R.add(hd, ell(0, -43, 5, 5, 10), C.rust, 4.5);
    var closedEyes = warm && !happy ? (t % 4) < 2.6 : (t % 4.3) < 0.13;
    if (closedEyes || happy) { R.add(hd, [[-9, -16], [-3, -16], [-3, -15], [-9, -15]], '#2c1d16', 4.6, { flat: true }); R.add(hd, [[3, -16], [9, -16], [9, -15], [3, -15]], '#2c1d16', 4.6, { flat: true }); }
    else { R.add(hd, ell(-6, -16, 1.8, 2.1, 8), '#2c1d16', 4.6, { flat: true, hl: true }); R.add(hd, ell(6, -16, 1.8, 2.1, 8), '#2c1d16', 4.6, { flat: true, hl: true }); }
    var aL = happy ? -2.6 : (warm ? 0.5 : 0.9), aR = happy ? 2.6 : (warm ? -0.5 : -0.9);
    [[-22, aL], [22, aR]].forEach(function (a) { var u = ro(tr(root, a[0], -70 + breath), a[1]); R.add(u, [[-5, 0], [5, 0], [4, 30], [-4, 30]], '#6a5546', 5); R.add(u, ell(0, 32, 5, 5, 10), C.skin, 5.1); R.pins.push(pin(u, 0, 0)); });
    R.draw(g);
    if (!warm) { var k2 = Math.sin(t * 2) * 2; cut(g, ell(x + w + 6, by - 136 + k2, 15, 15, 16), '#e4eef2', { seed: 5605, lift: 2, live: true }); drawIconRaw(g, 'cold', x + w + 6, by - 136 + k2, 26); }
  };
  NPC.baker = function (g, o, pose, t) { // пекарша выглядывает из окна-прилавка
    var x = o.x, y = o.y, w = o.w, h = o.h, cx = x + w / 2, by = y + h, tq = q12(t), happy = pose === 'happy', R = new Rig();
    var bob = happy ? -Math.abs(Math.sin(tq * 7)) * 3 : Math.sin(tq * 1.5) * 0.8, root = M(1, 0, 0, 1, cx, by + bob);
    R.add(root, [[-24, -38], [24, -38], [28, 2], [-28, 2]], '#6f8f8c', 2); // платье
    R.add(root, [[-16, -36], [16, -36], [18, 2], [-18, 2]], '#f4ecdc', 2.2); // фартук
    var hd = ro(tr(root, 0, -40), Math.sin(tq * 1.2) * 0.04);
    R.add(hd, ell(0, -14, 13, 14, 22), C.skin, 3);
    R.add(hd, [[-15, -14], [15, -14], [12, -30], [0, -33], [-12, -30]], '#f8f3ea', 3.1); // косынка
    R.add(hd, [[11, -22], [22, -26], [19, -18]], '#f8f3ea', 3.05);
    R.add(hd, ell(-7, -8, 3, 2.2, 8), 'rgba(214,110,90,0.45)', 3.2, { flat: true }); R.add(hd, ell(7, -8, 3, 2.2, 8), 'rgba(214,110,90,0.45)', 3.2, { flat: true });
    var blink = (t % 3.9) < 0.12 || happy;
    if (blink) { R.add(hd, [[-7, -14], [-2, -14], [-2, -13], [-7, -13]], '#2c1d16', 3.3, { flat: true }); R.add(hd, [[2, -14], [7, -14], [7, -13], [2, -13]], '#2c1d16', 3.3, { flat: true }); }
    else { R.add(hd, ell(-4.5, -14, 1.6, 2, 8), '#2c1d16', 3.3, { flat: true, hl: true }); R.add(hd, ell(4.5, -14, 1.6, 2, 8), '#2c1d16', 3.3, { flat: true, hl: true }); }
    R.add(hd, ell(0, -6, happy ? 4 : 2.5, happy ? 3 : 1.4, 8, 0, Math.PI), '#7a2e22', 3.3, { flat: true });
    [[-20, happy ? -2.4 : 0.3], [20, happy ? 2.4 : -0.3]].forEach(function (a) { var u = ro(tr(root, a[0], -32), a[1]); R.add(u, [[-4.5, 0], [4.5, 0], [4, 20], [-4, 20]], '#6f8f8c', 4); R.add(u, ell(0, 22, 4.5, 4.5, 10), C.skin, 4.1); });
    R.draw(g);
  };
  NPC.goat = function (g, o, pose, t) { // коза: стоит на поленнице; довольная — жуёт хлеб
    var x = o.x, y = o.y, w = o.w, h = o.h, by = y + h, tq = q12(t), happy = pose === 'happy', dir = happy ? -1 : 1, cx = x + w / 2, R = new Rig();
    var root = M(dir * w / 96, 0, 0, h / 82, cx, by - (happy ? 0 : 6)), chew = Math.sin(tq * (happy ? 10 : 3)) * 0.06;
    [-22, -10, 12, 24].forEach(function (lx, i) { R.add(root, [[lx - 3, -26], [lx + 3, -26], [lx + 2.5, 0], [lx - 2.5, 0]], i % 2 ? '#d8cfbc' : '#cfc5b0', 1); R.add(root, [[lx - 3.5, -4], [lx + 3.5, -4], [lx + 3.5, 0], [lx - 3.5, 0]], '#3a2a20', 1.1); });
    R.add(root, ell(0, -38, 34, 17, 24), '#f1ead8', 2); // туловище
    R.add(root, ell(-12, -42, 12, 8, 14), '#e3d9c2', 2.1, { lift: 0.5 });
    R.add(root, [[-33, -42], [-42, -50], [-38, -36]], '#f1ead8', 1.9); // хвостик
    var hd = ro(tr(root, 30, -48), -0.35 + chew);
    R.add(hd, [[-6, 4], [6, -4], [22, 4], [22, 14], [8, 16]], '#f1ead8', 3); // морда
    R.add(hd, [[-4, -4], [2, -18], [6, -16], [2, -2]], '#8a7a62', 2.9); R.add(hd, [[2, -4], [10, -16], [13, -13], [6, -2]], '#7a6a52', 2.95); // рога
    R.add(hd, [[-6, 2], [-16, -2], [-8, 8]], '#e3d9c2', 3.1); // ухо
    R.add(hd, [[12, 14], [18, 14], [15, 26]], '#d8cfbc', 3.2); // бородка
    R.add(hd, ell(10, 4, 2.4, 2, 8), '#2c1d16', 3.3, { flat: true, hl: true });
    R.add(hd, ell(21, 9, 1.8, 1.4, 6), '#7a5a4a', 3.3, { flat: true });
    if (happy) R.add(hd, ell(24, 14, 7, 5, 10), '#d39a55', 3.4);
    R.draw(g);
  };
  NPC.cat = function (g, o, pose, t) { // рыжая кошка на ящике; сытая — жмурится
    var st = o.state || {}, fed = !!st.fed, x = o.x, y = o.y, w = o.w, h = o.h, tq = q12(t), R = new Rig();
    var root = M(1.15, 0, 0, 1.15, x + w / 2, y + h), tail = Math.sin(tq * 1.6) * 0.2, head = Math.sin(tq * 0.8) * 0.04;
    var tm = ro(tr(root, -14, -4), tail), c1 = [], c2 = [];
    for (var i = 0; i <= 10; i++) { var f = i / 10, px = -10 + f * 2 + Math.cos(-2.2 + f * 2.6) * (6 + f * 12) * 0.4 - f * 6, py = -12 - f * 22, wd = 3.6 - f * 1.2; c1.push([px - wd, py]); c2.push([px + wd, py]); }
    R.add(tm, c1.concat(c2.reverse()), '#c4693b', 0);
    R.add(root, [[-18, 0], [-20, -12], [-16, -26], [-8, -34], [6, -35], [13, -27], [16, -12], [15, 0]], '#c4693b', 1);
    [[-17, -14, -9, -18], [-18, -5, -9, -8], [-12, -26, -5, -29]].forEach(function (s) { R.add(root, [[s[0], s[1]], [s[2], s[3]], [s[2] + 1, s[3] + 4], [s[0] + 1, s[1] + 4]], '#97492a', 1.1, { lift: 0.3 }); });
    R.add(root, [[1, -31], [10, -25], [11, -4], [2, -2], [-2, -16]], '#f1e2c6', 1.2);
    var hd = ro(tr(root, 3, -34), head);
    R.add(hd, [[-12, -6], [-11, -24], [-2, -14]], '#c4693b', 2); R.add(hd, [[12, -6], [12, -24], [3, -14]], '#c4693b', 2);
    R.add(hd, ell(0, -8, 13.5, 11, 22), '#c4693b', 2.1);
    R.add(hd, [[-7, -2], [-3, -6], [3, -6], [7, -2], [3, 2], [-3, 2]], '#f1e2c6', 2.2);
    R.add(hd, [[-2, -5.2], [2, -5.2], [0, -3]], '#d9807a', 2.3, { flat: true });
    var closed = fed || (t % 5.1) < 0.14;
    if (closed) { R.add(hd, ell(-5.5, -10, 3.4, 1.6, 8, Math.PI, TAU), '#2a1a12', 2.4, { flat: true }); R.add(hd, ell(5.5, -10, 3.4, 1.6, 8, Math.PI, TAU), '#2a1a12', 2.4, { flat: true }); }
    else { R.add(hd, ell(-5.5, -9.5, 3.4, 3.8, 12), '#e8c04f', 2.4, { flat: true }); R.add(hd, ell(5.5, -9.5, 3.4, 3.8, 12), '#e8c04f', 2.4, { flat: true }); R.add(hd, ell(-5.2, -9.5, 1, 3.2, 8), '#2a1a12', 2.5, { flat: true }); R.add(hd, ell(5.8, -9.5, 1, 3.2, 8), '#2a1a12', 2.5, { flat: true }); }
    R.draw(g);
    if (fed) { var hy = y - 6 + Math.sin(t * 2) * 2; drawIconRaw(g, 'heart', x + w - 2, hy, 16); }
  };
  NPC.gull = function (g, o, pose, t) { // чайка в гнезде на скале
    var st = o.state || {}, x = o.x, y = o.y, w = o.w, h = o.h, tq = q12(t), happy = pose === 'happy' || st.traded, R = new Rig(), dir = -1;
    var root = M(dir, 0, 0, 1, x + w / 2, y + h - 6), flap = Math.sin(tq * (happy ? 12 : 1.4)) * (happy ? 0.5 : 0.08);
    R.add(root, ell(0, -22, 26, 15, 22), '#f6f3ea', 2);
    R.add(root, [[18, -26], [36, -30], [34, -22], [20, -16]], '#f6f3ea', 1.9); // хвост
    R.add(root, [[30, -30], [38, -31], [36, -25]], '#3a3a40', 1.8);
    var wg = ro(tr(root, 4, -26), -0.15 + flap);
    R.add(wg, [[-6, 0], [26, -4], [34, 6], [10, 10]], '#a9adb3', 2.2); R.add(wg, [[24, -4], [36, -2], [34, 6]], '#3a3a40', 2.25);
    var hd = ro(tr(root, -22, -32), Math.sin(tq * 0.9) * 0.08);
    R.add(hd, ell(0, -6, 11, 10, 16), '#f6f3ea', 3);
    R.add(hd, [[-9, -6], [-24, -4], [-9, -1]], '#e8b444', 3.1); R.add(hd, ell(-19, -3, 2, 1.6, 6), C.red, 3.2, { flat: true });
    R.add(hd, ell(-4, -9, 2, 2.2, 8), '#2c1d16', 3.3, { flat: true, hl: true });
    R.draw(g);
    if (st.traded) drawIconRaw(g, 'shell', x + w * 0.78, y + h - 8, 22);
  };
  NPC.bird = function (g, o, pose, t) { // птица на столбике: цвет и высота — нота мелодии
    var st = o.state || {}, x = o.x, y = o.y, w = o.w, h = o.h, cx = x + w / 2, note = st.note || 0, col = NOTE[note % NOTE.length], sing = st.sing || 0, tq = q12(t);
    if (st.post !== false) {
      cut(g, rectP(cx - 5, y + 20, 10, h - 20), '#8a6a4c', { seed: 5700 + note, lift: 3, live: true });
      cut(g, rectP(cx - 7, y + 18, 14, 5), '#6b4e38', { seed: 5710 + note, lift: 1.5, live: true });
      for (var d = 0; d <= note; d++) cut(g, ell(cx, y + 34 + d * 11, 3, 3, 8), col, { seed: 5720 + d, lift: 0.8, live: true, raw: true });
    }
    var hop = -sing * 8 - (pose === 'happy' ? Math.abs(Math.sin(tq * 9)) * 3 : 0), by = y + 14 + hop, R = new Rig(), root = M(1, 0, 0, 1, cx, by);
    R.add(root, ell(0, 0, 11, 8.5, 16), col, 1);
    R.add(root, [[-9, -2], [-18, -6], [-16, 2]], dark(col, 0.25), 0.9);
    R.add(root, ell(-2, 1, 6, 4.5, 10), light(col, 0.45), 1.1, { lift: 0.4 });
    var hd = ro(tr(root, 8, -6), sing > 0.1 ? -0.4 : Math.sin(tq * 0.7 + note) * 0.15);
    R.add(hd, ell(0, 0, 6, 5.5, 12), col, 2);
    R.add(hd, sing > 0.1 ? [[5, -2], [12, -4], [5, 0], [12, 3], [5, 2]] : [[5, -1.5], [11, 0], [5, 1.5]], '#e8b444', 2.1);
    R.add(hd, ell(2, -1.5, 1.5, 1.6, 6), '#2c1d16', 2.2, { flat: true, hl: true });
    R.add(root, [[-3, 7], [-1, 7], [-2, 12]], '#3a2a20', 0.5, { flat: true }); R.add(root, [[2, 7], [4, 7], [3, 12]], '#3a2a20', 0.5, { flat: true });
    R.draw(g);
    if (sing > 0.1) { g.save(); g.globalAlpha = Math.min(1, sing * 1.5); drawIconRaw(g, 'note', cx + 6, by - 24 - sing * 6, 20); g.restore(); }
  };
  function npcBox(o) {
    var st = o.state || {};
    if (st.type === 'master') return [o.x - 20, o.y - 30, o.w + 60, o.h + 36];
    if (st.type === 'bird') return [o.x - 14, o.y - 50, o.w + 28, o.h + 54];
    if (st.type === 'gull') return [o.x - 20, o.y - 20, o.w + 40, o.h + 28];
    if (st.type === 'cat') return [o.x - 14, o.y - 30, o.w + 30, o.h + 34];
    if (st.type === 'dog') return [o.x - 30, o.y - 30, o.w + 60, o.h + 50];
    if (st.type === 'fisher') return [o.x - 30, o.y - 40, o.w + 60, o.h + 50];
    return [o.x - 16, o.y - 24, o.w + 32, o.h + 34];
  }
  function drawNpc(ctx, o, pose, t, cached) {
    var st = o.state || {}, f = NPC[st.type], b = npcBox(o);
    pose = st.pose || pose || 'idle';
    if (!f) { cut(ctx, rrP(o.x || 0, (o.y || 0) + (o.h || 40) * 0.3, o.w || 30, (o.h || 40) * 0.7, 8), '#cfc2a4', { live: true, seed: 6000 }); cut(ctx, ell((o.x || 0) + (o.w || 30) / 2, (o.y || 0) + (o.h || 40) * 0.2, 10, 10, 14), C.skin, { live: true, seed: 6001 }); return; }
    if (st.type !== 'bird' && st.type !== 'gull') { ctx.fillStyle = 'rgba(40,22,10,0.25)'; ctx.beginPath(); ctx.ellipse(o.x + o.w / 2, o.y + o.h, o.w * 0.45, 4.5, 0, 0, TAU); ctx.fill(); }
    var key = cached ? 'npc|' + (o.id || '') + '|' + st.type : null;
    actor(ctx, b[0], b[1], b[2], b[3], function (g) { f(g, o, pose, t || 0); }, key, key && (Math.floor((t || 0) * 12) + '|' + pose + '|' + stKey(st) + '|' + Math.round((st.sing || 0) * 8) + '|' + Math.round(b[0] * 4) + ',' + Math.round(b[1] * 4)));
  }

  // ================= живые детали (каждый кадр) =================
  var LIVE = {};
  function flamePts(x, y, s, t, k) { var a = Math.floor(t * 12) / 12, f = 1 + Math.sin(a * 13 + k) * 0.12, sw = Math.sin(a * 9 + k) * 3 * s; return [[x - 8 * s, y], [x - 6 * s, y - 10 * s], [x - 2 * s + sw * 0.5, y - 16 * s * f], [x + sw, y - 26 * s * f], [x + 4 * s + sw * 0.5, y - 14 * s * f], [x + 8 * s, y - 8 * s], [x + 7 * s, y]]; }
  function fire(ctx, x, y, s, t, k) {
    cut(ctx, flamePts(x, y, s, t, k || 0), '#e8823a', { live: true, lift: 0, raw: true });
    cut(ctx, flamePts(x, y, s * 0.62, t, (k || 0) + 2), '#f6c55a', { live: true, lift: 0, raw: true });
    cut(ctx, flamePts(x, y, s * 0.3, t, (k || 0) + 4), '#fff1c8', { live: true, lift: 0, raw: true });
  }
  LIVE.water = function (ctx, it, t, sc, P) {
    var s = sprite('waves|' + palKey(sc) + '|' + it.x + ',' + it.y + ',' + it.w + ',' + it.h, it.x - 40, it.y - 6, it.w + 80, Math.min(it.h, 220) + 12, function (g) {
      var R = rng((it.seed || 1) + 9), col = light(P.water || C.water, 0.35), n = Math.max(3, Math.round(it.w / 70));
      for (var row = 0; row < Math.min(5, Math.ceil(it.h / 45)); row++) for (var i = 0; i < n; i++) {
        var x = it.x - 30 + (i + R() * 0.6) * (it.w + 60) / n, y = it.y + 8 + row * 40 + R() * 16, w = 22 + R() * 34;
        cut(g, [[x, y], [x + w * 0.5, y - 3], [x + w, y], [x + w * 0.5, y + 2.5]], row % 2 ? col : light(col, 0.3), { seed: 1150 + row * 30 + i, lift: 1, sh: 0.2, raw: true });
      }
    });
    var dx = Math.sin(t * 0.7 + (it.seed || 0)) * 10;
    ctx.save(); ctx.beginPath(); ctx.rect(it.x, it.y - 6, it.w, it.h + 6); ctx.clip();
    ctx.translate(dx, Math.sin(t * 1.1) * 1.5); blit(ctx, s); ctx.restore();
  };
  LIVE.lamp = function (ctx, it, t, sc, P) {
    var st = it.state || {}, x = it.x, y = it.y, w = it.w, h = it.h, cx = x + w / 2, fl = 0.85 + 0.15 * Math.sin(t * 9 + 1) * Math.sin(t * 2.3);
    if (st.big) {
      if (!st.lit) return;
      addGlow(ctx, cx, y + h * 0.45, 420, GLOW, 0.42 * fl);
      fire(ctx, cx, y + h * 0.58 - 6, 1.4, t, 0);
      addGlow(ctx, cx, y + h * 0.42, 110, '255,240,200', 0.6 * fl);
      return;
    }
    if (!st.lit) return;
    if (st.small) { addGlow(ctx, cx, y + h * 0.42, 26, '255,220,120', 0.7); return; }
    if (st.hang) {
      var ly = y + h * 0.62 + h * 0.2;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      var gr = ctx.createRadialGradient(cx, ly, 4, cx, ly + 140, 340); gr.addColorStop(0, 'rgba(' + (P.glow || GLOW) + ',' + (0.22 * fl) + ')'); gr.addColorStop(1, 'rgba(' + (P.glow || GLOW) + ',0)');
      ctx.fillStyle = gr; poly(ctx, [[cx - 24, ly], [cx + 24, ly], [cx + 280, 470], [cx - 280, 470]]); ctx.fill(); ctx.restore();
      addGlow(ctx, cx, ly - 2, 60, '255,230,170', 0.45 * fl); return;
    }
    addGlow(ctx, cx, y + 28, 80, P.glow || GLOW, 0.4 * fl);
  };
  LIVE.tower = function (ctx, it, t, sc, P) {
    if (!(it.state && it.state.lit)) return;
    var x = it.x, y = it.y, w = it.w, h = it.h, cx = x + w / 2, ly = y + h * 0.2 * 0.58, a = t * 0.8, len = 1300;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    [a, a + Math.PI].forEach(function (b) {
      var ca = Math.cos(b), dx = ca * len, spread = 40 + Math.abs(ca) * 70, gr = ctx.createLinearGradient(cx, ly, cx + dx, ly);
      gr.addColorStop(0, 'rgba(255,226,150,' + (0.3 * Math.abs(ca) + 0.05) + ')'); gr.addColorStop(1, 'rgba(255,226,150,0)');
      ctx.fillStyle = gr; poly(ctx, [[cx, ly - 4], [cx + dx, ly - spread], [cx + dx, ly + spread], [cx, ly + 4]]); ctx.fill();
    });
    ctx.restore();
    addGlow(ctx, cx, ly, w * 1.6, '255,226,150', 0.6);
  };
  LIVE.house = function (ctx, it, t, sc) {
    if (sc && sc.id === 'pier') return;
    var chx = it.x + it.w * 0.74 + 11, chy = it.y - 22;
    for (var i = 0; i < 4; i++) {
      var f = ((t * 0.18 + i / 4) % 1), r = 5 + f * 14, sx = chx + Math.sin(f * 5 + i) * 5 + f * 30, sy = chy - f * 80;
      ctx.globalAlpha = (1 - f) * 0.8; var p = lump(sx, sy, r, 3000 + i, 4, 0.12);
      ctx.fillStyle = 'rgba(60,35,20,0.18)'; ctx.save(); ctx.translate(1.2, 2); poly(ctx, p); ctx.fill(); ctx.restore();
      ctx.fillStyle = '#f2ebdd'; poly(ctx, p); ctx.fill(); ctx.globalAlpha = 1;
    }
  };
  LIVE.machine = function (ctx, o, t, sc, P) {
    var st = o.state || {}, x = o.x, y = o.y, w = o.w, h = o.h, cx = x + w / 2;
    if (st.variant === 'stove' && st.fire) {
      var fy = y + h * 0.44 + h * 0.32 - 8;
      addGlow(ctx, cx, fy - 20, 230, '255,170,90', 0.4 + 0.06 * Math.sin(t * 7));
      fire(ctx, cx - 18, fy, 1.1, t, 0); fire(ctx, cx + 16, fy, 0.95, t, 3); fire(ctx, cx, fy + 2, 1.3, t, 6);
    }
    if (st.variant === 'spout' && st.drip) {
      var d = (t * 1.6) % 1, dy = y + h * 0.66 + d * (h * 0.28);
      cut(ctx, [[cx, dy - 7], [cx + 4, dy], [cx, dy + 4], [cx - 4, dy]], C.oilL, { live: true, lift: 1, raw: true });
      addGlow(ctx, cx, y + h - 20, 40, '255,180,80', 0.25);
    }
    if (st.variant === 'gauge' && st.ok) addGlow(ctx, cx, y + h * 0.6, 70, '170,230,130', 0.25 + 0.1 * Math.sin(t * 4));
    if (st.variant === 'carriage' && st.ok) addGlow(ctx, cx, y + 20, 140, GLOW, 0.2);
    LIVE.coastMachine(ctx, o, t);
  };
  LIVE.waterObj = function (ctx, o, t) {
    if (!(o.state && o.state.shell)) return;
    var k = (t * 0.8) % 1; if (k < 0.4) { var s = Math.sin(k / 0.4 * Math.PI) * 6, sx = o.x + o.w * 0.6 + 10, sy = o.y + o.h * 0.4; cut(ctx, starPts(sx, sy, s, s * 0.25, 4), '#ffffff', { live: true, lift: 0, raw: true }); }
  };

  // ================= побережье и движок глав (coast.js): прилив, карта, огни, солеварня =================
  // море с приливом: статично — мокрый песок под водой (в общем холсте слоя), живое — вода на текущем уровне (LIVE.tide)
  K.tide = function (g, it, sc, P) {
    var x = it.x, y = it.y, w = it.w, h = it.h, sand = (it.state && it.state.sand) || P.sand || '#c9ae7a', R = rng(it.seed || 3), col = P.water || C.water;
    cut(g, rectP(x - 10, y - 2, w + 20, 30), dark(col, 0.05), { seed: 6990, lift: 0, torn: true, rim: light(col, 0.5) });   // даль моря у горизонта — в отлив остаётся на месте
    var top = []; for (var xx = x - 10; xx <= x + w + 10; xx += 20) top.push([xx, y + 24 + Math.sin(xx * 0.017) * 3]);
    cut(g, top.concat([[x + w + 10, y + h + 10], [x - 10, y + h + 10]]), mix(sand, '#8f7d64', 0.25), { seed: 7000, lift: 2, sx: 0, sy: -0.4, sh: 0.2 });
    for (var r = 0; r < 4; r++) { var ry = y + 24 + r * ((h - 30) / 4), pts = []; for (var x2 = x - 10; x2 <= x + w + 10; x2 += 26) pts.push([x2, ry + Math.sin(x2 * 0.03 + r) * 3]); stitch(g, pts, rgba(light(sand, 0.4), 0.45), 1.2); }
    for (var s = 0; s < 14; s++) { var sx = x + R() * w, sy = y + 20 + R() * (h - 30); cut(g, ell(sx, sy, 3 + R() * 4, 1.6 + R() * 1.4, 10), s % 3 ? light(sand, 0.3) : '#e9e1d0', { seed: 7010 + s, lift: 0.8, raw: true, sh: 0.15 }); }
  };
  function tideLevel(it, sc) { var st = it.state || {}, low = st.low != null ? st.low : it.y + 60, m = st.at != null ? (st.at ? 1 : 0) : sc && sc.phaseMix != null ? sc.phaseMix : (sc && sc.phase && sc.phase === 'low' ? 1 : 0); m = m * m * (3 - 2 * m); return it.y + (low - it.y) * m; }
  LIVE.tide = function (ctx, it, t, sc, P) {
    var x = it.x, w = it.w, h = it.h, col = P.water || C.water, lvl = tideLevel(it, sc), d = lvl - it.y;
    var s = sprite('tidebody|' + palKey(sc) + '|' + x + ',' + w + ',' + h, x - 20, -14, w + 40, h + 30, function (g) {
      var top = []; for (var xx = x - 14; xx <= x + w + 14; xx += 16) top.push([xx, Math.sin(xx * 0.03 + (it.seed || 0)) * 2.5]);
      cut(g, top.concat([[x + w + 14, h + 12], [x - 14, h + 12]]), col, { seed: 7100, lift: 3, sx: 0, sy: -0.5, torn: true, rim: light(col, 0.55) });
      var b2 = []; for (var x2 = x - 14; x2 <= x + w + 14; x2 += 24) b2.push([x2, h * 0.4 + Math.sin(x2 * 0.02) * 4]);
      cut(g, b2.concat([[x + w + 14, h + 12], [x - 14, h + 12]]), dark(col, 0.14), { seed: 7101, lift: 2, sx: 0, sy: -0.5, torn: true, rim: light(col, 0.3), tornAmp: 1.4 });
      var R = rng(7102), wc = light(col, 0.4);
      for (var row = 0; row < 3; row++) for (var i = 0; i < Math.round(w / 80); i++) { var wx = x + (i + R() * 0.7) * 80, wy = 14 + row * 30 + R() * 10, ww = 20 + R() * 30; cut(g, [[wx, wy], [wx + ww * 0.5, wy - 3], [wx + ww, wy], [wx + ww * 0.5, wy + 2.5]], wc, { seed: 7110 + row * 40 + i, lift: 1, sh: 0.2, raw: true }); }
    });
    if (d > 2) { var wg = ctx.createLinearGradient(0, it.y, 0, lvl); wg.addColorStop(0, 'rgba(70,60,40,0)'); wg.addColorStop(1, 'rgba(70,60,40,0.14)'); ctx.fillStyle = wg; ctx.fillRect(x, it.y + 4, w, d); }   // мокрая полоса, откуда ушла вода
    ctx.save(); ctx.beginPath(); ctx.rect(x - 20, it.y - 14, w + 40, h + 40); ctx.clip();
    ctx.translate(Math.sin(t * 0.6 + (it.seed || 0)) * 6, lvl + Math.sin(t * 1.2) * 1.5); blit(ctx, s); ctx.restore();
    var foam = []; for (var fx = x; fx <= x + w; fx += 14) foam.push([fx, lvl + 1 + Math.sin(fx * 0.05 + t * 1.6) * 2.2]);
    strokeL(ctx, foam, 'rgba(250,248,240,0.75)', 2.4);
  };
  // лист карты побережья: море, суша (многоугольник), береговая штриховка, роза ветров, края листа на скотче
  K.mapsheet = function (g, it) {
    var st = it.state || {}, sea = '#a9c5c2', land = '#e2cc98', R = rng(it.seed || 1);
    cut(g, rectP(-10, -10, W + 20, H + 20), '#6f5a44', { seed: 7200, lift: 0, tex: false });
    cut(g, rectP(14, 12, W - 28, H - 24), sea, { seed: 7201, lift: 4, sh: 0.4, torn: true, rim: '#f3ead6' });
    for (var i = 0; i < 26; i++) { var wx = 40 + R() * (W - 80), wy = 30 + R() * (H - 60), ww = 14 + R() * 18; strokeL(g, [[wx, wy], [wx + ww * 0.5, wy - 3], [wx + ww, wy]], 'rgba(70,110,112,0.45)', 1.6); }
    if (st.coast && st.coast.length > 2) {
      var cst = st.coast.map(function (q) { return [clamp(q[0], 16, W - 16), clamp(q[1], 14, H - 14)]; });
      cut(g, cst, dark(sea, 0.12), { seed: 7202, lift: 0, amp: 2.2, step: 12 });
      cut(g, movP(cst, 0, -3), land, { seed: 7203, lift: 3, sh: 0.3, amp: 2.4, step: 12, torn: true, rim: '#fbf3df' });
      for (var k = 0; k < 40; k++) { var hx = 40 + R() * (W - 80), hy = 30 + R() * (H - 60); if (inPoly(cst, hx, hy)) strokeL(g, [[hx, hy], [hx + 6, hy - 3]], 'rgba(120,96,60,0.35)', 1.3); }
    }
    var cx = W - 80, cy = H - 84; // роза ветров
    cut(g, ell(cx, cy, 32, 32, 30), '#f3ead6', { seed: 7204, lift: 2 });
    cut(g, [[cx, cy - 30], [cx + 6, cy], [cx, cy + 30], [cx - 6, cy]], C.rust, { seed: 7205, lift: 1, raw: true });
    cut(g, [[cx - 30, cy], [cx, cy - 6], [cx + 30, cy], [cx, cy + 6]], C.brown, { seed: 7206, lift: 1, raw: true });
    tape(g, 60, 18, 70, 18, -0.08, 7207); tape(g, W - 60, 18, 70, 18, 0.07, 7208); tape(g, 60, H - 18, 70, 18, 0.06, 7209);
  };
  function inPoly(p, x, y) { var c = false; for (var i = 0, j = p.length - 1; i < p.length; j = i++) { if (((p[i][1] > y) !== (p[j][1] > y)) && (x < (p[j][0] - p[i][0]) * (y - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0])) c = !c; } return c; }
  K.trail = function (g, it) {
    var st = it.state || {}, pts = st.pts || [[it.x, it.y], [it.x + it.w, it.y + it.h]], open = !!st.open, n = 0;
    var dense = []; for (var i = 0; i < pts.length - 1; i++) { var a = pts[i], b = pts[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), m = Math.max(1, Math.round(L / 9)); for (var j = 0; j < m; j++) dense.push([a[0] + (b[0] - a[0]) * j / m, a[1] + (b[1] - a[1]) * j / m]); }
    dense.push(pts[pts.length - 1]);
    dense.forEach(function (q, k) { if (k % 2) return; n++; var nx = dense[Math.min(dense.length - 1, k + 1)]; if (open) cut(g, band([q, nx], 5), '#7a4e30', { seed: 7300 + n, lift: 1.2, raw: true, sh: 0.3 }); else { g.fillStyle = 'rgba(90,80,70,0.35)'; g.beginPath(); g.arc(q[0], q[1], 2, 0, TAU); g.fill(); } });
    if (!open) for (var f = 0; f < pts.length; f++) { var p = pts[f]; cut(g, lump(p[0], p[1], 18, 7310 + f, 4, 0.2), 'rgba(238,240,236,0.8)', { seed: 7320 + f, lift: 0, tex: false }); }
  };
  K.mapnode = function (g, it) {
    var st = it.state || {}, cx = it.x + it.w / 2, cy = it.y + it.h / 2, open = !!st.open;
    cut(g, ell(cx, cy, 27, 27, 30), open ? '#f3ead6' : '#c9c3b6', { seed: 7400 + (it.seed || 0), lift: 3.5, sh: 0.4 });
    cut(g, ell(cx, cy, 22, 22, 28), open ? (st.lit ? '#f6dc8a' : '#e9dcc0') : '#b5afa2', { seed: 7401 + (it.seed || 0), lift: 1 });
    drawIconRaw(g, open ? (st.icon || 'question') : 'question', cx, cy, 30);
    if (st.lit) { cut(g, flamePts(cx + 20, cy - 16, 0.55, 0, it.seed || 0), '#e8823a', { lift: 1, raw: true }); cut(g, flamePts(cx + 20, cy - 16, 0.3, 0, (it.seed || 0) + 2), '#fff1c8', { lift: 0, raw: true }); }
    if (st.here) stitch(g, ell(cx, cy, 33, 33, 30).concat([[cx + 33, cy]]), '#b3533a', 2);
  };
  LIVE.mapnode = function (ctx, it, t) { var st = it.state || {}; if (st.lit) addGlow(ctx, it.x + it.w / 2 + 20, it.y + it.h / 2 - 22, 36, '255,200,110', 0.45 + 0.1 * Math.sin(t * 6 + (it.seed || 0))); };
  function tokenDraw(ctx, o, t) {   // фишка героини: маленькая вырезка на бумажном кружке (движется — без кэша по позиции)
    var cx = o.x + o.w / 2, by = o.y + o.h, dir = (o.state && o.state.dir) || 1, k = 0.36;
    ctx.fillStyle = 'rgba(40,22,10,0.3)'; ctx.beginPath(); ctx.ellipse(cx + 2, by + 3, 15, 5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#f3ead6'; ctx.beginPath(); ctx.ellipse(cx, by, 13, 4.5, 0, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(cx, by); ctx.scale(k, k); drawHero(ctx, { x: 0, y: 0, dir: dir }, 'idle', t); ctx.restore();
  }
  // сигнальные огни: очаг на камнях, корзина на трубе, жаровня (огонь — LIVE)
  K.beacon = function (g, it, sc, P) {
    var st = it.state || {}, x = it.x, y = it.y, w = it.w, h = it.h, cx = x + w / 2, v = st.variant || 'hearth';
    if (v === 'chimney') {
      cut(g, [[cx - w * 0.3, y + h], [cx - w * 0.22, y + 26], [cx + w * 0.22, y + 26], [cx + w * 0.3, y + h]], '#a2533a', { seed: 7500, lift: 4, sh: 0.35 });
      for (var b = 0; b < 8; b++) { var by = y + 40 + b * (h - 50) / 8; strokeL(g, [[cx - w * 0.28 + b * 0.4, by], [cx + w * 0.28 - b * 0.4, by]], 'rgba(60,30,20,0.35)', 1.2); }
      cut(g, rectP(cx - w * 0.34, y + 18, w * 0.68, 10), C.iron, { seed: 7501, lift: 2 });
      cut(g, [[cx - w * 0.3, y + 18], [cx - w * 0.36, y], [cx + w * 0.36, y], [cx + w * 0.3, y + 18]], C.ironL, { seed: 7502, lift: 2 });
      if (st.fuel || st.lit) cut(g, ell(cx, y + 2, w * 0.3, 6, 16), '#5a3a22', { seed: 7503, lift: 1 });
      return;
    }
    if (v === 'brazier') {
      [[-0.32, 0.4], [0.32, -0.4], [0, 0]].forEach(function (l, i) { cut(g, band([[cx + l[0] * w * 0.4, y + h * 0.45], [cx + l[0] * w, y + h]], 6), C.iron, { seed: 7510 + i, lift: 2, raw: true }); });
      cut(g, [[x, y + h * 0.3], [x + w, y + h * 0.3], [x + w * 0.82, y + h * 0.52], [x + w * 0.18, y + h * 0.52]], C.iron, { seed: 7514, lift: 3.5, sh: 0.4 });
      cut(g, rectP(x - 3, y + h * 0.27, w + 6, 7), C.ironL, { seed: 7515, lift: 1.5 });
      if (st.fuel || st.lit) for (var f = 0; f < 4; f++) cut(g, band([[x + w * (0.2 + f * 0.18), y + h * 0.3], [x + w * (0.3 + f * 0.14), y + h * 0.18]], 5), '#9a8a4a', { seed: 7516 + f, lift: 1, raw: true });
      else ghostIcon(g, 'seaweed_dry', cx, y + h * 0.15, 30);
      return;
    }
    // очаг: кольцо камней, поленья
    for (var s = 0; s < 7; s++) { var a = Math.PI + s / 6 * Math.PI, rx = cx + Math.cos(a) * w * 0.42, ry = y + h - 10 + Math.sin(a) * -8; cut(g, lump(rx, ry, 11, 7520 + s, 3, 0.2), s % 2 ? C.stone : C.stoneD, { seed: 7520 + s, lift: 2.5 }); }
    if (st.fuel || st.lit) { cut(g, band([[cx - 22, y + h - 6], [cx + 18, y + h - 22]], 9), '#b9a27e', { seed: 7530, lift: 2, raw: true }); cut(g, band([[cx + 22, y + h - 6], [cx - 16, y + h - 24]], 9), '#a58f6c', { seed: 7531, lift: 2, raw: true }); }
    else ghostIcon(g, 'driftwood', cx, y + h - 26, 30);
  };
  LIVE.beacon = function (ctx, it, t) {
    var st = it.state || {}; if (!st.lit) return;
    var cx = it.x + it.w / 2, v = st.variant || 'hearth', fy = v === 'chimney' ? it.y + 2 : v === 'brazier' ? it.y + it.h * 0.3 : it.y + it.h - 14, s = v === 'chimney' ? 1.0 : v === 'brazier' ? 1.1 : 1.3;
    addGlow(ctx, cx, fy - 20, v === 'chimney' ? 160 : 200, '255,170,90', 0.42 + 0.06 * Math.sin(t * 7));
    fire(ctx, cx - 10, fy, s * 0.85, t, 0); fire(ctx, cx + 10, fy, s * 0.8, t, 3); fire(ctx, cx, fy + 1, s, t, 6);
  };
  // солеварня: отстойный бассейн и црен на печи
  K.saltpan = function (g, it, sc, P) {
    var st = it.state || {}, x = it.x, y = it.y, w = it.w, h = it.h;
    if (st.variant === 'boil') {
      cut(g, rectP(x + 8, y + h * 0.45, w - 16, h * 0.55), '#8e4a32', { seed: 7600, lift: 4 });
      for (var b = 0; b < 3; b++) strokeL(g, [[x + 10, y + h * (0.6 + b * 0.13)], [x + w - 10, y + h * (0.6 + b * 0.13)]], 'rgba(50,25,15,0.35)', 1.2);
      cut(g, [[x, y], [x + w, y], [x + w - 8, y + h * 0.45], [x + 8, y + h * 0.45]], C.iron, { seed: 7601, lift: 3, sh: 0.4 });
      cut(g, rectP(x - 4, y - 4, w + 8, 7), C.ironL, { seed: 7602, lift: 1.5 });
      if (st.brine) cut(g, rectP(x + 6, y + 2, w - 12, 8), '#8fb0b4', { seed: 7603, lift: 0.5, raw: true });
      if (st.salt) for (var c = 0; c < 7; c++) cut(g, [[x + 12 + c * (w - 24) / 7, y + 6], [x + 18 + c * (w - 24) / 7, y - 8 - (c % 3) * 3], [x + 26 + c * (w - 24) / 7, y + 6]], '#f6f4ee', { seed: 7604 + c, lift: 1, raw: true });
      return;
    }
    cut(g, rectP(x - 6, y - 4, w + 12, h + 8), '#8b6a4c', { seed: 7610, lift: 3 });
    cut(g, rectP(x, y, w, h), st.brine ? '#86a8ac' : '#b7a684', { seed: 7611, lift: 0.5 });
    if (st.brine) for (var r = 0; r < 3; r++) strokeL(g, [[x + 10 + r * 20, y + h * 0.4 + r * 4], [x + 40 + r * 22, y + h * 0.4 + r * 4]], 'rgba(240,248,250,0.6)', 1.6);
    else for (var q = 0; q < 5; q++) strokeL(g, [[x + 8 + q * w / 5, y + h * 0.3], [x + 20 + q * w / 5, y + h * 0.7]], 'rgba(90,70,40,0.4)', 1.2);
  };
  LIVE.saltpan = function (ctx, it, t) {
    var st = it.state || {}; if (st.variant !== 'boil' || !st.boil) return;
    for (var i = 0; i < 4; i++) { var f = ((t * 0.3 + i / 4) % 1), sx = it.x + it.w * (0.2 + i * 0.2) + Math.sin(f * 6 + i) * 6, sy = it.y - f * 70; ctx.globalAlpha = (1 - f) * 0.7; ctx.fillStyle = '#f4f2ec'; poly(ctx, lump(sx, sy, 6 + f * 12, 7620 + i, 4, 0.15)); ctx.fill(); ctx.globalAlpha = 1; }
  };
  K.sluice = function (g, it, sc, P) {
    var st = it.state || {}, x = it.x, y = it.y, w = it.w, h = it.h, up = st.open ? h * 0.55 : 0;
    cut(g, rectP(x, y, 12, h), '#5b4636', { seed: 7700, lift: 3 }); cut(g, rectP(x + w - 12, y, 12, h), '#5b4636', { seed: 7701, lift: 3 });
    cut(g, rectP(x - 4, y - 8, w + 8, 12), '#6b5240', { seed: 7702, lift: 3 });
    if (st.flow) for (var f = 0; f < 4; f++) cut(g, rectP(x + 14 + f * (w - 28) / 4, y + h - up * 0.3 - 8, (w - 28) / 4 - 4, 10 + up * 0.3), '#8fb0b4', { seed: 7703 + f, lift: 0.5, raw: true });
    cut(g, rectP(x + 12, y + 8 - up, w - 24, h - 14), '#9a7a58', { seed: 7710, lift: 2.5 });
    for (var p = 1; p < 4; p++) strokeL(g, [[x + 12, y + 8 - up + p * (h - 14) / 4], [x + w - 12, y + 8 - up + p * (h - 14) / 4]], 'rgba(60,40,25,0.4)', 1.2);
    cut(g, rectP(x + w / 2 - 3, y - 40 - up, 6, 48), C.iron, { seed: 7711, lift: 1.5, raw: true });
  };
  K.boat = function (g, it) {
    var st = it.state || {}, x = it.x, y = it.y, w = it.w, h = it.h, a = st.afloat ? 0 : -0.07;
    var hull = rotP([[x, y + h * 0.35], [x + w, y + h * 0.2], [x + w * 0.86, y + h], [x + w * 0.12, y + h]], x + w / 2, y + h, a);
    cut(g, hull, '#4f7472', { seed: 7800, lift: 3.5, sh: 0.4 });
    cut(g, rotP(rectP(x + 2, y + h * 0.3, w - 4, 6), x + w / 2, y + h, a), '#c49a64', { seed: 7801, lift: 1 });
    cut(g, rotP(rectP(x + w * 0.2, y + h * 0.55, w * 0.62, 5), x + w / 2, y + h, a), '#efe5cc', { seed: 7802, lift: 0.6 });
  };
  K.tidepost = function (g, it) {
    var st = it.state || {}, x = it.x, y = it.y, w = it.w, h = it.h, cx = x + w / 2;
    cut(g, rectP(cx - 5, y + 10, 10, h - 10), '#efe5cc', { seed: 7900, lift: 3 });
    for (var i = 0; i < 5; i++) cut(g, rectP(cx - 5, y + 20 + i * (h - 30) / 5, 10, (h - 30) / 10), i % 2 ? C.rust : C.teal, { seed: 7901 + i, lift: 0.5, raw: true });
    cut(g, [[cx + 5, y + 10], [cx + 30, y + 18], [cx + 5, y + 28]], C.mustard, { seed: 7910, lift: 2 });
    drawIconRaw(g, st.low ? 'low' : 'high', cx + 15, y + 19, 14);
  };
  // часовой привод, шестерня (механизм gears), зеркало-отражатель
  function coastMachine(g, it, st, x, y, w, h, cx) {
    if (st.variant === 'clockwork') {
      cut(g, rrP(x, y, w, h * 0.55, 8), '#6b4e38', { seed: 8000, lift: 4 });
      cut(g, ell(cx, y + h * 0.27, w * 0.32, w * 0.32, 26), C.brass, { seed: 8001, lift: 2 });
      for (var k = 0; k < 6; k++) { var a = k * TAU / 6; strokeL(g, [[cx, y + h * 0.27], [cx + Math.cos(a) * w * 0.28, y + h * 0.27 + Math.sin(a) * w * 0.28]], '#8e6e2a', 2); }
      var ch = []; for (var c = 0; c < 14; c++) ch.push([cx + w * 0.32 + Math.sin(c) * 1.5, y + h * 0.3 + c * h * 0.045]);
      stitch(g, ch, '#3a3430', 2.4);
      var wy = y + h * 0.3 + 13 * h * 0.045;
      if (st.weight) cut(g, [[cx + w * 0.32 - 10, wy], [cx + w * 0.32 + 10, wy], [cx + w * 0.32 + 15, wy + 30], [cx + w * 0.32 - 15, wy + 30]], C.brass, { seed: 8002, lift: 2.5 });
      else ghostIcon(g, 'weight', cx + w * 0.32, wy + 16, 30);
      return true;
    }
    if (st.variant === 'gear') {
      var r = Math.min(w, h) * 0.42, gy = y + h / 2, rot = (st.rot || 0) * TAU;
      cut(g, gearPtsP(cx, gy, r, 12, rot), st.solved ? C.brass : '#b49a6a', { seed: 8010 + (it.seed || 0), lift: 3.5, sh: 0.4 });
      cut(g, ell(cx, gy, r * 0.55, r * 0.55, 22), dark('#b49a6a', 0.15), { seed: 8011, lift: 1 });
      cut(g, band([[cx, gy], [cx + Math.sin(rot) * r * 0.82, gy - Math.cos(rot) * r * 0.82]], 6), st.ok ? C.green : C.red, { seed: 8012, lift: 1, raw: true });
      brad(g, cx, gy, 4);
      var ma = (st.mark || 0) * TAU, pr = r + 12, px = cx + Math.sin(ma) * pr, py = gy - Math.cos(ma) * pr;   // указатель снаружи: метка шестерни должна смотреть на него
      cut(g, rotP([[px - 8, py - 7], [px + 8, py - 7], [px, py + 5]], px, py, ma), st.ok ? C.green : C.ink, { seed: 8013, lift: 1.5, raw: true });
      return true;
    }
    if (st.variant === 'reflector') {
      var rr = Math.min(w, h * 0.8) * 0.46, ry = y + rr + 6, tilt = st.aim ? -0.25 : 0.3;
      cut(g, band([[cx - rr * 0.9, y + h], [cx, ry + rr * 0.6], [cx + rr * 0.9, y + h]], 8), C.iron, { seed: 8020, lift: 2.5, raw: true });
      cut(g, rotP(ell(cx, ry, rr, rr, 34), cx, ry, tilt), C.iron, { seed: 8021, lift: 4, sh: 0.4 });
      cut(g, rotP(ell(cx, ry, rr * 0.86, rr * 0.86, 32), cx, ry, tilt), st.shiny ? '#eef3f6' : '#8f9a86', { seed: 8022, lift: 0.5 });
      if (st.shiny) cut(g, rotP([[cx - rr * 0.5, ry - rr * 0.3], [cx - rr * 0.2, ry - rr * 0.6], [cx - rr * 0.1, ry - rr * 0.45], [cx - rr * 0.38, ry - rr * 0.16]], cx, ry, tilt), '#ffffff', { seed: 8023, lift: 0, raw: true });
      else for (var sp = 0; sp < 6; sp++) cut(g, ell(cx + Math.cos(sp * 2.1) * rr * 0.5, ry + Math.sin(sp * 1.7) * rr * 0.5, 5 + sp % 3 * 3, 4 + sp % 2 * 3, 10), '#6f7a64', { seed: 8024 + sp, lift: 0, raw: true });
      return true;
    }
    return false;
  }
  LIVE.coastMachine = function (ctx, o, t) {
    var st = o.state || {};
    if (st.variant === 'reflector' && st.lit) {   // зеркало собирает рассвет в луч на жаровню
      var mx = o.x + o.w / 2, my = o.y + o.h * 0.38, fl = 0.8 + 0.2 * Math.sin(t * 3);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; var bg = ctx.createLinearGradient(mx, my, mx - 160, my + 120); bg.addColorStop(0, 'rgba(255,230,160,' + (0.35 * fl) + ')'); bg.addColorStop(1, 'rgba(255,200,120,0.05)');
      ctx.fillStyle = bg; poly(ctx, [[mx - 20, my - 30], [mx - 150, my + 100], [mx - 175, my + 125], [mx + 10, my + 20]]); ctx.fill(); ctx.restore();
      addGlow(ctx, mx, my, 240, '255,226,150', 0.5 * fl);
    }
    if (st.variant === 'gear' && st.solved) addGlow(ctx, o.x + o.w / 2, o.y + o.h / 2, o.w * 0.8, '190,230,140', 0.18);
  };
  // вешала для сушки (fence state.rack): шесты и верёвка, что висит — state.weed
  function rackDraw(g, it) {
    var st = it.state || {}, x = it.x, y = it.y, w = it.w, h = it.h;
    cut(g, rectP(x, y, 8, h), C.brown, { seed: 8100, lift: 3 }); cut(g, rectP(x + w - 8, y, 8, h), C.brown, { seed: 8101, lift: 3 });
    var rope = []; for (var i = 0; i <= 10; i++) rope.push([x + 4 + (w - 8) * i / 10, y + 8 + Math.sin(i / 10 * Math.PI) * 8]);
    strokeL(g, rope, '#d9c18e', 2.2);
    if (st.weed) for (var k = 0; k < 6; k++) { var p = rope[1 + k + (k > 3 ? 1 : 0)], col = st.weed === 'dry' ? '#9a8a4a' : '#4f6b3a'; cut(g, [[p[0] - 5, p[1]], [p[0] + 5, p[1]], [p[0] + 3 + Math.sin(k) * 3, p[1] + h * 0.45], [p[0] - 4, p[1] + h * 0.4]], col, { seed: 8110 + k, lift: 1.5 }); }
    else ghostIcon(g, 'seaweed', x + w / 2, y + h * 0.4, 30);
    for (var n = 0; n < 3; n++) cut(g, rectP(x + 14 + n * (w - 28) / 3, y + h * 0.75, (w - 28) / 3 - 6, h * 0.25), '#c49a64', { seed: 8120 + n, lift: 2 });   // ящики под вешалами
  }
  // персонажи побережья
  NPC.fisher = function (g, o, pose, t) { // рыбачка у бочки: синий платок, полосатая кофта, фартук; рада — машет руками
    var st = o.state || {}, x = o.x, y = o.y, w = o.w, h = o.h, cx = x + w / 2, by = y + h, tq = q12(t), happy = pose === 'happy' || st.happy, R = new Rig();
    var root = M(1, 0, 0, 1, cx, by - 4 + (happy ? -Math.abs(Math.sin(tq * 7)) * 3 : 0));
    R.add(root, [[-20, -70], [20, -70], [26, 0], [-26, 0]], '#4f6f8f', 2);
    for (var s = 0; s < 4; s++) R.add(root, [[-21 + s, -64 + s * 12], [21 - s, -64 + s * 12], [21, -59 + s * 12], [-21, -59 + s * 12]], '#e9e2d2', 2.1, { lift: 0.3 });
    R.add(root, [[-15, -46], [15, -46], [18, 0], [-18, 0]], '#c49a64', 2.3);
    var hd = ro(tr(root, 0, -74), Math.sin(tq * 1.1) * 0.05);
    R.add(hd, ell(0, -12, 12, 13, 20), C.skin, 3);
    R.add(hd, [[-15, -10], [-12, -26], [0, -30], [12, -26], [15, -10], [9, -18], [-9, -18]], '#3b5f7f', 3.1);
    R.add(hd, [[10, -4], [20, 4], [12, 6]], '#3b5f7f', 3.05);
    var closed = happy || (t % 4.2) < 0.12;
    if (closed) { R.add(hd, [[-7, -12], [-2, -12], [-2, -11], [-7, -11]], '#2c1d16', 3.3, { flat: true }); R.add(hd, [[2, -12], [7, -12], [7, -11], [2, -11]], '#2c1d16', 3.3, { flat: true }); }
    else { R.add(hd, ell(-4.5, -12, 1.6, 2, 8), '#2c1d16', 3.3, { flat: true, hl: true }); R.add(hd, ell(4.5, -12, 1.6, 2, 8), '#2c1d16', 3.3, { flat: true, hl: true }); }
    R.add(hd, ell(0, -4, happy ? 4 : 2.6, happy ? 2.6 : 1.2, 8, 0, Math.PI), '#7a2e22', 3.3, { flat: true });
    [[-18, happy ? -2.5 : 0.5], [18, happy ? 2.5 : -0.7]].forEach(function (a) { var u = ro(tr(root, a[0], -62), a[1]); R.add(u, [[-5, 0], [5, 0], [4, 28], [-4, 28]], '#4f6f8f', 4); R.add(u, ell(0, 30, 4.5, 4.5, 10), C.skin, 4.1); R.pins.push(pin(u, 0, 0)); });
    R.draw(g);
  };
  NPC.dog = function (g, o, pose, t) { // пёс Вьюн: лохматый, песочно-серый, тёмное ухо, белая грудь, красный платок на шее
    var st = o.state || {}, x = o.x, y = o.y, w = o.w, h = o.h, tq = q12(t), R = new Rig(), sleep = pose === 'sleep' || st.pose === 'sleep', happy = pose === 'happy';
    var dir = st.dir || 1, k = w / 90, root = M(dir * k, 0, 0, k, x + w / 2, y + h - (st.hide ? -18 : 0)), wag = Math.sin(tq * (happy ? 16 : 4)) * (sleep ? 0.05 : 0.5);
    var fur = '#c8b996', furD = '#a8977a', tail = ro(tr(root, -32, -36), -0.6 + wag);
    R.add(tail, [[-3, 0], [3, 0], [8, -24], [0, -30], [-6, -22]], furD, 0.5);
    if (sleep) {   // свернулся калачиком: спина горкой, голова на лапах, хвост укрывает нос; дышит
      var br = Math.sin(t * 1.6) * 1.2;
      R.add(root, [[-38, 0], [-40, -14], [-30, -30 - br], [-6, -38 - br], [18, -32 - br], [32, -16], [34, 0]], fur, 1);
      R.add(root, [[-24, -26 - br], [-4, -33 - br], [10, -30 - br], [-8, -22]], furD, 1.1, { lift: 0.4 });
      R.add(root, [[10, -2], [40, -4], [44, 2], [12, 4]], '#f1ead8', 1.3);   // лапы
      var sh = ro(tr(root, 30, -12), 0.15); R.add(sh, ell(0, 0, 15, 12, 18), fur, 2); R.add(sh, [[8, -2], [22, 2], [20, 8], [6, 7]], '#e9e2d2', 2.05);
      R.add(sh, [[-12, -8], [-20, 8], [-6, 2]], '#5d4a3c', 2.1); R.add(sh, [[0, -3], [8, -3], [8, -2], [0, -2]], '#2c1d16', 2.2, { flat: true }); R.add(sh, ell(21, 2, 3, 2.4, 8), '#2c1d16', 2.2, { flat: true });
      R.add(root, [[-36, -2], [-20, 6], [8, 8], [24, 4], [24, 8], [6, 12], [-22, 10], [-40, 2]], furD, 2.4);   // хвост вокруг
      R.add(root, [[16, -46], [28, -50], [26, -42], [18, -40]], C.red, 0.5);
      R.draw(g); return;
    }
    var bob = happy ? -Math.abs(Math.sin(tq * 8)) * 5 : Math.sin(tq * 1.5) * 0.8, body = tr(root, 0, bob);
    [[-24, 0], [-14, 0], [16, 0], [26, 0]].forEach(function (l, i) { R.add(body, [[l[0] - 4, -30], [l[0] + 4, -30], [l[0] + 4, 0], [l[0] - 4, 0]], i % 2 ? furD : fur, 0.8); R.add(body, ell(l[0] + 1, -1, 5.5, 3, 8), '#f1ead8', 0.9); });
    R.add(body, ell(0, -40, 34, 17, 24), fur, 1); R.add(body, ell(14, -38, 14, 12, 16), '#f1ead8', 1.2, { lift: 0.4 });
    R.add(body, [[18, -54], [30, -52], [28, -44], [20, -46]], C.red, 1.4);
    var hd = ro(tr(body, 30, -56), happy ? -0.2 + Math.sin(tq * 8) * 0.06 : Math.sin(tq * 0.7) * 0.06);
    R.add(hd, ell(0, -6, 15, 13, 20), fur, 2); R.add(hd, [[6, -6], [24, -2], [24, 6], [8, 6]], '#e9e2d2', 2.1);
    R.add(hd, ell(23, -1, 3.6, 3, 8), '#2c1d16', 2.3, { flat: true });
    R.add(hd, [[-10, -16], [-18, 2], [-6, -4]], '#5d4a3c', 2.2); R.add(hd, [[4, -18], [10, -28], [12, -14]], furD, 1.9);
    if (happy) R.add(hd, [[12, 6], [18, 6], [16, 14], [13, 14]], '#d9807a', 2.25, { flat: true });
    R.add(hd, ell(6, -8, 2.2, 2.4, 8), '#2c1d16', 2.4, { flat: true, hl: true });
    R.draw(g);
  };
  NPC.crab = function (g, o, pose, t) { // краб в луже; в жестянке — торчат клешни и ножки
    var st = o.state || {}, x = o.x, y = o.y, w = o.w, h = o.h, cx = x + w / 2, by = y + h, tq = q12(t), R = new Rig(), sn = Math.sin(tq * 5) * 0.25;
    var root = M(w / 44, 0, 0, h / 30, cx, by);
    [-1, 1].forEach(function (d) { for (var l = 0; l < 3; l++) { var lg = ro(tr(root, d * (8 + l * 4), -6), d * (0.9 + l * 0.25) + sn * 0.3); R.add(lg, [[-1.5, 0], [1.5, 0], [1, 12], [-1, 12]], '#a83a26', 0.5); } });
    [-1, 1].forEach(function (d) { var cl = ro(tr(root, d * 14, -12), d * (-0.6 + sn)); R.add(cl, [[-2, 0], [2, 0], [2, -8], [-2, -8]], '#c0442e', 1.5); R.add(cl, [[-6, -8], [6, -8], [5, -16], [0, -13], [-5, -17]], '#c0442e', 1.6); });
    if (st.tin) { R.add(root, [[-14, -4], [14, -4], [14, -24], [-14, -24]], '#b9b6ae', 2); R.add(root, [[-14, -20], [14, -20], [14, -18], [-14, -18]], '#8c8a84', 2.1, { flat: true }); }
    else { R.add(root, ell(0, -10, 14, 9, 18), '#c0442e', 2); R.add(root, ell(-5, -18, 2, 2, 6), '#2c1d16', 2.2, { flat: true, hl: true }); R.add(root, ell(5, -18, 2, 2, 6), '#2c1d16', 2.2, { flat: true, hl: true }); }
    R.draw(g);
  };

  function itemDraw(ctx, o, t, hov) {
    var cx = o.x + o.w / 2, cy = o.y + o.h / 2, id = o.item || 'question';
    if (id === 'boat') { // лодка из тумана: корпус, парус, огонёк на мачте
      var bw = Math.max(o.w, o.h * 1.6), bob = Math.sin(t * 1.4 + o.x) * 2.5, by = cy + bob;
      var b = sprite('boat|' + Math.round(bw), -bw * 0.7, -bw * 0.9, bw * 1.4, bw * 1.2, function (g) {
        cut(g, [[-bw / 2, 0], [bw / 2, 0], [bw * 0.36, bw * 0.2], [-bw * 0.36, bw * 0.2]], '#8a5a3a', { seed: 6100, lift: 2.5 });
        cut(g, rectP(-bw / 2, -2, bw, 5), '#c49a64', { seed: 6101, lift: 1 });
        cut(g, rectP(-1.5, -bw * 0.75, 3, bw * 0.75), C.dbrown, { seed: 6102, lift: 1.5, raw: true });
        cut(g, [[2, -bw * 0.72], [bw * 0.38, -bw * 0.08], [2, -bw * 0.08]], '#efe5cc', { seed: 6103, lift: 2 });
        cut(g, [[-3, -bw * 0.6], [-bw * 0.26, -bw * 0.1], [-3, -bw * 0.1]], '#e2c58e', { seed: 6104, lift: 2 });
      });
      ctx.save(); ctx.translate(cx, by); ctx.rotate(Math.sin(t * 1.1 + o.x) * 0.04); blit(ctx, b); ctx.restore();
      addGlow(ctx, cx, by - bw * 0.78, 26, '255,210,120', 0.7); cut(ctx, ell(cx, by - bw * 0.78, 2.5, 2.5, 8), '#fff1c0', { live: true, lift: 0, raw: true });
      return;
    }
    if (id === 'firefly') { var p = 0.7 + 0.3 * Math.sin(t * 8 + o.x); addGlow(ctx, cx, cy, 46, '255,230,120', 0.6 * p); drawIcon(ctx, 'firefly', cx, cy, Math.min(o.w, o.h) * 0.9); return; }
    var size = Math.max(o.w, o.h) * 1.1, bob = Math.sin(t * 2 + o.x * 0.1) * 1.5, s = iconSprite(id, size);
    ctx.fillStyle = 'rgba(40,22,10,0.25)'; ctx.beginPath(); ctx.ellipse(cx + 2, o.y + o.h + 1, size * 0.4, 3.5, 0, 0, TAU); ctx.fill();
    var hl = halo(s, hov ? 4 : 2.5, hov ? 'rgba(255,236,170,0.95)' : 'rgba(255,248,232,0.95)');
    if (hl) ctx.drawImage(hl.c, cx + hl.x, cy + bob + hl.y, hl.w, hl.h);
    drawIcon(ctx, id, cx, cy + bob, size);
    var k = (t * 0.6 + o.x * 0.01) % 1;
    if (k < 0.3) { var sc2 = Math.sin(k / 0.3 * Math.PI) * 7, sx = cx + size * 0.38, sy = cy - size * 0.38; cut(ctx, starPts(sx, sy, sc2, sc2 * 0.25, 4), '#fff8dc', { live: true, lift: 0, raw: true }); }
  }

  // ================= сборка сцены =================
  var ANIM_BREAK = { cloud: 1, water: 1, tide: 1 };
  function isLiveLayer(it) { var s = it.state || {}; return ANIM_BREAK[it.kind] || (it.kind === 'lamp' && s.lit) || (it.kind === 'tower' && s.lit) || (it.kind === 'house'); }
  var PAD = { sky: 0, ground: 30, wall: 0, floor: 30, house: 40, tree: 40, door: 30, plant: 30, hill: 30 };
  function itemBox(it) {
    if (it.kind === 'sky') return [0, 0, W, H];
    var p = PAD[it.kind] == null ? 40 : PAD[it.kind], x = it.x || 0, y = it.y || 0, w = it.w || 40, h = it.h || 40, st = it.state || {};
    if (it.kind === 'house') return [x - p, y - 60, w + 2 * p, h + 60 + p];
    if (it.kind === 'wall' || it.kind === 'floor') return [Math.min(0, x) - 12, y - 12, Math.max(w, W) + 24, h + 24];
    if (it.kind === 'machine' && st.variant === 'stove') return [x - 30, -12, w + 60, y + h + 30];
    if (it.kind === 'machine' && st.variant === 'crane') return [x - 70, y - 120, w + 140, h + 200];
    if (it.kind === 'machine' && st.variant === 'spout') return [x - 40, y - 20, w + 80, h + 40];
    if (it.kind === 'bridge' && !st.pier) return [x - 50, y - 330, w + 100, 380];
    if (it.kind === 'bridge' && st.pier) return [x - 10, y - 10, w + 20, h + 100];
    if (it.kind === 'lamp' && st.hang) return [x - 20, -4, w + 40, y + h + 30];
    if (it.kind === 'lamp' && st.big) return [x - 30, y - 30, w + 60, h + 50];
    if (it.kind === 'rock' && st.plate) return [x - 12, y - 70, w + 24, h + 84];
    if (it.kind === 'rock' && w > h * 2.4) return [x - 12, y - 14, w + 24, h + 40];
    if (it.kind === 'window') return [x - 40, y - 30, w + 80, h + 60];
    if (it.kind === 'gate') return [x - 30, y - 40, w + 60, h + 60];
    if (it.kind === 'fence' && st.stairs) return [x - 20, y - 50, w + 40, h + 70];
    if (it.kind === 'lever') return [x - 20, y - 20, w + 40, h + 40];
    if (it.kind === 'chime') return [x - 20, y - 10, w + 40, Math.max(h, 262) + 30];
    if (it.kind === 'mapsheet') return [-10, -10, W + 20, H + 20];
    if (it.kind === 'tide') return [x - 20, y - 20, w + 40, h + 40];
    if (it.kind === 'trail') return [x - 30, y - 30, w + 60, h + 60];
    if (it.kind === 'beacon') return [x - 40, y - 50, w + 80, h + 80];
    if (it.kind === 'machine' && st.variant === 'gear') return [x - 30, y - 30, w + 60, h + 60];
    return [x - p, y - p, w + 2 * p, h + 2 * p];
  }
  function drawFnFor(it) {
    var st = it.state || {};
    if (it.kind === 'rock' && (st.plate || st.variant || st.icon)) return K.rockObj;
    if (it.kind === 'water' && it.id) return K.waterObj;
    if (it.kind === 'bridge' && !st.pier) return function (g, o, sc, P) { K._drawbridge(g, o, P); };
    return K[it.kind] || unknownKind;
  }
  function unknownKind(g, it) {
    var x = it.x || 0, y = it.y || 0, w = it.w || 40, h = it.h || 40;
    var p = cut(g, rectP(x, y, w, h), '#cfc2a4', { seed: 2300, lift: 3 });
    g.save(); if (g.setLineDash) g.setLineDash([4, 4]); poly(g, p); g.strokeStyle = 'rgba(80,60,40,0.4)'; g.lineWidth = 1; g.stroke(); g.restore();
    tape(g, x + w / 2, y, Math.min(30, w * 0.6), 9, 0.1, 2301);
  }
  function stKey(st) { if (!st) return ''; var k = Object.keys(st).sort(), s = ''; for (var i = 0; i < k.length; i++) { if (k[i] === 'ring' || k[i] === 'sing' || k[i] === 'pose') continue; s += k[i] + '=' + JSON.stringify(st[k[i]]) + ';'; } return s; }
  function itemSprite(it, sc, P, pk) {
    var b = itemBox(it), fn = drawFnFor(it);
    var key = pk + '|' + (sc.id || '') + '|' + it.kind + '|' + (it.item || '') + '|' + it.x + ',' + it.y + ',' + it.w + ',' + it.h + ',' + (it.seed || 0) + '|' + stKey(it.state);
    return sprite(key, b[0], b[1], b[2], b[3], function (g) { try { fn(g, it, sc, P); } catch (e) { if (global.KVEST_STRICT) throw e; unknownKind(g, it); } });
  }
  // подряд идущие неподвижные элементы слоёв склеиваются в один холст
  var RUNS = typeof WeakMap !== 'undefined' ? new WeakMap() : null, RUNS_JSON = new Map();
  function layerPlan(sc, pk) {
    var layers = sc.layers || [], hold = RUNS && layers.length ? RUNS.get(layers) : null, key = pk + '|' + (sc.id || '');
    if (hold && hold[key]) return hold[key];
    var jk = null;
    if (!hold) { jk = key + '|' + JSON.stringify(layers); if (RUNS_JSON.has(jk)) return RUNS_JSON.get(jk); }
    var sorted = layers.slice().sort(function (a, b) { return (a.depth || 0) - (b.depth || 0); }), plan = { back: [], front: [], fogAfter: -1 }, run = null, idx = 0;
    sorted.forEach(function (L) {
      var d = L.depth || 0;
      (L.items || []).forEach(function (it) {
        if (d >= 3) { plan.front.push(it); return; }
        var moving = it.kind === 'cloud' || it.kind === 'plant' || it.kind === 'tree';
        if (moving) { run = null; plan.back.push({ live: it }); return; }
        if (isLiveLayer(it)) { // статика — в общий холст, живая часть — поверх, дальше новый холст
          if (!run) { run = { items: [], id: idx++ }; plan.back.push({ run: run }); }
          run.items.push(it); plan.back.push({ live: it }); run = null; return;
        }
        if (!run) { run = { items: [], id: idx++ }; plan.back.push({ run: run }); }
        run.items.push(it);
      });
      if (d === 0) { plan.fogAfter = plan.back.length; run = null; }
    });
    if (RUNS && layers.length) { if (!hold) { hold = {}; RUNS.set(layers, hold); } hold[key] = plan; }
    else if (jk) { RUNS_JSON.set(jk, plan); if (RUNS_JSON.size > 60) RUNS_JSON.delete(RUNS_JSON.keys().next().value); }
    return plan;
  }
  function runSprite(run, sc, P, pk) {
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    run.items.forEach(function (it) { var b = itemBox(it); x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[0] + b[2]); y1 = Math.max(y1, b[1] + b[3]); });
    x0 = Math.max(-10, Math.floor(x0)); y0 = Math.max(-10, Math.floor(y0)); x1 = Math.min(W + 10, Math.ceil(x1)); y1 = Math.min(H + 10, Math.ceil(y1));
    var key = 'run|' + pk + '|' + (sc.id || '') + '|' + run.id + '|' + (run.jkey || (run.jkey = JSON.stringify(run.items)));
    return sprite(key, x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0), function (g) { run.items.forEach(function (it) { var fn = drawFnFor(it); try { fn(g, it, sc, P); } catch (e) { if (global.KVEST_STRICT) throw e; unknownKind(g, it); } }); });
  }
  function motion(it, t) {
    var s = it.seed || 1;
    if (it.kind === 'cloud') return { dx: Math.sin(t * 0.13 + s) * 16, dy: Math.sin(t * 0.5 + s) * 1.5 };
    if (it.kind === 'plant') return { a: Math.sin(t * 1.3 + s) * 0.03, px: it.x + it.w / 2, py: it.y + it.h };
    if (it.kind === 'tree') return { a: Math.sin(t * 0.9 + s) * 0.008, px: it.x + it.w / 2, py: it.y + it.h };
    return null;
  }
  function drawLayerItem(ctx, it, sc, P, pk, t, staticPart) {
    if (staticPart !== false) {
      var s = itemSprite(it, sc, P, pk), m = motion(it, t);
      if (m) { ctx.save(); if (m.a) { ctx.translate(m.px, m.py); ctx.rotate(m.a); ctx.translate(-m.px, -m.py); } ctx.translate(m.dx || 0, m.dy || 0); blit(ctx, s); ctx.restore(); }
      else blit(ctx, s);
    }
    var lf = LIVE[it.kind]; if (lf) lf(ctx, it, t, sc, P);
  }

  // интерактивность: объект «под» зоной (кроме переходов) — получает светлый контур; под курсором — ореол
  function hotFor(sc, o) {
    var hs = sc.hotspots || [], cx = o.x + o.w / 2, cy = o.y + o.h / 2;
    for (var i = 0; i < hs.length; i++) { var h = hs[i]; if (h.id === o.id) return h; }
    for (var j = 0; j < hs.length; j++) { var r = hs[j].rect; if (hs[j].cursor !== 'go' && cx >= r[0] && cx <= r[0] + r[2] && cy >= r[1] && cy <= r[1] + r[3]) return hs[j]; }
    return null;
  }
  function hoverHs(sc, hv) {
    if (!hv || hv.x == null || hv.x < 0) return null;
    var hs = sc.hotspots || [];
    for (var i = hs.length - 1; i >= 0; i--) { var r = hs[i].rect; if (hv.x >= r[0] && hv.x <= r[0] + r[2] && hv.y >= r[1] && hv.y <= r[1] + r[3]) return hs[i]; }
    return null;
  }
  function drawObject(ctx, o, sc, P, pk, t, hot, hov) {
    if (o.kind === 'npc') {
      if (hov) addGlow(ctx, o.x + o.w / 2, o.y + o.h * 0.55, Math.max(o.w, o.h) * 0.75, '255,236,170', 0.3 + 0.1 * Math.sin(t * 5));
      drawNpc(ctx, o, (o.state && o.state.pose) || 'idle', t, true); return;
    }
    if (o.kind === 'item') { itemDraw(ctx, o, t, hov); return; }
    if (o.kind === 'maptoken') { tokenDraw(ctx, o, t); return; }
    var st = o.state || {}, s = itemSprite(o, sc, P, pk);
    if (hot && s.c && !(o.kind === 'box' && st.pic)) {
      var hl = halo(s, hov ? 4 : 2, hov ? 'rgba(255,232,150,1)' : 'rgba(255,246,226,0.75)');
      if (hl) { ctx.save(); if (hov) ctx.globalAlpha = 0.75 + 0.25 * Math.sin(t * 6); blit(ctx, hl); ctx.restore(); }
    }
    if (o.kind === 'chime' && st.ring > 0.02) { // качание трубки
      var sw = Math.sin(t * 16) * st.ring * 0.12, cx = o.x + o.w / 2;
      ctx.save(); ctx.translate(cx, o.y); ctx.rotate(sw); ctx.translate(-cx, -o.y); blit(ctx, s); ctx.restore();
      addGlow(ctx, cx, o.y + o.h * 0.5, o.w * 2.4, '255,236,180', 0.45 * st.ring);
      return;
    }
    blit(ctx, s);
    var lf = LIVE[o.kind === 'water' ? 'waterObj' : o.kind]; if (lf && o.kind !== 'water') lf(ctx, o, t, sc, P); else if (o.kind === 'water') LIVE.waterObj(ctx, o, t);
  }

  // флажки переходов: стрелка + пиктограмма сцены назначения
  function sceneIcon(id) { var S = global.KVEST && global.KVEST.SCENES; if (S) for (var i = 0; i < S.length; i++) if (S[i].id === id) return S[i].icon; return null; }
  function exitMarkers(ctx, sc, t, hvh) {
    if (sc.map) return;   // на карте переходы — сами узлы-места
    var hs = sc.hotspots || [], objs = sc.objects || [];
    hs.forEach(function (h) {
      if (h.cursor !== 'go' || !h.to) return;
      var r = h.rect, hatch = false, over = objs.some(function (o) { var hit = (o.kind === 'door' || o.kind === 'gate') && o.x < r[0] + r[2] && o.x + o.w > r[0] && o.y < r[1] + r[3] && o.y + o.h > r[1]; if (hit && o.state && o.state.hatch) { hatch = true; return false; } return hit; });
      if (over) return;
      var cx = r[0] + r[2] / 2, dir = hatch ? 2 : cx < 120 ? -1 : cx > 840 ? 1 : 0, mx = clamp(cx + (dir === 1 || dir === -1 ? -dir * 4 : 0) + (dir === 2 ? 44 : 0), 30, 930), my = Math.min(r[1] + r[3], 452) - 74, ic = sceneIcon(h.to), on = hvh === h;
      var s = sprite('exit|' + dir + '|' + (ic || ''), -26, -30, 52, 104, function (g) {
        cut(g, rectP(-2, 8, 4, 64), C.brown, { seed: 6200, lift: 2.5 });
        var fl = dir === 0 ? [[-18, -22], [18, -22], [18, 8], [-18, 8]] : [[-18 * dir, -18], [10 * dir, -18], [20 * dir, -4], [10 * dir, 10], [-18 * dir, 10]];
        if (dir === 0) fl = [[-16, -6], [0, -24], [16, -6], [16, 10], [-16, 10]];
        if (dir === 2) fl = [[-16, -20], [16, -20], [16, 4], [0, 20], [-16, 4]];
        cut(g, fl, '#e9dcbc', { seed: 6201, lift: 3, sh: 0.35 });
        if (ic) drawIconRaw(g, ic, dir === 2 ? 0 : dir * -1, dir === 2 ? -6 : -4, 22);
      });
      ctx.save(); ctx.translate(mx, my + Math.sin(t * 2 + cx) * 1.5); if (on) { ctx.translate(0, -3); }
      if (on) { var hl = halo(s, 3, 'rgba(255,232,150,1)'); if (hl) blit(ctx, hl); }
      blit(ctx, s); ctx.restore();
    });
  }

  // туман: рваные полосы над водой, дрейфуют; когда маяк горит — редеет и расходится
  function fogLayer(ctx, sc, P, t) {
    var amt = P.fog || 0; if (amt <= 0.01) return;
    var wy = 1e9, objs = sc.layers || [];
    objs.forEach(function (L) { (L.items || []).forEach(function (it) { if (it.kind === 'water' && it.w > 400) wy = Math.min(wy, it.y); }); });
    if (wy > H) return;
    var lit = sceneLit(sc), nb = LOWQ ? 2 : 4;
    for (var i = 0; i < nb; i++) {
      var s = sprite('fog|' + i, -200, -40, 1360, 90, function (g) {
        var top = [], R = rng(60 + i); for (var x = -200; x <= 1160; x += 40) top.push([x, -10 + Math.sin(x * 0.01 + i) * 10 + R() * 8]);
        var bot = []; for (var x2 = 1160; x2 >= -200; x2 -= 40) bot.push([x2, 30 + Math.sin(x2 * 0.013 + i * 2) * 10 + R() * 8]);
        cut(g, top.concat(bot), '#eef0ec', { seed: 6300 + i, torn: true, rim: '#ffffff', lift: 0, texA: 0.4, tornAmp: 3 });
      }, 1.25);
      var spread = lit ? 1 : 0, dx = Math.sin(t * 0.05 + i * 1.7) * 120 + (i % 2 ? 1 : -1) * spread * 260;
      ctx.save(); ctx.globalAlpha = Math.min(0.85, amt * (0.8 - i * 0.1) * (LOWQ ? 1.15 : 1)); ctx.translate(dx, wy - 34 + i * (LOWQ ? 46 : 30)); blit(ctx, s); ctx.restore();
    }
  }
  // темнота грота: тёмный лист с круглым вырезом света вокруг героини
  var DARK = null;
  function darkness(ctx, sc, P, opts, t) {
    var lt = opts.light, full = !!sc.dark, cave = palKey(sc) === 'cave';
    if (!full && !cave) return;
    var a = full ? 0.95 : 0.6, r = lt ? lt.r * (1 + 0.03 * Math.sin(t * 7)) : 0;
    if (!HAS_DOM) { ctx.fillStyle = 'rgba(12,10,8,' + a + ')'; ctx.fillRect(0, 0, W, H); return; }
    var HW = W / 2, HH = H / 2; // половинное разрешение: край света мягкий, а пикселей вчетверо меньше
    if (!DARK) { DARK = mkCanvas(HW, HH); DARK.sheet = mkCanvas(HW, HH); var sg = DARK.sheet.getContext('2d'); sg.fillStyle = '#0e0b09'; sg.fillRect(0, 0, HW, HH); var p = patFor(sg); if (p) { sg.globalCompositeOperation = 'overlay'; sg.globalAlpha = 0.5; sg.fillStyle = p; sg.fillRect(0, 0, HW, HH); } }
    var g = DARK.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'copy'; g.globalAlpha = a; g.drawImage(DARK.sheet, 0, 0); g.globalAlpha = 1;
    if (lt && r > 0) {
      g.globalCompositeOperation = 'destination-out'; g.setTransform(0.5, 0, 0, 0.5, 0, 0);
      var gr = g.createRadialGradient(lt.x, lt.y, r * 0.35, lt.x, lt.y, r); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.75, 'rgba(0,0,0,0.75)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; poly(g, wob(ell(lt.x, lt.y, r, r, 28), 77, r * 0.04, 12)); g.fill();
      g.setTransform(1, 0, 0, 1, 0, 0);
    }
    g.globalCompositeOperation = 'source-over';
    ctx.drawImage(DARK, 0, 0, HW, HH, 0, 0, W, H);
    if (lt && r > 0) addGlow(ctx, lt.x, lt.y, r * 0.9, '255,190,110', full ? 0.12 : 0.18);
  }

  // прогрев кэша в паузах браузера: статичные слои и объекты всех сцен главы (чтобы вход в сцену не «замирал»)
  var WARM = null;
  function warmStart() {
    if (WARM || !HAS_DOM || typeof setTimeout === 'undefined') return; WARM = [];
    var S = (global.KVEST && global.KVEST.SCENES) || [];
    S.forEach(function (sc0) {
      var objs = (sc0.objects || []).map(function (o) { var st = {}, k; for (k in (o.state || {})) st[k] = o.state[k]; if (o.bind) for (k in o.bind) st[k] = false; return { id: o.id, kind: o.kind, item: o.item, x: o.x, y: o.y, w: o.w, h: o.h, seed: o.seed, state: st }; });
      var sc = { id: sc0.id, mood: sc0.mood, layers: sc0.layers, objects: objs, hotspots: sc0.hotspots };
      var pk = palKey(sc), P = pal(sc);
      WARM.push(function () { layerPlan(sc, pk).back.forEach(function (e) { if (e.run) WARM.unshift(function () { runSprite(e.run, sc, P, pk); }); }); });
      objs.forEach(function (o) { if (o.kind !== 'npc' && o.kind !== 'item') WARM.push(function () { itemSprite(o, sc, P, pk); }); });
    });
    var ric = global.requestIdleCallback || function (f) { return setTimeout(function () { f({ timeRemaining: function () { return 12; } }); }, 60); };
    // прогрев — только пока есть запас бюджета (≤ 75 %); прогретые спрайты помечены «старыми» и уступают место текущей сцене
    (function step(dl) {
      var n = 0;
      while (WARM.length && (n++ === 0 || dl.timeRemaining() > 10)) {
        if (AREA + HALO_AREA + ACT_AREA > MAX_AREA * 0.75) { WARM.length = 0; break; }
        WARMING = true; try { WARM.shift()(); } catch (e) {} WARMING = false;
      }
      if (WARM.length) ric(step, { timeout: 400 });
    })({ timeRemaining: function () { return 0; } });
  }

  function drawScene(ctx, sc, t, opts) {
    opts = opts || {}; t = t || 0; sc = sc || {};
    FRAME++; if (!WARM && HAS_DOM && !warmStart.sched) { warmStart.sched = 1; setTimeout(warmStart, 300); }
    if (HAS_DOM && sc && sc.id !== LAST_SC) { LAST_SC = sc.id; cache.forEach(function (v) { if (v.use > FRAME - 3) v.use = FRAME - 3; }); }   // смена сцены: спрайты прошлой — первые на вытеснение
    if (HAS_DOM && AREA + HALO_AREA + ACT_AREA > MAX_AREA && (FRAME & 15) === 0) evict();
    var P = pal(sc), pk = palKey(sc), pass = opts.pass || 'all', plan = layerPlan(sc, pk), hv = hoverHs(sc, opts.hover);
    ctx.save();
    if (pass !== 'front') {
      var first = plan.back[0];   // небо во весь кадр закрывает фон — заливка не нужна (минус один полноэкранный проход)
      if (!(first && first.run && first.run.items[0] && first.run.items[0].kind === 'sky')) { ctx.fillStyle = P.bands ? P.bands[0] : '#4a3426'; ctx.fillRect(0, 0, W, H); }
      plan.back.forEach(function (e, i) {
        if (i === plan.fogAfter) fogLayer(ctx, sc, P, t);
        if (e.run) blit(ctx, runSprite(e.run, sc, P, pk));
        else drawLayerItem(ctx, e.live, sc, P, pk, t, e.live.kind === 'cloud' || e.live.kind === 'plant' || e.live.kind === 'tree');
      });
      if (plan.fogAfter >= plan.back.length) fogLayer(ctx, sc, P, t);
      (sc.objects || []).forEach(function (o) {
        if (o.kind === 'npc' && opts.npcSeparate) return;
        var hot = hotFor(sc, o), hov = hv && hot === hv;
        try { drawObject(ctx, o, sc, P, pk, t, hot, hov); } catch (e) { if (global.KVEST_STRICT) throw e; unknownKind(ctx, o); }
      });
      if (hv && hv.cursor !== 'go' && !(sc.objects || []).some(function (o) { return hotFor(sc, o) === hv; })) { var r = hv.rect; addGlow(ctx, r[0] + r[2] / 2, r[1] + r[3] / 2, Math.max(r[2], r[3]) * 0.6, '255,236,170', 0.22); }
      exitMarkers(ctx, sc, t, hv);
    }
    if (pass !== 'back') {
      plan.front.forEach(function (it) { drawLayerItem(ctx, it, sc, P, pk, t); });
      // общий тон сцены и виньетка — одним проходом (тон запечён в спрайт виньетки; мягкий слой — в четверть разрешения)
      if (!INDOOR[pk] && pk !== 'cave' && !LOWQ) blit(ctx, sprite('vign|' + pk + '|' + (P.tint || ''), 0, 0, W, H, function (g) { if (P.tint) { g.fillStyle = P.tint; g.fillRect(0, 0, W, H); } var gr = g.createRadialGradient(W / 2, H * 0.5, H * 0.45, W / 2, H / 2, W * 0.68); gr.addColorStop(0, 'rgba(30,15,8,0)'); gr.addColorStop(1, pk === 'night' || pk === 'lit' ? 'rgba(5,8,20,0.45)' : 'rgba(30,15,8,0.28)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); }, 0.25));
      else if (P.tint) { ctx.fillStyle = P.tint; ctx.fillRect(0, 0, W, H); }
      darkness(ctx, sc, P, opts, t);
    }
    if (opts.debug) debugOverlay(ctx, sc);
    ctx.restore();
  }
  function debugOverlay(c, sc) {
    c.save(); c.font = '700 10px monospace'; c.textBaseline = 'top';
    (sc.objects || []).forEach(function (o) { c.fillStyle = 'rgba(0,0,0,0.6)'; var s = o.id + ':' + o.kind; c.fillRect(o.x, o.y - 12, s.length * 6.2 + 4, 12); c.fillStyle = '#fff'; c.fillText(s, o.x + 2, o.y - 11); });
    (sc.hotspots || []).forEach(function (h) { c.strokeStyle = h.to ? '#2a6' : '#c33'; c.lineWidth = 1.5; if (c.setLineDash) c.setLineDash([4, 3]); c.strokeRect(h.rect[0], h.rect[1], h.rect[2], h.rect[3]); if (c.setLineDash) c.setLineDash([]); c.fillStyle = '#c33'; c.fillText(h.id + (h.to ? '→' + h.to : ''), h.rect[0] + 2, h.rect[1] + h.rect[3] - 12); });
    if (sc.walk) { c.strokeStyle = '#36c'; c.lineWidth = 2; c.beginPath(); sc.walk.forEach(function (p, i) { if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }); c.stroke(); }
    c.restore();
  }

  // ================= мысль: бумажная карточка на скотче + три «конфетти»-кружка к голове =================
  function drawThought(ctx, x, y, icons, t) {
    icons = icons && icons.length ? icons : ['question'];
    var n = icons.length, cw = 30 + n * 52, ch = 72, t0 = t || 0;
    var cx = clamp(x + 24, cw / 2 + 12, W - cw / 2 - 12), cy = Math.max(ch / 2 + 10, y - ch / 2 - 22);
    for (var i = 0; i < 3; i++) { var f = (i + 1) / 4, dx = x + (cx - x) * f * 0.5, dy = y + 4 - (y + 4 - (cy + ch / 2)) * f, rr = 3 + i * 2; cut(ctx, ell(dx, dy, rr, rr * 0.9, 12), '#fbf5e6', { live: true, lift: 2, seed: 7000 + i }); }
    var card = sprite('thought|' + n, -cw / 2 - 12, -ch / 2 - 14, cw + 24, ch + 30, function (g) {
      var c = cut(g, rectP(-cw / 2, -ch / 2, cw, ch), '#fbf5e6', { seed: 7010 + n, lift: 4, torn: true, rim: '#ffffff', tornAmp: 1.8, amp: 1.2, step: 5, sh: 0.32 });
      g.save(); poly(g, c); g.clip(); g.strokeStyle = 'rgba(120,150,160,0.22)'; g.lineWidth = 1; for (var ly = -ch / 2 + 14; ly < ch / 2; ly += 12) { g.beginPath(); g.moveTo(-cw / 2, ly); g.lineTo(cw / 2, ly); g.stroke(); } g.restore();
      tape(g, 0, -ch / 2 + 1, 34, 11, 0.06, 7020);
    });
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.sin(t0 * 1.4) * 0.02 - 0.015); blit(ctx, card);
    for (var j = 0; j < n; j++) drawIcon(ctx, icons[j], -cw / 2 + 41 + j * 52, 4 + Math.sin(t0 * 2.4 + j) * 1.2, 44);
    ctx.restore();
  }

  // ================= курсоры: кружок-наклейка с глифом =================
  function drawCursor(ctx, kind, x, y) {
    ctx.save(); ctx.translate(x, y);
    if (kind === 'walk') { ctx.fillStyle = 'rgba(40,20,8,0.3)'; ctx.beginPath(); ctx.arc(1, 1.5, 6, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(0, 0, 6, 0, TAU); ctx.strokeStyle = '#fbf3e0'; ctx.lineWidth = 2.5; ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 6, 0, TAU); ctx.strokeStyle = '#4a3024'; ctx.lineWidth = 1; ctx.stroke(); ctx.fillStyle = '#4a3024'; ctx.beginPath(); ctx.arc(0, 0, 1.6, 0, TAU); ctx.fill(); ctx.restore(); return; }
    var s = sprite('cursor|' + kind, -22, -22, 46, 48, function (g) {
      var known = { use: 1, take: 1, go: 1, look: 1 }[kind];
      if (!known) { cut(g, [[-2, -2], [-2, 18], [3, 13], [7, 21], [10, 19], [6, 11], [13, 11]], '#fbf3e0', { seed: 7100, lift: 2.5, raw: true, live: true }); g.strokeStyle = '#4a3024'; g.lineWidth = 1.2; poly(g, [[-2, -2], [-2, 18], [3, 13], [7, 21], [10, 19], [6, 11], [13, 11]]); g.stroke(); return; }
      cut(g, ell(0, 0, 16, 16, 24), '#fbf3e0', { seed: 7101, lift: 3, sh: 0.45, live: true });
      g.beginPath(); g.arc(0, 0, 16, 0, TAU); g.strokeStyle = '#4a3024'; g.lineWidth = 1.5; g.stroke();
      if (kind === 'use') { cut(g, gearPtsP(0, 0, 11, 8, 0.2), C.mustard, { seed: 7102, lift: 1, raw: true, live: true }); g.beginPath(); g.arc(0, 0, 3.5, 0, TAU); g.fillStyle = '#4a3024'; g.fill(); }
      else if (kind === 'take') { var hp = [[-7, 9], [-9, -2], [-6, -4], [-4, 1], [-4, -10], [-1, -10], [0, -1], [1, -12], [4, -12], [4, -1], [6, -9], [9, -9], [8, 3], [6, 9]]; cut(g, hp, C.skin, { seed: 7103, lift: 1, raw: true, live: true }); g.strokeStyle = '#4a3024'; g.lineWidth = 1.3; poly(g, hp); g.stroke(); }
      else if (kind === 'go') { var ap2 = [[-10, -4], [1, -4], [1, -10], [11, 0], [1, 10], [1, 4], [-10, 4]]; cut(g, ap2, C.teal, { seed: 7104, lift: 1, raw: true, live: true }); }
      else if (kind === 'look') { drawIconRaw(g, 'eye', 0, 0, 26); }
    });
    blit(ctx, s); ctx.restore();
  }

  // ================= интерфейс =================
  function uiButton(ctx, b, icon, on, ring, t, kind) {
    var s = sprite('btn|' + icon + '|' + (on ? 1 : 0) + '|' + b.r, b.x - b.r - 8, b.y - b.r - 8, b.r * 2 + 18, b.r * 2 + 18, function (g) {
      var base = kind === 'close' ? '#c9553a' : (icon === 'hint' ? C.mustard : '#a88052');
      cut(g, ell(b.x, b.y, b.r, b.r, 28), on ? base : '#7a6a58', { seed: 7200, lift: 4, sh: 0.4 });
      cut(g, ell(b.x, b.y, b.r - 5, b.r - 5, 26), on ? '#f6ecd4' : '#b9ad98', { seed: 7201, lift: 1.5 });
      drawIconRaw(g, icon, b.x, b.y, b.r * 1.35);
    });
    if (on && icon === 'hint') addGlow(ctx, b.x, b.y, b.r * 2, '255,220,120', 0.25 + 0.1 * Math.sin((t || 0) * 3));
    blit(ctx, s);
    if (ring) { ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 3, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - ring)); ctx.strokeStyle = 'rgba(255,240,200,0.9)'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.stroke(); }
  }
  function drawUI(ctx, ui, t) {
    ui = ui || {}; var L = ui.layout || (API && API.LAYOUT); if (!L) return;
    if (ui.mode === 'walk' && ui.walk) { if (theme.drawWalkbook) theme.drawWalkbook(ctx, ui.walk, L, t); else drawWalk(ctx, ui, L, t); return; }
    var I = L.inv;
    if (ui.mode !== 'mini') {
      blit(ctx, sprite('invbar|' + I.slots, 0, I.y - 12, W, H - I.y + 12, function (g) {
        var top = []; for (var x = -10; x <= W + 10; x += 14) top.push([x, I.y - 2 + Math.sin(x * 0.07) * 1.5]);
        cut(g, top.concat([[W + 10, H + 10], [-10, H + 10]]), '#9c7448', { seed: 8000, torn: true, rim: '#e9d9b6', lift: 5, sx: 0, sy: -0.6, sh: 0.4 });
        stitch(g, top.map(function (q) { return [q[0], q[1] + 7]; }), 'rgba(250,230,190,0.5)', 1);
        for (var i = 0; i < I.slots; i++) { var sx = I.slot0 + i * (I.slotW + I.gap); cut(g, rotP(rectP(sx + 2, I.slotY + 2, I.slotW - 4, I.slotH - 4), sx + I.slotW / 2, I.slotY + I.slotH / 2, (i % 2 ? 1 : -1) * 0.025), '#efe2c4', { seed: 8010 + i, lift: 2, amp: 0.8 }); }
      }));
      for (var i = 0; i < I.slots; i++) {
        var x = I.slot0 + i * (I.slotW + I.gap), item = (ui.inv || [])[i], sel = item && ui.sel === item, hov = ui.hover === i && item;
        if (sel || hov) { ctx.save(); ctx.strokeStyle = sel ? '#e2a93a' : 'rgba(255,250,235,0.9)'; ctx.lineWidth = sel ? 4 : 2.5; ctx.beginPath(); ctx.rect(x + 1, I.slotY + 1, I.slotW - 2, I.slotH - 2); ctx.stroke(); ctx.restore(); }
        if (item && !(ui.drag && ui.drag.item === item)) drawIcon(ctx, item, x + I.slotW / 2, I.slotY + I.slotH / 2 - (sel ? 3 : 0), 42);
      }
      uiButton(ctx, L.hint, 'hint', ui.hint && ui.hint.ready, ui.hint && !ui.hint.ready ? ui.hint.cd : 0, t);
      if (ui.hint && !ui.hint.ready) drawIcon(ctx, 'firefly', L.hint.x + 18, L.hint.y - 18, 18);
      uiButton(ctx, L.book, 'book', true, 0, t);
      if (ui.progress) { // огоньки решённых головоломок
        var tot = Math.max(1, ui.progress.total), done = ui.progress.solved, px = I.w - 16 - tot * 4.4, py = I.y + I.h / 2;
        drawIcon(ctx, done >= tot ? 'lamp' : 'tower', px - 16, py, 22);
        for (var k = 0; k < tot; k++) { ctx.fillStyle = k < done ? '#f2c25a' : 'rgba(60,40,25,0.55)'; ctx.beginPath(); ctx.arc(px + k * 4.4 + 2, py + (k % 2 ? 3 : -3), k < done ? 2.2 : 1.6, 0, TAU); ctx.fill(); }
      }
    }
    if (ui.close) { uiButton(ctx, L.close, 'close', true, 0, t, 'close'); if (ui.solvedMini) { addGlow(ctx, 480, 270, 260, '255,230,150', 0.4); drawIcon(ctx, 'check', 480, 270, 130); } }
    if (ui.drag) { ctx.save(); ctx.globalAlpha = 0.95; drawIcon(ctx, ui.drag.item, ui.drag.x, ui.drag.y - 4, 50); ctx.restore(); }
    if (ui.mode === 'cut') { // кат-сцена: бумажные шторки
      blit(ctx, sprite('cutbars', -10, -10, W + 20, 54, function (g) {
        var a = []; for (var x = -10; x <= W + 10; x += 14) a.push([x, 26 + Math.sin(x * 0.05) * 2]);
        cut(g, [[-10, -10], [W + 10, -10]].concat(a.slice().reverse()), '#1e1612', { seed: 8100, torn: true, rim: '#5a4535', lift: 4, sh: 0.5 });
      }));
      ctx.fillStyle = 'rgba(20,14,10,0.5)'; ctx.fillRect(I.x, I.y - 8, I.w, I.h + 8);
    }
    if (ui.debug) { ctx.save(); ctx.font = '700 11px monospace'; ctx.fillStyle = '#b00'; ctx.fillText('DEBUG (D)', 8, 16); ctx.restore(); }
  }
  function drawWalk(ctx, ui, L, t) { // прохождение-набросок: тетрадный лист, карточки шагов на скотче
    var Wk = L.walk, wk = ui.walk, per = Wk.cols * Wk.rows;
    blit(ctx, sprite('walkbg', -10, -10, W + 20, H + 20, function (g) {
      cut(g, rectP(-10, -10, W + 20, H + 20), '#3a2c22', { seed: 8200, lift: 0, raw: true });
      var sh = cut(g, rotP(rectP(24, 16, W - 48, H - 32), W / 2, H / 2, -0.006), '#f4ebd6', { seed: 8201, lift: 6, sh: 0.5 });
      g.save(); poly(g, sh); g.clip(); g.strokeStyle = 'rgba(110,150,170,0.25)'; g.lineWidth = 1; for (var y = 40; y < H; y += 22) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); } g.strokeStyle = 'rgba(200,90,80,0.3)'; g.beginPath(); g.moveTo(80, 0); g.lineTo(80, H); g.stroke(); g.restore();
    }));
    drawIcon(ctx, 'book', 480, 46, 44);
    var steps = wk.steps.slice(wk.page * per, wk.page * per + per);
    steps.forEach(function (s, i) {
      var col = i % Wk.cols, row = (i / Wk.cols) | 0, x = Wk.x0 + col * (Wk.cw + Wk.gap), yy = Wk.y0 + row * (Wk.ch + Wk.gap);
      blit(ctx, sprite('walkcard|' + (s.done ? 1 : 0) + '|' + i, x - 10, yy - 12, Wk.cw + 20, Wk.ch + 24, function (g) {
        cut(g, rotP(rectP(x, yy, Wk.cw, Wk.ch), x + Wk.cw / 2, yy + Wk.ch / 2, (i % 2 ? 1 : -1) * 0.012), s.done ? '#efe4c8' : '#fffaf0', { seed: 8210 + i, lift: 3, sh: 0.3 });
        tape(g, x + Wk.cw / 2, yy + 2, 40, 11, (i % 2 ? 1 : -1) * 0.05, 8230 + i);
      }));
      var ic = s.icons, head = ic[0];
      drawIcon(ctx, head, x + 30, yy + 32, 36); ctx.strokeStyle = 'rgba(80,60,40,0.3)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 54, yy + 32); ctx.lineTo(x + Wk.cw - 16, yy + 32); ctx.stroke();
      var rest = ic.slice(1), n = rest.length, cols = Math.min(n, 4), sz = n > 4 ? 34 : 44;
      rest.forEach(function (id, j) {
        var cx = x + 20 + (Wk.cw - 40) * ((j % cols) + 0.5) / cols, cy = yy + (n > 4 ? 82 + ((j / cols) | 0) * 46 : 102);
        drawIcon(ctx, id, cx, cy, sz);
        if (j < n - 1 && (j % cols) < cols - 1) { ctx.fillStyle = '#9a8b74'; poly(ctx, [[cx + sz * 0.55, cy - 4], [cx + sz * 0.7, cy], [cx + sz * 0.55, cy + 4]]); ctx.fill(); }
      });
      if (s.done) drawIcon(ctx, 'check', x + Wk.cw - 22, yy + Wk.ch - 22, 28);
    });
    if (wk.page > 0) uiButton(ctx, Wk.prev, 'prev', true, 0, t);
    if (wk.page < wk.pages - 1) uiButton(ctx, Wk.next, 'next', true, 0, t);
    uiButton(ctx, Wk.close, 'close', true, 0, t, 'close');
    for (var p = 0; p < wk.pages; p++) { ctx.fillStyle = p === wk.page ? '#4a3024' : '#c2b49a'; ctx.beginPath(); ctx.arc(480 - (wk.pages - 1) * 10 + p * 20, 514, 5, 0, TAU); ctx.fill(); }
  }

  var theme = {
    id: 'paper', name: { ru: 'Бумага', en: 'Paper' },
    drawScene: drawScene,
    drawHero: drawHero,
    drawNpc: function (ctx, npc, pose, t) { drawNpc(ctx, npc, pose, t); },
    drawThought: drawThought,
    drawIcon: function (ctx, id, x, y, size) { drawIcon(ctx, id, x, y, size); },
    drawCursor: drawCursor,
    drawUI: drawUI,
    cacheSize: function () { return cache.size; },
    cacheStats: cacheStats,
    setResolution: setResolution,                       // HiDPI: масштаб кэшей (main.js)
    setQuality: function (q) { LOWQ = q === 'low'; return LOWQ ? 'low' : 'high'; },
    resolution: function () { return RES; },
    setCacheBudget: function (px) { MAX_AREA = Math.max(2e6, +px || MAX_AREA); evict(); return MAX_AREA; },
    // внутренности для модуля ink-sketch.js (эскизы тушью рисуются из тех же спрайтов, что и сцена)
    _lib: { res: function () { return RES; }, drawIconRaw: drawIconRaw, palKey: palKey, pal: pal, itemSprite: itemSprite, blit: blit, HAS_DOM: HAS_DOM }
  };
  var KV = global.KVEST = global.KVEST || {};
  (KV.themes = KV.themes || {}).paper = theme;
  global.KvestTheme = theme;
})(typeof window !== 'undefined' ? window : globalThis);
