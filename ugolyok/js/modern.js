/* УГОЛЁК · рендер MODERN (по умолчанию). UGOLYOK.modern = { P, KC, bg, draw, hero, lifeIcon, coalIcon, keyIcon, helmetIcon }
   Угольная шахта в полумраке: свет глаз-фонарей Уголька и жар его топки, порода своего цвета на каждом ярусе,
   крепь, трубы и балки; прессы в жёлто-чёрную полосу, вагонетки, конвейеры, капли.
   Логику не трогает — только читает состояние. Статичный слой экрана кэшируется. */
(function (global) {
  'use strict';
  var U = global.UGOLYOK = global.UGOLYOK || {};
  var L = U.logic, T = 32, OY = 36, COLS = L.COLS, ROWS = L.ROWS;

  var P = {
    pixel: false, font: null,
    hudBg: '#0f0c0b', hudLine: '#2c2421', ink: '#f4ece6', muted: '#a8998f', accent: '#ff6b3d', good: '#66e08a', bad: '#ff5d5d', warn: '#ffd166',
    bar: '#2e2522', panel: '#191311', panelA: 'rgba(25,19,17,.95)', line: '#45362f', mapLine: '#8d7d72', mapDim: '#4c403a',
    beaconMap: '#ffcf6a', dim: '#4a3e38', helmet: '#ffc83d',
    zoneMap: ['#7a5236', '#3f5266', '#4d5a3a', '#6e3d2a', '#3c4250', '#2a2a30']
  };
  var KC = { 1: '#e07a3f', 2: '#8fb4d8', 3: '#f2cf55' };          // медный, стальной, латунный
  var ZC = [
    { bg: ['#24170f', '#0e0806'], far: 'rgba(160,100,60,.08)', rock: '#5e4030', hi: '#a8754d', dk: '#2c1c14', speck: 'rgba(255,170,110,', dark: 0.42 },
    { bg: ['#141b22', '#06090c'], far: 'rgba(110,150,190,.07)', rock: '#3c4a58', hi: '#7890a8', dk: '#1a2129', speck: 'rgba(150,200,255,', dark: 0.55 },
    { bg: ['#181a12', '#080906'], far: 'rgba(150,170,100,.06)', rock: '#4a4f38', hi: '#8c9468', dk: '#22251a', speck: 'rgba(210,230,150,', dark: 0.52 },
    { bg: ['#22120c', '#0c0504'], far: 'rgba(200,110,70,.07)', rock: '#5a3224', hi: '#a5603f', dk: '#2a150e', speck: 'rgba(255,150,100,', dark: 0.55 },
    { bg: ['#13151b', '#06070a'], far: 'rgba(140,150,180,.07)', rock: '#3a3e4a', hi: '#7a8296', dk: '#1a1c23', speck: 'rgba(200,210,240,', dark: 0.55 },
    { bg: ['#0e0e11', '#030304'], far: 'rgba(120,120,140,.07)', rock: '#26262c', hi: '#5c5c6a', dk: '#111114', speck: 'rgba(255,190,120,', dark: 0.6 }
  ];
  var rr = function (ctx, x, y, w, h, r) { U.ui.roundRect(ctx, x, y, w, h, r); };
  function X(x) { return x * T; }
  function Y(y) { return OY + y * T; }
  var curZone = 0;

  function bg(ctx, g) {
    var z = ZC[curZone], gr = ctx.createLinearGradient(0, 0, 0, g.H);
    gr.addColorStop(0, z.bg[0]); gr.addColorStop(1, z.bg[1]);
    ctx.fillStyle = gr; ctx.fillRect(0, 0, g.W, g.H);
  }

  // ---------- Статичный слой экрана (зависит только от экрана) ----------
  var cache = {}, cacheN = 0;
  var ST0 = { keys: {}, gate: false };
  function staticLayer(rm) {
    if (cache[rm.i]) return cache[rm.i];
    if (++cacheN > 40) { cache = {}; cacheN = 1; }
    var c = document.createElement('canvas'); c.width = COLS * T; c.height = ROWS * T;
    var x = c.getContext('2d'), z = ZC[rm.zone], W = c.width, H = c.height, k, i;
    var seed = rm.i * 7919 + 17, rnd = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    var gr = x.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, z.bg[0]); gr.addColorStop(1, z.bg[1]);
    x.fillStyle = gr; x.fillRect(0, 0, W, H);
    // дальний план
    x.fillStyle = z.far;
    for (i = 0; i < 6; i++) { x.beginPath(); x.ellipse(rnd() * W, rnd() * H, 40 + rnd() * 90, 30 + rnd() * 60, rnd() * 3, 0, Math.PI * 2); x.fill(); }
    if (rm.zone === 0) {            // мастерская: кирпичная стена и полки
      x.fillStyle = 'rgba(150,80,50,.10)';
      for (var by = 40; by < H - 60; by += 14) for (var bx = ((by / 14) % 2) * 14; bx < W; bx += 28) x.fillRect(bx, by, 25, 11);
      x.fillStyle = 'rgba(120,80,50,.22)'; for (i = 0; i < 2; i++) { var sx = 120 + i * 300 + rnd() * 60; x.fillRect(sx, 70 + rnd() * 30, 90, 5); }
    } else if (rm.zone === 1) {     // штрек: деревянная крепь
      x.fillStyle = 'rgba(120,90,60,.16)';
      for (i = 0; i < 4; i++) { var px = 60 + i * 160 + rnd() * 30; x.fillRect(px, 0, 10, H); x.fillRect(px - 10, 30 + rnd() * 20, 120, 9); }
    } else if (rm.zone === 2) {     // конвейерный ярус: трубы
      x.strokeStyle = 'rgba(150,170,110,.14)'; x.lineWidth = 9;
      for (i = 0; i < 2; i++) { var py = 50 + i * 70 + rnd() * 20; x.beginPath(); x.moveTo(0, py); x.lineTo(W, py); x.stroke(); }
      x.lineWidth = 6; for (i = 0; i < 3; i++) { var qx = 100 + rnd() * 440; x.beginPath(); x.moveTo(qx, 0); x.lineTo(qx, 120); x.stroke(); }
    } else if (rm.zone === 3) {     // рельсовые галереи: арки
      x.strokeStyle = 'rgba(200,110,70,.12)'; x.lineWidth = 10;
      for (i = 0; i < 3; i++) { x.beginPath(); x.arc(110 + i * 210, 220, 110, Math.PI, 0); x.stroke(); }
    } else if (rm.zone === 4) {     // прессовый цех: стальные фермы
      x.strokeStyle = 'rgba(160,170,200,.10)'; x.lineWidth = 4;
      for (i = 0; i < 7; i++) { x.beginPath(); x.moveTo(i * 100, 20); x.lineTo(i * 100 + 50, 90); x.lineTo(i * 100 + 100, 20); x.stroke(); }
      x.beginPath(); x.moveTo(0, 20); x.lineTo(W, 20); x.moveTo(0, 90); x.lineTo(W, 90); x.stroke();
    } else {                         // дно: угольные пласты с блёстками
      for (i = 0; i < 5; i++) { x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(0, 40 + i * 60 + rnd() * 20, W, 10 + rnd() * 10); }
      for (i = 0; i < 40; i++) { x.fillStyle = 'rgba(255,220,170,' + (0.1 + rnd() * 0.25) + ')'; x.fillRect(rnd() * W, rnd() * H, 1.5, 1.5); }
    }
    var solid = function (q, r) { return L.isSolid(L.tileAt(ST0, rm, q, r)); };
    var t, q, r;
    for (r = 0; r < ROWS; r++) for (q = 0; q < COLS; q++) {
      t = rm.t[r * COLS + q];
      var bx2 = q * T, by2 = r * T;
      if (t === L.R || t === L.SP || t === L.CL || t === L.CR) {
        if (t === L.SP) {
          x.fillStyle = z.dk; x.fillRect(bx2, by2, T, T);
          x.fillStyle = '#8b939e';
          for (k = 0; k < 4; k++) { x.beginPath(); x.moveTo(bx2 + k * 8, by2 + T); x.lineTo(bx2 + k * 8 + 4, by2 + 8); x.lineTo(bx2 + k * 8 + 8, by2 + T); x.fill(); }
          x.fillStyle = '#d7dde6'; for (k = 0; k < 4; k++) x.fillRect(bx2 + k * 8 + 3, by2 + 9, 2, 6);
          continue;
        }
        x.fillStyle = z.rock; x.fillRect(bx2, by2, T, T);
        var deep = solid(q, r - 1) && solid(q, r + 1) && solid(q - 1, r) && solid(q + 1, r);
        if (deep) { x.fillStyle = z.dk; x.globalAlpha = 0.55; x.fillRect(bx2, by2, T, T); x.globalAlpha = 1; }
        for (k = 0; k < 4; k++) { x.fillStyle = rnd() < 0.5 ? z.hi : z.dk; x.globalAlpha = 0.22 + rnd() * 0.25; x.fillRect(bx2 + 3 + rnd() * 24, by2 + 3 + rnd() * 24, 2 + rnd() * 4, 2 + rnd() * 3); }
        x.globalAlpha = 1;
        if (rm.zone === 5 && rnd() < 0.25) { x.fillStyle = 'rgba(255,230,190,.35)'; x.fillRect(bx2 + rnd() * 28, by2 + rnd() * 28, 2, 2); }
        if (!solid(q, r - 1) && r > 0 && t === L.R) { var tg = x.createLinearGradient(0, by2, 0, by2 + 9); tg.addColorStop(0, z.hi); tg.addColorStop(1, z.rock); x.fillStyle = tg; x.fillRect(bx2, by2, T, 9); x.fillStyle = 'rgba(255,255,255,.2)'; x.fillRect(bx2, by2, T, 1.5); }
        if (!solid(q, r + 1) && r < ROWS - 1) { x.fillStyle = z.dk; x.fillRect(bx2, by2 + T - 5, T, 5); }
        if (!solid(q - 1, r) && q > 0) { x.fillStyle = 'rgba(255,255,255,.07)'; x.fillRect(bx2, by2, 3, T); }
        if (!solid(q + 1, r) && q < COLS - 1) { x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(bx2 + T - 3, by2, 3, T); }
        if (t === L.CL || t === L.CR) {   // основание конвейера: лента и ролики
          x.fillStyle = '#202326'; x.fillRect(bx2, by2, T, 12);
          x.fillStyle = '#4a5058'; for (k = 0; k < 2; k++) { x.beginPath(); x.arc(bx2 + 8 + k * 16, by2 + 16, 4, 0, Math.PI * 2); x.fill(); }
          x.fillStyle = '#8a929c'; for (k = 0; k < 2; k++) { x.beginPath(); x.arc(bx2 + 8 + k * 16, by2 + 16, 1.5, 0, Math.PI * 2); x.fill(); }
        }
      } else if (t === L.LD) {
        if (rm.rope[q]) {
          x.strokeStyle = '#8a6a3e'; x.lineWidth = 4; x.beginPath(); x.moveTo(bx2 + 16, by2); x.lineTo(bx2 + 16, by2 + T); x.stroke();
          x.strokeStyle = '#c9a26a'; x.lineWidth = 1.2;
          for (k = 0; k < 4; k++) { x.beginPath(); x.moveTo(bx2 + 14, by2 + k * 8); x.lineTo(bx2 + 18, by2 + k * 8 + 5); x.stroke(); }
          if (r % 2 === 0) { x.fillStyle = '#6e522c'; x.beginPath(); x.ellipse(bx2 + 16, by2 + 20, 4, 3, 0, 0, Math.PI * 2); x.fill(); }
        } else {
          x.fillStyle = '#4c535c'; x.fillRect(bx2 + 6, by2, 4, T); x.fillRect(bx2 + 22, by2, 4, T);
          x.fillStyle = '#9aa3ad'; x.fillRect(bx2 + 6, by2, 1.5, T); x.fillRect(bx2 + 22, by2, 1.5, T);
          for (k = 0; k < 4; k++) { x.fillStyle = '#7b848f'; x.fillRect(bx2 + 8, by2 + 4 + k * 8, 16, 3); x.fillStyle = 'rgba(255,255,255,.25)'; x.fillRect(bx2 + 8, by2 + 4 + k * 8, 16, 1); }
        }
      } else if (t === L.PF) {
        var pg = x.createLinearGradient(0, by2, 0, by2 + 10);
        if (rm.zone === 4 || rm.zone === 2) { pg.addColorStop(0, '#8a929e'); pg.addColorStop(1, '#3e434b'); } else { pg.addColorStop(0, '#b0794a'); pg.addColorStop(1, '#5e3a1f'); }
        x.fillStyle = pg; x.fillRect(bx2, by2, T, 10);
        x.fillStyle = 'rgba(0,0,0,.3)'; x.fillRect(bx2 + T - 1, by2, 1, 10);
        x.fillStyle = 'rgba(255,230,180,.6)'; x.beginPath(); x.arc(bx2 + 6, by2 + 5, 1.4, 0, Math.PI * 2); x.arc(bx2 + 26, by2 + 5, 1.4, 0, Math.PI * 2); x.fill();
        if (rm.t[r * COLS + q - 1] !== L.PF || rm.t[r * COLS + q + 1] !== L.PF) { x.fillStyle = 'rgba(40,28,18,.9)'; var ex = rm.t[r * COLS + q - 1] !== L.PF ? bx2 + 4 : bx2 + T - 4; x.beginPath(); x.moveTo(ex - 3, by2 + 10); x.lineTo(ex + 3, by2 + 10); x.lineTo(ex, by2 + 22); x.fill(); }
      }
    }
    // рельсы вагонеток
    rm.hz.carts.forEach(function (cr) {
      var y0 = cr.y * T, x0 = cr.s * T - 6, x1 = (cr.e + 1) * T + 6;
      x.fillStyle = '#3a2a20'; for (var sx2 = x0; sx2 < x1; sx2 += 12) x.fillRect(sx2, y0 - 4, 7, 4);
      x.fillStyle = '#9aa3ad'; x.fillRect(x0, y0 - 6, x1 - x0, 2);
      x.fillStyle = '#5a6068'; x.fillRect(x0 - 4, y0 - 12, 5, 12); x.fillRect(x1 - 1, y0 - 12, 5, 12);
      x.fillStyle = '#d24a3a'; x.fillRect(x0 - 4, y0 - 12, 5, 3); x.fillRect(x1 - 1, y0 - 12, 5, 3);
    });
    // корпуса прессов под потолком
    rm.hz.presses.forEach(function (p) {
      var px2 = p.x * T, py2 = p.top * T - 6;
      x.fillStyle = '#2b2f36'; rr(x, px2 - 6, py2, 2 * T + 12, 22, 4); x.fill();
      x.fillStyle = '#5c6470'; x.fillRect(px2 - 6, py2 + 18, 2 * T + 12, 3);
      x.fillStyle = '#16181c'; for (k = 0; k < 5; k++) x.fillRect(px2 + 2 + k * 12, py2 + 5, 6, 8);
    });
    // декор поверхностей
    var glows = [];
    for (r = 1; r < ROWS - 1; r++) for (q = 1; q < COLS - 1; q++) {
      if (rm.t[r * COLS + q] !== L.R || solid(q, r - 1) || rm.t[(r - 1) * COLS + q] !== L.E) continue;
      var roll = rnd(), dx0 = q * T + 6 + rnd() * 18, top = r * T;
      if (roll < 0.12) { x.fillStyle = '#17151a'; x.beginPath(); x.ellipse(dx0, top - 2, 6, 3.5, 0, Math.PI, 0); x.fill(); x.fillStyle = 'rgba(255,190,120,.5)'; x.fillRect(dx0 - 2, top - 4, 1.5, 1.5); }
      else if (roll < 0.17 && rm.zone === 0) { x.fillStyle = '#7a5a3a'; x.fillRect(dx0 - 4, top - 10, 8, 10); x.fillStyle = '#a07a50'; x.fillRect(dx0 - 4, top - 10, 8, 2); }
      else if (roll < 0.2 && rm.zone >= 3) { x.fillStyle = 'rgba(255,120,50,.6)'; x.fillRect(dx0, top - 2, 3, 2); glows.push({ x: dx0, y: top - 2, r: 14, col: '#ff6a2a' }); }
    }
    c.glows = glows;
    cache[rm.i] = c;
    return c;
  }

  // ---------- Иконки ----------
  function coal(ctx, x, y, s, t, seed) {
    seed = seed || 0;
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = '#16151a';
    ctx.beginPath(); ctx.moveTo(-s, s * 0.35); ctx.lineTo(-s * 0.8, -s * 0.45); ctx.lineTo(-s * 0.15, -s * 0.85); ctx.lineTo(s * 0.7, -s * 0.6); ctx.lineTo(s, s * 0.1); ctx.lineTo(s * 0.55, s * 0.7); ctx.lineTo(-s * 0.5, s * 0.75); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#3c3a44'; ctx.beginPath(); ctx.moveTo(-s * 0.8, -s * 0.45); ctx.lineTo(-s * 0.15, -s * 0.85); ctx.lineTo(s * 0.05, -s * 0.2); ctx.lineTo(-s * 0.55, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#5a5866'; ctx.beginPath(); ctx.moveTo(-s * 0.15, -s * 0.85); ctx.lineTo(s * 0.7, -s * 0.6); ctx.lineTo(s * 0.05, -s * 0.2); ctx.closePath(); ctx.fill();
    var a = 0.5 + 0.5 * Math.sin(t * 4 + seed);
    ctx.fillStyle = 'rgba(255,' + Math.round(120 + 80 * a) + ',60,' + (0.55 + 0.4 * a) + ')';
    ctx.fillRect(s * 0.3, s * 0.1, s * 0.25, s * 0.18); ctx.fillRect(-s * 0.45, s * 0.3, s * 0.2, s * 0.14);
    ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fillRect(s * 0.1, -s * 0.62, s * 0.18, s * 0.12);
    ctx.restore();
  }
  function coalIcon(ctx, x, y, s, t) { coal(ctx, x, y, s, t, 1); }
  function keyShape(ctx, x, y, k, sc) {
    sc = sc || 1;
    ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
    ctx.fillStyle = KC[k]; ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(-6, 0, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.beginPath(); ctx.arc(-6, 0, 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = KC[k]; ctx.fillRect(-1.5, -1.6, 11, 3.2); ctx.fillRect(6, 1, 2.5, 4); ctx.fillRect(2.5, 1, 2.2, 3);
    ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fillRect(-1, -1.4, 9, 1);
    ctx.restore();
  }
  function keyIcon(ctx, x, y, k, on, sc) {
    if (on) keyShape(ctx, x, y, k, sc || 0.95);
    else { ctx.globalAlpha = 0.28; keyShape(ctx, x, y, k, sc || 0.95); ctx.globalAlpha = 1; }
  }
  function hardHat(ctx, x, y, s, lamp) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    var hg = ctx.createLinearGradient(0, -12, 0, 0); hg.addColorStop(0, '#ffe27a'); hg.addColorStop(1, '#d99a14');
    ctx.fillStyle = hg; ctx.beginPath(); ctx.ellipse(0, 0, 10, 10, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#b97f0c'; rr(ctx, -13, -1.5, 26, 4, 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(-2, -9, 3, 7);
    if (lamp) { ctx.fillStyle = '#fff6c8'; ctx.beginPath(); ctx.arc(7, -5, 2.6, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }
  function helmetIcon(ctx, x, y) { hardHat(ctx, x, y + 4, 0.6, true); }
  function lifeIcon(ctx, x, y, on) {
    ctx.globalAlpha = on ? 1 : 0.25;
    ctx.fillStyle = '#4d545e'; rr(ctx, x - 7, y - 7, 14, 13, 3); ctx.fill();
    ctx.fillStyle = on ? '#ffd27a' : '#777'; ctx.beginPath(); ctx.arc(x + 2.5, y - 1, 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = on ? '#ff7a2a' : '#555'; ctx.fillRect(x - 4, y + 3, 8, 2);
    ctx.fillStyle = '#2b2f36'; ctx.fillRect(x - 5, y - 11, 3, 4);
    ctx.globalAlpha = 1;
  }

  // ---------- Существа и механизмы ----------
  function glow(ctx, x, y, r, col, a) {
    var gr = ctx.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = a; ctx.fillStyle = gr; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.globalAlpha = 1;
  }
  function flyer(ctx, x, y, t, ph, dir) {          // сажник: клубок сажи с крылышками
    var f = Math.abs(Math.sin(t * 14 + ph));
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(120,110,105,.85)';
    [-1, 1].forEach(function (s) { ctx.beginPath(); ctx.ellipse(s * 10, -3 - f * 4, 7, 3 + f * 3, s * (0.6 - f * 0.5), 0, Math.PI * 2); ctx.fill(); });
    var puffs = [[0, 0, 8], [-5, 2, 5], [5, 2, 5], [-3, -5, 5], [4, -4, 5]];
    puffs.forEach(function (p, i) { ctx.fillStyle = i ? '#2a2628' : '#1b1819'; ctx.beginPath(); ctx.arc(p[0] + Math.sin(t * 6 + i) * 0.6, p[1], p[2], 0, Math.PI * 2); ctx.fill(); });
    ctx.fillStyle = '#ff5a2a'; ctx.beginPath(); ctx.arc(dir * 2 - 2.5, -2, 1.7, 0, Math.PI * 2); ctx.arc(dir * 2 + 2.5, -2, 1.7, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  function crawler(ctx, x, y, dir, t) {          // окалыш: жук в чешуе окалины
    ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1);
    var w = Math.sin(t * 16) * 2;
    ctx.strokeStyle = '#2a1a12'; ctx.lineWidth = 1.6;
    for (var k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(k * 7, -4); ctx.lineTo(k * 7 - 3 + (k % 2 ? w : -w), 0); ctx.stroke(); }
    var gr = ctx.createLinearGradient(0, -14, 0, -2); gr.addColorStop(0, '#b0674a'); gr.addColorStop(1, '#4a2618');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(-1, -6, 13, 7.5, 0, Math.PI, 0); ctx.lineTo(12, -3); ctx.lineTo(-14, -3); ctx.fill();
    ctx.strokeStyle = 'rgba(30,15,8,.8)'; ctx.lineWidth = 1.2;
    for (k = -1; k <= 1; k++) { ctx.beginPath(); ctx.arc(k * 6 - 1, -3, 7, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); }
    ctx.fillStyle = '#3a2016'; ctx.beginPath(); ctx.arc(12, -5, 3.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd54a'; ctx.beginPath(); ctx.arc(13.3, -6, 1.3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#3a2016'; ctx.beginPath(); ctx.moveTo(13, -8); ctx.lineTo(17, -12 + w * 0.5); ctx.stroke();
    ctx.restore();
  }
  function cart(ctx, x, y, dir, moving, t) {
    ctx.save(); ctx.translate(x, y);
    var bob = moving ? Math.sin(t * 25) * 0.6 : 0;
    ctx.fillStyle = '#17161a';
    ctx.beginPath(); ctx.ellipse(-4, -27 + bob, 13, 6, 0, Math.PI, 0); ctx.ellipse(8, -26 + bob, 10, 5, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = 'rgba(255,170,90,.5)'; ctx.fillRect(-6, -31 + bob, 2, 2); ctx.fillRect(7, -29 + bob, 2, 2);
    var gr = ctx.createLinearGradient(0, -28, 0, -8); gr.addColorStop(0, '#b24a32'); gr.addColorStop(1, '#5a1f14');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(-21, -27 + bob); ctx.lineTo(21, -27 + bob); ctx.lineTo(17, -8 + bob); ctx.lineTo(-17, -8 + bob); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#3a140c'; ctx.fillRect(-21, -28 + bob, 42, 3); ctx.fillRect(-18, -16 + bob, 36, 2);
    ctx.fillStyle = '#e0a070'; [-15, -5, 5, 15].forEach(function (rx) { ctx.beginPath(); ctx.arc(rx, -22 + bob, 1.2, 0, Math.PI * 2); ctx.fill(); });
    [-11, 11].forEach(function (wx) {
      ctx.fillStyle = '#25272c'; ctx.beginPath(); ctx.arc(wx, -6, 5.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#8a929c'; ctx.lineWidth = 1.5; var a = moving ? t * 12 * dir : 0;
      ctx.beginPath(); ctx.moveTo(wx + Math.cos(a) * 4, -6 + Math.sin(a) * 4); ctx.lineTo(wx - Math.cos(a) * 4, -6 - Math.sin(a) * 4); ctx.stroke();
    });
    if (moving) { ctx.fillStyle = 'rgba(255,200,120,.7)'; ctx.fillRect(-dir * 18 - 1, -4, 2, 2); }
    ctx.restore();
  }
  function press(ctx, p, t) {
    var s = L.pressAt(p, t), px = X(p.x), top = Y(p.top) + 16, bot = Y(s.bottom);
    var sh = s.st === 'warn' ? (Math.floor(t * 40) % 2 ? 1.5 : -1.5) : 0;
    var headH = 24, ht = bot - headH;
    ctx.fillStyle = '#6c7480'; ctx.fillRect(px + T - 7 + sh, top, 14, Math.max(0, ht - top));
    ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(px + T - 5 + sh, top, 3, Math.max(0, ht - top));
    ctx.fillStyle = '#2d3138'; rr(ctx, px + 1 + sh, ht, 2 * T - 2, headH, 3); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.rect(px + 3 + sh, ht + 3, 2 * T - 6, 10); ctx.clip();
    for (var k = -2; k < 10; k++) { ctx.fillStyle = k % 2 ? '#16181c' : '#f2c230'; ctx.beginPath(); ctx.moveTo(px + sh + k * 9, ht + 13); ctx.lineTo(px + sh + k * 9 + 9, ht + 3); ctx.lineTo(px + sh + k * 9 + 18, ht + 3); ctx.lineTo(px + sh + k * 9 + 9, ht + 13); ctx.fill(); }
    ctx.restore();
    ctx.fillStyle = '#4a515c'; ctx.fillRect(px + 1 + sh, bot - 6, 2 * T - 2, 6);
    var lamp = s.st === 'warn' || s.st === 'slam' || s.st === 'down';
    ctx.fillStyle = lamp ? (Math.floor(t * 10) % 2 ? '#ff3b2f' : '#ffb02e') : '#5a2420';
    ctx.beginPath(); ctx.arc(px + T, Y(p.top) + 4, 3, 0, Math.PI * 2); ctx.fill();
    if (s.st === 'down' && s.k < 0.4) { ctx.fillStyle = 'rgba(200,190,180,' + (0.5 - s.k) + ')'; for (k = 0; k < 6; k++) { ctx.beginPath(); ctx.arc(px + (k < 3 ? -4 - k * 5 : 2 * T + 4 + (k - 3) * 5), bot - 4 - k % 3 * 3, 3 + s.k * 8, 0, Math.PI * 2); ctx.fill(); } }
    return lamp;
  }
  function drip(ctx, d, t) {
    var s = L.dripAt(d, t), x = X(d.x) + T / 2;
    if (s.st === 'form') { var r = 1.5 + s.k * 3; ctx.fillStyle = 'rgba(140,200,240,.85)'; ctx.beginPath(); ctx.arc(x, Y(d.y0) + 2 + r, r, 0, Math.PI * 2); ctx.fill(); }
    else if (s.st === 'fall') {
      var y = Y(s.y);
      ctx.fillStyle = 'rgba(150,210,250,.95)'; ctx.beginPath(); ctx.moveTo(x, y - 13); ctx.quadraticCurveTo(x + 5, y - 3, x, y); ctx.quadraticCurveTo(x - 5, y - 3, x, y - 13); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fillRect(x - 1.5, y - 7, 1.5, 3);
    } else {
      var k = s.k, yy = Y(d.y1);
      ctx.strokeStyle = 'rgba(150,210,250,' + (1 - k) + ')'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(x, yy - 1, 3 + k * 10, 1.5 + k * 2, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(150,210,250,' + (1 - k) + ')'; ctx.fillRect(x - 6 - k * 6, yy - 4 - k * 6, 2, 2); ctx.fillRect(x + 5 + k * 6, yy - 4 - k * 6, 2, 2);
    }
  }
  function door(ctx, q, r, k, top, bottom) {
    var x = X(q), y = Y(r);
    ctx.fillStyle = '#2a2d33'; ctx.fillRect(x, y, T, T);
    ctx.fillStyle = '#4a4f58'; ctx.fillRect(x + 3, y, T - 6, T);
    ctx.fillStyle = KC[k]; ctx.fillRect(x + 3, y + (top ? 4 : 0), T - 6, 4);
    if (bottom) ctx.fillRect(x + 3, y + T - 8, T - 6, 4);
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(x + 15, y, 2, T);
    if (!top && !bottom) {
      ctx.fillStyle = KC[k]; rr(ctx, x + 8, y + 7, 16, 18, 4); ctx.fill();
      ctx.fillStyle = '#16181c'; ctx.beginPath(); ctx.arc(x + 16, y + 14, 3, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(x + 15, y + 15, 2, 6);
    }
  }
  function beacon(ctx, x, y, cur, t) {
    ctx.fillStyle = '#2f333b'; rr(ctx, x - 9, y - 5, 18, 5, 2); ctx.fill();
    ctx.fillStyle = '#4b505b'; ctx.fillRect(x - 2.5, y - 34, 5, 30);
    ctx.fillStyle = '#6b7380'; rr(ctx, x - 9, y - 54, 18, 22, 4); ctx.fill();
    var on = cur ? 0.85 + Math.sin(t * 5) * 0.15 : 0.3;
    ctx.fillStyle = cur ? 'rgba(255,214,120,' + on + ')' : '#3a3026'; rr(ctx, x - 6, y - 51, 12, 16, 3); ctx.fill();
    ctx.strokeStyle = '#2b2f36'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, y - 51); ctx.lineTo(x, y - 35); ctx.moveTo(x - 6, y - 43); ctx.lineTo(x + 6, y - 43); ctx.stroke();
    ctx.fillStyle = '#6b7380'; ctx.beginPath(); ctx.moveTo(x - 10, y - 54); ctx.lineTo(x, y - 61); ctx.lineTo(x + 10, y - 54); ctx.fill();
  }
  function gear(ctx, x, y, t) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(t * 1.5);
    ctx.fillStyle = '#d6a744';
    for (var k = 0; k < 8; k++) { ctx.save(); ctx.rotate(k * Math.PI / 4); ctx.fillRect(-2, -10, 4, 5); ctx.restore(); }
    ctx.beginPath(); ctx.arc(0, 0, 7.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8a6420'; ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(-5, -5, 3, 2);
    ctx.restore();
  }
  // Горн: кирпичная печь в нише стартового экрана; fire 0..1 — жар
  function forge(ctx, x, y, fire, t, won) {
    ctx.fillStyle = '#5a2c1e'; rr(ctx, x - 26, y - 66, 52, 66, 6); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    for (var r = 0; r < 6; r++) for (var c = 0; c < 4; c++) ctx.fillRect(x - 26 + c * 13 + (r % 2) * 6, y - 66 + r * 11, 12, 1.5);
    ctx.fillStyle = '#2b2f36'; ctx.fillRect(x - 8, y - 82, 16, 18);
    ctx.fillStyle = '#16181c'; ctx.beginPath(); ctx.moveTo(x - 16, y - 6); ctx.lineTo(x - 16, y - 28); ctx.arc(x, y - 28, 16, Math.PI, 0); ctx.lineTo(x + 16, y - 6); ctx.fill();
    var f = won ? 1 : fire, a = 0.35 + 0.65 * f;
    var gr = ctx.createRadialGradient(x, y - 14, 2, x, y - 18, 20);
    gr.addColorStop(0, 'rgba(255,240,170,' + a + ')'); gr.addColorStop(0.5, 'rgba(255,120,40,' + a + ')'); gr.addColorStop(1, 'rgba(120,20,10,' + (a * 0.5) + ')');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(x - 13, y - 6); ctx.lineTo(x - 13, y - 27); ctx.arc(x, y - 27, 13, Math.PI, 0); ctx.lineTo(x + 13, y - 6); ctx.fill();
    if (f > 0.05) for (var k = 0; k < 5; k++) { var fl = Math.sin(t * 9 + k * 1.7) * 3, hh = (8 + k % 3 * 5) * f; ctx.fillStyle = 'rgba(255,' + (180 + k * 12) + ',80,' + (0.5 + 0.4 * f) + ')'; ctx.beginPath(); ctx.moveTo(x - 11 + k * 5.5, y - 7); ctx.quadraticCurveTo(x - 11 + k * 5.5 + fl, y - 7 - hh, x - 8 + k * 5.5, y - 7 - hh * 1.4); ctx.quadraticCurveTo(x - 6 + k * 5.5, y - 7 - hh * 0.6, x - 6 + k * 5.5, y - 7); ctx.fill(); }
    ctx.fillStyle = '#3a3f47'; for (k = 0; k < 4; k++) ctx.fillRect(x - 14 + k * 8, y - 9, 4, 3);
  }
  function gate(ctx, q, r, n, frac, t) {    // заслонка Горна: n — номер клетки снизу вверх (0..2)
    var x = X(q), y = Y(r);
    ctx.fillStyle = '#25282e'; ctx.fillRect(x, y, T, T);
    ctx.fillStyle = '#545b66'; ctx.fillRect(x + 2, y + 1, T - 4, T - 2);
    ctx.fillStyle = '#2e3239'; ctx.fillRect(x + 2, y + T - 4, T - 4, 3);
    var lit = frac * 3 - n;
    ctx.fillStyle = '#1a1c20'; rr(ctx, x + 10, y + 6, 12, 20, 3); ctx.fill();
    if (lit > 0) { var h = Math.min(1, lit) * 18; ctx.fillStyle = 'rgba(255,140,60,' + (0.7 + 0.3 * Math.sin(t * 4)) + ')'; ctx.fillRect(x + 11, y + 25 - h, 10, h); }
  }
  // Уголёк: робот-кочегар — чугунный корпус, топка-окошко в животе (жар растёт с собранным углем),
  // голова с глазами-фонарями, трубочка на макушке, ножки-тумбы и совок в руке
  function hero(ctx, x, y, H, t, o) {
    o = o || {};
    var climb = H.climb, f = climb ? 1 : H.face, sw = H.walkT ? Math.sin(H.walkT * 15) : 0, air = !H.ground && !climb;
    var fire = o.fire == null ? 0.5 : o.fire;
    ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.scale(f, 1);
    var bob = H.walkT ? Math.abs(sw) * 1.2 : 0, cl = climb ? Math.sin(H.y * 7) : 0;
    // ножки
    var leg = function (dx, dy) { ctx.fillStyle = '#3a3f47'; rr(ctx, dx - 3, -10 + dy, 6, 9, 2); ctx.fill(); ctx.fillStyle = '#1e2126'; rr(ctx, dx - 4, -3 + dy, 9, 3.5, 1.5); ctx.fill(); };
    if (climb) { leg(-4, cl * 2.5); leg(4, -cl * 2.5); }
    else if (air) { leg(-4, -3); leg(5, -1); }
    else { leg(-4 + sw * 3, 0); leg(4 - sw * 3, 0); }
    ctx.translate(0, -bob);
    // корпус
    var bgc = ctx.createLinearGradient(-10, -30, 10, -9); bgc.addColorStop(0, '#6a727e'); bgc.addColorStop(1, '#2a2e35');
    ctx.fillStyle = bgc; rr(ctx, -10, -30, 20, 21, 5); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(-8, -28, 2, 14);
    ctx.fillStyle = '#9aa3ad'; [[-8, -11], [8, -11], [-8, -27], [8, -27]].forEach(function (p) { ctx.beginPath(); ctx.arc(p[0], p[1], 0.9, 0, Math.PI * 2); ctx.fill(); });
    // топка
    var a = 0.45 + 0.55 * fire + Math.sin(t * 7) * 0.06;
    var fg = ctx.createRadialGradient(0, -17, 1, 0, -18, 8);
    fg.addColorStop(0, 'rgba(255,240,170,' + a + ')'); fg.addColorStop(0.6, 'rgba(255,110,30,' + a + ')'); fg.addColorStop(1, 'rgba(120,20,10,' + a + ')');
    ctx.fillStyle = '#121316'; rr(ctx, -6.5, -25, 13, 11, 3); ctx.fill();
    ctx.fillStyle = fg; rr(ctx, -5.5, -24, 11, 9, 2.5); ctx.fill();
    ctx.fillStyle = '#2a2e35'; for (var k = 0; k < 3; k++) ctx.fillRect(-4.5 + k * 3.6, -24, 1.4, 9);
    // рука с совком
    ctx.save(); ctx.translate(8, -22);
    if (climb) ctx.rotate(-2.4 + cl * 0.3); else ctx.rotate(air ? -1.2 : 0.25 + sw * 0.4);
    ctx.fillStyle = '#4d545e'; rr(ctx, -2, -1, 4, 10, 2); ctx.fill();
    ctx.fillStyle = '#8a929c'; ctx.beginPath(); ctx.moveTo(-4, 9); ctx.lineTo(5, 9); ctx.lineTo(3, 14); ctx.lineTo(-3, 14); ctx.closePath(); ctx.fill();
    ctx.restore();
    if (climb) { ctx.fillStyle = '#4d545e'; rr(ctx, -10, -40 - cl * 3, 4, 12, 2); ctx.fill(); }
    // голова
    var hg = ctx.createLinearGradient(-8, -43, 8, -30); hg.addColorStop(0, '#7a838f'); hg.addColorStop(1, '#353a42');
    ctx.fillStyle = hg; rr(ctx, -8, -43, 16, 13, 4); ctx.fill();
    ctx.fillStyle = '#1b1e23'; rr(ctx, -5, -40, 12, 6, 3); ctx.fill();
    var ey = climb ? '#ffb86a' : '#ffe9a8';
    ctx.fillStyle = ey; ctx.beginPath(); ctx.arc(4, -37, 2.3, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.arc(-1.5, -37, 1.7, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    // трубочка
    ctx.fillStyle = '#2b2f36'; ctx.fillRect(-6, -49, 4, 7); ctx.fillStyle = '#4b525c'; ctx.fillRect(-7, -50, 6, 2);
    if (o.helmet) hardHat(ctx, 0, -42, 0.72, true);
    ctx.restore();
  }

  // ---------- Кадр ----------
  var smoke = [];
  function draw(ctx, S, g, o) {
    o = o || {};
    var W = L.world(), rm = W.rooms[S.room], z = ZC[rm.zone], t = S.time, i, q, r, k;
    curZone = rm.zone;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, g.W, g.H);
    var layer = staticLayer(rm);
    ctx.drawImage(layer, 0, OY);
    ctx.save(); ctx.beginPath(); ctx.rect(0, OY, g.W, g.H - OY); ctx.clip();
    for (i = 0; i < 12; i++) {   // пылинки
      var px = ((i * 97 + rm.i * 31) % 640 + Math.sin(t * 0.3 + i) * 20 + 640) % 640, py = OY + ((i * 53 + rm.i * 17) % 384 + (t * (5 + i % 4)) % 384) % 384;
      ctx.fillStyle = z.speck + (0.2 + 0.2 * Math.sin(t * 2 + i)) + ')'; ctx.fillRect(px, py, 2, 2);
    }
    // живые клетки: конвейеры, двери, заслонка
    var frac = S.total ? S.coal / S.total : 0;
    for (r = 0; r < ROWS; r++) for (q = 0; q < COLS; q++) {
      var kt = L.tileAt(S, rm, q, r), bx = X(q), by = Y(r);
      if (kt === L.CL || kt === L.CR) {
        var dir = kt === L.CR ? 1 : -1, off = ((t * L.BELT * T * dir) % 12 + 12) % 12;
        ctx.save(); ctx.beginPath(); ctx.rect(bx, by + 1, T, 9); ctx.clip();
        ctx.fillStyle = '#e2a530';
        for (k = -1; k < 4; k++) { var cx = bx + k * 12 + off; ctx.beginPath(); ctx.moveTo(cx, by + 2); ctx.lineTo(cx + 4 * dir, by + 5.5); ctx.lineTo(cx, by + 9); ctx.lineTo(cx + 2.5 * dir, by + 9); ctx.lineTo(cx + 6.5 * dir, by + 5.5); ctx.lineTo(cx + 2.5 * dir, by + 2); ctx.fill(); }
        ctx.restore();
      } else if (kt === L.DR) {
        var gk = rm.g[r * COLS + q];
        door(ctx, q, r, gk, rm.t[(r - 1) * COLS + q] !== L.DR, rm.t[(r + 1) * COLS + q] !== L.DR);
      } else if (kt === L.GT) {
        var n0 = 0; for (k = r + 1; k < ROWS && rm.t[k * COLS + q] === L.GT; k++) n0++;
        gate(ctx, q, r, n0, frac, t);
      }
    }
    // предметы
    rm.items.forEach(function (it, n) {
      var ix = X(it.c) + T / 2, iy = Y(it.r);
      if (it.k === 'beacon') beacon(ctx, ix, iy, S.cp.id === it.id, t);
      else if (it.k === 'forge') forge(ctx, X(it.c) + T, iy, S.gate ? 0.6 + 0.4 * Math.sin(t * 3) * 0.5 : frac * 0.5, t, S.won);
      else if (S.got[it.id]) return;
      else if (it.k === 'coal') coal(ctx, ix, iy - 9 + Math.sin(t * 2.4 + n) * 1.5, 9, t, n);
      else if (it.k === 'key') keyShape(ctx, ix, iy - 14 + Math.sin(t * 3) * 2, it.key, 1.3);
      else if (it.k === 'gear') gear(ctx, ix, iy - 14, t);
      else if (it.k === 'helmet') hardHat(ctx, ix, iy - 4 + Math.sin(t * 3) * 1.5, 0.9, false);
    });
    // механизмы
    var lamps = [];
    rm.hz.drips.forEach(function (d) { drip(ctx, d, t); });
    rm.hz.carts.forEach(function (cr) { var s = L.cartAt(cr, t); cart(ctx, X(s.x), Y(cr.y), s.dir, s.moving, t); });
    rm.hz.enemies.forEach(function (e) { var p = L.enemyAt(e, t); if (e.type === 'flyer') flyer(ctx, X(p.x), Y(p.y), t, e.ph, p.dir); else crawler(ctx, X(p.x), Y(p.y), p.dir, t); });
    // герой
    var H = S.hero, fire = 0.25 + 0.75 * frac;
    if (S.phase !== 'dead' && !(H.inv > 0 && Math.floor(t * 14) % 2 && S.phase === 'play' && !o.bare)) {
      hero(ctx, X(H.x), Y(H.y), H, t, { fire: fire, helmet: S.helmet > 0 && (S.helmet > 2.5 || Math.floor(t * 8) % 2) });
    }
    // дымок из трубочки
    if (!o.bare && S.phase === 'play') {
      if (!smoke.length || t - smoke[smoke.length - 1].t0 > 0.25 || t < smoke[smoke.length - 1].t0) smoke.push({ x: X(H.x) - 4 * (H.climb ? 1 : H.face), y: Y(H.y) - 50, t0: t });
      smoke = smoke.filter(function (s) { return t - s.t0 < 1.4 && t >= s.t0; });
      smoke.forEach(function (s) { var u = (t - s.t0) / 1.4; ctx.fillStyle = 'rgba(150,140,135,' + (0.35 * (1 - u)) + ')'; ctx.beginPath(); ctx.arc(s.x + Math.sin(u * 6) * 3, s.y - u * 26, 2 + u * 5, 0, Math.PI * 2); ctx.fill(); });
    }
    rm.hz.presses.forEach(function (p) { if (press(ctx, p, t)) lamps.push(p); });
    // свет: темнота вокруг, ярче у глаз Уголька
    var hx = X(H.x) + (H.climb ? 0 : H.face * 6), hy = Y(H.y) - 30, dk = o.bare ? z.dark * 0.6 : z.dark;
    var lg = ctx.createRadialGradient(hx, hy, 50, hx, hy, 360);
    lg.addColorStop(0, 'rgba(0,0,0,0)'); lg.addColorStop(0.55, 'rgba(0,0,0,' + (dk * 0.55) + ')'); lg.addColorStop(1, 'rgba(0,0,0,' + dk + ')');
    ctx.fillStyle = lg; ctx.fillRect(0, OY, g.W, g.H - OY);
    ctx.globalCompositeOperation = 'lighter';
    rm.items.forEach(function (it) {
      var ix = X(it.c) + T / 2, iy = Y(it.r);
      if (it.k === 'coal' && !S.got[it.id]) glow(ctx, ix, iy - 9, 20, '#ff7a2a', 0.18 + 0.08 * Math.sin(t * 3 + it.c));
      if (it.k === 'key' && !S.got[it.id]) glow(ctx, ix, iy - 14, 30, KC[it.key], 0.35);
      if (it.k === 'helmet' && !S.got[it.id]) glow(ctx, ix, iy - 8, 26, '#ffd23d', 0.3);
      if (it.k === 'beacon') glow(ctx, ix, iy - 43, S.cp.id === it.id ? 70 : 24, '#ffc86a', S.cp.id === it.id ? 0.4 : 0.12);
      if (it.k === 'forge') glow(ctx, X(it.c) + T, iy - 20, S.gate ? 110 : 50, '#ff8a3a', S.gate ? 0.5 : 0.15 + frac * 0.2);
    });
    (layer.glows || []).forEach(function (gl, n) { glow(ctx, gl.x, OY + gl.y, gl.r, gl.col, 0.2 + 0.08 * Math.sin(t * 2 + n)); });
    lamps.forEach(function (p) { glow(ctx, X(p.x) + T, Y(p.top) + 4, 40, '#ff4a2a', 0.45); });
    rm.hz.enemies.forEach(function (e) { if (e.type === 'flyer') { var p = L.enemyAt(e, t); glow(ctx, X(p.x), Y(p.y) - 2, 18, '#ff5a2a', 0.3); } });
    if (S.phase !== 'dead') {
      glow(ctx, X(H.x) + (H.climb ? 0 : H.face * 2), Y(H.y) - 19, 34, '#ff8a3a', 0.18 + 0.3 * fire);
      glow(ctx, hx + (H.climb ? 0 : H.face * 14), hy - 6, 70, '#fff1c4', 0.12);
      if (S.helmet > 0) glow(ctx, X(H.x), Y(H.y) - 26, 46, '#ffd23d', 0.18);
    }
    ctx.globalCompositeOperation = 'source-over';
    if (o.toasts) U.ui.toasts(g, ctx, o.toasts, P);
    if (o.fade > 0) { ctx.fillStyle = 'rgba(0,0,0,' + o.fade + ')'; ctx.fillRect(0, OY, g.W, g.H - OY); }
    ctx.restore();
    if (!o.bare) { U.ui.hud(g, ctx, S, P, api); U.ui.banner(g, ctx, S, P, o); }
  }

  var api = { P: P, KC: KC, bg: bg, draw: draw, hero: hero, lifeIcon: lifeIcon, coalIcon: coalIcon, keyIcon: keyIcon, helmetIcon: helmetIcon, staticLayer: staticLayer, forge: forge, coal: coal };
  U.modern = api;
})(typeof window !== 'undefined' ? window : globalThis);
