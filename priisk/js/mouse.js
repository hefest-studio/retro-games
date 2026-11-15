/* ArcadeMouse · js/mouse.js — модуль мыши и тача для canvas-игр (кандидат на вынос в _shared/).
   Не знает ничего об игре: переводит события указателя в координаты canvas и отдаёт жесты колбэкам.

   const m = ArcadeMouse.attach(canvas, {
     enabled()            → bool    — когда слушать (например, только в сцене play); иначе всё игнорируется
     onDown(p, info)      → 'capture' | undefined — нажатие ЛКМ/тап; 'capture' = забрать указатель себе (кнопки, мини-карта):
                                     дальше идут onDrag(p)/onUp(p), рамки и клика не будет
     onDrag(p, info), onUp(p, info)  — для захваченного указателя
     onClick(p, info)     — ЛКМ/тап без протяжки; info.dbl — двойной клик/тап (в пределах dblTime и dblDist)
     onBox(r, info)       — отпустили рамку; r = {x0,y0,x1,y1} в координатах canvas (нормализована)
     onBoxing(r|null)     — рамка тянется (для рисования) / исчезла
     onCommand(p, info)   — приказ: ПКМ (мышь) или долгий тап (тач)
     onPan(dx, dy)        — сдвиг камеры в пикселях canvas: средняя кнопка (перетаскивание) или два пальца
     onWheel(dx, dy)      — колесо (deltaY; с Shift — по горизонтали)
     onHover(p)           — движение мыши без кнопок
     dragThreshold: 6, longPress: 480, dblTime: 320, dblDist: 10, edge: 14,
     cursors: { kind: 'css-cursor' }   — словарь курсоров для setCursor(kind)
   });
   info = { shift, ctrl, alt, touch, dbl, button }.  p = { x, y } — координаты canvas (canvas.width × canvas.height).
   m.pos — последняя позиция мыши; m.inside — мышь над canvas; m.edgeDir() → {x,y} ∈ {-1,0,1} (скролл краем, только мышь);
   m.box — текущая рамка или null; m.setCursor(kind); m.detach().
   Тач: тап — onClick, протяжка — рамка, долгий тап — onCommand, два пальца — onPan. Нужен CSS touch-action:none у canvas. */
