/* ============================================================================
 * RIVER RAID · HTML5 — локализация RU/EN.
 * Русский — по умолчанию. Переключение клавишей L, кнопкой или через меню.
 * ========================================================================== */
'use strict';
window.RR = window.RR || {};
(function (RR) {
  const DICT = {
    ru: {
      /* оболочка */
      title: 'РЕЧНОЙ РЕЙД',
      titleLatin: 'RIVER RAID',
      subtitle: 'Браузерный ремейк аркады Activision · 1982',
      sideNote: 'ВЕРТИКАЛЬНЫЙ СКРОЛЛ · 8-БИТ · HTML5',
      tagRetro: 'РЕТРО',
      tagModern: 'МОДЕРН',
      pageTitle: 'RIVER RAID · РЕЧНОЙ РЕЙД — HTML5',
      metaDescription: 'Браузерный ремейк River Raid (Activision, 1982): река, мосты, заправки, два режима графики и 8-битная музыка.',
      quickGroup: 'Быстрые настройки',
      gameField: 'Игровое поле River Raid',
      mainMenu: 'Главное меню',
      touchPad: 'Экранное управление',
      touchLeft: 'Влево',
      touchRight: 'Вправо',
      touchUp: 'Быстрее',
      touchDown: 'Медленнее',
      touchFire: 'Огонь',
      touchPause: 'Пауза',
      fullscreen: 'На весь экран',
      pad: 'Управление',
      /* меню */
      play: 'Играть',
      howto: 'Как играть',
      graphics: 'Графика',
      sound: 'Звук',
      language: 'Язык',
      record: 'Рекорд',
      startHint: 'ENTER — старт · ↑↓ — выбор',
      startHintTouch: 'Коснитесь «Играть»',
      modeRetro: 'Ретро',
      modeModern: 'Модерн',
      on: 'Вкл',
      off: 'Выкл',
      langRu: 'Рус',
      langEn: 'Англ',
      /* инструкция */
      howtoTitle: 'Как играть',
      howtoLead: 'Вы — пилот реактивного самолёта над рекой. Летите вверх по течению, уничтожайте врагов и мосты, следите за топливом.',
      ctrlMove: 'Движение влево / вправо',
      ctrlSpeed: 'Ускориться / притормозить',
      ctrlFire: 'Огонь',
      ctrlPause: 'Пауза',
      ctrlSound: 'Звук вкл/выкл',
      ctrlLang: 'Язык интерфейса',
      ctrlGfx: 'Графика ретро/модерн',
      ctrlFull: 'Во весь экран',
      ctrlTouch: 'На телефоне — экранные кнопки',
      tipsTitle: 'Правила',
      tip1: 'Берега и острова смертельны. Держитесь воды.',
      tip2: 'Топливо тает постоянно. Залетев на заправку, вы получаете полный бак.',
      tip3: 'Мост перекрывает реку. Расстреляйте его — и уровень взят.',
      tip4: 'Корабли, вертолёты и истребители сбиваются одним попаданием.',
      tip5: 'За заправку можно получить очки, но тогда она не заправит вас. Выбор за вами.',
      back: 'Назад',
      /* пауза / конец */
      paused: 'Пауза',
      resume: 'Продолжить',
      restart: 'Заново',
      toMenu: 'В меню',
      gameOver: 'Игра окончена',
      score: 'Очки',
      newRecord: 'Новый рекорд!',
      again: 'Ещё раз',
      diedFuel: 'Закончилось топливо',
      diedBank: 'Вы врезались в берег',
      diedEnemy: 'Столкновение с врагом',
      diedBridge: 'Столкновение с мостом',
      reasonLine: 'Причина',
      /* HUD и сообщения в игре */
      hudScore: 'ОЧКИ',
      hudFuel: 'ТОПЛИВО',
      hudLevel: 'УРОВЕНЬ',
      hudRecord: 'РЕКОРД',
      hudLives: 'ЖИЗНИ',
      lowFuel: 'МАЛО ТОПЛИВА',
      bridgeAhead: 'МОСТ ВПЕРЕДИ',
      bridgeHint: 'ОГОНЬ!',
      levelDone: 'МОСТ УНИЧТОЖЕН',
      levelNew: 'УРОВЕНЬ',
      fuelTaken: 'БАК ПОЛОН',
      bonus: 'БОНУС',
      pausedShort: 'ПАУЗА',
      tapStart: 'НАЖМИТЕ ENTER',
      invuln: 'ЗАЩИТА',
      shots: 'ВЫСТРЕЛОВ',
      hits: 'ПОПАДАНИЙ',
      accuracy: 'ТОЧНОСТЬ',
    },
    en: {
      title: 'RIVER RAID',
      titleLatin: 'RIVER RAID',
      subtitle: 'A browser remake of the Activision arcade · 1982',
      sideNote: 'VERTICAL SCROLLER · 8-BIT · HTML5',
      tagRetro: 'RETRO',
      tagModern: 'MODERN',
      pageTitle: 'RIVER RAID · HTML5',
      metaDescription: 'A browser remake of River Raid (Activision, 1982): river, bridges, fuel depots, two graphics modes and 8-bit music.',
      quickGroup: 'Quick settings',
      gameField: 'River Raid playfield',
      mainMenu: 'Main menu',
      touchPad: 'On-screen controls',
      touchLeft: 'Left',
      touchRight: 'Right',
      touchUp: 'Faster',
      touchDown: 'Slower',
      touchFire: 'Fire',
      touchPause: 'Pause',
      fullscreen: 'Fullscreen',
      pad: 'Controls',
      play: 'Play',
      howto: 'How to play',
      graphics: 'Graphics',
      sound: 'Sound',
      language: 'Language',
      record: 'Best',
      startHint: 'ENTER — start · ↑↓ — select',
      startHintTouch: 'Tap “Play” to start',
      modeRetro: 'Retro',
      modeModern: 'Modern',
      on: 'On',
      off: 'Off',
      langRu: 'RU',
      langEn: 'EN',
      howtoTitle: 'How to play',
      howtoLead: 'You pilot a jet fighter over the river. Fly upstream, destroy enemies and bridges, and watch your fuel.',
      ctrlMove: 'Move left / right',
      ctrlSpeed: 'Speed up / slow down',
      ctrlFire: 'Fire',
      ctrlPause: 'Pause',
      ctrlSound: 'Sound on/off',
      ctrlLang: 'Interface language',
      ctrlGfx: 'Retro / modern graphics',
      ctrlFull: 'Fullscreen',
      ctrlTouch: 'On mobile use the on-screen pad',
      tipsTitle: 'Rules',
      tip1: 'Banks and islands are deadly. Stay on the water.',
      tip2: 'Fuel drains constantly. Fly over a depot to refill the tank.',
      tip3: 'A bridge blocks the river. Shoot it down to clear the level.',
      tip4: 'Ships, helicopters and jets go down in one hit.',
      tip5: 'You may shoot a depot for points, but then it cannot refuel you.',
      back: 'Back',
      paused: 'Paused',
      resume: 'Resume',
      restart: 'Restart',
      toMenu: 'Menu',
      gameOver: 'Game over',
      score: 'Score',
      newRecord: 'New record!',
      again: 'Play again',
      diedFuel: 'Out of fuel',
      diedBank: 'You hit the bank',
      diedEnemy: 'Collided with enemy',
      diedBridge: 'Crashed into the bridge',
      reasonLine: 'Cause',
      hudScore: 'SCORE',
      hudFuel: 'FUEL',
      hudLevel: 'LEVEL',
      hudRecord: 'BEST',
      hudLives: 'LIVES',
      lowFuel: 'LOW FUEL',
      bridgeAhead: 'BRIDGE AHEAD',
      bridgeHint: 'FIRE!',
      levelDone: 'BRIDGE DESTROYED',
      levelNew: 'LEVEL',
      fuelTaken: 'TANK FULL',
      bonus: 'BONUS',
      pausedShort: 'PAUSED',
      tapStart: 'PRESS ENTER',
      invuln: 'SHIELD',
      shots: 'SHOTS',
      hits: 'HITS',
      accuracy: 'ACCURACY',
    },
  };

  let lang = RR.store.get('lang', 'ru');
  if (!DICT[lang]) lang = 'ru';

  RR.getLang = () => lang;
  RR.t = function (key, vars) {
    const table = DICT[lang] || DICT.ru;
    let s = table[key];
    if (s == null) s = DICT.ru[key] != null ? DICT.ru[key] : key;
    if (vars) {
      for (const k of Object.keys(vars)) s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), vars[k]);
    }
    return s;
  };
  RR.dict = DICT;

  /** Применить перевод к DOM: data-i18n / data-i18n-aria / data-i18n-title */
  RR.applyI18n = function (root = document) {
    root.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      const txt = RR.t(key);
      if (el.hasAttribute('data-i18n-html')) el.innerHTML = txt;
      else el.textContent = txt;
    });
    root.querySelectorAll('[data-i18n-aria]').forEach((el) => el.setAttribute('aria-label', RR.t(el.getAttribute('data-i18n-aria'))));
    root.querySelectorAll('[data-i18n-title]').forEach((el) => el.setAttribute('title', RR.t(el.getAttribute('data-i18n-title'))));
    document.documentElement.lang = lang === 'ru' ? 'ru' : 'en';
    document.title = RR.t('pageTitle');
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', RR.t('metaDescription'));
  };

  RR.setLang = function (next) {
    if (!DICT[next] || next === lang) return;
    lang = next;
    RR.store.set('lang', lang);
    RR.applyI18n();
    document.documentElement.setAttribute('data-lang', lang);
    RR.on.lang.forEach((fn) => { try { fn(lang); } catch (e) { console.error(e); } });
  };
  RR.toggleLang = () => RR.setLang(lang === 'ru' ? 'en' : 'ru');
})(window.RR);
