/* ПУЗЫРЬ · рендер RETRO (8-бит). PUZYR.classic = { P, bg, draw, face, item }
   Пиксельные спрайты (пиксель = 2 px), палитра ранних 8-битных машин: кирпичные платформы
   в цвет зоны, шары — пиксельные кольца с бликом, сканлайны. Логику не трогает. */
(function (global) {
  'use strict';
  var Z = global.PUZYR = global.PUZYR || {};
  var L = Z.logic, T = 20, OY = 40, PX = 2;

  var P = {
    pixel: true, font: '"Courier New", ui-monospace, monospace',
    hudBg: '#000000', hudLine: '#5555ff', ink: '#ffffff', muted: '#aaaaaa', dim: '#444444', accent: '#ffff55', good: '#55ff55', bad: '#ff5555',
    letter: '#ffff55', panel: '#000000', line: '#5555ff', bar: '#333333', bossBar: '#ff5555',
    pl: ['#ffaa00', '#55ffff'], plDark: ['#aa5500', '#00aaaa'],
    en: { cog: '#aaaaaa', spring: '#55ff55', soot: '#aa55ff', spark: '#ff5555' },
    sp: { fire: '#ff5555', water: '#5555ff', bolt: '#ffff55', letter: '#ffffff' }
  };
  var ZONE = {
    workshop: ['#aa5500', '#ff9955', '#552200'], kiln: ['#aa0000', '#ff5555', '#550000'], glass: ['#00aaaa', '#55ffff', '#005555'],
    pipes: ['#555555', '#aaaaaa', '#222222'], dome: ['#aa00aa', '#ff55ff', '#550055'], boss: ['#444444', '#aa5555', '#220000']
  };
  // Спрайты: '.' — прозрачно, a — основной цвет, b — тёмный, s — кожа, k — чёрный, w — белый, g — стекло очков, y — латунь/искра, r — красный
  var SPR = {
    hero: ['....aaaa....', '...aaaaaa...', '..bbaaaaa...', '..ssssssss..', '..kkkkgwkk..', '..ssssssss..', '...ssssss.yy', '....aaaa....',
      '..aaaaaaaa..', '.aabbbbbbaa.', '.aabbbbbbaa.', '..abbbbbba..', '..aaaaaaaa..', '...kk..kk...', '...kk..kk...', '..kkk..kkk..'],
    hero2: ['....aaaa....', '...aaaaaa...', '..bbaaaaa...', '..ssssssss..', '..kkkkgwkk..', '..ssssssss..', '...ssssss.yy', '....aaaa....',
      '..aaaaaaaa..', '.aabbbbbbaa.', '.aabbbbbbaa.', '..abbbbbba..', '..aaaaaaaa..', '..kk....kk..', '.kk......kk.', '.kk......kk.'],
    heroBlow: ['....aaaa....', '...aaaaaa...', '..bbaaaaa...', '..ssssssss..', '..kkkkgwkk..', '..ssssssssrw', '...ssssssyyw', '....aaaa....',
      '..aaaaaaaa..', '.aabbbbbbaa.', '.aabbbbbbaa.', '..abbbbbba..', '..aaaaaaaa..', '...kk..kk...', '...kk..kk...', '..kkk..kkk..'],
    cog: ['....a..a....', '..aaaaaaaa..', '.aaaaaaaaaa.', 'aaawwwwaaaaa', '.aawwkkwaaa.', 'aaawwkkwaaaa', '.aaawwwwaaa.', 'aaaaaaaaaaaa',
      '.aaaaaaaaaa.', '..aaaaaaaa..', '....a..a....', '...kk..kk...'],
    cog2: ['...a....a...', '..aaaaaaaa..', 'aaaaaaaaaaa.', '.aawwwwaaaaa', 'aaawwkkwaaa.', '.aawwkkwaaaa', 'aaaawwwwaaa.', '.aaaaaaaaaaa',
      'aaaaaaaaaaa.', '..aaaaaaaa..', '...a....a...', '..kk....kk..'],
    spring: ['...aaaaaa...', '..aaaaaaaa..', '.aawkaawkaa.', '.aawkaawkaa.', '.aaaaaaaaaa.', '..aaaaaaaa..', '....wwww....', '...w....w...',
      '....wwww....', '...w....w...', '....wwww....', '...kkkkkk...'],
    soot: ['...aa..aa...', '..aaaaaaaa..', '.aaaaaaaaaa.', 'aaayyaayyaaa', 'aaayyaayyaaa', 'aaaaaaaaaaaa', '.aaaaaaaaaa.', 'aa.aaaaaa.aa',
      '.a..aaaa..a.', '....a..a....'],
    spark: ['.....yy.....', '....yyyy....', '...yyrryy...', '....yrry....', '..aaaaaaaa..', '.aaaaaaaaaa.', '.aawkaawkaa.', '.aaaaaaaaaa.',
      '.aabbbbbbaa.', '..aaaaaaaa..', '...kk..kk...', '..kkk..kkk..'],
    pot: ['....bbbbbbbbbbbbbb....', '..bbyyyyyyyyyyyyyybb..', '.bbyyrryyyyyyyyrryyybb.', '.bbbbbbbbbbbbbbbbbbbb.', 'b.aaaaaaaaaaaaaaaaaa.b', 'b.aaaaaaaaaaaaaaaaaa.b',
      'bbaayyyaaaaaaaayyyaabb', '.aaykyyaaaaaaaykyyaa..', '.aaayyyaaaaaaaayyyaaa.', '.aaaaaaaaaaaaaaaaaaaa.', '.aaaaaarrrrrrrraaaaaa.', '..aaaaaaaaaaaaaaaaaa..',
      '..aaaaaaaaaaaaaaaaaa..', '...aaaaaaaaaaaaaaaa...', '....aaaaaaaaaaaaaa....', '......aaaaaaaaaa......', '.....kk....kk....kk...', '.....kk....kk....kk...'],
    apple: ['....g...', '...gg...', '.rr.rr..', 'rrrrrrr.', 'rwrrrrr.', 'rrrrrrr.', '.rrrrr..', '..r.r...'],
    pear: ['...b....', '...y....', '..yyy...', '..yyy...', '.yyyyy..', 'yyyyyyy.', 'yyyyyyy.', '.yyyyy..'],
    plum: ['...g....', '..aaa...', '.aaaaa..', 'awaaaaa.', 'aaaaaaa.', 'aaaaaaa.', '.aaaaa..', '..aaa...'],
    nut: ['..wwww..', '.wwwwww.', 'wwwkkwww', 'wwk..kww', 'wwk..kww', 'wwwkkwww', '.wwwwww.', '..wwww..'],
    gem: ['.cccccc.', 'cwcccccc', 'cccccccc', '.cccccc.', '..cccc..', '...cc...', '........', '........'],
    crown: ['y..y..y.', 'yy.yy.yy', 'yyyyyyyy', 'yyryyryy', 'yyyyyyyy', 'yyyyyyyy', '........', '........']
  };
  var ITEMCOL = { apple: { r: '#ff5555', g: '#55ff55', w: '#ffffff' }, pear: { y: '#aaff55', b: '#aa5500' }, plum: { a: '#aa55ff', g: '#55ff55', w: '#ffffff' },
    nut: { w: '#aaaaaa', k: '#000000' }, gem: { c: '#55ffff', w: '#ffffff' }, crown: { y: '#ffff55', r: '#ff5555' } };
  function spr(ctx, name, x, y, pal, s, flip) {
    var rows = SPR[name], ps = PX * (s || 1), w = rows[0].length;
    for (var r = 0; r < rows.length; r++) for (var c = 0; c < w; c++) {
      var ch = rows[r][flip ? w - 1 - c : c]; if (ch === '.') continue;
      ctx.fillStyle = pal[ch] || '#ff00ff'; ctx.fillRect(Math.round(x + c * ps), Math.round(y + r * ps), Math.ceil(ps), Math.ceil(ps));
    }
  }
  function pal(a, b) { return { a: a, b: b || '#555555', s: '#ffaa55', k: '#000000', w: '#ffffff', g: '#55ffff', y: '#ffff55', r: '#ff5555' }; }
  function X(x) { return Math.round(x * T); }
  function Y(y) { return Math.round(OY + y * T); }

  function bg(ctx, g) { ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, g.W, g.H); }

  // ---------- Статичный слой: кирпичи в цвет зоны ----------
  var cache = null, cacheKey = '';
  function staticLayer(S) {
    var key = S.level + ':' + S.zone;
    if (cache && key === cacheKey) return cache;
    var c = document.createElement('canvas'); c.width = L.COLS * T; c.height = L.ROWS * T;
    var x = c.getContext('2d'), zc = ZONE[S.zone] || ZONE.workshop, G = S.grid;
    x.fillStyle = '#000000'; x.fillRect(0, 0, c.width, c.height);
    // звёздная пыль
    var seed = S.level * 31 + 7; for (var i = 0; i < 50; i++) { seed = (seed * 16807) % 2147483647; var sx = seed % c.width; seed = (seed * 16807) % 2147483647; x.fillStyle = i % 3 ? '#222244' : '#333366'; x.fillRect(sx - sx % 2, (seed % c.height) - (seed % 2), 2, 2); }
    for (var r = 0; r < L.ROWS; r++) for (var q = 0; q < L.COLS; q++) {
      if (!G[r * L.COLS + q]) continue;
      var bx = q * T, by = r * T, frame = q < L.WL || q >= L.WR || r === 0 || r === L.ROWS - 1;
      x.fillStyle = frame ? zc[2] : zc[0]; x.fillRect(bx, by, T, T);
      x.fillStyle = '#000000';
      x.fillRect(bx, by + 9, T, 2); x.fillRect(bx, by + T - 2, T, 2);
      x.fillRect(bx + ((r % 2) ? 4 : 14), by, 2, 9); x.fillRect(bx + ((r % 2) ? 14 : 4), by + 11, 2, 7);
      if (!frame && !G[(r - 1) * L.COLS + q]) { x.fillStyle = zc[1]; x.fillRect(bx, by, T, 2); }
    }
    x.fillStyle = '#5555ff';
    for (i = 0; i < 2; i++) { var ax = (L.GAP0 + 1 + i * 2) * T; x.fillRect(ax - 4, c.height - 12, 8, 2); x.fillRect(ax - 2, c.height - 10, 4, 2); x.fillRect(ax - 4, 6, 8, 2); x.fillRect(ax - 2, 8, 4, 2); }
    cache = c; cacheKey = key; return c;
  }

  // ---------- Шар: пиксельное кольцо ----------
  var RING = (function () {
    var out = [], R = 9;
    for (var y = -R; y <= R; y++) for (var x = -R; x <= R; x++) { var d = Math.sqrt(x * x + y * y); if (d <= R + 0.3 && d > R - 1.1) out.push([x, y]); }
    return out;
  })();
  function ring(ctx, cx, cy, col, s) {
    s = s || 1; ctx.fillStyle = col;
    for (var i = 0; i < RING.length; i++) ctx.fillRect(Math.round(cx + RING[i][0] * PX * s - PX / 2), Math.round(cy + RING[i][1] * PX * s - PX / 2), Math.ceil(PX * s), Math.ceil(PX * s));
    ctx.fillStyle = '#ffffff'; ctx.fillRect(cx - 10 * s, cy - 10 * s, 4, 2); ctx.fillRect(cx - 12 * s, cy - 8 * s, 2, 4);
  }
  function bubble(ctx, b, S, g) {
    var cx = X(b.x), cy = Y(b.y), s = b.phase === 'shoot' ? Math.min(1, 0.5 + b.t * 6) : 1, col = '#55ffff';
    if (b.enemy) {
      spr(ctx, b.enemy.type === 'cog' ? 'cog' : b.enemy.type, cx - 12, cy - 11, pal(b.enemy.angry ? '#ff5555' : P.en[b.enemy.type]), 1);
      col = b.trapT < 2.5 ? (Math.floor(b.t * 8) % 2 ? '#ff5555' : '#ffff55') : b.trapT < 4.5 ? '#ffff55' : '#55ffff';
    } else if (b.kind === 'letter') {
      col = '#ffffff'; g.text(g.t('word')[b.letter] || '?', cx, cy + 6, { size: 16, align: 'center', color: P.letter, weight: 900, font: P.font });
    } else if (b.kind !== 'plain') {
      col = P.sp[b.kind];
      ctx.fillStyle = col;
      if (b.kind === 'fire') { ctx.fillRect(cx - 4, cy - 2, 8, 8); ctx.fillRect(cx - 2, cy - 8, 4, 6); ctx.fillStyle = '#ffff55'; ctx.fillRect(cx - 2, cy + 2, 4, 4); }
      else if (b.kind === 'water') { ctx.fillRect(cx - 2, cy - 8, 4, 4); ctx.fillRect(cx - 4, cy - 4, 8, 6); ctx.fillRect(cx - 2, cy + 2, 4, 2); }
      else { ctx.fillRect(cx, cy - 8, 4, 4); ctx.fillRect(cx - 2, cy - 4, 4, 4); ctx.fillRect(cx - 4, cy, 8, 2); ctx.fillRect(cx, cy + 2, 2, 4); ctx.fillRect(cx - 2, cy + 6, 2, 2); }
    } else if (b.life < 2 && Math.floor(b.t * 10) % 2) return;
    ring(ctx, cx, cy, col, s);
  }

  // ---------- Кадр ----------
  function draw(ctx, S, g, o) {
    o = o || {};
    ctx.drawImage(staticLayer(S), 0, OY);
    var t = S.time;
    // потоки: пунктир
    if (S.wind) S.wind.zones.forEach(function (Q) {
      ctx.fillStyle = '#222266';
      for (var k = 0; k < 6; k++) { var ph = (t * 0.4 + k * 0.17) % 1, x = Q.x0 + ((k * 0.61) % 1) * (Q.x1 - Q.x0) + Q.vx * ph * 2, y = Q.y0 + ((k * 0.37 + ph) % 1) * (Q.y1 - Q.y0); ctx.fillRect(X(x) - X(x) % 2, Y(y) - Y(y) % 2, 4, 2); }
    });
    S.items.forEach(function (it) { if (it.t < 2 && Math.floor(it.t * 10) % 2) return; spr(ctx, it.kind, X(it.x) - 8, Y(it.y) - 16, ITEMCOL[it.kind], 1); });
    S.enemies.forEach(function (e) {
      if (e.spawnT > 0 && Math.floor(t * 12) % 2) return;
      var name = e.type === 'cog' && Math.floor(t * 6) % 2 ? 'cog2' : e.type, h = SPR[name].length * PX;
      var col = e.angry ? '#ff5555' : P.en[e.type];
      if (e.charge > 0 && Math.floor(t * 16) % 2) col = '#ffffff';
      spr(ctx, name, X(e.x) - 12, Y(e.y) - h - (e.type === 'soot' ? 6 : 0), pal(col, '#555555'), 1, e.dir < 0);
    });
    if (S.boss && S.boss.alive) {
      var B = S.boss, bw = 22 * 4, bh = 18 * 4;
      if (!(B.spawnT > 0 && Math.floor(t * 12) % 2)) {
        if (B.trapped) {
          spr(ctx, 'pot', X(B.x) - bw / 3, Y(B.y - B.h / 2) - bh / 3, pal('#555555', '#aaaaaa'), 1.33);
          var R0 = B.w * T * 0.62; ctx.fillStyle = Math.floor(t * 6) % 2 ? '#ffff55' : '#55ffff';
          for (var a = 0; a < 64; a++) { var an = a / 64 * Math.PI * 2; ctx.fillRect(Math.round(X(B.x) + Math.cos(an) * R0) - 2, Math.round(Y(B.y - B.h / 2) + Math.sin(an) * R0) - 2, 4, 4); }
        } else spr(ctx, 'pot', X(B.x) - bw / 2, Y(B.y) - bh, pal(B.flash > 0 ? '#ffffff' : '#555555', '#aaaaaa'), 2);
      }
    }
    S.players.forEach(function (p) {
      if (p.out && !p.alive && p.deadT <= 0) return;
      if (!p.alive && Math.floor(t * 10) % 2) return;
      if (p.alive && p.inv > 0 && Math.floor(t * 12) % 2) return;
      var name = p.blowT > 0 ? 'heroBlow' : (p.ground && p.walk && Math.floor(p.walk * 8) % 2) ? 'hero2' : 'hero';
      spr(ctx, name, X(p.x) - 12, Y(p.y) - 32 + (p.alive ? 0 : (1.6 - p.deadT) * 10), pal(P.pl[p.i], P.plDark[p.i]), 1, p.face < 0);
    });
    S.bubbles.forEach(function (b) { bubble(ctx, b, S, g); });
    // эффекты
    S.effects.forEach(function (f) {
      if (f.kind === 'fire') {
        if (!f.landed) { ctx.fillStyle = '#ff5555'; ctx.fillRect(X(f.x) - 4, Y(f.y) - 10, 8, 8); return; }
        for (var c = f.c0; c <= f.c1; c++) { var hh = 8 + (Math.floor(t * 12 + c) % 3) * 4; ctx.fillStyle = '#ff5555'; ctx.fillRect(c * T + 2, Y(f.row) - hh, 16, hh); ctx.fillStyle = '#ffff55'; ctx.fillRect(c * T + 6, Y(f.row) - hh / 2, 8, hh / 2); }
      } else if (f.kind === 'water') {
        ctx.fillStyle = '#5555ff'; [{ x: f.x, y: f.y }].concat(f.trail).forEach(function (q) { ctx.fillRect(X(q.x) - 8, Y(q.y) - 14, 16, 12); });
        ctx.fillStyle = '#55ffff'; ctx.fillRect(X(f.x) - 6, Y(f.y) - 12, 4, 4);
      } else if (f.kind === 'bolt') {
        ctx.fillStyle = Math.floor(t * 20) % 2 ? '#ffffff' : '#ffff55';
        var n = 16; for (var i = 0; i <= n; i++) { var q = i / n; ctx.fillRect(X(f.x0 + (f.x - f.x0) * q) - 2, Y(f.y0 + (f.y - f.y0) * q) - 2 + (i % 2 ? 4 : -4), 6, 4); }
      }
    });
    S.shots.forEach(function (s) { ctx.fillStyle = s.kind === 'drop' ? '#ff5555' : '#ffff55'; ctx.fillRect(X(s.x) - 4, Y(s.y) - 4, 8, 8); ctx.fillStyle = '#ffffff'; ctx.fillRect(X(s.x) - 2, Y(s.y) - 2, 2, 2); });

    // сканлайны
    ctx.fillStyle = 'rgba(0,0,0,.18)'; for (var yy = OY; yy < g.H; yy += 4) ctx.fillRect(0, yy, g.W, 1);
    if (o.bare) return;
    Z.ui.hud(g, ctx, S, R);
    Z.ui.banner(g, ctx, S, R);
    if (o.toasts) Z.ui.toasts(g, ctx, o.toasts, P);
  }
  function face(ctx, x, y, i, s) { spr(ctx, 'hero', x - 12 * s, y - 16 * s, pal(P.pl[i], P.plDark[i]), s); }
  function item(ctx, kind, x, y, s) { spr(ctx, kind, x - 8 * (s || 1), y - 8 * (s || 1), ITEMCOL[kind], s || 1); }

  var R = { P: P, bg: bg, draw: draw, face: face, item: item, spr: spr, pal: pal };
  Z.classic = R;
})(typeof window !== 'undefined' ? window : globalThis);
