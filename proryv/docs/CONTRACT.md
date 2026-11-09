# EXOLON HTML5 — контракт модулей

Порт аркады **Exolon** (Hewson, 1987, Raffaele Cecco) в один HTML-файл.
Внутреннее разрешение мира — **256×192** (поле 32×24 тайла по 8 px) + полоса HUD 16 px
снизу (итого логический экран 256×208). Вся графика и звук генерируются кодом,
внешних файлов нет.

## Сборка

```bash
node exolon/tools/build.mjs          # src/*.js + src/style.css -> exolon/index.html
```

`index.html` — **итоговый артефакт, его собирает только Lead**. Исходники — в `exolon/src/`.

Порядок подключения скриптов (важен, всё живёт в общем глобале):

1. `font.js`   → `window.EX_FONT`
2. `i18n.js`   → `window.EX_I18N`, `window.EX_T`
3. `audio.js`  → `window.EX_AUDIO`
4. `levels.js` → `window.EX_LEVELS`
5. `game.js`   → `window.EX` (состояние, физика, логика, ввод)
6. `render-retro.js`  → `window.EX_RENDER_RETRO`
7. `render-modern.js` → `window.EX_RENDER_MODERN`
8. `main.js`   → загрузка, rAF-цикл, масштабирование, оболочка страницы

Каждый файл оборачивается в IIFE и ничего не пишет в глобал, кроме своего неймспейса.
Только ES2019-совместимый синтаксис, никаких `import/export`, `type="module"`,
top-level await, внешних библиотек и шрифтов. Всё должно работать по `file://`
двойным щелчком по `index.html`.

## Владение файлами

| Файл | Владелец |
|---|---|
| `src/font.js` | font-агент |
| `src/audio.js` | music-агент |
| `src/levels.js` | levels-агент |
| остальные `src/*`, `src/style.css`, `src/template.html`, `tools/*` | Lead |

Не редактируйте чужие файлы и не пересобирайте `index.html` — сообщите Lead.

## Проверка

```bash
node --check exolon/src/<файл>.js       # синтаксис
node exolon/tools/probe.mjs <url> out.png   # headless Chrome: скриншот + ошибки консоли
```

`probe.mjs` печатает `⚠ JS exception` / `⚠ console:` при ошибках. Ставьте свою
тестовую страницу в `exolon/tmp/` (каталог не попадает в артефакт).

---

## 1. `window.EX_FONT` — битмап-шрифт 6×8

```js
window.EX_FONT = {
  W: 6, H: 8,            // ширина знакоместа и высота
  glyphs: { ... },       // { 'A': [b0..b7], ... }  — по одному байту на строку
  has(ch),               // boolean
  glyph(ch)              // массив из 8 байт; для отсутствующего символа — '?'
};
```

* Байт строки: **бит 5 = левый пиксель**, бит 0 = правый (6 колонок).
  Пиксель (x,y) закрашен, если `(row & (1 << (5 - x))) !== 0`.
* Обязательный набор: ASCII 32–126, `А–Я`, `а–я`, `Ё ё`, `«» „“ ” — – … № ° · •`,
  `← → ↑ ↓`, `█ ♥ ★ ☆ ► ◄ ▲ ▼ × ✓`.
* Нижний ряд (`b7`) обычно пустой — межстрочный зазор; выносные элементы
  (`у`, `р`, `ц`, `д`, `щ`, `ф`) занимают `b6–b7` аккуратно, без обрезки.
* Стиль: плотный пиксельный, как у ZX Spectrum; строчные на 5 px высоты,
  заглавные — 7 px. Дизайн согласованный: одинаковая толщина штриха 1 px.
* Доказательство: тестовая страница `exolon/tmp/font-proof.html` со всем набором
  (по 3 размера: 1×, 2×, 3×) и скриншот `exolon/reports/font-proof.png`.
  Обязательно прочитать скриншот глазами и исправить кривые глифы.

## 2. `window.EX_AUDIO` — 8-битный звук

