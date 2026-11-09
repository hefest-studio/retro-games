/* ЗВЕРО-ОТРЯД 2 · i18n (RU/EN). Z.i18n / Z.t — локализация всего UI. */
(function (global) {
  'use strict';
  var Z = global.ZVERO2 = global.ZVERO2 || {};

  // Строки интерфейса. Рендереры и main.js берут текст только через Z.t().
  var STR = {
    ru: {
      title: 'ЗВЕРО-ОТРЯД 2', sub: 'НОВЫЕ УРОВНИ',
      tagline: 'Пыж и Тяпа спускаются в Ледяные Погреба. Те же лапы, те же ящики — новые холодные уровни!',
      start: 'НАЧАТЬ', how: 'КАК ИГРАТЬ', back: 'Каталог',
      gfx: 'ГРАФИКА', snd: 'ЗВУК', on: 'ВКЛ', off: 'ВЫКЛ', retro: '8-БИТ', modern: 'НЕОН',
      mode: 'ИГРОКИ', onep: '1', twop: '2',
      pause: 'ПАУЗА', resume: 'ПРОДОЛЖИТЬ',
      over: 'ОТРЯД ЗАМЁРЗ', again: 'ЕЩЁ РАЗ',
      win: 'ПОГРЕБА ОЧИЩЕНЫ!', winSub: 'Пыж и Тяпа растопили последний лёд и спасли друзей.',
      score: 'ОЧКИ', best: 'РЕКОРД', lives: 'ЖИЗНИ', level: 'ПОГРЕБ',
      ready: 'ПОГРЕБ', go: 'ВПЕРЁД!', clear: 'ПОГРЕБ ОЧИЩЕН', boss: 'БОСС: ЖАБА КВАК',
      p1: 'ПЫЖ', p2: 'ТЯПА',
      help: [
        'Игрок 1 (ПЫЖ): ← → бег · ↑ прыжок · Пробел — схватить/бросить',
        'Игрок 2 (ТЯПА): A D бег · W прыжок · Shift — схватить/бросить',
        'Хватай ледяной ящик и швыряй — он крошит врага',
        'На ящик можно встать как на платформу',
        'Собирай друзей-снежинки, доберись до двери ПОГРЕБА',
        'Последний погреб — жаба КВАК: закидай её ящиками',
        'G — графика · M — звук · L — язык · P — пауза · C — 1/2 игрока'
      ]
    },
    en: {
      title: 'ZVERO-OTRYAD 2', sub: 'NEW LEVELS',
      tagline: 'Pyzh and Tyapa descend into the Frozen Cellars. Same paws, same crates — chilly new levels!',
      start: 'START', how: 'HOW TO PLAY', back: 'Catalog',
      gfx: 'GRAPHICS', snd: 'SOUND', on: 'ON', off: 'OFF', retro: '8-BIT', modern: 'NEON',
      mode: 'PLAYERS', onep: '1', twop: '2',
      pause: 'PAUSE', resume: 'RESUME',
      over: 'SQUAD FROZEN', again: 'PLAY AGAIN',
      win: 'CELLARS CLEARED!', winSub: 'Pyzh and Tyapa melted the last ice and saved their friends.',
      score: 'SCORE', best: 'BEST', lives: 'LIVES', level: 'CELLAR',
      ready: 'CELLAR', go: 'GO!', clear: 'CELLAR CLEARED', boss: 'BOSS: KVAK THE TOAD',
      p1: 'PYZH', p2: 'TYAPA',
      help: [
        'Player 1 (PYZH): ← → run · ↑ jump · Space — grab/throw',
        'Player 2 (TYAPA): A D run · W jump · Shift — grab/throw',
        'Grab an ice crate and hurl it — it shatters a foe',
        'Stand on a crate like a platform',
        'Collect snowflake friends, reach the CELLAR door',
        'Final cellar is a boss: bury KVAK in crates',
        'G — graphics · M — sound · L — language · P — pause · C — 1/2 players'
      ]
    }
  };

  Z.i18n = { lang: 'ru', strings: STR };
  Z.t = function (k) { return (STR[Z.i18n.lang] || STR.ru)[k]; };
})(typeof window !== 'undefined' ? window : globalThis);
