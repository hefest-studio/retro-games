/* ГОРНОВАЯ УЛИЦА · спрайты как матрицы индексов палитры.
   Формат: каждая деталь — массив строк одинаковой длины, один символ = один пиксель, '.' — прозрачный.
   Символ → индекс общей палитры (≤16 цветов на весь прототип, см. PAL/KEY). Кадр собирается из деталей
   со сдвигами (кукла из вырезок, без поворотов на дробный угол: только целые сдвиги, зеркало и поворот на 90°),
   затем движок кадра добавляет СЕЛЕКТИВНЫЙ контур: снизу/справа/в тени — чернила, сверху/слева (свет) —
   на ступень темнее цвета соседнего пикселя (из рампы этого же материала). Без сглаживания, без дробного масштаба.
   Модуль UMD: работает в браузере (window.HB.sprites) и в Node (превью/тесты). */
(function (global) {
  'use strict';

  // ---------- Палитра (16 цветов на весь прототип: персонажи, фон, частицы) ----------
  // Рампы со сдвигом оттенка: тени уходят в холод/лиловый, света — в тёплый/жёлтый.
  var PAL = [
    null,       // 0 прозрачный (не считается)
    '#141013',  // 1 k  чернила (контур, самая глубокая тень)
    '#2e1f30',  // 2 p  слива (тень второго тона, сапоги, внутренний контур)
    '#563043',  // 3 w  вино (глубокая тень кожи/меди, светлый контур)
    '#8f4536',  // 4 r  ржа (тень меди/кожи)
    '#c96a3a',  // 5 c  медь (основной тон кожаного фартука, волос в тени)
    '#f0a050',  // 6 o  рыжий (волосы, свет меди)
    '#ffe08a',  // 7 g  латунь-золото (блики, пряжки, искры)
    '#fff6e6',  // 8 W  белый тёплый (блик глаза, вспышка удара, пар в свету)
    '#f2b58e',  // 9 s  кожа
    '#c27566',  // 10 S кожа в тени (сдвиг к розовому)
    '#1b1d33',  // 11 n ночь (небо, глубокая тень ткани)
    '#2f3a5c',  // 12 l сланец (штаны, дальние цеха)
    '#4f6b8f',  // 13 b сталь (свет штанов, стёкла очков, средний план)
    '#92b4c8',  // 14 m пар (пар, блики стекла)
    '#2f5e55',  // 15 t патина тёмная (рубаха в тени)
    '#5f9c7c'   // 16 v патина светлая (рубаха)
  ];
  var KEY = { '.': 0, k: 1, p: 2, w: 3, r: 4, c: 5, o: 6, g: 7, W: 8, s: 9, S: 10, n: 11, l: 12, b: 13, m: 14, t: 15, v: 16 };
  // Цвет контура на освещённой стороне (сверху/слева): на ступень темнее материала соседнего пикселя.
  var LIT = [0, 1, 1, 2, 3, 4, 4, 5, 14, 10, 3, 1, 11, 12, 13, 2, 15];

  // ---------- Детали (смотрят вправо). Свет — сверху-слева. ----------
  var P = {};
  // ГЕРОЙ — подмастерье Искрен. Голова 20×18: рыжие вихры назад, очки-консервы на лбу (латунь, сталь).
  P.head = [
    '......o....o........',
    '.....oo...ooo.......',
    '..o.oooo.oogoo......',
    '..oooogoooggooo.....',
    '.cooooooooooooooo...',
    'ccccoooooooooooooo..',
    '.rccoooooggggooooo..',
    'rrcclllllgbmbbglooo.',
    '.rccocclgbbbbbgocooo',
    'rrccoccsslggggsoco..',
    '.rcccosssssssrrsso..',
    '..rcSssssssssskWsc..',
    '..rrSssssssssskkss..',
    '...rSSsssssssskksss.',
    '....SSsssssssssssS..',
    '.....SSssssssSSsS...',
    '......SSSsssssss....',
    '........SSSSS.......'
  ];
  // Туловище 14×13: рубаха цвета патины, кожаный фартук с нагрудником, ремень с латунной пряжкой.
  P.torso = [
    '...tvvvvvvt...',
    '..tvvvvvvvvvt.',
    '.tvvvvrrrrvvvt',
    'tvvvvrcoccrvvt',
    'ttvvrcoccccrvt',
    'ttvvrcccccrvtt',
    'tttvrcccccrttt',
    '.ttrcccccccrt.',
    '..llllggllll..',
    '..rcocccccrr..',
    '..rcccccccrr..',
    '..rrcccccrrr..',
    '...rrrrrrrr...'
  ];
  // Руки: рукав, предплечье, толстая кузнечная рукавица.
  P.armDown = [
    'tvv.',
    'tvvt',
    'tvvt',
    'Sss.',
    'Sss.',
    'Sss.',
    'rcc.',
    'rcoc',
    'rccc',
    'wrr.'
  ];
  P.armPunch = [
    'tvv.......rc.',
    'tvvvSsssrcocc',
    'tvvvSsssrcccc',
    '.tt.SSSSrcccc',
    '.........wrr.'
  ];
  P.armWind = [
    'tvv...',
    'tvvt..',
    'tvSss.',
    '.SSssr',
    '..rcco',
    '..rccc',
    '..wrrc',
    '...rr.'
  ];
  // Ноги: штаны (сланец/сталь), сапог (слива), носок вперёд.
  P.leg = [
    'lbbl..',
    'lbbl..',
    'lbbl..',
    'lbll..',
    'lbll..',
    'llll..',
    'nlll..',
    'pwwp..',
    'pwwwwp',
    'pppppp',
    '.kkkkk'
  ];
  P.legFwd = [
    'lbbl....',
    'lbbl....',
    '.lbbl...',
    '.lbbl...',
    '..lbll..',
    '..llll..',
    '..nlll..',
    '..pwwp..',
    '..pwwwwp',
    '..pppppp',
    '...kkkkk'
  ];
  P.legBack = [
    '...lbbl.',
    '...lbbl.',
    '..lbbl..',
    '..lbll..',
    '.lbll...',
    '.llll...',
    'nlll....',
    'pwwp....',
    'pwwwwp..',
    'pppppp..',
    '.kkkkk..'
  ];
  P.legLift = [
    'lbbbl...',
    'lbbbbl..',
    '.llllll.',
    '...lllll',
    '...nllll',
    '...pwwp.',
    '...pwwwp',
    '...ppppp',
    '....kkkk'
  ];
  P.legKick = [
    'lbbbb.........',
    'lbbbbbbbbbpwp.',
    'lbbbbbbbbbpwwp',
    '.llllllllnpwwp',
    '..........ppp.',
    '..........kk..'
  ];
  // ВРАГ — кочегар-громила. Голова 20×17: вязаная шапка, тяжёлые брови, усы щёткой.
  P.eHead = [
    '.....wwwwww.........',
    '...wwSsWWssSw.......',
    '..wSssWsssssSw......',
    '..Ssssssssssssw.....',
    '.wSsssssssssssss....',
    '.pSssssssssssssss...',
    '.pwSsssskkkkssssS...',
    '.ppSssssssssskWsss..',
    '.pwSSsssssssskksss..',
    '..wSSsssssssssssss..',
    '..wSSssllllllllll...',
    '..wSSslbbbbmbbbbl...',
    '...wSslbbgbbbbbbll..',
    '...wSSlbbbbbbbbbll..',
    '....wSlllnnnnnlll...',
    '.....wSSlllll.......',
    '......wwwwww........'
  ];
  // Туловище 14×13: стальная жилетка на голое тело, заклёпки, тёмный ремень.
  P.eTorso = [
    '...lbbbbbbl...',
    '..lbbbmbbbbbl.',
    '.lbbmbbsssbbbl',
    'lbbbbbssssSbbl',
    'lbbgbbsssSSbgl',
    'llbbbbSsssSbbl',
    'llbbbbbSSSbbll',
    '.lllbbbbbbbll.',
    '.nkkkkgkkkkkn.',
    '.llbbbbbbbbll.',
    '.nllbbbbbblln.',
    '..nnllllllnn..',
    '...nnnnnnnn...'
  ];

  // ---------- Сборка ----------
  function parse(rows) {
    var h = rows.length, w = rows[0].length, a = new Uint8Array(w * h);
    for (var y = 0; y < h; y++) {
      if (rows[y].length !== w) throw new Error('спрайт: строка ' + y + ' длиной ' + rows[y].length + ', ждали ' + w);
      for (var x = 0; x < w; x++) {
        var v = KEY[rows[y][x]];
        if (v === undefined) throw new Error('спрайт: неизвестный символ «' + rows[y][x] + '»');
        a[y * w + x] = v;
      }
    }
    return { w: w, h: h, a: a };
  }
  // Тень второго плана (дальняя рука/нога): каждый цвет → на ступень темнее в своей рампе.
  var SHADE = [0, 1, 1, 2, 3, 4, 5, 6, 14, 10, 3, 1, 11, 12, 13, 2, 15];
  function recolor(p, map) { var o = { w: p.w, h: p.h, a: new Uint8Array(p.a.length) }; for (var i = 0; i < p.a.length; i++) o.a[i] = map[p.a[i]]; return o; }
  function charMap(m) { var o = []; for (var i = 0; i < PAL.length; i++) o[i] = i; Object.keys(m || {}).forEach(function (k) { o[KEY[k]] = KEY[m[k]]; }); return o; }
  function rot90(p) { // по часовой, без потерь (целый угол)
    var o = { w: p.h, h: p.w, a: new Uint8Array(p.a.length) };
    for (var y = 0; y < p.h; y++) for (var x = 0; x < p.w; x++) o.a[x * o.w + (p.h - 1 - y)] = p.a[y * p.w + x];
    return o;
  }
  function flipX(p) {
    var o = { w: p.w, h: p.h, a: new Uint8Array(p.a.length) };
    for (var y = 0; y < p.h; y++) for (var x = 0; x < p.w; x++) o.a[y * p.w + x] = p.a[y * p.w + p.w - 1 - x];
    return o;
  }
  // Голова «больно»: глаз-галочка зажмурен (меняются только пиксели глаза).
  function squint(rows, ey, ex) {
    var r = rows.slice(), put = function (y, x, ch) { r[y] = r[y].slice(0, x) + ch + r[y].slice(x + 1); };
    for (var y = ey; y < ey + 3; y++) for (var x = ex; x < ex + 2; x++) put(y, x, 's');
    put(ey, ex, 'k'); put(ey + 1, ex + 1, 'k'); put(ey + 2, ex, 'k');
    return r;
  }
  P.headHurt = squint(P.head, 11, 14);
  P.eHeadHurt = squint(P.eHead, 7, 13);
  var BASE = {}; Object.keys(P).forEach(function (k) { BASE[k] = parse(P[k]); });

  var FW = 40, FH = 48;
  // Рецепт кадра: [деталь, x, y, {edge, shade, rot}]. edge — внутренний контур сливой, где деталь легла поверх уже
  // нарисованного; shade — дальний план (на ступень темнее); rot — поворот на 90°·n по часовой (без потерь).
  function composeRaw(recipe, parts, w, h) {
    var a = new Uint8Array(w * h);
    recipe.forEach(function (it) {
      var p = parts[it[0]], o = it[3] || {};
      if (!p) throw new Error('спрайт: нет детали ' + it[0]);
      if (o.shade) p = recolor(p, SHADE);
      if (o.rot) for (var r = 0; r < o.rot; r++) p = rot90(p);
      var ox = it[1], oy = it[2], x, y;
      if (o.edge) {
        for (y = -1; y <= p.h; y++) for (x = -1; x <= p.w; x++) {
          if (x >= 0 && y >= 0 && x < p.w && y < p.h && p.a[y * p.w + x]) continue;
          var nb = (x > 0 && y >= 0 && y < p.h && p.a[y * p.w + x - 1]) || (x < p.w - 1 && x >= -1 && y >= 0 && y < p.h && p.a[y * p.w + x + 1]) ||
                   (y > 0 && x >= 0 && x < p.w && p.a[(y - 1) * p.w + x]) || (y < p.h - 1 && y >= -1 && x >= 0 && x < p.w && p.a[(y + 1) * p.w + x]);
          var X = ox + x, Y = oy + y;
          if (nb && X >= 0 && Y >= 0 && X < w && Y < h && a[Y * w + X] && a[Y * w + X] !== 1) a[Y * w + X] = 2;
        }
      }
      for (y = 0; y < p.h; y++) for (x = 0; x < p.w; x++) {
        var v = p.a[y * p.w + x], X2 = ox + x, Y2 = oy + y;
        if (v && X2 >= 0 && Y2 >= 0 && X2 < w && Y2 < h) a[Y2 * w + X2] = v;
      }
    });
    return { w: w, h: h, a: a };
  }
  // Селективный внешний контур: прозрачный пиксель рядом с телом → контур. Свет сверху-слева: если тело только
  // снизу/справа от пикселя контура (освещённая кромка) — LIT[цвет тела], иначе чернила.
  function outline(f) {
    var w = f.w, h = f.h, s = f.a, a = new Uint8Array(s);
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      if (s[y * w + x]) continue;
      var dn = y < h - 1 ? s[(y + 1) * w + x] : 0, rt = x < w - 1 ? s[y * w + x + 1] : 0;
      var up = y > 0 ? s[(y - 1) * w + x] : 0, lf = x > 0 ? s[y * w + x - 1] : 0;
      if (!(dn || rt || up || lf)) continue;
      a[y * w + x] = (up || lf) ? 1 : LIT[dn || rt];
    }
    return { w: w, h: h, a: a };
  }
  // Ступни/опора — по центру низа кадра: сдвигаем содержимое так, чтобы нижний непрозрачный ряд стал h−2.
  function settle(f, cx) {
    var minX = f.w, maxX = -1, maxY = -1, x, y;
    for (y = 0; y < f.h; y++) for (x = 0; x < f.w; x++) if (f.a[y * f.w + x]) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y > maxY) maxY = y; }
    var dx = cx == null ? 0 : Math.round(cx - (minX + maxX) / 2), dy = f.h - 2 - maxY, o = { w: f.w, h: f.h, a: new Uint8Array(f.a.length) };
    for (y = 0; y < f.h; y++) for (x = 0; x < f.w; x++) { var v = f.a[y * f.w + x], X = x + dx, Y = y + dy; if (v && X >= 0 && X < f.w && Y >= 0 && Y < f.h) o.a[Y * f.w + X] = v; }
    return o;
  }

  // ---------- Рецепты кадров (одни на героя и врага: детали подставляются по имени) ----------
  // Кадр 40×48, ступни на y=46 (+контур 47), центр x≈20. Голова y8..25, тело y24..36, ноги y36..46.
  function body(dx, dy, o) { // туловище + голова со сдвигом
    o = o || {};
    return [['torso', 13 + dx, 24 + dy], [o.hurt ? 'headHurt' : 'head', 11 + dx + (o.hx || 0), 8 + dy + (o.hy || 0), { edge: true }]];
  }
  var R = {
    idle0: [['armDown', 12, 25, { shade: true }], ['leg', 14, 36, { shade: true }], ['leg', 20, 36]].concat(body(0, 0), [['armDown', 23, 25, { edge: true }]]),
    idle1: [['armDown', 12, 26, { shade: true }], ['leg', 14, 36, { shade: true }], ['leg', 20, 36]].concat(body(0, 0, { hy: 1 }), [['armDown', 23, 26, { edge: true }]]),
    walk0: [['armDown', 14, 25, { shade: true }], ['legBack', 10, 36, { shade: true }], ['legFwd', 19, 36]].concat(body(0, 0), [['armDown', 21, 25, { edge: true }]]),
    walk1: [['armDown', 13, 24, { shade: true }], ['legLift', 12, 37, { shade: true }], ['leg', 19, 36]].concat(body(0, -1), [['armDown', 22, 24, { edge: true }]]),
    walk2: [['armDown', 11, 25, { shade: true }], ['legFwd', 15, 36, { shade: true }], ['legBack', 13, 36]].concat(body(0, 0), [['armDown', 24, 25, { edge: true }]]),
    walk3: [['armDown', 12, 24, { shade: true }], ['leg', 14, 36, { shade: true }], ['legLift', 18, 37]].concat(body(0, -1), [['armDown', 23, 24, { edge: true }]]),
    hit1: [['armWind', 13, 25, { shade: true }], ['legBack', 10, 36, { shade: true }], ['legFwd', 19, 36]].concat(body(1, 0, { hx: 1 }), [['armPunch', 24, 25, { edge: true }]]),
    hit2: [['armPunch', 24, 26, { shade: true }], ['legBack', 10, 36, { shade: true }], ['legFwd', 20, 36]].concat(body(2, 0, { hx: 1 }), [['armWind', 21, 25, { edge: true }]]),
    hit3: [['armDown', 11, 17, { shade: true, rot: 2 }], ['leg', 12, 36, { shade: true }], ['legKick', 20, 32]].concat(body(-1, -1, { hx: -1 }), [['armWind', 20, 25, { edge: true }]]),
    jump: [['armDown', 11, 16, { shade: true, rot: 2 }], ['legLift', 13, 35, { shade: true }], ['legLift', 18, 37]].concat(body(0, 0), [['armWind', 22, 24, { edge: true }]]),
    hurt: [['armDown', 9, 15, { shade: true, rot: 2 }], ['leg', 15, 36, { shade: true }], ['legFwd', 18, 36]].concat(body(-1, 0, { hurt: true, hx: -2, hy: 1 }), [['armDown', 26, 15, { edge: true, rot: 2 }]])
  };
  // Падение: поза «больно», повёрнутая на 90° против часовой (голова назад) — полёт; лёжа — стойка, повёрнутая так же.
  var ROT = { fall: { from: 'hurt', w: 48, h: 48 }, down: { from: 'idle0', w: 48, h: 48, hurt: true } };

  function buildSet(parts) {
    var F = {}, k;
    for (k in R) F[k] = outline(composeRaw(R[k], parts, FW, FH));
    for (k in ROT) {
      var spec = ROT[k], rec = R[spec.from].map(function (it) { return it[0] === 'head' && spec.hurt ? ['headHurt', it[1], it[2], it[3]] : it; });
      var raw = composeRaw(rec, parts, FW, FH); for (var i = 0; i < 3; i++) raw = rot90(raw);       // 48×40, голова слева
      var big = { w: spec.w, h: spec.h, a: new Uint8Array(spec.w * spec.h) };
      for (var y = 0; y < raw.h; y++) for (var x = 0; x < raw.w; x++) big.a[(y + spec.h - raw.h) * spec.w + x] = raw.a[y * raw.w + x];
      F[k] = outline(settle(big, spec.w / 2));
    }
    return F;
  }
  // Наборы деталей по персонажам (перекраска индексов — та же матрица, другие цвета).
  function partsFor(maps) { // maps: { '*': {...} для всех, legs: {...} для ног }
    var o = {}; Object.keys(BASE).forEach(function (k) {
      var isLeg = /^leg/.test(k), m = charMap(Object.assign({}, maps['*'] || {}, isLeg ? maps.legs || {} : {}));
      o[k] = recolor(BASE[k], m);
    });
    return o;
  }
  function enemyParts(variantMap) {
    var o = partsFor({ '*': Object.assign({ t: 'l', v: 'b' }, variantMap || {}), legs: { l: 'w', b: 'r', n: 'p' } });
    o.head = o.eHead; o.headHurt = o.eHeadHurt; o.torso = o.eTorso;
    return o;
  }
  var SETS = {
    hero: buildSet(partsFor({})),
    stokerA: buildSet(enemyParts(null)),                                  // стальная жилетка
    stokerB: buildSet(enemyParts({ b: 'r', l: 'w', m: 'c', n: 'p' }))   // ржавая жилетка
  };
  var FRAMES = {}; Object.keys(SETS).forEach(function (s) { Object.keys(SETS[s]).forEach(function (k) { FRAMES[s + '.' + k] = SETS[s][k]; }); });
  // Короткие имена для превью: героя без префикса.
  Object.keys(SETS.hero).forEach(function (k) { FRAMES[k] = SETS.hero[k]; });

  var api = { PAL: PAL, KEY: KEY, LIT: LIT, SHADE: SHADE, SETS: SETS, FRAMES: FRAMES, RECIPES: R, P: P, parse: parse, FW: FW, FH: FH };
  global.HB = global.HB || {}; global.HB.sprites = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