```js
window.EX_AUDIO = {
  init(),                      // создать/поднять AudioContext (лениво, безопасно многократно)
  unlock(),                    // вызвать по первому жесту пользователя
  ready(),                     // boolean
  setMusic(on), setSfx(on), setVolume(v),   // v: 0..1
  music, sfx,                  // boolean-геттеры текущих настроек
  playMusic(id),               // 'title'|'game'|'exo'|'final'|'clear'|'gameover'|'win', кроссфейд ~0.4 c
  stopMusic(),
  sfx(id),                     // см. список ниже; вызов до init() — тихий no-op
  duck(on),                    // приглушить музыку (например, на паузе)
  setIntensity(x)              // 0..1, необязательный «слой напряжения» для 'game'
};
```

SFX id: `laser, grenade, explosion, bigexpl, hit, death, pickup, powerup, teleport,
jump, land, exo, menu, select, deny, alarm, missile, crusher, clear, gameover, win`.

Требования:

* Только WebAudio-синтез (Square/Saw/Triangle/Noise буферы), без сэмплов.
* Секвенсор с lookahead-планированием (`setInterval` 25 мс + планирование на 0.12 с
  вперёд), точные `AudioContext.currentTime`; цикл бесшовный.
* Оригинальная чиптюн-музыка (не копии чужих мелодий): цепляющий хук, 4 канала
  (2 pulse + triangle-бас + noise-ударные), 140–160 BPM, длины циклов 16–32 такта,
  лёгкая вариативность (fill/арпеджио) чтобы не приедалось.
* `playMusic('game')` — основной трек; `setIntensity` меняет плотность/фильтр.
* Уважать mute: `setMusic(false)` → тишина, но состояние запоминается.
* Не падать, если `AudioContext` недоступен/приостановлен (headless, file://).
* Доказательство: `exolon/tmp/audio-proof.html` с кнопками всех треков/эффектов,
  скриншот + отсутствие ошибок в консоли; `EX_AUDIO.ready() === true` после `unlock()`.

## 3. `window.EX_LEVELS` — данные уровней

См. `exolon/docs/LEVELS.md`. Формат: массив из 5 уровней, в каждом 5 экранов.

## 4. `window.EX` — состояние игры (для справки, пишет Lead)

```js
EX.settings   // {lang:'ru'|'en', gfx:'retro'|'modern', music:bool, sfx:bool, crt:bool}
              // gfx по умолчанию RETRO и не сохраняется между сессиями (см. README)
EX.t(key, vars) // локализация: EX_T
EX.state = {
  mode,            // 'title'|'help'|'settings'|'briefing'|'play'|'paused'|
                   // 'dead'|'bonus'|'levelclear'|'gameover'|'win'|'about'
  level, screen,   // индексы 0..4
  lives, score, record, levelStartScore, woreExo,
  player: {x,y,w,h,vx,vy,onGround,facing,duck,exo,armor,laser,rockets,
           invuln,alive,anim,jet},
  ents: [{t,x,y,w,h,dir,hp,dead,anim,timer,...}],
  shots, enemyShots, particles, fx,   // массивы
  world: {tiles: Uint8Array, cols, rows, theme},
  bonus: {values, index, timer, chosen},
  message: {key, vars, t},
  t                  // общее время игры, секунды
}
EX.input  // {left,right,up,down,fire,firePressed,fireReleased,pause,...}
```

Рендереры читают `EX.state` и рисуют **в мировых координатах 256×208**
(поле + HUD), масштаб задаёт `main.js` через `ctx.setTransform`.

## 5. Оболочка и переключения (реализует Lead)

| Клавиша | Действие |
|---|---|
| `← →` / `A D` | идти |
| `↑` / `W` | прыжок |
| `↓` / `S` | присесть / войти в телепорт |
| `Space` / `Z` | огонь: клик — бластер, удержание >0.22 c — граната |
| `Esc` / `P` | пауза |
| `Enter` | подтвердить / старт |
| `L` | язык RU/EN |
| `G` | графика: RETRO (ZX) / MODERN (neon) |
| `M` | музыка вкл/выкл |
| `N` | звуковые эффекты вкл/выкл |
| `F` | полный экран |
| `R` | заново (из паузы/после смерти) |

Настройки и рекорд — в `localStorage` (`exolon.*`); `gfx` намеренно не сохраняется —
при каждом запуске игра открывается в RETRO.
