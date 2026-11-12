/* КАТАКОМБЫ · i18n (RU/EN). KATAKOMBY.STR — таблицы для Arcade.createGame({strings}).
   Ключи play/language/theme/... нужны стандартным экранам движка, players/touch1p — g.usePlayers; остальные — игре. */
(function (global) {
  'use strict';
  var K = global.KATAKOMBY = global.KATAKOMBY || {};
  K.STR = {
    ru: {
      play: 'Играть', players: 'Игроки', touch1p: 'тач — 1 игрок', language: 'Язык', theme: 'Тема', sound: 'Звук', on: 'вкл', off: 'выкл',
      score: 'Счёт', level: 'Этаж', best: 'Рекорд', win: 'СТРАЖ ГЛУБИН ПОВЕРЖЕН!', gameover: 'КАТАКОМБЫ ВЗЯЛИ СВОЁ',
      pause: 'ПАУЗА', resume: 'Продолжить', menu: 'В меню', tapstart: 'пробел / тап',
      title: 'КАТАКОМБЫ', subtitle: 'Зачистка подземелий · 1–2 игрока · 8 этажей и Страж Глубин',
      back: 'Каталог', hero1: 'Герой И1', hero2: 'Герой И2',
      cls_smith: 'Кузнец', cls_spark: 'Искорка',
      clsd_smith: 'молот вблизи, щит, крепкий', clsd_spark: 'искры издалека, быстрая, стреляет пятясь',
      floor: 'ЭТАЖ', floorShort: 'Эт.', clear: 'ЭТАЖ ПРОЙДЕН', bonus: 'Бонус',
      f_vestibule: 'Преддверие', f_storerooms: 'Кладовые', f_wells: 'Колодцы', f_maze: 'Лабиринт', f_barracks: 'Казармы',
      f_bridges: 'Переходы', f_hive: 'Улей', f_vault: 'Сокровищница', f_lair: 'Логово Стража',
      bossName: 'Страж Глубин', bossSub: 'Бей Стража, уходи от колец плевков',
      introSub: 'Найди лестницу вниз · ломай логова · ешь, чтобы не угаснуть',
      upTitle: 'ПРОКАЧКА', upSub: '↑ ↓ — выбор, огонь — взять', upDone: 'выбрано', upWait: 'ждём напарника…',
      up_str: 'Сила', up_spd: 'Скорость', up_arm: 'Броня',
      upd_str: 'урон +35%', upd_spd: 'бег и темп +10%', upd_arm: 'урон по тебе −8%, +10 здоровья',
      p1: 'И1', p2: 'И2', fallen: 'пал — вернётся на следующем этаже', hungry: 'ЕДА!',
      keys: 'Ключи', potions: 'Зелья',
      pk_key: '+ключ', pk_chest: '+150', pk_food: '+здоровье', pk_potion: '+зелье', door: 'дверь открыта', bomb: 'ВЗРЫВ ЗЕЛЬЯ',
      hint1: 'И1: стрелки — ход, / или пробел — удар/выстрел, , — зелье',
      hint2: 'И2: W A S D — ход, F — удар/выстрел, G — зелье · 1/2 — игроки',
      foot: '<b>КАТАКОМБЫ</b> · И1: стрелки, / или пробел — удар/выстрел, «,» — зелье · И2: WASD, F — удар/выстрел, G — зелье · 1/2 на заставке — игроки · P/Esc пауза · L язык, T тема, M звук. Тач — только И1.'
    },
    en: {
      play: 'Play', players: 'Players', touch1p: 'touch — 1 player', language: 'Language', theme: 'Theme', sound: 'Sound', on: 'on', off: 'off',
      score: 'Score', level: 'Floor', best: 'Best', win: 'THE DEEP WARDEN FALLS!', gameover: 'THE CATACOMBS WIN',
      pause: 'PAUSE', resume: 'Resume', menu: 'Menu', tapstart: 'space / tap',
      title: 'KATAKOMBY', subtitle: 'Dungeon sweep · 1–2 players · 8 floors and the Deep Warden',
      back: 'Catalog', hero1: 'P1 hero', hero2: 'P2 hero',
      cls_smith: 'Smith', cls_spark: 'Spark',
      clsd_smith: 'hammer up close, shield, tough', clsd_spark: 'sparks at range, fast, shoots while backing off',
      floor: 'FLOOR', floorShort: 'Fl.', clear: 'FLOOR CLEARED', bonus: 'Bonus',
      f_vestibule: 'Vestibule', f_storerooms: 'Storerooms', f_wells: 'Wells', f_maze: 'Maze', f_barracks: 'Barracks',
      f_bridges: 'Passages', f_hive: 'Hive', f_vault: 'Vault', f_lair: 'Warden’s Lair',
      bossName: 'Deep Warden', bossSub: 'Strike the Warden, slip out of the spit rings',
      introSub: 'Find the stairs down · smash the lairs · eat or fade away',
      upTitle: 'LEVEL UP', upSub: '↑ ↓ — choose, fire — take', upDone: 'taken', upWait: 'waiting for partner…',
      up_str: 'Power', up_spd: 'Speed', up_arm: 'Armor',
      upd_str: 'damage +35%', upd_spd: 'run & attack rate +10%', upd_arm: 'damage taken −8%, +10 health',
      p1: 'P1', p2: 'P2', fallen: 'fell — returns on the next floor', hungry: 'FOOD!',
      keys: 'Keys', potions: 'Potions',
      pk_key: '+key', pk_chest: '+150', pk_food: '+health', pk_potion: '+potion', door: 'door opened', bomb: 'POTION BLAST',
      hint1: 'P1: arrows — move, / or space — strike/shoot, , — potion',
      hint2: 'P2: W A S D — move, F — strike/shoot, G — potion · 1/2 — players',
      foot: '<b>KATAKOMBY</b> · P1: arrows, / or space — strike/shoot, “,” — potion · P2: WASD, F — strike/shoot, G — potion · 1/2 on the title — players · P/Esc pause · L language, T theme, M sound. Touch — P1 only.'
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
