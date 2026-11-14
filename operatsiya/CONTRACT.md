# ОПЕРАЦИЯ — контракт модулей

Игра аркады «Гефест» на фреймворке Гефест Arcade v2.2 (`engine.js`). Общий стандарт: офлайн, `file://`,
без внешних URL/шрифтов/ассетов, RU/EN, темы modern/retro (меняют только отрисовку), WebAudio-звук,
рекорд в `localStorage` (`arcade.best.operatsiya`), кампания — `arcade.operatsiya.save`, бой — `arcade.operatsiya.battle`.
Права: название, сеттинг, бригада, автоматоны Ржавого Совета, карты, арт, палитры, звуки и музыка — оригинальные;
чужих имён нет (тест «правило имён» в `tests/engine.test.mjs`, стоп-лист в base64).

## js/missions.js — `OPERATSIYA.MISSIONS[7]`, `OPERATSIYA.ARENA`
`{ id, obj:'clear'|'rescue'|'hack'|'hold'|'evac'|'boss'|'duel', squad, turns, need?, reinf?{every,n,max,kinds}, map[15 строк × 22] }`.
Легенда карты — в шапке файла.

## js/game.js — `OPERATSIYA.Game(opts)` (без DOM, детерминирована по `seed`)
`opts`: `{ spec, seed, diff:'easy'|'normal'|'hard', squad:[{id,ni,lvl,acc,ap,stam,hp,weapon,gear,kit,clips}], hotseat?, team1?, onEvent(type,data) }`
или `{ restore: json, onEvent }` (восстановление из `serialize()`).

Сетка 22×15. Клетки `T`: FLOOR, WALL, BRICK (4), CRATE (3), DOOR (3), OPEN, RUBBLE, PIT, BALC, LADDER, EXIT, ZONE, CORE
(в скобках — прочность разрушаемых). Проходимы FLOOR/OPEN/RUBBLE/BALC/LADDER/EXIT/ZONE; непрозрачны WALL/BRICK/DOOR;
укрытие: CRATE/CORE — 1, WALL/BRICK/DOOR — 2. Пол ↔ балкон — только через LADDER (без диагоналей).

API: `state()` → S · `tick()` (микрошаг: шаг движения или действие ИИ; → `{kind}` | null) · `busy()` · `endTurn()` ·
`moveTo(u,x,y)` / `planPath(u,x,y)` → `{path,cost}` · `shoot(u, unit|{x,y}, mode)` / `shotInfo(...)` → `{ok,why,cost,chance,rounds}` ·
`throwGear(u,x,y)` / `gearInfo` / `gearRange(u)` · `crouch(u)` · `reload(u)` · `turnTo(u,x,y)` · `useKit(u,v)` ·
`interact(u,kind?)` / `interactOptions(u)` (`free`, `hack`, `evac`, `pickup`, `door`) · `reach(u,budget)` · `hitChance(u,tg,mode,from?)` ·
`coverOf(tx,ty,sx,sy)` · `sees(u,v)` · `byId` · `unitAt` · `serialize()`.
Отладка/тесты: `_damage`, `_explode`, `_updateVis`, `_startTurn`, `_finish`, `_mk`, `_aiPlan`.

`S`: `spec, specId, hotseat, diff, rs (состояние ГПСЧ), t[], thp[], units[], items[{kind,x,y}], starts, rpts, exits, zone, core,
turn, side, phase('play'|'won'|'lost'), reason, winner, obj{kind,prog,need}, evac, reinf, vis[2][], seen[2][], spot[2][id], known[2]{id:{x,y,turn}},
score, kills, ai{queue,i,acts}|null, mover|null, result`.
Юнит: `{id, team, kind('mech'|'master'|'scout'|'trooper'|'heavy'|'grenadier'|'boss'), rkey, ni, lvl, x, y, face(0..7), hp, hpMax, ap, apMax, apBase,
acc, stam, weapon, clip, clips, inf?, gear, kit, heat, crouch, alive, evac, captive, alert, reinf, boss, hits, kills, path, moved, hacked}`.
`result`: `{won, reason, turn, kills, score, winner, units:[{rkey, alive, evac, hits, kills}]}`.

События `onEvent`: `turn{side,turn}`, `endTurn`, `order`, `step{id,x,y,team}`, `door`, `blocked`, `spotted{id,team}`, `react{id,tid,x,y}`,
`shot{id,team,x,y,tx,ty,hit,mode,reaction,chance,weapon}`, `hit{id,dmg,x,y,team}`, `down{id,team,kind,x,y}`, `chip`, `break{x,y,was}`,
`throw{x,y,tx,ty}`, `boom{x,y}`, `crouch`, `reload`, `turnTo`, `kit`, `pickup{item}`, `freed`, `hack{prog,need}`, `evac{n,need}`, `holdTick`,
`reinf`, `overheat{id,lost}`, `boil{id}`, `won`/`lost{reason,winner}`.

Правила:
- ОД (`COST`): шаг 2, диагональ 3, присед +1, лестница +2, дверь +3; прицельный 12, навскидку 7, очередь 10 (3 заряда), шестерня 8,
  присед 2, перезарядка 6, подобрать 3, поворот 1 (выстрел вне конуса взгляда — +1), ремонт 4, освободить 3, взлом 8, эвакуация 2.
  Запас: `apFor(u) = apBase − 2·max(0, вес − (6 + stam/10))`, не меньше 10; вес = инструмент + шестерни + ремкомплекты + обоймы.
