# ФИТИЛЬ — контракт модулей

Игра аркады «Гефест» на фреймворке Гефест Arcade v2.2 (`engine.js`). Общий стандарт:
офлайн, `file://`, без внешних URL/шрифтов/ассетов, RU/EN, темы modern/retro (меняют
только отрисовку), WebAudio-звук, рекорд в `localStorage` (`arcade.best.fitil`).
Ключи хранилища: `arcade.best.fitil`, `arcade.players.fitil` (движок, `usePlayers`), `arcade.ff.fitil` (огонь по своим).
Права: название, механика-формулировки, уровни, арт, палитры, звуки и музыка — оригинальные; чужих имён нет.

## js/game.js — `FITIL.Game(opts)` (без DOM, детерминирована при заданном `rng`)
`opts`: `{ rng, players=1|2, level=1, maxLevel=9, lives=3, friendlyFire=false, difficulty(level,base,step,max), onEvent(type,data) }`.

Поле 15×13 клеток (`COLS`, `ROWS`), рендер — клетка 40 px под HUD 48 px. Клетки: `FLOOR=0`, `WALL=1`, `CRATE=2`.
Старт: И1 (1,1), И2 (13,11). Координаты сущностей — в клетках (дробные при движении; центр клетки — целое).

API: `start()` → api · `update(dt)` · `setDir(pi, dx, dy)` (−1/0/1 по осям; зажаты обе — пробует повернуть) ·
`bomb(pi)` → bool · `detonate(pi)` → число подорванных · `setFF(bool)` · `state()` → S.

`S`: `level, maxLevel, score, phase('ready'|'play'|'clear'|'over'), phaseT, time, levelT, banner, name, over, won, ff, nplayers, nextLife, clearBonus,
grid[], items{cell:kind}, hidden{cell:kind}, hatch{x,y,open}, bombs[{x,y,owner(0|1|-1 Жернов),fuse,relay,r,slide{dx,dy}|null,t,chain}],
flames{cell:{t,mask(1 И1|2 И2|4 Жернов),h,v,c,end}}, debris[{x,y,t}],
enemies[{type,x,y,tx,ty,px,py,dir,speed,t}], boss{x,y,tx,ty,hp,max,inv,flash,spawnT,bombT,speed,alive}|null,
players[{i,x,y,alive,lives,out,bombs,flame,speed,kick,relay,inv,deadT,want,face,walk,moving}]`.

События `onEvent`: `level{level}`, `bomb{x,y,owner}`, `boom{x,y,r,chain}`, `crate{x,y}`, `reveal{x,y,kind}`, `power{player,kind,x,y}`,
`kick{x,y}`, `stop`, `detonate{owner}`, `kill{x,y,type,score}`, `die{player,x,y,lives,why:'fire'|'enemy'|'boss'}`, `respawn{player}`,
`spawn{x,y}`, `bossHit{x,y,hp}`, `bossDie{x,y}`, `open{x,y}`, `life{score}`, `clear{level,bonus}`, `gameover{score}`, `win{score}`.

Правила:
- Движение — по коридорам с «доводкой» на углах (вне линии ряда — сначала выравнивание, если впереди свободно; при смещении > 0,22 — к соседнему ряду). Скорость 3,6 + 0,55×ПРЫТЬ клеток/с.
- Бомба ставится в клетку под центром подрывника; не больше `bombs` своих на поле; с клетки своей бомбы уйти можно, зайти на бомбу — нельзя (с ТОЛЧКОМ — пинок, бомба катится 9 клеток/с до стены/ящика/бомбы/врага/игрока).
- Взрыв: `blast(grid,x,y,r)` — крест, стена гасит луч, ящик ломается и гасит луч, бомба в кресте взрывается в тот же кадр (цепочка). Пламя живёт 0,55 с; гибнет всё, у кого центр в клетке с пламенем.
- Огонь по своим: игрок ранится пламенем со своей меткой или меткой Жернова всегда, пламенем напарника — только при `ff`.
- РЕЛЕ: бомбы игрока с РЕЛЕ не горят, пока хозяин жив; `detonate` взрывает все свои разом; гибель хозяина — фитиль загорается.
- Враги ходят поклеточно; бомба на пути — разворот; шатун/юла бродят (юла чаще сворачивает), ищейка в пределах `CHASE_R=6` идёт кратчайшим путём (в 60 % решений), мгла проходит сквозь ящики и в 40 % решений тянется к подрывнику. Касание — |dx|,|dy| < 0,5.
- Скорости врагов × `difficulty(level, 1, 0.025, 1.2)`.
- Люк открыт ⇔ врагов нет и Жернов (если есть) расколот; вход (центр в клетке люка) → `clear` (+500×уровень + бонус за время) → следующий уровень / `win`.
- Гибель: `lives−1`, ТОЛЧОК и РЕЛЕ сброшены, через 2,2 с возрождение в своём углу с неуязвимостью 2,6 с; `lives=0` → выбыл. Выбыли все → `gameover`. +1 жизнь каждому невыбывшему за каждые 10 000 очков.

`FITIL.logic`: константы, `BIND` (раскладки И1/И2 для `g.usePlayers`), `LEVELS` (9: враги, плотность ящиков, бонусы, узор стен),
`WALLS`, `POWERS`, `ENEMY`, `buildLevel(n,rng)` → `{grid,hidden,hatch,enemies,boss}`, `blast`, `bfs`, `connected`.

## Рендеры
`FITIL.modern` / `FITIL.classic`: `{ P, bg(ctx,g), draw(ctx,S,g,{bare,toasts}), glyph(ctx,kind,x,y,scale), face(ctx,x,y,i,scale) }`.
`bare` — без HUD (фон титула). `FITIL.ui.hud/banner/toasts/panel(...)` — тексты только через `g.t()`.

## main.js
`Arcade.createGame({gameId:'fitil'})` с палитрами тем, `useStandardScreens` (титул переопределён: поле на фоне + меню движка),
`g.usePlayers({bind: FITIL.logic.BIND, actions:['bomb','det'], touch:{…A:'bomb'}, hint})`, пункт `g.menu.addItem({key:'ff', after:'players'})`,
сцена `play` (ввод — `g.input.player(i).dir/onPress`). Тач-кнопка `[data-det]` — подрыв РЕЛЕ у И1. Отладка/QA: `FITIL.g`, `FITIL.app.game()`.

## Definition of Done
- `node fitil/tests/engine.test.mjs` — все тесты зелёные (логика, кооп-ввод через движок, музыка, строки, правило имён, баланс-бот); `node tools/smoke.mjs` — PASS fitil.
- В браузере: титул → игра (Enter) → пауза (P) → T/L/M работают; в режиме 2 игроков оба двигаются независимо; 0 ошибок консоли.
