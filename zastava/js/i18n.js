/* ЗАСТАВА · i18n (RU/EN). ZASTAVA.STR — таблицы для Arcade.createGame({strings}).
   Ключи play/language/theme/... нужны стандартным экранам движка; остальные — игре. */
(function (global) {
  'use strict';
  var Z = global.ZASTAVA = global.ZASTAVA || {};
  Z.STR = {
    ru: {
      play: 'Играть', language: 'Язык', theme: 'Тема', sound: 'Звук', on: 'вкл', off: 'выкл',
      score: 'Счёт', level: 'Волна', best: 'Рекорд', win: 'ЗАСТАВА ЦЕЛА!', gameover: 'ЗАСТАВА ПАЛА',
      pause: 'ПАУЗА', resume: 'Продолжить', menu: 'В меню', tapstart: 'пробел / тап',
      title: 'ЗАСТАВА', subtitle: 'Ржавь идёт рядами · 10 волн · удержи мастерскую',
      back: 'Каталог', lives: 'Лафеты',
      wave: 'ВОЛНА', ready: 'К бою!', clear: 'ВОЛНА ОТБИТА', bonus: 'Бонус', lost: 'ЛАФЕТ ПОДБИТ', invaded: 'РЖАВЬ ДОШЛА ДО ЗЕМЛИ',
      sub_grid: 'Строй идёт ступенями — не дай ему дойти до земли',
      sub_birds: 'Коршуны закрываются щитом — бей, когда раскроют крылья',
      sub_boss: 'Пробей конвейерный пояс и попади в горн-ядро',
      core: 'Ядро матки', extra: '+1 ЛАФЕТ', probe: 'ЗОНД',
      wv_dawn: 'Ржавый рассвет', wv_cogs: 'Шестерни', wv_kites: 'Коршуны', wv_drills: 'Сверлильщики', wv_mother: 'Матка-конвейер',
      wv_flock: 'Стальная стая', wv_scale: 'Окалина', wv_onslaught: 'Натиск', wv_storm: 'Буря крыльев', wv_heart: 'Сердце ржави',
      hint: '← → — лафет · Пробел — огонь · P — пауза',
      foot: '<b>ЗАСТАВА</b> · ← → / A D — лафет · Пробел / ● — огонь (удержание — очередь) · P / Esc — пауза · L язык, T тема, M звук.'
    },
    en: {
      play: 'Play', language: 'Language', theme: 'Theme', sound: 'Sound', on: 'on', off: 'off',
      score: 'Score', level: 'Wave', best: 'Best', win: 'OUTPOST HOLDS!', gameover: 'OUTPOST FALLEN',
      pause: 'PAUSE', resume: 'Resume', menu: 'Menu', tapstart: 'space / tap',
      title: 'ZASTAVA', subtitle: 'Rust marches in rows · 10 waves · hold the workshop',
      back: 'Catalog', lives: 'Cannons',
      wave: 'WAVE', ready: 'Battle stations!', clear: 'WAVE REPELLED', bonus: 'Bonus', lost: 'CANNON DOWN', invaded: 'THE RUST REACHED THE GROUND',
      sub_grid: 'The rows step down — do not let them reach the ground',
      sub_birds: 'Kites close their shields — hit them when the wings open',
      sub_boss: 'Break the conveyor belt, then hit the furnace core',
      core: 'Mother core', extra: '+1 CANNON', probe: 'PROBE',
      wv_dawn: 'Rusty Dawn', wv_cogs: 'Cogs', wv_kites: 'Kites', wv_drills: 'Drillers', wv_mother: 'Conveyor Mother',
      wv_flock: 'Steel Flock', wv_scale: 'Mill Scale', wv_onslaught: 'Onslaught', wv_storm: 'Wing Storm', wv_heart: 'Heart of Rust',
      hint: '← → — cannon · Space — fire · P — pause',
      foot: '<b>ZASTAVA</b> · ← → / A D — cannon · Space / ● — fire (hold for bursts) · P / Esc — pause · L language, T theme, M sound.'
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
