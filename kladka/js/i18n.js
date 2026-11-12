/* КЛАДКА · i18n (RU/EN). KLADKA.STR — таблицы для Arcade.createGame({strings}).
   Ключи play/language/theme/... нужны стандартным экранам движка; остальные — игре. */
(function (global) {
  'use strict';
  var K = global.KLADKA = global.KLADKA || {};
  K.STR = {
    ru: {
      play: 'Играть', language: 'Язык', theme: 'Тема', sound: 'Звук', on: 'вкл', off: 'выкл',
      score: 'Счёт', level: 'Ур.', best: 'Рекорд', win: 'ПЛАВИЛЬНЯ ПОГАШЕНА!', gameover: 'КЛАДКА УСТОЯЛА',
      pause: 'ПАУЗА', resume: 'Продолжить', menu: 'В меню', tapstart: 'пробел / тап',
      title: 'КЛАДКА', subtitle: 'Разбери кладку · 10 уровней · сердце печи',
      back: 'Каталог', lives: 'Жизни',
      ready: 'УРОВЕНЬ', launch: 'Пробел / клик — пуск ядра', bossSub: 'Бей ядром в сердце печи, береги мастерок от искр',
      clear: 'КЛАДКА РАЗОБРАНА', bonus: 'Бонус', lost: 'ЯДРО ПОТЕРЯНО', heart: 'Сердце печи', draft: 'ТЯГА ПЕЧИ',
      lv_base: 'Фундамент', lv_arch: 'Арка', lv_checker: 'Шахматка', lv_gates: 'Ворота', lv_flue: 'Дымоход',
      lv_stairs: 'Лестница', lv_grate: 'Решётка', lv_bastion: 'Бастион', lv_hearth: 'Горн', lv_smelter: 'Плавильня',
      pw_wide: 'РАЗМАХ', pw_narrow: 'ТЕСНОТА', pw_triple: 'ТРОЙНЯ', pw_glue: 'СМОЛА', pw_cutter: 'РЕЗАК', pw_chill: 'ОСТУДА', pw_life: 'ЗАПАС',
      hint: 'Мышь / ← → — мастерок · Пробел — пуск и резак · P — пауза',
      foot: '<b>КЛАДКА</b> · мышь, палец или ← → / A D — мастерок · Пробел / клик / тап — пуск ядра и резак · P — пауза · L язык, T тема, M звук.'
    },
    en: {
      play: 'Play', language: 'Language', theme: 'Theme', sound: 'Sound', on: 'on', off: 'off',
      score: 'Score', level: 'Lvl', best: 'Best', win: 'SMELTER QUENCHED!', gameover: 'THE WALL STANDS',
      pause: 'PAUSE', resume: 'Resume', menu: 'Menu', tapstart: 'space / tap',
      title: 'KLADKA', subtitle: 'Break the masonry · 10 levels · furnace heart',
      back: 'Catalog', lives: 'Lives',
      ready: 'LEVEL', launch: 'Space / click — launch the core', bossSub: 'Hit the furnace heart, keep the trowel clear of sparks',
      clear: 'WALL TORN DOWN', bonus: 'Bonus', lost: 'CORE LOST', heart: 'Furnace heart', draft: 'FURNACE DRAFT',
      lv_base: 'Foundation', lv_arch: 'Arch', lv_checker: 'Checkerboard', lv_gates: 'Gates', lv_flue: 'Flue',
      lv_stairs: 'Staircase', lv_grate: 'Grate', lv_bastion: 'Bastion', lv_hearth: 'Hearth', lv_smelter: 'Smelter',
      pw_wide: 'SPAN', pw_narrow: 'PINCH', pw_triple: 'TRIPLET', pw_glue: 'RESIN', pw_cutter: 'CUTTER', pw_chill: 'CHILL', pw_life: 'SPARE',
      hint: 'Mouse / ← → — trowel · Space — launch & cutter · P — pause',
      foot: '<b>KLADKA</b> · mouse, finger or ← → / A D — trowel · Space / click / tap — launch the core & fire the cutter · P — pause · L language, T theme, M sound.'
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
