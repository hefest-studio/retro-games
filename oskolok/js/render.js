/* ОСКОЛОК · отрисовка (обе темы). modern — градиенты, свечение, мягкие тени; retro — тот же кадр в буфере 256×144 плоскими цветами
   ограниченной палитры. Тема меняет только вид, не логику. Вид 32×16 клеток по 16 px (512×256) + панель 32 px снизу.
   OSKOLOK.render(g, ctx, S, ui) · OSKOLOK.R — фигуры, палитры · OSKOLOK.fx — частицы.
   Облик — свой: заброшенная стекловарня (кирпич, остывшие горны, тёплые окна-топки), подмастерье в охристом фартуке и индиго-колпаке
   с оранжевым помпоном; осколок — бирюзовая стеклянная пластинка; стеклянные стены — голубоватое стекло с бликами; враги — угольные
   ползуны, огненные мотыльки и латунные лампы-стрелки. */
(function (global) {
  'use strict';
  var O = global.OSKOLOK = global.OSKOLOK || {};
  var W = 512, H = 288, TS = 16, VH = 256, TAU = Math.PI * 2;
  var R = { W: W, H: H, TS: TS, VH: VH };
  O.R = R;

  // ---------- палитры залов ----------
  // sky — фон (3 стопа), far — дальние арки, win — тёплые окна, top — кромка кирпича, body — кирпич, dark — швы
  var PAL = {
    yard:       { sky: ['#1b1530', '#3a2340', '#6b3a3a'], far: '#3a2a52', win: '#ffb050', top: '#d9904a', body: '#4a3340', dark: '#2c1e28', rim: '#f0b870',
                  r: { sky: '#000028', far: '#280048', win: '#f8a800', top: '#e08040', body: '#582848', dark: '#201020', rim: '#f8d080' } },
    works:      { sky: ['#1d1214', '#3b1b1a', '#5e2a1e'], far: '#47241f', win: '#ff8a3a', top: '#e0743a', body: '#4d2e2a', dark: '#2a1a18', rim: '#ffb070',
                  r: { sky: '#200000', far: '#400800', win: '#f87800', top: '#e86020', body: '#602820', dark: '#201008', rim: '#f8a050' } },
    tower:      { sky: ['#0b1226', '#16264a', '#233a66'], far: '#26396a', win: '#ffd070', top: '#c8a060', body: '#33405c', dark: '#1d2740', rim: '#e8d098',
                  r: { sky: '#000030', far: '#001860', win: '#f8d848', top: '#c89848', body: '#283878', dark: '#101840', rim: '#f0e090' } },
    hot:        { sky: ['#240c0c', '#4d1810', '#7a2c14'], far: '#52201a', win: '#ffc040', top: '#ff8a3a', body: '#5a2a22', dark: '#301612', rim: '#ffc888',
                  r: { sky: '#300000', far: '#580000', win: '#f8c000', top: '#f87810', body: '#702010', dark: '#280800', rim: '#f8c080' } },
    glasshouse: { sky: ['#0a1d1c', '#12383a', '#1c5654'], far: '#1f5250', win: '#b8ffe8', top: '#7ad0b8', body: '#2c4a48', dark: '#1a2e2d', rim: '#c0f0e0',
                  r: { sky: '#002820', far: '#005848', win: '#a8f8e0', top: '#58c8a8', body: '#205858', dark: '#103030', rim: '#c0f8e8' } },
    furnace:    { sky: ['#1a0c06', '#4a1c08', '#8a3a0c'], far: '#52220f', win: '#ffd060', top: '#ffb040', body: '#5c3018', dark: '#2e1808', rim: '#ffe090',
                  r: { sky: '#280800', far: '#582000', win: '#f8d040', top: '#f8a828', body: '#704010', dark: '#301000', rim: '#f8e078' } }
  };
  R.PAL = PAL;
  var HERO = {
    m: { apron: '#d9a441', apronD: '#a97a24', shirt: '#efe2c4', shirtD: '#c9b88e', hat: '#34408a', hatD: '#232c60', pom: '#ff7a1a', skin: '#e9b98f', boot: '#2a2220', pants: '#4a3a52', soot: '#3a2e2a' },
    r: { apron: '#e0a838', apronD: '#a87818', shirt: '#f0e0c0', shirtD: '#c0b088', hat: '#3848a8', hatD: '#202878', pom: '#f87818', skin: '#f0b890', boot: '#201818', pants: '#583860', soot: '#302828' }
  };
  var SH = { m: { a: '#9ff3ff', b: '#4fc7e6', c: '#d8fbff', d: '#2a8fb0' }, r: { a: '#58f8f8', b: '#00a8a8', c: '#f8f8f8', d: '#007878' } };
  R.HERO = HERO; R.SH = SH;

  // ---------- частицы ----------
  var parts = [];
  var fx = {
    puff: function (x, y, col, n, sp, life, grav) { for (var i = 0; i < n; i++) { var a = Math.random() * TAU, v = sp * (0.3 + Math.random() * 0.7); parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (grav ? sp * 0.4 : 0), g: grav ? 18 : 0, life: life * (0.6 + Math.random() * 0.4), max: life, col: col }); } if (parts.length > 260) parts.splice(0, parts.length - 260); },
    step: function (dt) { for (var i = parts.length - 1; i >= 0; i--) { var p = parts[i]; p.life -= dt; if (p.life <= 0) { parts.splice(i, 1); continue; } p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; } },
    clear: function () { parts.length = 0; }
  };
  O.fx = fx;
  var swapFx = null;   // { x0,y0,x1,y1,t } — след обмена
  fx.swap = function (a) { swapFx = { x0: a.x0, y0: a.y0, x1: a.x1, y1: a.y1, t: 0.35 }; };
  fx.stepSwap = function (dt) { if (swapFx) { swapFx.t -= dt; if (swapFx.t <= 0) swapFx = null; } };

  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function box(c, col, x, y, w, h) { c.fillStyle = col; c.fillRect(x, y, w, h); }
  function circ(c, col, x, y, r) { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
  R.rr = rr;

  // ---------- осколок (кристаллическая пластинка) ----------
  function shardFig(c, x, y, ang, retro, glow) {
    var P = retro ? SH.r : SH.m;
    c.save(); c.translate(x, y); c.rotate(ang);
    if (!retro && glow) { var gr = c.createRadialGradient(0, 0, 1, 0, 0, 12); gr.addColorStop(0, 'rgba(140,240,255,' + (0.5 * glow) + ')'); gr.addColorStop(1, 'rgba(140,240,255,0)'); c.fillStyle = gr; c.fillRect(-12, -12, 24, 24); }
    c.fillStyle = P.b; c.beginPath(); c.moveTo(-6, 0); c.lineTo(-1, -4); c.lineTo(6, -1); c.lineTo(2, 4); c.closePath(); c.fill();
    c.fillStyle = P.a; c.beginPath(); c.moveTo(-6, 0); c.lineTo(-1, -4); c.lineTo(1, 0); c.closePath(); c.fill();
    c.fillStyle = P.d; c.beginPath(); c.moveTo(1, 0); c.lineTo(6, -1); c.lineTo(2, 4); c.closePath(); c.fill();
    c.fillStyle = P.c; c.fillRect(-2, -2, 2, 1);
    c.restore();
  }
  R.shardFig = shardFig;

  // ---------- подмастерье ----------
  function heroFig(c, x, y, f, st, retro) {
    var P = retro ? HERO.r : HERO.m, t = st.t || 0, wk = st.walk || 0, air = st.air, bob = air ? 0 : Math.abs(Math.sin(wk * 2.2)) * (st.moving ? 1.2 : 0);
    c.save(); c.translate(x, y); c.scale(f, 1);
    var ls = air ? 3 : Math.sin(wk * 2.2) * 3.5;
    // ноги
    box(c, P.boot, -5 + ls * 0.4, -5, 4, 5); box(c, P.boot, 1 - ls * 0.4, -5, 4, 5);
    box(c, P.pants, -4 + ls * 0.3, -11, 3, 7); box(c, P.pants, 1 - ls * 0.3, -11, 3, 7);
    // тело: рубаха и фартук
    box(c, P.shirt, -5, -20 - bob, 10, 10); box(c, P.apron, -4, -17 - bob, 8, 9); box(c, P.apronD, -4, -10 - bob, 8, 2); box(c, P.soot, -3, -14 - bob, 3, 2);
    // голова
    circ(c, P.skin, 0, -24 - bob, 4.6);
    box(c, '#2a1a14', 1.5, -25 - bob, 1.6, 1.8);
    // колпак с помпоном
    c.fillStyle = P.hat; c.beginPath(); c.arc(0, -25.5 - bob, 5, Math.PI, 0); c.fill(); box(c, P.hatD, -5, -26 - bob, 10, 2);
    circ(c, P.pom, -3, -31.5 - bob, 2.2);
    // рука с осколком
    var arm = st.throwT > 0 ? -1 : 0;
    box(c, P.shirtD, 2, -17 - bob + arm * 3, 5, 3);
    if (st.hasShard) shardFig(c, 9, -16 - bob + arm * 3, -0.5 + Math.sin(t * 5) * 0.08, retro, 0.6);
    c.restore();
  }
  R.heroFig = heroFig;

  // ---------- враги ----------
  function foeFig(c, e, px, py, t, retro) {
    if (e.k === 'crawler') {   // угольный ползун: панцирь с гранями и тёплые глазки
      c.save(); c.translate(px, py); c.scale(e.face, 1);
      var w = Math.sin(t * 9 + e.id) * 1.5;
      box(c, retro ? '#202020' : '#1c1816', -7 + w, -3, 3, 3); box(c, retro ? '#202020' : '#1c1816', 4 - w, -3, 3, 3);
      c.fillStyle = retro ? '#585858' : '#3a3330'; c.beginPath(); c.moveTo(-8, -3); c.lineTo(-5, -12); c.lineTo(2, -14); c.lineTo(8, -7); c.lineTo(8, -3); c.closePath(); c.fill();
      c.fillStyle = retro ? '#a8a8a8' : '#5a504a'; c.beginPath(); c.moveTo(-5, -12); c.lineTo(2, -14); c.lineTo(0, -8); c.closePath(); c.fill();
      circ(c, retro ? '#f87800' : '#ff9a3a', 5, -7, 1.6); circ(c, retro ? '#f8d800' : '#ffe070', 5.4, -7.2, 0.7);
      c.restore();
    } else if (e.k === 'bat') {   // огненный мотылёк
      var fl = Math.sin(t * 18 + e.id) * 4;
      c.save(); c.translate(px, py); c.scale(e.face, 1);
      c.fillStyle = retro ? '#f87800' : '#ff8a2a'; c.beginPath(); c.moveTo(0, 0); c.lineTo(-8, -5 - fl); c.lineTo(-6, 3); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(0, 0); c.lineTo(8, -5 + fl); c.lineTo(6, 3); c.closePath(); c.fill();
      c.fillStyle = retro ? '#f8d800' : '#ffd060'; c.beginPath(); c.moveTo(0, 0); c.lineTo(-5, -2 - fl * 0.5); c.lineTo(-4, 2); c.closePath(); c.fill(); c.beginPath(); c.moveTo(0, 0); c.lineTo(5, -2 + fl * 0.5); c.lineTo(4, 2); c.closePath(); c.fill();
      circ(c, retro ? '#a80000' : '#7a2418', 0, 0, 2.6); c.restore();
    } else {   // лампа-стрелок: латунная стойка и красный глаз
      c.save(); c.translate(px, py); c.scale(e.face, 1);
      box(c, retro ? '#a85800' : '#8a6a2a', -5, -3, 10, 3); box(c, retro ? '#a85800' : '#a58232', -2, -9, 4, 6);
      c.fillStyle = retro ? '#a85800' : '#c9a24a'; c.beginPath(); c.moveTo(-5, -9); c.lineTo(2, -16); c.lineTo(8, -13); c.lineTo(8, -7); c.lineTo(-1, -6); c.closePath(); c.fill();
      var cd = Math.max(0, Math.min(1, e.t / K_TURRET));
      circ(c, cd > 0.8 ? (retro ? '#f8f8f8' : '#fff0c0') : (retro ? '#f80000' : '#ff4a2a'), 6, -10.5, 2.4 + cd * 0.8);
      c.restore();
    }
  }
  var K_TURRET = 2.4;
  R.foeFig = foeFig;

  // ---------- мир ----------
  function background(c, P, Q, retro, camX, camY, t) {
    if (retro) { box(c, Q.sky, 0, 0, W, VH); }
    else { var gr = c.createLinearGradient(0, 0, 0, VH); gr.addColorStop(0, P.sky[0]); gr.addColorStop(0.55, P.sky[1]); gr.addColorStop(1, P.sky[2]); c.fillStyle = gr; c.fillRect(0, 0, W, VH); }
    // дальние арки и трубы (параллакс), в окнах — тёплый огонь горнов
    for (var layer = 0; layer < 2; layer++) {
      var par = layer ? 0.35 : 0.18, sp = layer ? 150 : 210, base = layer ? 0 : 34;
      var off = -(camX * TS * par) % sp, offY = -camY * TS * par * 0.5;
      for (var i = -1; i < W / sp + 2; i++) {
        var x = off + i * sp, hh = 70 + ((i * 37 + layer * 11 + Math.floor(camX * TS * par / sp) * 13) % 5 + 5) % 5 * 14;
        c.fillStyle = Q.far; c.fillRect(x, VH - hh - base + offY, 54, hh + base);
        c.beginPath(); c.arc(x + 27, VH - hh - base + offY, 27, Math.PI, 0); c.fill();
        c.fillStyle = Q.far; c.fillRect(x + 62, VH - hh * 0.6 - base + offY, 14, hh * 0.6 + base);
        var fl = 0.7 + Math.sin(t * 3 + i) * 0.3; c.globalAlpha = retro ? 1 : 0.35 + 0.35 * fl; c.fillStyle = P.win;
        c.fillRect(x + 21, VH - hh + 14 - base + offY, 12, 18); c.globalAlpha = 1;
      }
    }
    if (!retro) { c.fillStyle = 'rgba(255,200,140,.14)'; for (var p = 0; p < 20; p++) { var px = ((p * 97 - camX * TS * 0.7 - t * 6) % W + W) % W, py = ((p * 53 - t * 10) % VH + VH) % VH; c.fillRect(px, py, 1.5, 1.5); } }
  }
  function tiles(c, S, P, Q, retro, camX, camY, t) {
    var M = S.lv, c0 = Math.max(0, Math.floor(camX)), c1 = Math.min(M.W - 1, Math.ceil(camX + 32)), r0 = Math.max(0, Math.floor(camY)), r1 = Math.min(M.H - 1, Math.ceil(camY + 16));
    for (var r = r0; r <= r1; r++) for (var cc = c0; cc <= c1; cc++) {
      var ch = M.t[r * M.W + cc]; if (ch === '.') continue;
      var x = Math.round((cc - camX) * TS), y = Math.round((r - camY) * TS);
      if (ch === '#') {
        var up = r > 0 && M.t[(r - 1) * M.W + cc] === '#';
        box(c, Q.body, x, y, TS, TS); box(c, Q.dark, x, y + 7, TS, 1); box(c, Q.dark, x + ((r + cc) % 2 ? 4 : 11), y, 1, 7); box(c, Q.dark, x + ((r + cc) % 2 ? 11 : 4), y + 8, 1, 8);
        if (!up) { box(c, Q.top, x, y, TS, 3); box(c, Q.rim, x, y, TS, 1); }
        if (!retro && r + 1 < M.H && M.t[(r + 1) * M.W + cc] !== '#') box(c, 'rgba(0,0,0,.25)', x, y + TS - 2, TS, 2);
      } else if (ch === 'g') {   // стеклянная стена
        c.fillStyle = retro ? '#005858' : 'rgba(150,225,240,.22)'; c.fillRect(x, y, TS, TS);
        c.fillStyle = retro ? '#58f8f8' : 'rgba(210,248,255,.75)'; c.fillRect(x + 1, y, 2, TS); c.fillRect(x + TS - 3, y, 1, TS);
        var gl = ((cc * 5 + r * 3) % 4) * 3; c.fillStyle = retro ? '#f8f8f8' : 'rgba(255,255,255,.85)'; c.fillRect(x + 5, y + 2 + gl, 1.6, 4); c.fillRect(x + 8, y + 9, 1, 2);
      } else if (ch === '^') {
        c.fillStyle = retro ? '#58f8f8' : '#a8ecf8'; for (var k = 0; k < 2; k++) { c.beginPath(); c.moveTo(x + k * 8, y + TS); c.lineTo(x + k * 8 + 4, y + 3); c.lineTo(x + k * 8 + 8, y + TS); c.closePath(); c.fill(); }
        c.fillStyle = retro ? '#f8f8f8' : '#ffffff'; c.fillRect(x + 3, y + 8, 1, 6); c.fillRect(x + 11, y + 8, 1, 6);
      } else if (ch === 'k') {   // лампа-отметка
        var on = S.lit && S.lit[r * M.W + cc];
        box(c, retro ? '#a85800' : '#6b4a2a', x + 7, y + 4, 2, 12); box(c, retro ? '#a85800' : '#8a6a2a', x + 4, y + 3, 8, 3);
        if (on) { circ(c, retro ? '#f8d800' : '#ffd36a', x + 8, y - 1 + Math.sin(t * 9) * 0.6, 3.4); circ(c, retro ? '#f8f8f8' : '#fff0b0', x + 8, y - 0.5, 1.5); if (!retro) { var g2 = c.createRadialGradient(x + 8, y, 1, x + 8, y, 26); g2.addColorStop(0, 'rgba(255,190,90,.35)'); g2.addColorStop(1, 'rgba(255,190,90,0)'); c.fillStyle = g2; c.fillRect(x - 18, y - 26, 52, 52); } }
        else circ(c, retro ? '#505050' : '#5a4a3a', x + 8, y - 1, 2.6);
      } else if (ch === 'X') {   // дверь горна: арка с огнём
        var top = r > 0 && M.t[(r - 1) * M.W + cc] === 'X';
        box(c, retro ? '#000000' : '#150a06', x, y, TS, TS);
        var fh = 0.6 + 0.4 * Math.sin(t * 6 + r);
        c.fillStyle = retro ? '#f87800' : 'rgba(255,140,40,' + (0.55 + 0.25 * fh) + ')'; c.fillRect(x + 2, y + (top ? 0 : 5), TS - 4, TS - (top ? 0 : 5));
        c.fillStyle = retro ? '#f8d800' : 'rgba(255,220,120,.8)'; c.fillRect(x + 5, y + (top ? 2 : 8), TS - 10, TS - 8 - (top ? 0 : 3));
        box(c, Q.top, x, y, 2, TS); box(c, Q.top, x + TS - 2, y, 2, TS); if (!top) box(c, Q.top, x, y, TS, 3);
      }
    }
  }
  var buf = null;
  function getBuf() { if (!buf && typeof document !== 'undefined') { buf = document.createElement('canvas'); buf.width = W / 2; buf.height = VH / 2; } return buf; }
  function world(c, S, ui, t, retro) {
    var P = PAL[S.key] || PAL.yard, Q = retro ? P.r : P, camX = S.cam.x, camY = S.cam.y;
    var sx = 0, sy = 0; if (ui.shake > 0) { sx = (Math.random() - 0.5) * ui.shake * 8; sy = (Math.random() - 0.5) * ui.shake * 8; }
    c.save(); c.beginPath(); c.rect(0, 0, W, VH); c.clip(); c.translate(Math.round(sx), Math.round(sy));
    background(c, P, Q, retro, camX, camY, t);
    function X(x) { return (x - camX) * TS; } function Y(y) { return (y - camY) * TS; }
    tiles(c, S, P, Q, retro, camX, camY, t);
    // бусины и сердечки
    S.items.forEach(function (it) {
      if (it.got) return; var px = X(it.x), py = Y(it.y) + Math.sin(t * 3 + it.x) * 1.5; if (px < -10 || px > W + 10 || py < -10 || py > VH + 10) return;
      if (it.k === 'bead') { circ(c, retro ? '#f87800' : '#ff9a3a', px, py, 4); circ(c, retro ? '#f8d800' : '#ffd070', px - 1, py - 1, 2); box(c, '#fff', px - 2, py - 2, 1, 1); }
      else { c.fillStyle = retro ? '#f80000' : '#ff5a5a'; c.beginPath(); c.moveTo(px, py + 5); c.lineTo(px - 6, py - 1); c.arc(px - 3, py - 2, 3.2, Math.PI, 0); c.arc(px + 3, py - 2, 3.2, Math.PI, 0); c.lineTo(px + 6, py - 1); c.closePath(); c.fill(); }
    });
    // враги
    S.enemies.forEach(function (e) { var px = X(e.x); if (px > -30 && px < W + 30 && e.alive) foeFig(c, e, px, Y(e.y), t, retro); });
    // снаряды-искры
    S.sparks.forEach(function (q) { var px = X(q.x), py = Y(q.y); circ(c, retro ? '#f87800' : '#ff8a3a', px, py, 3.2); circ(c, retro ? '#f8f8f8' : '#ffe8a0', px, py, 1.4); });
    // связь героя с воткнутым осколком
    var h = S.hero, sh = S.shard;
    if (sh.st === 'plant' && !h.dead) {
      var ax = X(h.x), ay = Y(h.y) - 14, bx = X(sh.x), by = Y(sh.y);
      c.save(); c.strokeStyle = retro ? '#58f8f8' : 'rgba(150,240,255,.55)'; c.lineWidth = 1; if (c.setLineDash) c.setLineDash([3, 4]); c.lineDashOffset = -t * 20; c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke(); c.restore();
      var pu = 0.6 + 0.4 * Math.sin(t * 7); c.globalAlpha = 0.5 + 0.5 * pu; shardFig(c, bx, by, sh.kind === 'wall' ? (sh.dir > 0 ? -1.2 : 1.2) : sh.kind === 'ceil' ? 3.14 : -0.2, retro, 1 + pu); c.globalAlpha = 1;
      c.strokeStyle = retro ? '#58f8f8' : 'rgba(170,245,255,.8)'; c.lineWidth = 1; c.beginPath(); c.arc(bx, by, 7 + pu * 3, 0, TAU); c.stroke();
    } else if (sh.st === 'fly') {
      shardFig(c, X(sh.x), Y(sh.y), t * 22, retro, 1.2);
      if (!retro) { c.fillStyle = 'rgba(160,240,255,.5)'; for (var k = 1; k < 4; k++) { c.fillRect(X(sh.x - sh.vx * 0.012 * k) - 1, Y(sh.y - sh.vy * 0.012 * k) - 1, 2.5 - k * 0.5, 2.5 - k * 0.5); } }
    }
    // герой
    if (h && !(h.inv > 0 && Math.floor(t * 20) % 2 && S.phase === 'play') && !(S.phase === 'dead' && S.phaseT > 0.5)) {
      var hx = X(h.x), hy = Y(h.y);
      if (!retro && h.ground) { c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(hx, hy, 7, 2, 0, 0, TAU); c.fill(); }
      heroFig(c, hx, hy, h.face, { walk: h.walkT, air: !h.ground, moving: Math.abs(h.vx) > 0.5, t: t, hasShard: sh.st === 'hand', throwT: ui.throwT > 0 ? 1 : 0 }, retro);
    }
    // след обмена
    if (swapFx) { var k2 = 1 - swapFx.t / 0.35; c.globalAlpha = 1 - k2; c.strokeStyle = retro ? '#58f8f8' : 'rgba(180,250,255,.9)'; c.lineWidth = 2; c.beginPath(); c.moveTo(X(swapFx.x0), Y(swapFx.y0)); c.lineTo(X(swapFx.x1), Y(swapFx.y1)); c.stroke();
      c.beginPath(); c.arc(X(swapFx.x0), Y(swapFx.y0), 4 + k2 * 16, 0, TAU); c.stroke(); c.beginPath(); c.arc(X(swapFx.x1), Y(swapFx.y1), 18 - k2 * 14, 0, TAU); c.stroke(); c.globalAlpha = 1; }
    parts.forEach(function (p) { c.globalAlpha = Math.max(0, p.life / p.max); c.fillStyle = p.col; c.fillRect(Math.round(X(p.x)) - 1, Math.round(Y(p.y)) - 1, 3, 3); });
    c.globalAlpha = 1;
    var font = retro ? '"Courier New",monospace' : 'Inter,system-ui,sans-serif';
    ui.toasts.forEach(function (q) { c.globalAlpha = Math.min(1, q.t * 2); c.fillStyle = q.color; c.font = '800 ' + (q.big ? 12 : 10) + 'px ' + font; c.textAlign = 'center'; c.fillText(q.text, X(q.x), Y(q.y)); });
    c.globalAlpha = 1;
    if (!retro) { var vg = c.createRadialGradient(W / 2, VH / 2, VH * 0.45, W / 2, VH / 2, W * 0.62); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.4)'); c.fillStyle = vg; c.fillRect(0, 0, W, VH); }
    c.restore();
  }

  // ---------- панель ----------
  function heartIcon(c, x, y, on, retro) { c.fillStyle = on ? (retro ? '#f80000' : '#ff5a5a') : (retro ? '#400000' : '#3a2022'); c.beginPath(); c.moveTo(x, y + 6); c.lineTo(x - 6, y); c.arc(x - 3, y - 1.5, 3.2, Math.PI, 0); c.arc(x + 3, y - 1.5, 3.2, Math.PI, 0); c.lineTo(x + 6, y); c.closePath(); c.fill(); }
  function hud(g, c, S, retro) {
    var th = g.th(), y0 = VH, font = retro ? '"Courier New",monospace' : 'Inter,system-ui,sans-serif', t = g.time;
    box(c, retro ? '#000000' : '#150e0c', 0, y0, W, H - y0); box(c, retro ? '#e08040' : '#3a2820', 0, y0, W, 1);
    function txt(s, x, y, col, sz, al, wt) { c.fillStyle = col; c.font = (wt || 800) + ' ' + (sz || 10) + 'px ' + font; c.textAlign = al || 'left'; c.fillText(s, x, y); }
    txt(g.t('level').toUpperCase() + ' ' + (S.fi + 1) + '/' + O.LEVELS.length, 8, y0 + 12, th.accent, 10, 'left', 900);
    txt(g.t('f_' + S.key), 8, y0 + 25, th.muted, 9, 'left', 700);
    for (var i = 0; i < 3; i++) heartIcon(c, 132 + i * 17, y0 + 11, i < S.hp, retro);
    txt('×' + Math.max(0, S.lives), 190, y0 + 14, th.ink, 11, 'left', 900);
    // состояние осколка
    var st = S.shard.st, sx = 232, label = st === 'hand' ? g.t('shHand') : st === 'plant' ? g.t('shSwap') : g.t('shFly');
    shardFig(c, sx, y0 + 15, st === 'fly' ? t * 12 : -0.5, retro, st === 'plant' ? 0.9 : 0);
    txt(label, sx + 12, y0 + 18, st === 'plant' ? th.good : th.ink, 10, 'left', 800);
    txt(g.t('score') + ' ' + S.score, W - 8, y0 + 13, th.warn, 11, 'right', 900);
    txt(g.t('best') + ' ' + Math.max(g.state.best || 0, S.score), W - 8, y0 + 26, th.muted, 9, 'right', 700);
  }

  O.render = function (g, ctx, S, ui) {
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
    function veil(a) { ctx.fillStyle = retro ? 'rgba(0,0,0,' + a + ')' : 'rgba(14,8,6,' + a + ')'; ctx.fillRect(0, 0, W, VH); }
    if (ui.banner && ui.banner.a > 0) { ctx.globalAlpha = Math.min(1, ui.banner.a * 2); veil(0.45); txt(ui.banner.title, W / 2, VH / 2 - 6, th.accent, 22); if (ui.banner.sub) txt(ui.banner.sub, W / 2, VH / 2 + 16, th.ink, 12, 700); if (ui.banner.code) txt(ui.banner.code, W / 2, VH / 2 + 36, th.muted, 11, 700); ctx.globalAlpha = 1; }
    if (ui.msg && ui.msg.a > 0) { ctx.globalAlpha = Math.min(1, ui.msg.a * 2); var mw = Math.min(W - 24, ctx.measureText ? 0 : 0); ctx.font = '900 13px ' + font; var tw = ctx.measureText(ui.msg.text).width + 20; ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(W / 2 - tw / 2, 18, tw, 22); txt(ui.msg.text, W / 2, 34, ui.msg.color, 13); ctx.globalAlpha = 1; }
    if (S.phase === 'cont') { veil(0.7); txt(g.t('contQ'), W / 2, VH / 2 - 10, th.warn, 22); txt(String(Math.max(0, Math.ceil(ui.contT || 0))), W / 2, VH / 2 + 22, th.ink, 26); txt(g.t('contHint') + ' (' + S.conts + ')', W / 2, VH / 2 + 46, th.muted, 11, 700); }
  };
})(typeof window !== 'undefined' ? window : globalThis);
