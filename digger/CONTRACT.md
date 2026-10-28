# DIGGER — HTML5: контракты модулей

Порт классической игры **Digger** (Windmill Software, 1983) на чистый HTML/JS/Canvas.
Открывается как `digger/index.html` по `file://` — **без сборки, CDN, npm и интернета**.
По умолчанию русский язык, есть EN; два режима графики (8-бит и современный «неон»);
оригинальная 8-битная музыка и SFX на WebAudio; только код, никаких внешних картинок,
шрифтов и аудиофайлов. Внутреннее разрешение канваса — **960×600** (16:10).

> Этот файл — единственный источник истины по интерфейсам. Читай целиком перед работой.
> Владелец контракта и интеграции — Lead. Свои файлы можно менять свободно, чужие — нельзя.

---

## 1. Файлы и владельцы

| Файл | Владелец | Что содержит |
|---|---|---|
| `index.html` | Lead | каркас: `<canvas id="game">` + `<div id="ui">`, подключение скриптов |
| `css/style.css` | ui-i18n | вся вёрстка страницы, оверлеи, кнопки, темы, CRT-эффект |
| `js/i18n.js` | ui-i18n (база — Lead) | RU/EN строки, `DG.t`, `DG.i18n` |
| `js/audio.js` | audio-smith | чиптюн-движок: музыка + SFX, `DG.audio` |
| `js/game.js` | Lead | движок: сетка, копание, сумки, монстры, очки, уровни; `DG.Game` |
| `js/classic.js` | pixel-viz | рендерер 8-бит (320×200 CGA/EGA, пиксель-арт) |
| `js/modern.js` | modern-viz | современный рендерер (960×600, неон/стекло) |
| `js/ui.js` | ui-i18n | DOM-оверлеи: титул, настройки, помощь, пауза, game over |
| `js/main.js` | Lead | boot, rAF-цикл, ввод, настройки, localStorage, debug-хеши |
| `tools/qa.mjs` | qa-runner | headless-проверки и скриншоты |
| `tests/engine.test.mjs` | qa-runner | автотесты логики движка (Node, без зависимостей) |
| `README.md` | Lead | инструкция, механика, скриншоты |

Порядок подключения (классические `<script>`, не ES-модули!):
`i18n.js` → `audio.js` → `game.js` → `classic.js` → `modern.js` → `ui.js` → `main.js`.

Каждый файл — IIFE, начинается с `window.DG = window.DG || {};` и навешивает свой API:

```js
// js/game.js
(function (global) {
  'use strict';
  var DG = global.DG = global.DG || {};
  /* ... */
})(window);
```

Правила: `'use strict'`, ES2018 (стрелки/let/template — можно), без `import/export`,
без модулей, без `fetch`, без внешних URL. Код читаемый, комментарии по-русски.

---

## 2. Координаты и канвас

- Канвас: `960×600`. Рендерер обязан закрасить **всю** площадь каждый кадр.
- Логическое поле: `COLS = 15`, `ROWS = 10` (клетка — единица перемещения и копания).
- Клетка `(cx, cy)`: `cx 0..14` слева направо, `cy 0..9` сверху вниз.
- «Мировые» координаты в рендерере: **центр спрайта в клетках** (`x=0.5` — центр клетки 0).
  Для рендера: `px = fieldX + x * CELL`, `py = fieldY + y * CELL`.
- Направления: `0=вверх, 1=вправо, 2=вниз, 3=влево`; `DG.G.DIRS`.
- Вся геометрия поля (отступы, размер клетки, HUD) — **на усмотрение рендерера**,
  режимы графики могут иметь разную компоновку. Общее только: `DG.G.COLS/ROWS`.
- `S.time` — монотонное время в секундах (для анимаций); `S.anim` — игровое время.

У подписей HUD используй `DG.t('…')` и только ключи из §6.4 (если ключа нет — RU-фолбэк).

---

## 3. Модель состояния (один объект `S`, общий для всех)

`engine.state` — единственный источник данных для рендерера/UI. **Рендерер не меняет `S`.**

