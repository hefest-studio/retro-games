/* ПУЗЫРЬ · рендер RETRO (8-бит). PUZYR.classic = { P, bg, draw, face }
   Пиксельные спрайты (пиксель = 2 px), палитра ранних 8-битных машин: кирпичные платформы в цвет зоны,
   ванны расплава — мигающие полосы, пузырь на трубке — пиксельное кольцо, хлопок — пиксельные дуги, сканлайны. Логику не трогает. */
(function (global) {
  'use strict';
  var Z = global.PUZYR = global.PUZYR || {};
  var L = Z.logic, T = 20, OY = 40, PX = 2;

  var P = {
    pixel: true, font: '"Courier New", ui-monospace, monospace',
    hudBg: '#000000', hudLine: '#5555ff', ink: '#ffffff', muted: '#aaaaaa', dim: '#444444', accent: '#ffff55', good: '#55ff55', bad: '#ff5555',
    letter: '#ffff55', melt: '#ffaa00', panel: '#000000', line: '#5555ff', bar: '#333333', bossBar: '#ff5555',
    pl: ['#ffaa00', '#55ffff'], plDark: ['#aa5500', '#00aaaa'],
    en: { cog: '#aaaaaa', spring: '#55ff55', soot: '#aa55ff', spark: '#ffaa00' }
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
  };
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
  // ---------- Ванны: полосы расплава ----------
  function vats(ctx, S, t) {
    (S.vats || []).forEach(function (v) {
      var x0 = v.c0 * T, w = (v.c1 - v.c0 + 1) * T, y0 = Y(L.ROWS - 1) + 4;
      ctx.fillStyle = '#aa0000'; ctx.fillRect(x0, y0, w, T - 4);
      ctx.fillStyle = '#ff5555'; ctx.fillRect(x0, y0, w, 6);
      ctx.fillStyle = '#ffff55'; for (var k = 0; k < w; k += 8) if ((Math.floor(t * 6) + k / 8) % 3 === 0) ctx.fillRect(x0 + k, y0, 4, 2);
      ctx.fillStyle = Math.floor(t * 4) % 2 ? '#ffaa00' : '#ff5555';
      var q = Math.floor(t * 8) % 6; ctx.fillRect(x0 + 6 + (q * 5) % (w - 10), y0 - 4 - q, 4, 4);
    });
  }
  function blasts(ctx, S) {
    S.blasts.forEach(function (b) {
      var k = 1 - b.t / 0.32, cx = X(b.x), cy = Y(b.y), R0 = b.range * T * (0.25 + 0.75 * k);
      if (Math.floor(k * 8) % 2 && k > 0.6) return;
      for (var i = 0; i < 3; i++) {
        var r = R0 * (0.5 + i * 0.25); ctx.fillStyle = i === 1 ? '#ffff55' : '#55ffff';
        for (var a = -0.45; a <= 0.45; a += 0.09) { var px = cx + b.face * Math.cos(a) * r, py = cy + Math.sin(a) * r; ctx.fillRect(Math.round(px / 2) * 2 - 2, Math.round(py / 2) * 2 - 2, 4, 4); }
      }
      ctx.fillStyle = '#ffffff'; for (var j = 0; j < 6; j++) { var an = j * 1.05, d = 4 + k * 20; ctx.fillRect(Math.round(cx + Math.cos(an) * d), Math.round(cy + Math.sin(an) * d), 2, 2); }
    });
  }

  // ---------- Кадр ----------
  function draw(ctx, S, g, o) {
    o = o || {};
    ctx.drawImage(staticLayer(S), 0, OY);
    var t = S.time;
    S.enemies.forEach(function (e) {
      if (e.spawnT > 0 && Math.floor(t * 12) % 2) return;
      if (e.y > L.ROWS - 0.9 && Math.floor(t * 16) % 2) return;
      var name = e.type === 'cog' && (e.mode === 'tumble' ? Math.floor(t * 16) % 2 : Math.floor(t * 6) % 2) ? 'cog2' : e.type, h = SPR[name].length * PX;
      var col = e.mode === 'walk' ? P.en[e.type] : (e.mode === 'daze' ? '#ffffff' : P.en[e.type]);
      if (e.charge > 0 && Math.floor(t * 16) % 2) col = '#ffffff';
      var flip = e.mode === 'tumble' ? Math.floor(t * 12) % 2 === 0 : e.dir < 0;
      var dy = e.mode === 'tumble' ? (Math.floor(t * 12) % 2) * 2 : 0;
      spr(ctx, name, X(e.x) - 12, Y(e.y) - h - (e.type === 'soot' && !e.downed ? 6 : 0) - dy, pal(col, '#555555'), 1, flip);
      if (e.mode === 'daze' && e.daze > 0) { ctx.fillStyle = Math.floor(t * 8) % 2 ? '#ffff55' : '#ffffff'; var a = t * 6; ctx.fillRect(X(e.x) + Math.round(Math.cos(a) * 8) - 2, Y(e.y) - h - 8, 4, 4); ctx.fillRect(X(e.x) - Math.round(Math.cos(a) * 8) - 2, Y(e.y) - h - 6, 4, 4); }
    });
    if (S.boss && S.boss.alive) {
      var B = S.boss, bw = 22 * 4, bh = 18 * 4;
      if (!(B.spawnT > 0 && Math.floor(t * 12) % 2) && !(B.dying && Math.floor(t * 10) % 2))
        spr(ctx, 'pot', X(B.x) - bw / 2, Y(B.y) - bh, pal(B.flash > 0 ? '#ffffff' : '#555555', '#aaaaaa'), 2);
    }
    vats(ctx, S, t);
    S.players.forEach(function (p) {
      if (p.out && !p.alive && p.deadT <= 0) return;
      if (!p.alive && Math.floor(t * 10) % 2) return;
      if (p.alive && p.inv > 0 && Math.floor(t * 12) % 2) return;
      var ch = p.charging ? Math.min(1, p.charge / L.CHARGE_MAX) : 0;
      var name = ch > 0 || p.blastT > 0 ? 'heroBlow' : (p.ground && p.walk && Math.floor(p.walk * 8) % 2) ? 'hero2' : 'hero';
      var hx = X(p.x) - 12, hy = Y(p.y) - 32 + (p.alive ? 0 : (1.6 - p.deadT) * 10);
      spr(ctx, name, hx, hy, pal(P.pl[p.i], P.plDark[p.i]), 1, p.face < 0);
      if (ch > 0) { var s = 0.25 + ch * 0.6, br = 9 * PX * s; ring(ctx, X(p.x) + p.face * (14 + br), hy + 12, ch >= 0.99 && Math.floor(t * 12) % 2 ? '#ff5555' : '#55ffff', s); }
    });
    blasts(ctx, S);
    S.shots.forEach(function (s) { ctx.fillStyle = s.back ? '#55ffff' : s.kind === 'drop' ? '#ff5555' : '#ffff55'; ctx.fillRect(X(s.x) - 4, Y(s.y) - 4, 8, 8); ctx.fillStyle = '#ffffff'; ctx.fillRect(X(s.x) - 2, Y(s.y) - 2, 2, 2); });
    // сканлайны
    ctx.fillStyle = 'rgba(0,0,0,.18)'; for (var yy = OY; yy < g.H; yy += 4) ctx.fillRect(0, yy, g.W, 1);
    if (o.bare) return;
    Z.ui.hud(g, ctx, S, R);
    Z.ui.banner(g, ctx, S, R);
    if (o.toasts) Z.ui.toasts(g, ctx, o.toasts, P);
  }
  function face(ctx, x, y, i, s) { spr(ctx, 'hero', x - 12 * s, y - 16 * s, pal(P.pl[i], P.plDark[i]), s); }

  var R = { P: P, bg: bg, draw: draw, face: face, spr: spr, pal: pal, ring: ring };
  Z.classic = R;
})(typeof window !== 'undefined' ? window : globalThis);
