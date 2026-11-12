/* ГЛУБЬ · рендер RETRO (8-бит). GLUB.classic = { P, bg, draw, hero, mole, lifeIcon, crystalIcon }
   16-цветная палитра ранних машин, пиксельные спрайты 2×, порода кирпичной кладкой в цвет глубины,
   мягкая порода — бурые валуны, сканлайны. Логику не трогает — только читает состояние. */
(function (global) {
  'use strict';
  var Gb = global.GLUB = global.GLUB || {};
  var L = Gb.logic, T = 32, OY = 36, PX = 2, COLS = L.COLS, ROWS = L.ROWS;

  var P = {
    pixel: true, font: '"Courier New", ui-monospace, monospace',
    hudBg: '#000000', hudLine: '#5555ff', ink: '#ffffff', muted: '#aaaaaa', accent: '#ffff55', good: '#55ff55', bad: '#ff5555', warn: '#ffff55',
    bar: '#333333', panel: '#000000', panelA: '#000000', line: '#5555ff', soft: '#aa5500', mapLine: '#aaaaaa', mapDim: '#555555',
    beaconMap: '#55ffff', heart: '#ffff55', dim: '#555555',
    zoneMap: ['#555555', '#0000aa', '#00aa00', '#aa0000', '#aa00aa']
  };
  var CC = { 1: '#ff5555', 2: '#5555ff', 3: '#55ff55', 4: '#ffff55', 5: '#ff55ff', 6: '#ffffff', 7: '#aa0000', 8: '#55ffff' };
  var ZR = [['#555555', '#aaaaaa', '#000000'], ['#0000aa', '#5555ff', '#000055'], ['#00aa00', '#55ff55', '#003300'], ['#aa0000', '#ff5555', '#330000'], ['#aa00aa', '#ff55ff', '#330033']];

  // Спрайты: '.' прозрачно; k — чёрный, y — латунь (жёлтый), n — бурый, w — белый, c — голубой, b — синий, r — красный,
  // g — серый, d — тёмно-серый, m — пурпур, o — оранжево-жёлтый, e — зелёный
  var PAL = { k: '#000000', y: '#ffff55', n: '#aa5500', w: '#ffffff', c: '#55ffff', b: '#0000aa', r: '#aa0000', g: '#aaaaaa', d: '#555555', m: '#aa00aa', o: '#ffaa00', e: '#55ff55' };
  var BODY = [
    '......kgk.......', '.....kgwgk......', '....kkyyykk.....', '...kyyyyyyyk....', '..kyyyykkkkyk...', '..kyyykbccbkk...',
    '..kyyykbcwbck...', '..kyyykbcccbk...', '..kyyykbbccbk...', '..kyyyykkkkyk...', '...kyyyyyyyk....', '....knnnnnk.....',
    '..rrknnnnnnk....', '.krrkyyyyyyyk...', '.krrkyywyywyk...', '.krrkyyyyyyykk..', '.krrkyyyyyykyk..', '.krrkyyyyyykyk..',
    '.krrknnnnnnkyk..', '..kkkyyyyyykdk..'
  ];
  var LEGS = {
    stand: ['....kyyk.kyyk...', '....kyyk.kyyk...', '....knnk.knnk...', '....knnk.knnk...', '...kdddk.kdddk..', '...kddddkkddddk.', '...kkkkk..kkkkk.'],
    w1: ['....kyyk..kyyk..', '...kyyk....kyyk.', '...knnk....knnk.', '..knnk.....knnk.', '.kdddk.....kdddk', '.kddddk....kdddk', '.kkkkkk....kkkkk'],
    w2: ['.....kyykyyk....', '.....kyykyyk....', '.....knnknnk....', '....knnk.knnk...', '....kdddkdddk...', '...kddddkddddk..', '...kkkkkkkkkkk..'],
    air: ['....kyyk.kyyk...', '...kyyk...kyyk..', '..knnk.....knnk.', '..kddk.....kddk.', '.kdddk.....kdddk', '.kkkk.......kkkk', '................']
  };
  var MOLE = ['...g........', '..kgggggk...', '.kgwggggyk..', 'kgggggggyyy.', 'kggrgggyyyyk', '.kgggggyyk..', '.kkdddddk...', '..d.d.d.d...'];
  var MOLE2 = ['...g........', '..kgggggk...', '.kgwggggok..', 'kgggggggooo.', 'kggrgggooook', '.kgggggook..', '.kkdddddk...', '...d.d.d.d..'];
  var MOTH = [['m..........m', 'mm........mm', 'mmm.dddd.mmm', '.mmmdoodmmm.', '..mmddddmm..', '....d..d....'],
    ['............', '....dddd....', '.mmmdoodmmm.', 'mmmmddddmmmm', 'mm..d..d..mm', 'm..........m']];
  var CRAWL = [['...r...r...r...', '..nnn.nnn.nnny.', '.nnnnnnnnnnnnnk', '.nnonnnnonnnnn.', '..ddd.ddd.ddd..', '.d...d...d.....'],
    ['...r...r...r...', '..nnn.nnn.nnny.', '.nnnnnnnnnnnnnk', '.nnonnnnonnnnn.', '..ddd.ddd.ddd..', '...d...d...d...']];
  var GEM = ['...ww...', '..wccc..', '.wcccc..', 'wcccccc.', '.ccccc..', '..ccc...', '...c....'];
  var BEACON = ['..gggg..', '.gcccc g', '.gcwcc.g', '.gcccc.g', '..gggg..', '...dd...', '...dd...', '...dd...', '...dd...', '...dd...', '...dd...', '..dddd..', '.dddddd.'];
  var BEACON_OFF = BEACON.map(function (s) { return s.replace(/[cw]/g, 'b'); });
  var TANK = ['..dd..', '.yyyy.', 'yyyyyy', 'yewwey', 'yeeeey', 'yyyyyy', 'yyyyyy', '.yyyy.'];
  var NUG = ['..yy....', '.yyoy...', 'yyyoyyy.', '.ynyyny.', '..nnnn..'];
  var HEART = ['....ww....', '...wooo...', '..woooor..', '.wooooorr.', 'wooooooorr', '.oooooorr.', '..ooorrr..', '...orrr...', '....rr....'];

  function spr(ctx, rows, x, y, pal, flip, s) {
    var ps = PX * (s || 1), w = rows[0].length;
    for (var r = 0; r < rows.length; r++) for (var c = 0; c < w; c++) {
      var ch = rows[r].charAt(flip ? w - 1 - c : c); if (ch === '.' || ch === ' ' || !ch) continue;
      ctx.fillStyle = (pal && pal[ch]) || PAL[ch] || '#ff00ff';
      ctx.fillRect(Math.round(x + c * ps), Math.round(y + r * ps), ps, ps);
    }
  }
  function X(x) { return Math.round(x * T); }
  function Y(y) { return Math.round(OY + y * T); }

  function bg(ctx, g) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, g.W, g.H); }

  var cache = {}, cacheN = 0;
  function staticLayer(S, rm) {
    var key = rm.i + ':' + rm.near.map(function (q) { return S.dug[q] ? 1 : 0; }).join('') + (S.gate ? 'G' : 'g');
    if (cache[key]) return cache[key];
    if (++cacheN > 40) { cache = {}; cacheN = 1; }
    var c = document.createElement('canvas'); c.width = COLS * T; c.height = ROWS * T;
    var x = c.getContext('2d'), zr = ZR[rm.zone];
    x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height);
    var seed = rm.i * 131 + 7, rnd = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (var i = 0; i < 40; i++) { x.fillStyle = rnd() < 0.5 ? zr[0] : '#555555'; x.fillRect(Math.floor(rnd() * 320) * 2, Math.floor(rnd() * 192) * 2, 2, 2); }
    var solid = function (q, r) { return L.isSolid(L.tileAt(S, rm, q, r)); };
    for (var r = 0; r < ROWS; r++) for (var q = 0; q < COLS; q++) {
      var t = L.tileAt(S, rm, q, r), bx = q * T, by = r * T, k;
      if (t === L.R || t === L.VT || t === L.SL) {
        x.fillStyle = zr[0]; x.fillRect(bx, by, T, T);
        x.fillStyle = zr[2];
        for (k = 0; k < 4; k++) { x.fillRect(bx, by + k * 8 + 6, T, 2); x.fillRect(bx + ((k % 2) ? 14 : 2), by + k * 8, 2, 6); x.fillRect(bx + ((k % 2) ? 30 : 18), by + k * 8, 2, 6); }
        if (solid(q, r - 1) && solid(q, r + 1) && solid(q - 1, r) && solid(q + 1, r)) { for (k = 0; k < 16; k += 2) for (var j = 0; j < 16; j += 2) if ((k + j) % 4 === 0) x.fillRect(bx + k * 2, by + j * 2, 2, 2); }
        if (!solid(q, r - 1) && r > 0) { x.fillStyle = zr[1]; x.fillRect(bx, by, T, 4); }
        if (t === L.VT) { x.fillStyle = '#aaaaaa'; x.fillRect(bx + 2, by, T - 4, 10); x.fillStyle = '#000'; for (k = 0; k < 4; k++) x.fillRect(bx + 6 + k * 6, by + 2, 2, 6); }
      } else if (t === L.SO) {
        x.fillStyle = '#000'; x.fillRect(bx, by, T, T);
        x.fillStyle = '#aa5500';
        [[2, 2, 12, 10], [16, 2, 14, 12], [4, 14, 10, 8], [16, 16, 14, 8], [2, 24, 12, 6], [18, 26, 12, 6]].forEach(function (b) { x.fillRect(bx + b[0], by + b[1], b[2], b[3]); });
        x.fillStyle = '#ffaa00'; x.fillRect(bx + 4, by + 4, 2, 2); x.fillRect(bx + 18, by + 4, 2, 2); x.fillRect(bx + 6, by + 16, 2, 2); x.fillRect(bx + 20, by + 18, 2, 2);
      } else if (t === L.LD) {
        x.fillStyle = '#ffff55'; x.fillRect(bx + 6, by, 4, T); x.fillRect(bx + 22, by, 4, T);
        x.fillStyle = '#aa5500'; for (k = 0; k < 4; k++) x.fillRect(bx + 10, by + 4 + k * 8, 12, 4);
      } else if (t === L.PF) {
        x.fillStyle = '#aa5500'; x.fillRect(bx, by, T, 10); x.fillStyle = '#ffff55'; x.fillRect(bx, by, T, 2);
        x.fillStyle = '#000'; x.fillRect(bx + 14, by + 4, 2, 4);
      }
    }
    cache[key] = c; return c;
  }

  function crystalIcon(ctx, x, y, cid, s, on) {
    var sc = s >= 6 ? 1 : 0.5;
    if (on) spr(ctx, GEM, x - 8 * sc, y - 7 * sc, { c: CC[cid], w: '#ffffff' }, false, sc);
    else { ctx.fillStyle = '#555555'; ctx.fillRect(x - 3 * sc * 2, y - 1, 6 * sc * 2, 2); }
  }
  function lifeIcon(ctx, x, y, on) {
    ctx.fillStyle = on ? '#ffff55' : '#333333'; ctx.fillRect(x - 6, y - 6, 12, 12);
    ctx.fillStyle = on ? '#55ffff' : '#000'; ctx.fillRect(x - 1, y - 3, 6, 6);
    ctx.fillStyle = '#000'; ctx.fillRect(x - 6, y - 6, 2, 2); ctx.fillRect(x + 4, y - 6, 2, 2); ctx.fillRect(x - 6, y + 4, 2, 2); ctx.fillRect(x + 4, y + 4, 2, 2);
  }
  function mole(ctx, x, y, dir, t, dig) {
    spr(ctx, Math.floor(t * 12) % 2 ? MOLE2 : MOLE, x - 12 + (dig ? (Math.floor(t * 30) % 2) * 2 : 0), y - 10, null, dir < 0);
  }
  function hero(ctx, x, y, H, t, o) {
    o = o || {};
    var flip = !H.climb && H.face < 0, legs = LEGS.stand;
    if (H.climb) legs = Math.floor(H.y * 3) % 2 ? LEGS.w1 : LEGS.w2;
    else if (!H.ground) legs = LEGS.air;
    else if (H.walkT) legs = Math.floor(H.walkT * 8) % 2 ? LEGS.w1 : LEGS.w2;
    var x0 = x - 16, y0 = y - 54;
    spr(ctx, BODY, x0, y0, null, flip);
    spr(ctx, legs, x0, y0 + 40, null, flip);
    if (!o.noMole) { ctx.fillStyle = '#aaaaaa'; ctx.fillRect(x0 + (flip ? 26 : 0), y0 + 18, 6, 6); ctx.fillStyle = '#ffff55'; ctx.fillRect(x0 + (flip ? 32 : -2), y0 + 20, 2, 2); }
    if (H.stun > 0) for (var k = 0; k < 3; k++) { var a = t * 6 + k * 2.1; ctx.fillStyle = '#ffff55'; ctx.fillRect(Math.round(x + Math.cos(a) * 12) - 2, Math.round(y - 62 + Math.sin(a) * 3) - 2, 4, 4); }
  }

  function draw(ctx, S, g, o) {
    o = o || {};
    var W = L.world(), rm = W.rooms[S.room], t = S.time, zr = ZR[rm.zone];
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, g.W, g.H);
    ctx.drawImage(staticLayer(S, rm), 0, OY);
    ctx.save(); ctx.beginPath(); ctx.rect(0, OY, g.W, g.H - OY); ctx.clip();
    for (var r = 0; r < ROWS; r++) for (var q = 0; q < COLS; q++) {
      var k = L.tileAt(S, rm, q, r);
      if (k === L.SL) { var on = Math.floor(t * 6 + q) % 2; ctx.fillStyle = on ? '#ff5555' : '#aa0000'; ctx.fillRect(X(q), Y(r), T, 8); ctx.fillStyle = '#ffff55'; ctx.fillRect(X(q) + (on ? 6 : 18), Y(r) + 2, 6, 2); }
      else if (k === L.GT) {
        ctx.fillStyle = '#555555'; ctx.fillRect(X(q), Y(r), T, T); ctx.fillStyle = '#aaaaaa'; for (var b = 0; b < 3; b++) ctx.fillRect(X(q) + 4 + b * 10, Y(r), 4, T);
        var row = r - (rm.c.L && rm.c.L.k === 'gate' ? rm.c.L.h : rm.c.R ? rm.c.R.h : 10) + 3;
        for (var s2 = 0; s2 < 3; s2++) { var cid = row * 3 + s2 + 1; if (cid > 8) continue; ctx.fillStyle = S.crystals.indexOf(cid) >= 0 ? CC[cid] : '#000'; ctx.fillRect(X(q) + 4 + s2 * 9, Y(r) + 14, 6, 6); }
      }
    }
    rm.vents.forEach(function (v) {
      var vx = X(v.x), vy = Y(v.y);
      if (L.ventOn(v, t)) { for (var n = 0; n < 8; n++) { var ph = (t * 2.2 + n / 8) % 1; ctx.fillStyle = ph < 0.5 ? '#ffffff' : '#aaaaaa'; var sz = 4 + Math.floor(ph * 4) * 2; ctx.fillRect(vx + 16 - sz / 2 + ((n % 2) ? 4 : -4), Math.round(vy - ph * 96), sz, sz); } }
      else if (L.ventWarn(v, t)) { ctx.fillStyle = '#aaaaaa'; ctx.fillRect(vx + 10 + (Math.floor(t * 10) % 2) * 6, vy - 8, 4, 4); }
    });
    rm.items.forEach(function (it) {
      var ix = X(it.c) + T / 2, iy = Y(it.r);
      if (it.k === 'beacon') spr(ctx, S.cp.id === it.id ? BEACON : BEACON_OFF, ix - 16, iy - 52, S.cp.id === it.id && Math.floor(t * 4) % 2 ? { c: '#ffffff' } : null, false, 2);
      else if (it.k === 'heart') { ctx.fillStyle = '#aa00aa'; ctx.fillRect(ix - 16, iy - 10, 32, 10); spr(ctx, HEART, ix - 20, iy - 50 + (Math.floor(t * 3) % 2) * 2, S.gate ? null : { o: '#aa5500', r: '#555555', w: '#aaaaaa' }, false, 2); }
      else if (S.got[it.id]) return;
      else if (it.k === 'crystal') spr(ctx, GEM, ix - 16, iy - 34 + (Math.floor(t * 3) % 2) * 2, { c: CC[it.cid], w: '#ffffff' }, false, 2);
      else if (it.k === 'nugget') spr(ctx, NUG, ix - 8, iy - 10, null, false);
      else if (it.k === 'tank') spr(ctx, TANK, ix - 6, iy - 16, null, false);
    });
    S.enemies.forEach(function (e) {
      if (!e.alive) return;
      var f = Math.floor(t * 8 + (e.ph || 0)) % 2;
      if (e.type === 'moth') spr(ctx, MOTH[f], X(e.x) - 12, Y(e.y) - 6, null, false);
      else spr(ctx, CRAWL[f], X(e.x) - 14, Y(e.y) - 12, null, e.dir < 0);
    });
    var M = S.mole, H = S.hero;
    if (M.state !== 'home') {
      if (M.state === 'dig') { ctx.fillStyle = '#aa5500'; for (var d = 0; d < 4; d++) ctx.fillRect(X(M.x) + Math.floor((Math.random() - 0.5) * 12) * 2, Y(M.y) + Math.floor((Math.random() - 0.5) * 10) * 2, 4, 4); }
      mole(ctx, X(M.x), Y(M.y) + 2, M.vert ? 1 : M.dir, t, M.state === 'dig');
    }
    if (S.phase !== 'dead' && !(H.inv > 0 && Math.floor(t * 14) % 2 && S.phase === 'play' && !o.bare)) hero(ctx, X(H.x), Y(H.y), H, t, { noMole: M.state !== 'home' });
    if (o.toasts) Gb.ui.toasts(g, ctx, o.toasts, P);
    ctx.restore();
    // сканлайны
    ctx.fillStyle = 'rgba(0,0,0,.18)'; for (var sy = OY; sy < g.H; sy += 4) ctx.fillRect(0, sy, g.W, 2);
    if (!o.bare) { Gb.ui.hud(g, ctx, S, P, api); Gb.ui.banner(g, ctx, S, P, o); }
  }

  var api = { P: P, CC: CC, bg: bg, draw: draw, hero: hero, mole: mole, lifeIcon: lifeIcon, crystalIcon: crystalIcon, staticLayer: staticLayer };
  Gb.classic = api;
})(typeof window !== 'undefined' ? window : globalThis);
