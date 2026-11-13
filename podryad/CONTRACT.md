# ПОДРЯД — контракт модулей

Игра аркады «Гефест» на фреймворке Гефест Arcade v2.2 (`engine.js`). Общий стандарт: офлайн, `file://`,
без внешних URL/шрифтов/ассетов, RU/EN, темы modern/retro (меняют только отрисовку), WebAudio-звук.
Хранилище: `arcade.podryad.save` — кампания (JSON v1), `arcade.podryad.diff` — сложность для новой кампании,
`arcade.best.podryad` — рекорд (заработок за карьеру, для каталога). Ключей с чужими именами нет (миграция не нужна).
Права: название, сеттинг (мастерская, Ржавая артель, острова), крыло-толкач, враги, боссы, арт, палитры, звуки и
музыка — оригинальные; чужих имён нет (тест «правило имён», стоп-лист — в base64).

## js/data.js — `PODRYAD.DATA`
`GUNS{rivet,fan,hammer,arc}: {price, up[4], base}`, `GUN_IDS`, `MODS{turret,homer,scythe}: {price}`, `MOD_IDS`,
`SPECIAL{mega{price,max}, cell{price,max}, gen{up[3],max}}`, `REPAIR` (◈ за 1 брони), `ARMOR_MAX`, `START_MONEY`,
`shieldCap(gen)`, `shieldRegen(gen)`, `SHOP[{id,kind,key}]` (строки ангара), `AIR`, `GROUND`, `BOSSES` (`hp,r,pay`),
`DIFF{easy,normal,hard}: {hp,dmg,rate,bspd}`, `DIFFS`, `SECTORS[{boss,pal}]`, `MISSION_T` (78 с), `SCROLL` (44 px/с),
`NEED[9]` (минимально необходимое на задание), `buildMission(si,mj)` → `{si,mj,h,waves[{t,kind,form,n,x,side}|{t,boss,mid}],
ground[{kind,x,dy,is}], isles[{x,y,w,h,s}], midT, bossT, dist}` (детерминированно), `missionPotential(m)`, `mulberry32`.

## js/economy.js — `PODRYAD.Eco` (чистые функции над кампанией `c`)
`c = {v:1, diff, money, mi (0..9), guns{id:ступень}, gun, mods[2], mega, cells, gen, armor, hist[{id,slot?}], earned, deaths, done}`.
`create(diff)`, `row(id)`, `price(c,id)` / `sellPrice(c,id)` (null — нельзя), `canBuy`, `canSell`, `buy(c,id)` → списано|0,
`sell(c,id)` → выручка|0, `repairCost(c,n)`, `loseLast(c)` → `{id,slot}`|null, `finishMission(c,{ok,money,armor,mega,cells})`
→ `{ok,lost}`, `worth(c)`, `serialize`/`deserialize` (проверка и приведение полей), `save(store,c)`/`load(store)`/`clear(store)`.
Правила: казна ≥ 0; продажа — `floor(цена/2)` снимаемой ступени/предмета; последнее основное орудие не продаётся;
гибель снимает последнее из `hist` (орудие/ступень/модуль/щит-генератор), расходники не теряются, броня → 100.

## js/game.js — `PODRYAD.Game(opts)` (без DOM, детерминирована при заданном `rng`)
`opts`: `{ load:{gun,guns,mods,mega,cells,gen,armor}, diff, si, mj, rng, onEvent(type,a,b,c), noHit }`.
Поле 440×640, фикс-шаг 1/60 с. API: `start()` · `tick(dt)` · `update(dt)` · `setInput(dx,dy)` · `drag(dx,dy)` ·
`bomb()` → bool · `cell()` → bool · `cycleGun()` → bool · `state()` → S · `result()` → `{ok,money,earnedRaw,armor,mega,cells,gun,kills,gkills}`.
Тестовые хуки: `_spawnBoss(id,mid)`, `_hurt(dmg)`.
`S`: `phase ('play'|'boss'|'dead'|'fail'|'done'), t, d, si, mj, h, money, kills, gkills, P{x,y,armor,shield,scap,sreg,gun,guns,mods,mega,cells,gen,bank,…},
shots[], eb[] (заклёпки), E[] (воздушные), G[] (наземные), isles[], items[], boss{id,mid,hp,max,r,x,y,t,ph,…}|null, mission`.
События: `start(si,mj)`, `shot(gun)`, `missile`, `ehit/ghit/bhit`, `kill(x,y,kind)`, `gkill(x,y,kind)`, `pay(x,y,v)`, `blast`, `cut`,
`ring`, `hit`, `shieldHit`, `die`, `fail`, `mega`, `cell`, `armor`, `megaGet`, `gun`, `midboss/boss(id)`, `bossLeft`, `midDown/bossDown`, `done`.
`PODRYAD.logic`: `K`, `gunVolley(gun,lv,x,y)`, `gunIv(gun,lv)`, `clamp`.

## js/render.js — `PODRYAD.render`
`draw(ctx,g,S,{banner,funds,touch})` (поле + панель подрядчика), `hangar(ctx,g,{camp,sel,rows,msg,touch})` → зоны кликов,
`field`, `hero(ctx,C,x,y,{bank,mods,scale},t)`, эффекты `spawn/pop/wave/flash/shake/clearFx/update`, `txt`, `wrap`, `bar`, `itemName`,
палитры `PM`/`PR` (по секторам). Retro — поле в 220×320 с растяжением без сглаживания.

## js/main.js
`Arcade.createGame({gameId:'podryad'})`, `useStandardScreens`; пункты меню `play` (играть/продолжить), `newc`, `diff`.
Сцена `play` — фазы `hangar` → `fly` → `debrief`; после 9-го задания — `win`. Отладка/QA: `PODRYAD.app` (`g`, `game()`,
`camp()`, `phase()`, `newCampaign()`, `startFlight()`, `buy(id)`, `setDiff(d)`).

## Definition of Done
- `node podryad/tests/engine.test.mjs` — все тесты зелёные (включая бота); `node tools/smoke.mjs` — PASS podryad.
- В браузере: титул → ангар (Enter) → вылет → пауза (P) → T/L/M работают; 0 ошибок консоли.
