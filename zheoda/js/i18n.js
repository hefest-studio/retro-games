/* ЖЕОДА · i18n (RU/EN). ZHEODA.STR — таблицы для Arcade.createGame({strings}).
   Ключи play/language/theme/... нужны стандартным экранам движка; остальные — игре. */
(function (global) {
  'use strict';
  var Z = global.ZHEODA = global.ZHEODA || {};
  Z.STR = {
    ru: {
      play: 'Играть', language: 'Язык', theme: 'Тема', sound: 'Звук', on: 'вкл', off: 'выкл',
      score: 'Счёт', level: 'Ур.', best: 'Рекорд', win: 'ЖЕОДА ОТКРЫТА!', gameover: 'ФОНАРЬ ПОГАС',
      pause: 'ПАУЗА', resume: 'Продолжить', menu: 'В меню', tapstart: 'пробел / тап',
      title: 'ЖЕОДА', subtitle: 'Рудознатка Друза · 16 пещер и Исполин', back: 'Каталог', lives: 'Жизни',
      episode: 'Эпизод', ep1: 'Верхние жеоды', ep2: 'Глубинные жеоды', ep3: 'Сердце горы',
      hubTitle: 'КАРТА ЖЕОД', hubHint: '← → — выбор · Пробел / Enter — спуститься', hubDone: 'пройдено', hubLocked: 'закрыто', hubNext: 'вход открыт',
      ready: 'УРОВЕНЬ', goal: 'Собери все кристаллы — откроется выход', bossGoal: 'Бей Исполина из бластера, переворачивай гравитацию',
      clear: 'ПЕЩЕРА ПРОЙДЕНА', bonus: 'Бонус', lost: 'ДРУЗА ОГЛУШЕНА', exitOpen: 'ВЫХОД ОТКРЫТ!', secret: 'ТАЙНИК!',
      noammo: 'НЕТ ЗАРЯДОВ', gravity: 'ГРАВИТАЦИЯ!', leverOn: 'МЕХАНИЗМ ВКЛ', leverOff: 'МЕХАНИЗМ ВЫКЛ',
      key_R: 'КРАСНЫЙ КЛЮЧ', key_B: 'СИНИЙ КЛЮЧ', key_Y: 'ЖЁЛТЫЙ КЛЮЧ', door: 'ДВЕРЬ ОТПЕРТА', ammo: 'ЗАРЯДЫ', dyn: 'ВЗРЫВЧАТКА', heal: 'АПТЕЧКА', gem: 'САМОЦВЕТ',
      crystals: 'Кристаллы', boss: 'Исполин', enrage: 'ИСПОЛИН В ЯРОСТИ',
      lv_mouth: 'Устье', lv_ledges: 'Карнизы', lv_lever: 'Рычаг', lv_key: 'Красный ключ', lv_drips: 'Капель', lv_blast: 'Подрыв',
      lv_lift: 'Подъёмники', lv_flip: 'Перевёртыш', lv_twokeys: 'Два ключа', lv_ceiling: 'Потолок', lv_shaft: 'Шахта',
      lv_acid: 'Кислотные озёра', lv_rockfall: 'Обвал', lv_gears: 'Механизм', lv_locks: 'Три замка', lv_core: 'Сердцевина', lv_colossus: 'Исполин',
      tip_mouth: 'Прыжок — ↑ / W / Z, чем дольше держишь — тем выше', tip_lever: '↓ / S у рычага — переключить механизм',
      tip_key: 'Ключ отпирает дверь своего цвета', tip_drips: 'Сталактиты срываются, когда проходишь под ними',
      tip_blast: '↓ / S — заложить взрывчатку у трещиноватой стены и отбежать', tip_lift: 'Встань на лифт и жди остановки',
      tip_flip: 'Сфера гравитации переворачивает тебя и обитателей', tip_secret: 'Некоторые стены — ложные',
      hint: '← → бег · ↑ прыжок · Пробел огонь · ↓ рычаг/взрывчатка · P пауза',
      foot: '<b>ЖЕОДА</b> · ← → / A D — бег · ↑ / W / Z — прыжок · Пробел / X — заводной бластер · ↓ / S — рычаг или взрывчатка · P/Esc — пауза · L язык, T тема, M звук.'
    },
    en: {
      play: 'Play', language: 'Language', theme: 'Theme', sound: 'Sound', on: 'on', off: 'off',
      score: 'Score', level: 'Lvl', best: 'Best', win: 'THE GEODE IS OPEN!', gameover: 'THE LAMP WENT OUT',
      pause: 'PAUSE', resume: 'Resume', menu: 'Menu', tapstart: 'space / tap',
      title: 'ZHEODA', subtitle: 'Prospector Druza · 16 caves and the Colossus', back: 'Catalog', lives: 'Lives',
      episode: 'Episode', ep1: 'Upper geodes', ep2: 'Deep geodes', ep3: 'Heart of the mountain',
      hubTitle: 'GEODE MAP', hubHint: '← → — choose · Space / Enter — descend', hubDone: 'cleared', hubLocked: 'locked', hubNext: 'open',
      ready: 'LEVEL', goal: 'Collect every crystal — the exit will open', bossGoal: 'Blast the Colossus, flip gravity to dodge',
      clear: 'CAVE CLEARED', bonus: 'Bonus', lost: 'DRUZA IS DOWN', exitOpen: 'EXIT OPEN!', secret: 'SECRET!',
      noammo: 'NO CHARGES', gravity: 'GRAVITY!', leverOn: 'MECHANISM ON', leverOff: 'MECHANISM OFF',
      key_R: 'RED KEY', key_B: 'BLUE KEY', key_Y: 'YELLOW KEY', door: 'DOOR UNLOCKED', ammo: 'CHARGES', dyn: 'EXPLOSIVE', heal: 'MEDKIT', gem: 'GEMSTONE',
      crystals: 'Crystals', boss: 'Colossus', enrage: 'THE COLOSSUS IS ENRAGED',
      lv_mouth: 'The Mouth', lv_ledges: 'Ledges', lv_lever: 'The Lever', lv_key: 'Red Key', lv_drips: 'Drips', lv_blast: 'Blasting',
      lv_lift: 'Lifts', lv_flip: 'Upside Down', lv_twokeys: 'Two Keys', lv_ceiling: 'Ceiling', lv_shaft: 'The Shaft',
      lv_acid: 'Acid Lakes', lv_rockfall: 'Rockfall', lv_gears: 'Machinery', lv_locks: 'Three Locks', lv_core: 'The Core', lv_colossus: 'The Colossus',
      tip_mouth: 'Jump — ↑ / W / Z, hold longer to jump higher', tip_lever: '↓ / S at a lever — switch the mechanism',
      tip_key: 'A key unlocks the door of its colour', tip_drips: 'Stalactites drop when you pass beneath',
      tip_blast: '↓ / S — plant an explosive by a cracked wall and run', tip_lift: 'Step on a lift and wait for the stop',
      tip_flip: 'A gravity orb flips you and the cave dwellers', tip_secret: 'Some walls are fake',
      hint: '← → run · ↑ jump · Space fire · ↓ lever/explosive · P pause',
      foot: '<b>ZHEODA</b> · ← → / A D — run · ↑ / W / Z — jump · Space / X — clockwork blaster · ↓ / S — lever or explosive · P/Esc — pause · L language, T theme, M sound.'
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
