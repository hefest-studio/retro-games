/* РЕДУТ · рендер 8-БИТ (classic). R.classic.draw(ctx, st)
   Внутренний буфер половинного разрешения, апскейл без сглаживания — честный пиксель. */
(function (global) {
  'use strict';
  var R = global.REDUT = global.REDUT || {};
  var K = R.consts;
  var SCALE = 0.5;
  var buf = null, bx = null;

  var PAL = {
    field: '#0b1207', grid: '#13200c',
    brickA: '#9a5a2c', brickB: '#5e3418', brickE: '#c17a44',
    steelA: '#8a93a8', steelB: '#4a5266', steelE: '#c7cede',
    water1: '#17597a', water2: '#0f3d56',
    forest: '#2f6b24', forestD: '#194014',
    p1: '#6dbe45', p1d: '#3f8f28', p2: '#e8b23a', p2d: '#a9781c',
    eBasic: '#c7ccd6', eBasicD: '#6a7080', eFast: '#5fd0e0', eFastD: '#2a7a8a',
    eArmor: '#e07a3a', eArmorD: '#8a3f14', tread: '#1a1a12',
    bulletP: '#fff07a', bulletE: '#ff6a4d', base: '#f5d23e', baseD: '#8a6a12',
    shield: '#4df0ff', ink: '#d7e0c4', muted: '#9aad7c', gold: '#f5d23e', accent: '#e8b23a'
  };

  function ensureBuf(w, h) {
    if (!buf) { buf = document.createElement('canvas'); bx = buf.getContext('2d'); }
    if (buf.width !== w || buf.height !== h) { buf.width = w; buf.height = h; }
  }
  function px(n) { return Math.round(n); }

  function brick(g, x, y, s, a, b, e) {
    g.fillStyle = b; g.fillRect(x, y, s, s);
    g.fillStyle = a; g.fillRect(x, y, s, s - 1);
    g.fillStyle = e; g.fillRect(x, y, s, 1); g.fillRect(x, y, 1, s - 1);
  }

  // Четверти кирпича по маске (бит: sr*2+sc).
  function brickCell(g, x, y, s, mask) {
    var h = s / 2, q = [[0, 0], [1, 0], [0, 1], [1, 1]];
    for (var i = 0; i < 4; i++) {
      if (!(mask & (1 << i))) continue;
      var sc = i & 1, sr = (i >> 1) & 1;
      brick(g, px(x + sc * h), px(y + sr * h), px(h), PAL.brickA, PAL.brickB, PAL.brickE);
    }
  }

  function tankSprite(g, x, y, sz, dir, col, colD, tt) {
    var s = px(sz), X = px(x), Y = px(y), m = Math.max(1, px(s * 0.14));
    // гусеницы
    g.fillStyle = PAL.tread;
    if (dir === 'left' || dir === 'right') { g.fillRect(X, Y, s, m); g.fillRect(X, Y + s - m, s, m); }
    else { g.fillRect(X, Y, m, s); g.fillRect(X + s - m, Y, m, s); }
    // корпус
    g.fillStyle = colD; g.fillRect(X + m, Y + m, s - 2 * m, s - 2 * m);
    g.fillStyle = col; g.fillRect(X + m, Y + m, s - 2 * m, s - 2 * m - 1);
    // башня
    var cx = X + s / 2, cy = Y + s / 2, tw = Math.max(2, px(s * 0.34));
    g.fillStyle = colD; g.fillRect(px(cx - tw / 2), px(cy - tw / 2), tw, tw);
    // ствол
    g.fillStyle = col;
    var bl = px(s * 0.5), bw = Math.max(2, px(s * 0.16));
    if (dir === 'up') g.fillRect(px(cx - bw / 2), px(Y - 1), bw, px(cy - Y));
    else if (dir === 'down') g.fillRect(px(cx - bw / 2), px(cy), bw, px(Y + s - cy + 1));
    else if (dir === 'left') g.fillRect(px(X - 1), px(cy - bw / 2), px(cx - X), bw);
    else g.fillRect(px(cx), px(cy - bw / 2), px(X + s - cx + 1), bw);
  }

  function drawShield(g, x, y, s) {
    g.strokeStyle = PAL.shield; g.lineWidth = 1;
    g.strokeRect(px(x) + 0.5, px(y) + 0.5, px(s) - 1, px(s) - 1);
  }

  function hud(ctx, s, x, y, col, size, align) {
    ctx.fillStyle = col; ctx.font = '700 ' + size + 'px "DejaVu Sans Mono","Courier New",monospace';
    ctx.textAlign = align || 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(s, x, y);
  }

  function drawPanel(ctx, st) {
    var t = R.t, X = K.PANEL_X, W = K.VIEW_W - X;
    ctx.fillStyle = '#0a0f07'; ctx.fillRect(X, 0, W, K.VIEW_H);
    ctx.fillStyle = '#1c2a12'; ctx.fillRect(X, 0, 2, K.VIEW_H);
    var cx = X + 20;
    hud(ctx, 'РЕДУТ', cx, 44, '#fff', 26);
    hud(ctx, t('sub'), cx, 64, PAL.green || PAL.p1, 12);
    hud(ctx, t('level') + ' ' + (st.stage + 1) + '/3', cx, 104, PAL.accent, 18);
    hud(ctx, t('score'), cx, 140, PAL.muted, 12); hud(ctx, '' + st.score, cx, 160, PAL.gold, 20);
    hud(ctx, t('best'), cx + 150, 140, PAL.muted, 12); hud(ctx, '' + st.hi, cx + 150, 160, PAL.ink, 16);
    // враги осталось
    var left = st.total - st.killed;
    hud(ctx, t('enemies') + ' ' + left, cx, 198, PAL.muted, 12);
    for (var i = 0; i < left; i++) {
      var ex = cx + (i % 10) * 16, ey = 210 + ((i / 10) | 0) * 16;
      ctx.fillStyle = PAL.eBasicD; ctx.fillRect(ex, ey, 10, 10); ctx.fillStyle = PAL.eBasic; ctx.fillRect(ex + 2, ey + 2, 6, 6);
    }
    // игроки
    var py = 290;
    for (var pi = 0; pi < st.players.length; pi++) {
      var p = st.players[pi];
      hud(ctx, t(pi === 0 ? 'p1' : 'p2'), cx, py, pi === 0 ? PAL.p1 : PAL.p2, 14);
      hud(ctx, t('lives') + ' ' + Math.max(0, p.lives), cx + 36, py, PAL.ink, 14);
      // иконки жизней
      for (var l = 0; l < Math.max(0, p.lives); l++) { ctx.fillStyle = pi === 0 ? PAL.p1 : PAL.p2; ctx.fillRect(cx + 150 + l * 12, py - 11, 9, 11); }
      if (p.power > 0) hud(ctx, '★'.repeat(p.power), cx, py + 18, PAL.gold, 13);
      py += 44;
    }
    // подсказка
    var hints = st.numPlayers === 2 ? [R.t('hudP1'), R.t('hudP2')] : [R.t('hudMove'), R.t('hudFire')];
    for (var hi = 0; hi < hints.length; hi++) hud(ctx, hints[hi], cx, K.VIEW_H - 40 + hi * 16, '#5f7045', 11);
  }

  function drawBanner(ctx, st) {
    var t = R.t, msg = null, sub = null, cxF = K.FIELD_X + K.FIELD / 2;
    if (st.phase === 'play' && st.intro > 0) { msg = t('ready') + ' ' + (st.stage + 1); sub = t('go'); }
    else if (st.phase === 'levelclear') { msg = t('clear'); }
    if (!msg) return;
    ctx.fillStyle = 'rgba(6,9,4,.6)'; ctx.fillRect(K.FIELD_X, K.VIEW_H / 2 - 48, K.FIELD, 96);
    hud(ctx, msg, cxF, K.VIEW_H / 2, PAL.gold, 36, 'center');
    if (sub) hud(ctx, sub, cxF, K.VIEW_H / 2 + 30, PAL.shield, 18, 'center');
  }

  R.classic = {
    draw: function (ctx, st) {
      var W = K.VIEW_W, H = K.VIEW_H;
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#05080a'; ctx.fillRect(0, 0, W, H);
      if (!st || !st.grid || !st.grid.length) { return; }

      var fw = px(K.FIELD * SCALE);
      ensureBuf(fw, fw);
      var g = bx, S = SCALE, flash = (Math.floor(st.bonusFlash * 6) % 2 === 0);

      g.fillStyle = PAL.field; g.fillRect(0, 0, fw, fw);
      // сетка
      g.fillStyle = PAL.grid;
      for (var i = 1; i < st.cols; i++) { g.fillRect(px(i * K.CELL * S), 0, 1, fw); g.fillRect(0, px(i * K.CELL * S), fw, 1); }

      // тайлы (сталь/вода/база/кирпич) — кирпич и лес отдельными слоями
      for (var r = 0; r < st.rows; r++) {
        for (var c = 0; c < st.cols; c++) {
          var ch = st.grid[r][c]; if (ch === '.' || ch === 'F') continue;
          var X = px(c * K.CELL * S), Y = px(r * K.CELL * S), cs = px(K.CELL * S);
          if (ch === 'B') { brickCell(g, c * K.CELL * S, r * K.CELL * S, K.CELL * S, st.brickMask[c + ',' + r] || 0); }
          else if (ch === 'S') { brick(g, X, Y, cs, PAL.steelA, PAL.steelB, PAL.steelE); g.fillStyle = PAL.steelE; g.fillRect(X + 2, Y + 2, cs - 4, 1); g.fillRect(X + 2, Y + 2, 1, cs - 4); }
          else if (ch === 'W') { g.fillStyle = PAL.water2; g.fillRect(X, Y, cs, cs); g.fillStyle = PAL.water1; var wob = Math.sin(st.bonusFlash * 3 + c) * 1; g.fillRect(X, Y + px(cs / 3) + wob, cs, 1); g.fillRect(X, Y + px(cs * 0.7), cs, 1); }
          else if (ch === 'A') { drawEagle(g, X, Y, cs, st.base.alive); }
        }
      }

      // усилители
      for (i = 0; i < st.powerups.length; i++) { var pu = st.powerups[i]; drawPU(g, (pu.x) * S, (pu.y) * S, pu.kind, flash); }

      // танки врагов
      for (i = 0; i < st.enemies.length; i++) {
        var e = st.enemies[i];
        var col = e.kind === 'fast' ? PAL.eFast : e.kind === 'armor' ? PAL.eArmor : PAL.eBasic;
        var cold = e.kind === 'fast' ? PAL.eFastD : e.kind === 'armor' ? PAL.eArmorD : PAL.eBasicD;
        if (e.bonus && flash) { col = PAL.gold; cold = PAL.baseD; }
        if (e.spawn > 0 && Math.floor(e.spawn * 8) % 2 === 0) continue;
        tankSprite(g, e.x * S, e.y * S, K.SIZE * S, e.dir, col, cold, st.bonusFlash);
      }
      // игроки
      for (i = 0; i < st.players.length; i++) {
        var p = st.players[i]; if (!p.alive) continue;
        if (p.shield > 0 && Math.floor(p.shield * 12) % 2 === 0) { /* мигание */ }
        tankSprite(g, p.x * S, p.y * S, K.SIZE * S, p.dir, i === 0 ? PAL.p1 : PAL.p2, i === 0 ? PAL.p1d : PAL.p2d, st.bonusFlash);
        if (p.shield > 0) drawShield(g, p.x * S - 1, p.y * S - 1, K.SIZE * S + 2);
      }
      // лес поверх танков (маскировка)
      for (r = 0; r < st.rows; r++) for (c = 0; c < st.cols; c++) {
        if (st.grid[r][c] !== 'F') continue;
        var fx = px(c * K.CELL * S), fy = px(r * K.CELL * S), fs = px(K.CELL * S);
        g.fillStyle = PAL.forestD; g.fillRect(fx, fy, fs, fs);
        g.fillStyle = PAL.forest;
        for (var d = 0; d < 5; d++) { var dx = fx + ((d * 7 + 2) % fs), dy = fy + ((d * 5 + 3) % fs); g.fillRect(dx, dy, 3, 3); }
      }
      // пули
      for (i = 0; i < st.bullets.length; i++) { var b = st.bullets[i]; g.fillStyle = b.owner === 'p' ? PAL.bulletP : PAL.bulletE; g.fillRect(px(b.x * S) - 1, px(b.y * S) - 1, 3, 3); }
      // частицы
      for (i = 0; i < st.particles.length; i++) { var pp = st.particles[i]; g.fillStyle = pp.c === 0 ? PAL.bulletP : pp.c === 1 ? PAL.accent : PAL.bulletE; g.fillRect(px(pp.x * S), px(pp.y * S), 2, 2); }

      // апскейл буфера поля
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(buf, 0, 0, fw, fw, K.FIELD_X, K.FIELD_Y, K.FIELD, K.FIELD);
      ctx.strokeStyle = '#2a3a18'; ctx.lineWidth = 2; ctx.strokeRect(K.FIELD_X + 1, K.FIELD_Y + 1, K.FIELD - 2, K.FIELD - 2);

      drawPanel(ctx, st);
      drawBanner(ctx, st);
    }
  };

  function drawEagle(g, X, Y, s, alive) {
    g.fillStyle = alive ? PAL.baseD : '#3a2a08'; g.fillRect(X, Y, s, s);
    g.fillStyle = alive ? PAL.base : '#5a4410';
    var m = Math.max(2, px(s * 0.18));
    g.fillRect(X + m, Y + m, s - 2 * m, s - 2 * m);
    g.fillStyle = alive ? '#fff6bf' : '#2a2008';
    g.fillRect(X + px(s / 2) - 1, Y + m, 2, s - 2 * m); // «флаг»
    if (!alive) { g.fillStyle = '#ff5a3a'; g.fillRect(X + 2, Y + 2, s - 4, 2); }
  }

  function drawPU(g, x, y, kind, flash) {
    var s = 14, X = px(x - s / 2), Y = px(y - s / 2);
    g.fillStyle = flash ? '#fff' : '#101810'; g.fillRect(X - 1, Y - 1, s + 2, s + 2);
    var col = kind === 'shield' ? PAL.shield : kind === 'freeze' ? '#9fe8ff' : kind === 'life' ? PAL.p1 : PAL.gold;
    g.fillStyle = col; g.fillRect(X, Y, s, s);
    g.fillStyle = '#0a0f07';
    if (kind === 'shield') { g.fillRect(X + 5, Y + 2, 4, 10); g.fillRect(X + 2, Y + 5, 10, 2); }
    else if (kind === 'life') { g.fillRect(X + 2, Y + 6, 10, 2); g.fillRect(X + 6, Y + 2, 2, 10); }
    else if (kind === 'freeze') { g.fillRect(X + 6, Y + 2, 2, 10); g.fillRect(X + 2, Y + 6, 10, 2); g.fillRect(X + 3, Y + 3, 2, 2); g.fillRect(X + 9, Y + 9, 2, 2); }
    else { g.fillRect(X + 6, Y + 2, 2, 10); g.fillRect(X + 3, Y + 6, 8, 2); }
  }
  PAL.green = PAL.p1;
})(typeof window !== 'undefined' ? window : globalThis);
