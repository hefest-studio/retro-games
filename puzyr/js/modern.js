/* ПУЗЫРЬ · рендер MODERN (по умолчанию). PUZYR.modern = { P, bg, draw, face, item }
   Мастерская стеклодувов: тёплый полумрак, кирпич/огнеупор/стекло/сталь/мрамор по зонам, стеклянные шары
   с бликом и радужной кромкой, мягкое свечение спецшаров. Логику не трогает — только читает состояние. */
(function (global) {
  'use strict';
  var Z = global.PUZYR = global.PUZYR || {};
  var L = Z.logic, T = 20, OY = 40;

  var P = {
    pixel: false, font: null,
    hudBg: '#120f19', hudLine: '#2a2236', ink: '#f4efe8', muted: '#a59cb4', dim: '#4a4256', accent: '#ffb347', good: '#5ee08f', bad: '#ff5d6c',
    letter: '#ffd166', panel: '#1a1524', line: '#3a3048', bar: '#3a3048', bossBar: '#ff6a3d',
    pl: ['#ffb347', '#4fd1c5'], plDark: ['#c46a1e', '#1f8f84'],
    en: { cog: '#9fb3cc', spring: '#9be15d', soot: '#6e6488', spark: '#ff7a3d' },
    sp: { fire: '#ff7a2f', water: '#4fb3ff', bolt: '#ffe14d', letter: '#ffffff' }
  };
  var ZONE = {
    workshop: { bg: ['#211827', '#120d17'], base: '#a85a34', top: '#e39158', dark: '#5e2f1b', glow: 'rgba(255,170,90,.06)' },
    kiln:     { bg: ['#2a1416', '#140a0b'], base: '#9c3b2e', top: '#e0694f', dark: '#561b15', glow: 'rgba(255,110,60,.07)' },
    glass:    { bg: ['#0f2226', '#081316'], base: '#2f8f8c', top: '#86e3da', dark: '#174a49', glow: 'rgba(120,230,220,.06)' },
    pipes:    { bg: ['#161c26', '#0b0f15'], base: '#5a6b80', top: '#a6b8cf', dark: '#2c3543', glow: 'rgba(160,190,230,.05)' },
    dome:     { bg: ['#1b1630', '#0d0b19'], base: '#7c6fb0', top: '#c9bdf2', dark: '#3e3566', glow: 'rgba(190,170,255,.06)' },
    boss:     { bg: ['#230f10', '#0c0607'], base: '#4b4452', top: '#8a8094', dark: '#241f29', glow: 'rgba(255,90,40,.08)' }
  };
  var rr = function (ctx, x, y, w, h, r) { Z.ui.roundRect(ctx, x, y, w, h, r); };
  function X(x) { return x * T; }
  function Y(y) { return OY + y * T; }
  var curZone = 'workshop';

  // ---------- Фон канвы ----------
  function bg(ctx, g) {
    var zc = ZONE[curZone] || ZONE.workshop, gr = ctx.createLinearGradient(0, 0, 0, g.H);
    gr.addColorStop(0, zc.bg[0]); gr.addColorStop(1, zc.bg[1]);
    ctx.fillStyle = gr; ctx.fillRect(0, 0, g.W, g.H);
  }

  // ---------- Статичный слой уровня (декор + блоки), кэш по уровню и зоне ----------
  var cache = null, cacheKey = '';
  function staticLayer(S) {
    var key = S.level + ':' + S.zone;
    if (cache && key === cacheKey) return cache;
    var c = document.createElement('canvas'); c.width = L.COLS * T; c.height = L.ROWS * T;
    var x = c.getContext('2d'), zc = ZONE[S.zone] || ZONE.workshop, W = c.width, H = c.height, i;
    var gr = x.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, zc.bg[0]); gr.addColorStop(1, zc.bg[1]);
    x.fillStyle = gr; x.fillRect(0, 0, W, H);
    // декор зоны (приглушённо)
    var seed = S.level * 97 + 13, rnd = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    x.save(); x.globalAlpha = 0.5;
    if (S.zone === 'pipes') {
      for (i = 0; i < 7; i++) { var px = 60 + i * 85 + rnd() * 20; x.fillStyle = 'rgba(160,190,230,.05)'; x.fillRect(px, 0, 14, H); x.fillStyle = 'rgba(160,190,230,.08)'; for (var k = 0; k < 6; k++) x.fillRect(px - 3, 40 + k * 80 + rnd() * 20, 20, 5); }
    } else if (S.zone === 'dome') {
      for (i = 0; i < 4; i++) { x.strokeStyle = 'rgba(200,180,255,.08)'; x.lineWidth = 10; x.beginPath(); x.arc(80 + i * 160, H, 70, Math.PI, 0); x.stroke(); }
      for (i = 0; i < 40; i++) { x.fillStyle = 'rgba(230,220,255,' + (0.05 + rnd() * 0.15) + ')'; x.fillRect(rnd() * W, rnd() * H * 0.6, 2, 2); }
    } else {
      // силуэты колб и реторт на полках
      for (i = 0; i < 6; i++) {
        var vx = 60 + rnd() * (W - 120), vy = 60 + rnd() * (H - 140), vr = 14 + rnd() * 26;
        x.fillStyle = zc.glow; x.beginPath(); x.arc(vx, vy, vr * 1.6, 0, Math.PI * 2); x.fill();
        x.strokeStyle = 'rgba(255,255,255,.045)'; x.lineWidth = 2;
        x.beginPath(); x.arc(vx, vy, vr, 0, Math.PI * 2); x.stroke();
        x.beginPath(); x.moveTo(vx - vr * 0.25, vy - vr * 0.95); x.lineTo(vx - vr * 0.25, vy - vr * 1.6); x.moveTo(vx + vr * 0.25, vy - vr * 0.95); x.lineTo(vx + vr * 0.25, vy - vr * 1.6); x.stroke();
      }
    }
    x.restore();
    // блоки
    var G = S.grid, solid = function (q, r) { return q >= 0 && q < L.COLS && r >= 0 && r < L.ROWS && G[r * L.COLS + q]; };
    for (var r = 0; r < L.ROWS; r++) for (var q = 0; q < L.COLS; q++) {
      if (!solid(q, r)) continue;
      var bx = q * T, by = r * T, frame = q < L.WL || q >= L.WR || r === 0 || r === L.ROWS - 1;
      if (frame) {
        x.fillStyle = zc.dark; x.fillRect(bx, by, T, T);
        x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(bx + ((r % 2) ? 0 : 10), by + T - 2, 10, 2); x.fillRect(bx + T - 1, by, 1, T);
        x.fillStyle = 'rgba(255,255,255,.05)'; x.fillRect(bx, by, T, 1);
        continue;
      }
      var tg = x.createLinearGradient(0, by, 0, by + T); tg.addColorStop(0, zc.top); tg.addColorStop(0.35, zc.base); tg.addColorStop(1, zc.dark);
      x.fillStyle = tg; rr(x, bx + 0.5, by + 1, T - 1, T - 2, 4); x.fill();
      if (!solid(q, r - 1)) { x.fillStyle = 'rgba(255,255,255,.35)'; rr(x, bx + 3, by + 2, T - 6, 3, 1.5); x.fill(); }
      x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(bx + 2, by + T - 4, T - 4, 2);
      if (S.zone === 'pipes') { x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(bx + 4, by + 9, 2, 2); x.fillRect(bx + 14, by + 9, 2, 2); }
      if (S.zone === 'glass') { x.fillStyle = 'rgba(255,255,255,.18)'; x.fillRect(bx + 4, by + 6, 2, 8); }
    }
    // тени под платформами
    x.fillStyle = 'rgba(0,0,0,.25)';
    for (r = 1; r < L.ROWS - 1; r++) for (q = L.WL; q < L.WR; q++) if (solid(q, r) && !solid(q, r + 1)) x.fillRect(q * T, (r + 1) * T, T, 5);
    // проём: стрелки вниз/вверх
    x.fillStyle = 'rgba(255,255,255,.12)';
    for (i = 0; i < 2; i++) {
      var ax = (L.GAP0 + 1 + i * 2) * T;
      x.beginPath(); x.moveTo(ax - 6, H - 14); x.lineTo(ax + 6, H - 14); x.lineTo(ax, H - 6); x.fill();
      x.beginPath(); x.moveTo(ax - 6, 6); x.lineTo(ax + 6, 6); x.lineTo(ax, 14); x.fill();
    }
    cache = c; cacheKey = key; return c;
  }

  // ---------- Потоки воздуха ----------
  function wind(ctx, S) {
    var Wd = S.wind; if (!Wd) return;
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    for (var z = 0; z < Wd.zones.length; z++) {
      var Q = Wd.zones[z], len = Math.sqrt(Q.vx * Q.vx + Q.vy * Q.vy) || 1, ux = Q.vx / len, uy = Q.vy / len;
      for (var k = 0; k < 7; k++) {
        var ph = ((S.time * 0.35 + k * 0.37) % 1), sx = Q.x0 + ((k * 0.61) % 1) * (Q.x1 - Q.x0), sy = Q.y0 + ((k * 0.29 + ph) % 1) * (Q.y1 - Q.y0);
        var lx = sx + ux * ph * 3, ly = sy + uy * ph * 3;
        ctx.globalAlpha = Math.sin(ph * Math.PI);
        ctx.beginPath(); ctx.moveTo(X(lx), Y(ly)); ctx.lineTo(X(lx + ux * 1.4), Y(ly + uy * 1.4)); ctx.stroke();
      }
    }
    ctx.restore();
  }

  // ---------- Герои: Колба и Реторта ----------
  function hero(ctx, x, y, i, face, o) {
    o = o || {};
    var col = P.pl[i], dk = P.plDark[i], t = o.t || 0, walk = o.walk || 0, lift = o.ground && walk ? Math.abs(Math.sin(walk * 14)) * 2 : 0;
    ctx.save(); ctx.translate(x, y - lift); if (face < 0) ctx.scale(-1, 1);
    if (o.ground) { ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(0, lift + 1, 12, 3, 0, 0, Math.PI * 2); ctx.fill(); }
    // ноги
    var st = o.ground && walk ? Math.sin(walk * 14) * 3 : 0;
    ctx.fillStyle = '#2a2230'; rr(ctx, -7 + st, -7, 6, 7, 2); ctx.fill(); rr(ctx, 1 - st, -7, 6, 7, 2); ctx.fill();
    // тело и фартук
    ctx.fillStyle = col; rr(ctx, -10, -22, 20, 17, 7); ctx.fill();
    ctx.fillStyle = dk; rr(ctx, -6, -18, 12, 13, 4); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.25)'; rr(ctx, -8, -21, 6, 3, 1.5); ctx.fill();
    // голова
    ctx.fillStyle = '#ffd9b3'; ctx.beginPath(); ctx.arc(1, -29, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, -32, 9, Math.PI * 1.05, Math.PI * 1.98); ctx.fill();   // берет
    ctx.fillStyle = dk; ctx.beginPath(); ctx.arc(-6, -38, 3, 0, Math.PI * 2); ctx.fill();
    // очки
    ctx.fillStyle = '#2a2230'; ctx.fillRect(-7, -31, 17, 3);
    ctx.fillStyle = '#bff3ff'; ctx.beginPath(); ctx.arc(6, -29.5, 3.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.fillRect(6, -31, 1.5, 1.5);
    // стеклодувная трубка
    var blow = o.blow > 0;
    ctx.strokeStyle = '#d8b25a'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(8, -25); ctx.lineTo(19, blow ? -25 : -21); ctx.stroke();
    if (blow) { ctx.fillStyle = 'rgba(200,240,255,.8)'; ctx.beginPath(); ctx.arc(21, -25, 3 + Math.sin(t * 40), 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#ffb3a0'; ctx.beginPath(); ctx.arc(7, -25, 3, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }
  function face(ctx, x, y, i, s) {
    ctx.save(); ctx.translate(x, y + 28 * s); ctx.scale(s, s); hero(ctx, 0, 0, i, 1, { t: 0 }); ctx.restore();
  }

  // ---------- Враги ----------
  function eye(ctx, x, y, r, dir, angry) {
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1b1622'; ctx.beginPath(); ctx.arc(x + dir * r * 0.35, y + r * 0.1, r * 0.5, 0, Math.PI * 2); ctx.fill();
    if (angry) { ctx.strokeStyle = '#1b1622'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - r, y - r - 1 - dir); ctx.lineTo(x + r, y - r - 1 + dir); ctx.stroke(); }
  }
  function enemy(ctx, type, x, y, dir, t, angry, s) {
    s = s || 1;
    var col = angry ? '#ff6b5a' : P.en[type];
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    if (type === 'cog') {
      ctx.save(); ctx.translate(0, -14); ctx.rotate(t * 3 * dir);
      ctx.fillStyle = col;
      for (var k = 0; k < 8; k++) { ctx.save(); ctx.rotate(k * Math.PI / 4); rr(ctx, -3, -15, 6, 6, 1.5); ctx.fill(); ctx.restore(); }
      ctx.beginPath(); ctx.arc(0, 0, 11.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.arc(0, 0, 11.5, 0.3, Math.PI - 0.3); ctx.fill();
      ctx.restore();
      eye(ctx, dir * 2, -15, 5.5, dir, angry);
      ctx.fillStyle = '#2a2230'; ctx.fillRect(-7, -3, 5, 3); ctx.fillRect(2, -3, 5, 3);
    } else if (type === 'spring') {
      var sq = 1 + Math.sin(t * 9) * 0.12;
      ctx.strokeStyle = angry ? '#ff8f80' : '#cfd8e3'; ctx.lineWidth = 2.5;
      ctx.beginPath(); for (var j = 0; j <= 6; j++) ctx.lineTo((j % 2 ? 7 : -7), -j * 1.6 * sq); ctx.stroke();
      ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(0, -10 * sq - 9, 12, 10, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.beginPath(); ctx.ellipse(-4, -10 * sq - 14, 4, 2.5, -0.4, 0, Math.PI * 2); ctx.fill();
      eye(ctx, -3 + dir * 2, -10 * sq - 9, 3.5, dir, angry); eye(ctx, 4 + dir * 2, -10 * sq - 9, 3.5, dir, angry);
    } else if (type === 'soot') {
      var b = Math.sin(t * 5) * 1.5;
      ctx.fillStyle = angry ? '#7a3a44' : col;
      [[-7, -12, 8], [6, -13, 9], [0, -19, 9], [-2, -8, 8], [7, -7, 6]].forEach(function (c) { ctx.beginPath(); ctx.arc(c[0], c[1] + b, c[2], 0, Math.PI * 2); ctx.fill(); });
      ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.beginPath(); ctx.arc(-3, -19 + b, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = angry ? '#ff5d4a' : '#ffe14d';
      ctx.beginPath(); ctx.ellipse(-4 + dir * 2, -13 + b, 2.6, 3.4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(4 + dir * 2, -13 + b, 2.6, 3.4, 0, 0, Math.PI * 2); ctx.fill();
    } else {   // spark
      var fl = Math.sin(t * 20) * 2;
      ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.moveTo(-6, -20); ctx.quadraticCurveTo(-2, -32 - fl, 0, -36 - fl); ctx.quadraticCurveTo(3, -30, 7, -21); ctx.fill();
      ctx.fillStyle = col; rr(ctx, -10, -22, 20, 20, 8); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.25)'; rr(ctx, -7, -9, 14, 5, 2); ctx.fill();
      eye(ctx, -3 + dir * 2, -15, 3.5, dir, angry); eye(ctx, 5 + dir * 2, -15, 3.5, dir, angry);
      ctx.fillStyle = '#2a2230'; ctx.fillRect(-7, -3, 5, 3); ctx.fillRect(2, -3, 5, 3);
    }
    ctx.restore();
  }

  // ---------- Шары ----------
  function glassBall(ctx, cx, cy, r, rim, t, glow) {
    if (glow) { ctx.save(); ctx.shadowColor = glow; ctx.shadowBlur = 16; ctx.fillStyle = 'rgba(0,0,0,0)'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.strokeStyle = glow; ctx.lineWidth = 2; ctx.stroke(); ctx.restore(); }
    var g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
    g.addColorStop(0, 'rgba(235,248,255,.30)'); g.addColorStop(0.65, 'rgba(160,215,255,.16)'); g.addColorStop(1, 'rgba(170,225,255,.42)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = rim; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(cx, cy, r - 0.5, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,170,230,.35)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(cx, cy, r - 2.5, Math.PI * 0.15 + t, Math.PI * 0.75 + t); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.ellipse(cx - r * 0.42, cy - r * 0.45, r * 0.22, r * 0.12, -0.7, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + r * 0.45, cy + r * 0.4, 1.4, 0, Math.PI * 2); ctx.fill();
  }
  function specialIcon(ctx, kind, cx, cy, t) {
    if (kind === 'fire') {
      ctx.fillStyle = '#ff7a2f'; ctx.beginPath(); ctx.moveTo(cx - 6, cy + 6); ctx.quadraticCurveTo(cx - 8, cy - 4, cx, cy - 10 - Math.sin(t * 12)); ctx.quadraticCurveTo(cx + 8, cy - 2, cx + 6, cy + 6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.arc(cx, cy + 2, 3.5, 0, Math.PI * 2); ctx.fill();
    } else if (kind === 'water') {
      ctx.fillStyle = '#4fb3ff'; ctx.beginPath(); ctx.moveTo(cx, cy - 10); ctx.quadraticCurveTo(cx + 8, cy + 1, cx, cy + 7); ctx.quadraticCurveTo(cx - 8, cy + 1, cx, cy - 10); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillRect(cx - 3, cy - 1, 2, 4);
    } else {
      ctx.fillStyle = '#ffe14d'; ctx.beginPath(); ctx.moveTo(cx + 2, cy - 10); ctx.lineTo(cx - 6, cy + 1); ctx.lineTo(cx - 1, cy + 1); ctx.lineTo(cx - 3, cy + 10); ctx.lineTo(cx + 6, cy - 2); ctx.lineTo(cx + 1, cy - 2); ctx.closePath(); ctx.fill();
    }
  }
  function bubble(ctx, b, S, g) {
    var cx = X(b.x), cy = Y(b.y), r = b.r * T * (b.phase === 'shoot' ? Math.min(1, 0.45 + b.t * 6) : 1);
    var wob = Math.sin(b.t * 6 + b.id) * 0.04;
    ctx.save(); ctx.translate(cx, cy); ctx.scale(1 + wob, 1 - wob); ctx.translate(-cx, -cy);
    var rim = 'rgba(200,240,255,.75)', glow = null;
    if (b.enemy) {
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r - 1, 0, Math.PI * 2); ctx.clip();
      enemy(ctx, b.enemy.type, cx, cy + 10, 1, b.t * 0.5, b.enemy.angry, 0.72);
      ctx.restore();
      if (b.trapT < 2.5) { rim = Math.floor(b.t * 8) % 2 ? '#ff5d4a' : '#ffd166'; glow = 'rgba(255,90,70,.7)'; }
      else if (b.trapT < 4.5) { rim = '#ffd166'; }
      else rim = '#8ff0ff';
    } else if (b.kind === 'letter') {
      rim = '#ffffff'; glow = 'rgba(255,220,120,.6)';
      var word = g.t('word');
      ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      g.text(word[b.letter] || '?', cx, cy + 6, { size: 17, align: 'center', color: P.letter, weight: 900 });
    } else if (b.kind !== 'plain') {
      rim = P.sp[b.kind]; glow = P.sp[b.kind];
      var ig = ctx.createRadialGradient(cx, cy, 2, cx, cy, r); ig.addColorStop(0, P.sp[b.kind] + '66'); ig.addColorStop(1, P.sp[b.kind] + '10');
      ctx.fillStyle = ig; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      specialIcon(ctx, b.kind, cx, cy, S.time);
    } else if (b.life < 2) ctx.globalAlpha = Math.floor(b.t * 10) % 2 ? 0.5 : 1;
    glassBall(ctx, cx, cy, r, rim, b.t * 0.6, glow);
    ctx.restore();
  }

  // ---------- Бонусы-детали ----------
  function item(ctx, kind, x, y, s) {
    s = s || 1;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    if (kind === 'apple') {
      ctx.fillStyle = '#ff4d5e'; ctx.beginPath(); ctx.arc(-3, 0, 6.5, 0, Math.PI * 2); ctx.arc(3, 0, 6.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#6bd16b'; ctx.beginPath(); ctx.ellipse(3, -8, 4, 2, -0.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(-5, -3, 2, 3);
    } else if (kind === 'pear') {
      ctx.fillStyle = '#c6e25a'; ctx.beginPath(); ctx.arc(0, 3, 7, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(0, -4, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#7a5230'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(2, -11); ctx.stroke();
    } else if (kind === 'plum') {
      ctx.fillStyle = '#9b5de5'; ctx.beginPath(); ctx.ellipse(0, 1, 7, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(-3, -2, 2, 3, 0, 0, Math.PI * 2); ctx.fill();
    } else if (kind === 'nut') {
      ctx.fillStyle = '#c9d3df'; ctx.beginPath();
      for (var k = 0; k < 6; k++) { var a = k * Math.PI / 3; ctx.lineTo(Math.cos(a) * 8, Math.sin(a) * 8); } ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#4a5260'; ctx.beginPath(); ctx.arc(0, 0, 3.2, 0, Math.PI * 2); ctx.fill();
    } else if (kind === 'gem') {
      ctx.fillStyle = '#4fe3ff'; ctx.beginPath(); ctx.moveTo(-8, -3); ctx.lineTo(-4, -8); ctx.lineTo(4, -8); ctx.lineTo(8, -3); ctx.lineTo(0, 8); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.moveTo(-4, -8); ctx.lineTo(0, -3); ctx.lineTo(-8, -3); ctx.fill();
    } else {
      ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.moveTo(-9, 6); ctx.lineTo(-9, -5); ctx.lineTo(-4, 0); ctx.lineTo(0, -8); ctx.lineTo(4, 0); ctx.lineTo(9, -5); ctx.lineTo(9, 6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ff4d5e'; ctx.beginPath(); ctx.arc(0, 2, 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // ---------- Котёл ----------
  function cauldron(ctx, B, t) {
    var cx = X(B.x), by = Y(B.y), w = B.w * T, h = B.h * T, top = by - h;
    ctx.save();
    if (B.spawnT > 0) ctx.globalAlpha = Math.max(0, 1 - B.spawnT / 1.6);
    // ножки
    ctx.fillStyle = '#2a2530'; [-0.3, 0, 0.3].forEach(function (k) { rr(ctx, cx + k * w - 5, by - 12, 10, 12, 3); ctx.fill(); });
    // тело
    var g = ctx.createRadialGradient(cx - w * 0.2, top + h * 0.45, 6, cx, top + h * 0.55, w * 0.6);
    g.addColorStop(0, B.flash > 0 ? '#ffffff' : '#6d6475'); g.addColorStop(1, B.flash > 0 ? '#ffd0c0' : '#26212b');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, top + h * 0.58, w * 0.5, h * 0.42, 0, 0, Math.PI * 2); ctx.fill();
    // ручки
    ctx.strokeStyle = '#3a3440'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(cx - w * 0.5, top + h * 0.45, 8, Math.PI * 0.5, Math.PI * 1.5); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx + w * 0.5, top + h * 0.45, 8, -Math.PI * 0.5, Math.PI * 0.5); ctx.stroke();
    // край и расплав
    ctx.fillStyle = '#4b4452'; ctx.beginPath(); ctx.ellipse(cx, top + h * 0.2, w * 0.48, h * 0.11, 0, 0, Math.PI * 2); ctx.fill();
    var mg = ctx.createLinearGradient(0, top + h * 0.12, 0, top + h * 0.28); mg.addColorStop(0, '#ffe14d'); mg.addColorStop(1, '#ff5a1f');
    ctx.fillStyle = mg; ctx.beginPath(); ctx.ellipse(cx, top + h * 0.21, w * 0.4, h * 0.07, 0, 0, Math.PI * 2); ctx.fill();
    for (var k = 0; k < 3; k++) { var ph = (t * 1.3 + k * 0.33) % 1; ctx.fillStyle = 'rgba(255,220,90,' + (1 - ph) + ')'; ctx.beginPath(); ctx.arc(cx - w * 0.2 + k * w * 0.2, top + h * 0.2 - ph * 14, 3 + ph * 3, 0, Math.PI * 2); ctx.fill(); }
    // глаза и рот
    var ey = top + h * 0.52, dir = B.vx >= 0 ? 1 : -1;
    ctx.fillStyle = '#ffd34d';
    ctx.beginPath(); ctx.ellipse(cx - 14 + dir * 3, ey, 7, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + 14 + dir * 3, ey, 7, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1b1622'; ctx.beginPath(); ctx.arc(cx - 14 + dir * 5, ey + 1, 2.6, 0, Math.PI * 2); ctx.arc(cx + 14 + dir * 5, ey + 1, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#1b1622'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(cx - 22, ey - 10); ctx.lineTo(cx - 8, ey - 6); ctx.moveTo(cx + 22, ey - 10); ctx.lineTo(cx + 8, ey - 6); ctx.stroke();
    ctx.fillStyle = '#ff6a3d'; rr(ctx, cx - 14, ey + 12, 28, 7, 3); ctx.fill();
    ctx.restore();
  }

  // ---------- Эффекты ----------
  function effects(ctx, S) {
    S.effects.forEach(function (f) {
      if (f.kind === 'fire') {
        if (!f.landed) { ctx.fillStyle = '#ff7a2f'; ctx.beginPath(); ctx.arc(X(f.x), Y(f.y) - 6, 6, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.arc(X(f.x), Y(f.y) - 6, 3, 0, Math.PI * 2); ctx.fill(); return; }
        var a = Math.min(1, f.t * 2);
        ctx.save(); ctx.globalAlpha = a; ctx.shadowColor = '#ff7a2f'; ctx.shadowBlur = 12;
        for (var c = f.c0; c <= f.c1; c++) for (var k = 0; k < 2; k++) {
          var fx = X(c + 0.25 + k * 0.5), h = 12 + Math.sin(S.time * 18 + c * 2 + k) * 5, fy = Y(f.row);
          ctx.fillStyle = '#ff6a2a'; ctx.beginPath(); ctx.moveTo(fx - 5, fy); ctx.quadraticCurveTo(fx - 4, fy - h * 0.6, fx, fy - h); ctx.quadraticCurveTo(fx + 4, fy - h * 0.6, fx + 5, fy); ctx.fill();
          ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.moveTo(fx - 2.5, fy); ctx.quadraticCurveTo(fx, fy - h * 0.6, fx + 2.5, fy); ctx.fill();
        }
        ctx.restore();
      } else if (f.kind === 'water') {
        var pts = [{ x: f.x, y: f.y }].concat(f.trail);
        ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(79,179,255,.85)'; ctx.lineWidth = 12; ctx.beginPath();
        pts.forEach(function (q, i) { var px = X(q.x), py = Y(q.y) - 6; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }); ctx.stroke();
        ctx.strokeStyle = 'rgba(210,240,255,.7)'; ctx.lineWidth = 3; ctx.stroke();
        ctx.restore();
      } else if (f.kind === 'bolt') {
        ctx.save(); ctx.strokeStyle = '#fff6b0'; ctx.shadowColor = '#ffe14d'; ctx.shadowBlur = 14; ctx.lineWidth = 3; ctx.globalAlpha = Math.min(1, f.t * 3);
        ctx.beginPath(); var n = 10;
        for (var i = 0; i <= n; i++) { var q = i / n, px = X(f.x0 + (f.x - f.x0) * q), py = Y(f.y0 + (f.y - f.y0) * q) + (i % 2 ? 6 : -6) * (i < n ? 1 : 0); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
        ctx.stroke(); ctx.restore();
      }
    });
  }

  // ---------- Кадр ----------
  function draw(ctx, S, g, o) {
    o = o || {};
    curZone = S.zone;
    ctx.drawImage(staticLayer(S), 0, OY);
    wind(ctx, S);
    var t = S.time;
    // бонусы
    S.items.forEach(function (it) { if (it.t < 2 && Math.floor(it.t * 10) % 2) return; item(ctx, it.kind, X(it.x), Y(it.y) - 9 + (it.ground ? Math.sin(t * 4 + it.id) * 1.5 : 0), 1); });
    // враги
    S.enemies.forEach(function (e) {
      ctx.save();
      if (e.spawnT > 0) { ctx.globalAlpha = Math.max(0.1, 1 - e.spawnT / 1.4); ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(X(e.x) - 14, Y(e.y) - 30 + (e.spawnT * 40) % 30, 28, 2); }
      if (e.charge > 0) { ctx.shadowColor = '#ffd34d'; ctx.shadowBlur = 18; }
      enemy(ctx, e.type, X(e.x), Y(e.y), e.dir, t + e.id, e.angry, 1);
      ctx.restore();
      if (e.angry && Math.floor(t * 6 + e.id) % 3 === 0) { ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(X(e.x) + 8, Y(e.y) - 34 - (t * 30 % 8), 3, 0, Math.PI * 2); ctx.fill(); }
    });
    if (S.boss && S.boss.alive) {
      var B = S.boss;
      if (B.trapped) {
        var bcx = X(B.x), bcy = Y(B.y - B.h / 2);
        ctx.save(); ctx.translate(bcx, bcy); ctx.scale(0.7, 0.7); ctx.translate(-bcx, -bcy); cauldron(ctx, B, t); ctx.restore();
        glassBall(ctx, bcx, bcy, B.w * T * 0.62, Math.floor(t * 6) % 2 ? '#ffd166' : '#8ff0ff', t, 'rgba(255,220,120,.6)');
      } else cauldron(ctx, B, t);
    }
    // игроки
    S.players.forEach(function (p) {
      if (p.out && !p.alive && p.deadT <= 0) return;
      ctx.save();
      if (!p.alive) { ctx.globalAlpha = Math.max(0, p.deadT / 1.6); ctx.translate(X(p.x), Y(p.y) - 16); ctx.rotate((1.6 - p.deadT) * 8); ctx.translate(-X(p.x), -Y(p.y) + 16); }
      else if (p.inv > 0 && Math.floor(t * 12) % 2) ctx.globalAlpha = 0.35;
      hero(ctx, X(p.x), Y(p.y), p.i, p.face, { t: t, walk: p.walk, ground: p.ground, blow: p.blowT });
      ctx.restore();
    });
    // шары поверх героев
    S.bubbles.forEach(function (b) { bubble(ctx, b, S, g); });
    effects(ctx, S);
    // искры и капли расплава
    S.shots.forEach(function (s) {
      var sx = X(s.x), sy = Y(s.y);
      ctx.save(); ctx.shadowColor = '#ff9a3d'; ctx.shadowBlur = 10;
      if (s.kind === 'drop') { ctx.fillStyle = '#ff7a2f'; ctx.beginPath(); ctx.arc(sx, sy, 6, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#ffe14d'; ctx.beginPath(); ctx.arc(sx - 1.5, sy - 1.5, 2.5, 0, Math.PI * 2); ctx.fill(); }
      else { ctx.fillStyle = '#ffd34d'; ctx.save(); ctx.translate(sx, sy); ctx.rotate(t * 12); ctx.fillRect(-5, -1.5, 10, 3); ctx.fillRect(-1.5, -5, 3, 10); ctx.restore(); }
      ctx.restore();
    });

    if (o.bare) return;
    Z.ui.hud(g, ctx, S, R);
    Z.ui.banner(g, ctx, S, R);
    if (o.toasts) Z.ui.toasts(g, ctx, o.toasts, P);
  }

  var R = { P: P, bg: bg, draw: draw, face: face, item: item, hero: hero, enemy: enemy, glassBall: glassBall };
  Z.modern = R;
})(typeof window !== 'undefined' ? window : globalThis);
