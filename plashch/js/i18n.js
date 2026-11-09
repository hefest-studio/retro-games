/* ПЛАЩ · i18n (RU/EN). P.i18n / P.t — локализация всего UI. */
(function (global) {
  'use strict';
  var P = global.PLASHCH = global.PLASHCH || {};

  // Строки интерфейса. Рендереры и main.js берут текст только через P.t().
  var STR = {
    ru: {
      title: 'ПЛАЩ', sub: 'НОЧНОЙ МСТИТЕЛЬ',
      tagline: 'Ночной мститель Плащ вышел на охоту. Зачисти Чёрный квартал до рассвета.',
      start: 'НАЧАТЬ', how: 'КАК ИГРАТЬ', back: 'Каталог',
      gfx: 'ГРАФИКА', snd: 'ЗВУК', on: 'ВКЛ', off: 'ВЫКЛ', retro: '8-БИТ', modern: 'НЕОН',
      pause: 'ПАУЗА', resume: 'ПРОДОЛЖИТЬ',
      over: 'ПЛАЩ ПАЛ', again: 'ЕЩЁ РАЗ',
      win: 'КВАРТАЛ ЗАЧИЩЕН!', winSub: 'Плащ одолел Барона. Город может спать.',
      score: 'ОЧКИ', best: 'РЕКОРД', lives: 'ЖИЗНИ', level: 'КВАРТАЛ', hp: 'ЗДОРОВЬЕ',
      ready: 'КВАРТАЛ', go: 'НА ОХОТУ!', clear: 'КВАРТАЛ ЧИСТ', boss: 'БАРОН',
      help: [
        '← → / A D — бежать',
        '↓ / S — присесть, уклон от пуль',
        'Пробел / ↑ / W — прыжок',
        'J / X — метнуть сюрикен',
        'K / Shift — крюк-кошка: вис и раскачка',
        'Добеги до двери; в финале — Барон'
      ]
    },
    en: {
      title: 'PLASHCH', sub: 'NIGHT AVENGER',
      tagline: 'The night avenger Plashch is on the hunt. Clear the Black Quarter before dawn.',
      start: 'START', how: 'HOW TO PLAY', back: 'Catalog',
      gfx: 'GRAPHICS', snd: 'SOUND', on: 'ON', off: 'OFF', retro: '8-BIT', modern: 'NEON',
      pause: 'PAUSE', resume: 'RESUME',
      over: 'PLASHCH IS DOWN', again: 'PLAY AGAIN',
      win: 'QUARTER CLEARED!', winSub: 'Plashch has beaten the Baron. The city can sleep.',
      score: 'SCORE', best: 'BEST', lives: 'LIVES', level: 'QUARTER', hp: 'HEALTH',
      ready: 'QUARTER', go: 'ON THE HUNT!', clear: 'QUARTER CLEAR', boss: 'THE BARON',
      help: [
        '← → / A D — run',
        '↓ / S — duck, dodge bullets',
        'Space / ↑ / W — jump',
        'J / X — throw shuriken',
        'K / Shift — grappling hook: hang & swing',
        'Reach the door; the Baron waits at the end'
      ]
    }
  };

  P.i18n = { lang: 'ru', strings: STR };
  P.t = function (k) { return (STR[P.i18n.lang] || STR.ru)[k]; };
})(typeof window !== 'undefined' ? window : globalThis);
