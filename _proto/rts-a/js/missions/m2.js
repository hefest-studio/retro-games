/* ПРИИСК · миссия 2 «Разведка в метели» (кампания Артели Медного Ключа). Малый отряд без базы: Луня, Варвара и стрелки.
   Метель волнами урезает обзор. Цель — найти лагерь Сизых и вернуться к саням. По пути — обоз Сизых: отбить или тихо обойти
   (флаг campaign.flags.convoy: raided | escaped | sneaked — для миссии 4). Луня обязательна: её гибель — поражение.
   Карта 64×40: река с ледяной переправой на юге и бродом на севере; за переправой гряда с ущельем (засада) и дорогой обоза.
   Точки: S — сани (старт и возврат), I — восточный берег у льда, P — пост, G — ущелье, A — ниша засады, p/q — маршрут патруля,
   C → r → c → K — путь обоза, K — лагерь Сизых, b/w — их барак и котельная. */
(function (root) {
  'use strict';
  var C = root.PRIISK.campaign;
  C.register({
    id: 'm2', n: 2,
    title: { ru: 'Разведка в метели', en: 'Whiteout Recon' },
    kind: { ru: 'малый отряд без базы', en: 'small squad, no base' },
    brief: { ru: 'Метель скрывает нас — и Сизых тоже. Найди их лагерь и приведи Луню назад к саням.',
             en: 'The snowstorm hides us — and them. Find the Grey Pass camp and bring Lunya back to the sledges.' },
    ground: 'snow',
    map: [
      '################################################################',
      '#...........................~~~~...............................#',
      '#...........................~~~~..................##...........#',
      '#............................~~~~.............#...##...b.......#',
      '#.............................................#...##...........#',
      '#....................................p........#...##...........#',
      '#.....................................................K........#',
      '#............................~~~~........................w.....#',
      '#.......####.................~~~~..............................#',
      '#.......####.................~~~~.............q...........###..#',
      '#.......####......##.........~~~~.........................###..#',
      '#.................##.........~~~~....................c.........#',
      '#.................##.........~~~#######....###.................#',
      '#.................##.........~~~#######....###.................#',
      '#...########################~~~~######.....###.................#',
      '#...########################~~~~######.....######..............#',
      '#.....................##....~~~~######.....###..#..............#',
      '#.....................##....~~~~######......A...#........##....#',
      '#..........................~~~~.######..G.......#........##....#',
      '#..........................~~~~.######.....###..#..............#',
      '#..............###.........~~~~.#######....########....#########',
      '#..............###.........~~~~.#######....########....#########',
      '#..............###.........~~~~....###.....###.......r.........#',
      '#..............###.........~~~~....###.....###.................#',
      '#..........................~~~~....###.................###.....#',
      '#.....##...................~~~~....###.P...............###.....#',
      '#.....##...................~~~~....###.................###.....#',
      '#..........................====................................#',
      '#..........................====................................#',
      '#..........................====..I.............................#',
      '#...........####............====...............##..............#',
      '#...........####............~~~~...............##..............#',
      '#...........................~~~~....####.......##..............#',
      '#....S......................~~~~....####.......##..............#',
      '#...S.S.............###......~~~~..............................#',
      '#...................###......~~~~..............................#',
      '#............................~~~~..............................#',
      '#............................~~~~...........................C..#',
      '#............................~~~~..............................#',
      '################################################################'
    ],
    zones: {
      home: { at: 'S', r: 4 }, camp: { at: 'K', r: 7 }, campIn: { at: 'K', r: 3.5 }, campArea: { at: 'K', r: 11 }, gorge: { at: 'G', r: 3.5 },
      east: { x: 31, y: 22, w: 32, h: 17 }, ice: { x: 25, y: 26, w: 9, h: 6 }
    },
    weather: { kind: 'snowstorm', min: 0.4, max: 0.85, period: 50 },
    player: {
      copper: 0, build: [], units: [],
      start: [{ type: 'lunya', at: 'S' }, { type: 'varvara', at: 'S' }, { type: 'rifleman', at: 'S', n: 5, vets: true }]
    },
    enemy: {
      copper: 0,
      start: [
        { type: 'bunk', at: 'b' }, { type: 'boiler', at: 'w' },
        { type: 'rifleman', at: 'P', n: 2, tag: 'post', heading: Math.PI / 2 },
        { type: 'rifleman', at: 'A', n: 3, tag: 'ambush', heading: Math.PI },
        { type: 'rifleman', at: 'p', n: 2, tag: 'patrol' },
        { type: 'rifleman', at: 'K', n: 3, tag: 'camp' }, { type: 'crawler', at: 'K', n: 1, tag: 'camp' }
      ]
    },
    groups: { post: { mode: 'hold' }, ambush: { mode: 'hold' }, patrol: { mode: 'patrol', route: ['p', 'q'] }, camp: { mode: 'hold' } },
    heroes: ['lunya', 'varvara'], required: ['lunya'],
    flags: { convoy: 'sneaked' },
    flagText: { convoy: {
      sneaked: { ru: 'Обоз Сизых обойдён тихо — о разведке они не знают', en: 'The Grey Pass convoy was bypassed — they never knew' },
      escaped: { ru: 'Обоз ушёл после стычки', en: 'The convoy escaped after a skirmish' },
      raided: { ru: 'Обоз отбит — в миссии 4 у Сизых меньше техники', en: 'Convoy raided — fewer enemy vehicles in mission 4' } } },
    objectives: [
      { id: 'find', icon: 'eye', text: { ru: 'Найди лагерь Сизых', en: 'Find the Grey Pass camp' }, done: { t: 'seen', zone: 'camp' }, hint: { zone: 'campArea' } },
      { id: 'back', after: 'find', icon: 'home', text: { ru: 'Верни Луню к саням', en: 'Bring Lunya back to the sledges' }, done: { t: 'zone', zone: 'home', who: 'lunya' }, hint: { zone: 'home' } },
      { id: 'convoy', kind: 'opt', hidden: true, icon: 'convoy', text: { ru: 'Обоз: отбить или обойти', en: 'Convoy: raid or bypass' },
        done: { t: 'any', of: [{ t: 'killed', tag: 'convoy', type: 'hauler', gte: 2 }, { t: 'flag', key: 'convoyGone' }] } }
    ],
    stars: [
      { icon: 'shield', text: { ru: 'Вернулись все', en: 'Everyone came back' }, when: { t: 'lostU', lte: 0 } },
      { icon: 'clock', text: { ru: 'За 12 минут', en: 'Within 12 minutes' }, when: { t: 'time', lte: 720 } }
    ],
    lose: [{ when: { t: 'heroDead', hero: 'lunya' }, reason: { ru: 'Луня погибла — разведка сорвана', en: 'Lunya fell — the recon has failed' } }],
    briefMarks: [{ at: 'S', icon: 'home' }, { at: 'K', icon: 'eye', r: 11 }, { at: 'C', icon: 'convoy' }],
    triggers: [
      { id: 'intro', when: { t: 'time', gte: 0.5 }, do: [
        { a: 'say', who: 'lunya', text: { ru: 'Метель. Я поведу — держитесь за мной и не шумите.', en: 'Whiteout. I lead — stay close and keep quiet.' } },
        { a: 'wait', s: 6 },
        { a: 'say', who: 'varvara', text: { ru: 'Найдём лагерь, сочтём, сколько их, — и назад. В драку зря не лезть.', en: 'Find the camp, count them, come back. No needless fights.' } },
        { a: 'wait', s: 7 },
        { a: 'msg', text: { ru: 'E — Метка Луни: на время открывает туман в точке (ЛКМ по карте или мини-карте)', en: 'E — Lunya’s Flare: reveals fog at a point for a while (LMB on map or minimap)' }, col: 'warn' }] },
      { id: 'convoy', when: { t: 'zone', zone: 'east' }, do: [
        { a: 'spawn', owner: 1, type: 'hauler', n: 2, at: 'C', tag: 'convoy', speed: 0.45, hp: 170 },
        { a: 'spawn', owner: 1, type: 'rifleman', n: 2, at: 'C', tag: 'convoy', speed: 0.5 },
        { a: 'group', tag: 'convoy', mode: 'convoy', route: ['r', 'c', 'K'], notice: 4 },
        { a: 'objective', id: 'convoy', state: 'active' },
        { a: 'say', who: 'lunya', text: { ru: 'Скрип полозьев на востоке — обоз Сизых идёт к лагерю. Отбить? Или переждать?', en: 'Runners creak to the east — a Grey Pass convoy. Raid it? Or let it pass?' } }] },
      { id: 'crack', when: { t: 'zone', zone: 'east', all: true }, do: [
        { a: 'wait', s: 2 },
        { a: 'tiles', zone: 'ice', from: '=', to: '_' },
        { a: 'flag', key: 'iceCracked' },
        { a: 'say', who: 'lunya', text: { ru: 'Лёд за спиной лопнул! Назад — только через брод на севере.', en: 'The ice cracked behind us! The way back is the northern ford.' } }] },
      { id: 'ambush', when: { t: 'zone', zone: 'gorge' }, do: [
        { a: 'group', tag: 'ambush', mode: 'attack' },
        { a: 'say', who: 'varvara', text: { ru: 'Засада! Сомкнуться, держаться рядом со мной!', en: 'Ambush! Close ranks, stay by me!' } }] },
      { id: 'seen', when: { t: 'obj', id: 'find' }, do: [
        { a: 'say', who: 'lunya', text: { ru: 'Вот он, лагерь: барак, котлы, самоход. Запомнила. Уходим тихо.', en: 'There’s the camp: bunkhouse, boilers, a crawler. Got it. We leave quietly.' } }] },
      { id: 'cAlert', when: { t: 'alerted', group: 'convoy' }, do: [
        { a: 'flag', key: 'convoy', value: 'escaped' },
        { a: 'say', who: 'varvara', text: { ru: 'Обоз нас заметил!', en: 'The convoy spotted us!' } }] },
      { id: 'cRaid', when: { t: 'killed', tag: 'convoy', type: 'hauler', gte: 2 }, do: [
        { a: 'flag', key: 'convoy', value: 'raided' },
        { a: 'say', who: 'varvara', text: { ru: 'Обоз наш. Сизым этой зимой будет туже… а нам — теплее.', en: 'The convoy is ours. A harder winter for them… a warmer one for us.' } }] },
      { id: 'cIn', when: { t: 'zone', zone: 'campIn', owner: 1, who: 'convoy', type: 'hauler' }, do: [
        { a: 'despawn', tag: 'convoy', type: 'hauler' },
        { a: 'group', tag: 'convoy', mode: 'hold' },
        { a: 'flag', key: 'convoyGone' },
        { a: 'say', who: 'lunya', text: { ru: 'Обоз ушёл в лагерь.', en: 'The convoy made it into the camp.' } }] }
    ]
  });
})(typeof window !== 'undefined' ? window : globalThis);
