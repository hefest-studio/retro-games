/* ПОДРЯД · данные: снаряжение ангара (цены, ступени), враги Ржавой артели, наземные цели, секторы и сборщик заданий.
   Всё детерминировано: задание собирается из сида (сектор, номер) — одинаково у всех игроков, в тестах и у бота.
   PODRYAD.DATA = { ITEMS, GUNS, MODS, AIR, GROUND, SECTORS, buildMission(si, mj), ... }. */
(function (global) {
  'use strict';
  var P = global.PODRYAD = global.PODRYAD || {};

  // ---------- снаряжение ----------
  // Основные орудия: price — покупка (ступень 1), up[i] — цена перехода на ступень i+2 (до 5).
  var GUNS = {
    rivet: { price: 600, up: [500, 1000, 1800, 3000], base: true },   // Клепальник — выдаётся даром, двойная очередь
    fan: { price: 1800, up: [900, 1600, 2600, 4000] },                // Веерник — разлёт
    hammer: { price: 3200, up: [1200, 2000, 3200, 4800] },            // Молот — тяжёлые снаряды с разрывом (хорош по земле)
    arc: { price: 5000, up: [1600, 2600, 4000, 6000] }                // Дуговик — пробивающие разряды
  };
  var GUN_IDS = ['rivet', 'fan', 'hammer', 'arc'];
  // Боковые модули: ставятся в левое/правое гнездо крыла (по одному в гнездо).
  var MODS = {
    turret: { price: 1800 },   // турель — сама наводится на ближайшую цель
    homer: { price: 2400 },    // самонаводки — ракеты с доворотом
    scythe: { price: 3600 }    // лазер-коса — короткий взмах перед крылом, срезает пули
  };
  var MOD_IDS = ['turret', 'homer', 'scythe'];
  // Особые
  var SPECIAL = {
    mega: { price: 700, max: 5 },              // мега-бомба (расходник)
    cell: { price: 400, max: 3 },              // щит-энергия: ячейка мгновенно заряжает щит (расходник)
    gen: { up: [2000, 3500, 5500], max: 3 }    // щит-генератор: ступени 1..3 — ёмкость и подзарядка щита
  };
  var REPAIR = 12;          // цена 1 ед. брони
  var ARMOR_MAX = 100;
  var START_MONEY = 1200;
  function shieldCap(gen) { return 30 + 20 * gen; }
  function shieldRegen(gen) { return 3 + 2 * gen; }

  // Строки ангара (порядок показа). kind: gun | mod | mega | cell | gen | repair | go
  var SHOP = [
    { id: 'g:rivet', kind: 'gun', key: 'rivet' }, { id: 'g:fan', kind: 'gun', key: 'fan' },
    { id: 'g:hammer', kind: 'gun', key: 'hammer' }, { id: 'g:arc', kind: 'gun', key: 'arc' },
    { id: 'm:turret', kind: 'mod', key: 'turret' }, { id: 'm:homer', kind: 'mod', key: 'homer' }, { id: 'm:scythe', kind: 'mod', key: 'scythe' },
    { id: 'x:gen', kind: 'gen', key: 'gen' }, { id: 'x:mega', kind: 'mega', key: 'mega' }, { id: 'x:cell', kind: 'cell', key: 'cell' },
    { id: 'repair', kind: 'repair', key: 'repair' }, { id: 'go', kind: 'go', key: 'go' }
  ];

  // ---------- враги Ржавой артели ----------
  // hp — прочность, r — радиус, pay — плата за сбитого, fire — интервал огня (с), 0 — не стреляет
  var AIR = {
    gnat: { hp: 3, r: 11, pay: 12, fire: 3.2 },          // мошка — винтовой дрон
    kite: { hp: 6, r: 13, pay: 22, fire: 1.3 },        // змей — планер, бьёт прицельно
    hook: { hp: 8, r: 13, pay: 28, fire: 0 },          // крюк — пикирует на пилота
    barrel: { hp: 20, r: 17, pay: 55, fire: 1.15 },    // бочка — летучая цистерна, веер из трёх
    tug: { hp: 44, r: 22, pay: 110, fire: 1.6 }        // буксир — тяжёлый, кольцо заклёпок
  };
  // наземные цели на парящих островах: дают деньги, склады и цеха роняют контейнеры
  var GROUND = {
    flak: { hp: 10, r: 13, pay: 40, fire: 1.5 },      // зенитная лебёдка — стреляет
    depot: { hp: 16, r: 18, pay: 70, drop: 'coin' },  // склад — контейнер с деньгами
    factory: { hp: 34, r: 24, pay: 160, drop: 'box' }, // цех — контейнер (деньги / броня / бомба)
    tank: { hp: 22, r: 16, pay: 90, drop: 'coin' }    // газгольдер
  };
  // мид-боссы и боссы секторов: hp, r, pay
  var BOSSES = {
    zep: { hp: 320, r: 46, pay: 500, mid: true },     // клёпаный дирижабль — мид-босс
    crane: { hp: 900, r: 60, pay: 1500 },              // Бригадир-кран — босс сектора 1
    lock: { hp: 1300, r: 64, pay: 2000 },              // Шлюзовой молот — босс сектора 2
    elder: { hp: 1800, r: 70, pay: 2600 }              // Старшина артели — босс сектора 3
  };
  var DIFF = {
    easy: { hp: 0.8, dmg: 0.6, rate: 0.7, bspd: 0.85 },
    normal: { hp: 1, dmg: 1, rate: 1, bspd: 1 },
    hard: { hp: 1.2, dmg: 1.3, rate: 1.3, bspd: 1.1 }
  };
  var DIFFS = ['easy', 'normal', 'hard'];

  // ---------- секторы ----------
  // pal — индекс палитры неба/островов в рендере; boss — босс третьего задания сектора
  var SECTORS = [
    { boss: 'crane', pal: 0, hard: 0 },
    { boss: 'lock', pal: 1, hard: 1 },
    { boss: 'elder', pal: 2, hard: 2 }
  ];
  var MISSION_T = 78;        // длительность полёта до финала (с)
  var SCROLL = 44;           // скорость прокрутки островов (px/с)
  // минимально необходимое на задание: столько нужно заработать, чтобы отремонтироваться и докупить
  // то, без чего следующее задание заметно тяжелее (проверяется тестом: в задании столько можно заработать)
  var NEED = [1200, 1500, 2200, 2200, 2600, 3200, 3000, 3600, 4200];

  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  // Сборщик задания: волны (t — время появления), острова и наземные цели (y — дистанция прокрутки, на которой
  // объект показывается сверху), мид-босс, босс сектора у третьего задания.
  function buildMission(si, mj) {
    var rnd = mulberry32(1000 + si * 37 + mj * 11), h = si * 3 + mj;   // h — сквозной номер 0..8
    var waves = [], ground = [], isles = [];
    var FW = 440;
    function pick(a) { return a[(rnd() * a.length) | 0]; }
    // набор форм волн по нарастанию сложности
    var pool = [['gnat', 'line'], ['gnat', 'vee'], ['gnat', 'sine'], ['kite', 'sweep']];
    if (h >= 1) pool.push(['hook', 'dive'], ['kite', 'line']);
    if (h >= 2) pool.push(['barrel', 'hover']);
    if (h >= 3) pool.push(['hook', 'dive'], ['barrel', 'line'], ['kite', 'vee']);
    if (h >= 4) pool.push(['tug', 'hover']);
    if (h >= 6) pool.push(['tug', 'hover'], ['barrel', 'sweep']);
    var midT = mj === 2 ? 34 : 40, bossT = MISSION_T;
    var gap = 2.0 - h * 0.08, t = 2.5;
    while (t < MISSION_T - 3) {
      if (Math.abs(t - midT) < 7) { t += 1; continue; }                // мид-босс — без волн рядом
      var p = pick(pool), kind = p[0], form = p[1];
      var n = kind === 'tug' ? 1 : kind === 'barrel' ? (h >= 5 ? 2 : 1) : kind === 'hook' ? 3 + (h >> 2) : 4 + Math.min(3, h >> 1);
      var side = rnd() < 0.5 ? -1 : 1, x = 60 + rnd() * (FW - 120);
      waves.push({ t: Math.round(t * 10) / 10, kind: kind, form: form, n: n, x: Math.round(x), side: side });
      t += gap + rnd() * 1.2;
    }
    waves.push({ t: midT, boss: 'zep', mid: true });
    if (mj === 2) waves.push({ t: bossT, boss: SECTORS[si].boss });
    // острова: по ходу всей дистанции, на каждом 1–3 наземные цели
    var dist = MISSION_T * SCROLL, y = 120;
    var gk = ['depot', 'flak', 'tank', 'depot', 'factory'];
    if (h >= 2) gk.push('flak', 'factory');
    while (y < dist - 60) {
      var w = 120 + rnd() * 110, ix = 20 + rnd() * (FW - w - 40), ih = 70 + rnd() * 60;
      var isle = { x: Math.round(ix), y: Math.round(y), w: Math.round(w), h: Math.round(ih), s: (rnd() * 1e6) | 0 };
      isles.push(isle);
      var cnt = 1 + ((rnd() * (w > 180 ? 3 : 2)) | 0);
      for (var k = 0; k < cnt; k++) {
        var gt = pick(gk);
        ground.push({ kind: gt, x: Math.round(ix + w * 0.18 + (k + 0.5) * w * 0.64 / cnt), dy: Math.round(ih * (0.42 + 0.16 * rnd())), is: isles.length - 1 });
      }
      y += 150 + rnd() * 120;
    }
    return { si: si, mj: mj, h: h, waves: waves.sort(function (a, b) { return a.t - b.t; }), ground: ground, isles: isles, midT: midT, bossT: mj === 2 ? bossT : 0, dist: dist };
  }

  // Потенциальный заработок задания (все враги + все наземные цели + контейнеры по минимуму + боссы)
  function missionPotential(m) {
    var sum = 0;
    m.waves.forEach(function (w) { if (w.boss) sum += BOSSES[w.boss].pay; else sum += AIR[w.kind].pay * w.n; });
    m.ground.forEach(function (gd) { var G = GROUND[gd.kind]; sum += G.pay + (G.drop ? 50 : 0); });
    return Math.round(sum * (1 + 0.25 * m.si));
  }

  P.DATA = { GUNS: GUNS, GUN_IDS: GUN_IDS, MODS: MODS, MOD_IDS: MOD_IDS, SPECIAL: SPECIAL, REPAIR: REPAIR, ARMOR_MAX: ARMOR_MAX,
    START_MONEY: START_MONEY, shieldCap: shieldCap, shieldRegen: shieldRegen, SHOP: SHOP, AIR: AIR, GROUND: GROUND, BOSSES: BOSSES,
    DIFF: DIFF, DIFFS: DIFFS, SECTORS: SECTORS, MISSION_T: MISSION_T, SCROLL: SCROLL, NEED: NEED,
    buildMission: buildMission, missionPotential: missionPotential, mulberry32: mulberry32 };
})(typeof window !== 'undefined' ? window : globalThis);
