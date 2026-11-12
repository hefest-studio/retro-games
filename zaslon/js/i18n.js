/* ЗАСЛОН · i18n (RU/EN). ZASLON.STR — таблицы для Arcade.createGame({strings}).
   Ключи движка (play/language/…) + строки игры. Рендеры берут текст только через g.t(). */
(function (global) {
  'use strict';
  var Z = global.ZASLON = global.ZASLON || {};
  Z.STR = {
    ru: {
      play: 'Играть', language: 'Язык', theme: 'Тема', sound: 'Звук', on: 'вкл', off: 'выкл',
      score: 'Счёт', level: 'Сектор', best: 'Рекорд', win: 'ЗАСЛОН ВЫСТОЯЛ!', gameover: 'КОНЕЦ ИГРЫ',
      pause: 'ПАУЗА', resume: 'Продолжить', menu: 'В меню', tapstart: 'пробел / тап',
      title: 'ЗАСЛОН', subtitle: 'Не пропусти врага за нижний край · 5 секторов',
      sector: 'СЕКТОР', ready: 'ГОТОВЬСЯ!', warn: 'ВНИМАНИЕ: КРУПНАЯ ЦЕЛЬ', cleared: 'СЕКТОР ОТБИТ', final: 'ПОСЛЕДНИЙ СЕКТОР ОТБИТ!',
      baseDown: 'ЗАСЛОН ПРОРВАН!', base: 'ЗАСЛОН', shield: 'Щит', scrap: 'Лом', bombs: 'Бомбы', lives: 'Корабли',
      w_spark: 'Искра', w_ray: 'Луч', w_shot: 'Дробь', lvl: 'ур.',
      b_millstone: 'ЖЕРНОВ', b_pincer: 'КЛЕШНЯ', b_hive: 'УЛЕЙ', b_pendulum: 'МАЯТНИК', b_forge: 'ГОРН',
      e_mite: 'Клещ', e_dart: 'Стриж', e_weaver: 'Ткач', e_hulk: 'Таран', e_carrier: 'Носитель',
      shop: 'МАСТЕРСКАЯ', shopHint: '↑↓ выбор · Пробел/Enter купить · тап по строке',
      s_weapon: 'Усилить оружие', s_module: 'Боковой модуль', s_shield: 'Ёмкость щита +1', s_bomb: 'Мега-бомба +1',
      s_repair: 'Починить заслон +25%', s_life: 'Корабль +1', s_next: 'В бой →',
      d_weapon: 'текущее оружие на уровень выше', d_module: 'пушка сбоку, стреляет сама (до 2)', d_shield: 'больше попаданий без потери корабля',
      d_bomb: 'очищает экран от пуль и мелочи', d_repair: 'прочность нижнего барьера', d_life: 'запасной корабль (до 5)', d_next: 'следующий сектор',
      maxed: 'макс.', bought: 'Куплено', noScrap: 'не хватает лома', bonus: 'Бонус',
      capUp: 'УРОВЕНЬ', capSw: 'ОРУЖИЕ',
      hint1: 'Стрелки/WASD — полёт · Пробел — огонь · B/X — бомба',
      hint2: 'Капсула меняет оружие — лови нужное. Лом — в мастерскую.',
      back: 'Каталог',
      foot: '<b>ЗАСЛОН</b> · стрелки / WASD — полёт, Пробел / ● — огонь (удержание), B / X / ✹ — мега-бомба, P — пауза · L язык, T тема, M звук.'
    },
    en: {
      play: 'Play', language: 'Language', theme: 'Theme', sound: 'Sound', on: 'on', off: 'off',
      score: 'Score', level: 'Sector', best: 'Best', win: 'THE LINE HELD!', gameover: 'GAME OVER',
      pause: 'PAUSE', resume: 'Resume', menu: 'Menu', tapstart: 'space / tap',
      title: 'ZASLON', subtitle: 'Let nothing past the bottom edge · 5 sectors',
      sector: 'SECTOR', ready: 'GET READY!', warn: 'WARNING: LARGE TARGET', cleared: 'SECTOR CLEARED', final: 'FINAL SECTOR CLEARED!',
      baseDown: 'THE LINE IS BROKEN!', base: 'BARRIER', shield: 'Shield', scrap: 'Scrap', bombs: 'Bombs', lives: 'Ships',
      w_spark: 'Spark', w_ray: 'Ray', w_shot: 'Scatter', lvl: 'lv',
      b_millstone: 'MILLSTONE', b_pincer: 'PINCER', b_hive: 'HIVE', b_pendulum: 'PENDULUM', b_forge: 'FORGE',
      e_mite: 'Mite', e_dart: 'Swift', e_weaver: 'Weaver', e_hulk: 'Ram', e_carrier: 'Carrier',
      shop: 'WORKSHOP', shopHint: '↑↓ select · Space/Enter buy · tap a row',
      s_weapon: 'Upgrade weapon', s_module: 'Side module', s_shield: 'Shield capacity +1', s_bomb: 'Mega bomb +1',
      s_repair: 'Repair barrier +25%', s_life: 'Ship +1', s_next: 'To battle →',
      d_weapon: 'current weapon one level up', d_module: 'side cannon, fires by itself (max 2)', d_shield: 'more hits before losing a ship',
      d_bomb: 'clears bullets and small fry', d_repair: 'strength of the bottom barrier', d_life: 'spare ship (max 5)', d_next: 'next sector',
      maxed: 'max', bought: 'Bought', noScrap: 'not enough scrap', bonus: 'Bonus',
      capUp: 'LEVEL', capSw: 'WEAPON',
      hint1: 'Arrows/WASD — fly · Space — fire · B/X — bomb',
      hint2: 'Capsules cycle weapons — catch yours. Scrap buys upgrades.',
      back: 'Catalog',
      foot: '<b>ZASLON</b> · arrows / WASD — fly, Space / ● — fire (hold), B / X / ✹ — mega bomb, P — pause · L language, T theme, M sound.'
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
