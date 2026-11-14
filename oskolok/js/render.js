/* ОСКОЛОК · рендер обеих тем: плоская полигональная графика (заливка полигонами, силуэты, градиентный свет) — modern;
   retro — те же силуэты в 16 цветах EGA, кадр рисуется в 320×180 и масштабируется «пикселями».
   OSKOLOK.R: draw(g, ctx, S, ui) — игровой кадр; cut(ctx, id, t, retro) — кат-сцены движком (без слов);
   figures: vera, drone, glassblower, shadow — общие для игры, титула и кат-сцен. */
(function (global) {
  'use strict';
  var O = global.OSKOLOK = global.OSKOLOK || {};
  var VW = 640, VH = 360, TS = 20, COLS = 32, ROWS = 18;
  var E = { k: '#000000', b: '#0000aa', g: '#00aa00', c: '#00aaaa', r: '#aa0000', m: '#aa00aa', n: '#aa5500', l: '#aaaaaa',
    d: '#555555', B: '#5555ff', G: '#55ff55', C: '#55ffff', R: '#ff5555', M: '#ff55ff', y: '#ffff55', w: '#ffffff' };
  // палитры глав: небо (3 тона), башни (2), камень (тёмный, средний, кромка), стекло, акцент
  var PAL = {
    m: {
      1: { sky: ['#140c2c', '#4a2350', '#c9643c'], tw: ['#3a2450', '#22163a'], rock: ['#211b38', '#372e55', '#9c86d4'], glass: '#9fe4ff', acc: '#ffb36b' },
      2: { sky: ['#081a2c', '#173e58', '#6fb0c4'], tw: ['#1f4660', '#12293f'], rock: ['#172638', '#2c4562', '#7fc4e0'], glass: '#a8f0ff', acc: '#9ff2ff' },
      3: { sky: ['#14132a', '#363566', '#b4a2e6'], tw: ['#3a3570', '#221f47'], rock: ['#1b1a33', '#2e2c52', '#c8bcff'], glass: '#d8d0ff', acc: '#ffe9a0' },
      4: { sky: ['#04050b', '#0a0e1c', '#151b30'], tw: ['#121831', '#0b0f20'], rock: ['#0f1220', '#1b2034', '#58689a'], glass: '#7fa8d8', acc: '#d8ff6a' },
      5: { sky: ['#1c0820', '#561442', '#ff8f62'], tw: ['#4a1a46', '#2c0f2e'], rock: ['#22102a', '#3a1c44', '#ff9ab8'], glass: '#ffd0e8', acc: '#ffcf6a' }
    },
    r: {
      1: { sky: [E.k, E.b, E.m], tw: [E.b, E.k], rock: [E.k, E.d, E.C], glass: E.C, acc: E.y },
      2: { sky: [E.k, E.k, E.c], tw: [E.b, E.k], rock: [E.k, E.b, E.C], glass: E.C, acc: E.C },
      3: { sky: [E.k, E.b, E.B], tw: [E.k, E.b], rock: [E.k, E.d, E.w], glass: E.w, acc: E.y },
      4: { sky: [E.k, E.k, E.b], tw: [E.b, E.k], rock: [E.k, E.d, E.l], glass: E.B, acc: E.G },
      5: { sky: [E.k, E.m, E.R], tw: [E.r, E.k], rock: [E.k, E.r, E.M], glass: E.M, acc: E.y }
    }
  };
  var LOOK = {
    m: { coat: '#2e8f88', coatD: '#1f6661', pants: '#2b3142', boot: '#16181f', skin: '#e9c6a3', hair: '#3a2a24', gog: '#d79a48', res: '#8ff6ff',
      body: 'rgba(170,190,255,0.55)', bodyE: '#dfe6ff', core: '#7fd8ff', wind: '#ffae4a', stun: '#ffffff', look: '#ffe36a',
      shadow: '#0b0712', shadowE: '#3b2a52', eye: '#f4f0ff', drone: '#d8ff6a', droneW: 'rgba(230,255,200,0.55)', shard: '#bff4ff', shardF: '#ffd36a' },
    r: { coat: E.c, coatD: E.b, pants: E.d, boot: E.k, skin: E.l, hair: E.d, gog: E.y, res: E.C,
      body: E.B, bodyE: E.w, core: E.C, wind: E.y, stun: E.w, look: E.y,
      shadow: E.k, shadowE: E.m, eye: E.w, drone: E.y, droneW: E.G, shard: E.C, shardF: E.y }
  };
  function hsh(a, b) { var h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function poly(c, p, fill) { c.beginPath(); c.moveTo(p[0], p[1]); for (var i = 2; i < p.length; i += 2) c.lineTo(p[i], p[i + 1]); c.closePath(); if (fill) { c.fillStyle = fill; c.fill(); } }
  function mix(a, b, t) {
    var pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    var r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t), g = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t), bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
  }
  function seg(c, x1, y1, x2, y2, w1, w2, fill) {   // четырёхугольник-«кость» от (x1,y1) к (x2,y2)
    var dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    poly(c, [x1 + nx * w1 / 2, y1 + ny * w1 / 2, x2 + nx * w2 / 2, y2 + ny * w2 / 2, x2 - nx * w2 / 2, y2 - ny * w2 / 2, x1 - nx * w1 / 2, y1 - ny * w1 / 2], fill);
  }
  function hex(c, x, y, r, rot, fill, sy) { var p = []; for (var i = 0; i < 6; i++) { var a = rot + i * Math.PI / 3; p.push(x + Math.cos(a) * r, y + Math.sin(a) * r * (sy || 1)); } poly(c, p, fill); }
  function glow(c, x, y, r, col, a) { var gr = c.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.globalAlpha = a == null ? 1 : a; c.fillStyle = gr; c.fillRect(x - r, y - r, r * 2, r * 2); c.globalAlpha = 1; }
  function rgba(hexc, a) { var p = parseInt(hexc.slice(1), 16); return 'rgba(' + ((p >> 16) & 255) + ',' + ((p >> 8) & 255) + ',' + (p & 255) + ',' + a + ')'; }

  // ---------- фигуры ----------
  // Вера: x,y — подошвы (px), s — масштаб (1 = клетка 20 px), face ±1, pose {k, ph, t, tilt}
  function vera(c, x, y, s, face, pose, retro) {
    var L = LOOK[retro ? 'r' : 'm'], k = pose.k || 'stand', ph = pose.ph || 0, t = pose.t || 0;
    c.save(); c.translate(x, y); c.scale(face * s, s);
    if (k === 'dead') { c.rotate(-Math.PI / 2 * Math.min(1, t * 3)); c.translate(0, 2 * Math.min(1, t * 3)); }
    var lean = 0, hipY = -16, a1 = 0, a2 = 0, s1 = 0, s2 = 0, arF = 0.2, frF = -0.3, arB = -0.2, frB = -0.5, crouch = 0;
    if (k === 'run') { a1 = Math.sin(ph) * 0.75; a2 = -a1; s1 = a1 - 0.35 - Math.max(0, Math.cos(ph)) * 0.7; s2 = a2 - 0.35 - Math.max(0, -Math.cos(ph)) * 0.7; lean = 0.16; arF = -a1 * 0.9; frF = arF - 0.9; arB = a1 * 0.9; frB = arB - 0.9; }
    else if (k === 'air') { a1 = 0.6; s1 = -0.2; a2 = -0.35; s2 = -0.9; lean = 0.08; arF = 1.4; frF = 0.9; arB = -0.9; frB = -1.4; }
    else if (k === 'shield') { a1 = 0.35; s1 = 0.1; a2 = -0.3; s2 = -0.2; crouch = 1.5; arF = 1.45; frF = 1.6; arB = 0.6; frB = 1.2; lean = 0.1; }
    else if (k === 'charge') { a1 = 0.4; s1 = -0.1; a2 = -0.4; s2 = -0.3; crouch = 2.5 + Math.sin(t * 30) * 0.4; arF = 1.0; frF = 1.5; arB = 0.9; frB = 1.4; lean = 0.2; }
    else if (k === 'pulse') { a1 = 0.3; s1 = 0.1; a2 = -0.25; s2 = -0.3; arF = 1.55; frF = 1.55; arB = -0.4; frB = -0.8; lean = 0.12; }
    else if (k === 'kneel') { a1 = 1.4; s1 = -0.2; a2 = -0.2; s2 = -1.6; crouch = 6; arF = 0.9; frF = 0.5; arB = 0.2; frB = -0.3; lean = 0.25; }
    else if (k === 'reach') { arF = 2.2; frF = 2.4; }
    else if (k === 'sit') { a1 = 1.5; s1 = 0.0; a2 = 1.3; s2 = 0.1; crouch = 7; arF = 0.8; frF = 1.4; }
    else { var br = Math.sin(t * 2) * 0.03; arF = 0.15 + br; frF = -0.15; arB = -0.12 - br; frB = -0.3; }
    hipY += crouch;
    var lg = function (a, b, col) {
      var kx = Math.sin(a) * 8, ky = hipY + Math.cos(a) * 8, fx = kx + Math.sin(b) * 8, fy = ky + Math.cos(b) * 8;
      seg(c, 0, hipY, kx, ky, 4.4, 3.6, col); seg(c, kx, ky, fx, fy, 3.6, 3, col);
      poly(c, [fx - 1.6, fy - 1.4, fx + 3.4, fy - 0.6, fx + 3.4, fy + 0.6, fx - 1.6, fy + 0.6], L.boot);
    };
    lg(a2, s2, retro ? E.b : mix(L.pants, '#000000', 0.35));
    // спина: задняя рука
    var shX = Math.sin(lean) * 12, shY = hipY - 12;
    var arm = function (a, b, col, res) {
      var ex = shX + Math.sin(a) * 6.5, ey = shY + Math.cos(a) * 6.5, hx = ex + Math.sin(b) * 6, hy = ey + Math.cos(b) * 6;
      seg(c, shX, shY, ex, ey, 3.4, 3, col); seg(c, ex, ey, hx, hy, 3, 2.6, col);
      hex(c, hx, hy, 1.6, 0, L.skin);
      if (res) {   // резонатор — камертон-вилка на запястье
        var ang = Math.atan2(hy - ey, hx - ex);
        c.save(); c.translate(hx, hy); c.rotate(ang);
        poly(c, [0, -1.2, 3, -1.2, 3, 1.2, 0, 1.2], retro ? E.l : '#5c6f78');
        poly(c, [3, -2.4, 7, -2.4, 7, -1.2, 3, -1.2], L.res); poly(c, [3, 1.2, 7, 1.2, 7, 2.4, 3, 2.4], L.res);
        c.restore();
        return { x: hx, y: hy };
      }
    };
    arm(arB, frB, L.coatD);
    lg(a1, s1, L.pants);
    // корпус: рабочая куртка с полами
    poly(c, [-4.6, hipY + 3, 4.8, hipY + 3, shX + 4.4, shY + 0.5, shX - 4.4, shY + 1], L.coat);
    poly(c, [0.5, hipY + 3, 4.8, hipY + 3, shX + 4.4, shY + 0.5, shX + 1, shY + 0.5], retro ? E.C : mix(L.coat, '#ffffff', 0.18));
    poly(c, [-4.6, hipY - 1, 4.6, hipY - 1, 4.6, hipY + 1, -4.6, hipY + 1], retro ? E.k : '#1d2430');   // пояс
    // голова: шестигранник, волосы с пучком, очки-«консервы» на лбу
    var hx0 = shX + 1.2, hy0 = shY - 4.8 + (pose.tilt || 0) * 0.5;
    seg(c, shX, shY, hx0, hy0 + 2, 2.4, 2.2, L.skin);
    hex(c, hx0, hy0, 4.3, Math.PI / 6, L.skin);
    poly(c, [hx0 - 4.6, hy0 + 1.5, hx0 - 4.4, hy0 - 2.8, hx0 - 1.5, hy0 - 4.8, hx0 + 3.2, hy0 - 4.2, hx0 + 4.4, hy0 - 2.2, hx0 + 1, hy0 - 2.6, hx0 - 1.6, hy0 - 0.6, hx0 - 2.2, hy0 + 2.6], L.hair);
    hex(c, hx0 - 5.2, hy0 - 2.6, 2.3, 0, L.hair);
    poly(c, [hx0 - 2.5, hy0 - 3.6, hx0 + 4.4, hy0 - 3.1, hx0 + 4.4, hy0 - 1.9, hx0 - 2.5, hy0 - 2.3], L.gog);
    hex(c, hx0 + 2.8, hy0 - 2.6, 1.3, 0, retro ? E.C : '#bdf2ff');
    var hand = arm(arF, frF, L.coat, true);
    c.restore();
    return hand;
  }
  function drone(c, x, y, s, t, retro, bright) {
    var L = LOOK[retro ? 'r' : 'm'], f = Math.sin(t * 40) * 0.5 + 0.5;
    if (!retro) glow(c, x, y, 26 * s * (bright || 1), 'rgba(216,255,106,0.55)', 0.8);
    c.save(); c.translate(x, y); c.scale(s, s);
    poly(c, [0, -1, -7, -4 - f * 3, -6, 1, -1, 1], L.droneW); poly(c, [0, -1, 7, -4 - f * 3, 6, 1, 1, 1], L.droneW);
    hex(c, 0, 0, 2.8, 0, L.drone); hex(c, 0.6, -0.6, 1.2, 0, retro ? E.w : '#ffffff');
    poly(c, [-1, 2.4, 1, 2.4, 0, 4.4], retro ? E.G : '#aee24a');
    c.restore();
  }
  // Стеклодув-страж: гранёное стеклянное тело, трубка стеклодува, «пузырь» на замахе
  function glassblower(c, x, y, s, face, st, t, retro, a) {
    var L = LOOK[retro ? 'r' : 'm'];
    c.save(); c.translate(x, y); c.scale(face * s, s); c.globalAlpha = a == null ? 1 : a;
    var sway = st === 'patrol' ? Math.sin(t * 5) * 0.8 : 0, stun = st === 'stun';
    poly(c, [-3.4, 0, -1.2, 0, -1.4, -11, -3.6, -11], retro ? E.b : 'rgba(120,140,220,0.7)');
    poly(c, [1.2, 0, 3.4, 0, 3.6, -11, 1.4, -11], retro ? E.b : 'rgba(120,140,220,0.7)');
    poly(c, [-6.5, -9, 6.5, -9, 4.4, -20, -4.4, -20], L.body);
    poly(c, [0, -9, 6.5, -9, 4.4, -20, 0, -20], retro ? E.C : 'rgba(220,230,255,0.35)');
    poly(c, [-5.2, -20, 5.2, -20, 6.4, -27.5, 0, -31, -6.2, -27.5], L.body);
    poly(c, [0, -20, 5.2, -20, 6.4, -27.5, 0, -31], retro ? E.C : 'rgba(230,240,255,0.3)');
    var hy = stun ? -36 + Math.sin(t * 30) * 0.8 : -37;
    poly(c, [0, hy - 2, 3.4, hy + 3.5, 0, hy + 7, -3.2, hy + 3.5], L.body);
    poly(c, [1.2, hy + 2.2, 2.6, hy + 3.4, 1.2, hy + 4.2], retro ? E.w : '#ffffff');
    c.strokeStyle = L.bodyE; c.lineWidth = retro ? 1 : 0.7; poly(c, [-5.2, -20, 5.2, -20, 6.4, -27.5, 0, -31, -6.2, -27.5]); c.stroke();
    // трубка
    var tip = st === 'look' ? [13, -36] : st === 'stun' ? [10, -18] : [14, -27 + sway * 0.3];
    seg(c, 3, -31, 6, -28.5, 2, 2, L.body);
    c.strokeStyle = retro ? E.l : '#cfd8e8'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(2.6, hy + 4.4); c.lineTo(tip[0], tip[1]); c.stroke();
    var core = st === 'wind' ? L.wind : stun ? (Math.sin(t * 25) > 0 ? L.stun : L.core) : st === 'look' ? L.look : L.core;
    if (!retro) glow(c, 0, -25, 9, rgba(core.length === 7 ? core : '#7fd8ff', 0.9), 0.9);
    hex(c, 0, -25, 2.4, 0, core);
    if (st === 'wind') { var b = Math.min(1, t / 0.65); if (!retro) glow(c, tip[0] + 2, tip[1], 10 * b + 3, 'rgba(255,190,90,0.9)', 0.9); hex(c, tip[0] + 1.5 + b * 1.5, tip[1], 1 + b * 3, t * 3, retro ? E.y : 'rgba(255,230,170,0.9)'); }
    c.restore();
  }
  function shadowFig(c, x, y, s, face, st, t, retro, big) {
    var L = LOOK[retro ? 'r' : 'm'], H = big ? 30 : 18, Wd = big ? 11 : 7, n = 14, p = [];
    c.save(); c.translate(x, y); c.scale(face * s, s);
    var al = st === 'burn' ? 0.35 + Math.sin(t * 30) * 0.15 : st === 'stun' ? 0.55 : 0.95;
    c.globalAlpha = al;
    for (var i = 0; i < n; i++) {
      var a = i / n * Math.PI * 2, rr = 1 + Math.sin(t * 6 + i * 1.7) * 0.12 + (retro ? 0 : Math.sin(t * 11 + i) * 0.05);
      var px = Math.sin(a) * Wd * rr, py = -H - Math.cos(a) * H * rr;
      if (py > 0) py = 0;
      p.push(px + (py < -H ? 0 : 0), py);
    }
    poly(c, p, L.shadow);
    if (!retro) { c.strokeStyle = L.shadowE; c.lineWidth = 1; poly(c, p); c.stroke(); }
    // руки-щупальца
    var reach = st === 'hunt' || big ? 1 : 0.3;
    for (var j = 0; j < (big ? 3 : 2); j++) {
      var ay = -H * (1.2 + j * 0.25), len = (big ? 16 : 9) * reach + Math.sin(t * 7 + j) * 2;
      seg(c, Wd * 0.6, ay, Wd * 0.6 + len, ay + Math.sin(t * 5 + j * 2) * 3 + 2, 3.5, 1, L.shadow);
    }
    c.globalAlpha = Math.min(1, al + 0.3);
    var ey = -H * 1.55;
    poly(c, [1, ey, 4.5, ey - 0.8, 4.5, ey + 0.6, 1, ey + 0.9], L.eye); poly(c, [5.6, ey - 1, 8, ey - 1.4, 8, ey, 5.6, ey + 0.4], L.eye);
    c.restore(); c.globalAlpha = 1;
  }

  // ---------- фон: небо, разлом Горна, застывшие стеклянные башни ----------
  function sky(c, P, retro, seed, w, h, ch) {
    if (retro) {
      var bands = [P.sky[0], P.sky[0], P.sky[1], P.sky[1], P.sky[2]];
      for (var i = 0; i < 5; i++) { c.fillStyle = bands[i]; c.fillRect(0, i * h / 5, w, h / 5 + 1); }
      // дизеринг на стыках
      c.fillStyle = P.sky[1];
      for (var yy = 0; yy < 4; yy += 2) for (var xx = (yy / 2) % 2 * 2; xx < w; xx += 4) c.fillRect(xx, h * 2 / 5 - 4 + yy, 2, 2);
    } else {
      var gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, P.sky[0]); gr.addColorStop(0.6, P.sky[1]); gr.addColorStop(1, P.sky[2]);
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
    }
    // звёзды
    for (var s = 0; s < 40; s++) { var sx = hsh(seed, s) * w, sy = hsh(s, seed) * h * 0.5; c.fillStyle = retro ? E.w : 'rgba(255,255,255,' + (0.25 + hsh(s, s) * 0.5) + ')'; c.fillRect(Math.round(sx), Math.round(sy), retro ? 2 : 1.4, retro ? 2 : 1.4); }
    // разлом Звёздного Горна — тёплая трещина в небе
    var rx = w * (0.62 + hsh(seed, 3) * 0.2), ry = h * 0.18;
    var crack = [rx, ry - 30, rx + 6, ry - 8, rx + 2, ry, rx + 9, ry + 18, rx - 1, ry + 6, rx - 6, ry + 24, rx - 3, ry + 2, rx - 9, ry - 12];
    if (!retro) { glow(c, rx, ry, 70, 'rgba(255,190,120,0.35)'); }
    poly(c, crack, retro ? E.y : 'rgba(255,226,170,0.85)');
    // башни: два слоя гранёных призм
    for (var layer = 0; layer < 2; layer++) {
      var n = layer ? 9 : 7;
      for (var k = 0; k < n; k++) {
        var bx = (k + hsh(seed + layer, k) * 0.8) * w / n, bw = 14 + hsh(k, seed + layer) * 26, bh = h * (0.3 + hsh(seed * 3 + k, layer) * 0.45) * (layer ? 0.7 : 1);
        var top = h - bh, col = P.tw[layer];
        poly(c, [bx, h, bx, top + 18, bx + bw / 2, top, bx + bw, top + 18, bx + bw, h], col);
        if (!retro) { poly(c, [bx + bw / 2, h, bx + bw / 2, top, bx + bw, top + 18, bx + bw, h], rgba(P.glass, layer ? 0.06 : 0.1)); }
        else if (layer === 0) { c.fillStyle = P.tw[1]; c.fillRect(bx + bw / 2, top + 10, 2, bh - 10); }
        // окна-грани
        if (!retro && hsh(k, 9) > 0.4) { c.fillStyle = rgba(P.acc, 0.25); c.fillRect(bx + bw * 0.3, top + 30, 2, bh * 0.4); }
      }
    }
  }
  // ---------- статический слой эпизода (кэш по карте и теме) ----------
  var layerCache = { key: null, cv: null };
  function depthMap(t) {
    var D = new Array(COLS * ROWS).fill(0), q = [];
    for (var i = 0; i < t.length; i++) { if (t[i] !== '#') { D[i] = 0; q.push(i); } else D[i] = 99; }
    for (var h = 0; h < q.length; h++) {
      var k = q[h], c = k % COLS, r = (k / COLS) | 0;
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) { var cc = c + d[0], rr = r + d[1]; if (cc < 0 || cc >= COLS || rr < 0 || rr >= ROWS) return; var j = rr * COLS + cc; if (D[j] > D[k] + 1) { D[j] = D[k] + 1; q.push(j); } });
    }
    return D;
  }
  function staticLayer(S, retro) {
    var t = S.M.t, key = S.idx + ':' + (retro ? 'r' : 'm') + ':' + t.join('');
    if (layerCache.key === key) return layerCache.cv;
    var cv = layerCache.cv || (typeof document !== 'undefined' ? document.createElement('canvas') : null); if (!cv) return null;
    cv.width = VW; cv.height = VH; var c = cv.getContext('2d'), P = PAL[retro ? 'r' : 'm'][S.ch];
    c.imageSmoothingEnabled = !retro;
    sky(c, P, retro, S.idx * 7 + 3, VW, VH, S.ch);
    var D = depthMap(t), V = [];
    for (var vy = 0; vy <= ROWS; vy++) for (var vx = 0; vx <= COLS; vx++) {
      var all = true; for (var dy = -1; dy <= 0; dy++) for (var dx = -1; dx <= 0; dx++) { var cc = vx + dx, rr = vy + dy; if (cc < 0 || cc >= COLS || rr < 0 || rr >= ROWS || t[rr * COLS + cc] !== '#') all = false; }
      var j = all ? 0.32 : 0; V.push([(vx + (hsh(vx, vy) - 0.5) * j) * TS, (vy + (hsh(vy + 50, vx) - 0.5) * j) * TS]);
    }
    var vt = function (x, y) { return V[y * (COLS + 1) + x]; };
    c.fillStyle = retro ? P.rock[1] : mix(P.rock[1], P.rock[0], 0.6);
    for (var rb = 0; rb < ROWS; rb++) for (var cb = 0; cb < COLS; cb++) if (t[rb * COLS + cb] === '#') c.fillRect(cb * TS - 0.5, rb * TS - 0.5, TS + 1, TS + 1);
    for (var r = 0; r < ROWS; r++) for (var c0 = 0; c0 < COLS; c0++) {
      var ch = t[r * COLS + c0]; if (ch !== '#') continue;
      var a = vt(c0, r), b = vt(c0 + 1, r), cc2 = vt(c0 + 1, r + 1), d = vt(c0, r + 1), dep = Math.min(4, D[r * COLS + c0]);
      var base = retro ? P.rock[0] : mix(P.rock[1], P.rock[0], (dep - 1) / 3);
      var sh1 = retro ? P.rock[1] : mix(base, '#ffffff', 0.05 + hsh(c0, r) * 0.06), sh2 = retro ? P.rock[1] : mix(base, '#000000', 0.1 + hsh(r, c0) * 0.1);
      if (hsh(c0 * 3, r * 5) > 0.5) { poly(c, [a[0], a[1], b[0], b[1], cc2[0], cc2[1]], sh1); poly(c, [a[0], a[1], cc2[0], cc2[1], d[0], d[1]], sh2); }
      else { poly(c, [a[0], a[1], b[0], b[1], d[0], d[1]], sh1); poly(c, [b[0], b[1], cc2[0], cc2[1], d[0], d[1]], sh2); }
      if (!retro) { c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 0.6; poly(c, [a[0], a[1], b[0], b[1], cc2[0], cc2[1], d[0], d[1]]); c.stroke(); }
      else if (dep <= 1 || hsh(c0 * 7, r * 3) > 0.86) { c.strokeStyle = P.rock[0]; c.lineWidth = 2; c.beginPath(); if (hsh(c0 * 3, r * 5) > 0.5) { c.moveTo(a[0], a[1]); c.lineTo(cc2[0], cc2[1]); } else { c.moveTo(b[0], b[1]); c.lineTo(d[0], d[1]); } c.stroke(); if (dep <= 1) { c.fillStyle = P.rock[0]; c.fillRect(d[0], d[1] - 2, TS, 2); } }
      // кромки на границе с воздухом
      var up = r > 0 && !O.logic.SOLID[t[(r - 1) * COLS + c0]], lf = c0 > 0 && t[r * COLS + c0 - 1] !== '#', rt = c0 < COLS - 1 && t[r * COLS + c0 + 1] !== '#';
      if (up) { poly(c, [a[0], a[1], b[0], b[1], b[0], b[1] + (retro ? 2 : 2.4), a[0], a[1] + (retro ? 2 : 2.4)], P.rock[2]); if (!retro) glow(c, (a[0] + b[0]) / 2, a[1], 14, rgba(P.rock[2], 0.18)); }
      if (lf && !retro) poly(c, [a[0], a[1], a[0] + 1.6, a[1], d[0] + 1.6, d[1], d[0], d[1]], rgba(P.rock[2], 0.35));
      if (rt && !retro) poly(c, [b[0] - 1.6, b[1], b[0], b[1], cc2[0], cc2[1], cc2[0] - 1.6, cc2[1]], rgba(P.rock[2], 0.2));
    }
    // иглы, стекло, кристаллы-блоки, излучатели/приёмники
    for (var r2 = 0; r2 < ROWS; r2++) for (var c2 = 0; c2 < COLS; c2++) {
      var ch2 = t[r2 * COLS + c2], X = c2 * TS, Y = r2 * TS;
      if (ch2 === '^') {
        for (var s = 0; s < 4; s++) { var sx = X + 2 + s * 4.5, hh = 9 + hsh(c2, s) * 7; poly(c, [sx, Y + TS, sx + 2, Y + TS - hh, sx + 4, Y + TS], retro ? (s % 2 ? E.C : E.w) : rgba(P.glass, 0.9)); if (!retro) poly(c, [sx + 2, Y + TS, sx + 2, Y + TS - hh, sx + 4, Y + TS], 'rgba(255,255,255,0.5)'); }
      } else if (ch2 === 'G') {
        poly(c, [X, Y, X + TS, Y, X + TS, Y + TS, X, Y + TS], retro ? E.b : rgba(P.glass, 0.28));
        c.strokeStyle = retro ? E.C : rgba(P.glass, 0.8); c.lineWidth = 1;
        c.beginPath(); if ((c2 + r2) % 2) { c.moveTo(X, Y + TS); c.lineTo(X + TS, Y); } else { c.moveTo(X, Y); c.lineTo(X + TS, Y + TS * 0.6); } c.stroke();
        if (!retro) { poly(c, [X + 3, Y + 2, X + 6, Y + 2, X + 3, Y + 8], 'rgba(255,255,255,0.45)'); }
        else { c.fillStyle = E.C; c.fillRect(X, Y, TS, 2); c.fillRect(X, Y, 2, TS); }
      } else if (ch2 === 'K') {
        poly(c, [X + 1, Y + TS, X + 3, Y + 6, X + 9, Y + 1, X + 13, Y + 5, X + 19, Y + 8, X + 19, Y + TS], retro ? E.B : rgba(P.glass, 0.75));
        poly(c, [X + 9, Y + 1, X + 13, Y + 5, X + 11, Y + TS, X + 6, Y + TS], retro ? E.C : 'rgba(255,255,255,0.35)');
      } else if (ch2 === '}' || ch2 === '{') {
        var dir = ch2 === '}' ? 1 : -1, cx = X + TS / 2;
        poly(c, [X, Y + 2, X + TS, Y + 2, X + TS, Y + TS - 2, X, Y + TS - 2], retro ? E.d : '#3b3550');
        poly(c, [cx + dir * 4, Y + 5, cx + dir * 10, Y + 7, cx + dir * 10, Y + 13, cx + dir * 4, Y + 15], retro ? E.y : P.acc);
      } else if (ch2 === 'R' || ch2 === 'r') {
        poly(c, [X + 1, Y + 1, X + TS - 1, Y + 1, X + TS - 1, Y + TS - 1, X + 1, Y + TS - 1], retro ? E.d : '#2c2840');
        hex(c, X + TS / 2, Y + TS / 2, 6, 0, retro ? E.k : '#141020');
      }
    }
    layerCache.key = key; layerCache.cv = cv;
    return cv;
  }

  // ---------- динамические объекты ----------
  var doorA = { 1: 0, 2: 0 };
  function crystal(c, x, y, retro, P, t) {   // x,y — центр клетки (px)
    poly(c, [x, y - 10, x + 5, y - 4, x + 4, y + 6, x, y + 11, x - 4, y + 6, x - 5, y - 4], retro ? E.B : rgba(P.glass, 0.85));
    poly(c, [x, y - 10, x + 5, y - 4, x + 4, y + 6, x, y + 11], retro ? E.C : 'rgba(255,255,255,0.35)');
    if (!retro) glow(c, x, y, 16, rgba(P.glass, 0.4), 0.6 + Math.sin(t * 3) * 0.2);
  }
  function objects(c, S, retro, P, t) {
    var m = S.M, L = O.logic;
    for (var g = 1; g <= 2; g++) doorA[g] += ((m.open[g] ? 1 : 0) - doorA[g]) * 0.2;
    for (var r = 0; r < ROWS; r++) for (var c0 = 0; c0 < COLS; c0++) {
      var ch = m.t[r * COLS + c0], X = c0 * TS, Y = r * TS, cx = X + TS / 2, cy = Y + TS / 2;
      switch (ch) {
        case 'V': {
          var top = r; while (top > 0 && !L.cellSolid(m, c0, top - 1)) top--;
          c.strokeStyle = retro ? E.l : 'rgba(220,230,255,0.5)'; c.lineWidth = 1; c.beginPath(); c.moveTo(cx, top * TS); c.lineTo(cx + Math.sin(t * 1.3 + c0) * 1.5, cy - 9); c.stroke();
          crystal(c, cx + Math.sin(t * 1.3 + c0) * 1.5, cy, retro, P, t); break;
        }
        case 'C': {
          var k = r * COLS + c0, sh = m.crum[k] != null && m.crum[k] >= 0 ? (Math.random() - 0.5) * 3 : 0;
          poly(c, [X + sh, Y, X + TS + sh, Y, X + TS + sh, Y + 7, X + sh, Y + 9], retro ? E.l : mix(P.rock[2], '#000000', 0.45));
          c.strokeStyle = retro ? E.k : 'rgba(0,0,0,0.55)'; c.lineWidth = 1; c.beginPath(); c.moveTo(X + 5 + sh, Y); c.lineTo(X + 9 + sh, Y + 5); c.lineTo(X + 14 + sh, Y + 2); c.stroke();
          break;
        }
        case 'L': case 'l': {
          var on = m.tog[L.grp(ch)], ang = on ? 0.6 : -0.6;
          poly(c, [X + 4, Y + TS, X + 16, Y + TS, X + 14, Y + TS - 4, X + 6, Y + TS - 4], retro ? E.d : '#4a4560');
          seg(c, cx, Y + TS - 3, cx + Math.sin(ang) * 13, Y + TS - 3 - Math.cos(ang) * 13, 2.4, 1.8, retro ? E.l : '#c8c8d8');
          hex(c, cx + Math.sin(ang) * 13, Y + TS - 3 - Math.cos(ang) * 13, 2.6, 0, on ? (retro ? E.G : '#8cff9a') : (retro ? E.R : '#ff8a6a'));
          break;
        }
        case 'B': case 'b': {
          var on2 = m.tog[L.grp(ch)], wx = L.cellSolid(m, c0 + 1, r) ? X + TS - 3 : L.cellSolid(m, c0 - 1, r) ? X + 3 : cx;
          if (!retro) glow(c, wx, cy, 18, on2 ? 'rgba(140,255,160,0.7)' : 'rgba(255,200,120,0.6)', 0.5 + Math.sin(t * 4) * 0.25);
          hex(c, wx, cy, 5, 0, retro ? E.d : '#3a3550'); hex(c, wx, cy, 3, 0, on2 ? (retro ? E.G : '#8cff9a') : (retro ? E.y : '#ffcf6a'));
          break;
        }
        case 'D': case 'd': {
          var a = doorA[L.grp(ch)], up = r === 0 || m.t[(r - 1) * COLS + c0] !== ch, hgt = TS * (1 - a);
          if (hgt > 0.5) {
            poly(c, [X + 3, Y, X + TS - 3, Y, X + TS - 3, Y + hgt, X + 3, Y + hgt], retro ? E.b : rgba(P.glass, 0.4));
            c.fillStyle = retro ? E.C : rgba(P.glass, 0.9); c.fillRect(X + 5, Y, 2, hgt); c.fillRect(X + 13, Y, 2, hgt);
            if (!up || true) { c.fillStyle = retro ? E.y : rgba(P.acc, 0.85); c.fillRect(X + 3, Y + hgt - 2, TS - 6, 2); }
          }
          break;
        }
        case '/': case 'Z': {
          var d = ch === '/' ? -1 : 1;
          hex(c, cx, cy, 3, 0, retro ? E.d : '#4a4560');
          seg(c, cx - 8, cy - 8 * d, cx + 8, cy + 8 * d, 4, 4, retro ? E.l : '#d9dcf0');
          seg(c, cx - 7, cy - 7 * d - 1.5, cx + 7, cy + 7 * d - 1.5, 1.2, 1.2, retro ? E.w : '#ffffff');
          break;
        }
        case 'X': {
          if (!retro) { var gr = c.createLinearGradient(X, 0, X + TS, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, rgba(P.acc, 0.22 + Math.sin(t * 2) * 0.06)); c.fillStyle = gr; c.fillRect(X, Y, TS, TS); }
          else if ((r + Math.floor(t * 3)) % 2) { c.fillStyle = E.d; c.fillRect(X + TS - 3, Y, 3, TS); }
          break;
        }
        case '*': {
          for (var q = 0; q < 5; q++) poly(c, [X + q * 4, Y + TS, X + q * 4 + 3, Y + TS - 5 - hsh(q, 3) * 6, X + q * 4 + 6, Y + TS], retro ? E.C : rgba(P.glass, 0.7));
          if (Math.sin(t * 5) > 0.2) { if (!retro) glow(c, cx, Y + TS - 6, 14, 'rgba(216,255,106,0.9)'); hex(c, cx, Y + TS - 6, 2, 0, retro ? E.y : '#efffb0'); }
          break;
        }
        case 'O': {
          if (r > 0 && m.t[(r - 1) * COLS + c0] === 'O') break;
          var pulse = 1 + Math.sin(t * 3) * 0.08;
          if (!retro) glow(c, cx, Y + TS, 60 * pulse, 'rgba(255,200,130,0.6)');
          poly(c, [cx, Y - 10, cx + 7 * pulse, Y + 10, cx + 3, Y + 30, cx, Y + 42, cx - 4, Y + 28, cx - 7 * pulse, Y + 8], retro ? E.y : 'rgba(255,236,190,0.95)');
          poly(c, [cx, Y - 2, cx + 3, Y + 12, cx, Y + 34, cx - 3, Y + 12], retro ? E.w : '#ffffff');
          break;
        }
        case 'Q': {
          var pz = 1 + Math.sin(t * 2.2) * 0.06, s2 = 26 * pz;
          if (!retro) { glow(c, cx, cy, 90, 'rgba(255,140,190,0.45)'); glow(c, cx, cy, 40, 'rgba(255,220,240,0.6)'); }
          poly(c, [cx, cy - s2, cx + s2 * 0.7, cy - s2 * 0.2, cx + s2 * 0.45, cy + s2 * 0.8, cx, cy + s2 * 1.1, cx - s2 * 0.45, cy + s2 * 0.8, cx - s2 * 0.7, cy - s2 * 0.2], retro ? E.M : 'rgba(255,170,210,0.9)');
          poly(c, [cx, cy - s2, cx + s2 * 0.7, cy - s2 * 0.2, cx, cy + s2 * 0.3], retro ? E.w : 'rgba(255,255,255,0.55)');
          poly(c, [cx - s2 * 0.7, cy - s2 * 0.2, cx, cy + s2 * 0.3, cx - s2 * 0.45, cy + s2 * 0.8], retro ? E.m : 'rgba(150,40,110,0.45)');
          break;
        }
      }
    }
    // падающие кристаллы
    m.fall.forEach(function (f) { crystal(c, f.c * TS + TS / 2, f.y * TS + TS / 2, retro, P, t); });
    // лучи
    m.beams.forEach(function (pts) {
      if (pts.length < 2) return;
      var tr = function () { c.beginPath(); c.moveTo(pts[0][0] * TS, pts[0][1] * TS); for (var i = 1; i < pts.length; i++) c.lineTo(pts[i][0] * TS, pts[i][1] * TS); };
      if (!retro) { c.globalCompositeOperation = 'lighter'; c.strokeStyle = rgba(P.acc, 0.25); c.lineWidth = 7 + Math.sin(t * 8) * 1.5; tr(); c.stroke(); c.globalCompositeOperation = 'source-over'; }
      c.strokeStyle = retro ? E.y : '#fff6d0'; c.lineWidth = retro ? 4 : 1.6; tr(); c.stroke();
    });
    // приёмники: свет, если горят
    for (var k2 = 0; k2 < m.t.length; k2++) { var ch3 = m.t[k2]; if (ch3 !== 'R' && ch3 !== 'r') continue; var lit = m.lit[L.grp(ch3)], X2 = (k2 % COLS) * TS + TS / 2, Y2 = ((k2 / COLS) | 0) * TS + TS / 2; if (lit && !retro) glow(c, X2, Y2, 24, rgba(P.acc, 0.8)); hex(c, X2, Y2, 3.5, t, lit ? (retro ? E.y : '#fff2b0') : (retro ? E.d : '#4a4560')); }
  }

  // ---------- кадр игры ----------
  var lowCv = null;
  function heroPose(h, S) {
    if (h.dead) return { k: 'dead', t: S.phaseT };
    if (h.chargeT > 0) return { k: 'charge', t: h.chargeT };
    if (h.shield) return { k: 'shield' };
    if (h.pulseT > 0.15) return { k: 'pulse' };
    if (!h.ground) return { k: 'air' };
    if (Math.abs(h.vx) > 0.6) return { k: 'run', ph: h.run * 1.55 };
    return { k: 'stand', t: S.clock };
  }
  function world(g, c, S, ui, retro) {
    var P = PAL[retro ? 'r' : 'm'][S.ch], L = O.logic, t = S.clock, h = S.hero, LK = LOOK[retro ? 'r' : 'm'];
    var lay = staticLayer(S, retro); if (lay) c.drawImage(lay, 0, 0);
    objects(c, S, retro, P, t);
    // Стеклодувы (живые и осколки погибших)
    S.guards.forEach(function (gd) {
      if (gd.alive) glassblower(c, gd.x * TS, gd.y * TS, 1, gd.face, gd.st, gd.st === 'wind' ? gd.t : t, retro);
      else if (gd.t < 6) { for (var i = 0; i < 7; i++) { var fx = gd.x * TS + (hsh(gd.id, i) - 0.5) * 22 * Math.min(1, gd.t * 3), fy = gd.y * TS - 2 - hsh(i, gd.id) * 4; poly(c, [fx, fy, fx + 3, fy - 4, fx + 5, fy], retro ? E.C : 'rgba(190,210,255,' + Math.max(0, 0.8 - gd.t * 0.12) + ')'); } }
    });
    S.lurkers.forEach(function (l) { if (l.alive) shadowFig(c, l.x * TS, l.y * TS, 1, l.face, l.st, t + l.id, retro); });
    // осколки-снаряды
    S.shards.forEach(function (s) { var X = s.x * TS, Y = s.y * TS; c.save(); c.translate(X, Y); c.rotate(t * 20); poly(c, [-4, 0, 0, -2, 4, 0, 0, 2], s.fr ? LK.shardF : LK.shard); c.restore(); if (!retro) glow(c, X, Y, 10, s.fr ? 'rgba(255,211,106,0.6)' : 'rgba(191,244,255,0.6)'); });
    // Вера
    var hx = h.x * TS, hy = h.y * TS;
    if (h.chargeT > 0 && !retro) glow(c, hx + h.face * 6, hy - 20, 14 + Math.min(1, h.chargeT / L.K.CHARGE_T) * 18, 'rgba(143,246,255,0.7)');
    var hand = vera(c, hx, hy, 1, h.face, heroPose(h, S), retro);
    if (h.chargeT > 0) {   // кольцо заряда
      var q = Math.min(1, h.chargeT / L.K.CHARGE_T); c.strokeStyle = q >= 1 ? (retro ? E.w : '#ffffff') : (retro ? E.C : 'rgba(143,246,255,0.8)'); c.lineWidth = 1.6;
      c.beginPath(); c.arc(hx, hy - 17, 22 - q * 8, -Math.PI / 2, -Math.PI / 2 + q * Math.PI * 2); c.stroke();
    }
    if (h.shield) {
      var en = h.energy / L.K.EN_MAX, sx = hx + h.face * 13, sy = hy - 19;
      if (!retro) glow(c, sx, sy, 26, 'rgba(143,246,255,0.5)');
      c.globalAlpha = 0.35 + en * 0.45; hex(c, sx, sy, 15, Math.PI / 6 + Math.sin(t * 9) * 0.04, retro ? E.C : 'rgba(170,250,255,0.5)', 1.15); c.globalAlpha = 1;
      c.strokeStyle = retro ? E.w : 'rgba(230,255,255,0.9)'; c.lineWidth = 1.2; hex(c, sx, sy, 15, Math.PI / 6, null, 1.15); c.stroke();
    }
    if (h.pulseT > 0) {
      var pq = 1 - h.pulseT / 0.35, pr = 8 + pq * L.K.PULSE_R * TS;
      c.strokeStyle = retro ? E.C : 'rgba(170,250,255,' + (1 - pq) + ')'; c.lineWidth = retro ? 2 : 2.5;
      c.beginPath(); var a0 = h.face > 0 ? -Math.PI / 2 - 0.15 : Math.PI / 2 - 0.15; c.arc(hx + h.face * 5, hy - 20, pr, a0, a0 + Math.PI + 0.3); c.stroke();
    }
    if (h.breachT > 0) {
      var bq = 1 - h.breachT / 0.5, bx = hx + h.face * (10 + bq * L.K.BREACH_R * TS);
      c.globalAlpha = 1 - bq; poly(c, [bx, hy - 40, bx + h.face * 10, hy - 20, bx, hy, bx - h.face * 4, hy - 20], retro ? E.w : 'rgba(220,255,255,0.9)'); c.globalAlpha = 1;
    }
    // дрон
    var d = S.drone;
    if (d.have) drone(c, d.x * TS, d.y * TS, 1, t, retro, d.st === 'hover' ? 1.4 : 1);
    // Тень-ловец погони
    if (S.chase && S.chase.t > S.chase.delay - 0.3) {
      var ca = Math.min(1, (S.chase.t - S.chase.delay + 0.3) / 0.5);
      c.globalAlpha = ca; shadowFig(c, S.chase.x * TS, S.chase.y * TS, 1.1, 1, 'hunt', t, retro, true); c.globalAlpha = 1;
      if (!retro) { var sg = c.createLinearGradient(0, 0, Math.max(10, S.chase.x * TS), 0); sg.addColorStop(0, 'rgba(5,2,10,0.85)'); sg.addColorStop(1, 'rgba(5,2,10,0)'); c.fillStyle = sg; c.fillRect(0, 0, Math.max(10, S.chase.x * TS), VH); }
      else { c.fillStyle = E.k; c.fillRect(0, 0, Math.max(0, S.chase.x * TS - 14), VH); }
    }
    // темнота
    if (S.def.dark) darkness(c, S, retro);
    else if (!retro) { var vg = c.createRadialGradient(VW / 2, VH / 2, VH * 0.35, VW / 2, VH / 2, VH * 0.95); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.45)'); c.fillStyle = vg; c.fillRect(0, 0, VW, VH); }
    // прицел дрона
    if (ui.aim) {
      var ax = ui.aim.x * TS, ay = ui.aim.y * TS;
      c.setLineDash([3, 4]); c.strokeStyle = retro ? E.G : 'rgba(216,255,106,0.8)'; c.lineWidth = 1; c.beginPath(); c.moveTo(d.x * TS, d.y * TS); c.lineTo(ax, ay); c.stroke(); c.setLineDash([]);
      c.strokeStyle = retro ? E.y : '#efffb0'; c.lineWidth = 1.5; c.beginPath(); c.arc(ax, ay, 7 + Math.sin(t * 8), 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.moveTo(ax - 11, ay); c.lineTo(ax - 4, ay); c.moveTo(ax + 4, ay); c.lineTo(ax + 11, ay); c.moveTo(ax, ay - 11); c.lineTo(ax, ay - 4); c.moveTo(ax, ay + 4); c.lineTo(ax, ay + 11); c.stroke();
    }
  }
  var darkCv = null;
  function darkness(c, S, retro) {
    if (typeof document === 'undefined') return;
    var w = retro ? VW / 2 : VW, hgt = retro ? VH / 2 : VH, sc = retro ? 0.5 : 1;
    darkCv = darkCv || document.createElement('canvas'); if (darkCv.width !== w) { darkCv.width = w; darkCv.height = hgt; }
    var d = darkCv.getContext('2d'), h = S.hero, K = O.logic.K, dr = S.drone;
    d.globalCompositeOperation = 'source-over'; d.clearRect(0, 0, w, hgt); d.fillStyle = retro ? '#000000' : 'rgba(2,3,8,0.94)'; d.fillRect(0, 0, w, hgt);
    d.globalCompositeOperation = 'destination-out';
    var hole = function (x, y, r) {
      x *= sc; y *= sc; r *= sc;
      if (retro) { d.fillStyle = 'rgba(0,0,0,0.5)'; d.beginPath(); d.arc(x, y, r * 1.2, 0, Math.PI * 2); d.fill(); d.fillStyle = '#000'; d.beginPath(); d.arc(x, y, r * 0.85, 0, Math.PI * 2); d.fill(); }
      else { var gr = d.createRadialGradient(x, y, r * 0.2, x, y, r); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.7, 'rgba(0,0,0,0.75)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); d.fillStyle = gr; d.beginPath(); d.arc(x, y, r, 0, Math.PI * 2); d.fill(); }
    };
    hole(h.x * TS, (h.y - 1) * TS, K.LIGHT_V * TS * (1 + Math.sin(S.clock * 2) * 0.03));
    if (dr.have) hole(dr.x * TS, dr.y * TS, K.LIGHT_D * TS * (dr.st === 'hover' ? 1.1 : 1));
    S.M.beams.forEach(function (pts) { pts.forEach(function (p) { hole(p[0] * TS, p[1] * TS, 1.2 * TS); }); });
    S.lurkers.forEach(function (l) { if (l.alive) hole(l.x * TS + 3, (l.y - 1.55) * TS, 0.5 * TS); });   // глаза Теней видны во тьме
    c.drawImage(darkCv, 0, 0, VW, VH);
  }

  function draw(g, ctx, S, ui) {
    var retro = g.themeName === 'retro', c = ctx;
    if (retro) {
      if (typeof document !== 'undefined') { lowCv = lowCv || document.createElement('canvas'); lowCv.width = VW / 2; lowCv.height = VH / 2; c = lowCv.getContext('2d'); c.save(); c.scale(0.5, 0.5); }
    }
    c.save();
    if (ui.shake) c.translate((Math.random() - 0.5) * ui.shake, (Math.random() - 0.5) * ui.shake);
    if (S.phase === 'cut' && S.cut) cut(c, S.cut.id, S.cut.t, retro);
    else if (S.M) world(g, c, S, ui, retro);
    c.restore();
    if (retro && c !== ctx) { c.restore(); ctx.imageSmoothingEnabled = false; ctx.drawImage(lowCv, 0, 0, VW, VH); ctx.imageSmoothingEnabled = true; }
    // затемнения: смерть, вход на экран
    if (S.phase === 'dead') { var q = Math.min(1, S.phaseT / O.logic.K.DEAD_T); ctx.fillStyle = 'rgba(0,0,0,' + Math.max(0, q * 1.3 - 0.3) + ')'; ctx.fillRect(0, 0, VW, VH); if (S.phaseT < 0.15) { ctx.fillStyle = retro ? 'rgba(170,0,0,0.5)' : 'rgba(255,90,90,0.25)'; ctx.fillRect(0, 0, VW, VH); } }
    if (S.phase === 'play' && S.enterT < 0.35 && !(S.chase && S.chase.delay === 0)) { ctx.fillStyle = 'rgba(0,0,0,' + (1 - S.enterT / 0.35) + ')'; ctx.fillRect(0, 0, VW, VH); }
    if (S.phase === 'cut' && S.cut) { var ct = S.cut.t, cd = S.cut.dur, fa = ct < 0.5 ? 1 - ct / 0.5 : ct > cd - 0.5 ? (ct - (cd - 0.5)) / 0.5 : 0; if (fa > 0) { ctx.fillStyle = 'rgba(0,0,0,' + fa + ')'; ctx.fillRect(0, 0, VW, VH); } }
    hud(g, ctx, S, ui, retro);
  }
  function hud(g, c, S, ui, retro) {
    var th = g.th(), h = S.hero, K = O.logic.K;
    if (S.phase === 'cut') { if (S.cut && S.cut.t > 1) g.text(g.t('skip'), VW - 10, VH - 10, { size: 10, align: 'right', color: retro ? E.d : 'rgba(255,255,255,0.35)', weight: 600 }); return; }
    if (!h) return;
    // заряд щита — только когда тратится
    if (h.energy < K.EN_MAX - 0.01 || h.shield) {
      for (var i = 0; i < 6; i++) { var full = h.energy / K.EN_MAX * 6 > i + 0.5; hex(c, 18 + i * 13, VH - 16, 5, Math.PI / 6, full ? (retro ? E.C : 'rgba(143,246,255,0.9)') : (retro ? E.d : 'rgba(255,255,255,0.15)')); }
    }
    if (ui.banner) {
      var a = Math.min(1, ui.banner.a / 0.6, (ui.banner.life - ui.banner.a) / 0.4 + 0.01);
      c.globalAlpha = Math.max(0, a);
      g.text(ui.banner.title, 18, 30, { size: ui.banner.big ? 20 : 13, color: th.accent, weight: 800 });
      if (ui.banner.sub) g.text(ui.banner.sub, 18, ui.banner.big ? 50 : 46, { size: 11, color: th.muted, weight: 600 });
      c.globalAlpha = 1;
    }
    if (ui.hint) {
      var ha = Math.min(1, ui.hint.a / 0.5); c.globalAlpha = ha;
      c.font = '700 12px ' + th.font; var w = c.measureText(ui.hint.text).width + 24;
      c.fillStyle = retro ? '#000000' : 'rgba(8,10,20,0.72)'; c.fillRect(VW / 2 - w / 2, VH - 34, w, 22);
      if (retro) { c.fillStyle = E.c; c.fillRect(VW / 2 - w / 2, VH - 34, w, 1); }
      g.text(ui.hint.text, VW / 2, VH - 19, { size: 12, align: 'center', color: th.ink, weight: 700 });
      c.globalAlpha = 1;
    }
    if (ui.aim) g.text(g.t('aim'), VW / 2, 20, { size: 11, align: 'center', color: retro ? E.G : '#d8ff6a', weight: 700 });
  }

  // ---------- кат-сцены (движком, без слов) ----------
  function ease(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }
  function lerp(a, b, x) { return a + (b - a) * ease(x); }
  function workshop(c, retro, glowQ, t) {   // мастерская «Гефест»: стеллажи, верстак, Звёздный Горн
    if (retro) { c.fillStyle = E.k; c.fillRect(0, 0, VW, VH); c.fillStyle = E.n; c.fillRect(0, 300, VW, 60); }
    else { var gr = c.createLinearGradient(0, 0, 0, VH); gr.addColorStop(0, '#120d0a'); gr.addColorStop(1, '#2a1c14'); c.fillStyle = gr; c.fillRect(0, 0, VW, VH); poly(c, [0, 300, VW, 300, VW, VH, 0, VH], '#3a2618'); }
    for (var i = 0; i < 4; i++) { poly(c, [30 + i * 40, 120, 60 + i * 40, 120, 60 + i * 40, 300, 30 + i * 40, 300], retro ? E.d : '#24170f'); c.fillStyle = retro ? E.n : '#5a3d24'; c.fillRect(24, 150 + i * 36, 180, 4); }
    poly(c, [470, 300, 600, 300, 600, 250, 470, 250], retro ? E.n : '#4a3020'); poly(c, [480, 250, 520, 250, 515, 230, 485, 230], retro ? E.d : '#2e2e38');
    // Горн: кольцо на постаменте
    var cx = 320, cy = 170;
    poly(c, [280, 300, 360, 300, 345, 250, 295, 250], retro ? E.d : '#2b2a33');
    for (var k = 0; k < 8; k++) { var a = k * Math.PI / 4 + t * 0.2; seg(c, cx + Math.cos(a) * 64, cy + Math.sin(a) * 64, cx + Math.cos(a + Math.PI / 4) * 64, cy + Math.sin(a + Math.PI / 4) * 64, 12, 12, retro ? (k % 2 ? E.n : E.y) : (k % 2 ? '#8a5a2a' : '#c48a3a')); }
    if (!retro) { glow(c, cx, cy, 60 + glowQ * 200, 'rgba(255,190,110,' + (0.3 + glowQ * 0.5) + ')'); }
    hex(c, cx, cy, 10 + glowQ * 26, t, retro ? (glowQ > 0.5 ? E.w : E.y) : 'rgba(255,240,200,' + (0.6 + glowQ * 0.4) + ')');
  }
  function city(c, retro, warm, t) {
    var P = PAL[retro ? 'r' : 'm'][warm > 0.5 ? 5 : 2];
    sky(c, P, retro, 11, VW, VH, 2);
    for (var i = 0; i < 12; i++) { var x = i * 56 + 10, hgt = 120 + hsh(i, 4) * 150; poly(c, [x, VH, x, VH - hgt + 24, x + 22, VH - hgt, x + 44, VH - hgt + 24, x + 44, VH], retro ? (i % 2 ? E.b : E.c) : rgba(P.glass, 0.18 + hsh(i, 2) * 0.12)); }
  }
  var CUT = {
    c1: function (c, t, R) {
      if (t < 5) {
        var q = ease(t / 3.5); workshop(c, R, q, t);
        var arm = t > 1.2 && t < 2.4 ? 'reach' : 'stand';
        vera(c, 190, 300, 2.2, 1, { k: arm, t: t, tilt: t > 2.6 ? -2 : 0 }, R);
        if (t > 3) { c.strokeStyle = R ? E.w : 'rgba(255,255,255,0.9)'; c.lineWidth = 2; for (var i = 0; i < 9; i++) { var a = i * 0.7 + 0.3, L = (t - 3) * 90 * (0.6 + hsh(i, 1) * 0.6); c.beginPath(); c.moveTo(320, 170); c.lineTo(320 + Math.cos(a) * L * 0.5 + hsh(i, 2) * 10, 170 + Math.sin(a) * L * 0.5); c.lineTo(320 + Math.cos(a) * L, 170 + Math.sin(a) * L); c.stroke(); } }
        if (t > 4.2) { c.fillStyle = 'rgba(255,255,255,' + ease((t - 4.2) / 0.8) + ')'; c.fillRect(0, 0, VW, VH); }
      } else if (t < 6.5) {
        c.fillStyle = R ? E.w : '#fff8ec'; c.fillRect(0, 0, VW, VH);
        var s = lerp(2.2, 0.4, (t - 5) / 1.5); c.save(); c.translate(320, 200); c.rotate((t - 5) * 2); vera(c, 0, 20 * s, s, 1, { k: 'air' }, R); c.restore();
      } else {
        var u = (t - 6.5) / 3.5, P = PAL[R ? 'r' : 'm'][1];
        sky(c, P, R, 5, VW, VH, 1);
        for (var k = 0; k < 26; k++) { var sx = hsh(k, 7) * VW, sy = (hsh(7, k) * VH * 1.4 - (t - 6.5) * (80 + hsh(k, k) * 140)) % (VH * 1.4); if (sy < -20) sy += VH * 1.4; poly(c, [sx, sy, sx + 4, sy - 9, sx + 7, sy + 2], R ? E.C : 'rgba(180,230,255,0.6)'); }
        c.save(); c.translate(320 + Math.sin(t) * 30, lerp(40, 250, u)); c.rotate(t * 1.4); vera(c, 0, 16, 1.4, 1, { k: 'air' }, R); c.restore();
        if (u > 0.5) { var q2 = ease((u - 0.5) * 2); for (var j = 0; j < 9; j++) { var bx = j * 74, bh = 60 + hsh(j, 8) * 100; poly(c, [bx, VH + 120 - q2 * 120, bx + 30, VH - bh + 120 - q2 * 120, bx + 60, VH + 120 - q2 * 120], R ? E.c : 'rgba(150,220,255,0.45)'); } }
        if (t < 6.9) { c.fillStyle = 'rgba(255,255,255,' + (1 - (t - 6.5) / 0.4) + ')'; c.fillRect(0, 0, VW, VH); }
      }
    },
    drone: function (c, t, R) {
      var P = PAL[R ? 'r' : 'm'][1]; c.fillStyle = R ? E.k : '#06070e'; c.fillRect(0, 0, VW, VH);
      if (!R) glow(c, 330, 280, 200, 'rgba(216,255,106,' + Math.min(0.35, t * 0.2) + ')');
      poly(c, [0, 300, VW, 300, VW, VH, 0, VH], R ? E.b : '#141a2a');
      for (var q = 0; q < 9; q++) poly(c, [300 + q * 10, 300, 306 + q * 10, 276 - hsh(q, 1) * 18, 312 + q * 10, 300], R ? E.C : rgba(P.glass, 0.6));
      var st = t > 3 ? 'stand' : 'kneel';
      vera(c, 250, 300, 2.4, 1, { k: st, t: t, tilt: t > 1.3 ? -3 : 1 }, R);
      var dx, dy;
      if (t < 1.2) { dx = 340; dy = 285; if (Math.sin(t * 12) > 0) drone(c, dx, dy, 1.5, t, R, 0.6); }
      else if (t < 3) { var a = (t - 1.2) * 4; dx = 270 + Math.cos(a) * 60; dy = 200 + Math.sin(a) * 26 - (t - 1.2) * 10; drone(c, dx, dy, 2.2, t, R, 1.4); }
      else { dx = lerp(270 + Math.cos(7.2) * 60, 225, (t - 3) / 0.7); dy = lerp(200 + Math.sin(7.2) * 26 - 18, 190, (t - 3) / 0.7); drone(c, dx, dy, 2.2, t, R, 1.2); }
    },
    c2: function (c, t, R) {
      city(c, R, 0, t);
      poly(c, [0, 270, VW, 250, VW, 262, 0, 282], R ? E.l : 'rgba(200,240,255,0.75)');
      var gx = lerp(560, 380, t / 5.5); glassblower(c, gx, 238, 1.4, -1, 'patrol', t, R, R ? 1 : 0.7);
      var bx = gx - 30, by = 190 - t * 12; if (!R) glow(c, bx, by, 18, 'rgba(255,230,170,0.6)'); hex(c, bx, by, 5 + Math.sin(t * 3), t, R ? E.y : 'rgba(255,240,200,0.8)');
      vera(c, lerp(60, 230, t / 5.5), 274 - lerp(60, 230, t / 5.5) * 0.03, 1.8, 1, { k: 'run', ph: t * 7 }, R);
      drone(c, lerp(60, 230, t / 5.5) - 18, 220, 1.6, t, R);
    },
    c3: function (c, t, R) {
      var P = PAL[R ? 'r' : 'm'][3]; sky(c, P, R, 21, VW, VH, 3);
      poly(c, [280, VH, 290, 60, 320, 20, 350, 60, 360, VH], R ? E.b : '#2c2a58'); poly(c, [320, VH, 320, 20, 350, 60, 360, VH], R ? E.B : 'rgba(200,190,255,0.25)');
      var bq = ease((t - 0.8) / 1.2); c.strokeStyle = R ? E.y : 'rgba(255,246,208,0.95)'; c.lineWidth = R ? 3 : 4 * bq; c.beginPath(); c.moveTo(320, 20); c.lineTo(320, 20 - bq * 40); c.lineTo(320 + bq * 400, -400 * bq); c.stroke();
      if (!R) glow(c, 320, 20, 80 * bq, 'rgba(255,240,200,0.6)');
      vera(c, 230, 330, 2, 1, { k: 'stand', t: t, tilt: -4 }, R);
      var dy = t < 2 ? 260 : t < 4 ? lerp(260, 60, (t - 2) / 1.2) : lerp(60, 260, (t - 4) / 1.2);
      drone(c, 300, dy, 1.8, t, R);
      poly(c, [0, 330, VW, 330, VW, VH, 0, VH], R ? E.d : '#1b1a33');
    },
    c4: function (c, t, R) {
      var P = PAL[R ? 'r' : 'm'][4]; c.fillStyle = R ? E.k : '#05060c'; c.fillRect(0, 0, VW, VH);
      poly(c, [0, 300, VW, 300, VW, VH, 0, VH], R ? E.d : '#141826');
      for (var i = 0; i < 5; i++) { var lx = 80 + i * 120, on = t < 1 + i * 0.35; if (on) { if (!R) glow(c, lx, 120, 70, 'rgba(160,190,255,0.5)'); hex(c, lx, 120, 6, 0, R ? E.B : '#b8c8ff'); } else hex(c, lx, 120, 6, 0, R ? E.d : '#1c2238'); }
      vera(c, 300, 300, 2, 1, { k: 'stand', t: t, tilt: 2 }, R);
      var br = t > 3.2 ? 1.6 : 0.8; drone(c, 270, 220, 2, t, R, br);
      if (!R && t > 3.2) glow(c, 280, 240, 160, 'rgba(216,255,106,0.25)');
      for (var k = 0; k < 6; k++) if (t > 2 + k * 0.25) { var ex = (k % 2 ? 520 : 70) + hsh(k, 1) * 80, ey = 200 + hsh(1, k) * 80, a = t > 3.4 ? Math.max(0, 1 - (t - 3.4) * 1.2) : 1; c.globalAlpha = a; poly(c, [ex, ey, ex + 6, ey - 1, ex + 6, ey + 1], LOOK.m.eye); poly(c, [ex + 9, ey - 1, ex + 14, ey - 2, ex + 14, ey], LOOK.m.eye); c.globalAlpha = 1; }
    },
    c5: function (c, t, R) {
      var P = PAL[R ? 'r' : 'm'][5]; sky(c, P, R, 31, VW, VH, 5);
      var pz = 1 + Math.sin(t * 2.2) * 0.06, s = 60 * pz, cx = 260, cy = 120;
      if (!R) glow(c, cx, cy, 200, 'rgba(255,140,190,0.4)');
      poly(c, [cx, cy - s, cx + s * 0.7, cy - s * 0.2, cx + s * 0.45, cy + s * 0.8, cx, cy + s * 1.1, cx - s * 0.45, cy + s * 0.8, cx - s * 0.7, cy - s * 0.2], R ? E.M : 'rgba(255,170,210,0.9)');
      poly(c, [cx, cy - s, cx + s * 0.7, cy - s * 0.2, cx, cy + s * 0.3], R ? E.w : 'rgba(255,255,255,0.55)');
      var rx = 540; if (!R) glow(c, rx, 240, 120, 'rgba(255,200,130,0.6)');
      poly(c, [rx, 150, rx + 16, 210, rx + 6, 270, rx, 310, rx - 8, 260, rx - 15, 200], R ? E.y : 'rgba(255,236,190,0.95)');
      poly(c, [0, 310, VW, 310, VW, VH, 0, VH], R ? E.r : '#3a1c44');
      var look = t < 2 ? -6 : t < 4 ? 0 : -6;
      vera(c, 400, 310, 2, t < 2 || t > 4 ? -1 : 1, { k: 'stand', t: t, tilt: look }, R);
      drone(c, t > 4 ? lerp(370, 330, (t - 4) / 1.5) : 375, t > 4 ? lerp(240, 200, (t - 4) / 1.5) : 240, 1.8, t, R, 1.2);
    },
    endA: function (c, t, R) {
      if (t < 4) {
        CUT.c5bg(c, t, R);
        var vx = lerp(400, 540, (t - 0.5) / 2.8); vera(c, vx, 310, 2, 1, { k: 'run', ph: t * 6 }, R);
        drone(c, vx - 30, 240, 1.8, t, R);
        if (t > 3) { c.fillStyle = 'rgba(255,248,236,' + ease((t - 3) / 1) + ')'; c.fillRect(0, 0, VW, VH); }
      } else {
        workshop(c, R, Math.max(0, 0.5 - (t - 4) * 0.2), t);
        vera(c, 400, 300, 2.2, -1, { k: t > 6 ? 'reach' : 'stand', t: t, tilt: -2 }, R);
        var a = (t - 4) * 2.5, dx = t > 6.5 ? lerp(420 + Math.cos(a) * 50, 360, (t - 6.5) / 1) : 420 + Math.cos(a) * 50, dy = t > 6.5 ? lerp(200 + Math.sin(a) * 30, 215, (t - 6.5) / 1) : 200 + Math.sin(a) * 30;
        drone(c, dx, dy, 2, t, R, 1.3);
        if (t < 4.6) { c.fillStyle = 'rgba(255,248,236,' + (1 - (t - 4) / 0.6) + ')'; c.fillRect(0, 0, VW, VH); }
      }
    },
    endB: function (c, t, R) {
      if (t < 6) {
        var warm = ease((t - 2.2) / 2);
        CUT.c5bg(c, t, R, warm);
        var dx = t < 1 ? 375 : lerp(375, 260, (t - 1) / 1.2), dy = t < 1 ? 240 : lerp(240, 120, (t - 1) / 1.2);
        if (t < 2.3) drone(c, dx, dy, 1.8, t, R, 1.5);
        if (t > 2.2) { var wq = ease((t - 2.2) / 2.5); c.strokeStyle = R ? E.y : 'rgba(255,230,200,' + (1 - wq) + ')'; c.lineWidth = 6; c.beginPath(); c.arc(260, 120, wq * 700, 0, Math.PI * 2); c.stroke(); }
        for (var i = 0; i < 3; i++) glassblower(c, 60 + i * 70, 310, 1.6, 1, t > 3.5 ? 'look' : 'patrol', t, R, 0.9);
        var vx = t < 4 ? 400 : lerp(400, 540, (t - 4) / 1.8); vera(c, vx, 310, 2, t < 0.9 ? -1 : 1, { k: t < 0.9 ? 'reach' : t < 4 ? 'stand' : 'run', ph: t * 6, t: t, tilt: t < 3 ? -5 : 0 }, R);
        if (t > 5.2) { c.fillStyle = 'rgba(255,248,236,' + ease((t - 5.2) / 0.8) + ')'; c.fillRect(0, 0, VW, VH); }
      } else {
        workshop(c, R, 0.15, t);
        vera(c, 400, 300, 2.2, -1, { k: 'stand', t: t, tilt: -3 }, R);
        if (t > 7) { var u = t - 7; var sx = 320 + Math.cos(u * 3) * 40 * Math.min(1, u), sy = 170 + Math.sin(u * 3) * 22 * Math.min(1, u) - u * 6; if (!R) glow(c, sx, sy, 22, 'rgba(216,255,106,0.8)'); hex(c, sx, sy, 2.2, 0, R ? E.y : '#efffb0'); }
        if (t < 6.6) { c.fillStyle = 'rgba(255,248,236,' + (1 - (t - 6) / 0.6) + ')'; c.fillRect(0, 0, VW, VH); }
      }
    },
    c5bg: function (c, t, R, warm) {
      var P = PAL[R ? 'r' : 'm'][warm > 0.5 ? 1 : 5]; sky(c, P, R, 31, VW, VH, 5);
      var pz = 1 + Math.sin(t * 2.2) * 0.06 + (warm || 0) * 0.3, s = 60 * pz, cx = 260, cy = 120;
      if (!R) glow(c, cx, cy, 200 + (warm || 0) * 200, 'rgba(255,170,200,0.45)');
      poly(c, [cx, cy - s, cx + s * 0.7, cy - s * 0.2, cx + s * 0.45, cy + s * 0.8, cx, cy + s * 1.1, cx - s * 0.45, cy + s * 0.8, cx - s * 0.7, cy - s * 0.2], R ? E.M : (warm > 0.5 ? 'rgba(255,220,180,0.95)' : 'rgba(255,170,210,0.9)'));
      var rx = 540, rs = warm > 0.5 ? 1 - (warm - 0.5) : 1; if (!R) glow(c, rx, 240, 120 * rs, 'rgba(255,200,130,0.6)');
      poly(c, [rx, 240 - 90 * rs, rx + 16 * rs, 240 - 30 * rs, rx + 6, 240 + 30 * rs, rx, 240 + 70 * rs, rx - 8, 240 + 20 * rs, rx - 15 * rs, 240 - 40 * rs], R ? E.y : 'rgba(255,236,190,0.95)');
      poly(c, [0, 310, VW, 310, VW, VH, 0, VH], R ? (warm > 0.5 ? E.n : E.r) : (warm > 0.5 ? '#6a3a2c' : '#3a1c44'));
    }
  };
  function cut(c, id, t, retro) { c.fillStyle = '#000'; c.fillRect(0, 0, VW, VH); var f = CUT[id]; if (f) f(c, t, retro); }

  // титул: застывший город, Вера и светляк
  function titleArt(c, retro, t) {
    var P = PAL[retro ? 'r' : 'm'][2];
    sky(c, P, retro, 17, VW, VH, 2);
    poly(c, [0, 300, 200, 292, 440, 300, VW, 290, VW, VH, 0, VH], retro ? E.b : '#12253a');
    poly(c, [0, 300, 200, 292, 440, 300, VW, 290, VW, 294, 0, 304], retro ? E.C : 'rgba(127,196,224,0.8)');
    vera(c, 120, 297, 2.4, 1, { k: 'stand', t: t, tilt: -2 }, retro);
    drone(c, 160 + Math.sin(t * 1.5) * 8, 200 + Math.sin(t * 2.3) * 6, 2, t, retro, 1.3);
    glassblower(c, 560, 292, 2, -1, 'patrol', t, retro, retro ? 1 : 0.8);
  }
  O.R = { VW: VW, VH: VH, TS: TS, E: E, PAL: PAL, LOOK: LOOK, draw: draw, cut: cut, CUT: CUT, vera: vera, drone: drone, glassblower: glassblower, shadowFig: shadowFig, titleArt: titleArt, poly: poly, hex: hex, glow: glow, staticLayer: staticLayer };
})(typeof window !== 'undefined' ? window : globalThis);
