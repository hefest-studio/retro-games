/* ПРИИСК · миссия 1 «Первая заявка» (кампания Артели Медного Ключа). Обучение стройке и добыче шаг за шагом,
   ночью — «проверка» Сизого Перевала, первая оборона. Карта 48×32: база в юго-западном углу за грядой с двумя проходами.
   Точки: H — Контора (левый верхний угол), S — отряд, R — отвал меди у базы, E — откуда придут Сизые, V — их сбор. */
(function (root) {
  'use strict';
  var C = root.PRIISK.campaign;
  C.register({
    id: 'm1', n: 1,
    title: { ru: 'Первая заявка', en: 'First Claim' },
    kind: { ru: 'обучение · стройка и добыча', en: 'tutorial · build and mine' },
    brief: { ru: 'Артель застолбила участок. Поставь хозяйство и обучи стрелков — к ночи Сизые придут проверить, крепко ли мы сидим.',
             en: 'The artel has staked a claim. Build up and train riflemen — by nightfall the Grey Pass will come to test us.' },
    ground: 'tundra',
    legend: { R: 'o' },
    map: [
      '################################################',
      '#..............................................#',
      '#...................................#####......#',
      '#..............####.................#####....E.#',
      '#..............####..................###....E..#',
      '#.....###.......##...........................E.#',
      '#.....###...................~..................#',
      '#.......oo...............~~~~~~~...............#',
      '#.......o...............~~~~~~~~....oo.........#',
      '#........................~~~~~~~....ooo........#',
      '#...........................~..................#',
      '#..............................................#',
      '###########.....................##.............#',
      '#.........###...................##.............#',
      '#.......................................###....#',
      '#..............##.............V.........###....#',
      '#...............###............................#',
      '#.................###..........................#',
      '#...................##.........................#',
      '#....................##........................#',
      '#.....................##..........##...........#',
      '#....H.................##.........##...........#',
      '#.................................##...........#',
      '#..............................................#',
      '#........S....ooo.........##..............###..#',
      '#............ooRoo........##..............###..#',
      '#..............ooo.........##..................#',
      '#...............o..........##..................#',
      '#...........................##.................#',
      '#...........................##.................#',
      '#...........................##.................#',
      '################################################'
    ],
    zones: { ore: { at: 'R', r: 3 }, base: { at: 'H', r: 7 }, entry: { at: 'E', r: 3 } },
    player: {
      copper: 1300, build: ['boiler', 'smelter', 'bunk'], units: ['rifleman'],
      start: [{ type: 'hq', at: 'H' }, { type: 'varvara', at: 'S' }, { type: 'rifleman', at: 'S', n: 2, vets: true }]
    },
    enemy: { copper: 0, start: [] },
    heroes: ['varvara'],
    objectives: [
      { id: 'boiler', icon: 'boiler', text: { ru: 'Поставь Котельную', en: 'Build a Boiler House' }, done: { t: 'built', type: 'boiler' }, hint: { btn: 'boiler' } },
      { id: 'smelter', after: 'boiler', icon: 'smelter', text: { ru: 'Поставь Плавильню', en: 'Build a Smelter' }, done: { t: 'built', type: 'smelter' }, hint: { btn: 'smelter' } },
      { id: 'haul', after: 'smelter', icon: 'copper', text: { ru: 'Рудовоз привёз медь', en: 'Hauler delivers copper' }, done: { t: 'mined', gte: 200 }, hint: { zone: 'ore' } },
      { id: 'bunk', after: 'haul', icon: 'bunk', text: { ru: 'Поставь Барак', en: 'Build a Bunkhouse' }, done: { t: 'built', type: 'bunk' }, hint: { btn: 'bunk' } },
      { id: 'train', after: 'bunk', icon: 'rifleman', text: { ru: 'Обучи 4 стрелков', en: 'Train 4 riflemen' }, done: { t: 'trained', type: 'rifleman', n: 4 }, count: { t: 'trained', type: 'rifleman', n: 4 }, hint: { btn: 'rifleman' } },
      { id: 'defend', hidden: true, icon: 'shield', text: { ru: 'Отбей ночную проверку', en: 'Repel the night raid' }, done: { t: 'gone', tag: 'check' }, hint: { zone: 'base' } }
    ],
    stars: [
      { icon: 'nobld', text: { ru: 'Ни одного здания не потеряно', en: 'No buildings lost' }, when: { t: 'lostB', lte: 0 } },
      { icon: 'clock', text: { ru: 'За 15 минут', en: 'Within 15 minutes' }, when: { t: 'time', lte: 900 } }
    ],
    lose: [],
    briefMarks: [{ at: 'H', icon: 'home' }, { at: 'R', icon: 'copper' }, { at: 'E', icon: 'foe' }],
    triggers: [
      { id: 'intro', when: { t: 'time', gte: 0.5 }, do: [
        { a: 'say', who: 'varvara', text: { ru: 'Заявка наша. Без пара тут ничего не завертится — ставим котельную.', en: 'The claim is ours. Nothing turns without steam — boiler house first.' } }] },
      { id: 'sBoiler', when: { t: 'obj', id: 'boiler' }, do: [
        { a: 'say', who: 'varvara', text: { ru: 'Пар есть. Теперь плавильня — с ней придёт рудовоз.', en: 'We have steam. Now the smelter — it comes with a hauler.' } }] },
      { id: 'sSmelter', when: { t: 'obj', id: 'smelter' }, do: [
        { a: 'say', who: 'varvara', text: { ru: 'Рудовоз сам найдёт отвал и повезёт медь на площадку.', en: 'The hauler finds the ore heap and drives copper to the dock.' } }] },
      { id: 'sHaul', when: { t: 'obj', id: 'haul' }, do: [
        { a: 'say', who: 'varvara', text: { ru: 'Медь пошла. Людям нужна крыша — ставь барак.', en: 'Copper is flowing. The crew needs a roof — build a bunkhouse.' } }] },
      { id: 'sBunk', when: { t: 'obj', id: 'bunk' }, do: [
        { a: 'say', who: 'varvara', text: { ru: 'Обучи четверых стрелков. Сизые рядом — без ружей не усидим.', en: 'Train four riflemen. The Grey Pass is near — we need guns.' } }] },
      // ночь: по таймеру (9 мин) или по готовности (обучены стрелки)
      { id: 'night', when: { t: 'any', of: [{ t: 'time', gte: 540 }, { t: 'obj', id: 'train' }] }, do: [
        { a: 'wait', s: 6 },
        { a: 'night', on: true, mul: 0.62 },
        { a: 'say', who: 'varvara', text: { ru: 'Темнеет. Сизые придут глянуть, крепко ли сидим. Встречаем у конторы.', en: 'Night falls. The Grey Pass will test us. We meet them at the lodge.' } },
        { a: 'objective', id: 'defend', state: 'active' },
        { a: 'wait', s: 6 },
        { a: 'msg', text: { ru: 'Q — Клич Варвары: рядом стоящие бьют злее и бегут быстрее', en: 'Q — Varvara’s Rally: nearby crew hit harder and move faster' }, col: 'warn' },
        { a: 'wait', s: 16 },
        { a: 'spawn', owner: 1, type: 'rifleman', n: 5, at: 'E', tag: 'check' },
        { a: 'group', tag: 'check', mode: 'attack', target: 'H' },
        { a: 'say', who: 'foe', text: { ru: '— Новенькие на нашем плато? Проверим, крепко ли сидят.', en: '— Newcomers on our plateau? Let’s see how firm they stand.' } }] },
      { id: 'sWon', when: { t: 'obj', id: 'defend' }, do: [
        { a: 'say', who: 'varvara', text: { ru: 'Отбились. Не злодеи они — такие же старатели. Но плато мы не отдадим.', en: 'We held. They are no villains — miners like us. But we keep the plateau.' } }] }
    ]
  });
})(typeof window !== 'undefined' ? window : globalThis);
