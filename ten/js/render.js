/* ТЕНЬ · render.js — отрисовка обеих тем одним модулем (ветвление по теме).
   modern — векторная графика с градиентами и мягким светом; retro — тот же кадр рисуется в буфер 320×180 и растягивается ×2
   без сглаживания (крупный «пиксель», палитра 8-бит приставки). Камера с упреждением, параллакс (два слоя),
   кэш клеток и фонов по (акт, тема). TEN.R — примитивы (героиня, враги, боссы, слайды кат-сцен) для титула и main.js. */
(function (global) {
  'use strict';
  var TEN = global.TEN, L = TEN.logic, T = L.T, C = L.C, K = L.K;
  var VW = 640, VH = 360;

  // ---------- палитры ----------
  // retro: 8-бит приставочная палитра
  var E = { k: '#000000', d: '#3c3c3c', g: '#7c7c7c', l: '#bcbcbc', w: '#fcfcfc', G: '#005800', Gm: '#00a844', Gl: '#58d854',
    r: '#a81000', R: '#e45c10', o: '#f87858', y: '#f8b800', Y: '#fce0a8', b: '#0000bc', B: '#0078f8', c: '#3cbcfc',
    p: '#940084', P: '#d800cc', n: '#503000', N: '#ac7c00', t: '#004058', T: '#008888' };
  var AM = [ // modern: акты
    { sky: ['#0b1424', '#1d2741', '#4a3550'], far: '#18203a', farHi: '#f2c46b', mid: '#121a2e', fill: '#2b2f3c', fill2: '#262a36', line: '#3a3f4f', top: '#c0703c', top2: '#7a4428', plat: '#9c6a3a', glow: '#ffcf7a' },
    { sky: ['#1a0d0a', '#3a1a12', '#6a2c16'], far: '#2a1410', farHi: '#ff8a3a', mid: '#20100c', fill: '#3d2a24', fill2: '#37251f', line: '#56392e', top: '#b98a52', top2: '#6f4a2a', plat: '#a07444', glow: '#ff9a4a' },
    { sky: ['#06121c', '#0e2638', '#28485a'], far: '#0e2230', farHi: '#d8e8ff', mid: '#0a1822', fill: '#2c3842', fill2: '#28333c', line: '#3c4a56', top: '#e3b236', top2: '#6a5a2a', plat: '#8a9aa6', glow: '#ffe08a' },
    { sky: ['#2a3a66', '#8a6a8e', '#f0a878'], far: '#b48aa0', farHi: '#fff0d8', mid: '#7a5e80', fill: '#5a4030', fill2: '#523a2c', line: '#6e4e3a', top: '#c9a043', top2: '#7a5a2a', plat: '#b08a5a', glow: '#ffe2b0' },
    { sky: ['#0e140e', '#1c2a1c', '#3a3a22'], far: '#1e281c', farHi: '#d9a441', mid: '#141c12', fill: '#3a3424', fill2: '#342e20', line: '#4e4630', top: '#d9a441', top2: '#7a5a22', plat: '#b0883c', glow: '#ffd27a' },
    { sky: ['#0c0814', '#1e1230', '#3c1a2e'], far: '#1a1228', farHi: '#ff5a5a', mid: '#120c1c', fill: '#24222c', fill2: '#201e28', line: '#36323f', top: '#b0343a', top2: '#5a1a22', plat: '#7a7484', glow: '#ff7a7a' }
  ];
  var AR = [
    { sky: [E.k, E.k, E.b], far: E.b, farHi: E.y, mid: E.k, fill: E.d, fill2: E.d, line: E.k, top: E.R, top2: E.r, plat: E.N, glow: E.y },
    { sky: [E.k, E.k, E.r], far: E.r, farHi: E.R, mid: E.k, fill: E.n, fill2: E.n, line: E.k, top: E.N, top2: E.n, plat: E.N, glow: E.R },
    { sky: [E.k, E.t, E.t], far: E.t, farHi: E.w, mid: E.k, fill: E.d, fill2: E.d, line: E.k, top: E.y, top2: E.N, plat: E.l, glow: E.y },
    { sky: [E.B, E.c, E.o], far: E.l, farHi: E.w, mid: E.g, fill: E.n, fill2: E.n, line: E.k, top: E.N, top2: E.n, plat: E.N, glow: E.Y },
    { sky: [E.k, E.k, E.n], far: E.n, farHi: E.N, mid: E.k, fill: E.n, fill2: E.n, line: E.k, top: E.y, top2: E.N, plat: E.N, glow: E.y },
    { sky: [E.k, E.p, E.k], far: E.d, farHi: E.o, mid: E.k, fill: E.d, fill2: E.d, line: E.k, top: E.r, top2: E.k, plat: E.g, glow: E.o }
  ];
  function pal(a, rt) { return (rt ? AR : AM)[Math.max(0, Math.min(5, (a || 1) - 1))]; }
  // героиня: тёмно-зелёный плащ с капюшоном, серп на тросе (медь + сталь)
  var HM = { cloak: '#2f5e3d', cloakHi: '#4f8a5c', cloakLo: '#1b3424', hood: '#24482f', face: '#d9b494', shade: '#16261b', eye: '#ffcf5a', boot: '#2a2420', leg: '#23302a', belt: '#c9a043', blade: '#dfe5ec', bladeHi: '#ffffff', handle: '#9a6a32', cable: '#b89a64' };
  var HR = { cloak: E.G, cloakHi: E.Gm, cloakLo: E.k, hood: E.G, face: E.Y, shade: E.k, eye: E.y, boot: E.n, leg: E.k, belt: E.N, blade: E.l, bladeHi: E.w, handle: E.N, cable: E.N };
  // Синдикат: ржавое железо + холодные глаза
  var XM = { rust: '#8a3b26', rustHi: '#b85a34', rustLo: '#5a2416', iron: '#4a4e58', ironHi: '#7a808c', eye: '#7fe3ff', red: '#ff4a3a', brass: '#c9a043', dark: '#1a1416', glass: '#ffe9a8' };
  var XR = { rust: E.r, rustHi: E.R, rustLo: E.n, iron: E.d, ironHi: E.g, eye: E.c, red: E.R, brass: E.N, dark: E.k, glass: E.Y };

  function circ(ctx, x, y, r, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
  function ell(ctx, x, y, rx, ry, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); }
  function rect(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }
  function poly(ctx, pts, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (var i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.closePath(); ctx.fill(); }
  function line(ctx, x0, y0, x1, y1, c, w) { ctx.strokeStyle = c; ctx.lineWidth = w || 1; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); }
  function mk(w, h) { var c = (typeof document !== 'undefined') ? document.createElement('canvas') : null; if (!c) return null; c.width = w; c.height = h; return c; }
  function hash(a, b) { var h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

  // ---------- клетки ----------
  var tileCache = {};
  // retro: спрайты 8×8 — в буфере 320×180 ложатся пиксель в пиксель
  function tilesRetro(a) {
    var p = pal(a, true), S = {};
    function sp(name, fn) { var c = mk(8, 8); if (!c) return; var x = c.getContext('2d'); fn(x); S[name] = c; }
    function base(x, v) {
      x.fillStyle = p.fill; x.fillRect(0, 0, 8, 8); x.fillStyle = p.line;
      if (a === 3) { x.fillRect(0, 0, 1, 8); x.fillRect(7, 0, 1, 8); for (var i = 0; i < 6; i++) x.fillRect(v ? 1 + i : 6 - i, 1 + i, 1, 1); }
      else if (a === 2 || a === 5) { x.fillRect(0, 0, 8, 1); x.fillRect(0, 0, 1, 8); x.fillStyle = p.top2; x.fillRect(2, 2, 1, 1); x.fillRect(5, 5, 1, 1); }
      else if (a === 4) { x.fillRect(0, 2, 8, 1); x.fillRect(0, 5, 8, 1); x.fillRect(v ? 3 : 6, 0, 1, 2); x.fillRect(v ? 1 : 4, 3, 1, 2); }
      else { x.fillRect(0, 3, 8, 1); x.fillRect(0, 7, 8, 1); x.fillRect(v ? 1 : 5, 0, 1, 3); x.fillRect(v ? 5 : 1, 4, 1, 3); }
    }
    sp('f0', function (x) { base(x, 0); }); sp('f1', function (x) { base(x, 1); });
    function trim(x) { x.fillStyle = p.top; x.fillRect(0, 0, 8, 2); x.fillStyle = p.top2; x.fillRect(0, 2, 8, 1); if (a === 3) { x.fillStyle = E.k; x.fillRect(1, 0, 2, 2); x.fillRect(5, 0, 2, 2); } }
    sp('t0', function (x) { base(x, 0); trim(x); }); sp('t1', function (x) { base(x, 1); trim(x); });
    sp('side', function (x) { x.fillStyle = E.k; x.fillRect(0, 0, 1, 8); });
    sp('plat', function (x) { x.fillStyle = p.plat; x.fillRect(0, 0, 8, 2); x.fillStyle = p.line; x.fillRect(0, 2, 8, 1); x.fillRect(1, 3, 1, 2); x.fillRect(6, 3, 1, 2); });
    sp('spike', function (x) { x.fillStyle = E.l; for (var i = 0; i < 2; i++) { x.fillRect(i * 4 + 1, 3, 2, 5); x.fillRect(i * 4 + 1.5, 2, 1, 1); x.fillRect(i * 4, 6, 4, 2); } x.fillStyle = E.R; x.fillRect(0, 7, 8, 1); });
    return S;
  }
  function tiles(a, rt) {
    var key = a + (rt ? 'r' : 'm'); if (tileCache[key]) return tileCache[key];
    if (rt) return (tileCache[key] = tilesRetro(a));
    var p = pal(a, rt), S = {};
    function sp(name, fn) { var c = mk(T, T); if (!c) return; var x = c.getContext('2d'); fn(x); S[name] = c; }
    function base(x, v) {
      x.fillStyle = v ? p.fill2 : p.fill; x.fillRect(0, 0, T, T); x.fillStyle = p.line;
      if (a === 1 || a === 6) { x.fillRect(0, 7, T, 1); x.fillRect(0, 15, T, 1); x.fillRect(v ? 3 : 11, 0, 1, 7); x.fillRect(v ? 11 : 3, 8, 1, 7); }       // кладка
      else if (a === 2) { x.fillRect(0, 0, T, 1); x.fillRect(0, 0, 1, T); x.fillStyle = p.top2; x.fillRect(3, 3, 1, 1); x.fillRect(12, 3, 1, 1); x.fillRect(3, 12, 1, 1); x.fillRect(12, 12, 1, 1); } // клёпаные листы
      else if (a === 3) { x.fillRect(0, 0, 2, T); x.fillRect(14, 0, 2, T); x.strokeStyle = p.line; x.lineWidth = 1.5; x.beginPath(); if (v) { x.moveTo(2, 0); x.lineTo(14, T); } else { x.moveTo(14, 0); x.lineTo(2, T); } x.stroke(); } // фермы
      else if (a === 4) { x.fillRect(0, 4, T, 1); x.fillRect(0, 10, T, 1); x.fillRect(v ? 6 : 12, 0, 1, 4); x.fillRect(v ? 2 : 9, 5, 1, 5); x.fillRect(v ? 12 : 5, 11, 1, 5); } // доски
      else { x.fillRect(0, 0, T, 1); x.fillRect(0, 8, T, 1); x.fillStyle = p.top2; x.fillRect(v ? 4 : 10, 3, 2, 2); }   // латунь
      if (!rt) { x.fillStyle = 'rgba(255,255,255,.04)'; x.fillRect(0, 0, T, 2); x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(0, T - 2, T, 2); }
    }
    sp('f0', function (x) { base(x, 0); }); sp('f1', function (x) { base(x, 1); });
    function trim(x) { x.fillStyle = p.top; x.fillRect(0, 0, T, 3); x.fillStyle = p.top2; x.fillRect(0, 3, T, 2); if (!rt) { x.fillStyle = 'rgba(255,255,255,.28)'; x.fillRect(0, 0, T, 1); } if (a === 3) { x.fillStyle = rt ? E.k : '#2a2a2a'; x.fillRect(2, 0, 3, 3); x.fillRect(10, 0, 3, 3); } }
    sp('t0', function (x) { base(x, 0); trim(x); }); sp('t1', function (x) { base(x, 1); trim(x); });
    sp('side', function (x) { x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(0, 0, 2, T); });
    sp('plat', function (x) { x.fillStyle = p.plat; x.fillRect(0, 0, T, 4); x.fillStyle = p.line; x.fillRect(0, 4, T, 1); x.fillRect(2, 5, 2, 4); x.fillRect(12, 5, 2, 4); if (!rt) { x.fillStyle = 'rgba(255,255,255,.3)'; x.fillRect(0, 0, T, 1); } });
    sp('spike', function (x) { x.fillStyle = rt ? E.l : '#aab2bc'; for (var i = 0; i < 4; i++) { x.beginPath(); x.moveTo(i * 4, T); x.lineTo(i * 4 + 2, 5); x.lineTo(i * 4 + 4, T); x.fill(); } x.fillStyle = rt ? E.R : '#c0582c'; x.fillRect(0, T - 3, T, 3); });
    return (tileCache[key] = S);
  }

  // ---------- фоны актов ----------
  var bgCache = {};
  function bgLayers(a, rt) {
    var key = a + (rt ? 'r' : 'm'); if (bgCache[key]) return bgCache[key];
    var p = pal(a, rt), sky = mk(VW, VH), far = mk(1280, VH), mid = mk(1024, VH);
    if (!sky) return null;
    var s = sky.getContext('2d');
    if (rt) { var bands = p.sky; for (var i = 0; i < 3; i++) { s.fillStyle = bands[i]; s.fillRect(0, i * VH / 3, VW, VH / 3 + 1); } }
    else { var g = s.createLinearGradient(0, 0, 0, VH); g.addColorStop(0, p.sky[0]); g.addColorStop(0.55, p.sky[1]); g.addColorStop(1, p.sky[2]); s.fillStyle = g; s.fillRect(0, 0, VW, VH); }
    // звёзды/луна/облака
    if (a === 1 || a === 3 || a === 6) { for (i = 0; i < 70; i++) { s.fillStyle = rt ? E.w : 'rgba(255,255,255,' + (0.3 + hash(i, 3) * 0.6) + ')'; s.fillRect(Math.floor(hash(i, 1) * VW), Math.floor(hash(i, 2) * VH * 0.6), 1, 1); } }
    if (a === 1 || a === 3) { circ(s, 520, 64, 22, rt ? E.Y : '#f3e6c4'); circ(s, 528, 58, 20, p.sky[0]); }
    if (a === 4) for (i = 0; i < 9; i++) { var cx = hash(i, 5) * VW, cy = 60 + hash(i, 6) * 140; ell(s, cx, cy, 70 + hash(i, 7) * 60, 14 + hash(i, 8) * 8, rt ? E.w : 'rgba(255,240,230,.35)'); }
    var f = far.getContext('2d'), m = mid.getContext('2d');
    var x, w, h, k;
    if (a === 1) { // крыши предместья, вдали — цитадель
      f.fillStyle = p.far; poly(f, [880, VH, 880, 150, 900, 150, 900, 110, 930, 110, 930, 150, 980, 150, 980, 90, 1000, 70, 1020, 90, 1020, 150, 1070, 150, 1070, 120, 1090, 120, 1090, VH], p.far);
      for (x = 0; x < 1280; x += 40 + Math.floor(hash(x, 1) * 30)) { h = 60 + hash(x, 2) * 90; w = 40 + hash(x, 3) * 50; if (x > 860 && x < 1100) continue;
        poly(f, [x, VH, x, VH - h, x + w / 2, VH - h - 20, x + w, VH - h, x + w, VH], p.far);
        rect(f, x + w * 0.7, VH - h - 26, 6, 18, p.far);
        for (k = 0; k < 4; k++) if (hash(x, k + 9) < 0.45) rect(f, x + 6 + k * 9, VH - h + 14 + (k % 2) * 16, 3, 4, p.farHi); }
      for (x = 0; x < 1024; x += 64) { h = 40 + hash(x, 4) * 50; rect(m, x, VH - h, 60, h, p.mid); rect(m, x + 20, VH - h - 30, 3, 30, p.mid); poly(m, [x + 36, VH - h, x + 36, VH - h - 26, x + 50, VH - h - 26, x + 50, VH - h], p.mid); }
    } else if (a === 2) { // котлы, трубы, топки
      for (x = 0; x < 1280; x += 160) { var bx = x + hash(x, 1) * 40; rect(f, bx, 80, 90, VH - 80, p.far); ell(f, bx + 45, 80, 45, 16, p.far); circ(f, bx + 45, 230, 14, p.farHi); circ(f, bx + 45, 230, 8, rt ? E.y : '#ffd27a'); rect(f, bx + 70, 0, 10, 80, p.far); }
      for (x = 0; x < 1280; x += 40) rect(f, x, 40 + (x % 120 === 0 ? 0 : 6), 40, 6, p.far);
      for (x = 0; x < 1024; x += 128) { rect(m, x, 0, 12, VH, p.mid); rect(m, x + 40, VH - 120, 70, 4, p.mid); for (k = 0; k < 6; k++) rect(m, x + 40 + k * 14, VH - 120, 2, 120, p.mid); }
    } else if (a === 3) { // верфь: мачты и дирижабли
      for (x = 0; x < 1280; x += 320) { var ax = x + 60 + hash(x, 2) * 80; ell(f, ax + 90, 90 + hash(x, 3) * 40, 100, 30, p.far); rect(f, ax + 70, 120 + hash(x, 3) * 40, 40, 12, p.far); rect(f, ax + 200, 70, 6, VH - 70, p.far); for (k = 0; k < 8; k++) line(f, ax + 200, 80 + k * 30, ax + 206, 95 + k * 30, p.farHi, 1); }
      for (x = 0; x < 1024; x += 256) { rect(m, x, 60, 8, VH - 60, p.mid); rect(m, x, 60, 140, 8, p.mid); rect(m, x + 120, 68, 2, 60, p.mid); rect(m, x + 114, 128, 14, 10, p.mid); }
    } else if (a === 4) { // небо: облачные банки, далёкий дирижабль
      ell(f, 900, 120, 160, 40, p.far); rect(f, 860, 158, 70, 16, p.far); for (k = 0; k < 6; k++) line(f, 820 + k * 30, 150, 870 + k * 8, 160, p.far, 1);
      for (x = 0; x < 1280; x += 90) ell(f, x, VH - 30 + hash(x, 1) * 20, 80, 40, rt ? E.w : 'rgba(255,240,236,.55)');
      for (x = 0; x < 1024; x += 70) ell(m, x, VH - 10 + hash(x, 2) * 16, 70, 40, rt ? E.l : 'rgba(255,255,255,.7)');
    } else if (a === 5) { // часовой архив: шестерни и стеллажи
      for (x = 0; x < 1280; x += 220) { var gx = x + 100, gy = 120 + hash(x, 1) * 120, gr = 60 + hash(x, 2) * 40; gear(f, gx, gy, gr, p.far, Math.max(10, Math.round(gr / 6))); circ(f, gx, gy, gr * 0.35, p.sky[1]); }
      for (x = 0; x < 1024; x += 160) { rect(m, x, 0, 10, VH, p.mid); for (k = 0; k < 6; k++) rect(m, x + 10, 40 + k * 50, 120, 4, p.mid); }
    } else { // башня прожекторов: фермы, грозовые тучи, красные огни
      for (x = 0; x < 1280; x += 100) ell(f, x, 40 + hash(x, 1) * 30, 90, 30, p.far);
      for (x = 0; x < 1280; x += 200) { rect(f, x + 60, 100, 14, VH, p.far); for (k = 0; k < 7; k++) line(f, x + 60, 100 + k * 36, x + 74, 118 + k * 36, p.sky[0], 2); circ(f, x + 67, 96, 4, p.farHi); }
      for (x = 0; x < 1024; x += 256) { rect(m, x, 0, 16, VH, p.mid); rect(m, x, 200, 120, 6, p.mid); circ(m, x + 8, 190, 3, rt ? E.R : '#ff4a4a'); }
    }
    return (bgCache[key] = { sky: sky, far: far, mid: mid });
  }
  function gear(ctx, x, y, r, c, n) {
    ctx.fillStyle = c; ctx.beginPath();
    for (var i = 0; i < n * 2; i++) { var a = i / (n * 2) * Math.PI * 2, rr = i % 2 ? r : r * 0.84; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    ctx.closePath(); ctx.fill();
  }

  // ---------- частицы ----------
  var FX = { list: [],
    add: function (x, y, o) { o = o || {}; var n = o.n || 8; for (var i = 0; i < n; i++) { var a = o.a != null ? o.a + (Math.random() - 0.5) * (o.spread || 1) : Math.random() * Math.PI * 2, sp = (o.sp || 100) * (0.4 + Math.random() * 0.8);
      this.list.push({ x: x, y: y, vx: Math.cos(a) * sp + (o.vx || 0), vy: Math.sin(a) * sp, life: o.life || 0.5, t: o.life || 0.5, c: o.c || '#fff', r: o.r || 2, g: o.g != null ? o.g : 300, puff: !!o.puff }); }
      if (this.list.length > 400) this.list.splice(0, this.list.length - 400); },
    step: function (dt) { this.list = this.list.filter(function (p) { p.t -= dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.puff) { p.vx *= 0.94; p.r += dt * 6; } return p.t > 0; }); },
    draw: function (ctx) { this.list.forEach(function (p) { ctx.globalAlpha = Math.max(0, p.t / p.life) * (p.puff ? 0.5 : 1); ctx.fillStyle = p.c; if (p.puff) { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); } else ctx.fillRect(p.x - p.r / 2, p.y - p.r / 2, p.r, p.r); }); ctx.globalAlpha = 1; },
    clear: function () { this.list = []; }
  };

  // ---------- героиня ----------
  // o: { face, state, runT, atk (0..1, 0 = нет), t, inv, smoke, rt, scale }
  function hero(ctx, x, y, o) {
    var c = o.rt ? HR : HM, f = o.face || 1, st = o.state || 'idle', t = o.t || 0, sc = o.scale || 1;
    ctx.save(); ctx.translate(x, y); ctx.scale(f * sc, sc);
    if (o.smoke) ctx.globalAlpha = 0.35 + 0.15 * Math.sin(t * 20);
    else if (o.inv && Math.floor(t * 20) % 2 === 0) ctx.globalAlpha = 0.45;
    var run = Math.sin(o.runT || 0), flut = st === 'run' ? 3 + run * 1.5 : st === 'air' || st === 'swing' ? 4 : 1 + Math.sin(t * 3) * 0.7;
    if (st === 'slide' || st === 'crouch') {
      poly(ctx, [-9 - flut, -2, -6, -11, 4, -12, 8, -3, 6, 0, -9, 0], c.cloak);
      poly(ctx, [-9 - flut, -2, -6, -6, -2, -1], c.cloakLo);
      circ(ctx, 5, -11, 4.5, c.hood); ell(ctx, 7, -10.5, 2, 2.2, c.shade); rect(ctx, 7, -11.5, 1.5, 1, c.eye);
      rect(ctx, st === 'slide' ? 2 : -3, -2, 7, 2, c.boot);
      sickle(ctx, c, 6, -6, 0.6, 0.8);
      ctx.restore(); return;
    }
    if (st === 'cling') { // спиной к стене (стена позади, x<0), одно колено поднято
      rect(ctx, -5, -9, 3, 7, c.leg); rect(ctx, -6, -3, 4, 3, c.boot); rect(ctx, -1, -12, 3, 6, c.leg); rect(ctx, -1, -7, 5, 3, c.boot);
      poly(ctx, [-6, -20, 3, -20, 5, -9, -7, -6, -7, -4], c.cloak); poly(ctx, [-7, -12, -6, -3, -4, -12], c.cloakLo);
      rect(ctx, -6, -12, 10, 1.5, c.belt);
      circ(ctx, -1, -22, 5, c.hood); ell(ctx, 1.5, -21.5, 2.3, 2.6, c.shade); rect(ctx, 1.5, -22.5, 1.5, 1, c.eye); rect(ctx, 3.3, -22.5, 1, 1, c.eye);
      line(ctx, -5, -18, -8, -21, c.cloakHi, 2);
      sickle(ctx, c, 4, -15, o.atk, 0);
      ctx.restore(); return;
    }
    // ноги
    var l1 = 0, l2 = 0, lift1 = 0, lift2 = 0;
    if (st === 'run') { l1 = run * 3.5; l2 = -run * 3.5; lift1 = Math.max(0, -run) * 2; lift2 = Math.max(0, run) * 2; }
    if (st === 'air' || st === 'swing') { l1 = 2; l2 = -2; lift1 = 3; lift2 = 1; }
    if (st === 'pull') { l1 = 2; l2 = -1; lift1 = 4; lift2 = 4; }
    rect(ctx, -3 + l2, -9 - lift2, 3, 8, c.leg); rect(ctx, -3 + l2, -3 - lift2, 4, 3, c.boot);
    rect(ctx, 0 + l1, -9 - lift1, 3, 8, c.leg); rect(ctx, 0 + l1, -3 - lift1, 4, 3, c.boot);
    // плащ (развевается назад)
    var hem = st === 'air' || st === 'swing' ? -9 : -6;
    poly(ctx, [-5, -20, 4, -20, 6, hem, 1, hem + 1, -6, hem + 1, -8 - flut, hem - 1 - flut * 0.4], c.cloak);
    poly(ctx, [-5, -19, -8 - flut, hem - 1 - flut * 0.4, -6, hem + 1, -3, -12], c.cloakLo);
    if (!o.rt) line(ctx, 3, -19, 5, hem + 1, c.cloakHi, 1);
    rect(ctx, -5, -12, 10, 1.5, c.belt); circ(ctx, -3, -10, 1.6, c.cable);
    // голова: капюшон, тень лица, глаза-огоньки
    circ(ctx, 0.5, -22, 5, c.hood); poly(ctx, [-4, -24, -8 - flut * 0.6, -21, -4, -19], c.hood);
    ell(ctx, 3, -21.5, 2.4, 2.8, c.shade); rect(ctx, 3, -22.5, 1.5, 1, c.eye); rect(ctx, 5, -22.5, 1, 1, c.eye);
    rect(ctx, 1.6, -19.6, 3, 1.2, c.face);
    // рука с серпом / с тросом
    if (st === 'swing') { line(ctx, 1, -18, 2, -26, c.cloak, 2.4); circ(ctx, 2, -26.5, 1.5, c.face); sickle(ctx, c, -4, -12, 0, 2.4); }
    else sickle(ctx, c, 4, -15, o.atk, st === 'run' ? run * 0.3 : 0);
    ctx.restore();
  }
  function sickle(ctx, c, hx, hy, atk, rot) {
    ctx.save(); ctx.translate(hx, hy);
    var a = atk ? (-1.9 + (1 - atk) * 3.0) : (rot || 0) + 0.2;
    if (atk) { // дуга удара
      ctx.globalAlpha *= 0.55 * atk; ctx.strokeStyle = c.bladeHi; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 17, -1.9, a, false); ctx.stroke(); ctx.globalAlpha /= (0.55 * atk || 1);
    }
    ctx.rotate(a);
    rect(ctx, -1, -1, 9, 2, c.handle);
    ctx.strokeStyle = c.blade; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(10, -5, 6, Math.PI * 0.55, Math.PI * 1.65, true); ctx.stroke();
    ctx.restore();
  }

  // ---------- Синдикат ----------
  function enemy(ctx, e, t, rt, alarm) {
    var c = rt ? XR : XM, f = e.face || -1, x = e.x, y = e.y, eye = alarm ? c.red : c.eye;
    ctx.save(); ctx.translate(x, y); ctx.scale(f, 1);
    if (e.inv > 0 && Math.floor(t * 30) % 2) ctx.globalAlpha = 0.5;
    if (e.k === 'walker') {
      var w = Math.sin(t * 9 + e.sx);
      rect(ctx, -6 + w * 2, -6, 4, 6, c.iron); rect(ctx, 2 - w * 2, -6, 4, 6, c.iron);
      rect(ctx, -8, -21, 16, 15, c.rust); rect(ctx, -8, -21, 16, 3, c.rustHi); rect(ctx, -8, -8, 16, 2, c.rustLo);
      rect(ctx, 1, -18, 6, 5, c.dark); rect(ctx, 3, -17, 3, 3, eye);
      line(ctx, -4, -21, -6, -27, c.ironHi, 1); circ(ctx, -6, -27, 1.4, eye);
      rect(ctx, -6, -12, 2, 2, c.brass); rect(ctx, 4, -10, 2, 2, c.brass);
    } else if (e.k === 'jumper') {
      var sq = e.ground ? 0 : 4;
      ctx.strokeStyle = c.ironHi; ctx.lineWidth = 1.5; ctx.beginPath(); for (var i = 0; i <= 4; i++) ctx.lineTo(i % 2 ? 3 : -3, -i * (2 + sq * 0.25)); ctx.stroke();
      var top = -8 - sq;
      rect(ctx, -7, top - 11, 14, 11, c.rust); rect(ctx, -7, top - 11, 14, 2, c.rustHi); rect(ctx, -7, top - 6, 14, 1, c.rustLo);
      circ(ctx, 3, top - 6, 2.5, c.dark); circ(ctx, 3, top - 6, 1.4, eye);
    } else if (e.k === 'shooter') {
      line(ctx, 0, -10, -6, 0, c.iron, 2); line(ctx, 0, -10, 6, 0, c.iron, 2); line(ctx, 0, -10, 0, 0, c.iron, 2);
      rect(ctx, -7, -24, 14, 14, c.rust); rect(ctx, -7, -24, 14, 2, c.rustHi);
      rect(ctx, 5, -19, 9, 4, c.iron); rect(ctx, 12, -20, 2, 6, c.ironHi);
      rect(ctx, -4, -21, 5, 4, c.dark); rect(ctx, -2, -20, 2, 2, e.cd < 0.4 ? c.red : eye);
    } else if (e.k === 'drone') {
      var flap = Math.sin(t * 22 + e.sx) * 5;
      poly(ctx, [-2, -5, -12, -9 - flap, -8, -3], c.ironHi); poly(ctx, [2, -5, 10, -9 + flap, 7, -3], c.iron);
      ell(ctx, 0, -5, 7, 5, c.rust); rect(ctx, -7, -6, 14, 1, c.rustLo);
      poly(ctx, [6, -6, 11, -4, 6, -3], c.brass); circ(ctx, 3, -6, 1.6, eye);
      line(ctx, -2, 0, -3, 4, c.iron, 1); line(ctx, 2, 0, 3, 4, c.iron, 1);
    } else if (e.k === 'guard') {
      var gw = Math.sin(t * 5 + e.sx);
      rect(ctx, -5 + gw, -10, 4, 10, c.iron); rect(ctx, 1 - gw, -10, 4, 10, c.iron);
      poly(ctx, [-8, -10, -6, -26, 6, -26, 8, -10], c.rustLo); rect(ctx, -6, -26, 12, 3, c.rust);
      rect(ctx, -5, -34, 10, 8, c.iron); rect(ctx, 2, -32, 5, 4, c.glass);
      var sw = e.state === 'swing' ? -1.2 + (0.5 - e.cd) * 5 : 0.4;
      ctx.save(); ctx.translate(5, -20); ctx.rotate(sw); rect(ctx, 0, -1, 14, 2.4, c.brass); ctx.restore();
    }
    ctx.restore();
  }
  function cone(ctx, x, y, ang, len, half, rt, hot) {
    ctx.save();
    if (rt) { ctx.globalAlpha = 0.35; ctx.fillStyle = hot ? E.R : E.Y; }
    else { var g = ctx.createRadialGradient(x, y, 4, x, y, len); g.addColorStop(0, hot ? 'rgba(255,90,70,.55)' : 'rgba(255,236,170,.5)'); g.addColorStop(1, hot ? 'rgba(255,90,70,0)' : 'rgba(255,236,170,0)'); ctx.fillStyle = g; }
    ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, len, ang - half, ang + half); ctx.closePath(); ctx.fill(); ctx.restore();
  }

  // ---------- боссы ----------
  function boss(ctx, B, t, rt, A) {
    var c = rt ? XR : XM;
    if (B.dead && B.state === 'down' && Math.floor(t * 12) % 2) return;
    ctx.save();
    if (B.inv > 0 && Math.floor(t * 30) % 2) ctx.globalAlpha = 0.6;
    var x = B.x, y = B.y, f = B.face || -1, eye = B.phase2 ? c.red : c.eye;
    if (B.k === 'foreman') {
      ctx.translate(x, y); ctx.scale(f, 1);
      var w = B.state === 'charge' ? Math.sin(t * 30) * 3 : Math.sin(t * 6) * 2;
      rect(ctx, -14 + w, -12, 10, 12, c.iron); rect(ctx, 4 - w, -12, 10, 12, c.iron);
      rect(ctx, -20, -40, 40, 28, c.rust); rect(ctx, -20, -40, 40, 4, c.rustHi); rect(ctx, -20, -16, 40, 4, c.rustLo);
      for (var i = 0; i < 4; i++) { rect(ctx, -16 + i * 10, -36, 2, 2, c.brass); rect(ctx, -16 + i * 10, -20, 2, 2, c.brass); }
      poly(ctx, [-12, -40, -10, -50, 10, -50, 14, -40], rt ? E.y : '#e2b23a'); rect(ctx, -14, -42, 30, 3, rt ? E.N : '#b8862a');
      rect(ctx, 2, -36, 14, 6, c.dark); rect(ctx, 4, -35, 10, 3, eye);
      var arm = B.state === 'wind' ? -1.2 : B.state === 'charge' ? 0.3 : 0.6;
      ctx.save(); ctx.translate(16, -30); ctx.rotate(arm); rect(ctx, 0, -4, 20, 8, c.iron); rect(ctx, 16, -8, 10, 16, c.ironHi); ctx.restore();
    } else if (B.k === 'boiler') {
      ctx.translate(x, y); ctx.scale(f, 1);
      rect(ctx, -14, -8, 8, 8, c.iron); rect(ctx, 6, -8, 8, 8, c.iron);
      ell(ctx, 0, -24, 22, 18, c.rust); rect(ctx, -22, -26, 44, 3, c.rustLo);
      rect(ctx, -6, -48, 8, 10, c.iron); circ(ctx, 6, -22, 7, c.dark); circ(ctx, 6, -22, 4.5, B.phase2 ? (rt ? E.y : '#ffe066') : (rt ? E.R : '#ff7a2a'));
      rect(ctx, -12, -34, 6, 3, eye); rect(ctx, 0, -34, 6, 3, eye);
      if (!B.ground) for (i = 0; i < 3; i++) circ(ctx, -2 + i * 2, -52 - i * 6, 3 + i, rt ? E.l : 'rgba(220,220,220,.6)');
    } else if (B.k === 'crane') {
      line(ctx, A.x0, y - 8, A.x1, y - 8, c.ironHi, 3);
      rect(ctx, x - 22, y - 10, 44, 20, c.rust); rect(ctx, x - 22, y - 10, 44, 3, c.rustHi); rect(ctx, x - 6, y - 4, 12, 6, c.dark); rect(ctx, x - 4, y - 3, 8, 3, eye);
      line(ctx, x, y + 10, x, B.clawY - B.h, c.iron, 2);
      rect(ctx, x - 10, B.clawY - B.h, 20, 8, c.iron);
      var open = B.state === 'drop' ? 0.6 : B.state === 'grip' ? 0.1 : 0.35;
      ctx.save(); ctx.translate(x - 8, B.clawY - B.h + 8); ctx.rotate(open); rect(ctx, -2, 0, 4, 18, c.ironHi); ctx.restore();
      ctx.save(); ctx.translate(x + 8, B.clawY - B.h + 8); ctx.rotate(-open); rect(ctx, -2, 0, 4, 18, c.ironHi); ctx.restore();
    } else if (B.k === 'harpoon') {
      ell(ctx, x, y - 54, 46, 18, rt ? E.l : '#8a8f9a'); rect(ctx, x - 46, y - 56, 92, 3, rt ? E.g : '#6a6f7a');
      line(ctx, x - 20, y - 38, x - 18, y - 24, c.iron, 1); line(ctx, x + 20, y - 38, x + 18, y - 24, c.iron, 1);
      rect(ctx, x - 30, y - 24, 60, 22, c.rust); rect(ctx, x - 30, y - 24, 60, 3, c.rustHi);
      for (i = 0; i < 4; i++) rect(ctx, x - 24 + i * 14, y - 18, 7, 6, rt ? E.Y : '#ffe9a8');
      var ga = Math.atan2(4, f); ctx.save(); ctx.translate(x + f * 26, y - 6); ctx.rotate(ga); rect(ctx, 0, -2, 14, 4, c.iron); ctx.restore();
      rect(ctx, x - 4, y - 6, 8, 4, eye);
    } else if (B.k === 'pendulum') {
      if (B.blade) { line(ctx, (A.x0 + A.x1) / 2, 4 * T, B.blade.x, B.blade.y, c.ironHi, 2); ctx.save(); ctx.translate(B.blade.x, B.blade.y); ctx.rotate(Math.atan2(B.blade.x - (A.x0 + A.x1) / 2, 4 * T - B.blade.y) + Math.PI); ell(ctx, 0, 0, 20, 8, rt ? E.l : '#c8ced8'); ell(ctx, 0, -2, 16, 4, rt ? E.w : '#eef2f6'); ctx.restore(); circ(ctx, (A.x0 + A.x1) / 2, 4 * T + 2, 5, c.brass); }
      ctx.translate(x, y); ctx.scale(f, 1);
      var ww = Math.sin(t * 5) * 2;
      rect(ctx, -8 + ww, -12, 5, 12, c.iron); rect(ctx, 3 - ww, -12, 5, 12, c.iron);
      rect(ctx, -12, -32, 24, 20, rt ? E.N : '#a07a34'); rect(ctx, -12, -32, 24, 3, rt ? E.y : '#d9a441');
      circ(ctx, 0, -40, 10, rt ? E.Y : '#f4ead2'); circ(ctx, 0, -40, 10.5, 'rgba(0,0,0,0)');
      ctx.strokeStyle = rt ? E.k : '#3a2a1a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, -40, 10, 0, 7); ctx.stroke();
      line(ctx, 0, -40, Math.cos(t * 2) * 7, -40 + Math.sin(t * 2) * 7, rt ? E.k : '#3a2a1a', 1.5); line(ctx, 0, -40, Math.cos(t * 0.3) * 5, -40 + Math.sin(t * 0.3) * 5, rt ? E.r : '#a03020', 2);
      rect(ctx, 3, -46, 3, 2, eye);
    } else if (B.k === 'chancellor') {
      if (!B.dead) cone(ctx, x, y - 44, B.beam, 260, 0.28, rt, true);
      ctx.translate(x, y); ctx.scale(f, 1);
      var cw = Math.sin(t * 4) * 2;
      rect(ctx, -10 + cw, -14, 7, 14, c.iron); rect(ctx, 3 - cw, -14, 7, 14, c.iron);
      poly(ctx, [-16, -14, -12, -44, 12, -44, 16, -14], rt ? E.p : '#4a2a3a'); rect(ctx, -12, -44, 24, 4, c.rust);
      rect(ctx, -2, -40, 4, 26, c.brass);
      rect(ctx, -8, -56, 16, 12, c.iron); rect(ctx, -10, -58, 20, 3, c.dark); rect(ctx, -6, -70, 12, 12, c.dark);
      circ(ctx, 4, -50, 4, rt ? E.Y : '#fff3c4'); circ(ctx, 4, -50, 2, eye);
      line(ctx, 14, -30, 22, 0, c.brass, 2);
    }
    ctx.restore();
  }

  // ---------- предметы ----------
  function item(ctx, it, x, y, t, rt) {
    var c = rt ? XR : XM;
    if (it === 'c5' || it === 'c10') { gear(ctx, x, y - 6, it === 'c10' ? 6 : 5, rt ? E.c : '#7fe3ff', 7); circ(ctx, x, y - 6, 2, rt ? E.k : '#0c2a34'); }
    else if (it === 'hp') { rect(ctx, x - 4, y - 10, 8, 9, rt ? E.R : '#e04a4a'); rect(ctx, x - 2, y - 13, 4, 3, c.iron); rect(ctx, x - 1, y - 8, 2, 5, rt ? E.w : '#fff'); rect(ctx, x - 3, y - 7, 6, 2, rt ? E.w : '#fff'); }
    else if (it === 'pts') { ell(ctx, x, y - 5, 5, 5, rt ? E.N : '#b8862a'); rect(ctx, x - 2, y - 12, 4, 3, rt ? E.N : '#8a6420'); rect(ctx, x - 1, y - 7, 2, 3, rt ? E.y : '#ffe066'); }
    else if (it === 'life') { circ(ctx, x, y - 7, 5, HM.hood); rect(ctx, x, y - 8, 2, 1, HM.eye); }
    else if (it.indexOf('sp:') === 0) spIcon(ctx, it.slice(3), x, y - 6, t, rt);
  }
  function spIcon(ctx, k, x, y, t, rt) {
    if (k === 'star') { ctx.save(); ctx.translate(x, y); ctx.rotate(t * 3); gear(ctx, 0, 0, 6, rt ? E.l : '#d8dee6', 6); circ(ctx, 0, 0, 1.6, rt ? E.k : '#333'); ctx.restore(); }
    else if (k === 'smoke') { circ(ctx, x, y + 1, 5, rt ? E.d : '#555a62'); rect(ctx, x - 1, y - 7, 2, 3, rt ? E.N : '#c9a043'); circ(ctx, x + 2, y - 8, 1.6, rt ? E.y : '#ffd27a'); }
    else if (k === 'whirl') { ctx.strokeStyle = rt ? E.Gl : '#9be7b0'; ctx.lineWidth = 2; ctx.beginPath(); for (var i = 0; i < 18; i++) { var a = i * 0.7 + t * 6, r = 1 + i * 0.35; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } ctx.stroke(); }
    else if (k === 'fire') { poly(ctx, [x - 5, y + 5, x - 2, y - 6, x, y - 1, x + 3, y - 8, x + 5, y + 5], rt ? E.R : '#ff7a2a'); poly(ctx, [x - 2, y + 5, x, y - 1, x + 2, y + 5], rt ? E.y : '#ffe066'); }
  }

  // ---------- камера ----------
  function camera(cam, S, dt, snap) {
    var LV = S.LV, P = S.hero;
    if (LV.arena) { cam.x = 0; cam.y = Math.round((LV.h * T - VH) / 2); return; }
    var tx = P.x - VW / 2 + P.face * 50 + P.vx * 0.25, ty = P.y - VH * 0.58;
    tx = Math.max(0, Math.min(LV.w * T - VW, tx)); ty = Math.max(0, Math.min(LV.h * T - VH, ty));
    if (snap || cam.x == null) { cam.x = tx; cam.y = ty; return; }
    cam.x += (tx - cam.x) * Math.min(1, dt * 5); cam.y += (ty - cam.y) * Math.min(1, dt * 4);
  }

  // ---------- мир ----------
  function drawWorld(ctx, S, ui, rt, t) {
    var LV = S.LV, a = S.act, p = pal(a, rt), cam = ui.cam, cx = Math.round(cam.x), cy = Math.round(cam.y), P = S.hero;
    var bg = bgLayers(a, rt);
    if (bg) {
      ctx.drawImage(bg.sky, 0, 0);
      var fx = -((cx * 0.15) % 1280); ctx.drawImage(bg.far, fx, -cy * 0.06); ctx.drawImage(bg.far, fx + 1280, -cy * 0.06);
      var mx = -((cx * 0.4) % 1024); ctx.drawImage(bg.mid, mx, 30 - cy * 0.15); ctx.drawImage(bg.mid, mx + 1024, 30 - cy * 0.15);
    }
    // лучи прожекторов в небе (декор)
    if (a === 1 || a === 3 || a === 6) for (var i = 0; i < 2; i++) { var bx = ((i * 700 - cx * 0.2) % 1400 + 1400) % 1400 - 200, ba = -Math.PI / 2 + Math.sin(t * 0.4 + i * 2) * 0.5; ctx.globalAlpha = rt ? 0.25 : 0.12; poly(ctx, [bx, VH, bx + Math.cos(ba - 0.06) * 600, VH + Math.sin(ba - 0.06) * 600, bx + Math.cos(ba + 0.06) * 600, VH + Math.sin(ba + 0.06) * 600], rt ? E.Y : '#fff3c8'); ctx.globalAlpha = 1; }
    if (S.alarm > 0) { ctx.fillStyle = rt ? 'rgba(168,16,0,.25)' : 'rgba(255,40,40,' + (0.08 + 0.06 * Math.sin(t * 10)) + ')'; ctx.fillRect(0, 0, VW, VH); }
    ctx.save(); ctx.translate(-cx, -cy);
    // подвесы висячих стен колодцев (балка уходит вверх, за край кадра)
    LV.deco.forEach(function (d) {
      if (d.k !== 'tower') return; var x0 = d.c * T, yt = d.r0 * T; if (x0 < cx - 40 || x0 > cx + VW + 40) return;
      rect(ctx, x0 + 6, yt - 600, 4, 600, rt ? E.d : '#262b36'); rect(ctx, x0 + 22, yt - 600, 4, 600, rt ? E.d : '#262b36');
      for (var yy = yt - 24; yy > yt - 600; yy -= 24) rect(ctx, x0 + 6, yy, 20, 3, rt ? E.d : '#262b36');
      rect(ctx, x0 - 2, yt - 4, 36, 4, rt ? E.g : '#3a3f4f');
    });
    // клетки
    var ts = tiles(a, rt), c0 = Math.max(0, Math.floor(cx / T)), c1 = Math.min(LV.w - 1, Math.floor((cx + VW) / T)), r0 = Math.max(0, Math.floor(cy / T)), r1 = Math.min(LV.h - 1, Math.floor((cy + VH) / T));
    if (ts.f0) for (var r = r0; r <= r1; r++) for (var c = c0; c <= c1; c++) {
      var v = LV.t[r * LV.w + c]; if (!v) continue;
      var X = c * T, Y = r * T;
      if (v === C.S) { var top = r === 0 || LV.t[(r - 1) * LV.w + c] !== C.S; var odd = (c + r) & 1; ctx.drawImage(top ? (odd ? ts.t1 : ts.t0) : (odd ? ts.f1 : ts.f0), X, Y, T, T);
        if (c > 0 && LV.t[r * LV.w + c - 1] !== C.S) ctx.drawImage(ts.side, X, Y, T, T);
        if (!top) { var dep = 1; while (dep < 4 && r - dep - 1 >= 0 && LV.t[(r - dep - 1) * LV.w + c] === C.S) dep++; if (dep > 1) { ctx.fillStyle = rt ? (dep > 2 ? 'rgba(0,0,0,.5)' : 'rgba(0,0,0,.25)') : 'rgba(4,6,10,' + (0.14 * (dep - 1)) + ')'; ctx.fillRect(X, Y, T, T); } } }
      else if (v === C.P) ctx.drawImage(ts.plat, X, Y, T, T);
      else if (v === C.X) ctx.drawImage(ts.spike, X, Y, T, T);
    }
    // прожекторы-вышки
    LV.lights.forEach(function (l) {
      if (l.x < cx - 260 || l.x > cx + VW + 260) return;
      var ang = l.base + Math.sin(S.t * l.sp + l.ph) * l.amp;
      cone(ctx, l.x, l.y, ang, l.len, 0.2, rt, S.alarm > 0);
      rect(ctx, l.x - 2, l.y, 4, 5 * T - 2, rt ? E.d : '#3a3f4a'); rect(ctx, l.x - 6, l.y - 6, 12, 8, rt ? E.g : '#5a606c'); circ(ctx, l.x, l.y - 2, 3.5, S.alarm > 0 ? (rt ? E.R : '#ff5a4a') : (rt ? E.Y : '#fff3c4'));
    });
    // кольца
    var near = L.findRing(LV, P);
    LV.rings.forEach(function (q) {
      if (q.x < cx - 40 || q.x > cx + VW + 40) return;
      line(ctx, q.x, q.y - 6, q.x, q.y - 120, rt ? E.g : 'rgba(150,140,120,.6)', 1);
      ell(ctx, q.x, q.y - 128, 10, 7, rt ? E.l : '#8a8f9a');
      var hot = near === q && !P.hook;
      ctx.strokeStyle = hot ? (rt ? E.y : '#ffe066') : (rt ? E.N : '#c9a043'); ctx.lineWidth = hot ? 3 : 2.4; ctx.beginPath(); ctx.arc(q.x, q.y, 6, 0, 7); ctx.stroke();
      if (hot && !rt) { ctx.globalAlpha = 0.3 + 0.2 * Math.sin(t * 8); circ(ctx, q.x, q.y, 11, '#ffe066'); ctx.globalAlpha = 1; }
    });
    // выход
    if (LV.exit) { var ex = LV.exit.x, ey = LV.exit.y;
      rect(ctx, ex - 14, ey - 40, 28, 40, rt ? E.d : '#2e3440'); rect(ctx, ex - 11, ey - 36, 22, 36, rt ? E.k : '#141820');
      rect(ctx, ex - 14, ey - 44, 28, 4, rt ? E.g : '#5a606c'); circ(ctx, ex, ey - 50, 4, rt ? E.Gl : '#62ff9a');
      ctx.globalAlpha = 0.6 + 0.3 * Math.sin(t * 4); poly(ctx, [ex - 6, ey - 22, ex + 4, ey - 22, ex + 4, ey - 27, ex + 10, ey - 18, ex + 4, ey - 9, ex + 4, ey - 14, ex - 6, ey - 14], rt ? E.Gl : '#62ff9a'); ctx.globalAlpha = 1; }
    // фонари-тайники
    S.lamps.forEach(function (l) { if (l.broken || l.x < cx - 20 || l.x > cx + VW + 20) return;
      line(ctx, l.x, l.y - 9, l.x, l.y - 18, rt ? E.g : '#6a6f7a', 1); rect(ctx, l.x - 5, l.y - 9, 10, 3, rt ? E.d : '#3a3f4a');
      if (!rt) { ctx.globalAlpha = 0.25 + 0.1 * Math.sin(t * 5 + l.x); circ(ctx, l.x, l.y, 12, p.glow); ctx.globalAlpha = 1; }
      rect(ctx, l.x - 4, l.y - 6, 8, 11, rt ? E.y : '#ffcf6a'); rect(ctx, l.x - 4, l.y - 6, 8, 1, rt ? E.N : '#a07a34'); rect(ctx, l.x - 5, l.y + 5, 10, 2, rt ? E.d : '#3a3f4a'); rect(ctx, l.x - 1, l.y - 4, 2, 7, rt ? E.w : '#fff6d8'); });
    S.pickups.forEach(function (q) { if (q.t < 2 && Math.floor(q.t * 10) % 2) return; item(ctx, q.item, q.x, q.y, t, rt); });
    // огонь
    S.fires.forEach(function (f) { for (var k = 0; k < f.len; k += 8) { var fx2 = f.x0 + f.dir * k, h = 8 + Math.abs(Math.sin(t * 20 + k)) * 12 * (f.t / 0.8); poly(ctx, [fx2 - 5, f.y, fx2, f.y - h, fx2 + 5, f.y], rt ? E.R : '#ff7a2a'); poly(ctx, [fx2 - 2, f.y, fx2, f.y - h * 0.5, fx2 + 2, f.y], rt ? E.y : '#ffe066'); } });
    // враги
    S.enemies.forEach(function (e) { if (e.dead || e.x < cx - 60 || e.x > cx + VW + 60) return;
      if (e.k === 'guard') cone(ctx, e.x, e.y - 28, e.beam, 150, 0.3, rt, S.alarm > 0);
      enemy(ctx, e, t, rt, S.alarm > 0); });
    if (S.boss) boss(ctx, S.boss, t, rt, LV.arena);
    // трос
    if (P.hook) { line(ctx, P.x + P.face * 1, P.y - 20, P.hook.x, P.hook.y, rt ? E.N : HM.cable, 1.4); circ(ctx, P.hook.x, P.hook.y, 2.5, rt ? E.l : '#dfe5ec'); }
    // героиня
    var st = L.stateOf(P), atk = S.atkT > 0 ? S.atkT / K.ATK_T : 0;
    if (S.phase !== 'dead' || Math.floor(S.phaseT * 10) % 2) hero(ctx, P.x, P.y, { face: P.cling ? -P.cling : P.face, state: st, runT: P.runT, atk: atk, t: S.t, inv: S.inv > 0, smoke: S.smoke > 0, rt: rt });
    if (S.whirl > 0) { ctx.strokeStyle = rt ? E.Gl : 'rgba(155,231,176,.8)'; ctx.lineWidth = 2; for (var w = 0; w < 3; w++) { ctx.beginPath(); ctx.arc(P.x, P.y - 12, 26 + w * 5, S.t * 14 + w * 2, S.t * 14 + w * 2 + 2.2); ctx.stroke(); } }
    // снаряды
    S.shots.forEach(function (s) { ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.rot); gear(ctx, 0, 0, 5, rt ? E.l : '#dfe5ec', 6); circ(ctx, 0, 0, 1.5, rt ? E.k : '#333'); ctx.restore(); });
    S.eshots.forEach(function (b) {
      if (b.k === 'bolt') { rect(ctx, b.x - 4, b.y - 1.5, 8, 3, rt ? E.R : '#ff8a4a'); rect(ctx, b.x - 2, b.y - 1, 4, 2, rt ? E.y : '#ffe066'); }
      else if (b.k === 'harpoon') { ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.ang || 0); rect(ctx, -10, -1, 14, 2, rt ? E.l : '#c8ced8'); poly(ctx, [4, -4, 10, 0, 4, 4], rt ? E.w : '#eef2f6'); ctx.restore(); }
      else if (b.k === 'wave') { poly(ctx, [b.x - 7, b.y, b.x, b.y - 14, b.x + 7, b.y], rt ? E.Y : 'rgba(255,220,160,.9)'); }
      else if (b.k === 'gear') gear(ctx, b.x, b.y, b.r, rt ? E.N : '#c9a043', 8);
      else if (b.k === 'bomb') { circ(ctx, b.x, b.y, 5, rt ? E.d : '#2a2a30'); circ(ctx, b.x + 2, b.y - 5, 1.5, rt ? E.R : '#ff7a2a'); }
    });
    FX.draw(ctx);
    // тосты
    (ui.toasts || []).forEach(function (q) { var k = Math.min(1, q.t / 0.3); ctx.globalAlpha = k; ctx.font = (q.big ? '800 13px ' : '800 10px ') + (rt ? '"Courier New", monospace' : 'Inter, system-ui, sans-serif'); ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillText(q.text, q.x + 1, q.y - (q.life - q.t) * 18 + 1); ctx.fillStyle = q.color; ctx.fillText(q.text, q.x, q.y - (q.life - q.t) * 18); ctx.globalAlpha = 1; });
    ctx.restore();
  }

  // ---------- HUD ----------
  function hud(g, ctx, S, ui, rt) {
    var th = g.th(), font = rt ? '"Courier New", monospace' : 'Inter, system-ui, sans-serif';
    ctx.fillStyle = rt ? '#000' : 'rgba(8,10,14,.72)'; ctx.fillRect(0, 0, VW, 26);
    if (!rt) { ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fillRect(0, 26, VW, 1); }
    var tx = function (s, x, y, o) { g.text(s, x, y, Object.assign({ size: 12, weight: 800, font: font }, o || {})); };
    tx(String(S.score).padStart(7, '0'), 10, 17, { color: th.ink });
    tx(g.t('act').toUpperCase() + ' ' + S.act + '-' + (S.scene === 4 ? (g.i18n.lang === 'ru' ? 'Б' : 'B') : S.scene), 86, 17, { color: th.muted });
    var tm = Math.ceil(S.time), low = tm <= 20;
    tx(g.t('time') + ' ' + tm, 196, 17, { color: low && Math.floor(S.t * 4) % 2 ? th.bad : th.ink });
    // здоровье
    var hx = 300; tx('♥', hx - 14, 17, { color: rt ? E.R : '#ff6a6a' });
    for (var i = 0; i < K.HP; i++) { ctx.fillStyle = i < S.hp ? (rt ? E.R : '#ff6a6a') : (rt ? E.d : 'rgba(255,255,255,.12)'); ctx.fillRect(hx + i * 9, 8, 7, 11); }
    // заряд + приём
    spIcon(ctx, S.special, 398, 13, S.t, rt);
    tx(String(S.charge), 410, 17, { color: rt ? E.c : '#7fe3ff' });
    tx(g.t('sp_' + S.special), 434, 17, { color: th.muted, size: 10, weight: 700 });
    // жизни
    for (i = 0; i < Math.min(5, S.lives); i++) { circ(ctx, VW - 16 - i * 13, 13, 5, rt ? E.G : HM.hood); rect(ctx, VW - 15 - i * 13, 12, 2, 1, rt ? E.y : HM.eye); }
    if (S.lives > 5) tx('×' + S.lives, VW - 82, 17, { color: th.ink, size: 11 });
    // босс
    var B = S.boss;
    if (B && B.state !== 'intro') {
      var bw = 220, bx = VW / 2 - bw / 2, by = VH - 18;
      ctx.fillStyle = rt ? '#000' : 'rgba(8,10,14,.75)'; ctx.fillRect(bx - 4, by - 14, bw + 8, 26);
      tx(g.t('b_' + B.k), VW / 2, by - 3, { align: 'center', size: 10, color: th.ink });
      ctx.fillStyle = rt ? E.d : 'rgba(255,255,255,.12)'; ctx.fillRect(bx, by + 1, bw, 6);
      ctx.fillStyle = B.phase2 ? (rt ? E.R : '#ff5a4a') : (rt ? E.y : '#ffb347'); ctx.fillRect(bx, by + 1, bw * Math.max(0, B.hp) / B.max, 6);
    }
    if (S.alarm > 0 && Math.floor(S.t * 4) % 2 === 0) tx(g.t('alarm'), VW / 2, 46, { align: 'center', size: 16, color: rt ? E.R : '#ff5a4a' });
    if (S.smoke > 0) { ctx.fillStyle = rt ? E.l : 'rgba(200,210,220,.8)'; ctx.fillRect(VW / 2 - 40, 52, 80 * S.smoke / 3, 3); }
    // баннер
    var bn = ui.banner;
    if (bn) {
      var k = Math.min(1, bn.a / 0.35, (bn.dur - bn.a) / 0.25 + 0.001);
      ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, k));
      var hh = 64 + (bn.lines ? bn.lines.length * 16 : 0);
      ctx.fillStyle = rt ? '#000' : 'rgba(8,10,14,.78)'; ctx.fillRect(0, VH / 2 - hh / 2 - 20, VW, hh);
      if (!rt) { ctx.fillStyle = th.accent; ctx.fillRect(0, VH / 2 - hh / 2 - 20, VW, 2); ctx.fillRect(0, VH / 2 + hh / 2 - 22, VW, 2); }
      tx(bn.title, VW / 2, VH / 2 - hh / 2 + 10, { align: 'center', size: rt ? 20 : 22, color: th.accent, weight: 900 });
      if (bn.sub) tx(bn.sub, VW / 2, VH / 2 - hh / 2 + 32, { align: 'center', size: 12, color: th.ink, weight: 700 });
      (bn.lines || []).forEach(function (s, i) { tx(s, VW / 2, VH / 2 - hh / 2 + 54 + i * 16, { align: 'center', size: 12, color: th.muted, weight: 700 }); });
      ctx.restore();
    }
    if (ui.tip) { ctx.save(); ctx.globalAlpha = Math.min(1, ui.tip.a); ctx.fillStyle = rt ? '#000' : 'rgba(8,10,14,.7)'; ctx.fillRect(VW / 2 - 200, VH - 46, 400, 22); tx(ui.tip.text, VW / 2, VH - 31, { align: 'center', size: 11, color: th.ink, weight: 700 }); ctx.restore(); }
  }

  // ---------- кадр ----------
  var lowBuf = null;
  function render(g, ctx, S, ui) {
    var rt = g.themeName === 'retro', t = S.t;
    if (rt) {
      if (!lowBuf) lowBuf = mk(VW / 2, VH / 2);
      if (lowBuf) {
        var lc = lowBuf.getContext('2d'); lc.setTransform(0.5, 0, 0, 0.5, 0, 0); lc.imageSmoothingEnabled = false;
        drawWorld(lc, S, ui, true, t);
        ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(lowBuf, 0, 0, VW, VH); ctx.restore();
      } else drawWorld(ctx, S, ui, true, t);
    } else {
      drawWorld(ctx, S, ui, false, t);
      var v = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.4, VW / 2, VH / 2, VW * 0.65); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.35)'); ctx.fillStyle = v; ctx.fillRect(0, 0, VW, VH);
    }
    hud(g, ctx, S, ui, rt);
  }

  // ---------- слайды кат-сцен ----------
  // art(ctx, id, w, h, t, rt) — рисованная картинка панели в прямоугольнике 0..w × 0..h
  function art(ctx, id, w, h, t, rt) {
    var p = pal(id === 'pipes' ? 2 : id === 'dock' || id === 'airship' ? 3 : id === 'clouds' ? 4 : id === 'archive' || id === 'gears' ? 5 : id === 'tower' || id === 'chancellor' || id === 'fall' ? 6 : id === 'dawn' ? 4 : 1, rt);
    if (rt) { rect(ctx, 0, 0, w, h * 0.5, p.sky[0]); rect(ctx, 0, h * 0.5, w, h * 0.5, p.sky[2]); }
    else { var g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, p.sky[0]); g.addColorStop(1, p.sky[2]); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); }
    var dark = rt ? E.k : 'rgba(6,8,12,.92)', i;
    if (id === 'workshop') {
      rect(ctx, 0, h * 0.72, w, h * 0.28, rt ? E.n : '#2a1e16');
      rect(ctx, w * 0.12, h * 0.3, w * 0.22, h * 0.42, rt ? E.d : '#3a3f4a'); rect(ctx, w * 0.15, h * 0.34, w * 0.16, h * 0.34, dark);
      ctx.save(); ctx.translate(w * 0.34, h * 0.3); ctx.rotate(0.5); rect(ctx, 0, 0, w * 0.04, h * 0.42, rt ? E.g : '#5a606c'); ctx.restore();
      rect(ctx, w * 0.5, h * 0.55, w * 0.38, h * 0.06, rt ? E.N : '#7a5a2a'); rect(ctx, w * 0.53, h * 0.61, 8, h * 0.11, rt ? E.N : '#5a4020'); rect(ctx, w * 0.84, h * 0.61, 8, h * 0.11, rt ? E.N : '#5a4020');
      gear(ctx, w * 0.62, h * 0.5, 14, rt ? E.N : '#c9a043', 8); circ(ctx, w * 0.62, h * 0.5, 5, rt ? E.n : '#2a1e16');
      for (i = 0; i < 5; i++) rect(ctx, w * (0.42 + i * 0.03), h * (0.74 + (i % 2) * 0.04), 10, 5, rt ? E.w : '#efe6d2');
      if (!rt) { ctx.globalAlpha = 0.18; poly(ctx, [w * 0.95, 0, w * 0.55, h, w * 0.85, h], '#fff3c8'); ctx.globalAlpha = 1; }
    } else if (id === 'clue') {
      rect(ctx, 0, 0, w, h, rt ? E.n : '#2a1e16');
      if (!rt) { var rg = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * 0.45); rg.addColorStop(0, 'rgba(255,220,150,.35)'); rg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = rg; ctx.fillRect(0, 0, w, h); }
      gear(ctx, w / 2, h / 2, Math.min(w, h) * 0.22, rt ? E.R : '#8a3b26', 9);
      circ(ctx, w / 2, h / 2, Math.min(w, h) * 0.08, rt ? E.n : '#2a1e16');
      ctx.save(); ctx.translate(w / 2, h / 2); ctx.rotate(-Math.PI / 2); rect(ctx, Math.min(w, h) * 0.17, -8, 16, 16, rt ? E.n : '#2a1e16'); ctx.restore();
    } else if (id === 'hero' || id === 'dawn') {
      if (id === 'dawn') { circ(ctx, w * 0.7, h * 0.62, h * 0.18, rt ? E.y : '#ffd28a'); for (i = 0; i < 4; i++) rect(ctx, 0, h * (0.66 + i * 0.05), w, 2, rt ? E.Y : 'rgba(255,240,220,.4)'); }
      rect(ctx, 0, h * 0.8, w, h * 0.2, rt ? E.k : '#0c1018');
      for (i = 0; i < 6; i++) { var bx = i * w / 6, bh = h * (0.18 + hash(i, 4) * 0.2); rect(ctx, bx, h * 0.8 - bh, w / 6 - 6, bh, rt ? E.k : '#0c1018'); }
      hero(ctx, w * (id === 'dawn' ? 0.3 : 0.5), h * 0.8, { face: 1, state: 'idle', t: t, rt: rt, scale: Math.min(w, h) / 70 });
      if (id === 'dawn') { rect(ctx, w * 0.62, h * 0.66, w * 0.2, h * 0.04, rt ? E.N : '#7a5a2a'); rect(ctx, w * 0.64, h * 0.6, w * 0.14, h * 0.06, rt ? E.w : '#eef2f6'); }
    } else if (id === 'fortress' || id === 'tower' || id === 'fall') {
      var base = h * 0.92, fxm = w / 2;
      rect(ctx, 0, base, w, h - base, rt ? E.k : '#07060c');
      poly(ctx, [fxm - w * 0.3, base, fxm - w * 0.3, h * 0.45, fxm - w * 0.18, h * 0.45, fxm - w * 0.18, h * 0.25, fxm - w * 0.06, h * 0.25, fxm - w * 0.06, h * 0.1, fxm + w * 0.06, h * 0.1, fxm + w * 0.06, h * 0.3, fxm + w * 0.2, h * 0.3, fxm + w * 0.2, h * 0.5, fxm + w * 0.32, h * 0.5, fxm + w * 0.32, base], rt ? E.k : '#0c0a12');
      var lights = [[fxm - w * 0.12, h * 0.25], [fxm, h * 0.1], [fxm + w * 0.13, h * 0.3]];
      lights.forEach(function (q, k) { var on = id !== 'fall' || k < 3 - Math.floor((t * 1.5) % 4); if (!on) return; var a = -Math.PI / 2 + Math.sin(t * 0.8 + k * 2) * 0.7; ctx.globalAlpha = rt ? 0.4 : 0.25; poly(ctx, [q[0], q[1], q[0] + Math.cos(a - 0.08) * w, q[1] + Math.sin(a - 0.08) * w, q[0] + Math.cos(a + 0.08) * w, q[1] + Math.sin(a + 0.08) * w], rt ? E.Y : '#fff3c8'); ctx.globalAlpha = 1; circ(ctx, q[0], q[1], 4, rt ? E.y : '#ffe9a8'); });
      for (i = 0; i < 18; i++) if (hash(i, 9) < 0.6) rect(ctx, fxm - w * 0.28 + hash(i, 7) * w * 0.56, h * 0.5 + hash(i, 8) * h * 0.35, 3, 4, rt ? E.y : '#ffcf6a');
      if (id === 'tower') hero(ctx, w * 0.12, base, { face: 1, state: 'cling', t: t, rt: rt, scale: 1.6 });
    } else if (id === 'pipes') {
      for (i = 0; i < 5; i++) { rect(ctx, 0, h * (0.15 + i * 0.17), w, h * 0.08, rt ? E.n : '#4a2e22'); rect(ctx, 0, h * (0.15 + i * 0.17), w, 3, rt ? E.N : '#8a5a3a'); }
      for (i = 0; i < 6; i++) circ(ctx, w * (0.1 + i * 0.16), h * 0.55, 6, rt ? E.R : '#ff8a3a');
      hero(ctx, w * 0.3, h * 0.49, { face: 1, state: 'run', runT: t * 8, t: t, rt: rt, scale: 1.7 });
    } else if (id === 'dock' || id === 'airship') {
      var ax = w * 0.55 + (id === 'airship' ? Math.sin(t) * 6 : 0), ay = h * 0.32;
      ell(ctx, ax, ay, w * 0.32, h * 0.16, rt ? E.l : '#8a8f9a'); rect(ctx, ax - w * 0.32, ay - 2, w * 0.64, 3, rt ? E.g : '#6a6f7a');
      rect(ctx, ax - w * 0.08, ay + h * 0.16, w * 0.16, h * 0.08, rt ? E.r : '#8a3b26');
      if (id === 'dock') { rect(ctx, w * 0.1, h * 0.2, 8, h * 0.8, rt ? E.k : '#0a1018'); for (i = 0; i < 4; i++) line(ctx, w * 0.1, h * (0.3 + i * 0.15), ax - w * 0.3, ay, rt ? E.g : '#5a606c', 1); rect(ctx, 0, h * 0.9, w, h * 0.1, rt ? E.k : '#0a1018'); }
      else { line(ctx, ax - w * 0.05, ay + h * 0.24, w * 0.25, h, rt ? E.N : '#b89a64', 1.5); hero(ctx, w * 0.33, h * 0.84, { face: 1, state: 'swing', t: t, rt: rt, scale: 1.6 }); }
    } else if (id === 'clouds') {
      for (i = 0; i < 8; i++) ell(ctx, hash(i, 1) * w, h * (0.4 + hash(i, 2) * 0.6), 60 + hash(i, 3) * 60, 18, rt ? E.w : 'rgba(255,240,236,.6)');
      rect(ctx, 0, h * 0.62, w, 8, rt ? E.n : '#5a4030');
      hero(ctx, w * 0.35, h * 0.62, { face: 1, state: 'air', t: t, rt: rt, scale: 1.8 });
      enemy(ctx, { k: 'drone', x: w * 0.75, y: h * 0.4, face: -1, sx: 1 }, t, rt, false);
    } else if (id === 'archive' || id === 'gears') {
      gear(ctx, w * 0.3, h * 0.5, h * 0.36, rt ? E.n : '#3a3424', 14); circ(ctx, w * 0.3, h * 0.5, h * 0.12, p.sky[1]);
      gear(ctx, w * 0.72, h * 0.3, h * 0.24, rt ? E.N : '#5a4a2a', 10);
      if (id === 'gears') { line(ctx, w * 0.6, 0, w * 0.6 + Math.sin(t * 2) * w * 0.2, h * 0.7, rt ? E.l : '#c8ced8', 2); ell(ctx, w * 0.6 + Math.sin(t * 2) * w * 0.2, h * 0.72, 18, 7, rt ? E.l : '#c8ced8'); }
      else for (i = 0; i < 6; i++) rect(ctx, w * 0.55, h * (0.55 + i * 0.07), w * 0.4, 4, rt ? E.N : '#7a5a2a');
    } else if (id === 'chancellor') {
      rect(ctx, 0, h * 0.85, w, h * 0.15, rt ? E.k : '#0c0a12');
      boss(ctx, { k: 'chancellor', x: w * 0.6, y: h * 0.85, face: -1, beam: Math.PI + Math.sin(t) * 0.3, inv: 0, phase2: false }, t, rt, null);
      hero(ctx, w * 0.18, h * 0.85, { face: 1, state: 'idle', t: t, rt: rt, scale: 1.5 });
    }
    if (rt) { ctx.globalAlpha = 0.18; for (i = 0; i < h; i += 3) rect(ctx, 0, i, w, 1, '#000'); ctx.globalAlpha = 1; }
  }

  TEN.render = render;
  TEN.R = { VW: VW, VH: VH, E: E, HM: HM, FX: FX, hero: hero, enemy: enemy, boss: boss, item: item, spIcon: spIcon, gear: gear, camera: camera, bgLayers: bgLayers, art: art, pal: pal, cone: cone };
})(typeof window !== 'undefined' ? window : globalThis);
