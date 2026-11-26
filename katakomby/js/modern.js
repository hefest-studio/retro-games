/* КАТАКОМБЫ · рендер MODERN (по умолчанию). KATAKOMBY.modern = { P, wall, floor, gate, seal, lamp, glow, item, rise,
   enemy, boss, hero, grave, hoop, spit, light, badge, heroBody }
   Переделка 2026-11 «Огненный обруч»: тёсаный серо-зелёный камень, чаши на каменных ногах (холодные — пепел,
   горящие — живой огонь и тёплый круг света), железные решётки, круглая печать спуска; обходчица в коротком
   плаще с бронзовым обручем. Логику не трогает — только читает состояние. */
(function (global) {
  'use strict';
  var K = global.KATAKOMBY = global.KATAKOMBY || {};
  var rr = function (ctx, x, y, w, h, r) { K.ui.roundRect(ctx, x, y, w, h, r); };

  var P = {
    pixel: false, font: null,
    void: '#060807', hudBg: '#0b0e0d', line: '#26302c', panel: '#121715', ink: '#eef2ec', muted: '#93a199', accent: '#ff9a3c',
    good: '#7ee08a', bad: '#ff5d6c', warn: '#ffcf4a', boss: '#c9d2e0', barBg: '#25302b',
    hero: ['#3fc7b4', '#d58cff'], up: { bnc: '#ffb35a', spd: '#5ad1ff', arm: '#b9e07a' },
    selBg: '#1e2a25', rowBg: '#161d1a', dim: 'rgba(4,6,5,.6)',
    fire: '#ffb347', fireHot: '#fff1c2', bronze: '#c7924a', lampLight: 'rgba(255,170,80,.10)',
    enemy: { shade: '#8f86ff', slime: '#66c76a', spitter: '#ff7a4a' }
  };
  function hash(x, y) { var h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

  function floor(ctx, x, y, tx, ty) {
    var v = hash(tx, ty);
    ctx.fillStyle = v < 0.33 ? '#141a17' : v < 0.66 ? '#171d1a' : '#121815'; ctx.fillRect(x, y, 32, 32);
    ctx.fillStyle = 'rgba(255,255,255,.025)'; ctx.fillRect(x + 1, y + 1, 30, 1);
    ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(x, y + 31, 32, 1); ctx.fillRect(x + 31, y, 1, 32);
    if (v > 0.88) { ctx.fillStyle = 'rgba(120,150,110,.10)'; ctx.beginPath(); ctx.ellipse(x + 10 + v * 10, y + 20, 6, 3, 0, 0, 6.29); ctx.fill(); }
  }
  function wall(ctx, x, y, tx, ty, cell) {
    var below = cell(tx, ty + 1) !== '#' && cell(tx, ty + 1) !== 'L';
    ctx.fillStyle = '#2d3732'; ctx.fillRect(x, y, 32, 32);
    var v = hash(tx * 3, ty * 7);
    ctx.fillStyle = '#38443e'; rr(ctx, x + 2, y + 2, 13 + (v * 4 | 0), below ? 11 : 13, 3); ctx.fill(); rr(ctx, x + 17 + (v * 4 | 0), y + 2, 13 - (v * 4 | 0), below ? 11 : 13, 3); ctx.fill();
    if (!below) { rr(ctx, x + 2, y + 17, 28, 13, 3); ctx.fill(); }
    if (below) {
      var gr = ctx.createLinearGradient(0, y + 14, 0, y + 32); gr.addColorStop(0, '#5a6b62'); gr.addColorStop(1, '#2b3530');
      ctx.fillStyle = gr; ctx.fillRect(x, y + 14, 32, 18);
      ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(x, y + 14, 32, 1);
      ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(x + ((tx % 2) ? 11 : 21), y + 16, 1, 15);
    }
  }
  // Решётка: тёмные прутья, обруч пролетает между ними
  function gate(ctx, x, y, horiz) {
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(x, y, 32, 32);
    ctx.strokeStyle = '#7c8792'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    for (var i = 0; i < 4; i++) { ctx.beginPath(); if (horiz) { ctx.moveTo(x + 4 + i * 8, y + 3); ctx.lineTo(x + 4 + i * 8, y + 29); } else { ctx.moveTo(x + 3, y + 4 + i * 8); ctx.lineTo(x + 29, y + 4 + i * 8); } ctx.stroke(); }
    ctx.strokeStyle = '#4d5660'; ctx.lineWidth = 4; ctx.beginPath();
    if (horiz) { ctx.moveTo(x, y + 10); ctx.lineTo(x + 32, y + 10); ctx.moveTo(x, y + 22); ctx.lineTo(x + 32, y + 22); } else { ctx.moveTo(x + 10, y); ctx.lineTo(x + 10, y + 32); ctx.moveTo(x + 22, y); ctx.lineTo(x + 22, y + 32); }
    ctx.stroke(); ctx.lineCap = 'butt';
  }
  // Печать спуска: каменный круг; закрыта — тусклые насечки, открыта — светится и видны ступени вниз
  function seal(ctx, x, y, t, open, frac) {
    var cx = x + 16, cy = y + 16;
    ctx.fillStyle = '#0b0f0d'; ctx.beginPath(); ctx.arc(cx, cy, 15, 0, 6.29); ctx.fill();
    if (open) {
      for (var i = 0; i < 4; i++) { ctx.fillStyle = 'rgba(255,190,110,' + (0.2 + i * 0.15) + ')'; ctx.fillRect(cx - 9 + i * 2, cy - 8 + i * 5, 18 - i * 4, 3); }
      ctx.save(); ctx.shadowColor = P.fire; ctx.shadowBlur = 18; ctx.strokeStyle = 'rgba(255,180,90,' + (0.6 + 0.3 * Math.sin(t * 4)) + ')'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(cx, cy, 14, 0, 6.29); ctx.stroke(); ctx.restore();
    } else {
      ctx.fillStyle = '#3b4741'; ctx.beginPath(); ctx.arc(cx, cy, 13, 0, 6.29); ctx.fill();
      var n = 8, lit = Math.round(frac * n);
      for (var k = 0; k < n; k++) { var a = -Math.PI / 2 + k * Math.PI * 2 / n; ctx.fillStyle = k < lit ? P.fire : '#1c2420'; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * 9, cy + Math.sin(a) * 9, 2, 0, 6.29); ctx.fill(); }
      ctx.fillStyle = '#26302b'; ctx.beginPath(); ctx.arc(cx, cy, 4, 0, 6.29); ctx.fill();
    }
  }
  function flame(ctx, x, y, s, t, seed) {
    var f = Math.sin(t * 11 + seed) * 0.12, g = Math.sin(t * 7.3 + seed * 2) * 0.1;
    ctx.save(); ctx.shadowColor = '#ff8a2a'; ctx.shadowBlur = 16 * s;
    ctx.fillStyle = '#ff7a22'; ctx.beginPath(); ctx.moveTo(x - 7 * s, y); ctx.quadraticCurveTo(x - 6 * s, y - 10 * s, x + g * 20 * s, y - (17 + f * 20) * s); ctx.quadraticCurveTo(x + 6 * s, y - 9 * s, x + 7 * s, y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffd36a'; ctx.beginPath(); ctx.moveTo(x - 4 * s, y); ctx.quadraticCurveTo(x - 3 * s, y - 6 * s, x - g * 10 * s, y - (11 + f * 10) * s); ctx.quadraticCurveTo(x + 3 * s, y - 5 * s, x + 4 * s, y); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  // Чаша (L) или очаг (F): каменная чаша на ноге; горит — огонь; flash — вспышка зажигания/гашения
  function lamp(ctx, l, t) {
    var x = l.x, y = l.y;
    if (l.hearth) {
      ctx.fillStyle = '#4a2f24'; rr(ctx, x - 15, y - 8, 30, 22, 5); ctx.fill();
      ctx.fillStyle = '#6a4232'; for (var i = 0; i < 3; i++) ctx.fillRect(x - 13 + i * 9, y + 1, 8, 4);
      ctx.fillStyle = '#1a0d08'; rr(ctx, x - 10, y - 5, 20, 8, 3); ctx.fill();
      flame(ctx, x, y - 2, 1.2, t, l.tx);
      return;
    }
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(x, y + 12, 10, 3.5, 0, 0, 6.29); ctx.fill();
    ctx.fillStyle = '#56645d'; ctx.fillRect(x - 3, y + 1, 6, 10); ctx.fillRect(x - 7, y + 9, 14, 3);
    ctx.fillStyle = l.lit ? '#7b6a52' : '#6b7a72'; ctx.beginPath(); ctx.moveTo(x - 13, y - 5); ctx.lineTo(x + 13, y - 5); ctx.lineTo(x + 8, y + 3); ctx.lineTo(x - 8, y + 3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = l.lit ? '#3a1a0a' : '#2b2f2d'; ctx.beginPath(); ctx.ellipse(x, y - 5, 13, 3.5, 0, 0, 6.29); ctx.fill();
    if (l.lit) flame(ctx, x, y - 5, 1, t, l.tx + l.ty);
    else { ctx.fillStyle = '#8c918e'; ctx.beginPath(); ctx.ellipse(x - 3, y - 6, 4, 1.5, 0, 0, 6.29); ctx.ellipse(x + 4, y - 5, 3, 1.2, 0, 0, 6.29); ctx.fill(); }
    if (l.flash > 0) { ctx.save(); ctx.globalAlpha = Math.min(1, l.flash * 2); ctx.strokeStyle = l.lit ? '#ffe0a0' : '#c8d0d8'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y - 4, 16 + (0.6 - l.flash) * 40, 0, 6.29); ctx.stroke(); ctx.restore(); }
  }
  // Тёплый круг света горящей чаши (зона, где тварей жжёт, а героя лечит) — под всем остальным
  function glow(ctx, l, R, t) {
    var a = 0.75 + 0.08 * Math.sin(t * 5 + l.tx);
    var gr = ctx.createRadialGradient(l.x, l.y, 6, l.x, l.y, R);
    gr.addColorStop(0, 'rgba(255,170,80,' + 0.22 * a + ')'); gr.addColorStop(0.85, 'rgba(255,140,60,' + 0.08 * a + ')'); gr.addColorStop(1, 'rgba(255,140,60,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(l.x, l.y, R, 0, 6.29); ctx.fill();
    ctx.strokeStyle = 'rgba(255,170,90,.16)'; ctx.setLineDash([4, 6]); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(l.x, l.y, R - 1, 0, 6.29); ctx.stroke(); ctx.setLineDash([]);
  }
  function item(ctx, kind, x, y, t, s) {
    s = s || 1; var bob = t ? Math.sin(t * 3 + x) * 1 : 0;
    ctx.save(); ctx.translate(x, y + bob); ctx.scale(s, s);
    if (kind === 'chest') {   // ларец-урна: разбить обручем
      ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(0, 10, 9, 3, 0, 0, 6.29); ctx.fill();
      ctx.fillStyle = '#8a6a3a'; ctx.beginPath(); ctx.ellipse(0, 2, 9, 9, 0, 0, 6.29); ctx.fill();
      ctx.fillStyle = '#a8834a'; ctx.fillRect(-5, -10, 10, 5);
      ctx.fillStyle = '#e8c070'; ctx.fillRect(-9, 0, 18, 2); ctx.save(); ctx.shadowColor = '#ffd27a'; ctx.shadowBlur = 8; ctx.beginPath(); ctx.arc(0, 1, 2.5, 0, 6.29); ctx.fill(); ctx.restore();
    } else if (kind === 'lamp') {   // значок для HUD
      ctx.fillStyle = '#6b7a72'; ctx.beginPath(); ctx.moveTo(-9, -1); ctx.lineTo(9, -1); ctx.lineTo(5, 5); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill();
      ctx.fillRect(-2, 5, 4, 5);
      flame(ctx, 0, -1, 0.7, t || 0, 1);
    }
    ctx.restore();
  }
  // Тьма вздымается: тварь вот-вот поднимется (0,8 с предупреждения)
  function rise(ctx, R, t) {
    var k = 1 - R.t / 0.8, col = P.enemy[R.kind];
    ctx.save(); ctx.globalAlpha = 0.35 + 0.5 * k; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(R.x, R.y + 6, 6 + 9 * k, 3 + 4 * k, 0, 0, 6.29); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(R.x, R.y + 6, 6 + 9 * k, 3 + 4 * k, 0, t * 6, t * 6 + 4); ctx.stroke();
    ctx.restore();
  }
  function eyes(ctx, x, y, vx, vy, gap, col) {
    ctx.fillStyle = col || '#fff';
    ctx.beginPath(); ctx.arc(x - gap + vx * 2, y + vy * 2, 2.2, 0, 6.29); ctx.arc(x + gap + vx * 2, y + vy * 2, 2.2, 0, 6.29); ctx.fill();
  }
  function enemy(ctx, e, t) {
    var x = e.x, y = e.y, col = e.flash > 0 ? '#ffffff' : P.enemy[e.type];
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(x, y + e.r - 1, e.r, 3.5, 0, 0, 6.29); ctx.fill();
    if (e.type === 'shade') {   // клубок дыма с хвостом
      var w = Math.sin(e.wob) * 2;
      ctx.save(); ctx.globalAlpha = 0.88; ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(x - 3, y - 2, 7, 0, 6.29); ctx.arc(x + 4, y - 4, 6, 0, 6.29); ctx.arc(x + 1, y + 3, 6, 0, 6.29); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x - 4, y + 6); ctx.quadraticCurveTo(x - e.vx * 14 + w, y + 10 - e.vy * 10, x - e.vx * 18 - w, y + 4 - e.vy * 16); ctx.lineTo(x + 3, y + 5); ctx.fill(); ctx.restore();
      eyes(ctx, x, y - 3, e.vx, e.vy, 3.5, '#fff6d8');
    } else if (e.type === 'slime') {
      var sq = 1 + Math.sin(e.wob * 1.3) * 0.08;
      ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(x, y + 2, 13 * sq, 11 / sq, 0, Math.PI, 0); ctx.lineTo(x + 13 * sq, y + 8); ctx.lineTo(x - 13 * sq, y + 8); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.beginPath(); ctx.ellipse(x - 5, y - 4, 4, 2.5, -0.4, 0, 6.29); ctx.fill();
      eyes(ctx, x, y, e.vx, e.vy, 4, '#0f1d0e');
    } else {   // плевун — колючий шар с хоботком
      ctx.fillStyle = col;
      for (var i = 0; i < 8; i++) { var a = i * 0.785 + e.wob * 0.2; ctx.beginPath(); ctx.moveTo(x + Math.cos(a - 0.25) * 9, y + Math.sin(a - 0.25) * 9); ctx.lineTo(x + Math.cos(a) * 14, y + Math.sin(a) * 14); ctx.lineTo(x + Math.cos(a + 0.25) * 9, y + Math.sin(a + 0.25) * 9); ctx.fill(); }
      ctx.beginPath(); ctx.arc(x, y, 10, 0, 6.29); ctx.fill();
      ctx.fillStyle = '#2a0f08'; ctx.beginPath(); ctx.arc(x + e.vx * 5, y + 2 + e.vy * 4, 3.5, 0, 6.29); ctx.fill();
      eyes(ctx, x, y - 4, e.vx, e.vy, 4, '#fff2c0');
    }
    if (e.lit) {   // в свете чаши — тлеет
      ctx.save(); ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 20 + e.wob); ctx.fillStyle = '#ffb347';
      for (var k = 0; k < 3; k++) { var ex = x + Math.sin(t * 5 + k * 2 + e.wob) * 7, ey = y - 6 - ((t * 30 + k * 9) % 14); ctx.fillRect(ex, ey, 2, 2); }
      ctx.restore();
    }
  }
  // Дымный Страж: клубящееся облако дыма с ядром-углём; перед «выдохом» набухает и светлеет; после удара — каменный панцирь
  function boss(ctx, B, t) {
    var x = B.x, y = B.y, r = B.r;
    if (B.dead) ctx.globalAlpha = Math.max(0, 1 - B.deadT / 2);
    var warn = !B.dead && B.gustT < K.logic.BOSS.gustWarn, sw = warn ? 1 + (K.logic.BOSS.gustWarn - B.gustT) * 0.16 : 1;
    ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.ellipse(x, y + r - 2, r, 7, 0, 0, 6.29); ctx.fill();
    for (var i = 0; i < 9; i++) {
      var a = i * 0.698 + t * 0.6, d = r * 0.55 * sw, pr = r * (0.45 + 0.1 * Math.sin(t * 2 + i)) * sw;
      ctx.fillStyle = B.flash > 0 ? '#ffffff' : warn ? 'rgba(220,226,236,.9)' : 'rgba(130,138,152,.85)';
      ctx.beginPath(); ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8, pr, 0, 6.29); ctx.fill();
    }
    ctx.fillStyle = warn ? '#e8ecf2' : '#5d6472'; ctx.beginPath(); ctx.arc(x, y, r * 0.62 * sw, 0, 6.29); ctx.fill();
    ctx.save(); ctx.shadowColor = '#ff6a2a'; ctx.shadowBlur = 18;
    ctx.fillStyle = '#ff7a2a'; ctx.beginPath(); ctx.arc(x - 8, y - 3, 3.5, 0, 6.29); ctx.arc(x + 8, y - 3, 3.5, 0, 6.29); ctx.fill();
    ctx.fillStyle = '#ffb15a'; ctx.beginPath(); ctx.ellipse(x, y + 8, 7, 2 + Math.abs(Math.sin(t * 3)) * 2, 0, 0, 6.29); ctx.fill();
    ctx.restore();
    if (B.guardT > 0 && !B.dead) { ctx.strokeStyle = 'rgba(200,210,225,' + Math.min(1, B.guardT) * 0.8 + ')'; ctx.lineWidth = 3; ctx.setLineDash([6, 5]); ctx.beginPath(); ctx.arc(x, y, r + 8, t * 2, t * 2 + 6.29); ctx.stroke(); ctx.setLineDash([]); }
    ctx.globalAlpha = 1;
  }
  // Обходчица: короткий плащ (цвет игрока), светлая повязка, сумка с маслом; обруч — отдельно (hoop)
  function heroBody(ctx, x, y, fx, fy, col, s, hot) {
    s = s || 1;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    var a = Math.atan2(fy, fx);
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-9, 9); ctx.lineTo(-7, -4); ctx.quadraticCurveTo(0, -10, 7, -4); ctx.lineTo(9, 9); ctx.quadraticCurveTo(0, 12, -9, 9); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(-1, -2, 2, 10);
    ctx.fillStyle = '#e8d6b8'; ctx.beginPath(); ctx.arc(fx * 1.5, -6 + fy * 1.5, 5.5, 0, 6.29); ctx.fill();
    ctx.fillStyle = '#e9edf0'; ctx.fillRect(-6 + fx * 1.5, -9 + fy * 1.5, 12, 3);
    ctx.fillStyle = '#1b1410'; ctx.fillRect(-3 + fx * 3, -6 + fy * 3, 2, 2); ctx.fillRect(1 + fx * 3, -6 + fy * 3, 2, 2);
    ctx.save(); ctx.rotate(a); ctx.fillStyle = '#7a5a34'; rr(ctx, -10, 2, 6, 6, 2); ctx.fill(); ctx.restore();
    ctx.restore();
  }
  function hoopRing(ctx, x, y, spin, hot, s) {
    s = s || 1; var w = 7 * s, h = 7 * s * (0.55 + 0.45 * Math.abs(Math.cos(spin)));
    ctx.save();
    if (hot) { ctx.shadowColor = '#ff8a2a'; ctx.shadowBlur = 14; }
    ctx.strokeStyle = hot ? '#ffcf7a' : P.bronze; ctx.lineWidth = 2.6 * s;
    ctx.beginPath(); ctx.ellipse(x, y, w, h, spin * 0.3, 0, 6.29); ctx.stroke();
    if (hot) { ctx.strokeStyle = 'rgba(255,120,40,.7)'; ctx.lineWidth = 1.2 * s; ctx.beginPath(); ctx.ellipse(x, y, w + 2, h + 2, spin * 0.3, 0, 6.29); ctx.stroke(); }
    ctx.restore();
  }
  function hero(ctx, h, t) {
    var col = P.hero[h.id];
    ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.ellipse(h.x, h.y + 10, 10, 3.5, 0, 0, 6.29); ctx.fill();
    if (h.hurtT > 0 && Math.floor(t * 30) % 2) col = '#ffffff';
    heroBody(ctx, h.x, h.y + (h.moving ? Math.sin(t * 14) * 1 : 0), h.face.x, h.face.y, col, 1);
    if (h.leashed) { ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(h.x, h.y, 16, 0, 6.29); ctx.stroke(); ctx.setLineDash([]); }
  }
  // Обруч: в руке — у бока героя, в полёте — вращается; горящий — с огненным следом
  function hoop(ctx, h, t) {
    var o = h.hoop, hot = o.hot > 0;
    if (o.state !== 'held' && hot) {
      ctx.save(); ctx.globalAlpha = 0.45; ctx.strokeStyle = '#ff8a2a'; ctx.lineWidth = 5; ctx.lineCap = 'round';
      var l = Math.hypot(o.vx, o.vy) || 1; ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(o.x - o.vx / l * 16, o.y - o.vy / l * 16); ctx.stroke(); ctx.restore();
    }
    if (hot && o.hot < 2 && Math.floor(t * 8) % 2) hot = false;   // гаснет — мигает
    hoopRing(ctx, o.x, o.y, o.spin, hot, o.state === 'held' ? 0.9 : 1.15);
    if (hot && o.state === 'held') flameSmall(ctx, o.x, o.y - 4, t);
  }
  function flameSmall(ctx, x, y, t) { ctx.save(); ctx.globalAlpha = 0.9; flame(ctx, x, y + 3, 0.45, t, x); ctx.restore(); }
  function grave(ctx, h) {
    ctx.strokeStyle = P.bronze; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(h.x, h.y + 6, 8, 3, 0, 0, 6.29); ctx.stroke();
    ctx.fillStyle = 'rgba(180,190,185,.35)'; ctx.beginPath(); ctx.arc(h.x, h.y - 2, 6, 0, 6.29); ctx.fill();
  }
  function spit(ctx, s) {
    ctx.save(); ctx.shadowColor = '#7aa0ff'; ctx.shadowBlur = 10; ctx.fillStyle = '#6f8cff';
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.29); ctx.fill(); ctx.fillStyle = '#dbe4ff'; ctx.beginPath(); ctx.arc(s.x - 1, s.y - 1, s.r * 0.4, 0, 6.29); ctx.fill(); ctx.restore();
  }
  // Тьма: вне света героев и чаш — темно; горящие чаши дают большой тёплый круг, горящий обруч — малый
  var lc = null;
  function light(ctx, S) {
    var L = K.logic, W = L.VIEW_W, H = L.VIEW_H;
    if (!lc && typeof document !== 'undefined') { lc = document.createElement('canvas'); lc.width = W; lc.height = H; }
    if (!lc) return;
    var x = lc.getContext('2d');
    x.globalCompositeOperation = 'source-over'; x.clearRect(0, 0, W, H);
    x.fillStyle = 'rgba(3,4,4,.8)'; x.fillRect(0, 0, W, H);
    x.globalCompositeOperation = 'destination-out';
    function hole(px, py, r, a) {
      var gx = px - S.cam.x, gy = py - S.cam.y; if (gx < -r || gy < -r || gx > W + r || gy > H + r) return;
      var gr = x.createRadialGradient(gx, gy, r * 0.2, gx, gy, r); gr.addColorStop(0, 'rgba(0,0,0,' + a + ')'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = gr; x.fillRect(gx - r, gy - r, r * 2, r * 2);
    }
    S.heroes.forEach(function (h) { if (h.alive && !h.ghost) { hole(h.x, h.y, 190, 0.95); if (h.hoop.hot > 0 && h.hoop.state !== 'held') hole(h.hoop.x, h.hoop.y, 70, 0.6); } });
    S.lamps.forEach(function (l) { if (l.lit) hole(l.x, l.y, L.LIGHT_R * 1.6, 1); else hole(l.x, l.y, 28, 0.35); });
    if (S.exit) hole(S.exit.x, S.exit.y, S.sealOpen ? 110 : 40, S.sealOpen ? 0.9 : 0.4);
    if (S.boss && !S.boss.dead) hole(S.boss.x, S.boss.y, 150, 0.7);
    if (S.ghostLight) hole(S.ghostLight.x, S.ghostLight.y, 260, 0.9);
    ctx.drawImage(lc, 0, L.HUD);
  }
  function badge(ctx, x, y, pi) { heroBody(ctx, x, y + 2, 1, 0, P.hero[pi], 0.75); }

  K.modern = { P: P, wall: wall, floor: floor, gate: gate, seal: seal, lamp: lamp, glow: glow, item: item, rise: rise, enemy: enemy, boss: boss,
    hero: hero, hoop: hoop, hoopRing: hoopRing, grave: grave, spit: spit, light: light, badge: badge, heroBody: heroBody };
})(typeof window !== 'undefined' ? window : globalThis);