```js
S = {
  seed: 1337, level: 1, score: 0, hi: 0, lives: 3,
  mode: 'title'|'ready'|'play'|'bonus'|'dying'|'levelclear'|'gameover',
  paused: false,
  time: 0, anim: 0,            // time — wall time, anim — game time
  gemsLeft: 0, gemsTotal: 0,
  gemChain: 0,                 // алмазов подряд
  bonus: false, bonusT: 0, bonusDur: 0,
  spawnLeft: 0, monstersMax: 0, kills: 0,
  shake: 0,                    // 0..1, затухает
  grid: Uint8Array(COLS*ROWS), // 0 = земля, 1 = прокопано
  items: [                     // алмазы/золото/вишня
    { type:'gem',    x:3.5, y:2.5, cx:3, cy:2 },
    { type:'gold',   x:5.5, y:7.5, cx:5, cy:7 },
    { type:'cherry', x:14.5,y:0.5, cx:14,cy:0 },
    { type:'bag',    x:8.5, y:4.5, cx:8, cy:4,
      falling:false, wobble:0.8,    // 0..0.8 — трясётся; -1 — стабильна
      vy:0, fallFrom:4 }
  ],
  player: {
    cx:7, cy:9, x:7.5, y:9.5,   // cx/cy — целевая клетка, x/y — плавная позиция
    dir:0, moving:false, alive:true,
    invuln:2.5,                 // сек. неуязвимости после респавна
    shootCd:0, shootMax:1.2,    // перезарядка оружия
    shootAnim:0,                // 0..1 вспышка выстрела
    walkPhase:0                 // 0..1 фаза шага
  },
  monsters: [{
    kind:'nobbin'|'hobbin',
    cx:14, cy:0, x:14.5, y:0.5, dir:2,
    scared:false, dying:0,      // dying>0 — анимация смерти
    spawnT:0.6,                 // 0..1 анимация появления
    moving:false, walkPhase:0
  }],
  bullets: [{ x:7.5, y:6.5, dir:0 }],
  particles: [{ x:7.5, y:6.5, vx:0, vy:0, life:0.5, maxLife:0.5, size:2, color:'#f00', kind:'dirt' }],
  popups:  [{ text:'+25', x:3.5, y:2.5, life:1, maxLife:1, kind:'score' }],
  readyT: 0,                    // таймер экрана "УРОВЕНЬ N"
  clearT: 0,
  stats: { dug: 0, bagKills: 0, shots: 0 }
}
```

Инварианты, на которые можно опираться:
- `grid` всегда валиден; `x/y` — конечные числа; `items` содержит только живые объекты.
- Спрайт рисуется **центрированным** на `(x, y)` в клеточных координатах.
- Сумка при падении имеет `falling=true`, `y` уже плавно едет вниз.
- Мёртвые монстры остаются в массиве с `dying > 0` (анимация ~0.45 с), затем исчезают.
- Игрок при `invuln > 0` мигает — это визуальная задача рендерера.
- `mode='dying'` — 1.6 с анимация смерти; затем респавн или gameover.

---

## 4. `DG.Game` — движок (`js/game.js`, Lead)

```js
DG.G = { COLS:15, ROWS:10, DIRS:[[0,-1],[1,0],[0,1],[-1,0]], W:960, H:600 };
DG.rng(seed) -> function() -> 0..1        // детерминированный PRNG (mulberry32)
DG.Game(opts) -> engine
```

`opts`: `{ seed=1337, onEvent=function(type, data){}, hiscore=0, startLevel=1 }`.

```js
engine.state                  // объект S (§3)
engine.start()                // новая игра: score 0, lives 3, level 1, mode 'ready'
engine.toTitle()              // mode 'title' (демо-фон), строит уровень 1
engine.update(dt)             // шаг симуляции; время обновляет всегда
engine.setDir(dir|-1)         // желаемое направление игрока
engine.shoot()                // выстрел, если перезарядка готова
engine.pause(flag)            // S.paused
engine.togglePause()
engine.setLevel(n)            // debug: построить уровень n, mode 'ready'
engine.forceMode(m)           // debug: 'title'|'play'|'bonus'|'dying'|'gameover'|'levelclear'
engine.onEvent(type, data)    // можно переопределить колбэк
```

