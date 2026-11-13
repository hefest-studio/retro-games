/* УДАЛЕЦ · i18n (RU/EN). UDALETS.STR — таблицы для Arcade.createGame({strings}).
   Ключи play/language/theme/... нужны стандартным экранам движка; остальные — игре. */
(function (global) {
  'use strict';
  var U = global.UDALETS = global.UDALETS || {};
  U.STR = {
    ru: {
      play: 'Играть', language: 'Язык', theme: 'Тема', sound: 'Звук', on: 'вкл', off: 'выкл',
      score: 'Счёт', level: 'Уровень', best: 'Рекорд', lives: 'Жизни',
      win: 'КУБКИ ДОБЫТЫ!', gameover: 'УДАЛЕЦ ВЫБЫЛ',
      pause: 'ПАУЗА', resume: 'Продолжить', menu: 'В меню', restart: 'Заново уровень (−1 жизнь)', tapstart: 'пробел / тап',
      title: 'УДАЛЕЦ', subtitle: 'Кубки Мастера в заброшенных цехах «Гефеста»',
      sub2: 'Подмастерье-удалец · 10 уровней · ружьё и реактивный ранец',
      back: 'Каталог',
      lv1: 'Старый цех', lv2: 'Кузня', lv3: 'Литейная', lv4: 'Кислотные чаны', lv5: 'Трубный ярус',
      lv6: 'Башня ветров', lv7: 'Часовой механизм', lv8: 'Котельная', lv9: 'Шпиль', lv10: 'Горн Мастера', lv0: 'Тайная кладовая',
      cupGot: 'Кубок Мастера! Дверь открыта', needCup: 'Сначала найди Кубок', clear: 'УРОВЕНЬ ПРОЙДЕН', timeBonus: 'бонус',
      gun: 'Ружьё! X — выстрел', ammo: '+патроны', jet: 'Ранец! Shift — взлёт', fuel: '+топливо', life: '+жизнь!',
      empty: 'пусто', fuelOut: 'топливо кончилось', warp: 'ТАЙНАЯ КЛАДОВАЯ', bonusEnd: 'назад в цех', bonusTime: 'Время',
      secret: 'тайник!', ammoL: 'ЗАРЯДЫ', fuelL: 'РАНЕЦ', cupL: 'КУБОК', restarted: 'уровень заново', sec: 'с',
      hint: '←→ ходить · ↑/Пробел прыжок · X выстрел · Shift ранец · P пауза',
      intro: 'Найди Кубок — откроется дверь',
      foot: '<b>УДАЛЕЦ</b> · ← → / A D — ходить · ↑ / W / Пробел / Z — прыжок · X / K / Ctrl — выстрел (с уровня 3) · Shift / C — реактивный ранец вкл/выкл (с уровня 6; в полёте — стрелки) · P / Esc — пауза · L язык, T тема, M звук.'
    },
    en: {
      play: 'Play', language: 'Language', theme: 'Theme', sound: 'Sound', on: 'on', off: 'off',
      score: 'Score', level: 'Level', best: 'Best', lives: 'Lives',
      win: 'CUPS RECOVERED!', gameover: 'THE DAREDEVIL IS OUT',
      pause: 'PAUSE', resume: 'Resume', menu: 'Menu', restart: 'Restart level (−1 life)', tapstart: 'space / tap',
      title: 'UDALETS', subtitle: 'Master Cups in the abandoned Hefest workshops',
      sub2: 'A daring apprentice · 10 levels · a rifle and a rocket pack',
      back: 'Catalog',
      lv1: 'Old Workshop', lv2: 'Smithy', lv3: 'Foundry', lv4: 'Acid Vats', lv5: 'Pipe Deck',
      lv6: 'Tower of Winds', lv7: 'Clockwork', lv8: 'Boiler Room', lv9: 'The Spire', lv10: 'Master Forge', lv0: 'Secret Storeroom',
      cupGot: 'Master Cup! The door is open', needCup: 'Find the Cup first', clear: 'LEVEL CLEAR', timeBonus: 'bonus',
      gun: 'Rifle! X — shoot', ammo: '+ammo', jet: 'Rocket pack! Shift — lift off', fuel: '+fuel', life: '+life!',
      empty: 'empty', fuelOut: 'out of fuel', warp: 'SECRET STOREROOM', bonusEnd: 'back to the workshop', bonusTime: 'Time',
      secret: 'secret!', ammoL: 'AMMO', fuelL: 'ROCKET', cupL: 'CUP', restarted: 'level restarted', sec: 's',
      hint: '←→ walk · ↑/Space jump · X shoot · Shift rocket · P pause',
      intro: 'Find the Cup to open the door',
      foot: '<b>UDALETS</b> · ← → / A D — walk · ↑ / W / Space / Z — jump · X / K / Ctrl — shoot (from level 3) · Shift / C — rocket pack on/off (from level 6; arrows to fly) · P / Esc — pause · L language, T theme, M sound.'
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
