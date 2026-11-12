# CONTRACT · РЕДУТ

Технический контракт игры. Все модули соблюдают его дословно, чтобы файлы
можно было менять независимо. Игра офлайн: чистый HTML/CSS/Canvas, без сборки,
без CDN/npm/сети, без внешних картинок/шрифтов/звуков. Открывается двойным
кликом по `index.html` (`file://`).

> **v2 (оболочка Гефест Arcade).** С волны 2 `index.html` — оболочка на движке v2:
> `engine.js` → `js/music.js` → `js/i18n.js` → `js/game.js` → `js/classic.js` → `js/modern.js`
> + инлайн-скрипт (меню/пауза/темы/язык/счёт — движок; кооп-ввод — движок v2.2 `g.usePlayers` + `g.input.player(i)`).
> `js/audio.js`, `js/ui.js`, `js/main.js`, `css/style.css` используются только старой страницей `legacy.html`,
> для неё §0 и §7 ниже остаются в силе. Раскладка в v2: И1 — стрелки, И2 — WASD (см. README).

## §0 · Структура и порядок загрузки

```
index.html
css/style.css
js/i18n.js      → js/audio.js → js/game.js → js/classic.js
→ js/modern.js  → js/ui.js    → js/main.js
```

`index.html` подключает ровно эти 7 скриптов строго в указанном порядке.
Один `<canvas id="game" width="960" height="600">`.

## §1 · Пространство имён

Классические `<script>` (не ES-модули). Общий глобальный объект:

```js
(function (global) {
  'use strict';
  var R = global.REDUT = global.REDUT || {};
  // ...
})(typeof window !== 'undefined' ? window : globalThis);
```

Никаких `import`/`export`, `fetch`, внешних URL. Комментарии — на русском.
Экспортируемые поля: `R.i18n`, `R.t`, `R.audio`, `R.Game`, `R.consts`,
`R.classic`, `R.modern`, `R.ui`.

## §2 · i18n (`js/i18n.js`)

- `R.i18n = { lang, strings }`, язык по умолчанию `ru` (+ `en`).
- `R.t(key)` → строка текущего языка. Весь UI-текст только через `R.t`.

## §3 · Аудио (`js/audio.js`)

- WebAudio-чиптюн: pulse/square/triangle/sawtooth/sine + шум. Оригинальная
  маршевая мелодия + SFX: `shoot, brick, steel, explode, hit, pickup, life,
  freeze, spawn, gameover, win`. Файлов аудио нет.
- API: `unlock, startMusic, stopMusic, setSound, setMusic, isOn, sfx(name)`.

## §4 · Движок (`js/game.js`) — DOM-free, детерминированный по вводу

- `R.Game({ hi, players, onEvent })` → объект-API. Поле: клетка 40 px,
  сетка 15×15 (600×600). HUD-панель справа. База-редут снизу по центру.
- Методы: `start()`, `update(dt)` (алиас `step`), `state()`, `setPlayers(n)`,
  `setHeld(idx, 'up'|'down'|'left'|'right', bool)`, `fire(idx)`, `pause()`,
  `isPaused()`, `phase()`, `setHi(v)`.
- Фазы: `title · play · levelclear · gameover · win` + пауза.
- `onEvent(type, data)` уведомляет о звуковых событиях и `gameover`/`win`
  (с `{score}`).
- Стадии-волны — массивы строк (`LEVELS`). Легенда: `B` кирпич (рушится по
  четвертям, маска в `brickMask`), `S` сталь, `W` вода, `F` лес, `.` пусто.
  Базу-редут, спауны игроков и врагов код стамповывает поверх карты.
- `state()` отдаёт живой объект состояния (сетка, маска кирпича, игроки,
  враги, пули, усилители, частицы, база, очки, волна, таймеры) — его читают
  рендереры и `main.js`. Движок не трогает DOM.

## §5 · Рендереры

Оба рисуют один и тот же мир каждый кадр через `draw(ctx, state)` и обязаны
корректно работать при неинициализированном состоянии (пустая сетка —
ранний выход, без исключений).

- `js/classic.js` — `R.classic`: честный 8-бит. Внутренний буфер
  половинного разрешения, `imageSmoothingEnabled = false`, апскейл поля,
  ограниченная палитра. Это режим по умолчанию при старте.
- `js/modern.js` — `R.modern`: «неон» — свечение, градиенты.

## §6 · Оверлеи (`js/ui.js`)

`R.ui`: `show(name)`, `hideAll()`, `applyI18n()`, `setMode(n)`,
`setOver(score,hi)`, `setWin(score,hi)`. DOM-оверлеи: `ovTitle, ovPause,
ovOver, ovWin`.

## §7 · Загрузчик (`js/main.js`)

- Boot, цикл `requestAnimationFrame`, ввод по `e.code`. Тело цикла и
  `render()` обёрнуты в `try/catch` — одна ошибка кадра не роняет игру.
- Управление: Игрок 1 — `WASD` + `Space`; Игрок 2 — стрелки + `Slash`
  (в одиночке стрелки/`Slash` отданы Игроку 1); `2` — число игроков;
  `G` графика; `M` звук; `L` язык; `P` пауза; `Enter` — старт/рестарт.
  Экранный D-pad и огонь для телефона (Игрок 1).
- `localStorage` (в `try/catch`): рекорд + язык/звук/графика/игроки.
  **Графика при каждой загрузке принудительно ретро (8-бит).**
- Отладочный хук: `window.__REDUT = { startGame, setGfx, setLang,
  setPlayers, tick, game }`.

## §8 · Качество

Запускается без ошибок в консоли: заставка → бой (ход, стрельба, разрушение
кирпича, убийство врага, подбор усилителя) → зачистка волны → следующая
волна → потеря базы/жизней → game over → рестарт; все волны отбиты →
победа. Оба режима графики рисуют полную сцену. Канва масштабируется под
экран (мобильная вёрстка). Тесты: `node redut/tests/engine.test.mjs`
и `node redut/tests/verify.mjs`.
