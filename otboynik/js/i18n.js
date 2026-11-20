/* ОТБОЙНИК · i18n (RU/EN). OTBOYNIK.STR — таблицы для Arcade.createGame({strings}).
   Ключи play/language/theme/... нужны стандартным экранам движка; остальные — игре. */
(function (global) {
  'use strict';
  var G = global.OTBOYNIK = global.OTBOYNIK || {};
  G.STR = {
    ru: {
      play: 'Играть', language: 'Язык', theme: 'Тема', sound: 'Звук', on: 'вкл', off: 'выкл',
      score: 'Очки', level: 'Волна', best: 'Рекорд', win: 'МАСТЕРСКАЯ ОТСТОЯЛА!', gameover: 'ВОРОТА ПАЛИ',
      pause: 'ПАУЗА', resume: 'Продолжить', menu: 'В меню', tapstart: 'пробел / тап',
      title: 'ОТБОЙНИК', subtitle: 'Пинбол-оборона мастерской · колода построек',
      hint1: 'Z / ← / A — левый флиппер · M / → / D — правый', hint2: 'Пробел — пуск шара · ↑ / W / X — встряска (не больше двух подряд)',
      wave: 'ВОЛНА', waveShort: 'Волна', bossWave: 'КОПЁР ИДЁТ', bossSub: 'Разбей шестерни, пока он не дошёл до ворот',
      gate: 'Ворота', reach: 'Дальность', bestWave: 'волна', launchHint: 'Пробел / тап — пуск шара',
      waveClear: 'ВОЛНА ОТБИТА', bonus: 'Бонус',
      pick: 'ВЫБЕРИ КАРТУ', pickHint: '← → выбор · пробел — взять · тап по карте', slot: 'КУДА ПОСТАВИТЬ?', slotHint: '← → место · пробел — поставить · тап по месту',
      k_build: 'постройка', k_up: 'улучшение', k_now: 'сразу', lvl: 'ур.',
      c_forge: 'Кузнечный горн', c_bell: 'Колокольня', c_spring: 'Пружинная стенка', c_magnet: 'Магнит', c_splitter: 'Делитель', c_repair: 'Ремонт ворот', c_flip: 'Кованые флипперы',
      cd_forge: 'Шар раскаляется: двойной урон и поджог', cd_bell: 'Звон оглушает механизмы вокруг', cd_spring: 'Отбивает шар с силой, механизмы обходят',
      cd_magnet: 'Тянет шар к себе, механизмы вязнут', cd_splitter: 'Выпускает ещё один шар', cd_repair: '+6 прочности ворот', cd_flip: 'Флипперы бьют быстрее и сильнее',
      e_beetle: 'Заводной жук', e_cart: 'Тележка', e_fly: 'Жестяная стрекоза', e_ram: 'Шестерёнчатый таран', boss: 'КОПЁР',
      tilt: 'ВСТРЯСКА', tiltLock: 'ПЕРЕКОС! флипперы заклинило', drain: 'шар ушёл: −1 ворота',
      revived: 'ВОРОТА ПОДЛАТАНЫ', repaired: 'РЕМОНТ +6', rwRepair: 'Реклама: ремонт ворот +6',
      deck: 'Колода', dk_bench: 'Верстак', dk_forge: 'Горн', dk_bell: 'Колокол', dk_magnet: 'Магнит', dk_splitter: 'Делитель', dk_master: 'Мастер',
      dd_bench: 'Пустой стол — строй из раздачи', dd_start: 'С начала на столе: {x}', cards: 'Карты', nextUnlock: 'Далее', needWave: 'дойди до волны {n}',
      needWin: 'победи Копра', newUnlock: 'ОТКРЫТО', allOpen: 'Всё открыто'
    },
    en: {
      play: 'Play', language: 'Language', theme: 'Theme', sound: 'Sound', on: 'on', off: 'off',
      score: 'Score', level: 'Wave', best: 'Best', win: 'THE WORKSHOP STANDS!', gameover: 'THE GATE HAS FALLEN',
      pause: 'PAUSED', resume: 'Resume', menu: 'Main menu', tapstart: 'space / tap',
      title: 'BUMPERWRIGHT', subtitle: 'Workshop pinball defense · a deck of buildings',
      hint1: 'Z / ← / A — left flipper · M / → / D — right', hint2: 'Space — launch ball · ↑ / W / X — nudge (no more than two in a row)',
      wave: 'WAVE', waveShort: 'Wave', bossWave: 'THE PILE DRIVER COMES', bossSub: 'Smash its gears before it reaches the gate',
      gate: 'Gate', reach: 'Reach', bestWave: 'wave', launchHint: 'Space / tap — launch the ball',
      waveClear: 'WAVE REPELLED', bonus: 'Bonus',
      pick: 'PICK A CARD', pickHint: '← → choose · space — take · tap a card', slot: 'WHERE TO BUILD?', slotHint: '← → spot · space — build · tap a spot',
      k_build: 'building', k_up: 'upgrade', k_now: 'instant', lvl: 'lv.',
      c_forge: 'Forge hearth', c_bell: 'Bell tower', c_spring: 'Spring wall', c_magnet: 'Magnet', c_splitter: 'Splitter', c_repair: 'Gate repair', c_flip: 'Forged flippers',
      cd_forge: 'The ball heats up: double damage, sets on fire', cd_bell: 'Its ring stuns nearby machines', cd_spring: 'Kicks the ball hard, machines walk around',
      cd_magnet: 'Pulls the ball in, machines get bogged down', cd_splitter: 'Releases one more ball', cd_repair: '+6 gate durability', cd_flip: 'Flippers swing faster and harder',
      e_beetle: 'Wind-up beetle', e_cart: 'Cart', e_fly: 'Tin dragonfly', e_ram: 'Gear ram', boss: 'PILE DRIVER',
      tilt: 'NUDGE', tiltLock: 'TILTED! flippers jammed', drain: 'ball lost: −1 gate',
      revived: 'GATE PATCHED UP', repaired: 'REPAIR +6', rwRepair: 'Watch ad: repair gate +6',
      deck: 'Deck', dk_bench: 'Workbench', dk_forge: 'Forge', dk_bell: 'Bell', dk_magnet: 'Magnet', dk_splitter: 'Splitter', dk_master: 'Master',
      dd_bench: 'Empty table — build from the deal', dd_start: 'Starts on the table: {x}', cards: 'Cards', nextUnlock: 'Next', needWave: 'reach wave {n}',
      needWin: 'beat the Pile Driver', newUnlock: 'UNLOCKED', allOpen: 'Everything unlocked'
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
