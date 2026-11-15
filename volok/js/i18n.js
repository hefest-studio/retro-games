/* ВОЛОК · i18n (RU/EN). VOLOK.STR — таблицы для Arcade.createGame({strings}).
   В самой игре слов нет — только пиктограммы; строки нужны меню, паузе, финалу и подписи под канвой. */
(function (global) {
  'use strict';
  var V = global.VOLOK = global.VOLOK || {};
  V.STR = {
    ru: {
      play: 'Новый путь', cont: 'Продолжить путь', language: 'Язык', theme: 'Тема', sound: 'Звук', on: 'вкл', off: 'выкл',
      score: 'Путь', best: 'Рекорд', win: 'ЗИМОВЬЕ', gameover: 'АВАРИЯ',
      pause: 'ПАУЗА', resume: 'Продолжить', menu: 'В меню', tapstart: 'пробел / тап',
      title: 'ВОЛОК', subtitle: 'Изба-мастерская на колёсах и на воде',
      back: 'Каталог', sec: 'участок',
      hint: 'Стрелки/WASD: ход и лестницы · Пробел/E: действие (держать) · Тап по месту в избе · P: пауза · T: тема · L: язык',
      foot: 'Веди избу-мастерскую подмастерьем изнутри: дрова в топку, клапан при перегреве, рычаг хода, парус по ветру, лебёдка у преград, заплатки с верстака. На берегу изба станет судном.'
    },
    en: {
      play: 'New journey', cont: 'Continue journey', language: 'Language', theme: 'Theme', sound: 'Sound', on: 'on', off: 'off',
      score: 'Journey', best: 'Best', win: 'WINTER CAMP', gameover: 'WRECKED',
      pause: 'PAUSE', resume: 'Resume', menu: 'Menu', tapstart: 'space / tap',
      title: 'KETTLEWAKE', subtitle: 'A workshop hut on wheels — and on water',
      back: 'Catalog', sec: 'leg',
      hint: 'Arrows/WASD: walk & ladders · Space/E: act (hold) · Tap a spot in the hut · P: pause · T: theme · L: language',
      foot: 'Run the workshop hut from inside as the apprentice: logs into the firebox, the valve when it overheats, the drive lever, the sail with the wind, the winch at obstacles, patches from the workbench. At the shore the hut turns into a boat.'
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
