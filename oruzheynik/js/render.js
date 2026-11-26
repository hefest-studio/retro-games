/* МОЛОТОБОЙ · рендер обеих тем. ORUZH.render(g, ctx, S, ui).
   modern — мягкие градиенты, свечение, векторные фигуры в полном разрешении;
   retro — тот же кадр рисуется в буфер половинного разрешения плоскими цветами (без градиентов и теней)
   и растягивается без сглаживания: крупный «пиксель», ограниченная палитра.
   Облик героя: подмастерье с молотом — тёмные волосы под красной повязкой, холщовая рубаха, стальной фартук
   (без шарфа, очков и наруча); в кувырке — вертящийся клубок. Отбитые снаряды — яркие ядра со следом. */
(function (global) {
  'use strict';
  var OZ = global.ORUZH = global.ORUZH || {};
  var TS = 24, HUD = 24, VW = 26, W = 624, H = 360;
  var LT = OZ.levelTiles;

  // ---------- палитры этапов ----------
  // sky — фон (верх/низ), far — силуэты дальнего плана, t/hi/lo — блоки, acc — акцент цеха, spk — шипы
  var PM = [
    { sky: ['#2a1410', '#100604'], far: '#3a1d14', t: '#6b4a3a', hi: '#a77356', lo: '#3d281f', acc: '#ff7a2a', spk: '#c9c2bb', style: 'brick' },
    { sky: ['#221d10', '#0e0c06'], far: '#352d17', t: '#776739', hi: '#bea25a', lo: '#41381e', acc: '#f0c75a', style: 'plate' },
    { sky: ['#1b1729', '#0a0913'], far: '#2a2540', t: '#524b72', hi: '#8a82b8', lo: '#2c2842', acc: '#c46cff', style: 'stripe' },
    { sky: ['#2e1808', '#120802'], far: '#45240e', t: '#764424', hi: '#b46c3e', lo: '#422513', acc: '#ffa63d', style: 'brick' },
    { sky: ['#0f2430', '#061017'], far: '#183747', t: '#3f6c80', hi: '#8fc7da', lo: '#24414e', acc: '#a6ecff', spk: '#e8fbff', style: 'ice' },
    { sky: ['#12230f', '#060f05'], far: '#1c3618', t: '#466e3c', hi: '#7cb268', lo: '#27401f', acc: '#a6ff6e', style: 'moss' },
    { sky: ['#0f1e22', '#050d0f'], far: '#163036', t: '#3a5c61', hi: '#68a1a8', lo: '#203538', acc: '#ffe14a', style: 'circuit' },
    { sky: ['#241b13', '#0e0a06'], far: '#3a2a1b', t: '#7c5b3a', hi: '#bf8c55', lo: '#45321f', acc: '#ffd27f', style: 'plate' },
    { sky: ['#190d0d', '#070303'], far: '#2a1515', t: '#3d3438', hi: '#6a5a61', lo: '#211b1e', acc: '#ff4a3d', style: 'iron' },
    { sky: ['#230909', '#0a0202'], far: '#3a1010', t: '#43302f', hi: '#7a5050', lo: '#241818', acc: '#ff7a3d', style: 'iron' }
  ];
  // retro: та же логика, плоские «восьмибитные» цвета
  var PR = [
    { sky: ['#200800', '#200800'], far: '#401800', t: '#884400', hi: '#cc7744', lo: '#442200', acc: '#ff8800', spk: '#cccccc', style: 'brick' },
    { sky: ['#181400', '#181400'], far: '#383000', t: '#887700', hi: '#ddcc44', lo: '#443c00', acc: '#ffdd00', style: 'plate' },
    { sky: ['#100c24', '#100c24'], far: '#241c48', t: '#5544aa', hi: '#9988ee', lo: '#2a2255', acc: '#cc66ff', style: 'stripe' },
    { sky: ['#281000', '#281000'], far: '#502000', t: '#994411', hi: '#ee8844', lo: '#4c2208', acc: '#ffaa00', style: 'brick' },
    { sky: ['#002030', '#002030'], far: '#003850', t: '#227799', hi: '#88ddff', lo: '#114455', acc: '#aaffff', spk: '#ffffff', style: 'ice' },
    { sky: ['#001c00', '#001c00'], far: '#003300', t: '#337722', hi: '#77cc44', lo: '#1a3c11', acc: '#aaff55', style: 'moss' },
    { sky: ['#001818', '#001818'], far: '#003030', t: '#226666', hi: '#55aaaa', lo: '#113333', acc: '#ffff55', style: 'circuit' },
    { sky: ['#201400', '#201400'], far: '#3c2800', t: '#886633', hi: '#ddaa55', lo: '#443318', acc: '#ffcc66', style: 'plate' },
    { sky: ['#140000', '#140000'], far: '#2c0808', t: '#444040', hi: '#777070', lo: '#222020', acc: '#ff3333', style: 'iron' },
    { sky: ['#1c0000', '#1c0000'], far: '#3c0c0c', t: '#553333', hi: '#886060', lo: '#2a1818', acc: '#ff6633', style: 'iron' }
  ];
  // облик героя: подмастерье с молотом — тёмные волосы под красной повязкой, холщовая рубаха, стальной фартук (без шарфа, очков и наруча)
  var HERO = {
    m: { hair: '#2a2230', hairD: '#15111b', skin: '#e8b894', tunic: '#d9cdb4', tunicD: '#a99d86', apron: '#78818a', apronD: '#4b5159', belt: '#3b2513', band: '#d6452c', bandD: '#8f2a18',
      pants: '#5a4636', boots: '#2b1d12', brass: '#d98a3a', brassD: '#8f5a1e', shaft: '#8a5a2b', head: '#b9c0c8', headD: '#6f7882', glow: '#ffb347' },
    r: { hair: '#222222', hairD: '#111111', skin: '#ffcc99', tunic: '#dddddd', tunicD: '#999999', apron: '#8899aa', apronD: '#556677', belt: '#442200', band: '#ee4422', bandD: '#aa2200',
      pants: '#664433', boots: '#331a00', brass: '#ffaa44', brassD: '#aa6600', shaft: '#996633', head: '#cccccc', headD: '#777777', glow: '#ffbb44' }
  };

  function hash(n) { n = (n ^ 61) ^ (n >>> 16); n = n + (n << 3); n = n ^ (n >>> 4); n = Math.imul(n, 0x27d4eb2d); n = n ^ (n >>> 15); return (n >>> 0) / 4294967296; }
  function rr(c, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function circ(c, x, y, r, col) { c.fillStyle = col; c.beginPath(); c.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2); c.fill(); }
  function poly(c, pts, col) { c.fillStyle = col; c.beginPath(); c.moveTo(pts[0], pts[1]); for (var i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.closePath(); c.fill(); }
  function gearShape(c, x, y, r, teeth, rot, col, hole) {
    c.fillStyle = col; c.beginPath();
    for (var i = 0; i < teeth * 2; i++) { var a = rot + i * Math.PI / teeth, rad = i % 2 ? r * 0.78 : r; var a2 = a + Math.PI / teeth; c.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); c.lineTo(x + Math.cos(a2 - 0.001) * rad, y + Math.sin(a2 - 0.001) * rad); }
    c.closePath(); c.fill();
    if (hole) circ(c, x, y, r * 0.32, hole);
  }

  // ---------- кадр-буфер для retro ----------
  var lo = null, loc = null;
  function loBuf() { if (!lo) { lo = document.createElement('canvas'); lo.width = W / 2; lo.height = H / 2; loc = lo.getContext('2d'); } return loc; }

  // ---------- фон ----------
  function background(c, S, P, retro, camX, ti) {
    var i;
    if (!retro) { var gr = c.createLinearGradient(0, HUD, 0, H); gr.addColorStop(0, P.sky[0]); gr.addColorStop(1, P.sky[1]); c.fillStyle = gr; }
    else c.fillStyle = P.sky[0];
    c.fillRect(0, HUD, W, H - HUD);
    // дальний план: силуэты цеха (параллакс 0.35)
    var px = camX * TS * 0.35, step = 72;
    for (i = Math.floor(px / step) - 1; i < Math.floor(px / step) + W / step + 2; i++) {
      var hx = i * step - px, r = hash(i * 7 + ti * 131), r2 = hash(i * 13 + 5 + ti);
      c.fillStyle = P.far;
      var kind = (ti + i) % 4 < 0 ? 0 : Math.floor(r2 * 4);
      if (kind === 0) { var hh = 90 + r * 110; c.fillRect(hx + 10, H - hh, 26, hh); c.fillRect(hx + 4, H - hh - 8, 38, 10); }       // труба
      else if (kind === 1) { gearShape(c, hx + 36, HUD + 70 + r * 80, 22 + r * 14, 9, (S.time * (i % 2 ? 0.3 : -0.3)), P.far, P.sky[0]); }  // шестерня
      else if (kind === 2) { c.fillRect(hx, HUD + 40 + r * 40, step, 8); c.fillRect(hx + step / 2 - 4, HUD + 40 + r * 40, 8, 200); }       // балка
      else { var h2 = 60 + r * 80; c.fillRect(hx + 6, H - h2, step - 12, h2); for (var w2 = 0; w2 < 3; w2++) { c.fillStyle = retro ? P.sky[0] : 'rgba(0,0,0,.35)'; c.fillRect(hx + 14 + w2 * 16, H - h2 + 14, 8, 12); } c.fillStyle = P.far; }   // корпус с окнами
    }
    // средний план (параллакс 0.6): труба под потолком, цепи с крюками, лампы
    var mx = camX * TS * 0.6, ms = 216;
    c.fillStyle = P.lo; c.fillRect(0, HUD + 14, W, 7);
    for (i = Math.floor(mx / ms) - 1; i < Math.floor(mx / ms) + W / ms + 2; i++) {
      var qx = i * ms - mx, rq = hash(i * 29 + ti * 7);
      c.fillStyle = P.t; c.fillRect(qx - 3, HUD + 12, 10, 11);                       // муфта трубы
      var cl = 40 + rq * 70;                                                          // цепь
      c.fillStyle = P.far; for (var z = 0; z < cl; z += 6) c.fillRect(qx + 90 + (z % 12 ? 0 : 1), HUD + 21 + z, 3, 4);
      c.fillRect(qx + 86, HUD + 21 + cl, 10, 3); c.fillRect(qx + 94, HUD + 21 + cl, 3, 7);
      var lx = qx + 160, ly = HUD + 21 + 18 + rq * 20;                                // лампа
      c.fillStyle = P.far; c.fillRect(lx, HUD + 21, 2, ly - HUD - 21); poly(c, [lx - 9, ly + 8, lx + 11, ly + 8, lx + 5, ly, lx - 3, ly], P.lo);
      c.fillStyle = P.acc; c.fillRect(lx - 4, ly + 8, 10, 3);
      if (!retro) { var lg = c.createRadialGradient(lx + 1, ly + 10, 2, lx + 1, ly + 10, 90); lg.addColorStop(0, hexA(P.acc, 0.22)); lg.addColorStop(1, hexA(P.acc, 0)); c.fillStyle = lg; c.fillRect(lx - 90, ly - 80, 180, 180); }
    }
    if (retro) { c.fillStyle = 'rgba(0,0,0,.28)'; for (var sl = HUD; sl < H; sl += 4) c.fillRect(0, sl, W, 2); }   // «строки» кинескопа
    // свечение цеха
    if (!retro) {
      var gl = c.createRadialGradient(W * 0.5, H, 10, W * 0.5, H, 360);
      gl.addColorStop(0, hexA(P.acc, 0.13)); gl.addColorStop(1, hexA(P.acc, 0)); c.fillStyle = gl; c.fillRect(0, HUD, W, H - HUD);
    }
  }
  function hexA(hex, a) { var n = parseInt(hex.slice(1), 16); return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')'; }

  // ---------- тайлы ----------
  function tiles(c, S, P, retro, camX) {
    var Wd = S.W, c0 = Math.floor(camX), c1 = Math.min(Wd.W - 1, c0 + VW + 1), r, col;
    for (col = Math.max(0, c0); col <= c1; col++) for (r = 0; r < LT.R; r++) {
      var v = Wd.t[r * Wd.W + col]; if (!v) continue;
      var x = Math.round((col - camX) * TS), y = r * TS + HUD;
      if (v === LT.SOL) block(c, Wd, col, r, x, y, P, retro);
      else if (v === LT.SPK) spikes(c, x, y, P, retro);
      else if (v === LT.BLK) {
        var gr = Wd.grp[r * Wd.W + col], L = OZ.logic, p = ((S.time - gr * L.BL_STEP) % L.BL_P + L.BL_P) % L.BL_P;
        if (p < L.BL_ON) { var warn = p > L.BL_ON - 0.45 && Math.floor(S.time * 14) % 2; plateBlock(c, x, y, P, retro, warn); }
        else { c.strokeStyle = hexA(P.acc, retro ? 0.5 : 0.28); c.lineWidth = 2; c.setLineDash && c.setLineDash([4, 4]); c.strokeRect(x + 2, y + 2, TS - 4, TS - 4); c.setLineDash && c.setLineDash([]); }
      } else if (v === LT.GATE) gate(c, x, y, P, retro);
    }
  }
  function isSolid(Wd, c, r) { if (c < 0 || c >= Wd.W || r < 0 || r >= LT.R) return false; var v = Wd.t[r * Wd.W + c]; return v === LT.SOL; }
  function block(c, Wd, col, r, x, y, P, retro) {
    var top = !isSolid(Wd, col, r - 1), s = P.style;
    c.fillStyle = P.lo; c.fillRect(x, y, TS, TS);
    c.fillStyle = P.t; c.fillRect(x + 1, y + 1, TS - 2, TS - 2);
    var hs = hash(col * 31 + r * 17);
    if (s === 'brick') { c.fillStyle = P.lo; c.fillRect(x, y + 11, TS, 2); c.fillRect(x + ((r % 2) ? 6 : 16), y, 2, 11); c.fillRect(x + ((r % 2) ? 16 : 6), y + 13, 2, 11); }
    else if (s === 'plate') { c.fillStyle = P.hi; c.fillRect(x + 3, y + 3, 3, 3); c.fillRect(x + TS - 6, y + 3, 3, 3); c.fillRect(x + 3, y + TS - 6, 3, 3); c.fillRect(x + TS - 6, y + TS - 6, 3, 3); }
    else if (s === 'stripe') { c.fillStyle = P.lo; for (var k = 0; k < 3; k++) c.fillRect(x + 1, y + 5 + k * 7, TS - 2, 2); }
    else if (s === 'ice') { c.fillStyle = P.hi; c.fillRect(x + 4 + hs * 8, y + 5, 2, 9); c.fillRect(x + 12, y + 12 + hs * 4, 7, 2); }
    else if (s === 'moss') { c.fillStyle = P.lo; c.fillRect(x + 1, y + 12, TS - 2, 2); c.fillStyle = P.hi; c.fillRect(x + 5, y + 16, 3, 3); c.fillRect(x + 15, y + 6, 3, 3); }
    else if (s === 'circuit') { c.fillStyle = P.lo; c.fillRect(x + 6, y + 4, 2, 14); c.fillRect(x + 6, y + 16, 12, 2); c.fillStyle = P.acc; c.fillRect(x + 16, y + 14, 4, 4); }
    else if (s === 'iron') { c.fillStyle = P.lo; c.fillRect(x + 1, y + 11, TS - 2, 2); c.fillStyle = hash(col * 3 + r) < 0.2 ? P.acc : P.hi; c.fillRect(x + 4, y + 4, 2, 2); c.fillRect(x + 18, y + 16, 2, 2); }
    if (top) {
      c.fillStyle = P.hi; c.fillRect(x, y, TS, 4);
      if (s === 'moss') { c.fillStyle = P.acc; c.fillRect(x, y, TS, 2); c.fillRect(x + 3 + hs * 10, y + 2, 3, 3); }
      if (s === 'ice') { c.fillStyle = '#ffffff'; c.fillRect(x + 2, y, TS - 4, 2); }
    }
  }
  function spikes(c, x, y, P, retro) {
    var col = P.spk || '#c9c2bb';
    for (var i = 0; i < 3; i++) { poly(c, [x + i * 8, y + TS, x + i * 8 + 4, y + 6, x + i * 8 + 8, y + TS], col); if (!retro) poly(c, [x + i * 8 + 4, y + 6, x + i * 8 + 8, y + TS, x + i * 8 + 5, y + TS], 'rgba(0,0,0,.3)'); }
  }
  function plateBlock(c, x, y, P, retro, warn) {
    c.fillStyle = warn ? P.hi : P.acc; c.fillRect(x + 1, y + 1, TS - 2, 8);
    c.fillStyle = P.lo; c.fillRect(x + 1, y + 9, TS - 2, TS - 10);
    c.fillStyle = P.t; c.fillRect(x + 4, y + 12, TS - 8, 4);
  }
  function gate(c, x, y, P, retro) {
    c.fillStyle = P.lo; c.fillRect(x, y, TS, TS);
    c.fillStyle = P.acc; for (var i = 0; i < 4; i++) c.fillRect(x + 2 + i * 6, y, 3, TS);
    c.fillStyle = P.hi; c.fillRect(x, y + 10, TS, 3);
  }

  // ---------- герой ----------
  // pose: { run, air, slide, el (секунд от начала замаха, 0 — нет), hot, heat }
  function heroFig(c, x, y, face, pose, K, retro, t) {
    var L = OZ.logic, el = pose.el || 0;
    c.save(); c.translate(x, y); if (face < 0) c.scale(-1, 1);
    if (pose.slide) {
      // кувырок: герой свёрнут в вертящийся клубок
      c.save(); c.translate(0, -11); c.rotate(t * 20);
      circ(c, 0, 0, 10, K.tunicD); circ(c, 0, 0, 8, K.tunic); c.fillStyle = K.apron; c.fillRect(-8, -1, 16, 6);
      circ(c, 5, -5, 4, K.skin); c.fillStyle = K.band; c.fillRect(2, -9, 8, 3);
      c.restore();
      c.restore(); return;
    }
    var ph = pose.run, legA = pose.air ? 0.5 : Math.sin(ph) * 0.9, legB = pose.air ? -0.7 : -Math.sin(ph) * 0.9, bob = pose.air ? 0 : Math.abs(Math.sin(ph)) * 1.2;
    var hipY = -15 - bob;
    function leg(a, back) {
      c.save(); c.translate(back ? -2 : 2, hipY); c.rotate(a * 0.55);
      c.fillStyle = back ? K.boots : K.pants; c.fillRect(-2.5, 0, 5, 9);
      c.save(); c.translate(0, 8); c.rotate(Math.max(0, -a) * 0.6 + (pose.air && !back ? 0.6 : 0));
      c.fillStyle = K.pants; c.fillRect(-2.5, 0, 5, 6); c.fillStyle = K.boots; c.fillRect(-2.5, 5, 7, 3.5);
      c.restore(); c.restore();
    }
    leg(legB, true); leg(legA, false);
    // корпус: рубаха и стальной фартук
    c.fillStyle = K.tunicD; c.fillRect(-6, hipY - 15, 12, 16);
    c.fillStyle = K.tunic; c.fillRect(-5, hipY - 15, 10, 14);
    c.fillStyle = K.apronD; c.fillRect(-5, hipY - 11, 10, 11); c.fillStyle = K.apron; c.fillRect(-4, hipY - 10, 8, 9);
    c.fillStyle = K.apronD; c.fillRect(-4, hipY - 14, 1.5, 4); c.fillRect(2.5, hipY - 14, 1.5, 4);
    c.fillStyle = K.belt; c.fillRect(-6, hipY - 2, 12, 3); c.fillStyle = K.brass; c.fillRect(-1, hipY - 2, 3, 3);
    // задняя рука
    c.fillStyle = K.tunicD; c.save(); c.translate(-3, hipY - 13); c.rotate(pose.air ? -0.9 : -Math.sin(ph) * 0.6); c.fillRect(-2, 0, 4, 10); c.fillStyle = K.skin; c.fillRect(-2, 9, 4, 3); c.restore();
    // голова: тёмные волосы, красная повязка с хвостом
    var hy = hipY - 26, fl = Math.sin(t * 12 + ph) * 1.5;
    c.fillStyle = K.skin; c.fillRect(-4, hy + 2, 9, 9);
    c.fillStyle = '#2a1a12'; c.fillRect(2.5, hy + 6, 1.6, 2);
    c.fillStyle = K.hair; c.fillRect(-6, hy - 1, 11, 4); c.fillRect(-6, hy, 4, 8);
    c.fillStyle = K.band; c.fillRect(-6, hy + 2, 12, 3);
    poly(c, [-6, hy + 2, -13, hy + 4 + fl, -12, hy + 7 + fl, -6, hy + 5], K.bandD);
    // молот в передней руке: замах — вверх-назад → удар вперёд-вниз → возврат
    var a, swinging = el > 0, A0 = L.SW_A0, A1 = L.SW_A1, TOT = L.SW_TOT, a0 = -2.3, a1 = 2.0, rest = pose.air ? -0.9 : -0.55 + Math.sin(ph) * 0.12;
    if (!swinging) a = rest;
    else if (el < A0) a = rest + (a0 - rest) * (el / A0);
    else if (el < A1) a = a0 + (a1 - a0) * Math.pow((el - A0) / (A1 - A0), 0.8);
    else a = a1 + (rest - a1) * Math.min(1, (el - A1) / (TOT - A1));
    c.save(); c.translate(3, hipY - 13); c.rotate(a);
    c.fillStyle = K.tunic; c.fillRect(-2, -8, 4, 9); c.fillStyle = K.skin; c.fillRect(-2, -10, 4, 3);
    c.fillStyle = K.shaft; c.fillRect(-1.3, -27, 2.6, 19);
    var hot = pose.hot || pose.heat >= 3;
    if (hot && !retro) { c.shadowColor = K.glow; c.shadowBlur = 10; }
    c.fillStyle = hot ? K.glow : K.headD; c.fillRect(-7, -33, 14, 9); c.fillStyle = hot ? '#fff0b8' : K.head; c.fillRect(-6, -32, 12, 5);
    c.shadowBlur = 0; c.fillStyle = K.brass; c.fillRect(-7, -26, 14, 2);
    c.restore();
    // след удара — дуга в активные кадры
    if (swinging && el >= A0 && el < A1 + 0.06) {
      var k1 = Math.min(1, (el - A0) / (A1 - A0)), th0 = -Math.PI / 2 + a0, th1 = -Math.PI / 2 + a0 + (a1 - a0) * Math.pow(k1, 0.8);
      c.globalAlpha = 0.7 * (1 - Math.max(0, (el - A1) / 0.06)); c.strokeStyle = hot ? K.glow : '#ffffff'; c.lineWidth = hot ? 7 : 4;
      c.beginPath(); c.arc(3, hipY - 13, hot ? 44 : 34, th0 + 0.6, th1, false); c.stroke(); c.globalAlpha = 1;
    }
    c.restore();
  }

  // ---------- враги, мини-боссы, боссы ----------
  function foeFig(c, e, x, y, P, retro, t) {
    var fl = e.flash > 0 && Math.floor(t * 30) % 2, d = e.dir || 1, k = fl ? '#ffffff' : null;
    switch (e.type) {
      case 'crawler': {
        var wob = Math.sin(e.t * 12) * 1.5;
        c.fillStyle = k || '#5d4a3e'; rr(c, x - 11, y - 18, 22, 14, 5); c.fill();
        c.fillStyle = k || '#8c6f5a'; rr(c, x - 9, y - 24, 18, 9, 4); c.fill();
        c.fillStyle = '#3a2e26'; c.fillRect(x - 1, y - 24, 2, 8);
        for (var i = -1; i <= 1; i++) { c.fillStyle = '#2a201a'; c.fillRect(x + i * 7 - 1.5, y - 5 + (i ? wob : -wob) * 0.5, 3, 5); }
        circ(c, x + d * 8, y - 13, 2.5, '#ffd34d');
        break;
      }
      case 'hopper': {
        var sq = e.ground ? 0 : 4;
        c.strokeStyle = '#9aa0a6'; c.lineWidth = 2; c.beginPath(); for (var z = 0; z < 4; z++) { c.moveTo(x - 6, y - 2 - z * (3 + sq * 0.5)); c.lineTo(x + 6, y - 3.5 - z * (3 + sq * 0.5)); } c.stroke();
        c.fillStyle = k || '#4f7a5a'; rr(c, x - 10, y - 26 - sq * 2, 20, 14, 4); c.fill();
        c.fillStyle = '#20302a'; c.fillRect(x - 6, y - 22 - sq * 2, 12, 4); circ(c, x + d * 3, y - 20 - sq * 2, 2, '#ff6a4d');
        break;
      }
      case 'flyer': {
        var wing = Math.sin(t * 50) * 4;
        c.fillStyle = 'rgba(220,235,255,.55)'; if (retro) c.fillStyle = '#aaccee';
        c.fillRect(x - 10, y - 20 - wing, 8, 3); c.fillRect(x + 2, y - 20 + wing, 8, 3);
        c.fillStyle = k || '#e0b23a'; rr(c, x - 9, y - 18, 18, 13, 6); c.fill();
        c.fillStyle = '#2b2414'; c.fillRect(x - 3, y - 18, 3, 13); c.fillRect(x + 3, y - 18, 3, 13);
        circ(c, x + d * 7, y - 12, 2.2, '#ff3d2a');
        break;
      }
      case 'turret': {
        c.fillStyle = '#3a3330'; c.fillRect(x - 10, y - 4, 4, 4); c.fillRect(x + 6, y - 4, 4, 4); c.fillRect(x - 2, y - 10, 4, 8);
        c.fillStyle = k || (e.warn && Math.floor(t * 16) % 2 ? '#ff7a4d' : '#7a6658'); rr(c, x - 11, y - 24, 22, 14, 6); c.fill();
        c.fillStyle = '#2a2220'; c.save(); c.translate(x, y - 17); c.rotate(d > 0 ? 0 : Math.PI); c.fillRect(4, -3, 11, 6); c.restore();
        circ(c, x, y - 17, 3, e.warn ? '#ffef9a' : '#ffb35c');
        break;
      }
      case 'golem': {   // Наковальник
        var jmp = e.ground ? 0 : -2;
        c.fillStyle = k || '#4a4446'; c.fillRect(x - 22, y - 34 + jmp, 44, 26);
        c.fillStyle = k || '#6c6467'; poly(c, [x - 28, y - 56 + jmp, x + 28, y - 56 + jmp, x + 20, y - 40 + jmp, x - 20, y - 40 + jmp], k || '#6c6467');
        c.fillStyle = '#2a2628'; c.fillRect(x - 16, y - 40 + jmp, 32, 6);
        c.fillStyle = '#ff7a2a'; c.fillRect(x - 12 + d * 4, y - 38 + jmp, 24, 3);
        c.fillStyle = '#3a3436'; c.fillRect(x - 18, y - 8, 12, 8); c.fillRect(x + 6, y - 8, 12, 8);
        c.fillStyle = k || '#857c7f'; c.fillRect(x + d * 22 - 6, y - 30 + jmp, 12, 12);
        break;
      }
      case 'valve': {   // Вентиль
        c.fillStyle = k || '#3f5a63'; c.fillRect(x - 14, y - 50, 28, 50);
        c.fillStyle = '#2a3c42'; c.fillRect(x - 18, y - 12, 36, 12); c.fillRect(x - 18, y - 52, 36, 8);
        var rot = e.t * (e.warn ? 6 : 1.5);
        c.strokeStyle = k || '#d65a4a'; c.lineWidth = 4; c.beginPath(); c.arc(x, y - 66, 13, 0, Math.PI * 2); c.stroke();
        for (var sp = 0; sp < 4; sp++) { var a = rot + sp * Math.PI / 2; c.beginPath(); c.moveTo(x, y - 66); c.lineTo(x + Math.cos(a) * 13, y - 66 + Math.sin(a) * 13); c.stroke(); }
        circ(c, x + d * 6, y - 32, 4, e.warn ? '#ffef9a' : '#9fe8ff');
        break;
      }
      case 'drone': {   // Жужелица
        var wg = Math.sin(t * 40) * 6;
        c.fillStyle = retro ? '#aabbcc' : 'rgba(210,225,240,.6)';
        poly(c, [x - 6, y - 22, x - 34, y - 30 - wg, x - 30, y - 18], c.fillStyle); poly(c, [x + 6, y - 22, x + 34, y - 30 + wg, x + 30, y - 18], c.fillStyle);
        c.fillStyle = k || (e.mode === 'aim' ? '#c4503a' : '#6a5a4a'); rr(c, x - 16, y - 30, 32, 20, 9); c.fill();
        c.fillStyle = '#2a2018'; poly(c, [x + d * 14, y - 24, x + d * 24, y - 18, x + d * 14, y - 14], '#2a2018');
        circ(c, x + d * 8, y - 23, 3, '#ffd34d');
        break;
      }
    }
  }
  function bossFig(c, b, x, y, P, retro, t, fill) {
    var fl = (b.flash > 0 && Math.floor(t * 30) % 2), k = fl ? '#ffffff' : null, d = b.dir || 1, i, hw = b.hw * TS, hh = b.hh * TS;
    c.save(); if (fill < 1) c.globalAlpha = Math.max(0.15, fill);
    switch (b.key) {
      case 'hammer': {   // Кувалдарь: приземистый чугунный корпус с головой-наковальней и рукой-молотом
        var crouch = b.mode === 'crouch' ? 6 : 0;
        c.fillStyle = k || '#3b3132'; c.fillRect(x - hw, y - hh + 14 + crouch, hw * 2, hh - 22 - crouch);
        c.fillStyle = k || '#5a4b4c'; poly(c, [x - hw - 6, y - hh + crouch, x + hw + 6, y - hh + crouch, x + hw - 2, y - hh + 16 + crouch, x - hw + 2, y - hh + 16 + crouch], k || '#5a4b4c');
        c.fillStyle = '#ff7a2a'; c.fillRect(x - 10 + d * 4, y - hh + 6 + crouch, 20, 4);
        c.fillStyle = '#272022'; c.fillRect(x - hw + 2, y - 10, 12, 10); c.fillRect(x + hw - 14, y - 10, 12, 10);
        var sw = b.mode === 'throw' ? -1.2 + Math.min(1, b.mt * 4) * 2.2 : b.mode === 'dash' ? 1.2 : 0.3;
        c.save(); c.translate(x + d * (hw - 2), y - hh + 22); c.scale(d, 1); c.rotate(sw);
        c.fillStyle = '#6b5a4a'; c.fillRect(-2, 0, 5, 20); c.fillStyle = k || '#8a7b7c'; c.fillRect(-9, 18, 19, 11);
        c.restore();
        break;
      }
      case 'gear': {     // Шестерник: колесо-шестерня с башенкой в центре
        var rot = b.mode === 'roll' ? b.t * 12 * d : b.t * 0.8;
        gearShape(c, x, y - hh * 0.5, hh * 0.52, 10, rot, k || '#8d7a3e', null);
        gearShape(c, x, y - hh * 0.5, hh * 0.32, 8, -rot * 1.5, k || '#bea25a', '#3a3018');
        c.fillStyle = '#3a3018'; c.fillRect(x - 6, y - hh - 4, 12, 10);
        circ(c, x + d * 2, y - hh + 1, 3.5, '#ffe9a0');
        break;
      }
      case 'magnet': {   // Магнитчик: летучая подкова с винтом
        var pr = Math.sin(t * 40) * 12;
        c.fillStyle = '#5a5a66'; c.fillRect(x - 2, y - hh - 8, 4, 8); c.fillStyle = retro ? '#cccccc' : 'rgba(220,220,235,.7)'; c.fillRect(x - pr, y - hh - 10, pr * 2, 3);
        c.lineWidth = 11; c.strokeStyle = k || '#8a3ad6'; c.beginPath(); c.arc(x, y - hh * 0.55, hw * 0.75, Math.PI, 0); c.stroke();
        c.fillStyle = k || '#8a3ad6'; c.fillRect(x - hw * 0.75 - 5.5, y - hh * 0.55, 11, hh * 0.45); c.fillRect(x + hw * 0.75 - 5.5, y - hh * 0.55, 11, hh * 0.45);
        c.fillStyle = '#e8e8f0'; c.fillRect(x - hw * 0.75 - 5.5, y - 9, 11, 9); c.fillRect(x + hw * 0.75 - 5.5, y - 9, 11, 9);
        circ(c, x, y - hh * 0.62, 5, b.mode === 'aim' ? '#ff4a3d' : '#ffe14a');
        break;
      }
      case 'fan': {      // Горнило: горн-меха с решёткой пасти
        var br = b.mode === 'inhale' ? Math.sin(b.mt * 6) * 4 + 4 : b.mode === 'exhale' ? -4 : 0;
        c.fillStyle = k || '#5a3420'; rr(c, x - hw - br * 0.5, y - hh + 10, hw * 2 + br, hh - 10, 10); c.fill();
        c.fillStyle = '#3a2214'; for (i = 0; i < 4; i++) c.fillRect(x - hw + 4 - br * 0.5, y - hh + 22 + i * 10, hw * 2 - 8 + br, 3);
        c.fillStyle = k || '#7a4a2a'; c.fillRect(x - 10, y - hh, 20, 14);
        var mo = b.mode === 'exhale' ? '#ffe9a0' : '#ff7a2a';
        c.fillStyle = mo; c.fillRect(x + d * (hw - 4) - 8, y - hh * 0.6, 16, 14);
        c.fillStyle = '#2a160c'; for (i = 0; i < 3; i++) c.fillRect(x + d * (hw - 4) - 8, y - hh * 0.6 + 2 + i * 4, 16, 1.5);
        break;
      }
      case 'volt': {     // Разрядник: катушка-столб с искрящим шаром
        var rl = b.mode === 'roll' ? b.t * 20 : 0;
        circ(c, x - hw * 0.6, y - 6, 6, '#2a3436'); circ(c, x + hw * 0.6, y - 6, 6, '#2a3436');
        c.fillStyle = k || '#3a5c61'; c.fillRect(x - hw * 0.7, y - hh * 0.75, hw * 1.4, hh * 0.68);
        c.fillStyle = '#c9893a'; for (i = 0; i < 6; i++) c.fillRect(x - hw * 0.7, y - hh * 0.72 + i * 6 + (rl % 6), hw * 1.4, 2);
        circ(c, x, y - hh * 0.85, 9, k || '#d8f6ff');
        if (Math.floor(t * 18) % 2) { c.strokeStyle = '#ffe14a'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y - hh * 0.85); for (i = 1; i < 4; i++) c.lineTo(x + Math.sin(t * 50 + i) * 12, y - hh * 0.85 - i * 5); c.stroke(); }
        break;
      }
      case 'bell': {     // Звонарь: бронзовый колокол-автоматон с глазом-языком
        var sw2 = b.mode === 'shake' ? Math.sin(b.mt * 40) * 0.15 : Math.sin(t * 2) * 0.06;
        c.save(); c.translate(x, y - hh); c.rotate(sw2);
        c.fillStyle = '#5a4128'; c.fillRect(-4, -6, 8, 8);
        poly(c, [-hw * 0.45, 4, hw * 0.45, 4, hw * 0.75, hh * 0.75, hw, hh * 0.92, -hw, hh * 0.92, -hw * 0.75, hh * 0.75], k || '#b0844f');
        c.fillStyle = '#7a5a3a'; c.fillRect(-hw, hh * 0.82, hw * 2, 4);
        circ(c, 0, hh * 0.98, 6, '#ffd27f'); circ(c, 0, hh * 0.98, 2.5, '#3a2a18');
        c.restore();
        break;
      }
      case 'walker': {   // Шагающая Домна: башня-печь на двух ногах
        var st = Math.sin(b.t * 4) * (b.vx ? 6 : 1);
        c.fillStyle = '#2a2224'; c.fillRect(x - hw + 6, y - 40 - st, 12, 40 + st); c.fillRect(x + hw - 18, y - 40 + st, 12, 40 - st);
        c.fillStyle = '#3d3438'; c.fillRect(x - hw, y - hh, hw * 2, hh - 38);
        c.fillStyle = k || '#5c4f55'; c.fillRect(x - hw + 4, y - hh + 4, hw * 2 - 8, hh - 46);
        c.fillStyle = '#2a2224'; c.fillRect(x - hw * 0.4, y - hh - 18, hw * 0.8, 20);
        var gl = b.mode === 'flame' ? '#ffe9a0' : '#ff4a3d';
        c.fillStyle = gl; c.fillRect(x + d * hw * 0.3 - 14, y - hh * 0.7, 28, 16);
        c.fillStyle = '#2a1010'; for (i = 0; i < 3; i++) c.fillRect(x + d * hw * 0.3 - 14 + i * 10, y - hh * 0.7, 3, 16);
        break;
      }
      case 'core': {     // Сердце Домны: пылающее ядро в кольцах
        var pul = 1 + Math.sin(t * 6) * 0.08;
        if (!retro) { var rg = c.createRadialGradient(x, y - hh * 0.5, 2, x, y - hh * 0.5, hw * 2.2); rg.addColorStop(0, 'rgba(255,170,90,.55)'); rg.addColorStop(1, 'rgba(255,80,40,0)'); c.fillStyle = rg; c.fillRect(x - hw * 3, y - hh * 2, hw * 6, hh * 3); }
        c.strokeStyle = '#6b4444'; c.lineWidth = 4; c.beginPath(); c.ellipse ? c.ellipse(x, y - hh * 0.5, hw * 1.5, hw * 0.5, b.t, 0, Math.PI * 2) : c.arc(x, y - hh * 0.5, hw * 1.4, 0, 6.3); c.stroke();
        circ(c, x, y - hh * 0.5, hw * 0.95 * pul, k || '#ff6a3d'); circ(c, x, y - hh * 0.5, hw * 0.55 * pul, '#ffe9a0');
        circ(c, x + d * 4, y - hh * 0.5, 3, '#3a0a0a');
        break;
      }
    }
    c.restore();
  }

  // ---------- снаряды ----------
  // отбитый снаряд: яркое ядро со следом; раскалённый — золотой и крупнее
  function shotFig(c, s, x, y, retro, t) {
    var r = Math.max(5, s.r * TS * (s.hot ? 1.5 : 1.15)), n = Math.hypot(s.vx, s.vy) || 1, ux = s.vx / n, uy = s.vy / n;
    var col = s.hot ? '#ffb347' : '#ffffff', core = s.hot ? '#fff4c2' : '#ffe9a0';
    for (var q = 1; q <= 4; q++) { c.globalAlpha = 0.5 - q * 0.1; circ(c, x - ux * q * 7, y - uy * q * 7, r * (1 - q * 0.17), col); }
    c.globalAlpha = 1;
    if (!retro) { c.save(); c.shadowColor = col; c.shadowBlur = 14; circ(c, x, y, r, col); c.restore(); } else circ(c, x, y, r, col);
    circ(c, x, y, r * 0.55, core); circ(c, x, y, r * 0.25, '#ff7a2a');
  }
  function eshotFig(c, s, x, y, retro, t, P) {
    var r = (s.r || s.hw || 0.3) * TS;
    switch (s.kind) {
      case 'hmr': c.save(); c.translate(x, y); c.rotate(t * 16 * Math.sign(s.vx || 1)); c.fillStyle = '#6b5a4a'; c.fillRect(-2, -10, 4, 14); c.fillStyle = '#8a7b7c'; c.fillRect(-8, -12, 16, 8); c.restore(); break;
      case 'cog': gearShape(c, x, y, Math.max(s.hw, s.hh) * TS * 0.8, 7, t * 10, '#bea25a', '#3a3018'); break;
      case 'drop': circ(c, x, y, r, '#8a3ad6'); circ(c, x - 2, y - 2, r * 0.35, '#e0c4ff'); break;
      case 'ember': case 'melt': circ(c, x, y, r, s.kind === 'melt' ? '#ff9a3d' : '#ff6a2a'); circ(c, x, y, r * 0.5, '#ffe9a0'); break;
      case 'wave': {
        var hw = s.hw * TS, hh = s.hh * TS, col = s.water ? (retro ? '#88ddff' : 'rgba(166,236,255,.85)') : (retro ? '#ffaa00' : 'rgba(255,170,80,.85)');
        poly(c, [x - hw, y + hh, x - hw * 0.4, y - hh, x + hw * 0.4, y - hh * 0.6, x + hw, y + hh], col); break;
      }
      case 'bubble': c.strokeStyle = retro ? '#aaffff' : 'rgba(200,245,255,.9)'; c.lineWidth = 2; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.stroke(); circ(c, x - r * 0.35, y - r * 0.35, 2, '#ffffff'); break;
      case 'spark': circ(c, x, y, r, '#ffe14a'); circ(c, x, y, r * 0.5, '#ffffff'); break;
      case 'note': c.strokeStyle = '#ffd27f'; c.lineWidth = 2; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.stroke(); circ(c, x, y, r * 0.4, '#ffd27f'); break;
      case 'bolt': circ(c, x, y, r, '#ff5a3d'); circ(c, x, y, r * 0.45, '#ffd0a0'); break;
      case 'crate': c.fillStyle = '#7a5a3a'; c.fillRect(x - s.hw * TS, y - s.hh * TS, s.hw * TS * 2, s.hh * TS * 2); c.strokeStyle = '#3a2a18'; c.lineWidth = 2; c.strokeRect(x - s.hw * TS + 1, y - s.hh * TS + 1, s.hw * TS * 2 - 2, s.hh * TS * 2 - 2); c.beginPath(); c.moveTo(x - s.hw * TS, y - s.hh * TS); c.lineTo(x + s.hw * TS, y + s.hh * TS); c.stroke(); break;
      default: circ(c, x, y, r, '#ff5a3d');
    }
  }
  function itemFig(c, it, x, y, retro, t) {
    var bob = it.fixed ? Math.sin(t * 4 + it.x) * 2 : 0; y += bob;
    if (it.k === 'hp2' || it.k === 'hp8') {        // капсула здоровья: красная гайка с крестом
      var s = it.k === 'hp8' ? 1.4 : 0.9;
      gearShape(c, x, y - 9 * s, 8 * s, 6, 0.3, '#d6453a', null); c.fillStyle = '#ffe9e0'; c.fillRect(x - 1.5 * s, y - 13 * s, 3 * s, 8 * s); c.fillRect(x - 4 * s, y - 10.5 * s, 8 * s, 3 * s);
    } else if (it.k === 'life') {                  // жетон-наковальня
      circ(c, x, y - 9, 9, '#e0b23a'); poly(c, [x - 6, y - 12, x + 6, y - 12, x + 3, y - 8, x + 3, y - 5, x - 3, y - 5, x - 3, y - 8], '#6a4a14');
    }
  }
  var parts = [];
  function puff(x, y, col, n, sp, life, grav) { for (var i = 0; i < n; i++) { var a = Math.random() * Math.PI * 2, v = sp * (0.3 + Math.random() * 0.7); parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (grav ? sp * 0.4 : 0), t: life * (0.6 + Math.random() * 0.4), life: life, col: col, g: grav ? 22 : 0 }); } }
  function stepParts(dt) { for (var i = 0; i < parts.length; i++) { var p = parts[i]; p.t -= dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; } parts = parts.filter(function (p) { return p.t > 0; }); }

  function world(c, g, S, ui, retro) {
    var Pal = (retro ? PR : PM)[S.lv.theme], camX = S.cam.x, K = HERO[retro ? 'r' : 'm'], t = S.time;
    var sh = ui.shake ? (Math.random() - 0.5) * ui.shake : 0, sv = ui.shake ? (Math.random() - 0.5) * ui.shake : 0;
    c.save(); c.translate(sh, sv);
    background(c, S, Pal, retro, camX, S.lv.theme);
    tiles(c, S, Pal, retro, camX);
    function X(x) { return (x - camX) * TS; } function Y(y) { return y * TS + HUD; }
    var i;
    // лужи расплава
    S.puddles.forEach(function (p) { c.fillStyle = retro ? '#ff6600' : 'rgba(255,110,40,.85)'; c.fillRect(X(p.x - p.w / 2), Y(p.y) - 4, p.w * TS, 4); });
    S.items.forEach(function (it) { if (!it.got) itemFig(c, it, X(it.x), Y(it.y), retro, t); });
    S.enemies.forEach(function (e) { if (!e.dead) foeFig(c, e, X(e.x), Y(e.y), Pal, retro, t); });
    if (S.boss && !S.boss.dead && (S.bossState === 'intro' || S.bossState === 'fight')) bossFig(c, S.boss, X(S.boss.x), Y(S.boss.y), Pal, retro, t, S.bossState === 'intro' ? S.boss.fill : 1);
    // герой
    var h = S.hero;
    if (S.phase === 'stage' && !(h.inv > 0 && Math.floor(t * 20) % 2 && h.knockT <= 0)) {
      heroFig(c, X(h.x), Y(h.y), h.face, { run: h.runT * 2.2, air: !h.ground, slide: h.slide, el: h.swingT > 0 ? OZ.logic.SW_TOT - h.swingT : 0, hot: h.hot && h.swingT > 0, heat: h.heat }, K, retro, t);
    }
    S.shots.forEach(function (s) { shotFig(c, s, X(s.x), Y(s.y), retro, t); });
    S.eshots.forEach(function (s) { eshotFig(c, s, X(s.x), Y(s.y), retro, t, Pal); });
    // частицы
    for (i = 0; i < parts.length; i++) { var p = parts[i]; c.globalAlpha = Math.max(0, p.t / p.life); c.fillStyle = p.col; c.fillRect(X(p.x) - 2, Y(p.y) - 2, 4, 4); }
    c.globalAlpha = 1;
    c.restore();
    // всплывающие надписи (в мировых координатах)
    return Pal;
  }

  // ---------- HUD ----------
  function bar(c, x, y, w, h, frac, col, back, segs) {
    c.fillStyle = back; c.fillRect(x, y, w, h);
    var n = segs || 28, fw = (w - 2) / n, k = Math.round(frac * n);
    c.fillStyle = col; for (var i = 0; i < k; i++) c.fillRect(x + 1 + i * fw, y + 1, Math.max(1, fw - 1), h - 2);
  }
  function hud(g, c, S, retro, Pal) {
    var th = g.th(), L = OZ.logic, t = S.time;
    c.fillStyle = retro ? '#000000' : 'rgba(10,8,7,.92)'; c.fillRect(0, 0, W, HUD);
    c.fillStyle = Pal ? Pal.acc : th.accent; c.fillRect(0, HUD - 2, W, 2);
    var h = S.hero, hpCol = h.hp <= 8 && Math.floor(t * 4) % 2 ? '#ffe9a0' : (retro ? '#ff5544' : '#ff6a4d');
    // здоровье: шестерёнка + горизонтальная полоса
    gearShape(c, 12, 11, 7, 7, 0, hpCol, retro ? '#000' : '#1a1410');
    bar(c, 22, 6, 116, 10, h.hp / L.MAX_HP, hpCol, retro ? '#331111' : '#2a1614', L.MAX_HP);
    // жар: три ячейки (полный жар — мерцает: следующий удар раскалённый)
    g.text(g.t('heat'), 150, 16, { size: 10, color: th.muted, weight: 700 });
    var full = h.heat >= L.MAX_HEAT && Math.floor(t * 6) % 2;
    for (var q = 0; q < L.MAX_HEAT; q++) {
      var on = q < h.heat, px = 184 + q * 22;
      c.fillStyle = retro ? '#331a00' : '#2a1a10'; c.fillRect(px, 6, 18, 10);
      if (on) { c.fillStyle = full ? '#ffffff' : (retro ? '#ffaa00' : '#ffb347'); c.fillRect(px + 1, 7, 16, 8); c.fillStyle = retro ? '#ff5500' : '#ff7a2a'; c.fillRect(px + 1, 11, 16, 4); }
    }
    // жизни, счёт
    var x = 262;
    g.text('♥' + S.lives, x, 16, { size: 11, color: th.ink, weight: 800 }); x += 36;
    g.text(g.t('score') + ' ' + S.score, x, 16, { size: 11, color: th.ink, weight: 800 });
    // босс
    var b = S.boss;
    if (b && (S.bossState === 'fight' || S.bossState === 'intro')) {
      var frac = S.bossState === 'intro' ? b.fill * b.hp / b.max : b.hp / b.max;
      g.text(g.t('b_' + b.key), W - 8, 16, { size: 10, align: 'right', color: Pal.acc, weight: 800 });
      bar(c, 420, 6, 112, 10, frac, retro ? '#ffaa00' : '#ffb35c', retro ? '#332200' : '#2a2014', b.max);
    } else if (S.mini && !S.mini.dead) {
      g.text(g.t('f_' + S.mini.type), W - 8, 16, { size: 10, align: 'right', color: th.muted, weight: 800 });
      bar(c, 440, 6, 92, 10, S.mini.hp / S.mini.max, retro ? '#ffaa00' : '#d6a03a', retro ? '#332200' : '#2a2014', S.mini.max);
    } else g.text(g.t('s_' + S.lv.boss), W - 8, 16, { size: 10, align: 'right', color: th.muted, weight: 700 });
  }
  // ---------- главный вход ----------
  OZ.render = function (g, ctx, S, ui) {
    var retro = g.themeName === 'retro', th = g.th();
    ctx.imageSmoothingEnabled = !retro;
    if (!S.lv) { ctx.fillStyle = th.bg; ctx.fillRect(0, 0, W, H); return; }
    var Pal;
    if (retro) {
      var c = loBuf(); c.setTransform(0.5, 0, 0, 0.5, 0, 0); c.imageSmoothingEnabled = false;
      Pal = world(c, g, S, ui, true);
      ctx.drawImage(lo, 0, 0, W, H);
    } else Pal = world(ctx, g, S, ui, false);
    // надписи над миром
    var camX = S.cam.x;
    (ui.toasts || []).forEach(function (q) { ctx.globalAlpha = Math.min(1, q.t / 0.4); g.text(q.text, (q.x - camX) * TS, q.y * TS + HUD, { size: q.big ? 13 : 11, align: 'center', color: q.color, weight: 900 }); ctx.globalAlpha = 1; });
    hud(g, ctx, S, retro, Pal);
    if (ui.banner) {
      var a = Math.min(1, ui.banner.a / 0.4), by = 120;
      ctx.globalAlpha = a; ctx.fillStyle = retro ? '#000000' : 'rgba(10,7,5,.78)'; ctx.fillRect(0, by - 34, W, 64);
      ctx.fillStyle = Pal.acc; ctx.fillRect(0, by - 34, W, 2); ctx.fillRect(0, by + 28, W, 2);
      g.text(ui.banner.title, W / 2, by - 4, { size: retro ? 18 : 20, align: 'center', color: Pal.acc, weight: 900 });
      if (ui.banner.sub) g.text(ui.banner.sub, W / 2, by + 18, { size: 11, align: 'center', color: th.ink, weight: 700 });
      ctx.globalAlpha = 1;
    }
    if (ui.msg) { ctx.globalAlpha = Math.min(1, ui.msg.a / 0.3); g.text(ui.msg.text, W / 2, 190, { size: 16, align: 'center', color: ui.msg.color || th.accent, weight: 900 }); ctx.globalAlpha = 1; }
    if (S.phase === 'clear') g.text(g.t('clear'), W / 2, 180, { size: 22, align: 'center', color: Pal.acc, weight: 900 });
  };
  OZ.renderFx = { puff: puff, step: stepParts, parts: function () { return parts; }, clear: function () { parts = []; } };
  OZ.R = { W: W, H: H, TS: TS, HUD: HUD, PM: PM, PR: PR, HERO: HERO, heroFig: heroFig, bossFig: bossFig, gearShape: gearShape, rr: rr, hexA: hexA };
})(typeof window !== 'undefined' ? window : globalThis);
