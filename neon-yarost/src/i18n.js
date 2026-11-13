/* ============================================================
   НЕОН × ЯРОСТЬ: NEON YAROST — локализация RU/EN
   ------------------------------------------------------------
   Канонические ключи — docs/CONTRACT.md §9. Наборы ключей в `ru` и `en`
   обязаны совпадать: tmp/check-i18n.mjs проверяет паритет, плейсхолдеры
   и отсутствие «чужих» букв (RU без латинских обрывков, EN без кириллицы).

   API:
     window.NR_I18N = { ru: { 'menu.play': '...' }, en: { ... } }
     window.NR_T(key, vars) -> строка
       • разрешает плоские ключи и вложенные ('banner.wave');
       • подставляет {n}, {total}, {name}, {score}, {value} из vars;
       • язык берёт из NR.settings.lang (ru по умолчанию, пока NR нет);
       • нет строки в выбранном языке -> fallback на ru -> вернуть сам key;
       • не бросает исключений ни при каких аргументах.
   Строки короткие: UI-плашки 480×270, шрифт 6×8, тело текста переносится.
   ============================================================ */
(function () {
  'use strict';

  var ru = {
    /* ---------- приложение ---------- */
    'app.title': 'НЕОН × ЯРОСТЬ',
    'app.subtitle': 'NEON YAROST',
    'app.tribute': 'оригинал студии «Гефест»',
    'app.footer': 'Canvas 2D · WebAudio · один HTML-файл',
    'app.loading': 'ЗАГРУЗКА НЕОНА…',

    /* ---------- меню ---------- */
    'menu.play': 'ИГРАТЬ',
    'menu.help': 'УПРАВЛЕНИЕ',
    'menu.settings': 'НАСТРОЙКИ',
    'menu.about': 'ОБ ИГРЕ',
    'menu.resume': 'ПРОДОЛЖИТЬ',
    'menu.restart': 'ЗАНОВО',
    'menu.retry': 'ЕЩЁ РАЗ',
    'menu.mainmenu': 'В МЕНЮ',

    /* ---------- титул ---------- */
    'title.tagline': 'ДВА БОЙЦА. ОДНА УЛИЦА. НОЛЬ ПОЩАДЫ.',
    'title.press': 'НАЖМИ ENTER',
    'title.best': 'РЕКОРД',
    'title.hint': '↑ ↓ — выбор · ENTER — ок · мышь/тап тоже работает',
    'title.version': 'v1.0 · НЕОН-РЕМАСТЕР',

    /* ---------- выбор бойца ---------- */
    'select.title': 'ВЫБЕРИ БОЙЦА',
    'select.subtitle': 'ДВА СТИЛЯ. ОДНА ЦЕЛЬ.',
    'select.difficulty': 'СЛОЖНОСТЬ',
    'select.hint': '← → — боец · ↑ ↓ — сложность · ENTER — в бой',
    'select.start': 'ENTER — В БОЙ',

    /* ---------- персонажи ---------- */
    'char.comet.name': 'КАЙ',
    'char.comet.alias': 'КОМЕТА',
    'char.comet.desc': 'Быстрый и точный. Серии из трёх ударов, огненный апперкот.',
    'char.comet.spec': 'СПЕЦ: ОГНЕННОЕ КОЛЬЦО',
    'char.hammer.name': 'РОК',
    'char.hammer.alias': 'МОЛОТ',
    'char.hammer.desc': 'Киборг-кузнец с рукой-молотом. Больше здоровья.',
    'char.hammer.spec': 'СПЕЦ: ЗЕМЛЯНОЙ СЛЭМ',
    'stat.power': 'СИЛА',
    'stat.speed': 'СКОРОСТЬ',
    'stat.armor': 'БРОНЯ',
    'stat.range': 'РАДИУС',
    'diff.easy': 'ЛЕГКО',
    'diff.normal': 'НОРМА',
    'diff.hard': 'ХАРД',

    /* ---------- сюжетная карточка ---------- */
    'intro.chapter': 'ГЛАВА 1',
    'intro.title': 'УКРАДЕННЫЙ ЧИП',
    'intro.text1': 'НЕОН-СИТИ. Корпорация «ТОКСИК» украла чип NEON-8 — сердце города.',
    'intro.text2': 'Без него гаснут вывески, а улицы делят банды. Город вот-вот замолчит.',
    'intro.text3': 'Кай-Комета и Рок-Молот выходят на улицу. Вдвоём. Но играть будешь одним.',
    'intro.start': 'ENTER — НАЧАТЬ',
    'intro.skip': 'ESC — ПРОПУСТИТЬ',

    /* ---------- управление ---------- */
    'help.title': 'УПРАВЛЕНИЕ',
    'help.move': 'ДВИЖЕНИЕ',
    'help.moveKeys': '← → ↑ ↓ / WASD',
    'help.jump': 'ПРЫЖОК',
    'help.jumpKeys': 'SPACE',
    'help.punch': 'УДАР',
    'help.punchKeys': 'J / Z — серия из 3',
    'help.kick': 'ПИНОК',
    'help.kickKeys': 'K / X — тяжёлый',
    'help.special': 'ЯРОСТЬ',
    'help.specialKeys': 'V — при полной шкале',
    'help.pause': 'ПАУЗА',
    'help.pauseKeys': 'ESC / P',
    'help.quick': 'БЫСТРО',
    'help.quickKeys': 'T/G графика · L язык · M звук · F экран',
    'help.combo': 'КОМБО',
    'help.comboText': 'Чередуй удары и пинки — множитель очков растёт.',
    'help.air': 'В ВОЗДУХЕ',
    'help.airText': 'Атака в прыжке бьёт по площади.',
    'help.rage': 'ШКАЛА ЯРОСТИ',
    'help.rageText': 'Заполняется от попаданий. Спецприём бьёт всех вокруг.',
    'help.tipTitle': 'СОВЕТ',
    'help.tip': 'Бей по одному — не давай окружить. Еда в ящиках лечит.',
    'help.back': 'ESC — НАЗАД',

    /* ---------- настройки ---------- */
    'settings.title': 'НАСТРОЙКИ',
    'settings.lang': 'ЯЗЫК',
    'settings.gfx': 'ГРАФИКА',
    'settings.music': 'МУЗЫКА',
    'settings.audioStyle': 'СТИЛЬ МУЗЫКИ',
    'settings.sfx': 'ЗВУКИ',
    'settings.volume': 'ГРОМКОСТЬ',
    'settings.crt': 'CRT-ФИЛЬТР',
    'settings.difficulty': 'СЛОЖНОСТЬ',
    'settings.reset': 'СБРОСИТЬ РЕКОРД',
    'settings.resetDone': 'РЕКОРД СБРОШЕН',
    'settings.hint': '← → — изменить · ESC — назад',

    /* ---------- общее ---------- */
    'common.on': 'ВКЛ',
    'common.off': 'ВЫКЛ',
    'common.back': 'НАЗАД',
    'common.hint': 'мышь/тап тоже работает',
    'gfx.retro': '8-БИТ',
    'gfx.modern': 'НЕОН',
    'audio.chip': '8-БИТ',
    'audio.synth': 'СИНТВЕЙВ',

    /* ---------- быстрые чипы ---------- */
    'quick.gfx': 'ГРАФИКА',
    'quick.lang': 'ЯЗЫК',
    'quick.music': 'МУЗЫКА',
    'quick.full': 'ЭКРАН',

    /* ---------- зоны ---------- */
    'zone.street': 'НЕОНОВЫЙ ПРОСПЕКТ',
    'zone.streetSub': 'КВАРТАЛ 7 · НОЧЬ',
    'zone.arcade': 'АРКАДНЫЙ ПЕРЕУЛОК',
    'zone.arcadeSub': 'ПОД ВЫВЕСКОЙ «24/7»',
    'zone.roof': 'КРЫША «ТОКСИК»',
    'zone.roofSub': 'ВЫСОТА 300 М · ВЕТЕР',

    /* ---------- HUD ---------- */
    'hud.score': 'ОЧКИ',
    'hud.best': 'РЕКОРД',
    'hud.lives': 'ЖИЗНИ',
    'hud.wave': 'ВОЛНА',
    'hud.rage': 'ЯРОСТЬ',
    'hud.combo': 'КОМБО',
    'hud.boss': 'ИИ ХРОМ-9',
    'hud.fight': 'В БОЙ!',
    'hud.clear': 'ЗАЧИЩЕНО',
    'hud.advance': 'ВПЕРЁД →',
    'hud.specialReady': 'ЯРОСТЬ ГОТОВА',
    'hud.ready': 'ГОТОВ',
    'hud.go': 'ВПЕРЁД',
    'hud.mul': 'МНОЖИТЕЛЬ',
    'hud.x': '×',
    'hud.time': 'ВРЕМЯ',

    /* ---------- баннеры ---------- */
    'banner.wave': 'ВОЛНА {n}/{total}',
    'banner.final': 'ФИНАЛЬНАЯ ВОЛНА',
    'banner.clear': 'ВОЛНА ЗАЧИЩЕНА',
    'banner.advance': 'ВПЕРЁД →',
    'banner.zone': '{name}',
    'banner.boss': 'ФИНАЛЬНЫЙ БОСС',
    'banner.bossSub': 'ЯДРО КОРПОРАЦИИ «ТОКСИК»',
    'banner.victory': 'ГОРОД СВОБОДЕН',
    'banner.defeat': 'УЛИЦА СИЛЬНЕЕ',

    /* ---------- всплывающие значения ---------- */
    'popup.heal': '+{n} HP',
    'popup.rage': 'ЯРОСТЬ ГОТОВА!',
    'popup.score': '+{n}',

    /* ---------- босс ---------- */
    'boss.name': 'ИИ ХРОМ-9',
    'boss.sub': 'ЯДРО КОРПОРАЦИИ «ТОКСИК»',
    'boss.taunt1': '«Вы опоздали. Город уже подключён ко мне.»',
    'boss.taunt2': '«Весь неон города — моё питание.»',
    'boss.phase2': '«ПЕРЕГРУЗКА!»',

    /* ---------- пауза ---------- */
    'pause.title': 'ПАУЗА',
    'pause.hint': 'ESC — продолжить',

    /* ---------- финальные экраны ---------- */
    'end.gameoverTitle': 'ИГРА ОКОНЧЕНА',
    'end.gameoverSub': 'УЛИЦА ЗАБРАЛА ЕЩЁ ОДНОГО',
    'end.victoryTitle': 'ГОРОД СПАСЁН',
    'end.victorySub': 'ЧИП NEON-8 ВОЗВРАЩЁН. ГОРОД СНОВА ЗВУЧИТ.',
    'end.score': 'ОЧКИ',
    'end.time': 'ВРЕМЯ',
    'end.kills': 'ПОБЕД',
    'end.maxCombo': 'МАКС. КОМБО',
    'end.newBest': 'НОВЫЙ РЕКОРД!',
    'end.best': 'РЕКОРД',

    /* ---------- об игре ---------- */
    'about.title': 'ОБ ИГРЕ',
    'about.text1': 'Оригинальный beat-em-up студии «Гефест».',
    'about.text2': 'Все персонажи, графика и музыка оригинальны и созданы кодом — без внешних ассетов.',
    'about.text3': 'Ретро- и неон-рендеры рисуют один и тот же бой, а музыка синтезируется в WebAudio.',
    'about.tech': 'Canvas 2D · WebAudio · ES2019 · 0 внешних файлов',
    'about.credits': 'СТУДИЯ ГЕФЕСТ · 2026',
    'about.back': 'ESC — НАЗАД'
  };

  var en = {
    /* ---------- app ---------- */
    'app.title': 'НЕОН × ЯРОСТЬ',
    'app.subtitle': 'NEON YAROST',
    'app.tribute': 'an original by Hefest studio',
    'app.footer': 'Canvas 2D · WebAudio · one HTML file',
    'app.loading': 'LOADING NEON…',

    /* ---------- menu ---------- */
    'menu.play': 'PLAY',
    'menu.help': 'CONTROLS',
    'menu.settings': 'SETTINGS',
    'menu.about': 'ABOUT',
    'menu.resume': 'RESUME',
    'menu.restart': 'RESTART',
    'menu.retry': 'RETRY',
    'menu.mainmenu': 'MAIN MENU',

    /* ---------- title ---------- */
    'title.tagline': 'TWO FIGHTERS. ONE STREET. NO MERCY.',
    'title.press': 'PRESS ENTER',
    'title.best': 'BEST',
    'title.hint': '↑ ↓ — select · ENTER — ok · mouse/tap works too',
    'title.version': 'v1.0 · NEON REMASTER',

    /* ---------- fighter select ---------- */
    'select.title': 'CHOOSE YOUR FIGHTER',
    'select.subtitle': 'TWO STYLES. ONE GOAL.',
    'select.difficulty': 'DIFFICULTY',
    'select.hint': '← → — fighter · ↑ ↓ — difficulty · ENTER — fight',
    'select.start': 'ENTER — FIGHT',

    /* ---------- characters ---------- */
    'char.comet.name': 'KAI',
    'char.comet.alias': 'COMET',
    'char.comet.desc': 'Fast and precise. Three-hit chains and a fire uppercut.',
    'char.comet.spec': 'SPECIAL: FIRE RING',
    'char.hammer.name': 'ROCK',
    'char.hammer.alias': 'HAMMER',
    'char.hammer.desc': 'Cyborg smith with a hammer arm. More health.',
    'char.hammer.spec': 'SPECIAL: EARTH SLAM',
    'stat.power': 'POWER',
    'stat.speed': 'SPEED',
    'stat.armor': 'ARMOR',
    'stat.range': 'RANGE',
    'diff.easy': 'EASY',
    'diff.normal': 'NORMAL',
    'diff.hard': 'HARD',

    /* ---------- intro ---------- */
    'intro.chapter': 'CHAPTER 1',
    'intro.title': 'THE STOLEN CHIP',
    'intro.text1': 'NEON CITY. The TOXIC corporation stole the NEON-8 chip — the heart of the city.',
    'intro.text2': 'Without it the neon dies and the gangs split the streets. Soon the city goes silent.',
    'intro.text3': 'Kai the Comet and Rock the Hammer step out. Two heroes. One player. You.',
    'intro.start': 'ENTER — START',
    'intro.skip': 'ESC — SKIP',

    /* ---------- controls ---------- */
    'help.title': 'CONTROLS',
    'help.move': 'MOVE',
    'help.moveKeys': '← → ↑ ↓ / WASD',
    'help.jump': 'JUMP',
    'help.jumpKeys': 'SPACE',
    'help.punch': 'PUNCH',
    'help.punchKeys': 'J / Z — 3-hit chain',
    'help.kick': 'KICK',
    'help.kickKeys': 'K / X — heavy',
    'help.special': 'FURY',
    'help.specialKeys': 'V — when the meter is full',
    'help.pause': 'PAUSE',
    'help.pauseKeys': 'ESC / P',
    'help.quick': 'QUICK',
    'help.quickKeys': 'T/G graphics · L language · M sound · F fullscreen',
    'help.combo': 'COMBO',
    'help.comboText': 'Mix punches and kicks — the score multiplier climbs.',
    'help.air': 'IN THE AIR',
    'help.airText': 'A jump attack hits everything below.',
    'help.rage': 'RAGE METER',
    'help.rageText': 'Charges on hits. The special hits everyone around you.',
    'help.tipTitle': 'TIP',
    'help.tip': 'Take them one on one — never get surrounded. Food in crates heals.',
    'help.back': 'ESC — BACK',

    /* ---------- settings ---------- */
    'settings.title': 'SETTINGS',
    'settings.lang': 'LANGUAGE',
    'settings.gfx': 'GRAPHICS',
    'settings.music': 'MUSIC',
    'settings.audioStyle': 'MUSIC STYLE',
    'settings.sfx': 'SFX',
    'settings.volume': 'VOLUME',
    'settings.crt': 'CRT FILTER',
    'settings.difficulty': 'DIFFICULTY',
    'settings.reset': 'RESET BEST SCORE',
    'settings.resetDone': 'BEST SCORE RESET',
    'settings.hint': '← → — change · ESC — back',

    /* ---------- common ---------- */
    'common.on': 'ON',
    'common.off': 'OFF',
    'common.back': 'BACK',
    'common.hint': 'mouse/tap works too',
    'gfx.retro': '8-BIT',
    'gfx.modern': 'NEON',
    'audio.chip': '8-BIT',
    'audio.synth': 'SYNTHWAVE',

    /* ---------- quick chips ---------- */
    'quick.gfx': 'GRAPHICS',
    'quick.lang': 'LANGUAGE',
    'quick.music': 'MUSIC',
    'quick.full': 'SCREEN',

    /* ---------- zones ---------- */
    'zone.street': 'NEON AVENUE',
    'zone.streetSub': 'BLOCK 7 · NIGHT',
    'zone.arcade': 'ARCADE ALLEY',
    'zone.arcadeSub': 'UNDER THE "24/7" SIGN',
    'zone.roof': 'TOXIC ROOFTOP',
    'zone.roofSub': '300 M UP · HIGH WIND',

    /* ---------- HUD ---------- */
    'hud.score': 'SCORE',
    'hud.best': 'BEST',
    'hud.lives': 'LIVES',
    'hud.wave': 'WAVE',
    'hud.rage': 'FURY',
    'hud.combo': 'COMBO',
    'hud.boss': 'KHROM-9 AI',
    'hud.fight': 'FIGHT!',
    'hud.clear': 'CLEARED',
    'hud.advance': 'GO →',
    'hud.specialReady': 'RAGE READY',
    'hud.ready': 'READY',
    'hud.go': 'GO',
    'hud.mul': 'MULTIPLIER',
    'hud.x': '×',
    'hud.time': 'TIME',

    /* ---------- banners ---------- */
    'banner.wave': 'WAVE {n}/{total}',
    'banner.final': 'FINAL WAVE',
    'banner.clear': 'WAVE CLEARED',
    'banner.advance': 'GO →',
    'banner.zone': '{name}',
    'banner.boss': 'FINAL BOSS',
    'banner.bossSub': 'TOXIC CORPORATE CORE',
    'banner.victory': 'THE CITY IS FREE',
    'banner.defeat': 'THE STREET WINS',

    /* ---------- popups ---------- */
    'popup.heal': '+{n} HP',
    'popup.rage': 'RAGE READY!',
    'popup.score': '+{n}',

    /* ---------- boss ---------- */
    'boss.name': 'KHROM-9 AI',
    'boss.sub': 'TOXIC CORPORATE CORE',
    'boss.taunt1': 'Too late. The city is already wired to me.',
    'boss.taunt2': 'Every neon sign is my power supply.',
    'boss.phase2': 'OVERLOAD!',

    /* ---------- pause ---------- */
    'pause.title': 'PAUSED',
    'pause.hint': 'ESC — resume',

    /* ---------- end screens ---------- */
    'end.gameoverTitle': 'GAME OVER',
    'end.gameoverSub': 'THE STREET CLAIMED ANOTHER ONE',
    'end.victoryTitle': 'CITY SAVED',
    'end.victorySub': 'THE NEON-8 CHIP IS BACK. THE CITY SINGS AGAIN.',
    'end.score': 'SCORE',
    'end.time': 'TIME',
    'end.kills': 'KILLS',
    'end.maxCombo': 'MAX COMBO',
    'end.newBest': 'NEW BEST!',
    'end.best': 'BEST',

    /* ---------- about ---------- */
    'about.title': 'ABOUT',
    'about.text1': 'An original beat-em-up by Hefest studio.',
    'about.text2': 'Every character, sprite and note is original and made in code — no external assets.',
    'about.text3': 'The retro and modern renderers draw the same fight; the music is synthesized in WebAudio.',
    'about.tech': 'Canvas 2D · WebAudio · ES2019 · zero external files',
    'about.credits': 'HEFEST STUDIO · 2026',
    'about.back': 'ESC — BACK'
  };

  var DICT = { ru: ru, en: en };
  var PLACEHOLDER = /\{([a-z][a-z0-9_]*)\}/gi;

  /* язык: NR.settings.lang, пока NR нет — ru (по умолчанию по контракту) */
  function currentLang() {
    try {
      var nr = window.NR;
      if (nr && nr.settings && nr.settings.lang === 'en') return 'en';
    } catch (e) { /* состояние ещё не поднято — молча ru */ }
    return 'ru';
  }

  /* плоский ключ ('menu.play') или вложенный ('menu' -> 'play') */
  function lookup(dict, key) {
    if (!dict || key === null || key === undefined) return undefined;
    var k = String(key);
    if (Object.prototype.hasOwnProperty.call(dict, k)) {
      var direct = dict[k];
      if (typeof direct === 'string') return direct;
    }
    var parts = k.split('.');
    var node = dict;
    for (var i = 0; i < parts.length; i++) {
      if (node === null || typeof node !== 'object' ||
          !Object.prototype.hasOwnProperty.call(node, parts[i])) return undefined;
      node = node[parts[i]];
    }
    return typeof node === 'string' ? node : undefined;
  }

  /* {n}, {total}, {name}, {score}, {value}; неизвестные плейсхолдеры не трогаем */
  function fill(template, vars) {
    if (!vars || typeof vars !== 'object') return template;
    return template.replace(PLACEHOLDER, function (whole, name) {
      var v = vars[name];
      if (v === undefined || v === null) return whole;
      return String(v);
    });
  }

  function t(key, vars) {
    try {
      var raw = undefined;
      try { raw = lookup(DICT[currentLang()], key); } catch (e) { raw = undefined; }
      if (raw === undefined) {
        try { raw = lookup(ru, key); } catch (e) { raw = undefined; }
      }
      if (raw === undefined) return key === null || key === undefined ? '' : String(key);
      return fill(raw, vars);
    } catch (e) {
      return key === null || key === undefined ? '' : String(key);
    }
  }

  window.NR_I18N = DICT;
  window.NR_T = t;
})();
