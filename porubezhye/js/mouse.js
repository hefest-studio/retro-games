/* ПОРУБЕЖЬЕ · js/mouse.js — модуль мыши и тача для canvas-игр (кандидат на вынос в движок Arcade).
   Не знает ничего про RTS: переводит Pointer Events в жесты в ЛОГИЧЕСКИХ координатах canvas (W×H).
   Мышь: ЛКМ — клик / рамка (протяжка) / двойной клик; ПКМ — клик; СКМ — протяжка-панорама; колесо; край экрана.
   Тач:  тап — клик, протяжка одним пальцем — рамка, два пальца — панорама, долгий тап — «правый» клик.
   UI-зоны: opts.hitUI(pt) → true — жест целиком уходит в onUi(phase, pt, info) (мини-карта, кнопки).
   API: ArcadeMouse.attach(canvas, opts) → m { x, y, inside, box, edge(margin), setCursor(name), detach() } */
(function (global) {
  'use strict';
  var DRAG = 6, LONG = 480, DBL = 320;

  // Курсоры: SVG 24×24 (data-URI) + запасной системный. name → CSS cursor
  function svg(body, hx, hy, fb) { return 'url("data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">' + body + '</svg>') + '") ' + hx + ' ' + hy + ', ' + fb; }
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

  function attach(canvas, opts) {
    opts = opts || {};
    var W = opts.W || canvas.width, H = opts.H || canvas.height;
    var m = { x: -1, y: -1, inside: false, box: null, mods: {}, pointerType: 'mouse', cursor: '' };
    var ptrs = new Map(), g = null, lastClick = { t: -1e9, x: 0, y: 0 }, longTimer = 0, panLast = null;
    var on = function (name) { var f = opts[name]; if (typeof f === 'function') return f.apply(null, [].slice.call(arguments, 1)); };
    var enabled = function () { return !opts.enabled || opts.enabled(); };
    function pt(e) { var r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * W / (r.width || W), y: (e.clientY - r.top) * H / (r.height || H) }; }
    function mods(e) { return { shift: !!e.shiftKey, ctrl: !!(e.ctrlKey || e.metaKey), alt: !!e.altKey }; }
    function clearLong() { if (longTimer) { clearTimeout(longTimer); longTimer = 0; } }
    function centroid() { var sx = 0, sy = 0, n = 0; ptrs.forEach(function (p) { sx += p.x; sy += p.y; n++; }); return { x: sx / n, y: sy / n }; }

    function down(e) {
      if (!enabled()) return;
      var p = pt(e); m.pointerType = e.pointerType || 'mouse'; m.x = p.x; m.y = p.y; m.mods = mods(e);
      ptrs.set(e.pointerId, p);
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
      if (e.pointerType === 'touch' || e.pointerType === 'pen') e.preventDefault();
      // второй палец: отмена текущего жеста → панорама
      if (ptrs.size === 2 && m.pointerType !== 'mouse') { clearLong(); if (g && g.kind === 'box') { m.box = null; on('onBoxCancel'); } g = { kind: 'pan2' }; panLast = centroid(); return; }
      if (ptrs.size > 2) return;
      var btn = e.button == null ? 0 : e.button;
      if (opts.hitUI && opts.hitUI(p)) { g = { kind: 'ui', btn: btn, sx: p.x, sy: p.y, touch: m.pointerType !== 'mouse' }; on('onUi', 'down', p, { btn: g.touch ? 0 : btn, mods: m.mods, touch: g.touch }); return; }
      if (btn === 1) { g = { kind: 'pan', sx: p.x, sy: p.y }; panLast = p; e.preventDefault(); return; }
      g = { kind: 'press', btn: btn, sx: p.x, sy: p.y, t: Date.now(), touch: m.pointerType !== 'mouse' };
      if (g.touch) longTimer = setTimeout(function () { longTimer = 0; if (g && g.kind === 'press') { g.kind = 'done'; if (navigator.vibrate) try { navigator.vibrate(18); } catch (er) {} on('onRight', { x: g.sx, y: g.sy }, { touch: true, long: true }); } }, LONG);
    }
    function move(e) {
      var p = pt(e); m.x = p.x; m.y = p.y; m.inside = p.x >= 0 && p.y >= 0 && p.x < W && p.y < H; m.mods = mods(e);
      if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, p);
      if (!enabled()) return;
      if (!g) { if (m.pointerType === 'mouse' || e.pointerType === 'mouse') on('onHover', p); return; }
      if (g.kind === 'pan2') { var c = centroid(); on('onPan', c.x - panLast.x, c.y - panLast.y); panLast = c; return; }
      if (g.kind === 'pan') { on('onPan', p.x - panLast.x, p.y - panLast.y); panLast = p; return; }
      if (g.kind === 'ui') { on('onUi', 'move', p, { btn: g.btn, mods: m.mods, touch: g.touch }); return; }
      if (g.kind === 'press' && Math.hypot(p.x - g.sx, p.y - g.sy) > (g.touch ? 12 : DRAG)) {
        clearLong();
        if (g.btn === 0) { g.kind = 'box'; on('onBoxStart', { x: g.sx, y: g.sy }, m.mods); } else g.kind = 'drag-other';
      }
      if (g.kind === 'box') { m.box = { x0: g.sx, y0: g.sy, x1: p.x, y1: p.y }; on('onBox', m.box, m.mods); }
    }
    function up(e) {
      var p = pt(e); ptrs.delete(e.pointerId); clearLong();
      try { canvas.releasePointerCapture(e.pointerId); } catch (err) {}
      if (!g) return;
      if (g.kind === 'pan2') { if (ptrs.size === 0) g = null; else panLast = centroid(); return; }
      if (!enabled()) { g = null; m.box = null; return; }
      var md = mods(e);
      if (g.kind === 'ui') on('onUi', 'up', p, { btn: g.btn, mods: md, touch: g.touch });
      else if (g.kind === 'box') { var b = m.box || { x0: g.sx, y0: g.sy, x1: p.x, y1: p.y }; m.box = null; on('onBoxEnd', b, md); }
      else if (g.kind === 'press') {
        if (g.btn === 2) on('onRight', p, md);
        else if (g.btn === 0) {
          var now = Date.now(), dbl = now - lastClick.t < DBL && Math.hypot(p.x - lastClick.x, p.y - lastClick.y) < 10;
          lastClick = dbl ? { t: -1e9, x: 0, y: 0 } : { t: now, x: p.x, y: p.y };
          md.double = dbl; md.touch = g.touch; on('onClick', p, md);
        }
      }
      g = null;
    }
    function cancel(e) { ptrs.delete(e.pointerId); clearLong(); if (g && g.kind === 'box') on('onBoxCancel'); m.box = null; if (!ptrs.size) g = null; }
    function wheel(e) { if (!enabled()) return; e.preventDefault(); var k = e.deltaMode === 1 ? 16 : (e.deltaMode === 2 ? 400 : 1); var dx = e.deltaX * k, dy = e.deltaY * k; if (e.shiftKey && !dx) { dx = dy; dy = 0; } on('onWheel', dx, dy, pt(e), mods(e)); }
    function leave() { m.inside = false; }
    function ctx(e) { e.preventDefault(); }

    canvas.addEventListener('pointerdown', down);
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
    addEventListener('pointercancel', cancel);
    canvas.addEventListener('wheel', wheel, { passive: false });
    canvas.addEventListener('pointerleave', leave);
    canvas.addEventListener('contextmenu', ctx);
    canvas.addEventListener('auxclick', function (e) { if (e.button === 1) e.preventDefault(); });
    document.addEventListener('mouseleave', leave);
    addEventListener('blur', function () { m.inside = false; ptrs.clear(); g = null; m.box = null; clearLong(); });

    // Край экрана: {x,y} ∈ {-1,0,1} (только мышь и только когда указатель над canvas)
    m.edge = function (margin) {
      margin = margin || 10; if (!m.inside || m.pointerType !== 'mouse' || g) return { x: 0, y: 0 };
      return { x: m.x < margin ? -1 : (m.x > W - margin ? 1 : 0), y: m.y < margin ? -1 : (m.y > H - margin ? 1 : 0) };
    };
    m.setCursor = function (name) { var c = CURSORS[name] || CURSORS.default; if (m.cursor !== c) { m.cursor = c; canvas.style.cursor = c; } };
    m.busy = function () { return !!g; };
    m.detach = function () {
      canvas.removeEventListener('pointerdown', down); removeEventListener('pointermove', move); removeEventListener('pointerup', up);
      removeEventListener('pointercancel', cancel); canvas.removeEventListener('wheel', wheel); canvas.removeEventListener('contextmenu', ctx);
    };
    return m;
  }

  global.ArcadeMouse = { attach: attach, cursors: CURSORS, version: '0.1.0' };
})(typeof window !== 'undefined' ? window : globalThis);
