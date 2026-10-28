/* i18n.js — LOST VIKINGS 2 · NORSE BY NORSEWEST
   Все строки интерфейса: RU (по умолчанию) и EN. Только этот файл хранит тексты UI.
   API: LV.i18n {t, list, setLang, getLang, LANGS}. */
window.LV = window.LV || {};
(function () {
  'use strict';

  var DICT = {
    ru: {
      /* ---------- общее ---------- */
      'app.title': 'Lost Vikings II · Северное сияние',
      'common.back': 'Назад',
      'common.close': 'Закрыть',
      'common.on': 'Вкл',
      'common.off': 'Выкл',
      'common.level': 'Сага',
      'common.levels': 'Саги',
      'common.runes': 'Руны',
      'common.time': 'Время',
      'common.deaths': 'Потери',
      'common.score': 'Очки',
      'common.menu': 'В главное меню',
      'common.locked': 'Закрыто',
      'common.of': 'из',
      'common.levelOf': 'Сага {n} из {total}',
      'common.keys': 'Клавиатура',
      'common.touch': 'Сенсор',
      'common.dash': '—',

      /* ---------- шапка / бренд ---------- */
      'brand.lost': 'LOST',
      'brand.vikings': 'VIKINGS',
      'brand.ii': 'II',
      'brand.norse': 'NORSE BY NORSEWEST',
      'meta.aurora': 'СЕВЕРНОЕ СИЯНИЕ',
      'meta.genre': 'NORDIC AURORA',

      /* ---------- чипы настроек ---------- */
      'chip.graphics': 'Графика',
      'chip.lang': 'Язык',
      'chip.sound': 'Звук',
      'chip.aurora': 'AURORA',
      'chip.retro': '8-BIT',
      'chip.graphicsAria': 'Графика: {mode}. Переключить режим',
      'chip.langAria': 'Язык: {lang}. Переключить язык',
      'chip.soundAriaOn': 'Звук включён. Выключить',
      'chip.soundAriaOff': 'Звук выключен. Включить',
      'chip.soundOn': 'ВКЛ',
      'chip.soundOff': 'ВЫКЛ',
      'chip.group': 'Настройки',

      /* ---------- экран title ---------- */
      'title.kicker': 'Фанатский браузерный ремейк · 1997',
      'title.subtitle': 'СЕВЕРНОЕ СИЯНИЕ',
      'title.tagline': 'Три викинга. Полярная ночь. Шесть саг.',
      'title.menu': 'Выберите путь',
      'title.start': 'Новая сага',
      'title.continue': 'Продолжить путь',
      'title.levels': 'Выбрать сагу',
      'title.help': 'Управление',
      'title.progress': 'Открыто саг: {n} из {total}',
      'title.fresh': 'Прогресса пока нет — начните первую сагу',
      'title.keys': '1–3 — викинги · G — графика · Y — язык · M — звук',
      'title.attribution': 'Фанатский ремейк The Lost Vikings 2 · Norse by Norsewest (1997)',
      'title.build': 'без внешних ассетов · всё нарисовано кодом',
      'title.stats': '6 саг · 3 викинга · 2 режима графики',
      'title.feature1': 'Полярная ночь',
      'title.feature2': 'Руны и порталы',
      'title.feature3': 'Чиптюн',

      /* ---------- экран levels ---------- */
      'levels.heading': 'Шесть саг',
      'levels.sub': 'Каждая глава — новый разлом, новая механика и три способа пройти.',
      'levels.progress': 'Открыто {unlocked} из {total}',
      'levels.cardAria': 'Сага {n}: {name}. Открыть',
      'levels.cardAriaLocked': 'Сага {n}: закрыта',
      'levels.backToTitle': 'В главное меню',
      'levels.placeholder': 'Неизвестная сага',
      'levels.lockedHint': 'Пройдите предыдущую сагу',
      'levels.runesAria': 'Руны: {got} из {total}',
      'levels.timeLabel': 'время',
      'levels.deathsLabel': 'потери',
      'levels.noData': '—',
      'levels.indexLabel': 'Сага {n}',

      /* ---------- экран brief ---------- */
      'brief.kicker': 'Сага {n} из {total}',
      'brief.hint': 'Подсказка',
      'brief.mechanics': 'Что важно помнить',
      'brief.goalTitle': 'Цель',
      'brief.goal1': 'Соберите три руны — они дают очки.',
      'brief.goal2': 'Проведите всех трёх викингов к порталу.',
      'brief.controlsTitle': 'Управление',
      'brief.start': 'В путь',
      'brief.back': 'К списку саг',
      'brief.switchHint': '1 2 3 или Tab — сменить викинга',
      'brief.subline': 'Руны: {runes} · Чекпоинты: {checkpoints} · Враги: {enemies}',
      'brief.crew': 'Отряд',
      'brief.crewSub': 'Кто идёт в эту сагу',
      'brief.meta.runes': 'Руны',
      'brief.meta.checkpoints': 'Чекпоинты',
      'brief.meta.enemies': 'Враги',
      'brief.meta.difficulty': 'Сложность',
      'brief.diff.0': 'Обучение',
      'brief.diff.1': 'Лёд',
      'brief.diff.2': 'Огонь',
      'brief.diff.3': 'Вертикаль',
      'brief.diff.4': 'Комбинация',
      'brief.diff.5': 'Финал',
      'brief.mech.0': [
        'Эрик таранит лёд и стены',
        'Балеог рубит мечом и бьёт из лука',
        'Олаф держит щит — по нему можно ходить'
      ],
      'brief.mech.1': [
        'Новый крюк Балеога цепляется за потолок',
        'Парение Эрика продлевает прыжок',
        'Стрелы зажигают и переключают рычаги'
      ],
      'brief.mech.2': [
        'Лава губит мгновенно',
        'Плиты открывают энерговорота',
        'Движущиеся платформы перевозят всех троих'
      ],
      'brief.mech.3': [
        'Вертикальные подъёмы: крюк и парение',
        'Щит Олафа — платформа для остальных',
        'Проверьте путь для каждого викинга'
      ],
      'brief.mech.4': [
        'Комбинируйте крюк, щит и таран',
        'Рычаги переключаются мечом и стрелами',
        'Чекпоинты сохраняют прогресс'
      ],
      'brief.mech.5': [
        'Финальная мозаика механик',
        'Три руны и трое у портала',
        'Не оставляйте никого позади'
      ],
      'brief.mech.default': [
        'Три викинга — три способности',
        'Руны дают очки, выход открыт всегда',
        'Смерть не заканчивает сагу'
      ],

      /* ---------- HUD ---------- */
      'hud.levelKicker': 'САГА',
      'hud.ofTotal': 'из {total}',
      'hud.timeLabel': 'Время',
      'hud.deathsLabel': 'Потери',
      'hud.runesLabel': 'Руны',
      'hud.exitLabel': 'Выход',
      'hud.runesAria': 'Руны: {got} из {total}',
      'hud.exitAria': 'У портала {n} из {total}',
      'hud.pauseAria': 'Пауза',
      'hud.helpAria': 'Управление и подсказки',
      'hud.hint': '1 2 3 — викинги · J — способность · K — спец · L — крюк · P — пауза',
      'hud.hintShort': '1 2 3 · J · K · L · P',
      'hud.active': 'Активный',
      'hud.dead': 'Павший',
      'hud.exited': 'У портала',
      'hud.idle': 'Ожидает',
      'hud.hpAria': 'Здоровье {hp} из {max}',
      'hud.vikingAria': '{name}, {role}. {state}. Здоровье {hp} из {max}. Способности: {abilities}',
      'hud.stateActive': 'активный викинг',
      'hud.stateDead': 'павший',
      'hud.stateExited': 'у портала',
      'hud.stateIdle': 'ожидает',
      'hud.abilitiesAria': 'Способности',
      'hud.exitPip': 'Слот выхода {n}',

      /* ---------- викинги и способности ---------- */
      'viking.erik': 'Эрик',
      'viking.erik.role': 'Быстрый',
      'viking.baleog': 'Балеог',
      'viking.baleog.role': 'Свирепый',
      'viking.olaf': 'Олаф',
      'viking.olaf.role': 'Могучий',
      'ability.headbutt': 'Таран',
      'ability.headbutt.key': 'J',
      'ability.headbutt.hint': 'Ломает лёд и бьёт врагов',
      'ability.glide': 'Парение',
      'ability.glide.key': 'Space',
      'ability.glide.hint': 'Держите Space в падении — Эрик планирует',
      'ability.sword': 'Меч',
      'ability.sword.key': 'J',
      'ability.sword.hint': 'Урон вблизи и переключение рычага',
      'ability.bow': 'Лук',
      'ability.bow.key': 'K',
      'ability.bow.hint': 'Стрела вперёд, по ↑ — вверх',
      'ability.hook': 'Крюк',
      'ability.hook.key': 'L',
      'ability.hook.hint': 'Цепляется за твёрдый потолок и подтягивает',
      'ability.shield': 'Щит',
      'ability.shield.key': 'J',
      'ability.shield.hint': 'Держите J: блок и платформа для других',

      /* ---------- пауза ---------- */
      'pause.heading': 'Пауза',
      'pause.sub': 'Полярная ночь не спешит. И вам не нужно.',
      'pause.resume': 'Продолжить',
      'pause.restart': 'Начать сагу заново',
      'pause.help': 'Управление',
      'pause.quit': 'В главное меню',
      'pause.levelInfo': 'Сага {n} · {name}',
      'pause.settings': 'Настройки',

      /* ---------- итоги саги ---------- */
      'complete.heading': 'Сага пройдена',
      'complete.sub': 'Все трое у портала. Ночь стала чуть светлее.',
      'complete.timeLabel': 'Время',
      'complete.deathsLabel': 'Потери',
      'complete.runesLabel': 'Руны',
      'complete.scoreLabel': 'Очки',
      'complete.next': 'Следующая сага',
      'complete.replay': 'Пройти заново',
      'complete.quit': 'В главное меню',
      'complete.runeValue': '{got} из {total}',
      'complete.nextHint': 'Дальше — новая глава',

      /* ---------- финал ---------- */
      'ending.heading': 'Конец пути',
      'ending.sub': 'Шесть саг, три викинга — и одно северное сияние.',
      'ending.time': 'Общее время',
      'ending.deaths': 'Всего потерь',
      'ending.runes': 'Собрано рун',
      'ending.score': 'Итоговые очки',
      'ending.levels': 'Пройдено саг',
      'ending.levelsValue': '{n} из {total}',
      'ending.creditsTitle': 'Титры',
      'ending.credit1': 'Дизайн и код — в духе «Северного сияния», 1997',
      'ending.credit2': 'Музыка — оригинальный чиптюн на WebAudio',
      'ending.credit3': 'Графика — вектор и пиксели, нарисованные кодом',
      'ending.credit4': 'The Lost Vikings — торговая марка Blizzard Entertainment',
      'ending.again': 'Пройти снова',
      'ending.back': 'В главное меню',

      /* ---------- справка ---------- */
      'help.heading': 'Управление',
      'help.sub': 'Клавиши, способности и несколько советов.',
      'help.aria': 'Справка по управлению',
      'help.keysTitle': 'Клавиши',
      'help.touchTitle': 'Сенсор',
      'help.move': 'Движение',
      'help.moveKeys': '← → / A D',
      'help.jump': 'Прыжок',
      'help.jumpKeys': '↑ / W / Space',
      'help.climb': 'Лазание',
      'help.climbKeys': '↑ ↓ у лестницы',
      'help.ability': 'Способность',
      'help.abilityKeys': 'J',
      'help.special': 'Вторая способность',
      'help.specialKeys': 'K',
      'help.hook': 'Крюк',
      'help.hookKeys': 'L',
      'help.switch': 'Смена викинга',
      'help.switchKeys': '1 / 2 / 3 / Tab',
      'help.pause': 'Пауза',
      'help.pauseKeys': 'P / Esc',
      'help.restart': 'Начать заново',
      'help.restartKeys': 'R',
      'help.hint': 'Подсказка',
      'help.hintKeys': 'H',
      'help.mode': 'Графика',
      'help.modeKeys': 'G',
      'help.langKey': 'Язык',
      'help.langKeys': 'Y',
      'help.mute': 'Звук',
      'help.muteKeys': 'M',
      'help.abilitiesTitle': 'Способности викингов',
      'help.tipsTitle': 'Советы',
      'help.tip1': 'Неактивные викинги замирают — стройте маршрут по очереди.',
      'help.tip2': 'Щит Олафа — платформа: поставьте его и поднимите остальных.',
      'help.tip3': 'Крюк цепляется за любой твёрдый потолок и за якоря.',
      'help.tip4': 'Руны не обязательны для выхода, но щедро платят очками.',
      'help.tip5': 'Смерть не заканчивает сагу: викинг вернётся у чекпоинта.',
      'help.touchNote': 'На телефоне и планшете кнопки появляются автоматически.',
      'help.close': 'Закрыть справку',

      /* ---------- тосты ---------- */
      'toast.mode.aurora': 'Графика: Северное сияние',
      'toast.mode.retro': 'Графика: 8 бит',
      'toast.lang.ru': 'Язык: русский',
      'toast.lang.en': 'Language: English',
      'toast.muted.on': 'Звук выключен',
      'toast.muted.off': 'Звук включён',
      'toast.checkpoint': 'Чекпоинт достигнут',
      'toast.rune': 'Руна {n} из 3',
      'toast.exit': 'Викинг у портала · {n} из 3',
      'toast.saved': 'Прогресс сохранён',
      'toast.levelComplete': 'Сага пройдена',
      'toast.locked': 'Сага закрыта — пройдите предыдущую',
      'toast.help': 'Справка · Esc закрывает',
      'toast.pause': 'Пауза',
      'toast.touch': 'Сенсорное управление включено',

      /* ---------- сенсор ---------- */
      'touch.group': 'Сенсорное управление',
      'touch.left': 'Влево',
      'touch.right': 'Вправо',
      'touch.up': 'Вверх',
      'touch.down': 'Вниз',
      'touch.jump': 'Прыжок',
      'touch.action': 'Способность',
      'touch.special': 'Спец',
      'touch.hook': 'Крюк',
      'touch.switch': 'Сменить викинга',

      /* ---------- доступность ---------- */
      'a11y.settings': 'Настройки',
      'a11y.screen.title': 'Главное меню',
      'a11y.screen.levels': 'Выбор саги',
      'a11y.screen.brief': 'Брифинг саги',
      'a11y.screen.play': 'Игра',
      'a11y.screen.pause': 'Пауза',
      'a11y.screen.complete': 'Итоги саги',
      'a11y.screen.ending': 'Финал',
      'a11y.screen.help': 'Справка',
      'a11y.mainMenu': 'Главное меню',
      'a11y.levelsGrid': 'Список саг',
      'a11y.primaryNav': 'Основные действия',
      'a11y.vikings': 'Викинги'
    },

    en: {
      /* ---------- common ---------- */
      'app.title': 'Lost Vikings II · Nordic Aurora',
      'common.back': 'Back',
      'common.close': 'Close',
      'common.on': 'On',
      'common.off': 'Off',
      'common.level': 'Saga',
      'common.levels': 'Sagas',
      'common.runes': 'Runes',
      'common.time': 'Time',
      'common.deaths': 'Losses',
      'common.score': 'Score',
      'common.menu': 'Main menu',
      'common.locked': 'Locked',
      'common.of': 'of',
      'common.levelOf': 'Saga {n} of {total}',
      'common.keys': 'Keyboard',
      'common.touch': 'Touch',
      'common.dash': '—',

      /* ---------- brand ---------- */
      'brand.lost': 'LOST',
      'brand.vikings': 'VIKINGS',
      'brand.ii': 'II',
      'brand.norse': 'NORSE BY NORSEWEST',
      'meta.aurora': 'NORDIC AURORA',
      'meta.genre': 'СЕВЕРНОЕ СИЯНИЕ',

      /* ---------- chips ---------- */
      'chip.graphics': 'Graphics',
      'chip.lang': 'Language',
      'chip.sound': 'Sound',
      'chip.aurora': 'AURORA',
      'chip.retro': '8-BIT',
      'chip.graphicsAria': 'Graphics: {mode}. Switch mode',
      'chip.langAria': 'Language: {lang}. Switch language',
      'chip.soundAriaOn': 'Sound is on. Mute',
      'chip.soundAriaOff': 'Sound is off. Unmute',
      'chip.soundOn': 'ON',
      'chip.soundOff': 'OFF',
      'chip.group': 'Settings',

      /* ---------- title ---------- */
      'title.kicker': 'A fan-made browser remake · 1997',
      'title.subtitle': 'NORDIC AURORA',
      'title.tagline': 'Three vikings. One polar night. Six sagas.',
      'title.menu': 'Choose your path',
      'title.start': 'New saga',
      'title.continue': 'Continue',
      'title.levels': 'Choose a saga',
      'title.help': 'Controls',
      'title.progress': 'Sagas unlocked: {n} of {total}',
      'title.fresh': 'No progress yet — begin the first saga',
      'title.keys': '1–3 vikings · G graphics · Y language · M sound',
      'title.attribution': 'A fan remake of The Lost Vikings 2 · Norse by Norsewest (1997)',
      'title.build': 'no external assets · everything drawn in code',
      'title.stats': '6 sagas · 3 vikings · 2 graphics modes',
      'title.feature1': 'Polar night',
      'title.feature2': 'Runes and portals',
      'title.feature3': 'Chiptune',

      /* ---------- levels ---------- */
      'levels.heading': 'Six sagas',
      'levels.sub': 'Each chapter brings a new rift, a new mechanic, and three ways through.',
      'levels.progress': '{unlocked} of {total} unlocked',
      'levels.cardAria': 'Saga {n}: {name}. Open',
      'levels.cardAriaLocked': 'Saga {n}: locked',
      'levels.backToTitle': 'Main menu',
      'levels.placeholder': 'Unknown saga',
      'levels.lockedHint': 'Finish the previous saga',
      'levels.runesAria': 'Runes: {got} of {total}',
      'levels.timeLabel': 'time',
      'levels.deathsLabel': 'losses',
      'levels.noData': '—',
      'levels.indexLabel': 'Saga {n}',

      /* ---------- brief ---------- */
      'brief.kicker': 'Saga {n} of {total}',
      'brief.hint': 'Hint',
      'brief.mechanics': 'Worth remembering',
      'brief.goalTitle': 'Goal',
      'brief.goal1': 'Collect three runes — they are worth points.',
      'brief.goal2': 'Bring all three vikings to the portal.',
      'brief.controlsTitle': 'Controls',
      'brief.start': 'Set out',
      'brief.back': 'Back to sagas',
      'brief.switchHint': '1 2 3 or Tab — switch viking',
      'brief.subline': 'Runes: {runes} · Checkpoints: {checkpoints} · Enemies: {enemies}',
      'brief.crew': 'The crew',
      'brief.crewSub': 'Who joins this saga',
      'brief.meta.runes': 'Runes',
      'brief.meta.checkpoints': 'Checkpoints',
      'brief.meta.enemies': 'Enemies',
      'brief.meta.difficulty': 'Difficulty',
      'brief.diff.0': 'Tutorial',
      'brief.diff.1': 'Ice',
      'brief.diff.2': 'Fire',
      'brief.diff.3': 'Vertical',
      'brief.diff.4': 'Combination',
      'brief.diff.5': 'Finale',
      'brief.mech.0': [
        'Erik headbutts ice and walls',
        'Baleog swings his sword and shoots',
        'Olaf raises his shield — you can stand on it'
      ],
      'brief.mech.1': [
        "Baleog's new hook grabs the ceiling",
        "Erik's glide stretches the jump",
        'Arrows ignite and flip levers'
      ],
      'brief.mech.2': [
        'Lava kills instantly',
        'Plates open energy doors',
        'Moving platforms carry all three'
      ],
      'brief.mech.3': [
        'Vertical climbs: hook and glide',
        "Olaf's shield is a platform for the others",
        'Check the route for every viking'
      ],
      'brief.mech.4': [
        'Combine hook, shield and headbutt',
        'Levers flip from sword and arrows',
        'Checkpoints keep your progress'
      ],
      'brief.mech.5': [
        'A final mosaic of mechanics',
        'Three runes and three at the portal',
        'Leave no one behind'
      ],
      'brief.mech.default': [
        'Three vikings, three abilities',
        'Runes are optional, the exit is not',
        'Death never ends the saga'
      ],

      /* ---------- HUD ---------- */
      'hud.levelKicker': 'SAGA',
      'hud.ofTotal': 'of {total}',
      'hud.timeLabel': 'Time',
      'hud.deathsLabel': 'Losses',
      'hud.runesLabel': 'Runes',
      'hud.exitLabel': 'Exit',
      'hud.runesAria': 'Runes: {got} of {total}',
      'hud.exitAria': '{n} of {total} at the portal',
      'hud.pauseAria': 'Pause',
      'hud.helpAria': 'Controls and hints',
      'hud.hint': '1 2 3 — vikings · J — ability · K — special · L — hook · P — pause',
      'hud.hintShort': '1 2 3 · J · K · L · P',
      'hud.active': 'Active',
      'hud.dead': 'Fallen',
      'hud.exited': 'At portal',
      'hud.idle': 'Waiting',
      'hud.hpAria': 'Health {hp} of {max}',
      'hud.vikingAria': '{name}, {role}. {state}. Health {hp} of {max}. Abilities: {abilities}',
      'hud.stateActive': 'active viking',
      'hud.stateDead': 'fallen',
      'hud.stateExited': 'at the portal',
      'hud.stateIdle': 'waiting',
      'hud.abilitiesAria': 'Abilities',
      'hud.exitPip': 'Exit slot {n}',

      /* ---------- vikings ---------- */
      'viking.erik': 'Erik',
      'viking.erik.role': 'Swift',
      'viking.baleog': 'Baleog',
      'viking.baleog.role': 'Fierce',
      'viking.olaf': 'Olaf',
      'viking.olaf.role': 'Mighty',
      'ability.headbutt': 'Headbutt',
      'ability.headbutt.key': 'J',
      'ability.headbutt.hint': 'Breaks ice and hits enemies',
      'ability.glide': 'Glide',
      'ability.glide.key': 'Space',
      'ability.glide.hint': 'Hold Space while falling — Erik glides',
      'ability.sword': 'Sword',
      'ability.sword.key': 'J',
      'ability.sword.hint': 'Melee damage and lever flips',
      'ability.bow': 'Bow',
      'ability.bow.key': 'K',
      'ability.bow.hint': 'Arrow forward, ↑ to shoot up',
      'ability.hook': 'Hook',
      'ability.hook.key': 'L',
      'ability.hook.hint': 'Grabs any solid ceiling and pulls',
      'ability.shield': 'Shield',
      'ability.shield.key': 'J',
      'ability.shield.hint': 'Hold J: block and a platform for others',

      /* ---------- pause ---------- */
      'pause.heading': 'Pause',
      'pause.sub': 'The polar night is in no hurry. Neither should you.',
      'pause.resume': 'Resume',
      'pause.restart': 'Restart this saga',
      'pause.help': 'Controls',
      'pause.quit': 'Main menu',
      'pause.levelInfo': 'Saga {n} · {name}',
      'pause.settings': 'Settings',

      /* ---------- complete ---------- */
      'complete.heading': 'Saga complete',
      'complete.sub': 'All three stand at the portal. The night is a little brighter.',
      'complete.timeLabel': 'Time',
      'complete.deathsLabel': 'Losses',
      'complete.runesLabel': 'Runes',
      'complete.scoreLabel': 'Score',
      'complete.next': 'Next saga',
      'complete.replay': 'Play again',
      'complete.quit': 'Main menu',
      'complete.runeValue': '{got} of {total}',
      'complete.nextHint': 'Onward to a new chapter',

      /* ---------- ending ---------- */
      'ending.heading': "Journey's end",
      'ending.sub': 'Six sagas, three vikings — and one northern light.',
      'ending.time': 'Total time',
      'ending.deaths': 'Total losses',
      'ending.runes': 'Runes found',
      'ending.score': 'Final score',
      'ending.levels': 'Sagas completed',
      'ending.levelsValue': '{n} of {total}',
      'ending.creditsTitle': 'Credits',
      'ending.credit1': 'Design and code — in the spirit of Nordic Aurora, 1997',
      'ending.credit2': 'Music — original chiptune on WebAudio',
      'ending.credit3': 'Art — vector and pixels, drawn in code',
      'ending.credit4': 'The Lost Vikings is a trademark of Blizzard Entertainment',
      'ending.again': 'Play again',
      'ending.back': 'Main menu',

      /* ---------- help ---------- */
      'help.heading': 'Controls',
      'help.sub': 'Keys, abilities and a few tips.',
      'help.aria': 'Controls reference',
      'help.keysTitle': 'Keys',
      'help.touchTitle': 'Touch',
      'help.move': 'Move',
      'help.moveKeys': '← → / A D',
      'help.jump': 'Jump',
      'help.jumpKeys': '↑ / W / Space',
      'help.climb': 'Climb',
      'help.climbKeys': '↑ ↓ by ladders',
      'help.ability': 'Ability',
      'help.abilityKeys': 'J',
      'help.special': 'Second ability',
      'help.specialKeys': 'K',
      'help.hook': 'Hook',
      'help.hookKeys': 'L',
      'help.switch': 'Switch viking',
      'help.switchKeys': '1 / 2 / 3 / Tab',
      'help.pause': 'Pause',
      'help.pauseKeys': 'P / Esc',
      'help.restart': 'Restart',
      'help.restartKeys': 'R',
      'help.hint': 'Hint',
      'help.hintKeys': 'H',
      'help.mode': 'Graphics',
      'help.modeKeys': 'G',
      'help.langKey': 'Language',
      'help.langKeys': 'Y',
      'help.mute': 'Sound',
      'help.muteKeys': 'M',
      'help.abilitiesTitle': 'Viking abilities',
      'help.tipsTitle': 'Tips',
      'help.tip1': 'Inactive vikings freeze — plan the route one at a time.',
      'help.tip2': "Olaf's shield is a platform: park him and lift the others.",
      'help.tip3': 'The hook grabs any solid ceiling and every anchor.',
      'help.tip4': 'Runes are optional for the exit, but they pay well.',
      'help.tip5': 'Death never ends the saga: the viking returns at a checkpoint.',
      'help.touchNote': 'On phones and tablets the on-screen buttons appear automatically.',
      'help.close': 'Close controls',

      /* ---------- toasts ---------- */
      'toast.mode.aurora': 'Graphics: Nordic Aurora',
      'toast.mode.retro': 'Graphics: 8-bit',
      'toast.lang.ru': 'Язык: русский',
      'toast.lang.en': 'Language: English',
      'toast.muted.on': 'Sound off',
      'toast.muted.off': 'Sound on',
      'toast.checkpoint': 'Checkpoint reached',
      'toast.rune': 'Rune {n} of 3',
      'toast.exit': 'Viking at the portal · {n} of 3',
      'toast.saved': 'Progress saved',
      'toast.levelComplete': 'Saga complete',
      'toast.locked': 'Saga locked — finish the previous one',
      'toast.help': 'Controls · Esc closes',
      'toast.pause': 'Paused',
      'toast.touch': 'Touch controls enabled',

      /* ---------- touch ---------- */
      'touch.group': 'Touch controls',
      'touch.left': 'Left',
      'touch.right': 'Right',
      'touch.up': 'Up',
      'touch.down': 'Down',
      'touch.jump': 'Jump',
      'touch.action': 'Ability',
      'touch.special': 'Special',
      'touch.hook': 'Hook',
      'touch.switch': 'Switch viking',

      /* ---------- a11y ---------- */
      'a11y.settings': 'Settings',
      'a11y.screen.title': 'Main menu',
      'a11y.screen.levels': 'Saga select',
      'a11y.screen.brief': 'Saga briefing',
      'a11y.screen.play': 'Game',
      'a11y.screen.pause': 'Pause',
      'a11y.screen.complete': 'Saga results',
      'a11y.screen.ending': 'Ending',
      'a11y.screen.help': 'Controls',
      'a11y.mainMenu': 'Main menu',
      'a11y.levelsGrid': 'Saga list',
      'a11y.primaryNav': 'Primary actions',
      'a11y.vikings': 'Vikings'
    }
  };

  var LANGS = ['ru', 'en'];
  var lang = 'ru';

  function norm(l) {
    return l === 'en' ? 'en' : 'ru';
  }

  function lookup(key) {
    var cur = DICT[lang] || DICT.ru;
    if (cur && Object.prototype.hasOwnProperty.call(cur, key)) return cur[key];
    var alt = DICT[lang === 'ru' ? 'en' : 'ru'];
    if (alt && Object.prototype.hasOwnProperty.call(alt, key)) return alt[key];
    return undefined;
  }

  function fill(str, vars) {
    if (!vars) return str;
    return str.replace(/\{(\w+)\}/g, function (m, name) {
      return Object.prototype.hasOwnProperty.call(vars, name) && vars[name] != null ? String(vars[name]) : m;
    });
  }

  /* t(key, vars) — строка; если ключа нет, возвращает сам ключ (безопасно). */
  function t(key, vars) {
    if (key == null) return '';
    var v = lookup(String(key));
    if (v === undefined) return String(key);
    if (typeof v !== 'string') return String(key);
    return fill(v, vars);
  }

  /* list(key) — массив строк (для брифинга); всегда массив. */
  function list(key) {
    var v = lookup(String(key));
    if (!v || !v.length || typeof v.length !== 'number') return [];
    var out = [];
    for (var i = 0; i < v.length; i++) out.push(typeof v[i] === 'string' ? fill(v[i], null) : '');
    return out;
  }

  function setLang(l) {
    lang = norm(l);
    return lang;
  }

  function getLang() {
    return lang;
  }

  LV.i18n = {
    t: t,
    list: list,
    setLang: setLang,
    getLang: getLang,
    LANGS: LANGS.slice()
  };
})();
