/* МАЯЧНИЦА · theme-api.js — описание API оформления (контракт «КВЕСТ») и общая проверка темы.
   Тема — объект window.KvestTheme = { id, name:{ru,en}, drawScene, drawHero, drawNpc, drawThought, drawIcon, drawCursor, drawUI }.
   Тема только рисует: состояние игры не меняет, анимации — от t (секунды) и seed.
   Здесь: словарь kind (контракт + расширения пилота), состояния объектов, которые тема должна читать,
   словарь пиктограмм, раскладка интерфейса (общая для движка и темы) и validateTheme(theme). */
(function (global) {
  'use strict';
  var K = global.KVEST = global.KVEST || {};

  // ---------- kind: минимум контракта ----------
  var KINDS = {
    sky: 'небо на весь кадр (градиент по mood)',
    hill: 'дальние холмы/скалы силуэтом (seed — форма)',
    ground: 'земля/камень под ногами',
    house: 'дом; state.windowLit — свет в окне, state.door — дверь (по умолч. есть)',
    tower: 'маяк/башня; state.lit — фонарь горит (луч)',
    tree: 'дерево', plant: 'куст/трава переднего плана',
    rock: 'камень; state.icon — высеченный знак, state.plate — плита в полу (state.down — нажата), state.variant: steps (ступени, state.up — подняты) | pillar',
    water: 'вода (волны от t); state.shell — в воде блестит ракушка',
    bridge: 'настил/мост; state.pier — причал на сваях; state.down === false — мост поднят; state.lift 0..1 — степень подъёма (анимация лебёдки)',
    fence: 'забор; state.ladder — лестница-стремянка; state.stairs — ступени',
    pipe: 'труба; в мини-игре — плитка: state.shape I|L|T|X|cap|sink, state.rot 0..3 (по часовой), state.wet — течёт масло, state.fixed — не вращается',
    lamp: 'фонарь; state.lit; state.small — индикатор-лампочка; state.hang — подвесной; state.big — большой фонарь маяка (state.lens, state.wick, state.oil — установлены детали)',
    wall: 'стена/фон интерьера; state.cave — скальная стена пещеры',
    floor: 'пол интерьера', window: 'окно; state.lit', cloud: 'облако (плывёт от t)', moon: 'луна',
    door: 'дверь; state.open, state.lock — висит замок, state.hatch — люк в полу',
    gate: 'решётка; state.open — поднята',
    lever: 'рычаг/переключатель; state.on — положение',
    box: 'ящик/предмет мебели; state.variant: stool | bench (state.open — ящик выдвинут, state.empty) | logs (поленница, state.empty) | net (сеть, state.empty — без рыбы) | panel (щит с трубами, state.ok); state.icon — диск/плашка с пиктограммой; state.pic + state.part + state.n — фрагмент картинки сдвижной головоломки (part −1 — целая картинка-образец)',
    machine: 'механизм; state.variant: stove (state.wood, state.fire) | well | crane (state.prog 0..3: стопор, стрела, крюк; state.load — висит ведро) | tank | gauge (state.gauge 0..1, state.mark 0..1, state.ok) | spout (state.drip) | winch (state.crank, state.prog 0..4) | carriage (state.ok)',
    item: 'предмет в сцене: рисуется пиктограммой drawIcon(item)',
    npc: 'персонаж: state.type master | baker | goat | cat | gull | bird; state.pose; state.warm (master); state.post (bird — сидит на столбике)'
  };
  // ---------- kind: расширения пилота (тема без них рисует нейтральный прямоугольник) ----------
  var EXT_KINDS = {
    sign: 'доска/табличка с пиктограммами: state.icons — массив id пиктограмм (наблюдательные подсказки)',
    shelf: 'полка с кронштейнами',
    chime: 'подвесной колокольчик-трубка: state.note 0..n-1 (длина), state.n, state.ring 0..1 — качается/звенит'
  };
  var MOODS = ['dawn', 'day', 'dusk', 'night', 'cave', 'indoor'];
  var POSES = ['idle', 'walk', 'reach', 'think', 'happy'];
  var CURSORS = ['use', 'take', 'go', 'look'];          // + необязательный 'walk' (пустое место), неизвестный — не падать
  var METHODS = ['drawScene', 'drawHero', 'drawNpc', 'drawThought', 'drawIcon', 'drawCursor', 'drawUI'];

  // ---------- пиктограммы (мысли, инвентарь, интерфейс) ----------
  var ICONS = {
    key: 'ключ', gear: 'шестерня', cup: 'кружка', star: 'звезда', bird: 'птица', note: 'нота', door: 'дверь', lamp: 'фонарь горит',
    lamp_off: 'фонарь погас', fish: 'рыба', flower: 'цветок', oilcan: 'пустая маслёнка', oilcan_full: 'маслёнка с маслом',
    wick: 'моток фитиля', flint: 'огниво', logs: 'поленья', lantern: 'ручной фонарь (не горит)', lantern_lit: 'ручной фонарь с огнём',
    bucket: 'пустое ведро', bucket_water: 'ведро воды', bread: 'хлеб', rope: 'верёвка', hook: 'крюк', grapple: 'верёвка с крюком',
    shell: 'перламутровая ракушка', lens: 'чистая линза', lens_dirty: 'мутная линза', cloth: 'тряпица', crank: 'рукоять-ворот',
    moon: 'луна', bell: 'колокольчик', goat: 'коза', cat: 'кошка', gull: 'чайка', stool: 'табурет', up: 'вверх / высоко',
    cross: 'не то / нельзя', check: 'готово', question: 'что-то не так', eye: 'посмотри внимательно', fire: 'огонь', cold: 'холод',
    heart: 'спасибо', boat: 'лодка', fog: 'туман', tower: 'маяк', hammer: 'мастерская', well: 'площадь с колодцем', barrel: 'лодочный сарай',
    cave: 'грот', bridge: 'мост', stairs: 'лестница маяка', gauge: 'манометр', pipe: 'трубы', lock: 'замок', lever: 'нажать рычаг',
    lever_on: 'рычаг вверх', lever_off: 'рычаг вниз', dot1: 'первый', dot2: 'второй', dot3: 'третий',
    n0: 'нота 1 (низкая)', n1: 'нота 2', n2: 'нота 3', n3: 'нота 4', n4: 'нота 5 (высокая)', firefly: 'светлячок',
    water: 'вода', book: 'прохождение-набросок', hint: 'подсказка (лампочка)', close: 'закрыть', prev: 'назад', next: 'вперёд', timer: 'подожди'
  };

  // ---------- раскладка интерфейса (логические координаты 960×540; движок по ней попадает кликами, тема — рисует) ----------
  var LAYOUT = {
    W: 960, H: 540,
    inv: { x: 0, y: 478, w: 960, h: 62, slot0: 160, slotW: 60, slotH: 52, slotY: 483, gap: 6, slots: 10 },
    hint: { x: 44, y: 509, r: 24 },
    book: { x: 106, y: 509, r: 20 },
    close: { x: 916, y: 44, r: 24 },
    walk: { prev: { x: 56, y: 280, r: 28 }, next: { x: 904, y: 280, r: 28 }, close: { x: 916, y: 44, r: 24 },
      x0: 110, y0: 92, cw: 236, ch: 176, gap: 16, cols: 3, rows: 2 }
  };
  function slotRect(i) { var L = LAYOUT.inv; return [L.slot0 + i * (L.slotW + L.gap), L.slotY, L.slotW, L.slotH]; }

  function allKinds() { var o = {}, k; for (k in KINDS) o[k] = KINDS[k]; for (k in EXT_KINDS) o[k] = EXT_KINDS[k]; return o; }
  function isKind(k) { return Object.prototype.hasOwnProperty.call(KINDS, k) || Object.prototype.hasOwnProperty.call(EXT_KINDS, k); }

  // ---------- образцы для проверки темы ----------
  function sampleScene(mood) {
    var objs = [], x = 10, k, i = 0;
    var st = { house: { windowLit: true }, tower: { lit: true }, rock: { icon: 'fish', plate: true, down: true }, water: { shell: true },
      bridge: { down: false, lift: 0.5 }, fence: { ladder: true }, pipe: { shape: 'T', rot: 1, wet: true }, lamp: { big: true, lens: true, lit: true },
      wall: { cave: true }, door: { open: false, lock: true }, gate: { open: true }, lever: { on: true }, box: { variant: 'bench', open: true, icon: 'star' },
      machine: { variant: 'crane', prog: 2, load: true }, npc: { type: 'goat' }, sign: { icons: ['fish', 'star'] }, chime: { note: 2, n: 5, ring: 1 } };
    var all = allKinds();
    for (k in all) { objs.push({ id: 'o' + (i++), kind: k, item: 'key', x: x % 900, y: 100 + (i % 5) * 60, w: 50, h: 50, seed: i, state: st[k] || {} }); x += 55; }
    objs.push({ id: 'unknown', kind: 'zzz_unknown_kind', x: 400, y: 200, w: 40, h: 40, state: {} });
    objs.push({ id: 'machines', kind: 'machine', x: 500, y: 200, w: 60, h: 80, state: { variant: 'stove', fire: true, wood: true } });
    ['well', 'tank', 'gauge', 'spout', 'winch', 'carriage', 'nonsense'].forEach(function (v, j) { objs.push({ id: 'm' + j, kind: 'machine', x: 100 + j * 70, y: 300, w: 60, h: 80, state: { variant: v, gauge: 0.5, prog: 2, drip: true, crank: true } }); });
    ['master', 'baker', 'cat', 'gull', 'bird', 'nobody'].forEach(function (v, j) { objs.push({ id: 'n' + j, kind: 'npc', x: 100 + j * 70, y: 380, w: 60, h: 80, state: { type: v, pose: 'happy', post: true } }); });
    ['stool', 'logs', 'net', 'panel'].forEach(function (v, j) { objs.push({ id: 'b' + j, kind: 'box', x: 100 + j * 70, y: 420, w: 60, h: 40, state: { variant: v, pic: 'frame', part: j, n: 3 } }); });
    ['I', 'L', 'X', 'cap', 'sink', '?'].forEach(function (v, j) { objs.push({ id: 'p' + j, kind: 'pipe', x: 100 + j * 70, y: 40, w: 60, h: 60, state: { shape: v, rot: j % 4, wet: j % 2 === 0, fixed: j === 2 } }); });
    return {
      id: 'sample', w: 960, h: 540, mood: mood || 'day',
      layers: [{ depth: 0, items: [{ kind: 'sky' }, { kind: 'hill', x: 0, y: 300, w: 960, h: 240, seed: 3 }, { kind: 'cloud', x: 100, y: 50, w: 120, h: 40 }, { kind: 'moon', x: 800, y: 50, w: 40, h: 40 }] },
        { depth: 1, items: [{ kind: 'house', x: 120, y: 200, w: 220, h: 220, seed: 7, state: { windowLit: true } }] },
        { depth: 2, items: [{ kind: 'ground', x: 0, y: 440, w: 960, h: 100 }] },
        { depth: 3, items: [{ kind: 'plant', x: 900, y: 420, w: 60, h: 120, seed: 1 }, { kind: 'zzz_layer_unknown', x: 10, y: 10, w: 20, h: 20 }] }],
      objects: objs,
      hotspots: [{ id: 'h', rect: [600, 300, 120, 150], cursor: 'use' }],
      walk: [[40, 470], [920, 470]], hero: { x: 200, y: 470 }, dark: false
    };
  }
  function sampleUI(mode) {
    return { mode: mode || 'scene', layout: LAYOUT, inv: ['key', 'lens', 'no_such_icon'], sel: 'key', hover: 1,
      drag: { item: 'lens', x: 300, y: 300 }, hint: { ready: true, free: false, cd: 0.4 }, close: mode === 'mini', debug: true,
      progress: { solved: 3, total: 26 },
      walk: mode === 'walk' ? { page: 0, pages: 2, steps: [{ icons: ['hammer', 'stool', 'up'], done: true }, { icons: ['well', 'bucket'], done: false }] } : null };
  }

  // Канва-заглушка: любой метод — пустая функция, градиенты — объект с addColorStop, свойства запоминаются.
  function mockCtx() {
    var store = { canvas: { width: 960, height: 540 }, calls: 0 };
    var grad = { addColorStop: function () {} };
    var fn = function () { store.calls++; return grad; };
    function img(w, h) { w = Math.max(1, Math.min(2048, w | 0 || 1)); h = Math.max(1, Math.min(2048, h | 0 || 1)); return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }; }
    var special = { measureText: function (s) { store.calls++; return { width: String(s).length * 7 }; },
      getImageData: function (x, y, w, h) { return img(w, h); }, createImageData: function (w, h) { return typeof w === 'object' ? img(w.width, w.height) : img(w, h); },
      createPattern: function () { return { setTransform: function () {} }; }, getTransform: function () { return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }; }, isPointInPath: function () { return false; } };
    if (typeof Proxy === 'undefined') return null;
    return new Proxy(store, {
      get: function (o, p) { if (p in special) return special[p]; if (p in o) return o[p]; if (p === 'then') return undefined; return fn; },
      set: function (o, p, v) { o[p] = v; return true; }
    });
  }

  // Проверка темы: все методы есть, ни один не падает (в том числе на неизвестных kind, пиктограммах, курсорах, позах).
  function validateTheme(theme, opts) {
    opts = opts || {};
    var errors = [], ctx = opts.ctx || mockCtx();
    if (!theme || typeof theme !== 'object') return { ok: false, errors: ['тема не объект'] };
    if (!theme.id || typeof theme.id !== 'string') errors.push('нет id');
    if (!theme.name || !theme.name.ru || !theme.name.en) errors.push('нет name.ru / name.en');
    METHODS.forEach(function (m) { if (typeof theme[m] !== 'function') errors.push('нет метода ' + m); });
    if (errors.length) return { ok: false, errors: errors };
    function tryit(label, f) { try { if (ctx.save) ctx.save(); f(); if (ctx.restore) ctx.restore(); } catch (e) { errors.push(label + ': ' + (e && e.message)); } }
    MOODS.concat(['weird_mood']).forEach(function (m) { tryit('drawScene ' + m, function () { theme.drawScene(ctx, sampleScene(m), 1.5, { debug: true, light: { x: 300, y: 300, r: 120 } }); }); });
    var dark = sampleScene('cave'); dark.dark = true;
    tryit('drawScene dark', function () { theme.drawScene(ctx, dark, 2, { light: { x: 100, y: 100, r: 100 } }); });
    tryit('drawScene пустая', function () { theme.drawScene(ctx, { id: 'e', w: 960, h: 540, mood: 'day', layers: [], objects: [], hotspots: [] }, 0, {}); });
    POSES.concat(['strange']).forEach(function (p) { tryit('drawHero ' + p, function () { theme.drawHero(ctx, { x: 300, y: 450, dir: -1 }, p, 0.7); }); });
    tryit('drawNpc', function () { theme.drawNpc(ctx, { id: 'n', kind: 'npc', x: 10, y: 10, w: 50, h: 80, state: { type: 'zzz' } }, 'idle', 0); });
    tryit('drawThought', function () { theme.drawThought(ctx, 480, 200, ['key', 'nonexistent_icon', 'lamp'], 1); });
    tryit('drawThought пусто', function () { theme.drawThought(ctx, 480, 200, [], 1); });
    Object.keys(ICONS).concat(['zzz_icon']).forEach(function (id) { tryit('drawIcon ' + id, function () { theme.drawIcon(ctx, id, 100, 100, 40); }); });
    CURSORS.concat(['walk', 'zzz']).forEach(function (c) { tryit('drawCursor ' + c, function () { theme.drawCursor(ctx, c, 100, 100); }); });
    ['scene', 'mini', 'walk', 'cut'].forEach(function (m) { tryit('drawUI ' + m, function () { theme.drawUI(ctx, sampleUI(m), 3); }); });
    return { ok: errors.length === 0, errors: errors };
  }

  K.ThemeAPI = { version: '1.0', KINDS: KINDS, EXT_KINDS: EXT_KINDS, MOODS: MOODS, POSES: POSES, CURSORS: CURSORS, METHODS: METHODS,
    ICONS: ICONS, LAYOUT: LAYOUT, slotRect: slotRect, allKinds: allKinds, isKind: isKind,
    sampleScene: sampleScene, sampleUI: sampleUI, mockCtx: mockCtx, validateTheme: validateTheme };
})(typeof window !== 'undefined' ? window : globalThis);
