/* ПУЗЫРЬ · i18n (RU/EN). PUZYR.STR — таблицы для Arcade.createGame({strings}).
   Ключи play/players/language/theme/... нужны стандартным экранам движка; остальные — игре. */
(function (global) {
  'use strict';
  var Z = global.PUZYR = global.PUZYR || {};
  Z.STR = {
    ru: {
      play: 'Играть', players: 'Игроки', touch1p: 'тач — 1 игрок', language: 'Язык', theme: 'Тема', sound: 'Звук', on: 'вкл', off: 'выкл',
      score: 'Счёт', level: 'Ур.', best: 'Рекорд', win: 'КОТЁЛ ЛОПНУЛ!', gameover: 'ШАРЫ КОНЧИЛИСЬ',
      pause: 'ПАУЗА', resume: 'Продолжить', menu: 'В меню', tapstart: 'пробел / тап',
      title: 'ПУЗЫРЬ', subtitle: 'Стеклодувы мастерской «Гефест» · 30 уровней + Котёл · 1–2 игрока',
      back: 'Каталог', word: 'ГЕФЕСТ',
      ready: 'УРОВЕНЬ', goal: 'Поймай врагов в шары и лопни их', bossGoal: 'Лопай шары-ГРОЗЫ — молния бьёт в Котёл',
      clear: 'ЧИСТО!', life: '+1 ЖИЗНЬ', hurry: 'СКВОЗНЯК!', angry: 'ВРАГИ ЗЛЯТСЯ!', join: 'ВХОДИТ', boss: 'Котёл',
      p1: 'Колба', p2: 'Реторта', out: 'выбыл', press2: 'жми 2 — войти', wordDone: 'ГЕФЕСТ! +1 ЖИЗНЬ',
      z_workshop: 'Мастерская', z_kiln: 'Печной ряд', z_glass: 'Стеклянный склад', z_pipes: 'Трубы', z_dome: 'Купол', z_boss: 'Логово Котла',
      sp_fire: 'ЖАР', sp_water: 'ЛИВЕНЬ', sp_bolt: 'ГРОЗА',
      en_cog: 'Зубец', en_spring: 'Пружина', en_soot: 'Копоть', en_spark: 'Искрун',
      hint1: 'Колба: ← → — бег, ↑ или / — прыжок, пробел или . — выдуть шар',
      hint2: 'Реторта: A D — бег, W или G — прыжок, F или E — шар · 2 — войти в игре',
      foot: '<b>ПУЗЫРЬ</b> · Колба: ← → бег, ↑ или / прыжок, пробел или . шар · Реторта: A D бег, W или G прыжок, F или E шар · <b>2</b> — второй игрок входит прямо в игре · держи прыжок над шаром — отскок · P/Esc пауза · L язык, T тема, M звук. Тач — только Колба.'
    },
    en: {
      play: 'Play', players: 'Players', touch1p: 'touch — 1 player', language: 'Language', theme: 'Theme', sound: 'Sound', on: 'on', off: 'off',
      score: 'Score', level: 'Lvl', best: 'Best', win: 'THE CAULDRON POPPED!', gameover: 'OUT OF BUBBLES',
      pause: 'PAUSE', resume: 'Resume', menu: 'Menu', tapstart: 'space / tap',
      title: 'PUZYR', subtitle: 'Glassblowers of the Hefest workshop · 30 levels + the Cauldron · 1–2 players',
      back: 'Catalog', word: 'HEFEST',
      ready: 'LEVEL', goal: 'Trap the enemies in bubbles and pop them', bossGoal: 'Pop THUNDER bubbles — lightning strikes the Cauldron',
      clear: 'CLEAR!', life: '+1 LIFE', hurry: 'DRAUGHT!', angry: 'ENEMIES ARE MAD!', join: 'JOINS', boss: 'Cauldron',
      p1: 'Flask', p2: 'Retort', out: 'out', press2: 'press 2 to join', wordDone: 'HEFEST! +1 LIFE',
      z_workshop: 'Workshop', z_kiln: 'Kiln Row', z_glass: 'Glass Store', z_pipes: 'Pipes', z_dome: 'The Dome', z_boss: 'Cauldron Lair',
      sp_fire: 'EMBER', sp_water: 'DOWNPOUR', sp_bolt: 'THUNDER',
      en_cog: 'Cog', en_spring: 'Spring', en_soot: 'Soot', en_spark: 'Sparker',
      hint1: 'Flask: ← → — run, ↑ or / — jump, space or . — blow a bubble',
      hint2: 'Retort: A D — run, W or G — jump, F or E — bubble · 2 — join in game',
      foot: '<b>PUZYR</b> · Flask: ← → run, ↑ or / jump, space or . bubble · Retort: A D run, W or G jump, F or E bubble · <b>2</b> — player two joins mid-game · hold jump over a bubble to bounce · P/Esc pause · L language, T theme, M sound. Touch — Flask only.'
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
