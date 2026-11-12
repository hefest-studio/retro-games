/* ТАЙНИК · рендер RETRO (8-бит). TAYNIK.classic = { P, world, light, lifeIcon, ammoIcon, hero }
   Та же башня, что в modern, но пиксельно: ограниченная палитра, кирпич двумя цветами,
   спрайты из строк-масок (1 символ = 2×2 px), без плавного света. */
(function (global) {
  'use strict';
  var K = global.TAYNIK = global.TAYNIK || {};
  var L = K.logic, T = L.T;

  var P = {
    pixel: true, font: '"Courier New", ui-monospace, monospace', bg: '#000000',
    hudBg: '#000000', hudLine: '#a81000', ink: '#fcfcfc', muted: '#a4a4a4', accent: '#fc9838',
    good: '#58d854', bad: '#f83800', warn: '#f8b800', panel: '#000000', bar: '#302010',
    rope: '#fcd8a8', acid: '#58d854', mapCell: '#101040', mapPath: '#005800', mapWall: '#a4a4a4', mapVoid: '#000000'
  };
  var COL = { c: '#2038ec', y: '#fcfc00', s: '#fcbcb0', o: '#f87858', G: '#bcbcbc', d: '#503000', e: '#a81000',
    l: '#7c3c1c', r: '#c84c0c', R: '#f83800', w: '#e4e4fc', b: '#2038ec', W: '#fcfcfc', g: '#00a844', k: '#005800',
    C: '#3cbcfc', B: '#0058f8', Y: '#f8b800', n: '#7c3c1c', N: '#ac7c00', m: '#fce0a8', x: '#d82800', a: '#a4a4a4' };
  var SPR = {
    stand: ['..ccc..', '.ccccy.', '..sss..', '..ooo..', '.oooGGG', '.oooo..', '..dd...', '..d.d..', '.ee.ee.'],
    walk: ['..ccc..', '.ccccy.', '..sss..', '..ooo..', '.oooGGG', '.oooo..', '..dd...', '.d...d.', 'ee...ee'],
    jump: ['..ccc..', '.ccccy.', '..sss..', 's.ooo..', '.oooGGG', '.oooo..', '.dd.dd.', 'e.....e', '.......'],
    climb: ['s.ccc.s', 'sccccys', '..sss..', '.ooooo.', '.ooooo.', '.ooooo.', '..d.d..', '..d.d..', '.ee.ee.'],
    spider: ['.l...l.', 'l.rrr.l', '.rrrrr.', 'l.rRr.l', '.l...l.'],
    spark1: ['..y..', '.yWy.', 'yWWWy', '.yWy.', '..y..'],
    spark2: ['y...y', '.yWy.', '.WWW.', '.yWy.', 'y...y'],
    ghost1: ['..www..', '.wwwww.', 'wwbwbww', 'wwwwwww', 'wwwwwww', 'w.www.w', '...w...'],
    ghost2: ['..www..', '.wwwww.', 'wwbwbww', 'wwwwwww', 'wwwwwww', '.www.ww', 'w...w..'],
    cham: ['.....gggW', 'g.gggggkg', '.ggggggg.', '..Y...Y..'],
    gem: ['..C..', '.CWC.', 'CCBCC', '.CBC.', '..C..'],
    gear: ['.Y.Y.', 'YYYYY', '.YdY.', 'YYYYY', '.Y.Y.'],
    crate: ['nnnnnnn', 'nNNyNNn', 'nNyyNNn', 'nNNyyNn', 'nNNyNNn', 'nnnnnnn'],
    oil: ['...a.', '..a..', 'xxxx.', 'xWxx.', 'xWxx.', 'xxxx.'],
    map: ['m.....m', 'mmmmmmm', 'mmRmRmm', 'mmmRmmm', 'mmRmRmm', 'm.....m'],
    lampOff: ['.aaa.', 'addda', 'addda', '.aaa.'],
    lampOn: ['.aaa.', 'aYWYa', 'aYYYa', '.aaa.']
  };
  var FLIP = {};
  function flip(m) { var k = m.join('|'); return FLIP[k] || (FLIP[k] = m.map(function (r) { return r.split('').reverse().join(''); })); }
  function sprite(ctx, m, cx, by, px) {   // cx — центр по x, by — низ спрайта
    px = px || 2;
    var h = m.length, w = m[0].length, x0 = Math.round((cx - w * px / 2) / 2) * 2, y0 = Math.round((by - h * px) / 2) * 2;
    for (var r = 0; r < h; r++) for (var c = 0; c < w; c++) {
      var ch = m[r][c]; if (ch === '.') continue;
      ctx.fillStyle = COL[ch] || '#ff00ff'; ctx.fillRect(x0 + c * px, y0 + r * px, px, px);
    }
  }
  function rect(ctx, c, x, y, w, h) { ctx.fillStyle = c; ctx.fillRect(Math.round(x / 2) * 2, Math.round(y / 2) * 2, w, h); }

  // ---------- Статичный слой ----------
  var cache = { lv: null, c: null };
  function buildStatic(lv) {
    var c = document.createElement('canvas'); c.width = lv.pw; c.height = lv.ph;
    var x = c.getContext('2d');
    x.fillStyle = '#000000'; x.fillRect(0, 0, lv.pw, lv.ph);
    // задник: редкая тёмно-синяя кладка
    x.fillStyle = '#0c0c38';
    for (var by = 0; by < lv.ph; by += 20) for (var bx = (by / 20) % 2 ? 0 : 20; bx < lv.pw; bx += 40) x.fillRect(bx, by, 18, 2);
    for (var ty = 0; ty < lv.th; ty++) for (var tx = 0; tx < lv.tw; tx++) {
      var t = lv.tiles[ty * lv.tw + tx]; if (t !== 1) continue;
      var px = tx * T, py = ty * T;
      x.fillStyle = '#a83c0c'; x.fillRect(px, py, T, T);
      x.fillStyle = '#000000'; x.fillRect(px, py + 8, T, 2); x.fillRect(px, py + 18, T, 2);
      x.fillRect(px + ((ty % 2) ? 4 : 14), py, 2, 8); x.fillRect(px + ((ty % 2) ? 14 : 4), py + 10, 2, 8);
      if (!L.tileAt(lv, tx, ty - 1) && ty > 0) { x.fillStyle = '#fc9838'; x.fillRect(px, py, T, 2); }
    }
    var ex = lv.exitRope;
    x.fillStyle = '#f8b800'; x.fillRect(ex.x - 22, 0, 4, T + 2); x.fillRect(ex.x + 18, 0, 4, T + 2);
    return c;
  }

  function hero(ctx, h, t, opts) {
    opts = opts || {};
    if (opts.blink) return;
    var m = h.mode === 'rope' ? SPR.climb : h.mode === 'air' ? SPR.jump : (Math.abs(h.vx) > 1 && Math.floor(t * 8) % 2 ? SPR.walk : SPR.stand);
    if (h.mode !== 'rope' && h.face < 0) m = flip(m);
    sprite(ctx, m, h.x, h.y);
  }
  function rope(ctx, R) {
    var x = Math.round(R.x / 2) * 2 - 1;
    for (var y = R.top; y < R.bot; y += 4) { ctx.fillStyle = (y / 4) % 2 ? '#fcd8a8' : '#ac7c00'; ctx.fillRect(x, y, 2, 4); }
    if (R.exit) { ctx.fillStyle = '#f8b800'; ctx.fillRect(x - 2, R.top, 6, 2); }
    rect(ctx, '#ac7c00', x - 2, R.bot, 6, 4);
  }
  function enemy(ctx, e, t) {
    if (e.type === 'spider') {
      ctx.fillStyle = '#a4a4a4'; for (var y = e.top; y < e.y - 6; y += 4) ctx.fillRect(Math.round(e.x / 2) * 2 - 1, y, 2, 2);
      sprite(ctx, SPR.spider, e.x, e.y + 5);
    } else if (e.type === 'spark') sprite(ctx, Math.floor(t * 12) % 2 ? SPR.spark1 : SPR.spark2, e.x, e.y + 5);
    else if (e.type === 'ghost') { var gm = Math.floor(t * 4) % 2 ? SPR.ghost1 : SPR.ghost2; if (Math.floor(t * 20) % 4) sprite(ctx, gm, e.x, e.y + 7); }
    else if (e.type === 'cham') {
      if (!e.shown) { if (Math.floor(t * 2 + e.x) % 5 === 0) rect(ctx, '#c84c0c', e.x - 6, e.y - 4, 12, 2); return; }
      sprite(ctx, e.face < 0 ? flip(SPR.cham) : SPR.cham, e.x, e.y);
    } else if (e.type === 'drop') {
      rect(ctx, '#00a844', e.x - 4, e.top, 8, 2);
      var d = L.dropAt(e, t); if (!d) return;
      if (d.stage === 'grow') rect(ctx, '#58d854', e.x - 2, e.top + 2, 4, 2 + Math.round(d.k * 2) * 2);
      else if (d.stage === 'fall') { rect(ctx, '#58d854', e.x - 2, d.y - 4, 4, 8); rect(ctx, '#b8f818', e.x - 2, d.y - 4, 2, 2); }
      else { rect(ctx, '#58d854', e.x - 6 - d.k * 6, d.y - 4, 4, 2); rect(ctx, '#58d854', e.x + 2 + d.k * 6, d.y - 4, 4, 2); }
    }
  }
  function item(ctx, it, t) {
    var b = Math.floor(t * 3) % 2 ? 2 : 0;
    switch (it.type) {
      case 'gem': sprite(ctx, SPR.gem, it.x, it.y - 4 - b); break;
      case 'gear': sprite(ctx, SPR.gear, it.x, it.y - 4 - b); break;
      case 'crate': sprite(ctx, SPR.crate, it.x, it.y); break;
      case 'oil': sprite(ctx, SPR.oil, it.x, it.y); break;
      case 'map': sprite(ctx, SPR.map, it.x, it.y - 4 - b); break;
      case 'lamp':
        rect(ctx, '#a4a4a4', it.x - 1, it.y - 42, 2, 6);
        sprite(ctx, it.lit ? SPR.lampOn : SPR.lampOff, it.x, it.y - 28);
        if (it.lit && Math.floor(t * 6) % 2) { rect(ctx, '#f8b800', it.x - 8, it.y - 34, 2, 2); rect(ctx, '#f8b800', it.x + 6, it.y - 34, 2, 2); }
        break;
    }
  }

  function world(ctx, S, g, cam) {
    var lv = S.lv, t = g.time;
    if (cache.lv !== lv) { cache.lv = lv; cache.c = buildStatic(lv); }
    var vx0 = cam.x - 30, vy0 = cam.y - 30, vx1 = cam.x + L.VW + 30, vy1 = cam.y + L.VH + 30;
    ctx.drawImage(cache.c, cam.x, cam.y, L.VW, L.VH, cam.x, cam.y, L.VW, L.VH);
    // кислота: мигающая поверхность
    var tx0 = Math.max(0, Math.floor(vx0 / T)), tx1 = Math.min(lv.tw - 1, Math.floor(vx1 / T)), ty0 = Math.max(0, Math.floor(vy0 / T)), ty1 = Math.min(lv.th - 1, Math.floor(vy1 / T));
    for (var ty = ty0; ty <= ty1; ty++) for (var tx = tx0; tx <= tx1; tx++) {
      if (lv.tiles[ty * lv.tw + tx] !== 2) continue;
      ctx.fillStyle = '#005800'; ctx.fillRect(tx * T, ty * T, T, T);
      ctx.fillStyle = '#58d854'; ctx.fillRect(tx * T, ty * T + 2, T, 4);
      ctx.fillStyle = '#b8f818'; ctx.fillRect(tx * T + ((Math.floor(t * 6) + tx * 3) % 5) * 4, ty * T, 4, 2);
    }
    lv.ropes.forEach(function (R) { if (R.x > vx0 && R.x < vx1 && R.bot > vy0 && R.top < vy1) rope(ctx, R); });
    S.items.forEach(function (it) { if (it.taken || it.x < vx0 || it.x > vx1 || it.y < vy0 || it.y > vy1 + 20) return; item(ctx, it, t); });
    if (cam.bare) return;
    S.enemies.forEach(function (e) {
      if (!e.alive || e.x < vx0 - 20 || e.x > vx1 + 20) return;
      var top = e.type === 'spider' || e.type === 'drop' ? e.top : e.y - 20, bot = e.type === 'drop' ? e.floorY : e.y + 20;
      if (bot < vy0 || top > vy1) return;
      enemy(ctx, e, t);
    });
    S.bullets.forEach(function (b) { rect(ctx, '#fcfcfc', b.x - 3, b.y - 1, 6, 2); rect(ctx, '#3cbcfc', b.x - (b.vx > 0 ? 9 : -3), b.y - 1, 6, 2); });
    if (S.phase === 'play' || S.phase === 'clear') hero(ctx, S.hero, t, { blink: S.inv > 0 && Math.floor(t * 14) % 2 === 0 });
  }

  function lifeIcon(ctx, x, y, on) {
    var m = SPR.stand.slice(0, 4);
    if (on) sprite(ctx, m, x, y + 4);
    else { ctx.fillStyle = '#303030'; ctx.fillRect(x - 6, y - 4, 12, 8); }
  }
  function ammoIcon(ctx, x, y) { rect(ctx, '#3cbcfc', x - 4, y - 4, 8, 8); rect(ctx, '#fcfcfc', x - 2, y - 2, 4, 4); }

  K.classic = { P: P, world: world, light: null, lifeIcon: lifeIcon, ammoIcon: ammoIcon, hero: hero, sprite: sprite, SPR: SPR };
})(typeof window !== 'undefined' ? window : globalThis);
