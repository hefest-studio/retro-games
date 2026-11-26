# СКОК (EN: KEYWINDER) — контракт модулей

Игра аркады «Гефест» на фреймворке Гефест Arcade v2.9 (`engine.js`). Общий стандарт: офлайн, `file://`, без внешних
URL/шрифтов/ассетов, RU/EN/TR/ES/PT, темы modern/retro (меняют только отрисовку), WebAudio-звук, рекорд в `localStorage`
(`arcade.best.skok`), прогресс — `arcade.save.skok` (v3). Переделка 2026-11: заводной ключ вместо прыжка по врагам, Верстак вместо карты.
Права: название, герой (лис-лудильщик Скок), враги (шестерёнка-катун, заводная мышь, пружинник, игольник, флюгерник,
давильный молот), хозяева крепостей (Ржавый Сторож, Котельный Барон, Флюгерный Граф, Великий Маятник), края, уровни,
арт, палитры, звуки и музыка — оригинальные; чужих имён нет (тест «правило имён», стоп-лист в base64).

## js/levels.js — `SKOK.levels`, `SKOK.MAP`
Клетка `T = 16`, высота уровня `H = 18` рядов. Уровень собирается из кусков `CH` (ASCII, выравнивание по низу; у крепостей
пустота сверху — камень). Коды: `.` воздух, `#` земля, `=` камень, `T` доска (сверху), `/` `\` склоны, `^` шипы, `~` смола,
`x` короб, `W` лебёдка (заводит механизмы своего куска), `b` звено моста, `S` пружинная плита; `o` гайка, `L` сердце-шестерня,
`@` старт, `E` деталь-финиш, `C` фонарь; враги `g m h n v P Z` (по краю `SWAP` подменяет `g`/`m`).
`build(id)` → `LV = { id, r, n, fort, boss, w, h, t: [строки], items[{id,k:'nut'|'heart',tx,ty}], enemies[{k,tx,ty}], camps[{id,tx,ty}],
groups[{id, winch{tx,ty}, tiles[{tx,ty,k:'b'|'S'}], t (осталось завода), ext}], start, exit|null, arenaX, crates, nuts, par }`.
`LEVELS` — 20: `<край>-1..4`, `<край>-F` (крепость; `boss: rust|boiler|vane|pendulum`).
`MAP`: `NODES[{id,r,n,i,kind:'level'|'fort'}]`, `FIRST`, `FINAL`, `REGIONS`, `node(id)`, `done(p,id)`, `isOpen(p,id)` (по порядку),
`next(id)`, `region(r)`.

## js/game.js — `SKOK.Game(opts)`, `SKOK.logic` (без DOM, детерминирована при заданном `rng`)
`opts`: `{ rng, onEvent(type,data), god (тесты: без урона) }`.
API: `startLevel(id, { lives })` · `update(dt)` (шаг 1/60) · `setInput(dx, jump)` · `strike()` (ключ; `false` — перезарядка/не в игре) ·
`revive()` (из `over`: 3 пружины, с фонаря) · `canBoost()`/`boost()` (все сердца) · `state()` → S.
Тестовые хуки: `_place(tx,ty)`, `_hurt(why,x)`, `_die(why)`, `_wind(i)`.
`S`: `score, lives, hearts, nuts, nutsGot, opened, hits, phase('play'|'dead'|'clear'|'over'|'idle'), phaseT, time, id, LV, W{LV,plats}, hero,
enemies[] (+`stop` — секунды остановки), got{}, bolts[], cp, boss, kills, stops, deaths, key{t,cd}, ring{boss,pts,time,all,noHit,stars}`.

**Физика** — `logic.heroStep(W, P, inp, dt, ev)` (одна для игры и графа проходимости): g = 1400, падение ≤ 480, прыжок 430
(отпустил — срез до −150), койот 0,08, буфер 0,12; бег 135 (разгон 950, торм. 1100, разворот 1900, в воздухе 700). Склоны —
поверхность по центру героя, «ступенька» 7 px. `W.plats` — опоры-остановленные враги (только сверху; `spring` — батут).
Заведённая плита `Q` и остановленный пружинник подбрасывают (640). `Y` — выдвинутое звено моста (как доска).
`logic.hazard(LV,P)` → `'spike'|'tar'|'fall'|null`; `logic.woundCopy(LV)` — клетки с заведёнными механизмами (для графа).

**Правила**: касание заведённого врага, молота, хозяина (кроме сна, подзавода и отскока) и болта — −1 сердце, неуязвимость 1,5 с;
0 сердец, пропасть, смола — минус пружина, возврат к фонарю (механизмы и враги заново). Ключ: враг → стоп 5 с (+50) → разбор (+100,
+3 гайки); лебёдка → завод 8 с; короб → +20, +3 гайки; молот — «звяк»; хозяин — урон только в фазе `wind` (после прыжка, 1,7–2 с),
затем отскок. Хозяева: здоровье 3/3/4/4, болты 0/2/1/2. Итог: деталь +1000, время (`par − t`)·10, все гайки и короба +1000, без ударов +500;
звёзды 1–3. Хозяин +3000.

События `onEvent`: `level{id,boss}`, `jump`, `land`, `boing`, `swing{hit}`, `stopE{k}`, `dismantle{k}`, `rewind`, `clank`, `wind{fresh}`,
`unwind`, `kill`, `nut`, `crate`, `heart`, `hurt{why,hearts}`, `die{why}`, `respawn`, `gameover{score}`, `camp`, `squeak`, `hop`, `thud`,
`bossIntro{k}`, `bossLeap`, `bossWind`, `bossHit{hp}`, `bossDown`, `finish{stars,boss}`, `clear{id,boss,score,stars,ring}`.

## js/save.js — `SKOK.save`
`KEY = 'arcade.save.skok'`, `OLD = 'arcade.skok.map'`, `VER = 3`. `blank()`, `migrate(o)` (v3 — проверка; v1/v2 → v3: уровни 1–4 и
крепости до первой «дыры», `migrated: true`; будущая версия/мусор → null), `parse(raw)`, `serialize(p)`, `store(ls)` → `{ load(), save(p), reset() }`
(старый ключ переносится и удаляется), `apply(p, id, stars, score)` → улучшен ли рекорд уровня, `total(p)` (сумма рекордов), `stats(p)`.

## js/render.js — `SKOK.renderLevel(g, ctx, S, ui)`, `SKOK.renderSelect(g, ctx, M)`, `SKOK.R`
Экран 512×288. `ui = { cam, toasts, banner, msg, runPh }`. Статичный слой клеток кэшируется в offscreen-canvas по (уровень, ревизия
клеток, тема); механизмы (мосты, плиты, лебёдки), предметы, враги — каждый кадр. `M = { prog, sel, note }`.
`R.hero/enemy/boss/windKey/winch/finishPart/nut/heartGear/heartIcon/crateTile/background/selectAt/FX`.

## main.js
Сцены движка (`useStandardScreens` + `continue` за рекламу), титул перерисован; в меню — «Сбросить прогресс» (двойное подтверждение),
в паузе — «К верстаку». `play`: режимы `select` ↔ `level`; итог уровня → нажатие → `g.adBreak()` → Верстак (финал 4-F — `g.win()`).
Площадка: `leaderboard: 'skok'`, `useLeaderboard`, `useNoAds`, `onCloud`, `persist` (рекорд, прогресс), `useRewardedContinue`, `useRewardedBonus`.
Доп. клавиши: прыжок Z/K, ключ X/J; тач `#bKey`, `#bPause`; тап по клетке Верстака. `SKOK.app = { g, game(), mode(), prog(), enterLevel(id), toSelect(id), ui, M }`.

## tests
`engine.test.mjs` — см. README; `bot.mjs` — `navFor(SK, LV, wound, robust)` (граф по настоящей физике), `passability(SK, LV, wound)` →
`{ exit, winches[] }`, `playLevel(SK, id, seed)` («человеческий» бот: реакция 150–250 мс, разброс нажатий; ключ — по лебёдкам и врагам).
