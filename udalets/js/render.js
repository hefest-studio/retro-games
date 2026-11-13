/* УДАЛЕЦ · рендер обеих тем. UDALETS.render(g, ctx, S, opts) — кадр игры; UDALETS.R — примитивы для титула.
   modern (по умолчанию): цеха в полумраке, кладка с фаской и бликами, стальные балки с заклёпками, свечение огня,
   кислоты и самоцветов, мягкие тени. retro: 16-цветная палитра, «пиксели» 3×3, кладка в две краски, сканлайны.
   Логику не трогает — только читает состояние. Статичный слой экрана кэшируется (уровень, экран, тема). */
(function (global) {
  'use strict';
  var U = global.UDALETS = global.UDALETS || {};
  var L = U.logic, T = L.T, COLS = L.COLS, ROWS = L.ROWS, HUD = 40, TAU = Math.PI * 2;

  // палитры цехов: [кладка, кладка-тёмная, фон-верх, фон-низ, балка]
  var MOD = [
    ['#9a5a3c', '#6d3b26', '#1d1512', '#120d0b', '#5d6876'],   // 1 Старый цех
    ['#8d4a34', '#5e2c1e', '#22120e', '#140a08', '#6a5a52'],   // 2 Кузня / Котельная
    ['#7d6a56', '#54463a', '#1a1714', '#100e0c', '#6c6f78'],   // 3 Литейная
    ['#4d6b58', '#304a3b', '#0f1a15', '#08100c', '#5a6d68'],   // 4 Кислотные чаны
    ['#56637a', '#38435a', '#121722', '#0b0e15', '#7a8496'],   // 5 Трубный ярус
    ['#6a6f90', '#464a68', '#141626', '#0c0d18', '#8088a6'],   // 6 Башня ветров / Шпиль
    ['#86743e', '#5a4c26', '#1a170c', '#100e07', '#9a8a5a'],   // 7 Часовой механизм
    ['#8e3a48', '#5f2230', '#1e0c12', '#12070b', '#7a5a62'],   // 8 Горн Мастера
    ['#6c4a92', '#462e66', '#170f22', '#0d0815', '#8a78b0']    // бонус
  ];
  var RET = [
    ['#aa0000', '#550000', '#ff5555'], ['#aa5500', '#552a00', '#ffff55'], ['#aaaaaa', '#555555', '#ffffff'], ['#00aa00', '#005500', '#55ff55'],
    ['#0000aa', '#000055', '#5555ff'], ['#00aaaa', '#005555', '#55ffff'], ['#aa5500', '#552a00', '#ffff55'], ['#aa00aa', '#550055', '#ff55ff'], ['#aa00aa', '#550055', '#ff55ff']
  ];
  var PM = { pixel: false, ink: '#f4eee6', muted: '#a49a92', accent: '#ffc24a', good: '#5ee08f', bad: '#ff5d6c', warn: '#ffb020', hud: '#0e0b0a', hudLine: '#2e2622', bar: '#2a2320' };
  var PR = { pixel: true, ink: '#ffffff', muted: '#aaaaaa', accent: '#ffff55', good: '#55ff55', bad: '#ff5555', warn: '#ffff55', hud: '#000000', hudLine: '#5555ff', bar: '#555555' };
  function hash(a, b) { var n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return n - Math.floor(n); }
  function retro(g) { return g.themeName === 'retro'; }
  function rr(ctx, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  // «пиксель» retro-темы: всё кратно 3 px
  function px(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x / 3) * 3, Math.round(y / 3) * 3, Math.max(3, Math.round(w / 3) * 3), Math.max(3, Math.round(h / 3) * 3)); }

  // ---------- Статичный слой экрана ----------
  var cache = {};
  function roomLayer(LV, room, isRetro) {
    var key = LV.idx + ':' + (LV.bonus ? 'b' : '') + ':' + room + ':' + (isRetro ? 'r' : 'm');
    if (cache[key]) return cache[key];
    var c = document.createElement('canvas'); c.width = COLS * T; c.height = ROWS * T;
    var x = c.getContext('2d'), B = L.roomBox(LV, room), th = LV.theme, i, j;
    if (isRetro) {
      var R = RET[th]; x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height);
      // редкие «звёзды»-заклёпки на чёрном фоне
      for (i = 0; i < 40; i++) px(x, hash(i, room + th) * c.width, hash(room, i + 7) * c.height, 3, 3, '#000055');
      for (j = 0; j < ROWS; j++) for (i = 0; i < COLS; i++) {
        var ch = L.tile(LV, B.x0 + i, B.y0 + j), X = i * T, Y = j * T;
        if (ch === '#' || ch === '%') {
          x.fillStyle = R[0]; x.fillRect(X, Y, T, T);
          x.fillStyle = R[1];
          for (var k = 0; k < 3; k++) { x.fillRect(X, Y + k * 8 + 6, T, 2); x.fillRect(X + ((k + j) % 2 ? 3 : 15), Y + k * 8, 3, 6); }
          if (ch === '%') { x.fillStyle = R[1]; x.fillRect(X + 9, Y + 9, 3, 3); }   // еле заметная выбоина тайника
        } else if (ch === '=') {
          x.fillStyle = '#555555'; x.fillRect(X, Y, T, T);
          x.fillStyle = '#aaaaaa'; x.fillRect(X, Y, T, 3); x.fillStyle = '#000000'; x.fillRect(X, Y + T - 3, T, 3);
          x.fillStyle = '#ffffff'; x.fillRect(X + 3, Y + 9, 3, 3); x.fillRect(X + 15, Y + 9, 3, 3);
        }
      }
    } else {
      var M = MOD[th], gb = x.createLinearGradient(0, 0, 0, c.height);
      gb.addColorStop(0, M[2]); gb.addColorStop(1, M[3]); x.fillStyle = gb; x.fillRect(0, 0, c.width, c.height);
      // дальний план: кладка-узор, окна цеха, силуэты шестерён и труб
      x.globalAlpha = 0.05; x.fillStyle = '#ffffff';
      for (j = 0; j < c.height; j += 12) for (i = -((j / 12) % 2) * 12; i < c.width; i += 24) x.fillRect(i + 1, j + 1, 22, 10);
      x.globalAlpha = 1;
      for (i = 0; i < 3; i++) {
        var wx = 70 + i * 210 + hash(room, i) * 60, wy = 40 + hash(i, room) * 50;
        var gw = x.createLinearGradient(0, wy, 0, wy + 90); gw.addColorStop(0, 'rgba(150,170,200,.10)'); gw.addColorStop(1, 'rgba(150,170,200,.02)');
        x.fillStyle = gw; rr(x, wx, wy, 54, 90, 26); x.fill();
        x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 3; x.beginPath(); x.moveTo(wx + 27, wy + 4); x.lineTo(wx + 27, wy + 90); x.moveTo(wx, wy + 45); x.lineTo(wx + 54, wy + 45); x.stroke();
      }
      x.strokeStyle = 'rgba(255,255,255,.045)'; x.lineWidth = 6;
      for (i = 0; i < 2; i++) {
        var cx = hash(room + 3, i) * c.width, cy = c.height * (0.3 + 0.5 * hash(i, room + 9)), r = 40 + 30 * hash(i, room);
        x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.stroke();
        for (k = 0; k < 10; k++) { var a = k / 10 * TAU; x.beginPath(); x.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); x.lineTo(cx + Math.cos(a) * (r + 12), cy + Math.sin(a) * (r + 12)); x.stroke(); }
      }
      x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(0, hash(room, 2) * 120 + 30, c.width, 10);
      for (j = 0; j < ROWS; j++) for (i = 0; i < COLS; i++) {
        var ch2 = L.tile(LV, B.x0 + i, B.y0 + j), X2 = i * T, Y2 = j * T, open = !L.isSolid(LV, B.x0 + i, B.y0 + j - 1) && L.tile(LV, B.x0 + i, B.y0 + j - 1) !== '%';
        if (ch2 === '#' || ch2 === '%') {
          var v = hash(B.x0 + i, B.y0 + j);
          for (k = 0; k < 2; k++) {
            var by = Y2 + k * 12, off = ((j * 2 + k) % 2) ? 12 : 0;
            for (var bx = -off; bx < T; bx += 24) {
              var x0 = Math.max(X2, X2 + bx), x1 = Math.min(X2 + T, X2 + bx + 24), shade = hash(B.x0 * 2 + i * 2 + bx, by) < 0.5 ? M[0] : M[1];
              var gr = x.createLinearGradient(0, by, 0, by + 12); gr.addColorStop(0, shade); gr.addColorStop(1, M[1]);
              x.fillStyle = gr; x.fillRect(x0, by, x1 - x0, 12);
              x.fillStyle = 'rgba(0,0,0,.45)'; x.fillRect(x0, by + 11, x1 - x0, 1); if (bx + 24 <= T && bx + 24 > 0) x.fillRect(X2 + bx + 23, by, 1, 12);
            }
          }
          if (open) { x.fillStyle = 'rgba(255,220,180,.22)'; x.fillRect(X2, Y2, T, 2); x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(X2, Y2 + 2, T, 1); }
          if (v > 0.9) { x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(X2 + 4 + v * 10, Y2 + 3, 3, 3); }
          if (ch2 === '%') { x.strokeStyle = 'rgba(0,0,0,.28)'; x.lineWidth = 1; x.beginPath(); x.moveTo(X2 + 6, Y2 + 4); x.lineTo(X2 + 11, Y2 + 12); x.lineTo(X2 + 8, Y2 + 20); x.stroke(); }
        } else if (ch2 === '=') {
          var gs = x.createLinearGradient(0, Y2, 0, Y2 + T); gs.addColorStop(0, '#9aa4b2'); gs.addColorStop(0.2, M[4]); gs.addColorStop(1, '#2b3038');
          x.fillStyle = gs; x.fillRect(X2, Y2 + 1, T, T - 4);
          x.fillStyle = 'rgba(0,0,0,.5)'; x.fillRect(X2, Y2 + T - 3, T, 3);
          x.fillStyle = 'rgba(255,255,255,.25)'; x.fillRect(X2, Y2 + 1, T, 2);
          x.fillStyle = '#c9cfd8'; [6, 18].forEach(function (rx) { x.beginPath(); x.arc(X2 + rx, Y2 + 11, 2, 0, TAU); x.fill(); });
          x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(X2 + T - 1, Y2 + 3, 1, T - 6);
          // тень под балкой
          x.fillStyle = 'rgba(0,0,0,.22)'; if (!L.isSolid(LV, B.x0 + i, B.y0 + j + 1)) x.fillRect(X2, Y2 + T, T, 6);
        }
      }
    }
    cache[key] = c; return c;
  }

  // ---------- Опасности (анимированные) ----------
  function hazard(ctx, ch, X, Y, t, isRetro, k) {
    var i;
    if (ch === '^') {
      if (isRetro) { for (i = 0; i < 3; i++) { px(ctx, X + i * 8 + 3, Y + 15, 3, 9, '#aaaaaa'); px(ctx, X + i * 8 + 3, Y + 12, 3, 3, '#ffffff'); px(ctx, X + i * 8, Y + 21, 9, 3, '#aaaaaa'); } return; }
      for (i = 0; i < 3; i++) {
        var gx = ctx.createLinearGradient(X + i * 8, 0, X + i * 8 + 8, 0); gx.addColorStop(0, '#e6ebf2'); gx.addColorStop(1, '#6b7380');
        ctx.fillStyle = gx; ctx.beginPath(); ctx.moveTo(X + i * 8, Y + T); ctx.lineTo(X + i * 8 + 4, Y + 10); ctx.lineTo(X + i * 8 + 8, Y + T); ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,90,90,.5)'; for (i = 0; i < 3; i++) ctx.fillRect(X + i * 8 + 3, Y + 10, 2, 2);
    } else if (ch === '~') {
      if (isRetro) {
        for (i = 0; i < 4; i++) { var h = 6 + ((Math.floor(t * 10) + i * 3 + k) % 4) * 3; px(ctx, X + i * 6, Y + T - h, 6, h, i % 2 ? '#ff5555' : '#ffff55'); }
        px(ctx, X, Y + 21, T, 3, '#aa0000'); return;
      }
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      var gl = ctx.createRadialGradient(X + 12, Y + T, 2, X + 12, Y + T, 26); gl.addColorStop(0, 'rgba(255,140,40,.45)'); gl.addColorStop(1, 'rgba(255,80,0,0)');
      ctx.fillStyle = gl; ctx.fillRect(X - 14, Y - 6, T + 28, T + 6); ctx.restore();
      for (i = 0; i < 3; i++) {
        var fh = 12 + 7 * Math.sin(t * 9 + i * 2.1 + k * 1.3), fx = X + 4 + i * 8;
        var gf = ctx.createLinearGradient(0, Y + T - fh, 0, Y + T); gf.addColorStop(0, 'rgba(255,240,150,.95)'); gf.addColorStop(0.5, '#ff9b2e'); gf.addColorStop(1, '#d33a12');
        ctx.fillStyle = gf; ctx.beginPath(); ctx.moveTo(fx - 5, Y + T); ctx.quadraticCurveTo(fx - 4, Y + T - fh * 0.5, fx + Math.sin(t * 7 + i) * 2, Y + T - fh); ctx.quadraticCurveTo(fx + 4, Y + T - fh * 0.5, fx + 5, Y + T); ctx.fill();
      }
    } else if (ch === 'a') {
      var wv = Math.sin(t * 3 + k) * 2;
      if (isRetro) { px(ctx, X, Y + 12, T, 12, '#00aa00'); px(ctx, X, Y + 9 + (Math.floor(t * 4 + k) % 2) * 3, T, 3, '#55ff55'); if ((Math.floor(t * 3) + k) % 3 === 0) px(ctx, X + 9, Y + 15, 3, 3, '#55ff55'); return; }
      var ga = ctx.createLinearGradient(0, Y + 10, 0, Y + T); ga.addColorStop(0, '#9dff6a'); ga.addColorStop(0.3, '#3fcf4a'); ga.addColorStop(1, '#14602a');
      ctx.fillStyle = ga; ctx.beginPath(); ctx.moveTo(X, Y + 12 + wv); ctx.quadraticCurveTo(X + 12, Y + 9 - wv, X + T, Y + 12 + wv); ctx.lineTo(X + T, Y + T); ctx.lineTo(X, Y + T); ctx.fill();
      var bp = (t * 0.8 + k * 0.37) % 1; ctx.fillStyle = 'rgba(220,255,200,' + (0.7 * (1 - bp)).toFixed(2) + ')';
      ctx.beginPath(); ctx.arc(X + 6 + (k * 7) % 12, Y + T - 3 - bp * 10, 2, 0, TAU); ctx.fill();
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(80,255,90,.08)'; ctx.fillRect(X, Y - 8, T, 20); ctx.restore();
    }
  }

  // ---------- Предметы ----------
  function gem(ctx, cx, cy, col, hi, s, isRetro, t) {
    if (isRetro) { px(ctx, cx - 6, cy - 3, 12, 6, col); px(ctx, cx - 3, cy - 6, 6, 12, col); px(ctx, cx - 3, cy - 3, 3, 3, hi); return; }
    ctx.save(); ctx.translate(cx, cy);
    ctx.shadowColor = col; ctx.shadowBlur = 10;
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.9, -s * 0.2); ctx.lineTo(0, s); ctx.lineTo(-s * 0.9, -s * 0.2); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = hi; ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.45, -s * 0.2); ctx.lineTo(0, s * 0.1); ctx.lineTo(-s * 0.45, -s * 0.2); ctx.closePath(); ctx.fill();
    var sp = (t * 1.3 + cx * 0.01) % 2; if (sp < 0.3) { ctx.fillStyle = 'rgba(255,255,255,' + (1 - sp / 0.3).toFixed(2) + ')'; ctx.fillRect(-s * 0.6, -s * 0.7, 2, 6); ctx.fillRect(-s * 0.6 - 2, -s * 0.7 + 2, 6, 2); }
    ctx.restore();
  }
  function cup(ctx, cx, cy, t, isRetro, scale) {
    scale = scale || 1;
    if (isRetro) {
      px(ctx, cx - 9, cy - 9, 18, 6, '#ffff55'); px(ctx, cx - 6, cy - 3, 12, 6, '#ffff55'); px(ctx, cx - 3, cy + 3, 6, 3, '#aa5500'); px(ctx, cx - 6, cy + 6, 12, 3, '#ffff55');
      px(ctx, cx - 12, cy - 9, 3, 6, '#aa5500'); px(ctx, cx + 9, cy - 9, 3, 6, '#aa5500'); if (Math.floor(t * 4) % 2) px(ctx, cx - 3, cy - 6, 3, 3, '#ffffff'); return;
    }
    ctx.save(); ctx.translate(cx, cy + Math.sin(t * 2.5) * 1.5); ctx.scale(scale, scale);
    var gl = ctx.createRadialGradient(0, 0, 2, 0, 0, 22); gl.addColorStop(0, 'rgba(255,214,90,.55)'); gl.addColorStop(1, 'rgba(255,200,60,0)'); ctx.fillStyle = gl; ctx.fillRect(-24, -24, 48, 48);
    var gc = ctx.createLinearGradient(-9, 0, 9, 0); gc.addColorStop(0, '#a8741c'); gc.addColorStop(0.45, '#ffe48a'); gc.addColorStop(1, '#b07a1e');
    ctx.fillStyle = gc; ctx.beginPath(); ctx.moveTo(-9, -9); ctx.lineTo(9, -9); ctx.quadraticCurveTo(9, 3, 2, 4); ctx.lineTo(2, 7); ctx.lineTo(6, 9); ctx.lineTo(-6, 9); ctx.lineTo(-2, 7); ctx.lineTo(-2, 4); ctx.quadraticCurveTo(-9, 3, -9, -9); ctx.fill();
    ctx.strokeStyle = '#d9a640'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(-10, -4, 4, Math.PI * 0.5, Math.PI * 1.5); ctx.stroke(); ctx.beginPath(); ctx.arc(10, -4, 4, -Math.PI * 0.5, Math.PI * 0.5); ctx.stroke();
    ctx.fillStyle = '#e8483a'; ctx.beginPath(); ctx.arc(0, -3, 2.2, 0, TAU); ctx.fill();
    var sp = (t * 0.9) % 1.6; if (sp < 0.4) { ctx.fillStyle = 'rgba(255,255,255,' + (1 - sp / 0.4).toFixed(2) + ')'; ctx.fillRect(4, -12, 2, 8); ctx.fillRect(1, -9, 8, 2); }
    ctx.restore();
  }
  function item(ctx, k, cx, cy, t, isRetro) {
    var bob = isRetro ? 0 : Math.sin(t * 3 + cx * 0.05) * 1.5; cy += bob;
    switch (k) {
      case '.':
        if (isRetro) { px(ctx, cx - 4, cy - 4, 9, 9, '#aaaaaa'); px(ctx, cx - 1, cy - 1, 3, 3, '#000'); return; }
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(t * 1.5); ctx.fillStyle = '#c9a25a';
        for (var i = 0; i < 8; i++) { ctx.rotate(TAU / 8); ctx.fillRect(-1.5, -7, 3, 3); }
        ctx.beginPath(); ctx.arc(0, 0, 5, 0, TAU); ctx.fill(); ctx.fillStyle = '#3a2a14'; ctx.beginPath(); ctx.arc(0, 0, 2, 0, TAU); ctx.fill(); ctx.restore(); return;
      case 'g': gem(ctx, cx, cy, isRetro ? '#00aa00' : '#3fdc7a', isRetro ? '#55ff55' : '#c4ffd9', 7, isRetro, t); return;
      case 'b': gem(ctx, cx, cy, isRetro ? '#0000aa' : '#3f8cff', isRetro ? '#55ffff' : '#c8e0ff', 8, isRetro, t); return;
      case 'R': gem(ctx, cx, cy, isRetro ? '#aa0000' : '#ff3d5a', isRetro ? '#ff5555' : '#ffd0d8', 9, isRetro, t); return;
      case 'K': cup(ctx, cx, cy, t, isRetro); return;
      case 'G':
        if (isRetro) { px(ctx, cx - 10, cy - 3, 18, 3, '#aaaaaa'); px(ctx, cx - 10, cy, 9, 6, '#aa5500'); return; }
        ctx.save(); ctx.translate(cx, cy); ctx.fillStyle = '#7b4a24'; rr(ctx, -10, -1, 9, 6, 2); ctx.fill(); ctx.fillStyle = '#b8c0cc'; ctx.fillRect(-3, -3, 14, 3); ctx.fillStyle = '#e8b04a'; ctx.fillRect(-4, -4, 4, 6); ctx.restore(); return;
      case 'A':
        if (isRetro) { px(ctx, cx - 7, cy - 4, 15, 9, '#aa5500'); px(ctx, cx - 4, cy - 1, 9, 3, '#ffff55'); return; }
        ctx.fillStyle = '#5a4a2e'; rr(ctx, cx - 8, cy - 5, 16, 11, 2); ctx.fill(); ctx.fillStyle = '#e8c35a'; for (var a = 0; a < 3; a++) ctx.fillRect(cx - 5 + a * 4, cy - 8, 2, 6); return;
      case 'J':
        if (isRetro) { px(ctx, cx - 6, cy - 9, 12, 15, '#aaaaaa'); px(ctx, cx - 3, cy + 6, 6, 3, '#ff5555'); return; }
        ctx.save(); ctx.translate(cx, cy); var gj = ctx.createLinearGradient(-7, 0, 7, 0); gj.addColorStop(0, '#6f7a88'); gj.addColorStop(0.5, '#dfe5ee'); gj.addColorStop(1, '#6f7a88');
        ctx.fillStyle = gj; rr(ctx, -7, -10, 6, 16, 3); ctx.fill(); rr(ctx, 1, -10, 6, 16, 3); ctx.fill(); ctx.fillStyle = '#c0392b'; ctx.fillRect(-7, -3, 14, 3);
        ctx.fillStyle = 'rgba(255,170,60,' + (0.6 + 0.4 * Math.sin(t * 20)).toFixed(2) + ')'; ctx.beginPath(); ctx.moveTo(-6, 7); ctx.lineTo(-4, 12); ctx.lineTo(-2, 7); ctx.moveTo(2, 7); ctx.lineTo(4, 12); ctx.lineTo(6, 7); ctx.fill(); ctx.restore(); return;
      case 'F':
        if (isRetro) { px(ctx, cx - 6, cy - 6, 12, 12, '#ff5555'); px(ctx, cx - 3, cy - 9, 6, 3, '#aaaaaa'); return; }
        ctx.fillStyle = '#d2412f'; rr(ctx, cx - 6, cy - 6, 12, 13, 2); ctx.fill(); ctx.fillStyle = '#ffd0a0'; ctx.fillRect(cx - 3, cy - 2, 6, 2); ctx.fillStyle = '#9aa4b2'; ctx.fillRect(cx - 2, cy - 9, 4, 3); return;
      case 'W':
        if (isRetro) { var q = Math.floor(t * 6) % 4; px(ctx, cx - 9, cy - 9, 18, 18, ['#aa00aa', '#ff55ff', '#5555ff', '#55ffff'][q]); px(ctx, cx - 3, cy - 3, 6, 6, '#000'); return; }
        ctx.save(); ctx.translate(cx, cy); for (var w = 0; w < 4; w++) { ctx.rotate(t * 2 + w); ctx.strokeStyle = 'hsla(' + (280 + w * 25) + ',90%,70%,.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 4 + w * 2.5, 0, Math.PI * 1.3); ctx.stroke(); } ctx.restore(); return;
      case '+':
        if (isRetro) { px(ctx, cx - 6, cy - 6, 6, 6, '#ff5555'); px(ctx, cx, cy - 6, 6, 6, '#ff5555'); px(ctx, cx - 6, cy, 12, 3, '#ff5555'); px(ctx, cx - 3, cy + 3, 6, 3, '#ff5555'); return; }
        ctx.save(); ctx.translate(cx, cy); ctx.shadowColor = '#ff5d6c'; ctx.shadowBlur = 10; ctx.fillStyle = '#ff5d6c'; ctx.beginPath(); ctx.moveTo(0, 7); ctx.bezierCurveTo(-12, -2, -6, -11, 0, -4); ctx.bezierCurveTo(6, -11, 12, -2, 0, 7); ctx.fill(); ctx.restore(); return;
    }
  }
  function door(ctx, X, Y, open, t, isRetro) {   // X,Y — левый верх клетки над полом (дверь — 1×2 клетки)
    var y0 = Y - T;
    if (isRetro) {
      px(ctx, X - 3, y0 - 3, T + 6, 2 * T + 3, '#aa5500');
      px(ctx, X, y0, T, 2 * T, open ? (Math.floor(t * 4) % 2 ? '#55ffff' : '#ffffff') : '#555555');
      if (!open) { px(ctx, X + 15, y0 + 21, 3, 6, '#ffff55'); px(ctx, X + 3, y0 + 6, 18, 3, '#aaaaaa'); px(ctx, X + 3, y0 + 33, 18, 3, '#aaaaaa'); }
      return;
    }
    ctx.fillStyle = '#3a2a1e'; rr(ctx, X - 4, y0 - 6, T + 8, 2 * T + 6, 8); ctx.fill();
    ctx.fillStyle = '#c99a4a'; ctx.fillRect(X - 4, y0 - 6, T + 8, 3);
    if (open) {
      var g = ctx.createLinearGradient(0, y0, 0, y0 + 2 * T); g.addColorStop(0, '#fff7d0'); g.addColorStop(1, '#ffb347');
      ctx.save(); ctx.shadowColor = '#ffc24a'; ctx.shadowBlur = 18 + 6 * Math.sin(t * 4); ctx.fillStyle = g; rr(ctx, X, y0, T, 2 * T, 6); ctx.fill(); ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,.6)'; for (var i = 0; i < 3; i++) { var p = (t * 0.7 + i / 3) % 1; ctx.fillRect(X + 4 + i * 7, y0 + 2 * T - p * 2 * T, 2, 2); }
    } else {
      var gd = ctx.createLinearGradient(X, 0, X + T, 0); gd.addColorStop(0, '#4a5260'); gd.addColorStop(0.5, '#7a8494'); gd.addColorStop(1, '#3e4552');
      ctx.fillStyle = gd; rr(ctx, X, y0, T, 2 * T, 5); ctx.fill();
      ctx.fillStyle = '#2a2f38'; ctx.fillRect(X, y0 + 12, T, 3); ctx.fillRect(X, y0 + 34, T, 3);
      ctx.fillStyle = '#e0b04a'; rr(ctx, X + 14, y0 + 20, 6, 8, 2); ctx.fill(); ctx.fillStyle = '#222'; ctx.fillRect(X + 16, y0 + 23, 2, 3);
    }
  }

  // ---------- Герой: подмастерье-удалец (красный картуз с очками-гоглами, синяя рубаха, кожаный фартук) ----------
  function hero(ctx, X, Y, H, t, o) {   // X — центр, Y — подошвы (px)
    o = o || {};
    var f = H.face || 1, isRetro = o.retro, air = !H.ground, walk = H.ground && Math.abs(H.vx) > 0.1, ph = H.walkT * 2.2;
    if (o.blink && Math.floor(t * 12) % 2) return;
    ctx.save(); ctx.translate(X, Y); ctx.scale(f, 1);
    var leg = walk ? Math.sin(ph * Math.PI) * 5 : air ? 3 : 0;
    if (isRetro) {
      if (o.jetOwned) { px(ctx, -12, -27, 6, 15, '#aaaaaa'); if (H.jet) px(ctx, -12, -12, 6, 6 + (Math.floor(t * 20) % 2) * 3, '#ffff55'); }
      px(ctx, -6 + leg * 0.6, -9, 6, 9, '#0000aa'); px(ctx, 0 - leg * 0.6, -9, 6, 9, '#0000aa');
      px(ctx, -6 + leg * 0.6, -3, 6, 3, '#552a00'); px(ctx, 0 - leg * 0.6, -3, 6, 3, '#552a00');
      px(ctx, -6, -24, 12, 15, '#5555ff'); px(ctx, -3, -21, 9, 12, '#aa5500');
      px(ctx, 3, -21 + (o.aim ? 0 : 3), 9, 3, o.gun ? '#aaaaaa' : '#ffaa77');
      px(ctx, -6, -33, 12, 9, '#ffaa77'); px(ctx, -9, -36, 18, 3, '#aa0000'); px(ctx, -6, -39, 12, 3, '#ff5555');
      px(ctx, 0, -33, 6, 3, '#55ffff'); px(ctx, 3, -30, 3, 3, '#000');
      ctx.restore(); return;
    }
    // ранец
    if (o.jetOwned) {
      var gj = ctx.createLinearGradient(-14, 0, -6, 0); gj.addColorStop(0, '#6f7a88'); gj.addColorStop(0.5, '#dfe5ee'); gj.addColorStop(1, '#6f7a88');
      ctx.fillStyle = gj; rr(ctx, -14, -28, 7, 16, 3); ctx.fill(); ctx.fillStyle = '#c0392b'; ctx.fillRect(-14, -22, 7, 2);
      if (H.jet) {
        var fl = 8 + Math.sin(t * 40) * 3; var gf = ctx.createLinearGradient(0, -12, 0, -12 + fl + 6); gf.addColorStop(0, '#fff3b0'); gf.addColorStop(0.5, '#ff9b2e'); gf.addColorStop(1, 'rgba(255,60,0,0)');
        ctx.fillStyle = gf; ctx.beginPath(); ctx.moveTo(-14, -12); ctx.lineTo(-10.5, -6 + fl); ctx.lineTo(-7, -12); ctx.fill();
      }
    }
    // ноги и сапоги
    ctx.fillStyle = '#2d3e66'; rr(ctx, -6 + leg * 0.7, -12, 5, 10, 2); ctx.fill(); rr(ctx, 1 - leg * 0.7, -12, 5, 10, 2); ctx.fill();
    ctx.fillStyle = '#3a2416'; rr(ctx, -7 + leg * 0.7, -4, 7, 4, 2); ctx.fill(); rr(ctx, 0 - leg * 0.7, -4, 7, 4, 2); ctx.fill();
    // тело: рубаха + фартук
    var gs = ctx.createLinearGradient(0, -26, 0, -11); gs.addColorStop(0, '#4f7fd8'); gs.addColorStop(1, '#2e55a8');
    ctx.fillStyle = gs; rr(ctx, -7, -26, 14, 15, 4); ctx.fill();
    ctx.fillStyle = '#8a5a32'; rr(ctx, -4, -23, 10, 12, 3); ctx.fill(); ctx.fillStyle = '#c99a4a'; ctx.fillRect(-3, -19, 8, 1.5);
    // рука / ружьё
    if (o.gun) { ctx.fillStyle = '#7b4a24'; rr(ctx, 1, -20, 7, 5, 2); ctx.fill(); ctx.fillStyle = '#b8c0cc'; ctx.fillRect(6, -21, 10, 3); }
    else { ctx.fillStyle = '#f2b48a'; rr(ctx, 3, -22 + (air ? -4 : 0), 4, 9, 2); ctx.fill(); }
    // голова, картуз с гоглами
    ctx.fillStyle = '#f2b48a'; rr(ctx, -6, -36, 12, 11, 4); ctx.fill();
    ctx.fillStyle = '#5a3418'; ctx.fillRect(-6, -30, 3, 4);
    ctx.fillStyle = '#d23a2c'; rr(ctx, -7, -41, 14, 7, 4); ctx.fill(); ctx.fillRect(2, -36, 8, 2.5);
    ctx.fillStyle = '#7ee0ff'; ctx.beginPath(); ctx.arc(-1, -38, 2.4, 0, TAU); ctx.arc(4, -38, 2.4, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#3a2416'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(-1, -38, 2.4, 0, TAU); ctx.moveTo(6.4, -38); ctx.arc(4, -38, 2.4, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#222'; ctx.fillRect(2, -32, 2, 2);
    ctx.restore();
  }

  // ---------- Обитатели ----------
  function enemy(ctx, e, X, Y, t, isRetro) {   // X,Y — центр (у ходока — подошвы)
    var i;
    if (e.k === 'w') {   // шестерняк — латунный жук-шестерёнка
      if (isRetro) { px(ctx, X - 9, Y - 18, 18, 12, '#aa5500'); px(ctx, X - 6, Y - 21, 12, 3, '#ffff55'); px(ctx, X + e.dir * 6 - 2, Y - 15, 3, 3, '#ff5555'); for (i = 0; i < 3; i++) px(ctx, X - 9 + i * 7, Y - 6 + ((Math.floor(t * 8) + i) % 2) * 3, 3, 3, '#aaaaaa'); return; }
      ctx.save(); ctx.translate(X, Y - 11);
      ctx.strokeStyle = '#3a2a16'; ctx.lineWidth = 2; for (i = 0; i < 3; i++) { var lg = Math.sin(t * 14 + i * 2) * 3; ctx.beginPath(); ctx.moveTo(-6 + i * 6, 4); ctx.lineTo(-8 + i * 6 + lg, 11); ctx.stroke(); }
      ctx.rotate(t * 3 * e.dir); ctx.fillStyle = '#c98a3a'; for (i = 0; i < 8; i++) { ctx.rotate(TAU / 8); ctx.fillRect(-2, -11, 4, 4); }
      var gb = ctx.createRadialGradient(-3, -3, 1, 0, 0, 9); gb.addColorStop(0, '#ffd88a'); gb.addColorStop(1, '#9a5e1e'); ctx.fillStyle = gb; ctx.beginPath(); ctx.arc(0, 0, 8.5, 0, TAU); ctx.fill();
      ctx.restore(); ctx.fillStyle = '#ff4a3a'; ctx.beginPath(); ctx.arc(X + e.dir * 4, Y - 13, 2.2, 0, TAU); ctx.fill(); return;
    }
    if (e.k === 'f') {   // искрокрыл — огненная моль
      var fl = Math.sin(t * 22) * 6;
      if (isRetro) { px(ctx, X - 3, Y - 3, 6, 6, '#ffff55'); px(ctx, X - 12, Y - 6 + (fl > 0 ? 0 : 3), 9, 6, '#ff5555'); px(ctx, X + 3, Y - 6 + (fl > 0 ? 0 : 3), 9, 6, '#ff5555'); return; }
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; var gg = ctx.createRadialGradient(X, Y, 1, X, Y, 16); gg.addColorStop(0, 'rgba(255,200,80,.6)'); gg.addColorStop(1, 'rgba(255,120,0,0)'); ctx.fillStyle = gg; ctx.fillRect(X - 16, Y - 16, 32, 32); ctx.restore();
      ctx.fillStyle = 'rgba(255,110,60,.85)'; ctx.beginPath(); ctx.ellipse(X - 7, Y - 2, 7, 3 + Math.abs(fl) * 0.5, -0.5, 0, TAU); ctx.ellipse(X + 7, Y - 2, 7, 3 + Math.abs(fl) * 0.5, 0.5, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff1b0'; ctx.beginPath(); ctx.ellipse(X, Y, 3.5, 5, 0, 0, TAU); ctx.fill(); return;
    }
    if (e.k === 'v') {   // клёпань — клёпаный шар с глазом
      if (isRetro) { px(ctx, X - 9, Y - 9, 18, 18, '#555555'); px(ctx, X - 3, Y - 3, 6, 6, '#55ffff'); px(ctx, X - 12, Y - 3, 3, 6, '#aaaaaa'); px(ctx, X + 9, Y - 3, 3, 6, '#aaaaaa'); return; }
      ctx.save(); ctx.translate(X, Y);
      ctx.strokeStyle = 'rgba(160,170,190,.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(0, -40); ctx.stroke();
      var gv = ctx.createRadialGradient(-3, -3, 1, 0, 0, 10); gv.addColorStop(0, '#c8d0dc'); gv.addColorStop(1, '#46505e'); ctx.fillStyle = gv; ctx.beginPath(); ctx.arc(0, 0, 9, 0, TAU); ctx.fill();
      ctx.fillStyle = '#8a94a4'; for (i = 0; i < 6; i++) { var a = i / 6 * TAU + t; ctx.beginPath(); ctx.arc(Math.cos(a) * 7, Math.sin(a) * 7, 1.3, 0, TAU); ctx.fill(); }
      ctx.fillStyle = '#7ef0ff'; ctx.beginPath(); ctx.arc(0, 0, 3.4, 0, TAU); ctx.fill(); ctx.fillStyle = '#082028'; ctx.beginPath(); ctx.arc(e.dir * 1, 0, 1.5, 0, TAU); ctx.fill();
      ctx.restore(); return;
    }
    // плевун — парящая печурка, плюётся угольками
    var warn = e.cd < 0.4;
    if (isRetro) { px(ctx, X - 9, Y - 9, 18, 15, '#aa0000'); px(ctx, X - 6, Y - 3, 12, 6, warn ? '#ffff55' : '#ff5555'); px(ctx, X - 3, Y - 12, 6, 3, '#555555'); px(ctx, X - 9, Y + 6, 3, 3, '#ffff55'); px(ctx, X + 6, Y + 6, 3, 3, '#ffff55'); return; }
    ctx.save(); ctx.translate(X, Y);
    var gs = ctx.createLinearGradient(0, -10, 0, 9); gs.addColorStop(0, '#6a2a2a'); gs.addColorStop(1, '#2a0e0e'); ctx.fillStyle = gs; rr(ctx, -10, -9, 20, 17, 5); ctx.fill();
    ctx.fillStyle = '#4a4f58'; ctx.fillRect(-3, -14, 6, 5);
    ctx.save(); ctx.shadowColor = '#ff8a3d'; ctx.shadowBlur = warn ? 18 : 8; ctx.fillStyle = warn ? '#fff1a0' : '#ff7a2a'; rr(ctx, -6, -3, 12, 6, 3); ctx.fill(); ctx.restore();
    ctx.fillStyle = 'rgba(255,160,60,.7)'; for (i = 0; i < 2; i++) { var p = (t * 2 + i * 0.5) % 1; ctx.fillRect(-6 + i * 10, 9 + p * 6, 2, 2); }
    ctx.restore();
  }

  // ---------- HUD ----------
  function hud(g, ctx, S, P, isRetro) {
    var W = g.W;
    ctx.fillStyle = P.hud; ctx.fillRect(0, 0, W, HUD);
    ctx.fillStyle = P.hudLine; ctx.fillRect(0, HUD - (isRetro ? 3 : 1), W, isRetro ? 3 : 1);
    var f = isRetro ? '"Courier New", monospace' : 'Inter, system-ui, sans-serif';
    function tx(s, x, y, o) { o = o || {}; ctx.fillStyle = o.color || P.ink; ctx.font = (o.weight || 800) + ' ' + (o.size || 14) + 'px ' + f; ctx.textAlign = o.align || 'left'; ctx.textBaseline = 'middle'; ctx.fillText(isRetro ? String(s).toUpperCase() : s, x, y); }
    tx(g.t('score'), 12, 13, { size: 10, color: P.muted, weight: 700 }); tx(String(S.score).padStart(6, '0'), 12, 28, { size: 16, color: P.accent });
    tx(g.t('level'), 104, 13, { size: 10, color: P.muted, weight: 700 }); tx(S.inBonus ? '★' : String(S.level) + '/10', 104, 28, { size: 16 });
    // кубок
    tx(g.t('cupL'), 176, 13, { size: 10, color: P.muted, weight: 700 });
    ctx.globalAlpha = S.cup || S.inBonus ? 1 : 0.25; cup(ctx, 190, 29, g.time, isRetro, 0.75); ctx.globalAlpha = 1;
    // ружьё
    var x0 = 236;
    if (S.gun) {
      tx(g.t('ammoL'), x0, 13, { size: 10, color: P.muted, weight: 700 });
      for (var i = 0; i < Math.min(S.ammo, L.AMMO_MAX); i++) { ctx.fillStyle = S.ammo ? '#e8c35a' : P.bad; if (isRetro) px(ctx, x0 + i * 6, 23, 3, 9, '#ffff55'); else { rr(ctx, x0 + i * 5.5, 22, 3.5, 11, 1.5); ctx.fill(); } }
      if (!S.ammo) tx(g.t('empty'), x0, 28, { size: 12, color: P.bad });
    }
    x0 = 360;
    if (S.jetOwned) {
      tx(g.t('fuelL'), x0, 13, { size: 10, color: P.muted, weight: 700 });
      var fr = S.fuel / L.FUEL_MAX, bw = 96;
      ctx.fillStyle = P.bar; if (isRetro) ctx.fillRect(x0, 23, bw, 9); else { rr(ctx, x0, 23, bw, 9, 4.5); ctx.fill(); }
      ctx.fillStyle = fr < 0.25 ? P.bad : (S.hero.jet ? '#ffb347' : P.good);
      if (isRetro) ctx.fillRect(x0, 23, Math.round(bw * fr / 3) * 3, 9); else if (fr > 0) { rr(ctx, x0, 23, Math.max(9, bw * fr), 9, 4.5); ctx.fill(); }
    }
    if (S.inBonus) tx(g.t('bonusTime') + ' ' + Math.ceil(Math.max(0, S.bonusT)), 470, 28, { size: 14, color: P.warn });
    // жизни
    tx(g.t('lives'), W - 12, 13, { size: 10, color: P.muted, weight: 700, align: 'right' });
    for (var l = 0; l < S.lives; l++) {
      var lx = W - 20 - l * 20;
      if (isRetro) { px(ctx, lx - 6, 21, 12, 3, '#aa0000'); px(ctx, lx - 3, 24, 9, 9, '#ffaa77'); }
      else { ctx.fillStyle = '#f2b48a'; rr(ctx, lx - 5, 23, 10, 10, 3.5); ctx.fill(); ctx.fillStyle = '#d23a2c'; rr(ctx, lx - 6, 19, 12, 6, 3); ctx.fill(); ctx.fillStyle = '#7ee0ff'; ctx.fillRect(lx - 2, 21, 5, 2); }
    }
  }

  // ---------- Кадр ----------
  U.render = function (g, ctx, S, o) {
    o = o || {};
    var isRetro = retro(g), P = isRetro ? PR : PM, LV = S.LV, t = g.time, room = S.room, B = L.roomBox(LV, room);
    var sx = function (x) { return (x - B.x0) * T; }, sy = function (y) { return HUD + (y - B.y0) * T; };
    ctx.fillStyle = isRetro ? '#000' : MOD[LV.theme][3]; ctx.fillRect(0, 0, g.W, g.H);
    ctx.drawImage(roomLayer(LV, room, isRetro), 0, HUD);
    var i, j, k = 0;
    for (j = B.y0; j < B.y1; j++) for (i = B.x0; i < B.x1; i++) { var ch = L.tile(LV, i, j); if (L.HAZ[ch]) hazard(ctx, ch, sx(i), sy(j), t, isRetro, k++); }
    door(ctx, sx(LV.exit.c), sy(LV.exit.r - 1), S.cup || LV.bonus, t, isRetro);
    LV.items.forEach(function (it) { if (S.got[it.id] || it.c < B.x0 || it.c >= B.x1 || it.r < B.y0 || it.r >= B.y1) return; item(ctx, it.k, sx(it.c + 0.5), sy(it.r + 0.5), t, isRetro); });
    S.enemies.forEach(function (e) { if (e.alive && e.room === room) enemy(ctx, e, sx(e.x), sy(e.y), t + e.id, isRetro); });
    S.eshots.forEach(function (b) {
      if (isRetro) { px(ctx, sx(b.x) - 4, sy(b.y) - 4, 9, 9, '#ff5555'); px(ctx, sx(b.x) - 1, sy(b.y) - 1, 3, 3, '#ffff55'); return; }
      ctx.save(); ctx.shadowColor = '#ff7a2a'; ctx.shadowBlur = 10; ctx.fillStyle = '#ffb05a'; ctx.beginPath(); ctx.arc(sx(b.x), sy(b.y), 4, 0, TAU); ctx.fill(); ctx.restore();
    });
    S.shots.forEach(function (b) {
      if (isRetro) { px(ctx, sx(b.x) - 6, sy(b.y) - 1, 12, 3, '#ffffff'); return; }
      ctx.save(); ctx.shadowColor = '#ffe9a0'; ctx.shadowBlur = 8; ctx.fillStyle = '#fff6c8'; rr(ctx, sx(b.x) - 7, sy(b.y) - 1.5, 14, 3, 1.5); ctx.fill(); ctx.restore();
    });
    if (S.phase !== 'dead') {
      var H = S.hero;
      if (!isRetro) { ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(sx(H.x), sy(Math.ceil(H.y - 0.01)) , 9, 2.5, 0, 0, TAU); if (H.ground) ctx.fill(); }
      hero(ctx, sx(H.x), sy(H.y), H, t, { retro: isRetro, gun: S.gun, jetOwned: S.jetOwned, blink: S.inv > 0 });
    }
    if (o.fx) o.fx(ctx, sx, sy);
    // всплывающие подписи
    (o.toasts || []).forEach(function (q) {
      var a = Math.min(1, q.t / 0.4), yy = sy(q.y) - (q.life - q.t) * 18;
      ctx.globalAlpha = a; ctx.font = (q.big ? 900 : 800) + ' ' + (q.big ? 16 : 12) + 'px ' + (isRetro ? '"Courier New", monospace' : 'Inter, system-ui, sans-serif');
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      var s = isRetro ? String(q.text).toUpperCase() : q.text, xx = Math.max(70, Math.min(g.W - 70, sx(q.x)));
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillText(s, xx + 1, yy + 1); ctx.fillStyle = q.color || P.accent; ctx.fillText(s, xx, yy); ctx.globalAlpha = 1;
    });
    // баннер уровня / прохождения
    if (o.banner) {
      var bw = 380, bh = 70, bx = (g.W - bw) / 2, by = HUD + 100;
      ctx.globalAlpha = Math.min(1, o.banner.a);
      if (isRetro) { ctx.fillStyle = '#000'; ctx.fillRect(bx, by, bw, bh); ctx.fillStyle = P.hudLine; ctx.fillRect(bx, by, bw, 3); ctx.fillRect(bx, by + bh - 3, bw, 3); ctx.fillRect(bx, by, 3, bh); ctx.fillRect(bx + bw - 3, by, 3, bh); }
      else { ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 20; ctx.fillStyle = 'rgba(16,12,10,.88)'; rr(ctx, bx, by, bw, bh, 14); ctx.fill(); ctx.restore(); ctx.strokeStyle = 'rgba(255,194,74,.5)'; ctx.lineWidth = 1.5; rr(ctx, bx + 0.75, by + 0.75, bw - 1.5, bh - 1.5, 14); ctx.stroke(); }
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '900 22px ' + (isRetro ? '"Courier New", monospace' : 'Inter, system-ui, sans-serif'); ctx.fillStyle = P.accent;
      ctx.fillText(isRetro ? o.banner.title.toUpperCase() : o.banner.title, g.W / 2, by + 26);
      ctx.font = '700 12px ' + (isRetro ? '"Courier New", monospace' : 'Inter, system-ui, sans-serif'); ctx.fillStyle = P.muted;
      ctx.fillText(isRetro ? o.banner.sub.toUpperCase() : o.banner.sub, g.W / 2, by + 50);
      ctx.globalAlpha = 1;
    }
    if (!isRetro) { var vg = ctx.createRadialGradient(g.W / 2, HUD + 180, 160, g.W / 2, HUD + 180, 420); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.35)'); ctx.fillStyle = vg; ctx.fillRect(0, HUD, g.W, g.H - HUD); }
    else { ctx.fillStyle = 'rgba(0,0,0,.18)'; for (var y = HUD; y < g.H; y += 3) ctx.fillRect(0, y, g.W, 1); }
    hud(g, ctx, S, P, isRetro);
  };
  U.R = { hero: hero, cup: cup, enemy: enemy, item: item, PM: PM, PR: PR, MOD: MOD, HUD: HUD, rr: rr, px: px, roomLayer: roomLayer };
})(typeof window !== 'undefined' ? window : globalThis);
