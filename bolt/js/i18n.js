/* БОЛТ · i18n (RU/EN). B.i18n / B.t — локализация всего UI. */
(function (global) {
  'use strict';
  var B = global.BOLT = global.BOLT || {};

  // Строки интерфейса. Рендереры и main.js берут текст только через B.t().
  var STR = {
    ru: {
      title: 'БОЛТ', sub: 'ПОБЕГ СО ШЛАК-9',
      tagline: 'Робот-наёмник застрял на планете Шлак-9. Пробейся к выходу.',
      start: 'НАЧАТЬ', how: 'КАК ИГРАТЬ', back: 'Каталог',
      gfx: 'ГРАФИКА', snd: 'ЗВУК', on: 'ВКЛ', off: 'ВЫКЛ', retro: '8-БИТ', modern: 'НЕОН',
      pause: 'ПАУЗА', resume: 'ПРОДОЛЖИТЬ',
      over: 'СИСТЕМА ОТКАЗАЛА', again: 'ЕЩЁ РАЗ',
      win: 'ПОБЕГ УДАЛСЯ!', winSub: 'БОЛТ покинул Шлак-9.',
      score: 'ОЧКИ', best: 'РЕКОРД', lives: 'ЖИЗНИ', level: 'СЕКТОР', charge: 'ЗАРЯД',
      ready: 'СЕКТОР', go: 'ВПЕРЁД!', clear: 'СЕКТОР ПРОЙДЕН',
      help: [
        '← → / A D — бежать',
        'Пробел / ↑ / W — прыжок',
        'J / X — стрелять',
        'Добеги до двери выхода',
        'Батареи пополняют заряд',
        'G — графика · M — звук · P — пауза'
      ]
    },
    en: {
      title: 'BOLT', sub: 'ESCAPE FROM SLAG-9',
      tagline: 'A mercenary robot is stranded on planet Slag-9. Blast your way to the exit.',
      start: 'START', how: 'HOW TO PLAY', back: 'Catalog',
      gfx: 'GRAPHICS', snd: 'SOUND', on: 'ON', off: 'OFF', retro: '8-BIT', modern: 'NEON',
      pause: 'PAUSE', resume: 'RESUME',
      over: 'SYSTEM FAILURE', again: 'PLAY AGAIN',
      win: 'ESCAPE COMPLETE!', winSub: 'BOLT has left Slag-9.',
      score: 'SCORE', best: 'BEST', lives: 'LIVES', level: 'SECTOR', charge: 'POWER',
      ready: 'SECTOR', go: 'GO!', clear: 'SECTOR CLEAR',
      help: [
        '← → / A D — run',
        'Space / ↑ / W — jump',
        'J / X — shoot',
        'Reach the exit door',
        'Batteries refill power',
        'G — graphics · M — sound · P — pause'
      ]
    }
  };

  B.i18n = { lang: 'ru', strings: STR };
  B.t = function (k) { return (STR[B.i18n.lang] || STR.ru)[k]; };
})(typeof window !== 'undefined' ? window : globalThis);
