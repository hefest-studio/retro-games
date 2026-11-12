/* НАЛЁТ · рендер RETRO (8-бит). NALYOT.classic — тот же набор, что у modern: 16-цветная палитра в духе
   EGA, всё на сетке 2–4 px, спрайты-строки без сглаживания, небо полосами, силуэты ступеньками,
   взрывы — квадратными «осколками». Логику не трогает. */
(function (global) {
  'use strict';
  var N = global.NALYOT = global.NALYOT || {};
  var T = 24;
  var E = { k: '#000000', b: '#0000aa', g: '#00aa00', c: '#00aaaa', r: '#aa0000', m: '#aa00aa', o: '#aa5500', l: '#aaaaaa',
    d: '#555555', B: '#5555ff', G: '#55ff55', C: '#55ffff', R: '#ff5555', M: '#ff55ff', Y: '#ffff55', W: '#ffffff' };
  var P = {
    pixel: true, font: '"Courier New", ui-monospace, monospace',
    hudBg: '#000000', line: '#5555ff', panel: '#000000', ink: '#ffffff', muted: '#aaaaaa', accent: '#ffff55',
    good: '#55ff55', bad: '#ff5555', warn: '#ffff55', boss: '#ff55ff', barBg: '#222244',
    hero: ['#ffaa00', '#55ffff'], dim: 'rgba(0,0,0,.6)'
  };
  var SCENES = {
    yard:    { sky: [E.b, '#5500aa', E.m, E.o], far: '#550055', mid: E.k, g: E.o, top: E.Y, dk: '#552a00' },
    quarry:  { sky: [E.b, '#5555aa', '#aa55aa', '#ffaa55'], far: '#aa5500', mid: '#552a00', g: '#aa7744', top: E.Y, dk: '#553311' },
    depot:   { sky: [E.k, '#000055', E.b, '#0055aa'], far: '#000055', mid: E.k, g: E.d, top: E.l, dk: '#222222' },
    bridges: { sky: [E.k, '#550000', E.r, '#ff5500'], far: '#550000', mid: E.k, g: E.d, top: E.o, dk: '#222222', glow: E.R },
    mast:    { sky: [E.B, '#55aaff', E.C, '#aaffff'], far: '#5555aa', mid: '#0000aa', g: E.d, top: E.l, dk: '#222222' },
    den:     { sky: [E.k, '#330000', '#550000', E.r], far: '#330000', mid: E.k, g: '#552a00', top: E.r, dk: '#220000', glow: E.r }
  };
  function scene(S) { return SCENES[S.name] || SCENES.yard; }
  function hash(x, y) { var h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function q(v, s) { s = s || 2; return Math.round(v / s) * s; }
  function px(ctx, c, x, y, w, h) { ctx.fillStyle = c; ctx.fillRect(q(x), q(y), Math.max(2, q(w)), Math.max(2, q(h))); }
  // Спрайт из строк; ox — точка привязки (центр низа), f — направление (-1 — зеркально)
  function spr(ctx, rows, x, y, map, f, s) {
    s = s || 2; var w = rows[0].length, h = rows.length, x0 = q(x - w * s / 2), y0 = q(y - h * s);
    ctx.fillStyle = '#000000';   // чёрный контур в 1 «пиксель» — как у спрайтов 8-бит
    for (var jj = 0; jj < h; jj++) for (var ii = 0; ii < w; ii++) if (map[rows[jj][f < 0 ? w - 1 - ii : ii]]) ctx.fillRect(x0 + ii * s - s, y0 + jj * s - s, s * 3, s * 3);
    for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) {
      var ch = rows[j][f < 0 ? w - 1 - i : i], c = map[ch]; if (c) { ctx.fillStyle = c; ctx.fillRect(x0 + i * s, y0 + j * s, s, s); }
    }
  }

  // ---------- Фон ----------
  function bg(ctx, S, cx, y0, W, H) {
    var C = scene(S), band = H / 2 / C.sky.length;
    for (var i = 0; i < C.sky.length; i++) { ctx.fillStyle = C.sky[i]; ctx.fillRect(0, y0 + i * band * 1.2, W, band * 1.2 + 2); }
    ctx.fillStyle = C.sky[C.sky.length - 1]; ctx.fillRect(0, y0 + C.sky.length * band * 1.2, W, H);
    // «дизеринг» между полосами
    for (i = 1; i < C.sky.length; i++) { ctx.fillStyle = C.sky[i]; var yy = y0 + i * band * 1.2 - 4; for (var x = 0; x < W; x += 8) ctx.fillRect(x + (i % 2) * 4, yy, 4, 4); }
    // солнце-квадрат
    ctx.fillStyle = S.name === 'depot' ? E.W : E.Y; ctx.fillRect(q(W * 0.72, 4), y0 + 80, 40, 40); ctx.fillRect(q(W * 0.72, 4) - 4, y0 + 88, 48, 24);
    steps(ctx, cx * 0.15, y0 + H - 160, W, C.far, 1);
    steps(ctx, cx * 0.4, y0 + H - 100, W, C.mid, 2);
    if (C.glow) { for (var gx = 0; gx < W; gx += 8) { ctx.fillStyle = C.glow; ctx.fillRect(gx + ((gx / 8) % 2) * 4, y0 + H - 12, 4, 4); } ctx.fillRect(0, y0 + H - 8, W, 8); }
  }
  function steps(ctx, off, base, W, col, k) {
    var seg = k === 1 ? 64 : 96, i0 = Math.floor(off / seg) - 1, n = Math.ceil(W / seg) + 3;
    ctx.fillStyle = col;
    for (var i = 0; i < n; i++) {
      var id = i0 + i, x = q(id * seg - off, 4), r = hash(id, k * 11);
      var h = q(k === 1 ? 20 + r * 90 : 16 + r * 40, 4);
      ctx.fillRect(x, base - h, seg, h + 300);
      if (k === 2 && r > 0.5) { ctx.fillRect(x + 40, base - h - 60 - q(r * 40, 4), 12, 70); ctx.fillRect(x + 36, base - h - 64 - q(r * 40, 4), 20, 6); }
      if (k === 1 && r > 0.6) { for (var w = 0; w < 3; w++) ctx.fillRect(x + 8 + w * 16, base - h - 12, 8, 12); }
    }
  }

  // ---------- Клетки ----------
  function ground(ctx, x, y, tx, ty, top, S) {
    var C = scene(S);
    ctx.fillStyle = C.g; ctx.fillRect(x, y, T, T);
    ctx.fillStyle = C.dk; ctx.fillRect(x + ((tx + ty) % 2 ? 4 : 14), y + ((tx * 3 + ty) % 3) * 6 + 4, 4, 4);
    if (top) { ctx.fillStyle = C.top; ctx.fillRect(x, y, T, 4); ctx.fillStyle = C.dk; ctx.fillRect(x, y + 4, T, 2); if (tx % 3 === 0) ctx.fillRect(x + 8, y - 2, 4, 2); }
  }
  function plat(ctx, x, y) {
    ctx.fillStyle = E.l; ctx.fillRect(x, y, T, 4); ctx.fillStyle = E.d; ctx.fillRect(x, y + 4, T, 2);
    ctx.fillRect(x + 4, y + 6, 4, 6); ctx.fillRect(x + 16, y + 6, 4, 6);
  }
  function block(ctx, b) {
    var x = b.tx * T, y = b.ty * T, w = b.tw * T, h = b.th * T;
    if (b.kind === 'crate') {
      for (var j = 0; j < b.th; j++) for (var i = 0; i < b.tw; i++) {
        var cx = x + i * T, cy = y + j * T;
        ctx.fillStyle = E.o; ctx.fillRect(cx, cy, T, T); ctx.fillStyle = '#552a00';
        ctx.fillRect(cx, cy, T, 2); ctx.fillRect(cx, cy + T - 2, T, 2); ctx.fillRect(cx, cy, 2, T); ctx.fillRect(cx + T - 2, cy, 2, T);
        for (var d = 2; d < T - 2; d += 2) ctx.fillRect(cx + d, cy + d, 2, 2);
      }
    } else {
      ctx.fillStyle = E.d; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = E.k; ctx.fillRect(x - 2, y - 4, w + 4, 4);
      ctx.fillStyle = E.l; for (var r = 0; r < b.th * 3; r++) for (var c = 0; c < b.tw * 2; c++) ctx.fillRect(x + c * 12 + (r % 2) * 6, y + r * 8 + 2, 8, 2);
      for (var k = 0; k < b.tw - 1; k++) { ctx.fillStyle = E.k; ctx.fillRect(x + 10 + k * T, y + 12, 12, 8); ctx.fillStyle = E.Y; ctx.fillRect(x + 12 + k * T, y + 14, 4, 2); }
    }
    var dmg = 1 - b.hp / b.max;
    if (dmg > 0.3) { ctx.fillStyle = E.k; for (var s = 0; s < 6; s++) ctx.fillRect(q(x + w * (0.3 + s * 0.04), 2), q(y + h * s / 6, 2), 2, 4); }
    if (dmg > 0.6) { ctx.fillStyle = E.k; for (s = 0; s < 6; s++) ctx.fillRect(q(x + w * (0.75 - s * 0.03), 2), q(y + h * (1 - s / 6) - 4, 2), 2, 4); }
    if (b.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(x, y, w, h); }
  }

  // ---------- Спрайты ----------
  var HERO = [
    '...HHHH...',
    '..HHHHHH..',
    '..HHVVVVV.',
    '..HHVEEV..',
    '..HHHHHH..',
    '...DOOO...',
    '..DOOOOO..',
    '.WDOOAAO..',
    '.WDOOAAO..',
    '..BBBYBB..',
    '..DOOOOO..',
    '..OO..OO..',
    '..OO..OO..',
    '..OO..OO..',
    '..KK..KKK.',
    '..........'
  ];
  var HERO_RUN = ['..OO.OO...', '.OO...OO..', '.KK...KKK.'];
  var HERO_CROUCH = [
    '...HHHH...',
    '..HHHHHH..',
    '..HHVVVVV.',
    '..HHVEEV..',
    '..DOOOOO..',
    '.WDOOOOO..',
    '..BBBYBB..',
    '.OOO.OOO..',
    '.KKK.KKKK.',
    '..........'
  ];
  function heroMap(col, armor) { return { H: E.l, V: E.k, E: col, O: col, D: E.o === col ? '#aa5500' : '#008888', B: '#552a00', Y: E.Y, K: E.d, W: E.l, A: armor ? '#aa7744' : col }; }
  function hero(ctx, h, t) {
    var col = P.hero[h.id], f = h.face, map = heroMap(col, h.armor > 0);
    map.D = h.id ? '#008888' : '#aa5500';
    if (!h.alive) { if (Math.floor(t * 10) % 2) spr(ctx, HERO_CROUCH, h.x, h.y - h.deadT * 10, map, f); return; }
    var rows = h.crouch ? HERO_CROUCH : HERO;
    if (!h.crouch && h.onGround && h.vx && Math.floor(h.runT * 8) % 2) rows = HERO.slice(0, 12).concat(HERO_RUN, ['..........']);
    if (!h.crouch && !h.onGround) rows = HERO.slice(0, 12).concat(['.OO...OO..', '.KK...KK..', '..........', '..........']);
    spr(ctx, rows, h.x, h.y, map, f);
    // оружие по прицелу — «пиксельная» трубка
    var a = h.aim, top = h.crouch ? -20 : -32, sx = h.x + f * 4, sy = h.y + top + 15;
    var gc = { rivet: E.l, nail: E.Y, spark: E.C, torch: E.R, scoop: E.M }[h.weapon] || E.l;
    var len = h.weapon === 'scoop' ? 7 : 6;
    for (var k = 0; k < len; k++) px(ctx, k < 2 ? E.d : gc, sx + a.x * k * 2 + (a.x === 0 ? f * 2 : 0), sy + a.y * k * 2, 4, 4);
    if (h.gunT > 0) px(ctx, E.W, sx + a.x * len * 2 + a.x * 2, sy + a.y * len * 2 - 2, 6, 6);
    if (h.meleeT > 0) { for (var m = 0; m < 6; m++) px(ctx, E.W, h.x + f * (8 + m * 2), h.y + top + 6 + m * 2 * (1 - h.meleeT * 4), 4, 4); }
  }
  var RAIDER = [
    '...GGGG...',
    '..gGGGGg..',
    '..GGGGEG..',
    '..gGGGGg..',
    '.ssRRRRR..',
    '..RRRRRR..',
    '..RrRRRR..',
    '..RRRRRR..',
    '..rrrrrr..',
    '..rr..rr..',
    '..rr..rr..',
    '..rr..rr..',
    '..rr..rr..',
    '.ggg..ggg.',
    '..........'
  ];
  var DRONE = ['..ww....ww..', '.wwww..wwww.', '...gGGGGg...', '..GGGGGGGG..', '...gGEEGg...', '.....gg.....'];
  function enemy(ctx, e, t) {
    var f = e.face;
    if (e.type === 'raider' || e.type === 'bomber') {
      var map = { G: E.l, g: E.d, E: e.warn && Math.floor(t * 12) % 2 ? E.Y : E.R, R: e.type === 'bomber' ? '#aa7744' : E.o, r: '#552a00', s: E.l };
      var rows = RAIDER; if (e.vx && Math.floor(e.walkT * 8) % 2) rows = RAIDER.slice(0, 9).concat(['..rr.rr...', '.rr...rr..', '.rr...rr..', '.rr...rr..', 'ggg...ggg.', '..........']);
      spr(ctx, rows, e.x, e.y, map, f);
      if (e.type === 'raider') { var a = e.aim || { x: f, y: 0 }; for (var k = 0; k < 6; k++) px(ctx, E.d, e.x + f * 4 + a.x * k * 2, e.y - 20 + a.y * k * 2, 4, 2); if (e.warn) px(ctx, E.Y, e.x + f * 4 + a.x * 14, e.y - 22 + a.y * 14, 4, 4); }
      else { px(ctx, '#552a00', e.x - f * 10, e.y - 24, 6, 10); px(ctx, E.l, e.x + f * 7, e.y - 22, 4, 4); }
    } else if (e.type === 'turret') {
      px(ctx, E.k, e.x - 12, e.y - 20, 24, 16); px(ctx, E.d, e.x - 12, e.y - 6, 24, 6); px(ctx, E.o, e.x - 10, e.y - 14, 20, 8); px(ctx, E.o, e.x - 6, e.y - 18, 12, 4);
      var a2 = e.aim || { x: f, y: 0 }; for (var j = 0; j < 7; j++) px(ctx, E.k, e.x + a2.x * (4 + j * 2), e.y - 13 + a2.y * (4 + j * 2), 4, 4);
      px(ctx, e.warn && Math.floor(t * 12) % 2 ? E.Y : E.R, e.x - 2, e.y - 14, 4, 4);
    } else if (e.type === 'wagon') {
      var x = e.x, y = e.y;
      px(ctx, E.k, x - 34, y - 32, 68, 24); px(ctx, E.o, x - 32, y - 30, 64, 20); px(ctx, '#552a00', x - 32, y - 12, 64, 4);
      for (var r2 = -24; r2 <= 24; r2 += 8) px(ctx, '#552a00', x + r2, y - 26, 2, 2);
      px(ctx, E.d, x - 10, y - 40, 20, 10); px(ctx, E.d, x + (f > 0 ? 8 : -30), y - 38, 22, 6);
      if (e.warn) px(ctx, E.Y, x + f * 32 - 2, y - 40, 6, 6);
      for (var s = 0; s < 3; s++) px(ctx, E.l, x + f * 32 + (f > 0 ? 0 : -6), y - 28 + s * 6, 6, 4);
      [-22, 0, 22].forEach(function (wx) { px(ctx, E.k, x + wx - 6, y - 12, 12, 12); px(ctx, E.d, x + wx - 2 + (Math.floor(e.walkT * 8) % 2) * 2, y - 8, 4, 4); });
    } else if (e.type === 'drone') {
      var dm = { w: Math.floor(t * 20) % 2 ? E.W : E.l, g: E.d, G: E.l, E: e.warn && Math.floor(t * 12) % 2 ? E.Y : E.R };
      spr(ctx, DRONE, e.x, e.y + 2, dm, 1);
    }
    if (e.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillRect(q(e.x - e.w / 2), q(e.y - e.hh), q(e.w), q(e.hh)); }
  }
  function vehicle(ctx, v, t, riderCol) {
    var x = v.x, y = v.y, f = v.face, w2 = v.onGround && v.vx && Math.floor(v.walkT * 6) % 2 ? 4 : 0;
    px(ctx, E.d, x - 10 - w2, y - 18, 6, 16); px(ctx, E.d, x + 4 + w2, y - 18, 6, 16);
    px(ctx, E.k, x - 14 - w2, y - 4, 12, 4); px(ctx, E.k, x + 2 + w2, y - 4, 12, 4);
    px(ctx, E.k, x - 20, y - 44, 40, 30); px(ctx, '#ff8800', x - 18, y - 42, 36, 26); px(ctx, E.o, x - 18, y - 26, 36, 8); px(ctx, '#552a00', x - 18, y - 18, 36, 2);
    for (var i = -14; i <= 14; i += 6) { px(ctx, '#552a00', x + i, y - 40, 2, 2); px(ctx, '#552a00', x + i, y - 22, 2, 2); }
    px(ctx, E.d, x - f * 12 - 2, y - 52, 6, 10);
    px(ctx, riderCol || E.k, x + (f > 0 ? -2 : -12), y - 38, 14, 8);
    var a = v.aim; for (var k = 0; k < 9; k++) px(ctx, E.d, x + f * 10 + a.x * k * 2.4, y - 31 + a.y * k * 2.4, 6, 6);
    if (v.flash > 0 || (v.boom > 0 && Math.floor(t * 10) % 2)) { ctx.fillStyle = v.boom > 0 ? 'rgba(255,85,85,.7)' : 'rgba(255,255,255,.6)'; ctx.fillRect(q(x - 18), q(y - 42), 36, 26); }
    for (var p = 0; p < 3; p++) { var ph = (t * 1.5 + p / 3) % 1; px(ctx, v.hp < v.max * 0.4 ? E.d : E.l, x - f * 12 - f * ph * 10 - 2, y - 56 - ph * 24, 4 + ph * 6, 4 + ph * 6); }
    if (!riderCol && Math.floor(t * 4) % 2) { px(ctx, E.Y, x - 4, y - 66, 8, 4); px(ctx, E.Y, x - 2, y - 62, 4, 4); }
  }

  // ---------- Боссы ----------
  function boss(ctx, B, t) {
    var x = B.x, y = B.y, glow = B.warn > 0 || B.shift > 0, eye = glow && Math.floor(t * 10) % 2 ? E.Y : E.R;
    if (B.dead) { if (Math.floor(t * 12) % 2) return; y += B.deadT * 10; }
    var R = function (c, ax, ay, w, h) { px(ctx, c, x + ax, y + ay, w, h); };
    switch (B.key) {
      case 'pincer':
        for (var l = 0; l < 3; l++) { var k = Math.floor(t * 6 + l) % 2 * 4; R(E.d, -36 + l * 30, -40, 6, 20); R(E.d, -42 + l * 30, -20 + k, 6, 20 - k); }
        R(E.o, -50, -78, 100, 42); R('#552a00', -50, -40, 100, 4); R(E.l, -20, -92, 40, 16); R(eye, -14, -86, 8, 4); R(eye, 6, -86, 8, 4);
        var cl = Math.floor(t * 3) % 2 * 4; R(E.l, -78, -62, 30, 8); R(E.r, -98, -70 - cl, 22, 8); R(E.r, -98, -54 + cl, 22, 8);
        R(E.l, -78, -46, 30, 8); R(E.r, -98, -52 - cl, 22, 6); R(E.r, -98, -38 + cl, 22, 6);
        break;
      case 'auger':
        R(E.d, -64, -24, 128, 24); for (var w = -50; w <= 50; w += 20) R(E.k, w - 6, -18, 12, 12);
        R(E.o, -50, -66, 108, 44); R(E.l, -10, -80, 46, 14); R(E.k, -24, -76, 18, 6); R(eye, 18, -76, 10, 4);
        var sh = Math.floor(t * 10) % 2 * 2; for (var d = 0; d < 5; d++) R(d % 2 ? E.l : E.W, -58 - d * 8, -62 + d * 4 + sh, 8, 36 - d * 8);
        break;
      case 'smokestack':
        R(E.d, -76, -24, 152, 10); [-52, -20, 12, 44].forEach(function (wx) { R(E.k, wx - 12, -24, 24, 24); R(E.l, wx - 2, -14, 4, 4); });
        R(E.o, -72, -70, 100, 46); R('#552a00', 24, -96, 50, 72); R(E.Y, 34, -88, 14, 10); R(eye, 36, -84, 10, 2);
        R(E.d, -60, -104, 16, 36); R(E.d, -64, -108, 24, 6); R(E.l, -88, -12, 14, 8);
        for (var p = 0; p < 3; p++) { var ph = (t * 0.8 + p / 3) % 1; R(E.d, -56 + ph * 30, -120 - ph * 50, 8 + ph * 12, 8 + ph * 12); }
        break;
      case 'cogwalker':
        var st = Math.floor(t * 2.2) % 2 * 6;
        R(E.d, -26, -62, 10, 34); R(E.d, -30 + st, -30, 10, 30); R(E.d, 16, -62, 10, 34); R(E.d, 20 - st, -30, 10, 30);
        R(E.o, -44, -112, 88, 54); R(E.Y, -20, -106, 40, 40); R('#552a00', -8, -94, 16, 16);
        var tp = Math.floor(t * 4) % 2; for (var g = 0; g < 4; g++) R(E.Y, -26 + (g % 2) * 46 + (tp ? 0 : 2), -102 + Math.floor(g / 2) * 30, 6, 6);
        R(E.l, -18, -126, 36, 14); R(eye, -12, -121, 24, 4); R(E.d, -58, -100, 16, 10); R(B.lastPat === 'laser' && glow ? E.R : E.l, -64, -98, 8, 6);
        break;
      case 'bellship':
        R('#aa7744', -64, -64, 128, 26); R('#aa7744', -50, -70, 100, 38); R('#553311', -64, -46, 128, 4);
        for (var s = -40; s <= 40; s += 20) R('#553311', s, -70, 2, 36);
        R(E.d, -18, -34, 2, 14); R(E.d, 16, -34, 2, 14); R(E.o, -16, -22, 32, 10); R(E.o, -26, -12, 52, 14); R(eye, -4, -10, 8, 8);
        var pr = Math.floor(t * 20) % 2 * 6; R(E.l, 70, -60 - pr, 4, 12 + pr * 2); R(E.l, -74, -60 - pr, 4, 12 + pr * 2);
        break;
      case 'furnace':
        R(E.d, -80, -30, 160, 30); R(E.o, -66, -132, 132, 102); R('#552a00', -66, -132, 132, 4);
        R(E.d, -50, -150, 18, 20); R(E.d, 32, -150, 18, 20);
        R(Math.floor(t * 8) % 2 ? E.Y : '#ffaa00', -30, -92, 60, 46); R(E.R, -26, -60, 52, 12);
        for (var gx = -24; gx <= 24; gx += 12) R(E.d, gx - 2, -92, 4, 46);
        R(eye, -36, -118, 18, 6); R(eye, 18, -118, 18, 6); R(E.l, -96, -84, 30, 8); R(E.l, -100, -78, 8, 48);
        for (var e2 = 0; e2 < 4; e2++) { var ep = (t * 0.7 + e2 / 4) % 1; R(E.R, -44 + (e2 % 2) * 82, -156 - ep * 40, 4, 4); }
        break;
    }
    if (B.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(q(x - B.w / 2), q(y - B.hh), q(B.w), q(B.hh)); }
    if (B.shift > 0 && Math.floor(t * 12) % 2) { ctx.strokeStyle = E.Y; ctx.lineWidth = 4; ctx.strokeRect(q(x - B.w / 2 - 6), q(y - B.hh - 6), q(B.w + 12), q(B.hh + 6)); }
  }

  // ---------- Пленник, подборы ----------
  var HOST = ['..bbbb....', '..SSSS..p.', '..SSSS..p.', '..bBBB..p.', '.yBBBByyp.', '..BBBB..p.', '.yBBBByyp.', '..kk.kk.p.', '..kk.kk.p.', '.kkk.kkkp.'];
  var HOST_FREE = ['...bbbb...', '...SSSS.S.', '...SSSS.S.', '..BBBBBS..', '..BBBBB...', '..BBBBB...', '..kk.kk...', '..kk.kk...', '.kkk.kkk..'];
  function hostage(ctx, hs, t) {
    var map = { b: E.b, S: '#ffaa77', B: E.B, k: E.d, y: E.Y, p: '#552a00' };
    if (!hs.freed) { spr(ctx, HOST, hs.x, hs.y, map, 1); if (Math.floor(t * 3) % 2) { px(ctx, E.Y, hs.x - 2, hs.y - 34, 4, 8); px(ctx, E.Y, hs.x - 2, hs.y - 24, 4, 2); } }
    else { if (hs.t > 2 && Math.floor(t * 12) % 2) return; var j = Math.floor(hs.t * 8) % 2 * 4; spr(ctx, HOST_FREE, hs.x, hs.y - j, map, -1); }
  }
  var PKC = { nail: E.Y, spark: E.C, torch: E.R, scoop: E.M, gren: E.G, life: E.M, armor: '#aa7744', medal: E.Y };
  var PKL = { nail: 'N', spark: 'S', torch: 'T', scoop: 'D', gren: 'G', life: '1', armor: 'A', medal: '$' };
  function pickup(ctx, p, t) {
    var k = p.kind === 'w' ? p.w : p.kind, c = PKC[k] || E.Y, y = p.y - 10 - (p.vy === null ? Math.floor(t * 4) % 2 * 2 : 0);
    px(ctx, E.k, p.x - 10, y - 10, 20, 20); px(ctx, c, p.x - 10, y - 10, 20, 2); px(ctx, c, p.x - 10, y + 8, 20, 2); px(ctx, c, p.x - 10, y - 10, 2, 20); px(ctx, c, p.x + 8, y - 10, 2, 20);
    ctx.fillStyle = c; ctx.font = '900 13px ' + P.font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(PKL[k] || '?', q(p.x), q(y) + 1); ctx.textBaseline = 'alphabetic';
  }

  // ---------- Снаряды и эффекты ----------
  function bullet(ctx, b) {
    if (b.kind === 'torch') { var k = b.t / b.life; px(ctx, k < 0.4 ? E.Y : k < 0.7 ? '#ffaa00' : E.R, b.x - 3 - k * 4, b.y - 3 - k * 4, 6 + k * 8, 6 + k * 8); return; }
    var c = b.kind === 'spark' ? E.C : b.kind === 'nail' ? E.Y : b.kind === 'scoop' ? E.M : b.kind === 'kotel' ? '#ffaa00' : E.W;
    var s = b.kind === 'kotel' ? 6 : 4; px(ctx, c, b.x - s / 2, b.y - s / 2, s, s);
    if (b.kind === 'spark') { var l = Math.hypot(b.vx, b.vy) || 1; px(ctx, E.C, b.x - b.vx / l * 8 - 2, b.y - b.vy / l * 8 - 2, 4, 4); px(ctx, E.W, b.x - 1, b.y - 1, 2, 2); }
  }
  function ebullet(ctx, b, t) { var s = b.kind === 'shell' ? 8 : 6; px(ctx, Math.floor(t * 16) % 2 ? E.R : E.Y, b.x - s / 2, b.y - s / 2, s, s); }
  function grenade(ctx, gr) { px(ctx, gr.shell ? '#ffaa00' : E.g, gr.x - 3, gr.y - 3, 6, 6); px(ctx, E.Y, gr.x - 1, gr.y - 5, 2, 2); }
  function bomb(ctx, bm, t) {
    if (bm.kind === 'bolt') { px(ctx, E.l, bm.x - 4, bm.y - 4, 8, 8); px(ctx, E.k, bm.x - 1, bm.y - 1, 2, 2); }
    else { px(ctx, E.d, bm.x - 3, bm.y - 5, 6, 10); px(ctx, Math.floor(t * 12) % 2 ? E.R : E.Y, bm.x - 1, bm.y, 2, 2); }
  }
  function wave(ctx, w, t) {
    for (var i = 0; i < 5; i++) { var hh = [6, 12, 18, 12, 6][i]; px(ctx, i % 2 ? E.Y : '#ffaa00', w.x - 20 + i * 8, w.y - hh, 8, hh); }
  }
  function laser(ctx, l, t) {
    if (l.warn > 0) { if (Math.floor(t * 12) % 2) for (var x = q(l.x0, 16); x < l.x1; x += 16) px(ctx, E.R, x, l.y - 1, 8, 2); return; }
    ctx.fillStyle = E.R; ctx.fillRect(l.x0, q(l.y) - 6, l.x1 - l.x0, 12); ctx.fillStyle = E.W; ctx.fillRect(l.x0, q(l.y) - 2, l.x1 - l.x0, 4);
  }
  function mark(ctx, m, S) {
    var B = S.boss, gy = B ? B.groundY : 400; if (Math.floor(S.time * 10) % 2) return;
    px(ctx, E.R, m.x - 12, gy - 4, 24, 4); px(ctx, E.R, m.x - 4, gy - 22, 8, 8); px(ctx, E.R, m.x - 2, gy - 14, 4, 4);
  }
  function boom(ctx, b) {
    var k = b.t / b.max, r = b.r * (0.4 + k * 0.8), n = 10;
    for (var i = 0; i < n; i++) { var a = i * Math.PI * 2 / n + b.x, d = r * (0.3 + 0.7 * ((i * 37) % 10) / 10); px(ctx, k < 0.3 ? E.W : k < 0.6 ? E.Y : '#ffaa00', b.x + Math.cos(a) * d - 4, b.y + Math.sin(a) * d - 4, 8 - k * 4, 8 - k * 4); }
    if (k < 0.4) px(ctx, E.W, b.x - r * 0.3, b.y - r * 0.3, r * 0.6, r * 0.6);
  }

  // ---------- HUD ----------
  function badge(ctx, pi, x, y, dim) {
    px(ctx, E.l, x - 8, y - 8, 16, 14); px(ctx, E.k, x - 6, y - 4, 12, 6); px(ctx, dim ? E.d : P.hero[pi], x - 4, y - 2, 8, 2);
  }
  function icon(ctx, k, x, y, pi) {
    if (k === 'life') { px(ctx, P.hero[pi], x - 4, y - 5, 8, 8); px(ctx, E.k, x - 2, y - 3, 4, 2); }
    else if (k === 'armor') { px(ctx, '#aa7744', x - 4, y - 5, 8, 10); px(ctx, E.Y, x - 2, y - 3, 4, 2); }
    else { px(ctx, E.G, x - 4, y - 3, 8, 8); px(ctx, E.Y, x - 1, y - 7, 2, 4); }
  }

  N.classic = { P: P, scenes: SCENES, bg: bg, ground: ground, plat: plat, block: block, hostage: hostage, pickup: pickup, vehicle: vehicle,
    enemy: enemy, boss: boss, hero: hero, bullet: bullet, ebullet: ebullet, grenade: grenade, bomb: bomb, wave: wave, laser: laser,
    mark: mark, boom: boom, badge: badge, icon: icon };
})(typeof window !== 'undefined' ? window : globalThis);
