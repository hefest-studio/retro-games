/* ЗВЕРО-ОТРЯД · общий рендер мира: Старая Мастерская (дощатые стены, балки, окна с лучами, полки, шестерни), блоки с мхом, плиты и ворота,
   жуки-заводняки, Колотун, ёж Пыж и заяц Тяпа (спрайты 34–40 px с ходьбой, прыжком, висением, упором), упругий канат (провисает/натягивается).
   Один рендер на обе темы: палитра P = ZVERO.modern | ZVERO.classic. В retro (P.pixel) — без градиентов, мир рисуется в буфер половинного размера
   (ui.js). Статические слои (фон, блоки) кэшируются на уровень и тему. ZVERO.render.world(ctx, S, P, time) — в координатах 960×544. */
(function (global) {
  'use strict';
  var Z = global.ZVERO = global.ZVERO || {};
  var PI = Math.PI, TAU = PI * 2, TS = 32, W = 960, H = 544, COLS = 30, ROWS = 17;

  // ---------- Палитры ----------
  Z.modern = {
    name: 'modern', pixel: false, font: 'Inter, system-ui, "Segoe UI", sans-serif',
    sky: [['#2a1c12', '#4b3322'], ['#13242b', '#2a4350'], ['#241a33', '#46325a']],
    plank: '#4d3827', plank2: '#58412d', seam: '#2c1f15', beam: '#2a1d13', beamHi: '#3b2a1b', bolt: '#a58e6f',
    block: '#7c5a38', blockTop: '#b08a54', blockDark: '#4e3823', blockHi: '#9a7448', moss: '#78a94b', mossDark: '#4f7a33', nail: '#d6c3a0',
    win: '#9fd3e6', winDark: '#274655', lamp: '#ffe2a0', shelf: '#6b4a2c', jar: '#79b8a5', can: '#c9684e', metal: '#8e9aa8', metalDark: '#5a6572',
    pyzh: '#8a6240', pyzhHi: '#a87c52', spine: '#3a2616', belly: '#f0d4a6', nose: '#2a1a12', ear: '#e8a98c',
    tyapa: '#a7bddb', tyapaHi: '#c5d6ec', tyapaBelly: '#f7f4ec', tyapaEar: '#eaa9b8', outline: 'rgba(24,14,8,.85)', eye: '#ffffff', pupil: '#1c120c',
    rope: '#e2bd72', ropeDark: '#7d5c24', ropeHot: '#ff9a5a', star: '#ffd84a', starHi: '#fff3a8', door: '#b8702c', doorDark: '#6e3f15', doorGlow: 'rgba(255,214,120,.55)',
    plate: '#d9534f', plateBase: '#6b3a2a', plateOn: '#7ed56f', gate: '#8b5a2b', gateBand: '#6c7a89', spike: '#d4dbe2', spikeDark: '#7d8896',
    bug: '#e0903c', bugDark: '#8a4d1c', bugKey: '#cfd6dc', boss: '#6f8497', bossDark: '#3e4d5b', bossHi: '#9db2c4', bossEye: '#ffd84a', hammer: '#b9722d',
    gear: '#9aa5b1', gearDark: '#5c6773', mark: 'rgba(255,90,70,.85)', dust: 'rgba(230,210,170,.55)',
    ink: '#f6efe3', muted: '#c2ad90', accent: '#ffcf5a', good: '#8be07a', bad: '#ff7a68', panel: 'rgba(30,21,14,.9)', line: '#8a6a40', hudBg: 'rgba(18,11,7,.62)', barBg: '#3b2a1b'
  };
  Z.classic = {
    name: 'retro', pixel: true, font: '"Courier New", ui-monospace, monospace',
    sky: [['#1c0f08', '#2c1a0e'], ['#081c28', '#103848'], ['#1c1030', '#34205c']],
    plank: '#40240f', plank2: '#4c2c14', seam: '#201008', beam: '#241208', beamHi: '#38200e', bolt: '#c8b080',
    block: '#a86a28', blockTop: '#e8b050', blockDark: '#582c10', blockHi: '#c88438', moss: '#58c040', mossDark: '#307820', nail: '#f8e0a0',
    win: '#78c8f0', winDark: '#104058', lamp: '#f8e888', shelf: '#7c4a20', jar: '#40c8a0', can: '#e05830', metal: '#a8a8b8', metalDark: '#585868',
    pyzh: '#c87830', pyzhHi: '#e09848', spine: '#401800', belly: '#f8d8a0', nose: '#000000', ear: '#f09068',
    tyapa: '#68a8f8', tyapaHi: '#98c8f8', tyapaBelly: '#f8f8f8', tyapaEar: '#f890b0', outline: '#000000', eye: '#ffffff', pupil: '#000000',
    rope: '#f8d838', ropeDark: '#a07818', ropeHot: '#f89838', star: '#f8f038', starHi: '#ffffff', door: '#e86820', doorDark: '#783008', doorGlow: '#f8d858',
    plate: '#e83820', plateBase: '#583018', plateOn: '#58d838', gate: '#a06018', gateBand: '#a8a8b8', spike: '#f8f8f8', spikeDark: '#888898',
    bug: '#f89030', bugDark: '#903800', bugKey: '#e8e8f0', boss: '#78a0c8', bossDark: '#305078', bossHi: '#a8c8e8', bossEye: '#f8f038', hammer: '#d07828',
    gear: '#a8a8b8', gearDark: '#585868', mark: '#f83838', dust: '#c8a870',
    ink: '#ffffff', muted: '#a8a8b8', accent: '#f8d858', good: '#58d838', bad: '#f83838', panel: '#000000', line: '#a86a28', hudBg: '#000000', barBg: '#303030'
  };

  function hash(n) { n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); n ^= n >>> 16; return (n >>> 0) / 4294967296; }
  function rr(ctx, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function ell(ctx, x, y, rx, ry, c, rot) { ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), rot || 0, 0, TAU); ctx.fill(); }
  function circ(ctx, x, y, r, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, r), 0, TAU); ctx.fill(); }
  function line(ctx, x1, y1, x2, y2, w, c) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
  function glow(ctx, P, x, y, r, c0) {
    if (P.pixel) return;
    var g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, c0); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore();
  }
  function gearShape(ctx, x, y, r, teeth, rot, col, hole, P) {
    ctx.fillStyle = col; ctx.beginPath();
    for (var i = 0; i < teeth * 2; i++) {
      var a = rot + i * PI / teeth, rad = i % 2 ? r * 0.82 : r;
      var a0 = a - PI / teeth * 0.5, a1 = a + PI / teeth * 0.5;
      ctx.lineTo(x + Math.cos(a0) * rad, y + Math.sin(a0) * rad); ctx.lineTo(x + Math.cos(a1) * rad, y + Math.sin(a1) * rad);
    }
    ctx.closePath(); ctx.fill();
    if (hole) circ(ctx, x, y, r * 0.32, hole);
  }

  // ---------- Статический слой: фон мастерской ----------
  function solidCh(c) { return c === '#'; }
  function tileAt(S, c, r) { if (c < 0 || c >= COLS || r < 0) return '#'; if (r >= ROWS) return S.tiles[ROWS - 1][c] === '#' ? '#' : '.'; return S.tiles[r][c]; }

  function paintBack(ctx, S, P, seed) {
    var sk = P.sky[S.sky || 0], i, g;
    if (P.pixel) { ctx.fillStyle = sk[0]; ctx.fillRect(0, 0, W, H); ctx.fillStyle = sk[1]; ctx.fillRect(0, H * 0.55, W, H * 0.45); }
    else { g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, sk[0]); g.addColorStop(1, sk[1]); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
    // дощатая стена: вертикальные доски
    for (i = 0; i < 20; i++) {
      ctx.fillStyle = i % 2 ? P.plank : P.plank2; ctx.globalAlpha = P.pixel ? 0.55 : 0.5; ctx.fillRect(i * 48, 0, 48, H); ctx.globalAlpha = 1;
      ctx.fillStyle = P.seam; ctx.fillRect(i * 48, 0, P.pixel ? 2 : 1.5, H);
      for (var k = 0; k < 3; k++) { var yy = hash(seed * 31 + i * 7 + k) * H; ctx.fillStyle = P.seam; ctx.globalAlpha = 0.5; ctx.fillRect(i * 48 + 10 + hash(i + k) * 20, yy, 2, 10 + hash(i * 3 + k) * 16); ctx.globalAlpha = 1; }
    }
    // горизонтальные балки
    [112, 336].forEach(function (y, n) {
      ctx.fillStyle = P.beam; ctx.fillRect(0, y, W, 16); ctx.fillStyle = P.beamHi; ctx.fillRect(0, y, W, 3);
      for (var x = 40 + n * 30; x < W; x += 150) { circ(ctx, x, y + 9, 3, P.bolt); }
    });
    // окна с лучами
    var wcount = 2, wx = [150 + hash(seed) * 90, 560 + hash(seed + 5) * 140];
    for (i = 0; i < wcount; i++) {
      var x0 = wx[i], y0 = 150 + hash(seed + i) * 40;
      if (!P.pixel) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; g = ctx.createLinearGradient(x0, y0 + 40, x0 + 140, y0 + 420);
        g.addColorStop(0, 'rgba(255,235,170,.20)'); g.addColorStop(1, 'rgba(255,235,170,0)'); ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(x0, y0 + 6); ctx.lineTo(x0 + 54, y0 + 6); ctx.lineTo(x0 + 210, y0 + 440); ctx.lineTo(x0 + 120, y0 + 440); ctx.closePath(); ctx.fill(); ctx.restore();
      }
      ctx.fillStyle = P.seam; ctx.fillRect(x0 - 5, y0 - 5, 64, 76);
      ctx.fillStyle = P.winDark; ctx.fillRect(x0, y0, 54, 66); ctx.fillStyle = P.win; ctx.globalAlpha = 0.55; ctx.fillRect(x0 + 3, y0 + 3, 22, 29); ctx.fillRect(x0 + 29, y0 + 3, 22, 29); ctx.globalAlpha = 0.4; ctx.fillRect(x0 + 3, y0 + 36, 22, 27); ctx.fillRect(x0 + 29, y0 + 36, 22, 27); ctx.globalAlpha = 1;
      ctx.fillStyle = P.beamHi; ctx.fillRect(x0 + 25, y0, 4, 66); ctx.fillRect(x0, y0 + 32, 54, 4);
    }
    // полки с банками и инструментами
    for (i = 0; i < 2; i++) {
      var sx = 330 + i * 330 + hash(seed + 11 + i) * 60, sy = 80 + hash(seed + 21 + i) * 40;
      ctx.fillStyle = P.shelf; ctx.fillRect(sx, sy, 110, 8); ctx.fillStyle = P.seam; ctx.fillRect(sx, sy + 8, 110, 3);
      ctx.fillRect(sx + 8, sy + 11, 5, 12); ctx.fillRect(sx + 97, sy + 11, 5, 12);
      for (var j = 0; j < 4; j++) {
        var t = hash(seed * 13 + i * 9 + j), bx = sx + 8 + j * 25;
        if (t < 0.4) { ctx.fillStyle = P.jar; rr(ctx, bx, sy - 22, 16, 22, 3); ctx.fill(); ctx.fillStyle = P.seam; ctx.fillRect(bx + 3, sy - 26, 10, 4); }
        else if (t < 0.7) { ctx.fillStyle = P.can; ctx.fillRect(bx, sy - 18, 18, 18); ctx.fillStyle = P.seam; ctx.fillRect(bx, sy - 12, 18, 2); }
        else { line(ctx, bx + 4, sy - 2, bx + 14, sy - 26, 3, P.metalDark); ctx.fillStyle = P.metal; ctx.fillRect(bx + 8, sy - 30, 14, 7); }
      }
    }
    // паутина в верхних углах
    ctx.strokeStyle = P.pixel ? P.metalDark : 'rgba(230,230,240,.22)'; ctx.lineWidth = 1;
    [[32, 32, 1], [W - 32, 32, -1]].forEach(function (c) { for (var q = 1; q < 4; q++) { ctx.beginPath(); ctx.arc(c[0], c[1], q * 18, c[2] > 0 ? 0 : PI / 2, c[2] > 0 ? PI / 2 : PI); ctx.stroke(); } line(ctx, c[0], c[1], c[0] + c[2] * 60, c[1] + 40, 1, ctx.strokeStyle); line(ctx, c[0], c[1], c[0] + c[2] * 40, c[1] + 62, 1, ctx.strokeStyle); });
    // трубы вдоль нижней части
    var py = 400 + hash(seed + 2) * 40; ctx.fillStyle = P.metalDark; ctx.fillRect(0, py, W, 9); ctx.fillStyle = P.metal; ctx.fillRect(0, py, W, 3);
    for (i = 0; i < 6; i++) { ctx.fillStyle = P.metal; ctx.fillRect(80 + i * 170 + hash(i + seed) * 40, py - 3, 8, 15); }
  }

  function paintTiles(ctx, S, P) {
    var r, c, ch, x, y, up, lf, rt, dn, k;
    for (r = 0; r < ROWS; r++) for (c = 0; c < COLS; c++) {
      ch = S.tiles[r][c]; x = c * TS; y = r * TS;
      if (ch === '#') {
        up = !solidCh(tileAt(S, c, r - 1)); lf = !solidCh(tileAt(S, c - 1, r)); rt = !solidCh(tileAt(S, c + 1, r)); dn = !solidCh(tileAt(S, c, r + 1));
        ctx.fillStyle = P.block; ctx.fillRect(x, y, TS, TS);
        // доски: шов посередине, гвозди, сучки
        ctx.fillStyle = P.blockDark; ctx.fillRect(x, y + 15, TS, 2);
        ctx.fillStyle = P.blockHi; ctx.globalAlpha = 0.5; ctx.fillRect(x + 2, y + 3, 12 + hash(r * 31 + c) * 14, 2); ctx.fillRect(x + 4 + hash(c * 17 + r) * 8, y + 20, 10 + hash(r * 5 + c * 3) * 10, 2); ctx.globalAlpha = 1;
        ctx.fillStyle = P.nail; ctx.fillRect(x + 3, y + 7, 2, 2); ctx.fillRect(x + TS - 5, y + 7, 2, 2); ctx.fillRect(x + 3, y + 23, 2, 2); ctx.fillRect(x + TS - 5, y + 23, 2, 2);
        if (hash(r * 97 + c * 13) < 0.2) { circ(ctx, x + 10 + hash(c + r) * 12, y + 11 + hash(c * 5 + r) * 10, 3, P.blockDark); }
        if (lf) { ctx.fillStyle = P.blockDark; ctx.fillRect(x, y, 2, TS); }
        if (rt) { ctx.fillStyle = P.blockDark; ctx.fillRect(x + TS - 2, y, 2, TS); }
        if (dn) { ctx.fillStyle = P.blockDark; ctx.fillRect(x, y + TS - 3, TS, 3); }
        if (up) {
          ctx.fillStyle = P.blockTop; ctx.fillRect(x, y, TS, 7);
          ctx.fillStyle = P.moss; ctx.fillRect(x, y, TS, 4);
          for (k = 0; k < 5; k++) { var tx = x + 2 + k * 6 + hash(r * 7 + c * 11 + k) * 3, th = 3 + hash(r + c * 3 + k) * 5; ctx.fillStyle = k % 2 ? P.moss : P.mossDark; ctx.fillRect(tx, y + 3, 3, th); }
        }
      } else if (ch === '=') {
        ctx.fillStyle = P.blockTop; ctx.fillRect(x, y, TS, 8); ctx.fillStyle = P.blockDark; ctx.fillRect(x, y + 8, TS, 3);
        ctx.fillStyle = P.nail; ctx.fillRect(x + 3, y + 3, 2, 2); ctx.fillRect(x + TS - 5, y + 3, 2, 2);
        ctx.fillStyle = P.blockDark; ctx.fillRect(x + 4, y + 11, 3, 8); ctx.fillRect(x + TS - 7, y + 11, 3, 8);
      } else if (ch === '^') {
        for (k = 0; k < 3; k++) {
          var bx = x + 3 + k * 9;
          ctx.fillStyle = P.spike; ctx.beginPath(); ctx.moveTo(bx, y + TS); ctx.lineTo(bx + 4.5, y + 12); ctx.lineTo(bx + 9, y + TS); ctx.closePath(); ctx.fill();
          ctx.fillStyle = P.spikeDark; ctx.beginPath(); ctx.moveTo(bx + 4.5, y + 12); ctx.lineTo(bx + 9, y + TS); ctx.lineTo(bx + 5.5, y + TS); ctx.closePath(); ctx.fill();
        }
        ctx.fillStyle = P.spikeDark; ctx.fillRect(x, y + TS - 3, TS, 3);
      }
    }
  }
  var cache = {};
  function layer(S, P, kind, seed) {
    var key = kind + S.lv + P.name; if (cache[key]) return cache[key];
    var cv = document.createElement('canvas'), k = P.pixel ? 0.5 : 1; cv.width = W * k; cv.height = H * k;
    var cx = cv.getContext('2d'); cx.setTransform(k, 0, 0, k, 0, 0);
    if (kind === 'b') paintBack(cx, S, P, seed); else paintTiles(cx, S, P);
    cache[key] = cv; return cv;
  }

  // ---------- Динамика фона ----------
  function backAnim(ctx, S, P, t) {
    var seed = S.lv * 7 + 3, i;
    // вращающиеся шестерни на стене
    gearShape(ctx, 90 + hash(seed) * 60, 300, 46, 12, t * 0.35, P.pixel ? P.gearDark : 'rgba(110,120,134,.55)', P.beam, P);
    gearShape(ctx, 150 + hash(seed) * 60 + 62, 342, 28, 8, -t * 0.58 + 0.2, P.pixel ? P.gear : 'rgba(150,160,172,.5)', P.beam, P);
    gearShape(ctx, 760 + hash(seed + 1) * 80, 236, 38, 10, -t * 0.4, P.pixel ? P.gearDark : 'rgba(110,120,134,.5)', P.beam, P);
    // лампа на цепи
    var lx = 470 + hash(seed + 9) * 40, sw = Math.sin(t * 1.3) * 6;
    line(ctx, lx, 32, lx + sw * 0.4, 70, 2, P.metalDark);
    ctx.fillStyle = P.metalDark; ctx.beginPath(); ctx.moveTo(lx + sw * 0.4 - 14, 84); ctx.lineTo(lx + sw * 0.4 + 14, 84); ctx.lineTo(lx + sw * 0.4 + 7, 68); ctx.lineTo(lx + sw * 0.4 - 7, 68); ctx.closePath(); ctx.fill();
    circ(ctx, lx + sw * 0.4, 86, 5, P.lamp);
    glow(ctx, P, lx + sw * 0.4, 90, 130 + Math.sin(t * 7) * 5, 'rgba(255,214,130,.28)');
    // пылинки в лучах
    if (!P.pixel) { ctx.fillStyle = 'rgba(255,240,200,.35)'; for (i = 0; i < 16; i++) { var px = (hash(i * 3 + seed) * W + t * (6 + i)) % W, py = (hash(i * 5 + seed) * H + Math.sin(t + i) * 12 + t * 4) % H; ctx.fillRect(px, py, 2, 2); } }
  }

  // ---------- Предметы ----------
  function drawPlates(ctx, S, P, t) {
    S.plates.forEach(function (p) {
      var x = p.c * TS, y = p.r * TS, on = p.on || (p.latch && S.latched[p.gate]), dy = p.on ? 4 : 0;
      ctx.fillStyle = P.plateBase; ctx.fillRect(x + 2, y + TS - 8, TS - 4, 8);
      ctx.fillStyle = on ? P.plateOn : P.plate; rr(ctx, x + 5, y + TS - 13 + dy, TS - 10, 7 - dy * 0.4, 2); ctx.fill();
      if (p.latch) { ctx.fillStyle = P.nail; ctx.fillRect(x + 14, y + TS - 17 + dy, 4, 4); }
      if (on) glow(ctx, P, x + 16, y + TS - 10, 26, 'rgba(120,230,110,.35)');
    });
  }
  function drawGates(ctx, S, P, t) {
    S.gates.forEach(function (g) {
      var x = g.c * TS, y = g.r * TS, open = S.gateOpen[g.id];
      var below = S.tiles[Math.min(ROWS - 1, g.r + 1)] && S.tiles[Math.min(ROWS - 1, g.r + 1)][g.c];
      var hatch = (S.tiles[g.r][g.c - 1] === g.id || S.tiles[g.r][g.c + 1] === g.id) && S.tiles[g.r - 1] && S.tiles[g.r - 1][g.c] !== g.id && S.tiles[g.r + 1] && S.tiles[g.r + 1][g.c] !== g.id;
      if (open) {
        ctx.fillStyle = P.gateBand; ctx.globalAlpha = 0.55; if (hatch) { ctx.fillRect(x, y, 3, TS); ctx.fillRect(x + TS - 3, y, 3, TS); } else { ctx.fillRect(x + 13, y, 6, 5); }
        ctx.globalAlpha = 1; return;
      }
      ctx.fillStyle = P.gate; ctx.fillRect(x, y, TS, TS);
      ctx.fillStyle = P.blockDark; ctx.fillRect(x, y + 15, TS, 2);
      ctx.fillStyle = P.gateBand; ctx.fillRect(x, y + 3, TS, 4); ctx.fillRect(x, y + 25, TS, 4);
      ctx.fillStyle = P.nail; ctx.fillRect(x + 4, y + 4, 2, 2); ctx.fillRect(x + TS - 6, y + 4, 2, 2); ctx.fillRect(x + 4, y + 26, 2, 2); ctx.fillRect(x + TS - 6, y + 26, 2, 2);
      ctx.fillStyle = P.blockDark; ctx.fillRect(x, y, 2, TS); ctx.fillRect(x + TS - 2, y, 2, TS);
    });
  }
  function drawStars(ctx, S, P, t) {
    S.stars.forEach(function (s) {
      if (s.got) return;
      var y = s.y + Math.sin(t * 3 + s.ph) * 3, r = 11, sc = 1 + Math.sin(t * 5 + s.ph) * 0.08;
      glow(ctx, P, s.x, y, 26, 'rgba(255,216,74,.4)');
      ctx.save(); ctx.translate(s.x, y); ctx.scale(sc, sc); ctx.rotate(Math.sin(t * 2 + s.ph) * 0.15);
      ctx.fillStyle = P.star; ctx.strokeStyle = P.outline; ctx.lineWidth = P.pixel ? 2 : 1.4; ctx.beginPath();
      for (var i = 0; i < 10; i++) { var a = -PI / 2 + i * PI / 5, rad = i % 2 ? r * 0.45 : r; ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); }
      ctx.closePath(); ctx.fill(); ctx.stroke(); circ(ctx, -2, -3, 2, P.starHi); ctx.restore();
    });
  }
  function drawExit(ctx, S, P, t) {
    var e = S.exit; if (!e) return; var x = e.x, y = e.y, w = 38, h = 62;
    if (e.open) glow(ctx, P, x, y - h / 2, 60 + Math.sin(t * 4) * 4, P.doorGlow);
    ctx.fillStyle = P.doorDark; rr(ctx, x - w / 2 - 4, y - h - 4, w + 8, h + 4, 16); ctx.fill();
    ctx.fillStyle = e.open ? '#fff0b0' : P.door; if (P.pixel && e.open) ctx.fillStyle = P.doorGlow;
    ctx.beginPath(); ctx.moveTo(x - w / 2, y); ctx.lineTo(x - w / 2, y - h + 18); ctx.arc(x, y - h + 18, w / 2, PI, 0); ctx.lineTo(x + w / 2, y); ctx.closePath(); ctx.fill();
    if (!e.open) {
      ctx.fillStyle = P.doorDark; ctx.fillRect(x - 1, y - h + 4, 2, h - 4); ctx.fillRect(x - w / 2, y - 40, w, 3); ctx.fillRect(x - w / 2, y - 18, w, 3);
      ctx.fillStyle = P.gateBand; rr(ctx, x - 7, y - 36, 14, 12, 3); ctx.fill(); circ(ctx, x, y - 30, 2, P.seam);
    } else {
      ctx.fillStyle = P.accent; ctx.globalAlpha = 0.5 + Math.sin(t * 6) * 0.2; ctx.fillRect(x - 3, y - h + 20, 6, h - 22); ctx.globalAlpha = 1;
    }
    ctx.fillStyle = P.nail; circ(ctx, x + 10, y - 26, 2, P.nail);
  }

  function drawBug(ctx, e, P, t) {
    var x = e.x, y = e.y;
    if (!e.alive) { var f = Math.max(0, 1 - e.die * 2.2); if (f <= 0) return; ctx.save(); ctx.globalAlpha = f; ctx.translate(x, y); ctx.scale(1.25, 0.35); ell(ctx, 0, -9, 14, 11, P.bug); ctx.restore(); return; }
    ctx.save(); ctx.translate(x, y); ctx.scale(e.dir, 1);
    var ph = e.t * 9;
    for (var i = 0; i < 3; i++) { var lx = -8 + i * 8, sw = Math.sin(ph + i * 2.1) * 3; line(ctx, lx, -6, lx + sw, 0, 2.4, P.bugDark); }
    ctx.fillStyle = P.bug; ctx.beginPath(); ctx.moveTo(-14, -4); ctx.quadraticCurveTo(-14, -22, 0, -22); ctx.quadraticCurveTo(14, -22, 14, -4); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = P.outline; ctx.lineWidth = P.pixel ? 2 : 1.5; ctx.stroke();
    ctx.fillStyle = P.bugDark; ctx.fillRect(-14, -6, 28, 3);
    ctx.fillStyle = P.bugDark; ctx.fillRect(-2, -20, 2, 12);
    // заводной ключ
    ctx.save(); ctx.translate(-2, -23); ctx.rotate(t * 5 + e.t); ctx.fillStyle = P.bugKey; ctx.fillRect(-7, -1.5, 14, 3); circ(ctx, -7, 0, 3, P.bugKey); circ(ctx, 7, 0, 3, P.bugKey); ctx.restore();
    // глаза
    circ(ctx, 7, -13, 4, P.eye); circ(ctx, 8, -13, 2, P.pupil); circ(ctx, 1, -14, 3, P.eye); circ(ctx, 2, -14, 1.5, P.pupil);
    line(ctx, 4, -19, 10, -17, 2, P.pupil);
    ctx.restore();
  }

  function drawBoss(ctx, S, P, t) {
    var B = S.boss; if (!B) return;
    var x = B.x, y = B.y, st = B.state, shake = st === 'dead' ? Math.sin(t * 60) * 3 : 0, lean = 0, bob = Math.sin(t * 3) * 1.5;
    if (st === 'charge') lean = 0.12 * B.dir; if (st === 'stun') lean = 0.9 * B.dir;
    if (st === 'dead') { var f = Math.max(0, 1 - B.die / 1.6); if (f <= 0) return; ctx.globalAlpha = f; }
    ctx.save(); ctx.translate(x + shake, y); if (st === 'stun') { ctx.translate(0, 8); }
    ctx.rotate(lean * 0.35); ctx.scale(B.dir || 1, 1);
    var fl = B.flash > 0 && Math.floor(t * 20) % 2 === 0;
    // гусеницы
    ctx.fillStyle = P.bossDark; rr(ctx, -42, -18, 84, 20, 8); ctx.fill();
    for (var i = 0; i < 6; i++) circ(ctx, -34 + i * 14 + ((st === 'charge' ? t * 60 : 0) % 14), -8, 4, P.gearDark);
    // корпус
    ctx.fillStyle = fl ? '#ffffff' : P.boss; rr(ctx, -36, -88 + bob, 72, 76, 12); ctx.fill(); ctx.strokeStyle = P.outline; ctx.lineWidth = P.pixel ? 3 : 2; ctx.stroke();
    var ga = ctx.globalAlpha; ctx.fillStyle = P.bossHi; ctx.globalAlpha = ga * 0.4; ctx.fillRect(-32, -84 + bob, 20, 60); ctx.globalAlpha = ga;
    ctx.fillStyle = P.bossDark; ctx.fillRect(-36, -48 + bob, 72, 5); ctx.fillRect(-36, -30 + bob, 72, 4);
    for (i = 0; i < 4; i++) circ(ctx, -28 + i * 18.6, -41 + bob, 2, P.bolt);
    // голова-шестерня с глазами
    gearShape(ctx, 4, -90 + bob, 24, 12, t * (st === 'stun' ? 0.5 : 2), P.gear, null, P);
    ctx.fillStyle = P.bossDark; rr(ctx, -12, -100 + bob, 32, 22, 6); ctx.fill();
    if (st === 'stun') { for (var s = 0; s < 2; s++) { ctx.strokeStyle = P.bossEye; ctx.lineWidth = 2; ctx.beginPath(); for (var a = 0; a < 14; a++) { var rr2 = 1 + a * 0.4; ctx.lineTo(-2 + s * 14 + Math.cos(a * 0.8 + t * 8) * rr2, -89 + bob + Math.sin(a * 0.8 + t * 8) * rr2); } ctx.stroke(); } }
    else { circ(ctx, -2, -89 + bob, 5.5, P.bossEye); circ(ctx, 12, -89 + bob, 5.5, P.bossEye); circ(ctx, -1 + (st === 'charge' ? 2 : 0), -89 + bob, 2.5, P.pupil); circ(ctx, 13 + (st === 'charge' ? 2 : 0), -89 + bob, 2.5, P.pupil); line(ctx, -9, -97 + bob, 3, -94 + bob, 3, P.pupil); line(ctx, 18, -97 + bob, 8, -94 + bob, 3, P.pupil); }
    // молот
    var sw = st === 'charge' ? Math.sin(t * 14) * 0.5 : st === 'stun' ? 1.1 : Math.sin(t * 2) * 0.12;
    ctx.save(); ctx.translate(34, -62 + bob); ctx.rotate(-0.6 + sw);
    ctx.fillStyle = P.metalDark; ctx.fillRect(0, -3, 38, 6); ctx.fillStyle = P.hammer; rr(ctx, 32, -14, 24, 28, 5); ctx.fill(); ctx.strokeStyle = P.outline; ctx.lineWidth = P.pixel ? 2 : 1.5; ctx.stroke();
    ctx.fillStyle = P.bossDark; ctx.fillRect(34, -10, 4, 20); ctx.restore();
    ctx.restore(); ctx.globalAlpha = 1;
    if (st === 'stun') for (var q = 0; q < 3; q++) { var aa = t * 4 + q * 2.1; ctx.fillStyle = P.star; ctx.beginPath(); ctx.arc(x + Math.cos(aa) * 30, y - 110 + Math.sin(aa) * 8, 4, 0, TAU); ctx.fill(); }
    if (st === 'charge') for (q = 0; q < 4; q++) { ctx.fillStyle = P.dust; circ(ctx, x - B.dir * (40 + q * 12 + (t * 80 % 12)), y - 4 - q * 3, 6 - q, P.dust); }
  }

  // ---------- Звери ----------
  function earAng(a) { return a.vy < -80 ? -0.15 : a.vy > 120 ? -1.15 : a.on ? -0.3 + Math.sin(a.walk * 2) * 0.1 : -0.7; }
  function drawAnimal(ctx, S, a, P, t, active) {
    if (a.dead > 0) return;
    var blink = Math.floor(t * 1.7 + a.i * 3) % 7 === 0 && (t * 1.7 % 1) < 0.18;
    var run = a.on && Math.abs(a.vx) > 8, bob = run ? Math.sin(a.walk * 2) * 1.6 : Math.sin(t * 2.4 + a.i) * 0.5;
    var sx = 1, sy = 1;
    if (!a.on && a.vy < -50) { sx = 0.92; sy = 1.1; } else if (!a.on && a.vy > 200) { sx = 0.94; sy = 1.08; }
    if (a.land > 0) { var k = a.land / 0.18; sx = 1 + 0.18 * k; sy = 1 - 0.18 * k; }
    if (a.brace) { sx = 1.1; sy = 0.92; }
    var inv = a.inv > 0 && Math.floor(t * 18) % 2 === 0; if (inv) return;
    ctx.save(); ctx.translate(a.x, a.y); ctx.scale(a.face * sx, sy);
    if (a.hang) ctx.rotate(0.12 * Math.sin(t * 6 + a.i));
    var sw = run ? Math.sin(a.walk * 2) * 4 : 0;
    ctx.lineWidth = P.pixel ? 2 : 1.4; ctx.strokeStyle = P.outline; ctx.lineJoin = 'round';
    function fe(x, y, rx, ry, c, rot) { ell(ctx, x, y, rx, ry, c, rot); ctx.stroke(); }
    if (a.i === 0) {   // ёж Пыж
      // задние колючки и хвост
      var body = P.pyzh, n = 11, i;
      ctx.fillStyle = P.spine; ctx.beginPath(); ctx.moveTo(-17, -9 + bob);
      for (i = 0; i <= n; i++) {
        var ang = PI * 1.02 + i * (PI * 0.92 / n), rad = (i % 2 ? 20 : 28) + (a.brace ? 4 : 0) + Math.sin(t * 5 + i) * 0.6;
        ctx.lineTo(-2 + Math.cos(ang) * rad * 0.9, -12 + bob + Math.sin(ang) * rad * 0.92);
      }
      ctx.lineTo(10, -22 + bob); ctx.closePath(); ctx.fill(); ctx.stroke();
      fe(0, -13 + bob, 16, 12, body);
      ctx.fillStyle = P.pyzhHi; ctx.globalAlpha = 0.55; ctx.beginPath(); ctx.ellipse(-3, -18 + bob, 9, 4, -0.3, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
      // лапы
      fe(-6 - sw, -2.5, 5.5, 3.2, P.nose); fe(6 + sw, -2.5, 5.5, 3.2, P.nose);
      // морда
      fe(11, -11 + bob, 9, 7.5, P.belly); fe(19.5, -11.5 + bob, 3, 2.6, P.nose);
      fe(5, -21 + bob, 3.6, 4, P.ear);
      if (blink) line(ctx, 8, -15 + bob, 14, -15 + bob, 2, P.pupil); else { circ(ctx, 12, -15 + bob, 3.6, P.eye); circ(ctx, 13.2, -15 + bob, 1.8, P.pupil); }
      ctx.strokeStyle = P.pupil; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(14, -8 + bob, 3, 0.2, 1.3); ctx.stroke();
    } else {   // заяц Тяпа
      var ea = earAng(a);
      // уши (дальнее)
      ctx.save(); ctx.translate(2, -31 + bob); ctx.rotate(ea - 0.25); fe(0, -9, 3.6, 10, P.tyapa); ell(ctx, 0, -9, 1.6, 7, P.tyapaEar); ctx.restore();
      fe(-11, -13 + bob, 5, 5, P.tyapaBelly);
      fe(0, -14 + bob, 11, 12, P.tyapa);
      fe(2, -9 + bob, 6.5, 8, P.tyapaBelly);
      fe(-5 - sw, -2.5, 7.5, 3.2, P.tyapaHi); fe(7 + sw, -2.5, 5.5, 3, P.tyapaHi);
      // голова
      fe(6, -27 + bob, 8.5, 8, P.tyapa);
      ctx.save(); ctx.translate(7, -33 + bob); ctx.rotate(ea + 0.15); fe(0, -9, 3.8, 10.5, P.tyapaHi); ell(ctx, 0, -9, 1.7, 7.5, P.tyapaEar); ctx.restore();
      fe(13.5, -25 + bob, 2.6, 2.2, P.tyapaEar);
      if (blink) line(ctx, 6, -29 + bob, 12, -29 + bob, 2, P.pupil); else { circ(ctx, 9.5, -29 + bob, 3.3, P.eye); circ(ctx, 10.5, -29 + bob, 1.7, P.pupil); }
      ctx.strokeStyle = P.pupil; ctx.lineWidth = 1; line(ctx, 13, -23 + bob, 18, -22 + bob, 1, P.pupil); line(ctx, 13, -24.5 + bob, 18, -25.5 + bob, 1, P.pupil);
    }
    ctx.restore();
    // пыль при упоре
    if (a.brace && !P.pixel) { ctx.fillStyle = P.dust; ctx.globalAlpha = 0.5; circ(ctx, a.x - 14, a.y - 2, 3, P.dust); circ(ctx, a.x + 14, a.y - 2, 3, P.dust); ctx.globalAlpha = 1; }
    if (a.brace) { ctx.fillStyle = P.ink; ctx.globalAlpha = 0.85; ctx.fillRect(a.x - 9, a.y + 1, 18, 2); ctx.globalAlpha = 1; }
    // маркер активного зверя (соло)
    if (active) {
      var my = a.y - a.h - 16 + Math.sin(t * 5) * 2.5;
      ctx.fillStyle = a.i ? P.tyapaHi : P.pyzhHi; ctx.strokeStyle = P.outline; ctx.lineWidth = P.pixel ? 2 : 1.5;
      ctx.beginPath(); ctx.moveTo(a.x, my + 8); ctx.lineTo(a.x - 7, my - 4); ctx.lineTo(a.x + 7, my - 4); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  }

  function drawRope(ctx, S, P, t) {
    var A = S.an[0], B = S.an[1]; if (A.dead > 0 || B.dead > 0) return;
    var ax = A.x, ay = A.y - A.h * 0.55, bx = B.x, by = B.y - B.h * 0.55, d = Math.sqrt((bx - ax) * (bx - ax) + (by - ay) * (by - ay));
    var slack = Math.max(0, S.len - d), sag = Math.min(46, Math.sqrt(Math.max(0, S.len * S.len - d * d)) * 0.55), tens = S.rope.tension, N = 22, i, pts = [];
    var vib = d > S.len - 2 ? Math.sin(t * 40) * Math.min(1.6, 0.4 + tens * 4) : 0;
    for (i = 0; i <= N; i++) { var u = i / N, px = ax + (bx - ax) * u, py = ay + (by - ay) * u + sag * 4 * u * (1 - u) * (slack > 1 ? 1 : 0.0) + vib * Math.sin(u * PI) * 1; pts.push([px, py]); }
    var col = tens > 0.5 ? P.ropeHot : P.rope;
    function path() { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (var k = 1; k <= N; k++) ctx.lineTo(pts[k][0], pts[k][1]); }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    path(); ctx.strokeStyle = P.outline; ctx.lineWidth = P.pixel ? 6 : 5.5; ctx.stroke();
    path(); ctx.strokeStyle = P.ropeDark; ctx.lineWidth = P.pixel ? 4 : 3.6; ctx.stroke();
    path(); ctx.strokeStyle = col; ctx.lineWidth = P.pixel ? 2 : 2.2; ctx.setLineDash([5, 5]); ctx.lineDashOffset = -t * 4; ctx.stroke(); ctx.setLineDash([]);
    // шлейки на зверях
    circ(ctx, ax, ay, 4.5, P.ropeDark); circ(ctx, ax, ay, 2.4, col); circ(ctx, bx, by, 4.5, P.ropeDark); circ(ctx, bx, by, 2.4, col);
    if (tens > 0.25 && !P.pixel) glow(ctx, P, (ax + bx) / 2, (ay + by) / 2, 40, 'rgba(255,140,80,.18)');
  }

  function drawGears(ctx, S, P, t) {
    S.marks.forEach(function (m) {
      var k = 1 - m.t / 0.85, r = 26 - k * 8; ctx.strokeStyle = P.mark; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(m.x, m.y - 2, r, r * 0.35, 0, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 0.6; ctx.fillStyle = P.mark; ctx.beginPath(); ctx.ellipse(m.x, m.y - 2, r * (1 - m.t), r * 0.35 * (1 - m.t), 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    });
    S.gears.forEach(function (g) { gearShape(ctx, g.x, g.y, g.r, 8, g.rot, P.gear, P.gearDark, P); ctx.strokeStyle = P.outline; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(g.x, g.y, g.r * 0.85, 0, TAU); ctx.stroke(); });
  }

  Z.render = {
    layer: layer,
    world: function (ctx, S, P, time) {
      var t = time || 0, seed = S.lv * 7 + 3, i;
      ctx.drawImage(layer(S, P, 'b', seed), 0, 0, W, H);
      backAnim(ctx, S, P, t);
      ctx.drawImage(layer(S, P, 't', seed), 0, 0, W, H);
      drawGates(ctx, S, P, t); drawPlates(ctx, S, P, t); drawExit(ctx, S, P, t); drawStars(ctx, S, P, t);
      S.enemies.forEach(function (e) { drawBug(ctx, e, P, t); });
      drawBoss(ctx, S, P, t); drawGears(ctx, S, P, t);
      drawRope(ctx, S, P, t);
      var solo = S.players === 1;
      var order = S.active === 0 ? [1, 0] : [0, 1];
      for (i = 0; i < 2; i++) drawAnimal(ctx, S, S.an[order[i]], P, t, solo && order[i] === S.active && S.phase === 'play');
    },
    clearCache: function () { cache = {}; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
