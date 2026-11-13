/* ГРОМ · i18n (RU/EN). GROM.STR — таблицы для Arcade.createGame({strings}).
   Ключи play/language/theme/... нужны стандартным экранам движка; остальные — игре. */
(function (global) {
  'use strict';
  var GR = global.GROM = global.GROM || {};
  GR.STR = {
    ru: {
      play: 'Играть', language: 'Язык', theme: 'Тема', sound: 'Звук', on: 'вкл', off: 'выкл',
      score: 'Счёт', level: 'Уровень', best: 'Рекорд', time: 'Время',
      win: 'ГРОЗОВОЙ ГОРН ЗАТИХ!', gameover: 'БРОНЯ ПОГАСЛА',
      pause: 'ПАУЗА', resume: 'Продолжить', menu: 'В меню', tapstart: 'пробел / тап',
      title: 'ГРОМ', subtitle: 'Штурмовик мастерской «Гефест» в громовой броне',
      sub2: 'Четыре лабиринта · луч-кнут · форма-колесо · молнии',
      back: 'Каталог', lives: 'Жизни',
      z_foundry: 'Литейный двор', z_steam: 'Паровые штольни', z_copper: 'Медные сады', z_storm: 'Грозовая башня',
      b_anvil: 'НАКОВАЛЬНЯ', b_millstone: 'ЖЕРНОВ', b_kite: 'ФЛЮГЕР', b_horn: 'ГРОЗОВОЙ ГОРН',
      w_S: 'ВЕЕР', w_L: 'ЛАЗЕР', w_B: 'ОТСКОК',
      pk_gem: '+самоцвет', pk_hp: '+броня', pk_thunder: '+молния', pk_life: '+жизнь', pk_charge: 'колесо заряжено',
      beacon: 'Громоотвод: точка возврата', secret: 'ТАЙНИК!', extraLife: '+1 ЖИЗНЬ', noWheel: 'тесно — не развернуться',
      boss: 'БОСС', phase: 'ФАЗА', clear: 'УРОВЕНЬ ПРОЙДЕН', bonus: 'бонус времени', portal: 'Портал открыт — вперёд!',
      down: 'БРОНЯ ПРОБИТА', cont: 'ПРОДОЛЖИТЬ?', contHint: 'Enter / огонь — продолжить уровень заново · счёт пополам',
      timeLow: 'Мало времени!', timeOut: 'ВРЕМЯ ВЫШЛО',
      hp: 'БРОНЯ', wheel: 'КОЛЕСО', thunder: 'МОЛНИИ', find: 'Найди арену в глубине лабиринта',
      hint: '←→ бег · Пробел/Z прыжок · X огонь (↑↓ прицел) · C луч-кнут · V колесо · B молния · P пауза',
      hint1: '←→ бег · Пробел/Z прыжок · X огонь (↑↓ — прицел) · C — луч-кнут (держать)',
      hint2: 'V/Shift — колесо (X — мина) · B/Q — молния · P — пауза · L язык · T тема · M звук',
      foot: '<b>ГРОМ</b> · ← → / A D — бег · Пробел / Z / K — прыжок · X / J — огонь (↑ ↓ — прицел по 8 сторонам) · C / U — луч-кнут (держать, стрелки ведут луч) · V / Shift — колесо (в колесе X — мина) · B / Q — молния · P / Esc — пауза · L язык, T тема, M звук.'
    },
    en: {
      play: 'Play', language: 'Language', theme: 'Theme', sound: 'Sound', on: 'on', off: 'off',
      score: 'Score', level: 'Level', best: 'Best', time: 'Time',
      win: 'THE STORM HORN IS SILENT!', gameover: 'THE ARMOUR WENT DARK',
      pause: 'PAUSE', resume: 'Resume', menu: 'Menu', tapstart: 'space / tap',
      title: 'GROM', subtitle: 'A Hefest workshop trooper in thunder armour',
      sub2: 'Four mazes · lash beam · wheel form · lightning',
      back: 'Catalog', lives: 'Lives',
      z_foundry: 'Foundry Yard', z_steam: 'Steam Adits', z_copper: 'Copper Gardens', z_storm: 'Storm Tower',
      b_anvil: 'THE ANVIL', b_millstone: 'THE MILLSTONE', b_kite: 'THE VANE', b_horn: 'THE STORM HORN',
      w_S: 'FAN', w_L: 'LASER', w_B: 'BOUNCE',
      pk_gem: '+gem', pk_hp: '+armour', pk_thunder: '+lightning', pk_life: '+life', pk_charge: 'wheel charged',
      beacon: 'Lightning rod: checkpoint', secret: 'SECRET!', extraLife: '+1 LIFE', noWheel: 'too tight to unroll',
      boss: 'BOSS', phase: 'PHASE', clear: 'LEVEL CLEAR', bonus: 'time bonus', portal: 'The portal is open — go!',
      down: 'ARMOUR BREACHED', cont: 'CONTINUE?', contHint: 'Enter / fire — restart the level · score halved',
      timeLow: 'Time is running out!', timeOut: 'TIME UP',
      hp: 'ARMOUR', wheel: 'WHEEL', thunder: 'BOLTS', find: 'Find the arena deep in the maze',
      hint: '←→ run · Space/Z jump · X fire (↑↓ aim) · C lash beam · V wheel · B lightning · P pause',
      hint1: '←→ run · Space/Z jump · X fire (↑↓ — aim) · C — lash beam (hold)',
      hint2: 'V/Shift — wheel (X — mine) · B/Q — lightning · P — pause · L lang · T theme · M sound',
      foot: '<b>GROM</b> · ← → / A D — run · Space / Z / K — jump · X / J — fire (↑ ↓ — aim in 8 directions) · C / U — lash beam (hold, arrows steer it) · V / Shift — wheel (in wheel form X — mine) · B / Q — lightning · P / Esc — pause · L language, T theme, M sound.'
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
