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
    house: 'дом; state.windowLit — свет в окне, state.door — дверь (по умолч. есть); state.smoke — дым из трубы (коптильня); state.fish — рыбацкий дом (вяленая рыба в окне, вывеска-рыба); state.salt — солеварня (соль конусами)',
    tower: 'маяк/башня; state.lit — фонарь горит (луч)',
    tree: 'дерево', plant: 'куст/трава переднего плана',
    rock: 'камень; state.icon — высеченный знак, state.plate — плита в полу (state.down — нажата), state.variant: steps (ступени, state.up — подняты) | pillar',
    water: 'вода (волны от t); state.shell — в воде блестит ракушка',
    bridge: 'настил/мост; state.pier — причал на сваях; state.down === false — мост поднят; state.lift 0..1 — степень подъёма (анимация лебёдки)',
    fence: 'забор; state.ladder — лестница-стремянка; state.stairs — ступени; state.rack — вешала для сушки (state.weed: wet | dry — что висит)',
    pipe: 'труба; в мини-игре — плитка: state.shape I|L|T|X|cap|sink, state.rot 0..3 (по часовой), state.wet — течёт масло, state.fixed — не вращается',
    lamp: 'фонарь; state.lit; state.small — индикатор-лампочка; state.hang — подвесной; state.big — большой фонарь маяка (state.lens, state.wick, state.oil — установлены детали)',
    wall: 'стена/фон интерьера; state.cave — скальная стена пещеры',
    floor: 'пол интерьера', window: 'окно; state.lit; state.dawn — за окном рассвет; state.frameOnly — только рама', cloud: 'облако (плывёт от t)', moon: 'луна',
    door: 'дверь; state.open, state.lock — висит замок, state.hatch — люк в полу',
    gate: 'решётка; state.open — поднята; state.icon — пиктограмма на табличке; state.grille — решётка-заслонка перед дверью (только прутья, дверь видна)',
    lever: 'рычаг/переключатель; state.on — положение; state.tint — цвет-метка части механизма (pin — стопор, boom — стрела, hook — крюк), state.pips — вес вентиля (точки)',
    box: 'ящик/предмет мебели; state.variant: stool | bench (state.open — ящик выдвинут, state.empty) | logs (поленница, state.empty) | net (сеть, state.empty — без рыбы) | panel (щит с трубами, state.ok); state.icon — диск/плашка с пиктограммой; state.pic + state.part + state.n — фрагмент картинки сдвижной головоломки (part −1 — целая картинка-образец)',
    machine: 'механизм; state.variant: stove (state.wood, state.fire) | well | crane (state.prog 0..3: стопор, стрела, крюк; state.load — висит ведро) | tank | gauge (state.gauge 0..1, state.mark 0..1, state.ok) | spout (state.drip) | winch (state.crank, state.prog 0..4) | carriage (state.ok) | clockwork (часовой привод: state.weight — гиря на цепи, state.run) | gear (шестерня механизма gears: state.rot 0..1, state.mark 0..1 — где должна стоять метка, state.ok, state.solved) | reflector (зеркало-отражатель: state.shiny, state.aim, state.lit)',
    item: 'предмет в сцене: рисуется пиктограммой drawIcon(item)',
    npc: 'персонаж: state.type master | baker | goat | cat | gull | bird | fisher | dog | crab | tern; state.pose; state.warm (master); state.post (bird — сидит на столбике), state.note 0..4 (bird — нота: высота столбика; тема «бумага» красит птицу и колокольчик одной нотой в один цвет), state.sing 0..1, state.fed (cat), state.traded (gull); fisher — рыбачка у бочки (state.happy); dog — пёс (state.pose: idle | sleep | happy, state.hide — прячется); crab — краб (state.away — ушёл, state.tin — сидит в жестянке); tern — стайка морских птиц на скале (state.alarm — кружит и кричит, state.down — слетела вниз, state.n — сколько птиц в стайке)'
  };
  // ---------- kind: расширения пилота (тема без них рисует нейтральный прямоугольник) ----------
  var EXT_KINDS = {
    sign: 'доска/табличка с пиктограммами: state.icons — массив id пиктограмм (наблюдательные подсказки)',
    shelf: 'полка с кронштейнами',
    chime: 'подвесной колокольчик-трубка: state.note 0..n-1 (длина), state.n, state.ring 0..1 — качается/звенит',
    // --- движок глав (coast.js): две фазы сцены, карта побережья; и предметы побережья ---
    tide: 'море с приливом и отливом: y — верх воды в прилив, state.low — верх воды в отлив; уровень между ними — scene.phaseMix (0 — прилив, 1 — отлив, движок анимирует); под водой — мокрый песок',
    mapsheet: 'лист карты побережья во весь кадр: море, state.coast — многоугольник суши [[x, y]…], роза ветров',
    trail: 'тропа на карте: state.pts — ломаная [[x, y]…], state.open — открыта (закрытая — пунктир в тумане)',
    mapnode: 'место на карте: state.icon — пиктограмма места, state.open (закрытое — «?»), state.here — здесь фишка героини, state.lit — огонь зажжён',
    maptoken: 'фишка героини на карте (x, y — левый верх; низ — точка на тропе), state.dir',
    beacon: 'сигнальный огонь: state.variant hearth (очаг на камнях) | chimney (корзина на трубе) | brazier (жаровня); state.fuel — топливо лежит, state.lit — горит',
    saltpan: 'солеварня: state.variant settle (отстойный бассейн, state.brine — рассол) | boil (црен на печи: state.brine, state.boil — кипит, state.salt — соль осела)',
    sluice: 'шлюз в канале: state.open — заслонка поднята, state.flow — течёт вода',
    boat: 'вёсельная лодка: state.afloat — на плаву (иначе лежит на песке)',
    tidepost: 'приливная вешка с отметками: state.low — сейчас отлив (вода у нижней отметки)',
    // --- движок помощников: ветер, мельницы, морские птицы, купол с телескопом ---
    windmill: 'ветряная мельница: башня, крылья; state.sails 3|4 (сколько крыльев обтянуто; state.full — все 4), state.turn — крылья вертятся, state.brake — тормоз зажат, state.open — дверь открыта, state.sand — дверь занесло песком; state.still — крылья в статичном спрайте (эскиз тушью)',
    vane: 'флюгер на шесте: state.west — ветер с запада (стрелка смотрит на запад), иначе с востока; state.stuck — заклинил',
    millstone: 'жернов внутри мельницы: state.turn — вертится, state.lens — на нём шлифуется линза, state.done — линза отшлифована; state.still — линза в статичном спрайте',
    millgear: 'передача мельницы (вал и шестерни): state.cog — зубец вставлен, state.turn — вертится, state.brake — вал зажат тормозом; state.still — колесо в статичном спрайте',
    telescope: 'большой телескоп: state.lens — объектив на месте, state.eye — окуляр на месте, state.aim — смотрит в прорезь купола',
    shutter: 'прорезь купола обсерватории: state.open — створка поднята (видно небо), state.rope — верёвка створки спущена вниз',
    mound: 'холмик песка/рыхлой земли: state.dug — разрыт (яма), state.mark — свежий (пахнет: тут что-то есть)',
    crate: 'ящик, обвязанный верёвкой: state.open — развязан и открыт, state.empty — пуст',
    nest: 'гнездо на уступе: state.chick — в гнезде птенец, state.shiny — блестит что-то (state.empty — забрали)',
    burrow: 'лаз под забором: state.open — прорыт',
    bollard: 'причальная тумба/столбик: state.tied — к нему привязана верёвка',
    ropebridge: 'верёвочный мостик через расщелину: state.taut — натянут (держат или привязан), иначе провис'
  };
  var MOODS = ['dawn', 'day', 'dusk', 'night', 'cave', 'indoor'];
  var POSES = ['idle', 'walk', 'reach', 'think', 'happy'];
  var CURSORS = ['use', 'take', 'go', 'look'];          // + необязательный 'walk' (пустое место), неизвестный — не падать
  var METHODS = ['drawScene', 'drawHero', 'drawNpc', 'drawThought', 'drawIcon', 'drawCursor', 'drawUI'];
  // Необязательные хуки (расширение 14.11, «подсказки и набросок тушью»). Движок/оболочка зовут их, только если они есть:
  //  drawHint(ctx, x, y, hint, t, opts) — мысль-подсказка; hint = { target: id головоломки, scene, here, icons, ink: эскиз из puzzles.js },
  //    opts.age — секунды с появления (для эффекта пера). Без хука подсказка рисуется обычной drawThought(icons).
  //  drawWalkbook(ctx, walk, layout, t) — прохождение-набросок; walk = { page, pages, per, steps: только открытые (пройденные + текущий),
  //    total, flip: {d, t} | null, open, time }; шаг = { id, scene, icons, done, current, open, ink }. Без хука drawUI рисует walk сам.
  //  drawThought(ctx, x, y, icons, t, opts) — opts.style: 'paper' | 'ink' (мысль тушью: мастер в кат-сценах), opts.age.
  //  drawHelper(ctx, p, pose, t) — помощник в отряде: p = { id: 'dog' | 'gull', x, y, dir, alt (высота полёта чайки, абсолютный y), active, hold };
  //    позы пса: idle | walk | reach | dig | sniff | pull | hold | bark | happy | think; чайки: idle | walk (полёт) | reach (взлёт к зоне) | carry | hold | happy.
  //    Без хука оболочка рисует помощника через drawNpc (state.type dog | gull).
  //  drawTrail(ctx, trail, t) — нюх пса: trail = { pts: [[x, y]…] от носа к цели, rect — цель, age, dur } (след лапами тушью, цель — петля киноварью).
  //  drawOverview(ctx, ov, t) — «взгляд сверху» чайки: ov = { marks: [{ rect, hero, item?, exit?, icon? }], age, dur } (обзор тушью: где и кто может действовать).
  //  Портреты героев рисует drawUI по ui.heroes = [{ id, icon, active, here, busy, hold, ability }] в LAYOUT.heroes.
  var HOOKS = ['drawHint', 'drawWalkbook', 'drawHelper', 'drawTrail', 'drawOverview'];
  var HELPER_POSES = { dog: ['idle', 'walk', 'reach', 'dig', 'sniff', 'pull', 'hold', 'bark', 'happy', 'think'], gull: ['idle', 'walk', 'reach', 'carry', 'hold', 'happy', 'think'] };

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
    water: 'вода', book: 'прохождение-набросок', hint: 'подсказка (лампочка)', close: 'закрыть', prev: 'назад', next: 'вперёд', timer: 'подожди',
    // движок глав и побережье (themes/icons-ext.js)
    map: 'карта побережья', tide: 'море, прилив и отлив', low: 'отлив', high: 'прилив', seaweed: 'мокрые водоросли', seaweed_dry: 'сухие водоросли',
    tin: 'жестянка', scoop: 'совок', embers: 'совок с углями', driftwood: 'плавник (бревно)', peat: 'торф', salt: 'соль', mitten: 'варежка', scrub: 'варежка с солью',
    weight: 'гиря', crab: 'краб', dog: 'пёс', sun: 'солнце, рассвет', hut: 'рыбацкий дом', saltpan: 'солеварня', stones: 'камни через воду',
    rocktower: 'маяк на скале', net: 'сети', mirror: 'зеркало', gearwheel: 'шестерня с меткой',
    // помощники и их kind (themes/icons-ext.js)
    taya: 'Тая (портрет)', scent: 'нюх пса (след)', overview: 'взгляд сверху (чайка)', hold: 'держать', sail: 'полотно крыла мельницы', eyepiece: 'окуляр',
    chick: 'птенец', windmill: 'мельница', millstone: 'жернов', windW: 'ветер с запада', windE: 'ветер с востока', telescope: 'телескоп', dome: 'обсерватория',
    nest: 'гнездо / птичий базар', burrow: 'лаз, нора', dig: 'рыть', whale: 'кит (силуэт)'
  };

  // ---------- раскладка интерфейса (логические координаты 960×540; движок по ней попадает кликами, тема — рисует) ----------
  var LAYOUT = {
    W: 960, H: 540,
    inv: { x: 0, y: 478, w: 960, h: 62, slot0: 160, slotW: 60, slotH: 52, slotY: 483, gap: 6, slots: 10 },
    hint: { x: 44, y: 509, r: 24 },
    book: { x: 106, y: 509, r: 20 },
    close: { x: 916, y: 44, r: 24 },
    heroes: { x: 40, y: 40, r: 23, gap: 56 },   // портреты-переключатели героев (главы с помощниками): i-й — в (x + i·gap, y)
    // блокнот: разворот из двух страниц (per шагов на разворот); x0..ch — карточки для тем без своего блокнота
    walk: { prev: { x: 46, y: 280, r: 28 }, next: { x: 914, y: 280, r: 28 }, close: { x: 916, y: 44, r: 24 },
      x0: 96, y0: 80, cw: 372, ch: 392, gap: 0, cols: 2, rows: 1, per: 2,
      pages: [{ x: 96, y: 70, w: 384, h: 412 }, { x: 480, y: 70, w: 384, h: 412 }] }
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
      machine: { variant: 'crane', prog: 2, load: true }, npc: { type: 'goat' }, sign: { icons: ['fish', 'star'] }, chime: { note: 2, n: 5, ring: 1 },
      tide: { low: 120 }, mapsheet: { coast: [[0, 0], [960, 0], [960, 200], [500, 260], [0, 220]] }, trail: { pts: [[10, 10], [60, 40], [120, 20]], open: true },
      mapnode: { icon: 'hut', open: true, here: true, lit: true }, maptoken: { dir: -1 }, beacon: { variant: 'chimney', fuel: true, lit: true },
      saltpan: { variant: 'boil', brine: true, boil: true, salt: true }, sluice: { open: true, flow: true }, boat: { afloat: true }, tidepost: { low: true },
      windmill: { sails: 4, turn: true, brake: false, door: true }, vane: { west: true }, millstone: { turn: true, lens: true }, millgear: { cog: true, turn: true },
      telescope: { lens: true, eye: true, aim: true }, shutter: { open: true, rope: true }, mound: { dug: false, mark: true }, crate: { open: true },
      nest: { chick: true, shiny: true }, burrow: { open: true }, bollard: { tied: true }, ropebridge: { taut: true } };
    var all = allKinds();
    for (k in all) { objs.push({ id: 'o' + (i++), kind: k, item: 'key', x: x % 900, y: 100 + (i % 5) * 60, w: 50, h: 50, seed: i, state: st[k] || {} }); x += 55; }
    objs.push({ id: 'unknown', kind: 'zzz_unknown_kind', x: 400, y: 200, w: 40, h: 40, state: {} });
    objs.push({ id: 'machines', kind: 'machine', x: 500, y: 200, w: 60, h: 80, state: { variant: 'stove', fire: true, wood: true } });
    ['well', 'tank', 'gauge', 'spout', 'winch', 'carriage', 'clockwork', 'gear', 'reflector', 'nonsense'].forEach(function (v, j) { objs.push({ id: 'm' + j, kind: 'machine', x: 100 + j * 70, y: 300, w: 60, h: 80, state: { variant: v, gauge: 0.5, prog: 2, drip: true, crank: true } }); });
    ['master', 'baker', 'cat', 'gull', 'bird', 'fisher', 'dog', 'crab', 'tern', 'nobody'].forEach(function (v, j) { objs.push({ id: 'n' + j, kind: 'npc', x: 100 + j * 70, y: 380, w: 60, h: 80, state: { type: v, pose: 'happy', post: true } }); });
    [{ variant: 'hearth' }, { variant: 'brazier', fuel: true }, { variant: 'chimney' }].forEach(function (v, j) { objs.push({ id: 'bc' + j, kind: 'beacon', x: 600 + j * 80, y: 300, w: 60, h: 120, state: v }); });
    [{ variant: 'settle', brine: true }, { variant: 'boil' }].forEach(function (v, j) { objs.push({ id: 'sp' + j, kind: 'saltpan', x: 600 + j * 120, y: 440, w: 110, h: 40, state: v }); });
    objs.push({ id: 'dogs', kind: 'npc', x: 700, y: 380, w: 70, h: 60, state: { type: 'dog', pose: 'sleep', hide: true } }, { id: 'crabt', kind: 'npc', x: 780, y: 420, w: 40, h: 30, state: { type: 'crab', tin: true } });
    objs.push({ id: 'rack', kind: 'fence', x: 300, y: 300, w: 120, h: 100, state: { rack: true, weed: 'wet' } }, { id: 'smoke', kind: 'house', x: 400, y: 200, w: 120, h: 140, state: { smoke: true } });
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
      walk: [[40, 470], [920, 470]], hero: { x: 200, y: 470 }, dark: false, phase: 'low', phaseMix: 0.5
    };
  }
  function sampleUI(mode) {
    return { mode: mode || 'scene', layout: LAYOUT, inv: ['key', 'lens', 'no_such_icon'], sel: 'key', hover: 1,
      heroes: [{ id: 'taya', icon: 'taya', active: false, here: true, busy: true, hold: 'x' }, { id: 'dog', icon: 'dog', active: true, here: true, ability: 'scent' }, { id: 'gull', icon: 'gull', here: false }],
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
    tryit('drawThought ink', function () { theme.drawThought(ctx, 300, 300, ['tower', 'lamp_off'], 1, { style: 'ink', age: 0.6 }); });
    if (typeof theme.drawHint === 'function') {
      tryit('drawHint', function () { theme.drawHint(ctx, 300, 320, { target: 'nope', here: true, icons: ['key'], ink: [{ i: 'key' }, '>', { i: 'door', mark: true, n: 2 }, '+', { o: 'zzz/none' }, 'up', '='] }, 1, { age: 0.5 }); });
      tryit('drawHint пусто', function () { theme.drawHint(ctx, 300, 320, null, 1, {}); });
    }
    if (typeof theme.drawHelper === 'function') ['dog', 'gull', 'zzz'].forEach(function (id) { (HELPER_POSES[id] || ['idle']).concat(['strange']).forEach(function (p) { tryit('drawHelper ' + id + ' ' + p, function () { theme.drawHelper(ctx, { id: id, x: 300, y: 450, dir: -1, alt: 360, active: true, hold: p === 'hold' ? 'x' : null }, p, 0.7); }); }); });
    if (typeof theme.drawTrail === 'function') { tryit('drawTrail', function () { theme.drawTrail(ctx, { pts: [[100, 450], [200, 440], [320, 452]], rect: [300, 400, 50, 50], age: 1, dur: 4 }, 1); }); tryit('drawTrail пусто', function () { theme.drawTrail(ctx, { pts: [], age: 0 }, 1); }); }
    if (typeof theme.drawOverview === 'function') { tryit('drawOverview', function () { theme.drawOverview(ctx, { marks: [{ rect: [100, 100, 60, 60], hero: 'dog' }, { rect: [400, 200, 40, 80], hero: 'taya', item: 'key' }, { rect: [0, 300, 40, 150], exit: true, icon: 'hut' }, { rect: [1, 1, 1, 1], hero: 'zzz' }], age: 0.8, dur: 5 }, 1); }); tryit('drawOverview пусто', function () { theme.drawOverview(ctx, { marks: [], age: 9 }, 1); }); }
    if (typeof theme.drawWalkbook === 'function') tryit('drawWalkbook', function () { theme.drawWalkbook(ctx, { page: 0, pages: 2, per: 2, total: 3, flip: { d: 1, t: 0.9 }, open: 0, time: 1, steps: [{ id: 'a', scene: null, icons: ['gear', 'key'], done: true, current: false, open: true, ink: null }, { id: 'b', scene: 'zzz', icons: ['gear'], done: false, current: true, open: true, ink: [{ i: 'lamp', mark: true }] }] }, LAYOUT, 1); });
    return { ok: errors.length === 0, errors: errors };
  }

  K.ThemeAPI = { version: '1.0', KINDS: KINDS, EXT_KINDS: EXT_KINDS, MOODS: MOODS, POSES: POSES, CURSORS: CURSORS, METHODS: METHODS,
    ICONS: ICONS, LAYOUT: LAYOUT, HOOKS: HOOKS, HELPER_POSES: HELPER_POSES, slotRect: slotRect, allKinds: allKinds, isKind: isKind,
    sampleScene: sampleScene, sampleUI: sampleUI, mockCtx: mockCtx, validateTheme: validateTheme };
})(typeof window !== 'undefined' ? window : globalThis);
