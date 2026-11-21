/* Гефест Arcade · _shared/campaign-ui-kit.js — общие элементы экранов кампании (v1.0). Источник — _shared/campaign-ui-kit.js
   (копия в игре — js/campaign-ui-kit.js, её обновляет build.sh по этой метке; руками копии не править).
   Только то, что у стратегий студии совпадает дословно; палитры, шрифты, кнопки и пиктограммы — у каждой игры свои.
   - wrap(c, s, maxW, size, weight, font) — перенос строки по словам под ширину (ставит c.font);
   - fmtTime(s, clamp) — «мм:сс» (clamp — отрицательное → 00:00);
   - starPath(c, x, y, r) — контур пятиконечной звезды (залить/обвести — игре);
   - hitAt(list, p) — индекс кнопки { x, y, w, h } под точкой (последняя нарисованная — сверху), −1 — мимо;
   - canvasPoint(canvas, e, W, H) — точка события в логических координатах canvas W×H;
   - bindHot(canvas, o) — кнопки экранов мышью/тачем: o = { active(), list(), size() → { w, h }, press(i, b, e), hover(i) };
     курсор «рука» над кнопкой. Возвращает функцию отписки.
   Экспорт: global.HefestCampaignUI. */
(function (global) {
  'use strict';
  var U = { version: '1.0' };
  U.wrap = function (c, s, maxW, size, weight, font) {
    c.font = (weight || 600) + ' ' + size + 'px ' + font; var out = [], line = '';
    String(s).split(' ').forEach(function (w) { var t = line ? line + ' ' + w : w; if (c.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; });
    if (line) out.push(line); return out;
  };
  U.fmtTime = function (s, clamp) { s = Math.round(s || 0); if (clamp) s = Math.max(0, s); var m = Math.floor(s / 60), r = s % 60; return (m < 10 ? '0' : '') + m + ':' + (r < 10 ? '0' : '') + r; };
  U.starPath = function (c, x, y, r) { c.beginPath(); for (var k = 0; k < 10; k++) { var a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.closePath(); };
  U.hitAt = function (list, p) { for (var i = list.length - 1; i >= 0; i--) { var b = list[i]; if (p.x >= b.x && p.x < b.x + b.w && p.y >= b.y && p.y < b.y + b.h) return i; } return -1; };
  U.canvasPoint = function (canvas, e, W, H) { var r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height }; };
  U.bindHot = function (canvas, o) {
    var pt = function (e) { var s = o.size(); return U.canvasPoint(canvas, e, s.w, s.h); };
    var down = function (e) { if (!o.active()) return; var l = o.list(), i = U.hitAt(l, pt(e)); if (i >= 0) { e.preventDefault(); o.press(i, l[i], e); } };
    var move = function (e) { if (!o.active()) return; var i = U.hitAt(o.list(), pt(e)); if (o.hover) o.hover(i); canvas.style.cursor = i >= 0 ? 'pointer' : 'default'; };
    canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move);
    return function () { canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move); };
  };
  global.HefestCampaignUI = U;
})(typeof window !== 'undefined' ? window : globalThis);
