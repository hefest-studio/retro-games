# СБОРКА — контракт модулей

Игра аркады «Гефест» на фреймворке Гефест Arcade v2.2 (`engine.js`). Общий стандарт: офлайн, `file://`,
без внешних URL/шрифтов/ассетов, RU/EN, темы modern/retro (меняют только отрисовку), WebAudio-звук,
рекорд в `localStorage` (`arcade.best.sborka`), прогресс — `arcade.sborka.save`, бой — `arcade.sborka.battle`.
Права: название, сеттинг (мастерская «Гефест», Ржавая Артель, Долина Заводов, дирижабль «Наковальня»), роботы,
модули, карты, арт, палитры, звуки и музыка — оригинальные; чужих имён нет (тест «правило имён», стоп-лист в base64).

## js/maps.js — `SBORKA.maps`
`T` {GROUND, ROCK, SWAMP, CLIFF, ROAD}, `TS` 16, `FT` (размеры заводов: base 3×3, цеха 2×2), `MAPS` (5 карт: id, w, h,
seed, плотности rock/swamp/cliff, roads, neutral[] — типы цехов парами, lvl 0–4, biome meadow|marsh|rust),
`skirmish(seed)` → spec, `genMap(spec)` → `{w,h,t[],factories[{type,tx,ty,owner}],biome}` (центральная симметрия;
factories[0] — база игрока, [1] — база Артели; дороги база↔база и к ближним цехам; цеха достижимы гусеницами),
`components(w,h,t,pass)`, `padTile(f)`, `mulberry32`.

## js/game.js — `SBORKA.Game(opts)` (без DOM, детерминирована при заданном seed)
`opts`: `{ spec, seed?, map?, aiSides=[1], startRobots=true, playerInc=1, invuln?, restore?, onEvent(type,data) }`.
Стороны: 0 — «Гефест» (игрок), 1 — Артель. `restore` — снимок `snapshot()`.

API: `state()` → S · `update(dt)` (подшаги ≤ 1/30 с) · `build(side, design, fid?, order?)` → `{ok, robot}|{ok:false, why:'chassis'|'slots'|'module'|'empty'|'cores'|'brain'|'factory'|'cap'|'res'}` ·
`order(ids, kind, x?, y?)` → число (`kind`: capture|robots|factories|guard|follow) · `setShip(x,y)` · `possess(id)` / `release()` /
`drive(dx, dy, fire)` / `detonate()` · `robot(id)` · `robotAt(x,y,side?,rad?)` · `factoryAt(x,y)` · `baseOf(side)` · `snapshot()`.
Отладка/тесты: `_spawn(side, design, x, y, order)`, `_hurt`, `_think`, `_detonate(r,f)`, `_rehash`.

`S`: `spec, map{w,h,t[],biome}, time, phase('play'|'won'|'lost'), phaseT, winner, rs (состояние ГСЧ), res[2]{metal,energy,drive,arms,chips},
inc[2], factories[{id,type,tx,ty,w,h,x,y,owner(-1|0|1),cap{side,prog},pt{res:таймер},ruinT,disT,tcd}],
robots[{id,side,d{chassis,w[3],brain},st,x,y,hp,max,order{kind,x,y},path,pi,goal,tgt,cd[],core,ang,moving,hold,thinkT,stuckT,comp,capF,flash,home}],
shots[{kind:'shell'|'rocket'|'beam',…}], booms[], ship{x,y}, poss, drive, stats{built,lost,caps,kills}[2], allT[2], ai{}, aiSides, lvl, result`.
`result`: `{won, time, built[2], lost[2], caps[2], kills[2], how:'base'|'all'}`.

События `onEvent`: `build{side,id,x,y}`, `order{kind,n}`, `shot{kind,side,x,y}`, `beam`, `hit`, `kill{side,x,y,id}`, `boom`, `core{x,y,base,side,fid}`,
`capture{fid,side,from,type,x,y}`, `rebuilt`, `possess`, `release`, `possLost`, `noTarget`, `won`, `lost` (данные — `result`).

