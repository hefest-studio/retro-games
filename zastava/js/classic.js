/* ЗАСТАВА · рендер RETRO (8-бит). ZASTAVA.classic = { P, bg, draw, lifeIcon }
   Чёрное небо в редких пиксельных звёздах, CGA-палитра, свой пиксель-арт 2×:
   гайка-клещ, шестерня, сверло, зонд с винтом, коршун (крылья / щит), лафет на гусеницах.
   Логику не трогает — только читает состояние. */
(function (global) {
  'use strict';
  var Z = global.ZASTAVA = global.ZASTAVA || {};
  var L = Z.logic;

  var P = {
    pixel: true, font: '"Courier New", ui-monospace, monospace',
    hudBg: '#000000', hudLine: '#fc9838', ink: '#ffffff', muted: '#a8a8a8', accent: '#fc9838',
    good: '#55ff55', bad: '#ff5555', panel: '#000000', bar: '#3c3c3c', bossBar: '#ff5555'
  };
  // Цвета пиксель-арта: '#' — основной (по виду), 'o' — глаз, 's' — щит, 'w' — белый, 'd' — тёмный
  var COL = { tick: '#fc9838', gear: '#ffff55', drill: '#55ffff', bird: '#ff55ff', probe: '#ff5555', player: '#ffffff' };
  var SPR = {
    tick: [[
      '...#######...',
      '..#########..',
      '.####ddd####.',
      '.###ddoddd##.',
      '.####ddd####.',
      '..#########..',
      '...#######...',
      '..#.#...#.#..',
      '.#...#.#...#.'
    ], [
      '...#######...',
      '..#########..',
      '.####ddd####.',
      '.##dddoddd##.',
      '.####ddd####.',
      '..#########..',
      '...#######...',
      '.#..#...#..#.',
      '#...#...#...#'
    ]],
    gear: [[
      '...#..#..#...',
      '..#########..',
      '.###.....###.',
      '##..#.o.#..##',
      '.#...ooo...#.',
      '##..#.o.#..##',
      '.###.....###.',
      '..#########..',
      '...#..#..#...'
    ], [
      '....#..#..#..',
      '.#.#########.',
      '.###.....###.',
      '.#..#.o.#..#.',
      '##...ooo...##',
      '.#..#.o.#..#.',
      '.###.....###.',
      '.#########.#.',
      '..#..#..#....'
    ]],
    drill: [[
      'wwww..w..wwww',
      '......w......',
      '.###########.',
      '..##o###o##..',
      '...##d####...',
      '....###d#....',
      '.....#d#.....',
      '......#......',
      '......#......'
    ], [
      '...ww.w.ww...',
      '......w......',
      '.###########.',
      '..##o###o##..',
      '...####d##...',
      '....#d###....',
      '.....##d.....',
      '......#......',
      '......#......'
    ]],
    probe: [[
      'wwwww....ww....wwwww..',
      '.........ww...........',
      '.......########.......',
      '.....############.....',
      '...##o###o###o###o#...',
      '..##################..',
      '....##############....',
      '......###dddd###......',
      '........######........'
    ], [
      '....wwww.ww.wwww......',
      '.........ww...........',
      '.......########.......',
      '.....############.....',
      '...###o###o###o###o...',
      '..##################..',
      '....##############....',
      '......###dddd###......',
      '........######........'
    ]],
    birdOpen: [[
      '#..................#',
      '##................##',
      '.##......ww......##.',
      '..###...wwww...###..',
      '...######oo######...',
      '....############....',
      '......########......',
      '.......######.......',
      '........####........',
      '.........ww.........',
      '.........ww.........'
    ], [
      '....................',
      '....................',
      '.........ww.........',
      '........wwww........',
      '..######woow######..',
      '####################',
      '##....########....##',
      '#......######......#',
      '........####........',
      '.........ww.........',
      '.........ww.........'
    ]],
    birdShield: [[
      '.........ww.........',
      '........wwww........',
      '.......#woow#.......',
      '......########......',
      '....#ssssssssss#....',
      '...##sswssssssss##..',
      '...#.sswsssssss.#...',
      '.....sswsssssss.....',
      '......swssssss......',
      '.......ssssss.......',
      '........ssss........',
      '.........ss.........'
    ]],
    player: [
      '........#........',
      '.......###.......',
      '.......###.......',
      '.....#######.....',
      '...###########...',
      '.###############.',
      '#################',
      '#d#d#d#d#d#d#d#d#'
    ]
  };
  function spr(ctx, rows, x, y, col, extra, sc) {
    sc = sc || 2; extra = extra || {};
    var w = rows[0].length, h = rows.length, x0 = Math.round(x - w * sc / 2), y0 = Math.round(y - h * sc / 2);
    for (var r = 0; r < h; r++) {
      var row = rows[r];
      for (var c = 0; c < w; c++) {
        var ch = row.charAt(c); if (ch === '.' || ch === ' ') continue;
        ctx.fillStyle = ch === '#' ? col : ch === 'o' ? (extra.o || '#ff5555') : ch === 's' ? (extra.s || '#5555ff') : ch === 'w' ? (extra.w || '#ffffff') : (extra.d || '#000000');
        ctx.fillRect(x0 + c * sc, y0 + r * sc, sc, sc);
      }
    }
  }

  // ---------- Фон ----------
  var cache = null;
  function buildBg(W, H) {
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var x = c.getContext('2d');
    x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
    var s = 5; function rnd() { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }
    for (var i = 0; i < 60; i++) { x.fillStyle = rnd() < 0.2 ? '#555555' : '#a8a8a8'; if (rnd() < 0.5) x.fillStyle = '#3c3c3c'; x.fillRect(Math.floor(rnd() * W / 2) * 2, 50 + Math.floor(rnd() * 220) * 2, 2, 2); }
    // зубцы заставы на земле
    var base = L.GROUND_Y;
    x.fillStyle = '#fc9838'; x.fillRect(0, base, W, 2);
    x.fillStyle = '#a85400'; x.fillRect(0, base + 2, W, H - base - 2);
    x.fillStyle = '#000';
    for (var yy = base + 6, row = 0; yy < H; yy += 6, row++) { x.fillRect(0, yy, W, 2); for (var xx = (row % 2) * 12; xx < W; xx += 24) x.fillRect(xx, yy - 4, 2, 4); }
    return c;
  }
  function bg(ctx, g) {
    if (!cache) cache = buildBg(g.W, g.H);
    ctx.drawImage(cache, 0, 0);
  }

  function scan(ctx, W, H) { ctx.fillStyle = 'rgba(0,0,0,.18)'; for (var y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 2); }

  function lifeIcon(ctx, x, y, on) { spr(ctx, SPR.player, x, y, on ? COL.player : '#3c3c3c', { d: '#555555' }, 1); }

  function boss(ctx, B, t) {
    var x = Math.round(B.x / 2) * 2, y = B.y, R = B.rings[B.rings.length - 1].r2, i;
    // корпус: ступенчатый купол и гондолы
    ctx.fillStyle = '#a85400';
    for (i = 0; i < 7; i++) { var hw = 104 - i * i * 2; ctx.fillRect(x - hw, y - R + 4 - i * 4, hw * 2, 4); }
    ctx.fillStyle = '#fc9838'; for (i = -3; i <= 3; i++) ctx.fillRect(x + i * 24 - 2, y - R - 10, 4, 4);
    ctx.fillStyle = '#555555'; ctx.fillRect(x - 104, y - 8, 208, 16);
    ctx.fillStyle = '#a8a8a8'; ctx.fillRect(x - 104, y - 8, 208, 2);
    [-1, 1].forEach(function (s) { ctx.fillStyle = '#a8a8a8'; ctx.fillRect(x + s * 94 - 10, y - 10, 20, 20); ctx.fillStyle = Math.floor(t * 4) % 2 ? '#ff5555' : '#550000'; ctx.fillRect(x + s * 94 - 3, y - 3, 6, 6); });
    // пояса: квадратные звенья (общая чёрная подложка под всеми поясами)
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(x, y, R + 1, 0, Math.PI * 2); ctx.fill();
    B.rings.forEach(function (g, gi) {
      var da = Math.PI * 2 / g.n, rm = (g.r1 + g.r2) / 2, sz = Math.max(6, Math.round((g.r2 - g.r1) / 2) * 2);
      for (var j = 0; j < g.n; j++) {
        var hp = g.hp[j]; if (hp <= 0) continue;
        var a = g.rot + (j + 0.5) * da, px = Math.round((x + Math.cos(a) * rm) / 2) * 2, py = Math.round((y + Math.sin(a) * rm) / 2) * 2;
        ctx.fillStyle = hp >= g.max ? (gi === 0 && B.rings.length > 1 ? '#55ffff' : '#a8a8a8') : '#fc9838';
        ctx.fillRect(px - sz / 2, py - sz / 2, sz, sz);
        ctx.fillStyle = '#000'; ctx.fillRect(px - 1, py - 1, 2, 2);
      }
    });
    // ядро: пиксельный круг
    var r = B.rc, hot = B.flash > 0;
    for (var yy = -r; yy <= r; yy += 2) for (var xx = -r; xx <= r; xx += 2) {
      var d = Math.hypot(xx, yy); if (d > r) continue;
      ctx.fillStyle = hot ? '#ffffff' : d < r * 0.35 ? '#ffff55' : d < r * 0.7 ? (Math.floor(t * 6) % 2 ? '#fc9838' : '#ffff55') : '#ff5555';
      ctx.fillRect(x + xx - 1, y + yy - 1, 2, 2);
    }
    ctx.fillStyle = '#550000'; ctx.fillRect(x - 2, y - 7, 4, 14);
  }

  function bunkers(ctx, S) {
    var s = L.BK_S;
    S.bunkers.forEach(function (b) {
      for (var r = 0; r < L.BK_R; r++) {
        ctx.fillStyle = r < 3 ? '#fc9838' : r < 9 ? '#a85400' : '#fc9838';
        for (var c = 0; c < L.BK_C; c++) if (b.cells[r * L.BK_C + c]) ctx.fillRect(b.x + c * s, b.y + r * s, s, s);
      }
    });
  }

  function bullet(ctx, b, t) {
    var x = Math.round(b.x), y = Math.round(b.y);
    if (b.kind === 'spark') { var w = Math.floor(t * 16 + x) % 2 ? 2 : -2; ctx.fillStyle = '#fc9838'; ctx.fillRect(x - 1 + w, y - 6, 2, 4); ctx.fillRect(x - 1 - w, y - 2, 2, 4); ctx.fillRect(x - 1 + w, y + 2, 2, 4); }
    else if (b.kind === 'drill') { ctx.fillStyle = '#55ffff'; ctx.fillRect(x - 3, y - 6, 6, 2); ctx.fillRect(x - 2, y - 4, 4, 6); ctx.fillRect(x - 1, y + 2, 2, 4); ctx.fillStyle = '#000'; ctx.fillRect(x - 2, y - 2 + (Math.floor(t * 20) % 2) * 2, 4, 1); }
    else if (b.kind === 'bomb') { ctx.fillStyle = '#ff55ff'; ctx.fillRect(x - 3, y - 2, 6, 6); ctx.fillRect(x - 2, y - 3, 4, 8); ctx.fillStyle = Math.floor(t * 10) % 2 ? '#ffff55' : '#ff5555'; ctx.fillRect(x - 1, y - 6, 2, 2); }
    else { ctx.fillStyle = '#ff5555'; ctx.fillRect(x - 3, y - 3, 6, 6); ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 1, y - 1, 2, 2); }
  }

  function fxDraw(ctx, list) {
    for (var i = 0; i < list.length; i++) {
      var f = list[i], k = 1 - f.t / f.life, d = Math.round((4 + k * f.r * 0.8) / 2) * 2;
      if (k > 0.8) continue;
      ctx.fillStyle = f.color;
      for (var a = 0; a < 8; a++) { var ang = a * Math.PI / 4; ctx.fillRect(Math.round(f.x + Math.cos(ang) * d) - 2, Math.round(f.y + Math.sin(ang) * d) - 2, 4, 4); }
      if (k < 0.3) { ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(f.x) - 3, Math.round(f.y) - 3, 6, 6); }
    }
  }

  function draw(ctx, S, g, o) {
    o = o || {}; var t = S.time;
    bg(ctx, g);
    if (S.fleet) {
      var F = S.fleet;
      for (var i = 0; i < F.aliens.length; i++) {
        var a = F.aliens[i]; if (!a.alive) continue;
        spr(ctx, SPR[a.type][F.frame], F.x + a.c * L.CW + L.CW / 2, F.y + a.r * L.CH + L.CH / 2, COL[a.type], { o: '#ff5555', d: '#000000' });
      }
    }
    if (S.probe) spr(ctx, SPR.probe[Math.floor(t * 10) % 2], S.probe.x, S.probe.y, COL.probe, { o: Math.floor(t * 6) % 2 ? '#ffff55' : '#ffffff', d: '#550000' });
    if (S.boss && S.boss.alive) boss(ctx, S.boss, t);
    var drawBird = function (b) {
      var hit = b.flash > 0, col = hit ? '#ffffff' : COL.bird;
      if (b.shield && b.state === 'form') spr(ctx, SPR.birdShield[0], b.x, b.y, col, { s: hit ? '#ffffff' : '#5555ff', w: '#a8a8a8', o: '#ff5555' });
      else spr(ctx, SPR.birdOpen[Math.floor(t * (b.state === 'dive' ? 10 : 5) + b.ph) % 2], b.x, b.y, b.hp < b.max ? '#a800a8' : col, { w: '#ffffff', o: '#ffff55' });
    };
    S.birds.forEach(function (b) { if (b.alive && b.state === 'form') drawBird(b); });
    bunkers(ctx, S);
    S.birds.forEach(function (b) { if (b.alive && b.state === 'dive') drawBird(b); });
    if (S.shot) { ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(S.shot.x) - 1, Math.round(S.shot.y) - 6, 2, 10); }
    S.bullets.forEach(function (b) { bullet(ctx, b, t); });
    var Pl = S.player;
    if (!Pl.dead) { if (!(Pl.grace > 0 && Math.floor(t * 12) % 2)) spr(ctx, SPR.player, Pl.x, L.PLAYER_Y - 1 + (Pl.recoil > 0 ? 1 : 0), COL.player, { d: '#a8a8a8' }); }
    else if (S.phase === 'dead') {
      ctx.fillStyle = Math.floor(t * 10) % 2 ? '#fc9838' : '#ff5555';
      for (var k = 0; k < 7; k++) ctx.fillRect(Math.round(Pl.x / 2) * 2 - 16 + k * 5, L.PLAYER_Y + 2 - (k % 3) * 4, 4, 4);
    }
    if (o.fx) fxDraw(ctx, o.fx);
    scan(ctx, g.W, g.H);
    if (o.bare) return;
    Z.ui.hud(g, ctx, S, P, lifeIcon);
    Z.ui.banner(g, ctx, S, P);
    if (o.toasts) Z.ui.toasts(g, ctx, o.toasts, P);
  }

  Z.classic = { P: P, bg: bg, draw: draw, lifeIcon: lifeIcon, SPR: SPR };
})(typeof window !== 'undefined' ? window : globalThis);
