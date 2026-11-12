/* ЭСКАДРИЛЬЯ · i18n (RU/EN). ESKADRILYA.STR — таблицы для Arcade.createGame({strings}).
   Ключи play/language/theme/... нужны стандартным экранам движка; остальные — игре. */
(function (global) {
  'use strict';
  var E = global.ESKADRILYA = global.ESKADRILYA || {};
  E.STR = {
    ru: {
      play: 'Играть', language: 'Язык', theme: 'Тема', sound: 'Звук', on: 'вкл', off: 'выкл',
      score: 'Счёт', level: 'Перелёт', best: 'Рекорд', win: 'ФЛОТИЛИЯ РАЗБИТА!', gameover: 'ОТРЯД СБИТ',
      pause: 'ПАУЗА', resume: 'Продолжить', menu: 'В меню', tapstart: 'пробел / тап',
      title: 'ЭСКАДРИЛЬЯ', subtitle: 'Летучий отряд «Гефеста» против флотилии Окалины',
      subtitle2: '8 перелётов · петля · звено · крейсеры-кузни',
      back: 'Каталог', lives: 'Самолёты', stage: 'ПЕРЕЛЁТ', energy: 'ЭНЕРГИЯ', loops: 'ПЕТЛИ',
      clear: 'КРЕЙСЕР ПОТОПЛЕН', bonus: 'Бонус', lost: 'САМОЛЁТ ПОТЕРЯН', low: 'МАЛО ЭНЕРГИИ!',
      ship: 'Крейсер-кузня', turrets: 'турели', armored: 'ТУРЕЛИ ПОД КОЛПАКАМИ', anchored: 'КРЕЙСЕР ВСТАЛ — ОГОНЬ!',
      sub_route: 'Сбивай птиц и дирижабли, глуши зенитки и катера. Склады дают топливо',
      sub_boss: 'Нос крейсера прикрыт трубами — зайди над палубой',
      pk_fuel: '+ТОПЛИВО', pk_wing: 'ЗВЕНО!', pk_loop: '+ПЕТЛЯ', pk_power: 'СТВОЛЫ +1', wing_lost: 'ВЕДОМЫЙ СБИТ', extra: '+1 САМОЛЁТ',
      lv_bay: 'Бухта Горна', lv_shore: 'Рыжий берег', lv_ridge: 'Котловая гряда', lv_bridge: 'Мост Окалины',
      lv_shoals: 'Дымные отмели', lv_archi: 'Чугунный архипелаг', lv_waste: 'Шлаковая пустошь', lv_flagship: 'Флагман Окалины',
      boss_1: '«Копоть»', boss_2: '«Шлак»', boss_3: '«Жаровня»', boss_4: '«Клёпка»', boss_5: '«Угар»', boss_6: '«Окалыш»', boss_7: '«Тигель»', boss_8: '«Великое Горнило»',
      hint: '←↑↓→ — полёт · Пробел — огонь · X / Shift — петля · P — пауза',
      foot: '<b>ЭСКАДРИЛЬЯ</b> · ←↑↓→ / WASD — полёт · Пробел / ● — огонь (удержание) · X / Shift / ↻ — петля · палец по полю — вести самолёт · P / Esc — пауза · L язык, T тема, M звук.'
    },
    en: {
      play: 'Play', language: 'Language', theme: 'Theme', sound: 'Sound', on: 'on', off: 'off',
      score: 'Score', level: 'Sortie', best: 'Best', win: 'FLOTILLA DEFEATED!', gameover: 'SQUADRON DOWN',
      pause: 'PAUSE', resume: 'Resume', menu: 'Menu', tapstart: 'space / tap',
      title: 'ESKADRILYA', subtitle: 'The Hephaestus flying squad versus the Scale flotilla',
      subtitle2: '8 sorties · loop · wingmen · forge cruisers',
      back: 'Catalog', lives: 'Planes', stage: 'SORTIE', energy: 'ENERGY', loops: 'LOOPS',
      clear: 'CRUISER SUNK', bonus: 'Bonus', lost: 'PLANE LOST', low: 'LOW ENERGY!',
      ship: 'Forge cruiser', turrets: 'turrets', armored: 'TURRETS UNDER DOMES', anchored: 'THE CRUISER STOPS — FIRE!',
      sub_route: 'Down birds and airships, silence flak and boats. Depots give fuel',
      sub_boss: 'The bow is shielded by funnels — fly over the deck',
      pk_fuel: '+FUEL', pk_wing: 'WINGMEN!', pk_loop: '+LOOP', pk_power: 'GUNS +1', wing_lost: 'WINGMAN DOWN', extra: '+1 PLANE',
      lv_bay: 'Furnace Bay', lv_shore: 'Rusty Shore', lv_ridge: 'Boiler Ridge', lv_bridge: 'Scale Bridge',
      lv_shoals: 'Smoky Shoals', lv_archi: 'Cast-Iron Isles', lv_waste: 'Slag Waste', lv_flagship: 'Scale Flagship',
      boss_1: '"Soot"', boss_2: '"Slag"', boss_3: '"Brazier"', boss_4: '"Rivet"', boss_5: '"Fume"', boss_6: '"Scaleback"', boss_7: '"Crucible"', boss_8: '"Great Furnace"',
      hint: '←↑↓→ — fly · Space — fire · X / Shift — loop · P — pause',
      foot: '<b>ESKADRILYA</b> · ←↑↓→ / WASD — fly · Space / ● — fire (hold) · X / Shift / ↻ — loop · drag on the field — steer · P / Esc — pause · L language, T theme, M sound.'
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
