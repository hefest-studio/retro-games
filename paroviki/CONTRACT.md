# ПАРОВИКИ — контракт модулей

Игра аркады «Гефест» на фреймворке Гефест Arcade v2.2 (`engine.js`). Общий стандарт: офлайн, `file://`,
без внешних URL/шрифтов/ассетов, RU/EN, темы modern/retro (меняют только отрисовку), WebAudio-звук,
рекорд в `localStorage` (`arcade.best.paroviki`), число игроков — `arcade.players.paroviki` (движок),
сохранение — `arcade.paroviki.save`, выбор героев — `arcade.paroviki.heroes`.
Права: название, герои, мастерская, Машина, чудища, механизмы, миры, арт, палитры, звуки и музыка — оригинальные;
чужих имён нет (тест «правило имён» в `tests/engine.test.mjs`, стоп-лист в base64).

## js/game.js — `PAROVIKI.Game(opts)` (без DOM, детерминирована при заданном `rng`)
`opts`: `{ rng, seed, players=1|2, heroes:[hid0,hid1], world, lvl, save?, ai=true, onEvent(type,data) }`.
`players=1` — второго героя ведёт ИИ (`S.aiOn`); `save` — объект `progress()` или расшифрованный пароль.

Экран 640×512: HUD 32 px, вид 640×480 (`W×VH`) на мир под камерой; клетка `T=32`. Все объекты: `x, y` — центр.

API: `start()` → api · `update(dt)` (≤ 1/20) · `setMove(pi, dx, dy)` · `setFire(pi, on)` · `special(pi)` → bool · `cont()` → bool ·
`state()` → S · лавка: `shopItems(pi)`, `price(pi,item)` → число|null, `buy(pi,item)` → bool, `shopReady(pi)`, `aiShop(pi)` ·
`progress()` → объект сохранения · `password()` → строка · `maxHp(team)`, `valvesLeft()`, `nextLevel()`.
Отладка/тесты: `_S`, `_loadLevel(w,l)`, `_addEnemy(type,x,y)`, `_hitsWall(x,y,r)`, `_bfsFrom(points,maxD)`, `_fieldAt`, `_downhill`,
`_los(a,b)`, `_warp(hero)`, `_hurtHero(h,dmg,src)`, `_levelDone()`, `_openShop()`.

`S`: `phase('play'|'clear'|'shop'|'cont'|'over'|'won'), world, lvl, players, aiOn, score, continues, contT, keys, exitOpen, chartT, banner,
map{TW,TH,CW,CH,tiles,groups[{id,kind:'door'|'bar',tiles,open}],start,exit,boss}, objs[{kind:'valve'|'key'|'lever'|'coin'|'food'|'chest'|'charge',…}],
team[{hid,gun,hpL,mA,mB,spec,money,lives,hp}], heroes[{id,t,x,y,r,hp,maxHp,face,aimA,mx,my,fire,cd,alive,out,down,downT,inv,shieldT,ai,aiS}],
enemies[{id,type,x,y,r,hp,max,spd,stun,tele,parent}], shots[{x,y,vx,vy,dmg,r,pierce,bounce,splash,pi,gun}], eshots, bombs, fx,
boss{key,x,y,r,hp,max,armor,armorMax,mode,intro,dead}|null, cam{x,y}, seen, field, field1, shop[{sel,ready,bought}]`.

События `onEvent`: `level{world,lvl,boss}`, `shot{pi,gun}`, `hit`, `chip`, `bounce`, `kill{type,x,y,pi}`, `boom{x,y,r}`, `spawn`, `eshot`, `block`,
`hurt{pi}`, `heroDie{pi,x,y,src,ai}`, `out{pi}`, `respawn{pi}`, `revive{pi}`, `warp{pi,x,y,fx,fy}`, `coin{v,pi}`, `chest{v}`, `food{pi}`, `key`,
`charge`, `lever`, `open{kind}`, `secret`, `crate`, `valve{x,y,left}`, `exitOpen`, `special{pi,kind}`, `windup`, `charge`, `thud`, `drop`,
`bossHit`, `armorDown{left}`, `bossDie`, `levelDone{world,lvl,bonus,boss}`, `shop{next}`, `buy{pi,item,price}`, `contAsk`, `continue`,
`gameover`, `win`.

Правила:
- Клетки `TILE`: пол 0, стена 1, трещина 2 (5 ед. прочности), дверь 3, заслонка 4, провал 5 (держит ход, пропускает выстрелы),
  ящик 6 (3 ед.), литейка 7. Герой — круг r=11 по клеткам, скольжение у углов. Огонь — в сторону взгляда (8 сторон);
  пока огонь зажат, взгляд не меняется. ИИ целится свободно.
- Генератор `genLevel(world, lvl, seed)`: ячейки 3×3 + стена 1, лабиринт DFS + 16% петель, залы (убранные столбы).
  Старт — нижний угол, шлюз — самая дальняя ячейка. Тайники — тупики за трещиной (сундук + еда). Двери/заслонки — на мостах графа
  ячеек (по проходу целиком), не вложенные; ключей = дверей, все ключи — в зоне старта без дверей; рычаг заслонки достижим при открытых
  дверях. Вентилей `valveCount = min(6, 2 + мир + [ур ≥ 3])`, по одному за каждой дверью/заслонкой, остальные — дальние друг от друга.
  Литейки — `min(6, 1 + мир + ⌊ур/2⌋)`, чудища — по ячейкам. Проверка `solveLevel(m)` (симуляция ключей и рычагов) — иначе пересборка.
  Уровень 5 — арена `genBoss(world)` 21×17 с колоннами и 2/2/3/4 вентилями.
