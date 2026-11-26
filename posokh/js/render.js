/* ПОСОХ · отрисовка: экспедиции маршрута, картограф Ярослава, вехи, реперы, враги, хозяева, HUD, карта маршрута.
   Темы: modern (мягкие градиенты, своя палитра у каждой экспедиции) и retro (16-цветная палитра EGA-духа, «пиксельные»
   прямоугольники). Тема меняет только картинку, не логику. POSOKH.R — общие примитивы (героиня нужна и титулу). */
(function (global) {
  'use strict';
  var PS = global.POSOKH = global.POSOKH || {};
  var VW = 512, VH = 288, T = 16;
  // EGA-подобная палитра для retro
  var E = { k: '#000000', b: '#0000aa', g: '#00aa00', c: '#00aaaa', r: '#aa0000', m: '#aa00aa', n: '#aa5500', l: '#aaaaaa',
    d: '#555555', B: '#5555ff', G: '#55ff55', C: '#55ffff', R: '#ff5555', M: '#ff55ff', y: '#ffff55', w: '#ffffff' };
  // палитры экспедиций: [modern, retro]; soft — мягкая порода (крепь/торф/фирн/сваи/доски)
  var EXPAL = {
    mine:  { sky: ['#2b1f2f', '#140d16'], rsky: E.k, rock: '#5a4536', rockHi: '#8b6a4b', rockLo: '#3a2b22', vein: '#d8843f', rrock: E.n, rrockHi: E.y, rvein: E.R, plat: '#9a6b3c', rplat: E.n, liquid: '#7a3b1e', rliq: E.r, accent: '#e39a4f', soft: ['#8a5a2e', '#6b4322', '#b07a40'], rsoft: [E.n, E.k, E.y], softK: 'plank' },
    swamp: { sky: ['#4c6a5c', '#1a2c27'], rsky: E.k, rock: '#3f4a2c', rockHi: '#7d9a3e', rockLo: '#29311d', vein: '#5c6e33', rrock: E.g, rrockHi: E.G, rvein: E.d, plat: '#5fae5a', rplat: E.G, liquid: '#41583a', rliq: E.g, accent: '#b8e07a', soft: ['#5a3f2a', '#3e2b1d', '#7a5a3a'], rsoft: [E.n, E.k, E.d], softK: 'peat' },
    ridge: { sky: ['#8fbde6', '#e6f2ff'], rsky: E.b, rock: '#5f86ad', rockHi: '#f4f9ff', rockLo: '#476b90', vein: '#9cc0e0', rrock: E.c, rrockHi: E.w, rvein: E.C, plat: '#bfe3f7', rplat: E.C, liquid: '#3c79a8', rliq: E.B, accent: '#5fb5ff', soft: ['#e9eef4', '#c3d0de', '#ffffff'], rsoft: [E.w, E.l, E.C], softK: 'firn' },
    sunk:  { sky: ['#11334a', '#06141f'], rsky: E.k, rock: '#4a5a68', rockHi: '#8fa3b3', rockLo: '#2c3843', vein: '#b38b4a', rrock: E.d, rrockHi: E.c, rvein: E.n, plat: '#a8753a', rplat: E.n, liquid: '#1d6f8f', rliq: E.c, accent: '#7fe0ff', soft: ['#7a5a36', '#56401f', '#9a7a4a'], rsoft: [E.n, E.k, E.y], softK: 'pile' },
    tower: { sky: ['#ff9f6e', '#5b4a92'], rsky: E.m, rock: '#7b7f8e', rockHi: '#c9c6cf', rockLo: '#4f5260', vein: '#9a8f88', rrock: E.d, rrockHi: E.l, rvein: E.l, plat: '#b9874c', rplat: E.n, liquid: '#2d5c8a', rliq: E.b, accent: '#ffd36b', soft: ['#b98a55', '#8a6238', '#d9ab72'], rsoft: [E.n, E.k, E.y], softK: 'plank' }
  };
  // героиня — молодой картограф-геодезист: бирюзовая штормовка, рыжий сигнальный жилет со светлой полосой,
  // вязаная зелёная шапка с помпоном, тёмная коса, тубус с картами за спиной; веха — красно-белая полосатая. [modern, retro]
  var HC = {
    boot: ['#2d2a2a', E.d], pants: ['#4a4f5e', E.d], parka: ['#2f8f8a', E.c], parkaHi: ['#4fb7ae', E.C], vest: ['#f07a24', E.R], stripe: ['#e8eef0', E.w],
    skin: ['#e6b48c', E.y], hair: ['#4a2e1e', E.n], hat: ['#5f8a3a', E.g], hatHi: ['#86b852', E.G], pom: ['#f2e6c8', E.w], tube: ['#8a6a44', E.n], tubeCap: ['#cfc6b0', E.l],
    poleR: ['#d8342c', E.R], poleW: ['#f4f0e8', E.w]
  };
  function hc(k, rtr) { return HC[k][rtr ? 1 : 0]; }
  function R_(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); }
  // полосатая веха: (x,y) — начало, len — длина, vertical — стоймя
  function pole(ctx, x, y, len, vertical, rtr, dir) {
    dir = dir || 1;
    for (var i = 0; i < len; i += 4) {
      var c = (i / 4) % 2 ? hc('poleW', rtr) : hc('poleR', rtr), l = Math.min(4, len - i);
      if (vertical) R_(ctx, x, y + i, 2, l, c); else R_(ctx, dir > 0 ? x + i : x - i - l, y, l, 2, c);
    }
  }

  // ---------- героиня ----------
  // o: { face, run (фаза бега), throwT (0..1 — замах), air, blink, hold (веха в руке) }
  function hero(ctx, x, y, o, rtr, t) {
    var f = o.face || 1;
    ctx.save(); ctx.translate(Math.round(x), Math.round(y));
    if (f < 0) ctx.scale(-1, 1);
    if (o.blink && Math.floor(t * 16) % 2) ctx.globalAlpha = 0.35;
    if (!rtr) { ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(0, 0, 7, 2, 0, 0, 7); ctx.fill(); }
    // тубус с картами за спиной
    R_(ctx, -8, -21, 3, 11, hc('tube', rtr)); R_(ctx, -8, -22, 3, 2, hc('tubeCap', rtr));
    // ноги
    var ph = o.run || 0, l1 = 0, l2 = 0;
    if (!o.air && ph) { l1 = Math.round(Math.sin(ph) * 2); l2 = -l1; }
    R_(ctx, -4 + l1, -3, 3, 3, hc('boot', rtr)); R_(ctx, 1 + l2, -3, 3, 3, hc('boot', rtr));
    R_(ctx, -4, -9, 8, 6, hc('pants', rtr));
    if (o.air) { R_(ctx, -4, -5, 3, 2, hc('pants', rtr)); }
    // штормовка и жилет
    R_(ctx, -5, -18, 10, 10, hc('parka', rtr));
    R_(ctx, -4, -17, 8, 7, hc('vest', rtr));
    R_(ctx, -4, -13, 8, 1, hc('stripe', rtr));
    R_(ctx, -5, -18, 1, 10, hc('parkaHi', rtr));
    // голова, коса, шапка
    R_(ctx, -3, -24, 7, 6, hc('skin', rtr));
    R_(ctx, 3, -22, 1, 1, rtr ? E.k : '#2a1a12');
    R_(ctx, -4, -23, 2, 5, hc('hair', rtr)); R_(ctx, -6, -19, 2, 4, hc('hair', rtr)); R_(ctx, -7, -15, 2, 2, hc('hair', rtr));
    R_(ctx, -4, -27, 9, 4, hc('hat', rtr)); R_(ctx, -4, -24, 9, 1, hc('hatHi', rtr)); R_(ctx, -1, -29, 3, 2, hc('pom', rtr));
    // рука и веха
    var th = o.throwT || 0;
    if (th > 0) {
      // бросок: рука вытянута вперёд (вверх, если бросок вверх)
      if (o.up) { R_(ctx, 3, -22, 3, 2, hc('parka', rtr)); R_(ctx, 5, -25, 2, 3, hc('skin', rtr)); }
      else { R_(ctx, 3, -16, 6, 2, hc('parka', rtr)); R_(ctx, 8, -16, 2, 2, hc('skin', rtr)); }
    } else if (o.hold !== false) {
      // веха стоймя в руке
      pole(ctx, 6, -30, 30, true, rtr);
      R_(ctx, 3, -15, 4, 2, hc('parka', rtr)); R_(ctx, 5, -15, 2, 2, hc('skin', rtr));
    } else { R_(ctx, 3, -15, 3, 4, hc('parka', rtr)); }
    ctx.restore();
  }

  // ---------- клетки и фон ----------
  function pal(LV) { return EXPAL[LV.id] || EXPAL.mine; }
  function background(ctx, id, cam, rtr, t) {
    var P = EXPAL[id] || EXPAL.mine;
    if (rtr) { ctx.fillStyle = P.rsky; ctx.fillRect(0, 0, VW, VH); }
    else { var gr = ctx.createLinearGradient(0, 0, 0, VH); gr.addColorStop(0, P.sky[0]); gr.addColorStop(1, P.sky[1]); ctx.fillStyle = gr; ctx.fillRect(0, 0, VW, VH); }
    var px = -cam * 0.3, i, x;
    if (id === 'mine') {
      // крепь штолен и фонари
      for (i = -1; i < 8; i++) { x = ((i * 90 + px) % 720 + 720) % 720 - 90;
        R_(ctx, x, 40, 6, 210, rtr ? E.d : '#3a2a22'); R_(ctx, x + 50, 40, 6, 210, rtr ? E.d : '#3a2a22'); R_(ctx, x - 4, 40, 64, 6, rtr ? E.n : '#4a3628');
        var fl = 0.6 + 0.4 * Math.sin(t * 6 + i);
        if (rtr) R_(ctx, x + 25, 50, 6, 6, E.y); else { ctx.fillStyle = 'rgba(255,190,90,' + (0.18 * fl) + ')'; ctx.beginPath(); ctx.arc(x + 28, 54, 18, 0, 7); ctx.fill(); R_(ctx, x + 25, 50, 6, 7, '#ffcf73'); } }
    } else if (id === 'swamp') {
      for (i = -1; i < 7; i++) { x = ((i * 110 + px) % 770 + 770) % 770 - 110;
        ctx.fillStyle = rtr ? E.d : 'rgba(30,48,40,.8)';
        R_(ctx, x + 40, 90, 8, 160, ctx.fillStyle); R_(ctx, x + 20, 110, 24, 4, ctx.fillStyle); R_(ctx, x + 46, 130, 22, 4, ctx.fillStyle); R_(ctx, x + 18, 100, 4, 12, ctx.fillStyle); }
      if (!rtr) for (i = 0; i < 4; i++) { ctx.fillStyle = 'rgba(220,240,225,.07)'; ctx.fillRect(0, 150 + i * 26 + Math.sin(t * 0.5 + i) * 6, VW, 14); }
    } else if (id === 'ridge') {
      var mx = -cam * 0.15;
      ctx.fillStyle = rtr ? E.l : '#c4d9ee';
      for (i = -1; i < 6; i++) { x = ((i * 160 + mx) % 960 + 960) % 960 - 160; ctx.beginPath(); ctx.moveTo(x, 240); ctx.lineTo(x + 80, 90 + (i % 2) * 30); ctx.lineTo(x + 160, 240); ctx.fill(); }
      ctx.fillStyle = rtr ? E.w : '#ffffff';
      for (i = -1; i < 6; i++) { x = ((i * 160 + mx) % 960 + 960) % 960 - 160; var top = 90 + (i % 2) * 30; ctx.beginPath(); ctx.moveTo(x + 80, top); ctx.lineTo(x + 62, top + 26); ctx.lineTo(x + 98, top + 26); ctx.fill(); }
      for (i = 0; i < 30; i++) { var sx2 = (i * 53 + t * 20) % VW, sy = (i * 37 + t * 30) % VH; R_(ctx, sx2, sy, rtr ? 2 : 1.5, rtr ? 2 : 1.5, rtr ? E.w : 'rgba(255,255,255,.8)'); }
    } else if (id === 'tower') {
      if (!rtr) { ctx.fillStyle = 'rgba(255,240,200,.85)'; ctx.beginPath(); ctx.arc(400, 70, 22, 0, 7); ctx.fill(); }
      else R_(ctx, 384, 56, 28, 28, E.y);
      // маяк вдали
      var lx = 430 - cam * 0.08;
      R_(ctx, lx, 70, 22, 170, rtr ? E.w : '#efe6dc'); R_(ctx, lx, 110, 22, 14, rtr ? E.r : '#c8504a'); R_(ctx, lx, 160, 22, 14, rtr ? E.r : '#c8504a');
      R_(ctx, lx - 3, 58, 28, 12, rtr ? E.d : '#3d3a48'); R_(ctx, lx + 4, 61, 14, 7, rtr ? E.y : '#fff2a8');
      if (!rtr) { ctx.fillStyle = 'rgba(255,240,170,.18)'; ctx.beginPath(); ctx.moveTo(lx + 11, 64); var a = t * 0.8; ctx.lineTo(lx + 11 + Math.cos(a) * 300, 64 + Math.sin(a) * 40 - 20); ctx.lineTo(lx + 11 + Math.cos(a) * 300, 64 + Math.sin(a) * 40 + 20); ctx.fill(); }
      // море
      ctx.fillStyle = rtr ? E.b : '#3f5f9a'; ctx.fillRect(0, 236, VW, 52);
      for (i = 0; i < 16; i++) R_(ctx, ((i * 41 - cam * 0.4 + t * 12) % 560 + 560) % 560 - 40, 244 + (i % 3) * 12, 18, 2, rtr ? E.B : 'rgba(255,255,255,.25)');
    } else if (id === 'sunk') {
      for (i = -1; i < 8; i++) { x = ((i * 96 + px) % 768 + 768) % 768 - 96;
        R_(ctx, x, 30, 10, 220, rtr ? E.d : '#18394d'); R_(ctx, x + 30, 120, 26, 26, rtr ? E.b : '#1d4760');
        if (rtr) R_(ctx, x + 36, 126, 14, 14, E.c); else { ctx.fillStyle = '#2b6f8f'; ctx.beginPath(); ctx.arc(x + 43, 133, 8, 0, 7); ctx.fill(); } }
      if (!rtr) for (i = 0; i < 14; i++) { ctx.fillStyle = 'rgba(180,240,255,.25)'; ctx.beginPath(); ctx.arc((i * 71 + Math.sin(t + i) * 8) % VW, VH - ((t * 30 + i * 47) % VH), 2, 0, 7); ctx.fill(); }
    }
  }
  function softTile(ctx, x, y, tx, ty, P, rtr, up, LV) {
    var c = rtr ? P.rsoft : P.soft, k = P.softK;
    R_(ctx, x, y, T, T, c[0]);
    if (k === 'plank' || k === 'pile') {
      // доски / сваи: волокна и шляпки гвоздей
      if (k === 'plank') {   // длинные доски: шов редко, волокна вдоль
        R_(ctx, x, y + 7, T, 1, c[1]); R_(ctx, x, y + 15, T, 1, c[1]);
        if (((tx * 3 + ty * 5) % 7) === 0) R_(ctx, x + 9, y, 1, 7, c[1]); if (((tx * 5 + ty * 3) % 7) === 2) R_(ctx, x + 4, y + 8, 1, 7, c[1]);
        if (!rtr) { R_(ctx, x + ((tx * 7) % 10) + 2, y + 3, 4, 1, 'rgba(0,0,0,.12)'); R_(ctx, x + ((tx * 11 + 3) % 10) + 2, y + 11, 5, 1, 'rgba(0,0,0,.12)'); if (((tx + ty) % 3) === 0) R_(ctx, x + 12, y + 3, 1, 1, c[2]); }
      }
      else { R_(ctx, x + 3, y, 1, T, c[1]); R_(ctx, x + 11, y, 1, T, c[1]); if (((tx + ty) % 2) === 0) R_(ctx, x + 6, y + 6, 3, 2, c[2]); }
    } else if (k === 'peat') {
      for (var i = 0; i < 3; i++) R_(ctx, x + ((tx * 3 + i * 5 + ty * 7) % 13), y + 3 + i * 4, 3, 1, c[1]);
      if (!rtr && ((tx * 7 + ty * 3) % 4) === 0) R_(ctx, x + 6, y + 9, 2, 2, c[2]);
    } else {   // фирн: зерно и голубые прожилки
      if (((tx * 5 + ty * 3) % 3) === 0) R_(ctx, x + 3, y + 5, 2, 2, c[1]);
      if (((tx * 3 + ty * 7) % 4) === 1) R_(ctx, x + 10, y + 11, 3, 1, c[1]);
      if (!rtr) R_(ctx, x + 1, y + 1, 1, 1, c[2]);
    }
    if (!PS.logic.isSolid(up) && up !== '-' && up !== '|') R_(ctx, x, y, T, 2, rtr ? c[2] : 'rgba(255,255,255,.28)');
  }
  // стенной репер: латунная марка с крестом; снятый — с зелёной меткой
  function markTile(ctx, x, y, done, P, rtr, t) {
    R_(ctx, x, y, T, T, rtr ? P.rrock : P.rock);
    if (!rtr) R_(ctx, x, y + T - 3, T, 3, P.rockLo);
    var cx = x + 8, cy = y + 8;
    if (rtr) { R_(ctx, x + 3, y + 3, 10, 10, done ? E.G : E.y); R_(ctx, x + 7, y + 4, 2, 8, E.k); R_(ctx, x + 4, y + 7, 8, 2, E.k); }
    else {
      ctx.fillStyle = done ? '#7fd06a' : '#d9a62e'; ctx.beginPath(); ctx.arc(cx, cy, 6, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(40,28,10,.85)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(cx, cy, 6, 0, 7); ctx.moveTo(cx - 4, cy); ctx.lineTo(cx + 4, cy); ctx.moveTo(cx, cy - 4); ctx.lineTo(cx, cy + 4); ctx.stroke();
      if (!done) { ctx.strokeStyle = 'rgba(255,230,140,' + (0.35 + 0.35 * Math.sin(t * 4)) + ')'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, 8.5, 0, 7); ctx.stroke(); }
    }
  }
  function tiles(ctx, S, cam, rtr, t) {
    var LV = S.LV, W = S.W, P = pal(LV), L = PS.logic;
    var c0 = Math.max(0, Math.floor(cam / T)), c1 = Math.min(LV.w - 1, Math.floor((cam + VW) / T) + 1);
    var pegs = [];
    for (var ty = 0; ty < LV.h; ty++) for (var tx = c0; tx <= c1; tx++) {
      var ch = W.g[ty][tx]; if (ch === '.') continue;
      var x = tx * T - Math.round(cam), y = ty * T, up = ty > 0 ? W.g[ty - 1][tx] : '#';
      if (ch === '#' || ch === 'c') {
        R_(ctx, x, y, T, T, rtr ? P.rrock : P.rock);
        if (!rtr) { R_(ctx, x, y + T - 3, T, 3, P.rockLo); if (((tx * 7 + ty * 13) % 5) === 0) R_(ctx, x + 4, y + 6, 5, 2, P.vein); }
        else if (((tx + ty) % 3) === 0) R_(ctx, x + 2, y + 9, 4, 2, P.rvein);
        if (!L.isSolid(up) && up !== '-' && up !== '|') R_(ctx, x, y, T, rtr ? 3 : 4, rtr ? P.rrockHi : P.rockHi);
        if (ch === 'c') { var cc = rtr ? E.k : 'rgba(0,0,0,.55)'; R_(ctx, x + 3, y + 3, 2, 6, cc); R_(ctx, x + 5, y + 8, 5, 2, cc); R_(ctx, x + 10, y + 9, 2, 5, cc); R_(ctx, x + 8, y + 2, 2, 4, cc); }
      } else if (ch === '=') softTile(ctx, x, y, tx, ty, P, rtr, up, LV);
      else if (ch === 'Q' || ch === 'q') markTile(ctx, x, y, ch === 'q', P, rtr, t);
      else if (ch === '|') pegs.push([tx, ty, x, y]);
      else if (ch === '^') {
        R_(ctx, x, y + 8, T, 8, rtr ? P.rrock : P.rock);
        var sc = rtr ? E.w : (LV.id === 'ridge' ? '#e8f6ff' : '#d4d8de');
        ctx.fillStyle = sc;
        if (!rtr) { ctx.strokeStyle = LV.id === 'ridge' ? '#3d6a94' : 'rgba(0,0,0,.45)'; ctx.lineWidth = 1; }
        for (var k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(x + k * 5 + 1, y + 9); ctx.lineTo(x + k * 5 + 3.5, y + 1); ctx.lineTo(x + k * 5 + 6, y + 9); ctx.fill(); if (!rtr) ctx.stroke(); }
      } else if (ch === '-') {
        var pc = rtr ? P.rplat : P.plat;
        if (LV.id === 'swamp') { if (rtr) R_(ctx, x, y, T, 4, pc); else { ctx.fillStyle = pc; ctx.beginPath(); ctx.ellipse(x + 8, y + 3, 9, 3.5, 0, 0, 7); ctx.fill(); } }
        else { R_(ctx, x, y, T, 4, pc); R_(ctx, x, y + 4, T, 1, rtr ? E.k : 'rgba(0,0,0,.35)'); if (!rtr) R_(ctx, x + 7, y, 1, 4, 'rgba(0,0,0,.25)'); }
      } else if (ch === '~') {
        R_(ctx, x, y, T, T, rtr ? P.rliq : P.liquid);
        if (up !== '~') R_(ctx, x, y + 1 + Math.round(Math.sin(t * 3 + tx) * 1.2), T, 2, rtr ? E.w : 'rgba(255,255,255,.35)');
      } else if (ch === 'X' || ch === 'A' || ch === 'a') {
        if (ch === 'a') { if (ty === LV.h - 4) { R_(ctx, x + 2, y - 30, 3, 46, rtr ? E.d : 'rgba(255,255,255,.12)'); R_(ctx, x + 11, y - 30, 3, 46, rtr ? E.d : 'rgba(255,255,255,.12)'); } continue; }
        R_(ctx, x, y, T, T, rtr ? E.k : 'rgba(10,10,14,.35)');
        for (var b = 0; b < 3; b++) R_(ctx, x + 2 + b * 5, y, 2, T, rtr ? E.l : '#9aa3ad');
        R_(ctx, x, y + 6, T, 2, rtr ? E.d : '#6a727c');
      }
    }
    // воткнутые вехи: торчат из стены, сверху — опора; самая старая (уйдёт следующей) мигает, если вех уже три
    pegs.forEach(function (p) {
      var face = PS.logic.tileAt(S.W, p[0] + 1, p[1]) === '=' ? 1 : -1;
      var old = S.pegs.length >= PS.logic.K.PEGS && S.pegs[0] && S.pegs[0].tx === p[0] && S.pegs[0].ty === p[1];
      if (old && Math.floor(t * 6) % 2) ctx.globalAlpha = 0.55;
      var x0 = face > 0 ? p[2] + 16 : p[2];
      pole(ctx, x0 + (face > 0 ? 3 : -3), p[3] + 1, 17, false, rtr, -face);
      if (!rtr) R_(ctx, face > 0 ? p[2] + 1 : p[2], p[3] + 3, 14, 1, 'rgba(0,0,0,.3)');
      ctx.globalAlpha = 1;
    });
  }
  // ---------- предметы ----------
  // образец породы: камешек с кристаллом (крупный — друза)
  var GEMC = [['#6fd0ff', E.C], ['#9cf08a', E.G], ['#ffb86a', E.y]];
  function gem(ctx, x, y, big, k, rtr, t) {
    var bob = Math.round(Math.sin(t * 3 + k) * 1.5); y += bob;
    var rock = rtr ? E.l : '#8f8780', c = big ? (rtr ? E.M : '#c98aff') : GEMC[k % 3][rtr ? 1 : 0];
    if (rtr) {
      R_(ctx, x - 5, y, 10, 4, rock); R_(ctx, x - 2, y - 4, 3, 5, c); R_(ctx, x + 1, y - 2, 2, 3, c);
      if (big) { R_(ctx, x - 5, y - 3, 2, 4, c); R_(ctx, x + 3, y - 5, 2, 6, c); }
      return;
    }
    ctx.fillStyle = rock; ctx.beginPath(); ctx.ellipse(x, y + 2, big ? 7 : 5.5, 3, 0, 0, 7); ctx.fill();
    ctx.fillStyle = c;
    var spikes = big ? [[-4, 6], [-1, 9], [2, 7], [5, 5]] : [[-2, 6], [1, 4]];
    spikes.forEach(function (s) { ctx.beginPath(); ctx.moveTo(x + s[0] - 1.6, y + 1); ctx.lineTo(x + s[0], y + 1 - s[1]); ctx.lineTo(x + s[0] + 1.6, y + 1); ctx.fill(); });
    if (Math.sin(t * 4 + k * 1.7) > 0.93) { R_(ctx, x + 1, y - 9, 1, 5, '#fff'); R_(ctx, x - 1, y - 7, 5, 1, '#fff'); }
  }
  // термос с чаем
  function thermos(ctx, x, y, rtr) {
    R_(ctx, x - 3, y - 7, 6, 11, rtr ? E.R : '#c8463c'); R_(ctx, x - 3, y - 9, 6, 2, rtr ? E.l : '#cfd6dd'); R_(ctx, x - 2, y - 4, 4, 1, rtr ? E.w : '#f0e8dc');
    R_(ctx, x + 3, y - 5, 2, 5, rtr ? E.l : '#cfd6dd');
  }
  function itemIcon(ctx, x, y, what, rtr, s) {
    s = s || 1;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    if (what === 'life') { R_(ctx, -4, -4, 8, 8, rtr ? E.y : '#e0b048'); R_(ctx, -2, -6, 4, 12, rtr ? E.y : '#e0b048'); R_(ctx, -6, -2, 12, 4, rtr ? E.y : '#e0b048'); R_(ctx, -2, -2, 4, 4, rtr ? E.R : '#d94a4a'); }
    else if (what === 'mark') { if (rtr) { R_(ctx, -5, -5, 10, 10, E.y); R_(ctx, -1, -4, 2, 8, E.k); R_(ctx, -4, -1, 8, 2, E.k); } else { ctx.fillStyle = '#d9a62e'; ctx.beginPath(); ctx.arc(0, 0, 5, 0, 7); ctx.fill(); ctx.strokeStyle = '#3a2a10'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-3, 0); ctx.lineTo(3, 0); ctx.moveTo(0, -3); ctx.lineTo(0, 3); ctx.stroke(); } }
    else if (what === 'sign') {
      // тригопункт: деревянная тренога с флажком
      var wd = rtr ? E.n : '#a8783e';
      ctx.strokeStyle = wd; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(-7, 8); ctx.moveTo(0, -12); ctx.lineTo(7, 8); ctx.moveTo(0, -12); ctx.lineTo(0, 8); ctx.moveTo(-4, -1); ctx.lineTo(4, -1); ctx.stroke();
      R_(ctx, 0, -18, 1, 7, rtr ? E.w : '#f0e8dc'); R_(ctx, 1, -18, 6, 4, rtr ? E.R : '#e9643a');
    }
    else if (what === 'pole') { pole(ctx, -1, -8, 16, true, rtr); }
    ctx.restore();
  }
  function items(ctx, S, cam, rtr, t) {
    var LV = S.LV;
    LV.items.forEach(function (it, i) {
      if (S.got[it.id]) return;
      var x = it.tx * T + 8 - cam, y = it.ty * T + 8; if (x < -20 || x > VW + 20) return;
      if (it.k === 'gem' || it.k === 'big') gem(ctx, x, y, it.k === 'big', i, rtr, t);
      else if (it.k === 'pie') thermos(ctx, x, y + 4, rtr);
      else {
        if (!rtr) { ctx.fillStyle = 'rgba(255,240,180,' + (0.18 + 0.1 * Math.sin(t * 4)) + ')'; ctx.beginPath(); ctx.arc(x, y, 12, 0, 7); ctx.fill(); }
        itemIcon(ctx, x, y + Math.sin(t * 2.5) * 2, 'life', rtr);
      }
    });
    LV.flags.forEach(function (f, i) {
      var x = f.tx * T + 8 - cam, y = (f.ty + 1) * T; if (x < -20 || x > VW + 20) return;
      R_(ctx, x - 1, y - 26, 2, 26, rtr ? E.l : '#cfc6b8');
      var on = i <= S.cp, wv = Math.round(Math.sin(t * 5 + i) * 1);
      ctx.fillStyle = on ? (rtr ? E.R : '#e9643a') : (rtr ? E.d : '#7d7468');
      ctx.beginPath(); ctx.moveTo(x + 1, y - 26); ctx.lineTo(x + 13, y - 22 + wv); ctx.lineTo(x + 1, y - 17); ctx.fill();
    });
    if (S.sign && !S.signGot) {
      var kx = S.sign.x - cam, ky = S.sign.y;
      if (!rtr) { ctx.fillStyle = 'rgba(255,230,140,' + (0.25 + 0.15 * Math.sin(t * 5)) + ')'; ctx.beginPath(); ctx.arc(kx, ky, 18, 0, 7); ctx.fill(); }
      itemIcon(ctx, kx, ky, 'sign', rtr, 1.4);
    }
  }
  // летящие вехи и прицел
  function darts(ctx, S, cam, rtr) {
    S.darts.forEach(function (d) {
      var x = d.x - cam, y = d.y;
      ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.rotate(d.uy ? (d.ux > 0 ? -Math.PI / 4 : -3 * Math.PI / 4) : (d.ux > 0 ? 0 : Math.PI));
      pole(ctx, -14, -1, 16, false, rtr, 1); R_(ctx, 2, -1, 2, 2, rtr ? E.l : '#c9ced6');
      ctx.restore();
    });
  }
  function aim(ctx, S, cam, rtr, up, t) {
    var P = S.hero, L = PS.logic;
    if (S.phase !== 'play' || S.darts.length || !P.ground) return;
    var r = L.stakeRay(S.W, P, up), s = L.newStake(P, up);
    var x0 = s.x - cam, y0 = s.y, x1 = r.x - cam, y1 = r.y, n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / 8));
    var col = r.k === 'peg' ? (rtr ? E.G : '#8fe87a') : r.k === 'mark' ? (rtr ? E.y : '#ffd56a') : r.k === 'crack' ? (rtr ? E.C : '#9fe8ff') : (rtr ? E.d : 'rgba(255,255,255,.35)');
    var a = rtr ? 1 : 0.55 + 0.2 * Math.sin(t * 6);
    ctx.globalAlpha = a;
    for (var i = 1; i < n; i++) R_(ctx, x0 + (x1 - x0) * i / n - 1, y0 + (y1 - y0) * i / n - 1, 2, 2, col);
    if (r.k === 'peg') { var px = r.tx * T + 8 - cam, py = r.ty * T + 1; R_(ctx, px - 7, py, 14, 2, col); }
    else if (r.k === 'mark' || r.k === 'crack') { ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.strokeRect(r.tx * T - cam + 1, r.ty * T + 1, 14, 14); }
    else if (r.k === 'clink') { R_(ctx, x1 - 3, y1 - 1, 6, 2, col); R_(ctx, x1 - 1, y1 - 3, 2, 6, col); }
    ctx.globalAlpha = 1;
  }
  // ---------- враги ----------
  var ENC = { // [тело modern, акцент modern, тело retro, акцент retro]
    mine: ['#c06a2c', '#ffd08a', E.n, E.y], swamp: ['#5a8a3a', '#d6f08a', E.g, E.G], ridge: ['#e9f2fb', '#5fb5ff', E.w, E.C],
    tower: ['#e8e2d6', '#f0a040', E.w, E.y], sunk: ['#c0503a', '#ffd06a', E.r, E.y]
  };
  function enemy(ctx, e, cam, id, rtr, t) {
    var x = e.x - cam, y = e.y, C = ENC[id] || ENC.mine, body = C[rtr ? 2 : 0], ac = C[rtr ? 3 : 1], eye = rtr ? E.k : '#1a1420';
    if (x < -30 || x > VW + 30) return;
    var f = e.vx >= 0 ? 1 : -1;
    if (e.k === 'walker' && !rtr) {
      var st2 = Math.floor(t * 8) % 2;
      ctx.fillStyle = eye; for (var lg = -1; lg <= 1; lg++) ctx.fillRect(x + lg * 4 - 1 + (lg === 0 ? st2 : 0), y - 3, 2, 3);
      ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(x - f, y - 7, 7.5, 5.5, 0, Math.PI, 0); ctx.lineTo(x + 6.5 - f, y - 3); ctx.lineTo(x - 8.5 - f, y - 3); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.beginPath(); ctx.ellipse(x - 3 - f, y - 9, 3, 1.5, 0, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(x - f, y - 12, 1, 9);
      ctx.fillStyle = ac; ctx.beginPath(); ctx.arc(x + f * 7, y - 6, 3, 0, 7); ctx.fill();
      ctx.fillStyle = eye; ctx.fillRect(x + f * 8, y - 7, 1, 1); ctx.fillRect(x + f * 8, y - 12, 1, 3); ctx.fillRect(x + f * 9, y - 13, 2, 1);
    } else if (e.k === 'walker') {
      var st = Math.floor(t * 8) % 2;
      R_(ctx, x - 7, y - 9, 14, 7, body); R_(ctx, x - 5, y - 11, 10, 2, body); R_(ctx, x - 1, y - 11, 2, 9, rtr ? E.k : 'rgba(0,0,0,.3)');
      R_(ctx, x + f * 6 - 2, y - 8, 4, 4, ac); R_(ctx, x + f * 7 - 1, y - 7, 1, 1, eye);
      R_(ctx, x - 6, y - 2, 2, 2, eye); R_(ctx, x - 1 + st, y - 2, 2, 2, eye); R_(ctx, x + 4, y - 2, 2, 2, eye);
    } else if (e.k === 'hopper') {
      var sq = e.ground ? 1 : 0;
      R_(ctx, x - 7, y - 9 + sq, 14, 9 - sq, body); R_(ctx, x - 5, y - 12 + sq, 4, 4, body); R_(ctx, x + 1, y - 12 + sq, 4, 4, body);
      R_(ctx, x - 4, y - 11 + sq, 2, 2, ac); R_(ctx, x + 2, y - 11 + sq, 2, 2, ac); R_(ctx, x - 4, y - 4, 8, 2, ac);
    } else {
      var wf = Math.sin(t * 18) > 0 ? -4 : 2;
      R_(ctx, x - 4, y - 8, 8, 6, body); R_(ctx, x - 11, y - 8 + wf, 7, 3, ac); R_(ctx, x + 4, y - 8 + wf, 7, 3, ac);
      R_(ctx, x + f * 2 - 1, y - 7, 2, 2, eye);
    }
  }
  // страж и хозяева
  function big(ctx, b, cam, id, kind, rtr, t) {
    if (!b.alive) return;
    if (b.inv > 0 && Math.floor(t * 20) % 2) return;
    var x = Math.round(b.x - cam), y = Math.round(b.y), w = b.w, h = b.h, f = b.face || (b.vx >= 0 ? 1 : -1);
    var C = ENC[id] || ENC.mine, body = C[rtr ? 2 : 0], ac = C[rtr ? 3 : 1], dk = rtr ? E.k : '#1c1620';
    ctx.save(); ctx.translate(x, y); if (f < 0) ctx.scale(-1, 1);
    switch (kind) {
      case 'golem':
        R_(ctx, -w, -h, w * 2, h - 6, rtr ? E.d : '#6e625a'); R_(ctx, -w + 3, -h + 4, 8, 6, rtr ? E.n : '#c47a3a'); R_(ctx, 2, -h + 14, 7, 5, rtr ? E.n : '#c47a3a');
        R_(ctx, -w - 4, -h + 8, 6, 16, rtr ? E.l : '#8a7e74'); R_(ctx, w - 2, -h + 8, 6, 16, rtr ? E.l : '#8a7e74');
        R_(ctx, -w + 2, -6, 10, 6, rtr ? E.d : '#574c45'); R_(ctx, w - 12, -6, 10, 6, rtr ? E.d : '#574c45');
        R_(ctx, 6, -h + 5, 6, 3, rtr ? E.y : '#ffd36b'); break;
      case 'toad':
        R_(ctx, -w, -h + 6, w * 2, h - 6, rtr ? E.g : '#4f7f34'); R_(ctx, -w + 4, -h, 10, 8, rtr ? E.g : '#4f7f34'); R_(ctx, w - 14, -h, 10, 8, rtr ? E.g : '#4f7f34');
        R_(ctx, -w + 7, -h + 2, 4, 4, rtr ? E.y : '#ffe46b'); R_(ctx, w - 11, -h + 2, 4, 4, rtr ? E.y : '#ffe46b'); R_(ctx, -w + 8, -h + 3, 2, 2, dk); R_(ctx, w - 10, -h + 3, 2, 2, dk);
        R_(ctx, -w + 2, -h + 15, w * 2 - 4, 3, rtr ? E.r : '#a33a3a'); R_(ctx, -w + 4, -8, w * 2 - 8, 6, rtr ? E.G : '#a7cf6a'); break;
      case 'lynx':
        R_(ctx, -w, -h + 8, w * 2, h - 14, rtr ? E.w : '#eef3f7'); R_(ctx, w - 6, -h, 12, 12, rtr ? E.w : '#eef3f7');
        R_(ctx, w - 4, -h - 4, 3, 4, rtr ? E.l : '#cfd8e0'); R_(ctx, w + 2, -h - 4, 3, 4, rtr ? E.l : '#cfd8e0');
        R_(ctx, w + 1, -h + 4, 2, 2, rtr ? E.C : '#3b8fd8');
        for (var s = 0; s < 4; s++) R_(ctx, -w + 4 + s * 9, -h + 11 + (s % 2) * 4, 3, 3, rtr ? E.d : '#7d8a96');
        R_(ctx, -w - 10, -h + 8, 12, 4, rtr ? E.w : '#eef3f7');
        var lg = Math.floor(t * 10) % 2 * 2; R_(ctx, -w + 2, -6, 5, 6 - lg, rtr ? E.l : '#d5dde5'); R_(ctx, w - 8, -6, 5, 6 - (2 - lg), rtr ? E.l : '#d5dde5'); break;
      case 'petrel':
        var wf = b.st === 'dive' ? -2 : Math.sin(t * 12) * 6;
        R_(ctx, -10, -h + 6, 20, 12, rtr ? E.d : '#4a4f5c'); R_(ctx, -10, -h + 14, 20, 4, rtr ? E.w : '#e8ebf0');
        R_(ctx, 8, -h + 4, 8, 7, rtr ? E.d : '#4a4f5c'); R_(ctx, 16, -h + 7, 6, 2, rtr ? E.y : '#f0b030'); R_(ctx, 12, -h + 6, 2, 2, rtr ? E.w : '#fff');
        ctx.fillStyle = rtr ? E.l : '#6c7282'; ctx.beginPath(); ctx.moveTo(-6, -h + 8); ctx.lineTo(-w - 14, -h + 2 + wf); ctx.lineTo(-w - 4, -h + 14); ctx.fill();
        ctx.beginPath(); ctx.moveTo(4, -h + 8); ctx.lineTo(w + 8, -h - 2 - wf); ctx.lineTo(w, -h + 12); ctx.fill();
        R_(ctx, -16, -h + 10, 6, 3, rtr ? E.d : '#4a4f5c'); break;
      case 'crab':
        R_(ctx, -w, -h + 6, w * 2, h - 12, rtr ? E.r : '#c4523a'); R_(ctx, -w + 4, -h + 2, w * 2 - 8, 6, rtr ? E.R : '#e07050');
        R_(ctx, -4, -h - 6, 4, 8, rtr ? E.l : '#8f9aa5'); if (Math.sin(t * 6) > 0) R_(ctx, -6, -h - 12, 8, 5, rtr ? E.w : 'rgba(240,240,240,.7)');
        R_(ctx, w - 2, -h + 6, 10, 8, rtr ? E.R : '#e07050'); R_(ctx, w + 6, -h + 2, 4, 6, rtr ? E.R : '#e07050');
        R_(ctx, 6, -h + 2, 3, 3, rtr ? E.y : '#ffe46b'); R_(ctx, -9, -h + 2, 3, 3, rtr ? E.y : '#ffe46b');
        for (var l = 0; l < 3; l++) R_(ctx, -w + 2 + l * 13, -6, 3, 6, rtr ? E.r : '#9c3a28'); break;
      default: // страж
        R_(ctx, -w, -h + 4, w * 2, h - 8, body); R_(ctx, -w + 2, -h, w * 2 - 4, 6, body);
        R_(ctx, w - 6, -h + 6, 4, 4, ac); R_(ctx, w - 5, -h + 7, 2, 2, dk);
        R_(ctx, -w + 2, -4, 6, 4, dk); R_(ctx, w - 8, -4, 6, 4, dk);
        if (id === 'mine') { R_(ctx, w, -h + 12, 6, 4, rtr ? E.l : '#b8c0c8'); R_(ctx, w + 6, -h + 13, 4, 2, rtr ? E.l : '#b8c0c8'); }
        else if (id === 'ridge') for (var q = 0; q < 5; q++) R_(ctx, -w + 2 + q * 6, -h - 4, 2, 5, rtr ? E.C : '#bfe8ff');
        else if (id === 'tower') { R_(ctx, -2, -h - 10, 2, 10, rtr ? E.l : '#9aa3ad'); R_(ctx, -2, -h - 10, 10, 4, rtr ? E.y : '#e0a040'); }
        else if (id === 'sunk') { R_(ctx, w - 2, -h + 14, 8, 1, ac); R_(ctx, w - 2, -h + 17, 8, 1, ac); }
        else R_(ctx, -w - 4, -h + 2, 6, 3, rtr ? E.n : '#6b5030');
    }
    ctx.restore();
  }
  // ---------- HUD ----------
  function heartIcon(ctx, x, y, full, rtr) {
    var c = full ? (rtr ? E.R : '#ff5d6c') : (rtr ? E.d : 'rgba(255,255,255,.18)');
    R_(ctx, x, y + 1, 3, 3, c); R_(ctx, x + 4, y + 1, 3, 3, c); R_(ctx, x + 1, y + 3, 5, 3, c); R_(ctx, x + 2, y + 6, 3, 2, c);
  }
  function num(n) { var s = String(Math.max(0, Math.floor(n))); return s.replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
  function hud(g, ctx, S, prog, rtr) {
    var th = g.th(), K = PS.logic.K;
    R_(ctx, 0, 0, VW, 18, rtr ? E.k : 'rgba(8,8,14,.6)');
    for (var i = 0; i < K.HEARTS; i++) heartIcon(ctx, 6 + i * 10, 5, i < S.hearts, rtr);
    // мини-портрет (шапка) и жизни
    R_(ctx, 40, 3, 6, 3, hc('hat', rtr)); R_(ctx, 41, 6, 5, 4, hc('skin', rtr)); R_(ctx, 40, 10, 6, 2, hc('vest', rtr));
    g.text('×' + S.lives, 49, 13, { size: 10, color: th.ink, weight: 800 });
    g.text(num(S.score), 78, 13, { size: 10, color: rtr ? E.y : '#ffe08a', weight: 800 });
    // вехи: в связке / воткнуты (самая старая уйдёт следующей)
    var free = K.PEGS - S.pegs.length;
    for (var k = 0; k < K.PEGS; k++) { ctx.globalAlpha = k < free ? 1 : 0.3; pole(ctx, 170 + k * 6, 3, 12, true, rtr); }
    ctx.globalAlpha = 1;
    // реперы участка
    var got = 0; for (var m in S.marks) got++;
    for (var q = 0; q < S.LV.marks.length; q++) { ctx.globalAlpha = q < got ? 1 : 0.28; itemIcon(ctx, 420 + q * 14, 9, 'mark', rtr, 1); }
    ctx.globalAlpha = 1;
    g.text(g.t('x_' + S.id), 404, 13, { size: 9, align: 'right', color: th.muted, weight: 700 });
  }
  function bossBar(g, ctx, b, name, rtr) {
    if (!b || !b.alive || !b.awake) return;
    var th = g.th(), max = b.def ? b.def.hp : PS.logic.GUARD.hp;
    g.text(name, VW / 2, 34, { size: 11, align: 'center', color: th.ink, weight: 800 });
    R_(ctx, VW / 2 - 60, 38, 120, 6, rtr ? E.d : 'rgba(255,255,255,.15)');
    R_(ctx, VW / 2 - 60, 38, 120 * b.hp / max, 6, rtr ? E.R : '#ff5d6c');
  }

  // ---------- экспедиция целиком ----------
  PS.renderLevel = function (g, ctx, S, ui, prog) {
    var rtr = g.themeName === 'retro', t = g.time, cam = ui.cam, LV = S.LV;
    ctx.imageSmoothingEnabled = !rtr;
    background(ctx, LV.id, cam, rtr, t);
    tiles(ctx, S, cam, rtr, t);
    items(ctx, S, cam, rtr, t);
    S.enemies.forEach(function (e) { if (e.alive) enemy(ctx, e, cam, LV.id, rtr, t); });
    big(ctx, S.guard, cam, LV.id, 'guard', rtr, t);
    big(ctx, S.boss, cam, LV.id, LV.boss, rtr, t);
    S.shots.forEach(function (s) { var x = s.x - cam; if (rtr) R_(ctx, x - 3, s.y - 3, 6, 6, E.G); else { ctx.fillStyle = LV.id === 'sunk' ? 'rgba(235,245,255,.85)' : '#8fbf4a'; ctx.beginPath(); ctx.arc(x, s.y, 4, 0, 7); ctx.fill(); } });
    if (ui.aim !== false) aim(ctx, S, cam, rtr, !!ui.aimUp, t);
    darts(ctx, S, cam, rtr);
    var P = S.hero;
    if (S.phase !== 'dead' || Math.floor(t * 10) % 2) {
      if (!rtr) { ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.85)'; ctx.shadowBlur = 3; }
      hero(ctx, P.x - cam, P.y, { face: P.face, run: P.ground ? ui.runPh : 0, throwT: ui.throwT || 0, up: ui.throwUp, hold: !S.darts.length && S.cool <= 0.05, air: !P.ground, blink: P.inv > 0 && S.phase === 'play' }, rtr, t);
      if (!rtr) ctx.restore();
    }
    ui.fx.draw(ctx, cam, rtr);
    hud(g, ctx, S, prog, rtr);
    if (S.guard.alive && S.guard.awake) bossBar(g, ctx, S.guard, g.t('g_' + LV.guard), rtr);
    if (S.boss.alive && S.boss.awake) bossBar(g, ctx, S.boss, g.t('b_' + LV.boss), rtr);
    ui.toasts.forEach(function (q) { var a = Math.min(1, q.t / q.life * 2); ctx.globalAlpha = a; g.text(q.text, q.x - cam, q.y - (1 - q.t / q.life) * 18, { size: q.big ? 12 : 10, align: 'center', color: q.color, weight: 800 }); ctx.globalAlpha = 1; });
    var th = g.th();
    if (ui.msg) { ctx.globalAlpha = Math.min(1, ui.msg.a * 2); g.text(ui.msg.text, VW / 2, VH - 14, { size: 12, align: 'center', color: ui.msg.color || th.ink, weight: 800, maxWidth: VW - 20 }); ctx.globalAlpha = 1; }
    if (ui.banner) {
      var bn = ui.banner, al = Math.min(1, bn.a * 2, (bn.dur - bn.a) * 4 + 0.2), lines = bn.lines || [];
      ctx.globalAlpha = al;
      var bh = 50 + lines.length * 15;
      R_(ctx, 40, 70, VW - 80, bh, rtr ? E.k : 'rgba(10,10,18,.78)');
      if (rtr) { R_(ctx, 40, 70, VW - 80, 2, bn.color || th.accent); R_(ctx, 40, 68 + bh, VW - 80, 2, bn.color || th.accent); }
      g.text(bn.title, VW / 2, 94, { size: 18, align: 'center', color: bn.color || th.accent, weight: 900, maxWidth: VW - 96 });
      if (bn.sub) g.text(bn.sub, VW / 2, 111, { size: 11, align: 'center', color: th.muted, weight: 700, maxWidth: VW - 96 });
      lines.forEach(function (ln, i) { g.text(ln, VW / 2, 128 + i * 15, { size: 11, align: 'center', color: th.ink, weight: 700, maxWidth: VW - 96 }); });
      ctx.globalAlpha = 1;
    }
  };

  // ---------- карта маршрута ----------
  // участки — станции на бумажной карте с горизонталями, пунктир маршрута слева направо, в конце — обсерватория
  var MAPXY = { mine: [70, 196], swamp: [150, 120], ridge: [240, 170], sunk: [322, 98], tower: [398, 160], obs: [462, 78] };
  var XCOL = { mine: ['#c0602a', E.n], swamp: ['#4f8a3a', E.g], ridge: ['#3b7fc4', E.B], sunk: ['#2b7f8f', E.c], tower: ['#c8902a', E.r] };
  PS.renderMap = function (g, ctx, M, prog) {
    var rtr = g.themeName === 'retro', t = g.time, th = g.th(), SV = PS.save, ids = PS.levels.ids;
    ctx.imageSmoothingEnabled = !rtr;
    // бумага
    if (rtr) { ctx.fillStyle = E.k; ctx.fillRect(0, 0, VW, VH); R_(ctx, 8, 26, VW - 16, 214, E.n); R_(ctx, 10, 28, VW - 20, 210, E.k); }
    else {
      ctx.fillStyle = '#1b1712'; ctx.fillRect(0, 0, VW, VH);
      var gr = ctx.createLinearGradient(0, 26, 0, 240); gr.addColorStop(0, '#efe2c4'); gr.addColorStop(1, '#dcc89e');
      ctx.fillStyle = gr; ctx.fillRect(8, 26, VW - 16, 214);
      ctx.strokeStyle = 'rgba(120,90,50,.5)'; ctx.lineWidth = 2; ctx.strokeRect(9, 27, VW - 18, 212);
    }
    // горизонтали
    ctx.lineWidth = 1;
    for (var i = 0; i < 7; i++) {
      ctx.strokeStyle = rtr ? (i % 2 ? E.d : E.n) : 'rgba(150,110,60,' + (0.18 + (i % 3) * 0.06) + ')';
      ctx.beginPath();
      for (var x = 12; x <= VW - 12; x += 8) { var y = 60 + i * 26 + Math.sin(x * 0.02 + i * 1.3) * 12 + Math.sin(x * 0.051 + i) * 5; if (x === 12) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
      ctx.stroke();
    }
    // маршрут
    var path = ids.concat(['obs']);
    for (var k = 0; k < path.length - 1; k++) {
      var a = MAPXY[path[k]], b = MAPXY[path[k + 1]], done = !!prog.cleared[path[k]];
      var n = 12;
      for (var j = 0; j < n; j++) if (j % 2 === 0) { var px = a[0] + (b[0] - a[0]) * j / n, py = a[1] + (b[1] - a[1]) * j / n; R_(ctx, px - 1, py - 1, 3, 3, done ? (rtr ? E.R : '#c8463c') : (rtr ? E.d : 'rgba(90,70,40,.5)')); }
    }
    // станции
    path.forEach(function (id) {
      var p = MAPXY[id], sel = M.sel === id, open = id === 'obs' ? SV.allCleared(prog) : SV.isOpen(prog, id);
      ctx.globalAlpha = open ? 1 : 0.45;
      if (sel) { ctx.strokeStyle = rtr ? E.w : '#3a2a10'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p[0], p[1], 15 + Math.sin(t * 5), 0, 7); ctx.stroke(); }
      if (id === 'obs') {
        R_(ctx, p[0] - 10, p[1] - 4, 20, 10, rtr ? E.l : '#9a8f9e'); ctx.fillStyle = rtr ? E.w : '#cfc8d8'; ctx.beginPath(); ctx.arc(p[0], p[1] - 4, 10, Math.PI, 0); ctx.fill();
        R_(ctx, p[0] + 1, p[1] - 16, 8, 3, rtr ? E.y : '#d9a62e');
      } else {
        var c = XCOL[id][rtr ? 1 : 0];
        ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(p[0], p[1] - 10); ctx.lineTo(p[0] + 9, p[1] + 6); ctx.lineTo(p[0] - 9, p[1] + 6); ctx.fill();
        if (prog.cleared[id]) itemIcon(ctx, p[0] + 12, p[1] - 6, 'sign', rtr, 0.7);
        var mk = SV.markCount(prog, id);
        for (var q = 0; q < PS.levels.MARKS; q++) { ctx.globalAlpha = (open ? 1 : 0.45) * (q < mk ? 1 : 0.3); itemIcon(ctx, p[0] - 12 + q * 12, p[1] + 16, 'mark', rtr, 0.8); }
        ctx.globalAlpha = open ? 1 : 0.45;
        if (!open) { R_(ctx, p[0] - 3, p[1] - 3, 6, 5, rtr ? E.l : '#5a4a3a'); }
      }
      ctx.globalAlpha = 1;
    });
    // героиня у выбранной станции
    var hp = MAPXY[M.sel] || MAPXY.mine;
    hero(ctx, hp[0] - 22, hp[1] + 8, { face: 1, run: 0 }, rtr, t);
    // шапка и панель
    g.text(g.t('map'), VW / 2, 18, { size: 13, align: 'center', color: th.accent, weight: 900 });
    g.text(g.t('total') + ': ' + num(prog.score) + '   ♥×' + prog.lives + '   ' + g.t('marks') + ': ' + SV.markCount(prog) + '/' + ids.length * PS.levels.MARKS, VW - 18, 42, { size: 9, align: 'right', color: rtr ? E.y : '#5a3a14', weight: 800, maxWidth: VW - 40 });
    var id = M.sel, name = g.t('x_' + id), desc = g.t('xd_' + id), st;
    if (id === 'obs') st = SV.allCleared(prog) ? g.t('obsOpen') : g.t('obsLocked');
    else if (!SV.isOpen(prog, id)) st = g.t('locked');
    else st = prog.cleared[id] ? '✓ ' + g.t('cleared') + (SV.markCount(prog, id) < PS.levels.MARKS ? ' · ' + g.t('replay') : '') : g.t('notYet') + ' · ' + g.t('b_' + PS.levels.EXP.filter(function (e) { return e.id === id; })[0].boss);
    R_(ctx, 40, 244, VW - 80, 40, rtr ? E.k : 'rgba(8,8,16,.78)');
    g.text(name, VW / 2, 258, { size: 14, align: 'center', color: id === 'obs' ? (rtr ? E.y : '#ffd56a') : (rtr ? E.w : '#ffe6b0'), weight: 900, maxWidth: VW - 100 });
    g.text(desc + ' — ' + st, VW / 2, 271, { size: 9, align: 'center', color: th.ink, weight: 700, maxWidth: VW - 100 });
    g.text(g.t('mapHint'), VW / 2, 281, { size: 8, align: 'center', color: th.muted, weight: 700, maxWidth: VW - 100 });
    if (M.note && M.noteA > 0) g.text(M.note, VW / 2, 232, { size: 11, align: 'center', color: rtr ? E.y : '#7a2a10', weight: 800, maxWidth: VW - 40 });
  };

  // ---------- частицы ----------
  function FXs() { this.p = []; }
  FXs.prototype.add = function (x, y, o) { o = o || {}; for (var i = 0; i < (o.n || 8); i++) { var a = (o.a != null ? o.a : 0) + (o.spread != null ? (Math.random() - 0.5) * o.spread : Math.random() * Math.PI * 2), sp = (o.sp || 80) * (0.4 + Math.random() * 0.6); this.p.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: o.life || 0.5, life: o.life || 0.5, c: o.c || '#fff', r: o.r || 2, g: o.g == null ? 300 : o.g }); } if (this.p.length > 300) this.p.splice(0, this.p.length - 300); };
  FXs.prototype.step = function (dt) { this.p = this.p.filter(function (q) { q.t -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += q.g * dt; return q.t > 0; }); };
  FXs.prototype.draw = function (ctx, cam, rtr) { this.p.forEach(function (q) { ctx.globalAlpha = Math.min(1, q.t / q.life * 1.5); var s = rtr ? Math.max(2, Math.round(q.r)) : q.r; ctx.fillStyle = q.c; ctx.fillRect(Math.round(q.x - cam - s / 2), Math.round(q.y - s / 2), s, s); }); ctx.globalAlpha = 1; };
  FXs.prototype.clear = function () { this.p = []; };

  PS.R = { VW: VW, VH: VH, E: E, EXPAL: EXPAL, hero: hero, pole: pole, background: background, itemIcon: itemIcon, gem: gem, big: big, num: num, FX: new FXs(), MAPXY: MAPXY };
})(typeof window !== 'undefined' ? window : globalThis);
