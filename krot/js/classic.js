/* ============================================================================
   КРОТ · classic.js — аутентичный 8-битный рендерер (EGA/CGA-палитра)
   Владелец: pixel-viz. Контракт: CONTRACT.md §5, §5.1.

   Идея: рисуем «мир» во внутреннем буфере 320×200 честными пикселями
   (клетка поля — 16×16 буферных пикселей), затем целочисленно апскейлим ×3
   на канвас 960×600 с imageSmoothingEnabled = false. HUD-подписи и цифры
   рисуются поверх на слое 960×600 моноширинным шрифтом кратными размерами —
   так кириллица остаётся читаемой, а мир — настоящим пиксель-артом.

   Всё художество (палитра, спрайты, текстура земли) — авторское, нарисовано
   кодом. Никаких внешних картинок, шрифтов и сетевых запросов.
   ========================================================================== */
(function (global) {
  'use strict';
  var DG = global.DG = global.DG || {};

  /* ------------------------------- геометрия ------------------------------- */
  var COLS = 15, ROWS = 10, CELL = 16;      // клетка — 16×16 буферных пикселей
  var W = 320, H = 200, SCALE = 3;          // внутренний буфер и апскейл
  var FW = COLS * CELL, FH = ROWS * CELL;   // 240 × 160 — поле
  var FX = 4, FY = 24;                      // поле в буфере
  var PANX = 248, PANW = 68, PANY = 24, PANH = 160;
  var FONT = '"Menlo","DejaVu Sans Mono","Courier New",monospace';

  /* -------------------------------- палитра --------------------------------
     Ограниченный набор в духе EGA/CGA: чёрный, коричнево-оранжевая земля,
     зелёные кристаллы, жёлтое золото, циан/магента/белый акценты.          */
  var C = {
    black:   '#000000',
    dkBrown: '#4a1600',
    brown:   '#7a2c05',
    rust:    '#a83c08',
    orange:  '#d86412',
    lorange: '#f08a26',
    peach:   '#ffc069',
    white:   '#ffffff',
    ltGray:  '#c0c0c0',
    gray:    '#787878',
    dkGray:  '#303030',
    dkGreen: '#005c24',
    green:   '#00b83c',
    ltGreen: '#78f79c',
    dkGold:  '#7a5000',
    gold:    '#f0c020',
    ltGold:  '#ffe98a',
    cyan:    '#18c8c8',
    ltCyan:  '#9cf8f8',
    dkCyan:  '#066464',
    mag:     '#e02888',
    ltMag:   '#ff8cc6',
    dkMag:   '#6e0a3c',
    red:     '#f02828',
    dkRed:   '#780808'
  };

  /* -------------------------------- утилиты -------------------------------- */
  function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }
  function round(v) { return Math.round(v); }
  function tr(key, vars) { return DG.t ? DG.t(key, vars) : key; }
  function pad(n, len) {
    var s = String(Math.max(0, Math.floor(n || 0)));
    while (s.length < len) s = '0' + s;
    return s;
  }
  /* Детерминированный «шум» по координатам — для мерцания без Math.random. */
  function hash2(x, y) {
    var h = (x * 374761393 + y * 668265263) | 0;
    h = (h ^ (h >>> 13)) * 1274126177;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  /* --------------------------- кэши и offscreen ---------------------------- */
  var doc = null;        // ownerDocument канваса (для создания offscreen)
  var buf = null;        // внутренний буфер 320×200
  var bctx = null;       // его контекст
  var dirt = null;       // готовая текстура земли 240×160
  var sprites = null;    // запечённые спрайты

  function newCanvas(w, h) {
    if (doc && doc.createElement) {
      var cv = doc.createElement('canvas');
      cv.width = w; cv.height = h;
      return cv;
    }
    if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
    return null;
  }

  function ctx2d(cv) {
    var g = cv && cv.getContext ? cv.getContext('2d') : null;
    if (g) g.imageSmoothingEnabled = false;
    return g;
  }

  /* ----------------------------- пиксель-арт -------------------------------
     Спрайты — массивы строк 16×16, символ = индекс палитры.                */

  /* ---- SPRITES ---- */
  var S_PLAYER = [
    '................',
    '.......kk.......',
    '......kwwk......',
    '......kwCk......',
    '.....kkwwkk.....',
    '....kkkwCwkk....',
    '..kkkkkkkkkkkk..',
    '..kggyoooooggk..',
    '..kggoccccoggk..',
    '..kggocCCcoggk..',
    '..kggoccccoggk..',
    '..kggooooooggk..',
    '..kggooooooggk..',
    '..kkkkkkkkkkkk..',
    '....kkyyyykk....',
    '.....kkkkkk.....'
  ];

  var S_NOBBIN_A = [
    '................',
    '................',
    '.....kkkkkk.....',
    '...kkmmmmmmkk...',
    '..kmmmhhhmmmmk..',
    '.kmmhhmmmmhhmmk.',
    '.kmhmmmmmmmmhmk.',
    '.kmmwwmmmmwwmmk.',
    '.kmmwkwmmwkwmmk.',
    '.kmmmmmmmmmmmmk.',
    '.kmmmmkkkkmmmmk.',
    '..kmmmmmmmmmmk..',
    '..kmmkkkkkkmmk..',
    '...kk.kk.kk.kk..',
    '................',
    '................'
  ];
  var S_NOBBIN_B = [
    '................',
    '................',
    '.....kkkkkk.....',
    '...kkmmmmmmkk...',
    '..kmmmhhhmmmmk..',
    '.kmmhhmmmmhhmmk.',
    '.kmhmmmmmmmmhmk.',
    '.kmmwwmmmmwwmmk.',
    '.kmmwkwmmwkwmmk.',
    '.kmmmmmmmmmmmmk.',
    '.kmmmmkkkkmmmmk.',
    '..kmmmmmmmmmmk..',
    '..kmmkkkkkkmmk..',
    '..kk.kk.kk.kk...',
    '................',
    '................'
  ];

  var S_HOBBIN_A = [
    '................',
    '.....k....k.....',
    '....klk..klk....',
    '....klk..klk....',
    '...kkkkkkkkkk...',
    '..kcllllllllck..',
    '.kccllllllllcck.',
    '.kccwwccccwwcck.',
    '.kccwkwccwkwcck.',
    '.kcccccccccccck.',
    '.kcckcccccckcck.',
    '..kcccccccccck..',
    '..kcckkkkkkcck..',
    '...kk.kk.kk.kk..',
    '................',
    '................'
  ];
  var S_HOBBIN_B = [
    '................',
    '.....k....k.....',
    '....klk..klk....',
    '....klk..klk....',
    '...kkkkkkkkkk...',
    '..kcllllllllck..',
    '.kccllllllllcck.',
    '.kccwwccccwwcck.',
    '.kccwkwccwkwcck.',
    '.kcccccccccccck.',
    '.kcckcccccckcck.',
    '..kcccccccccck..',
    '..kcckkkkkkcck..',
    '..kk.kk.kk.kk...',
    '................',
    '................'
  ];

  var S_SCARED = [
    '................',
    '................',
    '.....kkkkkk.....',
    '...kkwwwwwwkk...',
    '..kwwbbbbbbwwk..',
    '.kwwbbbbbbbbwwk.',
    '.kwbbbbbbbbbbwk.',
    '.kwbbkkbbkkbbwk.',
    '.kwbbkkbbkkbbwk.',
    '.kwbbbbbbbbbbwk.',
    '.kwbbkkkkkkbbwk.',
    '..kwbbbbbbbbwk..',
    '..kwbkwbkwbkwk..',
    '...kk.kk.kk.kk..',
    '................',
    '................'
  ];

  var S_GEM = [
    '................',
    '................',
    '................',
    '......kkkk......',
    '.....kllggk.....',
    '....kllggggk....',
    '...kllggggggk...',
    '..kllggggggggk..',
    '..klggggggggdk..',
    '...kgggggggdk...',
    '....kgggggdk....',
    '.....kgggdk.....',
    '......kgdk......',
    '.......kk.......',
    '................',
    '................'
  ];

  var S_BAG = [
    '................',
    '................',
    '......kkkk......',
    '.....kgyygk.....',
    '....kgwyyygk....',
    '...kgwyyyyygk...',
    '..kgyyyyyyyygk..',
    '.kgyyyyyysyyygk.',
    '.kgyyyysssyyygk.',
    '.kgyyyysyyyyygk.',
    '.kgyyyysssyyygk.',
    '.kgyyyyyysyyygk.',
    '.kgyyyysssyyygk.',
    '..kgyyyysyyygk..',
    '...kkkkkkkkkk...',
    '................'
  ];
  /* ---- /SPRITES ---- */

  /* Мини-иконки 8×8 для HUD: чётче, чем уменьшенные 16×16. */
  var S_ICON_PLAYER = [
    '..kkkk..',
    '.kyyyyk.',
    '.kyccyk.',
    '.kyyyyk.',
    '..kkkk..',
    '..kggk..',
    '...kk...',
    '........'
  ];
  var S_ICON_MONSTER = [
    '..kkkk..',
    '.kmmmmk.',
    'kmmwwmmk',
    'kmwkkwmk',
    'kmmmmmmk',
    '.kmmmmk.',
    '..k..k..',
    '........'
  ];
  var S_ICON_GEM = [
    '..kkkk..',
    '.kllggk.',
    'kllggggk',
    'klggggdk',
    '.kgggdk.',
    '..kgdk..',
    '...kk...',
    '........'
  ];
  var MAP_ICON_PLAYER = { k: C.black, y: C.lorange, c: C.cyan, g: C.dkGray };
  var MAP_ICON_MONSTER = { k: C.black, m: C.mag, w: C.white };
  var MAP_ICON_GEM = { k: C.dkGreen, l: C.ltGreen, g: C.green, d: C.dkGreen };

  /* Палитры для спрайтов: символ -> цвет. */
  var MAPS = {
    player: {
      k: C.black, w: C.white, W: C.ltCyan, g: C.dkGray,
      y: C.peach, o: C.lorange, r: C.rust, c: C.cyan, C: C.ltCyan
    },
    nobbin: {
      k: C.black, m: C.mag, h: C.ltMag, w: C.white
    },
    hobbin: {
      k: C.black, c: C.cyan, l: C.ltCyan, b: C.dkCyan, w: C.white
    },
    scaredA: {
      k: C.black, w: C.white, b: C.ltCyan, m: C.dkCyan
    },
    scaredB: {
      k: C.black, w: C.ltCyan, b: C.cyan, m: C.dkCyan
    },
    gem: {
      k: C.dkGreen, g: C.green, l: C.ltGreen, d: C.dkGreen
    },
    bag: {
      k: C.black, g: C.gold, y: C.ltGold, w: C.white,
      d: C.dkGold, s: C.dkBrown
    }
  };

  /* Запекание массива строк в offscreen-канвас. */
  function bake(rows, map, w, h) {
    w = w || 16; h = h || 16;
    var cv = newCanvas(w, h);
    if (!cv) return null;
    var g = ctx2d(cv);
    for (var y = 0; y < h && y < rows.length; y++) {
      var row = rows[y];
      for (var x = 0; x < w; x++) {
        var ch = row.charAt(x);
        if (ch === '.' || ch === ' ' || ch === '') continue;
        var col = map[ch];
        if (!col) continue;
        g.fillStyle = col;
        g.fillRect(x, y, 1, 1);
      }
    }
    if (rows.length !== h) {
      // не роняем игру из-за опечатки в спрайте — просто сообщаем в консоль
      if (global.console && console.warn) console.warn('classic sprite row count', rows.length, '!=', h);
    }
    return cv;
  }

  /* Поворот готового канваса на кратные 90° (пиксель-в-пиксель). */
  function rotateCv(src, deg) {
    if (!src) return null;
    var s = src.width;
    var cv = newCanvas(s, s);
    if (!cv) return src;
    var g = ctx2d(cv);
    g.translate(s / 2, s / 2);
    g.rotate(deg * Math.PI / 180);
    g.drawImage(src, -s / 2, -s / 2);
    return cv;
  }

  /* Увеличенный ровно в целое число раз спрайт (пиксель-арт без мыла). */
  function bigCv(src, size) {
    if (!src) return null;
    var cv = newCanvas(size, size);
    if (!cv) return null;
    var g = ctx2d(cv);
    g.drawImage(src, 0, 0, size, size);
    return cv;
  }

  /* ---------------------- процедурные спрайты (примитивы) ------------------ */
  function bakeGold(doc) {
    var cv = newCanvas(16, 16), g = ctx2d(cv);
    if (!g) return null;
    function ell(cx, cy, rx, ry, col) {
      g.fillStyle = col;
      for (var y = -ry; y <= ry; y++) {
        for (var x = -rx; x <= rx; x++) {
          if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) g.fillRect(cx + x, cy + y, 1, 1);
        }
      }
    }
    // три самородка: тень-контур, золото, блик
    ell(5, 11, 4, 3, C.dkBrown);
    ell(11, 11, 4, 3, C.dkBrown);
    ell(8, 7, 4, 3, C.dkBrown);
    ell(5, 10, 3, 2, C.gold);
    ell(11, 10, 3, 2, C.gold);
    ell(8, 6, 3, 2, C.gold);
    ell(4, 9, 1, 1, C.ltGold);
    ell(10, 9, 1, 1, C.ltGold);
    ell(7, 5, 1, 1, C.ltGold);
    g.fillStyle = C.white;
    g.fillRect(7, 5, 1, 1);
    return cv;
  }

  function bakeCherry(doc) {
    var cv = newCanvas(16, 16), g = ctx2d(cv);
    if (!g) return null;
    function line(x0, y0, x1, y1, col, thick) {
      g.fillStyle = col;
      var steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      for (var i = 0; i <= steps; i++) {
        var t = steps ? i / steps : 0;
        var x = Math.round(x0 + (x1 - x0) * t);
        var y = Math.round(y0 + (y1 - y0) * t);
        g.fillRect(x, y, thick, thick);
      }
    }
    function berry(cx, cy, r, dark, body, lite) {
      g.fillStyle = dark;
      for (var y = -r - 1; y <= r + 1; y++) {
        for (var x = -r - 1; x <= r + 1; x++) {
          if (x * x + y * y <= (r + 1) * (r + 1)) g.fillRect(cx + x, cy + y, 1, 1);
        }
      }
      g.fillStyle = body;
      for (var y2 = -r; y2 <= r; y2++) {
        for (var x2 = -r; x2 <= r; x2++) {
          if (x2 * x2 + y2 * y2 <= r * r) g.fillRect(cx + x2, cy + y2, 1, 1);
        }
      }
      g.fillStyle = lite;
      g.fillRect(cx - 2, cy - 2, 2, 1);
    }
    // веточки и листик
    line(5, 8, 8, 3, C.dkGreen, 1);
    line(11, 8, 9, 3, C.dkGreen, 1);
    line(9, 3, 11, 2, C.green, 1);
    g.fillStyle = C.green;
    g.fillRect(10, 2, 2, 1);
    g.fillRect(11, 3, 1, 1);
    // две вишни
    berry(5, 11, 3, C.dkRed, C.red, C.ltMag);
    berry(11, 11, 3, C.dkRed, C.red, C.ltMag);
    g.fillStyle = C.white;
    g.fillRect(4, 9, 1, 1);
    return cv;
  }

  /* --------------------------- сборка всех спрайтов ------------------------ */
  function buildSprites() {
    if (sprites) return;
    var pl = bake(S_PLAYER, MAPS.player, 16, 16);
    // второй кадр: «бегут» гусеницы (тёмные засечки на серых траках)
    var plB = newCanvas(16, 16);
    if (plB && pl) {
      var gb = ctx2d(plB);
      gb.drawImage(pl, 0, 0);
      gb.fillStyle = C.black;
      gb.fillRect(3, 9, 2, 1);
      gb.fillRect(11, 11, 2, 1);
      gb.fillRect(3, 12, 2, 1);
      gb.fillRect(11, 8, 2, 1);
    }
    var nbA = bake(S_NOBBIN_A, MAPS.nobbin, 16, 16);
    var nbB = bake(S_NOBBIN_B, MAPS.nobbin, 16, 16);
    var hbA = bake(S_HOBBIN_A, MAPS.hobbin, 16, 16);
    var hbB = bake(S_HOBBIN_B, MAPS.hobbin, 16, 16);
    var scA = bake(S_SCARED, MAPS.scaredA, 16, 16);
    var scB = bake(S_SCARED, MAPS.scaredB, 16, 16);
    sprites = {
      player: [
        [rotateCv(pl, 0), rotateCv(plB, 0)],
        [rotateCv(pl, 90), rotateCv(plB, 90)],
        [rotateCv(pl, 180), rotateCv(plB, 180)],
        [rotateCv(pl, 270), rotateCv(plB, 270)]
      ],
      nobbin: [nbA, nbB],
      hobbin: [hbA, hbB],
      scared: [scA, scB],
      gem: bake(S_GEM, MAPS.gem, 16, 16),
      bag: bake(S_BAG, MAPS.bag, 16, 16),
      gold: bakeGold(doc),
      cherry: bakeCherry(doc),
      iconPlayer: bake(S_ICON_PLAYER, MAP_ICON_PLAYER, 8, 8),
      iconPlayerBig: bigCv(pl, 48),
      iconGem: bake(S_ICON_GEM, MAP_ICON_GEM, 8, 8),
      iconMonster: bake(S_ICON_MONSTER, MAP_ICON_MONSTER, 8, 8)
    };
  }

  /* --------------------------- текстура земли ------------------------------
     Оранжево-коричневая земля с шевронным дизерингом и вкраплениями.
     Рисуется один раз в 240×160, потом только вырезаются чёрные туннели.   */
  function buildDirt() {
    if (dirt) return;
    var cv = newCanvas(FW, FH);
    if (!cv) return;
    var g = ctx2d(cv);
    var img = g.createImageData(FW, FH);
    var data = img.data;
    var cols = {
      dark: hexRgb(C.dkBrown),
      rust: hexRgb(C.rust),
      brown: hexRgb(C.brown),
      orange: hexRgb(C.orange),
      light: hexRgb(C.lorange),
      peach: hexRgb(C.peach)
    };
    var rnd = DG.rng ? DG.rng(0x51D6E701) : (function () {
      var s = 7;
      return function () { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    })();
    var i = 0;
    for (var y = 0; y < FH; y++) {
      for (var x = 0; x < FW; x++, i += 4) {
        var col;
        var band = (y >> 2) & 1;
        var zx = (band ? (x + y) : (x - y + 4096)) & 7;
        if (zx === 0) col = cols.dark;
        else if (zx === 1) col = cols.light;
        else if (((x * 5 + y * 3) & 7) === 0) col = cols.brown;
        else col = cols.rust;
        var r = rnd();
        if (r < 0.035) col = cols.orange;
        else if (r < 0.055) col = cols.dark;
        else if (r < 0.065) col = cols.peach;
        // крупные тёмные «камни», чтобы земля не была однородной
        if (((x >> 3) * 13 + (y >> 3) * 29) % 7 === 0 && ((x + y) & 3) === 0) col = cols.brown;
        data[i] = col[0]; data[i + 1] = col[1]; data[i + 2] = col[2]; data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    dirt = cv;
  }
  function hexRgb(hex) {
    return [
      parseInt(hex.substr(1, 2), 16),
      parseInt(hex.substr(3, 2), 16),
      parseInt(hex.substr(5, 2), 16)
    ];
  }

  /* ------------------------------ инициализация --------------------------- */
  function ensure(ctx) {
    if (!doc) {
      var cv = ctx && ctx.canvas;
      doc = (cv && cv.ownerDocument) || global.document || null;
    }
    if (!buf && doc) {
      buf = newCanvas(W, H);
      bctx = ctx2d(buf);
      buildSprites();
      buildDirt();
    }
    return buf;
  }

  /* --------------------------- низкоуровневые хелперы ---------------------- */
  function lr(g, x, y, w, h, col) {
    g.fillStyle = col;
    g.fillRect(x | 0, y | 0, w | 0, h | 0);
  }
  function frame(g, x, y, w, h, cOuter, cInner) {
    lr(g, x, y, w, h, cOuter);
    lr(g, x + 1, y + 1, w - 2, h - 2, cInner);
  }

  /* -------------------------------- рамка ---------------------------------- */
  function drawFrameChrome(g, S) {
    // «корпус»: чёрный фон, рамки поля и панели
    lr(g, 0, 0, W, H, C.black);

    // рамка поля (3 буферных пикселя): верх/низ/лево/право
    lr(g, FX - 3, FY - 3, FW + 6, 3, C.brown);          // верх
    lr(g, FX - 3, FY + FH, FW + 6, 3, C.brown);         // низ
    lr(g, FX - 3, FY, 3, FH, C.brown);                  // лево
    lr(g, FX + FW, FY, 3, FH, C.brown);                 // право
    // светлая внутренняя кромка
    lr(g, FX - 2, FY - 2, FW + 4, 1, C.rust);
    lr(g, FX - 2, FY + FH + 1, FW + 4, 1, C.dkBrown);
    lr(g, FX - 2, FY, 1, FH, C.rust);
    lr(g, FX + FW + 1, FY, 1, FH, C.dkBrown);

    // нижняя строка HUD отделена от поля
    lr(g, 0, 187, W, 1, C.dkBrown);
    lr(g, 0, 188, W, 1, C.black);

    // верхняя строка: тонкая линия под ней
    lr(g, 0, 22, W, 2, C.dkBrown);

    // панель справа
    lr(g, PANX - 1, PANY - 3, PANW + 2, PANH + 4, C.brown);
    lr(g, PANX, PANY - 2, PANW, PANH + 2, C.black);
    lr(g, PANX, PANY - 2, PANW, 1, C.rust);
    // пунктирные разделители блоков панели
    for (var yy = PANY + 24; yy < PANY + PANH; yy += 24) {
      for (var x = PANX + 4; x < PANX + PANW - 4; x += 4) {
        lr(g, x, yy, 2, 1, C.dkBrown);
      }
    }
    // декоративные заклёпки по углам рамки поля
    lr(g, FX - 3, FY - 3, 2, 2, C.ltGold);
    lr(g, FX + FW + 1, FY - 3, 2, 2, C.ltGold);
    lr(g, FX - 3, FY + FH + 1, 2, 2, C.ltGold);
    lr(g, FX + FW + 1, FY + FH + 1, 2, 2, C.ltGold);

    // мигающая «бонусная» рамка
    if (S && S.bonus && (S.mode === 'bonus' || S.mode === 'play')) {
      bonusMarquee(g, S);
    }
  }

  function bonusMarquee(g, S) {
    var phase = Math.floor((S.time || 0) * 14);
    var seg = 8;
    var i, n;
    var cx = (phase & 1) ? C.mag : C.ltMag;
    var cy = (phase & 1) ? C.ltGold : C.gold;
    n = Math.floor(FW / seg) + 1;
    for (i = 0; i < n; i++) {
      lr(g, FX + i * seg, FY - 2, 6, 2, ((i + phase) & 1) ? cx : cy);
      lr(g, FX + i * seg, FY + FH, 6, 2, ((i + phase) & 1) ? cy : cx);
    }
    for (i = 0; i < Math.floor(FH / seg) + 1; i++) {
      lr(g, FX - 2, FY + i * seg, 2, 6, ((i + phase) & 1) ? cx : cy);
      lr(g, FX + FW, FY + i * seg, 2, 6, ((i + phase) & 1) ? cy : cx);
    }
  }

  /* ------------------------------ поле: мир -------------------------------- */
  function drawWorld(g, S) {
    var t = S.time || 0;
    var sh = S.shake || 0;
    var ox = 0, oy = 0;
    if (sh > 0.01) {
      ox = round(Math.sin(t * 97.3) * sh * 5);
      oy = round(Math.cos(t * 83.7) * sh * 4);
    }
    g.save();
    g.translate(FX + ox, FY + oy);
    // земля
    if (dirt) g.drawImage(dirt, 0, 0);
    else lr(g, 0, 0, FW, FH, C.rust);
    // туннели — горизонтальными полосами (быстро и без швов)
    punchTunnels(g, S);
    // предметы
    drawItems(g, S, t);
    // пули
    drawBullets(g, S, t);
    // монстры
    drawMonsters(g, S, t);
    // игрок
    drawPlayer(g, S, t);
    // частицы поверх всего
    drawParticles(g, S);
    g.restore();
  }

  function punchTunnels(g, S) {
    var grid = S.grid;
    if (!grid) return;
    for (var cy = 0; cy < ROWS; cy++) {
      var run = -1;
      for (var cx = 0; cx <= COLS; cx++) {
        var tun = cx < COLS && grid[cy * COLS + cx] === 1;
        if (tun && run < 0) run = cx;
        else if (!tun && run >= 0) {
          lr(g, run * CELL, cy * CELL, (cx - run) * CELL, CELL, C.black);
          run = -1;
        }
      }
    }
    // лёгкая «пыль» по краю туннеля — чтобы чёрное не было мёртвым
    for (var cy2 = 0; cy2 < ROWS; cy2++) {
      for (var cx2 = 0; cx2 < COLS; cx2++) {
        if (grid[cy2 * COLS + cx2] !== 1) continue;
        var h = hash2(cx2 * 7 + 3, cy2 * 11 + 5);
        if (h < 0.12) {
          lr(g, cx2 * CELL + (h * 14 | 0), cy2 * CELL + (h * 13 | 0), 1, 1, C.dkBrown);
        }
      }
    }
  }

  function drawItems(g, S, t) {
    var items = S.items || [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var px = round(it.x * CELL), py = round(it.y * CELL);
      var h = hash2(it.cx || 0, it.cy || 0);
      if (it.type === 'gem') {
        if (sprites.gem) g.drawImage(sprites.gem, px - 8, py - 8);
        // искра
        var ph = (t * 1.6 + h * 3) % 2.6;
        if (ph < 0.22) {
          lr(g, px - 1, py - 5, 2, 2, C.white);
        }
      } else if (it.type === 'bag') {
        var bx = px, by = py;
        if (it.falling) {
          // пылевой след падения
          g.globalAlpha = 0.55;
          for (var k = 1; k <= 3; k++) {
            lr(g, px - 2, py - 8 - k * 5, 2, 3, k === 1 ? C.orange : C.dkBrown);
          }
          g.globalAlpha = 1;
        } else if (it.wobble >= 0) {
          // трясётся
          bx += round(Math.sin(t * 47 + h * 6) * 2);
          by += (Math.floor(t * 22) & 1) ? 1 : 0;
          // крошки снизу
          var dust = Math.floor(t * 20) & 1;
          lr(g, px - 4 + dust * 5, py + 7, 1, 1, C.dkBrown);
          lr(g, px + 3 - dust * 4, py + 8, 1, 1, C.brown);
        }
        if (sprites.bag) g.drawImage(sprites.bag, bx - 8, by - 8);
      } else if (it.type === 'gold') {
        var bob = round(Math.sin(t * 4 + h * 5));
        if (sprites.gold) g.drawImage(sprites.gold, px - 8, py - 8 + bob);
        if (((t * 2 + h * 4) % 3) < 0.3) lr(g, px + 3, py - 4 + bob, 2, 1, C.white);
      } else if (it.type === 'cherry') {
        var cb = round(Math.sin(t * 3.4 + h * 4) * 1);
        if (sprites.cherry) g.drawImage(sprites.cherry, px - 8, py - 8 + cb);
        if (((t * 3 + h * 2) % 2) < 0.25) lr(g, px + 4, py - 3 + cb, 1, 1, C.white);
      }
    }
  }

  function drawBullets(g, S, t) {
    var bs = S.bullets || [];
    var dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    for (var i = 0; i < bs.length; i++) {
      var b = bs[i];
      var px = round(b.x * CELL), py = round(b.y * CELL);
      var d = dirs[b.dir & 3] || dirs[0];
      // хвост
      for (var k = 1; k <= 3; k++) {
        g.globalAlpha = 0.65 - k * 0.17;
        lr(g, px - d[0] * k * 4 - 1, py - d[1] * k * 4 - 1, 3, 3, k === 1 ? C.ltCyan : C.cyan);
      }
      g.globalAlpha = 1;
      lr(g, px - 2, py - 2, 4, 4, C.cyan);
      lr(g, px - 1, py - 1, 2, 2, C.white);
      lr(g, px - 3, py - 3, 1, 1, C.ltGold);
    }
  }

  function drawMonsters(g, S, t) {
    var ms = S.monsters || [];
    for (var i = 0; i < ms.length; i++) {
      var m = ms[i];
      var px = round(m.x * CELL), py = round(m.y * CELL);
      // смерть: сплющивание, вращение, искры
      if (m.dying > 0) {
        var k = clamp01(m.dying / 0.4);       // 1 → 0
        var squash = 0.2 + k * 0.8;
        var wid = 1 + (1 - k) * 0.7;
        g.save();
        g.translate(px, py);
        g.rotate((1 - k) * 1.6);
        g.globalAlpha = Math.max(0.12, k);
        var frame = (m.kind === 'hobbin' ? sprites.hobbin : sprites.nobbin)[0];
        if (frame) g.drawImage(frame, -8 * wid, -8 * squash, 16 * wid, 16 * squash);
        g.globalAlpha = 1;
        g.restore();
        // звёздочки
        for (var s = 0; s < 6; s++) {
          var a = s * 1.05 + t * 5;
          var rr = 5 + (1 - k) * 12;
          lr(g, px + Math.cos(a) * rr - 1, py + Math.sin(a) * rr - 1, 2, 2,
            (s & 1) ? C.white : C.ltGold);
        }
        continue;
      }
      var frames;
      if (m.scared) frames = sprites.scared;
      else if (m.kind === 'hobbin') frames = sprites.hobbin;
      else frames = sprites.nobbin;
      var frameIdx = frames && frames.length > 1
        ? (Math.floor(t * 7 + (m.walkPhase || 0) + (m.cx || 0) * 0.3) % 2)
        : 0;
      var spr = frames ? frames[frameIdx] : null;
      if (!spr) continue;
      var bob = round(Math.sin(t * 5.5 + (m.cx || 0) * 1.7 + (m.cy || 0)) * 1);
      if (m.spawnT < 1) {
        // появление: «прорастание» из земли
        var sc = 0.2 + 0.8 * clamp01(m.spawnT);
        g.save();
        g.translate(px, py);
        g.scale(sc, sc);
        g.globalAlpha = 0.35 + 0.65 * clamp01(m.spawnT);
        g.drawImage(spr, -8, -8);
        g.globalAlpha = 1;
        g.restore();
        // белое кольцо
        for (var r2 = 0; r2 < 8; r2++) {
          var aa = r2 * Math.PI / 4 + t * 6;
          lr(g, px + Math.cos(aa) * (6 + m.spawnT * 4) - 1,
            py + Math.sin(aa) * (6 + m.spawnT * 4) - 1, 1, 1, C.white);
        }
      } else {
        g.drawImage(spr, px - 8, py - 8 + bob);
        // лёгкая тень-подчёркивание под кляксой
        g.globalAlpha = 0.5;
        lr(g, px - 5, py + 7 + bob, 10, 1, C.black);
        g.globalAlpha = 1;
      }
    }
  }

  function drawPlayer(g, S, t) {
    var p = S.player;
    if (!p) return;
    var px = round(p.x * CELL), py = round(p.y * CELL);
    var blink = false;
    if (!p.alive) {
      drawDeathFx(g, S, t, px, py);
      return;
    }
    if (S.mode !== 'title' && p.invuln > 0) {
      blink = (Math.floor(t * 12) & 1) === 0;
    }
    var dir = p.dir & 3;
    var frames = sprites.player[dir] || sprites.player[0];
    var wob = p.moving ? (Math.floor((p.walkPhase || 0) * 1.5) & 1) : 0;
    var spr = frames ? frames[wob] : null;
    if (!spr) return;
    var bob = 0;
    if (p.moving) bob = (Math.floor(p.walkPhase || 0) & 1) ? 1 : 0;
    if (blink) {
      // неуязвимость: бледный силуэт + вращающийся «щит»
      g.globalAlpha = 0.4;
      g.drawImage(spr, px - 8, py - 8 + bob);
      g.globalAlpha = 1;
      for (var i = 0; i < 8; i++) {
        var a = i * Math.PI / 4 + t * 4;
        lr(g, px + Math.cos(a) * 9 - 1, py + Math.sin(a) * 9 - 1, 2, 2, (i & 1) ? C.cyan : C.white);
      }
    } else {
      g.drawImage(spr, px - 8, py - 8 + bob);
    }

    // вспышка выстрела
    if (p.shootAnim > 0.05) {
      var dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
      var d = dirs[dir];
      var fx = px + d[0] * 11, fy = py + d[1] * 11;
      var big = p.shootAnim > 0.5;
      lr(g, fx - 2, fy - 2, 4, 4, C.white);
      lr(g, fx - 4, fy - 4, 2, 2, C.ltGold);
      lr(g, fx + 2, fy + 2, 2, 2, C.ltGold);
      if (big) {
        lr(g, fx - d[0] * 4 - 1, fy - d[1] * 4 - 1, 3, 3, C.cyan);
      }
    }
  }

  function drawDeathFx(g, S, t, px, py) {
    var k = clamp01(1 - (S.deadT || 0) / 1.6); // 0 → 1
    var sc = 1 + k * 0.8;
    g.save();
    g.translate(px, py);
    g.rotate(k * 7.5);
    g.globalAlpha = Math.max(0.12, 1 - k * 0.95);
    var deadFrame = sprites.player[0] && sprites.player[0][0];
    if (deadFrame) g.drawImage(deadFrame, -8 * sc, -8 * sc, 16 * sc, 16 * sc);
    g.globalAlpha = 1;
    g.restore();
    for (var i = 0; i < 10; i++) {
      var a = i * 0.63 + t * 4.5;
      var rr = 6 + k * 26;
      var sz = (i & 1) ? 2 : 1;
      lr(g, px + Math.cos(a) * rr - 1, py + Math.sin(a) * rr - 1, sz, sz,
        i % 3 === 0 ? C.white : (i % 3 === 1 ? C.ltGold : C.red));
    }
    // вспышка-звезда в первые доли секунды
    if (k < 0.4) {
      var fl = 1 - k / 0.4;
      g.globalAlpha = fl;
      lr(g, px - 11, py - 3, 22, 6, C.ltGold);
      lr(g, px - 3, py - 11, 6, 22, C.ltGold);
      lr(g, px - 5, py - 5, 10, 10, C.white);
      g.globalAlpha = 1;
    }
    // расширяющееся кольцо обломков
    for (var ring = 0; ring < 2; ring++) {
      var rr = 4 + k * (14 + ring * 14);
      var n = 10 + ring * 6;
      for (var r = 0; r < n; r++) {
        var a = r * Math.PI * 2 / n + t * (2 + ring) + ring;
        var sz = ((r + ring) % 3 === 0) ? 2 : 1;
        lr(g, px + Math.cos(a) * rr - 1, py + Math.sin(a) * rr - 1, sz, sz,
          r % 3 === 0 ? C.white : (r % 3 === 1 ? C.ltGold : C.red));
      }
    }
  }

  function drawParticles(g, S) {
    var PART = {
      dirt: [C.dkBrown, C.brown, C.orange],
      gem: [C.green, C.ltGreen, C.white],
      gold: [C.gold, C.ltGold, C.dkGold],
      spark: [C.white, C.ltCyan],
      monster: [C.mag, C.ltMag],
      eat: [C.gold, C.ltMag],
      death: [C.red, C.white, C.ltGold]
    };
    var ps = S.particles || [];
    for (var i = 0; i < ps.length; i++) {
      var p = ps[i];
      var pal = PART[p.kind] || PART.dirt;
      var col = pal[(p.size * 100 | 0) % pal.length] || pal[0];
      var px = round(p.x * CELL), py = round(p.y * CELL);
      var sz = Math.max(1, Math.min(3, round((p.size || 0.1) * CELL)));
      var a = p.maxLife ? clamp01(p.life / p.maxLife) : 1;
      if (a < 0.35) { if ((i & 1) === 0) continue; }
      g.globalAlpha = a >= 0.7 ? 1 : (a >= 0.35 ? 0.85 : 0.55);
      lr(g, px - (sz >> 1), py - (sz >> 1), sz, sz, col);
    }
    g.globalAlpha = 1;
  }

  /* --------------------------- наложения состояний ------------------------- */
  /* Затемнение полупрозрачной чёрной плашкой: без «муара» от дизеринга. */
  function dimRect(g, x, y, w, h, amount) {
    var a = g.globalAlpha;
    g.globalAlpha = amount;
    g.fillStyle = C.black;
    g.fillRect(x, y, w, h);
    g.globalAlpha = a;
  }
  function dimAll(g, amount) { dimRect(g, 0, 0, W, H, amount); }
  function dimField(g, amount) { dimRect(g, FX, FY, FW, FH, amount); }

  function panelLow(g, x, y, w, h, accent) {
    lr(g, x, y, w, h, C.black);
    lr(g, x, y, w, 1, accent);
    lr(g, x, y + h - 1, w, 1, accent);
    lr(g, x, y, 1, h, accent);
    lr(g, x + w - 1, y, 1, h, accent);
    // уголки
    lr(g, x + 1, y + 1, 2, 2, C.ltGold);
    lr(g, x + w - 3, y + 1, 2, 2, C.ltGold);
    lr(g, x + 1, y + h - 3, 2, 2, C.ltGold);
    lr(g, x + w - 3, y + h - 3, 2, 2, C.ltGold);
    // внутренняя тонкая рамка
    lr(g, x + 3, y + 3, w - 6, 1, C.dkBrown);
    lr(g, x + 3, y + h - 4, w - 6, 1, C.dkBrown);
  }

  function drawOverlaysLow(g, S) {
    var mode = S.mode;
    if (S.paused) {
      // DOM-оверлей рисует паузу; здесь только мягкое затемнение мира
      dimAll(g, 0.58);
      return;
    }
    if (mode === 'ready' || mode === 'levelclear') {
      dimField(g, 0.55);
      var bt = blinkOn(S.time || 0, 2.5);
      if (mode === 'ready') panelLow(g, 44, 58, 160, 72, bt ? C.ltCyan : C.cyan);
      else panelLow(g, 44, 52, 160, 88, bt ? C.ltGold : C.gold);
    } else if (mode === 'gameover') {
      // DOM-оверлей рисует карточку game over; здесь только затемнение
      dimAll(g, 0.62);
    } else if (mode === 'dying') {
      // красная рамка-«тревога» по краям поля
      var kk = clamp01((S.deadT || 0) / 1.6);
      g.globalAlpha = 0.20 + 0.30 * kk;
      g.fillStyle = C.dkRed;
      g.fillRect(FX, FY, FW, 18);
      g.fillRect(FX, FY + FH - 18, FW, 18);
      g.fillRect(FX, FY, 16, FH);
      g.fillRect(FX + FW - 16, FY, 16, FH);
      g.globalAlpha = 1;
    } else if (mode === 'title') {
      // титул рисует DOM: здесь только живой фон — блеск на земле
      for (var i = 0; i < 26; i++) {
        var hx = hash2(i, 11), hy = hash2(i, 17);
        var sx = (hx * FW) | 0, sy = (hy * FH) | 0;
        var tw = (Math.sin((S.time || 0) * 2 + i * 1.7) + 1) * 0.5;
        if (tw > 0.72) lr(g, FX + sx, FY + sy, 1, 1, (i & 1) ? C.white : C.ltGreen);
      }
    }
  }

  /* ------------------------------- HUD (низкий слой) ----------------------- */
  function drawHudLow(g, S) {
    // иконки жизней
    var lives = Math.max(0, Math.min(6, S.lives | 0));
    for (var i = 0; i < lives; i++) {
      if (sprites.iconPlayer) g.drawImage(sprites.iconPlayer, PANX + 5 + i * 10, PANY + 32);
    }
    // иконка алмаза в блоке «АЛМАЗЫ»
    if (sprites.iconGem) g.drawImage(sprites.iconGem, PANX + 5, PANY + 56);
    // иконка монстра
    if (sprites.iconMonster) g.drawImage(sprites.iconMonster, PANX + 5, PANY + 126);
  }

  /* ------------------------------ HUD (слой 960×600) ----------------------- */
  function txt(ctx, str, x, y, size, color, align, alpha) {
    ctx.font = 'bold ' + size + 'px ' + FONT;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.fillText(str, Math.round(x), Math.round(y));
    ctx.globalAlpha = 1;
  }
  function txtShadow(ctx, str, x, y, size, color, align, alpha) {
    txt(ctx, str, x + 3, y + 3, size, C.black, align, alpha);
    txt(ctx, str, x, y, size, color, align, alpha);
  }
  function bar(ctx, x, y, w, h, frac, color) {
    frac = clamp01(frac);
    ctx.fillStyle = C.brown; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = C.black; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    var fw = Math.round((w - 2) * frac);
    if (fw > 0) { ctx.fillStyle = color; ctx.fillRect(x + 1, y + 1, fw, h - 2); }
  }
  function blinkOn(t, rate) { return (Math.floor(t * rate) & 1) === 0; }
  function up(s) { return String(s == null ? '' : s).toUpperCase(); }

  function drawHudText(ctx, S) {
    var alpha = (S.paused || S.mode === 'gameover') ? 0.5 : 1;
    var t = S.time || 0;
    var score = pad(S.score, 6);
    var hi = pad(S.hi, 6);

    /* --- верхняя строка --- */
    txt(ctx, up(tr('score')), 24, 9, 15, C.ltGray, 'left', alpha);
    txt(ctx, score, 24, 27, 27, C.gold, 'left', alpha);
    txt(ctx, up(tr('hiscore')), 936, 9, 15, C.ltGray, 'right', alpha);
    txt(ctx, hi, 936, 27, 27, C.ltGreen, 'right', alpha);
    // «бренд» по центру
    txt(ctx, 'КРОТ', 480, 15, 21, C.mag, 'center', alpha);
    txt(ctx, '\u25C6', 480 - 73, 17, 15, C.cyan, 'center', alpha);
    txt(ctx, '\u25C6', 480 + 73, 17, 15, C.cyan, 'center', alpha);

    /* --- панель справа --- */
    var X = 756; // логический x=252
    // уровень
    txt(ctx, up(tr('level')), X, 78, 15, C.ltGray, 'left', alpha);
    txt(ctx, pad(S.level, 2), X, 96, 27, C.cyan, 'left', alpha);
    // жизни (иконки нарисованы в низком слое)
    txt(ctx, up(tr('lives')), X, 150, 15, C.ltGray, 'left', alpha);
    if (S.lives > 6) {
      txt(ctx, 'x' + S.lives, X, 168, 21, C.peach, 'left', alpha);
    }
    // алмазы (иконка-алмаз слева)
    txt(ctx, up(tr('gems')), X + 30, 222, 15, C.ltGray, 'left', alpha);
    txt(ctx, (S.gemsLeft | 0) + '/' + (S.gemsTotal | 0), X + 30, 240, 21, C.ltGreen, 'left', alpha);
    // бонус
    var bonusFrac = (S.bonus && S.bonusDur > 0) ? clamp01(S.bonusT / S.bonusDur) : 0;
    txt(ctx, up(tr('bonus')), X, 294, 15, C.ltGray, 'left', alpha);
    bar(ctx, X, 312, 180, 12, bonusFrac, S.bonus ? C.ltMag : C.brown);
    if (S.bonus) {
      txt(ctx, Math.max(0, Math.ceil(S.bonusT)) + 's', X + 150, 330, 15,
        blinkOn(t, 6) ? C.ltMag : C.ltGold, 'right', alpha);
    } else {
      txt(ctx, '--', X + 150, 330, 15, C.gray, 'right', alpha);
    }
    // перезарядка
    var p = S.player || {};
    var maxCd = p.shootMax || 1.2;
    var cd = Math.max(0, Math.min(maxCd, p.shootCd || 0));
    var readyFrac = 1 - cd / maxCd;
    txt(ctx, up(tr('recharge')), X, 366, 15, C.ltGray, 'left', alpha);
    bar(ctx, X, 384, 180, 12, readyFrac, readyFrac >= 0.999 ? C.ltGold : C.cyan);
    txt(ctx, readyFrac >= 0.999 ? 'OK' : cd.toFixed(1) + 's', X + 150, 402, 15,
      readyFrac >= 0.999 ? C.ltGold : C.ltCyan, 'right', alpha);
    // монстры
    var alive = 0;
    for (var i = 0; i < (S.monsters || []).length; i++) if ((S.monsters[i].dying || 0) <= 0) alive++;
    txt(ctx, up(tr('monsters')), X + 30, 438, 15, C.ltGray, 'left', alpha);
    txt(ctx, String(alive), X + 30, 456, 21, C.ltMag, 'left', alpha);
    /* --- нижняя строка --- */
    var hint = '';
    var hcol = C.gray;
    var mode = S.mode;
    var controlsHint = up(tr('controlsShoot') + '   \u00B7   ' + tr('controlsPause'));
    if (mode === 'title' || mode === 'gameover') {
      hint = '';                          // эти экраны рисует DOM
    } else if (mode === 'bonus') {
      hint = tr('bonusMode') + '  ' + tr('bonusTime', { n: Math.max(0, Math.ceil(S.bonusT)) });
      hcol = blinkOn(t, 5) ? C.ltMag : C.ltGold;
    } else if (mode === 'dying') {
      hint = '';
    } else {
      hint = controlsHint;                // play / ready / levelclear / pause
    }
    if (hint) txt(ctx, hint, FIELD_CX, 563, 15, hcol, 'center',
      0.85 * (S.paused || mode === 'gameover' ? 0.7 : 1));
  }

  /* ------------------------------ всплывающие очки ------------------------- */
  function drawPopups(ctx, S) {
    var ps = S.popups || [];
    for (var i = 0; i < ps.length; i++) {
      var p = ps[i];
      var x = 12 + p.x * 48;
      var y = 72 + p.y * 48 - 18;
      var a = p.maxLife ? clamp01(p.life / p.maxLife) : 1;
      if (a < 0.15) continue;
      var col = p.kind === 'bonus' ? C.ltCyan : C.ltGold;
      txtShadow(ctx, p.text, x, y, 21, col, 'center', a);
    }
  }

  /* ---------------------------- баннеры состояний -------------------------- */
  var FIELD_CX = 12 + (FW * SCALE) / 2;     // 372 — центр поля на слое 960×600

  function drawStateText(ctx, S) {
    var t = S.time || 0;
    var mode = S.mode;

    if (mode === 'ready') {
      if (sprites.iconPlayerBig) {
        // мини-иконка бура над баннером
        ctx.drawImage(sprites.iconPlayerBig, FIELD_CX - 24, 220);
      }
      txtShadow(ctx, tr('levelIntro', { n: S.level }), FIELD_CX, 282, 33, C.ltGold, 'center', 1);
      txt(ctx, tr('ready'), FIELD_CX, 324, 18,
        blinkOn(t, 2.5) ? C.ltCyan : C.cyan, 'center', 1);
      return;
    }

    if (mode === 'levelclear') {
      txtShadow(ctx, tr('cleared'), FIELD_CX, 246, 27, C.ltGold, 'center', 1);
      txt(ctx, '+1000', FIELD_CX, 292, 27, C.ltGreen, 'center', 1);
      // конфетти из «золота»
      for (var k = 0; k < 26; k++) {
        var hx = hash2(k, 5), hy = hash2(k, 9);
        var yy = 200 + ((hy * 300 + t * (40 + hx * 60)) % 320);
        var xx = 60 + hx * 620;
        ctx.fillStyle = (k & 1) ? C.ltGold : C.cyan;
        ctx.globalAlpha = 0.55 + hx * 0.45;
        ctx.fillRect(Math.round(xx), Math.round(yy), 6, 6);
      }
      ctx.globalAlpha = 1;
      return;
    }

    if (mode === 'bonus') {
      var b = blinkOn(t, 6);
      txtShadow(ctx, tr('bonusMode'), FIELD_CX, 96, 27, b ? C.ltMag : C.ltGold, 'center', 1);
    }
  }

  /* ------------------------------- главный API ----------------------------- */
  function draw(ctx, S) {
    if (!ctx || !S) return;
    var errShown = false;
    ctx.save();
    try {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = C.black;
      ctx.fillRect(0, 0, 960, 600);
      ctx.imageSmoothingEnabled = false;

      if (ensure(ctx) && bctx) {
        // 1) низкий слой 320×200
        drawFrameChrome(bctx, S);
        drawWorld(bctx, S);
        drawHudLow(bctx, S);
        drawOverlaysLow(bctx, S);
        // 2) апскейл ×3
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(buf, 0, 0, W * SCALE, H * SCALE);
      }
      // 3) текстовый слой 960×600
      drawHudText(ctx, S);
      if (!S.paused && (S.mode === 'play' || S.mode === 'bonus' || S.mode === 'dying')) {
        drawPopups(ctx, S);
      }
      drawStateText(ctx, S);
    } catch (e) {
      if (!errShown && global.console && console.error) {
        errShown = true;
        console.error('DG.render.classic:', e);
      }
    } finally {
      ctx.restore();
    }
  }

  DG.render = DG.render || {};
  DG.render.classic = { id: 'classic', draw: draw };
})(window);
