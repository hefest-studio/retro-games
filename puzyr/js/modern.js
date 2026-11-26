/* ПУЗЫРЬ · рендер MODERN (по умолчанию). PUZYR.modern = { P, bg, draw, face, hero, enemy, glassBall }
   Мастерская стеклодувов: тёплый полумрак, кирпич/огнеупор/стекло/сталь/мрамор по зонам; ванны с расплавом в полу,
   пузырь на трубке растёт, пока держишь кнопку, хлопок — веер воздушных дуг. Логику не трогает — только читает состояние. */
(function (global) {
  'use strict';
  var Z = global.PUZYR = global.PUZYR || {};
  var L = Z.logic, T = 20, OY = 40;

  var P = {
    pixel: false, font: null,
    hudBg: '#120f19', hudLine: '#2a2236', ink: '#f4efe8', muted: '#a59cb4', dim: '#4a4256', accent: '#ffb347', good: '#5ee08f', bad: '#ff5d6c',
    letter: '#ffd166', melt: '#ff9a3d', panel: '#1a1524', line: '#3a3048', bar: '#3a3048', bossBar: '#ff6a3d',
    pl: ['#ffb347', '#4fd1c5'], plDark: ['#c46a1e', '#1f8f84'],
    en: { cog: '#9fb3cc', spring: '#9be15d', soot: '#6e6488', spark: '#e0a23a' }
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
    cache = c; cacheKey = key; return c;
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
    // стеклодувная трубка; пока держишь кнопку — на конце растёт пузырь
    var ch = o.charge || 0, puff = o.blast > 0;
    ctx.strokeStyle = '#d8b25a'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(8, -25); ctx.lineTo(20, ch > 0 || puff ? -25 : -21); ctx.stroke();
    if (ch > 0 || puff) { ctx.fillStyle = '#ffb3a0'; ctx.beginPath(); ctx.arc(7, -25, 3 + Math.min(1, ch) * 1.5, 0, Math.PI * 2); ctx.fill(); }
    if (ch > 0) {
      var br = 4 + ch * 12, wob = Math.sin(t * 30) * 0.6 * ch;
      glassBall(ctx, 21 + br, -25, br + wob, ch >= 0.99 ? (Math.floor(t * 12) % 2 ? '#ff7a5a' : '#ffd166') : 'rgba(200,240,255,.8)', t * 2, ch >= 0.99 ? 'rgba(255,150,90,.6)' : null);
    }
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

  // ---------- Стекло ----------
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

  // ---------- Ванны с расплавом ----------
  function vats(ctx, S, t) {
    (S.vats || []).forEach(function (v) {
      var x0 = v.c0 * T, w = (v.c1 - v.c0 + 1) * T, y0 = Y(L.ROWS - 1) + 4, h = T - 4;
      var hg = ctx.createLinearGradient(0, y0 - 50, 0, y0); hg.addColorStop(0, 'rgba(255,120,40,0)'); hg.addColorStop(1, 'rgba(255,120,40,.26)');
      ctx.fillStyle = hg; ctx.fillRect(x0 - 8, y0 - 50, w + 16, 50);
      var gr = ctx.createLinearGradient(0, y0, 0, y0 + h); gr.addColorStop(0, '#ffe066'); gr.addColorStop(0.4, '#ff7a1f'); gr.addColorStop(1, '#a3260c');
      ctx.save(); ctx.shadowColor = '#ff7a1f'; ctx.shadowBlur = 22; ctx.fillStyle = gr; ctx.fillRect(x0, y0, w, h); ctx.restore();
      ctx.fillStyle = '#fff0a8';
      for (var k = 0; k < 4; k++) { var q = (t * 0.7 + k * 0.27) % 1; ctx.globalAlpha = Math.sin(q * Math.PI); ctx.beginPath(); ctx.arc(x0 + 5 + ((k * 0.37 + q * 0.2) % 1) * (w - 10), y0 + 2 - q * 6, 2 + q * 2, 0, Math.PI * 2); ctx.fill(); }
      ctx.globalAlpha = 1;
      // края ванны — огнеупорный бортик
      ctx.fillStyle = '#3a2a2a'; ctx.fillRect(x0 - 3, y0 - 4, 3, h + 4); ctx.fillRect(x0 + w, y0 - 4, 3, h + 4);
    });
  }

  // ---------- Хлопок: веер воздушных дуг и осколки пузыря ----------
  function blasts(ctx, S) {
    S.blasts.forEach(function (b) {
      var k = 1 - b.t / 0.32, cx = X(b.x), cy = Y(b.y), R0 = b.range * T * (0.25 + 0.75 * k);
      ctx.save(); ctx.globalAlpha = Math.max(0, 1 - k) * 0.9; ctx.lineCap = 'round';
      for (var j = 0; j < 7; j++) { var a = j * 0.9 + b.x, d = 5 + k * (10 + b.pw * 16); ctx.fillStyle = 'rgba(215,247,255,.95)'; ctx.fillRect(cx + Math.cos(a) * d - 1, cy + Math.sin(a) * d - 1, 2.5, 2.5); }
      for (var i = 0; i < 3; i++) {
        var r = R0 * (0.5 + i * 0.25), sp = 0.42 + i * 0.06;
        ctx.strokeStyle = i === 1 ? 'rgba(255,214,140,.95)' : 'rgba(200,240,255,.9)'; ctx.lineWidth = (3.4 - i * 0.8) * (0.6 + b.pw * 0.6);
        ctx.beginPath();
        if (b.face > 0) ctx.arc(cx, cy, r, -sp, sp); else ctx.arc(cx, cy, r, Math.PI - sp, Math.PI + sp);
        ctx.stroke();
      }
      ctx.restore();
    });
  }
  function dazeStars(ctx, x, y, t) {
    for (var k = 0; k < 3; k++) { var a = t * 5 + k * 2.1; ctx.fillStyle = k % 2 ? '#ffe14d' : '#ffffff'; ctx.beginPath(); ctx.arc(x + Math.cos(a) * 10, y + Math.sin(a) * 3.5, 2.2, 0, Math.PI * 2); ctx.fill(); }
  }

  // ---------- Кадр ----------
  function draw(ctx, S, g, o) {
    o = o || {};
    curZone = S.zone;
    ctx.drawImage(staticLayer(S), 0, OY);
    var t = S.time;
    // враги: на ходу, кувырком, оглушённые; тонущие в ванне — гаснут
    S.enemies.forEach(function (e) {
      var ex = X(e.x), ey = Y(e.y);
      ctx.save();
      if (e.spawnT > 0) { ctx.globalAlpha = Math.max(0.1, 1 - e.spawnT / 1.4); ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(ex - 14, ey - 30 + (e.spawnT * 40) % 30, 28, 2); }
      if (e.charge > 0) { ctx.shadowColor = '#ffd34d'; ctx.shadowBlur = 18; }
      if (e.y > L.ROWS - 1.3) ctx.globalAlpha *= Math.max(0, 1 - (e.y - (L.ROWS - 1.3)) * 1.6);
      if (e.mode === 'tumble') { ctx.translate(ex, ey - 14); ctx.rotate(t * 14 * (e.vx < 0 ? -1 : 1)); ctx.translate(-ex, -ey + 14); }
      else if (e.mode === 'daze' || e.downed) { ctx.translate(ex, ey); ctx.scale(1.08, 0.86); ctx.translate(-ex, -ey); }
      enemy(ctx, e.type, ex, ey, e.dir, t + e.id, e.mode !== 'walk', 1);
      ctx.restore();
      if (e.mode === 'daze' && e.daze > 0) dazeStars(ctx, ex, ey - 34, t + e.id);
      if (e.mode === 'tumble' && Math.abs(e.vx) > 3) {
        ctx.strokeStyle = 'rgba(220,245,255,.4)'; ctx.lineWidth = 2; var sg = e.vx < 0 ? -1 : 1;
        for (var k = 0; k < 3; k++) { var lx = ex - sg * (16 + k * 6); ctx.beginPath(); ctx.moveTo(lx, ey - 8 - k * 8); ctx.lineTo(lx - sg * 9, ey - 8 - k * 8); ctx.stroke(); }
      }
    });
    if (S.boss && S.boss.alive) {
      var B = S.boss;
      ctx.save(); if (B.dying) { ctx.translate(X(B.x), Y(B.y)); ctx.rotate(Math.sin(t * 9) * 0.12); ctx.translate(-X(B.x), -Y(B.y)); }
      cauldron(ctx, B, t); ctx.restore();
    }
    vats(ctx, S, t);   // поверх тонущих — расплав
    // игроки
    S.players.forEach(function (p) {
      if (p.out && !p.alive && p.deadT <= 0) return;
      ctx.save();
      if (!p.alive) {
        ctx.globalAlpha = Math.max(0, p.deadT / 1.6);
        if (p.why !== 'vat') { ctx.translate(X(p.x), Y(p.y) - 16); ctx.rotate((1.6 - p.deadT) * 8); ctx.translate(-X(p.x), -Y(p.y) + 16); }
      } else if (p.inv > 0 && Math.floor(t * 12) % 2) ctx.globalAlpha = 0.35;
      hero(ctx, X(p.x), Y(p.y), p.i, p.face, { t: t, walk: p.walk, ground: p.ground, charge: p.charging ? Math.min(1, p.charge / L.CHARGE_MAX) : 0, blast: p.blastT });
      ctx.restore();
    });
    blasts(ctx, S);
    // искры и капли расплава (отбитые хлопком — с голубым ореолом)
    S.shots.forEach(function (s) {
      var sx = X(s.x), sy = Y(s.y);
      ctx.save(); ctx.shadowColor = s.back ? '#8ff0ff' : '#ff9a3d'; ctx.shadowBlur = 10;
      if (s.kind === 'drop') { ctx.fillStyle = '#ff7a2f'; ctx.beginPath(); ctx.arc(sx, sy, 6, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#ffe14d'; ctx.beginPath(); ctx.arc(sx - 1.5, sy - 1.5, 2.5, 0, Math.PI * 2); ctx.fill(); }
      else { ctx.fillStyle = '#ffd34d'; ctx.translate(sx, sy); ctx.rotate(t * 12); ctx.fillRect(-5, -1.5, 10, 3); ctx.fillRect(-1.5, -5, 3, 10); }
      ctx.restore();
    });

    if (o.bare) return;
    Z.ui.hud(g, ctx, S, R);
    Z.ui.banner(g, ctx, S, R);
    if (o.toasts) Z.ui.toasts(g, ctx, o.toasts, P);
  }

  var R = { P: P, bg: bg, draw: draw, face: face, hero: hero, enemy: enemy, glassBall: glassBall };
  Z.modern = R;
})(typeof window !== 'undefined' ? window : globalThis);
