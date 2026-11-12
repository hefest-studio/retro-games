/* ТАЙНИК · i18n (RU/EN). TAYNIK.STR — таблицы для Arcade.createGame({strings}).
   Ключи play/language/theme/... нужны стандартным экранам движка; остальные — игре. */
(function (global) {
  'use strict';
  var K = global.TAYNIK = global.TAYNIK || {};
  K.STR = {
    ru: {
      play: 'Играть', language: 'Язык', theme: 'Тема', sound: 'Звук', on: 'вкл', off: 'выкл',
      score: 'Счёт', level: 'Ур.', best: 'Рекорд', win: 'ВЫ ВЫБРАЛИСЬ НАВЕРХ!', gameover: 'ФОНАРЬ ПОГАС',
      pause: 'ПАУЗА', resume: 'Продолжить', menu: 'В меню', tapstart: 'пробел / тап',
      title: 'ТАЙНИК', subtitle: 'Подмастерье-фонарщик Светляк · водонапорная башня «Гефеста» · 6 ярусов',
      back: 'Каталог', lives: 'Жизни', energy: 'Сила', ammo: 'Заряды',
      ready: 'ЯРУС', readySub: 'Найди люк наверх · ↑ — прыжок и верёвка',
      clear: 'ЛЮК НАЙДЕН', bonus: 'Бонус', lost: 'ПОТЕРЯ', next: 'Следующий ярус',
      d_acid: 'Упал в кислоту', d_energy: 'Силы иссякли',
      t_gem: 'КАМЕНЬ', t_gear: 'ДЕТАЛЬ', t_ammo: 'ЗАРЯДЫ', t_oil: 'МАСЛО', t_map: 'КАРТА', t_lamp: 'ФОНАРЬ ЗАЖЖЁН',
      t_empty: 'ПУСТО!', t_extra: '+1 ЖИЗНЬ', t_reveal: 'ХАМЕЛЕОН!',
      e_spider: 'паук', e_spark: 'искра', e_ghost: 'призрак', e_cham: 'хамелеон',
      lv_1: 'Подвал', lv_2: 'Насосная', lv_3: 'Трубный ярус', lv_4: 'Котельная', lv_5: 'Паровой ярус', lv_6: 'Под баком',
      hintmap: 'КАРТА', exit: 'ВЫХОД',
      hint: '←→ шаг · ↑ прыжок / по верёвке · ↓ вниз · пробел — выстрел · P — пауза',
      foot: '<b>ТАЙНИК</b> · ←→ / AD — шаг · ↑ / W — прыжок, хват и подъём по верёвке · ↓ / S — спуск · на верёвке ←/→ — прыжок с неё · пробел / Z — выстрел · P/Esc — пауза · L язык, T тема, M звук.'
    },
    en: {
      play: 'Play', language: 'Language', theme: 'Theme', sound: 'Sound', on: 'on', off: 'off',
      score: 'Score', level: 'Lvl', best: 'Best', win: 'YOU MADE IT TO THE TOP!', gameover: 'THE LANTERN WENT OUT',
      pause: 'PAUSE', resume: 'Resume', menu: 'Menu', tapstart: 'space / tap',
      title: 'TAYNIK', subtitle: 'Svetlyak the lamplighter apprentice · the old water tower · 6 tiers',
      back: 'Catalog', lives: 'Lives', energy: 'Energy', ammo: 'Charges',
      ready: 'TIER', readySub: 'Find the hatch up · ↑ — jump and rope',
      clear: 'HATCH FOUND', bonus: 'Bonus', lost: 'LOST', next: 'Next tier',
      d_acid: 'Fell into the acid', d_energy: 'Out of energy',
      t_gem: 'GEM', t_gear: 'PART', t_ammo: 'CHARGES', t_oil: 'OIL', t_map: 'MAP', t_lamp: 'LAMP LIT',
      t_empty: 'EMPTY!', t_extra: '+1 LIFE', t_reveal: 'CHAMELEON!',
      e_spider: 'spider', e_spark: 'spark', e_ghost: 'ghost', e_cham: 'chameleon',
      lv_1: 'Cellar', lv_2: 'Pump room', lv_3: 'Pipe tier', lv_4: 'Boiler room', lv_5: 'Steam tier', lv_6: 'Under the tank',
      hintmap: 'MAP', exit: 'EXIT',
      hint: '←→ step · ↑ jump / climb · ↓ down · space — shoot · P — pause',
      foot: '<b>TAYNIK</b> · ←→ / AD — step · ↑ / W — jump, grab and climb a rope · ↓ / S — climb down · on a rope ←/→ — leap off · space / Z — shoot · P/Esc — pause · L language, T theme, M sound.'
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
