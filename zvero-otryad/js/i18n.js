/* ЗВЕРО-ОТРЯД · i18n (RU/EN). Z.i18n / Z.t — локализация всего UI. */
(function (global) {
  'use strict';
  var Z = global.ZVERO = global.ZVERO || {};

  // Строки интерфейса. Рендереры и main.js берут текст только через Z.t().
  var STR = {
    ru: {
      title: 'ЗВЕРО-ОТРЯД', sub: 'СТАРАЯ МАСТЕРСКАЯ',
      tagline: 'Ёж Пыж и заяц Тяпа расчищают Старую Мастерскую. Хватай ящики — и швыряй во врагов!',
      start: 'НАЧАТЬ', how: 'КАК ИГРАТЬ', back: 'Каталог',
      gfx: 'ГРАФИКА', snd: 'ЗВУК', on: 'ВКЛ', off: 'ВЫКЛ', retro: '8-БИТ', modern: 'НЕОН',
      mode: 'ИГРОКИ', onep: '1', twop: '2',
      pause: 'ПАУЗА', resume: 'ПРОДОЛЖИТЬ',
      over: 'ОТРЯД ПОВЕРЖЕН', again: 'ЕЩЁ РАЗ',
      win: 'МАСТЕРСКАЯ СПАСЕНА!', winSub: 'Пыж и Тяпа вывели всех друзей наружу.',
      score: 'ОЧКИ', best: 'РЕКОРД', lives: 'ЖИЗНИ', level: 'ЦЕХ',
      ready: 'ЦЕХ', go: 'ВПЕРЁД!', clear: 'ЦЕХ РАСЧИЩЕН', boss: 'БОСС: КРЫС БАК',
      p1: 'ПЫЖ', p2: 'ТЯПА',
      help: [
        'Игрок 1 (ПЫЖ): ← → бег · ↑ прыжок · Пробел — схватить/бросить',
        'Игрок 2 (ТЯПА): A D бег · W прыжок · Shift — схватить/бросить',
        'Подбери ящик и швырни во врага — он разлетается',
        'На ящик можно встать как на платформу',
        'Собирай игрушки-друзья (звёзды), доберись до двери ЦЕХА',
        'Последний цех — босс: закидай его ящиками',
        'G — графика · M — звук · L — язык · P — пауза · C — 1/2 игрока'
      ]
    },
    en: {
      title: 'ZVERO-OTRYAD', sub: 'OLD WORKSHOP',
      tagline: 'Pyzh the hedgehog and Tyapa the hare clear the Old Workshop. Grab crates and hurl them at foes!',
      start: 'START', how: 'HOW TO PLAY', back: 'Catalog',
      gfx: 'GRAPHICS', snd: 'SOUND', on: 'ON', off: 'OFF', retro: '8-BIT', modern: 'NEON',
      mode: 'PLAYERS', onep: '1', twop: '2',
      pause: 'PAUSE', resume: 'RESUME',
      over: 'SQUAD DOWN', again: 'PLAY AGAIN',
      win: 'WORKSHOP SAVED!', winSub: 'Pyzh and Tyapa led every friend to safety.',
      score: 'SCORE', best: 'BEST', lives: 'LIVES', level: 'BAY',
      ready: 'BAY', go: 'GO!', clear: 'BAY CLEARED', boss: 'BOSS: BAK THE RAT',
      p1: 'PYZH', p2: 'TYAPA',
      help: [
        'Player 1 (PYZH): ← → run · ↑ jump · Space — grab/throw',
        'Player 2 (TYAPA): A D run · W jump · Shift — grab/throw',
        'Pick up a crate and hurl it at a foe — it smashes',
        'Stand on a crate like a platform',
        'Collect toy friends (stars), reach the BAY door',
        'Final bay is a boss: bury him in crates',
        'G — graphics · M — sound · L — language · P — pause · C — 1/2 players'
      ]
    }
  };

  Z.i18n = { lang: 'ru', strings: STR };
  Z.t = function (k) { return (STR[Z.i18n.lang] || STR.ru)[k]; };
})(typeof window !== 'undefined' ? window : globalThis);
