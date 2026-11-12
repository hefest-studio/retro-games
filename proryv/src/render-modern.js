/* ============================================================
   ПРОРЫВ HTML5 — MODERN-рендерер «NEON 2026»
   Тот же мир 256×208, но векторная неоновая графика: свечение,
   параллакс, частицы, стеклянный HUD, современная типографика.
   Координаты — логические (1 юнит = 1 «пиксель» ZX), масштаб
   задаёт main.js через transform.
   ============================================================ */
(function () {
  'use strict';

  const EX = window.EX;
  const N = EX.NEON;
  const TILE = 8, COLS = 32, ROWS = 24, W = 256, H = 192, HUD = 16, VH = 208;

  const UI_FONT = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';
  const HEAD_FONT = '"Inter", system-ui, -apple-system, "Segoe UI", sans-serif';

  let g = null;
  let V = null;
  let t = 0;
  const S = () => EX.state;

  /* ---------- палитры тем ---------- */
  const THEMES = {
    space:   { a: '#39f6ff', b: '#8a5cff', c: '#b6ff3c', slab: '#111a3c', slab2: '#0a1026', edge: '#2f4a8f', fog: '#0a0f26', hazard: '#ff3ff0' },
    cavern:  { a: '#b6ff3c', b: '#7affd8', c: '#ffcc55', slab: '#14200f', slab2: '#0a1408', edge: '#3c6f2a', fog: '#0a1408', hazard: '#ff9f3c' },
    reactor: { a: '#ffcc55', b: '#ff7a3c', c: '#39f6ff', slab: '#1e1608', slab2: '#130e04', edge: '#7a5a1c', fog: '#120c04', hazard: '#ff3b3b' },
    hive:    { a: '#ff3ff0', b: '#b6ff3c', c: '#8a5cff', slab: '#1c0a1c', slab2: '#120612', edge: '#6a2a66', fog: '#140614', hazard: '#ffcc55' },
    core:    { a: '#ff4d6d', b: '#39f6ff', c: '#ffcc55', slab: '#1e0a14', slab2: '#13060c', edge: '#7a2438', fog: '#140610', hazard: '#ffffff' }
  };
  const th = () => THEMES[(S().world && S().world.theme) || 'space'] || THEMES.space;

  /* ---------- утилиты рисования ---------- */
  function rr(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
  function frect(x, y, w, h, style) { g.fillStyle = style; g.fillRect(x, y, w, h); }
  function strokeRR(x, y, w, h, r, color, lw) {
    rr(x, y, w, h, r);
    g.strokeStyle = color; g.lineWidth = lw || 1; g.stroke();
  }
  function text(str, x, y, size, color, align, weight, track, family) {
    g.font = (weight || '600') + ' ' + size + 'px ' + (family || UI_FONT);
    g.fillStyle = color;
    g.textAlign = align || 'left';
    g.textBaseline = 'middle';
    const tr = track || 0;
    if (tr) { try { g.letterSpacing = tr + 'px'; } catch (e) { /* ok */ } }
    g.fillText(str, x, y);
    if (tr) { try { g.letterSpacing = '0px'; } catch (e) { /* ok */ } }
  }
  function glowText(str, x, y, size, color, align, weight, blur, family) {
    g.save();
    g.shadowColor = color;
    g.shadowBlur = blur || 10;
    text(str, x, y, size, color, align, weight, 0, family);
    g.restore();
  }
  function textW(str, size, weight, track) {
    g.font = (weight || '600') + ' ' + size + 'px ' + UI_FONT;
    return g.measureText(str).width + (track || 0) * String(str).length;
  }
  function wrapMulti(str, size, maxW, weight) {
    const out = [];
    String(str).split('\n').forEach(function (par) {
      if (!par.trim()) { out.push(''); return; }
      wrap(par, size, maxW, weight).forEach(function (l) { out.push(l); });
    });
    return out;
  }

  function wrap(str, size, maxW, weight) {
    const words = String(str).split(' ');
    const out = [];
    let line = '';
    g.font = (weight || '400') + ' ' + size + 'px ' + UI_FONT;
    words.forEach(function (w) {
      const test = line ? line + ' ' + w : w;
      if (g.measureText(test).width > maxW && line) { out.push(line); line = w; }
      else line = test;
    });
    if (line) out.push(line);
    return out;
  }
  function hash(x, y) {
    let h = (x * 374761393 + y * 668265263) | 0;
    h = (h ^ (h >>> 13)) * 1274126177 | 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function vline(x1, y1, x2, y2, color, lw) {
    g.strokeStyle = color; g.lineWidth = lw || 1;
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
  }
  function dot(x, y, r, color) { g.fillStyle = color; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
  function glowDot(x, y, r, color, blur) {
    g.save(); g.shadowColor = color; g.shadowBlur = blur || 6;
    dot(x, y, r, color); g.restore();
  }

  /* ---------- фон ---------- */
  function fullBg() {
    const cw = V.cw, ch = V.ch;
    const grad = g.createLinearGradient(0, 0, 0, ch);
    grad.addColorStop(0, '#080517');
    grad.addColorStop(0.45, '#0a0722');
    grad.addColorStop(1, '#04030c');
    g.fillStyle = grad; g.fillRect(0, 0, cw, ch);

    /* аврора-пятна */
    const blobs = [
      { x: cw * 0.18, y: ch * 0.22, r: cw * 0.34, c: 'rgba(90,60,255,0.18)' },
      { x: cw * 0.82, y: ch * 0.3, r: cw * 0.3, c: 'rgba(0,220,255,0.12)' },
      { x: cw * 0.5, y: ch * 1.02, r: cw * 0.45, c: 'rgba(255,40,200,0.10)' }
    ];
    blobs.forEach(function (b) {
      const rg = g.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
      rg.addColorStop(0, b.c); rg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = rg; g.fillRect(0, 0, cw, ch);
    });

    /* звёзды с параллаксом */
    for (let layer = 0; layer < 3; layer++) {
      const count = [70, 40, 22][layer];
      const speed = [4, 9, 16][layer];
      const alpha = [0.35, 0.55, 0.9][layer];
      for (let i = 0; i < count; i++) {
        const sx = hash(i, layer) * cw;
        const sy = ((hash(i, layer + 7) * ch) + t * speed) % ch;
        g.globalAlpha = alpha;
        dot(sx, sy, layer === 2 ? 1.6 : 1, layer === 1 ? '#9ef9ff' : '#e8e6ff');
        g.globalAlpha = 1;
      }
    }

    /* перспективная сетка снизу */
    g.save();
    g.globalAlpha = 0.16;
    g.strokeStyle = '#39f6ff';
    g.lineWidth = 1;
    const horizon = ch * 0.72;
    for (let i = -12; i <= 12; i++) {
      g.beginPath();
      g.moveTo(cw / 2 + i * 16, ch);
      g.lineTo(cw / 2 + i * cw * 0.06, horizon);
      g.stroke();
    }
    for (let i = 1; i < 10; i++) {
      const y = horizon + Math.pow(i / 10, 2.1) * (ch - horizon);
      g.beginPath(); g.moveTo(0, y); g.lineTo(cw, y); g.stroke();
    }
    g.restore();
  }

  function stageBackdrop() {
    const T = th();
    /* глубина сцены */
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, T.fog);
    grad.addColorStop(1, '#03020a');
    g.fillStyle = grad; g.fillRect(0, 0, W, VH);

    /* звёзды внутри сцены */
    const seed = (S().world && S().world.seed) || 1;
    for (let i = 0; i < 34; i++) {
      const x = (hash(i, seed) * W + t * (2 + (i % 3) * 3)) % W;
      const y = hash(i + 40, seed) * H;
      g.globalAlpha = 0.25 + (i % 5) * 0.11;
      dot(x, y, i % 7 === 0 ? 1.3 : 0.7, T.b);
      g.globalAlpha = 1;
    }
    /* дальний «горизонт» */
    g.globalAlpha = 0.5;
    for (let i = 0; i < 6; i++) {
      const y = 120 + i * 14;
      g.strokeStyle = i % 2 ? 'rgba(120,90,255,0.06)' : 'rgba(57,246,255,0.05)';
      g.lineWidth = 1;
      g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
    }
    g.globalAlpha = 1;
    /* тематические детали дальнего плана */
    const theme = (S().world && S().world.theme) || 'space';
    g.save();
    if (theme === 'space') {
      /* далёкая станция и планета */
      g.globalAlpha = 0.16;
      g.strokeStyle = T.b; g.lineWidth = 0.7;
      for (let i = 0; i < 5; i++) {
        const x = 170 + i * 7, y = 24 + (i % 2) * 5;
        g.strokeRect(x, y, 6, 4);
      }
      const px = 34, py = 30;
      g.globalAlpha = 0.2;
      const pg = g.createRadialGradient(px, py, 2, px, py, 22);
      pg.addColorStop(0, T.b); pg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = pg; g.beginPath(); g.arc(px, py, 22, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 0.5; dot(px, py, 6, T.a);
    } else if (theme === 'cavern') {
      g.globalAlpha = 0.22;
      g.strokeStyle = T.a; g.lineWidth = 0.8;
      for (let i = 0; i < 6; i++) {
        const x = 10 + i * 44;
        g.beginPath();
        g.moveTo(x, 0); g.lineTo(x + 10, 14 + (i % 3) * 9); g.lineTo(x + 20, 0); g.stroke();
        g.beginPath();
        g.moveTo(x + 6, H); g.lineTo(x + 16, H - 16 - (i % 2) * 10); g.lineTo(x + 26, H); g.stroke();
      }
    } else if (theme === 'reactor') {
      g.globalAlpha = 0.18;
      g.strokeStyle = T.a; g.lineWidth = 0.7;
      for (let i = 0; i < 4; i++) {
        const x = 24 + i * 62;
        g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 88); g.stroke();
        g.beginPath(); g.arc(x, 88, 7, 0, Math.PI, false); g.stroke();
      }
      g.globalAlpha = 0.1;
      for (let y = 0; y < 100; y += 16) frect(0, y, W, 1, T.a);
    } else if (theme === 'hive') {
      g.globalAlpha = 0.2;
      g.strokeStyle = T.b; g.lineWidth = 0.8;
      for (let i = 0; i < 5; i++) {
        const x = 20 + i * 50, y = 26 + (i % 3) * 18, r = 14 + (i % 2) * 8;
        g.beginPath(); g.ellipse(x, y, r, r * 0.6, 0.3, 0, Math.PI * 2); g.stroke();
        g.beginPath(); g.ellipse(x + 4, y + 3, r * 0.55, r * 0.35, 0.3, 0, Math.PI * 2); g.stroke();
      }
    } else if (theme === 'core') {
      g.globalAlpha = 0.22;
      g.strokeStyle = T.a; g.lineWidth = 0.9;
      const pulse = 0.5 + 0.5 * Math.sin(t * 0.9);
      for (let i = 0; i < 3; i++) {
        g.beginPath();
        g.arc(W / 2, 78, 26 + i * 16 + pulse * 3, 0, Math.PI * 2);
        g.stroke();
      }
      g.globalAlpha = 0.08;
      frect(W / 2 - 1, 0, 2, H, T.a);
      frect(0, 78, W, 1.5, T.a);
    }
    g.restore();
    g.globalAlpha = 1;
    /* пульс темы */
    const pulse = 0.5 + 0.5 * Math.sin(t * 1.4);
    g.globalAlpha = 0.05 + pulse * 0.04;
    const rg = g.createRadialGradient(W / 2, H * 0.7, 10, W / 2, H * 0.7, 160);
    rg.addColorStop(0, T.a); rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg; g.fillRect(0, 0, W, VH);
    g.globalAlpha = 1;
  }

  /* ---------- тайлы ---------- */
  function tileSolid(tx, ty, T) {
    const x = tx * TILE, y = ty * TILE;
    const hs = hash(tx, ty);
    g.fillStyle = T.slab;
    g.fillRect(x, y, TILE, TILE);
    g.fillStyle = T.slab2;
    g.fillRect(x, y + 5, TILE, 3);
    /* верхняя кромка светится, если сверху пусто */
    if (EX.tileAt(tx, ty - 1) === EX.TILES.EMPTY || EX.tileAt(tx, ty - 1) === EX.TILES.FLORA) {
      g.strokeStyle = T.a;
      g.globalAlpha = 0.85;
      g.lineWidth = 0.9;
      g.beginPath(); g.moveTo(x, y + 0.5); g.lineTo(x + TILE, y + 0.5); g.stroke();
      g.globalAlpha = 0.16;
      g.fillStyle = T.a; g.fillRect(x, y, TILE, 2.2);
      g.globalAlpha = 1;
    }
    /* заклёпки/панель */
    if (hs > 0.72) { g.globalAlpha = 0.5; dot(x + 2, y + 4.5, 0.6, T.edge); dot(x + 6, y + 4.5, 0.6, T.edge); g.globalAlpha = 1; }
    if (hs < 0.18) { g.globalAlpha = 0.35; vline(x + 4, y + 2, x + 4, y + 6, T.edge, 0.7); g.globalAlpha = 1; }
  }

  function tileRock(tx, ty, T) {
    const x = tx * TILE, y = ty * TILE;
    g.beginPath();
    g.moveTo(x + 0.5, y + 2);
    g.lineTo(x + 2.5, y + 0.5);
    g.lineTo(x + 6.5, y + 1.2);
    g.lineTo(x + 7.5, y + 4.5);
    g.lineTo(x + 5.5, y + 7.5);
    g.lineTo(x + 2, y + 7);
    g.lineTo(x + 0.3, y + 4.5);
    g.closePath();
    const grad = g.createLinearGradient(x, y, x + TILE, y + TILE);
    grad.addColorStop(0, '#2a1230');
    grad.addColorStop(1, '#140a1c');
    g.fillStyle = grad; g.fill();
    g.strokeStyle = T.b; g.lineWidth = 0.7; g.globalAlpha = 0.8; g.stroke(); g.globalAlpha = 1;
    g.globalAlpha = 0.6;
    vline(x + 2.5, y + 2, x + 4, y + 5, T.b, 0.6);
    g.globalAlpha = 1;
  }

  function tileThin(tx, ty, T) {
    const x = tx * TILE, y = ty * TILE;
    g.fillStyle = T.c; g.globalAlpha = 0.9; g.fillRect(x, y, TILE, 1.1); g.globalAlpha = 1;
    g.globalAlpha = 0.45;
    for (let i = 1; i < TILE; i += 3) { dot(x + i, y + 2.4, 0.5, T.c); }
    g.globalAlpha = 1;
  }

  function tileSpike(tx, ty, T) {
    const x = tx * TILE, y = ty * TILE;
    g.fillStyle = T.hazard;
    g.globalAlpha = 0.9;
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.moveTo(x + i * 3 + 0.5, y + 8);
      g.lineTo(x + i * 3 + 1.5, y + 2.5);
      g.lineTo(x + i * 3 + 2.5, y + 8);
      g.fill();
    }
    g.globalAlpha = 0.25; g.fillRect(x, y + 7, TILE, 1); g.globalAlpha = 1;
  }

  function tileFlora(tx, ty, T) {
    const x = tx * TILE + 4, y = ty * TILE + 8;
    const h = 4 + hash(tx, ty) * 5;
    g.strokeStyle = T.c; g.lineWidth = 0.8; g.globalAlpha = 0.75;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x - 1.5, y - h * 0.6, x - 0.4, y - h);
    g.stroke();
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + 1.8, y - h * 0.5, x + 1, y - h * 0.9);
    g.stroke();
    g.globalAlpha = 1;
    glowDot(x - 0.4, y - h, 0.9, T.c, 5);
  }

  function drawTiles(T) {
    const tiles = S().world.tiles;
    for (let ty = 0; ty < ROWS; ty++) {
      for (let tx = 0; tx < COLS; tx++) {
        const id = tiles[ty * COLS + tx];
        if (!id) continue;
        if (id === EX.TILES.SOLID) tileSolid(tx, ty, T);
        else if (id === EX.TILES.ROCK) tileRock(tx, ty, T);
        else if (id === EX.TILES.THIN) tileThin(tx, ty, T);
        else if (id === EX.TILES.SPIKE) tileSpike(tx, ty, T);
        else if (id === EX.TILES.FLORA) tileFlora(tx, ty, T);
      }
    }
  }

  /* ---------- враги ---------- */
  function drawWalker(e, T) {
    const x = e.x + e.w / 2, y = e.y + e.h / 2;
    const c = e.hitT > 0 ? '#ffffff' : '#b6ff3c';
    g.save();
    g.translate(x, y);
    g.scale(e.dir > 0 ? 1 : -1, 1);
    const step = Math.sin(e.anim * 8) * 0.9;
    g.strokeStyle = c; g.lineWidth = 1.1; g.globalAlpha = 0.95;
    /* ноги */
    for (let i = -1; i <= 1; i += 2) {
      g.beginPath();
      g.moveTo(i * 2, 3);
      g.lineTo(i * 4 + (i > 0 ? step : -step), 6);
      g.stroke();
    }
    /* тело */
    g.beginPath();
    g.ellipse(0, 0, 6, 4.2, 0, 0, Math.PI * 2);
    g.fillStyle = 'rgba(182,255,60,0.14)'; g.fill();
    g.strokeStyle = c; g.lineWidth = 1.1; g.stroke();
    /* глаза */
    glowDot(1.8, -1, 1.3, '#ffcc55', 6);
    glowDot(4.2, -1.2, 0.9, '#ffcc55', 5);
    /* шипы */
    g.strokeStyle = '#ff3ff0'; g.lineWidth = 0.8;
    g.beginPath(); g.moveTo(-2, -4); g.lineTo(-1, -6.2); g.moveTo(2, -4.4); g.lineTo(3.4, -6.4); g.stroke();
    g.restore();
  }

  function drawFlyer(e, T) {
    const x = e.x + e.w / 2, y = e.y + e.h / 2;
    const c = e.hitT > 0 ? '#ffffff' : '#ff3ff0';
    const flap = Math.sin(e.anim * 13) * 2.2;
    g.save(); g.translate(x, y);
    g.fillStyle = 'rgba(255,63,240,0.16)';
    g.beginPath();
    g.moveTo(-8, flap - 1); g.quadraticCurveTo(-3, -4, 0, 0);
    g.quadraticCurveTo(3, -4, 8, flap - 1); g.quadraticCurveTo(2, 3, 0, 4);
    g.quadraticCurveTo(-2, 3, -8, flap - 1); g.closePath(); g.fill();
    g.strokeStyle = c; g.lineWidth = 1; g.stroke();
    glowDot(0, -1, 1.5, '#39f6ff', 7);
    g.restore();
  }

  function drawSwarmer(e) {
    const x = e.x + e.w / 2, y = e.y + e.h / 2;
    g.save(); g.translate(x, y + Math.sin(e.anim * 9) * 0.6);
    const c = e.hitT > 0 ? '#ffffff' : '#ffcc55';
    /* лапки */
    g.strokeStyle = c; g.lineWidth = 0.7; g.globalAlpha = 0.85;
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + e.anim * 3;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * 2.6, Math.sin(a) * 2.2); g.stroke();
    }
    /* тело */
    g.globalAlpha = 0.95;
    g.fillStyle = 'rgba(255,204,85,0.22)';
    g.beginPath(); g.ellipse(0, 0, 2.6, 2, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = c; g.lineWidth = 0.8; g.stroke();
    g.fillStyle = c;
    dot(-1.3, -0.6, 0.5, '#ffffff');
    dot(1.3, -0.6, 0.5, '#ffffff');
    g.globalAlpha = 1;
    g.restore();
    g.save(); g.shadowColor = '#ffcc55'; g.shadowBlur = 6; dot(x, y, 0.9, '#ffcc55'); g.restore();
  }

  function drawTurret(e, T) {
    const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
    const dir = e.dir || -1;
    g.save(); g.translate(cx, cy);
    g.fillStyle = 'rgba(20,24,52,0.9)';
    g.beginPath();
    g.moveTo(-6, 4); g.lineTo(-4, -4); g.lineTo(4, -4); g.lineTo(6, 4); g.closePath(); g.fill();
    g.strokeStyle = e.hitT > 0 ? '#fff' : '#8a9bd8'; g.lineWidth = 0.9; g.stroke();
    /* ствол */
    g.strokeStyle = '#ff4d6d'; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(dir * 2, -1); g.lineTo(dir * 8, -1); g.stroke();
    glowDot(0, 0, 1.6, '#ff4d6d', 8);
    g.restore();
  }

  function drawTank(e, T) {
    const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
    const dir = e.dir || -1;
    g.save(); g.translate(cx, cy);
    g.fillStyle = 'rgba(30,40,80,0.95)';
    rr(-8, -2, 16, 7, 1.5); g.fill();
    g.strokeStyle = '#39f6ff'; g.lineWidth = 0.8; g.stroke();
    g.fillStyle = 'rgba(57,246,255,0.25)';
    rr(-5, -5, 10, 4, 1.2); g.fill();
    g.strokeStyle = '#ffcc55'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(dir * 2, -3); g.lineTo(dir * 9, -3); g.stroke();
    glowDot(0, -3, 1.3, '#ffcc55', 6);
    g.restore();
  }

  function drawMine(e) {
    const cx = e.x + 4, cy = e.y + 3;
    const danger = Math.sin(e.anim * (e.timer < 0.4 ? 22 : 4)) > 0;
    g.save(); g.translate(cx, cy);
    g.strokeStyle = danger ? '#ff4d6d' : '#7c74a8'; g.lineWidth = 0.8;
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3 + e.anim * 0.6;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * 4.4, Math.sin(a) * 4.4); g.stroke();
    }
    glowDot(0, 0, 1.7, danger ? '#ff4d6d' : '#ffcc55', 7);
    g.restore();
  }

  function drawCrusher(e) {
    const x = e.x, y = e.y, w = e.w, h = e.h;
    /* направляющие */
    g.strokeStyle = 'rgba(255,204,85,0.3)'; g.lineWidth = 0.6;
    vline(x + 2.5, y - 12, x + 2.5, y + 2, 'rgba(255,204,85,0.3)', 0.6);
    vline(x + w - 2.5, y - 12, x + w - 2.5, y + 2, 'rgba(255,204,85,0.3)', 0.6);
    /* корпус */
    g.fillStyle = 'rgba(26,20,10,0.92)';
    rr(x + 1, y, w - 2, h - 7, 1); g.fill();
    g.strokeStyle = 'rgba(255,204,85,0.55)'; g.lineWidth = 0.8;
    rr(x + 1, y, w - 2, h - 7, 1); g.stroke();
    /* предупреждающие полосы */
    g.save();
    g.beginPath(); g.rect(x + 2, y + 2, w - 4, 3); g.clip();
    for (let i = -4; i < w + 4; i += 4) {
      g.strokeStyle = 'rgba(255,204,85,0.5)'; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(x + i, y + 5.5); g.lineTo(x + i + 4, y + 1); g.stroke();
    }
    g.restore();
    /* боёк */
    g.fillStyle = '#ffcc55'; g.globalAlpha = 0.92;
    rr(x + 1.5, y + h - 7, w - 3, 4.5, 1); g.fill();
    g.globalAlpha = 1;
    glowDot(x + w / 2, y + h - 4.5, 1.1, '#ff4d6d', 7);
  }

  function drawPod(e, T) {
    const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
    const pulse = 0.5 + 0.5 * Math.sin(e.anim * 4);
    g.save(); g.translate(cx, cy);
    g.fillStyle = 'rgba(140,255,60,0.12)';
    rr(-6, -5, 12, 11, 5); g.fill();
    g.strokeStyle = e.hitT > 0 ? '#fff' : '#b6ff3c'; g.lineWidth = 1; g.stroke();
    g.globalAlpha = 0.5 + pulse * 0.5;
    glowDot(0, 0, 2.2 + pulse, '#ff3ff0', 9);
    g.globalAlpha = 1;
    g.restore();
  }

  function drawHomer(e) {
    const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
    g.save(); g.translate(cx, cy); g.rotate(e.anim * 0.8);
    g.fillStyle = 'rgba(20,50,70,0.9)';
    g.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = i * Math.PI * 2 / 5 - Math.PI / 2;
      const x = Math.cos(a) * 6, y = Math.sin(a) * 6;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.closePath(); g.fill();
    g.strokeStyle = e.hitT > 0 ? '#fff' : '#39f6ff'; g.lineWidth = 0.9; g.stroke();
    g.restore();
    glowDot(cx, cy, 1.8, '#ff4d6d', 8);
  }

  function drawLauncher(e, combo, T) {
    const x = e.x + e.w / 2, y = e.y + e.h / 2;
    const c = combo ? '#ff3ff0' : '#39f6ff';
    g.save(); g.translate(x, y);
    g.fillStyle = 'rgba(18,14,40,0.9)';
    g.fillRect(-5, -2, 10, e.h - 6);
    g.strokeStyle = c; g.lineWidth = 0.9; g.strokeRect(-5, -2, 10, e.h - 6);
    /* голограмма */
    g.globalAlpha = 0.6 + 0.4 * Math.sin(e.anim * 3);
    g.fillStyle = c;
    g.fillRect(-4, -6, 8, 3);
    g.globalAlpha = 1;
    glowDot(0, -2, 2.1, c, 9);
    g.restore();
  }

  function drawPower(e, color) {
    const bob = Math.sin(e.anim * 4 + e.phase * 6) * 1.2;
    const cx = e.x + 4, cy = e.y + 4 + bob;
    g.save();
    g.translate(cx, cy); g.rotate(Math.sin(e.anim * 2) * 0.2);
    rr(-2.6, -3.6, 5.2, 7.2, 1.2);
    g.fillStyle = 'rgba(10,8,24,0.9)'; g.fill();
    g.strokeStyle = color; g.lineWidth = 0.9; g.stroke();
    g.globalAlpha = 0.75; g.fillStyle = color; g.fillRect(-1.2, -2.2, 2.4, 4.4); g.globalAlpha = 1;
    g.restore();
    g.save(); g.shadowColor = color; g.shadowBlur = 8; dot(cx, cy, 1.2, color); g.restore();
  }

  function drawExoPod(e) {
    const x = e.x + e.w / 2, y = e.y;
    const pulse = 0.5 + 0.5 * Math.sin(e.anim * 2.4);
    g.save();
    /* луч */
    const lg = g.createLinearGradient(0, y - 30, 0, y + 4);
    lg.addColorStop(0, 'rgba(57,246,255,0)');
    lg.addColorStop(1, 'rgba(57,246,255,' + (0.12 + pulse * 0.1) + ')');
    g.fillStyle = lg; g.fillRect(x - 7, y - 30, 14, 34);
    /* капсула */
    rr(x - 7, y + 1, 14, e.h - 1, 3);
    g.fillStyle = 'rgba(12,26,50,0.95)'; g.fill();
    g.strokeStyle = '#39f6ff'; g.lineWidth = 1; g.stroke();
    g.globalAlpha = 0.55 + pulse * 0.35;
    rr(x - 4.5, y + 5, 9, e.h - 12, 2);
    g.fillStyle = 'rgba(57,246,255,0.35)'; g.fill();
    g.globalAlpha = 1;
    glowDot(x, y + e.h / 2, 1.6, '#b6ff3c', 8);
    g.restore();
  }

  function drawTeleporter(e, T) {
    const cx = e.x + e.w / 2, base = e.y + e.h;
    g.save();
    for (let i = 0; i < 3; i++) {
      const k = ((t * 0.7 + i / 3) % 1);
      const y = base - 2 - k * (e.h - 4);
      g.globalAlpha = 0.6 * (1 - k);
      g.strokeStyle = T.a; g.lineWidth = 0.8;
      g.beginPath(); g.ellipse(cx, y, 5 - k * 1.5, 1.6 - k * 0.5, 0, 0, Math.PI * 2); g.stroke();
    }
    g.globalAlpha = 1;
    g.fillStyle = 'rgba(57,246,255,0.15)';
    g.fillRect(cx - 5, base - 2, 10, 2);
    g.strokeStyle = T.a; g.lineWidth = 0.9;
    g.strokeRect(cx - 5, base - 2, 10, 2);
    g.restore();
  }

  function drawEntity(e, T) {
    switch (e.t) {
      case 'walker': drawWalker(e, T); break;
      case 'flyer': drawFlyer(e, T); break;
      case 'swarmer': drawSwarmer(e); break;
      case 'turret': drawTurret(e, T); break;
      case 'tank': drawTank(e, T); break;
      case 'mine': drawMine(e); break;
      case 'crusher': drawCrusher(e); break;
      case 'pod': drawPod(e, T); break;
      case 'homer': drawHomer(e); break;
      case 'double_launcher': drawLauncher(e, false, T); break;
      case 'combo_launcher': drawLauncher(e, true, T); break;
      case 'power_laser': drawPower(e, T.a); break;
      case 'power_rocket': drawPower(e, '#ff3ff0'); break;
      case 'exo': drawExoPod(e); break;
      case 'teleporter': drawTeleporter(e, T); break;
      default: break;
    }
  }

  /* ---------- игрок ---------- */
  function drawPlayer(p, T) {
    if (!p || !p.alive) return;
    if (p.invuln > 0 && p.invuln < 5 && Math.floor(t * 18) % 2 === 0) return;
    const h = p.duck ? 10 : p.h;
    const cx = p.x + p.w / 2;
    const feet = p.y + p.h;
    const dir = p.facing || 1;
    g.save();
    /* тень */
    g.globalAlpha = 0.3;
    g.fillStyle = '#000';
    g.beginPath(); g.ellipse(cx, feet - 0.4, 5, 1.4, 0, 0, Math.PI * 2); g.fill();
    g.globalAlpha = 1;

    if (p.exo) {
      /* ЭКЗОСКЕЛЕТ — тяжёлый мех */
      const top = feet - h;
      g.fillStyle = 'rgba(20,50,80,0.95)';
      rr(cx - 5.5, top + 3, 11, h - 5, 2); g.fill();
      g.strokeStyle = '#39f6ff'; g.lineWidth = 1.1; g.stroke();
      /* наплечники */
      g.fillStyle = 'rgba(57,246,255,0.22)';
      rr(cx - 8, top + 4, 4, 5, 1.4); g.fill();
      rr(cx + 4, top + 4, 4, 5, 1.4); g.fill();
      /* шлем */
      g.fillStyle = '#1b2a4a';
      rr(cx - 3.6, top, 7.2, 5, 1.8); g.fill();
      g.strokeStyle = '#b6ff3c'; g.lineWidth = 0.8; g.stroke();
      /* визор */
      g.fillStyle = '#b6ff3c'; g.globalAlpha = 0.95;
      g.fillRect(cx - 2.4 + dir * 0.4, top + 1.6, 4.6, 1.5);
      g.globalAlpha = 1;
      /* ядро */
      glowDot(cx, top + h * 0.55, 1.7, '#ffcc55', 9);
      /* ноги */
      g.strokeStyle = '#39f6ff'; g.lineWidth = 1.4;
      const step = Math.abs(p.vx) > 6 && p.onGround ? Math.sin(p.step * Math.PI * 2) * 1.6 : 0;
      vline(cx - 3, top + h - 5, cx - 3 - step, feet, '#39f6ff', 1.4);
      vline(cx + 3, top + h - 5, cx + 3 + step, feet, '#39f6ff', 1.4);
      /* пушка */
      g.strokeStyle = '#ffcc55'; g.lineWidth = 1.3;
      vline(cx + dir * 4, top + 6, cx + dir * 8.5, top + 6, '#ffcc55', 1.3);
      glowDot(cx + dir * 8.5, top + 6, 1, '#ffcc55', 6);
    } else {
      const top = feet - h;
      /* костюм */
      const grad = g.createLinearGradient(cx - 4, top, cx + 4, feet);
      grad.addColorStop(0, '#f2f0ff');
      grad.addColorStop(1, '#8f9bd8');
      g.fillStyle = grad;
      rr(cx - 3.4, top + 3, 6.8, h - 6, 2.2); g.fill();
      /* шлем */
      g.fillStyle = '#1a2340';
      g.beginPath(); g.arc(cx + dir * 0.5, top + 2.4, 3.1, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#39f6ff'; g.lineWidth = 0.8; g.stroke();
      /* визор */
      g.fillStyle = '#39f6ff';
      g.globalAlpha = 0.95;
      g.fillRect(cx + (dir > 0 ? 0.6 : -3.4), top + 1.6, 2.8, 1.2);
      g.globalAlpha = 1;
      /* ноги */
      g.strokeStyle = '#e8e6ff'; g.lineWidth = 1.3;
      const walking = Math.abs(p.vx) > 6 && p.onGround;
      const sw = walking ? Math.sin(p.step * Math.PI * 2) * 1.7 : 0;
      if (!p.onGround) {
        vline(cx - 2, top + h - 4, cx - 3.5, feet, '#e8e6ff', 1.3);
        vline(cx + 2, top + h - 4, cx + 3, feet - 1, '#e8e6ff', 1.3);
      } else {
        vline(cx - 1.6, top + h - 5, cx - 1.6 - sw, feet, '#e8e6ff', 1.3);
        vline(cx + 1.6, top + h - 5, cx + 1.6 + sw, feet, '#e8e6ff', 1.3);
      }
      /* бластер */
      g.strokeStyle = '#ffcc55'; g.lineWidth = 1.2;
      vline(cx + dir * 2, top + 7.5, cx + dir * 6.5, top + 7.5, '#ffcc55', 1.2);
      glowDot(cx + dir * 6.5, top + 7.5, 0.9, '#ffcc55', 6);
      /* ранец */
      g.fillStyle = 'rgba(57,246,255,0.35)';
      g.fillRect(cx - dir * 4.2, top + 6, 1.4, 3);
    }
    g.restore();
  }

  /* ---------- снаряды и эффекты ---------- */
  function drawDeathOverlay() {
    const st = S();
    g.fillStyle = 'rgba(20,2,8,0.45)'; g.fillRect(0, 0, W, VH);
    glowText(EX.t('msg.dead'), W / 2, 84, 10, '#ff4d6d', 'center', '800', 16, HEAD_FONT);
    text(EX.t('hud.lives') + '  ' + st.lives, W / 2, 100, 4, 'rgba(235,235,255,0.85)', 'center', '600', 1);
  }

  function drawShots(T) {
    const st = S();
    g.save();
    g.globalCompositeOperation = 'lighter';
    st.shots.forEach(function (s) {
      if (s.grenade) {
        const gr = g.createRadialGradient(s.x, s.y, 0, s.x, s.y, 6);
        gr.addColorStop(0, 'rgba(255,204,85,0.95)');
        gr.addColorStop(1, 'rgba(255,60,60,0)');
        g.fillStyle = gr;
        g.beginPath(); g.arc(s.x, s.y, 6, 0, Math.PI * 2); g.fill();
        dot(s.x, s.y, 1.8, '#fff6c8');
      } else {
        const lg = g.createLinearGradient(s.x - 10, s.y, s.x + 4, s.y);
        lg.addColorStop(0, 'rgba(57,246,255,0)');
        lg.addColorStop(1, s.exo ? 'rgba(182,255,60,0.95)' : 'rgba(57,246,255,0.95)');
        g.strokeStyle = lg; g.lineWidth = 2;
        g.beginPath(); g.moveTo(s.x - 10, s.y); g.lineTo(s.x + 3, s.y); g.stroke();
        dot(s.x + 2.5, s.y, 1.2, '#ffffff');
      }
    });
    st.eShots.forEach(function (s) {
      if (s.missile) {
        for (let i = 0; i < 4; i++) {
          g.globalAlpha = 0.35 - i * 0.07;
          dot(s.x - Math.cos(s.ang) * i * 3, s.y - Math.sin(s.ang) * i * 3, 2.6 - i * 0.4, '#ff4d6d');
        }
        g.globalAlpha = 1;
        glowDot(s.x, s.y, 2, '#ff4d6d', 10);
      } else {
        g.strokeStyle = 'rgba(255,63,240,0.5)'; g.lineWidth = 1.4;
        g.beginPath(); g.moveTo(s.x - s.vx * 0.03, s.y - s.vy * 0.03); g.lineTo(s.x, s.y); g.stroke();
        glowDot(s.x, s.y, 1.7, '#ff3ff0', 8);
      }
    });
    st.particles.forEach(function (p) {
      const a = Math.max(0, p.life / (p.max || 1));
      g.globalAlpha = a;
      g.fillStyle = p.color;
      g.beginPath(); g.arc(p.x, p.y, Math.max(0.4, p.size * 0.6), 0, Math.PI * 2); g.fill();
    });
    g.globalAlpha = 1;
    st.booms.forEach(function (b) {
      const k = b.t / b.dur;
      const r = 2 + b.r * (0.3 + k * 1.1);
      const rg = g.createRadialGradient(b.x, b.y, 0, b.x, b.y, r);
      rg.addColorStop(0, 'rgba(255,255,255,' + (0.75 * (1 - k)) + ')');
      rg.addColorStop(0.45, 'rgba(255,204,85,' + (0.5 * (1 - k)) + ')');
      rg.addColorStop(1, 'rgba(255,60,60,0)');
      g.fillStyle = rg;
      g.beginPath(); g.arc(b.x, b.y, r, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(255,255,255,' + (0.6 * (1 - k)) + ')';
      g.lineWidth = 1;
      g.beginPath(); g.arc(b.x, b.y, r * 0.9, 0, Math.PI * 2); g.stroke();
    });
    g.restore();
    /* всплывающие очки — обычный режим, чтобы читались */
    st.pops.forEach(function (p) {
      g.globalAlpha = Math.min(1, p.life / 0.4);
      glowText(p.text, p.x, p.y - 6, 5, p.color, 'center', '700', 6);
      g.globalAlpha = 1;
    });
  }

  /* ---------- HUD ---------- */
  function drawHUD(T) {
    const st = S();
    const p = st.player || { laser: 0, maxLaser: 100, rockets: 0, armor: 0, exo: false };
    const y = H;
    /* стеклянная панель */
    g.fillStyle = 'rgba(6,4,18,0.82)';
    g.fillRect(0, y, W, HUD);
    const lg = g.createLinearGradient(0, y, W, y);
    lg.addColorStop(0, 'rgba(57,246,255,0)');
    lg.addColorStop(0.5, 'rgba(57,246,255,0.75)');
    lg.addColorStop(1, 'rgba(255,63,240,0)');
    g.fillStyle = lg; g.fillRect(0, y, W, 0.7);

    text(EX.t('hud.score'), 6, y + 4.2, 3, N.dim, 'left', '600', 0.6);
    text(String(st.score).padStart(6, '0'), 6, y + 10.4, 6.2, N.white, 'left', '700');
    text(EX.t('hud.lives'), 52, y + 4.2, 3, N.dim, 'left', '600', 0.6);
    text('×' + st.lives, 52, y + 10.6, 6.2, N.red, 'left', '700');

    text(EX.t('hud.sector'), 84, y + 4.2, 3, N.dim, 'left', '600', 0.6);
    text((st.level + 1) + '/' + EX.levelCount(), 84, y + 10.6, 5.4, T.a, 'left', '700');
    text(EX.t('hud.screen'), 108, y + 4.2, 3, N.dim, 'left', '600', 0.6);
    text((st.screen + 1) + '/' + EX.screenCount(st.level), 108, y + 10.6, 5.4, T.a, 'left', '700');

    /* лазер */
    text(EX.t('hud.laser'), 134, y + 4.2, 3, N.dim, 'left', '600', 0.6);
    const bw = 34, bx = 134;
    g.fillStyle = 'rgba(57,246,255,0.12)';
    g.fillRect(bx, y + 9, bw, 3.4);
    const fillW = bw * Math.max(0, Math.min(1, p.laser / (p.maxLaser || 100)));
    const lg2 = g.createLinearGradient(bx, 0, bx + bw, 0);
    lg2.addColorStop(0, '#39f6ff'); lg2.addColorStop(1, '#b6ff3c');
    g.fillStyle = lg2; g.fillRect(bx, y + 9, fillW, 3.4);
    for (let i = 1; i < 8; i++) { g.fillStyle = 'rgba(6,4,18,0.9)'; g.fillRect(bx + (bw / 8) * i, y + 9, 0.6, 3.4); }

    /* гранаты */
    text(EX.t('hud.rockets'), 174, y + 4.2, 3, N.dim, 'left', '600', 0.6);
    const maxR = p.maxRockets || 6;
    const pipW = 4.4, gap = 1.6;
    for (let i = 0; i < maxR; i++) {
      const on = i < p.rockets;
      g.fillStyle = on ? '#ff3ff0' : 'rgba(255,63,240,0.16)';
      rr(174 + i * (pipW + gap), y + 9, pipW, 3.4, 1); g.fill();
    }

    /* броня */
    if (p.exo) {
      text('A' + p.armor, 212, y + 10.6, 5, '#ffcc55', 'left', '700');
      for (let i = 0; i < 3; i++) {
        g.fillStyle = i < p.armor ? '#ffcc55' : 'rgba(255,204,85,0.18)';
        g.fillRect(228 + i * 8, y + 9.2, 5.5, 3.4);
      }
    }
    /* полоса «до выхода» */
    g.globalAlpha = 0.5;
    g.fillStyle = T.a;
    const prog = Math.max(0, Math.min(1, (st.player ? st.player.x : 0) / W));
    g.fillRect(W - 26 * prog, y + 1.4, 26 * prog, 0.7);
    g.globalAlpha = 1;
  }

  /* ---------- рамка сцены и боковые панели ---------- */
  function chrome(T) {
    const s = V.stage;
    g.save();
    /* контур сцены */
    g.strokeStyle = 'rgba(120,150,255,0.22)';
    g.lineWidth = 1;
    g.strokeRect(s.x - 0.5, s.y - 0.5, s.w + 1, s.h + 1);
    /* уголки */
    const L = Math.min(26, s.w * 0.08);
    g.strokeStyle = T.a;
    g.lineWidth = 1.6;
    g.globalAlpha = 0.9;
    const corners = [[s.x, s.y, 1, 1], [s.x + s.w, s.y, -1, 1], [s.x, s.y + s.h, 1, -1], [s.x + s.w, s.y + s.h, -1, -1]];
    corners.forEach(function (c) {
      g.beginPath();
      g.moveTo(c[0], c[1] + c[3] * L); g.lineTo(c[0], c[1]); g.lineTo(c[0] + c[2] * L, c[1]);
      g.stroke();
    });
    g.globalAlpha = 1;

    /* подписи над сценой */
    const st = S();
    const lv = EX.levelData(st.level);
    const inRun = ['play', 'paused', 'dead', 'bonus', 'levelclear', 'briefing', 'gameover', 'win'].indexOf(st.mode) >= 0;
    const label = inRun
      ? 'ПРОРЫВ // ' + EX.t('hud.sector') + ' ' + String(st.level + 1).padStart(2, '0') +
        (lv ? ' · ' + (lv.name[EX.settings.lang] || lv.name.ru) : '')
      : 'ПРОРЫВ // ' + EX.t('tagline');
    g.font = '600 ' + Math.max(10, s.h * 0.016) + 'px ' + UI_FONT;
    const above = s.y > 26;
    const ty = above ? s.y - 8 : s.y + 12;
    g.fillStyle = 'rgba(200,210,255,' + (above ? 0.5 : 0.42) + ')';
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.fillText(label, s.x, ty);
    g.textAlign = 'right';
    g.fillStyle = 'rgba(57,246,255,0.55)';
    g.fillText(EX.settings.gfx === 'modern' ? 'NEON 2026' : 'RETRO', s.x + s.w, ty);

    /* боковые панели / вертикальные водяные знаки */
    const side = s.x;
    const right = V.cw - (s.x + s.w);
    if (side > 154) {
      g.textAlign = 'left';
      g.fillStyle = 'rgba(220,225,255,0.85)';
      g.font = '700 ' + Math.round(s.h * 0.028) + 'px ' + HEAD_FONT;
      g.fillText(EX.t('brand'), s.x - side + 20, s.y + s.h * 0.15);
      g.font = '600 ' + Math.round(s.h * 0.013) + 'px ' + UI_FONT;
      g.fillStyle = 'rgba(140,150,200,0.8)';
      const lines = [
        EX.t('hud.score') + ' ' + String(st.score).padStart(6, '0'),
        EX.t('hud.lives') + ' ' + st.lives,
        EX.t('hud.sector') + ' ' + (st.level + 1) + '/' + EX.levelCount(),
        EX.t('hud.screen') + ' ' + (st.screen + 1) + '/' + EX.screenCount(st.level)
      ];
      lines.forEach(function (l, i) { g.fillText(l, s.x - side + 20, s.y + s.h * 0.22 + i * s.h * 0.032); });
      const keysY = s.y + s.h * 0.58;
      const keys = ['← →', 'SPACE', 'G', 'L', 'M', 'ESC'];
      const acts = [EX.t('key.left.act'), EX.t('key.fire.act'), EX.t('key.g.act'), EX.t('key.l.act'), EX.t('key.m.act'), EX.t('key.pause.act')];
      g.font = '600 ' + Math.round(s.h * 0.0125) + 'px ' + UI_FONT;
      keys.forEach(function (k, i) {
        g.fillStyle = 'rgba(57,246,255,0.85)';
        g.fillText(k, s.x - side + 20, keysY + i * s.h * 0.04);
        g.fillStyle = 'rgba(140,150,200,0.6)';
        g.fillText(acts[i], s.x - side + 20 + 54, keysY + i * s.h * 0.04);
      });
      g.fillStyle = 'rgba(255,255,255,0.2)';
      g.fillRect(s.x - side + 20, s.y + s.h * 0.55, side - 46, 1);
    } else if (side > 26) {
      /* узкая полоса: вертикальный водяной знак */
      g.save();
      g.translate(s.x - side * 0.5, s.y + s.h * 0.5);
      g.rotate(-Math.PI / 2);
      g.font = '800 ' + Math.round(side * 0.36) + 'px ' + HEAD_FONT;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = 'rgba(160,175,255,0.10)';
      g.fillText('ПРОРЫВ', 0, 0);
      g.restore();
    }

    if (right > 190) {
      const rx = s.x + s.w + 20;
      g.textAlign = 'left';
      g.fillStyle = 'rgba(255,63,240,0.45)';
      g.fillRect(rx, s.y + s.h * 0.16, 24, 1);
      g.font = '500 ' + Math.round(s.h * 0.0105) + 'px ' + UI_FONT;
      g.fillStyle = 'rgba(140,150,200,0.7)';
      const tip = EX.t('hint.exo');
      const lines = wrap(tip, Math.round(s.h * 0.0105), right - 30, '500');
      lines.slice(0, 10).forEach(function (l, i) { g.fillText(l, rx, s.y + s.h * 0.2 + i * s.h * 0.024); });
      g.fillStyle = 'rgba(160,175,255,0.10)';
      g.font = '800 ' + Math.round(side * 0.3) + 'px ' + HEAD_FONT;
      g.fillText('1987', rx, s.y + s.h * 0.85);
    } else if (right > 26) {
      g.save();
      g.translate(s.x + s.w + right * 0.5, s.y + s.h * 0.5);
      g.rotate(Math.PI / 2);
      g.font = '800 ' + Math.round(right * 0.3) + 'px ' + HEAD_FONT;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = 'rgba(255,63,240,0.09)';
      g.fillText('2026', 0, 0);
      g.restore();
    }

    g.restore();
  }

  /* ---------- вспомогательные «стеклянные» панели ---------- */
  function glass(x, y, w, h, accent, alpha) {
    g.save();
    g.fillStyle = 'rgba(10,8,28,' + (alpha == null ? 0.72 : alpha) + ')';
    rr(x, y, w, h, 3); g.fill();
    g.strokeStyle = accent; g.globalAlpha = 0.35; g.lineWidth = 0.8;
    rr(x, y, w, h, 3); g.stroke();
    g.globalAlpha = 1;
    /* верхний блик */
    const lg = g.createLinearGradient(x, y, x + w, y);
    lg.addColorStop(0, 'rgba(255,255,255,0)');
    lg.addColorStop(0.5, 'rgba(255,255,255,0.16)');
    lg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = lg; g.fillRect(x + 2, y, w - 4, 0.6);
    g.restore();
  }

  function menuDraw(accent, title, hintKey) {
    const st = S();
    const rects = EX.ui.layout();
    if (!rects.length) return;
    const first = rects[0], last = rects[rects.length - 1];
    const px0 = first.x - 22, py0 = first.y - 14;
    const pw = first.w + 44, ph = last.y + last.h - first.y + 28;
    glass(px0, py0, pw, ph, accent, 0.5);
    if (title) text(title, first.cx, py0 + 7, 4.6, accent, 'center', '700', 1.2);

    rects.forEach(function (r, i) {
      const sel = i === st.menuIndex;
      if (sel) {
        g.save();
        g.fillStyle = 'rgba(57,246,255,0.10)';
        rr(r.x - 14, r.y, r.w + 28, r.h, 2); g.fill();
        g.fillStyle = accent;
        g.fillRect(r.x - 14, r.y + 1, 1.4, r.h - 2);
        g.restore();
      }
      const col = sel ? '#ffffff' : 'rgba(200,210,255,0.66)';
      if (r.item.key === 'back') {
        text(r.item.value || 'ESC', r.cx, r.cy, 4.2, sel ? accent : 'rgba(140,150,200,0.6)', 'center', '600', 1);
        return;
      }
      text(r.item.label, r.x - 6, r.cy, 4.4, col, 'left', '600', 0.5);
      if (r.item.value) text(r.item.value, r.x + r.w + 6, r.cy, 4.2, sel ? accent : 'rgba(140,150,200,0.75)', 'right', '700', 0.4);
      if (sel) glowDot(r.x - 14, r.cy, 1, accent, 6);
    });
    text(EX.t(hintKey || 'msg.paused.hint'), first.cx, py0 + ph - 4, 3, 'rgba(140,150,200,0.65)', 'center', '500', 0.4);
  }

  /* ---------- экраны ---------- */
  function drawTitle() {
    const st = S();
    const T = THEMES.space;
    /* декоративные кольца */
    g.save();
    for (let i = 0; i < 3; i++) {
      const r = 40 + i * 16 + Math.sin(t * 0.7 + i) * 3;
      g.strokeStyle = 'rgba(57,246,255,' + (0.16 - i * 0.04) + ')';
      g.lineWidth = 1;
      g.beginPath(); g.ellipse(W / 2, 60, r * 1.5, r * 0.5, 0, 0, Math.PI * 2); g.stroke();
    }
    g.restore();

    /* логотип */
    const size = 34;
    g.font = '800 ' + size + 'px ' + HEAD_FONT;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const lg = g.createLinearGradient(W / 2 - 80, 0, W / 2 + 80, 0);
    lg.addColorStop(0, '#39f6ff');
    lg.addColorStop(0.45, '#f2f0ff');
    lg.addColorStop(1, '#ff3ff0');
    /* хроматическая аберрация */
    try { g.letterSpacing = '4px'; } catch (e) { /* ok */ }
    g.globalAlpha = 0.5; g.fillStyle = 'rgba(255,63,240,0.55)'; g.fillText('ПРОРЫВ', W / 2 - 1.4, 41);
    g.fillStyle = 'rgba(57,246,255,0.55)'; g.fillText('ПРОРЫВ', W / 2 + 1.4, 42);
    g.globalAlpha = 1;
    g.save();
    g.shadowColor = 'rgba(57,246,255,0.65)';
    g.shadowBlur = 22;
    g.fillStyle = lg;
    g.fillText('ПРОРЫВ', W / 2, 41.5);
    g.restore();
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.globalAlpha = 0.9;
    g.fillText('ПРОРЫВ', W / 2, 41.5 - 0.35);
    g.globalAlpha = 1;
    try { g.letterSpacing = '0px'; } catch (e) { /* ok */ }

    /* линия и подзаголовок */
    const lg2 = g.createLinearGradient(30, 0, W - 30, 0);
    lg2.addColorStop(0, 'rgba(57,246,255,0)');
    lg2.addColorStop(0.5, 'rgba(57,246,255,0.9)');
    lg2.addColorStop(1, 'rgba(255,63,240,0)');
    g.fillStyle = lg2; g.fillRect(30, 63, W - 60, 0.8);
    text('ШТУРМОВИК', W / 2, 74, 9, 'rgba(240,238,255,0.92)', 'center', '700', 3.5, HEAD_FONT);
    text(EX.t('tagline.full'), W / 2, 87, 4, T.a, 'center', '500', 0.8);

    menuDraw(T.a, null, 'menu.hint');

    /* рекорд */
    text(EX.t('msg.record'), 6, 8, 3.2, 'rgba(140,150,200,0.7)', 'left', '600', 0.8);
    text(String(st.record).padStart(6, '0'), 6, 14, 5, '#ffcc55', 'left', '700');
    text(EX.t('credits.original'), W - 6, 8, 3.2, 'rgba(140,150,200,0.55)', 'right', '500', 0.5);
    text('HTML5 · 2026', W - 6, 14, 3.2, 'rgba(57,246,255,0.7)', 'right', '600', 0.6);
    text(EX.t('menu.hint.quick'), W / 2, VH - 6, 3.2, 'rgba(140,150,200,0.6)', 'center', '500', 0.5);
    if (EX.BUILD) text(EX.t('settings.build', { v: EX.BUILD }), W - 6, VH - 16, 2.6, 'rgba(120,140,220,0.45)', 'right', '500', 0.5);
  }

  function drawWorld() {
    const T = th();
    const st = S();
    stageBackdrop();
    drawTiles(T);
    st.ents.forEach(function (e) { if (!e.dead) drawEntity(e, T); });
    drawShots(T);
    drawPlayer(st.player, T);
    drawHUD(T);
    /* вспышка */
    if (st.fx.flash > 0.01) {
      g.globalAlpha = Math.min(0.4, st.fx.flash);
      g.fillStyle = st.fx.flashColor || '#ffffff';
      g.fillRect(0, 0, W, VH);
      g.globalAlpha = 1;
    }
    /* сообщение */
    if (st.message) {
      const s = EX.t(st.message.key);
      const w = textW(s, 4.2, '700', 1) + 16;
      glass(W / 2 - w / 2, 70, w, 13, '#39f6ff', 0.72);
      glowText(s, W / 2, 76.5, 4.2, '#39f6ff', 'center', '700', 10);
    }
    /* затвор перехода */
    if (st.transition > 0) {
      const k = st.transition;
      const hh = k * k * (H / 2) * 1.1;
      g.fillStyle = '#04030c';
      g.fillRect(0, 0, W, hh);
      g.fillRect(0, H - hh, W, hh);
      g.fillStyle = 'rgba(57,246,255,0.5)';
      g.fillRect(0, hh, W, 0.6);
      g.fillRect(0, H - hh - 0.6, W, 0.6);
    }
  }

  function drawPause() {
    drawWorld();
    g.fillStyle = 'rgba(4,3,14,0.7)'; g.fillRect(0, 0, W, VH);
    glowText(EX.t('msg.paused'), W / 2, 38, 13, '#ffffff', 'center', '800', 18, HEAD_FONT);
    text(EX.t('pause.gfx', { v: EX.settings.gfx === 'modern' ? 'NEON · 2026' : 'RETRO · ZX' }) + '   [G]', W / 2, 52, 3.2, 'rgba(140,150,200,0.8)', 'center', '500', 0.8);
    menuDraw('#39f6ff', null);
  }

  function drawHelp() {
    const T = THEMES.space;
    stageBackdrop();
    glass(6, 6, W - 12, VH - 12, T.a, 0.82);
    glowText(EX.t('help.title'), W / 2, 18, 10, T.a, 'center', '800', 14, HEAD_FONT);
    g.fillStyle = 'rgba(57,246,255,0.3)';
    g.fillRect(24, 28, W - 48, 0.8);
    const rows = [
      ['key.left', 'key.left.act'], ['key.jump', 'key.jump.act'],
      ['key.duck', 'key.duck.act'], ['key.fire', 'key.fire.act'],
      ['key.pause', 'key.pause.act'], ['key.l', 'key.l.act'],
      ['key.g', 'key.g.act'], ['key.m', 'key.m.act'], ['key.f', 'key.f.act']
    ];
    let y = 37;
    rows.forEach(function (r) {
      text(EX.t(r[0]), 14, y, 3.6, '#ffcc55', 'left', '700', 0.3);
      text(EX.t(r[1]), 84, y, 3.4, 'rgba(235,235,255,0.9)', 'left', '400', 0.1);
      y += 7.2;
    });
    y += 3;
    g.fillStyle = 'rgba(57,246,255,0.25)'; g.fillRect(24, y, W - 48, 0.6); y += 5;
    text(EX.t('hint.title'), 14, y, 3.6, T.a, 'left', '700', 1); y += 7;
    [EX.t('hint.goal'), EX.t('hint.grenade'), EX.t('hint.exo'), EX.t('hint.ammo')].forEach(function (s) {
      wrap(s, 3.2, W - 30, '400').forEach(function (line) {
        text(line, 14, y, 3.2, 'rgba(225,225,250,0.82)', 'left', '400', 0);
        y += 5.6;
      });
      y += 1.2;
    });
    text(EX.t('help.back'), W / 2, VH - 8, 3.4, 'rgba(140,150,200,0.85)', 'center', '500', 0.6);
  }

  function drawAbout() {
    const T = THEMES.hive;
    stageBackdrop();
    glass(8, 8, W - 16, VH - 16, '#ff3ff0', 0.84);
    const lg = g.createLinearGradient(W / 2 - 60, 0, W / 2 + 60, 0);
    lg.addColorStop(0, '#39f6ff'); lg.addColorStop(1, '#ff3ff0');
    g.font = '800 16px ' + HEAD_FONT;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = lg;
    g.fillText('ПРОРЫВ', W / 2, 24);
    text(EX.t('tagline'), W / 2, 38, 3.4, 'rgba(235,235,255,0.8)', 'center', '500', 1);
    g.fillStyle = 'rgba(255,63,240,0.3)'; g.fillRect(30, 45, W - 60, 0.7);
    let y = 53;
    wrapMulti(EX.t('about.text'), 3.7, W - 30, '400').forEach(function (l) {
      text(l, 15, y, 3.7, 'rgba(230,230,250,0.9)', 'left', '400', 0); y += 6.4;
    });
    y += 4;
    [EX.t('credits.original'), EX.t('credits.port'), EX.t('credits.thanks'), EX.t('credits.fan')].forEach(function (s, i) {
      text(s, W / 2, y, 3.4, i < 2 ? (i ? '#39f6ff' : '#ffcc55') : 'rgba(150,150,200,0.85)', 'center', '500', 0.3);
      y += 6;
    });
    text(EX.t('help.back'), W / 2, VH - 8, 3.2, 'rgba(140,150,200,0.8)', 'center', '500', 0.6);
  }

  function drawSettings() {
    const st = S();
    const T = THEMES.space;
    drawWorld();
    g.fillStyle = 'rgba(4,3,14,0.78)'; g.fillRect(0, 0, W, VH);
    glass(20, 22, W - 40, 156, T.a, 0.82);
    glowText(EX.t('settings.title'), W / 2, 36, 9, T.a, 'center', '800', 14, HEAD_FONT);
    g.fillStyle = 'rgba(57,246,255,0.25)'; g.fillRect(36, 44, W - 72, 0.7);
    const rects = EX.ui.layout();
    rects.forEach(function (r, i) {
      const sel = i === st.menuIndex;
      if (sel) {
        g.fillStyle = 'rgba(57,246,255,0.10)';
        rr(r.x - 18, r.y, r.w + 50, r.h, 2); g.fill();
        g.fillStyle = T.a;
        g.fillRect(r.x - 18, r.y + 1, 1.4, r.h - 2);
      }
      if (r.item.key === 'back') {
        text(r.item.value || 'ESC', W / 2, r.cy, 3.6, sel ? T.a : 'rgba(140,150,200,0.7)', 'center', '600', 0.6);
        return;
      }
      text(r.item.label, r.x - 12, r.cy, 3.8, sel ? '#ffffff' : 'rgba(200,210,255,0.72)', 'left', '600', 0.4);
      if (r.item.value) text(r.item.value, r.x + r.w + 44, r.cy, 3.5, sel ? '#ffcc55' : 'rgba(140,150,200,0.75)', 'right', '600', 0.25);
    });
    if (st.resetAsk > 0) glowText(EX.t('settings.resetConfirm'), W / 2, 168, 3.6, '#ff4d6d', 'center', '700', 8);
    else text(EX.t('pause.gfx', { v: EX.settings.gfx === 'modern' ? 'NEON' : 'RETRO' }) + '   G', W / 2, 168, 3, 'rgba(140,150,200,0.7)', 'center', '500', 0.4);
    if (EX.BUILD) text(EX.t('settings.build', { v: EX.BUILD }), W / 2, 190, 2.8, 'rgba(120,140,220,0.5)', 'center', '500', 0.6);
  }

  function drawBriefing() {
    const st = S();
    const lv = EX.levelData(st.level) || { name: { ru: '' }, intro: { ru: '' }, theme: 'space' };
    const T = THEMES[lv.theme] || THEMES.space;
    stageBackdrop();
    /* водяной знак сектора */
    g.save();
    g.globalAlpha = 0.07;
    g.font = '800 120px ' + HEAD_FONT;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = T.a;
    g.fillText(String(st.level + 1), W - 52, 96);
    g.restore();
    glass(10, 10, W - 20, VH - 20, T.a, 0.5);
    text(EX.t('hud.sector') + ' ' + (st.level + 1) + ' / ' + EX.levelCount(), 18, 24, 3.4, T.a, 'left', '700', 1.4);
    glowText(lv.name[EX.settings.lang] || lv.name.ru, 18, 38, 9.5, '#ffffff', 'left', '800', 12, HEAD_FONT);
    g.fillStyle = T.a; g.globalAlpha = 0.5; g.fillRect(18, 47, 96, 0.8); g.globalAlpha = 1;
    let y = 56;
    wrapMulti(lv.intro[EX.settings.lang] || lv.intro.ru, 3.4, W - 44, '400').forEach(function (l) {
      text(l, 18, y, 3.4, 'rgba(230,230,250,0.9)', 'left', '400', 0); y += 6;
    });
    y += 4;
    /* цели-карточки */
    const cards = [
      { k: 'hint.grenade', c: '#ffcc55' },
      { k: 'hint.exo', c: '#39f6ff' },
      { k: 'hint.ammo', c: '#ff3ff0' }
    ];
    cards.forEach(function (card) {
      const lines = wrap(EX.t(card.k), 3, W - 58, '400');
      const h = 5 + lines.length * 5.2;
      glass(18, y - 3, W - 36, h, card.c, 0.28);
      g.fillStyle = card.c; g.fillRect(18, y - 3, 1.2, h);
      lines.forEach(function (l, i) { text(l, 24, y + 1 + i * 5.2, 3, 'rgba(225,225,250,0.85)', 'left', '400', 0); });
      y += h + 3;
    });
    /* прогресс экранов */
    const sx0 = W / 2 - (5 * 10) / 2;
    for (let i = 0; i < 5; i++) {
      const dx = sx0 + i * 10;
      g.strokeStyle = 'rgba(57,246,255,0.5)'; g.lineWidth = 0.8;
      g.beginPath(); g.arc(dx + 4, 124, 2.4, 0, Math.PI * 2); g.stroke();
      if (i === 0) { g.fillStyle = '#39f6ff'; g.beginPath(); g.arc(dx + 4, 124, 1.4, 0, Math.PI * 2); g.fill(); }
    }
    /* кто встретится */
    const roster = [
      { draw: function () { drawWalker({ x: 0, y: 0, w: 14, h: 12, dir: 1, anim: 0, hitT: 0 }, T); } },
      { draw: function () { drawFlyer({ x: 0, y: 0, w: 16, h: 12, dir: 1, anim: 0, hitT: 0 }, T); } },
      { draw: function () { drawTurret({ x: 0, y: 0, w: 12, h: 10, dir: 1, hitT: 0 }, T); } },
      { draw: function () { drawPod({ x: 0, y: 0, w: 14, h: 12, dir: 1, anim: 0, hitT: 0 }, T); } }
    ];
    for (let i = 0; i < roster.length; i++) {
      g.save();
      g.translate(W / 2 - 39 + i * 26, 148);
      g.globalAlpha = 0.85;
      roster[i].draw();
      g.restore();
    }
    text('?  ?  ?  ?', 0, 0, 1, 'rgba(0,0,0,0)', 'left', '400', 0);
    /* кнопка старта */
    const pulse = 0.55 + 0.45 * Math.sin(t * 3.4);
    g.globalAlpha = pulse;
    glass(60, VH - 30, W - 120, 14, '#39f6ff', 0.85);
    glowText(EX.t('level.start'), W / 2, VH - 23, 4.6, '#39f6ff', 'center', '700', 12);
    g.globalAlpha = 1;
    text(EX.t('level.screens', { n: EX.screenCount(st.level) }), 18, VH - 6, 3, 'rgba(140,150,200,0.7)', 'left', '500', 0.4);
  }

  function drawBonus() {
    const st = S();
    const b = st.bonus;
    if (!b) return;
    drawWorld();
    g.fillStyle = 'rgba(4,3,14,0.8)'; g.fillRect(0, 0, W, VH);
    glass(14, 30, W - 28, 140, '#ffcc55', 0.85);
    glowText(EX.t('msg.bonus'), W / 2, 45, 11, '#ffcc55', 'center', '800', 16, HEAD_FONT);
    const bx = [36, 78, 120, 162];
    if (b.phase === 'pick') {
      b.values.forEach(function (v, i) {
        const on = i === b.index;
        const x = bx[i];
        glass(x, 66, 34, 30, on ? '#ffcc55' : 'rgba(140,150,200,0.55)', on ? 0.9 : 0.4);
        if (on) {
          g.save();
          g.shadowColor = '#ffcc55'; g.shadowBlur = 14;
          g.strokeStyle = 'rgba(255,204,85,0.9)'; g.lineWidth = 1;
          rr(x, 66, 34, 30, 3); g.stroke();
          g.restore();
        }
        text(String(v), x + 17, 81, on ? 9 : 7.5, on ? '#ffffff' : 'rgba(200,210,255,0.7)', 'center', '800');
      });
      text(EX.t('msg.bonus.pick'), W / 2, 108, 4, '#ffffff', 'center', '600', 0.8);
      text(EX.t('msg.bonus.pick2'), W / 2, 118, 3.4, 'rgba(200,210,255,0.7)', 'center', '500', 0.4);
    } else {
      glowText(String(b.chosen), W / 2, 74, 16, '#ffcc55', 'center', '800', 18, HEAD_FONT);
      text(EX.t('msg.bonus.lives') + '  →  ' + b.livesBonus, W / 2, 94, 3.6, '#39f6ff', 'center', '600', 0.5);
      text(b.noExoBonus ? EX.t('msg.bonus.noexo') : EX.t('msg.bonus.exo'), W / 2, 104, 3.6, b.noExoBonus ? '#b6ff3c' : '#ff4d6d', 'center', '600', 0.5);
      if (b.extraLife) text(EX.t('msg.bonus.extra'), W / 2, 114, 3.6, '#ffcc55', 'center', '700', 0.5);
    }
    text(EX.t('msg.score') + '  ' + st.score, W / 2, 132, 3.8, 'rgba(235,235,255,0.9)', 'center', '600', 0.6);
  }

  function drawLevelClear() {
    const st = S();
    drawWorld();
    g.fillStyle = 'rgba(4,3,14,0.72)'; g.fillRect(0, 0, W, VH);
    glowText(EX.t('msg.levelclear'), W / 2, 62, 14, '#b6ff3c', 'center', '800', 18, HEAD_FONT);
    text(EX.t('hud.sector') + ' ' + (st.level + 1) + '/' + EX.levelCount(), W / 2, 86, 4, 'rgba(235,235,255,0.9)', 'center', '600', 1.5);
    text(EX.t('msg.score') + ' ' + st.score, W / 2, 100, 4.4, '#ffcc55', 'center', '700', 0.6);
    for (let i = 0; i < 3; i++) {
      const a = 0.35 + 0.65 * Math.max(0, Math.sin(t * 4 - i * 0.6));
      g.globalAlpha = a;
      glowDot(W / 2 - 12 + i * 12, 118, 1.6, '#b6ff3c', 8);
      g.globalAlpha = 1;
    }
  }

  function drawGameOver() {
    const st = S();
    drawWorld();
    g.fillStyle = 'rgba(6,2,8,0.84)'; g.fillRect(0, 0, W, VH);
    glass(26, 28, W - 52, 152, '#ff4d6d', 0.82);
    glowText(EX.t('msg.gameover'), W / 2, 46, 13, '#ff4d6d', 'center', '800', 18, HEAD_FONT);
    text(EX.t('hud.score'), W / 2, 62, 3.2, 'rgba(140,150,200,0.8)', 'center', '600', 1);
    text(String(st.score), W / 2, 74, 9, '#ffffff', 'center', '700');
    text(EX.t('msg.record') + ' ' + st.record, W / 2, 88, 3.5, 'rgba(255,204,85,0.9)', 'center', '600', 0.4);
    if (st.newRecord) glowText(EX.t('msg.newrecord'), W / 2, 99, 4.2, '#b6ff3c', 'center', '800', 10);
    menuDraw('#ff4d6d', null);
  }

  function drawWin() {
    const st = S();
    stageBackdrop();
    const T = THEMES.space;
    /* частицы-искры */
    for (let i = 0; i < 40; i++) {
      const a = hash(i, 3) * Math.PI * 2;
      const sp = 6 + hash(i, 9) * 30;
      const x = W / 2 + Math.cos(a + t * 0.2) * sp * (1 + (t * 0.15) % 1);
      const y = 100 + Math.sin(a + t * 0.2) * sp * 0.6;
      g.globalAlpha = 0.15 + 0.3 * Math.abs(Math.sin(t * 2 + i));
      dot(x, y, hash(i, 5) > 0.7 ? 1.4 : 0.8, i % 3 ? T.b : T.a);
    }
    g.globalAlpha = 1;
    const winT = EX.t('msg.win');
    glowText(winT, W / 2, 42, textW(winT, 15, '800') > 240 ? 11 : 15, '#ffcc55', 'center', '800', 22, HEAD_FONT);
    text(EX.t('msg.win.sub'), W / 2, 68, 4, '#39f6ff', 'center', '600', 1.2);
    text(EX.t('msg.score'), W / 2, 92, 3.4, 'rgba(140,150,200,0.8)', 'center', '600', 1);
    text(String(st.score), W / 2, 106, 12, '#ffffff', 'center', '700');
    text(EX.t('msg.record') + ' ' + st.record, W / 2, 122, 3.6, '#ffcc55', 'center', '600', 0.4);
    if (st.newRecord) glowText(EX.t('msg.newrecord'), W / 2, 133, 4.6, '#b6ff3c', 'center', '800', 12);
    menuDraw('#ffcc55', null, 'menu.hint');
    text(EX.t('credits.original'), W / 2, VH - 6, 2.8, 'rgba(140,150,200,0.55)', 'center', '500', 0.5);
  }

  /* ---------- внешний вход ---------- */
  function draw(ctx, view) {
    g = ctx;
    V = view;
    t = view.t;
    const st = S();

    fullBg();

    g.save();
    /* клип по сцене */
    g.beginPath();
    g.rect(V.stage.x, V.stage.y, V.stage.w, V.stage.h);
    g.clip();
    g.translate(V.stage.x, V.stage.y);
    const sc = V.stage.w / W;
    g.scale(sc, sc);
    const shake = st.fx.shake;
    if (shake > 0.1) g.translate((Math.random() - 0.5) * shake * 0.8, (Math.random() - 0.5) * shake * 0.8);
    try {
      switch (st.mode) {
        case 'title': drawTitle(); break;
        case 'help': drawHelp(); break;
        case 'about': drawAbout(); break;
        case 'settings': drawSettings(); break;
        case 'briefing': drawBriefing(); break;
        case 'play': drawWorld(); break;
        case 'dead': drawWorld(); drawDeathOverlay(); break;
        case 'paused': drawPause(); break;
        case 'bonus': drawBonus(); break;
        case 'levelclear': drawLevelClear(); break;
        case 'gameover': drawGameOver(); break;
        case 'win': drawWin(); break;
        default: g.fillStyle = '#05030f'; g.fillRect(0, 0, W, VH); break;
      }
    } finally {
      g.restore();
    }

    /* виньетка сцены */
    g.save();
    g.beginPath(); g.rect(V.stage.x, V.stage.y, V.stage.w, V.stage.h); g.clip();
    const vg = g.createRadialGradient(V.stage.x + V.stage.w / 2, V.stage.y + V.stage.h / 2, V.stage.h * 0.35,
      V.stage.x + V.stage.w / 2, V.stage.y + V.stage.h / 2, V.stage.h * 0.85);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.42)');
    g.fillStyle = vg;
    g.fillRect(V.stage.x, V.stage.y, V.stage.w, V.stage.h);
    /* сканлайны */
    if (EX.settings.crt) {
      g.globalAlpha = 0.05;
      g.fillStyle = '#000';
      for (let y = V.stage.y; y < V.stage.y + V.stage.h; y += 3) {
        g.fillRect(V.stage.x, y, V.stage.w, 1);
      }
      g.globalAlpha = 1;
    }
    g.restore();

    chrome(th());
  }

  window.EX_RENDER_MODERN = { draw: draw, W: W, H: VH };
})();
