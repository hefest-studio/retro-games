/* КОЛОБОК · i18n (RU/EN). K.i18n / K.t — локализация всего UI. */
(function (global) {
  'use strict';
  var K = global.KOLOBOK = global.KOLOBOK || {};

  // Строки интерфейса. Рендереры и main.js берут текст только через K.t().
  var STR = {
    ru: {
      title: 'КОЛОБОК', sub: 'ПРИКЛЮЧЕНИЕ',
      tagline: 'Колобок укатился от бабушки и деда в лес. Собери все ягоды и найди дорогу домой.',
      start: 'НАЧАТЬ', how: 'КАК ИГРАТЬ', back: 'Каталог',
      gfx: 'ГРАФИКА', snd: 'ЗВУК', on: 'ВКЛ', off: 'ВЫКЛ', retro: '8-БИТ', modern: 'НЕОН',
      pause: 'ПАУЗА', resume: 'ПРОДОЛЖИТЬ',
      over: 'КОЛОБОК ПРОПАЛ', again: 'ЕЩЁ РАЗ',
      win: 'КОЛОБОК ДОМА!', winSub: 'Все ягоды собраны — дорога домой найдена.',
      score: 'ОЧКИ', best: 'РЕКОРД', lives: 'ЖИЗНИ', berries: 'ЯГОДЫ', room: 'ПОЛЯНА', bag: 'СУМКА',
      ready: 'ПОЛЯНА', go: 'ВПЕРЁД!', needberries: 'СНАЧАЛА ВСЕ ЯГОДЫ',
      key: 'КЛЮЧ', plank: 'ДОСКА', bucket: 'ВЕДРО',
      help: [
        '← → / A D — катиться',
        'Пробел / ↑ / W — прыжок',
        'E / ↓ — применить предмет',
        'Ключ открывает калитку',
        'Доской перекрой речку',
        'Ведром залей костёр',
        'Собери все ягоды и дойди до дома',
        'G — графика · M — звук · P — пауза'
      ]
    },
    en: {
      title: 'KOLOBOK', sub: 'ADVENTURE',
      tagline: 'Kolobok rolled off from grandma and grandpa into the forest. Gather every berry and find the way home.',
      start: 'START', how: 'HOW TO PLAY', back: 'Catalog',
      gfx: 'GRAPHICS', snd: 'SOUND', on: 'ON', off: 'OFF', retro: '8-BIT', modern: 'NEON',
      pause: 'PAUSE', resume: 'RESUME',
      over: 'KOLOBOK IS LOST', again: 'PLAY AGAIN',
      win: 'KOLOBOK IS HOME!', winSub: 'Every berry gathered — the way home is found.',
      score: 'SCORE', best: 'BEST', lives: 'LIVES', berries: 'BERRIES', room: 'GLADE', bag: 'BAG',
      ready: 'GLADE', go: 'GO!', needberries: 'GATHER ALL BERRIES FIRST',
      key: 'KEY', plank: 'PLANK', bucket: 'BUCKET',
      help: [
        '← → / A D — roll',
        'Space / ↑ / W — jump',
        'E / ↓ — use item',
        'Key opens the gate',
        'Bridge the river with a plank',
        'Douse the campfire with a bucket',
        'Gather all berries and reach home',
        'G — graphics · M — sound · P — pause'
      ]
    }
  };

  K.i18n = { lang: 'ru', strings: STR };
  K.t = function (k) { return (STR[K.i18n.lang] || STR.ru)[k]; };
})(typeof window !== 'undefined' ? window : globalThis);
