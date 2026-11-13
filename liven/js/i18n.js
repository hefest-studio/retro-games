/* ЛИВЕНЬ · i18n (RU/EN). LIVEN.STR — таблицы для Arcade.createGame({strings}).
   Ключи play/language/theme/... нужны стандартным экранам движка; остальные — игре. Имена этапов, боссов и перезвонов — в stages.js/patterns.js. */
(function (global) {
  'use strict';
  var LV = global.LIVEN = global.LIVEN || {};
  LV.STR = {
    ru: {
      play: 'Играть', language: 'Язык', theme: 'Тема', sound: 'Звук', on: 'вкл', off: 'выкл',
      score: 'Счёт', level: 'Этап', best: 'Рекорд', lives: 'Жизни', bombs: 'Разряды',
      win: 'НАБАТ УМОЛК!', gameover: 'ЧЕЛНОК ПОГАС',
      pause: 'ПАУЗА', resume: 'Продолжить', menu: 'В меню', tapstart: 'пробел / тап',
      title: 'ЛИВЕНЬ', subtitle: 'Искра-челнок мастерской «Гефест» сквозь ливень заклёпок Звонарей',
      sub2: 'Пулевой ад · 5 этапов · 27 перезвонов · фокус, грейз, искры-множитель',
      back: 'Каталог', diff: 'Сложность', form: 'Форма',
      d_easy: 'Лёгкий', d_normal: 'Норма', d_hard: 'Трудный',
      f_fan: 'Веер', f_blade: 'Клинок',
      fdesc_fan: 'широкий огонь', fdesc_blade: 'узкий и мощный',
      graze: 'Грейз', mult: 'Множитель', sparks: 'Искры', stage: 'Этап', conts: 'Продолжений',
      bonus: 'Бонус', card: 'Перезвон', lost: '—', cardGet: 'ПЕРЕЗВОН ВЫДЕРЖАН!', cardFail: 'Пройден без бонуса', cardTime: 'Время вышло',
      warning: 'ВНИМАНИЕ', midboss: 'подручный Звонаря', bossCome: 'Звонарь',
      clear: 'ЭТАП ПРОЙДЕН', clearSub: 'бонус', extend: '+ЖИЗНЬ', bombName: 'Разряд!',
      contQ: 'ПРОДОЛЖИТЬ?', contHint: 'Пробел / тап — да · X — нет', contLeft: 'Осталось продолжений',
      hintKeys: 'Стрелки/WASD — полёт\nShift/Z — фокус · X/пробел — разряд\nP — пауза · T тема · L язык · M звук',
      hintTouch: 'Палец — полёт (относительно)\nФОКУС и РАЗРЯД — кнопки внизу\nВторой палец — разряд',
      endLine: 'Грейз {g} · Макс. множитель ×{c} · Перезвонов выдержано {k}',
      foot: '<b>ЛИВЕНЬ</b> · стрелки / WASD — полёт · Shift или Z — фокус (медленнее, плотный огонь, видна точка-хитбокс) · X или пробел — разряд · огонь автоматический · палец — относительное перемещение · P / Esc — пауза · L язык, T тема, M звук.'
    },
    en: {
      play: 'Play', language: 'Language', theme: 'Theme', sound: 'Sound', on: 'on', off: 'off',
      score: 'Score', level: 'Stage', best: 'Best', lives: 'Lives', bombs: 'Discharges',
      win: 'THE TOCSIN FALLS SILENT!', gameover: 'THE SHUTTLE IS OUT',
      pause: 'PAUSE', resume: 'Resume', menu: 'Menu', tapstart: 'space / tap',
      title: 'LIVEN', subtitle: 'A Hefest workshop spark-shuttle through the Ringers\' rivet rain',
      sub2: 'Bullet hell · 5 stages · 27 peals · focus, graze, spark multiplier',
      back: 'Catalog', diff: 'Difficulty', form: 'Form',
      d_easy: 'Easy', d_normal: 'Normal', d_hard: 'Hard',
      f_fan: 'Fan', f_blade: 'Blade',
      fdesc_fan: 'wide fire', fdesc_blade: 'narrow & strong',
      graze: 'Graze', mult: 'Multiplier', sparks: 'Sparks', stage: 'Stage', conts: 'Continues',
      bonus: 'Bonus', card: 'Peal', lost: '—', cardGet: 'PEAL ENDURED!', cardFail: 'Passed, no bonus', cardTime: 'Time is up',
      warning: 'WARNING', midboss: 'a Ringer\'s helper', bossCome: 'Ringer',
      clear: 'STAGE CLEAR', clearSub: 'bonus', extend: '+LIFE', bombName: 'Discharge!',
      contQ: 'CONTINUE?', contHint: 'Space / tap — yes · X — no', contLeft: 'Continues left',
      hintKeys: 'Arrows/WASD — fly\nShift/Z — focus · X/Space — discharge\nP pause · T theme · L language · M sound',
      hintTouch: 'Finger — fly (relative)\nFOCUS and DISCHARGE — buttons below\nSecond finger — discharge',
      endLine: 'Graze {g} · Max multiplier ×{c} · Peals endured {k}',
      foot: '<b>LIVEN</b> · arrows / WASD — fly · Shift or Z — focus (slower, dense fire, visible hitbox dot) · X or Space — discharge · auto-fire · finger — relative movement · P / Esc — pause · L language, T theme, M sound.'
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
