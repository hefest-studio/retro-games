# ОТСЕК — контракт модулей

Игра аркады «Гефест» на фреймворке Гефест Arcade v2.2 (`engine.js`). Общий стандарт: офлайн, `file://`,
без внешних URL/шрифтов/ассетов, RU/EN, темы modern/retro (меняют только отрисовку), WebAudio-звук,
рекорд в `localStorage` (`arcade.best.otsek`), число игроков — `arcade.players.otsek` (движок).
Права: название, герои, бригада, станция, паразиты, боссы, арт, палитры, звуки и музыка — оригинальные;
чужих имён нет (тест «правило имён» в `tests/engine.test.mjs`, стоп-лист в base64).

## js/game.js — `OTSEK.Game(opts)` (без DOM, детерминирована при заданном `rng`)
`opts`: `{ rng, seed, players=1|2, deck=1, maxDeck=6, tokens=100, onEvent(type,data), decks? }` (`decks[n-1]` — своя палуба для тестов).

Экран 640×512: HUD 32 px, вид 640×480 (`VIEW_W×VIEW_H`) со сдвигом камеры. Тайл `T` = 24 px; палуба — сетка отсеков
`rx×ry` по `CW×CH` = 14×11 тайлов. Тайлы: `FLOOR` 0, `WALL` 1, `PART` 2 (перегородка, режет только резак), `DOOR` 3 (закрытая дверь).
Все объекты: `x, y` — центр в пикселях палубы.

API: `start()` → api · `update(dt)` (подшаги ≤ 1/60) · `setMove(pi, dx, dy)` (−1/0/1) · `setFire(pi, on)` · `use(pi)` →
`'term'|'console'|'door'|'denied'|null` · `swap(pi)` · `hint(pi)` → `'term'|'console'|'door'|'locked'|null` ·
терминал: `termMove(±1)`, `termTab(±1)`, `termBuy()` → `'ok'|'money'|'owned'|'full'|null`, `termClose()`, `buy(pi,id)`, `canBuy(pi,id)` · `state()` → S.
Отладка/тесты: `_S`, `_spawn(type,x,y,o)`, `_loadDeck(n)`, `_los`, `_solidAt`, `_circleHits`, `_kill(hero,src)`, `_hurtBoss(d)`,
`_bossVuln()`, `_startAlarm(x,y)`, `_buildFlow()`, `_openDoor(door,pi)`, `_inAirlock(h)`, `_roomOf(x,y)`.

`S`: `deck, maxDeck, players, score, tokens, cards (общие), phase('play'|'term'|'clear'|'over'|'won'), phaseT, time, banner,
D (палуба генератора), tiles (живая копия), doors[{id,tiles,path,k,x,y,horiz,open,t}], terminals[{id,x,y}],
cardsOnFloor[{x,y,spare,taken}], items[{kind:'ammo'|'med'|'tok'|'cache',x,y,v,taken}],
heroes[{id,x,y,hp,lives,alive,out,deadT,inv,face[dx,dy],mx,my,fire,cd,weapon,guns{},ammo,armor,moving,inAir,swing,hurtT,kills}],
enemies[{id,type,x,y,r,hp,max,speed,awake,flash,t,cd,warn,bite,spawnT,kids,parent,boss,slot,vx,vy}], bullets[{k:'r'|'p'|'c'|'f'|'n',pi,x,y,vx,vy,dmg,r,life,pierce}],
sparks[{x,y,vx,vy,life}], boss{key,x,y,r,hp,max,active,intro,dead,open,rot,nodes[]}|null, alarm{t,max,done}|null, airOpen, consoleOn,
term{pi,id,tab,sel}|null, mapOwned, lamp(0–2), seen(Uint8Array), flow, kills, cardsUsed, cardsWasted, bought{}, deckStats[{deck,cards,doors,t}], lastBonus, lastLeft`.

События `onEvent`: `deck{n}`, `card`, `door{id,path,pi,x,y}`, `doorDenied`, `term`, `termMove`, `termClose`, `buy{pi,id}`, `noBuy{why}`,
`swap`, `shot{pi,w}`, `swing`, `empty`, `hit`, `wallHit`, `breach`, `kill{type,x,y,pi}`, `wake`, `spawn`, `vent`, `spark`, `sparkWarn`,
`heroHurt{pi,src}`, `heroDie{pi,x,y,src}`, `out{pi}`, `respawn{pi}`, `pickup{kind,x,y,pi}`, `console`, `alarm{t}`, `countdown{s}`,
`clear{deck,bonus,left,blast?}`, `blast`, `bossIntro{key}`, `armor`, `bossHit`, `ring`, `heartOpen`, `bossDie`, `gameover`, `win`.

Правила:
- Герой: скорость 125 (диагональ нормирована; с зажатым огнём ×0.82), радиус 8, здоровье 100, 3 жизни, после удара 0.3 с
  неуязвимости, после гибели — возрождение на месте через 1.6 с с неуязвимостью 2.2 с. Упёрся в угол проёма — соскальзывает.
  Направление (`face`, луч фонаря) меняется ходом, пока огонь не зажат.
