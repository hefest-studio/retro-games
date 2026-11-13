# ЛЕДНИК — контракт модулей

Игра аркады «Гефест» на фреймворке Гефест Arcade v2.2 (`engine.js`). Общий стандарт: офлайн, `file://`, без внешних
URL/шрифтов/ассетов, RU/EN, темы modern/retro (меняют только отрисовку), WebAudio-звук, рекорд в `localStorage`
(`arcade.best.lednik`), прогресс карты — `arcade.save.lednik`.
Права: название, герои (охотница Искра, песец Бураш), враги (саблезубый котёнок, ледяной жук, мамонтёнок), вожаки
(Старый Клык, Хрусть, Вьюжный Филин), края, уровни, арт, палитры, звуки и музыка — оригинальные; чужих имён нет
(тест «правило имён», стоп-лист в base64).

## js/levels.js — `LEDNIK.levels`, `LEDNIK.MAP`
Клетка `T = 16`, высота уровня `H = 18` рядов (ровно экран 288 px). Уровень собирается из кусков `CH` (ASCII, выравнивание
по низу) слева направо. Коды: `.` воздух, `#` земля, `=` лёд, `T` уступ (сверху), `-` ледяной мост (сверху, ломается),
`~` вода, `^` шипы, `|` сосулька-столб, `%` щель (герою — стена, песцу — проход), `s` сугроб; предметы `f h k ?`
(припасы; `?` — спрятан в сугробе), `K`/`Q` ключ (Q — карман: ключ, если у уровня `key`, иначе кремень), `+` сердце,
`C` костёр, `E` стойбище, `@` старт; враги `c b m`. `META[кусок].wind` — зоны ветра `[x0, x1, dir, период, доля порыва]`.
`build(id)` → `LV = { id, r, n, boss, secret, keyId, w, h, t: [строки], items[{id,k,tx,ty,hidden}], enemies[{k,tx,ty}],
camps[{id,tx,ty}], start{tx,ty}, exit{tx,ty}|null, wind[{x0,x1,dir,period,on,phase}], total, need }` (`need = ⌈0,7·total⌉`).
`LEVELS` — 18 уровней: `<край>-1..4`, `<край>-S` (тайник), `<край>-B` (вожак: `fang|shell|owl`).
`MAP`: `NODES[{id,x,y}]`, `EDGES[{a,b,key}]` (key — тайная тропа), `FIRST`, `FINAL`, `isOpen(p,id)`, `edgeOpen(p,e)`,
`neighbors(p,id)`; `p = { cleared:{id:1}, keys:{k1:1} }`. Узел открыт, если есть ребро a→id с пройденным a (и ключом).

## js/game.js — `LEDNIK.Game(opts)`, `LEDNIK.logic` (без DOM, детерминирована при заданном `rng`)
`opts`: `{ rng, onEvent(type,data), god (тесты: без урона) }`.
API: `newRun()` · `startLevel(id, carry?)` · `update(dt)` (шаг 1/60) · `setInput(dx, dy, jump)` (dy < 0 — вверх, > 0 — вниз;
jump — кнопка зажата) · `throwBoom()` · `callFox()` · `state()` → S. Тестовые хуки: `_place(tx,ty)`, `_hurt(fromX)`,
`_die(why)`, `_clear()`, `_collect(item)`.
`S`: `score, lives, hearts, phase('play'|'dead'|'clear'|'over'|'idle'), phaseT, time, id, LV, W{LV,br,time,wind,gust}, hero,
got{}, revealed{}, sup, keyGot, cp, lit{}, br{tileIdx:{c,b,touched}}, boom, fox, foxCd, enemies[], boss, shots[], kills, deaths, full`.
Герой: `{ x, y (подошвы), vx, vy, ground, ice, drift, face, low, slide, climb, coyote, buf, inv, airMax, windV }`.

**Физика** — `logic.heroStep(W, P, inp, dt, ev)` (одна для игры и графа проходимости):
g = 1500, прыжок 480 (≈ 4,8 клетки; отпустил — срез до 170), койот 0,08, буфер 0,12; бег 125, разгон 1100, торм. 1500;
**лёд**: предел 185, разгон 260, торм. 130, разворот 420; в воздухе разгон 700, сохраняется скорость отрыва.
**Подкат**: 230 px/с, торм. 420 (лёд 50), рост 12 px (под сводом в 1 клетку — ползком 55). **Сугроб**: предел 48,
падение 45, прыжок 330. **Сосулька**: 85 px/с, верх столба — опора. **Ветер**: снос 55 (лёд 100, воздух 80) px/с во время
порыва, пригнувшись — 0. Подшаги ≤ 4 px. **Мост**: под стоящей ≥ 1,6 с → ломается на 4 с.

