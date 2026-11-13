/* ШУСТРИК · i18n (RU/EN). SHUSTRIK.STR — таблицы для Arcade.createGame({strings}).
   Ключи play/language/theme/... нужны стандартным экранам движка; остальные — игре. */
(function (global) {
  'use strict';
  var SH = global.SHUSTRIK = global.SHUSTRIK || {};
  SH.STR = {
    ru: {
      play: 'Играть', language: 'Язык', theme: 'Тема', sound: 'Звук', on: 'вкл', off: 'выкл',
      score: 'Счёт', level: 'Мир', best: 'Рекорд', lives: 'Жизни',
      win: 'ЧЕРТЕЖИ ДОСТАВЛЕНЫ!', gameover: 'ШУСТРИК ВЫДОХСЯ',
      pause: 'ПАУЗА', resume: 'Продолжить', menu: 'В меню', restart: 'С контрольной точки (−1 жизнь)', tapstart: 'пробел / тап',
      title: 'ШУСТРИК', subtitle: 'Механический хорёк-курьер мастерской «Гефест»',
      sub2: 'Догони Ржавого Лиса и верни чертежи · 4 мира · скорость и пар',
      hint: '←→ бег · Пробел / Z прыжок · X огонь (с ↑ — по диагонали) · P пауза',
      back: 'Каталог',
      w1: 'Литейный квартал', w2: 'Паровые штольни', w3: 'Сортировочная', w4: 'Небесная верфь',
      act: 'Акт', world: 'Мир', bonusStage: 'БОНУС-ЭТАП', bonusGoal: 'Собери {n} шестерней за {t} с',
      bonusOk: 'ЕСТЬ! +1 жизнь', bonusFail: 'Не успел…', got: 'собрано',
      clear: 'АКТ ПРОЙДЕН', tTime: 'Время', tBest: 'Лучшее', tSpeed: 'За скорость', tGears: 'Шестерни', tSecrets: 'Тайники', tTotal: 'Итого',
      newBest: 'новое лучшее время!',
      speed: 'СКОРОСТЬ', gears: 'ШЕСТЕРНИ',
      w_base: 'ДРОБЬ', w_burst: 'ОЧЕРЕДЬ', w_blast: 'РАЗРЫВНОЙ', w_bounce: 'ПРЫГУЧИЙ',
      c_burst: 'Бластер: очередь!', c_blast: 'Бластер: разрывной!', c_bounce: 'Бластер: прыгучий!',
      c_shield: 'Щит', c_turbo: 'Ускорение!', c_magnet: 'Магнит', c_hp: '+давление', c_life: '+жизнь!', c_gears: '+10 шестерней',
      life: '+жизнь!', secret: 'ТАЙНИК! +1000', token: 'Жетон бонус-этапа!', cp: 'Контрольная точка',
      tier1: 'Скорость 1', tier2: 'Скорость 2', tier3: 'СКОРОСТЬ 3 — тараню ящики!',
      boss: 'РЖАВЫЙ ЛИС!', b_fox: 'Ржавый Лис', b_ram: 'Паровой таран', b_cuckoo: 'Часовая кукушка', b_armor: 'Лис в паровой броне',
      bossDown: 'Попался! Вперёд к терминалу', restarted: 'С контрольной точки', sec: 'с',
      intro: 'Беги, разгоняйся, стреляй на ходу',
      foot: '<b>ШУСТРИК</b> · ← → / A D — бег (держи — разгон до 3-й скорости) · Пробел / Z / J — прыжок · X / K / Ctrl / F — огонь (держать — автоогонь; с ↑ / W — по диагонали вверх) · P / Esc — пауза · L язык, T тема, M звук.'
    },
    en: {
      play: 'Play', language: 'Language', theme: 'Theme', sound: 'Sound', on: 'on', off: 'off',
      score: 'Score', level: 'World', best: 'Best', lives: 'Lives',
      win: 'BLUEPRINTS DELIVERED!', gameover: 'OUT OF STEAM',
      pause: 'PAUSED', resume: 'Resume', menu: 'Main menu', restart: 'From checkpoint (−1 life)', tapstart: 'space / tap',
      title: 'SHUSTRIK', subtitle: 'The clockwork courier ferret of the Hefest workshop',
      sub2: 'Catch the Rusty Fox and get the blueprints back · 4 worlds · speed and steam',
      hint: '←→ run · Space / Z jump · X fire (with ↑ — diagonal) · P pause',
      back: 'Catalog',
      w1: 'Foundry Quarter', w2: 'Steam Tunnels', w3: 'Switchyard', w4: 'Sky Dockyard',
      act: 'Act', world: 'World', bonusStage: 'BONUS STAGE', bonusGoal: 'Grab {n} gears in {t} s',
      bonusOk: 'GOT IT! +1 life', bonusFail: 'Too slow…', got: 'collected',
      clear: 'ACT CLEAR', tTime: 'Time', tBest: 'Best', tSpeed: 'Speed bonus', tGears: 'Gears', tSecrets: 'Secrets', tTotal: 'Total',
      newBest: 'new best time!',
      speed: 'SPEED', gears: 'GEARS',
      w_base: 'PELLET', w_burst: 'BURST', w_blast: 'BLAST', w_bounce: 'BOUNCE',
      c_burst: 'Blaster: burst!', c_blast: 'Blaster: blast!', c_bounce: 'Blaster: bounce!',
      c_shield: 'Shield', c_turbo: 'Speed boost!', c_magnet: 'Magnet', c_hp: '+pressure', c_life: '+life!', c_gears: '+10 gears',
      life: '+life!', secret: 'SECRET! +1000', token: 'Bonus stage token!', cp: 'Checkpoint',
      tier1: 'Speed 1', tier2: 'Speed 2', tier3: 'SPEED 3 — crates smash!',
      boss: 'RUSTY FOX!', b_fox: 'Rusty Fox', b_ram: 'Steam Ram', b_cuckoo: 'Clockwork Cuckoo', b_armor: 'Fox in Steam Armor',
      bossDown: 'Gotcha! On to the terminal', restarted: 'From checkpoint', sec: 's',
      intro: 'Run, build up speed, shoot on the move',
      foot: '<b>SHUSTRIK</b> · ← → / A D — run (hold to reach speed 3) · Space / Z / J — jump · X / K / Ctrl / F — fire (hold for auto-fire; with ↑ / W — diagonal up) · P / Esc — pause · L language, T theme, M sound.'
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
