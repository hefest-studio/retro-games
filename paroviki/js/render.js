/* ПАРОВИКИ · общий рендер мира для обеих тем (палитра P: PAROVIKI.modern / PAROVIKI.classic).
   Рисует в мировых координатах (камера — снаружи, в ui.js): клетки лабиринта, вентили, двери, шлюз,
   находки, чудищ, механизмов-боссов, героев-паровиков, выстрелы и эффекты. PAROVIKI.render */
(function (global) {
  'use strict';
  var PV = global.PAROVIKI = global.PAROVIKI || {};
  var TAU = Math.PI * 2;

  function rrect(ctx, x, y, w, h, r, fill) { ctx.fillStyle = fill; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); ctx.fill(); }
  function circ(ctx, x, y, r, fill) { ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
  function box(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
  // в retro круги — «пиксельные» восьмиугольники
  function spot(ctx, P, x, y, r, c) { if (P.pixel) { box(ctx, x - r, y - r * 0.6, r * 2, r * 1.2, c); box(ctx, x - r * 0.6, y - r, r * 1.2, r * 2, c); } else circ(ctx, x, y, r, c); }
  function shadow(ctx, P, x, y, r) { if (!P.shadow) return; ctx.fillStyle = P.shadow; ctx.beginPath(); ctx.ellipse(x + 2, y + r * 0.7, r, r * 0.45, 0, 0, TAU); ctx.fill(); }

  // ---------- Клетки ----------
  function tiles(ctx, S, P, time, view) {
    var L = PV.logic, m = S.map, T = L.T, Wd = P.worlds[S.world] || P.worlds[1], TL = L.TILE;
    var x0 = Math.max(0, Math.floor(view.x / T)), y0 = Math.max(0, Math.floor(view.y / T)), x1 = Math.min(m.TW - 1, Math.floor((view.x + view.w) / T)), y1 = Math.min(m.TH - 1, Math.floor((view.y + view.h) / T));
    for (var ty = y0; ty <= y1; ty++) for (var tx = x0; tx <= x1; tx++) {
      var t = m.tiles[ty * m.TW + tx], x = tx * T, y = ty * T;
      if (t === TL.WALL || t === TL.CRACK) continue;
      box(ctx, x, y, T, T, ((tx + ty) & 1) ? Wd.floor : Wd.floor2);
      if (P.pixel) { if (((tx * 7 + ty * 3) % 5) === 0) box(ctx, x + 8, y + 12, 4, 2, Wd.seam); }
      else { ctx.fillStyle = Wd.seam; ctx.fillRect(x, y, T, 1); ctx.fillRect(x, y, 1, T); if (((tx * 7 + ty * 3) % 4) === 0) { circ(ctx, x + 5, y + 5, 1.2, Wd.deco); circ(ctx, x + T - 5, y + T - 5, 1.2, Wd.deco); } }
    }
    // провалы, ящики, гнёзда-литейки, двери, заслонки — поверх пола
    for (ty = y0; ty <= y1; ty++) for (tx = x0; tx <= x1; tx++) {
      t = m.tiles[ty * m.TW + tx]; x = tx * T; y = ty * T;
      if (t === TL.PIT) { box(ctx, x + 2, y + 2, T - 4, T - 4, Wd.pit); if (P.pixel) { box(ctx, x + 2, y + 2, T - 4, 2, Wd.pitEdge); } else { ctx.strokeStyle = Wd.pitEdge; ctx.globalAlpha = 0.35 + 0.15 * Math.sin(time * 2 + tx); ctx.lineWidth = 1.5; ctx.strokeRect(x + 3, y + 3, T - 6, T - 6); ctx.globalAlpha = 1; } }
      else if (t === TL.CRATE) { shadow(ctx, P, x + T / 2, y + T / 2, 12); box(ctx, x + 4, y + 4, T - 8, T - 8, P.crateDark); box(ctx, x + 5, y + 5, T - 10, T - 12, P.crate); box(ctx, x + 5, y + 14, T - 10, 3, P.crateBand); box(ctx, x + 14, y + 5, 3, T - 12, P.crateBand); }
      else if (t === TL.DOOR) { box(ctx, x, y, T, T, P.doorDark); box(ctx, x + 2, y + 2, T - 4, T - 4, P.door); box(ctx, x + 2, y + T / 2 - 1, T - 4, 2, P.doorDark); }
      else if (t === TL.BAR) { box(ctx, x, y, T, T, P.bar2); for (var k = 0; k < 4; k++) box(ctx, x + 2 + k * 8, y + 2, 4, T - 4, P.bar); }
    }
    // замки на дверях (по одному на группу)
    m.groups.forEach(function (G) { if (G.open) return; var p = G.tiles[1], cx = p[0] * T + T / 2, cy = p[1] * T + T / 2; if (G.kind === 'door') { spot(ctx, P, cx, cy, 7, P.doorLock); box(ctx, cx - 1.5, cy - 1, 3, 6, P.doorDark); } });
    // стены — с «торцом» (псевдо-объём), трещины
    for (ty = y0; ty <= y1; ty++) for (tx = x0; tx <= x1; tx++) {
      t = m.tiles[ty * m.TW + tx]; if (t !== TL.WALL && t !== TL.CRACK) continue; x = tx * T; y = ty * T;
      var below = ty + 1 < m.TH ? m.tiles[(ty + 1) * m.TW + tx] : TL.WALL, open = below !== TL.WALL && below !== TL.CRACK;
      box(ctx, x, y, T, T, Wd.wall);
      box(ctx, x, y, T, open ? T - 8 : T, Wd.wallTop);
      if (open) box(ctx, x, y + T - 8, T, 8, Wd.wallDark);
      if (P.pixel) { box(ctx, x + ((tx * 5) % 3) * 8 + 2, y + 6, 10, 2, Wd.wall); box(ctx, x + 14, y + 16, 12, 2, Wd.wall); }
      else { ctx.fillStyle = Wd.wall; ctx.fillRect(x, y + 11, T, 1); if (((tx + ty) & 1) === 0) { ctx.fillRect(x + 15, y, 1, 11); circ(ctx, x + 6, y + 5, 1.5, Wd.wallDark); } else ctx.fillRect(x + 8, y + 11, 1, 12); }
      if (t === TL.CRACK) { ctx.strokeStyle = P.crack; ctx.lineWidth = P.pixel ? 2 : 1.6; ctx.beginPath(); ctx.moveTo(x + 6, y + 3); ctx.lineTo(x + 14, y + 12); ctx.lineTo(x + 10, y + 18); ctx.lineTo(x + 20, y + 26); ctx.moveTo(x + 14, y + 12); ctx.lineTo(x + 24, y + 9); ctx.stroke(); }
    }
  }

  // ---------- Объекты ----------
  function valve(ctx, o, P, time) {
    var col = o.on ? P.valveOn : P.valve, a = o.on ? time * 3 : o.prog * 6;
    shadow(ctx, P, o.x, o.y, 14);
    // фланец трубы с болтами + вертикальная труба
    box(ctx, o.x - 5, o.y - 20, 10, 8, P.valveRim); box(ctx, o.x - 14, o.y - 14, 28, 28, P.valveRim);
    box(ctx, o.x - 12, o.y - 12, 24, 24, P.pixel ? '#383838' : '#3a3d44');
    [[-9, -9], [9, -9], [-9, 9], [9, 9]].forEach(function (b) { box(ctx, o.x + b[0] - 1.5, o.y + b[1] - 1.5, 3, 3, P.pixel ? '#a8a8a8' : '#8a8f98'); });
    // штурвал: обод, спицы, ступица
    ctx.strokeStyle = col; ctx.lineWidth = P.pixel ? 4 : 3; ctx.beginPath(); ctx.arc(o.x, o.y, 9, 0, TAU); ctx.stroke();
    ctx.lineWidth = 2;
    for (var i = 0; i < 3; i++) { var aa = a + i * TAU / 3; ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(o.x + Math.cos(aa) * 9, o.y + Math.sin(aa) * 9); ctx.stroke(); }
    for (var k2 = 0; k2 < 6; k2++) { var ab = a + k2 * TAU / 6 + 0.5; box(ctx, o.x + Math.cos(ab) * 11 - 1.5, o.y + Math.sin(ab) * 11 - 1.5, 3, 3, col); }
    spot(ctx, P, o.x, o.y, 3, col);
    if (!o.on && o.prog > 0) { ctx.strokeStyle = P.valveRing; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(o.x, o.y, 18, -Math.PI / 2, -Math.PI / 2 + TAU * o.prog); ctx.stroke(); }
    if (o.on) { // струйка пара
      for (var k = 0; k < 3; k++) { var ph = (time * 0.9 + k / 3) % 1; ctx.globalAlpha = (1 - ph) * (P.pixel ? 0.8 : 0.6); spot(ctx, P, o.x + Math.sin(time * 2 + k) * 3, o.y - 12 - ph * 26, 3 + ph * 5, P.steam); }
      ctx.globalAlpha = 1;
    } else if (!P.pixel) { ctx.globalAlpha = 0.25 + 0.2 * Math.sin(time * 4); circ(ctx, o.x, o.y, 20, P.mark || 'rgba(255,74,42,.25)'); ctx.globalAlpha = 1; }
  }
  function exitHatch(ctx, S, P, time) {
    var e = S.map.exit, open = S.exitOpen;
    if (S.boss && !open) return;
    if (open && !P.pixel) { ctx.globalAlpha = 0.5 + 0.3 * Math.sin(time * 4); circ(ctx, e.x, e.y, 30, P.exitGlow); ctx.globalAlpha = 1; }
    spot(ctx, P, e.x, e.y, 22, P.exitRim); spot(ctx, P, e.x, e.y, 18, open ? P.exitOpen : P.exit);
    if (!open) { for (var i = 0; i < 6; i++) { var a = i * TAU / 6; box(ctx, e.x + Math.cos(a) * 14 - 2, e.y + Math.sin(a) * 14 - 2, 4, 4, P.exitRim); } box(ctx, e.x - 10, e.y - 2, 20, 4, P.exitRim); }
    else { ctx.globalAlpha = 0.8; for (var k = 0; k < 3; k++) { var r = ((time * 18 + k * 6) % 18); if (P.pixel) { ctx.strokeStyle = P.exitGlow; ctx.lineWidth = 2; ctx.strokeRect(e.x - r, e.y - r, r * 2, r * 2); } else { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, TAU); ctx.stroke(); } } ctx.globalAlpha = 1; }
  }
  function obj(ctx, o, P, time) {
    var b = Math.sin(time * 4 + o.x) * 2;
    if (o.kind === 'valve') return valve(ctx, o, P, time);
    if (o.kind === 'coin') { shadow(ctx, P, o.x, o.y, 6); spot(ctx, P, o.x, o.y + b, 7, P.coinDark); spot(ctx, P, o.x, o.y + b - 1, 5, P.coin); box(ctx, o.x - 1, o.y + b - 4, 2, 6, P.coinDark); return; }
    if (o.kind === 'food') { shadow(ctx, P, o.x, o.y, 9); rrect(ctx, o.x - 10, o.y - 5 + b, 20, 11, 5, P.food); rrect(ctx, o.x - 8, o.y - 6 + b, 16, 6, 3, P.foodTop); box(ctx, o.x - 5, o.y - 3 + b, 2, 2, P.food); box(ctx, o.x + 2, o.y - 3 + b, 2, 2, P.food); return; }
    if (o.kind === 'key') { shadow(ctx, P, o.x, o.y, 8); ctx.strokeStyle = P.key; ctx.lineWidth = 3; if (P.pixel) { ctx.strokeRect(o.x - 9, o.y - 5 + b, 8, 8); box(ctx, o.x - 1, o.y - 2 + b, 11, 3, P.key); box(ctx, o.x + 6, o.y + b, 3, 5, P.key); } else { ctx.beginPath(); ctx.arc(o.x - 5, o.y + b, 4.5, 0, TAU); ctx.stroke(); box(ctx, o.x - 1, o.y - 1.5 + b, 11, 3, P.key); box(ctx, o.x + 6, o.y + b, 3, 5, P.key); box(ctx, o.x + 2, o.y + b, 2, 4, P.key); } return; }
    if (o.kind === 'chest') { shadow(ctx, P, o.x, o.y, 13); box(ctx, o.x - 13, o.y - 9, 26, 18, P.chest); box(ctx, o.x - 13, o.y - 3, 26, 3, P.chestBand); box(ctx, o.x - 2, o.y - 4, 4, 6, P.chestBand); return; }
    if (o.kind === 'charge') { shadow(ctx, P, o.x, o.y, 8); spot(ctx, P, o.x, o.y + b, 9, P.charge); spot(ctx, P, o.x, o.y + b, 5, '#ffffff'); return; }
    if (o.kind === 'lever') {
      box(ctx, o.x - 10, o.y + 2, 20, 8, P.lever); spot(ctx, P, o.x, o.y + 4, 5, o.on ? P.leverOn : P.leverOff);
      ctx.strokeStyle = P.lever; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(o.x, o.y + 4); var a = o.on ? -0.6 : -2.5; ctx.lineTo(o.x + Math.cos(a) * 16, o.y + 4 + Math.sin(a) * 16); ctx.stroke();
      spot(ctx, P, o.x + Math.cos(a) * 16, o.y + 4 + Math.sin(a) * 16, 4, o.on ? P.leverOn : P.leverOff);
    }
  }

  // ---------- Чудища ----------
  function enemy(ctx, e, P, time) {
    var fl = e.flash > 0, c, cd, r = e.r;
    if (e.spawnFx > 0) ctx.globalAlpha = 1 - e.spawnFx / 0.45;
    if (e.type === 'nest') {
      shadow(ctx, P, e.x, e.y, 15);
      box(ctx, e.x - 15, e.y - 13, 30, 28, fl ? '#ffffff' : P.nest); box(ctx, e.x - 12, e.y - 16, 24, 5, P.heavyDark);
      box(ctx, e.x - 3, e.y - 22, 6, 8, P.heavyDark);
      var gl = 0.6 + 0.4 * Math.sin(time * 5 + e.id); ctx.globalAlpha = gl; box(ctx, e.x - 8, e.y + 1, 16, 10, P.nestMouth); ctx.globalAlpha = 1;
      if (e.hp < e.max) { box(ctx, e.x - 14, e.y + 18, 28, 3, P.barBg); box(ctx, e.x - 14, e.y + 18, 28 * Math.max(0, e.hp / e.max), 3, P.nestMouth); }
      return;
    }
    shadow(ctx, P, e.x, e.y, r);
    var a = e.ang || 0, ca = Math.cos(a), sa = Math.sin(a), st = Math.sin(e.walk || 0);
    if (e.type === 'tin') {
      c = fl ? '#ffffff' : P.tin; cd = P.tinDark;
      box(ctx, e.x - 9 - st * 2, e.y + 6, 5, 6, cd); box(ctx, e.x + 4 + st * 2, e.y + 6, 5, 6, cd);
      if (P.pixel) { box(ctx, e.x - 9, e.y - 10, 18, 18, c); box(ctx, e.x - 9, e.y - 2, 18, 2, cd); } else { rrect(ctx, e.x - 9, e.y - 11, 18, 20, 5, c); ctx.fillStyle = cd; ctx.fillRect(e.x - 9, e.y - 3, 18, 2); }
      box(ctx, e.x + ca * 4 - 5, e.y - 7 + sa * 2, 4, 3, P.eye); box(ctx, e.x + ca * 4 + 1, e.y - 7 + sa * 2, 4, 3, P.eye);
    } else if (e.type === 'bug') {
      c = fl ? '#ffffff' : P.bug; cd = P.bugDark;
      ctx.strokeStyle = cd; ctx.lineWidth = 2;
      for (var i = -1; i <= 1; i++) { var lx = -sa * 9, ly = ca * 9, ox = ca * i * 5, oy = sa * i * 5, w = st * 2 * (i === 0 ? -1 : 1); ctx.beginPath(); ctx.moveTo(e.x + ox - lx + w, e.y + oy - ly); ctx.lineTo(e.x + ox + lx - w, e.y + oy + ly); ctx.stroke(); }
      spot(ctx, P, e.x, e.y, 7, c); spot(ctx, P, e.x + ca * 6, e.y + sa * 6, 4, cd);
      box(ctx, e.x + ca * 7 - 1, e.y + sa * 7 - 1, 2, 2, P.eye);
    } else if (e.type === 'whistle') {
      c = fl ? '#ffffff' : P.whistle; cd = P.whistleDark;
      spot(ctx, P, e.x, e.y, 12, cd); spot(ctx, P, e.x, e.y, 9, c);
      ctx.strokeStyle = cd; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + ca * 16, e.y + sa * 16); ctx.stroke();
      if (e.tele > 0) { ctx.globalAlpha = 0.5 + 0.5 * Math.sin(time * 40); spot(ctx, P, e.x + ca * 16, e.y + sa * 16, 5, P.eshot); ctx.globalAlpha = 1; }
      box(ctx, e.x - 2, e.y - 2, 4, 4, P.eye);
    } else if (e.type === 'heavy') {
      c = fl ? '#ffffff' : P.heavy; cd = P.heavyDark;
      box(ctx, e.x - 16, e.y - 12, 6, 26, cd); box(ctx, e.x + 10, e.y - 12, 6, 26, cd);
      for (var k = 0; k < 4; k++) { var yy = e.y - 12 + ((k * 7 + (e.walk || 0) * 4) % 26); box(ctx, e.x - 16, yy, 6, 2, P.tinDark); box(ctx, e.x + 10, yy, 6, 2, P.tinDark); }
      if (P.pixel) box(ctx, e.x - 11, e.y - 13, 22, 26, c); else rrect(ctx, e.x - 11, e.y - 13, 22, 26, 8, c);
      spot(ctx, P, e.x, e.y - 2, 5, cd); box(ctx, e.x - 3, e.y - 4, 6, 3, P.eye);
      if (!P.pixel) { circ(ctx, e.x - 7, e.y - 9, 1.3, cd); circ(ctx, e.x + 7, e.y - 9, 1.3, cd); circ(ctx, e.x - 7, e.y + 9, 1.3, cd); circ(ctx, e.x + 7, e.y + 9, 1.3, cd); }
    }
    ctx.globalAlpha = 1;
    if (e.stun > 0) { for (var s = 0; s < 3; s++) { var aa = time * 6 + s * 2.1; box(ctx, e.x + Math.cos(aa) * 10 - 1.5, e.y - r - 4 + Math.sin(aa) * 3, 3, 3, P.charge); } }
  }

  // ---------- Механизмы-боссы ----------
  function boss(ctx, S, P, time) {
    var B = S.boss; if (!B || B.dead) return;
    var fl = B.flash > 0, c = fl ? '#ffffff' : P.boss, cd = P.bossDark, cl = P.bossLight, x = B.x, y = B.y, r = B.r;
    if (B.intro > 0) ctx.globalAlpha = 1 - B.intro / 2.2;
    shadow(ctx, P, x, y, r);
    if (B.key === 'drill') {
      var a = B.ang || 0, ca = Math.cos(a), sa = Math.sin(a);
      spot(ctx, P, x, y, r, cd); spot(ctx, P, x, y, r - 5, c);
      ctx.fillStyle = cl; ctx.beginPath(); ctx.moveTo(x + ca * (r + 26), y + sa * (r + 26)); ctx.lineTo(x + ca * r * 0.7 - sa * 18, y + sa * r * 0.7 + ca * 18); ctx.lineTo(x + ca * r * 0.7 + sa * 18, y + sa * r * 0.7 - ca * 18); ctx.fill();
      for (var i = 0; i < 3; i++) { var t = ((time * (B.mode === 'charge' ? 8 : 3)) + i / 3) % 1; ctx.strokeStyle = cd; ctx.lineWidth = 2; var px = x + ca * (r * 0.7 + t * 26), py = y + sa * (r * 0.7 + t * 26), w = 18 * (1 - t); ctx.beginPath(); ctx.moveTo(px - sa * w, py + ca * w); ctx.lineTo(px + sa * w, py - ca * w); ctx.stroke(); }
      if (B.mode === 'tele') { ctx.globalAlpha = 0.5 + 0.5 * Math.sin(time * 30); spot(ctx, P, x, y, 10, P.markEdge); ctx.globalAlpha = 1; }
    } else if (B.key === 'crane') {
      box(ctx, x - r - 20, y - 14, (r + 20) * 2, 12, cd);
      spot(ctx, P, x, y, r, cd); spot(ctx, P, x, y, r - 6, c);
      var ang = B.ang || 0;
      for (var j = 0; j < 2; j++) { var aa = ang * 0.5 + j * Math.PI; ctx.strokeStyle = cl; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(aa) * (r + 14), y + Math.sin(aa) * (r + 14)); ctx.stroke(); spot(ctx, P, x + Math.cos(aa) * (r + 14), y + Math.sin(aa) * (r + 14), 7, cd); }
    } else if (B.key === 'pendulum') {
      ctx.strokeStyle = cl; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(B.x0, 1.2 * 32); ctx.lineTo(x, y); ctx.stroke();
      spot(ctx, P, B.x0, 1.2 * 32, 8, cd);
      spot(ctx, P, x, y, r, cd); spot(ctx, P, x, y, r - 6, c);
      for (var k = 0; k < 12; k++) { var a2 = k * TAU / 12 + time; box(ctx, x + Math.cos(a2) * (r - 3) - 2, y + Math.sin(a2) * (r - 3) - 2, 4, 4, cl); }
      ctx.strokeStyle = cd; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(time * 2) * (r - 12), y + Math.sin(time * 2) * (r - 12)); ctx.stroke();
    } else {
      box(ctx, x - r - 12, y - r + 6, (r + 12) * 2, r * 2 - 6, cd);
      box(ctx, x - r - 6, y - r + 10, (r + 6) * 2, r * 2 - 14, c);
      for (var p = 0; p < 4; p++) { var px2 = x - r + 6 + p * ((r * 2 - 12) / 3), ph = Math.sin(time * 4 + p * 1.6) * 8; box(ctx, px2 - 5, y - r - 14 + ph, 10, 22, cl); box(ctx, px2 - 7, y - r - 18 + ph, 14, 5, cd); }
      for (var q = 0; q < 3; q++) { var ph2 = (time * 0.8 + q / 3) % 1; ctx.globalAlpha = (1 - ph2) * 0.5; spot(ctx, P, x - 20 + q * 20, y - r - 24 - ph2 * 30, 6 + ph2 * 8, P.steam); } ctx.globalAlpha = 1;
    }
    // сердцевина: под бронёй (давлением), пока не открыты вентили
    var core = B.key === 'machine' ? 16 : 10;
    spot(ctx, P, x, y, core + 3, cd); spot(ctx, P, x, y, core, B.armor > 0 ? P.bossArmor : P.bossCore);
    if (B.armor > 0) { ctx.strokeStyle = P.bossArmor; ctx.lineWidth = 2; for (var s = 0; s < B.armor; s++) { ctx.beginPath(); ctx.arc(x, y, r + 6 + s * 5, 0, TAU); ctx.stroke(); } }
    else if (!P.pixel) { ctx.globalAlpha = 0.4 + 0.3 * Math.sin(time * 8); circ(ctx, x, y, core + 8, P.bossCore); ctx.globalAlpha = 1; }
    ctx.globalAlpha = 1;
  }

  // ---------- Паровики ----------
  function hero(ctx, h, P, time, S) {
    if (!h.alive) return;
    var col = P.hero[h.t.hid], dk = P.heroDark[h.t.hid];
    var a = h.aimA != null ? h.aimA : Math.atan2(h.face[1], h.face[0]), ca = Math.cos(a), sa = Math.sin(a);
    if (h.inv > 0 && !h.down && Math.floor(time * 16) % 2 === 0 && h.inv < 2.6) ctx.globalAlpha = 0.45;
    shadow(ctx, P, h.x, h.y, 11);
    if (h.down) { ctx.globalAlpha = 0.6; spot(ctx, P, h.x, h.y, 10, dk); ctx.globalAlpha = 1; box(ctx, h.x - 10, h.y - 22, 20, 3, P.barBg); box(ctx, h.x - 10, h.y - 22, 20 * (1 - h.downT / 12), 3, P.warn); return; }
    ctx.save(); ctx.translate(h.x, h.y); ctx.scale(1.3, 1.3); ctx.translate(-h.x, -h.y);   // паровик крупнее чудищ — легко найти глазами
    var bob = h.moving ? Math.sin(h.walk) * 1.5 : 0;
    // котёл за спиной + трубка с паром
    var bx = h.x - ca * 9, by = h.y - sa * 9 + bob;
    if (P.pixel) box(ctx, bx - 7, by - 7, 14, 14, P.boilerDark); else rrect(ctx, bx - 7, by - 7, 14, 14, 4, P.boilerDark);
    spot(ctx, P, bx, by, 5, P.boiler);
    if (h.moving || h.fire) { var ph = (time * 2.5 + h.id * 0.5) % 1; ctx.globalAlpha = (1 - ph) * 0.6; spot(ctx, P, bx - ca * 6 * ph, by - 8 - ph * 10, 2 + ph * 4, P.steam); ctx.globalAlpha = h.inv > 0 && Math.floor(time * 16) % 2 === 0 ? 0.45 : 1; }
    // ноги
    var st = h.moving ? Math.sin(h.walk) * 4 : 0;
    box(ctx, h.x - sa * 5 + ca * st - 2.5, h.y + ca * 5 + sa * st - 2.5 + 4, 5, 5, dk); box(ctx, h.x + sa * 5 - ca * st - 2.5, h.y - ca * 5 - sa * st - 2.5 + 4, 5, 5, dk);
    // корпус-комбинезон
    spot(ctx, P, h.x, h.y + bob, 10, dk); spot(ctx, P, h.x, h.y + bob - 1, 8.5, col);
    // ствол
    ctx.strokeStyle = P.boilerDark; ctx.lineWidth = h.t.gun >= 3 ? 6 : 5; ctx.beginPath(); ctx.moveTo(h.x + ca * 4, h.y + sa * 4 + bob); ctx.lineTo(h.x + ca * 17, h.y + sa * 17 + bob); ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(h.x + ca * 10, h.y + sa * 10 + bob); ctx.lineTo(h.x + ca * 16, h.y + sa * 16 + bob); ctx.stroke();
    // шлем-колпак с круглым стеклом (смотрит по ходу)
    spot(ctx, P, h.x + ca * 1, h.y + sa * 1 - 3 + bob, 6.5, P.helmetDark); spot(ctx, P, h.x + ca * 1, h.y + sa * 1 - 4 + bob, 5.5, P.helmet);
    spot(ctx, P, h.x + ca * 4, h.y + sa * 4 - 4 + bob, 2.6, P.glass);
    if (h.hitT > 0) { ctx.globalAlpha = 0.6; spot(ctx, P, h.x, h.y, 12, P.bad); }
    ctx.globalAlpha = 1;
    ctx.restore(); ctx.globalAlpha = 1;
    if (h.shieldT > 0) { ctx.strokeStyle = P.shield; ctx.lineWidth = P.pixel ? 2 : 2.5; ctx.globalAlpha = h.shieldT < 1 ? 0.4 + 0.4 * Math.sin(time * 20) : 0.9; if (P.pixel) ctx.strokeRect(h.x - 17, h.y - 17, 34, 34); else { ctx.beginPath(); ctx.arc(h.x, h.y, 18, 0, TAU); ctx.stroke(); } ctx.globalAlpha = 1; }
  }

  // ---------- Выстрелы и эффекты ----------
  function shots(ctx, S, P, time) {
    S.shots.forEach(function (s) {
      var c = P.shot[s.gun] || '#fff';
      if (s.gun === 'saw') { var a = time * 20; spot(ctx, P, s.x, s.y, s.r, c); box(ctx, s.x + Math.cos(a) * s.r - 1.5, s.y + Math.sin(a) * s.r - 1.5, 3, 3, P.boilerDark); box(ctx, s.x - Math.cos(a) * s.r - 1.5, s.y - Math.sin(a) * s.r - 1.5, 3, 3, P.boilerDark); }
      else if (s.gun === 'bolt') { ctx.strokeStyle = c; ctx.lineWidth = P.pixel ? 3 : 2.5; ctx.beginPath(); var l = 0.025; ctx.moveTo(s.x - s.vx * l, s.y - s.vy * l); ctx.lineTo(s.x - s.vx * l * 0.5 + (Math.random() - 0.5) * 5, s.y - s.vy * l * 0.5 + (Math.random() - 0.5) * 5); ctx.lineTo(s.x, s.y); ctx.stroke(); }
      else if (s.gun === 'steam') { if (!P.pixel) { ctx.globalAlpha = 0.35; circ(ctx, s.x - s.vx * 0.02, s.y - s.vy * 0.02, s.r + 3, c); ctx.globalAlpha = 1; } spot(ctx, P, s.x, s.y, s.r, c); }
      else { var sp = Math.hypot(s.vx, s.vy) || 1; ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(s.x - s.vx / sp * 7, s.y - s.vy / sp * 7); ctx.lineTo(s.x, s.y); ctx.stroke(); }
    });
    S.eshots.forEach(function (s) { if (P.eglow) circ(ctx, s.x, s.y, s.r + 4, P.eglow); spot(ctx, P, s.x, s.y, s.r, P.eshot); spot(ctx, P, s.x, s.y, s.r * 0.45, '#ffffff'); });
    S.bombs.forEach(function (b) {
      var k = 1 - b.t / 1.4;
      if (P.mark) { ctx.fillStyle = P.mark; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * k, 0, TAU); ctx.fill(); }
      ctx.strokeStyle = P.markEdge; ctx.lineWidth = 2; if (P.pixel) ctx.strokeRect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2); else { ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.stroke(); }
      spot(ctx, P, b.x, b.y, 9, P.bossDark); spot(ctx, P, b.x, b.y - 2, 6, P.bossLight);
    });
    S.fx.forEach(function (f) {
      if (f.kind === 'boom') { var k = 1 - f.t / 0.35; ctx.globalAlpha = 1 - k; spot(ctx, P, f.x, f.y, f.r * (0.4 + k * 0.6), P.boom[1]); spot(ctx, P, f.x, f.y, f.r * 0.4 * (1 - k), P.boom[0]); ctx.globalAlpha = 1; }
      else if (f.kind === 'blast') { var k2 = 1 - f.t / 0.5; ctx.globalAlpha = 1 - k2; ctx.strokeStyle = P.boom[0]; ctx.lineWidth = 8 * (1 - k2) + 2; if (P.pixel) ctx.strokeRect(f.x - f.r * k2, f.y - f.r * k2, f.r * 2 * k2, f.r * 2 * k2); else { ctx.beginPath(); ctx.arc(f.x, f.y, f.r * k2, 0, TAU); ctx.stroke(); } ctx.globalAlpha = 1; }
    });
  }

  // Весь мир (вызывается внутри трансформа камеры)
  function world(ctx, S, P, time, view) {
    tiles(ctx, S, P, time, view);
    exitHatch(ctx, S, P, time);
    var pad = 40;
    S.objs.forEach(function (o) { if (o.x > view.x - pad && o.x < view.x + view.w + pad && o.y > view.y - pad && o.y < view.y + view.h + pad) obj(ctx, o, P, time); });
    S.enemies.forEach(function (e) { if (e.x > view.x - pad && e.x < view.x + view.w + pad && e.y > view.y - pad && e.y < view.y + view.h + pad) enemy(ctx, e, P, time); });
    boss(ctx, S, P, time);
    S.heroes.slice().sort(function (a, b) { return a.y - b.y; }).forEach(function (h) { hero(ctx, h, P, time, S); });
    shots(ctx, S, P, time);
  }

  PV.render = { world: world, hero: hero, enemy: enemy, obj: obj, rrect: rrect, circ: circ, box: box, spot: spot };
})(typeof window !== 'undefined' ? window : globalThis);
