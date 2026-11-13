# ВЗВОД — контракт модулей

Игра аркады «Гефест» на фреймворке Гефест Arcade v2.2 (`engine.js`). Общий стандарт: офлайн, `file://`,
без внешних URL/шрифтов/ассетов, RU/EN, темы modern/retro (меняют только отрисовку), WebAudio-звук,
рекорд в `localStorage` (`arcade.best.vzvod`), кампания — `arcade.vzvod.save`.
Права: название, сеттинг, болванчики, механизмы Улья, ульи, транспорт, карты, арт, палитры, звуки и музыка —
оригинальные; чужих имён нет (тест «правило имён» в `tests/engine.test.mjs`, стоп-лист в base64).

## js/game.js — `VZVOD.Game(opts)` (без DOM, детерминирована при заданном `rng`)
`opts`: `{ spec, seed, mapSeed?, map?, rng, squad:[{id,name,rank}], gears?, rockets?, invuln?, onEvent(type,data) }`
(`map` — своя карта в формате генератора; `invuln` — для тестов/заставки).

Экран 640×512: HUD 32 px, поле 640×480, мир показан с увеличением `ZOOM` 1.25 (видно 512×384 px мира).
Карта — клетки `TS` 16 px: `T.GROUND, WALL, LIQ (жижа/полынья), CRATE (укрытие, разрушается взрывом), DECOR, PIPE, RAIL, HIVE`.
Пешком непроходимы WALL/LIQ/CRATE/PIPE/HIVE, самоходу — всё, кроме LIQ; выстрелы гасят WALL/CRATE/PIPE/HIVE.

API (команды — активной группе): `start()` · `update(dt)` (подшаги ≤ 1/60) · `state()` → S · `leader(gi)` ·
`moveTo(x,y)` (клик по пустой машине — посадка) · `fire(on, x, y)` / `aim(x,y)` · `gear(x,y)` / `rocket(x,y)` → bool ·
`split()` / `merge()` / `splitMerge()` · `switchGroup()` · `exitVehicle()`.
Отладка/тесты: `_S`, `_spawn(type,x,y,from)`, `_explode(x,y,r,by)`, `_break(unit)`, `_resetFollowers(gi)`, `_path`, `_board`.

`S`: `spec, map{w,h,t,biome}, src (карта генератора), time, phase('play'|'won'|'lost'), phaseT, reason('squad'|'vip'),
units[{id,name,rank,st{speed,cd,spread,range},x,y,alive,gi,q,crumbs,ci,cd,ang,kills,inV,moving,deadT}],
groups[2]{order[id],vehicle,board,target,fire{on,x,y}}, active, enemies[{id,type,x,y,r,hp,max,q,tgt,alertT,dead,from}],
hives[{id,tx,ty,x,y,hp,max,dead,spawnT}], bullets, bolts, nades, missiles, booms, sparks, pickups[{kind,x,y,taken,supply?}],
vehicles[{id,type,x,y,hp,max,crew,q,cd,ang,dead}], vip{x,y,hp,max,alive,near}|null, exit, zone{x,y,r,inside}|null,
ammo{gear,rocket}, score, kills, hivesKilled, obj{kind,prog,need,started,hivesLeft,enemiesLeft}, mapVer, result`.
`result` (при конце): `{won, reason, score, kills, hives, time, ammo, units:[{id,alive,kills}]}`.

События `onEvent`: `start`, `order`, `shot`, `eshot{type}`, `hit`, `kill{type,x,y}`, `ping` (пуля об улей), `throw`, `rocket`,
`shell`, `boom{x,y,r}`, `hiveHit`, `hiveDown`, `spawn`, `broken{id,name,x,y,src}`, `zap`, `pickup{kind,n}`, `supply`, `noAmmo{kind}`,
`split`, `merge`, `switch{gi}`, `board{type}`, `exitV`, `noExit`, `vhit`, `vehDown`, `vipHit`, `vipDown`, `holdStart`, `wave`, `won`, `lost{reason}`.

Правила:
- Колонна: лидер идёт по `findPath` (A* + сглаживание), ведомый i следует по «крошкам» ведомого i−1 (точка каждые 3 px),
  стоит, если до предшественника ≤ `GAP` 11 px; при разрыве/смене лидера/делении/высадке — свой A* до предшественника.
  Скорость группы — минимальная по рангам; отставший догоняет ×1.3.
