/* ГЛУБЬ · i18n (RU/EN). GLUB.STR — таблицы для Arcade.createGame({strings}).
   Ключи play/language/theme/... нужны стандартным экранам движка; остальные — игре. */
(function (global) {
  'use strict';
  var Gb = global.GLUB = global.GLUB || {};
  Gb.STR = {
    ru: {
      play: 'Играть', language: 'Язык', theme: 'Тема', sound: 'Звук', on: 'вкл', off: 'выкл',
      score: 'Счёт', level: 'Экран', best: 'Рекорд', bestTime: 'Лучшее время', time: 'Время',
      win: 'СЕРДЦЕ ГОРНА ПРОБУЖДЕНО!', gameover: 'ВОДОЛАЗ НЕ ВЕРНУЛСЯ',
      pause: 'ПАУЗА', resume: 'Продолжить', menu: 'В меню', tapstart: 'пробел / тап',
      title: 'ГЛУБЬ', subtitle: 'Шахта Древнего Горна под мастерской «Гефест»',
      sub2: 'Водолаз-рудознатец и механический крот Бурик · 8 кристаллов-ключей',
      back: 'Каталог', lives: 'Жизни', energy: 'ЭНЕРГИЯ',
      z_adit: 'Штольни мастерской', z_vein: 'Рудная жила', z_grotto: 'Мерцающие гроты', z_forge: 'Жар Горна', z_heart: 'Сердце Горна',
      c1: 'Огнецвет', c2: 'Синегор', c3: 'Зеленец', c4: 'Медовик', c5: 'Сиреневец', c6: 'Белояр', c7: 'Кровник', c8: 'Сумрачник',
      crystal: 'Кристалл', beacon: 'Маяк зажжён', refill: 'Энергия восполнена', gateOpen: 'Печать Горна открыта!', gateHint: 'Печать: нужны все 8 кристаллов',
      stun: 'Оглушён!', dug: 'Бурик прогрыз проход', clank: 'Твёрдая порода', tank: '+энергия', lost: 'СКАФАНДР ПРОБИТ', back2: 'к маяку',
      kill: 'ржавень', mole: 'БУРИК', moleOut: 'в деле', moleHome: 'рядом',
      map: 'КАРТА ШАХТЫ', mapHint: 'Tab / C — закрыть', mapLegend: '◆ кристалл · ▲ маяк · ┄ мягкая порода · ▼ провал',
      rooms: 'экранов', start: 'Найди 8 кристаллов-ключей и открой Печать',
      hint: '←→ ходить · ↑/Пробел прыжок · ↑↓ лестницы · X крот · Tab карта · P пауза',
      foot: '<b>ГЛУБЬ</b> · ← → / A D — ходить · Пробел / Z / ↑ — прыжок · ↑ ↓ — лестницы · X / Shift — выпустить крота Бурика (с ↓ — копать вниз) · Tab / C — карта · P / Esc — пауза · L язык, T тема, M звук.'
    },
    en: {
      play: 'Play', language: 'Language', theme: 'Theme', sound: 'Sound', on: 'on', off: 'off',
      score: 'Score', level: 'Screen', best: 'Best', bestTime: 'Best time', time: 'Time',
      win: 'THE FORGE HEART AWAKENS!', gameover: 'THE DIVER IS LOST',
      pause: 'PAUSE', resume: 'Resume', menu: 'Menu', tapstart: 'space / tap',
      title: 'GLUB', subtitle: 'The Ancient Forge mine beneath the Hefest workshop',
      sub2: 'An ore-diver and Burik the mechanical mole · 8 key crystals',
      back: 'Catalog', lives: 'Lives', energy: 'ENERGY',
      z_adit: 'Workshop Adits', z_vein: 'Ore Vein', z_grotto: 'Glimmer Grottoes', z_forge: 'Forge Heat', z_heart: 'Forge Heart',
      c1: 'Firebloom', c2: 'Bluepeak', c3: 'Greenling', c4: 'Honeystone', c5: 'Lilacite', c6: 'Whiteblaze', c7: 'Bloodvein', c8: 'Duskstone',
      crystal: 'Crystal', beacon: 'Beacon lit', refill: 'Energy restored', gateOpen: 'The Forge Seal is open!', gateHint: 'The Seal needs all 8 crystals',
      stun: 'Stunned!', dug: 'Burik dug through', clank: 'Hard rock', tank: '+energy', lost: 'SUIT BREACHED', back2: 'to the beacon',
      kill: 'rustling', mole: 'BURIK', moleOut: 'digging', moleHome: 'ready',
      map: 'MINE MAP', mapHint: 'Tab / C — close', mapLegend: '◆ crystal · ▲ beacon · ┄ soft rock · ▼ drop',
      rooms: 'screens', start: 'Find 8 key crystals and open the Seal',
      hint: '←→ walk · ↑/Space jump · ↑↓ ladders · X mole · Tab map · P pause',
      foot: '<b>GLUB</b> · ← → / A D — walk · Space / Z / ↑ — jump · ↑ ↓ — ladders · X / Shift — send Burik the mole (with ↓ — dig down) · Tab / C — map · P / Esc — pause · L language, T theme, M sound.'
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
