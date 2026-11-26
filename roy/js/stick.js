/* Виртуальный стик для телефона (тач-схема площадок, волна 6, 22.11.2026). Одинаковая копия в играх волны 6
   (otsek, paroviki, nalyot, druzhina, shustrik, lazutchik): палец ставится в любом месте зоны — там появляется центр стика («плавающий»),
   отклонение до radius px даёт x, y ∈ [−1, 1] с мёртвой зоной 0,22; отпускание — 0, 0. Мышью не управляется
   (только pointerType touch/pen), чтобы на десктопе ничего не мешало.
   ArcadeStick.create(zoneEl, { radius, onChange(x, y), onFlick(dx, dy) }) → { x, y, active, dir(th) → {left,right,up,down}, reset() };
   onFlick — рывок в сторону (для меню/лавки внутри игры: шаг выбора). */
(function (global) {
  'use strict';
  function create(zone, o) {
    o = o || {};
    var R = o.radius || 46, DZ = 0.22, st = { x: 0, y: 0, active: false }, id = null, ox = 0, oy = 0, flick = { x: 0, y: 0 };
    if (!zone) return Object.assign(st, { dir: function () { return {}; }, reset: function () {} });
    var base = document.createElement('i'), knob = document.createElement('b');
    base.className = 'stick-base'; knob.className = 'stick-knob'; zone.appendChild(base); zone.appendChild(knob);
    function show(on) { base.style.opacity = knob.style.opacity = on ? '1' : ''; }
    function place(el, x, y) { el.style.left = x + 'px'; el.style.top = y + 'px'; }
    function centre() { var r = zone.getBoundingClientRect(); place(base, r.width / 2, r.height / 2); place(knob, r.width / 2, r.height / 2); }
    function set(x, y) {
      var l = Math.hypot(x, y); if (l < DZ) { x = 0; y = 0; } else if (l > 1) { x /= l; y /= l; }
      st.x = x; st.y = y; if (o.onChange) o.onChange(x, y);
      var fx = Math.abs(x) > 0.6 ? Math.sign(x) : 0, fy = Math.abs(y) > 0.6 ? Math.sign(y) : 0;
      if (o.onFlick && (fx !== flick.x || fy !== flick.y)) { if (fx && fx !== flick.x) o.onFlick(fx, 0); if (fy && fy !== flick.y) o.onFlick(0, fy); }
      flick = { x: fx, y: fy };
    }
    function down(e) {
      if (e.pointerType === 'mouse' || id != null) return;
      e.preventDefault(); id = e.pointerId; try { zone.setPointerCapture(id); } catch (er) {}
      var r = zone.getBoundingClientRect(); ox = e.clientX - r.left; oy = e.clientY - r.top;
      place(base, ox, oy); place(knob, ox, oy); show(true); st.active = true; set(0, 0);
    }
    function move(e) {
      if (e.pointerId !== id) return; e.preventDefault();
      var r = zone.getBoundingClientRect(), dx = e.clientX - r.left - ox, dy = e.clientY - r.top - oy, l = Math.hypot(dx, dy);
      if (l > R) { dx *= R / l; dy *= R / l; }
      place(knob, ox + dx, oy + dy); set(dx / R, dy / R);
    }
    function up(e) { if (e.pointerId !== id) return; e.preventDefault(); id = null; st.active = false; show(false); centre(); set(0, 0); }
    zone.addEventListener('pointerdown', down); zone.addEventListener('pointermove', move);
    zone.addEventListener('pointerup', up); zone.addEventListener('pointercancel', up); zone.addEventListener('lostpointercapture', up);
    addEventListener('blur', function () { if (id != null) { id = null; st.active = false; show(false); set(0, 0); } });
    addEventListener('resize', centre); setTimeout(centre, 0);
    st.dir = function (th) { th = th || 0.38; return { left: st.x < -th, right: st.x > th, up: st.y < -th, down: st.y > th }; };
    st.reset = function () { id = null; st.active = false; show(false); centre(); set(0, 0); };
    return st;
  }
  global.ArcadeStick = { create: create };
})(typeof window !== 'undefined' ? window : globalThis);
