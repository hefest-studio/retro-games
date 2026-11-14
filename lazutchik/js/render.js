/* ЛАЗУТЧИК · render.js — отрисовка обеих тем одним модулем (ветвление по теме).
   Кадр 640×360: сверху панель 40 px (здоровье, энергия, карты, предмет, мини-карта, время/будильник), ниже — экран
   комплекса 640×320 (флип-скрин). modern — полное разрешение, градиенты и мягкий свет; retro — тот же экран рисуется
   в буфер 320×160 только прямоугольниками и палитрой 8-бит, затем растягивается ×2 без сглаживания.
   Статика экрана (стена, клетки, лестницы, укрытия) — в кэше по (экран, тема). Темнота — слой с «дырами» света.
   LZ.R — примитивы (герой, стражи) для титула и финалов. */
(function (global) {
  'use strict';
  var LZ = global.LZ, L = LZ.logic, M = LZ.MAP, T = M.T, SW = M.SW, SH = M.SH, C = M.C, K = L.K;
  var VW = 640, VH = 360, HUD = 40, RW = SW * T, RH = SH * T;

  // retro: 8-бит палитра
  var E = { k: '#000000', d: '#3c3c3c', g: '#7c7c7c', l: '#bcbcbc', w: '#fcfcfc', r: '#a81000', R: '#e45c10', o: '#f87858', y: '#f8b800', Y: '#fce0a8',
    b: '#0000bc', B: '#0078f8', c: '#3cbcfc', G: '#005800', Gm: '#00a844', Gl: '#58d854', n: '#503000', N: '#ac7c00', t: '#004058', T: '#008888', p: '#6844fc', P: '#940084' };
  // зоны: стена, узор, твердь, кромка, тень кромки, акцент, свет
  var ZM = {
    roof: { wall: '#0a1022', pat: '#121a34', solid: '#2b2d36', hi: '#565a68', lo: '#1b1c22', acc: '#7a8094', light: '#cfe0ff', sky: 1 },
    loft: { wall: '#3a2c22', pat: '#45352a', solid: '#5a4030', hi: '#9a7046', lo: '#2e2018', acc: '#c08a50', light: '#ffd28a' },
    office: { wall: '#21403b', pat: '#2a4c46', solid: '#3e3934', hi: '#8a7a62', lo: '#24201c', acc: '#5a3a24', light: '#ffe2a0' },
    store: { wall: '#22262c', pat: '#2b3038', solid: '#3a3f46', hi: '#6e7684', lo: '#1c1f24', acc: '#7a5a34', light: '#ffd890' },
    shop: { wall: '#43261f', pat: '#56322a', solid: '#3c3a3a', hi: '#8e5c3a', lo: '#221c1c', acc: '#b06a3a', light: '#ffcf7a' },
    mine: { wall: '#251f1a', pat: '#332a22', solid: '#4a3e30', hi: '#7a6648', lo: '#231c15', acc: '#8a6232', light: '#ffc870' },
    assembly: { wall: '#28303a', pat: '#313a46', solid: '#40464e', hi: '#8e9aa8', lo: '#1e2228', acc: '#5a6878', light: '#e8f0ff' },
    boiler: { wall: '#381f15', pat: '#48291b', solid: '#3a302a', hi: '#a06a3a', lo: '#1e1712', acc: '#ff8a3a', light: '#ffb070' },
    foundry: { wall: '#2c1812', pat: '#3a2017', solid: '#3a2a24', hi: '#c06a30', lo: '#1c1210', acc: '#ffa040', light: '#ffb060' },
    engine: { wall: '#1c282c', pat: '#243438', solid: '#34444a', hi: '#7a9aa4', lo: '#182024', acc: '#c9a043', light: '#e0f4ff' },
    sewer: { wall: '#17262a', pat: '#1f3236', solid: '#2a3a36', hi: '#4f7062', lo: '#121c1a', acc: '#2f7a62', light: '#c8ffd8' }
  };
  var ZR = {
    roof: { wall: E.k, pat: E.b, solid: E.d, hi: E.g, lo: E.k, acc: E.l, light: E.c, sky: 1 },
    loft: { wall: E.k, pat: E.n, solid: E.n, hi: E.N, lo: E.k, acc: E.N, light: E.y },
    office: { wall: E.t, pat: E.k, solid: E.d, hi: E.N, lo: E.k, acc: E.n, light: E.Y },
    store: { wall: E.k, pat: E.d, solid: E.d, hi: E.g, lo: E.k, acc: E.n, light: E.y },
    shop: { wall: E.n, pat: E.r, solid: E.d, hi: E.R, lo: E.k, acc: E.R, light: E.y },
    mine: { wall: E.k, pat: E.n, solid: E.n, hi: E.N, lo: E.k, acc: E.N, light: E.y },
    assembly: { wall: E.d, pat: E.k, solid: E.g, hi: E.l, lo: E.k, acc: E.l, light: E.w },
    boiler: { wall: E.n, pat: E.r, solid: E.d, hi: E.R, lo: E.k, acc: E.R, light: E.o },
    foundry: { wall: E.k, pat: E.r, solid: E.d, hi: E.R, lo: E.k, acc: E.y, light: E.o },
    engine: { wall: E.t, pat: E.k, solid: E.d, hi: E.T, lo: E.k, acc: E.N, light: E.w },
    sewer: { wall: E.k, pat: E.t, solid: E.t, hi: E.T, lo: E.k, acc: E.Gm, light: E.Gl }
  };
  // герой — Филин: тёмно-синяя стёганая телогрейка, вязаная шапка горчичного цвета, фонарик-прищепка; на спине — заводной будильник
  var HM = { coat: '#23365e', coatHi: '#3a5590', coatLo: '#16223e', stitch: '#4b67a3', hat: '#d39a36', hatLo: '#9a6a22', pom: '#f0c060', face: '#e2b48c', faceLo: '#b88664', eye: '#1a1410', brow: '#5a3a22',
    pants: '#5c544a', pantsLo: '#3e3832', boot: '#2a1f18', glove: '#7a4a2a', lamp: '#9aa0a8', lens: '#ffe58a', clock: '#c9a043', clockHi: '#f2d27a', face2: '#f4ecd8' };
  var HR = { coat: E.b, coatHi: E.B, coatLo: E.k, stitch: E.B, hat: E.y, hatLo: E.N, pom: E.Y, face: E.Y, faceLo: E.o, eye: E.k, brow: E.n,
    pants: E.g, pantsLo: E.d, boot: E.k, glove: E.n, lamp: E.l, lens: E.y, clock: E.N, clockHi: E.y, face2: E.w };
  // стража Арсенала
  var GM = {
    boxer: { body: '#9a4a22', hi: '#c2683a', lo: '#5e2a12', cap: '#3a2014', trim: '#d8a040', pants: '#3a2a22' },
    heavy: { body: '#6a6a70', hi: '#8e8e96', lo: '#3a3a40', cap: '#2a1e16', trim: '#5a3a22', pants: '#2e2620', apron: '#5a3a22' },
    thrower: { body: '#5f6a2a', hi: '#7f8c3c', lo: '#3a421a', cap: '#8a2a1a', trim: '#c9a043', pants: '#33301e' },
    dog: { body: '#b8863a', hi: '#e2b45a', lo: '#6e4a1c', eye: '#ff4a3a', key: '#d8d8d8' }
  };
  var GR = {
    boxer: { body: E.R, hi: E.o, lo: E.r, cap: E.n, trim: E.y, pants: E.n },
    heavy: { body: E.g, hi: E.l, lo: E.d, cap: E.k, trim: E.n, pants: E.d, apron: E.n },
    thrower: { body: E.G, hi: E.Gm, lo: E.k, cap: E.r, trim: E.y, pants: E.d },
    dog: { body: E.N, hi: E.y, lo: E.n, eye: E.R, key: E.l }
  };
  var CARDC = { red: ['#e0473a', E.R], blue: ['#3f7ae0', E.B], yellow: ['#f0c23a', E.y] };

  function rect(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }
  function circ(ctx, x, y, r, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
  function poly(ctx, pts, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (var i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.closePath(); ctx.fill(); }
  function line(ctx, x0, y0, x1, y1, c, w) { ctx.strokeStyle = c; ctx.lineWidth = w || 1; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); }
  function mk(w, h) { var c = (typeof document !== 'undefined') ? document.createElement('canvas') : null; if (!c) return null; c.width = w; c.height = h; return c; }
  function hash(a, b, c) { var h = (a * 374761393 + b * 668265263 + (c || 0) * 1442695041) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function zp(zone, rt) { return (rt ? ZR : ZM)[zone] || ZM.store; }

  // ---------- статика экрана (кэш) ----------
  var cache = {};
  function screenStatic(S, X, Y, rt) {
    var key = X + ',' + Y + (rt ? 'r' : 'm') + S.map.diff, c = cache[key];
    if (c) return c;
    var sc = rt ? 0.5 : 1; c = mk(RW * sc, RH * sc); if (!c) return null;
    var ctx = c.getContext('2d'); ctx.scale(sc, sc);
    var s = S.map.screens[Y * M.CX + X], P = zp(s.zone, rt), ox = X * RW, oy = Y * RH, Wd = S.wd;
    ctx.translate(-ox, -oy);
    backWall(ctx, s, P, ox, oy, rt);
    // клетки
    for (var r = 0; r < SH; r++) for (var cc = 0; cc < SW; cc++) {
      var gx = X * SW + cc, gy = Y * SH + r, v = Wd.tile(gx, gy), px = gx * T, py = gy * T;
      if (v === C.S) solidTile(ctx, Wd, gx, gy, px, py, P, s.zone, rt);
    }
    // лестницы
    S.map.ladders.forEach(function (l) {
      if (Math.floor(l.tx / SW) !== X) return;
      var r0 = Math.max(l.r0, Y * SH), r1 = Math.min(l.r1, Y * SH + SH - 1); if (r0 > r1) return;
      ladder(ctx, l.tx * T, r0 * T, (r1 - r0 + 1) * T, P, rt);
    });
    // шахта лифта: направляющие
    S.map.lifts.forEach(function (lf) {
      if (Math.floor(lf.tx / SW) !== X) return;
      var top = lf.stops[0] - 9, bot = lf.stops[lf.stops.length - 1];
      var y0 = Math.max(top, Y * SH) * T, y1 = Math.min(bot, Y * SH + SH - 1) * T + T;
      if (y0 >= y1) return;
      rect(ctx, lf.tx * T + 2, y0, 4, y1 - y0, rt ? E.g : '#5a646e'); rect(ctx, lf.tx * T + 2 * T - 6, y0, 4, y1 - y0, rt ? E.g : '#5a646e');
      if (!rt) { ctx.globalAlpha = 0.25; rect(ctx, lf.tx * T, y0, 2 * T, y1 - y0, '#000'); ctx.globalAlpha = 1; }
      line(ctx, lf.tx * T + T, y0, lf.tx * T + T, y1, rt ? E.l : '#8a9096', rt ? 2 : 1.5);
    });
    // укрытия
    S.map.covers.forEach(function (cv) { if (cv.X === X && cv.Y === Y) cover(ctx, cv, P, rt); });
    // лампы
    S.map.lamps.forEach(function (lp) { if (lp.X === X && lp.Y === Y) lamp(ctx, lp, P, rt, s.zone); });
    // особые места
    var ex = S.map.exit; if (ex.X === X && ex.Y === Y) outfall(ctx, S, rt);
    var cart = S.map.cart; if (Y === 5) [cart.a, cart.b].forEach(function (sx) { if (Math.floor(sx / RW) === X) stationSign(ctx, sx, cart.y, rt); });
    if (Y === 5) rails(ctx, S, X, rt);
    return (cache[key] = c);
  }
  function backWall(ctx, s, P, ox, oy, rt) {
    var z = s.zone, i, j;
    if (P.sky) {
      if (rt) { rect(ctx, ox, oy, RW, RH, E.k); for (i = 0; i < 40; i++) rect(ctx, ox + hash(i, s.X, 1) * RW | 0, oy + hash(i, s.X, 2) * 200 | 0, 2, 2, hash(i, 3, s.X) < 0.3 ? E.c : E.w); }
      else {
        var gr = ctx.createLinearGradient(0, oy, 0, oy + RH); gr.addColorStop(0, '#060a18'); gr.addColorStop(0.7, '#141f3c'); gr.addColorStop(1, '#2a2a44'); ctx.fillStyle = gr; ctx.fillRect(ox, oy, RW, RH);
        for (i = 0; i < 50; i++) { ctx.globalAlpha = 0.4 + hash(i, s.X, 4) * 0.6; circ(ctx, ox + hash(i, s.X, 1) * RW, oy + hash(i, s.X, 2) * 200, hash(i, s.X, 5) < 0.2 ? 1.4 : 0.8, '#e8eeff'); } ctx.globalAlpha = 1;
      }
      if (s.X % 3 === 1) { circ(ctx, ox + 470, oy + 70, 26, rt ? E.Y : '#f4ecd0'); circ(ctx, ox + 482, oy + 62, 24, rt ? E.k : '#0c1226'); }
      // дальние трубы завода
      for (i = 0; i < 4; i++) {
        var fx = ox + 60 + i * 150 + hash(i, s.X, 6) * 60, fh = 90 + hash(i, s.X, 7) * 80;
        rect(ctx, fx, oy + RH - 32 - fh, 18, fh, rt ? E.d : '#1a1f30'); rect(ctx, fx - 3, oy + RH - 32 - fh, 24, 6, rt ? E.g : '#262c40');
        if (!rt) { ctx.globalAlpha = 0.2; circ(ctx, fx + 9, oy + RH - 40 - fh, 14, '#9aa0b8'); ctx.globalAlpha = 1; }
      }
      rect(ctx, ox, oy + RH - 90, RW, 58, rt ? E.k : '#141826');
      for (i = 0; i < 9; i++) { var bx = ox + i * 76 + 8; rect(ctx, bx, oy + RH - 120 - hash(i, s.X, 8) * 30, 54, 90, rt ? E.k : '#161b2a'); if (hash(i, s.X, 9) < 0.6) rect(ctx, bx + 10 + (hash(i, s.X, 10) * 30 | 0), oy + RH - 100, 6, 6, rt ? E.y : '#e8b860'); }
      return;
    }
    rect(ctx, ox, oy, RW, RH, P.wall);
    if (z === 'shop' || z === 'boiler' || z === 'foundry' || z === 'sewer') { // кирпич
      for (j = 0; j < 20; j++) for (i = 0; i < 22; i++) {
        var bw = 32, bh = 16, x = ox + i * bw - (j % 2) * 16, y = oy + j * bh;
        rect(ctx, x + 1, y + 1, bw - 2, bh - 2, (hash(i, j, s.X * 13 + s.Y) < 0.25) ? P.pat : P.wall);
        if (!rt) { ctx.globalAlpha = 0.18; rect(ctx, x + 1, y + 1, bw - 2, 2, '#ffffff'); ctx.globalAlpha = 1; }
      }
      if (z === 'sewer') { for (i = 0; i < 3; i++) arch(ctx, ox + 40 + i * 210, oy + 40, 170, 230, P, rt); }
    } else if (z === 'loft' || z === 'store') { // доски
      for (i = 0; i < 40; i++) { rect(ctx, ox + i * 16, oy, 15, RH, hash(i, s.X, s.Y) < 0.5 ? P.wall : P.pat); }
      for (j = 0; j < 3; j++) rect(ctx, ox, oy + 50 + j * 90, RW, 6, P.lo);
    } else if (z === 'office') { // обои + панель
      for (i = 0; i < 40; i++) rect(ctx, ox + i * 16, oy, 8, RH, P.pat);
      rect(ctx, ox, oy + 190, RW, 98, P.acc); for (i = 0; i < 10; i++) rect(ctx, ox + 10 + i * 64, oy + 200, 52, 78, rt ? E.n : '#6a4630');
      rect(ctx, ox, oy + 186, RW, 6, rt ? E.N : '#8a6a44');
      for (i = 0; i < 2; i++) { var fx2 = ox + 120 + i * 300 + hash(i, s.X, 3) * 60; rect(ctx, fx2, oy + 70, 70, 50, rt ? E.N : '#8a6a3a'); rect(ctx, fx2 + 5, oy + 75, 60, 40, rt ? E.k : '#2a3a3a'); poly(ctx, [fx2 + 10, oy + 110, fx2 + 30, oy + 88, fx2 + 44, oy + 100, fx2 + 60, oy + 82, fx2 + 60, oy + 110], rt ? E.Gm : '#4a6a52'); }
    } else if (z === 'mine') { // порода и крепь
      for (i = 0; i < 70; i++) { var rx = ox + hash(i, s.X, 1) * RW, ry = oy + hash(i, s.X, 2) * RH, rr = 10 + hash(i, s.X, 3) * 22; if (rt) rect(ctx, rx | 0, ry | 0, rr | 0, rr * 0.7 | 0, P.pat); else { ctx.fillStyle = P.pat; ctx.beginPath(); ctx.ellipse(rx, ry, rr, rr * 0.7, 0, 0, 7); ctx.fill(); } }
      for (i = 0; i < 4; i++) { var px = ox + 50 + i * 170; rect(ctx, px, oy + 32, 14, RH - 64, P.acc); rect(ctx, px + 140 > ox + RW ? px - 10 : px, oy + 32, i < 3 ? 184 : 30, 12, P.acc); }
    } else if (z === 'assembly' || z === 'engine') { // панели с заклёпками
      for (j = 0; j < 5; j++) for (i = 0; i < 10; i++) {
        var qx = ox + i * 64, qy = oy + j * 64; rect(ctx, qx + 2, qy + 2, 60, 60, P.pat);
        rect(ctx, qx + 6, qy + 6, 3, 3, P.hi); rect(ctx, qx + 55, qy + 6, 3, 3, P.hi); rect(ctx, qx + 6, qy + 55, 3, 3, P.hi); rect(ctx, qx + 55, qy + 55, 3, 3, P.hi);
      }
      if (z === 'engine') { // трубы
        rect(ctx, ox, oy + 60, RW, 10, rt ? E.N : '#7a5a2a'); rect(ctx, ox, oy + 76, RW, 6, rt ? E.d : '#4a5a60');
      } else { rect(ctx, ox, oy + 120, RW, 8, P.lo); }
    }
    // трубы-вертикали для фактуры
    if (z !== 'office' && z !== 'mine') for (i = 0; i < 2; i++) { var tx = ox + 100 + hash(i, s.X, s.Y * 7) * 440; rect(ctx, tx, oy, 8, RH, rt ? E.d : 'rgba(0,0,0,.22)'); rect(ctx, tx - 3, oy + 40 + i * 80, 14, 8, rt ? E.g : 'rgba(255,255,255,.08)'); }
  }
  function arch(ctx, x, y, w, h, P, rt) {
    if (rt) { rect(ctx, x, y + 34, 6, h - 34, P.hi); rect(ctx, x + w - 6, y + 34, 6, h - 34, P.hi); rect(ctx, x + 6, y + 18, 20, 16, P.hi); rect(ctx, x + w - 26, y + 18, 20, 16, P.hi); rect(ctx, x + 26, y + 8, w - 52, 10, P.hi); return; }
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x, y + w / 2); ctx.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0); ctx.lineTo(x + w, y + h); ctx.fill();
  }
  function solidTile(ctx, Wd, gx, gy, px, py, P, z, rt) {
    var up = !Wd.solid(gx, gy - 1) && Wd.tile(gx, gy - 1) !== C.L, dn = !Wd.solid(gx, gy + 1) && Wd.tile(gx, gy + 1) !== C.L && Wd.tile(gx, gy + 1) !== C.V;
    if (up && dn) { // мостки: балка-ферма
      rect(ctx, px, py, T, 9, P.hi); rect(ctx, px, py + 9, T, 3, P.lo);
      if (!rt) { line(ctx, px + 2, py + 12, px + 16, py + 24, P.lo, 2); line(ctx, px + 30, py + 12, px + 16, py + 24, P.lo, 2); }
      else { rect(ctx, px + 14, py + 12, 4, 10, P.lo); }
      return;
    }
    rect(ctx, px, py, T, T, P.solid);
    if (z === 'mine' || z === 'roof') { if (hash(gx, gy, 3) < 0.5) rect(ctx, px + 6, py + 10, 10, 6, P.lo); }
    else if (z === 'shop' || z === 'boiler' || z === 'sewer' || z === 'foundry') { rect(ctx, px, py + 15, T, 2, P.lo); rect(ctx, px + ((gy % 2) ? 8 : 24), py, 2, 15, P.lo); rect(ctx, px + ((gy % 2) ? 24 : 8), py + 17, 2, 15, P.lo); }
    else { rect(ctx, px, py + T - 2, T, 2, P.lo); rect(ctx, px + T - 2, py, 2, T, P.lo); }
    if (up) { rect(ctx, px, py, T, 5, P.hi); if (!rt) { ctx.globalAlpha = 0.35; rect(ctx, px, py + 5, T, 3, '#000'); ctx.globalAlpha = 1; } }
  }
  function ladder(ctx, x, y, h, P, rt) {
    var c1 = rt ? E.N : '#9a7040', c2 = rt ? E.n : '#5a3e22';
    rect(ctx, x + 5, y, 4, h, c1); rect(ctx, x + T - 9, y, 4, h, c1);
    for (var yy = y + 4; yy < y + h; yy += 10) rect(ctx, x + 5, yy, T - 10, 3, c1);
    if (!rt) { rect(ctx, x + 8, y, 1, h, c2); rect(ctx, x + T - 6, y, 1, h, c2); }
  }
  function cover(ctx, cv, P, rt) {
    var x = cv.tx * T, y = cv.ty * T, w = cv.w * T, h = cv.h * T, k = cv.kind;
    // тень на полу перед укрытием
    if (!rt) { ctx.globalAlpha = 0.35; rect(ctx, x - 10, y + h - 6, w + 20, 6, '#000'); ctx.globalAlpha = 1; }
    if (k === 'crate') {
      for (var j = 0; j < cv.h; j++) for (var i = 0; i < cv.w; i++) {
        var bx = x + i * T, by = y + j * T;
        rect(ctx, bx + 1, by + 1, T - 2, T - 2, rt ? E.N : '#8a5a2e'); rect(ctx, bx + 1, by + 1, T - 2, 4, rt ? E.Y : '#a8743c'); rect(ctx, bx + 1, by + T - 5, T - 2, 4, rt ? E.n : '#6a4422');
        if (rt) { rect(ctx, bx + 14, by + 5, 4, T - 10, E.n); rect(ctx, bx + 5, by + 14, T - 10, 4, E.n); } else { line(ctx, bx + 4, by + 6, bx + T - 4, by + T - 6, '#6a4422', 3); line(ctx, bx + T - 4, by + 6, bx + 4, by + T - 6, '#6a4422', 3); }
      }
    } else if (k === 'vent') {
      rect(ctx, x + 2, y + h - 40, w - 4, 40, rt ? E.g : '#5a6070'); rect(ctx, x + 2, y + h - 40, w - 4, 5, rt ? E.l : '#8a90a0');
      for (var v = 0; v < 6; v++) rect(ctx, x + 8, y + h - 30 + v * 4, w - 16, 2, rt ? E.d : '#2a2e38');
      rect(ctx, x + w / 2 - 6, y + h - 54, 12, 14, rt ? E.d : '#4a4e5a');
    } else if (k === 'cabinet') {
      rect(ctx, x + 4, y + h - 56, w - 8, 56, rt ? E.g : '#6a6e66'); for (v = 0; v < 3; v++) { rect(ctx, x + 8, y + h - 52 + v * 18, w - 16, 14, rt ? E.l : '#80847a'); rect(ctx, x + w / 2 - 6, y + h - 46 + v * 18, 12, 3, rt ? E.d : '#3a3c36'); }
    } else if (k === 'cart') {
      poly(ctx, [x + 2, y + h - 40, x + w - 2, y + h - 40, x + w - 8, y + h - 10, x + 8, y + h - 10], rt ? E.d : '#4a4a50');
      rect(ctx, x + 6, y + h - 48, w - 12, 10, rt ? E.n : '#5a4632'); circ(ctx, x + 14, y + h - 7, 6, rt ? E.g : '#2a2a2e'); circ(ctx, x + w - 14, y + h - 7, 6, rt ? E.g : '#2a2a2e');
    } else if (k === 'coal') {
      poly(ctx, [x - 6, y + h, x + 14, y + h - 34, x + 34, y + h - 44, x + 52, y + h - 26, x + w + 6, y + h], rt ? E.d : '#1e1c1c');
      if (!rt) for (v = 0; v < 8; v++) circ(ctx, x + 6 + hash(v, x, 1) * (w - 12), y + h - 6 - hash(v, x, 2) * 24, 3, '#3a3634');
    } else if (k === 'mold') {
      rect(ctx, x + 2, y + h - 34, w - 4, 34, rt ? E.d : '#3a3432'); rect(ctx, x + 2, y + h - 34, w - 4, 6, rt ? E.R : '#a0542a'); rect(ctx, x + 12, y + h - 40, w - 24, 6, rt ? E.g : '#5a5250');
    } else if (k === 'casing') {
      rect(ctx, x + 2, y + h - 52, w - 4, 52, rt ? E.d : '#3a4a52'); rect(ctx, x + 2, y + h - 52, w - 4, 5, rt ? E.T : '#6a8a96');
      circ(ctx, x + w / 2, y + h - 30, 10, rt ? E.l : '#c9c4b0'); line(ctx, x + w / 2, y + h - 30, x + w / 2 + 6, y + h - 36, rt ? E.R : '#a02a1a', 2);
    } else if (k === 'barrel') {
      for (var b = 0; b < 2; b++) { var bx2 = x + b * T + 3; rect(ctx, bx2, y + h - 40, T - 6, 40, rt ? E.Gm : '#3a5a3a'); rect(ctx, bx2, y + h - 34, T - 6, 3, rt ? E.G : '#2a4a2a'); rect(ctx, bx2, y + h - 12, T - 6, 3, rt ? E.G : '#2a4a2a'); }
    }
  }
  function lamp(ctx, lp, P, rt, z) {
    var x = lp.x, y = lp.y;
    if (z === 'roof') { rect(ctx, x - 2, lp.fy - 120, 4, 120, rt ? E.d : '#3a3e4a'); rect(ctx, x - 10, lp.fy - 124, 20, 6, rt ? E.g : '#5a5e6a'); y = lp.fy - 118; }
    else { line(ctx, x, y - 4, x, y + 10, rt ? E.g : '#4a4a4a', 2); }
    rect(ctx, x - 9, y + 10, 18, 6, rt ? E.g : '#6a6e76'); rect(ctx, x - 5, y + 16, 10, 4, rt ? E.Y : '#fff2c0');
    if (!lp.dark && !rt) { // в светлых — мягкий конус
      var g = ctx.createLinearGradient(0, y + 16, 0, lp.fy); g.addColorStop(0, 'rgba(255,230,170,.16)'); g.addColorStop(1, 'rgba(255,230,170,0)');
      poly(ctx, [x - 6, y + 18, x + 6, y + 18, x + 90, lp.fy, x - 90, lp.fy], g);
    }
  }
  function outfall(ctx, S, rt) {
    var y = S.map.exit.y, x0 = S.map.exit.X * RW + T;
    rect(ctx, x0, y - 140, 70, 140, rt ? E.b : '#1a2a50');
    if (!rt) { var g = ctx.createLinearGradient(x0, 0, x0 + 70, 0); g.addColorStop(0, 'rgba(180,210,255,.35)'); g.addColorStop(1, 'rgba(180,210,255,0)'); ctx.fillStyle = g; ctx.fillRect(x0, y - 140, 70, 140); }
    circ(ctx, x0 + 20, y - 110, 8, rt ? E.w : '#f4f0d8'); circ(ctx, x0 + 24, y - 113, 7, rt ? E.b : '#1a2a50');
    for (var i = 0; i < 6; i++) rect(ctx, x0 + 4 + i * 11, y - 140, 3, 140, rt ? E.d : 'rgba(40,50,60,.55)');
    rect(ctx, x0, y - 146, 70, 8, rt ? E.g : '#4a5a5a');
    rect(ctx, x0, y - 8, 70, 8, rt ? E.c : '#3a6a8a');
  }
  function stationSign(ctx, x, y, rt) {
    rect(ctx, x - 2, y - 90, 4, 90, rt ? E.g : '#4a5050'); rect(ctx, x - 16, y - 100, 32, 14, rt ? E.y : '#d8b040'); rect(ctx, x - 12, y - 96, 24, 6, rt ? E.k : '#3a2a10');
  }
  function rails(ctx, S, X, rt) {
    var c = S.map.cart, y = c.y, x0 = Math.max(c.a - 40, X * RW), x1 = Math.min(c.b + 40, (X + 1) * RW);
    if (x0 >= x1) return;
    rect(ctx, x0, y - 4, x1 - x0, 3, rt ? E.l : '#9aa4a8');
    for (var x = Math.ceil(x0 / 16) * 16; x < x1; x += 16) rect(ctx, x, y - 2, 8, 2, rt ? E.n : '#4a3a2a');
  }

  // ---------- динамика ----------
  function doorDraw(ctx, S, d, rt) {
    var open = S.wd.open[d.r0 * S.wd.W + d.tx], x = d.tx * T, y = d.r0 * T, h = (d.r1 - d.r0 + 1) * T, col = CARDC[d.color][rt ? 1 : 0];
    rect(ctx, x - 2, y - 6, T + 4, 6, rt ? E.g : '#5a6068');
    if (open) { rect(ctx, x, y, T, 8, rt ? E.d : '#3a3e46'); rect(ctx, x, y + 8, T, 3, col); return; }
    rect(ctx, x, y, T, h, rt ? E.d : '#3e434c'); rect(ctx, x + 3, y + 3, T - 6, h - 6, rt ? E.g : '#545a64');
    rect(ctx, x, y + 34, T, 10, col); rect(ctx, x + 10, y + 50, 12, 8, rt ? E.k : '#1a1c20'); rect(ctx, x + 13, y + 52, 6, 3, col);
  }
  function grateDraw(ctx, S, g, rt, t) {
    var open = S.wd.open[g.r0 * S.wd.W + g.tx], x = g.tx * T, y = g.r0 * T, h = (g.r1 - g.r0 + 1) * T;
    var bars = rt ? E.l : '#7a7e84';
    if (!open) { for (var i = 0; i < 5; i++) rect(ctx, x + 2 + i * 6, y, 3, h, bars); rect(ctx, x, y + 10, T, 4, bars); rect(ctx, x, y + h - 20, T, 4, bars); }
    else { for (i = 0; i < 5; i++) rect(ctx, x + 2 + i * 6, y, 3, 14, bars); }
    // рычаг с восточной стороны
    var lx = x + T + 14, ly = y + h - 40;
    rect(ctx, lx - 5, ly, 10, 14, rt ? E.d : '#3a3e44'); var a = open ? 0.9 : -0.9;
    line(ctx, lx, ly + 4, lx + Math.sin(a) * 16, ly + 4 - Math.cos(a) * 16, rt ? E.R : '#c0402a', 3); circ(ctx, lx + Math.sin(a) * 16, ly + 4 - Math.cos(a) * 16, 3, rt ? E.R : '#e0503a');
  }
  function shutterDraw(ctx, S, s, rt, t) {
    var x = s.tx * T, y = s.r0 * T, h = (s.r1 - s.r0 + 1) * T, k = S.wd.shut ? h : 10;
    rect(ctx, x - 2, y - 8, T + 4, 8, rt ? E.g : '#5a5e66');
    for (var i = 0; i < k; i += 8) rect(ctx, x, y + i, T, 7, rt ? E.g : '#7a7e86');
    if (S.wd.shut) for (i = 0; i < 4; i++) rect(ctx, x + (i % 2) * 16, y + h - 12, 16, 6, i % 2 ? (rt ? E.k : '#222') : (rt ? E.y : '#e8b830'));
    if (!S.wd.shut) { var on = Math.floor(t * 2) % 2; rect(ctx, x + 12, y - 6, 8, 4, rt ? (on ? E.R : E.r) : (S.alarmT > 0 ? '#ff4a3a' : '#5a2a22')); }
  }
  function hatchDraw(ctx, S, h, rt) {
    var x = h.tx * T, y = h.ty * T, open = S.wd.open[h.ty * S.wd.W + h.tx];
    if (open) { rect(ctx, x, y, T, T, rt ? E.k : '#0a0a0c'); rect(ctx, x - 2, y - 14, 4, 16, rt ? E.g : '#6a6e76'); return; }
    rect(ctx, x, y, T, 6, rt ? E.g : '#6a7078'); rect(ctx, x + 2, y + 1, T - 4, 2, rt ? E.l : '#9aa0a8'); rect(ctx, x + 12, y - 2, 8, 3, rt ? E.y : '#d8b040');
  }
  function liftDraw(ctx, S, lf, rt, X, Y) {
    var Wd = S.wd, P = S.hero, cy = Wd.lifts[lf.id].y, riding = P.ride && P.ride.k === 'lift';
    lf.stops.forEach(function (st) {
      var y = st * T; if (Math.floor((y - 20) / RH) !== Y && Math.floor(y / RH) !== Y) return;
      rect(ctx, lf.tx * T, y, 2 * T, 8, rt ? E.y : '#d8b040'); for (var i = 0; i < 4; i++) rect(ctx, lf.tx * T + i * 16, y, 8, 8, rt ? E.k : '#2a2a2a');
      rect(ctx, lf.tx * T - 10, y - 50, 8, 14, rt ? E.d : '#3a3e44'); rect(ctx, lf.tx * T - 8, y - 48, 4, 4, rt ? E.Gl : '#7aff9a'); rect(ctx, lf.tx * T - 8, y - 42, 4, 4, rt ? E.R : '#ff7a6a');
    });
    if (riding) { var y = P.y; rect(ctx, lf.tx * T - 2, y, 2 * T + 4, 10, rt ? E.y : '#e8c050'); line(ctx, lf.tx * T + T, y, lf.tx * T + T, y - 400, rt ? E.l : '#aab0b8', 2); rect(ctx, lf.tx * T, y - 70, 4, 70, rt ? E.g : '#6a7078'); rect(ctx, lf.tx * T + 2 * T - 4, y - 70, 4, 70, rt ? E.g : '#6a7078'); rect(ctx, lf.tx * T, y - 72, 2 * T, 4, rt ? E.g : '#6a7078'); }
  }
  function cartDraw(ctx, S, rt, t) {
    var c = S.wd.cart, x = c.x, y = S.map.cart.y - 4, P = S.hero, rid = P.ride && P.ride.k === 'cart';
    rect(ctx, x - 26, y - 14, 52, 8, rt ? E.n : '#6a4a2a'); rect(ctx, x - 26, y - 14, 52, 2, rt ? E.N : '#9a7040');
    var ph = rid || c.to != null ? Math.sin(t * 10) * 0.5 : 0.2;
    rect(ctx, x - 3, y - 40, 6, 26, rt ? E.d : '#3a3e44');
    line(ctx, x - Math.cos(ph) * 22, y - 40 - Math.sin(ph) * 10, x + Math.cos(ph) * 22, y - 40 + Math.sin(ph) * 10, rt ? E.l : '#9aa0a8', 4);
    circ(ctx, x - 16, y - 4, 6, rt ? E.g : '#2a2c30'); circ(ctx, x + 16, y - 4, 6, rt ? E.g : '#2a2c30'); circ(ctx, x - 16, y - 4, 2, rt ? E.l : '#8a8e94'); circ(ctx, x + 16, y - 4, 2, rt ? E.l : '#8a8e94');
  }
  function plantDraw(ctx, S, rt, t) {
    var p = S.map.plant, x = p.x, y = p.y;
    // главный вал конвейера: огромное колесо
    var spin = S.won ? 0 : t * 0.8, R = 70;
    ctx.save(); ctx.translate(x + 50, y - 120);
    circ(ctx, 0, 0, R, rt ? E.N : '#7a5a2a'); circ(ctx, 0, 0, R - 10, rt ? E.t : '#1c282c');
    for (var i = 0; i < 6; i++) { var a = spin + i * Math.PI / 3; line(ctx, 0, 0, Math.cos(a) * (R - 8), Math.sin(a) * (R - 8), rt ? E.N : '#9a7a3a', rt ? 6 : 7); }
    circ(ctx, 0, 0, 14, rt ? E.y : '#c9a043');
    ctx.restore();
    rect(ctx, x - 14, y - 70, 28, 70, rt ? E.d : '#3a444a'); rect(ctx, x - 14, y - 70, 28, 5, rt ? E.T : '#7a9aa4');
    rect(ctx, x - 8, y - 56, 16, 16, rt ? E.k : '#121618');
    if (S.planted) clockIcon(ctx, x, y - 48, 9, rt, t, true);
    else if (Math.floor(t * 2) % 2 && S.matrix) { ctx.globalAlpha = 0.8; rect(ctx, x - 8, y - 56, 16, 16, rt ? E.y : '#f8d860'); ctx.globalAlpha = 1; }
  }
  function clockIcon(ctx, x, y, r, rt, t, ticking) {
    var j = ticking ? Math.sin(t * 30) * 1.2 : 0;
    circ(ctx, x - r * 0.7 + j, y - r * 0.9, r * 0.45, rt ? E.N : '#c9a043'); circ(ctx, x + r * 0.7 + j, y - r * 0.9, r * 0.45, rt ? E.N : '#c9a043');
    circ(ctx, x + j, y, r, rt ? E.N : '#c9a043'); circ(ctx, x + j, y, r * 0.75, rt ? E.w : '#f4ecd8');
    var a = t * 4; line(ctx, x + j, y, x + j + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6, rt ? E.k : '#1a1410', 1.5); line(ctx, x + j, y, x + j, y - r * 0.5, rt ? E.k : '#1a1410', 1.5);
  }
  function itemDraw(ctx, it, rt, t) {
    var x = it.x, y = it.y, bob = Math.sin(t * 3 + x) * 1.5;
    if (it.k === 'thermos') { rect(ctx, x - 5, y - 22, 10, 22, rt ? E.Gm : '#3a8a5a'); rect(ctx, x - 6, y - 26, 12, 5, rt ? E.l : '#c8ccd0'); rect(ctx, x - 5, y - 14, 10, 3, rt ? E.y : '#e8d070'); }
    else if (it.k === 'card') { var c = CARDC[it.color][rt ? 1 : 0]; ctx.save(); ctx.translate(x, y - 16 + bob); rect(ctx, -9, -6, 18, 12, c); rect(ctx, -6, -3, 5, 4, rt ? E.y : '#f0e090'); rect(ctx, 1, 2, 6, 2, rt ? E.k : 'rgba(0,0,0,.5)'); ctx.restore(); if (!rt) { ctx.globalAlpha = 0.25 + 0.15 * Math.sin(t * 4); circ(ctx, x, y - 16, 14, c); ctx.globalAlpha = 1; } }
    else if (it.k === 'matrix') {
      rect(ctx, x - 22, y - 56, 44, 56, rt ? E.d : '#4a4e56'); rect(ctx, x - 18, y - 52, 36, 48, rt ? E.g : '#6a707a'); circ(ctx, x + 8, y - 28, 6, rt ? E.l : '#a8aeb8'); rect(ctx, x - 12, y - 46, 14, 4, rt ? E.d : '#3a3e44');
      ctx.save(); ctx.translate(x, y - 70 + bob); rect(ctx, -10, -4, 20, 10, rt ? E.y : '#d8a83a'); rect(ctx, -4, -14, 8, 10, rt ? E.N : '#a07428'); rect(ctx, -8, 6, 16, 3, rt ? E.N : '#a07428'); ctx.restore();
      if (!rt) { ctx.globalAlpha = 0.3 + 0.2 * Math.sin(t * 3); circ(ctx, x, y - 70, 18, '#ffd860'); ctx.globalAlpha = 1; }
    } else throwable(ctx, it.k, x, y - 4, 0, rt);
  }
  function throwable(ctx, k, x, y, a, rt) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a || 0);
    if (k === 'wrench') { rect(ctx, -10, -2, 16, 4, rt ? E.l : '#a8b0b8'); rect(ctx, 6, -5, 6, 10, rt ? E.l : '#a8b0b8'); rect(ctx, 8, -2, 4, 4, rt ? E.k : '#2a2a2a'); }
    else if (k === 'brick') { rect(ctx, -9, -5, 18, 10, rt ? E.R : '#b0503a'); rect(ctx, -9, -5, 18, 2, rt ? E.o : '#d07a5a'); }
    else if (k === 'crowbar') { rect(ctx, -13, -2, 24, 3, rt ? E.R : '#c0402a'); rect(ctx, 9, -6, 3, 6, rt ? E.R : '#c0402a'); }
    else if (k === 'washer') { for (var i = 0; i < 6; i++) { var b = i * Math.PI / 3; poly(ctx, [Math.cos(b) * 8, Math.sin(b) * 8, Math.cos(b + 0.5) * 3, Math.sin(b + 0.5) * 3, Math.cos(b - 0.5) * 3, Math.sin(b - 0.5) * 3], rt ? E.l : '#c8ccd2'); } circ(ctx, 0, 0, 3, rt ? E.d : '#4a4e54'); circ(ctx, 0, 0, 1.4, rt ? E.k : '#141414'); }
    else if (k === 'nut') { rect(ctx, -3, -3, 6, 6, rt ? E.g : '#8a8e94'); rect(ctx, -1, -1, 2, 2, rt ? E.k : '#2a2a2a'); }
    ctx.restore();
  }

  // ---------- герой ----------
  function hero(ctx, x, y, o) {
    var rt = o.rt, c = rt ? HR : HM, f = o.face || 1, st = o.state || 'idle', t = o.t || 0, sc = o.scale || 1;
    ctx.save(); ctx.translate(x, y); ctx.scale(f * sc, sc);
    if (o.alpha != null) ctx.globalAlpha = o.alpha;
    var crouch = st === 'crouch' || st === 'sweep' || st === 'sneak', H = crouch ? 34 : 56;
    var walk = (st === 'walk' || st === 'run' || st === 'sneak') ? Math.sin(t * (st === 'run' ? 16 : 10)) : 0;
    if (st === 'climb') walk = Math.sin(t * 9);
    if (st === 'down') { // лежит
      rect(ctx, -26, -10, 22, 10, c.coat); rect(ctx, -4, -9, 16, 8, c.pants); rect(ctx, -34, -12, 10, 10, c.face); rect(ctx, -37, -14, 8, 6, c.hat); ctx.restore(); return;
    }
    // ноги
    var lg = crouch ? 10 : 20, kx = st === 'kick' ? 1 : 0;
    if (st === 'sweep') { rect(ctx, -6, -10, 34, 8, c.pants); rect(ctx, 26, -10, 8, 8, c.boot); rect(ctx, -8, -8, 8, 8, c.boot); }
    else if (st === 'kick') { rect(ctx, -6, -lg, 7, lg - 4, c.pantsLo); rect(ctx, -7, -5, 10, 5, c.boot); rect(ctx, 0, -32, 26, 8, c.pants); rect(ctx, 24, -33, 8, 10, c.boot); }
    else if (st === 'climb') { rect(ctx, -7, -lg + walk * 4, 6, lg - 4, c.pantsLo); rect(ctx, 1, -lg - walk * 4, 6, lg - 4, c.pants); rect(ctx, -8, -5 + walk * 4, 8, 5, c.boot); rect(ctx, 0, -5 - walk * 4, 8, 5, c.boot); }
    else {
      var s1 = walk * (crouch ? 4 : 6);
      rect(ctx, -6 + s1, -lg, 6, lg - 4, c.pantsLo); rect(ctx, -8 + s1, -5, 10, 5, c.boot);
      rect(ctx, 0 - s1, -lg, 6, lg - 4, c.pants); rect(ctx, -2 - s1, -5, 10, 5, c.boot);
    }
    // будильник на спине
    if (o.clock) { rect(ctx, -16, -H + 12, 9, 12, c.clock); rect(ctx, -15, -H + 14, 7, 8, c.face2); rect(ctx, -17, -H + 10, 4, 3, c.clockHi); rect(ctx, -10, -H + 10, 4, 3, c.clockHi); }
    // телогрейка
    var top = -H + 16, bh = H - lg - 14;
    rect(ctx, -9, top, 18, bh + 2, c.coat); rect(ctx, -9, top, 4, bh + 2, c.coatLo); rect(ctx, 5, top, 4, bh + 2, c.coatHi);
    for (var q = top + 5; q < top + bh; q += 5) rect(ctx, -8, q, 16, 1, c.stitch);   // стёжка
    rect(ctx, -9, top + bh - 2, 18, 4, c.coatLo);
    // руки
    var arm = st === 'punch' ? 1 : st === 'grab' ? 2 : st === 'toss' ? 3 : 0;
    if (arm === 1) { rect(ctx, 2, top + 4, 20, 6, c.coat); rect(ctx, 20, top + 3, 7, 8, c.glove); }
    else if (arm === 2) { rect(ctx, 2, top - 2, 14, 6, c.coat); rect(ctx, 14, top - 6, 7, 8, c.glove); rect(ctx, -2, top + 4, 14, 5, c.coat); }
    else if (arm === 3) { rect(ctx, 0, top - 10, 6, 14, c.coat); rect(ctx, 0, top - 16, 7, 7, c.glove); }
    else if (st === 'climb') { rect(ctx, -10, top - 6 - walk * 4, 6, 12, c.coat); rect(ctx, 4, top - 6 + walk * 4, 6, 12, c.coat); rect(ctx, -10, top - 10 - walk * 4, 6, 5, c.glove); rect(ctx, 4, top - 10 + walk * 4, 6, 5, c.glove); }
    else { var sw = walk * 4; rect(ctx, -3 + sw, top + 3, 6, bh - 4, c.coatHi); rect(ctx, -3 + sw, top + bh - 2, 6, 5, c.glove); }
    if (o.held && arm !== 3 && st !== 'climb') throwable(ctx, o.held, 6 + (arm === 1 ? 18 : 0), top + bh - 2, -0.5, rt);
    // голова
    var hy = -H + 2;
    rect(ctx, -6, hy + 4, 13, 11, c.face); rect(ctx, -6, hy + 12, 13, 3, c.faceLo);
    rect(ctx, 3, hy + 7, 2, 3, c.eye); rect(ctx, 1, hy + 5, 5, 1, c.brow);   // круглый «филинский» глаз и бровь
    if (!rt) { ctx.fillStyle = '#fff'; ctx.fillRect(4, hy + 7, 1, 1); }
    // вязаная шапка с отворотом и помпоном
    rect(ctx, -7, hy - 4, 15, 9, c.hat); rect(ctx, -8, hy + 3, 17, 3, c.hatLo);
    for (var k2 = -6; k2 < 8; k2 += 3) rect(ctx, k2, hy - 3, 1, 6, c.hatLo);
    rect(ctx, -3, hy - 8, 6, 5, c.pom);
    // фонарик-прищепка на отвороте шапки
    rect(ctx, 6, hy + 1, 5, 4, c.lamp); rect(ctx, 10, hy + 2, 2, 2, o.flash ? c.lens : (rt ? E.d : '#6a6650'));
    ctx.restore();
  }
  // ---------- стража ----------
  function guard(ctx, e, t, rt) {
    var c = (rt ? GR : GM)[e.k], f = e.face, x = e.x, y = e.y;
    ctx.save(); ctx.translate(x, y); ctx.scale(f, 1);
    if (e.out || e.down > 0) {
      if (e.k === 'dog') { rect(ctx, -16, -10, 30, 10, c.lo); rect(ctx, 10, -12, 10, 8, c.body); }
      else { rect(ctx, -26, -10, 40, 10, c.body); rect(ctx, -34, -12, 10, 10, rt ? E.Y : '#d8a882'); rect(ctx, -36, -14, 10, 4, c.cap); }
      if (e.out) { for (var i = 0; i < 3; i++) { var a = t * 3 + i * 2.1; circ(ctx, -20 + Math.cos(a) * 8, -22 + Math.sin(a) * 3, 2, rt ? E.y : '#ffe066'); } }
      ctx.restore(); return;
    }
    var walk = (e.st === 'patrol' && e.wait <= 0) || e.st === 'chase' || e.st === 'look' ? Math.sin(e.t * (e.st === 'chase' ? 14 : 8)) : 0;
    var A = e.atk, wind = A && !A.done ? 1 : A ? 2 : 0;
    if (e.k === 'dog') {
      var b = walk * 3;
      rect(ctx, -16, -24, 30, 14, c.body); rect(ctx, -16, -24, 30, 3, c.hi);
      for (var s = -12; s < 12; s += 7) rect(ctx, s, -22, 2, 10, c.lo);
      rect(ctx, 12, -30 + (wind === 2 ? 4 : 0), 14, 12, c.body); rect(ctx, 22, -24, 8, 6, c.lo); rect(ctx, 18, -28, 3, 3, c.eye);
      if (wind === 2) rect(ctx, 24, -20, 8, 3, rt ? E.w : '#f0f0f0');
      rect(ctx, -14 + b, -10, 4, 10, c.lo); rect(ctx, -6 - b, -10, 4, 10, c.lo); rect(ctx, 4 + b, -10, 4, 10, c.lo); rect(ctx, 10 - b, -10, 4, 10, c.lo);
      ctx.save(); ctx.translate(-4, -26); ctx.rotate(t * 4); rect(ctx, -6, -1, 12, 2, c.key); rect(ctx, -1, -6, 2, 12, c.key); ctx.restore();   // заводной ключ
      rect(ctx, -22, -24, 8, 3, c.lo);
      ctx.restore(); return;
    }
    var big = e.k === 'heavy' ? 1.18 : 1, H = 58 * big;
    ctx.scale(big, big); H = 58;
    var s1 = walk * 5;
    rect(ctx, -7 + s1, -22, 7, 18, c.pants); rect(ctx, 1 - s1, -22, 7, 18, c.pants);
    rect(ctx, -9 + s1, -5, 11, 5, rt ? E.k : '#1a1410'); rect(ctx, -1 - s1, -5, 11, 5, rt ? E.k : '#1a1410');
    // корпус
    rect(ctx, -10, -H + 16, 20, 22, c.body); rect(ctx, -10, -H + 16, 4, 22, c.lo); rect(ctx, 6, -H + 16, 4, 22, c.hi);
    if (e.k === 'heavy') { rect(ctx, -8, -H + 22, 16, 22, c.apron); rect(ctx, -2, -H + 18, 4, 4, c.apron); }
    else { rect(ctx, -1, -H + 18, 2, 18, c.trim); rect(ctx, -9, -H + 34, 18, 3, c.trim); }
    if (e.k === 'thrower') { rect(ctx, -14, -H + 28, 8, 10, rt ? E.n : '#5a4a2a'); }
    // руки
    if (wind === 1) { rect(ctx, -16, -H + 18, 8, 8, c.body); rect(ctx, -20, -H + 18, 6, 6, rt ? E.Y : '#d8a882'); }
    else if (wind === 2) { if (e.k === 'heavy') { rect(ctx, 4, -24, 26, 9, c.pants); rect(ctx, 28, -26, 9, 12, rt ? E.k : '#1a1410'); } else { rect(ctx, 4, -H + 20, 22, 7, c.body); rect(ctx, 24, -H + 19, 7, 8, rt ? E.Y : '#d8a882'); } }
    else { rect(ctx, -3 + walk * 3, -H + 20, 6, 18, c.hi); rect(ctx, -3 + walk * 3, -H + 36, 6, 5, rt ? E.Y : '#d8a882'); }
    // голова
    rect(ctx, -6, -H + 4, 13, 12, rt ? E.Y : '#d8a882'); rect(ctx, 2, -H + 8, 6, 3, rt ? E.c : '#7fd8e8');   // очки
    if (e.k === 'heavy') { rect(ctx, -6, -H + 2, 13, 3, rt ? E.d : '#2a2a2a'); rect(ctx, 1, -H + 13, 7, 2, rt ? E.n : '#3a2414'); }
    else { rect(ctx, -7, -H + 1, 15, 5, c.cap); rect(ctx, 3, -H + 5, 9, 2, c.cap); }
    if (e.sleep) { rect(ctx, 2, -H + 8, 6, 3, rt ? E.Y : '#d8a882'); rect(ctx, 2, -H + 9, 6, 1, rt ? E.k : '#2a1a10'); }
    ctx.restore();
    if (e.sleep) { for (var z = 0; z < 2; z++) { var zt = (t * 0.7 + z * 0.5) % 1; ctx.globalAlpha = 1 - zt; text(ctx, 'z', x + 10 + zt * 10, y - 64 - zt * 18, 10 + z * 2, rt ? E.w : '#cfe0ff', rt); ctx.globalAlpha = 1; } }
  }
  function text(ctx, s, x, y, size, col, rt, align, weight) {
    ctx.fillStyle = col; ctx.font = (weight || 800) + ' ' + size + 'px ' + (rt ? '"Courier New", monospace' : 'Inter, system-ui, sans-serif'); ctx.textAlign = align || 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillText(s, x, y);
  }
  // конус взгляда
  function coneDraw(ctx, S, e, rt) {
    if (e.out || e.sleep || e.down > 0 || e.stun > 0) return;
    var range = L.sightRange(S, e, S.hero), ex = e.x + e.face * 6, ey = L.eyeY(e), d = 0;
    for (d = 8; d < range; d += 8) if (S.wd.solid(Math.floor((ex + e.face * d) / T), Math.floor(ey / T))) break;
    var len = Math.min(range, d), hw = 20 + len * 0.32;
    var col = e.st === 'chase' ? (rt ? E.R : '255,80,60') : e.susp > 0.25 || e.st === 'look' ? (rt ? E.y : '255,190,60') : (rt ? E.Y : '255,240,180');
    if (rt) { ctx.globalAlpha = 0.28; poly(ctx, [ex, ey, ex + e.face * len, ey - hw, ex + e.face * len, ey + hw], col); ctx.globalAlpha = 1; return; }
    var g = ctx.createLinearGradient(ex, 0, ex + e.face * len, 0); g.addColorStop(0, 'rgba(' + col + ',.30)'); g.addColorStop(1, 'rgba(' + col + ',0)');
    poly(ctx, [ex, ey, ex + e.face * len, ey - hw, ex + e.face * len, ey + hw], g);
  }

  // ---------- эффекты (частицы, кольца шума, всплывашки) ----------
  var FX = { list: [], rings: [], pops: [] };
  FX.add = function (x, y, o) { for (var i = 0; i < (o.n || 8); i++) { var a = (o.a != null ? o.a : 0) + (Math.random() - 0.5) * (o.spread != null ? o.spread : 6.3), s = (o.sp || 80) * (0.3 + Math.random()); FX.list.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: o.life || 0.5, life: o.life || 0.5, c: o.c, r: o.r || 2, g: o.g == null ? 300 : o.g, puff: o.puff }); } };
  FX.ring = function (x, y, r, c) { FX.rings.push({ x: x, y: y, r: r, t: 0.6, c: c }); if (FX.rings.length > 12) FX.rings.shift(); };
  FX.pop = function (txt, x, y, c, big) { FX.pops.push({ s: txt, x: x, y: y, c: c, t: big ? 1.8 : 1.1, life: big ? 1.8 : 1.1, big: big }); if (FX.pops.length > 10) FX.pops.shift(); };
  FX.step = function (dt) {
    FX.list.forEach(function (p) { p.t -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; if (p.puff) { p.vx *= 0.94; p.vy *= 0.94; } });
    FX.list = FX.list.filter(function (p) { return p.t > 0; }); if (FX.list.length > 300) FX.list.splice(0, FX.list.length - 300);
    FX.rings.forEach(function (r) { r.t -= dt; }); FX.rings = FX.rings.filter(function (r) { return r.t > 0; });
    FX.pops.forEach(function (p) { p.t -= dt; p.y -= dt * 16; }); FX.pops = FX.pops.filter(function (p) { return p.t > 0; });
  };
  FX.clear = function () { FX.list = []; FX.rings = []; FX.pops = []; };

  // ---------- состояние героя для рисунка ----------
  function heroState(P) {
    if (P.dead) return 'down';
    if (P.atk) { var k = P.atk.k; return k === 'toss' ? 'toss' : k; }
    if (P.climb) return 'climb';
    if (P.crouch) return Math.abs(P.vx) > 1 ? 'sneak' : 'crouch';
    if (!P.ground && !P.ride) return 'idle';
    if (Math.abs(P.vx) > 1) return P.running ? 'run' : 'walk';
    return 'idle';
  }

  // ---------- кадр ----------
  var buf = null, dark = null;
  function render(g, ctx, S, ui) {
    var rt = g.themeName === 'retro', t = g.time, P = S.hero, sc = rt ? 0.5 : 1;
    var s = L.scrOf(P.x, P.y), X = Math.max(0, Math.min(M.CX - 1, s.X)), Y = Math.max(0, Math.min(M.CY - 1, s.Y));
    if (!S.map.screens[Y * M.CX + X]) { Y = Math.floor((P.y - 1) / RH); }
    var scr = S.map.screens[Y * M.CX + X]; if (!scr) return;
    if (!buf) { buf = mk(RW, RH); dark = mk(RW, RH); }
    if (!buf) return;
    var bctx = buf.getContext('2d'), W2 = RW * sc, H2 = RH * sc;
    if (buf.width !== W2) { buf.width = W2; buf.height = H2; dark.width = W2; dark.height = H2; }
    bctx.setTransform(1, 0, 0, 1, 0, 0); bctx.clearRect(0, 0, W2, H2);
    var st = screenStatic(S, X, Y, rt); if (st) bctx.drawImage(st, 0, 0);
    bctx.setTransform(sc, 0, 0, sc, -X * RW * sc, -Y * RH * sc);
    var ox = X * RW, oy = Y * RH, inScr = function (x, y) { return x >= ox - 40 && x <= ox + RW + 40 && y >= oy && y <= oy + RH + 40; };
    // декор с анимацией
    if (scr.zone === 'shop' || scr.zone === 'assembly') conveyor(bctx, ox, oy, rt, S.won ? 0 : t);
    if (scr.zone === 'engine') gears(bctx, ox, oy, rt, t, S);
    if (scr.zone === 'boiler' || scr.zone === 'foundry') furnace(bctx, ox, oy, rt, t, scr);
    if (X === Math.floor(S.map.plant.x / RW) && Y === Math.floor((S.map.plant.y - 1) / RH)) plantDraw(bctx, S, rt, t);
    S.map.doors.forEach(function (d) { if (inScr(d.tx * T, d.r0 * T)) doorDraw(bctx, S, d, rt); });
    S.map.grates.forEach(function (gr) { if (inScr(gr.tx * T, gr.r0 * T)) grateDraw(bctx, S, gr, rt, t); });
    S.map.shutters.forEach(function (sh) { if (inScr(sh.tx * T, sh.r0 * T)) shutterDraw(bctx, S, sh, rt, t); });
    S.map.hatches.forEach(function (h) { if (inScr(h.tx * T, h.ty * T)) hatchDraw(bctx, S, h, rt); });
    S.map.lifts.forEach(function (lf) { if (Math.floor(lf.tx / SW) === X) liftDraw(bctx, S, lf, rt, X, Y); });
    if (Y === 5 && Math.floor(S.wd.cart.x / RW) === X) cartDraw(bctx, S, rt, t);
    S.items.forEach(function (it) { if (!it.taken && inScr(it.x, it.y - 10)) itemDraw(bctx, it, rt, t); });
    // конусы, стража
    S.enemies.forEach(function (e) { if (inScr(e.x, e.y - 10) && L.scrOf(e.x, e.y).X === X) coneDraw(bctx, S, e, rt); });
    S.enemies.forEach(function (e) { if (inScr(e.x, e.y - 10) && L.scrOf(e.x, e.y).X === X) guard(bctx, e, t, rt); });
    // герой
    var hid = L.hidden(S.map, P), hs = heroState(P);
    var blink = P.inv > 0 && Math.floor(t * 20) % 2;
    if (!blink) hero(bctx, P.x, P.y, { face: P.face, state: hs, t: P.t, rt: rt, held: P.held, flash: P.flash, clock: !S.planted, alpha: hid ? 0.55 : 1 });
    if (P.ride && P.ride.k === 'cart') {} // дрезина нарисована
    // снаряды
    S.proj.forEach(function (p) { throwable(bctx, p.k, p.x, p.y, p.k === 'washer' ? t * 20 : t * 10, rt); });
    // значки «?» / «!»
    S.enemies.forEach(function (e) {
      if (e.out || !inScr(e.x, e.y) || L.scrOf(e.x, e.y).X !== X) return;
      var ty = e.y - (e.k === 'dog' ? 40 : e.k === 'heavy' ? 80 : 72);
      if (e.st === 'chase') text(bctx, '!', e.x, ty, rt ? 26 : 18, rt ? E.R : '#ff5a4a', rt);
      else if (e.susp > 0.2 || e.st === 'look') { text(bctx, '?', e.x, ty, rt ? 24 : 16, rt ? E.y : '#ffcf5a', rt); if (e.susp > 0.05) { rect(bctx, e.x - 12, ty + 4, 24, 3, rt ? E.d : 'rgba(0,0,0,.5)'); rect(bctx, e.x - 12, ty + 4, 24 * e.susp, 3, rt ? E.y : '#ffcf5a'); } }
    });
    // частицы
    FX.list.forEach(function (p) { bctx.globalAlpha = Math.max(0, p.t / p.life); if (rt) rect(bctx, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2, p.c); else circ(bctx, p.x, p.y, p.r * (p.puff ? (1.6 - p.t / p.life) : 1), p.c); });
    bctx.globalAlpha = 1;
    FX.rings.forEach(function (r) { bctx.globalAlpha = r.t / 0.6 * 0.6; bctx.strokeStyle = r.c; bctx.lineWidth = rt ? 2 : 1.5; bctx.beginPath(); bctx.arc(r.x, r.y - 20, r.r * (1 - r.t / 0.6 * 0.6), 0, 7); bctx.stroke(); });
    bctx.globalAlpha = 1;
    // темнота
    if (scr.dark) darkness(bctx, S, X, Y, rt, sc, scr.zone);
    // подсказка «в тени»
    if (hid) { // значок «в тени»: закрытый глаз
      var ix = P.x, iy = P.y - 48, ic = rt ? E.c : '#9fd8ff';
      bctx.strokeStyle = ic; bctx.lineWidth = rt ? 3 : 2; bctx.beginPath(); bctx.arc(ix, iy - 4, 8, 0.25, Math.PI - 0.25); bctx.stroke();
      for (var lsh = -1; lsh <= 1; lsh++) line(bctx, ix + lsh * 5, iy + 3, ix + lsh * 7, iy + 7, ic, rt ? 3 : 2);
    }
    FX.pops.forEach(function (p) { bctx.globalAlpha = Math.min(1, p.t / p.life * 2); text(bctx, p.s, p.x, p.y, p.big ? 14 : 11, p.c, rt); bctx.globalAlpha = 1; });
    // на основной холст
    bctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.save();
    ctx.imageSmoothingEnabled = !rt;
    var shx = ui.shake > 0 ? (Math.random() - 0.5) * 6 : 0, shy = ui.shake > 0 ? (Math.random() - 0.5) * 6 : 0;
    ctx.fillStyle = rt ? '#000' : '#07090c'; ctx.fillRect(0, 0, VW, VH);
    ctx.drawImage(buf, 0, 0, W2, H2, shx, HUD + shy, RW, RH);
    // тревога — красная рамка
    if (S.alarmT > 0 && S.phase === 'in') { ctx.globalAlpha = 0.25 + 0.2 * Math.sin(t * 10); ctx.strokeStyle = rt ? E.R : '#ff3a2a'; ctx.lineWidth = 6; ctx.strokeRect(3, HUD + 3, VW - 6, RH - 6); ctx.globalAlpha = 1; }
    if (S.planted && S.bombT < 20) { ctx.globalAlpha = 0.12 + 0.1 * Math.sin(t * 12); ctx.fillStyle = rt ? E.R : '#ff3a2a'; ctx.fillRect(0, HUD, VW, RH); ctx.globalAlpha = 1; }
    hud(g, ctx, S, rt, t, X, Y, scr);
    if (ui.banner) bannerDraw(g, ctx, ui.banner, rt);
    if (ui.tip) { var a = Math.min(1, ui.tip.a); ctx.globalAlpha = a; ctx.fillStyle = rt ? '#000' : 'rgba(10,14,20,.82)'; ctx.fillRect(VW / 2 - 250, VH - 34, 500, 24); text(ctx, ui.tip.text, VW / 2, VH - 17, rt ? 11 : 12, rt ? E.Y : '#ffe9b0', rt, 'center', 700); ctx.globalAlpha = 1; }
    ctx.restore();
  }
  function darkness(bctx, S, X, Y, rt, sc, zone) {
    var dctx = dark.getContext('2d'), P = S.hero, ox = X * RW, oy = Y * RH;
    dctx.setTransform(1, 0, 0, 1, 0, 0); dctx.globalCompositeOperation = 'source-over'; dctx.clearRect(0, 0, dark.width, dark.height);
    var da = zone === 'roof' ? (rt ? 0.28 : 0.3) : (rt ? 0.45 : 0.52); dctx.fillStyle = rt ? 'rgba(0,0,24,' + da + ')' : 'rgba(2,4,14,' + da + ')'; dctx.fillRect(0, 0, dark.width, dark.height);
    dctx.setTransform(sc, 0, 0, sc, -ox * sc, -oy * sc);
    dctx.globalCompositeOperation = 'destination-out';
    function hole(x, y, r, a) {
      if (rt) { dctx.fillStyle = 'rgba(0,0,0,' + a + ')'; dctx.beginPath(); dctx.arc(x, y, r * 0.8, 0, 7); dctx.fill(); return; }
      var g = dctx.createRadialGradient(x, y, r * 0.15, x, y, r); g.addColorStop(0, 'rgba(0,0,0,' + a + ')'); g.addColorStop(1, 'rgba(0,0,0,0)'); dctx.fillStyle = g; dctx.beginPath(); dctx.arc(x, y, r, 0, 7); dctx.fill();
    }
    S.map.lamps.forEach(function (lp) { if (lp.X === X && lp.Y === Y) { if (rt) { dctx.fillStyle = 'rgba(0,0,0,.85)'; dctx.beginPath(); dctx.moveTo(lp.x - 10, lp.y + 16); dctx.lineTo(lp.x + 10, lp.y + 16); dctx.lineTo(lp.x + 84, lp.fy); dctx.lineTo(lp.x - 84, lp.fy); dctx.fill(); } else { var g = dctx.createLinearGradient(0, lp.y, 0, lp.fy); g.addColorStop(0, 'rgba(0,0,0,.95)'); g.addColorStop(1, 'rgba(0,0,0,.8)'); dctx.fillStyle = g; dctx.beginPath(); dctx.moveTo(lp.x - 10, lp.y + 16); dctx.lineTo(lp.x + 10, lp.y + 16); dctx.lineTo(lp.x + 84, lp.fy); dctx.lineTo(lp.x - 84, lp.fy); dctx.fill(); } } });
    // вокруг героя чуть видно
    hole(P.x, P.y - 28, 70, 0.55);
    // выход (луна)
    if (S.map.exit.X === X && S.map.exit.Y === Y) hole(S.map.exit.X * RW + 70, S.map.exit.y - 70, 120, 0.8);
    if (P.flash && !P.dead) {
      var hx = P.x + P.face * 10, hy = P.y - 50, len = 230;
      if (rt) { dctx.fillStyle = 'rgba(0,0,0,.9)'; dctx.beginPath(); dctx.moveTo(hx, hy); dctx.lineTo(hx + P.face * len, hy - 50); dctx.lineTo(hx + P.face * len, hy + 70); dctx.fill(); }
      else { var g2 = dctx.createLinearGradient(hx, 0, hx + P.face * len, 0); g2.addColorStop(0, 'rgba(0,0,0,.95)'); g2.addColorStop(1, 'rgba(0,0,0,.3)'); dctx.fillStyle = g2; dctx.beginPath(); dctx.moveTo(hx, hy); dctx.lineTo(hx + P.face * len, hy - 46); dctx.lineTo(hx + P.face * len, hy + 66); dctx.fill(); }
    }
    dctx.globalCompositeOperation = 'source-over'; dctx.setTransform(1, 0, 0, 1, 0, 0);
    bctx.save(); bctx.setTransform(1, 0, 0, 1, 0, 0); bctx.drawImage(dark, 0, 0); bctx.restore();
    if (P.flash && !P.dead && !rt) { bctx.save(); bctx.globalAlpha = 0.08; poly(bctx, [P.x + P.face * 10, P.y - 50, P.x + P.face * 240, P.y - 96, P.x + P.face * 240, P.y + 16], '#fff2b0'); bctx.restore(); }
  }
  function conveyor(ctx, ox, oy, rt, t) {
    var y = oy + 150, off = (t * 40) % 24;
    rect(ctx, ox, y, RW, 14, rt ? E.d : '#2a2a2e'); rect(ctx, ox, y, RW, 3, rt ? E.g : '#5a5a60');
    for (var x = -24; x < RW + 24; x += 24) rect(ctx, ox + x + off, y + 5, 12, 4, rt ? E.k : '#18181a');
    for (x = 40; x < RW; x += 160) { rect(ctx, ox + x, y + 14, 6, 20, rt ? E.d : '#2a2a2e'); rect(ctx, ox + x + 40 + ((t * 40) % 160), y - 14, 22, 14, rt ? E.n : '#7a5a3a'); }
  }
  function gears(ctx, ox, oy, rt, t, S) {
    var sp = S.won ? 0 : t;
    [[ox + 120, oy + 110, 46, 1], [ox + 196, oy + 150, 30, -1.5], [ox + 470, oy + 100, 40, 1.1]].forEach(function (g) {
      ctx.save(); ctx.translate(g[0], g[1]); ctx.rotate(sp * g[3] * 0.6);
      for (var i = 0; i < 10; i++) { ctx.rotate(Math.PI / 5); rect(ctx, -5, -g[2] - 7, 10, 10, rt ? E.N : '#6a5428'); }
      circ(ctx, 0, 0, g[2], rt ? E.N : '#7a6030'); circ(ctx, 0, 0, g[2] * 0.6, rt ? E.t : '#1e2a2e'); circ(ctx, 0, 0, 6, rt ? E.y : '#c9a043'); ctx.restore();
    });
    var py = Math.sin(sp * 3) * 20; rect(ctx, ox + 300, oy + 60, 18, 120, rt ? E.d : '#3a4a52'); rect(ctx, ox + 296, oy + 120 + py, 26, 30, rt ? E.l : '#8a9aa4');
  }
  function furnace(ctx, ox, oy, rt, t, scr) {
    for (var i = 0; i < 2; i++) {
      var x = ox + 90 + i * 330 + hash(i, scr.X, 3) * 60, y = oy + RH - 32 - 120;
      rect(ctx, x, y, 90, 120, rt ? E.d : '#3a2e28'); rect(ctx, x - 6, y - 10, 102, 12, rt ? E.g : '#5a4a40');
      var fl = 0.7 + 0.3 * Math.sin(t * 9 + i);
      rect(ctx, x + 20, y + 50, 50, 36, rt ? E.R : 'rgb(' + (220 * fl | 0) + ',' + (110 * fl | 0) + ',30)');
      rect(ctx, x + 26, y + 58, 38, 20, rt ? E.y : '#ffd060');
      rect(ctx, x + 36, y - 60, 18, 50, rt ? E.d : '#2e2420');
      if (!rt) { ctx.globalAlpha = 0.18 * fl; circ(ctx, x + 45, y + 70, 80, '#ff8a3a'); ctx.globalAlpha = 1; }
    }
  }
  function bar(ctx, x, y, w, h, v, col, back, rt) { rect(ctx, x, y, w, h, back); rect(ctx, x, y, Math.max(0, w * v), h, col); if (!rt) { ctx.globalAlpha = 0.25; rect(ctx, x, y, Math.max(0, w * v), 2, '#fff'); ctx.globalAlpha = 1; } }
  function fmt(s) { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  function hud(g, ctx, S, rt, t, X, Y, scr) {
    var P = S.hero, th = g.th();
    rect(ctx, 0, 0, VW, HUD, rt ? '#000' : '#0d1118'); rect(ctx, 0, HUD - 1, VW, 1, rt ? E.b : '#24304a');
    text(ctx, g.t('hp'), 10, 13, 9, rt ? E.l : '#8a96a8', rt, 'left', 700); bar(ctx, 10, 17, 96, 7, P.hp / K.HP, rt ? E.R : '#e0503e', rt ? E.d : '#2a1a1c', rt);
    text(ctx, g.t('en'), 10, 34, 9, rt ? E.l : '#8a96a8', rt, 'left', 700); bar(ctx, 58, 27, 48, 7, P.en / K.EN, rt ? E.c : '#4fc3e0', rt ? E.d : '#14262c', rt);
    // предмет в руке
    rect(ctx, 116, 6, 28, 28, rt ? E.d : '#1a2130'); if (P.held) throwable(ctx, P.held, 130, 20, -0.4, rt); else text(ctx, '·', 130, 25, 12, rt ? E.g : '#4a5468', rt);
    // карты, матрица, будильник
    ['red', 'blue', 'yellow'].forEach(function (c, i) { var x = 154 + i * 20, have = S.cards[c]; rect(ctx, x, 12, 16, 11, have ? CARDC[c][rt ? 1 : 0] : (rt ? E.k : '#1a2130')); if (!have) { ctx.strokeStyle = CARDC[c][rt ? 1 : 0]; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, 12.5, 15, 10); } });
    ctx.globalAlpha = S.matrix ? 1 : 0.3; rect(ctx, 218, 12, 14, 8, rt ? E.y : '#d8a83a'); rect(ctx, 222, 6, 6, 6, rt ? E.N : '#a07428'); ctx.globalAlpha = 1;
    ctx.globalAlpha = S.planted ? 0.35 : 1; clockIcon(ctx, 248, 20, 6, rt, t, false); ctx.globalAlpha = 1;
    text(ctx, '♥' + S.lives, 270, 25, 12, rt ? E.R : '#ff6a6a', rt, 'left', 800);
    // место
    text(ctx, g.t('z_' + scr.zone) + ' · ' + scr.idx, 380, 17, rt ? 11 : 12, rt ? E.w : '#e8eef8', rt, 'center', 800);
    text(ctx, g.t('d' + S.diff), 380, 32, 9, rt ? E.l : '#7a869a', rt, 'center', 700);
    // мини-карта
    var mx = 470, my = 6, cw = 5, ch = 4.4;
    for (var yy = 0; yy < M.CY; yy++) for (var xx = 0; xx < M.CX; xx++) {
      if (!S.map.screens[yy * M.CX + xx]) continue; var vis = S.seen && S.seen[yy * M.CX + xx];
      rect(ctx, mx + xx * cw, my + yy * ch, cw - 1, ch - 1, xx === X && yy === Y ? (Math.floor(t * 3) % 2 ? (rt ? E.y : '#ffd860') : (rt ? E.w : '#ffffff')) : vis ? (rt ? E.g : '#4a5670') : (rt ? E.d : '#1c2230'));
    }
    rect(ctx, mx + S.map.exit.X * cw + 1, my + S.map.exit.Y * ch + 1, 2, 2, rt ? E.Gl : '#6ff08c');
    if (S.matrix && !S.planted) { var pX = Math.floor(S.map.plant.x / RW), pY = Math.floor((S.map.plant.y - 1) / RH); rect(ctx, mx + pX * cw + 1, my + pY * ch + 1, 2, 2, rt ? E.R : '#ff7a5a'); }
    // время / будильник
    if (S.planted) { var red = S.bombT < 20 && Math.floor(t * 4) % 2; text(ctx, g.t('bomb'), VW - 10, 14, 9, rt ? E.R : '#ff8a6a', rt, 'right', 800); text(ctx, fmt(S.bombT), VW - 10, 34, 18, red ? (rt ? E.w : '#ffffff') : (rt ? E.R : '#ff5a4a'), rt, 'right', 900); }
    else { text(ctx, g.t('time'), VW - 10, 14, 9, rt ? E.l : '#7a869a', rt, 'right', 700); text(ctx, fmt(S.time), VW - 10, 33, 15, rt ? E.w : '#e8eef8', rt, 'right', 800); }
    if (S.alarmT > 0 && S.phase === 'in' && Math.floor(t * 4) % 2) text(ctx, g.t('alarm'), 380, HUD + 22, 16, rt ? E.R : '#ff5a4a', rt, 'center', 900);
  }
  function bannerDraw(g, ctx, b, rt) {
    var a = Math.min(1, b.a / 0.4, (b.dur - b.a) / 0.25 + 0.2); ctx.globalAlpha = Math.max(0, Math.min(1, a));
    rect(ctx, 0, 150, VW, b.sub ? 60 : 42, rt ? '#000' : 'rgba(8,10,16,.82)');
    text(ctx, b.title, VW / 2, 178, rt ? 20 : 22, b.color || (rt ? E.y : '#ffd27a'), rt, 'center', 900);
    if (b.sub) text(ctx, b.sub, VW / 2, 200, 12, rt ? E.l : '#cfd8e6', rt, 'center', 700);
    ctx.globalAlpha = 1;
  }

  LZ.render = render;
  LZ.R = { hero: hero, guard: guard, coneDraw: coneDraw, cover: cover, clockIcon: clockIcon, throwable: throwable, FX: FX, VW: VW, VH: VH, HUD: HUD, E: E, ZM: ZM, ZR: ZR, text: text, rect: rect, heroState: heroState, clearCache: function () { cache = {}; } };
})(typeof window !== 'undefined' ? window : globalThis);
