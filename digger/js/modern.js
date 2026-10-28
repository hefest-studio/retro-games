/* ============================================================================
   DIGGER · modern.js — современный рендерер «неон / стекло» (960×600)
   Владелец: modern-viz. Интерфейс: CONTRACT.md §5, §5.2.

   Всё рисуется кодом, без внешних ассетов:
   · глубокий градиентный фон, объёмная земля, туннели как тёмное стекло;
   · огранённые алмазы, золотые слитки, вишня, бархатные мешки с шитьём;
   · бур-под с фарой, трейлом и анимацией; биолюминесцентные монстры;
   · частицы, всплывающие очки, screen shake, виньетка;
   · glassmorphism-HUD с подписями DG.t (RU/EN).
   Рендерер только читает S, кэширует градиенты и спрайты, без shadowBlur в цикле.
   ========================================================================== */
(function (global) {
  'use strict';

  var DG = global.DG = global.DG || {};
  DG.render = DG.render || {};

  /* ------------------------------- геометрия ------------------------------- */
  var W = 960, H = 600;
  var COLS = 15, ROWS = 10, CELL = 48;
  var FX = 24, FY = 70, FW = COLS * CELL, FH = ROWS * CELL;   // поле 720×480
  var FCR = 20;                                               // радиус поля
  var TOP = { x: 24, y: 14, w: 720, h: 48 };                  // верхняя панель
  var SIDE = { x: 760, y: 14, w: 176, h: 570 };               // правая колонка
  var FOOT = { x: 24, y: 558, w: 720, h: 26 };                // строка под полем
  var DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  var TAU = Math.PI * 2;

  /* -------------------------------- палитра -------------------------------- */
  var C = {
    bg: '#070a12', bg1: '#0d1424',
    cyan: '#22d3ee', cyanHot: '#a5f3fc', cyanDeep: '#0e7490',
    emerald: '#34d399', emeraldHot: '#a7f3d0', emeraldDeep: '#065f46',
    gold: '#fbbf24', goldHot: '#fde68a', goldDeep: '#b45309',
    magenta: '#f472b6', magentaHot: '#fbcfe8', magentaDeep: '#9d174d',
    rose: '#fb7185',
    ink: '#e8f2ff', dim: '#8aa0bd', dim2: '#5b6b86',
    violet: '#a78bfa'
  };

  var FONT_UI = '"SF Pro Display", "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif';
  var FONT_MONO = '"SF Mono", ui-monospace, Menlo, Consolas, "Cascadia Mono", monospace';
  function fnt(size, weight, mono) {
    return (weight || 500) + ' ' + size + 'px ' + (mono ? FONT_MONO : FONT_UI);
  }
  function T(key, vars) { return (DG.t ? DG.t(key, vars) : key); }

  /* ------------------------------- утилиты --------------------------------- */
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function easeOutCubic(x) { x = clamp(x, 0, 1); return 1 - Math.pow(1 - x, 3); }
  function easeOutBack(x) {
    x = clamp(x, 0, 1);
    var c = 1.70158;
    return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2);
  }
  function hash2(x, y) {
    var h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function prng(seed) {
    var a = seed >>> 0;
    if (!a) a = 0x9E3779B9;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function fmt(n) {
    n = Math.max(0, Math.round(n || 0));
    var s = String(n), out = '';
    for (var i = 0; i < s.length; i++) {
      if (i > 0 && (s.length - i) % 3 === 0) out += '\u2009';
      out += s.charAt(i);
    }
    return out;
  }

  var RV = {};
  function rgbOf(hex) {
    if (RV[hex]) return RV[hex];
    var h = hex.replace('#', '');
    if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
    var n = parseInt(h, 16);
    var out = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    RV[hex] = out;
    return out;
  }
  function rgba(hex, a) {
    var c = rgbOf(hex);
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  }

  /* --------------------------- отрисовка примитивов ------------------------ */
  function rrectPath(ctx, x, y, w, h, r) {
    r = Math.min(r == null ? 8 : r, w * 0.5, h * 0.5);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
  function fillRR(ctx, x, y, w, h, r, style) {
    rrectPath(ctx, x, y, w, h, r);
    ctx.fillStyle = style;
    ctx.fill();
  }
  function strokeRR(ctx, x, y, w, h, r, style, lw) {
    rrectPath(ctx, x, y, w, h, r);
    ctx.strokeStyle = style;
    ctx.lineWidth = lw || 1;
    ctx.stroke();
  }
  function addGlow(ctx, color, x, y, size, alpha) {
    if (alpha <= 0.001) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha;
    ctx.drawImage(getGlow(color, 128), x - size * 0.5, y - size * 0.5, size, size);
    ctx.restore();
  }

  /* --------------------------- кэш текст/ширины ---------------------------- */
  var CHAR_W = {};
  function charW(ctx, ch) {
    var key = ctx.font + '|' + ch;
    var w = CHAR_W[key];
    if (w == null) { w = ctx.measureText(ch).width; CHAR_W[key] = w; }
    return w;
  }
  function trackedWidth(ctx, text, sp) {
    var total = 0;
    for (var i = 0; i < text.length; i++) {
      total += charW(ctx, text.charAt(i));
      if (i < text.length - 1) total += sp;
    }
    return total;
  }
  function tracked(ctx, text, x, y, sp, align) {
    text = String(text);
    var total = trackedWidth(ctx, text, sp);
    var sx = align === 'center' ? x - total * 0.5 : (align === 'right' ? x - total : x);
    var old = ctx.textAlign;
    ctx.textAlign = 'left';
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      ctx.fillText(ch, sx, y);
      sx += charW(ctx, ch) + sp;
    }
    ctx.textAlign = old;
    return total;
  }
  function trackedStroke(ctx, text, x, y, sp, align) {
    text = String(text);
    var total = trackedWidth(ctx, text, sp);
    var sx = align === 'center' ? x - total * 0.5 : (align === 'right' ? x - total : x);
    var old = ctx.textAlign;
    ctx.textAlign = 'left';
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      ctx.strokeText(ch, sx, y);
      sx += charW(ctx, ch) + sp;
    }
    ctx.textAlign = old;
    return total;
  }
  function label(ctx, text, x, y, size, weight, color, sp, align, mono) {
    ctx.font = fnt(size, weight, mono);
    ctx.fillStyle = color;
    return tracked(ctx, text, x, y, sp || 0, align || 'left');
  }

  /* -------------------------------- кэш ----------------------------------- */
  var V = {
    ctx: null,
    bg: null,
    dirtPattern: null,
    glowCache: {},
    sprites: {},
    grads: {},
    dust: [],
    // геометрия поля (перестраивается каждый кадр)
    segRects: [], segEdges: [], segAccents: [], segRim: [],
    // трейл игрока (внутреннее состояние рендерера, S не меняем)
    trail: [],
    lastPX: null, lastPY: null
  };

  function makeCanvas(w, h) {
    if (typeof OffscreenCanvas === 'function') {
      try {
        var oc = new OffscreenCanvas(w, h);
        oc.getContext('2d');
        return oc;
      } catch (e) { /* fallback ниже */ }
    }
    var cv = global.document.createElement('canvas');
    cv.width = w; cv.height = h;
    return cv;
  }

  function getGlow(color, size) {
    var key = color + '|' + size;
    if (V.glowCache[key]) return V.glowCache[key];
    var cv = makeCanvas(size, size);
    var g = cv.getContext('2d');
    var r = size * 0.5;
    var grd = g.createRadialGradient(r, r, 0, r, r, r);
    grd.addColorStop(0, rgba(color, 0.85));
    grd.addColorStop(0.28, rgba(color, 0.42));
    grd.addColorStop(0.62, rgba(color, 0.10));
    grd.addColorStop(1, rgba(color, 0));
    g.fillStyle = grd;
    g.fillRect(0, 0, size, size);
    V.glowCache[key] = cv;
    return cv;
  }

  function initCache(ctx) {
    if (V.ctx === ctx && V.bg) return;
    V.ctx = ctx;
    V.bg = buildBackground();
    V.dirtPattern = ctx.createPattern(buildDirtTile(), 'repeat');
    V.sprites.gem = buildGemSprite();
    V.sprites.gold = buildGoldSprite();
    V.sprites.cherry = buildCherrySprite();
    V.sprites.bag = buildBagSprite();
    V.sprites.cone = buildConeSprite();

    V.grads.tunnel = ctx.createLinearGradient(0, FY, 0, FY + FH);
    V.grads.tunnel.addColorStop(0, 'rgba(13,21,38,0.955)');
    V.grads.tunnel.addColorStop(0.45, 'rgba(6,11,21,0.97)');
    V.grads.tunnel.addColorStop(1, 'rgba(3,6,13,0.985)');

    V.grads.sheen = ctx.createLinearGradient(FX, FY, FX + FW, FY + FH * 0.7);
    V.grads.sheen.addColorStop(0, 'rgba(150,210,255,0.085)');
    V.grads.sheen.addColorStop(0.35, 'rgba(150,210,255,0.018)');
    V.grads.sheen.addColorStop(0.75, 'rgba(244,114,182,0.014)');
    V.grads.sheen.addColorStop(1, 'rgba(52,211,153,0.03)');

    V.grads.glint = ctx.createLinearGradient(0, 0, 440, 0);
    V.grads.glint.addColorStop(0, 'rgba(180,235,255,0)');
    V.grads.glint.addColorStop(0.5, 'rgba(200,245,255,0.30)');
    V.grads.glint.addColorStop(1, 'rgba(180,235,255,0)');

    V.grads.earthWarm = ctx.createRadialGradient(
      FX + FW * 0.26, FY + FH * 0.18, 30,
      FX + FW * 0.26, FY + FH * 0.18, FW * 0.8
    );
    V.grads.earthWarm.addColorStop(0, 'rgba(255,186,116,0.075)');
    V.grads.earthWarm.addColorStop(0.55, 'rgba(255,150,90,0.028)');
    V.grads.earthWarm.addColorStop(1, 'rgba(255,150,90,0)');

    V.grads.earthCool = ctx.createRadialGradient(
      FX + FW * 0.82, FY + FH * 0.88, 30,
      FX + FW * 0.82, FY + FH * 0.88, FW * 0.85
    );
    V.grads.earthCool.addColorStop(0, 'rgba(34,211,238,0.06)');
    V.grads.earthCool.addColorStop(1, 'rgba(34,211,238,0)');

    V.grads.innerVignette = ctx.createRadialGradient(
      FX + FW * 0.5, FY + FH * 0.46, FW * 0.18,
      FX + FW * 0.5, FY + FH * 0.5, FW * 0.72
    );
    V.grads.innerVignette.addColorStop(0, 'rgba(0,0,0,0)');
    V.grads.innerVignette.addColorStop(0.62, 'rgba(0,0,0,0.10)');
    V.grads.innerVignette.addColorStop(1, 'rgba(0,0,0,0.46)');

    V.grads.depth = ctx.createLinearGradient(0, FY, 0, FY + FH);
    V.grads.depth.addColorStop(0, 'rgba(190,228,255,0.055)');
    V.grads.depth.addColorStop(0.22, 'rgba(190,228,255,0.012)');
    V.grads.depth.addColorStop(0.72, 'rgba(0,0,0,0.03)');
    V.grads.depth.addColorStop(1, 'rgba(0,0,0,0.20)');

    V.grads.vignette = ctx.createRadialGradient(W * 0.5, H * 0.46, 260, W * 0.5, H * 0.5, 720);
    V.grads.vignette.addColorStop(0, 'rgba(0,0,0,0)');
    V.grads.vignette.addColorStop(0.62, 'rgba(0,0,0,0.06)');
    V.grads.vignette.addColorStop(1, 'rgba(0,0,0,0.55)');

    V.dust = buildDust();
  }

  /* ------------------------------ фон / текстуры --------------------------- */
  function buildBackground() {
    var cv = makeCanvas(W, H);
    var g = cv.getContext('2d');
    var rnd = prng(0xB16D166E);
    var i, x, y, r;

    var base = g.createLinearGradient(0, 0, 0, H);
    base.addColorStop(0, '#0a1020');
    base.addColorStop(0.42, '#0d1424');
    base.addColorStop(1, '#06090f');
    g.fillStyle = base;
    g.fillRect(0, 0, W, H);

    // мягкие цветные пятна
    var blob = function (cx, cy, rad, color, a) {
      var gr = g.createRadialGradient(cx, cy, 0, cx, cy, rad);
      gr.addColorStop(0, rgba(color, a));
      gr.addColorStop(0.45, rgba(color, a * 0.45));
      gr.addColorStop(1, rgba(color, 0));
      g.fillStyle = gr;
      g.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
    };
    blob(150, 120, 430, C.cyan, 0.075);
    blob(830, 500, 480, C.magenta, 0.06);
    blob(520, 300, 520, C.emerald, 0.032);
    blob(60, 560, 360, C.violet, 0.035);

    // звёздная пыль
    for (i = 0; i < 150; i++) {
      x = rnd() * W; y = rnd() * H; r = 0.35 + rnd() * 1.25;
      var a = 0.03 + rnd() * 0.22;
      g.fillStyle = rnd() < 0.28 ? rgba(C.cyanHot, a) : 'rgba(220,235,255,' + a + ')';
      g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
    // редкие крупные искры
    for (i = 0; i < 14; i++) {
      x = rnd() * W; y = rnd() * H; r = 4 + rnd() * 14;
      g.fillStyle = rgba(rnd() < 0.5 ? C.cyan : C.magenta, 0.05);
      g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }

    // тонкая диагональная сетка
    g.save();
    g.strokeStyle = 'rgba(120,180,255,0.028)';
    g.lineWidth = 1;
    g.beginPath();
    for (i = -H; i < W + H; i += 64) {
      g.moveTo(i, 0);
      g.lineTo(i - H, H);
    }
    g.stroke();
    g.restore();

    // зерно
    for (i = 0; i < 4200; i++) {
      x = rnd() * W; y = rnd() * H;
      g.fillStyle = rnd() < 0.5
        ? 'rgba(255,255,255,' + (0.012 + rnd() * 0.035) + ')'
        : 'rgba(0,0,0,' + (0.02 + rnd() * 0.05) + ')';
      g.fillRect(x, y, 1, 1);
    }

    // верхний световой край
    var topLight = g.createLinearGradient(0, 0, 0, 190);
    topLight.addColorStop(0, 'rgba(120,200,255,0.055)');
    topLight.addColorStop(1, 'rgba(120,200,255,0)');
    g.fillStyle = topLight;
    g.fillRect(0, 0, W, 190);

    return cv;
  }

  function buildDirtTile() {
    var S = 240;
    var cv = makeCanvas(S, S);
    var g = cv.getContext('2d');
    var rnd = prng(0xD1667A11);
    var i, x, y, r, a;

    var base = g.createLinearGradient(0, 0, 0, S);
    base.addColorStop(0, '#241e2d');
    base.addColorStop(0.5, '#1f1a28');
    base.addColorStop(1, '#1a1522');
    g.fillStyle = base;
    g.fillRect(0, 0, S, S);

    // крупные пятна-породы: тёмные провалы и светлые включения
    for (i = 0; i < 30; i++) {
      x = rnd() * S; y = rnd() * S; r = 12 + rnd() * 34;
      var light = rnd() < 0.42;
      var col = light ? (rnd() < 0.5 ? '#45362f' : '#3a3048') : '#100d17';
      var gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, rgba(col, light ? 0.22 : 0.30));
      gr.addColorStop(1, rgba(col, 0));
      g.fillStyle = gr;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }

    // пласты-полосы (страты)
    for (i = 0; i < 7; i++) {
      var sy = rnd() * S;
      g.strokeStyle = i % 2 ? 'rgba(0,0,0,0.16)' : 'rgba(255,205,150,0.035)';
      g.lineWidth = 1 + rnd() * 2.4;
      g.beginPath();
      g.moveTo(0, sy);
      for (var px = 0; px <= S; px += 30) {
        g.lineTo(px, sy + Math.sin(px * 0.05 + i) * 5 + (rnd() - 0.5) * 3);
      }
      g.stroke();
    }

    // мелкая крошка
    for (i = 0; i < 3200; i++) {
      x = rnd() * S; y = rnd() * S;
      var pick = rnd();
      var col2;
      if (pick < 0.28) col2 = '#3b2f45';
      else if (pick < 0.50) col2 = '#15111c';
      else if (pick < 0.68) col2 = '#493849';
      else if (pick < 0.80) col2 = '#2b333f';
      else if (pick < 0.90) col2 = '#5a4634';
      else col2 = '#6a5638';
      a = 0.16 + rnd() * 0.5;
      g.fillStyle = rgba(col2, a);
      r = rnd() < 0.87 ? 1 : 2;
      g.fillRect(x | 0, y | 0, r, r);
    }

    // камешки с объёмом
    for (i = 0; i < 46; i++) {
      x = rnd() * S; y = rnd() * S; r = 1.4 + rnd() * 3.6;
      g.fillStyle = 'rgba(0,0,0,0.55)';
      g.beginPath(); g.ellipse(x + 0.6, y + 1.1, r, r * 0.8, 0, 0, TAU); g.fill();
      g.fillStyle = rgba(rnd() < 0.5 ? '#4b3d52' : '#57432f', 0.6);
      g.beginPath(); g.arc(x, y, r * 0.84, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,224,188,0.13)';
      g.beginPath(); g.arc(x - r * 0.3, y - r * 0.32, r * 0.34, 0, TAU); g.fill();
    }

    // трещины
    g.strokeStyle = 'rgba(4,3,8,0.42)';
    for (i = 0; i < 16; i++) {
      x = rnd() * S; y = rnd() * S;
      g.lineWidth = 0.6 + rnd() * 0.8;
      g.beginPath();
      g.moveTo(x, y);
      for (var k = 0; k < 4; k++) {
        x += (rnd() - 0.5) * 30; y += (rnd() - 0.5) * 30;
        g.lineTo(x, y);
      }
      g.stroke();
    }
    // редкие минеральные блёстки
    for (i = 0; i < 30; i++) {
      x = rnd() * S; y = rnd() * S;
      g.fillStyle = rgba(rnd() < 0.55 ? C.gold : C.emerald, 0.12 + rnd() * 0.14);
      g.fillRect(x | 0, y | 0, 1, 1);
    }
    return cv;
  }

  /* ------------------------------- спрайты --------------------------------- */
  function buildGemSprite() {
    var w = 72, h = 80;
    var cv = makeCanvas(w, h);
    var g = cv.getContext('2d');
    g.translate(w / 2, h / 2);

    // огранка: внешний контур и веер граней из центра
    var pts = [
      [-8, -30], [8, -30], [18, -12], [21, -2], [0, 32], [-21, -2], [-18, -12]
    ];
    var cx = 0, cy = 2;
    var n = pts.length;
    var tones = ['#a7f3d0', '#6ee7b7', '#34d399', '#10b981', '#059669', '#047857', '#0d9488'];

    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < n; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.closePath();
    g.fillStyle = '#042f2e';
    g.fill();

    for (i = 0; i < n; i++) {
      var p1 = pts[i], p2 = pts[(i + 1) % n];
      var mx = (p1[0] + p2[0]) * 0.5, my = (p1[1] + p2[1]) * 0.5;
      // свет падает сверху-слева
      var light = -(mx * 0.55 + my * 0.85);
      var tone;
      if (light > 16) tone = tones[1];
      else if (light > 6) tone = tones[2];
      else if (light > -4) tone = tones[3];
      else if (light > -14) tone = tones[4];
      else if (light > -24) tone = tones[5];
      else tone = tones[6];
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(p1[0], p1[1]);
      g.lineTo(p2[0], p2[1]);
      g.closePath();
      g.fillStyle = tone;
      g.fill();
      g.strokeStyle = 'rgba(236,254,255,0.15)';
      g.lineWidth = 0.8;
      g.stroke();
    }

    // стол (верхняя площадка)
    g.beginPath();
    g.moveTo(-6, -30); g.lineTo(6, -30); g.lineTo(9.5, -20); g.lineTo(-9.5, -20);
    g.closePath();
    g.fillStyle = 'rgba(209,250,229,0.88)';
    g.fill();
    g.strokeStyle = 'rgba(6,78,59,0.55)';
    g.lineWidth = 0.9;
    g.stroke();

    // павильон: тёмные грани-тени к низу
    g.beginPath();
    g.moveTo(-21, -2); g.lineTo(0, 32); g.lineTo(21, -2); g.closePath();
    g.fillStyle = 'rgba(2,32,30,0.38)';
    g.fill();

    // контур
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (i = 1; i < n; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.closePath();
    g.strokeStyle = 'rgba(3,34,30,0.9)';
    g.lineWidth = 1.5;
    g.stroke();

    // внутренний блик
    var shine = g.createRadialGradient(-1, -4, 1, 1, 0, 20);
    shine.addColorStop(0, 'rgba(255,255,255,0.40)');
    shine.addColorStop(0.4, 'rgba(190,255,235,0.12)');
    shine.addColorStop(1, 'rgba(190,255,235,0)');
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = shine;
    g.fillRect(-26, -32, 52, 66);
    g.globalCompositeOperation = 'source-over';

    // зеркальная грань
    g.strokeStyle = 'rgba(255,255,255,0.8)';
    g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(-7, -26); g.lineTo(-15, -12); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.beginPath(); g.arc(-12, -13, 1.2, 0, TAU); g.fill();
    return cv;
  }

  function buildGoldSprite() {
    var cv = makeCanvas(60, 48);
    var g = cv.getContext('2d');
    g.translate(30, 26);

    // нижний слиток
    var grd = g.createLinearGradient(0, 10, 0, 26);
    grd.addColorStop(0, '#fbbf24');
    grd.addColorStop(0.5, '#f59e0b');
    grd.addColorStop(1, '#92400e');
    g.fillStyle = grd;
    g.beginPath();
    g.moveTo(-19, 10); g.lineTo(19, 10); g.lineTo(15, 21); g.lineTo(-15, 21);
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(255,241,190,0.85)';
    g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(-18, 10.5); g.lineTo(18, 10.5); g.stroke();

    // верхний слиток
    var grd2 = g.createLinearGradient(0, -6, 0, 12);
    grd2.addColorStop(0, '#fde68a');
    grd2.addColorStop(0.45, '#fbbf24');
    grd2.addColorStop(1, '#b45309');
    g.fillStyle = grd2;
    g.beginPath();
    g.moveTo(-14, -6); g.lineTo(14, -6); g.lineTo(18, 8); g.lineTo(-18, 8);
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(255,248,214,0.9)';
    g.beginPath(); g.moveTo(-13, -5.2); g.lineTo(13, -5.2); g.stroke();
    // верхняя грань
    g.fillStyle = 'rgba(255,251,235,0.65)';
    g.beginPath();
    g.moveTo(-14, -6); g.lineTo(14, -6); g.lineTo(11, -1); g.lineTo(-11, -1);
    g.closePath();
    g.fill();
    // блик
    g.fillStyle = 'rgba(255,255,255,0.75)';
    g.beginPath(); g.ellipse(-5, -3.4, 4.6, 1.5, -0.08, 0, TAU); g.fill();
    return cv;
  }

  function buildCherrySprite() {
    var cv = makeCanvas(64, 64);
    var g = cv.getContext('2d');
    g.translate(32, 34);

    // хвостики
    g.strokeStyle = '#a16207';
    g.lineWidth = 2.2;
    g.lineCap = 'round';
    g.beginPath(); g.moveTo(-11, 2); g.bezierCurveTo(-6, -14, 2, -18, 8, -22); g.stroke();
    g.strokeStyle = '#854d0e';
    g.beginPath(); g.moveTo(10, 6); g.bezierCurveTo(9, -8, 9, -16, 8, -22); g.stroke();

    // лист
    g.fillStyle = '#16a34a';
    g.beginPath();
    g.moveTo(8, -22);
    g.quadraticCurveTo(22, -30, 25, -18);
    g.quadraticCurveTo(14, -14, 8, -22);
    g.fill();
    g.strokeStyle = 'rgba(6,95,70,0.7)';
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(9, -21); g.quadraticCurveTo(16, -23, 23, -19); g.stroke();

    // ягоды
    function berry(x, y, r) {
      var gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.15, x, y, r);
      gr.addColorStop(0, '#fda4af');
      gr.addColorStop(0.35, '#f43f5e');
      gr.addColorStop(0.8, '#be123c');
      gr.addColorStop(1, '#7f1d1d');
      g.fillStyle = gr;
      g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(76,5,25,0.5)';
      g.lineWidth = 1;
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.72)';
      g.beginPath(); g.ellipse(x - r * 0.32, y - r * 0.38, r * 0.26, r * 0.17, -0.5, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.28)';
      g.beginPath(); g.arc(x + r * 0.3, y + r * 0.28, r * 0.17, 0, TAU); g.fill();
    }
    berry(-11, 8, 13);
    berry(12, 10, 11.5);
    return cv;
  }

  function buildBagSprite() {
    var cv = makeCanvas(72, 76);
    var g = cv.getContext('2d');
    g.translate(36, 38);

    // тень-объём под мешком
    g.fillStyle = 'rgba(0,0,0,0.28)';
    g.beginPath(); g.ellipse(0, 26, 19, 5, 0, 0, TAU); g.fill();

    // тело мешочка
    var body = g.createLinearGradient(-18, -18, 16, 28);
    body.addColorStop(0, '#7c2749');
    body.addColorStop(0.3, '#571a3a');
    body.addColorStop(0.72, '#3a0e26');
    body.addColorStop(1, '#260716');
    g.beginPath();
    g.moveTo(-11, -14);
    g.bezierCurveTo(-22, -2, -22, 16, -14, 24);
    g.quadraticCurveTo(0, 31, 14, 24);
    g.bezierCurveTo(22, 16, 22, -2, 11, -14);
    g.closePath();
    g.fillStyle = body;
    g.fill();

    // бархатный блик
    var sheen = g.createRadialGradient(-9, -4, 2, -4, 2, 26);
    sheen.addColorStop(0, 'rgba(244,114,182,0.42)');
    sheen.addColorStop(0.5, 'rgba(244,114,182,0.10)');
    sheen.addColorStop(1, 'rgba(244,114,182,0)');
    g.fillStyle = sheen;
    g.beginPath();
    g.moveTo(-11, -14);
    g.bezierCurveTo(-22, -2, -22, 16, -14, 24);
    g.quadraticCurveTo(0, 31, 14, 24);
    g.bezierCurveTo(22, 16, 22, -2, 11, -14);
    g.closePath();
    g.fill();

    // складки
    g.strokeStyle = 'rgba(45,6,25,0.45)';
    g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(-4, -12); g.quadraticCurveTo(-2, 6, -6, 22); g.stroke();
    g.beginPath(); g.moveTo(6, -12); g.quadraticCurveTo(8, 8, 4, 23); g.stroke();

    // золотая оторочка-шитьё по контуру
    g.save();
    g.setLineDash([3, 4]);
    g.strokeStyle = 'rgba(251,191,36,0.55)';
    g.lineWidth = 1.1;
    g.beginPath();
    g.moveTo(-11, -13);
    g.bezierCurveTo(-20, -2, -20, 15, -13, 22.5);
    g.quadraticCurveTo(0, 29, 13, 22.5);
    g.bezierCurveTo(20, 15, 20, -2, 11, -13);
    g.closePath();
    g.stroke();
    g.restore();

    // горловина и золотой шнур
    g.fillStyle = '#3d0c26';
    g.beginPath(); g.ellipse(0, -14, 12.5, 4.6, 0, 0, TAU); g.fill();
    g.strokeStyle = '#fbbf24';
    g.lineWidth = 2.2;
    g.beginPath(); g.moveTo(-12, -14.5); g.quadraticCurveTo(0, -11, 12, -14.5); g.stroke();
    g.fillStyle = '#fde68a';
    g.beginPath(); g.arc(9, -13, 2.1, 0, TAU); g.fill();

    // «$» золотым шитьём
    g.font = '800 27px Georgia, "Times New Roman", serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = 'rgba(25,4,15,0.6)';
    g.fillText('$', 1.2, 9.5);
    g.strokeStyle = 'rgba(255,236,170,0.5)';
    g.lineWidth = 1;
    g.strokeText('$', 0, 8);
    g.fillStyle = '#fbbf24';
    g.fillText('$', 0, 8);
    g.fillStyle = 'rgba(255,250,222,0.9)';
    g.font = '800 27px Georgia, "Times New Roman", serif';
    g.fillText('$', -0.7, 7.3);
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';

    return cv;
  }

  function buildConeSprite() {
    var cv = makeCanvas(360, 300);
    var g = cv.getContext('2d');
    var ax = 24, ay = 150;

    var grd = g.createLinearGradient(ax, ay, 350, ay);
    grd.addColorStop(0, 'rgba(200,248,255,0.24)');
    grd.addColorStop(0.2, 'rgba(120,228,255,0.12)');
    grd.addColorStop(0.55, 'rgba(80,200,255,0.045)');
    grd.addColorStop(1, 'rgba(70,190,255,0)');
    g.beginPath();
    g.moveTo(ax, ay);
    g.lineTo(350, 52);
    g.lineTo(350, 248);
    g.closePath();
    g.fillStyle = grd;
    g.fill();

    // яркое ядро пучка
    var core = g.createLinearGradient(ax, ay, 250, ay);
    core.addColorStop(0, 'rgba(235,252,255,0.30)');
    core.addColorStop(1, 'rgba(235,252,255,0)');
    g.beginPath();
    g.moveTo(ax, ay - 12);
    g.lineTo(250, ay - 40);
    g.lineTo(250, ay + 40);
    g.lineTo(ax, ay + 12);
    g.closePath();
    g.fillStyle = core;
    g.fill();

    // источник
    var spot = g.createRadialGradient(ax, ay, 0, ax, ay, 62);
    spot.addColorStop(0, 'rgba(240,254,255,0.72)');
    spot.addColorStop(0.35, 'rgba(180,242,255,0.30)');
    spot.addColorStop(1, 'rgba(120,220,255,0)');
    g.fillStyle = spot;
    g.fillRect(0, 0, 160, 300);

    return cv;
  }

  function buildDust() {
    var rnd = prng(0x5EED5EED);
    var colors = [C.cyanHot, '#c7d2fe', C.emeraldHot, C.magentaHot, '#dbeafe'];
    var out = [];
    for (var i = 0; i < 58; i++) {
      out.push({
        x: rnd() * W,
        y: rnd() * H,
        r: 0.5 + rnd() * 1.5,
        spd: 0.35 + rnd() * 1.1,
        ph: rnd() * TAU,
        col: colors[(rnd() * colors.length) | 0],
        a: 0.10 + rnd() * 0.25
      });
    }
    return out;
  }

  /* ------------------------------- фон ------------------------------------- */
  function drawBackdrop(ctx, t) {
    ctx.drawImage(V.bg, 0, 0);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    var b1 = 380;
    ctx.globalAlpha = 0.05 + 0.014 * Math.sin(t * 0.35);
    var x1 = 150 + Math.sin(t * 0.11) * 70, y1 = 120 + Math.cos(t * 0.09) * 50;
    ctx.drawImage(getGlow(C.cyan, 128), x1 - b1 * 0.5, y1 - b1 * 0.5, b1, b1);

    var b2 = 430;
    ctx.globalAlpha = 0.045 + 0.012 * Math.cos(t * 0.3);
    var x2 = 830 + Math.cos(t * 0.08) * 60, y2 = 500 + Math.sin(t * 0.12) * 50;
    ctx.drawImage(getGlow(C.magenta, 128), x2 - b2 * 0.5, y2 - b2 * 0.5, b2, b2);

    var b3 = 470;
    ctx.globalAlpha = 0.028;
    ctx.drawImage(getGlow(C.emerald, 128), 520 - b3 * 0.5, 300 - b3 * 0.5, b3, b3);

    // аврора — медленная световая полоса
    ctx.globalAlpha = 0.05;
    ctx.save();
    ctx.translate(480, 300);
    ctx.rotate(-0.42 + Math.sin(t * 0.05) * 0.05);
    ctx.fillStyle = V.grads.glint;
    ctx.fillRect(-210, -240, 420, 480);
    ctx.restore();
    ctx.restore();

    // пылинки
    ctx.save();
    for (var i = 0; i < V.dust.length; i++) {
      var d = V.dust[i];
      var dx = (d.x + t * d.spd * 9) % W;
      var dy = ((d.y - t * d.spd * 7) % H + H) % H;
      var tw = 0.55 + 0.45 * Math.sin(t * 1.3 + d.ph);
      ctx.globalAlpha = d.a * tw;
      ctx.fillStyle = d.col;
      ctx.beginPath();
      ctx.arc(dx, dy, d.r, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  /* --------------------------- геометрия поля ------------------------------ */
  function addEdge(ax, ay, bx, by, nx, ny, h) {
    V.segEdges.push([ax, ay, bx, by]);
    if (h < 0.11) V.segAccents.push([ax, ay, bx, by]);
    V.segRim.push([ax + nx * 1.7, ay + ny * 1.7, bx + nx * 1.7, by + ny * 1.7]);
  }

  function buildGeometry(S) {
    V.segRects.length = 0;
    V.segEdges.length = 0;
    V.segAccents.length = 0;
    V.segRim.length = 0;
    for (var cy = 0; cy < ROWS; cy++) {
      for (var cx = 0; cx < COLS; cx++) {
        if (S.grid[cy * COLS + cx] !== 1) continue;
        var x0 = FX + cx * CELL, y0 = FY + cy * CELL;
        var x1 = x0 + CELL, y1 = y0 + CELL;
        V.segRects.push(x0, y0);
        var h = hash2(cx, cy);
        if (cy === 0 || S.grid[(cy - 1) * COLS + cx] !== 1) addEdge(x0, y0, x1, y0, 0, -1, h);
        if (cy === ROWS - 1 || S.grid[(cy + 1) * COLS + cx] !== 1) addEdge(x0, y1, x1, y1, 0, 1, h);
        if (cx === 0 || S.grid[cy * COLS + cx - 1] !== 1) addEdge(x0, y0, x0, y1, -1, 0, h);
        if (cx === COLS - 1 || S.grid[cy * COLS + cx + 1] !== 1) addEdge(x1, y0, x1, y1, 1, 0, h);
      }
    }
  }

  function pathRects(ctx) {
    ctx.beginPath();
    var r = V.segRects;
    for (var i = 0; i < r.length; i += 2) ctx.rect(r[i], r[i + 1], CELL, CELL);
  }
  function pathSegs(ctx, arr) {
    ctx.beginPath();
    for (var i = 0; i < arr.length; i++) {
      var s = arr[i];
      ctx.moveTo(s[0], s[1]);
      ctx.lineTo(s[2], s[3]);
    }
  }

  function fieldClip(ctx) {
    rrectPath(ctx, FX, FY, FW, FH, FCR);
    ctx.clip();
  }

  /* ------------------------------ поле ------------------------------------- */
  function drawFieldOuterGlow(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    strokeRR(ctx, FX - 1, FY - 1, FW + 2, FH + 2, FCR + 1, rgba(C.cyan, 0.03), 20);
    strokeRR(ctx, FX - 1, FY - 1, FW + 2, FH + 2, FCR + 1, rgba(C.cyan, 0.06), 8);
    strokeRR(ctx, FX - 1, FY - 1, FW + 2, FH + 2, FCR + 1, rgba(C.cyan, 0.13), 2.5);
    ctx.restore();
  }

  function drawEarth(ctx, S) {
    ctx.fillStyle = V.dirtPattern;
    ctx.fillRect(FX, FY, FW, FH);
    ctx.fillStyle = V.grads.earthWarm;
    ctx.fillRect(FX, FY, FW, FH);
    ctx.fillStyle = V.grads.earthCool;
    ctx.fillRect(FX, FY, FW, FH);

    // вариация яркости по клеткам земли (очень мягкая, чтобы не было «плитки»)
    for (var cy = 0; cy < ROWS; cy++) {
      for (var cx = 0; cx < COLS; cx++) {
        if (S.grid[cy * COLS + cx] === 1) continue;
        var h = hash2(cx + 11, cy + 37);
        ctx.fillStyle = h > 0.5
          ? 'rgba(255,222,190,' + (0.004 + h * 0.008) + ')'
          : 'rgba(0,0,0,' + (0.008 + (1 - h) * 0.012) + ')';
        ctx.fillRect(FX + cx * CELL, FY + cy * CELL, CELL, CELL);
      }
    }
  }

  function drawTunnelGlass(ctx, S, t) {
    // тёмное стекло
    pathRects(ctx);
    ctx.fillStyle = V.grads.tunnel;
    ctx.fill();

    ctx.save();
    pathRects(ctx);
    ctx.clip();

    // амбиент-окклюзия у стен — объём
    pathSegs(ctx, V.segEdges);
    ctx.strokeStyle = 'rgba(0,0,0,0.62)';
    ctx.lineWidth = 18;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.40)';
    ctx.lineWidth = 6;
    ctx.stroke();

    // отражения стекла
    ctx.fillStyle = V.grads.sheen;
    ctx.fillRect(FX, FY, FW, FH);

    // медленный блик по туннелям
    var gx = FX + ((t * 46) % (FW + 520)) - 260;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.7;
    ctx.translate(gx, 0);
    ctx.rotate(-0.16);
    ctx.fillStyle = V.grads.glint;
    ctx.fillRect(-220, FY - 120, 440, FH + 260);
    ctx.restore();

    // сетка внутри туннелей — читаемая
    drawGridLines(ctx, 0.075);
    // узелки сетки
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(150,225,255,0.13)';
    for (var i = 0; i < V.segRects.length; i += 2) {
      var cx = V.segRects[i] + CELL * 0.5, cy = V.segRects[i + 1] + CELL * 0.5;
      ctx.beginPath();
      ctx.arc(cx, cy, 1.15, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    // угловые засечки клеток
    ctx.save();
    ctx.strokeStyle = 'rgba(140,215,255,0.10)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (i = 0; i < V.segRects.length; i += 2) {
      var x0 = V.segRects[i], y0 = V.segRects[i + 1];
      ctx.moveTo(x0 + 4, y0); ctx.lineTo(x0, y0); ctx.lineTo(x0, y0 + 4);
      ctx.moveTo(x0 + CELL - 4, y0); ctx.lineTo(x0 + CELL, y0); ctx.lineTo(x0 + CELL, y0 + 4);
      ctx.moveTo(x0 + 4, y0 + CELL); ctx.lineTo(x0, y0 + CELL); ctx.lineTo(x0, y0 + CELL - 4);
      ctx.moveTo(x0 + CELL - 4, y0 + CELL); ctx.lineTo(x0 + CELL, y0 + CELL); ctx.lineTo(x0 + CELL, y0 + CELL - 4);
    }
    ctx.stroke();
    ctx.restore();

    ctx.restore();

    // неоновая кромка
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    pathSegs(ctx, V.segEdges);
    ctx.strokeStyle = rgba(C.cyan, 0.055); ctx.lineWidth = 15; ctx.stroke();
    ctx.strokeStyle = rgba(C.cyan, 0.15); ctx.lineWidth = 4.6; ctx.stroke();
    ctx.strokeStyle = rgba(C.cyanHot, 0.62); ctx.lineWidth = 1.5; ctx.stroke();
    if (V.segAccents.length) {
      pathSegs(ctx, V.segAccents);
      ctx.strokeStyle = rgba(C.magenta, 0.10); ctx.lineWidth = 12; ctx.stroke();
      ctx.strokeStyle = rgba(C.magentaHot, 0.42); ctx.lineWidth = 1.6; ctx.stroke();
    }
    // тёплый контровой свет по гребню земли
    pathSegs(ctx, V.segRim);
    ctx.strokeStyle = 'rgba(255,214,170,0.10)';
    ctx.lineWidth = 1.3;
    ctx.stroke();
    ctx.restore();
  }

  function drawGridLines(ctx, alpha) {
    var i;
    ctx.beginPath();
    for (i = 0; i <= COLS; i++) {
      var x = FX + i * CELL;
      ctx.moveTo(x, FY);
      ctx.lineTo(x, FY + FH);
    }
    for (i = 0; i <= ROWS; i++) {
      var y = FY + i * CELL;
      ctx.moveTo(FX, y);
      ctx.lineTo(FX + FW, y);
    }
    ctx.strokeStyle = 'rgba(150,202,255,' + alpha + ')';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function drawGrid(ctx) {
    drawGridLines(ctx, 0.032);
    // светящиеся узлы сетки по периметру
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(160,225,255,0.16)';
    for (var i = 0; i <= COLS; i++) {
      for (var k = 0; k <= ROWS; k++) {
        if (i !== 0 && i !== COLS && k !== 0 && k !== ROWS) continue;
        ctx.fillRect(FX + i * CELL - 1, FY + k * CELL - 1, 2, 2);
      }
    }
    ctx.restore();
  }

  function drawBeam(ctx, S, t) {
    var p = S.player;
    if (!p || !p.alive) return;
    if (S.mode !== 'play' && S.mode !== 'bonus' && S.mode !== 'ready' && S.mode !== 'dying') return;
    var px = FX + p.x * CELL, py = FY + p.y * CELL;
    var ang = [-Math.PI / 2, 0, Math.PI / 2, Math.PI][p.dir | 0] || 0;
    var flick = 0.86 + 0.14 * Math.sin(t * 23) * Math.sin(t * 7.3);

    ctx.save();
    fieldClip(ctx);
    pathRects(ctx);
    ctx.clip();               // свет ходит по туннелям
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.72 * flick;
    ctx.translate(px + Math.cos(ang) * 8, py + Math.sin(ang) * 8);
    ctx.rotate(ang);
    ctx.drawImage(V.sprites.cone, -24, -150, 360, 300);
    ctx.restore();

    // тёплый ореол вокруг бура и световое пятно впереди
    addGlow(ctx, C.cyan, px, py, 84, 0.10 * flick);
    addGlow(ctx, C.cyanHot, px, py, 34, 0.07 * flick);
    var fx = px + Math.cos(ang) * CELL * 0.85, fy = py + Math.sin(ang) * CELL * 0.85;
    addGlow(ctx, C.cyanHot, fx, fy, 56, 0.08 * flick);
  }

  /* ------------------------------- предметы -------------------------------- */
  function drawItems(ctx, S, t) {
    for (var i = 0; i < S.items.length; i++) {
      var it = S.items[i];
      if (it.type === 'gem') drawGemItem(ctx, it, t);
      else if (it.type === 'gold') drawGoldItem(ctx, it, t);
      else if (it.type === 'cherry') drawCherryItem(ctx, it, t);
      else if (it.type === 'bag') drawBagItem(ctx, it, t);
    }
  }

  function drawGemItem(ctx, it, t) {
    var px = FX + it.x * CELL, py = FY + it.y * CELL;
    var h = hash2(it.cx * 3 + 1, it.cy * 5 + 2);
    var pulse = 0.5 + 0.5 * Math.sin(t * 2.3 + h * TAU);
    var bob = Math.sin(t * 1.7 + h * TAU) * 1.3;

    addGlow(ctx, C.emerald, px, py + bob, 58 + pulse * 10, 0.18 + pulse * 0.14);
    addGlow(ctx, C.emeraldHot, px, py + bob, 22, 0.14 + pulse * 0.10);

    ctx.save();
    ctx.translate(px, py + bob);
    ctx.rotate(Math.sin(t * 1.2 + h * 9) * 0.07);
    ctx.drawImage(V.sprites.gem, -31, -35, 62, 69);
    ctx.restore();

    // искра
    var sp = Math.sin(t * 2.6 + h * 13);
    if (sp > 0.72) {
      var k = (sp - 0.72) / 0.28;
      var sx = px + 9, sy = py - 15 + bob;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = k;
      ctx.strokeStyle = 'rgba(236,254,255,0.9)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(sx - 5 * k, sy); ctx.lineTo(sx + 5 * k, sy);
      ctx.moveTo(sx, sy - 5 * k); ctx.lineTo(sx, sy + 5 * k);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawGoldItem(ctx, it, t) {
    var px = FX + it.x * CELL, py = FY + it.y * CELL;
    var h = hash2(it.cx + 5, it.cy + 7);
    var pulse = 0.5 + 0.5 * Math.sin(t * 2.0 + h * 7);
    addGlow(ctx, C.gold, px, py, 54 + pulse * 10, 0.20 + pulse * 0.12);
    ctx.save();
    ctx.translate(px, py + Math.sin(t * 1.9 + h * 5) * 0.8);
    ctx.drawImage(V.sprites.gold, -30, -26, 60, 48);
    ctx.restore();

    if (Math.sin(t * 2.8 + h * 11) > 0.55) {
      var sx = px + 13, sy = py - 14;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,248,214,0.85)';
      ctx.beginPath();
      ctx.moveTo(sx, sy - 4); ctx.lineTo(sx + 1, sy - 1); ctx.lineTo(sx + 4, sy);
      ctx.lineTo(sx + 1, sy + 1); ctx.lineTo(sx, sy + 4); ctx.lineTo(sx - 1, sy + 1);
      ctx.lineTo(sx - 4, sy); ctx.lineTo(sx - 1, sy - 1);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  function drawCherryItem(ctx, it, t) {
    var px = FX + it.x * CELL, py = FY + it.y * CELL;
    var bob = Math.sin(t * 1.6) * 2.2;
    var pulse = 0.5 + 0.5 * Math.sin(t * 2.4 + 1.3);
    addGlow(ctx, C.rose, px, py + bob, 74 + pulse * 14, 0.26 + pulse * 0.18);
    addGlow(ctx, C.magenta, px, py + bob, 34, 0.2);
    ctx.save();
    ctx.translate(px, py + bob);
    ctx.rotate(Math.sin(t * 1.1) * 0.05);
    ctx.drawImage(V.sprites.cherry, -32, -34, 64, 64);
    ctx.restore();
  }

  function drawBagItem(ctx, it, t) {
    var px = FX + it.x * CELL, py = FY + it.y * CELL;
    var h = hash2(it.cx + 13, it.cy + 17);
    var wob = it.wobble > 0 ? clamp(it.wobble / 0.65, 0, 1) : 0;
    var shakeA = wob * 3.4;
    var dx = Math.sin(t * 42 + h * 10) * shakeA;
    var ang = Math.sin(t * 44 + h * 7) * 0.07 * wob;
    var falling = !!it.falling;
    var bob = falling ? 0 : Math.sin(t * 1.5 + h * 4) * 0.5;

    if (wob > 0 || falling) {
      addGlow(ctx, C.gold, px + dx, py, 70, 0.20 + 0.20 * wob);
    }

    ctx.save();
    ctx.translate(px + dx, py + bob);
    ctx.rotate(ang);
    if (falling) {
      ctx.scale(1.04, 1.10);
      ctx.globalAlpha = 0.35;
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = rgba(C.gold, 0.55);
      ctx.fillRect(-14, -34, 3, 16);
      ctx.fillRect(6, -34, 3, 12);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.drawImage(V.sprites.bag, -33, -37, 66, 70);
    ctx.restore();

    // «!» при тряске
    if (wob > 0.15) {
      ctx.save();
      ctx.globalAlpha = 0.5 + 0.5 * wob;
      ctx.font = fnt(13, 800, true);
      ctx.fillStyle = rgba(C.goldHot, 0.9);
      ctx.textAlign = 'center';
      ctx.fillText('!', px + dx, py - 26);
      ctx.textAlign = 'left';
      ctx.restore();
    }
  }

  /* ------------------------------- игрок ----------------------------------- */
  function updateTrail(S, p, t) {
    if (S.mode !== 'play' && S.mode !== 'bonus') {
      if (V.trail.length) V.trail.length = 0;
      V.lastPX = p.x; V.lastPY = p.y;
      return;
    }
    if (V.lastPX != null) {
      var ddx = p.x - V.lastPX, ddy = p.y - V.lastPY;
      if (ddx * ddx + ddy * ddy > 2.25) V.trail.length = 0;
    }
    V.lastPX = p.x; V.lastPY = p.y;
    if (p.moving && p.alive) {
      V.trail.push({ x: p.x, y: p.y, t: t });
      if (V.trail.length > 14) V.trail.shift();
    }
    for (var i = V.trail.length - 1; i >= 0; i--) {
      if (t - V.trail[i].t > 0.32) V.trail.splice(i, 1);
    }
  }

  function drawTrail(ctx, t) {
    if (!V.trail.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < V.trail.length; i++) {
      var n = V.trail[i];
      var age = t - n.t;
      var k = clamp(1 - age / 0.32, 0, 1) * (i / V.trail.length);
      if (k <= 0.01) continue;
      ctx.globalAlpha = k * 0.5;
      ctx.drawImage(getGlow(C.cyan, 64), FX + n.x * CELL - 12, FY + n.y * CELL - 12, 24, 24);
    }
    ctx.restore();
  }

  function drawPlayer(ctx, S, t) {
    var p = S.player;
    if (!p) return;
    var px = FX + p.x * CELL, py = FY + p.y * CELL;

    updateTrail(S, p, t);

    if (!p.alive) {
      if (S.mode === 'dying') drawPlayerDeath(ctx, p, S, t, px, py);
      return;
    }

    drawTrail(ctx, t);
    addGlow(ctx, C.cyan, px, py, 84, 0.12 + 0.04 * Math.sin(t * 3.1));

    // тёмный ореол отделяет бур от света фары
    var halo = ctx.createRadialGradient(px, py, 3, px, py, 30);
    halo.addColorStop(0, 'rgba(3,6,12,0.55)');
    halo.addColorStop(0.65, 'rgba(3,6,12,0.30)');
    halo.addColorStop(1, 'rgba(3,6,12,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(px, py, 30, 0, TAU);
    ctx.fill();

    var alpha = 1;
    if (p.invuln > 0) alpha = 0.62 + 0.38 * Math.abs(Math.sin(t * 19));
    var bob = p.moving ? Math.sin(p.walkPhase * 2) * 1.1 : Math.sin(t * 2.1) * 0.6;
    var ang = [-Math.PI / 2, 0, Math.PI / 2, Math.PI][p.dir | 0] || 0;
    var recoil = (p.shootAnim || 0) * 3.2;

    ctx.save();
    ctx.translate(px, py + bob);
    ctx.rotate(ang);
    ctx.translate(-recoil, 0);
    ctx.globalAlpha = alpha;

    // выхлоп
    var fl = 0.5 + 0.5 * Math.sin(t * 29 + p.walkPhase);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha * (0.20 + 0.20 * fl);
    ctx.drawImage(getGlow(C.cyan, 64), -44, -16, 34, 32);
    ctx.globalAlpha = alpha * (0.10 + 0.10 * fl);
    ctx.drawImage(getGlow(C.magenta, 64), -36, -11, 22, 22);
    ctx.restore();

    // гусеницы-полозья
    ctx.fillStyle = '#161e2c';
    fillRR(ctx, -17, -14, 27, 6, 3);
    fillRR(ctx, -17, 8, 27, 6, 3);
    ctx.fillStyle = 'rgba(150,190,225,0.4)';
    for (var k = 0; k < 4; k++) {
      var off = ((p.walkPhase * 7 + k * 5) % 21);
      ctx.fillRect(-15 + off, -14, 2.4, 6);
      ctx.fillRect(-15 + ((off + 10) % 21), 8, 2.4, 6);
    }

    // корпус
    var body = ctx.createLinearGradient(0, -12, 0, 12);
    body.addColorStop(0, '#b8cce6');
    body.addColorStop(0.42, '#68809f');
    body.addColorStop(1, '#2b3649');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(-18, -9);
    ctx.lineTo(2, -11);
    ctx.quadraticCurveTo(12, -10, 12, -4);
    ctx.lineTo(12, 4);
    ctx.quadraticCurveTo(12, 10, 2, 11);
    ctx.lineTo(-18, 9);
    ctx.quadraticCurveTo(-22, 0, -18, -9);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(8,14,24,0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // золотой акцент
    ctx.strokeStyle = 'rgba(251,191,36,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-7, -9.4); ctx.lineTo(-7, 9.4); ctx.stroke();
    ctx.fillStyle = 'rgba(251,191,36,0.28)';
    ctx.fillRect(-10.5, -9.5, 2.2, 19);

    // кабина
    var glass = ctx.createLinearGradient(-9, -8, 2, 8);
    glass.addColorStop(0, '#d9fbff');
    glass.addColorStop(0.4, '#67e8f9');
    glass.addColorStop(1, '#0e7490');
    ctx.fillStyle = glass;
    ctx.beginPath();
    ctx.ellipse(-2, 0, 8, 7, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(8,47,73,0.65)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.ellipse(-4.5, -2.6, 2.7, 1.7, -0.5, 0, TAU);
    ctx.fill();

    // бур
    var drill = ctx.createLinearGradient(10, 0, 27, 0);
    drill.addColorStop(0, '#d7e3f4');
    drill.addColorStop(0.45, '#8fa3bd');
    drill.addColorStop(1, '#3d4c62');
    ctx.fillStyle = drill;
    ctx.beginPath();
    ctx.moveTo(10, -8.5);
    ctx.lineTo(27, 0);
    ctx.lineTo(10, 8.5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(10,18,30,0.55)';
    ctx.lineWidth = 1;
    ctx.stroke();
    // спираль бура
    ctx.strokeStyle = 'rgba(15,23,42,0.5)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(13, -6); ctx.lineTo(20, -1.5);
    ctx.moveTo(13, 0); ctx.lineTo(23, 0);
    ctx.moveTo(13, 6); ctx.lineTo(20, 1.5);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath(); ctx.arc(26.4, 0, 1.9, 0, TAU); ctx.fill();

    // фара
    ctx.strokeStyle = 'rgba(251,191,36,0.95)';
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(12.5, 0, 3.6, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#fefce8';
    ctx.beginPath(); ctx.arc(12.5, 0, 2.2, 0, TAU); ctx.fill();

    ctx.restore();

    // вспышка выстрела
    if (p.shootAnim > 0.02) {
      var fx = px + Math.cos(ang) * 30, fy = py + Math.sin(ang) * 30;
      var sa = p.shootAnim;
      addGlow(ctx, C.cyanHot, fx, fy, 30 + 20 * sa, 0.7 * sa);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = sa;
      ctx.strokeStyle = 'rgba(190,245,255,0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(fx, fy, 5 + 8 * (1 - sa), 0, TAU);
      ctx.stroke();
      ctx.restore();
    }

    // щит неуязвимости
    if (p.invuln > 0) drawShield(ctx, px, py, t);
  }

  function drawShield(ctx, px, py, t) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(px, py);
    ctx.rotate(t * 1.6);
    ctx.strokeStyle = 'rgba(103,232,249,0.34)';
    ctx.lineWidth = 1.4;
    ctx.setLineDash([7, 6]);
    ctx.beginPath(); ctx.arc(0, 0, 27, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(165,243,252,0.16)';
    ctx.beginPath(); ctx.arc(0, 0, 31, 0, TAU); ctx.stroke();
    for (var i = 0; i < 4; i++) {
      var a = t * 2.1 + i * TAU / 4;
      ctx.fillStyle = 'rgba(190,245,255,0.7)';
      ctx.beginPath();
      ctx.arc(Math.cos(a) * 27, Math.sin(a) * 27, 1.6, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPlayerDeath(ctx, p, S, t, px, py) {
    var total = 1.6;
    var k = clamp(1 - (S.deadT || 0) / total, 0, 1);   // 0 → 1 за анимацию
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // вспышка
    var flash = clamp(1 - k * 2.4, 0, 1);
    if (flash > 0.01) {
      addGlow(ctx, '#ffffff', px, py, 240 * flash + 40, 0.55 * flash);
      addGlow(ctx, C.rose, px, py, 300 * flash + 60, 0.4 * flash);
    }

    // ударная волна
    var r = 18 + k * 150;
    ctx.globalAlpha = clamp(1 - k, 0, 1) * 0.8;
    ctx.strokeStyle = rgba(C.rose, 0.9);
    ctx.lineWidth = 6 * (1 - k) + 0.6;
    ctx.beginPath(); ctx.arc(px, py, r, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,220,235,0.7)';
    ctx.lineWidth = 2 * (1 - k) + 0.4;
    ctx.beginPath(); ctx.arc(px, py, r * 0.72, 0, TAU); ctx.stroke();

    // осколки корпуса
    for (var i = 0; i < 10; i++) {
      var a = i * TAU / 10 + 0.3;
      var dist = 8 + k * 78;
      var sx = px + Math.cos(a) * dist;
      var sy = py + Math.sin(a) * dist + k * k * 24;
      var sz = 7 * (1 - k * 0.75);
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(a + k * 5);
      ctx.globalAlpha = clamp(1 - k * 1.1, 0, 1);
      ctx.fillStyle = i % 2 ? '#7f93b3' : '#3d4c62';
      ctx.beginPath();
      ctx.moveTo(-sz, -sz * 0.6);
      ctx.lineTo(sz, 0);
      ctx.lineTo(-sz * 0.5, sz * 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  /* ------------------------------ монстры ---------------------------------- */
  function drawMonsters(ctx, S, t) {
    for (var i = 0; i < S.monsters.length; i++) {
      var m = S.monsters[i];
      if (m.dying > 0) drawMonsterDeath(ctx, m, t, i);
      else drawMonster(ctx, S, m, t, i);
    }
  }

  function monsterPalette(m, kind) {
    if (m.scared) {
      return { hot: '#f0f9ff', main: '#bae6fd', deep: '#38bdf8', glow: C.cyanHot };
    }
    if (kind === 'hobbin') return { hot: C.magentaHot, main: C.magenta, deep: C.magentaDeep, glow: C.magenta };
    return { hot: C.cyanHot, main: C.cyan, deep: C.cyanDeep, glow: C.cyan };
  }

  function drawMonster(ctx, S, m, t, idx) {
    var px = FX + m.x * CELL, py = FY + m.y * CELL;
    var p = S.player;
    var pal = monsterPalette(m, m.kind);
    var h = hash2(idx + 7, (m.cx | 0) + 3);
    var spawn = clamp(m.spawnT == null ? 1 : m.spawnT, 0, 1);
    var scale = spawn < 1 ? easeOutBack(spawn) : 1;
    var alpha = spawn < 1 ? clamp(spawn * 1.4, 0, 1) : 1;
    if (scale <= 0.02) return;

    var r = CELL * 0.4;
    var phase = m.walkPhase || 0;
    var wob = Math.sin(phase * 3 + t * 3.4 + idx) * (m.scared ? 1.5 : 1);
    var breathe = 1 + 0.03 * Math.sin(t * 3 + idx * 2);

    addGlow(ctx, pal.glow, px, py, (r * 4.6) * scale, (0.18 + 0.07 * Math.sin(t * 3 + idx)) * alpha);

    // появление: кольцо и вертикальный свет
    if (spawn < 1) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 1 - spawn;
      ctx.strokeStyle = rgba(pal.hot, 0.8);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px, py, r * (0.5 + spawn * 2.2), 0, TAU);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(px, py);
    ctx.scale(scale, scale);
    ctx.globalAlpha = alpha;

    // тело-капля
    var n = 12;
    var pts = [];
    for (var i = 0; i < n; i++) {
      var a = i / n * TAU - Math.PI / 2;
      var rad = r * breathe * (1 + 0.065 * Math.sin(a * 3 + wob) + 0.035 * Math.sin(a * 5 - wob * 1.4));
      pts.push([Math.cos(a) * rad, Math.sin(a) * rad * 1.04]);
    }
    ctx.beginPath();
    var mid = function (p1, p2) { return [(p1[0] + p2[0]) * 0.5, (p1[1] + p2[1]) * 0.5]; };
    var m0 = mid(pts[n - 1], pts[0]);
    ctx.moveTo(m0[0], m0[1]);
    for (i = 0; i < n; i++) {
      var pp = pts[i], nn = pts[(i + 1) % n], mm = mid(pp, nn);
      ctx.quadraticCurveTo(pp[0], pp[1], mm[0], mm[1]);
    }
    ctx.closePath();
    var body = ctx.createRadialGradient(-r * 0.25, -r * 0.35, r * 0.1, 0, 0, r * 1.35);
    body.addColorStop(0, rgba(pal.hot, 0.96));
    body.addColorStop(0.34, rgba(pal.main, 0.9));
    body.addColorStop(0.78, rgba(pal.deep, 0.82));
    body.addColorStop(1, rgba(pal.deep, 0.42));
    ctx.fillStyle = body;
    ctx.fill();
    ctx.strokeStyle = rgba(pal.deep, 0.85);
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // внутреннее свечение ядра
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    var core = ctx.createRadialGradient(0, r * 0.15, 1, 0, r * 0.15, r * 0.85);
    core.addColorStop(0, rgba(pal.hot, 0.32));
    core.addColorStop(1, rgba(pal.hot, 0));
    ctx.fillStyle = core;
    ctx.beginPath(); ctx.arc(0, r * 0.15, r * 0.85, 0, TAU); ctx.fill();
    ctx.restore();

    // биолюминесцентные пятна
    ctx.fillStyle = rgba(pal.hot, 0.5);
    for (i = 0; i < 3; i++) {
      var sa = h * TAU + i * 2.1;
      ctx.beginPath();
      ctx.arc(Math.cos(sa) * r * 0.55, Math.sin(sa) * r * 0.5 + r * 0.1, 1.4 + (i % 2), 0, TAU);
      ctx.fill();
    }

    // хоббин: рожки, гребень, когти
    if (m.kind === 'hobbin' && !m.scared) {
      ctx.fillStyle = rgba(pal.deep, 0.95);
      ctx.beginPath();
      ctx.moveTo(-r * 0.55, -r * 0.78);
      ctx.lineTo(-r * 0.9, -r * 1.35);
      ctx.lineTo(-r * 0.28, -r * 0.95);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(r * 0.55, -r * 0.78);
      ctx.lineTo(r * 0.9, -r * 1.35);
      ctx.lineTo(r * 0.28, -r * 0.95);
      ctx.closePath(); ctx.fill();
      // когти
      for (i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(i * r * 0.34 - 3, r * 0.72);
        ctx.lineTo(i * r * 0.34, r * 1.12);
        ctx.lineTo(i * r * 0.34 + 3, r * 0.72);
        ctx.closePath();
        ctx.fill();
      }
    } else if (!m.scared) {
      // ноббин: лапки
      ctx.fillStyle = rgba(pal.deep, 0.9);
      ctx.beginPath(); ctx.ellipse(-r * 0.42, r * 0.88, 4.5, 3, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(r * 0.42, r * 0.88, 4.5, 3, 0, 0, TAU); ctx.fill();
    }

    // глаза следят за игроком
    var dx = p ? p.x - m.x : 0, dy = p ? p.y - m.y : 0;
    var dd = Math.sqrt(dx * dx + dy * dy) || 1;
    dx /= dd; dy /= dd;
    var eyeDX = dx * r * 0.18, eyeDY = dy * r * 0.18;
    var eyeR = (m.scared ? 6.6 : 5.6) * (r / 19.2);
    var perpX = -dy, perpY = dx;
    var blink = Math.sin(t * 1.3 + h * 20) > 0.985;
    var eyeY = -r * 0.18;

    for (i = -1; i <= 1; i += 2) {
      var ex = i * r * 0.36 + eyeDX * 0.5;
      var ey = eyeY + eyeDY * 0.5;
      if (blink) {
        ctx.strokeStyle = 'rgba(8,30,45,0.8)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(ex - eyeR, ey);
        ctx.lineTo(ex + eyeR, ey);
        ctx.stroke();
      } else {
        ctx.fillStyle = m.scared ? 'rgba(255,255,255,0.97)' : 'rgba(236,254,255,0.96)';
        ctx.beginPath();
        ctx.ellipse(ex, ey, eyeR, eyeR * (m.scared ? 1.12 : 1), 0, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = rgba(pal.deep, 0.55);
        ctx.lineWidth = 0.8;
        ctx.stroke();
        var pupR = m.scared ? eyeR * 0.3 : eyeR * 0.48;
        ctx.fillStyle = '#0b1220';
        ctx.beginPath();
        ctx.arc(ex + dx * eyeR * 0.45, ey + dy * eyeR * 0.45, pupR, 0, TAU);
        ctx.fill();
        if (!m.scared) {
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          ctx.beginPath();
          ctx.arc(ex - pupR * 0.3, ey - pupR * 0.35, pupR * 0.34, 0, TAU);
          ctx.fill();
        }
      }
    }

    // рот
    if (m.scared) {
      ctx.fillStyle = 'rgba(12,40,60,0.6)';
      ctx.beginPath();
      ctx.ellipse(0, r * 0.3, 3.4, 4.2, 0, 0, TAU);
      ctx.fill();
      // испуг: капельки пота
      ctx.fillStyle = 'rgba(186,230,253,0.9)';
      ctx.beginPath();
      ctx.moveTo(-r * 0.62, -r * 0.42);
      ctx.quadraticCurveTo(-r * 0.72, -r * 0.18, -r * 0.55, -r * 0.18);
      ctx.quadraticCurveTo(-r * 0.42, -r * 0.2, -r * 0.62, -r * 0.42);
      ctx.fill();
    } else {
      ctx.strokeStyle = rgba(pal.deep, 0.7);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(0, r * 0.2, r * 0.28, 0.25, Math.PI - 0.25);
      ctx.stroke();
    }

    ctx.restore();

    // «!» у испуганного
    if (m.scared) {
      var bubY = py - r * 1.85 * scale;
      ctx.save();
      ctx.globalAlpha = 0.9;
      fillRR(ctx, px - 7 * scale, bubY - 11 * scale, 14 * scale, 15 * scale, 4 * scale, 'rgba(255,255,255,0.92)');
      ctx.fillStyle = '#9d174d';
      ctx.font = fnt(11 * scale, 800, true);
      ctx.textAlign = 'center';
      ctx.fillText('!', px, bubY + 1.5 * scale);
      ctx.textAlign = 'left';
      ctx.restore();
    }
  }

  function drawMonsterDeath(ctx, m, t, idx) {
    var px = FX + m.x * CELL, py = FY + m.y * CELL;
    var k = 1 - clamp(m.dying / 0.4, 0, 1);       // 0 → 1
    var pal = monsterPalette(m, m.kind);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = clamp(1 - k, 0, 1);
    ctx.strokeStyle = rgba(pal.hot, 0.85);
    ctx.lineWidth = 3 * (1 - k) + 0.5;
    ctx.beginPath();
    ctx.arc(px, py, 12 + k * 44, 0, TAU);
    ctx.stroke();
    for (var i = 0; i < 9; i++) {
      var a = i * TAU / 9 + idx;
      var dist = 6 + k * (24 + (i % 3) * 7);
      ctx.fillStyle = rgba(i % 2 ? pal.main : pal.hot, 0.8 * (1 - k));
      ctx.beginPath();
      ctx.arc(px + Math.cos(a) * dist, py + Math.sin(a) * dist, 2.6 * (1 - k) + 0.5, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  /* ------------------------------ снаряды ---------------------------------- */
  function drawBullets(ctx, S, t) {
    if (!S.bullets || !S.bullets.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < S.bullets.length; i++) {
      var b = S.bullets[i];
      var d = DIRS[b.dir] || [0, -1];
      var px = FX + b.x * CELL, py = FY + b.y * CELL;
      for (var k = 4; k >= 1; k--) {
        ctx.globalAlpha = 0.16 * (5 - k) / 4;
        ctx.drawImage(getGlow(C.cyan, 64), px - d[0] * k * 9 - 10, py - d[1] * k * 9 - 10, 20, 20);
      }
      ctx.globalAlpha = 0.9;
      ctx.drawImage(getGlow(C.cyanHot, 128), px - 26, py - 26, 52, 52);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(px, py, 3.6, 3, Math.atan2(d[1], d[0]), 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  /* ------------------------------ частицы ---------------------------------- */
  function drawParticles(ctx, S) {
    if (!S.particles || !S.particles.length) return;
    var i, p;
    ctx.save();
    for (i = 0; i < S.particles.length; i++) {
      p = S.particles[i];
      var a = clamp(p.life / (p.maxLife || 1), 0, 1);
      var px = FX + p.x * CELL, py = FY + p.y * CELL;
      var size = Math.max(1.2, (p.size || 0.1) * CELL);
      if (p.kind === 'dirt') {
        ctx.globalAlpha = a * 0.9;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(px, py, size * 0.55, 0, TAU);
        ctx.fill();
      } else {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = a * 0.85;
        ctx.drawImage(getGlow(p.color, 32), px - size, py - size, size * 2, size * 2);
        if (p.kind === 'spark' || p.kind === 'gem' || p.kind === 'eat') {
          ctx.globalAlpha = a;
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          ctx.beginPath();
          ctx.arc(px, py, Math.max(0.7, size * 0.28), 0, TAU);
          ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  /* --------------------------- всплывающие очки ---------------------------- */
  function drawPopups(ctx, S) {
    if (!S.popups || !S.popups.length) return;
    ctx.save();
    ctx.textAlign = 'center';
    for (var i = 0; i < S.popups.length; i++) {
      var p = S.popups[i];
      var a = clamp(p.life / (p.maxLife || 1), 0, 1);
      var grow = 1 + (1 - a) * 0.12;
      var px = FX + p.x * CELL, py = FY + p.y * CELL + Math.sin((1 - a) * 3) * 2;
      var col = p.kind === 'bonus' ? C.goldHot : C.emeraldHot;
      var size = p.kind === 'bonus' ? 20 : 17;
      ctx.globalAlpha = a;
      ctx.font = fnt(size * grow, 800, true);
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = 'rgba(3,8,16,0.8)';
      ctx.strokeText(p.text, px, py);
      ctx.fillStyle = col;
      ctx.fillText(p.text, px, py);
    }
    ctx.textAlign = 'left';
    ctx.restore();
  }

  /* ------------------------- эффекты над полем ---------------------------- */
  function drawFieldAmbient(ctx, S, t) {
    // тёплый бонусный свет
    if (S.bonus) {
      var pulse = 0.5 + 0.5 * Math.sin(t * 4.2);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.06 + 0.04 * pulse;
      var bg = ctx.createRadialGradient(FX + FW * 0.5, FY + FH * 0.5, 40, FX + FW * 0.5, FY + FH * 0.5, FW * 0.62);
      bg.addColorStop(0, rgba(C.gold, 0.55));
      bg.addColorStop(0.6, rgba(C.magenta, 0.12));
      bg.addColorStop(1, rgba(C.magenta, 0));
      ctx.fillStyle = bg;
      ctx.fillRect(FX, FY, FW, FH);
      ctx.restore();
    }

    // смерть: вспышка, затем бордовый оттенок
    if (S.mode === 'dying') {
      var k = clamp(1 - (S.deadT || 0) / 1.6, 0, 1);
      var flash = clamp(1 - k * 4.2, 0, 1);
      if (flash > 0.01) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(255,214,235,' + (0.30 * flash) + ')';
        ctx.fillRect(FX, FY, FW, FH);
        ctx.restore();
      }
      ctx.fillStyle = 'rgba(90,12,38,' + (0.08 + 0.16 * (1 - k)) + ')';
      ctx.fillRect(FX, FY, FW, FH);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.06 + 0.04 * (1 - k);
      ctx.drawImage(getGlow(C.rose, 128), FX + FW * 0.5 - FW * 0.62, FY + FH * 0.5 - FW * 0.62, FW * 1.24, FW * 1.24);
      ctx.restore();
    }

    // холодный game over
    if (S.mode === 'gameover') {
      ctx.fillStyle = 'rgba(4,7,14,0.55)';
      ctx.fillRect(FX, FY, FW, FH);
      drawEmbers(ctx, t);
    }

    // глубина: свет сверху, тень снизу
    ctx.fillStyle = V.grads.depth;
    ctx.fillRect(FX, FY, FW, FH);

    // виньетка поля
    ctx.fillStyle = V.grads.innerVignette;
    ctx.fillRect(FX, FY, FW, FH);

    // внутренняя тень от рамки (объём «экрана»)
    ctx.save();
    fieldClip(ctx);
    strokeRR(ctx, FX, FY, FW, FH, FCR, 'rgba(0,0,0,0.55)', 26);
    strokeRR(ctx, FX, FY, FW, FH, FCR, 'rgba(0,0,0,0.38)', 10);
    ctx.restore();

    // стеклянный отблеск сверху
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    var gloss = ctx.createLinearGradient(FX, FY, FX + FW * 0.55, FY + FH * 0.8);
    gloss.addColorStop(0, 'rgba(180,225,255,0.05)');
    gloss.addColorStop(0.35, 'rgba(180,225,255,0.006)');
    gloss.addColorStop(1, 'rgba(180,225,255,0)');
    ctx.fillStyle = gloss;
    ctx.fillRect(FX, FY, FW, FH);
    ctx.restore();
  }

  function drawEmbers(ctx, t) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < 26; i++) {
      var h = hash2(i * 7 + 3, 11);
      var x = FX + ((h * FW + t * (6 + h * 10)) % FW);
      var y = FY + FH - ((t * (10 + h * 16) + h * FH) % FH);
      var a = 0.10 + 0.16 * (0.5 + 0.5 * Math.sin(t * 2 + h * 20));
      ctx.globalAlpha = a;
      ctx.fillStyle = i % 3 ? C.gold : C.rose;
      ctx.beginPath();
      ctx.arc(x, y, 1 + h * 1.6, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawFieldFrame(ctx) {
    ctx.save();
    strokeRR(ctx, FX, FY, FW, FH, FCR, 'rgba(170,220,255,0.20)', 1.2);
    strokeRR(ctx, FX + 1.5, FY + 1.5, FW - 3, FH - 3, FCR - 1.5, 'rgba(120,200,255,0.06)', 1);

    ctx.globalCompositeOperation = 'lighter';
    var brackets = [
      [FX + 2, FY + 2, 1, 1], [FX + FW - 2, FY + 2, -1, 1],
      [FX + 2, FY + FH - 2, 1, -1], [FX + FW - 2, FY + FH - 2, -1, -1]
    ];
    for (var i = 0; i < brackets.length; i++) {
      var b = brackets[i];
      ctx.strokeStyle = rgba(C.cyan, 0.55);
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(b[0] + b[2] * 22, b[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.lineTo(b[0], b[1] + b[3] * 22);
      ctx.stroke();
      ctx.fillStyle = rgba(C.gold, 0.8);
      ctx.beginPath();
      ctx.arc(b[0] + b[2] * 4, b[1] + b[3] * 4, 1.7, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function shakeOffset(S, t) {
    var a = clamp(S.shake || 0, 0, 1);
    if (S.mode === 'dying') a = Math.max(a, clamp((S.deadT || 0) / 1.6, 0, 1) * 0.85);
    if (a <= 0.002) return { x: 0, y: 0 };
    var amp = a * a * 9;
    return {
      x: Math.sin(t * 91) * amp + Math.sin(t * 41.7) * amp * 0.45,
      y: Math.cos(t * 77) * amp + Math.sin(t * 57.3) * amp * 0.4
    };
  }

  function drawField(ctx, S, t) {
    var sh = shakeOffset(S, t);
    ctx.save();
    ctx.translate(sh.x, sh.y);

    drawFieldOuterGlow(ctx);
    ctx.save();
    fieldClip(ctx);

    drawEarth(ctx, S);
    buildGeometry(S);
    drawTunnelGlass(ctx, S, t);
    drawGrid(ctx);
    drawBeam(ctx, S, t);
    drawItems(ctx, S, t);
    drawMonsters(ctx, S, t);
    drawBullets(ctx, S, t);
    drawPlayer(ctx, S, t);
    drawParticles(ctx, S);
    drawPopups(ctx, S);
    drawFieldAmbient(ctx, S, t);

    ctx.restore();
    drawFieldFrame(ctx);
    ctx.restore();
  }

  /* -------------------------------- HUD ------------------------------------ */
  function glassPanel(ctx, x, y, w, h, r, accent, strong) {
    ctx.save();
    rrectPath(ctx, x, y, w, h, r);

    // дымчатое стекло: тёмная основа + голубоватый градиент
    var g = ctx.createLinearGradient(0, y, 0, y + h);
    if (strong) {
      g.addColorStop(0, 'rgba(17,26,44,0.90)');
      g.addColorStop(0.5, 'rgba(10,16,30,0.92)');
      g.addColorStop(1, 'rgba(6,10,19,0.94)');
    } else {
      g.addColorStop(0, 'rgba(23,35,57,0.52)');
      g.addColorStop(0.45, 'rgba(13,21,38,0.60)');
      g.addColorStop(1, 'rgba(8,13,24,0.66)');
    }
    ctx.fillStyle = g;
    ctx.fill();

    // верхний блик
    var hi = ctx.createLinearGradient(0, y, 0, y + Math.min(h * 0.55, 110));
    hi.addColorStop(0, strong ? 'rgba(190,225,255,0.10)' : 'rgba(200,235,255,0.09)');
    hi.addColorStop(1, 'rgba(200,235,255,0)');
    ctx.fillStyle = hi;
    ctx.fill();

    // внутренняя тень у нижней кромки
    var bot = ctx.createLinearGradient(0, y + h - Math.min(h * 0.35, 90), 0, y + h);
    bot.addColorStop(0, 'rgba(0,0,0,0)');
    bot.addColorStop(1, 'rgba(0,0,0,0.22)');
    ctx.fillStyle = bot;
    ctx.fill();

    // рамка
    ctx.strokeStyle = strong ? 'rgba(180,225,255,0.28)' : 'rgba(170,215,255,0.19)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // светлая верхняя кромка
    ctx.beginPath();
    ctx.moveTo(x + r, y + 0.6);
    ctx.lineTo(x + w - r, y + 0.6);
    ctx.strokeStyle = 'rgba(225,245,255,0.34)';
    ctx.lineWidth = 1;
    ctx.stroke();

    if (accent) {
      ctx.save();
      ctx.clip();
      var ag = ctx.createLinearGradient(x, y, x + Math.min(w, 260), y);
      ag.addColorStop(0, rgba(accent, 0.7));
      ag.addColorStop(1, rgba(accent, 0));
      ctx.fillStyle = ag;
      ctx.fillRect(x, y, Math.min(w, 260), 2);
      var ag2 = ctx.createLinearGradient(x, y, x, y + Math.min(h, 200));
      ag2.addColorStop(0, rgba(accent, 0.35));
      ag2.addColorStop(1, rgba(accent, 0));
      ctx.fillStyle = ag2;
      ctx.fillRect(x, y, 2, Math.min(h, 200));
      ctx.restore();
    }
    ctx.restore();
  }

  function dividerH(ctx, x, y, w, color) {
    var g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, color || 'rgba(150,200,255,0)');
    g.addColorStop(0.5, 'rgba(170,215,255,0.16)');
    g.addColorStop(1, color || 'rgba(150,200,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, 1);
  }

  function sideLabel(ctx, text, x, y, align) {
    label(ctx, text, x, y, 8, 600, 'rgba(140,170,205,0.72)', 2.1, align || 'left');
  }

  function ringGauge(ctx, cx, cy, r, frac, color, trackColor, lw) {
    ctx.save();
    ctx.lineWidth = lw || 6;
    ctx.strokeStyle = trackColor || 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.stroke();
    if (frac > 0.001) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = rgba(color, 0.16);
      ctx.lineWidth = (lw || 6) + 5;
      ctx.beginPath();
      ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(frac, 0, 1));
      ctx.stroke();
      ctx.strokeStyle = rgba(color, 0.95);
      ctx.lineWidth = lw || 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(frac, 0, 1));
      ctx.stroke();
      ctx.lineCap = 'butt';
    }
    ctx.restore();
  }

  function miniPod(ctx, x, y, s, color, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s / 24, s / 24);
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(-2, 0, 8.5, 6.5, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(5, -4.6);
    ctx.lineTo(12, 0);
    ctx.lineTo(5, 4.6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(6,20,32,0.35)';
    ctx.beginPath();
    ctx.ellipse(-2, 0, 4.6, 3.8, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function dropIcon(ctx, x, y, r, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.quadraticCurveTo(x + r * 1.05, y, x, y + r);
    ctx.quadraticCurveTo(x - r * 1.05, y, x, y - r);
    ctx.fill();
    ctx.restore();
  }

  function boltIcon(ctx, x, y, s, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x + s * 0.15, y - s * 0.5);
    ctx.lineTo(x - s * 0.35, y + s * 0.08);
    ctx.lineTo(x - s * 0.02, y + s * 0.08);
    ctx.lineTo(x - s * 0.15, y + s * 0.5);
    ctx.lineTo(x + s * 0.38, y - s * 0.1);
    ctx.lineTo(x + s * 0.05, y - s * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function keycap(ctx, x, y, w, h, ch) {
    ctx.save();
    var g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, 'rgba(255,255,255,0.10)');
    g.addColorStop(1, 'rgba(255,255,255,0.035)');
    fillRR(ctx, x, y, w, h, 4, g);
    strokeRR(ctx, x, y, w, h, 4, 'rgba(170,215,255,0.20)', 1);
    ctx.fillStyle = 'rgba(210,232,255,0.85)';
    ctx.font = fnt(9, 600, true);
    ctx.textAlign = 'center';
    ctx.fillText(ch, x + w / 2, y + h / 2 + 3.2);
    ctx.textAlign = 'left';
    ctx.restore();
  }

  function drawTopBar(ctx, S, t) {
    glassPanel(ctx, TOP.x, TOP.y, TOP.w, TOP.h, 16, C.cyan);

    // логотип
    var lx = TOP.x + 22, ly = TOP.y + 24;
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(-0.5);
    var lg = ctx.createLinearGradient(-10, -10, 10, 10);
    lg.addColorStop(0, C.cyanHot);
    lg.addColorStop(1, C.cyan);
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.moveTo(-9, -5); ctx.lineTo(8, 0); ctx.lineTo(-9, 5); ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(251,191,36,0.9)';
    ctx.beginPath();
    ctx.arc(lx + 2, ly - 10, 2.2, 0, TAU);
    ctx.fill();
    addGlow(ctx, C.cyan, lx, ly, 52, 0.16);

    var wordGrad = ctx.createLinearGradient(0, TOP.y + 22, 0, TOP.y + 44);
    wordGrad.addColorStop(0, '#f2fdff');
    wordGrad.addColorStop(0.55, '#9be9ff');
    wordGrad.addColorStop(1, '#3bc9e8');
    ctx.font = fnt(19, 800);
    ctx.fillStyle = wordGrad;
    tracked(ctx, 'DIGGER', TOP.x + 46, TOP.y + 32, 2.2, 'left');
    label(ctx, T('appTagline'), TOP.x + 46, TOP.y + 45, 7.6, 500, 'rgba(150,190,230,0.62)', 1.4);

    // разделители
    ctx.fillStyle = 'rgba(160,205,255,0.10)';
    ctx.fillRect(TOP.x + 182, TOP.y + 10, 1, TOP.h - 20);

    // счёт (слева)
    sideLabel(ctx, T('score'), TOP.x + 200, TOP.y + 18);
    label(ctx, fmt(S.score), TOP.x + 200, TOP.y + 41, 26, 800, C.ink, 0, 'left', true);

    // рекорд (справа, всё выровнено по правому краю панели)
    var recRight = TOP.x + TOP.w - 22;
    ctx.font = fnt(26, 800, true);
    var scoreW = ctx.measureText(fmt(S.score)).width;
    var scoreEnd = TOP.x + 200 + scoreW;
    ctx.font = fnt(20, 700, true);
    var recW = ctx.measureText(fmt(S.hi)).width;
    var recLeft = recRight - recW;
    sideLabel(ctx, T('hiscore'), recRight, TOP.y + 19, 'right');
    label(ctx, fmt(S.hi), recRight, TOP.y + 41, 20, 700, 'rgba(251,191,36,0.94)', 0, 'right', true);

    // бонусный чип — строго между счётом и рекордом, чтобы ничего не наезжало
    if (S.bonus) {
      var bw = clamp(recLeft - scoreEnd - 30, 132, 186);
      var bh = 30;
      var bx = clamp((scoreEnd + recLeft) * 0.5 - bw * 0.5, scoreEnd + 14, recLeft - 14 - bw);
      var by = TOP.y + 9;
      var glowA = 0.24 + 0.12 * Math.sin(t * 5);
      glassPanel(ctx, bx, by, bw, bh, 10, C.gold);
      addGlow(ctx, C.gold, bx + 22, by + bh / 2, 46, glowA);
      label(ctx, T('bonusMode'), bx + 14, by + 20, 10, 800, C.goldHot, 1.4);
      label(ctx, Math.ceil(Math.max(0, S.bonusT)) + '', bx + bw - 14, by + 21, 16, 800, C.goldHot, 0, 'right', true);
      var frac = S.bonusDur > 0 ? clamp(S.bonusT / S.bonusDur, 0, 1) : 0;
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(bx + 12, by + bh - 6, bw - 24, 2);
      ctx.fillStyle = rgba(C.gold, 0.8);
      ctx.fillRect(bx + 12, by + bh - 6, (bw - 24) * frac, 2);
    } else {
      // тонкий разделитель между счётом и рекордом
      ctx.fillStyle = 'rgba(160,205,255,0.09)';
      ctx.fillRect(TOP.x + 560, TOP.y + 10, 1, TOP.h - 20);
    }
  }

  function drawSidebar(ctx, S, t) {
    glassPanel(ctx, SIDE.x, SIDE.y, SIDE.w, SIDE.h, 18, C.emerald);
    var x0 = SIDE.x + 14, x1 = SIDE.x + SIDE.w - 14;
    var wIn = x1 - x0;

    // сечение: УРОВЕНЬ
    sideLabel(ctx, T('level'), x0, SIDE.y + 30);
    var lvGrad = ctx.createLinearGradient(0, SIDE.y + 48, 0, SIDE.y + 92);
    lvGrad.addColorStop(0, '#eafdff');
    lvGrad.addColorStop(0.55, '#8be9ff');
    lvGrad.addColorStop(1, '#22b8d8');
    ctx.font = fnt(38, 800, true);
    ctx.fillStyle = lvGrad;
    tracked(ctx, String(S.level), x0, SIDE.y + 86, 0, 'left');
    addGlow(ctx, C.cyan, x0 + 20, SIDE.y + 72, 70, 0.10);
    // декоративные насечки уровня
    for (var k = 0; k < 5; k++) {
      ctx.fillStyle = k < (S.level % 6) ? rgba(C.cyan, 0.55) : 'rgba(255,255,255,0.08)';
      ctx.fillRect(x1 - 5 - k * 7, SIDE.y + 78, 4, 2);
    }
    dividerH(ctx, x0, SIDE.y + 100, wIn);

    // АЛМАЗЫ
    sideLabel(ctx, T('gems'), x0, SIDE.y + 122);
    var gemsPct = S.gemsTotal > 0 ? clamp((S.gemsTotal - S.gemsLeft) / S.gemsTotal, 0, 1) : 0;
    var gemsText = S.gemsLeft + ' / ' + S.gemsTotal;
    ctx.font = fnt(15, 700, true);
    var gemsW = ctx.measureText(gemsText).width;
    label(ctx, gemsText, x1, SIDE.y + 141, 15, 700,
      S.gemsLeft <= 2 ? C.goldHot : C.ink, 0, 'right', true);
    ctx.drawImage(V.sprites.gem, x1 - gemsW - 26, SIDE.y + 119, 20, 22);
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fillRect(x0, SIDE.y + 150, wIn, 6);
    var gfill = ctx.createLinearGradient(x0, 0, x1, 0);
    gfill.addColorStop(0, C.emeraldDeep);
    gfill.addColorStop(0.6, C.emerald);
    gfill.addColorStop(1, C.emeraldHot);
    ctx.fillStyle = gfill;
    ctx.fillRect(x0, SIDE.y + 150, wIn * gemsPct, 6);
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(x0, SIDE.y + 150, wIn, 1);
    addGlow(ctx, C.emerald, x0 + wIn * gemsPct, SIDE.y + 153, 26, 0.22);
    dividerH(ctx, x0, SIDE.y + 174, wIn);

    // ЖИЗНИ
    sideLabel(ctx, T('lives'), x0, SIDE.y + 196);
    var lives = Math.max(0, S.lives | 0);
    var shown = Math.min(lives, 5);
    for (k = 0; k < shown; k++) {
      miniPod(ctx, x0 + 11 + k * 26, SIDE.y + 218, 21, C.cyan, 0.95);
      addGlow(ctx, C.cyan, x0 + 11 + k * 26, SIDE.y + 218, 26, 0.10);
    }
    if (lives > 5) {
      label(ctx, '\u00d7' + (lives - 5), x1, SIDE.y + 223, 13, 700, C.dim, 0, 'right', true);
    } else if (lives === 0) {
      label(ctx, '\u2014', x0 + 12, SIDE.y + 223, 14, 700, 'rgba(251,113,133,0.6)', 0, 'left', true);
    }
    dividerH(ctx, x0, SIDE.y + 246, wIn);

    // БОНУС
    sideLabel(ctx, T('bonus'), x0, SIDE.y + 268);
    var ringX = SIDE.x + SIDE.w / 2, ringY = SIDE.y + 320, ringR = 30;
    var bFrac = S.bonusDur > 0 ? clamp(S.bonusT / S.bonusDur, 0, 1) : 0;
    if (S.bonus) {
      addGlow(ctx, C.gold, ringX, ringY, 110, 0.16 + 0.06 * Math.sin(t * 5));
      ringGauge(ctx, ringX, ringY, ringR, bFrac, C.gold, 'rgba(251,191,36,0.16)', 5);
      label(ctx, Math.ceil(Math.max(0, S.bonusT)) + '', ringX, ringY + 7, 21, 800, C.goldHot, 0, 'center', true);
    } else {
      ringGauge(ctx, ringX, ringY, ringR, 0, C.gold, 'rgba(255,255,255,0.07)', 4);
      label(ctx, '\u2014', ringX, ringY + 6, 18, 700, 'rgba(150,175,205,0.4)', 0, 'center', true);
    }
    dividerH(ctx, x0, SIDE.y + 366, wIn);

    // ПЕРЕЗАРЯДКА
    sideLabel(ctx, T('recharge').toUpperCase(), x0, SIDE.y + 388);
    var p = S.player || {};
    var smax = p.shootMax || 1.2;
    var charge = clamp(1 - (p.shootCd || 0) / smax, 0, 1);
    var ready = (p.shootCd || 0) <= 0.001;
    var by = SIDE.y + 398;
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fillRect(x0, by, wIn, 9);
    var cg = ctx.createLinearGradient(x0, 0, x1, 0);
    cg.addColorStop(0, C.cyanDeep);
    cg.addColorStop(0.7, C.cyan);
    cg.addColorStop(1, C.cyanHot);
    ctx.fillStyle = cg;
    ctx.fillRect(x0, by, wIn * charge, 9);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(x0, by, wIn * charge, 1.5);
    if (ready) addGlow(ctx, C.cyanHot, x1 - 12, by + 4.5, 30, 0.35 + 0.15 * Math.sin(t * 6));
    boltIcon(ctx, x1 - 8, SIDE.y + 386, 13, ready ? C.cyanHot : 'rgba(140,170,205,0.55)');
    label(ctx, Math.round(charge * 100) + '%', x1, SIDE.y + 424, 9.5, 700,
      ready ? 'rgba(165,243,252,0.85)' : 'rgba(150,175,205,0.6)', 0, 'right', true);
    dividerH(ctx, x0, SIDE.y + 444, wIn);

    // МОНСТРЫ
    sideLabel(ctx, T('monsters'), x0, SIDE.y + 466);
    var alive = 0;
    for (k = 0; k < S.monsters.length; k++) if (S.monsters[k].dying <= 0) alive++;
    var pending = Math.max(0, S.spawnLeft || 0);
    var totalM = alive + pending;
    label(ctx, String(totalM), x0, SIDE.y + 500, 24, 800, C.ink, 0, 'left', true);
    // иконки: живые — светящиеся, будущие — контурные
    var dotN = Math.min(9, totalM);
    for (k = 0; k < dotN; k++) {
      var dx = x0 + 10 + k * 15;
      var dy = SIDE.y + 522;
      if (k < alive) {
        ctx.fillStyle = rgba(C.cyan, 0.85);
        ctx.beginPath(); ctx.arc(dx, dy, 4.2, 0, TAU); ctx.fill();
        addGlow(ctx, C.cyan, dx, dy, 16, 0.25);
        ctx.fillStyle = 'rgba(6,20,32,0.8)';
        ctx.beginPath(); ctx.arc(dx - 1.3, dy - 0.8, 0.9, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(dx + 1.3, dy - 0.8, 0.9, 0, TAU); ctx.fill();
      } else {
        ctx.strokeStyle = 'rgba(170,210,255,0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(dx, dy, 3.6, 0, TAU); ctx.stroke();
      }
    }
    label(ctx, 'ESC / P', x1, SIDE.y + 552, 8, 600, 'rgba(140,170,205,0.45)', 1.4, 'right', true);
  }

  function drawFooter(ctx, S, t) {
    glassPanel(ctx, FOOT.x, FOOT.y, FOOT.w, FOOT.h, 9, C.gold);
    var y = FOOT.y + 5, h = 16;
    var x = FOOT.x + 12;
    var keys = ['\u2190', '\u2191', '\u2193', '\u2192'];
    for (var i = 0; i < keys.length; i++) {
      keycap(ctx, x, y, 18, h, keys[i]);
      x += 21;
    }
    keycap(ctx, x + 4, y, 44, h, 'SPACE');
    keycap(ctx, x + 52, y, 28, h, 'ESC');

    label(ctx, T('footerHint'), FOOT.x + FOOT.w - 12, FOOT.y + 17, 8.6, 500,
      'rgba(150,185,220,0.5)', 0.5, 'right');
  }

  function drawHud(ctx, S, t) {
    drawTopBar(ctx, S, t);
    drawSidebar(ctx, S, t);
    drawFooter(ctx, S, t);
  }

  /* ------------------------------ баннеры ---------------------------------- */
  function drawReadyBanner(ctx, S, t) {
    var progress = clamp(1 - (S.readyT || 0) / 1.8, 0, 1);
    var appear = easeOutCubic(clamp(progress * 3.4, 0, 1));
    var exit = clamp((S.readyT || 0) / 0.24, 0, 1);
    var a = appear * exit;
    if (a <= 0.003) return;

    var cx = FX + FW * 0.5, cy = FY + FH * 0.5 + 4;
    var w = 420, h = 170;
    var scale = 0.9 + 0.1 * appear;

    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(cx, cy + (1 - appear) * 16);
    ctx.scale(scale, scale);

    addGlow(ctx, C.cyan, 0, 0, 520, 0.12);
    // вращающееся кольцо-аура вокруг карточки
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.rotate(t * 0.25);
    ctx.strokeStyle = 'rgba(120,225,255,0.16)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([3, 14]);
    ctx.beginPath();
    ctx.arc(0, 0, 152, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.rotate(-t * 0.25);
    ctx.restore();

    glassPanel(ctx, -w / 2, -h / 2, w, h, 20, C.cyan, true);

    // тонкая внутренняя рамка
    strokeRR(ctx, -w / 2 + 5, -h / 2 + 5, w - 10, h - 10, 16, 'rgba(160,220,255,0.10)', 1);

    // маленький ромб-иконка
    ctx.save();
    ctx.translate(0, -h / 2 + 22);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = rgba(C.cyan, 0.16);
    ctx.fillRect(-7, -7, 14, 14);
    ctx.strokeStyle = rgba(C.cyanHot, 0.7);
    ctx.lineWidth = 1.2;
    ctx.strokeRect(-7, -7, 14, 14);
    ctx.restore();

    label(ctx, T('ready'), 0, -h / 2 + 44, 8.6, 700, 'rgba(165,243,252,0.78)', 3.4, 'center');

    var intro = T('levelIntro', { n: S.level });
    var grad = ctx.createLinearGradient(-140, 0, 140, 0);
    grad.addColorStop(0, '#eafdff');
    grad.addColorStop(0.5, '#ffffff');
    grad.addColorStop(1, '#8be9ff');
    ctx.font = fnt(33, 800);
    ctx.fillStyle = grad;
    tracked(ctx, intro, 0, 8, 1.5, 'center');

    // растущая линия
    var lw = 120 * appear;
    ctx.fillStyle = 'rgba(34,211,238,0.55)';
    ctx.fillRect(-lw / 2, 26, lw, 1.6);
    ctx.fillStyle = 'rgba(251,191,36,0.85)';
    ctx.fillRect(-1.5, 24, 3, 5.6);

    // пульсирующие точки
    for (var i = 0; i < 3; i++) {
      var ph = (t * 1.8 + i * 0.33) % 1;
      ctx.globalAlpha = a * (0.25 + 0.6 * Math.sin(ph * Math.PI));
      ctx.fillStyle = C.cyanHot;
      ctx.beginPath();
      ctx.arc(-14 + i * 14, 50, 2.2, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawLevelClearBanner(ctx, S, t) {
    var progress = clamp(1 - (S.clearT || 0) / 2, 0, 1);
    var appear = easeOutCubic(clamp(progress * 3.4, 0, 1));
    var exit = clamp((S.clearT || 0) / 0.32, 0, 1);
    var a = appear * exit;
    if (a <= 0.003) return;

    var cx = FX + FW * 0.5, cy = FY + FH * 0.5 + 4;
    var w = 466, h = 178;
    var scale = 0.92 + 0.08 * appear;

    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    addGlow(ctx, C.gold, 0, 0, 480, 0.14);
    glassPanel(ctx, -w / 2, -h / 2, w, h, 22, C.gold, true);
    strokeRR(ctx, -w / 2 + 6, -h / 2 + 6, w - 12, h - 12, 17, 'rgba(255,225,160,0.12)', 1);

    ctx.font = fnt(23, 800);
    ctx.fillStyle = '#f0feff';
    tracked(ctx, T('levelCleared', { n: S.level }), 0, -h / 2 + 54, 1.4, 'center');

    label(ctx, '+1000', 0, 20, 34, 800, C.goldHot, 0, 'center', true);
    addGlow(ctx, C.gold, 0, 8, 170, 0.20 + 0.07 * Math.sin(t * 4));

    var lw = 150 * appear;
    ctx.fillStyle = 'rgba(251,191,36,0.65)';
    ctx.fillRect(-lw / 2, -h / 2 + 74, lw, 1.4);
    label(ctx, T('score') + '  ' + fmt(S.score), 0, 56, 9, 600, 'rgba(170,205,240,0.72)', 2, 'center');
    ctx.restore();

    // золотые лучи и конфетти — только в пределах поля
    ctx.save();
    fieldClip(ctx);
    ctx.translate(cx, cy);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.rotate(t * 0.12);
    for (var i = 0; i < 16; i++) {
      var ang = i * TAU / 16;
      ctx.globalAlpha = 0.045 + 0.03 * Math.sin(t * 2 + i);
      ctx.fillStyle = i % 2 ? C.gold : C.cyan;
      ctx.beginPath();
      ctx.moveTo(Math.cos(ang) * 108, Math.sin(ang) * 108);
      ctx.lineTo(Math.cos(ang + 0.045) * 250, Math.sin(ang + 0.045) * 250);
      ctx.lineTo(Math.cos(ang - 0.045) * 250, Math.sin(ang - 0.045) * 250);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    for (i = 0; i < 26; i++) {
      var ch = hash2(i * 13 + 5, 29);
      var px2 = (ch - 0.5) * FW * 0.92;
      var fall = ((t * (26 + ch * 40) + ch * 380) % 430);
      var py2 = -FH * 0.5 + fall;
      ctx.save();
      ctx.translate(px2, py2);
      ctx.rotate(t * (1 + ch) + ch * 6);
      ctx.globalAlpha = 0.5 + 0.4 * Math.sin(t * 3 + ch * 10);
      ctx.fillStyle = i % 3 === 0 ? C.cyanHot : (i % 3 === 1 ? C.goldHot : C.emeraldHot);
      ctx.fillRect(-1.6, -3.4, 3.2, 6.8);
      ctx.restore();
    }
    ctx.restore();
  }

  function drawPauseOverlay(ctx, S, t) {
    // Текст и панель рисует DOM-оверлей (§5); здесь — только мягкое затемнение.
    var pulse = 0.5 + 0.5 * Math.sin((S.time || t) * 1.4);
    ctx.save();
    ctx.fillStyle = 'rgba(3,6,12,' + (0.26 + 0.03 * pulse) + ')';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  function drawGameOverOverlay(ctx, S, t) {
    // «ИГРА ОКОНЧЕНА» рисует DOM-оверлей (§5). Здесь — мягкая затемняющая дымка,
    // чтобы сквозь неё читались мир, HUD и particles.
    ctx.save();
    var g = ctx.createRadialGradient(W * 0.5, H * 0.46, 160, W * 0.5, H * 0.5, 760);
    g.addColorStop(0, 'rgba(3,6,12,0.18)');
    g.addColorStop(0.55, 'rgba(3,6,12,0.30)');
    g.addColorStop(1, 'rgba(2,4,9,0.48)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  /* ------------------------------ виньетка -------------------------------- */
  function drawVignette(ctx) {
    ctx.save();
    ctx.fillStyle = V.grads.vignette;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  /* ------------------------------- главный -------------------------------- */
  function draw(ctx, S) {
    if (!ctx || !S || !S.grid || !S.player) return;
    initCache(ctx);
    var t = S.time || 0;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';

    drawBackdrop(ctx, t);

    if (S.mode === 'title') {
      // Титульную панель рисует DOM-оверлей; канвас — живой фон: поле, HUD, виньетка.
      drawField(ctx, S, t);
      ctx.save();
      ctx.fillStyle = 'rgba(4,7,13,0.20)';
      ctx.fillRect(FX, FY, FW, FH);
      ctx.restore();
      drawHud(ctx, S, t);
      drawVignette(ctx);
      if (S.paused) drawPauseOverlay(ctx, S, t);
      ctx.restore();
      return;
    }

    drawField(ctx, S, t);
    drawHud(ctx, S, t);

    if (S.mode === 'ready') drawReadyBanner(ctx, S, t);
    else if (S.mode === 'levelclear') drawLevelClearBanner(ctx, S, t);

    drawVignette(ctx);

    if (S.mode === 'gameover') drawGameOverOverlay(ctx, S, t);
    else if (S.paused) drawPauseOverlay(ctx, S, t);

    ctx.restore();
  }

  DG.render.modern = { id: 'modern', draw: draw };
})(window);
