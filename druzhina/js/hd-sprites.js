/* ДРУЖИНА · тема HD v2 — спрайты как МАТРИЦЫ ИНДЕКСОВ ПАЛИТРЫ (≤ 16 цветов на всю тему).
   Конвейер скопирован из прототипа студии (_proto/hd-brawl, «чиби HD-пиксель») и расширен под ДРУЖИНУ (не импортируется оттуда):
   1) СКЕЛЕТ-СБОРКА (этот файл): голова — матрица 28×28 (череп + облик: борода/коса/капюшон/шлем) с мимикой-патчами
      (n — обычное, a — удар/крик, h — урон); торс — матрица (наклон = целые сдвиги рядов, поворот только на 90°);
      конечности — «капсулы» по суставам (IK на 2 кости) тремя тонами рампы; кулак/сапог — матрицы; дальняя рука/нога — на ступень темнее.
      Оружие — матрица «вверх» + её поворот на 45° (RotSprite-упрощённо: EPX ×4 → поворот → свёртка), дальше только 90°-повороты.
      Idle (2 кадра), ходьба и бег (по 6) — собираются со скелета при загрузке.
   2) КЛЮЧЕВЫЕ ПОЗЫ — ЦЕЛЫЕ МАТРИЦЫ из js/hd-poses.js (удары серии ×3 фазы, рывок, «спина», прыжок, удар в прыжке, урон, падение,
      лёжа, подъём, захват/колено/бросок, магия, езда; у врагов — стойка, щит, присед, захвачен). Черновик снят со скелета
      tools/bake-poses.mjs + ручные правки FIX; у кого поз в файле нет (боссы 2-го плана) — те же позы собираются при загрузке.
   Вторичное движение: коса, хвост, плюмаж (на 2 кадра) и плащ/полог фартука (на 1 кадр) крепятся в точке ПРЕДЫДУЩЕГО кадра цепочки,
   смещение ≤ 2 px. Селективный контур: снизу/справа — чернила, на освещённой кромке — ступень темнее материала.
   Звери (хвостобой, огнеящер), бесы, предметы — матрицы, собранные кодом. UMD: браузер DRUZHINA.hdSprites, Node — module.exports. */