- `astar(m, from, to, open)` — путь по клеткам (для тестов), `bfsTiles`, `passableFn`.
- Чудища `EN`: tin (4 ед., 82 px/с, 14 урона), bug (2, 135, 9), whistle (5, держит 140–230 px, свист 0.55 с → снаряд/веер из 3 с мира 3),
  heavy (14, 55, 24), nest (18; плодит раз в ~3 с, ≤ 5 своих, вдвоём ≤ 6; всего на уровне ≤ 90). Прочность ×(1+0.4·(мир−1)), вдвоём ×1.25.
  Чудища идут по полю расстояний от героев (BFS 8-связн., раз в 0.25 с), спят дальше 15 клеток, расталкиваются.
- Вентиль: герой в 22 px 0.6 с (прогресс спадает вдвое медленнее). Все открыты → `exitOpen`; человек в шлюзе → `clear` (бонус 1000·мир)
  → лавка или `won` после механизма мира 4.
- Механизмы `BOSSES`: drill 320, crane 420, pendulum 480, machine 700 (вдвоём ×1.5, с ИИ ×1.15). Броня = закрытые вентили арены: урон ×0.25;
  открытый вентиль снимает 8% прочности.
- ИИ-напарник (`aiUpdate`): цель огня — ближайшее видимое чудище на экране ≤ 290 px (механизм ≤ 360), раз в 0.2 с; шаг — лучший из 9
  (8 сторон + стоять) по оценке: следование по полю от игрока (`field1`), дистанция до чудищ (75–95 px), прогноз снарядов на 0.15/0.3 с,
  гири; находки (монеты/ключи/заряд/вентиль/еда-если-нужнее) — если игрок не дальше 4 (вентиль — 6) клеток, бросает при отставании > 5.
  Отстал > 3 клеток — скорость ×1.3. Рывок к игроку: поле > 13, нет продвижения 2.5 с или вне экрана 2.2 с (пауза 1.5 с).
  Выбыл — `down` 12 с, затем встаёт у игрока с 50% здоровья.
- Деньги: любая находка делится пополам (`gainMoney`). Еда +35, сытый не берёт.
- Жизни 3 (+ «Запасная жизнь»), возрождение через 1.4 с на месте (2.5 с неуязвимости); все люди выбыли → `cont` (10 с), продолжений 2.
- Лавка `SHOP`, `SHOP_ITEMS(hid)`: gun, hp, heal, spec, две ветки `HEROES[hid].tree`, ready.
- Пароль `encodePass(p)` / `decodePass(s)`: 50 бит (мир, уровень, игроков, по герою: hid, ступень, котёл, ветки, заряды, деньги/50) + сумма 8 бит,
  алфавит `ALPHA` из 32 знаков без I/O/0/1 (при вводе 0→Q, 1→L), маска по позиции.

`PAROVIKI.logic`: константы, `TILE`, `HEROES`, `GUNS`, `SHOP`, `SHOP_ITEMS`, `EN`, `WORLD_MIX`, `BOSSES`, `SCORE`, `BIND`, `mulberry32`, `genLevel`,
`solveLevel`, `astar`, `bfsTiles`, `passableFn`, `tileOf`, `valveCount`, `levelDims`, `encodePass`, `decodePass`, `ALPHA`.

## Рендер и интерфейс
`PAROVIKI.modern` / `PAROVIKI.classic` — палитры (`pixel`, `worlds[1..4]`, цвета объектов и интерфейса).
`PAROVIKI.render.world(ctx, S, P, time, view)` — мир в мировых координатах (только видимые клетки).
`PAROVIKI.ui.render(g, ctx, S, P, {bare,toasts,shake,game,flash})` — кадр: мир под камерой (retro — буфер ½ и ×2), подписи над героями,
стрелки к шлюзу/вентилям, мини-карта разведанного, HUD двух героев, полоса механизма, баннеры, «Продолжить?», лавка.

## main.js
`Arcade.createGame({gameId:'paroviki'})`, `useStandardScreens`, `usePlayers({bind: logic.BIND, actions:['fire','spec'], touch, hint, pad})`,
пункты меню: `play`, `cont` (если есть сохранение), `players`, `hero1`, `hero2`, `pass`; сцена `password` (буквы с клавиатуры, ↑↓←→, Enter, Esc).
Сцена `play`: ввод `g.input.player(i)` → `setMove/setFire`, `onPress('spec')` → `special`, в лавке ↑↓ + огонь; клик по строке лавки.
Титул — живая сцена: двое паровиков отбиваются от чудищ. Отладка/QA: `PAROVIKI.g`, `PAROVIKI.app.game()`, `PAROVIKI.app.newGame(save)`.

## Definition of Done
- `node paroviki/tests/engine.test.mjs` — все тесты зелёные (включая баланс ботом и детектор застревания ИИ); `node tools/smoke.mjs` — PASS paroviki.
- В браузере: титул → игра (Enter) → пауза (P) → T/L/M работают; 2 игрока независимы; лавка, пароль; 0 ошибок консоли.
