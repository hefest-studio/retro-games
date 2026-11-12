/* РОЙ · i18n (RU/EN). ROY.STR — таблицы для Arcade.createGame({strings}).
   Ключи движка (play/language/…) + строки игры. Рендеры берут текст только через g.t(). */
(function (global) {
  'use strict';
  var R = global.ROY = global.ROY || {};
  R.STR = {
    ru: {
      play: 'Играть', language: 'Язык', theme: 'Тема', sound: 'Звук', on: 'вкл', off: 'выкл',
      score: 'Счёт', level: 'Волна', best: 'Рекорд', win: 'РОЙ РАЗБИТ!', gameover: 'КОНЕЦ ИГРЫ',
      pause: 'ПАУЗА', resume: 'Продолжить', menu: 'В меню', tapstart: 'пробел / тап',
      title: 'РОЙ', subtitle: 'Отбейся от роя · 5 волн',
      wave: 'ВОЛНА', ready: 'ГОТОВЬСЯ!', cleared: 'ВОЛНА ОТБИТА', final: 'ПОСЛЕДНЯЯ ВОЛНА ОТБИТА!',
      captured: 'КОРАБЛЬ ЗАХВАЧЕН!', twin: 'ДВОЙНОЙ КОРАБЛЬ!', lives: 'Корабли',
      spore: 'Спора', wedge: 'Клин', medusa: 'Медуза', inDive: 'в пике',
      hintMedusa: 'Медуза тянет корабль лучом — собей её в полёте и верни его',
      controls: '← → движение · Пробел огонь · P пауза',
      back: 'Каталог',
      foot: '<b>РОЙ</b> · ← → / A D — движение, Пробел / ● — огонь, P — пауза · L язык, T тема, M звук.'
    },
    en: {
      play: 'Play', language: 'Language', theme: 'Theme', sound: 'Sound', on: 'on', off: 'off',
      score: 'Score', level: 'Wave', best: 'Best', win: 'SWARM DEFEATED!', gameover: 'GAME OVER',
      pause: 'PAUSE', resume: 'Resume', menu: 'Menu', tapstart: 'space / tap',
      title: 'SWARM', subtitle: 'Hold off the swarm · 5 waves',
      wave: 'WAVE', ready: 'GET READY!', cleared: 'WAVE CLEARED', final: 'FINAL WAVE CLEARED!',
      captured: 'SHIP CAPTURED!', twin: 'TWIN SHIP!', lives: 'Ships',
      spore: 'Spore', wedge: 'Wedge', medusa: 'Medusa', inDive: 'diving',
      hintMedusa: 'Medusa beams your ship up — shoot her in flight to get it back',
      controls: '← → move · Space fire · P pause',
      back: 'Catalog',
      foot: '<b>SWARM</b> · ← → / A D — move, Space / ● — fire, P — pause · L language, T theme, M sound.'
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
