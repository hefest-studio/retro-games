/* МЕДНИЦА · рисунок (MEDNITSA.R): палитры modern/retro, мастерская (стена, трубы, котёл, 10 цехов, дирижабль), примитивы UI.
   retro — сцена рисуется в буфер 240×176 и растягивается ×2 без сглаживания (крупный пиксель), палитра — 16 тёплых цветов. */
(function (global) {
  'use strict';
  var M = global.MEDNITSA = global.MEDNITSA || {};
  var TAU = Math.PI * 2;

  var PAL = {
    modern: { pixel: false, font: 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif',
      bg: '#1a120e', wallA: '#2e1f17', wallB: '#24180f', brick: 'rgba(0,0,0,.22)', brickHi: 'rgba(255,190,140,.05)', floor: '#1d140e', floorLine: '#3b2a1e',
      panel: '#241813', panel2: '#2f2019', line: '#4b3427', ink: '#f7ead8', muted: '#b59c86', dim: '#7d6757',
      copper: '#d27a35', copperHi: '#f6ad66', copperLo: '#8a4520', brass: '#e2b552', brassHi: '#ffe08f', brassLo: '#946e22',
      steel: '#8e9196', steelLo: '#55575c', glow: '#ffcf7a', fire: '#ff7a2a', good: '#93d36b', bad: '#e8603f', accent: '#ff9a45',
      ad: '#86c8ff', adBg: '#1d2c3a', btn: '#3c2a1f', btnHi: '#573c2a', btnOff: '#2a1e17', shadow: 'rgba(0,0,0,.45)', steam: 'rgba(255,244,230,', night: '#120c09' },
    retro: { pixel: true, font: '"Courier New", ui-monospace, monospace',
      bg: '#000000', wallA: '#3c1c08', wallB: '#2c1404', brick: '#1c0c00', brickHi: '#4c2810', floor: '#1c0c00', floorLine: '#7c3c10',
      panel: '#000000', panel2: '#1c0c00', line: '#ac5c1c', ink: '#fcfcfc', muted: '#bcbcbc', dim: '#7c7c7c',
      copper: '#c86414', copperHi: '#fca044', copperLo: '#7c3c10', brass: '#fcc838', brassHi: '#fcfc7c', brassLo: '#a87c00',
      steel: '#a8a8a8', steelLo: '#545454', glow: '#fcfc7c', fire: '#fc5400', good: '#54fc54', bad: '#fc5454', accent: '#fca044',
      ad: '#54fcfc', adBg: '#002c3c', btn: '#3c1c08', btnHi: '#7c3c10', btnOff: '#1c0c00', shadow: 'rgba(0,0,0,0)', steam: 'rgba(252,252,252,', night: '#000000' }
  };

  function rr(c, x, y, w, h, r) { r = Math.max(0, Math.min(r, w / 2, h / 2)); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function circ(c, x, y, r) { c.beginPath(); c.arc(x, y, Math.max(0.1, r), 0, TAU); }
  function metal(c, P, x0, y0, x1, y1, hi, mid, lo) {   // градиент «металл» (в retro — сплошная заливка)
    if (P.pixel) return mid; var gr = c.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, hi); gr.addColorStop(0.45, mid); gr.addColorStop(1, lo); return gr;
  }
  function gear(c, x, y, r, teeth, rot, col, hole) {
    c.save(); c.translate(x, y); c.rotate(rot); c.beginPath();
    for (var i = 0; i < teeth * 2; i++) { var a = i * Math.PI / teeth, rad = i % 2 ? r * 0.78 : r; c.lineTo(Math.cos(a - 0.12) * rad, Math.sin(a - 0.12) * rad); c.lineTo(Math.cos(a + 0.12) * rad, Math.sin(a + 0.12) * rad); }
    c.closePath(); c.fillStyle = col; c.fill(); if (hole) { circ(c, 0, 0, r * 0.3); c.fillStyle = hole; c.fill(); } c.restore();
  }
  function rivets(c, x, y, w, n, col) { c.fillStyle = col; for (var i = 0; i < n; i++) { circ(c, x + (n === 1 ? w / 2 : w * i / (n - 1)), y, 1.8); c.fill(); } }

  // ---------- 10 цехов: значок машины в квадрате s (центр cx, cy) ----------
  var ART = {
    kettle: function (c, x, y, s, t, on, P) {   // самовар: урна, корона, краник, ручки
      var k = s / 64;
      c.fillStyle = metal(c, P, x - 18 * k, 0, x + 18 * k, 0, P.copperHi, P.copper, P.copperLo);
      c.beginPath(); c.moveTo(x - 14 * k, y - 16 * k); c.quadraticCurveTo(x - 24 * k, y + 2 * k, x - 12 * k, y + 16 * k); c.lineTo(x + 12 * k, y + 16 * k); c.quadraticCurveTo(x + 24 * k, y + 2 * k, x + 14 * k, y - 16 * k); c.closePath(); c.fill();
      c.fillStyle = P.brass; c.fillRect(x - 16 * k, y + 16 * k, 32 * k, 5 * k); c.fillRect(x - 9 * k, y - 22 * k, 18 * k, 6 * k);
      c.fillStyle = P.brassLo; c.fillRect(x - 3 * k, y - 27 * k, 6 * k, 5 * k);
      c.strokeStyle = P.brass; c.lineWidth = 3 * k; c.beginPath(); c.arc(x - 21 * k, y - 4 * k, 6 * k, Math.PI * 0.5, Math.PI * 1.5); c.stroke(); c.beginPath(); c.arc(x + 21 * k, y - 4 * k, 6 * k, -Math.PI * 0.5, Math.PI * 0.5); c.stroke();
      c.fillStyle = P.brassHi; c.fillRect(x - 2 * k, y + 4 * k, 12 * k, 4 * k); c.fillRect(x + 8 * k, y + 4 * k, 3 * k, 8 * k);
      if (on && !P.pixel) { c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(x - 10 * k, y - 12 * k, 4 * k, 20 * k); }
      if (on) { var d = (Math.sin(t * 7) + 1) * 2 * k; c.fillStyle = P.fire; c.fillRect(x - 6 * k, y + 10 * k - d * 0.3, 12 * k, 3 * k); }
    },
    hammer: function (c, x, y, s, t, on, P) {   // паровой молот: рама, боёк ходит вниз-вверх, наковальня
      var k = s / 64, h = on ? Math.max(0, Math.sin(t * 5)) * 12 * k : 6 * k;
      c.fillStyle = P.steelLo; c.fillRect(x - 22 * k, y - 26 * k, 6 * k, 48 * k); c.fillRect(x + 16 * k, y - 26 * k, 6 * k, 48 * k); c.fillRect(x - 24 * k, y - 28 * k, 48 * k, 7 * k);
      c.fillStyle = P.copper; c.fillRect(x - 6 * k, y - 22 * k, 12 * k, 12 * k);
      c.fillStyle = P.steel; c.fillRect(x - 3 * k, y - 12 * k, 6 * k, 6 * k + h); c.fillStyle = metal(c, P, x - 12 * k, 0, x + 12 * k, 0, P.steel, P.steel, P.steelLo); c.fillRect(x - 12 * k, y - 6 * k + h, 24 * k, 10 * k);
      c.fillStyle = P.brassLo; c.beginPath(); c.moveTo(x - 16 * k, y + 14 * k); c.lineTo(x + 16 * k, y + 14 * k); c.lineTo(x + 10 * k, y + 22 * k); c.lineTo(x - 10 * k, y + 22 * k); c.closePath(); c.fill();
      c.fillStyle = on && h < 2 * k ? P.glow : P.copperLo; c.fillRect(x - 10 * k, y + 10 * k, 20 * k, 4 * k);
    },
    rivet: function (c, x, y, s, t, on, P) {   // клёпальня: пресс и лента с заклёпками
      var k = s / 64, sh = on ? (t * 18) % (12 * k) : 0, pr = on ? Math.max(0, Math.sin(t * 6)) * 6 * k : 0;
      c.fillStyle = P.steelLo; c.fillRect(x - 26 * k, y + 8 * k, 52 * k, 8 * k);
      c.fillStyle = P.brass; for (var i = -2; i <= 2; i++) { circ(c, x + i * 12 * k - sh + 6 * k, y + 6 * k, 3 * k); c.fill(); }
      c.fillStyle = metal(c, P, x - 14 * k, 0, x + 14 * k, 0, P.copperHi, P.copper, P.copperLo); c.fillRect(x - 14 * k, y - 26 * k, 28 * k, 18 * k);
      c.fillStyle = P.steel; c.fillRect(x - 4 * k, y - 8 * k, 8 * k, 6 * k + pr); c.fillRect(x - 8 * k, y - 4 * k + pr, 16 * k, 4 * k);
      rivets(c, x - 10 * k, y - 22 * k, 20 * k, 3, P.brassHi);
      c.fillStyle = P.steelLo; c.fillRect(x - 24 * k, y + 16 * k, 4 * k, 8 * k); c.fillRect(x + 20 * k, y + 16 * k, 4 * k, 8 * k);
    },
    foundry: function (c, x, y, s, t, on, P) {   // литейка: ковш льёт металл в форму
      var k = s / 64; c.save(); c.translate(x - 6 * k, y - 10 * k); c.rotate(on ? 0.5 + Math.sin(t * 1.5) * 0.08 : 0.15);
      c.fillStyle = P.steelLo; c.beginPath(); c.moveTo(-14 * k, -12 * k); c.lineTo(14 * k, -12 * k); c.lineTo(10 * k, 12 * k); c.lineTo(-10 * k, 12 * k); c.closePath(); c.fill();
      c.fillStyle = on ? P.fire : P.copperLo; c.fillRect(-12 * k, -12 * k, 24 * k, 5 * k); c.restore();
      if (on) { c.fillStyle = P.glow; c.fillRect(x + 6 * k, y - 8 * k, 4 * k, 20 * k); c.fillStyle = P.fire; c.fillRect(x + 7 * k, y - 4 * k, 2 * k, 16 * k); }
      c.fillStyle = P.brassLo; c.fillRect(x - 6 * k, y + 12 * k, 30 * k, 10 * k); c.fillStyle = on ? P.fire : P.copperLo; c.fillRect(x - 2 * k, y + 12 * k, 22 * k, 4 * k);
      c.fillStyle = P.steelLo; c.fillRect(x - 26 * k, y - 28 * k, 4 * k, 50 * k); c.fillRect(x - 26 * k, y - 28 * k, 24 * k, 4 * k);
    },
    gears: function (c, x, y, s, t, on, P) {
      var k = s / 64, a = on ? t * 1.6 : 0.2;
      gear(c, x - 9 * k, y - 4 * k, 17 * k, 10, a, P.brass, P.panel2);
      gear(c, x + 15 * k, y + 12 * k, 11 * k, 7, -a * 1.55 + 0.3, P.copper, P.panel2);
      gear(c, x + 14 * k, y - 18 * k, 8 * k, 6, -a * 2.1, P.steel, P.panel2);
    },
    clock: function (c, x, y, s, t, on, P) {
      var k = s / 64; c.fillStyle = P.brassLo; circ(c, x, y, 25 * k); c.fill(); c.fillStyle = metal(c, P, x - 22 * k, y - 22 * k, x + 22 * k, y + 22 * k, P.brassHi, P.brass, P.brassLo); circ(c, x, y, 22 * k); c.fill();
      c.fillStyle = P.night; circ(c, x, y, 17 * k); c.fill(); c.fillStyle = P.brass;
      for (var i = 0; i < 12; i++) { var aa = i * TAU / 12; c.fillRect(x + Math.cos(aa) * 14 * k - 1 * k, y + Math.sin(aa) * 14 * k - 1 * k, 2 * k, 2 * k); }
      var hA = on ? t * 0.4 : -1, mA = on ? t * 3 : 0.8; c.strokeStyle = P.copperHi; c.lineWidth = 3 * k; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(hA) * 9 * k, y + Math.sin(hA) * 9 * k); c.stroke();
      c.lineWidth = 2 * k; c.strokeStyle = P.ink; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(mA) * 14 * k, y + Math.sin(mA) * 14 * k); c.stroke();
      c.fillStyle = P.brass; c.fillRect(x - 3 * k, y - 31 * k, 6 * k, 6 * k);
    },
    loco: function (c, x, y, s, t, on, P) {
      var k = s / 64, a = on ? t * 4 : 0;
      c.fillStyle = metal(c, P, 0, y - 14 * k, 0, y + 6 * k, P.copperHi, P.copper, P.copperLo); rr(c, x - 24 * k, y - 12 * k, 34 * k, 16 * k, 7 * k); c.fill();
      c.fillStyle = P.steelLo; c.fillRect(x + 8 * k, y - 22 * k, 18 * k, 26 * k); c.fillStyle = P.night; c.fillRect(x + 12 * k, y - 18 * k, 10 * k, 8 * k);
      c.fillStyle = P.steelLo; c.fillRect(x - 18 * k, y - 26 * k, 7 * k, 14 * k); c.fillStyle = P.brass; c.fillRect(x - 20 * k, y - 28 * k, 11 * k, 4 * k);
      c.fillStyle = P.brass; c.fillRect(x - 6 * k, y - 18 * k, 6 * k, 6 * k);
      for (var i = 0; i < 3; i++) { var wx = x - 16 * k + i * 15 * k, wy = y + 12 * k; c.fillStyle = P.steel; circ(c, wx, wy, 6 * k); c.fill(); c.fillStyle = P.night; circ(c, wx, wy, 2.4 * k); c.fill();
        c.fillStyle = P.brass; c.fillRect(wx + Math.cos(a + i) * 4 * k - 1 * k, wy + Math.sin(a + i) * 4 * k - 1 * k, 2 * k, 2 * k); }
      c.fillStyle = P.brassLo; c.fillRect(x - 16 * k + Math.cos(a) * 3 * k, y + 11 * k, 30 * k, 2 * k);
    },
    airship: function (c, x, y, s, t, on, P) {
      var k = s / 64, b = on ? Math.sin(t * 1.8) * 2 * k : 0;
      c.fillStyle = metal(c, P, 0, y - 22 * k, 0, y + 2 * k, P.brassHi, P.brass, P.brassLo); c.beginPath(); c.ellipse(x, y - 10 * k + b, 26 * k, 12 * k, 0, 0, TAU); c.fill();
      c.fillStyle = P.copperLo; c.fillRect(x - 24 * k, y - 11 * k + b, 48 * k, 2 * k); c.fillRect(x - 2 * k, y - 22 * k + b, 4 * k, 24 * k);
      c.fillStyle = P.copper; c.beginPath(); c.moveTo(x + 22 * k, y - 10 * k + b); c.lineTo(x + 32 * k, y - 20 * k + b); c.lineTo(x + 32 * k, y + b); c.closePath(); c.fill();
      c.strokeStyle = P.steelLo; c.lineWidth = 1.5 * k; c.beginPath(); c.moveTo(x - 10 * k, y + 1 * k + b); c.lineTo(x - 8 * k, y + 8 * k + b); c.moveTo(x + 10 * k, y + 1 * k + b); c.lineTo(x + 8 * k, y + 8 * k + b); c.stroke();
      c.fillStyle = P.copperLo; rr(c, x - 11 * k, y + 8 * k + b, 22 * k, 9 * k, 3 * k); c.fill(); c.fillStyle = P.glow; c.fillRect(x - 6 * k, y + 10 * k + b, 3 * k, 3 * k); c.fillRect(x + 3 * k, y + 10 * k + b, 3 * k, 3 * k);
      if (on) { var pa = t * 14; c.fillStyle = P.steel; c.fillRect(x - 32 * k, y - 10 * k + b + Math.sin(pa) * 6 * k - 1 * k, 3 * k, 2 * k + Math.abs(Math.cos(pa)) * 6 * k); }
    },
    scope: function (c, x, y, s, t, on, P) {
      var k = s / 64; c.strokeStyle = P.steelLo; c.lineWidth = 3 * k; c.beginPath(); c.moveTo(x, y); c.lineTo(x - 14 * k, y + 24 * k); c.moveTo(x, y); c.lineTo(x + 14 * k, y + 24 * k); c.moveTo(x, y); c.lineTo(x, y + 24 * k); c.stroke();
      c.save(); c.translate(x, y - 4 * k); c.rotate(-0.6 + (on ? Math.sin(t * 0.6) * 0.15 : 0));
      c.fillStyle = metal(c, P, 0, -8 * k, 0, 8 * k, P.brassHi, P.brass, P.brassLo); c.fillRect(-20 * k, -6 * k, 36 * k, 12 * k); c.fillStyle = P.copper; c.fillRect(14 * k, -8 * k, 10 * k, 16 * k); c.fillRect(-24 * k, -4 * k, 6 * k, 8 * k);
      c.fillStyle = on ? P.glow : P.steel; c.fillRect(22 * k, -5 * k, 3 * k, 10 * k); c.restore();
      if (on) { c.fillStyle = P.brassHi; var tw = (Math.sin(t * 3) + 1) / 2; c.globalAlpha = 0.4 + tw * 0.6; c.fillRect(x + 18 * k, y - 30 * k, 3 * k, 3 * k); c.fillRect(x - 22 * k, y - 26 * k, 2 * k, 2 * k); c.globalAlpha = 1; }
    },
    heart: function (c, x, y, s, t, on, P) {   // сердце Горна: раскалённое ядро в кольцах
      var k = s / 64, pu = on ? 1 + Math.sin(t * 3) * 0.08 : 0.9;
      if (on && !P.pixel) { var gr = c.createRadialGradient(x, y, 2, x, y, 30 * k); gr.addColorStop(0, 'rgba(255,200,90,.65)'); gr.addColorStop(1, 'rgba(255,120,40,0)'); c.fillStyle = gr; circ(c, x, y, 30 * k); c.fill(); }
      c.strokeStyle = P.brass; c.lineWidth = 3 * k; c.beginPath(); c.ellipse(x, y, 24 * k, 9 * k, on ? t * 0.7 : 0.3, 0, TAU); c.stroke();
      c.strokeStyle = P.copper; c.beginPath(); c.ellipse(x, y, 24 * k, 9 * k, (on ? -t * 0.9 : -0.6) + 1.2, 0, TAU); c.stroke();
      c.fillStyle = on ? P.fire : P.copperLo; circ(c, x, y, 11 * k * pu); c.fill(); c.fillStyle = on ? P.glow : P.copper; circ(c, x, y, 6 * k * pu); c.fill();
    }
  };
  function machine(c, id, x, y, s, t, on, P) {
    var f = ART[id]; if (!f) return; c.save();
    if (!on) { c.globalAlpha = P.pixel ? 1 : 0.85; }
    f(c, x, y, s, t, on, P); c.restore();
  }
  // силуэт закрытого цеха
  function silhouette(c, id, x, y, s, t, P) {
    var Q = Object.assign({}, P); ['copper', 'copperHi', 'copperLo', 'brass', 'brassHi', 'brassLo', 'steel', 'steelLo', 'glow', 'fire', 'ink', 'night', 'panel2'].forEach(function (k) { Q[k] = P.pixel ? '#1c0c00' : 'rgba(10,6,4,.78)'; });
    Q.pixel = true; ART[id](c, x, y, s, 0, false, Q);
  }

  // ---------- сцена мастерской (логические координаты 480×352, origin — верх сцены) ----------
  var SW = 480, SH = 352;
  var SLOTS = []; for (var r = 0; r < 2; r++) for (var q = 0; q < 5; q++) SLOTS.push({ x: 48 + q * 96, y: 50 + r * 82 });
  var BOILER = { x: 240, y: 262, w: 150, h: 128 };
  var wallCache = {};
  function wall(P) {
    var key = P.pixel ? 'r' : 'm'; if (wallCache[key]) return wallCache[key];
    var cv = typeof document !== 'undefined' ? document.createElement('canvas') : null; if (!cv) return null;
    cv.width = SW; cv.height = SH; var c = cv.getContext('2d');
    c.fillStyle = metal(c, P, 0, 0, 0, SH, P.wallA, P.wallA, P.wallB); c.fillRect(0, 0, SW, SH);
    for (var y = 0, row = 0; y < SH - 30; y += 22, row++) for (var x = (row % 2) * -24; x < SW; x += 48) {
      c.fillStyle = P.brick; c.fillRect(x, y, 48, 2); c.fillRect(x, y, 2, 22); c.fillStyle = P.brickHi; c.fillRect(x + 2, y + 2, 44, 2);
    }
    // окно-арка с «ночным» небом справа и слева за цехами — тёплый свет
    if (!P.pixel) { var gr = c.createRadialGradient(240, 250, 20, 240, 250, 260); gr.addColorStop(0, 'rgba(255,150,60,.22)'); gr.addColorStop(1, 'rgba(255,150,60,0)'); c.fillStyle = gr; c.fillRect(0, 0, SW, SH); }
    c.fillStyle = P.floor; c.fillRect(0, SH - 30, SW, 30); c.fillStyle = P.floorLine; c.fillRect(0, SH - 30, SW, 3);
    for (var i = 0; i < SW; i += 40) { c.fillStyle = P.brick; c.fillRect(i, SH - 27, 2, 27); }
    // магистраль труб за цехами
    c.fillStyle = P.copperLo; c.fillRect(0, 168, SW, 10); c.fillStyle = P.copper; c.fillRect(0, 169, SW, 4);
    for (var j = 24; j < SW; j += 96) { c.fillStyle = P.brassLo; c.fillRect(j - 4, 165, 8, 16); }
    wallCache[key] = cv; return cv;
  }
  function scene(c, st, t, P) {
    var w = wall(P); if (w) c.drawImage(w, 0, 0); else { c.fillStyle = P.wallA; c.fillRect(0, 0, SW, SH); }
    var lv = st.lv, B = BOILER;
    // стойки-полки цехов
    for (var i = 0; i < SLOTS.length; i++) {
      var s = SLOTS[i], own = lv[i] > 0, next = !own && (i === 0 || lv[i - 1] > 0);
      c.fillStyle = P.pixel ? P.brassLo : 'rgba(0,0,0,.25)'; c.fillRect(s.x - 40, s.y + 30, 80, 5);
      c.fillStyle = P.steelLo; c.fillRect(s.x - 36, s.y + 35, 4, 6); c.fillRect(s.x + 32, s.y + 35, 4, 6);
      if (own) {
        if (!P.pixel) { var gl = c.createRadialGradient(s.x, s.y, 4, s.x, s.y, 44); gl.addColorStop(0, 'rgba(255,170,80,.16)'); gl.addColorStop(1, 'rgba(255,170,80,0)'); c.fillStyle = gl; c.fillRect(s.x - 46, s.y - 44, 92, 88); }
        machine(c, st.ids[i], s.x, s.y - 2, 60, t + i * 0.7, true, P);
        // труба к магистрали
        c.fillStyle = P.copperLo; c.fillRect(s.x - 3, s.y + 35, 6, 168 - (s.y + 35) > 0 ? 168 - (s.y + 35) : 0);
      } else {
        silhouette(c, st.ids[i], s.x, s.y - 2, 60, t, P);
        if (next) { c.strokeStyle = P.brass; c.lineWidth = 2; c.setLineDash && c.setLineDash([4, 4]); rr(c, s.x - 36, s.y - 34, 72, 64, 8); c.stroke(); c.setLineDash && c.setLineDash([]); }
        lock(c, s.x, s.y + 2, P, next);
      }
    }
    // котёл: дымовая труба, корпус, купол, топка, манометр
    var bx = B.x - B.w / 2, by = B.y - B.h / 2, sq = st.squash || 0;
    c.fillStyle = P.steelLo; c.fillRect(B.x + 44, by - 70, 18, 80); c.fillStyle = P.brass; c.fillRect(B.x + 40, by - 76, 26, 8);
    c.save(); c.translate(B.x, B.y + B.h / 2); c.scale(1 + sq * 0.05, 1 - sq * 0.06); c.translate(-B.x, -(B.y + B.h / 2));
    if (!P.pixel) { c.fillStyle = P.shadow; c.beginPath(); c.ellipse(B.x, by + B.h + 4, B.w * 0.55, 10, 0, 0, TAU); c.fill(); }
    c.fillStyle = metal(c, P, bx, 0, bx + B.w, 0, P.copperHi, P.copper, P.copperLo); rr(c, bx, by, B.w, B.h, P.pixel ? 4 : 26); c.fill();
    c.fillStyle = metal(c, P, 0, by - 30, 0, by + 4, P.copperHi, P.copper, P.copperLo); c.beginPath(); c.ellipse(B.x, by + 4, B.w * 0.36, 30, 0, Math.PI, TAU); c.fill();
    c.fillStyle = P.brass; c.fillRect(B.x - 8, by - 34, 16, 10);
    c.fillStyle = P.brassLo; c.fillRect(bx + 4, by + 30, B.w - 8, 6); c.fillRect(bx + 4, by + B.h - 34, B.w - 8, 6);
    rivets(c, bx + 14, by + 33, B.w - 28, 9, P.brassHi); rivets(c, bx + 14, by + B.h - 31, B.w - 28, 9, P.brassHi);
    if (!P.pixel) { c.fillStyle = 'rgba(255,255,255,.13)'; rr(c, bx + 12, by + 10, 14, B.h - 24, 7); c.fill(); }
    // топка
    var fl = 0.6 + 0.4 * Math.sin(t * 11) * Math.sin(t * 7.3), heat = Math.min(1, (st.pressure || 0) * 1.2 + (st.boost ? 0.6 : 0.15));
    c.fillStyle = P.night; rr(c, B.x - 30, by + B.h - 28, 60, 22, 4); c.fill();
    c.fillStyle = P.fire; c.globalAlpha = 0.5 + 0.5 * heat * fl; rr(c, B.x - 26, by + B.h - 24, 52, 16, 3); c.fill(); c.globalAlpha = 1;
    c.fillStyle = P.glow; c.globalAlpha = 0.3 + 0.7 * heat * fl; c.fillRect(B.x - 18, by + B.h - 16, 36, 5); c.globalAlpha = 1;
    // манометр
    var gx = B.x, gy = by + 66, gr2 = 24;
    c.fillStyle = P.brassLo; circ(c, gx, gy, gr2 + 4); c.fill(); c.fillStyle = P.pixel ? P.ink : '#f6ecd9'; circ(c, gx, gy, gr2); c.fill();
    c.strokeStyle = P.bad; c.lineWidth = 4; c.beginPath(); c.arc(gx, gy, gr2 - 5, -0.35, 0.55); c.stroke();
    c.strokeStyle = P.steelLo; c.lineWidth = 2; for (var m = 0; m <= 8; m++) { var ma = Math.PI * 0.8 + m * Math.PI * 1.4 / 8; c.beginPath(); c.moveTo(gx + Math.cos(ma) * (gr2 - 3), gy + Math.sin(ma) * (gr2 - 3)); c.lineTo(gx + Math.cos(ma) * (gr2 - 8), gy + Math.sin(ma) * (gr2 - 8)); c.stroke(); }
    var na = Math.PI * 0.8 + Math.PI * 1.4 * Math.min(1, 0.12 + heat * 0.85 + Math.sin(t * 20) * 0.01);
    c.strokeStyle = P.bad; c.lineWidth = 3; c.beginPath(); c.moveTo(gx, gy); c.lineTo(gx + Math.cos(na) * (gr2 - 6), gy + Math.sin(na) * (gr2 - 6)); c.stroke();
    c.fillStyle = P.steelLo; circ(c, gx, gy, 4); c.fill();
    c.restore();
    // клапаны-свистки по бокам
    c.fillStyle = P.brass; c.fillRect(bx - 12, by + 50, 14, 8); c.fillRect(bx + B.w - 2, by + 50, 14, 8);
    // пар
    var puffs = st.puffs || [];
    for (var p = 0; p < puffs.length; p++) { var pf = puffs[p], al = Math.max(0, pf.t / pf.life) * 0.55; c.fillStyle = P.steam + (P.pixel ? Math.min(1, al * 1.6).toFixed(2) : al.toFixed(2)) + ')'; circ(c, pf.x, pf.y, pf.r); c.fill(); }
    // дирижабль-почтальон с ящиком
    if (st.chest) { var a = st.chest; airship(c, a.x, a.y, t, P); }
  }
  function lock(c, x, y, P, next) {
    c.fillStyle = next ? P.brass : P.dim; c.strokeStyle = next ? P.brass : P.dim; c.lineWidth = 3;
    c.beginPath(); c.arc(x, y - 6, 7, Math.PI, TAU); c.stroke(); c.fillRect(x - 10, y - 6, 20, 15);
    c.fillStyle = P.night; c.fillRect(x - 2, y - 1, 4, 6);
  }
  function airship(c, x, y, t, P) {
    var b = Math.sin(t * 2) * 3;
    machine(c, 'airship', x, y + b, 74, t, true, P);
    c.strokeStyle = P.steelLo; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x - 4, y + 14 + b); c.lineTo(x - 8, y + 34 + b); c.moveTo(x + 4, y + 14 + b); c.lineTo(x + 8, y + 34 + b); c.stroke();
    c.fillStyle = P.copperLo; c.fillRect(x - 13, y + 32 + b, 26, 20); c.fillStyle = P.brass; c.fillRect(x - 13, y + 32 + b, 26, 4); c.fillRect(x - 2, y + 32 + b, 4, 20);
    var gl = (Math.sin(t * 6) + 1) / 2; c.strokeStyle = P.glow; c.globalAlpha = 0.4 + gl * 0.6; c.lineWidth = 2; rr(c, x - 17, y + 28 + b, 34, 28, 5); c.stroke(); c.globalAlpha = 1;
  }

  // ---------- примитивы UI ----------
  function panel(c, x, y, w, h, P, o) {
    o = o || {}; var r = P.pixel ? 0 : (o.r == null ? 12 : o.r);
    if (!P.pixel && o.shadow) { c.save(); c.shadowColor = 'rgba(0,0,0,.5)'; c.shadowBlur = 18; c.fillStyle = o.fill || P.panel; rr(c, x, y, w, h, r); c.fill(); c.restore(); }
    c.fillStyle = o.fill || P.panel; rr(c, x, y, w, h, r); c.fill();
    if (o.line !== false) { c.strokeStyle = o.line || P.line; c.lineWidth = P.pixel ? 2 : 1; rr(c, x + 0.5, y + 0.5, w - 1, h - 1, r); c.stroke(); }
  }
  // кнопка: kind — 'buy' | 'ad' | 'gold' | 'plain'; on — доступна; hot — выделена клавиатурой
  function button(g, c, x, y, w, h, l1, l2, P, o) {
    o = o || {}; var on = o.on !== false, kind = o.kind || 'buy', r = P.pixel ? 0 : 10;
    var fill = !on ? P.btnOff : kind === 'ad' ? P.adBg : kind === 'gold' ? P.copperLo : P.btn;
    var line = !on ? P.line : kind === 'ad' ? P.ad : kind === 'gold' ? P.brass : P.copper;
    if (!P.pixel && on) { var gr = c.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, kind === 'ad' ? '#24394c' : kind === 'gold' ? '#a2582a' : P.btnHi); gr.addColorStop(1, fill); fill = gr; }
    c.fillStyle = fill; rr(c, x, y, w, h, r); c.fill();
    c.strokeStyle = o.hot ? P.ink : line; c.lineWidth = o.hot ? 2.5 : (P.pixel ? 2 : 1.5); rr(c, x + 1, y + 1, w - 2, h - 2, r); c.stroke();
    var col = !on ? P.dim : kind === 'ad' ? P.ad : P.ink;
    if (l2) {
      g.text(l1, x + w / 2, y + h / 2 - 3, { size: o.size || 13, align: 'center', color: col, weight: 800, maxWidth: w - 10, minSize: 8, font: P.font });
      g.text(l2, x + w / 2, y + h / 2 + 15, { size: (o.size || 13) + 1, align: 'center', color: on ? (o.c2 || P.brassHi) : (o.c2off || P.bad), weight: 900, maxWidth: w - 10, minSize: 8, font: P.font });
    } else g.text(l1, x + w / 2, y + h / 2 + 5, { size: o.size || 14, align: 'center', color: col, weight: 800, maxWidth: w - 12, minSize: 8, font: P.font });
  }
  function bar(c, x, y, w, h, f, P, col) {
    c.fillStyle = P.pixel ? P.panel2 : 'rgba(0,0,0,.35)'; c.fillRect(x, y, w, h);
    c.fillStyle = col || P.copper; c.fillRect(x, y, Math.max(0, Math.min(1, f)) * w, h);
  }
  function coin(c, x, y, r, P) {   // медная монета-шайба
    c.fillStyle = P.copperLo; circ(c, x, y + 1, r); c.fill(); c.fillStyle = P.copperHi; circ(c, x, y, r); c.fill();
    c.fillStyle = P.copper; circ(c, x, y, r * 0.62); c.fill(); c.fillStyle = P.copperLo; c.fillRect(x - r * 0.18, y - r * 0.18, r * 0.36, r * 0.36);
  }
  function mark(c, x, y, r, P) {   // клеймо мастера — латунная звезда-печать
    c.fillStyle = P.brassLo; circ(c, x, y, r + 1); c.fill(); c.fillStyle = P.brass; c.beginPath();
    for (var i = 0; i < 16; i++) { var a = -Math.PI / 2 + i * Math.PI / 8, rad = i % 2 ? r * 0.72 : r; c.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); } c.closePath(); c.fill();
    c.fillStyle = P.brassLo; circ(c, x, y, r * 0.42); c.fill();
  }
  // значок чертежа
  function blueprint(c, x, y, s, kind, P) {
    c.fillStyle = P.pixel ? '#0054a8' : '#2b4a6b'; c.fillRect(x - s / 2, y - s / 2, s, s);
    c.strokeStyle = P.pixel ? '#54fcfc' : '#9cc9ef'; c.lineWidth = 1.5; c.strokeRect(x - s / 2 + 3, y - s / 2 + 3, s - 6, s - 6);
    c.beginPath(); if (kind === 'tap' || kind === 'tapPct') { c.moveTo(x - 8, y + 8); c.lineTo(x + 6, y - 6); c.moveTo(x + 2, y - 10); c.lineTo(x + 10, y - 2); }
    else if (kind === 'cap' || kind === 'rate') { c.arc(x, y, 9, 0, TAU); c.moveTo(x, y); c.lineTo(x, y - 6); c.moveTo(x, y); c.lineTo(x + 5, y); }
    else if (kind === 'boost') { c.moveTo(x - 4, y - 10); c.lineTo(x - 8, y + 2); c.lineTo(x, y + 2); c.lineTo(x - 4, y + 10); c.lineTo(x + 8, y - 3); c.lineTo(x, y - 3); c.lineTo(x + 4, y - 10); }
    else if (kind === 'all') { c.moveTo(x - 10, y + 6); c.lineTo(x - 3, y - 2); c.lineTo(x + 2, y + 3); c.lineTo(x + 10, y - 8); }
    else { c.arc(x, y, 8, 0, TAU); c.moveTo(x - 12, y); c.lineTo(x + 12, y); c.moveTo(x, y - 12); c.lineTo(x, y + 12); }
    c.stroke();
  }

  M.R = { PAL: PAL, rr: rr, circ: circ, gear: gear, machine: machine, silhouette: silhouette, scene: scene, SLOTS: SLOTS, BOILER: BOILER, SW: SW, SH: SH,
    panel: panel, button: button, bar: bar, coin: coin, mark: mark, blueprint: blueprint, airship: airship, ART: ART };
})(typeof window !== 'undefined' ? window : globalThis);
