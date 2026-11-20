/*! Гефест Arcade · mouse.js — общий модуль мыши и тача для canvas-игр (стратегии, головоломки, редакторы). v1.0.0
 * vanilla JS, 0 зависимостей, от движка не зависит (можно подключать и без engine.js). Ничего не знает об игре:
 * переводит Pointer Events в ЖЕСТЫ в логических координатах canvas (W×H) и отдаёт их колбэкам.
 *
 * Источник — _shared/mouse.js; build.sh копирует его в <игра>/js/mouse.js тех игр, где этот файл уже является
 * копией общего модуля (по этой строке-метке). Правки — только здесь, копии в играх не редактировать.
 *
 * Мышь: ЛКМ — клик / двойной клик / рамка (протяжка); ПКМ — «правый» клик (приказ); СКМ — протяжка-панорама;
 *       колесо — прокрутка (onWheel) или зум (onZoom при wheelZoom); край экрана — m.edge().
 * Тач:  тап — клик (двойной тап — double); протяжка одним пальцем — рамка (touchDrag:'box') или панорама
 *       (touchDrag:'pan'); долгий тап — «правый» клик; два пальца — панорама, щипок — зум (onZoom).
 * UI-зоны: opts.hitUI(pt) → true — жест целиком уходит в onUi(phase, pt, info) (мини-карта, кнопки панели).
 * Canvas: CSS touch-action:none (иначе браузер заберёт жесты себе).
 *
 * var m = ArcadeMouse.attach(canvas, {
 *   W, H                  — логический размер (по умолчанию canvas.width/height на момент attach);
 *   enabled()             → bool: когда слушать (например, только в сцене play);
 *   hitUI(pt)             → bool: точка в UI-зоне;  onUi(phase 'down'|'move'|'up', pt, { btn, mods, touch });
 *   onClick(pt, info)     — ЛКМ / тап без протяжки; info = { shift, ctrl, alt, double, touch };
 *   onBoxStart(pt, mods), onBox(box, mods), onBoxEnd(box, mods), onBoxCancel() — рамка; box = { x0, y0, x1, y1 }
 *                           (x0,y0 — точка нажатия, НЕ нормализована; ArcadeMouse.normBox(box) — нормализовать);
 *   onRight(pt, info)     — ПКМ (info = mods) или долгий тап (info = { touch:true, long:true });
 *   onPan(dx, dy)         — сдвиг УКАЗАТЕЛЯ в px canvas (СКМ, два пальца, палец при touchDrag:'pan'); камера: cam -= d;
 *   onWheel(dx, dy, pt, mods) — колесо в px (строки/страницы приведены; Shift — по горизонтали);
 *   onZoom(k, pt, info)   — k > 1 — приблизить; pt — точка-якорь; info.source = 'pinch' | 'wheel';
 *   onHover(pt)           — мышь без кнопок;
 *   wheelZoom: false      — true: колесо даёт onZoom вместо onWheel;  zoomStep: 0.0015 (k = exp(-dy·zoomStep));
 *   touchDrag: 'box'      — 'pan': протяжка одним пальцем двигает камеру, а не тянет рамку;
 *   dragThreshold: 6, touchDragThreshold: 12, longPress: 480, dblTime: 320, dblDist: 10 (px canvas / мс);
 *   cursors: { имя: 'css-cursor' } — свои курсоры поверх встроенных (ArcadeMouse.svgCursor — собрать SVG-курсор)
 * });
 * m: x, y (последняя позиция), inside, box (текущая рамка | null), mods, pointerType, edge(margin) → {x,y} ∈ {-1,0,1}
 *    (только мышь над canvas и без активного жеста), setCursor(name), busy(), cancel(), detach().
 * Тесты: node _shared/tests/mouse.test.mjs. Раздел в _shared/README.md — «Мышь и тач».
 */