События (звук/SFX в `main.js`, движок **не** вызывает `DG.audio`):
`dig`, `gem` (data: score, chain), `gold`, `shoot`, `monsterDie` (by:'bullet'|'bag'|'eat'), `bulletHit`,
`squash`, `bagPush`, `bagWobble`, `bagFall`, `bagBreak`, `cherry`, `bonusStart`, `bonusEnd`,
`eat` (score), `playerDie`, `extraLife`, `levelStart` (level), `levelClear` (level),
`gameOver` (score, hi, record), `monsterSpawn`, `pause` (paused).

### Точная механика (реализует движок; остальные модули могут на неё опираться)

- Старт: 3 жизни, extra life каждые 20 000 очков.
- Копание: игрок входит в клетку земли → она становится туннелем (`'dig'`, частицы).
  Игрок всегда может копать в любую сторону (кроме границ и занятых сумок).
- Очки: алмаз 25 (+250 за каждые 8 подряд); золото 500; вишня +1000 и бонус-режим;
  монстр выстрелом/сумкой 250; поедание в бонусе 200→400→800…; выход из уровня +1000.
- Сумки золота: если под сумкой прокопали — трясётся 0.8 с, падает (8 кл/с).
  Упала ≥2 клеток → лопается, на месте падения появляется золото (500). Упала на 1 — лежит.
  Падающая сумка убивает игрока и монстров. Сумку можно толкать по горизонтали в туннель.
- Монстры: спавн в правой верхней клетке `(14,0)`; бюджет `1+level` (макс 9), одновременно
  до `1+floor((level-1)/2)` (макс 4), интервал `max(1.3, 3.0-0.18*level)` с. Nobbin ходит только
  по туннелям (BFS к игроку); с 4-го уровня часть монстров — Hobbin: копает и иногда уничтожает
  алмазы/сумки. Контакт с игроком = смерть (кроме бонус-режима).
- Оружие: выстрел по прямой, скорость 16 кл/с, гаснет о землю; перезарядка
  `1.2 + 0.12*(level-1)` с (макс 2.6). Индикатор — `player.shootCd/shootMax`.
- Бонус-режим: когда бюджет спавна исчерпан, в `(14,0)` появляется вишня. Взяв её:
  +1000, 15−1.5·(level−1) с (мин 6), монстры пугаются и убегают, игрок их ест;
  по окончании — новая волна монстров (если остались алмазы).
- Уровень пройден, когда не осталось алмазов **или** все монстры убиты (бюджет исчерпан
  и живых нет). Дальше `mode='levelclear'` (2 с) → следующий уровень.
- Смерть: 1.6 с, жизнь −1, уровень перестраивается; жизней 0 → `gameOver`.
- Уровни генерируются процедурно из seed (детерминированно), сложность растёт.

### Баланс — текущие числа (держать синхронно с `js/game.js` и тестами)
- Игрок: 0.105 с/клетка (~9.5 кл/с); выстрел 16 кл/с; неуязвимость после спавна 2.5 с.
- Оружие: `1.2+0.12*(level-1)` с, максимум 2.6; контакт с монстром — ближе 0.58 клетки,
  удар падающим мешком — ближе 0.5 клетки.
- Монстры: nobbin `0.30 + max(0, 3-level)*0.04` с/клетка, hobbin 0.42, испуганные 0.22;
  шанс хоббина `clamp((level-3)*0.15, 0, 0.65)`.
- Алмазы на уровне: `min(26, 9 + 2*level)`; мешки: `2 + min(level,3)`.
- Бонус-режим: `max(6, 15 - 1.5*(level-1))` с.
- Первые уровни намеренно мягче (медленнее монстры, реже спавн) — это часть баланса.

---

## 5. Рендереры (`js/classic.js`, `js/modern.js`)

```js
DG.render = DG.render || {};
DG.render.classic = { id:'classic', draw: function(ctx, S){ /* ... */ } };
DG.render.modern  = { id:'modern',  draw: function(ctx, S){ /* ... */ } };
```

- `ctx` — 2D-контекст канваса 960×600. Рендерер сам решает, рисовать в 960×600 или
  через внутренний offscreen (classic: 320×200, апскейл ×3, `imageSmoothingEnabled=false`).
