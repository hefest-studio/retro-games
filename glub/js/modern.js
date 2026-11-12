/* ГЛУБЬ · рендер MODERN (по умолчанию). GLUB.modern = { P, bg, draw, hero, mole, lifeIcon, crystalIcon }
   Подземелье в полумраке: свет налобного фонаря водолаза, порода своего цвета на каждой глубине
   с подсвеченной кромкой, мягкая порода — рыхлая глина, латунные лестницы, светящиеся кристаллы.
   Логику не трогает — только читает состояние. Статичный слой экрана кэшируется. */
(function (global) {
  'use strict';
  var Gb = global.GLUB = global.GLUB || {};
  var L = Gb.logic, T = 32, OY = 36, COLS = L.COLS, ROWS = L.ROWS;

  var P = {
    pixel: false, font: null,
    hudBg: '#0d0b11', hudLine: '#2a2431', ink: '#f3ede4', muted: '#a69cae', accent: '#ffb347', good: '#5ee08f', bad: '#ff5d6c', warn: '#ffd166',
    bar: '#2c2633', panel: '#17131c', panelA: 'rgba(22,18,28,.95)', line: '#3d3447', soft: '#d79a5a', mapLine: '#8a7f96', mapDim: '#4d4556',
    beaconMap: '#6fb7c9', heart: '#ffcf6a', dim: '#4a4256',
    zoneMap: ['#6b5240', '#454c78', '#336a62', '#7a3626', '#8a4a5e']
  };
  var CC = { 1: '#ff7a3d', 2: '#4fa8ff', 3: '#5ee08f', 4: '#ffcf4d', 5: '#c38bff', 6: '#eef3ff', 7: '#ff4d6a', 8: '#8b7dff' };
  var ZC = [
    { bg: ['#1d1611', '#090705'], far: 'rgba(120,90,60,.07)', rock: '#5b4434', hi: '#9a7550', dk: '#2c2018', glow: '#ffb070', speck: 'rgba(255,190,120,', dark: 0.5 },
    { bg: ['#12162c', '#06070f'], far: 'rgba(110,130,220,.07)', rock: '#3b4166', hi: '#7480b8', dk: '#1b1e36', glow: '#8fb8ff', speck: 'rgba(150,190,255,', dark: 0.58 },
    { bg: ['#0c1e1d', '#040b0b'], far: 'rgba(90,200,170,.06)', rock: '#2e5650', hi: '#62a898', dk: '#142c28', glow: '#7dffc0', speck: 'rgba(130,255,200,', dark: 0.62 },
    { bg: ['#26110b', '#0d0403'], far: 'rgba(255,110,60,.07)', rock: '#5c2b20', hi: '#b0563c', dk: '#2a110c', glow: '#ff8a4a', speck: 'rgba(255,140,80,', dark: 0.55 },
    { bg: ['#2b0f1a', '#0c0307'], far: 'rgba(255,160,120,.09)', rock: '#4c2a3b', hi: '#b8707f', dk: '#22101a', glow: '#ffcf6a', speck: 'rgba(255,210,140,', dark: 0.4 }
  ];
  var rr = function (ctx, x, y, w, h, r) { Gb.ui.roundRect(ctx, x, y, w, h, r); };
  function X(x) { return x * T; }
  function Y(y) { return OY + y * T; }
  var curZone = 0;

  function bg(ctx, g) {
    var z = ZC[curZone], gr = ctx.createLinearGradient(0, 0, 0, g.H);
    gr.addColorStop(0, z.bg[0]); gr.addColorStop(1, z.bg[1]);
    ctx.fillStyle = gr; ctx.fillRect(0, 0, g.W, g.H);
  }

  // ---------- Статичный слой экрана ----------
  var cache = {}, cacheN = 0;
  function stateKey(S, rm) {
    var k = rm.i + ':';
    for (var i = 0; i < rm.near.length; i++) k += S.dug[rm.near[i]] ? '1' : '0';
    return k + (S.gate ? 'G' : 'g');
  }
  function staticLayer(S, rm) {
    var key = stateKey(S, rm);
    if (cache[key]) return cache[key];
    if (++cacheN > 40) { cache = {}; cacheN = 1; }
    var c = document.createElement('canvas'); c.width = COLS * T; c.height = ROWS * T;
    var x = c.getContext('2d'), z = ZC[rm.zone], W = c.width, H = c.height;
    var seed = rm.i * 7919 + 17, rnd = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    var gr = x.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, z.bg[0]); gr.addColorStop(1, z.bg[1]);
    x.fillStyle = gr; x.fillRect(0, 0, W, H);
    // дальний план: глыбы и жилы
    x.fillStyle = z.far;
    for (var i = 0; i < 7; i++) { x.beginPath(); x.ellipse(rnd() * W, rnd() * H, 40 + rnd() * 90, 30 + rnd() * 60, rnd() * 3, 0, Math.PI * 2); x.fill(); }
    x.strokeStyle = z.far; x.lineWidth = 3;
    for (i = 0; i < 4; i++) { x.beginPath(); var vx = rnd() * W, vy = rnd() * H; x.moveTo(vx, vy); for (var k = 0; k < 5; k++) { vx += (rnd() - 0.5) * 80; vy += 20 + rnd() * 40; x.lineTo(vx, vy); } x.stroke(); }
    if (rm.zone === 0) { // крепь штолен: стойки и перекладины
      x.fillStyle = 'rgba(140,95,55,.16)';
      for (i = 0; i < 3; i++) { var sx = 80 + i * 220 + rnd() * 40; x.fillRect(sx, 0, 10, H); x.fillRect(sx + 120, 0, 10, H); x.fillRect(sx - 8, 40 + rnd() * 40, 146, 9); }
    }
    var st = S, t, q, r;
    var solid = function (cx, cy) { return L.isSolid(L.tileAt(st, rm, cx, cy)); };
    for (r = 0; r < ROWS; r++) for (q = 0; q < COLS; q++) {
      t = L.tileAt(st, rm, q, r);
      var bx = q * T, by = r * T;
      if (t === L.R || t === L.VT || t === L.SL) {
        x.fillStyle = z.rock; x.fillRect(bx, by, T, T);
        var deep = solid(q, r - 1) && solid(q, r + 1) && solid(q - 1, r) && solid(q + 1, r);
        if (deep) { x.fillStyle = z.dk; x.globalAlpha = 0.55; x.fillRect(bx, by, T, T); x.globalAlpha = 1; }
        // крапины
        for (k = 0; k < 4; k++) { x.fillStyle = rnd() < 0.5 ? z.hi : z.dk; x.globalAlpha = 0.25 + rnd() * 0.25; x.fillRect(bx + 3 + rnd() * 24, by + 3 + rnd() * 24, 2 + rnd() * 4, 2 + rnd() * 3); }
        x.globalAlpha = 1;
        if (!solid(q, r - 1) && r > 0) { var tg = x.createLinearGradient(0, by, 0, by + 9); tg.addColorStop(0, z.hi); tg.addColorStop(1, z.rock); x.fillStyle = tg; x.fillRect(bx, by, T, 9); x.fillStyle = 'rgba(255,255,255,.22)'; x.fillRect(bx, by, T, 1.5); }
        if (!solid(q, r + 1) && r < ROWS - 1) { x.fillStyle = z.dk; x.fillRect(bx, by + T - 5, T, 5); if (rnd() < 0.4) { x.beginPath(); x.moveTo(bx + 8 + rnd() * 14, by + T); x.lineTo(bx + 12 + rnd() * 10, by + T + 6 + rnd() * 6); x.lineTo(bx + 18 + rnd() * 10, by + T); x.fill(); } }
        if (!solid(q - 1, r) && q > 0) { x.fillStyle = 'rgba(255,255,255,.08)'; x.fillRect(bx, by, 3, T); }
        if (!solid(q + 1, r) && q < COLS - 1) { x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(bx + T - 3, by, 3, T); }
        if (rm.zone === 1 && rnd() < 0.06) { x.fillStyle = 'rgba(160,200,255,.55)'; x.beginPath(); x.moveTo(bx + 16, by + 8); x.lineTo(bx + 21, by + 16); x.lineTo(bx + 16, by + 24); x.lineTo(bx + 11, by + 16); x.fill(); }
        if (t === L.VT) {
          x.fillStyle = '#3f434c'; rr(x, bx + 2, by, T - 4, 12, 3); x.fill();
          x.fillStyle = '#8a909c'; x.fillRect(bx + 2, by, T - 4, 2);
          x.fillStyle = '#16181c'; for (k = 0; k < 4; k++) x.fillRect(bx + 6 + k * 6, by + 4, 3, 6);
        }
      } else if (t === L.SO) {
        // мягкая порода: рыхлая глина с трещинами и пунктирной кромкой
        x.fillStyle = '#6f4a2b'; x.fillRect(bx, by, T, T);
        for (k = 0; k < 9; k++) { x.fillStyle = rnd() < 0.5 ? '#9b6c41' : '#4f331d'; x.beginPath(); x.arc(bx + 4 + rnd() * 24, by + 4 + rnd() * 24, 1.5 + rnd() * 2.5, 0, Math.PI * 2); x.fill(); }
        x.strokeStyle = 'rgba(30,18,8,.6)'; x.lineWidth = 1.2; x.beginPath();
        x.moveTo(bx + 4, by + 6 + rnd() * 6); x.lineTo(bx + 14, by + 14); x.lineTo(bx + 11, by + 26); x.moveTo(bx + 14, by + 14); x.lineTo(bx + 27, by + 18); x.stroke();
        x.strokeStyle = 'rgba(230,170,100,.55)'; x.setLineDash([4, 3]); x.strokeRect(bx + 1.5, by + 1.5, T - 3, T - 3); x.setLineDash([]);
      } else if (t === L.LD) {
        x.fillStyle = '#6d5326'; x.fillRect(bx + 6, by, 4, T); x.fillRect(bx + 22, by, 4, T);
        x.fillStyle = '#d6ad55'; x.fillRect(bx + 6, by, 2, T); x.fillRect(bx + 22, by, 2, T);
        for (k = 0; k < 4; k++) { x.fillStyle = '#b58a3c'; x.fillRect(bx + 8, by + 4 + k * 8, 16, 3); x.fillStyle = 'rgba(255,240,190,.35)'; x.fillRect(bx + 8, by + 4 + k * 8, 16, 1); }
      } else if (t === L.PF) {
        var pg = x.createLinearGradient(0, by, 0, by + 10); pg.addColorStop(0, '#b98250'); pg.addColorStop(1, '#6a4223');
        x.fillStyle = pg; x.fillRect(bx, by, T, 10);
        x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(bx + T - 1, by, 1, 10);
        x.fillStyle = '#e3bb62'; x.beginPath(); x.arc(bx + 6, by + 5, 1.6, 0, Math.PI * 2); x.arc(bx + 26, by + 5, 1.6, 0, Math.PI * 2); x.fill();
        if (L.tileAt(st, rm, q - 1, r) !== L.PF || L.tileAt(st, rm, q + 1, r) !== L.PF) { x.fillStyle = '#4a2f18'; x.beginPath(); var ex = L.tileAt(st, rm, q - 1, r) !== L.PF ? bx + 4 : bx + T - 4; x.moveTo(ex - 3, by + 10); x.lineTo(ex + 3, by + 10); x.lineTo(ex, by + 20); x.fill(); }
      }
    }
    // декор поверхностей: жилы, грибы, угли, наплывы (+ список подсветок для прохода «свечения»)
    var glows = [];
    for (r = 1; r < ROWS - 1; r++) for (q = 1; q < COLS - 1; q++) {
      t = L.tileAt(st, rm, q, r);
      if (t !== L.R) continue;
      var dx0 = q * T + 6 + rnd() * 18, top = r * T, roll = rnd();
      if (!solid(q, r - 1) && L.tileAt(st, rm, q, r - 1) === L.E && roll < 0.2) {
        if (rm.zone === 1 || rm.zone === 4) {
          var gc = rm.zone === 1 ? ['#9cc4ff', '#5d7fd6'] : ['#ffb3c4', '#c0607a'];
          for (k = 0; k < 3; k++) { var h2 = 6 + rnd() * 9, ox = dx0 + k * 5 - 5; x.fillStyle = k === 1 ? gc[0] : gc[1]; x.beginPath(); x.moveTo(ox - 2.5, top); x.lineTo(ox, top - h2); x.lineTo(ox + 2.5, top); x.fill(); }
          glows.push({ x: dx0, y: top - 6, r: 22, col: gc[0] });
        } else if (rm.zone === 2) {
          for (k = 0; k < 2; k++) { var mx = dx0 + k * 8, mh = 5 + rnd() * 6; x.fillStyle = '#cfe8d8'; x.fillRect(mx - 1, top - mh, 2, mh); x.fillStyle = '#5effb0'; x.beginPath(); x.ellipse(mx, top - mh, 4.5, 2.6, 0, Math.PI, 0); x.fill(); }
          glows.push({ x: dx0 + 4, y: top - 8, r: 26, col: '#5effb0' });
        } else if (rm.zone === 3) {
          x.strokeStyle = '#ff9a4a'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(dx0 - 6, top + 3); x.lineTo(dx0, top + 7); x.lineTo(dx0 + 7, top + 4); x.stroke();
          glows.push({ x: dx0, y: top + 4, r: 18, col: '#ff7a2a' });
        } else {
          x.fillStyle = z.hi; x.beginPath(); x.ellipse(dx0, top - 2, 5, 3, 0, Math.PI, 0); x.fill(); x.beginPath(); x.ellipse(dx0 + 7, top - 1.5, 3, 2, 0, Math.PI, 0); x.fill();
        }
      } else if (!solid(q, r + 1) && L.tileAt(st, rm, q, r + 1) === L.E && roll < 0.16) {
        var bt = (r + 1) * T;
        if (rm.zone === 2) { x.strokeStyle = 'rgba(110,220,170,.55)'; x.lineWidth = 1.2; for (k = 0; k < 3; k++) { var lx2 = dx0 + k * 4; x.beginPath(); x.moveTo(lx2, bt); x.quadraticCurveTo(lx2 + 3, bt + 8, lx2, bt + 12 + rnd() * 10); x.stroke(); } }
        else { x.fillStyle = z.hi; x.globalAlpha = 0.7; x.beginPath(); x.moveTo(dx0 - 3, bt); x.lineTo(dx0, bt + 7 + rnd() * 7); x.lineTo(dx0 + 3, bt); x.fill(); x.globalAlpha = 1; }
      }
    }
    c.glows = glows;
    cache[key] = c;
    return c;
  }

  // ---------- Предметы и существа ----------
  function gem(ctx, x, y, s, col, t) {
    ctx.save(); ctx.translate(x, y);
    var gr = ctx.createLinearGradient(-s, -s, s, s); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.35, col); gr.addColorStop(1, 'rgba(0,0,0,.55)');
    ctx.fillStyle = col; ctx.beginPath();
    ctx.moveTo(0, -s * 1.3); ctx.lineTo(s * 0.9, -s * 0.45); ctx.lineTo(s * 0.9, s * 0.45); ctx.lineTo(0, s * 1.3); ctx.lineTo(-s * 0.9, s * 0.45); ctx.lineTo(-s * 0.9, -s * 0.45); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 0.65; ctx.fillStyle = gr; ctx.fill(); ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.moveTo(-s * 0.5, -s * 0.5); ctx.lineTo(0, -s * 1.05); ctx.lineTo(s * 0.15, -s * 0.4); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-s * 0.9, -s * 0.45); ctx.lineTo(s * 0.9, -s * 0.45); ctx.moveTo(-s * 0.9, s * 0.45); ctx.lineTo(s * 0.9, s * 0.45); ctx.stroke();
    ctx.restore();
  }
  function crystalIcon(ctx, x, y, cid, s, on, t) {
    if (on) gem(ctx, x, y, s, CC[cid], t);
    else { ctx.strokeStyle = 'rgba(200,190,215,.35)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x, y - s * 1.3); ctx.lineTo(x + s * 0.9, y - s * 0.45); ctx.lineTo(x + s * 0.9, y + s * 0.45); ctx.lineTo(x, y + s * 1.3); ctx.lineTo(x - s * 0.9, y + s * 0.45); ctx.lineTo(x - s * 0.9, y - s * 0.45); ctx.closePath(); ctx.stroke(); }
  }
  function glow(ctx, x, y, r, col, a) {
    var gr = ctx.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = a; ctx.fillStyle = gr; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.globalAlpha = 1;
  }
  function beacon(ctx, x, y, cur, t) {
    ctx.fillStyle = '#2f333b'; rr(ctx, x - 9, y - 5, 18, 5, 2); ctx.fill();
    ctx.fillStyle = '#4b505b'; ctx.fillRect(x - 2.5, y - 40, 5, 36);
    ctx.fillStyle = '#9aa3ad'; rr(ctx, x - 9, y - 58, 18, 19, 4); ctx.fill();
    var on = cur ? 0.85 + Math.sin(t * 5) * 0.15 : 0.35;
    ctx.fillStyle = cur ? 'rgba(120,250,255,' + on + ')' : '#2c4c55'; rr(ctx, x - 6, y - 55, 12, 13, 3); ctx.fill();
    ctx.fillStyle = '#6b7380'; ctx.beginPath(); ctx.moveTo(x - 10, y - 58); ctx.lineTo(x, y - 66); ctx.lineTo(x + 10, y - 58); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(x - 4, y - 53, 2, 8);
  }
  function nugget(ctx, x, y, t) {
    var b = Math.sin(t * 3 + x) * 1.5;
    ctx.fillStyle = '#b07a22'; ctx.beginPath(); ctx.moveTo(x - 7, y - 3 + b); ctx.lineTo(x - 4, y - 10 + b); ctx.lineTo(x + 3, y - 11 + b); ctx.lineTo(x + 8, y - 5 + b); ctx.lineTo(x + 5, y - 1 + b); ctx.lineTo(x - 4, y - 1 + b); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f2c95a'; ctx.beginPath(); ctx.moveTo(x - 4, y - 9 + b); ctx.lineTo(x + 2, y - 10 + b); ctx.lineTo(x + 4, y - 6 + b); ctx.lineTo(x - 2, y - 5 + b); ctx.closePath(); ctx.fill();
  }
  function tank(ctx, x, y, t) {
    ctx.fillStyle = '#7a5a2a'; rr(ctx, x - 7, y - 20, 14, 20, 5); ctx.fill();
    var gr = ctx.createLinearGradient(x - 7, 0, x + 7, 0); gr.addColorStop(0, '#d9a54a'); gr.addColorStop(0.5, '#f5d27a'); gr.addColorStop(1, '#8a5f22');
    ctx.fillStyle = gr; rr(ctx, x - 6, y - 19, 12, 18, 5); ctx.fill();
    ctx.fillStyle = '#4fd58a'; ctx.fillRect(x - 6, y - 12, 12, 4);
    ctx.fillStyle = '#6b7380'; ctx.fillRect(x - 2, y - 24, 4, 5);
  }
  function heartGem(ctx, x, y, t, open) {
    ctx.fillStyle = '#3a2030'; ctx.beginPath(); ctx.moveTo(x - 20, y); ctx.lineTo(x - 13, y - 14); ctx.lineTo(x + 13, y - 14); ctx.lineTo(x + 20, y); ctx.fill();
    ctx.fillStyle = '#6a3a50'; ctx.fillRect(x - 13, y - 16, 26, 3);
    var s = 13 + Math.sin(t * 3) * 1.5, cy = y - 40;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (var k = 0; k < 8; k++) { var a = t * 0.6 + k * Math.PI / 4; ctx.strokeStyle = 'rgba(255,190,90,.18)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 18, cy + Math.sin(a) * 18); ctx.lineTo(x + Math.cos(a) * 46, cy + Math.sin(a) * 46); ctx.stroke(); }
    ctx.restore();
    gem(ctx, x, cy, s, open ? '#ffb04a' : '#8a5a4a', t);
  }
  function moth(ctx, x, y, t, ph) {
    var f = Math.abs(Math.sin(t * 13 + ph));
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(92,64,78,.95)'; ctx.strokeStyle = 'rgba(255,150,70,.95)'; ctx.lineWidth = 1.6;
    [-1, 1].forEach(function (s) {
      ctx.beginPath(); ctx.ellipse(s * 7, -3 - f * 3, 9, 4 + f * 4, s * (0.5 - f * 0.4), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    });
    ctx.fillStyle = '#1b1417'; ctx.beginPath(); ctx.ellipse(0, 0, 4, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.arc(-1.8, -4, 1.4, 0, Math.PI * 2); ctx.arc(1.8, -4, 1.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  function crawler(ctx, x, y, dir, t) {
    ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1);
    var w = Math.sin(t * 16) * 2;
    ctx.strokeStyle = '#3b1e10'; ctx.lineWidth = 1.6;
    for (var k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(k * 8, -5); ctx.lineTo(k * 8 - 3 + (k % 2 ? w : -w), 0); ctx.stroke(); }
    [[-9, -8, 6], [0, -10, 7.5], [9, -9, 6.5]].forEach(function (s, i) {
      var gr = ctx.createRadialGradient(s[0] - 2, s[1] - 3, 1, s[0], s[1], s[2]); gr.addColorStop(0, '#d98b52'); gr.addColorStop(1, '#6e3418');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(s[0], s[1], s[2], 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#c45a2a'; ctx.beginPath(); ctx.moveTo(s[0] - 2, s[1] - s[2] + 1); ctx.lineTo(s[0], s[1] - s[2] - 4); ctx.lineTo(s[0] + 2, s[1] - s[2] + 1); ctx.fill();
    });
    ctx.fillStyle = '#ffe14d'; ctx.beginPath(); ctx.arc(12, -10, 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  // крот «Бурик»: стальной корпус, латунный бур, гусеницы
  function mole(ctx, x, y, dir, t, dig) {
    ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1);
    if (dig) ctx.translate((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2);
    ctx.fillStyle = '#2a2c31'; rr(ctx, -10, 3, 18, 6, 3); ctx.fill();
    ctx.fillStyle = '#6b7380'; for (var k = 0; k < 4; k++) ctx.fillRect(-8 + ((k * 5 + t * 40) % 16), 5, 2, 2);
    var gr = ctx.createLinearGradient(0, -8, 0, 5); gr.addColorStop(0, '#c3cad3'); gr.addColorStop(1, '#5d646f');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(-1, -1, 11, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8edf3'; ctx.beginPath(); ctx.arc(-6, -4, 1.2, 0, Math.PI * 2); ctx.arc(-1, -6, 1.2, 0, Math.PI * 2); ctx.fill();
    var sp = (t * 24) % 2 < 1;
    ctx.fillStyle = sp ? '#e0b456' : '#9c7428'; ctx.beginPath(); ctx.moveTo(8, -6); ctx.lineTo(19, -1); ctx.lineTo(8, 4); ctx.fill();
    ctx.fillStyle = sp ? '#9c7428' : '#e0b456'; ctx.beginPath(); ctx.moveTo(11, -4.5); ctx.lineTo(14, -2); ctx.lineTo(11, 0); ctx.fill();
    ctx.fillStyle = '#ff5d4a'; ctx.beginPath(); ctx.arc(5, -3, 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#9aa3ad'; ctx.fillRect(-9, -11, 2, 5);
    ctx.restore();
  }
  // водолаз-рудознатец в латунном скафандре
  function hero(ctx, x, y, H, t, o) {
    o = o || {};
    var climb = H.climb, f = climb ? 1 : H.face, sw = H.walkT ? Math.sin(H.walkT * 13) : 0, air = !H.ground && !climb;
    ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.scale(f, 1);
    var cl = climb ? Math.sin(H.y * 7) : 0;
    // ноги
    var lg = function (dx, off, dyk) { ctx.fillStyle = '#8a5f22'; rr(ctx, dx - 3, -19 + dyk, 7, 15, 3); ctx.fill(); ctx.fillStyle = '#2b2320'; rr(ctx, dx - 4 + off, -6 + dyk, 10, 6, 2); ctx.fill(); };
    if (climb) { lg(-4, 0, cl * 3); lg(4, 0, -cl * 3); }
    else if (air) { lg(-4, -1, -3); lg(5, 1, 0); }
    else { lg(-3 - sw * 3, 0, 0); lg(4 + sw * 3, 0, 0); }
    // ранец-баллон
    var tg = ctx.createLinearGradient(-15, 0, -7, 0); tg.addColorStop(0, '#7a3a20'); tg.addColorStop(1, '#c46a3e');
    ctx.fillStyle = tg; rr(ctx, -15, -39, 8, 20, 4); ctx.fill();
    ctx.fillStyle = '#e8a070'; ctx.fillRect(-13, -36, 2, 13);
    // корпус
    var bg2 = ctx.createLinearGradient(-9, -38, 10, -16); bg2.addColorStop(0, '#f0c062'); bg2.addColorStop(0.55, '#c8913a'); bg2.addColorStop(1, '#7d5420');
    ctx.fillStyle = bg2; rr(ctx, -9, -38, 19, 22, 6); ctx.fill();
    ctx.fillStyle = '#5a3d1e'; ctx.fillRect(-9, -22, 19, 3);
    ctx.fillStyle = '#ffe2a0'; [-5, 0, 5].forEach(function (rx) { ctx.beginPath(); ctx.arc(rx, -35, 1, 0, Math.PI * 2); ctx.fill(); });
    // рука
    ctx.fillStyle = '#b07e30';
    if (climb) { rr(ctx, 4, -50 + cl * 4, 6, 16, 3); ctx.fill(); rr(ctx, -8, -50 - cl * 4, 6, 16, 3); ctx.fill(); }
    else { ctx.save(); ctx.translate(6, -32); ctx.rotate(air ? -0.9 : sw * 0.5); rr(ctx, -3, 0, 6, 14, 3); ctx.fill(); ctx.fillStyle = '#2b2320'; ctx.fillRect(-3, 12, 6, 4); ctx.restore(); }
    // шлем
    ctx.fillStyle = '#6d4a1c'; rr(ctx, -8, -41, 17, 5, 2); ctx.fill();
    var hg = ctx.createRadialGradient(-1, -50, 2, 1, -46, 13); hg.addColorStop(0, '#ffe39a'); hg.addColorStop(0.5, '#cf9a40'); hg.addColorStop(1, '#6d4a1c');
    ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(1, -47, 11, 0, Math.PI * 2); ctx.fill();
    var gl = ctx.createRadialGradient(6, -49, 1, 5, -47, 7); gl.addColorStop(0, '#6fd7e8'); gl.addColorStop(1, '#0b2a33');
    ctx.fillStyle = '#5a3d1e'; ctx.beginPath(); ctx.arc(5, -47, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(5, -47, 5.6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(5, -47, 3.6, 3.6, 4.6); ctx.stroke();
    // фонарь
    ctx.fillStyle = '#4b505b'; ctx.fillRect(-2, -60, 6, 4);
    ctx.fillStyle = '#fff3c0'; ctx.fillRect(3, -60, 2, 4);
    if (!o.noMole) { ctx.save(); ctx.translate(-13, -42); ctx.scale(0.55, 0.55); mole(ctx, 0, 0, -1, 0, false); ctx.restore(); }
    ctx.restore();
    if (H.stun > 0) {
      for (var k = 0; k < 3; k++) { var a = t * 6 + k * 2.1; ctx.fillStyle = '#ffe14d'; ctx.beginPath(); var sx = x + Math.cos(a) * 12, sy = y - 64 + Math.sin(a) * 3; ctx.moveTo(sx, sy - 3); ctx.lineTo(sx + 1, sy - 1); ctx.lineTo(sx + 3, sy); ctx.lineTo(sx + 1, sy + 1); ctx.lineTo(sx, sy + 3); ctx.lineTo(sx - 1, sy + 1); ctx.lineTo(sx - 3, sy); ctx.lineTo(sx - 1, sy - 1); ctx.fill(); }
    }
  }
  function lifeIcon(ctx, x, y, on) {
    ctx.globalAlpha = on ? 1 : 0.25;
    ctx.fillStyle = '#cf9a40'; ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0b2a33'; ctx.beginPath(); ctx.arc(x + 2, y, 3.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#6fd7e8'; ctx.fillRect(x + 1, y - 2, 1.5, 1.5);
    ctx.globalAlpha = 1;
  }

  // ---------- Кадр ----------
  function draw(ctx, S, g, o) {
    o = o || {};
    var W = Gb.logic.world(), rm = W.rooms[S.room], z = ZC[rm.zone], t = S.time, i;
    curZone = rm.zone;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, g.W, g.H);
    var layer = staticLayer(S, rm);
    ctx.drawImage(layer, 0, OY);
    ctx.save(); ctx.beginPath(); ctx.rect(0, OY, g.W, g.H - OY); ctx.clip();
    // плавающие искры/споры зоны
    for (i = 0; i < 14; i++) {
      var px = ((i * 97 + rm.i * 31) % 640 + Math.sin(t * 0.3 + i) * 20 + 640) % 640, py = OY + ((i * 53 + rm.i * 17) % 384 - (t * (6 + i % 5)) % 384 + 384) % 384;
      ctx.fillStyle = z.speck + (0.25 + 0.25 * Math.sin(t * 2 + i)) + ')'; ctx.fillRect(px, py, 2, 2);
    }
    // шлак и Печать — живые
    for (var r = 0; r < ROWS; r++) for (var q = 0; q < COLS; q++) {
      var k = L.tileAt(S, rm, q, r);
      if (k === L.SL) {
        var bx = X(q), by = Y(r), a = 0.65 + 0.35 * Math.sin(t * 5 + q);
        ctx.fillStyle = '#2a0f0a'; ctx.fillRect(bx, by, T, T);
        var sg = ctx.createLinearGradient(0, by, 0, by + 14); sg.addColorStop(0, 'rgba(255,170,60,' + a + ')'); sg.addColorStop(1, 'rgba(160,30,10,0)');
        ctx.fillStyle = sg; ctx.fillRect(bx, by, T, 14);
        ctx.strokeStyle = 'rgba(255,200,90,' + a + ')'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(bx + 3, by + 6); ctx.lineTo(bx + 12, by + 12); ctx.lineTo(bx + 20, by + 7); ctx.lineTo(bx + 29, by + 13); ctx.stroke();
      } else if (k === L.GT) {
        var gx = X(q), gy = Y(r);
        ctx.fillStyle = '#25232c'; ctx.fillRect(gx, gy, T, T);
        ctx.fillStyle = '#5d5b6a'; for (var b = 0; b < 3; b++) ctx.fillRect(gx + 4 + b * 10, gy, 4, T);
        ctx.fillStyle = '#8e8ba0'; ctx.fillRect(gx, gy + 2, T, 3);
        var row = r - (rm.c.L && rm.c.L.k === 'gate' ? rm.c.L.h : rm.c.R ? rm.c.R.h : 10) + 3;
        for (var s2 = 0; s2 < 3; s2++) {
          var cid = row * 3 + s2 + 1; if (cid > 8) continue;
          var got = S.crystals.indexOf(cid) >= 0;
          ctx.fillStyle = got ? CC[cid] : '#14131a'; ctx.beginPath(); ctx.arc(gx + 7 + s2 * 9, gy + 18, 3, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
    // клапаны
    rm.vents.forEach(function (v) {
      var vx = X(v.x) + T / 2, vy = Y(v.y);
      if (L.ventOn(v, t)) {
        for (var n = 0; n < 9; n++) { var ph = (t * 2.2 + n / 9) % 1, ry = vy - ph * 3 * T, rx = vx + Math.sin(t * 9 + n * 2) * 5; ctx.fillStyle = 'rgba(235,240,245,' + (0.5 * (1 - ph)) + ')'; ctx.beginPath(); ctx.arc(rx, ry, 6 + ph * 9, 0, Math.PI * 2); ctx.fill(); }
      } else if (L.ventWarn(v, t)) {
        for (var n2 = 0; n2 < 3; n2++) { ctx.fillStyle = 'rgba(220,225,235,.35)'; ctx.beginPath(); ctx.arc(vx + (n2 - 1) * 6, vy - 6 - ((t * 30 + n2 * 5) % 10), 3, 0, Math.PI * 2); ctx.fill(); }
      }
    });
    // предметы
    rm.items.forEach(function (it) {
      var ix = X(it.c) + T / 2, iy = Y(it.r);
      if (it.k === 'beacon') beacon(ctx, ix, iy, S.cp.id === it.id, t);
      else if (it.k === 'heart') heartGem(ctx, ix, iy, t, S.gate);
      else if (S.got[it.id]) return;
      else if (it.k === 'crystal') gem(ctx, ix, iy - 16 + Math.sin(t * 2.5) * 3, 9, CC[it.cid], t);
      else if (it.k === 'nugget') nugget(ctx, ix, iy, t);
      else if (it.k === 'tank') tank(ctx, ix, iy, t);
    });
    // существа
    S.enemies.forEach(function (e) {
      if (!e.alive) return;
      if (e.type === 'moth') moth(ctx, X(e.x), Y(e.y), t, e.ph); else crawler(ctx, X(e.x), Y(e.y), e.dir, t);
    });
    // крот
    var M = S.mole, H = S.hero;
    if (M.state !== 'home') {
      if (M.state === 'dig') { ctx.fillStyle = 'rgba(160,110,60,.6)'; for (var d = 0; d < 4; d++) ctx.fillRect(X(M.x) + (Math.random() - 0.5) * 22, Y(M.y) + (Math.random() - 0.5) * 18, 3, 3); }
      mole(ctx, X(M.x), Y(M.y) + 2, M.vert ? 1 : M.dir, t, M.state === 'dig');
    }
    // герой
    if (S.phase !== 'dead' && !(H.inv > 0 && Math.floor(t * 14) % 2 && S.phase === 'play' && !o.bare)) hero(ctx, X(H.x), Y(H.y), H, t, { noMole: M.state !== 'home' });
    // свет фонаря: темнота вокруг, ярче у героя
    var hx = X(H.x) + H.face * 6, hy = Y(H.y) - 46, dk = o.bare ? z.dark * 0.7 : z.dark;
    var lg = ctx.createRadialGradient(hx, hy, 40, hx, hy, 330);
    lg.addColorStop(0, 'rgba(0,0,0,0)'); lg.addColorStop(0.55, 'rgba(0,0,0,' + (dk * 0.6) + ')'); lg.addColorStop(1, 'rgba(0,0,0,' + dk + ')');
    ctx.fillStyle = lg; ctx.fillRect(0, OY, g.W, g.H - OY);
    // свечение: кристаллы, маяки, Сердце, шлак
    ctx.globalCompositeOperation = 'lighter';
    rm.items.forEach(function (it) {
      var ix = X(it.c) + T / 2, iy = Y(it.r);
      if (it.k === 'crystal' && !S.got[it.id]) glow(ctx, ix, iy - 16, 46, CC[it.cid], 0.4 + 0.15 * Math.sin(t * 3));
      if (it.k === 'beacon') glow(ctx, ix, iy - 48, S.cp.id === it.id ? 70 : 30, '#5ef0ff', S.cp.id === it.id ? 0.35 : 0.15);
      if (it.k === 'heart') glow(ctx, ix, iy - 40, 120, '#ffb04a', 0.45 + 0.1 * Math.sin(t * 3));
    });
    for (r = 0; r < ROWS; r++) for (q = 0; q < COLS; q++) if (L.tileAt(S, rm, q, r) === L.SL) glow(ctx, X(q) + T / 2, Y(r) + 4, 30, '#ff7a2a', 0.35);
    (layer.glows || []).forEach(function (gl, n) { glow(ctx, gl.x, OY + gl.y, gl.r, gl.col, 0.22 + 0.08 * Math.sin(t * 2 + n)); });
    S.enemies.forEach(function (e) { if (e.alive && e.type === 'moth') glow(ctx, X(e.x), Y(e.y) - 3, 26, '#ff8a3d', 0.35); else if (e.alive) glow(ctx, X(e.x) + e.dir * 12, Y(e.y) - 10, 16, '#ffe14d', 0.3); });
    glow(ctx, hx + H.face * 10, hy, 60, '#fff1c4', 0.12);
    ctx.globalCompositeOperation = 'source-over';
    // всплывашки
    if (o.toasts) Gb.ui.toasts(g, ctx, o.toasts, P);
    if (o.fade > 0) { ctx.fillStyle = 'rgba(0,0,0,' + o.fade + ')'; ctx.fillRect(0, OY, g.W, g.H - OY); }
    ctx.restore();
    if (!o.bare) { Gb.ui.hud(g, ctx, S, P, api); Gb.ui.banner(g, ctx, S, P, o); }
  }

  var api = { P: P, CC: CC, bg: bg, draw: draw, hero: hero, mole: mole, lifeIcon: lifeIcon, crystalIcon: crystalIcon, gem: gem, staticLayer: staticLayer };
  Gb.modern = api;
})(typeof window !== 'undefined' ? window : globalThis);
