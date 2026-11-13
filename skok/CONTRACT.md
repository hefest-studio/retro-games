# СКОК — контракт модулей

Игра аркады «Гефест» на фреймворке Гефест Arcade v2.2 (`engine.js`). Общий стандарт: офлайн, `file://`, без внешних
URL/шрифтов/ассетов, RU/EN, темы modern/retro (меняют только отрисовку), WebAudio-звук, рекорд в `localStorage`
(`arcade.best.skok`), прогресс — `arcade.save.skok`.
Права: название, герой (лис-лудильщик Скок), враги (шестерёнка-катун, заводная мышь, пружинник, игольник, флюгерник,
давильный молот), хозяева крепостей (Ржавый Сторож, Котельный Барон, Флюгерный Граф, Великий Маятник), края, уровни,
костюмы, мини-игры, арт, палитры, звуки и музыка — оригинальные; чужих имён нет (тест «правило имён», стоп-лист в base64).

## js/levels.js — `SKOK.levels`, `SKOK.MAP`
Клетка `T = 16`, высота уровня `H = 18` рядов (экран 288 px). Уровень собирается из кусков `CH` (ASCII, выравнивание
по низу; у крепостей пустота сверху — камень). Коды: `.` воздух, `#` земля, `=` камень, `T` доска (сверху), `/` `\` склоны
(под ними твердь), `^` шипы (твердь, верх колет), `~` смола, `B` ящик-гайка, `M` ящик-россыпь (6), `*` ящик с костюмом
(`suits` уровня по порядку), `L` ящик-жизнь, `u` пустой ящик, `x` хрупкий короб; предметы `o` гайка, `K` ключ;
`D` тайная дверь, `@` старт, `E` столб-часовня, `C` фонарь; враги `g m h n v P Z` (по краю `SWAP` подменяет `g`/`m`).
`build(id)` → `LV = { id, r, n, fort, ambush, key, boss, w, h, t: [строки], items[{id,k,tx,ty}], enemies[{k,tx,ty}],
crates{idx:{k,n|suit}}, camps[{id,tx,ty}], start, exit|null, door|null, arenaX }`.
`LEVELS` — 28: `<край>-1..5`, `<край>-F` (крепость; `boss: rust|boiler|vane|pendulum`), `<край>-A` (стычка с бродягой).
`MAP`: `NODES[{id,r,k,x,y,gx,kind:'level'|'fort'|'shop'|'lever'}]` (по 8 на край: 1–5, F, S — лавка, R — рычаг),
`EDGES[{a,b,secret}]` (secret — из уровня с ключом к R; открывается тайным выходом), `FIRST`, `FINAL`, `node(id)`,
`done(p,id)` (уровни — `cleared`, мини-игры — `played`), `edgeOpen`, `isOpen(p,id)`, `neighbors(p,id)`, `roam(r)`.

## js/game.js — `SKOK.Game(opts)`, `SKOK.logic`, `SKOK.mini` (без DOM, детерминирована при заданном `rng`)
`opts`: `{ rng, onEvent(type,data), god (тесты: без урона) }`.
API: `startLevel(id, carry?)` (`carry = { lives, nuts, score, suit, suitHp }`) · `update(dt)` (шаг 1/60) ·
`setInput(dx, dy, jump)` (dy < 0 — вверх, > 0 — вниз; jump — кнопка зажата) · `fire()` · `carry()` · `state()` → S.
Тестовые хуки: `_place(tx,ty)`, `_hurt(why,x)`, `_die(why)`, `_bump(tx,ty)`.
`S`: `score, lives, nuts, phase('play'|'dead'|'clear'|'over'|'idle'), phaseT, time, id, LV, W, hero, enemies[], got{},
pickups[], rivets[], bolts[], cp, keyGot, boss, kills, deaths, bell{x,gy,y}, ring, secret`.
Герой: `{ x, y (подошвы), vx, vy, ground, face, low, slide, coyote, buf, ramp, pound, glide, suit, suitHp, inv, slopeDir, under, combo }`.

**Физика** — `logic.heroStep(W, P, inp, dt, ev)` (одна для игры и графа проходимости):
g = 1400, падение ≤ 480 (панцирь 600, удар 620, зонтик 66); прыжок 430 + 60·(скорость/бег) (башмаки ×1,22), отпустил —
срез до −150; койот 0,08, буфер 0,12; шаг 90, бег 150 после 0,45 с на скорости шага; разгон 620, торм. 800, разворот 1700,
в воздухе 560. Склоны — поверхность по центру героя, прилипание ±8 px, «ступенька» 7 px; подкат по склону — разгон 520
до 240, на ровном торможение 260. Подшаги ≤ 4 px. `logic.hazard(LV,P)` → `'spike'|'tar'|'fall'|null`.

**Правила**: прыжок на врага сверху — сбит, отскок 300 (с удержанием 440), серия `PTS.combo`; игольник сверху колет
(кроме панциря); подкат и удар панцирем сбивают; заклёпки (фартук): 230 px/с, прыгают по земле, ≤ 2, сбивают врагов,
ломают `x`; хозяину — 3 заклёпки = 1 удар. Удар: костюм снимается (фартук — со 2-го раза), неуязвимость 1,5 с; без
костюма — минус жизнь и переигровка с фонаря (собранное остаётся собранным). 100 гаек = жизнь. Колокол: высота
→ `PTS.bell` [100…5000]. Тайная дверь: ключ + ↑ у двери. Хозяева: здоровье 3/4/4/5, просыпаются на арене.
Очки: гайка 10, ящик 20, костюм 1000, ключ 500, заклёпкой 100, подкатом/ударом 200, тайный выход 1000, хозяин 5000, стычка 2000.

События `onEvent`: `level{id,boss,ambush,respawn}`, `jump`, `land`, `slide`, `pound`, `quake`, `stomp{combo}`, `kill{k,how,pts}`,
`nut`, `crate{k,suit}`, `bonk`, `suit{suit}`, `unsuit`, `hurt{why}`, `die{why}`, `respawn`, `gameover{score}`, `life`, `key`,
`camp`, `fire`, `fizz`, `break`, `squeak`, `boing`, `thud`, `chip`, `bossIntro{k}`, `bossLeap`, `bossHit{hp}`, `bossDown`,
`bell{tier,pts,hit}`, `door`, `ambushWon`, `clear{id,secret,boss,ambush,pts,tier,bell,key}`.

`SKOK.mini`: `shop(rng)` → 3 приза `{k:'suit',suit}|{k:'life'}|{k:'nuts',n:20}`; `lever(rng)` → `{n:4, good, tries:2, pulled}`;
`pull(G,i)` → `'win'|'miss'|'lose'|null`; `apply(carry, prize)`.
`SKOK.logic`: `T, K, PTS, SUITS, tileAt, setTile, isSolid, isCrate, isSlope, slopeAt, slopeS, tilePx, support, heroStep, newHero,
heightOf, canStand, hazard, moveX, moveY, settle, mulberry32, wanderStep(MAP,p,r,rng,heroAt) → 'moved'|'meet'|null, BOSSDEF, EDEF`.

## js/save.js — `SKOK.save`
`KEY = 'arcade.save.skok'`, `OLD = 'arcade.skok.map'`, `VER = 2`, `LIVES = 5`. `blank()`, `migrate(o)` (v1 `{done,doors,node,lives,nuts}`
→ v2; неизвестные id отбрасываются; тайный выход без прохождения — тоже; закрытый `at` → `'1-1'`; будущая версия → null),
`parse(raw)`, `serialize(p)`, `store(ls)` → `{ load(), save(p), reset() }` (переносит старый ключ и удаляет его),
`apply(p, id, {secret})` (стычка — бродяга `dead`), `stats(p)`.

## js/render.js — `SKOK.renderLevel(g, ctx, S, ui)`, `SKOK.renderMap(g, ctx, M)`, `SKOK.renderShop/renderLever(g, ctx, G)`, `SKOK.R`
Экран 512×288. `ui = { cam, toasts, banner, msg, runPh }`. Статичный слой клеток (с верёвками висячих ящиков) кэшируется
в offscreen-canvas по (уровень, ревизия клеток, тема); смола, предметы, враги, часовня — каждый кадр.
`M = { prog, sel, pos, moving, fresh, note, face, lives, nuts, suit, region }`. `R.hero/enemy/boss/nut/chest/chapel/crateTile/background/FX`.

## main.js
Сцены движка (`useStandardScreens`), титул перерисован; в меню — «Сбросить карту» (двойное подтверждение), в паузе —
«На карту». `play`: режимы `map` ↔ `level` ↔ `shop` ↔ `lever`; итог уровня → карта (финал 4-F — `g.win()`), шаг бродяги,
встреча → стычка. Музыка: карта/уровень/крепость/мини-игры через `g.setMusic`. Доп. клавиши: прыжок Z/K, заклёпки X/J;
тач `#bFire`, `#bPause`. `SKOK.app = { g, game(), mode(), prog(), enterLevel(id), enterNode(id), toMap(id), ui, M, G() }` — для отладки.

## tests
`engine.test.mjs` — см. README; `bot.mjs` — `navFor(SK, LV, suit)` (ленивый граф проходимости по настоящей физике),
`passability(SK, LV, suit)` → `{ exit, key, door }`, `playLevel(SK, id, seed)` («человеческий» бот: реакция 150–250 мс,
разброс нажатий, иногда не замечает врага; путь — по графу под текущий костюм).
