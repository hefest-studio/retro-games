/* УГОЛЁК · рендер RETRO (8-бит). UGOLYOK.classic = { P, KC, bg, draw, hero, lifeIcon, coalIcon, keyIcon, helmetIcon }
   16-цветная палитра ранних машин, пиксельные спрайты 2×, порода кирпичной кладкой в цвет яруса, сканлайны.
   Логику не трогает — только читает состояние. */
(function (global) {
  'use strict';
  var U = global.UGOLYOK = global.UGOLYOK || {};
  var L = U.logic, T = 32, OY = 36, PX = 2, COLS = L.COLS, ROWS = L.ROWS;

  var P = {
    pixel: true, font: '"Courier New", ui-monospace, monospace',
    hudBg: '#000000', hudLine: '#aa5500', ink: '#ffffff', muted: '#aaaaaa', accent: '#ff5555', good: '#55ff55', bad: '#ff5555', warn: '#ffff55',
    bar: '#333333', panel: '#000000', panelA: '#000000', line: '#aa5500', mapLine: '#aaaaaa', mapDim: '#555555',
    beaconMap: '#ffff55', dim: '#555555', helmet: '#ffff55',
    zoneMap: ['#aa5500', '#0000aa', '#00aa00', '#aa0000', '#555555', '#aa00aa']
  };
  var KC = { 1: '#ff5555', 2: '#55ffff', 3: '#ffff55' };
  var ZR = [['#aa5500', '#ffaa00'], ['#0000aa', '#5555ff'], ['#00aa00', '#55ff55'], ['#aa0000', '#ff5555'], ['#555555', '#aaaaaa'], ['#aa00aa', '#ff55ff']];

  // Спрайты: '.' прозрачно; k чёрный, g серый, d тёмно-серый, w белый, y жёлтый, o оранжевый, r красный, R ярко-красный,
  // n бурый, c голубой, b синий, e зелёный, m пурпур
  var PAL = { k: '#000000', g: '#aaaaaa', d: '#555555', w: '#ffffff', y: '#ffff55', o: '#ffaa00', r: '#aa0000', R: '#ff5555', n: '#aa5500', c: '#55ffff', b: '#0000aa', e: '#55ff55', m: '#aa00aa' };
  var HEAD = [
    '..kk........', '..kd........', '.kkkkkkkkkk.', '.kggggggggk.', '.kgkkkkkkgk.', '.kgkykkwwgk.', '.kgkkkkkkgk.', '.kggggggggk.', '..kkkkkkkk..'
  ];
  var BODY = [
    '.kddddddddk.', 'kdgddddddgdk', 'kdkkkkkkkkdk', 'kdkoRoRoRkdk', 'kdkRoRoRokdk', 'kdkkkkkkkkdk', 'kddddddddddk', '.kkkkkkkkkk.'
  ];
  var ARM = ['gk', 'gk', 'gk', 'ggg', 'ggg'];
  var LEGS = {
    stand: ['...kdk.kdk..', '...kdk.kdk..', '..kkkk.kkkk.'],
    w1: ['..kdk...kdk.', '..kdk...kdk.', '.kkkk...kkkk'],
    w2: ['....kdkkdk..', '....kdkkdk..', '...kkkkkkkk.'],
    air: ['..kdk...kdk.', '.kdk.....kdk', '.kkk.....kkk']
  };
  var HAT = ['...yyyyyy...', '..yyyyyywy..', '.yyyyyyyyyy.', 'yyyyyyyyyyyy'];
  var FLY = [['gg..dddd..gg', 'ggg.dkkd.ggg', '.ggdkkkkdgg.', '..dkRkkRkd..', '..dkkkkkkd..', '...dkkkkd...', '....dddd....'],
    ['............', '....dddd....', 'gggdkkkkdggg', 'ggdkRkkRkdgg', 'g.dkkkkkkd.g', '...dkkkkd...', '....dddd....']];
  var CRAWL = [['...nnnnnnn....', '..nonnonnonk..', '.nnnnnnnnnnkk.', '.nnnnnnnnnnkyk', '..d.d.d.d.d...', '.d.d.d.d.d....'],
    ['...nnnnnnn....', '..nonnonnonk..', '.nnnnnnnnnnkk.', '.nnnnnnnnnnkyk', '..d.d.d.d.d...', '...d.d.d.d.d..']];
  var COAL = ['..dddd..', '.dgddgd.', 'dddddddd', 'ddddoddd', 'ddoddddd', '.dddddd.'];
  var KEY = ['.xxx.......', 'x.k.xxxxxxx', 'x.k.x...x.x', '.xxx.......'];
  var GEAR = ['..y..y..', '.yyyyyy.', 'yyy..yyy', '.yy..yy.', 'yyy..yyy', '.yyyyyy.', '..y..y..'];
  var BEACON = ['..gggg..', '.gyyyyg.', '.gywyyg.', '.gyyyyg.', '..gggg..', '...dd...', '...dd...', '...dd...', '...dd...', '...dd...', '..dddd..', '.dddddd.'];
  var BEACON_OFF = BEACON.map(function (s) { return s.replace(/[yw]/g, 'n'); });

  function spr(ctx, rows, x, y, pal, flip, s) {
    var ps = PX * (s || 1), w = 0, r, c;
    for (r = 0; r < rows.length; r++) w = Math.max(w, rows[r].length);
    for (r = 0; r < rows.length; r++) for (c = 0; c < w; c++) {
      var ch = rows[r].charAt(flip ? w - 1 - c : c); if (ch === '.' || ch === ' ' || !ch) continue;
      ctx.fillStyle = (pal && pal[ch]) || PAL[ch] || '#ff00ff';
      ctx.fillRect(Math.round(x + c * ps), Math.round(y + r * ps), ps, ps);
    }
  }
  function X(x) { return Math.round(x * T); }
  function Y(y) { return Math.round(OY + y * T); }
  function bg(ctx, g) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, g.W, g.H); }

  var cache = {}, cacheN = 0, ST0 = { keys: {}, gate: false };
  function staticLayer(rm) {
    if (cache[rm.i]) return cache[rm.i];
    if (++cacheN > 40) { cache = {}; cacheN = 1; }
    var c = document.createElement('canvas'); c.width = COLS * T; c.height = ROWS * T;
    var x = c.getContext('2d'), zr = ZR[rm.zone], k;
    x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height);
    var seed = rm.i * 131 + 7, rnd = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (var i = 0; i < 30; i++) { x.fillStyle = rnd() < 0.5 ? zr[0] : '#555555'; x.fillRect(Math.floor(rnd() * 320) * 2, Math.floor(rnd() * 192) * 2, 2, 2); }
    var solid = function (q, r) { return L.isSolid(L.tileAt(ST0, rm, q, r)); };
    for (var r = 0; r < ROWS; r++) for (var q = 0; q < COLS; q++) {
      var t = rm.t[r * COLS + q], bx = q * T, by = r * T;
      if (t === L.R || t === L.CL || t === L.CR) {
        x.fillStyle = zr[0]; x.fillRect(bx, by, T, T);
        x.fillStyle = '#000';
        for (k = 0; k < 4; k++) { x.fillRect(bx, by + k * 8 + 6, T, 2); x.fillRect(bx + ((k % 2) ? 14 : 2), by + k * 8, 2, 6); x.fillRect(bx + ((k % 2) ? 30 : 18), by + k * 8, 2, 6); }
        if (solid(q, r - 1) && solid(q, r + 1) && solid(q - 1, r) && solid(q + 1, r)) { for (k = 0; k < 16; k += 2) for (var j = 0; j < 16; j += 2) if ((k + j) % 4 === 0) x.fillRect(bx + k * 2, by + j * 2, 2, 2); }
        if (!solid(q, r - 1) && r > 0) { x.fillStyle = zr[1]; x.fillRect(bx, by, T, 4); }
        if (t !== L.R) { x.fillStyle = '#555555'; x.fillRect(bx, by, T, 10); x.fillStyle = '#aaaaaa'; x.fillRect(bx + 6, by + 12, 6, 6); x.fillRect(bx + 20, by + 12, 6, 6); }
      } else if (t === L.SP) {
        for (k = 0; k < 4; k++) { x.fillStyle = '#aaaaaa'; x.fillRect(bx + k * 8 + 2, by + 16, 4, 16); x.fillRect(bx + k * 8, by + 24, 8, 8); x.fillStyle = '#ffffff'; x.fillRect(bx + k * 8 + 3, by + 10, 2, 6); }
      } else if (t === L.LD) {
        if (rm.rope[q]) { x.fillStyle = '#aa5500'; x.fillRect(bx + 14, by, 4, T); x.fillStyle = '#ffaa00'; for (k = 0; k < 4; k++) x.fillRect(bx + 14 + (k % 2) * 2, by + k * 8, 2, 4); }
        else { x.fillStyle = '#aaaaaa'; x.fillRect(bx + 6, by, 4, T); x.fillRect(bx + 22, by, 4, T); x.fillStyle = '#ffffff'; for (k = 0; k < 4; k++) x.fillRect(bx + 10, by + 4 + k * 8, 12, 4); }
      } else if (t === L.PF) {
        x.fillStyle = rm.zone === 4 || rm.zone === 2 ? '#555555' : '#aa5500'; x.fillRect(bx, by, T, 10);
        x.fillStyle = rm.zone === 4 || rm.zone === 2 ? '#aaaaaa' : '#ffaa00'; x.fillRect(bx, by, T, 2);
        x.fillStyle = '#000'; x.fillRect(bx + 14, by + 4, 2, 4);
      }
    }
    rm.hz.carts.forEach(function (cr) {
      var y0 = cr.y * T, x0 = cr.s * T - 6, x1 = (cr.e + 1) * T + 6;
      x.fillStyle = '#aa5500'; for (var sx = x0; sx < x1; sx += 12) x.fillRect(sx, y0 - 4, 6, 4);
      x.fillStyle = '#aaaaaa'; x.fillRect(x0, y0 - 6, x1 - x0, 2);
      x.fillStyle = '#ff5555'; x.fillRect(x0 - 4, y0 - 12, 4, 12); x.fillRect(x1, y0 - 12, 4, 12);
    });
    rm.hz.presses.forEach(function (p) {
      var px = p.x * T, py = p.top * T - 6;
      x.fillStyle = '#555555'; x.fillRect(px - 6, py, 2 * T + 12, 20); x.fillStyle = '#aaaaaa'; x.fillRect(px - 6, py + 16, 2 * T + 12, 2);
    });
    cache[rm.i] = c; return c;
  }

  function coalIcon(ctx, x, y, s) { spr(ctx, COAL, x - 8 * (s >= 6 ? 1 : 0.5), y - 6 * (s >= 6 ? 1 : 0.5), null, false, s >= 6 ? 1 : 0.5); }
  function keyIcon(ctx, x, y, k, on, sc) {
    var col = on ? KC[k] : '#333333';
    spr(ctx, KEY, x - 11 * (sc || 1), y - 4 * (sc || 1), { x: col, k: '#000000' }, false, sc || 1);
  }
  function helmetIcon(ctx, x, y) { spr(ctx, HAT, x - 6, y - 2, null, false, 0.5); }
  function lifeIcon(ctx, x, y, on) {
    ctx.fillStyle = on ? '#aaaaaa' : '#333333'; ctx.fillRect(x - 7, y - 6, 14, 12);
    ctx.fillStyle = on ? '#ffff55' : '#000'; ctx.fillRect(x + 1, y - 3, 4, 4);
    ctx.fillStyle = on ? '#ffaa00' : '#000'; ctx.fillRect(x - 4, y + 2, 8, 2);
    ctx.fillStyle = '#555555'; ctx.fillRect(x - 5, y - 10, 2, 4);
  }
  function hero(ctx, x, y, H, t, o) {
    o = o || {};
    var flip = !H.climb && H.face < 0, legs = LEGS.stand;
    if (H.climb) legs = Math.floor(H.y * 3) % 2 ? LEGS.w1 : LEGS.w2;
    else if (!H.ground) legs = LEGS.air;
    else if (H.walkT) legs = Math.floor(H.walkT * 8) % 2 ? LEGS.w1 : LEGS.w2;
    var x0 = x - 12, y0 = y - 40, fl = Math.floor(t * 8) % 2;
    var bpal = (o.fire || 0) > 0.66 ? { o: fl ? '#ffff55' : '#ffaa00', R: fl ? '#ffaa00' : '#ffff55' } : (o.fire || 0) > 0.33 ? { o: fl ? '#ffaa00' : '#ff5555', R: fl ? '#ff5555' : '#ffaa00' } : { o: fl ? '#aa0000' : '#ff5555', R: fl ? '#ff5555' : '#aa0000' };
    spr(ctx, HEAD, x0, y0, null, flip);
    spr(ctx, BODY, x0, y0 + 18, bpal, flip);
    spr(ctx, ARM, flip ? x0 - 4 : x0 + 22, y0 + 22, null, flip);
    spr(ctx, legs, x0, y0 + 34, null, flip);
    if (o.helmet) spr(ctx, HAT, x0, y0 - 4, null, flip);
  }

  function draw(ctx, S, g, o) {
    o = o || {};
    var W = L.world(), rm = W.rooms[S.room], t = S.time, r, q, k;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, g.W, g.H);
    ctx.drawImage(staticLayer(rm), 0, OY);
    ctx.save(); ctx.beginPath(); ctx.rect(0, OY, g.W, g.H - OY); ctx.clip();
    var frac = S.total ? S.coal / S.total : 0;
    for (r = 0; r < ROWS; r++) for (q = 0; q < COLS; q++) {
      var kt = L.tileAt(S, rm, q, r), bx = X(q), by = Y(r);
      if (kt === L.CL || kt === L.CR) {
        var off = Math.floor(((t * L.BELT * T * (kt === L.CR ? 1 : -1)) % 16 + 16) % 16 / 4) * 4;
        ctx.fillStyle = '#ffff55'; for (k = 0; k < 2; k++) ctx.fillRect(bx + (off + k * 16) % T, by + 4, 6, 2);
      } else if (kt === L.DR) {
        ctx.fillStyle = '#555555'; ctx.fillRect(bx, by, T, T);
        ctx.fillStyle = KC[rm.g[r * COLS + q]]; ctx.fillRect(bx + 4, by, 4, T); ctx.fillRect(bx + 24, by, 4, T); ctx.fillRect(bx + 12, by + 12, 8, 8);
        ctx.fillStyle = '#000'; ctx.fillRect(bx + 15, by + 14, 2, 4);
      } else if (kt === L.GT) {
        var n0 = 0; for (k = r + 1; k < ROWS && rm.t[k * COLS + q] === L.GT; k++) n0++;
        ctx.fillStyle = '#555555'; ctx.fillRect(bx, by, T, T); ctx.fillStyle = '#aaaaaa'; ctx.fillRect(bx + 2, by + 2, T - 4, 2);
        ctx.fillStyle = '#000'; ctx.fillRect(bx + 10, by + 6, 12, 20);
        var lit = frac * 3 - n0; if (lit > 0) { var h = Math.round(Math.min(1, lit) * 9) * 2; ctx.fillStyle = '#ffaa00'; ctx.fillRect(bx + 12, by + 24 - h, 8, h); }
      }
    }
    rm.items.forEach(function (it) {
      var ix = X(it.c) + T / 2, iy = Y(it.r), bob = Math.floor(t * 3) % 2 * 2;
      if (it.k === 'beacon') spr(ctx, S.cp.id === it.id ? BEACON : BEACON_OFF, ix - 16, iy - 48, S.cp.id === it.id && Math.floor(t * 4) % 2 ? { y: '#ffffff' } : null, false, 2);
      else if (it.k === 'forge') {
        var fx = X(it.c), fy = iy;
        ctx.fillStyle = '#aa0000'; ctx.fillRect(fx + 6, fy - 64, 52, 64);
        ctx.fillStyle = '#000'; for (k = 0; k < 6; k++) ctx.fillRect(fx + 6, fy - 64 + k * 11, 52, 2);
        ctx.fillStyle = '#555555'; ctx.fillRect(fx + 24, fy - 80, 16, 16);
        ctx.fillStyle = '#000'; ctx.fillRect(fx + 16, fy - 40, 32, 36);
        var on = S.gate || S.won, ff = Math.floor(t * 8) % 2;
        ctx.fillStyle = on ? (ff ? '#ffff55' : '#ffaa00') : (frac > 0.5 ? '#aa0000' : '#550000');
        ctx.fillRect(fx + 20, fy - 20, 24, 14);
        if (on) { ctx.fillStyle = ff ? '#ffaa00' : '#ff5555'; ctx.fillRect(fx + 24, fy - 32, 6, 12); ctx.fillRect(fx + 34, fy - 30, 6, 10); }
      }
      else if (S.got[it.id]) return;
      else if (it.k === 'coal') spr(ctx, COAL, ix - 8, iy - 14 + bob, Math.floor(t * 4 + it.c) % 2 ? { o: '#ffff55' } : null, false);
      else if (it.k === 'key') spr(ctx, KEY, ix - 11, iy - 18 + bob, { x: KC[it.key], k: '#000000' }, false);
      else if (it.k === 'gear') spr(ctx, GEAR, ix - 8, iy - 20, null, Math.floor(t * 4) % 2 === 1);
      else if (it.k === 'helmet') spr(ctx, HAT, ix - 12, iy - 10 + bob, null, false);
    });
    rm.hz.drips.forEach(function (d) {
      var s = L.dripAt(d, t), x = X(d.x) + 14;
      ctx.fillStyle = '#55ffff';
      if (s.st === 'form') ctx.fillRect(x, Y(d.y0), 4, 2 + Math.floor(s.k * 3) * 2);
      else if (s.st === 'fall') { ctx.fillRect(x, Y(s.y) - 8, 4, 8); ctx.fillStyle = '#ffffff'; ctx.fillRect(x, Y(s.y) - 8, 2, 2); }
      else if (s.k < 1) { var sp = Math.floor(s.k * 4) * 2; ctx.fillRect(x - 4 - sp, Y(d.y1) - 4 - sp, 2, 2); ctx.fillRect(x + 6 + sp, Y(d.y1) - 4 - sp, 2, 2); }
    });
    rm.hz.carts.forEach(function (cr) {
      var s = L.cartAt(cr, t), cx = X(s.x), cy = Y(cr.y);
      ctx.fillStyle = '#555555'; ctx.fillRect(cx - 20, cy - 30, 40, 6); ctx.fillStyle = '#aaaaaa'; ctx.fillRect(cx - 12, cy - 32, 4, 2); ctx.fillRect(cx + 6, cy - 32, 2, 2);
      ctx.fillStyle = '#aa0000'; ctx.fillRect(cx - 20, cy - 24, 40, 14); ctx.fillStyle = '#ff5555'; ctx.fillRect(cx - 20, cy - 24, 40, 2);
      ctx.fillStyle = '#000'; ctx.fillRect(cx - 18, cy - 18, 36, 2);
      var wf = s.moving && Math.floor(t * 12) % 2;
      [-12, 8].forEach(function (wx) { ctx.fillStyle = '#aaaaaa'; ctx.fillRect(cx + wx, cy - 10, 6, 6); ctx.fillStyle = '#000'; ctx.fillRect(cx + wx + (wf ? 2 : 0), cy - 8, 2, 2); });
    });
    rm.hz.enemies.forEach(function (e) {
      var p = L.enemyAt(e, t), f = Math.floor(t * 8 + (e.ph || 0)) % 2;
      if (e.type === 'flyer') spr(ctx, FLY[f], X(p.x) - 12, Y(p.y) - 7, null, false);
      else spr(ctx, CRAWL[f], X(p.x) - 14, Y(p.y) - 12, null, p.dir < 0);
    });
    var H = S.hero, fire = 0.25 + 0.75 * frac;
    if (S.phase !== 'dead' && !(H.inv > 0 && Math.floor(t * 14) % 2 && S.phase === 'play' && !o.bare)) hero(ctx, X(H.x), Y(H.y), H, t, { fire: fire, helmet: S.helmet > 0 && (S.helmet > 2.5 || Math.floor(t * 8) % 2) });
    rm.hz.presses.forEach(function (p) {
      var s = L.pressAt(p, t), px = X(p.x), bot = Y(s.bottom), top = Y(p.top) + 14, sh = s.st === 'warn' ? (Math.floor(t * 30) % 2 ? 2 : -2) : 0;
      ctx.fillStyle = '#aaaaaa'; ctx.fillRect(px + 26 + sh, top, 12, Math.max(0, bot - 22 - top));
      ctx.fillStyle = '#555555'; ctx.fillRect(px + 2 + sh, bot - 22, 60, 22);
      for (k = 0; k < 7; k++) { ctx.fillStyle = k % 2 ? '#000000' : '#ffff55'; ctx.fillRect(px + 4 + sh + k * 8, bot - 18, 8, 8); }
      ctx.fillStyle = '#aaaaaa'; ctx.fillRect(px + 2 + sh, bot - 4, 60, 4);
      var lamp = s.st !== 'up' && s.st !== 'rise';
      ctx.fillStyle = lamp ? (Math.floor(t * 10) % 2 ? '#ff5555' : '#ffff55') : '#aa0000'; ctx.fillRect(px + 28, Y(p.top) + 2, 8, 6);
    });
    if (o.toasts) U.ui.toasts(g, ctx, o.toasts, P);
    ctx.restore();
    ctx.fillStyle = 'rgba(0,0,0,.18)'; for (var sy = OY; sy < g.H; sy += 4) ctx.fillRect(0, sy, g.W, 2);
    if (!o.bare) { U.ui.hud(g, ctx, S, P, api); U.ui.banner(g, ctx, S, P, o); }
  }

  var api = { P: P, KC: KC, bg: bg, draw: draw, hero: hero, lifeIcon: lifeIcon, coalIcon: coalIcon, keyIcon: keyIcon, helmetIcon: helmetIcon, staticLayer: staticLayer };
  U.classic = api;
})(typeof window !== 'undefined' ? window : globalThis);