- Рендерер рисует мир + свой HUD + игровые баннеры (ready/levelclear/bonus/dying).
  Экраны **title, pause, gameover рисует DOM-оверлей** (`DG.ui`): в этих состояниях
  рендерер НЕ дублирует логотип, заголовки, подсказки и надписи — только живой фон
  (земля/алмазы/монстры/частицы), HUD и мягкое затемнение. Иначе текст просвечивает
  сквозь стеклянные панели и получается «призрак» (проверено на скриншотах).
- Запрещено: менять `S`, обращаться к `document` за пределами канваса, к `DG.audio`,
  к сети/localStorage. Разрешено: свои кэши/offscreen, `DG.t`, `DG.i18n.lang`.
- Рендерер обязан быть быстрым (60 fps на встроенной графике): никаких `shadowBlur`
  в цикле по тысяче частиц, кэшировать спрайты/градиенты.
- В HUD показывать: счёт, рекорд, уровень, жизни, остаток алмазов, таймер бонуса,
  индикатор перезарядки оружия. Язык подписей — `DG.t`.
- Обязательные визуальные состояния: сумка трясётся/падает/лопается, выстрел и вспышка,
  попадание, неуязвимость игрока (мигание), появление и смерть монстров, бонус-режим
  (монстры «испуганы»), частицы земли, всплывающие очки, shake, ready/levelclear-баннеры.
- Ключи HUD: `score`, `hiscore`, `level`, `lives`, `gems`, `bonus`, `paused`, `ready`
  (текст «УРОВЕНЬ {n}» отдельным ключом `levelIntro`), `bonusMode`.

### 5.1 `classic.js` — 8-бит (pixel-viz)
Аутентичный вид начала 80-х: внутренний буфер **320×200**, целочисленный апскейл ×3,
`imageSmoothingEnabled=false`, ограниченная палитра (EGA/CGA: чёрный, тёмно-коричневый/
красный дёрт с дизерингом, зелёный, жёлтый, циан, магента, белый). Референс — оригинальные скриншоты игры 1983 года (в репозитории не хранятся):
оранжево-коричневая земля с текстурой, зелёные алмазы, жёлтые сумки с `$`, чёрные туннели,
маленький плуг-игрок, монстры-кляксы. Пиксельные спрайты рисуются кодом (палитровые
массивы 16×16 или примитивы без сглаживания). Шрифт HUD: `monospace`, размеры кратны 3,
чёткие (без «мыла»); допускается 5×7-пиксельный шрифт для латиницы и кириллицы,
но надёжнее — canvas-текст на слое 960×600. Опционально CRT-полосы (их включает CSS).
Палитра и спрайты — авторские, не копировать оригинальные ассеты.

### 5.2 `modern.js` — современный «неон/стекло» (modern-viz)
960×600, полноценная 2D-графика: глубокий градиентный фон, объёмная земля (текстура/шум,
подсветка), туннели — тёмное стекло с неоновой кромкой, алмазы — огранённые кристаллы
с бликами, сумки — бархатные мешочки с золотым шитьём `$`, игрок — стильный бур-под
с фарой/трейлом, монстры — биолюминесцентные капли с глазами, частицы, свечение,
glassmorphism-HUD (полупрозрачные панели, тонкие рамки, аккуратная типографика),
плавные анимации, screen shake, виньетка. Палитра: #070a12/#0d1424 фон, cyan #22d3ee,
emerald #34d399, gold #fbbf24, magenta #f472b6. Стильно, дорого, без «дешёвого неона».
Обязательно читаемая сетка тоннелей, чёткий игрок и монстры.

---

## 6. Общие API

### 6.1 Настройки `DG.settings` (создаёт `main.js`, читают все)
```js
DG.settings = { gfx:'classic'|'modern', lang:'ru'|'en', music:true, sfx:true, crt:true };
DG.applySetting(key, value)   // main: применяет, сохраняет, обновляет UI/аудио/класс body
```
Графика при каждом запуске принудительно `classic` (ретро, по требованию заказчика) и между
сессиями не сохраняется; `lang/music/sfx/crt` сохраняются, рекорд — отдельно.
`document.body` получает классы `gfx-classic` / `gfx-modern` (для CSS).

