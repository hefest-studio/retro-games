/* УДАЛЕЦ · рендер обеих тем. UDALETS.render(g, ctx, S, opts) — кадр игры; UDALETS.R — примитивы для титула.
   Переделка 2026-11: камера плавно следует за героем (opts.cam — левый верх вида в клетках), горны (остывшие → тлеют →
   пылают), выдох мехов, продухи с восходящим потоком, крыльчатки и заслонки, таблички-подсказки; новый облик Удальца —
   медные вихры под кожаным ремешком, горчичная рубаха, кузнечные мехи за спиной.
   modern (по умолчанию): цеха в полумраке, кладка с фаской, стальные балки, свечение огня и горнов, виньетка.
   retro: 16-цветная палитра, «пиксели» 3×3, клёпаные листы на тёмно-синем, сканлайны. Логику не трогает — только читает состояние. */
(function (global) {
  'use strict';
  var U = global.UDALETS = global.UDALETS || {};
  var L = U.logic, T = L.T, COLS = L.COLS, ROWS = L.ROWS, HUD = 40, TAU = Math.PI * 2;

  // палитры цехов: [кладка, кладка-тёмная, фон-верх, фон-низ, балка]
  var MOD = [
    ['#9a6a3c', '#6d4526', '#1d1612', '#120d0b', '#5d6876'],   // 1 Старый цех
    ['#8d5a34', '#5e381e', '#22140e', '#140b08', '#6a5a52'],   // 2 Кузня / Котельная
    ['#7d6a56', '#54463a', '#1a1714', '#100e0c', '#6c6f78'],   // 3 Литейная
    ['#4d6b58', '#304a3b', '#0f1a15', '#08100c', '#5a6d68'],   // 4 Кислотные чаны
    ['#56637a', '#38435a', '#121722', '#0b0e15', '#7a8496'],   // 5 Трубный ярус
    ['#6a6f90', '#464a68', '#141626', '#0c0d18', '#8088a6'],   // 6 Башня ветров / Шпиль
    ['#86743e', '#5a4c26', '#1a170c', '#100e07', '#9a8a5a'],   // 7 Часовой механизм
    ['#8e4a3a', '#5f2a22', '#1e0e0c', '#120807', '#7a5a62']    // 8 Горн Мастера
  ];
  // retro: [лист, тень листа, заклёпки/блик, фон]
  var RET = [
    ['#aa5500', '#552a00', '#ffff55', '#000055'], ['#aa5500', '#552a00', '#ffff55', '#000000'], ['#aaaaaa', '#555555', '#ffffff', '#000055'], ['#00aa00', '#005500', '#55ff55', '#000000'],
    ['#00aaaa', '#005555', '#55ffff', '#000055'], ['#5555ff', '#0000aa', '#55ffff', '#000000'], ['#aa5500', '#552a00', '#ffff55', '#000055'], ['#aa00aa', '#550055', '#ff55ff', '#000000']
  ];
  var PM = { pixel: false, ink: '#f4eee6', muted: '#a49a92', accent: '#ffb347', good: '#5ee08f', bad: '#ff5d6c', warn: '#ffb020', hud: '#0e0b0a', hudLine: '#2e2622', bar: '#2a2320' };
  var PR = { pixel: true, ink: '#ffffff', muted: '#aaaaaa', accent: '#ffff55', good: '#55ff55', bad: '#ff5555', warn: '#ffff55', hud: '#000000', hudLine: '#00aaaa', bar: '#555555' };
  function hash(a, b) { var n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return n - Math.floor(n); }
  function retro(g) { return g.themeName === 'retro'; }
  function rr(ctx, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  // «пиксель» retro-темы: всё кратно 3 px
  function px(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x / 3) * 3, Math.round(y / 3) * 3, Math.max(3, Math.round(w / 3) * 3), Math.max(3, Math.round(h / 3) * 3)); }

  // ---------- Статичный слой экрана (фон и твердь; заслонки — отдельно, они поднимаются) ----------
  var cache = {};
  function solidAt(LV, c, r) { var ch = L.tile(LV, c, r); return ch === '#' || ch === '%' || ch === '=' || ch === 'u'; }
  function roomLayer(LV, room, isRetro) {
    var key = LV.idx + ':' + room + ':' + (isRetro ? 'r' : 'm');
    if (cache[key]) return cache[key];
    var c = document.createElement('canvas'); c.width = COLS * T; c.height = ROWS * T;
    var x = c.getContext('2d'), B = L.roomBox(LV, room), th = LV.theme % MOD.length, i, j, k;
    if (isRetro) {
      var R = RET[th]; x.fillStyle = R[3]; x.fillRect(0, 0, c.width, c.height);
      // дальний план: трубы и редкие огоньки
      for (i = 0; i < 3; i++) { var py = 30 + hash(room, i) * 280; x.fillStyle = R[3] === '#000000' ? '#000055' : '#000000'; x.fillRect(0, Math.round(py / 3) * 3, c.width, 6); for (k = 0; k < 6; k++) px(x, hash(i, k + room) * c.width, py - 3, 6, 12, x.fillStyle); }
      for (i = 0; i < 24; i++) px(x, hash(i, room + th) * c.width, hash(room, i + 7) * c.height, 3, 3, '#555555');
      for (j = 0; j < ROWS; j++) for (i = 0; i < COLS; i++) {
        var ch = L.tile(LV, B.x0 + i, B.y0 + j), X = i * T, Y = j * T;
        if (ch === '#' || ch === '%') {   // клёпаный лист
          x.fillStyle = R[1]; x.fillRect(X, Y, T, T); x.fillStyle = R[0]; x.fillRect(X + 3, Y + 3, T - 6, T - 6);
          x.fillStyle = R[2]; x.fillRect(X + 3, Y + 3, 3, 3); x.fillRect(X + T - 6, Y + T - 6, 3, 3);
          if (!solidAt(LV, B.x0 + i, B.y0 + j - 1)) { x.fillStyle = R[2]; x.fillRect(X, Y, T, 3); }
          if (ch === '%') { x.fillStyle = R[1]; x.fillRect(X + 12, Y + 9, 3, 3); }   // еле заметная выбоина тайника
        } else if (ch === '=') {   // ферма
          x.fillStyle = '#555555'; x.fillRect(X, Y, T, 6); x.fillRect(X, Y + T - 6, T, 3);
          x.fillStyle = '#aaaaaa'; x.fillRect(X, Y, T, 3);
          for (k = 0; k < 4; k++) { x.fillStyle = '#555555'; x.fillRect(X + k * 6, Y + 6 + (k % 2) * 6, 3, 9 - (k % 2) * 3); }
        } else if (ch === 'u') {   // продух
          x.fillStyle = '#555555'; x.fillRect(X, Y, T, T); x.fillStyle = '#000000'; for (k = 0; k < 4; k++) x.fillRect(X + 3 + k * 6, Y + 3, 3, T - 9);
          x.fillStyle = '#55ffff'; x.fillRect(X, Y, T, 3);
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
        var ch2 = L.tile(LV, B.x0 + i, B.y0 + j), X2 = i * T, Y2 = j * T, open = !solidAt(LV, B.x0 + i, B.y0 + j - 1);
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
          x.fillStyle = 'rgba(0,0,0,.22)'; if (!L.isSolid(LV, B.x0 + i, B.y0 + j + 1)) x.fillRect(X2, Y2 + T, T, 6);
        } else if (ch2 === 'u') {   // продух: чугунная решётка
          var gu = x.createLinearGradient(0, Y2, 0, Y2 + T); gu.addColorStop(0, '#6c7480'); gu.addColorStop(1, '#2a2f36');
          x.fillStyle = gu; x.fillRect(X2, Y2, T, T);
          x.fillStyle = '#0d1014'; for (k = 0; k < 4; k++) { rr(x, X2 + 3 + k * 5, Y2 + 4, 3, T - 9, 1.5); x.fill(); }
          x.fillStyle = 'rgba(160,220,255,.35)'; x.fillRect(X2, Y2, T, 2);
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
      case '+':
        if (isRetro) { px(ctx, cx - 6, cy - 6, 6, 6, '#ff5555'); px(ctx, cx, cy - 6, 6, 6, '#ff5555'); px(ctx, cx - 6, cy, 12, 3, '#ff5555'); px(ctx, cx - 3, cy + 3, 6, 3, '#ff5555'); return; }
        ctx.save(); ctx.translate(cx, cy); ctx.shadowColor = '#ff5d6c'; ctx.shadowBlur = 10; ctx.fillStyle = '#ff5d6c'; ctx.beginPath(); ctx.moveTo(0, 7); ctx.bezierCurveTo(-12, -2, -6, -11, 0, -4); ctx.bezierCurveTo(6, -11, 12, -2, 0, 7); ctx.fill(); ctx.restore(); return;
    }
  }

  // ---------- Горн: X,Y — левый верх клетки (горн стоит на полу), heat 0..3 ----------
  function furnace(ctx, X, Y, heat, t, isRetro, k) {
    var cx = X + T / 2, base = Y + T, lit = heat >= L.HEAT_NEED, i;
    if (isRetro) {
      px(ctx, cx - 15, base - 21, 30, 21, '#aa0000'); px(ctx, cx - 12, base - 27, 24, 6, '#aa0000'); px(ctx, cx - 6, base - 33, 12, 6, '#555555');
      px(ctx, cx - 9, base - 15, 18, 12, '#000000');
      if (heat > 0) { var fl = Math.floor(t * 8 + k) % 2; px(ctx, cx - 6, base - 9 - (lit ? 6 : 0) - fl * 3, 12, 6 + (lit ? 6 : 0), heat > 1 ? '#ffff55' : '#ff5555'); if (heat > 1) px(ctx, cx - 3, base - 12 - (lit ? 6 : 0), 6, 3, '#ffffff'); }
      if (lit) { px(ctx, cx - 3, base - 42 - (Math.floor(t * 6) % 3) * 3, 3, 3, '#ffff55'); px(ctx, cx + 3, base - 39 - (Math.floor(t * 5 + 1) % 3) * 3, 3, 3, '#ff5555'); }
      else for (i = 0; i < heat; i++) px(ctx, cx - 9 + i * 9, base - 3, 3, 3, '#ffff55');
      return;
    }
    if (lit) {   // свечение
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      var gl = ctx.createRadialGradient(cx, base - 12, 4, cx, base - 12, 58 + 4 * Math.sin(t * 5 + k)); gl.addColorStop(0, 'rgba(255,170,60,.55)'); gl.addColorStop(1, 'rgba(255,90,0,0)');
      ctx.fillStyle = gl; ctx.fillRect(cx - 64, base - 76, 128, 96); ctx.restore();
    }
    // кирпичный купол
    var gk = ctx.createLinearGradient(cx - 16, 0, cx + 16, 0); gk.addColorStop(0, '#5a2a1c'); gk.addColorStop(0.5, lit ? '#b8553a' : '#7a4030'); gk.addColorStop(1, '#4a2216');
    ctx.fillStyle = gk; ctx.beginPath(); ctx.moveTo(cx - 16, base); ctx.lineTo(cx - 16, base - 16); ctx.quadraticCurveTo(cx - 16, base - 30, cx, base - 30); ctx.quadraticCurveTo(cx + 16, base - 30, cx + 16, base - 16); ctx.lineTo(cx + 16, base); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1; for (i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(cx - 16, base - 6 - i * 7); ctx.lineTo(cx + 16, base - 6 - i * 7); ctx.stroke(); }
    ctx.fillStyle = '#3a3f48'; ctx.fillRect(cx - 5, base - 38, 10, 9); ctx.fillStyle = '#596170'; ctx.fillRect(cx - 6, base - 39, 12, 3);
    // топка
    var mouth = ctx.createLinearGradient(0, base - 18, 0, base); mouth.addColorStop(0, '#120806'); mouth.addColorStop(1, '#251008');
    ctx.fillStyle = mouth; rr(ctx, cx - 9, base - 19, 18, 17, 7); ctx.fill();
    if (heat > 0) {
      var hh = lit ? 16 : 5 + heat * 4;
      ctx.save(); ctx.shadowColor = '#ff8a2a'; ctx.shadowBlur = lit ? 16 : 8;
      for (i = 0; i < 3; i++) {
        var fh = hh * (0.7 + 0.3 * Math.sin(t * 11 + i * 2.1 + k)), fx = cx - 5 + i * 5;
        var gf = ctx.createLinearGradient(0, base - 3 - fh, 0, base - 3); gf.addColorStop(0, lit ? 'rgba(255,245,170,.95)' : 'rgba(255,170,80,.9)'); gf.addColorStop(0.6, '#ff8a2a'); gf.addColorStop(1, '#c4300e');
        ctx.fillStyle = gf; ctx.beginPath(); ctx.moveTo(fx - 3.5, base - 3); ctx.quadraticCurveTo(fx - 3, base - 3 - fh * 0.6, fx + Math.sin(t * 9 + i) * 1.5, base - 3 - fh); ctx.quadraticCurveTo(fx + 3, base - 3 - fh * 0.6, fx + 3.5, base - 3); ctx.fill();
      }
      ctx.restore();
    } else { ctx.fillStyle = '#4a4440'; for (i = 0; i < 4; i++) ctx.fillRect(cx - 7 + i * 4, base - 5 - (i % 2), 3, 2); }
    if (lit) for (i = 0; i < 4; i++) { var p = (t * 0.8 + i / 4 + k * 0.13) % 1; ctx.fillStyle = 'rgba(255,' + (200 - i * 30) + ',90,' + (1 - p).toFixed(2) + ')'; ctx.fillRect(cx - 3 + Math.sin(p * 9 + i) * 6, base - 40 - p * 26, 2, 2); }
    else if (heat > 0) for (i = 0; i < heat; i++) { ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.arc(cx - 6 + i * 6, base + 4, 1.8, 0, TAU); ctx.fill(); }
  }
  // ---------- Крыльчатка: центр клетки ----------
  function vane(ctx, cx, cy, spinT, t, isRetro) {
    var a = spinT != null ? (t - spinT) * 14 + 0.3 : 0.3;
    if (isRetro) {
      px(ctx, cx - 3, cy - 3, 6, 6, '#ffff55');
      var q = Math.floor(a / 0.785) % 2;
      if (q) { px(ctx, cx - 12, cy - 3, 9, 6, '#aaaaaa'); px(ctx, cx + 3, cy - 3, 9, 6, '#aaaaaa'); px(ctx, cx - 3, cy - 12, 6, 9, '#aaaaaa'); px(ctx, cx - 3, cy + 3, 6, 9, '#aaaaaa'); }
      else { px(ctx, cx - 12, cy - 12, 6, 6, '#aaaaaa'); px(ctx, cx + 6, cy - 12, 6, 6, '#aaaaaa'); px(ctx, cx - 12, cy + 6, 6, 6, '#aaaaaa'); px(ctx, cx + 6, cy + 6, 6, 6, '#aaaaaa'); }
      if (spinT == null && Math.floor(t * 2) % 2) px(ctx, cx - 15, cy - 15, 3, 3, '#55ffff');
      return;
    }
    ctx.save(); ctx.translate(cx, cy);
    ctx.strokeStyle = '#5a626e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 12, 0, TAU); ctx.stroke();
    if (spinT == null) { ctx.strokeStyle = 'rgba(140,220,255,' + (0.35 + 0.3 * Math.sin(t * 4)).toFixed(2) + ')'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 15, 0, TAU); ctx.stroke(); }
    ctx.rotate(a);
    for (var i = 0; i < 4; i++) { ctx.rotate(TAU / 4); var gv = ctx.createLinearGradient(0, -2, 0, -11); gv.addColorStop(0, '#9aa4b2'); gv.addColorStop(1, '#d9dfe8'); ctx.fillStyle = gv; ctx.beginPath(); ctx.moveTo(-2, -2); ctx.quadraticCurveTo(-6, -8, -1, -11); ctx.lineTo(3, -10); ctx.lineTo(2, -2); ctx.fill(); }
    ctx.fillStyle = '#c99a4a'; ctx.beginPath(); ctx.arc(0, 0, 3, 0, TAU); ctx.fill();
    ctx.restore();
  }
  // ---------- Заслонка: X,Y — левый верх клетки; lift 0..1 — поднята ----------
  function shutter(ctx, X, Y, lift, isRetro) {
    var dy = -lift * T * 2;
    if (isRetro) { px(ctx, X, Y + dy, T, T, '#555555'); for (var k = 0; k < 3; k++) px(ctx, X + 3 + k * 7, Y + dy, 3, T, '#aaaaaa'); px(ctx, X, Y + dy + 9, T, 3, '#aa5500'); return; }
    ctx.save(); ctx.beginPath(); ctx.rect(X - 2, Y - T * 3, T + 4, T * 4); ctx.clip();
    var g = ctx.createLinearGradient(X, 0, X + T, 0); g.addColorStop(0, '#3a414c'); g.addColorStop(0.5, '#7a8494'); g.addColorStop(1, '#353b45');
    ctx.fillStyle = g; ctx.fillRect(X + 1, Y + dy, T - 2, T);
    ctx.fillStyle = 'rgba(0,0,0,.4)'; for (var i = 0; i < 3; i++) ctx.fillRect(X + 4 + i * 7, Y + dy + 2, 2, T - 4);
    ctx.fillStyle = '#c99a4a'; ctx.fillRect(X + 1, Y + dy + 10, T - 2, 3);
    ctx.restore();
  }
  // ---------- Табличка-подсказка: прыжок + выдох вниз = выше ----------
  function sign(ctx, cx, cy, t, isRetro) {
    if (isRetro) {
      px(ctx, cx - 18, cy - 15, 36, 30, '#aa5500'); px(ctx, cx - 15, cy - 12, 30, 24, '#000000');
      px(ctx, cx - 9, cy + 3, 3, 6, '#ffffff'); px(ctx, cx - 9, cy - 3, 3, 3, '#ffffff');
      px(ctx, cx - 3, cy + 6, 6, 3, '#55ffff'); px(ctx, cx + 6, cy - 9, 3, 9, '#ffff55'); px(ctx, cx + 3, cy - 9, 9, 3, '#ffff55');
      return;
    }
    ctx.save(); ctx.translate(cx, cy);
    ctx.fillStyle = '#4a3020'; rr(ctx, -19, -15, 38, 30, 4); ctx.fill(); ctx.fillStyle = '#1a120c'; rr(ctx, -16, -12, 32, 24, 3); ctx.fill();
    ctx.strokeStyle = '#ffb347'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(-12, 8); ctx.quadraticCurveTo(-8, -4, -3, 2); ctx.stroke();                 // прыжок
    var p = (t * 1.5) % 1; ctx.fillStyle = 'rgba(190,230,255,' + (1 - p).toFixed(2) + ')';
    ctx.beginPath(); ctx.arc(-3, 5 + p * 5, 2 + p * 2, 0, TAU); ctx.fill();                                 // выдох вниз
    ctx.beginPath(); ctx.moveTo(-3, 2); ctx.quadraticCurveTo(2, -14, 9, -8); ctx.stroke();                   // выше
    ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.moveTo(9, -11); ctx.lineTo(13, -6); ctx.lineTo(7, -5); ctx.fill();
    ctx.restore();
  }
  // ---------- Выдох мехов ----------
  function gust(ctx, q, sx, sy, isRetro) {
    var k = q.t / 0.45, n = 5, i;
    for (i = 0; i < n; i++) {
      var f = Math.min(1, k * 1.6) * (i + 1) / n, d = q.reach * f + 0.5;
      var x = q.dir === 'down' ? q.x + Math.sin(i * 2.3) * 0.3 : q.x + q.dir * d, y = q.dir === 'down' ? q.y + 0.6 + d * 0.8 : q.y + Math.sin(i * 1.7 + q.t * 9) * 0.25;
      var a = (1 - k) * (0.4 + 0.6 * (1 - i / n)), r = 3 + f * 7;
      if (isRetro) { if (a > 0.25) px(ctx, sx(x) - r / 2, sy(y) - 2, r, 3, i % 2 ? '#55ffff' : '#ffffff'); continue; }
      ctx.strokeStyle = 'rgba(220,240,255,' + a.toFixed(2) + ')'; ctx.lineWidth = 2;
      ctx.beginPath();
      if (q.dir === 'down') ctx.arc(sx(x), sy(y), r, Math.PI * 0.15, Math.PI * 0.85);
      else if (q.dir > 0) ctx.arc(sx(x), sy(y), r, -Math.PI * 0.35, Math.PI * 0.35);
      else ctx.arc(sx(x), sy(y), r, Math.PI * 0.65, Math.PI * 1.35);
      ctx.stroke();
    }
  }

  // ---------- Герой: подмастерье-удалец (медные вихры под кожаным ремешком, горчичная рубаха, кузнечные мехи за спиной) ----------
  function hero(ctx, X, Y, H, t, o) {   // X — центр, Y — подошвы (px)
    o = o || {};
    var f = H.face || 1, isRetro = o.retro, air = !H.ground, walk = H.ground && Math.abs(H.vx) > 0.1, ph = H.walkT * 2.2;
    var squeeze = o.puff != null ? Math.max(0, 1 - o.puff / 0.2) : 0;   // мехи сжаты сразу после выдоха
    if (o.blink && Math.floor(t * 12) % 2) return;
    ctx.save(); ctx.translate(X, Y); ctx.scale(f, 1);
    var leg = walk ? Math.sin(ph * Math.PI) * 5 : air ? 3 : 0;
    if (isRetro) {
      px(ctx, -15, -27 + squeeze * 3, 9, 15 - squeeze * 6, '#aa5500'); px(ctx, -12, -24 + squeeze * 3, 3, 9 - squeeze * 6, '#552a00');
      px(ctx, -6, -30, 12, 3, '#ffff55');   // носик мехов через плечо
      px(ctx, -6 + leg * 0.6, -9, 6, 9, '#555555'); px(ctx, 0 - leg * 0.6, -9, 6, 9, '#555555');
      px(ctx, -6 + leg * 0.6, -3, 6, 3, '#000000'); px(ctx, 0 - leg * 0.6, -3, 6, 3, '#000000');
      px(ctx, -6, -24, 12, 15, '#ffff55'); px(ctx, -6, -15, 12, 3, '#552a00');
      px(ctx, 3, -21 + (air ? -3 : 0), 6, 9, '#ffaa77');
      px(ctx, -6, -33, 12, 9, '#ffaa77'); px(ctx, -6, -39, 12, 3, '#aa5500'); px(ctx, -6, -42, 3, 3, '#aa5500'); px(ctx, 0, -42, 3, 3, '#aa5500'); px(ctx, 3, -39, 3, 3, '#aa5500'); px(ctx, -9, -36, 3, 6, '#aa5500'); px(ctx, -6, -36, 12, 3, '#552a00');
      px(ctx, 3, -30, 3, 3, '#000');
      ctx.restore(); return;
    }
    // мехи за спиной: два деревянных щита и кожаная гармошка, латунный носик через плечо
    ctx.save(); ctx.translate(-10, -20);
    var bw = 9 - squeeze * 3;
    ctx.fillStyle = '#7a4a24'; rr(ctx, -bw / 2 - 2, -9, 4, 18, 2); ctx.fill(); rr(ctx, bw / 2 - 2, -9, 4, 18, 2); ctx.fill();
    ctx.fillStyle = '#3e2414'; ctx.beginPath(); ctx.moveTo(-bw / 2, -8); ctx.lineTo(bw / 2, -8); ctx.lineTo(bw / 2, 8); ctx.lineTo(-bw / 2, 8); ctx.fill();
    ctx.strokeStyle = '#5c3a22'; ctx.lineWidth = 1; for (var z = -6; z <= 6; z += 3) { ctx.beginPath(); ctx.moveTo(-bw / 2, z); ctx.lineTo(bw / 2, z + 1.5); ctx.stroke(); }
    ctx.restore();
    ctx.strokeStyle = '#c99a4a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-9, -29); ctx.quadraticCurveTo(-2, -33, 6, -27); ctx.stroke();
    ctx.fillStyle = '#e8c070'; ctx.beginPath(); ctx.arc(7, -27, 2, 0, TAU); ctx.fill();
    // ноги и сапоги
    ctx.fillStyle = '#4a3a30'; rr(ctx, -6 + leg * 0.7, -12, 5, 10, 2); ctx.fill(); rr(ctx, 1 - leg * 0.7, -12, 5, 10, 2); ctx.fill();
    ctx.fillStyle = '#1e1612'; rr(ctx, -7 + leg * 0.7, -4, 7, 4, 2); ctx.fill(); rr(ctx, 0 - leg * 0.7, -4, 7, 4, 2); ctx.fill();
    // тело: горчичная рубаха, широкий пояс
    var gs = ctx.createLinearGradient(0, -26, 0, -11); gs.addColorStop(0, '#e0b040'); gs.addColorStop(1, '#a87a1e');
    ctx.fillStyle = gs; rr(ctx, -7, -26, 14, 15, 4); ctx.fill();
    ctx.fillStyle = '#3a2416'; ctx.fillRect(-7, -16, 14, 3); ctx.fillStyle = '#c99a4a'; ctx.fillRect(1, -16, 3, 3);
    ctx.strokeStyle = '#5c3a22'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-6, -25); ctx.lineTo(4, -14); ctx.stroke();   // ремень мехов
    // рука
    ctx.fillStyle = '#f2b48a'; rr(ctx, 3, -22 + (air ? -4 : 0), 4, 9, 2); ctx.fill();
    // голова, медные вихры, кожаный ремешок
    ctx.fillStyle = '#f2b48a'; rr(ctx, -6, -36, 12, 11, 4); ctx.fill();
    ctx.fillStyle = '#c4581e'; ctx.beginPath(); ctx.moveTo(-7, -33); ctx.lineTo(-8, -40); ctx.lineTo(-4, -38); ctx.lineTo(-2, -43); ctx.lineTo(1, -39); ctx.lineTo(4, -42); ctx.lineTo(5, -38); ctx.lineTo(8, -37); ctx.lineTo(6, -34); ctx.lineTo(-7, -33); ctx.fill();
    ctx.fillStyle = '#e07a34'; ctx.fillRect(-1, -41, 2, 3);
    ctx.fillStyle = '#4a2c18'; ctx.fillRect(-7, -35, 14, 2.5);
    ctx.fillStyle = '#222'; ctx.fillRect(2, -31, 2, 2.5);
    ctx.fillStyle = '#c4581e'; ctx.fillRect(-6, -30, 2, 4);
    ctx.restore();
  }

  // ---------- Обитатели ----------
  function enemyBase(ctx, e, X, Y, t, isRetro) {   // X,Y — центр (у ходока — подошвы)
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

  function enemy(ctx, e, X, Y, t, isRetro) {
    var st = e.stun > 0 || e.fall;
    if (st) ctx.globalAlpha = 0.75;
    enemyBase(ctx, e, X, Y + (e.fall ? 0 : 0), st ? 0 : t, isRetro);
    ctx.globalAlpha = 1;
    if (e.stun > 0) {   // оглушён: кружат искорки
      var cy = e.k === 'w' ? Y - 26 : Y - 16;
      for (var i = 0; i < 3; i++) { var a = t * 6 + i * TAU / 3, x = X + Math.cos(a) * 9, y = cy + Math.sin(a) * 3;
        if (isRetro) px(ctx, x - 1, y - 1, 3, 3, '#ffff55'); else { ctx.fillStyle = '#fff1a0'; ctx.beginPath(); ctx.arc(x, y, 1.8, 0, TAU); ctx.fill(); } }
    }
  }

  // ---------- HUD ----------
  function hud(g, ctx, S, P, isRetro) {
    var W = g.W;
    ctx.fillStyle = P.hud; ctx.fillRect(0, 0, W, HUD);
    ctx.fillStyle = P.hudLine; ctx.fillRect(0, HUD - (isRetro ? 3 : 1), W, isRetro ? 3 : 1);
    var f = isRetro ? '"Courier New", monospace' : 'Inter, system-ui, sans-serif';
    function tx(s, x, y, o) { o = o || {}; ctx.fillStyle = o.color || P.ink; ctx.font = (o.weight || 800) + ' ' + (o.size || 14) + 'px ' + f; ctx.textAlign = o.align || 'left'; ctx.textBaseline = 'middle'; ctx.fillText(isRetro ? String(s).toUpperCase() : s, x, y, o.max); }
    tx(g.t('score'), 12, 13, { size: 10, color: P.muted, weight: 700, max: 86 }); tx(String(S.score).padStart(6, '0'), 12, 28, { size: 16, color: P.accent });
    tx(g.t('level'), 104, 13, { size: 10, color: P.muted, weight: 700, max: 70 }); tx(String(S.level) + '/10', 104, 28, { size: 16 });
    // горны цеха: разожжённые и остывшие
    tx(g.t('furnL'), 180, 13, { size: 10, color: P.muted, weight: 700, max: 200 });
    var LV = S.LV;
    LV.furn.forEach(function (fu, i) {
      var x = 186 + i * 22, h = S.heat[fu.id], lit = h >= L.HEAT_NEED;
      if (isRetro) { px(ctx, x - 6, 21, 12, 12, lit ? '#aa0000' : '#555555'); px(ctx, x - 3, 27, 6, 6, lit ? '#ffff55' : (h ? '#ff5555' : '#000000')); return; }
      ctx.fillStyle = lit ? '#b8553a' : '#4a3a32'; ctx.beginPath(); ctx.moveTo(x - 7, 34); ctx.lineTo(x - 7, 26); ctx.quadraticCurveTo(x - 7, 20, x, 20); ctx.quadraticCurveTo(x + 7, 20, x + 7, 26); ctx.lineTo(x + 7, 34); ctx.fill();
      ctx.fillStyle = lit ? '#ffd37a' : h ? '#ff7a2a' : '#1a1210'; rr(ctx, x - 4, 27, 8, 6, 2.5); ctx.fill();
      if (lit) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,170,60,.25)'; ctx.beginPath(); ctx.arc(x, 28, 10, 0, TAU); ctx.fill(); ctx.restore(); }
    });
    // жизни — головы с медными вихрами
    tx(g.t('lives'), W - 12, 13, { size: 10, color: P.muted, weight: 700, align: 'right', max: 100 });
    for (var l = 0; l < S.lives; l++) {
      var lx = W - 20 - l * 20;
      if (isRetro) { px(ctx, lx - 6, 18, 3, 6, '#aa5500'); px(ctx, lx, 18, 3, 6, '#aa5500'); px(ctx, lx - 6, 21, 12, 3, '#aa5500'); px(ctx, lx - 6, 24, 12, 9, '#ffaa77'); }
      else { ctx.fillStyle = '#f2b48a'; rr(ctx, lx - 5, 23, 10, 10, 3.5); ctx.fill(); ctx.fillStyle = '#c4581e'; ctx.beginPath(); ctx.moveTo(lx - 6, 25); ctx.lineTo(lx - 6, 19); ctx.lineTo(lx - 2, 21); ctx.lineTo(lx, 17); ctx.lineTo(lx + 2, 21); ctx.lineTo(lx + 6, 19); ctx.lineTo(lx + 6, 25); ctx.fill(); ctx.fillStyle = '#4a2c18'; ctx.fillRect(lx - 6, 23, 12, 2); }
    }
  }

  // ---------- Камера: левый верх вида (в клетках), герой по центру, в пределах карты ----------
  function camFor(S) {
    var LV = S.LV, H = S.hero;
    return { x: L.clamp(H.x - COLS / 2, 0, LV.w - COLS), y: L.clamp(H.y - 0.7 - ROWS / 2, 0, LV.h - ROWS) };
  }

  // ---------- Кадр ----------
  U.render = function (g, ctx, S, o) {
    o = o || {};
    var isRetro = retro(g), P = isRetro ? PR : PM, LV = S.LV, t = g.time, cam = o.cam || camFor(S);
    var ox = Math.round(cam.x * T), oy = Math.round(cam.y * T);
    var sx = function (x) { return x * T - ox; }, sy = function (y) { return HUD + y * T - oy; };
    var c0 = Math.floor(cam.x) - 1, c1 = Math.ceil(cam.x + COLS) + 1, r0 = Math.floor(cam.y) - 2, r1 = Math.ceil(cam.y + ROWS) + 1;
    var vis = function (x, y, m) { m = m || 1.5; return x > cam.x - m && x < cam.x + COLS + m && y > cam.y - m && y < cam.y + ROWS + m + 1; };
    ctx.fillStyle = isRetro ? '#000' : MOD[LV.theme % MOD.length][3]; ctx.fillRect(0, 0, g.W, g.H);
    ctx.save(); ctx.beginPath(); ctx.rect(0, HUD, g.W, g.H - HUD); ctx.clip();
    // экраны, попавшие в вид
    for (var ry = 0; ry < LV.rh; ry++) for (var rx = 0; rx < LV.rw; rx++) {
      var bx0 = rx * COLS, by0 = ry * ROWS;
      if (bx0 + COLS <= cam.x || bx0 >= cam.x + COLS || by0 + ROWS <= cam.y || by0 >= cam.y + ROWS) continue;
      ctx.drawImage(roomLayer(LV, ry * LV.rw + rx, isRetro), sx(bx0), sy(by0));
    }
    var i, j, k = 0;
    // восходящий поток над продухами
    LV.vents.forEach(function (v, vi) {
      if (v.c < c0 || v.c > c1) return;
      var h = v.r - v.top;
      for (var q = 0; q < 7; q++) {
        var p = (t * 0.9 + q / 7 + vi * 0.37) % 1, y = v.r - p * h, x = v.c + 0.5 + Math.sin(q * 2.1 + t * 3) * 0.28;
        if (isRetro) { if ((q + Math.floor(t * 6)) % 2) px(ctx, sx(x) - 1, sy(y), 3, 6, '#55ffff'); }
        else { ctx.fillStyle = 'rgba(200,235,255,' + (0.28 * (1 - p)).toFixed(2) + ')'; ctx.fillRect(sx(x) - 1, sy(y), 2, 9); }
      }
    });
    for (j = r0; j < r1; j++) for (i = c0; i < c1; i++) { var ch = L.tile(LV, i, j); if (L.HAZ[ch]) hazard(ctx, ch, sx(i), sy(j), t, isRetro, k++); }
    LV.shut.forEach(function (s) {
      if (!vis(s.c, s.r)) return;
      var lift = s.open ? (s.openAt != null ? Math.min(1, (S.time - s.openAt) / 0.6) : 1) : 0;
      if (lift < 1) shutter(ctx, sx(s.c), sy(s.r), lift, isRetro);
    });
    LV.signs.forEach(function (s) { if (vis(s.c, s.r)) sign(ctx, sx(s.c + 0.5), sy(s.r + 0.5), t, isRetro); });
    LV.vanes.forEach(function (v) { if (vis(v.c, v.r)) vane(ctx, sx(v.c + 0.5), sy(v.r + 0.5), S.spun[v.id] != null && S.spun[v.id] !== false ? S.spun[v.id] : null, S.time, isRetro); });
    LV.furn.forEach(function (f, fi) { if (vis(f.c, f.r, 3)) furnace(ctx, sx(f.c), sy(f.r), S.heat[f.id], t, isRetro, fi); });
    LV.items.forEach(function (it) { if (S.got[it.id] || !vis(it.c, it.r)) return; item(ctx, it.k, sx(it.c + 0.5), sy(it.r + 0.5), t, isRetro); });
    S.enemies.forEach(function (e) { if (e.alive && vis(e.x, e.y)) enemy(ctx, e, sx(e.x), sy(e.y), t + e.id, isRetro); });
    S.eshots.forEach(function (b) {
      if (isRetro) { px(ctx, sx(b.x) - 4, sy(b.y) - 4, 9, 9, '#ff5555'); px(ctx, sx(b.x) - 1, sy(b.y) - 1, 3, 3, '#ffff55'); return; }
      ctx.save(); ctx.shadowColor = '#ff7a2a'; ctx.shadowBlur = 10; ctx.fillStyle = '#ffb05a'; ctx.beginPath(); ctx.arc(sx(b.x), sy(b.y), 4, 0, TAU); ctx.fill(); ctx.restore();
    });
    var last = S.gusts.length ? S.gusts[S.gusts.length - 1] : null;
    if (S.phase !== 'dead') {
      var H = S.hero;
      if (!isRetro && H.ground) { ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(sx(H.x), sy(Math.ceil(H.y - 0.01)), 9, 2.5, 0, 0, TAU); ctx.fill(); }
      hero(ctx, sx(H.x), sy(H.y), H, t, { retro: isRetro, blink: S.inv > 0, puff: last ? last.t : null });
      // подсказка у остывшего горна (первые уровни): «дунь!» — значок кнопки выдоха
      if (o.prompt) {
        var bx = sx(H.x) + H.face * 22, by = sy(H.y) - 52, a = 0.75 + 0.25 * Math.sin(t * 6);
        ctx.globalAlpha = a;
        if (isRetro) { px(ctx, bx - 15, by - 12, 30, 21, '#ffffff'); px(ctx, bx - 12, by - 9, 24, 15, '#000000'); }
        else { ctx.fillStyle = 'rgba(16,12,10,.85)'; rr(ctx, bx - 16, by - 13, 32, 24, 8); ctx.fill(); ctx.strokeStyle = P.accent; ctx.lineWidth = 1.5; rr(ctx, bx - 16, by - 13, 32, 24, 8); ctx.stroke(); }
        ctx.fillStyle = P.accent; ctx.font = '900 13px ' + (isRetro ? '"Courier New", monospace' : 'Inter, system-ui, sans-serif'); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(o.prompt, bx, by - 1);
        ctx.globalAlpha = 1;
      }
    }
    S.gusts.forEach(function (q) { gust(ctx, q, sx, sy, isRetro); });
    if (o.fx) o.fx(ctx, sx, sy);
    ctx.restore();
    // всплывающие подписи
    (o.toasts || []).forEach(function (q) {
      var a = Math.min(1, q.t / 0.4), yy = sy(q.y) - (q.life - q.t) * 18;
      ctx.globalAlpha = a; ctx.font = (q.big ? 900 : 800) + ' ' + (q.big ? 16 : 12) + 'px ' + (isRetro ? '"Courier New", monospace' : 'Inter, system-ui, sans-serif');
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      var s = isRetro ? String(q.text).toUpperCase() : q.text, xx = Math.max(90, Math.min(g.W - 90, sx(q.x)));
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillText(s, xx + 1, yy + 1, g.W - 20); ctx.fillStyle = q.color || P.accent; ctx.fillText(s, xx, yy, g.W - 20); ctx.globalAlpha = 1;
    });
    // баннер уровня / прохождения
    if (o.banner) {
      var bw = 420, bh = 70, bxx = (g.W - bw) / 2, byy = HUD + 100;
      ctx.globalAlpha = Math.min(1, o.banner.a);
      if (isRetro) { ctx.fillStyle = '#000'; ctx.fillRect(bxx, byy, bw, bh); ctx.fillStyle = P.hudLine; ctx.fillRect(bxx, byy, bw, 3); ctx.fillRect(bxx, byy + bh - 3, bw, 3); ctx.fillRect(bxx, byy, 3, bh); ctx.fillRect(bxx + bw - 3, byy, 3, bh); }
      else { ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 20; ctx.fillStyle = 'rgba(16,12,10,.88)'; rr(ctx, bxx, byy, bw, bh, 14); ctx.fill(); ctx.restore(); ctx.strokeStyle = 'rgba(255,179,71,.5)'; ctx.lineWidth = 1.5; rr(ctx, bxx + 0.75, byy + 0.75, bw - 1.5, bh - 1.5, 14); ctx.stroke(); }
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '900 22px ' + (isRetro ? '"Courier New", monospace' : 'Inter, system-ui, sans-serif'); ctx.fillStyle = P.accent;
      ctx.fillText(isRetro ? o.banner.title.toUpperCase() : o.banner.title, g.W / 2, byy + 26, bw - 24);
      ctx.font = '700 12px ' + (isRetro ? '"Courier New", monospace' : 'Inter, system-ui, sans-serif'); ctx.fillStyle = P.muted;
      ctx.fillText(isRetro ? o.banner.sub.toUpperCase() : o.banner.sub, g.W / 2, byy + 50, bw - 24);
      ctx.globalAlpha = 1;
    }
    if (!isRetro) {
      var glow = S.lit / Math.max(1, LV.furn.length);   // чем больше горнов пылает, тем теплее и светлее цех
      var vg = ctx.createRadialGradient(g.W / 2, HUD + 180, 160, g.W / 2, HUD + 180, 420); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,' + (0.4 - 0.25 * glow).toFixed(2) + ')'); ctx.fillStyle = vg; ctx.fillRect(0, HUD, g.W, g.H - HUD);
      if (glow > 0) { ctx.fillStyle = 'rgba(255,140,40,' + (0.05 * glow).toFixed(3) + ')'; ctx.fillRect(0, HUD, g.W, g.H - HUD); }
    } else { ctx.fillStyle = 'rgba(0,0,0,.18)'; for (var y = HUD; y < g.H; y += 3) ctx.fillRect(0, y, g.W, 1); }
    hud(g, ctx, S, P, isRetro);
  };
  U.R = { hero: hero, furnace: furnace, vane: vane, enemy: enemy, item: item, PM: PM, PR: PR, MOD: MOD, HUD: HUD, rr: rr, px: px, roomLayer: roomLayer, camFor: camFor };
})(typeof window !== 'undefined' ? window : globalThis);
