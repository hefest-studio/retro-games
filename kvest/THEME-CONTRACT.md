# Контракт «КВЕСТ»: формат сцен и API оформления (координатор, 14.11.2026)

Цель: пилот рисованного приключения без слов (point-and-click) делается **без финального оформления**. Оформление выбирает владелец из двух прототипов:
- **«бумага»** — аппликация из вырезанной бумаги;
- **«тушь»** — гравюра / лубок тушью.

Чтобы потом «натянуть» выбранный стиль на пилот без переделки логики, пилот и прототипы работают через **один формат сцен** и **одно API темы**.

## Где что лежит (репо `/home/claude/retro-games`, ветка `proto/kvest`)
- `kvest/` — пилот (игра). Содержит `js/scenes.js` (данные сцен), `js/game.js` (логика), `js/themes/grey.js` (временное «серое» оформление), `js/theme-api.js` (описание API, общая валидация).
- `_proto/style-paper/` и `_proto/style-ink/` — прототипы оформления. Каждый — самостоятельная `index.html` + `theme.js` (реализация API) + одна-две демонстрационные сцены **в том же формате**.
- `_proto/shared/demo-scene.js` — общая демо-сцена для обоих прототипов (одинаковая композиция, чтобы сравнивать стили честно).
- Файл темы прототипа потом копируется в `kvest/js/themes/<имя>.js` и подключается вместо `grey.js`.

## Формат сцены (обычный JS-объект, без функций — чтобы его можно было сериализовать)
```js
{
  id: 'yard',                       // уникальный id
  w: 960, h: 540,                   // логический размер сцены (одинаковый для всех сцен)
  mood: 'dawn',                     // настроение: dawn | day | dusk | night | cave | indoor (тема подбирает палитру)
  layers: [                         // от дальнего к ближнему, depth 0..3
    { depth: 0, items: [ { kind: 'sky' }, { kind: 'hill', x: 0, y: 300, w: 960, h: 240, seed: 3 } ] },
    { depth: 1, items: [ { kind: 'house', x: 120, y: 200, w: 220, h: 220, seed: 7, state: { windowLit: true } } ] },
    { depth: 2, items: [ { kind: 'ground', x: 0, y: 440, w: 960, h: 100 } ] },
    { depth: 3, items: [ { kind: 'plant', x: 900, y: 420, w: 60, h: 120, seed: 1 } ] }
  ],
  objects: [                         // интерактивные объекты (рисует тема по kind + state)
    { id: 'gate', kind: 'gate', x: 600, y: 300, w: 120, h: 150, state: { open: false } },
    { id: 'key', kind: 'item', item: 'key', x: 300, y: 470, w: 30, h: 20, state: { taken: false } }
  ],
  hotspots: [                        // кликабельные зоны (логика; тема их не рисует, только курсор)
    { id: 'gate', rect: [600, 300, 120, 150], cursor: 'use' },   // cursor: use | take | go | look
    { id: 'toLeft', rect: [0, 380, 40, 160], cursor: 'go', to: 'street' }
  ],
  walk: [[40, 470], [920, 470]],     // полилиния/полоса, по которой ходит герой (y — линия ног)
  hero: { x: 200, y: 470 }           // стартовая позиция при входе
}
```
**Словарь `kind` (минимум, который обязана уметь каждая тема):**
- окружение: `sky`, `hill`, `ground`, `house`, `tower`, `tree`, `plant`, `rock`, `water`, `bridge`, `fence`, `pipe`, `lamp`, `wall`, `floor`, `window`, `cloud`, `moon`;
- объекты: `door`, `gate`, `lever`, `box`, `machine`, `item`, `npc`.

Неизвестный `kind` тема рисует нейтральным прямоугольником (не падает). Новые `kind` добавлять в `kvest/js/theme-api.js` (список + краткое описание) и в обе темы прототипов, если они ещё работают.

