/* РЕДУТ · i18n (RU/EN). R.i18n / R.t — локализация всего UI. */
(function (global) {
  'use strict';
  var R = global.REDUT = global.REDUT || {};

  // Строки интерфейса. Рендереры и main.js берут текст только через R.t().
  var STR = {
    ru: {
      title: 'РЕДУТ', sub: 'ОБОРОНА БАЗЫ',
      tagline: 'Враг идёт на твой редут. Удержи базу и перемели все волны танков.',
      start: 'НАЧАТЬ', how: 'КАК ИГРАТЬ', back: 'Каталог',
      gfx: 'ГРАФИКА', snd: 'ЗВУК', players: 'ИГРОКИ',
      on: 'ВКЛ', off: 'ВЫКЛ', retro: '8-БИТ', modern: 'НЕОН',
      mode1: '1 ИГРОК', mode2: '2 ИГРОКА',
      pause: 'ПАУЗА', resume: 'ПРОДОЛЖИТЬ',
      over: 'БАЗА ПАЛА', again: 'ЕЩЁ РАЗ',
      win: 'РУБЕЖ УДЕРЖАН!', winSub: 'Все волны отбиты. Редут выстоял.',
      score: 'ОЧКИ', best: 'РЕКОРД', lives: 'ЖИЗНИ', level: 'ВОЛНА',
      enemies: 'ВРАГИ', base: 'БАЗА', p1: 'И1', p2: 'И2',
      ready: 'ВОЛНА', go: 'В БОЙ!', clear: 'ВОЛНА ОТБИТА',
      hudMove: 'WASD / стрелки — ход', hudFire: 'Пробел — огонь', hudP1: 'И1 WASD+Пробел', hudP2: 'И2 Стрелки+/',
      help: [
        'И1: W A S D — ход, Пробел — огонь',
        'И2: стрелки — ход, / — огонь',
        'Разбивай кирпич, прячься в лесу',
        'Не пропусти врага к базе',
        'Усилители: щит, жизнь, стоп, апгрейд',
        'G — графика · M — звук · P — пауза'
      ]
    },
    en: {
      title: 'REDUT', sub: 'BASE DEFENSE',
      tagline: 'The enemy rolls on your redoubt. Hold the base and grind every tank wave.',
      start: 'START', how: 'HOW TO PLAY', back: 'Catalog',
      gfx: 'GRAPHICS', snd: 'SOUND', players: 'PLAYERS',
      on: 'ON', off: 'OFF', retro: '8-BIT', modern: 'NEON',
      mode1: '1 PLAYER', mode2: '2 PLAYERS',
      pause: 'PAUSE', resume: 'RESUME',
      over: 'BASE DESTROYED', again: 'PLAY AGAIN',
      win: 'LINE HELD!', winSub: 'Every wave repelled. The redoubt stood.',
      score: 'SCORE', best: 'BEST', lives: 'LIVES', level: 'WAVE',
      enemies: 'FOES', base: 'BASE', p1: 'P1', p2: 'P2',
      ready: 'WAVE', go: 'ENGAGE!', clear: 'WAVE CLEARED',
      hudMove: 'WASD / arrows — move', hudFire: 'Space — fire', hudP1: 'P1 WASD+Space', hudP2: 'P2 Arrows+/',
      help: [
        'P1: W A S D — move, Space — fire',
        'P2: arrows — move, / — fire',
        'Blast brick, hide in forest',
        'Never let a tank reach the base',
        'Power-ups: shield, life, freeze, upgrade',
        'G — graphics · M — sound · P — pause'
      ]
    }
  };

  R.i18n = { lang: 'ru', strings: STR };
  R.t = function (k) { return (STR[R.i18n.lang] || STR.ru)[k]; };
})(typeof window !== 'undefined' ? window : globalThis);
