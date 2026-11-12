/* ============================================================
   НЕОН × ЯРОСТЬ: NEON RAGE — RETRO 8-BIT RENDERER
   ------------------------------------------------------------
   window.DD_RENDER_RETRO = { draw(ctx, view) }

   Полностью процедурный 8-битный аркадный рендерер 480×270.
   Палитра ~16 цветов, дизеринг, чанки 2–3 px, пиксельный шрифт
   DD_FONT (6×8, кириллица). Никаких внешних ассетов, fetch, import.
   Состояние игры только читается. Внутренние кэши безопасны.

   Разделы:
     1. палитра и мелкие утилиты
     2. шрифт и текст (1x/2x/3x/4x, центрирование, перенос)
     3. примитивы: панели, полосы, дизеринг, неон, круги
     4. фоны зон: street / arcade / roof + погода
     5. бойцы: comet / hammer / punk / ninja / brute / khrom
     6. бой: HUD, эффекты, баннеры, босс-интро
     7. экраны: title, select, intro, help, settings, about, end
     8. draw() — диспетчер режимов
   ============================================================ */
(function () {
  'use strict';

  /* ============================================================
     1. ПАЛИТРА / УТИЛИТЫ
     ============================================================ */

  var C = {
    ink: '#07050f',      /* почти чёрный */
    bg: '#0a0718',       /* фон */
    shadow: '#1b1440',   /* глубокая тень */
    panel: '#241a4e',    /* панель */
    deep: '#3a2a72',     /* тёмно-фиолетовый */
    purple: '#5a3fa0',   /* фиолетовый */
    lav: '#9a8fc8',      /* серо-лиловый */
    white: '#f4f0ff',    /* белый */
    cyan: '#22e6ff',     /* циан */
    teal: '#0e7d99',     /* тёмный циан */
    magenta: '#ff2e88',  /* маджента */
    wine: '#a0145a',     /* тёмная маджента */
    lime: '#b6ff3a',     /* кислотный лайм */
    green: '#4e8c14',    /* тёмный лайм */
    amber: '#ffb300',    /* янтарь */
    orange: '#ff6a00'    /* оранжевый */
  };

  var PI = Math.PI;
  var TAU = PI * 2;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, k) { return a + (b - a) * k; }
  function easeOut(k) { return 1 - (1 - k) * (1 - k); }
  function easeInOut(k) { return k < 0.5 ? 2 * k * k : 1 - 2 * (1 - k) * (1 - k); }
  /* детерминированный «случайный» 0..1 */
  function rnd(i, seed) {
    var n = Math.sin(i * 127.1 + (seed || 0) * 311.7) * 43758.5453;
    return n - Math.floor(n);
  }
  function rnd2(i, j, seed) {
    var n = Math.sin(i * 127.1 + j * 269.5 + (seed || 0) * 311.7) * 43758.5453;
    return n - Math.floor(n);
  }
  function blink(t, hz) { return (Math.sin(t * (hz || 6)) > 0) ? 1 : 0; }

  function T(key, vars) {
    var DD = window.DD;
    if (DD && typeof DD.t === 'function') {
      try { return DD.t(key, vars); } catch (e) { /* ignore */ }
    }
    var I = window.DD_I18N;
    if (I) {
      var lang = (DD && DD.settings && DD.settings.lang) || 'ru';
      var dict = I[lang] || I.ru;
      var s = dict && dict[key];
      if (s == null) s = key;
      if (vars) {
        Object.keys(vars).forEach(function (k) {
          s = String(s).split('{' + k + '}').join(String(vars[k]));
        });
      }
      return String(s);
    }
    return key;
  }
  function S_() { return (window.DD && window.DD.settings) || {}; }
  function uiOf(S) { return (S && S.uiRects) || {}; }

  /* индексы режимов/актёров */
  function actorDead(a) {
    return !a || a.dead === true || a.hp <= 0 || a.state === 'dead';
  }

  /* ============================================================
     2. ШРИФТ
     ============================================================ */

  var FONT = null; /* window.DD_FONT || window.EX_FONT */
  var FALLBACK = { W: 6, H: 8 };

  function fw() { return FONT && FONT.W ? FONT.W : FALLBACK.W; }
  function fh() { return FONT && FONT.H ? FONT.H : FALLBACK.H; }
  function glyphOf(ch) {
    if (!FONT) return null;
    try {
      if (typeof FONT.glyph === 'function') return FONT.glyph(ch);
      if (FONT.glyphs) return FONT.glyphs[ch] || FONT.glyphs['?'];
    } catch (e) { /* ignore */ }
    return null;
  }

  function textW(str, sc) {
    if (str == null) return 0;
    str = String(str);
    sc = sc || 1;
    return Math.max(0, (str.length * fw() - 1) * sc);
  }

  /* рисует строку попиксельно (без обводки) */
  function textRaw(ctx, str, x, y, sc, color) {
    if (str == null) return;
    str = String(str);
    sc = sc || 1;
    ctx.fillStyle = color;
    var adv = fw();
    var i, r, c, bits, run;
    if (!FONT) {
      /* страховка, если шрифт не подключён (в собранной игре не бывает) */
      ctx.save();
      ctx.font = (8 * sc) + 'px monospace';
      ctx.textBaseline = 'top';
      ctx.fillText(str, x, y);
      ctx.restore();
      return;
    }
    for (i = 0; i < str.length; i++) {
      var g = glyphOf(str.charAt(i));
      if (!g) continue;
      var gx = x + i * adv * sc;
      for (r = 0; r < fh(); r++) {
        bits = g[r] || 0;
        if (!bits) continue;
        c = 0;
        while (c < 6) {
          if (bits & (1 << (5 - c))) {
            run = 1;
            while (c + run < 6 && (bits & (1 << (5 - (c + run))))) run++;
            ctx.fillRect(gx + c * sc, y + r * sc, run * sc, sc);
            c += run;
          } else c++;
        }
      }
    }
  }

  /*
    opt:
      outline: цвет обводки
      outlineW: толщина (px, по умолчанию 1 для scale1, 2 для scale>=2)
      shadow: цвет тени, shadowDX/shadowDY (в пикселях scale)
      alpha: 0..1
  */
  function text(ctx, str, x, y, sc, color, opt) {
    if (str == null || str === '') return;
    opt = opt || {};
    x = Math.round(x); y = Math.round(y);
    sc = sc || 1;
    if (sc < 1) sc = 1;
    var alpha = opt.alpha;
    if (alpha != null) ctx.globalAlpha = clamp(alpha, 0, 1);
    var sh = opt.shadow;
    var dx = opt.shadowDX != null ? opt.shadowDX : 1;
    var dy = opt.shadowDY != null ? opt.shadowDY : 1;
    if (sh) textRaw(ctx, str, x + dx * sc, y + dy * sc, sc, sh);
    var ol = opt.outline;
    if (ol) {
      var ow = opt.outlineW != null ? opt.outlineW : (sc >= 2 ? 2 : 1);
      if (ow < 1) ow = 1;
      var oy, ox;
      for (oy = -ow; oy <= ow; oy += ow) {
        for (ox = -ow; ox <= ow; ox += ow) {
          if (ox === 0 && oy === 0) continue;
          textRaw(ctx, str, x + ox, y + oy, sc, ol);
        }
      }
    }
    textRaw(ctx, str, x, y, sc, color);
    if (alpha != null) ctx.globalAlpha = 1;
  }

  function textC(ctx, str, cx, y, sc, color, opt) {
    text(ctx, str, Math.round(cx - textW(str, sc) / 2), y, sc, color, opt);
  }
  function textR(ctx, str, rx, y, sc, color, opt) {
    text(ctx, str, Math.round(rx - textW(str, sc)), y, sc, color, opt);
  }
  function textL(ctx, str, x, y, sc, color, opt) {
    text(ctx, str, Math.round(x), y, sc, color, opt);
  }

  /* разбивка на строки по ширине (в пикселях при данном scale) */
  function wrap(str, maxW, sc) {
    sc = sc || 1;
    str = String(str == null ? '' : str);
    var words = str.split(' ');
    var lines = [];
    var line = '';
    var i;
    for (i = 0; i < words.length; i++) {
      var w = words[i];
      var test = line ? line + ' ' + w : w;
      if (textW(test, sc) > maxW && line) {
        lines.push(line);
        line = w;
      } else line = test;
    }
    if (line) lines.push(line);
    return lines;
  }

  /* рисует перенесённый текст, возвращает высоту */
  function textWrap(ctx, str, x, y, maxW, sc, color, lineH, opt) {
    var lines = wrap(str, maxW, sc);
    lineH = lineH || (fh() + 2) * sc;
    for (var i = 0; i < lines.length; i++) {
      text(ctx, lines[i], x, y + i * lineH, sc, color, opt);
    }
    return lines.length * lineH;
  }
  function textWrapC(ctx, str, cx, y, maxW, sc, color, lineH, opt) {
    var lines = wrap(str, maxW, sc);
    lineH = lineH || (fh() + 2) * sc;
    for (var i = 0; i < lines.length; i++) {
      textC(ctx, lines[i], cx, y + i * lineH, sc, color, opt);
    }
    return lines.length * lineH;
  }

  /* ============================================================
     3. ПРИМИТИВЫ
     ============================================================ */

  function fill(ctx, x, y, w, h, color) {
    if (w <= 0 || h <= 0) return;
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }
  function lineH_(ctx, x, y, w, color, h) { fill(ctx, x, y, w, h || 1, color); }
  function lineV_(ctx, x, y, h, color, w) { fill(ctx, x, y, w || 1, h, color); }
  function rectB(ctx, x, y, w, h, color) { /* контур 1px */
    fill(ctx, x, y, w, 1, color); fill(ctx, x, y + h - 1, w, 1, color);
    fill(ctx, x, y, 1, h, color); fill(ctx, x + w - 1, y, 1, h, color);
  }

  /* --- дизеринг-паттерны (кэш) --- */
  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  var patCache = {};
  function ditherPat(ctx, a, b, level) {
    var lv = Math.round(clamp(level, 0, 1) * 16);
    var key = a + '|' + b + '|' + lv;
    if (patCache[key]) return patCache[key];
    var cv = document.createElement('canvas');
    cv.width = 4; cv.height = 4;
    var g = cv.getContext('2d');
    for (var y = 0; y < 4; y++) {
      for (var x = 0; x < 4; x++) {
        g.fillStyle = BAYER[y * 4 + x] < lv ? b : a;
        g.fillRect(x, y, 1, 1);
      }
    }
    var p = ctx.createPattern(cv, 'repeat');
    patCache[key] = p;
    return p;
  }
  function dith(ctx, x, y, w, h, a, b, level) {
    if (w <= 0 || h <= 0) return;
    ctx.fillStyle = ditherPat(ctx, a, b, level);
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  /* вертикальный градиент из палитровых полос с дизерингом на стыках */
  function vGrad(ctx, x, y, w, h, colors, soft) {
    var n = colors.length;
    if (!n) return;
    var band = h / n;
    var i;
    for (i = 0; i < n; i++) {
      fill(ctx, x, y + i * band - 0.5, w, band + 1, colors[i]);
    }
    if (soft !== false) {
      for (i = 1; i < n; i++) {
        dith(ctx, x, y + i * band - 2, w, 2, colors[i - 1], colors[i], 0.5);
      }
    }
  }

  /* панель в 8-битном стиле */
  function panel(ctx, x, y, w, h, opt) {
    opt = opt || {};
    var bg = opt.bg || C.panel;
    var lt = opt.light || C.deep;
    var dk = opt.dark || C.ink;
    fill(ctx, x, y, w, h, bg);
    fill(ctx, x, y, w, 1, lt);
    fill(ctx, x, y, 1, h, lt);
    fill(ctx, x, y + h - 1, w, 1, dk);
    fill(ctx, x + w - 1, y, 1, h, dk);
    if (opt.border) rectB(ctx, x - 1, y - 1, w + 2, h + 2, opt.border);
    /* скос углов */
    if (opt.notch !== false) {
      fill(ctx, x, y, 1, 1, opt.corner || dk);
      fill(ctx, x + w - 1, y, 1, 1, opt.corner || dk);
      fill(ctx, x, y + h - 1, 1, 1, opt.corner || dk);
      fill(ctx, x + w - 1, y + h - 1, 1, 1, opt.corner || dk);
    }
  }

  /* уголки-кронштейны */
  function brackets(ctx, x, y, w, h, color, len) {
    len = len || 4;
    fill(ctx, x, y, len, 1, color);
    fill(ctx, x, y, 1, len, color);
    fill(ctx, x + w - len, y, len, 1, color);
    fill(ctx, x + w - 1, y, 1, len, color);
    fill(ctx, x, y + h - 1, len, 1, color);
    fill(ctx, x, y + h - len, 1, len, color);
    fill(ctx, x + w - len, y + h - 1, len, 1, color);
    fill(ctx, x + w - 1, y + h - len, 1, len, color);
  }

  /* полоса (hp/rage/boss) */
  function drawBar(ctx, x, y, w, h, ratio, opt) {
    opt = opt || {};
    ratio = clamp(ratio, 0, 1);
    var bg = opt.bg || C.ink;
    var fg = opt.fg || C.lime;
    var frame = opt.frame || C.shadow;
    fill(ctx, x - 1, y - 1, w + 2, h + 2, C.ink);
    fill(ctx, x, y, w, h, bg);
    var iw = Math.round((w - 2) * ratio);
    if (iw > 0) {
      fill(ctx, x + 1, y + 1, iw, h - 2, fg);
      if (opt.hi) fill(ctx, x + 1, y + 1, iw, 1, opt.hi);
      if (opt.lo) fill(ctx, x + 1, y + h - 2, iw, 1, opt.lo);
    }
    /* сегменты */
    var seg = opt.seg || 0;
    if (seg > 0) {
      for (var sx = x + seg; sx < x + w - 1; sx += seg) {
        fill(ctx, sx, y + 1, 1, h - 2, C.ink);
      }
    }
    rectB(ctx, x, y, w, h, frame);
  }

  /* пиксельный круг заполненный (ряды по 2px для чанковости) */
  function disc(ctx, cx, cy, r, color, step) {
    step = step || 1;
    ctx.fillStyle = color;
    for (var dy = -r; dy <= r; dy += step) {
      var w = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy)));
      if (w <= 0) continue;
      ctx.fillRect(Math.round(cx - w), Math.round(cy + dy), w * 2 + 1, step);
    }
  }
  function ring(ctx, cx, cy, r, color, thick) {
    thick = thick || 1;
    var prev = -1;
    for (var dy = -r; dy <= r; dy += 2) {
      var w = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy)));
      if (w <= 0) continue;
      if (prev < 0 || w <= prev - thick) {
        fill(ctx, cx - w, cy + dy, 2, 2, color);
        fill(ctx, cx + w - 1, cy + dy, 2, 2, color);
      }
      prev = w;
    }
  }

  /* пиксельная тень-эллипс */
  function shadowEllipse(ctx, cx, cy, rx, ry, color) {
    ry = Math.max(1, ry);
    for (var dy = -ry; dy <= ry; dy += 2) {
      var k = 1 - (dy * dy) / (ry * ry + 0.001);
      var w = Math.floor(rx * Math.sqrt(Math.max(0, k)));
      if (w <= 0) continue;
      fill(ctx, cx - w, cy + dy, w * 2, 2, color);
    }
  }

  /* неоновое свечение прямоугольником (ступенчатое, без blur) */
  function neonGlow(ctx, x, y, w, h, color, size, level) {
    var s = size || 4;
    dith(ctx, x - s, y - s, w + s * 2, h + s * 2, C.ink, color, level != null ? level : 0.3);
    dith(ctx, x - 1, y - 1, w + 2, h + 2, C.ink, color, 0.55);
  }

  /* рамка-свечение вокруг прямоугольника (тонкое, не заливка) */
  function glowFrame(ctx, x, y, w, h, color, level) {
    var lv = level != null ? level : 0.45;
    dith(ctx, x - 3, y - 3, w + 6, 3, C.ink, color, lv);
    dith(ctx, x - 3, y + h, w + 6, 3, C.ink, color, lv);
    dith(ctx, x - 3, y, 3, h, C.ink, color, lv);
    dith(ctx, x + w, y, 3, h, C.ink, color, lv);
  }

  /* неоновая вывеска с миганием */
  function neonSign(ctx, x, y, w, h, label, color, t, sc, opt) {
    opt = opt || {};
    var flick = 1;
    var ph = rnd(x + y, 3);
    if (ph > 0.8) {
      var s = Math.sin(t * 9 + ph * 30);
      if (s > 0.93) flick = 0.25;
    }
    var a = (opt.alpha != null ? opt.alpha : 1) * flick;
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    if (a > 0.3) {
      glowFrame(ctx, x - 1, y - 1, w + 2, h + 2, color, 0.35);
      /* подложка */
      fill(ctx, x, y, w, h, C.ink);
      fill(ctx, x, y, w, 1, C.deep);
      fill(ctx, x, y, 1, h, C.shadow);
      fill(ctx, x + w - 1, y, 1, h, C.ink);
      fill(ctx, x, y + h - 1, w, 1, C.ink);
      /* неоновая рамка-трубка */
      fill(ctx, x + 1, y + 1, w - 2, 1, color);
      fill(ctx, x + 1, y + h - 2, w - 2, 1, color);
      fill(ctx, x + 1, y + 1, 1, h - 2, color);
      fill(ctx, x + w - 2, y + 1, 1, h - 2, color);
      /* уголки */
      fill(ctx, x + 1, y + 1, 1, 1, C.white);
      fill(ctx, x + w - 2, y + h - 2, 1, 1, C.white);
      /* текст */
      var ty = Math.round(y + (h - fh() * sc) / 2);
      textC(ctx, label, x + w / 2, ty, sc, color, { outline: C.ink, outlineW: sc >= 2 ? 1 : 1, alpha: a });
      if (sc === 1) textC(ctx, label, x + w / 2, ty, 1, color, { alpha: a * 0.5 });
    } else {
      /* вывеска «моргнула» */
      fill(ctx, x, y, w, h, C.ink);
      fill(ctx, x, y, w, 1, C.shadow);
      fill(ctx, x + 1, y + 1, w - 2, 1, C.wine);
      textC(ctx, label, x + w / 2, Math.round(y + (h - fh() * sc) / 2), sc, C.wine, { alpha: 0.5 });
    }
  }

  /* вертикальная неоновая вывеска (буквы столбиком) */
  function neonSignV(ctx, x, y, label, color, t, sc) {
    sc = sc || 1;
    var flick = Math.sin(t * 7 + x * 0.3) > 0.95 ? 0.4 : 1;
    var w = 10 * sc + 8;
    var h = label.length * (fh() + 2) * sc + 8;
    x = Math.round(x); y = Math.round(y);
    glowFrame(ctx, x - 1, y - 1, w + 2, h + 2, color, 0.3);
    fill(ctx, x, y, w, h, C.ink);
    fill(ctx, x, y, w, 1, C.deep);
    fill(ctx, x, y + h - 1, w, 1, C.ink);
    fill(ctx, x, y, 1, h, C.shadow);
    fill(ctx, x + w - 1, y, 1, h, C.ink);
    /* неоновая трубка по контуру */
    fill(ctx, x + 1, y + 1, w - 2, 1, color);
    fill(ctx, x + 1, y + h - 2, w - 2, 1, color);
    fill(ctx, x + 1, y + 1, 1, h - 2, color);
    fill(ctx, x + w - 2, y + 1, 1, h - 2, color);
    for (var i = 0; i < label.length; i++) {
      textC(ctx, label.charAt(i), x + w / 2, y + 5 + i * (fh() + 2) * sc, sc, color, {
        alpha: flick, outline: C.ink, outlineW: 1
      });
    }
    return { w: w, h: h };
  }

  /* ============================================================
     UI-КОМПОНЕНТЫ: чипы быстрых настроек, меню, подсказки
     ============================================================ */

  var FB = null;
  function fallbackRects() {
    if (FB) return FB;
    FB = {
      menu: [], quick: [], pause: [], settings: [], chars: [], diffs: [], end: [],
      back: { x: 40, y: 246, w: 120, h: 16 },
      selectStart: { x: 168, y: 238, w: 144, h: 18 }
    };
    var i;
    for (i = 0; i < 4; i++) FB.menu.push({ x: 160, y: 164 + i * 21, w: 160, h: 18, action: ['play', 'help', 'settings', 'about'][i] });
    for (i = 0; i < 4; i++) FB.quick.push({ x: 250 + i * 56, y: 8, w: 52, h: 13, action: ['gfx', 'lang', 'music', 'fullscreen'][i] });
    for (i = 0; i < 4; i++) FB.pause.push({ x: 160, y: 112 + i * 21, w: 160, h: 18, action: ['resume', 'settings', 'restart', 'title'][i] });
    var sid = ['lang', 'gfx', 'music', 'audioStyle', 'sfx', 'volume', 'crt', 'difficulty', 'reset'];
    for (i = 0; i < 9; i++) FB.settings.push({ x: 96, y: 76 + i * 17, w: 288, h: 15, id: sid[i] });
    FB.chars.push({ x: 36, y: 52, w: 198, h: 150, index: 0 });
    FB.chars.push({ x: 246, y: 52, w: 198, h: 150, index: 1 });
    for (i = 0; i < 3; i++) FB.diffs.push({ x: 150 + i * 70, y: 216, w: 64, h: 18, index: i });
    for (i = 0; i < 2; i++) FB.end.push({ x: 170, y: 188 + i * 22, w: 140, h: 18, action: i === 0 ? 'retry' : 'title' });
    return FB;
  }
  function rects(S, name) {
    var u = uiOf(S);
    var a = u[name];
    if (a && a.length) return a;
    return fallbackRects()[name];
  }
  function rect1(S, name) {
    var u = uiOf(S);
    return u[name] || fallbackRects()[name];
  }

  var quickActionIdx = { gfx: 0, lang: 1, music: 2, fullscreen: 3 };
  function quickValue(S, action, t) {
    var st = S_();
    if (action === 'gfx') return st.gfx === 'modern' ? 'NEON' : '8BIT';
    if (action === 'lang') return (st.lang || 'ru') === 'en' ? 'EN' : 'RU';
    if (action === 'music') return st.music ? T('common.on') : T('common.off');
    return '';
  }
  function drawQuickChips(ctx, S, t) {
    var qs = rects(S, 'quick');
    var i;
    for (i = 0; i < qs.length; i++) {
      var r = qs[i];
      if (!r) continue;
      var action = r.action || ['gfx', 'lang', 'music', 'fullscreen'][i] || '';
      var x = Math.round(r.x), y = Math.round(r.y), w = Math.round(r.w), h = Math.round(r.h);
      var active = (action === 'gfx') ? S_().gfx !== 'modern'
        : (action === 'music') ? !!S_().music
          : (action === 'fullscreen') ? true : false;
      var accent = action === 'gfx' ? C.cyan : action === 'lang' ? C.amber : action === 'music' ? C.magenta : C.lime;
      fill(ctx, x, y, w, h, C.ink);
      rectB(ctx, x, y, w, h, C.shadow);
      fill(ctx, x + 1, y + 1, 2, h - 2, active ? accent : C.deep);
      var key = action === 'gfx' ? 'G' : action === 'lang' ? 'L' : action === 'music' ? 'M' : 'F';
      text(ctx, key, x + 5, y + 3, 1, active ? accent : C.lav, null);
      if (action === 'fullscreen') {
        /* иконка экрана */
        rectB(ctx, x + 13, y + 4, 9, 7, active ? C.white : C.lav);
        fill(ctx, x + 16, y + 6, 4, 3, active ? C.lime : C.deep);
      } else {
        var val = quickValue(S, action, t);
        if (textW(val, 1) > w - 17) {
          textR(ctx, val, x + w - 4, y + 3, 1, active ? C.white : C.lav, null);
        } else {
          text(ctx, val, x + 13, y + 3, 1, active ? C.white : C.lav, null);
        }
      }
    }
  }

  /* пункт меню */
  function drawMenuItem(ctx, r, label, selected, t, opt) {
    opt = opt || {};
    if (!r) return;
    var x = Math.round(r.x), y = Math.round(r.y), w = Math.round(r.w), h = Math.round(r.h);
    var sc = opt.scale || (h >= 17 && textW(label, 2) <= w - 22 ? 2 : 1);
    var accent = opt.accent || C.magenta;
    if (selected) {
      dith(ctx, x - 4, y - 2, w + 8, h + 4, C.ink, accent, 0.3);
      panel(ctx, x, y, w, h, { bg: C.panel, light: C.purple, dark: C.ink, border: accent });
      fill(ctx, x, y, w, 1, accent);
      fill(ctx, x, y + h - 1, w, 1, accent);
      /* бегущие косые штрихи у краёв */
      var phase = Math.floor(t * 14) % 8;
      for (var d = 0; d < 6; d++) {
        var sx = x + 6 + ((d * 9 + phase * 3) % Math.max(1, w - 14));
        fill(ctx, sx, y + 2, 1, 1, C.amber);
        fill(ctx, sx, y + h - 3, 1, 1, C.amber);
      }
      var bob = Math.sin(t * 6) > 0 ? C.amber : C.lime;
      text(ctx, '►', x - 12, y + Math.round((h - 8) / 2), 1, bob, { outline: C.ink, outlineW: 1 });
      text(ctx, '◄', x + w + 5, y + Math.round((h - 8) / 2), 1, bob, { outline: C.ink, outlineW: 1 });
      brackets(ctx, x - 3, y - 3, w + 6, h + 6, C.amber, 3);
      textC(ctx, label, x + w / 2, y + Math.round((h - fh() * sc) / 2), sc, C.white, { outline: C.ink, outlineW: 1, shadow: C.wine, shadowDX: 2, shadowDY: 2 });
    } else {
      fill(ctx, x, y, w, h, C.ink);
      dith(ctx, x, y, w, h, C.ink, C.shadow, 0.25);
      rectB(ctx, x, y, w, h, C.shadow);
      textC(ctx, label, x + w / 2, y + Math.round((h - fh() * sc) / 2), sc, C.white, { outline: C.ink, outlineW: 1, alpha: 0.88 });
    }
  }

  function drawMenuList(ctx, S, t, which, labels, keys, index, opt) {
    var rs = rects(S, which);
    var n = Math.min(rs.length, labels.length);
    for (var i = 0; i < n; i++) {
      drawMenuItem(ctx, rs[i], T(labels[i]), i === index, t, opt);
    }
  }

  /* нижняя подсказка-строка */
  function hintLine(ctx, label, y, color, t) {
    var s = label;
    var w = textW(s, 1);
    var x = 240 - w / 2;
    fill(ctx, x - 8, y - 2, w + 16, 11, C.ink);
    dith(ctx, x - 8, y - 2, w + 16, 11, C.ink, C.shadow, 0.4);
    textC(ctx, s, 240, y, 1, color || C.lav, null);
  }

  /* верхняя строка «НАЗВАНИЕ» экрана */
  function screenTitle(ctx, label, sub, t) {
    fill(ctx, 0, 22, 480, 3, C.ink);
    dith(ctx, 0, 25, 480, 2, C.ink, C.magenta, 0.35);
    textC(ctx, label, 240, 28, 2, C.white, { outline: C.ink, outlineW: 2, shadow: C.wine, shadowDX: 2, shadowDY: 2 });
    if (sub) {
      textC(ctx, sub, 240, 46, 1, C.cyan, { shadow: C.ink, shadowDX: 1, shadowDY: 1 });
    }
  }

  /* ============================================================
     ДИСПЕТЧЕР
     ============================================================ */
  function drawScreen(ctx, view) {
    var W = (view && view.w) || 480;
    var H = (view && view.h) || 270;
    FONT = window.DD_FONT || window.EX_FONT || null;
    ctx.imageSmoothingEnabled = false;
    var DD = window.DD || {};
    var S = DD.state || {};
    var t = (view && view.t != null) ? view.t : (S.t || 0);
    var mode = S.mode || 'title';

    fill(ctx, 0, 0, W, H, C.ink);

    if (mode === 'title') screenTitleMain(ctx, S, t);
    else if (mode === 'select') screenSelect(ctx, S, t);
    else if (mode === 'intro') screenIntro(ctx, S, t);
    else if (mode === 'help') screenHelp(ctx, S, t);
    else if (mode === 'settings') screenSettings(ctx, S, t);
    else if (mode === 'about') screenAbout(ctx, S, t);
    else if (mode === 'play') screenPlay(ctx, S, t, 0);
    else if (mode === 'paused') screenPlay(ctx, S, t, 1);
    else if (mode === 'dead') screenPlay(ctx, S, t, 2);
    else if (mode === 'gameover') screenEnd(ctx, S, t, 0);
    else if (mode === 'victory') screenEnd(ctx, S, t, 1);
    else screenTitleMain(ctx, S, t);
  }

  /* ============================================================
     СЛУЖЕБНЫЕ ЗАГЛУШКИ (заполняются ниже в файле)
     ============================================================ */
  function screenTitleMain(ctx, S, t) { drawTitleScreen(ctx, S, t); }

  /* ============================================================
     4. ФОНЫ: ОБЩИЕ ЭЛЕМЕНТЫ
     ============================================================ */

  function norm(v, m) { return ((v % m) + m) % m; }
  function camOf(S) {
    var c = (S && S.camera) || {};
    return {
      x: +c.x || 0,
      sx: +c.shakeX || 0,
      sy: +c.shakeY || 0,
      shake: +c.shake || 0
    };
  }

  function drawStars(ctx, t, horizon, camx) {
    var i, x, y, s;
    for (i = 0; i < 52; i++) {
      x = norm(rnd(i, 1) * 600 - camx * 0.02, 600) - 60;
      y = Math.floor(rnd(i, 2) * (horizon - 18)) + 4;
      if (x < -4 || x > 484) continue;
      s = rnd(i, 3);
      if (s > 0.85) {
        /* крестик-звезда */
        if (Math.sin(t * 2 + i * 1.7) > -0.4) {
          fill(ctx, x - 1, y, 3, 1, C.lav);
          fill(ctx, x, y - 1, 1, 3, C.lav);
        }
      } else if (s > 0.35) {
        fill(ctx, x, y, 1, 1, (Math.sin(t * 3 + i) > 0.2) ? C.white : C.lav);
      } else if (Math.sin(t * 2.2 + i * 0.9) > 0.5) {
        fill(ctx, x, y, 1, 1, C.purple);
      }
    }
  }

  function drawMoon(ctx, cx, cy, r, t, opt) {
    opt = opt || {};
    dith(ctx, cx - r - 9, cy - r - 9, r * 2 + 18, r * 2 + 18, C.bg, C.shadow, 0.25);
    disc(ctx, cx, cy, r + 3, C.shadow);
    disc(ctx, cx, cy, r, opt.color || C.white);
    /* моря/кратеры */
    if (!opt.plain) {
      disc(ctx, cx - r * 0.3, cy - r * 0.15, Math.max(2, r * 0.22), C.lav);
      disc(ctx, cx + r * 0.25, cy + r * 0.3, Math.max(2, r * 0.17), C.lav);
      disc(ctx, cx + r * 0.4, cy - r * 0.35, Math.max(1, r * 0.1), C.lav);
      fill(ctx, cx - r * 0.55, cy + r * 0.1, 2, 2, C.lav);
    }
    /* облачная полоса поверх */
    if (opt.cloud !== false) {
      ctx.globalAlpha = 0.5;
      fill(ctx, cx - r * 0.9, cy - 3, r * 0.9, 2, C.shadow);
      fill(ctx, cx + r * 0.1, cy + 3, r * 0.7, 2, C.shadow);
      fill(ctx, cx - r * 0.2, cy - 8, r * 0.5, 1, C.shadow);
      ctx.globalAlpha = 1;
    }
  }

  function drawCloud(ctx, x, y, w, color) {
    color = color || C.shadow;
    var h = 3;
    fill(ctx, x + 3, y, w - 6, h, color);
    fill(ctx, x, y + h, w, h, color);
    fill(ctx, x + 2, y + h * 2, w - 4, h, color);
    dith(ctx, x + 2, y + h * 3, w - 4, 2, C.bg, C.shadow, 0.5);
  }
  function drawClouds(ctx, camx, t, baseY, color) {
    var i;
    for (i = 0; i < 6; i++) {
      var x = norm(rnd(i, 9) * 640 + t * (2 + rnd(i, 5) * 5) - camx * 0.04, 640) - 100;
      var y = baseY + rnd(i, 3) * 26;
      if (x > -140 && x < 500) drawCloud(ctx, x, y, 46 + rnd(i, 4) * 54, color);
    }
  }

  function drawRain(ctx, t, camx, opt) {
    opt = opt || {};
    var density = opt.density != null ? opt.density : 74;
    var alpha = opt.alpha != null ? opt.alpha : 0.55;
    var top = opt.top != null ? opt.top : 0;
    var bot = opt.bottom != null ? opt.bottom : 270;
    var i, sp, x, y;
    ctx.globalAlpha = alpha;
    for (i = 0; i < density; i++) {
      sp = (210 + rnd(i, 3) * 260) * (opt.speed || 1);
      x = norm(rnd(i, 1) * 620 - camx * 0.06 + t * 30 * (0.4 + rnd(i, 6)), 620) - 60;
      y = top + norm(rnd(i, 2) * (bot - top) + t * sp, bot - top);
      if (x < -4 || x > 484) continue;
      fill(ctx, x, y, (i % 9 === 0) ? 2 : 1, (i % 5 === 0) ? 5 : 3, (i % 4 === 0) ? C.white : (i % 3 ? C.lav : C.teal));
    }
    ctx.globalAlpha = 1;
    /* брызги у земли */
    if (opt.splash !== false) {
      for (i = 0; i < 18; i++) {
        var px = norm(rnd(i, 21) * 560 - camx, 560) - 40;
        var py = 166 + rnd(i, 22) * 88;
        var ph = norm(t * 4 + rnd(i, 23), 1);
        if (ph < 0.18) {
          fill(ctx, px, py, 2, 1, C.lav);
          if (ph < 0.09) fill(ctx, px, py - 2, 1, 2, C.lav);
        }
      }
    }
  }

  /* ============================================================
     ГОРОДСКОЙ СКАЙЛАЙН
     ============================================================ */
  function drawSkyline(ctx, camx, t, o) {
    var f = o.f == null ? 0.3 : o.f;
    var tileW = o.tileW || 96;
    var baseY = o.baseY || 160;
    var off = camx * f;
    var start = Math.floor((off - 160) / tileW);
    var end = Math.ceil((off + 480 + 160) / tileW);
    var signPal = [C.magenta, C.cyan, C.amber, C.lime];
    for (var i = start; i <= end; i++) {
      var r1 = rnd(i, o.seed || 1);
      var r2 = rnd(i + 7, o.seed || 1);
      var r3 = rnd(i + 19, o.seed || 1);
      var w = Math.round(tileW * (0.58 + r1 * 0.4));
      var h = Math.round(o.minH + r2 * (o.maxH - o.minH));
      var bx = Math.round(i * tileW - off + (tileW - w) * 0.5);
      var by = baseY - h;
      if (bx > 484 || bx + w < -4) continue;
      fill(ctx, bx, by, w, h, o.color);
      /* крыша: парапет, труба, антенна */
      fill(ctx, bx, by, w, 1, o.edge || C.shadow);
      fill(ctx, bx, by, 1, h, o.edge || C.shadow);
      fill(ctx, bx + w - 1, by, 1, h, C.ink);
      if (r3 > 0.55) {
        var ax = bx + 3 + Math.floor(r1 * (w - 8));
        lineV_(ctx, ax, by - 6 - Math.floor(r2 * 10), 6 + Math.floor(r2 * 10), o.color);
        fill(ctx, ax - 1, by - 6 - Math.floor(r2 * 10), 3, 1, o.color);
      }
      if (r2 > 0.82 && w > 26) {
        /* водонапорная башня */
        var tx = bx + Math.round(w * 0.5) - 7;
        fill(ctx, tx, by - 15, 14, 9, o.color);
        fill(ctx, tx + 1, by - 15, 12, 1, C.ink);
        fill(ctx, tx + 2, by - 6, 1, 6, o.color);
        fill(ctx, tx + 11, by - 6, 1, 6, o.color);
      }
      /* окна */
      if (o.win !== false) {
        var cols = Math.floor((w - 5) / 7);
        var rows = Math.min(15, Math.floor((h - 7) / 8));
        for (var r = 0; r < rows; r++) {
          for (var c = 0; c < cols; c++) {
            var hv = rnd2(i * 13 + c, r, o.seed || 1);
            if (hv > (o.winProb || 0.22)) continue;
            var wc = (rnd2(c, r, i) > 0.82) ? (o.win2 || C.cyan) : (o.win1 || C.amber);
            if (rnd2(c, r, i + 5) > 0.93 && Math.sin(t * 4.5 + c * 1.3 + r) > 0.6) continue;
            fill(ctx, bx + 4 + c * 7, by + 6 + r * 8, 2, 2, wc);
          }
        }
      }
      /* неоновая вывеска на здании */
      if (o.signs && w > 46 && r1 > (o.signChance == null ? 0.5 : o.signChance)) {
        var lbl = o.signs[i % o.signs.length];
        var bw = textW(lbl, 1) + 8;
        var bh = 11;
        var sx = bx + Math.round((w - bw) / 2);
        var sy = by + 6;
        if (sy + bh < baseY - 8) {
          neonSign(ctx, sx, sy, bw, bh, lbl, signPal[norm(i, 4)], t, 1, { board: true });
        }
      }
      /* вертикальная вывеска-клин */
      if (o.vertical && r3 > 0.78 && h > 70) {
        neonSignV(ctx, bx + w - 11, by + 10, o.vertical[i % o.vertical.length], signPal[norm(i + 2, 4)], t, 1);
      }
    }
  }

  function drawWires(ctx, camx, t, y, sag, color) {
    var off = camx * 0.5;
    var x, yy;
    for (x = -40; x < 520; x += 1) {
      yy = y + Math.round(Math.sin((x + off) * 0.018) * sag);
      if (x === -40) continue;
      fill(ctx, x, yy, 1, 1, color);
    }
    /* подвесные фонарики */
    for (var i = 0; i < 3; i++) {
      var lx = Math.round(norm(i * 170 + 40 - off, 510)) - 15;
      var ly = y + Math.round(Math.sin((lx + off) * 0.018) * sag);
      if (lx < -10 || lx > 490) continue;
      fill(ctx, lx, ly, 1, 3, C.ink);
      fill(ctx, lx - 2, ly + 3, 5, 4, C.ink);
      fill(ctx, lx - 1, ly + 4, 3, 2, (Math.sin(t * 3 + i) > 0.7) ? C.amber : C.orange);
      neonGlow(ctx, lx - 1, ly + 4, 3, 2, C.amber, 5, 0.35);
    }
  }

  /* асфальт / тротуар улицы */
  function drawPuddle(ctx, x, y, w, h, t, seed, colors) {
    var i, a;
    shadowEllipse(ctx, x, y, w / 2, h / 2, C.ink);
    /* отражения неона */
    for (i = 0; i < 5; i++) {
      var col = colors[i % colors.length];
      var rx = x - w * 0.34 + rnd(i, seed) * w * 0.6;
      var ry = y - h * 0.2 + rnd(i + 3, seed) * h * 0.4;
      var rw = 3 + Math.floor(rnd(i + 7, seed) * (w * 0.22));
      a = 0.45 + Math.sin(t * 2 + i) * 0.12;
      ctx.globalAlpha = a;
      fill(ctx, rx, ry, rw, 1, col);
      fill(ctx, rx + 1, ry + 2, Math.max(2, rw - 2), 1, col);
      ctx.globalAlpha = 1;
    }
    fill(ctx, x - w * 0.2, y - 3, 2, 1, C.white);
    fill(ctx, x + w * 0.22, y + 2, 3, 1, C.lav);
  }

  function drawStreetFloor(ctx, S, t) {
    var camx = camOf(S).x;
    var gt = 158, gb = 258;
    var i, x;
    /* дальний тротуар */
    fill(ctx, 0, gt, 480, 12, C.panel);
    dith(ctx, 0, gt, 480, 12, C.panel, C.shadow, 0.5);
    fill(ctx, 0, gt, 480, 1, C.deep);
    var off = norm(camx, 32);
    for (x = -off; x < 480; x += 32) fill(ctx, x, gt + 1, 1, 10, C.shadow);
    /* бордюр */
    fill(ctx, 0, gt + 11, 480, 3, C.purple);
    fill(ctx, 0, gt + 13, 480, 1, C.ink);
    fill(ctx, 0, gt + 14, 480, 2, C.shadow);
    /* дорога */
    vGrad(ctx, 0, gt + 16, 480, gb - gt - 16, [C.shadow, C.bg, C.ink], true);
    /* швы перспективы */
    fill(ctx, 0, gt + 30, 480, 1, C.ink);
    fill(ctx, 0, gt + 46, 480, 1, C.bg);
    fill(ctx, 0, gt + 66, 480, 1, C.ink);
    dith(ctx, 0, gt + 31, 480, 2, C.shadow, C.bg, 0.5);
    /* разметка */
    var off2 = norm(camx, 46);
    for (x = -off2; x < 480; x += 46) {
      fill(ctx, x, 211, 17, 2, C.amber);
      fill(ctx, x, 211, 17, 1, C.white);
    }
    /* люки */
    var moff = norm(camx, 380);
    for (i = 0; i < 2; i++) {
      var mx = i * 380 + 190 - moff;
      if (mx > -20 && mx < 500) {
        shadowEllipse(ctx, mx, 238, 11, 3, C.ink);
        fill(ctx, mx - 9, 236, 18, 4, C.panel);
        fill(ctx, mx - 9, 236, 18, 1, C.deep);
        for (var d = -6; d <= 6; d += 3) fill(ctx, mx + d, 237, 1, 2, C.ink);
      }
    }
    /* лужи */
    var poff = norm(camx, 560);
    drawPuddle(ctx, 84 - poff, 202, 58, 12, t, 1, [C.magenta, C.cyan, C.amber]);
    drawPuddle(ctx, 306 - poff, 226, 74, 14, t, 2, [C.cyan, C.magenta, C.lime]);
    drawPuddle(ctx, 516 - poff, 198, 50, 10, t, 3, [C.amber, C.magenta, C.cyan]);
    /* трещины и мусор */
    for (i = 0; i < 10; i++) {
      var cx = norm(rnd(i, 31) * 560 - camx, 560) - 40;
      var cy = 176 + rnd(i, 32) * 76;
      fill(ctx, cx, cy, 2 + rnd(i, 33) * 8, 1, C.ink);
      if (rnd(i, 34) > 0.6) fill(ctx, cx + 3, cy + 1, 1, 2, C.ink);
    }
    for (i = 0; i < 6; i++) {
      var lx = norm(rnd(i, 41) * 560 - camx, 560) - 30;
      var ly = 170 + rnd(i, 42) * 80;
      fill(ctx, lx, ly, 3, 2, rnd(i, 43) > 0.5 ? C.lav : C.panel);
    }
    /* передний бортик / виньетка */
    fill(ctx, 0, gb, 480, 12, C.ink);
    fill(ctx, 0, gb, 480, 1, C.deep);
    dith(ctx, 0, gb + 2, 480, 10, C.ink, C.bg, 0.5);
    fill(ctx, 0, 266, 480, 4, C.ink);
  }

  /* ============================================================
     STREET
     ============================================================ */
  function drawStreetBg(ctx, S, t, opt) {
    opt = opt || {};
    var cam = camOf(S);
    var camx = cam.x;
    drawNightSky(ctx, t, 166, camx, { moonX: 398, moonY: 62, moonR: 27 });
    drawSkyline(ctx, camx, t, {
      f: 0.1, tileW: 70, baseY: 164, minH: 38, maxH: 96,
      color: C.shadow, edge: C.panel, win1: C.amber, win2: C.lav,
      winProb: 0.14, seed: 11, vertical: null
    });
    drawSkyline(ctx, camx, t, {
      f: 0.3, tileW: 92, baseY: 166, minH: 64, maxH: 124,
      color: C.panel, edge: C.deep, win1: C.amber, win2: C.cyan,
      winProb: 0.2, seed: 23, signs: ['COMET', 'ARCADE', '24/7', 'NEON', 'TOXIC'], signChance: 0.45,
      vertical: ['HOTEL', 'CLUB', 'RAMEN']
    });
    drawStreetFacades(ctx, camx, t);
    drawWires(ctx, camx, t, 46, 7, C.ink);
    drawWires(ctx, camx, t, 58, 5, C.ink);
    drawStreetFloor(ctx, S, t);
    if (!opt.noRain) drawRain(ctx, t, camx, { density: 78, alpha: 0.5 });
    /* верхняя виньетка */
    dith(ctx, 0, 0, 480, 8, C.ink, C.bg, 0.5);
  }

  function drawNightSky(ctx, t, horizon, camx, opt) {
    opt = opt || {};
    vGrad(ctx, 0, 0, 480, horizon, [C.ink, C.bg, C.bg, C.bg, C.shadow], true);
    drawStars(ctx, t, horizon, camx || 0);
    if (opt.moonX != null) drawMoon(ctx, opt.moonX, opt.moonY, opt.moonR, t, opt);
    drawClouds(ctx, camx || 0, t, 30, C.shadow);
    /* горизонтный отсвет */
    dith(ctx, 0, horizon - 22, 480, 22, C.shadow, opt.glow || C.panel, 0.35);
    fill(ctx, 0, horizon - 1, 480, 1, C.panel);
  }

  /* витрины / фасады первого этажа */
  function drawStreetFacades(ctx, camx, t) {
    var f = 0.58;
    var off = camx * f;
    var tileW = 124;
    var baseY = 160;
    var start = Math.floor((off - 140) / tileW);
    var end = Math.ceil((off + 480 + 140) / tileW);
    var pal = [C.magenta, C.cyan, C.amber, C.lime];
    for (var i = start; i <= end; i++) {
      var r1 = rnd(i, 71), r2 = rnd(i + 3, 71), r3 = rnd(i + 9, 71);
      var w = Math.round(tileW * (0.86 + r1 * 0.14));
      var bx = Math.round(i * tileW - off);
      var top = baseY - 32 - Math.floor(r2 * 16);
      var col = pal[norm(i, 4)];
      /* корпус */
      fill(ctx, bx, top, w, baseY - top, C.panel);
      fill(ctx, bx, top, w, 2, C.deep);
      fill(ctx, bx, top, 1, baseY - top, C.deep);
      fill(ctx, bx + w - 1, top, 1, baseY - top, C.ink);
      dith(ctx, bx, top, w, 6, C.panel, C.ink, 0.4);
      /* окна-витрины: тёмная рама + цветная подсветка */
      var wx = bx + 8;
      for (var k = 0; k < 3; k++) {
        var winX = wx + k * 34;
        if (winX + 22 > bx + w - 4) break;
        fill(ctx, winX - 1, top + 9, 24, 16, C.ink);
        fill(ctx, winX, top + 10, 22, 14, C.ink);
        var lit = rnd2(i, k, 71) > 0.3;
        if (lit) {
          var wc = (k === 0 ? C.amber : (k === 1 ? C.cyan : C.magenta));
          dith(ctx, winX, top + 10, 22, 14, C.ink, wc, 0.55);
          fill(ctx, winX + 2, top + 11, 18, 2, wc);
          /* силуэты внутри */
          fill(ctx, winX + 5, top + 16, 3, 7, C.ink);
          fill(ctx, winX + 13, top + 17, 4, 6, C.ink);
          fill(ctx, winX + 2, top + 23, 18, 1, C.ink);
        } else {
          /* ставень */
          for (var sv = 0; sv < 7; sv++) fill(ctx, winX + sv * 3, top + 10, 1, 14, C.deep);
        }
      }
      /* навес: тёмный, с тонкой цветной кромкой */
      fill(ctx, bx + 2, top + 26, w - 4, 5, C.deep);
      fill(ctx, bx + 2, top + 26, w - 4, 1, C.panel);
      for (var a2 = 4; a2 < w - 6; a2 += 12) {
        fill(ctx, bx + 2 + a2, top + 27, 5, 3, C.ink);
      }
      fill(ctx, bx + 2, top + 31, w - 4, 1, col);
      /* дверь */
      fill(ctx, bx + w - 22, baseY - 18, 14, 18, C.ink);
      fill(ctx, bx + w - 21, baseY - 17, 12, 17, C.deep);
      fill(ctx, bx + w - 18, baseY - 11, 6, 2, col);
      fill(ctx, bx + w - 20, baseY - 16, 1, 2, C.amber);
      /* вывеска только если помещается */
      if (r2 > 0.5) {
        var lbl = ['COMET', 'ARCADE', '24/7', 'NEON', 'CLUB'][norm(i + 1, 5)];
        var bw = Math.min(w - 10, textW(lbl, 1) + 8);
        if (textW(lbl, 1) + 8 <= w - 10) {
          neonSign(ctx, bx + Math.round((w - bw) / 2), top + 1, bw, 11, lbl, col, t, 1, null);
        }
      }
    }
    /* сплошная линия тротуара */
    fill(ctx, 0, baseY - 2, 480, 2, C.ink);
  }

  /* ============================================================
     ARCADE ALLEY
     ============================================================ */
  function brickWall(ctx, x, y, w, h, base, mortar, t) {
    fill(ctx, x, y, w, h, base);
    var row, bx;
    for (row = 0; row * 6 < h; row++) {
      var yy = y + row * 6;
      fill(ctx, x, yy, w, 1, mortar);
      var shift = (row % 2) * 8;
      for (bx = x - shift; bx < x + w; bx += 16) {
        if (bx > x && bx < x + w) fill(ctx, bx, yy + 1, 1, 5, mortar);
      }
    }
    dith(ctx, x, y, w, h, base, C.ink, 0.18);
  }

  function drawSteam(ctx, t, x, y, seed, color) {
    for (var i = 0; i < 3; i++) {
      var ph = norm(t * 0.6 + rnd(i, seed), 1);
      var px = x + Math.sin(ph * 6 + i) * 5;
      var py = y - ph * 26;
      var r = 2 + ph * 6;
      ctx.globalAlpha = 0.5 * (1 - ph);
      dith(ctx, px - r, py - r, r * 2, r * 2, C.bg, color || C.lav, 0.5);
      ctx.globalAlpha = 1;
    }
  }

  function drawCabinet(ctx, x, y, w, h, label, color, t, i) {
    /* корпус */
    fill(ctx, x, y, w, h, C.ink);
    fill(ctx, x + 1, y + 2, w - 2, h - 2, C.panel);
    fill(ctx, x + 1, y + 2, w - 2, 1, C.deep);
    /* подсветка стены */
    neonGlow(ctx, x, y, w, h, color, 5, 0.3);
    /* маркиза */
    fill(ctx, x + 2, y + 3, w - 4, 10, color);
    dith(ctx, x + 2, y + 3, w - 4, 10, color, C.ink, 0.28);
    textC(ctx, label, x + w / 2, y + 4, 1, C.white, { outline: C.ink, outlineW: 1 });
    /* экран */
    var sx = x + 4, sy = y + 16, sw = w - 8, sh = Math.round(h * 0.4);
    fill(ctx, sx - 1, sy - 1, sw + 2, sh + 2, C.deep);
    fill(ctx, sx, sy, sw, sh, C.ink);
    var flick = Math.sin(t * 11 + i * 2.1) > -0.7;
    if (flick) {
      dith(ctx, sx, sy, sw, sh, C.ink, color, 0.32);
      /* простенькие «пришельцы» */
      var frame = Math.floor(t * 2 + i) % 3;
      for (var k = 0; k < 3; k++) {
        var ax = sx + 3 + k * 9 + ((frame + k) % 2) * 2;
        var ay = sy + 4 + (k % 2) * 3;
        fill(ctx, ax, ay, 3, 2, C.white);
        fill(ctx, ax - 1, ay + 2, 5, 1, color);
      }
      fill(ctx, sx + 2, sy + sh - 3, 6, 1, C.white);
      fill(ctx, sx + sw - 8, sy + sh - 3, 6, 1, C.white);
    }
    /* панель управления */
    var cp = y + 16 + sh + 2;
    fill(ctx, x + 2, cp, w - 4, 5, C.deep);
    fill(ctx, x + 4, cp + 1, 2, 2, C.amber);
    fill(ctx, x + 8, cp + 1, 2, 2, C.magenta);
    fill(ctx, x + 12, cp + 1, 2, 2, C.cyan);
    /* монетоприёмник */
    fill(ctx, x + w / 2 - 1, cp + 7, 3, 4, C.ink);
    fill(ctx, x + w / 2, cp + 8, 1, 2, C.lime);
    /* отражение на полу */
    var ry = y + h;
    ctx.globalAlpha = 0.4;
    dith(ctx, x + 2, ry, w - 4, 14, C.bg, color, 0.3);
    for (var d = 0; d < 3; d++) fill(ctx, x + 5 + d * 7, ry + 2 + d * 3, 4, 1, color);
    ctx.globalAlpha = 1;
  }

  function drawGraffiti(ctx, x, y, str, color, t) {
    /* пятно под тегом */
    dith(ctx, x - 10, y - 6, textW(str, 2) + 22, 26, C.panel, C.ink, 0.35);
    text(ctx, str, x, y, 2, color, { outline: C.ink, outlineW: 2, shadow: C.wine, shadowDX: 2, shadowDY: 2 });
    /* потёки */
    for (var i = 0; i < 3; i++) {
      var dx = x + 4 + i * 9;
      fill(ctx, dx, y + 18, 1, 2 + Math.floor(rnd(i, 3) * 5), color);
    }
  }

  function drawArcadeBg(ctx, S, t) {
    var cam = camOf(S);
    var camx = cam.x;
    var i, x;
    /* глухой фон */
    vGrad(ctx, 0, 0, 480, 270, [C.ink, C.bg, C.bg], false);
    /* щель неба сверху */
    var offSky = camx * 0.18;
    fill(ctx, 100, 0, 280, 34, C.ink);
    dith(ctx, 100, 0, 280, 34, C.ink, C.shadow, 0.35);
    drawMoon(ctx, norm(300 - offSky, 460) + 40, 12, 11, t, { plain: true, cloud: false });
    for (i = 0; i < 3; i++) {
      var cxp = norm(i * 150 + 120 - offSky, 420) + 20;
      drawCloud(ctx, cxp, 8 + i * 3, 54, C.shadow);
    }
    /* боковые стены (ближе) */
    var sideOff = camx * 0.55;
    brickWall(ctx, -20, 18, 122, 142, C.panel, C.ink, t);
    brickWall(ctx, 378, 18, 122, 142, C.panel, C.ink, t);
    dith(ctx, 0, 18, 122, 142, C.panel, C.ink, 0.3);
    dith(ctx, 378, 18, 122, 142, C.panel, C.ink, 0.3);
    /* задняя стена */
    brickWall(ctx, 96, 22, 288, 138, C.deep, C.ink, t);
    dith(ctx, 96, 22, 288, 138, C.deep, C.ink, 0.28);
    /* трубы по бокам */
    fill(ctx, 22, 0, 7, 180, C.shadow);
    fill(ctx, 23, 0, 2, 180, C.deep);
    fill(ctx, 22, 44, 7, 3, C.ink);
    fill(ctx, 22, 110, 7, 3, C.ink);
    fill(ctx, 452, 0, 7, 180, C.shadow);
    fill(ctx, 453, 0, 2, 180, C.deep);
    fill(ctx, 452, 60, 7, 3, C.ink);
    /* кабели */
    drawWires(ctx, camx, t, 18, 4, C.ink);
    drawWires(ctx, camx, t, 26, 3, C.ink);
    /* большая неоновая вывеска ARCADE */
    var boardW = textW('ARCADE', 3) + 22;
    neonSign(ctx, 240 - boardW / 2, 30, boardW, 24, 'ARCADE', C.magenta, t, 3, { board: true });
    neonSign(ctx, 356, 34, textW('24/7', 2) + 14, 18, '24/7', C.cyan, t, 2, { board: true });
    /* граффити */
    drawGraffiti(ctx, 128 - camx * 0.35, 84, 'TOXIC', C.magenta, t);
    drawGraffiti(ctx, 300 - camx * 0.35, 78, 'RAGE', C.lime, t);
    /* автоматы (ряд) */
    var f = 0.72;
    var off = camx * f;
    var tileW = 120;
    var start = Math.floor((off - 160) / tileW);
    var end = Math.ceil((off + 480 + 160) / tileW);
    var pal = [C.cyan, C.magenta, C.amber, C.lime];
    var labels = ['NEON', 'RAGE', 'DD', 'HAMMER'];
    for (i = start; i <= end; i++) {
      var bx = Math.round(i * tileW - off + 20);
      if (bx < -80 || bx > 500) continue;
      var h = 58;
      drawCabinet(ctx, bx, 158 - h, 46, h, labels[norm(i, 4)], pal[norm(i, 4)], t, i);
    }
    /* пар из решёток */
    drawSteam(ctx, t, 150 - norm(camx * 0.3, 40), 156, 5, C.lav);
    drawSteam(ctx, t, 330, 156, 8, C.purple);
    /* пол */
    drawArcadeFloor(ctx, S, t);
    drawRain(ctx, t, camx, { density: 30, alpha: 0.35, bottom: 60, splash: false });
    dith(ctx, 0, 0, 480, 8, C.ink, C.bg, 0.5);
  }

  function drawArcadeFloor(ctx, S, t) {
    var camx = camOf(S).x;
    var gt = 158, gb = 258;
    var x, i;
    fill(ctx, 0, gt, 480, gb - gt, C.shadow);
    vGrad(ctx, 0, gt, 480, gb - gt, [C.panel, C.shadow, C.ink], true);
    /* бетонные плиты */
    var off = norm(camx, 48);
    for (x = -off; x < 480; x += 48) {
      fill(ctx, x, gt, 1, gb - gt, C.ink);
      dith(ctx, x + 1, gt, 2, gb - gt, C.ink, C.panel, 0.4);
    }
    for (i = 0; i < 4; i++) {
      fill(ctx, 0, gt + 12 + i * 22, 480, 1, C.ink);
      dith(ctx, 0, gt + 13 + i * 22, 480, 2, C.shadow, C.bg, 0.5);
    }
    /* мокрые отражения автоматов */
    for (i = 0; i < 4; i++) {
      var px = norm(i * 120 + 30 - camx * 0.72, 560) - 40;
      if (px < -30 || px > 510) continue;
      var col = [C.cyan, C.magenta, C.amber, C.lime][i];
      ctx.globalAlpha = 0.5;
      dith(ctx, px, 164, 40, 34, C.shadow, col, 0.3);
      for (var d = 0; d < 4; d++) {
        fill(ctx, px + 8 + Math.sin(t * 2 + d) * 2, 168 + d * 6, 20 - d * 3, 1, col);
      }
      ctx.globalAlpha = 1;
    }
    /* лужи */
    var poff = norm(camx, 460);
    drawPuddle(ctx, 140 - poff, 206, 66, 13, t, 7, [C.cyan, C.magenta, C.amber]);
    drawPuddle(ctx, 420 - poff, 232, 54, 11, t, 8, [C.magenta, C.lime, C.cyan]);
    /* мусор: жетоны, бумажки */
    for (i = 0; i < 7; i++) {
      var lx = norm(rnd(i, 51) * 560 - camx, 560) - 40;
      var ly = 176 + rnd(i, 52) * 72;
      fill(ctx, lx, ly, 2, 2, rnd(i, 53) > 0.5 ? C.amber : C.lav);
    }
    fill(ctx, 0, gb, 480, 12, C.ink);
    fill(ctx, 0, gb, 480, 1, C.deep);
    dith(ctx, 0, gb + 2, 480, 10, C.ink, C.bg, 0.5);
    fill(ctx, 0, 266, 480, 4, C.ink);
  }

  /* ============================================================
     ROOFTOP
     ============================================================ */
  function lightningLevel(t) {
    var cyc = t % 7.3;
    if (cyc < 0.07) return 1;
    if (cyc < 0.16) return 0.55;
    if (cyc < 0.3) {
      var c2 = t % 3.9;
      if (c2 < 0.06) return 0.8;
    }
    return 0;
  }

  function drawRoofBg(ctx, S, t) {
    var cam = camOf(S);
    var camx = cam.x;
    var lf = lightningLevel(t);
    var i;
    /* штормовое небо */
    vGrad(ctx, 0, 0, 480, 150, [C.ink, C.bg, C.shadow, C.panel], true);
    if (lf > 0) {
      ctx.globalAlpha = 0.18 + lf * 0.3;
      fill(ctx, 0, 0, 480, 150, C.white);
      ctx.globalAlpha = 1;
      dith(ctx, 0, 0, 480, 150, C.ink, C.purple, 0.2 * lf);
    }
    drawClouds(ctx, camx * 0.5, t * 1.6, 24, C.panel);
    drawMoon(ctx, 366, 76, 33, t, { color: lf > 0.5 ? C.white : C.lav, plain: false });
    /* молния */
    if (lf > 0.6) {
      var bx = 120 + Math.floor(rnd(Math.floor(t * 10), 5) * 300);
      var by = 0, bxx = bx;
      while (by < 120) {
        fill(ctx, bxx, by, 1, 6, C.white);
        by += 6;
        bxx += Math.round((rnd(by + bxx, 9) - 0.5) * 10);
        if (rnd(by, 4) > 0.8) {
          fill(ctx, bxx + 4, by, 1, 4, C.white);
        }
      }
    }
    /* город далеко внизу */
    fill(ctx, 0, 126, 480, 34, C.ink);
    for (i = 0; i < 44; i++) {
      var gx = norm(i * 14 + rnd(i, 61) * 10 - camx * 0.08, 520) - 20;
      var gy = 128 + Math.floor(rnd(i, 62) * 20);
      var cc = rnd(i, 63) > 0.7 ? C.cyan : (rnd(i, 64) > 0.5 ? C.amber : C.magenta);
      fill(ctx, gx, gy, 2, 1, cc);
      if (i % 3 === 0) fill(ctx, gx, gy + 2, 1, 1, cc);
    }
    dith(ctx, 0, 126, 480, 32, C.ink, C.shadow, 0.35);
    /* парапет */
    fill(ctx, 0, 146, 480, 14, C.panel);
    fill(ctx, 0, 146, 480, 1, C.deep);
    dith(ctx, 0, 147, 480, 13, C.panel, C.shadow, 0.4);
    var off = norm(camx * 0.6, 46);
    for (var px = -off; px < 480; px += 46) {
      fill(ctx, px, 146, 2, 14, C.deep);
      fill(ctx, px + 2, 146, 1, 14, C.ink);
    }
    /* сетка рабица на парапете */
    for (var gx2 = 0; gx2 < 480; gx2 += 8) {
      fill(ctx, gx2, 134, 1, 12, C.ink);
    }
    for (var gy2 = 134; gy2 < 146; gy2 += 4) {
      fill(ctx, 0, gy2, 480, 1, C.ink);
    }
    /* антенны */
    drawAntenna(ctx, 92, 152, 58, t, 0);
    drawAntenna(ctx, 260, 152, 36, t, 1);
    drawAntenna(ctx, 430, 152, 70, t, 2);
    /* гигантский неон ТОКСИК */
    drawToxicSign(ctx, t, camx);
    /* вентиляция / кондиционеры */
    drawRoofVent(ctx, 44, 152, 34, 18, t);
    drawRoofVent(ctx, 380, 152, 44, 22, t);
    /* пол */
    drawRoofFloor(ctx, S, t);
    /* передний план: трубы и короба по кромке */
    for (var f = 0; f < 4; f++) {
      var fx = norm(f * 152 + 40 - camx, 608) - 60;
      if (fx < -80 || fx > 500) continue;
      fill(ctx, fx, 236, 46, 6, C.ink);
      fill(ctx, fx + 2, 234, 42, 2, C.deep);
      fill(ctx, fx + 6, 230, 3, 6, C.deep);
      fill(ctx, fx + 34, 230, 3, 6, C.deep);
      fill(ctx, fx + 10, 238, 26, 2, C.panel);
    }
    /* сигнальные полосы на кромке */
    for (var hs = 0; hs < 480; hs += 46) {
      if (Math.floor((hs + camx) / 46) % 2 === 0) {
        fill(ctx, hs, 256, 22, 2, C.amber);
      }
    }
    /* неоновая вывеска на парапете */
    var bx2 = norm(620 - camx * 0.6, 780) - 120;
    if (bx2 > -60 && bx2 < 500) {
      neonSign(ctx, bx2, 140, 50, 13, 'RAGE', C.magenta, t, 1, null);
    }
    drawRain(ctx, t, camx, { density: 96, alpha: 0.45, speed: 1.15 });
    dith(ctx, 0, 0, 480, 8, C.ink, C.bg, 0.4);
  }

  function drawAntenna(ctx, x, baseY, h, t, i) {
    fill(ctx, x, baseY - h, 2, h, C.ink);
    fill(ctx, x + 1, baseY - h, 1, h, C.shadow);
    fill(ctx, x - 5, baseY - h + 6, 12, 1, C.ink);
    fill(ctx, x - 3, baseY - h + 16, 8, 1, C.ink);
    fill(ctx, x - 8, baseY - h + 30, 18, 1, C.ink);
    /* маячок */
    var on = Math.sin(t * 2.2 + i * 2) > 0;
    fill(ctx, x - 1, baseY - h - 2, 4, 3, on ? C.magenta : C.wine);
    if (on) neonGlow(ctx, x - 1, baseY - h - 1, 3, 2, C.magenta, 4, 0.4);
    /* растяжки */
    fill(ctx, x - 8, baseY - h + 12, 10, 1, C.shadow);
    fill(ctx, x + 2, baseY - h + 12, 10, 1, C.shadow);
  }

  function drawRoofVent(ctx, x, baseY, w, h, t) {
    fill(ctx, x, baseY - h, w, h, C.shadow);
    fill(ctx, x, baseY - h, w, 2, C.panel);
    fill(ctx, x, baseY - h, 2, h, C.deep);
    fill(ctx, x + w - 2, baseY - h, 2, h, C.ink);
    for (var i = 0; i < 4; i++) {
      fill(ctx, x + 4, baseY - h + 4 + i * 3, w - 8, 1, C.ink);
    }
    drawSteam(ctx, t, x + w / 2, baseY - h - 2, x, C.lav);
  }

  function drawToxicSign(ctx, t, camx) {
    var x = Math.round(280 - camx * 0.1);
    var y = 62;
    if (x < -190 || x > 530) return;
    var w = 136, h = 38;
    /* рама */
    fill(ctx, x - 6, y - 6, w + 12, h + 14, C.ink);
    fill(ctx, x - 4, y - 4, w + 8, h + 10, C.shadow);
    fill(ctx, x - 4, y - 4, w + 8, 1, C.deep);
    for (var b = 0; b < 4; b++) {
      fill(ctx, x - 4 + b * 36, y - 4, 2, h + 10, C.ink);
      fill(ctx, x - 4 + b * 36 + 2, y - 4, 1, h + 10, C.deep);
    }
    neonSign(ctx, x, y, w, h, 'TOXIC', C.amber, t, 3, { board: false });
    /* потёки */
    for (var i = 0; i < 4; i++) {
      var dx = x + 12 + i * 34;
      var dl = 4 + Math.floor(rnd(i, 77) * 12);
      fill(ctx, dx, y + h, 2, dl, C.orange);
      fill(ctx, dx, y + h + dl, 1, 2, C.amber);
    }
    /* кабели вниз */
    fill(ctx, x + 18, y + h + 6, 1, 24, C.ink);
    fill(ctx, x + w - 16, y + h + 6, 1, 16, C.ink);
    /* ферма-опоры */
    fill(ctx, x - 8, y + h + 6, 2, 20, C.ink);
    fill(ctx, x + w + 6, y + h + 6, 2, 20, C.ink);
  }

  function drawRoofFloor(ctx, S, t) {
    var camx = camOf(S).x;
    var gt = 158, gb = 258;
    var x, i;
    fill(ctx, 0, gt, 480, gb - gt, C.shadow);
    vGrad(ctx, 0, gt + 6, 480, gb - gt - 6, [C.panel, C.shadow, C.ink], true);
    /* металлические листы / швы */
    var off = norm(camx, 56);
    for (x = -off; x < 480; x += 56) {
      fill(ctx, x, gt + 4, 1, gb - gt - 4, C.ink);
      dith(ctx, x + 1, gt + 4, 3, gb - gt - 4, C.ink, C.panel, 0.45);
    }
    for (i = 0; i < 4; i++) {
      fill(ctx, 0, gt + 14 + i * 22, 480, 1, C.ink);
      dith(ctx, 0, gt + 15 + i * 22, 480, 2, C.shadow, C.bg, 0.5);
    }
    /* гравий / клёпки */
    for (i = 0; i < 34; i++) {
      var gx = norm(rnd(i, 81) * 560 - camx, 560) - 40;
      var gy = 168 + rnd(i, 82) * 84;
      fill(ctx, gx, gy, 1, 1, rnd(i, 83) > 0.6 ? C.lav : C.deep);
    }
    /* отражение TOXIC на мокром полу */
    var tox = norm(340 - camx, 620) - 70;
    if (tox > -80 && tox < 520) {
      ctx.globalAlpha = 0.5;
      for (var d = 0; d < 4; d++) {
        fill(ctx, tox + 10 + d * 28 + Math.sin(t * 2 + d) * 2, 246 + d * 3, 22 - d * 3, 1, C.amber);
      }
      ctx.globalAlpha = 1;
    }
    /* лужи */
    var poff = norm(camx, 500);
    drawPuddle(ctx, 110 - poff, 204, 70, 12, t, 11, [C.amber, C.magenta, C.cyan]);
    drawPuddle(ctx, 470 - poff, 230, 58, 12, t, 12, [C.amber, C.lime, C.magenta]);
    drawPuddle(ctx, 290 - norm(camx, 640), 246, 62, 11, t, 13, [C.amber, C.cyan, C.magenta]);
    /* передний парапет */
    fill(ctx, 0, gb, 480, 12, C.ink);
    fill(ctx, 0, gb, 480, 1, C.amber);
    dith(ctx, 0, gb + 2, 480, 10, C.ink, C.bg, 0.5);
    fill(ctx, 0, 266, 480, 4, C.ink);
  }

  /* ============================================================
     5. ТИТУЛЬНЫЙ ЭКРАН
     ============================================================ */

  function padScore(n, len) {
    var s = String(Math.max(0, Math.floor(n || 0)));
    while (s.length < len) s = '0' + s;
    return s;
  }

  /* ---- кэш логотипа ---- */
  var logoCanvas = null;
  var logoSig = '';

  var SHADES = {
    cyan: [C.white, C.white, C.cyan, C.cyan, C.teal, C.teal, C.deep, C.deep],
    magenta: [C.white, C.white, C.magenta, C.magenta, C.wine, C.wine, C.deep, C.deep],
    amber: [C.white, C.white, C.amber, C.amber, C.orange, C.orange, C.wine, C.wine],
    lime: [C.white, C.white, C.lime, C.lime, C.green, C.green, C.deep, C.deep]
  };
  var LOGO_DARK = { cyan: C.teal, magenta: C.wine, amber: C.orange, lime: C.green };

  function glyphSolid(g, ch, x, y, sc, color) {
    var gl = glyphOf(ch);
    if (!gl) return;
    g.fillStyle = color;
    for (var r = 0; r < 8; r++) {
      var bits = gl[r];
      if (!bits) continue;
      var c = 0;
      while (c < 6) {
        if (bits & (1 << (5 - c))) {
          var run = 1;
          while (c + run < 6 && (bits & (1 << (5 - (c + run))))) run++;
          g.fillRect(x + c * sc, y + r * sc, run * sc, sc);
          c += run;
        } else c++;
      }
    }
  }
  function glyphRows(g, ch, x, y, sc, rowColors) {
    var gl = glyphOf(ch);
    if (!gl) return;
    for (var r = 0; r < 8; r++) {
      var bits = gl[r];
      if (!bits) continue;
      g.fillStyle = rowColors[r] || rowColors[rowColors.length - 1];
      var c = 0;
      while (c < 6) {
        if (bits & (1 << (5 - c))) {
          var run = 1;
          while (c + run < 6 && (bits & (1 << (5 - (c + run))))) run++;
          g.fillRect(x + c * sc, y + r * sc, run * sc, sc);
          c += run;
        } else c++;
      }
    }
  }
  function logoChar(g, ch, x, y, sc, shade, flavor) {
    if (ch === ' ') return;
    var cols = SHADES[shade] || SHADES.cyan;
    var dark = LOGO_DARK[shade] || C.teal;
    var ox, oy;
    /* глубокая 3D-тень */
    glyphSolid(g, ch, x + sc * 2, y + sc * 2, sc, C.ink);
    glyphSolid(g, ch, x + sc, y + sc, sc, dark);
    /* обводка */
    for (oy = -1; oy <= 1; oy++) {
      for (ox = -1; ox <= 1; ox++) {
        if (!ox && !oy) continue;
        glyphSolid(g, ch, x + ox * sc, y + oy * sc, sc, C.ink);
      }
    }
    /* заливка с полосами */
    glyphRows(g, ch, x, y, sc, cols);
    /* блик-скан */
    var gl = glyphOf(ch);
    if (gl) {
      for (var r = 0; r < 2; r++) {
        var bits = gl[r];
        if (!bits) continue;
        g.fillStyle = C.white;
        var c = 0;
        while (c < 6) {
          if (bits & (1 << (5 - c))) {
            var run = 1;
            while (c + run < 6 && (bits & (1 << (5 - (c + run))))) run++;
            g.fillRect(x + c * sc, y + r * sc, run * sc, Math.max(1, Math.floor(sc / 2)));
            c += run;
          } else c++;
        }
      }
    }
  }
  function logoLine(g, str, cx, y, sc, shade) {
    var x0 = Math.round(cx - textW(str, sc) / 2);
    for (var i = 0; i < str.length; i++) {
      logoChar(g, str.charAt(i), x0 + i * 6 * sc, y, sc, shade);
    }
  }

  function ensureLogo() {
    var title = T('app.title') || 'НЕОН × ЯРОСТЬ';
    var sub = T('app.subtitle') || 'NEON RAGE';
    var sig = title + '|' + sub;
    if (logoCanvas && logoSig === sig) return logoCanvas;
    var cv = document.createElement('canvas');
    cv.width = 480;
    cv.height = 96;
    var g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    var parts = title.split('×');
    var left = (parts[0] || 'НЕОН').trim();
    var right = (parts[1] || 'ЯРОСТЬ').trim();
    if (!right) {
      var ws = left.split(' ');
      var mid = Math.ceil(ws.length / 2);
      right = ws.slice(mid).join(' ');
      left = ws.slice(0, mid).join(' ');
    }
    logoLine(g, left, 240, 2, 3, 'cyan');
    /* вторая строка: «×» янтарный, остальное маджента */
    var line2 = '× ' + right;
    var x0 = Math.round(240 - textW(line2, 3) / 2);
    for (var i = 0; i < line2.length; i++) {
      logoChar(g, line2.charAt(i), x0 + i * 18, 30, 3, i === 0 ? 'amber' : 'magenta');
    }
    logoLine(g, sub, 240, 60, 4, 'magenta');
    /* декоративные линии */
    var lw = textW(sub, 4);
    fill(g, 240 - lw / 2 - 28, 90, 18, 2, C.amber);
    fill(g, 240 + lw / 2 + 10, 90, 18, 2, C.amber);
    dith(g, 240 - lw / 2 - 48, 92, 84, 2, C.ink, C.cyan, 0.45);
    dith(g, 240 + lw / 2 - 36, 92, 84, 2, C.ink, C.magenta, 0.45);
    logoCanvas = cv;
    logoSig = sig;
    return cv;
  }

  function drawTitleSparkles(ctx, t) {
    for (var i = 0; i < 9; i++) {
      var x = 44 + rnd(i, 101) * 392;
      var y = 22 + rnd(i, 102) * 96;
      if (Math.sin(t * 3.4 + i * 1.9) < 0.2) continue;
      var len = rnd(i, 103) > 0.7 ? 3 : 2;
      fill(ctx, x, y - 1, 1, len, C.white);
      fill(ctx, x - 1, y, len, 1, C.white);
    }
  }

  function drawTitleLedge(ctx, t, camx) {
    var x, i;
    /* далёкий город под крышей */
    for (i = 0; i < 26; i++) {
      var gx = norm(i * 20 + rnd(i, 61) * 14 - camx * 0.12, 520) - 20;
      var gy = 236 + Math.floor(rnd(i, 62) * 8);
      fill(ctx, gx, gy, 2, 1, rnd(i, 63) > 0.6 ? C.amber : C.magenta);
    }
    /* плоскость крыши */
    fill(ctx, 0, 246, 480, 24, C.ink);
    fill(ctx, 0, 246, 480, 1, C.panel);
    fill(ctx, 0, 247, 480, 2, C.shadow);
    dith(ctx, 0, 249, 480, 21, C.ink, C.bg, 0.5);
    var off = norm(camx * 0.5, 64);
    for (x = -off; x < 480; x += 64) {
      fill(ctx, x, 248, 1, 22, C.shadow);
      fill(ctx, x + 1, 248, 1, 22, C.ink);
    }
    /* мокрые блики */
    ctx.globalAlpha = 0.5;
    fill(ctx, 40, 258, 42, 1, C.magenta);
    fill(ctx, 396, 260, 38, 1, C.cyan);
    ctx.globalAlpha = 1;
    /* передний парапет */
    fill(ctx, 0, 264, 480, 6, C.ink);
    fill(ctx, 0, 264, 480, 1, C.deep);
  }

  function drawTitleBackdrop(ctx, S, t) {
    var camx = 150 + Math.sin(t * 0.07) * 26;
    drawNightSky(ctx, t, 252, camx, { moonX: 388, moonY: 58, moonR: 28, glow: C.panel });
    drawSkyline(ctx, camx, t, {
      f: 0.08, tileW: 76, baseY: 252, minH: 62, maxH: 160,
      color: C.shadow, edge: C.panel, win1: C.amber, win2: C.lav,
      winProb: 0.13, seed: 5
    });
    drawSkyline(ctx, camx, t, {
      f: 0.24, tileW: 98, baseY: 254, minH: 96, maxH: 206,
      color: C.panel, edge: C.deep, win1: C.amber, win2: C.cyan,
      winProb: 0.18, seed: 17, signs: ['COMET', 'ARCADE', '24/7', 'NEON', 'RAGE', 'TOXIC'],
      signChance: 0.4, vertical: ['HOTEL', 'CLUB']
    });
    /* глубокая тень под логотипом */
    dith(ctx, 60, 8, 360, 112, C.ink, C.bg, 0.42);
    /* боковые вертикальные вывески */
    neonSignV(ctx, 26, 68, 'COMET', C.magenta, t, 2);
    neonSignV(ctx, 430, 92, 'RAGE', C.cyan, t, 2);
    neonSign(ctx, 360, 208, textW('24/7', 1) + 12, 13, '24/7', C.amber, t, 1, { board: true });
    drawWires(ctx, camx, t, 34, 6, C.ink);
    drawWires(ctx, camx, t, 44, 4, C.ink);
    drawTitleLedge(ctx, t, camx);
    /* герои key-art */
    var bob = Math.round(Math.sin(t * 1.8) * 1);
    drawFighter(ctx, {
      kind: 'player', char: 'comet', x: 70, y: 257 + bob, z: 0, facing: 1,
      state: 'idle', anim: 'idle', animT: t, hp: 100, maxHp: 100, scale: 1.16,
      flash: 0, alpha: 1
    }, null, t, { rim: C.magenta, rimDX: -2, rimDY: 0, hero: true });
    drawFighter(ctx, {
      kind: 'player', char: 'hammer', x: 410, y: 258 - bob, z: 0, facing: -1,
      state: 'idle', anim: 'idle', animT: t + 0.8, hp: 100, maxHp: 100, scale: 1.08,
      flash: 0, alpha: 1
    }, null, t, { rim: C.cyan, rimDX: 2, rimDY: 0, hero: true });
    drawRain(ctx, t, camx, { density: 58, alpha: 0.34 });
    dith(ctx, 0, 0, 480, 6, C.ink, C.bg, 0.6);
  }

  function drawTitleScreen(ctx, S, t) {
    drawTitleBackdrop(ctx, S, t);

    /* логотип: 3 полосы, редкий срез-глитч */
    var logo = ensureLogo();
    var logoY = 24 + Math.round(Math.sin(t * 1.5) * 1);
    var gph = Math.floor(t * 7);
    var glitch = rnd(gph, 5) > 0.94;
    var bands = [[0, 34], [34, 64], [64, 96]];
    for (var bi = 0; bi < bands.length; bi++) {
      var b0 = bands[bi][0], b1 = bands[bi][1];
      var dx = 0;
      if (glitch && bi === 1) dx = rnd(gph, 6) > 0.5 ? 3 : -3;
      ctx.drawImage(logo, 0, b0, 480, b1 - b0, dx, logoY + b0, 480, b1 - b0);
    }
    drawTitleSparkles(ctx, t);

    /* подпись «оригинал» */
    textC(ctx, T('app.tribute'), 240, 121, 1, C.lav, { outline: C.ink, outlineW: 1 });

    /* рекорд слева сверху */
    var best = (S.run && S.run.best) || S_().best || 0;
    fill(ctx, 8, 7, 122, 11, C.ink);
    rectB(ctx, 8, 7, 122, 11, C.shadow);
    text(ctx, '★', 11, 9, 1, C.amber, null);
    text(ctx, T('title.best'), 21, 9, 1, C.amber, null);
    textR(ctx, padScore(best, 7), 127, 9, 1, C.white, null);

    /* чипы быстрых настроек */
    drawQuickChips(ctx, S, t);

    /* слоган */
    textC(ctx, T('title.tagline'), 240, 131, 1, C.cyan, { outline: C.ink, outlineW: 1, shadow: C.ink, shadowDX: 1, shadowDY: 1 });

    /* НАЖМИ ENTER */
    if (blink(t, 2.6)) {
      textC(ctx, T('title.press'), 240, 142, 2, C.amber, {
        outline: C.ink, outlineW: 2, shadow: C.wine, shadowDX: 2, shadowDY: 2
      });
    } else {
      textC(ctx, T('title.press'), 240, 142, 2, C.wine, { alpha: 0.5 });
    }

    /* подложка под меню */
    dith(ctx, 138, 161, 204, 95, C.ink, C.bg, 0.8);
    fill(ctx, 138, 161, 204, 1, C.ink);
    dith(ctx, 138, 162, 204, 1, C.ink, C.magenta, 0.5);
    brackets(ctx, 142, 163, 196, 89, C.deep, 4);

    /* меню */
    drawMenuList(ctx, S, t, 'menu',
      ['menu.play', 'menu.help', 'menu.settings', 'menu.about'], null,
      S.menuIndex || 0, { accent: C.magenta });

    /* нижняя подсказка */
    hintLine(ctx, T('title.hint'), 250, C.lav, t);

    /* версия */
    text(ctx, T('title.version'), 6, 260, 1, C.purple, null);
  }

  /* ============================================================
     6. БОЙЦЫ — ПРОЦЕДУРНЫЕ ПИКСЕЛЬНЫЕ СПРАЙТЫ
     ============================================================ */

  var FIG = {
    comet: {
      h: 47, torsoW: 15, legW: 5, armW: 4, headW: 10, headH: 10,
      skin: C.amber, skinD: C.orange, hair: C.ink, hairHi: C.white,
      outfit: C.lav, outfit2: C.purple, pants: C.deep, accent: C.cyan,
      scarf: C.orange, glove: C.ink, boot: C.ink
    },
    /* МОЛОТ: киборг-кузнец — голые руки, стальная рука-молот, кожаный фартук */
    hammer: {
      h: 48, torsoW: 21, legW: 7, armW: 6, headW: 11, headH: 11,
      skin: C.orange, skinD: C.wine, hair: C.ink, hairHi: C.lav,
      outfit: C.panel, outfit2: C.ink, pants: C.deep, accent: C.orange,
      sleeve: C.orange, scarf: null, glove: C.lav, boot: C.ink
    },
    punk: {
      h: 43, torsoW: 14, legW: 5, armW: 4, headW: 10, headH: 10,
      skin: C.lav, skinD: C.purple, hair: C.magenta, hairHi: C.white,
      outfit: C.deep, outfit2: C.ink, pants: C.panel, accent: C.lime,
      scarf: null, glove: C.lav, boot: C.ink
    },
    ninja: {
      h: 44, torsoW: 14, legW: 5, armW: 4, headW: 10, headH: 10,
      skin: C.purple, skinD: C.deep, hair: C.ink, hairHi: C.cyan,
      outfit: C.purple, outfit2: C.deep, pants: C.deep, accent: C.cyan,
      scarf: C.cyan, glove: C.ink, boot: C.ink
    },
    brute: {
      h: 55, torsoW: 23, legW: 7, armW: 7, headW: 11, headH: 10,
      skin: C.orange, skinD: C.wine, hair: C.ink, hairHi: C.orange,
      outfit: C.deep, outfit2: C.ink, pants: C.ink, accent: C.amber,
      scarf: null, glove: C.orange, boot: C.ink
    }
  };
  function cfgFor(a) { return FIG[a.char] || FIG[a.kind] || FIG.punk; }

  /* --- примитивы в локальных координатах спрайта --- */
  function lr(ctx, x, y, w, h, c) {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }
  function limbRaw(ctx, x1, y1, x2, y2, th, c) {
    var dx = x2 - x1, dy = y2 - y1;
    var steps = Math.max(1, Math.round(Math.max(Math.abs(dx), Math.abs(dy)) / 1.5));
    for (var i = 0; i <= steps; i++) {
      var k = i / steps;
      lr(ctx, x1 + dx * k - th / 2, y1 + dy * k - th / 2, th, th, c);
    }
  }
  function limb(ctx, x1, y1, x2, y2, th, c, oc) {
    if (oc) limbRaw(ctx, x1, y1, x2, y2, th + 2, oc);
    limbRaw(ctx, x1, y1, x2, y2, th, c);
  }

  /* --- позы --- */
  function attackExt(a) {
    var at = a.attack;
    if (at && at.def) {
      var w = at.def.wind || 0.24, ac = at.def.active || 0.12, rc = at.def.recover || 0.3;
      var tt = at.t != null ? at.t : (a.animT || 0);
      if (tt < w) return -0.32 * (tt / w);
      if (tt < w + ac) return 1;
      return Math.max(0, 1 - (tt - w - ac) / rc);
    }
    var x = (a.animT || 0) / 0.26;
    if (x < 0.3) return -0.32 * (x / 0.3);
    if (x < 0.62) return 1;
    return Math.max(0, 1 - (x - 0.62) / 0.38);
  }

  function makePose(a, cfg, t) {
    var h = cfg.h;
    var anim = a.anim || a.state || 'idle';
    var at = a.animT || 0;
    var ex = attackExt(a);
    var p = {
      crouch: 0, bob: 0, lean: 0,
      shoulderY: -h * 0.8, hipY: -h * 0.42,
      headX: 0, headY: -h * 0.92,
      footF: { x: 4, y: 0 }, footB: { x: -4, y: 0 },
      handF: { x: 6, y: -h * 0.46 }, handB: { x: -6, y: -h * 0.46 },
      prone: false, ex: ex
    };
    var ph, sw;

    if (a.dead || anim === 'down' || a.state === 'down') {
      p.prone = true;
      p.footF = { x: 3, y: 0 };
      p.footB = { x: -1, y: 0 };
      p.handF = { x: 10, y: -h * 0.5 };
      p.handB = { x: -11, y: -h * 0.56 };
      p.headX = 2;
      p.crouch = 0;
      return p;
    }
    if (anim === 'walk') {
      ph = at * 9.5; sw = Math.sin(ph);
      p.footF.x = 4 + sw * 5;
      p.footF.y = -Math.max(0, Math.cos(ph)) * 3;
      p.footB.x = -4 - sw * 5;
      p.footB.y = -Math.max(0, -Math.cos(ph)) * 3;
      p.bob = Math.abs(Math.cos(ph)) * 1.4;
      p.lean = 1;
      p.handF.x = 6 - sw * 3;
      p.handF.y = -h * 0.46 + Math.cos(ph) * 1.5;
      p.handB.x = -6 + sw * 3;
      p.handB.y = -h * 0.46 - Math.cos(ph) * 1.5;
    } else if (anim === 'jumpkick') {
      p.footF = { x: 6 + Math.max(0, ex) * h * 0.34, y: -h * 0.24 };
      p.footB = { x: -5, y: -h * 0.16 };
      p.handF = { x: 2, y: -h * 0.62 };
      p.handB = { x: -9, y: -h * 0.58 };
      p.lean = 3; p.bob = 1;
    } else if (anim === 'jump' || (a.state === 'jump' && !a.attack)) {
      p.footF = { x: 6, y: -h * 0.18 };
      p.footB = { x: -5, y: -h * 0.14 };
      p.handF = { x: 9, y: -h * 0.74 };
      p.handB = { x: -8, y: -h * 0.7 };
      p.lean = 2;
    } else if (anim === 'punch1') {
      var e1 = Math.max(0, ex);
      p.handF = { x: 6 + ex * h * 0.34, y: p.shoulderY + 5 };
      p.handB = { x: -4, y: p.shoulderY + 4 };
      p.lean = e1 * 3;
      p.bob = e1 * 1;
      if (ex < 0) { p.crouch = -ex * h * 0.03; p.handF.x = 6 + ex * 9; }
    } else if (anim === 'punch2') {
      var e2 = Math.max(0, ex);
      p.handB = { x: -2 + ex * h * 0.38, y: p.shoulderY + 4 };
      p.handF = { x: 3, y: p.shoulderY + 3 };
      p.lean = e2 * 4;
      p.headX = e2;
      if (ex < 0) p.crouch = -ex * h * 0.03;
    } else if (anim === 'punch3') {
      var e3 = Math.max(0, ex);
      p.crouch = ex < 0 ? -ex * h * 0.07 : (1 - e3) * h * 0.02;
      var uy = (p.hipY + 6) + e3 * ((p.shoulderY - 10) - (p.hipY + 6));
      p.handF = { x: 5 + e3 * h * 0.2, y: uy };
      p.handB = { x: -3, y: p.shoulderY + 5 };
      p.lean = 2 + e3 * 3;
      p.bob = -e3 * 2;
    } else if (anim === 'kick') {
      var e4 = Math.max(0, ex);
      p.footF = { x: 4 + e4 * h * 0.34, y: -e4 * h * 0.3 };
      p.footB = { x: -5, y: 0 };
      p.handF = { x: -2, y: p.shoulderY + 4 };
      p.handB = { x: -9, y: p.shoulderY + 2 };
      p.lean = -e4 * 4;
      p.bob = -e4;
    } else if (anim === 'special') {
      p.crouch = h * 0.07;
      p.handF = { x: h * 0.32, y: p.shoulderY - 2 + Math.sin(t * 30) };
      p.handB = { x: -h * 0.32, y: p.shoulderY - 2 - Math.sin(t * 30) };
      p.lean = -2; p.headX = -1;
    } else if (anim === 'hurt') {
      p.lean = -4; p.headX = -3; p.crouch = h * 0.04;
      p.handF = { x: -1, y: p.shoulderY - 2 };
      p.handB = { x: -10, y: p.shoulderY + 4 };
      p.footF = { x: 6, y: 0 }; p.footB = { x: -6, y: 0 };
      p.bob = Math.sin(t * 38);
    } else if (anim === 'getup') {
      p.crouch = h * 0.16; p.lean = 2;
      p.footF = { x: 6, y: 0 }; p.footB = { x: -6, y: 0 };
      p.handF = { x: 6, y: p.hipY + 3 };
      p.handB = { x: -2, y: p.hipY + 5 };
    } else if (anim === 'victory') {
      p.handF = { x: 9, y: p.shoulderY - 16 - Math.sin(t * 4) };
      p.handB = { x: -9, y: p.shoulderY - 16 + Math.sin(t * 4) };
      p.bob = Math.sin(t * 3) * 1.5;
      p.headY -= 1; p.lean = -1;
    } else if (anim === 'roar') {
      p.handF = { x: h * 0.34, y: p.shoulderY - 12 };
      p.handB = { x: -h * 0.34, y: p.shoulderY - 12 };
      p.headX = -2; p.lean = -3; p.crouch = 1;
      p.bob = Math.sin(t * 26);
    } else if (anim === 'cable') {
      var e5 = Math.max(0, ex);
      p.handF = { x: 6 + e5 * h * 0.5, y: p.shoulderY + 6 - e5 * 8 };
      p.handB = { x: -6, y: p.shoulderY + 3 };
      p.lean = e5 * 3;
    } else if (anim === 'cast') {
      var e6 = Math.max(0, ex);
      p.handF = { x: 6 + e6 * h * 0.3, y: p.shoulderY + 3 };
      p.handB = { x: 2 + e6 * h * 0.24, y: p.shoulderY + 7 };
      p.lean = e6 * 2;
    } else if (anim === 'slam') {
      var e7 = Math.max(0, ex);
      p.crouch = h * 0.14 * e7 + (ex < 0 ? -ex * h * 0.1 : 0);
      p.handF = { x: 8 + e7 * 4, y: lerp(p.shoulderY, -2, e7) };
      p.handB = { x: -8 - e7 * 4, y: lerp(p.shoulderY, -2, e7) };
      p.lean = e7 * 4;
    } else if (anim === 'charge' || anim === 'dash') {
      p.lean = 6; p.footF = { x: 8, y: 0 }; p.footB = { x: -8, y: 0 };
      p.handF = { x: -4, y: p.shoulderY + 6 };
      p.handB = { x: -10, y: p.shoulderY + 4 };
      p.crouch = 2;
    } else {
      ph = at * 2.5;
      p.bob = Math.sin(ph);
      p.handF.y = -h * 0.46 + Math.sin(ph);
      p.handB.y = -h * 0.46 - Math.sin(ph) * 0.8;
      p.headY += Math.sin(ph) * 0.5;
    }
    return p;
  }

  /* --- общая отрисовка тела --- */
  function drawBodyLocal(ctx, a, cfg, p, t) {
    var fl = (a.flash || 0) > 0;
    var oc = fl ? C.lav : C.ink;
    function cc(v) { return fl ? C.white : v; }
    var h = cfg.h;
    var bob = p.bob, crouch = p.crouch;
    var hipY = p.hipY + crouch + bob;
    var shY = p.shoulderY + crouch + bob;
    var lean = p.lean;
    var headX = p.headX + p.lean * 0.4;
    var headY = p.headY + crouch + bob;
    var tw = cfg.torsoW;
    var hipF = { x: tw * 0.2 + lean * 0.2, y: hipY };
    var hipB = { x: -tw * 0.2 + lean * 0.2, y: hipY };
    var shF = { x: tw * 0.46 + lean * 0.5, y: shY + 2 };
    var shB = { x: -tw * 0.46 + lean * 0.5, y: shY + 2 };
    var hF = { x: p.handF.x + lean * 0.4, y: p.handF.y + crouch + bob };
    var hB = { x: p.handB.x + lean * 0.4, y: p.handB.y + crouch + bob };
    var footF = p.footF, footB = p.footB;
    var skinny = cfg.armW <= 3;

    /* 1 — задняя нога */
    limb(ctx, hipB.x, hipB.y, footB.x, footB.y - 2, cfg.legW, cc(cfg.pants), oc);
    lr(ctx, footB.x - cfg.legW * 0.7 - 1, footB.y - 4, cfg.legW * 1.3 + 2, 3, oc);
    lr(ctx, footB.x - cfg.legW * 0.7, footB.y - 3, cfg.legW * 1.3, 2, cc(cfg.boot));
    lr(ctx, footB.x - cfg.legW * 0.7, footB.y - 1, cfg.legW * 1.3, 1, cc(C.deep));
    /* 2 — задняя рука */
    limb(ctx, shB.x, shB.y, hB.x, hB.y, cfg.armW, cc(cfg.sleeve || cfg.outfit), oc);
    lr(ctx, hB.x - cfg.armW * 0.5, hB.y - cfg.armW * 0.5, cfg.armW + 1, cfg.armW + 1, oc);
    lr(ctx, hB.x - cfg.armW * 0.5 + 1, hB.y - cfg.armW * 0.5 + 1, cfg.armW - 1, cfg.armW - 1, cc(cfg.glove));

    /* 3 — торс */
    var torsoTop = shY - 1;
    var torsoBot = hipY + 2;
    var torsoH = Math.max(4, torsoBot - torsoTop);
    lr(ctx, -tw / 2 - 2 + lean * 0.5, torsoTop - 1, tw + 4, torsoH + 2, oc);
    lr(ctx, -tw / 2 - 1 + lean * 0.5, torsoTop, tw + 2, 3, cc(cfg.outfit));      /* плечи */
    lr(ctx, -tw / 2 + lean * 0.4, torsoTop + 2, tw, torsoH - 2, cc(cfg.outfit2)); /* куртка */
    lr(ctx, -tw / 2 + 1 + lean * 0.4, torsoTop + 3, tw - 2, torsoH - 5, cc(cfg.outfit));
    lr(ctx, -tw / 2 + 2 + lean * 0.35, torsoTop + 3, 2, torsoH - 5, cc(cfg.accent));
    /* пояс */
    lr(ctx, -tw / 2 + lean * 0.4, torsoBot - 4, tw, 3, oc);
    lr(ctx, -tw / 2 + 1 + lean * 0.4, torsoBot - 3, tw - 2, 1, cc(cfg.accent));

    /* 4 — передняя нога */
    limb(ctx, hipF.x, hipF.y, footF.x, footF.y - 2, cfg.legW, cc(cfg.pants), oc);
    lr(ctx, footF.x - cfg.legW * 0.7 - 1, footF.y - 4, cfg.legW * 1.3 + 2, 3, oc);
    lr(ctx, footF.x - cfg.legW * 0.7, footF.y - 3, cfg.legW * 1.3, 2, cc(cfg.boot));
    lr(ctx, footF.x - cfg.legW * 0.7, footF.y - 1, cfg.legW * 1.3, 1, cc(C.deep));

    /* 5 — передняя рука */
    if (!skinny) {
      lr(ctx, shF.x - 2, shF.y - 2, cfg.armW + 3, 3, cc(cfg.sleeve || cfg.outfit));
    }
    limb(ctx, shF.x, shF.y, hF.x, hF.y, cfg.armW, cc(cfg.sleeve || cfg.outfit), oc);
    lr(ctx, hF.x - cfg.armW * 0.5 - 1, hF.y - cfg.armW * 0.5 - 1, cfg.armW + 2, cfg.armW + 2, oc);
    lr(ctx, hF.x - cfg.armW * 0.5, hF.y - cfg.armW * 0.5, cfg.armW, cfg.armW, cc(cfg.glove));

    /* 6 — голова */
    var hw = cfg.headW, hh = cfg.headH;
    lr(ctx, headX - hw / 2 - 1, headY - hh / 2 - 1, hw + 2, hh + 2, oc);
    lr(ctx, headX - hw / 2, headY - hh / 2, hw, hh, cc(cfg.skin));
    lr(ctx, headX - hw / 2 + 1, headY + hh / 2 - 2, hw - 2, 2, cc(cfg.skinD));
    /* шея */
    lr(ctx, headX - 2, headY + hh / 2 - 1, 4, 3, oc);
    lr(ctx, headX - 1, headY + hh / 2 - 1, 2, 2, cc(cfg.skin));

    /* 7 — детали персонажа */
    drawFighterDetails(ctx, a, cfg, p, t, fl, cc, oc, headX, headY, shY, torsoTop, torsoBot, hF, hB, lean);
  }

  function drawFighterDetails(ctx, a, cfg, p, t, fl, cc, oc, headX, headY, shY, torsoTop, torsoBot, hF, hB, lean) {
    var ch = a.char || a.kind;
    var hw = cfg.headW, hh = cfg.headH;
    var hx = headX - hw / 2;
    var hy = headY - hh / 2;
    var mid = torsoTop + Math.round((torsoBot - torsoTop) * 0.45);

    if (ch === 'comet') {
      /* острые волосы с циановыми кончиками */
      lr(ctx, hx - 2, hy - 1, 4, 3, oc);
      lr(ctx, hx + 2, hy - 4, 5, 5, oc);
      lr(ctx, hx + 7, hy - 2, 3, 4, oc);
      lr(ctx, hx - 1, hy - 1, 3, 2, cc(cfg.hair));
      lr(ctx, hx + 3, hy - 3, 3, 3, cc(cfg.hair));
      lr(ctx, hx + 7, hy - 1, 2, 2, cc(cfg.hair));
      lr(ctx, hx, hy - 2, 2, 1, cc(cfg.hairHi));
      lr(ctx, hx + 4, hy - 4, 2, 1, cc(cfg.hairHi));
      /* лицо */
      lr(ctx, hx + hw - 3, hy + 3, 2, 2, cc(C.white));
      lr(ctx, hx + hw - 2, hy + 3, 1, 1, oc);
      lr(ctx, hx + hw - 4, hy + 2, 2, 1, oc);
      lr(ctx, hx + hw - 3, hy + 7, 2, 1, cc(C.wine));
      /* воротник */
      lr(ctx, hx - 1, torsoTop + 3, 3, 2, cc(cfg.accent));
      lr(ctx, hx + hw - 2, torsoTop + 3, 3, 2, cc(cfg.accent));
      /* шарф: хвост за спиной + узел */
      var wv = Math.sin(t * 5 + (a.animT || 0) * 4);
      var ny = headY + hh / 2 + 1;
      limb(ctx, headX - 2, ny, -9, ny + 7 + wv * 2, 4, cc(cfg.scarf), oc);
      limb(ctx, -9, ny + 7 + wv * 2, -17, ny + 12 + wv * 4, 4, cc(cfg.scarf), oc);
      lr(ctx, -19, ny + 10 + wv * 4, 4, 4, cc(cfg.scarf));
      lr(ctx, headX - 4, ny - 1, 8, 4, oc);
      lr(ctx, headX - 3, ny, 6, 2, cc(cfg.scarf));
      lr(ctx, headX - 2, ny + 1, 3, 1, cc(C.amber));
      /* молния куртки */
      lr(ctx, headX - 1, torsoTop + 5, 1, torsoBot - torsoTop - 7, cc(cfg.accent));
      lr(ctx, headX + 1, torsoTop + 7, 1, 3, cc(cfg.accent));
      /* эмблема: комета с хвостом */
      lr(ctx, headX + 1, mid - 1, 3, 3, cc(C.orange));
      lr(ctx, headX + 2, mid, 1, 1, cc(C.white));
      lr(ctx, headX - 2, mid, 3, 1, cc(C.amber));
      lr(ctx, headX - 5, mid + 1, 3, 1, cc(C.amber));
      /* манжеты */
      lr(ctx, hF.x - 2, hF.y - 3, 4, 2, cc(cfg.accent));
      lr(ctx, hB.x - 2, hB.y - 3, 4, 2, cc(cfg.accent));
    } else if (ch === 'hammer') {
      var tw = cfg.torsoW;
      /* бритая голова: тень затылка и стальная скоба на виске */
      lr(ctx, hx, hy, 3, hh - 4, cc(cfg.skinD));
      lr(ctx, hx - 1, hy + 3, 2, 4, oc);
      lr(ctx, hx - 1, hy + 4, 1, 2, cc(C.lav));
      /* тяжёлая бровь */
      lr(ctx, hx + 2, hy + 3, hw - 3, 1, oc);
      /* живой глаз */
      lr(ctx, hx + 3, hy + 4, 2, 2, cc(C.white));
      lr(ctx, hx + 4, hy + 5, 1, 1, oc);
      /* кибер-глаз: стальная пластина + огонёк горна */
      lr(ctx, hx + hw - 5, hy + 2, 6, 6, oc);
      lr(ctx, hx + hw - 4, hy + 3, 4, 4, cc(C.lav));
      lr(ctx, hx + hw - 3, hy + 4, 2, 2, cc(C.amber));
      if (!fl) lr(ctx, hx + hw - 3, hy + 4, 1, 1, C.white);
      /* окладистая борода */
      lr(ctx, hx - 1, hy + hh - 5, hw + 2, 7, oc);
      lr(ctx, hx, hy + hh - 4, hw, 5, cc(C.shadow));
      lr(ctx, hx + 1, hy + hh - 4, hw - 3, 1, cc(C.deep));
      lr(ctx, hx + hw - 5, hy + hh - 3, 3, 1, cc(C.wine));
      /* кожаный фартук на лямках */
      var apT = torsoTop + 4, apB = torsoBot + 4;
      var apX = -tw / 2 + 3 + lean * 0.4;
      lr(ctx, apX, apT, tw - 6, apB - apT, oc);
      lr(ctx, apX + 1, apT + 1, tw - 8, apB - apT - 2, cc(C.wine));
      lr(ctx, apX + 1, apT + 1, tw - 8, 1, cc(C.magenta));
      lr(ctx, apX + 4, apT + 6, tw - 14, 4, cc(C.shadow));
      lr(ctx, apX + 4, apT + 6, tw - 14, 1, cc(C.amber));
      lr(ctx, apX + 1, torsoTop, 2, 5, cc(C.amber));
      lr(ctx, apX + tw - 9, torsoTop, 2, 5, cc(C.amber));
      /* механическая рука-молот (передняя) */
      var sfx = tw * 0.46 + lean * 0.5, sfy = shY + 2;
      var mx = (sfx + hF.x) / 2, my = (sfy + hF.y) / 2 + 1;
      limb(ctx, sfx, sfy, mx, my, 6, cc(C.purple), oc);
      limb(ctx, mx, my, hF.x, hF.y, 5, cc(C.lav), oc);
      limbRaw(ctx, mx, my - 1, hF.x, hF.y - 2, 1, cc(C.white));
      lr(ctx, mx - 2, my - 2, 4, 4, oc);
      lr(ctx, mx - 1, my - 1, 2, 2, cc(C.orange));
      /* шарнир плеча */
      lr(ctx, sfx - 3, sfy - 3, 6, 6, oc);
      lr(ctx, sfx - 2, sfy - 2, 4, 4, cc(C.purple));
      lr(ctx, sfx - 1, sfy - 1, 2, 2, cc(C.orange));
      /* боёк молота вместо кулака: высокий стальной блок, ударная грань раскалена */
      lr(ctx, hF.x - 4, hF.y - 7, 10, 14, oc);
      lr(ctx, hF.x - 3, hF.y - 6, 8, 12, cc(C.lav));
      lr(ctx, hF.x - 3, hF.y - 6, 8, 1, cc(C.white));
      lr(ctx, hF.x - 3, hF.y + 4, 8, 2, cc(C.purple));
      lr(ctx, hF.x - 3, hF.y - 1, 8, 1, cc(C.purple));
      lr(ctx, hF.x + 4, hF.y - 5, 1, 10, cc(C.orange));
      if (!fl) lr(ctx, hF.x + 5, hF.y - 3, 1, 6, C.amber);
      /* стальной наруч на живой руке */
      lr(ctx, hB.x - 3, hB.y - 5, 6, 3, oc);
      lr(ctx, hB.x - 2, hB.y - 4, 4, 1, cc(C.lav));
      /* пояс с клёпками */
      lr(ctx, -tw / 2, torsoBot - 5, tw, 3, oc);
      lr(ctx, -tw / 2 + 1, torsoBot - 4, tw - 2, 1, cc(C.deep));
      lr(ctx, -2, torsoBot - 5, 4, 3, cc(C.lav));
    } else if (ch === 'punk') {
      /* ирокез */
      lr(ctx, headX - 2, hy - 9, 5, 9, oc);
      lr(ctx, headX - 1, hy - 10, 3, 10, oc);
      lr(ctx, headX - 1, hy - 8, 3, 7, cc(cfg.hair));
      lr(ctx, headX, hy - 9, 1, 6, cc(C.white));
      lr(ctx, headX - 2, hy - 6, 1, 4, cc(cfg.hair));
      lr(ctx, headX + 2, hy - 5, 1, 4, cc(cfg.hair));
      /* бритые виски */
      lr(ctx, hx, hy, hw, 2, cc(cfg.skinD));
      /* глаза-подводка + ухмылка */
      lr(ctx, hx + 3, hy + 3, hw - 3, 2, oc);
      lr(ctx, hx + hw - 3, hy + 3, 1, 1, cc(C.white));
      lr(ctx, hx + 1, hy + 7, 5, 1, oc);
      lr(ctx, hx + 2, hy + 7, 3, 1, cc(C.white));
      /* открытая косуха */
      lr(ctx, -cfg.torsoW / 2 + 2, torsoTop + 3, cfg.torsoW - 4, 9, cc(cfg.skin));
      lr(ctx, -2, torsoTop + 3, 5, 9, cc(cfg.skin));
      lr(ctx, cfg.torsoW / 2 - 5, torsoTop + 3, 3, 11, cc(cfg.outfit));
      lr(ctx, -cfg.torsoW / 2 + 2, torsoTop + 3, 3, 11, cc(cfg.outfit));
      /* заклёпки */
      lr(ctx, -cfg.torsoW / 2 + 2, torsoTop + 5, 1, 1, cc(C.amber));
      lr(ctx, cfg.torsoW / 2 - 3, torsoTop + 8, 1, 1, cc(C.amber));
      /* цепь */
      lr(ctx, -4, torsoTop + 6, 3, 1, cc(C.amber));
      lr(ctx, -1, torsoTop + 7, 3, 1, cc(C.amber));
      lr(ctx, 2, torsoTop + 6, 3, 1, cc(C.amber));
      /* браслеты-шипы */
      lr(ctx, hF.x - 3, hF.y - 3, 5, 2, cc(C.ink));
      lr(ctx, hF.x - 3, hF.y - 4, 1, 2, cc(C.amber));
      lr(ctx, hF.x + 1, hF.y - 4, 1, 2, cc(C.amber));
    } else if (ch === 'ninja') {
      /* капюшон */
      lr(ctx, hx - 1, hy - 1, hw + 2, hh + 2, oc);
      lr(ctx, hx, hy, hw, hh, cc(cfg.outfit));
      lr(ctx, hx - 1, hy - 1, hw + 2, 2, cc(C.deep));
      /* прорезь глаз */
      lr(ctx, hx + 2, hy + 3, hw - 2, 2, cc(C.ink));
      lr(ctx, hx + 3, hy + 3, 2, 1, cc(C.cyan));
      lr(ctx, hx + hw - 2, hy + 3, 1, 1, cc(C.cyan));
      lr(ctx, hx + 3, hy + 3, 1, 1, cc(C.white));
      /* хвост капюшона */
      lr(ctx, hx - 3, hy + 2, 3, 3, cc(C.deep));
      /* шарф — две ленты */
      var wv2 = Math.sin(t * 6 + (a.animT || 0) * 5);
      limb(ctx, headX - 3, hy + hh - 1, -8, hy + hh + 5 + wv2 * 2, 3, cc(cfg.scarf), oc);
      limb(ctx, -8, hy + hh + 5 + wv2 * 2, -15, hy + hh + 10 + wv2 * 4, 3, cc(cfg.scarf), oc);
      limb(ctx, headX - 2, hy + hh, -6, hy + hh + 11 - wv2 * 2, 2, cc(C.purple), oc);
      lr(ctx, -16, hy + hh + 9 + wv2 * 4, 3, 3, cc(cfg.scarf));
      /* нагрудная перевязь + эмблема */
      lr(ctx, -cfg.torsoW / 2 + 2, torsoTop + 3, 3, cfg.torsoH || 12, cc(C.deep));
      lr(ctx, 2, torsoTop + 5, 5, 1, cc(C.cyan));
      lr(ctx, 4, torsoTop + 4, 1, 3, cc(C.cyan));
      lr(ctx, 2, torsoTop + 6, 1, 1, cc(C.cyan));
      /* обмотки рук */
      lr(ctx, hF.x - 2, hF.y - 3, 4, 1, cc(C.cyan));
      lr(ctx, hF.x - 2, hF.y - 1, 4, 1, cc(C.cyan));
      lr(ctx, hB.x - 2, hB.y - 3, 4, 1, cc(C.cyan));
      /* оби */
      lr(ctx, -cfg.torsoW / 2, torsoBot - 4, cfg.torsoW, 2, cc(C.cyan));
      lr(ctx, -cfg.torsoW / 2, torsoBot - 2, cfg.torsoW, 2, cc(C.deep));
    } else if (ch === 'brute') {
      /* голова */
      lr(ctx, hx - 2, hy - 2, 4, 3, cc(cfg.skinD));
      lr(ctx, hx + hw - 2, hy - 2, 3, 3, cc(cfg.skinD));
      /* злые глаза */
      lr(ctx, hx + 2, hy + 3, 3, 2, oc);
      lr(ctx, hx + 2, hy + 3, 2, 1, cc(C.white));
      lr(ctx, hx + hw - 5, hy + 3, 3, 2, oc);
      lr(ctx, hx + hw - 5, hy + 3, 2, 1, cc(C.white));
      lr(ctx, hx + 2, hy + 2, 4, 1, cc(C.ink));
      /* челюсть */
      lr(ctx, hx + 1, hy + 7, hw - 2, 3, oc);
      lr(ctx, hx + 2, hy + 7, hw - 4, 2, cc(cfg.skin));
      lr(ctx, hx + 3, hy + 7, 1, 1, cc(C.white));
      lr(ctx, hx + 6, hy + 7, 1, 1, cc(C.white));
      lr(ctx, hx + 4, hy + 9, 3, 1, cc(C.ink));
      /* шипы на плечах */
      for (var sp = 0; sp < 2; sp++) {
        var spx = sp === 0 ? -cfg.torsoW / 2 - 4 : cfg.torsoW / 2;
        lr(ctx, spx, torsoTop - 5, 3, 6, oc);
        lr(ctx, spx + 1, torsoTop - 4, 1, 4, cc(C.amber));
        lr(ctx, spx - 1, torsoTop - 1, 5, 2, cc(C.deep));
      }
      /* цепи */
      for (var ci = -cfg.torsoW / 2 + 3; ci < cfg.torsoW / 2 - 3; ci += 4) {
        lr(ctx, ci, torsoTop + 7 + ((ci & 4) ? 1 : 0), 3, 2, oc);
        lr(ctx, ci + 1, torsoTop + 7 + ((ci & 4) ? 1 : 0), 1, 1, cc(C.amber));
      }
      lr(ctx, -cfg.torsoW / 2 + 2, torsoTop + 5, cfg.torsoW - 4, 1, cc(C.amber));
      /* браслеты */
      lr(ctx, hF.x - 4, hF.y - 3, 7, 3, cc(C.ink));
      lr(ctx, hF.x - 4, hF.y - 3, 7, 1, cc(C.amber));
      lr(ctx, hB.x - 4, hB.y - 3, 7, 3, cc(C.ink));
      lr(ctx, hB.x - 4, hB.y - 3, 7, 1, cc(C.amber));
      /* шрам */
      lr(ctx, -3, torsoTop + 9, 5, 1, cc(C.wine));
    }
    /* вспышка урона */
    if (a.hurtT > 0) {
      lr(ctx, headX + 2, headY - 5, 1, 2, C.white);
      lr(ctx, -3, torsoTop + 6, 2, 1, C.white);
    }
  }

  /* --- босс ХРОМ-9: корпоративный ИИ в теле промышленного погрузчика ---
     Ховер-шасси, бронекорпус с реактором, голова-монитор, два манипулятора;
     дальняя атака — силовой кабель с захватом из переднего манипулятора. */
  function drawKhromLocal(ctx, a, cfg, p, t) {
    var fl = (a.flash || 0) > 0;
    var oc = fl ? C.lav : C.ink;
    function cc(v) { return fl ? C.white : v; }
    var anim = a.anim || 'idle';
    var ex = attackExt(a);
    var e = Math.max(0, ex);
    var sway = Math.sin(t * 1.8);
    var bob = Math.round(Math.sin(t * 2.1) * 2);
    var lean = anim === 'hurt' ? -3 : (anim === 'roar' ? -2 : (anim === 'cable' ? Math.round(e * 2) : 0));
    var hot = !!a.phase2;
    var eyeC = hot ? C.orange : C.cyan;
    var top = -58 + bob;
    var base = -22 + bob;

    /* реактивные струи */
    if (!fl) {
      for (var j = 0; j < 3; j++) {
        var jx = -13 + j * 12;
        var jl = 3 + (((t * 20) | 0) + j * 2) % 3;
        lr(ctx, jx, base + 19, 3, jl, j === 1 ? C.magenta : C.cyan);
        lr(ctx, jx + 1, base + 19, 1, jl + 2, C.white);
      }
    }
    /* ховер-шасси */
    for (var r = 0; r < 6; r++) {
      var w = 24 + r * 3, y = base + r * 3;
      lr(ctx, -w / 2 - 1, y, w + 2, 4, oc);
      lr(ctx, -w / 2, y, w, 3, cc(r < 2 ? C.purple : C.deep));
    }
    /* полоса «осторожно» */
    var hbY = base + 16, hbW = 40;
    lr(ctx, -hbW / 2 - 1, hbY - 1, hbW + 2, 5, oc);
    for (var st = 0; st < hbW; st += 4) {
      lr(ctx, -hbW / 2 + st, hbY, 2, 3, cc(C.amber));
      lr(ctx, -hbW / 2 + st + 2, hbY, 2, 3, cc(C.ink));
    }
    lr(ctx, -hbW / 2 + 1, base + 6, 2, 2, cc(C.magenta));
    lr(ctx, hbW / 2 - 3, base + 6, 2, 2, cc(C.cyan));

    /* руки-манипуляторы: позы кистей */
    var handF, handB;
    if (anim === 'roar') {
      handF = { x: 21, y: top + 2 - sway * 2 };
      handB = { x: -21, y: top + 2 + sway * 2 };
    } else if (anim === 'cast') {
      handF = { x: 12 + e * 16, y: top + 22 };
      handB = { x: 4 + e * 12, y: top + 27 };
    } else if (anim === 'slam') {
      handF = { x: 13 + e * 6, y: lerp(top + 24, -4, e) };
      handB = { x: -13 - e * 6, y: lerp(top + 24, -4, e) };
    } else if (anim === 'cable') {
      handF = { x: 14 + e * 12, y: top + 18 - e * 2 };
      handB = { x: -14, y: top + 27 };
    } else if (anim === 'hurt') {
      handF = { x: 6, y: top + 16 };
      handB = { x: -18, y: top + 12 };
    } else {
      handF = { x: 17 + sway, y: top + 28 };
      handB = { x: -17 - sway, y: top + 28 };
    }
    var shF = { x: 14 + lean, y: top + 13 };
    var shB = { x: -14 + lean, y: top + 13 };
    function manip(sh, hand, back) {
      var el = { x: (sh.x + hand.x) / 2 + (back ? -2 : 2), y: (sh.y + hand.y) / 2 + 4 };
      limb(ctx, sh.x, sh.y, el.x, el.y, 5, cc(back ? C.purple : C.lav), oc);
      limb(ctx, el.x, el.y, hand.x, hand.y, 4, cc(back ? C.deep : C.purple), oc);
      if (!back) limbRaw(ctx, sh.x, sh.y - 1, el.x, el.y - 1, 1, cc(C.white));
      lr(ctx, el.x - 2, el.y - 2, 4, 4, oc);
      lr(ctx, el.x - 1, el.y - 1, 2, 2, cc(C.amber));
      /* клешня-захват */
      lr(ctx, hand.x - 3, hand.y - 3, 6, 6, oc);
      lr(ctx, hand.x - 2, hand.y - 2, 4, 4, cc(back ? C.purple : C.lav));
      lr(ctx, hand.x + 2, hand.y - 4, 3, 2, oc);
      lr(ctx, hand.x + 2, hand.y + 2, 3, 2, oc);
      lr(ctx, hand.x + 3, hand.y - 4, 2, 1, cc(C.white));
      lr(ctx, hand.x + 3, hand.y + 3, 2, 1, cc(C.white));
    }
    function shoulder(sh, back) {
      lr(ctx, sh.x - 4, sh.y - 4, 8, 8, oc);
      lr(ctx, sh.x - 3, sh.y - 3, 6, 6, cc(back ? C.purple : C.lav));
      lr(ctx, sh.x - 3, sh.y - 3, 6, 1, cc(back ? C.lav : C.white));
      lr(ctx, sh.x - 1, sh.y - 1, 2, 2, cc(C.ink));
    }
    manip(shB, handB, true);
    shoulder(shB, true);

    /* бронекорпус */
    var tx = -13 + lean, tw = 26, ty = top + 9, th = base - ty + 2;
    lr(ctx, tx - 1, ty - 1, tw + 2, th + 2, oc);
    lr(ctx, tx, ty, tw, th, cc(C.deep));
    lr(ctx, tx, ty, tw, 2, cc(C.lav));
    lr(ctx, tx, ty + 2, 2, th - 2, cc(C.purple));
    lr(ctx, tx + tw - 2, ty + 2, 2, th - 2, cc(C.shadow));
    lr(ctx, tx + 3, ty + 4, 1, 1, cc(C.lav));
    lr(ctx, tx + tw - 4, ty + 4, 1, 1, cc(C.lav));
    lr(ctx, tx + 3, ty + th - 4, tw - 6, 1, cc(C.magenta));
    /* реактор */
    var rx = lean, ry = ty + Math.round(th / 2) - 1;
    lr(ctx, rx - 5, ry - 5, 10, 10, oc);
    lr(ctx, rx - 4, ry - 4, 8, 8, cc(C.shadow));
    lr(ctx, rx - 3, ry - 3, 6, 6, cc(hot ? C.wine : C.teal));
    lr(ctx, rx - 2, ry - 2, 4, 4, cc(eyeC));
    lr(ctx, rx - 1, ry - 1, 2, 2, cc(Math.sin(t * 5) > 0 ? C.white : eyeC));

    /* голова-монитор на штанге */
    var hx0 = lean + (anim === 'hurt' ? -2 : 0), hy0 = top - 5;
    lr(ctx, hx0 - 2, hy0 + 6, 4, ty - hy0 - 5, oc);
    lr(ctx, hx0 - 1, hy0 + 6, 2, ty - hy0 - 5, cc(C.purple));
    lr(ctx, hx0 - 10, hy0 - 8, 20, 15, oc);
    lr(ctx, hx0 - 9, hy0 - 7, 18, 13, cc(C.lav));
    lr(ctx, hx0 - 11, hy0 - 3, 2, 5, cc(C.purple));
    lr(ctx, hx0 + 9, hy0 - 3, 2, 5, cc(C.purple));
    lr(ctx, hx0 - 8, hy0 - 6, 16, 11, cc(C.ink));
    /* лицо на экране */
    if (fl) {
      lr(ctx, hx0 - 6, hy0 - 3, 4, 2, C.white);
      lr(ctx, hx0 + 2, hy0 - 3, 4, 2, C.white);
    } else {
      var angry = anim === 'roar' || anim === 'cable' || hot;
      lr(ctx, hx0 - 6, hy0 - 3, 4, 2, eyeC);
      lr(ctx, hx0 + 2, hy0 - 3, 4, 2, eyeC);
      if (angry) {
        lr(ctx, hx0 - 6, hy0 - 4, 2, 1, eyeC);
        lr(ctx, hx0 + 4, hy0 - 4, 2, 1, eyeC);
      }
      lr(ctx, hx0 - 5, hy0 - 3, 1, 1, C.white);
      lr(ctx, hx0 + 3, hy0 - 3, 1, 1, C.white);
      var amp = anim === 'roar' ? 2 : 1;
      for (var mi = 0; mi < 10; mi++) {
        lr(ctx, hx0 - 5 + mi, hy0 + 2 + Math.round(Math.sin(t * 18 + mi * 1.3) * amp), 1, 1, C.magenta);
      }
      ctx.globalAlpha = 0.35;
      lr(ctx, hx0 - 8, hy0 - 6 + (((t * 12) | 0) % 11), 16, 1, C.lav);
      ctx.globalAlpha = 1;
      glowFrame(ctx, hx0 - 10, hy0 - 8, 20, 15, eyeC, 0.22);
    }
    /* антенна */
    lr(ctx, hx0 + 6, hy0 - 13, 1, 5, cc(C.lav));
    lr(ctx, hx0 + 5, hy0 - 14, 3, 2, cc(blink(t, 7) ? C.magenta : C.wine));

    manip(shF, handF, false);
    shoulder(shF, false);
    drawKhromCable(ctx, a, t, anim, ex, handF, oc, cc);

    /* искры-разряды вокруг */
    if (!fl) {
      for (var q = 0; q < 4; q++) {
        var ang = t * 1.6 + q * 1.57;
        var ax = Math.round(Math.cos(ang) * 23);
        var ay = Math.round(top + 18 + Math.sin(ang * 1.3) * 16);
        lr(ctx, ax, ay, 2, 2, q % 2 ? C.magenta : C.cyan);
      }
    }
  }

  /* силовой кабель с захватом (атака на дальность — механика не менялась) */
  function drawKhromCable(ctx, a, t, anim, ex, hand, oc, cc) {
    var on = anim === 'cable';
    var e = Math.max(0, ex);
    var len = on ? 22 + e * 64 : 0;
    var pts = [];
    var n = 9;
    for (var i = 0; i <= n; i++) {
      var k = i / n;
      var x, y;
      if (on) {
        x = hand.x + 4 + len * k;
        y = hand.y + Math.sin(k * 6 + t * 14) * (1 + k * 3) * (1 - e * 0.5);
      } else {
        x = hand.x + 2 + k * 5 + Math.sin(t * 2 + k * 3) * k;
        y = hand.y + 3 + k * 13;
      }
      pts.push({ x: x, y: y });
    }
    for (var j = 0; j < n; j++) {
      limb(ctx, pts[j].x, pts[j].y, pts[j + 1].x, pts[j + 1].y, 2, cc(C.teal), oc);
    }
    if (!(a.flash > 0)) {
      for (var j2 = 1; j2 < n; j2 += 2) lr(ctx, pts[j2].x, pts[j2].y, 1, 1, C.cyan);
    }
    var tip = pts[n];
    if (on) {
      lr(ctx, tip.x - 1, tip.y - 3, 5, 7, oc);
      lr(ctx, tip.x, tip.y - 2, 3, 5, cc(C.lav));
      lr(ctx, tip.x + 3, tip.y - 4, 3, 2, oc);
      lr(ctx, tip.x + 3, tip.y + 2, 3, 2, oc);
      lr(ctx, tip.x + 4, tip.y - 4, 2, 1, cc(C.white));
      lr(ctx, tip.x + 4, tip.y + 3, 2, 1, cc(C.white));
      if (e > 0.5 && !(a.flash > 0)) {
        lr(ctx, tip.x + 6, tip.y - 1, 2, 2, C.magenta);
        lr(ctx, tip.x + 7, tip.y - 2, 1, 1, C.white);
      }
    } else {
      lr(ctx, tip.x - 1, tip.y - 1, 3, 3, oc);
      lr(ctx, tip.x, tip.y, 1, 1, cc(C.cyan));
    }
  }

  /* --- публичная отрисовка актёра --- */
  function drawFighter(ctx, a, S, t, opt) {
    if (!a) return;
    var cfg = cfgFor(a);
    var cam = camOf(S || {});
    var shakeX = cam.sx, shakeY = cam.sy;
    var ax = a.x - cam.x + shakeX;
    var groundY = a.y + shakeY;
    var z = a.z || 0;
    var sx = Math.round(ax);
    var sy = Math.round(groundY - z);
    if (sx < -70 || sx > 550 || groundY < 100) return;
    var alpha = a.alpha == null ? 1 : clamp(a.alpha, 0, 1);
    var fl = (a.flash || 0) > 0;
    var isPlayer = a.kind === 'player';

    /* индикатор неуязвимости (мерцание) */
    if (isPlayer && a.invuln > 0 && a.invuln <= 3 && !a.dead && a.state !== 'special' && !fl) {
      if (Math.sin(t * 34) > 0.55) alpha *= 0.35;
    }

    /* тень на земле */
    var shW = cfg.h * 0.3;
    var shH = Math.max(2, Math.round(cfg.h * 0.07));
    if (z > 0) {
      var shrink = clamp(1 - z / 160, 0.45, 1);
      shW *= shrink; shH = Math.max(2, Math.round(shH * shrink));
    }
    ctx.globalAlpha = 0.6 * alpha;
    shadowEllipse(ctx, sx, Math.round(groundY + 1), shW, shH, C.ink);
    ctx.globalAlpha = 1;
    if (a.char === 'khrom' && z > 1) {
      /* парящая тень-кольцо */
      ctx.globalAlpha = 0.3 * alpha;
      shadowEllipse(ctx, sx, Math.round(groundY + 2), cfg.h * 0.3, 3, C.purple);
      ctx.globalAlpha = 1;
    }

    ctx.save();
    ctx.translate(sx, sy);
    if (a.facing < 0) ctx.scale(-1, 1);
    ctx.globalAlpha = alpha;
    /* обводка-rim (key-art/босс) */
    var p = makePose(a, cfg, t);
    if (a.char === 'khrom') {
      drawKhromLocal(ctx, a, cfg, p, t);
    } else if (p.prone) {
      ctx.translate(0, -4);
      ctx.rotate(-PI / 2);
      drawBodyLocal(ctx, a, cfg, p, t);
    } else {
      drawBodyLocal(ctx, a, cfg, p, t);
    }
    ctx.restore();
    ctx.globalAlpha = 1;

    /* аура готового спецприёма у игрока */
    if (isPlayer && a.specialReady && !a.dead) {
      var ar = 13 + Math.sin(t * 6) * 2;
      ctx.globalAlpha = 0.7;
      ring(ctx, sx, Math.round(groundY), ar, C.lime, 1);
      ring(ctx, sx, Math.round(groundY), ar + 4, Math.sin(t * 6) > 0 ? C.amber : C.lime, 1);
      ctx.globalAlpha = 1;
    }

    /* HP-полоска врага и телеграф атаки */
    if (!isPlayer && !a.dead && a.hp != null && a.maxHp) {
      var showBar = a.hp < a.maxHp || a.attack || a.hurtT > 0;
      var barY = sy - Math.round(cfg.h) - 9;
      if (showBar && a.char !== 'khrom') {
        var bw = Math.round(cfg.h * 0.5);
        var bxx = sx - Math.round(bw / 2);
        var hk = clamp(a.hp / a.maxHp, 0, 1);
        fill(ctx, bxx - 1, barY - 1, bw + 2, 5, C.ink);
        fill(ctx, bxx, barY, bw, 3, C.wine);
        fill(ctx, bxx, barY, Math.max(0, Math.round(bw * hk)), 3, hk > 0.5 ? C.lime : hk > 0.25 ? C.amber : C.magenta);
        if (hk > 0.04) fill(ctx, bxx, barY, Math.max(1, Math.round(bw * hk)), 1, C.white);
        /* метки */
        for (var tk = 0.25; tk < 1; tk += 0.25) fill(ctx, bxx + Math.round(bw * tk), barY, 1, 3, C.ink);
      }
      /* телеграф */
      if (a.attack && a.attack.phase === 'wind') {
        var warnY = barY - 15;
        if (Math.sin(t * 26) > -0.35) {
          fill(ctx, sx - 6, warnY, 12, 12, C.ink);
          rectB(ctx, sx - 6, warnY, 12, 12, C.amber);
          fill(ctx, sx - 1, warnY + 2, 2, 5, C.amber);
          fill(ctx, sx - 1, warnY + 8, 2, 2, C.amber);
        }
        /* подсветка земли под атакующим */
        ctx.globalAlpha = 0.5;
        shadowEllipse(ctx, sx + Math.round((a.facing || 1) * 12), Math.round(groundY), 12, 2, C.amber);
        ctx.globalAlpha = 1;
      }
    }
  }

  /* ============================================================
     7. БОЙ: ПРОПЫ, ПИКАПЫ, СНАРЯДЫ, ЧАСТИЦЫ, ПОПАПЫ
     ============================================================ */

  function drawPropShadow(ctx, x, y, w) {
    ctx.globalAlpha = 0.55;
    shadowEllipse(ctx, x, y + 1, w * 0.55, 3, C.ink);
    ctx.globalAlpha = 1;
  }

  function drawPropOne(ctx, pr, S, t, cam) {
    if (!pr) return;
    var sx = Math.round(pr.x - cam.x + cam.sx);
    var sy = Math.round(pr.y + cam.sy);
    if (sx < -60 || sx > 540) return;
    var w = pr.w || 22, h = pr.h || 24;
    drawPropShadow(ctx, sx, sy, w);
    var jx = pr.shakeT > 0 ? Math.round(Math.sin(t * 80) * 1.5) : 0;
    if (pr.broken) {
      drawBrokenProp(ctx, pr, sx + jx, sy, w, h, t);
    } else if (pr.type === 'barrel') {
      drawBarrel(ctx, sx + jx, sy, w, h);
    } else if (pr.type === 'vending') {
      drawVending(ctx, sx + jx, sy, w, h, t);
    } else {
      drawCrate(ctx, sx + jx, sy, w, h);
    }
  }

  function drawCrate(ctx, x, y, w, h) {
    var l = Math.round(x - w / 2);
    var t = Math.round(y - h);
    fill(ctx, l - 1, t - 1, w + 2, h + 2, C.ink);
    fill(ctx, l, t, w, h, C.orange);
    fill(ctx, l, t, w, 2, C.amber);
    fill(ctx, l, t, 2, h, C.amber);
    fill(ctx, l + w - 2, t, 2, h, C.wine);
    fill(ctx, l, t + h - 2, w, 2, C.wine);
    /* доски */
    fill(ctx, l + 2, t + 5, w - 4, 1, C.wine);
    fill(ctx, l + 2, t + 11, w - 4, 1, C.wine);
    fill(ctx, l + 2, t + 17, w - 4, 1, C.wine);
    /* крест */
    var n = Math.min(w, h) - 6;
    for (var i = 0; i < n; i++) {
      var k = i / (n - 1);
      fill(ctx, l + 3 + k * (w - 8), t + 4 + k * (h - 9), 2, 2, C.amber);
      fill(ctx, l + w - 5 - k * (w - 8), t + 4 + k * (h - 9), 2, 2, C.amber);
    }
    /* гвозди */
    fill(ctx, l + 1, t + 1, 1, 1, C.white);
    fill(ctx, l + w - 3, t + 1, 1, 1, C.white);
    fill(ctx, l + 1, t + h - 2, 1, 1, C.white);
  }

  function drawBarrel(ctx, x, y, w, h) {
    var l = Math.round(x - w / 2);
    var t = Math.round(y - h);
    fill(ctx, l - 1, t - 1, w + 2, h + 2, C.ink);
    fill(ctx, l, t, w, h, C.purple);
    fill(ctx, l + 1, t + 1, w - 2, h - 2, C.panel);
    fill(ctx, l + 2, t + 2, 3, h - 4, C.deep);
    fill(ctx, l + w - 4, t + 2, 2, h - 4, C.ink);
    /* обручи */
    fill(ctx, l, t + 4, w, 2, C.amber);
    fill(ctx, l, t + h - 7, w, 2, C.amber);
    fill(ctx, l, t + 4, w, 1, C.white);
    /* верх */
    fill(ctx, l + 1, t, w - 2, 2, C.lav);
    fill(ctx, l + 3, t + 1, w - 6, 1, C.panel);
    /* блик */
    fill(ctx, l + 4, t + 8, 2, 6, C.deep);
  }

  function drawVending(ctx, x, y, w, h, t) {
    var l = Math.round(x - w / 2);
    var t = Math.round(y - h);
    fill(ctx, l - 1, t - 1, w + 2, h + 2, C.ink);
    fill(ctx, l, t, w, h, C.shadow);
    fill(ctx, l, t, w, 2, C.deep);
    fill(ctx, l, t, 2, h, C.deep);
    fill(ctx, l + w - 2, t, 2, h, C.ink);
    /* светящаяся витрина */
    var gx = l + 4, gy = t + 5, gw = w - 8, gh = h - 14;
    fill(ctx, gx - 1, gy - 1, gw + 2, gh + 2, C.ink);
    fill(ctx, gx, gy, gw, gh, C.deep);
    dith(ctx, gx, gy, gw, gh, C.deep, C.cyan, 0.4);
    for (var i = 0; i < 3; i++) {
      fill(ctx, gx + 2, gy + 3 + i * 6, gw - 4, 2, i === 1 ? C.magenta : C.lime);
    }
    neonGlow(ctx, gx, gy, gw, gh, C.cyan, 4, 0.35);
    /* логотип 24/7 */
    fill(ctx, l + 3, t + h - 8, w - 6, 5, C.ink);
    text(ctx, '24/7', l + Math.round(w / 2) - textW('24/7', 1) / 2, t + h - 8, 1, C.amber, null);
    /* монетоприёмник */
    fill(ctx, l + w - 6, t + h - 14, 2, 4, C.ink);
    fill(ctx, l + w - 6, t + h - 13, 1, 2, C.lime);
    /* отражение на полу */
    ctx.globalAlpha = 0.35;
    dith(ctx, l, t + h, w, 12, C.bg, C.cyan, 0.3);
    ctx.globalAlpha = 1;
  }

  function drawBrokenProp(ctx, pr, x, y, w, h, t) {
    var k = clamp(pr.breakT / 1.2, 0, 1);
    fill(ctx, x - w / 2, y - 4, w, 4, C.ink);
    dith(ctx, x - w / 2, y - 5, w, 5, C.ink, C.wine, 0.5);
    /* разлёт обломков */
    var n = 5;
    for (var i = 0; i < n; i++) {
      var a = (i / n) * TAU + 0.4;
      var dist = 6 + k * 22 + rnd(i, 3) * 8;
      var bx = x - w / 2 + Math.cos(a) * dist;
      var by = y - 10 - Math.abs(Math.sin(a)) * (10 + k * 18) + k * k * 20;
      fill(ctx, bx, by, 3, 2, i % 2 ? C.orange : C.amber);
      fill(ctx, bx, by, 1, 1, C.ink);
    }
    if (pr.breakT < 0.25) {
      ctx.globalAlpha = 0.7;
      dith(ctx, x - w / 2 - 4, y - h - 4, w + 8, h + 8, C.ink, C.white, 0.3);
      ctx.globalAlpha = 1;
    }
  }

  /* --- пикапы --- */
  function drawPickupOne(ctx, it, S, t, cam) {
    if (!it) return;
      var sx = Math.round(it.x - cam.x + cam.sx);
      var sy = Math.round(it.y + cam.sy - (it.z || 0));
      if (sx < -30 || sx > 510) return;
      var bob = Math.sin((it.bob || 0) + t * 3) * 2;
      var by = sy + bob;
      var lifeFade = it.life < 3 ? (Math.sin(t * 16) > 0 ? 1 : 0.4) : 1;
      ctx.globalAlpha = lifeFade;
      ctx.globalAlpha = 0.5;
      shadowEllipse(ctx, sx, Math.round(it.y + cam.sy), 7, 2, C.ink);
      ctx.globalAlpha = 1;
      if (it.kind === 'coin') {
        var spin = Math.abs(Math.cos(t * 5 + (it.bob || 0)));
        var cw = Math.max(2, Math.round(7 * (0.35 + spin * 0.65)));
        fill(ctx, sx - cw / 2, by - 6, cw, 10, C.ink);
        fill(ctx, sx - cw / 2 + 1, by - 5, Math.max(1, cw - 2), 8, C.amber);
        fill(ctx, sx - cw / 2 + 1, by - 5, Math.max(1, cw - 2), 1, C.white);
        if (spin > 0.5) {
          fill(ctx, sx - 1, by - 3, 2, 4, C.wine);
          fill(ctx, sx - 1, by - 2, 1, 2, C.amber);
        }
        if (Math.sin(t * 8 + (it.bob || 0)) > 0.6) {
          fill(ctx, sx + cw / 2 + 2, by - 7, 1, 3, C.white);
          fill(ctx, sx + cw / 2 + 1, by - 6, 3, 1, C.white);
        }
      } else {
        /* еда: бургер-бокс */
        fill(ctx, sx - 6, by - 8, 12, 9, C.ink);
        fill(ctx, sx - 5, by - 7, 10, 7, C.orange);
        fill(ctx, sx - 5, by - 7, 10, 2, C.amber);
        fill(ctx, sx - 5, by - 3, 10, 1, C.wine);
        fill(ctx, sx - 2, by - 6, 4, 4, C.lime);
        fill(ctx, sx - 2, by - 6, 1, 1, C.white);
        /* пар */
        if (Math.sin(t * 3 + (it.bob || 0)) > 0.3) {
          ctx.globalAlpha = 0.5;
          fill(ctx, sx - 3, by - 12 + Math.sin(t * 4 + (it.bob || 0)), 2, 2, C.lav);
          fill(ctx, sx + 2, by - 13 + Math.cos(t * 4 + (it.bob || 0)), 2, 2, C.lav);
          ctx.globalAlpha = 1;
        }
      }
      ctx.globalAlpha = 1;
  }

  /* --- снаряды --- */
  function drawProjectilesWorld(ctx, S, t, cam) {
    var ps = S.projectiles || [];
    for (var i = 0; i < ps.length; i++) {
      var pr = ps[i];
      var sx = Math.round(pr.x - cam.x + cam.sx);
      var sy = Math.round(pr.y + cam.sy - (pr.z || 0));
      if (sx < -50 || sx > 530) continue;
      if (pr.kind === 'orb') {
        var r = pr.r || 4;
        /* хвост */
        for (var k = 1; k <= 3; k++) {
          ctx.globalAlpha = 0.5 - k * 0.12;
          fill(ctx, sx - Math.sign(pr.vx || -1) * k * 5, sy + Math.round(Math.sin(t * 20 + k) * 2), 3, 2, C.magenta);
          ctx.globalAlpha = 1;
        }
        disc(ctx, sx, sy, r + 3, C.ink);
        disc(ctx, sx, sy, r + 1, C.magenta);
        disc(ctx, sx, sy, r - 1, C.lav);
        disc(ctx, sx, sy, Math.max(1, r - 3), C.white);
        fill(ctx, sx - 1, sy - 1, 2, 2, C.white);
      } else if (pr.kind === 'shock') {
        var kk = 1 - clamp(pr.life / (pr.maxLife || 0.6), 0, 1);
        var rw = 8 + kk * (pr.r || 6) * 4;
        var yy = Math.round(pr.y + cam.sy);
        var xx = Math.round(pr.x - cam.x + cam.sx);
        ctx.globalAlpha = 0.9 - kk * 0.5;
        fill(ctx, xx - rw / 2, yy - 2, rw, 2, C.amber);
        fill(ctx, xx - rw / 4, yy - 4, rw / 2, 1, C.white);
        fill(ctx, xx - rw / 2 + 2, yy, rw - 4, 1, C.orange);
        ctx.globalAlpha = 1;
      } else if (pr.kind === 'cable') {
        var ex2 = Math.abs(pr.vx) > 0 ? Math.sign(pr.vx) : 1;
        for (var s = 0; s < 9; s++) {
          fill(ctx, sx + ex2 * s * 4, sy + Math.round(Math.sin(t * 16 + s * 0.7) * 4), 4, 2, s === 8 ? C.white : C.magenta);
        }
      } else {
        disc(ctx, sx, sy, pr.r || 3, C.magenta);
        disc(ctx, sx, sy, 1, C.white);
      }
    }
  }

  /* --- частицы --- */
  function drawParticlesWorld(ctx, S, t, cam) {
    var ps = S.particles || [];
    for (var i = 0; i < ps.length; i++) {
      var p = ps[i];
      var k = clamp(p.life / (p.maxLife || 0.5), 0, 1);
      var sx = Math.round(p.x - cam.x + cam.sx);
      var sy = Math.round(p.y + cam.sy - (p.z || 0));
      if (sx < -40 || sx > 520) continue;
      var col = p.color || C.amber;
      var size = Math.max(1, Math.round(p.size || 2));
      var alpha = k > 0.6 ? 1 : k > 0.3 ? 0.65 : 0.35;
      ctx.globalAlpha = alpha;
      switch (p.kind) {
        case 'spark':
          fill(ctx, sx, sy, size, size, col);
          fill(ctx, sx - Math.sign(p.vx || 1) * 2, sy - Math.sign(p.vz || 1) * 2, size, size, col === C.white ? C.amber : C.white);
          break;
        case 'star':
          fill(ctx, sx - 1, sy, 3, 1, col);
          fill(ctx, sx, sy - 1, 1, 3, col);
          fill(ctx, sx, sy, 1, 1, C.white);
          break;
        case 'dust':
          dith(ctx, sx - size, sy - size, size * 2, size * 2, C.ink, col === C.ink ? C.lav : col, 0.5);
          break;
        case 'ring':
          ring(ctx, sx, sy, Math.round((p.size || 8) * (1 - k * 0.9)) + 2, col, 2);
          break;
        case 'shard':
          fill(ctx, sx, sy, size, Math.max(1, size - 1), col);
          fill(ctx, sx, sy, 1, 1, C.white);
          break;
        case 'smoke':
          dith(ctx, sx - size, sy - size, size * 2, size * 2, C.ink, col, 0.4);
          break;
        case 'orb':
          disc(ctx, sx, sy, size, col);
          disc(ctx, sx, sy, Math.max(1, size - 2), C.white);
          break;
        case 'note':
          fill(ctx, sx, sy, 2, 4, col);
          fill(ctx, sx + 2, sy + 3, 2, 1, col);
          break;
        default:
          fill(ctx, sx, sy, size, size, col);
      }
      ctx.globalAlpha = 1;
    }
  }

  /* --- всплывающие цифры --- */
  function drawPopupsWorld(ctx, S, t, cam) {
    var ps = S.popups || [];
    for (var i = 0; i < ps.length; i++) {
      var p = ps[i];
      var k = clamp((p.t || 0) / (p.dur || 0.9), 0, 1);
      var sx = Math.round(p.x - cam.x + cam.sx);
      var sy = Math.round(p.y + cam.sy - (p.z || 0) - k * 20);
      if (sx < -30 || sx > 510) continue;
      var sc = (p.kind === 'combo' || (p.text || '').length > 3) ? 2 : (p.kind === 'heal' ? 1 : 1);
      if (p.kind === 'combo') sc = 2;
      var alpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      var pop = 1;
      if (k < 0.12) pop = 0.6 + k / 0.12 * 0.4;
      if (k < 0.05) ctx.globalAlpha = 0.4;
      evaldrawPopup(ctx, p, sx, sy, sc, alpha * pop);
      ctx.globalAlpha = 1;
    }
  }
  function evaldrawPopup(ctx, p, sx, sy, sc, alpha) {
    if (alpha <= 0) return;
    ctx.globalAlpha = alpha;
    var col = p.color || C.amber;
    var txt = p.text || '';
    var sub = p.sub || '';
    if (p.kind === 'combo') {
      textC(ctx, txt, sx, sy, 2, col, { outline: C.ink, outlineW: 2, shadow: C.wine, shadowDX: 2, shadowDY: 2 });
      if (sub) textC(ctx, sub, sx, sy + 17, 1, C.white, { outline: C.ink, outlineW: 1 });
    } else {
      textC(ctx, txt, sx, sy, sc, col, { outline: C.ink, outlineW: sc >= 2 ? 2 : 1, shadow: C.ink, shadowDX: 1, shadowDY: 1 });
      if (sub) textC(ctx, sub, sx, sy + (fh() * sc) + 1, 1, C.white, { outline: C.ink, outlineW: 1 });
    }
    ctx.globalAlpha = 1;
  }

  /* --- барьер арены / полицейская лента --- */
  function drawGate(ctx, S, t, cam) {
    var g = S.run && S.run.gate;
    if (!g || !g.active) return;
    var sides = [g.left, g.right];
    for (var i = 0; i < 2; i++) {
      var wx = sides[i];
      if (wx == null) continue;
      var x = Math.round(wx - cam.x + cam.sx);
      if (x < -20 || x > 500) continue;
      var top = 158, bot = 258;
      /* столбы */
      fill(ctx, x - 2, top - 6, 5, bot - top + 6, C.ink);
      fill(ctx, x - 1, top - 6, 3, bot - top + 6, C.deep);
      fill(ctx, x - 2, top - 8, 5, 3, C.amber);
      /* энергетическая сетка */
      for (var yy = top; yy < bot; yy += 6) {
        var ph = Math.sin(t * 8 + yy * 0.2) > 0;
        fill(ctx, x - 1, yy, 3, 3, ph ? C.magenta : C.wine);
        fill(ctx, x, yy + 1, 1, 1, C.white);
      }
      /* искры */
      for (var k = 0; k < 3; k++) {
        var sy2 = top + ((t * 90 + k * 57) % (bot - top));
        fill(ctx, x + (k % 2 ? 2 : -3), sy2, 1, 3, C.cyan);
      }
      neonGlow(ctx, x - 2, top, 5, bot - top, C.magenta, 3, 0.3);
      /* предупреждающая лента на полу */
      for (var s = -8; s < 9; s += 3) {
        fill(ctx, x + s, 253, 3, 2, s % 2 ? C.amber : C.ink);
      }
    }
  }

  /* --- дальний план в зависимости от зоны --- */
  function drawZoneBg(ctx, S, t) {
    var run = S.run || {};
    var zones = S.zones || [];
    var z = zones[run.zone || 0];
    var id = z && z.id ? z.id : ['street', 'arcade', 'roof'][clamp(run.zone || 0, 0, 2)];
    if (!S.player) id = 'street';
    else {
      var px = S.player.x;
      if (px >= 1400) id = 'roof';
      else if (px >= 760) id = 'arcade';
      else id = 'street';
    }
    if (id === 'arcade') drawArcadeBg(ctx, S, t);
    else if (id === 'roof') drawRoofBg(ctx, S, t);
    else drawStreetBg(ctx, S, t);
  }

  /* ============================================================
     HUD
     ============================================================ */

  function drawHeart(ctx, x, y, color, dark) {
    if (dark) {
      text(ctx, '♥', x, y, 1, C.shadow, null);
    } else {
      text(ctx, '♥', x, y, 1, color, { outline: C.ink, outlineW: 1 });
    }
  }

  function drawHUD(ctx, S, t) {
    var run = S.run || {};
    var p = S.player;
    var i;
    /* затемнение верхней полосы */
    ctx.globalAlpha = 0.5;
    fill(ctx, 0, 0, 480, 50, C.ink);
    ctx.globalAlpha = 1;
    dith(ctx, 0, 50, 480, 5, C.ink, C.bg, 0.5);

    /* --- игрок --- */
    if (p) {
      var hpK = clamp(p.hp / (p.maxHp || 1), 0, 1);
      var hpCol = hpK > 0.5 ? C.lime : hpK > 0.25 ? C.amber : C.magenta;
      /* имя */
      text(ctx, T('char.' + (p.char || 'comet') + '.name'), 12, 1, 1, C.cyan, { outline: C.ink, outlineW: 1 });
      fill(ctx, 12, 9, 154, 12, C.ink);
      text(ctx, '♥', 14, 11, 1, hpK > 0.25 ? C.magenta : (Math.sin(t * 10) > 0 ? C.white : C.wine), null);
      drawBar(ctx, 23, 10, 140, 10, hpK, { bg: C.wine, fg: hpCol, seg: 10, hi: C.white, lo: C.ink, frame: C.shadow });
      /* hp цифры */
      textR(ctx, String(Math.max(0, Math.ceil(p.hp))), 176, 1, 1, C.lav, { outline: C.ink, outlineW: 1 });
      /* ярость */
      var rK = clamp((p.rage || 0) / (p.maxRage || 100), 0, 1);
      var rageCol = p.specialReady ? (Math.sin(t * 10) > 0 ? C.amber : C.lime) : C.cyan;
      drawBar(ctx, 12, 24, 110, 5, rK, { bg: C.deep, fg: rageCol, seg: 0, hi: C.white, frame: C.shadow });
      text(ctx, '★', 125, 23, 1, p.specialReady ? C.lime : C.deep, null);
      text(ctx, T('hud.rage'), 133, 23, 1, p.specialReady ? C.lime : C.lav, null);
      if (p.specialReady && Math.sin(t * 8) > 0) {
        text(ctx, T('hud.specialReady'), 12, 46, 1, C.lime, { outline: C.ink, outlineW: 1 });
      }
      /* жизни */
      var lives = Math.max(0, run.lives | 0);
      for (i = 0; i < 3; i++) {
        drawHeart(ctx, 12 + i * 10, 36, C.magenta, i >= lives);
      }
      if (lives > 3) text(ctx, '×' + lives, 44, 36, 1, C.white, null);
    }

    /* --- очки --- */
    var score = Math.max(0, Math.floor(run.score || 0));
    textR(ctx, T('hud.score'), 468, 1, 1, C.cyan, { outline: C.ink, outlineW: 1 });
    textR(ctx, padScore(score, 6), 468, 9, 2, C.white, { outline: C.ink, outlineW: 2, shadow: C.wine, shadowDX: 1, shadowDY: 1 });
    var best = Math.max(run.best || 0, S_().best || 0);
    textR(ctx, T('hud.best') + ' ' + padScore(best, 6), 468, 24, 1, C.lav, { outline: C.ink, outlineW: 1 });

    /* --- волна по центру --- */
    var waveNo = Math.min((run.wave || 0) + 1, run.waveCount || 5);
    var waveStr = T('hud.wave') + ' ' + waveNo + '/' + (run.waveCount || 5);
    textC(ctx, waveStr, 240, 1, 1, C.amber, { outline: C.ink, outlineW: 1 });
    var zones = S.zones || [];
    var z = zones[run.zone || 0];
    if (z && z.nameKey) {
      textC(ctx, T(z.nameKey), 240, 11, 1, C.lav, { outline: C.ink, outlineW: 1 });
    }

    /* --- комбо --- */
    if ((run.combo || 0) >= 2) {
      var comboT = clamp((run.comboT || 0) / 2.1, 0, 1);
      var cCol = comboT < 0.3 ? C.wine : C.amber;
      var pop = 1;
      if (run.comboT > 2.0) pop = 1.4;
      textR(ctx, '×' + run.combo, 468, 33, 2, cCol, { outline: C.ink, outlineW: 2, shadow: C.ink, shadowDX: 2, shadowDY: 2 });
      textR(ctx, T('hud.combo'), 468, 49, 1, C.lav, { outline: C.ink, outlineW: 1 });
    }

    /* --- босс --- */
    var boss = S.boss;
    if (boss && !boss.dead) {
      var bk = clamp(boss.hp / (boss.maxHp || 1), 0, 1);
      var bCol = boss.phase2 ? C.orange : C.magenta;
      textC(ctx, T('hud.boss'), 240, 33, 1, bCol, { outline: C.ink, outlineW: 1 });
      fill(ctx, 110, 41, 260, 14, C.ink);
      drawBar(ctx, 114, 44, 252, 8, bk, { bg: C.shadow, fg: bCol, seg: 18, hi: C.white, lo: C.wine, frame: C.deep });
      /* метка 50% */
      fill(ctx, 240, 42, 1, 12, C.ink);
      /* значок босса: процессорный чип */
      fill(ctx, 96, 40, 9, 7, C.ink);
      fill(ctx, 97, 41, 7, 5, C.lav);
      fill(ctx, 99, 42, 3, 3, bCol);
      for (var pin = 0; pin < 3; pin++) {
        fill(ctx, 97 + pin * 3, 38, 1, 2, C.lav);
        fill(ctx, 97 + pin * 3, 47, 1, 2, C.lav);
      }
    }
  }

  /* ============================================================
     БАННЕРЫ / БОСС-ИНТРО / ОВЕРЛЕИ
     ============================================================ */

  function bannerTitle(b) {
    if (!b) return '';
    if (b.titleKey) return T(b.titleKey, b.vars);
    return '';
  }
  function bannerSub(b) {
    if (!b || !b.subKey) return '';
    return T(b.subKey, b.vars);
  }

  function drawBanner(ctx, S, t) {
    var b = S.run && S.run.banner;
    if (!b) return;
    var dur = b.dur || 2.2;
    var k = clamp((b.t || 0) / dur, 0, 1);
    var inK = clamp((b.t || 0) / 0.24, 0, 1);
    var outK = clamp((dur - (b.t || 0)) / 0.3, 0, 1);
    var vis = Math.min(inK, outK);
    if (vis <= 0.01) return;
    var isBoss = b.kind === 'boss';
    var isClear = b.kind === 'clear';
    var isZone = b.kind === 'zone';
    var isFinal = b.kind === 'final';
    var accent = isBoss ? C.magenta : isClear ? C.lime : isZone ? C.cyan : isFinal ? C.orange : C.amber;
    var title = bannerTitle(b);
    var sub = bannerSub(b);
    if (!title && b.kind === 'boss') title = T('banner.boss');
    var cy = isBoss ? 118 : (isZone ? 96 : 104);
    var titleSc = 3;
    if (textW(title, 3) > 430) titleSc = 2;
    if (isBoss) titleSc = 3;
    var bandH = sub ? 52 : 40;
    var slide = (1 - easeOut(inK)) * -260;
    var outShift = (1 - outK) * 280;

    ctx.globalAlpha = 0.82 * vis;
    fill(ctx, 0, cy - bandH / 2, 480, bandH, C.ink);
    ctx.globalAlpha = 1;
    /* косые полосы-рамки */
    for (var i = 0; i < 2; i++) {
      var yy = i === 0 ? cy - bandH / 2 : cy + bandH / 2 - 2;
      for (var x = -10; x < 490; x += 16) {
        fill(ctx, x + ((Math.floor(t * 30) % 16)), yy, 9, 2, accent);
        fill(ctx, x + 8 + ((Math.floor(t * 30) % 16)), yy, 4, 2, C.ink);
      }
    }
    var tx = slide + outShift;
    /* заголовок */
    if (isClear) {
      ctx.globalAlpha = vis;
      textC(ctx, '★', 240 + tx - textW(title, titleSc) / 2 - 16, cy - 12, 2, C.amber, null);
      textC(ctx, '★', 240 + tx + textW(title, titleSc) / 2 + 4, cy - 12, 2, C.amber, null);
      ctx.globalAlpha = 1;
    }
    textC(ctx, title, 240 + tx, cy - (sub ? 18 : 8), titleSc, accent, {
      outline: C.ink, outlineW: 3, shadow: C.ink, shadowDX: 2, shadowDY: 2, alpha: vis
    });
    if (sub) {
      textC(ctx, sub, 240 + tx * 1.1, cy + 8, 1, C.white, { outline: C.ink, outlineW: 1, alpha: vis });
    }
    /* вспышка на входе */
    if (k < 0.1) {
      ctx.globalAlpha = 0.35 * (1 - k / 0.1);
      fill(ctx, 0, cy - bandH / 2, 480, bandH, C.white);
      ctx.globalAlpha = 1;
    }
    /* мелкие искры по краям */
    for (var s = 0; s < 6; s++) {
      var sx = 40 + rnd(s, 9) * 400;
      var sy = cy - bandH / 2 - 4 + rnd(s, 8) * (bandH + 8);
      if (Math.sin(t * 9 + s) > 0.4) fill(ctx, sx, sy, 2, 1, accent);
    }
  }

  function drawBossIntro(ctx, S, t) {
    var run = S.run || {};
    var bi = run.bossIntro || 0;
    if (bi <= 0) return;
    var total = 2.9;
    var k = clamp(1 - bi / total, 0, 1);
    var bars = Math.round(26 * easeOut(clamp(k * 1.6, 0, 1)));
    /* затемнение */
    ctx.globalAlpha = 0.55 * clamp(k * 2, 0, 1);
    fill(ctx, 0, 0, 480, 270, C.ink);
    ctx.globalAlpha = 1;
    /* молнии за спиной */
    if (Math.sin(t * 20) > 0.2) {
      for (var i = 0; i < 4; i++) {
        var lx = 150 + i * 55 + Math.sin(t * 30 + i) * 10;
        for (var yy = 40; yy < 190; yy += 6) {
          fill(ctx, lx + Math.sin(yy * 0.3 + t * 10 + i) * 4, yy, 2, 4, i % 2 ? C.magenta : C.purple);
        }
      }
    }
    /* силуэт босса поднимается */
    var boss = S.boss;
    if (boss) {
      var cam = camOf(S);
      var rise = (1 - easeOut(clamp((k - 0.15) / 0.5, 0, 1))) * 60;
      var bx = Math.round(boss.x - cam.x + cam.sx);
      var by = Math.round(boss.y + cam.sy + rise);
      ctx.globalAlpha = 0.85;
      shadowEllipse(ctx, bx, Math.round(boss.y + cam.sy), 36, 6, C.ink);
      ctx.globalAlpha = 1;
      ctx.save();
      ctx.translate(bx, by);
      if (boss.facing < 0) ctx.scale(-1, 1);
      var p2 = makePose(boss, cfgFor(boss), t);
      p2.prone = false;
      ctx.globalAlpha = clamp((k - 0.1) / 0.25, 0, 1);
      drawKhromLocal(ctx, boss, cfgFor(boss), p2, t);
      ctx.restore();
    }
    /* letterbox */
    fill(ctx, 0, 0, 480, bars, C.ink);
    fill(ctx, 0, 270 - bars, 480, bars, C.ink);
    fill(ctx, 0, bars, 480, 1, C.magenta);
    fill(ctx, 0, 269 - bars, 480, 1, C.magenta);
    /* имя */
    var name = T('boss.name');
    var sub = T('boss.sub');
    var taunt = T(k < 0.55 ? 'boss.taunt1' : 'boss.taunt2');
    var nameIn = clamp((k - 0.2) / 0.25, 0, 1);
    var nx = (1 - easeOut(nameIn)) * -200;
    if (nameIn > 0) {
      textC(ctx, name, 240 + nx, 176, 3, C.white, {
        outline: C.ink, outlineW: 3, shadow: C.magenta, shadowDX: 2, shadowDY: 2, alpha: nameIn
      });
      textC(ctx, sub, 240 - nx * 0.6, 200, 1, C.amber, { outline: C.ink, outlineW: 1, alpha: nameIn });
      if (k > 0.45) {
        textC(ctx, taunt, 240, 218, 1, C.lav, {
          outline: C.ink, outlineW: 1, alpha: clamp((k - 0.45) / 0.2, 0, 1)
        });
      }
    }
    /* вспышка-глитч */
    if (k > 0.05 && k < 0.12) {
      ctx.globalAlpha = 0.3;
      fill(ctx, 0, 100, 480, 8, C.white);
      ctx.globalAlpha = 1;
    }
  }

  function drawAdvanceHint(ctx, S, t) {
    var run = S.run || {};
    if (!run.advance || run.banner) return;
    if (Math.sin(t * 5) < -0.2) return;
    var label = T('banner.advance');
    var w = textW(label, 2);
    fill(ctx, 240 - w / 2 - 14, 118, w + 28, 24, C.ink);
    dith(ctx, 240 - w / 2 - 14, 118, w + 28, 24, C.ink, C.amber, 0.25);
    rectB(ctx, 240 - w / 2 - 14, 118, w + 28, 24, C.amber);
    textC(ctx, label, 240, 124, 2, C.white, { outline: C.ink, outlineW: 2, shadow: C.amber, shadowDX: 2, shadowDY: 1 });
    text(ctx, '►', 240 + w / 2 + 2, 125, 1, C.amber, null);
  }

  function drawFlashOverlay(ctx, S) {
    var f = (S.run && S.run.flash) || 0;
    if (f <= 0) return;
    ctx.globalAlpha = clamp(f * 1.6, 0, 0.62);
    fill(ctx, 0, 0, 480, 270, C.white);
    ctx.globalAlpha = 1;
  }

  /* --- пауза --- */
  function drawPauseOverlay(ctx, S, t) {
    /* лёгкое затемнение — сцена боя остаётся видимой */
    ctx.globalAlpha = 0.44;
    fill(ctx, 0, 0, 480, 270, C.ink);
    ctx.globalAlpha = 1;
    /* виньетка по краям */
    dith(ctx, 0, 0, 480, 40, C.ink, C.bg, 0.4);
    dith(ctx, 0, 230, 480, 40, C.ink, C.bg, 0.5);
    dith(ctx, 0, 0, 60, 270, C.ink, C.bg, 0.3);
    dith(ctx, 420, 0, 60, 270, C.ink, C.bg, 0.3);
    /* «замороженные» полосы */
    for (var fy = 70; fy < 260; fy += 46) {
      ctx.globalAlpha = 0.12;
      fill(ctx, 0, fy, 480, 2, C.cyan);
      fill(ctx, 0, fy + 2, 480, 1, C.magenta);
      ctx.globalAlpha = 1;
    }
    /* панель */
    panel(ctx, 146, 78, 188, 148, { bg: C.ink, light: C.deep, dark: C.ink, border: C.magenta });
    dith(ctx, 149, 81, 182, 142, C.ink, C.bg, 0.35);
    brackets(ctx, 152, 84, 176, 136, C.amber, 5);
    textC(ctx, T('pause.title'), 240, 88, 3, C.white, {
      outline: C.ink, outlineW: 3, shadow: C.magenta, shadowDX: 2, shadowDY: 2
    });
    dith(ctx, 170, 116, 140, 2, C.ink, C.magenta, 0.5);
    drawMenuList(ctx, S, t, 'pause',
      ['menu.resume', 'menu.settings', 'menu.restart', 'menu.mainmenu'], null,
      S.pauseIndex || 0, { scale: 1, accent: C.cyan });
    textC(ctx, T('pause.hint'), 240, 196, 1, C.lav, { outline: C.ink, outlineW: 1 });
    drawQuickChips(ctx, S, t);
  }

  /* --- смерть --- */
  function drawDeadOverlay(ctx, S, t) {
    ctx.globalAlpha = 0.5;
    fill(ctx, 0, 0, 480, 270, C.ink);
    ctx.globalAlpha = 1;
    dith(ctx, 0, 80, 480, 110, C.ink, C.wine, 0.25);
    var title = T('banner.defeat');
    textC(ctx, title, 240, 100, 3, C.magenta, {
      outline: C.ink, outlineW: 3, shadow: C.ink, shadowDX: 3, shadowDY: 3
    });
    var lives = (S.run && S.run.lives) || 0;
    if (lives > 0) {
      textC(ctx, '♥ × ' + lives, 240, 140, 1, C.lav, { outline: C.ink, outlineW: 1 });
    }
  }

  /* --- сам бой --- */
  function screenPlay(ctx, S, t, mode) {
    var cam = camOf(S);
    drawZoneBg(ctx, S, t);
    drawGate(ctx, S, t, cam);

    /* сбор объектов с сортировкой по глубине y */
    var drawables = [];
    var i;
    var props = S.props || [];
    for (i = 0; i < props.length; i++) drawables.push({ y: props[i].y, kind: 'prop', ref: props[i] });
    var picks = S.pickups || [];
    for (i = 0; i < picks.length; i++) drawables.push({ y: picks[i].y, kind: 'pickup', ref: picks[i] });
    var enemies = S.enemies || [];
    for (i = 0; i < enemies.length; i++) drawables.push({ y: enemies[i].y, kind: 'actor', ref: enemies[i] });
    if (S.player) drawables.push({ y: S.player.y, kind: 'actor', ref: S.player });
    drawables.sort(function (a, b) { return a.y - b.y; });

    /* единая сортировка по глубине: актёры + пропы + пикапы */
    for (i = 0; i < drawables.length; i++) {
      var d = drawables[i];
      if (d.kind === 'actor') drawFighter(ctx, d.ref, S, t, null);
      else if (d.kind === 'prop') drawPropOne(ctx, d.ref, S, t, cam);
      else if (d.kind === 'pickup') drawPickupOne(ctx, d.ref, S, t, cam);
    }

    drawProjectilesWorld(ctx, S, t, cam);
    drawParticlesWorld(ctx, S, t, cam);
    drawPopupsWorld(ctx, S, t, cam);

    if (!(S.run && S.run.bossIntro > 1.1)) drawHUD(ctx, S, t);
    drawBanner(ctx, S, t);
    drawAdvanceHint(ctx, S, t);
    if (S.run && S.run.bossIntro > 0) drawBossIntro(ctx, S, t);
    drawFlashOverlay(ctx, S);

    if (mode === 1) drawPauseOverlay(ctx, S, t);
    else if (mode === 2) drawDeadOverlay(ctx, S, t);
  }

  /* ============================================================
     8. ЭКРАНЫ МЕНЮ
     ============================================================ */

  var CHAR_STATS = {
    comet: { power: 3, speed: 5, armor: 3, range: 4 },
    hammer: { power: 5, speed: 3, armor: 5, range: 3 }
  };
  var STAT_KEYS = ['stat.power', 'stat.speed', 'stat.armor', 'stat.range'];

  function formatTime(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    var m = Math.floor(sec / 60), s2 = sec % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s2 < 10 ? '0' : '') + s2;
  }

  function backButton(ctx, S, label, t) {
    var r = rect1(S, 'back');
    if (!r) return;
    var x = Math.round(r.x), y = Math.round(r.y), w = Math.round(r.w), h = Math.round(r.h);
    fill(ctx, x, y, w, h, C.ink);
    rectB(ctx, x, y, w, h, C.deep);
    fill(ctx, x + 1, y + h - 2, w - 2, 1, C.wine);
    textC(ctx, label, x + w / 2, y + Math.round((h - fh()) / 2), 1, C.lav, null);
    text(ctx, '◄', x + 4, y + Math.round((h - fh()) / 2), 1, C.amber, null);
  }

  /* ---------- фон versus / меню ---------- */
  function drawVersusBg(ctx, S, t, aCol, bCol) {
    drawNightSky(ctx, t, 250, 120, { moonX: 240, moonY: 54, moonR: 22, glow: C.panel });
    drawSkyline(ctx, 90, t, {
      f: 0.06, tileW: 64, baseY: 262, minH: 46, maxH: 96,
      color: C.shadow, edge: C.panel, win1: C.amber, win2: C.lav,
      winProb: 0.12, seed: 33
    });
    drawSkyline(ctx, 170, t, {
      f: 0.18, tileW: 88, baseY: 264, minH: 70, maxH: 132,
      color: C.panel, edge: C.deep, win1: C.amber, win2: C.cyan,
      winProb: 0.16, seed: 47, signs: ['COMET', 'HAMMER', 'RAGE', 'NEON'], signChance: 0.55
    });
    /* затемнение города + цветные неоновые канты */
    ctx.globalAlpha = 0.3;
    fill(ctx, 0, 0, 480, 250, C.ink);
    ctx.globalAlpha = 1;
    fill(ctx, 2, 0, 2, 246, aCol);
    fill(ctx, 476, 0, 2, 246, bCol);
    fill(ctx, 2, 0, 2, 60, C.white);
    fill(ctx, 476, 0, 2, 60, C.white);
    ctx.globalAlpha = 0.35;
    for (var r = 0; r < 5; r++) {
      fill(ctx, 6, 70 + r * 36, 2, 18, aCol);
      fill(ctx, 472, 70 + r * 36, 2, 18, bCol);
    }
    ctx.globalAlpha = 1;
    drawWires(ctx, 40, t, 40, 6, C.ink);
    drawTitleLedge(ctx, t, 60);
    drawRain(ctx, t, 60, { density: 46, alpha: 0.3 });
    /* верхняя тёмная полоса под заголовок и чипы */
    ctx.globalAlpha = 0.8;
    fill(ctx, 0, 0, 480, 52, C.ink);
    ctx.globalAlpha = 1;
    dith(ctx, 0, 52, 480, 3, C.ink, C.bg, 0.4);
  }

  /* ---------- карточка бойца ---------- */
  function drawCharCard(ctx, S, t, rect, index, selected, opts) {
    if (!rect) return;
    var x = Math.round(rect.x), y = Math.round(rect.y);
    var w = Math.round(rect.w), h = Math.round(rect.h);
    var isHammer = index === 1;
    var chId = isHammer ? 'hammer' : 'comet';
    var cfg = FIG[chId];
    var accent = isHammer ? C.orange : C.cyan;
    var alt = isHammer ? C.amber : C.magenta;
    var name = T('char.' + chId + '.name');
    var alias = T('char.' + chId + '.alias');
    var desc = T('char.' + chId + '.desc');
    var spec = T('char.' + chId + '.spec');
    var stats = CHAR_STATS[chId];
    var facing = isHammer ? -1 : 1;
    var hov = Math.sin(t * 3 + index * 2) * 1;

    if (selected) {
      dith(ctx, x - 5, y - 5, w + 10, h + 10, C.ink, accent, 0.3);
      panel(ctx, x, y, w, h, { bg: C.panel, light: C.purple, dark: C.ink, border: accent });
      brackets(ctx, x - 3, y - 3, w + 6, h + 6, C.amber, 5);
      fill(ctx, x + w - 20, y + 5, 14, 11, accent);
      textC(ctx, '✓', x + w - 13, y + 6, 1, C.ink, null);
    } else {
      panel(ctx, x, y, w, h, { bg: C.ink, light: C.deep, dark: C.ink, border: C.deep });
      dith(ctx, x + 1, y + 1, w - 2, h - 2, C.ink, C.deep, 0.2);
      brackets(ctx, x, y, w, h, C.deep, 3);
    }

    /* портрет */
    var pad = 5;
    var pX = x + pad, pY = y + pad, pW = w - pad * 2, pH = 57;
    fill(ctx, pX, pY, pW, pH, C.ink);
    dith(ctx, pX, pY, pW, pH, C.ink, accent, selected ? 0.05 : 0.02);
    /* световой конус */
    for (var sc2 = 0; sc2 < 5; sc2++) {
      var cw2 = 10 + sc2 * 9;
      dith(ctx, pX + pW / 2 - cw2 / 2, pY + sc2 * 4, cw2, 4, C.ink, accent, 0.1);
    }
    /* эмблема-круг */
    ring(ctx, pX + pW / 2, pY + pH - 17, 26, selected ? accent : C.deep, 2);
    ring(ctx, pX + pW / 2, pY + pH - 17, 20, C.ink, 1);
    fill(ctx, pX + pW / 2 - 1, pY + pH - 42, 3, 3, selected ? alt : C.deep);
    /* пол под ногами */
    fill(ctx, pX + 8, pY + pH - 5, pW - 16, 3, C.deep);
    fill(ctx, pX + 6, pY + pH - 3, pW - 12, 1, C.ink);
    drawFighter(ctx, {
      kind: 'player', char: chId, x: pX + pW / 2, y: pY + pH - 3 + hov,
      z: 0, facing: facing, state: 'idle', anim: 'idle', animT: t + index * 0.7,
      hp: 100, maxHp: 100, scale: 1, flash: 0, alpha: 1
    }, null, t, null);

    /* имя */
    textC(ctx, name, x + w / 2, y + 62, 2, selected ? C.white : C.lav, {
      outline: C.ink, outlineW: 2, shadow: selected ? alt : C.ink, shadowDX: 2, shadowDY: 2
    });
    textC(ctx, alias, x + w / 2, y + 80, 1, selected ? accent : C.lav, {
      outline: C.ink, outlineW: 1
    });
    /* описание (до 3 строк) */
    textWrapC(ctx, desc, x + w / 2, y + 90, w - 14, 1, selected ? C.white : C.lav, 9, {
      outline: C.ink, outlineW: 1
    });
    /* статы 2×2 */
    var sx0 = x + 9, sy0 = y + 117;
    for (var i = 0; i < 4; i++) {
      var col = i % 2, row = Math.floor(i / 2);
      var cx = sx0 + col * 92;
      var cy = sy0 + row * 9;
      text(ctx, T(STAT_KEYS[i]), cx, cy, 1, selected ? C.lav : C.purple, null);
      var val = stats[i === 0 ? 'power' : i === 1 ? 'speed' : i === 2 ? 'armor' : 'range'];
      for (var b = 0; b < 5; b++) {
        fill(ctx, cx + 52 + b * 7, cy + 1, 5, 4, b < val ? (selected ? accent : C.deep) : C.ink);
      }
      rectB(ctx, cx + 51, cy, 36, 6, C.deep);
    }
    /* спецприём */
    text(ctx, spec, x + 9, y + 136, 1, selected ? C.amber : C.deep, { outline: C.ink, outlineW: 1 });
    if (!selected) {
      ctx.globalAlpha = 0.3;
      fill(ctx, x, y, w, h, C.ink);
      ctx.globalAlpha = 1;
    }
  }

  function screenSelect(ctx, S, t) {
    var sel = S.select || { char: 0, diff: 1 };
    drawVersusBg(ctx, S, t, C.cyan, C.lime);
    drawQuickChips(ctx, S, t);

    textC(ctx, T('select.title'), 240, 26, 2, C.white, {
      outline: C.ink, outlineW: 2, shadow: C.magenta, shadowDX: 2, shadowDY: 2
    });
    textC(ctx, T('select.subtitle'), 240, 44, 1, C.cyan, { outline: C.ink, outlineW: 1 });

    var cards = rects(S, 'chars');
    for (var i = 0; i < cards.length; i++) {
      drawCharCard(ctx, S, t, cards[i], i, i === sel.char, null);
    }
    /* разделитель-молния */
    for (var z = 0; z < 13; z++) {
      var zy = 56 + z * 11;
      var pxz = 240 + (z % 2 ? 2 : -2);
      fill(ctx, pxz - 1, zy, 2, 7, z % 2 ? C.amber : C.wine);
    }
    for (var nd = 0; nd < 3; nd++) {
      var ny = 76 + nd * 38;
      fill(ctx, 238, ny, 5, 5, C.amber);
      fill(ctx, 239, ny + 1, 3, 3, C.ink);
      fill(ctx, 240, ny + 2, 1, 1, C.amber);
    }

    /* сложность */
    fill(ctx, 180, 201, 120, 11, C.ink);
    dith(ctx, 180, 201, 120, 11, C.ink, C.bg, 0.4);
    textC(ctx, T('select.difficulty'), 240, 203, 1, C.lav, { outline: C.ink, outlineW: 1 });
    var ds = rects(S, 'diffs');
    var diffKeys = ['diff.easy', 'diff.normal', 'diff.hard'];
    var diffCols = [C.lime, C.amber, C.magenta];
    for (var d = 0; d < ds.length; d++) {
      var r = ds[d];
      if (!r) continue;
      var dx = Math.round(r.x), dy = Math.round(r.y), dw = Math.round(r.w), dh = Math.round(r.h);
      var on = d === sel.diff;
      if (on) {
        fill(ctx, dx, dy, dw, dh, diffCols[d]);
        rectB(ctx, dx, dy, dw, dh, C.white);
        textC(ctx, T(diffKeys[d]), dx + dw / 2, dy + 3, 1, C.ink, null);
      } else {
        fill(ctx, dx, dy, dw, dh, C.ink);
        rectB(ctx, dx, dy, dw, dh, C.deep);
        textC(ctx, T(diffKeys[d]), dx + dw / 2, dy + 3, 1, C.lav, null);
      }
    }

    /* кнопка старта */
    var st = rect1(S, 'selectStart');
    if (st) {
      var bx = Math.round(st.x), by = Math.round(st.y), bw = Math.round(st.w), bh = Math.round(st.h);
      var pulse = Math.sin(t * 5) > -0.2;
      dith(ctx, bx - 4, by - 4, bw + 8, bh + 8, C.ink, C.magenta, 0.22);
      panel(ctx, bx, by, bw, bh, { bg: pulse ? C.wine : C.panel, light: C.magenta, dark: C.ink, border: C.amber });
      brackets(ctx, bx - 2, by - 2, bw + 4, bh + 4, C.amber, 3);
      textC(ctx, T('select.start'), bx + bw / 2, by + Math.round((bh - fh()) / 2), 1, C.white, {
        outline: C.ink, outlineW: 1
      });
    }
    textC(ctx, T('select.hint'), 240, 260, 1, C.purple, { outline: C.ink, outlineW: 1 });
  }

  /* ---------- intro ---------- */
  function drawChipArt(ctx, x, y, t) {
    /* чип NEON-8 */
    var w = 88, h = 62;
    x = Math.round(x); y = Math.round(y);
    glowFrame(ctx, x - 3, y - 3, w + 6, h + 6, C.cyan, 0.3);
    fill(ctx, x - 8, y - 8, w + 16, h + 16, C.ink);
    dith(ctx, x - 8, y - 8, w + 16, h + 16, C.ink, C.deep, 0.18);
    fill(ctx, x, y, w, h, C.ink);
    fill(ctx, x + 2, y + 2, w - 4, h - 4, C.panel);
    fill(ctx, x + 2, y + 2, w - 4, 2, C.deep);
    fill(ctx, x + 2, y + h - 4, w - 4, 2, C.ink);
    /* ножки */
    for (var i = 0; i < 7; i++) {
      var lx = x + 8 + i * 11;
      fill(ctx, lx, y - 5, 3, 6, C.lav);
      fill(ctx, lx, y - 4, 3, 2, C.amber);
      fill(ctx, lx, y + h - 1, 3, 6, C.lav);
      fill(ctx, lx, y + h + 1, 3, 2, C.amber);
    }
    /* ядро */
    fill(ctx, x + 12, y + 14, w - 24, h - 30, C.ink);
    fill(ctx, x + 14, y + 16, w - 28, h - 34, C.deep);
    textC(ctx, 'NEON-8', x + w / 2, y + h / 2 - 9, 1, C.cyan, { outline: C.ink, outlineW: 1 });
    /* дорожки */
    for (var k = 0; k < 5; k++) {
      fill(ctx, x + 8 + k * 15, y + 26, 2, 6, C.cyan);
      fill(ctx, x + 8 + k * 15, y + 32, 8, 1, C.cyan);
    }
    /* пульс */
    var pulse = Math.sin(t * 3) > 0 ? C.cyan : C.amber;
    ring(ctx, x + w / 2, y + h / 2, 22 + Math.sin(t * 3) * 3, pulse, 1);
    /* провода */
    fill(ctx, x - 12, y + 24, 12, 2, C.magenta);
    fill(ctx, x + w, y + 34, 16, 2, C.lime);
    fill(ctx, x + w + 8, y + 28, 2, 8, C.lime);
  }

  function screenIntro(ctx, S, t) {
    /* фон: ночной город, дождь, панель */
    drawNightSky(ctx, t, 270, 210, { moonX: 88, moonY: 62, moonR: 20, glow: C.panel });
    drawSkyline(ctx, 200, t, {
      f: 0.1, tileW: 60, baseY: 244, minH: 60, maxH: 140,
      color: C.panel, edge: C.deep, win1: C.amber, win2: C.cyan,
      winProb: 0.2, seed: 91, signs: ['TOXIC', 'NEON-8', '24/7'], signChance: 0.4
    });
    dith(ctx, 0, 0, 480, 270, C.ink, C.bg, 0.35);
    drawRain(ctx, t, 210, { density: 62, alpha: 0.4 });

    /* панель-карточка */
    panel(ctx, 28, 26, 424, 218, { bg: C.ink, light: C.deep, dark: C.ink, border: C.magenta });
    dith(ctx, 31, 29, 418, 212, C.ink, C.bg, 0.4);
    brackets(ctx, 34, 32, 412, 206, C.amber, 6);
    /* заголовок */
    textC(ctx, T('intro.chapter'), 240, 38, 1, C.amber, { outline: C.ink, outlineW: 1 });
    var title = T('intro.title');
    var tsc = textW(title, 4) > 420 ? 3 : 4;
    textC(ctx, title, 240, 50, tsc, C.white, {
      outline: C.ink, outlineW: 3, shadow: C.magenta, shadowDX: 3, shadowDY: 3
    });
    dith(ctx, 90, 86, 300, 2, C.ink, C.magenta, 0.6);
    /* арт слева: чип над городом */
    drawChipArt(ctx, 96, 126, t);
    /* герои-силуэты у нижней кромки арта */
    drawFighter(ctx, {
      kind: 'player', char: 'comet', x: 78, y: 216, z: 0, facing: 1,
      state: 'idle', anim: 'idle', animT: t, hp: 1, maxHp: 1, scale: 0.8, flash: 0, alpha: 1
    }, null, t, null);
    drawFighter(ctx, {
      kind: 'player', char: 'hammer', x: 206, y: 218, z: 0, facing: 1,
      state: 'idle', anim: 'idle', animT: t + 1, hp: 1, maxHp: 1, scale: 0.8, flash: 0, alpha: 1
    }, null, t, null);
    /* текст справа */
    var tx = 226, ty = 110, mw = 202;
    var p1 = T('intro.text1'), p2 = T('intro.text2'), p3 = T('intro.text3');
    var h1 = textWrap(ctx, p1, tx, ty, mw, 1, C.white, 10, { outline: C.ink, outlineW: 1 });
    var h2 = textWrap(ctx, p2, tx, ty + h1 + 4, mw, 1, C.lav, 10, { outline: C.ink, outlineW: 1 });
    textWrap(ctx, p3, tx, ty + h1 + h2 + 8, mw, 1, C.cyan, 10, { outline: C.ink, outlineW: 1 });
    /* подсказки */
    if (blink(t, 2.4)) {
      textC(ctx, T('intro.start'), 240, 228, 2, C.amber, {
        outline: C.ink, outlineW: 2, shadow: C.wine, shadowDX: 1, shadowDY: 2
      });
    }
    textC(ctx, T('intro.skip'), 240, 250, 1, C.purple, { outline: C.ink, outlineW: 1 });
    /* мелкие искры по краям */
    for (var s = 0; s < 8; s++) {
      if (Math.sin(t * 4 + s * 1.7) > 0.5) {
        fill(ctx, 60 + rnd(s, 5) * 360, 36 + rnd(s, 6) * 200, 2, 1, s % 2 ? C.cyan : C.magenta);
      }
    }
  }

  /* ---------- help ---------- */
  function drawKeyRow(ctx, x, y, w, labelKey, keysKey, t) {
    text(ctx, T(labelKey), x, y, 1, C.lime, { outline: C.ink, outlineW: 1 });
    textR(ctx, T(keysKey), x + w, y, 1, C.white, { outline: C.ink, outlineW: 1 });
    dith(ctx, x, y + 12, w, 1, C.ink, C.deep, 0.5);
  }

  function helpBox(ctx, x, y, w, h, titleKey, textKey, accent) {
    fill(ctx, x, y, w, h, C.ink);
    rectB(ctx, x, y, w, h, C.deep);
    fill(ctx, x + 1, y + 1, 3, h - 2, accent);
    text(ctx, T(titleKey), x + 8, y + 4, 1, accent, { outline: C.ink, outlineW: 1 });
    textWrap(ctx, T(textKey), x + 8, y + 15, w - 14, 1, C.lav, 9, { outline: C.ink, outlineW: 1 });
  }

  function screenHelp(ctx, S, t) {
    drawVersusBg(ctx, S, t, C.magenta, C.cyan);
    ctx.globalAlpha = 0.35;
    fill(ctx, 0, 0, 480, 270, C.ink);
    ctx.globalAlpha = 1;
    drawQuickChips(ctx, S, t);
    textC(ctx, T('help.title'), 240, 22, 2, C.white, {
      outline: C.ink, outlineW: 2, shadow: C.magenta, shadowDX: 2, shadowDY: 2
    });
    /* левая колонка управления */
    var rows = [
      ['help.move', 'help.moveKeys'], ['help.jump', 'help.jumpKeys'],
      ['help.punch', 'help.punchKeys'], ['help.kick', 'help.kickKeys'],
      ['help.special', 'help.specialKeys'], ['help.pause', 'help.pauseKeys']
    ];
    var y = 56;
    for (var i = 0; i < rows.length; i++) {
      drawKeyRow(ctx, 40, y + i * 22, 194, rows[i][0], rows[i][1], t);
    }
    /* быстрые клавиши */
    fill(ctx, 40, 192, 194, 38, C.ink);
    rectB(ctx, 40, 192, 194, 38, C.deep);
    fill(ctx, 41, 193, 3, 36, C.amber);
    text(ctx, T('help.quick'), 48, 196, 1, C.amber, null);
    textWrap(ctx, T('help.quickKeys'), 48, 207, 178, 1, C.white, 9, null);
    /* правая колонка */
    helpBox(ctx, 254, 56, 186, 40, 'help.combo', 'help.comboText', C.magenta);
    helpBox(ctx, 254, 100, 186, 40, 'help.air', 'help.airText', C.cyan);
    helpBox(ctx, 254, 144, 186, 40, 'help.rage', 'help.rageText', C.lime);
    helpBox(ctx, 254, 188, 186, 42, 'help.tipTitle', 'help.tip', C.amber);
    backButton(ctx, S, T('help.back'), t);
    textC(ctx, T('common.hint'), 240, 258, 1, C.purple, null);
  }

  /* ---------- settings ---------- */
  function settingValue(id, S) {
    var st = S_();
    if (id === 'lang') return (st.lang || 'ru') === 'ru' ? 'РУССКИЙ' : 'ENGLISH';
    if (id === 'gfx') return st.gfx === 'modern' ? T('gfx.modern') : T('gfx.retro');
    if (id === 'music') return st.music ? T('common.on') : T('common.off');
    if (id === 'audioStyle') return st.audioStyle === 'synth' ? T('audio.synth') : T('audio.chip');
    if (id === 'sfx') return st.sfx ? T('common.on') : T('common.off');
    if (id === 'volume') return Math.round((st.volume != null ? st.volume : 0.8) * 100) + '%';
    if (id === 'crt') return st.crt ? T('common.on') : T('common.off');
    if (id === 'difficulty') {
      var diff = st.difficulty || 'normal';
      return T('diff.' + diff);
    }
    if (id === 'reset') return '×';
    return '';
  }

  function screenSettings(ctx, S, t) {
    drawVersusBg(ctx, S, t, C.cyan, C.magenta);
    ctx.globalAlpha = 0.55;
    fill(ctx, 0, 0, 480, 270, C.ink);
    ctx.globalAlpha = 1;
    drawQuickChips(ctx, S, t);
    textC(ctx, T('settings.title'), 240, 22, 2, C.white, {
      outline: C.ink, outlineW: 2, shadow: C.magenta, shadowDX: 2, shadowDY: 2
    });
    var rows = rects(S, 'settings');
    var idx = S.settingsIndex || 0;
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (!r) continue;
      var x = Math.round(r.x), y = Math.round(r.y), w = Math.round(r.w), h = Math.round(r.h);
      var on = i === idx;
      var id = r.id || ['lang', 'gfx', 'music', 'audioStyle', 'sfx', 'volume', 'crt', 'difficulty', 'reset'][i];
      var label = T('settings.' + id);
      if (on) {
        dith(ctx, x - 3, y - 1, w + 6, h + 2, C.ink, C.magenta, 0.3);
        panel(ctx, x, y, w, h, { bg: C.panel, light: C.purple, dark: C.ink, border: C.magenta });
        fill(ctx, x + 1, y + 1, 2, h - 2, C.amber);
        text(ctx, '►', x - 10, y + 4, 1, C.amber, null);
        text(ctx, label, x + 10, y + 4, 1, C.white, { outline: C.ink, outlineW: 1 });
      } else {
        fill(ctx, x, y, w, h, C.ink);
        dith(ctx, x, y, w, h, C.ink, C.bg, 0.3);
        fill(ctx, x, y + h - 1, w, 1, C.shadow);
        text(ctx, label, x + 10, y + 4, 1, C.lav, null);
      }
      if (id === 'volume') {
        var v = clamp(S_().volume != null ? S_().volume : 0.8, 0, 1);
        var bx = x + w - 118;
        drawBar(ctx, bx, y + 4, 74, 7, v, { bg: C.ink, fg: on ? C.cyan : C.deep, seg: 8, frame: C.deep });
        textR(ctx, settingValue(id, S), x + w - 8, y + 4, 1, on ? C.amber : C.lav, null);
      } else if (id === 'reset') {
        textR(ctx, '×', x + w - 8, y + 4, 1, on ? C.magenta : C.wine, { outline: C.ink, outlineW: 1 });
      } else {
        var val = settingValue(id, S);
        if (label) textR(ctx, val, x + w - 8, y + 4, 1, on ? C.amber : C.white, { outline: C.ink, outlineW: 1 });
      }
    }
    textC(ctx, T('settings.hint'), 240, 238, 1, C.lav, { outline: C.ink, outlineW: 1 });
    backButton(ctx, S, T('common.back'), t);
  }

  /* ---------- about ---------- */
  function screenAbout(ctx, S, t) {
    drawVersusBg(ctx, S, t, C.magenta, C.lime);
    ctx.globalAlpha = 0.45;
    fill(ctx, 0, 0, 480, 270, C.ink);
    ctx.globalAlpha = 1;
    textC(ctx, T('about.title'), 240, 22, 2, C.white, {
      outline: C.ink, outlineW: 2, shadow: C.cyan, shadowDX: 2, shadowDY: 2
    });
    /* панель */
    panel(ctx, 40, 48, 400, 166, { bg: C.ink, light: C.deep, dark: C.ink, border: C.deep });
    dith(ctx, 43, 51, 394, 160, C.ink, C.bg, 0.4);
    brackets(ctx, 44, 52, 392, 158, C.magenta, 5);
    var y = 62;
    y += textWrap(ctx, T('about.text1'), 60, y, 360, 1, C.white, 11, { outline: C.ink, outlineW: 1 });
    y += 6;
    y += textWrap(ctx, T('about.text2'), 60, y, 360, 1, C.lav, 11, { outline: C.ink, outlineW: 1 });
    y += 6;
    y += textWrap(ctx, T('about.text3'), 60, y, 360, 1, C.cyan, 11, { outline: C.ink, outlineW: 1 });
    /* тех-плашка */
    fill(ctx, 58, 156, 364, 22, C.deep);
    rectB(ctx, 58, 156, 364, 22, C.cyan);
    dith(ctx, 59, 157, 362, 20, C.ink, C.cyan, 0.25);
    textC(ctx, T('about.tech'), 240, 162, 1, C.white, { outline: C.ink, outlineW: 1 });
    textC(ctx, T('about.credits'), 240, 187, 1, C.amber, { outline: C.ink, outlineW: 1 });
    textC(ctx, T('common.hint'), 240, 240, 1, C.purple, { outline: C.ink, outlineW: 1 });
    backButton(ctx, S, T('about.back'), t);
  }

  /* ---------- финальные экраны ---------- */
  function drawGameoverBg(ctx, S, t) {
    drawNightSky(ctx, t, 256, 180, { moonX: 376, moonY: 64, moonR: 30, glow: C.wine });
    drawSkyline(ctx, 200, t, {
      f: 0.08, tileW: 70, baseY: 258, minH: 60, maxH: 150,
      color: C.shadow, edge: C.panel, win1: C.wine, win2: C.lav,
      winProb: 0.1, seed: 111
    });
    drawSkyline(ctx, 130, t, {
      f: 0.24, tileW: 96, baseY: 260, minH: 90, maxH: 180,
      color: C.panel, edge: C.deep, win1: C.amber, win2: C.magenta,
      winProb: 0.14, seed: 121, signs: ['TOXIC', 'GAME OVER', 'RAGE'], signChance: 0.5
    });
    drawTitleLedge(ctx, t, 130);
    drawRain(ctx, t, 200, { density: 110, alpha: 0.55 });
    ctx.globalAlpha = 0.38;
    fill(ctx, 0, 0, 480, 270, C.ink);
    ctx.globalAlpha = 1;
    /* кровавая виньетка по краям */
    dith(ctx, 0, 0, 480, 26, C.ink, C.wine, 0.3);
    dith(ctx, 0, 244, 480, 26, C.ink, C.wine, 0.3);
    dith(ctx, 0, 0, 26, 270, C.ink, C.wine, 0.2);
    dith(ctx, 454, 0, 26, 270, C.ink, C.wine, 0.2);
    /* аварийные блики */
    for (var i = 0; i < 4; i++) {
      if (Math.sin(t * 2.4 + i * 2) > 0.6) {
        fill(ctx, 20 + i * 120, 30 + i * 12, 60, 2, C.wine);
      }
    }
  }

  function drawVictoryBg(ctx, S, t) {
    /* рассветное небо */
    vGrad(ctx, 0, 0, 480, 200, [C.ink, C.bg, C.shadow, C.deep, C.panel], true);
    dith(ctx, 0, 148, 480, 18, C.panel, C.lime, 0.22);
    fill(ctx, 0, 160, 480, 3, C.magenta);
    fill(ctx, 0, 163, 480, 2, C.amber);
    dith(ctx, 0, 165, 480, 10, C.panel, C.cyan, 0.2);
    /* неоновые полосы-рассвет */
    for (var gb = 0; gb < 3; gb++) {
      fill(ctx, 0, 176 + gb * 8, 480, 1, gb % 2 ? C.magenta : C.cyan);
    }
    drawSkyline(ctx, 120, t, {
      f: 0.1, tileW: 74, baseY: 242, minH: 50, maxH: 110,
      color: C.panel, edge: C.deep, win1: C.amber, win2: C.cyan,
      winProb: 0.07, seed: 201, signs: ['CITY', 'FREE', 'NEON-8'], signChance: 0.3
    });
    drawTitleLedge(ctx, t, 120);
    /* герои-победители */
    drawFighter(ctx, {
      kind: 'player', char: 'comet', x: 68, y: 246, z: 0, facing: 1,
      state: 'victory', anim: 'victory', animT: t, hp: 1, maxHp: 1, scale: 1.1,
      flash: 0, alpha: 1
    }, null, t, null);
    drawFighter(ctx, {
      kind: 'player', char: 'hammer', x: 412, y: 248, z: 0, facing: -1,
      state: 'victory', anim: 'victory', animT: t + 1.4, hp: 1, maxHp: 1, scale: 1.1,
      flash: 0, alpha: 1
    }, null, t, null);
    /* конфетти */
    for (var c = 0; c < 44; c++) {
      var cx = norm(rnd(c, 301) * 500 - t * 8 * (0.4 + rnd(c, 302)), 520) - 20;
      var cy = norm(rnd(c, 303) * 300 + t * (26 + rnd(c, 304) * 44), 300);
      var col = [C.lime, C.cyan, C.magenta, C.amber, C.white][c % 5];
      fill(ctx, cx, cy, 2 + (c % 2), 3, col);
      if (c % 3 === 0) fill(ctx, cx + 2, cy + 3, 1, 2, col);
    }
  }

  function endStatRow(ctx, x, y, w, labelKey, value, accent) {
    text(ctx, T(labelKey), x, y, 1, C.lav, { outline: C.ink, outlineW: 1 });
    textR(ctx, value, x + w, y, 1, accent || C.white, { outline: C.ink, outlineW: 1 });
    dith(ctx, x, y + 11, w, 1, C.ink, C.deep, 0.4);
  }

  function screenEnd(ctx, S, t, victory) {
    var run = S.run || {};
    if (victory) drawVictoryBg(ctx, S, t);
    else drawGameoverBg(ctx, S, t);

    /* заголовок */
    var title = T(victory ? 'end.victoryTitle' : 'end.gameoverTitle');
    var col = victory ? C.lime : C.magenta;
    var sub = T(victory ? 'end.victorySub' : 'end.gameoverSub');
    var tsc = textW(title, 3) > 440 ? 2 : 3;
    var bob = Math.round(Math.sin(t * 2.2) * 2);
    if (victory) {
      textC(ctx, title, 240, 30 + bob, tsc, C.white, {
        outline: C.ink, outlineW: 3, shadow: C.green, shadowDX: 2, shadowDY: 2
      });
    } else {
      textC(ctx, title, 240, 30 + bob, tsc, C.white, {
        outline: C.ink, outlineW: 3, shadow: C.wine, shadowDX: 2, shadowDY: 2
      });
    }
    textWrapC(ctx, sub, 240, 62, 430, 1, victory ? C.cyan : C.lav, 10, {
      outline: C.ink, outlineW: 1
    });

    /* статистика */
    var px = 132, py = 98, pw = 216, ph = 70;
    panel(ctx, px, py, pw, ph, { bg: C.ink, light: C.deep, dark: C.ink, border: col });
    dith(ctx, px + 2, py + 2, pw - 4, ph - 4, C.ink, C.bg, 0.35);
    brackets(ctx, px + 3, py + 3, pw - 6, ph - 6, C.amber, 4);
    endStatRow(ctx, px + 14, py + 8, pw - 28, 'end.score', padScore(run.score || 0, 6), C.amber);
    endStatRow(ctx, px + 14, py + 22, pw - 28, 'end.time', formatTime(run.elapsed || 0), C.white);
    endStatRow(ctx, px + 14, py + 36, pw - 28, 'end.kills', String(run.kills || 0), C.white);
    endStatRow(ctx, px + 14, py + 50, pw - 28, 'end.maxCombo', '×' + (run.maxCombo || 0), C.magenta);
    /* рекорд */
    var nbCol = blink(t, 3) ? C.amber : C.lime;
    if (run.newBest) {
      textC(ctx, '★ ' + T('end.newBest') + ' ★', 240, 79, 1, nbCol, {
        outline: C.ink, outlineW: 1, shadow: C.wine, shadowDX: 1, shadowDY: 1
      });
    } else {
      textC(ctx, T('end.best') + ' ' + padScore(Math.max(run.best || 0, S_().best || 0), 6), 240, 79, 1, C.lav, {
        outline: C.ink, outlineW: 1
      });
    }

    /* кнопки */
    var ends = rects(S, 'end');
    var labels = ['menu.retry', 'menu.mainmenu'];
    var eidx = S.endIndex || 0;
    for (var i = 0; i < ends.length && i < 2; i++) {
      drawMenuItem(ctx, ends[i], T(labels[i]), i === eidx, t, { scale: 1, accent: col });
    }
    textC(ctx, '↑ ↓ · ENTER', 240, 258, 1, C.lav, { outline: C.ink, outlineW: 1 });
  }

  /* ============================================================
     9. ПУБЛИЧНЫЙ API
     ============================================================ */
  window.DD_RENDER_RETRO = { draw: drawScreen };
})();