## API темы
```js
window.KvestTheme = {
  id: 'grey' | 'paper' | 'ink',
  name: { ru: '…', en: '…' },
  drawScene(ctx, scene, t, opts),        // фон + все layers + objects (по их state)
  drawHero(ctx, hero, pose, t),          // hero: {x, y, dir}; pose: 'idle' | 'walk' | 'reach' | 'think' | 'happy'
  drawNpc(ctx, npc, pose, t),            // если npc рисуются отдельно
  drawThought(ctx, x, y, icons, t),      // пузырь-мысль с пиктограммами (сюжет БЕЗ текста); icons — массив id пиктограмм
  drawIcon(ctx, id, x, y, size),         // пиктограмма: предметы инвентаря и мысли (key, gear, cup, star, bird, note, door, lamp, fish, flower, …)
  drawCursor(ctx, kind, x, y),           // use | take | go | look
  drawUI(ctx, state, t)                  // полоса инвентаря, кнопка подсказки и т.п.
};
```
**Необязательные хуки (расширение 14.11: подсказки и набросок тушью).** Игра остаётся в оформлении темы, а то, что
*объясняет*, рисуется эскизом: мастер объясняет задачу, рисуя тушью; героиня ведёт блокнот. Оболочка зовёт хук, только если он есть:
```js
drawHint(ctx, x, y, hint, t, opts),     // мысль-подсказка; hint = { target, scene, here, icons, ink }; opts.age — сек. с появления
drawWalkbook(ctx, walk, layout, t),     // блокнот: walk = { page, pages, per, steps (пройденные + текущий), flip, open, time }
drawThought(ctx, x, y, icons, t, opts)  // opts.style: 'paper' | 'ink' (мастер в кат-сценах), opts.age
```
Эскиз цели — данные `puzzles[].ink` (глифы: `{ i }` пиктограмма, `{ o: 'сцена/объект', st }`, `{ l: 'сцена/kind' }`, `{ g: [...] }`;
`mark` — цель (акцент киноварью), `n` — порядковый номер; знаки `'>' '+' '=' 'up'`). Реализация для «бумаги» —
`kvest/js/themes/ink-sketch.js` (подключается после темы и вешает хуки на неё). Настройка «Анимация штриха» (меню и пауза)
хранится в `localStorage['arcade.kvest.inkAnim']`; выкл — штрих статичен, перо не анимируется.

**Необязательно (спринт 0, HiDPI):** `setResolution(s)` — масштаб кэшей темы (оболочка зовёт при смене размера канвы), `setQuality('high'|'low')` — облегчённые эффекты, `setCacheBudget(px)`, `cacheStats()`. Тема без них работает в масштабе 1.

**Расширение 15.11 (спринт 1, движок глав).** Модель сцены дополнительно несёт `scene.pal` (имя палитры сцены — тема может игнорировать),
`scene.phase` / `scene.phaseMix` (текущее из двух состояний сцены и плавный уровень 0..1 — по нему kind `tide` рисует воду), `scene.map` (это карта).
Новые kind (тема без них рисует нейтральный прямоугольник; описания и состояния — в `theme-api.js`): `tide` (море с приливом/отливом;
`state.at` — уровень по флагу, без анимации), `mapsheet`, `trail`, `mapnode`, `maptoken` (карта), `beacon` (сигнальный огонь: hearth | chimney | brazier),
`saltpan` (settle | boil), `sluice`, `boat`, `tidepost`. Новые состояния: `machine.variant` clockwork | gear | reflector, `npc.type` fisher | dog | crab,
`fence.state.rack` (+ `weed`), `house.state.fish | salt | smoke`, `window.state.dawn`, `gate.state.icon`. Пиктограммы движка глав — `js/themes/icons-ext.js`
(общая геометрия; тема передаёт свои примитивы и цвета).

