# ПОСОХ — контракт модулей

Игра аркады «Гефест» на фреймворке Гефест Arcade (`engine.js`). Общий стандарт: офлайн, `file://`, без внешних
URL/шрифтов/ассетов, 5 языков (RU/EN/TR/ES/PT), темы modern/retro (меняют только отрисовку), WebAudio-звук, рекорд в
`localStorage` (`arcade.best.posokh`), маршрут — `arcade.save.posokh` (v2), достижения — `arcade.ach.posokh`.
Права: название, героиня (картограф Ярослава), вехи, участки, стражи, хозяева, арт, палитры, звуки и музыка — оригинальные;
чужих имён нет (тест «правило имён», стоп-лист в base64).

## js/levels.js — `POSOKH.levels`
Клетка `T = 16`, высота `H = 18` рядов (экран 288 px). Участок — ASCII-куски слева направо, строки выровнены по низу;
`ceil` — сколько верхних рядов закрыто потолком. Клетки: `.` воздух, `#` камень, `=` мягкая порода (веха втыкается),
`-` мостки (опора сверху), `^` шипы, `c` треснувший камень (столбик осыпается от вехи), `Q` репер, `X` решётка стража,
`a` ворота арены (`A` — закрыты), `~` гибель. Сущности: `@ o O p L F w j f M B` (старт, образцы 50/250, термос, оберег,
флажок, ходок, прыгун, летун, страж, хозяин).
`build(id)` → `LV = { id, boss, guard, ceil, w, h, t[строки], items[{id,k,tx,ty}], enemies[{k,tx,ty}], flags[{id,tx,ty}],
marks[{id,tx,ty}], start, guardAt, bossAt, arenaX, total }`. `EXP`, `ids` (порядок маршрута: mine, swamp, ridge, sunk, tower), `MARKS = 3`.

## js/game.js — `POSOKH.Game(opts)`, `POSOKH.logic` (без DOM, детерминирована при заданном `rng`)
`opts`: `{ rng, onEvent(type,data), god }`. API: `start(id, carry{marks, lives, score})` · `update(dt)` (шаг 1/60) ·
`setInput(dx, up, jump)` · `throwStake()` · `result()` · `state()` · `reviveAd()` · `canBoost()` / `boost()`.
Тестовые хуки: `_place`, `_hurt`, `_die`, `_killBoss`, `_killGuard`, `_throw`.
`S`: `id, LV, W{LV,g}, phase('play'|'dead'|'clear'|'over'), lives, hearts, score, gain, hero, got{}, cp, marks{}, newMarks[],
enemies[], darts[], pegs[{tx,ty}], shots[], guard, boss, sign, signGot, cool, kills, deaths, hurts, throws, over`.
Итог (`clear`): `{ id, won, score, gain, marks[], newMarks[], lives }`.

**Физика** — `logic.heroStep(W, P, inp{dx,jump}, dt, ev)`: g = 1400, прыжок 440 (≈ 4,3 клетки; отпустил — срез до 160),
бег 115; койот 0,08, буфер 0,12; хитбокс 10 × 24. Шипы — `spike` (урон), пропасть — `fall`, трясина — `drown`.
**Веха** — `logic.newStake(P, up)` (от плеча: `P.x + face·4`, `P.y − 22`), `logic.stakeSub(W, s)` — подшаг (по горизонтали 2 px,
по диагонали 1,5 px по осям; в кадре 3 подшага), `logic.stakeRay(W, P, up)` — полёт целиком (прицел, граф тестов).
Итог полёта: `peg` (боковая грань `=`, соседняя клетка свободна → клетка `|`, опора сверху), `mark` (`Q` → `q`, +1000 один раз),
`crack` (столбик `c` осыпается), `clink` (камень), `far` (дальность ≈ 11 клеток). Вех воткнуто ≤ 3 (`K.PEGS`), лишняя
убирает самую старую (`unpeg`). Пауза между бросками 0,28 с, в полёте — одна веха.
**Правила**: веха сбивает врага (+100), ранит стража (3) и хозяина (5–6; миг оглушения); касание врага — минус сердце
(неуязвимость 1,2 с). Страж просыпается в 12 клетках, повержен — решётка `X` открыта (+1000). Хозяин просыпается за
воротами арены (закрываются); повержен → +3000, тригопункт падает в центр арены; коснулась — `clear`.
Сердца 3, жизни 3 (до 9); флажок — точка возврата и полные сердца; смерть — вехи убираются.

## js/save.js — `POSOKH.save`
`store(ls)` → `{ has, load, save, wipe, ach, setAch }` (ошибки localStorage глотаются; v1 при чтении перезаписывается в v2).
`apply(p, итог)`, `burn(p)` (конец жизней: очки 0, жизни 3), `isOpen`, `firstOpen`, `clearedCount`, `markCount`,
`allCleared`, `fullMap`, `migrate` (v1 → v2: пройденные экспедиции сохраняются, `note: 0` — плашка «обновлена»).

## js/render.js — `POSOKH.renderLevel(g, ctx, S, ui, prog)`, `POSOKH.renderMap(g, ctx, M, prog)`, `POSOKH.R`
Темы: modern — градиенты и своя палитра у каждого участка; retro — 16-цветная палитра, прямоугольные «пиксели».
Прицел — пунктир по `stakeRay` с меткой итога.

## js/main.js
Сцены движка + `play` с режимами `map` (карта маршрута: ← → участок, Enter — в путь, в конце — обсерватория) и `exp`.
Привал: «На карту маршрута» (двойное подтверждение), бонус «+1 жизнь» за рекламу. Площадка: лидерборд `posokh`,
`g.useNoAds`, `g.useRewardedContinue`, `g.adBreak()` по нажатию на итоге участка, `g.persist` (рекорд, маршрут, достижения).
Отладка: `POSOKH.app` (`enterExp`, `toMap`, `game()`, `prog()`, `snapCam()`).

## tests
`engine.test.mjs` — логика, физика, вехи, правила, сохранение и миграция, языки, страница/площадка, правило имён,
проходимость по графу, исполнимость, баланс. `bot.mjs` — `navFor`, `passability`, `playExp`.
