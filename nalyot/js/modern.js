/* НАЛЁТ · рендер MODERN (по умолчанию). NALYOT.modern = { P, bg, ground, plat, block, hostage, pickup, vehicle,
   enemy, boss, hero, bullet, ebullet, grenade, bomb, wave, laser, mark, boom, badge, icon }
   Чистая векторная графика: небо-градиент по миссии, два слоя силуэтов-параллакса, объёмные машины банды,
   мягкое свечение выстрелов и взрывов. Логику не трогает — только читает состояние. */
(function (global) {
  'use strict';
  var N = global.NALYOT = global.NALYOT || {};
  var T = 24;
  function rr(ctx, x, y, w, h, r) { N.ui.roundRect(ctx, x, y, w, h, r); }
  function hash(x, y) { var h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

  var P = {
    pixel: false, font: null,
    hudBg: '#101216', line: '#2a2e36', panel: '#171a20', ink: '#f2efe8', muted: '#9aa0aa', accent: '#ffb347',
    good: '#5fd68a', bad: '#ff5a5a', warn: '#ffd25a', boss: '#ff6a3d', barBg: '#2a2e36',
    hero: ['#ff9a3c', '#3cc8c0'], dim: 'rgba(8,9,12,.55)'
  };
  // Палитры миссий: небо (верх/низ), дальние силуэты, ближние силуэты, грунт, кромка, тень, свечение снизу
  var SCENES = {
    yard:    { s0: '#241a33', s1: '#c8693c', far: '#4a2c3a', mid: '#2c1c26', g: '#6b4a34', top: '#a0744a', dk: '#3e2a1e', glow: null, sun: '#ffcf7a' },
    quarry:  { s0: '#3b2c2a', s1: '#e2a65e', far: '#8a5a3c', mid: '#5c3c2a', g: '#a07a50', top: '#d0a46a', dk: '#5c4430', glow: null, sun: '#fff0b0' },
    depot:   { s0: '#0b1324', s1: '#3a5878', far: '#1e2c44', mid: '#141e30', g: '#4a5260', top: '#7a8494', dk: '#262c36', glow: null, sun: '#e8f0ff' },
    bridges: { s0: '#1a1014', s1: '#7a2e1a', far: '#3a1c1a', mid: '#24120f', g: '#4a3a34', top: '#7a6458', dk: '#261c18', glow: '#ff6a1a', sun: '#ffb070' },
    mast:    { s0: '#3a6aa4', s1: '#bcd8ee', far: '#7a9cbc', mid: '#4a6a8a', g: '#5a6670', top: '#9aa8b4', dk: '#2e363e', glow: null, sun: '#ffffff' },
    den:     { s0: '#140808', s1: '#5a1810', far: '#2c0e0c', mid: '#1c0806', g: '#3e2a26', top: '#6a4a40', dk: '#1e1412', glow: '#ff4a14', sun: '#ff8a4a' }
  };
  function scene(S) { return SCENES[S.name] || SCENES.yard; }

  // ---------- Фон ----------
  function bg(ctx, S, cx, y0, W, H) {
    var C = scene(S), gr = ctx.createLinearGradient(0, y0, 0, y0 + H);
    gr.addColorStop(0, C.s0); gr.addColorStop(1, C.s1);
    ctx.fillStyle = gr; ctx.fillRect(0, y0, W, H);
    // солнце/луна
    var sx = W * 0.72 - (cx * 0.02) % 60, sy = y0 + 110;
    var sg = ctx.createRadialGradient(sx, sy, 4, sx, sy, 90); sg.addColorStop(0, C.sun); sg.addColorStop(0.25, C.sun + '88'); sg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sg; ctx.fillRect(sx - 90, sy - 90, 180, 180);
    ctx.fillStyle = C.sun; ctx.beginPath(); ctx.arc(sx, sy, 22, 0, Math.PI * 2); ctx.fill();
    if (S.name === 'mast') {   // облака
      ctx.fillStyle = 'rgba(255,255,255,.55)';
      for (var c = 0; c < 6; c++) { var px = ((c * 260 - cx * 0.1) % (W + 300) + W + 300) % (W + 300) - 150, py = y0 + 60 + (c % 3) * 50; ctx.beginPath(); ctx.ellipse(px, py, 70, 16, 0, 0, Math.PI * 2); ctx.ellipse(px + 40, py - 8, 40, 14, 0, 0, Math.PI * 2); ctx.fill(); }
    }
    // дальний слой: холмы и цеха
    layer(ctx, cx * 0.15, y0 + H - 170, W, C.far, 140, 1, S.name);
    // ближний: трубы, краны, опоры
    layer(ctx, cx * 0.4, y0 + H - 110, W, C.mid, 100, 2, S.name);
    if (C.glow) { var lg = ctx.createLinearGradient(0, y0 + H - 70, 0, y0 + H); lg.addColorStop(0, 'rgba(0,0,0,0)'); lg.addColorStop(1, C.glow); ctx.globalAlpha = 0.55; ctx.fillStyle = lg; ctx.fillRect(0, y0 + H - 70, W, 70); ctx.globalAlpha = 1; }
  }
  function layer(ctx, off, base, W, col, amp, k, name) {
    var seg = k === 1 ? 90 : 120, i0 = Math.floor(off / seg) - 1, n = Math.ceil(W / seg) + 3;
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, base + 300);
    for (var i = 0; i < n; i++) {
      var id = i0 + i, x = id * seg - off, r = hash(id, k * 7 + 3);
      if (k === 1) { var hgt = 20 + r * amp * 0.6; ctx.lineTo(x, base - hgt * 0.6); ctx.lineTo(x + seg * 0.5, base - hgt); }
      else {
        var hh2 = 20 + r * 40; ctx.lineTo(x, base - hh2); ctx.lineTo(x + seg * 0.62, base - hh2);
        if (r > 0.45) { ctx.lineTo(x + seg * 0.62, base - hh2 - 50 - r * 40); ctx.lineTo(x + seg * 0.62 + 12, base - hh2 - 50 - r * 40); ctx.lineTo(x + seg * 0.62 + 12, base - hh2); }
        ctx.lineTo(x + seg, base - hh2);
      }
    }
    ctx.lineTo(W + seg, base + 300); ctx.closePath(); ctx.fill();
    if (k === 2) {   // краны-фермы
      ctx.strokeStyle = col; ctx.lineWidth = 3;
      for (var j = 0; j < n; j++) { var id2 = i0 + j; if (hash(id2, 99) < 0.75) continue; var x2 = id2 * seg - off + 30; ctx.beginPath(); ctx.moveTo(x2, base); ctx.lineTo(x2, base - 130); ctx.lineTo(x2 + 70, base - 130); ctx.moveTo(x2, base - 110); ctx.lineTo(x2 + 50, base - 130); ctx.stroke(); }
    }
  }

  // ---------- Клетки ----------
  function ground(ctx, x, y, tx, ty, top, S) {
    var C = scene(S), v = hash(tx, ty);
    ctx.fillStyle = C.g; ctx.fillRect(x, y, T, T);
    ctx.fillStyle = 'rgba(0,0,0,' + (0.06 + v * 0.1).toFixed(2) + ')'; ctx.fillRect(x, y, T, T);
    if (v > 0.72) { ctx.fillStyle = C.dk; ctx.fillRect(x + 4 + v * 10, y + 8 + v * 6, 5, 3); }
    if (top) {
      ctx.fillStyle = C.top; ctx.fillRect(x, y, T, 5);
      ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(x, y, T, 1);
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x, y + 5, T, 2);
      if (v < 0.25) { ctx.fillStyle = C.top; ctx.fillRect(x + 6, y - 2, 3, 2); ctx.fillRect(x + 15, y - 3, 2, 3); }
    }
  }
  function plat(ctx, x, y, tx, ty, S) {
    ctx.fillStyle = '#5c6670'; ctx.fillRect(x, y, T, 6);
    ctx.fillStyle = '#8a96a2'; ctx.fillRect(x, y, T, 2);
    ctx.strokeStyle = '#3a424a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 2, y + 6); ctx.lineTo(x + 12, y + 14); ctx.lineTo(x + 22, y + 6); ctx.stroke();
  }
  function block(ctx, b, t) {
    var x = b.tx * T, y = b.ty * T, w = b.tw * T, h = b.th * T, dmg = 1 - b.hp / b.max;
    if (b.kind === 'crate') {
      for (var j = 0; j < b.th; j++) for (var i = 0; i < b.tw; i++) {
        var cx = x + i * T, cy = y + j * T;
        ctx.fillStyle = '#8a5e34'; ctx.fillRect(cx + 1, cy + 1, T - 2, T - 2);
        ctx.fillStyle = '#a8763f'; ctx.fillRect(cx + 1, cy + 1, T - 2, 4);
        ctx.strokeStyle = '#5a3a1e'; ctx.lineWidth = 2; ctx.strokeRect(cx + 2, cy + 2, T - 4, T - 4);
        ctx.beginPath(); ctx.moveTo(cx + 3, cy + 3); ctx.lineTo(cx + T - 3, cy + T - 3); ctx.stroke();
      }
    } else {
      var gr = ctx.createLinearGradient(x, 0, x + w, 0); gr.addColorStop(0, '#5a5048'); gr.addColorStop(1, '#3e3630');
      ctx.fillStyle = gr; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#2e2824'; ctx.fillRect(x - 2, y - 4, w + 4, 6);   // кровля
      ctx.fillStyle = '#6e6258';
      for (var r = 0; r < b.th * 2; r++) for (var c = 0; c < b.tw; c++) { var ox = (r % 2) * 12; ctx.fillRect(x + c * T + ox + 1, y + r * 12 + 4, 10, 1); }
      // окна-бойницы
      for (var k = 0; k < b.tw - 1; k++) { ctx.fillStyle = '#1a1614'; ctx.fillRect(x + 10 + k * T, y + 14, 10, 8); ctx.fillStyle = 'rgba(255,170,80,.35)'; ctx.fillRect(x + 11 + k * T, y + 15, 8, 3); }
    }
    if (dmg > 0.3) { ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x + w * 0.3, y + 2); ctx.lineTo(x + w * 0.45, y + h * 0.4); ctx.lineTo(x + w * 0.35, y + h * 0.7); if (dmg > 0.6) { ctx.moveTo(x + w * 0.7, y + h); ctx.lineTo(x + w * 0.6, y + h * 0.5); ctx.lineTo(x + w * 0.8, y + h * 0.3); } ctx.stroke(); }
    if (b.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(x, y, w, h); }
  }

  // ---------- Герой ----------
  var GUN = { rivet: '#c9ccd2', nail: '#ffd24a', spark: '#6ae4ff', torch: '#ff7a2a', scoop: '#b98cff' };
  function hero(ctx, h, t, players) {
    var col = P.hero[h.id], f = h.face, x = h.x, y = h.y, cr = h.crouch;
    if (!h.alive) { ctx.save(); ctx.translate(x, y - 10); ctx.scale(1.2, 1.2); ctx.rotate(f * (1.2 - h.deadT)); ctx.globalAlpha = Math.max(0, h.deadT); body(ctx, col, 1, false, 0, 0, t, h); ctx.restore(); return; }
    ctx.save(); ctx.translate(x, y); ctx.scale(1.2, 1.2);   // рисунок чуть крупнее хитбокса — читаемость
    // тень
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(0, 0, 10, 3, 0, 0, Math.PI * 2); ctx.fill();
    // контурная подсветка цветом игрока — героя видно на любом фоне
    ctx.save(); ctx.globalAlpha = 0.28; ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(0, cr ? -10 : -16, 11, cr ? 12 : 19, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    var run = h.onGround && h.vx ? Math.sin(h.runT * 16) : 0, air = !h.onGround;
    // ноги
    ctx.fillStyle = '#2a2a30';
    if (cr) { ctx.fillRect(-7, -6, 6, 6); ctx.fillRect(1, -6, 6, 6); }
    else {
      var l1 = air ? -3 : run * 4, l2 = air ? 3 : -run * 4;
      ctx.fillRect(-5 + l1, -11, 5, 11); ctx.fillRect(1 + l2, -11, 5, 11);
      ctx.fillStyle = '#16161a'; ctx.fillRect(-6 + l1, -3, 7, 3); ctx.fillRect(f > 0 ? 1 + l2 : 0 + l2, -3, 7, 3);
    }
    body(ctx, col, f, cr, 0, 0, t, h);
    ctx.restore();
  }
  function body(ctx, col, f, cr, ox, oy, t, h) {
    var top = cr ? -20 : -32, by = cr ? -7 : -11;
    // ключ за спиной
    ctx.save(); ctx.translate(-f * 6, top + 12); ctx.rotate(-f * 0.5);
    ctx.fillStyle = '#7d848e'; ctx.fillRect(-1.5, -10, 3, 16); ctx.fillRect(-4, -13, 8, 4); ctx.fillStyle = '#5a6068'; ctx.fillRect(-1, -13, 2, 3);
    ctx.restore();
    // комбинезон
    ctx.fillStyle = col; rr(ctx, -6, top + 9, 12, by - top - 8, 3); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(f > 0 ? -6 : 2, top + 10, 4, by - top - 10);
    ctx.fillStyle = '#3a3026'; ctx.fillRect(-6, by - 4, 12, 3);   // пояс
    ctx.fillStyle = '#d8b04a'; ctx.fillRect(-1, by - 4, 3, 3);
    if (h && h.armor > 0) { ctx.fillStyle = '#8a6a48'; rr(ctx, -5, top + 12, 10, 9, 2); ctx.fill(); ctx.fillStyle = '#a8865e'; ctx.fillRect(-4, top + 13, 8, 2); }
    // голова: сварочный шлем с узкой прорезью
    ctx.fillStyle = '#9aa2ac'; ctx.beginPath(); ctx.arc(0, top + 5, 6.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#6a727c'; ctx.fillRect(-7, top + 6, 14, 3);
    ctx.fillStyle = '#20242a'; rr(ctx, f > 0 ? -1 : -7, top + 2, 8, 5, 2); ctx.fill();
    ctx.fillStyle = col; ctx.globalAlpha = 0.9; ctx.fillRect(f > 0 ? 1 : -5, top + 4, 4, 1.5); ctx.globalAlpha = 1;
    // рука с оружием по прицелу
    if (h && h.alive) {
      var a = h.aim, sx = f * 2, sy = top + 13, len = h.weapon === 'scoop' ? 15 : h.weapon === 'spark' ? 16 : 13;
      var ang = Math.atan2(a.y, a.x === 0 ? 0.0001 * f : a.x);
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(ang);
      ctx.fillStyle = col; ctx.fillRect(0, -2, 6, 4);
      ctx.fillStyle = '#3a3e46'; ctx.fillRect(4, -3, len - 2, 6);
      ctx.fillStyle = GUN[h.weapon] || GUN.rivet; ctx.fillRect(5, -2, len - 4, 2);
      if (h.weapon === 'scoop') { ctx.fillStyle = '#6a5a8a'; ctx.beginPath(); ctx.moveTo(len + 2, -5); ctx.lineTo(len + 6, -6); ctx.lineTo(len + 6, 6); ctx.lineTo(len + 2, 5); ctx.fill(); }
      if (h.weapon === 'torch') { ctx.fillStyle = '#ff9a3a'; ctx.beginPath(); ctx.arc(len + 3, 0, 2, 0, Math.PI * 2); ctx.fill(); }
      if (h.gunT > 0) { ctx.fillStyle = '#fff3c0'; ctx.beginPath(); ctx.arc(len + 5, 0, 4, 0, Math.PI * 2); ctx.fill(); }
      if (h.meleeT > 0) { ctx.restore(); ctx.save(); ctx.translate(f * 8, top + 14); ctx.rotate(f * (1.4 - h.meleeT * 8)); ctx.fillStyle = '#c0c6ce'; ctx.fillRect(-1.5, -14, 3, 14); ctx.fillRect(-4, -17, 8, 4); }
      ctx.restore();
    }
  }

  // ---------- «Котёл» ----------
  function vehicle(ctx, v, t, riderCol, h) {
    var x = v.x, y = v.y, f = v.face, walk = v.onGround && v.vx ? Math.sin(v.walkT * 10) : 0;
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(0, 0, 20, 4, 0, 0, Math.PI * 2); ctx.fill();
    // ноги-шатуны
    ctx.strokeStyle = '#4a4f58'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-8, -18); ctx.lineTo(-10 + walk * 5, -9); ctx.lineTo(-8 + walk * 6, -2); ctx.moveTo(8, -18); ctx.lineTo(10 - walk * 5, -9); ctx.lineTo(8 - walk * 6, -2); ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.fillStyle = '#2e3238'; ctx.fillRect(-14 + walk * 6, -3, 12, 3); ctx.fillRect(2 - walk * 6, -3, 12, 3);
    // котёл
    var g2 = ctx.createLinearGradient(0, -46, 0, -16); g2.addColorStop(0, '#d88a4a'); g2.addColorStop(1, '#8a4a22');
    ctx.fillStyle = g2; rr(ctx, -19, -44, 38, 28, 12); ctx.fill();
    ctx.fillStyle = '#5a2e14'; for (var i = -14; i <= 14; i += 7) { ctx.beginPath(); ctx.arc(i, -19, 1.3, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(i, -41, 1.3, 0, Math.PI * 2); ctx.fill(); }
    // труба
    ctx.fillStyle = '#3a3e44'; ctx.fillRect(-f * 12 - 3, -54, 6, 12);
    // окно кабины
    ctx.fillStyle = riderCol || '#1e2228'; rr(ctx, f > 0 ? -2 : -12, -38, 14, 9, 4); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(f > 0 ? 0 : -10, -37, 6, 2);
    // пушка по прицелу
    var a = v.aim; ctx.save(); ctx.translate(f * 10, -30); ctx.rotate(Math.atan2(a.y, a.x === 0 ? 0.0001 * f : a.x));
    ctx.fillStyle = '#2e3238'; ctx.fillRect(0, -4, 22, 8); ctx.fillStyle = '#6a727c'; ctx.fillRect(18, -5, 5, 10); ctx.restore();
    if (v.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,.45)'; rr(ctx, -19, -44, 38, 28, 12); ctx.fill(); }
    if (v.boom > 0 && Math.floor(t * 10) % 2) { ctx.fillStyle = 'rgba(255,80,40,.55)'; rr(ctx, -19, -44, 38, 28, 12); ctx.fill(); }
    // дым из трубы
    ctx.fillStyle = v.hp < v.max * 0.4 ? 'rgba(40,40,40,.55)' : 'rgba(220,220,220,.35)';
    for (var k = 0; k < 3; k++) { var ph = (t * 1.5 + k / 3) % 1; ctx.beginPath(); ctx.arc(-f * 12 - f * ph * 10, -56 - ph * 26, 3 + ph * 6, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    if (!riderCol) { ctx.fillStyle = P.accent; ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 6); ctx.beginPath(); ctx.moveTo(x - 6, y - 66); ctx.lineTo(x + 6, y - 66); ctx.lineTo(x, y - 58); ctx.fill(); ctx.globalAlpha = 1; }
  }

  // ---------- Банда «Окалина» ----------
  function enemy(ctx, e, t) {
    var x = e.x, y = e.y, f = e.face;
    ctx.save(); ctx.translate(x, y); if (e.type !== 'wagon') ctx.scale(1.15, 1.15);
    if (e.type === 'raider' || e.type === 'bomber') {
      var run = e.vx ? Math.sin(e.walkT * 12) * 3 : 0;
      ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(0, 0, 9, 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3a2a22'; ctx.fillRect(-5 + run, -11, 4, 11); ctx.fillRect(1 - run, -11, 4, 11);
      ctx.fillStyle = e.type === 'bomber' ? '#7a5a2e' : '#8a4628'; rr(ctx, -6, -24, 12, 14, 3); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(-6, -14, 12, 2);
      if (e.type === 'bomber') { ctx.fillStyle = '#5a4630'; rr(ctx, -f * 9 - 4, -24, 8, 11, 3); ctx.fill(); }
      // наплечник с шипом
      ctx.fillStyle = '#5a5a62'; ctx.beginPath(); ctx.moveTo(-f * 2 - 5, -24); ctx.lineTo(-f * 2 + 5, -24); ctx.lineTo(-f * 2, -30); ctx.fill();
      // голова-ведро
      ctx.fillStyle = '#7a7a84'; rr(ctx, -5, -32, 10, 9, 2); ctx.fill();
      ctx.fillStyle = '#4a4a52'; ctx.fillRect(-6, -32, 12, 2);
      ctx.fillStyle = e.warn ? '#ffef6a' : '#ff3a2a'; ctx.beginPath(); ctx.arc(f * 2.5, -27, 1.8, 0, Math.PI * 2); ctx.fill();
      if (e.type === 'raider') {
        var a = e.aim || { x: f, y: 0 }; ctx.save(); ctx.translate(f * 3, -19); ctx.rotate(Math.atan2(a.y, a.x === 0 ? 0.0001 : a.x));
        ctx.fillStyle = '#2a2a30'; ctx.fillRect(0, -2, 15, 4); if (e.warn) { ctx.fillStyle = 'rgba(255,220,90,.8)'; ctx.beginPath(); ctx.arc(16, 0, 3, 0, Math.PI * 2); ctx.fill(); } ctx.restore();
      } else { ctx.fillStyle = '#b0b4bc'; ctx.beginPath(); ctx.arc(f * 7, -20, 3, 0, Math.PI * 2); ctx.fill(); }
    } else if (e.type === 'turret') {
      ctx.fillStyle = '#3a3a40'; ctx.fillRect(-13, -6, 26, 6);
      var g2 = ctx.createLinearGradient(0, -22, 0, -6); g2.addColorStop(0, '#a85a30'); g2.addColorStop(1, '#6a3418');
      ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(0, -6, 12, Math.PI, 0); ctx.fill();
      var a2 = e.aim || { x: f, y: 0 }; ctx.save(); ctx.translate(0, -12); ctx.rotate(Math.atan2(a2.y, a2.x === 0 ? 0.0001 : a2.x));
      ctx.fillStyle = '#2a2a30'; ctx.fillRect(4, -3, 15, 6); ctx.restore();
      ctx.fillStyle = e.warn && Math.floor(t * 12) % 2 ? '#ffef6a' : '#ff3a2a'; ctx.beginPath(); ctx.arc(0, -12, 2.5, 0, Math.PI * 2); ctx.fill();
    } else if (e.type === 'wagon') {
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(0, 0, 34, 4, 0, 0, Math.PI * 2); ctx.fill();
      var g3 = ctx.createLinearGradient(0, -34, 0, -8); g3.addColorStop(0, '#8a5a3a'); g3.addColorStop(1, '#4e2e1c');
      ctx.fillStyle = g3; ctx.beginPath(); ctx.moveTo(-32, -10); ctx.lineTo(-30, -30); ctx.lineTo(24, -30); ctx.lineTo(32, -18); ctx.lineTo(32, -10); ctx.closePath(); ctx.fill();
      ctx.save(); if (f < 0) ctx.scale(-1, 1);
      ctx.fillStyle = '#5a5a62'; for (var s = 0; s < 3; s++) { ctx.beginPath(); ctx.moveTo(32, -26 + s * 6); ctx.lineTo(40, -23 + s * 6); ctx.lineTo(32, -20 + s * 6); ctx.fill(); }
      ctx.fillStyle = '#3a3a40'; rr(ctx, -12, -40, 20, 12, 4); ctx.fill(); ctx.fillRect(6, -37, 22, 6);
      if (e.warn) { ctx.fillStyle = 'rgba(255,200,80,.9)'; ctx.beginPath(); ctx.arc(30, -34, 4, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
      ctx.fillStyle = '#3a2418'; for (var r2 = -16; r2 <= 16; r2 += 8) { ctx.beginPath(); ctx.arc(r2, -24, 1.4, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#1e1e22'; [-22, 0, 22].forEach(function (wx) { ctx.beginPath(); ctx.arc(wx, -7, 7, 0, Math.PI * 2); ctx.fill(); });
      ctx.strokeStyle = '#6a6a72'; ctx.lineWidth = 2; [-22, 0, 22].forEach(function (wx) { var aa = e.walkT * 6; ctx.beginPath(); ctx.moveTo(wx + Math.cos(aa) * 5, -7 + Math.sin(aa) * 5); ctx.lineTo(wx - Math.cos(aa) * 5, -7 - Math.sin(aa) * 5); ctx.stroke(); });
    } else if (e.type === 'drone') {
      ctx.translate(0, -7);
      ctx.fillStyle = '#5a5e66'; ctx.beginPath(); ctx.ellipse(0, 0, 12, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#8a4a2a'; ctx.beginPath(); ctx.ellipse(0, -2, 7, 4, 0, Math.PI, 0); ctx.fill();
      ctx.strokeStyle = '#c8ccd4'; ctx.lineWidth = 2; var sp = Math.sin(t * 40) * 7;
      ctx.beginPath(); ctx.moveTo(-14 - sp, -6); ctx.lineTo(-14 + sp, -6); ctx.moveTo(14 - sp, -6); ctx.lineTo(14 + sp, -6); ctx.stroke();
      ctx.fillStyle = '#3a3a40'; ctx.fillRect(-15, -6, 2, 4); ctx.fillRect(13, -6, 2, 4);
      ctx.fillStyle = e.warn && Math.floor(t * 12) % 2 ? '#ffef6a' : '#ff3a2a'; ctx.beginPath(); ctx.arc(0, 3, 2.2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    if (e.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(x - e.w / 2 - 2, y - e.hh - 2, e.w + 4, e.hh + 2); }
  }

  // ---------- Боссы-машины ----------
  function boss(ctx, B, t) {
    var x = B.x, y = B.y, w = B.w, h = B.hh, glow = B.warn > 0 || B.shift > 0;
    ctx.save(); ctx.translate(x, y);
    if (B.dead) { ctx.globalAlpha = Math.max(0, 1 - B.deadT / 2.6); ctx.translate((Math.random() - 0.5) * 6, B.deadT * 10); }
    var rust = ctx.createLinearGradient(0, -h, 0, 0); rust.addColorStop(0, '#9a5a34'); rust.addColorStop(1, '#4a2614');
    var dark = '#2e2e34', steel = '#6a707a', eye = glow && Math.floor(t * 10) % 2 ? '#ffef6a' : '#ff3a2a';
    if (!B.fly) { ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(0, 0, w * 0.55, 6, 0, 0, Math.PI * 2); ctx.fill(); }
    switch (B.key) {
      case 'pincer': {   // погрузчик-краб
        var cl = Math.sin(t * 3) * 0.15;
        ctx.strokeStyle = dark; ctx.lineWidth = 6;
        for (var l = 0; l < 3; l++) { var lx = -30 + l * 30, k = Math.sin(t * 4 + l) * 4; ctx.beginPath(); ctx.moveTo(lx, -40); ctx.lineTo(lx - 12, -20 + k); ctx.lineTo(lx - 8, 0); ctx.stroke(); }
        ctx.fillStyle = rust; rr(ctx, -50, -78, 100, 42, 16); ctx.fill();
        ctx.fillStyle = steel; rr(ctx, -20, -92, 40, 18, 6); ctx.fill();
        ctx.fillStyle = eye; ctx.fillRect(-14, -86, 8, 4); ctx.fillRect(6, -86, 8, 4);
        [[-1, -56], [-1, -40]].forEach(function (c, i) {
          ctx.save(); ctx.translate(-50, c[1]); ctx.rotate(i ? cl : -cl);
          ctx.fillStyle = steel; ctx.fillRect(-28, -5, 30, 10);
          ctx.fillStyle = '#7a3a1e'; ctx.beginPath(); ctx.moveTo(-28, -12); ctx.lineTo(-48, -6); ctx.lineTo(-30, -2); ctx.closePath(); ctx.fill();
          ctx.beginPath(); ctx.moveTo(-28, 12); ctx.lineTo(-46, 6); ctx.lineTo(-30, 2); ctx.closePath(); ctx.fill(); ctx.restore();
        });
        break;
      }
      case 'auger': {    // буровой танк
        ctx.fillStyle = dark; rr(ctx, -64, -24, 128, 24, 12); ctx.fill();
        ctx.fillStyle = '#4a4a52'; for (var wh = -50; wh <= 50; wh += 20) { ctx.beginPath(); ctx.arc(wh, -12, 8, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = rust; rr(ctx, -50, -66, 108, 44, 10); ctx.fill();
        ctx.fillStyle = steel; rr(ctx, -10, -80, 46, 16, 5); ctx.fill(); ctx.fillStyle = '#2a2a30'; ctx.fillRect(-24, -76, 20, 6);   // мортира
        ctx.fillStyle = eye; ctx.fillRect(18, -75, 10, 4);
        // бур
        ctx.save(); ctx.translate(-50, -44);
        ctx.fillStyle = '#b8bcc4'; ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(-44, 0); ctx.lineTo(0, 18); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#5a5e66'; ctx.lineWidth = 3; var sp = (t * 40) % 10;
        for (var b = 0; b < 4; b++) { var bx = -b * 10 - sp; ctx.beginPath(); ctx.moveTo(bx, -18 * (1 + bx / 44)); ctx.lineTo(bx - 6, 18 * (1 + (bx - 6) / 44)); ctx.stroke(); }
        ctx.restore();
        break;
      }
      case 'smokestack': {   // паровоз банды
        ctx.fillStyle = dark; ctx.fillRect(-75, -22, 150, 10);
        ctx.fillStyle = '#3a3a40'; [-52, -20, 12, 44].forEach(function (wx) { ctx.beginPath(); ctx.arc(wx, -12, 12, 0, Math.PI * 2); ctx.fill(); });
        ctx.strokeStyle = steel; ctx.lineWidth = 3; ctx.beginPath(); var ca = t * 5; ctx.moveTo(-52 + Math.cos(ca) * 8, -12 + Math.sin(ca) * 8); ctx.lineTo(44 + Math.cos(ca) * 8, -12 + Math.sin(ca) * 8); ctx.stroke();
        ctx.fillStyle = rust; rr(ctx, -72, -70, 100, 46, 20); ctx.fill();
        ctx.fillStyle = '#5a2e18'; ctx.fillRect(24, -96, 50, 72);   // будка
        ctx.fillStyle = '#ffb04a'; ctx.fillRect(34, -88, 14, 12); ctx.fillStyle = eye; ctx.fillRect(36, -84, 10, 3);
        ctx.fillStyle = dark; ctx.fillRect(-60, -104, 16, 36); ctx.fillRect(-64, -108, 24, 6);   // труба
        ctx.fillStyle = '#7a7a84'; ctx.beginPath(); ctx.moveTo(-75, -22); ctx.lineTo(-88, -4); ctx.lineTo(-75, -4); ctx.fill();   // путеочиститель
        ctx.fillStyle = 'rgba(60,60,64,.55)'; for (var p = 0; p < 4; p++) { var ph = (t * 0.8 + p / 4) % 1; ctx.beginPath(); ctx.arc(-52 + ph * 30, -112 - ph * 60, 6 + ph * 14, 0, Math.PI * 2); ctx.fill(); }
        break;
      }
      case 'cogwalker': {   // шагающая шестерня
        var st = Math.sin(t * 2.2);
        ctx.strokeStyle = dark; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(-20, -62); ctx.lineTo(-30 + st * 8, -30); ctx.lineTo(-24 + st * 10, 0); ctx.moveTo(20, -62); ctx.lineTo(30 - st * 8, -30); ctx.lineTo(24 - st * 10, 0); ctx.stroke();
        ctx.fillStyle = rust; rr(ctx, -44, -112, 88, 54, 12); ctx.fill();
        ctx.save(); ctx.translate(0, -86); ctx.rotate(t * (1 + B.phase));
        ctx.fillStyle = '#c0a050'; for (var c2 = 0; c2 < 10; c2++) { ctx.rotate(Math.PI / 5); ctx.fillRect(-4, -26, 8, 8); }
        ctx.beginPath(); ctx.arc(0, 0, 21, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#5a4a20'; ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        ctx.fillStyle = steel; rr(ctx, -18, -126, 36, 16, 5); ctx.fill(); ctx.fillStyle = eye; ctx.fillRect(-12, -121, 24, 4);
        ctx.fillStyle = dark; ctx.fillRect(-58, -100, 16, 10); ctx.fillStyle = B.lastPat === 'laser' && glow ? '#ff4a4a' : '#5a5e66'; ctx.fillRect(-64, -98, 8, 6);
        break;
      }
      case 'bellship': {   // дирижабль-колокол
        var bg2 = ctx.createLinearGradient(0, -70, 0, -30); bg2.addColorStop(0, '#9a8a6a'); bg2.addColorStop(1, '#5a4a34');
        ctx.fillStyle = bg2; ctx.beginPath(); ctx.ellipse(0, -52, 70, 20, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 2; for (var sx = -40; sx <= 40; sx += 20) { ctx.beginPath(); ctx.moveTo(sx, -70); ctx.lineTo(sx, -34); ctx.stroke(); }
        ctx.strokeStyle = dark; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-20, -34); ctx.lineTo(-14, -20); ctx.moveTo(20, -34); ctx.lineTo(14, -20); ctx.stroke();
        ctx.fillStyle = '#b07a2a'; ctx.beginPath(); ctx.moveTo(-14, -22); ctx.quadraticCurveTo(-26, 0, -30, 2); ctx.lineTo(30, 2); ctx.quadraticCurveTo(26, 0, 14, -22); ctx.closePath(); ctx.fill();
        ctx.fillStyle = eye; ctx.beginPath(); ctx.arc(0, -6, 5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#c8ccd4'; ctx.lineWidth = 3; var pr = Math.sin(t * 30) * 10; ctx.beginPath(); ctx.moveTo(74, -52 - pr); ctx.lineTo(74, -52 + pr); ctx.moveTo(-74, -52 - pr); ctx.lineTo(-74, -52 + pr); ctx.stroke();
        break;
      }
      case 'furnace': {   // Горн Окалины
        ctx.fillStyle = dark; rr(ctx, -80, -30, 160, 30, 6); ctx.fill();
        ctx.fillStyle = rust; ctx.beginPath(); ctx.moveTo(-70, -30); ctx.lineTo(-56, -132); ctx.lineTo(56, -132); ctx.lineTo(70, -30); ctx.closePath(); ctx.fill();
        ctx.fillStyle = dark; ctx.fillRect(-50, -150, 18, 22); ctx.fillRect(32, -150, 18, 22);
        var mouth = ctx.createRadialGradient(0, -66, 4, 0, -66, 34); mouth.addColorStop(0, '#fff2a0'); mouth.addColorStop(0.5, '#ff8a2a'); mouth.addColorStop(1, '#6a1a0a');
        ctx.fillStyle = mouth; rr(ctx, -30, -92, 60, 46, 14); ctx.fill();
        ctx.fillStyle = dark; for (var gx = -24; gx <= 24; gx += 12) ctx.fillRect(gx - 2, -92, 4, 46);
        ctx.fillStyle = eye; ctx.fillRect(-36, -118, 18, 6); ctx.fillRect(18, -118, 18, 6);
        ctx.strokeStyle = steel; ctx.lineWidth = 8; var ar = Math.sin(t * 2) * 0.3; ctx.beginPath(); ctx.moveTo(-62, -80); ctx.lineTo(-92, -60 + ar * 30); ctx.lineTo(-96, -30); ctx.stroke();
        ctx.fillStyle = 'rgba(255,120,40,.35)'; for (var e2 = 0; e2 < 5; e2++) { var ep = (t * 0.7 + e2 / 5) % 1; ctx.beginPath(); ctx.arc(-41 + (e2 % 2) * 82, -156 - ep * 50, 3 + ep * 8, 0, Math.PI * 2); ctx.fill(); }
        break;
      }
    }
    if (B.flash > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(-w / 2 - 10, -h - 10, w + 20, h + 10); ctx.globalCompositeOperation = 'source-over'; }
    if (B.shift > 0 && Math.floor(t * 12) % 2) { ctx.strokeStyle = '#ffef6a'; ctx.lineWidth = 2; ctx.strokeRect(-w / 2 - 4, -h - 4, w + 8, h + 4); }
    ctx.restore();
  }

  // ---------- Пленник, подборы ----------
  function hostage(ctx, hs, t) {
    var x = hs.x, y = hs.y;
    ctx.save(); ctx.translate(x, y);
    if (!hs.freed) {
      ctx.fillStyle = '#5a4430'; ctx.fillRect(6, -30, 4, 30);   // столб
      ctx.fillStyle = '#3a5a9a'; rr(ctx, -6, -18, 11, 12, 3); ctx.fill();
      ctx.fillStyle = '#2a2a30'; ctx.fillRect(-6, -6, 11, 6);
      ctx.fillStyle = '#f0c8a0'; ctx.beginPath(); ctx.arc(-1, -22, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2a4a8a'; ctx.fillRect(-6, -27, 10, 3);
      ctx.strokeStyle = '#c8a46a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-7, -14); ctx.lineTo(10, -14); ctx.moveTo(-7, -9); ctx.lineTo(10, -9); ctx.stroke();
      if (Math.floor(t * 3) % 2) { ctx.fillStyle = P.warn; ctx.font = '900 14px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('!', -1, -34); }
    } else {
      var j = Math.abs(Math.sin(hs.t * 10)) * (hs.t < 0.6 ? 10 : 3); ctx.globalAlpha = Math.max(0, 1 - Math.max(0, hs.t - 2) );
      ctx.fillStyle = '#3a5a9a'; rr(ctx, -5, -22 - j, 10, 13, 3); ctx.fill();
      ctx.fillStyle = '#2a2a30'; ctx.fillRect(-5, -9 - j, 4, 9); ctx.fillRect(1, -9 - j, 4, 9);
      ctx.fillStyle = '#f0c8a0'; ctx.beginPath(); ctx.arc(0, -27 - j, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2a4a8a'; ctx.fillRect(-5, -32 - j, 10, 3);
      if (hs.t < 0.8) { ctx.strokeStyle = '#f0c8a0'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(4, -20 - j); ctx.lineTo(10, -30 - j - Math.sin(hs.t * 20) * 3); ctx.stroke(); }
    }
    ctx.restore();
  }
  var PK = { nail: '#ffd24a', spark: '#6ae4ff', torch: '#ff7a2a', scoop: '#b98cff' };
  function pickup(ctx, p, t) {
    var x = p.x, y = p.y - 10 - (p.vy === null ? Math.abs(Math.sin(t * 4)) * 3 : 0);
    ctx.save(); ctx.translate(x, y);
    var col = p.kind === 'w' ? PK[p.w] : p.kind === 'gren' ? '#7ad06a' : p.kind === 'life' ? '#ff6a8a' : p.kind === 'armor' ? '#c8a06a' : '#ffd24a';
    var gl = ctx.createRadialGradient(0, 0, 2, 0, 0, 18); gl.addColorStop(0, col + '88'); gl.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gl; ctx.fillRect(-18, -18, 36, 36);
    ctx.fillStyle = '#23262c'; rr(ctx, -10, -9, 20, 18, 5); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 2; rr(ctx, -10, -9, 20, 18, 5); ctx.stroke();
    ctx.fillStyle = col; icon(ctx, p.kind === 'w' ? p.w : p.kind, 0, 0, col);
    ctx.restore();
  }
  function icon(ctx, k, x, y, col) {
    ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = 2;
    if (k === 'nail') { ctx.fillRect(x - 6, y - 1, 10, 2); ctx.fillRect(x - 7, y - 3, 2, 6); ctx.beginPath(); ctx.moveTo(x + 4, y - 1); ctx.lineTo(x + 7, y); ctx.lineTo(x + 4, y + 1); ctx.fill(); }
    else if (k === 'spark') { ctx.beginPath(); ctx.moveTo(x - 6, y - 4); ctx.lineTo(x, y - 1); ctx.lineTo(x - 2, y + 1); ctx.lineTo(x + 6, y + 4); ctx.stroke(); }
    else if (k === 'torch') { ctx.beginPath(); ctx.moveTo(x, y - 6); ctx.quadraticCurveTo(x + 6, y, x, y + 5); ctx.quadraticCurveTo(x - 6, y, x, y - 6); ctx.fill(); }
    else if (k === 'scoop') { ctx.beginPath(); ctx.arc(x - 3, y - 2, 2, 0, 7); ctx.arc(x + 3, y - 2, 2, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(x, y + 3, 2, 0, 7); ctx.fill(); }
    else if (k === 'gren') { ctx.beginPath(); ctx.arc(x, y + 1, 5, 0, 7); ctx.fill(); ctx.fillRect(x - 1, y - 7, 3, 3); }
    else if (k === 'life') { ctx.beginPath(); ctx.moveTo(x, y + 5); ctx.bezierCurveTo(x - 9, y - 2, x - 3, y - 8, x, y - 3); ctx.bezierCurveTo(x + 3, y - 8, x + 9, y - 2, x, y + 5); ctx.fill(); }
    else if (k === 'armor') { ctx.beginPath(); ctx.moveTo(x - 5, y - 5); ctx.lineTo(x + 5, y - 5); ctx.lineTo(x + 6, y + 5); ctx.lineTo(x - 6, y + 5); ctx.closePath(); ctx.fill(); }
    else { for (var i = 0; i < 8; i++) { var a = i * Math.PI / 4; ctx.fillRect(x + Math.cos(a) * 5 - 1.5, y + Math.sin(a) * 5 - 1.5, 3, 3); } ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fill(); }
  }

  // ---------- Снаряды и эффекты ----------
  function bullet(ctx, b) {
    if (b.kind === 'torch') {
      var k = b.t / b.life; ctx.fillStyle = k < 0.4 ? 'rgba(255,240,160,.9)' : k < 0.7 ? 'rgba(255,140,40,.8)' : 'rgba(200,60,20,.5)';
      ctx.beginPath(); ctx.arc(b.x, b.y, 3 + k * 7, 0, Math.PI * 2); ctx.fill(); return;
    }
    var col = b.kind === 'spark' ? '#8af0ff' : b.kind === 'nail' ? '#ffe680' : b.kind === 'scoop' ? '#e0c8ff' : b.kind === 'kotel' ? '#ffb04a' : '#fff0b0';
    var l = Math.hypot(b.vx, b.vy) || 1, ux = b.vx / l, uy = b.vy / l, len = b.kind === 'spark' ? 18 : b.kind === 'kotel' ? 10 : 7;
    ctx.strokeStyle = col; ctx.lineWidth = b.kind === 'kotel' ? 4 : b.kind === 'spark' ? 3 : 2.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(b.x - ux * len, b.y - uy * len); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.lineCap = 'butt';
    if (b.kind === 'spark') { ctx.strokeStyle = 'rgba(138,240,255,.35)'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(b.x - ux * len, b.y - uy * len); ctx.lineTo(b.x, b.y); ctx.stroke(); }
  }
  function ebullet(ctx, b, t) {
    var r = b.r + 1.5;
    var g2 = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r * 2.4); g2.addColorStop(0, b.kind === 'shell' ? '#ffd0a0' : '#ffe0d0'); g2.addColorStop(0.35, b.kind === 'shell' ? '#ff6a1a' : '#ff3a4a'); g2.addColorStop(1, 'rgba(255,40,40,0)');
    ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(b.x, b.y, r * 2.4, 0, Math.PI * 2); ctx.fill();
  }
  function grenade(ctx, gr) {
    ctx.save(); ctx.translate(gr.x, gr.y); ctx.rotate(gr.spin);
    if (gr.shell) { ctx.fillStyle = '#ffb04a'; ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#5a2e14'; ctx.fillRect(-2, -2, 4, 4); }
    else { ctx.fillStyle = '#4a5a3a'; ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#ffb347'; ctx.fillRect(-4.5, -1, 9, 2); ctx.fillStyle = '#fff0a0'; ctx.fillRect(-1, -7, 2, 3); }
    ctx.restore();
  }
  function bomb(ctx, bm, t) {
    ctx.save(); ctx.translate(bm.x, bm.y);
    if (bm.kind === 'bolt') { ctx.rotate(bm.t * 10); ctx.fillStyle = '#8a8e96'; ctx.beginPath(); for (var i = 0; i < 6; i++) { var a = i * Math.PI / 3; ctx.lineTo(Math.cos(a) * 5, Math.sin(a) * 5); } ctx.closePath(); ctx.fill(); ctx.fillStyle = '#2a2a30'; ctx.beginPath(); ctx.arc(0, 0, 2, 0, 7); ctx.fill(); }
    else { ctx.fillStyle = '#2a2a30'; ctx.beginPath(); ctx.ellipse(0, 0, 4.5, bm.kind === 'rain' ? 8 : 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = Math.floor(t * 12) % 2 ? '#ff4a2a' : '#ffd04a'; ctx.beginPath(); ctx.arc(0, 2, 1.8, 0, 7); ctx.fill(); }
    ctx.restore();
  }
  function wave(ctx, w, t) {
    var g2 = ctx.createLinearGradient(0, w.y - 26, 0, w.y); g2.addColorStop(0, 'rgba(255,200,90,0)'); g2.addColorStop(1, 'rgba(255,140,40,.9)');
    ctx.fillStyle = g2; ctx.beginPath(); ctx.moveTo(w.x - 22, w.y); ctx.quadraticCurveTo(w.x - 6, w.y - 28, w.x + 4, w.y - 18); ctx.quadraticCurveTo(w.x + 14, w.y - 8, w.x + 30, w.y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#7a5a3a'; for (var i = 0; i < 4; i++) ctx.fillRect(w.x - 10 + i * 8, w.y - 6 - ((i * 7 + t * 60) % 14), 3, 3);
  }
  function laser(ctx, l, t) {
    if (l.warn > 0) {
      if (Math.floor(t * 12) % 2) { ctx.strokeStyle = 'rgba(255,70,70,.8)'; ctx.lineWidth = 1; ctx.setLineDash([8, 6]); ctx.beginPath(); ctx.moveTo(l.x0, l.y); ctx.lineTo(l.x1, l.y); ctx.stroke(); ctx.setLineDash([]); }
      return;
    }
    ctx.fillStyle = 'rgba(255,60,60,.35)'; ctx.fillRect(l.x0, l.y - 7, l.x1 - l.x0, 14);
    ctx.fillStyle = 'rgba(255,200,200,.95)'; ctx.fillRect(l.x0, l.y - 2, l.x1 - l.x0, 4);
  }
  function mark(ctx, m, S) {
    var B = S.boss, gy = B ? B.groundY : 400, a = 0.4 + 0.6 * (Math.floor(S.time * 10) % 2);
    ctx.globalAlpha = a; ctx.strokeStyle = '#ff4a3a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(m.x, gy - 2, 16, 4, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(m.x, gy - 14); ctx.lineTo(m.x - 5, gy - 22); ctx.lineTo(m.x + 5, gy - 22); ctx.closePath(); ctx.fillStyle = '#ff4a3a'; ctx.fill();
    ctx.globalAlpha = 1;
  }
  function boom(ctx, b) {
    var k = b.t / b.max, r = b.r * (0.4 + k * 0.8);
    var g2 = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r); g2.addColorStop(0, 'rgba(255,250,210,' + (1 - k) + ')'); g2.addColorStop(0.4, 'rgba(255,160,60,' + (0.9 - k * 0.8) + ')'); g2.addColorStop(1, 'rgba(120,40,20,0)');
    ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, Math.PI * 2); ctx.fill();
  }

  // ---------- HUD ----------
  function badge(ctx, pi, x, y, dim) {
    var col = dim ? '#4a4e56' : P.hero[pi];
    ctx.fillStyle = '#9aa2ac'; ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#20242a'; rr(ctx, x - 6, y - 4, 12, 6, 2); ctx.fill();
    ctx.fillStyle = col; ctx.fillRect(x - 4, y - 2, 8, 2);
  }
  function hudIcon(ctx, k, x, y, pi) {
    if (k === 'life') { ctx.fillStyle = P.hero[pi]; ctx.beginPath(); ctx.arc(x, y - 1, 4, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#20242a'; ctx.fillRect(x - 3, y - 2, 6, 2); }
    else if (k === 'armor') icon(ctx, 'armor', x, y, '#c8a06a');
    else icon(ctx, 'gren', x, y, '#9ad08a');
  }

  N.modern = { P: P, scenes: SCENES, bg: bg, ground: ground, plat: plat, block: block, hostage: hostage, pickup: pickup, vehicle: vehicle,
    enemy: enemy, boss: boss, hero: hero, bullet: bullet, ebullet: ebullet, grenade: grenade, bomb: bomb, wave: wave, laser: laser,
    mark: mark, boom: boom, badge: badge, icon: hudIcon };
})(typeof window !== 'undefined' ? window : globalThis);