**Правила**: бумеранг 300 px/с, торможение 470 (≈ 5,5 клетки), возврат 330 к руке; оглушение 3 с (мамонтёнок 2,2 с);
касание оглушённого — бегство (+100). Котёнок: ходит 40, замечает в 5 клетках → присед 0,45 с → бросок; прыжок сверху —
оглушение. Жук: 26, сверху — урон. Мамонтёнок: 30, в 8 клетках по ходу → разгон 0,5 с → таран 210 до стены/края →
кружится 1,5 с; прыжок сверху — отскок 640. Бураш: 170 вперёд по ряду ног, до 12 клеток, проходит `. % s T - |`,
опора — твердь, уступ или наст сугроба; берёт первый предмет своего ряда, открывает спрятанные припасы рядом (по вертикали
до 44 px), возвращается 230 к Искре. Сердца 3, неуязвимость 1,3 с; жизни 3; вода/пропасть — минус жизнь; шипы — минус сердце.
Очки: припас 50, ключ 500, бегство 100, костёр 100, уровень 500 (+2000 и +жизнь за 100%), вожак 3000.
Вожаки (здоровье): Клык 6, Хрусть 7, Филин 8; уязвимы в `dazed|flipped|rest`; с половины — 2-я фаза.

События `onEvent`: `level{id,boss}`, `jump`, `land{v}`, `slide`, `climb`, `throw`, `catch`, `clink`, `stun{k}`, `wake`, `stomp`,
`boing`, `flee{pts,k}`, `growl`, `trumpet`, `thud`, `fox`, `foxNo`, `foxTurn`, `foxGrab{k}`, `foxHome`, `reveal`, `sup{k,fox,n,need,total}`,
`enough`, `key`, `heart`, `camp`, `need{left}`, `crack`, `bridgeBack`, `hurt{hearts,why}`, `die{why}`, `respawn`, `gameover{score}`,
`shatter`, `spit`, `gust`, `screech`, `roll`, `bossIntro{k}`, `bossHit{hp}`, `bossDown`, `clear{id,bonus,full,key,sup,total}`.

`LEDNIK.logic`: `T, K, PTS, tileAt, isSolid, isTop, solidPx, tilePx, support, heroStep, newHero, heightOf, canStand, windAt,
gustOn, columnAt, mulberry32`.

## js/save.js — `LEDNIK.save`
`KEY = 'arcade.save.lednik'`, `OLD = 'arcade.lednik.map'`, `VER = 2`. `blank()`, `migrate(o)` (v1 `{done,stars,keys,node}` → v2;
неизвестные id/ключи отбрасываются; звезда без прохождения — тоже; закрытый `at` → `'1-1'`; будущая версия → null),
`parse(raw)`, `serialize(p)`, `store(ls)` → `{ load(), save(p), reset() }` (переносит старый ключ и удаляет его),
`apply(p, id, {full,key})`, `stats(p)`.

## js/render.js — `LEDNIK.renderLevel(g, ctx, S, ui)`, `LEDNIK.renderMap(g, ctx, M)`, `LEDNIK.R`
Экран 512×288. `ui = { cam, toasts, banner, msg, runPh, throwT, dt, camDx }`. Статичный слой клеток кэшируется
в offscreen-canvas по (уровень, тема); вода, мосты, сугробы (поверх героя), предметы, враги — каждый кадр.
`M = { prog, sel, pos{x,y}, moving, fresh, note, face, lives, score }`. `R.hero/fox/item/enemy/boss/camp/tent/background/snow/FX`.

## main.js
Сцены движка (`useStandardScreens`), титул перерисован; в меню — «Сбросить карту» (двойное подтверждение), в паузе —
«На карту». `play`: режим `map` ↔ `level`; итог уровня → карта (финал — `g.win()`). Музыка: карта/уровень/вожак через `g.setMusic`.
Доп. клавиши: прыжок Z/K, бумеранг X/J/Ctrl, Бураш C/F; тач `#bBoom`, `#bFox`, `#bPause`.
`LEDNIK.app = { g, game(), mode(), prog(), enterLevel(id), toMap(id), ui, M }` — для отладки и автотестов в браузере.

## tests
`engine.test.mjs` — см. README; `bot.mjs` — `navFor(LD, LV)` (граф проходимости по настоящей физике), `foxFrom`,
`passability`, `playLevel(LD, id, seed, opts)` («человеческий» бот: реакция 150–250 мс, разброс нажатий, промахи по врагам).
