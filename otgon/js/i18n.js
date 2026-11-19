/* ОТГОН · i18n (RU/EN). OTGON.STR — таблицы для Arcade.createGame({strings}).
   В самой игре слов нет — только пиктограммы; строки нужны меню, паузе, ночёвке, финалу и подписи под канвой. */
(function (global) {
  'use strict';
  var O = global.OTGON = global.OTGON || {};
  O.STR = {
    ru: {
      play: 'Новый путь', cont: 'Продолжить путь', language: 'Язык', theme: 'Тема', sound: 'Звук', on: 'вкл', off: 'выкл',
      score: 'Довёл', best: 'Рекорд', win: 'ЛЕТНЕЕ ПАСТБИЩЕ', gameover: 'СТАДО РАЗБРЕЛОСЬ',
      pause: 'ПАУЗА', resume: 'Продолжить', menu: 'В меню', tapstart: 'пробел / тап',
      title: 'ОТГОН', subtitle: 'Стадо ветроногов через северные перевалы',
      back: 'Каталог', leg: 'участок', camp: 'НОЧЁВКА', home: 'дошли', of: 'из',
      campHint: '◀ ▶ — выбрать · ▲ ▼ — сменить метку · Enter / тап по костру — в путь',
      hint: 'Стрелки/WASD: идти · Shift: бег · Пробел: свист · E: посох · P: пауза · T: тема · L: язык',
      foot: 'Веди стадо ветроногов подпаском: иди сзади — они пойдут от тебя; свист собирает и успокаивает, посох направляет и отгоняет птиц. Трава и вода — привал. У костра — ночёвка.'
    },
    en: {
      play: 'New journey', cont: 'Continue journey', language: 'Language', theme: 'Theme', sound: 'Sound', on: 'on', off: 'off',
      score: 'Brought home', best: 'Best', win: 'SUMMER PASTURE', gameover: 'THE HERD SCATTERED',
      pause: 'PAUSE', resume: 'Resume', menu: 'Menu', tapstart: 'space / tap',
      title: 'WINDSHANKS', subtitle: 'A herd of stilt-legged woollies across the northern passes',
      back: 'Catalog', leg: 'leg', camp: 'NIGHT CAMP', home: 'made it', of: 'of',
      campHint: '◀ ▶ — select · ▲ ▼ — change mark · Enter / tap the fire — move on',
      hint: 'Arrows/WASD: walk · Shift: run · Space: whistle · E: staff · P: pause · T: theme · L: language',
      foot: 'Drive the windshank herd as the workshop\'s herd-boy: walk behind and they move away from you; the whistle gathers and calms, the staff points the way and shoos birds. Grass and water mean rest. The campfire means a night camp.'
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
