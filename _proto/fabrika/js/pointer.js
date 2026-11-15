/* ЛЕНТОВОД · js/pointer.js — мышь и тач для canvas (без знания об игре). Координаты — в пикселях canvas.
   const p = FabPointer.attach(canvas, {
     enabled()                 → bool, когда слушать
     onDown(p, info)           → 'capture' — забрать жест (кнопки панели): дальше только onUp(p0, p, false, info)
     onDrag(p0, p, info)       — ЛКМ / один палец тянется (после порога); info.prev — предыдущая точка
     onUp(p0, p, moved, info)  — ЛКМ / палец отпущен (moved — была протяжка)
     onRight(p0, p, phase)     — ПКМ: phase 'down' | 'drag' | 'up'
     onPan(dx, dy)             — средняя кнопка или два пальца
     onZoom(k, p)              — колесо или щипок (k > 1 — приблизить), p — точка-якорь
     onHover(p)                — мышь без кнопок
     onCancel()                — жест сорван (второй палец, потеря указателя)
   });
   info = { touch, shift, ctrl }; p.pos — последняя позиция мыши, p.inside, p.cancel(), p.detach(). Canvas: touch-action:none. */
(function (root) {
  'use strict';
  function attach(cv, o) {
    o = o || {};
    var TH = o.threshold || 5, m = { pos: { x: -1, y: -1 }, inside: false, kind: 'mouse' };
    var down = null, right = null, mid = null, touches = Object.create(null), nT = 0, pinch = null;
    function en() { return !o.enabled || o.enabled(); }
    function call(fn) { return typeof fn === 'function' ? fn.apply(null, Array.prototype.slice.call(arguments, 1)) : undefined; }
    function pt(e) { var r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * cv.width / r.width, y: (e.clientY - r.top) * cv.height / r.height }; }
    function isT(e) { return e.pointerType === 'touch' || e.pointerType === 'pen'; }
    function pinchState() { var a = [], k; for (k in touches) a.push(touches[k]); if (a.length < 2) return null; return { x: (a[0].x + a[1].x) / 2, y: (a[0].y + a[1].y) / 2, d: Math.max(10, Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y)) }; }
    function onDown(e) {
      if (!en()) return; var p = pt(e), t = isT(e); m.kind = e.pointerType || 'mouse';
      if (t) {
        touches[e.pointerId] = p; nT++;
        if (nT >= 2) { if (down) { down = null; call(o.onCancel); } pinch = pinchState(); e.preventDefault(); return; }
      }
      try { cv.setPointerCapture(e.pointerId); } catch (x) {}
      var info = { touch: t, shift: !!e.shiftKey, ctrl: !!(e.ctrlKey || e.metaKey) };
      if (!t && e.button === 1) { mid = { id: e.pointerId, p: p }; e.preventDefault(); return; }
      if (!t && e.button === 2) { right = { id: e.pointerId, p0: p }; call(o.onRight, p, p, 'down'); e.preventDefault(); return; }
      if (!t && e.button !== 0) return;
      down = { id: e.pointerId, p0: p, prev: p, moved: false, info: info, cap: false };
      if (call(o.onDown, p, info) === 'capture') down.cap = true;
      e.preventDefault();
    }
    function onMove(e) {
      var p = pt(e), t = isT(e);
      if (!t) { m.pos = p; m.inside = true; }
      if (!en()) return;
      if (t && touches[e.pointerId]) {
        touches[e.pointerId] = p;
        if (nT >= 2 && pinch) { var s = pinchState(); if (s) { call(o.onPan, pinch.x - s.x, pinch.y - s.y); if (Math.abs(s.d / pinch.d - 1) > 0.002) call(o.onZoom, s.d / pinch.d, s); pinch = s; } return; }
      }
      if (mid && e.pointerId === mid.id) { call(o.onPan, mid.p.x - p.x, mid.p.y - p.y); mid.p = p; return; }
      if (right && e.pointerId === right.id) { call(o.onRight, right.p0, p, 'drag'); return; }
      if (down && e.pointerId === down.id) {
        if (down.cap) return;
        if (!down.moved && Math.hypot(p.x - down.p0.x, p.y - down.p0.y) > (down.info.touch ? TH * 2 : TH)) down.moved = true;
        if (down.moved) { down.info.prev = down.prev; call(o.onDrag, down.p0, p, down.info); }
        down.prev = p; return;
      }
      if (!t && !down && !right && !mid) call(o.onHover, p);
    }
    function onUp(e) {
      var p = pt(e), t = isT(e);
      if (t && touches[e.pointerId]) { delete touches[e.pointerId]; nT = Math.max(0, nT - 1); pinch = nT >= 2 ? pinchState() : null; }
      try { cv.releasePointerCapture(e.pointerId); } catch (x) {}
      if (mid && e.pointerId === mid.id) { mid = null; return; }
      if (right && e.pointerId === right.id) { var r = right; right = null; if (en()) call(o.onRight, r.p0, p, 'up'); return; }
      if (!down || e.pointerId !== down.id) return;
      var d = down; down = null;
      if (!en() || e.type === 'pointercancel') { call(o.onCancel); return; }
      call(o.onUp, d.p0, p, d.moved, d.info);
    }
    function onWheel(e) { if (!en()) return; e.preventDefault(); var k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1; call(o.onZoom, Math.exp(-e.deltaY * k * 0.0015), pt(e)); }
    function onCtx(e) { e.preventDefault(); }
    function onLeave(e) { if (!isT(e)) m.inside = false; }
    function onAux(e) { if (e.button === 1) e.preventDefault(); }
    var L = [['pointerdown', onDown], ['pointermove', onMove], ['pointerup', onUp], ['pointercancel', onUp], ['pointerleave', onLeave],
      ['contextmenu', onCtx], ['mousedown', onAux], ['auxclick', onAux]];
    L.forEach(function (l) { cv.addEventListener(l[0], l[1]); });
    cv.addEventListener('wheel', onWheel, { passive: false });
    m.cancel = function () { down = null; right = null; mid = null; };
    m.dragging = function () { return !!(down && down.moved && !down.cap); };
    m.detach = function () { L.forEach(function (l) { cv.removeEventListener(l[0], l[1]); }); cv.removeEventListener('wheel', onWheel); };
    return m;
  }
  root.FabPointer = { attach: attach, version: '0.1.0' };
})(typeof window !== 'undefined' ? window : globalThis);
