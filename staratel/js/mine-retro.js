/* СТАРАТЕЛЬ · retro-рендер (8-бит / пиксель-арт) — функция draw() прежней страницы (legacy.html)
   без изменений по виду: тайлы породы/стен, валуны, выход, PNG-спрайты (золото, кристалл, голем, шахтёр).
   STARATEL.retro.draw(ctx, S, img) — img: загруженные спрайты {player,gold,gem,enemy}. */
(function (global) {
  'use strict';
  var NS = global.STARATEL = global.STARATEL || {};
  var T = NS.T;

  function draw(x, S, IMG) {
    if (!S.grid) return;
    var N = T.N, TS = T.TS, grid = S.grid;
    function cx(px) { return px + TS / 2; }
    function put(im, gx, gy, s) { var d = s || TS - 6, o = (TS - d) / 2; x.drawImage(im, gx * TS + o, gy * TS + o, d, d); }
    function roundRock(px, py) {
      var c1 = px + TS / 2, c2 = py + TS / 2, r = TS / 2 - 3;
      x.fillStyle = '#6b655d'; x.beginPath(); x.arc(c1, c2, r, 0, 7); x.fill();
      x.fillStyle = '#8c857a'; x.beginPath(); x.arc(c1 - 3, c2 - 4, r * 0.5, 0, 7); x.fill();
      x.fillStyle = '#48433c'; x.beginPath(); x.arc(c1 + 4, c2 + 5, r * 0.32, 0, 7); x.fill();
    }
    var sx = S.shake ? (Math.random() * 2 - 1) * S.shake : 0, sy = S.shake ? (Math.random() * 2 - 1) * S.shake : 0;
    x.save(); x.translate(sx, sy);
    x.fillStyle = '#17111c'; x.fillRect(-10, -10, 500, 500);
    var open = S.got >= S.need;
    for (var y = 0; y < N; y++) for (var xx = 0; xx < N; xx++) {
      var t = grid[y][xx], px = xx * TS, py = y * TS;
      if (t === T.WALL) { x.fillStyle = '#2b2230'; x.fillRect(px, py, TS, TS); x.fillStyle = '#201926'; x.fillRect(px + 2, py + 2, TS - 4, TS - 4); }
      else if (t === T.DIRT) { x.fillStyle = '#3a2a1e'; x.fillRect(px, py, TS, TS); x.fillStyle = '#44321f'; x.fillRect(px + 3, py + 3, TS - 6, TS - 6); }
      else { x.fillStyle = '#140f18'; x.fillRect(px, py, TS, TS); }
      if (t === T.BOULDER) roundRock(px, py);
      else if (t === T.EXIT) {
        if (open) {
          var gl = 0.6 + 0.4 * Math.sin(Date.now() / 160);
          x.fillStyle = '#5a2a08'; x.fillRect(px + 3, py + 3, TS - 6, TS - 6);
          x.fillStyle = 'rgba(234,106,18,' + gl + ')'; x.fillRect(px + 6, py + 5, TS - 12, TS - 9);
          x.fillStyle = '#ffd15e'; x.font = 'bold 15px Inter'; x.textAlign = 'center'; x.fillText('▣', cx(px), py + TS - 9);
        } else {
          x.fillStyle = '#241a15'; x.fillRect(px + 3, py + 3, TS - 6, TS - 6); x.fillStyle = '#3a2d22'; x.fillRect(px + 6, py + 6, TS - 12, TS - 12);
          x.fillStyle = '#6b5d4e'; x.font = 'bold 14px Inter'; x.textAlign = 'center'; x.fillText('▣', cx(px), py + TS - 9);
        }
      }
      else if (t === T.GOLD && IMG.gold) put(IMG.gold, xx, y, TS - 10);
      else if (t === T.GEM && IMG.gem) put(IMG.gem, xx, y, TS - 10);
    }
    for (var i = 0; i < S.enemies.length; i++) if (IMG.enemy) put(IMG.enemy, S.enemies[i].gx, S.enemies[i].gy, TS - 4);
    if (IMG.player) { x.globalAlpha = S.inv > 0 && Math.floor(Date.now() / 90) % 2 ? 0.4 : 1; put(IMG.player, S.player.gx, S.player.gy, TS - 4); x.globalAlpha = 1; }
    S.player.bob = 0;
    if (S.flash > 0) { x.fillStyle = 'rgba(255,209,94,' + (S.flash * 0.5) + ')'; x.fillRect(-10, -10, 500, 500); }
    x.restore();
  }

  NS.retro = { draw: draw };
})(typeof window !== 'undefined' ? window : globalThis);
