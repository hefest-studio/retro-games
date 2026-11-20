/* ПОЛУУСТАВ · i18n (RU/EN). POLU.STR — таблицы для Arcade.createGame({strings}).
   В самой игре слов нет — только рисунки и пиктограммы; строки нужны меню, паузе, финалу и подписи под канвой. */
(function (global) {
  'use strict';
  var P = global.POLU = global.POLU || {};
  P.STR = {
    ru: {
      play: 'Новая рукопись', cont: 'Продолжить', restart: 'К последней отметке', language: 'Язык', theme: 'Тема', sound: 'Звук', on: 'вкл', off: 'выкл',
      score: 'Оценка', best: 'Рекорд', win: 'КОЛОФОН', gameover: 'КЛЯКСА',
      pause: 'ПАУЗА', resume: 'Продолжить', menu: 'В меню', tapstart: 'пробел / тап',
      title: 'ПОЛУУСТАВ', subtitle: 'Ученик переписчика внутри рукописи',
      hint: '◀▶ / A D — идти · ▲ / W / пробел — прыжок · E / X — действие (держать — тянуть) · P — пауза · T — тема · L — язык',
      foot: 'Тихая сказка без слов: ученик переписчика бредёт по страницам старой рукописи. Ящики, верёвки, рычаги и противовесы, вода и тушь; песок сушит кляксы, перо дорисовывает мосты, наброски твердеют в свете лампады. Смерть — лишь клякса: сразу снова у отметки.',
      blots: 'кляксы', pages: 'страницы'
    },
    en: {
      play: 'New manuscript', cont: 'Continue', restart: 'Back to last mark', language: 'Language', theme: 'Theme', sound: 'Sound', on: 'on', off: 'off',
      score: 'Grade', best: 'Best', win: 'COLOPHON', gameover: 'BLOT',
      pause: 'PAUSE', resume: 'Resume', menu: 'Menu', tapstart: 'space / tap',
      title: 'GALLWICK', subtitle: 'A scribe’s apprentice within the manuscript',
      hint: '◀▶ / A D — walk · ▲ / W / space — jump · E / X — act (hold to pull) · P — pause · T — theme · L — language',
      foot: 'A quiet tale without words: a scribe’s apprentice wanders the pages of an old manuscript. Crates, ropes, levers and counterweights, water and ink; sand dries the blots, the quill draws bridges, sketches turn solid in the lamp’s light. Death is only a blot: you are back at the mark at once.',
      blots: 'blots', pages: 'pages'
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
