/* ============================================================
   ПРОРЫВ HTML5 — RETRO-рендерер (8 бит)
   Рисует всё в логическом пространстве 256×208, 1 px = 1 пиксель.
   Стиль: чёрный фон, насыщенные цвета, 8×8 «атрибутные» блоки,
   пиксельный шрифт 6×8, минимум сглаживания.
   ============================================================ */
(function () {
  'use strict';

  const PR = window.PR;
  const P = PR.PAL;
  const TILE = 8, COLS = 32, ROWS = 24, W = 256, H = 192, HUD = 16, VH = 208;

  let g = null;              // текущий ctx
  let now = 0;               // время для анимаций

  const px = function (c, x, y, w, h) { g.fillStyle = c; g.fillRect(x | 0, y | 0, w, h); };

  /* ---------- шрифт ---------- */
  const FONT = () => window.PR_FONT;
  function textW(str, scale) {
    const f = FONT();
    return str.length * (f ? f.W : 6) * (scale || 1);
  }
  function text(str, x, y, color, scale, align, shadow) {
    const f = FONT();
    if (!f) return;
    scale = scale || 1;
    str = String(str);
    const cw = f.W * scale;
    let ox = x;
    if (align === 'center') ox = x - textW(str, scale) / 2;
    else if (align === 'right') ox = x - textW(str, scale);
    ox = Math.round(ox); y = Math.round(y);
    const draw = function (sx, sy, col) {
      g.fillStyle = col;
      for (let i = 0; i < str.length; i++) {
        const ch = str[i];
        if (ch === ' ') continue;
        const gl = f.glyph(ch);
        for (let row = 0; row < 8; row++) {
          const bits = gl[row];
          if (!bits) continue;
          for (let col2 = 0; col2 < 6; col2++) {
            if (bits & (1 << (5 - col2))) {
              g.fillRect(sx + i * cw + col2 * scale, sy + row * scale, scale, scale);
            }
          }
        }
      }
    };
    if (shadow) draw(ox + scale, y + scale, shadow);
    draw(ox, y, color);
  }
  function textShadow(str, x, y, color, scale, align) { text(str, x, y, color, scale, align, '#000000'); }

  function wrapMulti(str, maxChars) {
    const out = [];
    String(str).split('\n').forEach(function (par) {
      if (!par.trim()) { out.push(''); return; }
      wrap(par, maxChars).forEach(function (l) { out.push(l); });
    });
    return out;
  }

  function wrap(str, maxChars) {
    const words = String(str).split(' ');
    const lines = [];
    let line = '';
    words.forEach(function (w) {
      if ((line + ' ' + w).trim().length > maxChars) { if (line) lines.push(line); line = w; }
      else line = (line ? line + ' ' : '') + w;
    });
    if (line) lines.push(line);
    return lines;
  }

  /* ---------- примитивы ---------- */
  function panel(x, y, w, h, border, fill) {
    if (fill) px(fill, x, y, w, h);
    g.fillStyle = border;
    g.fillRect(x, y, w, 1); g.fillRect(x, y + h - 1, w, 1);
    g.fillRect(x, y, 1, h); g.fillRect(x + w - 1, y, 1, h);
    /* уголки */
    px(border, x + 1, y + 1, 2, 1); px(border, x + 1, y + 1, 1, 2);
    px(border, x + w - 3, y + 1, 2, 1); px(border, x + w - 2, y + 1, 1, 2);
    px(border, x + 1, y + h - 2, 2, 1); px(border, x + 1, y + h - 3, 1, 2);
    px(border, x + w - 3, y + h - 2, 2, 1); px(border, x + w - 2, y + h - 3, 1, 2);
  }

  /* шахматный дизеринг — «атрибутная» 8-битная фактура */
  function dither(x, y, w, h, c1, c2, phase) {
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const on = (((x + i) + (y + j) + (phase | 0)) & 1) === 0;
        g.fillStyle = on ? c1 : c2;
        g.fillRect(x + i, y + j, 1, 1);
      }
    }
  }

  function rng(seed) {
    let a = seed | 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- темы ---------- */
  const THEMES = {
    space:   { sky: ['#000000', P.bblue], block: P.byellow, block2: P.magenta, thin: P.bgreen, rock: P.bmagenta, spike: P.bwhite, star: P.bwhite, accent: P.bcyan },
    cavern:  { sky: ['#000000', P.black], block: P.bgreen, block2: P.yellow, thin: P.bcyan, rock: P.bred, spike: P.bwhite, star: P.bcyan, accent: P.bgreen },
    reactor: { sky: ['#000000', P.blue], block: P.bcyan, block2: P.bblue, thin: P.byellow, rock: P.bred, spike: P.bwhite, star: P.bcyan, accent: P.byellow },
    hive:    { sky: ['#000000', '#120012'], block: P.bgreen, block2: P.bmagenta, thin: P.bgreen, rock: P.magenta, spike: P.byellow, star: P.bgreen, accent: P.bmagenta },
    core:    { sky: ['#000000', '#200000'], block: P.bred, block2: P.bwhite, thin: P.bcyan, rock: P.bmagenta, spike: P.byellow, star: P.bred, accent: P.bwhite }
  };
  function themeOf(world) { return THEMES[(world && world.theme) || 'space'] || THEMES.space; }

  /* ---------- фон ---------- */
  function starfield(seed, t, theme) {
    const r = rng(seed * 977 + 13);
    for (let i = 0; i < 46; i++) {
      const x = Math.floor(r() * W);
      const y = Math.floor(r() * H);
      const sp = 0.4 + r() * 1.6;
      const yy = Math.floor((y + t * sp * 6) % H);
      const col = i % 9 === 0 ? theme.accent : (i % 3 === 0 ? P.white : theme.star);
      px(col, x, yy, 1, 1);
      if (i % 11 === 0) { px(col, x + 1, yy, 1, 1); px(col, x, yy + 1, 1, 1); }
    }
    /* одна «планета» на экран — как на 8-битных заставках */
    const rr = rng(seed * 31 + 5);
    const cx = 24 + Math.floor(rr() * (W - 48));
    const cy = 28 + Math.floor(rr() * (H - 90));
    const rad = 7 + Math.floor(rr() * 10);
    for (let yy = -rad; yy <= rad; yy++) {
      const half = Math.floor(Math.sqrt(Math.max(0, rad * rad - yy * yy)));
      for (let xx = -half; xx <= half; xx++) {
        const on = ((xx + yy) & 1) === 0 || (xx * xx + yy * yy < rad * rad * 0.45);
        px(on ? theme.accent : theme.sky[1], cx + xx, cy + yy, 1, 1);
      }
    }
    g.strokeStyle = theme.accent;
    g.lineWidth = 1;
    g.beginPath(); g.arc(cx, cy, rad + 0.5, 0, Math.PI * 2); g.stroke();
  }

  /* ---------- тайлы ---------- */
  function drawTile(id, tx, ty, theme, seed) {
    const x = tx * TILE, y = ty * TILE;
    switch (id) {
      case PR.TILES.SOLID: {
        px(theme.sky[0], x, y, TILE, TILE);
        /* кирпичная «атрибутная» кладка 8×8: 2 цвета на клетку */
        g.fillStyle = theme.block;
        g.fillRect(x, y, 8, 2);
        g.fillRect(x, y + 4, 8, 2);
        dither(x, y + 2, 8, 2, theme.block, theme.sky[0], tx + ty);
        g.fillStyle = '#000000';
        g.fillRect(x + 3, y + 1, 1, 1); g.fillRect(x + 6, y + 5, 1, 1);
        break;
      }
      case PR.TILES.ROCK: {
        px(theme.sky[0], x, y, TILE, TILE);
        const r = rng(tx * 73 + ty * 149 + 11);
        for (let i = 0; i < 12; i++) {
          px(i % 2 ? theme.rock : theme.block2, x + Math.floor(r() * 8), y + Math.floor(r() * 8), 1, 1);
        }
        g.fillStyle = theme.rock;
        g.fillRect(x + 1, y + 1, 6, 6);
        dither(x + 1, y + 1, 6, 6, theme.rock, theme.sky[0], tx * 3 + ty);
        break;
      }
      case PR.TILES.THIN: {
        g.fillStyle = theme.thin;
        g.fillRect(x, y, 8, 1);
        g.fillStyle = theme.block2;
        for (let i = 0; i < 8; i += 2) g.fillRect(x + i, y + 1, 1, 1);
        g.fillStyle = theme.sky[0];
        for (let i = 1; i < 8; i += 2) g.fillRect(x + i, y + 1, 1, 1);
        break;
      }
      case PR.TILES.SPIKE: {
        g.fillStyle = theme.spike;
        for (let i = 0; i < 8; i += 2) {
          g.beginPath();
          g.moveTo(x + i, y + 8);
          g.lineTo(x + i + 1, y + 3);
          g.lineTo(x + i + 2, y + 8);
          g.fill();
        }
        px(theme.block2, x, y + 7, 8, 1);
        break;
      }
      case PR.TILES.FLORA: {
        const r = rng(tx * 41 + ty * 17 + 3);
        const h = 4 + Math.floor(r() * 5);
        g.fillStyle = theme.accent;
        g.fillRect(x + 3, y + 8 - h, 1, h);
        g.fillStyle = theme.block2;
        g.fillRect(x + 2, y + 8 - h, 3, 2);
        g.fillStyle = P.bwhite;
        g.fillRect(x + 3, y + 8 - h, 1, 1);
        break;
      }
      default: break;
    }
  }

  /* ---------- спрайты ---------- */
  function drawWalker(e, theme) {
    const x = Math.round(e.x), y = Math.round(e.y);
    const flip = e.dir > 0;
    const body = e.hitT > 0 ? P.bwhite : P.bgreen;
    /* тело */
    px(body, x + 2, y + 2, 10, 6);
    px(P.bgreen, x + 1, y + 3, 1, 4);
    px(P.bgreen, x + 12, y + 3, 1, 4);
    /* глаза */
    const eyeX = flip ? x + 8 : x + 3;
    px(P.byellow, eyeX, y + 3, 2, 2);
    px(P.black, eyeX + (flip ? 1 : 0), y + 4, 1, 1);
    /* рот/зубы */
    px(P.bmagenta, x + 5, y + 6, 4, 1);
    /* ноги */
    const ph = Math.floor(e.anim * 8) % 2;
    px(P.bgreen, x + 2 + ph, y + 8, 2, 3);
    px(P.bgreen, x + 8 - ph, y + 8, 2, 3);
    /* шипы */
    px(P.byellow, x + 4, y + 1, 1, 1);
    px(P.byellow, x + 8, y + 1, 1, 1);
  }

  function drawFlyer(e) {
    const x = Math.round(e.x), y = Math.round(e.y);
    const wing = Math.sin(e.anim * 14) > 0 ? 1 : 0;
    const c = e.hitT > 0 ? P.bwhite : P.bmagenta;
    px(c, x + 4, y + 3, 8, 6);
    px(c, x + 2, y + 3 + wing, 3, 2);
    px(c, x + 11, y + 3 + wing, 3, 2);
    px(P.byellow, x + 5, y + 5, 2, 2);
    px(P.byellow, x + 9, y + 5, 2, 2);
    px(P.black, x + 6, y + 6, 1, 1);
    px(P.black, x + 10, y + 6, 1, 1);
    px(P.bcyan, x + 7, y + 1, 2, 2);
  }

  function drawSwarmer(e) {
    const x = Math.round(e.x), y = Math.round(e.y);
    const c = e.hitT > 0 ? P.bwhite : P.byellow;
    px(c, x + 2, y + 2, 4, 4);
    px(P.bred, x + 3, y + 3, 2, 2);
    px(P.bmagenta, x + 1, y + 1, 1, 1);
    px(P.bmagenta, x + 6, y + 1, 1, 1);
    px(P.bmagenta, x + 1, y + 6, 1, 1);
    px(P.bmagenta, x + 6, y + 6, 1, 1);
  }

  function drawTurret(e) {
    const x = Math.round(e.x), y = Math.round(e.y);
    const c = e.hitT > 0 ? P.bwhite : P.white;
    /* основание */
    px(P.bblue, x + 1, y + 7, 10, 3);
    px(c, x + 2, y + 4, 8, 4);
    /* ствол */
    const dir = e.dir || -1;
    px(P.bcyan, dir > 0 ? x + 9 : x - 2, y + 5, 5, 2);
    /* сенсор */
    px(P.bred, x + 5, y + 2, 2, 2);
    g.fillStyle = P.bred;
    g.fillRect(x + 4, y + 1, 4, 1);
    /* заклёпки */
    px(P.byellow, x + 2, y + 4, 1, 1);
    px(P.byellow, x + 9, y + 4, 1, 1);
  }

  function drawTank(e) {
    const x = Math.round(e.x), y = Math.round(e.y);
    const c = e.hitT > 0 ? P.bwhite : P.bblue;
    px(P.bmagenta, x, y + 8, 16, 4);
    px(c, x + 2, y + 4, 12, 4);
    px(P.bcyan, x + 3, y + 6, 3, 2);
    const dir = e.dir || -1;
    px(P.bred, dir > 0 ? x + 12 : x - 2, y + 5, 6, 2);
    px(P.byellow, x + 6, y + 2, 4, 2);
    /* гусеницы */
    for (let i = 0; i < 16; i += 4) px(P.black, x + i, y + 9, 2, 2);
  }

  function drawMine(e) {
    const x = Math.round(e.x), y = Math.round(e.y);
    px(P.bred, x + 1, y + 1, 6, 4);
    px(P.byellow, x + 3, y, 2, 2);
    px(P.bwhite, x + 2, y + 2, 1, 1);
    px(P.black, x + 4, y + 2, 2, 2);
  }

  function drawCrusher(e) {
    const x = Math.round(e.x), y = Math.round(e.y);
    px(P.byellow, x + 1, y, 14, 3);
    px(P.bwhite, x, y + 3, 16, 8);
    dither(x, y + 3, 16, 8, P.bwhite, P.yellow, 0);
    px(P.bred, x + 2, y + 11, 12, 3);
    px(P.byellow, x + 5, y + 14, 2, 2);
    px(P.byellow, x + 9, y + 14, 2, 2);
  }

  function drawPod(e) {
    const x = Math.round(e.x), y = Math.round(e.y);
    const pul = Math.sin(e.anim * 5) > 0 ? 0 : 1;
    px(P.bgreen, x + 1, y + 2, 12, 9);
    px(P.green, x + 2, y + 3, 10, 7);
    dither(x + 2, y + 3, 10, 7, P.bgreen, P.green, pul);
    px(P.bmagenta, x + 2, y + 1, 10, 2);
    /* глаз */
    px(P.byellow, x + 5, y + 5, 4, 4);
    px(P.black, x + 6, y + 6, 2, 2);
    px(P.bwhite, x + 6, y + 6, 1, 1);
    /* корни */
    px(P.bgreen, x + 2, y + 11, 2, 1);
    px(P.bgreen, x + 10, y + 11, 2, 1);
  }

  function drawHomer(e) {
    const x = Math.round(e.x), y = Math.round(e.y);
    const c = e.hitT > 0 ? P.bwhite : P.bcyan;
    px(c, x + 2, y + 2, 10, 8);
    px(P.bblue, x + 3, y + 3, 8, 6);
    px(P.bred, x + 5, y + 4, 4, 4);
    px(P.bwhite, x + 6, y + 5, 2, 2);
    px(c, x, y + 4, 2, 2); px(c, x + 12, y + 4, 2, 2);
    /* активность */
    if (Math.sin(e.anim * 6) > 0) px(P.byellow, x + 6, y + 1, 2, 1);
  }

  function drawLauncher(e, combo) {
    const x = Math.round(e.x), y = Math.round(e.y);
    const c = combo ? P.bmagenta : P.bcyan;
    const c2 = combo ? P.bcyan : P.bmagenta;
    px(P.white, x + 1, y + 4, e.w - 2, e.h - 4);
    px(c, x + 2, y + 6, e.w - 4, 4);
    px(c2, x + 2, y + 12, e.w - 4, 2);
    px(P.byellow, x + 3, y, e.w - 6, 4);
    px(P.black, x + 4, y + 1, 2, 2);
    px(P.black, x + e.w - 6, y + 1, 2, 2);
    /* свечение */
    px(c, x, y + 8, 1, 2); px(c, x + e.w - 1, y + 8, 1, 2);
  }

  function drawExoPod(e) {
    const x = Math.round(e.x), y = Math.round(e.y);
    const pul = Math.sin(e.anim * 4) > 0;
    px(P.bblue, x, y + 18, 16, 2);
    px(P.bcyan, x + 1, y + 2, 14, 16);
    px(pul ? P.cyan : P.bblue, x + 2, y + 3, 12, 14);
    px(P.bwhite, x + 3, y + 4, 10, 5);
    px(P.black, x + 4, y + 5, 8, 3);
    px(P.bcyan, x + 5, y + 6, 2, 1);
    px(P.bcyan, x + 9, y + 6, 2, 1);
    px(P.byellow, x + 6, y + 12, 4, 1);
    px(P.bgreen, x + 7, y + 14, 2, 2);
  }

  function drawTeleporter(e) {
    const x = Math.round(e.x), y = Math.round(e.y);
    const t = Math.floor(e.anim * 6) % 2;
    px(P.bblue, x, y + e.h - 2, e.w, 2);
    for (let i = 0; i < 3; i++) {
      const yy = y + e.h - 6 + i * 2;
      px(t ? P.bcyan : P.bblue, x + 2, yy, e.w - 4, 1);
    }
    px(P.bwhite, x + e.w / 2 - 1, y + 4 + (t ? 1 : 0), 2, 6);
    g.fillStyle = t ? P.bcyan : P.bblue;
    g.fillRect(x + 2, y + 1, e.w - 4, 1);
  }

  function drawPower(e, color) {
    const x = Math.round(e.x), y = Math.round(e.y);
    const bob = Math.sin(e.anim * 5 + e.phase * 6) > 0 ? 0 : 1;
    px(P.white, x, y + 1 + bob, 8, 6);
    px(color, x + 1, y + 2 + bob, 6, 4);
    px(P.black, x + 3, y + 3 + bob, 2, 2);
    px(color, x + 2, y + 7 + bob, 4, 1);
  }

  function drawEntity(e, theme) {
    switch (e.t) {
      case 'walker': drawWalker(e); break;
      case 'flyer': drawFlyer(e); break;
      case 'swarmer': drawSwarmer(e); break;
      case 'turret': drawTurret(e); break;
      case 'tank': drawTank(e); break;
      case 'mine': drawMine(e); break;
      case 'crusher': drawCrusher(e); break;
      case 'pod': drawPod(e); break;
      case 'homer': drawHomer(e); break;
      case 'double_launcher': drawLauncher(e, false); break;
      case 'combo_launcher': drawLauncher(e, true); break;
      case 'power_laser': drawPower(e, P.bcyan); break;
      case 'power_rocket': drawPower(e, P.bmagenta); break;
      case 'exo': drawExoPod(e); break;
      case 'teleporter': drawTeleporter(e); break;
      default: break;
    }
  }

  /* ---------- игрок ---------- */
  function drawPlayer(p) {
    if (!p || !p.alive) return;
    const blink = p.invuln > 0 && p.invuln < 5 && Math.floor(now * 18) % 2 === 0;
    if (blink) return;
    const h = p.duck ? 10 : p.h;
    const x = Math.round(p.x), y = Math.round(p.y + p.h - h);
    const dir = p.facing || 1;
    const suit = p.exo ? P.bcyan : P.bwhite;
    const suit2 = p.exo ? P.cyan : P.cyan;
    if (p.exo) {
      /* экзоскелет: крупный, бронированный */
      px(P.bblue, x, y + h - 3, 14, 3);
      px(suit, x + 1, y + 4, 12, h - 7);
      px(P.cyan, x + 2, y + 5, 10, h - 9);
      px(P.byellow, x + 3, y + 1, 8, 4);
      px(P.black, x + 4, y + 2, 6, 2);
      px(P.bcyan, x + 5, y + 2, 2, 1);
      px(P.bcyan, x + 8, y + 2, 2, 1);
      px(P.bcyan, x + 2, y + h - 5, 3, 4);
      px(P.bcyan, x + 11, y + h - 5, 3, 4);
      px(P.bred, dir > 0 ? x + 13 : x - 1, y + 6, 2, 2);
      return;
    }
    /* Кайр: белый костюм, визор */
    px(suit, x + 2, y + 3, 6, h - 7);
    px(suit2, x + 2, y + 3, 2, h - 7);
    px(P.bcyan, x + 3, y, 4, 4);
    px(P.black, x + 3 + (dir > 0 ? 2 : 0), y + 1, 2, 2);
    px(P.bcyan, x + 2, y + 6, 6, 1);
    /* ноги */
    const ph = Math.floor(p.step * 2) % 2;
    const walking = Math.abs(p.vx) > 6 && p.onGround;
    if (!p.onGround) {
      px(suit, x + 2, y + h - 4, 2, 4);
      px(suit, x + 6, y + h - 4, 2, 4);
    } else if (walking) {
      px(suit, x + 2 + (ph ? 1 : 0), y + h - 4, 2, 4);
      px(suit, x + 6 - (ph ? 1 : 0), y + h - 4, 2, 4);
    } else {
      px(suit, x + 2, y + h - 4, 2, 4);
      px(suit, x + 6, y + h - 4, 2, 4);
    }
    /* бластер */
    px(P.byellow, dir > 0 ? x + 8 : x - 1, y + 6, 3, 2);
  }

  /* ---------- выстрелы / эффекты ---------- */
  function drawShots() {
    const st = PR.state;
    st.shots.forEach(function (s) {
      if (s.grenade) {
        px(P.bwhite, s.x - 2, s.y - 2, 5, 5);
        px(P.byellow, s.x - 1, s.y - 1, 3, 3);
        if (Math.floor(s.spin) % 2) px(P.bred, s.x, s.y - 3, 1, 1);
      } else {
        px(P.bwhite, s.x - 2, s.y - 1, 7, 2);
        px(s.exo ? P.bcyan : P.byellow, s.x, s.y, 5, 1);
      }
    });
    st.eShots.forEach(function (s) {
      if (s.missile) {
        px(P.bred, s.x - 3, s.y - 3, 6, 6);
        px(P.byellow, s.x - 2, s.y - 2, 4, 4);
        px(P.bwhite, s.x - 1, s.y - 1, 2, 2);
        px(P.bmagenta, s.x - 1, s.y + 3, 2, 2);
      } else {
        px(P.bmagenta, s.x - 2, s.y - 2, 4, 4);
        px(P.bwhite, s.x - 1, s.y - 1, 2, 2);
      }
    });
  }

  function drawParticles() {
    const st = PR.state;
    st.particles.forEach(function (p) {
      const a = p.life / (p.max || 1);
      g.globalAlpha = a > 0.5 ? 1 : 0.7;
      px(p.color, p.x - p.size / 2, p.y - p.size / 2, Math.max(1, p.size), Math.max(1, p.size));
      g.globalAlpha = 1;
    });
    st.booms.forEach(function (b) {
      const k = b.t / b.dur;
      const r = 2 + b.r * (0.4 + k * 0.9);
      g.globalAlpha = 1 - k;
      g.strokeStyle = b.color;
      g.lineWidth = 2;
      g.beginPath(); g.arc(b.x, b.y, r, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = P.bwhite;
      g.lineWidth = 1;
      g.beginPath(); g.arc(b.x, b.y, r * 0.65, 0, Math.PI * 2); g.stroke();
      g.globalAlpha = 1;
    });
    st.pops.forEach(function (p) {
      g.globalAlpha = Math.min(1, p.life / 0.4);
      text(p.text, p.x, p.y - 6, p.color, 1, 'center', '#000');
      g.globalAlpha = 1;
    });
  }

  /* ---------- HUD ---------- */
  function drawHUD() {
    const st = PR.state;
    const p = st.player || { laser: 0, maxLaser: 100, rockets: 0, armor: 0, exo: false };
    const y0 = H;
    px(P.black, 0, y0, W, HUD);
    /* верхняя линия */
    g.fillStyle = P.bblue;
    for (let i = 0; i < W; i += 2) g.fillRect(i, y0, 1, 1);

    /* строка 1 */
    text(PR.t('hud.score'), 4, y0, P.bcyan, 1);
    const scoreX = 4 + textW(PR.t('hud.score'), 1) + 4;
    text(String(st.score).padStart(6, '0'), scoreX, y0, P.bwhite, 1);
    const lifeX = scoreX + 42;
    text('♥', lifeX, y0, P.bred, 1);
    text(String(st.lives), lifeX + 7, y0, P.bred, 1);
    text(PR.t('hud.screen') + ' ' + (st.screen + 1) + '/' + PR.screenCount(st.level), 188, y0, P.byellow, 1, 'right');
    text(PR.t('hud.sector') + ' ' + (st.level + 1) + '/' + PR.levelCount(), 252, y0, P.byellow, 1, 'right');

    /* строка 2 */
    const y1 = y0 + 8;
    text('L', 4, y1, P.bcyan, 1);
    px('#06222a', 12, y1 + 2, 52, 4);
    px(P.bcyan, 12, y1 + 2, Math.round(52 * (p.laser / (p.maxLaser || 100))), 4);
    for (let i = 1; i < 8; i++) px('#001014', 12 + Math.round(52 / 8) * i, y1 + 2, 1, 4);
    /* гранаты — пипсы справа */
    for (let i = 0; i < (p.maxRockets || 6); i++) {
      px(i < p.rockets ? P.bmagenta : '#2a0022', 252 - (i + 1) * 6 + 3, y1 + 2, 4, 4);
    }
    /* броня экзоскелета */
    if (p.exo) {
      text(PR.t('hud.armor'), 72, y1, P.byellow, 1);
      for (let i = 0; i < 3; i++) px(i < p.armor ? P.byellow : '#332a00', 72 + PR.t('hud.armor').length * 6 + 2 + i * 5, y1 + 2, 3, 4);
    }
  }

  /* ---------- оверлеи ---------- */
  function dim(alpha) { g.fillStyle = 'rgba(0,0,0,' + alpha + ')'; g.fillRect(0, 0, W, VH); }

  function drawMessage() {
    const st = PR.state;
    if (!st.message) return;
    const s = PR.t(st.message.key);
    const y = 78;
    const w = textW(s, 1) + 16;
    panel((W - w) / 2, y, w, 13, P.byellow, '#000');
    text(s, W / 2, y + 3, P.byellow, 1, 'center');
  }

  function drawMenus() {
    const st = PR.state;
    const rects = PR.ui.layout();
    rects.forEach(function (r, i) {
      const sel = i === st.menuIndex;
      const label = r.item.label + (r.item.value ? '  ' + r.item.value : '');
      if (sel) {
        px(P.bblue, r.x - 10, r.y, 3, r.h);
        px(P.bblue, r.x + r.w + 7, r.y, 3, r.h);
        px('#000033', r.x, r.y, r.w, r.h);
        g.fillStyle = P.bcyan;
        g.fillRect(r.x, r.y, r.w, 1); g.fillRect(r.x, r.y + r.h - 1, r.w, 1);
      }
      const col = sel ? P.bwhite : P.bcyan;
      if (r.item.value) {
        text(r.item.label, r.x + 3, r.y + 3, col, 1);
        text(r.item.value, r.x + r.w - 3, r.y + 3, sel ? P.byellow : P.bblue, 1, 'right');
      } else {
        text(label, r.x + r.w / 2, r.y + 3, col, 1, 'center');
      }
      if (sel) {
        const ax = r.x - 8, ay = r.y + (r.h >> 1) - 3;
        px(P.byellow, ax + 3, ay, 1, 1);
        px(P.byellow, ax + 2, ay + 1, 2, 1);
        px(P.byellow, ax + 1, ay + 2, 3, 1);
        px(P.byellow, ax + 2, ay + 3, 2, 1);
        px(P.byellow, ax + 3, ay + 4, 1, 1);
      }
    });
  }

  /* ---------- экраны ---------- */
  function drawTitle() {
    const st = PR.state;
    background(themeOf({ theme: 'space' }));
    const logo = 'ПРОРЫВ';
    const colors = [P.byellow, P.bcyan, P.bmagenta, P.bgreen, P.bcyan, P.bwhite];
    const sc = 4;
    const tw = textW(logo, sc);
    const lx = Math.round((W - tw) / 2), ly = 30;
    /* подложка-панель под логотип (до текста!) */
    g.fillStyle = 'rgba(0,0,0,0.6)';
    g.fillRect(0, ly - 6, W, 6 * sc + 12);
    g.fillStyle = P.bblue;
    g.fillRect(20, ly - 6, W - 40, 1);
    g.fillRect(20, ly + 6 * sc + 5, W - 40, 1);
    /* тень и «свечение» */
    for (let pass = 2; pass >= 0; pass--) {
      for (let i = 0; i < logo.length; i++) {
        const col = pass === 0 ? colors[i] : pass === 1 ? '#331133' : '#112233';
        text(logo[i], lx + i * 6 * sc + pass, ly + pass, col, sc);
      }
    }

    text(PR.t('brand.ru'), W / 2, 98, P.bwhite, 1, 'center', '#000');
    text(PR.t('tagline.full'), W / 2, 108, P.bcyan, 1, 'center', '#000');

    drawMenus();

    /* марширующие пришельцы внизу */
    const baseY = 196;
    for (let i = 0; i < 8; i++) {
      const x = ((i * 34 + now * 14) % (W + 40)) - 20;
      drawWalker({ x: x, y: baseY - 12, dir: 1, anim: now * 2 + i, hitT: 0 });
    }
    /* рекорд */
    text(PR.t('msg.record') + ' ' + String(st.record).padStart(6, '0'), W - 4, 2, P.byellow, 1, 'right');
    text('ГЕФЕСТ', 4, 2, P.blue, 1);
    text(PR.t('menu.hint.quick'), W / 2, VH - 9, P.blue, 1, 'center');
    if (PR.BUILD) text(PR.t('settings.build.short', { v: PR.BUILD }), W / 2, 76, P.bblue, 1, 'center');
  }

  function background(theme) {
    const st = PR.state;
    const world = st.world;
    px('#000000', 0, 0, W, VH);
    if (world) starfield(world.seed || 1, now, theme);
    else {
      const r = rng(7);
      for (let i = 0; i < 40; i++) px(i % 4 ? P.white : P.bcyan, Math.floor(r() * W), Math.floor(r() * H), 1, 1);
    }
  }

  function drawDeathOverlay() {
    const st = PR.state;
    dim(0.25);
    const s = PR.t('msg.dead');
    panel(W / 2 - 64, 78, 128, 22, P.bred, '#000');
    text(s, W / 2, 83, P.bred, 2, 'center', '#000');
    text(PR.t('hud.lives') + ': ' + st.lives, W / 2, 92, P.bwhite, 1, 'center');
  }

  function drawWorld() {
    const st = PR.state;
    const world = st.world;
    if (!world) return;
    const theme = themeOf(world);
    background(theme);
    /* тайлы */
    for (let ty = 0; ty < ROWS; ty++) {
      for (let tx = 0; tx < COLS; tx++) {
        const id = world.tiles[ty * COLS + tx];
        if (id) drawTile(id, tx, ty, theme, world.seed);
      }
    }
    /* сущности */
    st.ents.forEach(function (e) {
      if (e.dead) return;
      drawEntity(e, theme);
    });
    drawShots();
    drawPlayer(st.player);
    drawParticles();
    drawMessage();

    /* вспышка */
    if (st.fx.flash > 0.01) {
      g.globalAlpha = Math.min(0.55, st.fx.flash);
      px(st.fx.flashColor || '#ffffff', 0, 0, W, H);
      g.globalAlpha = 1;
    }
    /* затвор флип-скрина */
    if (st.transition > 0) {
      const k = st.transition;
      const hh = Math.round(k * k * (H / 2) * 1.1);
      px('#000000', 0, 0, W, hh);
      px('#000000', 0, H - hh, W, hh);
    }
    drawHUD();
  }

  function drawPause() {
    drawWorld();
    dim(0.55);
    panel(42, 34, 172, 132, P.bcyan, '#000');
    text(PR.t('msg.paused'), W / 2, 44, P.byellow, 2, 'center', '#000');
    drawMenus();
    text(PR.t('hint.nav'), W / 2, 150, P.bcyan, 1, 'center');
  }

  function drawHelp() {
    const st = PR.state;
    const world = st.world;
    px('#000000', 0, 0, W, VH);
    starfield((world && world.seed) || 3, now * 0.3, THEMES.space);
    panel(3, 3, W - 6, VH - 6, P.bcyan, 'rgba(0,0,0,0.90)');
    text(PR.t('help.title'), W / 2, 7, P.byellow, 2, 'center', '#000');
    g.fillStyle = P.bblue; g.fillRect(16, 26, W - 32, 1);

    const rows = [
      ['← →  A D', 'key.left.act'], ['↑  W', 'key.jump.act'],
      ['↓  S', 'key.duck.act'], ['SPACE  Z', 'key.fire.act'],
      ['ESC  P', 'key.pause.act'], ['L', 'key.l.act'],
      ['G', 'key.g.act'], ['M', 'key.m.act'],
      ['N', 'key.n.act'], ['F', 'key.f.act']
    ];
    let y = 31;
    rows.forEach(function (r) {
      text(r[0], 8, y, P.byellow, 1);
      text(PR.t(r[1]), 80, y, P.bwhite, 1);
      y += 9;
    });

    g.fillStyle = P.bblue; g.fillRect(16, y - 4, W - 32, 1);
    text(PR.t('hint.title'), 8, y + 1, P.bcyan, 1);
    y += 10;
    wrapMulti(PR.t('help.goal'), 40).forEach(function (l) { text(l, 8, y, P.white, 1); y += 8; });
    y += 3;
    text('*', 6, y, P.byellow, 1);
    wrapMulti(PR.t('hint.ammo'), 39).forEach(function (l) { text(l, 14, y, P.white, 1); y += 8; });
    y += 3;
    text('*', 6, y, P.byellow, 1);
    wrapMulti(PR.t('hint.teleport'), 39).forEach(function (l) { text(l, 14, y, P.white, 1); y += 8; });
    text(PR.t('help.back'), W / 2, VH - 11, P.byellow, 1, 'center');
  }

  function drawAbout() {
    px('#000000', 0, 0, W, VH);
    starfield(9, now * 0.2, THEMES.space);
    panel(4, 4, W - 8, VH - 8, P.bmagenta, 'rgba(0,0,0,0.90)');
    text(PR.t('brand'), W / 2, 10, P.byellow, 3, 'center', '#000');
    text(PR.t('tagline'), W / 2, 38, P.bcyan, 1, 'center');
    g.fillStyle = P.bblue; g.fillRect(20, 48, W - 40, 1);
    let y = 53;
    wrapMulti(PR.t('about.text'), 40).forEach(function (l) { text(l, 7, y, P.white, 1); y += 9; });
    y += 5;
    text(PR.t('credits.original'), W / 2, y, P.byellow, 1, 'center'); y += 8;
    text(PR.t('credits.port'), W / 2, y, P.bcyan, 1, 'center'); y += 8;
    wrapMulti(PR.t('credits.thanks'), 40).forEach(function (l) { text(l, W / 2, y, P.bblue, 1, 'center'); y += 8; });
    wrapMulti(PR.t('credits.fan'), 39).forEach(function (l) { text(l, W / 2, y, P.bblue, 1, 'center'); y += 8; });
    text(PR.t('help.back'), W / 2, VH - 10, P.byellow, 1, 'center');
  }

  function drawSettings() {
    const st = PR.state;
    drawWorld();
    dim(0.72);
    panel(20, 34, W - 40, 146, P.bcyan, '#000');
    text(PR.t('settings.title'), W / 2, 38, P.byellow, 2, 'center', '#000');
    const rects = PR.ui.layout();
    rects.forEach(function (r, i) {
      const sel = i === st.menuIndex;
      const x = r.x - 16, w = r.w + 32;
      if (sel) {
        px('#001133', x, r.y, w, r.h);
        g.fillStyle = P.bcyan;
        g.fillRect(x, r.y, w, 1); g.fillRect(x, r.y + r.h - 1, w, 1);
      }
      if (r.item.key === 'back') {
        text(r.item.value || 'ESC', W / 2, r.y + 3, sel ? P.bwhite : P.bblue, 1, 'center');
        return;
      }
      text(r.item.label, x + 4, r.y + 3, sel ? P.bwhite : P.bcyan, 1);
      text(r.item.value || '', x + w - 4, r.y + 3, sel ? P.byellow : P.bblue, 1, 'right');
      if (sel) {
        const ax = x + w + 3, ay = r.y + (r.h >> 1) - 3;
        px(P.byellow, ax, ay + 2, 3, 1);
        px(P.byellow, ax + 3, ay + 1, 1, 3);
        px(P.byellow, ax, ay + 2, 1, 1);
        px(P.byellow, ax + 1, ay + 3, 2, 1);
      }
    });
    if (st.resetAsk > 0) text(PR.t('settings.resetConfirm'), W / 2, 172, P.bred, 1, 'center');
    else text(PR.t('msg.paused.hint'), W / 2, 172, P.blue, 1, 'center');
  }

  function drawBriefing() {
    const st = PR.state;
    const lv = PR.levelData(st.level) || { name: { ru: '', en: '' }, intro: { ru: '', en: '' }, theme: 'space' };
    const theme = THEMES[lv.theme] || THEMES.space;
    px('#000000', 0, 0, W, VH);
    starfield((st.world && st.world.seed) || 1, now * 0.25, THEMES.space);
    panel(4, 4, W - 8, VH - 8, P.bcyan, 'rgba(0,0,0,0.84)');

    text(PR.t('hud.sector') + '  ' + (st.level + 1) + ' / ' + PR.levelCount(), W / 2, 10, theme.accent, 1, 'center');
    const name = (lv.name[PR.settings.lang] || lv.name.ru || '').toUpperCase();
    const nsc = name.length > 16 ? 1 : 2;
    text(name, W / 2, 20, P.byellow, nsc, 'center', '#000');
    text(PR.t('level.screens', { n: PR.screenCount(st.level) }), W / 2, 40, P.bblue, 1, 'center');
    g.fillStyle = P.bblue; g.fillRect(18, 49, W - 36, 1);

    let y = 55;
    wrapMulti(lv.intro[PR.settings.lang] || lv.intro.ru, 40).forEach(function (l) { text(l, 10, y, P.white, 1); y += 8; });
    y += 4;
    ['hint.grenade', 'hint.exo'].forEach(function (k) {
      text('*', 6, y, P.byellow, 1);
      wrapMulti(PR.t(k), 39).forEach(function (l) { text(l, 13, y, P.bcyan, 1); y += 8; });
      y += 2;
    });

    /* декоративная цифра сектора и иконки противников */
    text(String(st.level + 1), 214, 128, '#1a1a33', 5);
    const base = 58;
    drawWalker({ x: base, y: 158, dir: 1, anim: now + 0.5, hitT: 0 });
    drawFlyer({ x: base + 30, y: 158, dir: 1, anim: now + 0.2, hitT: 0 });
    drawTurret({ x: base + 60, y: 160, dir: -1, hitT: 0 });
    drawPod({ x: base + 86, y: 158, anim: now + 0.9, hitT: 0 });

    if (Math.floor(now * 2) % 2 === 0) {
      text(PR.t('level.start'), W / 2, 178, P.byellow, 1, 'center');
    }
    drawHUD();
  }

  function drawBonus() {
    const st = PR.state;
    drawWorld();
    dim(0.7);
    const b = st.bonus;
    if (!b) return;
    panel(16, 34, W - 32, 134, P.byellow, '#000');
    text(PR.t('msg.bonus'), W / 2, 40, P.byellow, 2, 'center', '#000');
    const bx = [42, 84, 126, 168];
    if (b.phase === 'pick') {
      for (let i = 0; i < b.values.length; i++) {
        const x = bx[i];
        const on = i === b.index;
        panel(x, 66, 30, 24, on ? P.bwhite : P.bblue, on ? '#002244' : '#000');
        text(String(b.values[i]), x + 15, 74, on ? P.bwhite : P.bcyan, 1, 'center');
        if (on) text('▼', x + 15, 58, P.byellow, 1, 'center');
      }
      text(PR.t('msg.bonus.pick'), W / 2, 104, P.byellow, 1, 'center');
      text(PR.t('msg.bonus.pick2'), W / 2, 116, P.bwhite, 1, 'center');
    } else {
      text(String(b.chosen), W / 2, 68, P.bwhite, 3, 'center', '#111');
      text(PR.t('msg.bonus.lives') + ' → ' + b.livesBonus, W / 2, 100, P.bcyan, 1, 'center');
      text(b.noExoBonus ? PR.t('msg.bonus.noexo') : PR.t('msg.bonus.exo'), W / 2, 112, b.noExoBonus ? P.bgreen : P.bred, 1, 'center');
      if (b.extraLife) text(PR.t('msg.bonus.extra'), W / 2, 124, P.byellow, 1, 'center');
    }
    text(PR.t('msg.score') + ' ' + st.score, W / 2, 140, P.byellow, 1, 'center');
  }

  function bigCentered(str, y, color, scale) {
    text(str, W / 2, y, color, scale || 3, 'center', '#111');
  }

  function drawLevelClear() {
    const st = PR.state;
    drawWorld();
    dim(0.6);
    bigCentered(PR.t('msg.levelclear'), 62, P.byellow, 2);
    text(PR.t('hud.sector') + ' ' + (st.level + 1), W / 2, 90, P.bcyan, 1, 'center');
    text(PR.t('msg.score') + ' ' + st.score, W / 2, 104, P.bwhite, 1, 'center');
    if (Math.floor(now * 6) % 2 === 0) text('...', W / 2, 120, P.byellow, 2, 'center');
  }

  function drawGameOver() {
    const st = PR.state;
    drawWorld();
    dim(0.78);
    panel(20, 38, 216, 142, P.bred, '#000');
    bigCentered(PR.t('msg.gameover'), 46, P.bred, 2);
    text(PR.t('msg.score') + ' ' + st.score, W / 2, 74, P.bwhite, 1, 'center');
    text(PR.t('msg.record') + ' ' + st.record, W / 2, 86, P.byellow, 1, 'center');
    if (st.newRecord) text(PR.t('msg.newrecord'), W / 2, 98, P.bgreen, 1, 'center');
    drawMenus();
  }

  function drawWin() {
    const st = PR.state;
    px('#000000', 0, 0, W, VH);
    starfield(11, now * 0.5, THEMES.space);
    /* фейерверк */
    for (let i = 0; i < 5; i++) {
      const t = (now * 0.8 + i * 0.7) % 1;
      const cx = 30 + ((i * 53 + 20) % 200);
      const cy = 30 + ((i * 31) % 70);
      const r = t * 34;
      g.globalAlpha = 1 - t;
      g.strokeStyle = [P.byellow, P.bcyan, P.bmagenta, P.bgreen][i % 4];
      g.lineWidth = 2;
      g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
      g.globalAlpha = 1;
    }
    const winT = PR.t('msg.win');
    bigCentered(winT, 40, P.byellow, textW(winT, 3) > 244 ? 2 : 3);
    text(PR.t('msg.win.sub'), W / 2, 76, P.bcyan, 1, 'center');
    text(PR.t('msg.score') + ' ' + st.score, W / 2, 96, P.bwhite, 2, 'center');
    text(PR.t('msg.record') + ' ' + st.record, W / 2, 118, P.byellow, 1, 'center');
    if (st.newRecord) text(PR.t('msg.newrecord'), W / 2, 130, P.bgreen, 1, 'center');
    drawMenus();
    text(PR.t('credits.original'), W / 2, VH - 12, P.blue, 1, 'center');
  }

  /* ---------- главный вход ---------- */
  function draw(ctx, view) {
    g = ctx;
    now = (view && view.t) || PR.state.t;
    const st = PR.state;
    g.save();
    g.imageSmoothingEnabled = false;
    const shake = st.fx.shake;
    const sx = shake > 0 ? Math.round((Math.random() - 0.5) * shake) : 0;
    const sy = shake > 0 ? Math.round((Math.random() - 0.5) * shake) : 0;
    g.translate(sx, sy);

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
      default:
        px('#000000', 0, 0, W, VH);
        text('ПРОРЫВ', W / 2, 90, P.bwhite, 3, 'center');
        break;
    }
    g.restore();

    /* затемнение по краям — «кинескоп» */
    const grad = g.createRadialGradient(W / 2, VH / 2, 60, W / 2, VH / 2, 180);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.35)');
    g.fillStyle = grad;
    g.fillRect(0, 0, W, VH);
  }

  window.PR_RENDER_RETRO = { draw: draw, W: W, H: VH };
})();
