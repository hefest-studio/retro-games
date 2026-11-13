/* УГОЛЁК · i18n (RU/EN). UGOLYOK.STR — таблицы для Arcade.createGame({strings}).
   Ключи play/language/theme/... нужны стандартным экранам движка; остальные — игре. */
(function (global) {
  'use strict';
  var U = global.UGOLYOK = global.UGOLYOK || {};
  U.STR = {
    ru: {
      play: 'Играть', language: 'Язык', theme: 'Тема', sound: 'Звук', on: 'вкл', off: 'выкл',
      score: 'Счёт', level: 'Экран', best: 'Рекорд', bestTime: 'Лучшее время', time: 'Время',
      win: 'ГОРН РАЗГОРЕЛСЯ!', gameover: 'УГОЛЁК ОСТЫЛ',
      pause: 'ПАУЗА', resume: 'Продолжить', menu: 'В меню', tapstart: 'пробел / тап',
      title: 'УГОЛЁК', subtitle: 'Робот-кочегар мастерской «Гефест» и остывающий Горн',
      sub2: 'Собери весь уголь шахты · прессы, вагонетки, конвейеры',
      back: 'Каталог', lives: 'Жизни', coal: 'Уголь',
      z_shop: 'Мастерская', z_drift: 'Сырой штрек', z_belts: 'Конвейерный ярус', z_rails: 'Рельсовые галереи', z_press: 'Прессовый цех', z_bottom: 'Угольное дно',
      k1: 'Медный ключ', k2: 'Стальной ключ', k3: 'Латунный ключ',
      helmet: 'Каска! Неуязвим', helmetEnd: 'Каска сползла', gear: 'шестерня', roomClear: 'Экран чист!', life: '+1 жизнь',
      beacon: 'Маяк зажжён', gateOpen: 'Весь уголь собран — к Горну!', lost: 'УГОЛЁК ПОВРЕЖДЁН', back2: 'к маяку',
      why_press: 'раздавлен прессом', why_drip: 'залит каплей', why_cart: 'сбит вагонеткой', why_flyer: 'сажник', why_crawler: 'окалыш',
      why_fall: 'слишком высоко', why_spikes: 'обрыв с шипами',
      map: 'КАРТА ШАХТЫ', mapHint: 'Tab / C — закрыть', mapLegend: 'число — уголь на экране · ▲ маяк · цветная черта — дверь под ключ',
      rooms: 'экранов', start: 'Собери весь уголь шахты и раздуй Горн',
      hint: '←→ ходить · ↑/Пробел прыжок · ↑↓ лестницы · Tab карта · P пауза',
      foot: '<b>УГОЛЁК</b> · ← → / A D — ходить · Пробел / Z / ↑ — прыжок · ↑ ↓ — лестницы и верёвки · Tab / C — карта шахты · P / Esc — пауза · L язык, T тема, M звук.'
    },
    en: {
      play: 'Play', language: 'Language', theme: 'Theme', sound: 'Sound', on: 'on', off: 'off',
      score: 'Score', level: 'Screen', best: 'Best', bestTime: 'Best time', time: 'Time',
      win: 'THE FORGE IS ABLAZE!', gameover: 'UGOLYOK WENT COLD',
      pause: 'PAUSE', resume: 'Resume', menu: 'Menu', tapstart: 'space / tap',
      title: 'UGOLYOK', subtitle: 'The stoker robot of the Hefest workshop and a cooling forge',
      sub2: 'Gather every lump of coal · presses, mine carts, conveyors',
      back: 'Catalog', lives: 'Lives', coal: 'Coal',
      z_shop: 'Workshop', z_drift: 'Damp Drift', z_belts: 'Conveyor Tier', z_rails: 'Rail Galleries', z_press: 'Press Hall', z_bottom: 'Coal Bottom',
      k1: 'Copper key', k2: 'Steel key', k3: 'Brass key',
      helmet: 'Hard hat! Invulnerable', helmetEnd: 'Hard hat slipped', gear: 'gear', roomClear: 'Screen clear!', life: '+1 life',
      beacon: 'Beacon lit', gateOpen: 'All coal gathered — to the forge!', lost: 'UGOLYOK DAMAGED', back2: 'to the beacon',
      why_press: 'crushed by a press', why_drip: 'hit by a drip', why_cart: 'run over by a cart', why_flyer: 'sootling', why_crawler: 'scaleback',
      why_fall: 'fell too far', why_spikes: 'spiked pit',
      map: 'MINE MAP', mapHint: 'Tab / C — close', mapLegend: 'number — coal left on screen · ▲ beacon · coloured bar — locked door',
      rooms: 'screens', start: 'Gather all the coal and rekindle the forge',
      hint: '←→ walk · ↑/Space jump · ↑↓ ladders · Tab map · P pause',
      foot: '<b>UGOLYOK</b> · ← → / A D — walk · Space / Z / ↑ — jump · ↑ ↓ — ladders and ropes · Tab / C — mine map · P / Esc — pause · L language, T theme, M sound.'
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
