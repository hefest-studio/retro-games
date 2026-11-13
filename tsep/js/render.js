/* ЦЕПЬ · отрисовка (обе темы). modern — градиенты, свечение фонарей-ламп, мягкие тени; retro — тот же кадр в буфере 256×144
   плоскими цветами ограниченной палитры и крупным пикселем. Тема меняет только вид, не логику.
   Вид 32×16 клеток по 16 px (512×256) + панель 32 px снизу. TSEP.render(g, ctx, S, ui) · TSEP.R — фигуры, палитры · TSEP.fx — частицы.
   Облик — свой: механическая башня (латунь, ярь-медянка, сталь), звонарь-обходчик в стальной-синей спецовке с оранжевым шарфом,
   кепи и латунными очками; оружие — гиря-шестерня на цепи. */
(function (global) {
  'use strict';
  var T = global.TSEP = global.TSEP || {};
  var W = 512, H = 288, TS = 16, VH = 256;
  var R = { W: W, H: H, TS: TS, VH: VH };
  T.R = R;
  var TAU = Math.PI * 2;

  // ---------- палитры этажей ----------
  // sky — фон (3 стопа), far — дальние шестерни, top — кромка блоков, body — тело блоков, dark — тень, rim — заклёпки, lamp — свет ламп
  var PAL = {
    works: { sky: ['#0a171b', '#12303a', '#1a3f48'], far: '#1c3b43', top: '#c9a24a', body: '#35494c', dark: '#1f2d30', rim: '#e3c879', beam: '#7f8f92',
      r: { sky: '#001818', far: '#004848', top: '#d8a838', body: '#305050', dark: '#102828', rim: '#f8d878', beam: '#889898' } },
    pendulum: { sky: ['#0b1220', '#1b2b3d', '#28405a'], far: '#22344a', top: '#c47a45', body: '#3c4652', dark: '#232a33', rim: '#e8a66a', beam: '#8b97a6',
      r: { sky: '#000818', far: '#183048', top: '#d07840', body: '#384858', dark: '#182030', rim: '#f8b070', beam: '#8898a8' } },
    springs: { sky: ['#11140c', '#252d18', '#36421f'], far: '#2f3a20', top: '#b9b35a', body: '#434831', dark: '#272a1c', rim: '#e0dc8a', beam: '#959a78',
      r: { sky: '#081000', far: '#284018', top: '#c8c048', body: '#484830', dark: '#202010', rim: '#f0f088', beam: '#a0a078' } },
    gears: { sky: ['#14110f', '#2a221d', '#3b2f27'], far: '#352a22', top: '#a9bcc0', body: '#4a3d35', dark: '#2a221e', rim: '#d8e6e8', beam: '#9aa6a8',
      r: { sky: '#100800', far: '#382818', top: '#a8c0c0', body: '#504038', dark: '#281810', rim: '#e0f0f0', beam: '#a0a8a8' } },
    flywheel: { sky: ['#08140f', '#123026', '#1c4234'], far: '#1a3a2e', top: '#5fc4a0', body: '#2e4640', dark: '#1a2a26', rim: '#9be8c8', beam: '#7aa89a',
      r: { sky: '#001008', far: '#003828', top: '#58c8a0', body: '#284840', dark: '#102820', rim: '#a8f0d0', beam: '#78a898' } },
    gallery: { sky: ['#20384f', '#5b6d7f', '#d7a768'], far: '#3d4c5c', top: '#e0d2a8', body: '#6b7280', dark: '#454b55', rim: '#fff0c8', beam: '#a0a8b4',
      r: { sky: '#305878', far: '#404c60', top: '#e8d8a8', body: '#687080', dark: '#404858', rim: '#fff8d0', beam: '#a8b0b8' } },
    belfry: { sky: ['#0f160f', '#223022', '#33452c'], far: '#2b3a26', top: '#d4a548', body: '#4a4636', dark: '#2b2a20', rim: '#f2cf7c', beam: '#9e9a80',
      r: { sky: '#081008', far: '#283820', top: '#e0a840', body: '#484430', dark: '#202018', rim: '#f8d880', beam: '#a8a080' } },
    heart: { sky: ['#070a16', '#121a33', '#1d2a4d'], far: '#1d2846', top: '#e6c66a', body: '#2a3352', dark: '#171d33', rim: '#fff0b0', beam: '#8c96b8',
      r: { sky: '#000010', far: '#182040', top: '#f0c860', body: '#283058', dark: '#101830', rim: '#fff8b8', beam: '#8890b8' } }
  };
  R.PAL = PAL;
  var HERO = {
    m: { suit: '#3d6f8f', suitD: '#2b5069', suitL: '#5b8fb0', scarf: '#ea6a12', scarfD: '#b24a08', cap: '#3a3f46', capD: '#262a30', goggle: '#d6b25a', lens: '#9fe6ff',
      skin: '#e9b98f', boot: '#22262b', belt: '#6b4a2a', glove: '#55606a', chain: '#b8c2c8', chainD: '#6f7a82', ball: '#3b4148', ballL: '#6b7580', gearRim: '#d6b25a' },
    r: { suit: '#3878a0', suitD: '#205070', suitL: '#58a0c8', scarf: '#f06818', scarfD: '#b04000', cap: '#404048', capD: '#202028', goggle: '#e0b850', lens: '#a0f0ff',
      skin: '#f0b890', boot: '#202020', belt: '#704820', glove: '#586068', chain: '#c0c8d0', chainD: '#687880', ball: '#384048', ballL: '#708090', gearRim: '#e0b850' }
  };
  R.HERO = HERO;

  // ---------- частицы ----------
  var parts = [];
  var fx = {
    puff: function (x, y, col, n, sp, life, grav) { for (var i = 0; i < n; i++) { var a = Math.random() * TAU, v = sp * (0.3 + Math.random() * 0.7); parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (grav ? sp * 0.4 : 0), g: grav ? 18 : 0, life: life * (0.6 + Math.random() * 0.4), max: life, col: col }); } if (parts.length > 400) parts.splice(0, parts.length - 400); },
    step: function (dt) { for (var i = parts.length - 1; i >= 0; i--) { var p = parts[i]; p.life -= dt; if (p.life <= 0) { parts.splice(i, 1); continue; } p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; } },
    clear: function () { parts.length = 0; }
  };
  T.fx = fx;

  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  R.rr = rr;
  function box(c, col, x, y, w, h) { c.fillStyle = col; c.fillRect(x, y, w, h); }
  function circ(c, col, x, y, r) { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
  // шестерня: зубьев n, радиусы r1 (впадины) r2 (зубья), поворот a
  function gearPath(c, x, y, r1, r2, n, a) {
    c.beginPath();
    for (var i = 0; i < n * 2; i++) {
      var a0 = a + i * Math.PI / n, a1 = a + (i + 1) * Math.PI / n, r = i % 2 ? r1 : r2;
      c.lineTo(x + Math.cos(a0 + 0.08) * r, y + Math.sin(a0 + 0.08) * r); c.lineTo(x + Math.cos(a1 - 0.08) * r, y + Math.sin(a1 - 0.08) * r);
    }
    c.closePath();
  }
  function gear(c, col, x, y, r, n, a, hole) { c.fillStyle = col; gearPath(c, x, y, r * 0.8, r, n, a); c.fill(); if (hole) circ(c, hole, x, y, r * 0.3); }
  R.gear = gear;

  // ---------- герой: x,y — подошвы (px), f — направление; st — поза ----------
  // st: { walk, air, crouch, stair, atk: {ph,k,up}, hurt, throwT, t, blink }
  function heroFig(c, x, y, f, st, retro) {
    var K = HERO[retro ? 'r' : 'm'], t = st.t || 0;
    c.save(); c.translate(Math.round(x), Math.round(y)); if (f < 0) c.scale(-1, 1);
    var ph = st.walk ? Math.sin(st.walk * 11) : 0, cr = st.crouch ? 9 : 0, lean = st.hurt ? -0.25 : 0;
    var lA = st.air ? 3 : ph * 4, lB = st.air ? -2 : -ph * 4;
    if (st.stair) { lA = Math.sin(st.walk * 9) * 3; lB = -lA; }
    var hip = -13 + cr;
    // ноги
    c.fillStyle = K.suitD;
    c.save(); c.translate(-2, hip); c.rotate(lA * 0.08); c.fillRect(-2, 0, 5, 12 - cr * 0.6); c.fillStyle = K.boot; c.fillRect(-2, 11 - cr * 0.6, 7, 3); c.restore();
    c.fillStyle = K.suit;
    c.save(); c.translate(2, hip); c.rotate(lB * 0.08); c.fillRect(-2, 0, 5, 12 - cr * 0.6); c.fillStyle = K.boot; c.fillRect(-2, 11 - cr * 0.6, 7, 3); c.restore();
    // корпус
    c.save(); c.translate(0, hip); c.rotate(lean);
    c.fillStyle = K.suit; if (retro) c.fillRect(-5, -13, 10, 14); else { rr(c, -5.5, -13.5, 11, 14.5, 3); c.fill(); }
    c.fillStyle = K.suitL; c.fillRect(-4, -12, 2, 11);
    box(c, K.belt, -5.5, -2, 11, 2.5); box(c, K.goggle, -1, -2, 2, 2.5);
    // шарф
    c.fillStyle = K.scarf; c.fillRect(-5, -14, 10, 3);
    var sw = Math.sin(t * 6 + (st.walk || 0) * 8) * 2;
    c.fillStyle = K.scarfD; c.beginPath(); c.moveTo(-4, -13); c.lineTo(-10 - (st.walk ? 3 : 0), -10 + sw); c.lineTo(-9 - (st.walk ? 3 : 0), -7 + sw); c.lineTo(-3, -11); c.fill();
    // голова: кепи с латунными очками
    c.fillStyle = K.skin; c.fillRect(-3.5, -21, 7.5, 7);
    c.fillStyle = K.cap; c.fillRect(-4.5, -24, 9, 4); c.fillStyle = K.capD; c.fillRect(1, -21, 6, 1.6);
    c.fillStyle = K.goggle; c.fillRect(-4.5, -21.6, 9, 1.4); c.fillStyle = K.lens; c.fillRect(1.5, -22.4, 2.6, 2.4);
    c.fillStyle = '#2a1e16'; c.fillRect(2.5, -18.5, 1.2, 1.4);
    // рука с цепью
    var A = st.atk, ang = 0.6;
    if (A) { if (A.ph === 'wind') ang = -2.2 * A.k + 0.3; else if (A.ph === 'hit') ang = A.up ? -0.75 : 0; else ang = 0.5 * (1 - A.k); }
    else if (st.throwT > 0) ang = -1.4 + (0.22 - st.throwT) * 9;
    else if (st.walk) ang = 0.6 + ph * 0.3;
    c.save(); c.translate(1, -11); c.rotate(ang); c.fillStyle = K.suitD; c.fillRect(-1.5, -1.5, 9, 3.5); c.fillStyle = K.glove; c.fillRect(7, -2, 3.5, 4.5); c.restore();
    c.restore();
    c.restore();
  }
  R.heroFig = heroFig;
  // цепь от руки героя (px): hx,hy — кисть; f; A — фаза; L — длина в px; up
  function chainFig(c, hx, hy, f, A, L, up, t, retro) {
    var K = HERO[retro ? 'r' : 'm'], ex, ey, n;
    if (A.ph === 'wind') { var a = Math.PI + 0.4 + A.k * 1.6; ex = hx - f * Math.cos(a - Math.PI) * 10 - f * 4; ey = hy - Math.sin(A.k * 2.6) * 12 - 2; }
    else { var k = A.ph === 'hit' ? 1 : Math.max(0, A.k), dx = up ? 0.7071 : 1, dy = up ? -0.7071 : 0; ex = hx + f * dx * L * k; ey = hy + dy * L * k + (A.ph === 'rec' ? (1 - k) * 6 : 0); }
    n = Math.max(3, Math.round(Math.hypot(ex - hx, ey - hy) / 4));
    for (var i = 1; i <= n; i++) {
      var q = i / n, sag = A.ph === 'hit' ? 0 : Math.sin(q * Math.PI) * 4, px = hx + (ex - hx) * q, py = hy + (ey - hy) * q + sag;
      c.fillStyle = i % 2 ? K.chain : K.chainD; c.fillRect(Math.round(px) - 1.5, Math.round(py) - 1.5, 3, 3);
    }
    // гиря-шестерня
    if (!retro && A.ph === 'hit') { c.fillStyle = 'rgba(255,230,160,.25)'; c.beginPath(); c.arc(ex, ey, 9, 0, TAU); c.fill(); }
    gear(c, K.gearRim, ex, ey, 5.5, 8, t * (A.ph === 'hit' ? 12 : 3), null);
    circ(c, K.ball, ex, ey, 3.8); circ(c, K.ballL, ex - 1.2, ey - 1.2, 1.4);
  }
  R.chainFig = chainFig;

  // ---------- враги ----------
  function foeFig(c, e, px, py, t, retro, frozen) {
    var R2 = retro, f = e.face || 1, fl = e.hitT > 0 && Math.floor(t * 30) % 2;
    c.save(); c.translate(Math.round(px), Math.round(py)); if (f < 0) c.scale(-1, 1);
    if (fl) c.globalAlpha = 0.5;
    var brass = R2 ? '#d8a838' : '#c9a24a', brassD = R2 ? '#886010' : '#8a6a2a', steel = R2 ? '#a0a8b0' : '#9aa6ae', steelD = R2 ? '#505860' : '#56616a', eye = R2 ? '#ff4040' : '#ff6a4a';
    switch (e.type) {
      case 'tick': {
        var lg = Math.sin(t * 16 + e.x) * 1.5;
        c.fillStyle = steelD; for (var i = -1; i <= 1; i++) { c.fillRect(i * 4 - 1, -3, 1.5, 3 + (i ? lg : -lg)); }
        c.fillStyle = brass; c.beginPath(); c.ellipse(0, -6, 7, 5, 0, Math.PI, 0); c.fill(); c.fillRect(-7, -6, 14, 2);
        c.fillStyle = brassD; c.fillRect(-2, -11, 4, 2); c.save(); c.translate(0, -12); c.rotate(t * 6); box(c, steel, -3, -1, 6, 2); c.restore();
        box(c, eye, 5, -6, 2, 2); break;
      }
      case 'moth': {
        var fw = e.st === 'aim' ? Math.sin(t * 50) : Math.sin(t * 22);
        c.fillStyle = R2 ? '#e09040' : 'rgba(214,150,80,.85)';
        c.beginPath(); c.moveTo(0, -6); c.lineTo(-9, -12 - fw * 4); c.lineTo(-7, -4); c.fill();
        c.beginPath(); c.moveTo(0, -5); c.lineTo(-8, 0 + fw * 3); c.lineTo(-2, -2); c.fill();
        c.fillStyle = brass; c.beginPath(); c.ellipse(1, -5, 5, 2.5, 0, 0, TAU); c.fill();
        box(c, eye, 5, -6, 2, 2); c.fillStyle = steelD; c.fillRect(5, -10, 1, 4); c.fillRect(7, -10, 1, 4); break;
      }
      case 'oiler': {
        c.fillStyle = steelD; c.fillRect(-5, -3, 3, 3); c.fillRect(2, -3, 3, 3);
        c.fillStyle = R2 ? '#507850' : '#4f7a5a'; if (R2) c.fillRect(-7, -20, 14, 17); else { rr(c, -7, -20, 14, 17, 4); c.fill(); }
        box(c, brass, -7, -12, 14, 2); c.fillStyle = steel; c.beginPath(); c.moveTo(6, -16); c.lineTo(13, -21 - (e.st === 'wind' ? 3 : 0)); c.lineTo(13, -18); c.lineTo(6, -12); c.fill();
        box(c, brassD, -2, -23, 4, 3); box(c, eye, 1, -17, 3, 2); break;
      }
      case 'springer': {
        var sq = e.ground ? 0 : 3;
        c.strokeStyle = steel; c.lineWidth = 1.6; c.beginPath(); for (var k = 0; k <= 6; k++) { c.lineTo(k % 2 ? 4 : -4, -k * (1.6 + sq * 0.15)); } c.stroke();
        c.fillStyle = brass; c.beginPath(); c.arc(0, -13 - sq, 5, 0, TAU); c.fill(); box(c, eye, 1, -14 - sq, 3, 2); box(c, brassD, -5, -10 - sq, 10, 2); break;
      }
      case 'guard': {
        var wind = e.st === 'wind', jab = e.st === 'jab';
        c.fillStyle = steelD; c.fillRect(-4, -9, 3, 9); c.fillRect(1, -9, 3, 9);
        c.fillStyle = steel; if (R2) c.fillRect(-6, -24, 12, 16); else { rr(c, -6, -24, 12, 16, 3); c.fill(); }
        box(c, brassD, -6, -14, 12, 2);
        circ(c, brass, 0, -27.5, 4.5); circ(c, R2 ? '#f0f0d0' : '#efe7cf', 0, -27.5, 3); c.strokeStyle = '#333'; c.lineWidth = 1; c.beginPath(); c.moveTo(0, -27.5); c.lineTo(0, -29.5); c.moveTo(0, -27.5); c.lineTo(1.6, -27.5); c.stroke();
        var hx = jab ? 10 : wind ? -4 : 4;
        c.fillStyle = R2 ? '#806040' : '#7a5a3a'; c.fillRect(hx - 14, -17, 26, 2);
        c.fillStyle = steel; c.beginPath(); c.moveTo(hx + 12, -20); c.lineTo(hx + 18, -16); c.lineTo(hx + 12, -12); c.fill();
        if (wind && !R2) { c.fillStyle = 'rgba(255,90,60,.5)'; c.beginPath(); c.arc(hx + 15, -16, 4, 0, TAU); c.fill(); }
        break;
      }
    }
    c.restore();
    if (frozen) { c.fillStyle = R2 ? 'rgba(160,240,255,.45)' : 'rgba(160,230,255,.35)'; c.fillRect(Math.round(px) - 9, Math.round(py) - e.h * TS - 4, 18, e.h * TS + 4); }
  }
  R.foeFig = foeFig;

  // ---------- стражи ----------
  function bossFig(c, b, X, Y, t, retro, frozen) {
    var px = X(b.x), py = Y(b.y), R2 = retro, fl = b.flash > 0 && Math.floor(t * 30) % 2;
    var brass = R2 ? '#e0b040' : '#d4ad55', brassD = R2 ? '#886010' : '#8a6a2a', steel = R2 ? '#a8b0b8' : '#9eabb3', steelD = R2 ? '#505860' : '#56616a', wood = R2 ? '#985830' : '#8a5a36', eye = R2 ? '#ff3030' : '#ff5a3a', glow = '#ffe6a0';
    c.save();
    if (fl) c.globalAlpha = 0.55;
    switch (b.k) {
      case 'cuckoo': {
        // часы-домик на задней стене
        var hx = X(b.hx), hy = Y(b.hy) + 6;
        c.fillStyle = wood; c.beginPath(); c.moveTo(hx - 22, hy); c.lineTo(hx, hy - 16); c.lineTo(hx + 22, hy); c.lineTo(hx + 18, hy); c.lineTo(hx + 18, hy + 34); c.lineTo(hx - 18, hy + 34); c.lineTo(hx - 18, hy); c.fill();
        circ(c, R2 ? '#f0e8c8' : '#efe4c4', hx, hy + 18, 10); c.strokeStyle = '#3a2a1a'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(hx, hy + 18); c.lineTo(hx, hy + 11); c.moveTo(hx, hy + 18); c.lineTo(hx + 5, hy + 18); c.stroke();
        box(c, '#1a120c', hx - 5, hy - 2, 10, 8);
        c.translate(px, py - 9); if (b.face < 0) c.scale(-1, 1);
        var wf = b.st === 'swoop' || b.st === 'back' || b.st === 'eggs' ? Math.sin(t * 26) * 5 : 0;
        c.fillStyle = R2 ? '#c87838' : '#b8763e'; c.beginPath(); c.ellipse(0, 0, 10, 7, 0, 0, TAU); c.fill();
        c.fillStyle = R2 ? '#985020' : '#8a5428'; c.beginPath(); c.moveTo(-3, -3); c.lineTo(-12, -8 - wf); c.lineTo(-8, 2); c.fill();
        c.fillStyle = brass; c.beginPath(); c.moveTo(9, -2); c.lineTo(15, 0); c.lineTo(9, 2); c.fill();
        box(c, eye, 4, -4, 3, 3); c.fillStyle = brassD; c.fillRect(-12, -2, 4, 5);
        break;
      }
      case 'pendulum': {
        var ppx = X(b.cx), ppy = Y(b.py);
        c.strokeStyle = R2 ? '#909898' : '#8a949c'; c.lineWidth = 3; c.beginPath(); c.moveTo(ppx, ppy); c.lineTo(px, py - b.h * TS / 2); c.stroke();
        circ(c, brassD, ppx, ppy, 5);
        var cy = py - b.h * TS / 2;
        if (b.sweep && !R2) { c.fillStyle = 'rgba(255,80,40,.25)'; c.beginPath(); c.arc(px, cy, 20, 0, TAU); c.fill(); }
        circ(c, b.sweep ? (R2 ? '#d84020' : '#c0562e') : brass, px, cy, 13.5); circ(c, brassD, px, cy, 9); circ(c, R2 ? '#202830' : '#1c242c', px, cy, 6); circ(c, eye, px + Math.sin(t * 3) * 2, cy, 2.5);
        break;
      }
      case 'drake': {
        c.translate(px, py); if (b.face < 0) c.scale(-1, 1);
        var sq = b.st === 'land' ? 4 : b.st === 'hop' ? -3 : 0;
        c.strokeStyle = steel; c.lineWidth = 2; [-12, 8].forEach(function (lx) { c.beginPath(); for (var k = 0; k <= 5; k++) c.lineTo(lx + (k % 2 ? 4 : -4), -k * (2.2 - sq * 0.1)); c.stroke(); });
        c.fillStyle = R2 ? '#3c7050' : '#3f6e58'; if (R2) c.fillRect(-20, -30 + sq, 34, 18); else { rr(c, -20, -30 + sq, 34, 18, 6); c.fill(); }
        c.fillStyle = brass; for (var s = 0; s < 4; s++) c.fillRect(-16 + s * 8, -34 + sq, 5, 5);
        var open = b.st === 'breath' || b.st === 'wind' ? 4 : 0;
        c.fillStyle = R2 ? '#3c7050' : '#3f6e58'; c.fillRect(12, -32 + sq, 14, 8); c.fillRect(12, -24 + sq + open, 14, 4);
        box(c, b.st === 'wind' ? glow : eye, 20, -31 + sq, 3, 3);
        c.fillStyle = steelD; c.beginPath(); c.moveTo(-20, -24 + sq); c.lineTo(-32, -30 + sq); c.lineTo(-20, -18 + sq); c.fill();
        break;
      }
      case 'spider': {
        var cy2 = py - b.h * TS / 2;
        c.strokeStyle = R2 ? '#707878' : '#6f7a82'; c.lineWidth = 2; c.beginPath(); c.moveTo(px, Y(1.9)); c.lineTo(px, cy2); c.stroke();
        c.strokeStyle = steelD; c.lineWidth = 2;
        for (var l = 0; l < 4; l++) { var la = 0.5 + l * 0.35 + Math.sin(t * 10 + l) * (b.st === 'walk' ? 0.15 : 0.04); [-1, 1].forEach(function (sd) { c.beginPath(); c.moveTo(px, cy2); c.lineTo(px + sd * Math.cos(la) * 14, cy2 - 8 + l * 2); c.lineTo(px + sd * Math.cos(la) * 22, cy2 + 10); c.stroke(); }); }
        gear(c, brass, px, cy2, 13, 10, t * (b.st === 'walk' ? 2 : 0.3), null); circ(c, R2 ? '#202830' : '#1f262d', px, cy2, 7);
        circ(c, b.st === 'aim' ? glow : eye, px - 3, cy2, 2); circ(c, b.st === 'aim' ? glow : eye, px + 3, cy2, 2);
        break;
      }
      case 'flywheel': {
        var cy3 = py - b.h * TS / 2, rad = b.h * TS / 2;
        if (!R2) { c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(px, py, rad, 3, 0, 0, TAU); c.fill(); }
        circ(c, steelD, px, cy3, rad); circ(c, R2 ? '#202428' : '#262d33', px, cy3, rad - 4);
        c.strokeStyle = brass; c.lineWidth = 3; for (var sp = 0; sp < 5; sp++) { var a = (b.rot || 0) + sp * TAU / 5; c.beginPath(); c.moveTo(px, cy3); c.lineTo(px + Math.cos(a) * (rad - 4), cy3 + Math.sin(a) * (rad - 4)); c.stroke(); }
        circ(c, brass, px, cy3, 5.5); circ(c, b.st === 'stun' ? glow : eye, px, cy3, 2.5);
        if (b.st === 'stun') { c.fillStyle = glow; for (var q = 0; q < 3; q++) { var aa = t * 5 + q * 2.1; c.fillRect(px + Math.cos(aa) * 12 - 1, cy3 - rad - 6 + Math.sin(aa) * 3, 2, 2); } }
        break;
      }
      case 'bellows': {
        c.translate(px, py); if (b.face < 0) c.scale(-1, 1);
        var pump = b.st === 'blow' ? Math.sin(t * 18) * 3 : 0;
        c.fillStyle = steelD; c.fillRect(-14, -8, 6, 8); c.fillRect(8, -8, 6, 8);
        c.fillStyle = wood; c.beginPath(); c.moveTo(-22, -10); c.lineTo(18, -18 + pump); c.lineTo(18, -36 - pump); c.lineTo(-22, -50); c.fill();
        c.fillStyle = R2 ? '#583018' : '#5a3a26'; for (var f2 = 0; f2 < 5; f2++) c.fillRect(-18 + f2 * 8, -44 + f2 * 1.6, 3, 30 - f2 * 3);
        c.fillStyle = brass; c.fillRect(18, -30, 12, 6); c.fillRect(-24, -52, 6, 44);
        box(c, eye, -12, -40, 4, 4); box(c, eye, -4, -38, 4, 4);
        if (b.st === 'blow' && !R2) { c.fillStyle = 'rgba(255,255,255,.12)'; for (var w2 = 0; w2 < 4; w2++) c.fillRect(32 + ((t * 120 + w2 * 40) % 160), -34 + w2 * 5, 18, 2); }
        break;
      }
      case 'ringer': {
        c.translate(px, py); if (b.face < 0) c.scale(-1, 1);
        c.fillStyle = steelD; c.fillRect(-5, -8, 4, 8); c.fillRect(1, -8, 4, 8);
        c.fillStyle = R2 ? '#c89030' : '#b88a3a'; c.beginPath(); c.moveTo(-11, -8); c.quadraticCurveTo(-9, -30, 0, -32); c.quadraticCurveTo(9, -30, 11, -8); c.fill();
        c.fillStyle = brassD; c.fillRect(-11, -10, 22, 3);
        c.fillStyle = R2 ? '#384050' : '#3a4250'; c.beginPath(); c.arc(0, -34, 6, Math.PI, 0); c.lineTo(6, -30); c.lineTo(-6, -30); c.fill();
        circ(c, b.st === 'wind' ? glow : '#9fe6ff', 2, -33, 2);
        var A = b.st === 'wind' ? { ph: 'wind', k: Math.min(1, b.t / 0.45) } : b.st === 'strike' ? { ph: 'hit', k: 1 } : b.st === 'rec' ? { ph: 'rec', k: Math.max(0, 1 - b.t / 0.5) } : null;
        if (A) { c.save(); chainFig(c, 6, -20, 1, A, 2.6 * TS, false, t, R2); c.restore(); }
        else { circ(c, brass, 9, -14, 3); }
        if (b.st === 'ring' && !R2) { c.strokeStyle = 'rgba(255,230,160,.5)'; c.lineWidth = 2; c.beginPath(); c.arc(0, -20, 16 + (t * 40) % 14, 0, TAU); c.stroke(); }
        break;
      }
      case 'heart': {
        var cy4 = py - b.h * TS / 2;
        (b.orbs || []).forEach(function (o) { c.strokeStyle = R2 ? '#888' : 'rgba(180,190,210,.6)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(px, cy4); c.lineTo(X(o.x), Y(o.y)); c.stroke(); circ(c, steelD, X(o.x), Y(o.y), 9); circ(c, steel, X(o.x) - 2, Y(o.y) - 2, 3); });
        if (!R2) { var gr = c.createRadialGradient(px, cy4, 4, px, cy4, 34); gr.addColorStop(0, 'rgba(255,230,150,.45)'); gr.addColorStop(1, 'rgba(255,230,150,0)'); c.fillStyle = gr; c.fillRect(px - 34, cy4 - 34, 68, 68); }
        gear(c, brass, px, cy4, 20, 14, -t * 0.4, null); circ(c, R2 ? '#f0e8c8' : '#f3ead0', px, cy4, 14);
        c.strokeStyle = '#2a2016'; c.lineWidth = 2; c.beginPath(); c.moveTo(px, cy4); c.lineTo(px + Math.cos(t * 2) * 10, cy4 + Math.sin(t * 2) * 10); c.moveTo(px, cy4); c.lineTo(px + Math.cos(t * 0.3) * 7, cy4 + Math.sin(t * 0.3) * 7); c.stroke();
        circ(c, eye, px, cy4, 2.5);
        break;
      }
    }
    c.restore();
    if (frozen) { c.fillStyle = 'rgba(160,230,255,.3)'; c.fillRect(px - b.w * TS / 2 - 4, py - b.h * TS - 4, b.w * TS + 8, b.h * TS + 8); }
  }
  R.bossFig = bossFig;

  // ---------- предметы и снаряды ----------
  var SUBCOL = { key: '#c9d3da', flask: '#ff8a3a', gear: '#d6b25a', spring: '#7fd6ff', stopper: '#e8e0ff' };
  function subIcon(c, k, x, y, s, t, retro) {
    c.save(); c.translate(x, y); c.scale(s, s);
    switch (k) {
      case 'key': c.rotate(t || 0); box(c, retro ? '#c0c8d0' : '#c9d3da', -1, -5, 2.4, 9); c.strokeStyle = retro ? '#c0c8d0' : '#c9d3da'; c.lineWidth = 2; c.beginPath(); c.arc(0, -6, 3, 0.6, Math.PI * 2 - 0.6 + Math.PI); c.stroke(); break;
      case 'flask': circ(c, retro ? '#f06818' : '#ff7a2a', 0, 1.5, 4); box(c, retro ? '#a0e0f0' : '#bfe8f5', -1.5, -5, 3, 4); box(c, '#7a4b2a', -2, -6.5, 4, 1.6); break;
      case 'gear': gear(c, retro ? '#e0b850' : '#d6b25a', 0, 0, 5.5, 8, t || 0, '#3a2a1a'); break;
      case 'spring': c.strokeStyle = retro ? '#80d8ff' : '#7fd6ff'; c.lineWidth = 1.6; c.beginPath(); for (var i = 0; i <= 8; i++) c.lineTo(i % 2 ? 4 : -4, 5 - i * 1.25); c.stroke(); break;
      case 'stopper': c.strokeStyle = retro ? '#e0e0ff' : '#e8e0ff'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(0, -6); c.lineTo(Math.sin(t || 0) * 0, 3); c.stroke(); circ(c, retro ? '#e0b850' : '#d6b25a', 0, 3, 3); box(c, retro ? '#e0e0ff' : '#e8e0ff', -4, -7, 8, 2); break;
    }
    c.restore();
  }
  R.subIcon = subIcon;
  function spark(c, x, y, r, t, retro) {
    var k = 0.8 + Math.sin(t * 12 + x) * 0.2;
    if (!retro) { c.fillStyle = 'rgba(170,225,255,.35)'; c.beginPath(); c.arc(x, y, r * 2 * k, 0, TAU); c.fill(); }
    c.fillStyle = retro ? '#a0f0ff' : '#cdf2ff'; c.beginPath(); c.moveTo(x, y - r * 1.6); c.lineTo(x + r * 0.5, y - r * 0.5); c.lineTo(x + r * 1.6, y); c.lineTo(x + r * 0.5, y + r * 0.5); c.lineTo(x, y + r * 1.6); c.lineTo(x - r * 0.5, y + r * 0.5); c.lineTo(x - r * 1.6, y); c.lineTo(x - r * 0.5, y - r * 0.5); c.fill();
  }
  R.spark = spark;
  function itemFig(c, it, px, py, t, retro) {
    var bob = it.ground ? Math.sin(t * 4 + it.x) * 1.2 : 0, y = py - 6 + bob;
    if (it.k === 'spark') spark(c, px, y, 3, t, retro);
    else if (it.k === 'spark5') { spark(c, px, y, 4.6, t, retro); }
    else if (it.k === 'chain') { c.strokeStyle = retro ? '#c0c8d0' : '#c9d3da'; c.lineWidth = 2; for (var i = 0; i < 3; i++) { c.beginPath(); c.ellipse(px - 5 + i * 5, y, 3, 2, 0, 0, TAU); c.stroke(); } circ(c, HERO.m.gearRim, px + 8, y, 2.5); }
    else if (it.k === 'oil') { box(c, retro ? '#58a058' : '#4f8a5a', px - 4, y - 4, 8, 8); box(c, retro ? '#e0b850' : '#d6b25a', px - 4, y - 1, 8, 2); c.fillStyle = '#aab'; c.fillRect(px + 3, y - 7, 2, 4); }
    else if (it.k === 'token') { circ(c, retro ? '#e0b850' : '#d6b25a', px, y, 4.5); gear(c, retro ? '#886010' : '#8a6a2a', px, y, 3, 6, 0, null); }
    else if (it.k === 'core') { if (!retro) { c.fillStyle = 'rgba(255,220,120,.35)'; c.beginPath(); c.arc(px, y - 2, 13, 0, TAU); c.fill(); } gear(c, retro ? '#f0c860' : '#ffd36a', px, y - 2, 9, 12, t * 2, '#5a4010'); }
    else subIcon(c, it.k, px, y, 1, t, retro);
  }
  R.itemFig = itemFig;

  // ---------- статичный слой карты (кэш на этаж и тему) ----------
  var cache = {};
  function tileLayer(lv, retro) {
    var key = lv.key + (retro ? ':r' : ':m');
    if (cache[key]) return cache[key];
    if (typeof document === 'undefined') return null;
    var cv = document.createElement('canvas'); cv.width = lv.W * TS; cv.height = lv.H * TS;
    var c = cv.getContext('2d'), P = retro ? PAL[lv.key].r : PAL[lv.key], TL = T.TILES;
    function at(cc, r) { return T.logic.tileAt(lv, cc, r); }
    for (var r = 0; r < lv.H; r++) for (var cc = 0; cc < lv.W; cc++) {
      var v = lv.t[r * lv.W + cc], x = cc * TS, y = r * TS;
      if (v === TL.SOL) {
        box(c, P.body, x, y, TS, TS);
        var up = at(cc, r - 1) !== TL.SOL, lf = at(cc - 1, r) !== TL.SOL, rt = at(cc + 1, r) !== TL.SOL, dn = at(cc, r + 1) !== TL.SOL;
        // панели литья
        if (!retro) { c.fillStyle = 'rgba(255,255,255,.04)'; c.fillRect(x + 1, y + 1, TS - 2, 1); c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(x, y + TS - 1, TS, 1); c.fillRect(x + TS - 1, y, 1, TS); }
        else { box(c, P.dark, x, y + TS - 1, TS, 1); box(c, P.dark, x + TS - 1, y, 1, TS); }
        if ((cc + r) % 3 === 0) { box(c, P.dark, x + 3, y + 3, 2, 2); box(c, P.dark, x + 11, y + 11, 2, 2); }
        if (up) { box(c, P.top, x, y, TS, 4); box(c, P.rim, x, y, TS, 1); box(c, P.dark, x, y + 4, TS, 1); box(c, P.rim, x + 3, y + 1.5, 1.5, 1.5); box(c, P.rim, x + 11, y + 1.5, 1.5, 1.5); }
        if (lf && !up) box(c, P.dark, x, y, 2, TS);
        if (rt && !up) box(c, P.dark, x + TS - 2, y, 2, TS);
        if (dn) { box(c, P.dark, x, y + TS - 3, TS, 3); }
      } else if (v === TL.ONE) {
        box(c, P.beam, x, y, TS, 4); box(c, P.dark, x, y + 4, TS, 2); box(c, P.rim, x, y, TS, 1);
        c.fillStyle = P.dark; c.beginPath(); c.moveTo(x + 2, y + 6); c.lineTo(x + 8, y + 12); c.lineTo(x + 14, y + 6); c.lineTo(x + 12, y + 6); c.lineTo(x + 8, y + 10); c.lineTo(x + 4, y + 6); c.fill();
      } else if (v === TL.STR || v === TL.STL) {
        var d = v === TL.STR ? 1 : -1;
        for (var k = 0; k < 2; k++) {
          var sx = d > 0 ? x + k * 8 : x + TS - 8 - k * 8, sy = y + TS - 8 - k * 8 + 8;
          box(c, P.top, sx, sy - 3, 8, 3); box(c, P.dark, sx, sy, 8, 2); box(c, P.rim, sx, sy - 3, 8, 1);
        }
        c.strokeStyle = P.beam; c.lineWidth = 1.5; c.beginPath();
        if (d > 0) { c.moveTo(x, y + TS - 14); c.lineTo(x + TS, y - 14); } else { c.moveTo(x + TS, y + TS - 14); c.lineTo(x, y - 14); }
        c.stroke();
        box(c, P.beam, x + 7, y + 2 - 12 + (d > 0 ? 8 : 8), 1.5, 10);
      }
    }
    cache[key] = cv;
    return cv;
  }
  R.clearCache = function () { cache = {}; };

  // ---------- фон ----------
  function background(c, lv, S, t, retro, camX, camY) {
    var P = PAL[lv.key], Q = retro ? P.r : P, run = S.bossState === 'dead' || S.phase === 'clear' || S.phase === 'won';
    if (retro) box(c, Q.sky, 0, 0, W, VH);
    else { var gr = c.createLinearGradient(0, 0, 0, VH); gr.addColorStop(0, P.sky[0]); gr.addColorStop(0.6, P.sky[1]); gr.addColorStop(1, P.sky[2]); c.fillStyle = gr; c.fillRect(0, 0, W, VH); }
    if (lv.open) {
      // галерея: облака и дальние шпили
      c.fillStyle = retro ? '#405870' : 'rgba(255,255,255,.08)';
      for (var i = 0; i < 6; i++) { var cx = ((i * 140 - camX * 4) % 700 + 700) % 700 - 90; c.fillRect(cx, 30 + (i % 3) * 22, 80, 8); c.fillRect(cx + 16, 24 + (i % 3) * 22, 44, 8); }
      for (var j = 0; j < 7; j++) { var sx = ((j * 110 - camX * 7) % 770 + 770) % 770 - 60; var hh = 90 + (j % 3) * 30; c.fillStyle = Q.far; c.fillRect(sx, VH - hh, 26, hh); c.beginPath(); c.moveTo(sx - 4, VH - hh); c.lineTo(sx + 13, VH - hh - 26); c.lineTo(sx + 30, VH - hh); c.fill(); circ(c, retro ? '#d8c890' : 'rgba(240,220,160,.5)', sx + 13, VH - hh + 14, 6); }
      return;
    }
    // большие шестерни механизма (до запуска этажа — неподвижны)
    var ang = run ? S.t * 0.4 : 0;
    var gs = [[60, 70, 58, 12], [190, 150, 40, 10], [330, 60, 70, 14], [470, 170, 50, 12], [600, 90, 64, 13]];
    var off = camX * TS * 0.35;
    gs.forEach(function (q, k) {
      var x = ((q[0] - off) % 680 + 680) % 680 - 80, y = q[1] - camY * TS * 0.25 % 60;
      c.fillStyle = Q.far; gearPath(c, x, y, q[2] * 0.82, q[2], q[3], (k % 2 ? -ang : ang) + k);
      c.fill(); circ(c, retro ? Q.sky : P.sky[1], x, y, q[2] * 0.45); circ(c, Q.far, x, y, q[2] * 0.18);
      if (!retro) { c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 1; c.beginPath(); c.arc(x, y, q[2] * 0.62, 0, TAU); c.stroke(); }
    });
    // циферблат на дальней стене
    var dx = ((300 - off * 0.6) % 900 + 900) % 900 - 120, dy = 120 - camY * TS * 0.2 % 40;
    c.strokeStyle = Q.far; c.lineWidth = 4; c.beginPath(); c.arc(dx, dy, 46, 0, TAU); c.stroke();
    for (var m = 0; m < 12; m++) { var a = m * TAU / 12; box(c, Q.far, dx + Math.cos(a) * 38 - 2, dy + Math.sin(a) * 38 - 2, 4, 4); }
    c.lineWidth = 3; c.beginPath(); c.moveTo(dx, dy); c.lineTo(dx + Math.cos(-1.2 + (run ? S.t * 0.6 : 0)) * 30, dy + Math.sin(-1.2 + (run ? S.t * 0.6 : 0)) * 30); c.moveTo(dx, dy); c.lineTo(dx + 20, dy + 6); c.stroke();
    if (!retro) { // пылинки — время стоит
      c.fillStyle = 'rgba(220,235,240,.18)';
      for (var p = 0; p < 18; p++) { var px = ((p * 97 - camX * TS * 0.6) % W + W) % W, py = (p * 53) % VH + Math.sin(t * 0.4 + p) * 3; c.fillRect(px, py, 1.5, 1.5); }
    }
  }

  // ---------- кадр мира ----------
  var buf = null;
  function getBuf() { if (!buf && typeof document !== 'undefined') { buf = document.createElement('canvas'); buf.width = W / 2; buf.height = VH / 2; } return buf; }
  function world(c, S, ui, t, retro) {
    var L = T.logic, lv = S.lv, P = PAL[lv.key], Q = retro ? P.r : P, camX = S.cam.x, camY = S.cam.y;
    var sx = 0, sy = 0; if (ui.shake > 0) { sx = (Math.random() - 0.5) * ui.shake * 8; sy = (Math.random() - 0.5) * ui.shake * 8; }
    c.save(); c.beginPath(); c.rect(0, 0, W, VH); c.clip(); c.translate(Math.round(sx), Math.round(sy));
    background(c, lv, S, t, retro, camX, camY);
    function X(x) { return (x - camX) * TS; } function Y(y) { return (y - camY) * TS; }
    // направляющие подъёмников и оси маятников (за картой)
    lv.mov.forEach(function (m) {
      if (m.kind === 'lift') { var rx = X(m.x + m.w / 2) - 2; box(c, Q.dark, rx, Y(m.y - m.h - 0.6), 4, (m.h + 3) * TS); for (var k = 0; k < (m.h + 3) * 2; k++) box(c, Q.beam, rx - 2, Y(m.y - m.h - 0.6) + k * 8, 8, 2); }
    });
    var lay = tileLayer(lv, retro);
    if (lay) c.drawImage(lay, Math.round(-camX * TS), Math.round(-camY * TS));
    // зубчатки-пилы
    for (var r = Math.max(0, Math.floor(camY)); r < Math.min(lv.H, camY + 17); r++) for (var cc = Math.max(0, Math.floor(camX)); cc < Math.min(lv.W, camX + 33); cc++) if (lv.t[r * lv.W + cc] === T.TILES.SAW) {
      gear(c, retro ? '#c0c8d0' : '#aeb9c0', X(cc + 0.5), Y(r + 0.5), 8, 10, t * 5, retro ? '#d82800' : '#c0392b');
    }
    // ворота арены
    if (S.gateClosed) { var gx = X(lv.gate.x); for (var gy = lv.arena.y0; gy < lv.gate.y; gy++) { box(c, Q.dark, gx, Y(gy), TS, TS); box(c, Q.top, gx + 2, Y(gy), 3, TS); box(c, Q.top, gx + 7, Y(gy), 3, TS); box(c, Q.top, gx + 12, Y(gy), 2, TS); box(c, Q.rim, gx, Y(gy) + 6, TS, 2); } }
    // отметки
    lv.cps.forEach(function (cp) { var px = X(cp.x), py = Y(cp.y); if (px < -20 || px > W + 20) return; var on = S.cp && S.cp.x >= cp.x; box(c, Q.beam, px - 1, py - 16, 2, 16); circ(c, on ? (retro ? '#f8d878' : '#ffd36a') : Q.dark, px, py - 18, 5); circ(c, retro ? '#f0f0d0' : '#efe7cf', px, py - 18, 3.2); box(c, '#2a2016', px - 0.5, py - 20, 1, 2.5); if (on && !retro) { c.fillStyle = 'rgba(255,220,120,.25)'; c.beginPath(); c.arc(px, py - 18, 10, 0, TAU); c.fill(); } });
    // фонари-лампы: кронштейн и стеклянная колба с искрой
    lv.lamps.forEach(function (L2, i) {
      var px = X(L2.x), py = Y(L2.y); if (px < -20 || px > W + 20 || py < -20 || py > VH + 20) return;
      box(c, Q.beam, px - 1, py - 9, 2, 4); box(c, Q.beam, px - 5, py - 9, 10, 1.5);
      if (!S.lampsOn[i]) { box(c, Q.dark, px - 3, py - 5, 6, 2); return; }
      var fl = 0.75 + 0.25 * Math.sin(t * 9 + i * 1.7);
      if (!retro) { var g2 = c.createRadialGradient(px, py, 1, px, py, 15); g2.addColorStop(0, 'rgba(160,220,255,' + (0.45 * fl) + ')'); g2.addColorStop(1, 'rgba(160,220,255,0)'); c.fillStyle = g2; c.fillRect(px - 15, py - 15, 30, 30); }
      box(c, Q.top, px - 4, py - 5, 8, 2); c.fillStyle = retro ? '#80c8e8' : 'rgba(190,230,255,.55)'; if (retro) c.fillRect(px - 4, py - 3, 8, 8); else { rr(c, px - 4, py - 3, 8, 9, 3); c.fill(); }
      spark(c, px, py + 1, 1.6 * fl, t, retro); box(c, Q.top, px - 3, py + 5, 6, 1.5);
    });
    // двери развилки
    if (S.doorsOn) S.doors.forEach(function (d) {
      var px = X(d.x), py = Y(d.y);
      c.fillStyle = Q.dark; c.beginPath(); c.moveTo(px - 10, py); c.lineTo(px - 10, py - 22); c.arc(px, py - 22, 10, Math.PI, 0); c.lineTo(px + 10, py); c.fill();
      c.strokeStyle = Q.top; c.lineWidth = 2; c.stroke();
      if (!retro) { c.fillStyle = 'rgba(255,220,120,' + (0.25 + 0.15 * Math.sin(t * 4)) + ')'; c.fill(); }
      if (d.route === 'A') gear(c, Q.rim, px, py - 20, 6, 8, t, Q.dark); else { c.fillStyle = Q.rim; c.beginPath(); c.moveTo(px - 6, py - 14); c.quadraticCurveTo(px - 5, py - 27, px, py - 27); c.quadraticCurveTo(px + 5, py - 27, px + 6, py - 14); c.fill(); }
    });
    // подвижные опоры
    lv.mov.forEach(function (m) {
      var Pp = L.platAt(m, S.t), px = X(Pp.cx), py = Y(Pp.top), w = m.w * TS;
      if (m.kind === 'pend') {
        c.strokeStyle = retro ? '#a0a8a8' : '#9aa4aa'; c.lineWidth = 2; c.beginPath(); c.moveTo(X(m.px), Y(m.py)); c.lineTo(px, py); c.stroke();
        circ(c, Q.top, X(m.px), Y(m.py), 4); circ(c, Q.dark, X(m.px), Y(m.py), 1.6);
        box(c, Q.top, px - w / 2, py, w, 4); box(c, Q.dark, px - w / 2, py + 4, w, 3); box(c, Q.rim, px - w / 2, py, w, 1);
        gear(c, Q.top, px, py + 6, 5, 8, Pp.th * 3, Q.dark);
      } else {
        gear(c, retro ? '#d8a838' : '#c9a24a', px, py + 10, w / 2 + 2, 12, Pp.top * 1.4, Q.dark);
        box(c, Q.beam, px - w / 2, py, w, 4); box(c, Q.rim, px - w / 2, py, w, 1);
      }
    });
    // предметы
    S.items.forEach(function (it) { itemFig(c, it, X(it.x), Y(it.y), t, retro); });
    // поля пружин
    S.fields.forEach(function (f) { var px = X(f.x), py = Y(f.y); c.strokeStyle = retro ? '#80d8ff' : 'rgba(127,214,255,' + (0.3 + 0.2 * Math.sin(t * 6)) + ')'; c.lineWidth = 2; c.setLineDash && c.setLineDash([6, 6]); c.beginPath(); c.arc(px, py, 4.5 * TS, 0, TAU); c.stroke(); c.setLineDash && c.setLineDash([]); if (!retro) { c.fillStyle = 'rgba(127,214,255,.07)'; c.fill(); } });
    var frozen = S.freeze > 0;
    // враги, страж
    S.enemies.forEach(function (e) { var px = X(e.x); if (px > -30 && px < W + 30) foeFig(c, e, px, Y(e.y), frozen ? 0 : t, retro, frozen); });
    if (S.boss && S.bossState !== 'dead') bossFig(c, S.boss, X, Y, frozen ? 0 : t, retro, frozen);
    // герой
    var h = S.hero;
    if (h && !(h.inv > 0 && Math.floor(t * 20) % 2 && S.phase === 'play') && !(S.phase === 'dead' && S.phaseT > 0.5)) {
      var hx = X(h.x), hy = Y(h.y), A = L.chainShape(h);
      if (!retro && h.ground) { c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(hx, hy, 8, 2.2, 0, 0, TAU); c.fill(); }
      var stA = A ? { ph: A.ph, k: A.k, up: h.atk.up } : null;
      heroFig(c, hx, hy, h.face, { walk: h.walkT, air: !h.ground && !h.stair, crouch: h.crouch, stair: !!h.stair, atk: stA, hurt: h.kb || S.phase === 'dead', throwT: h.throwT, t: t }, retro);
      if (A) { var cr = h.crouch || (h.atk && h.atk.crouch) ? 9 : 0; chainFig(c, hx + h.face * 9, hy - 22 + cr + (A.ph === 'wind' ? 0 : 1), h.face, stA, T.logic.K.REACH[h.atk.lvl] * TS - 4, h.atk.up, t, retro); }
    }
    // снаряды героя
    S.shots.forEach(function (s) {
      var px = X(s.x), py = Y(s.y);
      if (s.k === 'flask' && s.fire) { for (var i = 0; i < 4; i++) { var hh = 8 + Math.sin(t * 22 + i * 2) * 3; box(c, i % 2 ? (retro ? '#ffff40' : '#ffe070') : (retro ? '#ff8800' : '#ff7a1a'), px - 10 + i * 5, py - hh, 5, hh); } return; }
      if (s.k === 'spring') { subIcon(c, 'spring', px, py, 1.4, t, retro); return; }
      if (s.k === 'stopper') { var sw = 0; c.save(); c.translate(X(S.hero.x), Y(S.hero.y) - 40); c.strokeStyle = retro ? '#e0e0ff' : '#e8e0ff'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, 0); c.lineTo(sw, 14); c.stroke(); circ(c, Q.top, sw, 16, 4); c.restore(); return; }
      subIcon(c, s.k, px, py, 1.1, s.spin || 0, retro);
    });
    // снаряды врагов
    S.eshots.forEach(function (q) {
      var px = X(q.x), py = Y(q.y), rp = q.r * TS;
      switch (q.k) {
        case 'oil': circ(c, retro ? '#302010' : '#2b2118', px, py, rp + 1); circ(c, retro ? '#d8a838' : '#c9a24a', px - 1, py - 1, 1.5); break;
        case 'egg': c.fillStyle = retro ? '#e0b850' : '#d6b25a'; c.beginPath(); c.ellipse(px, py, rp, rp * 1.25, 0, 0, TAU); c.fill(); break;
        case 'shard': box(c, retro ? '#e0b850' : '#d6b25a', px - 2, py - 2, 4, 3); break;
        case 'gear': gear(c, retro ? '#c0c8d0' : '#aeb9c0', px, py, rp + 1, 8, (q.spin || 0) * (q.roll || 1), Q.dark); break;
        case 'steam': circ(c, retro ? '#f0f0f0' : 'rgba(240,245,250,.85)', px, py, rp + 1); circ(c, retro ? '#c0c0c0' : 'rgba(200,210,220,.7)', px - 4, py + 1, rp - 1); break;
        case 'nut': c.fillStyle = retro ? '#a0a8b0' : '#9eabb3'; c.beginPath(); for (var k = 0; k < 6; k++) c.lineTo(px + Math.cos(k * 1.047 + (q.spin || 0)) * rp, py + Math.sin(k * 1.047 + (q.spin || 0)) * rp); c.fill(); circ(c, Q.dark, px, py, 1.5); break;
        case 'ember': circ(c, retro ? '#ff8800' : '#ff8a3a', px, py, rp); circ(c, '#ffe070', px, py, rp * 0.5); break;
        case 'wave': c.strokeStyle = retro ? '#f8d878' : 'rgba(255,230,160,.9)'; c.lineWidth = 2; for (var w2 = 0; w2 < 3; w2++) { c.beginPath(); c.arc(px - Math.sign(q.vx) * w2 * 4, py, 4 + w2 * 2, -1.2, 1.2); c.stroke(); } break;
        case 'dart': c.save(); c.translate(px, py); c.rotate(Math.atan2(q.vy, q.vx)); box(c, retro ? '#f0f0d0' : '#2a2016', -7, -1, 12, 2); c.fillStyle = retro ? '#f8d878' : '#d6b25a'; c.beginPath(); c.moveTo(7, 0); c.lineTo(2, -3.5); c.lineTo(2, 3.5); c.fill(); c.restore(); break;
        default: circ(c, '#ddd', px, py, rp);
      }
    });
    // частицы
    parts.forEach(function (p) { c.globalAlpha = Math.max(0, p.life / p.max); c.fillStyle = p.col; c.fillRect(Math.round(X(p.x)) - 1, Math.round(Y(p.y)) - 1, 3, 3); });
    c.globalAlpha = 1;
    // всплывающие надписи
    var font = retro ? '"Courier New",monospace' : 'Inter,system-ui,sans-serif';
    ui.toasts.forEach(function (q) { c.globalAlpha = Math.min(1, q.t * 2); c.fillStyle = q.color; c.font = '800 ' + (q.big ? 12 : 10) + 'px ' + font; c.textAlign = 'center'; c.fillText(q.text, X(q.x), Y(q.y)); });
    c.globalAlpha = 1;
    if (frozen && !retro) { c.fillStyle = 'rgba(150,200,255,.08)'; c.fillRect(0, 0, W, VH); }
    if (!retro) { var vg = c.createRadialGradient(W / 2, VH / 2, VH * 0.45, W / 2, VH / 2, W * 0.62); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.35)'); c.fillStyle = vg; c.fillRect(0, 0, W, VH); }
    c.restore();
  }

  // ---------- панель снизу ----------
  function hud(g, c, S, retro) {
    var th = g.th(), K = T.logic.K, y0 = VH, font = retro ? '"Courier New",monospace' : 'Inter,system-ui,sans-serif', t = g.time;
    box(c, retro ? '#000000' : '#0d1316', 0, y0, W, H - y0);
    box(c, retro ? '#d8a838' : '#2c3b40', 0, y0, W, 1);
    function txt(s, x, y, col, sz, al, wt) { c.fillStyle = col; c.font = (wt || 800) + ' ' + (sz || 10) + 'px ' + font; c.textAlign = al || 'left'; c.fillText(s, x, y); }
    // здоровье — шкала-манометр
    var bossOn = S.boss && (S.bossState === 'fight' || S.bossState === 'intro');
    txt(g.t('floor').toUpperCase() + ' ' + (S.fi + 1), 8, y0 + 12, th.accent, 10, 'left', 900);
    txt(bossOn ? g.t('b_' + S.boss.k) : g.t('f_' + S.key), 8, y0 + 25, bossOn ? (retro ? '#f07818' : '#e8833a') : th.muted, 9, 'left', 700);
    var hx = 128;
    for (var i = 0; i < K.HP; i++) { var on = i < S.hp; box(c, on ? (S.hp <= 4 ? th.bad : (retro ? '#58c8e8' : '#5ec8e6')) : (retro ? '#203038' : '#1e2a30'), hx + i * 6, y0 + 6, 4, 8); }
    if (S.boss && (S.bossState === 'fight' || S.bossState === 'intro')) {
      var b = S.boss, n = 16, k = Math.ceil(b.hp / b.max * n);
      for (var j = 0; j < n; j++) box(c, j < k ? (retro ? '#f07818' : '#e8833a') : (retro ? '#302010' : '#2a1f18'), hx + j * 6, y0 + 18, 4, 8);
    }
    // орудие и искры
    var sx = 248;
    {
      c.strokeStyle = retro ? '#d8a838' : '#4a5a60'; c.lineWidth = 1; c.strokeRect(sx + 0.5, y0 + 4.5, 22, 22);
      if (S.sub) subIcon(c, S.sub, sx + 11.5, y0 + 16, 1.3, t * 2, retro); else txt('—', sx + 11, y0 + 20, th.muted, 10, 'center', 700);
    }
    spark(c, 290, y0 + 11, 3, t, retro); txt('×' + S.sparks, 297, y0 + 15, th.ink, 11, 'left', 900);
    // ступень цепи
    for (var l = 0; l < 3; l++) { c.strokeStyle = l < S.chain ? (retro ? '#f8d878' : '#d6b25a') : (retro ? '#404040' : '#3a464c'); c.lineWidth = 2; c.beginPath(); c.ellipse(292 + l * 7, y0 + 24, 3, 2, 0, 0, TAU); c.stroke(); }
    // жизни, счёт
    txt(g.t('lives') + ' ' + Math.max(0, S.lives), 340, y0 + 13, th.ink, 10, 'left', 800);
    txt(g.t('score') + ' ' + S.score, W - 8, y0 + 13, th.warn, 11, 'right', 900);
    txt(g.t('best') + ' ' + Math.max(g.state.best || 0, S.score), W - 8, y0 + 26, th.muted, 9, 'right', 700);
  }

  T.render = function (g, ctx, S, ui) {
    var retro = g.themeName === 'retro', t = g.time, th = g.th();
    ctx.imageSmoothingEnabled = !retro;
    if (!S || !S.lv) { g.clear(); return; }
    if (retro && getBuf()) {
      var b = getBuf().getContext('2d'); b.imageSmoothingEnabled = false;
      b.save(); b.clearRect(0, 0, W / 2, VH / 2); b.scale(0.5, 0.5); world(b, S, ui, t, true); b.restore();
      ctx.drawImage(getBuf(), 0, 0, W / 2, VH / 2, 0, 0, W, VH);
    } else world(ctx, S, ui, t, retro);
    hud(g, ctx, S, retro);
    var font = retro ? '"Courier New",monospace' : 'Inter,system-ui,sans-serif';
    function txt(s, x, y, col, sz, wt) { ctx.fillStyle = col; ctx.font = (wt || 900) + ' ' + sz + 'px ' + font; ctx.textAlign = 'center'; ctx.fillText(s, x, y); }
    function veil(a) { ctx.fillStyle = retro ? 'rgba(0,0,0,' + a + ')' : 'rgba(6,12,14,' + a + ')'; ctx.fillRect(0, 0, W, VH); }
    if (ui.banner && ui.banner.a > 0) {
      ctx.globalAlpha = Math.min(1, ui.banner.a * 2);
      veil(0.45); txt(ui.banner.title, W / 2, VH / 2 - 6, th.accent, 22); if (ui.banner.sub) txt(ui.banner.sub, W / 2, VH / 2 + 16, th.ink, 12, 700);
      if (ui.banner.code) txt(ui.banner.code, W / 2, VH / 2 + 36, th.muted, 11, 700);
      ctx.globalAlpha = 1;
    }
    if (ui.msg && ui.msg.a > 0) { ctx.globalAlpha = Math.min(1, ui.msg.a * 2); txt(ui.msg.text, W / 2, 34, ui.msg.color, 14); ctx.globalAlpha = 1; }
    if (S.phase === 'cont') {
      veil(0.7); txt(g.t('contQ'), W / 2, VH / 2 - 10, th.warn, 22);
      txt(String(Math.max(0, Math.ceil(ui.contT || 0))), W / 2, VH / 2 + 22, th.ink, 26);
      txt(g.t('contHint') + ' (' + S.conts + ')', W / 2, VH / 2 + 46, th.muted, 11, 700);
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
