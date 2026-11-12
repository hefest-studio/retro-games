/* СТАРАТЕЛЬ · modern-рендер — современная векторная графика (градиенты, мягкое свечение),
   рисует то же состояние S, что и retro (js/mine-retro.js). Логика не затрагивается.
   STARATEL.modern.draw(ctx, S, th) — th: палитра темы движка (g.th()). */
(function (global) {
  'use strict';
  var NS = global.STARATEL = global.STARATEL || {};
  var T = NS.T;

  function rr(x, px, py, w, h, r) {
    x.beginPath(); x.moveTo(px + r, py); x.arcTo(px + w, py, px + w, py + h, r); x.arcTo(px + w, py + h, px, py + h, r);
    x.arcTo(px, py + h, px, py, r); x.arcTo(px, py, px + w, py, r); x.closePath();
  }
  function hash(a, b) { var s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); }

  function wall(x, px, py, TS) {
    x.fillStyle = '#1b2030'; rr(x, px + 1, py + 1, TS - 2, TS - 2, 5); x.fill();
    x.fillStyle = '#252b3e'; rr(x, px + 3, py + 3, TS - 6, TS - 8, 4); x.fill();
    x.fillStyle = 'rgba(255,255,255,.06)'; x.fillRect(px + 6, py + 5, TS - 12, 2);
  }
  function dirt(x, px, py, TS, gx, gy) {
    var g = x.createLinearGradient(px, py, px, py + TS); g.addColorStop(0, '#3a3226'); g.addColorStop(1, '#2c261d');
    x.fillStyle = g; rr(x, px + 1, py + 1, TS - 2, TS - 2, 6); x.fill();
    x.fillStyle = 'rgba(255,220,160,.10)';
    for (var i = 0; i < 3; i++) { var a = hash(gx * 3 + i, gy), b = hash(gy * 5 + i, gx); x.beginPath(); x.arc(px + 6 + a * (TS - 12), py + 6 + b * (TS - 12), 1.4, 0, 7); x.fill(); }
  }
  function boulder(x, cx, cy, r) {
    x.fillStyle = 'rgba(0,0,0,.35)'; x.beginPath(); x.ellipse(cx + 2, cy + r - 1, r * 0.85, r * 0.3, 0, 0, 7); x.fill();
    var g = x.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
    g.addColorStop(0, '#c9ced8'); g.addColorStop(0.45, '#8a91a0'); g.addColorStop(1, '#4b5161');
    x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill();
    x.strokeStyle = 'rgba(30,34,46,.55)'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(cx - r * 0.2, cy + r * 0.1); x.lineTo(cx + r * 0.25, cy + r * 0.45); x.stroke();
  }
  function gold(x, cx, cy, t) {
    x.save(); x.shadowColor = 'rgba(255,190,60,.75)'; x.shadowBlur = 10;
    var g = x.createRadialGradient(cx - 3, cy - 3, 1, cx, cy, 9); g.addColorStop(0, '#fff3c4'); g.addColorStop(0.5, '#ffc93c'); g.addColorStop(1, '#d48a12');
    x.fillStyle = g; x.beginPath(); x.arc(cx, cy, 8.5, 0, 7); x.fill(); x.restore();
    x.strokeStyle = 'rgba(140,80,0,.6)'; x.lineWidth = 1.4; x.beginPath(); x.arc(cx, cy, 5.2, 0, 7); x.stroke();
    var s = (Math.sin(t / 300 + cx) + 1) / 2; x.fillStyle = 'rgba(255,255,255,' + (0.35 + s * 0.5) + ')'; x.fillRect(cx - 4, cy - 5, 2, 2);
  }
  function gem(x, cx, cy, t) {
    x.save(); x.shadowColor = 'rgba(90,230,255,.8)'; x.shadowBlur = 12;
    var g = x.createLinearGradient(cx, cy - 10, cx, cy + 10); g.addColorStop(0, '#d9fbff'); g.addColorStop(0.5, '#4fd6f0'); g.addColorStop(1, '#2475c9');
    x.fillStyle = g; x.beginPath(); x.moveTo(cx, cy - 10); x.lineTo(cx + 8, cy - 2); x.lineTo(cx, cy + 10); x.lineTo(cx - 8, cy - 2); x.closePath(); x.fill(); x.restore();
    x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 1; x.beginPath(); x.moveTo(cx - 8, cy - 2); x.lineTo(cx + 8, cy - 2); x.moveTo(cx, cy - 10); x.lineTo(cx - 3, cy - 2); x.lineTo(cx, cy + 10); x.stroke();
    var s = (Math.sin(t / 220 + cy) + 1) / 2; x.fillStyle = 'rgba(255,255,255,' + s + ')'; x.fillRect(cx + 2, cy - 6, 2, 2);
  }
  function exitTile(x, px, py, TS, open, t, th) {
    var cx = px + TS / 2, cy = py + TS / 2;
    if (open) {
      var p = 0.6 + 0.4 * Math.sin(t / 160);
      x.save(); x.shadowColor = th.good; x.shadowBlur = 16 * p;
      x.fillStyle = '#0f2a1d'; rr(x, px + 3, py + 3, TS - 6, TS - 6, 7); x.fill();
      x.strokeStyle = th.good; x.lineWidth = 2.5; rr(x, px + 4, py + 4, TS - 8, TS - 8, 6); x.stroke(); x.restore();
      x.fillStyle = 'rgba(55,214,122,' + (0.25 + 0.35 * p) + ')'; rr(x, px + 8, py + 8, TS - 16, TS - 16, 4); x.fill();
      x.fillStyle = '#eafff2'; x.beginPath(); x.moveTo(cx - 4, cy - 5); x.lineTo(cx + 5, cy); x.lineTo(cx - 4, cy + 5); x.closePath(); x.fill();
    } else {
      x.fillStyle = '#1a1e2b'; rr(x, px + 3, py + 3, TS - 6, TS - 6, 7); x.fill();
      x.strokeStyle = '#3a4258'; x.lineWidth = 2; rr(x, px + 4, py + 4, TS - 8, TS - 8, 6); x.stroke();
      x.strokeStyle = '#5b6680'; x.lineWidth = 2; x.beginPath(); x.arc(cx, cy - 2, 4, Math.PI, 0); x.stroke();
      x.fillStyle = '#5b6680'; rr(x, cx - 6, cy - 2, 12, 9, 2); x.fill();
    }
  }
  function golem(x, cx, cy, t, i, th) {
    var b = Math.sin(t / 200 + i) * 1.2;
    x.fillStyle = 'rgba(0,0,0,.35)'; x.beginPath(); x.ellipse(cx, cy + 12, 10, 3, 0, 0, 7); x.fill();
    var g = x.createLinearGradient(cx, cy - 12, cx, cy + 12); g.addColorStop(0, '#8c6f9e'); g.addColorStop(1, '#4a3657');
    x.fillStyle = g; rr(x, cx - 11, cy - 11 + b, 22, 22, 8); x.fill();
    x.fillStyle = '#5d4570'; rr(x, cx - 14, cy - 2 + b, 5, 10, 2); x.fill(); rr(x, cx + 9, cy - 2 + b, 5, 10, 2); x.fill();
    x.save(); x.shadowColor = th.bad; x.shadowBlur = 8; x.fillStyle = th.bad;
    x.fillRect(cx - 6, cy - 4 + b, 4, 3); x.fillRect(cx + 2, cy - 4 + b, 4, 3); x.restore();
    x.fillStyle = 'rgba(255,255,255,.12)'; x.fillRect(cx - 8, cy - 9 + b, 16, 2);
  }
  function miner(x, cx, cy, t, th) {
    x.fillStyle = 'rgba(0,0,0,.35)'; x.beginPath(); x.ellipse(cx, cy + 12, 9, 3, 0, 0, 7); x.fill();
    // туловище
    var g = x.createLinearGradient(cx, cy - 2, cx, cy + 12); g.addColorStop(0, '#3d7cff'); g.addColorStop(1, '#2350b8');
    x.fillStyle = g; rr(x, cx - 8, cy - 1, 16, 13, 5); x.fill();
    // лицо
    x.fillStyle = '#f2c9a0'; x.beginPath(); x.arc(cx, cy - 4, 7, 0, 7); x.fill();
    x.fillStyle = '#1b1f2a'; x.fillRect(cx - 4, cy - 5, 2, 3); x.fillRect(cx + 2, cy - 5, 2, 3);
    // каска с фонарём
    x.fillStyle = th.warn; x.beginPath(); x.arc(cx, cy - 7, 8, Math.PI, 0); x.fill(); x.fillRect(cx - 9, cy - 8, 18, 3);
    x.save(); x.shadowColor = '#fff6c8'; x.shadowBlur = 12; x.fillStyle = '#fffbe6'; x.beginPath(); x.arc(cx, cy - 11, 2.6, 0, 7); x.fill(); x.restore();
  }

  function draw(x, S, th) {
    if (!S.grid) return;
    var N = T.N, TS = T.TS, grid = S.grid, t = Date.now();
    var sx = S.shake ? (Math.random() * 2 - 1) * S.shake : 0, sy = S.shake ? (Math.random() * 2 - 1) * S.shake : 0;
    x.save(); x.translate(sx, sy);
    var bg = x.createLinearGradient(0, 0, 0, N * TS); bg.addColorStop(0, '#10131c'); bg.addColorStop(1, '#0b0d14');
    x.fillStyle = bg; x.fillRect(-10, -10, N * TS + 20, N * TS + 20);
    var open = S.got >= S.need, y, xx, tt, px, py;
    // фон тоннелей: тонкая сетка
    x.strokeStyle = 'rgba(79,140,255,.05)'; x.lineWidth = 1;
    for (y = 0; y < N; y++) for (xx = 0; xx < N; xx++) {
      tt = grid[y][xx]; px = xx * TS; py = y * TS;
      if (tt === T.WALL) wall(x, px, py, TS);
      else if (tt === T.DIRT) dirt(x, px, py, TS, xx, y);
      else x.strokeRect(px + 0.5, py + 0.5, TS - 1, TS - 1);
    }
    for (y = 0; y < N; y++) for (xx = 0; xx < N; xx++) {
      tt = grid[y][xx]; px = xx * TS; py = y * TS;
      if (tt === T.BOULDER) boulder(x, px + TS / 2, py + TS / 2, TS / 2 - 3);
      else if (tt === T.EXIT) exitTile(x, px, py, TS, open, t, th);
      else if (tt === T.GOLD) gold(x, px + TS / 2, py + TS / 2, t);
      else if (tt === T.GEM) gem(x, px + TS / 2, py + TS / 2, t);
    }
    for (var i = 0; i < S.enemies.length; i++) golem(x, S.enemies[i].gx * TS + TS / 2, S.enemies[i].gy * TS + TS / 2, t, i, th);
    x.globalAlpha = S.inv > 0 && Math.floor(t / 90) % 2 ? 0.4 : 1;
    miner(x, S.player.gx * TS + TS / 2, S.player.gy * TS + TS / 2, t, th); x.globalAlpha = 1;
    S.player.bob = 0;
    if (S.flash > 0) { x.fillStyle = 'rgba(120,200,255,' + (S.flash * 0.4) + ')'; x.fillRect(-10, -10, N * TS + 20, N * TS + 20); }
    x.restore();
  }

  NS.modern = { draw: draw };
})(typeof window !== 'undefined' ? window : globalThis);
