/* РИКОШЕТ · рендер обеих тем на canvas. RIK.render.draw(ctx, g, S, opts), палитры RIK.render.PM (modern) / PR (retro).
   modern — кузница в полумраке: раскалённая заклёпка со шлейфом искр, наковальня из воронёной стали, блоки с фактурой
   руды/стекла/металла, механизмы-боссы. retro — 16-цветная палитра, плоские блоки с фасками 2 px, квадратная заклёпка, сканлайны.
   Спрайты блоков кэшируются по (тема, вид, цвет, прочность). Тема меняет только отрисовку. */
(function (global) {
  'use strict';
  var R = global.RIK = global.RIK || {};
  var PM = { retro: false, bg: '#120e0c', field: '#1a1411', field2: '#0f0b09', frame: '#3a3330', frameHi: '#6d625b', hud: '#0d0a08', hudLine: '#2c2420',
    ink: '#f6efe6', muted: '#a3978c', accent: '#ff5e1a', good: '#5ee08a', bad: '#ff5d5d', warn: '#ffc34d', glow: '#ffb15c',
    ore: { a: ['#c8452e', '#7d2215'], b: ['#d07a3a', '#7c3f17'], c: ['#e8b93c', '#8e6510'], d: ['#7fe3f0', '#2a8ea3'], e: ['#3fbf86', '#19634a'], f: ['#a874e6', '#55308d'] } };
  var PR = { retro: true, bg: '#000000', field: '#000000', field2: '#000000', frame: '#5555ff', frameHi: '#aaaaff', hud: '#000000', hudLine: '#5555ff',
    ink: '#ffffff', muted: '#aaaaaa', accent: '#ffff55', good: '#55ff55', bad: '#ff5555', warn: '#ffff55', glow: '#ffff55',
    ore: { a: ['#ff5555', '#aa0000'], b: ['#ffaa55', '#aa5500'], c: ['#ffff55', '#aa5500'], d: ['#55ffff', '#00aaaa'], e: ['#55ff55', '#00aa00'], f: ['#ff55ff', '#aa00aa'] } };
  var PRIZE_COL = { E: '#4f9dff', B: '#39d0c8', W: '#7bd36a', L: '#ff4f6a', C: '#e0c040', H: '#a98cff', F: '#ff7a1a', '+': '#ff4fa0', S: '#7a6a62', Q: '#9a5548' };
  var PRIZE_RCOL = { E: '#5555ff', B: '#55ffff', W: '#55ff55', L: '#ff5555', C: '#ffff55', H: '#ff55ff', F: '#ffaa55', '+': '#ff55ff', S: '#aaaaaa', Q: '#aa5500' };
  var PRIZE_GLYPH = { E: '↔', B: '⁂', W: '◷', L: '⇈', C: '◉', H: '═', F: '✹', '+': '♥', S: '→←', Q: '»' };

  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function hash(n) { n = (n ^ 61) ^ (n >>> 16); n = n + (n << 3); n = n ^ (n >>> 4); n = Math.imul(n, 0x27d4eb2d); n = n ^ (n >>> 15); return (n >>> 0) / 4294967296; }
  function mk(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  // ---------- спрайты блоков ----------
  var cache = {};
  function brickSprite(b, P) {
    var dmg = b.maxHp - b.hp, key = (P.retro ? 'r' : 'm') + b.type + (b.color || '') + b.maxHp + ':' + dmg;
    if (cache[key]) return cache[key];
    var w = 38, h = 16, c = mk(w, h), x = c.getContext('2d');
    if (P.retro) retroBrick(x, b, P, w, h, dmg); else modernBrick(x, b, P, w, h, dmg);
    cache[key] = c; return c;
  }
  function retroBrick(x, b, P, w, h, dmg) {
    var base, hi, lo;
    switch (b.type) {
      case 'n': base = P.ore[b.color][0]; lo = P.ore[b.color][1]; hi = '#ffffff'; break;
      case 's': base = b.maxHp === 3 ? '#aaaaaa' : '#555555'; hi = '#ffffff'; lo = '#000000'; break;
      case 'u': base = '#555555'; hi = '#aaaaaa'; lo = '#000000'; break;
      case 'x': base = '#aa0000'; hi = '#ff5555'; lo = '#000000'; break;
      case 'm': base = '#aa5500'; hi = '#ffaa55'; lo = '#000000'; break;
      case 'r': base = '#00aa00'; hi = '#55ff55'; lo = '#000000'; break;
      case 'k': base = '#ffff55'; hi = '#ffffff'; lo = '#aa5500'; break;
      default: base = '#0000aa'; hi = '#5555ff'; lo = '#000000';
    }
    x.fillStyle = base; x.fillRect(1, 1, w - 2, h - 2);
    x.fillStyle = hi; x.fillRect(1, 1, w - 2, 2); x.fillRect(1, 1, 2, h - 2);
    x.fillStyle = lo; x.fillRect(1, h - 3, w - 2, 2); x.fillRect(w - 3, 1, 2, h - 2);
    x.fillStyle = '#000000';
    if (b.type === 's' || b.type === 'u') { [[5, 5], [w - 8, 5], [5, h - 8], [w - 8, h - 8]].forEach(function (p) { x.fillRect(p[0], p[1], 3, 3); }); }
    if (b.type === 'u') { x.fillStyle = '#aaaaaa'; for (var i = 10; i < w - 10; i += 6) x.fillRect(i, 7, 3, 2); }
    if (b.type === 'x') { x.fillStyle = '#ffff55'; x.fillRect(17, 4, 4, 8); x.fillRect(13, 6, 12, 4); }
    if (b.type === 'm') { x.fillStyle = '#000000'; x.fillRect(6, 7, 6, 2); x.fillRect(26, 7, 6, 2); x.fillRect(6, 5, 2, 6); x.fillRect(30, 5, 2, 6); }
    if (b.type === 'r') { x.fillStyle = '#55ff55'; x.fillRect(9, 5, 4, 6); x.fillRect(19, 4, 4, 8); x.fillRect(28, 6, 3, 4); }
    if (b.type === 'k') { x.fillStyle = '#aa5500'; x.fillRect(8, 5, 6, 6); x.fillRect(14, 7, 16, 2); x.fillRect(24, 9, 2, 3); x.fillRect(28, 9, 2, 3); x.fillStyle = '#ffff55'; x.fillRect(10, 7, 2, 2); }
    if (b.type === 'g') { x.fillStyle = '#5555ff'; for (var j = 4; j < w - 2; j += 6) x.fillRect(j, 1, 2, h - 2); x.fillRect(1, 7, w - 2, 2); }
    if (dmg > 0) { x.fillStyle = '#000000'; x.fillRect(12, 4, 2, 4); x.fillRect(14, 7, 2, 3); x.fillRect(16, 9, 4, 2); if (dmg > 1) { x.fillRect(25, 5, 2, 3); x.fillRect(23, 8, 2, 4); } }
  }
  function modernBrick(x, b, P, w, h, dmg) {
    var g, i, sd = (b.type.charCodeAt(0) * 31 + (b.color || 'z').charCodeAt(0) * 7 + b.maxHp) | 0;
    x.save(); rr(x, 0.5, 0.5, w - 1, h - 1, 3.5); x.clip();
    switch (b.type) {
      case 'n': {
        var col = P.ore[b.color];
        if (b.color === 'd') {   // стекло: полупрозрачное, с бликом
          g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(160,240,255,.85)'); g.addColorStop(1, 'rgba(40,140,170,.75)');
          x.fillStyle = g; x.fillRect(0, 0, w, h);
          x.fillStyle = 'rgba(255,255,255,.55)'; x.beginPath(); x.moveTo(6, 0); x.lineTo(13, 0); x.lineTo(5, h); x.lineTo(-2, h); x.closePath(); x.fill();
          x.fillStyle = 'rgba(255,255,255,.25)'; x.fillRect(16, 0, 3, h);
        } else {                 // руда: камень + вкрапления
          g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, col[0]); g.addColorStop(1, col[1]);
          x.fillStyle = g; x.fillRect(0, 0, w, h);
          for (i = 0; i < 9; i++) { var px = hash(sd + i * 13) * w, py = hash(sd + i * 29) * h, s = 1 + hash(sd + i * 7) * 2.2; x.fillStyle = i % 3 ? 'rgba(0,0,0,.22)' : 'rgba(255,255,230,.45)'; x.beginPath(); x.arc(px, py, s, 0, 6.3); x.fill(); }
          x.fillStyle = 'rgba(255,255,255,.22)'; x.fillRect(0, 0, w, 3);
        }
        break;
      }
      case 's': {
        var steel = b.maxHp === 3;
        g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, steel ? '#c9d2dc' : '#8f8a86'); g.addColorStop(0.5, steel ? '#8d98a5' : '#5f5955'); g.addColorStop(1, steel ? '#5a6370' : '#3b3633');
        x.fillStyle = g; x.fillRect(0, 0, w, h);
        x.fillStyle = 'rgba(255,255,255,.3)'; x.fillRect(0, 0, w, 2);
        [[5, 4.5], [w - 5, 4.5], [5, h - 4.5], [w - 5, h - 4.5]].forEach(function (p) { x.fillStyle = 'rgba(0,0,0,.45)'; x.beginPath(); x.arc(p[0] + 0.6, p[1] + 0.6, 1.9, 0, 6.3); x.fill(); x.fillStyle = steel ? '#eef3f7' : '#c8c0b8'; x.beginPath(); x.arc(p[0], p[1], 1.6, 0, 6.3); x.fill(); });
        break;
      }
      case 'u': {
        g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#4a4644'); g.addColorStop(1, '#232020');
        x.fillStyle = g; x.fillRect(0, 0, w, h);
        x.strokeStyle = 'rgba(255,255,255,.08)'; x.lineWidth = 1; for (i = -h; i < w; i += 5) { x.beginPath(); x.moveTo(i, h); x.lineTo(i + h, 0); x.stroke(); }
        x.fillStyle = '#7a726c'; [[6, 8], [w - 6, 8]].forEach(function (p) { x.beginPath(); x.arc(p[0], p[1], 2.6, 0, 6.3); x.fill(); });
        x.fillStyle = 'rgba(0,0,0,.5)'; x.fillRect(5, 7.5, 2, 1); x.fillRect(w - 7, 7.5, 2, 1);
        break;
      }
      case 'x': {
        g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#e2483a'); g.addColorStop(1, '#7c1610');
        x.fillStyle = g; x.fillRect(0, 0, w, h);
        x.fillStyle = '#2a0c08'; x.fillRect(0, 5, w, 6);
        x.fillStyle = '#ffd34a'; for (i = 0; i < 5; i++) { x.beginPath(); x.moveTo(3 + i * 7.5, 11); x.lineTo(7 + i * 7.5, 5); x.lineTo(10 + i * 7.5, 5); x.lineTo(6 + i * 7.5, 11); x.closePath(); x.fill(); }
        break;
      }
      case 'm': {
        g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#d9a25a'); g.addColorStop(1, '#7a4a1c');
        x.fillStyle = g; x.fillRect(0, 0, w, h);
        x.fillStyle = 'rgba(40,20,5,.7)';
        [[4, 1], [w - 4, -1]].forEach(function (p) { x.beginPath(); x.moveTo(p[0], 8); x.lineTo(p[0] + p[1] * 6, 4); x.lineTo(p[0] + p[1] * 6, 12); x.closePath(); x.fill(); });
        x.fillStyle = 'rgba(255,255,255,.25)'; x.fillRect(0, 0, w, 2);
        break;
      }
      case 'r': {
        g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#5fe07c'); g.addColorStop(1, '#1d6e3a');
        x.fillStyle = g; x.fillRect(0, 0, w, h);
        x.fillStyle = 'rgba(210,255,220,.75)';
        [[8, 3, 5], [19, 2, 7], [29, 4, 5]].forEach(function (q) { x.beginPath(); x.moveTo(q[0], q[1]); x.lineTo(q[0] + q[2] / 2, h - 3); x.lineTo(q[0] - q[2] / 2, h - 3); x.closePath(); x.fill(); });
        break;
      }
      case 'k': {
        g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#ffe27a'); g.addColorStop(1, '#b07e16');
        x.fillStyle = g; x.fillRect(0, 0, w, h);
        x.strokeStyle = '#5a3a06'; x.fillStyle = '#5a3a06'; x.lineWidth = 2;
        x.beginPath(); x.arc(11, 8, 3.5, 0, 6.3); x.stroke(); x.fillRect(14, 7, 15, 2); x.fillRect(24, 9, 2, 3); x.fillRect(28, 9, 2, 3);
        break;
      }
      default: {   // решётка
        x.fillStyle = 'rgba(30,26,40,.85)'; x.fillRect(0, 0, w, h);
        x.fillStyle = '#8a86a8'; for (i = 3; i < w; i += 7) x.fillRect(i, 0, 2.5, h);
        x.fillStyle = '#5c5878'; x.fillRect(0, 6.5, w, 3);
      }
    }
    if (dmg > 0) {
      x.strokeStyle = 'rgba(20,10,5,.85)'; x.lineWidth = 1.2; x.beginPath();
      x.moveTo(13, 0); x.lineTo(16, 6); x.lineTo(13, 10); x.lineTo(17, h);
      if (dmg > 1) { x.moveTo(27, 0); x.lineTo(24, 5); x.lineTo(28, 9); x.moveTo(24, 5); x.lineTo(20, 7); }
      x.stroke();
    }
    x.restore();
    x.strokeStyle = 'rgba(0,0,0,.55)'; x.lineWidth = 1; rr(x, 0.5, 0.5, w - 1, h - 1, 3.5); x.stroke();
  }

  // ---------- фон поля (кэш по теме) ----------
  var bgCache = {};
  function fieldBg(P, K) {
    var key = P.retro ? 'r' : 'm'; if (bgCache[key]) return bgCache[key];
    var c = mk(K.W, K.H), x = c.getContext('2d'), i, j;
    x.fillStyle = P.bg; x.fillRect(0, 0, K.W, K.H);
    if (P.retro) {
      x.fillStyle = '#000'; x.fillRect(K.FX0, K.FY0, K.FX1 - K.FX0, K.H - K.FY0);
      x.fillStyle = '#0000aa'; for (j = K.FY0 + 8; j < K.H; j += 32) for (i = K.FX0 + ((j / 32) % 2 ? 0 : 19); i < K.FX1; i += 38) x.fillRect(i, j, 2, 2);
      x.fillStyle = P.frame; x.fillRect(0, K.HUD, K.FX0, K.H - K.HUD); x.fillRect(K.FX1, K.HUD, K.W - K.FX1, K.H - K.HUD); x.fillRect(0, K.HUD, K.W, K.FY0 - K.HUD);
      x.fillStyle = P.frameHi; x.fillRect(4, K.HUD + 4, 4, K.H - K.HUD - 4); x.fillRect(K.FX1 + 8, K.HUD + 4, 4, K.H - K.HUD - 4); x.fillRect(4, K.HUD + 4, K.W - 8, 4);
      x.fillStyle = '#000'; for (j = K.HUD + 16; j < K.H; j += 24) { x.fillRect(2, j, 12, 3); x.fillRect(K.FX1 + 2, j, 12, 3); }
      return (bgCache[key] = c);
    }
    var g = x.createLinearGradient(0, K.FY0, 0, K.H); g.addColorStop(0, '#221a16'); g.addColorStop(0.7, '#17110e'); g.addColorStop(1, '#2a140a');
    x.fillStyle = g; x.fillRect(K.FX0, K.FY0, K.FX1 - K.FX0, K.H - K.FY0);
    // кладка мастерской
    x.strokeStyle = 'rgba(255,220,190,.035)'; x.lineWidth = 1;
    for (j = K.FY0; j < K.H; j += 24) { x.beginPath(); x.moveTo(K.FX0, j + 0.5); x.lineTo(K.FX1, j + 0.5); x.stroke(); for (i = K.FX0 + ((j / 24) % 2 ? 24 : 0); i < K.FX1; i += 48) { x.beginPath(); x.moveTo(i + 0.5, j); x.lineTo(i + 0.5, j + 24); x.stroke(); } }
    var rg = x.createRadialGradient(K.W / 2, K.H + 40, 20, K.W / 2, K.H + 40, 330); rg.addColorStop(0, 'rgba(255,110,30,.22)'); rg.addColorStop(1, 'rgba(255,110,30,0)');
    x.fillStyle = rg; x.fillRect(K.FX0, K.FY0, K.FX1 - K.FX0, K.H - K.FY0);
    // рамка — стальные балки с заклёпками
    function beam(x0, y0, w, h, vert) {
      var gg = vert ? x.createLinearGradient(x0, 0, x0 + w, 0) : x.createLinearGradient(0, y0, 0, y0 + h);
      gg.addColorStop(0, '#5c5450'); gg.addColorStop(0.45, '#8a807a'); gg.addColorStop(1, '#2e2826'); x.fillStyle = gg; x.fillRect(x0, y0, w, h);
      x.fillStyle = '#b8aea6';
      if (vert) for (var q = y0 + 14; q < y0 + h; q += 34) { x.beginPath(); x.arc(x0 + w / 2, q, 2, 0, 6.3); x.fill(); }
      else for (var q2 = x0 + 14; q2 < x0 + w; q2 += 38) { x.beginPath(); x.arc(q2, y0 + h / 2, 2, 0, 6.3); x.fill(); }
    }
    beam(0, K.HUD, K.FX0, K.H - K.HUD, true); beam(K.FX1, K.HUD, K.W - K.FX1, K.H - K.HUD, true); beam(0, K.HUD, K.W, K.FY0 - K.HUD, false);
    return (bgCache[key] = c);
  }

  // ---------- ракетка-наковальня ----------
  function paddle(ctx, P, K, S, t, opts) {
    var p = S.paddle, w = p.w, x0 = p.x - w / 2, y = K.PY, stun = p.stun > 0 && Math.floor(t * 20) % 2 === 0;
    if (P.retro) {
      ctx.fillStyle = stun ? '#ff5555' : '#aaaaaa'; ctx.fillRect(Math.round(x0), y, Math.round(w), 6);
      ctx.fillStyle = stun ? '#aa0000' : '#555555'; ctx.fillRect(Math.round(x0 + w * 0.22), y + 6, Math.round(w * 0.56), 4); ctx.fillRect(Math.round(x0 + w * 0.12), y + 10, Math.round(w * 0.76), 4);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(x0), y, Math.round(w), 2);
      if (S.fx.C > 0) { ctx.fillStyle = '#ffff55'; ctx.fillRect(Math.round(x0 + 4), y, Math.round(w - 8), 2); }
      if (S.fx.L > 0) { ctx.fillStyle = '#ff5555'; ctx.fillRect(Math.round(x0 + 4), y - 6, 4, 6); ctx.fillRect(Math.round(x0 + w - 8), y - 6, 4, 6); }
      return;
    }
    ctx.save();
    // тень
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(p.x, y + 20, w * 0.45, 4, 0, 0, 6.3); ctx.fill();
    // основание и талия
    ctx.fillStyle = stun ? '#5a1d18' : '#2b2a2e';
    ctx.beginPath(); ctx.moveTo(x0 + w * 0.26, y + 6); ctx.lineTo(x0 + w * 0.74, y + 6); ctx.lineTo(x0 + w * 0.66, y + 12); ctx.lineTo(x0 + w * 0.84, y + 17); ctx.lineTo(x0 + w * 0.16, y + 17); ctx.lineTo(x0 + w * 0.34, y + 12); ctx.closePath(); ctx.fill();
    // рабочая поверхность + рог
    var g = ctx.createLinearGradient(0, y, 0, y + 7); g.addColorStop(0, stun ? '#ff8f80' : '#d6dbe2'); g.addColorStop(0.35, stun ? '#c0443a' : '#7e8590'); g.addColorStop(1, stun ? '#6a1d16' : '#3a3d44');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x0 - 4, y + 1.5); ctx.lineTo(x0 + 6, y); ctx.lineTo(x0 + w, y); ctx.lineTo(x0 + w, y + 7); ctx.lineTo(x0 + 8, y + 7); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(x0 + 6, y, w - 8, 1.2);
    // накал по краям от ударов
    var hot = ctx.createRadialGradient(p.x, y, 2, p.x, y, w / 2); hot.addColorStop(0, 'rgba(255,140,50,.25)'); hot.addColorStop(1, 'rgba(255,140,50,0)'); ctx.fillStyle = hot; ctx.fillRect(x0, y - 4, w, 12);
    if (S.fx.C > 0) { ctx.fillStyle = 'rgba(255,215,90,.75)'; rr(ctx, x0 + 5, y - 1.5, w - 10, 3, 1.5); ctx.fill(); }
    if (S.fx.L > 0) {
      [x0 + 7, x0 + w - 7].forEach(function (cx) { var gg = ctx.createLinearGradient(cx - 3, 0, cx + 3, 0); gg.addColorStop(0, '#7a1020'); gg.addColorStop(0.5, '#ff5a6e'); gg.addColorStop(1, '#7a1020'); ctx.fillStyle = gg; ctx.fillRect(cx - 3, y - 8, 6, 8); ctx.fillStyle = '#ffd0d6'; ctx.fillRect(cx - 1, y - 9, 2, 2); });
    }
    ctx.restore();
  }

  // ---------- шар-заклёпка ----------
  function ball(ctx, P, K, b, S, t) {
    var fire = S.fx.F > 0, r = K.BR;
    if (P.retro) {
      ctx.fillStyle = fire ? '#ff5555' : '#ffffff'; ctx.fillRect(Math.round(b.x - 4), Math.round(b.y - 4), 8, 8);
      ctx.fillStyle = fire ? '#ffff55' : '#ffff55'; ctx.fillRect(Math.round(b.x - 2), Math.round(b.y - 2), 4, 4);
      return;
    }
    // шлейф
    var tr = b.trail || [];
    for (var i = 0; i < tr.length; i++) { var a = (i + 1) / tr.length; ctx.fillStyle = fire ? 'rgba(255,90,20,' + (a * 0.45) + ')' : 'rgba(255,150,60,' + (a * 0.3) + ')'; ctx.beginPath(); ctx.arc(tr[i][0], tr[i][1], r * (0.4 + a * 0.6) * (fire ? 1.4 : 1), 0, 6.3); ctx.fill(); }
    var gl = ctx.createRadialGradient(b.x, b.y, 1, b.x, b.y, r * (fire ? 4 : 3)); gl.addColorStop(0, fire ? 'rgba(255,120,30,.75)' : 'rgba(255,170,80,.55)'); gl.addColorStop(1, 'rgba(255,120,30,0)');
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(b.x, b.y, r * (fire ? 4 : 3), 0, 6.3); ctx.fill();
    var g = ctx.createRadialGradient(b.x - 1.5, b.y - 1.5, 0.5, b.x, b.y, r); g.addColorStop(0, '#fffbe8'); g.addColorStop(0.45, fire ? '#ffd040' : '#ffd38a'); g.addColorStop(1, fire ? '#ff3a10' : '#ff7a1f');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, 6.3); ctx.fill();
  }

  // ---------- босс ----------
  function boss(ctx, P, K, B, t) {
    var x = B.x, y = B.y, w = B.w, h = B.h, flash = B.inv > 0, dead = B.dead;
    if (dead) { ctx.globalAlpha = Math.max(0, 1 - B.deadT / 1.2); x += Math.sin(B.deadT * 60) * 3; }
    if (P.retro) {
      ctx.fillStyle = flash ? '#ffffff' : B.kind === 1 ? '#aaaaaa' : B.kind === 2 ? '#aa5500' : '#aa0000'; ctx.fillRect(Math.round(x), Math.round(y), w, h);
      ctx.fillStyle = '#000'; ctx.fillRect(Math.round(x) + 4, Math.round(y) + 4, w - 8, 4); ctx.fillRect(Math.round(x) + 4, Math.round(y) + h - 8, w - 8, 4);
      ctx.fillStyle = '#ffff55'; ctx.fillRect(Math.round(x + w / 2 - 10), Math.round(y + h / 2 - 6), 20, 12);
      ctx.fillStyle = '#ff5555'; ctx.fillRect(Math.round(x + w / 2 - 4), Math.round(y + h / 2 - 3), 8, 6);
      for (var k = 0; k < 4; k++) { ctx.fillStyle = (Math.floor(t * 6) + k) % 2 ? '#555555' : '#ffffff'; ctx.fillRect(Math.round(x + 10 + k * (w - 30) / 3), Math.round(y + h), 10, 6); }
      ctx.globalAlpha = 1; return;
    }
    ctx.save();
    // корпус
    var g = ctx.createLinearGradient(0, y, 0, y + h);
    var c0 = B.kind === 1 ? ['#9aa1aa', '#4a4f57'] : B.kind === 2 ? ['#b98552', '#5a3518'] : ['#8a3428', '#2c0d08'];
    g.addColorStop(0, flash ? '#ffffff' : c0[0]); g.addColorStop(1, flash ? '#ffb89a' : c0[1]);
    ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 14; ctx.fillStyle = g; rr(ctx, x, y, w, h, 10); ctx.fill(); ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 1.5; rr(ctx, x + 0.75, y + 0.75, w - 1.5, h - 1.5, 10); ctx.stroke();
    // заклёпки
    ctx.fillStyle = 'rgba(255,255,255,.55)'; for (var i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(x + 10 + i * (w - 20) / 5, y + 6, 1.8, 0, 6.3); ctx.fill(); }
    if (B.kind === 1) {   // молотобой: два поршня-молота
      [x + 22, x + w - 22].forEach(function (px, j) {
        var s = Math.sin(t * 6 + j * 3) * 5;
        ctx.fillStyle = '#2d3036'; ctx.fillRect(px - 4, y + h - 4, 8, 10 + s);
        ctx.fillStyle = '#c4cad2'; rr(ctx, px - 11, y + h + 4 + s, 22, 9, 2); ctx.fill();
      });
    } else if (B.kind === 2) {   // мехоправ: гармошка мехов
      ctx.fillStyle = 'rgba(40,20,8,.8)'; var fold = 6 + Math.sin(t * 3) * 2;
      for (var f = 0; f < 5; f++) { ctx.beginPath(); ctx.moveTo(x + 24 + f * 12, y + 12); ctx.lineTo(x + 24 + f * 12 + fold, y + h / 2); ctx.lineTo(x + 24 + f * 12, y + h - 10); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(30,15,5,.9)'; ctx.stroke(); }
      for (var f2 = 0; f2 < 5; f2++) { ctx.beginPath(); ctx.moveTo(x + w - 24 - f2 * 12, y + 12); ctx.lineTo(x + w - 24 - f2 * 12 - fold, y + h / 2); ctx.lineTo(x + w - 24 - f2 * 12, y + h - 10); ctx.stroke(); }
      ctx.fillStyle = '#3a2410'; rr(ctx, x + w / 2 - 8, y + h - 4, 16, 12, 3); ctx.fill();
    } else {   // горн-колосс: решётка-пасть
      ctx.fillStyle = '#1a0805'; rr(ctx, x + w / 2 - 44, y + h - 22, 88, 16, 4); ctx.fill();
      var fg = ctx.createLinearGradient(0, y + h - 22, 0, y + h - 6); fg.addColorStop(0, '#ffd04a'); fg.addColorStop(1, '#ff4a10');
      ctx.fillStyle = fg; ctx.globalAlpha *= 0.6 + Math.sin(t * 9) * 0.25; rr(ctx, x + w / 2 - 40, y + h - 19, 80, 10, 3); ctx.fill(); ctx.globalAlpha = dead ? Math.max(0, 1 - B.deadT / 1.2) : 1;
      ctx.fillStyle = '#3a1a12'; for (var q = 0; q < 7; q++) ctx.fillRect(x + w / 2 - 38 + q * 12, y + h - 22, 3, 16);
      [x + 14, x + w - 22].forEach(function (cx) { ctx.fillStyle = '#5a5250'; ctx.fillRect(cx, y - 10, 8, 12); ctx.fillStyle = 'rgba(200,190,180,.25)'; ctx.beginPath(); ctx.arc(cx + 4, y - 14 - (t * 20 % 10), 4 + (t * 20 % 10) / 3, 0, 6.3); ctx.fill(); });
    }
    // глаз-топка
    var ex = x + w / 2, ey = y + (B.kind === 3 ? h / 2 - 6 : h / 2), er = 9;
    var eg = ctx.createRadialGradient(ex, ey, 1, ex, ey, er * 2.4); eg.addColorStop(0, 'rgba(255,230,140,1)'); eg.addColorStop(0.35, 'rgba(255,110,30,.9)'); eg.addColorStop(1, 'rgba(255,60,10,0)');
    ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(ex, ey, er * 2.4, 0, 6.3); ctx.fill();
    ctx.fillStyle = '#1b0c06'; ctx.beginPath(); ctx.arc(ex, ey, er * 0.45, 0, 6.3); ctx.fill();
    // шестерни
    [x + 10, x + w - 10].forEach(function (cx, j) {
      ctx.save(); ctx.translate(cx, y + h / 2); ctx.rotate(t * (j ? -2 : 2)); ctx.fillStyle = '#d7b46a';
      for (var z = 0; z < 8; z++) { ctx.rotate(Math.PI / 4); ctx.fillRect(-1.5, -9, 3, 4); }
      ctx.beginPath(); ctx.arc(0, 0, 6, 0, 6.3); ctx.fill(); ctx.fillStyle = '#4a3410'; ctx.beginPath(); ctx.arc(0, 0, 2, 0, 6.3); ctx.fill(); ctx.restore();
    });
    ctx.restore(); ctx.globalAlpha = 1;
  }

  // ---------- HUD ----------
  function lifeIcon(ctx, P, x, y, on) {
    if (P.retro) { ctx.fillStyle = on ? '#aaaaaa' : '#555555'; ctx.fillRect(x - 7, y - 4, 14, 3); ctx.fillRect(x - 3, y - 1, 6, 3); ctx.fillRect(x - 5, y + 2, 10, 2); return; }
    ctx.fillStyle = on ? '#cfd5dc' : 'rgba(255,255,255,.15)';
    ctx.beginPath(); ctx.moveTo(x - 9, y - 4); ctx.lineTo(x + 7, y - 4); ctx.lineTo(x + 7, y - 1); ctx.lineTo(x + 3, y); ctx.lineTo(x + 5, y + 4); ctx.lineTo(x - 5, y + 4); ctx.lineTo(x - 3, y); ctx.lineTo(x - 6, y - 1); ctx.closePath(); ctx.fill();
  }
  function hud(ctx, g, P, K, S, opts) {
    ctx.fillStyle = P.hud; ctx.fillRect(0, 0, K.W, K.HUD);
    ctx.fillStyle = P.hudLine; ctx.fillRect(0, K.HUD - 2, K.W, 2);
    var up = function (s) { return P.retro ? String(s).toUpperCase() : s; };
    g.text(String(S.score), 12, 22, { size: 16, color: P.accent, weight: 900 });
    var best = opts.best || 0; if (best) g.text(up(g.t('best')) + ' ' + Math.max(best, S.score), 12 + Math.max(60, String(S.score).length * 11 + 14), 21, { size: 10, color: P.muted, weight: 700 });
    var name = S.mode === 'endless' ? g.t('endless') + ' · ' + g.t('wall') + ' ' + S.level : S.level + '/30 · ' + g.t('lv' + S.level);
    g.text(up(name), K.W / 2, 21, { size: P.retro ? 12 : 13, align: 'center', color: P.ink, weight: 800 });
    for (var i = 0; i < Math.min(6, Math.max(3, S.lives)); i++) lifeIcon(ctx, P, K.W - 18 - i * 22, 16, i < S.lives);
    // активные эффекты — под рамкой сверху
    var fx = ['L', 'C', 'F', 'W', 'Q', 'H'], x = K.FX0 + 6;
    fx.forEach(function (k) {
      var v = S.fx[k]; if (!(v > 0)) return;
      var col = P.retro ? PRIZE_RCOL[k] : PRIZE_COL[k], f = v / R.logic.DUR[k];
      if (P.retro) { ctx.fillStyle = col; ctx.fillRect(x, K.HUD + 3, Math.max(2, Math.round(48 * f)), 3); }
      else { ctx.fillStyle = 'rgba(0,0,0,.35)'; rr(ctx, x, K.HUD + 3, 50, 4, 2); ctx.fill(); ctx.fillStyle = col; rr(ctx, x, K.HUD + 3, Math.max(4, 50 * f), 4, 2); ctx.fill(); }
      g.text(up(g.t('p_' + k)), x, K.HUD + 15, { size: 8, color: col, weight: 800 });
      x += 64;
    });
  }

  // ---------- главный рисунок ----------
  function draw(ctx, g, S, opts) {
    opts = opts || {};
    var P = g.themeName === 'retro' ? PR : PM, K = R.logic.K, t = g.time, i;
    ctx.drawImage(fieldBg(P, K), 0, 0);
    // блоки
    for (i = 0; i < S.bricks.length; i++) {
      var b = S.bricks[i];
      if (!b.alive) {
        if (b.type === 'r' && b.regenT > 0 && b.regenT < 2) {   // отрастающая руда — контур
          ctx.globalAlpha = 0.25 + 0.2 * Math.sin(t * 10); ctx.strokeStyle = P.retro ? '#00aa00' : '#5fe07c'; ctx.lineWidth = 1; ctx.strokeRect(b.x + 1.5, b.y + 1.5, b.w - 3, b.h - 3); ctx.globalAlpha = 1;
        }
        continue;
      }
      var bx = b.x, by = b.y;
      ctx.drawImage(brickSprite(b, P), Math.round(bx), by);
      if (b.type === 'r' && !P.retro) { ctx.fillStyle = 'rgba(180,255,190,' + (0.08 + 0.08 * Math.sin(t * 3 + b.c)) + ')'; ctx.fillRect(bx + 1, by + 1, b.w - 2, b.h - 2); }
      if (b.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + Math.min(0.7, b.flash * 5) + ')'; ctx.fillRect(bx + 1, by + 1, b.w - 2, b.h - 2); }
    }
    // босс и его залпы
    if (S.boss) {
      var B = S.boss;
      boss(ctx, P, K, B, t);
      if (!B.dead) {
        var hw = B.w, hx = B.x, hy = B.y - 9;
        ctx.fillStyle = P.retro ? '#555555' : 'rgba(0,0,0,.55)'; ctx.fillRect(hx, hy, hw, 4);
        ctx.fillStyle = P.retro ? '#ff5555' : '#ff5e1a'; ctx.fillRect(hx, hy, hw * B.hp / B.maxHp, 4);
      }
    }
    for (i = 0; i < S.beams.length; i++) {
      var bm = S.beams[i];
      if (bm.warn > 0) { ctx.fillStyle = P.retro ? (Math.floor(t * 12) % 2 ? '#ff5555' : '#000') : 'rgba(255,80,40,' + (0.15 + 0.15 * Math.sin(t * 30)) + ')'; ctx.fillRect(bm.x - 2, K.FY0, 4, K.H - K.FY0); }
      else { var bg = P.retro ? '#ffff55' : 'rgba(255,200,90,.9)'; ctx.fillStyle = bg; ctx.fillRect(bm.x - bm.w / 2, S.boss ? S.boss.y + S.boss.h : K.FY0, bm.w, K.H); if (!P.retro) { ctx.fillStyle = 'rgba(255,255,240,.95)'; ctx.fillRect(bm.x - 3, S.boss ? S.boss.y + S.boss.h : K.FY0, 6, K.H); } }
    }
    for (i = 0; i < S.shots.length; i++) {
      var s = S.shots[i];
      if (P.retro) { ctx.fillStyle = Math.floor(t * 16) % 2 ? '#ff5555' : '#ffff55'; ctx.fillRect(Math.round(s.x - 3), Math.round(s.y - 3), 6, 6); }
      else { var sg = ctx.createRadialGradient(s.x, s.y, 0.5, s.x, s.y, 9); sg.addColorStop(0, '#fff2c0'); sg.addColorStop(0.35, '#ff6a2a'); sg.addColorStop(1, 'rgba(255,60,20,0)'); ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(s.x, s.y, 9, 0, 6.3); ctx.fill(); }
    }
    // барьер
    if (S.fx.H > 0) {
      var blink = S.fx.H < 2 && Math.floor(t * 8) % 2;
      if (!blink) { if (P.retro) { ctx.fillStyle = '#ff55ff'; ctx.fillRect(K.FX0, K.BAR_Y, K.FX1 - K.FX0, 3); } else { ctx.fillStyle = 'rgba(169,140,255,.25)'; ctx.fillRect(K.FX0, K.BAR_Y - 2, K.FX1 - K.FX0, 7); ctx.fillStyle = '#c9b8ff'; ctx.fillRect(K.FX0, K.BAR_Y, K.FX1 - K.FX0, 2); } }
    }
    // призы
    for (i = 0; i < S.prizes.length; i++) {
      var pz = S.prizes[i], w = K.CAP_W, h = K.CAP_H, px = pz.x - w / 2, py = pz.y - h / 2;
      if (P.retro) {
        ctx.fillStyle = PRIZE_RCOL[pz.k]; ctx.fillRect(Math.round(px), Math.round(py), w, h); ctx.fillStyle = '#000'; ctx.fillRect(Math.round(px) + 2, Math.round(py) + 2, w - 4, h - 4);
        g.text(pz.k, pz.x, py + h - 2.5, { size: 10, align: 'center', color: PRIZE_RCOL[pz.k], weight: 900 });
      } else {
        var pg = ctx.createLinearGradient(0, py, 0, py + h); pg.addColorStop(0, '#ffffff'); pg.addColorStop(0.25, PRIZE_COL[pz.k]); pg.addColorStop(1, '#1a1210');
        ctx.fillStyle = pg; rr(ctx, px, py, w, h, h / 2); ctx.fill();
        ctx.strokeStyle = pz.bad ? '#ff5d5d' : 'rgba(255,255,255,.6)'; ctx.lineWidth = 1; rr(ctx, px + 0.5, py + 0.5, w - 1, h - 1, h / 2); ctx.stroke();
        g.text(PRIZE_GLYPH[pz.k], pz.x, py + h - 2.5, { size: 10, align: 'center', color: '#120c0a', weight: 900 });
      }
    }
    // лазерные заряды
    for (i = 0; i < S.bolts.length; i++) { var z = S.bolts[i]; ctx.fillStyle = P.retro ? '#ff5555' : '#ff8090'; ctx.fillRect(Math.round(z.x - 1.5), Math.round(z.y - 8), 3, 10); if (!P.retro) { ctx.fillStyle = 'rgba(255,90,110,.3)'; ctx.fillRect(z.x - 3.5, z.y - 10, 7, 14); } }
    paddle(ctx, P, K, S, t, opts);
    for (i = 0; i < S.balls.length; i++) ball(ctx, P, K, S.balls[i], S, t);
    if (P.retro) { ctx.fillStyle = 'rgba(0,0,0,.18)'; for (var y = 0; y < K.H; y += 3) ctx.fillRect(0, y, K.W, 1); }
    hud(ctx, g, P, K, S, opts);
  }

  R.render = { draw: draw, PM: PM, PR: PR, rr: rr, PRIZE_COL: PRIZE_COL, PRIZE_RCOL: PRIZE_RCOL, brickSprite: brickSprite, paddle: paddle, ball: ball, boss: boss, lifeIcon: lifeIcon };
})(typeof window !== 'undefined' ? window : globalThis);
