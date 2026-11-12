# СТАРАТЕЛЬ — контракт модулей (v2, «Обвал в шахте»)

Игра офлайн: HTML/CSS/Canvas без сборки, CDN и сети.

## Порядок загрузки (`index.html`)

`engine.js` → `js/music.js` → `js/mine.js` → `js/mine-sprites.js` → `js/mine-retro.js` → `js/mine-modern.js` → инлайн-оболочка.

## `js/mine.js` — логика (DOM-free)

- Пространство имён `window.STARATEL`.
- `STARATEL.Game({ onEvent, random })` → `{ state, start(), update(dtMs), move(dx, dy) }`.
- `STARATEL.T` — константы: `N` (15), `TS`, коды клеток `WALL/DIRT/EMPTY/BOULDER/GOLD/GEM/EXIT`, `STEP` (165 мс).
- Звук/HUD — через `onEvent(type, data)`; оболочка превращает события в SFX движка.

## Рендеры

- `STARATEL` retro (`js/mine-retro.js`, спрайты `js/mine-sprites.js`) и modern (`js/mine-modern.js`)
  только читают `state`, логику не меняют.

## Хранилище

Рекорд — `arcade.best.staratel` (движок). Язык/тема/звук — общие ключи движка `arcade.*`.

## `legacy.html`

Прежняя страница «Обвала» — самостоятельная (весь код инлайн), внешних файлов папки не использует.

## Тесты

`node staratel/tests/engine.test.mjs` — логика, трек музыки, оболочка (порядок скриптов, DOM-HUD, legacy.html).
