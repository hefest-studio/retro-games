/* ЮЗ · рендер MODERN (по умолчанию). YUZ.modern = { name, P, bake(T), car, item, skid, badge }
   Мягкий «настольный» вид: коврик мастерской, доски верстака, скатерть в клетку, газон сада;
   дорога с бортиками-«зебрами», покрытия с фактурой, реквизит комнат с тенями. Логику не трогает. */
(function (global) {
  'use strict';
  var Y = global.YUZ = global.YUZ || {};
  var L = Y.logic;
  var P = {
    pixel: false, font: null,
    ink: '#f2f5fa', muted: '#a3adbf', accent: '#ff8a3d', good: '#4fd88a', bad: '#ff5d6c', warn: '#ffc23d',
    panel: '#141923', line: '#2c3546',
    sand: { desk: '#d9c08a', bench: '#e6c78e', kitchen: '#f3efe6', garden: '#e2c58a' }
  };
  var ROOM = {
    desk: { bg: '#2d6a52', bg2: '#337659', grid: 'rgba(255,255,255,.07)', road: '#c4c9d2', road2: '#b7bdc8', edge: '#eef1f5', curb: '#e8484f', shade: 'rgba(0,0,0,.28)' },
    bench: { bg: '#6b4426', bg2: '#5f3b20', grid: 'rgba(0,0,0,.18)', road: '#dcbf8f', road2: '#d2b27f', edge: '#f4e2c2', curb: '#3d7dd8', shade: 'rgba(0,0,0,.32)' },
    kitchen: { bg: '#e9e1d4', bg2: '#c8484a', grid: 'rgba(0,0,0,.05)', road: '#a9c7d9', road2: '#9dbdd0', edge: '#ffffff', curb: '#2f5f8a', shade: 'rgba(40,20,10,.25)' },
    garden: { bg: '#3f8a3c', bg2: '#4a9645', grid: 'rgba(0,0,0,.08)', road: '#b88e5c', road2: '#ad8352', edge: '#d9bb8a', curb: '#f0f0f0', shade: 'rgba(0,0,0,.25)' }
  };
  var SCOL = {};
  SCOL[L.ICE] = '#d5f3ff'; SCOL[L.WATER] = 'rgba(70,150,230,.78)'; SCOL[L.OIL] = '#17171d';

  function bakeBg(x, T, R) {
    var W = T.W, H = T.H, i;
    x.fillStyle = R.bg; x.fillRect(0, 0, W, H);
    if (T.room === 'desk') {   // коврик для резки: мелкая и крупная сетка
      x.strokeStyle = R.grid; x.lineWidth = 1;
      for (i = 0; i < W; i += 20) { x.beginPath(); x.moveTo(i + 0.5, 0); x.lineTo(i + 0.5, H); x.stroke(); }
      for (i = 0; i < H; i += 20) { x.beginPath(); x.moveTo(0, i + 0.5); x.lineTo(W, i + 0.5); x.stroke(); }
      x.strokeStyle = 'rgba(255,255,255,.14)'; x.lineWidth = 1.5;
      for (i = 0; i < W; i += 100) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, H); x.stroke(); }
      for (i = 0; i < H; i += 100) { x.beginPath(); x.moveTo(0, i); x.lineTo(W, i); x.stroke(); }
    } else if (T.room === 'bench') {   // доски с волокнами
      for (i = 0; i < H; i += 64) {
        x.fillStyle = (i / 64) % 2 ? R.bg : R.bg2; x.fillRect(0, i, W, 64);
        x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(0, i, W, 2);
        x.strokeStyle = 'rgba(255,220,170,.06)'; x.lineWidth = 1.5;
        for (var k = 0; k < 5; k++) { x.beginPath(); var yy = i + 10 + k * 11; x.moveTo(0, yy); for (var q = 0; q <= W; q += 60) x.lineTo(q, yy + Math.sin(q * 0.013 + i + k) * 3); x.stroke(); }
      }
    } else if (T.room === 'kitchen') {   // скатерть в клетку
      var sq = 48;
      for (var r = 0; r * sq < H; r++) for (var c = 0; c * sq < W; c++) {
        var a = r % 2, b = c % 2; x.fillStyle = a && b ? '#c8484a' : (a || b) ? '#e0a4a0' : '#f3ece2'; x.fillRect(c * sq, r * sq, sq, sq);
      }
    } else {   // газон: пятна и травинки
      var rnd = Y.ui.mulberry32(7);
      for (i = 0; i < W * H / 900; i++) { x.fillStyle = rnd() < 0.5 ? 'rgba(20,60,20,.18)' : 'rgba(120,190,90,.14)'; var px = rnd() * W, py = rnd() * H; x.fillRect(px, py, 2, 6 + rnd() * 5); }
    }
  }
  function prop(x, p, R, room) {
    x.save(); x.translate(p.x, p.y); x.rotate(p.rot);
    var sh = function (f) { x.save(); x.translate(4, 5); x.fillStyle = 'rgba(0,0,0,.28)'; f(true); x.restore(); f(false); };
    var r = p.r, k = p.kind;
    function circ(rr, col) { return function (s) { x.fillStyle = s ? x.fillStyle : col; x.beginPath(); x.arc(0, 0, rr, 0, 7); x.fill(); }; }
    function rect(w, h, col, rad) { return function (s) { if (!s) x.fillStyle = col; Y.ui.roundRect(x, -w / 2, -h / 2, w, h, rad || 2); x.fill(); }; }
    if (k === 'bolt' || k === 'nut') {
      sh(function (s) { if (!s) x.fillStyle = '#9aa3ad'; x.beginPath(); for (var i = 0; i < 6; i++) { var a = i / 6 * 6.283; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); } x.closePath(); x.fill(); });
      x.fillStyle = k === 'nut' ? '#2d6a52' : '#c3cad2'; x.beginPath(); x.arc(0, 0, r * 0.45, 0, 7); x.fill();
      x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = 1; x.beginPath(); x.arc(0, 0, r * 0.8, 3.6, 5); x.stroke();
    } else if (k === 'pencil') {
      sh(rect(r * 2, 7, '#f2b233', 2)); x.fillStyle = '#e8d2a6'; x.beginPath(); x.moveTo(r, -3.5); x.lineTo(r + 9, 0); x.lineTo(r, 3.5); x.fill();
      x.fillStyle = '#333'; x.beginPath(); x.moveTo(r + 6, -1.2); x.lineTo(r + 9, 0); x.lineTo(r + 6, 1.2); x.fill();
      x.fillStyle = '#e88aa0'; x.fillRect(-r - 5, -3.5, 5, 7); x.fillStyle = '#c9ccd2'; x.fillRect(-r, -3.5, 3, 7);
      x.fillStyle = 'rgba(0,0,0,.12)'; x.fillRect(-r, 1, r * 2, 2.5);
    } else if (k === 'ruler') {
      sh(rect(r * 2, 14, '#e7e3d3', 1)); x.fillStyle = '#555';
      for (var i = -r + 3; i < r - 2; i += 4) x.fillRect(i, -7, 1, (Math.round((i + r) / 4) % 5 === 0) ? 6 : 3);
    } else if (k === 'eraser') { sh(rect(r * 1.7, r, '#e8f0f6', 3)); x.fillStyle = '#3d8bff'; x.fillRect(-r * 0.85, -r / 2, r * 0.7, r); }
    else if (k === 'clip') { x.strokeStyle = '#c7ced6'; x.lineWidth = 1.6; Y.ui.roundRect(x, -r, -r * 0.35, r * 2, r * 0.7, r * 0.35); x.stroke(); Y.ui.roundRect(x, -r * 0.7, -r * 0.2, r * 1.5, r * 0.4, r * 0.2); x.stroke(); }
    else if (k === 'nail') { sh(rect(r * 2, 3, '#b8bfc6', 1)); x.fillStyle = '#d8dee4'; x.fillRect(-r - 1, -4, 3, 8); }
    else if (k === 'block') { sh(rect(r * 1.6, r * 1.1, '#c79a5f', 2)); x.strokeStyle = 'rgba(90,50,20,.35)'; x.lineWidth = 1; for (var b = -2; b <= 2; b++) { x.beginPath(); x.moveTo(-r * 0.8, b * 3); x.lineTo(r * 0.8, b * 3 + 1); x.stroke(); } }
    else if (k === 'screw') { sh(circ(r * 0.6, '#c3cad2')); x.fillStyle = '#7d858e'; x.fillRect(-r * 0.45, -1, r * 0.9, 2); x.fillRect(-1, -r * 0.45, 2, r * 0.9); }
    else if (k === 'chips') { for (var c = 0; c < 5; c++) { x.fillStyle = c % 2 ? '#f1d39c' : '#e2b979'; x.save(); x.rotate(c * 1.3); x.beginPath(); x.ellipse(c * 3 - 6, (c % 3) * 3 - 3, 6, 2.5, 0, 0, 7); x.fill(); x.restore(); } }
    else if (k === 'tape') { sh(circ(r, '#d9d2c2')); x.fillStyle = R.bg; x.beginPath(); x.arc(0, 0, r * 0.55, 0, 7); x.fill(); x.strokeStyle = 'rgba(0,0,0,.15)'; x.beginPath(); x.arc(0, 0, r * 0.8, 0, 7); x.stroke(); }
    else if (k === 'plate') { sh(circ(r, '#fbfbfb')); x.strokeStyle = 'rgba(0,0,0,.08)'; x.lineWidth = 2; x.beginPath(); x.arc(0, 0, r * 0.7, 0, 7); x.stroke(); x.strokeStyle = '#3d7dd8'; x.lineWidth = 1.2; x.beginPath(); x.arc(0, 0, r * 0.92, 0, 7); x.stroke(); }
    else if (k === 'cup') { sh(circ(r, '#ffffff')); x.fillStyle = '#7a4a26'; x.beginPath(); x.arc(0, 0, r * 0.72, 0, 7); x.fill(); x.fillStyle = '#fff'; x.fillRect(r - 1, -3, 6, 6); }
    else if (k === 'spoon') { sh(function (s) { if (!s) x.fillStyle = '#cfd6dd'; x.beginPath(); x.ellipse(-r * 0.55, 0, r * 0.38, r * 0.26, 0, 0, 7); x.fill(); x.fillRect(-r * 0.2, -1.5, r * 1.2, 3); }); }
    else if (k === 'cookie') { sh(circ(r, '#d79a54')); x.fillStyle = '#5a3418'; for (var d = 0; d < 4; d++) x.fillRect(Math.cos(d * 1.7) * r * 0.5 - 1.5, Math.sin(d * 1.7) * r * 0.5 - 1.5, 3, 3); }
    else if (k === 'pepper') { sh(circ(r, '#3a3a3a')); x.fillStyle = '#888'; x.beginPath(); x.arc(0, 0, r * 0.5, 0, 7); x.fill(); }
    else if (k === 'flower') { var cols = ['#ff7fa8', '#ffd84d', '#ffffff', '#b98cff']; x.fillStyle = cols[(p.v * 4) | 0]; for (var f = 0; f < 5; f++) { x.beginPath(); x.arc(Math.cos(f * 1.257) * r * 0.55, Math.sin(f * 1.257) * r * 0.55, r * 0.42, 0, 7); x.fill(); } x.fillStyle = '#f2a516'; x.beginPath(); x.arc(0, 0, r * 0.3, 0, 7); x.fill(); }
    else if (k === 'stone') { sh(function (s) { if (!s) x.fillStyle = '#9b9a95'; x.beginPath(); x.ellipse(0, 0, r, r * 0.75, 0, 0, 7); x.fill(); }); x.fillStyle = 'rgba(255,255,255,.18)'; x.beginPath(); x.ellipse(-r * 0.3, -r * 0.25, r * 0.4, r * 0.25, 0, 0, 7); x.fill(); }
    else if (k === 'leaf') { x.fillStyle = p.v < 0.5 ? '#e0a03a' : '#c9632b'; x.beginPath(); x.ellipse(0, 0, r, r * 0.45, 0, 0, 7); x.fill(); x.strokeStyle = 'rgba(0,0,0,.2)'; x.beginPath(); x.moveTo(-r, 0); x.lineTo(r, 0); x.stroke(); }
    else if (k === 'mushroom') { sh(circ(r, '#d8443a')); x.fillStyle = '#fff'; x.beginPath(); x.arc(-r * 0.3, -r * 0.2, 2, 0, 7); x.arc(r * 0.35, r * 0.25, 1.6, 0, 7); x.fill(); }
    else if (k === 'bush') { sh(circ(r, '#2e6e2c')); x.fillStyle = '#3a8237'; for (var u = 0; u < 5; u++) { x.beginPath(); x.arc(Math.cos(u * 1.3) * r * 0.45, Math.sin(u * 1.3) * r * 0.45, r * 0.5, 0, 7); x.fill(); } }
    x.restore();
  }
  function pattern(x, poly, s, room) {
    Y.ui.poly(x, poly);
    if (s === L.SAND) {
      x.fillStyle = P.sand[room]; x.fill();
      x.save(); x.clip(); var bb = bbox(poly), rnd = Y.ui.mulberry32(Math.round(bb[0] * 7 + bb[1]));
      for (var i = 0; i < (bb[2] - bb[0]) * (bb[3] - bb[1]) / 18; i++) { x.fillStyle = rnd() < 0.5 ? 'rgba(120,80,30,.22)' : 'rgba(255,255,255,.3)'; x.fillRect(bb[0] + rnd() * (bb[2] - bb[0]), bb[1] + rnd() * (bb[3] - bb[1]), 2, 2); }
      x.restore();
    } else if (s === L.ICE) {
      x.fillStyle = SCOL[s]; x.fill(); x.save(); x.clip(); bb = bbox(poly);
      x.strokeStyle = 'rgba(255,255,255,.75)'; x.lineWidth = 1.5;
      for (var k = bb[0] - 200; k < bb[2]; k += 22) { x.beginPath(); x.moveTo(k, bb[1]); x.lineTo(k + 60, bb[3]); x.stroke(); }
      x.restore(); x.strokeStyle = 'rgba(140,200,230,.9)'; x.lineWidth = 2; Y.ui.poly(x, poly); x.stroke();
    } else if (s === L.WATER) {
      x.fillStyle = SCOL[s]; x.fill(); x.strokeStyle = 'rgba(200,235,255,.8)'; x.lineWidth = 2; x.stroke();
      bb = bbox(poly); x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 1.5;
      x.beginPath(); x.ellipse((bb[0] + bb[2]) / 2 - 6, (bb[1] + bb[3]) / 2 - 4, (bb[2] - bb[0]) * 0.22, (bb[3] - bb[1]) * 0.12, 0, 3.6, 5.6); x.stroke();
    } else if (s === L.OIL) {
      x.fillStyle = SCOL[s]; x.fill();
      bb = bbox(poly); var g2 = x.createRadialGradient((bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2, 2, (bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2, Math.max(bb[2] - bb[0], bb[3] - bb[1]) / 2);
      g2.addColorStop(0, 'rgba(120,60,200,.0)'); g2.addColorStop(0.6, 'rgba(90,160,220,.25)'); g2.addColorStop(0.85, 'rgba(230,200,80,.25)'); g2.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g2; Y.ui.poly(x, poly); x.fill();
    }
  }
  function bbox(p) { var a = [1e9, 1e9, -1e9, -1e9]; p.forEach(function (q) { a[0] = Math.min(a[0], q[0]); a[1] = Math.min(a[1], q[1]); a[2] = Math.max(a[2], q[0]); a[3] = Math.max(a[3], q[1]); }); return a; }

  var cache = {};
  function bake(T) {
    if (cache[T.id]) return cache[T.id];
    var cv = document.createElement('canvas'); cv.width = T.W; cv.height = T.H;
    var x = cv.getContext('2d'), R = ROOM[T.room], hw = T.hw;
    bakeBg(x, T, R);
    x.lineJoin = 'round'; x.lineCap = 'round';
    // тень дороги, бортик-«зебра», полотно
    x.save(); x.translate(3, 5); Y.ui.centerPath(x, T); x.strokeStyle = R.shade; x.lineWidth = hw * 2 + 14; x.stroke(); x.restore();
    Y.ui.centerPath(x, T); x.strokeStyle = R.edge; x.lineWidth = hw * 2 + 10; x.stroke();
    x.setLineDash([16, 16]); x.strokeStyle = R.curb; x.stroke(); x.setLineDash([]);
    Y.ui.centerPath(x, T); x.strokeStyle = R.road; x.lineWidth = hw * 2; x.stroke();
    // фактура полотна
    x.save(); Y.ui.centerPath(x, T); x.strokeStyle = R.road2; x.lineWidth = hw * 2 - 18; x.setLineDash([2, 9]); x.stroke(); x.restore();
    if (T.room === 'kitchen') { x.save(); Y.ui.centerPath(x, T); x.lineWidth = hw * 2; x.strokeStyle = 'rgba(255,255,255,.35)'; x.setLineDash([1.5, 22]); x.stroke(); x.restore(); }
    // осевая разметка
    x.save(); Y.ui.centerPath(x, T); x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = 2; x.setLineDash([14, 18]); x.stroke(); x.restore();
    // покрытия
    T.patches.forEach(function (Pp) {
      if (Pp.jump) return;
      pattern(x, Y.ui.patchPoly(T, Pp), Pp.s, T.room);
    });
    // трамплины: жёлто-чёрная полоса и «тень» за ней
    T.patches.forEach(function (Pp) {
      if (!Pp.jump) return;
      var pl = Y.ui.band(T, Pp.a + 14, Pp.a + 26, -hw, hw); Y.ui.poly(x, pl); x.fillStyle = 'rgba(0,0,0,.28)'; x.fill();
      pl = Y.ui.band(T, Pp.a, Pp.a + 14, -hw, hw); Y.ui.poly(x, pl); x.fillStyle = '#ffc23d'; x.fill();
      x.save(); Y.ui.poly(x, pl); x.clip(); x.strokeStyle = '#1b1b1b'; x.lineWidth = 5;
      for (var l = -hw; l < hw; l += 14) { var a1 = Y.ui.pt(T, Pp.a, l), b1 = Y.ui.pt(T, Pp.a + 14, l + 7); x.beginPath(); x.moveTo(a1[0], a1[1]); x.lineTo(b1[0], b1[1]); x.stroke(); }
      x.restore();
      x.strokeStyle = '#fff3c7'; x.lineWidth = 2; var e0 = Y.ui.pt(T, Pp.a + 14, -hw), e1 = Y.ui.pt(T, Pp.a + 14, hw); x.beginPath(); x.moveTo(e0[0], e0[1]); x.lineTo(e1[0], e1[1]); x.stroke();
    });
    // старт/финиш — шашечки
    var sq = 8;
    for (var row = 0; row < 2; row++) for (var l = -hw, j = 0; l < hw; l += sq, j++) {
      var p0 = Y.ui.pt(T, row * sq, l), p1 = Y.ui.pt(T, row * sq, l + sq), p2 = Y.ui.pt(T, row * sq + sq, l + sq), p3 = Y.ui.pt(T, row * sq + sq, l);
      x.fillStyle = (j + row) % 2 ? '#111' : '#fff'; Y.ui.poly(x, [p0, p1, p2, p3]); x.fill();
    }
    // реквизит комнаты
    Y.ui.props(T).forEach(function (p) { prop(x, p, R, T.room); });
    cache[T.id] = cv; return cv;
  }

  function car(ctx, c, t, labels) {
    var z = c.z || 0, s = 1 + z * 0.35;
    ctx.save(); ctx.translate(c.x + 2 + z * 10, c.y + 3 + z * 14); ctx.rotate(c.a);
    ctx.fillStyle = 'rgba(0,0,0,' + (0.32 - z * 0.12) + ')'; Y.ui.roundRect(ctx, -9, -5.5, 18, 11, 4); ctx.fill(); ctx.restore();
    ctx.save(); ctx.translate(c.x, c.y - z * 4); ctx.rotate(c.a); ctx.scale(s, s);
    if (c.boost > 0) { var fl = 6 + Math.sin(t * 60) * 2; ctx.fillStyle = '#ffb02e'; ctx.beginPath(); ctx.moveTo(-9, -3); ctx.lineTo(-9 - fl, 0); ctx.lineTo(-9, 3); ctx.fill(); ctx.fillStyle = '#fff4c2'; ctx.beginPath(); ctx.moveTo(-9, -1.5); ctx.lineTo(-9 - fl * 0.5, 0); ctx.lineTo(-9, 1.5); ctx.fill(); }
    ctx.fillStyle = '#1a1d24'; ctx.fillRect(-7, -6.5, 4.5, 2.2); ctx.fillRect(3, -6.5, 4.5, 2.2); ctx.fillRect(-7, 4.3, 4.5, 2.2); ctx.fillRect(3, 4.3, 4.5, 2.2);
    ctx.fillStyle = c.color; Y.ui.roundRect(ctx, -9, -5, 18, 10, 3.5); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.28)'; Y.ui.roundRect(ctx, -8, -4.4, 16, 3, 1.5); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.25)'; Y.ui.roundRect(ctx, -4.5, -3.8, 8, 7.6, 2.5); ctx.fill();
    ctx.fillStyle = '#bfe4ff'; Y.ui.roundRect(ctx, 2, -3.4, 3, 6.8, 1.2); ctx.fill();
    ctx.fillStyle = '#ffe9a8'; ctx.fillRect(7.5, -4, 1.5, 2); ctx.fillRect(7.5, 2, 1.5, 2);
    if (c.human) { ctx.fillStyle = '#fff'; ctx.font = '900 6px Inter, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.save(); ctx.rotate(Math.PI / 2); ctx.fillText(c.pi ? '2' : '1', 0, 1.5); ctx.restore(); }
    ctx.restore();
    if (c.shield > 0) {
      var a = c.shield < 1.5 ? (Math.floor(t * 10) % 2 ? 0.25 : 0.7) : 0.7;
      ctx.strokeStyle = 'rgba(110,200,255,' + a + ')'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(c.x, c.y - z * 4, 13 * s, 0, 7); ctx.stroke();
      ctx.fillStyle = 'rgba(110,200,255,' + a * 0.18 + ')'; ctx.fill();
    }
    if (labels && c.human) {   // ярлык игрока в режиме 2 игроков
      var ly = c.y - 19 - z * 6; ctx.fillStyle = c.color; Y.ui.roundRect(ctx, c.x - 9, ly - 6, 18, 11, 4); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = '900 8px Inter, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(labels[c.pi], c.x, ly); ctx.textBaseline = 'alphabetic';
    }
  }
  function item(ctx, it, t) {
    if (it.t > 0) { ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.setLineDash([3, 3]); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(it.x, it.y, 8, 0, 7); ctx.stroke(); ctx.setLineDash([]); return; }
    var b = Math.sin(t * 5 + it.x) * 1.5, r = 9 + b * 0.4;
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(it.x + 2, it.y + 4, r, r * 0.6, 0, 0, 7); ctx.fill();
    ctx.save(); ctx.translate(it.x, it.y - 2 + b * 0.5);
    if (it.k === 'boost') {
      ctx.fillStyle = '#ff8a3d'; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.2; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(-5, -4); ctx.lineTo(-1, 0); ctx.lineTo(-5, 4); ctx.moveTo(0, -4); ctx.lineTo(4, 0); ctx.lineTo(0, 4); ctx.stroke();
    } else {
      ctx.fillStyle = '#3db5ff'; ctx.beginPath(); for (var i = 0; i < 6; i++) { var a = i / 6 * 6.283 + 0.52; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(4.5, -3); ctx.lineTo(4, 1.5); ctx.lineTo(0, 5); ctx.lineTo(-4, 1.5); ctx.lineTo(-4.5, -3); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  function skid(lx, p, c) {
    lx.strokeStyle = 'rgba(25,25,30,.16)'; lx.lineWidth = 2.2; lx.lineCap = 'round';
    for (var sd = -1; sd <= 1; sd += 2) {
      var ox = -Math.sin(c.a) * 4 * sd - Math.cos(c.a) * 6, oy = Math.cos(c.a) * 4 * sd - Math.sin(c.a) * 6;
      var px = -Math.sin(p.a) * 4 * sd - Math.cos(p.a) * 6, py = Math.cos(p.a) * 4 * sd - Math.sin(p.a) * 6;
      lx.beginPath(); lx.moveTo(p.x + px, p.y + py); lx.lineTo(c.x + ox, c.y + oy); lx.stroke();
    }
  }
  function badge(ctx, x, y, k, t) {
    ctx.save(); ctx.globalAlpha = t < 1 && Math.floor(t * 10) % 2 ? 0.4 : 1;
    item(ctx, { x: x, y: y + 2, k: k, t: 0 }, 0); ctx.restore();
  }
  Y.modern = { name: 'modern', P: P, ROOM: ROOM, bake: bake, car: car, item: item, skid: skid, badge: badge };
})(typeof window !== 'undefined' ? window : globalThis);
