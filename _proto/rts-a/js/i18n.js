/* ПРИИСК · i18n (RU/EN). PRIISK.STR — таблицы для Arcade.createGame({strings}). Все имена — свои, оригинальные. */
(function (global) {
  'use strict';
  var P = global.PRIISK = global.PRIISK || {};
  P.STR = {
    ru: {
      play: 'Играть', language: 'Язык', theme: 'Тема', sound: 'Звук', on: 'вкл', off: 'выкл',
      score: 'Счёт', level: 'Партия', best: 'Рекорд', win: 'ПЛАТО НАШЕ!', gameover: 'КОНТОРА ПАЛА',
      pause: 'ПАУЗА', resume: 'Продолжить', menu: 'В меню', tapstart: 'пробел / тап',
      title: 'ПРИИСК', subtitle: 'Две артели · одно медное плато',
      hint1: 'Снеси Контору Сизого Перевала. Мышь: ЛКМ — выбор, рамка — группа, ПКМ — приказ',
      hint2: 'Тач: тап — выбор, протяжка — рамка, долгий тап — приказ, два пальца — камера',
      me: 'Артель Медного Ключа', foe: 'Артель Сизого Перевала',
      hq: 'Контора', boiler: 'Котельная', bunk: 'Барак', smelter: 'Плавильня', works: 'Мастерская',
      rifleman: 'Стрелок', crawler: 'Самоход', ironwagon: 'Броневоз', hauler: 'Рудовоз',
      copper: 'Медь', steam: 'Пар', time: 'Время', selected: 'Выбрано', load: 'груз', queue: 'очередь',
      ready: 'ГОТОВО', place: 'поставить', building: 'стройка',
      msgReady: 'Постройка готова — укажи место', msgPlaced: 'Построено', msgNoCopper: 'Не хватает меди',
      msgNeed: 'Нужно здание', msgCantPlace: 'Сюда нельзя: занято или далеко от базы', msgLowPower: 'Мало пара — стройка идёт медленнее',
      msgWave: 'Сизые идут на нас!', msgUnit: 'Готов', msgBusy: 'Стройка уже идёт', msgRally: 'Точка сбора',
      msgGroup: 'Группа', msgLost: 'Наше здание разрушено', msgStart: 'Поставь Котельную, затем Плавильню — рудовоз начнёт возить медь',
      tipPlace: 'ЛКМ — поставить · ПКМ / Esc — отмена', tipCmd: 'ПКМ — идти / атаковать / копать · Ctrl+1…9 — группа',
      tipPanel: 'ЛКМ — заказать · ПКМ — отменить',
      winSub: 'Контора соседей снесена', loseSub: 'Сизые взяли плато',
      back: 'Каталог'
    },
    en: {
      play: 'Play', language: 'Language', theme: 'Theme', sound: 'Sound', on: 'on', off: 'off',
      score: 'Score', level: 'Match', best: 'Best', win: 'THE PLATEAU IS OURS!', gameover: 'LODGE LOST',
      pause: 'PAUSE', resume: 'Resume', menu: 'Menu', tapstart: 'space / tap',
      title: 'PRIISK', subtitle: 'Two artels · one copper plateau',
      hint1: 'Raze the Grey Pass Lodge. Mouse: LMB select, drag box, RMB order',
      hint2: 'Touch: tap select, drag box, long tap order, two fingers pan',
      me: 'Copper Spring Artel', foe: 'Grey Pass Artel',
      hq: 'Lodge', boiler: 'Boiler House', bunk: 'Bunkhouse', smelter: 'Smelter', works: 'Steamworks',
      rifleman: 'Rifleman', crawler: 'Crawler', ironwagon: 'Ironwagon', hauler: 'Ore Hauler',
      copper: 'Copper', steam: 'Steam', time: 'Time', selected: 'Selected', load: 'load', queue: 'queue',
      ready: 'READY', place: 'place', building: 'building',
      msgReady: 'Construction ready — pick a spot', msgPlaced: 'Built', msgNoCopper: 'Not enough copper',
      msgNeed: 'Requires a building', msgCantPlace: 'Can’t build here: blocked or too far from base', msgLowPower: 'Low steam — production slowed',
      msgWave: 'The Grey Pass is coming!', msgUnit: 'Ready', msgBusy: 'Already building', msgRally: 'Rally point',
      msgGroup: 'Group', msgLost: 'We lost a building', msgStart: 'Build a Boiler House, then a Smelter — the hauler will bring copper',
      tipPlace: 'LMB place · RMB / Esc cancel', tipCmd: 'RMB move / attack / mine · Ctrl+1…9 group',
      tipPanel: 'LMB order · RMB cancel',
      winSub: 'The rival lodge is down', loseSub: 'The Grey Pass took the plateau',
      back: 'Catalog'
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