- `GUN` (патроны общие, максимум 300, старт 120): rivet (0.2 с, −1), fan (5 заклёпок, −3), cutter (урон 3, пробивает 3, режет `PART`, −2),
  flame (0.05 с, −1 на 3 выстрела, пробивает), nail (0.075 с, −1); без патронов — wrench (вплотную). Доводка rivet/cutter/nail — до 0.4 рад.
- `ENEMIES` (здоровье ×(1+0.07·(палуба−1)), скорость ×(1+0.04·(палуба−1)), урон ×(1+0.05·(палуба−1)); вдвоём здоровье ×1.5):
  tick, carpet (→ 2 tick), spike (вспышка 0.55 с → искра по прямой видимости), nest (≤ 4 детей), node/vein (узлы боссов).
  Рой ползёт по полю расстояний от героев (BFS по тайлам, раз в 0.25 с). Вентиляция: клещ в 6–22 клетках по ходам,
  раз в 8–12 с (на тревоге — 1.6–3.4 с, по 1–2).
- Двери: `use` рядом (≤ 48 px от центра) тратит карту; дверь пути (`path`) или кладовой. Терминал: ≤ 34 px. Пульт: ≤ 40 px.
- Эвакуация: `alarmTime(D, tiles, x, y, n)` = путь до шлюза / 125 × (2.15 − 0.05·n) + 14 с. Клир: все не выбывшие живы и в шлюзе
  → бонус `2000·палуба + 50·секунды`, жетоны `100 + 2·секунды`; таймер 0 → взрыв: снаружи −1 жизнь, палуба засчитана без бонуса.
- Боссы `BOSSES`: matka (70, 4 катушки по 12; ядро уязвимо без катушек), heart (80, 3 вены; уязвимо раскрытым 2.2 с из 4.2 или без вен).

## Генератор и поиск — `OTSEK.logic`
`genDeck(n, seed)` → `{ n, w, h, pw, ph, tiles, rooms[{x0,x1,y0,y1,c,cx,cy,ccol,crow,lit}], start, goal, path[], zone[], pathZones[],
vaults[], doors[], cards[{x,y,zone,spare}], terminals[], items[], mobs[], caches[], airlock{tx0,tx1,ty0,ty1,x0,x1,y0,y1}, spawn, objective{x,y,kind,cell,boss},
pathDoors, edges[] }`: остовное дерево коридоров (DFS) + петли внутри зоны, `doors` дверей на пути старт→цель, кладовые — листья
вне пути, карта для двери k — в зоне перед ней, терминал — в каждой зоне пути.
`solveDeck(D)` → `{ ok, minCards, cards, pathDoors, states, deadEnds, softlocks[], regions, goalRegion, airRegion, startRegion }` —
BFS по маскам вскрытых дверей (регионы — компоненты проходимых тайлов). `regionsOf(D, tiles?)`, `tilePath(D, tiles, sx, sy, gx, gy, passDoor?)`,
`alarmTime`, `oct`, `mulberry32`; константы `T, VIEW_W, VIEW_H, HUD, SCREEN_H, CW, CH, SPEED, HERO_R, HP, LIVES, AMMO0, AMMO_MAX, TOKENS0,
USE_R, DECKS, MAX_DECK, GUN, WEAPONS, ENEMIES, SHOP, SCORE, BOSSES, BIND`.

## Раскладка `BIND` (через `g.usePlayers`)
И1: ←→↑↓, fire `/`, Space, Numpad/; use `.`, правый Shift; swap `,`. И2: WASD, fire F, левый Shift; use E; swap Q.
Конфликтов с горячими клавишами движка нет (тест). Тач (И1): `[data-d]` U/D/L/R/A через движок, `[data-act=use|swap]` — свои, `[data-pause]`.

## js/render.js — `OTSEK.render`
`world(ctx, S, P, time, cam, vw, vh, dark, scale)` — тайлы, шлюз, терминалы, пульт, карты/припасы, двери, рой, босс, герои, выстрелы;
слой темноты `dark` с «вырезанными» источниками света (лучи до стен), угольки роя поверх. `map(ctx, S, P, x, y, w, h, time)` — карта палубы.

## js/ui.js — `OTSEK.ui`
`init(g)`, `render(g, ctx, S, P, {bare, toasts, game, shake})`, `camera(S)`, `panel`, `txt`, `up`. Тексты — только через `g.t()`.

## js/main.js
Сборка: `Arcade.createGame({gameId:'otsek', width:640, height:512, strings, themes})`, `useStandardScreens`, `usePlayers`,
титул — палуба во тьме с роем, сцена `play`. Для автотестов в браузере: `OTSEK.app = { g, game(), newGame(o), demo }`.