**Расширение 15.11 (спринт 2, движок помощников).** Модель кадра: `model.party` — отряд в сцене `[{ id: 'taya' | 'dog' | 'gull', x, y, dir, alt, pose, active, hold }]`
(оболочка рисует Таю через `drawHero`, помощников — через хук `drawHelper(ctx, p, pose, t)`, без хука — `drawNpc` с `state.type`), `model.trail` (нюх пса) и
`model.overview` (взгляд сверху чайки) — хуки `drawTrail(ctx, trail, t)` и `drawOverview(ctx, ov, t)`; `ui.heroes` — портреты (рисует `drawUI` в `LAYOUT.heroes`),
необязательный `drawActiveMark(ctx, p, t)` — метка активного героя. Позы помощников — `ThemeAPI.HELPER_POSES`. Новые kind: `windmill`, `vane`, `millstone`, `millgear`,
`telescope`, `shutter`, `mound`, `crate`, `nest`, `burrow`, `bollard`, `ropebridge`; новые состояния: `npc.type` tern, `tower.state.dome`, `house.state.glass`,
`wall.state.dome`, `gate.state.grille`; `state.still` у мельницы/жернова/передачи — живые части в статичном спрайте (эскизы тушью). Реализация «бумаги» — `js/themes/paper-helpers.js`
(через `paper._ext`), серого макета — в `grey.js`; `validateTheme` проверяет новые хуки, если они есть.

**Расширение 19.11 (спринт 3, подводные механики).** Модель кадра: `model.water` — `null` на суше, под водой (`scene.water`)
`{ murk, vis, hero: {x, y}, fade 0..1, air: { left, max, f 0..1, low, pocket, bubbles }, pockets: [{ id, x, w }], sounds: [{ id, x, y, note 0..4, big, harsh, active, age, n, near 0..1, pan −1..1 }], time }`.
Оболочка зовёт необязательный хук `drawWater(ctx, model.water, t)` после отряда и до мыслей: **муть** (всё, кроме круга `vis` вокруг героини; активные
карманы воздуха помечаются сквозь муть), **кольца звона** от источников (`age` — секунды с удара; обязательны — это визуальный дубль звука: карточка
с `note + 1` точками, `near` — толщина, `harsh` — «колючее» кольцо), **шкала воздуха** в `LAYOUT.air` — `n` пузырьков без цифр (`f` — доля, `low` —
предупреждение, `pocket` — героиня дышит), затемнение `fade` (мягкий возврат). Портрет Таи под водой несёт `ability: 'ear'`; помощник, которого
вода не пускает, — `allowed: false`, `where: 'water'`. Новые kind: `divebell` (`under`, `down`, `knot`, `ballast`, `rope`), `seabell` (`note`, `ring`,
`sunk`, `great`, `empty`), `kelp` (`cut`), `airpocket` (`variant` boat | vent | dome, `on`), `buoy` (`bell`, `set`), `arch` (`open`, `chain`, `kelp`),
`crane` (`knot`, `held`), `ruin` (`variant` wall | house | column, `far`, `door`, `kelp`), `whale` (`near`, `eye`, `hook`, `sing`, `calm`); палитры сцен
(`scene.pal`): `baypier`, `seabed`, `murk`, `deep`, `foundry`; пиктограммы `ear`, `air`, `divebell`, `seabell`, `buoy`, `buoybell`, `chain`, `kelp`, `belfry`,
`pier`, `ruin`, `murk`. Реализация «бумаги» — `js/themes/paper-water.js`, серого макета — в `grey.js`; `validateTheme` проверяет `drawWater`, если он есть.

`ctx` — 2D-контекст канвы, масштабированный под логический размер 960×540 (физически — × масштаб HiDPI). Тема **не меняет** состояние игры, только рисует. Анимации — только от `t` (секунды) и `seed`.

## Правила
- Правило имён и узнаваемости из брифа аркады. **Особо:** не повторять облик известных point-and-click игр-ориентиров — без маленького робота в ржавом городе, без анимированных круглых мысле-пузырей «как у них», без вытягивающегося корпуса героя. Студию-ориентир и её игры не называть нигде в репо.
- Никаких внешних ресурсов: только canvas, процедурные текстуры (шум бумаги, штриховка), шрифты системные.
- RU/EN для интерфейса меню; в самой игре текста нет.
