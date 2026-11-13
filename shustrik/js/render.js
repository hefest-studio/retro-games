/* ШУСТРИК · render.js — отрисовка обеих тем одним модулем (ветвление по g.themeName).
   modern — векторная графика с градиентами; retro — тот же кадр рисуется в буфер 320×180 и растягивается ×2 без
   сглаживания (крупный «пиксель», палитра 16 цветов). Камера с упреждением по скорости, параллакс фона (два слоя),
   кэш спрайтов клеток по (мир, тема). SHUSTRIK.R — примитивы для титула (hero, fox, gear, палитры). */
(function (global) {
  'use strict';
  var SH = global.SHUSTRIK, L = SH.logic, T = L.T, C = L.C;
  var VW = 640, VH = 360;
  // палитры миров: modern
  var WM = [
    { sky: ['#1c1326', '#4e2436', '#c25a36'], far: '#2a1824', mid: '#3a2029', fill: '#4a2b23', fill2: '#42261f', line: '#5d3a2b', top: '#e0953f', top2: '#9a5626', plat: '#c27a32', glow: '#ffb347' },
    { sky: ['#06171b', '#0d3337', '#1d5f5b'], far: '#0a262a', mid: '#12373b', fill: '#25343b', fill2: '#212f36', line: '#34474f', top: '#7ccab6', top2: '#3c8576', plat: '#5aa594', glow: '#9ff3dc' },
    { sky: ['#0b0d22', '#1c1a40', '#47325f'], far: '#161532', mid: '#211d3f', fill: '#2a2637', fill2: '#252131', line: '#3a344e', top: '#d6b056', top2: '#8a6a2a', plat: '#b38c3c', glow: '#ffd76a' },
    { sky: ['#1d355c', '#4f74a6', '#eab489'], far: '#7b95bb', mid: '#566a8e', fill: '#3a414f', fill2: '#353b48', line: '#4a5263', top: '#ea6640', top2: '#a5402a', plat: '#c3cad6', glow: '#ffd2b0' }
  ];
  // retro: EGA-16
  var E = { k: '#000000', b: '#0000aa', g: '#00aa00', c: '#00aaaa', r: '#aa0000', m: '#aa00aa', n: '#aa5500', l: '#aaaaaa', d: '#555555',
    B: '#5555ff', G: '#55ff55', Cc: '#55ffff', R: '#ff5555', M: '#ff55ff', y: '#ffff55', w: '#ffffff' };
  var WR = [
    { sky: [E.k, E.k, E.r], far: E.d, mid: E.r, fill: E.n, fill2: E.n, line: E.k, top: E.y, top2: E.n, plat: E.y, glow: E.y },
    { sky: [E.k, E.k, E.b], far: E.d, mid: E.b, fill: E.d, fill2: E.d, line: E.k, top: E.Cc, top2: E.c, plat: E.Cc, glow: E.Cc },
    { sky: [E.b, E.b, E.m], far: E.m, mid: E.k, fill: E.d, fill2: E.d, line: E.k, top: E.y, top2: E.n, plat: E.l, glow: E.y },
    { sky: [E.B, E.B, E.Cc], far: E.w, mid: E.l, fill: E.d, fill2: E.d, line: E.k, top: E.R, top2: E.r, plat: E.l, glow: E.w }
  ];
  function pal(w, retro) { return (retro ? WR : WM)[Math.max(0, Math.min(3, (w || 1) - 1))]; }
  // герой и обитатели
  var HM = { body: '#c4844a', dark: '#4a3326', belly: '#f1dcb0', joint: '#3a3f48', lens: '#ffcf3a', rim: '#26292f', tank: '#38a596', tankHi: '#7fe0d0', gun: '#8d939e', brass: '#d9a441', nose: '#2a1d18', scarf: '#2f6fb0' };
  var HR = { body: E.n, dark: E.k, belly: E.l, joint: E.d, lens: E.y, rim: E.k, tank: E.c, tankHi: E.Cc, gun: E.l, brass: E.y, nose: E.k, scarf: E.B };

  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function circ(ctx, x, y, r, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
  function ell(ctx, x, y, rx, ry, a, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, a || 0, 0, Math.PI * 2); ctx.fill(); }
  function mk(w, h) { var c = (typeof document !== 'undefined') ? document.createElement('canvas') : null; if (!c) return null; c.width = w; c.height = h; return c; }
  function hash(a, b) { var h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

  // ---------- спрайты клеток ----------
  var tileCache = {};
  function tileSprites(w, retro) {
    var key = w + (retro ? 'r' : 'm');
    if (tileCache[key]) return tileCache[key];
    var p = pal(w, retro), S = {};
    function sp(name, fn) { var c = mk(T, T); if (!c) return; var x = c.getContext('2d'); fn(x); S[name] = c; }
    function fillBase(x, v) {
      x.fillStyle = v ? p.fill2 : p.fill; x.fillRect(0, 0, T, T);
      x.fillStyle = p.line;
      if (retro) { x.fillRect(0, 7, T, 1); x.fillRect(v ? 4 : 11, 0, 1, 7); x.fillRect(v ? 11 : 4, 8, 1, 8); }
      else { x.globalAlpha = 0.55; x.fillRect(0, 7, T, 1); x.fillRect(0, 15, T, 1); x.fillRect(v ? 4 : 11, 0, 1, 7); x.fillRect(v ? 11 : 4, 8, 1, 7); x.globalAlpha = 1; if (w === 2 || w === 4) { x.fillStyle = 'rgba(255,255,255,.05)'; x.fillRect(2, 2, 2, 2); x.fillRect(12, 10, 2, 2); } }
    }
    sp('fill0', function (x) { fillBase(x, 0); });
    sp('fill1', function (x) { fillBase(x, 1); });
    function topTrim(x) {
      x.fillStyle = p.top; x.fillRect(0, 0, T, retro ? 3 : 3); x.fillStyle = p.top2; x.fillRect(0, 3, T, 2);
      if (!retro) { x.fillStyle = 'rgba(255,255,255,.25)'; x.fillRect(0, 0, T, 1); x.fillStyle = p.top2; x.fillRect(3, 1, 2, 1); x.fillRect(11, 1, 2, 1); }
    }
    sp('top0', function (x) { fillBase(x, 0); topTrim(x); });
    sp('top1', function (x) { fillBase(x, 1); topTrim(x); });
    function slope(x, h0, h1) {   // поверхность от высоты h0 (лев.) до h1 (прав.), в пикселях от низа клетки
      x.save(); x.beginPath(); x.moveTo(0, T - h0); x.lineTo(T, T - h1); x.lineTo(T, T); x.lineTo(0, T); x.closePath(); x.clip();
      fillBase(x, 0); x.restore();
      x.strokeStyle = p.top; x.lineWidth = 3; x.beginPath(); x.moveTo(0, T - h0 + 1.5); x.lineTo(T, T - h1 + 1.5); x.stroke();
      x.strokeStyle = p.top2; x.lineWidth = 2; x.beginPath(); x.moveTo(0, T - h0 + 4); x.lineTo(T, T - h1 + 4); x.stroke();
    }
    sp('u45', function (x) { slope(x, 0, 16); }); sp('d45', function (x) { slope(x, 16, 0); });
    sp('ua', function (x) { slope(x, 0, 8); }); sp('ub', function (x) { slope(x, 8, 16); });
    sp('dc', function (x) { slope(x, 16, 8); }); sp('dd', function (x) { slope(x, 8, 0); });
    sp('plat', function (x) {
      x.fillStyle = p.plat; x.fillRect(0, 0, T, 5); x.fillStyle = retro ? E.k : 'rgba(0,0,0,.35)'; x.fillRect(0, 5, T, 2);
      x.fillStyle = p.plat; x.fillRect(2, 5, 2, 6); x.fillRect(12, 5, 2, 6);
      if (!retro) { x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(0, 0, T, 1); x.fillStyle = 'rgba(0,0,0,.3)'; x.fillRect(7, 1, 2, 2); }
    });
    sp('spike', function (x) {
      fillBase(x, 0); x.fillStyle = retro ? E.k : '#1b1b20'; x.fillRect(0, 0, T, 6);
      x.fillStyle = retro ? E.l : '#c9d0da';
      for (var i = 0; i < 4; i++) { x.beginPath(); x.moveTo(i * 4, 6); x.lineTo(i * 4 + 2, -2); x.lineTo(i * 4 + 4, 6); x.fill(); }
      if (!retro) { x.fillStyle = '#ff5a3c'; for (var j = 0; j < 4; j++) x.fillRect(j * 4 + 1.5, -1, 1, 2); }
    });
    sp('crate', function (x) {
      x.fillStyle = retro ? E.n : '#9a6a36'; x.fillRect(0, 0, T, T);
      x.fillStyle = retro ? E.y : '#d39b4e'; x.fillRect(1, 1, T - 2, 2); x.fillRect(1, T - 3, T - 2, 2); x.fillRect(1, 1, 2, T - 2); x.fillRect(T - 3, 1, 2, T - 2);
      x.strokeStyle = retro ? E.y : '#d39b4e'; x.lineWidth = 2; x.beginPath(); x.moveTo(3, 3); x.lineTo(T - 3, T - 3); x.stroke();
      x.fillStyle = retro ? E.k : '#4a2f16'; x.fillRect(2, 2, 1, 1); x.fillRect(T - 3, 2, 1, 1); x.fillRect(2, T - 3, 1, 1); x.fillRect(T - 3, T - 3, 1, 1);
    });
    tileCache[key] = S; return S;
  }

  // ---------- фон (параллакс) ----------
  var bgCache = {};
  function bgLayers(w, retro) {
    var key = w + (retro ? 'r' : 'm');
    if (bgCache[key]) return bgCache[key];
    var p = pal(w, retro), r = SH.levels.mulberry32(w * 77 + (retro ? 5 : 9));
    var sky = mk(VW, VH), far = mk(1280, VH), mid = mk(1024, VH);
    if (!sky) return null;
    var x = sky.getContext('2d');
    if (retro) {
      x.fillStyle = p.sky[0]; x.fillRect(0, 0, VW, VH);
      // полосы «дизеринга» к горизонту
      for (var b = 0; b < 6; b++) { x.fillStyle = b % 2 ? p.sky[2] : p.sky[1]; var y0 = VH * 0.45 + b * b * 6; x.fillRect(0, y0, VW, 4 + b * 3); }
      x.fillStyle = p.sky[2]; x.fillRect(0, VH * 0.45 + 160, VW, VH);
      if (w === 3) { x.fillStyle = E.w; for (var s = 0; s < 50; s++) x.fillRect(Math.floor(r() * VW / 2) * 2, Math.floor(r() * VH * 0.4 / 2) * 2, 2, 2); }
    } else {
      var gr = x.createLinearGradient(0, 0, 0, VH); gr.addColorStop(0, p.sky[0]); gr.addColorStop(0.55, p.sky[1]); gr.addColorStop(1, p.sky[2]);
      x.fillStyle = gr; x.fillRect(0, 0, VW, VH);
      if (w === 3) { for (var s2 = 0; s2 < 70; s2++) { x.globalAlpha = 0.3 + r() * 0.6; circ(x, r() * VW, r() * VH * 0.5, r() * 1.2 + 0.3, '#fff'); } x.globalAlpha = 1; }
      if (w === 1) { var sg = x.createRadialGradient(VW * 0.7, VH * 0.78, 10, VW * 0.7, VH * 0.78, 180); sg.addColorStop(0, 'rgba(255,190,110,.55)'); sg.addColorStop(1, 'rgba(255,190,110,0)'); x.fillStyle = sg; x.fillRect(0, 0, VW, VH); }
      if (w === 4) { x.fillStyle = 'rgba(255,255,255,.55)'; for (var cl = 0; cl < 9; cl++) { var cx = r() * VW, cy = VH * (0.25 + r() * 0.4); ell(x, cx, cy, 50 + r() * 60, 10 + r() * 8, 0, 'rgba(255,255,255,' + (0.25 + r() * 0.3) + ')'); } }
    }
    // дальний слой: силуэты
    var f = far.getContext('2d'); f.fillStyle = p.far;
    var X = 0;
    while (X < 1280) {
      var bw = 40 + r() * 90, bh = 60 + r() * 120, base = VH * 0.82;
      if (w === 1) { f.fillRect(X, base - bh, bw, bh + 80); if (r() < 0.7) f.fillRect(X + bw * 0.3, base - bh - 50 - r() * 50, 10, 120); }       // цеха и трубы
      else if (w === 2) { f.fillRect(X, base - bh * 0.6, bw, 200); f.fillRect(X + bw * 0.4, 0, 14, VH); if (r() < 0.5) f.fillRect(X, base - bh, bw + 30, 12); }   // колонны, трубы
      else if (w === 3) { f.fillRect(X, base - 30, bw, 200); if (r() < 0.5) { f.fillRect(X + bw / 2, base - bh - 40, 6, bh + 40); circ(f, X + bw / 2 + 3, base - bh - 44, 5, retro ? E.R : '#ff5a4a'); f.fillStyle = p.far; } }   // вагоны, семафоры
      else { f.fillRect(X + bw * 0.5, base - bh - 60, 8, 300); f.fillRect(X, base - bh - 60, bw, 6); f.fillRect(X + bw - 4, base - bh - 60, 2, 50); }   // краны верфи
      X += bw + 10 + r() * 60;
    }
    var m = mid.getContext('2d'); m.fillStyle = p.mid;
    X = 0;
    while (X < 1024) {
      var mw = 60 + r() * 110, mh = 40 + r() * 70, mb = VH * 0.95;
      if (w === 4) { ell(m, X + mw / 2, mb - mh * 0.6, mw * 0.7, mh * 0.35, 0, p.mid); }
      else { m.fillRect(X, mb - mh, mw, 200); if (w === 2) { m.fillRect(X - 8, mb - mh - 18, mw + 16, 10); } if (w === 1 && r() < 0.6) { m.beginPath(); m.moveTo(X, mb - mh); m.lineTo(X + mw / 2, mb - mh - 22); m.lineTo(X + mw, mb - mh); m.fill(); } if (w === 3) { m.fillRect(X, mb - mh - 6, mw, 3); } }
      X += mw + r() * 40;
    }
    bgCache[key] = { sky: sky, far: far, mid: mid }; return bgCache[key];
  }

  // ---------- герой ----------
  function hero(ctx, x, y, P, time, o) {
    o = o || {}; var retro = !!o.retro, c = retro ? HR : HM, s = o.scale || 1;
    ctx.save(); ctx.translate(x, y); ctx.scale(s * (P.face < 0 ? -1 : 1), s);
    var rot = (P.mode === 'rail' || P.ground) ? (P.rot || 0) * (P.face < 0 ? -1 : 1) : 0;
    ctx.translate(0, -10); ctx.rotate(rot); ctx.translate(0, 10);
    var sp = Math.abs(o.speed || 0), fast = sp > 360, air = !P.ground && P.mode !== 'rail';
    var ph = (P.runT || 0) * 1.6, tilt = air ? 0.2 : 0.25 + Math.min(0.45, sp / 900);
    var bob = P.ground && sp > 20 ? Math.abs(Math.sin(ph)) * 1.4 : 0;
    // хвост — сегменты с кольцами
    var tw = Math.sin(time * 9 + ph) * 2;
    var tp = [[-5, -10], [-10, -11 + tw * 0.3], [-15, -13 + tw * 0.6], [-19, -16 + tw], [-21, -20 + tw]];
    if (fast) tp = [[-5, -10], [-11, -10], [-17, -10 + tw * 0.3], [-22, -11 + tw * 0.5], [-26, -12 + tw * 0.6]];
    for (var i = tp.length - 1; i >= 0; i--) circ(ctx, tp[i][0], tp[i][1] - bob, 3.1 - i * 0.25, i % 2 ? c.dark : c.body);
    // ноги
    ctx.lineCap = 'round'; ctx.lineWidth = 3;
    function leg(off, col) {
      var a = air ? (off ? 0.9 : -0.5) : Math.sin(ph + off * Math.PI) * (sp > 20 ? 1 : 0.1);
      var fx = Math.sin(a) * 6, fy = air ? -2 : -Math.max(0, Math.cos(ph + off * Math.PI)) * (sp > 20 ? 3.5 : 0);
      ctx.strokeStyle = col; ctx.beginPath(); ctx.moveTo(-1, -9 - bob); ctx.lineTo(fx * 0.5 - 1, -5 + fy * 0.5); ctx.lineTo(fx, fy - 0.5); ctx.stroke();
      ctx.fillStyle = c.joint; ctx.fillRect(fx - 2, fy - 1.5, 4.5, 2);
    }
    leg(1, c.dark);
    // ранец-котёл
    ctx.save(); ctx.translate(-5, -18 - bob); ctx.rotate(tilt * 0.6);
    ctx.fillStyle = c.tank; rr(ctx, -4, -6, 7, 11, 2.5); ctx.fill();
    ctx.fillStyle = c.tankHi; ctx.fillRect(-3, -4, 1.5, 7); ctx.fillStyle = c.brass; ctx.fillRect(-3, -8, 5, 2.5);
    ctx.restore();
    // туловище
    ell(ctx, 1, -14 - bob, 5.6, 8.6, tilt, c.body);
    ell(ctx, 3, -12.5 - bob, 3.2, 6, tilt, c.belly);
    // шарф-ремень почтовой сумки
    ctx.strokeStyle = c.scarf; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-3, -19 - bob); ctx.lineTo(5, -9 - bob); ctx.stroke();
    leg(0, c.body);
    // голова
    var hx = 5 + tilt * 6, hy = -22 - bob + tilt * 3;
    circ(ctx, hx, hy, 5.3, c.body);
    ell(ctx, hx + 5, hy + 1.2, 4, 2.8, 0.1, c.body);
    ell(ctx, hx + 5.5, hy + 2.2, 2.6, 1.3, 0.1, c.belly);
    circ(ctx, hx + 9, hy + 0.6, 1.3, c.nose);
    circ(ctx, hx - 2.5, hy - 4.2, 2.1, c.body); circ(ctx, hx - 2.5, hy - 4.2, 1, c.dark);
    circ(ctx, hx + 0.8, hy - 5, 2, c.body); circ(ctx, hx + 0.8, hy - 5, 0.9, c.dark);
    // очки-гогглы
    ctx.fillStyle = c.rim; ctx.fillRect(hx - 5, hy - 2.6, 9, 2.2);
    circ(ctx, hx + 2.6, hy - 1.6, 2.4, c.rim); circ(ctx, hx + 2.6, hy - 1.6, 1.6, c.lens);
    if (!retro) { circ(ctx, hx + 2, hy - 2.2, 0.5, '#fff'); }
    // рука и бластер
    var up = o.aimUp ? -0.78 : 0;
    ctx.save(); ctx.translate(3, -15 - bob); ctx.rotate(up);
    ctx.strokeStyle = c.body; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(5, 1); ctx.stroke();
    ctx.fillStyle = c.gun; ctx.fillRect(4, -1.5, 9, 4); ctx.fillStyle = c.brass; ctx.fillRect(6, -2.5, 2.5, 6); ctx.fillStyle = c.tank; ctx.fillRect(11, -1, 2, 3);
    if (o.flash) { circ(ctx, 15, 0.5, 3.5, retro ? E.w : '#fff6d8'); circ(ctx, 15, 0.5, 2, retro ? E.y : '#ffd166'); }
    ctx.restore();
    ctx.restore();
  }

  // ---------- обитатели ----------
  function enemy(ctx, e, x, y, time, retro) {
    var fl = e.flash > 0;
    ctx.save(); ctx.translate(x, y);
    if (e.k === 'beetle') {
      var lg = Math.sin(time * 14 + e.id) * 2;
      ctx.strokeStyle = retro ? E.d : '#2b2f36'; ctx.lineWidth = 1.6;
      for (var i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * 6, -4); ctx.lineTo(i * 6 + (i ? lg : -lg), 0); ctx.stroke(); }
      ctx.fillStyle = fl ? '#fff' : retro ? E.l : '#6f8295'; ctx.beginPath(); ctx.ellipse(0, -5, 12, 9, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = retro ? E.d : '#4a5868'; ctx.fillRect(-12, -6, 24, 2);
      ctx.fillStyle = retro ? E.y : '#d8b25a'; for (var r2 = -1; r2 <= 1; r2++) circ(ctx, r2 * 6, -9, 1.2, ctx.fillStyle);
      circ(ctx, e.dir * 9, -7, 2.4, retro ? E.R : '#ff4b3a');
    } else if (e.k === 'roller') {
      var a = (e.x / 11) * (e.dir || 1);
      circ(ctx, 0, -11, 11, fl ? '#fff' : retro ? E.n : '#a8732f');
      circ(ctx, 0, -11, 8.5, retro ? E.k : '#5e3f1c');
      ctx.strokeStyle = retro ? E.y : '#e2b25c'; ctx.lineWidth = 2;
      for (var k = 0; k < 4; k++) { var aa = a + k * Math.PI / 2; ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(Math.cos(aa) * 8, -11 + Math.sin(aa) * 8); ctx.stroke(); }
      circ(ctx, 0, -11, 4, retro ? E.l : '#d9dde3'); circ(ctx, e.dir * 1.5, -11, 2, retro ? E.R : '#ff4b3a');
    } else if (e.k === 'wasp') {
      ctx.fillStyle = retro ? E.l : 'rgba(220,230,240,.55)';
      var pr = Math.sin(time * 50) * 9; ctx.fillRect(-Math.abs(pr), -20, Math.abs(pr) * 2, 2); ctx.fillRect(-1, -20, 2, 5);
      ell(ctx, 0, -9, 11, 6, 0, fl ? '#fff' : retro ? E.y : '#e8b93c');
      ctx.fillStyle = retro ? E.k : '#2a2622'; ctx.fillRect(-4, -15, 3, 12); ctx.fillRect(2, -15, 3, 12);
      ctx.fillStyle = retro ? E.k : '#2a2622'; ctx.beginPath(); ctx.moveTo(-e.dir * 10, -9); ctx.lineTo(-e.dir * 16, -6); ctx.lineTo(-e.dir * 10, -6); ctx.fill();
      circ(ctx, e.dir * 8, -10, 2.2, retro ? E.R : '#ff4b3a');
    } else if (e.k === 'cannon') {
      ctx.fillStyle = fl ? '#fff' : retro ? E.d : '#4b5360'; rr(ctx, -13, -22, 26, 22, 4); ctx.fill();
      ctx.fillStyle = retro ? E.l : '#7d8796'; ctx.fillRect(-13, -22, 26, 4);
      ctx.fillStyle = retro ? E.k : '#23272e'; ctx.fillRect(e.dir > 0 ? 6 : -18, -17 - (e.fireT > 0 ? 1 : 0), 12, 7);
      circ(ctx, 0, -12, 3.5, retro ? E.R : '#ff7a3a');
    }
    ctx.restore();
  }
  // ---------- Ржавый Лис и его машины ----------
  function foxHead(ctx, x, y, s, c, eye) {
    ctx.fillStyle = c.plate; ctx.beginPath(); ctx.moveTo(x - 7 * s, y - 2 * s); ctx.lineTo(x - 4 * s, y - 13 * s); ctx.lineTo(x - 1 * s, y - 5 * s); ctx.lineTo(x + 3 * s, y - 13 * s); ctx.lineTo(x + 5 * s, y - 4 * s);
    ctx.lineTo(x + 16 * s, y + 1 * s); ctx.lineTo(x + 4 * s, y + 6 * s); ctx.lineTo(x - 7 * s, y + 4 * s); ctx.closePath(); ctx.fill();
    ctx.fillStyle = c.rust; ctx.beginPath(); ctx.moveTo(x - 5 * s, y - 1 * s); ctx.lineTo(x + 12 * s, y + 1 * s); ctx.lineTo(x + 3 * s, y + 4 * s); ctx.lineTo(x - 5 * s, y + 3 * s); ctx.closePath(); ctx.fill();
    circ(ctx, x + 15.5 * s, y + 1 * s, 1.6 * s, c.dark);
    ctx.fillStyle = eye; ctx.fillRect(x + 1 * s, y - 3 * s, 4 * s, 2 * s);
  }
  function fox(ctx, x, y, b, time, retro, armor) {
    var c = retro ? { rust: E.r, plate: E.n, dark: E.k, iron: E.d, eye: E.G } : { rust: '#b4502c', plate: '#7a3a22', dark: '#211816', iron: '#3c3f46', eye: '#8dff6a' };
    if (b.flash > 0) c = { rust: '#fff', plate: '#ffe', dark: '#fff', iron: '#fff', eye: '#fff' };
    var d = b.dir || -1, ph = time * (b.state === 'dash' ? 16 : 4);
    ctx.save(); ctx.translate(x, y); ctx.scale(d, 1);
    var hh = b.h / 2;
    // хвост — толстые клёпаные сегменты с шестернёй на конце
    for (var i = 0; i < 5; i++) { var tx = -10 - i * 6, ty = -4 - i * 3 + Math.sin(ph * 0.5 + i) * 2; circ(ctx, tx, ty, 5 - i * 0.4, i % 2 ? c.iron : c.rust); }
    gear(ctx, -42, -18 + Math.sin(ph * 0.5 + 5) * 2, 5, time * 4, retro ? E.l : '#8d939e', retro);
    // ноги
    ctx.strokeStyle = c.iron; ctx.lineWidth = 4; ctx.lineCap = 'round';
    for (var k = 0; k < 2; k++) { var a = Math.sin(ph + k * Math.PI) * 0.7; ctx.beginPath(); ctx.moveTo(0, 4); ctx.lineTo(Math.sin(a) * 9, hh); ctx.stroke(); }
    // корпус
    ctx.fillStyle = c.rust; rr(ctx, -12, -hh + 10, 24, hh + 2, 6); ctx.fill();
    ctx.fillStyle = c.plate; ctx.fillRect(-10, -hh + 16, 20, 4); ctx.fillRect(-10, -hh + 24, 20, 3);
    ctx.fillStyle = c.dark; circ(ctx, -7, -hh + 13, 1.2, c.dark); circ(ctx, 7, -hh + 13, 1.2, c.dark);
    if (armor) { ctx.fillStyle = c.iron; rr(ctx, -14, -hh + 8, 10, 14, 3); ctx.fill(); ctx.fillRect(-16, -hh + 2, 6, 8); circ(ctx, -13, -hh + 2, 3, c.eye); }
    // свёрток чертежей под мышкой
    ctx.fillStyle = retro ? E.B : '#4f86c6'; rr(ctx, -4, -hh + 18, 13, 6, 2); ctx.fill(); ctx.fillStyle = retro ? E.w : '#dbe9f7'; ctx.fillRect(-2, -hh + 20, 9, 1);
    foxHead(ctx, 6, -hh + 6, armor ? 1.15 : 1, c, c.eye);
    ctx.restore();
  }
  function ram(ctx, x, y, b, time, retro) {
    var c = retro ? { body: E.d, band: E.n, dark: E.k, hot: E.R, track: E.k } : { body: '#555d6a', band: '#a8692e', dark: '#1d2026', hot: '#ff6a3a', track: '#2a2d33' };
    if (b.flash > 0) c = { body: '#fff', band: '#fff', dark: '#ddd', hot: '#fff', track: '#ddd' };
    var d = b.dir || -1, shake = b.state === 'rev' ? Math.sin(time * 80) * 1.5 : 0;
    ctx.save(); ctx.translate(x + shake, y); ctx.scale(d, 1);
    ctx.fillStyle = c.track; rr(ctx, -36, 10, 72, 13, 6); ctx.fill();
    for (var i = 0; i < 6; i++) circ(ctx, -30 + i * 12, 16.5, 4, retro ? E.l : '#7a808a');
    ctx.fillStyle = c.body; rr(ctx, -32, -20, 56, 32, 10); ctx.fill();
    ctx.fillStyle = c.band; ctx.fillRect(-20, -20, 5, 32); ctx.fillRect(4, -20, 5, 32);
    ctx.fillStyle = c.dark; ctx.fillRect(-26, -32, 9, 14);
    ctx.fillStyle = c.hot; ctx.fillRect(24, -14, 12, 22);
    ctx.fillStyle = c.dark; ctx.beginPath(); ctx.moveTo(36, -16); ctx.lineTo(44, -4); ctx.lineTo(36, 10); ctx.fill();
    // эмблема с лисьей мордой
    circ(ctx, -6, -4, 7, c.dark); foxHead(ctx, -8, -3, 0.45, { plate: c.band, rust: c.hot, dark: c.dark }, retro ? E.G : '#8dff6a');
    ctx.restore();
  }
  function cuckoo(ctx, x, y, b, time, retro) {
    var c = retro ? { wood: E.n, roof: E.r, face: E.l, dark: E.k, wing: E.d, hand: E.k } : { wood: '#7a4a2a', roof: '#a8402e', face: '#efe2c4', dark: '#2a1a12', wing: '#6b7280', hand: '#2a1a12' };
    if (b.flash > 0) c = { wood: '#fff', roof: '#fff', face: '#fff', dark: '#ddd', wing: '#fff', hand: '#999' };
    ctx.save(); ctx.translate(x, y);
    var fl = Math.sin(time * 18) * 10;
    ctx.fillStyle = c.wing; ctx.beginPath(); ctx.moveTo(-24, -6); ctx.lineTo(-48, -12 - fl); ctx.lineTo(-40, 4); ctx.fill();
    ctx.beginPath(); ctx.moveTo(24, -6); ctx.lineTo(48, -12 - fl); ctx.lineTo(40, 4); ctx.fill();
    ctx.fillStyle = c.wood; ctx.fillRect(-24, -12, 48, 36);
    ctx.fillStyle = c.roof; ctx.beginPath(); ctx.moveTo(-30, -10); ctx.lineTo(0, -32); ctx.lineTo(30, -10); ctx.fill();
    circ(ctx, 0, 6, 13, c.face); circ(ctx, 0, 6, 1.6, c.dark);
    ctx.strokeStyle = c.hand; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(Math.cos(time * 3) * 10, 6 + Math.sin(time * 3) * 10); ctx.moveTo(0, 6); ctx.lineTo(Math.cos(time * 0.5) * 6, 6 + Math.sin(time * 0.5) * 6); ctx.stroke();
    ctx.fillStyle = c.dark; ctx.fillRect(-6, -22, 12, 9);
    if (b.state === 'swoop' || Math.sin(time * 2) > 0.7) { foxHead(ctx, -4, -18, 0.55, { plate: retro ? E.n : '#7a3a22', rust: retro ? E.r : '#b4502c', dark: c.dark }, retro ? E.G : '#8dff6a'); }
    ctx.strokeStyle = c.dark; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 24); ctx.lineTo(Math.sin(time * 4) * 8, 40); ctx.stroke(); circ(ctx, Math.sin(time * 4) * 8, 42, 4, retro ? E.y : '#d9a441');
    ctx.restore();
  }
  function gear(ctx, x, y, r, a, col, retro) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.fillStyle = col;
    ctx.beginPath(); for (var i = 0; i < 16; i++) { var rr2 = i % 2 ? r : r * 0.72, aa = i / 16 * Math.PI * 2; ctx.lineTo(Math.cos(aa) * rr2, Math.sin(aa) * rr2); } ctx.closePath(); ctx.fill();
    ctx.fillStyle = retro ? E.k : 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.arc(0, 0, r * 0.32, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  var gearSpr = {};
  function gearSprite(retro, f) {
    var key = (retro ? 'r' : 'm') + f; if (gearSpr[key]) return gearSpr[key];
    var c = mk(18, 18); if (!c) return null; var x = c.getContext('2d');
    if (!retro) { x.shadowColor = 'rgba(255,200,80,.6)'; x.shadowBlur = 4; }
    gear(x, 9, 9, 6.5, f / 4 * (Math.PI / 4), retro ? E.y : '#f2c14a', retro);
    if (!retro) { x.shadowBlur = 0; x.fillStyle = 'rgba(255,255,255,.55)'; x.fillRect(6, 5, 2, 2); }
    gearSpr[key] = c; return c;
  }
  var CAPC = { burst: ['#ffd23a', E.y], blast: ['#ff7a2a', E.R], bounce: ['#5ee08a', E.G], shield: ['#64b5ff', E.B], turbo: ['#ff5ad0', E.M], magnet: ['#ff4a4a', E.r], hp: ['#7ff0e0', E.Cc], life: ['#ffffff', E.w], gears: ['#f2c14a', E.y] };
  function capIcon(ctx, k, x, y, retro, time) {
    var col = (CAPC[k] || ['#fff', E.w])[retro ? 1 : 0];
    ctx.save(); ctx.translate(x, y);
    if (!retro) { var gg = ctx.createRadialGradient(-3, -4, 1, 0, 0, 11); gg.addColorStop(0, 'rgba(255,255,255,.9)'); gg.addColorStop(0.35, 'rgba(255,255,255,.18)'); gg.addColorStop(1, 'rgba(160,200,255,.25)'); ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = 'rgba(220,235,255,.8)'; ctx.lineWidth = 1.2; ctx.stroke(); }
    else { ctx.strokeStyle = E.w; ctx.lineWidth = 2; ctx.strokeRect(-9, -9, 18, 18); }
    ctx.fillStyle = retro ? E.y : '#d9a441'; ctx.fillRect(-4, 9, 8, 3);
    ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = 2;
    switch (k) {
      case 'burst': for (var i = 0; i < 3; i++) ctx.fillRect(-6 + i * 4, -2 + (i - 1), 3, 3); break;
      case 'blast': circ(ctx, 0, 0, 4.5, col); ctx.fillStyle = retro ? E.k : '#fff'; ctx.fillRect(-1, -6, 2, 3); break;
      case 'bounce': ctx.beginPath(); ctx.moveTo(-6, 3); ctx.quadraticCurveTo(-3, -6, 0, 3); ctx.quadraticCurveTo(3, -6, 6, 3); ctx.stroke(); break;
      case 'shield': ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(6, -3); ctx.lineTo(4, 4); ctx.lineTo(0, 7); ctx.lineTo(-4, 4); ctx.lineTo(-6, -3); ctx.closePath(); ctx.fill(); break;
      case 'turbo': ctx.beginPath(); ctx.moveTo(-6, -5); ctx.lineTo(0, 0); ctx.lineTo(-6, 5); ctx.moveTo(0, -5); ctx.lineTo(6, 0); ctx.lineTo(0, 5); ctx.stroke(); break;
      case 'magnet': ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 5, Math.PI, 0, true); ctx.stroke(); ctx.fillStyle = retro ? E.w : '#ddd'; ctx.fillRect(-6.5, -2, 3, 3); ctx.fillRect(3.5, -2, 3, 3); break;
      case 'hp': ctx.fillRect(-1.5, -6, 3, 12); ctx.fillRect(-6, -1.5, 12, 3); break;
      case 'life': hero(ctx, 0, 6, { face: 1, ground: true, runT: 0 }, time, { retro: retro, scale: 0.5 }); break;
      case 'gears': gear(ctx, 0, 0, 6, time * 2, col, retro); break;
    }
    ctx.restore();
  }

  // ---------- частицы (в координатах мира) ----------
  var FX = { list: [] };
  FX.add = function (x, y, o) {
    o = o || {}; var n = o.n || 8;
    for (var i = 0; i < n && FX.list.length < 400; i++) {
      var a = o.a != null ? o.a + (Math.random() - 0.5) * (o.spread || 1) : Math.random() * Math.PI * 2, sp = (o.sp || 120) * (0.4 + Math.random() * 0.6);
      FX.list.push({ x: x, y: y, vx: Math.cos(a) * sp + (o.vx || 0), vy: Math.sin(a) * sp + (o.vy || 0), t: o.life || 0.5, life: o.life || 0.5, c: o.c || '#fff', r: o.r || 2, g: o.g == null ? 300 : o.g, puff: !!o.puff });
    }
  };
  FX.step = function (dt) { var l = FX.list; for (var i = 0; i < l.length; i++) { var p = l[i]; p.t -= dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.puff) p.r += dt * 10; } FX.list = l.filter(function (p) { return p.t > 0; }); };
  FX.clear = function () { FX.list = []; };

  // ---------- камера ----------
  function camera(cam, S, dt, snap) {
    var LV = S.LV, P = S.hero, v = L.speedOf(P);
    cam.look = cam.look == null ? 0 : cam.look;
    var want = Math.max(-150, Math.min(150, v * 0.4));
    cam.look += (want - cam.look) * Math.min(1, dt * 2.2);
    var tx = P.x + cam.look - VW / 2, ty = P.y - VH * 0.58;
    var x0 = 0, x1 = LV.w * T - VW, y1 = LV.h * T - VH;
    if (S.arenaOn || (S.boss && !S.bossDown)) { var A = LV.arena; x0 = A.x0 - 20; x1 = Math.max(x0, A.x1 + 20 - VW); tx = (A.x0 + A.x1) / 2 - VW / 2; ty = A.y - VH * 0.72; }
    tx = Math.max(x0, Math.min(x1, tx)); ty = Math.max(0, Math.min(y1, ty));
    if (snap || cam.x == null) { cam.x = tx; cam.y = ty; return; }
    cam.x += (tx - cam.x) * Math.min(1, dt * 9);
    var dy = ty - cam.y; cam.y += dy * Math.min(1, dt * (Math.abs(dy) > 60 ? 8 : 4));
  }

  // ---------- кадр ----------
  var rbuf = null;
  function render(g, ctx, S, ui) {
    var retro = g.themeName === 'retro', time = g.time, LV = S.LV, w = S.world, p = pal(w, retro), cam = ui.cam;
    var out = ctx;
    if (retro) {
      if (!rbuf) rbuf = mk(VW / 2, VH / 2);
      if (rbuf) { ctx = rbuf.getContext('2d'); ctx.setTransform(0.5, 0, 0, 0.5, 0, 0); }
    }
    var cx = Math.round(cam.x), cy = Math.round(cam.y);
    // фон
    var bg = bgLayers(w, retro);
    if (bg) {
      ctx.drawImage(bg.sky, 0, 0);
      var fx = -((cx * 0.15) % 1280); ctx.drawImage(bg.far, fx, -cy * 0.04); ctx.drawImage(bg.far, fx + 1280, -cy * 0.04);
      var mx = -((cx * 0.4) % 1024); ctx.drawImage(bg.mid, mx, -cy * 0.1 + 20); ctx.drawImage(bg.mid, mx + 1024, -cy * 0.1 + 20);
    } else { ctx.fillStyle = p.sky[1]; ctx.fillRect(0, 0, VW, VH); }
    ctx.save(); ctx.translate(-cx, -cy);
    // пар шахт (за тайлами)
    LV.steam.forEach(function (s) {
      if (s.x1 < cx || s.x0 > cx + VW) return;
      ctx.fillStyle = retro ? 'rgba(255,255,255,.18)' : 'rgba(220,240,255,.10)'; ctx.fillRect(s.x0, s.y0, s.x1 - s.x0, s.y1 - s.y0);
      for (var i = 0; i < 14; i++) { var yy = s.y1 - ((time * 160 + i * 47) % (s.y1 - s.y0)), xx = s.x0 + 8 + ((i * 29) % (s.x1 - s.x0 - 16)) + Math.sin(time * 3 + i) * 4; circ(ctx, xx, yy, retro ? 6 : 5 + (i % 3) * 2, retro ? 'rgba(255,255,255,.55)' : 'rgba(235,248,255,.35)'); }
    });
    // рельсы: опоры, полозья
    LV.rails.forEach(function (rl) {
      var pts = rl.pts; if (pts[pts.length - 1][0] < cx - 20 || pts[0][0] > cx + VW + 20) return;
      ctx.strokeStyle = retro ? E.d : '#3b3f48'; ctx.lineWidth = 4;
      for (var x = pts[0][0] + 32; x < pts[pts.length - 1][0]; x += 80) { var y = SH.levels.railY(pts, x); ctx.beginPath(); ctx.moveTo(x, y + 4); ctx.lineTo(x, y + 260); ctx.stroke(); }
      ctx.strokeStyle = retro ? E.l : '#c7ccd6'; ctx.lineWidth = 3; ctx.beginPath(); pts.forEach(function (q, i) { if (i) ctx.lineTo(q[0], q[1] + 1.5); else ctx.moveTo(q[0], q[1] + 1.5); }); ctx.stroke();
      ctx.strokeStyle = retro ? E.d : '#6e7684'; ctx.lineWidth = 2; ctx.beginPath(); pts.forEach(function (q, i) { if (i) ctx.lineTo(q[0], q[1] + 5); else ctx.moveTo(q[0], q[1] + 5); }); ctx.stroke();
    });
    // тайлы
    var TS = tileSprites(w, retro);
    var c0 = Math.max(0, Math.floor(cx / T)), c1 = Math.min(LV.w - 1, Math.floor((cx + VW) / T)), r0 = Math.max(0, Math.floor(cy / T)), r1 = Math.min(LV.h - 1, Math.floor((cy + VH) / T));
    if (TS) for (var r = r0; r <= r1; r++) for (var c = c0; c <= c1; c++) {
      var t = LV.t[r * LV.w + c]; if (!t) continue;
      var spr = null, v = (c + r) & 1;
      switch (t) {
        case C.S: var up = r > 0 ? LV.t[(r - 1) * LV.w + c] : C.S; spr = (up === C.E || up === C.P || up === C.SP || up === C.X) ? TS['top' + v] : TS['fill' + v]; break;
        case C.F: case C.H:   // ложная стена и пустота тайника — выглядят кладкой; рядом с героем «просвечивают»
          var near = Math.abs(c * T + 8 - S.hero.x) < 110 && Math.abs(r * T + 8 - (S.hero.y - 12)) < 60;
          if (near) { ctx.globalAlpha = t === C.H ? 0.18 : 0.45; ctx.drawImage(TS['fill' + v], c * T, r * T); ctx.globalAlpha = 1; spr = null; }
          else { var up2 = r > 0 ? LV.t[(r - 1) * LV.w + c] : C.S; spr = (t === C.F && (up2 === C.E || up2 === C.P)) ? TS['top' + v] : TS['fill' + v]; }
          break;
        case C.U45: spr = TS.u45; break; case C.D45: spr = TS.d45; break; case C.UA: spr = TS.ua; break; case C.UB: spr = TS.ub; break;
        case C.DC: spr = TS.dc; break; case C.DD: spr = TS.dd; break; case C.P: spr = TS.plat; break; case C.SP: spr = TS.spike; break; case C.X: spr = TS.crate; break;
      }
      if (spr) ctx.drawImage(spr, c * T, r * T);
    }
    // трубы-ускорители
    LV.pipes.forEach(function (pp) {
      var a = pp.pts; if (a[a.length - 1][0] < cx - 40 || a[0][0] > cx + VW + 40) return;
      var line = function (wd, col) { ctx.strokeStyle = col; ctx.lineWidth = wd; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.beginPath(); a.forEach(function (q, i) { if (i) ctx.lineTo(q[0], q[1] - 12); else ctx.moveTo(q[0], q[1] - 12); }); ctx.stroke(); };
      line(26, retro ? E.k : '#2a1d14'); line(22, retro ? E.n : '#b07636'); if (!retro) { line(8, 'rgba(255,220,160,.35)'); }
      for (var i = 1; i < a.length - 1; i++) { ctx.fillStyle = retro ? E.y : '#e2b25c'; ctx.fillRect(a[i][0] - 3, a[i][1] - 25, 6, 26); }
      ctx.fillStyle = retro ? E.y : '#e2b25c'; ctx.fillRect(a[0][0] - 4, a[0][1] - 28, 8, 32); ctx.fillRect(a[a.length - 1][0] - 4, a[a.length - 1][1] - 28, 8, 32);
      var P = S.hero; if (P.mode === 'pipe' && P.pipe === pp) circ(ctx, P.x, P.y - 12, 9, retro ? E.w : 'rgba(255,240,200,.9)');
    });
    // пружины
    LV.springs.forEach(function (o) {
      if (o.x < cx - 20 || o.x > cx + VW + 20) return;
      var k = o.anim > 0 ? 1 - o.anim / 0.35 : 1, h = 6 + 8 * k;
      ctx.fillStyle = retro ? E.d : '#3a3f48'; ctx.fillRect(o.x - 11, o.y - 3, 22, 3);
      ctx.strokeStyle = retro ? E.l : '#c8ced8'; ctx.lineWidth = 2; ctx.beginPath(); for (var i = 0; i <= 6; i++) ctx.lineTo(o.x + (i % 2 ? 6 : -6), o.y - 3 - h * i / 6); ctx.stroke();
      ctx.fillStyle = retro ? E.R : '#e85a3a'; ctx.fillRect(o.x - 12, o.y - 6 - h, 24, 4); ctx.fillStyle = retro ? E.y : '#ffd166'; ctx.fillRect(o.x - 12, o.y - 6 - h, 24, 1.5);
    });
    // контрольные точки — паровые клапаны
    LV.cps.forEach(function (o) {
      if (o.x < cx - 20 || o.x > cx + VW + 20) return;
      var on = S.cp && S.cp.x >= o.x;
      ctx.fillStyle = retro ? E.d : '#4a505b'; ctx.fillRect(o.x - 2, o.y - 34, 4, 34);
      ctx.strokeStyle = retro ? E.l : '#c9ced6'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(o.x, o.y - 36, 6, 0, Math.PI * 2); ctx.stroke();
      ctx.save(); ctx.translate(o.x, o.y - 36); ctx.rotate(on ? time * 3 : 0); ctx.fillRect(-6, -1, 12, 2); ctx.fillRect(-1, -6, 2, 12); ctx.restore();
      circ(ctx, o.x + 6, o.y - 26, 3, on ? (retro ? E.G : '#62ff9a') : (retro ? E.r : '#a33a2a'));
      if (on) for (var i = 0; i < 3; i++) circ(ctx, o.x + Math.sin(time * 2 + i) * 3, o.y - 46 - ((time * 30 + i * 8) % 24), 3 + i, retro ? 'rgba(255,255,255,.6)' : 'rgba(255,255,255,.35)');
    });
    // терминал пневмопочты — финиш
    var G = LV.goal;
    if (G && !G.hidden && G.x > cx - 40 && G.x < cx + VW + 40) {
      ctx.fillStyle = retro ? E.d : '#3c4250'; ctx.fillRect(G.x - 6, G.y - 70, 12, 70);
      ctx.fillStyle = retro ? E.n : '#b07636'; rr(ctx, G.x - 16, G.y - 60, 32, 26, 5); ctx.fill();
      ctx.fillStyle = retro ? E.k : '#1c1f26'; ctx.fillRect(G.x - 9, G.y - 52, 18, 5);
      ctx.fillStyle = retro ? E.y : '#ffd166'; ctx.fillRect(G.x - 9, G.y - 44, 18, 2);
      ctx.strokeStyle = retro ? E.y : '#e2b25c'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(G.x, G.y - 70); ctx.lineTo(G.x, G.y - 120); ctx.stroke();
      circ(ctx, G.x, G.y - 76, 4, (Math.floor(time * 3) % 2) ? (retro ? E.G : '#62ff9a') : (retro ? E.g : '#2c8a5a'));
    }
    // шестерни, тайники, капсулы (внутри скрытой комнаты не видны, пока герой не рядом)
    var hid = function (o) { return L.tile(LV, Math.floor(o.x / T), Math.floor(o.y / T)) === C.H && !(Math.abs(o.x - S.hero.x) < 110 && Math.abs(o.y - S.hero.y + 12) < 60); };
    var gf = Math.floor(time * 10) % 4;
    LV.gears.forEach(function (o) {
      if (S.got[o.id] || o.x < cx - 10 || o.x > cx + VW + 10 || o.y < cy - 10 || o.y > cy + VH + 10 || hid(o)) return;
      var gs = gearSprite(retro, gf); if (gs) ctx.drawImage(gs, Math.round(o.x - 9), Math.round(o.y - 9)); else gear(ctx, o.x, o.y, 6, time, '#f2c14a', retro);
    });
    LV.secrets.forEach(function (o) {
      if (S.got[o.id] || o.x < cx - 20 || o.x > cx + VW + 20 || hid(o)) return;
      var bobY = Math.sin(time * 3 + o.id) * 2;
      if (o.token) { circ(ctx, o.x, o.y + bobY, 8, retro ? E.M : '#d86bff'); gear(ctx, o.x, o.y + bobY, 5, time * 2, retro ? E.w : '#fff', retro); }
      else { ctx.fillStyle = retro ? E.Cc : '#5ce0ff'; ctx.beginPath(); ctx.moveTo(o.x, o.y - 8 + bobY); ctx.lineTo(o.x + 6, o.y + bobY); ctx.lineTo(o.x, o.y + 8 + bobY); ctx.lineTo(o.x - 6, o.y + bobY); ctx.fill(); }
    });
    LV.caps.forEach(function (o) { if (S.got[o.id] || o.x < cx - 20 || o.x > cx + VW + 20 || hid(o)) return; capIcon(ctx, o.k, o.x, o.y + Math.sin(time * 2.5 + o.id) * 2, retro, time); });
    // враги
    S.enemies.forEach(function (e) { if (!e.alive || e.x < cx - 40 || e.x > cx + VW + 40) return; enemy(ctx, e, e.x, e.y, time, retro); });
    // босс
    var b = S.boss;
    if (b) {
      ctx.save(); if (b.dead) ctx.globalAlpha = Math.max(0, 1 - b.deadT / 2);
      if (b.k === 'fox' || b.k === 'armor') fox(ctx, b.x, b.y, b, time, retro, b.k === 'armor');
      else if (b.k === 'ram') ram(ctx, b.x, b.y, b, time, retro);
      else cuckoo(ctx, b.x, b.y, b, time, retro);
      ctx.restore();
    }
    // ворота арены (пока идёт бой)
    if (S.arenaOn && LV.arena) [LV.arena.x0, LV.arena.x1].forEach(function (gx) {
      for (var i = 0; i < 9; i++) { ctx.fillStyle = retro ? E.l : '#8d939e'; ctx.fillRect(gx - 3, LV.arena.y - 16 - i * 16, 6, 12); ctx.fillStyle = retro ? E.R : '#e85a3a'; ctx.fillRect(gx - 3, LV.arena.y - 4 - i * 16, 6, 4); }
    });
    // струи пара босса
    S.vents.forEach(function (v) {
      var A = LV.arena;
      if (v.warn > 0) { ctx.fillStyle = (Math.floor(time * 12) % 2) ? (retro ? E.R : 'rgba(255,90,60,.8)') : (retro ? E.y : 'rgba(255,210,90,.6)'); ctx.fillRect(v.x - 14, A.y - 4, 28, 4); }
      else { ctx.fillStyle = retro ? 'rgba(255,255,255,.75)' : 'rgba(235,245,255,.6)'; ctx.fillRect(v.x - 16, A.y - 150, 32, 150); for (var i = 0; i < 5; i++) circ(ctx, v.x + Math.sin(time * 9 + i) * 8, A.y - 20 - i * 28, 12, retro ? 'rgba(255,255,255,.8)' : 'rgba(255,255,255,.5)'); }
    });
    // выстрелы героя
    var SC = retro ? [E.w, E.y, E.R, E.G] : ['#dff6ff', '#ffd23a', '#ff7a2a', '#5ee08a'];
    S.shots.forEach(function (s) { var r3 = s.w === 2 ? 5 : s.w === 3 ? 4 : 3; if (!retro) { ctx.globalAlpha = 0.35; circ(ctx, s.x - s.vx * 0.012, s.y - s.vy * 0.012, r3 * 0.8, SC[s.w]); ctx.globalAlpha = 1; } circ(ctx, s.x, s.y, r3, SC[s.w]); });
    S.booms.forEach(function (o) { var k = 1 - o.t / 0.3; ctx.strokeStyle = retro ? E.y : 'rgba(255,170,60,' + (1 - k) + ')'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(o.x, o.y, o.r * (0.3 + k * 0.7), 0, Math.PI * 2); ctx.stroke(); circ(ctx, o.x, o.y, o.r * 0.4 * (1 - k), retro ? E.w : 'rgba(255,240,200,.8)'); });
    // снаряды врагов
    S.eshots.forEach(function (q) {
      if (q.k === 'wrench') { ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(time * 14); ctx.fillStyle = retro ? E.l : '#b8bfca'; ctx.fillRect(-8, -2, 16, 4); circ(ctx, 8, 0, 4, ctx.fillStyle); circ(ctx, 8, 0, 1.6, retro ? E.k : '#222'); ctx.restore(); }
      else if (q.k === 'cog') gear(ctx, q.x, q.y, q.r, q.x / 9, retro ? E.l : '#a9afb9', retro);
      else if (q.k === 'puff') { circ(ctx, q.x, q.y, q.r + 2, retro ? E.l : 'rgba(230,240,250,.85)'); circ(ctx, q.x - 2, q.y - 2, q.r - 3, retro ? E.w : '#fff'); }
      else { circ(ctx, q.x, q.y, q.r, retro ? E.R : '#ff5a3a'); circ(ctx, q.x, q.y, q.r * 0.5, retro ? E.y : '#ffd166'); }
    });
    // клубы пара — за героем
    FX.list.forEach(function (q) { if (!q.puff) return; ctx.globalAlpha = Math.max(0, q.t / q.life) * 0.45; circ(ctx, q.x, q.y, q.r, q.c); });
    ctx.globalAlpha = 1;
    // герой
    var P = S.hero;
    if (P.mode !== 'pipe' && !(P.inv > 0 && S.phase === 'play' && Math.floor(time * 20) % 2)) {
      var spd = L.speedOf(P);
      if (P.tier === 2 && Math.abs(spd) > 380 && !retro) { ctx.globalAlpha = 0.15; hero(ctx, P.x - spd * 0.05, P.y, P, time, { retro: retro, speed: spd, scale: 1.15 }); ctx.globalAlpha = 1; }
      hero(ctx, P.x, P.y, P, time, { retro: retro, speed: spd, aimUp: ui.aimUp, flash: P.fireT > 0.06, scale: 1.15 });
      if (P.shield > 0) { ctx.strokeStyle = retro ? E.B : 'rgba(110,190,255,' + (0.5 + Math.sin(time * 8) * 0.2) + ')'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(P.x, P.y - 12, 18, 0, Math.PI * 2); ctx.stroke(); }
      if (P.magnet > 0) { ctx.strokeStyle = retro ? E.R : 'rgba(255,80,80,.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(P.x, P.y - 12, 26 + Math.sin(time * 6) * 3, 0, Math.PI * 2); ctx.stroke(); }
    }
    // частицы
    FX.list.forEach(function (q) { if (q.puff) return; ctx.globalAlpha = Math.max(0, q.t / q.life); circ(ctx, q.x, q.y, q.r, q.c); });
    ctx.globalAlpha = 1;
    // всплывающие надписи
    (ui.toasts || []).forEach(function (q) {
      var a = Math.min(1, q.t / 0.4); ctx.globalAlpha = a;
      ctx.font = (retro ? 'bold ' + (q.big ? 16 : 12) + 'px "Courier New", monospace' : '800 ' + (q.big ? 15 : 12) + 'px Inter, system-ui, sans-serif'); ctx.textAlign = 'center';
      var yy = q.y - (q.life - q.t) * 26;
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillText(q.text, q.x + 1, yy + 1); ctx.fillStyle = q.color; ctx.fillText(q.text, q.x, yy);
      ctx.globalAlpha = 1;
    });
    ctx.restore();
    if (retro && rbuf) { out.imageSmoothingEnabled = false; out.drawImage(rbuf, 0, 0, VW, VH); out.imageSmoothingEnabled = true; ctx = out; }
    hud(g, ctx, S, ui, retro, p);
  }

  // ---------- HUD ----------
  function hud(g, ctx, S, ui, retro, p) {
    var P = S.hero, F = retro ? '"Courier New", monospace' : 'Inter, system-ui, sans-serif', time = g.time;
    function txt(s, x, y, size, col, al, wt) { ctx.font = (wt || (retro ? 'bold' : '800')) + ' ' + size + 'px ' + F; ctx.textAlign = al || 'left'; ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillText(s, x + 1, y + 1); ctx.fillStyle = col; ctx.fillText(s, x, y); }
    var ink = retro ? E.w : '#f5efe6', mut = retro ? E.l : '#b8aea4', acc = retro ? E.y : '#ffc24a';
    if (!retro) { var gr = ctx.createLinearGradient(0, 0, 0, 34); gr.addColorStop(0, 'rgba(10,8,12,.62)'); gr.addColorStop(1, 'rgba(10,8,12,0)'); ctx.fillStyle = gr; ctx.fillRect(0, 0, VW, 40); }
    else { ctx.fillStyle = E.k; ctx.fillRect(0, 0, VW, 24); ctx.fillStyle = E.b; ctx.fillRect(0, 24, VW, 2); }
    txt(g.t('score').toUpperCase() + ' ' + S.score, 10, 17, 13, ink);
    var gs = gearSprite(retro, Math.floor(time * 8) % 4); if (gs) ctx.drawImage(gs, 150, 4);
    txt(String(S.gears), 170, 17, 13, acc);
    // жизни и давление
    for (var i = 0; i < Math.min(S.lives, 6); i++) { ctx.save(); ctx.translate(222 + i * 15, 9); ctx.scale(0.6, 0.6); hero(ctx, 0, 14, { face: 1, ground: true, runT: 0 }, 0, { retro: retro }); ctx.restore(); }
    if (S.lives > 6) txt('×' + S.lives, 222 + 6 * 15, 17, 11, ink);
    for (var h = 0; h < 3; h++) { ctx.fillStyle = h < P.hp ? (retro ? E.Cc : '#7ff0e0') : (retro ? E.d : 'rgba(255,255,255,.18)'); ctx.fillRect(222 + h * 12, 21, 10, 4); }
    // скорость: три ступени
    var sx = 330, v = Math.abs(L.speedOf(P));
    txt(g.t('speed'), sx, 12, 9, mut);
    for (var k = 0; k < 3; k++) {
      var on = P.tier >= k, part = P.tier === k && k < 2 ? Math.min(1, P.tierT / L.K.TIER_T) : 0;
      var col = k === 2 ? (retro ? E.R : '#ff6a3a') : k === 1 ? (retro ? E.y : '#ffc24a') : (retro ? E.G : '#7bd389');
      ctx.fillStyle = retro ? E.d : 'rgba(255,255,255,.15)'; ctx.beginPath(); ctx.moveTo(sx + k * 22, 16); ctx.lineTo(sx + k * 22 + 14, 16); ctx.lineTo(sx + k * 22 + 20, 21); ctx.lineTo(sx + k * 22 + 14, 26); ctx.lineTo(sx + k * 22, 26); ctx.lineTo(sx + k * 22 + 6, 21); ctx.fill();
      if (on && (k < P.tier || v > 30)) { ctx.fillStyle = col; ctx.fill(); }
      if (P.tier === k && k < 2 && part > 0) { ctx.fillStyle = col; ctx.globalAlpha = 0.5; ctx.fillRect(sx + (k + 1) * 22 + 4, 24, 14 * part, 2); ctx.globalAlpha = 1; }
    }
    // оружие и бонусы
    var wk = ['base', 'burst', 'blast', 'bounce'][S.weapon || 0];
    txt(g.t('w_' + wk), 410, 17, 11, S.weapon ? acc : mut);
    var bx = 490;
    [['shield', P.shield, L.K.SHIELD_T], ['turbo', P.turbo, L.K.TURBO_T], ['magnet', P.magnet, L.K.MAGNET_T]].forEach(function (q) {
      if (!(q[1] > 0)) return; capIcon(ctx, q[0], bx, 13, retro, time); ctx.fillStyle = retro ? E.w : '#fff'; ctx.fillRect(bx - 9, 25, 18 * q[1] / q[2], 2); bx += 24;
    });
    // мир/акт/время
    var tm = S.actTime, mm = Math.floor(tm / 60), ss = Math.floor(tm % 60);
    var lab = S.inBonus ? g.t('bonusStage') : (S.world + '-' + S.act);
    txt(lab, VW - 10, 12, 10, mut, 'right');
    txt(mm + ':' + (ss < 10 ? '0' : '') + ss, VW - 10, 26, 13, ink, 'right');
    // бонус-этап
    if (S.inBonus) {
      txt(Math.ceil(S.bonusT) + ' ' + g.t('sec'), VW / 2, 52, 18, S.bonusT < 8 ? (retro ? E.R : '#ff6a5a') : ink, 'center');
      txt(S.bonusGot + ' / ' + S.LV.need, VW / 2, 70, 13, acc, 'center');
    }
    // полоса босса
    var b = S.boss;
    if (b && !b.dead) {
      var bw = 260, bx0 = (VW - bw) / 2, by = VH - 18;
      ctx.fillStyle = retro ? E.k : 'rgba(0,0,0,.55)'; ctx.fillRect(bx0 - 2, by - 2, bw + 4, 10);
      ctx.fillStyle = retro ? E.R : '#ff5a3a'; ctx.fillRect(bx0, by, bw * Math.max(0, b.hp) / b.max, 6);
      txt(g.t('b_' + b.k), VW / 2, by - 6, 11, ink, 'center');
    }
    // баннер
    var bn = ui.banner;
    if (bn) {
      var a = Math.min(1, bn.a / 0.4, (bn.dur - bn.a) / 0.25 + 0.0001); a = Math.max(0, Math.min(1, a));
      ctx.globalAlpha = a;
      var lines = bn.lines || [], hgt = 64 + lines.length * 18;
      var y0 = VH * 0.32 - hgt / 2;
      if (retro) { ctx.fillStyle = E.k; ctx.fillRect(VW / 2 - 190, y0, 380, hgt); ctx.fillStyle = E.B; ctx.fillRect(VW / 2 - 190, y0, 380, 3); ctx.fillRect(VW / 2 - 190, y0 + hgt - 3, 380, 3); }
      else { ctx.fillStyle = 'rgba(14,10,16,.78)'; rr(ctx, VW / 2 - 190, y0, 380, hgt, 14); ctx.fill(); ctx.strokeStyle = 'rgba(255,194,74,.5)'; ctx.lineWidth = 1.5; ctx.stroke(); }
      txt(bn.title, VW / 2, y0 + 32, retro ? 20 : 22, acc, 'center');
      if (bn.sub) txt(bn.sub, VW / 2, y0 + 52, 12, ink, 'center', retro ? 'bold' : '600');
      lines.forEach(function (ln, i) { txt(ln, VW / 2, y0 + 72 + i * 18, 12, i === lines.length - 1 && bn.lastHi ? acc : ink, 'center', retro ? 'bold' : '600'); });
      ctx.globalAlpha = 1;
    }
  }

  SH.render = render;
  SH.R = { VW: VW, VH: VH, hero: hero, fox: fox, ram: ram, cuckoo: cuckoo, enemy: enemy, gear: gear, capIcon: capIcon, camera: camera, FX: FX, pal: pal, bgLayers: bgLayers, rr: rr, E: E, HM: HM, HR: HR };
})(typeof window !== 'undefined' ? window : globalThis);
