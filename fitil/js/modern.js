/* ФИТИЛЬ · рендер MODERN (по умолчанию). FITIL.modern = { P, bg, draw, glyph, face }
   Ночной двор: сланцевый пол, каменные колонны с фаской, деревянные ящики,
   чёрные бомбы с бегущей искрой, мягкое свечение пламени. Логику не трогает — только читает состояние. */
(function (global) {
  'use strict';
  var F = global.FITIL = global.FITIL || {};
  var L = F.logic, T = 40, OY = 48;

  var P = {
    pixel: false, font: null,
    hudBg: '#10131b', hudLine: '#232a38', ink: '#eef2f8', muted: '#97a1b4', accent: '#ff8a3d', good: '#4fd88a', bad: '#ff5d6c',
    panel: '#161b26', line: '#2b3446', bar: '#2b3446', bossBar: '#ff5a3a',
    pl: ['#ff8a3d', '#3dd6c4'], plDark: ['#b4501c', '#1f8f84'],
    en: { wander: '#a77bff', chaser: '#ff4f6a', ghost: '#bfe3ff', fast: '#ffd23f' },
    pw: { bomb: '#9fb4ff', flame: '#ff8a3d', speed: '#4fd88a', kick: '#ffb020', relay: '#4fd2ff' }
  };
  var rr = function (ctx, x, y, w, h, r) { F.ui.roundRect(ctx, x, y, w, h, r); };
  function cx(c) { return c * T + T / 2; }
  function cy(r) { return OY + r * T + T / 2; }

  // ---------- Фон канвы ----------
  function bg(ctx, g) {
    var gr = ctx.createLinearGradient(0, 0, 0, g.H); gr.addColorStop(0, '#121620'); gr.addColorStop(1, '#0b0d13');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, g.W, g.H);
  }

  // ---------- Статичный слой уровня (пол + стены), кэш по раскладке стен ----------
  var cache = null, cacheKey = '';
  function staticLayer(S) {
    var key = '';
    for (var i = 0; i < S.grid.length; i++) key += S.grid[i] === L.WALL ? '1' : '0';
    if (cache && key === cacheKey) return cache;
    var c = document.createElement('canvas'); c.width = L.COLS * T; c.height = L.ROWS * T;
    var x = c.getContext('2d');
    for (var r = 0; r < L.ROWS; r++) for (var q = 0; q < L.COLS; q++) {
      var px = q * T, py = r * T;
      if (S.grid[r * L.COLS + q] === L.WALL) {
        var edge = q === 0 || r === 0 || q === L.COLS - 1 || r === L.ROWS - 1;
        x.fillStyle = edge ? '#262c3a' : '#2e3546'; x.fillRect(px, py, T, T);
        var sg = x.createLinearGradient(px, py, px, py + T); sg.addColorStop(0, edge ? '#3a4254' : '#4b5468'); sg.addColorStop(1, edge ? '#2a303d' : '#353d4f');
        x.fillStyle = sg; rr(x, px + 3, py + 3, T - 6, T - 8, 6); x.fill();
        x.fillStyle = 'rgba(255,255,255,.10)'; rr(x, px + 6, py + 5, T - 12, 4, 2); x.fill();
        x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(px + 3, py + T - 5, T - 6, 3);
      } else {
        x.fillStyle = (q + r) % 2 ? '#1a1f2b' : '#1c2230'; x.fillRect(px, py, T, T);
        x.fillStyle = 'rgba(255,255,255,.025)'; x.fillRect(px, py, T, 1); x.fillRect(px, py, 1, T);
      }
    }
    // тени от стен на полу
    x.fillStyle = 'rgba(0,0,0,.22)';
    for (r = 1; r < L.ROWS; r++) for (q = 0; q < L.COLS; q++)
      if (S.grid[(r - 1) * L.COLS + q] === L.WALL && S.grid[r * L.COLS + q] !== L.WALL) x.fillRect(q * T, r * T, T, 7);
    cache = c; cacheKey = key; return c;
  }

  function crate(ctx, q, r) {
    var px = q * T, py = OY + r * T;
    ctx.fillStyle = '#6b3d17'; rr(ctx, px + 3, py + 3, T - 6, T - 6, 4); ctx.fill();
    var gr = ctx.createLinearGradient(px, py, px, py + T); gr.addColorStop(0, '#c07a38'); gr.addColorStop(1, '#94552a');
    ctx.fillStyle = gr; rr(ctx, px + 5, py + 5, T - 10, T - 10, 3); ctx.fill();
    ctx.strokeStyle = 'rgba(70,35,10,.55)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(px + 6, py + 15); ctx.lineTo(px + T - 6, py + 15); ctx.moveTo(px + 6, py + 25); ctx.lineTo(px + T - 6, py + 25); ctx.stroke();
    ctx.strokeStyle = '#6b3d17'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(px + 7, py + 7); ctx.lineTo(px + T - 7, py + T - 7); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fillRect(px + 6, py + 6, T - 12, 2);
  }

  // ---------- Значки бонусов ----------
  function glyph(ctx, kind, x, y, s, col) {
    s = s || 1; col = col || P.pw[kind];
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (kind === 'bomb') {
      ctx.beginPath(); ctx.arc(-1, 2, 8, 0, 6.283); ctx.fill();
      ctx.beginPath(); ctx.moveTo(4, -4); ctx.quadraticCurveTo(7, -10, 11, -9); ctx.stroke();
    } else if (kind === 'flame') {
      ctx.beginPath(); ctx.moveTo(0, -11); ctx.bezierCurveTo(9, -2, 9, 4, 7, 7); ctx.arc(0, 4, 7.2, 0.4, Math.PI - 0.4); ctx.bezierCurveTo(-9, 4, -6, -3, 0, -11); ctx.fill();
      ctx.fillStyle = '#fff3b0'; ctx.beginPath(); ctx.arc(0, 5, 3.4, 0, 6.283); ctx.fill();
    } else if (kind === 'speed') {
      ctx.beginPath(); ctx.moveTo(-9, -7); ctx.lineTo(-2, 0); ctx.lineTo(-9, 7); ctx.moveTo(0, -7); ctx.lineTo(7, 0); ctx.lineTo(0, 7); ctx.stroke();
    } else if (kind === 'kick') {
      ctx.beginPath(); ctx.arc(5, 0, 6, 0, 6.283); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-11, -5); ctx.lineTo(-4, -5); ctx.moveTo(-11, 0); ctx.lineTo(-3, 0); ctx.moveTo(-11, 5); ctx.lineTo(-4, 5); ctx.stroke();
    } else if (kind === 'relay') {
      ctx.beginPath(); ctx.moveTo(3, -11); ctx.lineTo(-6, 2); ctx.lineTo(0, 2); ctx.lineTo(-3, 11); ctx.lineTo(7, -3); ctx.lineTo(1, -3); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  // ---------- Подрывник ----------
  function sapper(ctx, x, y, i, face, step, s) {
    s = s || 1; var col = P.pl[i], dark = P.plDark[i];
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    var bob = Math.sin(step * 14) * 1.5;
    // тень
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(0, 14, 11, 4, 0, 0, 6.283); ctx.fill();
    // ноги
    ctx.fillStyle = '#2a2f3c';
    ctx.beginPath(); ctx.ellipse(-5, 12 + bob, 4, 3, 0, 0, 6.283); ctx.ellipse(5, 12 - bob, 4, 3, 0, 0, 6.283); ctx.fill();
    // тело
    var gr = ctx.createLinearGradient(0, -6, 0, 12); gr.addColorStop(0, col); gr.addColorStop(1, dark);
    ctx.fillStyle = gr; rr(ctx, -9, -2, 18, 14, 6); ctx.fill();
    // голова
    ctx.fillStyle = '#f2d2b4'; ctx.beginPath(); ctx.arc(0, -6, 9, 0, 6.283); ctx.fill();
    // каска
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, -8, 10, Math.PI, 0); ctx.fill();
    ctx.fillRect(-11, -9, 22, 3);
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(-3, -13, 3, 0, 6.283); ctx.fill();
    // глаза по взгляду
    var ex = face === 'left' ? -3 : face === 'right' ? 3 : 0, ey = face === 'up' ? -2 : 0;
    if (face !== 'up') {
      ctx.fillStyle = '#1b1e27';
      ctx.beginPath(); ctx.arc(-3.5 + ex, -4 + ey, 1.8, 0, 6.283); ctx.arc(3.5 + ex, -4 + ey, 1.8, 0, 6.283); ctx.fill();
    }
    ctx.restore();
  }
  function face(ctx, x, y, i, s) { sapper(ctx, x, y + 2, i, 'down', 0, s); }

  // ---------- Враги ----------
  function enemy(ctx, e, t) {
    var x = cx(e.x), y = cy(e.y), col = P.en[e.type], dx = e.dir ? e.dir[0] : 0, dy = e.dir ? e.dir[1] : 0;
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(0, 14, 11, 4, 0, 0, 6.283); ctx.fill();
    if (e.type === 'wander') {
      var w = Math.sin(t * 6 + e.t) * 1.5;
      ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(0, 0, 13 + w, 12 - w, 0, 0, 6.283); ctx.fill();
      ctx.beginPath(); ctx.ellipse(-6, 11, 4, 3, 0, 0, 6.283); ctx.ellipse(6, 11, 4, 3, 0, 0, 6.283); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.ellipse(-4, -5, 5, 3, -0.5, 0, 6.283); ctx.fill();
    } else if (e.type === 'chaser') {
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(-12, -8); ctx.lineTo(-7, -15); ctx.lineTo(-3, -9); ctx.lineTo(3, -9); ctx.lineTo(7, -15); ctx.lineTo(12, -8);
      ctx.lineTo(13, 8); ctx.quadraticCurveTo(0, 16, -13, 8); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff'; for (var k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(k * 4 - 2, 6); ctx.lineTo(k * 4, 10); ctx.lineTo(k * 4 + 2, 6); ctx.fill(); }
    } else if (e.type === 'ghost') {
      ctx.globalAlpha = 0.72 + Math.sin(t * 3 + e.t) * 0.12;
      var gr = ctx.createRadialGradient(0, -2, 2, 0, 0, 16); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, col);
      // облачко из трёх клубов, без «юбки»
      ctx.fillStyle = gr; ctx.beginPath();
      ctx.arc(-6, 2 + Math.sin(t * 4 + e.t) * 1.2, 9, 0, 6.283); ctx.arc(6, 2 + Math.cos(t * 4 + e.t) * 1.2, 9, 0, 6.283); ctx.arc(0, -5, 10, 0, 6.283);
      ctx.fill(); ctx.globalAlpha = 1;
    } else if (e.type === 'fast') {
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(14, 0); ctx.lineTo(0, 14); ctx.lineTo(-14, 0); ctx.closePath(); ctx.fill();
      ctx.save(); ctx.rotate(t * 9); ctx.strokeStyle = 'rgba(120,70,0,.55)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(9, 0); ctx.moveTo(0, -9); ctx.lineTo(0, 9); ctx.stroke(); ctx.restore();
    }
    // глаза (у шатуна — один большой)
    var ox = dx * 3, oy = dy * 2;
    if (e.type === 'wander') {
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -1, 6, 0, 6.283); ctx.fill();
      ctx.fillStyle = '#14161d'; ctx.beginPath(); ctx.arc(ox * 1.2, -1 + oy, 3, 0, 6.283); ctx.fill();
      ctx.restore(); return;
    }
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-5, -2, 4, 0, 6.283); ctx.arc(5, -2, 4, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#14161d'; ctx.beginPath(); ctx.arc(-5 + ox, -2 + oy, 2, 0, 6.283); ctx.arc(5 + ox, -2 + oy, 2, 0, 6.283); ctx.fill();
    if (e.type === 'chaser') { ctx.strokeStyle = '#14161d'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-9, -8); ctx.lineTo(-2, -5); ctx.moveTo(9, -8); ctx.lineTo(2, -5); ctx.stroke(); }
    ctx.restore();
  }
  function boss(ctx, B, t) {
    var x = cx(B.x), y = cy(B.y), R = 30, hit = B.flash > 0 && Math.floor(t * 20) % 2 === 0;
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(0, R - 2, R, 8, 0, 0, 6.283); ctx.fill();
    var gr = ctx.createRadialGradient(-8, -10, 4, 0, 0, R); gr.addColorStop(0, hit ? '#ffffff' : '#a7adb9'); gr.addColorStop(1, hit ? '#ffd0c0' : '#5d636f');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, R, 0, 6.283); ctx.fill();
    ctx.save(); ctx.rotate(t * (B.hp <= B.max / 2 ? 2.2 : 1.2));
    ctx.strokeStyle = 'rgba(30,32,40,.45)'; ctx.lineWidth = 3;
    for (var k = 0; k < 8; k++) { ctx.rotate(Math.PI / 4); ctx.beginPath(); ctx.moveTo(R - 9, 0); ctx.lineTo(R - 1, 0); ctx.stroke(); }
    ctx.restore();
    ctx.fillStyle = '#3a3e48'; ctx.beginPath(); ctx.arc(0, 0, 7, 0, 6.283); ctx.fill();
    // трещины по мере урона
    ctx.strokeStyle = '#2a2d35'; ctx.lineWidth = 2; var cr = B.max - B.hp;
    for (var i = 0; i < cr; i++) { var a = i * 2.4 + 0.5; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 9, Math.sin(a) * 9); ctx.lineTo(Math.cos(a + 0.3) * 18, Math.sin(a + 0.3) * 18); ctx.lineTo(Math.cos(a) * (R - 3), Math.sin(a) * (R - 3)); ctx.stroke(); }
    // глаза
    ctx.save(); ctx.shadowColor = '#ff5a3a'; ctx.shadowBlur = 14; ctx.fillStyle = '#ff5a3a';
    ctx.beginPath(); ctx.moveTo(-17, -10); ctx.lineTo(-6, -6); ctx.lineTo(-15, -2); ctx.closePath(); ctx.moveTo(17, -10); ctx.lineTo(6, -6); ctx.lineTo(15, -2); ctx.closePath(); ctx.fill(); ctx.restore();
    ctx.restore();
  }

  // ---------- Бомба и пламя ----------
  function bomb(ctx, b, t) {
    var x = cx(b.x), y = cy(b.y), rate = b.relay ? 3 : 4 + (L.FUSE - b.fuse) * 5, pulse = 1 + Math.sin(b.t * rate) * 0.06;
    ctx.save(); ctx.translate(x, y + 2); ctx.scale(pulse, pulse);
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(0, 12, 11, 4, 0, 0, 6.283); ctx.fill();
    var gr = ctx.createRadialGradient(-4, -4, 1, 0, 0, 14); gr.addColorStop(0, b.owner < 0 ? '#6a4a44' : '#5a6075'); gr.addColorStop(1, '#101218');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, 13, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#2b2f3a'; ctx.fillRect(-4, -16, 8, 5);
    if (b.relay) { ctx.strokeStyle = P.pw.relay; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 15, 0, 6.283); ctx.stroke(); }
    ctx.strokeStyle = '#c8b48a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -16); ctx.quadraticCurveTo(4, -22, 9, -20); ctx.stroke();
    var sp = b.relay ? P.pw.relay : '#ffd34d';
    ctx.save(); ctx.shadowColor = sp; ctx.shadowBlur = 12; ctx.fillStyle = sp;
    ctx.beginPath(); ctx.arc(9 + Math.sin(t * 40) * 1, -20, 3 + Math.sin(t * 30), 0, 6.283); ctx.fill(); ctx.restore();
    ctx.restore();
  }
  function flames(ctx, S) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (var k in S.flames) {
      var f = S.flames[k], q = k % L.COLS, r = (k / L.COLS) | 0, x = q * T, y = OY + r * T, a = Math.min(1, f.t / L.FLAME_T * 1.6);
      ctx.globalAlpha = a;
      var layers = [['#ff5a1a', 2], ['#ffb02e', 8], ['#fff3b0', 14]];
      for (var i = 0; i < layers.length; i++) {
        var pad = layers[i][1]; ctx.fillStyle = layers[i][0];
        if (f.h || f.c) { rr(ctx, x, y + pad, T, T - pad * 2, (T - pad * 2) / 2); ctx.fill(); }
        if (f.v || f.c) { rr(ctx, x + pad, y, T - pad * 2, T, (T - pad * 2) / 2); ctx.fill(); }
      }
    }
    ctx.restore();
  }

  function hatch(ctx, H, t) {
    var x = H.x * T, y = OY + H.y * T;
    ctx.fillStyle = '#2f3644'; rr(ctx, x + 4, y + 4, T - 8, T - 8, 6); ctx.fill();
    if (H.open) {
      var gl = 0.5 + Math.sin(t * 5) * 0.3;
      ctx.save(); ctx.shadowColor = '#4fd88a'; ctx.shadowBlur = 16 * gl; ctx.fillStyle = '#05070a'; rr(ctx, x + 8, y + 8, T - 16, T - 16, 5); ctx.fill(); ctx.restore();
      ctx.strokeStyle = 'rgba(79,216,138,' + (0.5 + gl * 0.5) + ')'; ctx.lineWidth = 2; rr(ctx, x + 7, y + 7, T - 14, T - 14, 5); ctx.stroke();
    } else {
      ctx.fillStyle = '#4a5366'; rr(ctx, x + 8, y + 8, T - 16, T - 16, 4); ctx.fill();
      ctx.strokeStyle = '#2a303d'; ctx.lineWidth = 2;
      for (var i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(x + 11, y + 14 + i * 6); ctx.lineTo(x + T - 11, y + 14 + i * 6); ctx.stroke(); }
    }
  }

  function draw(ctx, S, g, o) {
    o = o || {}; var t = S.time;
    bg(ctx, g);
    ctx.drawImage(staticLayer(S), 0, OY);
    if (S.hatch) hatch(ctx, S.hatch, t);
    for (var k in S.items) {
      var q = k % L.COLS, r = (k / L.COLS) | 0, x = q * T, y = OY + r * T, kind = S.items[k];
      ctx.save(); ctx.shadowColor = P.pw[kind]; ctx.shadowBlur = 8 + Math.sin(t * 4) * 4;
      ctx.fillStyle = '#252c3b'; rr(ctx, x + 5, y + 5, T - 10, T - 10, 7); ctx.fill(); ctx.restore();
      ctx.strokeStyle = P.pw[kind]; ctx.lineWidth = 1.5; rr(ctx, x + 5.5, y + 5.5, T - 11, T - 11, 7); ctx.stroke();
      glyph(ctx, kind, x + T / 2, y + T / 2, 0.9);
    }
    for (var i = 0; i < S.grid.length; i++) if (S.grid[i] === L.CRATE) crate(ctx, i % L.COLS, (i / L.COLS) | 0);
    S.debris.forEach(function (d) {
      ctx.globalAlpha = d.t / 0.5; ctx.fillStyle = '#c07a38';
      for (var j = 0; j < 5; j++) { var a = j * 1.3, s = (0.5 - d.t) * 50; ctx.fillRect(cx(d.x) + Math.cos(a) * s - 3, cy(d.y) + Math.sin(a) * s - 3, 6, 6); }
      ctx.globalAlpha = 1;
    });
    S.bombs.forEach(function (b) { bomb(ctx, b, t); });
    flames(ctx, S);
    S.enemies.forEach(function (e) { enemy(ctx, e, t); });
    if (S.boss && S.boss.alive) boss(ctx, S.boss, t);
    S.players.forEach(function (p) {
      if (!p.alive) return;
      if (p.inv > 0 && Math.floor(t * 12) % 2 === 0) return;
      sapper(ctx, cx(p.x), cy(p.y) - 2, p.i, p.face, p.moving ? p.walk : 0, 1);
    });
    if (o.bare) return;
    F.ui.hud(g, ctx, S, F.modern);
    F.ui.banner(g, ctx, S, F.modern);
    if (o.toasts) F.ui.toasts(g, ctx, o.toasts, P);
  }

  F.modern = { P: P, bg: bg, draw: draw, glyph: glyph, face: face };
})(typeof window !== 'undefined' ? window : globalThis);
