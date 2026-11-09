/* PAC-MAN · i18n (RU/EN). PM.i18n / PM.t */
(function (global) {
  'use strict';
  var PM = global.PM = global.PM || {};
  var STR = {
    ru: {
      sub: 'ЛАБИРИНТ', tagline: 'Собери все точки, уворачивайся от призраков, лови энергетики.',
      start: 'НАЧАТЬ', how: 'КАК ИГРАТЬ', back: 'Каталог',
      score: 'ОЧКИ', best: 'РЕКОРД', level: 'УРОВЕНЬ', lives: 'ЖИЗНИ',
      ready: 'ГОТОВ!', over: 'ИГРА ОКОНЧЕНА', again: 'ЕЩЁ РАЗ', pause: 'ПАУЗА', resume: 'ПРОДОЛЖИТЬ',
      gfx: 'ГРАФИКА', snd: 'ЗВУК', on: 'ВКЛ', off: 'ВЫКЛ', retro: '8-БИТ', modern: 'НЕОН',
      help: ['← ↑ ↓ → или WASD — движение', 'Собери все точки на уровне', 'Энергетик — призраки пугаются, их можно съесть', 'P — пауза · G — графика · M — звук · L — язык']
    },
    en: {
      sub: 'MAZE', tagline: 'Eat every dot, dodge the ghosts, grab the energizers.',
      start: 'START', how: 'HOW TO PLAY', back: 'Catalog',
      score: 'SCORE', best: 'BEST', level: 'LEVEL', lives: 'LIVES',
      ready: 'READY!', over: 'GAME OVER', again: 'PLAY AGAIN', pause: 'PAUSE', resume: 'RESUME',
      gfx: 'GRAPHICS', snd: 'SOUND', on: 'ON', off: 'OFF', retro: '8-BIT', modern: 'NEON',
      help: ['← ↑ ↓ → or WASD — move', 'Eat every dot to clear the level', 'Energizer — ghosts turn blue and edible', 'P — pause · G — graphics · M — sound · L — language']
    }
  };
  PM.i18n = { lang: 'ru', strings: STR };
  PM.t = function (k) { return (STR[PM.i18n.lang] || STR.ru)[k]; };
})(typeof window !== 'undefined' ? window : globalThis);
