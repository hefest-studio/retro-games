/* КАТАКОМБЫ · рендер RETRO (8-бит). KATAKOMBY.classic — тот же набор, что у modern:
   16-цветная палитра в духе CGA/EGA, всё на сетке 4 px, кирпичная кладка, без сглаживания,
   без теней и света (тьма — «шахматным» затемнением по краю кадра). Логику не трогает. */
(function (global) {
  'use strict';
  var K = global.KATAKOMBY = global.KATAKOMBY || {};

  var P = {
    pixel: true, font: '"Courier New", ui-monospace, monospace',
    void: '#000000', hudBg: '#000000', line: '#5555ff', panel: '#000000', ink: '#ffffff', muted: '#aaaaaa', accent: '#ffaa00',
    good: '#55ff55', bad: '#ff5555', warn: '#ffff55', boss: '#ff55ff', barBg: '#222244',
    hero: ['#ffaa00', '#55ffff'], up: { str: '#ff5555', spd: '#55ffff', arm: '#aaaaff' },
    selBg: '#000055', rowBg: '#111122', dim: 'rgba(0,0,0,.6)', bombFlash: 'rgba(255,255,255,.7)',
    enemy: { shade: '#aa55ff', slime: '#55ff55', spitter: '#ff5555' }
  };
  function px(ctx, c, x, y, w, h) { ctx.fillStyle = c; ctx.fillRect(Math.round(x / 2) * 2, Math.round(y / 2) * 2, w, h); }
  // Спрайт из строк: символ → цвет (по 4 px на «пиксель»)
  function spr(ctx, rows, x, y, map, s) {
    s = s || 4; var w = rows[0].length, h = rows.length, x0 = Math.round(x - w * s / 2), y0 = Math.round(y - h * s / 2);
    for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) { var c = map[rows[j][i]]; if (c) { ctx.fillStyle = c; ctx.fillRect(x0 + i * s, y0 + j * s, s, s); } }
  }

  function floor(ctx, x, y, tx, ty) {
    ctx.fillStyle = '#000000'; ctx.fillRect(x, y, 32, 32);
    ctx.fillStyle = '#111133'; if ((tx + ty) % 2) ctx.fillRect(x + 12, y + 12, 4, 4); else ctx.fillRect(x + 4, y + 24, 4, 4);
  }
  function wall(ctx, x, y, tx, ty, cell) {
    ctx.fillStyle = '#aa5500'; ctx.fillRect(x, y, 32, 32);
    ctx.fillStyle = '#552a00';
    ctx.fillRect(x, y + 6, 32, 2); ctx.fillRect(x, y + 14, 32, 2); ctx.fillRect(x, y + 22, 32, 2); ctx.fillRect(x, y + 30, 32, 2);
    var o = (ty % 2) * 8;
    for (var r = 0; r < 4; r++) { var oo = (r % 2) ? 16 - o : o; ctx.fillRect(x + oo, y + r * 8, 2, 6); ctx.fillRect(x + oo + 16 > x + 32 ? x + oo - 16 : x + oo + 16, y + r * 8, 2, 6); }
    if (cell(tx, ty + 1) !== '#') { ctx.fillStyle = '#ff5555'; ctx.fillRect(x, y + 28, 32, 2); }
  }
  function door(ctx, x, y, horiz) {
    ctx.fillStyle = '#555555'; ctx.fillRect(x + 2, y + 2, 28, 28);
    ctx.fillStyle = '#ffff55';
    if (horiz) { ctx.fillRect(x + 2, y + 8, 28, 4); ctx.fillRect(x + 2, y + 20, 28, 4); } else { ctx.fillRect(x + 8, y + 2, 4, 28); ctx.fillRect(x + 20, y + 2, 4, 28); }
    ctx.fillStyle = '#000000'; ctx.fillRect(x + 14, y + 14, 4, 6);
  }
  function exit(ctx, x, y, t) {
    ctx.fillStyle = '#000055'; ctx.fillRect(x, y, 32, 32);
    ctx.fillStyle = Math.floor(t * 3) % 2 ? '#55ffff' : '#00aaaa';
    for (var i = 0; i < 4; i++) ctx.fillRect(x + 4 + i * 2, y + 4 + i * 7, 24 - i * 4, 4);
  }
  var ICON = {
    key: { rows: ['.yy.....', 'y..yyyyy', '.yy..y.y'], map: { y: '#ffff55' } },
    chest: { rows: ['bbbbbb', 'byyyyb', 'bbybbb', 'bbbbbb'], map: { b: '#aa5500', y: '#ffff55' } },
    food: { rows: ['..ww..', '.oooo.', 'oooooo', '.oooo.'], map: { o: '#ffaa55', w: '#ffffff' } },
    potion: { rows: ['.w.', '.b.', 'bbb', 'bbb'], map: { w: '#aa5500', b: '#5555ff' } }
  };
  function item(ctx, kind, x, y, t, s) {
    var ic = ICON[kind]; if (!ic) return;
    var blink = t && Math.floor(t * 4 + x) % 8 === 0;
    spr(ctx, ic.rows, x, y, blink ? Object.keys(ic.map).reduce(function (m, k) { m[k] = '#ffffff'; return m; }, {}) : ic.map, s && s < 1 ? 3 : 4);
  }
  function lair(ctx, l, t) {
    var x = l.x, y = l.y;
    if (l.hp <= 0) { px(ctx, '#222222', x - 12, y - 4, 24, 12); return; }
    var col = l.flash > 0 ? '#ffffff' : P.enemy[l.kind], f = l.hp / l.max;
    spr(ctx, ['.gggggg.', 'gggggggg', 'ggcccggg', 'gccxxccg', 'gccxxccg', 'gggccggg', 'gggggggg'], x, y, { g: '#555555', c: col, x: Math.floor(t * 4) % 2 ? '#000000' : '#222222' });
    ctx.fillStyle = '#000000';
    if (f < 0.75) ctx.fillRect(x - 14, y - 10, 4, 4);
    if (f < 0.5) ctx.fillRect(x + 10, y + 2, 4, 4);
    if (f < 0.25) ctx.fillRect(x - 2, y - 14, 4, 4);
  }
  var EN = {
    shade: [['.cccc.', 'cccccc', 'cwcwcc', 'cccccc', 'cccccc', 'c.cc.c'], ['.cccc.', 'cccccc', 'cwcwcc', 'cccccc', 'cccccc', '.c..c.']],
    slime: [['..cccc..', '.cccccc.', 'ccwccwcc', 'cccccccc', 'cccccccc'], ['........', '.cccccc.', 'ccwccwcc', 'cccccccc', 'cccccccc']],
    spitter: [['c.cccc.c', '.cccccc.', 'ccwccwcc', 'cccmmccc', '.cccccc.', 'c.c..c.c'], ['.ccccc..', 'ccccccc.', 'ccwccwcc', 'cccmmccc', '.cccccc.', '.c.cc.c.']]
  };
  function enemy(ctx, e, t) {
    var fr = EN[e.type][Math.floor(e.wob) % 2], col = e.flash > 0 ? '#ffffff' : P.enemy[e.type];
    spr(ctx, fr, e.x, e.y, { c: col, w: '#ffffff', m: '#000000' });
  }
  function boss(ctx, B, t) {
    if (B.dead && Math.floor(B.deadT * 10) % 2) return;
    var warn = B.ringT < 0.7 && !B.dead && Math.floor(t * 12) % 2;
    var col = B.flash > 0 ? '#ffffff' : warn ? '#ffff55' : '#aa00aa';
    spr(ctx, [
      '..g.g.g.g..',
      '.ggggggggg.',
      'ccccccccccc',
      'ccwwcwwcwwc',
      'ccwkcwkcwkc',
      'ccccccccccc',
      'cccmmmmmccc',
      'ccccccccccc',
      '.ccccccccc.',
      '..ccccccc..'
    ], B.x, B.y, { g: '#aaaaaa', c: col, w: '#ffff55', k: '#000000', m: '#550000' }, 6);
  }
  var HERO = {
    smith: ['.hhh.', 'hcccs', 'cecec', 'cccc.', 'c.c..'],
    spark: ['..h..', '.ccc.', 'cecec', '.ccc.', '.c.c.']
  };
  function heroBody(ctx, cls, x, y, fx, fy, col, s) {
    spr(ctx, HERO[cls], x, y, { h: cls === 'smith' ? '#aa5500' : col, c: col, e: '#000000', s: '#aaaaaa' }, s && s < 1 ? 3 : 4);
    if (cls === 'smith') px(ctx, '#aaaaaa', x + fx * 14 - 4, y + fy * 14 - 4, 8, 8);
    else px(ctx, '#ffff55', x + fx * 13 - 2, y + fy * 13 - 2, 4, 4);
  }
  function hero(ctx, h, t, players) {
    var col = P.hero[h.id];
    if (h.hurtT > 0 && Math.floor(t * 20) % 2) col = '#ffffff';
    heroBody(ctx, h.cls, h.x, h.y, Math.round(h.face.x), Math.round(h.face.y), col);
  }
  function grave(ctx, h) { spr(ctx, ['.ggg.', 'gwgwg', 'ggggg', 'ggggg'], h.x, h.y, { g: '#555555', w: '#aaaaaa' }); }
  function shot(ctx, s) { px(ctx, '#ffff55', s.x - 3, s.y - 3, 6, 6); px(ctx, '#ffffff', s.x - 1, s.y - 1, 2, 2); }
  function spit(ctx, s, t) { px(ctx, Math.floor(t * 10) % 2 ? '#ff55ff' : '#ff5555', s.x - s.r, s.y - s.r, s.r * 2, s.r * 2); }
  function swing(ctx, w) {
    if (w.t < 0.05) return;
    ctx.fillStyle = '#ffffff';
    for (var i = -2; i <= 2; i++) { var a = Math.atan2(w.fy, w.fx) + i * 0.4; px(ctx, '#ffffff', w.x - w.fx * 14 + Math.cos(a) * w.r - 2, w.y - w.fy * 14 + Math.sin(a) * w.r - 2, 4, 4); }
  }
  // Ретро-«тьма»: шахматное затемнение вдали от героев (без градиентов)
  function light(ctx, S, g) {
    var L = K.logic, step = 8;
    ctx.fillStyle = '#000000';
    for (var y = 0; y < L.VIEW_H; y += step) for (var x = 0; x < L.VIEW_W; x += step) {
      var wx = x + S.cam.x, wy = y + S.cam.y, near = 1e9;
      S.heroes.forEach(function (h) { if (h.alive) near = Math.min(near, Math.hypot(h.x - wx, h.y - wy)); });
      if (near > 460) ctx.fillRect(x, y + L.HUD, step, step);
      else if (near > 340 && ((x + y) / step) % 2 === 0) ctx.fillRect(x, y + L.HUD, step, step);
    }
  }
  function badge(ctx, cls, x, y, pi) { heroBody(ctx, cls, x, y, 1, 0, P.hero[pi], 0.75); }

  K.classic = { P: P, wall: wall, floor: floor, door: door, exit: exit, item: item, lair: lair, enemy: enemy, boss: boss,
    hero: hero, grave: grave, shot: shot, spit: spit, swing: swing, light: light, badge: badge, heroBody: heroBody };
})(typeof window !== 'undefined' ? window : globalThis);
