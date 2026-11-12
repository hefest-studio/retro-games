/* ============================================================
   НЕОН × ЯРОСТЬ: NEON RAGE
   src/render-modern.js — «неоновый ремастер»: Canvas 2D, 480×270
   ------------------------------------------------------------
   window.DD_RENDER_MODERN = { draw(ctx, view) }
   Читает DD.state / DD.settings / DD.t. Не мутирует состояние.
   ES2019, IIFE, без импортов и внешних ассетов.
   ============================================================ */
(function () {
  'use strict';

  var W = 480, H = 270;
  var PI = Math.PI, TAU = PI * 2;

  /* ---------- палитра ---------- */
  var C = {
    ink0: '#04030b', ink1: '#070515', ink2: '#0b0820', ink3: '#120d2e', ink4: '#1b1440',
    night: '#05040f', deep: '#0a0718',
    pink: '#ff2e88', pink2: '#ff5fa8', magenta: '#e8179c',
    cyan: '#22e6ff', cyan2: '#8ff6ff',
    lime: '#b6ff3a', lime2: '#e2ff9c',
    amber: '#ffb300', amber2: '#ffd76b',
    violet: '#8b5cff', violet2: '#c3a8ff',
    red: '#ff3b57', orange: '#ff8a1f',
    white: '#f4f0ff', silver: '#c9c6e0', dim: '#6b6790'
  };

  var F_DISPLAY = 'Impact, "Arial Black", "Arial Bold", Arial, sans-serif';
  var F_SANS = 'Arial, "Helvetica Neue", ui-sans-serif, sans-serif';
  var F_MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

  /* ---------- математика ---------- */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeOut(t) { return 1 - (1 - t) * (1 - t); }
  function easeIn(t) { return t * t; }
  function pulse(t, s) { return 0.5 + 0.5 * Math.sin(t * (s || 1)); }
  function hash(n) { var s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
  function hash2(n) { var s = Math.sin(n * 269.5 + 183.3) * 24634.6345; return s - Math.floor(s); }
  function rgba(hex, a) {
    if (hex.charAt(0) !== '#') return hex;
    var v = hex.length === 4
      ? parseInt(hex.charAt(1) + hex.charAt(1) + hex.charAt(2) + hex.charAt(2) + hex.charAt(3) + hex.charAt(3), 16)
      : parseInt(hex.slice(1), 16);
    var r = (v >> 16) & 255, g = (v >> 8) & 255, b = v & 255;
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  /* ---------- доступ к DD ---------- */
  function DS() { return (typeof window !== 'undefined' && window.DD && window.DD.state) || {}; }
  function DSet() { return (typeof window !== 'undefined' && window.DD && window.DD.settings) || {}; }
  function tt(key, vars) {
    var D = (typeof window !== 'undefined' && window.DD) || null;
    if (D && typeof D.t === 'function') {
      try { var s = D.t(key, vars); if (s != null) return String(s); } catch (e) { /* ignore */ }
    }
    return String(key);
  }
  function fmt(n) {
    n = Math.floor(Number(n) || 0);
    var s = String(n), out = '';
    for (var i = 0; i < s.length; i++) {
      if (i > 0 && (s.length - i) % 3 === 0) out += ' ';
      out += s.charAt(i);
    }
    return out;
  }
  function fmtTime(sec) {
    sec = Math.max(0, Math.floor(Number(sec) || 0));
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  /* ---------- холст / кеши ---------- */
  var ctxRef = null;
  var gcache = Object.create(null);
  var mcache = Object.create(null);
  var noiseCanvas = null;

  function resetCaches(ctx) {
    ctxRef = ctx;
    gcache = Object.create(null);
    mcache = Object.create(null);
  }
  function useCtx(ctx) { if (ctxRef !== ctx) resetCaches(ctx); }

  /** Трансформация контекста входит в ключ кеша: градиент привязан к CTM. */
  function xf(ctx) {
    if (!ctx.getTransform) return '1';
    var m = ctx.getTransform();
    return (Math.round(m.a * 100) / 100) + ',' + (Math.round(m.e * 10) / 10) + ',' + (Math.round(m.f * 10) / 10);
  }
  function lg(ctx, x0, y0, x1, y1, stops) {
    var key = 'l' + [x0, y0, x1, y1].join(',') + '|' + stops.join(';') + '|' + xf(ctx);
    var g = gcache[key];
    if (!g) {
      g = ctx.createLinearGradient(x0, y0, x1, y1);
      for (var i = 0; i < stops.length; i += 2) g.addColorStop(clamp(stops[i], 0, 1), stops[i + 1]);
      gcache[key] = g;
    }
    return g;
  }
  function rg(ctx, x0, y0, r0, x1, y1, r1, stops) {
    var key = 'r' + [x0, y0, r0, x1, y1, r1].join(',') + '|' + stops.join(';') + '|' + xf(ctx);
    var g = gcache[key];
    if (!g) {
      g = ctx.createRadialGradient(x0, y0, r0, x1, y1, r1);
      for (var i = 0; i < stops.length; i += 2) g.addColorStop(clamp(stops[i], 0, 1), stops[i + 1]);
      gcache[key] = g;
    }
    return g;
  }

  /* ---------- пути ---------- */
  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r == null ? 3 : r, Math.abs(w) / 2, Math.abs(h) / 2);
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
  function cutPath(ctx, x, y, w, h, c) {
    c = c || 6;
    ctx.beginPath();
    ctx.moveTo(x + c, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + h - c);
    ctx.lineTo(x + w - c, y + h);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x, y + c);
    ctx.closePath();
  }
  function poly(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (var i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
  }
  function line(ctx, x1, y1, x2, y2, color, w, cap) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = color;
    ctx.lineWidth = w || 1;
    ctx.lineCap = cap || 'round';
    ctx.stroke();
  }

  /* ---------- текст ---------- */
  function measure(ctx, s, size, weight, fam, italic) {
    var key = (italic ? 'i' : '') + weight + '|' + size + '|' + fam + '|' + s;
    var v = mcache[key];
    if (v == null) {
      ctx.save();
      ctx.font = (italic ? 'italic ' : '') + weight + ' ' + size + 'px ' + fam;
      v = ctx.measureText(s).width;
      ctx.restore();
      mcache[key] = v;
    }
    return v;
  }

  /**
   * drawText — единый рендер текста.
   * o: { size, weight, fam, italic, spacing, align, base, color, alpha,
   *      glow, blur, glowAlpha, stroke, strokeW, shadowY, grad:[..], gradY:[y0,y1] }
   */
  function drawText(ctx, s, x, y, o) {
    if (s == null || s === '') return;
    o = o || {};
    var size = o.size || 10, weight = o.weight || 700, fam = o.fam || F_SANS;
    ctx.save();
    ctx.font = (o.italic ? 'italic ' : '') + weight + ' ' + size + 'px ' + fam;
    ctx.textAlign = o.align || 'center';
    ctx.textBaseline = o.base || 'middle';
    if (o.spacing) ctx.letterSpacing = o.spacing + 'px';
    if (o.alpha != null) ctx.globalAlpha *= clamp(o.alpha, 0, 1);
    var fill = o.color || C.white;
    var grad = null;
    if (o.grad) {
      var y0 = o.gradY ? o.gradY[0] : y - size * 0.85;
      var y1 = o.gradY ? o.gradY[1] : y + size * 0.25;
      var gst = [], gn = o.grad.length;
      for (var gi = 0; gi < gn; gi++) {
        gst.push(gn === 1 ? 0 : gi / (gn - 1), o.grad[gi]);
      }
      grad = lg(ctx, x - size, y0, x + size, y1, gst);
      fill = grad;
    }
    if (o.glow) {
      ctx.shadowColor = o.glow;
      ctx.shadowBlur = o.blur != null ? o.blur : 12;
      ctx.fillStyle = o.glowColor || o.glow;
      ctx.globalAlpha *= o.glowAlpha != null ? o.glowAlpha : 0.85;
      ctx.fillText(s, x, y);
      ctx.globalAlpha = (o.alpha != null ? clamp(o.alpha, 0, 1) : 1);
      ctx.shadowBlur = 0;
    }
    if (o.stroke) {
      ctx.lineWidth = o.strokeW || 2;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = o.stroke;
      ctx.strokeText(s, x, y);
    }
    ctx.fillStyle = fill;
    ctx.fillText(s, x, y);
    ctx.restore();
  }

  function wrapLines(ctx, text, maxW, size, weight, fam) {
    if (!text) return [];
    var words = String(text).split(/\s+/), lines = [], cur = '';
    for (var i = 0; i < words.length; i++) {
      var test = cur ? cur + ' ' + words[i] : words[i];
      if (measure(ctx, test, size, weight || 400, fam || F_SANS) <= maxW || !cur) {
        cur = test;
      } else {
        lines.push(cur); cur = words[i];
      }
    }
    if (cur) lines.push(cur);
    return lines;
  }

  function fitSize(ctx, s, maxW, size, weight, fam, min) {
    var sz = size;
    min = min || 5;
    while (sz > min && measure(ctx, s, sz, weight || 700, fam || F_SANS) > maxW) sz -= 0.5;
    return sz;
  }

  /* ---------- «стеклянные» панели ---------- */
  /** o: {accent, fillA, fillB, border, cut, glow, alpha, gloss, top} */
  function glass(ctx, x, y, w, h, o) {
    o = o || {};
    var cut = o.cut == null ? 7 : o.cut;
    var alpha = o.alpha == null ? 1 : o.alpha;
    ctx.save();
    ctx.globalAlpha *= alpha;
    cutPath(ctx, x, y, w, h, cut);
    ctx.fillStyle = lg(ctx, x, y, x, y + h, [
      0, o.fillA || 'rgba(10,12,34,0.95)',
      0.55, 'rgba(6,7,22,0.93)',
      1, o.fillB || 'rgba(4,4,16,0.96)'
    ]);
    ctx.fill();
    // стеклянный блик сверху
    ctx.save();
    ctx.clip();
    ctx.fillStyle = lg(ctx, x, y, x, y + h * 0.5, [0, 'rgba(255,255,255,0.13)', 1, 'rgba(255,255,255,0)']);
    ctx.fillRect(x, y, w, h * 0.5);
    // диагональный отблеск
    ctx.fillStyle = lg(ctx, x, y, x + w, y + h, [0, 'rgba(255,255,255,0)', 0.48, 'rgba(255,255,255,0.055)', 0.52, 'rgba(255,255,255,0)', 1, 'rgba(255,255,255,0)']);
    ctx.fillRect(x, y, w, h);
    if (o.top !== false) {
      ctx.fillStyle = o.accent || C.cyan;
      ctx.globalAlpha = 0.75;
      ctx.fillRect(x + cut, y + 0.5, w - cut * 1.4, 1);
    }
    ctx.restore();
    cutPath(ctx, x, y, w, h, cut);
    ctx.strokeStyle = o.border || 'rgba(255,255,255,0.16)';
    ctx.lineWidth = o.borderW || 1;
    ctx.stroke();
    if (o.accent) {
      ctx.strokeStyle = o.accent;
      ctx.globalAlpha *= 0.85;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x + cut, y);
      ctx.lineTo(x + w * 0.42, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + w, y + h - cut);
      ctx.lineTo(x + w, y + h * 0.66);
      ctx.stroke();
    }
    if (o.glow) {
      cutPath(ctx, x, y, w, h, cut);
      ctx.shadowColor = o.glow;
      ctx.shadowBlur = o.glowBlur || 10;
      ctx.strokeStyle = rgba(o.glow, 0.5);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ---------- полосы ---------- */
  /** o: {accent, accent2, back, h, glow, ticks, ghost(fraction), alpha, radius} */
  function bar(ctx, x, y, w, h, pct, o) {
    o = o || {};
    pct = clamp(pct == null ? 0 : pct, 0, 1);
    var r = o.radius == null ? h / 2 : o.radius;
    ctx.save();
    ctx.globalAlpha *= o.alpha == null ? 1 : o.alpha;
    rr(ctx, x, y, w, h, r);
    ctx.fillStyle = o.back || 'rgba(6,8,22,0.85)';
    ctx.fill();
    ctx.save();
    rr(ctx, x, y, w, h, r);
    ctx.clip();
    if (pct > 0.002) {
      var gw = Math.max(1, w * pct);
      ctx.fillStyle = lg(ctx, x, y, x + w, y, [
        0, o.accent2 || o.accent || C.lime,
        0.55, o.accent || C.lime,
        1, o.accent2 || C.lime
      ]);
      if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = o.glowBlur || 8; }
      ctx.fillRect(x, y, gw, h);
      ctx.shadowBlur = 0;
      // блик
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fillRect(x, y, gw, Math.max(1, h * 0.34));
      if (o.ghost) {
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(x + w * clamp(o.ghost, 0, 1), y, Math.max(0, w * (1 - clamp(o.ghost, 0, 1))), h);
      }
      if (o.ticks) {
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        for (var i = 1; i < o.ticks; i++) ctx.fillRect(x + (w / o.ticks) * i, y, 1, h);
      }
    }
    ctx.restore();
    rr(ctx, x, y, w, h, r);
    ctx.strokeStyle = o.border || 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  /* ---------- иконки ---------- */
  function chevron(ctx, x, y, dir, size, color) {
    ctx.save();
    ctx.strokeStyle = color || C.white;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    if (dir === 'left') { ctx.moveTo(x + size * 0.5, y - size); ctx.lineTo(x - size * 0.4, y); ctx.lineTo(x + size * 0.5, y + size); }
    else { ctx.moveTo(x - size * 0.5, y - size); ctx.lineTo(x + size * 0.4, y); ctx.lineTo(x - size * 0.5, y + size); }
    ctx.stroke();
    ctx.restore();
  }
  function lifeIcon(ctx, x, y, s, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s / 10, s / 10);
    ctx.fillStyle = color || C.cyan;
    ctx.beginPath();
    ctx.moveTo(0, 4.4);
    ctx.bezierCurveTo(-2.6, 1.6, -5.6, -0.4, -5.6, -2.8);
    ctx.bezierCurveTo(-5.6, -4.8, -4, -6, -2.4, -6);
    ctx.bezierCurveTo(-1.2, -6, -0.4, -5.4, 0, -4.6);
    ctx.bezierCurveTo(0.4, -5.4, 1.2, -6, 2.4, -6);
    ctx.bezierCurveTo(4, -6, 5.6, -4.8, 5.6, -2.8);
    ctx.bezierCurveTo(5.6, -0.4, 2.6, 1.6, 0, 4.4);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.ellipse(-2.3, -2.6, 1.3, 1, -0.5, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  function starGlyph(ctx, x, y, r, color, alpha) {
    ctx.save();
    ctx.globalAlpha *= alpha == null ? 1 : alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var a = -PI / 2 + i * PI / 5;
      var rad = i % 2 === 0 ? r : r * 0.44;
      var px = x + Math.cos(a) * rad, py = y + Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  function keycap(ctx, x, y, w, h, label, color, o) {
    o = o || {};
    rr(ctx, x, y, w, h, o.r == null ? 2.5 : o.r);
    ctx.fillStyle = o.fill || 'rgba(10,12,30,0.9)';
    ctx.fill();
    ctx.strokeStyle = o.border || 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = color || C.white;
    ctx.fillRect(x + 2, y + h - 3, w - 4, 1);
    var sz = fitSize(ctx, label, w - 4, o.size || 7, 700, F_MONO, 5);
    drawText(ctx, label, x + w / 2, y + h / 2 + 0.5, { size: sz, weight: 700, fam: F_MONO, color: color || C.white, align: 'center' });
  }

  /* ---------- фон-оверлеи ---------- */
  function vignette(ctx) {
    ctx.fillStyle = rg(ctx, W / 2, H * 0.52, H * 0.28, W / 2, H * 0.52, H * 0.86, [
      0, 'rgba(0,0,0,0)',
      0.62, 'rgba(0,0,0,0.05)',
      1, 'rgba(3,2,10,0.62)'
    ]);
    ctx.fillRect(0, 0, W, H);
    // нижний световой клин
    ctx.fillStyle = lg(ctx, 0, H - 26, 0, H, [0, 'rgba(4,3,12,0)', 1, 'rgba(3,2,9,0.55)']);
    ctx.fillRect(0, H - 26, W, 26);
  }

  function buildNoise() {
    var n = 96;
    var cv = document.createElement('canvas');
    cv.width = n; cv.height = n;
    var c = cv.getContext('2d');
    var img = c.createImageData(n, n);
    for (var i = 0; i < img.data.length; i += 4) {
      var v = Math.random();
      img.data[i] = 255; img.data[i + 1] = 255; img.data[i + 2] = 255;
      img.data[i + 3] = v < 0.5 ? 0 : Math.floor(v * 46);
    }
    c.putImageData(img, 0, 0);
    noiseCanvas = cv;
  }

  function grain(ctx, t) {
    if (!noiseCanvas) buildNoise();
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.globalCompositeOperation = 'overlay';
    var pat = ctx.createPattern(noiseCanvas, 'repeat');
    var ox = Math.floor(hash(Math.floor(t * 12)) * 96);
    var oy = Math.floor(hash2(Math.floor(t * 12)) * 96);
    ctx.translate(-ox, -oy);
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, W + 96, H + 96);
    ctx.restore();
  }

  function scanSoft(ctx) {
    ctx.save();
    ctx.globalAlpha = 0.055;
    ctx.fillStyle = '#000';
    for (var y = 0; y < H; y += 2) ctx.fillRect(0, y, W, 1);
    ctx.restore();
  }

  /* ---------- рамочные элементы кадра ---------- */
  function frameOverlays(ctx, st, t) {
    vignette(ctx);
    // тонкая неоновая кромка кадра
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = lg(ctx, 0, 0, W, 0, [0, 'rgba(255,46,136,0)', 0.2, 'rgba(255,46,136,0.5)', 0.8, 'rgba(34,230,255,0.5)', 1, 'rgba(34,230,255,0)']);
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
    ctx.restore();
  }

  /* ---------- вспомогательное: рамка меню ---------- */
  function menuRect(list, index) {
    if (!list || !list.length) return null;
    return list[clamp(index, 0, list.length - 1)];
  }

  var DEF_UI = {
    menu: [
      { x: 160, y: 164, w: 160, h: 18, action: 'play' },
      { x: 160, y: 185, w: 160, h: 18, action: 'help' },
      { x: 160, y: 206, w: 160, h: 18, action: 'settings' },
      { x: 160, y: 227, w: 160, h: 18, action: 'about' }
    ],
    quick: [
      { x: 250, y: 8, w: 52, h: 13, action: 'gfx' },
      { x: 306, y: 8, w: 52, h: 13, action: 'lang' },
      { x: 362, y: 8, w: 52, h: 13, action: 'music' },
      { x: 418, y: 8, w: 52, h: 13, action: 'fullscreen' }
    ],
    pause: [
      { x: 160, y: 112, w: 160, h: 18, action: 'resume' },
      { x: 160, y: 133, w: 160, h: 18, action: 'settings' },
      { x: 160, y: 154, w: 160, h: 18, action: 'restart' },
      { x: 160, y: 175, w: 160, h: 18, action: 'title' }
    ],
    settings: [
      { x: 96, y: 76, w: 288, h: 15, id: 'lang' },
      { x: 96, y: 93, w: 288, h: 15, id: 'gfx' },
      { x: 96, y: 110, w: 288, h: 15, id: 'music' },
      { x: 96, y: 127, w: 288, h: 15, id: 'audioStyle' },
      { x: 96, y: 144, w: 288, h: 15, id: 'sfx' },
      { x: 96, y: 161, w: 288, h: 15, id: 'volume' },
      { x: 96, y: 178, w: 288, h: 15, id: 'crt' },
      { x: 96, y: 195, w: 288, h: 15, id: 'difficulty' },
      { x: 96, y: 212, w: 288, h: 15, id: 'reset' }
    ],
    chars: [
      { x: 36, y: 52, w: 198, h: 150, index: 0 },
      { x: 246, y: 52, w: 198, h: 150, index: 1 }
    ],
    diffs: [
      { x: 112, y: 214, w: 76, h: 14, index: 0 },
      { x: 196, y: 214, w: 76, h: 14, index: 1 },
      { x: 280, y: 214, w: 76, h: 14, index: 2 }
    ],
    end: [
      { x: 170, y: 188, w: 140, h: 18, action: 'retry' },
      { x: 170, y: 210, w: 140, h: 18, action: 'title' }
    ],
    back: { x: 364, y: 248, w: 104, h: 14 },
    selectStart: { x: 180, y: 242, w: 120, h: 16 }
  };
  function UI() {
    var u = DS().uiRects || {};
    function pick(k) { return (u[k] && u[k].length !== 0) || (u[k] && !Array.isArray(u[k]) && u[k].x != null) ? u[k] : DEF_UI[k]; }
    return {
      menu: pick('menu'), quick: pick('quick'), pause: pick('pause'), settings: pick('settings'),
      chars: pick('chars'), diffs: pick('diffs'), end: pick('end'), back: pick('back'),
      selectStart: pick('selectStart')
    };
  }

  /* ============================================================
     СПРАЙТЫ СВЕТА (кеш радиальных градиентов)
     ============================================================ */
  var spriteCache = Object.create(null);

  function makeCanvas(w, h) {
    var cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.ceil(w));
    cv.height = Math.max(1, Math.ceil(h));
    return cv;
  }

  function glowSprite(color) {
    var key = 'g' + color;
    var cv = spriteCache[key];
    if (!cv) {
      cv = makeCanvas(64, 64);
      var c = cv.getContext('2d');
      var g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, rgba(color, 1));
      g.addColorStop(0.22, rgba(color, 0.55));
      g.addColorStop(0.55, rgba(color, 0.18));
      g.addColorStop(1, rgba(color, 0));
      c.fillStyle = g;
      c.fillRect(0, 0, 64, 64);
      spriteCache[key] = cv;
    }
    return cv;
  }

  function drawGlow(ctx, x, y, r, color, alpha, comp) {
    if (r <= 0 || alpha <= 0) return;
    var s = glowSprite(color);
    ctx.save();
    if (comp) ctx.globalCompositeOperation = comp;
    ctx.globalAlpha *= clamp(alpha, 0, 1);
    ctx.drawImage(s, x - r, y - r, r * 2, r * 2);
    ctx.restore();
  }

  function smokeSprite() {
    var cv = spriteCache.smoke;
    if (!cv) {
      cv = makeCanvas(64, 64);
      var c = cv.getContext('2d');
      var g = c.createRadialGradient(30, 32, 2, 32, 32, 30);
      g.addColorStop(0, 'rgba(255,255,255,0.55)');
      g.addColorStop(0.45, 'rgba(255,255,255,0.22)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 64, 64);
      // неровный край
      c.globalCompositeOperation = 'destination-out';
      for (var i = 0; i < 7; i++) {
        var a = i * 0.9;
        c.globalAlpha = 0.30;
        c.beginPath();
        c.arc(32 + Math.cos(a) * 19, 32 + Math.sin(a) * 19, 8 + hash(i) * 7, 0, TAU);
        c.fill();
      }
      spriteCache.smoke = cv;
    }
    return cv;
  }

  function drawSmoke(ctx, x, y, r, color, alpha, rot) {
    var s = smokeSprite();
    ctx.save();
    ctx.globalAlpha *= clamp(alpha, 0, 1);
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(s, -r, -r, r * 2, r * 2);
    if (color && color !== '#ffffff') {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.globalAlpha *= 0.16;
      ctx.fillStyle = color;
      ctx.fillRect(-r, -r, r * 2, r * 2);
    }
    ctx.restore();
  }

  /* ============================================================
     ДАННЫЕ ФОНОВ
     ============================================================ */
  var ZC = [
    { /* НЕОНОВЫЙ ПРОСПЕКТ */
      skyTop: '#02020b', skyMid: '#0a0622', skyLow: '#24103a', horizon: '#6b1d4a',
      far: '#1e163e', mid: '#0f0a24', near: '#07040f',
      accent: C.pink, accent2: C.cyan, haze: '#ff2e88', fog: '#8b6bff',
      groundTop: '#0e0b1d', groundLow: '#04030a', curb: '#1a1437',
      rain: 0.9, moon: 1, cityDots: 0, arena: 0
    },
    { /* АРКАДНЫЙ ПЕРЕУЛОК */
      skyTop: '#010207', skyMid: '#04101a', skyLow: '#082430', horizon: '#0d3a40',
      far: '#0a1823', mid: '#060e16', near: '#02040a',
      accent: C.lime, accent2: C.cyan, haze: '#b6ff3a', fog: '#22e6ff',
      groundTop: '#08111a', groundLow: '#03060b', curb: '#0c1f27',
      rain: 0.4, moon: 0, cityDots: 0, arena: 0
    },
    { /* КРЫША «ТОКСИК» */
      skyTop: '#02010a', skyMid: '#0a0726', skyLow: '#1e0f40', horizon: '#5e1a6c',
      far: '#211343', mid: '#0d0820', near: '#04030d',
      accent: C.violet, accent2: C.pink, haze: '#ff2e88', fog: '#8b5cff',
      groundTop: '#0c0a1b', groundLow: '#04030e', curb: '#15102a',
      rain: 1.25, moon: 0.3, cityDots: 1, arena: 1
    }
  ];

  /** Средняя позиция камеры в зоне — якорь для экранных вывесок. */
  var CAM_MID = [140, 900, 1620];

  function zoneIdx(st) {
    var z = st.run && st.run.zone;
    if (z == null) {
      var p = st.player;
      z = p ? Math.floor((p.x || 0) / 760) : 0;
    }
    return clamp(z | 0, 0, 2);
  }

  function shade(hex, amt) {
    var v = parseInt(hex.slice(1), 16);
    var r = (v >> 16) & 255, g = (v >> 8) & 255, b = v & 255;
    if (amt >= 0) {
      r = Math.round(r + (255 - r) * amt);
      g = Math.round(g + (255 - g) * amt);
      b = Math.round(b + (255 - b) * amt);
    } else {
      r = Math.round(r * (1 + amt));
      g = Math.round(g * (1 + amt));
      b = Math.round(b * (1 + amt));
    }
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  /* ============================================================
     ЗАПЕЧЁННЫЕ СЛОИ ФОНА (параллакс-тайлы 960)
     ============================================================ */
  var bgCache = Object.create(null);

  function bakeSky(z) {
    var cfg = ZC[z];
    var cv = makeCanvas(W, H), c = cv.getContext('2d');
    var g = c.createLinearGradient(0, 0, 0, 168);
    g.addColorStop(0, cfg.skyTop);
    g.addColorStop(0.40, cfg.skyMid);
    g.addColorStop(0.72, cfg.skyLow);
    g.addColorStop(1, cfg.horizon);
    c.fillStyle = g;
    c.fillRect(0, 0, W, 186);
    c.fillStyle = '#04030b';
    c.fillRect(0, 180, W, H - 180);

    if (z === 1) {
      // переулок: неба почти не видно, только холодное свечение
      c.fillStyle = 'rgba(2,4,8,0.75)';
      c.fillRect(0, 0, W, 168);
      var ag = c.createRadialGradient(300, 96, 6, 300, 96, 190);
      ag.addColorStop(0, 'rgba(120,255,220,0.16)');
      ag.addColorStop(0.4, 'rgba(34,230,255,0.06)');
      ag.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = ag;
      c.fillRect(0, 0, W, 190);
    } else {
      // звёзды
      for (var i = 0; i < 120; i++) {
        var sx = hash(i * 3.3) * W;
        var sy = hash2(i * 7.1) * (z === 2 ? 112 : 136);
        var a = 0.10 + hash(i * 5.7) * 0.5;
        c.globalAlpha = a;
        c.fillStyle = i % 7 === 0 ? '#ffd7f4' : (i % 5 === 0 ? '#a8f4ff' : '#ffffff');
        var sz = i % 13 === 0 ? 1.6 : 0.85;
        c.fillRect(sx, sy, sz, sz);
      }
      c.globalAlpha = 1;

      // луна
      if (cfg.moon > 0) {
        var mx = 386, my = 42, mr = 16;
        var halo = c.createRadialGradient(mx, my, mr * 0.6, mx, my, mr * 4.2);
        halo.addColorStop(0, 'rgba(255,225,245,' + (0.30 * cfg.moon) + ')');
        halo.addColorStop(0.22, 'rgba(255,110,185,' + (0.12 * cfg.moon) + ')');
        halo.addColorStop(1, 'rgba(255,46,136,0)');
        c.fillStyle = halo;
        c.fillRect(mx - mr * 4.4, my - mr * 4.4, mr * 8.8, mr * 8.8);
        var mg = c.createLinearGradient(mx - mr, my - mr, mx + mr, my + mr);
        mg.addColorStop(0, '#fff8ff');
        mg.addColorStop(0.6, '#ffdcef');
        mg.addColorStop(1, '#f49ac8');
        c.fillStyle = mg;
        c.beginPath(); c.arc(mx, my, mr, 0, TAU); c.fill();
        c.save();
        c.beginPath(); c.arc(mx, my, mr, 0, TAU); c.clip();
        c.fillStyle = 'rgba(160,100,155,0.22)';
        c.beginPath(); c.arc(mx - 5, my - 3, 5, 0, TAU); c.fill();
        c.beginPath(); c.arc(mx + 6, my + 4, 3.6, 0, TAU); c.fill();
        c.beginPath(); c.arc(mx + 1, my - 9, 2.4, 0, TAU); c.fill();
        // тень терминатора
        c.fillStyle = 'rgba(60,20,60,0.20)';
        c.beginPath(); c.ellipse(mx + mr * 0.72, my, mr * 0.95, mr * 1.15, 0.2, 0, TAU); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.45)';
        c.beginPath(); c.arc(mx - 3, my - 5, mr * 0.62, PI * 0.95, PI * 1.55); c.fill();
        c.restore();
      }

      // перистые облака
      for (var k = 0; k < 10; k++) {
        var cx = hash(k * 9.1) * W, cy = 20 + hash2(k * 4.4) * 100;
        var cw = 40 + hash(k * 6.6) * 130, ch = 2.5 + hash(k * 2.2) * 5;
        c.globalAlpha = 0.08 + hash(k * 8.8) * 0.10;
        c.fillStyle = k % 3 === 0 ? '#ff86c8' : '#5f5aa8';
        c.beginPath(); c.ellipse(cx, cy, cw, ch, 0, 0, TAU); c.fill();
      }
      c.globalAlpha = 1;

      // световой купол у горизонта
      var hg = c.createRadialGradient(W * 0.5, 162, 8, W * 0.5, 162, 300);
      hg.addColorStop(0, rgba(cfg.accent, 0.20));
      hg.addColorStop(0.45, rgba(cfg.haze, 0.07));
      hg.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = hg;
      c.fillRect(0, 70, W, 120);
      // вертикальные столбы дымки
      for (var b = 0; b < 4; b++) {
        var bx = 60 + b * 120 + hash(b * 4.4) * 40;
        var bg2 = c.createLinearGradient(bx, 150, bx, 40);
        bg2.addColorStop(0, rgba(cfg.haze, 0.07));
        bg2.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = bg2;
        c.fillRect(bx - 18, 40, 36, 120);
      }
    }
    return cv;
  }

  /** Окна и мелкая фасадная разметка. */
  function paintWindows(c, x, by, bw, bh, cfg, far, seed, idx) {
    var cellW = far ? 8.5 : 7.6, cellH = far ? 9 : 7.8;
    var cols = Math.max(2, Math.floor((bw - 7) / cellW));
    var rows = Math.max(2, Math.floor((bh - 9) / cellH));
    var ox = x + (bw - cols * cellW) / 2 + 1;
    var oy = by + 6;
    var pal = [C.amber, '#ffd9a0', C.amber2, C.cyan, C.pink, C.violet2, '#fff2d0'];
    for (var r = 0; r < rows; r++) {
      var floorLit = hash(idx * 5.1 + r * 1.7 + seed) < (far ? 0.18 : 0.3);
      for (var col = 0; col < cols; col++) {
        var hv = hash(idx * 43.7 + r * 11.3 + col * 7.9 + seed);
        var wx = ox + col * cellW, wy = oy + r * cellH;
        if (hv < (far ? 0.17 : 0.46) || (floorLit && hv < 0.7)) {
          var pick = hash(hv * 91 + col * 3.3 + r);
          var wc = pal[pick < 0.56 ? Math.floor(pick * 10) % 3 : 3 + Math.floor(pick * 40) % 4];
          var al = far ? 0.16 + hash(hv * 37) * 0.25 : 0.34 + hash(hv * 37) * 0.52;
          c.globalAlpha = al * 0.35;
          c.fillStyle = wc;
          c.fillRect(wx - 1, wy - 1, far ? 3.4 : 4.4, far ? 3.4 : 4.4);
          c.globalAlpha = al;
          var ww = far ? 1.6 : 2.2;
          c.fillRect(wx, wy, hash(hv * 13) > 0.85 ? ww + 1 : ww, far ? 1.6 : 2.2);
        } else if (hv > 0.55) {
          c.globalAlpha = far ? 0.10 : 0.09;
          c.fillStyle = '#2a3a66';
          c.fillRect(wx, wy, far ? 1.6 : 2, far ? 1.6 : 2);
        }
      }
    }
    c.globalAlpha = 1;
  }

  function bakeCity(z, layer) {
    var cfg = ZC[z];
    var far = layer === 0, mid = layer === 1;
    var cv = makeCanvas(960, H), c = cv.getContext('2d');
    var baseY = z === 2 ? (far ? 252 : 236) : 158;
    var body = far ? cfg.far : (mid ? cfg.mid : cfg.near);
    var seed = z * 13.7 + layer * 7.3 + 1;
    var x = -50, i = 0;

    while (x < 1000) {
      var bw = Math.round((far ? 30 : mid ? 46 : 70) + hash(i * 3.1 + seed) * (far ? 34 : mid ? 56 : 70));
      var bh = Math.round((far ? 118 : mid ? 128 : 96) * (0.42 + hash(i * 7.3 + seed) * 0.72));
      if (z === 2) bh = Math.round(bh * (far ? 0.9 : 0.8) + 12);
      var by = baseY - bh;

      // корпус с вертикальным градиентом
      var bg = c.createLinearGradient(0, by, 0, baseY);
      bg.addColorStop(0, shade(body, far ? 0.20 : 0.10));
      bg.addColorStop(0.5, shade(body, 0.02));
      bg.addColorStop(1, shade(body, -0.28));
      c.fillStyle = bg;
      c.fillRect(x, by, bw, bh + 26);

      // крыша: варианты силуэта
      var roof = hash(i * 5.9 + seed);
      if (roof > 0.55) {
        var inset = Math.round(bw * (0.14 + hash(i * 2.3) * 0.2));
        c.fillStyle = shade(body, far ? 0.16 : 0.05);
        c.fillRect(x + inset, by - 7 - hash(i * 4.1) * 10, bw - inset * 2, 12);
        if (roof > 0.8) {
          c.fillStyle = shade(body, -0.12);
          c.fillRect(x + inset + 4, by - 15 - hash(i * 8.3) * 8, 6, 12);
        }
      }
      if (roof > 0.42 && roof < 0.62) {
        // водяной бак
        c.fillStyle = shade(body, -0.18);
        c.fillRect(x + bw * 0.55, by - 16, 13, 11);
        c.fillRect(x + bw * 0.58, by - 5, 2, 6);
        c.fillRect(x + bw * 0.55 + 11, by - 5, 2, 6);
        c.beginPath();
        c.ellipse(x + bw * 0.55 + 6.5, by - 16, 6.5, 2, 0, 0, TAU);
        c.fill();
      }
      // антенна
      if (roof > 0.3) {
        var ax = x + bw * (0.25 + hash(i * 6.7) * 0.5);
        c.strokeStyle = shade(body, -0.3);
        c.lineWidth = far ? 1 : 1.4;
        c.beginPath();
        c.moveTo(ax, by);
        c.lineTo(ax, by - 12 - hash(i * 9.1 + seed) * 22);
        c.stroke();
        c.beginPath();
        c.moveTo(ax - 4, by - 10);
        c.lineTo(ax + 4, by - 10);
        c.stroke();
        if (!far && hash(i * 3.3 + seed) > 0.5) {
          c.fillStyle = 'rgba(255,60,90,0.8)';
          c.fillRect(ax - 1, by - 22 - hash(i * 9.1 + seed) * 10, 1.6, 1.6);
        }
      }
      // парапет и подсветка кромки
      c.fillStyle = shade(body, far ? 0.28 : 0.14);
      c.fillRect(x - 2, by - 2, bw + 4, 2.5);
      c.globalAlpha = far ? 0.10 : 0.2;
      c.fillStyle = cfg.accent2;
      c.fillRect(x, by, bw, 1);
      c.globalAlpha = 1;

      // окна
      paintWindows(c, x, by, bw, bh, cfg, far, seed, i);

      // вертикальная неоновая полоса на фасаде
      if (mid && hash(i * 8.7 + seed) > 0.62) {
        var nx = x + (hash(i * 4.9) > 0.5 ? bw - 4 : 3);
        var ncol = hash(i * 2.2 + seed) > 0.5 ? cfg.accent : cfg.accent2;
        var ng = c.createLinearGradient(0, by + 6, 0, baseY);
        ng.addColorStop(0, rgba(ncol, 0));
        ng.addColorStop(0.3, rgba(ncol, 0.5));
        ng.addColorStop(1, rgba(ncol, 0));
        c.fillStyle = ng;
        c.fillRect(nx, by + 6, 1.8, bh - 10);
        c.save();
        c.globalAlpha = 0.35;
        c.shadowColor = ncol;
        c.shadowBlur = 7;
        c.fillStyle = rgba(ncol, 0.5);
        c.fillRect(nx, by + 10, 1.2, bh - 22);
        c.restore();
      }

      // рекламный щит
      if (mid && hash(i * 6.1 + seed) > 0.7 && bw > 46) {
        var bbx = x + 6, bbw = bw - 12, bbh = 16 + hash(i * 2.7) * 12;
        var bby = by + 6;
        c.fillStyle = 'rgba(5,4,14,0.92)';
        c.fillRect(bbx - 1, bby - 1, bbw + 2, bbh + 2);
        var bcol = [cfg.accent, cfg.accent2, C.amber, C.violet2][Math.floor(hash(i * 5.3 + seed) * 4)];
        c.strokeStyle = rgba(bcol, 0.55);
        c.lineWidth = 1;
        c.strokeRect(bbx, bby, bbw, bbh);
        // абстрактный «постер»
        var pg = c.createLinearGradient(bbx, bby, bbx + bbw, bby + bbh);
        pg.addColorStop(0, rgba(bcol, 0.42));
        pg.addColorStop(1, rgba(bcol, 0.06));
        c.fillStyle = pg;
        c.fillRect(bbx + 2, bby + 2, bbw - 4, bbh - 4);
        c.fillStyle = 'rgba(255,255,255,0.35)';
        c.beginPath();
        c.arc(bbx + bbw * 0.3, bby + bbh * 0.5, Math.min(bbh, bbw) * 0.24, 0, TAU);
        c.fill();
        c.strokeStyle = 'rgba(255,255,255,0.30)';
        c.lineWidth = 0.8;
        c.beginPath();
        c.moveTo(bbx + bbw * 0.55, bby + 3);
        c.lineTo(bbx + bbw * 0.75, bby + bbh - 3);
        c.stroke();
      }

      // пожарная лестница
      if (mid && hash(i * 9.9 + seed) > 0.6) {
        c.strokeStyle = 'rgba(150,165,225,0.10)';
        c.lineWidth = 0.8;
        for (var fy = by + 14; fy < baseY - 6; fy += 12) {
          c.beginPath();
          c.moveTo(x + 4, fy);
          c.lineTo(x + bw - 4, fy);
          c.stroke();
        }
        c.beginPath();
        c.moveTo(x + bw * 0.28, by + 12);
        c.lineTo(x + bw * 0.28, baseY - 8);
        c.stroke();
        c.beginPath();
        c.moveTo(x + bw * 0.72, by + 12);
        c.lineTo(x + bw * 0.72, baseY - 8);
        c.stroke();
      }

      // кондиционеры
      if (!far && hash(i * 4.3 + seed) > 0.55 && bw > 40) {
        var acx = x + bw * 0.62, acy = by + bh * 0.55;
        c.fillStyle = 'rgba(8,7,20,0.92)';
        c.fillRect(acx, acy, 7, 5);
        c.fillStyle = 'rgba(120,140,190,0.10)';
        c.fillRect(acx, acy, 7, 1);
      }

      x += bw + (far ? 3 : mid ? 7 : 10) + hash(i * 6.1 + seed) * (far ? 5 : 9);
      i++;
    }

    // атмосферная дымка снизу
    var fogA = far ? 0.34 : mid ? 0.15 : 0.08;
    var fg = c.createLinearGradient(0, baseY - 90, 0, baseY + 8);
    fg.addColorStop(0, 'rgba(0,0,0,0)');
    fg.addColorStop(0.55, rgba(cfg.fog, fogA * 0.4));
    fg.addColorStop(1, rgba(cfg.haze, fogA));
    c.fillStyle = fg;
    c.fillRect(0, baseY - 90, 960, 100);
    return cv;
  }

  /* ---------- аркадный переулок: задняя стена и автоматы ---------- */
  function bakeAlley(layer) {
    var cfg = ZC[1];
    var cv = makeCanvas(960, H), c = cv.getContext('2d');
    var i, x;

    if (layer === 0) {
      // задняя стена
      c.fillStyle = '#050b12';
      c.fillRect(0, 0, 960, H);
      var wg = c.createLinearGradient(0, 0, 0, 170);
      wg.addColorStop(0, '#041019');
      wg.addColorStop(0.55, '#07141d');
      wg.addColorStop(1, '#0a1b22');
      c.fillStyle = wg;
      c.fillRect(0, 0, 960, 172);
      // кирпичная кладка
      c.strokeStyle = 'rgba(140,190,200,0.045)';
      c.lineWidth = 0.7;
      for (var y = 4; y < 172; y += 8) {
        c.beginPath(); c.moveTo(0, y); c.lineTo(960, y); c.stroke();
        var off = (y / 8) % 2 ? 8 : 0;
        for (var bx = off; bx < 960; bx += 16) {
          c.beginPath(); c.moveTo(bx, y); c.lineTo(bx, y + 8); c.stroke();
        }
      }
      // двери и окна в глубине
      for (i = 0; i < 4; i++) {
        var dx = 90 + i * 240 + hash(i * 3.3) * 60;
        var dw = 34, dh = 60;
        c.fillStyle = '#03070b';
        c.fillRect(dx, 168 - dh, dw, dh);
        c.strokeStyle = 'rgba(120,200,220,0.10)';
        c.strokeRect(dx + 2, 168 - dh + 2, dw - 4, dh - 4);
        // свет из двери
        var dg = c.createLinearGradient(dx, 168 - dh, dx, 168);
        dg.addColorStop(0, 'rgba(34,230,255,0.24)');
        dg.addColorStop(0.6, 'rgba(34,230,255,0.10)');
        dg.addColorStop(1, 'rgba(34,230,255,0.02)');
        c.fillStyle = dg;
        c.fillRect(dx + 4, 168 - dh + 4, dw - 8, dh - 8);
        c.save();
        c.globalAlpha = 0.4;
        c.shadowColor = C.cyan;
        c.shadowBlur = 14;
        c.fillStyle = 'rgba(120,255,255,0.6)';
        c.fillRect(dx + dw / 2 - 1, 168 - dh + 10, 2, dh - 24);
        c.restore();
      }
      // трубы вдоль стены
      for (i = 0; i < 3; i++) {
        var py = 34 + i * 8;
        c.strokeStyle = 'rgba(8,14,20,0.9)';
        c.lineWidth = 3 - i * 0.5;
        c.beginPath(); c.moveTo(-10, py); c.lineTo(970, py); c.stroke();
        c.strokeStyle = 'rgba(140,200,210,0.05)';
        c.lineWidth = 1;
        c.beginPath(); c.moveTo(-10, py - 1); c.lineTo(970, py - 1); c.stroke();
      }
      // неоновые отсветы
      for (i = 0; i < 5; i++) {
        var gx = 120 + i * 190;
        var gg = c.createRadialGradient(gx, 140, 2, gx, 140, 60);
        var col = i % 2 ? C.lime : C.cyan;
        gg.addColorStop(0, rgba(col, 0.12));
        gg.addColorStop(1, rgba(col, 0));
        c.fillStyle = gg;
        c.fillRect(gx - 60, 80, 120, 90);
      }
    } else if (layer === 1) {
      // автоматы вдоль стены + постеры
      for (i = 0; i < 24; i++) {
        x = i * 42 - 10 + hash(i * 2.1) * 6;
        var cw = 30 + hash(i * 4.4) * 6;
        var ch = 44 + hash(i * 3.3) * 6;
        var cy = 158 - ch;
        var palette = [C.pink, C.lime, C.cyan, C.violet, C.amber];
        var mcol = palette[Math.floor(hash(i * 6.6) * palette.length)];
        var broken = hash(i * 8.8) > 0.86;
        // корпус
        c.fillStyle = '#04070c';
        c.fillRect(x, cy, cw, ch);
        c.fillStyle = 'rgba(120,160,180,0.06)';
        c.fillRect(x, cy, cw, 1);
        // маркиза
        var mq = c.createLinearGradient(x, cy, x + cw, cy + 13);
        if (broken) {
          mq.addColorStop(0, '#12161c'); mq.addColorStop(1, '#0a0d12');
        } else {
          mq.addColorStop(0, rgba(mcol, 0.85));
          mq.addColorStop(1, rgba(mcol, 0.25));
        }
        c.fillStyle = mq;
        c.fillRect(x + 2, cy + 2, cw - 4, 11);
        // «название» автомата — пиксельные полоски
        c.fillStyle = broken ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.85)';
        for (var t2 = 0; t2 < 4; t2++) {
          c.fillRect(x + 5 + t2 * 5, cy + 6, 3 + (t2 % 2) * 2, 3);
        }
        // экран
        c.fillStyle = broken ? '#02040a' : '#05131a';
        c.fillRect(x + 4, cy + 15, cw - 8, 13);
        if (!broken) {
          var sc = c.createLinearGradient(x + 4, cy + 15, x + 4, cy + 28);
          sc.addColorStop(0, rgba(mcol, 0.55));
          sc.addColorStop(1, rgba(mcol, 0.10));
          c.fillStyle = sc;
          c.fillRect(x + 5, cy + 16, cw - 10, 11);
          c.fillStyle = 'rgba(255,255,255,0.28)';
          for (var s2 = 0; s2 < 3; s2++) c.fillRect(x + 7 + s2 * 6, cy + 19 + (s2 % 2) * 4, 4, 2);
          c.fillStyle = 'rgba(0,0,0,0.4)';
          for (var l2 = 0; l2 < 6; l2++) c.fillRect(x + 5, cy + 17 + l2 * 2, cw - 10, 0.6);
        }
        // панель управления
        c.fillStyle = '#070b11';
        c.fillRect(x + 3, cy + 31, cw - 6, 8);
        c.fillStyle = broken ? '#22262c' : rgba(mcol, 0.9);
        c.beginPath(); c.arc(x + 9, cy + 35, 1.6, 0, TAU); c.fill();
        c.fillStyle = broken ? '#1a1d22' : rgba(C.amber, 0.85);
        c.beginPath(); c.arc(x + 15, cy + 35, 1.5, 0, TAU); c.fill();
        // монетоприёмник
        c.fillStyle = '#0a0f15';
        c.fillRect(x + cw - 10, cy + 33, 5, 7);
        // боковая неоновая полоса
        if (!broken) {
          c.save();
          c.globalAlpha = 0.6;
          c.shadowColor = mcol;
          c.shadowBlur = 8;
          c.fillStyle = rgba(mcol, 0.7);
          c.fillRect(x + cw - 3, cy + 15, 1.4, 20);
          c.restore();
          // отсвет на пол
          var fl = c.createRadialGradient(x + cw / 2, 160, 2, x + cw / 2, 160, 40);
          fl.addColorStop(0, rgba(mcol, 0.20));
          fl.addColorStop(1, rgba(mcol, 0));
          c.fillStyle = fl;
          c.fillRect(x + cw / 2 - 40, 130, 80, 42);
        }
      }
      // постеры на стене
      for (i = 0; i < 7; i++) {
        var px = 40 + i * 135 + hash(i * 3.7) * 40;
        var py = 34 + hash(i * 5.1) * 46;
        var pw = 26 + hash(i * 2.9) * 20, ph = 30 + hash(i * 7.3) * 22;
        var pcol = [C.pink, C.lime, C.cyan, C.violet2, C.amber][i % 5];
        c.save();
        c.translate(px, py);
        c.rotate((hash(i * 4.4) - 0.5) * 0.10);
        c.fillStyle = 'rgba(6,10,14,0.9)';
        c.fillRect(0, 0, pw, ph);
        c.strokeStyle = rgba(pcol, 0.4);
        c.lineWidth = 1;
        c.strokeRect(0.5, 0.5, pw - 1, ph - 1);
        c.fillStyle = rgba(pcol, 0.22);
        c.fillRect(3, 3, pw - 6, ph * 0.5);
        c.fillStyle = 'rgba(255,255,255,0.5)';
        c.beginPath(); c.arc(pw * 0.5, ph * 0.32, 5, 0, TAU); c.fill();
        c.fillStyle = rgba(pcol, 0.6);
        c.fillRect(4, ph * 0.66, pw - 8, 2);
        c.fillRect(4, ph * 0.74, pw * 0.6, 1.6);
        c.fillRect(4, ph * 0.82, pw * 0.75, 1.6);
        c.restore();
      }
      // граффити
      c.save();
      c.lineCap = 'round';
      for (i = 0; i < 5; i++) {
        var gx2 = 80 + i * 190 + hash(i * 2.2) * 50;
        var gy2 = 100 + hash(i * 4.6) * 34;
        var gcol = [C.lime, C.pink, C.cyan][i % 3];
        c.strokeStyle = rgba(gcol, 0.22);
        c.lineWidth = 2.2;
        c.beginPath();
        c.moveTo(gx2, gy2);
        c.bezierCurveTo(gx2 + 12, gy2 - 16, gx2 + 26, gy2 + 14, gx2 + 38, gy2 - 2);
        c.bezierCurveTo(gx2 + 44, gy2 - 10, gx2 + 52, gy2 + 6, gx2 + 60, gy2 - 4);
        c.stroke();
      }
      c.restore();
      // верхняя балка с неоновой трубкой
      c.fillStyle = '#04070c';
      c.fillRect(0, 8, 960, 14);
      c.fillStyle = '#02040a';
      c.fillRect(0, 0, 960, 8);
      c.save();
      c.globalAlpha = 0.5;
      c.shadowColor = C.lime;
      c.shadowBlur = 9;
      c.fillStyle = rgba(C.lime, 0.7);
      c.fillRect(0, 21, 960, 1.4);
      c.restore();
      // лампы
      for (i = 0; i < 4; i++) {
        var lx = 120 + i * 230;
        c.fillStyle = '#05080d';
        c.fillRect(lx - 1, 8, 2, 14);
        c.fillStyle = '#0a1016';
        c.beginPath();
        c.moveTo(lx - 8, 30); c.lineTo(lx + 8, 30); c.lineTo(lx + 5, 22); c.lineTo(lx - 5, 22);
        c.closePath(); c.fill();
        var lg2 = c.createRadialGradient(lx, 30, 1, lx, 30, 26);
        lg2.addColorStop(0, 'rgba(230,255,220,0.5)');
        lg2.addColorStop(0.4, 'rgba(182,255,58,0.12)');
        lg2.addColorStop(1, 'rgba(182,255,58,0)');
        c.fillStyle = lg2;
        c.fillRect(lx - 26, 4, 52, 52);
      }
    } else {
      // ближний слой: кабели, трубы, вентиляция, края стен
      c.strokeStyle = 'rgba(3,5,9,0.95)';
      c.lineWidth = 2;
      for (i = 0; i < 5; i++) {
        c.beginPath();
        c.moveTo(-10, 12 + i * 9);
        c.quadraticCurveTo(240, 34 + i * 13, 480, 16 + i * 9);
        c.quadraticCurveTo(720, 38 + i * 13, 970, 14 + i * 9);
        c.stroke();
      }
      // вертикальные трубы по краям
      for (i = 0; i < 2; i++) {
        var tx = i === 0 ? 24 : 916;
        c.fillStyle = '#03060a';
        c.fillRect(tx, 0, 18, 160);
        c.fillStyle = 'rgba(120,180,200,0.05)';
        c.fillRect(tx, 0, 2, 160);
        for (var br = 0; br < 5; br++) {
          c.fillStyle = '#0a1015';
          c.fillRect(tx - 2, 20 + br * 30, 22, 4);
        }
      }
      // вентиляционная решётка
      c.fillStyle = '#03060a';
      c.fillRect(760, 58, 46, 30);
      c.strokeStyle = 'rgba(140,190,210,0.10)';
      c.lineWidth = 1;
      for (i = 0; i < 9; i++) {
        c.beginPath(); c.moveTo(762, 61 + i * 3); c.lineTo(804, 61 + i * 3); c.stroke();
      }
    }
    return cv;
  }

  /* ---------- крыша: парапет, мачты ---------- */
  function bakeRoofNear() {
    var cfg = ZC[2];
    var cv = makeCanvas(960, H), c = cv.getContext('2d');
    // мачты-фермы
    for (var m = 0; m < 3; m++) {
      var mx = 90 + m * 360 + hash(m * 3.3) * 60;
      c.strokeStyle = '#05030d';
      c.lineWidth = 5;
      c.beginPath(); c.moveTo(mx, 160); c.lineTo(mx, 26); c.stroke();
      c.lineWidth = 2;
      c.beginPath(); c.moveTo(mx - 16, 160); c.lineTo(mx, 74); c.lineTo(mx + 16, 160); c.stroke();
      for (var b = 0; b < 5; b++) {
        var by = 52 + b * 20;
        c.beginPath(); c.moveTo(mx - 6, by); c.lineTo(mx + 6, by); c.stroke();
      }
      // красный маячок
      c.save();
      c.globalAlpha = 0.85;
      c.shadowColor = C.red;
      c.shadowBlur = 8;
      c.fillStyle = C.red;
      c.fillRect(mx - 1.5, 22, 3, 3);
      c.restore();
    }
    // парапет
    c.fillStyle = '#04030b';
    c.fillRect(0, 146, 960, 14);
    c.fillStyle = '#080515';
    c.fillRect(0, 146, 960, 3);
    c.globalAlpha = 0.55;
    c.fillStyle = C.violet2;
    c.fillRect(0, 146, 960, 1);
    c.globalAlpha = 1;
    // опоры перил
    c.fillStyle = '#06040f';
    for (var p = 0; p < 26; p++) {
      c.fillRect(p * 38 + 6, 136, 3, 12);
    }
    c.strokeStyle = 'rgba(160,140,220,0.16)';
    c.lineWidth = 0.8;
    c.beginPath(); c.moveTo(0, 137); c.lineTo(960, 137); c.stroke();
    // провода
    c.strokeStyle = 'rgba(5,3,12,0.9)';
    c.lineWidth = 1.2;
    for (var w = 0; w < 3; w++) {
      c.beginPath();
      c.moveTo(-10, 30 + w * 12);
      c.quadraticCurveTo(300, 62 + w * 14, 600, 34 + w * 12);
      c.quadraticCurveTo(800, 56 + w * 14, 970, 30 + w * 12);
      c.stroke();
    }
    return cv;
  }

  function bakeNear(z) {
    if (z === 1) return bakeAlley(2);
    if (z === 2) return bakeRoofNear();
    return bakeCity(z, 2);
  }

  function bakeGround(z) {
    var cfg = ZC[z];
    var gh = H - 158;
    var cv = makeCanvas(960, gh), c = cv.getContext('2d');
    var i, x;

    /* ---------- база: мокрый асфальт ---------- */
    var g = c.createLinearGradient(0, 0, 0, gh);
    g.addColorStop(0, cfg.groundTop);
    g.addColorStop(0.18, shade(cfg.groundTop, -0.34));
    g.addColorStop(0.62, shade(cfg.groundLow, 0.04));
    g.addColorStop(1, cfg.groundLow);
    c.fillStyle = g;
    c.fillRect(0, 0, 960, gh);

    /* ---------- дальний тротуар ---------- */
    c.fillStyle = cfg.curb;
    c.fillRect(0, 0, 960, 8);
    // плитка тротуара
    c.strokeStyle = 'rgba(200,210,255,0.055)';
    c.lineWidth = 0.8;
    for (i = 0; i < 20; i++) {
      var tx = i * 48 + hash(i * 2.2) * 8;
      c.beginPath(); c.moveTo(tx, 0); c.lineTo(tx - 6, 8); c.stroke();
    }
    c.beginPath(); c.moveTo(0, 4.5); c.lineTo(960, 4.5); c.stroke();
    // неоновая кромка тротуара
    var curbG = c.createLinearGradient(0, 7, 0, 15);
    curbG.addColorStop(0, rgba(cfg.accent, 0.42));
    curbG.addColorStop(0.35, rgba(cfg.accent, 0.12));
    curbG.addColorStop(1, rgba(cfg.accent, 0));
    c.fillStyle = curbG;
    c.fillRect(0, 7, 960, 9);
    c.save();
    c.globalAlpha = 0.5;
    c.shadowColor = cfg.accent;
    c.shadowBlur = 7;
    c.fillStyle = rgba(cfg.accent, 0.55);
    c.fillRect(0, 7, 960, 1);
    c.restore();

    /* ---------- фактура покрытия ---------- */
    // широкие горизонтальные полосы (перспектива)
    for (i = 0; i < 5; i++) {
      var bandY = 16 + i * 19;
      c.fillStyle = i % 2 ? 'rgba(0,0,0,0.10)' : 'rgba(150,170,255,0.018)';
      c.fillRect(0, bandY, 960, 8);
    }
    // заплатки асфальта
    for (i = 0; i < 10; i++) {
      var px0 = hash(i * 5.3) * 960;
      var py0 = 14 + hash2(i * 3.1) * (gh - 26);
      var pw0 = 30 + hash(i * 7.7) * 80, ph0 = 5 + hash2(i * 9.9) * 10;
      c.globalAlpha = 0.20;
      c.fillStyle = i % 3 === 0 ? '#101426' : '#03040a';
      c.beginPath(); c.ellipse(px0, py0, pw0, ph0, 0, 0, TAU); c.fill();
    }
    c.globalAlpha = 1;
    // мелкий гравий
    for (i = 0; i < 420; i++) {
      c.globalAlpha = 0.025 + hash(i * 1.3) * 0.05;
      c.fillStyle = hash2(i * 7.7) > 0.55 ? '#8f9cc9' : '#232842';
      c.fillRect(hash(i * 3.3) * 960, 9 + hash2(i * 5.5) * (gh - 11), 1, 1);
    }
    c.globalAlpha = 1;
    // трещины
    c.strokeStyle = 'rgba(0,0,0,0.32)';
    for (i = 0; i < 18; i++) {
      x = hash(i * 3.7) * 960;
      c.lineWidth = 0.6 + hash(i) * 0.6;
      c.beginPath();
      c.moveTo(x, 10 + hash2(i) * 30);
      c.lineTo(x + 12 + hash(i * 2.2) * 30, 13 + hash2(i) * 30);
      c.lineTo(x + 24 + hash(i * 2.2) * 44, 11 + hash2(i) * 26);
      c.stroke();
    }

    /* ---------- разметка / покрытие по зонам ---------- */
    if (z === 2) {
      // бетонные плиты крыши
      c.strokeStyle = 'rgba(160,150,220,0.075)';
      c.lineWidth = 1;
      for (i = 0; i < 5; i++) {
        c.beginPath(); c.moveTo(0, 17 + i * 18); c.lineTo(960, 17 + i * 18); c.stroke();
      }
      for (i = 0; i < 14; i++) {
        c.beginPath(); c.moveTo(i * 70 + hash(i * 3.3) * 24, 10); c.lineTo(i * 70 + 10, gh); c.stroke();
      }
      // предупреждающая полоса у края
      c.globalAlpha = 0.20;
      for (i = 0; i < 48; i++) {
        c.fillStyle = i % 2 ? '#ffb300' : '#171226';
        c.fillRect(i * 20, 8.4, 10, 2.4);
      }
      c.globalAlpha = 1;
      // вентиляционные решётки
      for (i = 0; i < 3; i++) {
        var vx = 180 + i * 300;
        c.fillStyle = '#03040a';
        c.fillRect(vx, 40, 34, 14);
        c.strokeStyle = 'rgba(160,170,220,0.13)';
        for (var vk = 0; vk < 7; vk++) {
          c.beginPath(); c.moveTo(vx + 3, 42 + vk * 2); c.lineTo(vx + 31, 42 + vk * 2); c.stroke();
        }
      }
    } else if (z === 1) {
      // пол переулка: секции, жёлоб, стрелка
      c.fillStyle = 'rgba(0,0,0,0.42)';
      c.fillRect(0, 8, 960, 3);
      c.fillStyle = 'rgba(140,200,210,0.05)';
      c.fillRect(0, 8, 960, 0.8);
      c.strokeStyle = 'rgba(150,190,210,0.055)';
      c.lineWidth = 1;
      for (i = 0; i < 11; i++) {
        c.beginPath(); c.moveTo(i * 90 + 16, 11); c.lineTo(i * 90 + 16, gh); c.stroke();
      }
      c.globalAlpha = 0.10;
      c.strokeStyle = C.lime;
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(392, 58); c.lineTo(442, 58); c.lineTo(442, 47); c.lineTo(470, 62); c.lineTo(442, 77); c.lineTo(442, 67); c.lineTo(392, 67);
      c.stroke();
      c.globalAlpha = 1;
    } else {
      // улица: разметка + переход
      for (i = 0; i < 18; i++) {
        var lx = i * 54 + 10;
        c.globalAlpha = 0.12;
        c.fillStyle = '#ffd9a8';
        c.fillRect(lx, 36, 24, 2.4);
        c.globalAlpha = 0.055;
        c.fillRect(lx + 8, 74, 16, 1.8);
      }
      c.globalAlpha = 1;
      c.globalAlpha = 0.11;
      c.fillStyle = '#ffffff';
      for (i = 0; i < 7; i++) {
        var cxx = 548 + i * 20;
        c.beginPath();
        c.moveTo(cxx, 14); c.lineTo(cxx + 8, 14); c.lineTo(cxx + 13, gh - 10); c.lineTo(cxx + 2, gh - 10);
        c.closePath(); c.fill();
      }
      c.globalAlpha = 1;
      // люки
      for (i = 0; i < 3; i++) {
        var mhx = 190 + i * 300 + hash(i * 4.4) * 70;
        c.fillStyle = '#04050b';
        c.beginPath(); c.ellipse(mhx, 50 + i * 15, 16, 5.5, 0, 0, TAU); c.fill();
        c.strokeStyle = 'rgba(160,180,230,0.13)';
        c.lineWidth = 1;
        c.beginPath(); c.ellipse(mhx, 50 + i * 15, 16, 5.5, 0, 0, TAU); c.stroke();
        c.beginPath(); c.ellipse(mhx, 50 + i * 15, 10, 3.2, 0, 0, TAU); c.stroke();
      }
    }

    /* ---------- решётки ---------- */
    for (var gr = 0; gr < 4; gr++) {
      var gx = 60 + gr * 240 + hash(gr * 4.4) * 60;
      var gy = 16 + hash2(gr * 2.2) * 20;
      c.fillStyle = '#04050a';
      c.fillRect(gx, gy, 28, 11);
      c.strokeStyle = 'rgba(150,180,230,0.13)';
      c.lineWidth = 1;
      for (var s = 1; s < 6; s++) {
        c.beginPath(); c.moveTo(gx + s * 4.6, gy + 1); c.lineTo(gx + s * 4.6, gy + 10); c.stroke();
      }
    }

    /* ---------- лужи с отражениями ---------- */
    var puddles = 6;
    for (var p = 0; p < puddles; p++) {
      var px = hash(p * 7.7 + 1.3) * 960;
      var py = 26 + hash2(p * 5.1) * (gh - 44);
      var pw = 30 + hash(p * 3.3) * 54, ph = 5 + hash2(p * 9.2) * 9;
      c.save();
      c.beginPath(); c.ellipse(px, py, pw, ph, 0, 0, TAU); c.clip();
      c.fillStyle = '#03040b';
      c.fillRect(px - pw, py - ph, pw * 2, ph * 2);
      // отражение неба/неона в луже
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = 0.55;
      var pref = p % 3 === 0 ? cfg.accent : (p % 3 === 1 ? cfg.accent2 : C.violet2);
      c.drawImage(glowSprite(pref), px - pw * 0.7, py - ph * 1.6, pw * 1.4, ph * 3.2);
      c.globalAlpha = 0.35;
      c.drawImage(glowSprite(cfg.haze), px - pw, py - ph, pw * 2, ph * 2);
      c.restore();
      // тёмная кромка
      c.globalAlpha = 0.5;
      c.strokeStyle = 'rgba(2,3,8,0.7)';
      c.lineWidth = 1;
      c.beginPath(); c.ellipse(px, py, pw, ph, 0, 0, TAU); c.stroke();
      // блик
      c.globalAlpha = 0.22;
      c.strokeStyle = rgba(cfg.accent2, 0.5);
      c.beginPath(); c.ellipse(px, py, pw * 0.96, ph * 0.92, 0, PI * 1.02, PI * 1.62); c.stroke();
      c.globalAlpha = 0.07;
      c.strokeStyle = '#ffffff';
      c.beginPath(); c.ellipse(px - pw * 0.15, py - 0.6, pw * 0.55, ph * 0.5, 0, PI * 1.08, PI * 1.5); c.stroke();
      c.globalAlpha = 1;
    }

    /* ---------- цветные световые пятна ---------- */
    c.save();
    c.globalCompositeOperation = 'lighter';
    if (z === 1) {
      var marqCols = [C.pink, C.lime, C.cyan, C.violet2, C.amber];
      for (i = 0; i < 12; i++) {
        var mx = i * 84 + 20;
        c.globalAlpha = 0.15;
        c.drawImage(glowSprite(marqCols[i % marqCols.length]), mx - 46, 4, 92, 46);
      }
    } else if (z === 2) {
      c.globalAlpha = 0.13;
      c.drawImage(glowSprite(C.pink), 60, 18, 320, 90);
      c.globalAlpha = 0.10;
      c.drawImage(glowSprite(C.violet), 600, 18, 300, 90);
      c.globalAlpha = 0.10;
      c.drawImage(glowSprite(C.cyan), 430, 30, 200, 60);
    } else {
      c.globalAlpha = 0.11;
      c.drawImage(glowSprite(C.lime), 450, 10, 190, 60);
      c.globalAlpha = 0.10;
      c.drawImage(glowSprite(C.cyan), 90, 16, 180, 60);
      c.globalAlpha = 0.09;
      c.drawImage(glowSprite(C.pink), 690, 16, 200, 64);
    }
    c.restore();

    /* ---------- влажный глянец ---------- */
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = 0.4;
    var sheen = c.createLinearGradient(0, 10, 0, 60);
    sheen.addColorStop(0, rgba(cfg.accent2, 0.10));
    sheen.addColorStop(0.5, rgba(cfg.accent2, 0.02));
    sheen.addColorStop(1, rgba(cfg.accent2, 0));
    c.fillStyle = sheen;
    c.fillRect(0, 10, 960, 52);
    for (i = 0; i < 9; i++) {
      var sx3 = hash(i * 8.1) * 960;
      c.globalAlpha = 0.10;
      c.drawImage(glowSprite(i % 2 ? cfg.accent : cfg.accent2), sx3 - 26, 10, 52, 52);
    }
    c.restore();

    /* ---------- передний план ---------- */
    var fg = c.createLinearGradient(0, gh - 32, 0, gh);
    fg.addColorStop(0, 'rgba(2,2,8,0)');
    fg.addColorStop(1, 'rgba(2,2,8,0.66)');
    c.fillStyle = fg;
    c.fillRect(0, gh - 32, 960, 32);
    return cv;
  }

  function bakeWalls() {
    var cfg = ZC[1];
    var cv = makeCanvas(46, H), c = cv.getContext('2d');
    // почти непрозрачная кирпичная стена
    var g = c.createLinearGradient(0, 0, 46, 0);
    g.addColorStop(0, '#020409');
    g.addColorStop(0.55, '#040910');
    g.addColorStop(0.9, '#071018');
    g.addColorStop(1, 'rgba(6,14,20,0.85)');
    c.fillStyle = g;
    c.fillRect(0, 0, 46, H);
    // кирпичи
    for (var y = 2; y < H; y += 8) {
      c.strokeStyle = 'rgba(150,200,215,' + (0.03 + hash(y) * 0.03) + ')';
      c.lineWidth = 0.7;
      c.beginPath(); c.moveTo(0, y); c.lineTo(46, y); c.stroke();
      var off = (y / 8) % 2 ? 7 : 0;
      for (var x = off; x < 46; x += 14) {
        c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 8); c.stroke();
        // случайные тёмные кирпичи
        if (hash(x * 3.3 + y) > 0.82) {
          c.fillStyle = 'rgba(0,0,0,0.28)';
          c.fillRect(x + 1, y + 1, 12, 6);
        }
      }
    }
    // потёки
    for (var i = 0; i < 6; i++) {
      var sx = hash(i * 4.4) * 40;
      var sg = c.createLinearGradient(0, 0, 0, 40 + hash(i) * 80);
      sg.addColorStop(0, 'rgba(0,0,0,0.35)');
      sg.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = sg;
      c.fillRect(sx, 0, 2 + hash(i * 2.2) * 3, 40 + hash(i) * 80);
    }
    // труба
    c.fillStyle = '#03060b';
    c.fillRect(32, 0, 6, H);
    c.fillStyle = 'rgba(150,200,210,0.10)';
    c.fillRect(32, 0, 1.3, H);
    for (var b = 0; b < 8; b++) {
      c.fillStyle = '#050a0f';
      c.fillRect(30, 14 + b * 32, 10, 3);
    }
    // постер
    c.save();
    c.translate(10, 96);
    c.rotate(-0.07);
    c.fillStyle = 'rgba(4,8,12,0.95)';
    c.fillRect(0, 0, 26, 34);
    c.strokeStyle = rgba(C.lime, 0.35);
    c.lineWidth = 1;
    c.strokeRect(0.5, 0.5, 25, 33);
    c.fillStyle = rgba(C.lime, 0.20);
    c.fillRect(3, 3, 20, 15);
    c.fillStyle = 'rgba(240,255,220,0.55)';
    c.beginPath(); c.arc(13, 10.5, 4, 0, TAU); c.fill();
    c.fillStyle = rgba(C.lime, 0.55);
    c.fillRect(4, 22, 18, 2);
    c.fillRect(4, 26, 12, 1.6);
    c.restore();
    // неоновая трубка по внутренней кромке
    var ng = c.createLinearGradient(46, 0, 20, 0);
    ng.addColorStop(0, rgba(C.lime, 0.16));
    ng.addColorStop(1, rgba(C.lime, 0));
    c.fillStyle = ng;
    c.fillRect(0, 0, 46, H);
    c.save();
    c.globalAlpha = 0.55;
    c.shadowColor = C.lime;
    c.shadowBlur = 8;
    c.fillStyle = rgba(C.lime, 0.75);
    c.fillRect(43, 0, 1.2, H);
    c.restore();
    // нижняя тень
    var bg2 = c.createLinearGradient(0, H - 70, 0, H);
    bg2.addColorStop(0, 'rgba(1,2,5,0)');
    bg2.addColorStop(1, 'rgba(1,2,5,0.75)');
    c.fillStyle = bg2;
    c.fillRect(0, H - 70, 46, 70);
    return cv;
  }

  function buildBg(z) {
    var b = {
      sky: bakeSky(z),
      far: z === 1 ? bakeAlley(0) : bakeCity(z, 0),
      mid: z === 1 ? bakeAlley(1) : bakeCity(z, 1),
      near: bakeNear(z),
      ground: bakeGround(z)
    };
    if (z === 1) b.walls = bakeWalls();
    return b;
  }

  function ensureBg(z) {
    var b = bgCache[z];
    if (!b) { b = buildBg(z); bgCache[z] = b; }
    return b;
  }

  function drawTiled(ctx, cv, offset, y, alpha) {
    var tw = cv.width;
    var x = -(((offset % tw) + tw) % tw);
    ctx.save();
    if (alpha != null) ctx.globalAlpha *= alpha;
    ctx.drawImage(cv, Math.round(x), y);
    if (x + tw < W + 4) ctx.drawImage(cv, Math.round(x + tw), y);
    ctx.restore();
  }

  /* ============================================================
     НЕОНОВЫЕ ВЫВЕСКИ (экранно-якорные, лёгкий параллакс)
     ============================================================ */
  var SIGNS = {
    0: [
      { sx: 74, y: 30, w: 26, h: 88, text: 'КОМЕТА', style: 'vert', col: C.cyan, hot: '#ffffff', factor: 0.30 },
      { sx: 262, y: 56, w: 120, h: 28, text: 'АРКАДА', style: 'horiz', col: C.pink, hot: '#ffe0ef', factor: 0.30 },
      { sx: 398, y: 100, w: 70, h: 24, text: '24/7', style: 'store', col: C.lime, hot: C.lime2, factor: 0.52 },
      { sx: 414, y: 52, w: 54, h: 18, text: 'NEON', style: 'small', col: C.amber, hot: C.amber2, factor: 0.30 }
    ],
    1: [
      { sx: 176, y: 26, w: 124, h: 28, text: 'АРКАДА', style: 'horiz', col: C.pink, hot: '#ffe0ef', factor: 0.24 },
      { sx: 352, y: 52, w: 70, h: 24, text: '24/7', style: 'store', col: C.cyan, hot: C.cyan2, factor: 0.42 },
      { sx: 52, y: 56, w: 24, h: 62, text: 'ИГРЫ', style: 'vert', col: C.lime, hot: C.lime2, factor: 0.24 },
      { sx: 408, y: 104, w: 60, h: 17, text: 'TOXIC', style: 'small', col: C.violet2, hot: '#ffffff', factor: 0.55 }
    ],
    2: [
      { sx: 128, y: 70, w: 224, h: 46, text: 'ТОКСИК', style: 'toxic', col: C.pink, hot: '#ffffff', factor: 0.14 },
      { sx: 396, y: 122, w: 70, h: 23, text: '24/7', style: 'store', col: C.violet2, hot: '#ffffff', factor: 0.34 },
      { sx: 30, y: 44, w: 22, h: 62, text: 'НЕОН', style: 'vert', col: C.cyan, hot: '#ffffff', factor: 0.34 }
    ]
  };

  function signScreenX(z, s, camX) {
    return s.sx + (CAM_MID[z] - camX) * s.factor;
  }

  function drawSignBoard(ctx, x, y, w, h, col, alpha, flick) {
    ctx.save();
    ctx.globalAlpha *= alpha;
    rr(ctx, x - 2, y - 2, w + 4, h + 4, 2);
    ctx.fillStyle = 'rgba(4,3,12,0.9)';
    ctx.fill();
    ctx.strokeStyle = rgba(col, 0.5);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.strokeStyle = rgba(col, 0.5 * flick);
    ctx.shadowColor = col;
    ctx.shadowBlur = 7;
    rr(ctx, x, y, w, h, 1.5);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  function drawSign(ctx, s, sx, sy, t, alpha) {
    var flick = 1;
    var f = hash(s.sx * 1.7 + Math.floor(t * 9) * 0.37);
    if (f > 0.94) flick = 0.4;
    else if (f > 0.87) flick = 0.72;
    var a = alpha == null ? 1 : alpha;
    ctx.save();
    ctx.globalAlpha *= a;

    if (s.style === 'vert') {
      drawSignBoard(ctx, sx, sy, s.w, s.h, s.col, 1, flick);
      var n = s.text.length;
      var step = (s.h - 12) / Math.max(1, n - 1);
      var fs = Math.min(13, (s.w - 10));
      for (var i = 0; i < n; i++) {
        var fl = (flick < 1 && i === 2) ? flick * 0.7 : flick;
        drawText(ctx, s.text.charAt(i), sx + s.w / 2, sy + 6 + i * step, {
          size: fs, weight: 900, fam: F_SANS, color: C.white, glow: s.col, blur: 9,
          glowColor: s.col, glowAlpha: 0.95 * fl, alpha: fl
        });
      }
    } else if (s.style === 'horiz' || s.style === 'small') {
      drawSignBoard(ctx, sx, sy, s.w, s.h, s.col, 1, flick);
      var size = s.style === 'small' ? s.h * 0.58 : s.h * 0.6;
      size = fitSize(ctx, s.text, s.w - 12, size, 900, F_SANS, 6);
      ctx.save();
      ctx.globalAlpha *= flick;
      ctx.strokeStyle = rgba(s.col, 0.5);
      ctx.shadowColor = s.col; ctx.shadowBlur = 7;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(sx + 6, sy + 4); ctx.lineTo(sx + s.w - 6, sy + 4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx + 6, sy + s.h - 4); ctx.lineTo(sx + s.w - 6, sy + s.h - 4); ctx.stroke();
      ctx.restore();
      drawText(ctx, s.text, sx + s.w / 2, sy + s.h / 2 + 0.5, {
        size: size, weight: 900, fam: F_SANS, color: C.white, glow: s.col, blur: 10,
        glowColor: s.col, glowAlpha: 0.9 * flick, alpha: flick, spacing: s.style === 'horiz' ? 2 : 0
      });
    } else if (s.style === 'store') {
      ctx.save();
      rr(ctx, sx - 2, sy - 2, s.w + 4, s.h + 4, 2);
      ctx.fillStyle = 'rgba(5,7,14,0.94)';
      ctx.fill();
      ctx.strokeStyle = rgba(s.col, 0.6);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.save();
      rr(ctx, sx, sy, s.w, s.h, 1.5);
      ctx.clip();
      for (var st = -s.h; st < s.w + s.h; st += 10) {
        ctx.fillStyle = rgba(s.col, 0.18 * flick);
        ctx.beginPath();
        ctx.moveTo(sx + st, sy);
        ctx.lineTo(sx + st + 5, sy);
        ctx.lineTo(sx + st + 5 - s.h, sy + s.h);
        ctx.lineTo(sx + st - s.h, sy + s.h);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      drawText(ctx, s.text, sx + s.w / 2, sy + s.h / 2 + 1, {
        size: s.h * 0.6, weight: 900, fam: F_SANS, color: '#f8ffe6', glow: s.col, blur: 11,
        glowColor: s.col, glowAlpha: flick, alpha: flick
      });
      drawGlow(ctx, sx + s.w / 2, sy + s.h + 14, s.w * 1.2, s.col, 0.14 * flick, 'lighter');
      ctx.restore();
    } else if (s.style === 'toxic') {
      ctx.save();
      ctx.globalAlpha *= flick;
      ctx.strokeStyle = 'rgba(10,7,20,0.92)';
      ctx.lineWidth = 4;
      ctx.strokeRect(sx - 14, sy - 12, s.w + 28, s.h + 24);
      ctx.strokeStyle = rgba(s.col, 0.22);
      ctx.lineWidth = 1;
      ctx.strokeRect(sx - 9, sy - 7, s.w + 18, s.h + 14);
      drawGlow(ctx, sx + s.w / 2, sy + s.h / 2, s.w * 0.7, s.col, 0.32 * flick, 'lighter');
      var tsize = fitSize(ctx, s.text, s.w, s.h * 1.05, 900, F_SANS, 14);
      drawText(ctx, s.text, sx + s.w / 2, sy + s.h / 2 + 2, {
        size: tsize, weight: 900, fam: F_SANS, color: '#ffd9ec', glow: s.col, blur: 18,
        glowColor: s.col, glowAlpha: 0.95 * flick, alpha: flick, spacing: 6
      });
      drawText(ctx, s.text, sx + s.w / 2, sy + s.h / 2 + 2, {
        size: tsize, weight: 900, fam: F_SANS, color: '#fff6fb', alpha: 0.9 * flick, spacing: 6
      });
      ctx.strokeStyle = rgba(C.cyan, 0.5 * flick);
      ctx.shadowColor = C.cyan; ctx.shadowBlur = 8;
      ctx.lineWidth = 1.4;
      for (var cr = 0; cr < 5; cr++) {
        var cxp = sx + s.w * (0.14 + cr * 0.18);
        ctx.beginPath();
        ctx.moveTo(cxp, sy - 10);
        ctx.lineTo(cxp, sy - 20 - (cr === 2 ? 8 : 0));
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      ctx.restore();
    }
    ctx.restore();
  }

  function drawSigns(ctx, z, camX, t, alpha) {
    var list = SIGNS[z] || [];
    for (var i = 0; i < list.length; i++) {
      var s = list[i];
      var sx = Math.round(signScreenX(z, s, camX));
      if (sx > W + 8 || sx + s.w < -8) continue;
      drawSign(ctx, s, sx, s.y, t, alpha);
    }
  }

  /* ============================================================
     ЖИВЫЕ ЭФФЕКТЫ ФОНА
     ============================================================ */
  function drawArenaRing(ctx, t) {
    var cx = W / 2, cy = 224;
    var pr = pulse(t, 1.2);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // накачка светом
    drawGlow(ctx, cx, cy, 150, C.violet, 0.07 + 0.02 * pr, 'lighter');
    // эллипсы
    var rings = [
      { rx: 176, ry: 36, a: 0.30, col: C.pink, lw: 1.6 },
      { rx: 160, ry: 32, a: 0.16, col: C.cyan, lw: 1 },
      { rx: 120, ry: 23, a: 0.12, col: C.violet2, lw: 0.8 }
    ];
    for (var i = 0; i < rings.length; i++) {
      var r = rings[i];
      ctx.globalAlpha = r.a * (0.7 + 0.3 * pr);
      ctx.strokeStyle = r.col;
      ctx.lineWidth = r.lw;
      ctx.beginPath();
      ctx.ellipse(cx, cy, r.rx, r.ry, 0, 0, TAU);
      ctx.stroke();
    }
    // руны-деления
    ctx.globalAlpha = 0.24;
    ctx.strokeStyle = C.pink;
    ctx.lineWidth = 1;
    for (var k = 0; k < 16; k++) {
      var ang = (k / 16) * TAU + t * 0.06;
      var x1 = cx + Math.cos(ang) * 170, y1 = cy + Math.sin(ang) * 34;
      var x2 = cx + Math.cos(ang) * 176, y2 = cy + Math.sin(ang) * 36;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
    ctx.restore();
  }

  function drawWetReflections(ctx, z, camX, t) {
    var cfg = ZC[z];
    var list = SIGNS[z] || [];
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < list.length; i++) {
      var s = list[i];
      var sx = signScreenX(z, s, camX);
      if (sx < -s.w - 40 || sx > W + s.w + 40) continue;
      var cx = sx + s.w / 2;
      var wob = Math.sin(t * 1.8 + i * 1.3) * 2.2;
      var top = 160;
      var h = s.style === 'toxic' ? 78 : 56;
      var w = s.style === 'vert' ? s.w * 2.2 : s.w * 1.05;
      ctx.globalAlpha = 0.30;
      ctx.save();
      ctx.translate(cx + wob, top);
      ctx.scale(1, 1);
      ctx.globalAlpha = 0.26;
      ctx.drawImage(glowSprite(s.col), -w / 2, 0, w, h);
      ctx.restore();
      // бликовая дорожка
      ctx.globalAlpha = 0.10;
      ctx.fillStyle = s.col;
      ctx.fillRect(cx + wob - 1.2, top, 2.4, 22);
      // рябь
      for (var k = 0; k < 3; k++) {
        ctx.globalAlpha = 0.10 - k * 0.022;
        ctx.strokeStyle = s.col;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.ellipse(cx + wob + Math.sin(t * 2 + k) * 3, top + 12 + k * 13, w * 0.34, 2.2, 0, 0, TAU);
        ctx.stroke();
      }
    }
    // лунная дорожка
    if (cfg.moon > 0) {
      var mx = 386 - camX * 0.05;
      ctx.globalAlpha = 0.14;
      ctx.drawImage(glowSprite('#ffc7e6'), mx - 20, 160, 40, 78);
      ctx.globalAlpha = 0.10;
      ctx.fillStyle = '#ffd4ec';
      for (var m = 0; m < 7; m++) {
        var mw = 12 + m * 6;
        ctx.fillRect(mx - mw / 2 + Math.sin(t * 1.3 + m) * 2, 168 + m * 9, mw, 1.4);
      }
    }
    // цветные пятна
    ctx.globalAlpha = 0.5;
    drawGlow(ctx, W * 0.18, 210, 70, cfg.accent2, 0.045, 'lighter');
    drawGlow(ctx, W * 0.7, 236, 90, cfg.accent, 0.05, 'lighter');
    ctx.restore();
  }

  function drawSteam(ctx, z, camX, t) {
    var grates = z === 0 ? [[172, 246], [640, 240]] : (z === 1 ? [[320, 250], [690, 244]] : [[190, 238], [700, 234]]);
    for (var g = 0; g < grates.length; g++) {
      var gx = grates[g][0] - camX;
      gx = ((gx % 960) + 960) % 960;
      if (gx < -90 || gx > W + 90) continue;
      for (var i = 0; i < 5; i++) {
        var ph = (t * 0.20 + i * 0.2 + g * 0.13) % 1;
        var y = 252 - ph * 70;
        var x = gx + Math.sin(t * 0.8 + i * 1.7 + g) * (5 + ph * 13);
        var r = 6 + ph * 21;
        drawSmoke(ctx, x, y, r, z === 2 ? '#8b5cff' : '#9fb8d8', (1 - ph) * 0.15, ph * 2);
      }
    }
  }

  function drawEmbers(ctx, z, t) {
    var i, x, y, a, col;
    if (z === 0) {
      for (i = 0; i < 16; i++) {
        x = (hash(i * 3.1) * W + t * (4 + hash(i) * 8)) % (W + 20) - 10;
        y = 60 + ((hash2(i * 5.7) * 190 + t * (5 + hash(i * 2) * 9)) % 170);
        a = 0.08 + 0.09 * Math.sin(t * 2 + i);
        col = i % 3 === 0 ? C.pink2 : C.amber2;
        drawGlow(ctx, x, y, 2.4 + hash(i * 4) * 2, col, a * 0.8, 'lighter');
      }
    } else if (z === 1) {
      for (i = 0; i < 14; i++) {
        x = 66 + (hash(i * 2.7) * 350 + t * (3 + hash(i) * 5)) % 340;
        y = 90 + ((hash2(i * 7.3) * 150 + t * 4) % 150);
        col = i % 2 ? C.lime : C.cyan;
        drawGlow(ctx, x, y, 2 + hash(i * 3) * 2, col, 0.09 + 0.07 * Math.sin(t * 1.6 + i), 'lighter');
      }
    } else {
      for (i = 0; i < 22; i++) {
        x = (hash(i * 1.9) * W + t * (10 + hash(i) * 18)) % (W + 40) - 20;
        y = 40 + ((hash2(i * 3.3) * 200 + t * 15) % 200);
        col = i % 3 ? C.violet2 : C.pink;
        drawGlow(ctx, x, y, 1.4 + hash(i * 4.7) * 2, col, 0.09 + 0.08 * Math.sin(t * 2.4 + i), 'lighter');
      }
    }
  }

  function lightningState(t, z) {
    if (z !== 2) return 0;
    var cyc = 6.5, ph = t % cyc, f = 0;
    if (ph < 0.07) f = 1 - ph / 0.07;
    else if (ph > 0.14 && ph < 0.21) f = (1 - (ph - 0.14) / 0.07) * 0.75;
    else if (ph > 0.28 && ph < 0.34) f = (1 - (ph - 0.28) / 0.06) * 0.45;
    return clamp(f, 0, 1);
  }

  function drawLightning(ctx, t, z, flash) {
    if (flash <= 0.01) return;
    var idx = Math.floor(t / 6.5);
    var bx = 70 + hash(idx * 4.3) * 330;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // засветка облаков
    drawGlow(ctx, bx, 30, 150, '#9aa8ff', 0.30 * flash, 'lighter');
    ctx.fillStyle = 'rgba(190,200,255,' + (0.13 * flash) + ')';
    ctx.fillRect(0, 0, W, H);
    // молния
    ctx.strokeStyle = 'rgba(240,244,255,0.92)';
    ctx.shadowColor = '#b9c6ff';
    ctx.shadowBlur = 14;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    var y = -4, x = bx;
    ctx.moveTo(x, y);
    while (y < 156) {
      y += 11 + hash(y + idx) * 15;
      x += (hash(y * 2.3 + idx) - 0.5) * 28;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.lineWidth = 0.7;
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.stroke();
    ctx.restore();
    drawGlow(ctx, bx, 120, 130, '#b9c6ff', 0.22 * flash, 'lighter');
  }

  function drawRain(ctx, z, t, intensity, wind) {
    var cfg = ZC[z];
    var n = Math.round(72 * intensity);
    var a = clamp(intensity, 0, 1.6);
    ctx.save();
    ctx.lineCap = 'round';
    for (var bucket = 0; bucket < 3; bucket++) {
      ctx.beginPath();
      ctx.strokeStyle = bucket === 0 ? 'rgba(190,228,255,0.26)' : bucket === 1 ? 'rgba(150,190,255,0.15)' : 'rgba(225,242,255,0.40)';
      ctx.lineWidth = bucket === 2 ? 1.25 : 0.8;
      var count = bucket === 2 ? Math.round(n * 0.14) : Math.round(n * 0.43);
      for (var i = 0; i < count; i++) {
        var idx = i + bucket * 173 + z * 31;
        var speed = 320 + hash(idx * 1.7) * 280;
        var x = hash(idx * 3.3) * (W + 140) - 70;
        var y = (hash2(idx * 5.1) * (H + 80) + t * speed) % (H + 80) - 40;
        var len = 7 + hash(idx * 7.7) * 15;
        x += (y + 40) * 0.10 * (wind || 1);
        ctx.moveTo(x, y);
        ctx.lineTo(x - len * 0.22 * (wind || 1), y + len);
      }
      ctx.stroke();
    }
    // брызги
    ctx.globalAlpha = 0.45;
    for (var s = 0; s < 18; s++) {
      var sx = hash(s * 4.1 + 5) * W;
      var sy = 168 + hash2(s * 6.6) * 98;
      var ph = (t * 1.9 + hash(s * 2.9)) % 1;
      ctx.strokeStyle = 'rgba(170,225,255,' + (0.22 * (1 - ph)) + ')';
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.ellipse(sx, sy, 1 + ph * 5.5, 0.4 + ph * 2, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
    // общая дымка
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(ctx, W * 0.5, 20, 210, cfg.fog, 0.03 * a, 'lighter');
    drawGlow(ctx, W * 0.22, 110, 160, cfg.haze, 0.022 * a, 'lighter');
    ctx.restore();
  }

  function drawWeather(ctx, z, t, opts) {
    opts = opts || {};
    var cfg = ZC[z];
    var flash = lightningState(t, z);
    drawLightning(ctx, t, z, flash);
    drawRain(ctx, z, t, (cfg.rain + (opts.rainExtra || 0)) * (opts.rainScale == null ? 1 : opts.rainScale), 1);
  }

  /** Кинематографичные световые клинья для меню/титула. */
  function drawShafts(ctx, cols, t, alpha) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < cols.length; i++) {
      var x = cols[i].x + Math.sin(t * 0.25 + i * 2) * 8;
      var g = lg(ctx, x, 0, x + 120, H, [
        0, rgba(cols[i].col, 0.10 * alpha),
        0.5, rgba(cols[i].col, 0.035 * alpha),
        1, rgba(cols[i].col, 0)
      ]);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x, -10);
      ctx.lineTo(x + 42, -10);
      ctx.lineTo(x + 190, H);
      ctx.lineTo(x + 40, H);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawZoneBg(ctx, z, camX, t, opts) {
    opts = opts || {};
    var bg = ensureBg(z);
    var cfg = ZC[z];

    ctx.drawImage(bg.sky, 0, 0);

    // свет у горизонта
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(ctx, W * 0.52, 152, 230, cfg.haze, 0.10 + 0.02 * Math.sin(t * 0.6), 'lighter');
    drawGlow(ctx, W * 0.16, 132, 140, cfg.accent2, 0.05 + 0.012 * Math.sin(t * 0.5 + 1.7), 'lighter');
    ctx.restore();

    // параллакс
    drawTiled(ctx, bg.far, camX * 0.14, 0, 1);
    ctx.fillStyle = lg(ctx, 0, 96, 0, 166, [
      0, 'rgba(0,0,0,0)',
      0.55, rgba(cfg.fog, 0.05),
      1, rgba(cfg.haze, 0.11)
    ]);
    ctx.fillRect(0, 96, W, 76);

    drawTiled(ctx, bg.mid, camX * 0.32, 0, 1);
    ctx.fillStyle = lg(ctx, 0, 110, 0, 168, [
      0, 'rgba(0,0,0,0)',
      0.7, rgba(cfg.fog, 0.05),
      1, rgba(cfg.haze, 0.08)
    ]);
    ctx.fillRect(0, 110, W, 62);

    drawTiled(ctx, bg.near, camX * 0.58, 0, 1);

    // вывески + их свет
    drawSigns(ctx, z, camX, t, opts.signAlpha != null ? opts.signAlpha : 1);
    var list = SIGNS[z] || [];
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < list.length; i++) {
      var s = list[i];
      var bx = signScreenX(z, s, camX);
      if (bx < -s.w * 1.5 || bx > W + s.w * 1.5) continue;
      if (s.style === 'vert' || s.style === 'store' || s.style === 'toxic') {
        drawGlow(ctx, bx + s.w / 2, s.y + s.h / 2, s.w * 1.35, s.col, 0.10, 'lighter');
      }
    }
    ctx.restore();

    // земля
    drawTiled(ctx, bg.ground, camX, 158, 1);

    // стены переулка
    if (bg.walls) {
      ctx.save();
      ctx.globalAlpha = 0.96;
      ctx.drawImage(bg.walls, 0, 0);
      ctx.save();
      ctx.translate(W, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(bg.walls, 0, 0);
      ctx.restore();
      ctx.restore();
      // мягкая тень от стен на полу
      ctx.fillStyle = lg(ctx, 0, 0, 70, 0, [0, 'rgba(0,0,0,0.55)', 1, 'rgba(0,0,0,0)']);
      ctx.fillRect(0, 158, 70, H - 158);
      ctx.fillStyle = lg(ctx, W, 0, W - 70, 0, [0, 'rgba(0,0,0,0.55)', 1, 'rgba(0,0,0,0)']);
      ctx.fillRect(W - 70, 158, 70, H - 158);
    }

    // арена босса
    if (cfg.arena) drawArenaRing(ctx, t);

    // мокрые отражения
    drawWetReflections(ctx, z, camX, t);

    // дымка у пола
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(ctx, W * 0.35, 250, 170, cfg.fog, 0.035, 'lighter');
    drawGlow(ctx, W * 0.75, 246, 150, cfg.haze, 0.03, 'lighter');
    ctx.restore();

    if (opts.dim) {
      ctx.fillStyle = 'rgba(3,2,10,' + clamp(opts.dim, 0, 1) + ')';
      ctx.fillRect(0, 0, W, H);
    }
  }

  /* ============================================================
     ПЕРСОНАЖИ — скелет, позы, векторная отрисовка
     ============================================================ */
  var SK = {
    comet: { hip: 24, chest: 16, headR: 7.1, thigh: 11.5, shin: 11.5, upper: 9, fore: 8.5, shW: 10.5, aw1: 5.2, aw2: 4.3, lw1: 6.2, lw2: 4.9, neck: 3 },
    hammer: { hip: 23, chest: 18, headR: 7.6, thigh: 11, shin: 11, upper: 9.5, fore: 8.5, shW: 18, aw1: 7.4, aw2: 6.2, lw1: 8.6, lw2: 7.2, neck: 2.2 },
    punk:   { hip: 24, chest: 15, headR: 6.6, thigh: 11.5, shin: 11.5, upper: 8.5, fore: 8, shW: 10, aw1: 4.9, aw2: 4.1, lw1: 5.8, lw2: 4.6, neck: 2.6 },
    ninja:  { hip: 24, chest: 16, headR: 6.7, thigh: 12, shin: 12, upper: 9, fore: 8.5, shW: 10.5, aw1: 4.9, aw2: 4.1, lw1: 5.6, lw2: 4.4, neck: 3 },
    brute:  { hip: 26, chest: 21, headR: 8.0, thigh: 13, shin: 13, upper: 11, fore: 10, shW: 21, aw1: 9.2, aw2: 7.8, lw1: 9.6, lw2: 7.6, neck: 1.8 },
    khrom:  { hip: 30, chest: 20, headR: 7.5, thigh: 15, shin: 15, upper: 11.5, fore: 10.5, shW: 26, aw1: 5.6, aw2: 4.6, lw1: 5.4, lw2: 4.4, neck: 4.5 }
  };

  var PAL = {
    comet: {
      skin: '#e9b78f', skinD: '#b8825c', skinL: '#ffd9b8',
      cloth: '#c4cae2', clothD: '#7b80a8', clothL: '#eef0ff',
      accent: '#22e6ff', accent2: '#ff8a1f', hair: '#0b0917', boots: '#0a0c18', bootsL: '#1b2540',
      metal: '#a9b6d8', rim: '#22e6ff', glow: '#22e6ff'
    },
    hammer: {
      skin: '#c98a5e', skinD: '#8f5a38', skinL: '#f2c08f',
      cloth: '#30303e', clothD: '#17171f', clothL: '#4a4a5e',
      accent: '#ff8a1f', accent2: '#ffb300', hair: '#2a1a12', boots: '#16120e', bootsL: '#3a2c20',
      apron: '#7a4220', apronD: '#43230f', metal: '#c3cde0', metalD: '#5d6680',
      rim: '#ff9a3c', glow: '#ff8a1f'
    },
    punk: {
      skin: '#e6c19b', skinD: '#b68a63', skinL: '#ffdcb8',
      cloth: '#1a121c', clothD: '#0a070c', clothL: '#443450',
      accent: '#ff2e88', accent2: '#b6ff3a', hair: '#ff2e88', boots: '#0a0a12', bootsL: '#221a2c',
      metal: '#b9c2d8', rim: '#ff2e88', glow: '#ff2e88'
    },
    ninja: {
      skin: '#2a1a4a', skinD: '#170e2c', skinL: '#3f2a66',
      cloth: '#6f43e0', clothD: '#3b1f8f', clothL: '#9a74ff',
      accent: '#22e6ff', accent2: '#c3a8ff', hair: '#221545', boots: '#1a1030', bootsL: '#33205c',
      metal: '#c3a8ff', rim: '#c3a8ff', glow: '#8b5cff'
    },
    brute: {
      skin: '#ff9a2e', skinD: '#c46a12', skinL: '#ffc070',
      cloth: '#2a1710', clothD: '#150b06', clothL: '#43251a',
      accent: '#ffb300', accent2: '#ff3b57', hair: '#7a3a0a', boots: '#181008', bootsL: '#3a2614',
      metal: '#b9c2d8', rim: '#ffb300', glow: '#ff8a1f'
    },
    khrom: {
      skin: '#2a2f4a', skinD: '#141729', skinL: '#4a5378',
      cloth: '#2c3150', clothD: '#131628', clothL: '#56608a',
      accent: '#ff2e88', accent2: '#22e6ff', hair: '#0b0d18', boots: '#0b0d18', bootsL: '#22263c',
      metal: '#c9d3ea', metalD: '#5a6488', hazard: '#ffb300', rim: '#22e6ff', glow: '#8b5cff'
    }
  };

  var PANT = {
    comet: ['#171436', '#262058'],
    punk: ['#181320', '#2b2136'],
    ninja: ['#2c1954', '#42287a'],
    brute: ['#291710', '#3f2618'],
    hammer: ['#22202e', '#353247'],
    khrom: null
  };

  function palFor(a) {
    var k = (a && (a.char || a.kind)) || 'punk';
    if (k === 'player') k = 'comet';
    if (k === 'boss') k = 'khrom';
    return PAL[k] || PAL.punk;
  }
  function skFor(a) {
    var k = (a && (a.char || a.kind)) || 'punk';
    if (k === 'player') k = 'comet';
    if (k === 'boss' || k === 'khrom') return SK.khrom;
    return SK[k] || SK.punk;
  }
  function charKind(a) {
    if (!a) return 'punk';
    if (a.kind === 'player') return a.char === 'hammer' ? 'hammer' : 'comet';
    if (a.kind === 'boss') return 'khrom';
    return a.kind;
  }

  /** Поза из anim/animT/attack.phase. */
  function actorPose(a, t) {
    var an = a.anim || a.state || 'idle';
    var at = a.animT || 0;
    var ext = 0;
    if (a.attack) {
      var ph = a.attack.phase;
      ext = ph === 'wind' ? 0.18 : ph === 'hit' ? 1 : 0.55;
    } else ext = clamp(at * 7, 0, 1);

    var P = {
      lean: 0.03, hipDrop: 0, bob: Math.sin(t * 2.6 + (a.id || 1) * 0.73) * 0.55,
      headTilt: 0, armF: [0.22, 0.2], armB: [-0.22, 0.2],
      legF: [0.16, -0.12], legB: [-0.16, -0.08],
      open: 0, ext: ext, float: 0, hurt: 0, air: (a.z || 0) > 1,
      cableSwing: 0
    };
    if (a.state === 'jump' || (a.z || 0) > 1) {
      P.legF = [-0.32, 0.85]; P.legB = [0.5, 0.7];
      P.armF = [2.2, 0.3]; P.armB = [-2.2, 0.2];
      P.lean = 0.06;
    }
    switch (an) {
      case 'walk': {
        var s = Math.sin(at * 8.5);
        var c = Math.cos(at * 8.5);
        P.legF = [s * 0.62, -0.14 - Math.max(0, -c) * 0.55];
        P.legB = [-s * 0.62, -0.14 - Math.max(0, c) * 0.55];
        P.armF = [-s * 0.5, 0.3];
        P.armB = [s * 0.5, 0.3];
        P.bob = Math.abs(Math.sin(at * 8.5)) * 1.4;
        P.lean = 0.10;
        break;
      }
      case 'punch1': {
        P.armF = [lerp(0.7, 1.56, ext), lerp(-1.05, 0.04, ext)];
        P.armB = [-0.85, 0.9];
        P.lean = 0.05 + 0.13 * ext;
        P.legF = [0.35, -0.2]; P.legB = [-0.3, -0.06];
        P.headTilt = 0.05;
        break;
      }
      case 'punch2': {
        P.armB = [lerp(0.6, 1.52, ext), lerp(-1.15, 0.02, ext)];
        P.armF = [-0.5, 1.35];
        P.lean = 0.06 + 0.16 * ext;
        P.legF = [0.3, -0.16]; P.legB = [-0.36, -0.05];
        break;
      }
      case 'punch3': {
        P.armF = [lerp(0.2, 1.78, ext), lerp(-1.3, 0.05, ext)];
        P.armB = [-1.3, 0.4];
        P.lean = 0.08 + 0.26 * ext;
        P.legF = [0.52, -0.22]; P.legB = [-0.42, -0.04];
        P.headTilt = 0.1 * ext;
        break;
      }
      case 'kick': {
        P.legF = [lerp(0.1, 1.42, ext), lerp(-1.2, -0.12, ext)];
        P.legB = [-0.12, -0.06];
        P.lean = -0.22 * ext;
        P.armF = [-0.75, 0.75]; P.armB = [0.9, 0.45];
        break;
      }
      case 'jumpkick': {
        P.legF = [1.55, -0.15]; P.legB = [0.5, 1.1];
        P.armF = [-0.8, 0.5]; P.armB = [1.9, 0.2];
        P.lean = 0.16; P.air = true;
        break;
      }
      case 'special': {
        P.armF = [2.5, 0.3]; P.armB = [-2.5, 0.3];
        P.legF = [0.42, -0.3]; P.legB = [-0.42, -0.3];
        P.lean = -0.1; P.open = 1; P.bob = 0;
        break;
      }
      case 'hurt': {
        P.lean = -0.3; P.headTilt = -0.3;
        P.armF = [-1.3, 0.5]; P.armB = [-1.9, 0.4];
        P.legF = [-0.3, 0.3]; P.legB = [0.4, 0.2];
        P.hurt = 1;
        break;
      }
      case 'getup': {
        P.hipDrop = 9; P.lean = 0.42;
        P.legF = [0.9, -1.5]; P.legB = [-0.7, -1.2];
        P.armF = [0.5, -0.7]; P.armB = [-0.6, -0.8];
        P.bob = 0;
        break;
      }
      case 'victory': {
        P.armF = [2.85, 0.15]; P.armB = [-2.85, 0.15];
        P.lean = -0.12; P.legF = [0.2, -0.1]; P.legB = [-0.2, -0.1];
        P.bob = Math.sin(t * 4) * 1.2;
        break;
      }
      case 'roar': {
        P.armF = [2.1, 0.6]; P.armB = [-2.1, 0.6];
        P.lean = -0.2; P.headTilt = -0.32; P.open = 1;
        P.legF = [0.34, -0.26]; P.legB = [-0.34, -0.26];
        break;
      }
      case 'slam': {
        var u = clamp(at * 2.8, 0, 1);
        var raise = u < 0.5 ? lerp(0.3, 2.9, u * 2) : lerp(2.9, 1.15, (u - 0.5) * 2);
        P.armF = [raise, 0.25]; P.armB = [-raise, 0.25];
        P.lean = u < 0.5 ? -0.16 : 0.3;
        P.legF = [0.4, -0.5]; P.legB = [-0.4, -0.5];
        break;
      }
      case 'cable': {
        P.armF = [1.45, 0.06]; P.armB = [-0.72, 0.55];
        P.lean = 0.1; P.cableSwing = Math.sin(at * 12) * 0.5 + 0.6;
        break;
      }
      case 'ready': {
        P.armF = [1.15, -1.35]; P.armB = [-1.0, 1.3];
        P.legF = [0.42, -0.34]; P.legB = [-0.4, -0.28];
        P.lean = 0.08; P.bob = Math.sin(t * 2.4) * 0.9;
        break;
      }
      case 'charge': {
        P.lean = 0.42; P.armF = [-1.0, 0.65]; P.armB = [-1.2, 0.7];
        P.legF = [0.7, -0.5]; P.legB = [-0.65, -0.4];
        P.bob = Math.abs(Math.sin(t * 12)) * 1.6;
        break;
      }
      case 'dash': {
        P.lean = 0.3; P.armF = [-0.7, 0.5]; P.armB = [0.7, 0.4];
        P.legF = [0.8, -0.6]; P.legB = [-0.8, -0.5];
        break;
      }
      case 'cast': {
        P.armF = [1.8, 0.2]; P.armB = [1.55, -0.1];
        P.lean = 0.06; P.open = 0.6;
        P.float = Math.sin(t * 2) * 1.6;
        break;
      }
      default: break;
    }
    // точечные поправки по типу
    if (charKind(a) === 'khrom') {
      P.float = 7 + Math.sin(t * 1.7) * 1.8 + (P.float || 0);
      if (an !== 'cast') P.open = Math.max(P.open, 0.25);
    }
    if (charKind(a) === 'hammer') {
      P.hipDrop += 2;
      P.legF[1] -= 0.1; P.legB[1] -= 0.1;
    }
    if (charKind(a) === 'brute') {
      P.lean += 0.04;
    }
    return P;
  }

  function rigPoints(P, sk) {
    var hipY = -sk.hip + (P.hipDrop || 0) - (P.bob || 0) - (P.float || 0);
    var lean = P.lean || 0;
    var c = Math.cos(lean), s = Math.sin(lean);
    var hip = [0, hipY];
    var chest = sk.chest;
    var shoulder = [hip[0] + chest * s, hip[1] - chest * c];
    var headC = [
      shoulder[0] + (sk.neck + sk.headR) * Math.sin(lean + (P.headTilt || 0)),
      shoulder[1] - (sk.neck + sk.headR) * Math.cos(lean + (P.headTilt || 0))
    ];
    var hx = sk.shW / 2;
    var shF = [shoulder[0] + hx * c, shoulder[1] + hx * s];
    var shB = [shoulder[0] - hx * c, shoulder[1] - hx * s];
    var hipF = [hip[0] + 3 * c, hip[1] + 3 * s];
    var hipB = [hip[0] - 3 * c, hip[1] - 3 * s];

    function chain(x, y, a1, a2, l1, l2) {
      var ex = x + Math.sin(a1) * l1, ey = y + Math.cos(a1) * l1;
      var hx2 = ex + Math.sin(a1 + a2) * l2, hy2 = ey + Math.cos(a1 + a2) * l2;
      return { mid: [ex, ey], end: [hx2, hy2], a1: a1, a2: a2 };
    }
    return {
      hip: hip, shoulder: shoulder, head: headC,
      shF: shF, shB: shB, hipF: hipF, hipB: hipB,
      armF: chain(shF[0], shF[1], P.armF[0], P.armF[1], sk.upper, sk.fore),
      armB: chain(shB[0], shB[1], P.armB[0], P.armB[1], sk.upper, sk.fore),
      legF: chain(hipF[0], hipF[1], P.legF[0], P.legF[1], sk.thigh, sk.shin),
      legB: chain(hipB[0], hipB[1], P.legB[0], P.legB[1], sk.thigh, sk.shin)
    };
  }

  function limb(ctx, x1, y1, x2, y2, x3, y3, w1, w2, w3, col) {
    ctx.strokeStyle = col;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = w1;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.lineWidth = w2;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.stroke();
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(x2, y2, w2 * 0.52, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(x3, y3, w3 * 0.52, 0, TAU); ctx.fill();
  }

  function drawBoot(ctx, x, y, ang, w, len, pal, flat, bootCol) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-ang);
    ctx.fillStyle = flat ? '#fff' : (bootCol || pal.boots);
    rr(ctx, -w * 0.55, -w * 0.6, len, w * 1.2, 2);
    ctx.fill();
    if (!flat) {
      ctx.fillStyle = pal.bootsL;
      ctx.fillRect(-w * 0.5, -w * 0.6, len * 0.72, w * 0.34);
      ctx.fillStyle = rgba(pal.rim, 0.55);
      ctx.fillRect(w * 0.12, w * 0.2, len * 0.7, 1.2);
    }
    ctx.restore();
  }

  function drawFist(ctx, x, y, r, pal, flat, glove) {
    ctx.fillStyle = flat ? '#fff' : (glove || pal.skin);
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    if (!flat) {
      ctx.fillStyle = pal.skinD;
      ctx.beginPath(); ctx.arc(x - r * 0.15, y + r * 0.3, r * 0.72, 0, TAU); ctx.fill();
      ctx.fillStyle = rgba('#000000', 0.22);
      ctx.beginPath(); ctx.arc(x + r * 0.1, y - r * 0.1, r * 0.5, 0, TAU); ctx.fill();
    }
  }

  /* ---------- общая отрисовка тела ---------- */
  function drawRig(ctx, a, t, P, flat) {
    var kind = charKind(a);
    if (kind === 'khrom') { drawKhromRig(ctx, a, t, P, flat); return; }
    var sk = skFor(a);
    var pal = palFor(a);
    var Q = rigPoints(P, sk);
    var fc = function (col) { return flat ? 'rgba(255,255,255,0.96)' : col; };
    var c = Math.cos(P.lean), s = Math.sin(P.lean);
    var bareArms = (kind === 'hammer' || kind === 'brute');
    var sleeveF = bareArms ? pal.skin : pal.clothL;
    var sleeveB = bareArms ? shade(pal.skinD, -0.06) : pal.clothD;
    var gloveF = kind === 'comet' ? pal.boots : (kind === 'ninja' ? pal.clothD : null);
    // плечевые накладки соединяют руки с корпусом
    ctx.fillStyle = fc(sleeveB);
    ctx.beginPath(); ctx.arc(Q.shB[0], Q.shB[1], sk.aw1 * 0.62, 0, TAU); ctx.fill();
    ctx.fillStyle = fc(sleeveF);
    ctx.beginPath(); ctx.arc(Q.shF[0], Q.shF[1], sk.aw1 * 0.66, 0, TAU); ctx.fill();

    /* --- дальняя рука --- */
    limb(ctx, Q.shB[0], Q.shB[1], Q.armB.mid[0], Q.armB.mid[1], Q.armB.end[0], Q.armB.end[1],
      sk.aw1 * 0.9, sk.aw2 * 0.85, sk.aw2 * 0.8, fc(flat ? '#fff' : sleeveB));
    drawFist(ctx, Q.armB.end[0], Q.armB.end[1], sk.aw2 * 0.62, pal, flat, bareArms ? null : pal.skin);

    /* --- дальняя нога --- */
    var pant = PANT[kind];
    var legBCol = pant ? shade(pant[0], -0.15) : shade(pal.skinD, -0.08);
    var legFCol = pant ? pant[1] : pal.skin;
    if (kind !== 'khrom') {
      limb(ctx, Q.hipB[0], Q.hipB[1], Q.legB.mid[0], Q.legB.mid[1], Q.legB.end[0], Q.legB.end[1],
        sk.lw1, sk.lw2, sk.lw2 * 0.9, fc(flat ? '#fff' : legBCol));
      drawBoot(ctx, Q.legB.end[0], Q.legB.end[1], Q.legB.a1 + Q.legB.a2, sk.lw2 * 1.45, sk.lw2 * 1.75, pal, flat);
    }

    /* --- корпус --- */
    var waistW = 5.2, shW = sk.shW * 0.52;
    ctx.beginPath();
    ctx.moveTo(Q.hipB[0] - 1, Q.hipB[1] + 3);
    ctx.quadraticCurveTo(Q.shoulder[0] - shW - 2, Q.shoulder[1] + 5, Q.shoulder[0] - shW - 1, Q.shoulder[1] - 2);
    ctx.quadraticCurveTo(Q.shoulder[0], Q.shoulder[1] - 5, Q.shoulder[0] + shW + 1, Q.shoulder[1] - 2);
    ctx.quadraticCurveTo(Q.shoulder[0] + shW + 2, Q.shoulder[1] + 5, Q.hipF[0] + 1, Q.hipF[1] + 3);
    ctx.quadraticCurveTo(Q.hip[0], Q.hip[1] + 5, Q.hipB[0] - 1, Q.hipB[1] + 3);
    ctx.closePath();
    if (flat) {
      ctx.fillStyle = '#fff';
    } else {
      ctx.fillStyle = lg(ctx, -waistW, Q.shoulder[1], waistW, Q.hip[1] + 2, [
        0, pal.clothL, 0.45, pal.cloth, 1, pal.clothD
      ]);
    }
    ctx.fill();
    ctx.strokeStyle = fc(rgba(pal.clothD, 0.9));
    ctx.lineWidth = 0.7;
    ctx.stroke();

    /* --- шея --- */
    {
      ctx.strokeStyle = fc(pal.skin);
      ctx.lineWidth = sk.headR * 0.7;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(Q.shoulder[0], Q.shoulder[1] - 2);
      ctx.lineTo(Q.head[0], Q.head[1] + sk.headR * 0.8);
      ctx.stroke();
    }

    /* --- торс-детали --- */
    if (!flat) drawTorsoExtra(ctx, kind, a, t, P, Q, sk, pal);

    /* --- передняя нога --- */
    if (kind !== 'khrom') {
      limb(ctx, Q.hipF[0], Q.hipF[1], Q.legF.mid[0], Q.legF.mid[1], Q.legF.end[0], Q.legF.end[1],
        sk.lw1 * 1.03, sk.lw2 * 1.03, sk.lw2 * 0.92, fc(flat ? '#fff' : legFCol));
      if (!flat && pant) {
        ctx.strokeStyle = rgba(C.white, 0.06);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(Q.legF.mid[0] - 1, Q.legF.mid[1]);
        ctx.lineTo(Q.legF.end[0] - 1, Q.legF.end[1] - 2);
        ctx.stroke();
      }
      drawBoot(ctx, Q.legF.end[0], Q.legF.end[1], Q.legF.a1 + Q.legF.a2, sk.lw2 * 1.5, sk.lw2 * 1.8, pal, flat);
    }

    /* --- голова --- */
    drawHead(ctx, kind, a, t, P, Q, sk, pal, flat, fc);
    if (!flat) {
      // контровой свет по голове и плечу
      ctx.save();
      ctx.strokeStyle = rgba(pal.rim, 0.55);
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.arc(Q.head[0], Q.head[1], sk.headR * 0.98, PI * 1.02, PI * 1.62);
      ctx.stroke();
      ctx.strokeStyle = rgba(pal.rim, 0.30);
      ctx.beginPath();
      ctx.moveTo(Q.shoulder[0] + sk.shW * 0.52, Q.shoulder[1] - 1);
      ctx.quadraticCurveTo(Q.shoulder[0] + sk.shW * 0.58, Q.shoulder[1] + 8, Q.hipF[0] + 2, Q.hipF[1] - 2);
      ctx.stroke();
      ctx.restore();
    }

    /* --- передняя рука --- */
    limb(ctx, Q.shF[0], Q.shF[1], Q.armF.mid[0], Q.armF.mid[1], Q.armF.end[0], Q.armF.end[1],
      sk.aw1, sk.aw2 * 0.92, sk.aw2 * 0.86, fc(flat ? '#fff' : sleeveF));
    if (!flat) {
      ctx.strokeStyle = rgba(pal.accent, 0.65);
      ctx.lineWidth = 1.1;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(Q.shF[0] + 0.6, Q.shF[1] - 1.6);
      ctx.quadraticCurveTo(Q.armF.mid[0] + 0.6, Q.armF.mid[1] - 1, Q.armF.end[0] + 0.4, Q.armF.end[1] - 1.4);
      ctx.stroke();
      ctx.strokeStyle = rgba(pal.clothD, 0.8);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(Q.shF[0], Q.shF[1] + 1.6);
      ctx.quadraticCurveTo(Q.armF.mid[0], Q.armF.mid[1] + 1.4, Q.armF.end[0], Q.armF.end[1] + 1.2);
      ctx.stroke();
    }
    drawFist(ctx, Q.armF.end[0], Q.armF.end[1], sk.aw2 * 0.7, pal, flat, gloveF);

    /* --- передний план: шарф, рука-молот, кастет --- */
    if (!flat) drawFrontExtra(ctx, kind, a, t, P, Q, sk, pal);
  }

  function drawTorsoExtra(ctx, kind, a, t, P, Q, sk, pal) {
    var sx = Q.shoulder[0], sy = Q.shoulder[1];
    if (kind === 'comet') {
      // куртка: циановые полосы и эмблема-комета
      ctx.strokeStyle = rgba(pal.accent, 0.85);
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(sx - sk.shW * 0.42, sy + 1);
      ctx.lineTo(sx + sk.shW * 0.1, sy + 8);
      ctx.stroke();
      ctx.strokeStyle = rgba(pal.accent, 0.4);
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(sx - sk.shW * 0.52, sy + 3);
      ctx.lineTo(sx - sk.shW * 0.2, sy + 12);
      ctx.stroke();
      // воротник
      ctx.fillStyle = pal.clothD;
      ctx.beginPath();
      ctx.moveTo(sx - 5.5, sy - 1);
      ctx.lineTo(sx - 1, sy + 4);
      ctx.lineTo(sx + 1, sy - 1);
      ctx.closePath(); ctx.fill();
      // эмблема: комета с хвостом
      ctx.strokeStyle = rgba(pal.accent2, 0.85);
      ctx.lineWidth = 1.1;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(Q.hip[0] + 1.5, Q.hip[1] - 6.5);
      ctx.lineTo(Q.hip[0] + 5.2, Q.hip[1] - 10.2);
      ctx.stroke();
      ctx.fillStyle = pal.accent2;
      ctx.beginPath(); ctx.arc(Q.hip[0] + 6, Q.hip[1] - 11, 1.7, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff4d8';
      ctx.beginPath(); ctx.arc(Q.hip[0] + 6.3, Q.hip[1] - 11.3, 0.7, 0, TAU); ctx.fill();
      // молния-застёжка
      ctx.strokeStyle = rgba(pal.metal, 0.5);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(sx + 1, sy + 6);
      ctx.lineTo(Q.hip[0] + 1, Q.hip[1] - 2);
      ctx.stroke();
    } else if (kind === 'hammer') {
      // кожаный фартук кузнеца на лямках
      ctx.fillStyle = lg(ctx, 0, sy, 0, Q.hip[1] + 6, [0, pal.apron, 1, pal.apronD]);
      ctx.beginPath();
      ctx.moveTo(sx - sk.shW * 0.3, sy + 4);
      ctx.lineTo(sx + sk.shW * 0.3, sy + 4);
      ctx.lineTo(Q.hip[0] + 8, Q.hip[1] + 6);
      ctx.quadraticCurveTo(Q.hip[0], Q.hip[1] + 8, Q.hip[0] - 8, Q.hip[1] + 6);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = rgba('#000000', 0.35);
      ctx.lineWidth = 0.7;
      ctx.stroke();
      // карман и прострочка
      ctx.fillStyle = rgba(pal.apronD, 0.9);
      ctx.fillRect(Q.hip[0] - 4, Q.hip[1] - 7, 8, 4.5);
      ctx.strokeStyle = rgba(pal.accent2, 0.55);
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(sx - sk.shW * 0.26, sy + 5.5);
      ctx.lineTo(sx + sk.shW * 0.26, sy + 5.5);
      ctx.stroke();
      // лямки
      ctx.strokeStyle = pal.apronD;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(sx - sk.shW * 0.28, sy + 4.5); ctx.lineTo(sx - sk.shW * 0.42, sy - 1);
      ctx.moveTo(sx + sk.shW * 0.28, sy + 4.5); ctx.lineTo(sx + sk.shW * 0.38, sy - 1);
      ctx.stroke();
      // ремень с клёпками
      ctx.fillStyle = '#120c08';
      ctx.fillRect(Q.hip[0] - 9, Q.hip[1] - 2.5, 18, 3);
      ctx.fillStyle = rgba(pal.metal, 0.9);
      ctx.fillRect(Q.hip[0] - 2, Q.hip[1] - 2.5, 4, 3);
      // искры-ожоги на фартуке
      ctx.fillStyle = rgba(pal.accent, 0.7);
      ctx.beginPath(); ctx.arc(sx - 4, sy + 11, 0.8, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(sx + 5, sy + 14, 0.6, 0, TAU); ctx.fill();
    } else if (kind === 'punk') {
      // косуха
      ctx.fillStyle = 'rgba(6,4,10,0.55)';
      ctx.beginPath();
      ctx.moveTo(sx - 1, sy - 2);
      ctx.lineTo(sx + 2, sy + 8);
      ctx.lineTo(sx - 2, Q.hip[1] - 2);
      ctx.lineTo(sx - 6, Q.hip[1] - 4);
      ctx.closePath(); ctx.fill();
      // заклёпки
      ctx.fillStyle = rgba(pal.metal, 0.9);
      for (var i = 0; i < 4; i++) {
        ctx.beginPath(); ctx.arc(sx - 7 + i * 2.4, sy + 3 + i * 3.4, 1, 0, TAU); ctx.fill();
      }
      // цепь на поясе
      ctx.strokeStyle = rgba(pal.metal, 0.55);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(Q.hip[0] - 7, Q.hip[1] - 2);
      ctx.quadraticCurveTo(Q.hip[0], Q.hip[1] + 4, Q.hip[0] + 8, Q.hip[1] - 3);
      ctx.stroke();
      // неоновая нашивка
      ctx.fillStyle = rgba(pal.accent, 0.9);
      ctx.fillRect(sx - 2, sy + 10, 5, 1.6);
      ctx.fillRect(sx - 2, sy + 13, 3, 1.6);
    } else if (kind === 'ninja') {
      // пояс-оби и нагрудные обмотки
      ctx.fillStyle = rgba(pal.accent2, 0.85);
      ctx.fillRect(Q.hip[0] - 6, Q.hip[1] - 5, 13, 3);
      ctx.fillStyle = rgba(pal.clothD, 0.9);
      ctx.beginPath();
      ctx.moveTo(sx - sk.shW * 0.45, sy);
      ctx.lineTo(sx + sk.shW * 0.1, sy + 15);
      ctx.lineTo(sx + sk.shW * 0.5, sy + 2);
      ctx.lineTo(sx + sk.shW * 0.2, sy - 3);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = rgba(pal.accent, 0.55);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx - 4, sy + 4);
      ctx.lineTo(sx + 3, sy + 11);
      ctx.stroke();
    } else if (kind === 'brute') {
      // цепи через торс
      ctx.strokeStyle = rgba(pal.metal, 0.75);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(sx - sk.shW * 0.5, sy + 2);
      ctx.quadraticCurveTo(sx, sy + 14, Q.hip[0] + 6, Q.hip[1] - 2);
      ctx.stroke();
      ctx.strokeStyle = rgba('#8a93ab', 0.5);
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(sx + sk.shW * 0.4, sy + 1);
      ctx.quadraticCurveTo(sx, sy + 17, Q.hip[0] - 7, Q.hip[1] - 1);
      ctx.stroke();
      // звенья
      ctx.fillStyle = rgba(pal.metal, 0.85);
      for (var k = 0; k < 6; k++) {
        var u = k / 5;
        var cx = lerp(sx - sk.shW * 0.5, Q.hip[0] + 6, u);
        var cy = lerp(sy + 2, Q.hip[1] - 2, u) + Math.sin(u * PI) * 6;
        ctx.beginPath(); ctx.arc(cx, cy, 1.3, 0, TAU); ctx.fill();
      }
      // ремень
      ctx.fillStyle = '#150b06';
      ctx.fillRect(Q.hip[0] - 8, Q.hip[1] - 4, 16, 4);
      ctx.fillStyle = rgba(pal.accent, 0.9);
      ctx.fillRect(Q.hip[0] - 2.5, Q.hip[1] - 4, 5, 4);
    }
  }

  function drawHead(ctx, kind, a, t, P, Q, sk, pal, flat, fc) {
    var hx = Q.head[0], hy = Q.head[1];
    var r = sk.headR;
    // базовая голова
    ctx.fillStyle = flat ? '#fff' : pal.skin;
    ctx.beginPath();
    if (kind === 'brute') ctx.ellipse(hx, hy, r * 0.94, r * 0.98, 0, 0, TAU);
    else if (kind === 'khrom') ctx.ellipse(hx, hy, r * 0.86, r * 1.02, 0, 0, TAU);
    else ctx.ellipse(hx, hy + 0.5, r * 0.92, r, 0, 0, TAU);
    ctx.fill();
    if (!flat) {
      // тень челюсти
      ctx.fillStyle = rgba(pal.skinD, 0.75);
      ctx.beginPath();
      ctx.ellipse(hx + r * 0.06, hy + r * 0.56, r * 0.7, r * 0.38, 0, 0, TAU);
      ctx.fill();
      // подсветка скулы
      ctx.fillStyle = rgba(pal.skinL, 0.35);
      ctx.beginPath();
      ctx.ellipse(hx - r * 0.3, hy - r * 0.32, r * 0.4, r * 0.34, -0.4, 0, TAU);
      ctx.fill();
      // глаз (неоновый)
      var eyeY = hy - r * 0.08;
      var eyeX = hx + r * 0.30;
      ctx.fillStyle = kind === 'khrom' ? C.pink : (kind === 'ninja' ? C.cyan : pal.rim);
      ctx.save();
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.ellipse(eyeX, eyeY, r * 0.30, r * 0.15, -0.18, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.arc(eyeX - r * 0.08, eyeY - r * 0.03, r * 0.075, 0, TAU);
      ctx.fill();
      ctx.restore();
      // бровь
      ctx.strokeStyle = rgba(pal.hair, 0.9);
      ctx.lineWidth = kind === 'brute' ? 2.4 : 1.4;
      ctx.beginPath();
      ctx.moveTo(hx - r * 0.35, hy - r * 0.42);
      ctx.lineTo(hx + r * 0.52, hy - r * 0.3);
      ctx.stroke();
      // рот
      ctx.strokeStyle = rgba('#170a12', 0.8);
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      if (kind === 'brute' || kind === 'khrom') {
        ctx.moveTo(hx + r * 0.05, hy + r * 0.5);
        ctx.lineTo(hx + r * 0.55, hy + r * 0.46);
      } else {
        ctx.moveTo(hx + r * 0.1, hy + r * 0.46);
        ctx.lineTo(hx + r * 0.5, hy + r * 0.4);
      }
      ctx.stroke();
    }
    // волосы/маски/шлемы
    if (kind === 'comet') {
      ctx.fillStyle = flat ? '#fff' : pal.hair;
      ctx.beginPath();
      ctx.moveTo(hx - r * 0.95, hy - r * 0.2);
      ctx.lineTo(hx - r * 0.7, hy - r * 1.25);
      ctx.lineTo(hx - r * 0.3, hy - r * 0.72);
      ctx.lineTo(hx - r * 0.02, hy - r * 1.42);
      ctx.lineTo(hx + r * 0.3, hy - r * 0.82);
      ctx.lineTo(hx + r * 0.62, hy - r * 1.32);
      ctx.lineTo(hx + r * 0.82, hy - r * 0.5);
      ctx.lineTo(hx + r * 0.95, hy - r * 0.12);
      ctx.quadraticCurveTo(hx + r * 0.2, hy - r * 0.62, hx - r * 0.95, hy - r * 0.2);
      ctx.closePath();
      ctx.fill();
      if (!flat) {
        ctx.strokeStyle = rgba(pal.accent, 0.8);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(hx - r * 0.55, hy - r * 1.0);
        ctx.lineTo(hx - r * 0.4, hy - r * 0.6);
        ctx.stroke();
      }
      // шарф у шеи
      ctx.fillStyle = flat ? '#fff' : pal.accent2;
      ctx.beginPath();
      ctx.ellipse(hx - r * 0.05, hy + r * 0.95, r * 0.85, r * 0.34, 0, 0, TAU);
      ctx.fill();
    } else if (kind === 'punk') {
      // ирокез
      ctx.fillStyle = flat ? '#fff' : pal.hair;
      ctx.beginPath();
      ctx.moveTo(hx - r * 0.5, hy - r * 0.75);
      ctx.lineTo(hx - r * 0.25, hy - r * 1.85);
      ctx.lineTo(hx + r * 0.05, hy - r * 0.9);
      ctx.lineTo(hx + r * 0.3, hy - r * 1.9);
      ctx.lineTo(hx + r * 0.5, hy - r * 0.85);
      ctx.lineTo(hx + r * 0.68, hy - r * 1.55);
      ctx.lineTo(hx + r * 0.8, hy - r * 0.4);
      ctx.lineTo(hx + r * 0.45, hy - r * 0.55);
      ctx.closePath();
      ctx.fill();
      if (!flat) {
        ctx.strokeStyle = rgba(C.magenta, 0.9);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(hx - r * 0.2, hy - r * 1.6);
        ctx.lineTo(hx - r * 0.28, hy - r * 0.86);
        ctx.stroke();
        // серьга
        ctx.fillStyle = C.lime;
        ctx.beginPath(); ctx.arc(hx + r * 0.78, hy + r * 0.55, 1.3, 0, TAU); ctx.fill();
      }
    } else if (kind === 'ninja') {
      // маска
      ctx.fillStyle = flat ? '#fff' : pal.clothD;
      ctx.beginPath();
      ctx.ellipse(hx + r * 0.06, hy + r * 0.12, r * 0.94, r * 1.0, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = flat ? '#fff' : '#0b0718';
      ctx.beginPath();
      ctx.ellipse(hx + r * 0.28, hy - r * 0.05, r * 0.26, r * 0.62, -0.2, 0, TAU);
      ctx.fill();
      if (!flat) {
        ctx.save();
        ctx.shadowColor = C.cyan; ctx.shadowBlur = 8;
        ctx.fillStyle = C.cyan;
        ctx.beginPath();
        ctx.ellipse(hx + r * 0.28, hy - r * 0.1, r * 0.16, r * 0.07, -0.3, 0, TAU);
        ctx.fill();
        ctx.restore();
        // хвост маски
        ctx.strokeStyle = rgba(pal.clothL, 0.9);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(hx - r * 0.7, hy + r * 0.2);
        ctx.quadraticCurveTo(hx - r * 1.7, hy + r * 0.6 + Math.sin(t * 5) * 2, hx - r * 2.3, hy + r * 0.1);
        ctx.stroke();
      }
    } else if (kind === 'brute') {
      // лысая голова с татуировкой и шипами
      if (!flat) {
        ctx.strokeStyle = rgba('#7a3a0a', 0.8);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(hx - r * 0.5, hy - r * 0.55);
        ctx.quadraticCurveTo(hx, hy - r * 0.8, hx + r * 0.5, hy - r * 0.5);
        ctx.stroke();
        ctx.fillStyle = rgba(pal.accent, 0.9);
        ctx.beginPath(); ctx.arc(hx - r * 0.5, hy - r * 0.15, 1.2, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(hx + r * 0.55, hy - r * 0.1, 1, 0, TAU); ctx.fill();
        // металлические шипы на плече
        ctx.fillStyle = rgba(pal.metal, 0.9);
        ctx.beginPath();
        ctx.moveTo(hx - r * 0.2, hy - r * 1.05);
        ctx.lineTo(hx, hy - r * 1.45);
        ctx.lineTo(hx + r * 0.16, hy - r * 1.0);
        ctx.closePath(); ctx.fill();
      }
    } else if (kind === 'hammer') {
      // бритая голова с бликом, окладистая борода, кибер-глаз в стальной оправе
      if (!flat) {
        ctx.fillStyle = rgba(pal.skinL, 0.45);
        ctx.beginPath();
        ctx.ellipse(hx - r * 0.1, hy - r * 0.72, r * 0.5, r * 0.2, -0.2, 0, TAU);
        ctx.fill();
        ctx.fillStyle = rgba(pal.skinD, 0.6);
        ctx.beginPath();
        ctx.ellipse(hx - r * 0.62, hy - r * 0.05, r * 0.26, r * 0.6, 0, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = flat ? '#fff' : pal.hair;
      ctx.beginPath();
      ctx.moveTo(hx - r * 0.78, hy + r * 0.05);
      ctx.quadraticCurveTo(hx - r * 0.7, hy + r * 1.05, hx + r * 0.1, hy + r * 1.42);
      ctx.quadraticCurveTo(hx + r * 0.85, hy + r * 1.1, hx + r * 0.92, hy + r * 0.2);
      ctx.quadraticCurveTo(hx + r * 0.55, hy + r * 0.5, hx + r * 0.15, hy + r * 0.32);
      ctx.quadraticCurveTo(hx - r * 0.35, hy + r * 0.45, hx - r * 0.78, hy + r * 0.05);
      ctx.closePath();
      ctx.fill();
      if (!flat) {
        // рот в бороде
        ctx.strokeStyle = rgba('#120806', 0.9);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(hx + r * 0.12, hy + r * 0.62);
        ctx.lineTo(hx + r * 0.6, hy + r * 0.56);
        ctx.stroke();
        // стальная оправа кибер-глаза и скоба к виску
        ctx.strokeStyle = pal.metal;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.ellipse(hx + r * 0.3, hy - r * 0.08, r * 0.42, r * 0.3, -0.18, 0, TAU);
        ctx.stroke();
        ctx.strokeStyle = pal.metalD;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(hx - r * 0.1, hy - r * 0.12);
        ctx.lineTo(hx - r * 0.75, hy - r * 0.2);
        ctx.stroke();
        drawGlow(ctx, hx + r * 0.3, hy - r * 0.08, r * 0.9, pal.accent, 0.4, 'lighter');
      }
    }
  }

  function drawFrontExtra(ctx, kind, a, t, P, Q, sk, pal) {
    if (kind === 'comet') {
      // развевающийся шарф
      var wave = Math.sin(t * 7 + (a.id || 1)) * 1.8 + P.ext * 2;
      var x0 = Q.shoulder[0] - 2, y0 = Q.shoulder[1] + 1;
      ctx.strokeStyle = pal.accent2;
      ctx.lineWidth = 1.9;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.bezierCurveTo(x0 - 6 - wave, y0 + 4, x0 - 10 - wave, y0 + 10, x0 - 15 - wave * 1.4, y0 + 12 + wave);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x0, y0 + 1.4);
      ctx.bezierCurveTo(x0 - 4 + wave, y0 + 7, x0 - 8 + wave, y0 + 14, x0 - 11 + wave * 1.6, y0 + 18);
      ctx.stroke();
      ctx.strokeStyle = rgba('#ffd08a', 0.8);
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.bezierCurveTo(x0 - 6 - wave, y0 + 4, x0 - 10 - wave, y0 + 10, x0 - 15 - wave * 1.4, y0 + 12 + wave);
      ctx.stroke();
      // узел
      ctx.fillStyle = pal.accent2;
      ctx.beginPath(); ctx.arc(x0, y0, 2.3, 0, TAU); ctx.fill();
    } else if (kind === 'ninja') {
      // хвост шарфа
      var w2 = Math.sin(t * 6.5 + (a.id || 1) * 2) * 2.8;
      ctx.strokeStyle = rgba(pal.accent, 0.85);
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(Q.shoulder[0] - 2, Q.shoulder[1] + 2);
      ctx.bezierCurveTo(Q.shoulder[0] - 8, Q.shoulder[1] + 6, Q.shoulder[0] - 13 - w2, Q.shoulder[1] + 14, Q.shoulder[0] - 17 - w2, Q.shoulder[1] + 9 + w2);
      ctx.stroke();
    } else if (kind === 'hammer') {
      drawHammerArm(ctx, a, t, P, Q, sk, pal);
    } else if (kind === 'brute') {
      // шипы на кулаках
      ctx.fillStyle = rgba(pal.metal, 0.9);
      var fx = Q.armF.end[0], fy = Q.armF.end[1];
      for (var i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(fx + 1 + i * 2, fy - 4);
        ctx.lineTo(fx + 2.5 + i * 2, fy - 7.5);
        ctx.lineTo(fx + 4 + i * 2, fy - 4);
        ctx.closePath();
        ctx.fill();
      }
    } else if (kind === 'punk') {
      // светящаяся бита? нет — кастет
      ctx.strokeStyle = rgba(pal.metal, 0.9);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(Q.armF.end[0] + 1, Q.armF.end[1] - 1, 3.2, PI * 0.9, PI * 2.1);
      ctx.stroke();
    }
  }

  /* МОЛОТ: механическая рука с бойком вместо кулака (передняя) + наруч на живой руке */
  function drawHammerArm(ctx, a, t, P, Q, sk, pal) {
    var sh = Q.shF, mid = Q.armF.mid, end = Q.armF.end;
    // плечевой шарнир-наплечник
    ctx.fillStyle = lg(ctx, sh[0], sh[1] - 5, sh[0], sh[1] + 4, [0, '#eef2ff', 0.4, pal.metal, 1, pal.metalD]);
    ctx.beginPath(); ctx.ellipse(sh[0], sh[1] - 0.5, sk.aw1 * 0.78, sk.aw1 * 0.62, 0, 0, TAU); ctx.fill();
    // сегменты: плечо — тёмная сталь, предплечье — светлая, поршень
    ctx.lineCap = 'round';
    ctx.strokeStyle = pal.metalD;
    ctx.lineWidth = sk.aw1 * 0.82;
    ctx.beginPath(); ctx.moveTo(sh[0], sh[1]); ctx.lineTo(mid[0], mid[1]); ctx.stroke();
    ctx.strokeStyle = pal.metal;
    ctx.lineWidth = sk.aw2 * 0.95;
    ctx.beginPath(); ctx.moveTo(mid[0], mid[1]); ctx.lineTo(end[0], end[1]); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(mid[0], mid[1] - 1.4); ctx.lineTo(end[0], end[1] - 1.4); ctx.stroke();
    ctx.strokeStyle = rgba(pal.accent, 0.8);
    ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(sh[0] + 1, sh[1] + 1.5); ctx.lineTo(mid[0] + 1, mid[1] + 1.5); ctx.stroke();
    // локтевой узел с огоньком
    ctx.fillStyle = pal.metalD;
    ctx.beginPath(); ctx.arc(mid[0], mid[1], sk.aw2 * 0.62, 0, TAU); ctx.fill();
    ctx.fillStyle = pal.accent;
    ctx.beginPath(); ctx.arc(mid[0], mid[1], 1.1, 0, TAU); ctx.fill();
    // боёк: стальной блок по оси предплечья, ударная грань раскалена
    var ang = Math.atan2(end[1] - mid[1], end[0] - mid[0]);
    ctx.save();
    ctx.translate(end[0], end[1]);
    ctx.rotate(ang);
    ctx.fillStyle = lg(ctx, 0, -6, 0, 6, [0, '#f2f5ff', 0.35, pal.metal, 1, pal.metalD]);
    rr(ctx, -2.5, -6, 9, 12, 1.4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(10,10,20,0.55)';
    ctx.lineWidth = 0.7;
    ctx.stroke();
    ctx.fillStyle = 'rgba(20,20,34,0.45)';
    ctx.fillRect(-2.5, -0.6, 9, 1.2);
    ctx.shadowColor = pal.accent;
    ctx.shadowBlur = 6 + P.ext * 6;
    ctx.fillStyle = lg(ctx, 0, -6, 0, 6, [0, pal.accent2, 0.5, pal.accent, 1, '#ff4d1f']);
    ctx.fillRect(5.6, -5.4, 1.6, 10.8);
    ctx.restore();
    if (P.ext > 0.6) drawGlow(ctx, end[0] + Math.cos(ang) * 7, end[1] + Math.sin(ang) * 7, 6, pal.accent, 0.35 * P.ext, 'lighter');
    // наруч на живой (дальней) руке
    var bm = Q.armB.mid, be = Q.armB.end;
    ctx.strokeStyle = pal.metalD;
    ctx.lineWidth = sk.aw2 * 1.05;
    ctx.beginPath();
    ctx.moveTo(lerp(bm[0], be[0], 0.35), lerp(bm[1], be[1], 0.35));
    ctx.lineTo(lerp(bm[0], be[0], 0.8), lerp(bm[1], be[1], 0.8));
    ctx.stroke();
  }

  /* ХРОМ-9: корпоративный ИИ в теле промышленного погрузчика.
     Ховер-шасси, бронекорпус с реактором, голова-монитор, два манипулятора;
     дальняя атака — силовой кабель с захватом (механика атаки та же). */
  function drawKhromRig(ctx, a, t, P, flat) {
    var sk = SK.khrom, pal = PAL.khrom;
    var Q = rigPoints(P, sk);
    var hot = !!a.phase2;
    var eye = hot ? C.orange : C.cyan;
    var W_ = function (col) { return flat ? 'rgba(255,255,255,0.96)' : col; };
    var hip = Q.hip, shd = Q.shoulder;

    // --- реактивные струи под шасси ---
    if (!flat) {
      for (var j = -1; j <= 1; j++) {
        var jx = hip[0] + j * 10, jy = hip[1] + 16;
        var fl = 5 + Math.sin(t * 30 + j * 2) * 1.5;
        ctx.fillStyle = lg(ctx, jx, jy, jx, jy + fl + 4, [0, rgba(j ? C.cyan : C.pink, 0.9), 1, rgba(j ? C.cyan : C.pink, 0)]);
        ctx.beginPath();
        ctx.moveTo(jx - 2.4, jy); ctx.lineTo(jx + 2.4, jy); ctx.lineTo(jx, jy + fl + 4);
        ctx.closePath(); ctx.fill();
        drawGlow(ctx, jx, jy + 2, 6, j ? C.cyan : C.pink, 0.35, 'lighter');
      }
    }

    // --- дальний манипулятор ---
    drawManip(ctx, Q.shB, Q.armB, sk, pal, flat, true, t);

    // --- ховер-шасси ---
    var by = hip[1] + 2;
    ctx.beginPath();
    ctx.moveTo(hip[0] - 13, by);
    ctx.lineTo(hip[0] + 13, by);
    ctx.lineTo(hip[0] + 19, by + 12);
    ctx.lineTo(hip[0] - 19, by + 12);
    ctx.closePath();
    ctx.fillStyle = flat ? '#fff' : lg(ctx, 0, by, 0, by + 14, [0, pal.clothL, 0.5, pal.cloth, 1, pal.clothD]);
    ctx.fill();
    if (!flat) {
      // полоса «осторожно»
      ctx.save();
      ctx.beginPath();
      ctx.rect(hip[0] - 19, by + 9, 38, 4);
      ctx.clip();
      ctx.fillStyle = '#16130a';
      ctx.fillRect(hip[0] - 19, by + 9, 38, 4);
      ctx.fillStyle = pal.hazard;
      for (var hz = -22; hz < 22; hz += 4) {
        ctx.beginPath();
        ctx.moveTo(hip[0] + hz, by + 13); ctx.lineTo(hip[0] + hz + 2, by + 13);
        ctx.lineTo(hip[0] + hz + 4, by + 9); ctx.lineTo(hip[0] + hz + 2, by + 9);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
      // габаритные огни
      drawGlow(ctx, hip[0] - 16, by + 5, 3, C.pink, 0.9, 'lighter');
      drawGlow(ctx, hip[0] + 16, by + 5, 3, C.cyan, 0.9, 'lighter');
    }

    // --- бронекорпус ---
    var c = Math.cos(P.lean), s = Math.sin(P.lean);
    ctx.beginPath();
    ctx.moveTo(shd[0] - 14 * c, shd[1] - 14 * s - 1);
    ctx.lineTo(shd[0] + 14 * c, shd[1] + 14 * s - 1);
    ctx.lineTo(hip[0] + 11, hip[1] + 3);
    ctx.lineTo(hip[0] - 11, hip[1] + 3);
    ctx.closePath();
    ctx.fillStyle = flat ? '#fff' : lg(ctx, -12, shd[1], 12, hip[1], [0, pal.clothL, 0.45, pal.cloth, 1, pal.clothD]);
    ctx.fill();
    if (!flat) {
      ctx.strokeStyle = rgba(pal.metal, 0.5);
      ctx.lineWidth = 0.8;
      ctx.stroke();
      // кромка-неон и стыки панелей
      ctx.strokeStyle = rgba(pal.accent, 0.75);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hip[0] - 9, hip[1] - 1); ctx.lineTo(hip[0] + 9, hip[1] - 1);
      ctx.stroke();
      ctx.strokeStyle = rgba('#000000', 0.35);
      ctx.beginPath();
      ctx.moveTo(shd[0] - 6, shd[1] + 2); ctx.lineTo(hip[0] - 5, hip[1] - 3);
      ctx.moveTo(shd[0] + 6, shd[1] + 2); ctx.lineTo(hip[0] + 5, hip[1] - 3);
      ctx.stroke();
      // реактор
      var rx = lerp(shd[0], hip[0], 0.5), ry = lerp(shd[1], hip[1], 0.5);
      var pul = 0.75 + 0.25 * Math.sin(t * 5);
      ctx.fillStyle = '#0a0b16';
      ctx.beginPath(); ctx.arc(rx, ry, 5.2, 0, TAU); ctx.fill();
      ctx.strokeStyle = pal.metal;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.save();
      ctx.shadowColor = eye; ctx.shadowBlur = 10;
      ctx.fillStyle = rgba(eye, pul);
      ctx.beginPath(); ctx.arc(rx, ry, 3.2, 0, TAU); ctx.fill();
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath(); ctx.arc(rx - 0.8, ry - 0.8, 1, 0, TAU); ctx.fill();
      drawGlow(ctx, rx, ry, 11, eye, 0.3 * pul, 'lighter');
    }

    // --- штанга и голова-монитор ---
    var hx = Q.head[0], hy = Q.head[1];
    ctx.strokeStyle = W_(pal.metalD);
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(shd[0], shd[1]); ctx.lineTo(hx, hy + 5); ctx.stroke();
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate((P.headTilt || 0) * 0.5 + P.lean * 0.3);
    ctx.fillStyle = flat ? '#fff' : lg(ctx, 0, -7, 0, 7, [0, pal.metal, 1, pal.metalD]);
    rr(ctx, -10, -7.5, 20, 14, 2.4);
    ctx.fill();
    if (!flat) {
      ctx.fillStyle = '#05060d';
      rr(ctx, -8.4, -6, 16.8, 11, 1.6);
      ctx.fill();
      // лицо на экране
      ctx.save();
      ctx.shadowColor = eye; ctx.shadowBlur = 7;
      ctx.fillStyle = eye;
      var angry = a.anim === 'roar' || a.anim === 'cable' || hot;
      ctx.beginPath();
      ctx.moveTo(-6, -3.2 + (angry ? -1.2 : 0)); ctx.lineTo(-1.6, -2.6); ctx.lineTo(-1.6, -1.2); ctx.lineTo(-6, -1.4);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(6, -3.2 + (angry ? -1.2 : 0)); ctx.lineTo(1.6, -2.6); ctx.lineTo(1.6, -1.2); ctx.lineTo(6, -1.4);
      ctx.closePath(); ctx.fill();
      // рот-осциллограмма
      ctx.strokeStyle = C.pink;
      ctx.shadowColor = C.pink;
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      var amp = a.anim === 'roar' ? 2 : 0.9;
      for (var m = 0; m <= 10; m++) {
        var mx = -5 + m, my = 2.4 + Math.sin(t * 18 + m * 1.3) * amp;
        if (m) ctx.lineTo(mx, my); else ctx.moveTo(mx, my);
      }
      ctx.stroke();
      ctx.restore();
      // скан-линия и блик стекла
      ctx.fillStyle = rgba(eye, 0.12);
      ctx.fillRect(-8.4, -6 + ((t * 14) % 11), 16.8, 1);
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      ctx.beginPath(); ctx.moveTo(-8, -6); ctx.lineTo(-2, -6); ctx.lineTo(-6, 5); ctx.lineTo(-8, 5); ctx.closePath(); ctx.fill();
      // антенна
      ctx.strokeStyle = pal.metal;
      ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.moveTo(6, -7.5); ctx.lineTo(7.5, -13); ctx.stroke();
      drawGlow(ctx, 7.5, -13.5, 2.6, Math.sin(t * 7) > 0 ? C.pink : C.violet, 0.95, 'lighter');
    }
    ctx.restore();
    if (!flat) drawGlow(ctx, hx, hy, 15, eye, 0.12, 'lighter');

    // --- передний манипулятор и кабель ---
    drawManip(ctx, Q.shF, Q.armF, sk, pal, flat, false, t);
    if (!flat) drawKhromCable(ctx, a, t, P, Q.armF);
  }

  function drawManip(ctx, sh, arm, sk, pal, flat, back, t) {
    var mid = arm.mid, end = arm.end;
    var body = flat ? '#fff' : (back ? pal.clothD : pal.metalD);
    var light = flat ? '#fff' : (back ? pal.metalD : pal.metal);
    ctx.lineCap = 'round';
    ctx.strokeStyle = body;
    ctx.lineWidth = sk.aw1;
    ctx.beginPath(); ctx.moveTo(sh[0], sh[1]); ctx.lineTo(mid[0], mid[1]); ctx.stroke();
    ctx.strokeStyle = light;
    ctx.lineWidth = sk.aw2;
    ctx.beginPath(); ctx.moveTo(mid[0], mid[1]); ctx.lineTo(end[0], end[1]); ctx.stroke();
    if (!flat) {
      // гидравлика
      ctx.strokeStyle = rgba(pal.hazard, back ? 0.35 : 0.7);
      ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.moveTo(sh[0] + 1.5, sh[1] + 2); ctx.lineTo(mid[0] + 1.5, mid[1] + 1); ctx.stroke();
    }
    // суставы
    ctx.fillStyle = light;
    ctx.beginPath(); ctx.arc(sh[0], sh[1], sk.aw1 * 0.8, 0, TAU); ctx.fill();
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.arc(mid[0], mid[1], sk.aw2 * 0.65, 0, TAU); ctx.fill();
    if (!flat) {
      ctx.fillStyle = back ? rgba(pal.hazard, 0.5) : pal.hazard;
      ctx.beginPath(); ctx.arc(mid[0], mid[1], 1.1, 0, TAU); ctx.fill();
      ctx.fillStyle = '#0a0b16';
      ctx.beginPath(); ctx.arc(sh[0], sh[1], 1.4, 0, TAU); ctx.fill();
    }
    // клешня-захват
    var ang = Math.atan2(end[1] - mid[1], end[0] - mid[0]);
    ctx.save();
    ctx.translate(end[0], end[1]);
    ctx.rotate(ang);
    ctx.fillStyle = light;
    rr(ctx, -2, -2.6, 4.4, 5.2, 1);
    ctx.fill();
    ctx.strokeStyle = light;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(2, -2); ctx.lineTo(5.5, -3.2); ctx.lineTo(7, -1);
    ctx.moveTo(2, 2); ctx.lineTo(5.5, 3.2); ctx.lineTo(7, 1);
    ctx.stroke();
    ctx.restore();
  }

  function drawKhromCable(ctx, a, t, P, arm) {
    var on = a.anim === 'cable';
    var ext = on ? clamp(P.ext, 0, 1) : 0;
    var hx = arm.end[0], hy = arm.end[1];
    var pts = [];
    var n = 12;
    var len = on ? 16 + ext * 58 : 0;
    for (var i = 0; i <= n; i++) {
      var k = i / n;
      if (on) {
        pts.push([hx + 5 + len * k, hy + Math.sin(k * 7 + t * 16) * (1 + k * 3.2) * (1.2 - ext * 0.6) + (P.cableSwing || 0) * k * 2]);
      } else {
        pts.push([hx + 3 + k * 4 + Math.sin(t * 2 + k * 3) * k, hy + 2 + k * 12]);
      }
    }
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0d1a24';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    for (var j = 0; j <= n; j++) { if (j) ctx.lineTo(pts[j][0], pts[j][1]); else ctx.moveTo(pts[j][0], pts[j][1]); }
    ctx.stroke();
    ctx.strokeStyle = on ? C.cyan : rgba(C.cyan, 0.55);
    ctx.shadowColor = C.cyan;
    ctx.shadowBlur = on ? 8 : 3;
    ctx.lineWidth = 1;
    ctx.setLineDash([2.2, 1.8]);
    ctx.lineDashOffset = -t * 30;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    var tip = pts[n];
    if (on) {
      ctx.save();
      ctx.translate(tip[0], tip[1]);
      ctx.fillStyle = PAL.khrom.metal;
      rr(ctx, -1.5, -2.4, 3.6, 4.8, 0.8);
      ctx.fill();
      ctx.strokeStyle = PAL.khrom.metal;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(1.8, -2); ctx.lineTo(5, -3.4); ctx.lineTo(6.6, -0.8);
      ctx.moveTo(1.8, 2); ctx.lineTo(5, 3.4); ctx.lineTo(6.6, 0.8);
      ctx.stroke();
      ctx.restore();
      drawGlow(ctx, tip[0] + 4, tip[1], 5 + ext * 4, C.pink, 0.5 + ext * 0.3, 'lighter');
    } else {
      drawGlow(ctx, tip[0], tip[1], 2.4, C.cyan, 0.7, 'lighter');
    }
  }

  /* ---------- тень, отражение, актёр ---------- */
  function drawShadow(ctx, x, y, sc, z) {
    var k = clamp(1 - (z || 0) / 220, 0.3, 1);
    var rx = 13 * sc * k, ry = 3.6 * sc * k;
    ctx.save();
    ctx.globalAlpha *= 0.55 * k;
    ctx.fillStyle = '#020108';
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha *= 0.5;
    ctx.fillStyle = '#000000';
    ctx.beginPath(); ctx.ellipse(x, y + 0.6, rx * 0.7, ry * 0.7, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }

  function drawActor(ctx, a, t, camX, opts) {
    if (!a) return;
    opts = opts || {};
    var kind = charKind(a);
    var sk = skFor(a);
    var pal = palFor(a);
    var sc = (a.scale || 1) * 1.08 * (0.94 + clamp(((a.y || 210) - 174) / 76, 0, 1) * 0.13);
    if (kind === 'khrom') sc *= 0.84;
    var sx = (a.x || 0) - camX;
    var baseY = a.y || 210;
    var sy = baseY - (a.z || 0);
    var down = a.anim === 'down' || a.anim === 'dead' || a.state === 'down' || a.dead;
    var P = actorPose(a, t);
    if (down) { P.lean = 0.02; P.hipDrop = 0; P.bob = 0; }

    ctx.save();
    ctx.globalAlpha *= (a.alpha == null ? 1 : a.alpha);
    if (!opts.portrait) drawShadow(ctx, sx, baseY, sc, a.z);

    // подсветка пола под героем
    if (!opts.portrait && (kind === 'comet' || kind === 'hammer')) {
      drawGlow(ctx, sx, baseY + 1, 26 * sc, pal.rim, 0.10, 'lighter');
    }

    // отражение на мокром полу
    if (!opts.portrait && !opts.noReflect && !down) {
      ctx.save();
      ctx.globalAlpha *= 0.16;
      ctx.translate(sx, baseY);
      ctx.scale((a.facing < 0 ? -1 : 1), -0.42);
      ctx.scale(sc, sc);
      drawRig(ctx, a, t, P, false);
      ctx.restore();
      // затухание отражения
      ctx.save();
      var fade = lg(ctx, 0, baseY, 0, baseY + 34, [0, 'rgba(5,4,14,0)', 1, 'rgba(5,4,14,0.75)']);
      ctx.fillStyle = fade;
      ctx.fillRect(sx - 44 * sc, baseY, 88 * sc, 34);
      ctx.restore();
    }

    // контровой свет, отделяющий силуэт от фона
    if (!opts.portrait) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(ctx, sx, sy - 28 * sc, 26 * sc, pal.rim, 0.055, 'lighter');
      ctx.restore();
    }

    // телеграф атаки врага
    if (!opts.portrait && a.attack && a.attack.phase === 'wind' && !a.dead) {
      drawTelegraph(ctx, a, sx, baseY, t);
    }

    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(a.facing < 0 ? -sc : sc, sc);
    if (down) {
      // лежит: поворот вокруг ступней
      ctx.translate(0, -6 * sc);
      ctx.rotate(a.facing < 0 ? 1.35 : -1.35);
    }
    if (a.invuln > 0 && a.kind === 'player' && !a.dead) {
      ctx.globalAlpha *= 0.68 + 0.32 * Math.sin(t * 34);
    }
    drawRig(ctx, a, t, P, false);

    // вспышка попадания
    if (a.flash > 0.02) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = clamp(a.flash, 0, 1) * 0.55;
      drawRig(ctx, a, t, P, true);
      ctx.restore();
    }
    ctx.restore();

    // аура ярости / босса
    if (!opts.portrait) {
      if (a.kind === 'boss') {
        var aura = 0.22 + 0.08 * Math.sin(t * 2.4);
        drawGlow(ctx, sx, baseY - 34 * sc, 46 * sc, C.violet, aura, 'lighter');
        drawGlow(ctx, sx, baseY - 12 * sc, 30 * sc, C.pink, aura * 0.6, 'lighter');
        // парящие искры
        for (var i = 0; i < 4; i++) {
          var ang = t * 0.9 + i * 1.7;
          var px = sx + Math.cos(ang) * (20 + i * 4) * sc;
          var py = baseY - 18 * sc + Math.sin(ang * 1.4) * 16 * sc;
          drawGlow(ctx, px, py, 2.4 * sc, i % 2 ? C.pink : C.violet2, 0.6, 'lighter');
        }
      } else if (a.kind === 'player' && a.specialReady) {
        drawGlow(ctx, sx, baseY - 20 * sc, 34 * sc, pal.rim, 0.16 + 0.06 * Math.sin(t * 5), 'lighter');
      }
    }

    // полоса HP над врагом
    if (!opts.portrait && a.kind !== 'player' && a.kind !== 'boss' && !a.dead && (a.hp < a.maxHp || a.hurtT > 0 || a.attack)) {
      var bw = 22 * sc;
      var by = sy - (sk.hip + sk.chest + sk.headR * 2 + 10) * sc;
      ctx.save();
      ctx.globalAlpha *= 0.9;
      rr(ctx, sx - bw / 2, by, bw, 3, 1.5);
      ctx.fillStyle = 'rgba(4,4,12,0.8)';
      ctx.fill();
      ctx.fillStyle = a.kind === 'brute' ? C.amber : (a.kind === 'ninja' ? C.violet2 : C.pink);
      ctx.fillRect(sx - bw / 2 + 0.6, by + 0.6, (bw - 1.2) * clamp(a.hp / a.maxHp, 0, 1), 1.8);
      ctx.restore();
    }

    // маркер телеграфа над головой
    if (!opts.portrait && a.attack && a.attack.phase === 'wind' && !a.dead) {
      var my = sy - (sk.hip + sk.chest + sk.headR * 2 + 18) * sc;
      ctx.save();
      ctx.globalAlpha *= 0.6 + 0.4 * Math.sin(t * 18);
      ctx.fillStyle = C.amber;
      ctx.shadowColor = C.amber;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(sx, my - 4);
      ctx.lineTo(sx + 3, my + 2);
      ctx.lineTo(sx - 3, my + 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  function drawTelegraph(ctx, a, sx, baseY, t) {
    var reach = a.reach || 34;
    var dir = a.facing < 0 ? -1 : 1;
    var a0 = 0.34 + 0.3 * Math.sin(t * 16);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = a0;
    ctx.fillStyle = rgba(C.red, 0.10);
    ctx.beginPath();
    ctx.ellipse(sx + dir * reach * 0.55, baseY, reach * 0.62, 7, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = rgba(C.amber, 0.5);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(sx + dir * reach * 0.55, baseY, reach * 0.62, 7, 0, 0, TAU);
    ctx.stroke();
    // шевроны к цели
    ctx.strokeStyle = rgba(C.amber, 0.6);
    for (var i = 0; i < 3; i++) {
      var d = 10 + i * 10;
      ctx.beginPath();
      ctx.moveTo(sx + dir * d, baseY - 6);
      ctx.lineTo(sx + dir * (d + 5), baseY);
      ctx.lineTo(sx + dir * d, baseY + 6);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ---------- аватар для HUD ---------- */
  function drawAvatar(ctx, char, cx, cy, r, t) {
    var kind = char === 'hammer' ? 'hammer' : 'comet';
    var pal = PAL[kind];
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.clip();
    ctx.fillStyle = lg(ctx, cx - r, cy - r, cx + r, cy + r, [0, '#1a1440', 0.6, '#0a0720', 1, '#05040e']);
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    // диск-подложка
    ctx.globalAlpha = 0.5;
    drawGlow(ctx, cx, cy + r * 0.4, r * 1.5, pal.rim, 0.5, 'lighter');
    ctx.globalAlpha = 1;
    // плечи/торс в круге
    ctx.fillStyle = kind === 'hammer' ? '#7a4220' : '#aab3d0';
    ctx.beginPath();
    ctx.ellipse(cx, cy + r * 0.95, r * 0.95, r * 0.6, 0, 0, TAU);
    ctx.fill();
    if (kind === 'comet') {
      ctx.fillStyle = '#ff8a1f';
      ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.56, r * 0.44, r * 0.17, 0, 0, TAU); ctx.fill();
    } else {
      ctx.fillStyle = '#c3cde0';
      ctx.beginPath(); ctx.ellipse(cx + r * 0.62, cy + r * 0.72, r * 0.34, r * 0.26, 0, 0, TAU); ctx.fill();
    }
    // голова крупно
    var sk = SK[kind];
    var headOff = sk.hip + sk.chest + sk.neck + sk.headR;
    var hs = r / (sk.headR * 1.08);
    ctx.save();
    ctx.translate(cx, cy + headOff * hs);
    ctx.scale(hs, hs);
    var fake = { id: 7, kind: kind, char: kind, anim: 'idle', animT: 0, facing: 1, z: 0, y: 200, scale: 1 };
    var Q = rigPoints({ lean: 0, hipDrop: 0, bob: 0, headTilt: 0, armF: [0.2, 0.2], armB: [-0.2, 0.2], legF: [0.16, -0.12], legB: [-0.16, -0.08] }, sk);
    drawHead(ctx, kind, fake, t, { lean: 0, headTilt: 0 }, Q, sk, pal, false, function (c) { return c; });
    ctx.restore();
    // неоновая рамка
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = rgba(pal.rim, 0.85);
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(cx, cy, r - 0.6, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath(); ctx.arc(cx, cy, r - 2.4, 0, TAU); ctx.stroke();
    ctx.restore();
  }

  /* ============================================================
     МИР: реквизит, пикапы, снаряды, частицы, всплывашки
     ============================================================ */
  function propScreen(p, camX) { return { x: (p.x || 0) - camX, y: p.y || 210 }; }

  function drawProp(ctx, p, t, camX) {
    var s = propScreen(p, camX);
    if (s.x < -70 || s.x > W + 70) return;
    var x = s.x, y = s.y;
    var shake = p.shakeT > 0 ? Math.sin(t * 60) * 1.1 * p.shakeT : 0;
    x += shake;
    ctx.save();
    drawShadow(ctx, x, y, 1.1, 0);
    if (p.type === 'crate') {
      if (!p.broken) {
        var h = p.h || 22, w = p.w || 22;
        var top = y - h;
        ctx.fillStyle = lg(ctx, x - w / 2, top, x + w / 2, y, [0, '#3a2a1c', 0.5, '#251a10', 1, '#120c08']);
        ctx.fillRect(x - w / 2, top, w, h);
        // доски
        ctx.strokeStyle = 'rgba(0,0,0,0.45)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x - w / 2, top + h * 0.36); ctx.lineTo(x + w / 2, top + h * 0.36); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x - w / 2, top + h * 0.7); ctx.lineTo(x + w / 2, top + h * 0.7); ctx.stroke();
        // металлические углы
        ctx.fillStyle = 'rgba(140,150,180,0.35)';
        ctx.fillRect(x - w / 2, top, 3, h);
        ctx.fillRect(x + w / 2 - 3, top, 3, h);
        // неоновая наклейка
        ctx.fillStyle = rgba(C.amber, 0.8);
        ctx.fillRect(x - 6, top + 5, 8, 6);
        ctx.fillStyle = '#1a0f04';
        ctx.fillRect(x - 5, top + 7, 6, 1);
        ctx.fillRect(x - 5, top + 9, 4, 1);
        // блик
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(x - w / 2 + 2, top + 1, w - 4, 1.5);
      } else {
        var w2 = p.w || 22;
        ctx.fillStyle = '#1b120a';
        ctx.beginPath();
        ctx.moveTo(x - w2 / 2, y);
        ctx.lineTo(x - w2 / 2 + 3, y - 7);
        ctx.lineTo(x - 2, y - 3);
        ctx.lineTo(x + 4, y - 8);
        ctx.lineTo(x + w2 / 2, y);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#0d0805';
        ctx.fillRect(x - 10, y - 2, 20, 2);
        ctx.strokeStyle = rgba(C.amber, 0.3);
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x - 8, y - 6); ctx.lineTo(x - 3, y - 1); ctx.stroke();
      }
    } else if (p.type === 'barrel') {
      var bh = p.h || 24, bw = p.w || 18;
      var btop = y - bh;
      ctx.fillStyle = lg(ctx, x - bw / 2, btop, x + bw / 2, btop, [0, '#141a1c', 0.6, '#0a0f10', 1, '#050808']);
      rr(ctx, x - bw / 2, btop, bw, bh, 3);
      ctx.fill();
      ctx.strokeStyle = 'rgba(180,190,200,0.18)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x - bw / 2, btop + bh * 0.3); ctx.lineTo(x + bw / 2, btop + bh * 0.3); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - bw / 2, btop + bh * 0.68); ctx.lineTo(x + bw / 2, btop + bh * 0.68); ctx.stroke();
      // токсичная жидкость
      if (!p.broken) {
        ctx.fillStyle = lg(ctx, 0, btop + 4, 0, btop + bh * 0.5, [0, rgba(C.lime, 0.9), 1, rgba(C.lime, 0.2)]);
        ctx.fillRect(x - bw / 2 + 2, btop + 4, bw - 4, bh * 0.36);
        drawGlow(ctx, x, btop + 6, 16, C.lime, 0.30, 'lighter');
        ctx.fillStyle = 'rgba(240,255,190,0.6)';
        ctx.fillRect(x - bw / 2 + 3, btop + 4, bw - 6, 1);
      } else {
        ctx.fillStyle = rgba(C.lime, 0.18);
        ctx.beginPath(); ctx.ellipse(x, y - 2, 11, 3, 0, 0, TAU); ctx.fill();
      }
      // знак
      ctx.fillStyle = rgba(C.amber, 0.8);
      ctx.fillRect(x - 4, btop + bh * 0.42, 8, 7);
      ctx.fillStyle = '#101004';
      ctx.fillRect(x - 2.5, btop + bh * 0.42 + 1.4, 5, 1.2);
      ctx.fillRect(x - 2.5, btop + bh * 0.42 + 3.4, 5, 1.2);
    } else {
      // торговый автомат
      var vh = p.h || 34, vw = p.w || 26;
      var vtop = y - vh;
      ctx.fillStyle = lg(ctx, x - vw / 2, vtop, x + vw / 2, y, [0, '#141a30', 0.5, '#090d1c', 1, '#05070f']);
      rr(ctx, x - vw / 2, vtop, vw, vh, 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(120,150,200,0.22)';
      ctx.lineWidth = 1;
      ctx.stroke();
      // светящееся стекло
      var vg = lg(ctx, 0, vtop + 3, 0, vtop + vh * 0.68, [0, rgba(C.cyan, 0.55), 0.5, rgba(C.pink, 0.30), 1, rgba(C.cyan, 0.08)]);
      ctx.fillStyle = vg;
      ctx.fillRect(x - vw / 2 + 3, vtop + 3, vw - 6, vh * 0.62);
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      for (var i = 0; i < 6; i++) ctx.fillRect(x - vw / 2 + 5 + (i % 3) * 6, vtop + 6 + Math.floor(i / 3) * 8, 4, 4);
      drawGlow(ctx, x, vtop + vh * 0.35, 20, C.cyan, 0.16, 'lighter');
      // панель
      ctx.fillStyle = '#080c18';
      ctx.fillRect(x - vw / 2 + 2, vtop + vh * 0.7, vw - 4, 5);
      ctx.fillStyle = rgba(C.lime, 0.85);
      ctx.fillRect(x - vw / 2 + 3, vtop + vh * 0.72, 3, 1.5);
      ctx.fillStyle = rgba(C.pink, 0.85);
      ctx.fillRect(x - vw / 2 + 7, vtop + vh * 0.72, 3, 1.5);
      // логотип
      drawText(ctx, 'TOXIC', x, vtop + vh * 0.88, {
        size: 5, weight: 700, fam: F_MONO, color: rgba(C.pink, 0.9), align: 'center'
      });
      if (p.broken) {
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(x - 8, vtop + 4); ctx.lineTo(x - 2, vtop + 14); ctx.lineTo(x + 3, vtop + 9); ctx.lineTo(x + 8, vtop + 20);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawPickup(ctx, p, t, camX) {
    var x = (p.x || 0) - camX, y = p.y || 220;
    if (x < -40 || x > W + 40) return;
    var z = (p.z || 0) + Math.sin(t * 3 + (p.id || 0)) * 2;
    var blink = 1;
    if (p.life != null && p.life < 2.4) blink = 0.5 + 0.5 * Math.abs(Math.sin(t * 9));
    ctx.save();
    ctx.globalAlpha *= blink;
    drawShadow(ctx, x, y, 0.7, z + 10);
    // световой столб
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    var col = p.kind === 'food' ? C.lime : C.amber;
    var beam = lg(ctx, 0, y - 34, 0, y, [0, rgba(col, 0), 0.7, rgba(col, 0.14), 1, rgba(col, 0.28)]);
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(x - 7, y); ctx.lineTo(x - 2, y - 34); ctx.lineTo(x + 2, y - 34); ctx.lineTo(x + 7, y);
    ctx.closePath();
    ctx.fill();
    drawGlow(ctx, x, y - z - 5, 17, col, 0.4, 'lighter');
    ctx.restore();
    var bobY = y - z - 6;
    if (p.kind === 'coin') {
      var sp = Math.abs(Math.cos(t * 4 + (p.id || 0)));
      var cw = 6 * (0.35 + 0.65 * sp);
      ctx.fillStyle = lg(ctx, x - 6, bobY - 8, x + 6, bobY + 8, [0, '#fff3b0', 0.5, '#ffc23a', 1, '#c07800']);
      ctx.beginPath(); ctx.ellipse(x, bobY, cw, 7, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#fff6c8';
      ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.ellipse(x, bobY, cw, 7, 0, 0, TAU); ctx.stroke();
      if (sp > 0.6) {
        ctx.fillStyle = '#8a5a00';
        ctx.fillRect(x - 1, bobY - 3.4, 2, 6.8);
      }
      starGlyph(ctx, x + 7, bobY - 8, 2.4, '#fff3b0', 0.6 + 0.4 * Math.sin(t * 6));
    } else {
      // бургер
      ctx.fillStyle = '#f0b45a';
      ctx.beginPath(); ctx.ellipse(x, bobY - 4, 9.5, 6, 0, PI, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath(); ctx.ellipse(x - 2, bobY - 6.5, 3.2, 1.4, -0.2, 0, TAU); ctx.fill();
      ctx.fillStyle = '#b6ff3a';
      ctx.beginPath(); ctx.ellipse(x, bobY - 0.5, 10, 2.6, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#7a3a10';
      ctx.fillRect(x - 9, bobY + 1.4, 18, 3);
      ctx.fillStyle = '#ffcf6a';
      ctx.beginPath(); ctx.ellipse(x, bobY + 7, 9.6, 3.4, 0, 0, PI); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillRect(x - 6, bobY - 7, 2.4, 1.4);
    }
    ctx.restore();
  }

  function drawProjectile(ctx, p, t, camX) {
    var x = (p.x || 0) - camX, y = (p.y || 210) - (p.z || 0);
    if (x < -60 || x > W + 60) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (p.kind === 'orb') {
      var life = p.maxLife ? clamp(p.life / p.maxLife, 0, 1) : 1;
      // хвост
      for (var i = 0; i < 3; i++) {
        drawGlow(ctx, x - (p.vx || 0) * i * 0.006, y + i * 1.2, (p.r || 4) * (2.4 - i * 0.5), i ? C.violet : C.pink, 0.35 - i * 0.09, 'lighter');
      }
      drawGlow(ctx, x, y, (p.r || 4) * 4.6, C.pink, 0.7, 'lighter');
      ctx.fillStyle = '#fff0fa';
      ctx.beginPath(); ctx.arc(x, y, (p.r || 4) * 0.75, 0, TAU); ctx.fill();
      ctx.strokeStyle = rgba(C.pink, 0.9);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, y, (p.r || 4) * 1.3, t * 6, t * 6 + PI * 1.2); ctx.stroke();
    } else if (p.kind === 'shock') {
      var pr = clamp(p.life / (p.maxLife || 0.4), 0, 1);
      var rr2 = (p.r || 30) * (1.1 - pr) + 6;
      ctx.strokeStyle = rgba(C.amber, 0.7 * pr);
      ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.ellipse(x, (p.y || 210), rr2, rr2 * 0.32, 0, 0, TAU); ctx.stroke();
      drawGlow(ctx, x, (p.y || 210) - 4, rr2 * 0.8, C.amber, 0.25 * pr, 'lighter');
    } else if (p.kind === 'cable') {
      var pr2 = clamp(p.life / (p.maxLife || 0.45), 0, 1);
      ctx.strokeStyle = rgba(C.violet2, 0.85);
      ctx.lineWidth = 2.4;
      ctx.shadowColor = C.pink; ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(x - 30, y - 14);
      ctx.bezierCurveTo(x - 8, y + 12 * pr2, x + 18, y - 18 * pr2, x + 34, y + 4);
      ctx.stroke();
      ctx.shadowBlur = 0;
      drawGlow(ctx, x + 34, y + 4, 8, C.pink, 0.7 * pr2, 'lighter');
    }
    ctx.restore();
  }

  function drawParticles(ctx, list, t, camX) {
    ctx.save();
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      if (!p) continue;
      var life = p.maxLife ? clamp(p.life / p.maxLife, 0, 1) : clamp(p.life, 0, 1);
      if (life <= 0) continue;
      var x = (p.x || 0) - camX, y = (p.y || 0) - (p.z || 0);
      if (x < -50 || x > W + 50) continue;
      var col = p.color || C.pink;
      var sz = (p.size || 2);
      switch (p.kind) {
        case 'spark': {
          var vx = (p.vx || 0), vy = (p.vy || 0), vz = (p.vz || 0);
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = life;
          ctx.strokeStyle = col;
          ctx.lineWidth = Math.max(0.7, sz * 0.5);
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x - vx * 0.02, y - vy * 0.02 - vz * 0.02);
          ctx.stroke();
          ctx.globalAlpha = life * 0.8;
          drawGlow(ctx, x, y, sz * 2.4, col, life * 0.5, 'lighter');
          break;
        }
        case 'dust': {
          ctx.globalAlpha = life * 0.35;
          ctx.fillStyle = col;
          ctx.beginPath(); ctx.arc(x, y, sz * (1.4 - life * 0.4), 0, TAU); ctx.fill();
          break;
        }
        case 'ring': {
          var rr = (1 - life) * (sz || 20) + 3;
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = life * 0.85;
          ctx.strokeStyle = col;
          ctx.lineWidth = Math.max(0.8, 2.2 * life);
          ctx.beginPath();
          ctx.ellipse(x, (p.y || 210), rr, rr * 0.34, 0, 0, TAU);
          ctx.stroke();
          break;
        }
        case 'shard': {
          ctx.globalAlpha = life;
          ctx.fillStyle = col;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate((p.rot || 0) + t * 6 * (p.vx > 0 ? 1 : -1) * 0.1);
          ctx.beginPath();
          ctx.moveTo(0, -sz * 1.6); ctx.lineTo(sz * 0.8, sz); ctx.lineTo(-sz * 0.6, sz * 0.6);
          ctx.closePath(); ctx.fill();
          ctx.restore();
          break;
        }
        case 'smoke': {
          ctx.globalAlpha = life * 0.5;
          drawSmoke(ctx, x, y, sz * (2.4 - life), col, life * 0.55, (p.rot || 0) + t * 0.5);
          break;
        }
        case 'star': {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = life;
          starGlyph(ctx, x, y, sz * 2.2 * (0.5 + life * 0.7), col, life);
          drawGlow(ctx, x, y, sz * 4, col, life * 0.4, 'lighter');
          break;
        }
        case 'note': {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = life;
          ctx.fillStyle = col;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate((p.rot || 0) + Math.sin(t * 3 + i) * 0.2);
          ctx.beginPath();
          ctx.ellipse(0, 0, sz * 0.9, sz * 0.6, -0.4, 0, TAU); ctx.fill();
          ctx.fillRect(sz * 0.5, -sz * 3, sz * 0.34, sz * 3);
          ctx.beginPath();
          ctx.moveTo(sz * 0.5, -sz * 3);
          ctx.quadraticCurveTo(sz * 2.2, -sz * 2.6, sz * 1.6, -sz * 1.4);
          ctx.quadraticCurveTo(sz * 1.8, -sz * 2.2, sz * 0.84, -sz * 2.5);
          ctx.closePath(); ctx.fill();
          ctx.restore();
          break;
        }
        case 'orb': {
          ctx.globalCompositeOperation = 'lighter';
          drawGlow(ctx, x, y, sz * 5, col, life * 0.6, 'lighter');
          ctx.globalAlpha = life;
          ctx.fillStyle = '#fff';
          ctx.beginPath(); ctx.arc(x, y, sz * 0.8, 0, TAU); ctx.fill();
          break;
        }
        default: {
          ctx.globalAlpha = life;
          ctx.fillStyle = col;
          ctx.beginPath(); ctx.arc(x, y, sz, 0, TAU); ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  function drawPopups(ctx, list, t, camX) {
    ctx.save();
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      if (!p) continue;
      var u = p.dur ? clamp(p.t / p.dur, 0, 1) : 0;
      var alpha = u < 0.12 ? u / 0.12 : (u > 0.72 ? (1 - u) / 0.28 : 1);
      var x = (p.x || 0) - camX;
      var y = (p.y || 0) - (p.z || 0) - 20 - u * 16;
      if (x < -50 || x > W + 50) continue;
      var col = p.color || C.amber;
      var txt = String(p.text == null ? '' : p.text);
      var isBig = p.kind === 'combo';
      var isDmg = p.kind === 'damage';
      var size = isBig ? 17 : isDmg ? 13 : 9.5;
      ctx.save();
      ctx.globalAlpha *= alpha;
      if (isBig) {
        ctx.translate(x, y);
        var sc = 1 + (1 - clamp(u * 4, 0, 1)) * 0.6;
        ctx.scale(sc, sc);
        ctx.translate(-x, -y);
      }
      drawText(ctx, txt, x, y, {
        size: size, weight: 900, fam: isDmg || isBig ? F_DISPLAY : F_SANS, italic: isBig,
        align: 'center', color: '#fff6ff', stroke: 'rgba(5,3,14,0.9)', strokeW: isBig ? 3 : 2.4,
        glow: col, blur: isBig ? 14 : 8, glowColor: col, glowAlpha: 0.85
      });
      ctx.restore();
    }
    ctx.restore();
  }

  function drawGate(ctx, gate, camX, t) {
    if (!gate || gate.left == null || gate.right == null) return;
    var edges = [gate.left, gate.right];
    for (var i = 0; i < 2; i++) {
      var x = edges[i] - camX;
      if (x < -40 || x > W + 40) continue;
      var pulseA = 0.5 + 0.3 * Math.sin(t * 7 + i * 2);
      ctx.save();
      ctx.translate(x, 0);
      // энергетическая завеса
      ctx.globalCompositeOperation = 'lighter';
      var h = 96;
      var grad = lg(ctx, 0, 158 - h, 0, 158, [
        0, rgba(C.pink, 0), 0.4, rgba(C.pink, 0.07), 0.85, rgba(C.cyan, 0.10), 1, rgba(C.cyan, 0.22)
      ]);
      ctx.fillStyle = grad;
      ctx.fillRect(-3, 158 - h, 6, h);
      // лучи
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = rgba(C.cyan, 0.5);
      ctx.lineWidth = 0.8;
      for (var k = 0; k < 7; k++) {
        var yy = 158 - ((k * 13 + t * 30) % h);
        ctx.beginPath();
        ctx.moveTo(-5, yy); ctx.lineTo(5, yy + 3);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // стойка
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#05040e';
      ctx.fillRect(-2.4, 158 - h - 4, 4.8, h + 4);
      ctx.fillStyle = rgba(C.pink, pulseA);
      ctx.fillRect(-1, 158 - h - 4, 2, h + 4);
      ctx.fillStyle = '#0a0714';
      ctx.fillRect(-7, 158 - h - 8, 14, 5);
      ctx.fillRect(-7, 153, 14, 5);
      drawGlow(ctx, 0, 158 - h - 6, 14, C.pink, 0.5, 'lighter');
      drawGlow(ctx, 0, 156, 18, C.cyan, 0.4, 'lighter');
      ctx.restore();
    }
  }

  /* ============================================================
     МИР: отрисовка сцены боя
     ============================================================ */
  function currentZone(st) { return zoneIdx(st); }

  function drawPlayWorld(ctx, st, t) {
    var cam = st.camera || {};
    var camX = cam.x || 0;
    var z = currentZone(st);
    var run = st.run || {};
    var i;
    ctx.save();
    ctx.translate(cam.shakeX || 0, cam.shakeY || 0);

    drawZoneBg(ctx, z, camX, t, {});
    drawSteam(ctx, z, camX, t);
    drawEmbers(ctx, z, t);

    if (run.gate && run.gate.active) drawGate(ctx, run.gate, camX, t);

    // сортировка по глубине: реквизит + пикапы + персонажи
    var items = [];
    var props = st.props || [];
    for (i = 0; i < props.length; i++) {
      (function (pr) {
        items.push({ y: pr.y || 0, draw: function () { drawProp(ctx, pr, t, camX); } });
      })(props[i]);
    }
    var picks = st.pickups || [];
    for (i = 0; i < picks.length; i++) {
      (function (pk) {
        items.push({ y: pk.y || 0, draw: function () { drawPickup(ctx, pk, t, camX); } });
      })(picks[i]);
    }
    var all = [];
    if (st.player) all.push(st.player);
    var en = st.enemies || [];
    for (i = 0; i < en.length; i++) if (en[i]) all.push(en[i]);
    all.sort(function (a, b) { return (a.y || 0) - (b.y || 0); });
    for (i = 0; i < all.length; i++) {
      (function (a2) {
        items.push({ y: a2.y || 0, draw: function () { drawActor(ctx, a2, t, camX, { reflect: true }); } });
      })(all[i]);
    }
    items.sort(function (a, b) { return a.y - b.y; });
    for (i = 0; i < items.length; i++) items[i].draw();

    // снаряды, искры, попапы
    var projs = st.projectiles || [];
    for (i = 0; i < projs.length; i++) drawProjectile(ctx, projs[i], t, camX);
    drawParticles(ctx, st.particles || [], t, camX);
    drawPopups(ctx, st.popups || [], t, camX);

    // погода поверх мира
    drawWeather(ctx, z, t, {});

    // подсказка «вперёд»
    if (run.advance && !run.waveActive) {
      ctx.save();
      var pa = 0.5 + 0.4 * Math.sin(t * 4);
      ctx.globalAlpha = pa;
      var ax = W - 26 + Math.sin(t * 4) * 3;
      drawText(ctx, '→', ax, 150, { size: 22, weight: 900, fam: F_DISPLAY, color: C.lime, glow: C.lime, blur: 12 });
      ctx.restore();
    }
    ctx.restore();
  }

  /* ============================================================
     БЫСТРЫЕ ЧИПЫ НАСТРОЕК
     ============================================================ */
  function drawQuickChips(ctx, t) {
    var u = UI();
    var list = u.quick || [];
    var set = DSet();
    for (var i = 0; i < list.length; i++) {
      var r = list[i];
      if (!r) continue;
      var act = r.action;
      var key = act === 'gfx' ? 'G' : act === 'lang' ? 'L' : act === 'music' ? 'M' : 'F';
      var val = '';
      var accent = C.cyan;
      if (act === 'gfx') {
        val = tt(set.gfx === 'retro' ? 'gfx.retro' : 'gfx.modern');
        accent = set.gfx === 'retro' ? C.amber : C.lime;
      } else if (act === 'lang') {
        val = String(set.lang || 'ru').toUpperCase();
        accent = C.cyan;
      } else if (act === 'music') {
        val = tt(set.music ? 'common.on' : 'common.off');
        accent = set.music ? C.pink : C.dim;
      } else {
        accent = C.violet2;
      }
      glass(ctx, r.x, r.y, r.w, r.h, { cut: 4, accent: accent, border: rgba(accent, 0.25), alpha: 0.92 });
      // клавиша
      keycap(ctx, r.x + 4, r.y + 2.5, 9, 8, key, accent, { size: 6.5, fill: 'rgba(6,6,18,0.9)' });
      if (act === 'fullscreen') {
        drawText(ctx, 'F', r.x + 8.5, r.y + r.h / 2 + 0.5, { size: 6.5, weight: 700, fam: F_MONO, color: accent, align: 'center' });
        // иконка экрана
        ctx.save();
        ctx.strokeStyle = rgba(C.white, 0.75);
        ctx.lineWidth = 0.9;
        var ix = r.x + 19, iy = r.y + 4.4, iw = 14, ih = 6.4;
        ctx.strokeRect(ix, iy, iw, ih);
        ctx.fillStyle = rgba(C.violet2, 0.5);
        ctx.fillRect(ix + 1, iy + 1, iw - 2, ih - 2);
        ctx.restore();
      } else {
        var sz = fitSize(ctx, val, r.w - 21, 6.6, 700, F_SANS, 4.6);
        drawText(ctx, val, r.x + r.w - 5, r.y + r.h / 2 + 0.5, {
          size: sz, weight: 700, fam: F_SANS, align: 'right', color: rgba(C.white, 0.92)
        });
      }
    }
  }

  /* ============================================================
     HUD
     ============================================================ */
  function drawHUD(ctx, st, t) {
    var run = st.run || {};
    var p = st.player;
    if (!p) return;
    var i;
    var accent = p.char === 'hammer' ? C.orange : C.cyan;
    var hpPct = clamp((p.hp || 0) / (p.maxHp || 1), 0, 1);
    var ragePct = clamp((p.rage || 0) / (p.maxRage || 100), 0, 1);

    /* --- левая панель --- */
    glass(ctx, 6, 5, 198, 40, { cut: 7, accent: accent, border: 'rgba(200,220,255,0.18)', alpha: 0.9 });
    drawAvatar(ctx, p.char, 25, 24, 13, t);
    // имя + уровень ярости
    var nameKey = p.char === 'hammer' ? 'char.hammer.name' : 'char.comet.name';
    drawText(ctx, tt(nameKey), 42, 13.5, { size: 7, weight: 900, fam: F_SANS, align: 'left', color: rgba(C.white, 0.9), spacing: 1.2 });
    // HP
    bar(ctx, 42, 17, 120, 8, hpPct, {
      accent: hpPct > 0.35 ? (p.char === 'hammer' ? C.orange : C.cyan) : C.red,
      accent2: hpPct > 0.35 ? (p.char === 'hammer' ? '#ffd3a1' : '#b9fbff') : '#ff9ab0',
      glow: hpPct > 0.35 ? accent : C.red, glowBlur: 6, ticks: 5
    });
    // HP цифры
    drawText(ctx, String(Math.max(0, Math.ceil(p.hp || 0))), 42 + 120, 13.5, {
      size: 6.4, weight: 700, fam: F_MONO, align: 'right', color: rgba(C.white, 0.75)
    });
    // RAGE
    bar(ctx, 42, 29, 96, 4.5, ragePct, {
      accent: p.specialReady ? C.lime : C.violet,
      accent2: p.specialReady ? '#eaffb0' : '#c3a8ff',
      glow: p.specialReady ? C.lime : null, glowBlur: 7
    });
    drawText(ctx, tt('hud.rage'), 42, 37.5, { size: 5, weight: 700, fam: F_MONO, align: 'left', color: rgba(C.white, 0.45), spacing: 0.8 });
    // жизни
    var lives = clamp(run.lives == null ? 3 : run.lives, 0, 5);
    for (i = 0; i < lives; i++) {
      lifeIcon(ctx, 71 + i * 11, 37.5, 8, rgba(accent, 0.95));
    }
    // аватар-подпись
    drawText(ctx, tt('hud.lives'), 143, 37.5, { size: 4.6, weight: 700, fam: F_MONO, align: 'left', color: rgba(C.white, 0.35) });

    /* --- очки --- */
    glass(ctx, 346, 5, 128, 40, { cut: 7, accent: C.amber, border: 'rgba(200,220,255,0.16)', alpha: 0.9 });
    drawText(ctx, tt('hud.score'), 354, 13, { size: 5.4, weight: 700, fam: F_MONO, align: 'left', color: rgba(C.white, 0.5), spacing: 1 });
    drawText(ctx, fmt(run.score || 0), 468, 24, {
      size: 16, weight: 900, fam: F_DISPLAY, align: 'right', color: '#fff8ff',
      glow: C.amber, blur: 9, glowColor: C.amber, glowAlpha: 0.55
    });
    drawText(ctx, tt('hud.best') + ' ' + fmt(run.best || 0), 468, 36, {
      size: 6, weight: 700, fam: F_MONO, align: 'right', color: rgba(C.white, 0.5)
    });

    /* --- волна по центру --- */
    var waveNo = clamp((run.wave || 0) + 1, 1, run.waveCount || 5);
    if (run.waveActive || run.banner) {
      glass(ctx, 216, 5, 118, 21, { cut: 5, accent: C.pink, alpha: 0.82, border: 'rgba(255,255,255,0.12)' });
      drawText(ctx, tt('hud.wave') + ' ' + waveNo + '/' + (run.waveCount || 5), 275, 13, {
        size: 8.5, weight: 900, fam: F_SANS, color: '#fff3fb', glow: C.pink, blur: 7, glowAlpha: 0.55, spacing: 1
      });
      // пипсы волн
      for (i = 0; i < (run.waveCount || 5); i++) {
        var px = 275 - ((run.waveCount || 5) - 1) * 5 + i * 10;
        var done = i < waveNo - 1;
        var cur = i === waveNo - 1;
        ctx.fillStyle = done ? rgba(C.lime, 0.85) : cur ? rgba(C.pink, 1) : 'rgba(255,255,255,0.18)';
        if (cur) { ctx.shadowColor = C.pink; ctx.shadowBlur = 6; }
        rr(ctx, px - 2.6, 19.5, 5.2, 2.2, 1);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
    // время
    drawText(ctx, tt('hud.time') + ' ' + fmtTime(run.elapsed || 0), 354, 39.5, {
      size: 5.2, weight: 700, fam: F_MONO, align: 'left', color: rgba(C.white, 0.45)
    });

    /* --- комбо --- */
    if ((run.combo || 0) >= 2) {
      var cu = clamp((run.combo || 0), 2, 99);
      var pop = 1 + clamp((run.comboT || 0) > 0 ? 0.12 : 0, 0, 0.2) + 0.06 * Math.sin(t * 10);
      cutPath(ctx, 396, 48, 76, 36, 6);
      ctx.fillStyle = 'rgba(4,4,14,0.82)';
      ctx.fill();
      cutPath(ctx, 396, 48, 76, 36, 6);
      ctx.strokeStyle = rgba(C.lime, 0.30);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.save();
      ctx.translate(452, 62);
      ctx.scale(pop, pop);
      drawText(ctx, '×' + cu, 0, 0, {
        size: 24, weight: 900, fam: F_DISPLAY, italic: true, align: 'right',
        color: '#ffffff', grad: [C.lime2, C.lime, C.cyan],
        glow: C.lime, blur: 14, glowColor: C.lime, glowAlpha: 0.75
      });
      drawText(ctx, tt('hud.combo'), 0, 15, {
        size: 6, weight: 900, fam: F_SANS, align: 'right', color: rgba(C.lime2, 0.9), spacing: 2
      });
      ctx.restore();
      // шкала комбо
      var ct = clamp((run.comboT || 0) / 2.4, 0, 1);
      bar(ctx, 404, 52, 64, 3, ct, { accent: C.lime, back: 'rgba(0,0,0,0.4)' });
    }

    /* --- ярость готова --- */
    if (p.specialReady) {
      var pk = 0.6 + 0.4 * Math.sin(t * 6);
      ctx.save();
      glass(ctx, 8, 49, 108, 14, { cut: 5, accent: C.lime, glow: C.lime, glowBlur: 10, alpha: 0.85 });
      drawText(ctx, tt('hud.specialReady'), 62, 56, {
        size: 6.4, weight: 900, fam: F_SANS, color: '#f4ffd0', glow: C.lime, blur: 8,
        glowAlpha: pk, spacing: 0.8
      });
      ctx.restore();
    }

    /* --- полоса босса --- */
    var boss = st.boss;
    if (boss && !boss.dead) {
      var bx = 126, by = 48, bw = 240, bh = 9;
      var bhp = clamp((boss.hp || 0) / (boss.maxHp || 1), 0, 1);
      glass(ctx, bx - 5, by - 11, bw + 10, bh + 16, { cut: 6, accent: C.pink, border: rgba(C.pink, 0.3), alpha: 0.9 });
      drawText(ctx, tt('hud.boss'), bx + 2, by - 4.5, {
        size: 6.4, weight: 900, fam: F_SANS, align: 'left', color: '#ffd7ea', glow: C.pink, blur: 7, glowAlpha: 0.6, spacing: 1.4
      });
      drawText(ctx, Math.max(0, Math.ceil(boss.hp || 0)) + ' / ' + (boss.maxHp || 0), bx + bw - 2, by - 4.5, {
        size: 5.6, weight: 700, fam: F_MONO, align: 'right', color: rgba(C.white, 0.55)
      });
      bar(ctx, bx, by, bw, bh, bhp, {
        accent: bhp > 0.35 ? C.pink : C.red, accent2: bhp > 0.35 ? '#ff9ccb' : '#ff9a9a',
        glow: C.pink, glowBlur: 9, ticks: 10, back: 'rgba(8,4,18,0.92)'
      });
      // фаза
      if (boss.phase2) {
        ctx.save();
        ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 8);
        drawText(ctx, tt('boss.phase2'), 240, by + 15, {
          size: 6.4, weight: 900, fam: F_SANS, color: C.amber, glow: C.amber, blur: 8, spacing: 2
        });
        ctx.restore();
      }
      // сегменты брони
      if (boss.armor) {
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = rgba(C.white, 0.5);
        ctx.lineWidth = 0.7;
        for (var s2 = 1; s2 < 10; s2++) {
          var sx2 = bx + (bw / 10) * s2;
          ctx.beginPath(); ctx.moveTo(sx2, by + 1); ctx.lineTo(sx2, by + bh - 1); ctx.stroke();
        }
        ctx.restore();
      }
    }
  }

  /* ============================================================
     БАННЕРЫ ВОЛН / БОССА
     ============================================================ */
  function bannerColors(kind) {
    if (kind === 'clear' || kind === 'victory') return { a: C.lime, b: C.cyan, txt: '#f6ffdc' };
    if (kind === 'boss' || kind === 'defeat') return { a: C.pink, b: C.red, txt: '#ffe3ec' };
    if (kind === 'advance') return { a: C.cyan, b: C.lime, txt: '#e7ffff' };
    if (kind === 'zone') return { a: C.violet, b: C.pink, txt: '#f2e8ff' };
    return { a: C.pink, b: C.violet, txt: '#fff2fb' };
  }

  function drawBannerSlab(ctx, cx, cy, w, h, kind, t, alpha, dir) {
    var cc = bannerColors(kind);
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.translate(cx, cy);
    ctx.transform(1, 0, dir * -0.20, 1, 0, 0);
    // плотная подложка, чтобы текст не спорил с фоном
    ctx.fillStyle = 'rgba(4,2,12,0.94)';
    ctx.fillRect(-w / 2, -h / 2, w, h);
    // светящаяся подложка
    ctx.fillStyle = lg(ctx, -w / 2, 0, w / 2, 0, [
      0, rgba(cc.a, 0), 0.18, rgba(cc.a, 0.18), 0.5, rgba(cc.a, 0.30), 0.82, rgba(cc.b, 0.16), 1, rgba(cc.b, 0)
    ]);
    ctx.fillRect(-w / 2, -h / 2, w, h);
    // линии
    ctx.fillStyle = rgba(cc.a, 0.9);
    ctx.fillRect(-w / 2, -h / 2, w, 1);
    ctx.fillStyle = rgba(cc.b, 0.75);
    ctx.fillRect(-w / 2, h / 2 - 1, w, 1);
    // угловые клинья
    ctx.fillStyle = rgba(cc.a, 0.5);
    ctx.beginPath();
    ctx.moveTo(-w / 2, -h / 2); ctx.lineTo(-w / 2 + 16, -h / 2); ctx.lineTo(-w / 2 + 6, h / 2); ctx.lineTo(-w / 2 - 6, h / 2);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = rgba(cc.b, 0.5);
    ctx.beginPath();
    ctx.moveTo(w / 2 - 16, -h / 2); ctx.lineTo(w / 2, -h / 2); ctx.lineTo(w / 2 + 6, h / 2); ctx.lineTo(w / 2 - 6, h / 2);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawBanner(ctx, st, t) {
    var run = st.run || {};
    var b = run.banner;
    if (!b) return;
    if (run.bossIntro > 0 && b.kind === 'boss') return;
    var u = clamp(b.t / (b.dur || 2.1), 0, 1);
    var inA = clamp(b.t / 0.18, 0, 1);
    var outA = clamp((b.dur - b.t) / 0.3, 0, 1);
    var alpha = Math.min(inA, outA);
    var title = tt(b.titleKey, b.vars);
    var sub = b.subKey ? tt(b.subKey, b.vars) : '';
    var cc = bannerColors(b.kind);
    var cy = b.kind === 'clear' || b.kind === 'advance' ? 112 : 108;
    var slide = (1 - easeOut(inA)) * 26;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(0, -slide);
    drawBannerSlab(ctx, W / 2, cy, W - 20, 34, b.kind, t, 1, 1);
    var tsize = fitSize(ctx, title, W - 80, 26, 900, F_DISPLAY, 12);
    drawText(ctx, title, W / 2, cy + (sub ? -4 : 1), {
      size: tsize, weight: 900, fam: F_DISPLAY, italic: true, color: '#ffffff',
      grad: [cc.txt, '#ffffff', cc.a], glow: cc.a, blur: 16, glowColor: cc.a, glowAlpha: 0.8,
      stroke: 'rgba(6,3,14,0.65)', strokeW: 3, spacing: 1
    });
    if (sub) {
      drawText(ctx, sub, W / 2, cy + 11, {
        size: fitSize(ctx, sub, W - 100, 8, 700, F_SANS, 6), weight: 700, fam: F_SANS,
        color: rgba(cc.txt, 0.9), spacing: 2.4, glow: cc.b, blur: 8, glowAlpha: 0.4
      });
    }
    // угловые звёзды
    starGlyph(ctx, W / 2 - 108, cy - 8, 3.4, cc.a, 0.7);
    starGlyph(ctx, W / 2 + 108, cy - 8, 3.4, cc.b, 0.7);
    ctx.restore();
  }

  /* ============================================================
     КИНЕМАТИК ПОЯВЛЕНИЯ БОССА
     ============================================================ */
  function drawBossIntro(ctx, st, t) {
    var run = st.run || {};
    var left = run.bossIntro || 0;
    if (left <= 0) return;
    var total = 2.9;
    var e = clamp(total - left, 0, total);
    var inP = clamp(e / 0.3, 0, 1);
    var outP = clamp(left / 0.45, 0, 1);
    var alpha = Math.min(inP, outP);
    var boss = st.boss;

    ctx.save();
    // затемнение мира
    ctx.fillStyle = 'rgba(3,1,10,' + (0.62 * alpha) + ')';
    ctx.fillRect(0, 0, W, H);
    // диагональные клинья
    ctx.save();
    ctx.globalAlpha = alpha * 0.8;
    for (var s = 0; s < 3; s++) {
      var off = (e * 90 + s * 160) % 640 - 160;
      ctx.fillStyle = lg(ctx, off - 90, 0, off + 90, 0, [
        0, 'rgba(0,0,0,0)', 0.35, rgba(C.pink, 0.06), 0.6, rgba(C.violet, 0.10), 0.8, 'rgba(0,0,0,0)', 1, 'rgba(0,0,0,0)'
      ]);
      ctx.beginPath();
      ctx.moveTo(off - 120, 0); ctx.lineTo(off - 20, 0); ctx.lineTo(off + 160, H); ctx.lineTo(off + 40, H);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    // леттербокс
    var lb = 13 * easeOut(inP);
    ctx.fillStyle = '#030109';
    ctx.fillRect(0, 0, W, lb);
    ctx.fillRect(0, H - lb, W, lb);
    // свет позади босса
    drawGlow(ctx, W * 0.66, 130, 120, C.pink, 0.30 * alpha, 'lighter');
    drawGlow(ctx, W * 0.66, 130, 70, C.violet, 0.35 * alpha, 'lighter');

    // силуэт босса крупно
    if (boss) {
      ctx.save();
      ctx.globalAlpha = alpha;
      var fake = {
        id: 991, kind: 'boss', char: 'khrom', x: 0, y: 238, z: 0, facing: -1,
        anim: e < 1.0 ? 'cast' : 'roar', animT: e, scale: 2.3, alpha: 1, flash: 0,
        hp: 1, maxHp: 1, state: 'intro', attack: null
      };
      drawActor(ctx, fake, t, -W * 0.66 - 0, { portrait: true, noReflect: true });
      ctx.restore();
    }

    // текст: финальный босс
    var p1 = clamp((e - 0.15) / 0.3, 0, 1) * clamp((1.3 - e) / 0.2, 0, 1);
    if (p1 > 0) {
      ctx.save();
      ctx.globalAlpha = alpha * p1;
      drawBannerSlab(ctx, W / 2, 64, W - 40, 26, 'boss', t, 1, -1);
      drawText(ctx, tt('banner.boss'), W / 2, 64, {
        size: 19, weight: 900, fam: F_DISPLAY, italic: true, color: '#fff0f7',
        glow: C.pink, blur: 16, glowAlpha: 0.9, spacing: 3
      });
      ctx.restore();
    }
    // имя босса
    var p2 = clamp((e - 0.75) / 0.4, 0, 1);
    if (p2 > 0) {
      ctx.save();
      ctx.globalAlpha = alpha * p2 * 0.95;
      drawText(ctx, tt('boss.name'), W * 0.66, 78, {
        size: 22, weight: 900, fam: F_DISPLAY, italic: true, color: '#ffe6f4',
        grad: ['#ffffff', '#ffd3e8', C.pink], glow: C.pink, blur: 18, glowAlpha: 0.85,
        stroke: 'rgba(8,2,12,0.7)', strokeW: 3, spacing: 1
      });
      drawText(ctx, tt('boss.sub'), W * 0.66, 94, {
        size: 8, weight: 700, fam: F_SANS, color: rgba(C.violet2, 0.95), spacing: 3,
        glow: C.violet, blur: 8, glowAlpha: 0.5
      });
      ctx.restore();
    }
    // реплика с «печатной машинкой»
    var tauntNo = (boss && boss.phase2) ? 2 : 1;
    var taunt = tt('boss.taunt' + tauntNo);
    var p3 = clamp((e - 1.15) / 0.35, 0, 1);
    if (p3 > 0) {
      var chars = Math.floor(clamp((e - 1.15) / 0.6, 0, 1) * taunt.length);
      var shown = taunt.slice(0, chars);
      ctx.save();
      ctx.globalAlpha = alpha * p3;
      glass(ctx, 96, 188, 288, 28, { cut: 6, accent: C.pink, alpha: 0.8, border: rgba(C.pink, 0.35) });
      drawText(ctx, shown, 240, 202, {
        size: 8.5, weight: 700, fam: F_SANS, color: '#ffe9f3', glow: C.pink, blur: 7, glowAlpha: 0.45
      });
      if (chars < taunt.length) {
        ctx.fillStyle = C.pink;
        ctx.fillRect(240 + measure(ctx, shown, 8.5, 700, F_SANS) / 2 + 2, 197, 4, 9);
      }
      ctx.restore();
    }
    // декоративные «данные»
    ctx.save();
    ctx.globalAlpha = alpha * 0.5;
    drawText(ctx, 'TOXIC CORPORATION · NEON-8', 16, 26, {
      size: 5.4, weight: 700, fam: F_MONO, align: 'left', color: rgba(C.pink, 0.8), spacing: 1.4
    });
    drawText(ctx, 'THREAT LEVEL: MAX', 464, 246, {
      size: 5.4, weight: 700, fam: F_MONO, align: 'right', color: rgba(C.amber, 0.9), spacing: 1.2
    });
    ctx.restore();
    ctx.restore();
  }

  /* ============================================================
     ТИТУЛЬНЫЙ ЭКРАН
     ============================================================ */
  function drawPosterLine(ctx, s, x, y, o) {
    o = o || {};
    var size = o.size || 34;
    ctx.save();
    ctx.translate(x, y);
    if (o.skew) ctx.transform(1, 0, o.skew, 1, 0, 0);
    // хроматические тени
    ctx.globalAlpha *= o.alpha == null ? 1 : o.alpha;
    drawText(ctx, s, -1.6, 0, {
      size: size, weight: 900, fam: F_DISPLAY, align: 'center', color: rgba(C.cyan, 0.55)
    });
    drawText(ctx, s, 1.6, 0, {
      size: size, weight: 900, fam: F_DISPLAY, align: 'center', color: rgba(C.pink, 0.6)
    });
    drawText(ctx, s, 0, 0, {
      size: size, weight: 900, fam: F_DISPLAY, align: 'center', color: o.color || '#ffffff',
      grad: o.grad || [o.c1 || '#ffffff', o.c2 || '#d7f7ff', o.c3 || '#7fe9ff'],
      glow: o.glow || C.cyan, blur: o.blur == null ? 16 : o.blur, glowColor: o.glow || C.cyan,
      glowAlpha: o.glowAlpha == null ? 0.75 : o.glowAlpha, stroke: 'rgba(4,2,12,0.85)', strokeW: Math.max(2, size * 0.06)
    });
    ctx.restore();
  }

  function screenTitle(ctx, st, t) {
    var set = DSet();
    var run = st.run || {};
    var camX = CAM_MID[0];
    var i;

    drawZoneBg(ctx, 0, camX, t, {});
    drawSteam(ctx, 0, camX, t);
    drawEmbers(ctx, 0, t);

    // световые клинья и постерный фон
    drawShafts(ctx, [{ x: 40, col: C.cyan }, { x: 210, col: C.pink }, { x: 330, col: C.violet }], t, 0.9);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(ctx, W / 2, 86, 150, C.pink, 0.16 + 0.03 * Math.sin(t * 1.3), 'lighter');
    drawGlow(ctx, W / 2, 96, 92, C.violet, 0.18, 'lighter');
    ctx.restore();

    // затемнение под типографику
    ctx.fillStyle = lg(ctx, 0, 8, 0, 168, [
      0, 'rgba(4,2,12,0.74)', 0.42, 'rgba(5,3,15,0.42)', 0.78, 'rgba(5,3,15,0.12)', 1, 'rgba(4,2,12,0.5)'
    ]);
    ctx.fillRect(0, 0, W, 170);
    // диагональный «постерный» клин
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = lg(ctx, 100, 0, 380, 0, [0, rgba(C.pink, 0), 0.5, rgba(C.pink, 0.14), 1, rgba(C.pink, 0)]);
    ctx.beginPath();
    ctx.moveTo(70, 0); ctx.lineTo(250, 0); ctx.lineTo(430, 160); ctx.lineTo(250, 160);
    ctx.closePath(); ctx.fill();
    ctx.restore();

    // персонажи по краям (key art)
    var heroD = {
      id: 501, kind: 'player', char: 'comet', x: camX + 82, y: 246, z: 0,
      facing: 1, anim: 'ready', animT: 0.5, scale: 1.16, alpha: 1, flash: 0,
      hp: 1, maxHp: 1, state: 'idle', attack: null
    };
    var heroT = {
      id: 502, kind: 'player', char: 'hammer', x: camX + 398, y: 250, z: 0,
      facing: -1, anim: 'ready', animT: 0.9, scale: 1.18, alpha: 1, flash: 0,
      hp: 1, maxHp: 1, state: 'idle', attack: null
    };
    drawActor(ctx, heroD, t, camX, { noReflect: false, portrait: false });
    drawActor(ctx, heroT, t, camX, { noReflect: false, portrait: false });

    // верхняя панель: рекорд слева
    glass(ctx, 8, 6, 128, 15, { cut: 4, accent: C.amber, alpha: 0.88, border: 'rgba(255,255,255,0.14)' });
    drawText(ctx, tt('title.best'), 16, 13.5, { size: 5.6, weight: 700, fam: F_MONO, align: 'left', color: rgba(C.white, 0.55), spacing: 1 });
    drawText(ctx, fmt(run.best || set.best || 0), 128, 13.5, {
      size: 8.4, weight: 900, fam: F_DISPLAY, align: 'right', color: '#fff3c9', glow: C.amber, blur: 6, glowAlpha: 0.5
    });

    // логотип
    var l1 = 'НЕОН';
    var l2 = '× ЯРОСТЬ';
    var s1 = fitSize(ctx, l1, 404, 44, 900, F_DISPLAY, 24);
    var s2 = fitSize(ctx, l2, 404, 40, 900, F_DISPLAY, 22);
    drawPosterLine(ctx, l1, W / 2, 48, {
      size: s1, c1: '#ffffff', c2: '#cdf8ff', c3: '#59d8ff', glow: C.cyan, glowAlpha: 0.8, skew: -0.02
    });
    drawPosterLine(ctx, l2, W / 2, 86, {
      size: s2, c1: '#fff0fa', c2: '#ff8fc4', c3: '#ff2e88', glow: C.pink, glowAlpha: 0.85, skew: 0.03
    });
    // подзаголовок NEON RAGE на неоновой плате
    ctx.save();
    ctx.translate(W / 2, 114);
    ctx.transform(1, 0, -0.16, 1, 0, 0);
    var nw = 224;
    ctx.fillStyle = lg(ctx, -nw / 2, 0, nw / 2, 0, [0, 'rgba(6,3,14,0.9)', 0.5, 'rgba(10,5,22,0.95)', 1, 'rgba(6,3,14,0.9)']);
    rr(ctx, -nw / 2, -13, nw, 26, 2);
    ctx.fill();
    ctx.strokeStyle = rgba(C.lime, 0.7);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = rgba(C.lime, 0.5);
    ctx.fillRect(-nw / 2 + 4, -13, nw - 8, 1);
    drawText(ctx, tt('app.subtitle'), 0, 1, {
      size: 21, weight: 900, fam: F_DISPLAY, italic: true, align: 'center',
      color: '#f8ffd9', grad: ['#ffffff', '#e7ff9c', C.lime], glow: C.lime, blur: 14, glowAlpha: 0.8
    });
    ctx.restore();

    // подпись + слоган + press
    drawText(ctx, tt('app.tribute'), W / 2, 134, {
      size: 6, weight: 700, fam: F_SANS, color: rgba(C.white, 0.55), spacing: 1.6
    });
    drawText(ctx, tt('title.tagline'), W / 2, 144, {
      size: 7.2, weight: 900, fam: F_SANS, color: rgba(C.cyan2, 0.9), spacing: 1.4, glow: C.cyan, blur: 6, glowAlpha: 0.35
    });
    if (Math.sin(t * 3.4) > -0.35) {
      drawText(ctx, tt('title.press'), W / 2, 153, {
        size: 7, weight: 700, fam: F_MONO, color: '#fff6ff', glow: C.pink, blur: 8, glowAlpha: 0.5, spacing: 2
      });
    }

    // меню
    var u = UI();
    drawMenuPanel(ctx, u.menu, st.menuIndex, t, {
      actions: { play: 'menu.play', help: 'menu.help', settings: 'menu.settings', about: 'menu.about' },
      panel: { x: 146, y: 160, w: 188, h: 88 },
      accent: C.pink, accent2: C.cyan
    });

    // подсказка
    drawText(ctx, tt('title.hint'), W / 2, 255, {
      size: 5.6, weight: 700, fam: F_MONO, color: rgba(C.white, 0.42), align: 'center'
    });
    drawText(ctx, tt('title.version'), 10, 263, {
      size: 5.2, weight: 700, fam: F_MONO, align: 'left', color: rgba(C.white, 0.3), spacing: 1
    });
    drawText(ctx, tt('app.footer'), 470, 263, {
      size: 5.2, weight: 700, fam: F_MONO, align: 'right', color: rgba(C.white, 0.24)
    });

    drawQuickChips(ctx, t);
    drawWeather(ctx, 0, t, { rainScale: 0.85 });
  }

  /* ============================================================
     УНИВЕРСАЛЬНОЕ МЕНЮ
     ============================================================ */
  function drawMenuPanel(ctx, rects, index, t, o) {
    o = o || {};
    if (!rects || !rects.length) return;
    if (o.panel) {
      glass(ctx, o.panel.x, o.panel.y, o.panel.w, o.panel.h, {
        cut: 10, accent: o.accent || C.pink, alpha: 0.88, border: rgba(o.accent || C.pink, 0.28), glow: o.accent, glowBlur: 14
      });
    }
    for (var i = 0; i < rects.length; i++) {
      var r = rects[i];
      var sel = i === index;
      var label = o.labels ? o.labels[i] : (o.actions && o.actions[r.action] ? tt(o.actions[r.action]) : String(r.action || ''));
      var cxm = r.x + r.w / 2;
      var cym = r.y + r.h / 2;
      if (sel) {
        // выбранная плашка
        ctx.save();
        ctx.translate(cxm, cym);
        ctx.transform(1, 0, -0.12, 1, 0, 0);
        var w = r.w - 8, h = r.h - 2;
        var cc = o.accent || C.pink;
        ctx.fillStyle = lg(ctx, -w / 2, 0, w / 2, 0, [
          0, rgba(cc, 0.05), 0.28, rgba(cc, 0.32), 0.72, rgba(cc, 0.38), 1, rgba(cc, 0.12)
        ]);
        rr(ctx, -w / 2, -h / 2, w, h, 2);
        ctx.fill();
        ctx.strokeStyle = rgba('#ffffff', 0.75);
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = rgba(cc, 0.9);
        ctx.fillRect(-w / 2, -h / 2, 2.4, h);
        ctx.fillStyle = rgba(o.accent2 || C.cyan, 0.85);
        ctx.fillRect(-w / 2 + 3, -h / 2, w * 0.45, 1);
        ctx.restore();
        // маркер
        var mx = r.x - 8 + Math.sin(t * 6) * 1.4;
        chevron(ctx, mx, cym, 'right', 3.6, C.white);
        drawText(ctx, label, cxm + 2, cym + 0.5, {
          size: fitSize(ctx, label, r.w - 26, 10.6, 900, F_SANS, 7), weight: 900, fam: F_SANS,
          color: '#ffffff', glow: cc, blur: 9, glowAlpha: 0.6, spacing: 1.2
        });
      } else {
        // номер строки
        drawText(ctx, ('0' + (i + 1)), r.x + 6, cym, {
          size: 5.4, weight: 700, fam: F_MONO, align: 'left', color: rgba(C.white, 0.26)
        });
        drawText(ctx, label, cxm, cym, {
          size: fitSize(ctx, label, r.w - 24, 9.4, 700, F_SANS, 6), weight: 700, fam: F_SANS,
          color: rgba(C.white, 0.72), spacing: 1
        });
      }
    }
  }

  /* ============================================================
     ЭКРАНЫ
     ============================================================ */
  function drawSubHeader(ctx, title, subtitle, accent, y) {
    var ty = y == null ? 25 : y;
    accent = accent || C.pink;
    var tw = measure(ctx, title, 20, 900, F_DISPLAY);
    var size = fitSize(ctx, title, 300, 20, 900, F_DISPLAY, 12);
    tw = measure(ctx, title, size, 900, F_DISPLAY);
    // диагональная плашка
    ctx.save();
    ctx.transform(1, 0, -0.16, 1, 0, 0);
    ctx.fillStyle = lg(ctx, 22, 0, 22 + tw + 26, 0, [0, rgba(accent, 0.55), 0.6, rgba(accent, 0.10), 1, rgba(accent, 0)]);
    ctx.fillRect(22, ty - 14, tw + 26, 28);
    ctx.fillStyle = rgba(accent, 0.9);
    ctx.fillRect(22, ty + 12, tw + 18, 1.4);
    ctx.restore();
    drawText(ctx, title, 30, ty, {
      size: size, weight: 900, fam: F_DISPLAY, italic: true, align: 'left',
      color: '#ffffff', grad: ['#ffffff', '#ffe6f5', accent], glow: accent, blur: 14, glowAlpha: 0.7,
      stroke: 'rgba(5,2,12,0.55)', strokeW: 2.4, spacing: 1
    });
    if (subtitle) {
      drawText(ctx, subtitle, 32, ty + 18, {
        size: 6.8, weight: 700, fam: F_SANS, align: 'left', color: rgba(C.white, 0.6), spacing: 1.6
      });
    }
    // мелкие засечки
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = rgba(accent, 0.7);
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(22, ty - 18); ctx.lineTo(22 + 42, ty - 18); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(22, ty + 21); ctx.lineTo(22 + 18, ty + 21); ctx.stroke();
    ctx.restore();
  }

  function drawBackButton(ctx, label, t) {
    var u = UI();
    var r = u.back;
    if (!r) return;
    glass(ctx, r.x, r.y, r.w, r.h, { cut: 5, accent: C.cyan, alpha: 0.86, border: 'rgba(120,240,255,0.25)' });
    drawText(ctx, label || tt('common.back'), r.x + r.w / 2 + 6, r.y + r.h / 2 + 0.5, {
      size: 6.6, weight: 700, fam: F_SANS, color: rgba(C.white, 0.9), spacing: 1
    });
    chevron(ctx, r.x + 10, r.y + r.h / 2, 'left', 2.8, C.cyan);
  }

  /* ---------------- ВЫБОР БОЙЦА ---------------- */
  var CHAR_META = [
    {
      id: 'comet', accent: C.cyan, accent2: C.pink,
      nameKey: 'char.comet.name', aliasKey: 'char.comet.alias',
      descKey: 'char.comet.desc', specKey: 'char.comet.spec',
      stats: [3, 5, 3, 4]
    },
    {
      id: 'hammer', accent: C.orange, accent2: C.amber,
      nameKey: 'char.hammer.name', aliasKey: 'char.hammer.alias',
      descKey: 'char.hammer.desc', specKey: 'char.hammer.spec',
      stats: [5, 3, 5, 3]
    }
  ];
  var STAT_KEYS = ['stat.power', 'stat.speed', 'stat.armor', 'stat.range'];

  function drawSelectCard(ctx, r, idx, selected, t, st) {
    var meta = CHAR_META[idx];
    if (!meta) return;
    var accent = meta.accent;
    ctx.save();
    if (selected) {
      drawGlow(ctx, r.x + r.w / 2, r.y + r.h / 2, r.w * 0.62, accent, 0.10, 'lighter');
    } else {
      ctx.globalAlpha *= 0.97;
    }
    glass(ctx, r.x, r.y, r.w, r.h, {
      cut: 10, accent: accent, alpha: selected ? 0.99 : 0.98,
      border: selected ? rgba(accent, 0.6) : 'rgba(255,255,255,0.16)',
      glow: selected ? accent : null, glowBlur: 18,
      fillA: selected ? 'rgba(12,16,40,0.98)' : 'rgba(8,10,26,0.97)',
      fillB: selected ? 'rgba(5,6,20,0.99)' : 'rgba(4,5,16,0.98)'
    });
    // клип: всё содержимое живет внутри карточки
    ctx.save();
    cutPath(ctx, r.x + 1, r.y + 1, r.w - 2, r.h - 2, 10);
    ctx.clip();
    // верхняя тонировка
    ctx.fillStyle = lg(ctx, r.x, r.y, r.x + r.w, r.y + r.h * 0.6, [
      0, rgba(accent, selected ? 0.18 : 0.09), 1, rgba(accent, 0)
    ]);
    ctx.fillRect(r.x, r.y, r.w, r.h);
    // диагональные штрихи
    ctx.globalAlpha = selected ? 0.18 : 0.09;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1;
    for (var d = 0; d < 7; d++) {
      ctx.beginPath();
      ctx.moveTo(r.x + 16 + d * 26, r.y + r.h);
      ctx.lineTo(r.x + 40 + d * 26, r.y + r.h * 0.6);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // номер
    drawText(ctx, '0' + (idx + 1), r.x + r.w - 14, r.y + 18, {
      size: 16, weight: 900, fam: F_DISPLAY, align: 'right', color: rgba(accent, selected ? 0.9 : 0.4)
    });
    // имя
    drawText(ctx, tt(meta.aliasKey), r.x + 14, r.y + 20, {
      size: 21, weight: 900, fam: F_DISPLAY, italic: true, align: 'left',
      color: '#ffffff', grad: ['#ffffff', '#ffffff', accent], glow: accent, blur: 10, glowAlpha: selected ? 0.65 : 0.25,
      stroke: 'rgba(5,3,12,0.5)', strokeW: 2
    });
    drawText(ctx, tt(meta.nameKey), r.x + 15, r.y + 34, {
      size: 6.4, weight: 900, fam: F_SANS, align: 'left', color: rgba(accent, 0.95), spacing: 2.4
    });

    // платформа
    var pcx = r.x + 60, pbase = r.y + r.h - 16;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(ctx, pcx, pbase, 44, accent, selected ? 0.17 : 0.09, 'lighter');
    ctx.strokeStyle = rgba(accent, selected ? 0.62 : 0.3);
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(pcx, pbase, 40, 8.5, 0, 0, TAU); ctx.stroke();
    ctx.strokeStyle = rgba(accent, selected ? 0.30 : 0.14);
    ctx.beginPath(); ctx.ellipse(pcx, pbase, 29, 5.8, 0, 0, TAU); ctx.stroke();
    ctx.restore();

    // фигура героя
    var fake = {
      id: 700 + idx, kind: 'player', char: meta.id, x: pcx, y: pbase - 1, z: 0,
      facing: 1, anim: selected ? 'ready' : 'idle', animT: 0.3 + idx, scale: 1.16,
      alpha: 1, flash: 0, hp: 1, maxHp: 1, state: 'idle', attack: null
    };
    drawActor(ctx, fake, t, 0, { portrait: true, noReflect: true });

    // статы
    var sx = r.x + 118, sy = r.y + 46, sw = r.w - 134;
    for (var i = 0; i < 4; i++) {
      var yy = sy + i * 10.5;
      drawText(ctx, tt(STAT_KEYS[i]), sx, yy, {
        size: 4.9, weight: 700, fam: F_SANS, align: 'left', color: rgba(C.white, 0.55), spacing: 0.5
      });
      var bx = sx + 34, bw = Math.max(20, sw - 34);
      rr(ctx, bx, yy - 2, bw, 3.6, 1.8);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fill();
      var v = meta.stats[i] / 5;
      rr(ctx, bx, yy - 2, Math.max(2, bw * v), 3.6, 1.8);
      ctx.fillStyle = lg(ctx, bx, 0, bx + bw, 0, [0, rgba(accent, 0.55), 1, accent]);
      ctx.fill();
      if (selected) {
        ctx.fillStyle = 'rgba(255,255,255,0.38)';
        ctx.fillRect(bx + 1, yy - 1.4, Math.max(1, bw * v - 2), 1);
      }
    }
    // описание
    var desc = tt(meta.descKey);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(r.x + 7, r.y + 104, r.w - 14, 30);
    var lines = wrapLines(ctx, desc, r.w - 22, 5.4, 400, F_SANS);
    for (var l = 0; l < Math.min(lines.length, 3); l++) {
      drawText(ctx, lines[l], r.x + 13, r.y + 113 + l * 7.6, {
        size: 5.4, weight: 400, fam: F_SANS, align: 'left', color: rgba(C.white, 0.78)
      });
    }
    // спец
    drawText(ctx, tt(meta.specKey), r.x + 13, r.y + r.h - 28, {
      size: 5.7, weight: 900, fam: F_SANS, align: 'left', color: rgba(meta.accent2, 0.95),
      spacing: 0.6, glow: meta.accent2, blur: 5, glowAlpha: 0.4
    });
    // затемнение невыбранной карточки
    if (!selected) {
      ctx.fillStyle = 'rgba(3,4,12,0.52)';
      ctx.fillRect(r.x, r.y, r.w, r.h);
    }
    // выбранный маркер
    if (selected) {
      ctx.save();
      ctx.globalAlpha = 0.55 + 0.35 * Math.sin(t * 4);
      ctx.strokeStyle = rgba(accent, 0.9);
      ctx.lineWidth = 1.4;
      var c = 7, x0 = r.x + 2, y0 = r.y + 2, w0 = r.w - 4, h0 = r.h - 4;
      ctx.beginPath();
      ctx.moveTo(x0, y0 + c + 8); ctx.lineTo(x0, y0 + c); ctx.lineTo(x0 + c + 8, y0);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x0 + w0 - c - 8, y0 + h0); ctx.lineTo(x0 + w0 - c, y0 + h0); ctx.lineTo(x0 + w0, y0 + h0 - c - 8);
      ctx.stroke();
      ctx.restore();
      // бейдж выбора
      var bx0 = r.x + r.w - 24, by0 = r.y + 38;
      ctx.save();
      ctx.shadowColor = accent;
      ctx.shadowBlur = 10;
      ctx.fillStyle = accent;
      ctx.beginPath(); ctx.arc(bx0, by0, 7.2, 0, TAU); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(5,6,14,0.95)';
      ctx.lineWidth = 1.8;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(bx0 - 3.4, by0 + 0.2);
      ctx.lineTo(bx0 - 0.8, by0 + 2.8);
      ctx.lineTo(bx0 + 3.6, by0 - 2.8);
      ctx.stroke();
      ctx.restore();
      // лента сбоку
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = lg(ctx, r.x, 0, r.x + 6, 0, [0, accent, 1, rgba(accent, 0.1)]);
      ctx.fillRect(r.x, r.y + 12, 4.4, r.h - 24);
      ctx.globalAlpha = 0.8;
      for (var st2 = 0; st2 < 5; st2++) {
        ctx.fillStyle = st2 % 2 ? rgba(accent, 0.6) : 'rgba(5,6,14,0.9)';
        ctx.fillRect(r.x + 4.4, r.y + 22 + st2 * 7, 2.4, 3.4);
      }
      ctx.restore();
    }
    ctx.restore(); // clip
    ctx.restore();
  }

  function screenSelect(ctx, st, t) {
    var u = UI();
    var sel = st.select || {};
    drawZoneBg(ctx, 0, CAM_MID[0], t, { dim: 0.58, signAlpha: 0.5 });
    drawEmbers(ctx, 0, t);
    drawShafts(ctx, [{ x: 20, col: C.cyan }, { x: 300, col: C.pink }], t, 0.7);
    ctx.fillStyle = lg(ctx, 0, 0, 0, H, [0, 'rgba(4,2,12,0.55)', 0.4, 'rgba(4,2,12,0.25)', 1, 'rgba(4,2,12,0.55)']);
    ctx.fillRect(0, 0, W, H);

    drawSubHeader(ctx, tt('select.title'), tt('select.subtitle'), C.pink, 30);

    var chars = u.chars || [];
    for (var i = 0; i < chars.length; i++) {
      var r = chars[i];
      drawSelectCard(ctx, r, i, sel.char === i, t, st);
    }

    // сложность
    var diffs = u.diffs || [];
    if (diffs.length) {
      var dmid = diffs[0].x + ((diffs[diffs.length - 1].x + diffs[diffs.length - 1].w) - diffs[0].x) / 2;
      drawText(ctx, tt('select.difficulty'), dmid, diffs[0].y - 6, {
        size: 5.6, weight: 700, fam: F_SANS, color: rgba(C.white, 0.55), spacing: 2.4
      });
    }
    for (var d = 0; d < diffs.length; d++) {
      var rd = diffs[d];
      var seld = sel.diff === d;
      var dname = tt(d === 0 ? 'diff.easy' : d === 1 ? 'diff.normal' : 'diff.hard');
      if (seld) {
        ctx.save();
        var g = lg(ctx, rd.x, 0, rd.x + rd.w, 0, [0, rgba(C.lime, 0.85), 0.5, rgba(C.lime, 0.55), 1, rgba(C.cyan, 0.5)]);
        rr(ctx, rd.x, rd.y, rd.w, rd.h, 3);
        ctx.fillStyle = g;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
        drawText(ctx, dname, rd.x + rd.w / 2, rd.y + rd.h / 2 + 0.5, {
          size: fitSize(ctx, dname, rd.w - 12, 8.4, 900, F_SANS, 6), weight: 900, fam: F_SANS,
          color: '#08120a', align: 'center', spacing: 1.2
        });
      } else {
        glass(ctx, rd.x, rd.y, rd.w, rd.h, { cut: 4, accent: C.cyan, alpha: 0.7, border: 'rgba(255,255,255,0.14)' });
        drawText(ctx, dname, rd.x + rd.w / 2, rd.y + rd.h / 2 + 0.5, {
          size: fitSize(ctx, dname, rd.w - 12, 7.6, 700, F_SANS, 5.4), weight: 700, fam: F_SANS,
          color: rgba(C.white, 0.8), align: 'center', spacing: 1
        });
      }
    }

    // старт
    var sb = u.selectStart;
    if (sb) {
      var pk = 0.65 + 0.35 * Math.sin(t * 4.2);
      glass(ctx, sb.x, sb.y, sb.w, sb.h, {
        cut: 6, accent: C.lime, glow: C.lime, glowBlur: 16 * pk, alpha: 0.95, border: rgba(C.lime, 0.6)
      });
      ctx.save();
      ctx.globalAlpha = 0.18 + 0.12 * pk;
      ctx.fillStyle = lg(ctx, sb.x, 0, sb.x + sb.w, 0, [0, rgba(C.lime, 0.6), 1, rgba(C.cyan, 0.3)]);
      cutPath(ctx, sb.x, sb.y, sb.w, sb.h, 6);
      ctx.fill();
      ctx.restore();
      drawText(ctx, tt('select.start'), sb.x + sb.w / 2, sb.y + sb.h / 2 + 0.5, {
        size: fitSize(ctx, tt('select.start'), sb.w - 18, 10, 900, F_SANS, 7), weight: 900, fam: F_SANS,
        color: '#f6ffe4', glow: C.lime, blur: 10, glowAlpha: 0.6, spacing: 1.4
      });
    }

    // подсказка
    drawText(ctx, tt('select.hint'), W / 2, 262, {
      size: 5.4, weight: 700, fam: F_MONO, color: rgba(C.white, 0.42)
    });
    drawQuickChips(ctx, t);
    drawWeather(ctx, 0, t, { rainScale: 0.65 });
  }

  /* ---------------- ИНТРО ---------------- */
  function drawChipArt(ctx, cx, cy, s, t) {
    ctx.save();
    ctx.translate(cx, cy + Math.sin(t * 1.6) * 3);
    ctx.rotate(Math.sin(t * 0.7) * 0.06);
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(ctx, 0, 0, s * 1.9, C.cyan, 0.20, 'lighter');
    drawGlow(ctx, 0, 0, s * 1.1, C.pink, 0.16, 'lighter');
    ctx.globalCompositeOperation = 'source-over';
    // корпус чипа
    var g = lg(ctx, -s, -s, s, s, [0, '#122040', 0.5, '#0a1226', 1, '#050812']);
    rr(ctx, -s * 0.62, -s * 0.62, s * 1.24, s * 1.24, 4);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = rgba(C.cyan, 0.7);
    ctx.lineWidth = 1;
    ctx.stroke();
    // ножки
    ctx.strokeStyle = rgba(C.cyan2, 0.55);
    ctx.lineWidth = 1.4;
    for (var i = 0; i < 6; i++) {
      var off = -s * 0.45 + i * s * 0.18;
      ctx.beginPath(); ctx.moveTo(off, -s * 0.62); ctx.lineTo(off, -s * 0.82); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(off, s * 0.62); ctx.lineTo(off, s * 0.82); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-s * 0.62, off); ctx.lineTo(-s * 0.82, off); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(s * 0.62, off); ctx.lineTo(s * 0.82, off); ctx.stroke();
    }
    // ядро
    var cg = lg(ctx, -s * 0.3, -s * 0.3, s * 0.3, s * 0.3, [0, '#8ff6ff', 0.5, '#22e6ff', 1, '#0a6fd0']);
    rr(ctx, -s * 0.3, -s * 0.3, s * 0.6, s * 0.6, 2);
    ctx.fillStyle = cg;
    ctx.fill();
    // схема
    ctx.strokeStyle = 'rgba(4,10,24,0.8)';
    ctx.lineWidth = 0.8;
    for (var k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.moveTo(-s * 0.28 + k * s * 0.18, -s * 0.28);
      ctx.lineTo(-s * 0.28 + k * s * 0.18, s * 0.28);
      ctx.stroke();
    }
    ctx.fillStyle = '#04101c';
    ctx.fillRect(-s * 0.08, -s * 0.08, s * 0.16, s * 0.16);
    ctx.fillStyle = C.lime;
    ctx.fillRect(-s * 0.03, s * 0.12, s * 0.06, s * 0.06);
    // блик
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(-s * 0.55, -s * 0.55, s * 0.5, 1.2);
    ctx.restore();
    // код
    ctx.save();
    ctx.globalAlpha = 0.6;
    for (var r = 0; r < 4; r++) {
      var line = 'NEON-8 · ' + ('000' + Math.floor(hash(r * 3.3 + Math.floor(t * 2)) * 999)).slice(-3);
      drawText(ctx, line, cx + s * 1.05, cy - 18 + r * 9, {
        size: 4.6, weight: 700, fam: F_MONO, align: 'left', color: rgba(C.cyan, 0.6), spacing: 0.6
      });
    }
    ctx.restore();
  }

  function screenIntro(ctx, st, t) {
    drawZoneBg(ctx, 0, CAM_MID[0], t, { dim: 0.76, signAlpha: 0.25 });
    drawEmbers(ctx, 0, t);
    drawShafts(ctx, [{ x: 60, col: C.pink }, { x: 330, col: C.cyan }], t, 0.8);
    ctx.fillStyle = lg(ctx, 0, 0, 0, H, [0, 'rgba(3,1,9,0.86)', 0.5, 'rgba(4,2,12,0.62)', 1, 'rgba(3,1,9,0.9)']);
    ctx.fillRect(0, 0, W, H);
    // леттербокс
    ctx.fillStyle = '#020107';
    ctx.fillRect(0, 0, W, 14);
    ctx.fillRect(0, H - 14, W, 14);
    ctx.fillStyle = rgba(C.pink, 0.25);
    ctx.fillRect(0, 14, W, 1);

    // глава
    drawText(ctx, tt('intro.chapter'), 38, 38, {
      size: 6.4, weight: 700, fam: F_MONO, align: 'left', color: rgba(C.pink, 0.9), spacing: 3
    });
    ctx.save();
    ctx.fillStyle = rgba(C.pink, 0.8);
    ctx.fillRect(38, 43, 26, 1.2);
    ctx.restore();
    // заголовок
    var title = tt('intro.title');
    var ts = fitSize(ctx, title, 300, 26, 900, F_DISPLAY, 14);
    drawText(ctx, title, 36, 62, {
      size: ts, weight: 900, fam: F_DISPLAY, italic: true, align: 'left', color: '#ffffff',
      grad: ['#ffffff', '#ffd9ec', C.pink], glow: C.pink, blur: 16, glowAlpha: 0.7,
      stroke: 'rgba(5,2,12,0.6)', strokeW: 2.6
    });
    // текст
    var lines = [];
    var paragraphs = [tt('intro.text1'), tt('intro.text2'), tt('intro.text3')];
    var yy = 82;
    for (var p = 0; p < paragraphs.length; p++) {
      var l = wrapLines(ctx, paragraphs[p], 258, 7.2, 400, F_SANS);
      for (var i = 0; i < l.length; i++) { lines.push(l[i]); }
      lines.push('');
    }
    for (var li = 0; li < lines.length; li++) {
      if (!lines[li]) { yy += 5; continue; }
      drawText(ctx, lines[li], 38, yy, {
        size: 7.2, weight: 400, fam: F_SANS, align: 'left', color: rgba(C.white, 0.86)
      });
      yy += 10.5;
    }
    // арт чипа справа
    drawChipArt(ctx, 388, 116, 44, t);
    // нижние кнопки
    if (Math.sin(t * 3.2) > -0.4) {
      drawText(ctx, tt('intro.start'), 38, 226, {
        size: 8.4, weight: 900, fam: F_SANS, align: 'left', color: '#f9ffe8',
        glow: C.lime, blur: 10, glowColor: C.lime, glowAlpha: 0.6, spacing: 1.2
      });
    }
    drawText(ctx, tt('intro.skip'), 38, 240, {
      size: 6, weight: 700, fam: F_MONO, align: 'left', color: rgba(C.white, 0.45), spacing: 1
    });
    // постер «2087»
    ctx.save();
    ctx.globalAlpha = 0.16;
    drawText(ctx, '2087', 456, 62, {
      size: 46, weight: 900, fam: F_DISPLAY, italic: true, align: 'right', color: C.pink, spacing: 2
    });
    ctx.restore();
    drawText(ctx, 'NEON CITY · TOXIC CORP', 456, 96, {
      size: 5, weight: 700, fam: F_MONO, align: 'right', color: rgba(C.pink, 0.55), spacing: 1.4
    });
    // брифинг
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = 'rgba(5,4,14,0.62)';
    cutPath(ctx, 36, 158, 408, 44, 8);
    ctx.fill();
    ctx.strokeStyle = rgba(C.cyan, 0.18);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
    var brief = [
      ['ЛОКАЦИЯ', 'NEON CITY · КВАРТАЛ 7'],
      ['ЦЕЛЬ', 'ЧИП NEON-8'],
      ['СТАТУС', 'УЛИЦА В ОГНЕ']
    ];
    for (var bi = 0; bi < 3; bi++) {
      var bx2 = 52 + bi * 132;
      drawText(ctx, brief[bi][0], bx2, 170, {
        size: 4.8, weight: 700, fam: F_MONO, align: 'left', color: rgba(C.white, 0.4), spacing: 1.6
      });
      drawText(ctx, brief[bi][1], bx2, 182, {
        size: 6.2, weight: 700, fam: F_SANS, align: 'left',
        color: bi === 2 ? rgba(C.pink, 0.9) : rgba(C.white, 0.82), spacing: 0.4
      });
    }
    ctx.save();
    ctx.globalAlpha = 0.32;
    ctx.fillStyle = C.amber;
    for (var hs = 0; hs < 14; hs++) {
      ctx.fillRect(36 + hs * 30, 196, 14, 2.2);
    }
    ctx.restore();
    drawText(ctx, tt('app.footer'), W / 2, 263, {
      size: 4.8, weight: 700, fam: F_MONO, align: 'center', color: rgba(C.white, 0.3)
    });
    drawWeather(ctx, 0, t, { rainScale: 0.7 });
  }

  /* ---------------- УПРАВЛЕНИЕ ---------------- */
  function helpRow(ctx, x, y, w, label, keys) {
    drawText(ctx, label, x, y, {
      size: 7.4, weight: 900, fam: F_SANS, align: 'left', color: rgba(C.white, 0.9), spacing: 0.8
    });
    var kx = x + w;
    var kw = measure(ctx, keys, 5.6, 700, F_MONO) + 12;
    kx -= kw;
    ctx.save();
    rr(ctx, kx, y - 5.5, kw, 11, 2.5);
    ctx.fillStyle = 'rgba(6,8,20,0.85)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,230,255,0.30)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
    drawText(ctx, keys, kx + kw / 2, y + 0.5, {
      size: 5.6, weight: 700, fam: F_MONO, color: '#d9f9ff', align: 'center'
    });
  }

  function tipCard(ctx, x, y, w, h, title, text, color, t) {
    glass(ctx, x, y, w, h, { cut: 5, accent: color, alpha: 0.72, border: rgba(color, 0.28) });
    drawText(ctx, title, x + 8, y + 9, {
      size: 6.4, weight: 900, fam: F_SANS, align: 'left', color: rgba(color, 0.95), spacing: 1.6
    });
    var lines = wrapLines(ctx, text, w - 16, 5.4, 400, F_SANS);
    for (var i = 0; i < Math.min(lines.length, 4); i++) {
      drawText(ctx, lines[i], x + 8, y + 19 + i * 7, {
        size: 5.4, weight: 400, fam: F_SANS, align: 'left', color: rgba(C.white, 0.65)
      });
    }
  }

  function screenHelp(ctx, st, t) {
    drawZoneBg(ctx, 1, CAM_MID[1], t, { dim: 0.74, signAlpha: 0.3 });
    drawSteam(ctx, 1, CAM_MID[1], t);
    ctx.fillStyle = lg(ctx, 0, 0, 0, H, [0, 'rgba(3,4,10,0.86)', 0.5, 'rgba(3,5,12,0.6)', 1, 'rgba(2,3,8,0.9)']);
    ctx.fillRect(0, 0, W, H);
    drawSubHeader(ctx, tt('help.title'), null, C.lime, 28);

    // левая колонка — управление
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = 'rgba(182,255,58,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(40, 52); ctx.lineTo(40, 200); ctx.stroke();
    ctx.restore();
    var rows = [
      ['help.move', 'help.moveKeys'], ['help.jump', 'help.jumpKeys'],
      ['help.punch', 'help.punchKeys'], ['help.kick', 'help.kickKeys'],
      ['help.special', 'help.specialKeys'], ['help.pause', 'help.pauseKeys']
    ];
    for (var i = 0; i < rows.length; i++) {
      var y = 62 + i * 22;
      var r = i % 2 === 0;
      ctx.save();
      ctx.globalAlpha = r ? 0.55 : 0.4;
      ctx.fillStyle = 'rgba(10,16,24,0.6)';
      cutPath(ctx, 36, y - 8, 224, 17, 4);
      ctx.fill();
      ctx.restore();
      if (i === 0) {
        ctx.fillStyle = rgba(C.lime, 0.8);
        ctx.fillRect(36, y - 8, 2, 17);
      }
      helpRow(ctx, 46, y + 1, 196, tt(rows[i][0]), tt(rows[i][1]));
    }
    // подсказка «быстро»
    tipCard(ctx, 40, 200, 220, 36, tt('help.quick'), tt('help.quickKeys'), C.cyan, t);

    // правая колонка — приёмы
    tipCard(ctx, 272, 56, 172, 40, tt('help.combo'), tt('help.comboText'), C.pink, t);
    tipCard(ctx, 272, 102, 172, 36, tt('help.air'), tt('help.airText'), C.cyan, t);
    tipCard(ctx, 272, 144, 172, 40, tt('help.rage'), tt('help.rageText'), C.lime, t);
    tipCard(ctx, 272, 190, 172, 46, tt('help.tipTitle'), tt('help.tip'), C.amber, t);

    // назад
    drawBackButton(ctx, tt('help.back'), t);
    drawQuickChips(ctx, t);
    drawWeather(ctx, 1, t, { rainScale: 0.4 });
  }

  /* ---------------- НАСТРОЙКИ ---------------- */
  function settingValue(set, id) {
    switch (id) {
      case 'lang': return String(set.lang || 'ru').toUpperCase();
      case 'gfx': return tt(set.gfx === 'retro' ? 'gfx.retro' : 'gfx.modern');
      case 'music': return tt(set.music ? 'common.on' : 'common.off');
      case 'audioStyle': return tt(set.audioStyle === 'synth' ? 'audio.synth' : 'audio.chip');
      case 'sfx': return tt(set.sfx ? 'common.on' : 'common.off');
      case 'volume': return Math.round((set.volume == null ? 0.8 : set.volume) * 100) + '%';
      case 'crt': return tt(set.crt ? 'common.on' : 'common.off');
      case 'difficulty': return tt('diff.' + (set.difficulty || 'normal'));
      case 'reset': return '';
      default: return '';
    }
  }
  function settingColor(id, set) {
    if (id === 'gfx') return set.gfx === 'retro' ? C.amber : C.lime;
    if (id === 'lang') return C.cyan;
    if (id === 'music' || id === 'sfx') return set[id] ? C.pink : C.dim;
    if (id === 'audioStyle') return set.audioStyle === 'synth' ? C.violet2 : C.amber;
    if (id === 'volume') return C.cyan;
    if (id === 'crt') return set.crt ? C.lime : C.dim;
    if (id === 'difficulty') return set.difficulty === 'hard' ? C.red : set.difficulty === 'easy' ? C.lime : C.amber;
    if (id === 'reset') return C.red;
    return C.cyan;
  }

  function screenSettings(ctx, st, t) {
    var set = DSet();
    var u = UI();
    drawZoneBg(ctx, 0, CAM_MID[0], t, { dim: 0.78, signAlpha: 0.25 });
    drawEmbers(ctx, 0, t);
    ctx.fillStyle = lg(ctx, 0, 0, 0, H, [0, 'rgba(3,2,10,0.88)', 0.5, 'rgba(4,3,14,0.62)', 1, 'rgba(3,2,10,0.9)']);
    ctx.fillRect(0, 0, W, H);
    drawSubHeader(ctx, tt('settings.title'), null, C.cyan, 28);

    // запись рекорда справа под чипами
    glass(ctx, 358, 40, 96, 16, { cut: 4, accent: C.amber, alpha: 0.8, border: 'rgba(255,179,0,0.25)' });
    drawText(ctx, tt('hud.best'), 366, 48, { size: 5, weight: 700, fam: F_MONO, align: 'left', color: rgba(C.white, 0.55) });
    drawText(ctx, fmt(set.best || 0), 446, 48, { size: 8, weight: 900, fam: F_DISPLAY, align: 'right', color: '#fff0c0' });

    var rows = u.settings || [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var sel = i === (st.settingsIndex || 0);
      var id = r.id;
      var val = settingValue(set, id);
      var col = settingColor(id, set);
      if (sel) {
        ctx.save();
        var g = lg(ctx, r.x, 0, r.x + r.w, 0, [0, rgba(C.cyan, 0.22), 0.5, rgba(C.cyan, 0.10), 1, rgba(C.pink, 0.06)]);
        rr(ctx, r.x, r.y, r.w, r.h, 3);
        ctx.fillStyle = g;
        ctx.fill();
        ctx.strokeStyle = rgba(C.cyan, 0.55);
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = rgba(C.cyan, 0.9);
        ctx.fillRect(r.x, r.y, 2.4, r.h);
        ctx.restore();
        chevron(ctx, r.x + 9, r.y + r.h / 2, 'right', 2.6, C.cyan);
      } else {
        ctx.save();
        rr(ctx, r.x, r.y, r.w, r.h, 3);
        ctx.fillStyle = 'rgba(7,10,22,0.72)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.07)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      }
      drawText(ctx, tt('settings.' + id), r.x + 18, r.y + r.h / 2 + 0.5, {
        size: 7.4, weight: sel ? 900 : 700, fam: F_SANS, align: 'left',
        color: sel ? '#ffffff' : rgba(C.white, 0.72), spacing: 0.8
      });
      if (id === 'volume') {
        var pct = clamp(set.volume == null ? 0.8 : set.volume, 0, 1);
        var bx = r.x + r.w - 108;
        bar(ctx, bx, r.y + 5.5, 54, 4.5, pct, { accent: C.cyan, accent2: C.cyan2, glow: C.cyan, glowBlur: 5 });
        drawText(ctx, val, r.x + r.w - 14, r.y + r.h / 2 + 0.5, {
          size: 7, weight: 700, fam: F_MONO, align: 'right', color: col
        });
      } else if (id === 'reset') {
        drawText(ctx, '↺', r.x + r.w - 14, r.y + r.h / 2 + 0.5, {
          size: 8, weight: 700, fam: F_SANS, align: 'right', color: sel ? C.red : rgba(C.red, 0.65)
        });
      } else {
        drawText(ctx, val, r.x + r.w - 22, r.y + r.h / 2 + 0.5, {
          size: fitSize(ctx, val, 110, 7.2, 700, F_SANS, 5.4), weight: 700, fam: F_SANS,
          align: 'right', color: col, glow: sel ? col : null, blur: 6, glowAlpha: 0.4
        });
        // стрелки изменения
        chevron(ctx, r.x + r.w - 12, r.y + r.h / 2, 'right', 2.4, sel ? rgba(C.white, 0.8) : rgba(C.white, 0.25));
        ctx.save();
        ctx.translate(r.x + r.w - 12, r.y + r.h / 2);
        ctx.rotate(PI);
        ctx.translate(-(r.x + r.w - 12), -(r.y + r.h / 2));
        ctx.restore();
      }
    }
    // нижняя подсказка
    drawText(ctx, tt('settings.hint'), W / 2, 232, {
      size: 5.6, weight: 700, fam: F_MONO, align: 'center', color: rgba(C.white, 0.42)
    });
    drawBackButton(ctx, null, t);
    drawQuickChips(ctx, t);
    drawWeather(ctx, 0, t, { rainScale: 0.5 });
  }

  /* ---------------- ОБ ИГРЕ ---------------- */
  function screenAbout(ctx, st, t) {
    drawZoneBg(ctx, 2, CAM_MID[2], t, { dim: 0.76, signAlpha: 0.28 });
    drawEmbers(ctx, 2, t);
    ctx.fillStyle = lg(ctx, 0, 0, 0, H, [0, 'rgba(4,2,12,0.84)', 0.5, 'rgba(5,3,16,0.58)', 1, 'rgba(3,2,10,0.9)']);
    ctx.fillRect(0, 0, W, H);
    // водяной знак
    ctx.save();
    ctx.globalAlpha = 0.10;
    ctx.translate(W / 2, 160);
    ctx.rotate(-0.16);
    drawText(ctx, tt('app.subtitle'), 0, 0, {
      size: 64, weight: 900, fam: F_DISPLAY, italic: true, align: 'center', color: C.pink, spacing: 4
    });
    ctx.restore();
    drawSubHeader(ctx, tt('about.title'), tt('about.tech'), C.violet, 28);

    // логотип-марка
    drawPosterLine(ctx, 'DD×BT', W / 2, 72, {
      size: 30, c1: '#ffffff', c2: '#ffb3db', c3: C.pink, glow: C.pink, glowAlpha: 0.55
    });
    drawText(ctx, tt('app.subtitle'), W / 2, 94, {
      size: 12, weight: 900, fam: F_DISPLAY, italic: true, color: rgba(C.lime, 0.95), spacing: 5,
      glow: C.lime, blur: 10, glowAlpha: 0.5
    });

    var paras = [tt('about.text1'), tt('about.text2'), tt('about.text3')];
    var y = 118;
    for (var p = 0; p < paras.length; p++) {
      var lines = wrapLines(ctx, paras[p], 386, 7.4, 400, F_SANS);
      for (var i = 0; i < lines.length; i++) {
        drawText(ctx, lines[i], W / 2, y, {
          size: 7.4, weight: 400, fam: F_SANS, align: 'center', color: rgba(C.white, 0.8)
        });
        y += 10.5;
      }
      y += 3;
    }
    // тех-чипы
    var chips = ['CANVAS 2D', 'WEBAUDIO', 'ES2019', '0 ASSETS', 'RU / EN'];
    var cw = 72, gap = 6, total = chips.length * cw + (chips.length - 1) * gap;
    var cx = (W - total) / 2;
    for (var c = 0; c < chips.length; c++) {
      var rx = cx + c * (cw + gap);
      glass(ctx, rx, 174, cw, 14, { cut: 4, accent: c % 2 ? C.pink : C.cyan, alpha: 0.7, border: 'rgba(255,255,255,0.12)' });
      drawText(ctx, chips[c], rx + cw / 2, 181, {
        size: 5.4, weight: 700, fam: F_MONO, color: rgba(C.white, 0.8), spacing: 1
      });
    }
    drawText(ctx, tt('about.credits'), W / 2, 204, {
      size: 6.2, weight: 700, fam: F_MONO, align: 'center', color: rgba(C.amber, 0.85), spacing: 1.6
    });
    drawText(ctx, tt('app.tribute'), W / 2, 216, {
      size: 6, weight: 400, fam: F_SANS, align: 'center', color: rgba(C.white, 0.45)
    });
    drawBackButton(ctx, tt('about.back'), t);
    drawQuickChips(ctx, t);
    drawWeather(ctx, 2, t, { rainScale: 0.7 });
  }

  /* ---------------- ПАУЗА ---------------- */
  function screenPaused(ctx, st, t) {
    drawPlayWorld(ctx, st, t);
    // затемнение
    ctx.fillStyle = 'rgba(3,2,12,0.70)';
    ctx.fillRect(0, 0, W, H);
    drawShafts(ctx, [{ x: 80, col: C.violet }, { x: 320, col: C.pink }], t, 0.6);
    // подложка заголовка
    ctx.save();
    ctx.fillStyle = 'rgba(4,2,12,0.82)';
    ctx.beginPath();
    ctx.moveTo(140, 60); ctx.lineTo(348, 60); ctx.lineTo(336, 92); ctx.lineTo(152, 92);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = rgba(C.pink, 0.35);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
    // заголовок
    drawText(ctx, tt('pause.title'), W / 2, 74, {
      size: 30, weight: 900, fam: F_DISPLAY, italic: true, align: 'center',
      color: '#ffffff', grad: ['#ffffff', '#ffd6ec', C.pink], glow: C.pink, blur: 18, glowAlpha: 0.7,
      stroke: 'rgba(5,2,12,0.6)', strokeW: 3
    });
    // полоски
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = rgba(C.pink, 0.7);
    ctx.fillRect(W / 2 - 70, 92, 140, 1);
    ctx.restore();
    var u = UI();
    drawMenuPanel(ctx, u.pause, st.pauseIndex, t, {
      actions: { resume: 'menu.resume', settings: 'menu.settings', restart: 'menu.restart', title: 'menu.mainmenu' },
      panel: { x: 146, y: 100, w: 188, h: 96 }, accent: C.pink, accent2: C.cyan
    });
    drawText(ctx, tt('pause.hint'), W / 2, 212, {
      size: 6.2, weight: 700, fam: F_MONO, color: rgba(C.white, 0.55), spacing: 1
    });
    drawQuickChips(ctx, t);
  }

  /* ---------------- ГИБЕЛЬ ---------------- */
  function screenDead(ctx, st, t) {
    drawPlayWorld(ctx, st, t);
    drawHUD(ctx, st, t);
    var run = st.run || {};
    var a = 0.5 + 0.25 * Math.sin(t * 5);
    ctx.fillStyle = 'rgba(40,2,12,' + (0.4 * a) + ')';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = rg(ctx, W / 2, H / 2, 40, W / 2, H / 2, W * 0.7, [0, 'rgba(0,0,0,0)', 1, 'rgba(20,0,8,0.7)']);
    ctx.fillRect(0, 0, W, H);
    drawBannerSlab(ctx, W / 2, 96, W - 60, 36, 'defeat', t, 0.9, -1);
    drawText(ctx, tt('banner.defeat'), W / 2, 96, {
      size: 26, weight: 900, fam: F_DISPLAY, italic: true, align: 'center',
      color: '#fff0f2', grad: ['#ffffff', '#ffb1b1', C.red], glow: C.red, blur: 18, glowAlpha: 0.8,
      stroke: 'rgba(8,1,6,0.6)', strokeW: 3, spacing: 1
    });
    // жизни
    var lives = clamp(run.lives == null ? 0 : run.lives, 0, 5);
    if (lives > 0) {
      drawText(ctx, tt('hud.lives'), W / 2, 124, {
        size: 6, weight: 700, fam: F_MONO, align: 'center', color: rgba(C.white, 0.6), spacing: 2
      });
      for (var i = 0; i < lives; i++) {
        lifeIcon(ctx, W / 2 - (lives - 1) * 8 + i * 16, 138, 11, C.red);
      }
    }
    drawBanner(ctx, st, t);
  }

  /* ---------------- КОНЕЦ ИГРЫ / ПОБЕДА ---------------- */
  function drawEndStats(ctx, st, x, y, w, t) {
    var run = st.run || {};
    var stats = run.stats || {};
    var rows = [
      ['end.score', fmt(run.score || 0), C.amber],
      ['end.time', fmtTime(run.elapsed || 0), C.cyan],
      ['end.kills', String(stats.kills || run.kills || 0), C.pink],
      ['end.maxCombo', '×' + (stats.maxCombo || run.maxCombo || 0), C.lime]
    ];
    glass(ctx, x, y, w, 74, { cut: 8, accent: C.cyan, alpha: 0.78, border: 'rgba(140,230,255,0.22)' });
    for (var i = 0; i < rows.length; i++) {
      var col = i % 2, row = Math.floor(i / 2);
      var rx = x + 12 + col * (w / 2);
      var ry = y + 16 + row * 28;
      drawText(ctx, tt(rows[i][0]), rx, ry, {
        size: 5.4, weight: 700, fam: F_MONO, align: 'left', color: rgba(C.white, 0.45), spacing: 1.2
      });
      drawText(ctx, rows[i][1], rx + 2, ry + 13, {
        size: 12, weight: 900, fam: F_DISPLAY, align: 'left', color: '#ffffff',
        grad: ['#ffffff', '#ffffff', rows[i][2]], glow: rows[i][2], blur: 8, glowAlpha: 0.45
      });
    }
    // рекорд
    drawText(ctx, tt('end.best') + ' ' + fmt(run.best || 0), x + w - 12, y + 8, {
      size: 5.4, weight: 700, fam: F_MONO, align: 'right', color: rgba(C.amber, 0.8), spacing: 1
    });
    if (run.newBest) {
      var pk = 0.6 + 0.4 * Math.sin(t * 6);
      ctx.save();
      ctx.globalAlpha = pk;
      drawText(ctx, tt('end.newBest'), x + w / 2, y + 74 - 8, {
        size: 7.6, weight: 900, fam: F_DISPLAY, italic: true, align: 'center', color: '#fff3b8',
        glow: C.amber, blur: 10, glowAlpha: 0.9, spacing: 1.6
      });
      ctx.restore();
    }
  }

  function drawEndButtons(ctx, st, t, accent) {
    var u = UI();
    var idx = st.endIndex || 0;
    var labels = { retry: tt('menu.retry'), title: tt('menu.mainmenu') };
    for (var i = 0; i < (u.end || []).length; i++) {
      var r = u.end[i];
      var sel = i === idx;
      if (sel) {
        ctx.save();
        ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
        ctx.transform(1, 0, -0.1, 1, 0, 0);
        var w = r.w - 6, h = r.h - 2;
        ctx.fillStyle = lg(ctx, -w / 2, 0, w / 2, 0, [0, rgba(accent, 0.15), 0.5, rgba(accent, 0.5), 1, rgba(accent, 0.2)]);
        rr(ctx, -w / 2, -h / 2, w, h, 3);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.75)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
        chevron(ctx, r.x - 8 + Math.sin(t * 6) * 1.2, r.y + r.h / 2, 'right', 3.4, C.white);
      } else {
        glass(ctx, r.x, r.y, r.w, r.h, { cut: 4, accent: accent, alpha: 0.62, border: 'rgba(255,255,255,0.14)' });
      }
      drawText(ctx, labels[r.action] || String(r.action), r.x + r.w / 2, r.y + r.h / 2 + 0.5, {
        size: fitSize(ctx, labels[r.action] || '', r.w - 24, 9, 900, F_SANS, 6), weight: 900, fam: F_SANS,
        color: sel ? '#ffffff' : rgba(C.white, 0.75), glow: sel ? accent : null, blur: 8, glowAlpha: 0.5, spacing: 1.2
      });
    }
  }

  function screenGameOver(ctx, st, t) {
    drawZoneBg(ctx, 1, CAM_MID[1] + 40, t, { dim: 0.84, signAlpha: 0.25 });
    drawEmbers(ctx, 1, t);
    ctx.fillStyle = lg(ctx, 0, 0, 0, H, [0, 'rgba(6,1,10,0.82)', 0.45, 'rgba(10,2,14,0.6)', 1, 'rgba(4,1,8,0.94)']);
    ctx.fillRect(0, 0, W, H);
    // тревожные диагонали
    ctx.save();
    ctx.globalAlpha = 0.4;
    for (var i = 0; i < 4; i++) {
      ctx.fillStyle = lg(ctx, 0, 0, W, 0, [0, 'rgba(0,0,0,0)', 0.5, rgba(C.red, 0.08), 1, 'rgba(0,0,0,0)']);
      ctx.beginPath();
      var off = i * 130 - 40;
      ctx.moveTo(off, 0); ctx.lineTo(off + 60, 0); ctx.lineTo(off + 190, H); ctx.lineTo(off + 120, H);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    // призрачный заголовок
    ctx.save();
    ctx.globalAlpha = 0.07;
    drawText(ctx, tt('end.gameoverTitle'), W / 2, 118, {
      size: 64, weight: 900, fam: F_DISPLAY, italic: true, align: 'center', color: C.red, spacing: 2
    });
    ctx.restore();

    drawText(ctx, tt('end.gameoverTitle'), W / 2, 52, {
      size: 32, weight: 900, fam: F_DISPLAY, italic: true, align: 'center',
      color: '#ffffff', grad: ['#ffffff', '#ffc0cd', C.red], glow: C.red, blur: 20, glowAlpha: 0.7,
      stroke: 'rgba(8,1,6,0.7)', strokeW: 3.4, spacing: 1
    });
    drawText(ctx, tt('end.gameoverSub'), W / 2, 76, {
      size: 7, weight: 700, fam: F_SANS, align: 'center', color: rgba(C.white, 0.6), spacing: 0.8
    });
    drawEndStats(ctx, st, 96, 92, 288, t);
    drawEndButtons(ctx, st, t, C.red);
    drawText(ctx, tt('title.hint'), W / 2, 258, {
      size: 5, weight: 700, fam: F_MONO, align: 'center', color: rgba(C.white, 0.32)
    });
    drawWeather(ctx, 1, t, { rainScale: 0.8 });
  }

  function screenVictory(ctx, st, t) {
    drawZoneBg(ctx, 2, CAM_MID[2] - 60, t, { dim: 0.52, signAlpha: 0.5 });
    drawEmbers(ctx, 2, t);
    // праздничный свет
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(ctx, W / 2, 70, 190, C.lime, 0.16, 'lighter');
    drawGlow(ctx, W / 2, 120, 150, C.cyan, 0.12, 'lighter');
    ctx.restore();
    drawShafts(ctx, [{ x: 60, col: C.lime }, { x: 200, col: C.cyan }, { x: 320, col: C.pink }], t, 1);
    ctx.fillStyle = lg(ctx, 0, 0, 0, H, [0, 'rgba(3,6,10,0.66)', 0.5, 'rgba(3,8,14,0.45)', 1, 'rgba(3,4,10,0.86)']);
    ctx.fillRect(0, 0, W, H);

    // герои по краям
    var heroD = {
      id: 811, kind: 'player', char: 'comet', x: 44, y: 250, z: 0, facing: 1,
      anim: 'victory', animT: 0.5, scale: 0.95, alpha: 1, flash: 0, hp: 1, maxHp: 1, state: 'victory', attack: null
    };
    var heroT = {
      id: 812, kind: 'player', char: 'hammer', x: 438, y: 250, z: 0, facing: -1,
      anim: 'victory', animT: 0.5, scale: 0.95, alpha: 1, flash: 0, hp: 1, maxHp: 1, state: 'victory', attack: null
    };
    drawActor(ctx, heroD, t, 0, { noReflect: true });
    drawActor(ctx, heroT, t, 0, { noReflect: true });

    // конфетти
    ctx.save();
    for (var i = 0; i < 30; i++) {
      var ph = (t * 0.35 + hash(i * 3.3)) % 1;
      var x = hash(i * 7.1) * W + Math.sin(t * 2 + i) * 6;
      var y = ph * (H + 20) - 10;
      ctx.globalAlpha = 0.25 + 0.5 * Math.sin(ph * PI);
      ctx.fillStyle = [C.lime, C.cyan, C.pink, C.amber][i % 4];
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(t * 2 + i);
      ctx.fillRect(-1.4, -1.4, 2.8, 2.8);
      ctx.restore();
    }
    ctx.restore();

    drawText(ctx, tt('end.victoryTitle'), W / 2, 48, {
      size: fitSize(ctx, tt('end.victoryTitle'), 400, 34, 900, F_DISPLAY, 18), weight: 900,
      fam: F_DISPLAY, italic: true, align: 'center', color: '#ffffff',
      grad: ['#ffffff', '#f4ffd0', C.lime], glow: C.lime, blur: 20, glowAlpha: 0.8,
      stroke: 'rgba(3,8,4,0.6)', strokeW: 3.4, spacing: 1
    });
    var vs = tt('end.victorySub');
    drawText(ctx, vs, W / 2, 70, {
      size: fitSize(ctx, vs, 380, 6.6, 700, F_SANS, 5), weight: 700, fam: F_SANS,
      align: 'center', color: rgba(C.white, 0.7), spacing: 0.8
    });
    drawEndStats(ctx, st, 96, 82, 288, t);
    drawEndButtons(ctx, st, t, C.lime);
    // «чип возвращён» марка
    drawText(ctx, 'NEON-8 · ONLINE', W / 2, 240, {
      size: 5.6, weight: 700, fam: F_MONO, align: 'center', color: rgba(C.lime, 0.7), spacing: 2
    });
    drawWeather(ctx, 2, t, { rainScale: 0.55 });
  }

  /* ---------- диспетчер ---------- */
  function draw(ctx, view) {
    if (!ctx) return;
    useCtx(ctx);
    var st = DS();
    var t = (view && view.t != null) ? view.t : (st.t || 0);
    var mode = st.mode || 'title';
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    switch (mode) {
      case 'title': screenTitle(ctx, st, t); break;
      case 'select': screenSelect(ctx, st, t); break;
      case 'intro': screenIntro(ctx, st, t); break;
      case 'help': screenHelp(ctx, st, t); break;
      case 'settings': screenSettings(ctx, st, t); break;
      case 'about': screenAbout(ctx, st, t); break;
      case 'play':
        drawPlayWorld(ctx, st, t);
        drawHUD(ctx, st, t);
        drawBanner(ctx, st, t);
        drawBossIntro(ctx, st, t);
        break;
      case 'paused': screenPaused(ctx, st, t); break;
      case 'dead': screenDead(ctx, st, t); break;
      case 'gameover': screenGameOver(ctx, st, t); break;
      case 'victory': screenVictory(ctx, st, t); break;
      default: screenTitle(ctx, st, t); break;
    }
    ctx.restore();
    frameOverlays(ctx, st, t);
  }

  var API = { draw: draw, version: 1 };
  if (typeof window !== 'undefined') window.DD_RENDER_MODERN = API;
  return API;
})();
