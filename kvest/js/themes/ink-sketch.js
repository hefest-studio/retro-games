/* МАЯЧНИЦА · themes/ink-sketch.js — «тушь»: эскизы подсказок, блокнот прохождения и мысли мастера (решение владельца 14.11).
   Игра остаётся в «бумаге»; тушью рисуется то, что объясняет: мастер и героиня набрасывают задачу пером.
   Модуль подключается после темы paper и вешает на неё явные хуки контракта (см. theme-api.js, THEME-CONTRACT.md):
     drawHint(ctx, x, y, hint, t, opts)      — мысль-подсказка: эскиз цели (hint.ink — глифы из puzzles.js), opts.age — сек. с появления;
     drawWalkbook(ctx, walk, layout, t)      — разворот блокнота: шаг на страницу (только пройденные и текущий);
     drawThought(ctx, x, y, icons, t, opts)  — opts.style === 'ink' → мысль тушью с эффектом пера (мастер в кат-сценах).
   Как получается «тушь»: глиф — это ТОТ ЖЕ объект сцены (или пиктограмма), отрисованный темой paper в offscreen-холст и
   переведённый попиксельно в штрих: контур по альфе, внутренние линии — оператор Собеля по яркости, тон — штриховка
   двумя направлениями и заливка в самых тёмных местах. Поэтому эскиз узнаётся: силуэт совпадает с тем, что в сцене.
   Цель отмечена петлёй киноварью. «Кипение» штриха — 3 варианта глифа, спокойный режим 2,5 раза в секунду;
   переключатель «Анимация штриха» (меню/пауза) выключает и кипение, и анимацию пера (всё рисуется сразу, статично).
   Без DOM (Node, тесты) глифы рисуются напрямую исходной графикой — так проверяется, что всё рисуется без исключений. */