- Ранг `rankOf(xp)` по `RANK_XP` [0,4,10,18,30,45]; `stats(rank)`: скорость 56+3r, перезарядка 0.40−0.03r, разброс 0.13−0.016r, дальность 220+6r.
- Пуля 380 px/с, урон 1; шестерня — до 175 px по дуге, взрыв r 30; ракета 300 px/с, r 28; снаряд вагонетки r 24.
  Взрыв: механизмам −4, улью −1 (в радиусе r+14), ящики-укрытия → обломки, свои в 0.5r ломаются, наладчику −2.
- Механизмы `ENEMY`: drone, rusher (касание ломает, сам разрушается), turret (очередь 3), heavy (6 прочности, очередь 2);
  замечают цель по прямой видимости, поднятые по тревоге ищут её в радиусе 600 по A*.
- Улей рождает механизм раз в `spawnInt`·(0.8…1.2) с, если отряд ближе 340 px, своих живых < `hiveCap`, всего < 28.
- Транспорт `VEH`: cart (8, 68 px/с, снаряд 1.0 с, суша), skimmer (5, 104 px/с, очередь 0.13 с, над жижей).
- Цели: hives — все ульи взорваны; clear — и ульи, и все механизмы; escort — наладчик (4 прочности, 34 px/с, идёт, если свой ближе 80 px)
  дошёл до выхода (22 px); hold — `holdT` с суммарно в круге r 44, волны по `waveN` раз в `waveInt` с.
- Снабжение: цели hives/clear, ульи живы, боеприпасов 0, ящиков нет — через 8 с ящик шестерней у лидера.
- Счёт `SCORE`: механизмы 50–200, улей 400, миссия 500·номер операции.

`VZVOD.logic`: константы, `T`, `OPS` (6 операций, `mission(op,mi)` → spec), `genMission(spec, seed)`, `checkMission(spec, map)`,
`bfs`, `astar`, `findPath`, `walkable`, `los`, `hiveRing`, `rankOf`, `stats`, `ENEMY`, `VEH`, `SCORE`, `AMMO`, `mulberry32`.

## js/campaign.js — `VZVOD.Camp`
`newCampaign()` → `{v:1, op, mi, roster[{id,ni,gen,xp,rank,state('ready'|'repair'),wait,missions,kills}], nextId, fund, score, missions, wins, fails, done, seed?}`.
`prepare(c)` → `{repaired, emergency, waiting}` (ремонт при `fund ≥ REPAIR_COST` 2 и `wait ≤ 0`; срочная сборка до `MIN_SQUAD` 2:
новобранец или, при полной мастерской `ROSTER_MAX` 12, бесплатный срочный ремонт). `squadFor(c)` — готовые по опыту, до `spec.squad`.
`apply(c, result, squadIds)` → `{won, promos, broken, recruits, fund, xp{id}, opDone?}` (сломанный: `repair`, `wait 1`; прочие в ремонте: `wait−1`;
фонд +3+ульи / +1; новобранцы +2 / +1; победа — следующая миссия/операция, после 18-й — `done`).
`save(Store,c)`, `load(Store)` (проверка версии и полей; пройденная — null), `clear(Store)`. Имя болванчика — `n_<ni>` + «-gen».

## Рендер и интерфейс
`VZVOD.modern` / `VZVOD.classic` — палитры (`pixel`, `biome{factory,snow,swamp}`, цвета существ и интерфейса).
`VZVOD.render.world(ctx, S, P, view, {aim,target,time})` — карта (кэш offscreen по теме/версии) и всё на ней; `render.minimap(...)`.
`VZVOD.ui.render(g, ctx, S, P, cam, {toasts, banner, campScore, mode, aim, target, bare})` — кадр боя (retro — буфер ½ и ×2),
HUD, миникарта, нижняя строка группы, баннер миссии, итог; `ui.brief(...)`, `ui.debrief(...)`.

## main.js
`Arcade.createGame({gameId:'vzvod'})`, `useStandardScreens`, пункты меню `play` (Новая кампания / Продолжить · Оп. X-Y) и `newc`
(с подтверждением), сцены `brief`, `play`, `debrief` (+ `pause`/`win` движка). Камера следует за лидером/машиной активной группы,
стрелки/WASD — осмотреться. Ввод: pointer events (мышь/тач), клавиши Q/G, E/R, X, Tab, F, пробел; тач-кнопки `[data-act]`.
Отладка/QA: `VZVOD.app.game()`, `.camp()`, `.setCamp(c)`, `.toBrief()`, `.newCamp()`.

## Definition of Done
- `node vzvod/tests/engine.test.mjs` — все тесты зелёные; `node tools/smoke.mjs` — PASS vzvod.
- В браузере: титул → брифинг (Enter) → бой (Enter) → пауза (P) → T/L/M работают; тач — тап/двойной тап/кнопки; 0 ошибок консоли.
