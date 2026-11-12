/* ============================================================================
 * РУСЛО · HTML5 — ядро
 * Константы, математика, хранилище, пиксельный шрифт 5×7 с кириллицей,
 * вспомогательные функции рисования. Без зависимостей, без сети.
 * ========================================================================== */
'use strict';
window.RR = window.RR || {};
(function (RR) {
  /* ---------- геометрия сцены ---------- */
  const W = 360;                 // внутренняя ширина, px
  const H = 540;                 // внутренняя высота, px (портрет 2:3)
  const HUD_H = 48;              // верхняя приборная полоса
  const FOOT_H = 30;             // нижняя полоса (жизни/рекорд)
  const PLAY_TOP = HUD_H;
  const PLAY_H = H - HUD_H - FOOT_H;
  const PLANE_SY = Math.round(PLAY_H * 0.74); // экранная Y самолёта внутри игрового поля
  const ROW = 8;                 // шаг дискретизации реки, px

  Object.assign(RR, { W, H, HUD_H, FOOT_H, PLAY_TOP, PLAY_H, PLANE_SY, ROW, MID: W / 2 });

  /* ---------- математика ---------- */
  RR.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  RR.lerp = (a, b, t) => a + (b - a) * t;
  RR.smooth = (t) => t * t * (3 - 2 * t);
  RR.approach = (v, target, step) => (v < target ? Math.min(v + step, target) : Math.max(v - step, target));
  RR.pad = (n, len) => {
    let s = String(Math.max(0, Math.floor(n)));
    while (s.length < len) s = '0' + s;
    return s.length > len ? s.slice(-len) : s;
  };
  RR.rnd = (a, b) => a + Math.random() * (b - a);
  RR.rndi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));

  /* Детерминированный ПСЧ: mulberry32 */
  RR.mulberry32 = function (seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  /* ---------- localStorage (никогда не бросает) ---------- */
  const STORE_PREFIX = 'ruslo.';
  // Устаревший префикс ключей (прежнее рабочее имя) — только для однократной миграции.
  const LEGACY_STORE_PREFIX = 'riverraid.';
  const STORE_KEYS = ['gfx', 'sound', 'volume', 'hi', 'lang'];
  const LS = {
    get(key, def) {
      try {
        const raw = localStorage.getItem(STORE_PREFIX + key);
        return raw === null ? def : JSON.parse(raw);
      } catch (e) { return def; }
    },
    set(key, val) {
      try { localStorage.setItem(STORE_PREFIX + key, JSON.stringify(val)); } catch (e) { /* приватный режим */ }
    },
    // старый → новый (если нового ещё нет) → удалить старый; до первого чтения настроек
    migrate(ls) {
      try {
        STORE_KEYS.forEach((key) => {
          const v = ls.getItem(LEGACY_STORE_PREFIX + key);
          if (v === null || v === undefined) return;
          if (ls.getItem(STORE_PREFIX + key) === null) ls.setItem(STORE_PREFIX + key, v);
          ls.removeItem(LEGACY_STORE_PREFIX + key);
        });
      } catch (e) { /* приватный режим */ }
    },
  };
  RR.store = LS;
  try { LS.migrate(localStorage); } catch (e) { /* нет хранилища */ }

  /* ---------- шрифт 5×7 ---------- */
  /* Латинские глифы и цифры — стандартная матрица 5×7;
     кириллица нарисована вручную в той же сетке (взята из родственной
     игры студии — РУБИКОНа — и проверена тестом). */
  const FONT = {
    'A': '01110 10001 10001 11111 10001 10001 10001',
    'B': '11110 10001 10001 11110 10001 10001 11110',
    'C': '01110 10001 10000 10000 10000 10001 01110',
    'D': '11110 10001 10001 10001 10001 10001 11110',
    'E': '11111 10000 10000 11110 10000 10000 11111',
    'F': '11111 10000 10000 11110 10000 10000 10000',
    'G': '01110 10001 10000 10111 10001 10001 01110',
    'H': '10001 10001 10001 11111 10001 10001 10001',
    'I': '11111 00100 00100 00100 00100 00100 11111',
    'J': '00111 00010 00010 00010 00010 10010 01100',
    'K': '10001 10010 10100 11000 10100 10010 10001',
    'L': '10000 10000 10000 10000 10000 10000 11111',
    'M': '10001 11011 10101 10001 10001 10001 10001',
    'N': '10001 10001 11001 10101 10011 10001 10001',
    'O': '01110 10001 10001 10001 10001 10001 01110',
    'P': '11110 10001 10001 11110 10000 10000 10000',
    'Q': '01110 10001 10001 10001 10101 10010 01101',
    'R': '11110 10001 10001 11110 10100 10010 10001',
    'S': '01111 10000 10000 01110 00001 00001 11110',
    'T': '11111 00100 00100 00100 00100 00100 00100',
    'U': '10001 10001 10001 10001 10001 10001 01110',
    'V': '10001 10001 10001 10001 10001 01010 00100',
    'W': '10001 10001 10001 10001 10101 11011 10001',
    'X': '10001 10001 01010 00100 01010 10001 10001',
    'Y': '10001 10001 01010 00100 00100 00100 00100',
    'Z': '11111 00001 00010 00100 01000 10000 11111',
    '0': '01110 10001 10011 10101 11001 10001 01110',
    '1': '00100 01100 00100 00100 00100 00100 01110',
    '2': '01110 10001 00001 00010 00100 01000 11111',
    '3': '11110 00001 00001 01110 00001 00001 11110',
    '4': '00010 00110 01010 10010 11111 00010 00010',
    '5': '11111 10000 11110 00001 00001 10001 01110',
    '6': '01110 10000 10000 11110 10001 10001 01110',
    '7': '11111 00001 00010 00100 00100 00100 00100',
    '8': '01110 10001 10001 01110 10001 10001 01110',
    '9': '01110 10001 10001 01111 00001 00001 01110',
    ' ': '00000 00000 00000 00000 00000 00000 00000',
    ':': '00000 00100 00100 00000 00100 00100 00000',
    '.': '00000 00000 00000 00000 00000 00110 00110',
    ',': '00000 00000 00000 00000 00110 00110 00100',
    '-': '00000 00000 00000 11111 00000 00000 00000',
    '_': '00000 00000 00000 00000 00000 00000 11111',
    '/': '00001 00010 00010 00100 01000 01000 10000',
    '!': '00100 00100 00100 00100 00100 00000 00100',
    '?': '01110 10001 00001 00010 00100 00000 00100',
    "'": '00100 00100 00000 00000 00000 00000 00000',
    '(': '00010 00100 01000 01000 01000 00100 00010',
    ')': '01000 00100 00010 00010 00010 00100 01000',
    '+': '00000 00100 00100 11111 00100 00100 00000',
    '=': '00000 00000 11111 00000 11111 00000 00000',
    '*': '00000 10101 01110 11111 01110 10101 00000',
    '<': '00010 00100 01000 10000 01000 00100 00010',
    '>': '01000 00100 00010 00001 00010 00100 01000',
    '"': '01010 01010 00000 00000 00000 00000 00000',
    '%': '11001 11010 00100 01000 10110 00110 00000',
    '@': '01110 10001 10111 10101 10111 10000 01110',
    '·': '00000 00000 00000 00100 00000 00000 00000',
    'А': '01110 10001 10001 11111 10001 10001 10001',
    'Б': '11111 10000 10000 11110 10001 10001 11110',
    'В': '11110 10001 10001 11110 10001 10001 11110',
    'Г': '11111 10000 10000 10000 10000 10000 10000',
    'Д': '00110 01010 01010 01010 01010 11111 10001',
    'Е': '11111 10000 10000 11110 10000 10000 11111',
    'Ё': '01010 00000 11111 10000 11110 10000 11111',
    'Ж': '10101 10101 10101 11111 10101 10101 10101',
    'З': '01110 10001 00001 00110 00001 10001 01110',
    'И': '10001 10001 10011 10101 11001 10001 10001',
    'Й': '01010 10001 10011 10101 11001 10001 10001',
    'К': '10001 10010 10100 11000 10100 10010 10001',
    'Л': '00111 01001 01001 01001 01001 01001 10001',
    'М': '10001 11011 10101 10001 10001 10001 10001',
    'Н': '10001 10001 10001 11111 10001 10001 10001',
    'О': '01110 10001 10001 10001 10001 10001 01110',
    'П': '11111 10001 10001 10001 10001 10001 10001',
    'Р': '11110 10001 10001 11110 10000 10000 10000',
    'С': '01110 10001 10000 10000 10000 10001 01110',
    'Т': '11111 00100 00100 00100 00100 00100 00100',
    'У': '10001 10001 10001 01111 00001 00001 01110',
    'Ф': '00100 01110 10101 10101 10101 01110 00100',
    'Х': '10001 10001 01010 00100 01010 10001 10001',
    'Ц': '10010 10010 10010 10010 10010 11111 00001',
    'Ч': '10001 10001 10001 01111 00001 00001 00001',
    'Ш': '10101 10101 10101 10101 10101 10101 11111',
    'Щ': '10101 10101 10101 10101 10101 11111 00001',
    'Ъ': '11000 01000 01000 01110 01001 01001 01110',
    'Ы': '10001 10001 10001 11101 10011 10011 11101',
    'Ь': '10000 10000 10000 11110 10001 10001 11110',
    'Э': '01110 10001 00001 00111 00001 10001 01110',
    'Ю': '10010 10101 10101 11101 10101 10101 10010',
    'Я': '01111 10001 10001 01111 00101 01001 10001',
  };
  const CHARS = Object.keys(FONT);
  const INDEX = new Map(CHARS.map((c, i) => [c, i]));
  const GLYPH_W = 5, GLYPH_H = 7, ADV = 6;

  /* Проверка целостности шрифта: каждая строка — 5 бит, всего 7 строк. */
  for (const c of CHARS) {
    const rows = FONT[c].split(' ');
    if (rows.length !== GLYPH_H || rows.some((r) => r.length !== GLYPH_W)) {
      throw new Error('rіverraid: битый глиф "' + c + '"');
    }
  }

  const atlasCache = new Map();
  function atlas(color) {
    let cv = atlasCache.get(color);
    if (cv) return cv;
    cv = document.createElement('canvas');
    cv.width = CHARS.length * ADV;
    cv.height = GLYPH_H + 1;
    const g = cv.getContext('2d');
    g.fillStyle = color;
    CHARS.forEach((c, i) => {
      const rows = FONT[c].split(' ');
      for (let y = 0; y < GLYPH_H; y++) {
        for (let x = 0; x < GLYPH_W; x++) {
          if (rows[y][x] === '1') g.fillRect(i * ADV + x, y, 1, 1);
        }
      }
    });
    atlasCache.set(color, cv);
    return cv;
  }

  RR.fontAdvance = ADV;
  RR.pxWidth = (str, scale = 1) => String(str).length * ADV * scale - scale;
  RR.pxHeight = (scale = 1) => GLYPH_H * scale;

  /**
   * Пиксельный текст на canvas.
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} str
   * @param {number} x @param {number} y  (y — верх строки)
   * @param {object} o { color, scale, align: 'left'|'center'|'right', shadow, alpha }
   */
  RR.pxText = function (ctx, str, x, y, o = {}) {
    const color = o.color || '#fff';
    const scale = o.scale || 1;
    const text = String(str).toUpperCase();
    const width = RR.pxWidth(text, scale);
    let px = Math.round(o.align === 'center' ? x - width / 2 : o.align === 'right' ? x - width : x);
    const py = Math.round(y);
    const a = atlas(color);
    const prevAlpha = ctx.globalAlpha;
    if (o.alpha != null) ctx.globalAlpha = prevAlpha * o.alpha;
    if (o.shadow) {
      const sa = atlas(o.shadow);
      const off = Math.max(1, scale);
      for (let i = 0; i < text.length; i++) {
        const ci = INDEX.has(text[i]) ? INDEX.get(text[i]) : INDEX.get('?');
        ctx.drawImage(sa, ci * ADV, 0, ADV, GLYPH_H + 1, px + i * ADV * scale + off, py + off, ADV * scale, (GLYPH_H + 1) * scale);
      }
    }
    for (let i = 0; i < text.length; i++) {
      const ci = INDEX.has(text[i]) ? INDEX.get(text[i]) : INDEX.get('?');
      ctx.drawImage(a, ci * ADV, 0, ADV, GLYPH_H + 1, px + i * ADV * scale, py, ADV * scale, (GLYPH_H + 1) * scale);
    }
    ctx.globalAlpha = prevAlpha;
  };

  /* Системный шрифт для «современного» режима (canvas умеет кириллицу). */
  const SANS = '"SF Pro Display","Segoe UI",system-ui,-apple-system,"Helvetica Neue",Arial,sans-serif';
  RR.SANS = SANS;
  RR.sans = function (ctx, str, x, y, o = {}) {
    const size = o.size || 14;
    const weight = o.weight || 500;
    const spacing = o.spacing ?? 0.5;
    ctx.save();
    ctx.font = weight + ' ' + size + 'px ' + SANS;
    ctx.fillStyle = o.color || '#fff';
    ctx.textAlign = o.align || 'left';
    ctx.textBaseline = o.baseline || 'top';
    if ('letterSpacing' in ctx) ctx.letterSpacing = spacing + 'px';
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = o.glowBlur ?? 12; }
    ctx.fillText(String(str), x, y);
    ctx.restore();
  };

  /* ---------- helpers для canvas ---------- */
  RR.roundRect = function (ctx, x, y, w, h, r) {
    const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  };

  /* ---------- реакции интерфейса ---------- */
  RR.on = { lang: [], gfx: [] };
  RR.onLang = (fn) => RR.on.lang.push(fn);
  RR.onGfx = (fn) => RR.on.gfx.push(fn);
})(window.RR);
