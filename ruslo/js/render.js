/* ============================================================================
 * РУСЛО · HTML5 — рендер
 * Два самостоятельных художественных режима:
 *   retro  — 8-бит: ограниченная палитра, крупные пиксели, дизеринг, растровые HUD;
 *   modern — неон: градиентная вода с каустикой, свечение, частицы, стеклянный HUD.
 * Оба рисуют одно и то же состояние S из game.js.
 * ========================================================================== */
'use strict';
(function (RR) {
  if (!RR) return;
  const { W, H, HUD_H, FOOT_H, PLAY_TOP, PLAY_H, PLANE_SY, clamp, lerp, pxText, pxWidth } = RR;

  /* ====================== палитры ====================== */
  const P = {
    ink: '#080b12',
    water: '#1a3f8c', waterDark: '#122c66', waterDeep: '#0d2050',
    wave: '#2f63c8', glint: '#8fd0ff', foam: '#c8ecff',
    land: '#2c6a2e', land2: '#3d8a37', land3: '#57ab4c', land4: '#204f24',
    sand: '#d9c26f',
    white: '#f2f6f4', offWhite: '#c9d6d0', black: '#07080d',
    red: '#d8452f', redDark: '#8e2217', yellow: '#f2c94c',
    grey: '#8c939c', darkGrey: '#3c424b', steel: '#b8c2c9',
    cyan: '#5ff2ff', hudBg: '#070a12', hudLine: '#1d2c42',
    hudLabel: '#7f9cc4', hudText: '#eaf6ff', fuelOk: '#5fe26b', fuelMid: '#f2c94c', fuelLow: '#ff5b4a',
    orange: '#ff9e3d',
  };
  const M = {
    land0: '#031713', land1: '#0a392c', land2: '#0e4a37',
    water0: '#071e2f', water1: '#0a3150', water2: '#0b4560',
    neon: '#39f0d0', neon2: '#4cc9ff', pink: '#ff4f9a', amber: '#ffb347',
    red: '#ff3b5c', white: '#eaf6ff', dim: 'rgba(175,215,240,.55)',
    hud: 'rgba(4,12,18,.72)', glass: 'rgba(10,26,38,.62)',
  };

  const hash = (n) => {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  };

  /** Мировая Y по экранной Y. */
  const worldY = (S, sy) => S.camY + PLAY_TOP + PLANE_SY - sy;

  function waterPath(ctx, S, inset = 0) {
    ctx.beginPath();
    const step = 6;
    for (let sy = PLAY_TOP; sy <= PLAY_TOP + PLAY_H + step; sy += step) {
      const r = RR.riverAt(worldY(S, sy));
      const x = r.L - inset;
      if (sy === PLAY_TOP) ctx.moveTo(x, sy); else ctx.lineTo(x, sy);
    }
    for (let sy = PLAY_TOP + PLAY_H + step; sy >= PLAY_TOP; sy -= step) {
      const r = RR.riverAt(worldY(S, sy));
      ctx.lineTo(r.R + inset, sy);
    }
    ctx.closePath();
  }

  function ellipseRow(ctx, cx, cy, rx, ry, rowH, fill) {
    ctx.fillStyle = fill;
    const y0 = Math.floor((cy - ry) / rowH) * rowH;
    for (let y = y0; y < cy + ry; y += rowH) {
      const dy = (y + rowH / 2 - cy) / ry;
      if (Math.abs(dy) >= 1) continue;
      const dx = rx * Math.sqrt(1 - dy * dy);
      ctx.fillRect(cx - dx, y, dx * 2, rowH);
    }
  }

  function clipPlay(ctx) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, PLAY_TOP, W, PLAY_H);
    ctx.clip();
  }

  /* ========================================================================
   * RETRO
   * ===================================================================== */
  function drawRetro(ctx, S) {
    clipPlay(ctx);
    // суша: крупный дизеринг из трёх зелёных тонов
    drawRetroLand(ctx, S);

    // вода + берег
    const RH = 4;
    const rows = [];
    for (let sy = PLAY_TOP; sy < PLAY_TOP + PLAY_H; sy += RH) {
      const wy = worldY(S, sy + RH / 2);
      const r = RR.riverAt(wy);
      const L = Math.max(0, Math.floor(r.L));
      const R = Math.min(W, Math.ceil(r.R));
      const span = Math.max(1, R - L);
      rows.push({ sy, wy, L, R });
      ctx.fillStyle = P.water;
      ctx.fillRect(L, sy, R - L, RH);
      // светлая мелководная полоса у берегов
      ctx.fillStyle = P.wave;
      ctx.fillRect(L, sy, Math.min(5, span), RH);
      ctx.fillRect(R - Math.min(5, span), sy, Math.min(5, span), RH);
      // кромка берега: светлая трава + тёмная подложка
      ctx.fillStyle = P.land3;
      ctx.fillRect(Math.max(0, L - 2), sy, 2, RH);
      ctx.fillStyle = P.land4;
      ctx.fillRect(Math.max(0, L - 5), sy, 3, RH);
      ctx.fillStyle = P.land3;
      ctx.fillRect(Math.min(W - 2, R), sy, 2, RH);
      ctx.fillStyle = P.land4;
      ctx.fillRect(Math.min(W - 1, R + 2), sy, 3, RH);
    }
    // волны: рваные штрихи, плывущие по течению
    for (const row of rows) {
      if (Math.round(row.sy / RH) % 5 !== 0) continue;
      const span = Math.max(0, row.R - row.L - 26);
      if (span < 14) continue;
      const shift = (S.time * 32 + row.wy * 0.7) % 1;
      const x = row.L + 9 + ((hash(Math.floor(row.wy / 8) * 5) * span + shift * span) % span);
      ctx.fillStyle = P.glint;
      ctx.fillRect(Math.floor(x), row.sy, 7, 1);
      ctx.fillRect(Math.floor(x) + 9, row.sy + 2, 3, 1);
      if (span > 46 && Math.round(row.sy) % 20 < 10) {
        const gx = row.L + 12 + ((S.time * 15 + hash(row.wy) * span) % (span - 12));
        ctx.fillStyle = P.foam;
        ctx.fillRect(Math.floor(gx), row.sy + 1, 2, 1);
      }
    }
    // острова: тёмная кромка, песчаная полоса, трава и подсветка
    for (const is of S.islands) {
      const sy = RR.screenY(is.y);
      if (sy < PLAY_TOP - 80 || sy > PLAY_TOP + PLAY_H + 80) continue;
      ellipseRow(ctx, is.x, sy, is.rx + 3, is.ry + 3, 4, '#123616');
      ellipseRow(ctx, is.x, sy, is.rx + 1.5, is.ry + 1.5, 4, P.sand);
      ellipseRow(ctx, is.x, sy, is.rx, is.ry, 4, P.land2);
      ellipseRow(ctx, is.x - is.rx * 0.22, sy - is.ry * 0.26, is.rx * 0.62, is.ry * 0.4, 4, P.land3);
      ctx.fillStyle = P.land4;
      for (let k = 0; k < 5; k++) {
        const a = hash(is.y + k) * Math.PI * 2;
        const rr = hash(is.x + k * 3) * 0.6;
        ctx.fillRect(Math.round(is.x + Math.cos(a) * is.rx * rr), Math.round(sy + Math.sin(a) * is.ry * rr), 2, 3);
      }
    }

    for (const d of S.depots) {
      const sy = RR.screenY(d.y);
      if (sy < PLAY_TOP - 40 || sy > PLAY_TOP + PLAY_H + 40) continue;
      drawDepotRetro(ctx, d, sy, S.time);
    }

    // мост
    if (S.bridge) drawBridgeRetro(ctx, S, S.bridge);

    // враги
    for (const e of S.enemies) {
      if (e.dead) continue;
      const sy = RR.screenY(e.y);
      if (sy < PLAY_TOP - 40 || sy > PLAY_TOP + PLAY_H + 40) continue;
      if (e.type === 'boat') drawBoatRetro(ctx, e.x, sy);
      else if (e.type === 'heli') drawHeliRetro(ctx, e.x, sy, S.time, e.t);
      else drawJetRetro(ctx, e.x, sy, e.vx);
    }

    // самолёт
    if (S.mode !== 'dying' && S.mode !== 'over') {
      const flick = S.invuln > 0 && Math.floor(S.time * 12) % 2 === 0;
      if (!flick) drawPlaneRetro(ctx, S.planeX, PLAY_TOP + PLANE_SY, S.planeTilt, S.time, S.mode === 'menu');
    }

    // пули
    ctx.fillStyle = P.white;
    for (const b of S.bullets) {
      const sy = RR.screenY(b.y);
      ctx.fillRect(Math.round(b.x) - 1, Math.round(sy), 2, 6);
      ctx.fillStyle = P.yellow;
      ctx.fillRect(Math.round(b.x) - 1, Math.round(sy) + 4, 2, 2);
      ctx.fillStyle = P.white;
    }

    drawParticles(ctx, S, false);
    drawFloaters(ctx, S, false);
    drawFogRetro(ctx);
    ctx.restore();
  }

  /** Суша в ретро-режиме: крупный дизеринг из трёх зелёных тонов. */
  function drawRetroLand(ctx, S) {
    const cell = 12;
    ctx.fillStyle = P.land;
    ctx.fillRect(0, PLAY_TOP, W, PLAY_H);
    const rowTop = Math.floor(worldY(S, PLAY_TOP) / cell) + 1;
    const rowBot = Math.floor(worldY(S, PLAY_TOP + PLAY_H) / cell) - 1;
    for (let i = rowBot; i <= rowTop; i++) {
      const wy = i * cell;
      const sy = PLAY_TOP + PLANE_SY - (wy - S.camY);
      if (sy < PLAY_TOP - cell || sy >= PLAY_TOP + PLAY_H) continue;
      const r = RR.riverAt(wy);
      for (let x = 0; x < W; x += cell) {
        if (x + cell > r.L - 8 && x < r.R + 8) continue;
        const h = hash(i * 3.1 + x * 0.37);
        if (h > 0.9) {
          ctx.fillStyle = P.land2;
          ctx.fillRect(x + 2, sy + 2, 7, 5);
          ctx.fillRect(x + 4, sy + 7, 4, 3);
        } else if (h > 0.82) {
          ctx.fillStyle = P.land4;
          ctx.fillRect(x + 1, sy + 1, 3, 3);
          ctx.fillRect(x + 6, sy + 6, 2, 4);
        } else if (h < 0.05) {
          ctx.fillStyle = P.land4;
          ctx.fillRect(x + 4, sy + 4, 2, 2);
        }
      }
    }
  }

  function drawFogRetro(ctx) {
    // лёгкая дымка у горизонта — глубина без потери пиксельности
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = 'rgba(200,225,220,' + (0.03 - i * 0.004) + ')';
      ctx.fillRect(0, PLAY_TOP + i * 5, W, 5);
    }
  }

  /* Силуэт самолёта 15×17: остриё вверх, стреловидные крылья, хвост.
     Рисуется в два прохода — сначала тень-обводка, затем заливка. */
  const PLANE_ROWS = [
    '.......x.......',
    '......xxx......',
    '......ccc......',
    '.....xxxxx.....',
    '.....xxxxx.....',
    '....xxxxxxx....',
    '..xxxxxxxxxxx..',
    '..xxxxxxxxxxx..',
    '.xxxxxxxxxxxxx.',
    '.xxxxxxxxxxxxx.',
    '...xxxxxxxxx...',
    '....xxxxxxx....',
    '.....xxxxx.....',
    '.....xxxxx.....',
    '....xx.x.xx....',
    '....xx.x.xx....',
    '.......x.......',
  ];

  function drawPlaneRetro(ctx, x, y, tilt, t, attract) {
    const px = Math.round(x), py = Math.round(y);
    const shear = tilt * 2.2;
    ctx.save();
    // тень на воде
    ctx.fillStyle = 'rgba(4,14,38,.35)';
    ctx.fillRect(px - 9, py + 15, 18, 3);
    // выхлоп
    const flame = 2 + Math.floor(Math.abs(Math.sin(t * 22)) * 4);
    ctx.fillStyle = P.orange;
    ctx.fillRect(px - 2, py + 12, 4, 3);
    ctx.fillStyle = P.yellow;
    ctx.fillRect(px - 1, py + 12, 2, flame + 2);
    // проход 1: обводка
    ctx.fillStyle = P.black;
    for (let row = 0; row < PLANE_ROWS.length; row++) {
      const line = PLANE_ROWS[row];
      const off = Math.round(((row - 8) / 8) * shear);
      for (let col = 0; col < line.length; col++) {
        if (line[col] === '.') continue;
        ctx.fillRect(px - 7 + col + off - 1, py - 8 + row - 1, 3, 3);
      }
    }
    // проход 2: заливка
    for (let row = 0; row < PLANE_ROWS.length; row++) {
      const line = PLANE_ROWS[row];
      const off = Math.round(((row - 8) / 8) * shear);
      for (let col = 0; col < line.length; col++) {
        const ch = line[col];
        if (ch === '.') continue;
        const sx = px - 7 + col + off, sy = py - 8 + row;
        if (ch === 'c') {
          ctx.fillStyle = P.cyan;
        } else if ((row === 8 || row === 9) && (col === 1 || col === 13)) {
          ctx.fillStyle = P.red;
        } else {
          ctx.fillStyle = P.white;
        }
        ctx.fillRect(sx, sy, 1, 1);
      }
    }
    if (attract) {
      ctx.fillStyle = 'rgba(95,242,255,.22)';
      ctx.fillRect(px - 10, py - 2, 20, 1);
    }
    ctx.restore();
  }

  function drawBoatRetro(ctx, x, y) {
    const px = Math.round(x), py = Math.round(y);
    ctx.fillStyle = P.black;
    ctx.fillRect(px - 9, py - 4, 18, 9);
    ctx.fillStyle = P.red;
    ctx.fillRect(px - 8, py - 2, 16, 5);
    ctx.fillStyle = P.redDark;
    ctx.fillRect(px - 8, py + 2, 16, 2);
    ctx.fillStyle = P.offWhite;
    ctx.fillRect(px - 3, py - 4, 6, 4);
    ctx.fillStyle = P.yellow;
    ctx.fillRect(px - 1, py - 5, 2, 2);
    // бурун
    ctx.fillStyle = 'rgba(200,236,255,.55)';
    ctx.fillRect(px - 10, py + 4, 4, 1);
    ctx.fillRect(px + 7, py + 4, 4, 1);
  }

  function drawHeliRetro(ctx, x, y, t, life) {
    const px = Math.round(x), py = Math.round(y);
    ctx.fillStyle = P.black;
    ctx.fillRect(px - 8, py - 4, 16, 9);
    ctx.fillStyle = P.yellow;
    ctx.fillRect(px - 7, py - 1, 14, 5);
    ctx.fillStyle = P.red;
    ctx.fillRect(px - 2, py - 3, 4, 3);
    ctx.fillStyle = P.darkGrey;
    ctx.fillRect(px - 1, py + 3, 2, 4);
    // винт
    const w = Math.floor(Math.abs(Math.sin(t * 18 + life)) * 6) + 2;
    ctx.fillStyle = P.offWhite;
    ctx.fillRect(px - w, py - 6, w * 2, 1);
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    ctx.fillRect(px - 9, py - 5, 3, 1);
  }

  function drawJetRetro(ctx, x, y, vx) {
    const px = Math.round(x), py = Math.round(y);
    const dir = vx >= 0 ? 1 : -1;
    ctx.fillStyle = P.black;
    ctx.fillRect(px - 10, py - 4, 20, 8);
    ctx.fillStyle = P.steel;
    ctx.fillRect(px - 9, py - 2, 18, 4);
    ctx.fillStyle = P.darkGrey;
    ctx.fillRect(px - 2, py - 4, 4, 8);
    ctx.fillStyle = P.cyan;
    ctx.fillRect(px + dir * 4 - 1, py - 2, 3, 2);
    // след
    ctx.fillStyle = 'rgba(255,255,255,.28)';
    ctx.fillRect(px - dir * 12, py, 6, 1);
  }

  function drawDepotRetro(ctx, d, sy, t) {
    const px = Math.round(d.x), py = Math.round(sy);
    if (d.used) {
      ctx.fillStyle = P.darkGrey;
      ctx.fillRect(px - 11, py - 7, 22, 14);
      ctx.fillStyle = P.grey;
      ctx.fillRect(px - 9, py - 5, 18, 10);
      return;
    }
    const pulse = Math.sin(t * 5) > 0.3;
    ctx.fillStyle = P.black;
    ctx.fillRect(px - 13, py - 8, 26, 16);
    // шахматка
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 2; j++) {
        ctx.fillStyle = (i + j) % 2 ? P.white : P.red;
        ctx.fillRect(px - 12 + i * 8, py - 6 + j * 6, 8, 6);
      }
    }
    ctx.fillStyle = pulse ? P.foam : 'rgba(200,236,255,.25)';
    ctx.fillRect(px - 13, py - 9, 26, 1);
    ctx.fillRect(px - 13, py + 8, 26, 1);
    if (pulse) {
      ctx.fillStyle = P.foam;
      ctx.fillRect(px - 4, py - 1, 8, 1);
      ctx.fillRect(px - 1, py - 4, 1, 6);
    }
  }

  function drawBridgeRetro(ctx, S, b) {
    const sy = RR.screenY(b.y);
    if (sy < PLAY_TOP - 90 || sy > PLAY_TOP + PLAY_H + 90) return;
    const r = RR.riverAt(b.y);
    const L = Math.max(-30, r.L - 26);
    const R = Math.min(W + 30, r.R + 26);
    const px = Math.round;
    if (!b.alive) {
      // обрубки на берегах
      ctx.fillStyle = P.darkGrey;
      ctx.fillRect(px(L), px(sy) - 6, Math.min(46, r.L - L), 12);
      ctx.fillRect(px(R) - Math.min(46, R - r.R), px(sy) - 6, Math.min(46, R - r.R), 12);
      ctx.fillStyle = P.grey;
      ctx.fillRect(px(L), px(sy) - 3, Math.min(40, r.L - L), 3);
      ctx.fillRect(px(R) - 40, px(sy) - 3, 40, 3);
      return;
    }
    // пролёт
    ctx.fillStyle = P.black;
    ctx.fillRect(px(L), px(sy) - 9, R - L, 18);
    ctx.fillStyle = P.darkGrey;
    ctx.fillRect(px(L), px(sy) - 6, R - L, 12);
    ctx.fillStyle = P.grey;
    ctx.fillRect(px(L), px(sy) - 6, R - L, 2);
    // вертикальные фермы
    for (let x = px(L) + 6; x < R - 4; x += 12) {
      ctx.fillStyle = P.steel;
      ctx.fillRect(x, px(sy) - 6, 1, 12);
    }
    // опасная разметка на концах
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 ? P.white : P.red;
      ctx.fillRect(px(L) + 2 + i * 5, px(sy) - 9, 5, 3);
      ctx.fillRect(px(R) - 32 + i * 5, px(sy) - 9, 5, 3);
    }
    // ядро/цель
    const core = (b.flash > 0 && Math.floor(S.time * 30) % 2 === 0) ? P.white : (b.hp <= 1 ? P.red : P.orange);
    ctx.fillStyle = P.black;
    ctx.fillRect(W / 2 - 15, px(sy) - 11, 30, 22);
    ctx.fillStyle = core;
    ctx.fillRect(W / 2 - 13, px(sy) - 9, 26, 18);
    ctx.fillStyle = P.ink;
    ctx.fillRect(W / 2 - 9, px(sy) - 5, 18, 10);
    // индикатор прочности
    for (let i = 0; i < b.maxHp; i++) {
      ctx.fillStyle = i < b.hp ? P.yellow : P.redDark;
      ctx.fillRect(W / 2 - 12 + i * 9, px(sy) - 3, 7, 6);
    }
    ctx.fillStyle = 'rgba(255,255,255,.4)';
    ctx.fillRect(px(L), px(sy) + 9, R - L, 1);
  }

  function drawHudRetro(ctx, S) {
    // верхняя панель
    ctx.fillStyle = P.hudBg;
    ctx.fillRect(0, 0, W, HUD_H);
    ctx.fillStyle = P.hudLine;
    ctx.fillRect(0, HUD_H - 2, W, 2);

    ctx.fillStyle = P.hudLabel;
    pxText(ctx, RR.t('hudScore'), 10, 8, { scale: 1, color: P.hudLabel });
    pxText(ctx, RR.pad(S.score, 6), 9, 20, { scale: 2, color: P.hudText });

    pxText(ctx, RR.t('hudLevel'), W / 2, 8, { scale: 1, color: P.hudLabel, align: 'center' });
    pxText(ctx, RR.pad(S.level, 2), W / 2, 19, { scale: 2, color: P.cyan, align: 'center' });

    // топливо
    const fw = 92, fx = W - 10 - fw, fy = 20;
    pxText(ctx, RR.t('hudFuel'), W - 10, 8, { scale: 1, color: P.hudLabel, align: 'right' });
    ctx.fillStyle = '#02040a';
    ctx.fillRect(fx - 2, fy - 2, fw + 4, 13);
    ctx.fillStyle = P.hudLine;
    ctx.fillRect(fx - 1, fy - 1, fw + 2, 11);
    const fuelCol = S.fuel < 22 ? P.fuelLow : S.fuel < 45 ? P.fuelMid : P.fuelOk;
    const segs = 10;
    for (let i = 0; i < segs; i++) {
      const on = S.fuel > (i + 0.4) * (100 / segs);
      ctx.fillStyle = on ? fuelCol : '#152033';
      ctx.fillRect(fx + i * (fw / segs) + 1, fy + 1, fw / segs - 2, 6);
    }
    if (S.fuel < 26 && Math.floor(S.time * 4) % 2 === 0) {
      pxText(ctx, RR.t('lowFuel'), fx + fw, fy + 14, { scale: 1, color: P.fuelLow, align: 'right' });
    } else {
      pxText(ctx, Math.round(S.fuel) + '%', fx + fw, fy + 14, { scale: 1, color: P.hudLabel, align: 'right' });
    }

    // нижняя панель
    ctx.fillStyle = P.hudBg;
    ctx.fillRect(0, H - FOOT_H, W, FOOT_H);
    ctx.fillStyle = P.hudLine;
    ctx.fillRect(0, H - FOOT_H, W, 2);
    // жизни — мини-самолётики
    const MINI = ['....x....', '...xxx...', '..xxxxx..', 'xxxxxxxxx', '.xxxxxxx.', '...xxx...', '...x.x...'];
    for (let i = 0; i < Math.min(5, S.lives); i++) {
      const lx = 10 + i * 13, ly = H - FOOT_H + 9;
      ctx.fillStyle = P.hudText;
      for (let row = 0; row < MINI.length; row++) {
        for (let col = 0; col < 9; col++) {
          if (MINI[row][col] === 'x') ctx.fillRect(lx + col, ly + row, 1, 1);
        }
      }
    }
    pxText(ctx, RR.t('hudRecord'), W - 10, H - FOOT_H + 5, { scale: 1, color: P.hudLabel, align: 'right' });
    pxText(ctx, RR.pad(S.hi, 6), W - 10, H - FOOT_H + 15, { scale: 1, color: P.hudText, align: 'right' });

    // предупреждение о мосте
    if (S.bridge && S.bridge.alive && S.bridgeAhead > 0.05) {
      const dist = Math.max(0, Math.round(S.bridge.y - S.camY));
      if (dist < 1000) {
        const blink = Math.floor(S.time * 5) % 2 === 0;
        ctx.save();
        ctx.translate(W / 2, PLAY_TOP + 14);
        ctx.fillStyle = P.red;
        for (let i = 0; i < 3; i++) {
          const a = blink ? 1 : 0.35;
          ctx.globalAlpha = a;
          const yy = i * 5;
          ctx.beginPath();
          ctx.moveTo(-5, yy + 5); ctx.lineTo(0, yy); ctx.lineTo(5, yy + 5);
          ctx.fill();
        }
        ctx.restore();
        if (blink) {
          const label = RR.t('bridgeAhead') + ' ' + dist;
          const tw = pxWidth(label, 1) + 10;
          ctx.fillStyle = 'rgba(7,10,18,.85)';
          ctx.fillRect(Math.round(W / 2 - tw / 2), PLAY_TOP + 30, Math.round(tw), 12);
          ctx.fillStyle = P.redDark;
          ctx.fillRect(Math.round(W / 2 - tw / 2), PLAY_TOP + 30, Math.round(tw), 1);
          pxText(ctx, label, W / 2, PLAY_TOP + 33, { scale: 1, color: P.red, align: 'center' });
        }
      }
    }
  }

  /* ========================================================================
   * MODERN
   * ===================================================================== */
  function drawModern(ctx, S) {
    clipPlay(ctx);

    // суша
    const landGrad = ctx.createLinearGradient(0, PLAY_TOP, 0, PLAY_TOP + PLAY_H);
    landGrad.addColorStop(0, M.land0);
    landGrad.addColorStop(0.45, M.land1);
    landGrad.addColorStop(1, M.land0);
    ctx.fillStyle = landGrad;
    ctx.fillRect(0, PLAY_TOP, W, PLAY_H);

    // контуры рельефа и светящаяся «трава» на суше
    for (let k = 0; k < 8; k++) {
      const base = PLAY_TOP + 20 + (k * PLAY_H) / 8 + Math.sin(S.time * 0.2 + k) * 8;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 16) {
        const y = base + Math.sin(x * 0.02 + k * 2.1 + S.time * 0.15) * 9;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = 'rgba(57,240,208,.07)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    for (let k = 0; k < 110; k++) {
      const sy = PLAY_TOP + hash(k * 3.3) * PLAY_H;
      const r = RR.riverAt(worldY(S, sy));
      const left = hash(k * 1.7) < 0.5;
      const x = left
        ? hash(k * 5.1) * Math.max(1, r.L - 12)
        : r.R + 12 + hash(k * 5.1) * Math.max(1, W - r.R - 12);
      const a = 0.04 + 0.14 * (0.5 + 0.5 * Math.sin(S.time * 0.8 + k));
      ctx.fillStyle = 'rgba(110,255,195,' + a + ')';
      ctx.fillRect(x, sy, 1.5, 1.5);
    }

    // мягкое свечение береговой линии на сушу (три обводки вместо blur)
    for (const layer of [[28, 0.035], [14, 0.06], [5, 0.09]]) {
      waterPath(ctx, S, 0);
      ctx.strokeStyle = 'rgba(48,225,175,' + layer[1] + ')';
      ctx.lineWidth = layer[0];
      ctx.stroke();
    }

    // вода
    waterPath(ctx, S, 0);
    const menu = S.mode === 'menu';
    const wg = ctx.createLinearGradient(0, PLAY_TOP, 0, PLAY_TOP + PLAY_H);
    wg.addColorStop(0, menu ? '#1a7796' : '#12617f');
    wg.addColorStop(0.32, menu ? '#0f5f80' : '#0b4a68');
    wg.addColorStop(1, menu ? '#08354f' : '#06263c');
    ctx.fillStyle = wg;
    ctx.fill();
    ctx.save();
    waterPath(ctx, S, 0);
    ctx.clip();
    // каустика
    for (let k = 0; k < 8; k++) {
      const base = PLAY_TOP + ((k * 83 + S.time * 24) % (PLAY_H + 120)) - 60;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 10) {
        const y = base + Math.sin(x * 0.04 + k * 1.7 + S.time * 1.1) * 6
          + Math.sin(x * 0.013 - S.time * 0.7 + k) * 5;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = 'rgba(110,235,255,' + (0.04 + (k % 4) * 0.018) + ')';
      ctx.lineWidth = 1 + (k % 3) * 1.4;
      ctx.stroke();
    }
    // блики
    for (let k = 0; k < 18; k++) {
      const sy = PLAY_TOP + hash(k) * PLAY_H;
      const r = RR.riverAt(worldY(S, sy));
      const x = r.L + 6 + ((hash(k + 40) * (r.R - r.L - 12) + S.time * (6 + hash(k + 3) * 14)) % Math.max(1, r.R - r.L - 12));
      const a = 0.05 + 0.1 * (0.5 + 0.5 * Math.sin(S.time * 2 + k));
      ctx.fillStyle = 'rgba(190,250,255,' + a + ')';
      ctx.fillRect(x, sy, 3 + hash(k + 9) * 6, 1);
    }
    ctx.restore();

    // светящаяся кромка берега
    for (const inset of [0, 3]) {
      waterPath(ctx, S, inset);
      ctx.strokeStyle = inset === 0 ? 'rgba(57,240,208,.85)' : 'rgba(57,240,208,.18)';
      ctx.lineWidth = inset === 0 ? 1.6 : 4;
      ctx.shadowColor = 'rgba(57,240,208,.8)';
      ctx.shadowBlur = inset === 0 ? 10 : 0;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // пена вдоль берегов
    for (let k = 0; k < 40; k++) {
      const sy = PLAY_TOP + ((k * 37 + S.time * 26) % PLAY_H);
      const r = RR.riverAt(worldY(S, sy));
      const left = k % 2 === 0;
      const a = 0.05 + 0.12 * (0.5 + 0.5 * Math.sin(S.time * 2.2 + k * 1.7));
      ctx.fillStyle = 'rgba(205,255,255,' + a + ')';
      if (left) ctx.fillRect(r.L + 3 + (k % 3) * 3, sy, 5 + (k % 4) * 2, 1);
      else ctx.fillRect(r.R - 3 - (k % 3) * 3 - (5 + (k % 4) * 2), sy, 5 + (k % 4) * 2, 1);
    }

    // острова
    for (const is of S.islands) {
      const sy = RR.screenY(is.y);
      if (sy < PLAY_TOP - 100 || sy > PLAY_TOP + PLAY_H + 100) continue;
      const g = ctx.createRadialGradient(is.x - is.rx * 0.3, sy - is.ry * 0.3, 2, is.x, sy, Math.max(is.rx, is.ry) * 1.25);
      g.addColorStop(0, 'rgba(64,168,116,.98)');
      g.addColorStop(0.55, 'rgba(24,100,76,.98)');
      g.addColorStop(1, 'rgba(6,40,32,1)');
      ctx.beginPath();
      ctx.ellipse(is.x, sy, is.rx + 2, is.ry + 2, 0, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = 'rgba(57,240,208,.5)';
      ctx.lineWidth = 1.4;
      ctx.shadowColor = 'rgba(57,240,208,.7)';
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;
      // песчаная кайма и блики травы
      ctx.beginPath();
      ctx.ellipse(is.x, sy, is.rx - 3, is.ry - 4, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,215,150,.22)';
      ctx.lineWidth = 1.6;
      ctx.stroke();
      for (let k = 0; k < 7; k++) {
        const a = hash(is.y + k * 2.3) * Math.PI * 2;
        const rr = 0.15 + hash(is.x + k) * 0.55;
        ctx.fillStyle = 'rgba(120,255,200,' + (0.12 + 0.2 * hash(k + is.y)) + ')';
        ctx.fillRect(is.x + Math.cos(a) * is.rx * rr, sy + Math.sin(a) * is.ry * rr, 1.6, 1.6);
      }
    }

    // заправки
    for (const d of S.depots) {
      const sy = RR.screenY(d.y);
      if (sy < PLAY_TOP - 50 || sy > PLAY_TOP + PLAY_H + 50) continue;
      drawDepotModern(ctx, d, sy, S.time);
    }

    // мост
    if (S.bridge) drawBridgeModern(ctx, S, S.bridge);

    // враги
    for (const e of S.enemies) {
      if (e.dead) continue;
      const sy = RR.screenY(e.y);
      if (sy < PLAY_TOP - 50 || sy > PLAY_TOP + PLAY_H + 50) continue;
      if (e.type === 'boat') drawBoatModern(ctx, e.x, sy, S.time);
      else if (e.type === 'heli') drawHeliModern(ctx, e.x, sy, S.time, e.t);
      else drawJetModern(ctx, e.x, sy, e.vx);
    }

    // самолёт
    if (S.mode !== 'dying' && S.mode !== 'over') {
      const flick = S.invuln > 0 && Math.floor(S.time * 12) % 2 === 0;
      if (!flick) drawPlaneModern(ctx, S.planeX, PLAY_TOP + PLANE_SY, S.planeTilt, S.time, S);
    }

    // пули
    for (const b of S.bullets) drawBulletModern(ctx, b);

    drawParticles(ctx, S, true);
    drawFloaters(ctx, S, true);
    drawAmbient(ctx, S);
    drawFuelLowModern(ctx, S);
    ctx.restore();
  }

  function drawAmbient(ctx, S) {
    for (let i = 0; i < 22; i++) {
      const t = S.time * (0.25 + hash(i + 7) * 0.4) + i * 1.9;
      const x = (hash(i) * W + Math.sin(t) * 22 + W) % W;
      const y = PLAY_TOP + ((hash(i + 53) * PLAY_H + t * 9) % PLAY_H);
      const a = 0.08 + 0.18 * (0.5 + 0.5 * Math.sin(S.time * 1.7 + i));
      ctx.fillStyle = 'rgba(120,255,220,' + a + ')';
      ctx.beginPath();
      ctx.arc(x, y, 0.9 + hash(i + 11), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawDepotModern(ctx, d, sy, t) {
    const pulse = 0.5 + 0.5 * Math.sin(t * 4);
    ctx.save();
    ctx.translate(d.x, sy);
    if (d.used) {
      ctx.fillStyle = 'rgba(40,60,70,.55)';
      ctx.strokeStyle = 'rgba(120,160,170,.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      return;
    }
    // ореол
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 30);
    g.addColorStop(0, 'rgba(70,255,170,' + (0.22 + pulse * 0.15) + ')');
    g.addColorStop(1, 'rgba(70,255,170,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, Math.PI * 2);
    ctx.fill();
    // шестиугольная платформа
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i + Math.PI / 6;
      const x = Math.cos(a) * 13, y = Math.sin(a) * 13;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(6,40,34,.95)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(70,255,170,.95)';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = 'rgba(70,255,180,.9)';
    ctx.shadowBlur = 12 + pulse * 8;
    ctx.stroke();
    ctx.shadowBlur = 0;
    // кольцо
    ctx.beginPath();
    ctx.arc(0, 0, 6 + pulse * 2, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(160,255,220,' + (0.3 + pulse * 0.4) + ')';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    // буква F
    ctx.fillStyle = 'rgba(190,255,235,.95)';
    ctx.fillRect(-2.5, -5, 2, 10);
    ctx.fillRect(-2.5, -5, 6, 2);
    ctx.fillRect(-2.5, -1, 4, 2);
    ctx.restore();
  }

  function drawBridgeModern(ctx, S, b) {
    const sy = RR.screenY(b.y);
    if (sy < PLAY_TOP - 120 || sy > PLAY_TOP + PLAY_H + 120) return;
    const r = RR.riverAt(b.y);
    const L = Math.max(-40, r.L - 30), R = Math.min(W + 40, r.R + 30);
    if (!b.alive) {
      ctx.fillStyle = 'rgba(20,30,36,.95)';
      ctx.fillRect(L, sy - 7, Math.min(54, r.L - L), 14);
      ctx.fillRect(R - Math.min(54, R - r.R), sy - 7, Math.min(54, R - r.R), 14);
      ctx.strokeStyle = 'rgba(255,90,110,.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(L, sy - 7); ctx.lineTo(L + 54, sy - 7);
      ctx.moveTo(R - 54, sy - 7); ctx.lineTo(R, sy - 7);
      ctx.stroke();
      return;
    }
    const flash = b.flash > 0 && Math.floor(S.time * 30) % 2 === 0;
    ctx.save();
    // тень/свечение
    ctx.shadowColor = flash ? 'rgba(255,80,90,.9)' : 'rgba(255,150,80,.35)';
    ctx.shadowBlur = 16;
    ctx.fillStyle = flash ? 'rgba(255,90,90,.9)' : 'rgba(16,26,32,.96)';
    ctx.fillRect(L, sy - 9, R - L, 18);
    ctx.shadowBlur = 0;
    // фермы
    ctx.strokeStyle = 'rgba(120,150,165,.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = L + 6; x < R - 4; x += 10) {
      ctx.moveTo(x, sy - 8);
      ctx.lineTo(x, sy + 8);
    }
    ctx.stroke();
    // неоновая кромка
    const edge = ctx.createLinearGradient(L, 0, R, 0);
    edge.addColorStop(0, 'rgba(255,80,90,.95)');
    edge.addColorStop(0.5, 'rgba(255,180,90,.95)');
    edge.addColorStop(1, 'rgba(255,80,90,.95)');
    ctx.strokeStyle = edge;
    ctx.lineWidth = 1.6;
    ctx.shadowColor = 'rgba(255,120,90,.8)';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(L, sy - 9); ctx.lineTo(R, sy - 9);
    ctx.moveTo(L, sy + 9); ctx.lineTo(R, sy + 9);
    ctx.stroke();
    ctx.shadowBlur = 0;
    // энергоядро
    const cx = W / 2, coreR = 15;
    const pulse = 0.5 + 0.5 * Math.sin(S.time * 5);
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i + Math.PI / 6 + S.time * 0.3;
      const x = cx + Math.cos(a) * coreR, y = sy + Math.sin(a) * coreR;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(8,14,20,.95)';
    ctx.fill();
    const coreCol = b.hp <= 1 ? 'rgba(255,60,80,' : b.hp === 2 ? 'rgba(255,170,70,' : 'rgba(255,235,170,';
    ctx.strokeStyle = coreCol + (0.75 + pulse * 0.25) + ')';
    ctx.lineWidth = 2;
    ctx.shadowColor = coreCol + '1)';
    ctx.shadowBlur = 14 + pulse * 10;
    ctx.stroke();
    ctx.shadowBlur = 0;
    // прочность
    for (let i = 0; i < b.maxHp; i++) {
      ctx.fillStyle = i < b.hp ? 'rgba(255,220,140,.95)' : 'rgba(80,40,50,.9)';
      ctx.fillRect(cx - 10 + i * 8, sy - 3, 5, 6);
    }
    // опоры на берегах
    ctx.fillStyle = 'rgba(20,34,40,.98)';
    ctx.fillRect(L, sy - 22, 7, 44);
    ctx.fillRect(R - 7, sy - 22, 7, 44);
    ctx.strokeStyle = 'rgba(255,120,90,.6)';
    ctx.lineWidth = 1;
    ctx.strokeRect(L + 0.5, sy - 22.5, 6, 44);
    ctx.strokeRect(R - 6.5, sy - 22.5, 6, 44);
    // проблесковые огни на опорах
    const blink = Math.floor(S.time * 3.2) % 2 === 0;
    ctx.fillStyle = blink ? 'rgba(255,60,70,1)' : 'rgba(255,60,70,.2)';
    ctx.beginPath();
    ctx.arc(L + 4, sy - 12, 2, 0, Math.PI * 2);
    ctx.arc(R - 4, sy - 12, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPlaneModern(ctx, x, y, tilt, t, S) {
    ctx.save();
    // тень/отражение на воде
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.translate(x, y + 34);
    ctx.scale(1, 0.42);
    ctx.fillStyle = 'rgba(80,220,255,.9)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 14, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.translate(x, y);
    ctx.rotate(tilt * 0.5);

    // сопла/факел
    const flame = 1 + Math.abs(Math.sin(t * 26)) * 6;
    const fg = ctx.createLinearGradient(0, 12, 0, 22 + flame);
    fg.addColorStop(0, 'rgba(255,240,190,.95)');
    fg.addColorStop(0.5, 'rgba(255,150,70,.75)');
    fg.addColorStop(1, 'rgba(255,80,60,0)');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(-3, 11);
    ctx.lineTo(0, 16 + flame);
    ctx.lineTo(3, 11);
    ctx.closePath();
    ctx.fill();

    // двигатель-свечение
    ctx.shadowColor = 'rgba(80,220,255,.85)';
    ctx.shadowBlur = 18;
    ctx.fillStyle = 'rgba(90,240,255,.95)';
    ctx.beginPath();
    ctx.ellipse(0, 9, 2.6, 4.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // корпус
    const body = ctx.createLinearGradient(-10, 0, 10, 0);
    body.addColorStop(0, '#7ee9ff');
    body.addColorStop(0.45, '#eafcff');
    body.addColorStop(0.55, '#d8f6ff');
    body.addColorStop(1, '#4fb6d8');
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(3.2, -5);
    ctx.lineTo(4.2, 1);
    ctx.lineTo(11, 5);
    ctx.lineTo(11.5, 7.5);
    ctx.lineTo(4.4, 7);
    ctx.lineTo(3.2, 12);
    ctx.lineTo(2.2, 12);
    ctx.lineTo(2.2, 8);
    ctx.lineTo(-2.2, 8);
    ctx.lineTo(-2.2, 12);
    ctx.lineTo(-3.2, 12);
    ctx.lineTo(-4.4, 7);
    ctx.lineTo(-11.5, 7.5);
    ctx.lineTo(-11, 5);
    ctx.lineTo(-4.2, 1);
    ctx.lineTo(-3.2, -5);
    ctx.closePath();
    ctx.fillStyle = body;
    ctx.fill();
    ctx.strokeStyle = 'rgba(57,240,208,.95)';
    ctx.lineWidth = 1.2;
    ctx.shadowColor = 'rgba(57,240,208,.9)';
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // кабина
    const cg = ctx.createLinearGradient(0, -8, 0, 2);
    cg.addColorStop(0, 'rgba(57,240,208,.95)');
    cg.addColorStop(1, 'rgba(20,60,90,.9)');
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.ellipse(0, -4, 2.2, 5.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // красные акценты на крыльях
    ctx.fillStyle = 'rgba(255,79,154,.95)';
    ctx.fillRect(-10, 5.4, 3.4, 1.2);
    ctx.fillRect(6.6, 5.4, 3.4, 1.2);

    // инвиз-щит
    if (S.invuln > 0) {
      ctx.strokeStyle = 'rgba(80,255,220,' + (0.35 + 0.3 * Math.sin(t * 14)) + ')';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(0, 0, 19, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawBoatModern(ctx, x, y, t) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1.2, 1.2);
    // кильватер
    ctx.fillStyle = 'rgba(150,240,255,.10)';
    ctx.beginPath();
    ctx.moveTo(-10, 5);
    ctx.lineTo(-16, 22 + Math.sin(t * 6) * 2);
    ctx.lineTo(-6, 16);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(10, 5);
    ctx.lineTo(16, 22 + Math.cos(t * 6) * 2);
    ctx.lineTo(6, 16);
    ctx.closePath();
    ctx.fill();
    // корпус
    ctx.beginPath();
    ctx.moveTo(-11, -2);
    ctx.quadraticCurveTo(-6, -6, 0, -6);
    ctx.quadraticCurveTo(6, -6, 11, -2);
    ctx.lineTo(8, 5);
    ctx.quadraticCurveTo(0, 8, -8, 5);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, -6, 0, 6);
    g.addColorStop(0, 'rgba(255,120,120,.95)');
    g.addColorStop(1, 'rgba(90,20,40,.95)');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,120,140,.9)';
    ctx.lineWidth = 1;
    ctx.shadowColor = 'rgba(255,80,110,.7)';
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;
    // рубка
    ctx.fillStyle = 'rgba(220,245,255,.9)';
    ctx.fillRect(-3, -5, 6, 3);
    // огонёк
    ctx.fillStyle = Math.floor(t * 4) % 2 ? '#fff3b0' : 'rgba(255,240,160,.25)';
    ctx.beginPath();
    ctx.arc(0, -8, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawHeliModern(ctx, x, y, t, life) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1.15, 1.15);
    // винт
    ctx.strokeStyle = 'rgba(180,240,255,.28)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    const spin = t * 22 + life;
    ctx.ellipse(0, -8, 12 * Math.abs(Math.cos(spin)) + 2, 2, 0, 0, Math.PI * 2);
    ctx.stroke();
    // корпус
    ctx.beginPath();
    ctx.ellipse(0, 0, 7.5, 4.6, 0, 0, Math.PI * 2);
    const g = ctx.createLinearGradient(0, -5, 0, 5);
    g.addColorStop(0, 'rgba(255,220,120,.95)');
    g.addColorStop(1, 'rgba(140,80,20,.95)');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,200,100,.9)';
    ctx.lineWidth = 1;
    ctx.shadowColor = 'rgba(255,190,80,.7)';
    ctx.shadowBlur = 9;
    ctx.stroke();
    ctx.shadowBlur = 0;
    // хвост
    ctx.fillStyle = 'rgba(80,50,20,.95)';
    ctx.fillRect(-12, -1, 6, 2);
    ctx.fillStyle = 'rgba(220,240,255,.8)';
    ctx.fillRect(4, -2, 3, 3);
    // огни
    ctx.fillStyle = Math.floor(t * 5) % 2 ? 'rgba(255,60,80,1)' : 'rgba(255,60,80,.2)';
    ctx.beginPath();
    ctx.arc(-5, 1, 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawJetModern(ctx, x, y, vx) {
    const dir = vx >= 0 ? 1 : -1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1.15, 1.15);
    ctx.scale(dir, 1);
    // шлейф
    const g = ctx.createLinearGradient(-30, 0, 8, 0);
    g.addColorStop(0, 'rgba(120,220,255,0)');
    g.addColorStop(1, 'rgba(140,230,255,.35)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-30, -3);
    ctx.lineTo(6, 0);
    ctx.lineTo(-30, 3);
    ctx.closePath();
    ctx.fill();
    // корпус
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(2, -3.5);
    ctx.lineTo(-8, -2);
    ctx.lineTo(-9, 0);
    ctx.lineTo(-8, 2);
    ctx.lineTo(2, 3.5);
    ctx.closePath();
    ctx.fillStyle = 'rgba(180,235,255,.9)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(90,230,255,.9)';
    ctx.lineWidth = 1;
    ctx.shadowColor = 'rgba(80,220,255,.8)';
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;
    // сопло
    ctx.fillStyle = 'rgba(255,180,90,.95)';
    ctx.beginPath();
    ctx.arc(-8.5, 0, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawBulletModern(ctx, b) {
    const x = b.x, y = RR.screenY(b.y);
    ctx.save();
    ctx.shadowColor = 'rgba(140,255,255,.9)';
    ctx.shadowBlur = 10;
    const g = ctx.createLinearGradient(0, y, 0, y + 16);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(200,255,255,.9)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 1.2, y, 2.4, 16);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x, y, 1.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** Всплывающие очки/бонусы. */
  function drawFloaters(ctx, S, modern) {
    for (const f of S.floaters) {
      const a = Math.min(1, f.life / 0.35);
      const sy = RR.screenY(f.y) - (1 - f.life / f.max) * 18;
      if (modern) {
        RR.sans(ctx, f.text, f.x, sy, {
          size: 12, weight: 600, color: f.color || '#ffe36b', align: 'center',
          alpha: a, glow: f.color || '#ffb347', glowBlur: 10, spacing: 1,
        });
      } else {
        pxText(ctx, f.text, f.x, sy, { scale: 1, color: f.color || '#f2c94c', align: 'center', alpha: a });
      }
    }
  }

  function drawParticles(ctx, S, modern) {
    for (const p of S.particles) {
      const sy = RR.screenY(p.y);
      const a = clamp(p.life / p.max, 0, 1);
      if (p.type === 'ring') {
        const r = p.size * (1 + (1 - a) * 2.6);
        ctx.beginPath();
        ctx.arc(p.x, sy, r, 0, Math.PI * 2);
        ctx.strokeStyle = modern
          ? 'rgba(255,' + Math.round(150 + 80 * a) + ',90,' + (a * 0.8) + ')'
          : 'rgba(242,201,76,' + a + ')';
        ctx.lineWidth = modern ? 2 + a * 2 : 1;
        ctx.stroke();
        continue;
      }
      if (modern) {
        ctx.globalCompositeOperation = p.type === 'smoke' ? 'source-over' : 'lighter';
        ctx.fillStyle = p.type === 'smoke'
          ? 'rgba(60,80,90,' + (a * 0.22) + ')'
          : 'rgba(255,' + Math.round(120 + 100 * a) + ',70,' + (a * 0.9) + ')';
        ctx.beginPath();
        ctx.arc(p.x, sy, p.size * (0.6 + a), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      } else {
        ctx.fillStyle = p.tone === 'cool'
          ? 'rgba(143,208,255,' + a + ')'
          : p.type === 'smoke' ? 'rgba(70,80,90,' + a + ')' : 'rgba(242,180,76,' + a + ')';
        const s = Math.max(1, Math.round(p.size));
        ctx.fillRect(Math.round(p.x), Math.round(sy), s, s);
      }
    }
  }

  function drawFuelLowModern(ctx, S) {
    if (S.fuel >= 26) return;
    if (Math.floor(S.time * 4) % 2) return;
    const a = 0.14 + 0.12 * Math.sin(S.time * 7);
    const g = ctx.createLinearGradient(0, PLAY_TOP + PLAY_H - 14, 0, PLAY_TOP + PLAY_H);
    g.addColorStop(0, 'rgba(255,60,70,0)');
    g.addColorStop(1, 'rgba(255,60,70,' + a + ')');
    ctx.fillStyle = g;
    ctx.fillRect(0, PLAY_TOP + PLAY_H - 14, W, 14);
  }

  function drawHudModern(ctx, S) {
    // верхняя панель
    const hg = ctx.createLinearGradient(0, 0, 0, HUD_H);
    hg.addColorStop(0, 'rgba(3,11,16,.96)');
    hg.addColorStop(1, 'rgba(3,11,16,.55)');
    ctx.fillStyle = hg;
    ctx.fillRect(0, 0, W, HUD_H);
    const line = ctx.createLinearGradient(0, 0, W, 0);
    line.addColorStop(0, 'rgba(57,240,208,0)');
    line.addColorStop(0.25, 'rgba(57,240,208,.5)');
    line.addColorStop(0.75, 'rgba(76,201,255,.5)');
    line.addColorStop(1, 'rgba(76,201,255,0)');
    ctx.fillStyle = line;
    ctx.fillRect(0, HUD_H - 1, W, 1);

    // очки
    RR.sans(ctx, RR.t('hudScore').toUpperCase(), 14, 8, { size: 9, color: 'rgba(175,215,240,.55)', spacing: 2.4 });
    RR.sans(ctx, RR.pad(S.score, 6), 14, 20, { size: 24, weight: 300, color: '#eaf6ff', spacing: 2, glow: 'rgba(76,201,255,.35)', glowBlur: 14 });

    // уровень
    RR.sans(ctx, RR.t('hudLevel').toUpperCase(), W / 2, 9, { size: 9, color: 'rgba(175,215,240,.55)', spacing: 2.4, align: 'center' });
    RR.sans(ctx, RR.pad(S.level, 2), W / 2, 22, { size: 17, weight: 500, color: '#8ff8e4', spacing: 2, align: 'center', glow: 'rgba(57,240,208,.4)' });

    // топливо
    const fw = 96, fx = W - 14 - fw, fy = 24;
    RR.sans(ctx, RR.t('hudFuel').toUpperCase(), W - 14, 8, { size: 9, color: 'rgba(175,215,240,.55)', spacing: 2.4, align: 'right' });
    ctx.fillStyle = 'rgba(120,190,210,.14)';
    RR.roundRect(ctx, fx, fy, fw, 6, 3);
    ctx.fill();
    const pct = clamp(S.fuel / 100, 0, 1);
    const fuelCol = S.fuel < 22 ? '#ff3b5c' : S.fuel < 45 ? '#ffb347' : '#39f0d0';
    const fillGrad = ctx.createLinearGradient(fx, 0, fx + fw, 0);
    fillGrad.addColorStop(0, fuelCol);
    fillGrad.addColorStop(1, S.fuel < 22 ? '#ff7a5c' : '#4cc9ff');
    ctx.save();
    ctx.shadowColor = fuelCol;
    ctx.shadowBlur = 10;
    ctx.fillStyle = fillGrad;
    if (pct > 0.02) {
      RR.roundRect(ctx, fx, fy, Math.max(4, fw * pct), 6, 3);
      ctx.fill();
    }
    ctx.restore();
    RR.sans(ctx, Math.round(S.fuel) + '%', fx + fw, fy + 8, { size: 9, color: S.fuel < 22 ? '#ff6b78' : 'rgba(175,215,240,.6)', spacing: 1, align: 'right' });

    // нижняя панель
    const fg2 = ctx.createLinearGradient(0, H - FOOT_H, 0, H);
    fg2.addColorStop(0, 'rgba(3,11,16,.2)');
    fg2.addColorStop(1, 'rgba(3,11,16,.86)');
    ctx.fillStyle = fg2;
    ctx.fillRect(0, H - FOOT_H, W, FOOT_H);
    // жизни
    for (let i = 0; i < Math.min(5, S.lives); i++) {
      const lx = 15 + i * 15, ly = H - FOOT_H + 15;
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(lx - 5, ly + 7);
      ctx.lineTo(lx + 5, ly + 7);
      ctx.closePath();
      ctx.fillStyle = 'rgba(143,248,228,.9)';
      ctx.shadowColor = 'rgba(57,240,208,.8)';
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    RR.sans(ctx, RR.t('hudRecord') + ' ' + RR.pad(S.hi, 6), W - 14, H - FOOT_H + 10, { size: 9, color: 'rgba(175,215,240,.55)', spacing: 1.6, align: 'right' });

    // индикатор тяги справа
    const tx = W - 9, ty = PLAY_TOP + 74;
    for (let i = 0; i < 3; i++) {
      const on = S.throttle * 3 > i - 0.2;
      ctx.fillStyle = on ? 'rgba(143,248,228,.9)' : 'rgba(143,248,228,.18)';
      ctx.fillRect(tx, ty + i * 7, 4, 4);
    }

    // предупреждение о мосте
    if (S.bridge && S.bridge.alive && S.bridgeAhead > 0.05) {
      const dist = Math.max(0, Math.round(S.bridge.y - S.camY));
      if (dist < 1000) {
        const blink = Math.floor(S.time * 4) % 2 === 0;
        ctx.save();
        ctx.globalAlpha = blink ? 1 : 0.45;
        RR.sans(ctx, '▲ ' + RR.t('bridgeAhead') + ' · ' + dist, W / 2, PLAY_TOP + 12, {
          size: 9, color: '#ff5a78', spacing: 2, align: 'center', glow: 'rgba(255,60,90,.7)',
        });
        ctx.restore();
      }
    }
  }

  /* ========================================================================
   * общие элементы: сообщения
   * ===================================================================== */
  function drawMessages(ctx, S, modern) {
    const msg = S.msg;
    if (!msg) return;
    const a = clamp(msg.t / 0.25, 0, 1) * clamp((msg.max - msg.t) / 0.2 + 0.2, 0, 1);
    const y = PLAY_TOP + PLAY_H * 0.34;
    ctx.save();
    ctx.globalAlpha = a;
    if (modern) {
      const w = Math.max(190, Math.max(RR.pxWidth(msg.title, 1.2), msg.sub ? 120 : 0) + 70);
      const h = msg.sub ? 52 : 36;
      ctx.fillStyle = 'rgba(4,14,20,.78)';
      RR.roundRect(ctx, W / 2 - w / 2, y - h / 2, w, h, 10);
      ctx.fill();
      ctx.strokeStyle = msg.tone === 'good' ? 'rgba(57,240,208,.7)' : 'rgba(255,180,90,.55)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.shadowColor = msg.tone === 'good' ? 'rgba(57,240,208,.45)' : 'rgba(255,120,80,.35)';
      ctx.shadowBlur = 18;
      RR.sans(ctx, msg.title, W / 2, y - (msg.sub ? 16 : 7), {
        size: 15, weight: 600, color: msg.tone === 'good' ? '#8ff8e4' : '#ffd28a', align: 'center', spacing: 2.4,
      });
      ctx.shadowBlur = 0;
      if (msg.sub) RR.sans(ctx, msg.sub, W / 2, y + 3, { size: 11, color: 'rgba(220,245,255,.7)', align: 'center', spacing: 1.6 });
    } else {
      const tw = Math.max(pxWidth(msg.title, 2), msg.sub ? pxWidth(msg.sub, 1) : 0) + 24;
      const w = Math.min(W - 20, Math.max(tw, 120));
      const h = msg.sub ? 40 : 28;
      ctx.fillStyle = P.hudBg;
      ctx.fillRect(Math.round(W / 2 - w / 2), Math.round(y - h / 2), Math.round(w), h);
      ctx.fillStyle = msg.tone === 'good' ? P.fuelOk : P.yellow;
      ctx.fillRect(Math.round(W / 2 - w / 2), Math.round(y - h / 2), Math.round(w), 1);
      ctx.fillRect(Math.round(W / 2 - w / 2), Math.round(y + h / 2 - 1), Math.round(w), 1);
      pxText(ctx, msg.title, W / 2, y - (msg.sub ? 15 : 7), { scale: 2, color: msg.tone === 'good' ? P.fuelOk : P.yellow, align: 'center' });
      if (msg.sub) pxText(ctx, msg.sub, W / 2, y + 2, { scale: 1, color: P.hudText, align: 'center' });
    }
    ctx.restore();
  }

  /* ========================================================================
   * вход
   * ===================================================================== */
  RR.Render = {
    draw(ctx, S) {
      if (!ctx) return;
      // фон за пределами поля (на случай нестандартного масштаба)
      ctx.fillStyle = '#05070d';
      ctx.fillRect(0, 0, W, H);
      // мир — с тряской камеры
      ctx.save();
      if (S.shake > 0.4) {
        const s = S.shake;
        ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
      }
      if (S.gfx === 'retro') drawRetro(ctx, S);
      else drawModern(ctx, S);
      ctx.restore();
      // HUD — стабильный, поверх тряски
      if (S.mode !== 'menu') {
        if (S.gfx === 'retro') drawHudRetro(ctx, S);
        else drawHudModern(ctx, S);
      }
      if (S.mode === 'menu') {
        const top = ctx.createLinearGradient(0, 0, 0, PLAY_TOP + 90);
        top.addColorStop(0, 'rgba(3,6,10,.92)');
        top.addColorStop(1, 'rgba(3,6,10,0)');
        ctx.fillStyle = top;
        ctx.fillRect(0, 0, W, PLAY_TOP + 90);
        const bot = ctx.createLinearGradient(0, H - FOOT_H - 70, 0, H);
        bot.addColorStop(0, 'rgba(3,6,10,0)');
        bot.addColorStop(1, 'rgba(3,6,10,.94)');
        ctx.fillStyle = bot;
        ctx.fillRect(0, H - FOOT_H - 70, W, FOOT_H + 70);
      }
      if (S.flash > 0) {
        ctx.fillStyle = S.gfx === 'retro'
          ? 'rgba(255,240,220,' + (S.flash * 0.5) + ')'
          : 'rgba(190,255,245,' + (S.flash * 0.35) + ')';
        ctx.fillRect(0, PLAY_TOP, W, PLAY_H);
      }
      if (S.mode !== 'menu') drawMessages(ctx, S, S.gfx !== 'retro');
    },
  };
})(window.RR);
