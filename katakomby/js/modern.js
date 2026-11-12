/* КАТАКОМБЫ · рендер MODERN (по умолчанию). KATAKOMBY.modern = { P, wall, floor, door, exit, item, lair,
   enemy, boss, hero, grave, shot, spit, swing, light, badge }
   Мрачные катакомбы: тёсаный камень с объёмом, тьма вокруг и свет факела у героев,
   светящиеся логова, мягкие тени. Логику не трогает — только читает состояние. */
(function (global) {
  'use strict';
  var K = global.KATAKOMBY = global.KATAKOMBY || {};
  var rr = function (ctx, x, y, w, h, r) { K.ui.roundRect(ctx, x, y, w, h, r); };

  var P = {
    pixel: false, font: null,
    void: '#07060a', hudBg: '#0d0b11', line: '#2a2433', panel: '#15121b', ink: '#efe9f4', muted: '#9a90a8', accent: '#f0a64a',
    good: '#58d68d', bad: '#ff5d6c', warn: '#ffc04a', boss: '#ff5a8a', barBg: '#2a2433',
    hero: ['#f0a64a', '#56c8ff'], up: { str: '#ff7a5a', spd: '#56c8ff', arm: '#c9b8ff' },
    selBg: '#2a2236', rowBg: '#1b1722', dim: 'rgba(5,4,8,.55)', bombFlash: 'rgba(255,240,200,.55)',
    enemy: { shade: '#9b7bff', slime: '#5fd36a', spitter: '#ff7a4a' }
  };
  function hash(x, y) { var h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

  function floor(ctx, x, y, tx, ty) {
    var v = hash(tx, ty), base = v < 0.33 ? '#17141c' : v < 0.66 ? '#1a1720' : '#15121a';
    ctx.fillStyle = base; ctx.fillRect(x, y, 32, 32);
    ctx.fillStyle = 'rgba(255,255,255,.025)'; ctx.fillRect(x + 1, y + 1, 30, 1);
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x, y + 31, 32, 1); ctx.fillRect(x + 31, y, 1, 32);
    if (v > 0.86) { ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + 6, y + 10 + v * 8); ctx.lineTo(x + 15, y + 15); ctx.lineTo(x + 24, y + 12 + v * 10); ctx.stroke(); }
  }
  function wall(ctx, x, y, tx, ty, cell) {
    var below = cell(tx, ty + 1) !== '#';
    ctx.fillStyle = '#3b3447'; ctx.fillRect(x, y, 32, 32);
    // верх стены — кладка
    var off = (ty % 2) * 8;
    ctx.fillStyle = '#4a4159'; for (var i = -1; i < 2; i++) ctx.fillRect(x + off + i * 16 + 1, y + 1, 14, below ? 13 : 14);
    if (!below) { for (var j = -1; j < 2; j++) ctx.fillRect(x + (8 - off) + j * 16 + 1, y + 17, 14, 14); }
    if (below) {   // лицевая грань — объём
      var gr = ctx.createLinearGradient(0, y + 14, 0, y + 32); gr.addColorStop(0, '#6a5f7c'); gr.addColorStop(1, '#3a3246');
      ctx.fillStyle = gr; ctx.fillRect(x, y + 14, 32, 18);
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x + ((tx % 2) ? 10 : 22), y + 15, 1, 16);
      ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fillRect(x, y + 14, 32, 1);
    }
  }
  function door(ctx, x, y, horiz) {
    ctx.fillStyle = '#4a2f1a'; rr(ctx, x + 2, y + 2, 28, 28, 4); ctx.fill();
    ctx.fillStyle = '#6b4526';
    if (horiz) { for (var i = 0; i < 3; i++) ctx.fillRect(x + 4, y + 5 + i * 8, 24, 5); } else { for (var j = 0; j < 3; j++) ctx.fillRect(x + 5 + j * 8, y + 4, 5, 24); }
    ctx.fillStyle = '#e0b445'; ctx.beginPath(); ctx.arc(x + 16, y + 16, 4, 0, 6.29); ctx.fill();
    ctx.fillStyle = '#2a1a0e'; ctx.fillRect(x + 15, y + 16, 2, 5);
  }
  function exit(ctx, x, y, t) {
    ctx.fillStyle = '#0b0a10'; rr(ctx, x + 2, y + 2, 28, 28, 4); ctx.fill();
    for (var i = 0; i < 4; i++) { ctx.fillStyle = 'rgba(120,200,255,' + (0.18 + i * 0.12) + ')'; ctx.fillRect(x + 5 + i * 2, y + 6 + i * 6, 22 - i * 4, 4); }
    var a = 0.35 + 0.25 * Math.sin(t * 3);
    ctx.save(); ctx.shadowColor = '#7ad0ff'; ctx.shadowBlur = 16; ctx.strokeStyle = 'rgba(122,208,255,' + a + ')'; ctx.lineWidth = 2; rr(ctx, x + 2, y + 2, 28, 28, 5); ctx.stroke(); ctx.restore();
  }
  function item(ctx, kind, x, y, t, s) {
    s = s || 1; var bob = t ? Math.sin(t * 3 + x) * 1.5 : 0;
    ctx.save(); ctx.translate(x, y + bob); ctx.scale(s, s);
    if (kind === 'key') {
      ctx.shadowColor = '#ffd25a'; ctx.shadowBlur = 10; ctx.fillStyle = '#ffd25a';
      ctx.beginPath(); ctx.arc(-5, 0, 5, 0, 6.29); ctx.fill(); ctx.fillRect(-1, -1.5, 12, 3); ctx.fillRect(7, 1, 2, 4); ctx.fillRect(3, 1, 2, 3);
      ctx.fillStyle = '#7a5a10'; ctx.beginPath(); ctx.arc(-5, 0, 2, 0, 6.29); ctx.fill();
    } else if (kind === 'chest') {
      ctx.fillStyle = '#7a4a22'; rr(ctx, -11, -7, 22, 15, 3); ctx.fill();
      ctx.fillStyle = '#9a6030'; rr(ctx, -11, -9, 22, 7, 3); ctx.fill();
      ctx.fillStyle = '#e0b445'; ctx.fillRect(-11, -3, 22, 2); ctx.fillRect(-2, -4, 4, 6);
    } else if (kind === 'food') {
      ctx.fillStyle = '#d8a45a'; ctx.beginPath(); ctx.ellipse(0, 1, 10, 7, 0, 0, 6.29); ctx.fill();
      ctx.fillStyle = '#b07a38'; ctx.beginPath(); ctx.ellipse(0, -1, 9, 5, 0, 0, 6.29); ctx.fill();
      ctx.strokeStyle = '#f2d39a'; ctx.lineWidth = 1.5; for (var i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * 4 - 2, -3); ctx.lineTo(i * 4 + 2, 1); ctx.stroke(); }
    } else if (kind === 'potion') {
      ctx.shadowColor = '#7a8cff'; ctx.shadowBlur = 10;
      ctx.fillStyle = '#5a6cff'; ctx.beginPath(); ctx.arc(0, 3, 7, 0, 6.29); ctx.fill();
      ctx.fillStyle = '#9aa6ff'; ctx.fillRect(-2.5, -8, 5, 6);
      ctx.fillStyle = '#c99a5a'; ctx.fillRect(-3, -10, 6, 3);
      ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.arc(-2.5, 1, 2, 0, 6.29); ctx.fill();
    }
    ctx.restore();
  }
  function lair(ctx, l, t) {
    var x = l.x, y = l.y, col = P.enemy[l.kind];
    if (l.hp <= 0) { ctx.fillStyle = '#121016'; ctx.beginPath(); ctx.ellipse(x, y + 4, 13, 8, 0, 0, 6.29); ctx.fill(); return; }
    var f = l.hp / l.max;
    ctx.fillStyle = '#3a3344'; rr(ctx, x - 15, y - 13, 30, 28, 8); ctx.fill();
    ctx.fillStyle = '#4a4256'; rr(ctx, x - 13, y - 13, 26, 10, 5); ctx.fill();
    ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 14 + 6 * Math.sin(t * 4);
    ctx.fillStyle = l.flash > 0 ? '#ffffff' : col; ctx.beginPath(); ctx.ellipse(x, y + 3, 9, 6, 0, 0, 6.29); ctx.fill(); ctx.restore();
    ctx.fillStyle = '#0b0a10'; ctx.beginPath(); ctx.ellipse(x, y + 4, 5, 3, 0, 0, 6.29); ctx.fill();
    // трещины по мере разрушения
    ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 1.5;
    if (f < 0.75) { ctx.beginPath(); ctx.moveTo(x - 12, y - 8); ctx.lineTo(x - 5, y - 2); ctx.stroke(); }
    if (f < 0.5) { ctx.beginPath(); ctx.moveTo(x + 13, y - 6); ctx.lineTo(x + 6, y + 1); ctx.lineTo(x + 10, y + 10); ctx.stroke(); }
    if (f < 0.25) { ctx.beginPath(); ctx.moveTo(x - 4, y - 13); ctx.lineTo(x + 2, y - 6); ctx.stroke(); }
  }
  function eyes(ctx, x, y, vx, vy, gap, col) {
    ctx.fillStyle = col || '#fff';
    ctx.beginPath(); ctx.arc(x - gap + vx * 2, y + vy * 2, 2.2, 0, 6.29); ctx.arc(x + gap + vx * 2, y + vy * 2, 2.2, 0, 6.29); ctx.fill();
  }
  function enemy(ctx, e, t) {
    var x = e.x, y = e.y, col = e.flash > 0 ? '#ffffff' : P.enemy[e.type];
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(x, y + e.r - 1, e.r, 3.5, 0, 0, 6.29); ctx.fill();
    if (e.type === 'shade') {
      var w = Math.sin(e.wob) * 2;
      ctx.save(); ctx.globalAlpha = 0.9; ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(x - 10, y + 8); ctx.quadraticCurveTo(x - 12, y - 12, x, y - 12); ctx.quadraticCurveTo(x + 12, y - 12, x + 10, y + 8);
      ctx.lineTo(x + 5 + w, y + 4); ctx.lineTo(x, y + 9); ctx.lineTo(x - 5 - w, y + 4); ctx.closePath(); ctx.fill(); ctx.restore();
      eyes(ctx, x, y - 3, e.vx, e.vy, 4, '#ffe3ff');
    } else if (e.type === 'slime') {
      var sq = 1 + Math.sin(e.wob * 1.3) * 0.08;
      ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(x, y + 2, 13 * sq, 11 / sq, 0, Math.PI, 0); ctx.lineTo(x + 13 * sq, y + 8); ctx.lineTo(x - 13 * sq, y + 8); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(x - 5, y - 4, 4, 2.5, -0.4, 0, 6.29); ctx.fill();
      eyes(ctx, x, y, e.vx, e.vy, 4, '#10200f');
    } else {
      ctx.fillStyle = col; rr(ctx, x - 11, y - 9, 22, 18, 7); ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 2;
      for (var i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(x + i * 7, y + 8); ctx.lineTo(x + i * 9, y + 13); ctx.stroke(); }
      ctx.fillStyle = '#2a0f08'; ctx.beginPath(); ctx.arc(x + e.vx * 6, y + 1 + e.vy * 4, 4, 0, 6.29); ctx.fill();
      eyes(ctx, x, y - 4, e.vx, e.vy, 5, '#fff2c0');
    }
  }
  function boss(ctx, B, t) {
    var x = B.x, y = B.y, r = B.r;
    if (B.dead) { var a = Math.max(0, 1 - B.deadT / 2); ctx.globalAlpha = a; }
    var swell = B.ringT < 0.7 && !B.dead ? 1 + (0.7 - B.ringT) * 0.18 : 1;
    ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.ellipse(x, y + r - 2, r, 7, 0, 0, 6.29); ctx.fill();
    ctx.save(); ctx.shadowColor = '#ff3a6a'; ctx.shadowBlur = B.ringT < 0.7 ? 30 : 14;
    var gr = ctx.createRadialGradient(x - 8, y - 10, 4, x, y, r * swell);
    gr.addColorStop(0, B.flash > 0 ? '#ffffff' : '#c45a8a'); gr.addColorStop(1, B.flash > 0 ? '#ffd0e0' : '#4a1a34');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, r * swell, 0, 6.29); ctx.fill(); ctx.restore();
    // каменная корона
    ctx.fillStyle = '#5a5266';
    for (var i = 0; i < 5; i++) { var a2 = -Math.PI / 2 + (i - 2) * 0.42; ctx.beginPath(); ctx.moveTo(x + Math.cos(a2 - 0.15) * r * 0.9, y + Math.sin(a2 - 0.15) * r * 0.9); ctx.lineTo(x + Math.cos(a2) * (r + 12), y + Math.sin(a2) * (r + 12)); ctx.lineTo(x + Math.cos(a2 + 0.15) * r * 0.9, y + Math.sin(a2 + 0.15) * r * 0.9); ctx.fill(); }
    // глаза
    for (var k = 0; k < 3; k++) { var ex = x + (k - 1) * 11, ey = y - 4 + (k === 1 ? -5 : 0); ctx.fillStyle = '#ffe6a0'; ctx.beginPath(); ctx.arc(ex, ey, 4, 0, 6.29); ctx.fill(); ctx.fillStyle = '#300'; ctx.beginPath(); ctx.arc(ex, ey + 1, 1.8, 0, 6.29); ctx.fill(); }
    ctx.fillStyle = '#1a0610'; ctx.beginPath(); ctx.ellipse(x, y + 12, 10, 4 + Math.sin(t * 6) * 2, 0, 0, 6.29); ctx.fill();
    ctx.globalAlpha = 1;
  }
  function heroBody(ctx, cls, x, y, fx, fy, col, s) {
    s = s || 1;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    if (cls === 'smith') {
      ctx.fillStyle = col; rr(ctx, -9, -9, 18, 18, 5); ctx.fill();
      ctx.fillStyle = '#3a2a1a'; rr(ctx, -6, -11, 12, 6, 3); ctx.fill();               // шапка-капюшон
      ctx.fillStyle = '#ffe2c0'; ctx.fillRect(-4 + fx * 2, -4 + fy * 2, 2, 2); ctx.fillRect(2 + fx * 2, -4 + fy * 2, 2, 2);
      // щит — с противоположной от удара стороны (слева от взгляда)
      ctx.fillStyle = '#8a8fa0'; ctx.save(); ctx.rotate(Math.atan2(fy, fx)); rr(ctx, -4, -14, 10, 7, 2); ctx.fill();
      ctx.fillStyle = '#5a5f70'; ctx.fillRect(0, -12, 2, 3);
      ctx.fillStyle = '#6a4a2a'; ctx.fillRect(6, 3, 10, 3); ctx.fillStyle = '#b8bcc8'; ctx.fillRect(14, 0, 6, 9);   // молот
      ctx.restore();
    } else {
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 1, 9, 0, 6.29); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-8, -3); ctx.lineTo(0, -15); ctx.lineTo(8, -3); ctx.closePath(); ctx.fill();   // острый капюшон
      ctx.fillStyle = '#10141c'; ctx.beginPath(); ctx.arc(fx * 2, fy * 2 - 1, 5, 0, 6.29); ctx.fill();
      ctx.fillStyle = '#bff0ff'; ctx.fillRect(-3 + fx * 2, -2 + fy * 2, 2, 2); ctx.fillRect(1 + fx * 2, -2 + fy * 2, 2, 2);
      ctx.save(); ctx.shadowColor = '#ffe680'; ctx.shadowBlur = 10; ctx.fillStyle = '#ffe680';
      ctx.beginPath(); ctx.arc(fx * 13, fy * 13, 3.2, 0, 6.29); ctx.fill(); ctx.restore();
    }
    ctx.restore();
  }
  function hero(ctx, h, t, players) {
    var col = P.hero[h.id];
    ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.ellipse(h.x, h.y + 10, 10, 3.5, 0, 0, 6.29); ctx.fill();
    if (h.hurtT > 0 && Math.floor(t * 30) % 2) col = '#ffffff';
    heroBody(ctx, h.cls, h.x, h.y + (h.moving ? Math.sin(t * 14) * 1 : 0), h.face.x, h.face.y, col);
    if (h.leashed) { ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(h.x, h.y, 16, 0, 6.29); ctx.stroke(); ctx.setLineDash([]); }
  }
  function grave(ctx, h) {
    ctx.fillStyle = '#3a3344'; rr(ctx, h.x - 7, h.y - 9, 14, 18, 6); ctx.fill();
    ctx.fillStyle = '#5a5266'; ctx.fillRect(h.x - 1, h.y - 6, 2, 9); ctx.fillRect(h.x - 4, h.y - 3, 8, 2);
  }
  function shot(ctx, s) {
    ctx.save(); ctx.shadowColor = '#ffe680'; ctx.shadowBlur = 12; ctx.fillStyle = '#fff3b0';
    ctx.beginPath(); ctx.arc(s.x, s.y, 4, 0, 6.29); ctx.fill();
    ctx.strokeStyle = 'rgba(255,230,128,.5)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx * 0.03, s.y - s.vy * 0.03); ctx.stroke();
    ctx.restore();
  }
  function spit(ctx, s, t) {
    ctx.save(); ctx.shadowColor = '#ff3a6a'; ctx.shadowBlur = 10; ctx.fillStyle = '#ff6a8a';
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.29); ctx.fill(); ctx.fillStyle = '#ffd0dc'; ctx.beginPath(); ctx.arc(s.x - 1, s.y - 1, s.r * 0.4, 0, 6.29); ctx.fill(); ctx.restore();
  }
  function swing(ctx, w) {
    var a = Math.atan2(w.fy, w.fx), k = w.t / 0.16;
    ctx.save(); ctx.globalAlpha = k * 0.8; ctx.strokeStyle = '#ffe2b0'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(w.x - w.fx * 16, w.y - w.fy * 16, w.r, a - 1 + (1 - k) * 0.6, a + 1 - (1 - k) * 0.6); ctx.stroke(); ctx.restore();
  }
  // Тьма катакомб и свет факелов у героев (выход и логова слегка светятся)
  var lc = null;
  function light(ctx, S, g) {
    var L = K.logic, W = L.VIEW_W, H = L.VIEW_H;
    if (!lc && typeof document !== 'undefined') { lc = document.createElement('canvas'); lc.width = W; lc.height = H; }
    if (!lc) return;
    var x = lc.getContext('2d');
    x.globalCompositeOperation = 'source-over'; x.clearRect(0, 0, W, H);
    x.fillStyle = 'rgba(4,3,8,.72)'; x.fillRect(0, 0, W, H);
    x.globalCompositeOperation = 'destination-out';
    function hole(px, py, r, a) {
      var gx = px - S.cam.x, gy = py - S.cam.y; if (gx < -r || gy < -r || gx > W + r || gy > H + r) return;
      var gr = x.createRadialGradient(gx, gy, r * 0.15, gx, gy, r); gr.addColorStop(0, 'rgba(0,0,0,' + a + ')'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = gr; x.fillRect(gx - r, gy - r, r * 2, r * 2);
    }
    var flick = 1 + Math.sin(S.time * 9) * 0.02;
    S.heroes.forEach(function (h) { if (h.alive) hole(h.x, h.y, 300 * flick, 1); });
    if (S.exit) hole(S.exit.x, S.exit.y, 90, 0.8);
    S.lairs.forEach(function (l) { if (l.hp > 0) hole(l.x, l.y, 60, 0.5); });
    if (S.boss && !S.boss.dead) hole(S.boss.x, S.boss.y, 140, 0.8);
    S.shots.forEach(function (s) { hole(s.x, s.y, 40, 0.5); });
    ctx.drawImage(lc, 0, L.HUD);
  }
  function badge(ctx, cls, x, y, pi) { heroBody(ctx, cls, x, y + 1, 1, 0, P.hero[pi], 0.75); }

  K.modern = { P: P, wall: wall, floor: floor, door: door, exit: exit, item: item, lair: lair, enemy: enemy, boss: boss,
    hero: hero, grave: grave, shot: shot, spit: spit, swing: swing, light: light, badge: badge, heroBody: heroBody };
})(typeof window !== 'undefined' ? window : globalThis);
