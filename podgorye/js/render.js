/* ПОДГОРЬЕ · render.js — отрисовка мира в обеих темах: modern (основная: мягкий свет, градиенты, глубина)
   и retro (16 цветов, плоские тайлы, «пиксельные» контуры). Тема меняет только картинку.
   R.draw(g, ctx, S, ui) — кадр игры; статичный слой комнаты кэшируется (комната + тема + ревизия клеток).
   Фигуры: hero (Огнёвка), enemy, boss, objects. Размер клетки TS = 16, кадр 640×360. */
(function (global) {
  'use strict';
  var P = global.PODGORYE = global.PODGORYE || {};
  var T = P.T, K = P.K, TS = 16, VW = 640, VH = 360;

  // ---------- палитры зон ----------
  var ZM = [   // modern
    { bg0: '#1b130e', bg1: '#2e2016', far: '#3a2a1e', rock: '#5c4634', hi: '#8a6a4a', lo: '#2a1e15', mort: '#4a382a', edge: '#c88a4a', acc: '#e8903a' },   // Ворота
    { bg0: '#081a20', bg1: '#0f2c33', far: '#16404a', rock: '#355450', hi: '#5a8a7e', lo: '#182a28', mort: '#2a4442', edge: '#7fc9a8', acc: '#6fd3c6' },   // Затопленный
    { bg0: '#0d1626', bg1: '#182a44', far: '#22385a', rock: '#5a6e8e', hi: '#a8c4e2', lo: '#28364c', mort: '#4a5c78', edge: '#e8f6ff', acc: '#a8e6ff' },   // Ледяные
    { bg0: '#1a0806', bg1: '#36110a', far: '#4a1a0e', rock: '#4c2a20', hi: '#8a4a2a', lo: '#200e0a', mort: '#3a1e16', edge: '#ff9a4a', acc: '#ff8a3d' },   // Раскалённые
    { bg0: '#0b170f', bg1: '#16301c', far: '#1e4026', rock: '#4a5838', hi: '#7a9a50', lo: '#222c1a', mort: '#3c4a2e', edge: '#9ccc65', acc: '#b6e07a' },   // Сады
    { bg0: '#100c1a', bg1: '#1c142e', far: '#281e40', rock: '#4a3e64', hi: '#7a6aa0', lo: '#221a34', mort: '#3a3052', edge: '#e0b04c', acc: '#f0c860' },   // Чертоги
    { bg0: '#18080c', bg1: '#2e0c12', far: '#40121a', rock: '#5a2a2e', hi: '#9a4a40', lo: '#2a1013', mort: '#4a2024', edge: '#ffb070', acc: '#ff6a5a' }    // Сердце
  ];
  var E = { k: '#000000', b: '#0000aa', g: '#00aa00', c: '#00aaaa', r: '#aa0000', m: '#aa00aa', n: '#aa5500', l: '#aaaaaa', d: '#555555', B: '#5555ff', G: '#55ff55', C: '#55ffff', R: '#ff5555', M: '#ff55ff', y: '#ffff55', w: '#ffffff' };
  var ZR = [   // retro
    { bg0: E.k, far: '#1a1a1a', rock: E.n, hi: E.y, lo: E.d, mort: E.k, edge: E.y, acc: E.y },
    { bg0: E.k, far: '#001a2a', rock: E.c, hi: E.C, lo: E.b, mort: E.b, edge: E.C, acc: E.C },
    { bg0: E.k, far: '#0a0a2a', rock: E.l, hi: E.w, lo: E.B, mort: E.B, edge: E.C, acc: E.C },
    { bg0: E.k, far: '#2a0000', rock: E.r, hi: E.R, lo: E.d, mort: E.k, edge: E.y, acc: E.R },
    { bg0: E.k, far: '#002a00', rock: E.g, hi: E.G, lo: E.d, mort: E.k, edge: E.G, acc: E.G },
    { bg0: E.k, far: '#1a001a', rock: E.m, hi: E.M, lo: E.d, mort: E.k, edge: E.y, acc: E.y },
    { bg0: E.k, far: '#2a0010', rock: E.r, hi: E.M, lo: E.m, mort: E.k, edge: E.y, acc: E.R }
  ];
  function pal(g, zone) { return (g.themeName === 'retro' ? ZR : ZM)[zone] || ZM[0]; }
  function hash(a, b) { var h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

  // ---------- статичный слой комнаты ----------
  var cache = { key: '', cv: null, dyn: null };
  function solidAt(R, c, r) { var k = P.phys.tile(R, c, r); return P.SOLID[k] && k !== T.SHUT; }
  function buildStatic(g, R, retro) {
    var cv = document.createElement('canvas'); cv.width = R.W * TS; cv.height = R.H * TS;
    var x = cv.getContext('2d'), Z = pal(g, R.src.zone), zone = R.src.zone, dyn = [];
    x.imageSmoothingEnabled = false;
    // задняя стена: кладка и арки (только в пустоте)
    x.fillStyle = retro ? Z.bg0 : Z.bg1; x.globalAlpha = 0; x.fillRect(0, 0, cv.width, cv.height); x.globalAlpha = 1;
    var rr = P.mulberry32(R.i * 977 + 13);
    if (!retro) {
      x.fillStyle = Z.far; x.globalAlpha = 0.4;
      for (var a = 0; a < R.W / 9; a++) {   // арки и колонны древнего города
        var ax = (a * 9 + rr() * 4) * TS, aw = (3 + rr() * 3) * TS, ah = (6 + rr() * 8) * TS, ay = R.H * TS - 3 * TS - ah;
        x.fillRect(ax, ay, aw * 0.25, ah); x.fillRect(ax + aw * 0.75, ay, aw * 0.25, ah);
        x.beginPath(); x.arc(ax + aw / 2, ay, aw / 2, Math.PI, 0); x.lineTo(ax + aw * 0.75, ay); x.arc(ax + aw / 2, ay, aw * 0.25, 0, Math.PI, true); x.closePath(); x.fill();
      }
      x.globalAlpha = 0.1;
      for (var bx = 0; bx < R.W; bx += 2) for (var by = 0; by < R.H; by += 1) { if (hash(bx + R.i, by) < 0.5) x.fillRect(bx * TS + (by % 2) * TS, by * TS + 2, TS * 2 - 2, TS - 3); }
      x.globalAlpha = 1;
    } else {
      x.fillStyle = Z.far;
      for (var bx2 = 0; bx2 < R.W; bx2 += 3) for (var by2 = 1; by2 < R.H; by2 += 2) if (hash(bx2 + R.i, by2) < 0.25) x.fillRect(bx2 * TS + 4, by2 * TS + 4, TS * 2, 2);
    }
    decor(x, R, Z, retro, zone, rr);
    // клетки
    for (var r = 0; r < R.H; r++) for (var c = 0; c < R.W; c++) {
      var k = R.t[r * R.W + c], px = c * TS, py = r * TS;
      if (k === T.ROCK || k === T.FALSE) drawRock(x, R, c, r, px, py, Z, retro, zone, k === T.FALSE);
      else if (k === T.ICE) { drawRock(x, R, c, r, px, py, Z, retro, zone); x.fillStyle = retro ? E.C : 'rgba(200,240,255,0.85)'; x.fillRect(px, py, TS, 5); if (!retro) { x.fillStyle = 'rgba(255,255,255,0.7)'; x.fillRect(px + 2, py + 1, 5, 1); } }
      else if (k === T.ONE) drawPlank(x, px, py, Z, retro, zone);
      else if (k === T.CRACK) { drawRock(x, R, c, r, px, py, Z, retro, zone); x.strokeStyle = retro ? E.k : 'rgba(0,0,0,0.75)'; x.lineWidth = retro ? 2 : 1.5; x.beginPath(); var s = hash(c, r); x.moveTo(px + 3 + s * 5, py + 1); x.lineTo(px + 8, py + 7); x.lineTo(px + 5 + s * 4, py + 15); x.moveTo(px + 8, py + 7); x.lineTo(px + 14, py + 10); x.stroke(); }
      else if (k === T.IRON) { x.fillStyle = retro ? E.d : '#3a3a42'; x.fillRect(px, py, TS, TS); x.fillStyle = retro ? E.l : '#5a5a66'; x.fillRect(px + 1, py + 1, TS - 2, 2); x.fillStyle = retro ? E.k : '#22222a'; x.fillRect(px, py + TS - 2, TS, 2); x.fillStyle = retro ? E.l : '#8a8a96'; x.fillRect(px + 3, py + 4, 2, 2); x.fillRect(px + 11, py + 4, 2, 2); x.fillRect(px + 3, py + 11, 2, 2); x.fillRect(px + 11, py + 11, 2, 2); }
      else if (k === T.SPIKE) dyn.push([c, r, k]);
      else if (k === T.WATER || k === T.HOTW || k === T.HEAT || k === T.STEAM || k === T.LIGHT || k === T.SEAL || k === T.SHUT) dyn.push([c, r, k]);
    }
    return { cv: cv, dyn: dyn };
  }
  // декор заднего плана: цепи, лампы, трубы, шестерни, лозы, кристаллы, статуи Кузнецов — по зонам
  function airAt(R, c, r) { var k = P.phys.tile(R, c, r); return k === T.AIR || k === T.WATER; }
  function decor(x, R, Z, retro, zone, rr) {
    var W = R.W, H = R.H, n = Math.floor(W * H / 70);
    var col = function (m, r) { return retro ? r : m; };
    for (var i = 0; i < n; i++) {
      var c = 2 + Math.floor(rr() * (W - 4)), r = 1 + Math.floor(rr() * (H - 4)), kind = rr();
      if (!airAt(R, c, r)) continue;
      var px = c * TS, py = r * TS;
      // крепление к потолку: ищем камень выше
      var top = r; while (top > 0 && airAt(R, c, top - 1)) top--;
      var hang = r - top;
      if (kind < 0.22 && hang < 9 && top > 0) {            // цепь (и лампа)
        x.fillStyle = col('rgba(30,24,20,0.8)', E.d);
        for (var y = top * TS; y < py; y += 6) { x.fillRect(px + 7, y, 2, 4); }
        if (zone === 0 || zone === 5 || zone === 6) { x.fillStyle = col('#c9a24a', E.y); x.fillRect(px + 4, py, 8, 7); x.fillStyle = col('rgba(255,200,110,0.95)', E.w); x.fillRect(px + 6, py + 2, 4, 3);
          if (!retro) { var gl = x.createRadialGradient(px + 8, py + 4, 1, px + 8, py + 4, 40); gl.addColorStop(0, 'rgba(255,180,90,0.22)'); gl.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gl; x.fillRect(px - 32, py - 36, 80, 80); } }
      } else if (kind < 0.38 && (zone === 0 || zone === 1 || zone === 3)) {   // труба вдоль свода с вентилем
        var len = 4 + Math.floor(rr() * 10), ok = true; for (var q = 0; q < len; q++) if (!airAt(R, c + q, r)) { ok = false; break; }
        if (!ok) continue;
        x.globalAlpha = retro ? 1 : 0.45;   // фон: тусклее мостков, чтобы не путать с опорой
        x.fillStyle = col(zone === 1 ? '#2a4444' : '#3e2c20', E.d); x.fillRect(px, py + 6, len * TS, 4);
        x.fillStyle = col('#6a5434', E.d); x.fillRect(px + Math.floor(len / 2) * TS + 5, py + 3, 6, 10);
        x.globalAlpha = 1;
      } else if (kind < 0.5 && (zone === 0 || zone === 5)) {   // шестерня в стене
        var rad = 10 + rr() * 14; x.fillStyle = col('rgba(0,0,0,0.25)', E.d); x.beginPath();
        for (var k = 0; k < 24; k++) { var a = k * Math.PI / 12, rd = k % 2 ? rad : rad * 0.82; x.lineTo(px + 8 + Math.cos(a) * rd, py + 8 + Math.sin(a) * rd); } x.fill();
        x.fillStyle = col(Z.bg1 || '#000', E.k); x.beginPath(); x.arc(px + 8, py + 8, rad * 0.35, 0, 7); x.fill();
      } else if (kind < 0.62 && zone === 4 && hang < 12 && top > 0) {   // висячие лозы и горшки садов
        x.strokeStyle = col('#3e6a2a', E.g); x.lineWidth = 2; x.beginPath(); x.moveTo(px + 8, top * TS); x.quadraticCurveTo(px + 2, (top * TS + py) / 2, px + 8, py + 8); x.stroke();
        x.fillStyle = col('#6aa040', E.G); for (var lf = top * TS + 8; lf < py; lf += 10) x.fillRect(px + 4 + (lf % 20 ? 4 : -2), lf, 4, 3);
        if (rr() < 0.4) { x.fillStyle = col('#8a5a3a', E.n); x.fillRect(px + 3, py + 6, 10, 7); x.fillStyle = col('#e05a8a', E.M); x.fillRect(px + 5, py + 3, 3, 3); }
      } else if (kind < 0.62 && zone === 2) {   // кристаллы льда
        var cr = 3 + rr() * 5; x.fillStyle = col('rgba(170,220,255,0.35)', E.C); x.beginPath(); x.moveTo(px + 8, py - cr * 2); x.lineTo(px + 8 + cr, py + 4); x.lineTo(px + 8, py + 10); x.lineTo(px + 8 - cr, py + 4); x.fill();
      } else if (kind < 0.62 && zone === 3) {   // раскалённые трещины
        x.strokeStyle = col('rgba(255,110,30,0.4)', E.R); x.lineWidth = 1.5; x.beginPath(); x.moveTo(px, py); x.lineTo(px + 6, py + 8); x.lineTo(px + 3, py + 16); x.lineTo(px + 10, py + 24); x.stroke();
      } else if (kind < 0.7 && zone === 5) {    // знамя Кузнецов
        x.fillStyle = col('#4a2a4a', E.m); x.fillRect(px, py, 14, 26); x.fillStyle = col('#e0b04c', E.y); x.fillRect(px + 4, py + 8, 6, 6); x.fillRect(px, py, 14, 2);
        x.beginPath(); x.moveTo(px, py + 26); x.lineTo(px + 7, py + 20); x.lineTo(px + 14, py + 26); x.fillStyle = col(Z.bg1 || '#000', E.k); x.fill();
      } else if (kind < 0.76 && (zone === 1)) { // потёки и водоросли
        x.fillStyle = col('rgba(90,160,140,0.25)', E.c); x.fillRect(px + 6, py, 3, 20 + rr() * 30);
      } else if (kind < 0.8 && r > H - 12 && (zone === 5 || zone === 0) && rr() < 0.5) {   // статуя древнего Кузнеца (силуэт)
        var gy = r; while (gy < H - 1 && airAt(R, c, gy + 1)) gy++;
        var sy = (gy + 1) * TS, sh = 70 + rr() * 30; x.fillStyle = col('rgba(0,0,0,0.28)', '#222222');
        x.fillRect(px - 10, sy - 10, 36, 10); x.fillRect(px - 4, sy - sh, 24, sh - 10); x.beginPath(); x.arc(px + 8, sy - sh - 8, 10, 0, 7); x.fill();
        x.fillRect(px + 18, sy - sh + 10, 14, 6); x.fillRect(px + 28, sy - sh - 4, 8, 20);   // поднятый молот
      }
    }
  }
  function drawRock(x, R, c, r, px, py, Z, retro, zone, fake) {
    var up = !solidAt(R, c, r - 1), dn = !solidAt(R, c, r + 1), lf = !solidAt(R, c - 1, r), rt = !solidAt(R, c + 1, r);
    var deep = !up && !dn && !lf && !rt && solidAt(R, c, r - 2) && solidAt(R, c, r + 2) && solidAt(R, c - 2, r) && solidAt(R, c + 2, r);
    if (retro) {
      x.fillStyle = deep ? Z.lo : Z.rock; x.fillRect(px, py, TS, TS);
      if (!deep) { x.fillStyle = Z.mort; var off = (r % 2) * 8; x.fillRect(px, py + 7, TS, 2); x.fillRect(px + ((off + 4) % 16), py, 2, 7); x.fillRect(px + ((off + 12) % 16), py + 9, 2, 7); }
      if (up) { x.fillStyle = Z.hi; x.fillRect(px, py, TS, 2); }
      if (dn) { x.fillStyle = Z.lo; x.fillRect(px, py + TS - 2, TS, 2); }
      if (fake) { x.fillStyle = Z.lo; x.fillRect(px + 7, py + 3, 1, 1); }
      return;
    }
    var v = hash(c * 3, r * 7);
    x.fillStyle = deep ? Z.lo : Z.rock; x.fillRect(px, py, TS, TS);
    if (!deep) {
      x.fillStyle = 'rgba(0,0,0,' + (0.08 + v * 0.14).toFixed(3) + ')'; x.fillRect(px, py, TS, TS);
      x.fillStyle = Z.mort; var o2 = (r % 2) * 8; x.fillRect(px, py + TS - 1, TS, 1); x.fillRect(px + o2, py, 1, TS);
      x.fillStyle = 'rgba(255,255,255,0.05)'; x.fillRect(px + 1, py + 1, TS - 3, 2);
    }
    if (up) {
      x.fillStyle = Z.hi; x.fillRect(px, py, TS, 3);
      x.fillStyle = Z.edge; x.globalAlpha = 0.5; x.fillRect(px, py, TS, 1); x.globalAlpha = 1;
      if (zone === 4 && hash(c, r) < 0.6) { x.fillStyle = '#6aa040'; x.fillRect(px + 2, py - 2, 3, 3); x.fillRect(px + 9, py - 1, 4, 2); }   // мох
      if (zone === 2) { x.fillStyle = '#e8f4ff'; x.fillRect(px, py, TS, 2); }                                                             // иней
      if (zone === 1 && hash(c, r) < 0.4) { x.fillStyle = '#8a5a2a'; x.fillRect(px + 4, py + 2, 2, 4); }                                    // ржавчина
    }
    if (dn) { x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(px, py + TS - 3, TS, 3); if (zone === 2 && hash(c, r + 1) < 0.3) { x.fillStyle = 'rgba(220,240,255,0.8)'; x.beginPath(); x.moveTo(px + 5, py + TS); x.lineTo(px + 8, py + TS + 6); x.lineTo(px + 11, py + TS); x.fill(); } }
    if (lf) { x.fillStyle = 'rgba(255,255,255,0.08)'; x.fillRect(px, py, 2, TS); }
    if (rt) { x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(px + TS - 2, py, 2, TS); }
    if (fake) { x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(px + 7, py + 2, 1, 5); }
  }
  function drawPlank(x, px, py, Z, retro, zone) {
    if (retro) { x.fillStyle = E.n; x.fillRect(px, py, TS, 5); x.fillStyle = E.y; x.fillRect(px, py, TS, 1); x.fillStyle = E.k; x.fillRect(px + 7, py + 1, 1, 4); return; }
    var col = zone === 2 ? '#7e98b8' : zone === 3 ? '#6a4a3a' : zone === 4 ? '#6a7a3a' : zone === 5 ? '#7a6a4a' : '#7a5a3a';
    x.fillStyle = col; x.fillRect(px, py, TS, 5);
    x.fillStyle = 'rgba(255,255,255,0.22)'; x.fillRect(px, py, TS, 1);
    x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(px, py + 4, TS, 1); x.fillRect(px + 15, py, 1, 5);
    x.fillStyle = '#c8a060'; x.fillRect(px + 3, py + 2, 1, 1); x.fillRect(px + 12, py + 2, 1, 1);
  }

  // ---------- фон (параллакс) ----------
  function backdrop(g, ctx, R, cam, t, retro) {
    var Z = pal(g, R.src.zone);
    if (retro) { ctx.fillStyle = Z.bg0; ctx.fillRect(0, 0, VW, VH); return; }
    var gr = ctx.createLinearGradient(0, 0, 0, VH); gr.addColorStop(0, Z.bg0); gr.addColorStop(1, Z.bg1); ctx.fillStyle = gr; ctx.fillRect(0, 0, VW, VH);
    // дальние своды и цепи
    ctx.fillStyle = Z.far; ctx.globalAlpha = 0.35;
    var px = -(cam.x * 0.25) % 220;
    for (var i = -1; i < 5; i++) { var x0 = px + i * 220; ctx.fillRect(x0 + 30, 0, 18, VH); ctx.beginPath(); ctx.arc(x0 + 140, 40, 90, 0, Math.PI); ctx.fill(); }
    ctx.globalAlpha = 0.2; ctx.fillStyle = Z.acc;
    for (var j = 0; j < 16; j++) { var sx = ((j * 97 + R.i * 31) % VW - cam.x * 0.1 % VW + VW) % VW, sy = ((j * 53 + t * (8 + j % 5)) % VH); ctx.fillRect(sx, VH - sy, 2, 2); }   // плывущие искры/частицы
    ctx.globalAlpha = 1;
  }

  // ---------- динамичные клетки ----------
  function dynTiles(ctx, R, dyn, cam, t, retro, S) {
    for (var i = 0; i < dyn.length; i++) {
      var c = dyn[i][0], r = dyn[i][1], k = R.t[r * R.W + c];
      var px = c * TS - cam.x, py = r * TS - cam.y;
      if (px < -TS || px > VW || py < -TS || py > VH) continue;
      var zone = R.src.zone;
      if (k === T.SPIKE) {
        if (zone === 3 || zone === 6) { var gl = 0.7 + Math.sin(t * 4 + c) * 0.2; ctx.fillStyle = retro ? (Math.floor(t * 4 + c) % 2 ? E.R : E.y) : 'rgba(255,' + (90 + Math.floor(gl * 60)) + ',20,1)'; ctx.fillRect(px, py + 6, TS, TS - 6); if (!retro) { ctx.fillStyle = 'rgba(255,220,120,0.8)'; ctx.fillRect(px, py + 6, TS, 2); } }
        else {
          ctx.fillStyle = retro ? (zone === 2 ? E.C : zone === 4 ? E.G : E.l) : (zone === 2 ? '#cfefff' : zone === 4 ? '#5a7a2a' : '#9aa0aa');
          for (var s = 0; s < 4; s++) { ctx.beginPath(); ctx.moveTo(px + s * 4, py + TS); ctx.lineTo(px + s * 4 + 2, py + 5); ctx.lineTo(px + s * 4 + 4, py + TS); ctx.fill(); }
        }
      } else if (k === T.WATER || k === T.HOTW) {
        var above = P.phys.tile(R, c, r - 1), surf = !P.phys.isWater(above) && !P.SOLID[above];
        ctx.fillStyle = retro ? (k === T.HOTW ? 'rgba(170,0,0,0.5)' : 'rgba(0,0,170,0.55)') : (k === T.HOTW ? 'rgba(200,80,40,0.38)' : 'rgba(40,130,170,0.38)');
        ctx.fillRect(px, py, TS, TS);
        if (surf) { var wy = Math.sin(t * 2 + c * 0.7) * 1.5; ctx.fillStyle = retro ? E.C : 'rgba(170,230,255,0.7)'; ctx.fillRect(px, py + 2 + wy, TS, retro ? 2 : 1.5); }
      } else if (k === T.HEAT) {
        ctx.fillStyle = retro ? (Math.floor(t * 6 + c + r) % 3 === 0 ? 'rgba(255,85,85,0.45)' : 'rgba(170,0,0,0.3)') : 'rgba(255,' + (100 + Math.floor(Math.sin(t * 5 + c + r) * 40)) + ',30,0.28)';
        ctx.fillRect(px, py, TS, TS);
        if (!retro && (c + r) % 3 === 0) { ctx.fillStyle = 'rgba(255,200,120,0.25)'; ctx.fillRect(px + 4 + Math.sin(t * 3 + r) * 3, py + ((t * 30 + c * 5) % TS), 2, 4); }
      } else if (k === T.STEAM) {
        for (var q = 0; q < 3; q++) { var ph2 = (t * 1.6 + q / 3 + r * 0.37 + c * 0.13) % 1; ctx.fillStyle = retro ? (q % 2 ? E.w : E.l) : 'rgba(235,240,245,' + (0.5 - ph2 * 0.35).toFixed(2) + ')'; var rad = 4 + ph2 * 6; if (retro) ctx.fillRect(px + 4 + q * 3, py + TS - ph2 * TS - 3, 5, 5); else { ctx.beginPath(); ctx.arc(px + 8 + Math.sin(ph2 * 6 + q) * 3, py + TS - ph2 * TS, rad * 0.6, 0, 7); ctx.fill(); } }
      } else if (k === T.LIGHT) {
        ctx.fillStyle = retro ? E.n : '#8a6a2a'; ctx.fillRect(px, py, TS, TS);
        ctx.fillStyle = retro ? E.y : '#d8b25a'; ctx.fillRect(px + 2, py + 2, TS - 4, TS - 4);
        ctx.fillStyle = retro ? E.k : '#2a1e10'; ctx.fillRect(px + 6, py + 6, 4, 4);
        if (S && S.beam) { ctx.fillStyle = 'rgba(255,240,170,0.5)'; ctx.fillRect(px + 5, py + 5, 6, 6); }
      } else if (k === T.SEAL) {
        ctx.fillStyle = retro ? E.m : '#5a3a7a'; ctx.fillRect(px, py, TS, TS);
        ctx.fillStyle = retro ? E.y : '#e0b04c'; ctx.fillRect(px, py, TS, 2); ctx.fillRect(px + 7, py + 4, 2, 8);
      } else if (k === T.SHUT) {
        ctx.fillStyle = retro ? E.d : '#3a3a44'; ctx.fillRect(px + 2, py, 3, TS); ctx.fillRect(px + 11, py, 3, TS);
        ctx.fillStyle = retro ? E.l : '#7a7a88'; ctx.fillRect(px, py + 6, TS, 3);
      }
    }
  }

  // ---------- Огнёвка ----------
  // Облик: горчичная рабочая рубаха, кожаный фартук, бирюзовый шарф, тёмно-рыжее каре; фонарь-искра в руке, сумка на боку.
  function hero(ctx, h, S, x, y, retro, t) {
    var ab = S.prog.ab, f = h.face, run = h.ground && Math.abs(h.vx) > 0.5, ph2 = run ? Math.sin(t * 16) : 0;
    var C = retro ? { skin: '#ffcc99', hair: E.r, shirt: E.y, apron: E.n, scarf: E.c, leg: E.d, boot: ab.boots ? E.l : E.k, lamp: E.y, glow: E.w, bag: E.n, cloak: E.d, trim: E.R }
                  : { skin: '#f0c8a0', hair: '#7a3220', shirt: '#d9a441', apron: '#6b4a2e', scarf: '#2fb5a5', leg: '#3a2c26', boot: ab.boots ? '#8a7a6a' : '#2a1e18', lamp: '#c9a24a', glow: '#ffd27a', bag: '#7a5434', cloak: '#3a3438', trim: '#e07a3a' };
    if (S.inv > 0 && Math.floor(t * 20) % 2 === 0 && S.phase === 'play') return;
    ctx.save(); ctx.translate(Math.round(x), Math.round(y));
    if (f < 0) ctx.scale(-1, 1);
    var pose = h.hook ? 'hang' : h.cling ? 'cling' : h.wet && ab.bell ? 'swim' : !h.ground ? 'air' : 'stand';
    if (h.dashT > 0) { ctx.fillStyle = retro ? E.l : 'rgba(255,240,220,0.35)'; ctx.fillRect(-18, -20, 12, 3); ctx.fillRect(-22, -12, 14, 3); }
    // плащ (жаростойкий)
    if (ab.cloak) { ctx.fillStyle = C.cloak; ctx.beginPath(); ctx.moveTo(-3, -22); ctx.lineTo(-8 - (run ? 2 + ph2 : 1), -6); ctx.lineTo(-2, -6); ctx.closePath(); ctx.fill(); ctx.fillStyle = C.trim; ctx.fillRect(-8 - (run ? 2 + ph2 : 1), -7, 6, 1); }
    // ноги
    var l1 = pose === 'air' ? -2 : ph2 * 3, l2 = pose === 'air' ? 2 : -ph2 * 3;
    ctx.fillStyle = C.leg; ctx.fillRect(-4 + l1, -9, 3, 7); ctx.fillRect(1 + l2, -9, 3, 7);
    ctx.fillStyle = C.boot; ctx.fillRect(-4 + l1, -3, 4, 3); ctx.fillRect(1 + l2, -3, 4, 3);
    if (ab.boots && !h.ground && h.dj && !retro) { ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.beginPath(); ctx.arc(0, 2, 4, 0, 7); ctx.fill(); }
    // тело: рубаха и фартук
    ctx.fillStyle = C.shirt; ctx.fillRect(-5, -19, 10, 11);
    ctx.fillStyle = C.apron; ctx.fillRect(-2, -16, 6, 9);
    ctx.fillStyle = C.bag; ctx.fillRect(-6, -11, 3, 4);   // сумка инструментов
    // шарф
    ctx.fillStyle = C.scarf; ctx.fillRect(-5, -20, 10, 3); ctx.fillRect(-7 - (run ? 2 : 0) + (pose === 'air' ? -1 : 0), -19 + Math.round(Math.sin(t * 9)), 3, 5);
    // голова
    if (pose === 'swim' && h.head) { ctx.fillStyle = retro ? E.y : '#c9a24a'; ctx.beginPath(); ctx.arc(1, -25, 6, Math.PI, 0); ctx.fill(); ctx.fillRect(-5, -25, 12, 4); ctx.fillStyle = retro ? E.C : '#9fe4ff'; ctx.fillRect(1, -27, 4, 3); }
    else {
      ctx.fillStyle = C.skin; ctx.fillRect(-3, -26, 7, 6);
      ctx.fillStyle = C.hair; ctx.fillRect(-4, -28, 8, 3); ctx.fillRect(-4, -26, 2, 5); ctx.fillRect(3, -27, 2, 2);
      ctx.fillStyle = retro ? E.k : '#1a1010'; ctx.fillRect(2, -24, 1, 1);
    }
    // рука с фонарём
    var ly = pose === 'hang' ? -30 : pose === 'cling' ? -20 : -15, lx = pose === 'hang' ? 1 : 6;
    ctx.fillStyle = ab.gloves ? (retro ? E.n : '#5a3a20') : C.skin; ctx.fillRect(3, ly - 1, 3, 2);
    if (pose === 'hang') { ctx.fillStyle = retro ? E.l : '#bbb'; ctx.fillRect(1, ly - 10, 1, 10); }
    ctx.fillStyle = C.lamp; ctx.fillRect(lx, ly, 4, 5);
    ctx.fillStyle = C.glow; ctx.fillRect(lx + 1, ly + 1, 2, 3);
    if (S.chargeT > 0.2 && S.charging) { var cr = Math.min(1, S.chargeT / (S.prog.ups.charge ? 0.45 : 0.75)); ctx.strokeStyle = retro ? E.y : 'rgba(255,220,120,' + (0.4 + cr * 0.5) + ')'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(lx + 2, ly + 2, 3 + cr * 5, 0, Math.PI * 2 * cr); ctx.stroke(); }
    ctx.restore();
  }

  // ---------- враги ----------
  function enemy(ctx, e, x, y, retro, t, Z, lit) {
    if (e.dead) return;
    if (e.type === 'icicle' && e.st === 'gone') return;
    if (e.type === 'wisp' && !lit) { ctx.fillStyle = retro ? E.m : 'rgba(180,120,255,0.18)'; ctx.fillRect(x - 3, y - 10, 2, 2); ctx.fillRect(x + 2, y - 10, 2, 2); return; }
    var fl = e.flash > 0, W = e.w * TS, H = e.h * TS, f = e.face;
    ctx.save(); ctx.translate(Math.round(x), Math.round(y));
    var M = function (c) { return fl ? '#ffffff' : c; };
    switch (e.type) {
      case 'crawler': {   // шестерня на лапках
        ctx.fillStyle = M(retro ? E.l : '#8a7a6a');
        var a0 = t * 5 * f; for (var i = 0; i < 6; i++) { var a = a0 + i * Math.PI / 3; ctx.fillRect(Math.cos(a) * 6 - 2, -7 + Math.sin(a) * 6 - 2, 4, 4); }
        ctx.beginPath(); ctx.arc(0, -7, 5.5, 0, 7); ctx.fill();
        ctx.fillStyle = M(retro ? E.R : '#ff7a3a'); ctx.fillRect(f * 2 - 1, -9, 3, 3);
        ctx.fillStyle = M(retro ? E.d : '#4a3a30'); ctx.fillRect(-6, -2, 3, 2); ctx.fillRect(3, -2, 3, 2);
        break;
      }
      case 'flyer': {    // мехокрыл: меха с перепончатыми крыльями
        var wv = Math.sin(t * 14) * 4;
        ctx.fillStyle = M(retro ? E.n : '#7a5434'); ctx.beginPath(); ctx.moveTo(-3, -6); ctx.lineTo(-12, -9 - wv); ctx.lineTo(-6, -3); ctx.fill(); ctx.beginPath(); ctx.moveTo(3, -6); ctx.lineTo(12, -9 - wv); ctx.lineTo(6, -3); ctx.fill();
        ctx.fillStyle = M(retro ? E.y : '#c9a24a'); ctx.fillRect(-4, -9, 8, 7);
        ctx.fillStyle = M(retro ? E.k : '#3a2a1a'); ctx.fillRect(-4, -7, 8, 1); ctx.fillRect(-4, -5, 8, 1);
        ctx.fillStyle = M(retro ? E.R : '#ff5a3a'); ctx.fillRect(f * 2, -8, 2, 2);
        break;
      }
      case 'turret': {   // чадник: печная труба-горшок
        ctx.fillStyle = M(retro ? E.d : '#4a4048'); ctx.fillRect(-8, -12, 16, 12);
        ctx.fillStyle = M(retro ? E.l : '#6a6070'); ctx.fillRect(-9, -14, 18, 3);
        ctx.fillStyle = M(retro ? E.R : (e.cd < 0.5 ? '#ffb040' : '#ff6a2a')); ctx.fillRect(-4 + f * 3, -9, 6, 4);
        ctx.fillStyle = 'rgba(80,70,70,0.5)'; ctx.beginPath(); ctx.arc(f * 2, -18 - (t * 10 % 6), 3, 0, 7); ctx.fill();
        break;
      }
      case 'hopper': case 'slag': {
        var sq = e.vy === 0 ? 2 : -1;
        if (e.type === 'slag') { ctx.fillStyle = M(retro ? E.R : '#ff6a2a'); ctx.beginPath(); ctx.ellipse(0, -6 + sq, 8, 6 - sq, 0, 0, 7); ctx.fill(); ctx.fillStyle = M(retro ? E.y : '#ffd27a'); ctx.fillRect(-3, -8, 2, 2); ctx.fillRect(2, -8, 2, 2); ctx.fillStyle = retro ? E.k : '#5a1a0a'; ctx.fillRect(-6, -3 + sq, 12, 1); }
        else { ctx.fillStyle = M(retro ? E.l : '#9a9aa6'); for (var s2 = 0; s2 < 3; s2++) ctx.fillRect(-4, -4 - s2 * 3 + sq, 8, 2); ctx.fillStyle = M(retro ? E.g : '#6a8a4a'); ctx.fillRect(-6, -14 + sq * 2, 12, 5); ctx.fillStyle = M(retro ? E.y : '#ffe06a'); ctx.fillRect(f * 3 - 1, -13 + sq * 2, 2, 2); }
        break;
      }
      case 'sentry': {   // щитоносец
        ctx.fillStyle = M(retro ? E.d : '#5a5060'); ctx.fillRect(-6, -24, 12, 22);
        ctx.fillStyle = M(retro ? E.l : '#8a8090'); ctx.fillRect(-4, -28, 8, 5);
        ctx.fillStyle = M(retro ? E.R : '#ff5a3a'); ctx.fillRect(f * 2 - 1, -27, 3, 2);
        ctx.fillStyle = M(retro ? E.y : '#c9a24a'); ctx.fillRect(f * 6 - (f > 0 ? 0 : 4), -22, 4, 18);
        ctx.fillStyle = M(retro ? E.k : '#2a2228'); ctx.fillRect(-5, -2, 4, 2); ctx.fillRect(1, -2, 4, 2);
        break;
      }
      case 'fish': {
        ctx.fillStyle = M(retro ? E.c : '#5a8a9a'); ctx.beginPath(); ctx.moveTo(f * 9, -5); ctx.lineTo(-f * 5, -10); ctx.lineTo(-f * 5, 0); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-f * 5, -5); ctx.lineTo(-f * 10, -10); ctx.lineTo(-f * 10, 0); ctx.fill();
        ctx.fillStyle = M(retro ? E.y : '#ffe06a'); ctx.fillRect(f * 4 - 1, -7, 2, 2);
        break;
      }
      case 'icicle': {
        var sh = e.st === 'shake' ? Math.sin(t * 60) * 1.5 : 0;
        ctx.fillStyle = M(retro ? E.C : '#cfefff'); ctx.beginPath(); ctx.moveTo(-5 + sh, -H); ctx.lineTo(5 + sh, -H); ctx.lineTo(sh, 0); ctx.fill();
        break;
      }
      case 'vine': {
        ctx.strokeStyle = M(retro ? E.g : '#4a7a2a'); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-4, -10, (e.ext * f * TS) * 0.9, -14); ctx.stroke();
        var hx = e.ext * f * TS; ctx.fillStyle = M(retro ? E.G : '#8aba4a'); ctx.beginPath(); ctx.arc(hx, -15, 6, 0, 7); ctx.fill();
        ctx.fillStyle = M(retro ? E.R : '#d0402a'); ctx.beginPath(); ctx.moveTo(hx + f * 2, -15); ctx.lineTo(hx + f * 8, -18); ctx.lineTo(hx + f * 8, -12); ctx.fill();
        break;
      }
      case 'wisp': case 'spark': {
        var cc = e.type === 'spark' ? (retro ? E.R : '#ff7a3a') : (retro ? E.m : '#6a4a9a');
        if (!retro) { var gr = ctx.createRadialGradient(0, -6, 1, 0, -6, 10); gr.addColorStop(0, cc); gr.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gr; ctx.fillRect(-10, -16, 20, 20); }
        ctx.fillStyle = M(cc); ctx.beginPath(); ctx.arc(0, -6, 5, 0, 7); ctx.fill();
        ctx.fillStyle = M(retro ? E.w : '#fff4d0'); ctx.fillRect(-3, -8, 2, 2); ctx.fillRect(2, -8, 2, 2);
        break;
      }
    }
    ctx.restore();
  }

  // ---------- боссы ----------
  function boss(ctx, B, cam, retro, t) {
    if (!B || B.dead) return;
    var fl = B.flash > 0, M = function (c) { return fl ? '#ffffff' : c; };
    var p0 = B.parts[0], X = function (v) { return v * TS - cam.x; }, Y = function (v) { return v * TS - cam.y; };
    ctx.save();
    if (B.st === 'intro') ctx.globalAlpha = Math.min(1, B.t / 1.1);
    switch (B.id) {
      case 'gatekeeper': {   // шагающие ворота с кулаками-молотами
        var x = X(p0.x), y = Y(p0.y), w = p0.w * TS, h = p0.h * TS, wind = (B.st === 'slam' && B.t < 0.65) || (B.st === 'charge' && B.t < 0.7);
        ctx.fillStyle = M(retro ? E.n : '#6a4a2e'); ctx.fillRect(x - w / 2, y - h / 2, w, h);
        ctx.fillStyle = M(retro ? E.y : '#c9a24a'); for (var i = 0; i < 4; i++) ctx.fillRect(x - w / 2, y - h / 2 + 8 + i * 16, w, 3);
        ctx.fillStyle = M(retro ? E.d : '#3a2a1e'); ctx.fillRect(x - 6, y - 4, 12, h / 2 + 4);
        ctx.fillStyle = M(retro ? E.R : (wind ? '#ffd040' : '#ff6a2a')); ctx.fillRect(x - 12, y - h / 2 + 12, 8, 6); ctx.fillRect(x + 4, y - h / 2 + 12, 8, 6);
        var ay = wind ? -16 : 0;
        ctx.fillStyle = M(retro ? E.l : '#7a7a86'); ctx.fillRect(x - w / 2 - 10, y - 10 + ay, 10, 26); ctx.fillRect(x + w / 2, y - 10 + ay, 10, 26);
        ctx.fillStyle = M(retro ? E.d : '#4a4a56'); ctx.fillRect(x - w / 2 - 14, y + 12 + ay, 18, 10); ctx.fillRect(x + w / 2 - 4, y + 12 + ay, 18, 10);
        break;
      }
      case 'pump': {
        var x2 = X(p0.x), y2 = Y(p0.y);
        ctx.fillStyle = retro ? E.l : '#5a6a6e'; ctx.fillRect(x2 - 3, 0, 6, y2 - 30);
        ctx.fillStyle = M(retro ? E.c : '#3a7a80'); ctx.beginPath(); ctx.ellipse(x2, y2, 36, 30, 0, 0, 7); ctx.fill();
        ctx.fillStyle = M(retro ? E.C : '#6fd3c6'); ctx.fillRect(x2 - 30, y2 - 4, 60, 6);
        ctx.fillStyle = M(retro ? E.b : '#1a3a40'); ctx.beginPath(); ctx.arc(x2, y2 + 18, 12, 0, Math.PI); ctx.fill();
        ctx.fillStyle = M(retro ? E.y : '#ffe06a'); ctx.fillRect(x2 - 16, y2 - 16, 8, 8); ctx.fillRect(x2 + 8, y2 - 16, 8, 8);
        var pp = Math.sin(t * 6) * 4; ctx.fillStyle = M(retro ? E.l : '#8a9aa0'); ctx.fillRect(x2 - 44, y2 - 10 + pp, 10, 20); ctx.fillRect(x2 + 34, y2 - 10 - pp, 10, 20);
        break;
      }
      case 'drill': {
        var x3 = X(p0.x), y3 = Y(p0.y), vert = B.st === 'out' || B.st === 'rise';
        ctx.translate(x3, y3); if (vert) ctx.rotate(-Math.PI / 2); else if (B.d.side < 0) ctx.scale(-1, 1);
        ctx.fillStyle = M(retro ? E.l : '#7a8aa0'); ctx.fillRect(0, -13, 34, 26);
        ctx.fillStyle = M(retro ? E.C : '#cfefff'); ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(-30, 0); ctx.lineTo(0, 13); ctx.fill();
        ctx.strokeStyle = retro ? E.B : '#5a7090'; ctx.lineWidth = 2; for (var s = 0; s < 4; s++) { var o = ((t * 60 + s * 8) % 30); ctx.beginPath(); ctx.moveTo(-o, -13 + o * 0.43); ctx.lineTo(-o + 6, 13 - o * 0.43); ctx.stroke(); }
        ctx.fillStyle = M(retro ? E.R : '#ff7a3a'); ctx.fillRect(20, -6, 6, 6);
        break;
      }
      case 'pendulum': {
        var bx = X(p0.x), by = Y(p0.y), ox = X(B.x), oy = Y(B.y);
        ctx.strokeStyle = retro ? E.l : '#8a8070'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(bx, by); ctx.stroke();
        for (var k = 1; k < 8; k++) { ctx.fillStyle = retro ? E.g : '#4a7a2a'; ctx.fillRect(ox + (bx - ox) * k / 8 - 3, oy + (by - oy) * k / 8, 6, 3); }
        ctx.fillStyle = M(retro ? E.g : '#5a8a3a'); ctx.beginPath(); ctx.arc(bx, by, 26, 0, 7); ctx.fill();
        ctx.fillStyle = M(retro ? E.y : '#c9a24a'); ctx.beginPath(); ctx.arc(bx, by, 16, 0, 7); ctx.fill();
        ctx.fillStyle = M(retro ? E.R : '#e04a2a'); ctx.beginPath(); ctx.arc(bx, by, 7 + Math.sin(t * 5) * 1.5, 0, 7); ctx.fill();
        break;
      }
      case 'smelter': {
        var x5 = X(p0.x), y5 = Y(p0.y), w5 = p0.w * TS, h5 = p0.h * TS;
        ctx.fillStyle = M(retro ? E.d : '#4a3a36'); ctx.fillRect(x5 - w5 / 2, y5 - h5 / 2 + 14, w5, h5 - 14);
        ctx.fillStyle = M(retro ? E.l : '#6a5a52'); ctx.beginPath(); ctx.ellipse(x5 + B.face * 10, y5 - h5 / 2 + 14, 26, 12, 0, 0, Math.PI); ctx.fill();
        ctx.fillStyle = M(retro ? E.R : '#ff7a2a'); ctx.beginPath(); ctx.ellipse(x5 + B.face * 10, y5 - h5 / 2 + 15, 22, 6, 0, 0, 7); ctx.fill();
        ctx.fillStyle = M(retro ? E.y : '#ffd27a'); ctx.fillRect(x5 - 12, y5 - 6, 8, 6); ctx.fillRect(x5 + 4, y5 - 6, 8, 6);
        ctx.fillStyle = M(retro ? E.k : '#2a1e1a'); ctx.fillRect(x5 - w5 / 2 + 4, y5 + h5 / 2 - 10, 14, 10); ctx.fillRect(x5 + w5 / 2 - 18, y5 + h5 / 2 - 10, 14, 10);
        break;
      }
      case 'smith': {
        var hx0 = X(p0.x), hy0 = Y(p0.y);
        ctx.fillStyle = M(retro ? E.d : '#3a3448'); ctx.fillRect(hx0 - 22, hy0 - 10, 44, 18); ctx.fillRect(hx0 - 14, hy0 - 22, 28, 14);
        ctx.fillStyle = M(retro ? E.y : '#e0b04c'); ctx.fillRect(hx0 - 22, hy0 - 12, 44, 3);
        ctx.fillStyle = M(retro ? E.R : '#ff6a3a'); ctx.fillRect(hx0 - 9, hy0 - 4, 6, 5); ctx.fillRect(hx0 + 3, hy0 - 4, 6, 5);
        for (var m = 1; m < 3; m++) { var hp = B.parts[m], hx = X(hp.x), hy = Y(hp.y), warn = B.d.hm[m - 1].st === 'aim' || B.d.hm[m - 1].st === 'sweepW';
          ctx.fillStyle = retro ? E.l : '#7a7a8a'; ctx.fillRect(hx - 2, hy - 30, 4, 22);
          ctx.fillStyle = retro ? (warn ? E.y : E.l) : (warn ? '#e0b04c' : '#9a9aaa'); ctx.fillRect(hx - hp.w * TS / 2, hy - hp.h * TS / 2, hp.w * TS, hp.h * TS);
          ctx.fillStyle = retro ? E.d : '#5a5a6a'; ctx.fillRect(hx - hp.w * TS / 2, hy + hp.h * TS / 2 - 5, hp.w * TS, 5);
          if (B.d.hm[m - 1].st === 'aim') { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(hx - 20, Y(19) - 4, 40, 4); } }
        break;
      }
      case 'scale': {
        var sx = X(p0.x), sy = Y(p0.y), rad = p0.w * TS / 2;
        if (!retro) { var gr = ctx.createRadialGradient(sx, sy, 2, sx, sy, rad * 2.2); gr.addColorStop(0, B.phase === 2 ? 'rgba(255,120,60,0.6)' : 'rgba(255,80,60,0.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gr; ctx.fillRect(sx - rad * 2.2, sy - rad * 2.2, rad * 4.4, rad * 4.4); }
        if (B.phase === 1) {
          ctx.fillStyle = M(retro ? E.d : '#4a3a3a');
          for (var q = 0; q < 8; q++) { var a = t * 0.8 + q * Math.PI / 4; ctx.save(); ctx.translate(sx + Math.cos(a) * rad * 0.7, sy + Math.sin(a) * rad * 0.7); ctx.rotate(a); ctx.fillRect(-10, -7, 20, 14); ctx.restore(); }
          ctx.fillStyle = M(retro ? E.r : '#8a2a2a'); ctx.beginPath(); ctx.arc(sx, sy, rad * 0.6, 0, 7); ctx.fill();
        } else {
          ctx.fillStyle = M(retro ? E.R : '#ff5a3a'); ctx.beginPath(); ctx.arc(sx, sy, rad, 0, 7); ctx.fill();
          ctx.fillStyle = M(retro ? E.y : '#ffd27a'); ctx.beginPath(); ctx.arc(sx, sy, rad * 0.55 + Math.sin(t * 9) * 2, 0, 7); ctx.fill();
        }
        ctx.fillStyle = retro ? E.w : '#fff4d0'; ctx.fillRect(sx - 8, sy - 4, 4, 4); ctx.fillRect(sx + 4, sy - 4, 4, 4);
        break;
      }
    }
    ctx.restore();
  }

  // ---------- объекты ----------
  function objects(ctx, R, S, cam, retro, t) {
    var rm = R.src, Z = pal({ themeName: retro ? 'retro' : 'modern' }, rm.zone);
    rm.objs.forEach(function (o) {
      var x = o.x * TS - cam.x, y = o.y * TS - cam.y;
      if (o.type === 'anvil') {
        var on = S.prog.anvil === o.id;
        if (!retro && on) { var gr = ctx.createRadialGradient(x, y - 10, 2, x, y - 10, 34); gr.addColorStop(0, 'rgba(255,170,80,0.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gr; ctx.fillRect(x - 34, y - 44, 68, 68); }
        ctx.fillStyle = retro ? E.d : '#4a4a52'; ctx.fillRect(x - 10, y - 12, 20, 5); ctx.fillRect(x - 4, y - 7, 8, 5); ctx.fillRect(x - 8, y - 2, 16, 2);
        ctx.fillStyle = retro ? E.l : '#7a7a86'; ctx.fillRect(x - 10, y - 12, 20, 1); ctx.fillRect(x + 10, y - 11, 5, 3);
        ctx.fillStyle = retro ? (on ? E.y : E.R) : (on ? '#ffd27a' : '#c05a2a'); ctx.fillRect(x - 2, y - 15 - Math.abs(Math.sin(t * 3)) * 2, 4, 3);
      } else if (o.type === 'lift') {
        var act = S.prog.lifts[o.id];
        ctx.fillStyle = retro ? E.l : '#7a6a5a'; ctx.fillRect(x - 22, -cam.y, 2, y + cam.y - 30); ctx.fillRect(x + 20, -cam.y, 2, y + cam.y - 30);
        ctx.fillStyle = retro ? E.n : '#5a4636'; ctx.fillRect(x - 24, y - 32, 48, 4); ctx.fillRect(x - 24, y - 3, 48, 3);
        ctx.strokeStyle = retro ? E.l : '#9a8a70'; ctx.lineWidth = 1; for (var b = -20; b <= 20; b += 8) { ctx.beginPath(); ctx.moveTo(x + b, y - 28); ctx.lineTo(x + b, y - 3); ctx.stroke(); }
        ctx.fillStyle = act ? (retro ? E.G : '#7bd389') : (retro ? E.R : '#a05a3a'); ctx.fillRect(x - 3, y - 38, 6, 5);
      } else if (o.type === 'forge') {
        var lit = S.prog.forges[o.fid];
        ctx.fillStyle = retro ? E.d : '#3a3036'; ctx.fillRect(x - 32, y - 40, 64, 40);
        ctx.fillStyle = retro ? E.l : '#5a4a50'; ctx.fillRect(x - 36, y - 44, 72, 6); ctx.fillRect(x - 12, y - 80, 24, 38);
        ctx.fillStyle = lit ? (retro ? (Math.floor(t * 6) % 2 ? E.y : E.R) : '#ffb040') : (retro ? E.k : '#1a1418'); ctx.fillRect(x - 18, y - 28, 36, 22);
        if (lit && !retro) { var g2 = ctx.createRadialGradient(x, y - 18, 4, x, y - 18, 90); g2.addColorStop(0, 'rgba(255,160,60,0.5)'); g2.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g2; ctx.fillRect(x - 90, y - 108, 180, 180); for (var fl = 0; fl < 5; fl++) { ctx.fillStyle = 'rgba(255,' + (180 + fl * 10) + ',80,0.7)'; ctx.fillRect(x - 14 + fl * 7, y - 30 - Math.abs(Math.sin(t * 7 + fl)) * 10, 4, 10); } }
      } else if (o.type === 'heart') {
        var pulse = 1 + Math.sin(t * (S.prog.bosses.scale ? 5 : 1.5)) * 0.08, hy = y - 60;
        if (!retro) { var g3 = ctx.createRadialGradient(x, hy, 4, x, hy, 120); g3.addColorStop(0, S.prog.bosses.scale ? 'rgba(255,120,80,0.6)' : 'rgba(120,60,60,0.3)'); g3.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g3; ctx.fillRect(x - 120, hy - 120, 240, 240); }
        ctx.save(); ctx.translate(x, hy); ctx.scale(pulse, pulse);
        ctx.fillStyle = retro ? (S.prog.bosses.scale ? E.R : E.r) : (S.prog.bosses.scale ? '#ff5a3a' : '#6a2a2a');
        ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(26, -6); ctx.lineTo(14, 26); ctx.lineTo(-14, 26); ctx.lineTo(-26, -6); ctx.closePath(); ctx.fill();
        ctx.fillStyle = retro ? E.y : 'rgba(255,220,140,0.85)'; ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(10, -2); ctx.lineTo(0, 14); ctx.lineTo(-10, -2); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    });
    // кольца крюка
    R.rings.forEach(function (o) { var x = o.x * TS - cam.x, y = o.y * TS - cam.y; ctx.strokeStyle = retro ? E.l : '#7a6a5a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y - 6); ctx.lineTo(x, y - 40); ctx.stroke(); ctx.strokeStyle = retro ? E.y : '#d8b25a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 5, 0, 7); ctx.stroke(); });
    // предметы
    rm.items.forEach(function (it) {
      if (S.prog.items[it.id] || (it.boss && !S.prog.bosses[it.boss])) return;
      var x = it.x * TS - cam.x, y = it.y * TS - cam.y - 12 + Math.sin(t * 3 + it.id) * 2;
      itemIcon(ctx, it.type, x, y, retro, t, true);
    });
  }
  function itemIcon(ctx, type, x, y, retro, t, glow) {
    if (glow && !retro) { var gr = ctx.createRadialGradient(x, y, 1, x, y, 18); gr.addColorStop(0, 'rgba(255,220,140,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gr; ctx.fillRect(x - 18, y - 18, 36, 36); }
    if (type === 'vessel') { ctx.fillStyle = retro ? E.l : '#cfe0e8'; ctx.fillRect(x - 5, y - 4, 10, 10); ctx.fillRect(x - 2, y - 8, 4, 4); ctx.fillStyle = retro ? E.R : '#ff6a3a'; ctx.fillRect(x - 3, y - 1, 6, 6); ctx.fillStyle = retro ? E.y : '#ffd27a'; ctx.fillRect(x - 1, y - 1 - Math.abs(Math.sin(t * 6)) * 2, 2, 3); }
    else if (type === 'tank') { ctx.fillStyle = retro ? E.n : '#b8862e'; ctx.fillRect(x - 5, y - 7, 10, 14); ctx.fillStyle = retro ? E.C : '#9fe4ff'; ctx.fillRect(x - 3, y - 4, 6, 8); ctx.fillStyle = retro ? E.w : '#fff'; ctx.fillRect(x - 1, y - 2, 2, 4); }
    else if (type.indexOf('up:') === 0) { ctx.fillStyle = retro ? E.y : '#e0b04c'; for (var i = 0; i < 8; i++) { var a = i * Math.PI / 4 + t; ctx.fillRect(x + Math.cos(a) * 7 - 2, y + Math.sin(a) * 7 - 2, 4, 4); } ctx.beginPath(); ctx.arc(x, y, 6, 0, 7); ctx.fill(); ctx.fillStyle = retro ? E.C : '#9fe4ff'; ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fill(); }
    else if (type.indexOf('ab:') === 0) { abilityIcon(ctx, type.slice(3), x, y, retro, 1.3); }
  }
  // значки способностей (HUD, предметы, карта)
  function abilityIcon(ctx, ab, x, y, retro, s) {
    s = s || 1; ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = retro ? E.n : '#5a4636'; ctx.fillRect(-7, -7, 14, 14);
    ctx.fillStyle = retro ? E.y : '#ffd27a';
    switch (ab) {
      case 'boots': ctx.fillRect(-4, -5, 4, 8); ctx.fillRect(-4, 1, 8, 3); ctx.fillStyle = retro ? E.w : '#ffffff'; ctx.fillRect(2, -5, 2, 2); ctx.fillRect(4, -3, 2, 2); break;
      case 'dash': for (var i = 0; i < 3; i++) ctx.fillRect(-5 + i * 3, -1 - i, 3, 2 + i * 2); ctx.fillRect(3, -4, 2, 8); break;
      case 'gloves': ctx.fillRect(-4, -2, 7, 6); ctx.fillRect(-4, -6, 2, 4); ctx.fillRect(-1, -6, 2, 4); ctx.fillRect(2, -5, 2, 3); break;
      case 'hook': ctx.fillRect(-1, -6, 2, 8); ctx.fillRect(-4, 1, 8, 2); ctx.fillRect(-4, -1, 2, 2); ctx.fillRect(2, -1, 2, 2); break;
      case 'hammer': ctx.fillRect(-5, -5, 10, 4); ctx.fillRect(-1, -1, 2, 7); break;
      case 'bell': ctx.beginPath(); ctx.arc(0, 1, 5, Math.PI, 0); ctx.fill(); ctx.fillRect(-5, 1, 10, 3); ctx.fillStyle = retro ? E.C : '#9fe4ff'; ctx.fillRect(-1, -2, 3, 2); break;
      case 'cloak': ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(5, 5); ctx.lineTo(-5, 5); ctx.fill(); ctx.fillStyle = retro ? E.R : '#ff7a3a'; ctx.fillRect(-5, 4, 10, 1); break;
      case 'light': ctx.fillRect(-2, -5, 4, 7); ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.moveTo(2, -3); ctx.lineTo(7, -6); ctx.lineTo(7, 4); ctx.lineTo(2, 1); ctx.fill(); ctx.globalAlpha = 1; break;
      case 'spark': ctx.beginPath(); ctx.arc(0, 0, 3, 0, 7); ctx.fill(); break;
    }
    ctx.restore();
  }

  // ---------- кадр ----------
  function camera(S) {
    var R = S.R, h = S.hero;
    var cx = h.x * TS - VW / 2, cy = (h.y - 1) * TS - VH / 2;
    cx = R.W * TS <= VW ? (R.W * TS - VW) / 2 : Math.max(0, Math.min(R.W * TS - VW, cx));
    cy = R.H * TS <= VH ? (R.H * TS - VH) / 2 : Math.max(-8, Math.min(R.H * TS - VH + 4, cy));
    return { x: Math.round(cx), y: Math.round(cy) };
  }
  var dark = null;
  function draw(g, ctx, S, ui) {
    var retro = g.themeName === 'retro', t = g.time, R = S.R, rm = R.src;
    var key = R.i + ':' + g.themeName + ':' + (R.rev || 0);
    if (cache.key !== key) { var b = buildStatic(g, R, retro); cache = { key: key, cv: b.cv, dyn: b.dyn }; }
    var cam = camera(S);
    if (ui && ui.shake) { cam.x += Math.round((Math.random() - 0.5) * ui.shake); cam.y += Math.round((Math.random() - 0.5) * ui.shake); }
    backdrop(g, ctx, R, cam, t, retro);
    ctx.drawImage(cache.cv, -cam.x, -cam.y);
    objects(ctx, R, S, cam, retro, t);
    var h = S.hero, hx = h.x * TS - cam.x, hy = h.y * TS - cam.y, lr = (S.beam ? 10 : (S.prog.ab.light ? 7 : 4.5)) * TS;
    // враги и снаряды
    R.ens.forEach(function (e) { var ex = e.x * TS - cam.x, ey = e.y * TS - cam.y; if (ex < -40 || ex > VW + 40 || ey < -40 || ey > VH + 40) return; var lit = !R.dark || ((ex - hx) * (ex - hx) + (ey - hy) * (ey - hy) < lr * lr * 0.8); enemy(ctx, e, ex, ey, retro, t, null, lit); });
    boss(ctx, S.boss, cam, retro, t);
    R.haz.forEach(function (z) {
      var x0 = z.x0 * TS - cam.x, y0 = z.y0 * TS - cam.y, w = (z.x1 - z.x0) * TS, hh = (z.y1 - z.y0) * TS;
      if (z.t < z.warn) { ctx.fillStyle = retro ? (Math.floor(t * 10) % 2 ? E.R : E.k) : 'rgba(255,90,60,' + (0.15 + 0.15 * Math.sin(t * 20)).toFixed(2) + ')'; ctx.fillRect(x0, z.kind === 'icicle' || z.kind === 'drip' ? 0 : y0, w, z.kind === 'icicle' || z.kind === 'drip' ? 6 : hh); return; }
      var col = { wave: retro ? E.y : '#ffd27a', jet: retro ? E.C : 'rgba(120,220,255,0.75)', icicle: retro ? E.C : '#cfefff', burst: retro ? E.C : 'rgba(200,240,255,0.8)', vine: retro ? E.G : '#6aa040', slag: retro ? E.R : '#ff7a2a', pillar: retro ? E.R : 'rgba(255,120,40,0.8)', beam: retro ? E.R : 'rgba(255,80,60,0.85)', drip: retro ? E.y : '#ff9a4a' }[z.kind] || '#fff';
      ctx.fillStyle = col; ctx.fillRect(x0, y0, w, hh);
      if (!retro && (z.kind === 'beam' || z.kind === 'pillar')) { ctx.fillStyle = 'rgba(255,240,200,0.7)'; ctx.fillRect(x0, y0 + hh * 0.35, w, hh * 0.3); }
    });
    R.eshots.forEach(function (q) { var x = q.x * TS - cam.x, y = q.y * TS - cam.y; ctx.fillStyle = retro ? (q.kind === 'bubble' || q.kind === 'drop' ? E.C : q.kind === 'seed' ? E.G : E.R) : ({ soot: '#4a4044', rivet: '#c9c0b0', bubble: 'rgba(160,230,255,0.8)', drop: '#7ad0ff', seed: '#8aba4a', glob: '#ff7a2a', ember: '#ffb040', slagball: '#ff5a3a' }[q.kind] || '#ff5a3a'); ctx.beginPath(); ctx.arc(x, y, q.kind === 'bubble' ? 6 : 4, 0, 7); ctx.fill(); });
    R.drops.forEach(function (d) { var x = d.x * TS - cam.x, y = d.y * TS - cam.y - 4; ctx.fillStyle = d.kind === 'hp' ? (retro ? E.R : '#ff6a4a') : (retro ? E.C : '#9fe4ff'); ctx.fillRect(x - 3, y - 3, 6, 6); });
    R.shots.forEach(function (s) { var x = s.x * TS - cam.x, y = s.y * TS - cam.y, rr = s.big ? 7 : 3;
      if (!retro) { var gr = ctx.createRadialGradient(x, y, 0, x, y, rr * 3); gr.addColorStop(0, 'rgba(255,230,150,0.9)'); gr.addColorStop(1, 'rgba(255,140,40,0)'); ctx.fillStyle = gr; ctx.fillRect(x - rr * 3, y - rr * 3, rr * 6, rr * 6); }
      ctx.fillStyle = retro ? E.y : '#fff4c0'; ctx.fillRect(x - rr, y - rr, rr * 2, rr * 2); });
    // героиня
    if (S.phase !== 'dead') hero(ctx, h, S, hx, hy, retro, t);
    dynTiles(ctx, R, cache.dyn, cam, t, retro, S);
    // свет фонаря и тьма
    if (!retro) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      var gl = ctx.createRadialGradient(hx + h.face * 6, hy - 16, 4, hx + h.face * 6, hy - 16, S.beam ? 150 : 70);
      gl.addColorStop(0, 'rgba(255,190,90,' + (S.beam ? 0.32 : 0.18) + ')'); gl.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gl; ctx.fillRect(hx - 160, hy - 180, 320, 320);
      ctx.restore();
    }
    if (rm.dark) {
      if (!dark) { dark = document.createElement('canvas'); dark.width = VW; dark.height = VH; }
      var d = dark.getContext('2d'); d.globalCompositeOperation = 'source-over'; d.clearRect(0, 0, VW, VH);
      d.fillStyle = retro ? 'rgba(0,0,0,0.82)' : 'rgba(4,2,10,0.74)'; d.fillRect(0, 0, VW, VH);
      d.globalCompositeOperation = 'destination-out';
      var lx = hx + h.face * 6, ly = hy - 16;
      if (retro) { d.fillStyle = '#000'; d.beginPath(); d.arc(lx, ly, lr, 0, 7); d.fill(); }
      else { var lg = d.createRadialGradient(lx, ly, lr * 0.3, lx, ly, lr); lg.addColorStop(0, 'rgba(0,0,0,1)'); lg.addColorStop(1, 'rgba(0,0,0,0)'); d.fillStyle = lg; d.fillRect(lx - lr, ly - lr, lr * 2, lr * 2); }
      if (S.beam) { d.fillStyle = retro ? '#000' : 'rgba(0,0,0,0.85)'; d.beginPath(); d.moveTo(lx, ly); d.lineTo(lx + h.face * 320, ly - 90); d.lineTo(lx + h.face * 320, ly + 90); d.closePath(); d.fill(); }
      rm.objs.forEach(function (o) { if (o.type === 'forge' || o.type === 'anvil' || o.type === 'heart') { var ox = o.x * TS - cam.x, oy = o.y * TS - cam.y - 20; d.fillStyle = 'rgba(0,0,0,0.8)'; d.beginPath(); d.arc(ox, oy, 46, 0, 7); d.fill(); } });
      ctx.drawImage(dark, 0, 0);
    }
    if (retro) { ctx.fillStyle = 'rgba(0,0,0,0.12)'; for (var sl = 0; sl < VH; sl += 3) ctx.fillRect(0, sl, VW, 1); }
    if (ui && ui.after) ui.after(cam);
  }
  P.R = { TS: TS, VW: VW, VH: VH, draw: draw, hero: hero, enemy: enemy, boss: boss, itemIcon: itemIcon, abilityIcon: abilityIcon, pal: pal, ZM: ZM, ZR: ZR, E: E, camera: camera };
})(typeof window !== 'undefined' ? window : globalThis);