(function (global) {
  'use strict';
  var DRAG = 6, TDRAG = 12, LONG = 480, DBL = 320, DBLD = 10, ZSTEP = 0.0015;

  // Курсоры: SVG 24×24 (data-URI) + запасной системный. name → CSS cursor
  function svg(body, hx, hy, fb, size) { size = size || 24; return 'url("data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">' + body + '</svg>') + '") ' + hx + ' ' + hy + ', ' + (fb || 'auto'); }
  var CURSORS = {
    default: svg('<path d="M3 2 L3 19 L8 14.5 L11.5 22 L14.5 20.6 L11 13.4 L17.5 13.4 Z" fill="#f3e6c8" stroke="#2a1d10" stroke-width="1.6" stroke-linejoin="round"/>', 3, 2, 'default'),
    select: svg('<path d="M3 2 L3 19 L8 14.5 L11.5 22 L14.5 20.6 L11 13.4 L17.5 13.4 Z" fill="#ffd27a" stroke="#2a1d10" stroke-width="1.6" stroke-linejoin="round"/><circle cx="19" cy="5" r="3" fill="#5fd38a" stroke="#123" stroke-width="1"/>', 3, 2, 'pointer'),
    attack: svg('<circle cx="12" cy="12" r="8" fill="none" stroke="#ff5a4a" stroke-width="2.4"/><path d="M12 1v6M12 17v6M1 12h6M17 12h6" stroke="#ff5a4a" stroke-width="2.4"/><circle cx="12" cy="12" r="1.8" fill="#ff5a4a"/>', 12, 12, 'crosshair'),
    amove: svg('<circle cx="12" cy="12" r="8" fill="none" stroke="#ffb23a" stroke-width="2.4" stroke-dasharray="4 3"/><path d="M12 2v6M12 16v6M2 12h6M16 12h6" stroke="#ffb23a" stroke-width="2.4"/>', 12, 12, 'crosshair'),
    gather: svg('<path d="M4 20 L14 10" stroke="#7a4a22" stroke-width="3" stroke-linecap="round"/><path d="M9 5 Q16 2 21 9 Q16 6 12 8 Z" fill="#d9dde3" stroke="#222" stroke-width="1"/><path d="M15 15l3 -1 2 3 -2 3 -3 -1z" fill="#ffb43c" stroke="#5a3200" stroke-width="1"/>', 4, 20, 'pointer'),
    repair: svg('<path d="M5 19 L13 11" stroke="#7a4a22" stroke-width="3.2" stroke-linecap="round"/><rect x="11" y="3" width="10" height="7" rx="1.5" transform="rotate(45 16 6.5)" fill="#c87533" stroke="#3a1d08" stroke-width="1.2"/>', 5, 19, 'pointer'),
    move: svg('<circle cx="12" cy="12" r="7" fill="none" stroke="#5fd38a" stroke-width="2.2"/><circle cx="12" cy="12" r="2.4" fill="#5fd38a"/>', 12, 12, 'crosshair'),
    build: svg('<rect x="4" y="4" width="16" height="16" fill="none" stroke="#9fe0ff" stroke-width="2" stroke-dasharray="3 2"/>', 12, 12, 'cell'),
    pan: 'move',
    deny: 'not-allowed'
  };

  function num(v, d) { return typeof v === 'number' && v >= 0 ? v : d; }
  function normBox(b) { return { x0: Math.min(b.x0, b.x1), y0: Math.min(b.y0, b.y1), x1: Math.max(b.x0, b.x1), y1: Math.max(b.y0, b.y1) }; }

  function attach(canvas, opts) {
    opts = opts || {};
    var W = opts.W || canvas.width, H = opts.H || canvas.height;
    var TH = num(opts.dragThreshold, DRAG), TTH = num(opts.touchDragThreshold, TDRAG), LP = num(opts.longPress, LONG),
      DB = num(opts.dblTime, DBL), DD = num(opts.dblDist, DBLD), ZS = num(opts.zoomStep, ZSTEP), TPAN = opts.touchDrag === 'pan';
    var custom = opts.cursors || {}, doc = global.document, nav = global.navigator;
    var m = { x: -1, y: -1, inside: false, box: null, mods: {}, pointerType: 'mouse', cursor: '' };
    var ptrs = new Map(), g = null, lastClick = { t: -1e9, x: 0, y: 0 }, longTimer = 0, panLast = null, pinchD = 0;
    var on = function (name) { var f = opts[name]; if (typeof f === 'function') return f.apply(null, [].slice.call(arguments, 1)); };
    var enabled = function () { return !opts.enabled || opts.enabled(); };
    function pt(e) { var r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * W / (r.width || W), y: (e.clientY - r.top) * H / (r.height || H) }; }
    function mods(e) { return { shift: !!e.shiftKey, ctrl: !!(e.ctrlKey || e.metaKey), alt: !!e.altKey }; }
    function clearLong() { if (longTimer) { clearTimeout(longTimer); longTimer = 0; } }
    function centroid() { var sx = 0, sy = 0, n = 0; ptrs.forEach(function (p) { sx += p.x; sy += p.y; n++; }); return { x: sx / n, y: sy / n }; }
    function spread() { var a = []; ptrs.forEach(function (p) { a.push(p); }); return a.length < 2 ? 0 : Math.max(10, Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y)); } // расстояние между двумя пальцами

    function down(e) {
      if (!enabled()) return;
      var p = pt(e); m.pointerType = e.pointerType || 'mouse'; m.x = p.x; m.y = p.y; m.mods = mods(e);
      ptrs.set(e.pointerId, p);
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
      if (e.pointerType === 'touch' || e.pointerType === 'pen') e.preventDefault();
      // второй палец: отмена текущего жеста → панорама (+ щипок)
      if (ptrs.size === 2 && m.pointerType !== 'mouse') { clearLong(); if (g && g.kind === 'box') { m.box = null; on('onBoxCancel'); } g = { kind: 'pan2' }; panLast = centroid(); pinchD = spread(); return; }
      if (ptrs.size > 2) return;
      var btn = e.button == null ? 0 : e.button;
      if (opts.hitUI && opts.hitUI(p)) { g = { kind: 'ui', btn: btn, sx: p.x, sy: p.y, touch: m.pointerType !== 'mouse' }; on('onUi', 'down', p, { btn: g.touch ? 0 : btn, mods: m.mods, touch: g.touch }); return; }
      if (btn === 1) { g = { kind: 'pan', sx: p.x, sy: p.y }; panLast = p; e.preventDefault(); return; }
      g = { kind: 'press', btn: btn, sx: p.x, sy: p.y, t: Date.now(), touch: m.pointerType !== 'mouse' };
      if (g.touch) longTimer = setTimeout(function () { longTimer = 0; if (g && g.kind === 'press') { g.kind = 'done'; if (nav && nav.vibrate) try { nav.vibrate(18); } catch (er) {} on('onRight', { x: g.sx, y: g.sy }, { touch: true, long: true }); } }, LP);
    }
    function move(e) {
      var p = pt(e); m.x = p.x; m.y = p.y; m.inside = p.x >= 0 && p.y >= 0 && p.x < W && p.y < H; m.mods = mods(e);
      if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, p);
      if (!enabled()) return;
      if (!g) { if (m.pointerType === 'mouse' || e.pointerType === 'mouse') on('onHover', p); return; }
      if (g.kind === 'pan2') {
        var c = centroid(); on('onPan', c.x - panLast.x, c.y - panLast.y); panLast = c;
        if (opts.onZoom && ptrs.size >= 2) { var d = spread(); if (pinchD && Math.abs(d / pinchD - 1) > 0.002) { on('onZoom', d / pinchD, c, { source: 'pinch' }); pinchD = d; } }
        return;
      }
      if (g.kind === 'pan') { on('onPan', p.x - panLast.x, p.y - panLast.y); panLast = p; return; }
      if (g.kind === 'ui') { on('onUi', 'move', p, { btn: g.btn, mods: m.mods, touch: g.touch }); return; }
      if (g.kind === 'press' && Math.hypot(p.x - g.sx, p.y - g.sy) > (g.touch ? TTH : TH)) {
        clearLong();
        if (g.touch && TPAN) { g.kind = 'pan'; on('onPan', p.x - g.sx, p.y - g.sy); panLast = p; return; } // палец двигает камеру
        if (g.btn === 0) { g.kind = 'box'; on('onBoxStart', { x: g.sx, y: g.sy }, m.mods); } else g.kind = 'drag-other';
      }
      if (g.kind === 'box') { m.box = { x0: g.sx, y0: g.sy, x1: p.x, y1: p.y }; on('onBox', m.box, m.mods); }
    }
    function up(e) {
      var p = pt(e); ptrs.delete(e.pointerId); clearLong();
      try { canvas.releasePointerCapture(e.pointerId); } catch (err) {}
      if (!g) return;
      if (g.kind === 'pan2') { if (ptrs.size === 0) g = null; else { panLast = centroid(); pinchD = spread(); } return; }
      if (!enabled()) { g = null; m.box = null; return; }
      var md = mods(e);
      if (g.kind === 'ui') on('onUi', 'up', p, { btn: g.btn, mods: md, touch: g.touch });
      else if (g.kind === 'box') { var b = m.box || { x0: g.sx, y0: g.sy, x1: p.x, y1: p.y }; m.box = null; on('onBoxEnd', b, md); }
      else if (g.kind === 'press') {
        if (g.btn === 2) on('onRight', p, md);
        else if (g.btn === 0) {
          var now = Date.now(), dbl = now - lastClick.t < DB && Math.hypot(p.x - lastClick.x, p.y - lastClick.y) < DD;
          lastClick = dbl ? { t: -1e9, x: 0, y: 0 } : { t: now, x: p.x, y: p.y };
          md.double = dbl; md.touch = g.touch; on('onClick', p, md);
        }
      }
      g = null;
    }
    function cancel(e) { ptrs.delete(e.pointerId); clearLong(); if (g && g.kind === 'box') on('onBoxCancel'); m.box = null; if (!ptrs.size) g = null; }
    function wheel(e) {
      if (!enabled()) return; e.preventDefault();
      var k = e.deltaMode === 1 ? 16 : (e.deltaMode === 2 ? 400 : 1), dx = e.deltaX * k, dy = e.deltaY * k;
      if (opts.wheelZoom) { on('onZoom', Math.exp(-dy * ZS), pt(e), { source: 'wheel' }); return; }
      if (e.shiftKey && !dx) { dx = dy; dy = 0; }
      on('onWheel', dx, dy, pt(e), mods(e));
    }
    function leave() { m.inside = false; }
    function ctx(e) { e.preventDefault(); }
    function aux(e) { if (e.button === 1) e.preventDefault(); } // СКМ — без автоскролла браузера
    function blur() { m.inside = false; ptrs.clear(); g = null; m.box = null; clearLong(); }

    canvas.addEventListener('pointerdown', down);
    global.addEventListener('pointermove', move);
    global.addEventListener('pointerup', up);
    global.addEventListener('pointercancel', cancel);
    canvas.addEventListener('wheel', wheel, { passive: false });
    canvas.addEventListener('pointerleave', leave);
    canvas.addEventListener('contextmenu', ctx);
    canvas.addEventListener('auxclick', aux);
    if (doc && doc.addEventListener) doc.addEventListener('mouseleave', leave);
    global.addEventListener('blur', blur);

    // Край экрана: {x,y} ∈ {-1,0,1} (только мышь и только когда указатель над canvas)
    m.edge = function (margin) {
      margin = margin || 10; if (!m.inside || m.pointerType !== 'mouse' || g) return { x: 0, y: 0 };
      return { x: m.x < margin ? -1 : (m.x > W - margin ? 1 : 0), y: m.y < margin ? -1 : (m.y > H - margin ? 1 : 0) };
    };
    m.setCursor = function (name) { var c = custom[name] || CURSORS[name] || CURSORS.default; if (m.cursor !== c) { m.cursor = c; canvas.style.cursor = c; } };
    m.busy = function () { return !!g; };
    m.cancel = function () { clearLong(); if (g && g.kind === 'box') on('onBoxCancel'); g = null; m.box = null; }; // сорвать текущий жест (смена сцены и т.п.)
    m.detach = function () {
      clearLong(); g = null; m.box = null; ptrs.clear();
      canvas.removeEventListener('pointerdown', down); global.removeEventListener('pointermove', move); global.removeEventListener('pointerup', up);
      global.removeEventListener('pointercancel', cancel); canvas.removeEventListener('wheel', wheel); canvas.removeEventListener('pointerleave', leave);
      canvas.removeEventListener('contextmenu', ctx); canvas.removeEventListener('auxclick', aux);
      if (doc && doc.removeEventListener) doc.removeEventListener('mouseleave', leave);
      global.removeEventListener('blur', blur);
    };
    return m;
  }

  // SVG-курсор из разметки: ArcadeMouse.svgCursor('<circle …/>', 12, 12, 'crosshair'[, size = 24]) → значение CSS cursor (холст size×size)
  global.ArcadeMouse = { attach: attach, cursors: CURSORS, svgCursor: svg, normBox: normBox, version: '1.0.0' };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.ArcadeMouse;
})(typeof window !== 'undefined' ? window : globalThis);
