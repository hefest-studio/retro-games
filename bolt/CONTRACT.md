# CONTRACT · БОЛТ

Технический контракт игры. Все модули соблюдают его дословно, чтобы файлы
можно было менять независимо. Игра офлайн: чистый HTML/CSS/Canvas, без сборки,
без CDN/npm/сети, без внешних картинок/шрифтов/звуков. Открывается двойным
кликом по `index.html` (`file://`).

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
  var B = global.BOLT = global.BOLT || {};
  // ...
})(typeof window !== 'undefined' ? window : globalThis);
```

Никаких `import`/`export`, `fetch`, внешних URL. Комментарии — на русском.

Экспортируемые поля: `B.i18n`, `B.t`, `B.audio`, `B.Game`, `B.consts`,
`B.classic`, `B.modern`, `B.ui`.

## §2 · i18n (`js/i18n.js`)

- `B.i18n = { lang, strings }`, язык по умолчанию `ru` (+ `en`).
- `B.t(key)` → строка текущего языка. Весь UI-текст только через `B.t`,
  в рендерерах нет захардкоженных строк.

## §3 · Аудио (`js/audio.js`)

- WebAudio-чиптюн: pulse/square/triangle/sawtooth + шум. Оригинальная
  короткая мелодия + SFX: `jump, shoot, hit, explode, pickup, battery,
  door, hurt, gameover, win`. Файлов аудио нет.
- API: `unlock, startMusic, stopMusic, setSound, setMusic, isOn, sfx(name)`.

## §4 · Движок (`js/game.js`) — DOM-free, детерминированный

- `B.Game({ hi, onEvent })` → объект-API. Мир: клетка 30 px, 20 рядов,
  видимая область 960×600, камера скроллит по горизонтали.
- Методы: `start()`, `update(dt)` (алиас `step`), `state()`,
  `setHeld('left'|'right', bool)`, `jump()`, `shoot()`, `pause()`,
  `isPaused()`, `phase()`, `setHi(v)`.
- Фазы: `title · play · dying · levelclear · gameover · win` + пауза.
- `onEvent(type, data)` уведомляет о звуковых событиях и
  `gameover`/`win` (с `{score}`).
- Уровни — массивы строк (`LEVELS`). Легенда: `#` кирпич, `=` платформа,
  `P` старт, `W` ходок, `F` летун, `o` очко, `b` батарея, `D` дверь выхода.
- `state()` отдаёт живой объект состояния (сетка, игрок, пули, враги,
  пикапы, частицы, дверь, камера, заряд, очки, жизни и т. д.) — его читают
  рендереры и `main.js`. Движок не трогает DOM.

## §5 · Рендереры

Оба рисуют один и тот же мир каждый кадр через `draw(ctx, state)`.

- `js/classic.js` — `B.classic`: честный 8-бит. Внутренний буфер
  половинного разрешения, `imageSmoothingEnabled = false`, апскейл,
  ограниченная палитра. Это режим по умолчанию при старте.
- `js/modern.js` — `B.modern`: «неон» — свечение, градиенты, параллакс.

## §6 · Оверлеи (`js/ui.js`)

`B.ui`: `show(name)`, `hideAll()`, `applyI18n()`, `setOver(score,hi)`,
`setWin(score,hi)`. DOM-оверлеи: `ovTitle, ovPause, ovOver, ovWin`.

## §7 · Загрузчик (`js/main.js`)

- Boot, цикл `requestAnimationFrame`, ввод по `e.code`.
- Управление: `←→`/`A D` — бег; `Space`/`↑`/`W` — прыжок;
  `J`/`X` — выстрел; `G` — графика; `M` — звук; `L` — язык;
  `P` — пауза; `Enter` — старт/рестарт. Экранные кнопки для телефона.
- `localStorage` (в `try/catch`): рекорд + настройки языка/звука/графики.
  **Графика при каждой загрузке принудительно ретро (8-бит).**
- Отладочный хук: `window.__BOLT = { startGame, setGfx, setLang, tick, game }`.

## §8 · Качество

Запускается без ошибок в консоли: заголовок → игра (бег/прыжок/стрельба,
убийство врага) → дверь → следующий сектор → потеря всех жизней → game over
→ рестарт; прохождение всех секторов → победа. Оба режима графики рисуют
полную сцену. Канва масштабируется под экран (мобильная вёрстка).
