/* КЛАДКА · рендер RETRO (8-бит). KLADKA.classic = { P, bg, draw, glyph }
   Тот же мир, что в modern, но пиксельно: ограниченная палитра, блоки с фаской
   2 px и растворными швами, каменные стены из пиксельных глыб, точечные значки бонусов. */
(function (global) {
  'use strict';
  var K = global.KLADKA = global.KLADKA || {};
  var L = K.logic;

  var P = {
    pixel: true, font: '"Courier New", ui-monospace, monospace',
    hudBg: '#000000', hudLine: '#a83c18', ink: '#fcfcfc', muted: '#a49484', accent: '#fc9838',
    good: '#58d854', bad: '#f83800', panel: '#000000', bar: '#3c2414', bossBar: '#f83800',
    life: '#fc9838', lifeOff: '#3c2414', chip: '#000000',
    tones: ['#c84c0c', '#e47c24', '#e8b830', '#40a070', '#3070c8', '#8050c0'],
    two: '#a87838', three: '#6c6c80', iron: '#383840',
    pw: { wide: '#58d854', narrow: '#f83800', triple: '#3cbcfc', glue: '#f8b800', cutter: '#f878f8', chill: '#a4e4fc', life: '#fc7460' }
  };
  var LIGHT = {}, DARK = {};
  function tone(hex, f) {
    var key = hex + f, m = f > 0 ? LIGHT : DARK; if (m[key]) return m[key];
    var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255, t = f < 0 ? 0 : 255, p = Math.abs(f);
    return (m[key] = 'rgb(' + Math.round((t - r) * p + r) + ',' + Math.round((t - g) * p + g) + ',' + Math.round((t - b) * p + b) + ')');
  }

  // ---------- Пиксельные значки бонусов ----------
  var GLYPH = {
    wide:   ['.#...#.', '##...##', '#######', '##...##', '.#...#.'],
    narrow: ['#.....#', '##...##', '.##.##.', '##...##', '#.....#'],
    triple: ['........', '##.##.##', '##.##.##', '........'],
    glue:   ['..#..', '.###.', '#####', '#####', '.###.'],
    cutter: ['..##', '.##.', '####', '.##.', '##..'],
    chill:  ['#.#.#', '.###.', '##.##', '.###.', '#.#.#'],
    life:   ['.##.##.', '#######', '.#####.', '..###..', '...#...']
  };
  function glyph(ctx, k, x, y, s, col) {
    var gl = GLYPH[k], px = s && s < 1 ? 1 : 2, w = gl[0].length * px, h = gl.length * px;
    var x0 = Math.round(x - w / 2), y0 = Math.round(y - h / 2);
    ctx.fillStyle = col || '#fff';
    for (var r = 0; r < gl.length; r++) for (var c = 0; c < gl[r].length; c++) if (gl[r][c] === '#') ctx.fillRect(x0 + c * px, y0 + r * px, px, px);
  }

  // ---------- Фон (кэш) ----------
  var cache = null;
  function buildBg(W, H) {
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var x = c.getContext('2d');
    x.fillStyle = '#0c0606'; x.fillRect(0, 0, W, H);
    // тёмная кладка на фоне
    x.fillStyle = '#1c0e0a';
    for (var yy = 52, row = 0; yy < H; yy += 16, row++) {
      x.fillRect(0, yy, W, 2);
      for (var xx = (row % 2) * 16; xx < W; xx += 32) x.fillRect(xx, yy, 2, 16);
    }
    // стены из глыб
    function stones(x0, w) {
      for (var y = 44, i = 0; y < H; i++) {
        var h = 16 + (i % 3) * 8;
        x.fillStyle = '#7c7c7c'; x.fillRect(x0, y, w, h - 2);
        x.fillStyle = '#bcbcbc'; x.fillRect(x0, y, w, 2); x.fillRect(x0, y, 2, h - 2);
        x.fillStyle = '#4c4c4c'; x.fillRect(x0, y + h - 4, w, 2); x.fillRect(x0 + w - 2, y, 2, h - 2);
        y += h;
      }
    }
    stones(0, L.FX0); stones(L.FX1, W - L.FX1);
    x.fillStyle = '#7c7c7c'; x.fillRect(0, 44, W, L.FY0 - 44);
    x.fillStyle = '#bcbcbc'; x.fillRect(0, 44, W, 2);
    x.fillStyle = '#4c4c4c'; x.fillRect(0, L.FY0 - 2, W, 2);
    for (var bx = 8; bx < W; bx += 24) { x.fillStyle = '#4c4c4c'; x.fillRect(bx, 46, 2, 4); }
    return c;
  }
  function bg(ctx, g) { if (!cache) cache = buildBg(g.W, g.H); ctx.drawImage(cache, 0, 0); }

  function brick(ctx, b) {
    var x = b.x, y = b.y, w = b.w, h = b.h;
    var base = b.iron ? P.iron : b.max === 3 ? P.three : b.max === 2 ? P.two : P.tones[b.tone];
    if (b.gift) base = '#fcd8a8';
    ctx.fillStyle = '#000'; ctx.fillRect(x, y, w, h);                 // раствор
    ctx.fillStyle = base; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    ctx.fillStyle = tone(base, 0.4); ctx.fillRect(x + 1, y + 1, w - 2, 2); ctx.fillRect(x + 1, y + 1, 2, h - 2);
    ctx.fillStyle = tone(base, -0.45); ctx.fillRect(x + 1, y + h - 3, w - 2, 2); ctx.fillRect(x + w - 3, y + 1, 2, h - 2);
    if (b.r % 2 === 0) { ctx.fillStyle = '#000'; ctx.fillRect(x + w / 2 - 1, y + 1, 2, h - 2); }
    if (b.iron) {
      ctx.fillStyle = '#9c9cac'; ctx.fillRect(x + 4, y + 4, 2, 2); ctx.fillRect(x + w - 6, y + 4, 2, 2); ctx.fillRect(x + 4, y + h - 6, 2, 2); ctx.fillRect(x + w - 6, y + h - 6, 2, 2);
      ctx.fillStyle = '#54545c'; for (var k = 8; k < w - 8; k += 4) ctx.fillRect(x + k, y + 6, 2, 4);
    } else if (b.max > 1) {
      ctx.fillStyle = '#fce0a8';
      for (var i = 0; i < b.max; i++) ctx.fillRect(x + w / 2 - 1 + (i - (b.max - 1) / 2) * 6 + (b.r % 2 === 0 ? 0 : 0), y + 7, 2, 2);
      if (b.hp < b.max) { ctx.fillStyle = '#000'; ctx.fillRect(x + 5, y + 4, 2, 2); ctx.fillRect(x + 7, y + 6, 2, 2); ctx.fillRect(x + 7, y + 8, 2, 4); if (b.hp < b.max - 1) { ctx.fillRect(x + w - 8, y + 3, 2, 2); ctx.fillRect(x + w - 10, y + 5, 2, 4); ctx.fillRect(x + w - 8, y + 9, 2, 3); } }
    } else if (b.gift) {
      ctx.fillStyle = '#e45c10'; ctx.fillRect(x + w / 2 - 1, y + 4, 2, 8); ctx.fillRect(x + w / 2 - 3, y + 6, 6, 4);
    }
    if (b.flash > 0) { ctx.fillStyle = '#fcfcfc'; ctx.fillRect(x + 1, y + 1, w - 2, h - 2); }
  }

  function boss(ctx, B, g) {
    if (B.hp <= 0 && ((g.time * 20) | 0) % 2 && B.flash <= 0) return;
    if (B.hp <= 0 && B.flash <= 0) return;
    var x = Math.round(B.x - B.w / 2), y = B.y, w = B.w, h = B.h;
    // ступенчатый «колокол» печи
    var rows = [[0, 0], [2, 12], [4, 24], [6, 36], [10, 46], [18, 54], [32, 58]];
    for (var i = 0; i < rows.length; i++) {
      var ins = rows[i][0], yy = rows[i][1], hh = (i + 1 < rows.length ? rows[i + 1][1] : h) - yy;
      ctx.fillStyle = '#5c2c1c'; ctx.fillRect(x + ins, y + yy, w - ins * 2, hh);
      ctx.fillStyle = '#883c20'; ctx.fillRect(x + ins, y + yy, 2, hh);
      ctx.fillStyle = '#2c140c'; ctx.fillRect(x + w - ins - 2, y + yy, 2, hh);
    }
    ctx.fillStyle = '#a4a4a4'; for (var r = 0; r < 7; r++) ctx.fillRect(x + 10 + r * 14, y + 6, 2, 2);
    // сердце
    var cx = Math.round(B.x), cy = y + 32, hot = B.mouth > 0, ph = ((g.time * (6 + (1 - B.hp / B.max) * 8)) | 0) % 2;
    ctx.fillStyle = '#000'; ctx.fillRect(cx - 14, cy - 12, 28, 24);
    ctx.fillStyle = hot ? '#fce0a8' : ph ? '#f83800' : '#e45c10'; ctx.fillRect(cx - 10, cy - 8, 20, 16);
    ctx.fillStyle = hot ? '#fcfcfc' : '#fca044'; ctx.fillRect(cx - 6, cy - 4, 12, 8);
    ctx.fillStyle = '#2c140c'; ctx.fillRect(cx - 5, cy - 12, 2, 24); ctx.fillRect(cx + 3, cy - 12, 2, 24);
    ctx.fillStyle = hot ? '#f8b800' : '#000'; ctx.fillRect(cx - 12, y + h - 6, 24, 4);
    if (B.flash > 0 && ((g.time * 30) | 0) % 2) { ctx.fillStyle = '#fcfcfc'; ctx.fillRect(cx - 10, cy - 8, 20, 16); }
  }

  function paddle(ctx, S, g) {
    var Pd = S.paddle, w = Math.round(Pd.w / 2) * 2, x = Math.round(Pd.x - w / 2), y = L.PADDLE_Y, h = L.PADDLE_H;
    if (Pd.stun > 0 && ((g.time * 16) | 0) % 2) return;
    ctx.fillStyle = '#7c3c14'; ctx.fillRect(Math.round(Pd.x) - 8, y + h, 16, 8);
    ctx.fillStyle = '#bc7c3c'; ctx.fillRect(Math.round(Pd.x) - 6, y + h, 12, 2);
    ctx.fillStyle = '#000'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#bcbcbc'; ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
    ctx.fillStyle = '#fcfcfc'; ctx.fillRect(x + 2, y + 2, w - 4, 2);
    ctx.fillStyle = '#7c7c7c'; ctx.fillRect(x + 2, y + h - 4, w - 4, 2);
    ctx.fillStyle = Pd.hitT > 0 ? '#fcfcfc' : '#fc9838'; ctx.fillRect(x + 6, y, w - 12, 2);
    if (S.pow.cutter > 0) { ctx.fillStyle = P.pw.cutter; ctx.fillRect(x + 2, y - 4, 6, 4); ctx.fillRect(x + w - 8, y - 4, 6, 4); }
    if (S.pow.glue > 0) { ctx.fillStyle = '#f8b800'; for (var i = 1; i < 5; i++) ctx.fillRect(x + Math.round(w * i / 5) - 2, y - 2, 4, 2); }
  }

  function ball(ctx, b, S) {
    var x = Math.round(b.x), y = Math.round(b.y), chill = S.pow.chill > 0;
    ctx.fillStyle = chill ? '#3cbcfc' : '#e45c10'; ctx.fillRect(x - 3, y - 5, 6, 10); ctx.fillRect(x - 5, y - 3, 10, 6);
    ctx.fillStyle = chill ? '#a4e4fc' : '#fce0a8'; ctx.fillRect(x - 3, y - 3, 6, 6);
    ctx.fillStyle = '#fcfcfc'; ctx.fillRect(x - 3, y - 3, 2, 2);
  }

  function draw(ctx, S, g, extra) {
    extra = extra || {};
    bg(ctx, g);
    for (var i = 0; i < S.bricks.length; i++) if (!S.bricks[i].dead) brick(ctx, S.bricks[i]);
    if (S.boss) boss(ctx, S.boss, g);
    for (var c = 0; c < S.caps.length; c++) {
      var cp = S.caps[c], col = P.pw[cp.kind], x = Math.round(cp.x - L.CAP_W / 2), y = Math.round(cp.y - L.CAP_H / 2);
      ctx.fillStyle = '#000'; ctx.fillRect(x, y, L.CAP_W, L.CAP_H);
      ctx.fillStyle = col; ctx.fillRect(x + 2, y + 1, L.CAP_W - 4, L.CAP_H - 2);
      ctx.fillStyle = tone(col, 0.5); ctx.fillRect(x + 2, y + 1, L.CAP_W - 4, 2);
      glyph(ctx, cp.kind, cp.x, cp.y + 1, 0.5, '#000');
    }
    ctx.fillStyle = '#fcfcfc';
    for (var o = 0; o < S.bolts.length; o++) { ctx.fillRect(Math.round(S.bolts[o].x) - 1, Math.round(S.bolts[o].y) - 6, 2, 12); }
    ctx.fillStyle = P.pw.cutter;
    for (var o2 = 0; o2 < S.bolts.length; o2++) { ctx.fillRect(Math.round(S.bolts[o2].x) - 2, Math.round(S.bolts[o2].y) - 2, 4, 4); }
    for (var s = 0; s < S.sparks.length; s++) {
      var sk = S.sparks[s], sx = Math.round(sk.x), sy = Math.round(sk.y), f = ((g.time * 20) | 0) % 2;
      ctx.fillStyle = f ? '#f8b800' : '#f83800'; ctx.fillRect(sx - 2, sy - 4, 4, 8); ctx.fillRect(sx - 4, sy - 2, 8, 4);
      ctx.fillStyle = '#fcfcfc'; ctx.fillRect(sx - 1, sy - 1, 2, 2);
    }
    if (S.phase !== 'over') paddle(ctx, S, g);
    for (var b = 0; b < S.balls.length; b++) ball(ctx, S.balls[b], S);
    if (extra.bare) return;
    K.ui.hud(g, ctx, S, P);
    K.ui.powers(g, ctx, S, P, glyph);
    if (extra.toasts) K.ui.toasts(g, ctx, extra.toasts, P);
    K.ui.banner(g, ctx, S, P);
    // сканлайны
    ctx.fillStyle = 'rgba(0,0,0,.12)'; for (var yy = 0; yy < g.H; yy += 3) ctx.fillRect(0, yy, g.W, 1);
  }

  K.classic = { P: P, bg: bg, draw: draw, glyph: glyph };
})(typeof window !== 'undefined' ? window : globalThis);