(function (global) {
  'use strict';

  // ---------- Палитра темы: 16 цветов (персонажи, звери, фон, частицы, шрифт, HUD) ----------
  var PAL = [
    null,       // 0 .  прозрачный
    '#140e14',  // 1 k  чернила
    '#30192c',  // 2 p  слива
    '#5e2a36',  // 3 w  вино
    '#94402c',  // 4 r  ржа
    '#cf6f32',  // 5 c  медь
    '#f2a64c',  // 6 o  рыжий
    '#ffe08a',  // 7 g  латунь
    '#fff3df',  // 8 W  белый тёплый
    '#efb48c',  // 9 s  кожа
    '#b8705c',  // 10 S кожа в тени
    '#1b1b30',  // 11 n ночь
    '#353f5c',  // 12 l сланец
    '#60789a',  // 13 b сталь
    '#a9c0cf',  // 14 m пар
    '#2d5634',  // 15 t хвоя
    '#6b9a46'   // 16 v мох
  ];
  var KEY = { '.': 0, k: 1, p: 2, w: 3, r: 4, c: 5, o: 6, g: 7, W: 8, s: 9, S: 10, n: 11, l: 12, b: 13, m: 14, t: 15, v: 16 };
  var CHR = []; Object.keys(KEY).forEach(function (k) { CHR[KEY[k]] = k; });
  var SHADE = [0, 1, 1, 2, 3, 4, 5, 6, 14, 10, 3, 1, 11, 12, 13, 11, 15];   // ступень темнее в своей рампе
  var LIT = [0, 1, 1, 2, 3, 4, 4, 5, 14, 10, 3, 1, 11, 12, 13, 11, 15];     // контур на освещённой кромке

  // ---------- Матрицы ----------
  function grid(w, h) { return { w: w, h: h, a: new Uint8Array(w * h) }; }
  function padRows(rows) { var w = 0, i; for (i = 0; i < rows.length; i++) w = Math.max(w, rows[i].length); return rows.map(function (r) { while (r.length < w) r += '.'; return r; }); }
  function parse(rows) {
    rows = padRows(rows); var h = rows.length, w = h ? rows[0].length : 0, m = grid(w, h);
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) { var v = KEY[rows[y][x]]; if (v === undefined) throw new Error('hd: неизвестный символ «' + rows[y][x] + '»'); m.a[y * w + x] = v; }
    return m;
  }
  function toRows(m) { var o = []; for (var y = 0; y < m.h; y++) { var s = ''; for (var x = 0; x < m.w; x++) s += CHR[m.a[y * m.w + x]]; o.push(s); } return o; }
  function get(m, x, y) { x = Math.round(x); y = Math.round(y); return x < 0 || y < 0 || x >= m.w || y >= m.h ? 0 : m.a[y * m.w + x]; }
  function put(m, x, y, v) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < m.w && y < m.h) m.a[y * m.w + x] = v; }
  function stamp(dst, src, ox, oy) { ox = Math.round(ox); oy = Math.round(oy); for (var y = 0; y < src.h; y++) for (var x = 0; x < src.w; x++) { var v = src.a[y * src.w + x]; if (v) put(dst, ox + x, oy + y, v); } return dst; }
  // патчи [ряд, столбец, строка]: '_' — не трогать, '.' — стереть, иначе — цвет
  function seg(m, list) { (list || []).forEach(function (p) { var y = p[0], x = p[1], s = p[2]; for (var i = 0; i < s.length; i++) { if (s[i] === '_') continue; put(m, x + i, y, KEY[s[i]]); } }); return m; }
  function clone(m) { return { w: m.w, h: m.h, a: new Uint8Array(m.a) }; }
  function cmap(obj) { var o = []; for (var i = 0; i < PAL.length; i++) o[i] = i; Object.keys(obj || {}).forEach(function (k) { o[KEY[k]] = KEY[obj[k]]; }); return o; }
  function recolor(m, map) { var o = clone(m); for (var i = 0; i < o.a.length; i++) o.a[i] = map[o.a[i]]; return o; }
  function rot90(p) { var o = grid(p.h, p.w); for (var y = 0; y < p.h; y++) for (var x = 0; x < p.w; x++) o.a[x * o.w + (p.h - 1 - y)] = p.a[y * p.w + x]; return o; }   // по часовой
  function rotN(p, k) { k = ((k || 0) % 4 + 4) % 4; for (var i = 0; i < k; i++) p = rot90(p); return p; }
  function rotPt(x, y, w, h, k) { k = ((k || 0) % 4 + 4) % 4; for (var i = 0; i < k; i++) { var nx = h - 1 - y; y = x; x = nx; var t = w; w = h; h = t; } return [x, y]; }
  function flipX(p) { var o = grid(p.w, p.h); for (var y = 0; y < p.h; y++) for (var x = 0; x < p.w; x++) o.a[y * p.w + x] = p.a[y * p.w + p.w - 1 - x]; return o; }
  // наклон без поворота на дробный угол: ряд y сдвигается на round(lean·(низ − y))
  function shear(p, lean) {
    var sh = [], mn = 0, mx = 0, y, x;
    for (y = 0; y < p.h; y++) { sh[y] = Math.round(lean * (p.h - 1 - y)); mn = Math.min(mn, sh[y]); mx = Math.max(mx, sh[y]); }
    var o = grid(p.w + mx - mn, p.h);
    for (y = 0; y < p.h; y++) for (x = 0; x < p.w; x++) o.a[y * o.w + x + sh[y] - mn] = p.a[y * p.w + x];
    o.map = function (px, py) { var yy = Math.max(0, Math.min(p.h - 1, py)); return [px + sh[yy] - mn, py]; };
    return o;
  }
  // заливка области тремя тонами: верх/лево — свет, низ/право — тень (свет сверху-слева)
  function bevel(m, mk, ramp, tex) {
    var w = m.w, h = m.h, M = new Uint8Array(w * h), x, y;
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) M[y * w + x] = mk(x, y) ? 1 : 0;
    function at(x, y) { return x >= 0 && y >= 0 && x < w && y < h && M[y * w + x]; }
    var hi = KEY[ramp[0]], mid = KEY[ramp[1]], sh = KEY[ramp[2]];
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      if (!M[y * w + x]) continue;
      var v = (!at(x, y - 1) || !at(x - 1, y)) ? hi : (!at(x, y + 1) || !at(x + 1, y)) ? sh : mid;
      if (tex) v = tex(x, y, v, hi, mid, sh);
      m.a[y * w + x] = v;
    }
    return m;
  }
  function dilate(fn, n) { return function (x, y) { for (var dy = -n; dy <= n; dy++) for (var dx = -n; dx <= n; dx++) if (Math.abs(dx) + Math.abs(dy) <= n + (n > 1 ? 1 : 0) && fn(x + dx, y + dy)) return true; return false; }; }
  // RLE строки матрицы: «4.kk3r» = «....kkrrr» (цифры — повтор следующего символа)
  function rle(row) { var o = '', i = 0; while (i < row.length) { var c = row[i], n = 1; while (row[i + n] === c) n++; o += n >= 3 ? n + c : (n === 2 ? c + c : c); i += n; } return o; }
  function unrle(s) { var o = '', n = ''; for (var i = 0; i < s.length; i++) { var c = s[i]; if (c >= '0' && c <= '9') n += c; else { var k = n ? +n : 1; while (k--) o += c; n = ''; } } return o; }
  // эллипс/капсула со светотенью по нормали (звери, бесы)
  var LIGHT = [-0.6, -0.8];
  function ellM(m, cx, cy, rx, ry, ramp, keep) {
    var hi = KEY[ramp[0]], mid = KEY[ramp[1]], sh = KEY[ramp[2]];
    for (var y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) for (var x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      var nx = (x - cx) / rx, ny = (y - cy) / ry, d = nx * nx + ny * ny; if (d > 1.02) continue;
      if (keep && !keep(x, y)) continue;
      var s = (nx * LIGHT[0] + ny * LIGHT[1]); put(m, x, y, s > 0.45 ? hi : s < -0.3 ? sh : mid);
    }
  }
  function capM(m, A, B, r, ramp) {
    var ids = [KEY[ramp[0]], KEY[ramp[1]], KEY[ramp[2]]], dx = B[0] - A[0], dy = B[1] - A[1], dd = dx * dx + dy * dy || 1;
    var x0 = Math.floor(Math.min(A[0], B[0]) - r - 1), x1 = Math.ceil(Math.max(A[0], B[0]) + r + 1), y0 = Math.floor(Math.min(A[1], B[1]) - r - 1), y1 = Math.ceil(Math.max(A[1], B[1]) + r + 1);
    for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) {
      if (x < 0 || y < 0 || x >= m.w || y >= m.h) continue;
      var t = Math.max(0, Math.min(1, ((x - A[0]) * dx + (y - A[1]) * dy) / dd)), vx = x - (A[0] + t * dx), vy = y - (A[1] + t * dy), d = Math.sqrt(vx * vx + vy * vy);
      if (d > r + 0.15) continue;
      var s = d < 0.01 ? 0 : (vx * LIGHT[0] + vy * LIGHT[1]) / r;
      m.a[y * m.w + x] = s > 0.35 ? ids[0] : s < -0.3 ? ids[2] : ids[1];
    }
  }
  function lineM(m, A, B, v) {   // Брезенхем
    var x0 = Math.round(A[0]), y0 = Math.round(A[1]), x1 = Math.round(B[0]), y1 = Math.round(B[1]), dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, e = dx + dy;
    for (var n = 0; n < 400; n++) { put(m, x0, y0, v); if (x0 === x1 && y0 === y1) break; var e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
  }
  // Селективный внешний контур
  function outline(f) {
    var w = f.w, h = f.h, s = f.a, a = new Uint8Array(s);
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      if (s[y * w + x]) continue;
      var dn = y < h - 1 ? s[(y + 1) * w + x] : 0, rt = x < w - 1 ? s[y * w + x + 1] : 0, up = y > 0 ? s[(y - 1) * w + x] : 0, lf = x > 0 ? s[y * w + x - 1] : 0;
      if (!(dn || rt || up || lf)) continue;
      a[y * w + x] = (up || lf) ? 1 : LIT[dn || rt];
    }
    return { w: w, h: h, a: a };
  }
  // Поворот на 45° по часовой (RotSprite-упрощённо): EPX ×2 дважды → поворот ближайшим → свёртка 4×4 по большинству
  function epx(p) {
    var o = grid(p.w * 2, p.h * 2);
    for (var y = 0; y < p.h; y++) for (var x = 0; x < p.w; x++) {
      var P = get(p, x, y), A = get(p, x, y - 1), B = get(p, x + 1, y), C = get(p, x - 1, y), Dd = get(p, x, y + 1);
      var e1 = P, e2 = P, e3 = P, e4 = P;
      if (C === A && C !== Dd && A !== B) e1 = A; if (A === B && A !== C && B !== Dd) e2 = B; if (Dd === C && Dd !== B && C !== A) e3 = C; if (B === Dd && B !== A && Dd !== C) e4 = Dd;
      o.a[(2 * y) * o.w + 2 * x] = e1; o.a[(2 * y) * o.w + 2 * x + 1] = e2; o.a[(2 * y + 1) * o.w + 2 * x] = e3; o.a[(2 * y + 1) * o.w + 2 * x + 1] = e4;
    }
    return o;
  }
  function rot45(p, pts) {
    var q = epx(epx(p)), S = 4, c = Math.SQRT1_2, R = Math.ceil((p.w + p.h) * c) + 2, o = grid(R, R), cx = p.w / 2, cy = p.h / 2, oc = R / 2;
    for (var y = 0; y < R; y++) for (var x = 0; x < R; x++) {
      var cnt = {}, best = 0, bn = 0, filled = 0;
      for (var sy = 0; sy < S; sy++) for (var sx = 0; sx < S; sx++) {
        var X = x + (sx + 0.5) / S - oc, Y = y + (sy + 0.5) / S - oc;
        var u = X * c + Y * c + cx, v = -X * c + Y * c + cy;   // обратный поворот
        var val = get(q, Math.floor(u * S), Math.floor(v * S)); if (!val) continue;
        filled++; cnt[val] = (cnt[val] || 0) + 1; if (cnt[val] > bn) { bn = cnt[val]; best = val; }
      }
      if (filled >= 6) o.a[y * R + x] = best;
    }
    var out = (pts || []).map(function (pt) { var X = pt[0] + 0.5 - cx, Y = pt[1] + 0.5 - cy; return [Math.floor(X * c - Y * c + oc), Math.floor(X * c + Y * c + oc)]; });
    return { m: o, pts: out };
  }

  // ---------- Головы: череп 24×22 на холсте 28×28 (смещение 2,4) + облик + мимика ----------
  var HW = 28, HH = 28, SKX = 2, SKY = 4, HNECK = [15, 25];
  var SKULL = [
    '........ssssssss........',
    '......ssssssssssss......',
    '.....ssssssssssssss.....',
    '....ssssssssssssssss....',
    '...Sssssssssssssssss....',
    '...Ssssssssssssssssss...',
    '..SSsssssssssssssssss...',
    '..SSssssssssssssssssss..',
    '..SSssssssssssssssssss..',
    '..SsssssssssssssssssssS.',
    '.SSssssssssssssssssssss.',
    '.SwSsssssssssssssssssss.',
    '.SwSssssssssssssssssssss',
    '.SSsssssssssssssssssssss',
    '..SsssssssssssssssssssS.',
    '..SSssssssssssssssssssS.',
    '..SSSsssssssssssssssssS.',
    '...SSSsssssssssssssssSS.',
    '...SSSSSsssssssssssSSS..',
    '....SSSSSSSSSSSSSSSSS...',
    '.....SSSSSSSSSSSSSSS....',
    '........SSSSSSSSS.......'
  ];
  var SKM = parse(SKULL);
  function SK(x, y) { return get(SKM, x - SKX, y - SKY) > 0; }
  function skull(map) { var m = grid(HW, HH); stamp(m, map ? recolor(SKM, cmap(map)) : SKM, SKX, SKY); return m; }
  function rep(c, n) { var s = ''; while (n-- > 0) s += c; return s; }
  // мимика (координаты холста головы): ближний глаз — столбец 15, дальний — 22, брови — ряд 13, рот — ряды 20–22
  function faces(B) {
    return {
      n: [[13, 13, rep(B, 4)], [13, 21, rep(B, 3)], [15, 15, 'Wk'], [16, 15, 'kk'], [15, 22, 'k'], [16, 22, 'k'], [17, 25, 'S'], [18, 24, 'SS'], [21, 19, 'www']],
      a: [[13, 13, rep(B, 3)], [14, 15, rep(B, 3)], [13, 22, rep(B, 3)], [14, 21, B], [15, 15, 'kk'], [16, 15, 'kk'], [15, 22, 'k'], [16, 22, 'k'], [17, 25, 'S'], [18, 24, 'SS'],
        [20, 18, 'kkkkk'], [21, 18, 'kWWWk'], [22, 19, 'kkk']],
      h: [[12, 15, rep(B, 3)], [13, 13, rep(B, 2)], [12, 21, rep(B, 2)], [13, 23, rep(B, 2)], [15, 15, 'k'], [16, 16, 'k'], [17, 15, 'k'], [15, 22, 'k'], [16, 21, 'k'], [17, 22, 'k'],
        [18, 24, 'SS'], [20, 19, 'kkk'], [21, 19, 'kwk'], [22, 20, 'k']]
    };
  }
  var EAR = function (x, y) { return x === 4 && (y === 15 || y === 16); };
  function strands(x, y, v, hi, mid, sh) { return v === mid && (x * 3 + y) % 5 === 0 ? sh : v === mid && (x + y * 2) % 7 === 0 ? hi : v; }
  function mkHead(o) {
    var out = {}, F = o.B ? faces(o.B) : null;
    ['n', 'a', 'h'].forEach(function (e) {
      var m = skull(o.map);
      if (F && !o.visor) seg(m, F[e]);
      if (o.draw) o.draw(m, e);
      if (o.post) seg(m, (o.post[e] || []));
      out[e] = m;
    });
    return out;
  }
  // шлем по силуэту черепа (+1 px) до ряда y1, затылок — до ряда y2
  function helmMask(y1, xb, y2) { var d = dilate(SK, 1); return function (x, y) { return (d(x, y) && y <= y1) || (xb && SK(x, y) && x <= xb && y <= y2 && !EAR(x, y)); }; }
  var HEADS = {
    // Ждан: лысое темя с бликом, медная бахрома на затылке, окладистая медная борода
    zhdan: mkHead({ B: 'r', draw: function (m) {
      seg(m, [[5, 11, 'WW'], [6, 10, 'W'], [6, 12, 'W']]);
      bevel(m, function (x, y) { return SK(x, y) && x <= 6 && y >= 10 && y <= 22 && !EAR(x, y); }, 'ocr', strands);
      var mouth = function (x, y) { return y >= 20 && y <= 22 && x >= 18 && x <= 23; };
      bevel(m, function (x, y) {
        if (SK(x, y) && y >= 19 && x >= 6 && !mouth(x, y)) return true;
        if (y === 26 && x >= 9 && x <= 22) return true;
        if (y === 27 && x >= 10 && x <= 21 && x % 3 !== 0) return true;
        return SK(x, y) && y >= 17 && x >= 6 && x <= 8;
      }, 'ocr', strands);
      seg(m, [[19, 17, 'oooooooc'], [20, 17, 'c'], [20, 24, 'c'], [12, 13, 'rrr'], [12, 21, 'rr']]);
    } }),
    // Сеча: золотые волосы с чёлкой, стальной обруч; коса — вторичная деталь
    secha: mkHead({ B: 'c', draw: function (m) {
      bevel(m, function (x, y) { return SK(x, y) && (y <= 11 || (x <= 7 && y <= 21) || (y === 12 && x % 3 !== 1)) && !EAR(x, y); }, 'goc', strands);
      for (var x = 0; x < HW; x++) if (SK(x, 10)) put(m, x, 10, x % 4 === 1 ? KEY.m : KEY.b);
      seg(m, [[18, 4, 'g'], [19, 5, 'o']]);
    } }),
    // Ольха: мховый капюшон вокруг лица, медная прядь
    olha: mkHead({ B: 'r', draw: function (m) {
      var d = dilate(SK, 2), open = function (x, y) { var nx = (x - 19.5) / 7, ny = (y - 18.5) / 8; return SK(x, y) && nx * nx + ny * ny < 1 && y >= 12; };
      bevel(m, function (x, y) { return d(x, y) && !open(x, y) && y <= 26 && x <= 25; }, 'vtn', function (x, y, v, hi, mid, sh) { return v === mid && x < 6 ? sh : v; });
      seg(m, [[12, 15, 'cocoo'], [13, 14, 'c'], [12, 20, 'oc']]);
    } }),
    // щитоносец: стальной шлем с забралом-щелью, медная кромка орды
    shield: mkHead({ visor: true, draw: function (m) {
      bevel(m, helmMask(18, 9, 22), 'mbl', function (x, y, v) { return v === KEY.b && (x === 13 || x === 14) && y < 13 ? KEY.m : v; });
      for (var x = 6; x <= 26; x++) { if (get(m, x, 15)) put(m, x, 15, KEY.k); if (get(m, x, 14)) put(m, x, 14, KEY.l); if (get(m, x, 18)) put(m, x, 18, KEY.c); }
      seg(m, [[11, 8, 'g'], [11, 18, 'g']]);
    }, post: { n: [[15, 17, 'oo'], [15, 23, 'c']], a: [[15, 16, 'ggo'], [15, 22, 'go'], [21, 19, 'kkk']], h: [[15, 17, 'W'], [15, 23, 'W'], [21, 20, 'kk']] } }),
    // копейщик: шишак со шпилем и наносником
    spear: mkHead({ B: 'p', draw: function (m) {
      bevel(m, helmMask(12), 'mbl');
      for (var x = 4; x <= 24; x++) if (get(m, x, 12)) put(m, x, 12, KEY.l);
      seg(m, [[0, 14, 'm'], [1, 13, 'mb'], [2, 13, 'mb'], [3, 13, 'mbl'], [13, 24, 'b'], [14, 24, 'b'], [15, 24, 'b'], [16, 24, 'l'], [19, 17, 'pppp'], [20, 17, 'p'], [20, 22, 'p']]);
    } }),
    // налётчица: рыжие волосы, тёмная повязка на лице; хвост — вторичная деталь
    raider: mkHead({ B: 'r', draw: function (m) {
      bevel(m, function (x, y) { return SK(x, y) && (y <= 11 || (x <= 7 && y <= 19) || (y === 12 && x % 2 === 0)) && !EAR(x, y); }, 'ocr', strands);
      bevel(m, function (x, y) { return SK(x, y) && y >= 19 && x >= 9; }, 'lnk');
      seg(m, [[19, 9, 'l'], [18, 23, 'n']]);
    } }),
    // громила: серая кожа, лысый, шрамы, клык
    brute: mkHead({ B: 'l', map: { s: 'm', S: 'b', w: 'l' }, draw: function (m) {
      seg(m, [[8, 12, 'l'], [9, 13, 'l'], [10, 14, 'l'], [12, 13, 'bbbbbbbbbbb'], [17, 4, 'g'], [20, 20, 'W'], [20, 23, 'W']]);
    } }),
    // Бронный Воевода: открытый шлем с золотой кромкой и наносником, седые усы; плюмаж — вторичная деталь
    voevoda: mkHead({ B: 'p', draw: function (m) {
      bevel(m, helmMask(13, 10, 22), 'mbl');
      for (var x = 4; x <= 25; x++) { if (get(m, x, 13)) put(m, x, 13, KEY.g); if (get(m, x, 12)) put(m, x, 12, KEY.o); }
      seg(m, [[14, 24, 'b'], [15, 24, 'b'], [16, 24, 'b'], [17, 24, 'l'], [19, 17, 'mmmmmm'], [20, 16, 'mm'], [20, 22, 'mm'], [4, 13, 'gg']]);
    } }),
    // Чёрный Литейщик: глухой тёмный шлем-маска, медная корона, горящие глаза
    liteyshchik: mkHead({ visor: true, draw: function (m) {
      bevel(m, dilate(SK, 1), 'bln', function (x, y, v) { return v === KEY.n && (x + y) % 9 === 0 ? KEY.p : v; });
      seg(m, [[3, 8, 'occcoccccocccco'], [2, 8, 'o'], [1, 8, 'o'], [2, 13, 'o'], [1, 13, 'g'], [0, 13, 'o'], [2, 17, 'o'], [1, 17, 'o'], [2, 22, 'o'], [1, 22, 'o'],
        [21, 18, 'kkkkk']]);
    }, post: { n: [[15, 15, 'oo'], [15, 22, 'c'], [21, 19, 'rcr']], a: [[14, 14, 'o'], [15, 14, 'ggo'], [15, 22, 'og'], [21, 18, 'cooocc'], [22, 19, 'rcr']], h: [[15, 15, 'W'], [15, 22, 'W'], [21, 19, 'kkk']] } })
  };
  // упрощённые (собираются из готовых): близнецы — громила с повязкой; Цепник — шлем щитоносца темнее; Ловчий — меховая шапка; Стенобой — рогатый шлем
  function variant(base, map, extra) { var o = {}; ['n', 'a', 'h'].forEach(function (e) { var m = map ? recolor(base[e], cmap(map)) : clone(base[e]); if (extra) extra(m, e); o[e] = m; }); return o; }
  HEADS.twins0 = variant(HEADS.brute, null, function (m) { for (var x = 0; x < HW; x++) if (SK(x, 11)) { put(m, x, 11, KEY.c); put(m, x, 10, KEY.r); } seg(m, [[12, 3, 'cr'], [13, 2, 'cr']]); });
  HEADS.twins1 = variant(HEADS.brute, null, function (m) { for (var x = 0; x < HW; x++) if (SK(x, 11)) { put(m, x, 11, KEY.v); put(m, x, 10, KEY.t); } seg(m, [[12, 3, 'vt'], [13, 2, 'vt']]); });
  HEADS.cepnik = variant(HEADS.shield, { m: 'b', b: 'l', l: 'n', c: 'g' });
  HEADS.lovchiy = variant(HEADS.spear, null, function (m) { bevel(m, function (x, y) { return dilate(SK, 2)(x, y) && y <= 12; }, 'rwp', function (x, y, v, hi, mid, sh) { return v === mid && (x + y) % 3 === 0 ? sh : v === mid && (x * 2 + y) % 5 === 0 ? hi : v; }); });
  HEADS.stenoboy = variant(HEADS.brute, null, function (m) { bevel(m, helmMask(12), 'lnk'); seg(m, [[5, 4, 'W'], [4, 3, 'mW'], [3, 2, 'mW'], [2, 2, 'W'], [5, 22, 'W'], [4, 23, 'Wm'], [3, 24, 'Wm'], [2, 25, 'W'], [9, 13, 'bb']]); });

  // ---------- Торсы ----------
  // std 16×15 (пояс — ряд 10), wide 18×15 (Ждан), big 24×21 (пояс — 15): грудь, пояс с пряжкой, бёдра; детали — draw
  function torso(w, h, belt, R, draw, big) {
    var m = grid(w, h), cx = w >> 1;
    function inT(x, y) {
      if (y < 0 || y >= h || x < 0 || x >= w) return false;
      var a = 0, b = w - 1;
      if (y === 0) { a = cx - 3; b = cx + 2; } else if (y === 1) { a = 2; b = w - 3; } else if (y === 2) { a = 1; b = w - 2; }
      else if (y === belt - 1) { a = 1; b = w - 2; } else if (y >= belt) { a = 2; b = w - 3; if (y === h - 1) b = w - 4; }
      return x >= a && x <= b;
    }
    bevel(m, function (x, y) { return inT(x, y) && y < belt; }, R.chest, R.tex || function (x, y, v, hi, mid, sh) { return v === mid && x >= w - 3 ? sh : v; });
    for (var x = 0; x < w; x++) if (inT(x, belt)) put(m, x, belt, KEY[R.belt]);
    put(m, cx, belt, KEY[R.buckle]); put(m, cx - 1, belt, KEY[R.buckle]); if (big) { put(m, cx, belt - 1, KEY[R.buckle]); put(m, cx - 1, belt - 1, KEY[R.buckle]); }
    bevel(m, function (x, y) { return inT(x, y) && y > belt; }, R.hips);
    if (draw) draw(m, inT, cx, belt);
    var J = big ? { neck: [cx, 0], sN: [5, 4], sF: [w - 6, 4], hN: [7, h - 2], hF: [w - 8, h - 2], hip: [cx, h - 1], belt: [6, belt], cape: [3, 1] }
      : { neck: [cx, 0], sN: [4, 3], sF: [w - 5, 3], hN: [5, h - 2], hF: [w - 6, h - 2], hip: [cx, h - 1], belt: [5, belt], cape: [3, 1] };
    return { m: m, J: J };
  }
  function mail(x, y, v, hi, mid, sh) { return v === mid && (x + y) % 3 === 0 ? sh : v === mid && x >= 13 ? sh : v; }
  var TORSO = {
    zhdan: torso(18, 15, 10, { chest: 'crw', belt: 'k', buckle: 'g', hips: 'lnk' }, function (m, inT) {
      bevel(m, function (x, y) { return x >= 6 && x <= 13 && y >= 3 && y <= 9; }, 'wpk', function (x, y, v) { return y === 6 && x >= 8 && x <= 11 ? KEY.r : v; });
      seg(m, [[1, 5, 'p'], [2, 5, 'p'], [1, 12, 'p'], [2, 13, 'p'], [0, 8, 'sss'], [1, 8, 'sS'], [2, 9, 'S']]);
    }),
    secha: torso(16, 15, 10, { chest: 'mbl', belt: 'w', buckle: 'g', hips: 'bln', tex: mail }, function (m) {
      seg(m, [[0, 5, 'gggggg'], [1, 4, 'o'], [1, 11, 'o'], [9, 1, 'oooooooooooooo'], [1, 7, 'ss']]);
    }),
    olha: torso(16, 15, 10, { chest: 'vtn', belt: 'r', buckle: 'g', hips: 'lnk' }, function (m) {
      for (var i = 0; i < 9; i++) { put(m, 3 + i, 1 + i, KEY.r); put(m, 4 + i, 1 + i, KEY.w); }
      seg(m, [[0, 6, 'sss'], [1, 6, 'Ss']]);
    }),
    shield: torso(16, 15, 10, { chest: 'lnk', belt: 'p', buckle: 'o', hips: 'lnk' }, function (m) {
      bevel(m, function (x, y) { return x >= 4 && x <= 11 && y >= 2 && y <= 8; }, 'mbl');
      seg(m, [[4, 7, 'c'], [5, 6, 'ccc'], [6, 7, 'c'], [0, 6, 'cccc']]);
    }),
    spear: torso(16, 15, 10, { chest: 'rwp', belt: 'k', buckle: 'b', hips: 'lnk' }, function (m) {
      for (var i = 0; i < 9; i++) { put(m, 3 + i, 1 + i, KEY.p); put(m, 12 - i, 1 + i, KEY.p); }
      seg(m, [[5, 7, 'bb']]);
    }),
    raider: torso(16, 15, 10, { chest: 'wpk', belt: 'o', buckle: 'g', hips: 'wpk' }, function (m) {
      seg(m, [[0, 5, 'oooooo'], [1, 4, 'o'], [1, 11, 'o'], [9, 2, 'cccccccccccc'], [0, 7, 'ss'], [1, 7, 'S']]);
    }),
    brute: torso(24, 21, 15, { chest: 'mbl', belt: 'w', buckle: 'g', hips: 'wpk' }, function (m) {
      for (var i = 0; i < 13; i++) { put(m, 3 + i, 1 + i, KEY.p); put(m, 4 + i, 1 + i, KEY.p); put(m, 20 - i, 1 + i, KEY.p); }
      seg(m, [[6, 6, 'llll'], [6, 13, 'llll'], [10, 11, 'l'], [11, 11, 'l'], [12, 11, 'l'], [7, 10, 'g']]);
    }, true),
    voevoda: torso(24, 21, 15, { chest: 'mbl', belt: 'p', buckle: 'g', hips: 'lnk' }, function (m, inT, cx) {
      for (var y = 4; y < 15; y += 3) for (var x = 0; x < 24; x++) if (inT(x, y) && get(m, x, y) === KEY.b) put(m, x, y, KEY.l);
      bevel(m, function (x, y) { return x >= cx - 3 && x <= cx + 2 && y >= 2 && y <= 20 && inT(x, y); }, 'rww');
      seg(m, [[0, 8, 'gggggggg'], [1, 3, 'g'], [1, 20, 'g'], [8, cx - 1, 'gg']]);
    }, true),
    liteyshchik: torso(24, 21, 15, { chest: 'bln', belt: 'k', buckle: 'o', hips: 'lnk' }, function (m, inT, cx) {
      for (var y = 2; y < 15; y++) if (inT(cx - 6, y)) put(m, cx - 6, y, KEY.r);
      for (var x = 3; x < 21; x++) if (inT(x, 9)) put(m, x, 9, KEY.r);
      seg(m, [[5, cx - 2, 'cooc'], [6, cx - 2, 'oggo'], [7, cx - 2, 'oggo'], [8, cx - 2, 'cooc'], [0, 8, 'cccccccc'], [3, 4, 'c'], [3, 19, 'c']]);
    }, true)
  };
  TORSO.twins0 = { m: TORSO.brute.m, J: TORSO.brute.J }; TORSO.twins1 = TORSO.twins0;
  TORSO.cepnik = { m: recolor(TORSO.shield.m, cmap({})), J: TORSO.shield.J };
  TORSO.cepnik = torso(24, 21, 15, { chest: 'lnk', belt: 'p', buckle: 'g', hips: 'lnk' }, function (m, inT) { for (var i = 0; i < 14; i++) put(m, 3 + i, 2 + Math.round(i * 0.8), i % 2 ? KEY.m : KEY.b); }, true);
  TORSO.stenoboy = torso(24, 21, 15, { chest: 'lnk', belt: 'k', buckle: 'c', hips: 'lnk' }, function (m, inT) { for (var y = 3; y < 15; y += 4) for (var x = 3; x < 21; x += 5) if (inT(x, y)) put(m, x, y, KEY.b); }, true);
  TORSO.lovchiy = torso(16, 15, 10, { chest: 'rwp', belt: 'k', buckle: 'g', hips: 'lnk', tex: function (x, y, v, hi, mid, sh) { return v === mid && (x + y) % 3 === 0 ? sh : v; } });

  // ---------- Кулаки, сапоги ----------
  var FIST = parse(['.SSss.', 'Ssssss', 'SSSSss', 'Ssssss', 'wSSSSS', '.wwww.']);
  var FISTB = parse(['.SSsss.', 'Ssssss.', 'Sssssss', 'SSSSsss', 'Sssssss', 'wSSSSSS', '.wwwww.']);
  var BOOT = parse(['.pwwp....', '.pwwwwp..', 'ppwwwwwwp', 'ppppppppp', '.kkkkkkk.']);
  var BOOTB = parse(['.pwwwp.....', '.pwwwwwp...', '.pwwwwwwp..', 'ppwwwwwwwwp', 'ppppppppppp', '.kkkkkkkkk.']);
  function handOf(ramp, big) { return recolor(big ? FISTB : FIST, cmap({ s: ramp[0], S: ramp[1], w: ramp[2] })); }
  function bootOf(ramp, big) { return recolor(big ? BOOTB : BOOT, cmap({ w: ramp[0], p: ramp[1], k: ramp[2] })); }

  // ---------- Оружие: матрица «вверх», точка хвата [x, y]; 8 направлений (0 — вверх, по часовой через 45°) ----------
  function bowM() {
    var m = grid(7, 23); for (var y = 0; y < 23; y++) { var cx = 1 + Math.round(4 * Math.sin(Math.PI * y / 22)); put(m, cx, y, KEY.c); if (y > 2 && y < 20) put(m, cx + 1, y, KEY.r); }
    seg(m, [[0, 1, 'o'], [22, 1, 'o'], [10, 5, 'w'], [11, 5, 'ww'], [12, 5, 'w']]); return m;
  }
  function curveBlade(n) {
    var m = grid(6, n + 4); for (var y = 0; y < n; y++) { var x = 1 + Math.round(2.2 * Math.pow(1 - y / n, 2)); put(m, x, y, KEY.W); put(m, x + 1, y, KEY.m); if (y > 2) put(m, x + 2, y, KEY.b); }
    seg(m, [[n, 0, 'ogggo'], [n + 1, 2, 'w'], [n + 2, 2, 'w'], [n + 3, 2, 'g']]); return m;
  }
  // крупный боёк/лезвие для больших тел: прямоугольная «голова» со светотенью + рукоять
  function headM(w, h, ramp, extra, len, wood, gx) {
    var m = grid(w, h + len); bevel(m, function (x, y) { return y < h && !((x === 0 || x === w - 1) && (y === 0 || y === h - 1)); }, ramp);
    for (var i = 0; i < len; i++) { put(m, gx, h + i, KEY[wood[0]]); put(m, gx + 1, h + i, KEY[wood[1]]); }
    if (extra) extra(m); return m;
  }
  function shaft(top, len, wood) { var rows = top.slice(); for (var i = 0; i < len; i++) rows.push(wood); return parse(rows); }
  var WDEF = {
    hammer: { m: shaft(['.llllllllllllll.', 'lmWWWmmmmmmmmmbl', 'lmWmmmmmmmmmmmbl', 'lmmmmmmmmmmmmmbl', 'lbbbbbbbbbbbbbbl', 'lllllllooollllll', '......rwwr......', '.......rw.......'], 16, '.......rw.......'), g: [7, 19] },
    blade: { m: parse(['..W..', '.WWm.', '.Wmb.', '.Wmb.', '.Wmb.', '.Wmb.', '.Wmb.', '.Wmb.', '.Wmb.', '.Wmb.', '.Wmb.', '.Wmb.', '.Wmb.', 'ogggo', '.ogo.', '..w..', '..w..', '..g..']), g: [2, 16] },
    sword: { m: parse(['..W..', '.WWb.', '.Wmb.', '.Wmb.', '.Wmb.', '.Wmb.', '.Wmb.', '.Wmb.', '.Wmb.', '.Wmb.', '.Wmb.', 'ooocooo', '..w..', '..w..', '..c..']), g: [2, 13] },
    bow: { m: bowM(), g: [5, 11], tips: [[1, 0], [1, 22]] },
    spear: { m: shaft(['.W.', 'WWm', 'Wmb', 'Wmb', '.mb', '.lb', '.ll'], 28, '.rw'), g: [1, 24] },
    scimitar: { m: curveBlade(13), g: [2, 15] },
    mace: { m: headM(11, 11, 'mbl', function (m) { seg(m, [[0, 5, 'W'], [5, 0, 'm'], [5, 10, 'm'], [3, 3, 'mW'], [10, 5, 'l'], [11, 5, 'ww'], [12, 5, 'ww']]); for (var y = 2; y < 9; y += 3) for (var x = 2; x < 9; x += 3) put(m, x, y, KEY.l); }, 16, 'rw', 5), g: [5, 24] },
    mace0: { m: shaft(['m...m...m', '.l.lll.l.', '..lmmbbl.', 'mlmWbbbbl', '.lmbbbbbl', 'mlbbbbbll', '..lbbbll.', '.l.lll.l.', 'm...w...m', '....w....'], 12, '...rww...'), g: [4, 19] },
    flail: { m: shaft(['m..m.', '.lll.', 'lbmbl', 'lbbbl', '.lll.', 'm.l.m', '..l..', '..l..', '..g..'], 10, '..rw.'), g: [2, 16] },
    axe: { m: (function () { var m = grid(16, 34); for (var y = 0; y < 34; y++) { put(m, 11, y, KEY.r); put(m, 12, y, KEY.w); }
      bevel(m, function (x, y) { var c = 7.5, r = y - 8.5; return y >= 1 && y <= 16 && x >= 1 && x <= 10 && x >= 1 + Math.round(Math.abs(r) * 0.35) && x <= 10 - (Math.abs(r) > 5 ? 0 : 0) && (x - 10) * (x - 10) / 100 + r * r / 64 <= 1; }, 'Wmb');
      seg(m, [[0, 11, 'mm'], [4, 9, 'l'], [12, 9, 'l']]); return m; })(), g: [11, 26] },
    axe0: { m: shaft(['...........', '...mmW.....', '..mWWWm....', '.lbWWmb.rw.', 'lbbmmbb.rw.', 'lbbbbb..rw.', '.lbbb...rw.', '..lb....rw.'], 16, '........rw.'), g: [8, 18] },
    ram: { m: shaft(['.llllll.', 'lbmmmbbl', 'lbbbbbbl', 'lllllllll', '.rrcrrw.', '.rcrrww.'], 24, '.rrcrww.'), g: [4, 22] },
    bighammer: { m: headM(22, 11, 'lnk', function (m) { seg(m, [[5, 2, 'cooccooccoocoocooc'], [4, 3, 'r'], [6, 3, 'r'], [0, 1, 'bbbbbbbbbbbbbbbbbbbb'], [11, 9, 'kkkk'], [12, 9, 'pkkp']]); }, 22, 'pk', 10), g: [10, 30] },
    bighammer0: { m: shaft(['.kkkkkkkkkkkkkk.', 'knllllllllllllnk', 'knlcooccooccolnk', 'knllllllllllllnk', 'knnnnnnnnnnnnnnk', '.kkkkkkkkkkkkkk.'], 20, '.......pk.......'), g: [7, 20] }
  };
  var WEAP = {};
  function weapon(name) {
    if (WEAP[name]) return WEAP[name];
    var d = WDEF[name], pts = [d.g].concat(d.tips || []), out = [];
    var diag = rot45(d.m, pts);
    for (var dir = 0; dir < 8; dir++) {
      var base = dir % 2 ? diag.m : d.m, bp = dir % 2 ? diag.pts : pts, k = dir >> 1;
      var m = rotN(base, k), P = bp.map(function (p) { return rotPt(p[0], p[1], base.w, base.h, k); });
      out.push({ m: m, g: P[0], tips: P.slice(1) });
    }
    return (WEAP[name] = out);
  }
  var SHIELD = parse(['.llllllll.', 'lbmmmmmmbl', 'lmmbbbbmbl', 'lmbbbbbbbl', 'lmbbccbbbl', 'lmbcoocbbl', 'lmbcoocbbl', 'lmbbccbbbl', 'lmbbbbbbbl', 'lbbbbbbbll', '.lbbbbbbl.', '..lbbbbl..', '...llll...']);

  // ---------- Вторичные детали: коса/хвост/плюмаж (2 кадра, точка крепления — правый верх), плащи (1 кадр), полог фартука ----------
  var TAILS = {
    braid: [parse(['..og', '.ogc', '.oc.', 'ogc.', 'occ.', '.oc.', '.gc.', '.oc.', '.occ', '..oc', '..ww', '..g.']),
      parse(['..og', '.ogc', '.oc.', '.gc.', 'ogc.', 'occ.', 'oc..', 'goc.', '.occ', '.oc.', '.ww.', '.g..'])],
    pony: [parse(['....ocr', '..occr.', '.occr..', 'occr...', '.cr....', '.r.....']), parse(['....ocr', '...occr', '.occcr.', 'occr...', 'cr.....', 'r......'])],
    plume: [parse(['.....cco', '...ccooc', '.ccoocr.', 'crrcr...', '.rr.....']), parse(['......co', '...cccoc', '.ccooc..', 'ccrrcr..', 'r.r.....'])],
    hood: [parse(['.vt', 'vtn', 'tn.', 'n..']), parse(['.vt', '.tn', 'vn.', 'n..'])]
  };
  function capeM(w, h, ramp, flut) {
    var m = grid(w + 2, h);
    bevel(m, function (x, y) { if (y >= h) return false; var sh = flut ? Math.round(y * y / (h * h) * 2) : 0, a = Math.max(0, w - 2 - Math.round(y * 2 / h)) - sh, b = w + 1 - sh - (y < 2 ? 1 : 0); if (y === h - 1 && (x % 3 === 0)) return false; return x >= a && x <= b; }, ramp,
      function (x, y, v, hi, mid, sh) { return v === mid && x % 3 === 1 && y > 2 ? sh : v; });
    return m;
  }
  var FLAP = parse(['wppppppk', 'wppppppk', 'wpkppppk', '.wppppk.', '.wppppk.', '..kkkk..']);
  var FLAP2 = parse(['wppppppk', 'wppppppk', 'wppkpppk', 'wpppppk.', '.wppppk.', '.kkkk...']);

  // ---------- Тела (кадр, опора, длины костей, коэффициент поз) ----------
  var BODY = {
    std: { FW: 112, FH: 88, FX: 56, GR: 84, G: 80, hip: [56, 63], k: 1, LEN: { up: 7, fore: 7, thigh: 9, shin: 9.5 }, r: [2.1, 1.7, 2.6, 2.2] },
    wide: { FW: 112, FH: 88, FX: 56, GR: 84, G: 80, hip: [56, 63], k: 1, LEN: { up: 7, fore: 7, thigh: 9, shin: 9.5 }, r: [2.7, 2.3, 3.0, 2.6] },
    big: { FW: 144, FH: 112, FX: 72, GR: 108, G: 103, hip: [72, 80], k: 1.3, LEN: { up: 9.5, fore: 9.5, thigh: 12.5, shin: 13 }, r: [3.4, 3.0, 3.6, 3.2], big: true }
  };
  // Облики: голова, торс, рампы конечностей, кулак, сапог, оружие, щит, вторичные детали, удар по умолчанию
  var CH = {
    zhdan: { body: 'wide', upper: 'crw', fore: 'ssS', thigh: 'lnk', shin: 'lnk', hand: 'rwp', boot: 'wpk', weapon: 'hammer', flap: [FLAP, FLAP2], atk: 'swing', hero: 1 },
    secha: { body: 'std', upper: 'mbl', fore: 'ssS', thigh: 'bln', shin: 'bln', hand: 'ssS', boot: 'wpk', weapon: 'blade', twin: 1, tails: 'braid', knot: [4, 13], cape: 'rwp', atk: 'swing', hero: 1 },
    olha: { body: 'std', upper: 'vtn', fore: 'ssS', thigh: 'lnk', shin: 'lnk', hand: 'ssS', boot: 'rwp', weapon: 'bow', tails: 'hood', knot: [2, 18], cape: 'vtn', atk: 'swing', hero: 1 },
    shield: { body: 'std', upper: 'bln', fore: 'bln', thigh: 'lnk', shin: 'lnk', hand: 'bln', boot: 'pkk', weapon: 'sword', shield: 1, atk: 'swing' },
    spear: { body: 'std', upper: 'rwp', fore: 'ssS', thigh: 'lnk', shin: 'lnk', hand: 'ssS', boot: 'wpk', weapon: 'spear', atk: 'thrust' },
    raider: { body: 'std', upper: 'ssS', fore: 'ssS', thigh: 'wpk', shin: 'wpk', hand: 'ssS', boot: 'rwp', weapon: 'scimitar', tails: 'pony', knot: [7, 8], atk: 'swing' },
    brute: { body: 'big', upper: 'mbl', fore: 'mbl', thigh: 'wpk', shin: 'wpk', hand: 'mbl', boot: 'pkk', weapon: 'mace', atk: 'over' },
    voevoda: { body: 'big', upper: 'mbl', fore: 'mbl', thigh: 'lnk', shin: 'lnk', hand: 'bln', boot: 'pkk', weapon: 'axe', tails: 'plume', knot: [14, 3], cape: 'rwp', atk: 'swing', boss: 1 },
    liteyshchik: { body: 'big', upper: 'bln', fore: 'lnk', thigh: 'lnk', shin: 'lnk', hand: 'bln', boot: 'nkk', weapon: 'bighammer', cape: 'wpk', atk: 'over', boss: 1 },
    twins0: { body: 'big', upper: 'mbl', fore: 'mbl', thigh: 'wpk', shin: 'wpk', hand: 'mbl', boot: 'pkk', weapon: 'hammer', atk: 'over', boss: 1 },
    twins1: { body: 'big', upper: 'mbl', fore: 'mbl', thigh: 'lnk', shin: 'lnk', hand: 'mbl', boot: 'pkk', weapon: 'hammer', atk: 'over', boss: 1 },
    lovchiy: { body: 'std', upper: 'rwp', fore: 'ssS', thigh: 'lnk', shin: 'lnk', hand: 'rwp', boot: 'wpk', weapon: 'spear', cape: 'rwp', atk: 'over', boss: 1, rider: 1 },
    cepnik: { body: 'big', upper: 'lnk', fore: 'bln', thigh: 'lnk', shin: 'lnk', hand: 'bln', boot: 'pkk', weapon: 'flail', atk: 'swing', boss: 1 },
    stenoboy: { body: 'big', upper: 'lnk', fore: 'lnk', thigh: 'lnk', shin: 'lnk', hand: 'lnk', boot: 'nkk', weapon: 'ram', atk: 'thrust', boss: 1 }
  };
  var STORED = ['zhdan', 'secha', 'olha', 'shield', 'spear', 'raider', 'brute', 'voevoda', 'liteyshchik'];   // ключевые позы — матрицами из js/hd-poses.js
  var PARTS = {};
  function parts(key) {
    if (PARTS[key]) return PARTS[key];
    var c = CH[key], B = BODY[c.body];
    var p = { c: c, B: B, head: HEADS[key], torso: TORSO[key], hand: handOf(c.hand, B.big), boot: bootOf(c.boot, B.big),
      tails: c.tails ? TAILS[c.tails] : null, cape: c.cape ? [capeM(B.big ? 8 : 6, B.big ? 22 : 15, c.cape, 0), capeM(B.big ? 8 : 6, B.big ? 22 : 15, c.cape, 1)] : null };
    return (PARTS[key] = p);
  }

  // ---------- Рендер позы со скелета ----------
  function layer(B) { return new Uint8Array(B.FW * B.FH); }
  function stampL(L, B, p, ox, oy) { ox = Math.round(ox); oy = Math.round(oy); for (var y = 0; y < p.h; y++) for (var x = 0; x < p.w; x++) { var v = p.a[y * p.w + x], X = ox + x, Y = oy + y; if (v && X >= 0 && Y >= 0 && X < B.FW && Y < B.FH) L[Y * B.FW + X] = v; } }
  function capsuleL(L, B, A, Bp, r, ramp) { capM({ w: B.FW, h: B.FH, a: L }, A, Bp, r, ramp); }
  function comp(F, L, B, o) {
    o = o || {}; var i, x, y, W = B.FW, H = B.FH;
    if (o.edge) for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
      i = y * W + x; if (L[i] || !F[i] || F[i] === 1) continue;
      if ((x > 0 && L[i - 1]) || (x < W - 1 && L[i + 1]) || (y > 0 && L[i - W]) || (y < H - 1 && L[i + W])) F[i] = 2;
    }
    for (i = 0; i < L.length; i++) if (L[i]) F[i] = o.shade ? SHADE[L[i]] : L[i];
  }
  function ik(A, T, l1, l2, pref) {
    var dx = T[0] - A[0], dy = T[1] - A[1], d = Math.sqrt(dx * dx + dy * dy) || 0.001, max = l1 + l2 - 0.05;
    if (d > max) { T = [A[0] + dx / d * max, A[1] + dy / d * max]; dx = T[0] - A[0]; dy = T[1] - A[1]; d = max; }
    var ca = Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))), a = Math.acos(ca), ux = dx / d, uy = dy / d, best = null;
    [a, -a].forEach(function (an) { var c = Math.cos(an), s = Math.sin(an), ex = A[0] + (ux * c - uy * s) * l1, ey = A[1] + (ux * s + uy * c) * l1;
      var sc = (ex - (A[0] + T[0]) / 2) * pref[0] + (ey - (A[1] + T[1]) / 2) * pref[1]; if (!best || sc > best.sc) best = { sc: sc, p: [ex, ey] }; });
    return { mid: best.p, end: T };
  }
  function R(p) { return [Math.round(p[0]), Math.round(p[1])]; }
  function add(a, b) { return [a[0] + b[0], a[1] + b[1]]; }
  function clampLag(cur, prev, n) { if (!prev) return cur; return [cur[0] + Math.max(-n, Math.min(n, prev[0] - cur[0])), cur[1] + Math.max(-n, Math.min(n, prev[1] - cur[1]))]; }
  function wpnAt(L, B, name, dir, hand) { var W = weapon(name)[((dir % 8) + 8) % 8]; stampL(L, B, W.m, Math.round(hand[0]) - W.g[0], Math.round(hand[1]) - W.g[1]); return W; }

  // spec — абсолютные координаты кадра: { hip, lean, rot, head, face, aN/aF (кисти), lN/lF (щиколотки), ebN/ebF/kbN/kbF (куда гнуть),
  //   wa/waF — направление оружия (0…7), wBack — оружие за спиной, bow: 'F' — лук в дальней руке, draw — тетива к ближней кисти, air, noTails }
  function renderPose(spec, key, lag, tick) {
    var Pt = parts(key), C = Pt.c, B = Pt.B, J = Pt.torso.J, F = layer(B), rot = spec.rot || 0, L;
    var t0 = shear(Pt.torso.m, spec.lean || 0), tor = rotN(t0, rot);
    function tp(pt) { var m = t0.map(pt[0], pt[1]); return rotPt(m[0], m[1], t0.w, t0.h, rot); }
    var hipL = tp(J.hip), org = [spec.hip[0] - hipL[0], spec.hip[1] - hipL[1]];
    function TP(pt) { var q = tp(pt); return [org[0] + q[0], org[1] + q[1]]; }
    var head = rotN(Pt.head[spec.face || 'n'], rot), hn = rotPt(HNECK[0], HNECK[1], HW, HH, rot);
    var neck = add(TP(J.neck), rot === 3 ? [0, 0] : [0, 1]), hOrg = add([neck[0] - hn[0], neck[1] - hn[1]], spec.head || [0, 0]);
    function HP(pt) { var q = rotPt(pt[0], pt[1], HW, HH, rot); return [hOrg[0] + q[0], hOrg[1] + q[1]]; }
    var anchors = { knot: C.knot ? HP(C.knot) : null, belt: TP(J.belt), cape: TP(J.cape) };
    var LEN = B.LEN, rr = B.r, lowBoot = -1;
    var nearW = C.weapon && !(spec.bow === 'F') ? C.weapon : null, farW = C.twin ? C.weapon : (spec.bow === 'F' ? 'bow' : null), bowW = null;
    function arm(sh, hand, eb, shade, edge, wname, wdir, wFirst) {
      var s = ik(sh, hand, LEN.up, LEN.fore, eb || [0.3, 1]); L = layer(B);
      capsuleL(L, B, sh, s.mid, rr[0], C.upper); capsuleL(L, B, s.mid, s.end, rr[1], C.fore);
      var W = null; if (wname && !wFirst) W = wpnAt(L, B, wname, wdir, s.end);
      var dir = [s.end[0] - s.mid[0], s.end[1] - s.mid[1]], hp = Pt.hand; if (dir[0] < -0.5) hp = flipX(hp);
      var e = R(s.end); stampL(L, B, hp, e[0] - (hp.w >> 1) + (dir[0] < -0.5 ? -1 : 1), e[1] - (hp.h >> 1));
      comp(F, L, B, { shade: shade, edge: edge });
      return { end: s.end, W: W };
    }
    function leg(hp, foot, kb, brot, shade, edge) {
      var s = ik(hp, foot, LEN.thigh, LEN.shin, kb || [1, 0]); L = layer(B);
      capsuleL(L, B, hp, s.mid, rr[2], C.thigh); capsuleL(L, B, s.mid, s.end, rr[3], C.shin);
      var bt = rotN(Pt.boot, brot || 0), a = rotPt(3, 0, Pt.boot.w, Pt.boot.h, brot || 0), e = R(s.end); stampL(L, B, bt, e[0] - a[0], e[1] - a[1]);
      if (!brot) lowBoot = Math.max(lowBoot, e[1] - a[1] + bt.h - 1);
      comp(F, L, B, { shade: shade, edge: edge });
    }
    var waN = spec.wa == null ? 1 : spec.wa, waF = spec.waF == null ? waN : spec.waF;
    // 1) плащ и коса/хвост (позади всего)
    if (Pt.cape && !rot && !spec.noCape) { var cp = Pt.cape[(tick || 0) & 1], ca = R(clampLag(anchors.cape, lag && lag.cape, 2)); L = layer(B); stampL(L, B, cp, ca[0] - cp.w + 2, ca[1]); comp(F, L, B, {}); }
    if (Pt.tails && !spec.noTails) { var tl = Pt.tails[(tick || 0) & 1], tk = R(clampLag(anchors.knot, lag && lag.knot, 2)); L = layer(B); stampL(L, B, tl, tk[0] - tl.w + 1, tk[1] - 1); comp(F, L, B, {}); }
    // 2) дальняя рука (+ второй клинок / лук), 3) оружие «за спиной», 4) ноги, 5) торс, 6) полог, 7) щит, 8) голова, 9) ближняя рука с оружием
    var farArm = null;
    if (spec.aF) farArm = arm(TP(J.sF), spec.aF, spec.ebF, true, false, farW, spec.bow === 'F' ? 0 : waF, false);
    if (farArm && spec.bow === 'F') bowW = farArm.W;
    if (nearW && spec.wBack && spec.aN) { L = layer(B); var sN = ik(TP(J.sN), spec.aN, LEN.up, LEN.fore, spec.ebN || [0.3, 1]); wpnAt(L, B, nearW, waN, sN.end); comp(F, L, B, {}); }
    leg(TP(J.hF), spec.lF, spec.kbF, spec.bootF, true, false);
    leg(TP(J.hN), spec.lN, spec.kbN, spec.bootN, false, false);
    L = layer(B); stampL(L, B, tor, org[0], org[1]); comp(F, L, B, {});
    if (C.flap && !rot) { var fl = C.flap[(tick || 0) & 1], bp = R(clampLag(anchors.belt, lag && lag.belt, 2)); L = layer(B); stampL(L, B, fl, bp[0] - (fl.w >> 1) + 4, bp[1] + 1); comp(F, L, B, {}); }
    if (C.shield && spec.aF) { var shm = rotN(SHIELD, rot), fe = R(farArm.end); L = layer(B); stampL(L, B, shm, fe[0] - (shm.w >> 1) + 1, fe[1] - (shm.h >> 1)); comp(F, L, B, {}); }
    if (spec.aN && spec.armBehind) arm(TP(J.sN), spec.aN, spec.ebN, false, true, spec.wBack ? null : nearW, waN, false);
    L = layer(B); stampL(L, B, head, hOrg[0], hOrg[1]); comp(F, L, B, { edge: true });
    var nearArm = null;
    if (spec.aN && !spec.armBehind) nearArm = arm(TP(J.sN), spec.aN, spec.ebN, false, true, spec.wBack ? null : nearW, waN, false);
    // тетива лука: от концов к ближней кисти (натянута) или прямо
    if (bowW && bowW.tips.length === 2) {
      var fe2 = R(farArm.end), t1 = [fe2[0] - bowW.g[0] + bowW.tips[0][0], fe2[1] - bowW.g[1] + bowW.tips[0][1]], t2 = [fe2[0] - bowW.g[0] + bowW.tips[1][0], fe2[1] - bowW.g[1] + bowW.tips[1][1]];
      var FF = { w: B.FW, h: B.FH, a: F };
      if (spec.draw && nearArm) { lineM(FF, t1, nearArm.end, KEY.m); lineM(FF, t2, nearArm.end, KEY.m); } else lineM(FF, t1, t2, KEY.m);
    }
    // опора: в наземных позах подошва — ряд GR (если IK не дотянулся, кадр «садится»)
    if (!spec.air && lowBoot >= 0) { var dy = B.GR - lowBoot; if (dy > 0 && dy < 7) { F.copyWithin(dy * B.FW, 0, F.length - dy * B.FW); F.fill(0, 0, dy * B.FW); ['knot', 'belt', 'cape'].forEach(function (k) { if (anchors[k]) anchors[k] = [anchors[k][0], anchors[k][1] + dy]; }); } }
    return { f: outline({ w: B.FW, h: B.FH, a: F }), anchors: anchors };
  }

  // ---------- Библиотека поз (относительно: кисти и бедро — от бедра, стопы — от точки опоры; ×k у больших тел) ----------
  var POSE = {
    idle0: { hip: [0, 0], lean: 0.05, aN: [3, -7], wa: 1, aF: [8, -9], lN: [-5, 0], lF: [6, 0] },
    idle1: { hip: [0, 1], lean: 0.05, aN: [3, -6], wa: 1, aF: [8, -8], lN: [-5, 0], lF: [6, 0] },
    swing_w: { hip: [-1, 0], lean: -0.15, face: 'a', aN: [-9, -14], wa: 7, wBack: 1, aF: [5, -9], waF: 6, lN: [-6, 0], lF: [6, 0] },
    swing_a: { hip: [2, 0], lean: 0.25, face: 'a', aN: [12, -9], wa: 2, aF: [-1, -6], waF: 4, lN: [-7, 0], lF: [9, 0] },
    swing_r: { hip: [1, 0], lean: 0.12, face: 'a', aN: [9, -5], wa: 3, aF: [4, -8], waF: 1, lN: [-6, 0], lF: [8, 0] },
    swing2_w: { hip: [0, 1], lean: 0.05, face: 'a', aN: [6, -1], wa: 4, aF: [-6, -9], waF: 7, lN: [-6, 0], lF: [7, 0] },
    swing2_a: { hip: [2, 0], lean: 0.2, face: 'a', aN: [10, -16], wa: 1, aF: [12, -12], waF: 1, lN: [-7, 0], lF: [9, 0] },
    swing2_r: { hip: [1, 0], lean: 0.1, face: 'a', aN: [8, -11], wa: 1, aF: [9, -10], waF: 2, lN: [-6, 0], lF: [8, 0] },
    over_w: { hip: [-1, 1], lean: -0.2, face: 'a', aN: [-3, -23], wa: 6, wBack: 1, aF: [0, -22], waF: 7, lN: [-6, 0], lF: [7, 0] },
    over_a: { hip: [3, 3], lean: 0.35, face: 'a', aN: [12, -7], wa: 3, aF: [11, -8], waF: 3, lN: [-8, 0], lF: [10, 0] },
    over_r: { hip: [2, 2], lean: 0.2, face: 'a', aN: [11, -3], wa: 4, aF: [9, -5], waF: 3, lN: [-7, 0], lF: [9, 0] },
    thrust_w: { hip: [-2, 0], lean: -0.1, face: 'a', aN: [-5, -8], wa: 2, aF: [3, -9], lN: [-6, 0], lF: [6, 0] },
    thrust_a: { hip: [3, 0], lean: 0.22, face: 'a', aN: [9, -9], wa: 2, aF: [14, -9], lN: [-8, 0], lF: [10, 0] },
    thrust_r: { hip: [1, 0], lean: 0.1, face: 'a', aN: [3, -8], wa: 2, aF: [8, -9], lN: [-6, 0], lF: [8, 0] },
    shoot_w: { hip: [-1, 0], lean: -0.05, face: 'a', aF: [12, -11], bow: 'F', draw: 1, aN: [-2, -10], lN: [-6, 0], lF: [7, 0] },
    shoot_a: { hip: [-1, 0], lean: -0.05, face: 'a', aF: [12, -11], bow: 'F', aN: [5, -10], lN: [-6, 0], lF: [7, 0] },
    shoot_r: { hip: [0, 0], lean: 0, face: 'n', aF: [10, -9], bow: 'F', aN: [3, -8], lN: [-6, 0], lF: [7, 0] },
    dash_w: { hip: [-1, 2], lean: 0.1, face: 'a', aN: [-4, -8], wa: 2, aF: [5, -8], lN: [-8, 0], lF: [6, 0] },
    dash_a: { hip: [4, 1], lean: 0.45, face: 'a', aN: [14, -8], wa: 2, aF: [-3, -7], waF: 6, lN: [-11, 0], lF: [10, -1] },
    back_w: { hip: [0, 2], lean: 0, face: 'a', aN: [-9, -8], wa: 6, aF: [8, -8], waF: 2, lN: [-6, 0], lF: [6, 0] },
    back_a: { hip: [0, 2], lean: 0, face: 'a', aN: [-14, -10], wa: 6, aF: [14, -10], waF: 2, lN: [-8, 0], lF: [8, 0] },
    jump0: { air: 1, hip: [0, -4], lean: 0.05, aN: [5, -11], wa: 1, aF: [10, -12], lN: [3, -9], kbN: [1, -0.3], lF: [-4, -7], kbF: [1, -0.3] },
    jump1: { air: 1, hip: [0, -3], lean: 0, aN: [2, -15], wa: 0, aF: [8, -16], lN: [3, -3], lF: [-3, -2] },
    air: { air: 1, hip: [0, -4], lean: 0.2, face: 'a', aN: [13, -8], wa: 3, aF: [-4, -10], waF: 7, lN: [9, -6], lF: [-3, -8], kbF: [1, -0.5] },
    hurt: { hip: [-2, 0], lean: -0.35, face: 'h', head: [-1, 0], aN: [-8, -6], wa: 5, ebN: [1, 1], aF: [4, -2], waF: 4, lN: [-4, 0], lF: [6, 0] },
    fall0: { air: 1, noCape: 1, hip: [4, 3], lean: -0.8, face: 'h', aN: [-10, -22], ebN: [-1, 0], wa: 6, aF: [-2, -24], ebF: [-1, 0], waF: 6, armBehind: 1, lN: [18, -8], kbN: [0, -1], lF: [14, -3], kbF: [0, -1] },
    fall1: { air: 1, hip: [12, 3], rot: 3, head: [0, -6], face: 'h', aN: [4, -15], ebN: [-1, 0], wa: 6, aF: [10, -13], ebF: [-1, 0], waF: 6, lN: [29, -22], kbN: [0, -1], lF: [26, -18], kbF: [0, -1], bootN: 3, bootF: 3, noTails: 1 },
    down: { hip: [12, 13], rot: 3, head: [0, -6], face: 'h', aN: [12, 18], ebN: [0, 1], wa: 2, aF: [4, 6], ebF: [-1, 0], waF: 2, lN: [30, 0], kbN: [0, -1], lF: [26, 0], kbF: [0, -1], noTails: 1 },
    rise0: { hip: [0, 15], lean: -0.35, face: 'n', lN: [17, 0], kbN: [0, -1], lF: [14, 0], kbF: [0, -1], aN: [-9, 15], ebN: [-1, 0], wa: 2, aF: [-4, 13], waF: 2 },
    rise1: { hip: [0, 8], lean: 0.25, face: 'n', lN: [8, 0], lF: [-9, 0], kbF: [0.4, 1], aN: [7, 3], wa: 1, aF: [12, 1] },
    grab: { hip: [1, 0], lean: 0.08, face: 'a', aN: [11, -10], wa: 4, aF: [13, -9], waF: 0, lN: [-6, 0], lF: [7, 0] },
    grabk: { hip: [0, -1], lean: 0.15, face: 'a', aN: [11, -10], wa: 4, aF: [13, -9], waF: 0, lN: [7, -9], kbN: [1, 0], lF: [-2, 0] },
    toss: { hip: [-1, 0], lean: -0.25, face: 'a', aN: [-5, -24], wa: 0, aF: [-1, -24], waF: 0, lN: [-7, 0], lF: [7, 0] },
    cast: { hip: [0, -1], lean: -0.05, face: 'a', aN: [-5, -24], wa: 0, aF: [7, -24], waF: 0, lN: [-6, 0], lF: [6, 0] },
    ride: { air: 1, hip: [0, 0], lean: 0.1, aN: [8, -6], wa: 1, aF: [11, -7], lN: [7, -6], kbN: [1, -0.6], lF: [4, -7], kbF: [1, -0.6] },
    ride_w: { air: 1, hip: [-1, 0], lean: -0.05, face: 'a', aN: [-6, -16], wa: 7, wBack: 1, aF: [11, -7], lN: [7, -6], kbN: [1, -0.6], lF: [4, -7], kbF: [1, -0.6] },
    ride_a: { air: 1, hip: [1, 0], lean: 0.2, face: 'a', aN: [13, -8], wa: 2, aF: [9, -6], lN: [7, -6], kbN: [1, -0.6], lF: [4, -7], kbF: [1, -0.6] },
    guard: { hip: [-1, 1], lean: -0.1, face: 'a', aF: [9, -12], aN: [2, -6], wa: 1, lN: [-6, 0], lF: [6, 0] },
    crouch: { hip: [0, 6], lean: 0.3, face: 'a', aN: [6, -4], wa: 2, aF: [9, -5], lN: [-6, 0], lF: [7, 0] },
    grabbed: { hip: [0, 1], lean: -0.25, face: 'h', head: [0, -1], aN: [-6, -2], wa: 4, aF: [2, 0], waF: 4, lN: [-3, 0], lF: [4, 0] },
    slam_w: { hip: [-1, 0], lean: -0.15, face: 'a', aN: [-2, -24], wa: 7, wBack: 1, aF: [1, -24], lN: [-7, 0], lF: [7, 0] },
    slam_a: { hip: [3, 5], lean: 0.4, face: 'a', aN: [12, -1], wa: 3, aF: [11, -2], lN: [-9, 0], lF: [10, 0] }
  };
  // ходьба: 6 кадров [бедро dy, ближняя стопа dx,dy, дальняя стопа dx,dy, мах рук]; бег — шире шаг, наклон, руки работают
  var WALK = [[0, 7, 0, -7, -1, 0], [1, 4, 0, -5, -2, 1], [-1, 0, 0, 1, -4, 1], [0, -7, -1, 7, 0, 0], [1, -5, -2, 4, 0, -1], [-1, 1, -4, 0, 0, -1]];
  WALK.forEach(function (w, i) {
    POSE['walk' + i] = { hip: [0, w[0]], lean: 0.1, lN: [w[1], w[2]], lF: [w[3], w[4]], aN: [3 - w[5] * 2, -6 + w[0]], wa: 1, aF: [9 + w[5] * 2, -8 + w[0]] };
    POSE['run' + i] = { hip: [1, w[0] - 1], lean: 0.28, lN: [Math.round(w[1] * 1.6), w[2] * 1.5], lF: [Math.round(w[3] * 1.6), w[4] * 1.5], aN: [4 - w[5] * 5, -7 + w[0]], wa: 2, aF: [9 + w[5] * 5, -9 + w[0]] };
  });
  // особые позы под оружие/облик
  var OVER = {
    olha: { swing2_w: { aN: [7, -2], wa: 3 }, swing2_a: { aN: [11, -15], wa: 1 } },
    secha: { idle0: { waF: 1, wa: 2 }, idle1: { waF: 1, wa: 2 } },
    spear: { idle0: { wa: 0 }, idle1: { wa: 0 } },
    lovchiy: { idle0: { wa: 0 }, idle1: { wa: 0 } },
    stenoboy: { idle0: { wa: 2, aN: [0, -7], aF: [6, -8] }, idle1: { wa: 2, aN: [0, -6], aF: [6, -7] } }
  };
  var PREV = { swing_a: 'swing_w', swing_r: 'swing_a', swing2_a: 'swing2_w', swing2_r: 'swing2_a', over_a: 'over_w', over_r: 'over_a', thrust_a: 'thrust_w', thrust_r: 'thrust_a',
    shoot_a: 'shoot_w', shoot_r: 'shoot_a', dash_a: 'dash_w', back_a: 'back_w', jump1: 'jump0', air: 'jump0', fall0: 'hurt', fall1: 'fall0', down: 'fall1', rise0: 'down', rise1: 'rise0',
    grabk: 'grab', toss: 'grab', ride_w: 'ride', ride_a: 'ride_w', grabbed: 'hurt', slam_a: 'slam_w', idle1: 'idle0', idle0: 'idle1' };
  for (var wi = 0; wi < 6; wi++) { PREV['walk' + wi] = 'walk' + ((wi + 5) % 6); PREV['run' + wi] = 'run' + ((wi + 5) % 6); }

  function atkList(a) { return [a + '_w', a + '_a', a + '_r']; }
  var CYCLE = ['idle0', 'idle1', 'walk0', 'walk1', 'walk2', 'walk3', 'walk4', 'walk5'];
  function keyPoses(key) {
    var c = CH[key];
    if (c.hero) return atkList('swing').concat(atkList('swing2'), atkList('over'), key === 'olha' ? atkList('shoot') : [], ['dash_w', 'dash_a', 'back_w', 'back_a', 'jump0', 'jump1', 'air', 'hurt', 'fall0', 'fall1', 'down', 'rise0', 'rise1', 'grab', 'grabk', 'toss', 'cast', 'ride', 'ride_w', 'ride_a']);
    if (c.boss) return atkList(c.atk).concat(['crouch', 'dash_a', 'slam_w', 'slam_a', 'back_w', 'back_a', 'cast', 'hurt', 'fall0', 'fall1', 'down', 'rise0', 'rise1'], c.rider ? ['ride', 'ride_w', 'ride_a'] : []);
    return atkList(c.atk).concat(['crouch', 'air', 'guard', 'hurt', 'grabbed', 'fall0', 'fall1', 'down', 'rise0', 'rise1', 'ride', 'ride_w', 'ride_a']);
  }
  function cycles(key) { return CYCLE.concat(CH[key].hero ? ['run0', 'run1', 'run2', 'run3', 'run4', 'run5'] : []); }
  function specFor(key, name) {
    var B = parts(key).B, k = B.k, r = Object.assign({}, POSE[name], (OVER[key] || {})[name] || {}), s = {};
    Object.keys(r).forEach(function (f) { s[f] = r[f]; });
    function rel(v) { return [B.hip[0] + v[0] * k, B.hip[1] + v[1] * k]; }
    s.hip = rel(r.hip || [0, 0]); if (r.aN) s.aN = rel(r.aN); if (r.aF) s.aF = rel(r.aF);
    s.lN = [B.FX + r.lN[0] * k, B.G + r.lN[1] * k]; s.lF = [B.FX + r.lF[0] * k, B.G + r.lF[1] * k];
    if (r.head) s.head = [Math.round(r.head[0] * k), Math.round(r.head[1] * k)];
    return s;
  }
  // набор: кадры по позам + отставание вторичных деталей по цепочке PREV (полог/плащ — на 1 кадр, коса — на 2)
  function renderSet(key, names) {
    var anc = {}, out = {}, i = 0, all = names.slice();
    names.forEach(function (n) { var p = PREV[n]; if (p && all.indexOf(p) < 0) all.push(p); var p2 = p && PREV[p]; if (p2 && all.indexOf(p2) < 0) all.push(p2); });
    all.forEach(function (n) { anc[n] = renderPose(specFor(key, n), key, null, 0).anchors; });
    names.forEach(function (n) {
      var p = PREV[n], p2 = p && PREV[p], lag = { belt: p && anc[p].belt, cape: p && anc[p].cape, knot: p2 && anc[p2].knot };
      out[n] = renderPose(specFor(key, n), key, lag, i++).f;
    });
    return out;
  }

  // ---------- Ключевые позы из js/hd-poses.js ----------
  function POSES() { return (global.DRUZHINA && global.DRUZHINA.HD_POSES) || null; }
  function unpack(key, m) {
    var B = parts(key).B, rows = m.rows.map(unrle), p = parse(rows), f = grid(B.FW, B.FH);
    for (var y = 0; y < p.h; y++) for (var x = 0; x < p.w; x++) { var v = p.a[y * p.w + x]; if (v) put(f, x + m.ox, y + m.oy, v); }
    return f;
  }
  var SETS = {};
  function frames(key) {
    if (SETS[key]) return SETS[key];
    var out = renderSet(key, cycles(key)), kp = keyPoses(key), st = POSES(), have = st && st[key];
    var miss = kp.filter(function (n) { return !(have && have[n]); });
    if (miss.length) { var r = renderSet(key, miss); Object.keys(r).forEach(function (n) { out[n] = r[n]; }); }
    if (have) kp.forEach(function (n) { if (have[n]) out[n] = unpack(key, have[n]); });
    var B = parts(key).B;
    return (SETS[key] = { f: out, B: B, stored: !!have });
  }
  function crop(f) {   // для запекания: обрезка по рамке
    var x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
    for (var y = 0; y < f.h; y++) for (var x = 0; x < f.w; x++) if (f.a[y * f.w + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return { ox: 0, oy: 0, rows: ['.'] };
    return { ox: x0, oy: y0, rows: toRows(f).slice(y0, y1 + 1).map(function (r) { return r.slice(x0, x1 + 1); }) };
  }
  function height(f) { var y0 = -1, y1 = -1; for (var y = 0; y < f.h; y++) for (var x = 0; x < f.w; x++) if (f.a[y * f.w + x]) { if (y0 < 0) y0 = y; y1 = y; } return y0 < 0 ? 0 : y1 - y0 + 1; }

  // ---------- Звери: хвостобой (мох, булава на хвосте) и огнеящер (медь, пасть); кадр 128×64, опора (64, 61) ----------
  var BEASTS = {};
  function beastFrame(type, ph, att, big) {
    var k = big ? 1.3 : 1, W = Math.round(128 * k), H = Math.round(66 * k), m = grid(W, H), TAU = Math.PI * 2;
    function P(x, y) { return [x * k, y * k]; }
    var body = type === 'fire' ? 'crw' : 'vtn', belly = type === 'fire' ? 'goc' : 'gov', spine = type === 'fire' ? KEY.g : KEY.c, legR = type === 'fire' ? 'rwp' : 'tnk';
    var s = Math.sin(ph * TAU), lift = function (q) { return Math.max(0, Math.cos(q * TAU)) * 3; };
    var L = grid(W, H);
    function leg(hx, hy, q, shade) {
      var sq = Math.sin(q * TAU), hip = P(hx, hy), foot = P(hx + 6 * sq, 61 - lift(q)), knee = P(hx + 4 + 3 * sq, hy + 8);
      var T = grid(W, H); capM(T, hip, knee, 3.2 * k, legR); capM(T, knee, foot, 2.4 * k, legR);
      seg(T, [[Math.round(foot[1]) + 1, Math.round(foot[0] - 2), 'kkkkk']]);
      for (var i = 0; i < T.a.length; i++) if (T.a[i]) m.a[i] = shade ? SHADE[T.a[i]] : T.a[i];
    }
    leg(78, 42, ph + 0.5, true); leg(46, 42, ph, true);
    // хвост
    var tailUp = att === 'w' ? -12 : att === 'a' ? -2 : 0, tailLen = att === 'a' ? 6.6 : 5.6, pts = [];
    for (var i = 0; i <= 7; i++) pts.push(P(40 - i * tailLen, 38 - i * 1.0 + (i / 7) * tailUp * (i / 7) + Math.sin(ph * TAU + i * 0.8) * 1.4 * (i / 7)));
    for (var j = 0; j < 7; j++) capM(m, pts[j], pts[j + 1], (5.2 - j * 0.6) * k, body);
    if (type === 'tail') { var e = pts[7]; ellM(m, e[0], e[1], 4 * k, 3.5 * k, 'mbl'); seg(m, [[Math.round(e[1] - 4 * k), Math.round(e[0]), 'm'], [Math.round(e[1] + 4 * k), Math.round(e[0]), 'm'], [Math.round(e[1]), Math.round(e[0] - 5 * k), 'm']]); }
    // тело, брюхо
    var bob = Math.round(Math.abs(s) * k);
    ellM(m, 62 * k, 38 * k + bob, 25 * k, 10.5 * k, body);
    ellM(m, 62 * k, 41 * k + bob, 20 * k, 6.5 * k, belly, function (x, y) { return y > 40 * k + bob; });
    // гребень
    for (var x = 44; x <= 78; x += 5) { var yy = Math.round(28 * k + bob - 1 + Math.abs(x - 62) * 0.12 * k); put(m, x * k, yy, spine); put(m, x * k + 1, yy, spine); put(m, x * k, yy - 1, spine); }
    // шея и голова
    var open = type === 'fire' && att === 'a', hb = att === 'w' ? -2 : 0;
    capM(m, P(80, 35 + bob / k), P(90, 29 + hb), 5.5 * k, body);
    ellM(m, 96 * k, (27 + hb) * k, 9 * k, 5.5 * k, body);
    ellM(m, 103 * k, (28 + hb) * k, 5 * k, 3.6 * k, body);
    ellM(m, 99 * k, (32 + hb + (open ? 3 : 0)) * k, 7 * k, 2.4 * k, belly);
    if (open) { for (var q = 0; q < 9; q++) put(m, (93 + q) * k, (30 + hb) * k + 1, KEY.w); seg(m, [[Math.round((31 + hb) * k), Math.round(96 * k), 'W.W.W']]); }
    else seg(m, [[Math.round((30 + hb) * k), Math.round(94 * k), 'pppppppp']]);
    seg(m, [[Math.round((24 + hb) * k), Math.round(97 * k), 'gk'], [Math.round((23 + hb) * k), Math.round(96 * k), 'kk'], [Math.round((26 + hb) * k), Math.round(106 * k), 'k']]);
    if (type === 'tail') seg(m, [[Math.round((21 + hb) * k), Math.round(90 * k), 'cc'], [Math.round((20 + hb) * k), Math.round(89 * k), 'c']]);
    else seg(m, [[Math.round((21 + hb) * k), Math.round(90 * k), 'gg'], [Math.round((20 + hb) * k), Math.round(88 * k), 'gg'], [Math.round((19 + hb) * k), Math.round(87 * k), 'g']]);
    leg(74, 43, ph, false); leg(50, 43, ph + 0.5, false);
    // седло
    var sx = Math.round(56 * k), sy = Math.round(26 * k) + bob;
    seg(m, [[sy, sx, 'rrrrrrrrrrrr'], [sy + 1, sx - 1, 'gwwwwwwwwwwwwg'], [sy + 2, sx, 'wwwwwwwwwwww'], [sy + 3, sx + 1, 'pppppppppp']]);
    for (var y2 = sy + 4; y2 < sy + 14; y2++) put(m, sx + 6, y2, KEY.p);
    return { f: outline(m), saddle: [sx + 6, sy], W: W, H: H, X: Math.round(64 * k), GR: Math.round(62 * k) };
  }
  function beast(type, big) {
    var key = type + (big ? 'B' : ''); if (BEASTS[key]) return BEASTS[key];
    var o = { walk: [], idle: null, w: null, a: null };
    for (var i = 0; i < 6; i++) o.walk.push(beastFrame(type, i / 6, '', big));
    o.idle = beastFrame(type, 0.25, '', big); o.w = beastFrame(type, 0.25, 'w', big); o.a = beastFrame(type, 0.25, 'a', big);
    return (BEASTS[key] = o);
  }

  // ---------- Бес-кладовик: рожки, глаза-латунь, мешок с кувшинами; кадр 44×40, опора (22, 38) ----------
  var IMPS = {};
  function imp(i, bags) {
    var key = i + '|' + (bags > 1 ? 1 : 0); if (IMPS[key]) return IMPS[key];
    var m = grid(44, 40), q = i / 6 * Math.PI * 2, s = Math.sin(q), bob = -Math.round(Math.abs(s) * 2), big = bags > 1 ? 1.5 : 0;
    capM(m, [21, 28 + bob], [21 - 4 * s, 37], 1.8, 'wpk');
    ellM(m, 13, 21 + bob, 6 + big, 7 + big, 'ocr'); seg(m, [[14 + bob - Math.round(big), 17, 'ww'], [13 + bob - Math.round(big), 18, 'w']]);
    capM(m, [23, 28 + bob], [23 + 4 * s, 37], 1.8, 'rwp');
    ellM(m, 22, 24 + bob, 5, 5, 'rwp');
    capM(m, [24, 21 + bob], [29 + 2 * s, 25 + bob], 1.4, 'rwp');
    ellM(m, 25, 13 + bob, 7, 6, 'crw');
    seg(m, [[6 + bob, 20, 'g'], [5 + bob, 19, 'g'], [4 + bob, 19, 'o'], [6 + bob, 28, 'g'], [5 + bob, 29, 'g'], [4 + bob, 29, 'o'],
      [12 + bob, 26, 'gk'], [12 + bob, 29, 'gk'], [11 + bob, 26, 'g'], [16 + bob, 25, 'WkWkW'], [14 + bob, 31, 'w']]);
    return (IMPS[key] = outline(m));
  }
  // ---------- Предметы ----------
  var ITEMS = {
    jug: outline(parse(['...r...', '..lrl..', '..bmb..', '.lbbbl.', 'lbWmbbl', 'lbmbbbl', 'lbbbbbl', 'lbbbbll', '.lbbbl.', '..lll..'])),
    bread: outline(parse(['...oooo...', '.oogogooo.', 'oogoogoooc', 'occocccocr', 'rcccccccrr', '.rrrrrrrr.'])),
    pie: outline(parse(['..oooooo..', '.ogoroogo.', 'oooororoco', 'cooooooccr', 'gggggggggg', '.rrrrrrrr.']))
  };

  var api = { PAL: PAL, KEY: KEY, CHR: CHR, SHADE: SHADE, LIT: LIT, CH: CH, BODY: BODY, STORED: STORED, POSE: POSE, PREV: PREV, HEADS: HEADS,
    parse: parse, toRows: toRows, seg: seg, rle: rle, unrle: unrle, rotN: rotN, outline: outline, weapon: weapon,
    parts: parts, renderPose: renderPose, renderSet: renderSet, specFor: specFor, keyPoses: keyPoses, cycles: cycles, frames: frames, crop: crop, height: height,
    beast: beast, imp: imp, ITEMS: ITEMS, HW: HW, HH: HH };
  var D = global.DRUZHINA = global.DRUZHINA || {};
  D.hdSprites = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