Правила:
- Конструктор: `CHASSIS` wheels/tracks/hover (цена, прочность 8/15/10, скорость 74/46/60, `pass[тип клетки]` — множитель скорости,
  0 — не проехать: колёса [1,0,0,0,1.3], гусеницы [1,.75,0,0,1.1], антиграв [1,.9,1,0,1.1]); `WEAPON` hammer (96 px, 2 урона/1 с),
  rocket (150 px, 3/2.1 с, осколки 18 px), beam (62 px, 1/0.3 с), core (подрыв); `BRAIN` none/basic/smart (обзор 110/150/200,
  точность .72/.86/.95). Прочность = шасси + 1 за модуль; скорость × (1 − Σ весов модулей). `validate`: ≥ 1 модуль, ≤ 3 слота, ≤ 1 ядра.
- Путь: A* по клеткам, 8 сторон без срезания углов, цена клетки 1/pass, сглаживание по проходимым отрезкам; достижимость — компоненты связности по шасси.
- Робот думает раз в 0.3–0.5 с: враг в радиусе (обзор для «бить роботов»/«охраны», иначе дальность+24) — стоит и стреляет или догоняет;
  иначе выполняет приказ. Захват выбирает ближний доступный чужой цех (штраф за толпу своих на одном цехе).
- Экономика `PROD` (секунд на единицу): база metal 2.5, energy 3, drive 7, arms 7, chips 18; цеха — свой ресурс за 2–5 с; × `inc[side]`.
  Старт `START_RES` {20,12,6,6,3}; потолок 99; предел роботов 24 на сторону.
- Захват: на площадке (r 22, база 30) роботы одной стороны → прогресс (+25% за каждого следующего), `CAP_T` 7 / база 28 с.
  База захватываема только при `disT > 0` (ядро, 40 с). Ядро на цехе — руины 45 с, затем нейтральный. Турель базы: 130 px, 3 урона/1 с.
  Ремонт у своей базы: +0.7/с в 56 px.
- Победа: база противника захвачена или все не-базовые цеха (не руины) удержаны `HOLD_ALL_T` 90 с.
- ИИ `AI_LVL[lvl]`: интервал сборки 9→4 с, доход ×0.75→1.25, роботов на старте, очередь образцов `TPL`, охрана базы 1–3.

`SBORKA.logic`: константы, `TPL`, `TPL_ORDER`, `AI_LVL`, `norm`, `costOf`, `validate`, `stats`, `canAfford`, `astar`, `findPath`, `walkable`, `tileAt`, `tget`.

## Рендер и интерфейс
`SBORKA.modern` / `SBORKA.classic` — палитры (`pixel`, `biome{meadow,marsh,rust}`, `team[2]`, `res{…}`, цвета интерфейса).
`SBORKA.render.world(ctx, S, P, view, {sel, time, bare})` — рельеф (кэш offscreen), заводы, роботы, выстрелы, взрывы, дирижабль;
`render.robot(ctx, r, P, t, scale)`, `render.minimap(ctx, S, P, rect, view, o)`, `render.icon(…)`.
`SBORKA.ui` — экран 640×512: HUD 32 px, поле 640×440 (мир ×1.6, retro — буфер ½ и ×2), панель приказов 40 px;
`ui.play(…)`, `ui.kpanel(…)` (конструктор), `ui.maps(…)`, `ui.result(…)`; кликабельные зоны — `ui.hits`.

## main.js
`Arcade.createGame({gameId:'sborka'})`, `useStandardScreens`, пункты меню `play` (Кампания) и `cont` (Продолжить бой), сцены `maps`,
`play` (конструктор — модально, время стоит), `result` (+ `pause`/`win` движка). Камера следует за «Наковальней» (или за роботом в
прямом управлении). Отладка/QA: `SBORKA.app.game()`, `.startBattle(spec)`, `.openMaps()`, `.prog()`, `.sel()`.

## Definition of Done
- `node sborka/tests/engine.test.mjs` — все тесты зелёные; `node tools/smoke.mjs` — PASS sborka.
- В браузере: титул → карты (Enter) → бой (Enter) → конструктор (B) → пауза (P) → T/L/M работают; тач — тап/перетаскивание/кнопки; 0 ошибок консоли.