### 6.2 UI (`js/ui.js`, ui-i18n)
```js
DG.ui.init(opts)   // opts: { getSettings(), setSetting(key,value), start(), resume(),
                   //        restart(), menu(), getHiscore(), resetHi(),
                   //        openPanel(name), closePanel() }
DG.ui.show(name|null, data)  // 'title'|'settings'|'help'|'about'|'pause'|'gameover'
DG.ui.refresh()              // перерисовать текущий экран (после смены языка/графики)
DG.ui.current() -> string|null   // имя текущего экрана (нужно main.js)
DG.ui.activate()             // Enter при открытой панели: активировать фокус/основное действие
```
- `gameover` data: `{ score, hi, record, stats }`, где stats = `{gems,kills,levels,bagKills,dug,shots}`.
- Панели settings/help/about открываются строго через `openPanel(name)`/`closePanel()`
  (main.js сам ставит игру на паузу и снимает); кнопки старта/рестарта/меню — через колбэки.
- main.js сам обрабатывает Enter/Esc/стрелки/пробел; UI не перехватывает их.
- Структурный CSS (сцена 960×600, `#ui`, `#fx`, pointer-events) задан инлайном в `index.html`
  и не дублируется; `css/style.css` — дизайн-слой. Классы `body`: `gfx-classic|gfx-modern`,
  `crt-on`, `lang-ru|lang-en`, `shot` (отключение анимаций для скриншотов).
- Только DOM, внутри `#ui`; канвас не трогать. Все тексты — через `DG.t`.
- Кнопки обязаны работать с клавиатуры (Tab/Enter) и мышью; на телефоне — тапаются.
- Экран `title`: логотип DIGGER, подзаголовок, большие кнопки «Играть», «Настройки»,
  «Управление», «Об игре», переключатели языка/графики/музыки, рекорд, подсказка Enter.
- `settings`: режим графики (2 кнопки), язык, музыка вкл/выкл, звуки вкл/выкл,
  CRT-эффект, сброс рекорда, «Назад».
- `help`: управление + краткая механика (копание, сумки, монстры, бонус).
- `about`: что за игра, оригинал 1983 Windmill Software, фан-порт, технологии, кредиты.
- `pause`: «Пауза», «Продолжить», «Заново», «В меню», «Настройки».
- `gameover`: счёт, рекорд, «Новый рекорд!», «Ещё раз», «В меню».
- Стилистика: тёмный премиальный интерфейс, крупная типографика, аккуратные анимации
  появления, фокус-состояния, `prefers-reduced-motion`; адаптивность до 1280×720 и телефона.
- Все оверлеи должны корректно работать при `gfx-classic` и `gfx-modern` (меняется акцент).

### 6.3 Аудио (`js/audio.js`, audio-smith)
```js
DG.audio.unlock();                    // по первому жесту; resume AudioContext
DG.audio.isReady();                   // есть ли живой AudioContext
DG.audio.startMusic(mode);            // 'title'|'game'|'bonus'|'death'|'clear'|'gameover'
DG.audio.stopMusic(fadeMs = 250);     // плавно, без щелчков
DG.audio.setGameTheme(i);             // 0|1 — вариация игрового трека (по уровню)
DG.audio.sfx(name);                   // см. список ниже; безопасно до unlock
DG.audio.setMuted(m);                 // глушит всё (глобально)
DG.audio.toggleMuted() -> boolean; DG.audio.getMuted() -> boolean
DG.audio.setVolume(v); DG.audio.getVolume();
DG.audio.setMusicEnabled(b); DG.audio.getMusicEnabled();   // отдельный флаг музыки
DG.audio.setSfxEnabled(b);   DG.audio.getSfxEnabled();     // отдельный флаг SFX
```
Флаги музыки/SFX независимы от глобального mute: выключенная музыка не играет, SFX звучат,
и наоборот. Вызовы до `unlock()` безопасны и запоминаются.
SFX: `dig`, `gem`, `gold`, `bag_push`, `bag_wobble`, `bag_fall`, `bag_break`, `shoot`,
`monster_die`, `squash`, `player_die`, `cherry`, `bonus`, `eat`, `level_clear`,
`extra_life`, `ui_click`, `pause`, `game_over`.
Требования: только WebAudio, lookahead-планировщик (без дрейфа), плавные fade,
остановка нод, никаких исключений, оригинальные мелодии (не копировать Popcorn /
William Tell / Chopin — сочинить свои в духе 8-бит), громкость умеренная (музыка тише SFX),
мьют — не `suspend`, а masterGain 0, чтобы разблокировка не ломалась.
Музыка: title (медленная, загадочная), game темы A и B (132–144 BPM, пунч, арпеджио,
бас-треугольник, шумовые барабаны), bonus (быстрая погоня), death (короткий мрачный джингл),
clear (фанфара), gameover (грустный аккорд).

