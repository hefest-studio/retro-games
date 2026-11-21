/* ПОРУБЕЖЬЕ · js/game.js — логика RTS без DOM (запускается и в браузере, и в Node для тестов).
   Карта-сетка, A*, юниты/здания трёх асимметричных родов, экономика (янтарь + смола или камень + руда, провизия),
   грибница Чащи, окаменение Курганного рода, туман войны, простой ИИ волнами. Всё, что видит игрок, — через game.cmd(p, …). */
(function (global) {
  'use strict';
  var P = global.PORUB = global.PORUB || {};

  var T = 32, MW = 64, MH = 48;            // тайл (px мира), размер карты в тайлах
  // SNOW — снег (проходим, медленнее, строить можно), ICE — лёд (проходим, строить нельзя), BRIDGE — настил моста (из пролётов 'span')
  var TERR = { GRASS: 0, WOOD: 1, WATER: 2, ROCK: 3, HEATH: 4, SNOW: 5, ICE: 6, BRIDGE: 7 };
  var PASS = [true, false, false, false, true, true, true, true];
  var BUILD = [true, false, false, false, true, true, false, false];
  var TSPD = [1, 1, 1, 1, 1, 0.78, 1, 1];   // множитель скорости по земле (снег — вязнут)

  // ---------- Расы ----------
  // ед.: hp, spd (тайл/с), sight/range (тайлы), dmg, cd (с), cost {a: янтарь, r: смола}, sup (провизия), time (с), r (радиус px)
  var RACES = {
    wright: { // Мастеровые: строят рабочими, здания и шагоход чинятся, раны не заживают
      main: 'hall', worker: 'worker', supply: 'house', grow: false,
      units: {
        worker:  { hp: 40, spd: 2.6, sight: 6, range: 0.4, dmg: 4, cd: 1.2, cost: { a: 50, r: 0 }, sup: 1, time: 12, r: 9, worker: true, from: 'hall' },
        shooter: { hp: 50, spd: 2.4, sight: 8, range: 5, dmg: 8, cd: 1.2, cost: { a: 50, r: 15 }, sup: 1, time: 15, r: 9, from: 'gunhouse', ranged: true },
        walker:  { hp: 220, armor: 2, spd: 1.6, sight: 9, range: 6, dmg: 20, splash: 1.0, cd: 2.4, cost: { a: 125, r: 75 }, sup: 3, time: 28, r: 15, mech: true, from: 'boiler', ranged: true },
        // герои кампании (не обучаются): воевода Ярина — знамя ускоряет стройку рядом; изобретатель Тихон — строит и чинит вдвое быстрее
        yarina:  { hp: 200, armor: 1, spd: 2.6, sight: 9, range: 4.5, dmg: 11, cd: 1.0, cost: { a: 0, r: 0 }, sup: 0, time: 1, r: 10, hero: true, ranged: true, ability: 'banner' },
        tikhon:  { hp: 130, spd: 2.5, sight: 7, range: 0.4, dmg: 5, cd: 1.2, cost: { a: 0, r: 0 }, sup: 0, time: 1, r: 10, hero: true, worker: true, craft: 2 },
        // кампания: Топотун Тихона — первый шагоход (герой-машина, чинится; F — топот: урон всем врагам рядом); сани с беженцами (не воюют, чинятся)
        stomper: { hp: 560, armor: 3, spd: 1.7, sight: 9, range: 6, dmg: 24, splash: 1.2, cd: 2.2, cost: { a: 0, r: 0 }, sup: 0, time: 1, r: 17, mech: true, hero: true, ranged: true, ability: 'stomp' },
        sled:    { hp: 170, spd: 1.5, sight: 5, range: 0, dmg: 0, cd: 9, cost: { a: 0, r: 0 }, sup: 0, time: 1, r: 13, mech: true, civil: true }
      },
      buildings: {
        hall:     { s: 4, hp: 1500, cost: { a: 400, r: 0 }, time: 70, sup: 10, sight: 9, trains: ['worker'], drop: true },
        house:    { s: 2, hp: 400, cost: { a: 100, r: 0 }, time: 22, sup: 8, sight: 5 },
        gunhouse: { s: 3, hp: 800, cost: { a: 150, r: 0 }, time: 35, sight: 6, trains: ['shooter'] },
        boiler:   { s: 3, hp: 900, cost: { a: 150, r: 100 }, time: 45, sight: 6, trains: ['walker'], req: 'gunhouse' },
        // пролёт моста (кампания): ставится на воду у берега/готового пролёта; достроен — клетки становятся настилом, снесён — снова вода
        span:     { s: 2, hp: 600, cost: { a: 100, r: 0 }, time: 40, sight: 4, deck: true, extra: true }
      },
      order: ['house', 'gunhouse', 'boiler', 'hall']
    },
    thicket: { // Живая чаща: здания растут из ростка на грибнице, юниты — из личинок Пня-матери, раны заживают
      main: 'stump', worker: 'beetle', supply: 'hollow', grow: true,
      units: {
        beetle:  { hp: 40, spd: 2.7, sight: 6, range: 0.4, dmg: 4, cd: 1.2, cost: { a: 50, r: 0 }, sup: 1, time: 11, r: 9, worker: true, regen: 0.4 },
        stinger: { hp: 60, spd: 3.3, sight: 7, range: 0.45, dmg: 6, cd: 0.75, cost: { a: 50, r: 10 }, sup: 1, time: 14, r: 10, regen: 0.8, req: 'den' },
        shell:   { hp: 300, armor: 3, spd: 1.4, sight: 8, range: 3.5, dmg: 14, splash: 0.8, cd: 1.8, cost: { a: 100, r: 100 }, sup: 3, time: 26, r: 15, regen: 1.5, req: 'barrow', ranged: true },
        // кампания: жук-посол (не воюет, не обучается)
        envoy:   { hp: 90, spd: 2.4, sight: 6, range: 0, dmg: 0, cd: 9, cost: { a: 0, r: 0 }, sup: 0, time: 1, r: 10, regen: 0.5, civil: true },
        // кампания Чащи «Пока растёт грибница» (camp — только в миссиях, где разрешены allowU; в скирмише их нет):
        // Матушка-Пень — подвижное сердце рода: под ней грибница (myc, клетки) и тепло, рядом раны заживают быстрее (heal); F — корни
        matushka: { hp: 320, armor: 2, spd: 1.5, sight: 9, range: 3, dmg: 10, splash: 0.6, cd: 1.6, cost: { a: 0, r: 0 }, sup: 0, time: 1, r: 15, regen: 2.5, hero: true, ranged: true, ability: 'roots', myc: 3.5, heal: { r: 3.5, hps: 3 } },
        // Шмель — молодой жалильщик-вожак; F — гул (отряд рядом быстрее)
        shmel:   { hp: 140, armor: 1, spd: 3.5, sight: 8, range: 0.45, dmg: 9, cd: 0.6, cost: { a: 0, r: 0 }, sup: 0, time: 1, r: 11, regen: 1.2, hero: true, ability: 'buzz' },
        // светляк — живой маяк: не воюет (passive), ночью видит в полную силу (glow)
        firefly: { hp: 30, spd: 3.4, sight: 8, range: 0, dmg: 0, cd: 9, cost: { a: 25, r: 0 }, sup: 1, time: 8, r: 8, regen: 0.6, glow: true, passive: true, camp: true },
        // рой-опылитель: стоит у вырубки — там снова вырастает лес (pollen)
        swarm:   { hp: 45, spd: 2.6, sight: 6, range: 0, dmg: 0, cd: 9, cost: { a: 50, r: 20 }, sup: 1, time: 12, r: 10, regen: 0.8, pollen: true, passive: true, camp: true }
        // + frostling (стужевик) — ниже, общий для обеих рас
      },
      buildings: {
        stump:  { s: 4, hp: 1400, cost: { a: 350, r: 0 }, time: 60, sup: 10, sight: 9, larva: true, drop: true, myc: 7, regen: 3, anywhere: true },
        hollow: { s: 2, hp: 350, cost: { a: 100, r: 0 }, time: 22, sup: 8, sight: 5, myc: 4, regen: 1 },
        den:    { s: 3, hp: 700, cost: { a: 150, r: 0 }, time: 32, sight: 6, myc: 3, regen: 1.5 },
        barrow: { s: 3, hp: 850, cost: { a: 150, r: 100 }, time: 42, sight: 6, myc: 3, regen: 1.5, req: 'den' }
      },
      order: ['hollow', 'den', 'barrow', 'stump']
    },
    barrow: { // Курганный род: каменотёсы с перевалов — камень и руда, очаги вместо изб, стоящие бойцы каменеют (броня), здания — камень (броня)
      main: 'kurgan', worker: 'mason', supply: 'hearth', grow: false, nodes: { a: 'stone', r: 'ore' },
      units: {
        mason:    { hp: 45, spd: 2.4, sight: 6, range: 0.4, dmg: 4, cd: 1.2, cost: { a: 50, r: 0 }, sup: 1, time: 12, r: 9, worker: true, from: 'kurgan' },
        slinger:  { hp: 60, spd: 2.3, sight: 8, range: 4.5, dmg: 9, cd: 1.25, cost: { a: 50, r: 15 }, sup: 1, time: 15, r: 9, from: 'slingery', ranged: true, petrify: true },
        // валун-страж: медленный, с разбега раскатывается по прямой (roll) и сшибает первого врага
        boulder:  { hp: 280, armor: 2, spd: 1.35, sight: 8, range: 0.6, dmg: 17, splash: 0.7, cd: 1.6, cost: { a: 110, r: 80 }, sup: 3, time: 26, r: 15, from: 'stoneworks', petrify: true, roll: true },
        // кампания «Голос камня»: старейшина Ведогор (F — пробудить идолов / голос камня), резчица Зорянка (строит и чинит за двоих)
        vedogor:  { hp: 260, armor: 2, spd: 2.3, sight: 9, range: 4, dmg: 10, cd: 1.1, cost: { a: 0, r: 0 }, sup: 0, time: 1, r: 11, hero: true, ranged: true, petrify: true, ability: 'wake' },
        zoryanka: { hp: 140, spd: 2.6, sight: 8, range: 0.4, dmg: 5, cd: 1.1, cost: { a: 0, r: 0 }, sup: 0, time: 1, r: 10, hero: true, worker: true, craft: 2, petrify: true },
        // пастухи с козами (мирные) и волокуша с очагом (мирная, вокруг неё тепло — warmR клеток)
        herder:   { hp: 60, spd: 2.2, sight: 5, range: 0, dmg: 0, cd: 9, cost: { a: 0, r: 0 }, sup: 0, time: 1, r: 10, civil: true },
        cart:     { hp: 320, armor: 1, spd: 1.4, sight: 6, range: 0, dmg: 0, cd: 9, cost: { a: 0, r: 0 }, sup: 0, time: 1, r: 14, mech: true, civil: true, warmR: 4.5 }
      },
      buildings: {
        kurgan:     { s: 4, hp: 1600, armor: 2, cost: { a: 400, r: 0 }, time: 70, sup: 10, sight: 9, trains: ['mason'], drop: true, warm: true },
        hearth:     { s: 2, hp: 450, armor: 2, cost: { a: 100, r: 0 }, time: 22, sup: 8, sight: 5, warm: true },
        slingery:   { s: 3, hp: 850, armor: 2, cost: { a: 150, r: 0 }, time: 35, sight: 6, trains: ['slinger'] },
        stoneworks: { s: 3, hp: 950, armor: 2, cost: { a: 150, r: 100 }, time: 45, sight: 6, trains: ['boulder'], req: 'slingery' },
        // кампания: каменная стена (клетка), идол (спит, пока его не разбудит Ведогор; бодрый — бьёт врагов рунами)
        wall:       { s: 1, hp: 520, armor: 3, cost: { a: 30, r: 0 }, time: 10, sight: 3, extra: true },
        idol:       { s: 2, hp: 900, armor: 2, cost: { a: 0, r: 0 }, time: 1, sight: 7, atk: { range: 6, dmg: 12, cd: 1.5 }, camp: true }
      },
      order: ['hearth', 'slingery', 'stoneworks', 'kurgan']
    }
  };
  RACES.wright.nodes = { a: 'amber', r: 'resin' }; RACES.thicket.nodes = { a: 'amber', r: 'resin' };
  ['hall', 'house', 'boiler'].forEach(function (k) { RACES.wright.buildings[k].warm = true; });
  // стужевик — живой холод Зимнего вала (кампания; сторона врага любой расы): мороз и вал ему не помеха (frost)
  var FROSTLING = { hp: 70, spd: 2.4, sight: 7, range: 0.45, dmg: 7, cd: 1.0, cost: { a: 0, r: 0 }, sup: 0, time: 1, r: 10, frost: true, camp: true };
  RACES.thicket.units.frostling = FROSTLING; RACES.wright.units.frostling = FROSTLING; RACES.barrow.units.frostling = FROSTLING;
  // сердце Зимнего вала (общий финал «Весна»): ледяная глыба стороны врага; морозу не подвластна (frost), рану ей наносят только три силы сразу
  var ICEHEART = { s: 4, hp: 3000, armor: 4, cost: { a: 0, r: 0 }, time: 1, sight: 8, frost: true, camp: true };
  RACES.thicket.buildings.iceheart = ICEHEART; RACES.wright.buildings.iceheart = ICEHEART; RACES.barrow.buildings.iceheart = ICEHEART;
  var LARVA_MAX = 3, LARVA_EVERY = 8, SUP_MAX = 60, QUEUE_MAX = 5;
  // механики кампании Чащи: дым котелен, споры, корни, гул, опыление, корни под льдом
  var SMOKE = { dps: 1.2 };                                             // в дыму (b.smoke — радиус, клетки) бойцы Чащи чахнут и не заживают
  var SPORE = { range: 11, wind: 5, cost: 60, cd: 20, fly: 2.5 };       // споры: дальность + ветер (по направлению ветра — дальше)
  var ROOTS = { r: 3.2, s: 4, cd: 30 };                                 // корни Матушки: враги рядом не ходят s секунд
  var BUZZ = { r: 5, s: 6, cd: 30, mul: 1.5 };                          // гул Шмеля: свои рядом быстрее
  var POLLEN = { t: 6, r: 2.5 };                                        // рой-опылитель: клетка вырубки → лес раз в t секунд
  var THAW = { t: 4, push: 0.35, need: 6, back: 3, front: 1 };          // корни под льдом: лёд под грибницей тает за t с; у кромки вала — толкают вал
  // timber — сухостой (дрова, ресурс кампании): rk — ключ ресурса в res[p]
  // Курганный род: stone — каменная россыпь (как янтарь, ключ 'a'), ore — рудная жила 2×2 (как смола, ключ 'r')
  var GATHER = { amber: { amt: 5, t: 1.6 }, resin: { amt: 4, t: 2.2 }, timber: { amt: 4, t: 3.0 }, stone: { amt: 5, t: 1.6 }, ore: { amt: 4, t: 2.2 } };
  var NODE_AMT = { amber: 1200, resin: 3000, timber: 300, stone: 1200, ore: 3000 };
  var RKEY = { amber: 'a', resin: 'r', timber: 'w', stone: 'a', ore: 'r' };
  var BIG = { resin: 1, ore: 1 };   // месторождения 2×2
  // окаменение (Курганный род): боец, простоявший PETRIFY.t с, каменеет — броня +armor; сдвинуть — wake с «стряхивает камень»
  var PETRIFY = { t: 2.5, armor: 3, wake: 0.7 };
  // раскат валуна-стража: цель в min…max клеток по прямой — катится (spd ×), сшибает первого врага (dmg + разлёт splash), перезарядка cd
  var ROLL = { min: 2.5, max: 7, spd: 3.2, dmg: 35, splash: 1.2, dur: 2.2, cd: 10 };
  // F Ведогора: будит спящих идолов в r клетках; рядом нет идолов — «голос камня»: свои бойцы рядом сразу каменеют; перезарядка cd
  var WAKE = { r: 5, cd: 20 };
  var REPAIR_HPS = 14;

  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  // ---------- Двоичная куча для A* ----------
  function Heap() { this.a = []; this.p = []; }
  Heap.prototype.push = function (v, pr) {
    var a = this.a, p = this.p, i = a.length; a.push(v); p.push(pr);
    while (i > 0) { var j = (i - 1) >> 1; if (p[j] <= pr) break; a[i] = a[j]; p[i] = p[j]; i = j; }
    a[i] = v; p[i] = pr;
  };
  Heap.prototype.pop = function () {
    var a = this.a, p = this.p, top = a[0], lv = a.pop(), lp = p.pop(), n = a.length;
    if (n) {
      var i = 0;
      for (;;) { var l = 2 * i + 1, r = l + 1, m = i, mp = lp;
        if (l < n && p[l] < mp) { m = l; mp = p[l]; } if (r < n && p[r] < mp) { m = r; mp = p[r]; }
        if (m === i) break; a[i] = a[m]; p[i] = p[m]; i = m; }
      a[i] = lv; p[i] = lp;
    }
    return top;
  };
  Object.defineProperty(Heap.prototype, 'size', { get: function () { return this.a.length; } });

  // ---------- Карта (центрально-симметричная: обе стороны в равных условиях) ----------
  var BASES = [{ tx: 6, ty: 6 }, { tx: MW - 10, ty: MH - 10 }]; // левый верхний угол главного здания 4×4
  var AMBER0 = [[14, 5], [15, 7], [15, 9], [14, 11], [12, 12], [10, 13]];
  var RESIN0 = [4, 14];                                          // 2×2
  var EXP0 = { amber: [[9, 33], [10, 35], [12, 36], [14, 36]], resin: [6, 36] };
  function mir(x, y, s) { s = s || 1; return [MW - x - s, MH - y - s]; }

  function genMap(seed) {
    for (var attempt = 0; attempt < 40; attempt++) {
      var rng = mulberry32((seed || 1) * 7919 + attempt * 101), terr = new Uint8Array(MW * MH);
      var set = function (x, y, v) { if (x >= 0 && y >= 0 && x < MW && y < MH) { terr[y * MW + x] = v; var m = mir(x, y); terr[m[1] * MW + m[0]] = v; } };
      var clear = [];  // зоны, где не растёт лес
      clear.push([BASES[0].tx + 2, BASES[0].ty + 2, 11], [11, 35, 6], [MW / 2, MH / 2, 5]);
      var inClear = function (x, y) { for (var i = 0; i < clear.length; i++) { var c = clear[i]; for (var k = 0; k < 2; k++) { var cx = k ? MW - c[0] : c[0], cy = k ? MH - c[1] : c[1]; if ((x - cx) * (x - cx) + (y - cy) * (y - cy) < c[2] * c[2]) return true; } } return false; };
      // кромка леса по краю
      for (var x = 0; x < MW; x++) for (var y = 0; y < MH; y++) if (x === 0 || y === 0 || x === MW - 1 || y === MH - 1) terr[y * MW + x] = TERR.WOOD;
      // боры (сгустки леса)
      for (var b = 0; b < 26; b++) {
        var cx = 2 + Math.floor(rng() * (MW - 4)), cy = 2 + Math.floor(rng() * (MH / 2 + 4)), rr = 1.2 + rng() * 2.6;
        for (var dx = -4; dx <= 4; dx++) for (var dy = -4; dy <= 4; dy++) {
          var px = cx + dx, py = cy + dy; if (px < 1 || py < 1 || px > MW - 2 || py > MH - 2) continue;
          if (dx * dx + dy * dy <= rr * rr * (0.7 + rng() * 0.5) && !inClear(px, py)) set(px, py, TERR.WOOD);
        }
      }
      // озёра (по озеру на сторону) и валуны
      var lakes = [[22, 14, 2.6], [36, 9, 1.8]];
      lakes.forEach(function (L) { for (var dx = -4; dx <= 4; dx++) for (var dy = -4; dy <= 4; dy++) if (dx * dx + dy * dy <= L[2] * L[2]) set(L[0] + dx, L[1] + dy, TERR.WATER); });
      for (var k = 0; k < 10; k++) { var rx = 3 + Math.floor(rng() * (MW - 6)), ry = 3 + Math.floor(rng() * (MH / 2)); if (!inClear(rx, ry)) set(rx, ry, TERR.ROCK); }
      // вереск/мох — проходимое украшение
      for (var h = 0; h < 130; h++) { var hx = 1 + Math.floor(rng() * (MW - 2)), hy = 1 + Math.floor(rng() * (MH - 2)); if (terr[hy * MW + hx] === TERR.GRASS) set(hx, hy, TERR.HEATH); }
      // проверка связности: от базы 0 до базы 1 и до каждого месторождения
      if (connected(terr)) return terr;
    }
    throw new Error('map: нет связной карты');
  }
  function connected(terr) {
    var seen = new Uint8Array(MW * MH), q = [], s = (BASES[0].ty + 5) * MW + BASES[0].tx + 5;
    if (!PASS[terr[s]]) return false; seen[s] = 1; q.push(s);
    while (q.length) { var c = q.pop(), x = c % MW, y = (c / MW) | 0;
      for (var d = 0; d < 4; d++) { var nx = x + [1, -1, 0, 0][d], ny = y + [0, 0, 1, -1][d]; if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) continue; var n = ny * MW + nx; if (!seen[n] && PASS[terr[n]]) { seen[n] = 1; q.push(n); } } }
    var t = (BASES[1].ty - 1) * MW + BASES[1].tx - 1;
    if (!seen[t]) return false;
    var pts = [[EXP0.resin[0] + 2, EXP0.resin[1]], [EXP0.amber[0][0] + 1, EXP0.amber[0][1]]];
    for (var i = 0; i < pts.length; i++) { if (!seen[pts[i][1] * MW + pts[i][0]]) return false; var m = mir(pts[i][0], pts[i][1]); if (!seen[m[1] * MW + m[0]]) return false; }
    return true;
  }

  // ---------- Карты скирмиша: генерируемая (gen, по умолчанию — как раньше) + три рисованные, все центрально-симметричные ----------
  // Раскладка: { id, w, h, terr, bases: [база 0, база 1], amber: [[[x, y]…] — списки россыпей стороны 0], resin: [[x, y] — жилы 2×2 стороны 0] };
  // сторона 1 получает зеркальные (w − x − s, h − y − s). Базы и ближние месторождения у всех карт — на тех же местах, что у gen.
  var MAP_IDS = ['gen', 'grove', 'pass', 'wide'];
  function Canvas(w, h, fill) {
    var terr = new Uint8Array(w * h), o = { w: w, h: h, terr: terr }; if (fill) terr.fill(fill);
    o.set = function (x, y, v) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < w && y < h) { terr[y * w + x] = v; terr[(h - 1 - y) * w + (w - 1 - x)] = v; } };
    o.get = function (x, y) { return x >= 0 && y >= 0 && x < w && y < h ? terr[y * w + x] : TERR.WOOD; };
    o.disk = function (cx, cy, r, v, only) { for (var y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (var x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) if ((x + 0.5 - cx) * (x + 0.5 - cx) + (y + 0.5 - cy) * (y + 0.5 - cy) <= r * r && (only == null || o.get(x, y) === only)) o.set(x, y, v); };
    o.rect = function (x0, y0, x1, y1, v) { for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) o.set(x, y, v); };
    // просека/дорога: ломаная pts, ширина wd клеток
    o.lane = function (pts, wd, v) { for (var i = 1; i < pts.length; i++) { var a = pts[i - 1], b = pts[i], n = Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])) * 2) || 1;
      for (var k = 0; k <= n; k++) { var x = a[0] + (b[0] - a[0]) * k / n, y = a[1] + (b[1] - a[1]) * k / n, x0 = Math.round(x - wd / 2), y0 = Math.round(y - wd / 2); o.rect(x0, y0, x0 + wd - 1, y0 + wd - 1, v); } } };
    o.edge = function () { for (var x = 0; x < w; x++) for (var y = 0; y < h; y++) if (x === 0 || y === 0 || x === w - 1 || y === h - 1) terr[y * w + x] = TERR.WOOD; };
    return o;
  }
  // базы и месторождения стоят на чистой земле (клетка вокруг — тоже), край — лес
  function finishL(L, c) {
    var clr = function (x, y, s, pad) { for (var yy = y - pad; yy < y + s + pad; yy++) for (var xx = x - pad; xx < x + s + pad; xx++) { var t = c.get(xx, yy); if (t !== TERR.GRASS && t !== TERR.HEATH) c.set(xx, yy, TERR.GRASS); } };
    clr(L.bases[0].tx, L.bases[0].ty, 4, 2);
    L.amber.forEach(function (list) { list.forEach(function (a) { clr(a[0], a[1], 1, 1); }); });
    L.resin.forEach(function (r) { clr(r[0], r[1], 2, 1); });
    c.edge(); L.terr = c.terr; return L;
  }
  // связность раскладки: от базы 0 можно дойти до базы 1 и до каждого месторождения (обеих сторон)
  function connectedL(L) {
    var w = L.w, h = L.h, terr = L.terr, seen = new Uint8Array(w * h), q = [], b0 = L.bases[0], s = (b0.ty + 5) * w + b0.tx + 5;
    if (!PASS[terr[s]]) return false; seen[s] = 1; q.push(s);
    while (q.length) { var c = q.pop(), x = c % w, y = (c / w) | 0;
      for (var d = 0; d < 4; d++) { var nx = x + [1, -1, 0, 0][d], ny = y + [0, 0, 1, -1][d]; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue; var n = ny * w + nx; if (!seen[n] && PASS[terr[n]]) { seen[n] = 1; q.push(n); } } }
    var near = function (x, y, s) { for (var yy = y - 1; yy <= y + s; yy++) for (var xx = x - 1; xx <= x + s; xx++) if (xx >= 0 && yy >= 0 && xx < w && yy < h && seen[yy * w + xx]) return true; return false; };
    var b1 = L.bases[1]; if (!near(b1.tx, b1.ty, 4)) return false;
    var all = []; L.amber.forEach(function (list) { list.forEach(function (a) { all.push([a[0], a[1], 1]); }); }); L.resin.forEach(function (r) { all.push([r[0], r[1], 2]); });
    for (var i = 0; i < all.length; i++) { var a = all[i]; if (!near(a[0], a[1], a[2]) || !near(w - a[0] - a[2], h - a[1] - a[2], a[2])) return false; }
    return true;
  }
  var MAPS = {
    // генерируемая карта 64×48 (сид — новый рисунок боров, озёр и камней) — та же, что была единственной
    gen: function (seed) { return { id: 'gen', w: MW, h: MH, terr: genMap(seed), bases: BASES, amber: [AMBER0, EXP0.amber], resin: [RESIN0, EXP0.resin] }; },
    // «Чаща»: сплошной бор, поляны у баз, у дальних месторождений и в центре, между ними — узкие просеки (2–3 клетки)
    grove: function (seed) {
      var c = Canvas(MW, MH, TERR.WOOD), rng = mulberry32((seed || 1) * 131 + 7);
      c.disk(8, 8, 10.5, TERR.GRASS); c.disk(11, 35.5, 6.2, TERR.GRASS); c.disk(32, 24, 5.5, TERR.GRASS); c.disk(31, 8, 3.2, TERR.GRASS);
      c.lane([[14, 13], [21, 17], [28, 22]], 3, TERR.GRASS);              // от базы к центру
      c.lane([[7, 16], [8, 23], [10, 30]], 2, TERR.GRASS);                // от базы к своему дальнему месторождению
      c.lane([[16, 35], [22, 32], [28, 27]], 2, TERR.GRASS);              // от дальнего месторождения к центру
      c.lane([[17, 5], [31, 8], [43, 9], [50, 12]], 2, TERR.GRASS);       // северная просека: мимо лесной поляны к чужому дальнему месторождению
      for (var h = 0; h < 110; h++) { var hx = 1 + Math.floor(rng() * (MW - 2)), hy = 1 + Math.floor(rng() * (MH - 2)); if (c.get(hx, hy) === TERR.GRASS) c.set(hx, hy, TERR.HEATH); }
      return finishL({ id: 'grove', w: MW, h: MH, bases: BASES, amber: [AMBER0, EXP0.amber], resin: [RESIN0, EXP0.resin] }, c);
    },
    // «Перевал»: поперёк карты — река с ледяными бродами (центр и два края), вдоль неё каменные гряды с проходами, снежные поля (вязнут)
    pass: function (seed) {
      var c = Canvas(MW, MH, TERR.GRASS), rng = mulberry32((seed || 1) * 977 + 3), x, y;
      for (x = 0; x < MW; x++) { var yc = (MH - 1) / 2 + 2.4 * Math.sin((x - (MW - 1) / 2) * 0.17);
        for (y = Math.floor(yc - 3.2); y <= Math.ceil(yc + 3.2); y++) { var d = Math.abs(y - yc); c.set(x, y, d <= 1.7 ? TERR.WATER : d <= 2.6 ? TERR.ICE : TERR.SNOW); } }
      for (x = 0; x < MW; x++) for (y = 0; y < MH; y++) { var ford = (x >= 29 && x <= 34) || (x >= 8 && x <= 11); if (ford && c.get(x, y) === TERR.WATER) c.set(x, y, TERR.ICE); }
      c.rect(17, 14, 28, 15, TERR.ROCK); c.rect(35, 14, 46, 15, TERR.ROCK);       // гряды со своей стороны реки (зеркально — с чужой), проход в центре
      c.rect(17, 12, 18, 13, TERR.ROCK); c.rect(45, 12, 46, 13, TERR.ROCK);
      [[22, 19, 3.6], [42, 19, 3], [13, 22, 2.6], [52, 21, 2.4], [30, 11, 2.2]].forEach(function (s) { c.disk(s[0], s[1], s[2], TERR.SNOW, TERR.GRASS); });
      [[25, 4, 2.4], [48, 4, 2], [3, 24, 2.2], [20, 9, 1.6]].forEach(function (s) { c.disk(s[0], s[1], s[2], TERR.WOOD); });
      for (var k = 0; k < 8; k++) { var rx = 4 + Math.floor(rng() * (MW - 8)), ry = 3 + Math.floor(rng() * 16); if (Math.hypot(rx - 8, ry - 8) > 12 && Math.hypot(rx - 42, ry - 6) > 5) c.set(rx, ry, TERR.ROCK); }
      for (var h = 0; h < 120; h++) { var hx = 1 + Math.floor(rng() * (MW - 2)), hy = 1 + Math.floor(rng() * (MH - 2)); if (c.get(hx, hy) === TERR.GRASS) c.set(hx, hy, TERR.HEATH); }
      return finishL({ id: 'pass', w: MW, h: MH, bases: BASES, amber: [AMBER0, [[39, 4], [41, 5], [43, 4], [42, 7]]], resin: [RESIN0, [45, 6]] }, c);
    },
    // «Раздолье»: большая карта 88×66, у каждой стороны база и ещё 4 месторождения на карте (по два ближе к каждой стороне)
    wide: function (seed) {
      var W2 = 88, H2 = 66, B2 = [{ tx: 6, ty: 6 }, { tx: W2 - 10, ty: H2 - 10 }];
      var L = { id: 'wide', w: W2, h: H2, bases: B2, amber: [AMBER0, [[8, 50], [9, 52], [11, 53], [13, 53]], [[40, 5], [42, 6], [44, 5], [43, 8]]], resin: [RESIN0, [5, 53], [46, 7]] };
      var clear = [[8, 8, 11], [10, 52, 6], [43, 7, 5], [W2 / 2, H2 / 2, 6]];
      for (var attempt = 0; attempt < 40; attempt++) {
        var c = Canvas(W2, H2, TERR.GRASS), rng = mulberry32((seed || 1) * 4099 + attempt * 61);
        var inClear = function (x, y) { for (var i = 0; i < clear.length; i++) { var q = clear[i]; if (Math.hypot(x - q[0], y - q[1]) < q[2] || Math.hypot(x - (W2 - q[0]), y - (H2 - q[1])) < q[2]) return true; } return false; };
        for (var b = 0; b < 46; b++) { var cx = 2 + Math.floor(rng() * (W2 - 4)), cy = 2 + Math.floor(rng() * (H2 / 2 + 4)), rr = 1.2 + rng() * 2.8;
          for (var dx = -4; dx <= 4; dx++) for (var dy = -4; dy <= 4; dy++) if (dx * dx + dy * dy <= rr * rr * (0.7 + rng() * 0.5) && !inClear(cx + dx, cy + dy)) c.set(cx + dx, cy + dy, TERR.WOOD); }
        [[28, 20, 2.8], [60, 14, 2.2], [24, 38, 2.4]].forEach(function (Lk) { c.disk(Lk[0], Lk[1], Lk[2], TERR.WATER); });
        for (var k = 0; k < 14; k++) { var rx = 3 + Math.floor(rng() * (W2 - 6)), ry = 3 + Math.floor(rng() * (H2 / 2)); if (!inClear(rx, ry)) c.set(rx, ry, TERR.ROCK); }
        for (var h = 0; h < 220; h++) { var hx = 1 + Math.floor(rng() * (W2 - 2)), hy = 1 + Math.floor(rng() * (H2 - 2)); if (c.get(hx, hy) === TERR.GRASS) c.set(hx, hy, TERR.HEATH); }
        finishL(L, c); if (connectedL(L)) return L;
      }
      throw new Error('map: нет связной карты');
    }
  };
  function skirmLayout(id, seed) { var L = (MAPS[id] || MAPS.gen)(seed); if (L.id !== 'gen' && !connectedL(L)) throw new Error('map ' + L.id + ': не связна'); return L; }

  // ---------- Игра ----------
  // opts.map — карта миссии (кампания): { w, h, terr: Uint8Array, nodes: [{ type, tx, ty, amt }] } — без случайной карты,
  // стартовых баз и ИИ скирмиша (их ставит js/campaign.js). opts.endRule: 'blds' (по умолчанию: нет зданий — поражение) | 'none'.
  function Game(opts) {
    opts = opts || {};
    var self = this, M = opts.map || null, L = M ? null : skirmLayout(opts.mapId, opts.seed || 1);   // L — раскладка карты скирмиша
    this.T = T; this.MW = M ? M.w : L.w; this.MH = M ? M.h : L.h; this.mapId = L ? L.id : null; this.bases = L ? L.bases : null;
    this.rng = opts.rng || mulberry32(opts.seed || 1);
    this.onEvent = opts.onEvent || function () {};
    this.races = [opts.playerRace || 'wright', opts.aiRace || (opts.playerRace === 'thicket' ? 'wright' : 'thicket')];
    if (opts.thirdRace) this.races.push(opts.thirdRace);   // кампания: третья сторона (owner 2 — союзник/нейтрал, отношения — setRel)
    if (opts.thirdRace && opts.fourthRace) this.races.push(opts.fourthRace);   // общий финал «Весна»: четвёртая сторона (owner 3)
    var NS = this.sides = this.races.length;
    this.rel = null;               // отношения сторон { 'a,b': 'enemy'|'neutral'|'ally' }; null — все стороны враги (скирмиш)
    this.terr = M ? M.terr : L.terr; this.seedKey = M ? (opts.key || 'map') : L.id === 'gen' ? (opts.seed || 1) : L.id + ':' + (opts.seed || 1); this.terrRev = 0;
    var N = this.MW * this.MH;
    this.occ = new Int32Array(N);          // id+1 здания/месторождения на тайле
    this.myc = []; this.vis = [];  // грибница по сторонам; туман: 0 — не разведано, 1 — разведано, 2 — видно
    for (var si = 0; si < NS; si++) { this.myc.push(new Uint8Array(N)); this.vis.push(new Uint8Array(N)); }
    this.ents = []; this.byId = new Map(); this.nextId = 1; this.t = 0;
    this.res = []; this.stats = [];
    for (var sj = 0; sj < NS; sj++) { this.res.push({ a: 150, r: 0, w: 0 }); this.stats.push({ kills: 0, lost: 0, lostB: 0, built: 0, trained: 0, gathered: 0, wood: 0, regrown: 0 }); }
    this.shots = []; this.winner = -1; this._visT = 0; this._mycDirty = true;
    this.fogOff = !!opts.fogOff; this.endRule = opts.endRule || 'blds';
    this.cold = 0;                 // мороз 0…1 (погода «Зимнего вала»): медленнее ходят вдали от тепла, медленнее добыча и стройка
    this.banners = [];             // знамёна Ярины: { x, y, r, until, owner }
    this.allowB = null;            // кампания: какие здания можно ставить (null — все из R.order)
    this.allowU = null;            // кампания: каких юнитов можно обучать (null — всех)
    this.flares = [];              // кампания: временный обзор игрока { x, y, r (клетки), until }
    this.wall = null;              // кампания: ползущий Зимний вал { dir: 's'|'n'|'e'|'w', pos (клетки), speed, dps, stop } — см. setWall
    // кампания Чащи: ночь 0…1 (обзор меньше, кроме glow), ветер для спор { x, y } (единичный вектор, null — штиль),
    // споры (sporeCfg: null — нельзя; полёты — sporeFly), корни под льдом (thaw: null — нет), вырубки (felled — маска клеток), дымы (smokes)
    this.night = 0; this.wind = null; this.sporeCfg = null; this.sporeFly = []; this.thaw = null; this._thawT = null; this._thawAcc = 0;
    this.felled = new Uint8Array(N); if (M && M.felled) M.felled.forEach(function (k) { self.felled[k] = 1; });
    this.young = new Uint8Array(N);   // подрост: вырубка, где рой-опылитель вырастил молодой лес (проходим, рисуется ёлочками)
    this.smokes = [];
    // кампания Курганного рода: буран (chill: { at, dps } — при морозе ≥ at вдали от тепла стынут и теряют здоровье), «камень хранит тепло»
    // (stoneRest: { hps } — окаменевшие не стынут, Зимний вал их не жжёт, раны затягиваются)
    this.chill = null; this.stoneRest = null;
    var addNode = function (type, tx, ty, amt) { var s = BIG[type] ? 2 : 1; return self._addEnt({ kind: 'n', type: type, owner: -1, tx: tx, ty: ty, s: s, amt: amt || NODE_AMT[type], amt0: amt || NODE_AMT[type], hp: 1, maxhp: 1 }); };
    this.addNode = addNode;
    if (M) { (M.nodes || []).forEach(function (n) { addNode(n.type, n.tx, n.ty, n.amt); }); }
    else {
      // месторождения: у своей базы и у ближней к ней россыпи — своего рода (Мастеровые и Чаща — янтарь и смола, Курганный род — камень и руда);
      // места те же (центральная симметрия), так что старт честный при любой паре рас
      var NA = [RACES[this.races[0]].nodes, RACES[this.races[1]].nodes], mr = function (x, y, s) { s = s || 1; return [L.w - x - s, L.h - y - s]; };
      L.amber.forEach(function (list) { list.forEach(function (a) { addNode(NA[0].a, a[0], a[1]); var m = mr(a[0], a[1]); addNode(NA[1].a, m[0], m[1]); }); });
      L.resin.forEach(function (r) { addNode(NA[0].r, r[0], r[1]); var m = mr(r[0], r[1], 2); addNode(NA[1].r, m[0], m[1]); });
      // стартовые базы
      for (var p = 0; p < 2; p++) {
        var R = RACES[this.races[p]], B = L.bases[p];
        var main = this._addBuilding(p, R.main, B.tx, B.ty, true);
        for (var i = 0; i < 5; i++) { var sp = this._spawnPoint(main, i); this._addUnit(p, R.worker, sp.x, sp.y); }
        if (R.grow) main.larva = LARVA_MAX;
      }
    }
    this._recalcMyc();
    this.ai = opts.noAI || M ? null : new AI(this, 1, opts.ai);          // opts.ai / opts.ai0 — сложность ИИ: 'easy' | 'normal' (по умолчанию) | 'hard'
    if (opts.aiBoth) this.ai0 = new AI(this, 0, opts.ai0);
    this._updateVis();
  }
  P.Game = Game;
  P.create = function (o) { return new Game(o); };
  P.RACES = RACES; P.T = T; P.MW = MW; P.MH = MH; P.TERR = TERR; P.PASS = PASS; P.BUILD = BUILD; P.TSPD = TSPD; P.RKEY = RKEY; P.mulberry32 = mulberry32; P.Heap = Heap;
  P.consts = { LARVA_MAX: LARVA_MAX, LARVA_EVERY: LARVA_EVERY, SUP_MAX: SUP_MAX, QUEUE_MAX: QUEUE_MAX, GATHER: GATHER, NODE_AMT: NODE_AMT };
  P.SMOKE = SMOKE; P.SPORE = SPORE; P.ROOTS = ROOTS; P.BUZZ = BUZZ; P.POLLEN = POLLEN; P.THAW = THAW; P.PETRIFY = PETRIFY; P.ROLL = ROLL; P.WAKE = WAKE;
  P.MAP_IDS = MAP_IDS; P.skirmLayout = skirmLayout; P.connectedL = connectedL;
  P.nodeOf = function (race, k) { return (RACES[race] || RACES.wright).nodes[k]; };   // какое месторождение даёт расе ресурс k ('a' | 'r')
  function calmD(D) { return !!(D.civil || D.passive); }   // не воюет: мирные (посол, сани) и «тихие» юниты кампании (светляк, рой)

  var G = Game.prototype;
  G.def = function (e) { var R = RACES[this.races[e.owner]]; return e.kind === 'u' ? R.units[e.type] : R.buildings[e.type]; };
  G.race = function (p) { return RACES[this.races[p]]; };
  G.get = function (id) { return this.byId.get(id) || null; };
  // отношения сторон: в скирмише (rel = null) все стороны — враги; кампания задаёт 'enemy' | 'neutral' | 'ally' (симметрично)
  G.setRel = function (a, b, v) { this.rel = this.rel || {}; this.rel[a + ',' + b] = v; this.rel[b + ',' + a] = v; };
  G.relOf = function (a, b) { if (a === b) return 'self'; if (a < 0 || b < 0) return 'none'; return (this.rel && this.rel[a + ',' + b]) || 'enemy'; };
  G.hostile = function (a, b) { return a !== b && a >= 0 && b >= 0 && (!this.rel || (this.rel[a + ',' + b] || 'enemy') === 'enemy'); };
  // события: main.js (onEvent) + миссия кампании (mission.event), если она подключена
  G.emit = function (t, d) { this.onEvent(t, d); if (this.mission && this.mission.event) this.mission.event(t, d); };
  G._addEnt = function (e) {
    e.id = this.nextId++; if (e.kind !== 'u') { e.x = (e.tx + e.s / 2) * T; e.y = (e.ty + e.s / 2) * T; this._occupy(e, e.id + 1); }
    this.ents.push(e); this.byId.set(e.id, e); return e;
  };
  G._occupy = function (e, v) { for (var y = e.ty; y < e.ty + e.s; y++) for (var x = e.tx; x < e.tx + e.s; x++) this.occ[y * this.MW + x] = v; };
  G._addBuilding = function (p, type, tx, ty, done) {
    var D = this.race(p).buildings[type];
    var b = this._addEnt({ kind: 'b', type: type, owner: p, tx: tx, ty: ty, s: D.s, maxhp: D.hp, hp: done ? D.hp : Math.max(1, D.hp * 0.1),
      done: !!done, prog: done ? 1 : 0, planted: !!done, queue: [], cocoons: [], larva: 0, larvaT: 0, rally: null, seen: [p === 0, p === 1] });
    this._mycDirty = true; this._pushOut(b);
    return b;
  };
  G._addUnit = function (p, type, x, y) {
    var D = this.race(p).units[type];
    var u = this._addEnt({ kind: 'u', type: type, owner: p, x: x, y: y, r: D.r, hp: D.hp, maxhp: D.hp, ord: { t: 'idle' }, path: null, cd: 0, tgt: 0,
      carry: null, scanT: this.rng() * 0.3, stuckT: 0, lastD: 1e9, repaths: 0, fx: 0, fy: 1, hitT: -9, anim: this.rng() * 10 });
    return u;
  };

  // ---------- Проходимость и A* ----------
  G.inMap = function (tx, ty) { return tx >= 0 && ty >= 0 && tx < this.MW && ty < this.MH; };
  G.passable = function (tx, ty) { return this.inMap(tx, ty) && PASS[this.terr[ty * this.MW + tx]] && this.occ[ty * this.MW + tx] === 0; };
  G.terrAt = function (tx, ty) { return this.inMap(tx, ty) ? this.terr[ty * this.MW + tx] : TERR.WOOD; };
  // смена клеток карты (кампания: разлив, лёд, мост): перерисовать землю, вытолкнуть юнитов с непроходимого, перестроить пути
  G.setTiles = function (cells, to) {
    var self = this, n = 0;
    cells.forEach(function (c) { var k = c[1] * self.MW + c[0]; if (self.inMap(c[0], c[1]) && self.terr[k] !== to) { self.terr[k] = to; n++; } });
    if (!n) return 0;
    this.terrRev++; this._mycDirty = true;
    this.ents.forEach(function (e) {
      if (e.dead) return;
      if (e.kind === 'u') { if (!self.walkPx(e.x, e.y)) { var fc = self._freeAround(Math.floor(e.x / T), Math.floor(e.y / T), 1)[0]; if (fc) { e.x = (fc[0] + 0.5) * T; e.y = (fc[1] + 0.5) * T; } } e.path = null; }
      else if (e.kind === 'b' && !self.def(e).deck) { for (var y = e.ty; y < e.ty + e.s; y++) for (var x = e.tx; x < e.tx + e.s; x++) if (!PASS[self.terr[y * self.MW + x]]) { self._kill(e, null); return; } }
    });
    return n;
  };
  G.walkPx = function (x, y) { return this.passable(Math.floor(x / T), Math.floor(y / T)); };
  // A* по 8 направлениям без срезания углов. goal(x,y) → bool; h(x,y) → оценка (тайлы).
  // Если цель недостижима — путь к самой близкой к ней достигнутой клетке (best по h). → массив [x,y] тайлов или null
  G.findPath = function (sx, sy, goal, h, limit) {
    if (!this.inMap(sx, sy)) return null;
    if (goal(sx, sy)) return [[sx, sy]];
    limit = limit || 6000;
    var N = this.MW * this.MH, gs = this._gs || (this._gs = new Float32Array(N)), from = this._from || (this._from = new Int32Array(N)), stamp = this._stamp || (this._stamp = new Int32Array(N)), closed = this._closed || (this._closed = new Int32Array(N));
    var run = this._run = (this._run || 0) + 1;
    var open = new Heap(), s = sy * this.MW + sx; stamp[s] = run; gs[s] = 0; from[s] = -1; open.push(s, h(sx, sy));
    var best = s, bestH = h(sx, sy), found = -1, iter = 0;
    var DX = [1, -1, 0, 0, 1, 1, -1, -1], DY = [0, 0, 1, -1, 1, -1, 1, -1];
    while (open.size && iter++ < limit) {
      var c = open.pop(); if (closed[c] === run) continue; closed[c] = run;
      var cx = c % this.MW, cy = (c / this.MW) | 0;
      if (goal(cx, cy)) { found = c; break; }
      var hc = h(cx, cy); if (hc < bestH) { bestH = hc; best = c; }
      for (var d = 0; d < 8; d++) {
        var nx = cx + DX[d], ny = cy + DY[d];
        if (!this.passable(nx, ny)) continue;
        if (d >= 4 && (!this.passable(cx + DX[d], cy) || !this.passable(cx, cy + DY[d]))) continue;
        var n = ny * this.MW + nx; if (closed[n] === run) continue;
        var ng = gs[c] + (d < 4 ? 1 : 1.4142);
        if (stamp[n] !== run || ng < gs[n]) { stamp[n] = run; gs[n] = ng; from[n] = c; open.push(n, ng + h(nx, ny) * 1.001); }
      }
    }
    var end = found >= 0 ? found : best, out = [];
    while (end >= 0) { out.push([end % this.MW, (end / this.MW) | 0]); end = from[end]; if (out.length > N) break; }
    out.reverse(); out.found = found >= 0;
    return out;
  };
  // Путь к точке (тайл) / к прямоугольнику (подойти вплотную к зданию/месторождению)
  G.pathToTile = function (sx, sy, gx, gy) {
    return this.findPath(sx, sy, function (x, y) { return x === gx && y === gy; }, function (x, y) { var dx = Math.abs(x - gx), dy = Math.abs(y - gy); return Math.max(dx, dy) + 0.4142 * Math.min(dx, dy); });
  };
  G.pathToRect = function (sx, sy, e, pad) {
    pad = pad || 1; var x0 = e.tx - pad, y0 = e.ty - pad, x1 = e.tx + e.s - 1 + pad, y1 = e.ty + e.s - 1 + pad;
    var dist = function (x, y) { var dx = Math.max(x0 - x, 0, x - x1), dy = Math.max(y0 - y, 0, y - y1); return Math.max(dx, dy); };
    return this.findPath(sx, sy, function (x, y) { return dist(x, y) === 0; }, dist);
  };
  // Прямая видимость для сглаживания пути (с учётом радиуса юнита)
  G.lineFree = function (x0, y0, x1, y1, r) {
    var dx = x1 - x0, dy = y1 - y0, L = Math.sqrt(dx * dx + dy * dy), n = Math.ceil(L / 6) + 1, q = Math.min(r || 6, 10);
    for (var i = 0; i <= n; i++) { var x = x0 + dx * i / n, y = y0 + dy * i / n;
      if (!this.walkPx(x - q, y - q) || !this.walkPx(x + q, y - q) || !this.walkPx(x - q, y + q) || !this.walkPx(x + q, y + q)) return false; }
    return true;
  };
  G._smooth = function (u, tiles, endX, endY) {
    var pts = tiles.slice(1).map(function (t) { return [(t[0] + 0.5) * T, (t[1] + 0.5) * T]; }); // первая клетка — где стоим
    if (endX != null) { if (pts.length) pts[pts.length - 1] = [endX, endY]; else pts.push([endX, endY]); }
    var out = [], cx = u.x, cy = u.y, i = 0;
    while (i < pts.length) { var j = pts.length - 1; while (j > i && !this.lineFree(cx, cy, pts[j][0], pts[j][1], u.r)) j--; out.push(pts[j]); cx = pts[j][0]; cy = pts[j][1]; i = j + 1; }
    return out;
  };

  // ---------- Выбор (рамка/клик) ----------
  G.visibleTo = function (e, p) {
    if (e.owner === p || this.fogOff) return true;
    if (e.kind === 'u') { var tx = Math.floor(e.x / T), ty = Math.floor(e.y / T); return this.inMap(tx, ty) && this.vis[p][ty * this.MW + tx] === 2; }
    if (e.kind === 'n') return this.vis[p][e.ty * this.MW + e.tx] > 0;
    return !!e.seen[p];
  };
  // Сущность под точкой мира (юниты важнее зданий)
  G.entAt = function (x, y, p) {
    var best = null, bd = 1e9;
    for (var i = 0; i < this.ents.length; i++) { var e = this.ents[i]; if (e.dead || !this.visibleTo(e, p)) continue;
      if (e.kind === 'u') { var d = Math.hypot(e.x - x, e.y - y); if (d <= e.r + 4 && d < bd) { bd = d; best = e; } } }
    if (best) return best;
    var tx = Math.floor(x / T), ty = Math.floor(y / T); if (!this.inMap(tx, ty)) return null;
    var id = this.occ[ty * this.MW + tx] - 1; var b = id > 0 ? this.get(id) : null;
    if (!b) for (var j = 0; j < this.ents.length; j++) { var d = this.ents[j]; if (!d.dead && d.kind === 'b' && d.done && d.type === 'span' && tx >= d.tx && ty >= d.ty && tx < d.tx + d.s && ty < d.ty + d.s) { b = d; break; } } // готовый настил моста
    return b && this.visibleTo(b, p) ? b : null;
  };
  // Рамка: свои юниты, чей круг задевает рамку; если юнитов нет — одно своё здание в рамке.
  G.selectRect = function (p, x0, y0, x1, y1) {
    var ax = Math.min(x0, x1), ay = Math.min(y0, y1), bx = Math.max(x0, x1), by = Math.max(y0, y1), units = [], blds = [];
    for (var i = 0; i < this.ents.length; i++) { var e = this.ents[i]; if (e.dead || e.owner !== p) continue;
      if (e.kind === 'u') { var cx = Math.max(ax, Math.min(e.x, bx)), cy = Math.max(ay, Math.min(e.y, by)); if (Math.hypot(e.x - cx, e.y - cy) <= e.r * 0.7) units.push(e.id); }
      else if (e.kind === 'b') { if (e.x >= ax && e.x <= bx && e.y >= ay && e.y <= by) blds.push(e.id); } }
    return units.length ? units : blds.slice(0, 1);
  };
  G.sameTypeIn = function (p, type, x0, y0, x1, y1) {
    var out = []; for (var i = 0; i < this.ents.length; i++) { var e = this.ents[i];
      if (!e.dead && e.owner === p && e.kind === 'u' && e.type === type && e.x >= x0 && e.x <= x1 && e.y >= y0 && e.y <= y1) out.push(e.id); }
    return out;
  };

  // ---------- Экономика: провизия, стоимость ----------
  G.supply = function (p) {
    var used = 0, cap = 0, R = this.race(p);
    for (var i = 0; i < this.ents.length; i++) { var e = this.ents[i]; if (e.dead || e.owner !== p) continue;
      if (e.kind === 'u') { if (!e.locked) used += R.units[e.type].sup; }   // сценарные (locked: выводки, сани) провизию не едят
      else if (e.kind === 'b') { if (e.done) cap += R.buildings[e.type].sup || 0;
        for (var q = 0; q < e.queue.length; q++) used += R.units[e.queue[q].type].sup;
        for (var c = 0; c < e.cocoons.length; c++) used += R.units[e.cocoons[c].type].sup; } }
    return { used: used, cap: Math.min(SUP_MAX, cap) };
  };
  // своё ли месторождение: янтарь/смола — Мастеровым и Чаще, камень/руда — Курганному роду; сухостой (дрова) — всем
  G.canGather = function (p, n) { var N = this.race(p).nodes; return !!n && (n.type === 'timber' || n.type === N.a || n.type === N.r); };
  G.afford = function (p, cost) { var r = this.res[p]; return r.a >= cost.a && r.r >= (cost.r || 0); };
  G.pay = function (p, cost, k) { k = k == null ? 1 : k; this.res[p].a -= cost.a * k; this.res[p].r -= (cost.r || 0) * k; };
  G.hasDone = function (p, type) { for (var i = 0; i < this.ents.length; i++) { var e = this.ents[i]; if (!e.dead && e.owner === p && e.kind === 'b' && e.type === type && e.done) return true; } return false; };
  G.count = function (p, kind, type, pred) { var n = 0; for (var i = 0; i < this.ents.length; i++) { var e = this.ents[i]; if (!e.dead && e.owner === p && e.kind === kind && (!type || e.type === type) && (!pred || pred(e))) n++; } return n; };
  // Почему нельзя обучить юнита (null — можно)
  G.trainBlock = function (p, b, type) {
    var R = this.race(p), D = R.units[type]; if (!D || D.hero || D.civil || !b || b.dead || b.owner !== p || !b.done) return 'nobuild';
    if (p === 0 && this.allowU && !this.allowU[type]) return 'nobuild';
    if (D.camp && !(this.allowU && this.allowU[type])) return 'nobuild';   // юниты кампании — только там, где миссия их разрешила
    var BD = R.buildings[b.type];
    if (R.grow) { if (!BD.larva) return 'nobuild'; if (D.req && !this.hasDone(p, D.req)) return 'req'; if (b.larva < 1) return 'larva'; }
    else { if ((BD.trains || []).indexOf(type) < 0) return 'nobuild'; if (b.queue.length >= QUEUE_MAX) return 'queue'; }
    if (this.res[p].a < D.cost.a) return 'amber'; if (this.res[p].r < D.cost.r) return 'resin';
    var s = this.supply(p); if (s.used + D.sup > s.cap) return 'supply';
    return null;
  };
  // Можно ли поставить здание: тайлы свободны и проходимы; для Чащи — целиком на своей грибнице (кроме Пня-матери)
  G.canPlace = function (p, type, tx, ty) {
    var R = this.race(p), D = R.buildings[type]; if (!D) return { ok: false, why: 'type' };
    if (D.req && !this.hasDone(p, D.req)) return { ok: false, why: 'req' };
    if (this.allowB && !this.allowB[type]) return { ok: false, why: 'nobuild' };
    if (D.deck) { // пролёт моста: вся площадь — вода, рядом — берег или готовый настил (чтобы подойти строителям)
      var shore = false;
      for (var dy0 = 0; dy0 < D.s; dy0++) for (var dx0 = 0; dx0 < D.s; dx0++) { var kx = tx + dx0, ky = ty + dy0;
        if (!this.inMap(kx, ky) || this.terr[ky * this.MW + kx] !== TERR.WATER || this.occ[ky * this.MW + kx]) return { ok: false, why: 'blocked' };
        if (p === 0 && !this.fogOff && this.vis[0][ky * this.MW + kx] === 0) return { ok: false, why: 'fog' }; }
      for (var e2 = -1; e2 <= D.s; e2++) [[tx + e2, ty - 1], [tx + e2, ty + D.s], [tx - 1, ty + e2], [tx + D.s, ty + e2]].forEach(function (q) { if (e2 >= 0 && e2 < D.s && this.passable(q[0], q[1])) shore = true; }, this);
      if (!shore) return { ok: false, why: 'shore' };
      if (!this.afford(p, D.cost)) return { ok: false, why: this.res[p].a < D.cost.a ? 'amber' : 'resin' };
      return { ok: true };
    }
    for (var y = ty; y < ty + D.s; y++) for (var x = tx; x < tx + D.s; x++) {
      if (!this.passable(x, y) || !BUILD[this.terr[y * this.MW + x]] || x < 1 || y < 1 || x > this.MW - 2 || y > this.MH - 2) return { ok: false, why: this.terr[y * this.MW + x] === TERR.ICE ? 'ice' : 'blocked' };
      if (R.grow && !D.anywhere && !this.myc[p][y * this.MW + x]) return { ok: false, why: 'myc' };
      if (p === 0 && !this.fogOff && this.vis[0][y * this.MW + x] === 0) return { ok: false, why: 'fog' };
    }
    // чужие юниты на месте стройки мешают
    for (var i = 0; i < this.ents.length; i++) { var e = this.ents[i]; if (e.dead || e.kind !== 'u' || e.owner === p) continue;
      if (e.x > tx * T - 4 && e.x < (tx + D.s) * T + 4 && e.y > ty * T - 4 && e.y < (ty + D.s) * T + 4) return { ok: false, why: 'units' }; }
    if (!this.afford(p, D.cost)) return { ok: false, why: this.res[p].a < D.cost.a ? 'amber' : 'resin' };
    return { ok: true };
  };
  G._recalcMyc = function () {
    for (var p = 0; p < this.sides; p++) {
      var M = this.myc[p]; M.fill(0); if (!this.race(p).grow) continue;
      for (var i = 0; i < this.ents.length; i++) { var e = this.ents[i]; if (e.dead || e.kind !== 'b' || e.owner !== p) continue;
        var D = this.def(e); if (!D.myc || !e.planted) continue;
        var rad = D.myc * (e.done ? 1 : 0.35 + 0.65 * e.prog), cx = e.tx + e.s / 2, cy = e.ty + e.s / 2;
        for (var y = Math.floor(cy - rad); y <= Math.ceil(cy + rad); y++) for (var x = Math.floor(cx - rad); x <= Math.ceil(cx + rad); x++) {
          if (!this.inMap(x, y)) continue; var dx = x + 0.5 - cx, dy = y + 0.5 - cy;
          if (dx * dx + dy * dy <= rad * rad && PASS[this.terr[y * this.MW + x]]) M[y * this.MW + x] = 1; } }
      // ходячая грибница (Матушка-Пень, def.myc у юнита): круг под ней
      for (var u0 = 0; u0 < this.ents.length; u0++) { var w = this.ents[u0]; if (w.dead || w.kind !== 'u' || w.owner !== p) continue; var WD = this.def(w); if (!WD.myc) continue;
        var ux = w.x / T, uy = w.y / T, ur = WD.myc;
        for (var y3 = Math.floor(uy - ur); y3 <= Math.ceil(uy + ur); y3++) for (var x3 = Math.floor(ux - ur); x3 <= Math.ceil(ux + ur); x3++) {
          if (!this.inMap(x3, y3)) continue; var ddx = x3 + 0.5 - ux, ddy = y3 + 0.5 - uy; if (ddx * ddx + ddy * ddy <= ur * ur && PASS[this.terr[y3 * this.MW + x3]]) M[y3 * this.MW + x3] = 1; } }
    }
    // дым котелен (b.smoke — радиус, клетки): в дыму грибница чужой стороны гибнет
    var sm = this.smokes = [];
    for (var si = 0; si < this.ents.length; si++) { var sb = this.ents[si]; if (!sb.dead && sb.kind === 'b' && sb.smoke && sb.done) sm.push({ x: sb.x, y: sb.y, r: sb.smoke, owner: sb.owner, id: sb.id }); }
    for (var sk = 0; sk < sm.length; sk++) { var S0 = sm[sk], scx = S0.x / T, scy = S0.y / T;
      for (var q = 0; q < this.sides; q++) { if (!this.race(q).grow || !this.hostile(q, S0.owner)) continue; var MQ = this.myc[q];
        for (var y4 = Math.floor(scy - S0.r); y4 <= Math.ceil(scy + S0.r); y4++) for (var x4 = Math.floor(scx - S0.r); x4 <= Math.ceil(scx + S0.r); x4++) {
          if (this.inMap(x4, y4) && Math.hypot(x4 + 0.5 - scx, y4 + 0.5 - scy) <= S0.r) MQ[y4 * this.MW + x4] = 0; } } }
    this._mycDirty = false;
  };

  // ---------- Приказы ----------
  // c: {t:'move'|'amove'|'attack'|'gather'|'build'|'repair'|'stop'|'train'|'rally'|'smart'|'cancel', ids, x, y, target, type, tx, ty}
  G.cmd = function (p, c) {
    var self = this, units = (c.ids || []).map(function (id) { return self.get(id); }).filter(function (e) { return e && !e.dead && e.owner === p && e.kind === 'u' && (!e.locked || c.sys); }); // locked — ведёт сценарий (сани, посол)
    switch (c.t) {
      case 'smart': return this._smart(p, units, c);
      case 'move': case 'amove': return this._groupMove(units, c.x, c.y, c.t);
      case 'attack': { var tg = this.get(c.target); if (!tg || tg.dead) return false; units.forEach(function (u) { self._order(u, { t: 'attack', id: tg.id }); }); return true; }
      case 'gather': { var n = this.get(c.target); if (!n || n.kind !== 'n' || !this.canGather(p, n)) return false; units.forEach(function (u) { if (self.def(u).worker) self._order(u, { t: 'gather', id: n.id }); }); return true; }
      case 'repair': { var rb = this.get(c.target); if (!rb || rb.dead) return false; units.forEach(function (u) { if (self.def(u).worker && !self.race(p).grow) self._order(u, { t: 'repair', id: rb.id }); }); return true; }
      case 'stop': units.forEach(function (u) { self._order(u, { t: 'idle' }); }); return true;
      case 'build': return this._build(p, units, c.type, c.tx, c.ty);
      case 'train': return this._train(p, this.get(c.id), c.type);
      case 'cancel': return this._cancel(p, this.get(c.id));
      case 'banner': return this._banner(p, this.get(c.id));
      case 'stomp': return this._stomp(p, this.get(c.id));
      case 'roots': return this._roots(p, this.get(c.id));
      case 'buzz': return this._buzz(p, this.get(c.id));
      case 'spore': return this._spore(p, this.get(c.id), c.tx, c.ty);
      case 'wake': return this._wake(p, this.get(c.id));
      case 'rally': { var b = this.get(c.id); if (!b || b.owner !== p || b.kind !== 'b') return false; var tgt = c.target ? this.get(c.target) : null; b.rally = { x: c.x, y: c.y, node: tgt && tgt.kind === 'n' ? tgt.id : 0 }; return true; }
    }
    return false;
  };
  // ПКМ: враг → атака, месторождение (рабочим) → добыча, своя недостройка → достроить, своё повреждённое механическое → ремонт, земля → идти
  G._smart = function (p, units, c) {
    var self = this, tg = c.target ? this.get(c.target) : null, R = this.race(p), res = { kind: 'move' };
    if (tg && !tg.dead) {
      if (this.hostile(p, tg.owner)) { units.forEach(function (u) { self._order(u, { t: 'attack', id: tg.id }); }); return { kind: 'attack' }; }
      if (tg.kind === 'n' && this.canGather(p, tg)) {
        var any = false; units.forEach(function (u) { if (self.def(u).worker) { self._order(u, { t: 'gather', id: tg.id }); any = true; } });
        var rest = units.filter(function (u) { return !self.def(u).worker; }); if (rest.length) this._groupMove(rest, c.x, c.y, 'move');
        return { kind: any ? 'gather' : 'move' };
      }
      if (tg.owner === p) {
        var D = this.def(tg), workers = units.filter(function (u) { return self.def(u).worker; }), rest2 = units.filter(function (u) { return !self.def(u).worker; });
        if (workers.length && tg.kind === 'b' && !tg.done && !R.grow) { workers.forEach(function (u) { self._order(u, { t: 'build', id: tg.id }); }); res.kind = 'build'; }
        else if (workers.length && !R.grow && tg.hp < tg.maxhp && (tg.kind === 'b' || D.mech)) { workers.forEach(function (u) { self._order(u, { t: 'repair', id: tg.id }); }); res.kind = 'repair'; }
        else if (workers.length && tg.kind === 'b' && D.drop) { workers.forEach(function (u) { if (u.carry) self._order(u, { t: 'gather', id: u.lastNode || 0, ret: true }); else self._groupMove([u], c.x, c.y, 'move'); }); res.kind = 'move'; }
        else rest2 = units;
        if (rest2.length) this._groupMove(rest2, c.x, c.y, 'move');
        return res;
      }
    }
    this._groupMove(units, c.x, c.y, 'move'); return res;
  };
  G._order = function (u, o) { if (u.ord.t === 'build' && o.t !== 'build') u.prevGather = 0; u.ord = o; u.path = null; u.tgt = 0; u.repaths = 0; u.stuckT = 0; u.lastD = 1e9; };
  // Групповое перемещение: каждому юниту — своя свободная клетка по спирали вокруг цели (не толкаются за одну точку)
  G._groupMove = function (units, x, y, kind) {
    if (!units.length) return false;
    var gx = Math.floor(x / T), gy = Math.floor(y / T), slots = this._freeAround(gx, gy, units.length), self = this;
    var sorted = units.slice().sort(function (a, b) { return Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y); });
    sorted.forEach(function (u, i) {
      var s = slots[i] || slots[slots.length - 1] || [gx, gy], px = units.length === 1 ? x : (s[0] + 0.5) * T, py = units.length === 1 ? y : (s[1] + 0.5) * T;
      if (units.length === 1 && !self.walkPx(px, py)) { px = (s[0] + 0.5) * T; py = (s[1] + 0.5) * T; }
      self._order(u, { t: kind, x: px, y: py, tx: s[0], ty: s[1] });
    });
    return { kind: kind };
  };
  G._freeAround = function (gx, gy, n) {
    var out = [], seen = {}, q = [[gx, gy]], self = this;
    if (!this.passable(gx, gy)) { // цель в препятствии — ищем ближайшую проходимую
      var best = null, bd = 1e9; for (var r = 1; r < 12 && !best; r++) for (var dx = -r; dx <= r; dx++) for (var dy = -r; dy <= r; dy++) { if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; if (this.passable(gx + dx, gy + dy)) { var d = dx * dx + dy * dy; if (d < bd) { bd = d; best = [gx + dx, gy + dy]; } } }
      if (best) q = [best]; else return [[gx, gy]];
    }
    seen[q[0][0] + ',' + q[0][1]] = 1;
    while (q.length && out.length < n) { var c = q.shift(); out.push(c);
      [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].forEach(function (d) { var k = (c[0] + d[0]) + ',' + (c[1] + d[1]); if (!seen[k] && self.passable(c[0] + d[0], c[1] + d[1])) { seen[k] = 1; q.push([c[0] + d[0], c[1] + d[1]]); } }); }
    return out;
  };
  // Знамя Ярины: на 30 с у места, где она стоит, — стройка в 1,75 раза быстрее, рядом тепло (мороз не мешает); перезарядка 60 с
  var BANNER = { r: 4.5, life: 30, cd: 60, mul: 1.75 };
  P.BANNER = BANNER;
  G._banner = function (p, u) {
    if (!u || u.dead || u.owner !== p || this.def(u).ability !== 'banner') return false;
    if ((u.abT || 0) > this.t) { this.emit('deny', { p: p, why: 'cooldown' }); return false; }
    u.abT = this.t + BANNER.cd; this.banners.push({ x: u.x, y: u.y, r: BANNER.r * T, until: this.t + BANNER.life, owner: p, t0: this.t });
    this.emit('banner', { p: p, id: u.id, x: u.x, y: u.y }); return true;
  };
  // Топот Топотуна Тихона (кампания): удар оземь — урон всем врагам в 2,6 клетки (зданиям — вполовину); перезарядка 25 с
  var STOMP = { r: 2.6, dmg: 40, cd: 25 };
  P.STOMP = STOMP;
  G._stomp = function (p, u) {
    if (!u || u.dead || u.owner !== p || this.def(u).ability !== 'stomp') return false;
    if ((u.abT || 0) > this.t) { this.emit('deny', { p: p, why: 'stompCd' }); return false; }
    u.abT = this.t + STOMP.cd; var self = this, R = STOMP.r * T, n = 0;
    this.ents.slice().forEach(function (e) { if (e.dead || (e.kind !== 'u' && e.kind !== 'b') || !self.hostile(p, e.owner)) return; if (self.distTo(u, e) <= R) { self._damage(e, STOMP.dmg * (e.kind === 'b' ? 0.5 : 1), u); n++; } });
    this.emit('stomp', { p: p, id: u.id, x: u.x, y: u.y, n: n }); return true;
  };
  // Корни Матушки-Пня (кампания Чащи): враги в ROOTS.r клетки опутаны — ROOTS.s секунд не ходят (бить могут); перезарядка ROOTS.cd
  G._roots = function (p, u) {
    if (!u || u.dead || u.owner !== p || this.def(u).ability !== 'roots') return false;
    if ((u.abT || 0) > this.t) { this.emit('deny', { p: p, why: 'rootsCd' }); return false; }
    u.abT = this.t + ROOTS.cd; var self = this, n = 0;
    this.ents.forEach(function (e) { if (e.dead || e.kind !== 'u' || !self.hostile(p, e.owner) || Math.hypot(e.x - u.x, e.y - u.y) > ROOTS.r * T + e.r) return; e.rootT = self.t + ROOTS.s; e.path = null; n++; });
    this.emit('roots', { p: p, id: u.id, x: u.x, y: u.y, n: n }); return true;
  };
  // Гул Шмеля: свои юниты в BUZZ.r клетках (и он сам) BUZZ.s секунд ходят в BUZZ.mul раза быстрее
  G._buzz = function (p, u) {
    if (!u || u.dead || u.owner !== p || this.def(u).ability !== 'buzz') return false;
    if ((u.abT || 0) > this.t) { this.emit('deny', { p: p, why: 'buzzCd' }); return false; }
    u.abT = this.t + BUZZ.cd; var self = this, n = 0;
    this.ents.forEach(function (e) { if (e.dead || e.kind !== 'u' || e.owner !== p || Math.hypot(e.x - u.x, e.y - u.y) > BUZZ.r * T) return; e.hasteT = self.t + BUZZ.s; n++; });
    this.emit('buzz', { p: p, id: u.id, x: u.x, y: u.y, n: n }); return true;
  };
  // F Ведогора (кампания Курганного рода): спящие идолы (b.asleep) в WAKE.r клетках просыпаются (если у идола нет врагов — иначе песнь глушат); нет их — «голос камня»: свои бойцы
  // с окаменением в тех же клетках сразу каменеют; перезарядка WAKE.cd
  G._wake = function (p, u) {
    if (!u || u.dead || u.owner !== p || this.def(u).ability !== 'wake') return false;
    if ((u.abT || 0) > this.t) { this.emit('deny', { p: p, why: 'wakeCd' }); return false; }
    var self = this, R = WAKE.r * T, woke = [], hot = 0;
    // рядом со спящим идолом враг — песнь глушит (идол не просыпается)
    var noisy = function (b) { return self.ents.some(function (e) { return !e.dead && e.kind === 'u' && self.hostile(p, e.owner) && !self.def(e).civil && self.distTo(e, b) <= WAKE.r * T; }); };
    this.ents.forEach(function (b) { if (b.dead || b.kind !== 'b' || b.owner !== p || !b.asleep || self.distTo(u, b) > R) return; if (noisy(b)) { hot++; return; } b.asleep = false; b.quiet = false; woke.push(b.id); self.emit('woke', { p: p, id: b.id, tag: b.tag || null, x: b.x, y: b.y }); });
    if (!woke.length && hot) { this.emit('deny', { p: p, why: 'wakeHot' }); return false; }
    u.abT = this.t + (woke.length ? WAKE.cd * 0.5 : WAKE.cd);
    if (!woke.length) this.ents.forEach(function (e) { if (e.dead || e.kind !== 'u' || e.owner !== p || !self.def(e).petrify || Math.hypot(e.x - u.x, e.y - u.y) > R) return; e.stillT = PETRIFY.t; e.stone = true; });
    this.emit('wake', { p: p, id: u.id, x: u.x, y: u.y, n: woke.length }); return true;
  };
  // Споры (кампания Чащи, game.sporeCfg): готовое дупло или Пень пускает споры в клетку (tx, ty — левый верх дупла 2×2);
  // дальность — range, по ветру дальше на wind × cos(угла к ветру); в полёте fly с; упали на сушу — растёт дупло (без грибницы),
  // некуда — пропали (половина цены назад). Перезарядка — у каждого здания своя.
  G.sporeRange = function (b, tx, ty) {
    var cfg = this.sporeCfg || SPORE, dx = tx + 1 - b.x / T, dy = ty + 1 - b.y / T, d = Math.hypot(dx, dy) || 1, w = this.wind;
    var k = w ? Math.max(0, (dx * w.x + dy * w.y) / d) : 0; return { d: d, max: (cfg.range || SPORE.range) + (cfg.wind == null ? SPORE.wind : cfg.wind) * k };
  };
  G.sporeFrom = function (b) { return !!(b && !b.dead && b.kind === 'b' && b.done && this.sporeCfg && this.race(b.owner).grow && (b.type === 'hollow' || b.type === 'stump')); };
  G._spore = function (p, b, tx, ty) {
    if (!b || b.owner !== p || !this.sporeFrom(b)) return false;
    var cfg = this.sporeCfg, cost = { a: cfg.cost == null ? SPORE.cost : cfg.cost, r: 0 };
    if ((b.sporeT || 0) > this.t) { this.emit('deny', { p: p, why: 'sporeCd' }); return false; }
    var rg = this.sporeRange(b, tx, ty); if (rg.d > rg.max) { this.emit('deny', { p: p, why: 'sporeFar' }); return false; }
    if (!this.afford(p, cost)) { this.emit('deny', { p: p, why: 'amber' }); return false; }
    this.pay(p, cost); b.sporeT = this.t + (cfg.cd == null ? SPORE.cd : cfg.cd);
    var fl = { owner: p, from: b.id, x0: b.x, y0: b.y - 20, x1: (tx + 1) * T, y1: (ty + 1) * T, t0: this.t, t1: this.t + (cfg.fly == null ? SPORE.fly : cfg.fly), tx: tx, ty: ty, cost: cost.a };
    this.sporeFly.push(fl); this.emit('spore', { p: p, id: b.id, x: fl.x1, y: fl.y1 }); return fl;
  };
  // куда сесть спорам: клетки 2×2 — суша под стройку, свободно, без чужих юнитов (ищем рядом, до 1 клетки)
  G._sporeSpot = function (p, tx, ty) {
    for (var r = 0; r <= 1; r++) for (var dy = -r; dy <= r; dy++) for (var dx = -r; dx <= r; dx++) { if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      var x0 = tx + dx, y0 = ty + dy, ok = true;
      for (var y = y0; y < y0 + 2 && ok; y++) for (var x = x0; x < x0 + 2; x++) if (!this.passable(x, y) || !BUILD[this.terr[y * this.MW + x]] || x < 1 || y < 1 || x > this.MW - 2 || y > this.MH - 2) { ok = false; break; }
      for (var i = 0; i < this.ents.length && ok; i++) { var e = this.ents[i]; if (!e.dead && e.kind === 'u' && e.owner !== p && e.x > x0 * T - 4 && e.x < (x0 + 2) * T + 4 && e.y > y0 * T - 4 && e.y < (y0 + 2) * T + 4) ok = false; }
      if (ok) return [x0, y0]; }
    return null;
  };
  G._sporeStep = function () {
    for (var i = this.sporeFly.length - 1; i >= 0; i--) { var f = this.sporeFly[i]; if (this.t < f.t1) continue; this.sporeFly.splice(i, 1);
      var at = this._sporeSpot(f.owner, f.tx, f.ty);
      if (at) { var b = this._addBuilding(f.owner, 'hollow', at[0], at[1], false); b.planted = true; b.spored = true; this._mycDirty = true; this.emit('sporeLand', { p: f.owner, id: b.id, x: b.x, y: b.y }); }
      else { this.res[f.owner].a += Math.floor(f.cost / 2); this.stats[f.owner].sporeLost = (this.stats[f.owner].sporeLost || 0) + 1; this.emit('sporeLost', { p: f.owner, x: f.x1, y: f.y1 }); } }
  };
  // дым: точка (x, y) в дыму котельни стороны, враждебной p
  G.smokeAt = function (p, x, y) { for (var i = 0; i < this.smokes.length; i++) { var s = this.smokes[i]; if (this.hostile(p, s.owner) && Math.hypot(s.x - x, s.y - y) <= s.r * T) return true; } return false; };
  // обзор с учётом ночи: светляки (glow) видят в полную силу, здания — чуть меньше теряют
  G.sightOf = function (e, D) { var s = D.sight * (e.kind === 'b' && !e.done ? 0.6 : 1); if (this.night > 0 && !D.glow) s *= 1 - (e.kind === 'b' ? 0.45 : 0.6) * this.night; return s; };
  G.bannerAt = function (p, x, y) { for (var i = 0; i < this.banners.length; i++) { var b = this.banners[i]; if (b.owner === p && b.until > this.t && Math.hypot(b.x - x, b.y - y) <= b.r) return true; } return false; };
  // Тепло: Мастеровым — у своих готовых острога/избы/котельни (5 клеток) и у знамени; Чаще — на своей грибнице
  G.warm = function (u) {
    if (!this.cold) return true;
    if ((u.warmT || 0) > this.t) return u.isWarm; u.warmT = this.t + 0.5;
    var p = u.owner, tx = Math.floor(u.x / T), ty = Math.floor(u.y / T), w = false;
    if (this.race(p).grow) w = this.inMap(tx, ty) && !!this.myc[p][ty * this.MW + tx];
    else { if (this.bannerAt(p, u.x, u.y)) w = true;
      // тёплые здания (warm: острог, изба, котельня; курган, очаг) — 5 клеток; тёплые юниты (warmR: волокуша с очагом)
      for (var i = 0; i < this.ents.length && !w; i++) { var e = this.ents[i]; if (e.dead || e.owner !== p || e === u) continue;
        if (e.kind === 'b') { if (e.done && this.def(e).warm && this.distTo(u, e) <= 5 * T) w = true; }
        else if (e.kind === 'u') { var wr = this.def(e).warmR; if (wr && Math.hypot(e.x - u.x, e.y - u.y) <= wr * T) w = true; } } }
    u.isWarm = w; return w;
  };
  // множители мороза: ход (вдали от тепла), работа (добыча), рост/стройка/обучение — у рас по-разному
  G.coldMove = function (u) { if (this.def(u).frost) return 1; var k = this.cold && !this.warm(u) ? 1 - 0.3 * this.cold : 1; return this.wall && this.inWall(u.x, u.y) ? k * 0.6 : k; };
  G.coldWork = function (u) { return this.cold ? 1 - 0.4 * this.cold * (this.warm(u) ? 0.4 : 1) : 1; };
  G.coldGrow = function (p) { return this.cold ? 1 - (this.race(p).grow ? 0.5 : 0.3) * this.cold : 1; };
  G.buildList = function (p) { var R = this.race(p), al = this.allowB; if (!al) return R.order.slice(0, 4); return R.order.concat(Object.keys(R.buildings).filter(function (k) { return R.buildings[k].extra && R.order.indexOf(k) < 0; })).filter(function (k) { return al[k]; }).slice(0, 4); };
  G._build = function (p, units, type, tx, ty) {
    var self0 = this, R = this.race(p), workers = units.filter(function (u) { return self0.def(u).worker; });
    if (!workers.length) return false;
    var chk = this.canPlace(p, type, tx, ty); if (!chk.ok) { this.emit('deny', { p: p, why: chk.why }); return false; }
    this.pay(p, R.buildings[type].cost);
    var b = this._addBuilding(p, type, tx, ty, false);
    var self = this;
    if (R.grow) this._order(workers[0], { t: 'plant', id: b.id });  // жук сажает росток и свободен
    else workers.forEach(function (u) { var g = u.ord.t === 'gather' ? u.ord.id : (u.ord.t === 'build' ? u.prevGather : 0); self._order(u, { t: 'build', id: b.id }); u.prevGather = g; });
    this.emit('place', { p: p, id: b.id, type: type });
    return b;
  };
  G._train = function (p, b, type) {
    var why = this.trainBlock(p, b, type); if (why) { this.emit('deny', { p: p, why: why }); return false; }
    var R = this.race(p), D = R.units[type]; this.pay(p, D.cost);
    if (R.grow) { b.larva--; b.cocoons.push({ type: type, t: 0 }); } else b.queue.push({ type: type, t: 0 });
    this.emit('queue', { p: p, id: b.id, type: type });
    return true;
  };
  G._cancel = function (p, b) {
    if (!b || b.owner !== p || b.kind !== 'b') return false;
    if (!b.done) { this.pay(p, this.def(b).cost, -0.75); this._kill(b, null, true); return true; } // отмена стройки — возврат 75%
    var R = this.race(p), q = R.grow ? b.cocoons : b.queue; if (!q.length) return false;
    var it = q.pop(); this.pay(p, R.units[it.type].cost, -1); if (R.grow) b.larva = Math.min(LARVA_MAX, b.larva + 1); return true;
  };

  // ---------- Шаг симуляции ----------
  G.update = function (dt) {
    if (this.winner >= 0) return;
    while (dt > 1e-6) { var h = Math.min(dt, 0.05); this._step(h); dt -= h; }
  };
  G._step = function (dt) {
    this.t += dt;
    var ents = this.ents, i;
    for (i = 0; i < ents.length; i++) { var e = ents[i]; if (e.dead) continue; if (e.kind === 'u') this._unit(e, dt); else if (e.kind === 'b') this._bld(e, dt); }
    this._separate(dt);
    if (this.ents.some(function (e) { return e.dead; })) this.ents = this.ents.filter(function (e) { return !e.dead; });
    for (i = this.shots.length - 1; i >= 0; i--) { this.shots[i].t += dt; if (this.shots[i].t >= this.shots[i].dur) this.shots.splice(i, 1); }
    if (this._mycDirty || ((this.t * 2) | 0) !== (((this.t - dt) * 2) | 0)) this._recalcMyc();
    this._visT -= dt; if (this._visT <= 0) { this._visT = 0.2; this._updateVis(); }
    if (this.ai) this.ai.update(dt); if (this.ai0) this.ai0.update(dt);
    if (this.banners.length) { var tnow = this.t; this.banners = this.banners.filter(function (b) { return b.until > tnow; }); }
    if (this.wall) this._wallStep(dt);                              // кампания: ползущий Зимний вал
    if (this.sporeFly.length) this._sporeStep();                    // кампания Чащи: споры долетели
    if (this.thaw) this._thawStep(dt);                              // кампания Чащи: корни под льдом
    if (this.mission && this.mission.step) this.mission.step(dt);   // кампания: триггеры, цели, сценарный ИИ (js/campaign.js)
    // победа: у стороны не осталось зданий (в кампании endRule 'none' — исход решает миссия: G.end)
    if (this.endRule !== 'none' && this.winner < 0) for (var p = 0; p < 2; p++) if (this.count(p, 'b') === 0) { this.end(1 - p); break; }
  };
  G.end = function (winner) { if (this.winner >= 0) return; this.winner = winner; this.emit('end', { winner: winner }); };
  G._bld = function (b, dt) {
    var D = this.def(b), R = this.race(b.owner);
    if (!b.done) {
      if (R.grow && b.planted) { this._progress(b, dt / D.time * this.coldGrow(b.owner) * (b.spored && this.sporeCfg && this.sporeCfg.grow ? this.sporeCfg.grow : 1)); }   // из спор — sporeCfg.grow
      return; // люди: прогресс двигают рабочие (_unit build)
    }
    if (D.regen && b.hp < b.maxhp) b.hp = Math.min(b.maxhp, b.hp + D.regen * dt);
    if (D.atk && !b.asleep) this._tower(b, D.atk, dt);   // идол Курганного рода (кампания): бьёт врагов рунами
    if (R.grow && D.larva) {
      var gk = this.coldGrow(b.owner);
      if (b.larva < LARVA_MAX) { b.larvaT += dt * gk; if (b.larvaT >= LARVA_EVERY) { b.larvaT = 0; b.larva++; } } else b.larvaT = 0;
      for (var c = b.cocoons.length - 1; c >= 0; c--) { var co = b.cocoons[c]; co.t += dt * gk; if (co.t >= R.units[co.type].time) { b.cocoons.splice(c, 1); this._emerge(b, co.type); } }
    } else if (b.queue.length) {
      var q = b.queue[0]; q.t += dt * this.coldGrow(b.owner); if (q.t >= R.units[q.type].time) { b.queue.shift(); this._emerge(b, q.type); }
    }
  };
  G._tower = function (b, A, dt) {
    b.cd = Math.max(0, (b.cd || 0) - dt); if (b.cd > 0) return;
    var best = null, bd = A.range * T;
    for (var i = 0; i < this.ents.length; i++) { var e = this.ents[i]; if (e.dead || e.kind !== 'u' || !this.hostile(b.owner, e.owner) || this.def(e).civil) continue; var d = this.distTo(b, e); if (d <= bd) { bd = d; best = e; } }
    if (!best) return; b.cd = A.cd; this._hit(b, { dmg: A.dmg, ranged: true }, best);
  };
  G._progress = function (b, k) {
    var D = this.def(b), before = b.prog; b.prog = Math.min(1, b.prog + k);
    b.hp = Math.min(b.maxhp, b.hp + b.maxhp * 0.9 * (b.prog - before));
    if (b.prog >= 1 && !b.done) { b.done = true; b.hp = Math.max(b.hp, Math.round(b.hp)); this._mycDirty = true; if (D.larva) b.larva = 1;
      if (D.deck) this._deck(b, true); this.stats[b.owner].built++; this.emit('built', { p: b.owner, id: b.id, type: b.type }); }
  };
  // настил пролёта: готов — клетки BRIDGE и проходимы (сам пролёт остаётся сущностью: его можно бить и чинить); снесён — снова вода
  G._deck = function (b, on) {
    var cells = []; for (var y = b.ty; y < b.ty + b.s; y++) for (var x = b.tx; x < b.tx + b.s; x++) cells.push([x, y]);
    if (on) { this._occupy(b, 0); this.setTiles(cells, TERR.BRIDGE); }
    else { this.setTiles(cells, TERR.WATER); }
  };
  G.decks = function (p) { return this.ents.filter(function (e) { return !e.dead && e.kind === 'b' && (p == null || e.owner === p) && e.type === 'span'; }); };
  G._spawnPoint = function (b, i) {
    var tiles = [], self = this;
    for (var x = b.tx - 1; x <= b.tx + b.s; x++) for (var y = b.ty - 1; y <= b.ty + b.s; y++) { if (x >= b.tx && x < b.tx + b.s && y >= b.ty && y < b.ty + b.s) continue; if (self.passable(x, y)) tiles.push([x, y]); }
    if (!tiles.length) return { x: b.x, y: (b.ty + b.s + 0.5) * T };
    // ближе к точке сбора (или к низу-право)
    var rx = b.rally ? b.rally.x : b.x + 200, ry = b.rally ? b.rally.y : b.y + 200;
    tiles.sort(function (a, c) { return Math.hypot((a[0] + .5) * T - rx, (a[1] + .5) * T - ry) - Math.hypot((c[0] + .5) * T - rx, (c[1] + .5) * T - ry); });
    var t = tiles[(i || 0) % tiles.length]; return { x: (t[0] + 0.5) * T, y: (t[1] + 0.5) * T };
  };
  G._emerge = function (b, type) {
    var sp = this._spawnPoint(b, this.count(b.owner, 'u') % 3), u = this._addUnit(b.owner, type, sp.x, sp.y);
    this.stats[b.owner].trained++;
    if (b.rally) { var n = b.rally.node ? this.get(b.rally.node) : null;
      if (n && !n.dead && this.def(u).worker) this._order(u, { t: 'gather', id: n.id }); else this._order(u, { t: this.def(u).worker ? 'move' : 'amove', x: b.rally.x, y: b.rally.y }); }
    this.emit('trained', { p: b.owner, id: u.id, type: type });
    return u;
  };
  // Расстояние от юнита до края сущности (px)
  G.distTo = function (u, e) {
    if (e.kind === 'u') return Math.hypot(u.x - e.x, u.y - e.y) - e.r;
    var x0 = e.tx * T, y0 = e.ty * T, x1 = x0 + e.s * T, y1 = y0 + e.s * T;
    var dx = Math.max(x0 - u.x, 0, u.x - x1), dy = Math.max(y0 - u.y, 0, u.y - y1); return Math.hypot(dx, dy);
  };
  G._unit = function (u, dt) {
    var D = this.def(u), o = u.ord;
    u.cd = Math.max(0, u.cd - dt); u.anim += dt;
    // дым котелен: бойцы Чащи в дыму не заживают и чахнут (кампания)
    if (this.smokes.length && this.race(u.owner).grow) { u.smokeT = (u.smokeT || 0) - dt; if (u.smokeT <= 0) { u.smokeT = 0.25; u.inSmoke = this.smokeAt(u.owner, u.x, u.y); } } else u.inSmoke = false;
    if (u.inSmoke) { u.hp -= SMOKE.dps * dt; u.hitT = this.t; if (u.hp <= 0) { this._kill(u, null); return; } }
    else if (D.regen && u.hp < u.maxhp) u.hp = Math.min(u.maxhp, u.hp + D.regen * dt);
    if (D.heal) { var hr = D.heal.r * T; for (var hi = 0; hi < this.ents.length; hi++) { var hu = this.ents[hi]; if (hu === u || hu.dead || hu.kind !== 'u' || hu.owner !== u.owner || hu.hp >= hu.maxhp || hu.inSmoke) continue; if (Math.abs(hu.x - u.x) < hr && Math.abs(hu.y - u.y) < hr && Math.hypot(hu.x - u.x, hu.y - u.y) <= hr) hu.hp = Math.min(hu.maxhp, hu.hp + D.heal.hps * dt); } }
    if (D.pollen) this._pollen(u, dt);
    // кампания Курганного рода: буран (вдали от тепла стынут), «камень хранит тепло» (окаменевшие не стынут и заживают)
    if (this.chill && this.cold >= (this.chill.at || 0) && !D.frost && !(u.stone && this.stoneRest) && !this.warm(u)) { u.hp -= this.chill.dps * dt; u.hitT = this.t; u.chilled = true; if (u.hp <= 0) { this._kill(u, null); return; } } else u.chilled = false;
    if (u.stone && this.stoneRest && u.hp < u.maxhp) u.hp = Math.min(u.maxhp, u.hp + this.stoneRest.hps * dt);
    if (u.roll) { this._rollStep(u, D, dt); return; }   // валун-страж катится — приказы ждут
    var reach = u.r + 10;
    switch (o.t) {
      case 'idle':
        if (!calmD(D) && (!D.worker || u.tgt)) { this._autoEngage(u, D, dt, true); }
        break;
      case 'move':
        if (this._follow(u, D, dt, o.x, o.y, o.tx, o.ty)) this._order(u, { t: 'idle' });
        break;
      case 'amove':
        if (!calmD(D) && this._autoEngage(u, D, dt, false)) break;
        if (this._follow(u, D, dt, o.x, o.y, o.tx, o.ty)) this._order(u, { t: 'idle' });
        break;
      case 'attack': {
        var tg = this.get(o.id); if (!tg || tg.dead || calmD(D) || !this._canSee(u.owner, tg)) { this._order(u, { t: 'idle' }); break; }
        this._engage(u, D, dt, tg); break; }
      case 'gather': this._gather(u, D, dt, reach); break;
      case 'build': {
        var b = this.get(o.id); if (!b || b.dead) { this._afterBuild(u); break; }
        if (b.done) { this._afterBuild(u); break; }
        if (this.distTo(u, b) > reach) { this._approachRect(u, D, dt, b); break; }
        u.path = null; u.work = true;
        var builders = 0, crafts = 0; for (var i = 0; i < this.ents.length; i++) { var w = this.ents[i]; if (w.kind === 'u' && !w.dead && w.ord.t === 'build' && w.ord.id === b.id && w.work) { builders++; crafts += this.def(w).craft || 1; } }
        var mine = D.craft || 1, share = builders > 3 ? 3 * mine / crafts : mine; // троим быстрее; больше — не быстрее (Тихон — за двоих)
        this._progress(b, dt / this.def(b).time * share * this.coldGrow(b.owner) * (this.bannerAt(b.owner, b.x, b.y) ? BANNER.mul : 1));
        if (b.done) this._afterBuild(u);
        break; }
      case 'plant': {
        var s = this.get(o.id); if (!s || s.dead || s.planted) { this._order(u, { t: 'idle' }); break; }
        if (this.distTo(u, s) > reach) { this._approachRect(u, D, dt, s); break; }
        s.planted = true; this._mycDirty = true; this.emit('planted', { p: u.owner, id: s.id });
        var pg = u.prevGather; this._order(u, pg ? { t: 'gather', id: pg } : { t: 'idle' }); break; }
      case 'repair': {
        var rb = this.get(o.id); if (!rb || rb.dead || rb.hp >= rb.maxhp) { this._order(u, { t: 'idle' }); break; }
        if (this.distTo(u, rb) > reach + (rb.kind === 'u' ? 4 : 0)) { if (rb.kind === 'b') this._approachRect(u, D, dt, rb); else this._follow(u, D, dt, rb.x, rb.y, null, null, rb.r + u.r + 6); break; }
        u.path = null; u.work = true; rb.hp = Math.min(rb.maxhp, rb.hp + REPAIR_HPS * (D.craft || 1) * dt); break; }
    }
    if (o.t !== 'build' && o.t !== 'repair') u.work = false;
    // окаменение: стоит на месте (без дела или стреляет с места) PETRIFY.t секунд — камень (броня +PETRIFY.armor)
    if (D.petrify) { if (u.ord.t !== 'move' && !u.moving && !(u.wakeT > this.t)) { u.stillT = (u.stillT || 0) + dt; if (u.stillT >= PETRIFY.t && !u.stone) { u.stone = true; this.emit('petrify', { p: u.owner, id: u.id }); } } else if (!u.stone) u.stillT = 0; }
  };
  // раскат валуна-стража: катится по прямой; первый враг на пути — удар ROLL.dmg и разлёт; упёрся / время вышло — встал
  G._rollStep = function (u, D, dt) {
    var r = u.roll, self = this, v = D.spd * ROLL.spd * T * dt * (TSPD[this.terrAt(Math.floor(u.x / T), Math.floor(u.y / T))] || 1) * this.coldMove(u), nx = u.x + r.vx * v, ny = u.y + r.vy * v;
    u.moving = true; u.fx = r.vx; u.fy = r.vy;
    var hit = null; for (var i = 0; i < this.ents.length && !hit; i++) { var e = this.ents[i]; if (e.dead || (e.kind !== 'u' && e.kind !== 'b') || !this.hostile(u.owner, e.owner)) continue; if (this.distTo({ x: nx, y: ny }, e) <= u.r + 3) hit = e; }
    if (hit) {
      this._damage(hit, ROLL.dmg, u);
      this.ents.forEach(function (e) { if (e === hit || e.dead || e.kind !== 'u' || !self.hostile(u.owner, e.owner)) return; if (Math.hypot(e.x - nx, e.y - ny) <= ROLL.splash * T + e.r) self._damage(e, ROLL.dmg * 0.5, u); });
      this.emit('roll', { p: u.owner, id: u.id, x: nx, y: ny, hit: true }); u.roll = null; u.cd = D.cd; return;
    }
    if (!this.walkPx(nx, ny) || this.t >= r.until) { u.roll = null; return; }
    u.x = nx; u.y = ny;
  };
  G._afterBuild = function (u) { var pg = u.prevGather; this._order(u, pg && this.get(pg) ? { t: 'gather', id: pg } : { t: 'idle' }); };
  G._canSee = function (p, e) { return p !== 0 || this.visibleTo(e, p) || (e.kind === 'b' && e.seen[p]); };
  // Подойти к прямоугольнику здания/месторождения
  G._approachRect = function (u, D, dt, e) {
    if (!u.path || u.pathFor !== e.id) {
      var tiles = this.pathToRect(Math.floor(u.x / T), Math.floor(u.y / T), e, 1); u.path = tiles ? this._smooth(u, tiles) : []; u.pathFor = e.id; u.stuckT = 0; u.lastD = 1e9;
      if (!u.path.length) { // уже рядом, но вне досягаемости — шаг к центру
        var a = Math.atan2(e.y - u.y, e.x - u.x); this._stepTo(u, D, dt, u.x + Math.cos(a) * 20, u.y + Math.sin(a) * 20); return; }
    }
    if (this._walkPath(u, D, dt)) { u.path = null; var a2 = Math.atan2(e.y - u.y, e.x - u.x); this._stepTo(u, D, dt, u.x + Math.cos(a2) * 20, u.y + Math.sin(a2) * 20); }
  };
  // Идти к точке; true — пришли
  G._follow = function (u, D, dt, x, y, tx, ty, arrive) {
    arrive = arrive || 6;
    if (Math.hypot(u.x - x, u.y - y) <= arrive) return true;
    if (!u.path || u.pathFor !== 'p' + x + ',' + y) {
      var gx = tx != null ? tx : Math.floor(x / T), gy = ty != null ? ty : Math.floor(y / T);
      var tiles = this.pathToTile(Math.floor(u.x / T), Math.floor(u.y / T), gx, gy);
      if (!tiles) return true;
      var exact = tiles.found && this.walkPx(x, y);
      u.path = this._smooth(u, tiles, exact ? x : null, exact ? y : null); u.pathFor = 'p' + x + ',' + y; u.stuckT = 0; u.lastD = 1e9;
      if (!tiles.found && tiles.length <= 1) return true;
    }
    if (this._walkPath(u, D, dt)) { u.repaths++; if (u.repaths > 2 || Math.hypot(u.x - x, u.y - y) < T * 1.2) return true; u.path = null; }
    return false;
  };
  // Движение по пути; true — путь кончился. Залип (не приближаемся 1 с) — перестроить путь.
  G._walkPath = function (u, D, dt) {
    if (!u.path || !u.path.length) return true;
    var wp = u.path[0], d = Math.hypot(wp[0] - u.x, wp[1] - u.y);
    if (d < 5) { u.path.shift(); u.lastD = 1e9; return !u.path.length; }
    if (d < u.lastD - 2) { u.lastD = d; u.stuckT = 0; } else { u.stuckT += dt; if (u.stuckT > 1) { u.stuckT = 0; u.lastD = 1e9; u.repaths++; u.path = null; return u.repaths > 4; } }
    this._stepTo(u, D, dt, wp[0], wp[1]);
    return false;
  };
  G._stepTo = function (u, D, dt, x, y) {
    var dx = x - u.x, dy = y - u.y, d = Math.hypot(dx, dy); if (d < 0.01) return;
    if (u.rootT > this.t) return;                                   // опутан корнями Матушки
    if (u.stone) { u.stone = false; u.stillT = 0; u.wakeT = this.t + PETRIFY.wake; }   // окаменевший «стряхивает камень»
    if (u.wakeT > this.t) return;
    var tt = this.terr[Math.floor(u.y / T) * this.MW + Math.floor(u.x / T)];
    var v = D.spd * T * dt * (TSPD[tt] || 1) * this.coldMove(u) * (u.sm || 1) * (u.hasteT > this.t ? BUZZ.mul : 1), k = Math.min(1, v / d), nx = u.x + dx * k, ny = u.y + dy * k;
    u.fx = dx / d; u.fy = dy / d; u.moving = true;
    this._place(u, nx, ny);
  };
  G._place = function (u, nx, ny) {
    if (this.walkPx(nx, ny)) { u.x = nx; u.y = ny; }
    else if (this.walkPx(nx, u.y)) u.x = nx;
    else if (this.walkPx(u.x, ny)) u.y = ny;
  };
  // Юнит в здании (поставили поверх) — вытолкнуть на ближайшую свободную клетку
  G._pushOut = function (b) {
    for (var i = 0; i < this.ents.length; i++) { var u = this.ents[i]; if (u.kind !== 'u' || u.dead) continue;
      if (!this.walkPx(u.x, u.y)) { var c = this._freeAround(Math.floor(u.x / T), Math.floor(u.y / T), 1)[0]; u.x = (c[0] + 0.5) * T; u.y = (c[1] + 0.5) * T; u.path = null; } }
  };
  // Расталкивание юнитов (стоящие уступают идущим)
  G._separate = function (dt) {
    var us = this.ents.filter(function (e) { return e.kind === 'u' && !e.dead; }), n = us.length;
    for (var i = 0; i < n; i++) { var a = us[i];
      for (var j = i + 1; j < n; j++) { var b = us[j], dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r - 2;
        if (dx > rr || dx < -rr || dy > rr || dy < -rr) continue;
        var d2 = dx * dx + dy * dy; if (d2 >= rr * rr) continue;
        var d = Math.sqrt(d2) || 0.01; if (d2 < 0.0001) { dx = Math.cos(a.id) ; dy = Math.sin(a.id); d = 1; }
        var ov = (rr - d) * 0.5, ux = dx / d, uy = dy / d;
        var am = a.moving ? 0.35 : 1, bm = b.moving ? 0.35 : 1, wa = a.work || a.stone ? 0.1 : 1, wb = b.work || b.stone ? 0.1 : 1, s = am * wa + bm * wb || 1;
        var ka = ov * 2 * (am * wa) / s, kb = ov * 2 * (bm * wb) / s;
        this._place(a, a.x - ux * ka * 0.5, a.y - uy * ka * 0.5); this._place(b, b.x + ux * kb * 0.5, b.y + uy * kb * 0.5);
      } }
    for (var k = 0; k < n; k++) us[k].moving = false;
  };
  // Боевые: найти цель в радиусе обзора и сражаться. idle=true — не уходить далеко от поста.
  G._autoEngage = function (u, D, dt, idle) {
    if (D.worker && !u.tgt) return false;
    var tg = u.tgt ? this.get(u.tgt) : null;
    if (tg && (tg.dead || this.distTo(u, tg) > (D.sight + 2) * T)) { tg = null; u.tgt = 0; }
    u.scanT -= dt;
    if (u.scanT <= 0) { u.scanT = 0.3; var nt = this._scan(u, D); if (nt && (!tg || (tg.kind === 'b' && nt.kind === 'u'))) { tg = nt; u.tgt = nt.id; } }
    if (idle && tg && u.post && Math.hypot(u.x - u.post.x, u.y - u.post.y) > (D.sight + 3) * T) tg = null; // поводок: далеко от поста не гонимся
    if (!tg) {
      u.tgt = 0;
      if (idle && u.post) { var po = u.post; u.post = null; if (Math.hypot(u.x - po.x, u.y - po.y) > T * 1.5) this._order(u, { t: 'move', x: po.x, y: po.y }); }
      else if (idle && u.path) u.path = null;
      return false;
    }
    if (idle && !u.post) u.post = { x: u.x, y: u.y };
    this._engage(u, D, dt, tg);
    return true;
  };
  G._scan = function (u, D) {
    var best = null, bs = 1e9, sight = this.sightOf(u, D) * T;
    for (var i = 0; i < this.ents.length; i++) { var e = this.ents[i]; if (e.dead || !this.hostile(u.owner, e.owner)) continue;
      if (Math.abs(e.x - u.x) > sight + 80 || Math.abs(e.y - u.y) > sight + 80) continue;
      var d = this.distTo(u, e); if (d > sight) continue;
      if (u.owner === 0 && !this.visibleTo(e, 0)) continue;
      if (e.quiet || (u.ignoreId === e.id && u.ignoreT > this.t)) continue;   // кампания: «тихое» здание (котельня Чащи) — сами не бьют, только по приказу
      var ed = this.def(e); if (ed.civil && u.owner === 0) continue;   // кампания: игрок сам не бьёт мирных (посол) — только по приказу
      var sc = d + (e.kind === 'b' ? 4 * T : 0) + (e.kind === 'u' && ed.worker ? T : 0);
      if (sc < bs) { bs = sc; best = e; } }
    return best;
  };
  G._engage = function (u, D, dt, tg) {
    var range = Math.max(D.range * T, 4) + 2, d = this.distTo(u, tg) - u.r;
    if (D.roll && !(u.rollCd > this.t) && !(u.wakeT > this.t) && d >= ROLL.min * T && d <= ROLL.max * T && this.lineFree(u.x, u.y, tg.x, tg.y, u.r)) {   // раскат
      var L = Math.hypot(tg.x - u.x, tg.y - u.y) || 1; if (u.stone) { u.stone = false; u.stillT = 0; }
      u.roll = { vx: (tg.x - u.x) / L, vy: (tg.y - u.y) / L, until: this.t + ROLL.dur }; u.rollCd = this.t + ROLL.cd; u.path = null; this.emit('roll', { p: u.owner, id: u.id, x: u.x, y: u.y, hit: false }); return;
    }
    if (d <= range) {
      u.path = null; u.fx = (tg.x - u.x) / (Math.hypot(tg.x - u.x, tg.y - u.y) || 1); u.fy = (tg.y - u.y) / (Math.hypot(tg.x - u.x, tg.y - u.y) || 1);
      if (u.cd <= 0) { u.cd = D.cd; this._hit(u, D, tg); }
      return;
    }
    // догоняем: путь перестраиваем раз в 0.6 с
    u.chaseT = (u.chaseT || 0) - dt;
    if (!u.path || u.chaseT <= 0) {
      u.chaseT = 0.6;
      var tiles = tg.kind === 'u' ? this.pathToTile(Math.floor(u.x / T), Math.floor(u.y / T), Math.floor(tg.x / T), Math.floor(tg.y / T)) : this.pathToRect(Math.floor(u.x / T), Math.floor(u.y / T), tg, 1);
      // цель недостижима (за водой) и ближе не подойти — бросить её на время (иначе юнит «залипает» у берега)
      if (tiles && !tiles.found && tiles.length <= 2) { u.ignoreId = tg.id; u.ignoreT = this.t + 8; u.tgt = 0; u.path = null; if (u.ord.t === 'attack') this._order(u, { t: 'idle' }); return; }
      u.path = tiles ? this._smooth(u, tiles, tg.kind === 'u' ? tg.x : null, tg.kind === 'u' ? tg.y : null) : null; u.pathFor = 'chase'; u.lastD = 1e9;
    }
    if (!u.path || !u.path.length || this._walkPath(u, D, dt)) { this._stepTo(u, D, dt, tg.x, tg.y); }
  };
  G._hit = function (u, D, tg) {
    var dmg = function (e) { var ed = e.kind === 'n' ? null : this.def(e); return Math.max(1, D.dmg - (ed && ed.armor || 0) - (e.stone ? PETRIFY.armor : 0)); }.bind(this);   // броня; здания Курганного рода — каменные; окаменевшие — крепче
    this.shots.push({ x0: u.x, y0: u.y, x1: tg.x, y1: tg.y, t: 0, dur: D.ranged ? 0.18 : 0.12, kind: u.type, owner: u.owner });
    this._damage(tg, dmg(tg), u);
    if (D.splash) { var R = D.splash * T;
      for (var i = 0; i < this.ents.length; i++) { var e = this.ents[i]; if (e === tg || e.dead || e.kind !== 'u' || !this.hostile(u.owner, e.owner)) continue;
        if (Math.hypot(e.x - tg.x, e.y - tg.y) <= R + e.r) this._damage(e, dmg(e) * 0.5, u); } }
    this.emit('shot', { p: u.owner, type: u.type, x: u.x, y: u.y, tx: tg.x, ty: tg.y });
  };
  G._damage = function (e, n, by) {
    if (e.dead) return; if (e.tough && by && !this.def(by).mech) n *= e.tough; // кампания: засека — пробивают только машины (шагоход)
    e.hp -= n; e.hitT = this.t;
    this.emit('hurt', { p: e.owner, id: e.id, x: e.x, y: e.y, kind: e.kind });
    // ответный огонь: стоящий боец переключается на обидчика
    if (e.kind === 'u' && by && !by.dead && e.ord.t === 'idle' && !e.tgt && !this.def(e).worker && !calmD(this.def(e))) e.tgt = by.id;
    if (e.hp <= 0) this._kill(e, by);
  };
  G._kill = function (e, by, silent) {
    e.dead = true; e.hp = 0; this.byId.delete(e.id);
    if (e.kind !== 'u') { this._occupy(e, 0); this._mycDirty = true; if (e.kind === 'b' && e.done && this.def(e).deck) this._deck(e, false); }
    if (!silent && e.owner >= 0) { this.stats[e.owner].lost++; if (e.kind === 'b') this.stats[e.owner].lostB++; if (by) this.stats[by.owner].kills++; }
    this.emit('death', { p: e.owner, id: e.id, kind: e.kind, type: e.type, x: e.x, y: e.y, s: e.s, silent: !!silent, tag: e.tag || null, hero: e.kind === 'u' && e.owner >= 0 && !!this.def(e).hero });
  };
  // Добыча: к месторождению → копать → к ближайшему складу (главное здание) → сдать → снова
  G._gather = function (u, D, dt, reach) {
    var o = u.ord, n = this.get(o.id);
    if (u.carry && (o.ret || !n || n.dead || u.carry.amt > 0 && o.phase !== 'mine')) {
      var drop = this._nearestDrop(u); if (!drop) { this._order(u, { t: 'idle' }); return; }
      if (this.distTo(u, drop) > reach) { this._approachRect(u, D, dt, drop); return; }
      this.res[u.owner][RKEY[u.carry.type]] += u.carry.amt; this.stats[u.owner].gathered += u.carry.amt; if (u.carry.type === 'timber') this.stats[u.owner].wood += u.carry.amt;
      this.emit('deposit', { p: u.owner, type: u.carry.type, amt: u.carry.amt, x: u.x, y: u.y });
      var lastType = u.carry.type; u.carry = null; o.ret = false; u.path = null;
      if (!n || n.dead) { var nn = this._nearestNode(u, lastType, null, u.lastNX); if (nn) { o.id = nn.id; n = nn; } else { this._order(u, { t: 'idle' }); return; } }
    }
    if (!n || n.dead) { var alt = this._nearestNode(u, u.lastType || 'amber', null, u.lastNX); if (alt) { o.id = alt.id; u.path = null; } else this._order(u, { t: 'idle' }); return; }
    u.lastNode = n.id; u.lastType = n.type; u.lastNX = { x: n.x, y: n.y };
    if (this.distTo(u, n) > reach) { o.phase = 'go'; this._approachRect(u, D, dt, n); return; }
    o.phase = 'mine'; u.path = null; u.work = true; u.mineT = (u.mineT || 0) + dt * this.coldWork(u); u.fx = (n.x - u.x) / (Math.hypot(n.x - u.x, n.y - u.y) || 1); u.fy = (n.y - u.y) / (Math.hypot(n.x - u.x, n.y - u.y) || 1);
    var gk = GATHER[n.type];
    if (u.mineT >= gk.t) {
      u.mineT = 0; var amt = Math.min(gk.amt, n.amt); n.amt -= amt; u.carry = { type: n.type, amt: amt }; o.phase = 'back'; u.work = false;
      if (n.amt <= 0) this._kill(n, null, true);
    }
  };
  G._nearestDrop = function (u) {
    var best = null, bd = 1e9;
    for (var i = 0; i < this.ents.length; i++) { var e = this.ents[i]; if (e.dead || e.owner !== u.owner || e.kind !== 'b' || !e.done || !this.def(e).drop) continue;
      var d = this.distTo(u, e); if (d < bd) { bd = d; best = e; } }
    return best;
  };
  // ближайшее месторождение типа type; from — откуда искать (иссякшая жила: искать рядом с ней, а не у склада)
  G._nearestNode = function (u, type, maxD, from) {
    var best = null, bd = maxD || 14 * T, ox = from ? from.x : u.x, oy = from ? from.y : u.y;
    for (var i = 0; i < this.ents.length; i++) { var e = this.ents[i]; if (e.dead || e.kind !== 'n' || e.type !== type) continue; var d = Math.hypot(e.x - ox, e.y - oy); if (d < bd) { bd = d; best = e; } }
    return best;
  };

  // ---------- Зимний вал (кампания): граница льда ползёт по карте ----------
  // dir 's' — с севера на юг (за валом клетки y < pos), 'n' — с юга на север (y >= pos), 'e' — с запада на восток (x < pos), 'w' — (x >= pos).
  // Каждый пройденный ряд замерзает: трава, вереск, снег и вода → лёд (лес, камни и настил моста остаются). За валом — вдвое медленнее
  // и мороз жжёт всех (dps; здания — так же). speed — клеток в секунду; stop — где вал встанет.
  G.setWall = function (o) {
    if (!o) { this.wall = null; return; }
    var w = this.wall || {}; Object.assign(w, o); if (w.pos == null) w.pos = w.dir === 'n' ? this.MH : w.dir === 'w' ? this.MW : 0;
    if (w.done == null) w.done = w.dir === 's' || w.dir === 'e' ? Math.floor(w.pos) : Math.ceil(w.pos); w.hurtT = w.hurtT || 0; this.wall = w;
  };
  G.inWall = function (x, y) {
    var w = this.wall; if (!w) return false; var tx = x / T, ty = y / T;
    return w.dir === 's' ? ty < w.pos : w.dir === 'n' ? ty >= w.pos : w.dir === 'e' ? tx < w.pos : tx >= w.pos;
  };
  G._wallStep = function (dt) {
    var w = this.wall, self = this, fwd = w.dir === 's' || w.dir === 'e';
    if (w.speed) { var np = w.pos + (fwd ? 1 : -1) * w.speed * dt; if (w.stop != null) np = fwd ? Math.min(np, w.stop) : Math.max(np, w.stop); w.pos = np; }
    // ряды, через которые прошёл вал, — замерзают
    var line = fwd ? Math.floor(w.pos) : Math.ceil(w.pos), horiz = w.dir === 's' || w.dir === 'n';
    while (fwd ? w.done < line : w.done > line) {
      var row = fwd ? w.done : w.done - 1, cells = [], n = horiz ? this.MW : this.MH;
      for (var k = 0; k < n; k++) { var cx = horiz ? k : row, cy = horiz ? row : k; if (!this.inMap(cx, cy)) continue; var tt = this.terr[cy * this.MW + cx]; if (tt === TERR.GRASS || tt === TERR.HEATH || tt === TERR.SNOW || tt === TERR.WATER) cells.push([cx, cy]); }
      if (cells.length) this.setTiles(cells, TERR.ICE);
      w.done += fwd ? 1 : -1; this.emit('wallRow', { row: row });
    }
    w.hurtT -= dt; if (w.hurtT > 0 || !w.dps) return; w.hurtT = 0.5;
    this.ents.forEach(function (e) { if (e.dead || e.owner < 0 || !self.inWall(e.x, e.y) || self.def(e).frost || (e.stone && self.stoneRest)) return; self._damage(e, w.dps * 0.5 * (e.kind === 'b' ? 1.5 : 1), null); });   // стужевики и сердце вала — свои; окаменевших («камень хранит тепло») не жжёт
  };

  // ---------- Рой-опылитель (кампания Чащи): у вырубки снова растёт лес ----------
  // стоящий (idle) рой раз в POLLEN.t с (мороз замедляет) превращает ближайшую клетку вырубки (felled) в радиусе POLLEN.r в подрост
  // (young: молодой лес — проходим, чтобы рой и бойцы не запирали сами себя)
  G._pollen = function (u, dt) {
    if (u.ord.t !== 'idle') { u.pollT = 0; return; }
    u.pollT = (u.pollT || 0) + dt * this.coldGrow(u.owner); if (u.pollT < POLLEN.t) return; u.pollT = 0;
    var cx = Math.floor(u.x / T), cy = Math.floor(u.y / T), R = Math.ceil(POLLEN.r), best = null, bd = 1e9;
    for (var y = cy - R; y <= cy + R; y++) for (var x = cx - R; x <= cx + R; x++) {
      if (!this.inMap(x, y)) continue; var k = y * this.MW + x;
      if (!this.felled[k] || this.occ[k] || !PASS[this.terr[k]]) continue;
      var d = Math.hypot(x + 0.5 - u.x / T, y + 0.5 - u.y / T); if (d > POLLEN.r || d >= bd) continue;
      bd = d; best = [x, y, k]; }
    if (!best) return;
    this.felled[best[2]] = 0; this.young[best[2]] = 1; this.terrRev++; u.work = true;
    this.stats[u.owner].regrown++; this.emit('regrow', { p: u.owner, x: (best[0] + 0.5) * T, y: (best[1] + 0.5) * T });
  };
  G.felledLeft = function () { var n = 0; for (var i = 0; i < this.felled.length; i++) if (this.felled[i] && PASS[this.terr[i]]) n++; return n; };

  // ---------- Корни под льдом (кампания Чащи, game.thaw) ----------
  // раз в 0,5 с: лёд под грибницей Чащи (вне вала) тает за THAW.t с → трава; у кромки вала (ряды pos − back … pos + front)
  // клеток грибницы ≥ need — вал отступает (до push клеток/с, растёт с числом клеток), отступивший вал снова замерзает при наступлении
  G._thawStep = function (dt) {
    this._thawAcc += dt; if (this._thawAcc < 0.5) return; var step = this._thawAcc; this._thawAcc = 0;
    var o = this.thaw, need = o.need == null ? THAW.need : o.need, tt = o.t == null ? THAW.t : o.t, N = this.MW * this.MH, TA = this._thawT || (this._thawT = new Float32Array(N)), cells = [], w = this.wall;
    for (var p = 0; p < this.sides; p++) { if (!this.race(p).grow) continue; var M = this.myc[p];
      for (var k = 0; k < N; k++) { if (!M[k] || this.terr[k] !== TERR.ICE) { if (TA[k] && !M[k]) TA[k] = 0; continue; }
        var x = k % this.MW, y = (k / this.MW) | 0; if (w && this.inWall((x + 0.5) * T, (y + 0.5) * T)) continue;
        TA[k] += step; if (TA[k] >= tt) { TA[k] = 0; cells.push([x, y]); } } }
    if (cells.length) { this.setTiles(cells, TERR.GRASS); this.emit('thaw', { n: cells.length }); }
    if (!w || w.dir !== 's') return;
    var f = Math.floor(w.pos), n = 0, M0 = this.myc[0], back = o.back == null ? THAW.back : o.back, front = o.front == null ? THAW.front : o.front;
    for (var yy = Math.max(0, f - back); yy <= Math.min(this.MH - 1, f + front); yy++) for (var xx = 0; xx < this.MW; xx++) if (M0[yy * this.MW + xx]) n++;
    w.crack = n;
    if (n >= need && w.pos > (o.min || 0)) { var push = (o.push == null ? THAW.push : o.push) * Math.min(1, n / (o.full || 20)) * step; w.pos = Math.max(o.min || 0, w.pos - push); w.done = Math.min(w.done, Math.floor(w.pos)); this.emit('wallPush', { pos: w.pos, n: n }); }
  };

  // ---------- Туман войны ----------
  G._updateVis = function () {
    for (var p = 0; p < 2; p++) {
      var V = this.vis[p];
      for (var i = 0; i < V.length; i++) if (V[i] === 2) V[i] = 1;
      for (var k = 0; k < this.ents.length; k++) { var e = this.ents[k]; if (e.dead || e.owner !== p) continue;
        var D = this.def(e), sr = this.sightOf(e, D), cx = e.x / T, cy = e.y / T;
        for (var y = Math.floor(cy - sr); y <= Math.ceil(cy + sr); y++) for (var x = Math.floor(cx - sr); x <= Math.ceil(cx + sr); x++) {
          if (!this.inMap(x, y)) continue; var dx = x + 0.5 - cx, dy = y + 0.5 - cy; if (dx * dx + dy * dy <= sr * sr) V[y * this.MW + x] = 2; } }
      if (p === 0 && this.flares.length) { var tn = this.t; this.flares = this.flares.filter(function (f) { return f.until > tn; });
        for (var fi = 0; fi < this.flares.length; fi++) { var fl = this.flares[fi], fx = fl.x / T, fy = fl.y / T;
          for (var y2 = Math.floor(fy - fl.r); y2 <= Math.ceil(fy + fl.r); y2++) for (var x2 = Math.floor(fx - fl.r); x2 <= Math.ceil(fx + fl.r); x2++) if (this.inMap(x2, y2) && Math.hypot(x2 + 0.5 - fx, y2 + 0.5 - fy) <= fl.r) V[y2 * this.MW + x2] = 2; } }
      // здания противника, попавшие в обзор, запоминаются
      for (var j = 0; j < this.ents.length; j++) { var b = this.ents[j]; if (b.kind !== 'b' || b.owner === p || b.seen[p]) continue;
        for (var yy = b.ty; yy < b.ty + b.s && !b.seen[p]; yy++) for (var xx = b.tx; xx < b.tx + b.s; xx++) if (V[yy * this.MW + xx] === 2) { b.seen[p] = true; break; } }
    }
  };
  G.tileVis = function (p, tx, ty) { return this.fogOff ? 2 : this.vis[p][ty * this.MW + tx]; };

  // ---------- ИИ: развивается по плану и нападает волнами ----------
  // Сложность ИИ скирмиша. normal — прежний ИИ без изменений (отпечатки партий ИИ против ИИ совпадают, tests/difficulty.mjs);
  // easy — реже думает, меньше рабочих, позже и мельче волны, одна казарма; hard — см. AI.prototype._hard* (без бонусов ресурсов).
  var AI_LEVELS = {
    easy:   { think: 1.6, workers: 9, resinW: 2, wave0: 420, size0: 4, sizeStep: 2, sizeMax: 12, gap: 140, prodMax: 1, mains: 1, planK: 1.5, queue: 1 },
    normal: { think: 1, workers: 14, resinW: 0, wave0: 300, size0: 5, sizeStep: 3, sizeMax: 24, gap: 100, prodMax: 3, mains: 3, planK: 1, queue: 2 },
    hard:   { think: 0.5, workers: 20, resinW: 0, mainsGrow: 6, wave0: 230, size0: 8, sizeStep: 4, sizeMax: 30, gap: 75, prodMax: 5, mains: 4, planK: 1, queue: 2 }
  };
  P.AI_LEVELS = AI_LEVELS;
  function AI(game, p, level) {
    this.level = AI_LEVELS[level] ? level : 'normal'; var C = this.cfg = AI_LEVELS[this.level]; this.hard = this.level === 'hard';
    this.g = game; this.p = p; this.t = 0; this.think = 0.5; this.wave = 0; this.nextWave = C.wave0; this.waveSize = C.size0; this.lastWaveT = -1e9;
    var R = game.race(p);
    var O = R.order;   // [дом, казарма, тяжёлое, главное] — у каждой расы свои
    this.plan = this.hard ? (R.grow   // трудный: быстрее встаёт на ноги, раньше тяжёлое здание, больше казарм
      ? [{ at: 22, type: 'hollow' }, { at: 40, type: 'den' }, { at: 100, type: 'hollow' }, { at: 140, type: 'barrow' }, { at: 200, type: 'hollow' }, { at: 260, type: 'hollow' }, { at: 330, type: 'hollow' }]
      : [{ at: 20, type: O[0] }, { at: 42, type: O[1] }, { at: 95, type: O[1] }, { at: 120, type: O[0] }, { at: 160, type: O[2] }, { at: 210, type: O[0] }, { at: 250, type: O[1] }, { at: 290, type: O[0] }, { at: 350, type: O[0] }, { at: 420, type: O[0] }])
      : R.grow
      ? [{ at: 30, type: 'hollow' }, { at: 55, type: 'den' }, { at: 150, type: 'hollow' }, { at: 190, type: 'barrow' }, { at: 300, type: 'hollow' }, { at: 420, type: 'hollow' }]
      : [{ at: 30, type: O[0] }, { at: 60, type: O[1] }, { at: 150, type: O[0] }, { at: 200, type: O[2] }, { at: 280, type: O[1] }, { at: 330, type: O[0] }, { at: 450, type: O[0] }];
    if (C.planK !== 1) this.plan.forEach(function (s) { s.at = Math.round(s.at * C.planK); });
    this.done = 0; this.log = [];
  }
  P.AI = AI;
  AI.prototype.update = function (dt) { this.t += dt; this.think -= dt; if (this.think > 0) return; this.think = this.cfg.think; this._think(); };
  AI.prototype._mine = function () { var p = this.p; return this.g.ents.filter(function (e) { return !e.dead && e.owner === p; }); };
  AI.prototype._think = function () {
    var g = this.g, p = this.p, R = g.race(p), me = this._mine(), self = this;
    var units = me.filter(function (e) { return e.kind === 'u'; }), blds = me.filter(function (e) { return e.kind === 'b'; });
    var main = blds.filter(function (b) { return b.type === R.main && b.done; })[0];
    var workers = units.filter(function (u) { return R.units[u.type].worker; }), army = units.filter(function (u) { return !R.units[u.type].worker; });
    var sup = g.supply(p);
    // 1) рабочие: простаивающих — на добычу (смола — 3 рабочих, когда нужна)
    var NA = R.nodes.a, NR = R.nodes.r;   // янтарь/смола или камень/руда
    var C = this.cfg, wantResin = g.hasDone(p, R.order[1]) || this.t > 120 ? (C.resinW || (R.grow ? 3 : 4)) + (this.hard ? (g.res[p].r > 260 ? -2 : (g.res[p].r < 120 && g.hasDone(p, R.order[2])) || g.res[p].a > 600 ? 2 : 0) : 0) : 0;
    var onResin = workers.filter(function (u) { var n = u.ord.t === 'gather' && g.get(u.ord.id); return n && n.type === NR; }).length;
    workers.forEach(function (u) {
      if (u.ord.t !== 'idle') return;
      var type = onResin < wantResin ? NR : NA, n = g._nearestNode(u, type, 30 * T) || g._nearestNode(u, NA, 40 * T);
      if (n) { g.cmd(p, { t: 'gather', ids: [u.id], target: n.id }); if (n.type === NR) onResin++; }
    });
    if (onResin < wantResin) { var mover = workers.filter(function (u) { var n = u.ord.t === 'gather' && g.get(u.ord.id); return n && n.type === NA && !u.carry; })[0];
      var rn = mover && g._nearestNode(mover, NR, 40 * T); if (rn) g.cmd(p, { t: 'gather', ids: [mover.id], target: rn.id }); }
    // 2) рабочие до 14
    if (main) {
      var queued = R.grow ? main.cocoons.filter(function (c) { return c.type === R.worker; }).length : main.queue.length;
      if (workers.length + queued < C.workers && (R.grow ? main.larva > (army.length < 2 && this.t > 200 ? 1 : 0) : main.queue.length < C.queue)) g.cmd(p, { t: 'train', id: main.id, type: R.worker });
      if (this.hard) this._hardWorkers(blds, workers, main);
    }
    // 3) провизия
    var pendingSup = blds.filter(function (b) { return !b.done && R.buildings[b.type].sup; }).length;
    if (sup.cap < SUP_MAX && sup.used + (this.hard ? 7 : 4) >= sup.cap && (!pendingSup || (this.hard && pendingSup < 2 && sup.used >= 24)) && g.afford(p, R.buildings[R.supply].cost)) this._place(R.supply, workers, main);
    var trainArmy = function () {
      blds.forEach(function (b) {
        if (!b.done) return; var BD = R.buildings[b.type];
        if (R.grow && BD.larva) {
          if (b.larva < 1 || workers.length < 8) return;
          var t = g.hasDone(p, 'barrow') && army.filter(function (u) { return u.type === 'shell'; }).length * (self.hard ? 2 : 3) < army.length ? 'shell' : 'stinger';
          if (!g.trainBlock(p, b, t)) g.cmd(p, { t: 'train', id: b.id, type: t });
        } else if (BD.trains && b.type !== R.main && b.queue.length < C.queue) {
          var ut = BD.trains[0]; if (!g.trainBlock(p, b, ut)) g.cmd(p, { t: 'train', id: b.id, type: ut });
        }
      });
    };
    if (this.hard && this.t > 150) trainArmy();
    // 4) план стройки
    var step = this.plan[this.done];
    if (step && this.t >= step.at) {
      if (step.type === R.supply && pendingSup) this.done++;
      else if (g.afford(p, R.buildings[step.type].cost) && (!R.buildings[step.type].req || g.hasDone(p, R.buildings[step.type].req))) { if (this._place(step.type, workers, main)) this.done++; }
    }
    // лишний янтарь — ещё одно здание бойцов (до 3)
    var prodType = R.order[1], prodN = blds.filter(function (b) { return b.type === prodType; }).length;
    if (!R.grow && this.done >= 2 && g.res[p].a > (this.hard ? 450 : 400) && prodN < C.prodMax && !blds.some(function (b) { return b.type === prodType && !b.done; })) this._place(prodType, workers, main);
    var nMain = blds.filter(function (b) { return b.type === R.main; }).length;   // Чаща: второй и третий Пень — больше личинок (янтарь не копится без дела)
    if (R.grow && this.done >= (this.hard ? 2 : 3) && nMain < (C.mainsGrow || C.mains) && g.res[p].a > (this.hard ? 250 + 100 * nMain : 350 + 250 * nMain) && (!this.hard || blds.filter(function (b) { return b.type === R.main && !b.done; }).length < 2) && (this.hard || !blds.some(function (b) { return b.type === R.main && !b.done; }))) { var at = this.hard && nMain === 1 ? this._expandSpot(blds) : null; if (!this._place(R.main, workers, main, at) && at) this._place(R.main, workers, main); }
    if (this.hard) this._hardMacro(blds, workers, main);
    // 5) армия (трудный ИИ обучает бойцов раньше стройки — см. выше)
    if (!this.hard) trainArmy();
    // 6) оборона: враг у наших зданий — все бойцы туда
    var threat = null;
    for (var i = 0; i < g.ents.length && !threat; i++) { var e = g.ents[i]; if (e.dead || e.kind !== 'u' || !g.hostile(p, e.owner)) continue;
      for (var j = 0; j < blds.length; j++) if (Math.hypot(e.x - blds[j].x, e.y - blds[j].y) < 9 * T) { threat = e; break; } }
    if (this.hard) { this._hardScout(workers); this._focus(army); if (this._hardArmy(army, threat, main)) return; }
    if (threat) { var idle = army.filter(function (u) { return u.ord.t !== 'amove' || !u.wave; }); if (idle.length) g.cmd(p, { t: 'amove', ids: idle.map(function (u) { return u.id; }), x: threat.x, y: threat.y }); return; }
    // 7) волна
    if (this.t >= this.nextWave && army.length >= this.waveSize) {
      var target = this._target(); if (target) {
        var ids = army.map(function (u) { u.wave = true; return u.id; });
        g.cmd(p, { t: 'amove', ids: ids, x: target.x, y: target.y });
        this.wave++; this.lastWaveT = this.t; this.nextWave = this.t + C.gap; this.waveSize = Math.min(C.sizeMax, this.waveSize + C.sizeStep);
        g.emit('wave', { p: p, n: this.wave, size: ids.length });
      }
    } else if (this.wave > 0) {
      // волна дошла и стоит без дела — добить ближайшее здание
      var tgt2 = this._target(); army.forEach(function (u) { if (u.wave && u.ord.t === 'idle' && !u.tgt && tgt2) g.cmd(p, { t: 'amove', ids: [u.id], x: tgt2.x, y: tgt2.y }); });
    }
    // сбор у базы для невоюющих
    if (main) army.forEach(function (u) { if (!u.wave && u.ord.t === 'idle' && Math.hypot(u.x - main.x, u.y - main.y) > 12 * T) g.cmd(p, { t: 'move', ids: [u.id], x: main.x + (p ? -4 : 4) * T, y: main.y + (p ? -4 : 4) * T }); });
  };
  AI.prototype._target = function () {
    var g = this.g, p = this.p, enemy = 1 - p, best = null, bd = 1e9, home = this._mine().filter(function (e) { return e.kind === 'b'; })[0], ox = home ? home.x : g.MW * T / 2, oy = home ? home.y : g.MH * T / 2;
    g.ents.forEach(function (e) { if (e.dead || e.owner !== enemy || e.kind !== 'b') return; var d = Math.hypot(e.x - ox, e.y - oy); if (d < bd) { bd = d; best = e; } });
    return best;
  };
  // Поиск места: спираль вокруг главного здания, с зазором в 1 клетку, чтобы не замуровать базу
  AI.prototype._place = function (type, workers, main, at) {   // at — {x, y}: искать место вокруг этой точки (трудный ИИ: новое месторождение)
    var g = this.g, p = this.p, R = g.race(p), D = R.buildings[type];
    var c = at || main || this._mine().filter(function (e) { return e.kind === 'b'; })[0]; if (!c) return false;
    var cx = Math.floor(c.x / T), cy = Math.floor(c.y / T), dirX = p ? -1 : 1, dirY = p ? -1 : 1;
    for (var r = 3; r < 14; r++) {
      var cand = [];
      for (var dx = -r; dx <= r; dx++) for (var dy = -r; dy <= r; dy++) { if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; cand.push([cx + dx, cy + dy, -(dx * dirX + dy * dirY) * 0.2 + Math.abs(dx - dy) * 0.1]); }
      cand.sort(function (a, b) { return a[2] - b[2]; });
      for (var i = 0; i < cand.length; i++) {
        var tx = cand[i][0] - (D.s >> 1), ty = cand[i][1] - (D.s >> 1);
        if (!g.canPlace(p, type, tx, ty).ok || !this._margin(tx, ty, D.s)) continue;
        var free = workers.filter(function (u) { return !u.carry && u.ord.t !== 'build' && u.ord.t !== 'plant'; });
        var pool = free.length ? free : workers.filter(function (u) { return u.ord.t !== 'build' && u.ord.t !== 'plant'; }); if (!pool.length) return false;
        pool.sort(function (a, b) { return Math.hypot(a.x - (tx + 1) * T, a.y - (ty + 1) * T) - Math.hypot(b.x - (tx + 1) * T, b.y - (ty + 1) * T); });
        var ok = g.cmd(p, { t: 'build', ids: [pool[0].id], type: type, tx: tx, ty: ty });
        if (ok) { this.log.push([Math.round(this.t), type]); return true; }
      }
    }
    return false;
  };
  // ---------- Трудный ИИ: макро (второе месторождение, вторая мастерская тяжёлых), разведка, сила вместо счёта, фокус огня, отход ----------
  // Ресурсов он не получает больше других — только играет плотнее: думает дважды в секунду, держит до 20 рабочих.
  function powOf(g, e) { var D = g.def(e); return D.worker || calmD(D) ? 0 : (D.sup || 1) * (0.35 + 0.65 * e.hp / e.maxhp) * (D.petrify ? 1.35 : 1); }   // Курганный род в обороне каменеет — крепче
  AI.prototype._pow = function (list) { var g = this.g, s = 0; for (var i = 0; i < list.length; i++) s += powOf(g, list[i]); return s; };
  AI.prototype._foes = function (kind) { var g = this.g, p = this.p; return g.ents.filter(function (e) { return !e.dead && e.kind === kind && g.hostile(p, e.owner); }); };
  // ближайшая к базе ещё не занятая жила своего рода (вдали от своих складов)
  AI.prototype._expandSpot = function (blds) {
    var g = this.g, p = this.p, R = g.race(p), drops = blds.filter(function (b) { return R.buildings[b.type].drop; }), home = drops[0]; if (!home) return null;
    var best = null, bd = 1e9;
    g.ents.forEach(function (n) { if (n.dead || n.kind !== 'n' || n.type !== R.nodes.r || n.amt < 600) return;
      if (drops.some(function (b) { return Math.hypot(b.x - n.x, b.y - n.y) < 11 * T; })) return;
      if (g.ents.some(function (b) { return !b.dead && b.kind === 'b' && g.hostile(p, b.owner) && Math.hypot(b.x - n.x, b.y - n.y) < 14 * T; })) return;
      var d = Math.hypot(n.x - home.x, n.y - home.y); if (d < bd) { bd = d; best = n; } });
    return best ? { x: best.x, y: best.y } : null;
  };
  AI.prototype._hardWorkers = function (blds, workers, main) {
    var g = this.g, p = this.p, R = g.race(p), C = this.cfg; if (R.grow) return;
    var queued = 0; blds.forEach(function (b) { if (b.type === R.main) queued += b.queue.length; });
    blds.forEach(function (b) { if (b === main || !b.done || b.type !== R.main || b.queue.length >= 1) return; if (workers.length + queued < C.workers) { g.cmd(p, { t: 'train', id: b.id, type: R.worker }); queued++; } });
  };
  AI.prototype._hardMacro = function (blds, workers, main) {
    var g = this.g, p = this.p, R = g.race(p), O = R.order, res = g.res[p];
    var n = function (type, any) { return blds.filter(function (b) { return b.type === type && (any || b.done); }).length; };
    var building = function (type) { return blds.some(function (b) { return b.type === type && !b.done; }); };
    // второе месторождение: склад-главное здание у ближней свободной жилы
    if (!R.grow && this.t > 270 && n(R.main, true) < 2 && res.a >= R.buildings[R.main].cost.a + 60 && !building(R.main)) { var spot = this._expandSpot(blds); if (spot) this._place(R.main, workers, main, spot); }
    // вторая мастерская тяжёлых бойцов, когда смолы/руды в избытке
    if (n(O[2]) >= 1 && n(O[2], true) < 2 && res.r > 220 && g.afford(p, R.buildings[O[2]].cost) && !building(O[2])) this._place(O[2], workers, main);
  };
  // разведка: с ~60-й секунды рабочий обходит ближнюю свободную жилу (там потом второе месторождение — стройка в тумане невозможна)
  // и чужую базу (снимает туман своей стороны), потом возвращается к добыче
  AI.prototype._hardScout = function (workers) {
    var g = this.g, p = this.p;
    if (this.scoutDone || this.t < 60) return;
    var sc = this.scoutId && g.get(this.scoutId);
    if (!this.scoutId) {
      var w = workers.filter(function (u) { return !u.carry && u.ord.t === 'gather'; })[0], eb = this._target(), ex = this._expandSpot(this._mine().filter(function (e) { return e.kind === 'b'; }));
      if (!w || !eb) return;
      this.scoutId = w.id; this.scoutT = this.t; this.scoutBack = w.ord.id; this.scoutWay = (ex ? [ex] : []).concat([{ x: eb.x, y: eb.y }]);
      g.cmd(p, { t: 'move', ids: [w.id], x: this.scoutWay[0].x, y: this.scoutWay[0].y }); return;
    }
    if (!sc) { this.scoutDone = true; return; }
    var wp = this.scoutWay[0];
    if (wp && Math.hypot(sc.x - wp.x, sc.y - wp.y) < 6 * T) { this.scoutWay.shift(); wp = this.scoutWay[0]; if (wp) g.cmd(p, { t: 'move', ids: [sc.id], x: wp.x, y: wp.y }); }
    else if (wp && sc.ord.t === 'idle') g.cmd(p, { t: 'move', ids: [sc.id], x: wp.x, y: wp.y });
    if (!wp || this.t - this.scoutT > 110 || sc.hp < sc.maxhp * 0.6) {
      this.scoutDone = true; var back = g.get(this.scoutBack) || g._nearestNode(sc, g.race(p).nodes.a, 60 * T);
      if (back) g.cmd(p, { t: 'gather', ids: [sc.id], target: back.id }); else g.cmd(p, { t: 'stop', ids: [sc.id] });
    }
  };
  // фокус огня: каждый бой — по самому слабому врагу в досягаемости, без перебора урона (кто уже «добит» — следующий)
  AI.prototype._focus = function (army) {
    var g = this.g, p = this.p, foes = this._foes('u').filter(function (e) { return !calmD(g.def(e)); }), plan = {};
    if (!foes.length) return;
    army.forEach(function (u) {
      if (!u.tgt || u.roll || (u.ord.t !== 'amove' && u.ord.t !== 'idle')) return; var D = g.def(u), reach = Math.max(D.range * T, 4) + (D.ranged ? 1.2 * T : 0.9 * T) + u.r;
      var best = null, bs = 1e9;
      for (var i = 0; i < foes.length; i++) { var e = foes[i]; if (e.dead) continue; var d = Math.hypot(e.x - u.x, e.y - u.y) - e.r; if (d > reach) continue;
        var ed = g.def(e), left = e.hp - (plan[e.id] || 0); if (left <= 0) continue;
        var sc = left + (ed.worker ? 120 : 0) + d * 0.3; if (sc < bs) { bs = sc; best = e; } }
      if (best) { u.tgt = best.id; plan[best.id] = (plan[best.id] || 0) + Math.max(1, D.dmg - (g.def(best).armor || 0) - (best.stone ? PETRIFY.armor : 0)) * 2; }
    });
  };
  AI.prototype._stage = function (main) {   // место сбора: от главного здания к центру карты
    var g = this.g, cx = g.MW * T / 2, cy = g.MH * T / 2, L = Math.hypot(cx - main.x, cy - main.y) || 1;
    return { x: main.x + (cx - main.x) / L * 6 * T, y: main.y + (cy - main.y) / L * 6 * T };
  };
  AI.prototype._hardArmy = function (army, threat, main) {
    var g = this.g, p = this.p, C = this.cfg;
    var group = army.filter(function (u) { return u.wave; }), home = army.filter(function (u) { return !u.wave; });
    var ids = function (l) { return l.map(function (u) { return u.id; }); };
    var cen = function (l) { var x = 0, y = 0; l.forEach(function (u) { x += u.x; y += u.y; }); return { x: x / l.length, y: y / l.length }; };
    // оборона: дома — все, кто дома; сильная угроза — отзываем и ударную группу
    if (threat) {
      var tp = this._pow(this._foes('u').filter(function (e) { return Math.hypot(e.x - threat.x, e.y - threat.y) < 10 * T; }));
      var def = home.filter(function (u) { return u.ord.t !== 'amove' || !u.tgt; });
      if (group.length && tp > this._pow(home) * 1.1 && tp > 4) { group.forEach(function (u) { u.wave = false; }); def = def.concat(group); this.nextWave = this.t + 25; }
      if (def.length) g.cmd(p, { t: 'amove', ids: ids(def), x: threat.x, y: threat.y });
      return true;
    }
    if (group.length) {
      var c = cen(group), gp = this._pow(group);
      var local = this._pow(this._foes('u').filter(function (e) { return Math.hypot(e.x - c.x, e.y - c.y) < 10 * T; }));
      var towers = this._foes('b').filter(function (b) { return g.def(b).atk && !b.asleep && Math.hypot(b.x - c.x, b.y - c.y) < 9 * T; }).length;
      // отход: впереди заметно сильнее — к месту сбора, к подкреплению
      if ((local + towers * 3 > gp * 1.5 + 2 || gp < 3.5) && main) { var st = this._stage(main); group.forEach(function (u) { u.wave = false; }); g.cmd(p, { t: 'move', ids: ids(group), x: st.x, y: st.y }); this.nextWave = this.t + 20; this.retreats = (this.retreats || 0) + 1; return true; }
      // подкрепление: собравшиеся дома идут к группе
      var fresh = home.filter(function (u) { return u.ord.t === 'idle' || u.ord.t === 'move'; });
      if (this._pow(fresh) >= 6 && local < gp) { fresh.forEach(function (u) { u.wave = true; }); g.cmd(p, { t: 'amove', ids: ids(fresh), x: c.x, y: c.y }); }
      // группа без дела — к ближайшему чужому зданию (от группы, а не от своей базы)
      var tg = this._targetFrom(c); if (tg) { var idle = group.filter(function (u) { return u.ord.t === 'idle' && !u.tgt; }); if (idle.length) g.cmd(p, { t: 'amove', ids: ids(idle), x: tg.x, y: tg.y }); }
      return true;
    }
    // сбор и запуск: копим силу у места сбора; идём, когда сила не меньше той, что видели у врага (или войско почти предельное)
    if (main) { var st2 = this._stage(main); var far = home.filter(function (u) { return u.ord.t === 'idle' && Math.hypot(u.x - st2.x, u.y - st2.y) > 5 * T; }); if (far.length) g.cmd(p, { t: 'move', ids: ids(far), x: st2.x, y: st2.y }); }
    var hp = this._pow(home), foe = this._pow(this._foes('u'));
    if (this.scoutDone && this.t >= this.nextWave && hp >= this.waveSize && (hp >= foe * (this.t < 360 ? 1.8 : 1.3) || hp >= 50 || (this.t - Math.max(this.lastWaveT, 120) > 260 && hp >= foe))) {
      var target = this._target(); if (target) {
        home.forEach(function (u) { u.wave = true; }); g.cmd(p, { t: 'amove', ids: ids(home), x: target.x, y: target.y });
        this.wave++; this.lastWaveT = this.t; this.nextWave = this.t + C.gap; this.waveSize = Math.min(C.sizeMax, this.waveSize + C.sizeStep);
        g.emit('wave', { p: p, n: this.wave, size: home.length });
      }
    }
    return true;
  };
  AI.prototype._targetFrom = function (pt) {
    var g = this.g, p = this.p, best = null, bd = 1e9;
    g.ents.forEach(function (e) { if (e.dead || e.kind !== 'b' || !g.hostile(p, e.owner)) return; var d = Math.hypot(e.x - pt.x, e.y - pt.y); if (d < bd) { bd = d; best = e; } });
    return best;
  };
  AI.prototype._margin = function (tx, ty, s) {
    var g = this.g;
    for (var x = tx - 1; x <= tx + s; x++) for (var y = ty - 1; y <= ty + s; y++) { if (x >= tx && x < tx + s && y >= ty && y < ty + s) continue; if (!g.inMap(x, y) || g.occ[y * g.MW + x]) return false; }
    // не загораживать месторождения
    for (var i = 0; i < g.ents.length; i++) { var n = g.ents[i]; if (n.kind === 'n' && n.tx >= tx - 2 && n.tx <= tx + s + 1 && n.ty >= ty - 2 && n.ty <= ty + s + 1) return false; }
    return true;
  };
})(typeof window !== 'undefined' ? window : globalThis);
