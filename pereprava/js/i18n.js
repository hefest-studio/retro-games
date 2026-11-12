/* ПЕРЕПРАВА · i18n (RU/EN). PEREPRAVA.STR — таблицы для Arcade.createGame({strings}).
   Ключи play/language/theme/... нужны стандартным экранам движка; остальные — игре. */
(function (global) {
  'use strict';
  var K = global.PEREPRAVA = global.PEREPRAVA || {};
  K.STR = {
    ru: {
      play: 'Играть', language: 'Язык', theme: 'Тема', sound: 'Звук', on: 'вкл', off: 'выкл',
      score: 'Счёт', level: 'Ур.', best: 'Рекорд', win: 'ВСЕ СКЛАДЫ ПОЛНЫ!', gameover: 'ШУРУП ОБЕСТОЧЕН',
      pause: 'ПАУЗА', resume: 'Продолжить', menu: 'В меню', tapstart: 'пробел / тап',
      title: 'ПЕРЕПРАВА', subtitle: 'Жук-курьер Шуруп · проезд и канал · 10 смен',
      back: 'Каталог', lives: 'Жизни', time: 'Время',
      ready: 'СМЕНА', readySub: 'Доставь детали в 5 ячеек склада',
      clear: 'СКЛАД ЗАПОЛНЕН', bonus: 'Бонус', lost: 'ПОТЕРЯ', next: 'Следующая смена',
      d_water: 'Утонул в канале', d_edge: 'Унесло течением', d_car: 'Сбит транспортом', d_spider: 'Пойман пауком',
      d_fish: 'Схвачен сомом', d_wall: 'Удар о стену склада', d_trap: 'Ячейка с капканом', d_time: 'Время вышло',
      t_bay: 'ДОСТАВЛЕНО', t_prize: 'ДЕТАЛЬ-ПРИЗ', t_mate: 'ШАЙБА ДОМА', t_pickup: 'ШАЙБА С ТОБОЙ', t_extra: '+1 ЖИЗНЬ',
      t_trap: 'КАПКАН!',
      lv_1: 'Утренняя', lv_2: 'Пересменка', lv_3: 'Паук на насыпи', lv_4: 'Капканы', lv_5: 'Сом в канале',
      lv_6: 'Половодье', lv_7: 'Гонка фур', lv_8: 'Два паука', lv_9: 'Ночная', lv_10: 'Аврал',
      hint: '←↑→↓ / WASD — прыжок · свайп или кнопки · P — пауза',
      foot: '<b>ПЕРЕПРАВА</b> · ←↑→↓ / WASD — прыжок на клетку · свайп или кнопки на экране · P/Esc — пауза · L язык, T тема, M звук.'
    },
    en: {
      play: 'Play', language: 'Language', theme: 'Theme', sound: 'Sound', on: 'on', off: 'off',
      score: 'Score', level: 'Lvl', best: 'Best', win: 'ALL BAYS STOCKED!', gameover: 'SHURUP POWERED DOWN',
      pause: 'PAUSE', resume: 'Resume', menu: 'Menu', tapstart: 'space / tap',
      title: 'PEREPRAVA', subtitle: 'Shurup the courier beetle · road & canal · 10 shifts',
      back: 'Catalog', lives: 'Lives', time: 'Time',
      ready: 'SHIFT', readySub: 'Deliver parts to all 5 warehouse bays',
      clear: 'WAREHOUSE STOCKED', bonus: 'Bonus', lost: 'LOST', next: 'Next shift',
      d_water: 'Sank in the canal', d_edge: 'Swept away', d_car: 'Hit by traffic', d_spider: 'Caught by the spider',
      d_fish: 'Snapped by the catfish', d_wall: 'Hit the warehouse wall', d_trap: 'Trapped bay', d_time: 'Out of time',
      t_bay: 'DELIVERED', t_prize: 'PRIZE PART', t_mate: 'WASHER HOME', t_pickup: 'WASHER ABOARD', t_extra: '+1 LIFE',
      t_trap: 'TRAP!',
      lv_1: 'Morning', lv_2: 'Shift change', lv_3: 'Bank spider', lv_4: 'Traps', lv_5: 'Canal catfish',
      lv_6: 'High water', lv_7: 'Truck rush', lv_8: 'Two spiders', lv_9: 'Night shift', lv_10: 'Rush hour',
      hint: '←↑→↓ / WASD — hop · swipe or buttons · P — pause',
      foot: '<b>PEREPRAVA</b> · ←↑→↓ / WASD — hop one cell · swipe or on-screen buttons · P/Esc — pause · L language, T theme, M sound.'
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