### 6.4 Строки i18n (`js/i18n.js`, ui-i18n)
```js
DG.t(key, vars) -> string   // {vars} подстановка: DG.t('levelIntro', {n:3})
DG.i18n = { lang:'ru', setLang('ru'|'en'), toggle(), available:['ru','en'] };
```
Ключи RU/EN (полный набор задаёт Lead в первой версии, ui-i18n дополняет, **не переименовывая**):
`appTitle, appTagline, play, start, resume, restart, menu, toMenu, settings, help, about,
back, close, score, hiscore, level, lives, gems, bonus, paused, ready, levelIntro, cleared,
gameover, yourScore, newRecord, pressEnter, gfx, gfxClassic, gfxModern, language, music, sfx,
crt, on, off, controls, controlsMove, controlsShoot, controlsPause, controlsMenu, controlsLang,
controlsMusic, controlsGfx, controlsRestart, controlsHelp, mechanics, mechDig, mechGems, mechBags,
mechMonsters, mechBonus, mechWeapon, aboutText, aboutOriginal, aboutTech, aboutCredits,
resetRecord, recordReset, touchHint, soundOn, soundOff, musicOn, musicOff, newGame, quit,
bonusMode, bonusTime, recharge, levelCleared, livesShort, hiscoreShort, settingsSaved,
keyboard, mouse, footerHint, version`
HUD-подмножество: `score, hiscore, level, lives, gems, bonus, paused, ready, levelIntro, bonusMode`.

### 6.5 `main.js` (Lead)
- Создаёт `DG.settings`, читает `localStorage` (`digger.settings`, `digger.hi`), масштабирует сцену.
- rAF-цикл: `dt` clamp 0.05 → `engine.update(dt)` → `DG.render[gfx].draw(ctx, S)` → `DG.ui` синк.
- Ввод (по `e.code`, чтобы работала русская раскладка): `Arrow/WASD` — движение,
  `Space` — выстрел, `Enter` — старт/продолжить, `Esc`/`P` — пауза/назад,
  `M` — музыка, `K` — звуки, `L` — язык, `G` — графика, `H` — помощь, `R` — заново,
  `C` — CRT, `F` — фуллскрин (опционально). `preventDefault` для стрелок/пробела.
- События движка → `DG.audio.sfx(...)` и `DG.audio.startMusic(...)`:
  title→'title', levelStart/play→'game' (+`setGameTheme(level%2)`), bonusStart→'bonus',
  bonusEnd→'game', playerDie→'death', levelClear→'clear', gameOver→'gameover', restart→'game'.
  Маппинг SFX: gem→'gem', gold→'gold', dig→'dig', shoot→'shoot', monsterDie→'monster_die',
  bagPush→'bag_push', bagWobble→'bag_wobble', bagFall→'bag_fall', bagBreak→'bag_break',
  squash→'squash', cherry→'cherry', extraLife→'extra_life', playerDie→'player_die'.
