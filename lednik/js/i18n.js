/* ЛЕДНИК · i18n (RU/EN). LEDNIK.STR — таблицы для Arcade.createGame({strings}).
   Ключи play/language/theme/... нужны стандартным экранам движка; остальные — игре.
   n_<id> — названия уровней, r<N> — регионы, b_<босс> — боссы, e_<враг> — враги, d_<причина> — причина потери жизни. */
(function (global) {
  'use strict';
  var LD = global.LEDNIK = global.LEDNIK || {};
  LD.STR = {
    ru: {
      play: 'В путь', language: 'Язык', theme: 'Тема', sound: 'Звук', on: 'вкл', off: 'выкл',
      score: 'Счёт', level: 'Уровень', best: 'Рекорд', pause: 'ПАУЗА', resume: 'Продолжить', menu: 'В меню', tapstart: 'пробел / тап',
      win: 'ПЛЕМЯ ГОТОВО К СТУЖЕ!', gameover: 'ИСКРА ВОЗВРАЩАЕТСЯ В СТОЙБИЩЕ',
      title: 'ЛЕДНИК', subtitle: 'Искра и песец Бураш собирают припасы до Великой Стужи',
      sub2: 'Три края · карта мира · секретные тропы',
      back: 'Каталог', reset: 'Сбросить карту', resetQ: 'Сбросить? ещё раз — да', resetDone: 'Карта сброшена', toMap: 'На карту',
      r1: 'Снежный бор', r2: 'Ледяная река', r3: 'Ледник',
      'n_1-1': 'Опушка', 'n_1-2': 'Сугробная падь', 'n_1-3': 'Старый ельник', 'n_1-4': 'Тропа зверей', 'n_1-S': 'Беличья кладовая', 'n_1-B': 'Логово Клыка',
      'n_2-1': 'Замёрзший брод', 'n_2-2': 'Ледяные мосты', 'n_2-3': 'Полыньи', 'n_2-4': 'Мамонтова отмель', 'n_2-S': 'Рыбачья лунка', 'n_2-B': 'Панцирь Хрустя',
      'n_3-1': 'Сосульчатый склон', 'n_3-2': 'Ветреный перевал', 'n_3-3': 'Синие пещеры', 'n_3-4': 'Гребень ледника', 'n_3-S': 'Янтарный грот', 'n_3-B': 'Гнездо Вьюги',
      b_fang: 'Старый Клык', b_shell: 'Хрусть', b_owl: 'Вьюжный Филин',
      bd_fang: 'Прыгает через логово. После прыжка — сбит с толку: бей бумерангом!',
      bd_shell: 'Катится от стены к стене. Перевернулся на спину — бей!',
      bd_owl: 'Роняет сосульки и дует вьюгой. Сел на снег — бей!',
      e_kitten: 'Саблезубый котёнок', e_beetle: 'Ледяной жук', e_mammoth: 'Мамонтёнок',
      sup: 'Припасы', need: 'норма', needMore: 'Нужно ещё {n}', enough: 'Норма собрана — к стойбищу!', full: 'ВСЕ ПРИПАСЫ! +жизнь',
      key: 'Костяной ключ!', keyHint: 'Ключ открыл тайную тропу на карте', camp: 'Костёр зажжён', heart: '+сердце',
      fox: 'Бураш, ищи!', foxNo: 'Бураш выбегает, когда Искра стоит', foxGot: 'Бураш принёс!', reveal: 'Нашёлся припас!',
      clear: 'ПРИПАСЫ ДОБЫТЫ', clearBoss: 'ПУТЬ СВОБОДЕН', bonus: 'Бонус', tapMap: 'пробел — на карту',
      mapTitle: 'КАРТА КРАЁВ', mapHint: '← → ↑ ↓ — тропа · Пробел/Enter — в путь · Esc — пауза',
      locked: 'тропа закрыта', secret: 'тайная тропа', cleared: 'пройден', fullTag: '100%', bossTag: 'вожак', secretTag: 'тайник', newTag: 'новый',
      stuzha: 'Стужа близко', lives: 'Жизни',
      d_fall: 'Сорвалась в пропасть', d_water: 'Провалилась в прорубь', d_hurt: 'Без сил', d_spike: 'Ледяные шипы', d_kitten: 'Котёнок', d_beetle: 'Жук', d_mammoth: 'Мамонтёнок', d_boss: 'Вожак', d_shard: 'Сосулька',
      hint: '←→ бег · Пробел прыжок · X бумеранг · C Бураш · ↓ подкат · ↑ сосулька · P пауза',
      intro: 'Великая Стужа идёт с севера. Племя ждёт припасов: еды, шкур и кремней.',
      foot: '<b>ЛЕДНИК</b> · ← → / A D — бег · Пробел / Z — прыжок (держи — выше) · X / J — бумеранг · C / F — песец Бураш · ↓ на бегу — подкат (на льду — далеко), ↓ стоя — пригнуться от ветра · ↑ — лезть по сосульке · P / Esc — пауза · L язык, T тема, M звук.'
    },
    en: {
      play: 'Set out', language: 'Language', theme: 'Theme', sound: 'Sound', on: 'on', off: 'off',
      score: 'Score', level: 'Level', best: 'Best', pause: 'PAUSE', resume: 'Resume', menu: 'Menu', tapstart: 'space / tap',
      win: 'THE TRIBE IS READY FOR THE COLD!', gameover: 'ISKRA HEADS BACK TO CAMP',
      title: 'LEDNIK', subtitle: 'Iskra and Burash the arctic fox gather supplies before the Great Cold',
      sub2: 'Three lands · world map · secret trails',
      back: 'Catalog', reset: 'Reset map', resetQ: 'Reset? once more — yes', resetDone: 'Map reset', toMap: 'To the map',
      r1: 'Snowy Pinewood', r2: 'Frozen River', r3: 'The Glacier',
      'n_1-1': 'Forest Edge', 'n_1-2': 'Drift Hollow', 'n_1-3': 'Old Spruce Grove', 'n_1-4': 'Beast Trail', 'n_1-S': 'Squirrel Larder', 'n_1-B': 'Fang’s Den',
      'n_2-1': 'Frozen Ford', 'n_2-2': 'Ice Bridges', 'n_2-3': 'Polynyas', 'n_2-4': 'Mammoth Shoal', 'n_2-S': 'Fishing Hole', 'n_2-B': 'Crackshell’s Bank',
      'n_3-1': 'Icicle Slope', 'n_3-2': 'Windy Pass', 'n_3-3': 'Blue Caves', 'n_3-4': 'Glacier Ridge', 'n_3-S': 'Amber Grotto', 'n_3-B': 'Blizzard Nest',
      b_fang: 'Old Fang', b_shell: 'Crackshell', b_owl: 'Blizzard Owl',
      bd_fang: 'Leaps across the den. Dazed after landing — boomerang him!',
      bd_shell: 'Rolls from wall to wall. Flipped on its back — strike!',
      bd_owl: 'Drops icicles and blows a blizzard. Landed in the snow — strike!',
      e_kitten: 'Sabre kitten', e_beetle: 'Ice beetle', e_mammoth: 'Mammoth calf',
      sup: 'Supplies', need: 'quota', needMore: '{n} more needed', enough: 'Quota met — head to camp!', full: 'ALL SUPPLIES! +life',
      key: 'Bone key!', keyHint: 'The key opened a secret trail on the map', camp: 'Campfire lit', heart: '+heart',
      fox: 'Burash, fetch!', foxNo: 'Burash runs out only while Iskra stands', foxGot: 'Burash brought it!', reveal: 'A hidden supply!',
      clear: 'SUPPLIES GATHERED', clearBoss: 'THE WAY IS CLEAR', bonus: 'Bonus', tapMap: 'space — to the map',
      mapTitle: 'MAP OF THE LANDS', mapHint: '← → ↑ ↓ — trail · Space/Enter — go · Esc — pause',
      locked: 'trail closed', secret: 'secret trail', cleared: 'cleared', fullTag: '100%', bossTag: 'leader', secretTag: 'hideout', newTag: 'new',
      stuzha: 'The Cold is near', lives: 'Lives',
      d_fall: 'Fell into the chasm', d_water: 'Fell through the ice', d_hurt: 'Out of strength', d_spike: 'Ice spikes', d_kitten: 'Kitten', d_beetle: 'Beetle', d_mammoth: 'Mammoth calf', d_boss: 'Leader', d_shard: 'Icicle',
      hint: '←→ run · Space jump · X boomerang · C Burash · ↓ slide · ↑ icicle · P pause',
      intro: 'The Great Cold is coming from the north. The tribe needs supplies: food, hides and flints.',
      foot: '<b>LEDNIK</b> · ← → / A D — run · Space / Z — jump (hold — higher) · X / J — boomerang · C / F — Burash the fox · ↓ while running — slide (far on ice), ↓ standing — crouch against wind · ↑ — climb icicles · P / Esc — pause · L language, T theme, M sound.'
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
