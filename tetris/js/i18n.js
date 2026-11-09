/* TETRIS · i18n (RU/EN). TT.i18n / TT.t */
(function (global) {
  'use strict';
  var TT = global.TT = global.TT || {};
  var STR = {
    ru: {
      sub: 'КАСКАД', tagline: 'Складывай линии. Не дай стакану переполниться.',
      start: 'НАЧАТЬ', how: 'КАК ИГРАТЬ', back: 'Каталог',
      score: 'ОЧКИ', lines: 'ЛИНИИ', level: 'УРОВЕНЬ', best: 'РЕКОРД', next: 'ДАЛЕЕ', hold: 'ЗАПАС',
      pause: 'ПАУЗА', resume: 'ПРОДОЛЖИТЬ', over: 'ИГРА ОКОНЧЕНА', again: 'ЕЩЁ РАЗ',
      gfx: 'ГРАФИКА', snd: 'ЗВУК', on: 'ВКЛ', off: 'ВЫКЛ', retro: '8-БИТ', modern: 'НЕОН',
      help: ['← → — двигать', '↑ / X — поворот', '↓ — мягкий сброс', 'Пробел — жёсткий сброс', 'C / Shift — запас', 'P — пауза']
    },
    en: {
      sub: 'CASCADE', tagline: 'Stack the lines. Don’t let the well overflow.',
      start: 'START', how: 'HOW TO PLAY', back: 'Catalog',
      score: 'SCORE', lines: 'LINES', level: 'LEVEL', best: 'BEST', next: 'NEXT', hold: 'HOLD',
      pause: 'PAUSE', resume: 'RESUME', over: 'GAME OVER', again: 'PLAY AGAIN',
      gfx: 'GRAPHICS', snd: 'SOUND', on: 'ON', off: 'OFF', retro: '8-BIT', modern: 'NEON',
      help: ['← → — move', '↑ / X — rotate', '↓ — soft drop', 'Space — hard drop', 'C / Shift — hold', 'P — pause']
    }
  };
  TT.i18n = { lang: 'ru', strings: STR };
  TT.t = function (k) { return (STR[TT.i18n.lang] || STR.ru)[k]; };
})(typeof window !== 'undefined' ? window : globalThis);
