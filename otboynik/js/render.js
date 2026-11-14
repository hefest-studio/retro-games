/* ОТБОЙНИК · рендер обеих тем на canvas. OTBOYNIK.render.draw(g, ctx, S, opts), палитры PM (modern) / PR (retro).
   modern — светлый кленовый стол мастерской в раме из ореха: медные направляющие, стальной шар, заводные жестяные
   механизмы с ключами, латунные постройки. retro — тот же мир в буфере 240×380 и ×2 без сглаживания, плоская палитра
   из 16 цветов, сканлайны. Тема меняет только отрисовку. */
(function (global) {
  'use strict';
  var OB = global.OTBOYNIK = global.OTBOYNIK || {};
  var PM = { retro: false, bg: '#24180f', frame: '#3a2618', frameHi: '#5a3c25', field: '#ecd5aa', field2: '#d8b682', seam: 'rgba(120,78,36,.20)',
    grain: 'rgba(150,100,50,.10)', rail: '#b4632c', railHi: '#f0a868', lane: '#cfa772', ink: '#2a1a0e', inkL: '#fbf1de', muted: '#c9b08a',
    accent: '#2f9e8a', accent2: '#e0a33a', good: '#3fae5c', bad: '#d8452e', warn: '#e7a321', chalk: 'rgba(60,40,20,.35)',
    oak: '#8a5a2b', oakHi: '#b07a40', copper: '#c77a3c', steel: '#a8b2ba', steelD: '#4b545c', brick: '#9a3f2a', coal: '#ff8a2a',
    tin: '#2f8f7a', tinHi: '#6cc6b0', brass: '#d8a636', brassD: '#8f6a18', wood: '#a0522d', woodD: '#5c2e17', iron: '#4b4f57', ironHi: '#7c828c',
    wing: 'rgba(120,190,230,.55)', red: '#c8302a', door: '#7a4a24', doorD: '#4a2a12', band: '#3a3a40', panel: 'rgba(36,24,15,.94)', panelLine: '#e0a33a' };
  var PR = { retro: true, bg: '#000000', frame: '#552200', frameHi: '#aa5500', field: '#aa7744', field2: '#aa7744', seam: '#885522',
    grain: null, rail: '#ff8844', railHi: '#ffcc88', lane: '#885522', ink: '#000000', inkL: '#ffffff', muted: '#ccaa77',
    accent: '#55ffcc', accent2: '#ffff55', good: '#55ff55', bad: '#ff5555', warn: '#ffff55', chalk: '#553311',
    oak: '#774411', oakHi: '#cc8833', copper: '#ff8844', steel: '#dddddd', steelD: '#777777', brick: '#aa2200', coal: '#ffaa00',
    tin: '#00aa88', tinHi: '#55ffcc', brass: '#ffcc33', brassD: '#aa7700', wood: '#aa3300', woodD: '#551100', iron: '#555566', ironHi: '#9999aa',
    wing: '#88ccff', red: '#ff3333', door: '#884411', doorD: '#442200', band: '#333333', panel: '#000000', panelLine: '#ffff55' };

  var L = function () { return OB.logic; };
  function mk(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function circle(ctx, x, y, r, col) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
  function ring(ctx, x, y, r, col, w) { ctx.strokeStyle = col; ctx.lineWidth = w || 2; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke(); }
  function line(ctx, ax, ay, bx, by, col, w) { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); }
  function rr(ctx, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  // ---------- статичный стол (кэш по теме) ----------
  var tableCache = {};
  function fieldPath(ctx) {
    var A = L().ARC; ctx.beginPath(); ctx.moveTo(20, 560);
    ctx.lineTo(20, A.cy); ctx.ellipse(A.cx, A.cy, A.rx, A.ry, 0, Math.PI, Math.PI * 2); ctx.lineTo(470, 742); ctx.lineTo(440, 742);
    ctx.lineTo(440, 560); ctx.lineTo(330, 650); ctx.lineTo(330, 760); ctx.lineTo(150, 760); ctx.lineTo(150, 650); ctx.closePath();
  }
  function table(P) {
    var key = P.retro ? 'r' : 'm'; if (tableCache[key]) return tableCache[key];
    var W = L().W, H = L().H, c = mk(W, H), x = c.getContext('2d'), i;
    // рама
    x.fillStyle = P.frame; x.fillRect(0, 0, W, H);
    if (!P.retro) { for (i = 0; i < 40; i++) { x.strokeStyle = 'rgba(0,0,0,.12)'; x.lineWidth = 1; x.beginPath(); var yy = i * 19 + 5; x.moveTo(0, yy); x.bezierCurveTo(120, yy + 6, 300, yy - 6, W, yy + 3); x.stroke(); } }
    // поле
    x.save(); fieldPath(x); x.clip();
    if (P.retro) { x.fillStyle = P.field; x.fillRect(0, 0, W, H); }
    else { var gr = x.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, P.field); gr.addColorStop(1, P.field2); x.fillStyle = gr; x.fillRect(0, 0, W, H); }
    for (i = 1; i < 10; i++) { x.fillStyle = P.seam; x.fillRect(20 + i * 46, 0, P.retro ? 2 : 1.5, H); }
    if (P.grain) for (i = 0; i < 90; i++) { var gx = 22 + (i * 53 % 420), gy = (i * 97) % 700 + 40; x.strokeStyle = P.grain; x.lineWidth = 1; x.beginPath(); x.moveTo(gx, gy); x.quadraticCurveTo(gx + 6, gy + 30, gx, gy + 60); x.stroke(); }
    // дорожка пуска
    x.fillStyle = P.lane; x.fillRect(440, 230, 30, 520);
    // меловые метки мест для построек
    L().SLOTS.forEach(function (s, k) {
      x.setLineDash(P.retro ? [] : [4, 5]); ring(x, s.x, s.y, 24, P.chalk, P.retro ? 2 : 1.5); x.setLineDash([]);
      x.fillStyle = P.chalk; x.font = '700 11px ' + (P.retro ? '"Courier New", monospace' : 'Inter, system-ui, sans-serif'); x.textAlign = 'center'; x.fillText(String(k + 1), s.x, s.y + 4);
    });
    // разметка прохода к воротам
    x.fillStyle = P.chalk; for (i = 0; i < 6; i++) x.fillRect(238, 470 + i * 22, 4, 10);
    x.restore();
    // ворота мастерской
    var G = L().GATE, gx0 = G.x - G.w / 2;
    x.fillStyle = P.doorD; x.fillRect(gx0 - 6, 716, G.w + 12, 44);
    x.fillStyle = P.door; x.fillRect(gx0, 722, G.w / 2 - 2, 38); x.fillRect(G.x + 2, 722, G.w / 2 - 2, 38);
    for (i = 0; i < 2; i++) { x.fillStyle = P.band; x.fillRect(gx0, 730 + i * 16, G.w, 4); }
    circle(x, G.x - 8, 744, 3, P.brass); circle(x, G.x + 8, 744, 3, P.brass);
    // направляющие (медь)
    L().WALLS.forEach(function (s) {
      if (s.k === 'gate') { line(x, s.a[0], s.a[1], s.b[0], s.b[1], P.steelD, 4); return; }
      line(x, s.a[0], s.a[1], s.b[0], s.b[1], P.rail, P.retro ? 6 : 6);
      if (!P.retro) line(x, s.a[0], s.a[1], s.b[0], s.b[1], P.railHi, 1.6);
    });
    // латунные винты по раме
    [[10, 10], [470, 10], [10, 750], [470, 750], [10, 380], [476, 380]].forEach(function (p) { circle(x, p[0], p[1], 4, P.brass); if (!P.retro) line(x, p[0] - 2, p[1], p[0] + 2, p[1], P.brassD, 1); });
    tableCache[key] = c; return c;
  }

  // ---------- объекты ----------
  function drawBall(ctx, b, P) {
    if (b.fire > 0) {
      for (var i = 0; i < b.trail.length; i++) { var q = b.trail[i]; ctx.globalAlpha = (i + 1) / b.trail.length * 0.5; circle(ctx, q[0], q[1], 5 + i * 0.6, P.coal); }
      ctx.globalAlpha = 1; if (!P.retro) circle(ctx, b.x, b.y, 13, 'rgba(255,140,40,.35)');
    }
    if (P.retro) { circle(ctx, b.x, b.y, 8, b.fire > 0 ? P.coal : P.steel); circle(ctx, b.x - 3, b.y - 3, 2.5, '#ffffff'); return; }
    var g = ctx.createRadialGradient(b.x - 3, b.y - 3, 1, b.x, b.y, 8);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.4, b.fire > 0 ? '#ffd08a' : '#c9d1d8'); g.addColorStop(1, b.fire > 0 ? '#b8451a' : '#454d55');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, b.y, 8, 0, Math.PI * 2); ctx.fill();
  }
  function drawFlipper(ctx, f, P, lock) {
    var t = L().flipTip(f);
    line(ctx, f.x, f.y, t[0], t[1], P.retro ? P.oak : '#5a3a1a', 16);
    line(ctx, f.x, f.y, t[0], t[1], lock ? P.bad : P.oak, 12);
    if (!P.retro) line(ctx, f.x + (t[0] - f.x) * 0.1, f.y + (t[1] - f.y) * 0.1 - 2, t[0], t[1] - 2, P.oakHi, 2);
    circle(ctx, f.x, f.y, 8, P.copper); circle(ctx, f.x, f.y, 3, P.brassD);
  }
  function legs(ctx, e, P, n, len) {
    var ph = Math.sin(e.t * 14) * 3;
    for (var i = 0; i < n; i++) { var yy = e.y - e.r * 0.5 + i * e.r / (n - 1 || 1); var o = (i % 2 ? ph : -ph); line(ctx, e.x - e.r * 0.7, yy, e.x - e.r - len, yy + o, P.ink, 2); line(ctx, e.x + e.r * 0.7, yy, e.x + e.r + len, yy - o, P.ink, 2); }
  }
  function gear(ctx, x, y, r, teeth, ang, col, hi) {
    ctx.fillStyle = col; ctx.beginPath();
    for (var i = 0; i < teeth * 2; i++) { var a = ang + i * Math.PI / teeth, rr2 = i % 2 ? r : r * 0.8; ctx.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); }
    ctx.closePath(); ctx.fill(); circle(ctx, x, y, r * 0.35, hi);
  }
  function drawEnemy(ctx, e, P, t) {
    var fl = e.flash > 0;
    if (e.type === 'beetle') {
      legs(ctx, e, P, 3, 4);
      ctx.fillStyle = fl ? '#ffffff' : P.tin; ctx.beginPath(); ctx.ellipse(e.x, e.y, e.r * 0.85, e.r, 0, 0, Math.PI * 2); ctx.fill();
      line(ctx, e.x, e.y - e.r + 2, e.x, e.y + e.r - 2, P.ink, 1.5);
      circle(ctx, e.x - 4, e.y - 3, 2, P.tinHi); circle(ctx, e.x + 4, e.y + 3, 2, P.tinHi);
      // заводной ключ сверху (крутится)
      var kw = Math.abs(Math.cos(t * 6 + e.id)) * 6 + 1; line(ctx, e.x, e.y - e.r, e.x, e.y - e.r - 6, P.brassD, 2);
      ctx.fillStyle = P.brass; ctx.fillRect(e.x - kw, e.y - e.r - 10, kw * 2, 5);
    } else if (e.type === 'cart') {
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (q) { circle(ctx, e.x + q[0] * e.r * 0.85, e.y + q[1] * e.r * 0.6, 4.5, P.ink); circle(ctx, e.x + q[0] * e.r * 0.85, e.y + q[1] * e.r * 0.6, 1.6, P.steel); });
      ctx.fillStyle = fl ? '#ffffff' : P.wood; ctx.fillRect(e.x - e.r * 0.75, e.y - e.r, e.r * 1.5, e.r * 2);
      ctx.fillStyle = P.woodD; ctx.fillRect(e.x - e.r * 0.75, e.y - 2, e.r * 1.5, 3); ctx.fillRect(e.x - 1.5, e.y - e.r, 3, e.r * 2);
      ctx.fillStyle = P.brass; ctx.fillRect(e.x - e.r * 0.75, e.y + e.r - 3, e.r * 1.5, 3);
    } else if (e.type === 'fly') {
      ctx.fillStyle = P.wing; var fa = Math.sin(t * 30 + e.id) * 0.5 + 0.6;
      ctx.beginPath(); ctx.ellipse(e.x - 9, e.y - 3, 9, 4 * fa, -0.3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(e.x + 9, e.y - 3, 9, 4 * fa, 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(e.x - 8, e.y + 4, 7, 3 * fa, 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(e.x + 8, e.y + 4, 7, 3 * fa, -0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = fl ? '#ffffff' : P.copper; ctx.fillRect(e.x - 2.5, e.y - 9, 5, 20); circle(ctx, e.x, e.y - 9, 4, P.copper);
      circle(ctx, e.x, e.y - 10, 1.5, P.ink);
    } else if (e.type === 'ram') {
      gear(ctx, e.x, e.y, e.r, 10, t * 2 + e.id, fl ? '#ffffff' : P.iron, P.ironHi);
      ctx.fillStyle = P.steelD; ctx.beginPath(); ctx.moveTo(e.x - 7, e.y + e.r - 2); ctx.lineTo(e.x, e.y + e.r + 9); ctx.lineTo(e.x + 7, e.y + e.r - 2); ctx.closePath(); ctx.fill();
      circle(ctx, e.x, e.y, 3, P.brass);
    }
    if (e.hpMax > 1) for (var i = 0; i < e.hpMax; i++) ctx.fillStyle = i < e.hp ? P.good : P.ink, ctx.fillRect(e.x - e.hpMax * 3 + i * 6, e.y - e.r - 15, 4, 3);
    if (e.burn > 0) { ctx.globalAlpha = 0.6 + Math.sin(t * 20) * 0.3; circle(ctx, e.x + Math.sin(t * 9) * 3, e.y - e.r * 0.6, 4, P.coal); ctx.globalAlpha = 1; }
    if (e.stun > 0) for (var k = 0; k < 3; k++) { var a = t * 5 + k * 2.1; circle(ctx, e.x + Math.cos(a) * (e.r + 3), e.y - e.r + Math.sin(a) * 4, 2, P.accent2); }
  }
  function drawBoss(ctx, B, P, t) {
    var x = B.x, y = B.y, fl = B.flash > 0;
    gear(ctx, x - 44, y + 10, 18, 9, t * 1.5, P.iron, P.ironHi); gear(ctx, x + 44, y + 10, 18, 9, -t * 1.5, P.iron, P.ironHi);
    ctx.fillStyle = fl ? '#ffffff' : P.wood; ctx.fillRect(x - 36, y - 30, 72, 58);
    ctx.fillStyle = P.woodD; ctx.fillRect(x - 36, y - 30, 72, 5); ctx.fillRect(x - 36, y + 23, 72, 5); ctx.fillRect(x - 4, y - 30, 8, 58);
    var pump = Math.abs(Math.sin(t * 3)) * 14;
    ctx.fillStyle = P.steel; ctx.fillRect(x - 6, y - 52 + pump, 12, 26);
    ctx.fillStyle = P.brass; ctx.fillRect(x - 16, y + 26 + pump * 0.5, 32, 12);
    circle(ctx, x - 20, y - 6, 4, P.coal); circle(ctx, x + 20, y - 6, 4, P.coal);
    var w = 120; ctx.fillStyle = P.ink; ctx.fillRect(x - w / 2, y - 66, w, 6); ctx.fillStyle = P.bad; ctx.fillRect(x - w / 2, y - 66, w * Math.max(0, B.hp) / B.hpMax, 6);
    if (B.stun > 0) for (var k = 0; k < 4; k++) { var a = t * 4 + k * 1.6; circle(ctx, x + Math.cos(a) * 46, y - 36 + Math.sin(a) * 6, 2.5, P.accent2); }
  }
  function pips(ctx, x, y, lvl, P) { for (var i = 0; i < lvl; i++) circle(ctx, x - (lvl - 1) * 4 + i * 8, y, 2.6, P.accent2); }
  function drawBuilding(ctx, B, P, t, ghost) {
    var fl = B.flash > 0, x = B.x, y = B.y, r = B.r || 20;
    if (ghost) ctx.globalAlpha = 0.55;
    if (B.type === 'forge') {
      circle(ctx, x, y, r + 2, P.doorD); circle(ctx, x, y, r, P.brick);
      for (var i = 0; i < 8; i++) { var a = i * Math.PI / 4; line(ctx, x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62, x + Math.cos(a) * r, y + Math.sin(a) * r, P.doorD, 1.5); }
      circle(ctx, x, y, r * 0.6, fl ? '#fff2c0' : P.coal); circle(ctx, x, y, r * 0.3, fl ? '#ffffff' : '#ffd36a');
    } else if (B.type === 'bell') {
      ctx.fillStyle = P.woodD; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.fillStyle = P.wood; ctx.fillRect(x - r + 3, y - r + 3, r * 2 - 6, r * 2 - 6);
      var sw = B.ring > 0 ? Math.sin(t * 40) * 2 : 0;
      circle(ctx, x + sw, y, r * 0.62, fl ? '#fff2c0' : P.brass); circle(ctx, x + sw, y, r * 0.25, P.brassD);
      if (B.ring > 0) { ctx.globalAlpha = B.ring; ring(ctx, x, y, 80 + 30 * B.lvl - B.ring * 60, P.accent2, 2); ctx.globalAlpha = ghost ? 0.55 : 1; }
    } else if (B.type === 'spring') {
      var ax = B.a[0], ay = B.a[1], bx = B.b[0], by = B.b[1], dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy), nx = -dy / len, ny = dx / len, n = 10;
      ctx.strokeStyle = fl ? '#ffffff' : P.steel; ctx.lineWidth = 3; ctx.beginPath();
      for (var k = 0; k <= n; k++) { var s = k / n, o = (k % 2 ? 6 : -6) * (k && k < n ? 1 : 0); ctx.lineTo(ax + dx * s + nx * o, ay + dy * s + ny * o); }
      ctx.stroke();
      circle(ctx, ax, ay, 6, P.oak); circle(ctx, bx, by, 6, P.oak); circle(ctx, ax, ay, 2, P.brass); circle(ctx, bx, by, 2, P.brass);
    } else if (B.type === 'magnet') {
      var R2 = 100 + 15 * B.lvl;
      if (!P.retro) { ctx.globalAlpha = (ghost ? 0.3 : 0.5) * (0.5 + 0.5 * Math.sin(t * 3)); ring(ctx, x, y, R2 * 0.5, P.red, 1); ring(ctx, x, y, R2, P.red, 1); ctx.globalAlpha = ghost ? 0.55 : 1; }
      ctx.strokeStyle = fl ? '#ffffff' : P.red; ctx.lineWidth = 7; ctx.lineCap = 'butt'; ctx.beginPath(); ctx.arc(x, y - 2, 10, Math.PI * 0.05, Math.PI * 0.95, true); ctx.stroke();
      ctx.fillStyle = P.steel; ctx.fillRect(x - 13.5, y - 3, 7, 7); ctx.fillRect(x + 6.5, y - 3, 7, 7);
    } else if (B.type === 'splitter') {
      gear(ctx, x, y, r, 12, t * (B.split > 0 ? 0.5 : 3), fl ? '#fff2c0' : P.brass, P.brassD);
      for (var j = 0; j < 3; j++) { var aa = t * 3 + j * 2.094; circle(ctx, x + Math.cos(aa) * r * 0.5, y + Math.sin(aa) * r * 0.5, 2.5, P.steel); }
    }
    ctx.globalAlpha = 1;
    if (!ghost) pips(ctx, x, B.seg ? y + 14 : y + r + 7, B.lvl, P);
  }

  // ---------- текст ----------
  function font(P, size, weight) { return (weight || 800) + ' ' + size + 'px ' + (P.retro ? '"Courier New", ui-monospace, monospace' : 'Inter, system-ui, sans-serif'); }
  function txt(ctx, s, x, y, o, P) {
    o = o || {}; ctx.font = font(P, o.size || 14, o.weight); ctx.textAlign = o.align || 'left'; ctx.textBaseline = 'alphabetic';
    if (o.shadow !== false) { ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillText(s, x + 1, y + 1.5); }
    ctx.fillStyle = o.color || P.inkL; ctx.fillText(s, x, y);
  }
  function wrap(ctx, s, maxW) { var words = String(s).split(' '), out = [], cur = ''; words.forEach(function (w) { var t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW && cur) { out.push(cur); cur = w; } else cur = t; }); if (cur) out.push(cur); return out; }
  function panel(ctx, x, y, w, h, P, edge) {
    ctx.fillStyle = P.panel; if (P.retro) ctx.fillRect(x, y, w, h); else { rr(ctx, x, y, w, h, 10); ctx.fill(); }
    ctx.strokeStyle = edge || P.panelLine; ctx.lineWidth = 2; if (P.retro) ctx.strokeRect(x + 1, y + 1, w - 2, h - 2); else { rr(ctx, x, y, w, h, 10); ctx.stroke(); }
  }

  // ---------- мир ----------
  var buf = null;
  function world(ctx, S, P, t) {
    ctx.drawImage(table(P), 0, 0);
    S.buildings.forEach(function (B) { drawBuilding(ctx, B, P, t); });
    S.enemies.forEach(function (e) { drawEnemy(ctx, e, P, t); });
    if (S.boss && !S.boss.dead) drawBoss(ctx, S.boss, P, t);
    drawFlipper(ctx, S.flip.L, P, S.tiltLock > 0); drawFlipper(ctx, S.flip.R, P, S.tiltLock > 0);
    S.balls.forEach(function (b) { drawBall(ctx, b, P); });
    // повреждения ворот
    var dmg = 1 - S.hp / S.hpMax; if (dmg > 0.3) { line(ctx, 210, 724, 222, 750, P.doorD, 2); } if (dmg > 0.6) { line(ctx, 262, 726, 250, 756, P.doorD, 2); line(ctx, 280, 724, 270, 740, P.doorD, 2); }
  }
  function draw(g, ctx, S, P, o) {
    o = o || {}; var W = L().W, H = L().H, t = g.time;
    ctx.save();
    if (o.shake) ctx.translate((Math.random() - 0.5) * o.shake, (Math.random() - 0.5) * o.shake);
    if (P.retro) {
      if (!buf) buf = mk(W / 2, H / 2);
      var b = buf.getContext('2d'); b.setTransform(0.5, 0, 0, 0.5, 0, 0); b.imageSmoothingEnabled = false; world(b, S, P, t);
      ctx.imageSmoothingEnabled = false; ctx.drawImage(buf, 0, 0, W, H);
    } else world(ctx, S, P, t);
    ctx.restore();
    if (o.bare) return;
    hud(g, ctx, S, P);
    (o.toasts || []).forEach(function (q) { ctx.globalAlpha = Math.min(1, q.t * 2); txt(ctx, q.text, q.x, q.y - (1.2 - q.t) * 24, { size: q.big ? 18 : 13, align: 'center', color: q.color }, P); ctx.globalAlpha = 1; });
    if (S.phase === 'wave' && S.banner > 0) banner(g, ctx, S, P);
    if (S.phase === 'wave' && g._sceneName === 'play' && S.balls.some(function (b2) { return b2.x > 440 && b2.y > 700; }) && S.banner <= 0 && Math.floor(t * 2) % 2 === 0)
      txt(ctx, g.t('launchHint'), 240, 600, { size: 13, align: 'center', color: P.inkL }, P);
    if (S.phase === 'cards') cards(g, ctx, S, P);
    if (S.phase === 'slot') slots(g, ctx, S, P, t);
    if (P.retro) { ctx.fillStyle = 'rgba(0,0,0,.18)'; for (var y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1); }
  }
  function hud(g, ctx, S, P) {
    var wv = S.wave > L().WAVES ? g.t('boss') : g.t('waveShort') + ' ' + Math.min(S.wave, L().WAVES) + '/' + L().WAVES;
    txt(ctx, wv, 16, 26, { size: 15, color: P.inkL }, P);
    txt(ctx, String(S.score), 464, 26, { size: 15, align: 'right', color: P.accent2 }, P);
    txt(ctx, g.t('score'), 464, 42, { size: 10, align: 'right', color: P.muted, weight: 600, shadow: false }, P);
    // прочность ворот — слева внизу
    var x = 24, y = 706, w = 112;
    txt(ctx, g.t('gate') + ' ' + Math.max(0, Math.ceil(S.hp)) + '/' + S.hpMax, x, y - 6, { size: 12, color: P.inkL }, P);
    ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(x, y, w, 9);
    var f = Math.max(0, S.hp) / S.hpMax; ctx.fillStyle = f > 0.5 ? P.good : f > 0.25 ? P.warn : P.bad; ctx.fillRect(x + 1, y + 1, (w - 2) * f, 7);
    // встряска — справа внизу
    var tx = 346, ty = 706;
    txt(ctx, S.tiltLock > 0 ? 'TILT' : g.t('tilt'), tx, ty - 6, { size: 11, color: S.tiltLock > 0 ? P.bad : P.muted, weight: 700 }, P);
    for (var i = 0; i < 3; i++) { ctx.fillStyle = S.tiltLock > 0 ? P.bad : i < Math.ceil(S.tiltMeter - 0.05) ? P.warn : 'rgba(0,0,0,.45)'; ctx.fillRect(tx + i * 28, ty, 24, 8); }
  }
  function banner(g, ctx, S, P) {
    var a = Math.min(1, S.banner * 1.5), boss = S.wave > L().WAVES; ctx.globalAlpha = a;
    panel(ctx, 70, 300, 340, 90, P, boss ? P.bad : P.accent);
    txt(ctx, boss ? g.t('bossWave') : g.t('wave') + ' ' + S.wave, 240, 344, { size: 28, align: 'center', color: boss ? P.bad : P.accent2 }, P);
    txt(ctx, boss ? g.t('bossSub') : g.t('e_beetle') + ' · ' + g.t('e_cart') + (S.wave >= 3 ? ' · ' + g.t('e_fly') : '') + (S.wave >= 4 ? ' · ' + g.t('e_ram') : ''), 240, 370, { size: 11, align: 'center', color: P.muted, weight: 600, shadow: false }, P);
    ctx.globalAlpha = 1;
  }
  var CARD = { w: 142, h: 214, y: 250, gap: 10 };
  function cardRect(i, n) { var tot = n * CARD.w + (n - 1) * CARD.gap, x0 = (480 - tot) / 2; return { x: x0 + i * (CARD.w + CARD.gap), y: CARD.y, w: CARD.w, h: CARD.h }; }
  function cards(g, ctx, S, P) {
    ctx.fillStyle = P.retro ? 'rgba(0,0,0,.6)' : 'rgba(30,18,8,.55)'; ctx.fillRect(0, 0, 480, 760);
    txt(ctx, g.t('pick'), 240, 200, { size: 26, align: 'center', color: P.accent2 }, P);
    txt(ctx, (S.wave > L().WAVES ? g.t('boss') : g.t('wave') + ' ' + S.wave) + ' · ' + g.t('gate') + ' ' + S.hp + '/' + S.hpMax, 240, 224, { size: 12, align: 'center', color: P.muted, weight: 600 }, P);
    S.offer.forEach(function (c, i) {
      var r = cardRect(i, S.offer.length), on = i === S.sel, yy = r.y - (on ? 10 : 0);
      panel(ctx, r.x, yy, r.w, r.h, P, on ? P.accent2 : P.frameHi);
      ctx.fillStyle = P.retro ? P.field : '#e8cf9f'; ctx.fillRect(r.x + 8, yy + 8, r.w - 16, 74);
      icon(ctx, c, r.x + r.w / 2, yy + 46, P, g.time);
      txt(ctx, g.t('c_' + c.id), r.x + r.w / 2, yy + 104, { size: 14, align: 'center', color: on ? P.accent2 : P.inkL }, P);
      txt(ctx, g.t('k_' + c.kind) + (c.kind !== 'now' ? ' · ' + g.t('lvl') + ' ' + c.lvl : ''), r.x + r.w / 2, yy + 121, { size: 11, align: 'center', color: c.kind === 'up' ? P.accent : P.muted, weight: 700, shadow: false }, P);
      ctx.font = font(P, 11, 600); var ls = wrap(ctx, g.t('cd_' + c.id), r.w - 18);
      ls.forEach(function (s, k) { txt(ctx, s, r.x + r.w / 2, yy + 144 + k * 15, { size: 11, align: 'center', color: P.inkL, weight: 600, shadow: false }, P); });
      c._rect = { x: r.x, y: yy, w: r.w, h: r.h };
    });
    txt(ctx, g.t('pickHint'), 240, 500, { size: 12, align: 'center', color: P.muted, weight: 600 }, P);
  }
  function icon(ctx, c, x, y, P, t) {
    if (c.id === 'repair') { ctx.fillStyle = P.door; ctx.fillRect(x - 22, y - 18, 44, 36); ctx.fillStyle = P.band; ctx.fillRect(x - 22, y - 6, 44, 4); line(ctx, x - 14, y + 14, x + 14, y - 14, P.steel, 5); circle(ctx, x + 14, y - 14, 6, P.steelD); return; }
    if (c.id === 'flip') { drawFlipper(ctx, { x: x - 28, y: y + 6, ang: -0.35 }, P, false); return; }
    var B = { type: c.id, lvl: c.lvl, x: x, y: y, r: L().BUILD[c.id].r || 0, flash: 0, ring: 0, split: 0 };
    if (L().BUILD[c.id].seg) { B.a = [x - 30, y + 8]; B.b = [x + 30, y - 8]; }
    drawBuilding(ctx, B, P, t);
  }
  function slots(g, ctx, S, P, t) {
    ctx.fillStyle = P.retro ? 'rgba(0,0,0,.35)' : 'rgba(30,18,8,.25)'; ctx.fillRect(0, 0, 480, 760);
    var free = []; for (var i = 0; i < L().SLOTS.length; i++) if (!S.buildings.some(function (b) { return b.slot === i; })) free.push(i);
    free.forEach(function (i) {
      var s = L().SLOTS[i], on = i === S.slotSel, pul = on ? 3 * Math.sin(t * 6) : 0;
      ring(ctx, s.x, s.y, 26 + pul, on ? P.accent2 : P.accent, on ? 3 : 2);
      if (on && S.pending) { var B = { type: S.pending.id, lvl: 1, x: s.x, y: s.y, r: L().BUILD[S.pending.id].r || 0, flash: 0, ring: 0, split: 0 }; if (L().BUILD[S.pending.id].seg) Object.assign(B, L().springSeg(B)); drawBuilding(ctx, B, P, t, true); }
    });
    panel(ctx, 60, 520, 360, 58, P, P.accent);
    txt(ctx, g.t('slot') + ' · ' + g.t('c_' + (S.pending ? S.pending.id : 'forge')), 240, 544, { size: 16, align: 'center', color: P.accent2 }, P);
    txt(ctx, g.t('slotHint'), 240, 566, { size: 11, align: 'center', color: P.muted, weight: 600, shadow: false }, P);
  }

  OB.render = { draw: draw, PM: PM, PR: PR, panel: panel, txt: txt, cardRect: cardRect, drawBuilding: drawBuilding, drawEnemy: drawEnemy, font: font };
})(typeof window !== 'undefined' ? window : globalThis);
