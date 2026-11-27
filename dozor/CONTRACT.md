# ОБОЗ (папка dozor) — контракт модулей

Игра аркады «Гефест» на фреймворке Гефест Arcade v2.2 (`engine.js`). Общий стандарт: офлайн, `file://`,
без внешних URL/шрифтов/ассетов, RU/EN, темы modern/retro (меняют только отрисовку), WebAudio-звук,
рекорд в `localStorage` (`arcade.best.dozor`), число игроков — `arcade.players.dozor` (движок).
Права: название, герои, артель, машины, крепости, этапы, арт, палитры, звуки и музыка — оригинальные;
чужих имён, реальных армий и реального оружия нет (тест «правило имён» в `tests/engine.test.mjs`).

## js/game.js — `DOZOR.Game(opts)` (без DOM, детерминирована при заданном `rng`)
`opts`: `{ rng, players=1|2, stage=1, maxStage=6, continues=2, onEvent(type,data), map?, boss?, pats?, levels? }`.
Экран 480×640: HUD 40 px, окно мира 480×600, клетка `T=24`, 20 колонок; камера только вверх. Все объекты: `x, y` — центр.
API: `start()` · `update(dt)` · `setDir(pi,dx,dy)` · `setFire(pi,held)` · `sec(pi)` (заслон) · `cont()` · `reviveAd()` · `boost()`/`canBoost()` · `state()`.
Отладка: `_S`, `_spawn`, `_blast`, `_kill`, `_boxFree`, `_cell`, `_cellSolid`, `_hurtBoss`, `_bossOpen`, `_clear`.
`S`: `stage, players, score, phase('play'|'cont'|'clear'|'over'|'won'), hold, heroes[{x,y,alive,out,lives,inv,face,ang,fire,cd,scd,wag[{hp,max,armor,flash,cd,kick}],wp[{x,y,hx,hy}],path[]}],
enemies, bullets[{x,y,vx,vy,pi,wg?,life?}], ebullets, booms, marks, loose[{x,y,hp,armor,t}], posts[{pi,x,y,t,max}], depots[{x,y,hp,max,flag,n,dead}], trains, boss{...,open}, kills, lost, boosts`.
События: `mg, hit, wall, boom, block, kill, hook{pi,n}, wagHit, wagDie, wagCut{n}, scatter, wagLostFar, post, postShot, depotHit, depot, eshot, heroDie{wagons}, out, respawn,
extraLife, contAsk, continue, bossIntro, bossHit, bossShield, phase, bossShot, mortar, spawn, sweep, bossBoom, bossDie, clear{bonus,wagons}, gameover, win, stage, trainWarn, train, heli`.
Правила:
- Тягач: скорость 108, коробка 20×20, попадание — радиус 8; пулемёт `MG` 0.11 с, 430 px/с, только вверх.
- Обоз `WAG`: ≤ 5 вагонов, первое звено 24 px, далее 20 px вдоль следа тягача; вагон бьёт в обе стороны перпендикулярно курсу (0.5 с, 290 px/с, жизнь пули 0.62 с); hp 2 (бронированный 4);
  пуля врага (3 радиус) бьёт вагон на 1, снаряд — на 2, взрыв — на 2; разбитый вагон — исчезает, задние — в `S.loose`. Пехоту давят тягач и вагоны. Поезд разбивает вагон касанием.
- `S.loose`: брошенные вагоны; подбор < 18 px, пока вагонов < 5 (`t` — пауза после выпадения). Ниже кадра — потеряны (`lost`).
- Заслон `POST`: `sec()` отцепляет последний вагон → турель 9 с (4 пули на круг, пауза 0.42 с, поворот на 45° через залп), затем `blast` (r 44, урон 5, воздух); ≤ 2 на игрока.
- Депо `DEPOT_HP`=10: ломают пули тягача и вагонов (и взрывы); выпадают 2 вагона (с маяком — 3, первый бронированный).
- Станция: 6×3 ядро; пока живы орудия (`enemy.boss`) — `bossOpen()` ложь и урон по ядру гасится (`bossShield`); потом бьют пули (здоровье 90+26·(этап−1), ×1.5 вдвоём),
  фазы по трети здоровья (0.8 с неуязвимости), приёмы `PATTERN_CD`. Пала → `clear` (бонус 3000·этап + 300·вагон) → следующий этап или `win`; `S.hold` — ждать действия игрока (реклама).
- Жизни 3, возрождение через 1.6 с (неуязвимость 2.6 с) с одним вагоном; +1 жизнь каждые 27000; продолжения (10 с); `reviveAd()` — награда за ролик.
`DOZOR.logic`: константы, `BIND`, `MG`, `WAG`, `POST`, `ENEMIES`, `CAR`, `SCORE`, `STAGES`, `CELL`, `genStage(n)`, `solveMap` (путь без взрывов), `params`, `mulberry32`.

## Рендер и интерфейс
`DOZOR.modern` / `DOZOR.classic` — палитры (`pixel`, цвета мира и интерфейса). `DOZOR.render.world(ctx, S, P, time)` — мир в мировых
координатах. `DOZOR.ui.render(g, ctx, S, P, {bare,toasts,shake})` — кадр (retro — буфер ½ и ×2), HUD, полоса крепости, баннеры, «Продолжить?».

## main.js
`Arcade.createGame({gameId:'dozor', leaderboard:'dozor'})`, `useStandardScreens`, `usePlayers({bind: logic.BIND, actions:['fire','sec'], touch, hint, pad})`,
титул — панорама «Песчаного тракта», сцена `play` (ввод `g.input.player(i)` → `setDir/setFire`, нажатия → `sec`, в окне продолжения —
`cont`), P на паузе — продолжить. Отладка/QA: `DOZOR.g`, `DOZOR.app.game()`, `DOZOR.app.newGame({stage})`.

## Definition of Done
- `node dozor/tests/engine.test.mjs` — все тесты зелёные (включая баланс ботом); `node tools/smoke.mjs` — PASS dozor.
- В браузере: титул → игра (Enter) → пауза (P) → T/L/M работают; 2 игрока независимы; 0 ошибок консоли.
