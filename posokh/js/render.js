/* ПОСОХ · отрисовка: экспедиции, героиня, враги, хозяева, HUD, глобус-карта лагеря. Темы: modern (мягкие
   градиенты, своя палитра у каждой экспедиции) и retro (16-цветная палитра EGA-духа, «пиксельные» прямоугольники).
   Тема меняет только картинку, не логику. POSOKH.R — общие примитивы (героиня нужна и титулу). */
(function (global) {
  'use strict';
  var PS = global.POSOKH = global.POSOKH || {};
  var VW = 512, VH = 288, T = 16;
  // EGA-подобная палитра для retro
  var E = { k: '#000000', b: '#0000aa', g: '#00aa00', c: '#00aaaa', r: '#aa0000', m: '#aa00aa', n: '#aa5500', l: '#aaaaaa',
    d: '#555555', B: '#5555ff', G: '#55ff55', C: '#55ffff', R: '#ff5555', M: '#ff55ff', y: '#ffff55', w: '#ffffff' };
  // палитры экспедиций: [modern, retro]
  var EXPAL = {
    mine:  { sky: ['#2b1f2f', '#140d16'], rsky: E.k, rock: '#5a4536', rockHi: '#8b6a4b', rockLo: '#3a2b22', vein: '#d8843f', rrock: E.n, rrockHi: E.y, rvein: E.R, plat: '#9a6b3c', rplat: E.n, liquid: '#7a3b1e', rliq: E.r, accent: '#e39a4f' },
    swamp: { sky: ['#4c6a5c', '#1a2c27'], rsky: E.k, rock: '#3f4a2c', rockHi: '#7d9a3e', rockLo: '#29311d', vein: '#5c6e33', rrock: E.g, rrockHi: E.G, rvein: E.d, plat: '#5fae5a', rplat: E.G, liquid: '#41583a', rliq: E.g, accent: '#b8e07a' },
    ridge: { sky: ['#8fbde6', '#e6f2ff'], rsky: E.b, rock: '#5f86ad', rockHi: '#f4f9ff', rockLo: '#476b90', vein: '#9cc0e0', rrock: E.c, rrockHi: E.w, rvein: E.C, plat: '#bfe3f7', rplat: E.C, liquid: '#3c79a8', rliq: E.B, accent: '#5fb5ff' },
    tower: { sky: ['#ff9f6e', '#5b4a92'], rsky: E.m, rock: '#7b7f8e', rockHi: '#c9c6cf', rockLo: '#4f5260', vein: '#9a8f88', rrock: E.d, rrockHi: E.l, rvein: E.l, plat: '#b9874c', rplat: E.n, liquid: '#2d5c8a', rliq: E.b, accent: '#ffd36b' },
    sunk:  { sky: ['#11334a', '#06141f'], rsky: E.k, rock: '#4a5a68', rockHi: '#8fa3b3', rockLo: '#2c3843', vein: '#b38b4a', rrock: E.d, rrockHi: E.c, rvein: E.n, plat: '#a8753a', rplat: E.n, liquid: '#1d6f8f', rliq: E.c, accent: '#7fe0ff' }
  };
  // героиня: [modern, retro]
  var HC = {
    boot: ['#3b2a20', E.n], pants: ['#3e475c', E.b], jacket: ['#6b7a3a', E.g], jacketHi: ['#86964a', E.G], belt: ['#4a3a22', E.n],
    scarf: ['#d0602a', E.R], skin: ['#e8b98f', E.y], hair: ['#dfe3ea', E.w], hairLo: ['#aeb4be', E.l], goggle: ['#b87333', E.n], lens: ['#8fe1f2', E.C],
    staff: ['#8b5a2b', E.n], band: ['#a9b1bb', E.l], spring: ['#d2d8de', E.w], knob: ['#d9a62e', E.y]
  };
  function hc(k, rtr) { return HC[k][rtr ? 1 : 0]; }
  function R_(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); }

  // ---------- героиня ----------
  // o: { face, run (фаза бега), pogo, squash (0..1 сжатие пружины), swing (0..1), hurt, air }
  function hero(ctx, x, y, o, rtr, t) {
    var f = o.face || 1;
    ctx.save(); ctx.translate(Math.round(x), Math.round(y));
    if (f < 0) ctx.scale(-1, 1);
    if (o.blink && Math.floor(t * 16) % 2) ctx.globalAlpha = 0.35;
    if (!rtr) { ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(0, 0, 7, 2, 0, 0, 7); ctx.fill(); }
    // посох
    var sx = 6;
    if (o.pogo) {
      // стоит на посохе: пружина внизу, подножка-перекладина под сапогами
      var sq = o.squash || 0, sh = 7 - Math.round(sq * 4);
      for (var i = 0; i < 4; i++) R_(ctx, 2 + (i % 2 ? 0 : -2), -sh + Math.round(i * sh / 4), 5, 1, hc('spring', rtr));
      ctx.translate(0, -sh - 1);
    } else if (o.swing > 0) {
      // клюшка: посох проносится снизу вперёд
      var a = -1.9 + (1 - o.swing) * 2.6;
      ctx.save(); ctx.translate(3, -14); ctx.rotate(a);
      R_(ctx, -1, 0, 2, 22, hc('staff', rtr)); R_(ctx, -2, 18, 4, 4, hc('spring', rtr)); R_(ctx, -2, 8, 4, 1, hc('band', rtr));
      ctx.restore();
    } else {
      R_(ctx, sx, -26, 2, 25, hc('staff', rtr));
      R_(ctx, sx - 1, -27, 4, 3, hc('knob', rtr));
      R_(ctx, sx - 1, -17, 4, 1, hc('band', rtr)); R_(ctx, sx - 1, -8, 4, 1, hc('band', rtr));
      R_(ctx, sx - 1, -4, 4, 1, hc('spring', rtr)); R_(ctx, sx, -3, 3, 1, hc('spring', rtr)); R_(ctx, sx - 1, -2, 4, 1, hc('spring', rtr));
    }
    // ноги
    var ph = o.run || 0, l1 = 0, l2 = 0;
    if (!o.pogo && !o.air && ph) { l1 = Math.round(Math.sin(ph) * 2); l2 = -l1; }
    var crouch = o.pogo ? 2 : 0;
    R_(ctx, -4 + l1, -3, 3, 3, hc('boot', rtr)); R_(ctx, 1 + l2, -3, 3, 3, hc('boot', rtr));
    R_(ctx, -4, -9 + crouch, 8, 6 - crouch, hc('pants', rtr));
    ctx.translate(0, crouch);
    // куртка
    R_(ctx, -5, -18, 10, 9, hc('jacket', rtr));
    R_(ctx, -5, -18, 2, 9, hc('jacketHi', rtr));
    R_(ctx, -5, -11, 10, 1, hc('belt', rtr));
    R_(ctx, 1, -15, 3, 3, hc('jacketHi', rtr));
    // рука к посоху
    R_(ctx, 3, -16, 4, 2, hc('jacket', rtr)); R_(ctx, 6, -16, 2, 2, hc('skin', rtr));
    // шарф
    R_(ctx, -4, -19, 8, 2, hc('scarf', rtr));
    var wave = o.air || o.run ? Math.round(Math.sin(t * 14) * 1) : 0;
    R_(ctx, -7, -18 + wave, 3, 2, hc('scarf', rtr)); R_(ctx, -8, -16 + wave, 2, 2, hc('scarf', rtr));
    // голова
    R_(ctx, -3, -24, 7, 5, hc('skin', rtr));
    R_(ctx, 4, -22, 1, 1, rtr ? E.n : '#d39a72');
    // волосы и пучок
    R_(ctx, -3, -26, 7, 2, hc('hair', rtr)); R_(ctx, -4, -25, 2, 4, hc('hair', rtr));
    R_(ctx, -7, -28, 4, 4, hc('hair', rtr)); R_(ctx, -6, -25, 2, 1, hc('hairLo', rtr));
    // очки-гогглы: медный ремешок и линзы
    R_(ctx, -3, -24, 7, 1, hc('goggle', rtr));
    R_(ctx, 1, -25, 3, 3, hc('goggle', rtr)); R_(ctx, 2, -24, 1, 1, hc('lens', rtr));
    if (o.pogo) {
      ctx.translate(0, -crouch);
      R_(ctx, 3, -19, 2, 20, hc('staff', rtr)); R_(ctx, -5, -1, 12, 2, hc('band', rtr)); R_(ctx, 2, -10, 4, 1, hc('band', rtr));
      R_(ctx, 2, -22, 4, 3, hc('knob', rtr)); R_(ctx, 1, -16, 5, 2, hc('skin', rtr));
    }
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
  function tiles(ctx, S, cam, rtr, t) {
    var LV = S.LV, W = S.W, P = pal(LV), L = PS.logic;
    var c0 = Math.max(0, Math.floor(cam / T)), c1 = Math.min(LV.w - 1, Math.floor((cam + VW) / T) + 1);
    for (var ty = 0; ty < LV.h; ty++) for (var tx = c0; tx <= c1; tx++) {
      var ch = W.g[ty][tx]; if (ch === '.') continue;
      var x = tx * T - Math.round(cam), y = ty * T, up = ty > 0 ? W.g[ty - 1][tx] : '#';
      if (ch === '#' || ch === 'c') {
        R_(ctx, x, y, T, T, rtr ? P.rrock : P.rock);
        if (!rtr) { R_(ctx, x, y + T - 3, T, 3, P.rockLo); if (((tx * 7 + ty * 13) % 5) === 0) R_(ctx, x + 4, y + 6, 5, 2, P.vein); }
        else if (((tx + ty) % 3) === 0) R_(ctx, x + 2, y + 9, 4, 2, P.rvein);
        if (!L.isSolid(up) && up !== '-') R_(ctx, x, y, T, rtr ? 3 : 4, rtr ? P.rrockHi : P.rockHi);
        if (ch === 'c') { var cc = rtr ? E.k : 'rgba(0,0,0,.55)'; R_(ctx, x + 3, y + 3, 2, 6, cc); R_(ctx, x + 5, y + 8, 5, 2, cc); R_(ctx, x + 10, y + 9, 2, 5, cc); R_(ctx, x + 8, y + 2, 2, 4, cc); }
      } else if (ch === '^') {
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
      } else if (ch === 'D') {
        R_(ctx, x, y, T, T, rtr ? E.n : '#5d4128'); R_(ctx, x + 1, y + 1, T - 2, T - 2, rtr ? E.d : '#7a5a37');
        R_(ctx, x + 2, y + 7, T - 4, 2, rtr ? E.l : '#b0b6bd');
        if (W.g[ty + 1] && W.g[ty + 1][tx] !== 'D') { R_(ctx, x + 6, y + 4, 4, 5, rtr ? E.y : '#e8c25a'); R_(ctx, x + 7, y + 6, 2, 2, E.k); }
      } else if (ch === 'X' || ch === 'A' || ch === 'a') {
        if (ch === 'a') { if (ty === LV.h - 4) { R_(ctx, x + 2, y - 30, 3, 46, rtr ? E.d : 'rgba(255,255,255,.12)'); R_(ctx, x + 11, y - 30, 3, 46, rtr ? E.d : 'rgba(255,255,255,.12)'); } continue; }
        R_(ctx, x, y, T, T, rtr ? E.k : 'rgba(10,10,14,.35)');
        for (var b = 0; b < 3; b++) R_(ctx, x + 2 + b * 5, y, 2, T, rtr ? E.l : '#9aa3ad');
        R_(ctx, x, y + 6, T, 2, rtr ? E.d : '#6a727c');
      }
    }
  }
  // ---------- предметы ----------
  var GEMC = [['#ff5a6e', E.R], ['#57d98a', E.G], ['#5aa8ff', E.B]];
  function gem(ctx, x, y, big, k, rtr, t) {
    var s = big ? 6 : 4, c = big ? (rtr ? E.M : '#c977ff') : GEMC[k % 3][rtr ? 1 : 0];
    var bob = Math.round(Math.sin(t * 3 + k) * 1.5); y += bob;
    if (rtr) { R_(ctx, x - s / 2, y - s, s, s * 2, c); R_(ctx, x - s, y - s / 2, s * 2, s, c); R_(ctx, x - 1, y - s + 1, 2, 2, E.w); return; }
    ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x, y - s - 1); ctx.lineTo(x + s, y - 1); ctx.lineTo(x, y + s); ctx.lineTo(x - s, y - 1); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.65)'; ctx.beginPath(); ctx.moveTo(x - 1, y - s + 1); ctx.lineTo(x + 2, y - 2); ctx.lineTo(x - 2, y - 2); ctx.fill();
    if (Math.sin(t * 4 + k * 1.7) > 0.93) { R_(ctx, x + s - 1, y - s - 2, 1, 5, '#fff'); R_(ctx, x + s - 3, y - s, 5, 1, '#fff'); }
  }
  function pie(ctx, x, y, big, rtr) {
    var w = big ? 14 : 10;
    R_(ctx, x - w / 2, y - 1, w, 5, rtr ? E.n : '#c27a32');
    R_(ctx, x - w / 2 + 1, y - 4, w - 2, 3, rtr ? E.y : '#efb85a');
    R_(ctx, x - 2, y - 3, 1, 1, rtr ? E.n : '#8a4f1e'); R_(ctx, x + 1, y - 3, 1, 1, rtr ? E.n : '#8a4f1e');
    if (big) R_(ctx, x - 1, y - 7, 2, 3, rtr ? E.R : '#d94a4a');
  }
  function itemIcon(ctx, x, y, what, rtr, s) {
    s = s || 1;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    if (what === 'gear') { R_(ctx, -5, -5, 10, 10, rtr ? E.y : '#d9a62e'); R_(ctx, -7, -2, 14, 4, rtr ? E.y : '#d9a62e'); R_(ctx, -2, -7, 4, 14, rtr ? E.y : '#d9a62e'); R_(ctx, -2, -2, 4, 4, rtr ? E.k : '#5a3c12'); }
    else if (what === 'compass') { R_(ctx, -5, -5, 10, 10, rtr ? E.l : '#cfd6dd'); R_(ctx, -4, -4, 8, 8, rtr ? E.b : '#2f5d8a'); R_(ctx, -1, -4, 2, 4, rtr ? E.R : '#ff5a5a'); R_(ctx, -1, 0, 2, 4, rtr ? E.w : '#fff'); R_(ctx, 4, -8, 2, 4, rtr ? E.l : '#cfd6dd'); }
    else if (what === 'icepick') { R_(ctx, -1, -6, 2, 13, rtr ? E.n : '#8b5a2b'); R_(ctx, -6, -7, 12, 3, rtr ? E.C : '#a6e4ff'); R_(ctx, 5, -6, 2, 3, rtr ? E.C : '#a6e4ff'); }
    else if (what === 'astro') { ctx.strokeStyle = rtr ? E.y : '#e1a83c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 6, 0, 7); ctx.stroke(); R_(ctx, -6, -1, 12, 2, rtr ? E.y : '#e1a83c'); R_(ctx, -1, -6, 2, 12, rtr ? E.n : '#b8762a'); }
    else if (what === 'lens') { ctx.fillStyle = rtr ? E.C : 'rgba(150,230,255,.9)'; ctx.beginPath(); ctx.arc(0, 0, 6, 0, 7); ctx.fill(); ctx.strokeStyle = rtr ? E.y : '#d9a62e'; ctx.lineWidth = 2; ctx.stroke(); R_(ctx, -2, -3, 2, 2, '#fff'); }
    else if (what === 'key') { R_(ctx, -7, -3, 6, 6, rtr ? E.y : '#ffd56a'); R_(ctx, -5, -1, 2, 2, rtr ? E.k : '#2a2030'); R_(ctx, -1, -1, 9, 2, rtr ? E.y : '#ffd56a'); R_(ctx, 5, 1, 2, 3, rtr ? E.y : '#ffd56a'); R_(ctx, 2, 1, 2, 2, rtr ? E.y : '#ffd56a');
      R_(ctx, -5, -6, 2, 2, rtr ? E.w : '#fff7c8'); }
    else if (what === 'life') { R_(ctx, -4, -4, 8, 8, rtr ? E.y : '#e0b048'); R_(ctx, -2, -6, 4, 12, rtr ? E.y : '#e0b048'); R_(ctx, -6, -2, 12, 4, rtr ? E.y : '#e0b048'); R_(ctx, -2, -2, 4, 4, rtr ? E.R : '#d94a4a'); }
    ctx.restore();
  }
  function items(ctx, S, cam, rtr, t) {
    var LV = S.LV;
    LV.items.forEach(function (it, i) {
      if (S.got[it.id]) return;
      var x = it.tx * T + 8 - cam, y = it.ty * T + 8; if (x < -20 || x > VW + 20) return;
      if (it.k === 'gem' || it.k === 'big') gem(ctx, x, y, it.k === 'big', i, rtr, t);
      else if (it.k === 'pie' || it.k === 'bigpie') pie(ctx, x, y + 3, it.k === 'bigpie', rtr);
      else {
        var w = it.k === 'item' ? it.what : it.k === 'relic' ? it.what : 'life';
        if (!rtr) { ctx.fillStyle = 'rgba(255,240,180,' + (0.18 + 0.1 * Math.sin(t * 4)) + ')'; ctx.beginPath(); ctx.arc(x, y, 12, 0, 7); ctx.fill(); }
        itemIcon(ctx, x, y + Math.sin(t * 2.5) * 2, w, rtr);
      }
    });
    S.loot.forEach(function (g, i) { gem(ctx, g.x - cam, g.y, g.v >= 500, i, rtr, t); });
    LV.flags.forEach(function (f, i) {
      var x = f.tx * T + 8 - cam, y = (f.ty + 1) * T; if (x < -20 || x > VW + 20) return;
      R_(ctx, x - 1, y - 26, 2, 26, rtr ? E.l : '#cfc6b8');
      var on = i <= S.cp, wv = Math.round(Math.sin(t * 5 + i) * 1);
      ctx.fillStyle = on ? (rtr ? E.R : '#e9643a') : (rtr ? E.d : '#7d7468');
      ctx.beginPath(); ctx.moveTo(x + 1, y - 26); ctx.lineTo(x + 13, y - 22 + wv); ctx.lineTo(x + 1, y - 17); ctx.fill();
    });
    S.objs.forEach(function (o) {
      if (!o.alive) return; var x = o.x - cam, y = o.y;
      if (o.k === 'rock') {
        if (rtr) { R_(ctx, x - 6, y - 10, 12, 10, E.l); R_(ctx, x - 4, y - 12, 8, 2, E.l); R_(ctx, x - 3, y - 9, 3, 2, E.w); }
        else { ctx.fillStyle = '#8d8a86'; ctx.beginPath(); ctx.ellipse(x, y - 6, 7, 6.5, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#b5b1ab'; ctx.beginPath(); ctx.ellipse(x - 2, y - 8, 3, 2, 0, 0, 7); ctx.fill(); }
      } else {
        R_(ctx, x - 8, y - 11, 16, 11, rtr ? E.n : '#8a5a2e'); R_(ctx, x - 8, y - 13, 16, 4, rtr ? E.n : '#a06a36');
        R_(ctx, x - 8, y - 9, 16, 2, rtr ? E.y : '#d9a62e'); R_(ctx, x - 2, y - 10, 4, 5, rtr ? E.y : '#e8c25a'); R_(ctx, x - 6, y - 13, 2, 13, rtr ? E.y : '#c79528'); R_(ctx, x + 4, y - 13, 2, 13, rtr ? E.y : '#c79528');
      }
    });
    if (S.keyDrop && !S.keyGot) {
      var kx = S.keyDrop.x - cam, ky = S.keyDrop.y;
      if (!rtr) { ctx.fillStyle = 'rgba(255,230,140,' + (0.25 + 0.15 * Math.sin(t * 5)) + ')'; ctx.beginPath(); ctx.arc(kx, ky, 18, 0, 7); ctx.fill(); }
      itemIcon(ctx, kx, ky, 'key', rtr, 1.6);
    }
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
  function money(n) { var s = String(Math.max(0, Math.floor(n))); return s.replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
  function hud(g, ctx, S, prog, rtr) {
    var th = g.th();
    R_(ctx, 0, 0, VW, 18, rtr ? E.k : 'rgba(8,8,14,.6)');
    for (var i = 0; i < PS.logic.K.HEARTS; i++) heartIcon(ctx, 6 + i * 10, 5, i < S.hearts, rtr);
    // мини-портрет и жизни
    R_(ctx, 40, 4, 5, 3, rtr ? E.w : '#dfe3ea'); R_(ctx, 40, 7, 5, 4, rtr ? E.y : '#e8b98f'); R_(ctx, 40, 7, 5, 1, rtr ? E.n : '#b87333');
    g.text('×' + S.lives, 47, 13, { size: 10, color: th.ink, weight: 800 });
    gem(ctx, 70, 10, false, 2, rtr, 0);
    g.text(money(S.bank + S.bag), 78, 13, { size: 10, color: rtr ? E.y : '#ffe08a', weight: 800 });
    if (S.bag) g.text('(' + g.t('bag') + ' +' + money(S.bag) + ')', 138, 13, { size: 9, color: th.muted, weight: 700 });
    // ключи
    var ids = PS.levels.ids;
    for (var k = 0; k < ids.length; k++) {
      var have = prog.keys[ids[k]] || (ids[k] === S.id && S.keyGot);
      ctx.globalAlpha = have ? 1 : 0.25; itemIcon(ctx, 330 + k * 18, 9, 'key', rtr, 0.8); ctx.globalAlpha = 1;
    }
    // предметы и реликвии
    var xi = 430;
    PS.levels.ITEMS.concat(PS.levels.RELICS).forEach(function (w) {
      var have = (prog.items[w] || prog.relics[w] || S.gotItem === w || S.gotRelic === w);
      if (!have) return; itemIcon(ctx, xi, 9, w, rtr, 0.8); xi += 16;
    });
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
    var P = S.hero;
    if (S.phase !== 'dead' || Math.floor(t * 10) % 2) {
      if (!rtr) { ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.85)'; ctx.shadowBlur = 3; }
      hero(ctx, P.x - cam, P.y, { face: P.face, run: P.ground ? ui.runPh : 0, pogo: P.pogo || (ui.squash > 0 && !P.ground), squash: ui.squash, swing: S.swing > 0 ? S.swing / PS.logic.K.SWING : 0, air: !P.ground, blink: P.inv > 0 && S.phase === 'play' }, rtr, t);
      if (!rtr) ctx.restore();
    }
    ui.fx.draw(ctx, cam, rtr);
    hud(g, ctx, S, prog, rtr);
    if (S.guard.alive && S.guard.awake) bossBar(g, ctx, S.guard, g.t('g_' + LV.guard), rtr);
    if (S.boss.alive && S.boss.awake) bossBar(g, ctx, S.boss, g.t('b_' + LV.boss), rtr);
    // всплывашки
    ui.toasts.forEach(function (q) { var a = Math.min(1, q.t / q.life * 2); ctx.globalAlpha = a; g.text(q.text, q.x - cam, q.y - (1 - q.t / q.life) * 18, { size: q.big ? 12 : 10, align: 'center', color: q.color, weight: 800 }); ctx.globalAlpha = 1; });
    var th = g.th();
    if (ui.msg) { ctx.globalAlpha = Math.min(1, ui.msg.a * 2); g.text(ui.msg.text, VW / 2, VH - 14, { size: 12, align: 'center', color: ui.msg.color || th.ink, weight: 800 }); ctx.globalAlpha = 1; }
    if (ui.banner) {
      var bn = ui.banner, al = Math.min(1, bn.a * 2, (bn.dur - bn.a) * 4 + 0.2), lines = bn.lines || [];
      ctx.globalAlpha = al;
      var bh = 50 + lines.length * 15;
      R_(ctx, 56, 70, VW - 112, bh, rtr ? E.k : 'rgba(10,10,18,.78)');
      if (rtr) { R_(ctx, 56, 70, VW - 112, 2, bn.color || th.accent); R_(ctx, 56, 68 + bh, VW - 112, 2, bn.color || th.accent); }
      g.text(bn.title, VW / 2, 94, { size: 18, align: 'center', color: bn.color || th.accent, weight: 900 });
      if (bn.sub) g.text(bn.sub, VW / 2, 111, { size: 11, align: 'center', color: th.muted, weight: 700 });
      lines.forEach(function (ln, i) { g.text(ln, VW / 2, 128 + i * 15, { size: 11, align: 'center', color: th.ink, weight: 700 }); });
      ctx.globalAlpha = 1;
    }
  };

  // ---------- лагерь: глобус ----------
  var LON = { mine: 0, swamp: 72, ridge: 144, tower: 216, sunk: 288 };
  var LAT = { mine: 18, swamp: -14, ridge: 34, tower: -2, sunk: -30 };
  var XCOL = { mine: ['#e39a4f', E.n], swamp: ['#8fd16a', E.G], ridge: ['#9fd6ff', E.C], tower: ['#ffd36b', E.y], sunk: ['#5fc8e8', E.c] };
  PS.renderCamp = function (g, ctx, M, prog) {
    var rtr = g.themeName === 'retro', t = g.time, th = g.th();
    ctx.imageSmoothingEnabled = !rtr;
    // ночное небо и лагерь
    if (rtr) { ctx.fillStyle = E.b; ctx.fillRect(0, 0, VW, VH); }
    else { var gr = ctx.createLinearGradient(0, 0, 0, VH); gr.addColorStop(0, '#141a3a'); gr.addColorStop(1, '#3a2b4a'); ctx.fillStyle = gr; ctx.fillRect(0, 0, VW, VH); }
    for (var i = 0; i < 60; i++) { var a = 0.4 + 0.6 * Math.abs(Math.sin(t * 0.7 + i)); ctx.globalAlpha = rtr ? 1 : a; R_(ctx, (i * 97) % VW, (i * 53) % 170, 1 + (i % 3 === 0), 1 + (i % 3 === 0), rtr ? E.w : '#fff'); }
    ctx.globalAlpha = 1;
    R_(ctx, 0, 240, VW, 48, rtr ? E.g : '#2b3a2a');
    // палатка и костёр
    ctx.fillStyle = rtr ? E.n : '#8a6a3a'; ctx.beginPath(); ctx.moveTo(24, 240); ctx.lineTo(64, 196); ctx.lineTo(104, 240); ctx.fill();
    ctx.fillStyle = rtr ? E.k : '#3a2a1a'; ctx.beginPath(); ctx.moveTo(56, 240); ctx.lineTo(64, 214); ctx.lineTo(72, 240); ctx.fill();
    var fl = Math.sin(t * 9) * 2;
    R_(ctx, 128, 236, 20, 4, rtr ? E.n : '#5a3a1e');
    ctx.fillStyle = rtr ? E.R : '#ff8a3a'; ctx.beginPath(); ctx.moveTo(130, 236); ctx.lineTo(138, 220 + fl); ctx.lineTo(146, 236); ctx.fill();
    ctx.fillStyle = rtr ? E.y : '#ffd56a'; ctx.beginPath(); ctx.moveTo(134, 236); ctx.lineTo(138, 226 - fl); ctx.lineTo(142, 236); ctx.fill();
    hero(ctx, 168, 240, { face: 1, run: 0 }, rtr, t);
    // глобус
    var cx = 300, cy = 128, r = 86;
    R_(ctx, cx - 4, cy + r, 8, 26, rtr ? E.n : '#7a5a34'); R_(ctx, cx - 30, cy + r + 22, 60, 6, rtr ? E.n : '#5a3f22');
    if (rtr) { ctx.fillStyle = E.c; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill(); }
    else { var rg = ctx.createRadialGradient(cx - 30, cy - 30, 10, cx, cy, r); rg.addColorStop(0, '#6fb6d8'); rg.addColorStop(1, '#1d4a6a'); ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill(); }
    ctx.strokeStyle = rtr ? E.b : 'rgba(255,255,255,.18)'; ctx.lineWidth = 1;
    for (var la = -60; la <= 60; la += 30) { var yy = cy - Math.sin(la * Math.PI / 180) * r, rr = Math.cos(la * Math.PI / 180) * r; ctx.beginPath(); ctx.ellipse(cx, yy, rr, rr * 0.08 + 0.5, 0, 0, 7); ctx.stroke(); }
    for (var lo = 0; lo < 360; lo += 30) { var ang = (lo - M.rot) * Math.PI / 180; if (Math.cos(ang) < 0) continue; ctx.beginPath(); ctx.ellipse(cx, cy, Math.abs(Math.sin(ang)) * r + 0.5, r, 0, 0, 7); ctx.stroke(); }
    // материки-пятна (оборачиваются вместе с глобусом)
    for (var m = 0; m < 9; m++) {
      var mlon = m * 40 + 10, mlat = ((m * 37) % 100) - 50, aa = (mlon - M.rot) * Math.PI / 180;
      if (Math.cos(aa) < 0.1) continue;
      var mx = cx + Math.sin(aa) * Math.cos(mlat * Math.PI / 180) * r, my = cy - Math.sin(mlat * Math.PI / 180) * r;
      ctx.fillStyle = rtr ? E.g : 'rgba(120,170,90,.55)'; ctx.beginPath(); ctx.ellipse(mx, my, 14 * Math.cos(aa), 9, 0, 0, 7); ctx.fill();
    }
    // узлы экспедиций
    PS.levels.ids.forEach(function (id) {
      var aa = (LON[id] - M.rot) * Math.PI / 180, cs = Math.cos(aa); if (cs < -0.05) return;
      var la = LAT[id] * Math.PI / 180, x = cx + Math.sin(aa) * Math.cos(la) * r, y = cy - Math.sin(la) * r, sel = M.sel === id;
      var col = XCOL[id][rtr ? 1 : 0], sz = 4 + cs * 4;
      ctx.globalAlpha = 0.35 + 0.65 * cs;
      if (sel) { ctx.strokeStyle = rtr ? E.w : '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, sz + 5 + Math.sin(t * 5), 0, 7); ctx.stroke(); }
      R_(ctx, x - sz, y - sz, sz * 2, sz * 2, col);
      if (prog.keys[id]) itemIcon(ctx, x, y - sz - 8, 'key', rtr, 0.7);
      ctx.globalAlpha = 1;
    });
    // обсерватория на полюсе
    var allK = PS.save.allKeys(prog), ox = cx, oy = cy - r - 4;
    ctx.globalAlpha = allK ? 1 : 0.45;
    R_(ctx, ox - 10, oy - 6, 20, 8, rtr ? E.l : '#cfc8d8'); ctx.fillStyle = rtr ? E.w : '#efe8f6'; ctx.beginPath(); ctx.arc(ox, oy - 6, 10, Math.PI, 0); ctx.fill();
    R_(ctx, ox - 1, oy - 16, 3, 6, rtr ? E.d : '#5a5368'); R_(ctx, ox + 1, oy - 20, 8, 3, rtr ? E.y : '#ffd56a');
    if (M.sel === 'obs') { ctx.strokeStyle = rtr ? E.y : '#ffd56a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ox, oy - 6, 16 + Math.sin(t * 5), 0, 7); ctx.stroke(); }
    ctx.globalAlpha = 1;
    // шапка
    g.text(g.t('camp'), VW / 2, 18, { size: 13, align: 'center', color: th.accent, weight: 900 });
    // панель слева: казна, жизни, ключи, предметы
    var px = 12, py = 44;
    R_(ctx, px - 4, py - 14, 132, M.ach && M.ach.trueEnd ? 104 : 84, rtr ? E.k : 'rgba(8,8,16,.5)');
    g.text(g.t('bank') + ': ' + money(prog.bank), px, py, { size: 11, color: rtr ? E.y : '#ffe08a', weight: 800 });
    g.text(g.t('lives') + ': ' + prog.lives, px, py + 16, { size: 11, color: th.ink, weight: 800 });
    g.text(g.t('keys') + ': ' + PS.save.keyCount(prog) + '/5', px, py + 32, { size: 11, color: th.ink, weight: 800 });
    var ix = px + 6;
    PS.levels.ITEMS.forEach(function (w) { ctx.globalAlpha = prog.items[w] ? 1 : 0.2; itemIcon(ctx, ix, py + 50, w, rtr); ix += 20; });
    PS.levels.RELICS.forEach(function (w) { ctx.globalAlpha = prog.relics[w] ? 1 : 0.2; itemIcon(ctx, ix, py + 50, w, rtr); ix += 20; });
    ctx.globalAlpha = 1;
    if (M.ach && M.ach.trueEnd) g.text('★ ' + g.t('achTrue'), px, py + 80, { size: 8, color: rtr ? E.y : '#ffd56a', weight: 800 });
    // панель выбранного
    var id = M.sel, name = g.t('x_' + id), desc = g.t('xd_' + id), st;
    if (id === 'obs') st = allK ? (PS.save.trueEnd(prog) ? g.t('endingTrue').split(':')[0] : '✓ 5/5') : g.t('locked');
    else st = prog.keys[id] ? '✓ ' + g.t('cleared') + ' · ' + g.t('replay') : g.t('notYet') + ' · ' + g.t('b_' + PS.levels.EXP.filter(function (e) { return e.id === id; })[0].boss);
    R_(ctx, 100, 236, 312, 44, rtr ? E.k : 'rgba(8,8,16,.72)');
    g.text(name, VW / 2, 252, { size: 14, align: 'center', color: id === 'obs' ? (rtr ? E.y : '#ffd56a') : XCOL[id][rtr ? 1 : 0], weight: 900 });
    g.text(desc + ' — ' + st, VW / 2, 266, { size: 9, align: 'center', color: th.ink, weight: 700 });
    g.text(g.t('campHint'), VW / 2, 278, { size: 8, align: 'center', color: th.muted, weight: 700 });
    if (M.note && M.noteA > 0) g.text(M.note, cx, cy + r + 10, { size: 11, align: 'center', color: th.warn, weight: 800 });
  };

  // ---------- частицы ----------
  function FXs() { this.p = []; }
  FXs.prototype.add = function (x, y, o) { o = o || {}; for (var i = 0; i < (o.n || 8); i++) { var a = (o.a != null ? o.a : 0) + (o.spread != null ? (Math.random() - 0.5) * o.spread : Math.random() * Math.PI * 2), sp = (o.sp || 80) * (0.4 + Math.random() * 0.6); this.p.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: o.life || 0.5, life: o.life || 0.5, c: o.c || '#fff', r: o.r || 2, g: o.g == null ? 300 : o.g }); } if (this.p.length > 300) this.p.splice(0, this.p.length - 300); };
  FXs.prototype.step = function (dt) { this.p = this.p.filter(function (q) { q.t -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += q.g * dt; return q.t > 0; }); };
  FXs.prototype.draw = function (ctx, cam, rtr) { this.p.forEach(function (q) { ctx.globalAlpha = Math.min(1, q.t / q.life * 1.5); var s = rtr ? Math.max(2, Math.round(q.r)) : q.r; ctx.fillStyle = q.c; ctx.fillRect(Math.round(q.x - cam - s / 2), Math.round(q.y - s / 2), s, s); }); ctx.globalAlpha = 1; };
  FXs.prototype.clear = function () { this.p = []; };

  PS.R = { VW: VW, VH: VH, E: E, EXPAL: EXPAL, hero: hero, background: background, itemIcon: itemIcon, gem: gem, big: big, money: money, FX: new FXs(), LON: LON };
})(typeof window !== 'undefined' ? window : globalThis);
