/* _shared/tests/mouse.test.mjs — общий модуль мыши и тача _shared/mouse.js (Node, без зависимостей, без браузера):
   • мышь: клик, двойной клик, рамка (старт/движение/конец/отмена), ПКМ, СКМ-панорама, колесо, край экрана, наведение;
   • тач: тап, двойной тап, протяжка-рамка и протяжка-панорама (touchDrag), долгий тап, два пальца, щипок;
   • UI-зоны (hitUI → onUi), enabled(), координаты при масштабированном canvas, курсоры, cancel/detach;
   • копии модуля в играх (<игра>/js/mouse.js с меткой «Источник — _shared/mouse.js») совпадают с общим файлом.
   Запуск: node _shared/tests/mouse.test.mjs */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = fs.readFileSync(path.join(ROOT, '_shared/mouse.js'), 'utf8');
const MARK = 'Источник — _shared/mouse.js';

// Окружение: поддельные window/canvas с подпиской на события, управляемые часы и таймеры.
function makeEnv(opts = {}, { rect = { left: 0, top: 0, width: 800, height: 600 }, cw = 800, ch = 600 } = {}) {
  let now = 1000, tid = 0; const timers = new Map();
  const bus = () => { const L = {}; return { L, addEventListener(t, f) { (L[t] = L[t] || []).push(f); }, removeEventListener(t, f) { L[t] = (L[t] || []).filter((x) => x !== f); } }; };
  const wb = bus(), cb = bus(), db = bus();
  const vib = [];
  const win = {
    Math, Object, Array, JSON, Error, Map, console, encodeURIComponent,
    Date: { now: () => now },
    setTimeout(fn, ms) { timers.set(++tid, { at: now + ms, fn }); return tid; }, clearTimeout(id) { timers.delete(id); },
    addEventListener: wb.addEventListener, removeEventListener: wb.removeEventListener,
    document: { addEventListener: db.addEventListener, removeEventListener: db.removeEventListener },
    navigator: { vibrate(n) { vib.push(n); } },
  };
  win.window = win; win.globalThis = win;
  vm.createContext(win); vm.runInContext(SRC, win, { filename: 'mouse.js' });
  const captured = [];
  const canvas = { width: cw, height: ch, style: {}, addEventListener: cb.addEventListener, removeEventListener: cb.removeEventListener,
    getBoundingClientRect: () => rect, setPointerCapture(id) { captured.push(id); }, releasePointerCapture() {} };
  const log = [];
  const rec = (name) => (...a) => { log.push([name, ...JSON.parse(JSON.stringify(a))]); };
  const o = {}; for (const n of ['onClick', 'onBoxStart', 'onBox', 'onBoxEnd', 'onBoxCancel', 'onRight', 'onWheel', 'onPan', 'onHover', 'onUi', 'onZoom']) o[n] = rec(n);
  Object.assign(o, opts);
  for (const k of Object.keys(o)) if (o[k] === null) delete o[k];
  const m = win.ArcadeMouse.attach(canvas, o);
  const fire = (target, type, e) => { let prevented = false; const ev = Object.assign({ type, preventDefault() { prevented = true; } }, e); ((target === 'c' ? cb.L : target === 'd' ? db.L : wb.L)[type] || []).slice().forEach((f) => f(ev)); return prevented; };
  const ev = (x, y, extra = {}) => Object.assign({ clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse', button: 0 }, extra);
  const api = {
    win, A: win.ArcadeMouse, m, log, canvas, captured, vib, listeners: { w: wb.L, c: cb.L, d: db.L },
    down: (x, y, extra) => fire('c', 'pointerdown', ev(x, y, extra)),
    move: (x, y, extra) => fire('w', 'pointermove', ev(x, y, extra)),
    up: (x, y, extra) => fire('w', 'pointerup', ev(x, y, extra)),
    cancel: (extra) => fire('w', 'pointercancel', ev(0, 0, extra)),
    wheel: (x, y, extra) => fire('c', 'wheel', Object.assign({ clientX: x, clientY: y, deltaX: 0, deltaY: 0, deltaMode: 0 }, extra)),
    fire,
    tick(ms) { now += ms; for (const [id, t] of [...timers]) if (t.at <= now) { timers.delete(id); t.fn(); } },
    names: () => log.map((l) => l[0]),
    last: (name) => [...log].reverse().find((l) => l[0] === name),
    count: (name) => log.filter((l) => l[0] === name).length,
    timers,
  };
  return api;
}
const T = (id) => ({ pointerType: 'touch', pointerId: id });

let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m) { if (!c) throw new Error(m || 'ложь'); }

// ---------- мышь ----------
test('API: attach, cursors, svgCursor, normBox, version', () => {
  const e = makeEnv(); eq(Object.keys(e.A).sort(), ['attach', 'cursors', 'normBox', 'svgCursor', 'version']);
  eq(['x', 'y', 'inside', 'box'].map((k) => e.m[k]), [-1, -1, false, null]);
  eq(['edge', 'setCursor', 'busy', 'cancel', 'detach'].map((k) => typeof e.m[k]), ['function', 'function', 'function', 'function', 'function']);
});
test('ЛКМ без протяжки — onClick с модификаторами; указатель захвачен', () => {
  const e = makeEnv(); e.down(100, 50, { shiftKey: true }); ok(e.m.busy()); e.up(102, 51, { shiftKey: true });
  eq(e.names(), ['onClick']); eq(e.log[0], ['onClick', { x: 102, y: 51 }, { shift: true, ctrl: false, alt: false, double: false, touch: false }]);
  eq(e.captured, [1]); ok(!e.m.busy());
});
test('metaKey считается ctrl (macOS)', () => {
  const e = makeEnv(); e.down(10, 10); e.up(10, 10, { metaKey: true }); eq(e.last('onClick')[2].ctrl, true);
});
test('двойной клик: второй в пределах dblTime и dblDist — double; третий — снова одиночный', () => {
  const e = makeEnv(); e.down(100, 100); e.up(100, 100); e.tick(200); e.down(104, 103); e.up(104, 103); e.tick(100); e.down(104, 103); e.up(104, 103);
  eq(e.log.map((l) => l[2].double), [false, true, false]);
});
test('двойной клик не срабатывает: поздно (> 320 мс) или далеко (> 10 px)', () => {
  const a = makeEnv(); a.down(100, 100); a.up(100, 100); a.tick(400); a.down(100, 100); a.up(100, 100); eq(a.last('onClick')[2].double, false);
  const b = makeEnv(); b.down(100, 100); b.up(100, 100); b.tick(100); b.down(130, 100); b.up(130, 100); eq(b.last('onClick')[2].double, false);
});
test('рамка: протяжка ЛКМ дальше порога (6 px) — onBoxStart → onBox… → onBoxEnd, клика нет', () => {
  const e = makeEnv(); e.down(100, 100); e.move(104, 100); eq(e.names(), [], 'до порога — ничего');
  e.move(120, 130); eq(e.names(), ['onBoxStart', 'onBox']); eq(e.m.box, { x0: 100, y0: 100, x1: 120, y1: 130 });
  e.move(60, 40); e.up(60, 40, { ctrlKey: true });
  eq(e.names(), ['onBoxStart', 'onBox', 'onBox', 'onBoxEnd']); eq(e.last('onBoxEnd'), ['onBoxEnd', { x0: 100, y0: 100, x1: 60, y1: 40 }, { shift: false, ctrl: true, alt: false }]);
  eq(e.m.box, null); eq(e.A.normBox({ x0: 100, y0: 100, x1: 60, y1: 40 }), { x0: 60, y0: 40, x1: 100, y1: 100 });
});
test('рамка: pointercancel — onBoxCancel, рамка сброшена', () => {
  const e = makeEnv(); e.down(10, 10); e.move(60, 60); e.cancel(); eq(e.names().slice(-1), ['onBoxCancel']); eq(e.m.box, null); ok(!e.m.busy());
});
test('порог протяжки настраивается (dragThreshold)', () => {
  const e = makeEnv({ dragThreshold: 30 }); e.down(100, 100); e.move(120, 100); e.up(120, 100); eq(e.names(), ['onClick']);
});
test('ПКМ — onRight; протяжка ПКМ — ничего (ни приказа, ни рамки)', () => {
  const e = makeEnv(); e.down(200, 200, { button: 2 }); e.up(201, 200, { button: 2, altKey: true });
  eq(e.log, [['onRight', { x: 201, y: 200 }, { shift: false, ctrl: false, alt: true }]]);
  const b = makeEnv(); b.down(200, 200, { button: 2 }); b.move(260, 260, { button: 2 }); b.up(260, 260, { button: 2 }); eq(b.names(), []);
});
test('контекстное меню и автоскролл СКМ подавлены', () => {
  const e = makeEnv(); ok(e.fire('c', 'contextmenu', {})); ok(e.fire('c', 'auxclick', { button: 1 })); ok(!e.fire('c', 'auxclick', { button: 0 }));
});
test('СКМ — панорама: onPan(сдвиг указателя), без клика', () => {
  const e = makeEnv(); ok(e.down(300, 300, { button: 1 }), 'preventDefault на нажатии СКМ'); e.move(310, 295, { button: 1 }); e.move(330, 300, { button: 1 }); e.up(330, 300, { button: 1 });
  eq(e.log, [['onPan', 10, -5], ['onPan', 20, 5]]);
});
test('колесо: onWheel(dx, dy, pt, mods); строки ×16, страницы ×400; Shift — по горизонтали', () => {
  const e = makeEnv(); ok(e.wheel(50, 60, { deltaY: 120 }), 'preventDefault');
  eq(e.log[0], ['onWheel', 0, 120, { x: 50, y: 60 }, { shift: false, ctrl: false, alt: false }]);
  e.wheel(0, 0, { deltaY: 3, deltaMode: 1 }); eq(e.last('onWheel').slice(1, 3), [0, 48]);
  e.wheel(0, 0, { deltaY: 1, deltaMode: 2 }); eq(e.last('onWheel').slice(1, 3), [0, 400]);
  e.wheel(0, 0, { deltaY: 100, shiftKey: true }); eq(e.last('onWheel').slice(1, 3), [100, 0]);
  eq(e.count('onZoom'), 0, 'без wheelZoom зума нет');
});
test('колесо как зум (wheelZoom): onZoom(k, якорь), вверх — приблизить; onWheel не вызывается', () => {
  const e = makeEnv({ wheelZoom: true }); e.wheel(400, 300, { deltaY: -100 });
  const z = e.last('onZoom'); ok(z[1] > 1 && Math.abs(z[1] - Math.exp(0.15)) < 1e-9, 'k=' + z[1]); eq(z.slice(2), [{ x: 400, y: 300 }, { source: 'wheel' }]);
  e.wheel(400, 300, { deltaY: 100 }); ok(e.last('onZoom')[1] < 1); eq(e.count('onWheel'), 0);
});
test('наведение: onHover только без активного жеста; m.x/y/inside обновляются', () => {
  const e = makeEnv(); e.move(40, 50); eq(e.log, [['onHover', { x: 40, y: 50 }]]); eq([e.m.x, e.m.y, e.m.inside], [40, 50, true]);
  e.down(40, 50); e.move(41, 50); eq(e.count('onHover'), 1); e.up(41, 50);
  e.move(900, 50); eq(e.m.inside, false, 'за пределами canvas');
});
test('край экрана: edge(margin) → {-1,0,1}; не работает вне canvas, во время жеста и на таче', () => {
  const e = makeEnv(); e.move(3, 300); eq(e.m.edge(10), { x: -1, y: 0 }); e.move(797, 597); eq(e.m.edge(10), { x: 1, y: 1 }); e.move(400, 2); eq(e.m.edge(), { x: 0, y: -1 });
  e.move(400, 300); eq(e.m.edge(10), { x: 0, y: 0 });
  e.move(3, 300); e.down(3, 300); eq(e.m.edge(10), { x: 0, y: 0 }, 'во время жеста'); e.up(3, 300);
  e.fire('c', 'pointerleave', {}); eq(e.m.edge(10), { x: 0, y: 0 }, 'ушёл с canvas');
  const t = makeEnv(); t.down(3, 300, T(5)); t.up(3, 300, T(5)); t.move(3, 300, T(5)); eq(t.m.edge(10), { x: 0, y: 0 }, 'тач');
});
test('координаты: CSS-размер canvas ≠ логическому (масштаб и смещение)', () => {
  const e = makeEnv({ W: 1280, H: 720 }, { rect: { left: 100, top: 50, width: 640, height: 360 }, cw: 1280, ch: 720 });
  e.down(100 + 320, 50 + 180); e.up(100 + 320, 50 + 180); eq(e.last('onClick')[1], { x: 640, y: 360 });
});
test('W/H по умолчанию — размер canvas', () => {
  const e = makeEnv({}, { rect: { left: 0, top: 0, width: 400, height: 300 }, cw: 800, ch: 600 }); e.down(200, 150); e.up(200, 150); eq(e.last('onClick')[1], { x: 400, y: 300 });
});

// ---------- UI-зоны и enabled ----------
test('UI-зона: жест целиком уходит в onUi (down/move/up), клика и рамки нет', () => {
  const e = makeEnv({ hitUI: (p) => p.y >= 500 }); e.down(100, 550, { button: 2 }); e.move(300, 200, { button: 2 }); e.up(300, 200, { button: 2 });
  eq(e.names(), ['onUi', 'onUi', 'onUi']); eq(e.log.map((l) => l[1]), ['down', 'move', 'up']);
  eq(e.log[0][3], { btn: 2, mods: { shift: false, ctrl: false, alt: false }, touch: false });
});
test('UI-зона на таче: btn = 0, touch = true; долгий тап в UI не даёт onRight', () => {
  const e = makeEnv({ hitUI: () => true }); e.down(10, 10, T(3)); e.tick(600); e.up(10, 10, T(3));
  eq(e.names(), ['onUi', 'onUi']); eq([e.log[0][3].btn, e.log[0][3].touch], [0, true]);
});
test('enabled() = false — жесты игнорируются; выключили посреди рамки — она сбрасывается без onBoxEnd', () => {
  let on = false; const e = makeEnv({ enabled: () => on });
  e.down(10, 10); e.move(80, 80); e.up(80, 80); e.wheel(0, 0, { deltaY: 10 }); eq(e.names(), []);
  on = true; e.down(10, 10); e.move(80, 80); on = false; e.up(80, 80); eq(e.names(), ['onBoxStart', 'onBox']); eq(e.m.box, null); ok(!e.m.busy());
});
test('колбэки необязательны: без них жесты не падают', () => {
  const none = {}; for (const n of ['onClick', 'onBoxStart', 'onBox', 'onBoxEnd', 'onBoxCancel', 'onRight', 'onWheel', 'onPan', 'onHover', 'onUi', 'onZoom']) none[n] = null;
  const e = makeEnv(none); e.down(1, 1); e.move(50, 50); e.up(50, 50); e.down(1, 1, { button: 2 }); e.up(1, 1, { button: 2 }); e.wheel(0, 0, { deltaY: 5 });
  e.down(1, 1, T(1)); e.down(9, 9, T(2)); e.move(30, 30, T(2)); e.up(0, 0, T(1)); e.up(0, 0, T(2)); eq(e.log, []);
});

// ---------- тач ----------
test('тап — onClick с touch:true; preventDefault на касании', () => {
  const e = makeEnv(); ok(e.down(100, 100, T(7)), 'preventDefault'); e.tick(100); e.up(101, 100, T(7));
  eq(e.log, [['onClick', { x: 101, y: 100 }, { shift: false, ctrl: false, alt: false, double: false, touch: true }]]);
});
test('двойной тап — double', () => {
  const e = makeEnv(); e.down(100, 100, T(7)); e.up(100, 100, T(7)); e.tick(150); e.down(103, 100, T(7)); e.up(103, 100, T(7)); eq(e.last('onClick')[2].double, true);
});
test('долгий тап (480 мс) — onRight { touch, long } в точке нажатия + вибро; отпускание клика не даёт', () => {
  const e = makeEnv(); e.down(100, 100, T(7)); e.tick(400); eq(e.names(), []); e.tick(100);
  eq(e.log, [['onRight', { x: 100, y: 100 }, { touch: true, long: true }]]); eq(e.vib, [18]);
  e.up(100, 100, T(7)); eq(e.names(), ['onRight']); ok(!e.m.busy());
});
test('долгий тап не срабатывает: палец отпущен раньше или уехал дальше порога', () => {
  const a = makeEnv(); a.down(100, 100, T(7)); a.tick(200); a.up(100, 100, T(7)); a.tick(600); eq(a.names(), ['onClick']);
  const b = makeEnv(); b.down(100, 100, T(7)); b.move(140, 100, T(7)); b.tick(600); eq(b.count('onRight'), 0);
});
test('длительность долгого тапа настраивается (longPress)', () => {
  const e = makeEnv({ longPress: 200 }); e.down(5, 5, T(1)); e.tick(210); eq(e.names(), ['onRight']);
});
test('протяжка одним пальцем — рамка (порог тача 12 px, вдвое шире мышиного)', () => {
  const e = makeEnv(); e.down(100, 100, T(7)); e.move(110, 100, T(7)); eq(e.names(), [], '10 px — ещё не рамка');
  e.move(140, 150, T(7)); e.up(140, 150, T(7)); eq(e.names(), ['onBoxStart', 'onBox', 'onBoxEnd']); eq(e.last('onBoxEnd')[1], { x0: 100, y0: 100, x1: 140, y1: 150 });
});
test('touchDrag: «pan» — протяжка одним пальцем двигает камеру, рамки нет; мышь по-прежнему тянет рамку', () => {
  const e = makeEnv({ touchDrag: 'pan' }); e.down(100, 100, T(7)); e.move(130, 110, T(7)); e.move(140, 100, T(7)); e.up(140, 100, T(7));
  eq(e.log, [['onPan', 30, 10], ['onPan', 10, -10]]);
  e.down(100, 100); e.move(150, 150); e.up(150, 150); eq(e.names().slice(2), ['onBoxStart', 'onBox', 'onBoxEnd']);
});
test('два пальца — панорама по центру касаний; начатая рамка отменяется', () => {
  const e = makeEnv(); e.down(100, 100, T(1)); e.move(150, 150, T(1)); eq(e.names(), ['onBoxStart', 'onBox']);
  e.down(250, 150, T(2)); eq(e.last('onBoxCancel') && e.m.box, null);
  e.move(170, 150, T(1)); eq(e.last('onPan'), ['onPan', 10, 0]); e.move(250, 190, T(2)); eq(e.last('onPan'), ['onPan', 0, 20]);
  e.up(170, 150, T(1)); ok(e.m.busy(), 'второй палец ещё на экране'); e.up(250, 190, T(2)); ok(!e.m.busy());
  eq(e.count('onClick') + e.count('onBoxEnd') + e.count('onRight'), 0, 'после двух пальцев — ни клика, ни рамки, ни приказа');
});
test('второй палец отменяет долгий тап', () => {
  const e = makeEnv(); e.down(100, 100, T(1)); e.tick(300); e.down(200, 100, T(2)); e.tick(400); eq(e.count('onRight'), 0);
});
test('щипок: пальцы расходятся — onZoom(k > 1, центр, pinch), сходятся — k < 1', () => {
  const e = makeEnv(); e.down(300, 300, T(1)); e.down(400, 300, T(2));
  e.move(450, 300, T(2)); const z = e.last('onZoom'); eq([z[1], z[2], z[3]], [1.5, { x: 375, y: 300 }, { source: 'pinch' }]);
  e.move(375, 300, T(2)); ok(Math.abs(e.last('onZoom')[1] - 0.5) < 1e-9, 'k=' + e.last('onZoom')[1]);
  e.up(0, 0, T(1)); e.up(0, 0, T(2));
});
test('щипок: параллельный сдвиг двух пальцев — только панорама, зума нет', () => {
  const e = makeEnv(); e.down(300, 300, T(1)); e.down(400, 300, T(2)); e.move(300, 340, T(1)); e.move(400, 340, T(2));
  ok(e.count('onPan') === 2); const zs = e.log.filter((l) => l[0] === 'onZoom').map((l) => l[1]);
  ok(Math.abs(zs.reduce((a, b) => a * b, 1) - 1) < 1e-9, 'суммарный зум 1: ' + zs);
});
test('без onZoom щипок даёт только панораму (поведение прежних игр)', () => {
  const e = makeEnv({ onZoom: null }); e.down(300, 300, T(1)); e.down(400, 300, T(2)); e.move(500, 300, T(2)); eq(e.names(), ['onPan']);
});
test('третий палец не ломает жест', () => {
  const e = makeEnv(); e.down(100, 100, T(1)); e.down(200, 100, T(2)); e.down(300, 100, T(3)); e.move(300, 130, T(3)); ok(e.count('onPan') === 1);
  e.up(0, 0, T(3)); e.up(0, 0, T(2)); e.up(0, 0, T(1)); ok(!e.m.busy());
});

// ---------- служебное ----------
test('потеря фокуса окна (blur) сбрасывает жест и рамку', () => {
  const e = makeEnv(); e.down(10, 10); e.move(90, 90); e.fire('w', 'blur', {}); eq([e.m.box, e.m.busy(), e.m.inside], [null, false, false]);
  e.up(90, 90); eq(e.count('onBoxEnd'), 0);
});
test('cancel() срывает текущий жест (рамка → onBoxCancel)', () => {
  const e = makeEnv(); e.down(10, 10); e.move(90, 90); e.m.cancel(); eq([e.names().slice(-1)[0], e.m.box, e.m.busy()], ['onBoxCancel', null, false]);
  e.up(90, 90); eq(e.count('onBoxEnd'), 0);
});
test('курсоры: встроенные имена, неизвестное → default, свои (opts.cursors) важнее, svgCursor', () => {
  const e = makeEnv({ cursors: { attack: 'crosshair', hand: 'grab' } });
  e.m.setCursor('move'); ok(/^url\("data:image\/svg\+xml,/.test(e.canvas.style.cursor) && / 12 12, crosshair$/.test(e.canvas.style.cursor), e.canvas.style.cursor.slice(-30));
  e.m.setCursor('attack'); eq(e.canvas.style.cursor, 'crosshair'); e.m.setCursor('hand'); eq(e.canvas.style.cursor, 'grab');
  e.m.setCursor('нет-такого'); eq(e.canvas.style.cursor, e.A.cursors.default); e.m.setCursor('deny'); eq(e.canvas.style.cursor, 'not-allowed');
  ok(/^url\("data:image\/svg\+xml,.*"\) 3 4, pointer$/.test(e.A.svgCursor('<circle r="2"/>', 3, 4, 'pointer')));
  ok(decodeURIComponent(e.A.svgCursor('<g/>', 0, 0)).includes('width="24" height="24" viewBox="0 0 24 24"') && / 0 0, auto$/.test(e.A.svgCursor('<g/>', 0, 0)), 'размер по умолчанию 24, запасной auto');
  ok(decodeURIComponent(e.A.svgCursor('<g/>', 16, 16, 'cell', 32)).includes('width="32" height="32" viewBox="0 0 32 32"'), 'size = 32');
  eq(Object.keys(e.A.cursors).sort(), ['amove', 'attack', 'build', 'default', 'deny', 'gather', 'move', 'pan', 'repair', 'select']);
});
test('detach() снимает все подписки (canvas, window, document)', () => {
  const e = makeEnv(); e.m.detach();
  const left = ['w', 'c', 'd'].flatMap((k) => Object.entries(e.listeners[k]).filter(([, l]) => l.length).map(([t]) => k + ':' + t));
  eq(left, []); e.down(10, 10); e.up(10, 10); eq(e.log, []);
});
test('модуль не тянет движок и чужих имён: только ArcadeMouse в глобальной области', () => {
  const e = makeEnv(); ok(e.win.Arcade === undefined && e.win.ArcadeMouse === e.A); ok(!/Arcade\.(createGame|Store)/.test(SRC));
});

// ---------- копии в играх ----------
const copies = fs.readdirSync(ROOT, { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith('_'))
  .map((d) => d.name).filter((g) => { const f = path.join(ROOT, g, 'js/mouse.js'); return fs.existsSync(f) && fs.readFileSync(f, 'utf8').includes(MARK); }).sort();
test('общий модуль несёт метку источника (по ней build.sh находит копии)', () => { ok(SRC.includes(MARK)); });
test('на общем модуле есть хотя бы одна игра (porubezhye)', () => { ok(copies.includes('porubezhye'), copies.join(',')); });
for (const g of copies) {
  test(g + ': js/mouse.js — копия _shared/mouse.js', () => { ok(fs.readFileSync(path.join(ROOT, g, 'js/mouse.js'), 'utf8') === SRC, 'рассинхрон — скопируй _shared/mouse.js (bash build.sh)'); });
  test(g + ': index.html подключает ./js/mouse.js', () => { ok(/src="\.\/js\/mouse\.js"/.test(fs.readFileSync(path.join(ROOT, g, 'index.html'), 'utf8'))); });
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
