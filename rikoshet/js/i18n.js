/* РИКОШЕТ · i18n (RU/EN). RIK.STR — таблицы для Arcade.createGame({strings}).
   Ключи play/language/theme/... нужны стандартным экранам движка; остальные — игре. */
(function (global) {
  'use strict';
  var R = global.RIK = global.RIK || {};
  var LV_RU = ['Наковальня', 'Молот', 'Искры', 'Клещи', 'Горн', 'Пороховой склад', 'Конвейер', 'Живая руда', 'Сейф мастера', 'Молотобой',
    'Цепь', 'Шестерня', 'Пламя', 'Подкова', 'Кристалл', 'Мехи', 'Крепостная стена', 'Шлаковый лабиринт', 'Звезда', 'Мехоправ',
    'Котёл', 'Две башни', 'Решётка', 'Змеевик', 'Пороховая шахта', 'Знак мастерской', 'Двойной сейф', 'Морозное стекло', 'Последний рубеж', 'Горн-Колосс'];
  var LV_EN = ['Anvil', 'Hammer', 'Sparks', 'Tongs', 'Furnace', 'Powder Store', 'Conveyor', 'Living Ore', "Master's Safe", 'The Trip-Hammer',
    'Chain', 'Gear', 'Flame', 'Horseshoe', 'Crystal', 'Bellows', 'Rampart', 'Slag Maze', 'Star', 'The Bellows Engine',
    'Cauldron', 'Two Spires', 'Lattice', 'Coil', 'Powder Mine', 'Workshop Mark', 'Twin Vault', 'Frost Glass', 'Last Line', 'Forge Colossus'];
  var ru = {
    play: 'Играть', language: 'Язык', theme: 'Тема', sound: 'Звук', on: 'вкл', off: 'выкл',
    score: 'Счёт', level: 'Стена', best: 'Рекорд', lives: 'Жизни',
    win: 'ВСЕ СТЕНЫ РАЗБИТЫ!', gameover: 'НАКОВАЛЬНЯ ОСТЫЛА',
    pause: 'ПАУЗА', resume: 'Продолжить', menu: 'В меню', tapstart: 'пробел / тап',
    title: 'РИКОШЕТ', subtitle: 'Раскалённая заклёпка мастерской «Гефест»',
    sub2: 'Разбивание блоков · 30 стен из руды, стекла и металла · 3 механизма-босса',
    back: 'Каталог', mode: 'Режим', m_campaign: 'Кампания', m_endless: 'Бесконечный', startAt: 'Начать со стены',
    restart: 'Заново стену',
    launch: 'Пробел / клик — запустить заклёпку', clear: 'СТЕНА РАЗБИТА', bonus: 'бонус', lost: 'ЗАКЛЁПКА ПОТЕРЯНА',
    boss: 'МЕХАНИЗМ', bossDown: 'МЕХАНИЗМ ПОВЕРЖЕН', gates: 'Решётки открыты!', zap: 'Удар по наковальне!', life: '+жизнь',
    endless: 'Бесконечный', wall: 'Стена',
    p_E: 'Шире', p_S: 'Уже', p_B: 'Мульти-шар', p_L: 'Лазеры', p_C: 'Липкая', p_F: 'Огненный шар', p_W: 'Медленнее', p_Q: 'Быстрее', p_H: 'Барьер', 'p_+': '+жизнь',
    hint: '← → / мышь / палец — наковальня · Пробел/клик — запуск и лазер · P пауза · T тема · L язык',
    foot: '<b>РИКОШЕТ</b> · мышь, палец или ← → / A D — наковальня · Пробел / клик / тап — запустить заклёпку, отпустить с липкой, стрелять лазером · P / Esc — пауза · L язык, T тема, M звук.'
  };
  var en = {
    play: 'Play', language: 'Language', theme: 'Theme', sound: 'Sound', on: 'on', off: 'off',
    score: 'Score', level: 'Wall', best: 'Best', lives: 'Lives',
    win: 'EVERY WALL IS DOWN!', gameover: 'THE ANVIL HAS COOLED',
    pause: 'PAUSE', resume: 'Resume', menu: 'Menu', tapstart: 'space / tap',
    title: 'RIKOSHET', subtitle: 'A red-hot rivet from the Hefest workshop',
    sub2: 'Block-breaking · 30 walls of ore, glass and metal · 3 machine bosses',
    back: 'Catalog', mode: 'Mode', m_campaign: 'Campaign', m_endless: 'Endless', startAt: 'Start at wall',
    restart: 'Restart wall',
    launch: 'Space / click — launch the rivet', clear: 'WALL BROKEN', bonus: 'bonus', lost: 'RIVET LOST',
    boss: 'MACHINE', bossDown: 'MACHINE DESTROYED', gates: 'Grates are open!', zap: 'The anvil is hit!', life: '+life',
    endless: 'Endless', wall: 'Wall',
    p_E: 'Wider', p_S: 'Narrower', p_B: 'Multi-ball', p_L: 'Lasers', p_C: 'Sticky', p_F: 'Fireball', p_W: 'Slower', p_Q: 'Faster', p_H: 'Barrier', 'p_+': '+life',
    hint: '← → / mouse / finger — anvil · Space/click — launch & laser · P pause · T theme · L language',
    foot: '<b>RIKOSHET</b> · mouse, finger or ← → / A D — anvil · Space / click / tap — launch the rivet, release when sticky, fire lasers · P / Esc — pause · L language, T theme, M sound.'
  };
  for (var i = 0; i < 30; i++) { ru['lv' + (i + 1)] = LV_RU[i]; en['lv' + (i + 1)] = LV_EN[i]; }
  R.STR = { ru: ru, en: en };
})(typeof window !== 'undefined' ? window : globalThis);
