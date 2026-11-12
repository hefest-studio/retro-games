/* render.js — СЕВЕРНАЯ САГА 2 · СТУДИЯ ГЕФЕСТ
   Вся графика игры: AURORA («Северное сияние») и RETRO 8-BIT.
   Только canvas 2D, ноль внешних ассетов. Читает game.world (§3), не мутирует его. */
window.SAGA2 = window.SAGA2 || {};
(function () {
  'use strict';

  var TILE = 32, VW = 1024, VH = 576, TAU = Math.PI * 2;

  /* ---------- палитры ---------- */
  var C = {
    night: '#05070f', deep: '#0b1226', deep2: '#111c36', ink: '#03040a',
    ice: '#7cf8ff', aurora: '#45f0b5', violet: '#8b5cf6',
    magenta: '#ff3d8b', gold: '#ffc857', snow: '#eaf6ff',
    stone: '#141d33', stone2: '#1b2740', stone3: '#26385a', stone4: '#3b5a86',
    lava: '#ff6a1a', lavaHot: '#ffd166', lavaDeep: '#8c1d12'
  };
  // 16 цветов ретро-палитры (контракт §8)
  var R8 = ['#0b0f1a', '#1b2a4a', '#3b6ea5', '#6fc3df', '#d9f2ff', '#2d4a22', '#5a8f3d',
    '#b8d96a', '#5a3a1b', '#a56b2b', '#e0b35a', '#3a1a3a', '#7a2a5a', '#d94a6a', '#f2f2f2', '#111111'];

  /* цвета героев: main — цвет-метка героя (маркеры, HUD) — прежний; остальное — облик мастеров кузни */
  var VIK = {
    snorri: { main: '#ff6b8a', dark: '#8a2e46', cloth: '#4c5263', cloth2: '#3f322b', armN: '#5a6274', armF: '#353a47',
      hand: '#5a3a26', skin: '#e8b48c', hair: '#2e2220', hood: '#6e5646', hoodL: '#9a7c64', hoodS: '#45352c',
      apron: '#8c5a34', copper: '#d27c3e', num: 1 },
    gunnar: { main: '#5fd0d2', dark: '#1e6a6c', cloth: '#2f7a78', cloth2: '#4a4036', armN: '#358481', armF: '#1f5452',
      hand: '#eebf95', skin: '#eebf95', hair: '#3a2a20', fur: '#bdb29c', furL: '#ddd4c2', scarf: '#a33c50',
      wood: '#8a5a2e', num: 2 },
    bjorn: { main: '#ffc857', dark: '#9a6a1e', cloth: '#3e5878', cloth2: '#3b3631', armN: '#9aa3ae', armF: '#6c7480',
      hand: '#d9a47c', skin: '#d9a47c', hair: '#4a2e1e', mail: '#aab3be', brass: '#d4a03c', glass: '#8fe4f2', num: 3 }
  };
  var R8VIK = { snorri: 13, gunnar: 3, bjorn: 10 }; // индексы цветов R8

  /* ---------- состояние ---------- */
  var st = {
    canvas: null, ctx: null, ready: false,
    dpr: 1, cssW: 0, cssH: 0,
    dispW: 0, dispH: 0,
    scene: null, sctx: null, sceneW: 0, sceneH: 0, sceneScale: 1,
    mode: 'retro', modeWanted: 'retro',
    fit: { scale: 1, dw: 0, dh: 0, offX: 0, offY: 0 },
    T: 0, frame: 0,
    glitch: 0, glitchDir: 1, flash: 0, flashColor: 'rgba(255,255,255,',
    cam: { x: 0, y: 0, w: VW, h: VH, shake: 0 },
    camQ: { x: 0, y: 0 },
    lvlKey: '', lvlCols: 0, lvlRows: 0,
    tilesA: null, tilesR: null, tilesDirties: 0, tileSnap: null, tileTime: 0,
    bgA: null, bgR: null, bgKey: '',
    vignA: null, grain: null, crtPat: null, scan: null,
    glowCache: {}, spriteCache: {},
    fx: [], snowA: [], snowR: [], rings: [], floats: [],
    portraits: {},
    lastW: 0, lastH: 0,
    debugStats: { calls: 0 }
  };

  /* ---------- мелкие утилиты ---------- */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function hash01(n) { // детерминированный 0..1
    n = n | 0;
    n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
    n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }
  function sgn(v) { return v < 0 ? -1 : 1; }
  function mkCanvas(w, h) {
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    return c;
  }
  function rgb(hex) {
    if (hex.charAt(0) === '#') hex = hex.slice(1);
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    var n = parseInt(hex, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgba(hex, a) {
    var c = rgb(hex);
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  }
  function mix(h1, h2, t) {
    var a = rgb(h1), b = rgb(h2);
    return 'rgb(' + Math.round(lerp(a[0], b[0], t)) + ',' + Math.round(lerp(a[1], b[1], t)) + ',' +
      Math.round(lerp(a[2], b[2], t)) + ')';
  }
  function roundRectPath(g, x, y, w, h, r) {
    r = Math.min(r, w * 0.5, h * 0.5);
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
  function fillRound(g, x, y, w, h, r) { roundRectPath(g, x, y, w, h, r); g.fill(); }
  // снап к мировой сетке для ретро (2 мировых px = 1 пиксель сцены)
  function q(v) { var n = Math.round(v * 0.5); return n * 2; }

  /* мягкое свечение: предзапечённый радиальный спрайт (никакого shadowBlur в цикле) */
  function glowSprite(hex) {
    var s = st.glowCache[hex];
    if (s) return s;
    var c = mkCanvas(128, 128), g = c.getContext('2d');
    var gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    var cc = rgb(hex);
    gr.addColorStop(0, 'rgba(' + cc[0] + ',' + cc[1] + ',' + cc[2] + ',1)');
    gr.addColorStop(0.28, 'rgba(' + cc[0] + ',' + cc[1] + ',' + cc[2] + ',0.52)');
    gr.addColorStop(0.62, 'rgba(' + cc[0] + ',' + cc[1] + ',' + cc[2] + ',0.13)');
    gr.addColorStop(1, 'rgba(' + cc[0] + ',' + cc[1] + ',' + cc[2] + ',0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
    st.glowCache[hex] = c;
    return c;
  }
  function glow(g, x, y, r, hex, a) {
    if (r <= 0.6 || a <= 0.01) return;
    var s = glowSprite(hex);
    var pa = g.globalAlpha;
    g.globalAlpha = pa * a;
    g.drawImage(s, x - r, y - r, r * 2, r * 2);
    g.globalAlpha = pa;
  }
  // аддитивное свечение (для льда/лавы/авроры)
  function glowAdd(g, x, y, r, hex, a) {
    if (r <= 0.6 || a <= 0.01) return;
    var prev = g.globalCompositeOperation;
    g.globalCompositeOperation = 'lighter';
    glow(g, x, y, r, hex, a);
    g.globalCompositeOperation = prev;
  }

  /* ================= init / resize / fit ================= */

  function computeFit() {
    var dpr = st.dpr;
    var scale = Math.min(st.cssW / VW, st.cssH / VH);
    var dw = Math.round(VW * scale * dpr);
    var dh = Math.round(VH * scale * dpr);
    // ограничиваем размер сцены (производительность на retina)
    var maxDim = 2304;
    if (Math.max(dw, dh) > maxDim) {
      var k = maxDim / Math.max(dw, dh);
      dw = Math.round(dw * k); dh = Math.round(dh * k);
    }
    st.fit.scale = scale;
    st.fit.dw = Math.max(2, dw); st.fit.dh = Math.max(2, dh);
    st.fit.offX = Math.round((st.dispW - st.fit.dw) / 2);
    st.fit.offY = Math.round((st.dispH - st.fit.dh) / 2);
  }

  function ensureScenes() {
    if (st.mode === 'retro') {
      if (!st.scene || st.sceneW !== 512 || st.sceneH !== 288) {
        st.scene = mkCanvas(512, 288);
        st.sctx = st.scene.getContext('2d', { alpha: false });
        st.sceneW = 512; st.sceneH = 288;
        st.sceneScale = 0.5;
        st.tilesR = null; // пересоберём под новую сцену
      }
    } else {
      if (!st.scene || st.sceneW !== st.fit.dw || st.sceneH !== st.fit.dh) {
        st.scene = mkCanvas(st.fit.dw, st.fit.dh);
        st.sctx = st.scene.getContext('2d', { alpha: false });
        st.sceneW = st.fit.dw; st.sceneH = st.fit.dh;
        st.sceneScale = st.sceneW / VW;
        st.vignA = null; st.grain = null;
      }
    }
  }

  function init(canvas) {
    try {
      if (!canvas || !canvas.getContext) return false;
      st.canvas = canvas;
      st.ctx = canvas.getContext('2d', { alpha: false });
      if (!st.ctx) return false;
      resize();
      st.ready = true;
      // первый кадр, чтобы не было белого мига
      st.ctx.setTransform(1, 0, 0, 1, 0, 0);
      st.ctx.fillStyle = C.ink;
      st.ctx.fillRect(0, 0, canvas.width, canvas.height);
      return true;
    } catch (e) { return false; }
  }

  function resize() {
    try {
      var cv = st.canvas;
      if (!cv) return;
      var dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
      dpr = clamp(dpr, 1, 2);
      var cssW = cv.clientWidth || 0, cssH = cv.clientHeight || 0;
      if (!cssW || !cssH) {
        var r = cv.getBoundingClientRect ? cv.getBoundingClientRect() : null;
        cssW = r && r.width ? r.width : VW;
        cssH = r && r.height ? r.height : VH;
      }
      st.dpr = dpr;
      st.cssW = cssW; st.cssH = cssH;
      st.dispW = Math.max(2, Math.round(cssW * dpr));
      st.dispH = Math.max(2, Math.round(cssH * dpr));
      cv.width = st.dispW;
      cv.height = st.dispH;
      computeFit();
      st.scene = null; // пересоздать
      st.grain = null;
      st.barGrads = null;
      st.gradeA = null;
      st.vignA = null;
      ensureScenes();
      st.lastW = cssW; st.lastH = cssH;
    } catch (e) { /* no-op */ }
  }

  /* ================= режимы / глитч ================= */

  function setMode(mode) {
    mode = (mode === 'retro') ? 'retro' : 'aurora';
    st.modeWanted = mode;
    if (mode === st.mode) return;
    if (!st.ready) { st.mode = mode; return; }
    st.glitch = 1;
    st.mode = mode;
    st.scene = null;
    st.vignA = null;
    st.tilesR = null;
    st.bgR = null;
    st.frame = st.frame || 0;
    computeFit();
    ensureScenes();
  }
  function getMode() { return st.mode; }

  /* ================= блит сцены на экран ================= */

  function blitFrame() {
    var g = st.ctx, f = st.fit;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    // фон-подложка (письма/бэры)
    g.fillStyle = st.mode === 'retro' ? '#05060b' : '#04060d';
    g.fillRect(0, 0, st.dispW, st.dispH);

    var dw = f.dw, dh = f.dh, ox = f.offX, oy = f.offY;

    // поля кадра: кэшированные градиенты (дёшево, без перерисовки сцены)
    if (st.mode === 'aurora') {
      if (!st.barGrads) {
        var gg = st.ctx;
        var gTop = gg.createLinearGradient(0, oy, 0, Math.max(0, oy - 46));
        gTop.addColorStop(0, 'rgba(22,58,78,0.55)');
        gTop.addColorStop(1, 'rgba(4,6,13,1)');
        var gBot = gg.createLinearGradient(0, oy + dh, 0, oy + dh + 46);
        gBot.addColorStop(0, 'rgba(18,48,64,0.5)');
        gBot.addColorStop(1, 'rgba(4,6,13,1)');
        st.barGrads = { top: gTop, bot: gBot };
      }
      if (oy > 0) { g.fillStyle = st.barGrads.top; g.fillRect(0, 0, st.dispW, oy); }
      if (st.dispH - oy - dh > 0) { g.fillStyle = st.barGrads.bot; g.fillRect(0, oy + dh, st.dispW, st.dispH - oy - dh); }
      if (ox > 0) { g.fillStyle = '#05070f'; g.fillRect(0, 0, ox, st.dispH); }
      if (st.dispW - ox - dw > 0) { g.fillStyle = '#05070f'; g.fillRect(ox + dw, 0, st.dispW - ox - dw, st.dispH); }
    }

    g.imageSmoothingEnabled = st.mode === 'aurora';
    if (g.imageSmoothingQuality) g.imageSmoothingQuality = 'high';

    if (st.glitch > 0) {
      // «глитч»-переход: полосы, смещения, RGB-раскол
      var p = 1 - st.glitch; // 0 → 1
      var amp = 34 * st.glitch;
      var slices = 9;
      for (var i = 0; i < slices; i++) {
        var sy = Math.floor(hash01(i * 977 + Math.floor(st.T * 30) * 13) * st.sceneH);
        var sh = Math.max(3, Math.floor(st.sceneH / slices * (0.4 + hash01(i * 31 + 7) * 1.2)));
        var dx = (hash01(i * 613 + Math.floor(st.T * 40) * 7) - 0.5) * 2 * amp;
        dx = Math.round(dx);
        g.drawImage(st.scene, 0, sy, st.sceneW, sh, ox + dx, oy + Math.round(sy * dh / st.sceneH),
          dw, Math.max(1, Math.round(sh * dh / st.sceneH)));
      }
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.22 * st.glitch;
      g.drawImage(st.scene, 0, 0, st.sceneW, st.sceneH, ox - 5 * st.glitch, oy, dw, dh);
      g.drawImage(st.scene, 0, 0, st.sceneW, st.sceneH, ox + 5 * st.glitch, oy, dw, dh);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      if (st.glitch > 0.55) {
        g.fillStyle = 'rgba(220,245,255,' + (0.28 * (st.glitch - 0.55) / 0.45) + ')';
        g.fillRect(0, 0, st.dispW, st.dispH);
      }
      // полосы помех
      g.globalCompositeOperation = 'lighter';
      for (var k = 0; k < 7; k++) {
        var yy = Math.floor(hash01(k * 331 + Math.floor(st.T * 25) * 17) * st.dispH);
        g.fillStyle = 'rgba(124,248,255,' + (0.05 + 0.12 * st.glitch * hash01(k * 71)) + ')';
        g.fillRect(0, yy, st.dispW, 1 + Math.floor(hash01(k * 13) * 3));
      }
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
    } else {
      g.drawImage(st.scene, 0, 0, st.sceneW, st.sceneH, ox, oy, dw, dh);
    }

    if (st.mode === 'retro') drawCrt(g);
    drawFrameBars(g);

    if (st.flash > 0.002) {
      g.fillStyle = st.flashColor + (st.flash * 0.5) + ')';
      g.fillRect(0, 0, st.dispW, st.dispH);
    }
  }

  /* ретро-оверлей: скан-линии, маска, виньетка, лёгкое мерцание */
  function drawCrt(g) {
    var f = st.fit, ox = f.offX, oy = f.offY, dw = f.dw, dh = f.dh;
    if (!st.crtPat) {
      var pc = mkCanvas(4, 3), pg = pc.getContext('2d');
      pg.fillStyle = 'rgba(0,0,0,0)'; pg.fillRect(0, 0, 4, 3);
      pg.fillStyle = 'rgba(0,0,0,0.42)'; pg.fillRect(0, 0, 4, 1);
      pg.fillStyle = 'rgba(9,14,26,0.16)'; pg.fillRect(0, 2, 4, 1);
      st.crtPat = g.createPattern(pc, 'repeat');
      var pc2 = mkCanvas(4, 3), pg2 = pc2.getContext('2d');
      pg2.fillStyle = 'rgba(255,60,120,0.05)'; pg2.fillRect(0, 0, 2, 3);
      pg2.fillStyle = 'rgba(60,255,220,0.05)'; pg2.fillRect(2, 0, 2, 3);
      st.scan = g.createPattern(pc2, 'repeat');
    }
    g.save();
    g.beginPath();
    g.rect(ox, oy, dw, dh);
    g.clip();
    g.globalAlpha = 0.62;
    g.fillStyle = st.crtPat;
    g.fillRect(ox, oy, dw, dh);
    g.globalAlpha = 0.4;
    g.fillStyle = st.scan;
    g.fillRect(ox, oy, dw, dh);
    g.globalAlpha = 1;
    // виньетка внутри кадра
    if (!st.vignA) st.vignA = buildVignette(st.fit.dw, st.fit.dh, true);
    if (st.vignA) g.drawImage(st.vignA, ox, oy, dw, dh);
    // лёгкое мерцание
    var fl = 0.035 + 0.028 * Math.sin(st.T * 31.7) * Math.sin(st.T * 11.3);
    if (fl > 0.01) { g.fillStyle = 'rgba(190,235,255,' + fl + ')'; g.fillRect(ox, oy, dw, dh); }
    g.restore();
  }

  function drawFrameBars(g) {
    var f = st.fit, ox = f.offX, oy = f.offY, dw = f.dw, dh = f.dh;
    g.save();
    // тонкая рамка «стеклянного» экрана
    g.strokeStyle = st.mode === 'retro' ? 'rgba(111,195,223,0.28)' : 'rgba(124,248,255,0.16)';
    g.lineWidth = 1;
    g.strokeRect(ox + 0.5, oy + 0.5, dw - 1, dh - 1);
    if (st.mode === 'aurora') {
      g.strokeStyle = 'rgba(255,255,255,0.05)';
      g.strokeRect(ox + 2.5, oy + 2.5, dw - 5, dh - 5);
    }
    g.restore();
  }

  /* ================= главный цикл ================= */

  function draw(game, dt) {
    if (!st.ready) return;
    dt = (typeof dt === 'number' && dt > 0) ? Math.min(dt, 0.1) : 0.016;
    st.T += dt; st.frame++;
    if (st.glitch > 0) st.glitch = Math.max(0, st.glitch - dt / 0.25);
    if (st.flash > 0) st.flash = Math.max(0, st.flash - dt * 3.6);

    // ресайз на случай, если CSS поменял размер без события
    var cv = st.canvas;
    if (cv && cv.clientWidth && (cv.clientWidth !== st.lastW || cv.clientHeight !== st.lastH)) {
      st.cssW = cv.clientWidth; st.cssH = cv.clientHeight; resize();
    }
    ensureScenes();
    if (!st.scene) return;

    var world = (game && game.world) || st.world || null;
    st.game = game;
    st.world = world;

    if (!world) { drawNoWorld(); blitFrame(); return; }

    // камера
    var cam = world.camera || st.cam;
    st.cam.w = cam.w || VW; st.cam.h = cam.h || VH;
    var maxX = Math.max(0, (world.width || (world.cols * TILE)) - st.cam.w);
    var maxY = Math.max(0, (world.height || (world.rows * TILE)) - st.cam.h);
    st.cam.x = clamp(cam.x || 0, 0, maxX);
    st.cam.y = clamp(cam.y || 0, 0, maxY);
    st.cam.shake = cam.shake || 0;
    var shk = st.cam.shake;
    st.camQ.x = Math.round(st.cam.x * 0.5) * 2;
    st.camQ.y = Math.round(st.cam.y * 0.5) * 2;

    // тряска камеры (детерминированный шум)
    var amp = shk * shk * 12;
    st.shakeX = (Math.sin(st.T * 63.1) * 0.6 + Math.sin(st.T * 41.7 + 1.7) * 0.4) * amp;
    st.shakeY = (Math.sin(st.T * 57.3 + 2.1) * 0.6 + Math.sin(st.T * 37.9) * 0.4) * amp;

    prepareLevel(world, game);

    if (st.mode === 'retro') renderRetro(world, game, dt);
    else renderAurora(world, game, dt);

    blitFrame();
    if (st.flash > 0) { /* вспышка уже в блите */ }
  }

  function drawNoWorld() {
    var g = st.sctx;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = C.night;
    g.fillRect(0, 0, st.sceneW, st.sceneH);
    glowAdd(g, st.sceneW * 0.5, st.sceneH * 0.55, st.sceneH * 0.7, C.violet, 0.12);
    glowAdd(g, st.sceneW * 0.5, st.sceneH * 0.55, st.sceneH * 0.4, C.aurora, 0.1);
  }

  /* подготовка статики уровня */
  function prepareLevel(world, game) {
    var key = (world.levelIndex || 0) + ':' + world.cols + 'x' + world.rows + ':' + world.width + 'x' + world.height;
    if (key !== st.lvlKey) {
      st.lvlKey = key;
      st.tilesA = null; st.tilesR = null; st.tileSnap = null; st.bgA = null; st.bgR = null;
      st.fx.length = 0; st.rings.length = 0; st.floats.length = 0;
      st.hasExitProp = false;
      var pp = world.props || [];
      for (var pi = 0; pi < pp.length; pi++) if (pp[pi] && pp[pi].type === 'exit') { st.hasExitProp = true; break; }
      seedSnow();
    }
    st.bgA = st.bgA || buildBgAurora();
    st.bgR = st.bgR || buildBgRetro();
    ensureTileSprites();
    prepareTiles(world, game);
  }

  /* ================= FX ================= */

  function addFx(ev) {
    try {
      if (!ev || !ev.type) return;
      var t = ev.type;
      var x = (typeof ev.x === 'number') ? ev.x : 0;
      var y = (typeof ev.y === 'number') ? ev.y : 0;
      var w = st.world;
      if (!w) return;
      if (t === 'break') { st.tilesA = null; st.tilesR = null; st.tileSnap = null; }
      if (t === 'jump') { burst(x, y, 10, C.snow, 0.75, 90); ring(x, y, 16, C.ice, 0.5); }
      else if (t === 'land') { burst(x, y, 14, C.snow, 0.9, 130); ring(x, y, 12, C.snow, 0.55); }
      else if (t === 'step') { burst(x, y, 3, C.snow, 0.35, 40); }
      else if (t === 'headbutt') { burst(x + (ev.dir || 1) * 12, y - 22, 10, C.ice, 0.8, 160); ring(x + (ev.dir || 1) * 14, y - 22, 14, C.ice, 0.6); }
      else if (t === 'break') { burst(x, y, 26, C.ice, 1.0, 240); ring(x, y, 22, C.ice, 0.8); shards(x, y, 14); }
      else if (t === 'sword') { burst(x + (ev.dir || 1) * 20, y - 20, 12, C.magenta, 0.85, 180); ring(x + (ev.dir || 1) * 22, y - 20, 16, C.magenta, 0.7); }
      else if (t === 'bow') { burst(x + (ev.dir || 1) * 16, y - 24, 7, C.gold, 0.8, 120); }
      else if (t === 'arrowHit') { burst(x, y, 12, C.gold, 0.8, 170); ring(x, y, 10, C.gold, 0.55); }
      else if (t === 'hookShoot') { burst(x, y, 6, C.magenta, 0.7, 90); }
      else if (t === 'hookHit') { ring(x, y, 16, C.magenta, 0.8); burst(x, y, 10, C.magenta, 0.9, 140); }
      else if (t === 'hookDetach') { burst(x, y, 5, C.magenta, 0.5, 70); }
      else if (t === 'lever') { burst(x, y - 16, 9, C.gold, 0.8, 130); ring(x, y - 16, 14, C.gold, 0.6); }
      else if (t === 'plateOn') { ring(x, y, 20, C.aurora, 0.7); burst(x, y, 8, C.aurora, 0.6, 100); }
      else if (t === 'plateOff') { ring(x, y, 14, C.ice, 0.35); }
      else if (t === 'doorOpen') { burst(x, y, 18, C.violet, 0.8, 150); ring(x, y, 26, C.violet, 0.7); }
      else if (t === 'doorClose') { burst(x, y, 10, C.violet, 0.5, 90); ring(x, y, 20, C.violet, 0.45); }
      else if (t === 'rune') { burst(x, y, 30, C.ice, 1.1, 210); ring(x, y, 30, C.gold, 0.9); floatText(x, y - 20, '+150', C.gold); st.flash = 0.28; st.flashColor = 'rgba(255,200,87,'; }
      else if (t === 'checkpoint') { burst(x, y - 20, 22, C.aurora, 0.9, 160); ring(x, y, 26, C.aurora, 0.8); st.flash = 0.15; st.flashColor = 'rgba(69,240,181,'; }
      else if (t === 'hurt') { burst(x, y - 24, 18, C.magenta, 1.0, 220); st.flash = 0.32; st.flashColor = 'rgba(255,61,139,'; }
      else if (t === 'death') { burst(x, y - 22, 44, C.magenta, 1.2, 300); burst(x, y - 22, 20, C.snow, 1.0, 200); ring(x, y - 22, 40, C.magenta, 1.0); st.flash = 0.5; st.flashColor = 'rgba(255,61,139,'; }
      else if (t === 'respawn') { ring(x, y - 20, 30, C.aurora, 0.9); burst(x, y, 16, C.aurora, 0.8, 120); }
      else if (t === 'block') { ring(x, y - 24, 22, C.gold, 0.9); burst(x, y - 24, 8, C.gold, 0.7, 140); }
      else if (t === 'enemyHit') { burst(x, y - 16, 12, C.magenta, 0.8, 170); }
      else if (t === 'enemyDie') { burst(x, y - 16, 26, C.magenta, 1.0, 230); ring(x, y - 16, 22, C.violet, 0.8); floatText(x, y - 30, '+50', C.gold); }
      else if (t === 'exit') { burst(x, y, 26, C.ice, 1.0, 180); ring(x, y, 34, C.aurora, 0.9); st.flash = 0.2; st.flashColor = 'rgba(124,248,255,'; }
      else if (t === 'lava') { burst(x, y, 16, C.lava, 0.9, 200); }
      else if (t === 'win') { st.flash = 0.55; st.flashColor = 'rgba(69,240,181,'; ring(x, y - 30, 60, C.aurora, 1); burst(x, y - 30, 40, C.ice, 1.1, 260); }
      else if (t === 'lose') { st.flash = 0.45; st.flashColor = 'rgba(255,61,139,'; }
      else if (t === 'switch') { ring(x, y - 20, 16, C.ice, 0.45); glowAdd(st.sctx, 0, 0, 0, C.ice, 0); }
    } catch (e) { /* no-op */ }
  }

  function makeFx(x, y, vx, vy, life, size, color, grav, drag, kind) {
    var f = null;
    for (var i = 0; i < st.fx.length; i++) if (st.fx[i].life <= 0) { f = st.fx[i]; break; }
    if (!f) {
      if (st.fx.length >= 460) return null;
      f = { x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 2, color: '#fff', grav: 0, drag: 0, kind: 0, rot: 0, vr: 0 };
      st.fx.push(f);
    }
    f.x = x; f.y = y; f.vx = vx; f.vy = vy; f.life = life; f.max = life;
    f.size = size; f.color = color; f.grav = grav; f.drag = drag; f.kind = kind || 0;
    f.rot = Math.random() * TAU; f.vr = (Math.random() - 0.5) * 8;
    return f;
  }
  function burst(x, y, n, color, power, speed) {
    var i, a, s;
    for (i = 0; i < n; i++) {
      a = Math.random() * TAU;
      s = speed * (0.25 + Math.random() * 0.9);
      makeFx(x, y, Math.cos(a) * s, Math.sin(a) * s - speed * 0.25,
        0.3 + Math.random() * 0.5, 1.3 + Math.random() * (power > 0.8 ? 3.2 : 2), color, 620, 2.4, 0);
    }
  }
  function shards(x, y, n) {
    for (var i = 0; i < n; i++) {
      makeFx(x + (Math.random() - 0.5) * 20, y - Math.random() * 20,
        (Math.random() - 0.5) * 260, -Math.random() * 240 - 40,
        0.45 + Math.random() * 0.5, 2 + Math.random() * 3, C.ice, 900, 0.4, 1);
    }
  }
  function ring(x, y, r, color, power) {
    var o = null;
    for (var i = 0; i < st.rings.length; i++) if (st.rings[i].life <= 0) { o = st.rings[i]; break; }
    if (!o) {
      if (st.rings.length > 26) return;
      o = { x: 0, y: 0, r: 0, life: 0, max: 1, color: '#fff', power: 0 };
      st.rings.push(o);
    }
    o.x = x; o.y = y; o.r = r; o.life = 0.42; o.max = 0.42; o.color = color; o.power = power;
  }
  function floatText(x, y, text, color) {
    var o = null;
    for (var i = 0; i < st.floats.length; i++) if (st.floats[i].life <= 0) { o = st.floats[i]; break; }
    if (!o) {
      if (st.floats.length > 10) return;
      o = { x: 0, y: 0, life: 0, max: 1, text: '', color: '#fff' };
      st.floats.push(o);
    }
    o.x = x; o.y = y; o.text = text; o.color = color; o.life = 0.9; o.max = 0.9;
  }

  /* ---------- внешний API ---------- */
  SAGA2.render = {
    init: init,
    setMode: setMode,
    getMode: getMode,
    draw: draw,
    addFx: addFx,
    drawPortrait: drawPortrait,
    resize: resize
  };

  /* ================= вода/снег ================= */

  function seedSnow() {
    st.snowA.length = 0;
    st.snowR.length = 0;
    var i, n = 170;
    for (i = 0; i < n; i++) {
      st.snowA.push({
        x: Math.random() * VW, y: Math.random() * VH,
        z: 0.22 + Math.random() * 0.78,
        vx: (Math.random() - 0.5) * 14, vy: 10 + Math.random() * 30,
        ph: Math.random() * TAU
      });
    }
    for (i = 0; i < 64; i++) {
      st.snowR.push({
        x: Math.random() * 512, y: Math.random() * 288,
        z: 0.3 + Math.random() * 0.7, vx: (Math.random() - 0.5) * 8,
        vy: 8 + Math.random() * 18, ph: 0
      });
    }
    st.prevCamX = st.cam.x; st.prevCamY = st.cam.y;
  }

  function updateSnowA(dt) {
    var dx = st.cam.x - (st.prevCamX || 0);
    var wind = Math.sin(st.T * 0.23) * 16 + 10;
    var arr = st.snowA, i, p;
    for (i = 0; i < arr.length; i++) {
      p = arr[i];
      p.x += (p.vx + wind) * dt * (0.4 + p.z * 0.9) - dx * p.z * 0.35;
      p.y += p.vy * dt * (0.35 + p.z * 0.85);
      if (p.y > VH + 4) { p.y = -4; p.x = Math.random() * VW; }
      if (p.x < -6) p.x += VW + 12; else if (p.x > VW + 6) p.x -= VW + 12;
    }
    st.prevCamX = st.cam.x; st.prevCamY = st.cam.y;
  }

  function drawSnowA(g) {
    var arr = st.snowA, i, p, b, sz;
    // три слоя глубины — три вызова fill
    for (b = 0; b < 3; b++) {
      g.beginPath();
      for (i = 0; i < arr.length; i++) {
        p = arr[i];
        if ((p.z < 0.45 ? 0 : p.z < 0.75 ? 1 : 2) !== b) continue;
        sz = 0.7 + p.z * 2.4;
        var xx = p.x + Math.sin(st.T * 0.7 + p.ph) * (2 + p.z * 5);
        g.moveTo(xx + sz, p.y);
        g.arc(xx, p.y, sz, 0, TAU);
      }
      g.fillStyle = b === 0 ? 'rgba(234,246,255,0.22)' : b === 1 ? 'rgba(234,246,255,0.42)' : 'rgba(234,246,255,0.62)';
      g.fill();
    }
  }

  function updateSnowR(dt) {
    var arr = st.snowR, i, p;
    for (i = 0; i < arr.length; i++) {
      p = arr[i];
      p.x += Math.sin(st.T * 0.5 + p.ph) * 4 * dt - (st.cam.x - (st.prevCamX || 0)) * p.z * 0.15;
      p.y += p.vy * dt;
      if (p.y > 288) { p.y = 0; p.x = Math.random() * 512; }
      if (p.x < 0) p.x += 512; else if (p.x > 512) p.x -= 512;
    }
  }
  function drawSnowR(g) {
    var arr = st.snowR, i, p;
    g.fillStyle = R8[4];
    for (i = 0; i < arr.length; i++) {
      p = arr[i];
      if (p.z < 0.6) continue;
      g.globalAlpha = 0.55 + p.z * 0.4;
      g.fillRect((p.x | 0), (p.y | 0), p.z > 0.8 ? 2 : 1, p.z > 0.8 ? 2 : 1);
    }
    g.globalAlpha = 1;
  }

  /* ================= виньетка ================= */

  function buildVignette(w, h, strong) {
    var c = mkCanvas(w, h), g = c.getContext('2d');
    var gr = g.createRadialGradient(w * 0.5, h * 0.46, Math.min(w, h) * 0.2, w * 0.5, h * 0.52, Math.max(w, h) * 0.78);
    gr.addColorStop(0, 'rgba(0,0,0,0)');
    gr.addColorStop(0.45, 'rgba(4,6,14,' + (strong ? 0.16 : 0.1) + ')');
    gr.addColorStop(1, 'rgba(2,3,8,' + (strong ? 0.82 : 0.68) + ')');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    var lg = g.createLinearGradient(0, 0, 0, h);
    lg.addColorStop(0, 'rgba(2,3,8,0.42)');
    lg.addColorStop(0.22, 'rgba(2,3,8,0)');
    lg.addColorStop(0.8, 'rgba(2,3,8,0)');
    lg.addColorStop(1, 'rgba(2,3,8,0.42)');
    g.fillStyle = lg;
    g.fillRect(0, 0, w, h);
    return c;
  }
  function ensureVignette() {
    if (!st.vignA) st.vignA = buildVignette(st.sceneW || st.fit.dw, st.sceneH || st.fit.dh, false);
  }

  /* ================= ГРЕЙД КАДРА ================= */

  function buildGrade(w, h) {
    var c = mkCanvas(w, h), g = c.getContext('2d');
    // цветовая градация: холод сверху, глубина снизу
    var lg = g.createLinearGradient(0, 0, 0, h);
    lg.addColorStop(0, 'rgba(38,68,138,0.17)');
    lg.addColorStop(0.45, 'rgba(0,0,0,0.02)');
    lg.addColorStop(1, 'rgba(8,50,58,0.16)');
    g.fillStyle = lg;
    g.fillRect(0, 0, w, h);
    // виньетка
    var gr = g.createRadialGradient(w * 0.5, h * 0.46, Math.min(w, h) * 0.2, w * 0.5, h * 0.52, Math.max(w, h) * 0.78);
    gr.addColorStop(0, 'rgba(0,0,0,0)');
    gr.addColorStop(0.45, 'rgba(4,6,14,0.12)');
    gr.addColorStop(1, 'rgba(2,3,8,0.72)');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    var lg2 = g.createLinearGradient(0, 0, 0, h);
    lg2.addColorStop(0, 'rgba(2,3,8,0.34)');
    lg2.addColorStop(0.22, 'rgba(2,3,8,0)');
    lg2.addColorStop(0.8, 'rgba(2,3,8,0)');
    lg2.addColorStop(1, 'rgba(2,3,8,0.36)');
    g.fillStyle = lg2;
    g.fillRect(0, 0, w, h);
    // запечённое зерно
    var n = Math.min(9000, Math.round(w * h / 190));
    for (var i = 0; i < n; i++) {
      var x = (hash01(i * 37 + 11) * w) | 0;
      var y = (hash01(i * 91 + 7) * h) | 0;
      g.fillStyle = (i & 1) ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.05)';
      g.fillRect(x, y, (i % 5 === 0) ? 2 : 1, 1);
    }
    return c;
  }

  function ensureGrade() {
    if (!st.gradeA || st.gradeW !== st.sceneW || st.gradeH !== st.sceneH) {
      st.gradeA = buildGrade(st.sceneW, st.sceneH);
      st.gradeW = st.sceneW; st.gradeH = st.sceneH;
    }
  }

  /* ================= AURORA: фон ================= */

  function tri(t) { t = t - Math.floor(t); return 1 - Math.abs(2 * t - 1); }

  function ridgeY(x, w, base, amp, seed) {
    var u = x / w;
    var n = 0.52 * tri(u * 6 + seed * 0.13) +
      0.27 * tri(u * 15 + seed * 0.31) +
      0.14 * tri(u * 33 + seed * 0.57) +
      0.07 * tri(u * 71 + seed * 0.91);
    n += 0.03 * Math.sin(u * TAU * 2 + seed * 1.3);
    return base - amp * clamp(n, 0, 1.04);
  }

  function buildRidge(w, h, base, amp, seed, topHex, botHex, rimHex, rimA) {
    var c = mkCanvas(w, h), g = c.getContext('2d');
    var pts = [], x, i;
    for (x = 0; x <= w; x += 4) pts.push([x, ridgeY(x, w, base, amp, seed)]);
    function pathIt() {
      g.beginPath();
      g.moveTo(0, h);
      for (i = 0; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
      g.lineTo(w, h);
      g.closePath();
    }
    pathIt();
    var gr = g.createLinearGradient(0, base - amp, 0, h);
    gr.addColorStop(0, topHex);
    gr.addColorStop(0.35, botHex);
    gr.addColorStop(1, '#03050b');
    g.fillStyle = gr;
    g.fill();
    // грани/расщелины скал
    g.save();
    pathIt();
    g.clip();
    for (i = 0; i < 110; i++) {
      var px = hash01(i * 71 + seed * 31) * w;
      var py = ridgeY(px, w, base, amp, seed) + 2;
      var hh = 26 + hash01(i * 13 + seed) * (amp * 0.9);
      var wd = 16 + hash01(i * 37 + seed * 2) * 54;
      g.fillStyle = i % 2 ? 'rgba(3,6,14,0.45)' : 'rgba(96,138,190,0.045)';
      g.beginPath();
      g.moveTo(px, py);
      g.lineTo(px + wd, py + hh * 0.42);
      g.lineTo(px + wd * 0.42, py + hh);
      g.closePath();
      g.fill();
    }
    g.restore();
    // rim-light по гребню (объём)
    if (rimHex) {
      g.beginPath();
      g.moveTo(pts[0][0], pts[0][1]);
      for (i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
      g.strokeStyle = rgba(rimHex, rimA || 0.4);
      g.lineWidth = 1.7;
      g.stroke();
    }
    // снежные шапки на пиках
    for (i = 2; i < pts.length - 2; i++) {
      var a1 = pts[i - 1], b1 = pts[i], c1 = pts[i + 1];
      if (b1[1] < a1[1] && b1[1] < c1[1] && b1[1] < base - amp * 0.4) {
        g.globalAlpha = 0.42 + hash01(i * 7) * 0.42;
        g.fillStyle = '#cfe4f5';
        g.beginPath();
        g.moveTo(b1[0], b1[1] - 1);
        g.lineTo(b1[0] + 5, b1[1] + 4.5);
        g.lineTo(b1[0] + 1, b1[1] + 3);
        g.lineTo(b1[0] - 5, b1[1] + 5);
        g.closePath(); g.fill();
      }
    }
    g.globalAlpha = 1;
    return c;
  }

  function buildRibbon(cTop, cBot, seed) {
    var w = 220, h = 100;
    var lo = mkCanvas(w, h), g = lo.getContext('2d');
    for (var x = 0; x < w; x++) {
      var cx = h * 0.6 + Math.sin(x * 0.041 + seed) * h * 0.16 + Math.sin(x * 0.1 + seed * 2.3) * h * 0.06;
      var hh = h * 0.5 + Math.sin(x * 0.031 + seed * 3.1) * h * 0.13;
      var top = cx - hh, bot = cx + hh;
      var grd = g.createLinearGradient(0, top, 0, bot);
      grd.addColorStop(0, rgba(cTop, 0));
      grd.addColorStop(0.22, rgba(cTop, 0.1));
      grd.addColorStop(0.5, rgba(cTop, 0.27));
      grd.addColorStop(0.76, rgba(cBot, 0.29));
      grd.addColorStop(1, rgba(cBot, 0));
      g.fillStyle = grd;
      g.fillRect(x, 0, 1, h);
    }
    // редкие «струи»-лучи
    for (var i = 0; i < 22; i++) {
      var rx = hash01(i * 71 + seed * 13) * w;
      var ry = h * 0.28 + hash01(i * 131) * h * 0.36;
      var gr2 = g.createLinearGradient(0, ry - 24, 0, ry + 28);
      gr2.addColorStop(0, rgba(cBot, 0));
      gr2.addColorStop(0.5, rgba(cBot, 0.1));
      gr2.addColorStop(1, rgba(cBot, 0));
      g.fillStyle = gr2;
      g.fillRect(rx, ry - 24, 1.3, 52);
    }
    // мягкий апскейл вместо blur
    var out = mkCanvas(w * 3, h * 3), og = out.getContext('2d');
    og.imageSmoothingEnabled = true;
    og.drawImage(lo, 0, 0, w, h, 0, 0, w * 3, h * 3);
    return out;
  }

  function buildBgAurora() {
    var bg = {}, W = VW, H = VH;
    // небо
    var sky = mkCanvas(W, H), g = sky.getContext('2d');
    var gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#03040b');
    gr.addColorStop(0.28, '#050810');
    gr.addColorStop(0.5, '#081123');
    gr.addColorStop(0.68, '#0d1a30');
    gr.addColorStop(0.82, '#112039');
    gr.addColorStop(1, '#070d18');
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
    // полярное свечение у горизонта
    var rg = g.createRadialGradient(W * 0.5, H * 0.62, 20, W * 0.5, H * 0.62, W * 0.7);
    rg.addColorStop(0, 'rgba(69,240,181,0.10)');
    rg.addColorStop(0.5, 'rgba(69,240,181,0.04)');
    rg.addColorStop(1, 'rgba(69,240,181,0)');
    g.fillStyle = rg; g.fillRect(0, 0, W, H);
    var rg2 = g.createRadialGradient(W * 0.16, H * 0.42, 10, W * 0.16, H * 0.42, W * 0.5);
    rg2.addColorStop(0, 'rgba(139,92,246,0.09)');
    rg2.addColorStop(1, 'rgba(139,92,246,0)');
    g.fillStyle = rg2; g.fillRect(0, 0, W, H);
    bg.sky = sky;

    // звёзды
    var stars = mkCanvas(W, H), sg = stars.getContext('2d');
    for (var i = 0; i < 320; i++) {
      var sx = hash01(i * 17 + 3) * W, sy = hash01(i * 91 + 11) * H * 0.7;
      var sz = 0.5 + hash01(i * 53) * 1.7;
      var al = 0.16 + hash01(i * 29) * 0.72;
      sg.fillStyle = i % 11 === 0 ? 'rgba(124,248,255,' + al + ')' :
        i % 7 === 0 ? 'rgba(255,200,87,' + al + ')' : 'rgba(234,246,255,' + al + ')';
      sg.fillRect(sx, sy, sz, sz);
      if (i % 26 === 0) {
        sg.globalAlpha = 0.3;
        sg.fillRect(sx - 4, sy + sz * 0.4, 9, 0.6);
        sg.fillRect(sx + sz * 0.4, sy - 4, 0.6, 9);
        sg.globalAlpha = 1;
      }
    }
    bg.stars = stars;

    bg.ribbons = [
      buildRibbon('#45f0b5', '#38cfe0', 1.2),
      buildRibbon('#2f7cf0', '#45f0b5', 4.7),
      buildRibbon('#ff3d8b', '#8b5cf6', 8.3)
    ];

    // слои гор (параллакс) — дальше светлее и ниже контраст
    bg.far = buildRidge(2048, H, H * 0.70, H * 0.30, 1.7, '#16263f', '#0a1224', '#4a7fa8', 0.3);
    bg.mid = buildRidge(2048, H, H * 0.85, H * 0.25, 4.3, '#0e1a2e', '#070d1a', '#6fc3df', 0.42);
    bg.near = buildRidge(2048, H, H * 1.03, H * 0.19, 9.1, '#080e1a', '#04060d', '#7cf8ff', 0.22);

    // туман у горизонта
    var fog = mkCanvas(W, H * 0.55), fg = fog.getContext('2d');
    var fgr = fg.createLinearGradient(0, 0, 0, H * 0.55);
    fgr.addColorStop(0, 'rgba(19,42,64,0)');
    fgr.addColorStop(0.5, 'rgba(30,68,94,0.14)');
    fgr.addColorStop(1, 'rgba(10,20,36,0.03)');
    fg.fillStyle = fgr; fg.fillRect(0, 0, W, H * 0.55);
    bg.fog = fog;
    bg.fog2 = fog;

    return bg;
  }

  // рисуем бесшовный слой только видимой частью (экономия заливки)
  function drawTiledLayer(g, img, off, y) {
    var lw = img.width;
    var start = off % lw;
    if (start > 0) start -= lw;
    var x = start, remaining = VW + 2;
    while (remaining > 0) {
      var srcX = Math.max(0, -x);
      var w = Math.min(lw - srcX, remaining);
      if (w <= 0) break;
      g.drawImage(img, srcX, 0, w, img.height, Math.max(0, x), y, w, img.height);
      x += w;
      remaining -= w;
    }
  }

  function drawRibbon(g, tex, x, y, w, h, alpha, rot) {
    g.save();
    g.translate(x, y);
    if (rot) g.rotate(rot);
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = alpha;
    g.drawImage(tex, -w * 0.5, -h * 0.5, w, h);
    g.restore();
  }

  function drawBgAurora(g, camX, camY, t) {
    var bg = st.bgA;
    if (!bg) return;
    var W = VW, H = VH;
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    g.drawImage(bg.sky, 0, 0);
    // звёзды с мерцанием
    g.globalAlpha = 0.8 + 0.08 * Math.sin(t * 0.9);
    g.drawImage(bg.stars, 0, 0);
    g.globalAlpha = 1;
    // яркие пульсирующие звёзды
    for (var i = 0; i < 7; i++) {
      var bx = (hash01(i * 313 + 7) * W);
      var by = (hash01(i * 197 + 3) * H * 0.6);
      var pl = 0.5 + 0.5 * Math.sin(t * (0.8 + i * 0.23) + i * 2.1);
      glowAdd(g, bx, by, 4 + pl * 6, i % 3 === 0 ? C.ice : C.snow, 0.08 + pl * 0.16);
    }
    // луна
    var mx = W * 0.79, my = H * 0.14;
    glowAdd(g, mx, my, 110, C.ice, 0.07);
    glowAdd(g, mx, my, 52, C.snow, 0.1);
    g.fillStyle = 'rgba(234,246,255,0.9)';
    g.beginPath(); g.arc(mx, my, 18, 0, TAU); g.fill();
    g.fillStyle = 'rgba(120,150,190,0.3)';
    g.beginPath(); g.arc(mx - 5, my - 4, 3, 0, TAU); g.fill();
    g.beginPath(); g.arc(mx + 5, my + 3, 2, 0, TAU); g.fill();
    g.beginPath(); g.arc(mx + 1, my - 8, 1.5, 0, TAU); g.fill();

    // аврора — живые ленты
    var r0 = bg.ribbons[0], r1 = bg.ribbons[1], r2 = bg.ribbons[2];
    var wob = Math.sin(t * 0.21) * 14;
    drawRibbon(g, r0, W * 0.5 + Math.sin(t * 0.11) * 120, H * 0.27 + wob, W * 1.45, H * 0.52, 0.3, -0.035 + Math.sin(t * 0.09) * 0.02);
    drawRibbon(g, r1, W * 0.35 + Math.sin(t * 0.07 + 2) * 140, H * 0.21 - wob * 0.6, W * 1.2, H * 0.44, 0.2, 0.05 + Math.sin(t * 0.13 + 1) * 0.03);
    drawRibbon(g, r2, W * 0.72 + Math.sin(t * 0.05 + 4) * 100, H * 0.17 + wob * 0.4, W * 0.9, H * 0.32, 0.11, -0.06);

    // параллакс-горы
    var vy1 = -(camY * 0.04), vy2 = -(camY * 0.09), vy3 = -(camY * 0.15);
    drawTiledLayer(g, bg.far, -(camX * 0.05), vy1);
    g.globalAlpha = 0.8;
    g.drawImage(bg.fog, 0, H * 0.52, W, H * 0.55);
    g.globalAlpha = 1;
    drawTiledLayer(g, bg.mid, -(camX * 0.11), vy2);
    drawTiledLayer(g, bg.near, -(camX * 0.2), vy3);

    // глубина к низу
    var vg = g.createLinearGradient(0, H * 0.55, 0, H);
    vg.addColorStop(0, 'rgba(4,6,13,0)');
    vg.addColorStop(1, 'rgba(3,4,10,0.5)');
    g.fillStyle = vg;
    g.fillRect(0, H * 0.55, W, H * 0.45);
  }

  /* ================= RETRO: фон ================= */

  var BAYER4 = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];

  function buildBgRetro() {
    var bg = {}, W = 512, H = 288;
    var sky = mkCanvas(W, H), g = sky.getContext('2d');
    g.imageSmoothingEnabled = false;
    var tones = [rgb(R8[0]), rgb(R8[1]), rgb(R8[2])];
    var img = g.createImageData(W, H), d = img.data;
    function skyTone(t) {
      if (t < 0.55) return t / 0.55;                    // 0 → 1
      if (t < 0.68) return 1 + (t - 0.55) / 0.13 * 0.72; // 1 → 1.72
      if (t < 0.82) return 1.72 - (t - 0.68) / 0.14 * 0.72;
      return 1 - (t - 0.82) / 0.18;                      // 1 → 0
    }
    // пиксельный градиент с дизерингом
    for (var y = 0; y < H; y++) {
      var tv = clamp(skyTone(y / H), 0, 1.999);
      var lo = Math.floor(tv), fr = tv - lo;
      var rowOff = y * W * 4;
      for (var x = 0; x < W; x++) {
        var b = BAYER4[y & 3][x & 3] / 16;
        var c = tones[fr > b ? lo + 1 : lo];
        var o = rowOff + x * 4;
        d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
      }
    }
    // аврора: две тонкие волнистые полосы
    var g6 = rgb(R8[6]), g5 = rgb(R8[5]), g4 = rgb(R8[4]), g7 = rgb(R8[7]);
    function put(x, y2, c) {
      if (x < 0 || x >= W || y2 < 0 || y2 >= H) return;
      var o = (y2 * W + x) * 4;
      d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2];
    }
    for (var band = 0; band < 2; band++) {
      for (var bx = 0; bx < W; bx++) {
        var cy = 54 + band * 24 + Math.sin(bx * 0.019 + band * 2.1) * 10 + Math.sin(bx * 0.047 + band) * 3;
        var cyi = Math.round(cy);
        for (var k = 0; k < 2; k++) {
          if (hash01(bx * 13 + (cyi + k) * 7 + band * 911) < (k === 0 ? 0.62 : 0.3)) {
            put(bx, cyi + k, k === 0 ? g6 : g5);
          }
        }
        // редкие яркие пиксели
        if (hash01(bx * 31 + band * 77) > 0.986) put(bx, cyi - 1, band === 0 ? g7 : g4);
      }
    }
    g.putImageData(img, 0, 0);
    bg.sky = sky;

    // звёзды
    var stars = mkCanvas(W, H), sg = stars.getContext('2d');
    for (var i = 0; i < 320; i++) {
      var sx = hash01(i * 17 + 3) * W, sy = hash01(i * 91 + 11) * H * 0.7;
      var sz = 0.5 + hash01(i * 53) * 1.7;
      var al = 0.16 + hash01(i * 29) * 0.72;
      sg.fillStyle = i % 11 === 0 ? 'rgba(124,248,255,' + al + ')' :
        i % 7 === 0 ? 'rgba(255,200,87,' + al + ')' : 'rgba(234,246,255,' + al + ')';
      sg.fillRect(sx, sy, sz, sz);
      if (i % 26 === 0) {
        sg.globalAlpha = 0.3;
        sg.fillRect(sx - 4, sy + sz * 0.4, 9, 0.6);
        sg.fillRect(sx + sz * 0.4, sy - 4, 0.6, 9);
        sg.globalAlpha = 1;
      }
    }
    bg.stars = stars;

    bg.ribbons = [
      buildRibbon('#45f0b5', '#38cfe0', 1.2),
      buildRibbon('#2f7cf0', '#45f0b5', 4.7),
      buildRibbon('#ff3d8b', '#8b5cf6', 8.3)
    ];

    // слои гор (параллакс) — дальше светлее и ниже контраст
    bg.far = buildRidge(2048, H, H * 0.70, H * 0.30, 1.7, '#16263f', '#0a1224', '#4a7fa8', 0.3);
    bg.mid = buildRidge(2048, H, H * 0.85, H * 0.25, 4.3, '#0e1a2e', '#070d1a', '#6fc3df', 0.42);
    bg.near = buildRidge(2048, H, H * 1.03, H * 0.19, 9.1, '#080e1a', '#04060d', '#7cf8ff', 0.22);

    // туман у горизонта
    var fog = mkCanvas(W, H * 0.55), fg = fog.getContext('2d');
    var fgr = fg.createLinearGradient(0, 0, 0, H * 0.55);
    fgr.addColorStop(0, 'rgba(19,42,64,0)');
    fgr.addColorStop(0.5, 'rgba(30,68,94,0.14)');
    fgr.addColorStop(1, 'rgba(10,20,36,0.03)');
    fg.fillStyle = fgr; fg.fillRect(0, 0, W, H * 0.55);
    bg.fog = fog;
    bg.fog2 = fog;

    return bg;
  }

  // рисуем бесшовный слой только видимой частью (экономия заливки)
  function drawTiledLayer(g, img, off, y) {
    var lw = img.width;
    var start = off % lw;
    if (start > 0) start -= lw;
    var x = start, remaining = VW + 2;
    while (remaining > 0) {
      var srcX = Math.max(0, -x);
      var w = Math.min(lw - srcX, remaining);
      if (w <= 0) break;
      g.drawImage(img, srcX, 0, w, img.height, Math.max(0, x), y, w, img.height);
      x += w;
      remaining -= w;
    }
  }

  function drawRibbon(g, tex, x, y, w, h, alpha, rot) {
    g.save();
    g.translate(x, y);
    if (rot) g.rotate(rot);
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = alpha;
    g.drawImage(tex, -w * 0.5, -h * 0.5, w, h);
    g.restore();
  }

  function drawBgAurora(g, camX, camY, t) {
    var bg = st.bgA;
    if (!bg) return;
    var W = VW, H = VH;
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    g.drawImage(bg.sky, 0, 0);
    // звёзды с мерцанием
    g.globalAlpha = 0.8 + 0.08 * Math.sin(t * 0.9);
    g.drawImage(bg.stars, 0, 0);
    g.globalAlpha = 1;
    // яркие пульсирующие звёзды
    for (var i = 0; i < 7; i++) {
      var bx = (hash01(i * 313 + 7) * W);
      var by = (hash01(i * 197 + 3) * H * 0.6);
      var pl = 0.5 + 0.5 * Math.sin(t * (0.8 + i * 0.23) + i * 2.1);
      glowAdd(g, bx, by, 4 + pl * 6, i % 3 === 0 ? C.ice : C.snow, 0.08 + pl * 0.16);
    }
    // луна
    var mx = W * 0.79, my = H * 0.14;
    glowAdd(g, mx, my, 110, C.ice, 0.07);
    glowAdd(g, mx, my, 52, C.snow, 0.1);
    g.fillStyle = 'rgba(234,246,255,0.9)';
    g.beginPath(); g.arc(mx, my, 18, 0, TAU); g.fill();
    g.fillStyle = 'rgba(120,150,190,0.3)';
    g.beginPath(); g.arc(mx - 5, my - 4, 3, 0, TAU); g.fill();
    g.beginPath(); g.arc(mx + 5, my + 3, 2, 0, TAU); g.fill();
    g.beginPath(); g.arc(mx + 1, my - 8, 1.5, 0, TAU); g.fill();

    // аврора — живые ленты
    var r0 = bg.ribbons[0], r1 = bg.ribbons[1], r2 = bg.ribbons[2];
    var wob = Math.sin(t * 0.21) * 14;
    drawRibbon(g, r0, W * 0.5 + Math.sin(t * 0.11) * 120, H * 0.27 + wob, W * 1.45, H * 0.52, 0.3, -0.035 + Math.sin(t * 0.09) * 0.02);
    drawRibbon(g, r1, W * 0.35 + Math.sin(t * 0.07 + 2) * 140, H * 0.21 - wob * 0.6, W * 1.2, H * 0.44, 0.2, 0.05 + Math.sin(t * 0.13 + 1) * 0.03);
    drawRibbon(g, r2, W * 0.72 + Math.sin(t * 0.05 + 4) * 100, H * 0.17 + wob * 0.4, W * 0.9, H * 0.32, 0.11, -0.06);

    // параллакс-горы
    var vy1 = -(camY * 0.04), vy2 = -(camY * 0.09), vy3 = -(camY * 0.15);
    drawTiledLayer(g, bg.far, -(camX * 0.05), vy1);
    g.globalAlpha = 0.8;
    g.drawImage(bg.fog, 0, H * 0.52, W, H * 0.55);
    g.globalAlpha = 1;
    drawTiledLayer(g, bg.mid, -(camX * 0.11), vy2);
    drawTiledLayer(g, bg.near, -(camX * 0.2), vy3);

    // глубина к низу
    var vg = g.createLinearGradient(0, H * 0.55, 0, H);
    vg.addColorStop(0, 'rgba(4,6,13,0)');
    vg.addColorStop(1, 'rgba(3,4,10,0.5)');
    g.fillStyle = vg;
    g.fillRect(0, H * 0.55, W, H * 0.45);
  }

  /* ================= RETRO: фон ================= */

  var BAYER4 = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];

  function buildBgRetro() {
    var bg = {}, W = 512, H = 288;
    var sky = mkCanvas(W, H), g = sky.getContext('2d');
    g.imageSmoothingEnabled = false;
    // небо: 3 тона + байеровский дизеринг
    var tones = [R8[0], R8[1], R8[2]];
    function skyTone(t) {
      if (t < 0.52) return t / 0.52;              // 0 → 1
      if (t < 0.66) return 1 + (t - 0.52) / 0.14; // 1 → 2
      if (t < 0.8) return 2 - (t - 0.66) / 0.14;  // 2 → 1
      return 1 - (t - 0.8) / 0.2;                 // 1 → 0
    }
    for (var y = 0; y < H; y += 2) {
      var tv = clamp(skyTone(y / H), 0, 1.99);
      var lo = Math.floor(tv), fr = tv - lo;
      for (var x = 0; x < W; x += 2) {
        var d = BAYER4[(y >> 1) & 3][(x >> 1) & 3] / 16;
        g.fillStyle = tones[fr > d ? lo + 1 : lo];
        g.fillRect(x, y, 2, 2);
      }
    }
    // аврора: две тонкие волнистые полосы (без «снега»)
    for (var band = 0; band < 2; band++) {
      for (var bx = 0; bx < W; bx += 2) {
        var cy = 54 + band * 24 + Math.sin(bx * 0.019 + band * 2.1) * 10 + Math.sin(bx * 0.047 + band) * 3;
        cy = Math.round(cy / 2) * 2;
        for (var k = 0; k < 2; k++) {
          if (hash01(bx * 13 + (cy + k * 2) * 7 + band * 911) < (k === 0 ? 0.5 : 0.3)) {
            g.fillStyle = k === 0 ? R8[6] : R8[5];
            g.fillRect(bx, cy + k * 2, 2, 2);
          }
        }
      }
    }
    for (var z = 0; z < 14; z++) {
      var zx = (((hash01(z * 41 + 7) * W) / 2) | 0) * 2;
      var zy = 48 + (((hash01(z * 19 + 3) * 34) / 2) | 0) * 2;
      g.fillStyle = z % 4 === 0 ? R8[7] : R8[4];
      g.fillRect(zx, zy, 2, 2);
    }
    bg.sky = sky;

    // звёзды 1-2 px
    var stars = mkCanvas(W, H), sg = stars.getContext('2d');
    for (var i = 0; i < 110; i++) {
      var sx = (hash01(i * 37 + 5) * W) | 0, sy = (hash01(i * 79 + 9) * H * 0.55) | 0;
      sg.fillStyle = i % 9 === 0 ? R8[3] : i % 5 === 0 ? R8[4] : R8[14];
      sg.globalAlpha = 0.4 + hash01(i * 13) * 0.6;
      sg.fillRect(sx, sy, i % 17 === 0 ? 2 : 1, 1);
    }
    sg.globalAlpha = 1;
    bg.stars = stars;

    // пиксельные горы
    function pxRidge(w, h, base, amp, seed, col, topCol) {
      var c = mkCanvas(w, h), cg = c.getContext('2d');
      var prevH = null;
      for (var x2 = 0; x2 < w; x2 += 2) {
        var y2 = Math.round(ridgeY(x2, w, base, amp, seed) / 2) * 2;
        y2 = clamp(y2, 0, h - 2);
        cg.fillStyle = col;
        cg.fillRect(x2, y2, 2, h - y2);
        cg.fillStyle = topCol;
        cg.fillRect(x2, y2, 2, 2);
        if (prevH !== null && Math.abs(prevH - y2) > 2) {
          cg.fillStyle = col;
          cg.fillRect(x2, y2 - 2, 2, 2);
        }
        prevH = y2;
      }
      return c;
    }
    bg.far = pxRidge(1024, H, H * 0.74, H * 0.22, 3.2, R8[1], R8[2]);
    bg.mid = pxRidge(1024, H, H * 0.9, H * 0.26, 7.9, R8[0], R8[1]);
    bg.glow = pxRidge(1024, H, H * 0.99, H * 0.08, 11.4, R8[0], R8[1]);

    // скроллящаяся аврора-полоса (тайлится по X)
    var aw = mkCanvas(512, 72), ag = aw.getContext('2d');
    for (var ax = 0; ax < 512; ax += 2) {
      var acy = 34 + Math.sin(ax * 0.028) * 12 + Math.sin(ax * 0.061 + 1.7) * 6;
      for (var row = 0; row < 2; row++) {
        var ry2 = Math.round((acy + row * 5) / 2) * 2;
        if (hash01(ax * 3 + row * 977) < 0.5 - row * 0.18) {
          ag.fillStyle = row === 0 ? R8[6] : R8[5];
          ag.fillRect(ax, ry2, 2, 2);
        }
      }
    }
    bg.aurora = aw;
    return bg;
  }

  function drawBgRetro(g, camX, camY, t) {
    var bg = st.bgR;
    if (!bg) return;
    var W = 512, H = 288;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.imageSmoothingEnabled = false;
    g.drawImage(bg.sky, 0, 0);
    g.globalAlpha = 0.75 + 0.25 * Math.sin(t * 1.3);
    g.drawImage(bg.stars, 0, 0);
    g.globalAlpha = 1;
    // аврора-полоса: скролл по X
    var ax = -((t * 9) % 512);
    g.globalAlpha = 0.55;
    g.drawImage(bg.aurora, Math.round(ax), 10);
    g.drawImage(bg.aurora, Math.round(ax) + 512, 10);
    g.globalAlpha = 1;
    var o1 = -((camX * 0.05) % 1024);
    var o2 = -((camX * 0.12) % 1024);
    var o3 = -((camX * 0.22) % 1024);
    g.drawImage(bg.far, Math.round(o1), Math.round(-camY * 0.04));
    g.drawImage(bg.far, Math.round(o1) + 1024, Math.round(-camY * 0.04));
    g.drawImage(bg.mid, Math.round(o2), Math.round(-camY * 0.09));
    g.drawImage(bg.mid, Math.round(o2) + 1024, Math.round(-camY * 0.09));
    g.drawImage(bg.glow, Math.round(o3), Math.round(-camY * 0.15));
    g.drawImage(bg.glow, Math.round(o3) + 1024, Math.round(-camY * 0.15));
  }

  /* ================= ТАЙЛЫ ================= */

  function chAt(game, c, r) {
    if (game && typeof game.getTile === 'function') {
      try { var v = game.getTile(c, r); return (v && v.length) ? v : '.'; } catch (e) { return '.'; }
    }
    return '.';
  }
  function isSolidCh(ch) { return ch === '#' || ch === '='; }

  /* --- предзапечённые спрайты (лава, огонь) --- */
  function buildLavaFrames() {
    var frames = [], f, i;
    for (f = 0; f < 4; f++) {
      var c = mkCanvas(32, 32), g = c.getContext('2d');
      g.fillStyle = '#2a0b08';
      g.fillRect(0, 0, 32, 32);
      // расплав
      var rg = g.createLinearGradient(0, 4, 0, 32);
      rg.addColorStop(0, '#ffb24d');
      rg.addColorStop(0.35, '#ff6a1a');
      rg.addColorStop(0.75, '#c2260f');
      rg.addColorStop(1, '#5e0f08');
      g.fillStyle = rg;
      g.fillRect(0, 4, 32, 28);
      // волна поверхности
      g.fillStyle = '#ffe6a0';
      for (i = 0; i < 32; i += 2) {
        var wy = 4 + Math.round(Math.sin((i + f * 8) * 0.26) * 1.6);
        g.fillRect(i, wy, 2, 2);
      }
      // пузыри
      for (i = 0; i < 5; i++) {
        var bx = ((hash01(i * 37 + f * 11) * 26) | 0) + 3;
        var by = 10 + ((hash01(i * 91 + f * 17) * 16) | 0);
        var rr = 1 + Math.round(hash01(i * 13 + f * 7) * 2);
        g.fillStyle = 'rgba(255,230,160,0.85)';
        g.beginPath(); g.arc(bx, by - f * 1.5, rr, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,106,26,0.5)';
        g.beginPath(); g.arc(bx, by - f * 1.5, rr + 2, 0, TAU); g.fill();
      }
      // тёмные корки
      g.fillStyle = 'rgba(40,10,8,0.65)';
      g.beginPath();
      g.moveTo(0, 26 + f);
      g.lineTo(9 + f * 2, 21);
      g.lineTo(18, 27 - f);
      g.lineTo(32, 22 + f);
      g.lineTo(32, 32); g.lineTo(0, 32);
      g.closePath(); g.fill();
      frames.push(c);
    }
    return frames;
  }

  function flamePath(g, cx, baseY, w, h, ph) {
    g.beginPath();
    g.moveTo(cx - w * 0.5, baseY);
    g.bezierCurveTo(cx - w * 0.62, baseY - h * 0.42, cx - w * 0.2 + Math.sin(ph) * w * 0.12, baseY - h * 0.66, cx + Math.sin(ph * 1.7) * w * 0.14, baseY - h);
    g.bezierCurveTo(cx + w * 0.34, baseY - h * 0.62, cx + w * 0.58, baseY - h * 0.36, cx + w * 0.5, baseY);
    g.closePath();
  }

  function buildFlameFrames() {
    var frames = [], f, i;
    for (f = 0; f < 6; f++) {
      var c = mkCanvas(30, 44), g = c.getContext('2d');
      var ph = f / 6 * TAU;
      // внешнее пламя
      for (i = 0; i < 3; i++) {
        var ox = (i - 1) * 3.2, hh = 30 - Math.abs(i - 1) * 7;
        g.globalAlpha = 0.72 - Math.abs(i - 1) * 0.16;
        flamePath(g, 15 + ox, 42, 13 - Math.abs(i - 1) * 2.4, hh + Math.sin(ph + i) * 3, ph + i * 1.3);
        var gr = g.createLinearGradient(0, 42 - hh, 0, 42);
        gr.addColorStop(0, 'rgba(255,120,20,0.15)');
        gr.addColorStop(0.45, 'rgba(255,140,40,0.8)');
        gr.addColorStop(1, 'rgba(255,200,87,0.95)');
        g.fillStyle = gr; g.fill();
      }
      // ядро
      g.globalAlpha = 1;
      flamePath(g, 15, 41, 8, 19 + Math.sin(ph) * 2.5, ph * 1.4);
      var gr2 = g.createLinearGradient(0, 20, 0, 41);
      gr2.addColorStop(0, 'rgba(255,240,190,0.2)');
      gr2.addColorStop(0.5, 'rgba(255,220,140,0.9)');
      gr2.addColorStop(1, 'rgba(255,255,230,1)');
      g.fillStyle = gr2; g.fill();
      g.globalAlpha = 1;
      frames.push(c);
    }
    return frames;
  }

  function ensureTileSprites() {
    if (!st.spriteCache.lava) st.spriteCache.lava = buildLavaFrames();
    if (!st.spriteCache.flame) st.spriteCache.flame = buildFlameFrames();
  }

  /* --- печём статичный слой тайлов AURORA --- */
  function bakeTilesA(world, game) {
    var W = world.cols * TILE, H = world.rows * TILE;
    var c = mkCanvas(W, H), g = c.getContext('2d');
    ensureTileSprites();
    var cols = world.cols, rows = world.rows, r, col, ch, x, y;
    var snap = (st.tileSnap && st.tileSnap.length === cols * rows) ? st.tileSnap : new Array(cols * rows);
    for (r = 0; r < rows; r++) {
      for (col = 0; col < cols; col++) {
        ch = chAt(game, col, r);
        snap[r * cols + col] = ch;
        if (ch === '.' || ch === '~' || ch === 'G' || ch === 'T') continue;
        x = col * TILE; y = r * TILE;
        if (ch === '#' || ch === '=') {
          var upAir = !isSolidCh(chAt(game, col, r - 1));
          var downAir = !isSolidCh(chAt(game, col, r + 1));
          var leftAir = !isSolidCh(chAt(game, col - 1, r));
          var rightAir = !isSolidCh(chAt(game, col + 1, r));
          var h1 = hash01(col * 73 + r * 131), h2 = hash01(col * 191 + r * 37), h3 = hash01(col * 29 + r * 211);
          var flip = h3 > 0.5;
          g.save();
          g.translate(x + (flip ? TILE : 0), y);
          g.scale(flip ? -1 : 1, 1);
          if (ch === '#') {
            g.fillStyle = mix('#1d2c48', '#141e33', h1);
            g.fillRect(0, 0, TILE, TILE);
            // верхняя светлая грань
            g.fillStyle = 'rgba(74,104,148,' + (0.15 + h2 * 0.16) + ')';
            g.beginPath();
            g.moveTo(0, 0); g.lineTo(TILE, 0);
            g.lineTo(TILE * (0.5 + h2 * 0.3), TILE * (0.3 + h1 * 0.2));
            g.lineTo(0, TILE * (0.5 + h1 * 0.22));
            g.closePath(); g.fill();
            // тёмная грань справа
            g.fillStyle = 'rgba(4,7,14,0.32)';
            g.beginPath();
            g.moveTo(TILE * (0.5 + h2 * 0.3), TILE * (0.3 + h1 * 0.2));
            g.lineTo(TILE, TILE * (0.42 + h1 * 0.2));
            g.lineTo(TILE, TILE); g.lineTo(TILE * 0.5, TILE);
            g.closePath(); g.fill();
            // трещина
            g.strokeStyle = 'rgba(2,4,10,0.55)'; g.lineWidth = 1.5;
            g.beginPath();
            g.moveTo(TILE * (0.08 + h1 * 0.2), TILE * (0.52 + h2 * 0.16));
            g.lineTo(TILE * (0.52 + h2 * 0.24), TILE * (0.74 + h1 * 0.14));
            g.lineTo(TILE * 0.94, TILE * (0.58 + h1 * 0.26));
            g.stroke();
            // нижняя тень
            g.fillStyle = 'rgba(2,4,10,0.42)';
            g.fillRect(0, TILE * (0.84 + h2 * 0.08), TILE, TILE);
            // стеклянный блик
            g.fillStyle = 'rgba(234,246,255,' + (0.02 + h2 * 0.035) + ')';
            g.beginPath();
            g.moveTo(TILE * 0.12, TILE * 0.9); g.lineTo(TILE * 0.42, TILE * 0.16);
            g.lineTo(TILE * 0.56, TILE * 0.16); g.lineTo(TILE * 0.26, TILE * 0.9);
            g.closePath(); g.fill();
            // кристальная крошка
            for (var sp = 0; sp < 3; sp++) {
              var sx2 = 3 + hash01(col * 7 + r * 13 + sp * 31) * (TILE - 6);
              var sy2 = 6 + hash01(col * 17 + r * 5 + sp * 57) * (TILE - 12);
              g.fillStyle = 'rgba(234,246,255,' + (0.1 + hash01(sp + col + r) * 0.32) + ')';
              g.fillRect(sx2, sy2, 1.5, 1.5);
            }
          } else {
            // ломаемый лёд
            var ig = g.createLinearGradient(0, 0, TILE * 0.35, TILE);
            ig.addColorStop(0, '#2f6d9e');
            ig.addColorStop(0.5, '#1d4668');
            ig.addColorStop(1, '#12314a');
            g.fillStyle = ig;
            g.fillRect(0, 0, TILE, TILE);
            g.fillStyle = 'rgba(124,248,255,0.13)';
            g.beginPath();
            g.moveTo(2, TILE - 2); g.lineTo(TILE * 0.45, 2); g.lineTo(TILE * 0.78, TILE - 2);
            g.closePath(); g.fill();
            g.strokeStyle = 'rgba(124,248,255,0.5)'; g.lineWidth = 1.1;
            g.beginPath();
            g.moveTo(TILE * 0.3, 2); g.lineTo(TILE * 0.5, TILE * 0.5); g.lineTo(TILE * 0.3, TILE - 2); g.stroke();
            g.beginPath();
            g.moveTo(TILE * 0.7, 2); g.lineTo(TILE * 0.5, TILE * 0.5); g.lineTo(TILE * 0.7, TILE - 2); g.stroke();
            glowAdd(g, TILE * 0.5, TILE * 0.5, 30, C.ice, 0.15);
            g.fillStyle = 'rgba(234,246,255,' + (0.12 + h2 * 0.1) + ')';
            g.fillRect(1, 1, TILE - 2, 2);
            g.fillStyle = 'rgba(2,4,10,0.25)';
            g.fillRect(0, TILE - 3, TILE, 3);
          }
          g.restore();
          // --- снежная шапка ---
          if (upAir) {
            g.fillStyle = 'rgba(232,244,255,0.96)';
            g.beginPath();
            g.moveTo(x, y);
            g.lineTo(x + TILE, y);
            g.lineTo(x + TILE, y + 3 + h1 * 2);
            g.lineTo(x + TILE * 0.74, y + 5 + h2 * 3);
            g.lineTo(x + TILE * 0.45, y + 2.6 + h1 * 3);
            g.lineTo(x + TILE * 0.2, y + 6 + h2 * 2);
            g.lineTo(x, y + 3);
            g.closePath(); g.fill();
            g.fillStyle = ch === '=' ? 'rgba(124,248,255,0.9)' : 'rgba(124,248,255,0.55)';
            g.fillRect(x, y, TILE, 1.5);
            g.fillStyle = 'rgba(60,110,150,0.28)';
            g.fillRect(x, y + 6, TILE, 1.5);
          }
          // --- rim-light по открытым бокам ---
          if (leftAir) {
            var lg = g.createLinearGradient(x, y, x + 8, y);
            lg.addColorStop(0, 'rgba(150,235,255,0.4)');
            lg.addColorStop(1, 'rgba(150,235,255,0)');
            g.fillStyle = lg;
            g.fillRect(x, y, 8, TILE);
            g.fillStyle = 'rgba(234,246,255,0.6)';
            g.fillRect(x, y + (upAir ? 4 : 0), 1.5, TILE - (upAir ? 4 : 0));
          }
          if (rightAir) {
            var rg2 = g.createLinearGradient(x + TILE, y, x + TILE - 7, y);
            rg2.addColorStop(0, 'rgba(69,240,181,0.24)');
            rg2.addColorStop(1, 'rgba(69,240,181,0)');
            g.fillStyle = rg2;
            g.fillRect(x + TILE - 7, y, 7, TILE);
          }
          // --- низ: тень + сосульки ---
          if (downAir) {
            g.fillStyle = 'rgba(3,5,12,0.55)';
            g.fillRect(x, y + TILE - 3, TILE, 3);
            for (var ic = 0; ic < 3; ic++) {
              var ix = x + 4 + ic * 10 + hash01(col * 31 + r * 17 + ic) * 3;
              var il = 3 + hash01(col * 13 + ic * 91 + r) * 7;
              g.fillStyle = 'rgba(124,248,255,0.38)';
              g.beginPath();
              g.moveTo(ix, y + TILE - 2); g.lineTo(ix + 1.7, y + TILE - 2); g.lineTo(ix + 0.85, y + TILE + il);
              g.closePath(); g.fill();
            }
          }
        } else if (ch === '^') {
          var hh1 = hash01(col * 31 + r * 7), hh2 = hash01(col * 53 + r * 19);
          g.fillStyle = mix('#0e1728', '#111d30', hh1);
          g.fillRect(x, y, TILE, TILE);
          g.fillStyle = 'rgba(124,248,255,0.045)';
          g.fillRect(x, y, TILE, TILE * 0.45);
          for (var s3 = 0; s3 < 3; s3++) {
            var sx3 = x + 3 + s3 * 10, tipY = y + 5 + hash01(s3 + col * 7 + r * 3) * 4;
            g.beginPath();
            g.moveTo(sx3, y + TILE); g.lineTo(sx3 + 4.4, tipY); g.lineTo(sx3 + 8.8, y + TILE);
            g.closePath();
            var sg = g.createLinearGradient(sx3, tipY, sx3 + 8.8, y + TILE);
            sg.addColorStop(0, '#e6f7ff');
            sg.addColorStop(0.45, '#6fc3df');
            sg.addColorStop(1, '#1d3a56');
            g.fillStyle = sg; g.fill();
            g.strokeStyle = 'rgba(234,246,255,0.7)';
            g.lineWidth = 0.9;
            g.beginPath(); g.moveTo(sx3 + 4.4, tipY); g.lineTo(sx3 + 7.2, y + TILE); g.stroke();
          }
          g.fillStyle = 'rgba(3,5,12,0.7)';
          g.fillRect(x, y + TILE - 2, TILE, 2);
          g.fillStyle = 'rgba(124,248,255,0.35)';
          g.fillRect(x, y + TILE - 3, TILE, 1);
        } else if (ch === 'L') {
          g.fillStyle = 'rgba(10,17,30,0.6)';
          g.fillRect(x + 4, y, TILE - 8, TILE);
          g.fillStyle = '#4a729c';
          g.fillRect(x + 5, y, 3, TILE);
          g.fillRect(x + TILE - 8, y, 3, TILE);
          g.fillStyle = 'rgba(150,235,255,0.65)';
          g.fillRect(x + 5, y, 1.2, TILE);
          g.fillRect(x + TILE - 8, y, 1.2, TILE);
          for (var rr2 = 0; rr2 < 4; rr2++) {
            var ry = y + 4 + rr2 * 8;
            g.fillStyle = '#7a9cc0';
            g.fillRect(x + 5, ry, TILE - 10, 2.6);
            g.fillStyle = 'rgba(234,246,255,0.65)';
            g.fillRect(x + 5, ry, TILE - 10, 0.9);
          }
          glowAdd(g, x + TILE * 0.5, y + TILE * 0.5, 26, C.ice, 0.05);
        }
      }
    }
    st.tilesA = c;
    st.tileSnap = snap;
  }

  /* --- печём статичный слой тайлов RETRO (16 px) --- */
  function bakeTilesR(world, game) {
    var T = 16, W = world.cols * T, H = world.rows * T;
    var c = mkCanvas(W, H), g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    var cols = world.cols, rows = world.rows, r, col, ch;
    for (r = 0; r < rows; r++) {
      for (col = 0; col < cols; col++) {
        ch = chAt(game, col, r);
        var x = col * T, y = r * T;
        if (ch === '#' || ch === '=') {
          var upAir = !isSolidCh(chAt(game, col, r - 1));
          var downAir = !isSolidCh(chAt(game, col, r + 1));
          var leftAir = !isSolidCh(chAt(game, col - 1, r));
          g.fillStyle = ch === '#' ? R8[1] : R8[2];
          g.fillRect(x, y, T, T);
          // пиксельные грани
          g.fillStyle = ch === '#' ? R8[0] : R8[1];
          g.fillRect(x, y + T - 4, T, 4);
          g.fillStyle = ch === '#' ? '#24365c' : R8[3];
          for (var d = 0; d < 4; d++) {
            if (hash01(col * 17 + r * 31 + d * 7) > 0.5) g.fillRect(x + 2 + d * 4, y + 4 + ((hash01(d + col) * 6) | 0), 2, 2);
          }
          if (ch === '=') {
            g.fillStyle = R8[4];
            g.fillRect(x + 2, y + 2, 2, 2);
            g.fillRect(x + 10, y + 6, 2, 2);
            g.fillStyle = R8[3];
            g.fillRect(x + 6, y + 4, 2, 6);
          }
          if (upAir) { g.fillStyle = R8[4]; g.fillRect(x, y, T, 2); g.fillStyle = R8[3]; g.fillRect(x, y + 2, T, 2); }
          if (leftAir) { g.fillStyle = R8[2]; g.fillRect(x, y, 2, T); }
          if (downAir) { g.fillStyle = R8[0]; g.fillRect(x, y + T - 2, T, 2); }
          // дизеринг перехода к воздуху
          if (upAir) {
            g.fillStyle = R8[0];
            for (var dx2 = 0; dx2 < T; dx2 += 4) if ((dx2 >> 2) % 2 === 0) g.fillRect(x + dx2, y + 4, 2, 2);
          }
        } else if (ch === '^') {
          g.fillStyle = R8[0]; g.fillRect(x, y, T, T);
          for (var s4 = 0; s4 < 3; s4++) {
            var sx4 = x + 2 + s4 * 5;
            g.fillStyle = R8[3];
            g.beginPath();
            g.moveTo(sx4, y + T); g.lineTo(sx4 + 2, y + 4); g.lineTo(sx4 + 4, y + T);
            g.closePath(); g.fill();
            g.fillStyle = R8[4];
            g.fillRect(sx4 + 2, y + 6, 1, 4);
          }
        } else if (ch === 'L') {
          g.fillStyle = R8[9];
          g.fillRect(x + 3, y, 2, T);
          g.fillRect(x + T - 5, y, 2, T);
          for (var rl = 0; rl < 4; rl++) { g.fillStyle = R8[10]; g.fillRect(x + 3, y + 2 + rl * 4, T - 6, 2); }
        }
      }
    }
    st.tilesR = c;
  }

  /* --- проверка изменения тайлов (сломанный лёд и т.п.) --- */
  function checkTilesChanged(world, game) {
    if (!st.tileSnap) return false;
    var cols = world.cols, rows = world.rows;
    if (st.tileSnap.length !== cols * rows) return true;
    for (var r = 0; r < rows; r++) {
      for (var cc = 0; cc < cols; cc++) {
        if (st.tileSnap[r * cols + cc] !== chAt(game, cc, r)) return true;
      }
    }
    return false;
  }

  function prepareTiles(world, game) {
    // раз в ~12 кадров проверяем, не изменились ли тайлы (сломанный лёд)
    st.tileTime--;
    if (st.tileTime <= 0) {
      st.tileTime = 12;
      if (st.tilesA && checkTilesChanged(world, game)) { st.tilesA = null; st.tilesR = null; }
    }
    if (!st.tilesA) {
      st.tileSnap = new Array(world.cols * world.rows);
      bakeTilesA(world, game);
      st.tilesR = null;
    }
    if (st.mode === 'retro' && !st.tilesR) bakeTilesR(world, game);
  }

  /* --- отрисовка статичного слоя --- */
  function drawTilesStatic(g, camX, camY) {
    var world = st.world;
    if (!world) return;
    if (st.mode === 'retro') {
      if (!st.tilesR) return;
      var T = 16;
      var c0 = Math.max(0, Math.floor(camX / TILE) - 1);
      var r0 = Math.max(0, Math.floor(camY / TILE) - 1);
      var c1 = Math.min(world.cols, Math.ceil((camX + VW) / TILE) + 1);
      var r1 = Math.min(world.rows, Math.ceil((camY + VH) / TILE) + 1);
      if (c1 <= c0 || r1 <= r0) return;
      var sx = c0 * T, sy = r0 * T, sw = (c1 - c0) * T, sh = (r1 - r0) * T;
      g.drawImage(st.tilesR, sx, sy, sw, sh, c0 * TILE, r0 * TILE, sw * 2, sh * 2);
    } else {
      if (!st.tilesA) return;
      var ax0 = Math.max(0, Math.floor(camX / TILE) * TILE), ay0 = Math.max(0, Math.floor(camY / TILE) * TILE);
      var ax1 = Math.min(st.tilesA.width, Math.ceil((camX + VW) / TILE) * TILE);
      var ay1 = Math.min(st.tilesA.height, Math.ceil((camY + VH) / TILE) * TILE);
      if (ax1 <= ax0 || ay1 <= ay0) return;
      g.drawImage(st.tilesA, ax0, ay0, ax1 - ax0, ay1 - ay0, ax0, ay0, ax1 - ax0, ay1 - ay0);
    }
  }

  /* --- динамические тайлы: лава, якоря, факелы --- */
  function visibleRange(world) {
    var c0 = Math.max(0, Math.floor(st.cam.x / TILE) - 1);
    var r0 = Math.max(0, Math.floor(st.cam.y / TILE) - 1);
    var c1 = Math.min(world.cols - 1, Math.ceil((st.cam.x + VW) / TILE) + 1);
    var r1 = Math.min(world.rows - 1, Math.ceil((st.cam.y + VH) / TILE) + 1);
    return { c0: c0, r0: r0, c1: c1, r1: r1 };
  }

  function drawTilesDynamicA(g, game) {
    var vr = visibleRange(st.world), t = st.T;
    var lava = st.spriteCache.lava, flames = st.spriteCache.flame;
    for (var r = vr.r0; r <= vr.r1; r++) {
      for (var c = vr.c0; c <= vr.c1; c++) {
        var ch = chAt(game, c, r);
        if (ch === '.') continue;
        var x = c * TILE, y = r * TILE;
        if (ch === '~') {
          var fr = ((t * 6 + hash01(c * 13 + r * 7) * 4) | 0) % 4;
          g.drawImage(lava[fr], x, y);
          var upAir = chAt(game, c, r - 1) !== '~' && chAt(game, c, r - 1) !== '#';
          if (upAir) {
            var fl = 0.55 + 0.45 * Math.sin(t * 3.1 + c * 1.7 + r);
            glowAdd(g, x + 16, y - 4, 52, '#ff6a1a', 0.16 + fl * 0.1);
            glowAdd(g, x + 16, y + 6, 22, '#ffd166', 0.2 + fl * 0.12);
          }
        } else if (ch === 'G') {
          var pul = 0.5 + 0.5 * Math.sin(t * 2.2 + c * 0.9 + r * 1.3);
          g.strokeStyle = 'rgba(255,61,139,' + (0.5 + pul * 0.4) + ')';
          g.lineWidth = 2;
          g.beginPath(); g.arc(x + 16, y + 16, 8 + pul * 2, 0, TAU); g.stroke();
          g.strokeStyle = 'rgba(124,248,255,' + (0.35 + pul * 0.3) + ')';
          g.lineWidth = 1;
          g.beginPath(); g.arc(x + 16, y + 16, 12 - pul, 0, TAU); g.stroke();
          glowAdd(g, x + 16, y + 16, 26 + pul * 14, C.magenta, 0.16 + pul * 0.12);
          glowAdd(g, x + 16, y + 16, 10, C.ice, 0.25);
        } else if (ch === 'T') {
          var ff = ((t * 11 + hash01(c * 31 + r * 17) * 6) | 0) % 6;
          var fx = x + 16 - 15, fy = y + 30 - 44;
          glowAdd(g, x + 16, y + 18, 54, '#ffb347', 0.16);
          g.drawImage(flames[ff], fx, fy);
        }
      }
    }
  }

  function drawTilesDynamicR(g, game) {
    var vr = visibleRange(st.world), t = st.T;
    for (var r = vr.r0; r <= vr.r1; r++) {
      for (var c = vr.c0; c <= vr.c1; c++) {
        var ch = chAt(game, c, r);
        if (ch !== '~' && ch !== 'G' && ch !== 'T') continue;
        var x = c * TILE, y = r * TILE;
        if (ch === '~') {
          // пиксельная лава
          for (var by = 0; by < TILE; by += 8) {
            for (var bx = 0; bx < TILE; bx += 8) {
              var n = hash01((c * 8 + bx) * 7 + (r * 8 + by) * 13 + ((t * 5) | 0) * 3);
              g.fillStyle = n > 0.66 ? R8[10] : n > 0.33 ? R8[9] : R8[8];
              g.fillRect(x + bx, y + by, 8, 8);
            }
          }
          g.fillStyle = R8[10];
          for (var sx = 0; sx < TILE; sx += 4) {
            if (hash01(c * 5 + sx + ((t * 6) | 0)) > 0.45) g.fillRect(x + sx, y + 2, 4, 2);
          }
        } else if (ch === 'G') {
          g.strokeStyle = R8[13]; g.lineWidth = 2;
          g.strokeRect(x + 4.5, y + 4.5, 7, 7);
          g.fillStyle = R8[4]; g.fillRect(x + 7, y + 7, 2, 2);
        } else if (ch === 'T') {
          var ff = ((t * 10) | 0) % 2;
          g.fillStyle = R8[9]; g.fillRect(x + 6, y + 8, 4, 8);
          g.fillStyle = R8[10]; g.fillRect(x + 4, y + 2, 8, 6);
          g.fillStyle = R8[14]; g.fillRect(x + 6, y + (ff ? 2 : 4), 4, 2);
        }
      }
    }
  }

  /* ================= PROPS ================= */

  function groupColor(gr) {
    if (gr === 'b') return C.magenta;
    if (gr === 'c') return C.gold;
    if (gr === 'd') return C.violet;
    return C.aurora;
  }
  function propBox(p) {
    return { x: p.x, y: p.y, w: p.w || TILE, h: p.h || TILE };
  }

  /* --- AURORA --- */
  function propPlateA(g, p, t) {
    var b = propBox(p), pr = p.pressed ? 1 : 0;
    var top = b.y + b.h - 14 + pr * 5;
    g.fillStyle = 'rgba(0,0,0,0.4)';
    g.beginPath(); g.ellipse(b.x + b.w / 2, top + 11, b.w * 0.46, 4, 0, 0, TAU); g.fill();
    g.fillStyle = '#0f1a2c';
    fillRound(g, b.x + 3, top + 1, b.w - 6, 12, 3);
    g.fillStyle = '#2c4368';
    fillRound(g, b.x + 4, top, b.w - 8, 8, 2.5);
    g.fillStyle = 'rgba(234,246,255,0.22)';
    fillRound(g, b.x + 5, top + 1, b.w - 10, 2.4, 1.2);
    var col = pr ? C.aurora : C.ice;
    g.strokeStyle = rgba(col, 0.8); g.lineWidth = 1.3;
    g.beginPath(); g.arc(b.x + b.w / 2, top + 4.6, 3.4, 0, TAU); g.stroke();
    g.fillStyle = rgba(col, pr ? 0.9 : 0.35);
    g.beginPath(); g.arc(b.x + b.w / 2, top + 4.6, 1.2, 0, TAU); g.fill();
    if (pr) glowAdd(g, b.x + b.w / 2, top + 4, 30, C.aurora, 0.34 + 0.12 * Math.sin(t * 6));
    else glowAdd(g, b.x + b.w / 2, top + 4, 14, C.ice, 0.1);
  }

  function propDoorA(g, p, t) {
    var b = propBox(p), gc = groupColor(p.group), open = clamp(p.open || 0, 0, 1);
    var fh = b.h * (1 - open);
    // рама
    g.fillStyle = '#0c1526';
    fillRound(g, b.x - 4, b.y - 4, b.w + 8, b.h + 8, 7);
    g.strokeStyle = rgba(gc, 0.75); g.lineWidth = 2;
    roundRectPath(g, b.x - 3, b.y - 3, b.w + 6, b.h + 6, 6); g.stroke();
    g.strokeStyle = 'rgba(234,246,255,0.14)'; g.lineWidth = 1;
    roundRectPath(g, b.x - 1, b.y - 1, b.w + 2, b.h + 2, 5); g.stroke();
    if (fh > 1.5) {
      g.save();
      g.beginPath(); g.rect(b.x, b.y, b.w, fh); g.clip();
      g.fillStyle = rgba(gc, 0.1);
      g.fillRect(b.x, b.y, b.w, b.h);
      // энергетические полосы
      var off = (t * 26) % 12;
      for (var yy = -12 + off; yy < b.h; yy += 12) {
        var a = 0.1 + 0.1 * Math.sin(t * 4 + yy * 0.3);
        g.fillStyle = rgba(gc, Math.max(0.03, a));
        g.fillRect(b.x + 2, b.y + yy, b.w - 4, 5);
      }
      // ромбы
      g.strokeStyle = rgba(gc, 0.3); g.lineWidth = 1;
      for (var ry2 = 8; ry2 < b.h; ry2 += 20) {
        g.beginPath();
        g.moveTo(b.x + b.w / 2, b.y + ry2);
        g.lineTo(b.x + b.w / 2 + 9, b.y + ry2 + 10);
        g.lineTo(b.x + b.w / 2, b.y + ry2 + 20);
        g.lineTo(b.x + b.w / 2 - 9, b.y + ry2 + 10);
        g.closePath(); g.stroke();
      }
      // края
      g.fillStyle = rgba(gc, 0.85);
      g.fillRect(b.x, b.y, 2, fh);
      g.fillRect(b.x + b.w - 2, b.y, 2, fh);
      // энергетическая кромка (низ)
      g.fillStyle = 'rgba(234,246,255,0.85)';
      g.fillRect(b.x + 1, b.y + fh - 2, b.w - 2, 2.4);
      g.restore();
      glowAdd(g, b.x + b.w / 2, b.y + fh, b.w * 0.75, gc, 0.1 + 0.05 * Math.sin(t * 5));
    }
  }

  function propLeverA(g, p, t) {
    var b = propBox(p), on = !!p.on;
    var px = b.x + b.w / 2, py = b.y + b.h - 8;
    g.fillStyle = 'rgba(0,0,0,0.4)';
    g.beginPath(); g.ellipse(px, py + 6, 12, 4, 0, 0, TAU); g.fill();
    g.fillStyle = '#16233c';
    fillRound(g, px - 11, py - 8, 22, 13, 4);
    g.fillStyle = '#2e466c';
    fillRound(g, px - 10, py - 9, 20, 8, 3);
    var ang = on ? -0.85 : 0.85;
    g.save();
    g.translate(px, py - 5);
    g.rotate(ang);
    g.strokeStyle = '#8fa9c8'; g.lineWidth = 3.4; g.lineCap = 'round';
    g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -22); g.stroke();
    g.strokeStyle = 'rgba(234,246,255,0.7)'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(0, -2); g.lineTo(0, -21); g.stroke();
    var col = on ? C.gold : C.ice;
    g.fillStyle = col;
    g.beginPath(); g.arc(0, -24, 4.4, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.8)';
    g.beginPath(); g.arc(-1.2, -25.4, 1.6, 0, TAU); g.fill();
    g.restore();
    glowAdd(g, px + Math.sin(ang) * 24, py - 5 - Math.cos(ang) * 24, on ? 26 : 14, on ? C.gold : C.ice, on ? 0.42 : 0.14);
  }

  function propPlatformA(g, p, t) {
    var b = propBox(p);
    var cx = b.x + b.w / 2, cy = b.y;
    // свечение антиграва
    glowAdd(g, cx, cy + 14, b.w * 0.7, C.ice, 0.13 + 0.04 * Math.sin(t * 2.4));
    // корпус
    g.fillStyle = '#12203a';
    fillRound(g, b.x, cy, b.w, 13, 3);
    g.fillStyle = '#33506f';
    fillRound(g, b.x + 1, cy + 1, b.w - 2, 8, 2.5);
    // лёд-поверхность
    g.fillStyle = 'rgba(124,248,255,0.6)';
    fillRound(g, b.x + 2, cy + 1, b.w - 4, 3, 1.5);
    // кристаллы снизу
    for (var i = 0; i < 3; i++) {
      var ix = b.x + 8 + i * ((b.w - 16) / 2);
      var ih = 5 + hash01(i * 31 + Math.floor(b.x)) * 6;
      g.fillStyle = 'rgba(124,248,255,0.45)';
      g.beginPath();
      g.moveTo(ix - 3, cy + 13); g.lineTo(ix, cy + 13 + ih); g.lineTo(ix + 3, cy + 13);
      g.closePath(); g.fill();
    }
    // болты
    g.fillStyle = 'rgba(234,246,255,0.45)';
    g.fillRect(b.x + 3, cy + 4, 2, 2);
    g.fillRect(b.x + b.w - 5, cy + 4, 2, 2);
    // тросы (если платформа вертикальная)
    if (p.ox !== undefined && p.oy !== undefined) {
      g.strokeStyle = 'rgba(124,248,255,0.14)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(b.x + 6, cy); g.lineTo(b.x + 6, cy - 120); g.stroke();
      g.beginPath(); g.moveTo(b.x + b.w - 6, cy); g.lineTo(b.x + b.w - 6, cy - 120); g.stroke();
    }
  }

  function propRuneA(g, p, t) {
    var b = propBox(p), cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    var taken = !!p.taken;
    var bob = taken ? 0 : Math.sin(t * 1.8 + b.x * 0.01) * 2.4;
    var pulse = 0.5 + 0.5 * Math.sin(t * 2.6 + b.x * 0.02);
    if (!taken) glowAdd(g, cx, cy + bob, 40 + pulse * 10, C.gold, 0.12 + pulse * 0.08);
    // камень
    g.fillStyle = taken ? '#182335' : '#22314b';
    g.beginPath();
    g.moveTo(cx - 11, cy - 12 + bob);
    g.lineTo(cx + 11, cy - 12 + bob);
    g.lineTo(cx + 13, cy + 12 + bob);
    g.lineTo(cx - 13, cy + 12 + bob);
    g.closePath(); g.fill();
    g.strokeStyle = taken ? 'rgba(120,140,170,0.4)' : rgba(C.ice, 0.65);
    g.lineWidth = 1.4; g.stroke();
    // руна
    g.strokeStyle = taken ? 'rgba(150,170,200,0.35)' : rgba(C.gold, 0.95);
    g.lineWidth = 2; g.lineCap = 'round';
    g.beginPath();
    g.moveTo(cx - 5, cy - 6 + bob); g.lineTo(cx - 5, cy + 7 + bob);
    g.moveTo(cx - 5, cy - 4 + bob); g.lineTo(cx + 5, cy - 9 + bob);
    g.moveTo(cx - 5, cy + 1 + bob); g.lineTo(cx + 4, cy + 6 + bob);
    g.stroke();
    if (!taken) {
      g.fillStyle = 'rgba(234,246,255,0.9)';
      g.beginPath(); g.arc(cx + 9, cy - 10 + bob, 1.6, 0, TAU); g.fill();
    }
    // отражение/тень
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.beginPath(); g.ellipse(cx, cy + 22, 12, 3.4, 0, 0, TAU); g.fill();
  }

  function propCheckpointA(g, p, t) {
    var b = propBox(p), cx = b.x + b.w / 2, cy = b.y + b.h;
    var on = !!p.active;
    var pulse = 0.5 + 0.5 * Math.sin(t * 3 + b.x * 0.01);
    // обелиск
    g.fillStyle = '#111c30';
    g.beginPath();
    g.moveTo(cx - 12, cy);
    g.lineTo(cx - 8, cy - b.h * 0.78);
    g.lineTo(cx, cy - b.h * 0.94);
    g.lineTo(cx + 8, cy - b.h * 0.78);
    g.lineTo(cx + 12, cy);
    g.closePath(); g.fill();
    g.strokeStyle = 'rgba(124,248,255,' + (on ? 0.7 : 0.25) + ')';
    g.lineWidth = 1.4; g.stroke();
    // руническая полоса
    for (var i = 0; i < 3; i++) {
      var yy = cy - 12 - i * 9;
      g.fillStyle = rgba(on ? C.aurora : C.ice, on ? 0.85 : 0.25);
      g.fillRect(cx - 4, yy, 8, 2);
    }
    // кристалл на вершине
    var gy = cy - b.h * 0.88;
    g.fillStyle = on ? 'rgba(69,240,181,0.95)' : 'rgba(80,110,140,0.8)';
    g.beginPath();
    g.moveTo(cx, gy - 10); g.lineTo(cx + 6, gy); g.lineTo(cx, gy + 7); g.lineTo(cx - 6, gy);
    g.closePath(); g.fill();
    glowAdd(g, cx, gy - 2, on ? 46 + pulse * 16 : 16, on ? C.aurora : C.ice, on ? 0.3 + pulse * 0.14 : 0.08);
    if (on) {
      // парящие искры
      for (var k = 0; k < 3; k++) {
        var ph = t * 1.1 + k * 2.1;
        var px2 = cx + Math.sin(ph * 1.7) * 12;
        var py2 = gy - 10 - ((ph * 9) % 30);
        g.fillStyle = 'rgba(69,240,181,' + (0.5 - (py2 - gy + 40) / 120) + ')';
        g.fillRect(px2, py2, 1.8, 1.8);
      }
    }
  }

  function propExitA(g, p, t) {
    var b = propBox(p), cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    var got = typeof p.collected === 'number' ? p.collected : 0;
    var total = p.total || 3;
    // рама-портал
    g.fillStyle = '#070d18';
    fillRound(g, b.x - 4, b.y - 4, b.w + 8, b.h + 8, 10);
    g.strokeStyle = rgba(C.ice, 0.5); g.lineWidth = 2;
    roundRectPath(g, b.x - 4, b.y - 4, b.w + 8, b.h + 8, 10); g.stroke();
    // вихрь
    g.save();
    g.beginPath(); g.rect(b.x, b.y, b.w, b.h); g.clip();
    var mx = cx, my = cy;
    glowAdd(g, mx, my, b.w * 0.75, C.violet, 0.3);
    glowAdd(g, mx, my, b.w * 0.45, C.ice, 0.28);
    for (var i = 0; i < 7; i++) {
      var ang = t * (0.55 + i * 0.09) + i * 0.9;
      var rx = b.w * 0.42 * (0.62 - i * 0.055);
      var ry = b.h * 0.42 * (0.62 - i * 0.055);
      g.strokeStyle = i % 2 === 0 ? rgba(C.ice, 0.5 - i * 0.05) : rgba(C.aurora, 0.42 - i * 0.045);
      g.lineWidth = 2.2 - i * 0.2;
      g.beginPath();
      g.ellipse(mx, my, Math.max(2, rx), Math.max(2, ry), ang, 0, TAU * 0.72);
      g.stroke();
    }
    // ядро
    g.fillStyle = 'rgba(124,248,255,0.85)';
    g.beginPath(); g.arc(mx, my, 6, 0, TAU); g.fill();
    g.fillStyle = 'rgba(234,246,255,0.95)';
    g.beginPath(); g.arc(mx, my, 3, 0, TAU); g.fill();
    // искры
    for (var k = 0; k < 6; k++) {
      var a2 = t * 1.6 + k * 1.05;
      var rr = 10 + (k % 3) * 8;
      g.fillStyle = 'rgba(234,246,255,' + (0.45 + 0.3 * Math.sin(a2 * 2)) + ')';
      g.fillRect(mx + Math.cos(a2) * rr, my + Math.sin(a2 * 1.3) * rr * 0.7, 2, 2);
    }
    g.restore();
    // счётчик вошедших
    for (var d = 0; d < total; d++) {
      var dx = cx - (total - 1) * 6 + d * 12;
      var dy = b.y + b.h + 12;
      g.fillStyle = d < got ? C.aurora : 'rgba(120,145,180,0.45)';
      g.beginPath();
      g.moveTo(dx, dy - 4); g.lineTo(dx + 4, dy); g.lineTo(dx, dy + 4); g.lineTo(dx - 4, dy);
      g.closePath(); g.fill();
    }
  }

  function propSignA(g, p, t) {
    var b = propBox(p), cx = b.x + b.w / 2, by = b.y + b.h;
    var near = !!p.near;
    if (near) {
      var pl = 0.5 + 0.5 * Math.sin((st.T || 0) * 4);
      glowAdd(g, cx, by - b.h * 0.55, 42, C.gold, 0.1 + pl * 0.12);
    }
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.beginPath(); g.ellipse(cx, by - 2, 16, 4, 0, 0, TAU); g.fill();
    g.fillStyle = '#182338';
    g.beginPath();
    g.moveTo(b.x + 2, by);
    g.lineTo(b.x + 3, by - b.h * 0.9);
    g.lineTo(cx, by - b.h + 2);
    g.lineTo(b.x + b.w - 3, by - b.h * 0.9);
    g.lineTo(b.x + b.w - 2, by);
    g.closePath(); g.fill();
    g.strokeStyle = near ? 'rgba(255,200,87,0.75)' : 'rgba(124,248,255,0.3)'; g.lineWidth = 1.3; g.stroke();
    // царапины-руны
    g.strokeStyle = 'rgba(124,248,255,0.45)'; g.lineWidth = 1.6; g.lineCap = 'round';
    for (var i = 0; i < 3; i++) {
      var yy = by - b.h * 0.62 + i * 6;
      g.beginPath();
      g.moveTo(cx - 7, yy); g.lineTo(cx + 7, yy);
      g.moveTo(cx + 1, yy - 2.5); g.lineTo(cx - 4, yy + 2.5);
      g.stroke();
    }
    glowAdd(g, cx, by - b.h * 0.6, 22, C.ice, 0.06);
  }

  function propAnchorA(g, p, t) {
    var b = propBox(p), cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    var pulse = 0.5 + 0.5 * Math.sin(t * 1.9 + b.x * 0.03);
    g.strokeStyle = rgba(C.magenta, 0.55 + pulse * 0.3); g.lineWidth = 2;
    g.beginPath(); g.arc(cx, cy, 7, 0, TAU); g.stroke();
    g.strokeStyle = rgba(C.ice, 0.35); g.lineWidth = 1.2;
    g.beginPath(); g.arc(cx, cy, 11, 0, TAU); g.stroke();
    g.fillStyle = rgba(C.magenta, 0.8);
    g.fillRect(cx - 1, cy - 2, 2, 4);
    glowAdd(g, cx, cy, 22 + pulse * 10, C.magenta, 0.14 + pulse * 0.1);
  }

  function propTorchA(g, p, t) {
    var b = propBox(p), cx = b.x + b.w / 2, by = b.y + b.h;
    var seed = p.seed || 0;
    ensureTileSprites();
    g.fillStyle = '#243349';
    fillRound(g, cx - 2.5, by - 16, 5, 14, 2);
    g.fillStyle = '#3d5678';
    fillRound(g, cx - 4, by - 7, 8, 5, 2);
    var ff = ((t * 11 + seed * 3) | 0) % 6;
    glowAdd(g, cx, by - 22, 70, '#ffb347', 0.2);
    glowAdd(g, cx, by - 22, 30, '#ffd166', 0.16);
    g.drawImage(st.spriteCache.flame[ff], cx - 15, by - 46);
  }

  /* --- RETRO --- */
  function propPlateR(g, p) {
    var b = propBox(p), pr = p.pressed ? 1 : 0;
    var top = b.y + b.h - 8 + pr * 3;
    g.fillStyle = R8[0]; g.fillRect(b.x + 2, top + 2, b.w - 4, 6);
    g.fillStyle = R8[2]; g.fillRect(b.x + 2, top, b.w - 4, 4);
    g.fillStyle = pr ? R8[7] : R8[3]; g.fillRect(b.x + 2, top, b.w - 4, 2);
    g.fillStyle = pr ? R8[4] : R8[1]; g.fillRect(b.x + b.w / 2 - 2, top, 4, 2);
  }
  function propDoorR(g, p) {
    var b = propBox(p), open = clamp(p.open || 0, 0, 1);
    var fh = Math.round(b.h * (1 - open) / 2) * 2;
    var gc = p.group === 'b' ? R8[13] : p.group === 'c' ? R8[10] : p.group === 'd' ? R8[12] : R8[7];
    g.fillStyle = R8[0];
    g.fillRect(b.x - 2, b.y - 2, b.w + 4, b.h + 4);
    g.fillStyle = gc;
    g.fillRect(b.x - 2, b.y - 2, b.w + 4, 2);
    g.fillRect(b.x - 2, b.y + b.h, b.w + 4, 2);
    if (fh > 2) {
      g.fillStyle = R8[1]; g.fillRect(b.x, b.y, b.w, fh);
      g.fillStyle = gc;
      for (var yy = 0; yy < fh; yy += 6) g.fillRect(b.x + 2, b.y + yy, b.w - 4, 2);
      g.fillStyle = R8[14]; g.fillRect(b.x, b.y, 2, fh); g.fillRect(b.x + b.w - 2, b.y, 2, fh);
    }
  }
  function propLeverR(g, p) {
    var b = propBox(p), on = !!p.on;
    var px = Math.round(b.x + b.w / 2), py = Math.round(b.y + b.h - 6);
    g.fillStyle = R8[8]; g.fillRect(px - 6, py - 4, 12, 6);
    g.fillStyle = R8[9]; g.fillRect(px - 5, py - 5, 10, 3);
    var hx = on ? px + 6 : px - 6;
    g.fillStyle = R8[10]; g.fillRect(Math.min(px, hx), py - 14, 2, 10);
    g.fillStyle = on ? R8[10] : R8[3]; g.fillRect(hx - 2, py - 16, 4, 4);
  }
  function propPlatformR(g, p) {
    var b = propBox(p);
    g.fillStyle = R8[1]; g.fillRect(b.x, b.y, b.w, 6);
    g.fillStyle = R8[3]; g.fillRect(b.x, b.y, b.w, 2);
    g.fillStyle = R8[2]; g.fillRect(b.x, b.y + 6, b.w, 2);
    g.fillStyle = R8[1];
    for (var i = 4; i < b.w; i += 10) g.fillRect(b.x + i, b.y + 8, 2, 2);
  }
  function propRuneR(g, p) {
    var b = propBox(p), cx = Math.round(b.x + b.w / 2), cy = Math.round(b.y + b.h / 2);
    var taken = !!p.taken;
    g.fillStyle = taken ? R8[1] : R8[8];
    g.fillRect(cx - 5, cy - 7, 11, 14);
    g.fillStyle = taken ? R8[1] : R8[9];
    g.fillRect(cx - 4, cy - 6, 9, 12);
    g.fillStyle = taken ? R8[2] : R8[10];
    g.fillRect(cx - 2, cy - 4, 2, 8);
    g.fillRect(cx - 2, cy - 2, 5, 2);
    g.fillRect(cx - 2, cy + 1, 5, 2);
  }
  function propCheckpointR(g, p) {
    var b = propBox(p), on = !!p.active;
    var cx = Math.round(b.x + b.w / 2), by = Math.round(b.y + b.h);
    var hh = Math.round(b.h * 0.8);
    g.fillStyle = R8[1];
    g.fillRect(cx - 5, by - hh, 11, hh);
    g.fillStyle = on ? R8[6] : R8[2];
    g.fillRect(cx - 4, by - hh, 2, hh);
    g.fillStyle = on ? R8[7] : R8[2];
    g.fillRect(cx - 3, by - Math.round(b.h * 0.7), 7, 2);
    g.fillRect(cx - 3, by - Math.round(b.h * 0.5), 7, 2);
    g.fillStyle = on ? R8[4] : R8[3];
    g.fillRect(cx - 2, by - Math.round(b.h * 0.9), 5, 4);
  }
  function propExitR(g, p, t) {
    var b = propBox(p), cx = Math.round(b.x + b.w / 2), cy = Math.round(b.y + b.h / 2);
    var got = typeof p.collected === 'number' ? p.collected : 0;
    var total = p.total || 3;
    g.fillStyle = R8[0]; g.fillRect(b.x, b.y, b.w, b.h);
    g.fillStyle = R8[1]; g.fillRect(b.x + 2, b.y + 2, b.w - 4, b.h - 4);
    var ph = ((t * 4) | 0) % 4;
    for (var i = 0; i < 4; i++) {
      var rx = Math.round((b.w * 0.36 - i * 6) / 2) * 2;
      var ry = Math.round((b.h * 0.36 - i * 4) / 2) * 2;
      g.strokeStyle = i % 2 ? R8[3] : R8[4];
      g.lineWidth = 2;
      g.beginPath();
      g.ellipse(cx + Math.round(((ph + i) % 4) * 2) - 3, cy, Math.max(2, rx), Math.max(2, ry), 0, 0, TAU);
      g.stroke();
    }
    g.fillStyle = R8[14]; g.fillRect(cx - 2, cy - 2, 4, 4);
    for (var d = 0; d < total; d++) {
      g.fillStyle = d < got ? R8[7] : R8[1];
      g.fillRect(cx - (total - 1) * 4 + d * 8 - 2, b.y + b.h + 4, 4, 4);
    }
  }
  function propSignR(g, p) {
    var b = propBox(p), by = Math.round(b.y + b.h);
    var hh = Math.round(b.h * 0.9);
    g.fillStyle = R8[8];
    g.fillRect(b.x + 2, by - hh, b.w - 4, hh);
    g.fillStyle = R8[9];
    g.fillRect(b.x + 3, by - hh + 2, b.w - 6, 2);
    g.fillStyle = R8[3];
    for (var i = 0; i < 3; i++) g.fillRect(b.x + 6, by - Math.round(b.h * 0.62) + i * 5, b.w - 12, 2);
  }
  function propAnchorR(g, p) {
    var b = propBox(p), cx = Math.round(b.x + b.w / 2), cy = Math.round(b.y + b.h / 2);
    g.fillStyle = R8[13];
    g.fillRect(cx - 4, cy - 4, 8, 2); g.fillRect(cx - 4, cy + 2, 8, 2);
    g.fillRect(cx - 4, cy - 4, 2, 8); g.fillRect(cx + 2, cy - 4, 2, 8);
  }
  function propTorchR(g, p, t) {
    var b = propBox(p), cx = Math.round(b.x + b.w / 2), by = Math.round(b.y + b.h);
    g.fillStyle = R8[8]; g.fillRect(cx - 1, by - 10, 2, 8);
    var f = ((t * 8) | 0) % 2;
    g.fillStyle = R8[9]; g.fillRect(cx - 3, by - 18, 6, 8);
    g.fillStyle = R8[10]; g.fillRect(cx - 2, by - 17 + f, 4, 5);
    g.fillStyle = R8[14]; g.fillRect(cx - 1, by - 15 + f, 2, 3);
  }

  function drawPropsA(g, world, t) {
    var props = world.props || [], i, p;
    ensureTileSprites();
    for (i = 0; i < props.length; i++) {
      p = props[i];
      if (!p || !p.type || p.x === undefined) continue;
      if (p.x + (p.w || TILE) < st.cam.x - 60 || p.x > st.cam.x + VW + 60) continue;
      if (p.y + (p.h || TILE) < st.cam.y - 60 || p.y > st.cam.y + VH + 60) continue;
      switch (p.type) {
        case 'plate': propPlateA(g, p, t); break;
        case 'door': propDoorA(g, p, t); break;
        case 'lever': propLeverA(g, p, t); break;
        case 'platform': propPlatformA(g, p, t); break;
        case 'rune': propRuneA(g, p, t); break;
        case 'checkpoint': propCheckpointA(g, p, t); break;
        case 'exit': propExitA(g, p, t); break;
        case 'sign': propSignA(g, p, t); break;
        case 'anchor': propAnchorA(g, p, t); break;
        case 'torch': propTorchA(g, p, t); break;
      }
    }
  }

  function drawPropsR(g, world, t) {
    var props = world.props || [], i, p;
    for (i = 0; i < props.length; i++) {
      p = props[i];
      if (!p || !p.type || p.x === undefined) continue;
      if (p.x + (p.w || TILE) < st.cam.x - 40 || p.x > st.cam.x + VW + 40) continue;
      if (p.y + (p.h || TILE) < st.cam.y - 40 || p.y > st.cam.y + VH + 40) continue;
      switch (p.type) {
        case 'plate': propPlateR(g, p); break;
        case 'door': propDoorR(g, p); break;
        case 'lever': propLeverR(g, p); break;
        case 'platform': propPlatformR(g, p); break;
        case 'rune': propRuneR(g, p); break;
        case 'checkpoint': propCheckpointR(g, p); break;
        case 'exit': propExitR(g, p, t); break;
        case 'sign': propSignR(g, p); break;
        case 'anchor': propAnchorR(g, p); break;
        case 'torch': propTorchR(g, p, t); break;
      }
    }
  }

  /* ================= ВИКИНГИ ================= */

  var OUTLINE = 'rgba(4,8,16,0.85)';

  function vikGeom(a) {
    var h = a.h || 44, w = a.w || 24;
    return {
      h: h, w: w,
      hipY: -h * 0.44, shY: -h * 0.755, headY: -h * 0.855,
      headR: h * 0.145, bodyW: w * 0.5, legW: w * 0.2, hipOff: w * 0.25
    };
  }

  function drawBoot(g, x, y, s, col) {
    // тёмный контур
    g.fillStyle = 'rgba(4,8,16,0.85)';
    fillRound(g, x - 3.4 * s, y - 3.4 * s, 8.4 * s, 5 * s, 1.6 * s);
    g.fillStyle = col;
    fillRound(g, x - 2.8 * s, y - 2.8 * s, 7.2 * s, 4 * s, 1.4 * s);
    g.fillStyle = 'rgba(190,225,255,0.2)';
    g.fillRect(x - 2.2 * s, y - 2.6 * s, 4.4 * s, 0.9 * s);
  }

  function limb(g, x1, y1, x2, y2, cx, cy, col, lw, hi) {
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(4,8,16,0.85)';
    g.lineWidth = lw + 2.2;
    g.beginPath(); g.moveTo(x1, y1); g.quadraticCurveTo(cx, cy, x2, y2); g.stroke();
    g.strokeStyle = col;
    g.lineWidth = lw;
    g.beginPath(); g.moveTo(x1, y1); g.quadraticCurveTo(cx, cy, x2, y2); g.stroke();
    if (hi) {
      g.strokeStyle = hi;
      g.lineWidth = Math.max(0.9, lw * 0.26);
      g.beginPath(); g.moveTo(x1 - lw * 0.22, y1 - lw * 0.18); g.quadraticCurveTo(cx - lw * 0.3, cy, x2 - lw * 0.24, y2); g.stroke();
    }
  }

  /* аура активного викинга */
  function drawActiveMarker(g, a, t, v) {
    var h = a.h || 44;
    g.save();
    g.globalCompositeOperation = 'lighter';
    glow(g, a.x, a.y - 2, a.w * 1.4, v.main, 0.18 + 0.05 * Math.sin(t * 2.6));
    g.globalAlpha = 0.09 + 0.03 * Math.sin(t * 1.9);
    var spr = glowSprite(v.main);
    g.drawImage(spr, a.x - a.w * 0.8, a.y - h - 30, a.w * 1.6, h * 1.6);
    g.globalAlpha = 1;
    g.restore();
    g.strokeStyle = rgba(v.main, 0.52 + 0.22 * Math.sin(t * 3));
    g.lineWidth = 1.7;
    g.beginPath();
    g.ellipse(a.x, a.y - 1, a.w * 0.74, a.w * 0.27, 0, 0, TAU);
    g.stroke();
    var cy = a.y - h - 15 + Math.sin(t * 2.8) * 2;
    g.fillStyle = rgba(v.main, 0.9);
    g.beginPath();
    g.moveTo(a.x - 5, cy - 5); g.lineTo(a.x + 5, cy - 5); g.lineTo(a.x, cy + 1);
    g.closePath(); g.fill();
  }

  /* голограмма неактивного викинга */
  function drawHoloMarker(g, a, t, v) {
    var h = a.h || 44, w = a.w || 24;
    var pulse = 0.5 + 0.5 * Math.sin(t * 2.1 + v.num);
    var feet = a.y;
    g.save();
    // свет снизу
    g.globalCompositeOperation = 'lighter';
    glow(g, a.x, feet - 2, w * 1.15, C.ice, 0.09);
    g.globalCompositeOperation = 'source-over';
    g.strokeStyle = rgba(C.ice, 0.42 + pulse * 0.26);
    g.lineWidth = 1.25;
    g.fillStyle = 'rgba(124,248,255,0.055)';
    // ноги
    roundRectPath(g, a.x - w * 0.3, feet - h * 0.36, w * 0.24, h * 0.36, w * 0.1);
    g.fill(); g.stroke();
    roundRectPath(g, a.x + w * 0.06, feet - h * 0.36, w * 0.24, h * 0.36, w * 0.1);
    g.fill(); g.stroke();
    // торс: трапеция — плечи шире талии
    var shH = a.id === 'bjorn' ? 0.5 : 0.44, waH = a.id === 'bjorn' ? 0.27 : 0.3;
    g.beginPath();
    g.moveTo(a.x - w * shH, feet - h * 0.74);
    g.quadraticCurveTo(a.x - w * shH, feet - h * 0.79, a.x - w * (shH - 0.08), feet - h * 0.79);
    g.lineTo(a.x + w * (shH - 0.08), feet - h * 0.79);
    g.quadraticCurveTo(a.x + w * shH, feet - h * 0.79, a.x + w * shH, feet - h * 0.74);
    g.lineTo(a.x + w * waH, feet - h * 0.33);
    g.lineTo(a.x - w * waH, feet - h * 0.33);
    g.closePath();
    g.fill(); g.stroke();
    // плечи
    g.beginPath();
    g.moveTo(a.x - w * 0.46, feet - h * 0.7);
    g.lineTo(a.x - w * 0.62, feet - h * 0.6);
    g.moveTo(a.x + w * 0.46, feet - h * 0.7);
    g.lineTo(a.x + w * 0.62, feet - h * 0.6);
    g.stroke();
    // голова
    g.beginPath();
    g.arc(a.x, feet - h * 0.87, h * 0.135, 0, TAU);
    g.fill(); g.stroke();
    // контур головного убора героя
    g.beginPath();
    if (a.id === 'snorri') {
      g.moveTo(a.x + h * 0.12, feet - h * 0.93);
      g.quadraticCurveTo(a.x - h * 0.02, feet - h * 1.04, a.x - h * 0.14, feet - h * 0.96);
      g.quadraticCurveTo(a.x - h * 0.24, feet - h * 0.9, a.x - h * 0.26, feet - h * 0.78);
    } else if (a.id === 'gunnar') {
      g.moveTo(a.x - h * 0.16, feet - h * 0.9);
      g.lineTo(a.x - h * 0.17, feet - h * 1.04);
      g.quadraticCurveTo(a.x, feet - h * 1.1, a.x + h * 0.17, feet - h * 1.04);
      g.lineTo(a.x + h * 0.16, feet - h * 0.9);
    } else {
      g.moveTo(a.x - h * 0.14, feet - h * 0.93);
      g.lineTo(a.x + h * 0.14, feet - h * 0.93);
      g.moveTo(a.x + h * 0.08, feet - h * 0.95);
      g.arc(a.x + h * 0.03, feet - h * 0.95, h * 0.05, 0, TAU);
    }
    g.stroke();
    // сканирующие линии
    g.save();
    roundRectPath(g, a.x - w * 0.46, feet - h * 0.8, w * 0.92, h * 0.8, w * 0.2);
    g.clip();
    for (var i = 0; i < 3; i++) {
      var yy = feet - h + ((t * 20 + i * h * 0.34) % h);
      g.fillStyle = 'rgba(124,248,255,' + (0.16 + pulse * 0.12) + ')';
      g.fillRect(a.x - w * 0.5, yy, w, 1.4);
    }
    g.restore();
    // номер
    var ny = feet - h - 13;
    g.globalAlpha = 0.62 + pulse * 0.32;
    g.fillStyle = 'rgba(5,11,20,0.78)';
    fillRound(g, a.x - 9, ny - 10, 18, 15, 5);
    g.strokeStyle = rgba(C.ice, 0.65);
    g.lineWidth = 1;
    roundRectPath(g, a.x - 9, ny - 10, 18, 15, 5); g.stroke();
    g.fillStyle = C.ice;
    g.font = 'bold 11px "Inter","SF Pro Display",-apple-system,"Segoe UI",Roboto,sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(String(v.num), a.x, ny - 2);
    g.restore();
  }

  /* тело героя в локальных координатах (ноги в 0, вперёд +x).
     Облик — мастера северной кузни: Таран (snorri) — капюшон, фартук, медный наплечник;
     Стрелок (gunnar) — меховая шапка, кафтан, шарф, арбалет и кузнечный молот;
     Опора (bjorn) — бритая голова, кузнечные очки, борода-косица, стёганый жилет, щит-кузнечный круг.
     Позы и фазы анимации — прежние. */
  function drawVikingBodyA(g, a, v, t) {
    var G = vikGeom(a), h = G.h, w = G.w, bodyW = G.bodyW, headR = G.headR;
    var stt = a.state || 'idle';
    var anim = a.anim || 0;
    var ph = anim * 15;
    var moving = stt === 'run';
    var climbing = stt === 'climb';
    var inAir = stt === 'jump' || stt === 'fall';
    var atk = a.attack || null;
    var bob = moving ? Math.abs(Math.cos(ph)) * 1.7 : Math.sin(t * 2.2 + v.num * 1.7) * 0.7;
    var hipY = G.hipY - bob * 0.3;
    var shY = G.shY - bob;
    var headY = G.headY - bob;
    var lean = 0;
    var isS = a.id === 'snorri', isG = a.id === 'gunnar', isB = a.id === 'bjorn';
    if (stt === 'jump') lean = 0.05;
    else if (stt === 'fall') lean = -0.04;
    else if (stt === 'hurt') lean = -0.14;
    if (atk && atk.kind === 'headbutt') lean = 0.24 * Math.sin(Math.PI * clamp(atk.t, 0, 1));
    if (climbing) lean = 0.03;

    if (lean) g.rotate(lean);
    var wave = Math.sin(t * 3.4 + anim * 4) * (moving || inAir ? 3.6 : 1.3);

    // ---- за спиной ----
    if (isS) {
      // хвост капюшона
      g.fillStyle = v.hoodS;
      g.beginPath();
      g.moveTo(-headR * 0.7, headY - headR * 0.6);
      g.quadraticCurveTo(-headR * 1.9 - wave * 0.4, headY + headR * 0.2, -headR * 1.8 - wave * 0.8, headY + headR * 1.9);
      g.lineTo(-headR * 0.9, headY + headR * 1.2);
      g.closePath(); g.fill();
      g.strokeStyle = 'rgba(4,8,16,0.5)'; g.lineWidth = 1; g.stroke();
    } else if (isG && stt !== 'shoot') {
      // арбалет за спиной
      g.save();
      g.translate(-bodyW * 0.42, shY + h * 0.2);
      g.rotate(0.6);
      g.fillStyle = OUTLINE; fillRound(g, -2.2, -h * 0.26, 4.4, h * 0.44, 1.6);
      g.fillStyle = v.wood; fillRound(g, -1.4, -h * 0.25, 2.8, h * 0.42, 1.2);
      g.strokeStyle = OUTLINE; g.lineWidth = 3.6; g.lineCap = 'round';
      g.beginPath(); g.moveTo(-h * 0.17, -h * 0.2); g.quadraticCurveTo(0, -h * 0.29, h * 0.17, -h * 0.2); g.stroke();
      g.strokeStyle = '#c3d4e8'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(-h * 0.17, -h * 0.2); g.quadraticCurveTo(0, -h * 0.29, h * 0.17, -h * 0.2); g.stroke();
      g.strokeStyle = 'rgba(234,246,255,0.7)'; g.lineWidth = 0.8;
      g.beginPath(); g.moveTo(-h * 0.17, -h * 0.2); g.lineTo(h * 0.17, -h * 0.2); g.stroke();
      g.restore();
    }

    // ---- ноги ----
    var foot1X, foot2X, lift1 = 0, lift2 = 0;
    if (moving) {
      foot1X = Math.sin(ph) * h * 0.2; foot2X = Math.sin(ph + Math.PI) * h * 0.2;
      lift1 = Math.max(0, Math.sin(ph)) * h * 0.1;
      lift2 = Math.max(0, Math.sin(ph + Math.PI)) * h * 0.1;
    } else if (inAir) {
      foot1X = -h * 0.12; foot2X = h * 0.13; lift1 = h * 0.06; lift2 = 0;
    } else if (climbing) {
      foot1X = -h * 0.05; foot2X = h * 0.05;
      lift1 = Math.max(0, Math.sin(ph)) * h * 0.06; lift2 = Math.max(0, Math.sin(ph + Math.PI)) * h * 0.06;
    } else {
      foot1X = -h * 0.03; foot2X = h * 0.03;
    }
    function leg(fx, lift, side) {
      var hipX = side * G.hipOff;
      var footX = fx + side * G.hipOff * 0.9;
      var footY = -lift;
      var kneeX = (hipX + footX) * 0.5 + side * (moving ? h * 0.03 : 0.6);
      var kneeY = (hipY + footY) * 0.5;
      limb(g, hipX, hipY, footX, footY, kneeX, kneeY, v.cloth2, G.legW, 'rgba(190,230,255,0.16)');
      drawBoot(g, footX, footY, w / 24, '#2b1d15');
    }
    leg(foot2X, lift2, -1);
    leg(foot1X, lift1, 1);

    // ---- торс ----
    var waist = isB ? 0.46 : 0.58;
    g.beginPath();
    g.moveTo(-bodyW * (isB ? 0.86 : 0.7), shY + 3);
    g.quadraticCurveTo(-bodyW * (isB ? 0.8 : 0.84), hipY * 0.55, -bodyW * waist, hipY + 1);
    g.lineTo(bodyW * waist, hipY + 1);
    g.quadraticCurveTo(bodyW * (isB ? 0.8 : 0.84), hipY * 0.55, bodyW * (isB ? 0.86 : 0.7), shY + 3);
    g.quadraticCurveTo(0, shY - 2.6, -bodyW * (isB ? 0.86 : 0.7), shY + 3);
    g.closePath();
    g.strokeStyle = OUTLINE; g.lineWidth = 2.4; g.stroke();
    g.fillStyle = v.cloth; g.fill();
    g.fillStyle = 'rgba(255,255,255,0.10)';
    g.beginPath();
    g.moveTo(-bodyW * 0.5, shY + 5);
    g.quadraticCurveTo(0, shY + 1.4, bodyW * 0.4, shY + 5);
    g.lineTo(bodyW * 0.22, hipY);
    g.quadraticCurveTo(-bodyW * 0.1, hipY - 3, -bodyW * 0.44, hipY);
    g.closePath(); g.fill();

    if (isG) {
      // полы кафтана до колен и меховая оторочка
      var fl = moving ? Math.sin(ph) * 1.4 : 0;
      g.beginPath();
      g.moveTo(-bodyW * 0.6, hipY - 2);
      g.lineTo(bodyW * 0.6, hipY - 2);
      g.lineTo(bodyW * 0.78 + fl, -h * 0.13);
      g.lineTo(-bodyW * 0.82 - wave * 0.3, -h * 0.13);
      g.closePath();
      g.strokeStyle = OUTLINE; g.lineWidth = 2; g.stroke();
      g.fillStyle = v.cloth; g.fill();
      g.fillStyle = v.fur;
      fillRound(g, -bodyW * 0.88 - wave * 0.3, -h * 0.15, bodyW * 1.7 + fl, 3, 1.5);
      g.strokeStyle = 'rgba(4,8,16,0.4)'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(bodyW * 0.14, shY + 3); g.lineTo(bodyW * 0.18, -h * 0.15); g.stroke();
      g.fillStyle = '#3a2718';
      g.fillRect(-bodyW * 0.6, hipY - 4.4, bodyW * 1.2, 3);
      g.fillStyle = v.main;
      g.fillRect(-1.6, hipY - 4.4, 3.2, 3);
    } else if (isS) {
      // кузнечный фартук
      g.beginPath();
      g.moveTo(-bodyW * 0.08, shY + 3);
      g.lineTo(bodyW * 0.62, shY + 3);
      g.lineTo(bodyW * 0.7, -h * 0.12);
      g.lineTo(-bodyW * 0.2, -h * 0.12);
      g.closePath();
      g.strokeStyle = OUTLINE; g.lineWidth = 1.6; g.stroke();
      g.fillStyle = v.apron; g.fill();
      g.fillStyle = 'rgba(255,220,180,0.18)';
      g.fillRect(bodyW * 0.42, shY + 4, 1.6, h * 0.4);
      g.strokeStyle = 'rgba(40,20,10,0.5)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(0, hipY + 1); g.lineTo(bodyW * 0.6, hipY + 1); g.stroke();
      g.strokeStyle = '#2a1c12'; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(bodyW * 0.1, shY + 3); g.lineTo(-bodyW * 0.3, shY - 1); g.stroke();
      // молот на поясе сзади
      g.save();
      g.translate(-bodyW * 0.62, hipY - 1);
      g.rotate(0.22 + wave * 0.01);
      g.fillStyle = OUTLINE; g.fillRect(-1.6, -1, 3.2, h * 0.24);
      g.fillStyle = '#6a4428'; g.fillRect(-0.9, -0.6, 1.8, h * 0.23);
      g.fillStyle = OUTLINE; fillRound(g, -4.4, h * 0.2, 8.8, 5.2, 1.2);
      g.fillStyle = '#9aa8bc'; fillRound(g, -3.6, h * 0.2 + 0.7, 7.2, 3.8, 1);
      g.restore();
    } else {
      // стёганый жилет + ремень с латунной пряжкой
      g.strokeStyle = 'rgba(4,8,16,0.35)'; g.lineWidth = 1.1;
      g.beginPath();
      g.moveTo(-bodyW * 0.28, shY + 3); g.lineTo(-bodyW * 0.22, hipY);
      g.moveTo(bodyW * 0.28, shY + 3); g.lineTo(bodyW * 0.22, hipY);
      g.stroke();
      g.fillStyle = '#3a2718';
      g.fillRect(-bodyW * 0.5, hipY - 4.2, bodyW, 3.4);
      g.fillStyle = v.brass;
      g.fillRect(-2.2, hipY - 4.6, 4.4, 4.2);
      // кольчужные наплечья
      g.fillStyle = v.mail;
      g.beginPath(); g.ellipse(-bodyW * 0.7, shY + 3.5, 4.2, 3, -0.2, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(bodyW * 0.7, shY + 3.5, 4.2, 3, 0.2, 0, TAU); g.fill();
    }
    if (isG) {
      // меховой ворот
      g.fillStyle = v.fur;
      g.beginPath(); g.ellipse(0, shY + 2, bodyW * 0.6, bodyW * 0.2, 0, 0, TAU); g.fill();
    }
    // rim-light по левому краю
    g.strokeStyle = 'rgba(190,235,255,0.2)'; g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(-bodyW * 0.64, shY + 5);
    g.quadraticCurveTo(-bodyW * 0.74, hipY * 0.55, -bodyW * 0.55, hipY);
    g.stroke();

    // ---- руки ----
    var armLen = h * 0.3;
    var shFrontX = bodyW * 0.56, shBackX = -bodyW * 0.54;
    var armSwing = moving ? Math.sin(ph + Math.PI) * h * 0.08 : Math.sin(t * 2 + v.num) * 1.1;
    limb(g, shBackX, shY + 4, shBackX - 3 + armSwing * 0.7, shY + armLen,
      shBackX - 4, shY + armLen * 0.5, v.armF, G.legW * 0.9, null);
    var handX = shFrontX + (moving ? Math.sin(ph) * h * 0.07 : 0);
    var handY = shY + armLen;
    if (atk && atk.kind === 'headbutt') { handX = shFrontX + 6; handY = shY + armLen * 0.66; }
    if (atk && atk.kind === 'sword') { handX = shFrontX + h * 0.15; handY = shY + armLen * 0.32; }
    if (stt === 'shoot') { handX = shFrontX + h * 0.14; handY = shY + armLen * 0.42; }
    if (stt === 'hook') { handX = shFrontX + 3; handY = shY - h * 0.06; }
    if (stt === 'act' && a.id === 'bjorn') { handX = shFrontX + 2; handY = shY + armLen * 0.46; }
    limb(g, shFrontX, shY + 4, handX, handY,
      shFrontX + 4, shY + armLen * 0.55, v.armN, G.legW * 0.9, 'rgba(255,255,255,0.14)');
    g.fillStyle = 'rgba(4,8,16,0.8)';
    g.beginPath(); g.arc(handX, handY, w * 0.088, 0, TAU); g.fill();
    g.fillStyle = v.hand;
    g.beginPath(); g.arc(handX, handY, w * 0.07, 0, TAU); g.fill();

    if (isS) {
      // медный наплечник
      var px = shFrontX + (atk && atk.kind === 'headbutt' ? 2 : 0), py = shY + 3;
      g.beginPath();
      g.ellipse(px, py, 5.6, 4, -0.2, Math.PI, TAU);
      g.lineTo(px + 5.4, py + 2.4); g.lineTo(px - 5.4, py + 2.4);
      g.closePath();
      g.strokeStyle = OUTLINE; g.lineWidth = 1.6; g.stroke();
      g.fillStyle = v.copper; g.fill();
      g.fillStyle = 'rgba(255,230,190,0.6)';
      g.fillRect(px - 3.6, py - 3, 6, 1.1);
      g.fillStyle = '#fff2b8';
      g.beginPath(); g.arc(px + 2.4, py - 0.4, 0.9, 0, TAU); g.fill();
    }

    // ---- оружие ----
    if (isG) {
      if (stt === 'shoot') drawBowA(g, handX, handY, a, v, t);
      else if (atk && atk.kind === 'sword') drawSwordA(g, handX, handY, a, v, t);
      else {
        // кузнечный молот в опущенной руке
        g.save();
        g.translate(handX, handY);
        g.rotate(0.45);
        g.strokeStyle = OUTLINE; g.lineWidth = 3.8; g.lineCap = 'round';
        g.beginPath(); g.moveTo(0, -2); g.lineTo(0, h * 0.26); g.stroke();
        g.strokeStyle = '#7a5232'; g.lineWidth = 2.2;
        g.beginPath(); g.moveTo(0, -2); g.lineTo(0, h * 0.26); g.stroke();
        g.fillStyle = OUTLINE; fillRound(g, -5.2, h * 0.24, 10.4, 6, 1.4);
        g.fillStyle = '#9aa8bc'; fillRound(g, -4.4, h * 0.24 + 0.8, 8.8, 4.4, 1.1);
        g.fillStyle = 'rgba(234,246,255,0.6)'; g.fillRect(-4, h * 0.24 + 1, 8, 1);
        g.restore();
      }
    }
    if (isS && atk && atk.kind === 'headbutt') {
      // удар плечом: искры и волна
      var pr = clamp(atk.t, 0, 1);
      g.strokeStyle = 'rgba(255,180,90,' + (0.75 * (1 - pr)) + ')';
      g.lineWidth = 2.2;
      for (var ar = 0; ar < 3; ar++) {
        g.beginPath();
        g.arc(bodyW * 0.2, shY + 2, h * (0.16 + ar * 0.09) * (0.6 + pr), -1.0, 1.0);
        g.stroke();
      }
      for (var sk = 0; sk < 5; sk++) {
        var sa = -0.9 + sk * 0.45, sr = h * (0.2 + pr * 0.3);
        glowAdd(g, shFrontX + Math.cos(sa) * sr, shY + 3 + Math.sin(sa) * sr, 3, sk % 2 ? '#ffd27a' : '#ff8a4d', 0.9 * (1 - pr));
      }
    }
    if (isB) drawShieldA(g, a, v, bodyW, shY, hipY, t);

    // ---- голова ----
    g.fillStyle = 'rgba(4,8,16,0.9)';
    g.beginPath(); g.arc(0, headY, headR + 1.4, 0, TAU); g.fill();
    g.fillStyle = v.skin;
    g.beginPath(); g.arc(0, headY, headR, 0, TAU); g.fill();
    g.fillStyle = 'rgba(70,40,20,0.16)';
    g.beginPath(); g.arc(-headR * 0.25, headY + headR * 0.22, headR * 0.86, 0, TAU); g.fill();
    g.fillStyle = v.skin;
    g.beginPath(); g.arc(headR * 0.1, headY - headR * 0.06, headR * 0.86, 0, TAU); g.fill();
    if (isB) {
      // короткая тёмная борода и косица с латунным кольцом
      g.fillStyle = v.hair;
      g.beginPath();
      g.moveTo(-headR * 0.8, headY + headR * 0.2);
      g.quadraticCurveTo(-headR * 0.6, headY + headR * 1.2, headR * 0.2, headY + headR * 1.15);
      g.quadraticCurveTo(headR * 0.9, headY + headR * 1.0, headR * 0.92, headY + headR * 0.2);
      g.quadraticCurveTo(headR * 0.2, headY + headR * 0.55, -headR * 0.8, headY + headR * 0.2);
      g.closePath(); g.fill();
      g.strokeStyle = v.hair; g.lineWidth = 2.4; g.lineCap = 'round';
      g.beginPath(); g.moveTo(headR * 0.25, headY + headR * 1.05); g.lineTo(headR * 0.3, headY + headR * 1.75); g.stroke();
      g.fillStyle = v.brass;
      g.fillRect(headR * 0.3 - 2, headY + headR * 1.65, 4, 2);
      g.fillStyle = 'rgba(255,240,220,0.4)';
      g.beginPath(); g.ellipse(-headR * 0.2, headY - headR * 0.72, headR * 0.4, headR * 0.16, -0.3, 0, TAU); g.fill();
    } else if (isS) {
      g.fillStyle = 'rgba(30,20,16,0.4)';
      g.beginPath(); g.ellipse(headR * 0.15, headY + headR * 0.3, headR * 0.22, headR * 0.1, -0.3, 0, TAU); g.fill();
    }
    // глаза
    g.fillStyle = '#0b0f1a';
    g.beginPath(); g.ellipse(headR * 0.34, headY - headR * 0.08, 1.35, 1.6, 0, 0, TAU); g.fill();
    g.beginPath(); g.ellipse(headR * 0.03, headY - headR * 0.08, 1.2, 1.5, 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.fillRect(headR * 0.36, headY - headR * 0.18, 0.9, 0.9);
    g.fillRect(headR * 0.05, headY - headR * 0.18, 0.8, 0.8);
    g.strokeStyle = 'rgba(40,26,16,0.8)'; g.lineWidth = 1.3; g.lineCap = 'round';
    g.beginPath();
    g.moveTo(headR * 0.14, headY - headR * 0.38);
    g.lineTo(headR * 0.58, headY - headR * 0.32);
    g.stroke();
    g.fillStyle = 'rgba(120,70,40,0.35)';
    g.beginPath(); g.ellipse(headR * 0.6, headY + headR * 0.16, 1.2, 1.5, 0, 0, TAU); g.fill();

    drawHeadgearA(g, a, v, G, headY, t);
  }

  /* головные уборы: капюшон / меховая шапка + шарф / кузнечные очки */
  function drawHeadgearA(g, a, v, G, headY, t) {
    var r = G.headR;
    var wv = Math.sin(t * 3.1 + v.num) * r * 0.08;
    if (a.id === 'snorri') {
      g.beginPath();
      g.moveTo(r * 0.95, headY - r * 0.3);
      g.quadraticCurveTo(r * 0.9, headY - r * 1.45, -r * 0.2, headY - r * 1.38);
      g.quadraticCurveTo(-r * 1.35, headY - r * 1.2, -r * 1.25, headY + r * 0.2);
      g.quadraticCurveTo(-r * 1.2, headY + r * 1.1, -r * 0.45, headY + r * 1.15);
      g.lineTo(-r * 0.3, headY + r * 0.55);
      g.quadraticCurveTo(-r * 0.75, headY - r * 0.2, -r * 0.3, headY - r * 0.66);
      g.quadraticCurveTo(r * 0.35, headY - r * 0.9, r * 0.95, headY - r * 0.3);
      g.closePath();
      g.strokeStyle = OUTLINE; g.lineWidth = 2; g.stroke();
      g.fillStyle = v.hood; g.fill();
      g.strokeStyle = v.hoodL; g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(r * 0.9, headY - r * 0.34);
      g.quadraticCurveTo(r * 0.35, headY - r * 0.9, -r * 0.3, headY - r * 0.66);
      g.stroke();
      g.strokeStyle = 'rgba(4,8,16,0.35)'; g.lineWidth = 0.9;
      g.beginPath(); g.moveTo(-r * 0.2, headY - r * 1.36); g.quadraticCurveTo(-r * 0.5, headY - r * 0.4, -r * 0.7, headY + r * 0.6); g.stroke();
      // пелерина
      g.fillStyle = v.hoodS;
      g.beginPath(); g.ellipse(-r * 0.35, headY + r * 1.5, r * 1.15, r * 0.34, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(4,8,16,0.5)'; g.lineWidth = 1; g.stroke();
    } else if (a.id === 'gunnar') {
      // шарф до носа и его хвост
      g.fillStyle = OUTLINE;
      fillRound(g, -r * 1.02, headY + r * 0.2, r * 2.04, r * 0.95, r * 0.4);
      g.fillStyle = v.scarf;
      fillRound(g, -r * 0.92, headY + r * 0.28, r * 1.84, r * 0.8, r * 0.35);
      g.beginPath();
      g.moveTo(-r * 0.8, headY + r * 0.6);
      g.quadraticCurveTo(-r * 1.6 - wv * 4, headY + r * 0.7, -r * 2.1 - wv * 6, headY + r * 1.5);
      g.lineTo(-r * 1.6 - wv * 4, headY + r * 1.6);
      g.quadraticCurveTo(-r * 1.2, headY + r * 1.1, -r * 0.7, headY + r * 1.0);
      g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.22)';
      g.fillRect(-r * 0.8, headY + r * 0.34, r * 1.6, r * 0.12);
      // меховая шапка
      g.beginPath();
      g.moveTo(-r * 1.15, headY - r * 0.25);
      g.lineTo(-r * 1.28, headY - r * 1.35);
      g.quadraticCurveTo(-r * 1.2, headY - r * 2.05, 0, headY - r * 2.02);
      g.quadraticCurveTo(r * 1.25, headY - r * 2.05, r * 1.3, headY - r * 1.35);
      g.lineTo(r * 1.15, headY - r * 0.25);
      g.closePath();
      g.strokeStyle = OUTLINE; g.lineWidth = 2.2; g.stroke();
      g.fillStyle = v.fur; g.fill();
      g.fillStyle = v.cloth;
      g.beginPath(); g.ellipse(0, headY - r * 1.88, r * 0.85, r * 0.22, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(90,80,60,0.45)'; g.lineWidth = 0.9;
      for (var fz = 0; fz < 5; fz++) {
        g.beginPath();
        g.moveTo(-r * 0.8 + fz * r * 0.4, headY - r * 1.7 + (fz % 2) * r * 0.15);
        g.lineTo(-r * 0.72 + fz * r * 0.4, headY - r * 1.15 + (fz % 2) * r * 0.15);
        g.stroke();
      }
      g.fillStyle = v.furL;
      fillRound(g, -r * 1.3, headY - r * 0.85, r * 2.6, r * 0.62, r * 0.3);
      g.fillStyle = v.fur;
      fillRound(g, -r * 1.22, headY - r * 0.4, r * 0.5, r * 1.0, r * 0.22);
      glowAdd(g, 0, headY - r * 1.9, r * 1.1, v.main, 0.25);
    } else {
      // кузнечные очки на лбу
      g.fillStyle = '#2a1c12';
      g.beginPath();
      g.moveTo(-r * 1.02, headY - r * 0.48); g.quadraticCurveTo(0, headY - r * 0.82, r * 1.02, headY - r * 0.48);
      g.lineTo(r * 1.02, headY - r * 0.26); g.quadraticCurveTo(0, headY - r * 0.6, -r * 1.02, headY - r * 0.26);
      g.closePath(); g.fill();
      var lens = [[r * 0.2, r * 0.36], [r * 0.82, r * 0.26]];
      for (var i = 0; i < 2; i++) {
        var lx = lens[i][0], lr = lens[i][1];
        g.fillStyle = OUTLINE;
        g.beginPath(); g.arc(lx, headY - r * 0.62, lr + 1.2, 0, TAU); g.fill();
        g.fillStyle = v.brass;
        g.beginPath(); g.arc(lx, headY - r * 0.62, lr, 0, TAU); g.fill();
        g.fillStyle = v.glass;
        g.beginPath(); g.arc(lx, headY - r * 0.62, lr * 0.62, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.85)';
        g.fillRect(lx - lr * 0.35, headY - r * 0.62 - lr * 0.35, 1, 1);
      }
      glowAdd(g, r * 0.2, headY - r * 0.62, r * 0.9, v.glass, 0.3);
    }
  }

  /* щит Опоры: большой круглый кузнечный круг — сталь, латунный обод, кольцо заклёпок */
  function drawShieldA(g, a, v, bodyW, shY, hipY, t) {
    var up = !!a.shieldUp;
    var R = (a.w || 24) * 0.48;
    var cx, cy;
    if (up) { cx = 2; cy = shY - (a.h || 44) * 0.22; }
    else { cx = bodyW * 0.78; cy = shY + (a.h || 44) * 0.3; }
    if (up) {
      var py = -(a.h || 44) - 8;
      g.save();
      g.globalCompositeOperation = 'lighter';
      glow(g, 0, py, 36, C.gold, 0.3);
      g.restore();
      g.fillStyle = 'rgba(255,200,87,0.4)';
      fillRound(g, -21, py - 2.5, 42, 5.5, 2);
      g.fillStyle = 'rgba(255,242,200,0.85)';
      fillRound(g, -19, py - 1.2, 38, 2, 1);
      g.strokeStyle = 'rgba(255,200,87,0.25)'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(-10, cy - R * 0.6); g.lineTo(-12, py); g.moveTo(10, cy - R * 0.6); g.lineTo(12, py); g.stroke();
    }
    g.fillStyle = 'rgba(4,8,16,0.85)';
    g.beginPath(); g.arc(cx, cy, R + 1.6, 0, TAU); g.fill();
    g.fillStyle = v.brass;
    g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill();
    var sg = g.createLinearGradient(cx - R, cy - R, cx + R * 0.6, cy + R);
    sg.addColorStop(0, '#eef3f8');
    sg.addColorStop(0.45, up ? '#c6d0dc' : '#aab4c2');
    sg.addColorStop(1, '#4e5866');
    g.fillStyle = sg;
    g.beginPath(); g.arc(cx, cy, R * 0.84, 0, TAU); g.fill();
    // кольцо заклёпок
    g.fillStyle = '#ffe9a8';
    for (var i = 0; i < 10; i++) {
      var ang = i / 10 * TAU + 0.2;
      g.beginPath(); g.arc(cx + Math.cos(ang) * R * 0.66, cy + Math.sin(ang) * R * 0.66, 0.95, 0, TAU); g.fill();
    }
    // следы молота
    g.strokeStyle = 'rgba(40,50,64,0.35)'; g.lineWidth = 0.9;
    g.beginPath(); g.arc(cx + R * 0.15, cy + R * 0.1, R * 0.42, 0.4, 2.2); g.stroke();
    // умбон
    g.fillStyle = '#3e4652';
    g.beginPath(); g.arc(cx, cy, R * 0.26, 0, TAU); g.fill();
    g.fillStyle = v.brass;
    g.beginPath(); g.arc(cx - R * 0.06, cy - R * 0.06, R * 0.13, 0, TAU); g.fill();
    if (up) glowAdd(g, cx, cy + R * 0.4, R * 2.4, C.gold, 0.16 + 0.06 * Math.sin(t * 4));
  }

  /* удар вплотную Стрелка: кузнечный молот (способность 'sword' — прежний идентификатор) */
  function drawSwordA(g, handX, handY, a, v, t) {
    var atk = a.attack || { t: 0 };
    var p = clamp(atk.t, 0, 1);
    var ang = lerp(-1.5, 0.95, p * p);
    var len = (a.h || 46) * 0.62;
    g.save();
    g.translate(handX, handY);
    g.rotate(ang);
    g.strokeStyle = OUTLINE; g.lineWidth = 4.4; g.lineCap = 'round';
    g.beginPath(); g.moveTo(0, 4); g.lineTo(0, -len); g.stroke();
    g.strokeStyle = '#7a5232'; g.lineWidth = 2.6;
    g.beginPath(); g.moveTo(0, 4); g.lineTo(0, -len); g.stroke();
    g.fillStyle = OUTLINE; fillRound(g, -6.6, -len - 6, 13.2, 8.4, 1.8);
    g.fillStyle = '#b4c2d4'; fillRound(g, -5.8, -len - 5.2, 11.6, 6.8, 1.4);
    g.fillStyle = 'rgba(234,246,255,0.8)'; g.fillRect(-5, -len - 4.6, 10, 1.3);
    g.fillStyle = v.main; g.fillRect(-1.6, -len + 1.6, 3.2, 2.2);
    g.restore();
    if (p > 0.15 && p < 0.85) {
      var al = 1 - Math.abs(p - 0.5) * 2;
      g.strokeStyle = 'rgba(255,170,80,' + (0.8 * al) + ')';
      g.lineWidth = 4.5 * al + 1;
      g.lineCap = 'round';
      g.beginPath();
      g.arc(handX, handY, len * 0.95, -2.2 + p * 2.6, -0.5 + p * 2.6);
      g.stroke();
      g.strokeStyle = 'rgba(234,246,255,' + (0.55 * al) + ')';
      g.lineWidth = 1.6;
      g.beginPath();
      g.arc(handX, handY, len * 0.95, -2.2 + p * 2.6, -0.5 + p * 2.6);
      g.stroke();
    }
  }

  /* выстрел Стрелка: арбалет (способность 'bow' — прежний идентификатор) */
  function drawBowA(g, handX, handY, a, v, t) {
    var aimUp = !!a.aimUp;
    var h = a.h || 46;
    g.save();
    g.translate(handX, handY);
    if (aimUp) g.rotate(-Math.PI * 0.5);
    // ложе
    g.fillStyle = OUTLINE; fillRound(g, -h * 0.2, -2.6, h * 0.5, 5.2, 1.6);
    g.fillStyle = v.wood; fillRound(g, -h * 0.19, -1.8, h * 0.48, 3.6, 1.2);
    g.fillStyle = 'rgba(255,220,160,0.35)'; g.fillRect(-h * 0.17, -1.6, h * 0.44, 0.9);
    // стальная дуга поперёк
    var bx = h * 0.26;
    g.strokeStyle = OUTLINE; g.lineWidth = 4; g.lineCap = 'round';
    g.beginPath(); g.moveTo(bx - h * 0.05, -h * 0.22); g.quadraticCurveTo(bx + h * 0.06, 0, bx - h * 0.05, h * 0.22); g.stroke();
    g.strokeStyle = '#c3d4e8'; g.lineWidth = 2.3;
    g.beginPath(); g.moveTo(bx - h * 0.05, -h * 0.22); g.quadraticCurveTo(bx + h * 0.06, 0, bx - h * 0.05, h * 0.22); g.stroke();
    g.strokeStyle = 'rgba(234,246,255,0.8)'; g.lineWidth = 0.9;
    g.beginPath(); g.moveTo(bx - h * 0.05, -h * 0.22); g.lineTo(h * 0.02, 0); g.lineTo(bx - h * 0.05, h * 0.22); g.stroke();
    // болт
    g.fillStyle = '#cfe0f2';
    g.fillRect(h * 0.02, -1, h * 0.46, 2);
    g.fillStyle = '#e8f6ff';
    g.beginPath(); g.moveTo(h * 0.46, -3.2); g.lineTo(h * 0.58, 0); g.lineTo(h * 0.46, 3.2); g.closePath(); g.fill();
    g.fillStyle = C.gold;
    g.fillRect(-h * 0.04, -2.6, 3.4, 5.2);
    g.restore();
  }

  function drawHookLine(g, a, t) {
    var hk = a.hook;
    if (!hk) return;
    var h = a.h || 46;
    var ax = (typeof hk.ax === 'number') ? hk.ax : a.x;
    var ay = (typeof hk.ay === 'number') ? hk.ay : a.y - h * 0.85;
    var bx = (typeof hk.bx === 'number') ? hk.bx : a.x;
    var by = (typeof hk.by === 'number') ? hk.by : a.y - h * 2;
    var sag = 4 + Math.min(18, Math.abs(by - ay) * 0.05);
    g.save();
    g.strokeStyle = 'rgba(4,8,16,0.55)';
    g.lineWidth = 3.2;
    g.beginPath();
    g.moveTo(ax, ay);
    g.quadraticCurveTo((ax + bx) / 2 + 3, (ay + by) / 2 + sag, bx, by);
    g.stroke();
    g.strokeStyle = 'rgba(255,61,139,0.92)';
    g.lineWidth = 1.7;
    g.beginPath();
    g.moveTo(ax, ay);
    g.quadraticCurveTo((ax + bx) / 2 + 3, (ay + by) / 2 + sag, bx, by);
    g.stroke();
    g.strokeStyle = 'rgba(234,246,255,0.45)';
    g.lineWidth = 0.7;
    g.beginPath();
    g.moveTo(ax, ay);
    g.quadraticCurveTo((ax + bx) / 2 + 3, (ay + by) / 2 + sag, bx, by);
    g.stroke();
    var ang = Math.atan2(by - ay, bx - ax);
    g.save();
    g.translate(bx, by);
    g.rotate(ang);
    g.strokeStyle = OUTLINE; g.lineWidth = 4;
    g.beginPath();
    g.moveTo(0, 0); g.lineTo(-7, -6); g.moveTo(0, 0); g.lineTo(-7, 6);
    g.stroke();
    g.strokeStyle = '#d5dfee'; g.lineWidth = 2.1;
    g.beginPath();
    g.moveTo(0, 0); g.lineTo(-7, -6); g.moveTo(0, 0); g.lineTo(-7, 6);
    g.stroke();
    g.restore();
    glowAdd(g, bx, by, 18, C.magenta, 0.5);
    if (hk.state === 'attached') glowAdd(g, bx, by, 30, C.aurora, 0.18 + 0.1 * Math.sin(t * 8));
    g.restore();
  }

  function drawVikingA(g, a, t) {
    var v = VIK[a.id] || VIK.snorri;
    var h = a.h || 44;
    if (a.exited && a.state !== 'exit') return;
    var dead = a.dead || a.state === 'dead';
    var active = !!a.active;

    if (!dead) {
      g.fillStyle = 'rgba(0,0,0,0.38)';
      g.beginPath();
      g.ellipse(a.x, a.y - 1, a.w * 0.6, a.w * 0.21, 0, 0, TAU);
      g.fill();
      g.fillStyle = 'rgba(0,0,0,0.18)';
      g.beginPath();
      g.ellipse(a.x, a.y - 1, a.w * 0.86, a.w * 0.28, 0, 0, TAU);
      g.fill();
    }

    if (active) drawActiveMarker(g, a, t, v);
    else if (!a.exited && !dead) drawHoloMarker(g, a, t, v);

    if (active || dead || a.exited || a.state === 'exit') {
      g.save();
      var alpha = 1;
      if (a.exited || a.state === 'exit') alpha = 0.35 + 0.25 * Math.abs(Math.sin(t * 3));
      if (a.invuln > 0 && !dead) alpha *= 0.45 + 0.55 * Math.abs(Math.sin(t * 22));
      g.globalAlpha = alpha;
      g.translate(a.x, a.y);
      if (a.dir < 0) g.scale(-1, 1);
      if (dead) {
        g.rotate(-Math.PI * 0.5);
        g.translate(0, -a.w * 0.1);
        g.globalAlpha = 0.6;
        drawVikingBodyA(g, { id: a.id, w: a.w, h: a.h, state: 'idle', anim: 0, dir: 1, attack: null }, v, t);
      } else {
        drawVikingBodyA(g, a, v, t);
      }
      g.restore();
    }

    if (a.hook) drawHookLine(g, a, t);
  }

  /* ================= ВИКИНГИ RETRO ================= */

  function drawVikingR(g, a, t) {
    var v = VIK[a.id] || VIK.snorri;
    var idx = (R8VIK[a.id] !== undefined) ? R8VIK[a.id] : 3;
    var col = R8[idx];
    var H = Math.round((a.h || 44) / 2) * 2;
    var W2 = Math.round((a.w || 24) / 2) * 2;
    if (a.exited && a.state !== 'exit') return;
    var dead = a.dead || a.state === 'dead';
    var stt = a.state || 'idle';
    var anim = a.anim || 0;
    var ph = anim * 8;
    var moving = stt === 'run';
    function e(v2) { return Math.round(v2 / 2) * 2; }

    g.save();
    g.translate(q(a.x), q(a.y));
    if ((a.dir || 1) < 0) g.scale(-1, 1);
    g.globalAlpha = 1;
    if (dead) { g.globalAlpha = 0.6; }

    var hw = e(W2 / 2);
    // тень
    if (!dead) { g.fillStyle = R8[0]; g.fillRect(-hw, 0, hw * 2, 2); }
    // тело — пиксель-арт викинга из саги 1 (SAGA2VIK); 1 арт-пиксель = 2 мировых px
    g.scale(2, 2);
    if (dead) SAGA2VIK.drawDead(g, a.id, a.active);
    else SAGA2VIK.drawChar(g, a.id, SAGA2VIK.mapState(a), anim, t, a.active);
    g.restore();
    if (a.active && !dead) { g.fillStyle = R8[4]; g.fillRect(q(a.x) - 2, q(a.y) - (a.h || 44) - 12, 4, 2); }

    // маркер неактивного
    if (!a.active && !dead) {
      g.save();
      g.globalAlpha = 0.65;
      var my = q(a.y) - H - 12;
      g.fillStyle = R8[1];
      g.fillRect(q(a.x) - 6, my - 6, 12, 10);
      g.fillStyle = R8[3];
      g.font = '12px monospace';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(String(v.num), q(a.x), my - 1);
      g.restore();
    }
    // крюк
    if (a.hook) {
      var hk = a.hook;
      var ax = (typeof hk.ax === 'number') ? hk.ax : a.x;
      var ay = (typeof hk.ay === 'number') ? hk.ay : a.y - (a.h || 44) * 0.85;
      var bx = (typeof hk.bx === 'number') ? hk.bx : a.x;
      var by = (typeof hk.by === 'number') ? hk.by : a.y - (a.h || 44) * 2;
      g.strokeStyle = R8[13]; g.lineWidth = 2;
      g.beginPath(); g.moveTo(q(ax), q(ay)); g.lineTo(q(bx), q(by)); g.stroke();
      g.fillStyle = R8[4];
      g.fillRect(q(bx) - 2, q(by) - 2, 4, 4);
    }
  }

  /* ================= ВРАГИ ================= */

  function enemyShadow(g, e) {
    g.fillStyle = 'rgba(0,0,0,0.32)';
    g.beginPath();
    g.ellipse(e.x, e.y - 1, (e.w || 24) * 0.6, (e.w || 24) * 0.2, 0, 0, TAU);
    g.fill();
  }

  function drawGruntA(g, e, t) {
    var h = e.h || 28, w = e.w || 24, ph = (e.anim || 0) * 13;
    var mov = e.state === 'walk' || e.state === 'run';
    var step = mov ? Math.sin(ph) : 0;
    enemyShadow(g, e);
    g.save();
    g.translate(e.x, e.y);
    if ((e.dir || 1) < 0) g.scale(-1, 1);
    var bob = mov ? Math.abs(Math.cos(ph)) * 1.4 : Math.sin(t * 2 + e.x * 0.01) * 0.6;
    g.strokeStyle = '#243a2e'; g.lineWidth = w * 0.18; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-w * 0.14, -h * 0.34); g.lineTo(-w * 0.2 + step * 4, 0); g.stroke();
    g.beginPath(); g.moveTo(w * 0.14, -h * 0.34); g.lineTo(w * 0.2 - step * 4, 0); g.stroke();
    g.fillStyle = '#2f4a3a';
    g.beginPath();
    g.ellipse(0, -h * 0.52 - bob, w * 0.42, h * 0.26, 0, 0, TAU);
    g.fill();
    g.fillStyle = 'rgba(184,217,106,0.16)';
    g.beginPath();
    g.ellipse(-w * 0.1, -h * 0.62 - bob, w * 0.26, h * 0.15, -0.3, 0, TAU);
    g.fill();
    g.strokeStyle = '#5c7a72'; g.lineWidth = w * 0.14;
    g.beginPath();
    g.moveTo(-w * 0.36, -h * 0.6 - bob);
    g.lineTo(-w * 0.46, -h * 0.34 + step * 3);
    g.stroke();
    g.beginPath();
    g.moveTo(w * 0.36, -h * 0.6 - bob);
    g.lineTo(w * 0.46, -h * 0.36 - step * 3);
    g.stroke();
    var hy = -h * 0.86 - bob;
    g.fillStyle = '#6b8a8a';
    g.beginPath(); g.ellipse(0, hy, w * 0.3, h * 0.17, 0, 0, TAU); g.fill();
    g.fillStyle = '#547070';
    g.beginPath();
    g.moveTo(-w * 0.24, hy); g.lineTo(-w * 0.48, hy - h * 0.1); g.lineTo(-w * 0.22, hy + h * 0.06);
    g.closePath(); g.fill();
    g.fillStyle = '#ff3d8b';
    g.beginPath(); g.arc(w * 0.1, hy - 1, 1.5, 0, TAU); g.fill();
    g.beginPath(); g.arc(w * 0.22, hy - 1, 1.3, 0, TAU); g.fill();
    glowAdd(g, w * 0.16, hy - 1, 7, C.magenta, 0.4);
    g.fillStyle = '#eaf6ff';
    g.beginPath();
    g.moveTo(w * 0.06, hy + h * 0.09); g.lineTo(w * 0.09, hy + h * 0.16); g.lineTo(w * 0.12, hy + h * 0.09);
    g.closePath(); g.fill();
    g.restore();
  }

  function drawThrowerA(g, e, t) {
    var h = e.h || 40, w = e.w || 26, ph = (e.anim || 0) * 10;
    var mov = e.state === 'walk';
    var throwPh = e.state === 'throw' ? clamp((e.anim || 0) * 2.5, 0, 1) : 0;
    enemyShadow(g, e);
    g.save();
    g.translate(e.x, e.y);
    if ((e.dir || 1) < 0) g.scale(-1, 1);
    var bob = mov ? Math.abs(Math.cos(ph)) * 1.6 : Math.sin(t * 1.8 + e.x * 0.01) * 0.8;
    g.strokeStyle = '#2a1f36'; g.lineWidth = w * 0.19; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-w * 0.12, -h * 0.38); g.lineTo(-w * 0.2 + (mov ? Math.sin(ph) * 5 : 0), 0); g.stroke();
    g.beginPath(); g.moveTo(w * 0.12, -h * 0.38); g.lineTo(w * 0.2 - (mov ? Math.sin(ph) * 5 : 0), 0); g.stroke();
    g.fillStyle = '#3a2a4a';
    g.beginPath();
    g.moveTo(-w * 0.44, -h * 0.62 - bob);
    g.quadraticCurveTo(-w * 0.56, -h * 0.2, -w * 0.34, 0);
    g.lineTo(w * 0.34, 0);
    g.quadraticCurveTo(w * 0.56, -h * 0.2, w * 0.44, -h * 0.62 - bob);
    g.closePath(); g.fill();
    g.fillStyle = 'rgba(139,92,246,0.25)';
    g.beginPath();
    g.moveTo(-w * 0.12, -h * 0.6 - bob); g.lineTo(w * 0.1, -h * 0.6 - bob);
    g.lineTo(w * 0.06, 0); g.lineTo(-w * 0.08, 0); g.closePath(); g.fill();
    var hy = -h * 0.85 - bob;
    g.fillStyle = '#241a33';
    g.beginPath(); g.arc(0, hy, w * 0.3, Math.PI * 0.9, Math.PI * 2.1); g.fill();
    g.fillRect(-w * 0.3, hy, w * 0.6, h * 0.1);
    g.fillStyle = '#0b0f1a';
    g.beginPath(); g.arc(w * 0.05, hy + h * 0.03, w * 0.2, 0, TAU); g.fill();
    g.fillStyle = '#ffc857';
    g.beginPath(); g.arc(w * 0.04, hy + h * 0.02, 1.6, 0, TAU); g.fill();
    g.beginPath(); g.arc(w * 0.16, hy + h * 0.02, 1.4, 0, TAU); g.fill();
    glowAdd(g, w * 0.1, hy, 9, C.gold, 0.35);
    var armAng = -0.4 - throwPh * 2.2;
    g.save();
    g.translate(w * 0.4, -h * 0.62 - bob);
    g.rotate(armAng);
    g.strokeStyle = '#3a2a4a'; g.lineWidth = w * 0.16; g.lineCap = 'round';
    g.beginPath(); g.moveTo(0, 0); g.lineTo(w * 0.5, 0); g.stroke();
    g.fillStyle = '#5c5470';
    g.beginPath(); g.arc(w * 0.56, 0, w * 0.15, 0, TAU); g.fill();
    g.fillStyle = 'rgba(234,246,255,0.25)';
    g.beginPath(); g.arc(w * 0.52, -w * 0.05, w * 0.06, 0, TAU); g.fill();
    g.restore();
    g.restore();
  }

  function drawBatA(g, e, t) {
    var w = e.w || 26, h = e.h || 18;
    var flap = Math.sin((e.anim || 0) * 16 + e.x * 0.01);
    var bob = Math.sin(t * 3 + e.x * 0.02) * 3;
    g.save();
    g.translate(e.x, e.y - h * 0.5 + bob);
    if ((e.dir || 1) < 0) g.scale(-1, 1);
    g.fillStyle = '#3a1a3a';
    g.beginPath();
    g.moveTo(-2, 0);
    g.quadraticCurveTo(-w * 0.5, -6 - flap * 8, -w * 0.85, 2 - flap * 12);
    g.quadraticCurveTo(-w * 0.45, 4 + flap * 2, -2, 4);
    g.closePath(); g.fill();
    g.beginPath();
    g.moveTo(2, 0);
    g.quadraticCurveTo(w * 0.5, -6 - flap * 8, w * 0.85, 2 - flap * 12);
    g.quadraticCurveTo(w * 0.45, 4 + flap * 2, 2, 4);
    g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,61,139,0.4)'; g.lineWidth = 0.9;
    g.beginPath();
    g.moveTo(-2, 1); g.lineTo(-w * 0.5, 1 - flap * 5); g.moveTo(-2, 2); g.lineTo(-w * 0.32, 2);
    g.moveTo(2, 1); g.lineTo(w * 0.5, 1 - flap * 5); g.moveTo(2, 2); g.lineTo(w * 0.32, 2);
    g.stroke();
    g.fillStyle = '#4a1f44';
    g.beginPath(); g.ellipse(0, 2, w * 0.16, h * 0.34, 0, 0, TAU); g.fill();
    g.fillStyle = '#2a1030';
    g.beginPath(); g.arc(0, -2, w * 0.16, 0, TAU); g.fill();
    g.beginPath(); g.moveTo(-3, -3); g.lineTo(-4, -10); g.lineTo(0, -4); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(3, -3); g.lineTo(4, -10); g.lineTo(0, -4); g.closePath(); g.fill();
    g.fillStyle = '#ff3d8b';
    g.fillRect(0, -3, 1.8, 1.8); g.fillRect(2.4, -3, 1.8, 1.8);
    glowAdd(g, 2, -2, 12, C.magenta, 0.45);
    g.restore();
  }

  function drawEnemiesA(g, world, t) {
    var arr = world.enemies || [], i, e;
    for (i = 0; i < arr.length; i++) {
      e = arr[i];
      if (!e || e.active === false) continue;
      if (e.x < st.cam.x - 90 || e.x > st.cam.x + VW + 90) continue;
      if (e.y < st.cam.y - 90 || e.y > st.cam.y + VH + 140) continue;
      g.globalAlpha = (e.state === 'die' || e.hp === 0) ? 0.35 : 1;
      if (e.kind === 'thrower') drawThrowerA(g, e, t);
      else if (e.kind === 'bat') drawBatA(g, e, t);
      else drawGruntA(g, e, t);
      g.globalAlpha = 1;
    }
  }

  function drawEnemiesR(g, world, t) {
    var arr = world.enemies || [], i, e;
    for (i = 0; i < arr.length; i++) {
      e = arr[i];
      if (!e || e.active === false) continue;
      if (e.x < st.cam.x - 60 || e.x > st.cam.x + VW + 60) continue;
      var w = e.w || 24, h = e.h || 28;
      var ex = q(e.x), ey = q(e.y);
      var step = Math.sin((e.anim || 0) * 10) > 0 ? 2 : 0;
      if (e.kind === 'bat') {
        var flap = Math.sin((e.anim || 0) * 16) > 0;
        g.fillStyle = R8[11];
        g.fillRect(ex - w / 2, ey - h - (flap ? 4 : 0), w, 4);
        g.fillRect(ex - w / 2 - 4, ey - h - (flap ? 8 : 2), 4, 4);
        g.fillRect(ex + w / 2, ey - h - (flap ? 8 : 2), 4, 4);
        g.fillStyle = R8[12];
        g.fillRect(ex - 4, ey - h + 2, 8, 6);
        g.fillStyle = R8[13];
        g.fillRect(ex - 2, ey - h + 2, 2, 2); g.fillRect(ex + 2, ey - h + 2, 2, 2);
        continue;
      }
      g.fillStyle = e.kind === 'thrower' ? R8[11] : R8[5];
      g.fillRect(ex - w / 4, ey - h * 0.6, w / 2, h * 0.6);
      g.fillStyle = R8[2];
      g.fillRect(ex - w / 4 - 2, ey - h * 0.42, 4, h * 0.42 - step);
      g.fillRect(ex + w / 4 - 2, ey - h * 0.42, 4, h * 0.42 - (2 - step));
      g.fillStyle = e.kind === 'thrower' ? R8[12] : R8[6];
      g.fillRect(ex - w / 4 - 2, ey - h, w / 2 + 4, 6);
      g.fillStyle = R8[13];
      g.fillRect(ex - 2, ey - h + 2, 2, 2); g.fillRect(ex + 2, ey - h + 2, 2, 2);
      if (e.kind === 'thrower') {
        g.fillStyle = R8[1];
        g.fillRect(ex - w / 4 - 2, ey - h * 0.9, w / 2 + 4, 4);
        g.fillStyle = R8[10];
        g.fillRect(ex + w / 4, ey - h * 0.8, 4, 4);
      }
    }
  }

  /* ================= СНАРЯДЫ ================= */

  function drawProjectilesA(g, world) {
    var arr = world.projectiles || world.arrows || [], i, p;
    for (i = 0; i < arr.length; i++) {
      p = arr[i];
      if (!p || p.x === undefined) continue;
      var ang = Math.atan2(p.vy || 0, p.vx || 0);
      if (!p.vx && !p.vy) ang = (p.dir || 1) > 0 ? 0 : Math.PI;
      g.save();
      g.translate(p.x, p.y);
      g.rotate(ang);
      if (p.kind === 'shot') {
        // вражеский энергосгусток
        g.globalCompositeOperation = 'lighter';
        glow(g, 0, 0, 12, C.magenta, 0.55);
        g.globalCompositeOperation = 'source-over';
        g.fillStyle = '#ffd0e2';
        g.beginPath(); g.ellipse(0, 0, 4.4, 3, 0, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,61,139,0.55)';
        g.beginPath(); g.ellipse(-7, 0, 7, 2.2, 0, 0, TAU); g.fill();
      } else if (p.kind === 'rock' || p.kind === 'boulder') {
        g.fillStyle = '#5c5470';
        g.beginPath(); g.arc(0, 0, 5, 0, TAU); g.fill();
        g.fillStyle = 'rgba(234,246,255,0.25)';
        g.beginPath(); g.arc(-1.5, -1.5, 2, 0, TAU); g.fill();
      } else if (p.kind === 'spear') {
        g.fillStyle = '#8a6a3a';
        g.fillRect(-16, -1.4, 22, 2.8);
        g.fillStyle = '#d9f2ff';
        g.beginPath(); g.moveTo(6, -3.4); g.lineTo(14, 0); g.lineTo(6, 3.4); g.closePath(); g.fill();
      } else {
        g.fillStyle = '#cfe0f2';
        g.fillRect(-12, -1, 20, 2);
        g.fillStyle = '#d9f2ff';
        g.beginPath(); g.moveTo(8, -3); g.lineTo(14, 0); g.lineTo(8, 3); g.closePath(); g.fill();
        g.fillStyle = C.gold;
        g.fillRect(-12, -2.6, 3, 5.2);
        g.globalCompositeOperation = 'lighter';
        g.fillStyle = 'rgba(255,200,87,0.22)';
        g.fillRect(-26, -1, 16, 2);
      }
      g.restore();
      glowAdd(g, p.x, p.y, 14, C.gold, 0.18);
    }
  }

  function drawProjectilesR(g, world) {
    var arr = world.projectiles || world.arrows || [], i, p;
    for (i = 0; i < arr.length; i++) {
      p = arr[i];
      if (!p || p.x === undefined) continue;
      g.fillStyle = p.kind === 'rock' ? R8[2] : R8[14];
      g.fillRect(q(p.x) - 4, q(p.y) - 2, 8, 4);
      g.fillStyle = p.kind === 'rock' ? R8[3] : R8[10];
      g.fillRect(q(p.x) + 2, q(p.y) - 2, 4, 4);
    }
  }

  /* ================= ЧАСТИЦЫ ================= */

  function updateFx(dt) {
    var i, f, o;
    for (i = 0; i < st.fx.length; i++) {
      f = st.fx[i];
      if (f.life <= 0) continue;
      f.life -= dt;
      if (f.life <= 0) continue;
      f.vy += f.grav * dt;
      f.vx -= f.vx * f.drag * dt;
      f.vy -= f.vy * f.drag * dt * 0.4;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.rot += f.vr * dt;
    }
    for (i = 0; i < st.rings.length; i++) {
      o = st.rings[i];
      if (o.life > 0) o.life -= dt;
    }
    for (i = 0; i < st.floats.length; i++) {
      o = st.floats[i];
      if (o.life > 0) { o.life -= dt; o.y -= 34 * dt; }
    }
  }

  function drawFxA(g) {
    var i, f, k, r, o;
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (i = 0; i < st.fx.length; i++) {
      f = st.fx[i];
      if (f.life <= 0) continue;
      k = f.life / f.max;
      r = f.size * (0.3 + k * 0.9);
      g.globalAlpha = clamp(k * 1.6, 0, 1) * 0.9;
      if (f.kind === 1) {
        g.save();
        g.translate(f.x, f.y);
        g.rotate(f.rot);
        g.fillStyle = f.color;
        g.fillRect(-r, -r * 0.35, r * 2, r * 0.7);
        g.restore();
      } else {
        g.fillStyle = f.color;
        g.beginPath(); g.arc(f.x, f.y, r, 0, TAU); g.fill();
        if (r > 2) {
          g.globalAlpha *= 0.4;
          var s = glowSprite(f.color);
          g.drawImage(s, f.x - r * 3, f.y - r * 3, r * 6, r * 6);
        }
      }
    }
    g.globalAlpha = 1;
    for (i = 0; i < st.rings.length; i++) {
      o = st.rings[i];
      if (o.life <= 0) continue;
      k = o.life / o.max;
      var rr = o.r * (0.4 + (1 - k) * 1.9);
      g.globalAlpha = k * 0.85 * o.power;
      g.strokeStyle = o.color;
      g.lineWidth = 1 + k * 2.4;
      g.beginPath(); g.arc(o.x, o.y, rr, 0, TAU); g.stroke();
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    for (i = 0; i < st.floats.length; i++) {
      o = st.floats[i];
      if (o.life <= 0) continue;
      k = o.life / o.max;
      g.globalAlpha = clamp(k * 2, 0, 1);
      g.font = 'bold 15px "Inter","SF Pro Display",-apple-system,"Segoe UI",Roboto,sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = 'rgba(3,5,12,0.7)';
      g.fillText(o.text, o.x + 1, o.y + 1);
      g.fillStyle = o.color;
      g.fillText(o.text, o.x, o.y);
    }
    g.globalAlpha = 1;
    g.restore();
  }

  function drawFxR(g) {
    var i, f, k, o;
    for (i = 0; i < st.fx.length; i++) {
      f = st.fx[i];
      if (f.life <= 0) continue;
      k = f.life / f.max;
      var sz = f.size > 2 ? 4 : 2;
      var col = f.color === C.magenta ? R8[13] : f.color === C.gold ? R8[10] : f.color === C.aurora ? R8[6] : R8[4];
      g.fillStyle = col;
      g.fillRect(q(f.x) - sz / 2, q(f.y) - sz / 2, sz, sz);
    }
    for (i = 0; i < st.rings.length; i++) {
      o = st.rings[i];
      if (o.life <= 0) continue;
      k = o.life / o.max;
      g.strokeStyle = o.color === C.gold ? R8[10] : R8[4];
      g.lineWidth = k > 0.5 ? 2 : 1;
      g.beginPath();
      g.arc(q(o.x), q(o.y), Math.round(o.r * (0.4 + (1 - k) * 1.9)), 0, TAU);
      g.stroke();
    }
    for (i = 0; i < st.floats.length; i++) {
      o = st.floats[i];
      if (o.life <= 0) continue;
      g.globalAlpha = clamp(o.life / o.max * 2, 0, 1);
      g.fillStyle = R8[10];
      g.font = '12px monospace';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(o.text, q(o.x), q(o.y));
      g.globalAlpha = 1;
    }
  }

  /* ================= ГЕЙН / ФИЛЬТРЫ ================= */

  function buildGrain() {
    var n = 96, c = mkCanvas(n, n), g = c.getContext('2d');
    var img = g.createImageData(n, n), d = img.data, i;
    for (i = 0; i < d.length; i += 4) {
      var v = 120 + Math.random() * 135;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 26;
    }
    g.putImageData(img, 0, 0);
    return c;
  }
  function drawGrain(g) {
    if (!st.grain) { st.grain = buildGrain(); st.grainPat = null; }
    if (!st.grainPat) st.grainPat = g.createPattern(st.grain, 'repeat');
    if (!st.grainPat) return;
    g.save();
    g.globalCompositeOperation = 'overlay';
    g.globalAlpha = 0.5;
    g.fillStyle = st.grainPat;
    g.fillRect(0, 0, st.sceneW, st.sceneH);
    g.restore();
  }

  function drawRetroVignette(g) {
    // пиксельная виньетка-дизеринг по краям кадра (512×288)
    var W = 512, H = 288, step = 8;
    g.fillStyle = R8[15];
    for (var y = 0; y < H; y += step) {
      for (var x = 0; x < W; x += step) {
        var dx = Math.abs(x + step / 2 - W / 2) / (W / 2);
        var dy = Math.abs(y + step / 2 - H / 2) / (H / 2);
        var d = Math.max(dx * dx, dy * dy) * 0.9 + (dx + dy) * 0.1;
        var b = BAYER4[(y / step) & 3][(x / step) & 3] / 16;
        if (d > 0.72 + b * 0.22) {
          g.globalAlpha = 0.55;
          g.fillRect(x, y, step, step);
        } else if (d > 0.6 + b * 0.2) {
          g.globalAlpha = 0.3;
          g.fillRect(x, y, step, step);
        }
      }
    }
    g.globalAlpha = 1;
  }

  /* ================= ОРКЕСТРАЦИЯ ================= */

  function actorCull(a) {
    return !(a.x < st.cam.x - 120 || a.x > st.cam.x + VW + 120 || a.y < st.cam.y - 140);
  }

  function renderAurora(world, game, dt) {
    var g = st.sctx;
    var S = st.sceneScale;
    var camX = st.cam.x + st.shakeX, camY = st.cam.y + st.shakeY;
    updateSnowA(dt);
    updateFx(dt);

    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = C.ink;
    g.fillRect(0, 0, st.sceneW, st.sceneH);
    // фон рисуем в виртуальных 1024×576, масштабируя в сцену
    g.setTransform(S, 0, 0, S, 0, 0);
    g.imageSmoothingEnabled = true;
    drawBgAurora(g, camX, camY, st.T);

    g.setTransform(S, 0, 0, S, -camX * S, -camY * S);
    drawTilesStatic(g, camX, camY);
    drawTilesDynamicA(g, game);
    drawPropsA(g, world, st.T);
    if (!st.hasExitProp && world.exit) propExitA(g, world.exit, st.T);
    drawEnemiesA(g, world, st.T);
    drawProjectilesA(g, world);
    var arr = world.actors || [], i;
    for (i = 0; i < arr.length; i++) if (arr[i] && actorCull(arr[i])) drawVikingA(g, arr[i], st.T);
    drawFxA(g);

    g.setTransform(S, 0, 0, S, 0, 0);
    g.imageSmoothingEnabled = true;
    drawSnowA(g);
    g.setTransform(1, 0, 0, 1, 0, 0);
    ensureGrade();
    if (st.gradeA) g.drawImage(st.gradeA, 0, 0, st.sceneW, st.sceneH);
  }

  function renderRetro(world, game, dt) {
    var g = st.sctx;
    var S = 0.5;
    updateSnowR(dt);
    updateFx(dt);
    var shx = Math.round(st.shakeX * 0.5) * 2, shy = Math.round(st.shakeY * 0.5) * 2;
    var camX = st.camQ.x + shx, camY = st.camQ.y + shy;

    g.setTransform(1, 0, 0, 1, 0, 0);
    g.imageSmoothingEnabled = false;
    drawBgRetro(g, camX, camY, st.T);

    g.setTransform(S, 0, 0, S, -camX * S, -camY * S);
    g.imageSmoothingEnabled = false;
    drawTilesStatic(g, camX, camY);
    drawTilesDynamicR(g, game);
    drawPropsR(g, world, st.T);
    if (!st.hasExitProp && world.exit) propExitR(g, world.exit, st.T);
    drawEnemiesR(g, world, st.T);
    drawProjectilesR(g, world);
    var arr = world.actors || [], i;
    for (i = 0; i < arr.length; i++) if (arr[i] && actorCull(arr[i])) drawVikingR(g, arr[i], st.T);
    drawFxR(g);

    g.setTransform(1, 0, 0, 1, 0, 0);
    g.imageSmoothingEnabled = false;
    drawSnowR(g);
    drawRetroVignette(g);
  }

  /* ================= ПОРТРЕТЫ ДЛЯ HUD ================= */

  function drawPortrait(canvas, actorId) {
    try {
      if (!canvas || !canvas.getContext) return;
      var g = canvas.getContext('2d');
      if (!g) return;
      var W = canvas.width || 64, H = canvas.height || 64;
      var v = VIK[actorId] || VIK.snorri;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, W, H);
      if (st.mode === 'retro') {
        // бюст викинга тем же арт-кодом, что и в мире (SAGA2VIK) — единые спрайты
        g.save();
        g.beginPath(); g.rect(0, 0, W, H); g.clip();
        g.imageSmoothingEnabled = false;
        g.fillStyle = R8[1]; g.fillRect(0, 0, W, H);
        g.fillStyle = R8[0]; g.fillRect(0, Math.round(H * 0.72), W, H - Math.round(H * 0.72));
        var sc = H / 26;
        g.translate(Math.round(W / 2), Math.round(H * 1.15));
        g.scale(sc, sc);
        SAGA2VIK.drawChar(g, actorId, 'idle', 0, 0, true);
        g.restore();
        return;
      }
      var k = Math.min(W, H) / 120;
      g.save();
      g.translate(W / 2, H / 2);
      g.scale(k, k);
      var bg = g.createRadialGradient(0, -8, 4, 0, 0, 70);
      bg.addColorStop(0, 'rgba(20,36,64,0.95)');
      bg.addColorStop(1, 'rgba(5,8,16,0.98)');
      g.fillStyle = bg;
      g.beginPath(); g.arc(0, 0, 58, 0, TAU); g.fill();
      g.strokeStyle = rgba(v.main, 0.5); g.lineWidth = 1.4;
      g.beginPath(); g.arc(0, 0, 57, 0, TAU); g.stroke();
      g.save();
      g.beginPath(); g.arc(0, 0, 55, 0, TAU); g.clip();
      g.globalCompositeOperation = 'lighter';
      glow(g, 0, -26, 52, v.main, 0.14);
      g.globalCompositeOperation = 'source-over';
      var isS = actorId === 'snorri', isG = actorId === 'gunnar', isB = actorId === 'bjorn';
      if (!isG && !isB) isS = true;
      // предметы за спиной
      if (isB) {
        // щит-кузнечный круг
        g.fillStyle = v.brass;
        g.beginPath(); g.arc(34, 30, 24, 0, TAU); g.fill();
        var sgr = g.createLinearGradient(14, 8, 50, 52);
        sgr.addColorStop(0, '#eef3f8'); sgr.addColorStop(0.5, '#aab4c2'); sgr.addColorStop(1, '#4e5866');
        g.fillStyle = sgr;
        g.beginPath(); g.arc(34, 30, 20, 0, TAU); g.fill();
        g.fillStyle = '#ffe9a8';
        for (var rv = 0; rv < 10; rv++) {
          var ra = rv / 10 * TAU;
          g.beginPath(); g.arc(34 + Math.cos(ra) * 15.5, 30 + Math.sin(ra) * 15.5, 1.3, 0, TAU); g.fill();
        }
        g.fillStyle = '#3e4652';
        g.beginPath(); g.arc(34, 30, 5.5, 0, TAU); g.fill();
      } else if (isG) {
        // арбалет за плечом
        g.save();
        g.translate(-30, 10); g.rotate(-0.55);
        g.fillStyle = v.wood; fillRound(g, -2.6, -34, 5.2, 70, 2);
        g.strokeStyle = '#c3d4e8'; g.lineWidth = 3.2; g.lineCap = 'round';
        g.beginPath(); g.moveTo(-18, -24); g.quadraticCurveTo(0, -36, 18, -24); g.stroke();
        g.strokeStyle = 'rgba(234,246,255,0.6)'; g.lineWidth = 0.9;
        g.beginPath(); g.moveTo(-18, -24); g.lineTo(18, -24); g.stroke();
        g.restore();
      } else {
        // рукоять молота над плечом
        g.save();
        g.translate(34, 4); g.rotate(0.35);
        g.fillStyle = '#6a4428'; fillRound(g, -2, -30, 4, 60, 1.6);
        g.fillStyle = '#9aa8bc'; fillRound(g, -10, -40, 20, 11, 2);
        g.fillStyle = 'rgba(234,246,255,0.5)'; g.fillRect(-9, -39, 18, 2);
        g.restore();
      }
      // плечи
      g.fillStyle = v.cloth;
      g.beginPath();
      g.moveTo(isB ? -52 : -46, 58); g.quadraticCurveTo(isB ? -46 : -40, 12, -14, 6);
      g.lineTo(14, 6); g.quadraticCurveTo(isB ? 46 : 40, 12, isB ? 52 : 46, 58);
      g.closePath(); g.fill();
      g.fillStyle = 'rgba(234,246,255,0.09)';
      g.beginPath();
      g.moveTo(-30, 56); g.quadraticCurveTo(-18, 18, 0, 16);
      g.lineTo(6, 56); g.closePath(); g.fill();
      if (isS) {
        // фартук с лямками и медный наплечник
        g.fillStyle = v.apron;
        g.beginPath(); g.moveTo(-14, 58); g.lineTo(-12, 22); g.lineTo(12, 22); g.lineTo(14, 58); g.closePath(); g.fill();
        g.strokeStyle = '#2a1c12'; g.lineWidth = 2.4;
        g.beginPath(); g.moveTo(-11, 23); g.lineTo(-18, 8); g.moveTo(11, 23); g.lineTo(18, 8); g.stroke();
        g.fillStyle = v.copper;
        g.beginPath();
        g.moveTo(-44, 30); g.quadraticCurveTo(-36, 6, -16, 10); g.lineTo(-18, 20); g.quadraticCurveTo(-32, 18, -36, 34);
        g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,230,190,0.55)';
        g.beginPath(); g.moveTo(-40, 24); g.quadraticCurveTo(-34, 10, -20, 11); g.lineTo(-20, 13); g.quadraticCurveTo(-33, 13, -38, 26); g.closePath(); g.fill();
        g.fillStyle = '#fff2b8';
        g.beginPath(); g.arc(-30, 16, 1.4, 0, TAU); g.fill();
        g.beginPath(); g.arc(-24, 13, 1.4, 0, TAU); g.fill();
      } else if (isG) {
        // меховой ворот кафтана, застёжки
        g.fillStyle = v.furL;
        g.beginPath(); g.ellipse(-18, 12, 16, 8, -0.25, 0, TAU); g.fill();
        g.beginPath(); g.ellipse(18, 12, 16, 8, 0.25, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(4,8,16,0.4)'; g.lineWidth = 1.4;
        g.beginPath(); g.moveTo(2, 18); g.lineTo(3, 58); g.stroke();
        g.fillStyle = '#c3d4e8'; g.fillRect(5, 28, 3, 3); g.fillRect(5, 40, 3, 3);
      } else {
        // кольчужные наплечья, стёжка жилета
        g.fillStyle = v.mail;
        g.beginPath(); g.ellipse(-34, 22, 16, 10, -0.4, 0, TAU); g.fill();
        g.beginPath(); g.ellipse(34, 22, 16, 10, 0.4, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(4,8,16,0.35)'; g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(-10, 16); g.lineTo(-12, 58); g.moveTo(10, 16); g.lineTo(12, 58); g.stroke();
      }
      // шея
      g.fillStyle = v.skin;
      g.fillRect(-8, -2, 16, 14);
      // хвост капюшона
      if (isS) {
        g.fillStyle = v.hoodS;
        g.beginPath(); g.moveTo(-16, -30); g.quadraticCurveTo(-34, -20, -34, 4); g.lineTo(-24, 2); g.quadraticCurveTo(-24, -14, -14, -22); g.closePath(); g.fill();
      }
      // голова
      g.fillStyle = v.skin;
      g.beginPath(); g.arc(0, -22, 18, 0, TAU); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.12)';
      g.beginPath(); g.arc(-5, -18, 15, 0, TAU); g.fill();
      g.fillStyle = v.skin;
      g.beginPath(); g.arc(0, -22, 16.5, 0, TAU); g.fill();
      if (isB) {
        // борода-косица, блик на бритой голове
        g.fillStyle = 'rgba(255,240,220,0.35)';
        g.beginPath(); g.ellipse(-5, -36, 7, 3, -0.3, 0, TAU); g.fill();
        g.fillStyle = v.hair;
        g.beginPath();
        g.moveTo(-14, -14); g.quadraticCurveTo(-12, 2, 0, 3); g.quadraticCurveTo(12, 2, 14, -14);
        g.quadraticCurveTo(7, -7, 0, -8); g.quadraticCurveTo(-7, -7, -14, -14);
        g.closePath(); g.fill();
        g.strokeStyle = v.hair; g.lineWidth = 3; g.lineCap = 'round';
        g.beginPath(); g.moveTo(-7, -10); g.quadraticCurveTo(0, -13, 7, -10); g.stroke();
        g.lineWidth = 4.4;
        g.beginPath(); g.moveTo(0, 2); g.lineTo(0, 16); g.stroke();
        g.fillStyle = v.brass; g.fillRect(-3.4, 13, 6.8, 3.4);
      }
      // глаза
      g.fillStyle = '#0b0f1a';
      g.beginPath(); g.ellipse(-6, -25, 2.4, 2.8, 0, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(6, -25, 2.4, 2.8, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.fillRect(-7, -27, 1.6, 1.6); g.fillRect(5, -27, 1.6, 1.6);
      g.strokeStyle = 'rgba(40,26,16,0.8)'; g.lineWidth = 1.8; g.lineCap = 'round';
      g.beginPath(); g.moveTo(-10, -31); g.lineTo(-3, -30.5); g.moveTo(3, -30.5); g.lineTo(10, -31); g.stroke();
      if (!isG) {
        g.strokeStyle = 'rgba(70,30,20,0.6)'; g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(-4, -12.5); g.quadraticCurveTo(0, -11.2, 4, -12.5); g.stroke();
      }
      if (isS) {
        g.fillStyle = 'rgba(30,20,16,0.35)';
        g.beginPath(); g.ellipse(9, -17, 3.4, 1.5, -0.4, 0, TAU); g.fill();
        // кожаный капюшон
        g.fillStyle = v.hood;
        g.beginPath();
        g.moveTo(-20, 4); g.quadraticCurveTo(-26, -20, -20, -36); g.quadraticCurveTo(-12, -48, 2, -47);
        g.quadraticCurveTo(18, -46, 22, -32); g.quadraticCurveTo(26, -16, 18, 4);
        g.lineTo(12, 0); g.quadraticCurveTo(17, -14, 14, -27); g.quadraticCurveTo(9, -36, 0, -36);
        g.quadraticCurveTo(-11, -36, -14, -27); g.quadraticCurveTo(-17, -14, -12, 0);
        g.closePath(); g.fill();
        g.strokeStyle = v.hoodL; g.lineWidth = 1.6;
        g.beginPath(); g.moveTo(-12, 0); g.quadraticCurveTo(-17, -14, -14, -27); g.quadraticCurveTo(-11, -36, 0, -36);
        g.quadraticCurveTo(9, -36, 14, -27); g.quadraticCurveTo(17, -14, 12, 0); g.stroke();
        g.fillStyle = v.hood;
        g.beginPath(); g.moveTo(-30, 12); g.quadraticCurveTo(0, -4, 30, 12); g.quadraticCurveTo(0, 6, -30, 12); g.closePath(); g.fill();
      } else if (isG) {
        // шарф до носа
        g.fillStyle = v.scarf;
        g.beginPath(); g.moveTo(-18, -16); g.quadraticCurveTo(0, -22, 18, -16); g.lineTo(18, -2); g.quadraticCurveTo(0, 4, -18, -2); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(255,255,255,0.2)'; g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(-16, -14); g.quadraticCurveTo(0, -19, 16, -14); g.stroke();
        g.fillStyle = v.scarf;
        g.beginPath(); g.moveTo(10, -4); g.lineTo(20, -2); g.lineTo(18, 26); g.lineTo(10, 24); g.closePath(); g.fill();
        // меховая шапка
        g.fillStyle = v.fur;
        g.beginPath();
        g.moveTo(-21, -28); g.lineTo(-22, -50); g.quadraticCurveTo(-20, -62, 0, -62);
        g.quadraticCurveTo(20, -62, 22, -50); g.lineTo(21, -28); g.closePath(); g.fill();
        g.fillStyle = v.cloth;
        g.beginPath(); g.ellipse(0, -59, 14, 3.4, 0, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(90,80,60,0.5)'; g.lineWidth = 1;
        for (var fz = 0; fz < 9; fz++) {
          g.beginPath(); g.moveTo(-17 + fz * 4.2, -54 + (fz % 3) * 3); g.lineTo(-16 + fz * 4.2, -46 + (fz % 3) * 3); g.stroke();
        }
        g.fillStyle = v.furL;
        fillRound(g, -23, -38, 46, 10, 5);
        g.fillStyle = v.fur;
        fillRound(g, -24, -32, 8, 22, 3.6);
        fillRound(g, 16, -32, 8, 22, 3.6);
        glow(g, 0, -59, 14, v.main, 0.4);
      } else {
        // кузнечные очки на лбу
        g.fillStyle = '#2a1c12';
        g.beginPath(); g.moveTo(-18, -33); g.quadraticCurveTo(0, -39, 18, -33); g.lineTo(18, -29); g.quadraticCurveTo(0, -35, -18, -29); g.closePath(); g.fill();
        for (var gz = 0; gz < 2; gz++) {
          var gx = gz ? 8 : -8;
          g.fillStyle = v.brass;
          g.beginPath(); g.arc(gx, -36, 7, 0, TAU); g.fill();
          g.fillStyle = v.glass;
          g.beginPath(); g.arc(gx, -36, 4.6, 0, TAU); g.fill();
          g.fillStyle = 'rgba(255,255,255,0.85)';
          g.fillRect(gx - 2.4, -38.6, 1.8, 1.8);
        }
        glow(g, 0, -36, 16, v.glass, 0.35);
      }
      g.restore();
      g.restore();
    } catch (e) { /* отказоустойчивость */ }
  }

  /*__NEXT__*/
})();
