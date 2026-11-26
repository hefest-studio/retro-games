/* КАТАКОМБЫ · рендер RETRO (8-бит). KATAKOMBY.classic — тот же набор, что у modern:
   16-цветная палитра, всё на сетке 4 px, без сглаживания и теней; камень — серо-зелёный «булыжник»,
   чаши и очаг — спрайты с двухкадровым огнём, свет чаш — точечный растр, тьма — шахматкой. Логику не трогает. */
(function (global) {
  'use strict';
  var K = global.KATAKOMBY = global.KATAKOMBY || {};

  var P = {
    pixel: true, font: '"Courier New", ui-monospace, monospace',
    void: '#000000', hudBg: '#000000', line: '#00aaaa', panel: '#000000', ink: '#ffffff', muted: '#aaaaaa', accent: '#ffaa00',
    good: '#55ff55', bad: '#ff5555', warn: '#ffff55', boss: '#aaaaaa', barBg: '#222222',
    hero: ['#55ffff', '#ff55ff'], up: { bnc: '#ffaa00', spd: '#55ffff', arm: '#55ff55' },
    selBg: '#003333', rowBg: '#111111', dim: 'rgba(0,0,0,.65)',
    fire: '#ffaa00', fireHot: '#ffff55', bronze: '#aa5500',
    enemy: { shade: '#aa00aa', slime: '#55ff55', spitter: '#ff5555' }
  };
  function px(ctx, c, x, y, w, h) { ctx.fillStyle = c; ctx.fillRect(Math.round(x / 2) * 2, Math.round(y / 2) * 2, w, h); }
  function spr(ctx, rows, x, y, map, s) {
    s = s || 4; var w = rows[0].length, h = rows.length, x0 = Math.round(x - w * s / 2), y0 = Math.round(y - h * s / 2);
    for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) { var c = map[rows[j][i]]; if (c) { ctx.fillStyle = c; ctx.fillRect(x0 + i * s, y0 + j * s, s, s); } }
  }

  function floor(ctx, x, y, tx, ty) {
    ctx.fillStyle = '#000000'; ctx.fillRect(x, y, 32, 32);
    ctx.fillStyle = '#112211'; if ((tx * 3 + ty) % 4 === 0) ctx.fillRect(x + 12, y + 12, 4, 4); else if ((tx + ty * 5) % 7 === 0) ctx.fillRect(x + 4, y + 24, 4, 4);
  }
  function wall(ctx, x, y, tx, ty, cell) {
    ctx.fillStyle = '#555555'; ctx.fillRect(x, y, 32, 32);
    ctx.fillStyle = '#005500';
    var o = ((tx + ty) % 2) * 8;
    ctx.fillRect(x + 4 + o, y + 4, 12, 8); ctx.fillRect(x + 16 - o, y + 18, 12, 8);
    ctx.fillStyle = '#222222'; ctx.fillRect(x, y, 32, 2); ctx.fillRect(x, y, 2, 32);
    var b = cell(tx, ty + 1); if (b !== '#' && b !== 'L') { ctx.fillStyle = '#aaaaaa'; ctx.fillRect(x, y + 28, 32, 4); }
  }
  function gate(ctx, x, y, horiz) {
    ctx.fillStyle = '#aaaaaa';
    for (var i = 0; i < 4; i++) { if (horiz) ctx.fillRect(x + 2 + i * 8, y, 4, 32); else ctx.fillRect(x, y + 2 + i * 8, 32, 4); }
    ctx.fillStyle = '#555555'; if (horiz) { ctx.fillRect(x, y + 8, 32, 4); ctx.fillRect(x, y + 20, 32, 4); } else { ctx.fillRect(x + 8, y, 4, 32); ctx.fillRect(x + 20, y, 4, 32); }
  }
  function seal(ctx, x, y, t, open, frac) {
    if (open) {
      spr(ctx, ['.oooooo.', 'oyyyyyyo', 'o.yyyy.o', 'o..yy..o', 'o......o', '.oooooo.'], x + 16, y + 16, { o: Math.floor(t * 4) % 2 ? '#ffaa00' : '#ffff55', y: '#ffff55' });
    } else {
      spr(ctx, ['.gggggg.', 'gg.gg.gg', 'g.gggg.g', 'gggkkggg', 'g.gggg.g', 'gg.gg.gg', '.gggggg.'], x + 16, y + 16, { g: '#555555', k: '#000000' });
      var n = 8, lit = Math.round(frac * n);
      for (var k = 0; k < n; k++) { var a = -Math.PI / 2 + k * Math.PI * 2 / n; px(ctx, k < lit ? '#ffaa00' : '#222222', x + 14 + Math.cos(a) * 10, y + 14 + Math.sin(a) * 10, 4, 4); }
    }
  }
  var FL = [['..y.', '.yo.', 'yoro', '.rr.'], ['.y..', '.oy.', 'oryo', '.rr.']];
  function lamp(ctx, l, t) {
    var fr = FL[(Math.floor(t * 6) + l.tx) % 2], fm = { y: '#ffff55', o: '#ffaa00', r: '#ff5555' };
    if (l.hearth) {
      spr(ctx, ['rrrrrrr', 'r.....r', 'rkkkkkr', 'rrrrrrr'], l.x, l.y + 6, { r: '#aa0000', k: '#550000' });
      spr(ctx, fr, l.x, l.y - 6, fm, 4);
      return;
    }
    spr(ctx, ['gggggg', '.gggg.', '..gg..', '..gg..', '.gggg.'], l.x, l.y + 6, { g: l.lit ? '#aa5500' : '#555555' });
    if (l.lit) spr(ctx, fr, l.x, l.y - 8, fm, 4);
    else px(ctx, '#aaaaaa', l.x - 6, l.y - 2, 12, 2);
    if (l.flash > 0 && Math.floor(l.flash * 20) % 2) { var r = 16 + (0.6 - l.flash) * 40; ctx.strokeStyle = l.lit ? '#ffff55' : '#aaaaaa'; ctx.lineWidth = 2; ctx.strokeRect(l.x - r, l.y - r, r * 2, r * 2); }
  }
  // свет чаши — редкий растр точек по кругу (без градиентов)
  function glow(ctx, l, R, t) {
    ctx.fillStyle = '#552200';
    for (var yy = -R; yy <= R; yy += 16) for (var xx = -R; xx <= R; xx += 16) {
      if (xx * xx + yy * yy > R * R) continue;
      var ox = ((yy / 16) % 2) ? 8 : 0; ctx.fillRect(Math.round((l.x + xx + ox) / 4) * 4, Math.round((l.y + yy) / 4) * 4, 4, 4);
    }
    var n = 24; ctx.fillStyle = Math.floor(t * 3) % 2 ? '#aa5500' : '#552200';
    for (var i = 0; i < n; i++) { var a = i * Math.PI * 2 / n; ctx.fillRect(Math.round((l.x + Math.cos(a) * R) / 4) * 4, Math.round((l.y + Math.sin(a) * R) / 4) * 4, 4, 4); }
  }
  var ICON = {
    chest: { rows: ['.yy.', 'oooo', 'oyyo', 'oooo', '.oo.'], map: { o: '#aa5500', y: '#ffff55' } },
    lamp: { rows: ['.y.', 'yoy', 'ggg', '.g.'], map: { y: '#ffff55', o: '#ffaa00', g: '#aaaaaa' } }
  };
  function item(ctx, kind, x, y, t, s) {
    var ic = ICON[kind]; if (!ic) return;
    var blink = t && Math.floor(t * 4 + x) % 8 === 0;
    spr(ctx, ic.rows, x, y, blink ? Object.keys(ic.map).reduce(function (m, k) { m[k] = '#ffffff'; return m; }, {}) : ic.map, s && s < 1 ? 3 : 4);
  }
  function rise(ctx, R, t) {
    var k = 1 - R.t / 0.8, w = 8 + Math.round(k * 4) * 4;
    px(ctx, Math.floor(t * 10) % 2 ? P.enemy[R.kind] : '#222222', R.x - w / 2, R.y + 4, w, 4);
    px(ctx, '#222222', R.x - w / 2 + 4, R.y + 8, w - 8, 4);
  }
  var EN = {
    shade: [['..cc..', '.cccc.', 'cwccwc', '.cccc.', '..ccc.', '....cc'], ['..cc..', '.cccc.', 'cwccwc', '.cccc.', '.ccc..', 'cc....']],
    slime: [['..cccc..', '.cccccc.', 'ccwccwcc', 'cccccccc', 'cccccccc'], ['........', '.cccccc.', 'ccwccwcc', 'cccccccc', 'cccccccc']],
    spitter: [['c..c..c', '.ccccc.', 'cwcccwc', 'ccc.ccc', '.ccmcc.', 'c..c..c'], ['.c.c.c.', 'ccccccc', 'cwcccwc', 'ccc.ccc', '.ccmcc.', '.c.c.c.']]
  };
  function enemy(ctx, e, t) {
    var fr = EN[e.type][Math.floor(e.wob) % 2], col = e.flash > 0 ? '#ffffff' : (e.lit && Math.floor(t * 12) % 2) ? '#ffaa00' : P.enemy[e.type];
    spr(ctx, fr, e.x, e.y, { c: col, w: '#ffffff', m: '#000000' });
  }
  function boss(ctx, B, t) {
    if (B.dead && Math.floor(B.deadT * 10) % 2) return;
    var warn = !B.dead && B.gustT < K.logic.BOSS.gustWarn && Math.floor(t * 12) % 2;
    var col = B.flash > 0 ? '#ffffff' : warn ? '#ffffff' : '#aaaaaa';
    var f = Math.floor(t * 3) % 2;
    spr(ctx, f ? [
      '...ccc.cc..',
      '.ccccccccc.',
      'ccccccccccc',
      'cc.oo.oo.cc',
      'ccccccccccc',
      'cccc.yy.ccc',
      '.ccccccccc.',
      'cc.ccccc.cc',
      '.c..ccc..c.'
    ] : [
      '..cc.ccc...',
      '.ccccccccc.',
      'ccccccccccc',
      'cc.oo.oo.cc',
      'ccccccccccc',
      'ccc.yy.cccc',
      '.ccccccccc.',
      '.cc.ccc.cc.',
      'c..ccc..c..'
    ], B.x, B.y, { c: col, o: '#ff5555', y: '#ffaa00' }, 6);
    if (B.guardT > 0 && !B.dead) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]); ctx.strokeRect(B.x - B.r - 8, B.y - B.r - 8, B.r * 2 + 16, B.r * 2 + 16); ctx.setLineDash([]); }
  }
  var HERO = ['..www..', '.wsssw.', '..ses..', '.ccccc.', 'ccccccc', '.cc.cc.'];
  function heroBody(ctx, x, y, fx, fy, col, s) {
    spr(ctx, HERO, x, y, { w: '#ffffff', s: '#ffaa55', e: '#000000', c: col }, s && s < 1 ? 3 : 4);
  }
  function hoopRing(ctx, x, y, spin, hot, s) {
    var big = s && s > 1, c = hot ? (Math.floor(spin * 2) % 2 ? '#ffff55' : '#ffaa00') : '#aa5500';
    spr(ctx, big ? ['.cc.', 'c..c', 'c..c', '.cc.'] : ['.c.', 'c.c', '.c.'], x, y, { c: c }, big ? 4 : 4);
  }
  function hero(ctx, h, t) {
    var col = P.hero[h.id];
    if (h.hurtT > 0 && Math.floor(t * 20) % 2) col = '#ffffff';
    heroBody(ctx, h.x, h.y, h.face.x, h.face.y, col);
  }
  function hoop(ctx, h, t) {
    var o = h.hoop, hot = o.hot > 0 && !(o.hot < 2 && Math.floor(t * 8) % 2);
    if (o.state !== 'held' && hot) { var l = Math.hypot(o.vx, o.vy) || 1; px(ctx, '#aa5500', o.x - o.vx / l * 12 - 2, o.y - o.vy / l * 12 - 2, 4, 4); }
    hoopRing(ctx, o.x, o.y, o.spin, hot, o.state === 'held' ? 1 : 1.2);
  }
  function grave(ctx, h) { spr(ctx, ['.ooo.', 'o...o', '.ooo.'], h.x, h.y + 4, { o: '#aa5500' }); }
  function spit(ctx, s, t) { px(ctx, Math.floor((t || 0) * 10) % 2 ? '#5555ff' : '#55ffff', s.x - s.r, s.y - s.r, s.r * 2, s.r * 2); }
  // Ретро-«тьма»: шахматное затемнение вдали от героев и горящих чаш (без градиентов)
  function light(ctx, S) {
    var L = K.logic, step = 8, src = [];
    S.heroes.forEach(function (h) { if (h.alive && !h.ghost) src.push([h.x, h.y, 200]); });
    S.lamps.forEach(function (l) { if (l.lit) src.push([l.x, l.y, L.LIGHT_R * 1.5]); });
    if (S.exit && S.sealOpen) src.push([S.exit.x, S.exit.y, 100]);
    if (S.boss && !S.boss.dead) src.push([S.boss.x, S.boss.y, 150]);
    if (S.ghostLight) src.push([S.ghostLight.x, S.ghostLight.y, 260]);
    ctx.fillStyle = '#000000';
    for (var y = 0; y < L.VIEW_H; y += step) for (var x = 0; x < L.VIEW_W; x += step) {
      var wx = x + S.cam.x, wy = y + S.cam.y, k = 9;
      for (var i = 0; i < src.length; i++) { var d = Math.hypot(src[i][0] - wx, src[i][1] - wy) / src[i][2]; if (d < k) k = d; }
      if (k > 1.15) ctx.fillRect(x, y + L.HUD, step, step);
      else if (k > 0.8 && ((x + y) / step) % 2 === 0) ctx.fillRect(x, y + L.HUD, step, step);
    }
  }
  function badge(ctx, x, y, pi) { heroBody(ctx, x, y, 1, 0, P.hero[pi], 0.75); }

  K.classic = { P: P, wall: wall, floor: floor, gate: gate, seal: seal, lamp: lamp, glow: glow, item: item, rise: rise, enemy: enemy, boss: boss,
    hero: hero, hoop: hoop, hoopRing: hoopRing, grave: grave, spit: spit, light: light, badge: badge, heroBody: heroBody };
})(typeof window !== 'undefined' ? window : globalThis);
