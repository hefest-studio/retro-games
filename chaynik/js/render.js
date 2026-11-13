/* ЧАЙНИК · render.js — отрисовка обеих тем одним модулем.
   modern — векторная графика с градиентами и мягкими тенями; retro — тот же кадр рисуется в буфер 320×180
   плоскими цветами 16-цветной палитры и растягивается ×2 без сглаживания (крупный «пиксель»).
   CHAYNIK.R: scene(g, ctx, S, ui), kettle(ctx, x, y, o), hud(…), FX (частицы), палитры. */
(function (global) {
  'use strict';
  var CH = global.CHAYNIK, L = CH.logic, LVL = CH.levels, T = LVL.T, C = LVL.C, K = L.K;
  var VW = 640, VH = 360, PI2 = Math.PI * 2;
  // 16 цветов retro
  var E = { k: '#000000', b: '#0000aa', g: '#00aa00', c: '#00aaaa', r: '#aa0000', m: '#aa00aa', n: '#aa5500', l: '#aaaaaa', d: '#555555',
    B: '#5555ff', G: '#55ff55', Cc: '#55ffff', R: '#ff5555', M: '#ff55ff', y: '#ffff55', w: '#ffffff' };
  // чайник: латунь, тёмная окантовка, белые глаза, синий заводной ключ
  var KM = { body: '#d9a43c', body2: '#a8701f', hi: '#ffe7a3', rim: '#6b4216', arm: '#3b2a1c', glove: '#fff6e6', eye: '#ffffff', pupil: '#1d1610', key: '#4f8fd6', keyHi: '#9cc8ff', hot: '#ff5a2c', cold: '#9fdcff', foot: '#3b2a1c' };
  var KR = { body: E.y, body2: E.n, hi: E.w, rim: E.k, arm: E.k, glove: E.w, eye: E.w, pupil: E.k, key: E.B, keyHi: E.Cc, hot: E.R, cold: E.Cc, foot: E.k };
  // уровни
  var PM = {
    kitchen: { sky: ['#2b1d2e', '#5b3140', '#c9714a'], wall: '#3c2a35', tile: '#4a3441', tile2: '#43303b', top: '#e8b46a', top2: '#9a6233', body: '#7a4a2b', body2: '#6a3f25', grain: '#5c351f', shelf: '#c48a4a', shelfD: '#7b4f27', far: '#2e2029', far2: '#25191f', glow: '#ffb35c', spike: '#d7dde6', grate: '#2a2a30', flame: ['#ffe9a0', '#ff8a2a', '#4fa8ff'] },
    tea: { sky: ['#f5d9a6', '#c9792e', '#5a2c10'], wall: '#f6f1e8', wallLine: '#3a6db5', top: '#fff7d0', top2: '#e0c040', body: '#f6f1e8', body2: '#dfd6c8', shelf: '#f7d23c', shelfD: '#d29b1a', far: 'rgba(120,60,20,.35)', far2: 'rgba(90,40,10,.4)', glow: '#ffe9b0', spike: '#ffffff', grain: '#e8e0d0' },
    cupboard: { sky: ['#1b1420', '#2f2230', '#4a3240'], wall: '#3b2b2a', tile: '#45322f', tile2: '#3f2e2b', top: '#d6a35c', top2: '#8a5a2a', body: '#5d3c25', body2: '#523420', grain: '#472c1a', shelf: '#b07a42', shelfD: '#6b4520', far: '#2a1e22', far2: '#22181b', glow: '#ffd38a', spike: '#d7dde6', grate: '#2a2a30', flame: ['#ffe9a0', '#ff8a2a', '#4fa8ff'] }
  };
  var PR = {
    kitchen: { sky: [E.k, E.b, E.m], wall: E.k, tile: E.b, tile2: E.k, top: E.y, top2: E.n, body: E.n, body2: E.n, grain: E.k, shelf: E.y, shelfD: E.n, far: E.d, far2: E.k, glow: E.y, spike: E.w, grate: E.d, flame: [E.y, E.R, E.B] },
    tea: { sky: [E.n, E.n, E.r], wall: E.w, wallLine: E.B, top: E.w, top2: E.y, body: E.w, body2: E.l, shelf: E.y, shelfD: E.n, far: E.n, far2: E.r, glow: E.y, spike: E.w, grain: E.l },
    cupboard: { sky: [E.k, E.b, E.m], wall: E.k, tile: E.d, tile2: E.k, top: E.y, top2: E.n, body: E.n, body2: E.n, grain: E.k, shelf: E.y, shelfD: E.n, far: E.d, far2: E.k, glow: E.y, spike: E.w, grate: E.d, flame: [E.y, E.R, E.B] }
  };
  var retro = false, signText = null;
  function col(m, r) { return retro ? r : m; }
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function circ(ctx, x, y, r, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, Math.max(0.1, r), 0, PI2); ctx.fill(); }
  function ell(ctx, x, y, rx, ry, a, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), a || 0, 0, PI2); ctx.fill(); }
  function lg(ctx, x0, y0, x1, y1, stops) { if (retro) return stops[0][1]; var g = ctx.createLinearGradient(x0, y0, x1, y1); stops.forEach(function (s) { g.addColorStop(s[0], s[1]); }); return g; }
  function line(ctx, x0, y0, x1, y1, c, w) { ctx.strokeStyle = c; ctx.lineWidth = w || 1; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); }
  function mk(w, h) { var c = (typeof document !== 'undefined') ? document.createElement('canvas') : null; if (!c) return null; c.width = w; c.height = h; return c; }
  function hash(a, b) { var h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

  // ---------- частицы ----------
  var FX = (function () {
    var list = [];
    return {
      add: function (x, y, o) {
        o = o || {}; var n = o.n || 8;
        for (var i = 0; i < n; i++) {
          var a = o.a != null ? o.a + (Math.random() - 0.5) * (o.spread || PI2) : Math.random() * PI2, sp = (o.sp || 100) * (0.4 + Math.random() * 0.6);
          list.push({ x: x, y: y, vx: Math.cos(a) * sp + (o.vx || 0), vy: Math.sin(a) * sp + (o.vy || 0), t: 0, life: (o.life || 0.5) * (0.7 + Math.random() * 0.5), c: o.c || '#fff', r: o.r || 2, g: o.g == null ? 300 : o.g, puff: !!o.puff, ring: !!o.ring, text: o.text || null });
        }
      },
      text: function (x, y, s, c, big) { list.push({ x: x, y: y, vx: 0, vy: -40, t: 0, life: big ? 1.4 : 0.9, c: c, r: big ? 15 : 11, g: 0, text: s }); },
      step: function (dt) { for (var i = list.length - 1; i >= 0; i--) { var p = list[i]; p.t += dt; if (p.t > p.life) { list.splice(i, 1); continue; } p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.puff) { p.vx *= 1 - 2 * dt; p.vy *= 1 - 2 * dt; } } if (list.length > 420) list.splice(0, list.length - 420); },
      draw: function (ctx) {
        for (var i = 0; i < list.length; i++) {
          var p = list[i], k = 1 - p.t / p.life;
          if (p.text) { ctx.globalAlpha = Math.min(1, k * 2); ctx.fillStyle = p.c; ctx.font = (retro ? 'bold ' + p.r + 'px "Courier New", monospace' : '800 ' + p.r + 'px Inter, system-ui, sans-serif'); ctx.textAlign = 'center'; ctx.fillText(p.text, p.x, p.y); continue; }
          ctx.globalAlpha = retro ? (k > 0.3 ? 1 : 0) : Math.max(0, k) * (p.puff ? 0.6 : 1);
          if (p.ring) { ctx.strokeStyle = p.c; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1 + (1 - k) * 2), 0, PI2); ctx.stroke(); }
          else if (retro) { ctx.fillStyle = p.c; var s = Math.max(2, Math.round(p.puff ? p.r * (1.5 - k * 0.5) : p.r)); ctx.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s); }
          else circ(ctx, p.x, p.y, p.puff ? p.r * (1.6 - k * 0.6) : p.r, p.c);
        }
        ctx.globalAlpha = 1;
      },
      clear: function () { list.length = 0; },
      count: function () { return list.length; }
    };
  })();

  // ---------- ЧАЙНИК ----------
  // o: { face, t, pose('stand'|'run'|'jump'|'hang'|'fire'|'swim'|'sled'|'fly'|'carry'), aim, firing, heat, over, inv, idle, death{kind,t}, scale, run }
  function kettle(ctx, x, y, o) {
    var P = retro ? KR : KM, f = o.face || 1, t = o.t || 0, s = o.scale || 1, d = o.death, pose = o.pose || 'stand';
    ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.scale(s * f, s);
    if (o.inv > 0 && Math.floor(o.inv * 14) % 2 === 0 && !d) ctx.globalAlpha = 0.45;
    var bob = pose === 'stand' ? Math.sin(t * 3) * 0.8 : pose === 'run' ? -Math.abs(Math.sin(t * 14)) * 2 : 0;
    var shake = (o.over || (d && d.kind === 'boil')) ? (Math.sin(t * 60) * 1.2) : 0;
    var squash = (d && d.kind === 'magnet') ? 0.55 : 1, sx = 1, sy = 1;
    if (o.land > 0) { sx = 1.12; sy = 0.88; }
    if (pose === 'jump') { sx = 0.92; sy = 1.08; }
    ctx.translate(shake, bob); ctx.scale(sx * (d && d.kind === 'magnet' ? 1.25 : 1), sy * squash);
    var crack = d && d.kind === 'crack' ? Math.min(1, d.t / 0.8) : 0, split = d && d.kind === 'crack' ? Math.max(0, (d.t - 0.8) * 40) : 0;
    var tint = o.over ? P.hot : (d && d.kind === 'cold') ? P.cold : (d && d.kind === 'boil') ? P.hot : null;
    // ноги
    var ph = pose === 'run' ? Math.sin(t * 14) : 0;
    if (pose !== 'sled' && pose !== 'fly' && !(d && d.kind === 'boil' && d.t > 0.8)) {
      ell(ctx, -6 + ph * 3, -2, 5, 3, 0, P.foot); ell(ctx, 6 - ph * 3, -2, 5, 3, 0, P.foot);
    }
    if (d && d.kind === 'boil' && d.t > 0.8) {   // лужица и заводной ключ
      ell(ctx, 0, -2, 16 + (d.t - 0.8) * 6, 3, 0, col('rgba(200,140,60,.8)', E.n));
      keyDraw(ctx, P, 0, -6 - Math.min(10, (d.t - 0.8) * 30), t * 20);
      ctx.restore(); return;
    }
    // ручка-руки (за корпусом)
    var handPose = pose === 'hang' ? 'up' : pose === 'jump' ? 'up2' : pose === 'carry' ? 'carry' : (o.idle === 1 ? 'hips' : 'down');
    arms(ctx, P, handPose, t, ph);
    // корпус
    ctx.save(); if (split) ctx.translate(-split, split * 0.4);
    if (split) { ctx.beginPath(); ctx.rect(-30, -40, 30, 40); ctx.clip(); }
    body(ctx, P, tint, crack);
    ctx.restore();
    if (split) { ctx.save(); ctx.translate(split, split * 0.5); ctx.rotate(split * 0.01); ctx.beginPath(); ctx.rect(0, -40, 30, 40); ctx.clip(); body(ctx, P, tint, crack); ctx.restore(); }
    // носик
    if (!split) spout(ctx, P, tint, o.aim, o.firing);
    // глаза
    if (!split) eyes(ctx, P, o, t);
    // заводной ключ сзади
    if (!split) keyDraw(ctx, P, -15, -16, t * (pose === 'run' ? 18 : 4) + (o.firing ? t * 30 : 0));
    // пар из горлышка (нет крышки!) — при нагреве
    if ((o.heat > 0.6 || o.over) && !d && Math.floor(t * 8) % 2 === 0) circ(ctx, 2 + Math.sin(t * 9) * 2, -31 - (t * 30 % 8), 2.5, col('rgba(255,255,255,.7)', E.w));
    ctx.restore();
  }
  function body(ctx, P, tint, crack) {
    ctx.fillStyle = retro ? (tint || P.body) : lg(ctx, 0, -28, 0, 0, [[0, tint || P.hi], [0.35, tint || P.body], [1, tint ? tint : P.body2]]);
    ctx.beginPath(); ctx.moveTo(-11, -27); ctx.lineTo(11, -27); ctx.quadraticCurveTo(17, -22, 17, -12); ctx.quadraticCurveTo(17, -2, 9, -2); ctx.lineTo(-9, -2); ctx.quadraticCurveTo(-17, -2, -17, -12); ctx.quadraticCurveTo(-17, -22, -11, -27); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = P.rim; ctx.lineWidth = retro ? 1.5 : 1.2; ctx.stroke();
    // горлышко без крышки: тёмная дыра
    ctx.fillStyle = P.body2; rr(ctx, -8, -31, 16, 5, 2); ctx.fill(); ctx.strokeStyle = P.rim; ctx.stroke();
    ell(ctx, 0, -30.5, 6, 1.6, 0, P.rim);
    // пояс-обод и заклёпки
    ctx.fillStyle = P.body2; ctx.fillRect(-16, -9, 32, 3);
    circ(ctx, -10, -7.5, 1, P.hi); circ(ctx, 0, -7.5, 1, P.hi); circ(ctx, 10, -7.5, 1, P.hi);
    if (!retro) { ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(-7, -20, 3, 5, 0.4, 0, PI2); ctx.fill(); }
    if (crack) { ctx.strokeStyle = P.rim; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(0, -27); ctx.lineTo(-2, -20); ctx.lineTo(2, -15); ctx.lineTo(-1, -10 + (1 - crack) * 6); if (crack > 0.5) { ctx.lineTo(1, -3); ctx.moveTo(2, -15); ctx.lineTo(8, -18); } ctx.stroke(); }
  }
  function spout(ctx, P, tint, aim, firing) {
    ctx.save(); ctx.translate(14, -15);
    var a = aim === 'u' ? -1.05 : aim === 'd' ? 0.9 : -0.35;
    ctx.rotate(a); ctx.fillStyle = tint || P.body;
    ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(11, -2.5); ctx.lineTo(12, 2.5); ctx.lineTo(0, 4); ctx.closePath(); ctx.fill(); ctx.strokeStyle = P.rim; ctx.lineWidth = 1; ctx.stroke();
    ell(ctx, 12, 0, 1.6, 2.8, 0, firing ? col('#ffffff', E.w) : P.rim);
    ctx.restore();
  }
  function eyes(ctx, P, o, t) {
    var d = o.death, sleep = o.idle === 3 || (d && d.kind === 'cold'), blink = Math.floor(t * 0.7) % 5 === 0 && (t * 0.7 % 1) < 0.12;
    var ex = 3, ey = -18, look = o.aim === 'u' ? -2 : o.aim === 'd' ? 1.5 : 0;
    [ex, ex + 8].forEach(function (x, i) {
      ell(ctx, x, ey, 3.6, 4.6, 0, P.eye); ctx.strokeStyle = P.rim; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.ellipse(x, ey, 3.6, 4.6, 0, 0, PI2); ctx.stroke();
      if (sleep || blink) { line(ctx, x - 3, ey + 0.5, x + 3, ey + 0.5, P.rim, 1.2); return; }
      if (d && (d.kind === 'magnet' || d.kind === 'crack' || d.kind === 'pop')) { ctx.strokeStyle = P.pupil; ctx.lineWidth = 1; ctx.beginPath(); for (var k = 0; k < 10; k++) { var a = k * 0.8 + t * 10, r = k * 0.32; ctx.lineTo(x + Math.cos(a) * r, ey + Math.sin(a) * r); } ctx.stroke(); return; }
      if (o.over || (d && d.kind === 'boil')) { line(ctx, x - 2, ey - 2, x + 2, ey + 2, P.pupil, 1.4); line(ctx, x + 2, ey - 2, x - 2, ey + 2, P.pupil, 1.4); return; }
      circ(ctx, x + 1.2, ey + 0.5 + look, 1.8, P.pupil); if (!retro) circ(ctx, x + 1.8, ey - 0.6 + look, 0.6, '#fff');
    });
    // рот
    if (o.idle === 1) circ(ctx, 9, -10, 1.6, P.rim);              // свистит «о»
    else if (o.over) { ctx.strokeStyle = P.rim; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(4, -10); for (var i = 0; i < 4; i++) ctx.lineTo(5 + i * 2, -10 + (i % 2 ? -1.5 : 1)); ctx.stroke(); }
    else if (!sleep) { ctx.strokeStyle = P.rim; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(8, -12, 2.5, 0.2, Math.PI - 0.2); ctx.stroke(); }
  }
  function keyDraw(ctx, P, x, y, a) {
    ctx.save(); ctx.translate(x, y); ctx.fillStyle = P.key; ctx.fillRect(-4, -1, 4, 2);
    ctx.translate(-5, 0); ctx.scale(Math.cos(a), 1);
    ell(ctx, 0, -3.5, 2.5, 3.2, 0, P.key); ell(ctx, 0, 3.5, 2.5, 3.2, 0, P.key); circ(ctx, 0, -3.5, 1, P.keyHi); circ(ctx, 0, 3.5, 1, P.keyHi);
    ctx.restore();
  }
  function arms(ctx, P, pose, t, ph) {
    ctx.strokeStyle = P.arm; ctx.lineWidth = 2; ctx.lineCap = 'round';
    // ручка: дуга сзади
    ctx.beginPath(); ctx.moveTo(-14, -24); ctx.quadraticCurveTo(-24, -20, -16, -8); ctx.stroke();
    var hands;
    if (pose === 'up') hands = [[-14, -24, -2, -44], [-15, -20, 4, -42]];
    else if (pose === 'up2') hands = [[-14, -24, -22, -36], [-15, -20, -8, -38]];
    else if (pose === 'carry') hands = [[-14, -24, -6, -38], [-15, -20, 8, -38]];
    else if (pose === 'hips') hands = [[-14, -24, -20, -14], [-15, -20, -18, -10]];
    else hands = [[-14, -24, -22 + ph * 4, -12], [-15, -20, -12 - ph * 4, -6]];
    hands.forEach(function (h) {
      ctx.beginPath(); ctx.moveTo(h[0], h[1]); ctx.quadraticCurveTo((h[0] + h[2]) / 2 - 4, (h[1] + h[3]) / 2, h[2], h[3]); ctx.stroke();
      circ(ctx, h[2], h[3], 2.6, P.glove); ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(h[2], h[3], 2.6, 0, PI2); ctx.stroke(); ctx.lineWidth = 2;
    });
  }

  // ---------- клетки ----------
  var tileCache = {};
  function tiles(kind) {
    var key = kind + (retro ? 'r' : 'm'); if (tileCache[key]) return tileCache[key];
    var p = (retro ? PR : PM)[kind], S = {};
    function sp(name, fn) { var c = mk(T, T); if (!c) return; var x = c.getContext('2d'); fn(x); S[name] = c; }
    var wasRetro = retro;
    sp('body', function (x) {
      if (kind === 'tea') { x.fillStyle = p.body; x.fillRect(0, 0, T, T); x.fillStyle = p.wallLine; if (!wasRetro) x.globalAlpha = 0.55; x.fillRect(0, 7, T, 1); x.fillRect(4, 3, 1, 3); x.fillRect(11, 10, 1, 3); x.globalAlpha = 1; return; }
      x.fillStyle = p.body; x.fillRect(0, 0, T, T); x.fillStyle = p.grain;
      if (wasRetro) { x.fillRect(0, 5, 9, 1); x.fillRect(6, 11, 10, 1); }
      else { x.globalAlpha = 0.5; x.fillRect(0, 4, 10, 1); x.fillRect(5, 10, 11, 1); x.fillRect(2, 14, 6, 1); x.globalAlpha = 1; }
    });
    sp('top', function (x) {
      x.drawImage(S.body, 0, 0);
      if (kind === 'tea') { x.fillStyle = p.wallLine; x.fillRect(0, 0, T, 2); x.fillStyle = p.top; x.fillRect(0, 2, T, 2); return; }
      x.fillStyle = p.top; x.fillRect(0, 0, T, 4); x.fillStyle = p.top2; x.fillRect(0, 4, T, 2);
      if (!wasRetro) { x.fillStyle = 'rgba(255,255,255,.3)'; x.fillRect(0, 0, T, 1); }
    });
    sp('shelf', function (x) {
      if (kind === 'tea') {   // долька лимона сверху
        x.fillStyle = p.shelfD; x.fillRect(0, 0, T, 6); x.fillStyle = p.shelf; x.fillRect(0, 0, T, 4); x.fillStyle = wasRetro ? E.w : '#fff6c0';
        for (var i = 0; i < 4; i++) x.fillRect(i * 4 + 1, 1, 2, 2);
        return;
      }
      x.fillStyle = p.shelf; x.fillRect(0, 0, T, 5); x.fillStyle = p.shelfD; x.fillRect(0, 5, T, 2);
      x.fillRect(3, 7, 2, 4); x.fillRect(11, 7, 2, 4);
      if (!wasRetro) { x.fillStyle = 'rgba(255,255,255,.3)'; x.fillRect(0, 0, T, 1); }
    });
    sp('forks', function (x) {
      if (kind === 'tea') {   // сахарные колючки
        x.fillStyle = p.spike; for (var i = 0; i < 3; i++) { x.beginPath(); x.moveTo(i * 5 + 1, T); x.lineTo(i * 5 + 3.5, 4 + (i % 2) * 3); x.lineTo(i * 5 + 6, T); x.fill(); }
        if (!wasRetro) { x.fillStyle = 'rgba(160,200,255,.6)'; x.fillRect(3, 8, 1, 6); x.fillRect(8, 11, 1, 4); }
        return;
      }
      x.fillStyle = wasRetro ? E.d : '#7f8792'; x.fillRect(0, T - 4, T, 4);
      x.fillStyle = p.spike; for (var j = 0; j < 4; j++) { x.fillRect(j * 4 + 1, 2, 2, T - 6); x.fillRect(j * 4 + 1, 1, 2, 1); }
      if (!wasRetro) { x.fillStyle = '#ffffff'; for (var k = 0; k < 4; k++) x.fillRect(j = k * 4 + 1, 2, 1, T - 7); }
    });
    sp('grate', function (x) {
      x.fillStyle = p.grate || '#333'; x.fillRect(0, T - 5, T, 5); x.fillStyle = wasRetro ? E.l : '#555a64'; x.fillRect(0, T - 6, T, 1); x.fillRect(3, T - 9, 2, 4); x.fillRect(11, T - 9, 2, 4);
    });
    tileCache[key] = S; return S;
  }

  // ---------- фон ----------
  function drawBg(ctx, kind, cam, time, LV) {
    var p = (retro ? PR : PM)[kind];
    ctx.fillStyle = lg(ctx, 0, 0, 0, VH, [[0, p.sky[0]], [0.6, p.sky[1]], [1, p.sky[2]]]); ctx.fillRect(0, 0, VW, VH);
    var i, x;
    if (kind === 'kitchen' || kind === 'cupboard') {
      // кафельная стена с параллаксом
      var ox = -(cam.x * 0.3) % 32, oy = -(cam.y * 0.3) % 32;
      ctx.fillStyle = p.tile;
      for (var yy = oy - 32; yy < VH * 0.72; yy += 32) for (var xx = ox - 32; xx < VW; xx += 32) { ctx.fillStyle = ((Math.floor((xx - ox) / 32) + Math.floor((yy - oy) / 32)) & 1) ? p.tile : p.tile2; ctx.fillRect(xx + 1, yy + 1, 30, 30); }
      if (!retro) { var sh = ctx.createLinearGradient(0, 0, 0, VH); sh.addColorStop(0, 'rgba(0,0,0,.45)'); sh.addColorStop(0.5, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,.35)'); ctx.fillStyle = sh; ctx.fillRect(0, 0, VW, VH); }
      // дальний план: силуэты техники и висящей утвари
      var fx = -(cam.x * 0.5);
      for (i = -1; i < 9; i++) {
        x = fx % 240 + i * 240; var k = Math.floor((-fx) / 240) + i, hh = 60 + hash(k, 3) * 70;
        var kk = Math.floor(hash(k, 9) * 3), bw = 90 + hash(k, 5) * 40, top = VH - 90 - hh;
        ctx.fillStyle = p.far; rr(ctx, x + 20, top, bw, hh + 90, 6); ctx.fill();
        ctx.fillStyle = p.far2;
        if (kind === 'cupboard') { for (var pl = 0; pl < 3; pl++) { ctx.fillRect(x + 24, top + 30 + pl * 40, bw - 8, 4); for (var q = 0; q < 3; q++) ell(ctx, x + 40 + q * 26, top + 22 + pl * 40, 10, 8, 0, p.far2); } }
        else if (kk === 0) { ctx.fillRect(x + 20, top + hh * 0.45, bw, 3); ctx.fillRect(x + bw + 6, top + 14, 4, 30); ctx.fillRect(x + bw + 6, top + hh * 0.45 + 14, 4, 40);   // холодильник
          if (!retro) { circ(ctx, x + 40, top + 22, 4, 'rgba(255,120,90,.25)'); circ(ctx, x + 56, top + 30, 4, 'rgba(120,200,255,.2)'); } }
        else if (kk === 1) { rr(ctx, x + 32, top + 46, bw - 24, hh * 0.6, 6); ctx.fill(); for (var q2 = 0; q2 < 4; q2++) circ(ctx, x + 36 + q2 * (bw - 32) / 3, top + 22, 5, p.far2); }   // плита с духовкой
        else { ctx.fillRect(x + 20 + bw / 2 - 1, top, 2, hh + 90); ctx.fillRect(x + 20, top + 50, bw, 3); circ(ctx, x + 20 + bw / 2 - 8, top + 30, 3, p.far2); circ(ctx, x + 20 + bw / 2 + 8, top + 30, 3, p.far2); }   // шкафчик
        // висящие половники/ложки
        ctx.strokeStyle = p.far2; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + 160, 0); ctx.lineTo(x + 160, 70 + hash(k, 7) * 40); ctx.stroke();
        circ(ctx, x + 160, 78 + hash(k, 7) * 40, 9, p.far2);
      }
      // окно с вечерним светом
      if (kind === 'kitchen') { var wx = 380 - (cam.x * 0.12) % 900; ctx.fillStyle = col('rgba(255,180,100,.18)', E.n); rr(ctx, wx, 40, 120, 90, 4); ctx.fill(); ctx.fillStyle = p.far2; ctx.fillRect(wx + 58, 40, 4, 90); ctx.fillRect(wx, 84, 120, 4); }
    } else if (kind === 'tea') {
      // внутри чашки: блики, плавающие чаинки, лучи света
      if (!retro) for (i = 0; i < 5; i++) { ctx.fillStyle = 'rgba(255,240,200,.07)'; ctx.beginPath(); var bx = 80 + i * 130 + Math.sin(time * 0.3 + i) * 30; ctx.moveTo(bx, 0); ctx.lineTo(bx + 40, 0); ctx.lineTo(bx - 40, VH); ctx.lineTo(bx - 100, VH); ctx.fill(); }
      for (i = 0; i < 26; i++) {
        var lx = (hash(i, 1) * VW + Math.sin(time * 0.5 + i) * 20) % VW, ly = ((hash(i, 2) * 1400 - cam.y * 0.5 + time * 6 * (i % 3 + 1)) % (VH + 40) + VH + 40) % (VH + 40) - 20;
        ctx.save(); ctx.translate(lx, ly); ctx.rotate(time * 0.4 + i); ell(ctx, 0, 0, 5, 2, 0, col('rgba(70,35,10,.45)', E.k)); ctx.restore();
      }
      // поверхность чая
      var sy = LV.surface - cam.y;
      if (sy > -20 && sy < VH) {
        ctx.fillStyle = col('#f9ecd2', E.w); ctx.fillRect(0, 0, VW, sy);
        ctx.fillStyle = col('rgba(255,250,235,.8)', E.y); for (x = 0; x < VW; x += 8) ctx.fillRect(x, sy - 2 + Math.sin(x * 0.05 + time * 3) * 2, 8, 3);
      }
    }
  }

  function drawTiles(ctx, LV, cam, kind, time, S) {
    var Sp = tiles(kind), c0 = Math.floor(cam.x / T) - 1, c1 = Math.ceil((cam.x + VW) / T) + 1, r0 = Math.floor(cam.y / T) - 1, r1 = Math.ceil((cam.y + VH) / T) + 1, p = (retro ? PR : PM)[kind];
    for (var r = r0; r <= r1; r++) for (var c = c0; c <= c1; c++) {
      var v = L.tile(LV, c, r); if (v === C.E || r < 0 || r >= LV.h) continue;
      var x = c * T - cam.x, y = r * T - cam.y;
      if (v === C.S || v === C.W) { var above = L.tile(LV, c, r - 1); ctx.drawImage((above === C.S || above === C.W || above === C.X) ? Sp.body : Sp.top, Math.round(x), Math.round(y)); }
      else if (v === C.P) ctx.drawImage(Sp.shelf, Math.round(x), Math.round(y));
      else if (v === C.X) ctx.drawImage(Sp.forks, Math.round(x), Math.round(y));
      else if (v === C.F) {
        ctx.drawImage(Sp.grate, Math.round(x), Math.round(y));
        var on = L.burnerOn(LV, c, r, S.t);
        if (on) for (var k = 0; k < 3; k++) {
          var fh = 8 + Math.sin(time * 18 + c * 2 + k * 2) * 3 + hash(c, k) * 4, fx = x + 3 + k * 5;
          ctx.fillStyle = p.flame[2]; ctx.beginPath(); ctx.moveTo(fx - 2, y + T - 6); ctx.quadraticCurveTo(fx, y + T - 6 - fh, fx + 3, y + T - 6); ctx.fill();
          ctx.fillStyle = p.flame[1]; ctx.beginPath(); ctx.moveTo(fx - 1, y + T - 7); ctx.quadraticCurveTo(fx + 0.5, y + T - 7 - fh * 0.75, fx + 2, y + T - 7); ctx.fill();
        } else if (Math.floor(time * 4 + c) % 3 === 0) circ(ctx, x + 8, y + T - 8, 1.5, p.flame[2]);
      }
    }
    if (!retro && kind === 'tea') { ctx.fillStyle = 'rgba(80,40,10,.12)'; ctx.fillRect(0, 0, VW, VH); }
  }

  // ---------- объекты уровня ----------
  function drawHooks(ctx, LV, cam, time, S) {
    var P = retro ? PR.kitchen : PM.kitchen, h = S.hero;
    LV.hooks.forEach(function (k) {
      var x = k.x - cam.x, y = k.y - cam.y; if (x < -40 || x > VW + 40) return;
      var near = h && !h.hook && Math.hypot(k.x - h.x, k.y - (h.y - 28)) < K.GRAB_R + 30;
      if (LV.bgKind === 'cupboard') {   // латунный крючок для чашек на балке
        ctx.fillStyle = col('#6b4520', E.n); ctx.fillRect(x - 14, y - 26, 28, 6);
        line(ctx, x, y - 20, x, y - 4, col('#e8c06a', E.y), 3); ctx.strokeStyle = col('#ffd98a', E.y); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x - 5, y, 5, -0.4, Math.PI + 0.4); ctx.stroke();
      } else {   // вилка-лиана: ручка свисает с перекладины, зубцы загнуты крюком
        var sw = Math.sin(time * 1.6 + k.x) * 0.05; ctx.save(); ctx.translate(x, y - 64); ctx.rotate(sw);
        line(ctx, 0, -60, 0, 40, col('#8e96a3', E.l), 3); ctx.fillStyle = col('#cfd5de', E.w); rr(ctx, -4, 26, 8, 20, 3); ctx.fill();
        ctx.strokeStyle = col('#e2e7ee', E.w); ctx.lineWidth = 2;
        for (var i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * 3, 46); ctx.lineTo(i * 3, 58); ctx.quadraticCurveTo(i * 3, 68, i * 3 - 7, 64); ctx.stroke(); }
        ctx.restore();
      }
      if (near) { ctx.strokeStyle = col('rgba(255,230,140,.8)', E.y); ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(x, y, 10 + Math.sin(time * 8) * 2, 0, PI2); ctx.stroke(); ctx.setLineDash([]); }
    });
    // верёвка от руки к крюку
    if (h && h.hook) { var hk = h.hook; line(ctx, hk.ax - cam.x, hk.ay - cam.y, h.x + h.face * 4 - cam.x, h.y - K.HH - 4 - cam.y, col('#3b2a1c', E.k), 2); }
  }
  function drawTaps(ctx, LV, cam, time) {
    LV.taps.forEach(function (tp) {
      var x = tp.x - cam.x, y = tp.y - cam.y; if (x < -40 || x > VW + 40) return;
      // кран
      ctx.fillStyle = col('#c3ccd6', E.l); rr(ctx, x - 22, y - 26, 30, 8, 3); ctx.fill(); rr(ctx, x - 4, y - 22, 8, 14, 3); ctx.fill();
      ctx.fillStyle = col('#e9eef4', E.w); rr(ctx, x - 26, y - 34, 10, 10, 3); ctx.fill();
      ctx.fillStyle = col('#4fa8ff', E.B); circ(ctx, x - 21, y - 29, 2.5, col('#4fa8ff', E.B));
      // зона прохлады и капли
      if (!retro) { var g = ctx.createLinearGradient(0, y, 0, y + tp.len); g.addColorStop(0, 'rgba(120,200,255,.28)'); g.addColorStop(1, 'rgba(120,200,255,0)'); ctx.fillStyle = g; ctx.fillRect(x - 16, y - 8, 32, tp.len); }
      else { ctx.fillStyle = E.c; for (var yy = 0; yy < tp.len; yy += 8) ctx.fillRect(x - 12, y + yy, 2, 2), ctx.fillRect(x + 10, y + yy + 4, 2, 2); }
      for (var i = 0; i < 3; i++) { var dy = ((time * 160 + i * tp.len / 3) % tp.len); ell(ctx, x, y - 6 + dy, 2, 3, 0, col('#9fdcff', E.Cc)); }
    });
  }
  function drawMagnets(ctx, LV, cam, time, S) {
    LV.magnets.forEach(function (m) {
      var x = m.x - cam.x, y = m.y - cam.y; if (x < -60 || x > VW + 60) return;
      var off = S.magOff[m.id];
      if (off) y += 6;
      if (!off) { ctx.strokeStyle = col('rgba(255,90,90,.35)', E.R); ctx.lineWidth = 1.5; for (var i = 0; i < 3; i++) { var r = ((time * 40 + i * 33) % 100); ctx.globalAlpha = retro ? 1 : 1 - r / 100; ctx.beginPath(); ctx.arc(x, y, r, 0.2, Math.PI - 0.2); ctx.stroke(); } ctx.globalAlpha = 1; }
      // подкова-магнит «на холодильник»
      ctx.strokeStyle = off ? col('#6b6f78', E.d) : col('#e2413a', E.R); ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(x, y - 4, 11, Math.PI, 0, true); ctx.stroke();
      ctx.fillStyle = col('#d9dde3', E.w); ctx.fillRect(x - 15.5, y - 4, 9, 6); ctx.fillRect(x + 6.5, y - 4, 9, 6);
      if (!off) { circ(ctx, x - 3, y - 14, 1.6, '#fff'); circ(ctx, x + 3, y - 14, 1.6, '#fff'); }
    });
  }
  function drawBubbles(ctx, LV, cam, time) {
    LV.bubbles.forEach(function (b) {
      var x0 = b.x0 - cam.x, y0 = b.y0 - cam.y, y1 = b.y1 - cam.y; if (y1 < -20 || y0 > VH + 20) return;
      if (!retro) { var g = ctx.createLinearGradient(x0, 0, x0 + 32, 0); g.addColorStop(0, 'rgba(255,200,120,0)'); g.addColorStop(0.5, 'rgba(255,220,160,.22)'); g.addColorStop(1, 'rgba(255,200,120,0)'); ctx.fillStyle = g; ctx.fillRect(x0, y0, 32, y1 - y0); }
      // жерло горячего источника
      ell(ctx, x0 + 16, y1 - 2, 14, 4, 0, col('#ff9a3c', E.R));
      var n = Math.floor((y1 - y0) / 18);
      for (var i = 0; i < n; i++) { var yy = y1 - ((time * 90 + i * 18 + hash(i, b.x0) * 18) % (y1 - y0)), xx = x0 + 8 + hash(i, 3) * 16 + Math.sin(time * 4 + i) * 3, r = 2 + hash(i, 5) * 3;
        ctx.strokeStyle = col('rgba(255,255,255,.8)', E.w); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(xx, yy, r, 0, PI2); ctx.stroke(); }
    });
  }
  function drawItems(ctx, LV, cam, time, S) {
    LV.items.forEach(function (it) { if (!S.got[it.id]) item(ctx, it.k, it.x - cam.x, it.y - cam.y, time, it.x); });
    S.drops.forEach(function (d) { item(ctx, d.k, d.x - (cam.x || 0), d.y - (cam.y || 0), time, 1); });
    LV.cps.forEach(function (cp) {
      var x = cp.x - cam.x, y = cp.y - cam.y; if (x < -30 || x > VW + 30) return;
      var on = S.cp && S.cp.id === cp.id || S.got[cp.id];
      // чайная ложка-флажок, воткнутая в стол
      line(ctx, x, y, x, y - 34, col('#cfd5de', E.l), 3); ell(ctx, x, y - 38, 6, 8, 0, on ? col('#ffd34d', E.y) : col('#9aa3ad', E.l));
      if (on && !retro) { ctx.fillStyle = 'rgba(255,220,120,.25)'; circ(ctx, x, y - 38, 12 + Math.sin(time * 5) * 2, 'rgba(255,220,120,.2)'); }
    });
    LV.signs.forEach(function (sg) {
      var x = sg.x - cam.x, y = sg.y - cam.y; if (x < -60 || x > VW + 60) return;
      line(ctx, x, y, x, y - 18, col('#7b4f27', E.n), 2); ctx.fillStyle = col('#f4e2bf', E.w); rr(ctx, x - 12, y - 30, 24, 14, 2); ctx.fill();
      ctx.fillStyle = col('#7b4f27', E.n); ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('?', x, y - 19);
      var h = S.hero; if (h && Math.abs(h.x - sg.x) < 70 && Math.abs(h.y - sg.y) < 60 && signText) {
        var tx = signText(sg.key); ctx.font = retro ? 'bold 10px "Courier New", monospace' : '700 11px Inter, system-ui, sans-serif'; var w = ctx.measureText(tx).width + 14;
        ctx.fillStyle = col('rgba(20,12,14,.85)', E.k); rr(ctx, x - w / 2, y - 56, w, 18, 6); ctx.fill(); ctx.fillStyle = col('#ffe7a3', E.y); ctx.fillText(tx, x, y - 43);
      }
    });
    if (LV.goal) goalDraw(ctx, LV.goal, cam, time);
  }
  function item(ctx, k, x, y, time, seed) {
    if (x < -20 || x > VW + 20 || y < -20 || y > VH + 20) return;
    var b = Math.sin(time * 4 + seed * 0.1) * 2;
    if (k === 'sugar') { ctx.save(); ctx.translate(x, y + b); ctx.rotate(0.3 + Math.sin(time * 2 + seed) * 0.2); ctx.fillStyle = col('#ffffff', E.w); ctx.fillRect(-4, -4, 8, 8); ctx.fillStyle = col('#d7e6f5', E.l); ctx.fillRect(-4, 2, 8, 2); ctx.fillRect(2, -4, 2, 8); ctx.restore(); if (!retro && Math.floor(time * 3 + seed) % 4 === 0) circ(ctx, x + 4, y - 4 + b, 1.3, '#fff'); }
    else if (k === 'leaf') { ctx.save(); ctx.translate(x, y + b); ctx.rotate(-0.6); ell(ctx, 0, 0, 8, 4, 0, col('#5aa43a', E.g)); line(ctx, -7, 0, 7, 0, col('#2f6b1e', E.G), 1); ctx.restore(); if (!retro) circ(ctx, x, y + b, 11, 'rgba(120,220,90,.15)'); }
    else if (k === 'heart') { ctx.save(); ctx.translate(x, y + b); ctx.fillStyle = col('#ff5a6e', E.R); ctx.beginPath(); ctx.moveTo(0, 5); ctx.bezierCurveTo(-9, -2, -5, -9, 0, -4); ctx.bezierCurveTo(5, -9, 9, -2, 0, 5); ctx.fill(); ctx.restore(); }
  }
  function goalDraw(ctx, G, cam, time) {
    var x = G.x - cam.x, y = G.y - cam.y; if (x < -80 || x > VW + 80) return;
    if (G.k === 'hole') {   // мышиная норка в плинтусе: дальше — к столу
      ctx.fillStyle = col('#1a0f0c', E.k); ctx.beginPath(); ctx.arc(x, y, 20, Math.PI, 0); ctx.fill();
      ctx.strokeStyle = col('#c48a4a', E.y); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 21, Math.PI, 0); ctx.stroke();
      circ(ctx, x - 5, y - 9, 1.6, col('#ffe08a', E.y)); circ(ctx, x + 3, y - 9, 1.6, col('#ffe08a', E.y));
      arrow(ctx, x, y - 44 + Math.sin(time * 5) * 3);
    } else if (G.k === 'raft') {
      ell(ctx, x, y - 3, 26, 6, 0, col('#f7d23c', E.y)); ell(ctx, x, y - 4, 22, 4, 0, col('#fff6c0', E.w));
      for (var i = 0; i < 6; i++) line(ctx, x, y - 4, x + Math.cos(i / 6 * Math.PI * 2) * 20, y - 4 + Math.sin(i / 6 * Math.PI * 2) * 3.5, col('#f2b81c', E.n), 1);
      arrow(ctx, x, y - 40 + Math.sin(time * 5) * 3);
    }
  }
  function arrow(ctx, x, y) { ctx.fillStyle = col('#ffd34d', E.y); ctx.beginPath(); ctx.moveTo(x - 7, y); ctx.lineTo(x + 7, y); ctx.lineTo(x, y + 9); ctx.fill(); }

  // ---------- враги ----------
  function enemy(ctx, e, x, y, time, flyMode) {
    var d = L.EN[e.k], fl = e.flash > 0;
    ctx.save(); ctx.translate(Math.round(x), Math.round(y));
    if (fl && !retro) ctx.filter = 'brightness(2)';
    var dir = e.dir || -1, t = e.t || 0;
    switch (e.k) {
      case 'beetle':
        ctx.scale(-dir, 1);
        for (var i = 0; i < 3; i++) { var lp = Math.sin(time * 16 + i * 2) * 2; line(ctx, -6 + i * 6, -3, -8 + i * 6 + lp, 0, col('#2a1a10', E.k), 1.5); }
        ell(ctx, 0, -7, 11, 6, 0, col('#9a5a26', E.n)); ell(ctx, -2, -9, 7, 3, 0, col('#c88442', E.y));
        circ(ctx, 9, -6, 4, col('#5a3215', E.n)); circ(ctx, 10, -7, 1.3, col('#fff', E.w));
        line(ctx, 11, -9, 15, -14, col('#2a1a10', E.k), 1); line(ctx, 10, -9, 12, -15, col('#2a1a10', E.k), 1);
        circ(ctx, -4, -10, 1.2, col('#f5d9a6', E.w)); circ(ctx, 2, -11, 1, col('#f5d9a6', E.w));
        break;
      case 'pea':
        circ(ctx, 0, -7, 7, col('#6fc24a', E.G)); if (!retro) circ(ctx, -2, -9, 2.5, 'rgba(255,255,255,.35)');
        circ(ctx, -2, -8, 1.8, '#fff'); circ(ctx, 3, -8, 1.8, '#fff'); circ(ctx, -1.6, -7.6, 0.9, '#000'); circ(ctx, 3.4, -7.6, 0.9, '#000');
        line(ctx, -4, -11, -1, -10, '#1a3a10', 1.2); line(ctx, 5, -11, 2, -10, '#1a3a10', 1.2);
        break;
      case 'fly': case 'ffly':
        var wf = Math.sin(time * 50) * 0.5 + 0.5;
        ell(ctx, -3, -6 - wf * 4, 6, 3, -0.5, col('rgba(220,235,255,.7)', E.w)); ell(ctx, 3, -6 - wf * 4, 6, 3, 0.5, col('rgba(220,235,255,.7)', E.w));
        ell(ctx, 0, 0, 7, 5, 0, col('#2b2b33', E.d)); circ(ctx, -5, -1, 2.4, col('#d33', E.R)); circ(ctx, -1, -2, 2.4, col('#d33', E.R));
        break;
      case 'toaster':
        ctx.fillStyle = lg(ctx, 0, -22, 0, 0, [[0, '#e9eef4'], [1, '#8d97a3']]); rr(ctx, -14, -22, 28, 20, 5); ctx.fill();
        ctx.fillStyle = col('#2a2f36', E.k); ctx.fillRect(-9, -22, 7, 3); ctx.fillRect(2, -22, 7, 3);
        var pop = e.cd > 2.1 ? (e.cd - 2.1) * 30 : 0; ctx.fillStyle = col('#d9a05a', E.n); ctx.fillRect(-8, -22 - pop, 5, pop); ctx.fillRect(3, -22 - pop * 0.7, 5, pop * 0.7);
        circ(ctx, -5, -12, 2.4, '#fff'); circ(ctx, 5, -12, 2.4, '#fff'); circ(ctx, -4 + Math.sign(dir), -12, 1.2, '#000'); circ(ctx, 6 + Math.sign(dir), -12, 1.2, '#000');
        line(ctx, -7, -16, -3, -15, '#222', 1.2); line(ctx, 7, -16, 3, -15, '#222', 1.2);
        ctx.fillStyle = col('#555', E.d); ctx.fillRect(-12, -2, 4, 2); ctx.fillRect(8, -2, 4, 2);
        break;
      case 'leaffish':
        ctx.scale(-dir, 1); ell(ctx, 0, -5, 11, 5, 0, col('#3c6a24', E.g)); line(ctx, -9, -5, 9, -5, col('#24461a', E.k), 1);
        ctx.fillStyle = col('#3c6a24', E.g); ctx.beginPath(); ctx.moveTo(-10, -5); ctx.lineTo(-16, -10 + Math.sin(time * 10) * 2); ctx.lineTo(-16, 0 + Math.sin(time * 10) * 2); ctx.fill();
        circ(ctx, 6, -6, 2, '#fff'); circ(ctx, 6.6, -6, 1, '#000');
        break;
      case 'pip':
        ctx.fillStyle = col('#f2e6b0', E.y); ctx.beginPath(); ctx.moveTo(0, -14); ctx.quadraticCurveTo(7, -6, 0, 0); ctx.quadraticCurveTo(-7, -6, 0, -14); ctx.fill();
        circ(ctx, -2, -7, 1.4, '#000'); circ(ctx, 2, -7, 1.4, '#000');
        break;
      case 'moth':
        var mw = Math.sin(time * 18) * 0.4;
        ell(ctx, -2, -4, 12, 7, -0.4 - mw, col('#c9b38a', E.l)); ell(ctx, -2, 4, 11, 6, 0.4 + mw, col('#b39a6e', E.n));
        circ(ctx, -4, -5, 2.5, col('#7a5a3a', E.n)); ell(ctx, 2, 0, 8, 3.5, 0, col('#6b5236', E.n)); circ(ctx, -6, -1, 1.6, col('#000', E.k));
        line(ctx, -8, -2, -13, -8, col('#6b5236', E.n), 1);
        break;
      case 'pop':
        ctx.rotate(Math.sin(time * 3) * 0.3); ell(ctx, 0, 0, 8, 9, 0, col('#f2c14e', E.y)); ell(ctx, 0, -4, 6, 4, 0, col('#fff3d0', E.w));
        circ(ctx, -3, 1, 1.6, '#000'); circ(ctx, 3, 1, 1.6, '#000'); line(ctx, -2, 5, 2, 5, '#000', 1);
        break;
      case 'flake':
        ctx.rotate(t * 8); for (var q = 0; q < 4; q++) circ(ctx, Math.cos(q * 1.6) * 4, Math.sin(q * 1.6) * 4, 4, col('#fff8e6', E.w));
        break;
      case 'bee':   // кухонная оса-прихватка: полосатая, с жалом-шпажкой
        var bw = Math.sin(time * 40) * 0.5 + 0.5;
        ell(ctx, 2, -8 - bw * 3, 7, 4, 0.3, col('rgba(230,240,255,.7)', E.w));
        ell(ctx, 0, 0, 12, 8, 0, col('#e8a020', E.y)); ctx.fillStyle = col('#2a2018', E.k); ctx.fillRect(-4, -8, 3, 16); ctx.fillRect(3, -8, 3, 16);
        circ(ctx, -10, -2, 5, col('#2a2018', E.k)); circ(ctx, -11, -3, 1.6, '#fff'); line(ctx, 11, 0, 17, 0, col('#ccc', E.l), 1.5);
        break;
    }
    ctx.filter = 'none'; ctx.restore();
  }
  function eshot(ctx, s, x, y, time) {
    switch (s.k) {
      case 'toast': ctx.save(); ctx.translate(x, y); ctx.rotate(s.t * 9); ctx.fillStyle = col('#d9a05a', E.n); rr(ctx, -6, -6, 12, 12, 3); ctx.fill(); ctx.fillStyle = col('#f2d39a', E.y); ctx.fillRect(-4, -4, 8, 8); ctx.restore(); break;
      case 'cube': ctx.save(); ctx.translate(x, y); ctx.rotate(s.t * 7); ctx.fillStyle = col('#ffffff', E.w); ctx.fillRect(-5, -5, 10, 10); ctx.strokeStyle = col('#9ab', E.l); ctx.strokeRect(-5, -5, 10, 10); ctx.restore(); break;
      case 'drop': ell(ctx, x, y, 4, 5.5, 0, col('#b5651d', E.n)); if (!retro) circ(ctx, x - 1, y - 2, 1.2, 'rgba(255,255,255,.6)'); break;
      case 'milk': ctx.fillStyle = col('#fbfbf6', E.w); ctx.beginPath(); ctx.moveTo(x - 14, y); ctx.quadraticCurveTo(x - 8, y - 14 - Math.sin(time * 12) * 3, x, y - 10); ctx.quadraticCurveTo(x + 8, y - 16, x + 14, y); ctx.fill(); break;
      case 'ring': ctx.strokeStyle = col('#ffd38a', E.y); ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x, y - 6, 10, 8, 0, Math.PI, 0); ctx.stroke(); break;
      case 'sting': line(ctx, x - s.vx * 0.04, y - s.vy * 0.04, x, y, col('#e6e6e6', E.w), 2); circ(ctx, x, y, 2, col('#ff8a2a', E.R)); break;
    }
  }
  function puff(ctx, p, x, y) {
    var k = p.t / p.life;
    if (p.boil) {
      if (!retro) { var g = ctx.createRadialGradient(x, y, 2, x, y, p.r + 6); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,190,120,.9)'); g.addColorStop(1, 'rgba(255,90,40,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, p.r + 6, 0, PI2); ctx.fill(); }
      else { circ(ctx, x, y, p.r, E.R); circ(ctx, x, y, p.r * 0.6, E.y); circ(ctx, x, y, p.r * 0.3, E.w); }
      return;
    }
    ctx.globalAlpha = retro ? 1 : Math.max(0, 0.85 - k * 0.8);
    if (retro) { ctx.fillStyle = k < 0.6 ? E.w : E.l; var s = Math.round(p.r * 1.4); ctx.fillRect(Math.round(x - s / 2), Math.round(y - s / 2), s, s); }
    else circ(ctx, x, y, p.r, '#ffffff');
    ctx.globalAlpha = 1;
  }

  // ---------- Сервиз ----------
  function porcelain(ctx, k, x, y, p, time, B) {
    var d = L.BOSS[k], sh = (k === 'teapot' && B.stage === 1);
    ctx.save(); ctx.translate(Math.round(x), Math.round(y));
    if (p.inv > 0 && Math.floor(p.inv * 20) % 2 === 0) ctx.globalAlpha = 0.6;
    var white = col('#f7f4ee', E.w), blue = col('#2f63b8', E.B), rim = col('#3a3f4a', E.k), hot = p.temp > 0 ? 'rgba(255,90,40,' + (p.temp * 0.45) + ')' : null;
    var wob = Math.sin(time * 5 + d.w) * 1.5;
    ctx.translate(0, wob * 0.3);
    if (k === 'sugar') {
      ctx.fillStyle = white; rr(ctx, -22, -30, 44, 30, 10); ctx.fill(); ctx.strokeStyle = rim; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.strokeStyle = blue; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(-26, -16, 6, 1.2, 5); ctx.stroke(); ctx.beginPath(); ctx.arc(26, -16, 6, -1.9, 1.9); ctx.stroke();
      var lift = p.cd < 0.4 ? (0.4 - p.cd) * 30 : 0;
      ctx.fillStyle = white; rr(ctx, -20, -36 - lift, 40, 7, 3); ctx.fill(); ctx.strokeStyle = rim; ctx.stroke(); circ(ctx, 0, -39 - lift, 3.5, blue);
      flowers(ctx, blue, -12, -14); flowers(ctx, blue, 12, -12);
    } else if (k === 'creamer') {
      ctx.fillStyle = white; ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(-16, -30); ctx.quadraticCurveTo(-16, -42, -6, -44); ctx.lineTo(14, -44); ctx.lineTo(18, -48); ctx.lineTo(16, -38); ctx.quadraticCurveTo(18, -20, 14, 0); ctx.closePath(); ctx.fill(); ctx.strokeStyle = rim; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.strokeStyle = blue; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(-18, -22, 7, 1.4, 4.9); ctx.stroke();
      flowers(ctx, blue, 0, -18);
    } else {
      // заварник в краже: на голове — латунная Крышка героя
      ctx.fillStyle = white; ctx.beginPath(); ctx.ellipse(0, -22, 29, 22, 0, 0, PI2); ctx.fill(); ctx.strokeStyle = rim; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.fillStyle = white; ctx.beginPath(); ctx.moveTo(24, -24); ctx.quadraticCurveTo(40, -26, 44, -44); ctx.lineTo(38, -42); ctx.quadraticCurveTo(34, -30, 24, -16); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = blue; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(-30, -24, 9, 1.4, 4.9); ctx.stroke();
      flowers(ctx, blue, -10, -20); flowers(ctx, blue, 10, -14); ctx.fillStyle = blue; ctx.fillRect(-26, -8, 52, 2);
      if (!p.dead) { ctx.fillStyle = lg(ctx, 0, -52, 0, -42, [[0, '#ffe7a3'], [1, '#a8701f']]); ell(ctx, 0, -45, 14, 5, 0, ctx.fillStyle); circ(ctx, 0, -52, 4, col('#d9a43c', E.y)); if (!retro) circ(ctx, -1, -53, 1.4, '#fff'); }
      if (sh) { ctx.strokeStyle = col('rgba(140,200,255,' + (0.4 + Math.sin(time * 6) * 0.2) + ')', E.Cc); ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, -26, 36, 32, 0, 0, PI2); ctx.stroke(); }
    }
    // лица: брови-домиком злодеев
    var fy = k === 'teapot' ? -26 : k === 'sugar' ? -20 : -32;
    circ(ctx, -6, fy, 3.4, '#fff'); circ(ctx, 6, fy, 3.4, '#fff'); ctx.strokeStyle = rim; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(-6, fy, 3.4, 0, PI2); ctx.stroke(); ctx.beginPath(); ctx.arc(6, fy, 3.4, 0, PI2); ctx.stroke();
    circ(ctx, -5, fy + 0.5, 1.6, '#000'); circ(ctx, 7, fy + 0.5, 1.6, '#000');
    line(ctx, -10, fy - 6, -3, fy - 3, rim, 1.6); line(ctx, 10, fy - 6, 3, fy - 3, rim, 1.6);
    if (k === 'teapot') { ctx.strokeStyle = rim; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-8, fy + 8); ctx.quadraticCurveTo(-4, fy + 5, 0, fy + 8); ctx.quadraticCurveTo(4, fy + 5, 8, fy + 8); ctx.stroke(); }
    // трещины
    if (p.cracks) { ctx.strokeStyle = rim; ctx.lineWidth = 1.1; for (var c = 0; c < p.cracks; c++) { var cx = (hash(c, d.w) - 0.5) * d.w * 0.7, cy = -d.h * (0.3 + hash(c, 9) * 0.5); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + 5, cy + 6); ctx.lineTo(cx + 1, cy + 11); ctx.moveTo(cx + 5, cy + 6); ctx.lineTo(cx + 11, cy + 4); ctx.stroke(); } }
    if (hot && !retro) { ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = hot; ctx.fillRect(-d.w, -d.h - 10, d.w * 2, d.h + 10); ctx.globalCompositeOperation = 'source-over'; }
    if (retro && p.temp >= 0.5) { ctx.fillStyle = E.R; ctx.fillRect(-3, -d.h - 14, 6, 6); }
    ctx.restore();
  }
  function flowers(ctx, c, x, y) { for (var i = 0; i < 5; i++) circ(ctx, x + Math.cos(i * 1.26) * 3, y + Math.sin(i * 1.26) * 3, 1.6, c); circ(ctx, x, y, 1.2, col('#f2c14e', E.y)); }

  // ---------- сцены ----------
  function heroOpts(S, h, time) {
    var o = { face: h.face, t: h.anim || time, aim: h.aim, firing: h.firing, heat: S.heat, over: S.over, inv: h.inv, land: h.land, idle: S.idleStage };
    o.pose = h.hook ? 'hang' : !h.ground ? (h.water ? 'jump' : 'jump') : Math.abs(h.vx) > 20 ? 'run' : 'stand';
    if (S.phase === 'dead') o.death = { kind: S.deathKind, t: S.phaseT };
    return o;
  }
  function drawPlat(g, ctx, S, ui, time) {
    var LV = ui.LV, cam = ui.cam, kind = LV.bgKind, h = S.hero;
    drawBg(ctx, kind, cam, time, LV);
    if (LV.bubbles.length) drawBubbles(ctx, LV, cam, time);
    drawTaps(ctx, LV, cam, time);
    drawTiles(ctx, LV, cam, kind, time, S);
    drawMagnets(ctx, LV, cam, time, S);
    drawItems(ctx, LV, cam, time, S);
    drawHooks(ctx, LV, cam, time, S);
    // враги
    S.enemies.forEach(function (e) { if (!e.dead) enemy(ctx, e, e.x - cam.x, e.y - cam.y, time); });
    // Сервиз
    if (S.boss) {
      var B = S.boss, al = B.parts.filter(function (p) { return !p.dead; });
      if (B.stage === 1) for (var i = 0; i + 1 < al.length; i++) {   // фарфоровая цепочка из блюдечек
        var a = al[i], b = al[i + 1], cy = LV.arena.floor - 26 - cam.y;
        for (var x = a.x + 12; x < b.x - 12; x += 9) { var yy = cy + Math.sin((x - a.x) / (b.x - a.x) * Math.PI) * 4; ell(ctx, x - cam.x, yy, 4, 2, 0, col('#f2c14e', E.y)); if (!retro && Math.floor(time * 10 + x) % 7 === 0) circ(ctx, x - cam.x, yy - 3, 1.5, '#fff8c0'); }
      }
      B.parts.forEach(function (p) { if (!p.dead) porcelain(ctx, p.k, p.x - cam.x, p.y - cam.y, p, time, B); });
      if (B.lid) { var L2 = B.lid; ell(ctx, L2.x - cam.x, L2.y - cam.y, 14, 5, 0, col('#d9a43c', E.y)); circ(ctx, L2.x - cam.x, L2.y - 7 - cam.y, 4, col('#ffe7a3', E.y)); arrow(ctx, L2.x - cam.x, L2.y - 34 - cam.y + Math.sin(time * 6) * 3); }
    }
    // герой
    if (h) {
      var o = heroOpts(S, h, time), hx = h.x - cam.x, hy = h.y - cam.y;
      if (S.phase === 'dead' && S.deathKind === 'fall') hy = Math.min(hy, VH + 40);
      kettle(ctx, hx, hy, o);
      // сценки бездействия
      if (S.idleStage === 1 && S.phase === 'play') { ctx.fillStyle = col('#ffe08a', E.y); ctx.font = 'bold 14px serif'; ctx.textAlign = 'center'; ctx.fillText('♪', hx + h.face * 22 + Math.sin(time * 4) * 3, hy - 34 - (time * 20 % 14)); ctx.fillText('♫', hx + h.face * 30, hy - 44 - ((time * 20 + 7) % 14)); }
      if (S.idleStage === 2 && S.phase === 'play') for (var r = 0; r < 3; r++) { var rt = (time * 0.8 + r / 3) % 1; ctx.strokeStyle = col('rgba(255,255,255,' + (1 - rt) + ')', E.w); ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(hx + h.face * 2, hy - 34 - rt * 50, 4 + rt * 6, 2 + rt * 2, 0, 0, PI2); ctx.stroke(); }
      if (S.idleStage === 3 && S.phase === 'play') { ctx.fillStyle = col('#cfe6ff', E.Cc); ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'left'; for (var z = 0; z < 3; z++) { var zt = (time * 0.6 + z / 3) % 1; ctx.globalAlpha = retro ? 1 : 1 - zt; ctx.fillText('z', hx + 10 + zt * 16, hy - 32 - zt * 30); } ctx.globalAlpha = 1; }
    }
    S.puffs.forEach(function (p) { puff(ctx, p, p.x - cam.x, p.y - cam.y); });
    S.eshots.forEach(function (s) { eshot(ctx, s, s.x - cam.x, s.y - cam.y, time); });
    ctx.save(); ctx.translate(-cam.x, -cam.y); FX.draw(ctx); ctx.restore();
  }

  // ---------- гонка ----------
  function drawRace(g, ctx, S, ui, time) {
    var R = S.race, TR = L.TRACK, cam = ui.cam;
    var sky = retro ? [E.b, E.b, E.c] : ['#2d2140', '#7a4b6a', '#f0a36a'];
    ctx.fillStyle = lg(ctx, 0, 0, 0, VH, [[0, sky[0]], [0.6, sky[1]], [1, sky[2]]]); ctx.fillRect(0, 0, VW, VH);
    // дальний план: кружки, вазочки, огромный заварник-силуэт вдали
    var i, x;
    for (i = -1; i < 8; i++) { x = (-(cam.x * 0.25) % 160) + i * 160; var k = Math.floor(cam.x * 0.25 / 160) + i; ctx.fillStyle = col('rgba(40,20,40,.5)', E.k); rr(ctx, x, 130 - hash(k, 2) * 40, 50 + hash(k, 4) * 30, 160, 8); ctx.fill(); }
    // скатерть: клетка «гусиная лапка» — свои цвета: бирюза с кремом
    ctx.save();
    ctx.beginPath(); ctx.moveTo(0, VH);
    for (x = 0; x <= VW; x += 8) { var wx = cam.x + x, hole = L.holeAt(wx); ctx.lineTo(x, hole ? VH + 10 : L.trackY(wx) - cam.y); }
    ctx.lineTo(VW, VH); ctx.closePath(); ctx.clip();
    ctx.fillStyle = col('#f3ead6', E.w); ctx.fillRect(0, 0, VW, VH);
    ctx.fillStyle = col('rgba(40,150,150,.45)', E.c);
    var off = -(cam.x % 40);
    for (x = off - 40; x < VW; x += 40) { ctx.fillRect(x, 0, 20, VH); }
    ctx.fillStyle = col('rgba(40,150,150,.3)', E.c); for (var y = -(cam.y % 40); y < VH; y += 40) ctx.fillRect(0, y, VW, 20);
    ctx.restore();
    // кромка скатерти
    ctx.strokeStyle = col('#d4c6a8', E.l); ctx.lineWidth = 3; ctx.beginPath();
    for (x = 0; x <= VW; x += 8) { var wx2 = cam.x + x; if (L.holeAt(wx2)) { ctx.stroke(); ctx.beginPath(); continue; } var yy = L.trackY(wx2) - cam.y; if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy); }
    ctx.stroke();
    // препятствия
    TR.obs.forEach(function (o) {
      if (R.got[o.id] && o.k !== 'tap' && o.k !== 'jam' && o.k !== 'hole') return;
      var ox = o.x - cam.x; if (ox < -120 || ox > VW + 120) return; var gy = L.trackY(o.x) - cam.y;
      if (o.k === 'crumb') { ell(ctx, ox + 7, gy - 4, 8, 5, 0.3, col('#c98a4a', E.n)); ell(ctx, ox + 4, gy - 6, 3, 2, 0, col('#e8b878', E.y)); }
      else if (o.k === 'shaker') { ctx.fillStyle = lg(ctx, ox, 0, ox + 18, 0, [[0, '#e9eef4'], [1, '#9aa5b2']]); rr(ctx, ox, gy - 34, 18, 34, 5); ctx.fill(); ctx.fillStyle = col('#c3ccd6', E.l); rr(ctx, ox + 1, gy - 38, 16, 7, 3); ctx.fill(); ctx.fillStyle = col('#3a3f4a', E.k); for (var j = 0; j < 3; j++) circ(ctx, ox + 5 + j * 4, gy - 35, 0.9, col('#3a3f4a', E.k)); circ(ctx, ox + 6, gy - 20, 1.8, '#fff'); circ(ctx, ox + 12, gy - 20, 1.8, '#fff'); circ(ctx, ox + 6.5, gy - 20, 0.9, '#000'); circ(ctx, ox + 12.5, gy - 20, 0.9, '#000'); }
      else if (o.k === 'jam') { ell(ctx, ox + o.w / 2, gy - 1, o.w / 2, 4, Math.atan((L.trackY(o.x + o.w) - L.trackY(o.x)) / o.w), col('rgba(170,20,60,.85)', E.m)); if (!retro) ell(ctx, ox + o.w / 2 - 10, gy - 3, 8, 1.5, 0, 'rgba(255,255,255,.4)'); }
      else if (o.k === 'hole') { ctx.fillStyle = col('#1a0f14', E.k); ctx.fillRect(ox, gy, o.w, VH - gy); }
      else if (o.k === 'spoon') { ctx.save(); ctx.translate(ox, gy); ctx.rotate(-0.35); ctx.fillStyle = col('#cfd5de', E.l); rr(ctx, 0, -4, 40, 5, 2); ctx.fill(); ell(ctx, 40, -3, 9, 5, 0, col('#e2e7ee', E.w)); ctx.restore(); }
      else if (o.k === 'tap') { var tx = ox + o.w / 2; ctx.fillStyle = col('#c3ccd6', E.l); rr(ctx, tx - 20, 10, 26, 8, 3); ctx.fill(); for (var q = 0; q < 4; q++) { var dy = (time * 220 + q * 60) % (gy - 20); ell(ctx, tx - 4 + (q % 2) * 6, 20 + dy, 2, 3, 0, col('#9fdcff', E.Cc)); } if (!retro) { ctx.fillStyle = 'rgba(120,200,255,.14)'; ctx.fillRect(ox, 0, o.w, gy); } }
      else if (o.k === 'sugar' || o.k === 'leaf') item(ctx, o.k, ox, gy - o.h, time, o.x);
    });
    // финиш: ленточка
    var fx2 = TR.len - cam.x; if (fx2 > -40 && fx2 < VW + 40) { var fy = L.trackY(TR.len) - cam.y; line(ctx, fx2, fy, fx2, fy - 70, col('#7b4f27', E.n), 3); for (var c2 = 0; c2 < 6; c2++) { ctx.fillStyle = c2 % 2 ? col('#fff', E.w) : col('#222', E.k); ctx.fillRect(fx2, fy - 70 + c2 * 6, 14, 6); } }
    // соперник: перечница
    var rxs = R.rx - cam.x, rys = L.trackY(R.rx) - cam.y;
    if (rxs > -60 && rxs < VW + 60) {
      ctx.save(); ctx.translate(rxs, rys); ctx.rotate(Math.atan((L.trackY(R.rx + 6) - L.trackY(R.rx - 6)) / 12) + (R.rtrip > 0 ? Math.sin(time * 30) * 0.5 : 0));
      ctx.fillStyle = col('#3a2a22', E.n); rr(ctx, -9, -40, 18, 34, 6); ctx.fill(); ctx.fillStyle = col('#6b4a36', E.n); rr(ctx, -11, -46, 22, 9, 4); ctx.fill(); circ(ctx, 0, -50, 3, col('#c9973a', E.y));
      circ(ctx, -3, -28, 2.6, '#fff'); circ(ctx, 4, -28, 2.6, '#fff'); circ(ctx, -2, -28, 1.2, '#000'); circ(ctx, 5, -28, 1.2, '#000'); line(ctx, -6, -32, -1, -31, '#000', 1.2); line(ctx, 7, -32, 2, -31, '#000', 1.2);
      ctx.fillStyle = col('#8a5a3a', E.n); rr(ctx, -12, -6, 24, 6, 3); ctx.fill();
      ctx.restore();
    }
    // наш: сахарница-сани + чайник
    var hx = R.x - cam.x, hy = R.y - cam.y;
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(R.ang + (R.crash > 0 ? Math.sin(time * 40) * 0.4 : 0));
    ctx.fillStyle = col('#f7f4ee', E.w); rr(ctx, -20, -14, 40, 13, 6); ctx.fill(); ctx.strokeStyle = col('#3a3f4a', E.k); ctx.lineWidth = 1; ctx.stroke();
    flowers(ctx, col('#2f63b8', E.B), -8, -8); flowers(ctx, col('#2f63b8', E.B), 8, -8);
    ctx.strokeStyle = col('#c9973a', E.y); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-22, 0); ctx.lineTo(20, 0); ctx.quadraticCurveTo(28, 0, 26, -8); ctx.stroke();
    if (R.boostOn && !S.over) for (var b = 0; b < 3; b++) circ(ctx, -24 - b * 7 - Math.random() * 4, -12 + Math.random() * 4, 4 + b, col('rgba(255,255,255,.7)', E.w));
    kettle(ctx, 0, -12, { face: 1, t: time, pose: 'sled', heat: S.heat, over: S.over, aim: 'f', firing: false, inv: R.inv, death: S.phase === 'dead' ? { kind: 'race', t: S.phaseT } : null });
    ctx.restore();
    ctx.save(); ctx.translate(-cam.x, -cam.y); FX.draw(ctx); ctx.restore();
  }

  // ---------- головоломка ----------
  var PZ_CELL = 32, PZ_X = (VW - 16 * 32) / 2, PZ_Y = 42;
  function drawPuzzle(g, ctx, S, ui, time) {
    var B = L.PB, P = S.pz, s = P.s, i;
    ctx.fillStyle = lg(ctx, 0, 0, 0, VH, [[0, '#2a1d24'], [1, '#14100f']]); ctx.fillRect(0, 0, VW, VH);
    if (!retro) { ctx.fillStyle = 'rgba(255,200,120,.06)'; circ(ctx, VW / 2, 80, 260, 'rgba(255,200,120,.05)'); }
    var cx = function (k) { return PZ_X + (k % B.w) * PZ_CELL; }, cy = function (k) { return PZ_Y + Math.floor(k / B.w) * PZ_CELL; };
    // скатерть
    for (var y = 0; y < B.h; y++) for (var x = 0; x < B.w; x++) {
      var X = PZ_X + x * PZ_CELL, Y = PZ_Y + y * PZ_CELL;
      ctx.fillStyle = ((x + y) & 1) ? col('#ece0c6', E.w) : col('#d9c7a2', E.l); ctx.fillRect(X, Y, PZ_CELL, PZ_CELL);
    }
    // стены: банки и хлебница
    B.walls.forEach(function (k) {
      var X = cx(k), Y = cy(k), v = hash(k, 1);
      ctx.fillStyle = col('#3a2a20', E.k); ctx.fillRect(X, Y, PZ_CELL, PZ_CELL);
      if (v < 0.55) { ctx.fillStyle = v < 0.3 ? col('#7a4a2b', E.n) : col('#8a5d3a', E.n); rr(ctx, X + 3, Y + 3, 26, 26, 6); ctx.fill(); ctx.fillStyle = col('#c9973a', E.y); rr(ctx, X + 5, Y + 5, 22, 6, 3); ctx.fill(); }
      else { ctx.fillStyle = col('#8d97a3', E.l); rr(ctx, X + 3, Y + 3, 26, 26, 5); ctx.fill(); ctx.fillStyle = col('#c3ccd6', E.w); rr(ctx, X + 6, Y + 6, 20, 20, 4); ctx.fill(); ctx.fillStyle = col('#8d97a3', E.d); ctx.fillRect(X + 13, Y + 14, 6, 4); }
    });
    // будильник, кран, конфорки, цель
    var on = CH.puzzle.burnOn(B, s.t);
    B.burners.forEach(function (k) { var X = cx(k) + 16, Y = cy(k) + 16, cov = s.cups.indexOf(k) >= 0; circ(ctx, X, Y, 14, col('#2a2a30', E.d)); ctx.strokeStyle = col('#555a64', E.l); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X, Y, 9, 0, PI2); ctx.stroke(); if (on && !cov) { for (var f = 0; f < 8; f++) { var a = f / 8 * PI2; circ(ctx, X + Math.cos(a) * 9, Y + Math.sin(a) * 9, 3 + Math.sin(time * 20 + f) * 1, col('#4fa8ff', E.B)); } } if (!cov) { ctx.fillStyle = on ? col('#ff8a2a', E.R) : col('#888', E.l); ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(on ? '!' : '', X, Y + 3); } });
    B.taps.forEach(function (k) { var X = cx(k), Y = cy(k); ctx.fillStyle = col('rgba(120,200,255,.5)', E.c); ctx.fillRect(X + 2, Y + 2, 28, 28); ctx.fillStyle = col('#c3ccd6', E.l); rr(ctx, X + 8, Y + 4, 16, 6, 2); ctx.fill(); ell(ctx, X + 16, Y + 18 + (time * 30 % 10), 2, 3, 0, col('#9fdcff', E.Cc)); });
    if (B.clockAt >= 0) { var X1 = cx(B.clockAt) + 16, Y1 = cy(B.clockAt) + 17, ring = s.clock && B.limit - s.t <= 6; ctx.save(); ctx.translate(X1, Y1); if (ring) ctx.rotate(Math.sin(time * 40) * 0.15); circ(ctx, 0, 0, 12, s.clock ? col('#e2413a', E.R) : col('#777', E.d)); circ(ctx, 0, 0, 9, col('#fff8e6', E.w)); line(ctx, 0, 0, 0, -6, '#000', 1.5); line(ctx, 0, 0, Math.cos(s.t / B.limit * PI2 - Math.PI / 2) * 7, Math.sin(s.t / B.limit * PI2 - Math.PI / 2) * 7, col('#e2413a', E.R), 1.5); circ(ctx, -9, -10, 4, s.clock ? col('#ffd34d', E.y) : col('#999', E.l)); circ(ctx, 9, -10, 4, s.clock ? col('#ffd34d', E.y) : col('#999', E.l)); ctx.restore(); }
    var G = B.goal; ell(ctx, cx(G) + 16, cy(G) + 18, 13, 11, 0, col('#f7f4ee', E.w)); ell(ctx, cx(G) + 16, cy(G) + 16, 10, 7, 0, col('#9a4a1a', E.n)); ctx.strokeStyle = col('#f7f4ee', E.w); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx(G) + 29, cy(G) + 18, 5, -1.2, 1.2); ctx.stroke();
    if (!retro) { ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1; for (var w = 0; w < 2; w++) { ctx.beginPath(); ctx.moveTo(cx(G) + 12 + w * 6, cy(G) + 6); ctx.quadraticCurveTo(cx(G) + 9 + w * 6, cy(G) - 2 - (time * 8 % 6), cx(G) + 13 + w * 6, cy(G) - 8); ctx.stroke(); } }
    // крошки, чашки
    s.crumbs.forEach(function (k) { var X = cx(k) + 16, Y = cy(k) + 16; for (var c = 0; c < 4; c++) ell(ctx, X - 6 + hash(k, c) * 12, Y - 6 + hash(c, k) * 12, 3, 2, c, col('#c98a4a', E.n)); });
    s.cups.forEach(function (k) { var X = cx(k) + 16, Y = cy(k) + 16; circ(ctx, X, Y, 13, col('#f7f4ee', E.w)); circ(ctx, X, Y, 9, col('#2f63b8', E.B)); circ(ctx, X, Y, 6, col('#f7f4ee', E.w)); ctx.strokeStyle = col('#f7f4ee', E.w); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(X + 13, Y, 4, -1.4, 1.4); ctx.stroke(); });
    // спящий сахарок
    var sugX, sugY;
    if (!s.carry) { sugX = PZ_X + s.sx * PZ_CELL + 16; sugY = PZ_Y + s.sy * PZ_CELL + 18; }
    // чайник
    var k2 = P.anim > 0 && P.from ? Math.max(0, P.anim / 0.12) : 0;
    var hx = PZ_X + (s.x + (P.from ? (P.from.x - s.x) * k2 : 0)) * PZ_CELL + 16, hy = PZ_Y + (s.y + (P.from ? (P.from.y - s.y) * k2 : 0)) * PZ_CELL + 28;
    var dead = S.phase === 'dead';
    if (sugX != null) sugarCube(ctx, sugX, sugY, time, dead && P.fail);
    kettle(ctx, hx, hy, { face: s.f === 'L' ? -1 : 1, t: time, pose: s.carry ? 'carry' : (P.anim > 0 ? 'run' : 'stand'), aim: s.f === 'U' ? 'u' : s.f === 'D' ? 'd' : 'f', scale: 0.8, firing: P.lastAct && P.lastAct[0] === 'p' && P.anim > 0, heat: s.heat / 3 });
    if (s.carry) sugarCube(ctx, hx, hy - 38, time, dead && P.fail);
    S.puffs.forEach(function (p) { puff(ctx, p, p.x, p.y); });
    FX.draw(ctx);
  }
  function sugarCube(ctx, x, y, time, awake) {
    ctx.save(); ctx.translate(x, y + (awake ? -Math.abs(Math.sin(time * 14)) * 6 : 0));
    ctx.fillStyle = col('#ffffff', E.w); rr(ctx, -9, -9, 18, 16, 3); ctx.fill(); ctx.strokeStyle = col('#9ab', E.l); ctx.lineWidth = 1; ctx.stroke();
    if (!retro) { ctx.fillStyle = 'rgba(160,190,220,.4)'; ctx.fillRect(-9, 3, 18, 4); }
    if (awake) { circ(ctx, -3, -2, 2.6, '#fff'); circ(ctx, 4, -2, 2.6, '#fff'); ctx.strokeStyle = '#000'; ctx.beginPath(); ctx.arc(-3, -2, 2.6, 0, PI2); ctx.stroke(); ctx.beginPath(); ctx.arc(4, -2, 2.6, 0, PI2); ctx.stroke(); circ(ctx, -3, -2, 1.1, '#000'); circ(ctx, 4, -2, 1.1, '#000'); circ(ctx, 0.5, 4, 2, '#000'); }
    else { line(ctx, -5, -2, -1, -2, '#556', 1.2); line(ctx, 2, -2, 6, -2, '#556', 1.2); ctx.fillStyle = col('#9ec7ff', E.Cc); ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'left'; var z = (time * 0.7) % 1; ctx.globalAlpha = retro ? 1 : 1 - z; ctx.fillText('z', 8 + z * 8, -10 - z * 12); ctx.globalAlpha = 1; }
    ctx.restore();
  }

  // ---------- полёт ----------
  function drawFly(g, ctx, S, ui, time) {
    var F = S.fly, sc = F.scroll, i;
    // над плитой: тёплый пар, полки, вытяжка; дальний план — шкафчики
    ctx.fillStyle = lg(ctx, 0, 0, 0, VH, [[0, '#2b3550'], [0.55, '#55607a'], [1, '#c9805a']]); ctx.fillRect(0, 0, VW, VH);
    if (retro) { ctx.fillStyle = E.b; ctx.fillRect(0, 0, VW, VH * 0.6); ctx.fillStyle = E.c; ctx.fillRect(0, VH * 0.6, VW, VH * 0.4); }
    for (i = -1; i < 6; i++) { var x = -(sc * 0.3 % 180) + i * 180, k = Math.floor(sc * 0.3 / 180) + i; ctx.fillStyle = col('rgba(30,30,50,.55)', E.k); rr(ctx, x, 20 + hash(k, 1) * 20, 120, 70, 6); ctx.fill(); ctx.fillStyle = col('rgba(255,220,150,.25)', E.n); ctx.fillRect(x + 56, 30 + hash(k, 1) * 20, 8, 40); }
    for (i = -1; i < 8; i++) { var x2 = -(sc * 0.7 % 120) + i * 120, k2 = Math.floor(sc * 0.7 / 120) + i, yy2 = VH - 40 - hash(k2, 2) * 50 - ((time * 30 + hash(k2, 4) * 200) % 160);
      if (!retro) for (var cq = 0; cq < 3; cq++) circ(ctx, x2 + cq * 14 - 14, yy2 + Math.sin(cq * 2) * 6, 12 + hash(k2, cq) * 8, 'rgba(255,255,255,.07)'); else if (k2 % 2) ctx.fillStyle = E.l, ctx.fillRect(x2, yy2, 16, 8); }
    // плита внизу
    ctx.fillStyle = col('#2a2a30', E.d); ctx.fillRect(0, VH - 14, VW, 14);
    for (i = -1; i < 12; i++) { var bx = -(sc % 80) + i * 80; ell(ctx, bx, VH - 14, 26, 5, 0, col('#555a64', E.l)); if (Math.floor(time * 6 + i) % 2) for (var f = 0; f < 4; f++) circ(ctx, bx - 15 + f * 10, VH - 18, 2.5, col('#4fa8ff', E.B)); }
    // облака холода
    F.clouds.forEach(function (c) { for (var q = 0; q < 6; q++) circ(ctx, c.x + Math.cos(q) * c.r * 0.6, c.y + Math.sin(q * 1.3) * c.r * 0.35, c.r * 0.45, col('rgba(190,230,255,.35)', E.Cc)); if (!retro) for (var s2 = 0; s2 < 5; s2++) { ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.font = '10px sans-serif'; ctx.fillText('*', c.x - 30 + hash(s2, 7) * 60, c.y - 10 + ((time * 20 + s2 * 13) % 30)); } });
    S.drops.forEach(function (d) { item(ctx, d.k, d.x, d.y, time, 1); });
    S.enemies.forEach(function (e) { if (!e.dead && e.t >= 0) enemy(ctx, e, e.x, e.y + (e.k === 'ffly' || e.k === 'bee' || e.k === 'moth' || e.k === 'pop' || e.k === 'flake' ? 0 : 0), time, true); });
    // мухобойка
    if (F.boss && !F.boss.dead) {
      var B = F.boss;
      if (B.st === 'aim') { ctx.fillStyle = col('rgba(0,0,0,.25)', E.d); ctx.fillRect(B.col - 30, 40, 60, VH - 54); if (retro) { ctx.fillStyle = E.R; ctx.fillRect(B.col - 2, VH - 30, 4, 4); } }
      ctx.save(); ctx.translate(B.x, B.y); if (B.flash > 0 && !retro) ctx.filter = 'brightness(1.8)';
      ctx.fillStyle = col('#3aa35a', E.g); rr(ctx, -30, -10, 60, 52, 6); ctx.fill(); ctx.strokeStyle = col('#1f6b38', E.k); ctx.lineWidth = 1.5;
      for (var gx = -24; gx <= 24; gx += 8) { ctx.beginPath(); ctx.moveTo(gx, -8); ctx.lineTo(gx, 40); ctx.stroke(); } for (var gy = -4; gy <= 36; gy += 8) { ctx.beginPath(); ctx.moveTo(-28, gy); ctx.lineTo(28, gy); ctx.stroke(); }
      ctx.fillStyle = col('#2f8a4a', E.g); ctx.fillRect(-4, -200, 8, 192);
      circ(ctx, -10, 10, 5, '#fff'); circ(ctx, 10, 10, 5, '#fff'); circ(ctx, -9, 11, 2.2, '#000'); circ(ctx, 11, 11, 2.2, '#000'); line(ctx, -16, 2, -5, 6, '#000', 2); line(ctx, 16, 2, 5, 6, '#000', 2);
      ctx.filter = 'none'; ctx.restore();
    }
    S.eshots.forEach(function (s) { eshot(ctx, s, s.x, s.y, time); });
    S.puffs.forEach(function (p) { puff(ctx, p, p.x, p.y); });
    // герой под шаром из чайного пакетика
    var hx = F.x, hy = F.y, dead = S.phase === 'dead', dt2 = S.phaseT;
    if (dead) hy += dt2 * dt2 * 300;
    if (!dead || dt2 < 0.2) {
      ctx.strokeStyle = col('#e9e2cf', E.w); ctx.lineWidth = 1; line(ctx, hx - 6, hy - 30, hx - 12, hy - 52, col('#e9e2cf', E.w), 1); line(ctx, hx + 6, hy - 30, hx + 12, hy - 52, col('#e9e2cf', E.w), 1);
      ctx.save(); ctx.translate(hx, hy - 74 + Math.sin(time * 2) * 2);
      ctx.fillStyle = lg(ctx, -22, -24, 22, 24, [[0, '#f6ead0'], [1, '#d6c39a']]); rr(ctx, -22, -26, 44, 50, 10); ctx.fill(); ctx.strokeStyle = col('#b8a172', E.n); ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = col('rgba(120,70,30,.25)', E.n); for (var dd = 0; dd < 9; dd++) circ(ctx, -14 + hash(dd, 1) * 28, -16 + hash(dd, 2) * 34, 1.6, col('rgba(120,70,30,.4)', E.n));
      line(ctx, 0, -26, 0, -40, col('#e9e2cf', E.w), 1); ctx.fillStyle = col('#e2413a', E.R); ctx.fillRect(-7, -48, 14, 9); ctx.fillStyle = '#fff'; ctx.font = 'bold 7px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('Г', 0, -41);
      ctx.restore();
    } else { FX.add(hx, hy - 74, { n: 0 }); }
    kettle(ctx, hx, hy + 6, { face: 1, t: time, pose: dead ? 'jump' : 'fly', aim: 'f', firing: F.firing, heat: S.heat, over: S.over, inv: F.inv, death: dead ? { kind: 'pop', t: dt2 } : null });
    FX.draw(ctx);
  }

  // ---------- HUD ----------
  function bar(ctx, x, y, w, h, v, c, bg, label, blink) {
    ctx.fillStyle = bg; if (retro) ctx.fillRect(x, y, w, h); else { rr(ctx, x, y, w, h, h / 2); ctx.fill(); }
    var ww = Math.max(0, Math.min(1, v)) * w;
    if (ww > 0) { ctx.fillStyle = c; if (retro) ctx.fillRect(x, y, ww, h); else { rr(ctx, x, y, Math.max(h, ww), h, h / 2); ctx.fill(); } }
  }
  function hud(g, ctx, S, time) {
    var th = g.th(), font = retro ? 'bold 12px "Courier New", monospace' : '800 12px Inter, system-ui, sans-serif', small = retro ? 'bold 10px "Courier New", monospace' : '700 10px Inter, system-ui, sans-serif';
    var bandH = (S.level === 3 && S.kind === 'plat') || S.kind === 'race' || S.kind === 'fly' ? 40 : 27;
    if (!retro) { ctx.fillStyle = 'rgba(14,9,10,.72)'; ctx.fillRect(0, 0, VW, bandH); ctx.fillStyle = 'rgba(232,176,74,.35)'; ctx.fillRect(0, bandH, VW, 1); }
    else { ctx.fillStyle = E.k; ctx.fillRect(0, 0, VW, bandH); ctx.fillStyle = E.n; ctx.fillRect(0, bandH, VW, 1); }
    ctx.textBaseline = 'middle'; ctx.font = font; ctx.textAlign = 'left'; ctx.fillStyle = th.ink;
    ctx.fillText(g.t('score').toUpperCase() + ' ' + S.score, 12, 13);
    // жизни — маленькие чайники
    for (var i = 0; i < Math.min(6, S.lives); i++) { ctx.save(); kettle(ctx, 150 + i * 16, 22, { face: 1, t: 0, scale: 0.42 }); ctx.restore(); }
    // «давление»: сердечки
    var hp = S.hero ? S.hero.hp : S.fly ? S.fly.hp : null;
    if (hp != null) for (var j = 0; j < K.HP; j++) { ctx.save(); ctx.translate(262 + j * 14, 13); ctx.fillStyle = j < hp ? col('#ff5a6e', E.R) : col('rgba(255,255,255,.18)', E.d); ctx.beginPath(); ctx.moveTo(0, 5); ctx.bezierCurveTo(-7, -1, -4, -7, 0, -3); ctx.bezierCurveTo(4, -7, 7, -1, 0, 5); ctx.fill(); ctx.restore(); }
    // пар (перегрев) и кипяток (заряд)
    if (S.kind !== 'puzzle') {
      var over = S.over, hx = 320;
      ctx.font = small; ctx.fillStyle = over ? (Math.floor(time * 6) % 2 ? th.bad : th.ink) : th.muted;
      ctx.fillText(over ? g.t('overheat') : g.t('steam'), hx, 8);
      bar(ctx, hx, 15, 92, 7, S.heat, over ? col('#ff4a2a', E.R) : S.heat > 0.7 ? col('#ff9a3a', E.y) : col('#ffffff', E.w), col('rgba(255,255,255,.15)', E.d));
      if (!retro) { ctx.fillStyle = 'rgba(255,60,40,.5)'; ctx.fillRect(hx + 92 * 0.8, 15, 1, 7); }
      var full = S.charge >= 1; ctx.fillStyle = full ? (Math.floor(time * 4) % 2 ? th.accent : th.ink) : th.muted;
      ctx.fillText(full ? g.t('boilReady') : g.t('boil'), hx + 104, 8);
      bar(ctx, hx + 104, 15, 80, 7, S.charge, full ? col('#ffb347', E.y) : col('#d9a43c', E.n), col('rgba(255,255,255,.15)', E.d));
    }
    // уровень 3: тепло
    if (S.level === 3 && S.kind === 'plat') { ctx.font = small; ctx.fillStyle = S.warm < 0.3 ? (Math.floor(time * 5) % 2 ? th.bad : th.ink) : th.muted; ctx.fillText(g.t('warm'), 12, 32); bar(ctx, 60, 29, 110, 6, S.warm, S.warm < 0.3 ? col('#9fdcff', E.Cc) : col('#ff9a3c', E.R), col('rgba(255,255,255,.15)', E.d)); }
    // гонка: прогресс
    if (S.kind === 'race' && S.race) { var R = S.race, TR = L.TRACK; ctx.fillStyle = col('rgba(255,255,255,.2)', E.d); ctx.fillRect(140, 31, 360, 3); circ(ctx, 140 + Math.min(1, R.rx / TR.len) * 360, 32.5, 5, col('#8a5a3a', E.n)); circ(ctx, 140 + Math.min(1, R.x / TR.len) * 360, 32.5, 5, col('#ffd34d', E.y)); ctx.font = small; ctx.fillStyle = th.muted; ctx.textAlign = 'left'; ctx.fillText('● ' + g.t('rival'), 508, 32); ctx.fillText(Math.round(R.v / 4) + ' км/ч'.replace('км/ч', g.i18n.lang === 'ru' ? 'км/ч' : 'km/h'), 12, 32); }
    // головоломка: ходы, будильник, пар
    if (S.kind === 'puzzle' && S.pz) { var s = S.pz.s, B = L.PB; ctx.font = small; ctx.fillStyle = th.ink; ctx.textAlign = 'left'; ctx.fillText(g.t('moves') + ': ' + s.t + (s.clock ? '   ⏰ ' + Math.max(0, B.limit - s.t) : '   ⏰ ' + g.t('off')), 320, 13); for (var q = 0; q < 3; q++) circ(ctx, 470 + q * 12, 13, 4, q < s.heat ? col('#ff8a3a', E.R) : col('rgba(255,255,255,.25)', E.d)); ctx.fillStyle = th.muted; ctx.fillText(g.t('pzKeys'), 12, VH - 10); }
    // полёт: прогресс до мухобойки
    if (S.kind === 'fly' && S.fly) { var Fl = S.fly; ctx.fillStyle = col('rgba(255,255,255,.2)', E.d); ctx.fillRect(140, 31, 360, 3); ctx.fillStyle = th.accent; ctx.fillRect(140, 31, Math.min(1, Fl.t / LVL.FLY.len) * 360, 3); if (Fl.boss && !Fl.boss.dead) { ctx.font = small; ctx.fillStyle = th.bad; ctx.textAlign = 'center'; ctx.fillText(g.t('swatter'), VW / 2, 44); bar(ctx, 220, 50, 200, 5, Fl.boss.hp / 26, col('#3aa35a', E.g), col('rgba(255,255,255,.15)', E.d)); } }
    // Сервиз: здоровье частей
    if (S.boss && !S.boss.done) { var px = 210; ctx.font = small; ctx.textAlign = 'left'; S.boss.parts.forEach(function (p) { var d = L.BOSS[p.k]; ctx.fillStyle = p.dead ? th.muted : th.ink; ctx.fillText(g.t('b_' + p.k), px, 42); bar(ctx, px, 50, 64, 5, p.dead ? 0 : 1 - p.cracks / d.hp, col('#9fc3ff', E.Cc), col('rgba(255,255,255,.15)', E.d)); px += 80; }); }
    // уровень
    ctx.font = font; ctx.textAlign = 'right'; ctx.fillStyle = th.ink; ctx.fillText(S.level + '/6', VW - 12, 13);
    ctx.textBaseline = 'alphabetic';
  }

  function banner(g, ctx, b, time) {
    if (!b) return; var a = Math.min(1, b.a * 3, (b.dur - b.a) * 6 + 0.2), th = g.th();
    ctx.globalAlpha = Math.max(0, Math.min(1, a));
    var h = b.lines ? 100 + b.lines.length * 18 : 80, y = 92;
    if (retro) { ctx.fillStyle = E.k; ctx.fillRect(80, y, VW - 160, h); ctx.strokeStyle = E.y; ctx.lineWidth = 2; ctx.strokeRect(80, y, VW - 160, h); }
    else { ctx.fillStyle = 'rgba(18,12,16,.82)'; rr(ctx, 80, y, VW - 160, h, 14); ctx.fill(); ctx.strokeStyle = 'rgba(217,164,60,.6)'; ctx.lineWidth = 1.5; ctx.stroke(); }
    ctx.textAlign = 'center'; ctx.fillStyle = b.color || th.accent; ctx.font = retro ? 'bold 22px "Courier New", monospace' : '900 24px Inter, system-ui, sans-serif'; ctx.fillText(b.title, VW / 2, y + 34);
    ctx.fillStyle = th.ink; ctx.font = retro ? 'bold 12px "Courier New", monospace' : '700 13px Inter, system-ui, sans-serif'; ctx.fillText(b.sub || '', VW / 2, y + 58);
    if (b.lines) { ctx.font = retro ? 'bold 11px "Courier New", monospace' : '700 12px Inter, system-ui, sans-serif'; b.lines.forEach(function (l, i) { ctx.fillStyle = i === b.lines.length - 1 ? th.accent : th.muted; ctx.fillText(l, VW / 2, y + 84 + i * 18); }); }
    ctx.globalAlpha = 1;
  }

  // ---------- главный вызов ----------
  var buf = null, bctx = null;
  function scene(g, ctx, S, ui) {
    retro = g.themeName === 'retro'; signText = function (k) { return g.t(k); };
    var time = g.time, target = ctx;
    if (retro) { if (!buf) { buf = mk(320, 180); bctx = buf && buf.getContext('2d'); } if (bctx) { target = bctx; bctx.setTransform(0.5, 0, 0, 0.5, 0, 0); bctx.imageSmoothingEnabled = false; } }
    if (S.kind === 'plat' || S.kind === 'boss') drawPlat(g, target, S, ui, time);
    else if (S.kind === 'race') drawRace(g, target, S, ui, time);
    else if (S.kind === 'puzzle') drawPuzzle(g, target, S, ui, time);
    else if (S.kind === 'fly') drawFly(g, target, S, ui, time);
    if (retro && bctx) { ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(buf, 0, 0, VW, VH); ctx.restore(); }
    hud(g, ctx, S, time);
    banner(g, ctx, ui.banner, time);
  }
  function setRetro(v) { retro = v; }

  CH.R = { scene: scene, kettle: kettle, porcelain: porcelain, enemy: enemy, sugarCube: sugarCube, item: item, FX: FX, VW: VW, VH: VH, E: E, PZ: { X: PZ_X, Y: PZ_Y, CELL: PZ_CELL }, setRetro: setRetro, col: col, rr: rr, circ: circ, banner: banner, lg: lg };
})(typeof window !== 'undefined' ? window : globalThis);