- Обзор: 11 клеток, конус 160° по `face`, сосед — всегда; линия `los` (симметричная, концы не проверяются, диагональный зазор закрыт).
  Шаг, после которого бригада заметила нового врага, прерывает путь.
- Шанс: `acc + инструмент + режим(+10/−10/−18) [+ сложность для Совета] − max(0, d − opt)·fall + 10 в упор − укрытие(22/40) − 8 присед цели
  + 6 присед стрелка + 12 сверху − 12 при перегреве`, 5…95. Укрытие: соседняя клетка цели со стороны стрелка; сверху −1 ступень; цель на балконе — не меньше 1.
- Реакция: боец противоположной стороны с ОД ≥ 7 и зарядом стреляет навскидку, когда юнит входит в его поле зрения
  (шаг, открытая дверь, разворот); уже видимая цель реакцию не вызывает.
- Урон: инструмент `dmg` ±1; жар `+32·(1 − stam/200)` за попадание, +12 соседям разобранного, +15 у края взрыва.
  Начало хода: жар ≥ 100 — ход пропущен (жар → 55), ≥ 50 — потеря `round(apMax·(жар − 30)/140)` ОД; затем остывание `12 + stam/5`.
- Шестерня: дальность `4 + stam/12`, нужна линия до клетки, точность `acc + 20 − 3·d`, промах — соседняя клетка; 3×3: 6/4 урона, клетки −3 прочности.
- ИИ (`aiPlan`): шестерня при выгоде ≥ 1.2 (метатель ≥ 0.6) → выстрел при шансе ≥ 45 (или уже сходил) → ход на лучшую клетку
  (шанс, укрытие, открытость, дистанция до рабочей, кучность) с запасом ОД на выстрел → выстрел ≥ 12 → присесть в укрытии.
  Без цели: к последней известной позиции, подкрепления — к точке/выходу. Не больше 12 действий на автоматон за ход.
- Цели: clear — разобрать всех; rescue — освободить мастера и довести до выхода (или расчистить цех), мастер сломан — провал;
  hack — `need` взломов (по одному на бойца за ход); hold — `need` начал хода с бойцом на точке и без автоматонов; evac — `need` бойцов
  в лифте; boss — разобрать Председателя. Бригада выбыла или лимит `turns` вышел — провал. Счёт: автоматоны 100–600 + за победу
  300 + 100·id + 15·(оставшиеся ходы).

`OPERATSIYA.logic`: `MW, MH, VIS, T, PASS, OPAQUE, COVER, TILE_HP, WEAPONS, WEAPON_LIST, COST, KIND, DIFF, MODE_ACC, los, inFov, dirTo, dist, cheb, elevOf,
weightOf, limitOf, apFor, pathFrom, mulberry32, Rng`.

## js/campaign.js — `OPERATSIYA.Camp`
`newCampaign(diff)` → `{v:1, mi, diff, score, wins, fails, done, roster[{id, xp, lvl, missions, kills, sel, load{weapon,gear,kit,clips}}]}`.
`statsOf(r)` (база + 3 меткости/1 ОД/4 выносливости/1 прочности за уровень + снаряжение), `apOf`, `weightOf`, `limitOf`, `selected`, `toggle`,
`fitSquad`, `cycleWeapon`, `cycleItem`, `squadDefs`, `apply(c, result)` → `{won, xp{id}, promos[id], score}` (уровни по `LV_XP` [0,6,14,25,40,60]),
`save/load/clear(Store)`, `saveBattle/loadBattle/clearBattle` (бой — только для той же миссии и попытки).

## Рендер и интерфейс
`OPERATSIYA.modern` / `OPERATSIYA.classic` — палитры (`pixel`, клетки, бригада/Совет, интерфейс). `OPERATSIYA.render.frame(g, ctx, S, P, V)` —
кадр боя: поле (retro — буфер 16 px ×2), туман, зона хода, путь с ценой, линия прицела с шансом, зона взрыва, HUD, панель бойца и списка,
журнал, панель действий `OPERATSIYA.layout.BTNS`. `OPERATSIYA.ui` — снаряжение (`equip`, области щелчка `E.regions`), разбор, передача хода, DOM.

## main.js
`Arcade.createGame({gameId:'operatsiya'})`, `useStandardScreens`, пункты меню `play` (Новая кампания / Продолжить · Миссия N),
`newc` (с подтверждением), `hot` (горячий стул), `diff` (сложность); сцены `equip`, `play`, `handoff`, `debrief` (+ `pause`/`win` движка).
Ход: игрок — мгновенные действия, движение и ход Совета — `tick()` с паузами под анимацию. Отладка/QA: `OPERATSIYA.app`.

## Definition of Done
- `node operatsiya/tests/engine.test.mjs` — все тесты зелёные; `node tools/smoke.mjs` — PASS operatsiya.
- В браузере: титул → снаряжение (Enter) → бой (Enter) → пауза (P) → T/L/M работают; тач — тап/второй тап/кнопки; 0 ошибок консоли.