(function (global) {
  'use strict';
  var K = global.KVEST = global.KVEST || {};
  var HAS_DOM = typeof document !== 'undefined' && !!document.createElement;
  var W = 960, H = 540, TAU = Math.PI * 2;
  var INK = '#1e1915', IVORY = '#f1e8cf', IVORY_D = '#e2d5b3', VERM = '#c63d26';
  // подкраска акварелью: цвет-метка из сцены (рычаги крана ↔ части крана) — ключ state.tint или #rgb
  var WASH = { pin: '#c0442e', boom: '#dca543', hook: '#4f7472' };
  var SS = 2; // суперсэмплинг глифов: 2 (до RES 2), 3 — на экранах плотнее (HiDPI, см. paper.setResolution)

  // ---------- настройка «Анимация штриха» (сохраняется) ----------
  var KEY = 'arcade.kvest.inkAnim', ANIM = null;
  function store() { try { return global.localStorage || null; } catch (e) { return null; } }
  function anim() { if (ANIM === null) { var s = store(), v = null; try { v = s && s.getItem(KEY); } catch (e) {} ANIM = v !== '0'; } return ANIM; }
  function setAnim(on) { ANIM = !!on; var s = store(); try { if (s) s.setItem(KEY, ANIM ? '1' : '0'); } catch (e) {} return ANIM; }
  function boilV(t) { return anim() ? Math.floor((t || 0) * 2.5) % 3 : 0; }

  // ---------- утилиты ----------
  function rng(seed) { var a = ((seed || 1) * 2654435761) >>> 0 || 1; return function () { a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function ell(cx, cy, rx, ry, n, a0, a1) { n = n || 24; a0 = a0 || 0; a1 = a1 == null ? TAU : a1; var p = [], full = Math.abs(a1 - a0 - TAU) < 1e-6, m = full ? n : n + 1; for (var i = 0; i < m; i++) { var a = a0 + (a1 - a0) * i / n; p.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); } return p; }
  function poly(g, p) { g.beginPath(); g.moveTo(p[0][0], p[0][1]); for (var i = 1; i < p.length; i++) g.lineTo(p[i][0], p[i][1]); g.closePath(); }
  function mk(w, h) { if (!HAS_DOM) return null; var c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }
  function lib() { var t = K.themes && K.themes.paper; return t && t._lib; }

  // ---------- перо: ломаная с дрожанием и «бюджетом» проявления (эффект рисования) ----------
  var REV = { left: Infinity, nib: null, v: 0 };
  function jitter(pts, amp, seed) {
    var R = rng(seed + REV.v * 7919), out = [];
    for (var i = 0; i < pts.length - 1; i++) {
      var a = pts[i], b = pts[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.max(1, Math.ceil(L / 6));
      for (var j = 0; j < k; j++) { var f = j / k; out.push([a[0] + (b[0] - a[0]) * f + (R() - 0.5) * amp, a[1] + (b[1] - a[1]) * f + (R() - 0.5) * amp]); }
    }
    var e = pts[pts.length - 1]; out.push([e[0] + (R() - 0.5) * amp * 0.5, e[1] + (R() - 0.5) * amp * 0.5]);
    return out;
  }
  function pen(g, pts, w, seed, col) {
    if (REV.left <= 0 || pts.length < 2) return;
    var p = jitter(pts, 0.9, seed || 1);
    g.save(); g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = col || INK;
    var R = rng((seed || 1) + 13);
    for (var i = 0; i < p.length - 1 && REV.left > 0; i++) {
      var a = p[i], b = p[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), f = Math.min(1, REV.left / (L || 1));
      var e = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(e[0], e[1]);
      g.lineWidth = w * (0.7 + 0.5 * Math.sin(i * 0.5 + seed) * 0.5 + R() * 0.2); g.stroke();
      REV.left -= L; REV.nib = e;
    }
    g.restore();
  }
  function arrow(g, x0, y0, x1, y1, w, seed, col) {
    var mx = (x0 + x1) / 2, my = (y0 + y1) / 2 - Math.abs(x1 - x0) * 0.12, pts = [];
    for (var i = 0; i <= 8; i++) { var f = i / 8, u = 1 - f; pts.push([u * u * x0 + 2 * u * f * mx + f * f * x1, u * u * y0 + 2 * u * f * my + f * f * y1]); }
    pen(g, pts, w, seed, col);
    var a = Math.atan2(y1 - pts[6][1], x1 - pts[6][0]), hl = 9 + w * 2;
    pen(g, [[x1 - Math.cos(a - 0.5) * hl, y1 - Math.sin(a - 0.5) * hl], [x1, y1], [x1 - Math.cos(a + 0.5) * hl, y1 - Math.sin(a + 0.5) * hl]], w, seed + 3, col);
  }
  function loop(g, cx, cy, rx, ry, w, seed, col) { // петля киноварью вокруг цели (незамкнутая, как от руки)
    var p = ell(cx, cy, rx, ry, 30, -2.2, -2.2 + TAU * 1.08); pen(g, p, w, seed, col || VERM);
  }
  function blot(g, x, y, r) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = INK; g.fill(); }
  // акварельная капля цвета-метки (неровный край, светлая середина) — связывает эскиз с цветом предмета в сцене
  function wash(g, x, y, c, seed) {
    var col = WASH[c] || c, R = rng(seed), p = [];
    for (var i = 0; i < 14; i++) { var a = i / 14 * TAU, r = 11 * (0.85 + R() * 0.3); p.push([x + Math.cos(a) * r, y + Math.sin(a) * r * 0.8]); }
    g.save(); g.globalAlpha = 0.75; poly(g, p); g.fillStyle = col; g.fill(); g.globalAlpha = 0.9; g.lineWidth = 1.2; g.strokeStyle = col; g.stroke(); g.restore();
  }
  // стрелка-флажок над глифом: 'up' — киноварью вверх (поднять/включить), 'down' — тушью вниз (опустить/выключить)
  function flag(g, x, y, kind, seed) {
    var save = REV.left; REV.left = Infinity;
    if (kind === 'up') arrow(g, x, y - 2, x, y - 24, 2.6, seed, VERM);
    else arrow(g, x, y - 24, x, y - 2, 2.2, seed, INK);
    REV.left = save;
  }
  function nib(g, p) { // перо у края проявления
    if (!p) return; g.save(); g.translate(p[0], p[1]); g.rotate(-0.8);
    g.beginPath(); g.moveTo(0, 0); g.lineTo(5, -14); g.lineTo(0, -22); g.lineTo(-5, -14); g.closePath(); g.fillStyle = '#3a3029'; g.fill();
    g.beginPath(); g.moveTo(0, -2); g.lineTo(0, -14); g.strokeStyle = '#d9cba5'; g.lineWidth = 0.8; g.stroke();
    g.fillStyle = '#6a4a2c'; g.fillRect(-4, -46, 8, 26); g.restore();
  }

  // ---------- бумага слоновой кости ----------
  var PAPER = null;
  function paperTex() {
    if (PAPER || !HAS_DOM) return PAPER;
    var n = 256, c = mk(n, n), g = c.getContext('2d'), id = g.createImageData(n, n), R = rng(17), base = [241, 232, 207];
    for (var i = 0; i < n * n; i++) { var v = (R() - 0.5) * 12; id.data[i * 4] = base[0] + v; id.data[i * 4 + 1] = base[1] + v * 0.95; id.data[i * 4 + 2] = base[2] + v * 0.8; id.data[i * 4 + 3] = 255; }
    g.putImageData(id, 0, 0); g.lineCap = 'round';
    for (var f = 0; f < 260; f++) { var x = R() * n, y = R() * n, l = 4 + R() * 14, a = R() * TAU; g.strokeStyle = f % 4 ? 'rgba(255,252,240,0.45)' : 'rgba(120,95,60,0.16)'; g.lineWidth = 0.5 + R() * 0.6; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
    PAPER = c; return c;
  }
  var PATS = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  function paperFill(g) { var t = paperTex(); if (!t || !PATS) return IVORY; var p = PATS.get(g); if (!p) { p = g.createPattern(t, 'repeat'); PATS.set(g, p); } return p; }
  function deckle(x, y, w, h, seed) { // рваный край листа
    var R = rng(seed), p = [], step = 10;
    for (var a = 0; a < w; a += step) p.push([x + a, y + (R() - 0.5) * 2.2]);
    for (var b = 0; b < h; b += step) p.push([x + w + (R() - 0.5) * 2.2, y + b]);
    for (var c = w; c > 0; c -= step) p.push([x + c, y + h + (R() - 0.5) * 2.2]);
    for (var d = h; d > 0; d -= step) p.push([x + (R() - 0.5) * 2.2, y + d]);
    return p;
  }
  function sheet(g, x, y, w, h, seed, shadow) {
    var p = deckle(x, y, w, h, seed);
    if (shadow !== false) { g.save(); g.translate(2, 4); poly(g, p); g.fillStyle = 'rgba(30,18,8,0.35)'; g.fill(); g.restore(); }
    poly(g, p); g.fillStyle = paperFill(g); g.fill();
    g.save(); poly(g, p); g.clip(); var gr = g.createRadialGradient(x + w / 2, y + h / 2, Math.min(w, h) * 0.3, x + w / 2, y + h / 2, Math.max(w, h) * 0.75);
    gr.addColorStop(0, 'rgba(150,110,60,0)'); gr.addColorStop(1, 'rgba(150,110,60,0.2)'); g.fillStyle = gr; g.fillRect(x - 4, y - 4, w + 8, h + 8); g.restore();
    return p;
  }

  // ---------- источник глифа: объект/элемент сцены или пиктограмма в оформлении paper ----------
  function sceneById(id) { var S = K.SCENES || []; for (var i = 0; i < S.length; i++) if (S[i].id === id) return S[i]; return null; }
  function objOf(ref, st) { // 'сцена/объект' → копия объекта с состоянием (bind — ложь, затем st из эскиза)
    var p = String(ref).split('/'), sc = sceneById(p[0]); if (!sc) return null;
    var o = null; (sc.objects || []).forEach(function (q) { if (q.id === p[1]) o = q; }); if (!o) return null;
    var s = {}, k; for (k in (o.state || {})) s[k] = o.state[k]; if (o.bind) for (k in o.bind) s[k] = false; if (st) for (k in st) s[k] = st[k];
    return { sc: sc, it: { id: o.id, kind: o.kind, item: o.item, x: o.x, y: o.y, w: o.w, h: o.h, seed: o.seed, state: s } };
  }
  function layerOf(ref) { var p = String(ref).split('/'), sc = sceneById(p[0]), it = null; if (!sc) return null; (sc.layers || []).forEach(function (L) { (L.items || []).forEach(function (q) { if (!it && q.kind === p[1]) it = q; }); }); return it ? { sc: sc, it: it } : null; }
  // список «что нарисовать» и прямоугольник интереса (в координатах сцены)
  function sourceOf(spec) {
    if (spec.i) return { icon: spec.i, rect: [-32, -32, 64, 64] };
    var parts = [];
    if (spec.o) { var a = objOf(spec.o, spec.st); if (a) parts.push(a); }
    if (spec.l) { var b = layerOf(spec.l); if (b) parts.push(b); }
    if (spec.g) spec.g.forEach(function (ref, i) { var st = Array.isArray(spec.st) ? spec.st[i] : spec.st; var c = objOf(ref, st); if (c) parts.push(c); });
    if (!parts.length) return { icon: 'question', rect: [-32, -32, 64, 64] };
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    parts.forEach(function (q) { var it = q.it; x0 = Math.min(x0, it.x); y0 = Math.min(y0, it.y); x1 = Math.max(x1, it.x + it.w); y1 = Math.max(y1, it.y + (it.h || 14)); });
    var m = Math.max(14, Math.min(60, (x1 - x0 + y1 - y0) * 0.12)), npc = parts.some(function (q) { return q.it.kind === 'npc'; });
    return { parts: parts, rect: [x0 - m, y0 - m - (npc ? 30 : 0), x1 - x0 + m * 2, y1 - y0 + m * 2 + (npc ? 30 : 0)] };
  }
  function drawSource(g, src) { // рисует источник в координатах сцены (или пиктограмму вокруг 0,0)
    var L = lib(); if (!L) return;
    if (src.icon) { L.drawIconRaw(g, src.icon, 0, 0, 60); return; }
    src.parts.forEach(function (q) {
      var it = q.it, sc = { id: q.sc.id, mood: q.sc.mood, layers: [], objects: [it], hotspots: [] }, pk = L.palKey(sc), P = L.pal(sc);
      if (it.kind === 'npc') { K.themes.paper.drawNpc(g, it, (it.state && it.state.pose) || 'idle', 0.4); return; }
      if (it.kind === 'item') { L.drawIconRaw(g, it.item, it.x + it.w / 2, it.y + it.h / 2, Math.max(it.w, it.h)); return; }
      L.blit(g, L.itemSprite(it, sc, P, pk));
    });
  }

  // обрезка по фактическому рисунку: пустое небо вокруг крана или колодца не должно уменьшать сам предмет
  function cropToInk(src) {
    var r = src.rect, k = Math.min(1, 360 / Math.max(r[2], r[3])), cw = Math.ceil(r[2] * k), ch = Math.ceil(r[3] * k), c = mk(cw, ch), g = c.getContext('2d');
    g.scale(k, k); g.translate(-r[0], -r[1]); drawSource(g, src);
    var d = g.getImageData(0, 0, cw, ch).data, x0 = cw, y0 = ch, x1 = -1, y1 = -1;
    for (var y = 0; y < ch; y++) for (var x = 0; x < cw; x++) if (d[(y * cw + x) * 4 + 3] > 90) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    src.cropped = true; if (x1 < 0) return;
    var m = 4; src.rect = [r[0] + (x0 - m) / k, r[1] + (y0 - m) / k, (x1 - x0 + 2 * m) / k, (y1 - y0 + 2 * m) / k];
  }
  // ---------- перевод в тушь (попиксельно, кэш по спецификации, высоте и варианту кипения) ----------
  var GCACHE = new Map(), GAREA = 0, GMAX = 4e6;   // бюджет глифов — физические пиксели (≈16 МБ), вытеснение по LRU
  function syncRes() { var L = lib(), r = L && L.res ? L.res() : 1, ss = r > 2.05 ? 3 : 2; if (ss !== SS) { SS = ss; GCACHE.clear(); GAREA = 0; } }
  function gArea(e) { var a = 0; e.v.forEach(function (V) { a += V.lines.width * V.lines.height * 2; }); return a; }
  function specKey(spec) { return JSON.stringify(spec); }
  function glyph(spec, hgt) {
    if (HAS_DOM) syncRes();
    var key = specKey(spec) + '@' + Math.round(hgt), e = GCACHE.get(key);
    if (e) { GCACHE.delete(key); GCACHE.set(key, e); return e; }
    var src = sourceOf(spec);
    if (HAS_DOM && src.parts && !src.cropped) cropToInk(src);
    var r = src.rect, sc = hgt / r[3], gw = Math.max(8, r[2] * sc);
    e = { src: src, w: gw, h: hgt, v: [] };
    if (!HAS_DOM) { GCACHE.set(key, e); return e; }
    // 1) исходник в нужном масштабе (×SS), обрезка по фактической альфе
    var cw = Math.ceil(gw * SS), ch = Math.ceil(hgt * SS), c = mk(cw, ch), g = c.getContext('2d');
    g.scale(sc * SS, sc * SS); g.translate(-r[0], -r[1]); drawSource(g, src);
    var id = g.getImageData(0, 0, cw, ch), d = id.data, n = cw * ch, Lm = new Float32Array(n), Al = new Float32Array(n);
    for (var i = 0; i < n; i++) { var a = d[i * 4 + 3] / 255; Al[i] = a; Lm[i] = a > 0.02 ? (0.3 * d[i * 4] + 0.59 * d[i * 4 + 1] + 0.11 * d[i * 4 + 2]) / 255 : 1; }
    // тени-подложки paper (полупрозрачный тёмный край) не должны становиться штрихом
    for (var v = 0; v < 3; v++) e.v.push(inkify(cw, ch, Lm, Al, v));
    e.area = gArea(e); GCACHE.set(key, e); GAREA += e.area;
    while ((GAREA > GMAX || GCACHE.size > 260) && GCACHE.size > 1) { var k0 = GCACHE.keys().next().value; GAREA -= GCACHE.get(k0).area || 0; GCACHE.delete(k0); }
    return e;
  }
  function inkify(cw, ch, Lm, Al, v) {
    var lines = mk(cw, ch), hat = mk(cw, ch), lg = lines.getContext('2d'), hg = hat.getContext('2d');
    var ld = lg.createImageData(cw, ch), hd = hg.createImageData(cw, ch), R = rng(31 + v * 101), ph1 = Math.floor(R() * 7), ph2 = Math.floor(R() * 7);
    var ink = [30, 25, 21];
    function A(x, y) { return x < 0 || y < 0 || x >= cw || y >= ch ? 0 : Al[y * cw + x]; }
    function Lx(x, y) { x = clamp(x, 0, cw - 1); y = clamp(y, 0, ch - 1); return Lm[y * cw + x]; }
    for (var y = 0; y < ch; y++) for (var x = 0; x < cw; x++) {
      var i = y * cw + x, a = Al[i], k = i * 4; if (a < 0.45) continue;
      var nz = ((Math.sin((x >> 2) * 12.99 + (y >> 2) * 78.23 + v * 3.1) * 43758.5) % 1 + 1) % 1 * 0.1;
      var edge = A(x - 2, y) < 0.45 || A(x + 2, y) < 0.45 || A(x, y - 2) < 0.45 || A(x, y + 2) < 0.45;
      var gx = -Lx(x - 1, y - 1) - 2 * Lx(x - 1, y) - Lx(x - 1, y + 1) + Lx(x + 1, y - 1) + 2 * Lx(x + 1, y) + Lx(x + 1, y + 1);
      var gy = -Lx(x - 1, y - 1) - 2 * Lx(x, y - 1) - Lx(x + 1, y - 1) + Lx(x - 1, y + 1) + 2 * Lx(x, y + 1) + Lx(x + 1, y + 1);
      var grad = Math.sqrt(gx * gx + gy * gy);
      if (edge || grad > 0.62 + nz) { ld.data[k] = ink[0]; ld.data[k + 1] = ink[1]; ld.data[k + 2] = ink[2]; ld.data[k + 3] = edge ? 255 : Math.min(255, 120 + grad * 120); continue; }
      var dk = 1 - Lm[i];
      var h1 = ((x + y + ph1) % 7) < 1.7, h2 = ((x - y + 700 + ph2) % 7) < 1.7, on = dk > 0.86 - nz || (h1 && dk > 0.34 + nz) || (h2 && dk > 0.56 + nz);
      if (on) { hd.data[k] = ink[0]; hd.data[k + 1] = ink[1]; hd.data[k + 2] = ink[2]; hd.data[k + 3] = dk > 0.86 ? 230 : 200; }
    }
    lg.putImageData(ld, 0, 0); hg.putImageData(hd, 0, 0);
    return { lines: lines, hatch: hat };
  }
  // глиф на холсте: prog 0..1 — сколько «нарисовано» (контур ведёт перо, штриховка догоняет)
  function drawGlyph(g, gl, x, y, prog, t) {
    if (prog <= 0) return;
    if (!HAS_DOM) { var src = gl.src, r = src.rect, s = gl.h / r[3]; g.save(); g.translate(x, y); g.scale(s, s); g.translate(-r[0], -r[1]); drawSource(g, src); g.restore(); return; }
    var V = gl.v[boilV(t)] || gl.v[0], w = gl.w, h = gl.h;
    var pl = clamp(prog / 0.7, 0, 1), ph = clamp((prog - 0.4) / 0.6, 0, 1);
    function part(cv, f) { if (f <= 0) return; var sw = w * f; g.drawImage(cv, 0, 0, Math.ceil(sw * SS), cv.height, x, y, sw, h); }
    part(V.hatch, ph); part(V.lines, pl);
    if (pl < 1) REV.nib = [x + w * pl, y + h * (0.5 + 0.38 * Math.sin(pl * 31))];
  }

  // ---------- строка эскиза: глифы и знаки между ними ----------
  var OPW = { '>': 0.62, '+': 0.42, '=': 0.42, up: 0.42 };
  function layoutSeq(seq, hgt, maxW) {
    var items = (seq || []).map(function (s) {
      if (typeof s === 'string') return { op: s, w: hgt * (OPW[s] || 0.4) };
      var gl = glyph(s, hgt); if (gl.w > hgt * 2.3) gl = glyph(s, Math.max(14, Math.floor(hgt * hgt * 2.3 / gl.w)));   // длинный предмет — ниже ростом, не шире 2,3 высоты
      return { spec: s, gl: gl, w: gl.w };
    });
    var gap = hgt * 0.12, tot = items.reduce(function (a, it) { return a + it.w; }, 0) + gap * Math.max(0, items.length - 1);
    var k = tot > maxW ? maxW / tot : 1;
    if (k < 1) return layoutSeq(seq, Math.max(18, Math.floor(hgt * k)), maxW);
    return { items: items, w: tot, h: hgt, gap: gap };
  }
  function weightOf(it) { return it.op ? 0.35 : 1; }
  function drawSeq(g, lay, x, y, prog, t, seed) { // prog — общий прогресс 0..1 по всей строке
    var tw = lay.items.reduce(function (a, it) { return a + weightOf(it); }, 0), acc = 0, cx = x, h = lay.h;
    lay.items.forEach(function (it, i) {
      var w0 = weightOf(it) / tw, p = clamp((prog - acc) / w0, 0, 1); acc += w0;
      if (p > 0) {
        if (it.op) drawOp(g, it.op, cx, y, it.w, h, p, seed + i * 17);
        else {
          var gy = y + (h - it.gl.h) / 2; drawGlyph(g, it.gl, cx, gy, p, t);
          if (it.spec.c && p > 0.3) wash(g, cx + it.w / 2, y - 10, it.spec.c, seed + 30);   // цвет-метка: акварельное пятно над глифом
          if (it.spec.n && p > 0.6) for (var s = 0; s < it.spec.n; s++) pen(g, [[cx + it.w / 2 - (it.spec.n - 1) * 5 + s * 10, y - 16], [cx + it.w / 2 - (it.spec.n - 1) * 5 + s * 10 + 1, y - 4]], 2.4, seed + 40 + s, it.spec.c ? INK : VERM);
          if (it.spec.flag && p > 0.6) flag(g, cx + it.w / 2, y, it.spec.flag, seed + 60);   // ↑ поднять / ↓ опустить
          if (it.spec.mark && p >= 0.999) { var save = REV.left; REV.left = Infinity; loop(g, cx + it.w / 2, y + h / 2, it.w / 2 + h * 0.14, it.gl.h / 2 + h * 0.14, 2.6, seed + 77); REV.left = save; }
        }
      }
      cx += it.w + lay.gap;
    });
  }
  function drawOp(g, op, x, y, w, h, p, seed) {
    var save = REV.left; REV.left = (w + h) * 1.4 * p;
    var cy = y + h / 2, lw = Math.max(1.6, h * 0.035);
    if (op === '>') arrow(g, x + 2, cy, x + w - 2, cy, lw, seed);
    else if (op === '+') { pen(g, [[x + w / 2, cy - w * 0.32], [x + w / 2, cy + w * 0.32]], lw, seed); pen(g, [[x + w * 0.18, cy], [x + w * 0.82, cy]], lw, seed + 1); }
    else if (op === '=') { pen(g, [[x + w * 0.15, cy - w * 0.14], [x + w * 0.85, cy - w * 0.14]], lw, seed); pen(g, [[x + w * 0.15, cy + w * 0.14], [x + w * 0.85, cy + w * 0.14]], lw, seed + 1); }
    else if (op === 'up') arrow(g, x + w / 2, y + h * 0.85, x + w / 2, y + h * 0.15, lw, seed);
    else pen(g, [[x + w / 2, y + h * 0.2], [x + w / 2, y + h * 0.8]], lw, seed);
    REV.left = save;
  }
  function begin(prog, t) { REV.left = Infinity; REV.nib = null; REV.v = boilV(t); }

  // ---------- (а) подсказка: карточка с эскизом цели над головой героини ----------
  function hintSeq(hint) {
    var P = K.PUZZLES, p = null; if (P && hint && hint.target) P.puzzles.forEach(function (q) { if (q.id === hint.target) p = q; });
    var seq = (hint && hint.ink) || (p && p.ink) || (hint && hint.icons ? hint.icons.map(function (i) { return { i: i }; }) : [{ i: 'heart' }]);
    if (hint && hint.here === false && hint.scene) { var s = sceneById(hint.scene); if (s) seq = [{ i: 'door' }, '>', { i: s.icon, mark: true }, '|'].concat(seq.filter(function (q) { return typeof q === 'string' || !q.mark; }).slice(0, 3)); }
    if (!hint || !hint.target) seq = [{ i: 'heart', mark: true }];
    return seq;
  }
  function drawHint(ctx, x, y, hint, t, opts) {
    opts = opts || {}; var age = opts.age == null ? 9 : opts.age, seq = hintSeq(hint);
    var lay = layoutSeq(seq, 60, 640), cw = lay.w + 56, chh = lay.h + 54;
    var cx = clamp(x - cw / 2 + 30, 10, W - cw - 10), cy = clamp(y - chh - 14, 8, 300);
    var prog = anim() ? clamp((age - 0.15) / 1.8, 0, 1) : 1;
    begin(prog, t);
    ctx.save();
    for (var i = 0; i < 3; i++) { var f = (i + 1) / 4; ctx.beginPath(); ctx.arc(x + (cx + cw / 2 - x) * f * 0.3, y + 6 - (y + 6 - (cy + chh)) * f, 2.5 + i * 1.6, 0, TAU); ctx.fillStyle = IVORY; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.stroke(); }
    sheet(ctx, cx, cy, cw, chh, 5, true);
    blot(ctx, cx + cw - 14, cy + 12, 2.2); // клякса — «рисовано пером»
    drawSeq(ctx, lay, cx + 28, cy + 30, prog, t, 900);
    pen(ctx, [[cx + 22, cy + chh - 14], [cx + cw - 22, cy + chh - 12]], 1, 931); // линия-«земля» эскиза
    if (prog < 1 && anim()) nib(ctx, REV.nib);
    ctx.restore();
  }

  // ---------- (в) мысль тушью (мастер в кат-сценах) ----------
  function drawInkThought(ctx, x, y, icons, t, opts) {
    opts = opts || {}; var age = opts.age == null ? 9 : opts.age;
    var seq = []; (icons && icons.length ? icons : ['question']).forEach(function (id, i) { if (i) seq.push(i === icons.length - 1 && icons.length > 1 ? '>' : '+'); seq.push({ i: id }); });
    var lay = layoutSeq(seq, 70, 700), cw = lay.w + 60, chh = lay.h + 50;
    var cx = clamp(x - 20, 10, W - cw - 10), cy = clamp(y - chh - 26, 8, 320);
    var prog = anim() ? clamp((age - 0.1) / 1.3, 0, 1) : 1;
    begin(prog, t);
    ctx.save();
    for (var i = 0; i < 3; i++) { var f = (i + 1) / 4; ctx.beginPath(); ctx.arc(x + (cx + 30 - x) * f, y - (y - (cy + chh)) * f, 2.5 + i * 1.8, 0, TAU); ctx.fillStyle = IVORY; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.stroke(); }
    var p = sheet(ctx, cx, cy, cw, chh, 9, true);
    // лист из блокнота мастера: перфорация сверху
    for (var k = 0; k < Math.floor(cw / 18); k++) { ctx.beginPath(); ctx.arc(cx + 12 + k * 18, cy + 7, 2.2, 0, TAU); ctx.fillStyle = 'rgba(60,40,20,0.35)'; ctx.fill(); }
    drawSeq(ctx, lay, cx + 30, cy + 28, prog, t, 1200);
    if (prog < 1 && anim()) nib(ctx, REV.nib);
    ctx.restore();
    return p;
  }

  // ---------- (б) блокнот: разворот, шаг на страницу ----------
  function drawWalkbook(ctx, wk, L, t) {
    var Wk = L.walk, per = wk.per || 2, steps = (wk.steps || []).slice(wk.page * per, wk.page * per + per), now = wk.time == null ? t : wk.time;
    begin(1, t);
    ctx.save();
    var lp = Wk.pages ? Wk.pages[0] : { x: 96, y: 70, w: 384, h: 412 }, rp = Wk.pages ? Wk.pages[1] : { x: 480, y: 70, w: 384, h: 412 };
    if (!BOOK && HAS_DOM) { BOOK = mk(W, H); bookBase(BOOK.getContext('2d'), lp, rp, t); }
    if (BOOK) ctx.drawImage(BOOK, 0, 0); else bookBase(ctx, lp, rp, t);   // разворот (стол, обложка, листы) — один раз в кэш
    [lp, rp].forEach(function (pg, i) { var s = steps[i]; if (s) drawStepPage(ctx, pg, s, now, t, wk, i); else drawBlankPage(ctx, pg, t, i); });
    // перелистывание: лист проходит над разворотом
    if (wk.flip && now - wk.flip.t < 0.4) {
      var f = (now - wk.flip.t) / 0.4, d = wk.flip.d, ex = d > 0 ? rp.x + rp.w * (1 - 2 * f) : lp.x + lp.w * (2 * f), x0 = rp.x;
      var pts = d > 0 ? [[x0, rp.y], [ex, rp.y - 12 * Math.sin(f * Math.PI)], [ex, rp.y + rp.h + 8 * Math.sin(f * Math.PI)], [x0, rp.y + rp.h]] : [[x0, lp.y], [ex, lp.y - 12 * Math.sin(f * Math.PI)], [ex, lp.y + lp.h + 8 * Math.sin(f * Math.PI)], [x0, lp.y + lp.h]];
      ctx.save(); poly(ctx, pts); ctx.fillStyle = paperFill(ctx); ctx.fill(); ctx.fillStyle = 'rgba(80,55,30,' + (0.25 * Math.sin(f * Math.PI)) + ')'; ctx.fill(); ctx.strokeStyle = 'rgba(40,25,10,0.4)'; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
    }
    // навигация пером: стрелки, закрыть, точки разворотов
    if (wk.page > 0) inkButton(ctx, Wk.prev, 'prev', t);
    if (wk.page < wk.pages - 1) inkButton(ctx, Wk.next, 'next', t);
    inkButton(ctx, Wk.close, 'close', t);
    for (var p = 0; p < wk.pages; p++) { var px = 480 - (wk.pages - 1) * 9 + p * 18; ctx.beginPath(); ctx.arc(px, 514, p === wk.page ? 5 : 3.5, 0, TAU); ctx.fillStyle = p === wk.page ? IVORY : 'rgba(241,232,207,0.35)'; ctx.fill(); }
    ctx.restore();
  }
  var BOOK = null;
  function bookBase(ctx, lp, rp, t) {
    begin(1, 0);
    ctx.fillStyle = '#2e2620'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#5a3a26'; ctx.beginPath(); ctx.rect(lp.x - 14, lp.y - 12, lp.w + rp.w + 28, lp.h + 26); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(lp.x - 14, lp.y + lp.h + 10, lp.w + rp.w + 28, 6);
    for (var s2 = 3; s2 > 0; s2--) { sheet(ctx, lp.x - s2 * 2, lp.y + s2, lp.w, lp.h, 40 + s2, false); sheet(ctx, rp.x + s2 * 2, rp.y + s2, rp.w, rp.h, 50 + s2, false); }
    sheet(ctx, lp.x, lp.y, lp.w, lp.h, 61, false); sheet(ctx, rp.x, rp.y, rp.w, rp.h, 62, false);
    var gr = ctx.createLinearGradient(rp.x - 30, 0, rp.x + 30, 0); gr.addColorStop(0, 'rgba(80,55,30,0)'); gr.addColorStop(0.5, 'rgba(80,55,30,0.35)'); gr.addColorStop(1, 'rgba(80,55,30,0)');
    ctx.fillStyle = gr; ctx.fillRect(rp.x - 30, rp.y, 60, rp.h);
    for (var st = 0; st < 9; st++) { var sy = lp.y + 24 + st * (lp.h - 48) / 8; pen(ctx, [[rp.x - 3, sy], [rp.x + 3, sy + 6]], 1.4, 70 + st, '#7a5a3a'); } // нитяной переплёт
    [lp, rp].forEach(function (pg) { ctx.save(); ctx.strokeStyle = 'rgba(110,140,150,0.16)'; ctx.lineWidth = 1; for (var gy = pg.y + 30; gy < pg.y + pg.h - 10; gy += 22) { ctx.beginPath(); ctx.moveTo(pg.x + 14, gy); ctx.lineTo(pg.x + pg.w - 14, gy); ctx.stroke(); } ctx.restore(); });
  }
  function inkButton(ctx, b, kind, t) {
    begin(1, t); ctx.save();
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fillStyle = paperFill(ctx); ctx.fill();
    pen(ctx, ell(b.x, b.y, b.r - 1, b.r - 1, 24, 0, TAU * 1.02), 1.8, 81);
    if (kind === 'close') { pen(ctx, [[b.x - 8, b.y - 8], [b.x + 8, b.y + 8]], 2.6, 82, VERM); pen(ctx, [[b.x + 8, b.y - 8], [b.x - 8, b.y + 8]], 2.6, 83, VERM); }
    else { var d = kind === 'next' ? 1 : -1; arrow(ctx, b.x - d * 11, b.y + 2, b.x + d * 11, b.y, 2.4, 84); }
    ctx.restore();
  }
  function stepAt(sid) { var r = -1; (K.PUZZLES ? K.PUZZLES.puzzles : []).forEach(function (p, i) { if (p.id === sid) r = i; }); return r; }
  function drawStepPage(ctx, pg, s, now, t, wk, side) {
    var x = pg.x, y = pg.y, w = pg.w, h = pg.h, seed = 300 + stepAt(s.id) * 13;
    // штамп сцены — круг с её пиктограммой (или «сумка» для комбинаций в инвентаре)
    var sIc = s.scene ? (sceneById(s.scene) || {}).icon : null;
    begin(1, t);
    pen(ctx, ell(x + 40, y + 40, 24, 24, 24, 0, TAU * 1.03), 1.6, seed);
    if (sIc) drawGlyph(ctx, glyph({ i: sIc }, 34), x + 40 - glyph({ i: sIc }, 34).w / 2, y + 23, 1, t);
    else { pen(ctx, [[x + 26, y + 32], [x + 54, y + 32], [x + 50, y + 54], [x + 30, y + 54], [x + 26, y + 32]], 1.8, seed + 2); pen(ctx, [[x + 32, y + 32], [x + 40, y + 22], [x + 48, y + 32]], 1.6, seed + 3); }
    // порядковый номер шага — засечки по пять (без цифр)
    var no = stepAt(s.id) + 1;
    for (var k = 0; k < no; k++) { var gx = x + 80 + Math.floor(k / 5) * 26 + (k % 5) * 4; if (k % 5 === 4) pen(ctx, [[gx - 18, y + 46], [gx + 2, y + 30]], 1.1, seed + 50 + k); else pen(ctx, [[gx, y + 30], [gx, y + 48]], 1.1, seed + 50 + k); }
    // эскиз шага
    var seq = s.ink || (s.icons || []).slice(1).map(function (i) { return { i: i }; });
    var opened = wk.flip ? now - wk.flip.t : (wk.open != null ? now - wk.open : 9);
    var prog = s.current && anim() ? clamp((opened - 0.3 - side * 0.2) / 1.8, 0, 1) : 1;
    var lay = layoutSeq(seq, 120, w - 40);
    if (lay.h < 96 && seq.length > 3) { // длинная запись — в две строки
      var cut = Math.ceil(seq.length / 2); while (cut < seq.length && typeof seq[cut] !== 'string') cut++;
      var a = layoutSeq(seq.slice(0, cut), 100, w - 40), b = layoutSeq(seq.slice(cut), 100, w - 40);
      begin(prog, t);
      drawSeq(ctx, a, x + (w - a.w) / 2, y + 90, Math.min(1, prog * 2), t, seed + 100);
      drawSeq(ctx, b, x + (w - b.w) / 2, y + 90 + a.h + 46, Math.max(0, prog * 2 - 1), t, seed + 200);
    } else { begin(prog, t); drawSeq(ctx, lay, x + (w - lay.w) / 2, y + h / 2 - lay.h / 2 + 10, prog, t, seed + 100); }
    if (prog < 1 && anim()) nib(ctx, REV.nib);
    begin(1, t);
    // отметки: пройдено — печать-галочка киноварью; текущий — киноварный уголок «сейчас»
    if (s.done) { ctx.save(); ctx.globalAlpha = 0.85; pen(ctx, ell(x + w - 46, y + h - 44, 26, 26, 26, 0, TAU * 1.02), 2.2, seed + 7, VERM); pen(ctx, [[x + w - 60, y + h - 44], [x + w - 49, y + h - 32], [x + w - 30, y + h - 58]], 3.2, seed + 8, VERM); ctx.restore(); }
    else if (s.current) { pen(ctx, [[x + w - 34, y + 14], [x + w - 14, y + 14], [x + w - 14, y + 34]], 3, seed + 9, VERM); blot(ctx, x + w - 24, y + 24, 2); }
  }
  function drawBlankPage(ctx, pg, t, side) { // пустая страница: следующий шаг ещё не открыт — только бледный набросок маяка
    var x = pg.x, y = pg.y, w = pg.w, h = pg.h; begin(1, t); ctx.save(); ctx.globalAlpha = 0.28;
    var cx = x + w / 2, by = y + h * 0.7;
    pen(ctx, [[cx - 26, by], [cx - 16, by - 120], [cx + 16, by - 120], [cx + 26, by]], 1.6, 501);
    pen(ctx, [[cx - 20, by - 120], [cx, by - 146], [cx + 20, by - 120]], 1.6, 502);
    pen(ctx, [[cx - 90, by + 6], [cx + 90, by + 4]], 1.2, 503);
    ctx.restore();
  }

  // ---------- подключение к теме paper ----------
  var api = { anim: anim, setAnim: setAnim, drawHint: drawHint, drawWalkbook: drawWalkbook, drawInkThought: drawInkThought, glyph: glyph, hintSeq: hintSeq, sourceOf: sourceOf, KEY: KEY,
    cacheStats: function () { return { glyphs: GCACHE.size, px: GAREA, mb: +(GAREA * 4 / 1048576).toFixed(1), ss: SS }; },
    setCacheBudget: function (px) { GMAX = Math.max(1e6, +px || GMAX); return GMAX; } };
  K.InkSketch = api;
  function attach(th) {
    if (!th || th._inkAttached) return; th._inkAttached = true;
    var base = th.drawThought;
    th.drawHint = function (ctx, x, y, hint, t, opts) { drawHint(ctx, x, y, hint, t, opts); };
    th.drawWalkbook = function (ctx, walk, layout, t) { drawWalkbook(ctx, walk, layout, t); };
    th.drawThought = function (ctx, x, y, icons, t, opts) { if (opts && opts.style === 'ink') return drawInkThought(ctx, x, y, icons, t, opts); return base.call(th, ctx, x, y, icons, t, opts); };
  }
  attach(K.themes && K.themes.paper);
})(typeof window !== 'undefined' ? window : globalThis);
