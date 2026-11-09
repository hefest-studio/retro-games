/* LOST VIKINGS · i18n — русский по умолчанию, English переключается */
(function () {
  "use strict";

  var DICT = {
    ru: {
      brand: { kicker: "Сага о трёх", l1: "ПОТЕРЯННЫЕ", l2: "ВИКИНГИ", sub: "Головоломка-платформер · 1992 → сейчас",
        lead: "Один герой за раз, три характера, десять земель. Переключайтесь, комбинируйте способности и выведите всех троих.",
        badge: { levels: "земель", heroes: "викинга", styles: "стиля графики", music: "музыка", bit: "8-бит" } },
      menu: {
        play: "Играть", "play.hint": "с начала",
        continue: "Продолжить", "levels": "Уровни", "levels.hint": "выбрать",
        help: "Как играть", "help.hint": "управление",
        settings: "Настройки", "settings.hint": "графика · язык"
      },
      char: {
        erik: "Эрик", "erik.role": "Быстрый", "erik.tag": "Быстрый · таран",
        "erik.ability": "Прыгает выше всех и пробивает головой ветхие стены.",
        baleog: "Балеог", "baleog.role": "Свирепый", "baleog.tag": "Свирепый · лук",
        "baleog.ability": "Стреляет из лука: враги и рычаги не устоят.",
        olaf: "Олаф", "olaf.role": "Стойкий", "olaf.tag": "Стойкий · щит",
        "olaf.ability": "Держит щит над головой: ступень для друзей и защита от стрел."
      },
      foot: {
        move: "идти", jump: "прыжок", action: "действие", switch: "сменить",
        note: "Фанатский ремейк. Оригинальные ассеты не использованы: вся графика и музыка сгенерированы кодом.",
        controls: "← → идти · Space прыжок · J действие · 1/2/3 смена",
        help: "Помощь", gfx: "Графика", lang: "Язык", sound: "Звук"
      },
      tool: {
        gfx: "Режим графики", "gfx.short": "Графика",
        lang: "Язык интерфейса", "lang.short": "Язык",
        mute: "Звук вкл/выкл", "mute.short": "Звук",
        pause: "Пауза", "pause.short": "Пауза"
      },
      chip: { gfx: "Графика:", lang: "Язык:", sound: "Звук:", on: "вкл", off: "выкл" },
      common: { back: "Назад", yes: "Да", no: "Нет", close: "Закрыть" },
      hud: {
        ready: "готов", dead: "пал", gone: "спасён", active: "в игре",
        treasure: "Сокровища", deaths: "Смерти", time: "Время"
      },
      story: {
        eyebrow: "Пролог", title: "Похищение",
        text: "Трое викингов возвращались домой, когда небо разверзлось и унесло их в чужие миры. Корабль разбит, ворота заперты, а впереди — десять земель, полных ловушек. Только вместе они смогут вернуться домой.",
        begin: "В путь", "begin.hint": "уровень 1"
      },
      levels: {
        eyebrow: "Карта похода", title: "Земли",
        locked: "Закрыто", level: "Уровень", best: "лучшее время", cleared: "пройдено"
      },
      theme: { cave: "Пещеры", forge: "Кузня", ice: "Ледники", forest: "Лес", castle: "Замок", void: "Пустота" },
      help: {
        eyebrow: "Свиток", title: "Как играть",
        lead: "Ведите всех трёх викингов к выходам. Активен один — переключайтесь и используйте способности каждого.",
        "objective.title": "Цель",
        "objective.text": "У каждого викинга своя дверь — она подсвечена цветом героя. Доведите каждого до его двери; чужая не откроется. Все трое ушли — уровень пройден.",
        "erik.title": "Эрик · таран", "erik.text": "Самый быстрый и высокий прыжок. «Действие» у ветхой стены — пробить проход.",
        "baleog.title": "Балеог · лук", "baleog.text": "Стрела убивает пещерных врагов и переключает рычаги. Меч бьёт вплотную.",
        "olaf.title": "Олаф · щит", "olaf.text": "Держите «действие»: щит над головой — платформа для друзей и защита от вражеских стрел.",
        "gate.title": "Плиты и ворота", "gate.text": "Плита открывает ворота, пока на ней кто-то стоит. Оставьте викинга на плите и переключитесь на другого.",
        "death.title": "Смерть", "death.text": "Шипы, враги и вражеские стрелы смертельны. Любая смерть — рестарт уровня; сокровища сбрасываются.",
        "key.move": "идти", "key.jump": "прыжок", "key.action": "действие", "key.switch": "сменить викинга",
        "key.restart": "рестарт", "key.pause": "пауза", "key.gfx": "графика", "key.lang": "язык", "key.mute": "звук"
      },
      settings: {
        eyebrow: "Настройки", title: "Предпочтения", gfx: "Графика", "gfx.retro": "8-бит", "gfx.modern": "Современная",
        lang: "Язык", volume: "Громкость", mute: "Звук", "mute.toggle": "Выключить", "mute.on": "Включить",
        reset: "Прогресс", "reset.button": "Сбросить прогресс",
        "reset.confirm": "Сбросить весь прогресс и открытые уровни?",
        note: "Настройки сохраняются автоматически в этом браузере."
      },
      intro: { go: "Вперёд", "go.hint": "Enter", menu: "К уровням" },
      pause: { eyebrow: "Отдых", title: "Пауза", resume: "Продолжить", restart: "Заново", quit: "В главное меню" },
      exit: { wrong: "Это дверь: {name}" },
      complete: {
        eyebrow: "Земля пройдена", title: "Все дома!", time: "Время", treasure: "Сокровища",
        deaths: "Смерти", score: "Очки", next: "Дальше", levels: "К уровням",
        note: "Все три викинга спаслись."
      },
      dead: {
        eyebrow: "Вальгалла ждёт", title: "Викинг пал", restart: "Заново", auto: "Возрождение…",
        spikes: "Шипы не прощают ошибок.", enemy: "Пещерный враг оказался быстрее.",
        arrow: "Вражеская стрела нашла цель.", fall: "Падение в бездну."
      },
      finale: {
        eyebrow: "Сага окончена", title: "Дом, милый дом",
        text: "Корабль снова на воде, ворота открыты, а над фьордом встаёт солнце. Три викинга вернулись — и им есть что рассказать.",
        totalTime: "Всего времени", totalTreasure: "Сокровища", totalDeaths: "Смерти", totalScore: "Очки",
        toTitle: "В главное меню"
      },
      toast: {
        levelUnlocked: "Открыт новый уровень", treasure: "Сокровище найдено", saved: "Прогресс сохранён",
        reset: "Прогресс сброшен", muted: "Звук выключен", unmuted: "Звук включён",
        gfx: "Графика переключена", lang: "Язык переключён", locked: "Сначала пройдите предыдущий уровень"
      },
      rotate: { note: "Поверните устройство горизонтально" }
    },
    en: {
      brand: { kicker: "A saga of three", l1: "THE LOST", l2: "VIKINGS", sub: "Puzzle platformer · 1992 → now",
        lead: "One hero at a time, three characters, ten lands. Switch, combine their skills and bring all three home.",
        badge: { levels: "lands", heroes: "vikings", styles: "graphics styles", music: "music", bit: "8-bit" } },
      menu: {
        play: "Play", "play.hint": "from the start",
        continue: "Continue", levels: "Levels", "levels.hint": "select",
        help: "How to play", "help.hint": "controls",
        settings: "Settings", "settings.hint": "graphics · language"
      },
      char: {
        erik: "Erik", "erik.role": "Swift", "erik.tag": "Swift · headbutt",
        "erik.ability": "Jumps the highest and smashes through crumbling walls.",
        baleog: "Baleog", "baleog.role": "Fierce", "baleog.tag": "Fierce · bow",
        "baleog.ability": "Looses arrows: enemies and levers stand no chance.",
        olaf: "Olaf", "olaf.role": "Stout", "olaf.tag": "Stout · shield",
        "olaf.ability": "Raises his shield: a step for friends and cover from arrows."
      },
      foot: {
        move: "move", jump: "jump", action: "action", switch: "switch",
        note: "Fan remake. No original assets: all art and music generated in code.",
        controls: "← → move · Space jump · J action · 1/2/3 switch",
        help: "Help", gfx: "Graphics", lang: "Language", sound: "Sound"
      },
      tool: {
        gfx: "Graphics mode", "gfx.short": "Graphics",
        lang: "Interface language", "lang.short": "Language",
        mute: "Sound on/off", "mute.short": "Sound",
        pause: "Pause", "pause.short": "Pause"
      },
      chip: { gfx: "Graphics:", lang: "Language:", sound: "Sound:", on: "on", off: "off" },
      common: { back: "Back", yes: "Yes", no: "No", close: "Close" },
      hud: {
        ready: "ready", dead: "down", gone: "saved", active: "active",
        treasure: "Treasure", deaths: "Deaths", time: "Time"
      },
      story: {
        eyebrow: "Prologue", title: "Taken",
        text: "Three vikings were sailing home when the sky split open and carried them into strange worlds. The ship is wrecked, the gates are locked, and ten trap-filled lands lie ahead. Only together can they return home.",
        begin: "Set out", "begin.hint": "level 1"
      },
      levels: {
        eyebrow: "Campaign map", title: "Lands",
        locked: "Locked", level: "Level", best: "best time", cleared: "cleared"
      },
      theme: { cave: "Caves", forge: "Forge", ice: "Glaciers", forest: "Forest", castle: "Castle", void: "The Void" },
      help: {
        eyebrow: "Scroll", title: "How to play",
        lead: "Guide all three vikings to the exits. One is active at a time — switch and use each one's skill.",
        "objective.title": "Objective",
        "objective.text": "Each viking has his own door, tinted with his colour. Bring each one to his door; another's door will not open. All three out — level cleared.",
        "erik.title": "Erik · headbutt", "erik.text": "Fastest, highest jump. Use Action at a crumbling wall to smash through.",
        "baleog.title": "Baleog · bow", "baleog.text": "Arrows kill cave foes and toggle levers. The sword strikes at close range.",
        "olaf.title": "Olaf · shield", "olaf.text": "Hold Action: the shield above his head is a platform for friends and cover from enemy arrows.",
        "gate.title": "Plates & gates", "gate.text": "A plate keeps gates open while someone stands on it. Leave a viking on the plate and switch to another.",
        "death.title": "Death", "death.text": "Spikes, foes and enemy arrows are deadly. Any death restarts the level; treasure resets.",
        "key.move": "move", "key.jump": "jump", "key.action": "action", "key.switch": "switch viking",
        "key.restart": "restart", "key.pause": "pause", "key.gfx": "graphics", "key.lang": "language", "key.mute": "sound"
      },
      settings: {
        eyebrow: "Settings", title: "Preferences", gfx: "Graphics", "gfx.retro": "8-bit", "gfx.modern": "Modern",
        lang: "Language", volume: "Volume", mute: "Sound", "mute.toggle": "Mute", "mute.on": "Unmute",
        reset: "Progress", "reset.button": "Reset progress",
        "reset.confirm": "Reset all progress and unlocked levels?",
        note: "Settings are saved automatically in this browser."
      },
      intro: { go: "Go", "go.hint": "Enter", menu: "To levels" },
      pause: { eyebrow: "Rest", title: "Paused", resume: "Resume", restart: "Restart", quit: "Main menu" },
      exit: { wrong: "This door belongs to {name}" },
      complete: {
        eyebrow: "Land cleared", title: "All home!", time: "Time", treasure: "Treasure",
        deaths: "Deaths", score: "Score", next: "Next", levels: "To levels",
        note: "All three vikings made it."
      },
      dead: {
        eyebrow: "Valhalla awaits", title: "A viking has fallen", restart: "Retry", auto: "Respawning…",
        spikes: "Spikes forgive nothing.", enemy: "A cave foe was faster.",
        arrow: "An enemy arrow found its mark.", fall: "A fall into the abyss."
      },
      finale: {
        eyebrow: "Saga complete", title: "Home at last",
        text: "The ship is afloat again, the gates are open, and the sun rises over the fjord. Three vikings are back — with stories to tell.",
        totalTime: "Total time", totalTreasure: "Treasure", totalDeaths: "Deaths", totalScore: "Score",
        toTitle: "Main menu"
      },
      toast: {
        levelUnlocked: "New level unlocked", treasure: "Treasure found", saved: "Progress saved",
        reset: "Progress reset", muted: "Sound off", unmuted: "Sound on",
        gfx: "Graphics switched", lang: "Language switched", locked: "Clear the previous level first"
      },
      rotate: { note: "Rotate your device to landscape" }
    }
  };

  function pick(dict, key) {
    var parts = String(key).split(".");
    function walk(node, i) {
      if (i >= parts.length) return typeof node === "string" ? node : null;
      if (!node || typeof node !== "object") return null;
      // сначала пробуем самый длинный «плоский» ключ с точками, потом короткий
      for (var j = parts.length; j > i; j--) {
        var k = parts.slice(i, j).join(".");
        if (k in node) {
          var r = walk(node[k], j);
          if (r != null) return r;
        }
      }
      return null;
    }
    return walk(dict, 0);
  }

  var api = {
    lang: "ru",
    dict: DICT,
    has: function (lang) { return !!DICT[lang]; },
    setLang: function (lang) {
      if (!DICT[lang]) lang = "ru";
      api.lang = lang;
      return lang;
    },
    t: function (key, fallback) {
      var s = pick(DICT[api.lang], key);
      if (s == null) s = pick(DICT.ru, key);
      if (s == null) s = fallback != null ? fallback : key;
      return s;
    },
    levelName: function (level) {
      if (!level) return "";
      return (level.name && (level.name[api.lang] || level.name.ru)) || "";
    },
    levelHint: function (level) {
      if (!level) return "";
      return (level.hint && (level.hint[api.lang] || level.hint.ru)) || "";
    }
  };

  window.LV_I18N = api;
  window.LV_T = api.t;
})();
