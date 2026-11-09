/* ============================================================================
   CONTRA: НЕОНОВЫЙ РАССВЕТ / NEON DAWN
   A fan-made HTML5 run-and-gun tribute. Single file, no dependencies.
   Two renderers (modern NEON / 1988 8-BIT), Russian + English UI,
   original WebAudio chiptune soundtrack (see audio.js).
   ============================================================================ */
(function () {
  'use strict';

  /* --------------------------------------------------------------------------
     0. BOOT / ERROR REPORTING
     -------------------------------------------------------------------------- */
  var bootErrs = [];
  window.addEventListener('error', function (ev) {
    bootErrs.push(String((ev && ev.message) || ev));
    try { console.error('[CONTRA]', ev.message, ev.filename, ev.lineno); } catch (e) {}
  });
  window.addEventListener('unhandledrejection', function (ev) {
    bootErrs.push('promise: ' + String(ev.reason));
    try { console.error('[CONTRA] promise', ev.reason); } catch (e) {}
  });

  /* --------------------------------------------------------------------------
     1. CONSTANTS
     -------------------------------------------------------------------------- */
  var VW = 480, VH = 270;
  var GROUND_Y = 232;             // top edge of the ground
  var GROUND_H = 40;
  var P_W = 12, P_H = 26, P_PRONE_H = 13;
  var RUN = 152, ACCEL = 1700, AIR_ACCEL = 950;
  var FRICTION = 2100, AIR_DRAG = 420;
  var GRAV = 980, MAX_FALL = 620, JUMP_V = -346;
  var COYOTE = 0.10, JUMP_BUFFER = 0.12;
  var BULLET_CAP = 90, EBULLET_CAP = 120, PART_CAP = 420;
  var MODERN_W = 1440, MODERN_H = 810; // 3x backing store
  var STORE_PREFIX = 'contra.';

  /* --------------------------------------------------------------------------
     2. UTILITIES
     -------------------------------------------------------------------------- */
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function approach(v, target, step) {
    if (v < target) return Math.min(v + step, target);
    if (v > target) return Math.max(v - step, target);
    return target;
  }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function randInt(a, b) { return Math.floor(rand(a, b + 1)); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function pad(n, len) {
    var s = String(Math.max(0, Math.floor(n)));
    while (s.length < len) s = '0' + s;
    return s.slice(-len);
  }
  function fmtTime(sec) {
    sec = Math.max(0, Math.floor(sec));
    return pad(Math.floor(sec / 60), 2) + ':' + pad(sec % 60, 2);
  }
  function aabb(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }
  function dist2(ax, ay, bx, by) {
    var dx = ax - bx, dy = ay - by;
    return dx * dx + dy * dy;
  }
  // deterministic pseudo-random from integer seed
  function hash(n) {
    n = (n << 13) ^ n;
    return ((n * (n * n * 15731 + 789221) + 1376312589) & 0x7fffffff) / 0x7fffffff;
  }
  function hash2(a, b) { return hash((a | 0) * 374761393 + (b | 0) * 668265263); }
  function sign(v) { return v < 0 ? -1 : (v > 0 ? 1 : 0); }

  function loadStr(key, fallback) {
    try { var v = localStorage.getItem(STORE_PREFIX + key); return v == null ? fallback : v; } catch (e) { return fallback; }
  }
  function saveStr(key, val) {
    try { localStorage.setItem(STORE_PREFIX + key, String(val)); } catch (e) {}
  }
  function loadNum(key, fallback) {
    var v = parseFloat(loadStr(key, ''));
    return isFinite(v) ? v : fallback;
  }

  /* --------------------------------------------------------------------------
     3. LOCALISATION
     -------------------------------------------------------------------------- */
  var I18N = {
    ru: {
      eyebrow: 'ФАНАТСКИЙ РЕМЕЙК · 1988 / 20XX',
      subtitle: 'НЕОНОВЫЙ РАССВЕТ',
      tagline: 'Джунгли горят. Крепость ждёт. Ты — последний шанс человечества. Прорвись сквозь ад и вырви сердце «Гелиоса».',
      menuHead: 'ГЛАВНОЕ МЕНЮ',
      menuStart: 'Начать операцию',
      menuHowto: 'Как играть',
      menuSettings: 'Настройки',
      record: 'РЕКОРД',
      graphicsShort: 'ГРАФИКА',
      languageShort: 'ЯЗЫК',
      soundShort: 'ЗВУК',
      opName: 'ОПЕРАЦИЯ «РАССВЕТ»',
      objectives: 'ЗАДАЧИ',
      briefZone: 'ЗОНА',
      briefBoss: 'ЦЕЛЬ',
      briefWeapons: 'АРСЕНАЛ',
      briefLives: 'ЖИЗНИ',
      beginOperation: 'НАЧАТЬ ОПЕРАЦИЮ',
      back: 'НАЗАД',
      briefHint: 'СОВЕТ: ДЕРЖИ ↑ ИЛИ ↓, ЧТОБЫ СТРЕЛЯТЬ ПО ДИАГОНАЛИ. ↓ НА ЗЕМЛЕ — ЛОЖИТЬСЯ.',
      training: 'ПОДГОТОВКА',
      oneHit: 'ОДИН УДАР — СМЕРТЬ',
      howtoTitle: 'КАК ИГРАТЬ',
      howtoLede: 'Классический run-and-gun: беги вправо, стреляй в восьми направлениях, собирай оружие и не дай врагам зажать тебя в углу. Один контакт с пулей или телом врага — потеря жизни.',
      controls: 'УПРАВЛЕНИЕ',
      ctlMove: '<b>Бег</b> влево и вправо',
      ctlAim: '<b>Прицел</b> вверх, вниз и по диагонали; <b>↓</b> на земле — лечь',
      ctlJump: '<b>Прыжок</b>; держи дольше — прыгнешь выше. <b>↓ + прыжок</b> — спрыгнуть с платформы',
      ctlFire: '<b>Огонь</b>. Удерживай для автоматической стрельбы',
      ctlPause: '<b>Пауза</b> и меню',
      ctlToggles: '<b>Графика</b> (неон / 8-бит), <b>язык</b>, <b>звук</b> — работают в любой момент',
      fieldNotes: 'ЗАМЕТКИ С ФРОНТА',
      tip1: 'Бей <b>летающие капсулы</b>: из них выпадает оружие <b>S</b> (дробовик), <b>M</b> (пулемёт), <b>L</b> (лазер) и <b>B</b> (щит).',
      tip2: 'У каждого босса есть <b>слабое место</b> и свой ритм атаки. Учись, умирай, повторяй — это Contra.',
      tip3: 'Прыжок <b>гасится</b>, если отпустить кнопку раньше. Это спасает от пуль.',
      tip4: 'Секрет: на титуле попробуй <b>↑ ↑ ↓ ↓ ← → ← → B A</b>.',
      system: 'СИСТЕМА',
      offline: 'РАБОТАЕТ ОФЛАЙН',
      settingsTitle: 'НАСТРОЙКИ',
      settingsLede: 'Игра сохраняет выбор автоматически. Переключай стиль на лету — геймплей не меняется, меняется только мир вокруг.',
      graphics: 'ГРАФИКА',
      language: 'ЯЗЫК',
      sound: 'ЗВУК',
      audioNote: 'ЗВУК',
      audioDesc: 'Оригинальный чиптюн-саундтрек: четыре канала, живой секвенсор WebAudio, никаких файлов. Музыка включается после первого нажатия клавиши — так требуют браузеры.',
      pauseTag: 'ПАУЗА',
      pauseTitle: 'ПЕРЕДЫШКА',
      pauseLede: 'Война подождёт. Но недолго.',
      resume: 'ПРОДОЛЖИТЬ',
      toMenu: 'В ГЛАВНОЕ МЕНЮ',
      missionFailed: 'СИГНАЛ ПОТЕРЯН',
      gameOverTitle: 'ОПЕРАЦИЯ ПРОВАЛЕНА',
      gameOverLede: 'Отряд «Рубеж» потерял связь. Но у тебя ещё есть шанс — перегруппируйся и войди снова.',
      stage: 'ЭТАП',
      retry: 'ПОВТОРИТЬ ЭТАП',
      stageClearTag: 'СЕКТОР ЗАЧИЩЕН',
      stageClearTitle: 'ЭТАП ПРОЙДЕН',
      stageClearLede: 'Вертолёт «Страж» рухнул в джунгли. Дорога к крепости открыта — но это только начало.',
      time: 'ВРЕМЯ',
      lives: 'ЖИЗНИ',
      continueOp: 'ПРОДОЛЖИТЬ ОПЕРАЦИЮ',
      nextHint: 'СЛЕДУЮЩАЯ ЦЕЛЬ: КРЕПОСТЬ «ГЕЛИОС»',
      missionComplete: 'МИССИЯ ВЫПОЛНЕНА',
      winTitle: 'РАССВЕТ',
      winText: 'Ядро «Гелиос» погасло. Крепость пала. Над джунглями впервые за десять лет встаёт солнце — и ты встречаешь его стоя. Легенда «Контры» вернулась.',
      badgeNoDeath: 'БЕЗ ПОТЕРЬ',
      badgeSpeed: 'СКОРОСТНОЙ ПРОРЫВ',
      badgeCode: 'КОД КОНАМИ',
      newRun: 'НОВЫЙ ЗАБЕГ',
      hudLives: 'ЖИЗНИ',
      hudScore: 'СЧЁТ',
      hudWeapon: 'ОРУЖИЕ',
      hudShield: 'ЩИТ',
      gfxModern: 'НЕОН',
      gfxRetro: '8-БИТ',
      gfxModernLong: 'НЕОН · 20XX',
      gfxRetroLong: '8-БИТ · 1988',
      langRu: 'РУССКИЙ',
      langEn: 'АНГЛИЙСКИЙ',
      langRuShort: 'РУС',
      langEnShort: 'ENG',
      on: 'ВКЛ',
      off: 'ВЫКЛ',
      onLong: 'ВКЛЮЧЁН',
      offLong: 'ВЫКЛЮЧЕН',
      checkpoint: 'КОНТРОЛЬНАЯ ТОЧКА',
      checkpointStart: 'КОНТРОЛЬНАЯ ТОЧКА: СТАРТ',
      checkpointNum: 'КОНТРОЛЬНАЯ ТОЧКА: {n}',
      weaponGot: 'ОРУЖИЕ: {name}',
      shieldGot: 'ЩИТ: 3 ЗАРЯДА',
      extraLife: 'БОНУС · +1 ЖИЗНЬ',
      konami: 'КОД КОНАМИ · +30 ЖИЗНЕЙ',
      bossWarning: 'ВНИМАНИЕ · БОСС',
      bossLabel: 'БОСС',
      stageStart: 'ЭТАП {n} · {name}',
      stageName: 'ЭТАП',
      hull: 'КОРПУС',
      timeShort: 'ВРЕМЯ',
      newRecord: 'НОВЫЙ РЕКОРД',
      backHint: 'ESC — НАЗАД · ENTER — ВЫБРАТЬ',
      menuHint: '↑ ↓ — ВЫБОР · ENTER — ПОДТВЕРДИТЬ',
      touchHint: 'КАСАЙТЕСЬ КНОПОК НА ЭКРАНЕ',
      rotateTitle: 'ПОВЕРНИ УСТРОЙСТВО',
      rotateText: 'Contra играется в горизонтальной ориентации. Поверни телефон — и в бой.',
      debug: 'ОТЛАДКА'
    },
    en: {
      eyebrow: 'FAN REMAKE · 1988 / 20XX',
      subtitle: 'NEON DAWN',
      tagline: 'The jungle is burning. The fortress is waiting. You are humanity’s last chance. Break through hell and tear out the heart of Helios.',
      menuHead: 'MAIN MENU',
      menuStart: 'Start operation',
      menuHowto: 'How to play',
      menuSettings: 'Settings',
      record: 'BEST',
      graphicsShort: 'GRAPHICS',
      languageShort: 'LANG',
      soundShort: 'SOUND',
      opName: 'OPERATION DAWN',
      objectives: 'OBJECTIVES',
      briefZone: 'ZONE',
      briefBoss: 'TARGET',
      briefWeapons: 'ARSENAL',
      briefLives: 'LIVES',
      beginOperation: 'BEGIN OPERATION',
      back: 'BACK',
      briefHint: 'TIP: HOLD ↑ OR ↓ TO SHOOT DIAGONALLY. ↓ ON THE GROUND — PRONE.',
      training: 'BRIEFING',
      oneHit: 'ONE HIT — DEATH',
      howtoTitle: 'HOW TO PLAY',
      howtoLede: 'Classic run-and-gun: run right, shoot in eight directions, grab weapons and never let enemies corner you. One touch from a bullet or an enemy costs a life.',
      controls: 'CONTROLS',
      ctlMove: '<b>Run</b> left and right',
      ctlAim: '<b>Aim</b> up, down and diagonally; <b>↓</b> on the ground — prone',
      ctlJump: '<b>Jump</b>; hold longer to jump higher. <b>↓ + jump</b> — drop through a platform',
      ctlFire: '<b>Fire</b>. Hold for automatic fire',
      ctlPause: '<b>Pause</b> and menu',
      ctlToggles: '<b>Graphics</b> (neon / 8-bit), <b>language</b>, <b>sound</b> — work anytime',
      fieldNotes: 'FIELD NOTES',
      tip1: 'Shoot the <b>flying capsules</b>: they drop <b>S</b> (spread), <b>M</b> (machine gun), <b>L</b> (laser) and <b>B</b> (shield).',
      tip2: 'Every boss has a <b>weak spot</b> and an attack rhythm. Learn, die, repeat — this is Contra.',
      tip3: 'Your jump is <b>cut</b> when you release the button early. It saves lives.',
      tip4: 'Secret: on the title screen try <b>↑ ↑ ↓ ↓ ← → ← → B A</b>.',
      system: 'SYSTEM',
      offline: 'WORKS OFFLINE',
      settingsTitle: 'SETTINGS',
      settingsLede: 'Your choices are saved automatically. Switch the style on the fly — gameplay stays the same, only the world around you changes.',
      graphics: 'GRAPHICS',
      language: 'LANGUAGE',
      sound: 'SOUND',
      audioNote: 'AUDIO',
      audioDesc: 'An original chiptune soundtrack: four channels, a live WebAudio sequencer, zero files. Music starts after your first key press — browser policy.',
      pauseTag: 'PAUSED',
      pauseTitle: 'CEASEFIRE',
      pauseLede: 'The war can wait. But not for long.',
      resume: 'RESUME',
      toMenu: 'MAIN MENU',
      missionFailed: 'SIGNAL LOST',
      gameOverTitle: 'OPERATION FAILED',
      gameOverLede: 'Contra lost the signal. But you still have a chance — regroup and breach again.',
      stage: 'STAGE',
      retry: 'RETRY STAGE',
      stageClearTag: 'SECTOR CLEARED',
      stageClearTitle: 'STAGE CLEARED',
      stageClearLede: 'The Guardian gunship is down in the jungle. The road to the fortress is open — but this is only the beginning.',
      time: 'TIME',
      lives: 'LIVES',
      continueOp: 'CONTINUE OPERATION',
      nextHint: 'NEXT TARGET: FORTRESS HELIOS',
      missionComplete: 'MISSION COMPLETE',
      winTitle: 'DAWN',
      winText: 'The Helios core is dark. The fortress has fallen. For the first time in ten years the sun rises over the jungle — and you meet it standing. The legend of Contra is back.',
      badgeNoDeath: 'NO CASUALTIES',
      badgeSpeed: 'SPEEDRUN',
      badgeCode: 'KONAMI CODE',
      newRun: 'NEW RUN',
      hudLives: 'LIVES',
      hudScore: 'SCORE',
      hudWeapon: 'WEAPON',
      hudShield: 'SHIELD',
      gfxModern: 'NEON',
      gfxRetro: '8-BIT',
      gfxModernLong: 'NEON · 20XX',
      gfxRetroLong: '8-BIT · 1988',
      langRu: 'RUSSIAN',
      langEn: 'ENGLISH',
      langRuShort: 'RUS',
      langEnShort: 'ENG',
      on: 'ON',
      off: 'OFF',
      onLong: 'ENABLED',
      offLong: 'DISABLED',
      checkpoint: 'CHECKPOINT',
      checkpointStart: 'CHECKPOINT: START',
      checkpointNum: 'CHECKPOINT: {n}',
      weaponGot: 'WEAPON: {name}',
      shieldGot: 'SHIELD: 3 CHARGES',
      extraLife: 'BONUS · +1 LIFE',
      konami: 'KONAMI CODE · +30 LIVES',
      bossWarning: 'WARNING · BOSS',
      bossLabel: 'BOSS',
      stageStart: 'STAGE {n} · {name}',
      stageName: 'STAGE',
      hull: 'HULL',
      timeShort: 'TIME',
      newRecord: 'NEW RECORD',
      backHint: 'ESC — BACK · ENTER — SELECT',
      menuHint: '↑ ↓ — SELECT · ENTER — CONFIRM',
      touchHint: 'USE THE ON-SCREEN CONTROLS',
      rotateTitle: 'ROTATE YOUR DEVICE',
      rotateText: 'Contra is played in landscape. Turn your phone sideways and get in the fight.',
      debug: 'DEBUG'
    }
  };

  function t(key, vars) {
    var dict = I18N[G.lang] || I18N.ru;
    var s = dict[key];
    if (s == null) s = I18N.ru[key];
    if (s == null) return key;
    if (vars) {
      for (var k in vars) if (Object.prototype.hasOwnProperty.call(vars, k)) {
        s = s.split('{' + k + '}').join(String(vars[k]));
      }
    }
    return s;
  }

  /* --------------------------------------------------------------------------
     4. STAGE META / WEAPONS
     -------------------------------------------------------------------------- */
  var STAGE_META = [
    {
      ru: {
        name: 'ДЖУНГЛИ', zone: 'ДЖУНГЛИ', boss: '«СТРАЖ»',
        mission: 'Отряд «Рубеж» высажен на побережье. Прорвись через джунгли, уничтожь вертолёт «Страж» и захвати плацдарм у крепости.',
        objectives: ['Прорвись через джунгли к крепости', 'Уничтожь вертолёт «Страж»', 'Сохрани как можно больше жизней']
      },
      en: {
        name: 'JUNGLE', zone: 'JUNGLE', boss: '“GUARDIAN”',
        mission: 'Contra has landed on the coast. Break through the jungle, destroy the Guardian gunship and seize a bridgehead at the fortress.',
        objectives: ['Fight through the jungle to the fortress', 'Destroy the Guardian gunship', 'Keep as many lives as you can']
      }
    },
    {
      ru: {
        name: 'КРЕПОСТЬ', zone: 'КРЕПОСТЬ «ГЕЛИОС»', boss: '«ГЕЛИОС»',
        mission: 'Ты внутри. Реактор «Гелиос» вот-вот запустит протокол уничтожения. Доберись до ядра и вырви сердце крепости.',
        objectives: ['Пройди залы крепости', 'Обойди лазерные заслоны', 'Уничтожь ядро «Гелиос»']
      },
      en: {
        name: 'FORTRESS', zone: 'FORTRESS HELIOS', boss: '“HELIOS”',
        mission: 'You are inside. The Helios reactor is about to launch its annihilation protocol. Reach the core and tear out the heart of the fortress.',
        objectives: ['Cross the fortress halls', 'Beat the laser gates', 'Destroy the Helios core']
      }
    }
  ];

  var WEAPONS = {
    rifle: {
      rate: 0.155, dmg: 1, speed: 545, color: '#9ff8ff', size: 3,
      name: { ru: 'ВИНТОВКА', en: 'RIFLE' }, key: 'R'
    },
    machine: {
      rate: 0.072, dmg: 1, speed: 585, color: '#ffd166', size: 2.6,
      name: { ru: 'ПУЛЕМЁТ', en: 'MACHINE GUN' }, key: 'M'
    },
    spread: {
      rate: 0.30, dmg: 1, speed: 470, color: '#ff9a4d', size: 3.2, count: 5, arc: 0.42,
      name: { ru: 'ДРОБОВИК', en: 'SPREAD GUN' }, key: 'S'
    },
    laser: {
      rate: 0.29, dmg: 3, speed: 840, color: '#ff5ef2', size: 4.2, pierce: true, long: true,
      name: { ru: 'ЛАЗЕР', en: 'LASER' }, key: 'L'
    },
    shield: {
      rate: 0, dmg: 0, speed: 0, color: '#8bffb0', size: 3,
      name: { ru: 'ЩИТ', en: 'SHIELD' }, key: 'B'
    }
  };
  var PICKUP_TYPES = ['spread', 'machine', 'laser', 'shield'];

  /* --------------------------------------------------------------------------
     5. STAGES
     -------------------------------------------------------------------------- */
  var STAGES = [
    {
      key: 'jungle',
      width: 5380,
      groundY: GROUND_Y,
      gaps: [[700, 790], [1850, 1940], [2900, 2990], [4100, 4190]],
      platforms: [
        { x: 420, y: 190, w: 92 },
        { x: 900, y: 186, w: 120 },
        { x: 1180, y: 150, w: 80 },
        { x: 1600, y: 188, w: 112 },
        { x: 2100, y: 176, w: 142 },
        { x: 2400, y: 140, w: 92 },
        { x: 2600, y: 200, w: 104 },
        { x: 3150, y: 184, w: 150 },
        { x: 3450, y: 152, w: 82 },
        { x: 3650, y: 196, w: 122 },
        { x: 3950, y: 168, w: 102 },
        { x: 4400, y: 186, w: 132 },
        { x: 4600, y: 150, w: 104 },
        { x: 4960, y: 190, w: 100 },
        { x: 5140, y: 158, w: 112 }
      ],
      checkpoints: [1500, 3000, 4300],
      pickups: [
        { x: 966, y: 156, type: 'spread' },
        { x: 2168, y: 146, type: 'machine' },
        { x: 3224, y: 154, type: 'laser' },
        { x: 4472, y: 156, type: 'shield' }
      ],
      spawns: [
        { t: 'grunt', x: 520 }, { t: 'grunt', x: 980 }, { t: 'runner', x: 1150 },
        { t: 'turret', x: 950, y: 170 }, { t: 'drone', x: 1350, y: 96 },
        { t: 'grunt', x: 1560 }, { t: 'grunt', x: 1730 },
        { t: 'turret', x: 2160, y: 160 }, { t: 'drone', x: 2220, y: 88 },
        { t: 'runner', x: 2480 }, { t: 'grunt', x: 2660 }, { t: 'grunt', x: 2830 },
        { t: 'drone', x: 3110, y: 100 }, { t: 'turret', x: 3200, y: 168 },
        { t: 'grunt', x: 3360 }, { t: 'runner', x: 3610 },
        { t: 'drone', x: 3910, y: 92 }, { t: 'grunt', x: 4060 }, { t: 'grunt', x: 4310 },
        { t: 'turret', x: 4460, y: 170 }, { t: 'runner', x: 4560 },
        { t: 'drone', x: 4750, y: 104 }
      ],
      lasers: [],
      boss: { type: 'heli', hp: 90, trigger: 4980, arenaX: 4900 }
    },
    {
      key: 'fortress',
      width: 5200,
      groundY: GROUND_Y,
      gaps: [[850, 940], [2000, 2090], [3300, 3390], [4200, 4290]],
      platforms: [
        { x: 560, y: 190, w: 112 },
        { x: 780, y: 158, w: 82 },
        { x: 1150, y: 188, w: 122 },
        { x: 1500, y: 160, w: 92 },
        { x: 1750, y: 192, w: 142 },
        { x: 2050, y: 148, w: 102 },
        { x: 2400, y: 184, w: 122 },
        { x: 2700, y: 152, w: 92 },
        { x: 3000, y: 190, w: 132 },
        { x: 3250, y: 158, w: 102 },
        { x: 3550, y: 184, w: 122 },
        { x: 3800, y: 150, w: 92 },
        { x: 4050, y: 188, w: 122 },
        { x: 4300, y: 156, w: 102 },
        { x: 4550, y: 190, w: 102 },
        { x: 4780, y: 186, w: 110 },
        { x: 4940, y: 156, w: 100 }
      ],
      checkpoints: [1600, 3100, 4000],
      pickups: [
        { x: 610, y: 154, type: 'spread' },
        { x: 2090, y: 112, type: 'machine' },
        { x: 3294, y: 122, type: 'laser' },
        { x: 4346, y: 120, type: 'shield' }
      ],
      spawns: [
        { t: 'grunt', x: 500 }, { t: 'drone', x: 760, y: 88 },
        { t: 'runner', x: 1030 }, { t: 'grunt', x: 1220 },
        { t: 'turret', x: 1200, y: 172 }, { t: 'drone', x: 1620, y: 96 },
        { t: 'grunt', x: 1860 }, { t: 'grunt', x: 1980 },
        { t: 'runner', x: 2180 }, { t: 'turret', x: 2100, y: 132 },
        { t: 'grunt', x: 2420 }, { t: 'drone', x: 2720, y: 92 },
        { t: 'runner', x: 2900 }, { t: 'grunt', x: 3060 },
        { t: 'turret', x: 3300, y: 142 }, { t: 'drone', x: 3560, y: 100 },
        { t: 'grunt', x: 3680 }, { t: 'runner', x: 3900 },
        { t: 'grunt', x: 4080 }, { t: 'drone', x: 4280, y: 96 },
        { t: 'grunt', x: 4380 }, { t: 'turret', x: 4350, y: 140 },
        { t: 'runner', x: 4560 }, { t: 'grunt', x: 4700 }
      ],
      lasers: [
        { x: 1520, phase: 0.0 },
        { x: 2640, phase: 1.4 },
        { x: 3830, phase: 2.6 }
      ],
      boss: { type: 'core', hp: 120, trigger: 4800, arenaX: 4720 }
    }
  ];

  // pre-built ground solids, only once
  STAGES.forEach(function (st) {
    var solids = [], x = 0;
    st.gaps.forEach(function (gap) {
      if (gap[0] > x) solids.push({ x: x, y: st.groundY, w: gap[0] - x, h: GROUND_H });
      x = gap[1];
    });
    if (x < st.width) solids.push({ x: x, y: st.groundY, w: st.width - x, h: GROUND_H });
    st.solids = solids;
    st.arenaX = st.boss.arenaX;
    // fixed pickups are mutable copies
    st.fixedPickups = st.pickups.map(function (p) {
      return { x: p.x, y: p.y, w: 15, h: 15, type: p.type, baseY: p.y, t: Math.random() * 6, taken: false };
    });
  });

  /* --------------------------------------------------------------------------
     6. AUDIO FACADE (audio.js provides window.CONTRA_AUDIO)
     -------------------------------------------------------------------------- */
  var AU = null;
  var audioUnlocked = false;
  function audio() {
    if (!AU) AU = window.CONTRA_AUDIO || null;
    return AU;
  }
  function audioUnlock() {
    var a = audio();
    if (a && !audioUnlocked) {
      audioUnlocked = true;
      try { a.unlock(); } catch (e) {}
      try { a.setMuted(G.muted); } catch (e) {}
      if (!G.muted) musicForMode();
    }
  }
  function sfx(name) {
    var a = audio();
    if (!a) return;
    try { a.sfx(name); } catch (e) {}
  }
  function music(name) {
    var a = audio();
    if (!a) return;
    try { a.startMusic(name); } catch (e) {}
  }
  function stopMusic(fade) {
    var a = audio();
    if (!a) return;
    try { a.stopMusic(fade == null ? 0.25 : fade); } catch (e) {}
  }
  function musicForMode() {
    if (G.muted) return;
    if (G.mode === 'title' || G.mode === 'howto' || G.mode === 'settings') music('title');
    else if (G.mode === 'brief') music('title');
    else if (G.mode === 'play' || G.mode === 'pause') {
      if (G.bossActive) music('boss');
      else music(G.stage === 0 ? 'stage1' : 'stage2');
    } else if (G.mode === 'over') music('gameover');
    else if (G.mode === 'win' || G.mode === 'clear') music('victory');
  }
  function setMuted(muted) {
    G.muted = !!muted;
    saveStr('muted', G.muted ? '1' : '0');
    var a = audio();
    if (a) {
      try { a.setMuted(G.muted); } catch (e) {}
      if (!G.muted && audioUnlocked) musicForMode();
    }
    updateSettingsUI();
  }
  function toggleSound() { setMuted(!G.muted); sfx('select'); }

  /* --------------------------------------------------------------------------
     7. INPUT
     -------------------------------------------------------------------------- */
  var Input = {
    keys: Object.create(null),
    touch: Object.create(null),
    jumpQueued: false,
    sel: 0,
    pad: { jumpPrev: false, pausePrev: false, startPrev: false, left: false, right: false, up: false, down: false, jump: false, fire: false },
    init: function () {
      var self = this;
      window.addEventListener('keydown', function (ev) {
        var code = ev.code || '';
        if (isGameKey(code)) ev.preventDefault();
        if (code === 'Enter' || code === 'NumpadEnter') ev.preventDefault();
        if (ev.repeat) {
          if (isGameKey(code)) self.keys[code] = true;
          return;
        }
        self.keys[code] = true;
        audioUnlock();
        if (code === 'Space' || code === 'KeyZ' || code === 'KeyK') self.jumpQueued = true;
        handleGlobalKey(code, ev);
      }, { passive: false });
      window.addEventListener('keyup', function (ev) {
        var code = ev.code || '';
        if (isGameKey(code)) ev.preventDefault();
        self.keys[code] = false;
      }, { passive: false });
      window.addEventListener('blur', function () { self.keys = Object.create(null); self.touch = Object.create(null); });

      // touch
      var touchButtons = document.querySelectorAll('[data-touch]');
      Array.prototype.forEach.call(touchButtons, function (btn) {
        var dir = btn.getAttribute('data-touch');
        var on = function (ev) {
          ev.preventDefault();
          audioUnlock();
          self.touch[dir] = true;
          if (dir === 'jump') self.jumpQueued = true;
          try { btn.setPointerCapture(ev.pointerId); } catch (e) {}
        };
        var off = function (ev) {
          if (ev) ev.preventDefault();
          self.touch[dir] = false;
        };
        btn.addEventListener('pointerdown', on);
        btn.addEventListener('pointerup', off);
        btn.addEventListener('pointercancel', off);
        btn.addEventListener('pointerleave', off);
        btn.addEventListener('contextmenu', function (ev) { ev.preventDefault(); });
      });
    },
    left: function () { return !!(this.keys.ArrowLeft || this.keys.KeyA || this.touch.left || this.pad.left); },
    right: function () { return !!(this.keys.ArrowRight || this.keys.KeyD || this.touch.right || this.pad.right); },
    up: function () { return !!(this.keys.ArrowUp || this.keys.KeyW || this.touch.up || this.pad.up); },
    down: function () { return !!(this.keys.ArrowDown || this.keys.KeyS || this.touch.down || this.pad.down); },
    jump: function () { return !!(this.keys.Space || this.keys.KeyZ || this.keys.KeyK || this.touch.jump || this.pad.jump); },
    fire: function () {
      return !!(this.keys.KeyJ || this.keys.KeyX || this.keys.ControlLeft || this.keys.ControlRight ||
        this.touch.fire || this.pad.fire);
    },
    clearFrame: function () { this.jumpQueued = false; },
    pollPad: function () {
      if (!navigator.getGamepads) return;
      var pads = navigator.getGamepads();
      var pad = null;
      for (var i = 0; i < pads.length; i++) if (pads[i] && pads[i].connected) { pad = pads[i]; break; }
      if (!pad) {
        this.pad.left = this.pad.right = this.pad.up = this.pad.down = false;
        this.pad.jump = this.pad.fire = false;
        return;
      }
      var ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
      this.pad.left = ax < -0.35 || !!(pad.buttons[14] && pad.buttons[14].pressed);
      this.pad.right = ax > 0.35 || !!(pad.buttons[15] && pad.buttons[15].pressed);
      this.pad.up = ay < -0.45 || !!(pad.buttons[12] && pad.buttons[12].pressed);
      this.pad.down = ay > 0.45 || !!(pad.buttons[13] && pad.buttons[13].pressed);
      var jump = !!(pad.buttons[0] && pad.buttons[0].pressed);
      if (jump && !this.pad.jumpPrev) this.jumpQueued = true;
      this.pad.jumpPrev = jump;
      this.pad.jump = jump;
      this.pad.fire = !!(pad.buttons[2] && pad.buttons[2].pressed) || !!(pad.buttons[1] && pad.buttons[1].pressed);
      var pause = !!(pad.buttons[9] && pad.buttons[9].pressed);
      if (pause && !this.pad.pausePrev) togglePause();
      this.pad.pausePrev = pause;
      var start = !!(pad.buttons[8] && pad.buttons[8].pressed);
      if (start && !this.pad.startPrev) confirmCurrent();
      this.pad.startPrev = start;
    }
  };
  function isGameKey(code) {
    return code === 'ArrowLeft' || code === 'ArrowRight' || code === 'ArrowUp' || code === 'ArrowDown' ||
      code === 'Space' || code === 'KeyA' || code === 'KeyD' || code === 'KeyW' || code === 'KeyS' ||
      code === 'KeyJ' || code === 'KeyX' || code === 'KeyZ' || code === 'KeyK';
  }

  /* --------------------------------------------------------------------------
     8. GAME STATE
     -------------------------------------------------------------------------- */
  var G = {
    mode: 'title',
    uiFrom: 'title',            // where settings/howto should return
    stage: 0,
    level: null,
    gfx: loadStr('gfx', 'retro') === 'modern' ? 'modern' : 'retro',
    lang: loadStr('lang', 'ru') === 'en' ? 'en' : 'ru',
    muted: loadStr('muted', '0') === '1',
    best: loadNum('best', 0),
    time: 0,
    uiTime: 0,
    stageTime: 0,
    runTime: 0,
    freeze: false,
    score: 0,
    lives: 3,
    nextLife: 20000,
    deaths: 0,
    totalDeaths: 0,
    checkpoint: 0,
    checkpointIndex: -1,
    konamiUsed: false,
    konamiBuf: [],
    boss: null,
    bossActive: false,
    bossTriggered: false,
    player: null,
    enemies: [],
    bullets: [],
    ebullets: [],
    pods: [],
    particles: [],
    pickupDrops: [],
    lasers: [],
    cam: { x: 0 },
    shake: 0,
    lightning: 0,
    lightningT: rand(9, 16),
    podT: 6,
    stageIntro: 0,
    hudCache: {},
    weather: [],
    attract: { t: 0, fire: 0, x: 0 },
    lastGfx: '',
    toastTimer: 0,
    toastQueue: [],
    debug: {},
    audioUnlocked: false
  };

  // set body class and initial UI after DOM ready (script runs at end of body)
  document.body.classList.add(G.gfx === 'modern' ? 'modern' : 'retro');
  document.body.classList.remove(G.gfx === 'modern' ? 'retro' : 'modern');
  if ('ontouchstart' in window || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0)) {
    document.body.classList.add('touch');
  }

  /* --------------------------------------------------------------------------
     9. SCORE / RUN LIFECYCLE
     -------------------------------------------------------------------------- */
  function updateBest() {
    if (G.score > G.best) {
      G.best = G.score;
      saveStr('best', Math.floor(G.best));
    }
  }

  function addScore(n) {
    G.score += n;
    while (G.score >= G.nextLife) {
      G.nextLife += 20000;
      G.lives++;
      showToast(t('extraLife'), null, false, 1.4);
      sfx('powerup');
    }
    updateBest();
  }

  function startNewRun() {
    G.stage = 0;
    G.score = 0;
    G.lives = 3;
    G.nextLife = 20000;
    G.deaths = 0;
    G.totalDeaths = 0;
    G.runTime = 0;
    G.konamiUsed = false;
    G.konamiBuf = [];
    G.checkpoint = 0;
    G.checkpointIndex = -1;
    G.stageStartScore = 0;
    G.boss = null;
    G.bossActive = false;
    G.bossTriggered = false;
    updateBest();
    showBrief(0);
  }

  function showBrief(i) {
    i = clamp(i, 0, STAGES.length - 1);
    G.stage = i;
    G.level = STAGES[i];
    G.mode = 'brief';
    G.boss = null;
    G.bossActive = false;
    G.bossTriggered = false;
    G.player = null;
    G.uiStack = [];
    G.enemies = [];
    G.bullets = [];
    G.ebullets = [];
    G.pods = [];
    G.pickupDrops = [];
    G.particles = [];
    G.lasers = [];
    G.endTimer = 0;
    showBossBar(false);
    document.body.classList.remove('playing');
    setHud(false);
    resetWeather(G.level.key);
    applyBrief(i);
    showScreen('brief');
    updateBestLabels();
    updateSettingsUI();
    music('title');
    sfx('select');
  }

  function beginStage(i) {
    i = clamp(i, 0, STAGES.length - 1);
    G.stage = i;
    G.level = STAGES[i];
    G.mode = 'play';
    G.stageTime = 0;
    G.stageStartScore = G.score;
    G.checkpoint = 0;
    G.checkpointIndex = -1;
    G.boss = null;
    G.bossActive = false;
    G.bossTriggered = false;
    G.enemies = G.level.spawns.map(makeEnemy);
    G.bullets = [];
    G.ebullets = [];
    G.pods = [];
    G.pickupDrops = [];
    G.particles = [];
    G.lasers = G.level.lasers.map(function (l) {
      return { x: l.x, phase: l.phase || 0, t: 0, on: false, warn: false, ct: 0 };
    });
    G.level.fixedPickups.forEach(function (p) { p.taken = false; p.y = p.baseY; });
    G.podT = rand(5, 8);
    G.stageIntro = 2.0;
    G.endTimer = 0;
    G.endMode = 'clear';
    G.pickupCycle = 0;
    G.cam.x = 0;
    G.shake = 0;
    G.lightning = 0;
    G.lightningT = rand(9, 16);
    G.player = makePlayer(60, G.level.groundY - P_H);
    G.player.onGround = true;
    Input.jumpQueued = false;
    G.player.coyote = COYOTE;
    resetWeather(G.level.key);
    hideAllScreens();
    setHud(true);
    document.body.classList.add('playing');
    music(i === 0 ? 'stage1' : 'stage2');
    sfx('start');
    updateBest();
    showToast(t('stageStart', { n: pad(i + 1, 2), name: STAGE_META[i][G.lang].name }), null, false, 1.8);
    updateHUD(true);
  }

  function backToMenu() {
    G.mode = 'title';
    G.player = null;
    G.boss = null;
    G.bossActive = false;
    G.bossTriggered = false;
    G.enemies = [];
    G.bullets = [];
    G.ebullets = [];
    G.pods = [];
    G.pickupDrops = [];
    G.particles = [];
    G.uiStack = [];
    G.attract.t = 0;
    document.body.classList.remove('playing');
    setHud(false);
    showBossBar(false);
    resetWeather('jungle');
    showScreen('title');
    updateSettingsUI();
    updateBestLabels();
    music('title');
    sfx('select');
  }

  function retryStage() {
    G.lives = 3;
    G.score = G.stageStartScore || 0;
    G.deaths = 0;
    G.checkpoint = 0;
    G.checkpointIndex = -1;
    beginStage(G.stage);
  }

  function continueAfterClear() {
    if (G.stage < STAGES.length - 1) {
      showBrief(G.stage + 1);
    } else {
      winRun();
    }
  }

  function stageClear() {
    if (G.mode === 'clear' || G.mode === 'win') return;
    G.mode = 'clear';
    G.bossActive = false;
    G.boss = null;
    showBossBar(false);
    document.body.classList.remove('playing');
    setHud(false);
    updateBest();
    showClear();
    music('victory');
    sfx('checkpoint');
  }

  function winRun() {
    G.mode = 'win';
    G.bossActive = false;
    G.boss = null;
    showBossBar(false);
    document.body.classList.remove('playing');
    setHud(false);
    updateBest();
    showWin();
    music('victory');
  }

  function gameOver() {
    if (G.mode === 'over') return;
    G.mode = 'over';
    G.bossActive = false;
    G.boss = null;
    showBossBar(false);
    document.body.classList.remove('playing');
    setHud(false);
    updateBest();
    showOver();
    music('gameover');
  }

  function togglePause() {
    if (G.mode === 'play') {
      if (G.player && G.player.dead) return;
      G.mode = 'pause';
      document.body.classList.remove('playing');
      showScreen('pause');
      updatePauseStage();
      musicForMode();
      sfx('select');
    } else if (G.mode === 'pause') {
      resumeGame();
    }
  }

  function resumeGame() {
    if (G.mode !== 'pause') return;
    G.mode = 'play';
    hideAllScreens();
    document.body.classList.add('playing');
    setHud(true);
    musicForMode();
    sfx('select');
  }

  /* --------------------------------------------------------------------------
     10. PLAYER
     -------------------------------------------------------------------------- */
  function makePlayer(x, y) {
    return {
      x: x, y: y, w: P_W, h: P_H,
      vx: 0, vy: 0,
      facing: 1, aimX: 1, aimY: 0,
      onGround: false, groundType: '', groundPlat: null,
      coyote: 0, jumpBuf: 0, dropTimer: 0,
      prone: false, dead: false, deadTimer: 0,
      invuln: 2.0, shield: 0, shieldFlash: 0,
      weapon: 'rifle', shootCd: 0, shootFlash: 0,
      walk: 0, t: 0, recoil: 0,
      spawnX: x
    };
  }

  function playerBox(p) {
    return { x: p.x + 3, y: p.y + 3, w: p.w - 6, h: p.h - 5 };
  }

  function muzzlePos(p) {
    var cx = p.x + p.w / 2;
    var cy = p.y + (p.prone ? 5 : 11);
    if (p.prone) return { x: cx + p.facing * 11, y: cy - 1 };
    var len = 11;
    return { x: cx + p.aimX * len, y: cy + p.aimY * len };
  }

  function setProne(p, want) {
    if (want === p.prone) return;
    var feet = p.y + p.h;
    p.prone = want;
    p.h = want ? P_PRONE_H : P_H;
    p.y = feet - p.h;
  }

  function updateAim(p) {
    var up = Input.up(), down = Input.down();
    var horiz = Input.left() !== Input.right();
    var ax = p.facing, ay = 0;
    if (p.prone) {
      ax = p.facing; ay = 0;
    } else if (up && !down) {
      if (horiz) { ax = p.facing * 0.70710678; ay = -0.70710678; }
      else { ax = 0; ay = -1; }
    } else if (down && !up) {
      if (!p.onGround) {
        if (horiz) { ax = p.facing * 0.70710678; ay = 0.70710678; }
        else { ax = 0; ay = 1; }
      } else { ax = p.facing; ay = 0; }
    }
    p.aimX = ax; p.aimY = ay;
  }

  function updatePlayer(dt) {
    var p = G.player;
    if (!p) return;
    p.t += dt;
    /* Перезарядка оружия. Без этого shootCd навсегда оставался равен rate
       после первого выстрела — стрельба «не работала». */
    if (p.shootCd > 0) p.shootCd = Math.max(0, p.shootCd - dt);
    p.shootFlash = Math.max(0, p.shootFlash - dt);
    p.recoil = Math.max(0, p.recoil - dt * 6);
    if (p.invuln > 0) p.invuln -= dt;
    if (p.shieldFlash > 0) p.shieldFlash -= dt;

    if (p.dead) {
      p.deadTimer -= dt;
      p.vy += GRAV * dt;
      p.y += p.vy * dt;
      if (p.deadTimer <= 0) {
        if (G.lives <= 0) gameOver();
        else respawnPlayer();
      }
      return;
    }

    if (G.mode !== 'play') return;

    var left = Input.left(), right = Input.right();
    var dir = (right ? 1 : 0) - (left ? 1 : 0);
    if (dir !== 0) {
      p.facing = dir;
      p.vx = approach(p.vx, dir * RUN, (p.onGround ? ACCEL : AIR_ACCEL) * dt);
    } else {
      p.vx = approach(p.vx, 0, (p.onGround ? FRICTION : AIR_DRAG) * dt);
    }

    if (Input.jumpQueued) {
      p.jumpBuf = JUMP_BUFFER;
      Input.jumpQueued = false;
    } else {
      p.jumpBuf = Math.max(0, p.jumpBuf - dt);
    }
    if (p.coyote > 0) p.coyote -= dt;
    if (p.dropTimer > 0) p.dropTimer -= dt;

    // drop through a one-way platform
    if (p.jumpBuf > 0 && Input.down() && p.onGround && p.groundType === 'platform') {
      p.dropTimer = 0.26;
      p.onGround = false;
      p.groundType = '';
      p.jumpBuf = 0;
      p.y += 3;
      p.vy = 55;
      sfx('land');
      puff(p.x + p.w / 2, p.y + p.h, 4, '#b8c8d8');
    } else if (p.jumpBuf > 0 && p.coyote > 0) {
      p.vy = JUMP_V - Math.abs(p.vx) * 0.05;
      p.onGround = false;
      p.coyote = 0;
      p.jumpBuf = 0;
      p.groundType = '';
      sfx('jump');
      puff(p.x + p.w / 2, p.y + p.h, 5, '#9fdcff');
    }

    // variable jump height
    if (!Input.jump() && p.vy < -150) p.vy = -150;

    var wantProne = Input.down() && p.onGround && Math.abs(p.vx) < 90;
    setProne(p, wantProne);

    p.vy += GRAV * dt;
    if (p.vy > MAX_FALL) p.vy = MAX_FALL;

    movePlayerX(p, p.vx * dt);
    movePlayerY(p, p.vy * dt);

    if (p.onGround) p.coyote = COYOTE;
    else p.coyote = Math.max(0, p.coyote - dt);

    var minX = G.bossActive ? G.level.arenaX + 8 : 0;
    p.x = clamp(p.x, minX, G.level.width - p.w - 2);
    if (p.y > VH + 40) { killPlayer('fall'); return; }

    updateAim(p);
    if (Input.fire() || G.debug.autofire) tryShoot(p);

    if (p.onGround && Math.abs(p.vx) > 20) p.walk += Math.abs(p.vx) * dt * 0.095;
    else p.walk = 0;

    collectPickups(p);
    checkLaserHits(p);

    if (G.stageIntro > 0) G.stageIntro -= dt;
  }

  function movePlayerX(p, dx) {
    p.x += dx;
    // no solid walls in this world besides level bounds; keep for future crates
    var minX = G.bossActive ? G.level.arenaX + 8 : 0;
    if (p.x < minX) { p.x = minX; p.vx = Math.max(0, p.vx); }
    if (p.x + p.w > G.level.width) { p.x = G.level.width - p.w; p.vx = Math.min(0, p.vx); }
    if (G.bossActive) {
      // invisible wall at the arena entrance
      var wall = G.level.arenaX + 4;
      if (p.x < wall) { p.x = wall; p.vx = Math.max(0, p.vx); }
    }
  }

  function movePlayerY(p, dy) {
    var prevBottom = p.y + p.h;
    p.y += dy;
    p.onGround = false;
    p.groundType = '';
    var solids = G.level.solids;
    for (var i = 0; i < solids.length; i++) {
      var s = solids[i];
      if (aabb(p, s)) {
        if (dy >= 0) {
          p.y = s.y - p.h;
          p.vy = 0;
          p.onGround = true;
          p.groundType = 'solid';
        } else {
          p.y = s.y + s.h;
          p.vy = 0;
        }
      }
    }
    if (dy > 0 && p.dropTimer <= 0) {
      var plats = G.level.platforms;
      for (var j = 0; j < plats.length; j++) {
        var pl = plats[j];
        if (p.x + p.w > pl.x + 2 && p.x < pl.x + pl.w - 2 &&
            prevBottom <= pl.y + 2 && p.y + p.h >= pl.y) {
          p.y = pl.y - p.h;
          p.vy = 0;
          p.onGround = true;
          p.groundType = 'platform';
          p.groundPlat = pl;
        }
      }
    }
  }

  function tryShoot(p) {
    if (p.shootCd > 0) return;
    var w = WEAPONS[p.weapon] || WEAPONS.rifle;
    p.shootCd = w.rate;
    var m = muzzlePos(p);
    var base = Math.atan2(p.aimY, p.aimX);
    var color = w.color;
    if (w.count) {
      for (var i = 0; i < w.count; i++) {
        var f = w.count === 1 ? 0.5 : i / (w.count - 1);
        var ang = base + (f - 0.5) * w.arc;
        addPlayerBullet(m.x, m.y, ang, w.speed * rand(0.94, 1.05), w.dmg, false, color, w.size, false);
      }
      sfx('shot_spread');
      G.shake = Math.max(G.shake, 1.6);
    } else {
      addPlayerBullet(m.x, m.y, base, w.speed, w.dmg, !!w.pierce, color, w.size, !!w.long);
      sfx(p.weapon === 'machine' ? 'shot_machine' : (p.weapon === 'laser' ? 'shot_laser' : 'shot'));
      G.shake = Math.max(G.shake, p.weapon === 'laser' ? 1.8 : 0.65);
    }
    p.shootFlash = 0.075;
    p.recoil = 1;
    // shell casing
    if (p.weapon !== 'laser') {
      addParticle(m.x, m.y, -p.facing * rand(18, 42), rand(-60, -20), rand(0.3, 0.6), rand(1, 2), '#ffd166', 460, 0);
    }
  }

  function addPlayerBullet(x, y, ang, speed, dmg, pierce, color, size, long) {
    if (G.bullets.length >= BULLET_CAP) G.bullets.shift();
    G.bullets.push({
      x: x, y: y,
      vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
      w: long ? 18 : size * 2.2, h: long ? 7 : size * 2.2,
      ang: ang, life: long ? 0.95 : 1.15, maxLife: long ? 0.95 : 1.15,
      dmg: dmg, pierce: !!pierce, color: color, size: size, long: !!long,
      hitSet: [], hitBoss: false, trail: []
    });
  }

  function killPlayer(reason) {
    var p = G.player;
    if (!p || p.dead) return;
    if (p.invuln > 0 && reason !== 'force') return;
    if (p.shield > 0) {
      p.shield--;
      p.invuln = 0.9;
      p.shieldFlash = 0.4;
      G.shake = Math.max(G.shake, 3);
      sfx('hit');
      burst(p.x + p.w / 2, p.y + p.h / 2, 10, '#8bffb0', 150, 0.45);
      updateHUD(true);
      return;
    }
    p.dead = true;
    p.deadTimer = 1.35;
    p.vy = -175;
    p.vx = rand(-55, 55);
    G.lives--;
    G.deaths++;
    G.totalDeaths++;
    G.shake = Math.max(G.shake, 9);
    explosion(p.x + p.w / 2, p.y + p.h / 2, 1.25);
    sfx('death');
    if (G.bossActive) resetBossFight();
    updateHUD(true);
  }

  function respawnPlayer() {
    var p = G.player;
    var x = G.checkpointIndex >= 0 ? G.checkpoint + 20 : 60;
    var y = G.level.groundY - P_H;
    G.player = makePlayer(x, y);
    G.player.onGround = true;
    G.player.coyote = COYOTE;
    G.player.invuln = 2.6;
    G.player.weapon = 'rifle';
    G.bullets = [];
    G.ebullets = [];
    G.podT = Math.max(G.podT, 4);
    G.cam.x = clamp(x - VW * 0.4, 0, G.level.width - VW);
    if (G.bossActive) resetBossFight();
    updateHUD(true);
    showToast(G.checkpointIndex >= 0 ? t('checkpointNum', { n: pad(G.checkpointIndex + 1, 2) }) : t('checkpointStart'), null, false, 1.5);
  }

  function resetBossFight() {
    G.boss = null;
    G.bossActive = false;
    G.bossTriggered = false;
    G.ebullets = [];
    G.pods = [];
    // remove drones summoned into the arena; the boss will summon new ones
    if (G.level) {
      G.enemies = G.enemies.filter(function (e) { return e.x < G.level.arenaX; });
    }
    showBossBar(false);
    musicForMode();
  }

  /* --------------------------------------------------------------------------
     11. ENEMIES
     -------------------------------------------------------------------------- */
  var ENEMY_DEF = {
    grunt: { w: 12, h: 24, hp: 1, score: 100 },
    runner: { w: 12, h: 22, hp: 1, score: 150 },
    turret: { w: 22, h: 16, hp: 5, score: 300 },
    drone: { w: 18, h: 14, hp: 3, score: 250 }
  };

  function makeEnemy(spawn) {
    var def = ENEMY_DEF[spawn.t];
    var y = spawn.y != null ? spawn.y : GROUND_Y - def.h;
    return {
      type: spawn.t, x: spawn.x, y: y, w: def.w, h: def.h,
      hp: def.hp, maxHp: def.hp, score: def.score,
      active: false, dead: false, t: rand(0, 3),
      homeX: spawn.x, baseY: y, facing: -1,
      fireT: rand(0.6, 1.9), telegraph: 0, burst: 0, burstT: 0,
      hitFlash: 0, walk: rand(0, 6), flash: 0, vx: 0, vy: 0
    };
  }

  function groundAt(x) {
    if (!G.level) return true;
    var gaps = G.level.gaps;
    for (var i = 0; i < gaps.length; i++) {
      if (x > gaps[i][0] + 2 && x < gaps[i][1] - 2) return false;
    }
    return true;
  }

  function activateEnemies() {
    var cam = G.cam.x;
    for (var i = 0; i < G.enemies.length; i++) {
      var e = G.enemies[i];
      if (e.dead || e.active) continue;
      if (e.x < cam + VW + 70 && e.x > cam - 120) e.active = true;
    }
  }

  function updateEnemies(dt) {
    activateEnemies();
    var p = G.player;
    for (var i = 0; i < G.enemies.length; i++) {
      var e = G.enemies[i];
      if (e.dead || !e.active) continue;
      e.t += dt;
      if (e.hitFlash > 0) e.hitFlash -= dt;
      if (e.flash > 0) e.flash -= dt;
      if (!p || p.dead) continue;

      var pcx = p.x + p.w / 2, pcy = p.y + p.h * 0.45;
      var ecx = e.x + e.w / 2, ecy = e.y + e.h / 2;
      var dx = pcx - ecx;
      var adx = Math.abs(dx);

      if (e.type === 'grunt') {
        e.facing = dx >= 0 ? 1 : -1;
        if (adx > 150) { e.x += e.facing * 33 * dt; e.walk += dt * 8; }
        else if (adx < 78) { e.x -= e.facing * 13 * dt; e.walk += dt * 5; }
        else { e.walk += dt * 2; }
        e.x = clamp(e.x, e.homeX - 150, e.homeX + 150);
        if (!groundAt(e.x + e.w / 2)) e.x = approach(e.x, e.homeX, 45 * dt);
        e.fireT -= dt;
        if (e.fireT <= 0 && adx < 350) { e.telegraph = 0.34; e.fireT = rand(1.5, 2.4); }
        if (e.telegraph > 0) {
          e.telegraph -= dt;
          if (e.telegraph <= 0) {
            enemyShoot(e, ecx + e.facing * 7, e.y + 9, 168, 'normal');
            e.flash = 0.1;
          }
        }
      } else if (e.type === 'runner') {
        e.facing = dx >= 0 ? 1 : -1;
        e.x += e.facing * 88 * dt;
        e.walk += dt * 14;
        e.x = clamp(e.x, e.homeX - 230, e.homeX + 230);
        if (!groundAt(e.x + e.w / 2)) e.x = approach(e.x, e.homeX, 60 * dt);
      } else if (e.type === 'turret') {
        e.facing = dx >= 0 ? 1 : -1;
        e.fireT -= dt;
        if (e.fireT <= 0) { e.burst = 3; e.fireT = rand(2.3, 3.0); }
        if (e.burst > 0) {
          e.burstT -= dt;
          if (e.burstT <= 0) {
            e.burst--;
            e.burstT = 0.14;
            var ang = Math.atan2(pcy - (e.y + 8), pcx - (e.x + e.w / 2)) + rand(-0.04, 0.04);
            addEnemyBullet(e.x + e.w / 2 + Math.cos(ang) * 12, e.y + 8 + Math.sin(ang) * 12, ang, 192, 'normal');
            e.flash = 0.09;
          }
        }
      } else if (e.type === 'drone') {
        e.y = e.baseY + Math.sin(e.t * 2.2) * 13;
        e.facing = dx >= 0 ? 1 : -1;
        if (adx > 60) e.x += e.facing * 22 * dt;
        e.x = clamp(e.x, e.homeX - 160, e.homeX + 160);
        e.fireT -= dt;
        if (e.fireT <= 0) { e.telegraph = 0.32; e.fireT = rand(1.9, 2.7); }
        if (e.telegraph > 0) {
          e.telegraph -= dt;
          if (e.telegraph <= 0) {
            enemyShoot(e, e.x + e.w / 2, e.y + e.h, 152, 'normal');
            e.flash = 0.1;
          }
        }
      }

      // contact with player
      if (!p.dead && p.invuln <= 0 && aabb(playerBox(p), e)) {
        killPlayer('contact');
      }
    }
  }

  function enemyShoot(e, ox, oy, speed, kind) {
    var p = G.player;
    if (!p || p.dead) return;
    var tx = p.x + p.w / 2, ty = p.y + p.h * 0.42;
    var ang = Math.atan2(ty - oy, tx - ox) + rand(-0.055, 0.055);
    addEnemyBullet(ox, oy, ang, speed, kind || 'normal');
  }

  function damageEnemy(e, dmg) {
    if (e.dead) return;
    e.hp -= dmg;
    e.hitFlash = 0.13;
    burst(e.x + e.w / 2, e.y + e.h / 2, 4, '#ffd166', 90, 0.25);
    sfx('hit');
    if (e.hp <= 0) killEnemy(e);
  }

  function killEnemy(e) {
    if (e.dead) return;
    e.dead = true;
    addScore(e.score);
    explosion(e.x + e.w / 2, e.y + e.h / 2, e.type === 'turret' ? 1.2 : 0.85);
    sfx('explode');
    G.shake = Math.max(G.shake, 2.4);
  }

  /* --------------------------------------------------------------------------
     12. BULLETS
     -------------------------------------------------------------------------- */
  function addEnemyBullet(x, y, ang, speed, kind) {
    if (G.ebullets.length >= EBULLET_CAP) G.ebullets.shift();
    var bomb = kind === 'bomb';
    G.ebullets.push({
      x: x, y: y,
      vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
      w: bomb ? 8 : 7, h: bomb ? 8 : 7,
      life: bomb ? 5 : 4.2, kind: kind || 'normal',
      grav: bomb ? 420 : 0, t: 0
    });
  }

  function updateBullets(dt) {
    var i, b, p = G.player;
    for (i = G.bullets.length - 1; i >= 0; i--) {
      b = G.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < G.cam.x - 60 || b.x > G.cam.x + VW + 60 || b.y < -40 || b.y > VH + 40) {
        G.bullets.splice(i, 1);
        continue;
      }
      // enemies
      var hit = false;
      for (var j = 0; j < G.enemies.length; j++) {
        var e = G.enemies[j];
        if (e.dead || !e.active) continue;
        if (aabb({ x: b.x - b.w / 2, y: b.y - b.h / 2, w: b.w, h: b.h }, e)) {
          if (b.pierce && b.hitSet.indexOf(e) >= 0) continue;
          if (b.pierce) b.hitSet.push(e);
          damageEnemy(e, b.dmg);
          if (!b.pierce) { hit = true; break; }
        }
      }
      if (hit) { G.bullets.splice(i, 1); continue; }
      // pods
      for (var k = 0; k < G.pods.length; k++) {
        var pod = G.pods[k];
        if (!pod.dead && aabb({ x: b.x - b.w / 2, y: b.y - b.h / 2, w: b.w, h: b.h }, pod)) {
          if (b.pierce && b.hitSet.indexOf(pod) >= 0) continue;
          if (b.pierce) b.hitSet.push(pod);
          damagePod(pod);
          if (!b.pierce) { hit = true; break; }
        }
      }
      if (hit) { G.bullets.splice(i, 1); continue; }
      // boss
      if (G.boss && !G.boss.dying && !b.hitBoss) {
        var br = bossRect(G.boss);
        if (aabb({ x: b.x - b.w / 2, y: b.y - b.h / 2, w: b.w, h: b.h }, br)) {
          b.hitBoss = true;
          damageBoss(b.dmg);
          burst(b.x, b.y, 3, '#ff8bd0', 100, 0.22);
          if (!b.pierce) { G.bullets.splice(i, 1); continue; }
        }
      }
    }

    for (i = G.ebullets.length - 1; i >= 0; i--) {
      b = G.ebullets[i];
      b.t += dt;
      if (b.grav) b.vy += b.grav * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < G.cam.x - 80 || b.x > G.cam.x + VW + 80 || b.y > VH + 30) {
        G.ebullets.splice(i, 1);
        continue;
      }
      // ground collision
      if (b.y > G.level.groundY + 4 && b.x > 0 && b.x < G.level.width && groundAt(b.x)) {
        burst(b.x, G.level.groundY, 3, '#ffd166', 80, 0.22);
        G.ebullets.splice(i, 1);
        continue;
      }
      if (p && !p.dead && aabb({ x: b.x - b.w / 2, y: b.y - b.h / 2, w: b.w, h: b.h }, playerBox(p))) {
        G.ebullets.splice(i, 1);
        if (p.invuln > 0) {
          burst(b.x, b.y, 3, '#9ff8ff', 70, 0.2);
        } else {
          killPlayer('bullet');
        }
      }
    }
  }

  /* --------------------------------------------------------------------------
     13. PICKUPS & PODS
     -------------------------------------------------------------------------- */
  function spawnPod() {
    var lvl = G.level;
    var y = rand(74, 138);
    G.pods.push({
      x: G.cam.x + VW + 40, y: y, baseY: y,
      w: 24, h: 15, hp: 1, dead: false,
      vx: -62, t: rand(0, 6), flash: 0
    });
  }

  function damagePod(pod) {
    if (pod.dead) return;
    pod.hp--;
    pod.flash = 0.12;
    if (pod.hp <= 0) {
      pod.dead = true;
      explosion(pod.x, pod.y, 0.9);
      sfx('explode');
      addScore(50);
      dropPickup(pod.x, pod.y);
    }
  }

  function dropPickup(x, y) {
    // cycle through weapon types so the player always sees variety
    var order = PICKUP_TYPES;
    var type = order[G.pickupCycle % order.length];
    G.pickupCycle++;
    G.pickupDrops.push({
      x: x, y: y, w: 15, h: 15, type: type,
      vx: rand(-25, 25), vy: -80, t: 0, grounded: false, baseY: y
    });
  }

  function updatePods(dt) {
    var p = G.player;
    if (G.mode === 'play' && !G.bossActive) {
      G.podT -= dt;
      if (G.podT <= 0) {
        G.podT = rand(9, 14);
        if (G.pods.length < 2) spawnPod();
      }
    }
    for (var i = G.pods.length - 1; i >= 0; i--) {
      var pod = G.pods[i];
      pod.t += dt;
      if (pod.flash > 0) pod.flash -= dt;
      pod.x += pod.vx * dt;
      pod.y = pod.baseY + Math.sin(pod.t * 3.2) * 7;
      if (pod.dead || pod.x < G.cam.x - 80) { G.pods.splice(i, 1); continue; }
      if (p && !p.dead && aabb(playerBox(p), pod)) {
        damagePod(pod);
      }
    }

    for (var j = G.pickupDrops.length - 1; j >= 0; j--) {
      var d = G.pickupDrops[j];
      d.t += dt;
      if (!d.grounded) {
        d.vy += GRAV * 0.55 * dt;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        if (d.vy > 0 && d.y + d.h >= G.level.groundY && groundAt(d.x + d.w / 2)) {
          d.grounded = true;
          d.baseY = G.level.groundY - d.h;
          d.y = d.baseY;
          d.vx = 0;
          d.vy = 0;
          sfx('land');
        }
        if (d.y > VH + 30) { G.pickupDrops.splice(j, 1); continue; }
      } else {
        d.y = d.baseY + Math.sin(d.t * 2.4) * 2;
      }
      if (p && !p.dead && aabb(playerBox(p), { x: d.x, y: d.y, w: d.w, h: d.h })) {
        applyPickup(d.type);
        G.pickupDrops.splice(j, 1);
      }
    }

    // fixed stage pickups bobbing
    var fixed = G.level.fixedPickups;
    for (var k = 0; k < fixed.length; k++) {
      var f = fixed[k];
      if (f.taken) continue;
      f.t += dt;
      f.y = f.baseY + Math.sin(f.t * 2.2 + f.x * 0.01) * 3;
      if (p && !p.dead && aabb(playerBox(p), { x: f.x, y: f.y, w: f.w, h: f.h })) {
        f.taken = true;
        applyPickup(f.type);
      }
    }
  }

  function applyPickup(type) {
    var p = G.player;
    if (!p) return;
    if (type === 'shield') {
      p.shield = 3;
      p.invuln = Math.max(p.invuln, 0.7);
      showToast(t('shieldGot'), null, false, 1.4);
    } else {
      p.weapon = type;
      showToast(t('weaponGot', { name: WEAPONS[type].name[G.lang] }), null, false, 1.4);
    }
    addScore(100);
    sfx('weapon');
    G.shake = Math.min(G.shake + 2, 6);
    burst(p.x + p.w / 2, p.y + p.h / 2, 16, WEAPONS[type] ? WEAPONS[type].color : '#8bffb0', 160, 0.5);
    updateHUD(true);
  }

  function collectPickups(p) {
    // handled in updatePods to keep one loop
  }

  function drawPickupIcon() { /* renderer */ }

  /* --------------------------------------------------------------------------
     14. LASER GATES (stage 2 hazard)
     -------------------------------------------------------------------------- */
  function updateLasers(dt) {
    var p = G.player;
    for (var i = 0; i < G.lasers.length; i++) {
      var l = G.lasers[i];
      l.t += dt;
      var ct = (l.t + l.phase) % 4.0;
      l.ct = ct;
      l.warn = ct > 2.55 && ct <= 3.1;
      l.on = ct > 3.1 && ct <= 4.0;
      if (l.on && p && !p.dead) {
        if (aabb(playerBox(p), { x: l.x - 5, y: 64, w: 10, h: G.level.groundY - 64 })) killPlayer('laser');
      }
    }
  }

  function checkLaserHits() { /* collision handled in updateLasers */ }

  /* --------------------------------------------------------------------------
     15. BOSSES
     -------------------------------------------------------------------------- */
  function bossRect(b) {
    return { x: b.x, y: b.y, w: b.w, h: b.h };
  }

  function spawnBoss() {
    var st = G.level, cfg = st.boss;
    G.bossTriggered = true;
    G.bossActive = true;
    G.endTimer = 0;
    if (cfg.type === 'heli') {
      G.boss = {
        type: 'heli', x: st.width + 30, y: 88, w: 116, h: 46,
        hp: cfg.hp, maxHp: cfg.hp, t: 0, dying: 0, flash: 0,
        entry: 1.7, atk: 1.6, mg: 1.0, pattern: 0, rotor: 0, hitSfx: 0
      };
    } else {
      G.boss = {
        type: 'core', x: st.arenaX + 328, y: 96, w: 88, h: 116,
        hp: cfg.hp, maxHp: cfg.hp, t: 0, dying: 0, flash: 0,
        entry: 1.2, atk: 1.8, aimT: 0.9, spiralT: 0, rot: 0, hitSfx: 0
      };
    }
    G.cam.x = st.arenaX;
    showBossBar(true);
    var name = STAGE_META[G.stage][G.lang].boss;
    showToast(t('bossWarning'), name, true, 2.2);
    music('boss');
    sfx('alarm');
    G.shake = Math.max(G.shake, 6);
    updateHUD(true);
  }

  function damageBoss(dmg) {
    var b = G.boss;
    if (!b || b.dying) return;
    b.hp -= dmg;
    b.flash = 0.1;
    if (b.hitSfx <= 0) { sfx('boss_hit'); b.hitSfx = 0.14; }
    if (b.hp <= 0) {
      b.hp = 0;
      b.dying = 2.3;
      b.deathT = 0;
      b.hitSfx = 0;
      G.ebullets = [];
      G.shake = 12;
      addScore(5000);
      sfx('explode');
      explosion(b.x + b.w / 2, b.y + b.h / 2, 1.6);
    }
  }

  function bossFan(b, count, spread, speed) {
    var p = G.player;
    if (!p || p.dead) return;
    var nx = b.x + 8, ny = b.y + b.h * 0.66;
    var base = Math.atan2(p.y + p.h * 0.42 - ny, p.x + p.w / 2 - nx);
    for (var i = 0; i < count; i++) {
      var f = count === 1 ? 0.5 : i / (count - 1);
      addEnemyBullet(nx, ny, base + (f - 0.5) * spread, speed, 'normal');
    }
    b.flash = 0.12;
    sfx('shot_spread');
  }

  function addBomb(x, y, vx, vy) {
    if (G.ebullets.length >= EBULLET_CAP) G.ebullets.shift();
    G.ebullets.push({
      x: x, y: y, vx: vx, vy: vy, w: 9, h: 9,
      life: 6, kind: 'bomb', grav: 390, t: 0
    });
  }

  function bossBombs(b) {
    var p = G.player;
    if (!p || p.dead) return;
    for (var i = 0; i < 3; i++) {
      addBomb(b.x + 26 + i * 8, b.y + b.h - 6, -rand(40, 110), rand(10, 50));
    }
    b.flash = 0.14;
    sfx('shot');
  }

  function bossSummon(b) {
    var drones = 0;
    for (var i = 0; i < G.enemies.length; i++) {
      if (!G.enemies[i].dead && G.enemies[i].type === 'drone' && G.enemies[i].x > G.level.arenaX) drones++;
    }
    if (drones >= 2) return;
    var e = makeEnemy({ t: 'drone', x: b.x + 20, y: b.y + b.h + 8 });
    e.active = true;
    G.enemies.push(e);
    sfx('alarm');
  }

  function updateBoss(dt) {
    var b = G.boss;
    if (!b) return;
    b.t += dt;
    if (b.hitSfx > 0) b.hitSfx -= dt;
    if (b.flash > 0) b.flash -= dt;
    if (b.entry > 0) b.entry -= dt;
    var p = G.player;

    if (b.dying > 0) {
      b.dying -= dt;
      b.deathT -= dt;
      if (b.deathT <= 0) {
        b.deathT = rand(0.08, 0.19);
        explosion(b.x + rand(0, b.w), b.y + rand(0, b.h), rand(0.7, 1.5));
        G.shake = Math.max(G.shake, 8);
        sfx('explode');
      }
      if (b.dying <= 0) finishBoss();
      return;
    }

    if (p && !p.dead && b.entry <= 0 && aabb(playerBox(p), bossRect(b))) killPlayer('boss');

    if (b.type === 'heli') {
      b.rotor += dt * 34;
      var ax = G.level.arenaX;
      var tx = ax + 300 + Math.sin(b.t * 0.72) * 128;
      var ty = 84 + Math.sin(b.t * 1.4) * 17;
      var k = 1 - Math.exp(-2.4 * dt);
      b.x = lerp(b.x, tx, k);
      b.y = lerp(b.y, ty, k);
      if (b.entry > 0) return;
      b.atk -= dt;
      b.mg -= dt;
      if (b.mg <= 0) {
        b.mg = 1.15;
        if (p && !p.dead) {
          var nx = b.x + 6, ny = b.y + b.h * 0.64;
          var ang = Math.atan2(p.y + p.h * 0.42 - ny, p.x + p.w / 2 - nx);
          addEnemyBullet(nx, ny, ang, 205, 'normal');
          b.flash = 0.08;
        }
      }
      if (b.atk <= 0) {
        b.pattern = (b.pattern + 1) % 3;
        if (b.pattern === 0) { bossFan(b, 5, 0.95, 158); b.atk = 1.7; }
        else if (b.pattern === 1) { bossBombs(b); b.atk = 1.5; }
        else { bossSummon(b); b.atk = 1.8; }
      }
    } else {
      b.rot += dt * 0.9;
      b.y = 96 + Math.sin(b.t * 1.15) * 5;
      if (b.entry > 0) return;
      var phase2 = b.hp <= b.maxHp * 0.5;
      b.atk -= dt;
      b.aimT -= dt;
      if (b.atk <= 0) {
        b.atk = phase2 ? 1.85 : 2.55;
        var n = phase2 ? 16 : 12;
        var off = b.t * 0.7;
        var cx = b.x + b.w / 2, cy = b.y + b.h / 2;
        for (var i = 0; i < n; i++) {
          addEnemyBullet(cx, cy, off + i * Math.PI * 2 / n, 128, 'normal');
        }
        b.flash = 0.14;
        sfx('shot_laser');
      }
      if (b.aimT <= 0) {
        b.aimT = phase2 ? 1.0 : 1.45;
        if (p && !p.dead) {
          var ccx = b.x + b.w / 2, ccy = b.y + b.h * 0.42;
          var ba = Math.atan2(p.y + p.h * 0.42 - ccy, p.x + p.w / 2 - ccx);
          for (var j = -1; j <= 1; j++) addEnemyBullet(ccx, ccy, ba + j * 0.13, 188, 'normal');
          b.flash = 0.1;
          sfx('shot');
        }
      }
      if (phase2) {
        b.spiralT -= dt;
        if (b.spiralT <= 0) {
          b.spiralT = 0.17;
          addEnemyBullet(b.x + b.w / 2, b.y + b.h / 2, -b.t * 3.4, 118, 'normal');
        }
      }
    }
  }

  function finishBoss() {
    var last = G.stage === STAGES.length - 1;
    var b = G.boss;
    if (b) explosion(b.x + b.w / 2, b.y + b.h / 2, 2.4);
    G.boss = null;
    G.bossActive = false;
    G.bossTriggered = true;
    G.ebullets = [];
    G.pods = [];
    showBossBar(false);
    G.shake = 14;
    G.endTimer = 1.15;
    G.endMode = last ? 'win' : 'clear';
    sfx('explode');
    updateHUD(true);
  }

  /* --------------------------------------------------------------------------
     16. PARTICLES / WEATHER / CAMERA
     -------------------------------------------------------------------------- */
  function addParticle(x, y, vx, vy, life, size, color, grav, glow, ring) {
    if (G.particles.length >= PART_CAP) G.particles.shift();
    G.particles.push({
      x: x, y: y, vx: vx, vy: vy,
      life: life, maxLife: life, size: size,
      color: color, grav: grav || 0, glow: glow == null ? 1 : glow,
      ring: !!ring, rot: rand(0, Math.PI * 2)
    });
  }

  function burst(x, y, n, color, spd, life) {
    for (var i = 0; i < n; i++) {
      var a = rand(0, Math.PI * 2), s = rand(spd * 0.25, spd);
      addParticle(x, y, Math.cos(a) * s, Math.sin(a) * s, rand(life * 0.5, life), rand(1, 2.6), color || '#ffd166', 120, 1);
    }
  }

  function explosion(x, y, scale) {
    scale = scale || 1;
    for (var i = 0; i < Math.round(20 * scale); i++) {
      var a = rand(0, Math.PI * 2), s = rand(40, 260) * scale;
      var col = pick(['#ffd166', '#ff8b3d', '#ff4d5e', '#fff1c9']);
      addParticle(x, y, Math.cos(a) * s, Math.sin(a) * s - rand(0, 60), rand(0.35, 0.9) * Math.max(0.8, scale), rand(1.5, 4) * scale, col, 220, 1);
    }
    addParticle(x, y, 0, 0, 0.45, 6 * scale, '#ffd8a8', 0, 1, true);
    addParticle(x, y, 0, 0, 0.7, 3 * scale, '#ffffff', 0, 1, true);
  }

  function puff(x, y, n, color) {
    for (var i = 0; i < n; i++) {
      addParticle(x + rand(-4, 4), y, rand(-35, 35), rand(-45, -5), rand(0.25, 0.55), rand(1.5, 3.4), color || '#a9c4d8', 60, 0.5);
    }
  }

  function updateParticles(dt) {
    for (var i = G.particles.length - 1; i >= 0; i--) {
      var p = G.particles[i];
      p.life -= dt;
      if (p.life <= 0) { G.particles.splice(i, 1); continue; }
      if (!p.ring) {
        p.vy += p.grav * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= (1 - 1.6 * dt);
      }
      p.rot += dt * 4;
    }
  }

  function resetWeather(key) {
    G.weather = [];
    G.weatherStyle = key === 'jungle' ? 'rain' : 'embers';
    var n = key === 'jungle' ? 78 : 56;
    for (var i = 0; i < n; i++) {
      G.weather.push({
        x: rand(0, VW), y: rand(0, VH),
        spd: key === 'jungle' ? rand(190, 330) : rand(18, 55),
        len: key === 'jungle' ? rand(5, 13) : rand(1.5, 3.5),
        a: rand(0.12, 0.5), drift: key === 'jungle' ? rand(-45, 10) : rand(-14, 14),
        ph: rand(0, 6.28)
      });
    }
  }

  function updateWeather(dt) {
    var w = G.weather;
    for (var i = 0; i < w.length; i++) {
      var d = w[i];
      if (G.weatherStyle === 'rain') {
        d.y += d.spd * dt;
        d.x += d.drift * dt;
        if (d.y > VH + 12) { d.y = -12; d.x = rand(-40, VW + 20); }
        if (d.x < -20) d.x += VW + 30;
        if (d.x > VW + 10) d.x -= VW + 30;
      } else {
        d.y -= d.spd * dt;
        d.ph += dt * 2;
        d.x += Math.sin(d.ph) * d.drift * dt;
        if (d.y < -12) { d.y = VH + rand(0, 20); d.x = rand(0, VW); }
      }
    }
  }

  function updateCamera(dt) {
    var p = G.player;
    if (!p) return;
    var maxX = G.level.width - VW;
    if (G.bossActive) {
      G.cam.x = lerp(G.cam.x, G.level.arenaX, 1 - Math.exp(-4.5 * dt));
    } else {
      var target = p.x + p.w / 2 - VW * 0.42 + p.facing * 30 + p.vx * 0.11;
      G.cam.x = lerp(G.cam.x, clamp(target, 0, maxX), 1 - Math.exp(-7.5 * dt));
    }
    G.cam.x = clamp(G.cam.x, 0, maxX);
  }

  /* --------------------------------------------------------------------------
     17. KONAMI CODE
     -------------------------------------------------------------------------- */
  var KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];

  function trackKonami(code) {
    if (G.konamiUsed) return;
    var allowed = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];
    if (allowed.indexOf(code) < 0) return;
    G.konamiBuf.push(code);
    if (G.konamiBuf.length > KONAMI.length) G.konamiBuf.shift();
    if (G.konamiBuf.join(',') === KONAMI.join(',')) {
      G.konamiUsed = true;
      G.lives += 30;
      updateHUD(true);
      showToast(t('konami'), null, false, 2.6);
      sfx('powerup');
      G.shake = Math.max(G.shake, 4);
    }
  }

  /* --------------------------------------------------------------------------
     18. MAIN UPDATE
     -------------------------------------------------------------------------- */
  function update(dt) {
    G.time += dt;
    G.uiTime += dt;
    updateWeather(dt);
    updateToastTimer(dt);

    if (G.mode === 'title' || G.mode === 'brief' || G.mode === 'howto' || G.mode === 'settings') {
      G.attract.t += dt;
      return;
    }
    if (G.mode === 'play') {
      if (G.endTimer > 0) {
        G.endTimer -= dt;
        if (G.endTimer <= 0) {
          G.endTimer = 0;
          if (G.endMode === 'win') winRun();
          else stageClear();
          return;
        }
      }
      if (G.freeze) return;
      G.stageTime += dt;
      G.runTime += dt;

      updatePlayer(dt);
      if (G.mode !== 'play') return;
      updateCheckpoints();
      updateEnemies(dt);
      updateBoss(dt);
      updateBullets(dt);
      updatePods(dt);
      updateParticles(dt);
      updateLasers(dt);
      updateCamera(dt);
      G.shake = approach(G.shake, 0, 24 * dt);
      if (G.lightning > 0) G.lightning = Math.max(0, G.lightning - dt * 2.6);
      G.lightningT -= dt;
      if (G.lightningT <= 0) {
        G.lightningT = rand(10, 19);
        if (G.stage === 0) G.lightning = 0.95;
      }
      if (!G.bossTriggered && !G.endTimer && G.player && !G.player.dead &&
          G.player.x > G.level.boss.trigger) {
        spawnBoss();
      }
      updateHUD();
    } else if (G.mode === 'pause') {
      updateHUD();
    }
  }

  /* --------------------------------------------------------------------------
     19. RENDER — shared helpers
     -------------------------------------------------------------------------- */
  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d', { alpha: false });

  function wrap(x, span) {
    x = x % span;
    return x < 0 ? x + span : x;
  }

  function rr(x, y, w, h, r) {
    r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function glowDot(x, y, r, color, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.globalCompositeOperation = 'lighter';
    var g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(0.4, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function applyGfxSize() {
    var modern = G.gfx === 'modern';
    var w = modern ? MODERN_W : VW;
    var h = modern ? MODERN_H : VH;
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    ctx.setTransform(canvas.width / VW, 0, 0, canvas.height / VH, 0, 0);
    ctx.imageSmoothingEnabled = modern;
    document.body.classList.toggle('modern', modern);
    document.body.classList.toggle('retro', !modern);
    G.lastGfx = G.gfx;
    var tag = document.getElementById('gfx-tag');
    if (tag) tag.textContent = modern ? 'NEON' : '8-BIT';
  }

  function render() {
    if (!G.level) G.level = STAGES[0];
    var shx = 0, shy = 0;
    if (G.shake > 0.25) {
      shx = rand(-1, 1) * G.shake * 0.55;
      shy = rand(-1, 1) * G.shake * 0.4;
    }
    ctx.setTransform(canvas.width / VW, 0, 0, canvas.height / VH, 0, 0);
    ctx.imageSmoothingEnabled = G.gfx === 'modern';
    ctx.clearRect(0, 0, VW, VH);

    if (G.mode === 'title' || G.mode === 'howto' || G.mode === 'settings') {
      renderAttract('title', shx, shy);
    } else if (G.mode === 'brief') {
      renderAttract('brief', shx, shy);
    } else {
      renderGame(shx, shy);
    }
  }

  /* --------------------------------------------------------------------------
     20. BACKGROUNDS — modern
     -------------------------------------------------------------------------- */
  function drawBackground(st, cam) {
    if (G.gfx === 'modern') {
      if (st.key === 'jungle') drawJungleModern(cam);
      else drawFortressModern(cam);
    } else {
      if (st.key === 'jungle') drawJungleRetro(cam);
      else drawFortressRetro(cam);
    }
  }

  function drawMountainModern(off, baseY, hMax, color, alpha) {
    var step = 54;
    var shift = wrap(off, step);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-step, baseY);
    var idx0 = Math.floor(off / step);
    for (var i = -1; i < Math.ceil(VW / step) + 3; i++) {
      var x = i * step - shift;
      var h = hMax * (0.32 + 0.68 * hash((idx0 + i) * 7 + 11));
      ctx.lineTo(x, baseY - h * 0.55);
      ctx.lineTo(x + step * 0.34, baseY - h);
      ctx.lineTo(x + step * 0.62, baseY - h * 0.62);
      ctx.lineTo(x + step, baseY - h * 0.3);
    }
    ctx.lineTo(VW + 60, baseY + 8);
    ctx.lineTo(VW + 60, GROUND_Y + 20);
    ctx.lineTo(-step, GROUND_Y + 20);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawPalmModern(x, baseY, h, s, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.5, 3.4 * s);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, baseY);
    ctx.quadraticCurveTo(x + 7 * s, baseY - h * 0.52, x + 2 * s, baseY - h);
    ctx.stroke();
    var tx = x + 2 * s, ty = baseY - h;
    ctx.fillStyle = color;
    for (var i = 0; i < 6; i++) {
      var a = -Math.PI / 2 + (i - 2.5) * 0.52;
      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.ellipse(15 * s, 0, 20 * s, 5.6 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // hanging undergrowth
    ctx.beginPath();
    ctx.ellipse(x + 8 * s, baseY - 2, 16 * s, 6 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawCanopyModern(off, baseY, color, alpha, s) {
    var span = 176;
    var shift = wrap(off, span);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.rect(0, 0, VW, GROUND_Y);
    ctx.clip();
    for (var i = -1; i < 5; i++) {
      var x = i * span - shift;
      var h = (70 + hash(i + 9) * 66) * s;
      drawPalmModern(x, baseY, h, s, color);
    }
    // low bush silhouettes hugging the ground line
    for (var b = 0; b < 7; b++) {
      var bx = wrap(b * 79 + shift * 0.4, VW + 80) - 40;
      var by = GROUND_Y - 1;
      ctx.beginPath();
      ctx.ellipse(bx, by, 26 * s, 5.5 * s, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(bx + 14, by, 16 * s, 4 * s, 0, Math.PI, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawJungleModern(cam) {
    var t = G.time;
    // sky
    var sky = ctx.createLinearGradient(0, 0, 20, GROUND_Y + 10);
    sky.addColorStop(0, '#04050f');
    sky.addColorStop(0.26, '#0a1030');
    sky.addColorStop(0.5, '#281a4b');
    sky.addColorStop(0.7, '#642b5c');
    sky.addColorStop(0.86, '#c2554f');
    sky.addColorStop(1, '#ffb066');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, VW, GROUND_Y + 12);

    // stars
    for (var s = 0; s < 62; s++) {
      var sx = wrap(s * 71 + 13 - cam * 0.016, VW + 20) - 10;
      var sy2 = hash(s * 3 + 2) * 116;
      var tw = 0.25 + 0.65 * (0.5 + 0.5 * Math.sin(t * 1.6 + s));
      ctx.globalAlpha = tw * 0.6;
      ctx.fillStyle = s % 7 === 0 ? '#ffd8f0' : '#dff6ff';
      ctx.fillRect(sx, sy2, s % 11 === 0 ? 2 : 1, s % 11 === 0 ? 2 : 1);
    }
    ctx.globalAlpha = 1;

    // cloud bands
    for (var c = 0; c < 4; c++) {
      var cx = wrap(c * 168 + 60 - cam * 0.028, VW + 260) - 130;
      var cy = 34 + c * 21;
      ctx.globalAlpha = 0.1 + c * 0.02;
      ctx.fillStyle = c % 2 ? '#ff9a86' : '#7d6bd6';
      ctx.beginPath();
      ctx.ellipse(cx, cy, 96, 12 + c * 2, -0.06, 0, Math.PI * 2);
      ctx.ellipse(cx + 60, cy + 5, 70, 9, 0.05, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    drawMountainModern(cam * 0.055, 176, 82, '#141b38', 0.85);
    drawMountainModern(cam * 0.1, 198, 112, '#0b1226', 1);

    // synthwave sun in front of the far ridges
    var sunX = 348 - wrap(cam * 0.012, 70);
    var sunY = 128;
    var rg = ctx.createRadialGradient(sunX, sunY, 6, sunX, sunY, 142);
    rg.addColorStop(0, 'rgba(255,226,168,0.5)');
    rg.addColorStop(0.35, 'rgba(255,150,110,0.2)');
    rg.addColorStop(1, 'rgba(255,80,120,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(sunX - 146, sunY - 146, 292, 292);
    ctx.save();
    ctx.beginPath();
    ctx.arc(sunX, sunY, 37, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#ffe0a6';
    ctx.fillRect(sunX - 40, sunY - 40, 80, 80);
    ctx.fillStyle = 'rgba(58,26,72,0.5)';
    for (var sy = -40; sy < 42; sy += 7) {
      ctx.fillRect(sunX - 42, sunY + sy, 84, 2.8);
    }
    ctx.restore();

    // horizon haze
    var haze = ctx.createLinearGradient(0, 140, 0, 238);
    haze.addColorStop(0, 'rgba(255,120,90,0)');
    haze.addColorStop(0.62, 'rgba(255,120,90,0.16)');
    haze.addColorStop(1, 'rgba(255,190,120,0.03)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, 130, VW, 112);

    drawCanopyModern(cam * 0.2, 238, '#0a1a1e', 0.92, 0.95);
    drawCanopyModern(cam * 0.36, 242, '#05100f', 1, 1.12);

    // god rays
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.06 + 0.02 * Math.sin(t * 0.4);
    var ray = ctx.createLinearGradient(sunX, sunY, sunX + 60, GROUND_Y);
    ray.addColorStop(0, '#ffd8a0');
    ray.addColorStop(1, 'rgba(255,170,100,0)');
    ctx.fillStyle = ray;
    ctx.beginPath();
    ctx.moveTo(sunX - 20, sunY - 8);
    ctx.lineTo(sunX + 10, sunY - 4);
    ctx.lineTo(sunX + 190, GROUND_Y + 30);
    ctx.lineTo(sunX + 40, GROUND_Y + 30);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // fireflies
    for (var f = 0; f < 14; f++) {
      var fx = wrap(hash(f * 5) * VW + Math.sin(t * 0.5 + f) * 22 - cam * 0.45, VW);
      var fy = 146 + hash(f * 9 + 1) * 78 + Math.sin(t * 1.1 + f * 2) * 5;
      glowDot(fx, fy, 3.4, 'rgba(255,230,130,0.85)', 0.35 + 0.35 * (0.5 + 0.5 * Math.sin(t * 3 + f)));
    }
  }

  function drawFortressModern(cam) {
    var t = G.time;
    var wall = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    wall.addColorStop(0, '#03040a');
    wall.addColorStop(0.42, '#070a16');
    wall.addColorStop(0.78, '#0b0a1c');
    wall.addColorStop(1, '#120c24');
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, VW, GROUND_Y + 8);

    // ceiling
    ctx.fillStyle = '#020307';
    ctx.fillRect(0, 0, VW, 20);
    ctx.fillStyle = 'rgba(100,247,255,0.18)';
    ctx.fillRect(0, 19, VW, 1);

    // back wall panels
    var shift = wrap(cam * 0.14, 88);
    for (var i = -1; i < 8; i++) {
      var x = i * 88 - shift;
      var pg = ctx.createLinearGradient(0, 26, 0, 214);
      pg.addColorStop(0, '#0c1224');
      pg.addColorStop(1, '#05070f');
      ctx.fillStyle = pg;
      ctx.fillRect(x + 3, 26, 82, 188);
      ctx.fillStyle = 'rgba(100,247,255,0.09)';
      ctx.fillRect(x + 3, 26, 82, 1);
      ctx.fillStyle = 'rgba(120,150,255,0.05)';
      ctx.fillRect(x + 3, 108, 82, 1);
      // rivets
      for (var ry = 34; ry < 208; ry += 22) {
        ctx.fillStyle = 'rgba(160,200,255,0.12)';
        ctx.fillRect(x + 8, ry, 1.5, 1.5);
        ctx.fillRect(x + 77, ry, 1.5, 1.5);
      }
    }

    // hazard chevrons
    var cs = wrap(cam * 0.22, 260);
    for (var c = -1; c < 4; c++) {
      var hx = c * 260 - cs + 40;
      ctx.save();
      ctx.globalAlpha = 0.32;
      ctx.fillStyle = '#ffb347';
      for (var q = 0; q < 5; q++) {
        ctx.beginPath();
        ctx.moveTo(hx + q * 18, 214);
        ctx.lineTo(hx + q * 18 + 8, 214);
        ctx.lineTo(hx + q * 18 + 22, 198);
        ctx.lineTo(hx + q * 18 + 14, 198);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    // pipes
    var ps = wrap(cam * 0.3, 148);
    for (var p = -1; p < 6; p++) {
      var px = p * 148 - ps + 20;
      var grd = ctx.createLinearGradient(px, 0, px + 12, 0);
      grd.addColorStop(0, '#0e1626');
      grd.addColorStop(0.4, '#22304a');
      grd.addColorStop(0.6, '#141f33');
      grd.addColorStop(1, '#070b14');
      ctx.fillStyle = grd;
      ctx.fillRect(px, 24, 12, 200);
      for (var jj = 50; jj < 215; jj += 38) {
        ctx.fillStyle = '#2c3d5c';
        ctx.fillRect(px - 2, jj, 16, 4);
        ctx.fillStyle = 'rgba(100,247,255,0.35)';
        ctx.fillRect(px - 2, jj, 16, 1);
      }
    }

    // cables
    ctx.strokeStyle = 'rgba(3,5,10,0.9)';
    ctx.lineWidth = 2.4;
    for (var cb = 0; cb < 4; cb++) {
      var ox = wrap(cb * 160 - cam * 0.42, VW + 200) - 60;
      ctx.beginPath();
      ctx.moveTo(ox - 60, 26);
      ctx.quadraticCurveTo(ox, 74 + cb * 5, ox + 90, 28);
      ctx.stroke();
    }

    // emergency lights
    var ls = wrap(cam * 0.26, 196);
    for (var l = -1; l < 4; l++) {
      var lx = l * 196 - ls + 60;
      var blink = 0.35 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin(t * 2.2 + l), 3);
      glowDot(lx, 38, 26, 'rgba(255,47,120,0.8)', blink * 0.65);
      ctx.fillStyle = '#ff5d86';
      ctx.fillRect(lx - 3, 36, 6, 3);
    }

    // distant reactor glow
    var pulse = 0.55 + 0.25 * Math.sin(t * 1.4);
    var rgr = ctx.createRadialGradient(VW - 50, 150, 4, VW - 50, 150, 160);
    rgr.addColorStop(0, 'rgba(255,47,156,0.34)');
    rgr.addColorStop(0.5, 'rgba(139,107,255,0.12)');
    rgr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rgr;
    ctx.fillRect(VW - 210, 0, 210, GROUND_Y);
    glowDot(VW - 50, 150, 60, 'rgba(255,90,180,0.5)', pulse * 0.5);

    // grid lines
    ctx.strokeStyle = 'rgba(100,247,255,0.05)';
    ctx.lineWidth = 0.7;
    for (var gx = -wrap(cam * 0.5, 24); gx < VW; gx += 24) {
      ctx.beginPath(); ctx.moveTo(gx, 200); ctx.lineTo(gx, 232); ctx.stroke();
    }
    for (var gy = 204; gy < 232; gy += 7) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(VW, gy); ctx.stroke();
    }

    // fog
    var fog = ctx.createLinearGradient(0, 190, 0, 240);
    fog.addColorStop(0, 'rgba(60,80,160,0)');
    fog.addColorStop(1, 'rgba(90,110,200,0.09)');
    ctx.fillStyle = fog;
    ctx.fillRect(0, 180, VW, 62);

    // hanging sparks
    for (var sp = 0; sp < 26; sp++) {
      var spx = wrap(hash(sp * 7) * VW - cam * 0.6 + t * 6, VW);
      var spy = wrap(hash(sp * 11 + 3) * 260 + t * (10 + hash(sp) * 16), 260);
      ctx.globalAlpha = 0.18 + hash(sp * 3) * 0.3;
      ctx.fillStyle = sp % 5 === 0 ? '#64f7ff' : '#ff8b3d';
      ctx.fillRect(spx, spy, 1.2, 1.2);
    }
    ctx.globalAlpha = 1;
  }

  /* --------------------------------------------------------------------------
     21. BACKGROUNDS — 8-bit
     -------------------------------------------------------------------------- */
  function ditherBand(y, h, colorA, colorB, step) {
    ctx.fillStyle = colorA;
    ctx.fillRect(0, y, VW, h);
    ctx.fillStyle = colorB;
    step = step || 4;
    for (var yy = y; yy < y + h; yy += step) {
      for (var xx = ((yy / step) % 2) * step; xx < VW; xx += step * 2) {
        ctx.fillRect(xx, yy, step, step);
      }
    }
  }

  function drawPixelCircle(cx, cy, r, color) {
    ctx.fillStyle = color;
    for (var y = -r; y <= r; y += 1) {
      var w = Math.floor(Math.sqrt(r * r - y * y));
      ctx.fillRect(Math.floor(cx - w), Math.floor(cy + y), w * 2 + 1, 1);
    }
  }

  function drawJungleRetro(cam) {
    // sky bands
    ctx.fillStyle = '#0a1322'; ctx.fillRect(0, 0, VW, 74);
    ctx.fillStyle = '#101f30'; ctx.fillRect(0, 74, VW, 48);
    ditherBand(122, 26, '#132a2a', '#1b3a30', 4);
    ditherBand(148, 30, '#1c3e2c', '#2b5634', 4);
    ctx.fillStyle = '#0a1410'; ctx.fillRect(0, 178, VW, 54);

    // pixel moon with a soft stepped halo
    var mx = 354 - wrap(cam * 0.02, 60);
    drawPixelCircle(mx, 64, 31, '#16241b');
    drawPixelCircle(mx, 64, 27, '#2a3a27');
    drawPixelCircle(mx, 64, 24, '#5c5a37');
    drawPixelCircle(mx, 64, 21, '#f4e3a1');
    ctx.fillStyle = '#e1c980';
    ctx.fillRect(mx - 12, 56, 6, 3);
    ctx.fillRect(mx + 3, 68, 8, 4);
    ctx.fillRect(mx - 5, 74, 4, 3);

    // stars
    for (var s = 0; s < 26; s++) {
      var sx = wrap(s * 83 + 9 - cam * 0.03, VW);
      var sy = hash(s * 5) * 90;
      ctx.fillStyle = (s + Math.floor(G.time * 2)) % 13 === 0 ? '#ffffff' : '#7f9fb8';
      ctx.fillRect(sx, sy, 1, 1);
    }

    // stepped mountains
    var off = cam * 0.06;
    var base = 150;
    for (var layer = 0; layer < 2; layer++) {
      ctx.fillStyle = layer === 0 ? '#0f2430' : '#0a1922';
      var step = layer === 0 ? 18 : 14;
      for (var x = -step; x < VW + step; x += step) {
        var idx = Math.floor((x + off * (layer + 1)) / step);
        var h = (layer === 0 ? 34 : 48) + Math.floor(hash(idx * 3 + layer) * 38);
        ctx.fillRect(x, base - h, step, h + 30);
      }
      base += 18;
    }

    // pixel jungle silhouettes
    for (var layer2 = 0; layer2 < 2; layer2++) {
      var span = layer2 === 0 ? 96 : 128;
      var shift = wrap(cam * (0.18 + layer2 * 0.17), span);
      ctx.fillStyle = layer2 === 0 ? '#07140e' : '#040c08';
      for (var i = -1; i < Math.ceil(VW / span) + 2; i++) {
        var x2 = i * span - shift;
        var h2 = (layer2 === 0 ? 44 : 62) + hash(i * 7 + layer2) * 34;
        var top = 216 - h2;
        ctx.fillRect(x2 + 10, top, 5, h2);
        // blocky fronds
        ctx.fillRect(x2 - 4, top + 4, 20, 4);
        ctx.fillRect(x2 - 8, top + 10, 12, 4);
        ctx.fillRect(x2 + 14, top + 9, 14, 4);
        ctx.fillRect(x2 + 2, top - 4, 16, 5);
        // low pixel undergrowth
        ctx.fillRect(x2 - 15, 230, 32, 2);
        ctx.fillRect(x2 - 9, 228, 20, 2);
        ctx.fillRect(x2 - 4, 226, 10, 2);
      }
    }

    // horizon haze
    ctx.fillStyle = 'rgba(70,120,70,0.18)';
    ctx.fillRect(0, 160, VW, 24);
  }

  function drawFortressRetro(cam) {
    ctx.fillStyle = '#05060d';
    ctx.fillRect(0, 0, VW, GROUND_Y + 6);
    // wall bands
    ctx.fillStyle = '#090b15';
    ctx.fillRect(0, 18, VW, 96);
    ctx.fillStyle = '#0c0f1e';
    ctx.fillRect(0, 114, VW, 118);
    // ceiling
    ctx.fillStyle = '#020307';
    ctx.fillRect(0, 0, VW, 18);
    ctx.fillStyle = '#1b3a4a';
    ctx.fillRect(0, 17, VW, 2);

    // panel grid
    ctx.strokeStyle = '#131a2b';
    ctx.lineWidth = 1;
    var off = wrap(cam * 0.12, 40);
    for (var x = -off; x < VW; x += 40) {
      ctx.beginPath(); ctx.moveTo(Math.floor(x) + 0.5, 20); ctx.lineTo(Math.floor(x) + 0.5, 226); ctx.stroke();
    }
    for (var y = 28; y < 226; y += 32) {
      ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(VW, y + 0.5); ctx.stroke();
    }

    // pipes
    var pshift = wrap(cam * 0.28, 120);
    for (var p = -1; p < 6; p++) {
      var px = p * 120 - pshift + 26;
      ctx.fillStyle = '#101a2a';
      ctx.fillRect(px, 20, 10, 204);
      ctx.fillStyle = '#243650';
      ctx.fillRect(px + 2, 20, 3, 204);
      ctx.fillStyle = '#0a0f1a';
      ctx.fillRect(px - 2, 60, 14, 4);
      ctx.fillRect(px - 2, 140, 14, 4);
    }

    // hazard stripes
    var hs = wrap(cam * 0.2, 96);
    for (var h = -1; h < 7; h++) {
      var hx = h * 96 - hs;
      for (var q = 0; q < 4; q++) {
        ctx.fillStyle = '#8a6a1a';
        ctx.beginPath();
        ctx.moveTo(hx + q * 12, 216);
        ctx.lineTo(hx + q * 12 + 6, 216);
        ctx.lineTo(hx + q * 12 + 14, 206);
        ctx.lineTo(hx + q * 12 + 8, 206);
        ctx.closePath();
        ctx.fill();
      }
    }

    // blinking lights
    var lshift = wrap(cam * 0.22, 140);
    for (var l = -1; l < 5; l++) {
      var lx = l * 140 - lshift + 40;
      if ((Math.floor(G.time * 3) + l) % 2 === 0) {
        ctx.fillStyle = '#ff4d5e';
        ctx.fillRect(lx - 3, 40, 6, 4);
        ctx.fillStyle = '#7a1420';
        ctx.fillRect(lx - 5, 44, 10, 2);
      }
    }

    // reactor glow (retro blocky)
    var pulse = (Math.floor(G.time * 4) % 2) === 0;
    ctx.fillStyle = pulse ? '#3a0f34' : '#2a0a26';
    for (var rg = 0; rg < 5; rg++) {
      ctx.fillRect(VW - 34 - rg * 6, 120 + rg * 4, 26 + rg * 4, 60 - rg * 8);
    }
    ctx.fillStyle = '#ff2f9c';
    ctx.fillRect(VW - 22, 138, 8, 20);

    // floor grid
    ctx.strokeStyle = '#0f2330';
    for (var gx = -wrap(cam * 0.5, 24); gx < VW; gx += 24) {
      ctx.beginPath(); ctx.moveTo(Math.floor(gx) + 0.5, 206); ctx.lineTo(Math.floor(gx) + 0.5, 232); ctx.stroke();
    }
    ctx.strokeStyle = '#12303a';
    for (var gy = 210; gy < 232; gy += 6) {
      ctx.beginPath(); ctx.moveTo(0, gy + 0.5); ctx.lineTo(VW, gy + 0.5); ctx.stroke();
    }
  }

  /* --------------------------------------------------------------------------
     22. WORLD — ground, waterfalls, platforms, checkpoints, lasers
     -------------------------------------------------------------------------- */
  function drawWaterfalls(st, cam) {
    if (G.gfx === 'modern') {
      if (st.key === 'jungle') {
      for (var i = 0; i < st.gaps.length; i++) {
        var g = st.gaps[i];
        var x = g[0], w = g[1] - g[0];
        if (x + w < cam - 20 || x > cam + VW + 20) continue;
        // dark chasm
        var chasm = ctx.createLinearGradient(0, GROUND_Y, 0, VH);
        chasm.addColorStop(0, 'rgba(4,10,16,0)');
        chasm.addColorStop(0.4, 'rgba(4,12,20,0.6)');
        chasm.addColorStop(1, '#03070b');
        ctx.fillStyle = chasm;
        ctx.fillRect(x, GROUND_Y - 8, w, VH - GROUND_Y + 8);
        // waterfall: narrow bright core + darker edges + animated streaks
        var wx = x + 15, ww = w - 30;
        var wf = ctx.createLinearGradient(0, GROUND_Y - 4, 0, VH);
        wf.addColorStop(0, 'rgba(150,235,255,0.05)');
        wf.addColorStop(0.28, 'rgba(120,220,255,0.13)');
        wf.addColorStop(0.75, 'rgba(70,160,215,0.07)');
        wf.addColorStop(1, 'rgba(20,60,90,0.02)');
        ctx.fillStyle = wf;
        ctx.fillRect(wx, GROUND_Y - 4, ww, VH - GROUND_Y + 4);
        var core = ctx.createLinearGradient(x + w * 0.35, 0, x + w * 0.65, 0);
        core.addColorStop(0, 'rgba(200,255,255,0)');
        core.addColorStop(0.5, 'rgba(200,255,255,0.12)');
        core.addColorStop(1, 'rgba(200,255,255,0)');
        ctx.fillStyle = core;
        ctx.fillRect(x + w * 0.35, GROUND_Y - 4, w * 0.3, VH - GROUND_Y);
        ctx.globalAlpha = 0.5;
        for (var k = 0; k < 18; k++) {
          var lx = wx + 2 + hash(k * 3 + i) * (ww - 4);
          var off = (G.time * (70 + hash(k) * 110) + k * 27) % (VH - GROUND_Y + 24);
          var ll = 5 + hash(k * 7) * 11;
          ctx.fillStyle = k % 4 === 0 ? '#eaffff' : '#8be9ff';
          ctx.fillRect(lx, GROUND_Y + off - 12, k % 5 === 0 ? 2 : 1, ll);
        }
        ctx.globalAlpha = 1;
        // splash at the bottom
        for (var sp2 = 0; sp2 < 8; sp2++) {
          var sx3 = wx + 2 + hash(sp2 * 11 + i) * (ww - 4);
          var sy3 = VH - 6 - hash(sp2 * 3) * 8;
          ctx.globalAlpha = 0.25 + hash(sp2) * 0.3;
          ctx.fillStyle = sp2 % 2 ? '#d8ffff' : '#8be9ff';
          ctx.fillRect(sx3, sy3, 2, 1);
        }
        ctx.globalAlpha = 1;
        // wet rocks framing the channel
        ctx.fillStyle = '#050b10';
        for (var rk2 = 0; rk2 < 5; rk2++) {
          var rh = 8 + hash(rk2 * 3 + i) * 22;
          ctx.fillRect(x - 2 + rk2 * 3, GROUND_Y - 2 + rk2 * 4, 3, VH - GROUND_Y - rh + 6);
          ctx.fillRect(x + w - 1 - rk2 * 3, GROUND_Y - 2 + rk2 * 4, 3, VH - GROUND_Y - rh + 6);
        }
        ctx.fillStyle = 'rgba(160,240,255,0.18)';
        ctx.fillRect(x + 1, GROUND_Y + 2, 2, VH - GROUND_Y - 10);
        ctx.fillRect(x + w - 3, GROUND_Y + 4, 2, VH - GROUND_Y - 14);
        ctx.fillStyle = '#e8ffff';
        for (var fp = 0; fp < 8; fp++) {
          ctx.globalAlpha = 0.35 + hash(fp) * 0.3;
          ctx.fillRect(wx + hash(fp * 9 + i) * (ww - 8), GROUND_Y - 7, 3 + hash(fp) * 4, 1);
        }
        ctx.globalAlpha = 1;
        // soft mist
        glowDot(x + w * 0.5, GROUND_Y + 4, w * 0.26, 'rgba(170,240,255,0.38)', 0.13);
        glowDot(x + w * 0.28, GROUND_Y + 12, w * 0.18, 'rgba(170,240,255,0.38)', 0.1);
        glowDot(x + w * 0.74, GROUND_Y + 14, w * 0.2, 'rgba(170,240,255,0.38)', 0.1);
      }
      }
      if (st.key === 'fortress') {
        for (var j = 0; j < st.gaps.length; j++) {
          var gg = st.gaps[j];
          if (gg[0] + (gg[1] - gg[0]) < cam - 20 || gg[0] > cam + VW + 20) continue;
          var pg = ctx.createLinearGradient(0, GROUND_Y, 0, VH);
          pg.addColorStop(0, 'rgba(255,47,156,0.25)');
          pg.addColorStop(0.5, 'rgba(139,107,255,0.12)');
          pg.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = pg;
          ctx.fillRect(gg[0], GROUND_Y, gg[1] - gg[0], VH - GROUND_Y);
          for (var q = 0; q < 8; q++) {
            var bx = gg[0] + 6 + hash(q * 5 + j) * (gg[1] - gg[0] - 12);
            var by = GROUND_Y + ((G.time * 40 + q * 37) % (VH - GROUND_Y));
            ctx.fillStyle = q % 2 ? '#ff6ec7' : '#b28bff';
            ctx.globalAlpha = 0.4 + 0.4 * Math.sin(G.time * 2 + q);
            ctx.fillRect(bx, by, 2, 2);
          }
          ctx.globalAlpha = 1;
        }
      }
      return;
    }

    // retro waterfalls
    for (var r = 0; r < st.gaps.length; r++) {
      var gap = st.gaps[r];
      if (gap[1] < cam - 20 || gap[0] > cam + VW + 20) continue;
      ctx.fillStyle = '#03080c';
      ctx.fillRect(gap[0], GROUND_Y - 6, gap[1] - gap[0], VH - GROUND_Y + 6);
      if (st.key === 'jungle') {
        ctx.fillStyle = '#0c3340';
        ctx.fillRect(gap[0] + 4, GROUND_Y - 4, gap[1] - gap[0] - 8, VH - GROUND_Y);
        for (var k2 = 0; k2 < 9; k2++) {
          var lx2 = gap[0] + 6 + hash(k2 * 7 + r) * (gap[1] - gap[0] - 12);
          var oy = (G.time * 52 + k2 * 23) % (VH - GROUND_Y + 10);
          ctx.fillStyle = k2 % 3 === 0 ? '#e8ffff' : '#5fd8f0';
          ctx.fillRect(Math.floor(lx2), Math.floor(GROUND_Y + oy - 8), 2, 6);
        }
        ctx.fillStyle = '#93f7ff';
        ctx.fillRect(gap[0] + 4, GROUND_Y - 5, gap[1] - gap[0] - 8, 1);
        // mist blocks
        ctx.fillStyle = 'rgba(120,220,240,0.25)';
        for (var mb = 0; mb < 4; mb++) {
          ctx.fillRect(gap[0] + mb * 11 + 2, GROUND_Y - 10 + (mb % 2) * 3, 10, 2);
        }
      } else {
        for (var p2 = 0; p2 < 5; p2++) {
          ctx.fillStyle = p2 % 2 ? '#4a0f3a' : '#1c0a2a';
          ctx.fillRect(gap[0] + p2 * 6, GROUND_Y, gap[1] - gap[0] - p2 * 12, 4 + p2 * 3);
        }
        ctx.fillStyle = '#ff2f9c';
        ctx.fillRect(gap[0] + 8, GROUND_Y + 2, gap[1] - gap[0] - 16, 1);
      }
    }
  }

  function drawGroundWorld(st, cam) {
    var modern = G.gfx === 'modern';
    for (var i = 0; i < st.solids.length; i++) {
      var s = st.solids[i];
      if (s.x + s.w < cam - 30 || s.x > cam + VW + 30) continue;
      if (modern) {
        var g = ctx.createLinearGradient(0, s.y, 0, VH);
        g.addColorStop(0, st.key === 'jungle' ? '#17301c' : '#141b28');
        g.addColorStop(0.28, st.key === 'jungle' ? '#0d1c12' : '#0a0f18');
        g.addColorStop(1, '#03060a');
        ctx.fillStyle = g;
        ctx.fillRect(s.x, s.y, s.w, VH - s.y);
        // top soil
        var soil = ctx.createLinearGradient(0, s.y, 0, s.y + 9);
        if (st.key === 'jungle') {
          soil.addColorStop(0, '#3a6b36');
          soil.addColorStop(1, '#17301c');
        } else {
          soil.addColorStop(0, '#2c4258');
          soil.addColorStop(1, '#111b28');
        }
        ctx.fillStyle = soil;
        ctx.fillRect(s.x, s.y, s.w, 9);
        ctx.fillStyle = st.key === 'jungle' ? '#a8ff8a' : '#64f7ff';
        ctx.globalAlpha = 0.55;
        ctx.fillRect(s.x, s.y, s.w, 1.2);
        ctx.globalAlpha = 0.18;
        ctx.fillRect(s.x, s.y + 2, s.w, 1);
        ctx.globalAlpha = 1;
        // moss / grass
        for (var gx = 0; gx < s.w; gx += 13) {
          var hx = s.x + gx + hash((s.x + gx) * 0.37) * 8;
          var hh = 2 + hash((s.x + gx) * 1.7) * 5;
          ctx.fillStyle = st.key === 'jungle' ? (gx % 3 ? '#3f7a3a' : '#5b9a4a') : 'rgba(100,247,255,0.5)';
          ctx.fillRect(hx, s.y - hh, 1.3, hh);
        }
        // texture stones
        for (var k = 0; k < s.w / 34; k++) {
          var rx = s.x + hash(k * 7 + 3) * s.w;
          var ry = s.y + 12 + hash(k * 11 + 5) * 24;
          ctx.fillStyle = st.key === 'jungle' ? 'rgba(80,120,60,0.22)' : 'rgba(120,160,220,0.12)';
          ctx.fillRect(rx, ry, 3 + hash(k) * 5, 2);
        }
        // roots / drips
        for (var rt = 0; rt < s.w / 70; rt++) {
          var rx2 = s.x + hash(rt * 13 + 5) * s.w;
          ctx.strokeStyle = st.key === 'jungle' ? 'rgba(70,120,60,0.35)' : 'rgba(120,180,220,0.12)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(rx2, s.y + 4);
          ctx.quadraticCurveTo(rx2 + 4, s.y + 14, rx2 - 2, s.y + 20 + hash(rt) * 10);
          ctx.stroke();
        }
        // edge shading
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(s.x, s.y, 3, VH - s.y);
        ctx.fillRect(s.x + s.w - 3, s.y, 3, VH - s.y);
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(s.x, VH - 12, s.w, 12);
      } else {
        ctx.fillStyle = st.key === 'jungle' ? '#13200e' : '#080b12';
        ctx.fillRect(s.x, s.y, s.w, VH - s.y);
        ctx.fillStyle = st.key === 'jungle' ? '#416f28' : '#1c2b3a';
        ctx.fillRect(s.x, s.y, s.w, 4);
        ctx.fillStyle = st.key === 'jungle' ? '#8dc34a' : '#3b5a6a';
        ctx.fillRect(s.x, s.y, s.w, 1);
        for (var tx = 0; tx < s.w; tx += 8) {
          var tx2 = s.x + tx + (hash(tx + s.x) > 0.5 ? 2 : 0);
          if ((tx / 8 + s.x) % 3 === 0) {
            ctx.fillStyle = st.key === 'jungle' ? '#2b4a1a' : '#101a26';
            ctx.fillRect(tx2, s.y + 6, 4, 2);
          }
          if ((tx / 8 + s.x) % 5 === 0) {
            ctx.fillStyle = st.key === 'jungle' ? '#5c8f33' : '#2c4352';
            ctx.fillRect(tx2, s.y - 3, 1, 3);
          }
        }
        ctx.fillStyle = st.key === 'jungle' ? '#0a1308' : '#04060b';
        ctx.fillRect(s.x, VH - 8, s.w, 8);
      }
    }
  }

  function drawPlatforms(st, cam) {
    var modern = G.gfx === 'modern';
    for (var i = 0; i < st.platforms.length; i++) {
      var p = st.platforms[i];
      if (p.x + p.w < cam - 30 || p.x > cam + VW + 30) continue;
      if (modern) {
        var g = ctx.createLinearGradient(0, p.y, 0, p.y + 12);
        if (st.key === 'jungle') {
          g.addColorStop(0, '#33473d');
          g.addColorStop(0.22, '#22352b');
          g.addColorStop(1, '#0a1511');
        } else {
          g.addColorStop(0, '#2b3c52');
          g.addColorStop(0.2, '#1a2636');
          g.addColorStop(1, '#070c14');
        }
        ctx.fillStyle = g;
        rr(p.x, p.y, p.w, 11, 2);
        ctx.fill();
        ctx.fillStyle = st.key === 'jungle' ? '#7cf5a0' : '#64f7ff';
        ctx.globalAlpha = 0.45;
        ctx.fillRect(p.x + 2, p.y, p.w - 4, 1.2);
        ctx.globalAlpha = 1;
        // support struts
        for (var stx = 0; stx < 2; stx++) {
          var sx2 = p.x + 14 + stx * (p.w - 34);
          ctx.fillStyle = st.key === 'jungle' ? 'rgba(10,24,16,0.75)' : 'rgba(8,14,22,0.85)';
          ctx.fillRect(sx2, p.y + 10, 3, 8 + hash(stx + p.x) * 6);
          ctx.fillStyle = 'rgba(100,247,255,0.12)';
          ctx.fillRect(sx2, p.y + 10, 1, 6);
        }
        // moss / panels
        for (var q = 0; q < p.w / 18; q++) {
          var mx = p.x + hash(q * 3 + p.x) * p.w;
          ctx.fillStyle = st.key === 'jungle' ? 'rgba(90,150,70,0.45)' : 'rgba(100,247,255,0.14)';
          ctx.fillRect(mx, p.y + 3, 4, 1.5);
        }
        // hanging vines or cables
        if (st.key === 'jungle') {
          for (var v = 0; v < 2 + (p.w > 100 ? 1 : 0); v++) {
            var vx = p.x + 12 + hash(v * 5 + p.y) * (p.w - 24);
            ctx.strokeStyle = 'rgba(60,110,60,0.65)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(vx, p.y + 10);
            ctx.quadraticCurveTo(vx + 3, p.y + 18, vx + Math.sin(G.time + v) * 2, p.y + 24 + hash(v) * 10);
            ctx.stroke();
          }
        } else {
          ctx.fillStyle = '#0a101a';
          for (var rv = 8; rv < p.w - 6; rv += 16) {
            ctx.fillRect(p.x + rv, p.y + 5, 2, 2);
          }
          ctx.fillStyle = 'rgba(255,179,71,0.45)';
          ctx.fillRect(p.x + 2, p.y + 8, 6, 1);
          ctx.fillRect(p.x + p.w - 8, p.y + 8, 6, 1);
        }
      } else {
        ctx.fillStyle = st.key === 'jungle' ? '#1c2f16' : '#0b111c';
        ctx.fillRect(p.x, p.y, p.w, 7);
        ctx.fillStyle = st.key === 'jungle' ? '#6f9a3a' : '#33526a';
        ctx.fillRect(p.x, p.y, p.w, 2);
        ctx.fillStyle = st.key === 'jungle' ? '#9dc34a' : '#64f7ff';
        ctx.fillRect(p.x, p.y, p.w, 1);
        for (var t2 = 0; t2 < p.w; t2 += 9) {
          if (hash(t2 + p.x) > 0.6) {
            ctx.fillStyle = st.key === 'jungle' ? '#35521f' : '#152231';
            ctx.fillRect(p.x + t2, p.y + 3, 4, 2);
          }
        }
      }
    }
  }

  function drawCheckpoints(st, cam) {
    var modern = G.gfx === 'modern';
    for (var i = 0; i < st.checkpoints.length; i++) {
      var x = st.checkpoints[i];
      if (x < cam - 40 || x > cam + VW + 40) continue;
      var active = G.checkpointIndex >= i;
      var gy = st.groundY;
      var col = active ? (modern ? '#64f7ff' : '#8dc34a') : (modern ? '#31445c' : '#2c3f2a');
      if (modern) {
        ctx.strokeStyle = col;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(x, gy);
        ctx.lineTo(x, gy - 30);
        ctx.stroke();
        ctx.fillStyle = active ? 'rgba(100,247,255,0.9)' : 'rgba(100,140,180,0.35)';
        ctx.beginPath();
        ctx.moveTo(x, gy - 30);
        ctx.lineTo(x + 14, gy - 25);
        ctx.lineTo(x, gy - 20);
        ctx.closePath();
        ctx.fill();
        if (active) glowDot(x + 2, gy - 30, 7, 'rgba(100,247,255,0.8)', 0.45 + 0.3 * Math.sin(G.time * 3));
        ctx.fillStyle = active ? '#aefcff' : '#1b2a3a';
        ctx.fillRect(x - 2, gy - 2, 4, 2);
      } else {
        ctx.fillStyle = active ? '#8dc34a' : '#2c3f2a';
        ctx.fillRect(x, gy - 26, 1, 26);
        ctx.fillRect(x, gy - 26, 9, 2);
        ctx.fillRect(x, gy - 24, 7, 2);
        ctx.fillRect(x, gy - 22, 5, 2);
        ctx.fillStyle = active ? '#e8ffcf' : '#1b2a1a';
        ctx.fillRect(x, gy - 26, 1, 2);
      }
    }
  }

  function drawLasersWorld(st, cam) {
    for (var i = 0; i < G.lasers.length; i++) {
      var l = G.lasers[i];
      if (l.x < cam - 30 || l.x > cam + VW + 30) continue;
      var topY = 64, botY = st.groundY;
      var modern = G.gfx === 'modern';
      if (modern) {
        // emitters
        ctx.fillStyle = '#1b2438';
        ctx.fillRect(l.x - 9, topY - 10, 18, 10);
        ctx.fillRect(l.x - 9, botY - 2, 18, 4);
        ctx.fillStyle = l.on ? '#ff5ef2' : (l.warn ? '#ffb347' : '#33526a');
        ctx.fillRect(l.x - 5, topY - 6, 10, 2);
        if (l.warn) {
          ctx.globalAlpha = 0.35 + 0.4 * Math.abs(Math.sin(G.time * 22));
          ctx.strokeStyle = '#ffb347';
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 6]);
          ctx.beginPath();
          ctx.moveTo(l.x, topY);
          ctx.lineTo(l.x, botY);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;
        }
        if (l.on) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          var w = 16 + Math.sin(G.time * 30) * 2;
          var grd = ctx.createLinearGradient(l.x - w, 0, l.x + w, 0);
          grd.addColorStop(0, 'rgba(255,47,156,0)');
          grd.addColorStop(0.5, 'rgba(255,94,242,0.75)');
          grd.addColorStop(1, 'rgba(255,47,156,0)');
          ctx.fillStyle = grd;
          ctx.fillRect(l.x - w, topY, w * 2, botY - topY);
          ctx.fillStyle = '#fff0ff';
          ctx.fillRect(l.x - 1, topY, 2, botY - topY);
          ctx.restore();
        }
      } else {
        ctx.fillStyle = '#1b2438';
        ctx.fillRect(l.x - 6, topY - 8, 12, 8);
        ctx.fillRect(l.x - 6, botY - 2, 12, 4);
        if (l.warn && Math.floor(G.time * 10) % 2 === 0) {
          ctx.fillStyle = '#ffb347';
          ctx.fillRect(l.x, topY, 1, botY - topY);
        }
        if (l.on) {
          ctx.fillStyle = '#ff2f9c';
          ctx.fillRect(l.x - 3, topY, 6, botY - topY);
          ctx.fillStyle = '#ffd9ff';
          ctx.fillRect(l.x - 1, topY, 2, botY - topY);
          ctx.fillStyle = '#ff5ef2';
          for (var q = 0; q < 5; q++) {
            ctx.fillRect(l.x - 6 + (q % 2) * 2, topY + q * 12 + (G.time * 40) % 12, 12, 2);
          }
        }
      }
    }
  }

  /* --------------------------------------------------------------------------
     23. ENTITIES — modern
     -------------------------------------------------------------------------- */
  function drawLimb(x1, y1, x2, y2, x3, y3, color, w) {
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.stroke();
  }

  function drawPlayerModern(p) {
    var t = G.time;
    var alpha = 1;
    if (p.invuln > 0) alpha = (Math.floor(t * 20) % 2) ? 0.3 : 1;
    var cx = p.x + p.w / 2, feet = p.y + p.h;
    var suit = '#123a52', suit2 = '#1c5a78', suitDark = '#081c2a';
    var trim = '#64f7ff', red = '#ff2f9c', skin = '#f2b98a', boot = '#06121c';
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.ellipse(cx, feet + 1, p.prone ? 18 : 12, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    // faint hero light, helps readability on dark backgrounds
    glowDot(cx, feet - 12, 24, 'rgba(100,247,255,0.20)', 0.55);

    if (p.prone) {
      ctx.translate(cx, feet);
      ctx.scale(p.facing, 1);
      drawLimb(-3, -6, -11, -5, -18, -2.5, suitDark, 3.6);
      drawLimb(-3, -2, -10, -1.5, -16, -0.5, suitDark, 3.2);
      ctx.fillStyle = boot;
      rr(-19, -3.5, 4.4, 3, 1); ctx.fill();
      var bg = ctx.createLinearGradient(0, -11, 0, 0);
      bg.addColorStop(0, suit2); bg.addColorStop(1, suitDark);
      ctx.fillStyle = bg;
      rr(-8, -10.5, 16, 8, 3); ctx.fill();
      ctx.fillStyle = red; ctx.fillRect(-3, -7.5, 8, 1.4);
      ctx.strokeStyle = trim; ctx.lineWidth = 1; ctx.globalAlpha = alpha * 0.85;
      ctx.beginPath(); ctx.moveTo(-6, -9.5); ctx.lineTo(4, -9.5); ctx.stroke();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(10, -7.5, 3.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = red; rr(6.2, -11.6, 7.2, 2.4, 1); ctx.fill();
      ctx.fillStyle = '#071018'; rr(8.4, -8.6, 4.4, 1.6, 0.8); ctx.fill();
      ctx.fillStyle = trim; ctx.fillRect(9.2, -8.3, 2.6, 0.8);
      ctx.strokeStyle = suitDark; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(5, -6); ctx.lineTo(12, -5); ctx.stroke();
      ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(12, -5, 1.7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#081019'; ctx.lineWidth = 3.6;
      ctx.beginPath(); ctx.moveTo(11, -5); ctx.lineTo(23, -5); ctx.stroke();
      ctx.strokeStyle = 'rgba(100,247,255,0.85)'; ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.moveTo(12, -6.3); ctx.lineTo(22, -6.3); ctx.stroke();
      if (p.shootFlash > 0) muzzleFlash(25, -5, '#8ff6ff', 0.95);
      ctx.restore();
      return;
    }

    ctx.translate(cx, feet);
    ctx.scale(p.facing, 1);
    var run = p.onGround && Math.abs(p.vx) > 25;
    var air = !p.onGround;
    var sw = run ? Math.sin(p.walk) * 5.5 : 0;
    var sw2 = run ? Math.sin(p.walk + Math.PI) * 5.5 : 0;

    // bandana ribbons, behind everything
    ctx.save();
    ctx.fillStyle = red;
    ctx.globalAlpha = alpha * 0.95;
    ctx.beginPath();
    ctx.moveTo(-2, -28.5);
    ctx.quadraticCurveTo(-10, -32 + Math.sin(t * 8) * 3, -18, -27 + Math.cos(t * 6) * 4);
    ctx.quadraticCurveTo(-12, -24.5, -2, -25.5);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = alpha * 0.45;
    ctx.beginPath();
    ctx.moveTo(-2, -27);
    ctx.quadraticCurveTo(-8, -23 + Math.cos(t * 7) * 3, -14, -21 + Math.sin(t * 5) * 3);
    ctx.quadraticCurveTo(-8, -21, -1, -24);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = alpha;

    // back arm
    drawLimb(1.5, -19.5, -2.5, -15.5, -1.5 + (run ? -sw * 0.4 : 0), -12.5, '#0d2b3d', 2.8);

    // legs
    if (air) {
      drawLimb(-1.5, -12, -4.5, -7.5, -7, -4, suitDark, 4);
      drawLimb(1.5, -12, 4, -8, 6, -6, suitDark, 4);
      ctx.fillStyle = boot;
      rr(-9.4, -5, 4.6, 2.8, 1.2); ctx.fill();
      rr(5, -7.8, 4.6, 2.8, 1.2); ctx.fill();
      ctx.globalAlpha = alpha * 0.55;
      ctx.fillStyle = trim;
      ctx.fillRect(-9.2, -2.6, 4.2, 0.7);
      ctx.fillRect(5.2, -5.4, 4.2, 0.7);
      ctx.globalAlpha = alpha;
    } else {
      drawLimb(-1.5, -12, -1.5 + sw * 0.35, -6, -1.5 + sw, -1.4, suitDark, 4);
      drawLimb(1.5, -12, 1.5 + sw2 * 0.35, -6, 1.5 + sw2, -1.4, suitDark, 4);
      ctx.fillStyle = boot;
      rr(-3.6 + sw, -2, 5, 2.8, 1.2); ctx.fill();
      rr(-0.6 + sw2, -2, 5, 2.8, 1.2); ctx.fill();
      ctx.globalAlpha = alpha * 0.6;
      ctx.fillStyle = trim;
      ctx.fillRect(-3.4 + sw, 0.2, 4.4, 0.7);
      ctx.fillRect(-0.4 + sw2, 0.2, 4.4, 0.7);
      ctx.globalAlpha = alpha;
    }
    // hips, backpack
    ctx.fillStyle = suitDark;
    rr(-5, -14.5, 10, 4, 2); ctx.fill();
    ctx.fillStyle = '#0a2030';
    rr(-7, -22, 3.6, 8.5, 1.6); ctx.fill();
    ctx.globalAlpha = alpha * 0.5;
    ctx.fillStyle = trim;
    ctx.fillRect(-6.8, -21, 0.8, 5);
    ctx.globalAlpha = alpha;

    // torso
    var tg = ctx.createLinearGradient(-5, -24, 5, -11);
    tg.addColorStop(0, suit2);
    tg.addColorStop(0.55, suit);
    tg.addColorStop(1, suitDark);
    ctx.fillStyle = tg;
    rr(-5, -23.5, 10, 11.5, 3.4); ctx.fill();
    ctx.fillStyle = suit2;
    rr(-6.6, -22, 3.4, 4.4, 1.5); ctx.fill();
    rr(3.2, -22, 3.4, 4.4, 1.5); ctx.fill();
    ctx.fillStyle = '#0d3145';
    rr(-3.8, -21.5, 7.6, 6.2, 2); ctx.fill();
    ctx.strokeStyle = trim;
    ctx.globalAlpha = alpha * 0.8;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-3.2, -19.2); ctx.lineTo(3.2, -19.2); ctx.stroke();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = red;
    ctx.fillRect(-4.6, -12.6, 9.2, 1.7);
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(-1, -12.6, 2, 1.7);
    ctx.strokeStyle = trim;
    ctx.globalAlpha = alpha * 0.7;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-4.9, -21.5); ctx.lineTo(-4.9, -13.6); ctx.stroke();
    ctx.globalAlpha = alpha * 0.28;
    ctx.lineWidth = 0.8;
    rr(-5, -23.5, 10, 11.5, 3.4);
    ctx.stroke();
    ctx.globalAlpha = alpha;

    // head
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.arc(0.8, -26.8, 4.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = red;
    rr(-4.1, -31.2, 9.6, 3.4, 1.4); ctx.fill();
    ctx.beginPath(); ctx.arc(-4.2, -29, 1.7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#061019';
    rr(0.7, -28, 4.6, 1.9, 0.8); ctx.fill();
    ctx.fillStyle = trim;
    ctx.fillRect(1.8, -27.6, 2.6, 0.8);
    ctx.fillStyle = '#d99a70';
    ctx.beginPath(); ctx.arc(-2.8, -26.4, 1, 0, Math.PI * 2); ctx.fill();

    // front arm + gun
    var aim = Math.atan2(p.aimY, p.aimX * p.facing);
    var shx = 0.8, shy = -19.4;
    var handx = shx + Math.cos(aim) * 8.6;
    var handy = shy + Math.sin(aim) * 8.6;
    ctx.strokeStyle = suit2;
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(shx, shy); ctx.lineTo(handx, handy); ctx.stroke();
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.arc(handx, handy, 1.8, 0, Math.PI * 2); ctx.fill();
    var gunx = handx + Math.cos(aim) * 14;
    var guny = handy + Math.sin(aim) * 14;
    ctx.strokeStyle = '#07121c';
    ctx.lineWidth = 3.8;
    ctx.beginPath(); ctx.moveTo(handx, handy); ctx.lineTo(gunx, guny); ctx.stroke();
    ctx.strokeStyle = 'rgba(100,247,255,0.85)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(handx + Math.cos(aim) * 3, handy + Math.sin(aim) * 3 - 1.2);
    ctx.lineTo(gunx, guny - 1.2);
    ctx.stroke();
    ctx.fillStyle = '#ffb347';
    var mx = handx + Math.cos(aim) * 6, my = handy + Math.sin(aim) * 6;
    ctx.save();
    ctx.translate(mx, my);
    ctx.rotate(aim + Math.PI / 2);
    ctx.fillRect(-0.8, 0, 1.6, 2.6);
    ctx.restore();
    if (p.shootFlash > 0) muzzleFlash(gunx, guny, '#9ff8ff', p.weapon === 'spread' ? 1.25 : 0.95);

    if (p.shield > 0) {
      ctx.globalAlpha = alpha * (0.3 + 0.15 * Math.sin(t * 6)) * (p.shieldFlash > 0 ? 1.8 : 1);
      ctx.strokeStyle = '#8bffb0';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(0, -14, 19 + Math.sin(t * 4) * 1.6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = alpha * 0.1;
      ctx.fillStyle = '#8bffb0';
      ctx.beginPath(); ctx.arc(0, -14, 19, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = alpha;
      for (var si = 0; si < p.shield; si++) {
        ctx.fillStyle = '#d6ffe2';
        ctx.beginPath();
        ctx.arc(Math.cos(-Math.PI / 2 + si * 2.1) * 19, -14 + Math.sin(-Math.PI / 2 + si * 2.1) * 19, 1.7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function muzzleFlash(x, y, color, scale) {
    scale = scale || 1;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glowDot(x, y, 9 * scale, color, 0.9);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.4 * scale;
    ctx.beginPath();
    for (var i = 0; i < 4; i++) {
      var a = i * Math.PI / 2 + 0.4;
      ctx.moveTo(x + Math.cos(a) * 2, y + Math.sin(a) * 2);
      ctx.lineTo(x + Math.cos(a) * 9 * scale, y + Math.sin(a) * 9 * scale);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawShadowAt(x, groundY, w, alpha) {
    ctx.fillStyle = 'rgba(0,0,0,' + (alpha == null ? 0.4 : alpha) + ')';
    ctx.beginPath();
    ctx.ellipse(x, groundY + 1, w, w * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawEnemyModern(e) {
    var flash = e.hitFlash > 0;
    var t = G.time;
    if (e.type === 'grunt' || e.type === 'runner') {
      var cx = e.x + e.w / 2, feet = e.y + e.h;
      drawShadowAt(cx, G.level.groundY + 1, 9, 0.35);
      ctx.save();
      ctx.translate(cx, feet);
      ctx.scale(e.facing, 1);
      var run = e.type === 'runner' || Math.abs(e.facing) > 0;
      var sw = Math.sin(e.walk) * (e.type === 'runner' ? 7 : 4);
      var legCol = e.type === 'runner' ? '#4a1c10' : '#241012';
      drawLimb(-1.8, -12, -1.8 + sw * 0.35, -6, -1.8 + sw, -1, legCol, 3.2);
      drawLimb(1.8, -12, 1.8 - sw * 0.35, -6, 1.8 - sw, -1, legCol, 3.2);
      // torso
      var col = flash ? '#ffffff' : (e.type === 'runner' ? '#7a2f1a' : '#5c2026');
      var col2 = flash ? '#ffffff' : (e.type === 'runner' ? '#a34522' : '#7c2a32');
      ctx.fillStyle = col;
      rr(-4.4, -22, 8.8, 11, 2.4);
      ctx.fill();
      ctx.fillStyle = col2;
      rr(-3.5, -20.5, 7, 5.5, 1.6);
      ctx.fill();
      // head
      ctx.fillStyle = flash ? '#ffffff' : '#3a2a24';
      ctx.beginPath(); ctx.arc(0.6, -25, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = flash ? '#ffffff' : '#1a1418';
      rr(-3.2, -28.4, 8, 3.2, 1.2); ctx.fill();
      // visor
      ctx.fillStyle = e.telegraph > 0 ? '#ffd166' : '#ff4d5e';
      ctx.fillRect(0.4, -25.8, 3.6, 1.2);
      // gun
      ctx.strokeStyle = '#0c1016';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(2.2, -17.5);
      ctx.lineTo(10.5, -17.5);
      ctx.stroke();
      if (e.telegraph > 0) {
        ctx.globalAlpha = 0.4 + 0.4 * Math.abs(Math.sin(t * 30));
        ctx.fillStyle = '#ff4d5e';
        ctx.fillRect(10, -18.5, 3, 2);
        ctx.globalAlpha = 1;
      }
      if (e.flash > 0) muzzleFlash(12, -17.5, '#ffb347', 0.7);
      ctx.restore();
      return;
    }

    if (e.type === 'turret') {
      var cx2 = e.x + e.w / 2, cy = e.y + e.h / 2;
      drawShadowAt(cx2, G.level.groundY + 1, 12, 0.3);
      ctx.save();
      ctx.translate(cx2, cy);
      var ang = Math.atan2((G.player ? G.player.y + G.player.h / 2 : cy + 4) - cy, (G.player ? G.player.x + G.player.w / 2 : cx2) - cx2);
      // base
      ctx.fillStyle = flash ? '#ffffff' : '#1a2432';
      rr(-11, 4, 22, 5, 2); ctx.fill();
      ctx.fillStyle = flash ? '#ffffff' : '#26384d';
      ctx.beginPath(); ctx.arc(0, 4, 8, Math.PI, 0); ctx.fill();
      // barrel
      ctx.save();
      ctx.rotate(ang);
      ctx.fillStyle = flash ? '#ffffff' : '#0c141e';
      rr(4, -2, 14, 4, 1.5); ctx.fill();
      ctx.fillStyle = '#ff4d5e';
      ctx.fillRect(14, -1.5, 3, 3);
      ctx.restore();
      // eye
      ctx.fillStyle = flash ? '#ffffff' : '#ff4d5e';
      ctx.beginPath(); ctx.arc(0, 0, 2.6, 0, Math.PI * 2); ctx.fill();
      glowDot(0, 0, 12, 'rgba(255,77,94,0.7)', 0.5 + 0.3 * Math.sin(t * 4));
      if (e.flash > 0) muzzleFlash(Math.cos(ang) * 18, Math.sin(ang) * 18 + 4, '#ffb347', 0.8);
      ctx.restore();
      return;
    }

    if (e.type === 'drone') {
      var cx3 = e.x + e.w / 2, cy3 = e.y + e.h / 2;
      drawShadowAt(cx3, G.level.groundY + 1, 9, 0.18);
      ctx.save();
      ctx.translate(cx3, cy3);
      // rotor disc
      ctx.globalAlpha = 0.35 + 0.15 * Math.sin(t * 30);
      ctx.strokeStyle = '#9ff8ff';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(0, -9, 13, 3, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
      // wings
      ctx.fillStyle = flash ? '#ffffff' : '#131b2a';
      rr(-15, -3, 8, 3, 1.5); ctx.fill();
      rr(7, -3, 8, 3, 1.5); ctx.fill();
      // hull
      var dg = ctx.createLinearGradient(0, -6, 0, 6);
      dg.addColorStop(0, flash ? '#ffffff' : '#33445c');
      dg.addColorStop(1, flash ? '#ffffff' : '#0b1220');
      ctx.fillStyle = dg;
      rr(-10, -6, 20, 12, 5); ctx.fill();
      // eye
      ctx.fillStyle = '#ff2f9c';
      ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
      glowDot(0, 0, 11, 'rgba(255,47,156,0.8)', 0.6);
      if (e.telegraph > 0) {
        ctx.fillStyle = '#ffb347';
        ctx.beginPath(); ctx.arc(0, 6, 2.2, 0, Math.PI * 2); ctx.fill();
      }
      if (e.flash > 0) muzzleFlash(0, 7, '#ff4d5e', 0.65);
      ctx.restore();
    }
  }

  function drawBossModern() {
    var b = G.boss;
    if (!b) return;
    if (b.x > G.cam.x + VW + 180 || b.x + b.w < G.cam.x - 120) return;
    var flash = b.flash > 0;
    if (b.type === 'heli') {
      var cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      // searchlight
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      var lg = ctx.createLinearGradient(cx - 60, cy, cx - 140, G.level.groundY);
      lg.addColorStop(0, 'rgba(255,235,170,0.16)');
      lg.addColorStop(1, 'rgba(255,235,170,0)');
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.moveTo(cx - 58, cy + 8);
      ctx.lineTo(cx - 66, cy + 12);
      ctx.lineTo(cx - 150, G.level.groundY);
      ctx.lineTo(cx - 24, G.level.groundY);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      drawShadowAt(cx, G.level.groundY + 1, 40, 0.22);
      ctx.save();
      ctx.translate(cx, cy);
      // tail boom
      ctx.fillStyle = flash ? '#ffffff' : '#131f22';
      rr(28, -5, 38, 9, 4); ctx.fill();
      ctx.fillStyle = '#1d3a33';
      ctx.beginPath();
      ctx.moveTo(60, -8); ctx.lineTo(72, -18); ctx.lineTo(76, -14); ctx.lineTo(66, 0); ctx.closePath(); ctx.fill();
      // tail rotor
      ctx.strokeStyle = 'rgba(180,240,255,0.5)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(69, -19);
      ctx.lineTo(69, 4);
      ctx.stroke();
      // main body
      var bg = ctx.createLinearGradient(-48, -22, 20, 20);
      bg.addColorStop(0, flash ? '#ffffff' : '#3a5248');
      bg.addColorStop(0.5, flash ? '#ffffff' : '#1d332d');
      bg.addColorStop(1, flash ? '#ffffff' : '#0a1412');
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.moveTo(-54, 2);
      ctx.quadraticCurveTo(-40, -24, 4, -20);
      ctx.quadraticCurveTo(38, -18, 40, 2);
      ctx.quadraticCurveTo(34, 18, -2, 18);
      ctx.quadraticCurveTo(-44, 18, -54, 2);
      ctx.fill();
      // cockpit
      var cg = ctx.createLinearGradient(-48, -12, -20, 6);
      cg.addColorStop(0, 'rgba(140,250,255,0.85)');
      cg.addColorStop(1, 'rgba(30,90,140,0.55)');
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.ellipse(-38, -4, 12, 9, -0.35, 0, Math.PI * 2);
      ctx.fill();
      // nose gun
      ctx.fillStyle = '#0a1214';
      rr(-58, 2, 12, 6, 2); ctx.fill();
      ctx.fillStyle = '#ff2f9c';
      ctx.fillRect(-58, 4, 3, 2);
      // missiles
      ctx.fillStyle = flash ? '#ffffff' : '#24343a';
      rr(-24, 14, 26, 4, 2); ctx.fill();
      rr(8, 14, 22, 4, 2); ctx.fill();
      // skids
      ctx.strokeStyle = '#0a1214';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-30, 18); ctx.lineTo(-14, 26); ctx.lineTo(24, 26);
      ctx.moveTo(6, 18); ctx.lineTo(16, 26);
      ctx.stroke();
      // rotor mast + blades
      ctx.fillStyle = '#24343a';
      ctx.fillRect(-2, -26, 4, 8);
      ctx.save();
      ctx.translate(0, -28);
      ctx.globalAlpha = 0.09;
      ctx.fillStyle = '#c9f7ff';
      ctx.beginPath(); ctx.ellipse(0, 0, 58, 9, 0, 0, Math.PI * 2); ctx.fill();
      for (var rb = 0; rb < 4; rb++) {
        ctx.save();
        ctx.rotate(b.rotor * 0.35 + rb * Math.PI / 2);
        ctx.globalAlpha = 0.32;
        ctx.strokeStyle = '#c9f7ff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-56, 0);
        ctx.lineTo(56, 0);
        ctx.stroke();
        ctx.restore();
      }
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#9ff8ff';
      ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      // glow accents
      ctx.fillStyle = '#64f7ff';
      ctx.fillRect(-50, -8, 4, 1.4);
      // hit flash
      if (b.flash > 0) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = b.flash * 2.6;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(-8, -2, 42, 16, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      return;
    }

    // core boss
    var cx2 = b.x + b.w / 2, cy2 = b.y + b.h / 2;
    var pulse = 0.5 + 0.5 * Math.sin(G.time * 3.2);
    ctx.save();
    ctx.save();
    // halo
    ctx.globalCompositeOperation = 'lighter';
    var halo = ctx.createRadialGradient(cx2, cy2, 6, cx2, cy2, 120);
    halo.addColorStop(0, 'rgba(255,90,180,0.5)');
    halo.addColorStop(0.45, 'rgba(150,70,255,0.18)');
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(cx2 - 130, cy2 - 130, 260, 260);
    ctx.restore();
    // frame
    ctx.fillStyle = '#0c1018';
    rr(b.x - 8, b.y + 8, 14, b.h - 16, 3); ctx.fill();
    rr(b.x + b.w - 6, b.y + 8, 14, b.h - 16, 3); ctx.fill();
    ctx.strokeStyle = 'rgba(100,247,255,0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(b.x - 8.5, b.y + 8, 14, b.h - 16);
    ctx.strokeRect(b.x + b.w - 5.5, b.y + 8, 14, b.h - 16);
    // ring 1
    ctx.save();
    ctx.translate(cx2, cy2);
    ctx.rotate(b.rot);
    ctx.strokeStyle = 'rgba(255,94,242,0.65)';
    ctx.lineWidth = 2;
    for (var i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, 48, i * Math.PI / 2 + 0.22, i * Math.PI / 2 + 1.1);
      ctx.stroke();
    }
    ctx.rotate(-b.rot * 2.2);
    ctx.strokeStyle = 'rgba(100,247,255,0.5)';
    ctx.lineWidth = 1.2;
    for (var j = 0; j < 3; j++) {
      ctx.beginPath();
      ctx.arc(0, 0, 37, j * Math.PI * 2 / 3, j * Math.PI * 2 / 3 + 1.6);
      ctx.stroke();
    }
    ctx.restore();
    // eye housing
    ctx.fillStyle = flash ? '#ffffff' : '#131b26';
    ctx.beginPath(); ctx.arc(cx2, cy2, 29, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#25364a';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx2, cy2, 29, 0, Math.PI * 2); ctx.stroke();
    // iris follows player
    var p = G.player;
    var ang2 = p ? Math.atan2(p.y + p.h / 2 - cy2, p.x + p.w / 2 - cx2) : 0;
    var ix = cx2 + Math.cos(ang2) * 6, iy = cy2 + Math.sin(ang2) * 6;
    ctx.fillStyle = '#ff2f9c';
    ctx.beginPath(); ctx.arc(ix, iy, 14, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd9ec';
    ctx.beginPath(); ctx.arc(ix, iy, 6.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2a0618';
    ctx.beginPath(); ctx.arc(ix, iy, 2.6, 0, Math.PI * 2); ctx.fill();
    glowDot(ix, iy, 60, 'rgba(255,47,156,0.7)', 0.25 + pulse * 0.25);
    // armor plates
    ctx.fillStyle = flash ? '#ffffff' : '#101924';
    rr(b.x + 2, b.y - 6, b.w - 4, 10, 3); ctx.fill();
    rr(b.x + 2, b.y + b.h - 4, b.w - 4, 10, 3); ctx.fill();
    ctx.fillStyle = 'rgba(100,247,255,0.5)';
    ctx.fillRect(b.x + 8, b.y - 4, b.w - 16, 1);
    ctx.fillRect(b.x + 8, b.y + b.h - 2, b.w - 16, 1);
    // cables
    ctx.strokeStyle = 'rgba(20,30,40,0.9)';
    ctx.lineWidth = 2;
    for (var c = 0; c < 4; c++) {
      ctx.beginPath();
      ctx.moveTo(b.x - 8 + c * 8, b.y + b.h - 10);
      ctx.quadraticCurveTo(b.x - 30 + c * 12, b.y + b.h + 20, b.x - 20 + c * 14, G.level.groundY);
      ctx.stroke();
    }
    if (b.flash > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = b.flash * 2.2;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(cx2, cy2, 60, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  /* --------------------------------------------------------------------------
     24. ENTITIES — 8-bit
     -------------------------------------------------------------------------- */
  function drawPlayerRetro(p) {
    if (!p) return;
    var blink = p.invuln > 0 && (Math.floor(G.time * 20) % 2) === 0;
    var alpha = blink ? 0.35 : 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    var cx = Math.round(p.x + p.w / 2), feet = Math.round(p.y + p.h);
    ctx.translate(cx, feet);
    ctx.scale(p.facing, 1);
    var skin = '#f2b98a', red = '#e0493c', vest = '#3f6b31', vest2 = '#284a20';
    var pants = '#2a4018', boot = '#0a0a08', guncol = '#c9d2d8', dark = '#0a0c08';

    // shadow
    ctx.globalAlpha = alpha * 0.35;
    ctx.fillStyle = '#000';
    ctx.fillRect(-6, -1, 12, 2);
    ctx.globalAlpha = alpha;

    if (p.prone) {
      // legs
      ctx.fillStyle = pants;
      ctx.fillRect(-16, -7, 9, 4);
      ctx.fillStyle = boot;
      ctx.fillRect(-18, -5, 3, 2);
      // torso
      ctx.fillStyle = vest;
      ctx.fillRect(-9, -10, 12, 6);
      ctx.fillStyle = vest2;
      ctx.fillRect(-7, -8, 6, 2);
      // head
      ctx.fillStyle = skin;
      ctx.fillRect(3, -10, 6, 5);
      ctx.fillStyle = red;
      ctx.fillRect(2, -11, 7, 2);
      ctx.fillRect(-2, -9, 3, 2);
      // eye
      ctx.fillStyle = dark;
      ctx.fillRect(7, -9, 1, 1);
      // gun
      ctx.fillStyle = guncol;
      ctx.fillRect(8, -6, 9, 2);
      ctx.fillStyle = dark;
      ctx.fillRect(16, -6, 2, 2);
      if (p.shootFlash > 0) {
        ctx.fillStyle = '#ffd166';
        ctx.fillRect(18, -7, 3, 3);
      }
      ctx.restore();
      return;
    }

    var run = p.onGround && Math.abs(p.vx) > 25;
    var ph = run ? (Math.floor(p.walk * 1.1) % 2) : 0;
    var sw = run ? (ph ? 2 : -2) : 0;
    var air = !p.onGround;

    // legs
    ctx.fillStyle = pants;
    if (air) {
      ctx.fillRect(-4, -10, 3, 6);
      ctx.fillRect(1, -10, 3, 5);
      ctx.fillStyle = boot;
      ctx.fillRect(-5, -4, 3, 2);
      ctx.fillRect(3, -5, 3, 2);
    } else {
      ctx.fillRect(-3 + sw, -10, 3, 8 - Math.abs(sw));
      ctx.fillRect(1 - sw, -10, 3, 8 - Math.abs(sw));
      ctx.fillStyle = boot;
      ctx.fillRect(-4 + sw, -2, 4, 2);
      ctx.fillRect(1 - sw, -2, 4, 2);
      ctx.fillStyle = '#3f5a2a';
      ctx.fillRect(-4 + sw, -2, 4, 1);
      ctx.fillRect(1 - sw, -2, 4, 1);
    }
    // torso
    ctx.fillStyle = vest;
    ctx.fillRect(-4, -20, 9, 10);
    ctx.fillStyle = vest2;
    ctx.fillRect(-3, -19, 6, 3);
    ctx.fillStyle = dark;
    ctx.fillRect(-4, -20, 1, 10);
    // belt
    ctx.fillStyle = red;
    ctx.fillRect(-4, -11, 9, 1);
    // bandana tails
    ctx.fillStyle = red;
    var flut = Math.floor(G.time * 8) % 2;
    ctx.fillRect(-7, -26 - flut, 4, 2);
    ctx.fillRect(-9, -25 + flut, 3, 2);
    // head
    ctx.fillStyle = skin;
    ctx.fillRect(-3, -28, 7, 7);
    ctx.fillStyle = red;
    ctx.fillRect(-4, -29, 9, 2);
    ctx.fillRect(-3, -27, 2, 2);
    // eye
    ctx.fillStyle = dark;
    ctx.fillRect(1, -25, 1, 2);

    // arm + gun by aim
    var ax = p.aimX, ay = p.aimY;
    if (ay < -0.9) {
      ctx.fillStyle = skin;
      ctx.fillRect(1, -26, 2, 5);
      ctx.fillStyle = guncol;
      ctx.fillRect(1, -35, 2, 10);
      ctx.fillStyle = dark;
      ctx.fillRect(1, -36, 2, 2);
      if (p.shootFlash > 0) { ctx.fillStyle = '#ffd166'; ctx.fillRect(0, -38, 4, 3); }
    } else if (ay < -0.2) {
      ctx.fillStyle = skin;
      ctx.fillRect(2, -24, 2, 4);
      ctx.fillStyle = guncol;
      ctx.fillRect(3, -28, 3, 2);
      ctx.fillRect(5, -30, 3, 2);
      ctx.fillRect(7, -32, 3, 2);
      if (p.shootFlash > 0) { ctx.fillStyle = '#ffd166'; ctx.fillRect(10, -33, 3, 3); }
    } else if (ay > 0.2) {
      ctx.fillStyle = skin;
      ctx.fillRect(2, -19, 2, 4);
      ctx.fillStyle = guncol;
      ctx.fillRect(3, -16, 3, 2);
      ctx.fillRect(5, -14, 3, 2);
      ctx.fillRect(7, -12, 2, 2);
      if (p.shootFlash > 0) { ctx.fillStyle = '#ffd166'; ctx.fillRect(9, -12, 3, 3); }
    } else {
      ctx.fillStyle = skin;
      ctx.fillRect(2, -19, 3, 2);
      ctx.fillStyle = guncol;
      ctx.fillRect(4, -19, 8, 2);
      ctx.fillStyle = dark;
      ctx.fillRect(4, -17, 2, 2);
      ctx.fillRect(11, -19, 2, 2);
      if (p.shootFlash > 0) { ctx.fillStyle = '#ffd166'; ctx.fillRect(13, -20, 3, 3); }
    }
    // shield ring
    if (p.shield > 0 && !blink) {
      ctx.globalAlpha = alpha * (0.5 + 0.3 * Math.sin(G.time * 8));
      ctx.strokeStyle = '#8bffb0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, -15, 15, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawEnemyRetro(e) {
    var flash = e.hitFlash > 0;
    var t = G.time;
    if (e.type === 'grunt' || e.type === 'runner') {
      var cx = Math.round(e.x + e.w / 2), feet = Math.round(e.y + e.h);
      ctx.save();
      ctx.translate(cx, feet);
      ctx.scale(e.facing, 1);
      ctx.globalAlpha = 0.35; ctx.fillStyle = '#000'; ctx.fillRect(-6, -1, 12, 2); ctx.globalAlpha = 1;
      var uniform = flash ? '#ffffff' : (e.type === 'runner' ? '#a33a1a' : '#a32a32');
      var uni2 = flash ? '#ffffff' : (e.type === 'runner' ? '#d05a2a' : '#d03a42');
      var skin = flash ? '#ffffff' : '#c99370';
      var ph = Math.floor(e.walk * 1.1) % 2;
      var sw = ph ? 2 : -2;
      ctx.fillStyle = flash ? '#ffffff' : '#34161a';
      ctx.fillRect(-4 + sw, -10, 3, 8);
      ctx.fillRect(1 - sw, -10, 3, 8);
      ctx.fillStyle = '#0a0a08';
      ctx.fillRect(-5 + sw, -2, 4, 2);
      ctx.fillRect(2 - sw, -2, 4, 2);
      ctx.fillStyle = uniform;
      ctx.fillRect(-4, -20, 9, 10);
      ctx.fillStyle = uni2;
      ctx.fillRect(-3, -18, 7, 3);
      ctx.fillStyle = skin;
      ctx.fillRect(-3, -27, 6, 7);
      ctx.fillStyle = flash ? '#ffffff' : '#1a1418';
      ctx.fillRect(-4, -28, 8, 3);
      ctx.fillStyle = e.telegraph > 0 ? '#ffd166' : '#ff4d5e';
      ctx.fillRect(1, -25, 2, 1);
      ctx.fillStyle = '#c9d2d8';
      ctx.fillRect(2, -18, 8, 2);
      if (e.telegraph > 0) {
        ctx.fillStyle = (Math.floor(t * 30) % 2) ? '#ffd166' : '#ff4d5e';
        ctx.fillRect(10, -19, 2, 2);
      }
      if (e.flash > 0) { ctx.fillStyle = '#ffd166'; ctx.fillRect(11, -19, 3, 3); }
      ctx.restore();
      return;
    }

    if (e.type === 'turret') {
      var x = Math.round(e.x), y = Math.round(e.y);
      var ang = Math.atan2((G.player ? G.player.y + G.player.h / 2 : y + 10) - (y + 8), (G.player ? G.player.x + G.player.w / 2 : x) - (x + e.w / 2));
      ctx.fillStyle = flash ? '#ffffff' : '#26384a';
      ctx.fillRect(x, y + 9, e.w, 7);
      ctx.fillStyle = flash ? '#ffffff' : '#3a5068';
      ctx.fillRect(x + 3, y + 4, e.w - 6, 6);
      ctx.fillStyle = '#0a0f16';
      ctx.fillRect(x + 6, y + 10, e.w - 12, 3);
      // barrel
      var bx = x + e.w / 2, by = y + 7;
      var dx = Math.cos(ang), dy = Math.sin(ang);
      ctx.fillStyle = '#0a0f16';
      for (var i = 0; i < 10; i += 2) {
        ctx.fillRect(Math.round(bx + dx * i), Math.round(by + dy * i), 2, 2);
      }
      ctx.fillStyle = flash ? '#ffffff' : '#ff4d5e';
      ctx.fillRect(x + e.w / 2 - 2, y + 5, 4, 3);
      if (e.flash > 0) {
        ctx.fillStyle = '#ffd166';
        ctx.fillRect(Math.round(bx + dx * 12) - 1, Math.round(by + dy * 12) - 1, 3, 3);
      }
      return;
    }

    if (e.type === 'drone') {
      var cx2 = Math.round(e.x + e.w / 2), cy = Math.round(e.y + e.h / 2);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(cx2 - 8, G.level.groundY, 16, 2);
      ctx.fillStyle = flash ? '#ffffff' : '#1a2432';
      ctx.fillRect(cx2 - 12, cy - 2, 24, 3);
      ctx.fillStyle = flash ? '#ffffff' : '#33445c';
      ctx.fillRect(cx2 - 9, cy - 6, 18, 10);
      ctx.fillStyle = flash ? '#ffffff' : '#0b1220';
      ctx.fillRect(cx2 - 6, cy - 4, 12, 6);
      ctx.fillStyle = '#ff2f9c';
      ctx.fillRect(cx2 - 2, cy - 2, 4, 3);
      ctx.fillStyle = '#ffd166';
      if (e.telegraph > 0 && Math.floor(G.time * 20) % 2 === 0) ctx.fillRect(cx2 - 1, cy + 4, 2, 2);
      // rotor
      ctx.fillStyle = 'rgba(160,240,255,0.5)';
      var ro = Math.floor(t * 30) % 4;
      ctx.fillRect(cx2 - 14 + ro, cy - 9, 12, 1);
      ctx.fillRect(cx2 + 2 - ro, cy - 9, 12, 1);
    }
  }

  function drawBossRetro() {
    var b = G.boss;
    if (!b) return;
    var flash = b.hitFlash > 0 || b.flash > 0;
    if (b.type === 'heli') {
      var x = Math.round(b.x), y = Math.round(b.y);
      // searchlight-ish
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#ffe9a8';
      for (var i = 0; i < 6; i++) ctx.fillRect(x - 10 - i * 4, y + 24 + i * 2, 18 + i * 2, 2);
      ctx.globalAlpha = 1;
      // tail
      ctx.fillStyle = flash ? '#fff' : '#1b2d28';
      ctx.fillRect(x + 70, y + 16, 40, 8);
      ctx.fillRect(x + 106, y + 8, 8, 10);
      // body
      ctx.fillStyle = flash ? '#fff' : '#2f4a3e';
      ctx.fillRect(x, y + 10, 78, 24);
      ctx.fillStyle = flash ? '#fff' : '#1a2c25';
      ctx.fillRect(x - 6, y + 16, 10, 14);
      ctx.fillStyle = flash ? '#fff' : '#8be9ff';
      ctx.fillRect(x + 4, y + 14, 16, 10);
      ctx.fillStyle = '#0a1412';
      ctx.fillRect(x + 4, y + 14, 16, 2);
      // missiles
      ctx.fillStyle = '#c9d2d8';
      ctx.fillRect(x + 24, y + 36, 20, 4);
      ctx.fillRect(x + 48, y + 36, 18, 4);
      // skids
      ctx.fillStyle = '#0a0f12';
      ctx.fillRect(x + 14, y + 46, 20, 3);
      ctx.fillRect(x + 46, y + 46, 20, 3);
      // rotor
      var ro = Math.floor(G.time * 24) % 10;
      ctx.fillStyle = 'rgba(200,250,255,0.55)';
      for (var j = -2; j < 4; j++) {
        ctx.fillRect(x + 20 + j * 20 + ro * 2, y - 4, 12, 2);
      }
      ctx.fillStyle = '#24343a';
      ctx.fillRect(x + 36, y - 2, 4, 8);
      // cockpit glow
      ctx.fillStyle = '#ff5ef2';
      ctx.fillRect(x + 8, y + 18, 2, 2);
      return;
    }

    // core
    var cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    var t = G.time;
    ctx.fillStyle = '#0b0f18';
    ctx.fillRect(b.x - 6, b.y + 10, 10, b.h - 20);
    ctx.fillRect(b.x + b.w - 4, b.y + 10, 10, b.h - 20);
    ctx.fillStyle = '#1a2638';
    ctx.fillRect(b.x, b.y + 2, b.w, 10);
    ctx.fillRect(b.x, b.y + b.h - 12, b.w, 10);
    // rings
    var pulse = Math.floor(t * 6) % 2;
    drawPixelCircle(cx, cy, 46, '#2a1030');
    drawPixelCircle(cx, cy, 42, '#3d1240');
    drawPixelCircle(cx, cy, 34, pulse ? '#6a1a5a' : '#5a1650');
    drawPixelCircle(cx, cy, 28, '#1a1226');
    drawPixelCircle(cx, cy, 22, '#ff2f9c');
    drawPixelCircle(cx, cy, 16, '#ff8fd0');
    drawPixelCircle(cx, cy, 9, '#ffe0f0');
    // cross armor
    ctx.fillStyle = '#0e1620';
    ctx.fillRect(cx - 4, b.y - 4, 8, 14);
    ctx.fillRect(cx - 4, b.y + b.h - 10, 8, 14);
    ctx.fillStyle = '#64f7ff';
    ctx.fillRect(cx - 48, cy - 1, 10, 2);
    ctx.fillRect(cx + 38, cy - 1, 10, 2);
    if (flash) {
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillRect(b.x + 2, b.y + 4, b.w - 4, b.h - 8);
    }
  }

  /* --------------------------------------------------------------------------
     25. PICKUPS / PODS / BULLETS / PARTICLES / WEATHER
     -------------------------------------------------------------------------- */
  function drawPickupAt(x, y, type) {
    var col = type === 'shield' ? '#8bffb0' : (WEAPONS[type] ? WEAPONS[type].color : '#ffd166');
    var letter = type === 'shield' ? 'B' : (WEAPONS[type] ? WEAPONS[type].key : '?');
    var cx = x + 7.5, cy = y + 7.5;
    if (G.gfx === 'modern') {
      glowDot(cx, cy, 18, col, 0.32 + 0.12 * Math.sin(G.time * 4));
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(G.time * 1.2);
      ctx.strokeStyle = col;
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 1;
      for (var i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(0, 0, 12.5, i * Math.PI / 2, i * Math.PI / 2 + 0.6);
        ctx.stroke();
      }
      ctx.restore();
      ctx.fillStyle = 'rgba(5,12,20,0.92)';
      rr(cx - 8, cy - 8, 16, 16, 4); ctx.fill();
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.4;
      rr(cx - 8, cy - 8, 16, 16, 4); ctx.stroke();
      ctx.fillStyle = col;
      ctx.font = '700 10px ui-monospace, Menlo, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(letter, cx, cy + 0.5);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    } else {
      ctx.fillStyle = '#07100c';
      ctx.fillRect(Math.round(cx) - 6, Math.round(cy) - 6, 12, 12);
      ctx.fillStyle = col;
      ctx.fillRect(Math.round(cx) - 6, Math.round(cy) - 6, 12, 1);
      ctx.fillRect(Math.round(cx) - 6, Math.round(cy) + 5, 12, 1);
      ctx.fillRect(Math.round(cx) - 6, Math.round(cy) - 6, 1, 12);
      ctx.fillRect(Math.round(cx) + 5, Math.round(cy) - 6, 1, 12);
      ctx.fillStyle = col;
      ctx.font = '700 9px ui-monospace, Menlo, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(letter, cx, cy + 0.5);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      if (Math.floor(G.time * 4) % 2 === 0) {
        ctx.fillStyle = col;
        ctx.fillRect(Math.round(cx) - 1, Math.round(cy) - 9, 2, 1);
      }
    }
  }

  function drawPickupsWorld() {
    var fixed = G.level.fixedPickups;
    for (var i = 0; i < fixed.length; i++) {
      var f = fixed[i];
      if (f.taken) continue;
      if (f.x < G.cam.x - 30 || f.x > G.cam.x + VW + 30) continue;
      drawPickupAt(f.x, f.y, f.type);
    }
    for (var j = 0; j < G.pickupDrops.length; j++) {
      var d = G.pickupDrops[j];
      if (d.x < G.cam.x - 30 || d.x > G.cam.x + VW + 30) continue;
      drawPickupAt(d.x, d.y, d.type);
    }
  }

  function drawPodsWorld() {
    for (var i = 0; i < G.pods.length; i++) {
      var pod = G.pods[i];
      if (pod.x < G.cam.x - 50 || pod.x > G.cam.x + VW + 50) continue;
      var cx = pod.x, cy = pod.y;
      if (G.gfx === 'modern') {
        glowDot(cx, cy, 22, 'rgba(100,247,255,0.5)', 0.4);
        ctx.save();
        ctx.translate(cx, cy);
        // wings
        ctx.fillStyle = '#152635';
        ctx.beginPath(); ctx.ellipse(-15, 0, 8, 3.5, -0.2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(15, 0, 8, 3.5, 0.2, 0, Math.PI * 2); ctx.fill();
        // body
        var bg = ctx.createLinearGradient(0, -8, 0, 8);
        bg.addColorStop(0, pod.flash > 0 ? '#ffffff' : '#3a5570');
        bg.addColorStop(1, pod.flash > 0 ? '#ffffff' : '#0a1420');
        ctx.fillStyle = bg;
        rr(-13, -7, 26, 14, 7);
        ctx.fill();
        ctx.strokeStyle = 'rgba(100,247,255,0.8)';
        ctx.lineWidth = 1.2;
        rr(-13, -7, 26, 14, 7);
        ctx.stroke();
        ctx.fillStyle = '#64f7ff';
        ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath(); ctx.arc(0, 0, 1.2, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      } else {
        var px = Math.round(cx), py = Math.round(cy);
        ctx.fillStyle = pod.flash > 0 ? '#ffffff' : '#2a3d52';
        ctx.fillRect(px - 12, py - 4, 24, 8);
        ctx.fillStyle = '#64f7ff';
        ctx.fillRect(px - 10, py - 5, 20, 1);
        ctx.fillRect(px - 10, py + 4, 20, 1);
        ctx.fillStyle = '#8bffb0';
        ctx.fillRect(px - 2, py - 2, 4, 4);
        ctx.fillStyle = '#0a1420';
        ctx.fillRect(px - 15, py - 1, 3, 3);
        ctx.fillRect(px + 12, py - 1, 3, 3);
      }
    }
  }

  function drawBulletsWorld() {
    var i, b;
    for (i = 0; i < G.bullets.length; i++) {
      b = G.bullets[i];
      if (b.x < G.cam.x - 40 || b.x > G.cam.x + VW + 40) continue;
      if (G.gfx === 'modern') {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.translate(b.x, b.y);
        ctx.rotate(b.ang);
        if (b.long) {
          var lg = ctx.createLinearGradient(-18, 0, 10, 0);
          lg.addColorStop(0, 'rgba(255,47,156,0)');
          lg.addColorStop(0.6, b.color);
          lg.addColorStop(1, '#ffffff');
          ctx.fillStyle = lg;
          rr(-18, -2, 28, 4, 2);
          ctx.fill();
          glowDot(2, 0, 10, b.color, 0.65);
        } else {
          glowDot(0, 0, 7, b.color, 0.75);
          ctx.fillStyle = '#ffffff';
          rr(-3.2, -1.3, 6.6, 2.6, 1.3);
          ctx.fill();
        }
        ctx.restore();
      } else {
        ctx.fillStyle = b.long ? '#ff5ef2' : b.color;
        ctx.fillRect(Math.round(b.x) - (b.long ? 5 : 1), Math.round(b.y) - 1, b.long ? 10 : 2, b.long ? 2 : 2);
        if (b.long) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(Math.round(b.x) - 3, Math.round(b.y), 6, 1);
        }
      }
    }
    for (i = 0; i < G.ebullets.length; i++) {
      b = G.ebullets[i];
      if (b.x < G.cam.x - 40 || b.x > G.cam.x + VW + 40) continue;
      if (G.gfx === 'modern') {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        if (b.kind === 'bomb') {
          glowDot(b.x, b.y, 10, 'rgba(255,120,60,0.6)', 0.5 + 0.3 * Math.sin(G.time * 18));
          ctx.fillStyle = '#1a1014';
          ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = Math.floor(G.time * 14) % 2 ? '#ff4d5e' : '#ffd166';
          ctx.beginPath(); ctx.arc(b.x, b.y - 3, 1.4, 0, Math.PI * 2); ctx.fill();
        } else {
          glowDot(b.x, b.y, 9, 'rgba(255,77,94,0.75)', 0.75);
          ctx.fillStyle = '#ffb3b8';
          ctx.beginPath(); ctx.arc(b.x, b.y, 2.6, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#fff6f6';
          ctx.beginPath(); ctx.arc(b.x, b.y, 1.1, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      } else {
        if (b.kind === 'bomb') {
          ctx.fillStyle = '#1a1014';
          ctx.fillRect(Math.round(b.x) - 3, Math.round(b.y) - 3, 6, 6);
          ctx.fillStyle = Math.floor(G.time * 14) % 2 ? '#ff4d5e' : '#ffd166';
          ctx.fillRect(Math.round(b.x) - 1, Math.round(b.y) - 4, 2, 2);
        } else {
          ctx.fillStyle = '#ff4d5e';
          ctx.fillRect(Math.round(b.x) - 2, Math.round(b.y) - 2, 4, 4);
          ctx.fillStyle = '#fff6f6';
          ctx.fillRect(Math.round(b.x) - 1, Math.round(b.y) - 1, 2, 2);
        }
      }
    }
  }

  function drawParticlesWorld() {
    var modern = G.gfx === 'modern';
    for (var i = 0; i < G.particles.length; i++) {
      var p = G.particles[i];
      if (p.x < G.cam.x - 60 || p.x > G.cam.x + VW + 60) continue;
      var k = p.life / p.maxLife;
      if (modern) {
        ctx.save();
        ctx.globalCompositeOperation = p.glow ? 'lighter' : 'source-over';
        if (p.ring) {
          var r = p.size * (1 + (1 - k) * 5);
          ctx.globalAlpha = k * 0.8;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 2 * k + 0.4;
          ctx.beginPath();
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.globalAlpha = Math.min(1, k * 1.4);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(0.4, p.size * (0.4 + k * 0.8)), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      } else {
        if (p.ring) continue;
        ctx.globalAlpha = Math.min(1, k * 1.6);
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), Math.max(1, Math.round(p.size * 0.8)), Math.max(1, Math.round(p.size * 0.8)));
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawWeather() {
    var modern = G.gfx === 'modern';
    var w = G.weather;
    if (!w || !w.length) return;
    if (G.weatherStyle === 'rain') {
      if (modern) {
        ctx.save();
        ctx.strokeStyle = '#bff4ff';
        ctx.lineWidth = 0.8;
        for (var i = 0; i < w.length; i++) {
          var d = w[i];
          ctx.globalAlpha = d.a;
          ctx.beginPath();
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d.x + d.drift * 0.02, d.y + d.len);
          ctx.stroke();
        }
        ctx.restore();
      } else {
        for (var j = 0; j < w.length; j++) {
          var r = w[j];
          ctx.globalAlpha = r.a;
          ctx.fillStyle = j % 5 === 0 ? '#e8ffff' : '#7fd8f0';
          ctx.fillRect(Math.round(r.x), Math.round(r.y), 1, Math.max(2, Math.round(r.len * 0.45)));
        }
        ctx.globalAlpha = 1;
      }
    } else {
      if (modern) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (var k = 0; k < w.length; k++) {
          var e = w[k];
          ctx.globalAlpha = e.a * 0.8;
          ctx.fillStyle = k % 4 === 0 ? '#ff5ef2' : '#ffb347';
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.len * 0.7, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      } else {
        for (var q = 0; q < w.length; q++) {
          var em = w[q];
          ctx.globalAlpha = em.a;
          ctx.fillStyle = q % 4 === 0 ? '#ff5ef2' : '#ffb347';
          ctx.fillRect(Math.round(em.x), Math.round(em.y), 2, 2);
        }
        ctx.globalAlpha = 1;
      }
    }
    ctx.globalAlpha = 1;
  }

  /* --------------------------------------------------------------------------
     26. SCENE RENDERERS
     -------------------------------------------------------------------------- */
  function drawPlayer(p) {
    if (!p || p.dead) return;
    if (G.gfx === 'modern') drawPlayerModern(p);
    else drawPlayerRetro(p);
  }

  function drawEnemiesWorld() {
    for (var i = 0; i < G.enemies.length; i++) {
      var e = G.enemies[i];
      if (e.dead || !e.active) continue;
      if (e.x < G.cam.x - 80 || e.x > G.cam.x + VW + 80) continue;
      if (G.gfx === 'modern') drawEnemyModern(e);
      else drawEnemyRetro(e);
    }
  }

  function drawBoss() {
    if (G.gfx === 'modern') drawBossModern();
    else drawBossRetro();
  }

  function renderGame(shx, shy) {
    var st = G.level, cam = G.cam.x;
    drawBackground(st, cam);
    ctx.save();
    ctx.translate(-cam + shx, shy);
    drawWaterfalls(st, cam);
    drawGroundWorld(st, cam);
    drawPlatforms(st, cam);
    drawCheckpoints(st, cam);
    drawLasersWorld(st, cam);
    drawPickupsWorld();
    drawPodsWorld();
    drawEnemiesWorld();
    drawBoss();
    drawPlayer(G.player);
    drawBulletsWorld();
    drawParticlesWorld();
    ctx.restore();
    drawWeather();
    if (G.lightning > 0) {
      ctx.fillStyle = 'rgba(220,245,255,' + (G.lightning * 0.16) + ')';
      ctx.fillRect(0, 0, VW, VH);
    }
  }

  function renderAttract(kind, shx, shy) {
    var st = kind === 'brief' ? (STAGES[G.stage] || STAGES[0]) : STAGES[0];
    var t = G.attract.t;
    var cam;
    if (kind === 'brief') cam = clamp(st.arenaX - 40, 0, st.width - VW);
    else cam = 620 + Math.sin(t * 0.07) * 90;
    cam = clamp(cam, 0, st.width - VW);
    drawBackground(st, cam);
    ctx.save();
    ctx.translate(-cam + shx, shy);
    drawWaterfalls(st, cam);
    drawGroundWorld(st, cam);
    drawPlatforms(st, cam);
    drawLasersWorld(st, cam);

    if (kind === 'brief') {
      var fake = null;
      if (st.boss.type === 'heli') {
        fake = {
          type: 'heli', x: st.arenaX + 300, y: 88, w: 116, h: 46,
          hp: 1, maxHp: 1, t: t, dying: 0, flash: 0, entry: 0, atk: 99, mg: 99,
          pattern: 0, rotor: t * 20, hitSfx: 0
        };
      } else {
        fake = {
          type: 'core', x: st.arenaX + 328, y: 96, w: 88, h: 116,
          hp: 1, maxHp: 1, t: t, dying: 0, flash: 0, entry: 0, atk: 99, aimT: 99,
          spiralT: 99, rot: t * 0.5, hitSfx: 0
        };
      }
      var old = G.boss;
      G.boss = fake;
      drawBoss();
      G.boss = old;
    } else {
      // hero on patrol
      var p = makePlayer(cam + VW * 0.7, st.groundY - P_H);
      p.onGround = true;
      p.facing = 1;
      p.vx = 120;
      p.walk = t * 12;
      p.aimX = 1;
      p.aimY = 0;
      p.invuln = 0;
      p.t = t;
      p.shootFlash = (t % 1.6) < 0.1 ? 1 : 0;
      drawPlayer(p);
      // a hovering pod
      var pod = { x: cam + VW * 0.9, y: 86 + Math.sin(t * 2) * 7, w: 24, h: 15, flash: 0 };
      var oldPods = G.pods;
      G.pods = [pod];
      drawPodsWorld();
      G.pods = oldPods;
      // fake tracer
      if (G.gfx === 'modern') {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = '#9ff8ff';
        for (var i = 0; i < 3; i++) {
          var tt = (t * 2 + i * 0.6) % 2;
          ctx.globalAlpha = 0.5 * (1 - tt / 2);
          ctx.fillRect(cam + VW * 0.7 + 22 + tt * 130, st.groundY - 44, 10, 1.6);
        }
        ctx.restore();
      }
    }
    ctx.restore();
    // distant gunship silhouetted against the sky (title screen only)
    if (kind === 'title') {
      var hx = 386 + Math.sin(t * 0.13) * 16;
      var hy = 64 + Math.sin(t * 0.7) * 3;
      ctx.save();
      ctx.translate(hx, hy);
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = '#04070d';
      ctx.beginPath();
      ctx.ellipse(0, 0, 26, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(20, -2, 20, 4);
      ctx.fillRect(-22, 3, 14, 3);
      ctx.fillRect(-12, 6, 22, 2);
      ctx.strokeStyle = 'rgba(190,240,255,0.35)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-30, -8); ctx.lineTo(26, -8);
      ctx.stroke();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#ff4d5e';
      ctx.fillRect(-3, 4, 2, 2);
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath();
      ctx.moveTo(-24, 6);
      ctx.lineTo(-34, 16);
      ctx.lineTo(-6, 16);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    drawWeather();
    if (G.lightning > 0) {
      ctx.fillStyle = 'rgba(220,245,255,' + (G.lightning * 0.16) + ')';
      ctx.fillRect(0, 0, VW, VH);
    }
  }

  /* --------------------------------------------------------------------------
     27. UI — DOM REFERENCES
     -------------------------------------------------------------------------- */
  var ui = {};
  var toastEl = null;
  var toastTimer = 0;

  function cacheDom() {
    ui.hud = document.getElementById('hud');
    ui.lives = document.getElementById('hud-lives');
    ui.score = document.getElementById('hud-score');
    ui.weapon = document.getElementById('hud-weapon');
    ui.shieldChip = document.getElementById('shield-chip');
    ui.shield = document.getElementById('hud-shield');
    ui.stage = document.getElementById('hud-stage');
    ui.check = document.getElementById('hud-check');
    ui.bossBar = document.getElementById('bossbar');
    ui.bossName = document.getElementById('boss-name');
    ui.bossFill = document.getElementById('boss-fill');
    ui.gfxTag = document.getElementById('gfx-tag');
    ui.toast = document.getElementById('toast');
    ui.briefStage = document.getElementById('brief-stage');
    ui.briefTitle = document.getElementById('brief-title');
    ui.briefText = document.getElementById('brief-text');
    ui.briefObjectives = document.getElementById('brief-objectives');
    ui.briefZone = document.getElementById('brief-zone');
    ui.briefBoss = document.getElementById('brief-boss');
    ui.overStage = document.getElementById('over-stage');
    ui.overScore = document.getElementById('over-score');
    ui.overStageNum = document.getElementById('over-stage-num');
    ui.clearStage = document.getElementById('clear-stage');
    ui.clearScore = document.getElementById('clear-score');
    ui.clearTime = document.getElementById('clear-time');
    ui.clearLives = document.getElementById('clear-lives');
    ui.winScore = document.getElementById('win-score');
    ui.winTime = document.getElementById('win-time');
    ui.pauseStage = document.getElementById('pause-stage');
    ui.testout = document.getElementById('testout');
    toastEl = ui.toast;
  }

  function setTextAll(selector, text) {
    var nodes = document.querySelectorAll(selector);
    for (var i = 0; i < nodes.length; i++) nodes[i].textContent = text;
  }

  function updateBestLabels() {
    setTextAll('.js-best', pad(G.best, 6));
  }

  /* --------------------------------------------------------------------------
     28. UI — LANGUAGE / SETTINGS
     -------------------------------------------------------------------------- */
  function applyLang() {
    document.documentElement.lang = G.lang;
    document.title = G.lang === 'ru' ? 'CONTRA: НЕОНОВЫЙ РАССВЕТ — HTML5' : 'CONTRA: NEON DAWN — HTML5';
    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      var key = nodes[i].getAttribute('data-i18n');
      nodes[i].innerHTML = t(key);
    }
    updateBestLabels();
    updateSettingsUI();
    if (G.mode === 'brief') applyBrief(G.stage);
    if (G.player) updateHUD(true);
  }

  function updateSettingsUI() {
    if (!ui || !ui.hud) return;
    setTextAll('.js-gfx', t(G.gfx === 'modern' ? 'gfxModern' : 'gfxRetro'));
    setTextAll('.js-gfx-long', t(G.gfx === 'modern' ? 'gfxModernLong' : 'gfxRetroLong'));
    setTextAll('.js-lang', t(G.lang === 'ru' ? 'langRuShort' : 'langEnShort'));
    setTextAll('.js-lang-long', t(G.lang === 'ru' ? 'langRu' : 'langEn'));
    setTextAll('.js-sound', t(G.muted ? 'off' : 'on'));
    setTextAll('.js-sound-long', t(G.muted ? 'offLong' : 'onLong'));
    var dots = document.querySelectorAll('.js-sound-dot');
    for (var i = 0; i < dots.length; i++) dots[i].classList.toggle('on', !G.muted);
    var gfxRow = document.querySelector('.set-row[data-action="gfx"] .sw');
    if (gfxRow) {
      var sw = gfxRow.children;
      if (sw[0]) sw[0].classList.toggle('on', G.gfx === 'modern');
      if (sw[1]) sw[1].classList.toggle('on', G.gfx === 'retro');
    }
    if (ui.gfxTag) ui.gfxTag.textContent = G.gfx === 'modern' ? 'NEON' : '8-BIT';
    if (G.lastGfx !== G.gfx) applyGfxSize();
  }

  function toggleGfx() {
    G.gfx = G.gfx === 'modern' ? 'retro' : 'modern';
    saveStr('gfx', G.gfx);
    applyGfxSize();
    updateSettingsUI();
    updateHUD(true);
    sfx('select');
  }

  function toggleLang() {
    setLang(G.lang === 'ru' ? 'en' : 'ru');
  }

  function setLang(lang) {
    G.lang = lang === 'en' ? 'en' : 'ru';
    saveStr('lang', G.lang);
    applyLang();
    if (G.mode === 'brief') applyBrief(G.stage);
    if (G.player) updateHUD(true);
    updateBestLabels();
    sfx('select');
  }

  /* --------------------------------------------------------------------------
     29. UI — SCREENS, MENUS, BUTTONS
     -------------------------------------------------------------------------- */
  function hideAllScreens() {
    var screens = document.querySelectorAll('.screen');
    for (var i = 0; i < screens.length; i++) screens[i].classList.remove('on');
    Input.sel = 0;
  }

  function showScreen(name) {
    hideAllScreens();
    var el = document.getElementById('screen-' + name);
    if (el) el.classList.add('on');
    Input.sel = 0;
    updateNavSelection();
  }

  function navItems() {
    var screen = document.querySelector('.screen.on');
    if (!screen) return [];
    var nodes = screen.querySelectorAll('.menu-item, .btn, .set-row');
    var out = [];
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].offsetWidth > 0 && !nodes[i].classList.contains('hidden')) out.push(nodes[i]);
    }
    return out;
  }

  function updateNavSelection() {
    var all = document.querySelectorAll('.menu-item, .btn, .set-row');
    for (var i = 0; i < all.length; i++) all[i].classList.remove('sel');
    var items = navItems();
    if (!items.length) return;
    Input.sel = clamp(Input.sel, 0, items.length - 1);
    items[Input.sel].classList.add('sel');
  }

  function moveSel(dir) {
    var items = navItems();
    if (!items.length) return;
    Input.sel = (Input.sel + dir + items.length) % items.length;
    updateNavSelection();
    sfx('select');
  }

  function activateSelected() {
    var items = navItems();
    if (!items.length) return;
    var el = items[clamp(Input.sel, 0, items.length - 1)];
    if (!el) return;
    var action = el.getAttribute('data-action');
    if (action) runAction(action);
  }

  function confirmCurrent() {
    activateSelected();
  }

  function openHowto() {
    if (G.mode === 'howto') return;
    G.uiStack.push(G.mode);
    G.mode = 'howto';
    showScreen('howto');
    sfx('select');
  }

  function openSettings() {
    if (G.mode === 'settings') return;
    G.uiStack.push(G.mode);
    G.mode = 'settings';
    showScreen('settings');
    sfx('select');
  }

  function closeInfo() {
    var from = G.uiStack.pop() || 'title';
    if (from === 'pause') {
      G.mode = 'pause';
      showScreen('pause');
      updatePauseStage();
    } else if (from === 'settings') {
      G.mode = 'settings';
      showScreen('settings');
    } else if (from === 'brief') {
      G.mode = 'brief';
      showScreen('brief');
    } else {
      G.mode = 'title';
      showScreen('title');
      music('title');
    }
    sfx('select');
  }

  function runAction(action) {
    audioUnlock();
    switch (action) {
      case 'start': startNewRun(); break;
      case 'howto': openHowto(); break;
      case 'settings': openSettings(); break;
      case 'gfx': toggleGfx(); break;
      case 'lang': toggleLang(); break;
      case 'sound': toggleSound(); break;
      case 'brief-go': beginStage(G.stage); break;
      case 'brief-back': backToMenu(); break;
      case 'howto-back':
      case 'settings-back':
        closeInfo(); break;
      case 'howto-from-settings': openHowto(); break;
      case 'resume': resumeGame(); break;
      case 'pause-howto': openHowto(); break;
      case 'pause-settings': openSettings(); break;
      case 'menu': backToMenu(); break;
      case 'retry':
        if (G.mode === 'win') startNewRun();
        else retryStage();
        break;
      case 'clear-next': continueAfterClear(); break;
      default: break;
    }
  }

  function updatePauseStage() {
    if (!ui.pauseStage) return;
    ui.pauseStage.textContent = t('stage') + ' ' + pad(G.stage + 1, 2) + ' · ' + STAGE_META[G.stage][G.lang].name;
  }

  /* --------------------------------------------------------------------------
     30. UI — BRIEF / OVER / CLEAR / WIN / HUD / TOAST
     -------------------------------------------------------------------------- */
  function applyBrief(i) {
    i = clamp(i, 0, STAGES.length - 1);
    var meta = STAGE_META[i][G.lang];
    if (!ui.briefTitle) return;
    ui.briefStage.textContent = t('stageName') + ' ' + pad(i + 1, 2);
    ui.briefTitle.textContent = meta.name;
    ui.briefText.textContent = meta.mission;
    ui.briefZone.textContent = meta.zone;
    ui.briefBoss.textContent = meta.boss;
    var html = '';
    for (var k = 0; k < meta.objectives.length; k++) html += '<li>' + meta.objectives[k] + '</li>';
    ui.briefObjectives.innerHTML = html;
  }

  function showOver() {
    ui.overStage.textContent = t('stage') + ' ' + pad(G.stage + 1, 2) + ' · ' + STAGE_META[G.stage][G.lang].name;
    ui.overScore.textContent = pad(G.score, 6);
    ui.overStageNum.textContent = pad(G.stage + 1, 2);
    updateBestLabels();
    showScreen('over');
  }

  function showClear() {
    ui.clearStage.textContent = t('stageName') + ' ' + pad(G.stage + 1, 2);
    ui.clearScore.textContent = pad(G.score, 6);
    ui.clearTime.textContent = fmtTime(G.stageTime);
    ui.clearLives.textContent = '×' + G.lives;
    updateBestLabels();
    showScreen('clear');
  }

  function showWin() {
    ui.winScore.textContent = pad(G.score, 6);
    ui.winTime.textContent = fmtTime(G.runTime);
    updateBestLabels();
    var badges = [
      ['badge-nodeath', G.totalDeaths === 0],
      ['badge-speed', G.runTime > 0 && G.runTime < 420],
      ['badge-code', G.konamiUsed]
    ];
    for (var i = 0; i < badges.length; i++) {
      var el = document.getElementById(badges[i][0]);
      if (el) el.classList.toggle('hidden', !badges[i][1]);
    }
    showScreen('win');
  }

  function setHud(on) {
    if (!ui.hud) return;
    ui.hud.classList.toggle('on', !!on);
  }

  function showBossBar(on) {
    if (!ui.bossBar) return;
    ui.bossBar.classList.toggle('on', !!on);
    if (on) {
      var meta = STAGE_META[G.stage][G.lang];
      ui.bossName.textContent = t('bossLabel') + ' · ' + meta.boss;
    }
  }

  function updateHUD(force) {
    if (!ui.hud) return;
    var p = G.player;
    var cache = G.hudCache;
    if (force) G.hudCache = cache = {};
    var scoreS = pad(G.score, 6);
    if (force || cache.score !== scoreS) { ui.score.textContent = scoreS; cache.score = scoreS; }
    if (force || cache.lives !== G.lives) {
      ui.lives.innerHTML = '<span class="x">×</span>' + Math.max(0, G.lives);
      cache.lives = G.lives;
    }
    var weaponS = p ? WEAPONS[p.weapon].name[G.lang] : WEAPONS.rifle.name[G.lang];
    if (force || cache.weapon !== weaponS) { ui.weapon.textContent = weaponS; cache.weapon = weaponS; }
    var stageS = t('stage') + ' ' + pad(G.stage + 1, 2) + ' · ' + STAGE_META[G.stage][G.lang].name;
    if (force || cache.stage !== stageS) { ui.stage.textContent = stageS; cache.stage = stageS; }
    var checkS = G.checkpointIndex >= 0 ? t('checkpointNum', { n: pad(G.checkpointIndex + 1, 2) }) : t('checkpointStart');
    if (force || cache.check !== checkS) { ui.check.textContent = checkS; cache.check = checkS; }
    var shield = p ? p.shield : 0;
    if (force || cache.shield !== shield) {
      ui.shieldChip.style.display = shield > 0 ? '' : 'none';
      ui.shield.textContent = shield > 0 ? '●●●'.slice(0, shield) : '';
      cache.shield = shield;
    }
    if (G.boss && G.bossActive) {
      ui.bossBar.classList.add('on');
      var nm = t('bossLabel') + ' · ' + STAGE_META[G.stage][G.lang].boss;
      if (ui.bossName.textContent !== nm) ui.bossName.textContent = nm;
      var pct = Math.max(0, Math.min(100, G.boss.hp / G.boss.maxHp * 100));
      ui.bossFill.style.width = pct.toFixed(1) + '%';
    } else {
      ui.bossBar.classList.remove('on');
    }
    if (ui.gfxTag) ui.gfxTag.textContent = G.gfx === 'modern' ? 'NEON' : '8-BIT';
  }

  function showToast(main, sub, warn, duration) {
    if (!toastEl) return;
    toastEl.innerHTML = main + (sub ? '<small>' + sub + '</small>' : '');
    toastEl.classList.add('on');
    toastEl.classList.toggle('warn', !!warn);
    toastTimer = duration || 1.6;
  }

  function updateToastTimer(dt) {
    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0 && toastEl) toastEl.classList.remove('on');
    }
  }

  function updateCheckpoints() {
    var p = G.player;
    if (!p || p.dead) return;
    var cps = G.level.checkpoints;
    for (var i = 0; i < cps.length; i++) {
      if (G.checkpointIndex < i && p.x > cps[i]) {
        G.checkpoint = cps[i];
        G.checkpointIndex = i;
        showToast(t('checkpointNum', { n: pad(i + 1, 2) }), null, false, 1.5);
        sfx('checkpoint');
        addScore(250);
        updateHUD(true);
      }
    }
  }

  /* --------------------------------------------------------------------------
     31. GLOBAL KEY HANDLING
     -------------------------------------------------------------------------- */
  function handleGlobalKey(code) {
    audioUnlock();
    if (code === 'KeyM') { toggleSound(); return; }
    if (code === 'KeyG') { toggleGfx(); return; }
    if (code === 'KeyL') { toggleLang(); return; }
    trackKonami(code);
    if (code === 'Escape') { onEscape(); return; }
    if (code === 'KeyP') {
      if (G.mode === 'play' || G.mode === 'pause') togglePause();
      return;
    }
    if (G.mode === 'title') {
      if (code === 'Enter' || code === 'NumpadEnter') activateSelected();
      else if (code === 'ArrowUp') moveSel(-1);
      else if (code === 'ArrowDown') moveSel(1);
      else if (code === 'KeyI') openHowto();
      else if (code === 'KeyO') openSettings();
      return;
    }
    if (G.mode === 'brief') {
      if (code === 'Enter' || code === 'NumpadEnter') beginStage(G.stage);
      return;
    }
    if (G.mode === 'howto' || G.mode === 'settings') {
      if (code === 'Enter' || code === 'NumpadEnter') activateSelected();
      else if (code === 'ArrowUp') moveSel(-1);
      else if (code === 'ArrowDown') moveSel(1);
      else if (code === 'KeyI' && G.mode === 'settings') openHowto();
      else if (code === 'KeyO' && G.mode === 'howto') openSettings();
      return;
    }
    if (G.mode === 'pause') {
      if (code === 'Enter' || code === 'NumpadEnter') activateSelected();
      else if (code === 'ArrowUp') moveSel(-1);
      else if (code === 'ArrowDown') moveSel(1);
      else if (code === 'KeyI') openHowto();
      else if (code === 'KeyO') openSettings();
      return;
    }
    if (G.mode === 'over') {
      if (code === 'Enter' || code === 'NumpadEnter') retryStage();
      return;
    }
    if (G.mode === 'clear') {
      if (code === 'Enter' || code === 'NumpadEnter') continueAfterClear();
      return;
    }
    if (G.mode === 'win') {
      if (code === 'Enter' || code === 'NumpadEnter') backToMenu();
      if (code === 'KeyR') startNewRun();
    }
  }

  function onEscape() {
    switch (G.mode) {
      case 'howto':
      case 'settings': closeInfo(); break;
      case 'brief': backToMenu(); break;
      case 'pause': resumeGame(); break;
      case 'play': togglePause(); break;
      case 'over':
      case 'clear':
      case 'win': backToMenu(); break;
      default: break;
    }
  }

  /* --------------------------------------------------------------------------
     32. DOM WIRING
     -------------------------------------------------------------------------- */
  function wireUI() {
    document.addEventListener('click', function (ev) {
      var el = ev.target && ev.target.closest ? ev.target.closest('[data-action]') : null;
      if (!el) return;
      audioUnlock();
      runAction(el.getAttribute('data-action'));
      try { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); } catch (e) {}
    });
    document.addEventListener('pointerdown', function () { audioUnlock(); }, { passive: true });
    document.addEventListener('mouseover', function (ev) {
      var el = ev.target && ev.target.closest ? ev.target.closest('.menu-item, .btn, .set-row') : null;
      if (!el) return;
      var items = navItems();
      var idx = items.indexOf(el);
      if (idx >= 0 && idx !== Input.sel) {
        Input.sel = idx;
        updateNavSelection();
      }
    });
  }

  /* --------------------------------------------------------------------------
     33. DEBUG HOOKS / URL PARAMS
     -------------------------------------------------------------------------- */
  function parseHashParams() {
    var out = {};
    var h = (location.hash || '').replace(/^#/, '');
    if (!h) return out;
    var parts = h.split('&');
    for (var i = 0; i < parts.length; i++) {
      if (!parts[i]) continue;
      var kv = parts[i].split('=');
      out[decodeURIComponent(kv[0])] = kv.length > 1 ? decodeURIComponent(kv[1]) : '1';
    }
    return out;
  }

  function applyDebugParams() {
    var p = parseHashParams();
    if (!p) return;
    if (p.gfx === 'retro' || p.gfx === 'modern') G.gfx = p.gfx;
    if (p.lang === 'ru' || p.lang === 'en') G.lang = p.lang;
    applyGfxSize();
    applyLang();
    updateSettingsUI();
    updateBestLabels();
    G.debug.autofire = p.fire === '1';
    if (p.touch === '1') document.body.classList.add('touch');
    var stage = clamp((parseInt(p.stage, 10) || 1) - 1, 0, STAGES.length - 1);
    var shot = p.shot || '';
    if (shot === 'howto') {
      openHowto();
    } else if (shot === 'settings') {
      openSettings();
    } else if (shot === 'pause') {
      beginStage(stage);
      G.player.invuln = 999;
      togglePause();
    } else if (shot === 'brief') {
      showBrief(stage);
    } else if (shot === 'play' || shot === 'boss') {
      beginStage(stage);
      var x = parseFloat(p.x);
      if (!isFinite(x)) x = shot === 'boss' ? STAGES[stage].boss.trigger + 8 : 1250;
      G.player.x = clamp(x, 20, STAGES[stage].width - 40);
      G.player.onGround = true;
      G.player.invuln = p.invuln === '0' ? 0 : 999;
      G.player.weapon = p.weapon && WEAPONS[p.weapon] ? p.weapon : 'rifle';
      G.cam.x = clamp(G.player.x - VW * 0.42, 0, STAGES[stage].width - VW);
      if (p.lasers === 'on') {
        for (var li = 0; li < G.lasers.length; li++) {
          G.lasers[li].t = 3.55 - G.lasers[li].phase;
          G.lasers[li].on = true;
          G.lasers[li].warn = false;
          G.lasers[li].ct = 3.55;
        }
        G.freeze = true;
      }
      for (var i = 0; i < G.enemies.length; i++) {
        if (Math.abs(G.enemies[i].x - G.player.x) < 520) G.enemies[i].active = true;
      }
      if (shot === 'boss') {
        spawnBoss();
        G.boss.entry = 0;
        G.boss.t = 3.2;
        G.boss.x = STAGES[stage].arenaX + (G.boss.type === 'heli' ? 300 : 328);
        G.boss.y = G.boss.type === 'heli' ? 84 : 96;
        G.player.x = clamp(G.player.x, STAGES[stage].arenaX + 40, STAGES[stage].width - 30);
        G.cam.x = STAGES[stage].arenaX;
      }
      if (p.freeze === '1') G.freeze = true;
      updateHUD(true);
    } else if (shot === 'over') {
      beginStage(stage);
      G.score = 18300;
      G.stageStartScore = 0;
      G.lives = 0;
      G.totalDeaths = 3;
      gameOver();
    } else if (shot === 'clear') {
      beginStage(stage);
      G.score = 24500;
      G.stageTime = 187;
      stageClear();
    } else if (shot === 'win') {
      G.score = 48250;
      G.runTime = 501;
      G.totalDeaths = 1;
      G.stage = 1;
      winRun();
    }
    if (p.dump === '1') {
      setTimeout(function () {
        if (!ui.testout) return;
        ui.testout.classList.remove('hidden');
        ui.testout.style.display = 'block';
        ui.testout.textContent = JSON.stringify(snapshot(), null, 2);
        try { console.log('STATE_DUMP ' + JSON.stringify(snapshot())); } catch (e) {}
      }, 1200);
    }
    if (p.rects === '1') {
      setTimeout(function () {
        if (!ui.testout) return;
        function info(sel) {
          var el = document.querySelector(sel);
          if (!el) return null;
          var r = el.getBoundingClientRect();
          var cs = getComputedStyle(el);
          return { sel: sel, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), font: cs.fontSize, display: cs.display, position: cs.position };
        }
        var data = {
          inner: [innerWidth, innerHeight], dpr: devicePixelRatio,
          body: [document.body.scrollWidth, document.body.clientWidth],
          doc: [document.documentElement.scrollWidth, document.documentElement.clientWidth],
          items: [info('#rotate-hint'), info('#rotate-hint b'), info('#rotate-hint span'), info('#stage'), info('#screen-title')]
        };
        ui.testout.classList.remove('hidden');
        ui.testout.style.display = 'block';
        ui.testout.textContent = JSON.stringify(data, null, 2);
      }, 1200);
    }
  }

  function snapshot() {
    return {
      mode: G.mode,
      stage: G.stage,
      stageKey: G.level ? G.level.key : null,
      gfx: G.gfx,
      lang: G.lang,
      lives: G.lives,
      score: G.score,
      best: G.best,
      player: G.player ? {
        x: Math.round(G.player.x), y: Math.round(G.player.y),
        alive: !G.player.dead, weapon: G.player.weapon,
        shield: G.player.shield, onGround: G.player.onGround
      } : null,
      enemies: G.enemies.filter(function (e) { return !e.dead; }).length,
      activeEnemies: G.enemies.filter(function (e) { return !e.dead && e.active; }).length,
      bullets: G.bullets.length,
      ebullets: G.ebullets.length,
      boss: G.boss ? { type: G.boss.type, hp: G.boss.hp, maxHp: G.boss.maxHp } : null,
      bossActive: G.bossActive,
      checkpointIndex: G.checkpointIndex,
      stageTime: G.stageTime,
      runTime: G.runTime,
      cam: Math.round(G.cam.x),
      canvas: { w: canvas.width, h: canvas.height },
      errors: bootErrs.slice(-5),
      test: window.__TEST_RESULT || null
    };
  }

  function installDebugApi() {
    window.__CONTRA = {
      state: snapshot,
      start: function (i) { beginStage(clamp(parseInt(i, 10) || 0, 0, STAGES.length - 1)); return snapshot(); },
      brief: function (i) { showBrief(clamp(parseInt(i, 10) || 0, 0, STAGES.length - 1)); return snapshot(); },
      menu: function () { backToMenu(); return snapshot(); },
      setGfx: function (g) { if (g === 'modern' || g === 'retro') { G.gfx = g; saveStr('gfx', g); applyGfxSize(); updateSettingsUI(); } return snapshot(); },
      setLang: function (l) { setLang(l); return snapshot(); },
      warp: function (x) {
        if (!G.player) return snapshot();
        G.player.x = clamp(parseFloat(x) || 0, 0, G.level.width - 40);
        G.player.y = G.level.groundY - P_H;
        G.player.onGround = true;
        G.cam.x = clamp(G.player.x - VW * 0.42, 0, G.level.width - VW);
        return snapshot();
      },
      spawnBoss: function () { if (G.mode === 'play' && !G.boss) spawnBoss(); return snapshot(); },
      damageBoss: function (n) { damageBoss(parseFloat(n) || 10); return snapshot(); },
      killPlayer: function () { killPlayer('force'); return snapshot(); },
      giveWeapon: function (w) { if (G.player && WEAPONS[w]) G.player.weapon = w; updateHUD(true); return snapshot(); },
      setFreeze: function (v) { G.freeze = !!v; return snapshot(); },
      tick: function (sec) {
        var t = Math.max(0, parseFloat(sec) || 0);
        var guard = 0;
        while (t > 0 && guard++ < 2000) {
          var d = Math.min(1 / 60, t);
          update(d);
          t -= d;
        }
        render();
        updateHUD(true);
        return snapshot();
      },
      render: function () { render(); return snapshot(); },
      selfTest: function () { return runSelfTests(); },
      audio: function () { return window.CONTRA_AUDIO; },
      version: '1.0.0'
    };
  }

  /* --------------------------------------------------------------------------
     34. SELF-TESTS (#test)
     -------------------------------------------------------------------------- */
  function runSelfTests() {
    var results = [];
    var best0 = G.best;
    function check(name, cond) {
      results.push({ name: name, pass: !!cond });
    }
    function safe(name, fn) {
      try { check(name, fn()); } catch (e) { check(name + ' (threw)', false); }
    }

    // --- data integrity
    check('2 stages defined', STAGES.length === 2);
    var dataOK = true;
    STAGES.forEach(function (st) {
      if (!(st.width > VW && st.boss && st.boss.trigger < st.width)) dataOK = false;
      var sorted = true;
      for (var i = 1; i < st.gaps.length; i++) if (st.gaps[i][0] <= st.gaps[i - 1][1]) sorted = false;
      if (!sorted) dataOK = false;
      var covered = 0;
      st.solids.forEach(function (s) { covered += s.w; });
      var gapW = 0;
      st.gaps.forEach(function (g) { gapW += g[1] - g[0]; });
      if (Math.abs(covered + gapW - st.width) > 0.01) dataOK = false;
      if (st.solids.length !== st.gaps.length + 1) dataOK = false;
      st.platforms.forEach(function (p) {
        if (p.x < 0 || p.x + p.w > st.width || p.y < 40 || p.y > GROUND_Y) dataOK = false;
      });
    });
    check('stage geometry valid', dataOK);

    // --- i18n completeness
    var missing = [];
    var nodes = document.querySelectorAll('[data-i18n]');
    for (var n = 0; n < nodes.length; n++) {
      var key = nodes[n].getAttribute('data-i18n');
      if (!I18N.ru[key] || !I18N.en[key]) missing.push(key);
    }
    check('i18n complete (RU+EN)', missing.length === 0);

    // --- start stage
    backToMenu();
    G.score = 0;
    G.lives = 3;
    beginStage(0);
    check('stage starts in play mode', G.mode === 'play' && !!G.player);
    check('enemies spawned', G.enemies.length > 10);
    check('player on ground', G.player.onGround);

    // --- jump
    var p = G.player;
    var y0 = p.y;
    p.coyote = COYOTE;
    p.jumpBuf = JUMP_BUFFER;
    updatePlayer(0.05);
    check('jump lifts player', G.player.y < y0);

    // --- weapons
    p = G.player;
    G.bullets = [];
    p.weapon = 'rifle'; p.shootCd = 0; tryShoot(p);
    check('rifle fires one bullet', G.bullets.length === 1);
    G.bullets = [];
    p.weapon = 'spread'; p.shootCd = 0; tryShoot(p);
    check('spread fires five bullets', G.bullets.length === 5);
    G.bullets = [];
    p.weapon = 'laser'; p.shootCd = 0; tryShoot(p);
    check('laser is piercing', G.bullets.length === 1 && G.bullets[0].pierce === true);

    // --- shield + lethal
    p = G.player; p.dead = false; p.invuln = 0; p.shield = 3;
    killPlayer('test');
    check('shield absorbs a hit', !p.dead && p.shield === 2);
    p.shield = 0; p.invuln = 0; p.dead = false;
    var lives0 = G.lives;
    killPlayer('test');
    check('unshielded hit kills', p.dead === true && G.lives === lives0 - 1);

    // --- respawn
    p.deadTimer = 0.01;
    updatePlayer(0.02);
    check('player respawns', !!G.player && !G.player.dead && G.player.invuln > 0);

    // --- checkpoint
    G.player.invuln = 999;
    G.player.x = G.level.checkpoints[0] + 10;
    updateCheckpoints();
    check('checkpoint activates', G.checkpointIndex === 0);

    // --- boss
    beginStage(1);
    G.player.invuln = 999;
    G.player.x = STAGES[1].boss.trigger + 2;
    update(0.02);
    check('boss spawns at trigger', !!G.boss && G.bossActive);
    if (G.boss) {
      damageBoss(99999);
      check('boss enters death sequence', !!G.boss && G.boss.dying > 0);
      if (G.boss) {
        G.boss.dying = 0.01;
        update(0.03);
      }
      check('boss defeat arms stage end', !!G.endTimer && G.endTimer > 0);
      G.endTimer = 0.01;
      update(0.05);
      check('stage end screen after boss', G.mode === 'clear' || G.mode === 'win');
    }

    // --- graphics & language
    var w0 = canvas.width;
    toggleGfx();
    check('graphics toggle resizes canvas', canvas.width !== w0);
    toggleGfx();
    setLang('en');
    check('language switch to EN', G.lang === 'en' && t('menuStart') === 'Start operation');
    setLang('ru');
    check('language switch to RU', G.lang === 'ru' && t('menuStart') === 'Начать операцию');

    // --- render both styles (smoke)
    safe('render modern no throw', function () {
      G.gfx = 'modern'; applyGfxSize(); render(); return true;
    });
    safe('render 8-bit no throw', function () {
      G.gfx = 'retro'; applyGfxSize(); render(); return true;
    });
    G.gfx = 'modern'; applyGfxSize();

    // --- konami
    G.konamiUsed = false;
    G.konamiBuf = [];
    G.lives = 1;
    KONAMI.forEach(function (k) { trackKonami(k); });
    check('konami code grants lives', G.konamiUsed && G.lives >= 30);

    // --- pause / resume
    beginStage(0);
    togglePause();
    check('pause works', G.mode === 'pause');
    resumeGame();
    check('resume works', G.mode === 'play');

    // --- HUD
    updateHUD(true);
    var hudLives = document.getElementById('hud-lives');
    check('HUD renders lives', !!hudLives && hudLives.textContent.indexOf(String(G.lives)) >= 0);
    check('HUD weapon label', !!ui.weapon && ui.weapon.textContent.length > 2);

    // --- stage flow: clear -> brief -> next stage
    beginStage(0);
    G.score = 1234;
    G.lives = 2;
    finishBoss();
    check('stage 1 boss end arms clear', G.endMode === 'clear' && G.endTimer > 0);
    G.endTimer = 0.01;
    update(0.05);
    check('stage 1 clear screen', G.mode === 'clear');
    continueAfterClear();
    check('continue opens stage 2 brief', G.mode === 'brief' && G.stage === 1);
    beginStage(1);
    check('stage 2 starts', G.mode === 'play' && G.stage === 1 && G.lasers.length === 3);
    // stage 2 core -> win
    G.player.invuln = 999;
    G.player.x = STAGES[1].boss.trigger + 2;
    spawnBoss();
    damageBoss(99999);
    if (G.boss) G.boss.dying = 0.01;
    update(0.03);
    G.endTimer = 0.01;
    update(0.05);
    check('stage 2 boss ends the mission', G.mode === 'win');
    // game over + retry
    beginStage(0);
    G.player.invuln = 0;
    G.lives = 1;
    killPlayer('test');
    G.player.deadTimer = 0.01;
    updatePlayer(0.02);
    check('last life ends the run', G.mode === 'over');
    retryStage();
    check('retry restarts the stage', G.mode === 'play' && G.lives === 3 && G.stage === 0);
    // enemy kill scoring
    var scoreBefore = G.score;
    var victim = makeEnemy({ t: 'grunt', x: G.player.x + 60 });
    victim.active = true;
    G.enemies.push(victim);
    damageEnemy(victim, 99);
    check('enemy kill scores', victim.dead && G.score > scoreBefore);
    // audio API is callable and safe
    var audioOK = true;
    try {
      var a = window.CONTRA_AUDIO;
      if (!a) throw new Error('missing');
      a.startMusic('title'); a.startMusic('stage1'); a.startMusic('boss');
      a.sfx('shot'); a.sfx('explode'); a.sfx('checkpoint');
      a.setMuted(true); a.setMuted(false); a.stopMusic(0.1);
    } catch (e) { audioOK = false; }
    check('audio API safe', audioOK);
    // boss bar label
    spawnBoss();
    showBossBar(true);
    check('boss bar shows BOSS label', ui.bossName.textContent.indexOf('БОСС') >= 0 || ui.bossName.textContent.indexOf('BOSS') >= 0);

    // --- every pit must be jumpable with a running jump (critical!)
    var gapsOK = true;
    var gapDetails = [];
    for (var stIdx = 0; stIdx < STAGES.length; stIdx++) {
      var st2 = STAGES[stIdx];
      for (var gi = 0; gi < st2.gaps.length; gi++) {
        beginStage(stIdx);
        var gp = G.player;
        gp.invuln = 999;
        gp.x = st2.gaps[gi][0] - P_W - 1;
        gp.y = st2.groundY - P_H;
        gp.onGround = true;
        gp.coyote = COYOTE;
        gp.vx = RUN;
        gp.facing = 1;
        Input.keys = Object.create(null);
        Input.keys.ArrowRight = true;
        Input.keys.Space = true;
        Input.jumpQueued = true;
        for (var tt = 0; tt < 80; tt++) updatePlayer(1 / 60);
        Input.keys = Object.create(null);
        Input.jumpQueued = false;
        var crossed = !gp.dead && gp.x > st2.gaps[gi][1] + 4 && gp.y < st2.groundY + 20;
        if (!crossed) { gapsOK = false; gapDetails.push(stIdx + ':' + gi + ' x=' + Math.round(gp.x)); }
      }
    }
    check('all pits are jumpable' + (gapDetails.length ? ' (' + gapDetails.join(',') + ')' : ''), gapsOK);

    // --- hazard: laser gate
    beginStage(1);
    var lz = G.lasers[0];
    lz.t = 3.55 - lz.phase;
    G.player.x = lz.x - 4;
    G.player.y = G.level.groundY - P_H;
    G.player.invuln = 0; G.player.shield = 0; G.player.dead = false;
    updateLasers(0.016);
    check('laser gate is lethal', G.player.dead === true);

    // --- clean up
    G.best = best0;
    saveStr('best', Math.floor(best0));
    backToMenu();
    G.score = 0;
    G.lives = 3;
    G.totalDeaths = 0;
    G.konamiUsed = false;
    G.freeze = false;
    Input.keys = Object.create(null);
    updateBestLabels();

    var pass = 0;
    for (var i = 0; i < results.length; i++) if (results[i].pass) pass++;
    var fail = results.length - pass;
    var lines = ['CONTRA SELF-TEST · ' + pass + '/' + results.length + ' PASS' + (fail ? ' · ' + fail + ' FAIL' : ''), ''];
    results.forEach(function (r) {
      lines.push((r.pass ? '  ✓ ' : '  ✗ ') + r.name);
    });
    if (missing.length) lines.push('', 'missing i18n: ' + missing.join(', '));
    var text = lines.join('\n');
    if (ui.testout) {
      ui.testout.classList.remove('hidden');
      ui.testout.style.display = 'block';
      ui.testout.textContent = text;
    }
    try { console.log(text); } catch (e) {}
    window.__TEST_RESULT = { pass: pass, fail: fail, total: results.length, results: results, missing: missing };
    document.title = 'CONTRA TEST ' + pass + '/' + results.length;
    return window.__TEST_RESULT;
  }

  /* --------------------------------------------------------------------------
     35. MAIN LOOP / BOOT
     -------------------------------------------------------------------------- */
  var lastFrame = 0;

  function frame(ts) {
    requestAnimationFrame(frame);
    var dt = lastFrame ? (ts - lastFrame) / 1000 : 1 / 60;
    lastFrame = ts;
    if (dt > 0.05) dt = 0.05;
    Input.pollPad();
    update(dt);
    render();
  }

  function init() {
    G.uiStack = [];
    G.pickupCycle = 0;
    G.endTimer = 0;
    G.endMode = 'clear';
    G.level = STAGES[0];
    G.lasers = [];
    G.hudCache = {};
    applyGfxSize();
    G.lastGfx = G.gfx;
    cacheDom();
    Input.init();
    wireUI();
    resetWeather('jungle');
    applyLang();
    updateSettingsUI();
    updateBestLabels();
    showScreen('title');
    setHud(false);
    installDebugApi();
    applyDebugParams();
    if (/test/i.test(location.hash) || /[?&]test/.test(location.search)) {
      runSelfTests();
    }
    requestAnimationFrame(frame);
  }

  init();
})();
