/* ВОЛОК · пиктограммы (вместо слов): HUD, маршрут и «пузыри»-подсказки над станциями.
   VOLOK.icons.draw(ctx, kind, x, y, P, t, scale) · VOLOK.icons.bubble(ctx, kind, x, y, P, t, retro) */
(function (global) {
  'use strict';
  var V = global.VOLOK = global.VOLOK || {};
  function tri(ctx, a, b, c, d, e, f) { ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.lineTo(e, f); ctx.closePath(); ctx.fill(); }
  var D = {
    flame: function (c, P) { c.fillStyle = '#f06a26'; c.beginPath(); c.moveTo(-6, 7); c.quadraticCurveTo(-8, -2, 0, -9); c.quadraticCurveTo(8, -2, 6, 7); c.fill(); c.fillStyle = '#ffd35a'; c.beginPath(); c.moveTo(-3, 7); c.quadraticCurveTo(-3, 1, 0, -3); c.quadraticCurveTo(3, 1, 3, 7); c.fill(); },
    hut: function (c, P) { c.fillStyle = P.woodL; c.fillRect(-7, -1, 14, 8); c.fillStyle = P.roof; tri(c, -9, 0, 0, -8, 9, 0); },
    log: function (c, P) { c.fillStyle = P.log; c.fillRect(-8, -3, 14, 7); c.fillStyle = P.woodL; c.beginPath(); c.arc(7, 0, 3.5, 0, 7); c.fill(); },
    air: function (c) { c.strokeStyle = '#bfe6f7'; c.lineWidth = 2; [[0, 0, 5], [-5, 5, 2.5], [6, -5, 2]].forEach(function (b) { c.beginPath(); c.arc(b[0], b[1], b[2], 0, 7); c.stroke(); }); },
    speed: function (c, P) { c.fillStyle = P.hudInk; tri(c, -8, -6, 0, 0, -8, 6); tri(c, 0, -6, 8, 0, 0, 6); },
    tree: function (c, P) { c.fillStyle = '#7f9a55'; tri(c, -6, 4, 0, -8, 6, 4); c.fillStyle = P.woodD; c.fillRect(-1, 4, 2, 4); },
    hill: function (c) { c.fillStyle = '#9a9a6a'; tri(c, -9, 6, -1, -7, 9, 6); },
    river: function (c) { c.strokeStyle = '#7cc0d8'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(-9, -2); c.quadraticCurveTo(-4, -6, 0, -2); c.quadraticCurveTo(4, 2, 9, -2); c.moveTo(-9, 4); c.quadraticCurveTo(-4, 0, 0, 4); c.quadraticCurveTo(4, 8, 9, 4); c.stroke(); },
    shore: function (c, P) { c.fillStyle = P.moss; tri(c, -9, 6, -9, -2, 2, 6); c.fillStyle = '#7cc0d8'; c.fillRect(0, 2, 9, 4); },
    wave: function (c) { c.strokeStyle = '#d8e8ee'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(-9, 4); c.quadraticCurveTo(-5, -6, 0, 0); c.quadraticCurveTo(4, 5, 9, -4); c.stroke(); },
    ice: function (c, P) { c.fillStyle = P.ice; c.fillRect(-9, -2, 8, 6); c.fillRect(1, -1, 8, 5); c.fillStyle = '#7cc0d8'; c.fillRect(-9, 4, 18, 3); },
    hatch: function (c, P) { c.fillStyle = P.plank; c.fillRect(-6, -8, 12, 16); c.fillStyle = P.hudInk; tri(c, -4, -2, 4, -2, 0, 4); },
    hand: function (c, P) { c.fillStyle = P.skin; c.fillRect(-5, -2, 10, 9); for (var i = 0; i < 4; i++) c.fillRect(-5 + i * 3, -8, 2, 7); c.fillStyle = P.log; c.fillRect(-7, 7, 14, 3); },
    steam: function (c) { c.fillStyle = 'rgba(245,245,245,.95)'; [[-4, 2, 5], [3, -2, 6], [0, -8, 4]].forEach(function (b) { c.beginPath(); c.arc(b[0], b[1], b[2], 0, 7); c.fill(); }); c.fillStyle = '#e2553a'; c.fillRect(-1, 6, 3, 3); },
    winch: function (c, P) { c.fillStyle = P.woodL; c.fillRect(-6, -5, 12, 10); c.fillStyle = P.rope; c.fillRect(-6, -2, 12, 4); c.strokeStyle = P.ironL; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, 9, -2.4, 0.6); c.stroke(); tri(c, 7, 2, 11, -2, 5, -4); },
    gauge: function (c, P) { c.fillStyle = '#f3ead5'; c.beginPath(); c.arc(0, 0, 8, 0, 7); c.fill(); c.strokeStyle = '#2a1d16'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, 0); c.lineTo(5, -5); c.stroke(); c.fillStyle = '#9fd36b'; tri(c, -3, -10, 3, -10, 0, -14); },
    hammer: function (c, P) { c.fillStyle = P.woodL; c.save(); c.rotate(-0.6); c.fillRect(-1.5, -4, 3, 14); c.fillStyle = P.ironL; c.fillRect(-6, -8, 12, 5); c.restore(); },
    patch: function (c, P) { c.fillStyle = P.copperL; c.fillRect(-7, -6, 14, 12); c.fillStyle = P.copperD; [[-5, -4], [3, -4], [-5, 2], [3, 2]].forEach(function (q) { c.fillRect(q[0], q[1], 2, 2); }); },
    down: function (c, P) { c.fillStyle = P.sail; c.fillRect(-7, -8, 14, 6); c.fillStyle = '#e2553a'; tri(c, -6, 0, 6, 0, 0, 8); },
    wind: function (c, P) { c.strokeStyle = '#9fd36b'; c.lineWidth = 2; c.beginPath(); c.moveTo(-9, -3); c.lineTo(5, -3); c.quadraticCurveTo(9, -3, 8, -7); c.moveTo(-9, 3); c.lineTo(7, 3); c.quadraticCurveTo(11, 3, 10, 7); c.stroke(); },
    dive: function (c, P) { c.fillStyle = '#7cc0d8'; c.fillRect(-9, -2, 18, 3); c.fillStyle = P.hudInk; tri(c, -5, 2, 5, 2, 0, 9); c.fillStyle = P.ice; c.fillRect(-9, -8, 18, 4); },
    stop: function (c, P) { c.fillStyle = '#e2553a'; c.fillRect(-6, -7, 4, 14); c.fillRect(2, -7, 4, 14); },
    bucket: function (c, P) { c.fillStyle = P.ironL; c.beginPath(); c.moveTo(-6, -4); c.lineTo(6, -4); c.lineTo(4, 7); c.lineTo(-4, 7); c.fill(); c.fillStyle = '#7cc0d8'; c.fillRect(-5, -4, 10, 3); c.strokeStyle = P.ironL; c.lineWidth = 1.5; c.beginPath(); c.arc(0, -4, 6, Math.PI, 0); c.stroke(); }
  };
  V.icons = {
    kinds: Object.keys(D),
    draw: function (ctx, kind, x, y, P, t, s) { var f = D[kind]; if (!f) return; ctx.save(); ctx.translate(x, y); ctx.scale(s || 1, s || 1); f(ctx, P, t); ctx.restore(); },
    bubble: function (ctx, kind, x, y, P, t, retro) {
      ctx.save(); ctx.fillStyle = 'rgba(250,240,220,.92)';
      if (retro) { ctx.fillRect(x - 14, y - 14, 28, 26); ctx.fillRect(x - 3, y + 12, 6, 5); }
      else { ctx.beginPath(); ctx.arc(x, y, 15, 0, 7); ctx.fill(); ctx.beginPath(); ctx.moveTo(x - 5, y + 12); ctx.lineTo(x, y + 21); ctx.lineTo(x + 5, y + 12); ctx.fill(); }
      ctx.fillStyle = 'rgba(40,28,18,.85)'; if (retro) ctx.fillRect(x - 12, y - 12, 24, 22); else { ctx.beginPath(); ctx.arc(x, y, 12.5, 0, 7); ctx.fill(); }
      this.draw(ctx, kind, x, y - 1, P, t, 1); ctx.restore();
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
