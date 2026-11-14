/* МАЯЧНИЦА · i18n (RU/EN) — только меню и страница: в самой игре текста нет (мысли-пиктограммы, жесты). */
(function (global) {
  'use strict';
  var K = global.KVEST = global.KVEST || {};
  K.STR = {
    ru: {
      play: 'Новая игра', language: 'Язык', theme: 'Тема', sound: 'Звук', on: 'вкл', off: 'выкл',
      score: 'Найдено', level: 'Глава', best: 'Лучшее', win: 'МАЯК ГОРИТ', gameover: 'КОНЕЦ', pause: 'ПАУЗА',
      resume: 'Продолжить', menu: 'В меню', tapstart: 'пробел / тап — в меню', cont: 'Продолжить', back: 'Каталог',
      walk: 'Прохождение-набросок', restart: 'Начать главу заново',
      title: 'МАЯЧНИЦА', subtitle: 'Рисованное приключение без слов', sub2: 'Глава 1 · Погасший маяк',
      winSub: 'Лодки нашли дорогу домой сквозь туман', solved: 'Головоломок решено',
      hint: 'клик — идти и действовать · долгий тап / ПКМ — осмотреть · H подсказка · B набросок · P пауза',
      foot: '<b>МАЯЧНИЦА</b> · клик / тап — идти и взаимодействовать (героиня подходит сама) · долгий тап / правая кнопка — осмотреть · предмет из сумки — тап по нему, затем по цели (или перетащить); на другой предмет — соединить · лампочка / H — подсказка-мысль · книжка / B — прохождение-набросок · P / Esc — пауза · L язык, M звук · D — отладка макета.'
    },
    en: {
      play: 'New game', language: 'Language', theme: 'Theme', sound: 'Sound', on: 'on', off: 'off',
      score: 'Found', level: 'Chapter', best: 'Best', win: 'THE LIGHT IS ON', gameover: 'THE END', pause: 'PAUSE',
      resume: 'Resume', menu: 'Menu', tapstart: 'space / tap — menu', cont: 'Continue', back: 'Catalog',
      walk: 'Sketch walkthrough', restart: 'Restart chapter',
      title: 'MAYACHNITSA', subtitle: 'A wordless hand-drawn adventure', sub2: 'Chapter 1 · The Dark Lighthouse',
      winSub: 'The boats found their way home through the fog', solved: 'Puzzles solved',
      hint: 'click — walk & act · long tap / RMB — look · H hint · B sketch · P pause',
      foot: '<b>MAYACHNITSA</b> · click / tap — walk and interact (she walks up by herself) · long tap / right click — look · item from the bag — tap it, then the target (or drag); onto another item — combine · bulb / H — hint thought · book / B — sketch walkthrough · P / Esc — pause · L language, M sound · D — greybox debug.'
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
