/* ОРУЖЕЙНИК · i18n (RU/EN). ORUZH.STR — таблицы для Arcade.createGame({strings}).
   Ключи play/language/theme/... нужны стандартным экранам движка; остальные — игре.
   Имена: b_<босс> — Мастер цеха, s_<босс> — цех, w_<оружие> — оружие, f_<враг> — враги. */
(function (global) {
  'use strict';
  var OZ = global.ORUZH = global.ORUZH || {};
  OZ.STR = {
    ru: {
      play: 'Играть', language: 'Язык', theme: 'Тема', sound: 'Звук', on: 'вкл', off: 'выкл',
      score: 'Счёт', level: 'Этап', best: 'Рекорд', pause: 'ПАУЗА', resume: 'Продолжить', menu: 'В меню', tapstart: 'пробел / тап',
      win: 'ДОМНА ПОГАШЕНА!', gameover: 'ПОРА НАЗАД В МАСТЕРСКУЮ',
      title: 'ОРУЖЕЙНИК', subtitle: 'Восемь цехов. Восемь Мастеров. Один наруч.',
      sub2: 'Юный оружейник мастерской «Гефест» отвоёвывает цеха у взбунтовавшихся автоматонов',
      back: 'Каталог', pass: 'Пароль', passEnter: 'Ввести пароль', passTitle: 'ВВОД ПАРОЛЯ', passHint: '← → — позиция · ↑ ↓ — цифра · Enter — принять · Esc — назад',
      passBad: 'Неверный пароль', passOk: 'Пароль принят', reset: 'Сбросить прогресс', resetQ: 'Сбросить? ещё раз — да', resetDone: 'Прогресс сброшен',
      select: 'ВЫБОР ЦЕХА', selHint: '← → ↑ ↓ — выбор · Пробел/Enter — в цех · Esc — пауза', locked: 'нужны 8 трофеев', cleared: 'отвоёван',
      fortName: 'Чёрная Домна', fortSub: 'крепость бунта', fortStage: 'Домна', stage: 'Цех', weak: 'слабость', flasks: 'Фляги', lives: 'Жизни',
      ready: 'ГОТОВЬСЯ', got: 'ТРОФЕЙ', gotSub: 'Теперь у тебя', gotAgain: 'Цех снова отвоёван', gotTap: 'пробел — к выбору цеха',
      clear: 'ЯРУС ПРОЙДЕН', rush: 'Повторные бои', finale: 'Последний бой', checkpoint: 'Отметка',
      energy: 'заряд', noEnergy: 'нет заряда', tank: 'Фляга: здоровье полно', weapon: 'Оружие',
      hp: 'Здоровье', boss: 'Мастер', weakHit: 'СЛАБОЕ МЕСТО!', life: '+1 жизнь', flask: '+1 фляга',
      hint: '←→ бег · Пробел/Z прыжок · X удерж. — заряд · ↓+прыжок/C подкат · Q/E оружие · F фляга · P пауза',
      intro: 'Цеха взбунтовались: Мастера-автоматоны перестали слушаться людей. Отвоюй восемь цехов — и доберись до Чёрной Домны.',
      d_spike: 'Шипы', d_pit: 'Пропасть', d_foe: 'Удар', d_boss: 'Мастер',
      s_hammer: 'Кузнечный цех', s_gear: 'Зубчатый цех', s_magnet: 'Магнитный цех', s_fan: 'Горновой цех',
      s_frost: 'Закалочный цех', s_spring: 'Пружинный цех', s_volt: 'Динамо-цех', s_bell: 'Колокольная литейня',
      s_f1: 'Домна · Литьевой ярус', s_f2: 'Домна · Крановый ярус', s_f3: 'Домна · Сердце',
      b_hammer: 'Молотобой', b_gear: 'Шестерник', b_magnet: 'Магнитчик', b_fan: 'Горнило',
      b_frost: 'Закальщик', b_spring: 'Пружинник', b_volt: 'Разрядник', b_bell: 'Звонарь',
      b_ladle: 'Ковш-Разливщик', b_crane: 'Кран-Тягач', b_walker: 'Шагающая Домна', b_core: 'Сердце Домны',
      w_spark: 'Наруч-самострел', w_boomer: 'Молот-бумеранг', w_gear: 'Щит-шестерня', w_mine: 'Магнитная мина', w_fan: 'Огненный веер',
      w_frost: 'Ледяная окалина', w_harpoon: 'Пружинный гарпун', w_chain: 'Искровая цепь', w_smoke: 'Дымовой колокол',
      wd_boomer: 'Летит вперёд и возвращается в руку, пробивая насквозь', wd_gear: 'Кольцо зубьев вокруг тебя гасит снаряды',
      wd_mine: 'Катится по полу до первой стены', wd_fan: 'Три языка пламени веером', wd_frost: 'Навесной бросок; на полу остаётся жгучая корка льда',
      wd_harpoon: 'Пробивает ряд врагов и отталкивает', wd_chain: 'Очередь разрядов, пока держишь кнопку', wd_smoke: 'Дымовые кольца бегут по полу в обе стороны',
      f_crawler: 'Ползун', f_hopper: 'Прыгун', f_flyer: 'Шмель', f_turret: 'Самопал', f_golem: 'Наковальник', f_valve: 'Вентиль', f_drone: 'Жужелица',
      foot: '<b>ОРУЖЕЙНИК</b> · ← → / A D — бег · Пробел / Z / ↑ — прыжок (держи — выше) · X / J — выстрел, удерживай — заряд наруча · ↓ + прыжок или C / Shift — подкат · Q / E или 1–9 — оружие · F — фляга · P / Esc — пауза · L язык, T тема, M звук.'
    },
    en: {
      play: 'Play', language: 'Language', theme: 'Theme', sound: 'Sound', on: 'on', off: 'off',
      score: 'Score', level: 'Stage', best: 'Best', pause: 'PAUSE', resume: 'Resume', menu: 'Menu', tapstart: 'space / tap',
      win: 'THE FURNACE IS OUT!', gameover: 'BACK TO THE WORKSHOP',
      title: 'ORUZHEYNIK', subtitle: 'Eight workshops. Eight Masters. One wrist crossbow.',
      sub2: 'A young armorer of the Hefest workshop takes back the halls from rebel automatons',
      back: 'Catalog', pass: 'Password', passEnter: 'Enter password', passTitle: 'ENTER PASSWORD', passHint: '← → — slot · ↑ ↓ — digit · Enter — accept · Esc — back',
      passBad: 'Wrong password', passOk: 'Password accepted', reset: 'Reset progress', resetQ: 'Reset? once more — yes', resetDone: 'Progress reset',
      select: 'CHOOSE A WORKSHOP', selHint: '← → ↑ ↓ — choose · Space/Enter — go · Esc — pause', locked: 'needs 8 trophies', cleared: 'reclaimed',
      fortName: 'Black Furnace', fortSub: 'rebel stronghold', fortStage: 'Furnace', stage: 'Workshop', weak: 'weakness', flasks: 'Flasks', lives: 'Lives',
      ready: 'GET READY', got: 'TROPHY', gotSub: 'You now carry', gotAgain: 'Workshop reclaimed again', gotTap: 'space — back to workshops',
      clear: 'TIER CLEARED', rush: 'Rematches', finale: 'Final battle', checkpoint: 'Checkpoint',
      energy: 'charge', noEnergy: 'no charge', tank: 'Flask: health restored', weapon: 'Weapon',
      hp: 'Health', boss: 'Master', weakHit: 'WEAK SPOT!', life: '+1 life', flask: '+1 flask',
      hint: '←→ run · Space/Z jump · hold X — charge · ↓+jump/C slide · Q/E weapon · F flask · P pause',
      intro: 'The workshops rebelled: the automaton Masters no longer obey people. Reclaim eight workshops — then storm the Black Furnace.',
      d_spike: 'Spikes', d_pit: 'Pit', d_foe: 'Hit', d_boss: 'Master',
      s_hammer: 'Forge Hall', s_gear: 'Cog Works', s_magnet: 'Lodestone Works', s_fan: 'Furnace Hall',
      s_frost: 'Quench Works', s_spring: 'Coil Works', s_volt: 'Dynamo Hall', s_bell: 'Bell Foundry',
      s_f1: 'Furnace · Casting Tier', s_f2: 'Furnace · Gantry Tier', s_f3: 'Furnace · The Heart',
      b_hammer: 'Maulwright', b_gear: 'Cogwright', b_magnet: 'Lodewright', b_fan: 'Hearthmaw',
      b_frost: 'Quencher', b_spring: 'Coilwright', b_volt: 'Arcwright', b_bell: 'Bellwright',
      b_ladle: 'Ladle Pourer', b_crane: 'Gantry Hauler', b_walker: 'Walking Furnace', b_core: 'Furnace Heart',
      w_spark: 'Wrist Crossbow', w_boomer: 'Boomer Hammer', w_gear: 'Cog Shield', w_mine: 'Magnet Mine', w_fan: 'Fire Fan',
      w_frost: 'Frost Scale', w_harpoon: 'Coil Harpoon', w_chain: 'Spark Chain', w_smoke: 'Smoke Bell',
      wd_boomer: 'Flies out and returns to your hand, piercing through', wd_gear: 'A ring of teeth around you cancels shots',
      wd_mine: 'Rolls along the floor until a wall', wd_fan: 'Three tongues of flame in a fan', wd_frost: 'Lobbed throw; leaves a biting ice crust on the floor',
      wd_harpoon: 'Pierces a row of foes and pushes them back', wd_chain: 'A burst of sparks while you hold the button', wd_smoke: 'Smoke rings run along the floor both ways',
      f_crawler: 'Crawler', f_hopper: 'Hopper', f_flyer: 'Bumblebot', f_turret: 'Popgun', f_golem: 'Anvil Brute', f_valve: 'Valvehead', f_drone: 'Buzzard',
      foot: '<b>ORUZHEYNIK</b> · ← → / A D — run · Space / Z / ↑ — jump (hold — higher) · X / J — shoot, hold — charge the crossbow · ↓ + jump or C / Shift — slide · Q / E or 1–9 — weapon · F — flask · P / Esc — pause · L language, T theme, M sound.'
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
