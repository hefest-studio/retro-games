/* ЮЗ · рендер RETRO (8-бит, палитра EGA). YUZ.classic = { name, P, bake(T), car, item, skid, badge }
   Трасса рисуется прямо из сетки покрытий (клетка 8 px = «пиксель-блок»): дизеринг, бортики в клетку,
   реквизит — блочные спрайты, машинки — 16 направлений с привязкой к пикселю. Логику не трогает. */
(function (global) {
  'use strict';
  var Y = global.YUZ = global.YUZ || {};
  var L = Y.logic;
  var E = { k: '#000000', b: '#0000aa', g: '#00aa00', c: '#00aaaa', r: '#aa0000', m: '#aa00aa', o: '#aa5500', l: '#aaaaaa',
    d: '#555555', B: '#5555ff', G: '#55ff55', C: '#55ffff', R: '#ff5555', M: '#ff55ff', Y: '#ffff55', w: '#ffffff' };
  var P = {
    pixel: true, font: '"Courier New", ui-monospace, monospace',
    ink: E.w, muted: E.l, accent: E.Y, good: E.G, bad: E.R, warn: E.Y, panel: '#000000', line: E.B,
    sand: { desk: E.Y, bench: E.Y, kitchen: E.w, garden: E.Y }
  };
  var ROOM = {   // [фон1, фон2, дорога1, дорога2, бортик1, бортик2]
    desk: ['#006a00', '#005c00', E.d, '#4a4a4a', E.R, E.w],
    bench: [E.o, '#884400', E.l, '#999999', E.B, E.w],
    kitchen: [E.r, E.w, E.c, '#008f8f', E.b, E.w],
    garden: ['#008800', '#007a00', E.o, '#995511', E.w, E.G]
  };
  var CAR = { '#3d8bff': E.B, '#33d17a': E.G, '#e8484f': E.R, '#f2b233': E.Y };

  var cache = {};
  function bake(T) {
    if (cache[T.id]) return cache[T.id];
    var C = L.CELL, cv = document.createElement('canvas'); cv.width = T.W; cv.height = T.H;
    var x = cv.getContext('2d'), R = ROOM[T.room], G = T.grid, cols = T.cols;
    for (var r = 0; r < T.rows; r++) for (var c = 0; c < cols; c++) {
      var v = G[r * cols + c], px = c * C, py = r * C, chk = (c + r) % 2, col;
      if (v === L.WALL) {
        var edge = false;
        for (var dy = -1; dy <= 1 && !edge; dy++) for (var dx = -1; dx <= 1; dx++) { var nc = c + dx, nr = r + dy; if (nc >= 0 && nr >= 0 && nc < cols && nr < T.rows && G[nr * cols + nc] !== L.WALL) { edge = true; break; } }
        if (edge) col = ((c >> 1) + (r >> 1)) % 2 ? R[4] : R[5];
        else if (T.room === 'kitchen') col = ((c / 6 | 0) + (r / 6 | 0)) % 2 ? R[0] : R[1];
        else if (T.room === 'bench') col = (r >> 3) % 2 ? R[0] : R[1];
        else col = chk ? R[0] : R[1];
      } else if (v === L.SAND) col = chk ? E.Y : E.o;
      else if (v === L.ICE) col = chk ? E.C : E.w;
      else if (v === L.WATER) col = chk ? E.b : E.B;
      else if (v === L.OIL) col = chk ? E.k : E.m;
      else if (v === L.JUMP) col = ((c + r) >> 1) % 2 ? E.Y : E.k;
      else col = chk ? R[2] : R[3];
      x.fillStyle = col; x.fillRect(px, py, C, C);
      if (T.room === 'kitchen' && v === L.WALL && !edge && (c % 6 === 0 || r % 6 === 0)) { x.fillStyle = 'rgba(0,0,0,.12)'; x.fillRect(px, py, C, C); }
    }
    // разметка по оси и старт
    for (var i = 0; i < T.n; i += 6) if ((i / 6 | 0) % 2) { var s = T.smp[i]; if (T.grid[Math.floor(s.y / C) * cols + Math.floor(s.x / C)] === L.ASPH) { x.fillStyle = E.w; x.fillRect(Math.round(s.x / 4) * 4 - 2, Math.round(s.y / 4) * 4 - 2, 4, 4); } }
    for (var l = -T.hw; l < T.hw; l += 8) for (var row = 0; row < 2; row++) { var p = Y.ui.pt(T, row * 8 + 4, l + 4); x.fillStyle = ((l + T.hw) / 8 + row) % 2 ? E.w : E.k; x.fillRect(Math.floor(p[0] / 8) * 8, Math.floor(p[1] / 8) * 8, 8, 8); }
    // реквизит: блочные силуэты
    Y.ui.props(T).forEach(function (p) {
      var k = p.kind, rr = Math.max(4, Math.round(p.r / 4) * 4), X = Math.round(p.x / 4) * 4, Yy = Math.round(p.y / 4) * 4;
      var main = { bolt: E.l, nut: E.l, pencil: E.Y, ruler: E.w, eraser: E.w, clip: E.l, nail: E.l, block: E.Y, screw: E.l, chips: E.Y, tape: E.l,
        plate: E.w, cup: E.w, spoon: E.l, cookie: E.o, pepper: E.d, flower: [E.M, E.Y, E.w, E.R][(p.v * 4) | 0], stone: E.l, leaf: E.o, mushroom: E.R, bush: '#008800' }[k];
      x.fillStyle = E.k;
      if (k === 'pencil' || k === 'ruler' || k === 'nail' || k === 'spoon') {
        var horiz = Math.abs(Math.cos(p.rot)) > 0.7, w = horiz ? rr * 2 : 8, h = horiz ? 8 : rr * 2;
        x.fillRect(X - w / 2 + 4, Yy - h / 2 + 4, w, h); x.fillStyle = main; x.fillRect(X - w / 2, Yy - h / 2, w, h);
        x.fillStyle = k === 'pencil' ? E.k : k === 'ruler' ? E.d : E.w; if (horiz) x.fillRect(X + w / 2 - 4, Yy - 2, 4, 4); else x.fillRect(X - 2, Yy + h / 2 - 4, 4, 4);
      } else {
        x.fillRect(X - rr + 4, Yy - rr + 4, rr * 2, rr * 2);
        x.fillStyle = main; x.fillRect(X - rr, Yy - rr + 4, rr * 2, rr * 2 - 8); x.fillRect(X - rr + 4, Yy - rr, rr * 2 - 8, rr * 2);
        var dot = { nut: E.k, tape: R[0], cup: E.o, plate: E.B, cookie: E.k, flower: E.Y, mushroom: E.w, bolt: E.d, screw: E.d }[k];
        if (dot) { x.fillStyle = dot; x.fillRect(X - 4, Yy - 4, 8, 8); }
      }
    });
    cache[T.id] = cv; return cv;
  }
  function car(ctx, c, t, labels) {
    var z = c.z || 0, a = Math.round(c.a / (Math.PI / 8)) * (Math.PI / 8), X = Math.round(c.x / 2) * 2, Yy = Math.round((c.y - z * 4) / 2) * 2, s = z > 0.05 ? 1.25 : 1;
    ctx.save(); ctx.translate(Math.round(c.x + 2 + z * 10), Math.round(c.y + 3 + z * 14)); ctx.rotate(a); ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(-8, -5, 16, 10); ctx.restore();
    ctx.save(); ctx.translate(X, Yy); ctx.rotate(a); ctx.scale(s, s);
    if (c.boost > 0 && Math.floor(t * 20) % 2) { ctx.fillStyle = E.Y; ctx.fillRect(-13, -2, 4, 4); ctx.fillStyle = E.R; ctx.fillRect(-11, -3, 2, 6); }
    ctx.fillStyle = E.k; ctx.fillRect(-7, -6, 4, 12); ctx.fillRect(3, -6, 4, 12);
    ctx.fillStyle = CAR[c.color] || c.color; ctx.fillRect(-9, -4, 18, 8);
    ctx.fillStyle = E.w; ctx.fillRect(2, -3, 3, 6);
    ctx.fillStyle = E.k; ctx.fillRect(-4, -3, 5, 6);
    ctx.fillStyle = E.Y; ctx.fillRect(8, -4, 2, 2); ctx.fillRect(8, 2, 2, 2);
    ctx.restore();
    if (c.shield > 0 && (c.shield > 1.5 || Math.floor(t * 10) % 2)) {
      ctx.fillStyle = E.C; for (var i = 0; i < 12; i++) { var q = i / 12 * 6.283 + t * 3; ctx.fillRect(Math.round(c.x + Math.cos(q) * 13) - 1, Math.round(c.y - z * 4 + Math.sin(q) * 13) - 1, 3, 3); }
    }
    if (labels && c.human) { ctx.fillStyle = E.k; ctx.fillRect(X - 10, Yy - 25, 20, 11); ctx.fillStyle = CAR[c.color]; ctx.font = '700 9px "Courier New", monospace'; ctx.textAlign = 'center'; ctx.fillText(labels[c.pi], X, Yy - 16); }
  }
  function item(ctx, it, t) {
    if (it.t > 0) { if (Math.floor(t * 4) % 2) { ctx.fillStyle = E.d; ctx.fillRect(Math.round(it.x) - 2, Math.round(it.y) - 2, 4, 4); } return; }
    var X = Math.round(it.x / 2) * 2, Yy = Math.round(it.y / 2) * 2, blink = Math.floor(t * 6) % 2;
    ctx.fillStyle = E.k; ctx.fillRect(X - 8, Yy - 8, 16, 16);
    if (it.k === 'boost') {
      ctx.fillStyle = blink ? E.R : E.Y; ctx.fillRect(X - 7, Yy - 7, 14, 14);
      ctx.fillStyle = E.w; ctx.fillRect(X - 5, Yy - 4, 2, 8); ctx.fillRect(X - 3, Yy - 2, 2, 4); ctx.fillRect(X, Yy - 4, 2, 8); ctx.fillRect(X + 2, Yy - 2, 2, 4);
    } else {
      ctx.fillStyle = blink ? E.B : E.C; ctx.fillRect(X - 7, Yy - 7, 14, 14);
      ctx.fillStyle = E.w; ctx.fillRect(X - 4, Yy - 5, 8, 6); ctx.fillRect(X - 2, Yy + 1, 4, 3);
    }
  }
  function skid(lx, p, c) {
    lx.fillStyle = 'rgba(0,0,0,.35)';
    for (var sd = -1; sd <= 1; sd += 2) { var ox = -Math.sin(c.a) * 4 * sd - Math.cos(c.a) * 6, oy = Math.cos(c.a) * 4 * sd - Math.sin(c.a) * 6; lx.fillRect(Math.round((c.x + ox) / 2) * 2 - 1, Math.round((c.y + oy) / 2) * 2 - 1, 2, 2); }
  }
  function badge(ctx, x, y, k, t) { if (t < 1 && Math.floor(t * 10) % 2) return; item(ctx, { x: x, y: y + 2, k: k, t: 0 }, 0); }
  Y.classic = { name: 'retro', P: P, ROOM: ROOM, bake: bake, car: car, item: item, skid: skid, badge: badge };
})(typeof window !== 'undefined' ? window : globalThis);
