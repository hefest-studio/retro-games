/* ЛЕНТОВОД · js/i18n.js — строки RU/EN. Ключи движка (play/language/…) + строки игры. Текст — только через g.t(). */
(function (root) {
  'use strict';
  var LV = root.LENTOVOD = root.LENTOVOD || {};
  LV.STR = {
    ru: {
      play: 'Играть', language: 'Язык', theme: 'Тема', sound: 'Звук', on: 'вкл', off: 'выкл',
      score: 'Счёт', level: 'Волна', best: 'Рекорд', win: 'КУРГАН РАЗРУШЕН!', gameover: 'МАСТЕРСКАЯ ПАЛА',
      pause: 'ПАУЗА', resume: 'Продолжить', menu: 'В меню', tapstart: 'пробел / тап', restart: 'Заново',
      title: 'ЛЕНТОВОД', subtitle: 'Паровая мастерская на рудном поле · прототип',
      hint1: 'Буры → ленты → станки → Мастерская. Пушкам — слитки. Цех собирает клёпаных.',
      hint2: 'Снесите Ржавый курган на востоке, пока Ржавь не сгрызла Мастерскую.',
      winSub: 'Рудное поле — ваше', loseSub: 'Ржавь добралась до склада',
      // постройки
      drill: 'Бур', belt: 'Лента', splitter: 'Развилка', sorter: 'Сортировщик', bridge: 'Мост', smelter: 'Плавильня',
      glassworks: 'Стекольня', gearmill: 'Шестерённая', assembly: 'Сборочный цех', turret: 'Паровая пушка', wall: 'Частокол',
      hall: 'Мастерская', mound: 'Ржавый курган', demolish: 'Снос', rally: 'Сбор', charge: 'Вперёд!', rotate: 'Поворот',
      d_drill: 'Ставится на жилу, выдаёт руду вперёд (по стрелке)',
      d_belt: 'Везёт предметы. Тяните линией; повороты — сами',
      d_splitter: 'Вход сзади, раздаёт по очереди вперёд/влево/вправо',
      d_sorter: 'Выбранный предмет — вперёд, остальное — вбок. Клик без инструмента меняет фильтр',
      d_bridge: 'Пара мостов одного направления перекидывает предметы через 1–3 клетки',
      d_smelter: 'Медная руда + уголь → слиток', d_glassworks: '2 песка + уголь → стекло', d_gearmill: '2 слитка → шестерня',
      d_assembly: '3 слитка + 2 шестерни + стекло → клёпаный боец',
      d_turret: 'Стреляет, только пока лента подаёт слитки', d_wall: 'Держит Ржавь. Тяните линией',
      d_demolish: 'Снести постройку (возврат стоимости). Тоже — ПКМ', d_rally: 'Точка сбора бойцов',
      d_charge: 'Все бойцы — на Ржавый курган', d_rotate: 'Повернуть постройку (R)',
      // предметы и существа
      cu: 'медная руда', coal: 'уголь', sand: 'песок', ingot: 'слиток', glass: 'стекло', gear: 'шестерня',
      mech: 'Клёпаный', crawler: 'Ржавник', brute: 'Ржавый громила',
      // HUD и сообщения
      waveIn: 'Волна {n} через', waveNow: 'Волна {n}!', time: 'Время', units: 'Бойцы', kills: 'Сбито', hp: 'Прочность',
      msgStart: 'Поставьте бур на медь (1) и протяните ленту (2) к плавильне (6)',
      msgCost: 'Не хватает в запасе', msgBusy: 'Здесь занято', msgTerrain: 'Скала или роща', msgOre: 'Бур — только на жилу',
      msgEnemy: 'Слишком близко к кургану', msgBounds: 'За краем поля', msgLost: 'Ржавь сломала постройку',
      msgMech: 'Клёпаный собран', msgCharge: 'Бойцы идут на курган!', msgNoUnits: 'Бойцов нет — нужен сборочный цех',
      msgRally: 'Точка сбора', msgFilter: 'Фильтр', msgHall: 'Мастерская под ударом!', shots: 'выстрелов', inputs: 'вход', outputs: 'выход',
      empty: 'пусто', partner: 'пара', noPartner: 'нет пары (поставьте второй мост впереди)',
      foot: '<b>ЛЕНТОВОД</b> · ЛКМ — поставить (протяжка — линия) · ПКМ — снести / отмена · R — поворот · 1–9, Q, E — постройки · X — снос · F — сбор · G — вперёд · колесо — зум · средняя кнопка / WASD — камера · P пауза · L язык, T тема, M звук'
    },
    en: {
      play: 'Play', language: 'Language', theme: 'Theme', sound: 'Sound', on: 'on', off: 'off',
      score: 'Score', level: 'Wave', best: 'Best', win: 'MOUND DESTROYED!', gameover: 'WORKSHOP FELL',
      pause: 'PAUSE', resume: 'Resume', menu: 'Menu', tapstart: 'space / tap', restart: 'Restart',
      title: 'LENTOVOD', subtitle: 'A steam workshop on the ore field · prototype',
      hint1: 'Drills → belts → machines → Workshop. Feed ingots to guns. The shop builds riveters.',
      hint2: 'Wreck the Rust Mound in the east before the Rust chews up your Workshop.',
      winSub: 'The ore field is yours', loseSub: 'The Rust reached the stores',
      drill: 'Drill', belt: 'Belt', splitter: 'Splitter', sorter: 'Sorter', bridge: 'Bridge', smelter: 'Smelter',
      glassworks: 'Glassworks', gearmill: 'Gear mill', assembly: 'Assembly shop', turret: 'Steam gun', wall: 'Palisade',
      hall: 'Workshop', mound: 'Rust Mound', demolish: 'Demolish', rally: 'Rally', charge: 'Charge!', rotate: 'Rotate',
      d_drill: 'Goes on an ore vein, outputs forward (arrow)',
      d_belt: 'Carries items. Drag a line; corners are automatic',
      d_splitter: 'Input at the back, deals forward/left/right in turn',
      d_sorter: 'Chosen item goes forward, the rest — sideways. Click with no tool to change the filter',
      d_bridge: 'Two bridges facing the same way throw items over 1–3 tiles',
      d_smelter: 'Copper ore + coal → ingot', d_glassworks: '2 sand + coal → glass', d_gearmill: '2 ingots → gear',
      d_assembly: '3 ingots + 2 gears + glass → riveter',
      d_turret: 'Fires only while a belt feeds it ingots', d_wall: 'Holds the Rust back. Drag a line',
      d_demolish: 'Remove a building (full refund). Also RMB', d_rally: 'Riveters gather here',
      d_charge: 'All riveters attack the Rust Mound', d_rotate: 'Rotate the building (R)',
      cu: 'copper ore', coal: 'coal', sand: 'sand', ingot: 'ingot', glass: 'glass', gear: 'gear',
      mech: 'Riveter', crawler: 'Rustling', brute: 'Rust hulk',
      waveIn: 'Wave {n} in', waveNow: 'Wave {n}!', time: 'Time', units: 'Riveters', kills: 'Downed', hp: 'Integrity',
      msgStart: 'Put a drill on copper (1) and drag a belt (2) to a smelter (6)',
      msgCost: 'Not enough in stock', msgBusy: 'Tile occupied', msgTerrain: 'Rock or grove', msgOre: 'Drills go on ore only',
      msgEnemy: 'Too close to the mound', msgBounds: 'Off the field', msgLost: 'The Rust broke a building',
      msgMech: 'Riveter assembled', msgCharge: 'Riveters march on the mound!', msgNoUnits: 'No riveters — build an assembly shop',
      msgRally: 'Rally point', msgFilter: 'Filter', msgHall: 'Workshop under attack!', shots: 'shots', inputs: 'in', outputs: 'out',
      empty: 'empty', partner: 'paired', noPartner: 'no pair (place a second bridge ahead)',
      foot: '<b>LENTOVOD</b> · LMB — place (drag — line) · RMB — demolish / cancel · R — rotate · 1–9, Q, E — buildings · X — demolish · F — rally · G — charge · wheel — zoom · middle drag / WASD — camera · P pause · L lang, T theme, M sound'
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
