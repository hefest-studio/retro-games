/* ============================================================
   ПРОРЫВ HTML5 — локализация RU / EN
   EX_I18N.ручные строки; EX_T(key, vars) — доступ с подстановкой {var}.
   ============================================================ */
(function () {
  'use strict';

  const RU = {
    'brand': 'ПРОРЫВ',
    'brand.ru': 'ШТУРМОВИК',
    'tagline': 'ПОРТ 1987 → 2026',
    'tagline.full': 'оригинал студии «Гефест»',
    'loading': 'ЗАГРУЗКА...',

    /* ---- меню ---- */
    'menu.play': 'ИГРАТЬ',
    'menu.help': 'КАК ИГРАТЬ',
    'menu.settings': 'НАСТРОЙКИ',
    'menu.about': 'ОБ ИГРЕ',
    'menu.continue': 'ПРОДОЛЖИТЬ',
    'menu.hint': '↑↓ — выбор      ENTER — ввод',
    'menu.hint.quick': 'L язык · G графика · M музыка',
    'hint.nav': '↑↓ · ENTER · ESC',

    /* ---- экраны ---- */
    'help.title': 'КАК ИГРАТЬ',
    'help.goal': 'Пробейся через 5 секторов и уйди за правый край экрана.',
    'help.back': 'ESC — назад',
    'about.title': 'ОБ ИГРЕ',
    'settings.title': 'НАСТРОЙКИ',
    'settings.back': 'ESC — назад',
    'settings.lang': 'ЯЗЫК',
    'settings.gfx': 'ГРАФИКА',
    'settings.music': 'МУЗЫКА',
    'settings.sfx': 'ЗВУКИ',
    'settings.crt': 'CRT-ЭФФЕКТ',
    'settings.reset': 'СБРОСИТЬ РЕКОРД',
    'settings.resetConfirm': 'ТОЧНО? ENTER — ДА',
    'settings.build': 'СБОРКА {v} · RETRO ПО УМОЛЧАНИЮ',
    'settings.build.short': 'RETRO · СБОРКА {v}',
    'settings.on': 'ВКЛ',
    'settings.off': 'ВЫКЛ',
    'gfx.retro': 'ZX 1987',
    'gfx.modern': 'NEON 2026',
    'lang.ru': 'РУССКИЙ',
    'lang.en': 'ENGLISH',

    /* ---- управление ---- */
    'key.left': '← →  или  A D',
    'key.left.act': 'идти влево / вправо',
    'key.jump': '↑  или  W',
    'key.jump.act': 'прыжок',
    'key.duck': '↓  или  S',
    'key.duck.act': 'присесть · телепорт',
    'key.fire': 'SPACE  или  Z',
    'key.fire.act': 'бластер / граната',
    'key.pause': 'ESC  или  P',
    'key.pause.act': 'пауза',
    'key.l': 'L', 'key.l.act': 'язык RU / EN',
    'key.g': 'G', 'key.g.act': 'графика RETRO / NEON',
    'key.m': 'M', 'key.m.act': 'музыка вкл / выкл',
    'key.n': 'N', 'key.n.act': 'звуки вкл / выкл',
    'key.f': 'F', 'key.f.act': 'полный экран',
    'key.enter': 'ENTER', 'key.enter.act': 'подтвердить · старт',

    /* ---- брифинг / подсказки ---- */
    'hint.title': 'ЦЕЛЬ',
    'hint.goal': 'Пробейся через 5 секторов Эксолона: уничтожай врагов, собирай патроны и уйди за правый край экрана.',
    'hint.exo': 'Экзоскелет в середине сектора даёт броню и двойной темп огня — но отнимает бонус 10000.',
    'hint.grenade': 'Бластер берёт органику. Пушки, танки и коконы бронированы — только граната.',
    'hint.teleport': 'Встань на телепорт и нажми ↓, чтобы уйти в парный. Там обычно награда.',
    'hint.launcher': 'Войди в статую-пушку — получишь 2000 или 3000 очков.',
    'hint.ammo': 'Синие патроны — заряд бластера, малиновые — гранаты.',
    'hint.death': 'Виторк гибнет от любого попадания. На экзоскелете держится три удара.',

    /* ---- бриф уровня ---- */
    'level.sector': 'СЕКТОР {n} · {name}',
    'level.of': 'из 5',
    'level.start': 'ENTER — В БОЙ',
    'level.screens': 'ЭКРАНОВ: {n}',

    /* ---- HUD ---- */
    'hud.score': 'ОЧКИ',
    'hud.lives': 'ЖИЗНИ',
    'hud.laser': 'ЛАЗЕР',
    'hud.rockets': 'ГРАНАТЫ',
    'hud.armor': 'БРОНЯ',
    'hud.sector': 'СЕКТОР',
    'hud.screen': 'ЭКРАН',

    /* ---- игровые сообщения ---- */
    'msg.paused': 'ПАУЗА',
    'msg.paused.hint': '↑↓ — выбор · ENTER — ввод · ESC — назад',
    'msg.exo.on': 'ЭКЗОСКЕЛЕТ АКТИВЕН',
    'msg.exo.off': 'ЭКЗОСКЕЛЕТ РАЗРУШЕН',
    'msg.teleport': 'ТЕЛЕПОРТ',
    'msg.nogrenade': 'НЕТ ГРАНАТ',
    'msg.nolaser': 'НЕТ ЗАРЯДА',
    'msg.levelclear': 'СЕКТОР ОЧИЩЕН',
    'msg.bonus': 'БОНУС ЗА СЕКТОР',
    'msg.bonus.lives': 'ЖИЗНИ × 1000',
    'msg.bonus.noexo': 'БЕЗ ЭКЗОСКЕЛЕТА +10000',
    'msg.bonus.exo': 'ЭКЗОСКЕЛЕТ: БЕЗ БОНУСА',
    'msg.bonus.extra': 'ДОПОЛНИТЕЛЬНАЯ ЖИЗНЬ',
    'msg.bonus.pick': 'ВЫБЕРИ ОЧКИ: SPACE',
    'msg.bonus.pick2': 'ЖМИ SPACE НА БОЛЬШЕМ ЧИСЛЕ',
    'msg.gameover': 'ИГРА ОКОНЧЕНА',
    'msg.continue': 'ENTER — ЗАНОВО',
    'msg.win': 'ЭКСОЛОН ПАЛ',
    'msg.win.sub': 'ВИТОРК ПРОБИЛСЯ ЧЕРЕЗ 5 СЕКТОРОВ',
    'msg.newrecord': 'НОВЫЙ РЕКОРД!',
    'msg.record': 'РЕКОРД',
    'msg.score': 'ИТОГО',
    'msg.dead': 'ВИТОРК ПОГИБ',
    'msg.press': 'НАЖМИ ENTER',
    'msg.pressfire': 'НАЖМИ SPACE',
    'msg.tips': 'подсказка:',
    'msg.sector.clear': 'СЕКТОР {n} ОЧИЩЕН',
    'msg.togo': 'ДО ВЫХОДА',
    'msg.shield': 'БРОНЯ {n}',

    /* ---- настройки / прочее ---- */
    'credits.original': 'ОРИГИНАЛ · ГЕФЕСТ',
    'credits.port': 'HTML5 CANVAS · WEB AUDIO · 2026',
    'credits.fan': 'Оригинальная игра студии «Гефест» по мотивам жанра.',
    'credits.thanks': 'Графика и музыка — из кода. Внешних файлов нет.',
    'about.goal': 'Сюжет',
    'about.text': 'Планета Эксолон — каторжная колония корпорации. Виторк, штурмовик-одиночка, пробивается через пять секторов: периметр, пещеры, реактор, улей и ядро. Бластер — против органики, гранаты — против брони. В середине каждого сектора ждёт капсула гиперсплавного экзоскелета: он держит удар, но лишает выходного бонуса.',
    'record.new': 'НОВЫЙ РЕКОРД',
    'record.beaten': 'РЕКОРД ПОБИТ',
    'touch.left': '◄', 'touch.right': '►', 'touch.jump': '▲', 'touch.fire': '●', 'touch.duck': '▼',

    /* ---- пауза ---- */
    'pause.resume': 'ПРОДОЛЖИТЬ',
    'pause.restart': 'ЗАНОВО С ЭКРАНА',
    'pause.settings': 'НАСТРОЙКИ',
    'pause.menu': 'В МЕНЮ',
    'pause.gfx': 'ГРАФИКА: {v}',
    'pause.music': 'МУЗЫКА: {v}',
    'pause.sfx': 'ЗВУКИ: {v}',
    'pause.lang': 'ЯЗЫК: {v}',

    /* ---- тесты ---- */
    'test.title': 'ПРОРЫВ TESTS',
    'test.ok': 'OK',
    'test.fail': 'FAIL'
  };

  const EN = {
    'brand': 'ПРОРЫВ',
    'brand.ru': 'ПРОРЫВ',
    'tagline': 'PORT 1987 → 2026',
    'tagline.full': 'original by Hefest studio',
    'loading': 'LOADING...',

    'menu.play': 'PLAY',
    'menu.help': 'HOW TO PLAY',
    'menu.settings': 'OPTIONS',
    'menu.about': 'ABOUT',
    'menu.continue': 'RESUME',
    'menu.hint': '↑↓ select      ENTER confirm',
    'menu.hint.quick': 'L language · G graphics · M music',
    'hint.nav': '↑↓ · ENTER · ESC',

    'help.title': 'HOW TO PLAY',
    'help.goal': 'Fight through 5 sectors and reach the right edge.',
    'help.back': 'ESC back',
    'about.title': 'ABOUT',
    'settings.title': 'OPTIONS',
    'settings.back': 'ESC back',
    'settings.lang': 'LANGUAGE',
    'settings.gfx': 'GRAPHICS',
    'settings.music': 'MUSIC',
    'settings.sfx': 'SOUND FX',
    'settings.crt': 'CRT EFFECT',
    'settings.reset': 'RESET RECORD',
    'settings.resetConfirm': 'SURE? ENTER = YES',
    'settings.build': 'BUILD {v} · RETRO DEFAULT',
    'settings.build.short': 'RETRO · BUILD {v}',
    'settings.on': 'ON',
    'settings.off': 'OFF',
    'gfx.retro': 'ZX 1987',
    'gfx.modern': 'NEON 2026',
    'lang.ru': 'РУССКИЙ',
    'lang.en': 'ENGLISH',

    'key.left': '← →  or  A D',
    'key.left.act': 'walk left / right',
    'key.jump': '↑  or  W',
    'key.jump.act': 'jump',
    'key.duck': '↓  or  S',
    'key.duck.act': 'duck · teleport',
    'key.fire': 'SPACE  or  Z',
    'key.fire.act': 'blaster / grenade',
    'key.pause': 'ESC  or  P',
    'key.pause.act': 'pause',
    'key.l': 'L', 'key.l.act': 'язык RU / EN',
    'key.g': 'G', 'key.g.act': 'graphics RETRO / NEON',
    'key.m': 'M', 'key.m.act': 'music on / off',
    'key.n': 'N', 'key.n.act': 'sound fx on / off',
    'key.f': 'F', 'key.f.act': 'fullscreen',
    'key.enter': 'ENTER', 'key.enter.act': 'confirm · start',

    'hint.title': 'OBJECTIVE',
    'hint.goal': 'Fight through 5 sectors of ПРОРЫВ: kill everything, grab ammo packs and reach the right edge of the screen.',
    'hint.exo': 'The exoskeleton pod mid-sector gives armour and double fire rate — but costs the 10000 bonus.',
    'hint.grenade': 'The blaster kills organics. Guns, tanks and pods are armoured — grenades only.',
    'hint.teleport': 'Stand on a teleporter and press ↓ to warp to its twin. Usually a reward there.',
    'hint.launcher': 'Walk into a launcher statue for 2000 or 3000 points.',
    'hint.ammo': 'Blue packs refill the blaster, magenta packs refill grenades.',
    'hint.death': 'Vitorc dies from a single hit. The exoskeleton takes three.',

    'level.sector': 'SECTOR {n} · {name}',
    'level.of': 'of 5',
    'level.start': 'ENTER — DEPLOY',
    'level.screens': 'SCREENS: {n}',

    'hud.score': 'SCORE',
    'hud.lives': 'LIVES',
    'hud.laser': 'LASER',
    'hud.rockets': 'ROCKETS',
    'hud.armor': 'ARMOUR',
    'hud.sector': 'SECTOR',
    'hud.screen': 'SCREEN',

    'msg.paused': 'PAUSED',
    'msg.paused.hint': '↑↓ select · ENTER confirm · ESC back',
    'msg.exo.on': 'EXOSKELETON ONLINE',
    'msg.exo.off': 'EXOSKELETON DESTROYED',
    'msg.teleport': 'TELEPORT',
    'msg.nogrenade': 'NO GRENADES',
    'msg.nolaser': 'NO CHARGE',
    'msg.levelclear': 'SECTOR SECURED',
    'msg.bonus': 'SECTOR BONUS',
    'msg.bonus.lives': 'LIVES × 1000',
    'msg.bonus.noexo': 'NO EXOSKELETON +10000',
    'msg.bonus.exo': 'EXOSKELETON: NO BONUS',
    'msg.bonus.extra': 'EXTRA LIFE',
    'msg.bonus.pick': 'PICK A SCORE: SPACE',
    'msg.bonus.pick2': 'HIT SPACE ON THE HIGHEST',
    'msg.gameover': 'GAME OVER',
    'msg.continue': 'ENTER — RETRY',
    'msg.win': 'ПРОРЫВ HAS FALLEN',
    'msg.win.sub': 'VITORC BROKE THROUGH 5 SECTORS',
    'msg.newrecord': 'NEW RECORD!',
    'msg.record': 'RECORD',
    'msg.score': 'TOTAL',
    'msg.dead': 'VITORC DOWN',
    'msg.press': 'PRESS ENTER',
    'msg.pressfire': 'PRESS SPACE',
    'msg.tips': 'tip:',
    'msg.sector.clear': 'SECTOR {n} SECURED',
    'msg.togo': 'TO EXIT',
    'msg.shield': 'ARMOUR {n}',

    'credits.original': 'ОРИГИНАЛ · ГЕФЕСТ',
    'credits.port': 'HTML5 CANVAS · WEB AUDIO · 2026',
    'credits.fan': 'An original game by Hefest studio.',
    'credits.thanks': 'Graphics & music from code only.',
    'about.goal': 'Story',
    'about.text': 'The planet ПРОРЫВ is a corporate penal colony. Vitorc, a lone stormtrooper, cuts through five sectors: perimeter, caves, reactor, hive and core. Blaster for organics, grenades for armour. Mid-sector a hyper-alloy exoskeleton pod waits: it soaks damage but forfeits the end bonus.',
    'record.new': 'NEW RECORD',
    'record.beaten': 'RECORD BEATEN',
    'touch.left': '◄', 'touch.right': '►', 'touch.jump': '▲', 'touch.fire': '●', 'touch.duck': '▼',

    'pause.resume': 'RESUME',
    'pause.restart': 'RESTART SCREEN',
    'pause.settings': 'OPTIONS',
    'pause.menu': 'MAIN MENU',
    'pause.gfx': 'GRAPHICS: {v}',
    'pause.music': 'MUSIC: {v}',
    'pause.sfx': 'SFX: {v}',
    'pause.lang': 'LANGUAGE: {v}',

    'test.title': 'ПРОРЫВ TESTS',
    'test.ok': 'OK',
    'test.fail': 'FAIL'
  };

  window.EX_I18N = { ru: RU, en: EN };

  /**
   * Перевод по ключу. Порядок: текущий язык → ru → en → сам ключ.
   * Подставляет {name} из vars.
   */
  window.EX_T = function (key, vars) {
    const ex = window.EX;
    const lang = (ex && ex.settings && ex.settings.lang) === 'en' ? 'en' : 'ru';
    let s = (window.EX_I18N[lang] && window.EX_I18N[lang][key]);
    if (s == null) s = window.EX_I18N.ru[key];
    if (s == null) s = window.EX_I18N.en[key];
    if (s == null) return String(key);
    if (vars) {
      s = s.replace(/\{(\w+)\}/g, function (m, k) {
        return Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : m;
      });
    }
    return s;
  };
})();
