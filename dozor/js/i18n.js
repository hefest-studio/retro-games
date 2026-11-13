/* ДОЗОР · i18n (RU/EN). DOZOR.STR — таблицы для Arcade.createGame({strings}).
   Ключи play/language/theme/... нужны стандартным экранам движка, players/touch1p — g.usePlayers; остальные — игре. */
(function (global) {
  'use strict';
  var D = global.DOZOR = global.DOZOR || {};
  D.STR = {
    ru: {
      play: 'Играть', players: 'Игроки', touch1p: 'тач — 1 игрок', language: 'Язык', theme: 'Тема', sound: 'Звук', on: 'вкл', off: 'выкл',
      score: 'Счёт', level: 'Этап', best: 'Рекорд', win: 'АРТЕЛЬ РАЗБИТА! МАСТЕРОВЫЕ НА ВОЛЕ', gameover: 'ДОЗОР ВЕРНЁТСЯ',
      pause: 'ПАУЗА', resume: 'Продолжить', menu: 'В меню', tapstart: 'пробел / тап',
      title: 'ДОЗОР', subtitle: 'Броневики «Гефеста» против Ржавой артели · 1–2 игрока · 6 этапов',
      back: 'Каталог', p1: 'И1', p2: 'И2', hero_0: 'Кремень', hero_1: 'Сполох',
      stage: 'ЭТАП', stageShort: 'Эт.',
      s_sand: 'Песчаный тракт', s_wharf: 'Речная пристань', s_rail: 'Рельсовый узел', s_slag: 'Шлаковые холмы', s_quarter: 'Заводской посад', s_hold: 'Твердыня артели', s_test: 'Полигон',
      introSub: 'Взрывай бараки, собирай мастеровых, вези на площадку',
      b_bolt: 'ЗАСОВ', b_smelter: 'ПЛАВИЛЬНЯ', b_boiler: 'КОТЕЛЬНАЯ', b_lock: 'ШЛЮЗ', b_forge: 'КУЗНЯ-ФОРТ', b_works: 'ГЛАВНЫЙ ЦЕХ',
      bossSub: 'Крепость артели · ядро берут только гранаты и ракеты',
      phase: 'ФАЗА', clear: 'ЭТАП ПРОЙДЕН', bonus: 'Бонус', rescued: 'Спасено', carried: 'На борту',
      w_1: 'Гранаты', w_2: 'Ракеты', w_3: 'Самонаводка', upgrade: 'МАСТЕР НА БОРТУ', upgradeTo: 'оружие',
      pow: '+мастеровой', full: 'БОРТ ПОЛОН', deliver: 'СПАСЁН +1000', scatter: 'мастеровые разбежались!', powLost: 'мастеровой отстал',
      extraLife: '+1 ЖИЗНЬ', out: 'выбыл', lives: 'Жизни', train: 'ПОЕЗД!', heli: 'СТРЕКОЗА!',
      cont: 'ПРОДОЛЖИТЬ?', contHint: 'огонь / Enter — в бой', contLeft: 'продолжений', continued: 'ПРОДОЛЖЕНИЕ',
      hint1: 'И1: стрелки, пробел — пулемёт, «.» — граната',
      hint2: 'И2: WASD, F — пулемёт, G — граната · 1/2 — игроки',
      foot: '<b>ДОЗОР</b> · И1: стрелки, пробел или / — пулемёт (держать), «.» или «,» — граната/ракета · И2: WASD, F/X — пулемёт, G/C — граната (в одиночку работают обе раскладки) · пулемёт бьёт вверх, граната — куда смотрит машина · 1/2 на заставке — игроки · P/Esc пауза · L язык, T тема, M звук. Тач — только И1.'
    },
    en: {
      play: 'Play', players: 'Players', touch1p: 'touch — 1 player', language: 'Language', theme: 'Theme', sound: 'Sound', on: 'on', off: 'off',
      score: 'Score', level: 'Stage', best: 'Best', win: 'THE ARTEL IS BROKEN! THE CRAFTSMEN ARE FREE', gameover: 'THE PATROL WILL RETURN',
      pause: 'PAUSE', resume: 'Resume', menu: 'Menu', tapstart: 'space / tap',
      title: 'DOZOR', subtitle: 'Hefest armored cars vs the Rust Artel · 1–2 players · 6 stages',
      back: 'Catalog', p1: 'P1', p2: 'P2', hero_0: 'Flint', hero_1: 'Flare',
      stage: 'STAGE', stageShort: 'St.',
      s_sand: 'Sand Road', s_wharf: 'River Wharf', s_rail: 'Rail Junction', s_slag: 'Slag Hills', s_quarter: 'Factory Quarter', s_hold: 'Artel Hold', s_test: 'Proving Ground',
      introSub: 'Blow up the barracks, pick up the craftsmen, fly them out',
      b_bolt: 'BOLT GATE', b_smelter: 'SMELTER', b_boiler: 'BOILERHOUSE', b_lock: 'SLUICE', b_forge: 'FORGE FORT', b_works: 'GRAND WORKS',
      bossSub: 'An Artel fortress · only grenades and rockets crack the core',
      phase: 'PHASE', clear: 'STAGE CLEAR', bonus: 'Bonus', rescued: 'Rescued', carried: 'Aboard',
      w_1: 'Grenades', w_2: 'Rockets', w_3: 'Homing', upgrade: 'MASTER ABOARD', upgradeTo: 'weapon',
      pow: '+craftsman', full: 'CAR IS FULL', deliver: 'SAVED +1000', scatter: 'the craftsmen scattered!', powLost: 'a craftsman fell behind',
      extraLife: '+1 LIFE', out: 'is out', lives: 'Lives', train: 'TRAIN!', heli: 'DRAGONFLY!',
      cont: 'CONTINUE?', contHint: 'fire / Enter — back to the fight', contLeft: 'continues', continued: 'CONTINUE',
      hint1: 'P1: arrows, space — gun, “.” — grenade',
      hint2: 'P2: WASD, F — gun, G — grenade · 1/2 — players',
      foot: '<b>DOZOR</b> · P1: arrows, space or / — machine gun (hold), “.” or “,” — grenade/rocket · P2: WASD, F/X — machine gun, G/C — grenade (solo: both layouts work) · the gun fires up, grenades go where the car faces · 1/2 on the title — players · P/Esc pause · L language, T theme, M sound. Touch — P1 only.'
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
