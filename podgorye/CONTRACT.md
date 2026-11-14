# ПОДГОРЬЕ — контракт модулей

Игра аркады «Гефест» на фреймворке Гефест Arcade v2.2 (`engine.js`). Общий стандарт: офлайн, `file://`, без внешних
URL/шрифтов/ассетов, RU/EN, темы modern/retro (меняют только отрисовку), WebAudio-звук и музыка, рекорды в `localStorage`.
Права: название, сеттинг (Подгорье, Спящие Горны, Сердце Горы, Печать Горнов), Огнёвка, фонарь-искра, способности,
враги, боссы, мир, арт, палитры, звуки и музыка — оригинальные; чужих имён нет (тест «правило имён»).

## Координаты
Клетки комнаты: `x` — центр Огнёвки, `y` — подошвы; клетка `(c, r)` = `[c, c+1) × [r, r+1)`. Экран мира = 40×22 клетки,
сетка мира 34×19 экранов. Переход между комнатами — `P.cross(W, room, hero)` (центр героини за краем → соседняя комната).

## js/physics.js — `PODGORYE.T`, `PODGORYE.K`, `PODGORYE.phys`
Тайлы `T`: AIR, ROCK, ONE (мостки), SPIKE, CRACK (треснувший пол), IRON (чугун), STEAM (паровая завеса), HEAT (жар),
WATER, LIGHT (световая створка), FALSE (ложная стена), ICE, SEAL (печать), SHUT (решётка арены), HOTW (горячая вода).
`phys.stepHero(h, inp, R, dt, ab, ev)` — шаг 1/60; `inp {x,y,jump,dash,hook,slam}` — удержания (фронты внутри);
`ab {boots,dash,gloves,hook,hammer,bell,cloak,light}`. События: `jump, djump, walljump, dash, hook, release, unhook, slam,
slamLand, splash, land, cling, heat, spike`. После шага `h.hit = 'spike'|'heat'|null`. `R {W,H,t,rings[]}` (+флаги
`fWater/fSteam/fHaz` — `phys.roomFlags(R)`). Также `tile, ringFor, touchWall, boxSolid, group, newHero`.

## js/world.js — `PODGORYE.WORLD()` (кэш) / `buildWorld()`
`{ rooms[], areas, zones, items[], groups[], anvils[], lifts[], forges[5], bossRooms{id→room}, start{room,x,y,anvil}, grid, roomAt(gx,gy) }`.
Комната: `{ i, area, zone, gx, gy, w, h, W, H, kind ('normal'|'start'|'save'|'lift'|'shrine'|'arena'|'forge'|'heart'|'treasure'|'gate'),
t (Uint8Array), doors[{side,k,to,gate}], items[{id,type,x,y,boss?,bar?}], objs[{type:'anvil'|'lift'|'forge'|'heart'|'boss',…}],
rings[{x,y}], ens[{type,x,y}], groups[], gAt, dark, wet }`. Типы предметов: `ab:<способность>`, `vessel`, `tank`, `up:spread|pierce|charge|rapid`.
`AREAS` — области с гарантированным набором способностей и воротами (`type`: boots/dash/gloves/hook/hammer/bell/cloak/light/seal).

## js/enemies.js — `PODGORYE.EN` · js/bosses.js — `PODGORYE.BS`
`EN.make(def, rng)`, `EN.update(e, G, dt)`, `EN.box(e)`, `EN.blocks(e, shot)` (щит). `BS.make(id, R)`, `BS.update(B, G, dt)`,
`BS.hitPart(B, x, y, pad)`; боссы: `gatekeeper, pump, drill, pendulum, smelter, smith, scale` (2 фазы). Контекст `G`:
`{hero, R, rng, solid, water, los, shot(x,y,vx,vy,o), haz(o), spawn(type,x,y), ev}`.

## js/game.js — `PODGORYE.Game(opts)` (без DOM, детерминирована при заданном `seed`)
`opts {world, save, seed, onEvent(type,data), god, dmgMul, noEnemies}`. API: `start() · update(dt) · setInput({x,y,jump,shoot,dash,hook,beam})
· state() · snapshot() · percent() · liftMove(d) · liftGo() · liftCancel() · liftList()`; хуки тестов `_place, _give, _enter, _bossNow, _hurt, _open, _forge`.
`S { phase ('play'|'dead'|'lift'|'won'), room, R (рабочая копия комнаты: t, ens, shots, eshots, drops, haz), hero, hp, spark, boss,
prog {ab, items, forges, bosses, opened, visited, lifts, anvil, hpMax, tanks, ups}, time, deaths, zone, near }`.
События: `start, room, newRoom, zone, save{data}, ability, vessel, tank, upgrade, item, forge{n}, sealOpen, liftOn, liftMenu, travel,
open{kind}, shot, bigShot, charged, hit, kill, clang, hurt, die, respawn, bossStart, bossHit, bossDown, phase2, eshot, warn, win{time,pct,deaths}` + события физики.

## js/save.js — `PODGORYE.SV`
`load(i) · save(i, data) · clear(i) · list() · migrate(obj) · legacy() · records() · record(time, pct)`; ключи `arcade.podgorye.slot1..3` (v2),
старый `arcade.save.podgorye` (v1) → свободный слот; рекорды `arcade.besttime.podgorye`, `arcade.bestpct.podgorye`.

## js/render.js — `PODGORYE.R` · js/ui.js — `PODGORYE.UI`
`R.draw(g, ctx, S, ui{shake, after(cam)})` — кадр (фон, кэш статики комнаты по комнате+теме+ревизии, объекты, враги, босс,
снаряды, Огнёвка, свет и тьма). `UI.hud, worldMap, liftMenu, banners, slotsScreen, titleArt`.

## js/main.js
Сцены: `title` (перерисован; «Играть» → `slots`), `slots` (3 слота, X/Del — стереть), `play`, `pause` (карта мира + меню), `win`.
Музыка: зона → `PODGORYE.MUSIC[zone]`, бой → `boss`/`final`. Отладка: `PODGORYE.app.game()`.

## tests/
`engine.test.mjs` — всё вышеперечисленное; `bot.mjs` — `makeNav` (граф по физике: узлы опоры/зацепа/колец/воды, рёбра —
программы ввода через `stepHero`, кэш по семействам программ), `solveOrders` (все порядки способностей, софтлоки, ловушки),
`playZone1` («человеческий» бот), `bossBot` (бот без урона).
