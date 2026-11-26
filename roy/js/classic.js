/* РОЙ · рендер 8-БИТ (retro). ROY.classic = { P, bg, draw, icon }
   Свой пиксель-арт: спрайты — массивы строк (символ = цвет палитры спрайта), пререндер в offscreen-canvas ×3,
   ограниченная палитра, сканлайны. Рой — семена-мошки, Матка — соты, корабль «Огниво». Логику не трогает. */
(function (global) {
  'use strict';
  var R = global.ROY = global.ROY || {};
  var PX = 3;

  var P = {
    pixel: true, font: '"Courier New", ui-monospace, monospace', ink: '#fcfcfc', muted: '#a4a4bc', accent: '#fca044', good: '#80d010', bad: '#e40058',
    panel: '#000008', line: '#fca044', hudBg: '#000008', bar: '#383848', queenBar: '#b870f8', tipEdge: '#80d010'
  };

  var SPR = {
    ship: [[
      '....a....',
      '...aaa...',
      '..aacaa..',
      'b.accca.b',
      'bbaacaabb',
      'b.aaaaa.b',
      '...aaa...',
      '....o....'
    ], [
      '....a....',
      '...aaa...',
      '..aacaa..',
      'b.accca.b',
      'bbaacaabb',
      'b.aaaaa.b',
      '...aaa...',
      '....y....'
    ]],
    gnat: [[
      '.......',
      '..ggg..',
      '..glgg.',
      'wwgggww',
      '.gkgkg.',
      '..ggg..',
      '.......'
    ], [
      '.......',
      'w.ggg.w',
      'wwglggw',
      '.ggggg.',
      '.gkgkg.',
      '..ggg..',
      '.......'
    ]],
    shell: [[
      '...sss...',
      '.ss...ss.',
      's..ggg..s',
      's.gglgg.s',
      's.gkgkg.s',
      's..ggg..s',
      '.ss...ss.',
      '...sss...'
    ]],
    powder: [[
      '....y.',
      '...f..',
      '..rrr.',
      '.rrlrr',
      '.rkrkr',
      '.rrrrr',
      '..rrr.'
    ], [
      '...y..',
      '...f..',
      '..rrr.',
      '.rrlrr',
      '.rkrkr',
      '.rrrrr',
      '..rrr.'
    ]],
    burn: [[
      '..y.y..',
      '.yoyoy.',
      'yowwwoy',
      'owwwwwo',
      'yowwwoy',
      '.oyoyo.',
      '..o.o..'
    ], [
      '.y...y.',
      '..yoy..',
      '.owwwo.',
      'yowwwoy',
      '.owwwo.',
      '..oyo..',
      '...o...'
    ]],
    queen: [[
      '.....mmmmmmm.....',
      '....mhhhmhhhm....',
      '...mhhhmmmhhhm...',
      '..mmmmmhhhmmmmm..',
      '.mhhhmhhhhhmhhhm.',
      'mhhhmhhcccchmhhhm',
      'mmmmmhhcwcchmmmmm',
      'mhhhmhhcccchmhhhm',
      '.mhhhmhhhhhmhhhm.',
      '..mmmmmhhhmmmmm..',
      '...mhhhmmmhhhm...',
      '....mhhhmhhhm....',
      '.....mmmmmmm.....'
    ]],
    lure: [[
      '...p...',
      '..ppp..',
      '.ppwpp.',
      'ppwwwpp',
      '.ppwpp.',
      '..ppp..',
      '...p...'
    ], [
      '.......',
      '...p...',
      '..pwp..',
      '.pwwwp.',
      '..pwp..',
      '...p...',
      '.......'
    ]]
  };
  var PAL = {
    ship: { a: '#3cbcfc', b: '#fcfcfc', c: '#fca044', o: '#f83800', y: '#fcd8a8' },
    gnat: { g: '#80d010', l: '#d8f878', k: '#000000', w: '#bcbcbc' },
    shell: { s: '#6888fc', g: '#80d010', l: '#d8f878', k: '#000000' },
    powder: { r: '#f83800', l: '#fca044', k: '#000000', f: '#a4a4a4', y: '#fcfc00' },
    burn: { y: '#fcfc00', o: '#f87800', w: '#fcfcfc' },
    queen: { m: '#6844fc', h: '#b870f8', c: '#fca044', w: '#fcfcfc' },
    queenH: { m: '#fcfcfc', h: '#fcbcfc', c: '#fcfcfc', w: '#fca044' },
    lure: { p: '#f878f8', w: '#fcfcfc' }
  };
  var STAR_COL = ['#fcfcfc', '#f878f8', '#fcd8a8', '#3cbcfc', '#7c7c9c'];

  var cache = {};
  function sprite(name, frame, palName, scale) {
    scale = scale || PX; var fr = SPR[name][frame % SPR[name].length] ? frame % SPR[name].length : 0;
    var key = name + fr + palName + scale; if (cache[key]) return cache[key];
    var rows = SPR[name][fr], pal = PAL[palName || name];
    var c = document.createElement('canvas'); c.width = rows[0].length * scale; c.height = rows.length * scale;
    var x = c.getContext('2d');
    for (var y = 0; y < rows.length; y++) for (var i = 0; i < rows[y].length; i++) {
      var ch = rows[y][i]; if (ch === '.' || !pal[ch]) continue; x.fillStyle = pal[ch]; x.fillRect(i * scale, y * scale, scale, scale);
    }
    cache[key] = c; return c;
  }
  function blit(ctx, img, x, y) { ctx.drawImage(img, Math.round(x - img.width / 2), Math.round(y - img.height / 2)); }

  var stars = null, lastT = 0;
  function bg(ctx, g) {
    var W = g.W, H = g.H;
    if (!stars) { stars = []; for (var i = 0; i < 64; i++) stars.push({ x: Math.random() * W, y: Math.random() * H, v: 16 + Math.random() * 44, c: STAR_COL[i % STAR_COL.length], ph: Math.random() * 6 }); }
    var dt = Math.min(0.1, Math.max(0, g.time - lastT)); lastT = g.time;
    ctx.fillStyle = '#000008'; ctx.fillRect(0, 0, W, H);
    for (var j = 0; j < stars.length; j++) {
      var s = stars[j]; s.y += s.v * dt; if (s.y > H) { s.y = -4; s.x = Math.random() * W; }
      if (Math.sin(g.time * 3 + s.ph) < -0.6) continue;
      ctx.fillStyle = s.c; ctx.fillRect((s.x / 3 | 0) * 3, (s.y / 3 | 0) * 3, s.v > 45 ? 3 : 2, s.v > 45 ? 3 : 2);
    }
  }

  function drone(ctx, d, fr) {
    if (d.state === 'burn') { blit(ctx, sprite('burn', fr), d.x, d.y); return; }
    if (d.kind === 'shell') { blit(ctx, d.shell ? sprite('shell', 0) : sprite('gnat', fr), d.x, d.y); if (!d.shell && d.crackT > 0 && fr) blit(ctx, sprite('shell', 0), d.x, d.y); return; }
    blit(ctx, sprite(d.kind, fr), d.x, d.y);
  }

  function draw(ctx, S, g, o) {
    o = o || {}; var i, t = g.time, fr = ((t * 6) | 0) % 2, C = R.consts;
    bg(ctx, g);
    ctx.fillStyle = '#181828'; for (var x = 0; x < S.W; x += 12) ctx.fillRect(x, C.PY0 - 16, 6, 3);
    var L = S.lure;
    if (L) { var u = (t * 0.8) % 1, rad = 14 + u * 90; ctx.fillStyle = '#f878f8'; for (var a = 0; a < 24; a++) { var an = a / 24 * 6.283; if (((a + fr) % 2)) ctx.fillRect(Math.round(L.x + Math.cos(an) * rad), Math.round(L.y + Math.sin(an) * rad), 3, 3); } }
    var q = S.queen;
    if (q && q.alive) {
      if (q.warn > 0 && fr) { ctx.fillStyle = '#e40058'; ctx.fillRect(q.x - 30, q.y - 30, 60, 3); ctx.fillRect(q.x - 30, q.y + 27, 60, 3); ctx.fillRect(q.x - 30, q.y - 30, 3, 60); ctx.fillRect(q.x + 27, q.y - 30, 3, 60); }
      blit(ctx, sprite('queen', 0, q.hurtT > 0 ? 'queenH' : 'queen'), q.x, q.y);
    }
    for (i = 0; i < S.drones.length; i++) { var d = S.drones[i]; if (d.state !== 'dead') drone(ctx, d, (fr + d.id) % 2); }
    if (L) blit(ctx, sprite('lure', fr), L.x, L.y);
    for (i = 0; i < S.sparks.length; i++) { var s = S.sparks[i]; ctx.fillStyle = '#fcfcfc'; ctx.fillRect(s.x - 3, s.y - 3, 6, 6); ctx.fillStyle = '#fcfc00'; ctx.fillRect(s.x - 1.5, s.y + 3, 3, 6); ctx.fillStyle = '#f87800'; ctx.fillRect(s.x - 1.5, s.y + 9, 3, 4); }
    for (i = 0; i < S.spores.length; i++) { var b = S.spores[i]; ctx.fillStyle = fr ? '#b870f8' : '#fcfcfc'; ctx.fillRect(b.x - 4, b.y - 4, 8, 8); ctx.fillStyle = '#6844fc'; ctx.fillRect(b.x - 1.5, b.y - 1.5, 3, 3); }
    var p = S.player;
    if (p.alive && !(p.inv > 0 && ((t * 12) | 0) % 2)) blit(ctx, sprite('ship', ((t * 14) | 0) % 2), p.x, p.y);
    if (!o.bare) {
      R.ui.hud(g, ctx, S, P, DRAW);
      R.ui.chainPop(g, ctx, S, P);
      R.ui.tip(g, ctx, S, P, DRAW);
      R.ui.banner(g, ctx, S, P);
    }
    ctx.fillStyle = 'rgba(0,0,0,.2)'; for (var y = 0; y < S.H; y += 3) ctx.fillRect(0, y, S.W, 1);
  }

  var DRAW = {
    lifeIcon: function (ctx, x, y) { blit(ctx, sprite('ship', 0, 'ship', 2), x, y); },
    chargeIcon: function (ctx, x, y, on) { ctx.fillStyle = on ? '#fcfc00' : '#383848'; ctx.fillRect(x - 4, y - 4, 8, 8); },
    lureIcon: function (ctx, x, y, k) { blit(ctx, sprite('lure', 0, 'lure', k >= 1 ? 3 : 2), x, y); if (k < 1) { ctx.fillStyle = '#f878f8'; ctx.fillRect(x - 12, y + 12, Math.round(24 * k), 3); } },
    btnIcon: function (ctx, x, y, key) { if (key === 'lure') blit(ctx, sprite('lure', 0), x, y); else { ctx.fillStyle = '#fcfc00'; ctx.fillRect(x - 5, y - 5, 10, 10); ctx.fillStyle = '#fcfcfc'; ctx.fillRect(x - 2, y - 2, 4, 4); } },
    queenIcon: function (ctx, x, y) { blit(ctx, sprite('queen', 0, 'queen', 2), x, y); }
  };

  function icon(ctx, kind, x, y, g) {
    var fr = ((g.time * 6) | 0) % 2;
    if (kind === 'ship') blit(ctx, sprite('ship', fr), x, y);
    else if (kind === 'queen') blit(ctx, sprite('queen', 0, 'queen', 2), x, y);
    else if (kind === 'lure') blit(ctx, sprite('lure', fr), x, y);
    else drone(ctx, { kind: kind, x: x, y: y, state: 'live', shell: kind === 'shell', id: 0, crackT: 0 }, fr);
  }

  R.classic = { P: P, bg: bg, draw: draw, icon: icon, _SPR: SPR };
})(typeof window !== 'undefined' ? window : globalThis);
