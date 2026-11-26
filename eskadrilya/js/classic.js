/* ЭСКАДРИЛЬЯ · рендер RETRO (8-бит). ESKADRILYA.classic = { P, draw, lifeIcon, hullIcon, puffs }
   16-цветная палитра, суша клетками 8×8 (берег — песочная кайма, на суше — пиксельные рощи),
   свой пиксель-арт: паролёт-биплан, механическая птица, стриж, дирижабль, катер, зенитка; дым — растровые клубы,
   наводка — красный пунктир с перекрестьем; Летучая кузня собрана из прямоугольников. Сканлайны поверх. */
(function (global) {
  'use strict';
  var E = global.ESKADRILYA = global.ESKADRILYA || {};
  var L = E.logic, W = L.W, H = L.H;

  var C16 = { k: '#000000', b: '#0000aa', g: '#00aa00', c: '#00aaaa', r: '#aa0000', m: '#aa00aa', n: '#aa5500', l: '#aaaaaa',
    d: '#555555', B: '#5555ff', G: '#55ff55', C: '#55ffff', R: '#ff5555', M: '#ff55ff', y: '#ffff55', w: '#ffffff' };
  var P = {
    pixel: true, font: '"Courier New", ui-monospace, monospace',
    hudBg: '#000000', hudBg2: '#000000', hudLine: '#fc9838', ink: '#ffffff', muted: '#aaaaaa', accent: '#fc9838',
    good: '#55ff55', warn: '#ffff55', bad: '#ff5555', panel: '#000000', bar: '#555555', bossBar: '#ff5555', smokeBar: '#aaaaaa'
  };
  // Пиксель-арт (нос вверх). Символы — ключи C16 или особые: '#' основной цвет, 'o' корпус, 'x' акцент, '.' пусто
  var SPR = {
    plane: [
      '......w......',
      '.....wow.....',
      '.....xox.....',
      '#############',
      '#y#########y#',
      '.k...ooo...k.',
      '.....oko.....',
      '..#########..',
      '.....ooo.....',
      '......o......',
      '....##o##....'
    ],
    bird: [[
      '#...........#',
      '##....x....##',
      '.##..ooo..##.',
      '..###ooo###..',
      '....#oRo#....',
      '.....ooo.....',
      '......y......'
    ], [
      '......x......',
      '.....ooo.....',
      '#####ooo#####',
      '.###.oRo.###.',
      '.....ooo.....',
      '......y......',
      '.............'
    ]],
    swift: [
      '....R....',
      '...lll...',
      '#..lwl..#',
      '##.lwl.##',
      '.###l###.',
      '..##l##..',
      '....l....'
    ],
    pk: {
      smoke: ['.......', '..##...', '.####..', '######.', '#######', '.#####.', '.......'],
      patch: ['..###..', '..###..', '#######', '#######', '#######', '..###..', '..###..'],
      power: ['##..##.', '##..##.', '##..##.', '##..##.', '##..##.', '##..##.', '##..##.']
    }
  };
  var PKC = { smoke: C16.w, patch: C16.G, power: C16.y };

  function spr(ctx, map, x, y, s, col, opt) {
    opt = opt || {};
    var h = map.length, w = map[0].length, x0 = Math.round(x - w * s / 2), y0 = Math.round(y - h * s / 2);
    for (var r = 0; r < h; r++) {
      var row = map[opt.flipY ? h - 1 - r : r];
      for (var c = 0; c < w; c++) {
        var ch = row.charAt(c); if (ch === '.') continue;
        ctx.fillStyle = ch === '#' ? col : ch === 'o' ? (opt.o || C16.n) : ch === 'x' ? (opt.x || C16.y) : (C16[ch] || col);
        ctx.fillRect(x0 + c * s, y0 + r * s, s, s);
      }
    }
  }

  // ---------- Рельеф: клетки 8×8, привязанные к миру ----------
  var CS = 8;
  function terrain(ctx, S) {
    var T = S.terrain;
    ctx.fillStyle = C16.b; ctx.fillRect(0, 0, W, H);
    var r0 = Math.floor(S.dist / CS) - 1, r1 = Math.ceil((S.dist + H) / CS) + 1, cols = W / CS, rows = r1 - r0 + 1;
    var grid = new Uint8Array(cols * rows);
    for (var r = 0; r < rows; r++) { var wy = (r0 + r) * CS + CS / 2; for (var c = 0; c < cols; c++) grid[r * cols + c] = L.isLand(T, c * CS + CS / 2, wy) ? 1 : 0; }
    function at(r, c) { r = r < 0 ? 0 : r >= rows ? rows - 1 : r; c = c < 0 ? 0 : c >= cols ? cols - 1 : c; return grid[r * cols + c]; }
    for (r = 0; r < rows; r++) {
      var y = Math.round(H - ((r0 + r) * CS + CS - S.dist));
      for (c = 0; c < cols; c++) {
        var x = c * CS;
        if (!grid[r * cols + c]) {
          if ((at(r - 1, c) || at(r + 1, c) || at(r, c - 1) || at(r, c + 1))) { ctx.fillStyle = C16.B; ctx.fillRect(x, y, CS, CS); }   // прибой
          else if (((r0 + r) * 7 + c * 13) % 23 === 0) { ctx.fillStyle = C16.B; ctx.fillRect(x + 2, y + 3, 4, 2); }
          continue;
        }
        var shore = !(at(r - 1, c) && at(r + 1, c) && at(r, c - 1) && at(r, c + 1));
        // суша — рыжая окалина с тёмными шлаковыми камнями, берег — серая галька (своя палитра, не «зелёные берега у синей реки»)
        ctx.fillStyle = shore ? C16.l : C16.n; ctx.fillRect(x, y, CS, CS);
        if (shore && ((r0 + r) * 5 + c * 3) % 3 === 0) { ctx.fillStyle = C16.d; ctx.fillRect(x + 2, y + 4, 2, 2); }
        if (!shore && ((r0 + r) * 11 + c * 7) % 9 === 0) { ctx.fillStyle = C16.d; ctx.fillRect(x + 1, y + 2, 5, 4); ctx.fillStyle = C16.k; ctx.fillRect(x + 2, y + 5, 4, 1); }
        else if (!shore && ((r0 + r) * 3 + c * 17) % 29 === 0) { ctx.fillStyle = C16.R; ctx.fillRect(x + 3, y + 3, 2, 2); }
      }
    }
  }

  function ground(ctx, S, t) {
    S.ground.forEach(function (g) {
      var x = Math.round(g.x / 2) * 2, y = Math.round(H - (g.wy - S.dist)), hit = g.flash > 0;
      if (!g.alive) { ctx.fillStyle = C16.k; ctx.fillRect(x - 10, y - 6, 20, 12); ctx.fillStyle = Math.floor(t * 8 + x) % 2 ? C16.R : C16.y; ctx.fillRect(x - 2, y - 2, 4, 4); return; }
      if (g.type === 'flak') {
        ctx.fillStyle = C16.k; ctx.fillRect(x - 13, y - 13, 26, 26); ctx.fillStyle = C16.y; ctx.fillRect(x - 11, y - 11, 22, 22);   // жёлтый бруствер на рыжей суше
        ctx.fillStyle = hit ? C16.w : C16.d; ctx.fillRect(x - 7, y - 7, 14, 14);
        var a = Math.atan2(S.player.y - y, S.player.x - x);
        ctx.fillStyle = hit ? C16.w : C16.l;
        for (var k = 4; k <= 14; k += 2) ctx.fillRect(Math.round(x + Math.cos(a) * k) - 2, Math.round(y + Math.sin(a) * k) - 2, 4, 4);
        ctx.fillStyle = C16.R; ctx.fillRect(x - 2, y - 2, 4, 4);
      } else if (g.type === 'depot') {
        ctx.fillStyle = hit ? C16.w : C16.c; ctx.fillRect(x - 14, y - 7, 12, 14); ctx.fillRect(x + 2, y - 7, 12, 14);
        ctx.fillStyle = C16.C; ctx.fillRect(x - 12, y - 5, 4, 4); ctx.fillRect(x + 4, y - 5, 4, 4);
        ctx.fillStyle = C16.y; ctx.fillRect(x - 2, y - 2, 4, 4);
      } else {
        var dir = g.vx >= 0 ? 1 : -1;
        ctx.fillStyle = C16.w; for (var q = 0; q < 3; q++) ctx.fillRect(x - dir * (24 + q * 8) - 2, y - 6 - q * 2 + (Math.floor(t * 6) % 2) * 2, 4, 2), ctx.fillRect(x - dir * (24 + q * 8) - 2, y + 4 + q * 2, 4, 2);
        ctx.fillStyle = hit ? C16.w : C16.n; ctx.fillRect(x - 20, y - 8, 36, 16); ctx.fillRect(dir > 0 ? x + 16 : x - 24, y - 4, 8, 8);
        ctx.fillStyle = C16.l; ctx.fillRect(x - 12, y - 4, 16, 8);
        ctx.fillStyle = C16.k; ctx.fillRect(x - dir * 4 - 3, y - 3, 6, 6);
      }
    });
  }

  // Летучая кузня: корпус ступенями по 4 px, медные пояса, горн, гондолы, винты на выносах
  function forge(ctx, B, t) {
    var x = Math.round(B.x / 2) * 2, y = Math.round(B.y), rx = L.HULL_RX, ry = L.HULL_RY, i;
    if (B.falling && Math.floor(B.fallT * 10) % 2) return;
    B.fans.forEach(function (f) {
      var fx = x + f.dx, fy = y + f.dy;
      ctx.fillStyle = C16.d; ctx.fillRect(Math.min(fx, x + Math.sign(f.dx) * 100), fy - 3, Math.abs(fx - x - Math.sign(f.dx) * 100), 6);
      if (B.anchored && !B.falling) { ctx.fillStyle = C16.l; var ph = Math.floor(t * 8) % 4; for (var q = 0; q < 8; q++) { var a = q * Math.PI / 4 + ph * 0.3, r = L.FAN_R * (0.4 + 0.15 * ((q + ph) % 4)); ctx.fillRect(Math.round(fx + Math.cos(a) * r) - 1, Math.round(fy + Math.sin(a) * r) - 1, 2, 2); } }
      ctx.fillStyle = C16.k; ctx.fillRect(fx - 22, fy - 22, 44, 44);
      ctx.fillStyle = C16.n; ctx.fillRect(fx - 22, fy - 22, 44, 4); ctx.fillRect(fx - 22, fy + 18, 44, 4); ctx.fillRect(fx - 22, fy - 22, 4, 44); ctx.fillRect(fx + 18, fy - 22, 4, 44);
      ctx.fillStyle = C16.l; var sp = Math.floor(f.spin * 2) % 2;
      if (sp) { ctx.fillRect(fx - 16, fy - 2, 32, 4); ctx.fillRect(fx - 2, fy - 16, 4, 32); } else for (var k = -14; k <= 14; k += 2) { ctx.fillRect(fx + k - 1, fy + k - 1, 3, 3); ctx.fillRect(fx + k - 1, fy - k - 1, 3, 3); }
      ctx.fillStyle = C16.R; ctx.fillRect(fx - 3, fy - 3, 6, 6);
    });
    for (var yy = -ry; yy < ry; yy += 4) {
      var w = Math.round(rx * Math.sqrt(Math.max(0, 1 - Math.pow((yy + 2) / ry, 2))) / 4) * 4;
      ctx.fillStyle = yy < -ry / 2 ? C16.l : C16.d; ctx.fillRect(x - w, y + yy, w * 2, 4);
    }
    ctx.fillStyle = C16.n; ctx.fillRect(x - rx + 8, y - 6, rx * 2 - 16, 4); ctx.fillRect(x - rx + 12, y + 22, rx * 2 - 24, 4);
    ctx.fillStyle = C16.k; for (i = -120; i <= 120; i += 24) ctx.fillRect(x + i, y - 30, 2, 60);
    var c = B.core;
    ctx.fillStyle = C16.k; ctx.fillRect(x - 22, y - 26, 44, 44);
    if (c.open) { ctx.fillStyle = c.flash > 0 ? C16.w : Math.floor(t * 8) % 2 ? C16.y : C16.R; ctx.fillRect(x - 16, y - 20, 32, 32); ctx.fillStyle = C16.w; ctx.fillRect(x - 6, y - 10, 12, 12); }
    else { ctx.fillStyle = C16.l; ctx.fillRect(x - 16, y - 20, 14, 14); ctx.fillRect(x + 2, y - 20, 14, 14); ctx.fillRect(x - 16, y - 2, 14, 14); ctx.fillRect(x + 2, y - 2, 14, 14); }
    B.pods.forEach(function (pd) {
      var tx = x + pd.dx, ty = y + pd.dy, r = pd.kind === 'twin' ? 12 : 10;
      if (!pd.alive) { ctx.fillStyle = C16.k; ctx.fillRect(tx - r, ty - r, r * 2, r * 2); ctx.fillStyle = Math.floor(t * 8 + tx) % 2 ? C16.R : C16.n; ctx.fillRect(tx - 3, ty - 3, 6, 6); return; }
      if (!B.anchored) { ctx.fillStyle = C16.l; ctx.fillRect(tx - r, ty - r, r * 2, r * 2); ctx.fillStyle = C16.d; ctx.fillRect(tx - r + 4, ty - r + 4, r * 2 - 8, r * 2 - 8); return; }
      var hot = pd.flash > 0;
      ctx.fillStyle = hot ? C16.w : C16.k;
      for (var k2 = 6; k2 <= r + 10; k2 += 2) ctx.fillRect(Math.round(tx + Math.cos(pd.ang) * k2) - 2, Math.round(ty + Math.sin(pd.ang) * k2) - 2, 4, 4);
      ctx.fillStyle = hot ? C16.w : (pd.hp / pd.max > 0.5 ? C16.R : C16.r); ctx.fillRect(tx - r, ty - r, r * 2, r * 2);
      ctx.fillStyle = pd.sootT > 0 ? C16.d : C16.y; ctx.fillRect(tx - 3, ty - 3, 6, 6);
    });
  }
  // дым: клубы из «пикселей» 4×4 с шахматным растром по краю
  function puffs(ctx, S) {
    for (var i = 0; i < S.puffs.length; i++) {
      var p = S.puffs[i], r = L.puffR(p); if (r < 3) continue;
      var cx = Math.round(p.x / 4) * 4, cy = Math.round((H - (p.wy - S.dist)) / 4) * 4, rq = Math.round(r / 4);
      for (var gy = -rq; gy <= rq; gy++) for (var gx = -rq; gx <= rq; gx++) {
        var d = gx * gx + gy * gy; if (d > rq * rq) continue;
        var edge = d > (rq - 1) * (rq - 1);
        if (edge && (gx + gy + i) & 1) continue;
        ctx.fillStyle = edge ? C16.l : C16.w; ctx.fillRect(cx + gx * 4, cy + gy * 4, 4, 4);
      }
    }
  }
  function aims(ctx, S, t) {
    var Pl = S.player; if (Pl.dead || !S.aims.length) return;
    var px = Math.round(Pl.x), py = Math.round(Pl.y);
    S.aims.forEach(function (a) {
      var dx = px - a.x, dy = py - a.y, len = Math.hypot(dx, dy), n = Math.floor(len / 8), off = Math.floor(t * 12) % 2;
      ctx.fillStyle = a.k > 0.7 && Math.floor(t * 16) % 2 ? C16.w : C16.R;
      for (var k = off; k < n; k += 2) ctx.fillRect(Math.round(a.x + dx * k / n) - 1, Math.round(a.y + dy * k / n) - 1, 3, 3);
      ctx.fillRect(Math.round(a.x) - 8, Math.round(a.y) - 8, 16, 2); ctx.fillRect(Math.round(a.x) - 8, Math.round(a.y) + 6, 16, 2);
    });
    ctx.fillStyle = C16.R; var q = 14;
    ctx.fillRect(px - q, py - 1, 6, 2); ctx.fillRect(px + q - 6, py - 1, 6, 2); ctx.fillRect(px - 1, py - q, 2, 6); ctx.fillRect(px - 1, py + q - 6, 2, 6);
  }
  function soot(ctx, x, y, t) {
    ctx.fillStyle = C16.d; var ph = Math.floor(t * 6) % 2;
    ctx.fillRect(Math.round(x) - 10 + ph * 4, Math.round(y) - 6, 8, 8); ctx.fillRect(Math.round(x) + 2 - ph * 4, Math.round(y) - 2, 8, 8);
    ctx.fillStyle = C16.w; ctx.fillRect(Math.round(x) - 2, Math.round(y) - 22, 4, 2); ctx.fillRect(Math.round(x) + 2, Math.round(y) - 20, 2, 4); ctx.fillRect(Math.round(x) - 1, Math.round(y) - 16, 2, 2); ctx.fillRect(Math.round(x) - 1, Math.round(y) - 12, 2, 2);
  }

  function blimp(ctx, e) {
    var x = Math.round(e.x / 2) * 2, y = Math.round(e.y / 2) * 2, hit = e.flash > 0, rx = L.BLIMP.rx, ry = L.BLIMP.ry;
    for (var yy = -ry; yy < ry; yy += 4) {
      var w = Math.round(rx * Math.sqrt(1 - Math.pow((yy + 2) / ry, 2)) / 4) * 4;
      ctx.fillStyle = hit ? C16.w : yy < -ry / 2 ? C16.R : C16.n; ctx.fillRect(x - w, y + yy, w * 2, 4);
    }
    ctx.fillStyle = C16.k; for (var k = -24; k <= 24; k += 12) ctx.fillRect(x + k, y - ry + 4, 2, ry * 2 - 8);
    ctx.fillStyle = C16.g; ctx.fillRect(x - 20, y - 6, 10, 6); ctx.fillRect(x + 12, y + 2, 8, 6);
    ctx.fillStyle = C16.n; ctx.fillRect(x - rx - 8, y - 12, 10, 6); ctx.fillRect(x - rx - 8, y + 6, 10, 6);
    ctx.fillStyle = C16.d; ctx.fillRect(x - 12, y + ry - 2, 24, 8); ctx.fillStyle = C16.y; ctx.fillRect(x - 8, y + ry, 4, 2); ctx.fillRect(x + 4, y + ry, 4, 2);
    var f = e.hp / e.max; ctx.fillStyle = C16.d; ctx.fillRect(x - 20, y - ry - 8, 40, 4); ctx.fillStyle = C16.y; ctx.fillRect(x - 20, y - ry - 8, Math.round(40 * f / 4) * 4, 4);
  }

  function planeSpr(ctx, x, y, s, col, body) { spr(ctx, SPR.plane, x, y, s, col, { o: body, x: C16.y }); }
  function players(ctx, S, t) {
    var Pl = S.player; if (Pl.dead) return;
    if (Pl.grace > 0 && Math.floor(t * 14) % 2) return;
    ctx.fillStyle = C16.k; ctx.fillRect(Math.round(Pl.x / 2) * 2 + 12, Math.round(Pl.y / 2) * 2 + 20, 26, 6);
    planeSpr(ctx, Pl.x, Pl.y, 3, '#fc9838', C16.n);
    if (Pl.smoking) { ctx.fillStyle = C16.w; var ph = Math.floor(t * 12) % 3; ctx.fillRect(Math.round(Pl.x) - 3, Math.round(Pl.y) - 24 - ph * 4, 6, 6); }
  }

  function draw(ctx, S, g, o) {
    o = o || {}; var t = S.time, fr = Math.floor(t * 8) % 2;
    terrain(ctx, S);
    ground(ctx, S, t);
    S.ground.forEach(function (gq) { if (gq.alive && gq.sootT > 0) soot(ctx, gq.x, H - (gq.wy - S.dist), t); });
    S.pickups.forEach(function (q) {
      var x = Math.round(q.x / 2) * 2, y = Math.round(q.y / 2) * 2, col = PKC[q.kind];
      ctx.fillStyle = Math.floor(t * 5) % 2 ? col : C16.w; ctx.fillRect(x - 12, y - 12, 24, 24);
      ctx.fillStyle = C16.k; ctx.fillRect(x - 9, y - 9, 18, 18);
      spr(ctx, SPR.pk[q.kind], x, y, 2, col);
    });
    if (S.boss && S.boss.alive) forge(ctx, S.boss, t);
    S.air.forEach(function (e) {
      if (!e.alive) return;
      var hit = e.flash > 0;
      if (e.type === 'blimp') blimp(ctx, e);
      else if (e.type === 'bird') spr(ctx, SPR.bird[Math.floor(t * 8 + e.x * 0.02) % 2], e.x, e.y, 2, hit ? C16.w : C16.n, { o: hit ? C16.w : C16.y, x: C16.k, flipY: true });
      else spr(ctx, SPR.swift, e.x, e.y, 2, hit ? C16.w : C16.l, { flipY: e.vy > 0 });
      if (e.sootT > 0) soot(ctx, e.x, e.y, t);
    });
    if (S.boss && S.boss.alive && !S.boss.falling) S.boss.pods.forEach(function (pd) { if (pd.alive && pd.sootT > 0) soot(ctx, S.boss.x + pd.dx, S.boss.y + pd.dy, t); });
    S.shots.forEach(function (s) { ctx.fillStyle = C16.y; ctx.fillRect(Math.round(s.x) - 1, Math.round(s.y) - 5, 3, 10); });
    puffs(ctx, S);
    players(ctx, S, t);   // паролёт — поверх своего дыма (иначе свой же клуб, уплывая назад, прячет самолёт)
    aims(ctx, S, t);
    S.bullets.forEach(function (b) {
      var x = Math.round(b.x), y = Math.round(b.y);
      if (b.kind === 'flak') { ctx.fillStyle = fr ? C16.y : C16.w; ctx.fillRect(x - 4, y - 4, 8, 8); ctx.fillStyle = C16.n; ctx.fillRect(x - 1, y - 1, 2, 2); }
      else if (b.kind === 'shell') { ctx.fillStyle = C16.R; ctx.fillRect(x - 5, y - 5, 10, 10); ctx.fillStyle = C16.w; ctx.fillRect(x - 2, y - 2, 4, 4); }
      else { ctx.fillStyle = C16.R; ctx.fillRect(x - 3, y - 3, 6, 6); ctx.fillStyle = C16.y; ctx.fillRect(x - 1, y - 1, 2, 2); }
    });
    if (o.fx) o.fx.forEach(function (f) {
      var k = 1 - f.t / f.life, d = Math.round((4 + k * f.r * 0.8) / 2) * 2; if (k > 0.8) return;
      ctx.fillStyle = f.color;
      for (var a = 0; a < 8; a++) { var ang = a * Math.PI / 4; ctx.fillRect(Math.round(f.x + Math.cos(ang) * d) - 2, Math.round(f.y + Math.sin(ang) * d) - 2, 4, 4); }
    });
    ctx.fillStyle = 'rgba(0,0,0,.18)'; for (var y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 2);   // сканлайны
    if (o.bare) return;
    E.ui.hud(g, ctx, S, P, E.classic);
    E.ui.banner(g, ctx, S, P);
    if (o.toasts) E.ui.toasts(g, ctx, o.toasts, P);
  }

  function lifeIcon(ctx, x, y, on) { planeSpr(ctx, x, y, 1.5, on ? '#fc9838' : C16.d, on ? C16.n : C16.d); }
  function hullIcon(ctx, x, y, on) { ctx.fillStyle = on ? C16.y : C16.d; ctx.fillRect(x - 6, y - 6, 12, 12); if (on) { ctx.fillStyle = C16.n; ctx.fillRect(x - 4, y - 4, 2, 2); ctx.fillRect(x + 2, y - 4, 2, 2); ctx.fillRect(x - 4, y + 2, 2, 2); ctx.fillRect(x + 2, y + 2, 2, 2); } }

  E.classic = { P: P, draw: draw, lifeIcon: lifeIcon, hullIcon: hullIcon, SPR: SPR, spr: spr, puffs: puffs };
})(typeof window !== 'undefined' ? window : globalThis);