- `DG.ui` → экраны; пауза: оверлей + `engine.pause(true)`; gameover: данные счёта.
- Мобильный ввод: свайпы по канвасу (движение), тап — выстрел; подсказка `touchHint`.
- **Debug (нужно QA и скриншотам)**: хеш после `index.html`:
  `#shot=title|play|bonus|gameover|help|settings|about|pause`, параметры `&level=N`,
  `&gfx=classic|modern`, `&lang=ru|en`, `&mute`, `&freeze` (фиксированное время),
  `#test` — прогон самопроверок, результат в `document.title` (`DIGGER TESTS 24/24 PASS`)
  и в `<pre id="testout">`; `#nofx` — без анимаций появления для стабильных скриншотов
  (эквивалент класса `body.shot`).
  Скриншот-режим ставит состояние, прокручивает фиксированное время и останавливает цикл.

---

## 7. QA (`tools/qa.mjs`, `tests/engine.test.mjs`; qa-runner)

### 7.1 `node tests/engine.test.mjs` — логика без браузера (56 проверок)
Читает `js/i18n.js` и `js/game.js`, исполняет в `node:vm` с шимом `window/globalThis`
(движок обязан быть DOM-независимым!). Минимум 20 проверок: генерация уровня
(размеры, старт в туннеле, сумки с опорой, алмазы есть), копание + очки, комбо ×8,
падение/поломка сумки → золото, выстрел убивает монстра, контакт убивает игрока,
жизни/респавн, gameover, бонус-режим по вишне, детерминизм seed, нет NaN/исключений
за 60 с симуляции со случайными входными командами, `state` соответствует §3.
Вывод: по строке на тест, финал `OK n/n`, код возврата 0/1.

### 7.3 `node tools/e2e.mjs` — E2E в реальном Chrome через CDP
Headless Chrome + DevTools Protocol (Node 22+, без зависимостей): старт игры клавиатурой,
движение/копание, выстрел, пауза, смена графики/языка, game over, рестарт, возврат в меню,
проверка консоли и 24 проверки. Код возврата 0 — всё прошло.

### 7.2 `node tools/qa.mjs [--only=...]` — браузерные скриншоты
Без зависимостей: запускает `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`
в headless (`--headless=new --no-sandbox --disable-gpu --hide-scrollbars
--user-data-dir=<временная папка в проекте> --window-size=1280,760 --virtual-time-budget=...`),
снимает скриншоты в `screenshots/` для набора: `title_classic`, `title_modern`,
`play_classic`, `play_modern`, `bonus_modern`, `gameover_modern`, `help_modern`,
`settings_classic`, `play_classic_en`, `ready_classic`, `levelclear_modern`, `pause_modern`,
плюс мобильные `mobile_title`, `mobile_play`, `mobile_settings` (390×844) и
`landscape_title`, `landscape_play` (844×390; через CDP `Emulation.setDeviceMetricsOverride`).
Проверяет размер и валидность PNG, собирает console-ошибки по всем режимам/графике,
пишет `screenshots/qa-report.txt`.
Ручной запуск скриншота:
```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --no-sandbox \
  --disable-gpu --hide-scrollbars --user-data-dir="$PWD/.tmp/profile" --window-size=1280,760 \
  --virtual-time-budget=4000 --screenshot="$PWD/.tmp/shot.png" \
  "file://$PWD/index.html#shot=play&gfx=modern"
```
(Пути — только внутри проекта, не в `/tmp`, не в `~/Library`.)

---

## 8. Координация

1. Задача на доске: `claim` свою задачу до начала, `complete` по готовности.
2. Работай только в своих файлах (§1). Чужие не редактируй; нужен интерфейс — пиши Lead.
3. Перед отчётом: `node --check <свой js>` и визуальная проверка скриншотом (для рендереров/UI).
4. Отчёт Lead через `send_message`: что сделано, как проверено, известные ограничения.
5. Если интерфейса не хватает — не выдумывай молча: сообщи Lead, он расширит контракт.
6. Никаких `git` операций, удалений чужих файлов, установки пакетов.

## 9. Definition of Done

- `digger/index.html` открывается по `file://` в Chrome/Safari/Firefox: титул → игра →
  пауза → game over → рестарт; обе графики, оба языка, звук/музыка, мобильный layout.
- Ошибок в консоли нет, ассетов извне нет, всё работает офлайн.
- `node tests/engine.test.mjs` → OK; `node tools/qa.mjs` → скриншоты сняты, пустых нет.
- Код читаемый, комментарии по-русски, README с механикой и управлением.
