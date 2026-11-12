/* РАЗРЕЗ · i18n (RU/EN). RAZREZ.STR — таблицы для Arcade.createGame({strings}).
   Ключи play/language/theme/... нужны стандартным экранам движка. */
(function (global) {
  'use strict';
  var R = global.RAZREZ = global.RAZREZ || {};
  R.STR = {
    ru: {
      play: 'Играть', language: 'Язык', theme: 'Тема', sound: 'Звук', on: 'вкл', off: 'выкл',
      score: 'Счёт', level: 'Ур.', best: 'Рекорд', win: 'ПОЛЕ РАЗРЕЗАНО!', gameover: 'РЕЗЕЦ СЛОМАН',
      pause: 'ПАУЗА', resume: 'Продолжить', menu: 'В меню', tapstart: 'пробел / тап',
      title: 'РАЗРЕЗ', subtitle: 'Отрежь 75% поля · 5 уровней',
      back: 'Каталог', captured: 'Захват', goal: 'цель', lives: 'Жизни',
      ready: 'УРОВЕНЬ', readySub: 'Отрежь 75% поля. Шары не должны задеть след.',
      clear: 'УРОВЕНЬ ПРОЙДЕН', bonus: 'Бонус', lost: 'СЛЕД ПЕРЕРЕЗАН',
      hint: 'Стрелки/WASD: ход · P: пауза · T: тема · L: язык · M: звук',
      foot: 'Уходи с суши в поле и возвращайся — отрезанная часть без шаров станет твоей. Шары рвут след, клещи ползают по суше.'
    },
    en: {
      play: 'Play', language: 'Language', theme: 'Theme', sound: 'Sound', on: 'on', off: 'off',
      score: 'Score', level: 'Lvl', best: 'Best', win: 'FIELD CUT!', gameover: 'CUTTER BROKEN',
      pause: 'PAUSE', resume: 'Resume', menu: 'Menu', tapstart: 'space / tap',
      title: 'RAZREZ', subtitle: 'Cut off 75% of the field · 5 levels',
      back: 'Catalog', captured: 'Claimed', goal: 'goal', lives: 'Lives',
      ready: 'LEVEL', readySub: 'Claim 75% of the field. Keep orbs off your trail.',
      clear: 'LEVEL CLEAR', bonus: 'Bonus', lost: 'TRAIL CUT',
      hint: 'Arrows/WASD: move · P: pause · T: theme · L: language · M: sound',
      foot: 'Leave the land, cross the field and come back — every orb-free part you cut off is yours. Orbs break the trail, mites crawl the land.'
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
