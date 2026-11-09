/* РЕДУТ · рендер НЕОН (modern). R.modern.draw(ctx, st)
   Тот же мир, но свечение/градиенты, полное разрешение. */
(function (global) {
  'use strict';
  var R = global.REDUT = global.REDUT || {};
  var K = R.consts;

  var C = {
    p1: '#7dff5a', p1g: '#6dbe45', p2: '#ffcf5a', p2g: '#e8b23a',
    eBasic: '#cfe0ff', eFast: '#5fe8ff', eArmor: '#ff9a4d', bonus: '#fff07a',
    brick: '#c17a44', brickE: '#ffb06a', steel: '#aeb8d0', water: '#2fb0e0',
    forest: '#49f08a', base: '#ffe25c', bulletP: '#fff07a', bulletE: '#ff6a5c',
    shield: '#4df0ff', ink: '#d7e0c4', muted: '#9aad7c', gold: '#f5d23e', accent: '#e8b23a'
  };

  function glow(ctx, x, y, w, h, fill, g, blur) {
    ctx.save(); if (g) { ctx.shadowColor = g; ctx.shadowBlur = blur || 10; }
    ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); ctx.restore();
  }
  function text(ctx, s, x, y, col, size, align, g) {
    ctx.save(); if (g) { ctx.shadowColor = g; ctx.shadowBlur = 10; }
    ctx.fillStyle = col; ctx.font = '800 ' + size + 'px "Segoe UI",system-ui,Arial,sans-serif';
    ctx.textAlign = align || 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(s, x, y); ctx.restore();
  }

  function tank(ctx, x, y, s, dir, col, colg) {
    var m = s * 0.14, cx = x + s / 2, cy = y + s / 2;
    ctx.save(); ctx.shadowColor = colg; ctx.shadowBlur = 12;
    // корпус
    var grd = ctx.createLinearGradient(x, y, x, y + s); grd.addColorStop(0, col); grd.addColorStop(1, colg);
    ctx.fillStyle = grd; ctx.fillRect(x + m, y + m, s - 2 * m, s - 2 * m);
    ctx.restore();
    // гусеницы
    ctx.fillStyle = 'rgba(10,14,8,.85)';
    if (dir === 'left' || dir === 'right') { ctx.fillRect(x, y, s, m); ctx.fillRect(x, y + s - m, s, m); }
    else { ctx.fillRect(x, y, m, s); ctx.fillRect(x + s - m, y, m, s); }
    // башня + ствол
    ctx.save(); ctx.shadowColor = colg; ctx.shadowBlur = 8; ctx.fillStyle = col;
    var tw = s * 0.36; ctx.fillRect(cx - tw / 2, cy - tw / 2, tw, tw);
    var bw = s * 0.16;
    if (dir === 'up') ctx.fillRect(cx - bw / 2, y - 2, bw, cy - y + 2);
    else if (dir === 'down') ctx.fillRect(cx - bw / 2, cy, bw, y + s - cy + 2);
    else if (dir === 'left') ctx.fillRect(x - 2, cy - bw / 2, cx - x + 2, bw);
    else ctx.fillRect(cx, cy - bw / 2, x + s - cx + 2, bw);
    ctx.restore();
  }

  function eagle(ctx, X, Y, s, alive) {
    ctx.save();
    if (alive) { ctx.shadowColor = C.base; ctx.shadowBlur = 16;
      var g = ctx.createLinearGradient(X, Y, X, Y + s); g.addColorStop(0, '#fff2a8'); g.addColorStop(1, C.base);
      ctx.fillStyle = g; ctx.fillRect(X + s * 0.18, Y + s * 0.18, s * 0.64, s * 0.64);
      ctx.fillStyle = '#fffbe0'; ctx.fillRect(X + s / 2 - 1.5, Y + s * 0.2, 3, s * 0.6);
    } else { ctx.fillStyle = '#3a2a08'; ctx.fillRect(X + 4, Y + 4, s - 8, s - 8); ctx.shadowColor = '#ff5a3a'; ctx.shadowBlur = 18; ctx.fillStyle = '#ff5a3a'; ctx.fillRect(X + 6, Y + s / 2 - 2, s - 12, 4); }
    ctx.restore();
  }

  function pu(ctx, x, y, kind, flash) {
    var s = 16, col = kind === 'shield' ? C.shield : kind === 'freeze' ? '#9fe8ff' : kind === 'life' ? C.p1 : C.gold;
    glow(ctx, x - s / 2, y - s / 2, s, s, flash ? '#fff' : col, col, 16);
    ctx.fillStyle = '#0a0f07'; var X = x - s / 2, Y = y - s / 2;
    if (kind === 'shield') { ctx.fillRect(X + 6, Y + 2, 4, 12); ctx.fillRect(X + 2, Y + 6, 12, 3); }
    else if (kind === 'life') { ctx.fillRect(X + 2, Y + 7, 12, 3); ctx.fillRect(X + 7, Y + 2, 3, 12); }
    else if (kind === 'freeze') { ctx.fillRect(X + 7, Y + 2, 2, 12); ctx.fillRect(X + 2, Y + 7, 12, 2); }
    else { ctx.fillRect(X + 7, Y + 2, 3, 12); ctx.fillRect(X + 3, Y + 7, 10, 3); }
  }

  function field(ctx, st) {
    var ox = K.FIELD_X, oy = K.FIELD_Y, CELLs = K.CELL, flash = (Math.floor(st.bonusFlash * 6) % 2 === 0);
    var bg = ctx.createLinearGradient(ox, oy, ox, oy + K.FIELD); bg.addColorStop(0, '#0a1408'); bg.addColorStop(1, '#0c1a0a');
    ctx.fillStyle = bg; ctx.fillRect(ox, oy, K.FIELD, K.FIELD);
    ctx.strokeStyle = 'rgba(70,120,50,.12)'; ctx.lineWidth = 1;
    for (var i = 1; i < st.cols; i++) { ctx.beginPath(); ctx.moveTo(ox + i * CELLs, oy); ctx.lineTo(ox + i * CELLs, oy + K.FIELD); ctx.moveTo(ox, oy + i * CELLs); ctx.lineTo(ox + K.FIELD, oy + i * CELLs); ctx.stroke(); }

    for (var r = 0; r < st.rows; r++) for (var c = 0; c < st.cols; c++) {
      var ch = st.grid[r][c]; if (ch === '.' || ch === 'F') continue;
      var X = ox + c * CELLs, Y = oy + r * CELLs;
      if (ch === 'B') {
        var m = st.brickMask[c + ',' + r] || 0, h = CELLs / 2;
        for (var qi = 0; qi < 4; qi++) { if (!(m & (1 << qi))) continue; var sc = qi & 1, sr = (qi >> 1) & 1;
          var gq = ctx.createLinearGradient(X, Y, X, Y + CELLs); gq.addColorStop(0, C.brickE); gq.addColorStop(1, '#6e3a18');
          ctx.fillStyle = gq; ctx.fillRect(X + sc * h, Y + sr * h, h - 1, h - 1); }
      } else if (ch === 'S') {
        glow(ctx, X + 1, Y + 1, CELLs - 2, CELLs - 2, '#5a6480', C.steel, 8);
        ctx.fillStyle = C.steel; ctx.fillRect(X + 3, Y + 3, CELLs - 6, 2); ctx.fillRect(X + 3, Y + 3, 2, CELLs - 6);
      } else if (ch === 'W') {
        ctx.fillStyle = 'rgba(20,70,110,.85)'; ctx.fillRect(X, Y, CELLs, CELLs);
        ctx.save(); ctx.shadowColor = C.water; ctx.shadowBlur = 8; ctx.strokeStyle = C.water; ctx.lineWidth = 2;
        var wob = Math.sin(st.bonusFlash * 3 + c) * 2;
        ctx.beginPath(); ctx.moveTo(X + 3, Y + CELLs / 2 + wob); ctx.lineTo(X + CELLs - 3, Y + CELLs / 2 - wob); ctx.stroke(); ctx.restore();
      } else if (ch === 'A') { eagle(ctx, X, Y, CELLs, st.base.alive); }
    }

    for (var pi = 0; pi < st.powerups.length; pi++) { var P = st.powerups[pi]; pu(ctx, ox + P.x, oy + P.y, P.kind, flash); }

    for (var e = 0; e < st.enemies.length; e++) {
      var en = st.enemies[e];
      if (en.spawn > 0 && Math.floor(en.spawn * 8) % 2 === 0) continue;
      var col = en.kind === 'fast' ? C.eFast : en.kind === 'armor' ? C.eArmor : C.eBasic;
      if (en.bonus && flash) col = C.bonus;
      tank(ctx, ox + en.x, oy + en.y, K.SIZE, en.dir, col, col);
    }
    for (var p = 0; p < st.players.length; p++) {
      var pl = st.players[p]; if (!pl.alive) continue;
      tank(ctx, ox + pl.x, oy + pl.y, K.SIZE, pl.dir, p === 0 ? C.p1 : C.p2, p === 0 ? C.p1g : C.p2g);
      if (pl.shield > 0) { ctx.save(); ctx.shadowColor = C.shield; ctx.shadowBlur = 14; ctx.strokeStyle = C.shield; ctx.lineWidth = 2; ctx.strokeRect(ox + pl.x - 2, oy + pl.y - 2, K.SIZE + 4, K.SIZE + 4); ctx.restore(); }
    }
    // лес поверх
    for (r = 0; r < st.rows; r++) for (c = 0; c < st.cols; c++) {
      if (st.grid[r][c] !== 'F') continue; var FX = ox + c * CELLs, FY = oy + r * CELLs;
      ctx.save(); ctx.shadowColor = C.forest; ctx.shadowBlur = 6; ctx.fillStyle = 'rgba(40,120,50,.9)'; ctx.fillRect(FX, FY, CELLs, CELLs);
      ctx.fillStyle = C.forest; for (var d = 0; d < 7; d++) { ctx.fillRect(FX + ((d * 11 + 4) % CELLs), FY + ((d * 7 + 3) % CELLs), 4, 4); } ctx.restore();
    }
    for (var b = 0; b < st.bullets.length; b++) { var bl = st.bullets[b]; var bc = bl.owner === 'p' ? C.bulletP : C.bulletE; glow(ctx, ox + bl.x - 3, oy + bl.y - 3, 6, 6, bc, bc, 12); }
    for (var pp = 0; pp < st.particles.length; pp++) { var P2 = st.particles[pp]; var pc = P2.c === 0 ? C.bulletP : P2.c === 1 ? C.accent : C.bulletE; glow(ctx, ox + P2.x, oy + P2.y, 3, 3, pc, pc, 8); }
  }

  function panel(ctx, st) {
    var t = R.t, X = K.PANEL_X, W = K.VIEW_W - X, cx = X + 20;
    var bg = ctx.createLinearGradient(X, 0, X, K.VIEW_H); bg.addColorStop(0, '#0a140a'); bg.addColorStop(1, '#070d06');
    ctx.fillStyle = bg; ctx.fillRect(X, 0, W, K.VIEW_H);
    ctx.save(); ctx.shadowColor = C.p1g; ctx.shadowBlur = 10; ctx.fillStyle = C.p1g; ctx.fillRect(X, 0, 2, K.VIEW_H); ctx.restore();
    text(ctx, 'РЕДУТ', cx, 44, '#fff', 26, 'left', C.p1g);
    text(ctx, t('sub'), cx, 64, C.p1, 12);
    text(ctx, t('level') + ' ' + (st.stage + 1) + '/3', cx, 104, C.accent, 18, 'left', C.accent);
    text(ctx, t('score'), cx, 140, C.muted, 12); text(ctx, '' + st.score, cx, 161, C.gold, 20, 'left', C.gold);
    text(ctx, t('best'), cx + 150, 140, C.muted, 12); text(ctx, '' + st.hi, cx + 150, 160, C.ink, 16);
    var left = st.total - st.killed;
    text(ctx, t('enemies') + ' ' + left, cx, 198, C.muted, 12);
    for (var i = 0; i < left; i++) { var ex = cx + (i % 10) * 16, ey = 204 + ((i / 10) | 0) * 16; glow(ctx, ex, ey, 10, 10, C.eBasic, C.eBasic, 6); }
    var py = 290;
    for (var pi = 0; pi < st.players.length; pi++) {
      var p = st.players[pi];
      text(ctx, t(pi === 0 ? 'p1' : 'p2'), cx, py, pi === 0 ? C.p1 : C.p2, 14, 'left', pi === 0 ? C.p1g : C.p2g);
      text(ctx, t('lives') + ' ' + Math.max(0, p.lives), cx + 36, py, C.ink, 14);
      for (var l = 0; l < Math.max(0, p.lives); l++) glow(ctx, cx + 150 + l * 13, py - 11, 9, 11, pi === 0 ? C.p1 : C.p2, pi === 0 ? C.p1g : C.p2g, 6);
      if (p.power > 0) text(ctx, '★'.repeat(p.power), cx, py + 18, C.gold, 13, 'left', C.gold);
      py += 44;
    }
    var hints = st.numPlayers === 2 ? [R.t('hudP1'), R.t('hudP2')] : [R.t('hudMove'), R.t('hudFire')];
    for (var hi = 0; hi < hints.length; hi++) text(ctx, hints[hi], cx, K.VIEW_H - 40 + hi * 16, '#5f7045', 11);
  }

  R.modern = {
    draw: function (ctx, st) {
      var W = K.VIEW_W, H = K.VIEW_H;
      ctx.imageSmoothingEnabled = true;
      ctx.fillStyle = '#05080a'; ctx.fillRect(0, 0, W, H);
      if (!st || !st.grid || !st.grid.length) { return; }
      field(ctx, st);
      ctx.save(); ctx.shadowColor = C.p1g; ctx.shadowBlur = 16; ctx.strokeStyle = 'rgba(109,190,69,.5)'; ctx.lineWidth = 2;
      ctx.strokeRect(K.FIELD_X + 1, K.FIELD_Y + 1, K.FIELD - 2, K.FIELD - 2); ctx.restore();
      panel(ctx, st);
      // баннеры
      var t = R.t, msg = null, sub = null, cxF = K.FIELD_X + K.FIELD / 2;
      if (st.phase === 'play' && st.intro > 0) { msg = t('ready') + ' ' + (st.stage + 1); sub = t('go'); }
      else if (st.phase === 'levelclear') { msg = t('clear'); }
      if (msg) {
        ctx.fillStyle = 'rgba(8,12,6,.55)'; ctx.fillRect(K.FIELD_X, H / 2 - 52, K.FIELD, 104);
        text(ctx, msg, cxF, H / 2, C.gold, 40, 'center', C.gold);
        if (sub) text(ctx, sub, cxF, H / 2 + 34, C.shield, 20, 'center', C.shield);
      }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
