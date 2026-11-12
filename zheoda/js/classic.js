/* ЖЕОДА · тема retro: собственная 16-цветная палитра в духе ранних ПК-адаптеров, крупный пиксель,
   спрайты из строк-карт (цифра = индекс палитры), без сглаживания. ZHEODA.classic — тот же набор
   функций рисования, что у modern. */
(function (global) {
  'use strict';
  var Z = global.ZHEODA = global.ZHEODA || {};
  var T = 32;
  // Своя палитра из 16 цветов (не стандартная): 0 чёрный … f белый
  var E = ['#000000', '#141850', '#1e7a3c', '#1a8a8e', '#8c1c1c', '#742a8a', '#c8783c', '#a6a2b4',
           '#504a62', '#4a62ea', '#52d878', '#56e2ee', '#f2584a', '#e46ef0', '#f4dc4c', '#f8f6ee'];
  var P = {
    pixel: true, font: '"Courier New", ui-monospace, monospace', E: E,
    bg: E[0], ink: E[15], muted: E[7], accent: E[14], good: E[10], bad: E[12],
    panel: E[0], line: E[9], hudBg: E[1], hudLine: E[9], bar: E[8], bossBar: E[13],
    keys: { R: E[12], B: E[9], Y: E[14] }
  };
  function px(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); }
  function solidAt(S, cx, cy) { if (cx < 0 || cy < 0 || cx >= S.cols || cy >= S.rows) return true; var c = S.grid[cy * S.cols + cx]; return c === '#' || c === '%' || c === '+'; }

  // ---------- Спрайты: строки → кэш-канвы (с отражениями) ----------
  var cache = {};
  function sprite(name, rows, s, fx, fy) {
    var key = name + s + (fx ? 'x' : '') + (fy ? 'y' : '');
    if (cache[key]) return cache[key];
    var h = rows.length, w = rows[0].length, c = document.createElement('canvas');
    c.width = w * s; c.height = h * s; var x = c.getContext('2d');
    for (var r = 0; r < h; r++) for (var q = 0; q < w; q++) {
      var ch = rows[r][q]; if (ch === '.') continue;
      x.fillStyle = E[parseInt(ch, 16)];
      x.fillRect((fx ? w - 1 - q : q) * s, (fy ? h - 1 - r : r) * s, s, s);
    }
    cache[key] = c; return c;
  }
  function blit(ctx, name, rows, s, x, y, fx, fy) { var c = sprite(name, rows, s, fx, fy); ctx.drawImage(c, Math.round(x), Math.round(y)); return c; }

  var HERO = [
    '...ccce.', '..ccccce', '.ccccccc', '.4.666..', '.4.6606.', '.4.666..', '..3333..',
    '.333eee8', '.3cc33..', '..3333..', '..1111..', '..1..1..', '..1..1..', '.88..88.', '........'];
  var HERO_RUN = [
    '...ccce.', '..ccccce', '.ccccccc', '.4.666..', '.4.6606.', '.4.666..', '..3333..',
    '.333eee8', '.3cc33..', '..3333..', '..1111..', '.1....1.', '1......1', '8......8', '........'];
  var HERO_AIR = [
    '...ccce.', '..ccccce', '.ccccccc', '.4.666..', '.4.6606.', '.4.666..', '..3333..',
    '.333eee8', '.3cc33..', '..3333..', '..1111..', '.11..1..', '.8...1..', '.....88.', '........'];
  var CRAWL = ['..d.d....', '.5d5d55..', '555555556', '5555555e5', '.8.8.8.8.', '8.8.8.8..'];
  var CRAWL2 = ['..d.d....', '.5d5d55..', '555555556', '5555555e5', '8.8.8.8..', '.8.8.8.8.'];
  var FLY = ['b......b', 'bb.ff.bb', '.bbffbb.', '..bffb..', '.bb..bb.', 'b......b'];
  var FLY2 = ['........', '.b.ff.b.', 'bbbffbbb', 'bbbffbbb', '........', '........'];
  var HOP = ['..b.b...', '.b8b8b..', '88888888', '888888f0', '8888888f', '88888888', '.8888888', '.88..88.'];
  var SPIT = ['...22...', '..2222..', '.22222a.', '.2222200', '.22222a.', '2222222.', '2222222.', '88888888'];
  var CRYS = ['...d...', '..ddb..', '.ddfbb.', '.ddfbb.', '.dddbb.', '..ddb..', '...d...'];
  var GEM = ['..cc..', '.cffc.', 'cccccc', '.cccc.', '..cc..'];
  var HEART = ['.ffff.', 'ffccff', 'fccccf', 'ffccff', '.ffff.'];
  var CRATE = ['666666', '6e6666', '66e666', '666e66', '6666e6', '666666'];
  var DYN = ['.....e', '....7.', 'c.c.c.', 'cccccc', '000000', 'cccccc', 'c.c.c.'];
  var KEY = ['.XX.....', 'X..X....', 'X..XXXXX', '.XX..X.X'];
  function keySprite(c) { return KEY.map(function (r) { return r.replace(/X/g, c); }); }
  var LAMP = ['ccc', 'cce'];

  // ---------- Фон ----------
  function bg(ctx, g, S, cam) {
    var W = g.W, H = g.H, OY = Z.ui.OY;
    px(ctx, 0, OY, W, H - OY, E[0]);
    var ox = cam ? cam.x * 0.25 : 0, oy = cam ? cam.y * 0.25 : 0;
    for (var i = 0; i < 70; i++) {
      var x = ((i * 137 - ox) % W + W) % W, y = OY + ((i * 59 - oy) % (H - OY) + (H - OY)) % (H - OY);
      px(ctx, Math.floor(x / 4) * 4, Math.floor(y / 4) * 4, 2, 2, i % 5 ? E[1] : E[5]);
    }
  }
  // ---------- Клетки ----------
  function rock(ctx, x, y, S, cx, cy, crack) {
    px(ctx, x, y, T, T, E[8]);
    for (var i = 0; i < 6; i++) { var h = ((cx * 7 + cy * 13 + i * 5) % 7); px(ctx, x + 4 + h * 4, y + 4 + i * 4, 2, 2, (i + cx) % 3 ? E[1] : E[7]); }
    if (!solidAt(S, cx, cy - 1)) { px(ctx, x, y, T, 4, E[7]); px(ctx, x, y + 4, T, 2, E[15]); px(ctx, x, y + 4, T, 2, E[7]); }
    if (!solidAt(S, cx, cy + 1)) px(ctx, x, y + T - 4, T, 4, E[1]);
    if (!solidAt(S, cx - 1, cy)) px(ctx, x, y, 2, T, E[7]);
    if (!solidAt(S, cx + 1, cy)) px(ctx, x + T - 2, y, 2, T, E[1]);
    if (crack) { var pts = [[6, 2], [10, 6], [12, 10], [10, 14], [14, 18], [18, 22], [16, 26], [20, 30], [16, 10], [22, 8], [26, 12]]; pts.forEach(function (p) { px(ctx, x + p[0], y + p[1], 3, 3, E[0]); }); px(ctx, x + 11, y + 11, 2, 2, E[12]); }
  }
  function fakeOpen(S, cx, cy) { var k = cy * S.cols + cx; for (var i = 0; i < S.secrets.length; i++) if (S.secrets[i].found && S.secrets[i].cells.indexOf(k) >= 0) return true; return false; }
  function tile(ctx, ch, x, y, S, cx, cy) {
    var t = S.time, i;
    switch (ch) {
      case '#': rock(ctx, x, y, S, cx, cy, false); break;
      case '%': rock(ctx, x, y, S, cx, cy, true); break;
      case '+': if (fakeOpen(S, cx, cy)) { for (i = 0; i < 8; i++) { px(ctx, x + i * 4, y, 2, 2, E[14]); px(ctx, x + i * 4, y + T - 2, 2, 2, E[14]); } } else rock(ctx, x, y, S, cx, cy, false); break;
      case '-': px(ctx, x, y, T, 8, E[6]); px(ctx, x, y, T, 2, E[14]); px(ctx, x + 4, y + 8, 4, 4, E[8]); px(ctx, x + T - 8, y + 8, 4, 4, E[8]); break;
      case '|': if (!S.chan) { for (i = 0; i < 4; i++) { px(ctx, x + 2 + i * 8, y, 4, T, E[7]); px(ctx, x + 2 + i * 8, y, 2, T, E[15]); } px(ctx, x, y + 4, T, 4, E[8]); px(ctx, x, y + T - 8, T, 4, E[8]); } else { px(ctx, x, y, 2, 2, E[8]); px(ctx, x + T - 2, y, 2, 2, E[8]); } break;
      case ':': if (S.chan) { px(ctx, x, y, T, T, E[3]); px(ctx, x, y, T, 4, E[11]); px(ctx, x, y + T - 4, T, 4, E[11]); if (Math.floor(t * 6 + cx) % 2) px(ctx, x + 8, y + 12, 16, 8, E[11]); } else { for (i = 0; i < 8; i += 2) { px(ctx, x + i * 4, y, 2, 2, E[3]); px(ctx, x + i * 4, y + T - 2, 2, 2, E[3]); } } break;
      case 'R': case 'B': case 'Y':
        px(ctx, x + 2, y, T - 4, T, P.keys[ch]); px(ctx, x + 6, y + 4, 4, T - 8, E[0]); px(ctx, x + T - 10, y + 4, 4, T - 8, E[0]);
        px(ctx, x + 13, y + 10, 6, 6, E[0]); px(ctx, x + 15, y + 16, 2, 6, E[0]); break;
      case '^':
        var down = solidAt(S, cx, cy - 1) && !solidAt(S, cx, cy + 1);
        for (var k = 0; k < 4; k++) for (var s = 0; s < 4; s++) {
          var w = 8 - s * 2, bx = x + k * 8 + s;
          px(ctx, bx, down ? y + s * 4 : y + T - (s + 1) * 4, w, 4, s === 3 ? E[15] : E[7]);
        }
        break;
      case '~':
        var surf = !(cy > 0 && S.grid[(cy - 1) * S.cols + cx] === '~');
        px(ctx, x, y + (surf ? 8 : 0), T, T - (surf ? 8 : 0), E[2]);
        if (surf) { for (i = 0; i < 8; i++) px(ctx, x + i * 4, y + 8 + ((Math.floor(t * 6) + i + cx) % 2) * 2, 4, 2, E[10]); }
        if ((Math.floor(t * 3) + cx) % 4 === 0) px(ctx, x + 12, y + 20, 4, 4, E[10]);
        break;
    }
  }
  // ---------- Объекты ----------
  function item(ctx, k, x, y, t, it, sc) {
    var b = it ? (Math.floor(t * 4 + x * 0.1) % 2) * 2 : 0;
    var s = sc && sc < 1 ? 2 : 3;
    switch (k) {
      case '*': blit(ctx, 'crys' + s, CRYS, s, x - 3.5 * s, y - 3.5 * s - b); if (it && Math.floor(t * 5 + x) % 6 === 0) px(ctx, x + 6, y - 10, 2, 2, E[15]); break;
      case '$': blit(ctx, 'gem', GEM, 3, x - 9, y - 7 - b); break;
      case 'h': blit(ctx, 'heart', HEART, 3, x - 9, y - 7 - b); break;
      case 'a': blit(ctx, 'crate', CRATE, 3, x - 9, y - 9); break;
      case 'd': blit(ctx, 'dyn', DYN, 3, x - 9, y - 11); break;
      case 'r': case 'b': case 'y': var c = { r: 'c', b: '9', y: 'e' }[k]; blit(ctx, 'key' + k, keySprite(c), 3, x - 12, y - 6 - b); break;
    }
  }
  function exit(ctx, x, y, open, t) {
    var top = y - T + 4;
    px(ctx, x + 2, top, T - 4, T * 2 - 4, open ? E[14] : E[8]);
    px(ctx, x + 6, top + 4, T - 12, T * 2 - 12, open ? (Math.floor(t * 6) % 2 ? E[15] : E[14]) : E[0]);
    if (!open) { for (var i = 0; i < 3; i++) px(ctx, x + 8, top + 16 + i * 12, T - 16, 3, E[8]); px(ctx, x + 14, top + 6, 4, 4, E[13]); }
  }
  function lever(ctx, x, y, on, t) {
    px(ctx, x + 8, y + T - 8, 16, 8, E[8]);
    var dx = on ? 1 : -1;
    for (var i = 0; i < 5; i++) px(ctx, x + 15 + dx * i * 2, y + T - 10 - i * 4, 3, 4, E[7]);
    px(ctx, x + 13 + dx * 10, y + T - 32, 7, 7, on ? E[10] : E[12]);
  }
  function orb(ctx, x, y, gs, t) {
    var f = Math.floor(t * 6) % 2, d = gs > 0 ? -1 : 1, o = (Math.floor(t * 4) % 2) * 2;
    // кольцо сферы
    px(ctx, x - 6, y - 12, 12, 3, E[11]); px(ctx, x - 6, y + 9, 12, 3, E[11]); px(ctx, x - 12, y - 6, 3, 12, E[11]); px(ctx, x + 9, y - 6, 3, 12, E[11]);
    px(ctx, x - 9, y - 9, 3, 3, E[3]); px(ctx, x + 6, y - 9, 3, 3, E[3]); px(ctx, x - 9, y + 6, 3, 3, E[3]); px(ctx, x + 6, y + 6, 3, 3, E[3]);
    // стрелки «вверх/вниз»
    var c = f ? E[15] : E[11];
    px(ctx, x - 1, y + d * (2 + o) - 1, 2, 2, c); px(ctx, x - 3, y + d * (4 + o) - 1, 6, 2, c);
    px(ctx, x - 1, y - d * (2 + o) - 1, 2, 2, c); px(ctx, x - 3, y - d * (4 + o) - 1, 6, 2, c);
  }
  function lift(ctx, x, y, w, t, L) {
    var top = Math.min(L.yT, L.yB) * T, bot = Math.max(L.yT, L.yB) * T;
    for (var yy = top - T; yy < bot; yy += 8) { px(ctx, x + 2, yy, 2, 4, E[8]); px(ctx, x + w - 4, yy, 2, 4, E[8]); }
    px(ctx, x, y, w, 10, E[6]); px(ctx, x, y, w, 2, E[14]); px(ctx, x + w / 2 - 4, y + 4, 8, 3, L.wait > 0 ? E[10] : E[12]);
  }
  function stal(ctx, x, y, state, t) {
    var sh = state === 'shake' ? (Math.floor(t * 30) % 2) * 2 - 1 : 0;
    for (var i = 0; i < 5; i++) px(ctx, x - 2 + sh + i * 2, y + i * 4, 20 - i * 4, 4, i < 2 ? E[7] : E[5]);
  }
  function dynaLit(ctx, x, y, fuse, t) { item(ctx, 'd', x, y, t, null); if (Math.floor(t * (fuse < 0.7 ? 16 : 8)) % 2 === 0) px(ctx, x + 6, y - 14, 4, 4, E[15]); }
  // ---------- Обитатели ----------
  function enemy(ctx, e, x, y, gs, t) {
    var w = e.w * T, h = e.h * T, fx = (e.face || -1) < 0, fy = (e.type === 'c' || e.type === 'j') && gs < 0, s = 3, sp, nm, f2 = Math.floor(t * 8) % 2;
    if (e.flash > 0 && f2) return;
    if (e.type === 'c') { sp = f2 ? CRAWL : CRAWL2; nm = 'cr' + f2; }
    else if (e.type === 'f') { sp = f2 ? FLY : FLY2; nm = 'fl' + f2; }
    else if (e.type === 'j') { sp = HOP; nm = 'hop'; }
    else { sp = SPIT; nm = 'spit'; }
    var sw = sp[0].length * s, shh = sp.length * s;
    blit(ctx, nm, sp, s, x + w / 2 - sw / 2, fy ? y : y + h - shh, fx, fy);
  }
  function boss(ctx, B, x, y, gs, t) {
    var w = B.w * T, h = B.h * T;
    ctx.save(); ctx.translate(Math.round(x + w / 2), Math.round(y + h / 2)); if (gs < 0) ctx.scale(1, -1); if ((B.face || -1) < 0) ctx.scale(-1, 1);
    var st = B.ground && !(B.stun > 0) ? (Math.floor(t * 6) % 2) * 4 : 0, fl = B.flash > 0;
    px(ctx, -28, 18 + st, 16, 14, E[8]); px(ctx, 12, 22 - st, 16, 10, E[8]);
    px(ctx, -32, -24, 64, 44, fl ? E[15] : E[5]); px(ctx, -32, -24, 64, 4, E[13]); px(ctx, -32, 16, 64, 4, E[1]);
    px(ctx, -40, -10 - st, 10, 26, E[8]); px(ctx, 30, -10 + st, 10, 26, E[8]);
    for (var i = 0; i < 4; i++) px(ctx, -26 + i * 2, -36 + i * 3, 10 - i * 2, 4, E[13]);
    for (i = 0; i < 5; i++) px(ctx, -6 + i * 2, -44 + i * 4, 10 - i * 2, 4, E[11]);
    for (i = 0; i < 3; i++) px(ctx, 16 + i * 2, -32 + i * 3, 8 - i * 2, 4, E[13]);
    var hot = B.fireT < 0.6 && !(B.stun > 0);
    px(ctx, 0, -6, 14, 14, hot ? (Math.floor(t * 20) % 2 ? E[15] : E[14]) : B.hp / B.max < 0.5 ? E[12] : E[13]);
    px(ctx, 14, -18, 8, 4, B.stun > 0 ? E[7] : E[14]); px(ctx, -2, -18, 8, 4, B.stun > 0 ? E[7] : E[14]);
    ctx.restore();
    if (B.stun > 0) for (i = 0; i < 3; i++) { var a = t * 4 + i * 2.1; px(ctx, x + w / 2 + Math.cos(a) * 22, (gs > 0 ? y - 8 : y + h + 8) + Math.sin(a) * 5, 4, 4, E[14]); }
  }
  // ---------- Героиня ----------
  function hero(ctx, x, y, p, t, S) {
    var run = p.ground && Math.abs(p.vx) > 0.1, sp = !p.ground ? HERO_AIR : run && Math.floor(t * 10) % 2 ? HERO_RUN : HERO, nm = sp === HERO ? 'h0' : sp === HERO_RUN ? 'h1' : 'h2';
    blit(ctx, nm, sp, 3, x + p.w * T / 2 - 12, p.gs > 0 ? y + p.h * T - 45 : y, p.face < 0, p.gs < 0);
  }
  function heroDown(ctx, x, y, p, pt) {
    if (Math.floor(pt * 10) % 2) return;
    for (var i = 0; i < 6; i++) px(ctx, x + i * 5 - 4, y + p.h * T - 8, 4, 8, i < 2 ? E[12] : E[3]);
  }
  function shot(ctx, x, y, vx, t) { px(ctx, x - 6, y - 2, 12, 4, E[14]); px(ctx, x + (vx > 0 ? 2 : -6), y - 2, 4, 4, E[15]); }
  function pebble(ctx, x, y, t) { px(ctx, x - 3, y - 3, 6, 6, E[10]); px(ctx, x - 1, y - 1, 2, 2, E[15]); }
  function shard(ctx, x, y, vx, vy, t) { px(ctx, x - 4, y - 4, 8, 8, E[13]); px(ctx, x - 2, y - 2, 4, 4, E[15]); }
  function wave(ctx, x, y, gs, t) { var d = gs > 0 ? -1 : 1; for (var i = 0; i < 4; i++) px(ctx, x - 12 + i * 6, d < 0 ? y - 8 - (i % 2) * 8 : y, 4, 8 + (i % 2) * 8, E[13]); }
  function blast(ctx, x, y, life) {
    var k = 1 - life / 0.5, r = 12 + k * 44, c = Math.floor(k * 6) % 2 ? E[14] : E[12];
    for (var i = 0; i < 12; i++) { var a = i / 12 * Math.PI * 2; px(ctx, x + Math.cos(a) * r - 4, y + Math.sin(a) * r - 4, 8, 8, c); }
    if (k < 0.5) px(ctx, x - 10, y - 10, 20, 20, E[15]);
  }
  // ---------- Значки ----------
  function icon(ctx, name, x, y) {
    switch (name) {
      case 'ammo': px(ctx, x - 7, y - 3, 12, 6, E[14]); px(ctx, x + 5, y - 1, 3, 3, E[15]); break;
      case 'dyn': px(ctx, x - 5, y - 6, 4, 12, E[12]); px(ctx, x, y - 6, 4, 12, E[12]); px(ctx, x + 3, y - 10, 2, 4, E[14]); break;
      case 'keyR': case 'keyB': case 'keyY': blit(ctx, 'ik' + name, keySprite({ keyR: 'c', keyB: '9', keyY: 'e' }[name]), 2, x - 8, y - 4); break;
      case 'keyOff': blit(ctx, 'ikoff', keySprite('8'), 2, x - 8, y - 4); break;
      case 'hp': case 'hpOff': blit(ctx, 'ih' + name, ['.cc.cc.', 'ccccccc', '.ccccc.', '..ccc..', '...c...'].map(function (r) { return name === 'hp' ? r : r.replace(/c/g, '8'); }), 2, x - 7, y - 5); break;
      case 'life': case 'lifeOff': blit(ctx, 'il' + name, LAMP.concat(['ccc']).map(function (r) { return name === 'life' ? r : r.replace(/[ce]/g, '8'); }), 4, x - 6, y - 6); break;
    }
  }
  // ---------- Хаб ----------
  function hubBg(ctx, g, t) {
    var W = g.W, H = g.H; px(ctx, 0, 0, W, H, E[0]);
    for (var i = 0; i < 56; i++) {
      var a = i / 56 * Math.PI * 2, rx = W / 2 + Math.cos(a) * (W / 2 - 16), ry = H / 2 + Math.sin(a) * (H / 2 - 14);
      px(ctx, Math.round(rx / 4) * 4 - 4, Math.round(ry / 4) * 4 - 4, 8, 8, i % 3 ? E[5] : E[3]);
      px(ctx, Math.round(rx / 4) * 4 - 2, Math.round(ry / 4) * 4 - 2, 4, 4, (Math.floor(t * 2) + i) % 7 ? (i % 3 ? E[13] : E[11]) : E[15]);
    }
  }
  function hubPath(ctx, a, b, open, t) {
    var n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 8);
    for (var i = 1; i < n; i++) px(ctx, Math.round((a.x + (b.x - a.x) * i / n) / 2) * 2 - 2, Math.round((a.y + (b.y - a.y) * i / n) / 2) * 2 - 2, 4, 4, open ? E[6] : E[8]);
  }
  function hubNode(ctx, n, num, st, sel, t) {
    var r = n.boss ? 20 : 15, c = st === 'done' ? E[2] : st === 'open' ? E[6] : E[1], bc = st === 'done' ? E[10] : st === 'open' ? E[14] : E[8];
    if (sel && Math.floor(t * 4) % 2) bc = E[15];
    px(ctx, n.x - r, n.y - r, r * 2, r * 2, bc); px(ctx, n.x - r + 3, n.y - r + 3, r * 2 - 6, r * 2 - 6, c);
    if (n.boss) { blit(ctx, 'crys3', CRYS, 3, n.x - 10, n.y - 10); return; }
    ctx.fillStyle = st === 'locked' ? E[8] : E[15]; ctx.font = '800 14px "Courier New", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(st === 'done' ? 'V' : String(num), n.x, n.y + 1); ctx.textBaseline = 'alphabetic';
  }

  Z.classic = { P: P, E: E, bg: bg, tile: tile, item: item, exit: exit, lever: lever, orb: orb, lift: lift, stal: stal, dynaLit: dynaLit,
    enemy: enemy, boss: boss, hero: hero, heroDown: heroDown, shot: shot, pebble: pebble, shard: shard, wave: wave, blast: blast,
    icon: icon, hubBg: hubBg, hubPath: hubPath, hubNode: hubNode, sprite: sprite, HERO: HERO };
})(typeof window !== 'undefined' ? window : globalThis);
