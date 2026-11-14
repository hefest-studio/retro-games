/* МАЯЧНИЦА · i18n (RU/EN) — вся оболочка: меню, пауза, настройки, экраны финала и демо, подсказки управления, кнопки страницы,
   экран «поверните устройство», отладка/статистика. В самой игре текста нет (мысли-пиктограммы, жесты).
   Язык: сохранённый выбор игрока (arcade.lang, общий для аркады) → иначе язык системы (navigator.language: ru/be/uk/kk → RU,
   остальные → EN); переключатель — пункт «Язык» в меню и клавиша L.
   TITLE_EN — рабочее EN-название (пока транслит; финальное название подбирается отдельно — заменить здесь одной константой). */
(function (global) {
  'use strict';
  var K = global.KVEST = global.KVEST || {};
  var TITLE_RU = 'МАЯЧНИЦА', TITLE_EN = 'MAYACHNITSA';
  K.TITLE = { ru: TITLE_RU, en: TITLE_EN };
  K.STR = {
    ru: {
      play: 'Новая игра', language: 'Язык', theme: 'Тема', sound: 'Звук', on: 'вкл', off: 'выкл',
      score: 'Найдено', level: 'Глава', best: 'Лучшее', win: 'МАЯК ГОРИТ', gameover: 'КОНЕЦ', pause: 'ПАУЗА',
      resume: 'Продолжить', menu: 'В меню', tapstart: 'пробел / тап — в меню', cont: 'Продолжить', back: 'Каталог',
      walk: 'Прохождение-набросок', restart: 'Начать главу заново', inkAnim: 'Анимация штриха',
      title: TITLE_RU, subtitle: 'Рисованное приключение без слов', sub2: 'Глава 1 · Погасший маяк',
      docTitle: TITLE_RU + ' · Приключение без слов',
      winSub: 'Лодки нашли дорогу домой сквозь туман', solved: 'Головоломок решено', time: 'Время',
      demoTitle: 'Продолжение — в полной версии', demoSub: 'Огни вдоль побережья гаснут один за другим. Что будет дальше — в полной версии игры.',
      soonTitle: 'Глава 2 — скоро', soonSub: 'Новая глава уже в работе. Спасибо, что зажгли маяк!',
      toMenu: 'Вернуться в меню', more: 'Узнать больше',
      rotate: 'Поверните устройство', rotateSub: 'Игра — в горизонтальном положении',
      fullscreen: 'Во весь экран', fsExit: 'Выйти из полноэкранного режима', pauseBtn: 'Пауза',
      stats: 'Статистика плейтеста → файл', statsTitle: 'Статистика (локально)', statsHint: 'E — выгрузить файл',
      hintsL: 'подсказки', errorsL: 'ошибки', looksL: 'осмотры', fpsL: 'к/с', cacheL: 'кэш',
      hint: 'клик — идти и действовать · долгий тап / ПКМ — осмотреть · H подсказка · B набросок · P пауза',
      hintTouch: 'тап — идти и действовать · долгий тап — осмотреть · предмет из сумки — перетащите на цель',
      foot: '<b>' + TITLE_RU + '</b> · клик / тап — идти и взаимодействовать (героиня подходит сама) · долгий тап / правая кнопка — осмотреть · предмет из сумки — тап по нему, затем по цели (или перетащить); на другой предмет — соединить · лампочка / H — подсказка-мысль · книжка / B — прохождение-набросок · P / Esc — пауза · F — во весь экран · L язык, M звук · D — отладка и статистика.'
    },
    en: {
      play: 'New game', language: 'Language', theme: 'Theme', sound: 'Sound', on: 'on', off: 'off',
      score: 'Found', level: 'Chapter', best: 'Best', win: 'THE LIGHT IS ON', gameover: 'THE END', pause: 'PAUSE',
      resume: 'Resume', menu: 'Main menu', tapstart: 'space / tap — menu', cont: 'Continue', back: 'Catalog',
      walk: 'Sketchbook walkthrough', restart: 'Restart chapter', inkAnim: 'Ink stroke animation',
      title: TITLE_EN, subtitle: 'A wordless hand-drawn adventure', sub2: 'Chapter 1 · The Dark Lighthouse',
      docTitle: TITLE_EN + ' · A wordless adventure',
      winSub: 'The boats found their way home through the fog', solved: 'Puzzles solved', time: 'Time',
      demoTitle: 'The story continues in the full version', demoSub: 'Lights along the coast keep going out one by one. Find out what happens next in the full game.',
      soonTitle: 'Chapter 2 — coming soon', soonSub: 'The next chapter is in the works. Thank you for lighting the lighthouse!',
      toMenu: 'Back to main menu', more: 'Learn more',
      rotate: 'Please rotate your device', rotateSub: 'The game is played in landscape orientation',
      fullscreen: 'Full screen', fsExit: 'Exit full screen', pauseBtn: 'Pause',
      stats: 'Export playtest statistics', statsTitle: 'Statistics (local only)', statsHint: 'E — export file',
      hintsL: 'hints', errorsL: 'mistakes', looksL: 'looks', fpsL: 'fps', cacheL: 'cache',
      hint: 'click — walk & interact · long tap / right click — look · H hint · B sketchbook · P pause',
      hintTouch: 'tap — walk & interact · long tap — look · drag an item from the bag onto its target',
      foot: '<b>' + TITLE_EN + '</b> · click / tap — walk and interact (she walks up by herself) · long tap / right click — look closer · item from the bag — tap it, then the target (or drag it); onto another item — combine · bulb / H — hint · book / B — sketchbook walkthrough · P / Esc — pause · F — full screen · L language, M sound · D — debug & statistics.'
    }
  };
  // язык по умолчанию: сохранённый выбор, иначе язык системы
  K.pickLang = function (stored, nav) {
    if (stored === 'ru' || stored === 'en') return stored;
    var list = [].concat(nav || []).filter(Boolean);
    for (var i = 0; i < list.length; i++) { var l = String(list[i]).toLowerCase(); if (/^(ru|be|uk|kk)\b/.test(l)) return 'ru'; if (/^[a-z]{2}\b/.test(l)) return 'en'; }
    return 'ru';
  };
})(typeof window !== 'undefined' ? window : globalThis);