(function (root) {
  'use strict';
  function attach(cv, o) {
    o = o || {};
    var TH = o.dragThreshold || 6, LONG = o.longPress || 480, DBL = o.dblTime || 320, DBLD = o.dblDist || 10, EDGE = o.edge == null ? 14 : o.edge;
    var cursors = o.cursors || {}, curKind = null;
    var m = { pos: { x: -1, y: -1 }, inside: false, box: null, lastType: 'mouse' };
    var down = null;            // активный жест ЛКМ / одного пальца
    var mid = null;             // средняя кнопка
    var touches = Object.create(null), nTouch = 0, pan2 = null;
    var lastClick = { t: -1e9, x: -99, y: -99 };
    function en() { return !o.enabled || o.enabled(); }
    function pt(e) { var r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * cv.width / r.width, y: (e.clientY - r.top) * cv.height / r.height }; }
    function info(e, extra) { var i = { shift: !!e.shiftKey, ctrl: !!(e.ctrlKey || e.metaKey), alt: !!e.altKey, touch: e.pointerType === 'touch' || e.pointerType === 'pen', button: e.button, dbl: false }; if (extra) for (var k in extra) i[k] = extra[k]; return i; }
    function call(fn) { if (typeof fn === 'function') return fn.apply(null, Array.prototype.slice.call(arguments, 1)); }
    function norm(a, b) { return { x0: Math.min(a.x, b.x), y0: Math.min(a.y, b.y), x1: Math.max(a.x, b.x), y1: Math.max(a.y, b.y) }; }
    function isDbl(p, now) { var d = now - lastClick.t < DBL && Math.hypot(p.x - lastClick.x, p.y - lastClick.y) < DBLD; lastClick = d ? { t: -1e9, x: -99, y: -99 } : { t: now, x: p.x, y: p.y }; return d; }
    function clearLong() { if (down && down.timer) { clearTimeout(down.timer); down.timer = 0; } }
    function endBox() { if (m.box) { m.box = null; call(o.onBoxing, null); } }

    function onDownEv(e) {
      if (!en()) return;
      m.lastType = e.pointerType || 'mouse';
      var p = pt(e), touch = e.pointerType === 'touch' || e.pointerType === 'pen';
      if (touch) {
        touches[e.pointerId] = p; nTouch++;
        if (nTouch === 2) { // второй палец — отменяем рамку/долгий тап, начинаем панораму
          clearLong(); if (down && !down.captured) { down = null; endBox(); }
          pan2 = centroid();
        }
        if (nTouch > 1) { e.preventDefault(); return; }
      }
      try { cv.setPointerCapture(e.pointerId); } catch (x) {}
      if (!touch && e.button === 1) { mid = { id: e.pointerId, p: p }; e.preventDefault(); return; }
      if (!touch && e.button === 2) { call(o.onCommand, p, info(e)); e.preventDefault(); return; }
      if (e.button !== 0 && !touch) return;
      var inf = info(e);
      down = { id: e.pointerId, p0: p, p: p, moved: false, captured: false, touch: touch, info: inf, timer: 0, used: false };
      if (call(o.onDown, p, inf) === 'capture') { down.captured = true; e.preventDefault(); return; }
      if (touch) down.timer = setTimeout(function () { if (down && !down.moved && !down.captured) { down.used = true; down.timer = 0; call(o.onCommand, down.p, down.info); } }, LONG);
      e.preventDefault();
    }
    function centroid() { var x = 0, y = 0, n = 0; for (var k in touches) { x += touches[k].x; y += touches[k].y; n++; } return n ? { x: x / n, y: y / n } : null; }
    function onMoveEv(e) {
      var p = pt(e), touch = e.pointerType === 'touch' || e.pointerType === 'pen';
      if (!touch) { m.pos = p; m.inside = true; }
      if (!en()) return;
      if (touch && touches[e.pointerId]) {
        touches[e.pointerId] = p;
        if (nTouch >= 2 && pan2) { var c = centroid(); call(o.onPan, pan2.x - c.x, pan2.y - c.y); pan2 = c; return; }
      }
      if (mid && e.pointerId === mid.id) { call(o.onPan, mid.p.x - p.x, mid.p.y - p.y); mid.p = p; return; }
      if (down && e.pointerId === down.id) {
        down.p = p;
        if (down.captured) { call(o.onDrag, p, down.info); return; }
        if (!down.moved && Math.hypot(p.x - down.p0.x, p.y - down.p0.y) > (down.touch ? TH * 2 : TH)) { down.moved = true; clearLong(); }
        if (down.moved && !down.used) { m.box = norm(down.p0, p); call(o.onBoxing, m.box); }
        return;
      }
      if (!touch) call(o.onHover, p);
    }
    function onUpEv(e) {
      var touch = e.pointerType === 'touch' || e.pointerType === 'pen';
      if (touch && touches[e.pointerId]) { delete touches[e.pointerId]; nTouch = Math.max(0, nTouch - 1); if (nTouch < 2) pan2 = nTouch === 1 ? centroid() : null; }
      if (mid && e.pointerId === mid.id) { mid = null; return; }
      if (!down || e.pointerId !== down.id) return;
      var d = down, p = pt(e); clearLong(); down = null;
      try { cv.releasePointerCapture(e.pointerId); } catch (x) {}
      if (!en() || e.type === 'pointercancel') { endBox(); return; }
      if (d.captured) { call(o.onUp, p, d.info); return; }
      if (d.used) return; // долгий тап уже стал приказом
      if (d.moved) { var r = norm(d.p0, p); endBox(); call(o.onBox, r, d.info); return; }
      d.info.dbl = isDbl(p, e.timeStamp || Date.now());
      call(o.onClick, p, d.info);
    }
    function onWheelEv(e) {
      if (!en()) return; e.preventDefault();
      var k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1, dx = e.deltaX * k, dy = e.deltaY * k;
      if (e.shiftKey && !dx) { dx = dy; dy = 0; }
      call(o.onWheel, dx, dy);
    }
    function onCtx(e) { e.preventDefault(); }
    function onLeave(e) { if (e.pointerType !== 'touch') m.inside = false; }
    function onAux(e) { if (e.button === 1) e.preventDefault(); } // средняя кнопка — без автоскролла браузера

    cv.addEventListener('pointerdown', onDownEv);
    cv.addEventListener('pointermove', onMoveEv);
    cv.addEventListener('pointerup', onUpEv);
    cv.addEventListener('pointercancel', onUpEv);
    cv.addEventListener('pointerleave', onLeave);
    cv.addEventListener('wheel', onWheelEv, { passive: false });
    cv.addEventListener('contextmenu', onCtx);
    cv.addEventListener('mousedown', onAux);
    cv.addEventListener('auxclick', onAux);

    m.edgeDir = function () {
      if (!m.inside || m.lastType !== 'mouse' || down || mid || !EDGE || !en()) return { x: 0, y: 0 };
      var x = m.pos.x, y = m.pos.y;
      return { x: x < EDGE ? -1 : x > cv.width - EDGE ? 1 : 0, y: y < EDGE ? -1 : y > cv.height - EDGE ? 1 : 0 };
    };
    m.setCursor = function (kind) { if (kind === curKind) return; curKind = kind; cv.style.cursor = cursors[kind] || kind || 'default'; };
    m.cancel = function () { clearLong(); down = null; mid = null; endBox(); };
    m.detach = function () {
      cv.removeEventListener('pointerdown', onDownEv); cv.removeEventListener('pointermove', onMoveEv); cv.removeEventListener('pointerup', onUpEv);
      cv.removeEventListener('pointercancel', onUpEv); cv.removeEventListener('pointerleave', onLeave); cv.removeEventListener('wheel', onWheelEv);
      cv.removeEventListener('contextmenu', onCtx); cv.removeEventListener('mousedown', onAux); cv.removeEventListener('auxclick', onAux);
    };
    return m;
  }
  // SVG-курсор из строки разметки: ArcadeMouse.svgCursor('<path …/>', 16, 16, 'crosshair')
  function svgCursor(body, hx, hy, fallback, size) {
    size = size || 32;
    var svg = "<svg xmlns='http://www.w3.org/2000/svg' width='" + size + "' height='" + size + "' viewBox='0 0 32 32'>" + body + '</svg>';
    return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '") ' + hx + ' ' + hy + ', ' + (fallback || 'auto');
  }
  root.ArcadeMouse = { attach: attach, svgCursor: svgCursor, version: '0.1.0' };
})(typeof window !== 'undefined' ? window : globalThis);
