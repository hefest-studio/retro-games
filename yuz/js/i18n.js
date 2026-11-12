/* ЮЗ · i18n (RU/EN). YUZ.STR — таблицы для Arcade.createGame({strings}).
   Ключи play/players/language/theme/... нужны стандартным экранам движка; остальные — игре. */
(function (global) {
  'use strict';
  var Y = global.YUZ = global.YUZ || {};
  Y.STR = {
    ru: {
      play: 'Играть', players: 'Игроки', touch1p: 'тач — 1 игрок', language: 'Язык', theme: 'Тема', sound: 'Звук', on: 'вкл', off: 'выкл',
      score: 'Очки', level: 'Трасса', best: 'Рекорд', win: 'ЧЕМПИОН!', gameover: 'ЧЕМПИОНАТ ОКОНЧЕН',
      pause: 'ПАУЗА', resume: 'Продолжить', menu: 'В меню', tapstart: 'пробел / тап',
      title: 'ЮЗ', subtitle: 'Гонки на мини-машинках · 8 трасс-комнат · 1–2 игрока',
      back: 'Каталог',
      p1: 'И1', p2: 'И2', bot_pin: 'Шпилька', bot_bun: 'Бублик',
      track: 'Трасса', lap: 'Круг', place: 'Место', pts: 'очк.', total: 'Всего', wins: 'побед',
      go: 'СТАРТ!', finish: 'ФИНИШ!', out: 'ВЫБЫЛ', outWarn: 'ОТСТАЁШЬ!', lastLap: 'ПОСЛЕДНИЙ КРУГ', lapN: 'КРУГ',
      results: 'ИТОГИ ЗАЕЗДА', standings: 'ЧЕМПИОНАТ', next: 'Дальше — Enter / тап', final: 'Итог — Enter / тап',
      champPlace: 'Итоговое место', placeN: '-е', dnf: 'выбыл',
      pk_boost: 'ТУРБО', pk_shield: 'ЩИТ',
      room_desk: 'Стол мастерской', room_bench: 'Верстак', room_kitchen: 'Кухня', room_garden: 'Сад',
      tr_warmup: 'Разминка', tr_shavings: 'Стружка', tr_tablecloth: 'Скатерть', tr_path: 'Тропинка',
      tr_vise: 'Тиски', tr_plane: 'Рубанок', tr_freezer: 'Морозилка', tr_flowerbed: 'Клумбы',
      hint1: 'И1: ← → — руль, ↑ — газ, ↓ — тормоз/назад, / или пр. Shift — занос',
      hint2: 'И2: A D — руль, W — газ, S — тормоз, F или лев. Shift — занос · 1/2 — игроки',
      foot: '<b>ЮЗ</b> · И1: ← → руль, ↑ газ, ↓ тормоз, / — занос · И2: A D руль, W газ, S тормоз, F — занос · 1/2 на заставке — игроки · P/Esc пауза · L язык, T тема, M звук. Тач — только И1.'
    },
    en: {
      play: 'Play', players: 'Players', touch1p: 'touch — 1 player', language: 'Language', theme: 'Theme', sound: 'Sound', on: 'on', off: 'off',
      score: 'Score', level: 'Track', best: 'Best', win: 'CHAMPION!', gameover: 'CHAMPIONSHIP OVER',
      pause: 'PAUSE', resume: 'Resume', menu: 'Menu', tapstart: 'space / tap',
      title: 'YUZ', subtitle: 'Micro-car racing · 8 room tracks · 1–2 players',
      back: 'Catalog',
      p1: 'P1', p2: 'P2', bot_pin: 'Pinpoint', bot_bun: 'Bagel',
      track: 'Track', lap: 'Lap', place: 'Place', pts: 'pts', total: 'Total', wins: 'wins',
      go: 'GO!', finish: 'FINISH!', out: 'OUT', outWarn: 'FALLING BEHIND!', lastLap: 'FINAL LAP', lapN: 'LAP',
      results: 'RACE RESULTS', standings: 'CHAMPIONSHIP', next: 'Next — Enter / tap', final: 'Final — Enter / tap',
      champPlace: 'Final place', placeN: '', dnf: 'out',
      pk_boost: 'TURBO', pk_shield: 'SHIELD',
      room_desk: 'Workshop desk', room_bench: 'Workbench', room_kitchen: 'Kitchen', room_garden: 'Garden',
      tr_warmup: 'Warm-up', tr_shavings: 'Shavings', tr_tablecloth: 'Tablecloth', tr_path: 'Garden Path',
      tr_vise: 'The Vise', tr_plane: 'The Plane', tr_freezer: 'Freezer', tr_flowerbed: 'Flowerbeds',
      hint1: 'P1: ← → — steer, ↑ — gas, ↓ — brake/reverse, / or right Shift — drift',
      hint2: 'P2: A D — steer, W — gas, S — brake, F or left Shift — drift · 1/2 — players',
      foot: '<b>YUZ</b> · P1: ← → steer, ↑ gas, ↓ brake, / — drift · P2: A D steer, W gas, S brake, F — drift · 1/2 on the title — players · P/Esc pause · L language, T theme, M sound. Touch — P1 only.'
    }
  };
  // порядковое место: RU «1-е», EN «1st»
  Y.ordinal = function (lang, n) {
    if (lang === 'ru') return n + '-е';
    var s = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };
})(typeof window !== 'undefined' ? window : globalThis);
