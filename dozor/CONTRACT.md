# ДОЗОР — контракт модулей

Игра аркады «Гефест» на фреймворке Гефест Arcade v2.2 (`engine.js`). Общий стандарт: офлайн, `file://`,
без внешних URL/шрифтов/ассетов, RU/EN, темы modern/retro (меняют только отрисовку), WebAudio-звук,
рекорд в `localStorage` (`arcade.best.dozor`), число игроков — `arcade.players.dozor` (движок).
Права: название, герои, артель, машины, крепости, этапы, арт, палитры, звуки и музыка — оригинальные;
чужих имён, реальных армий и реального оружия нет (тест «правило имён» в `tests/engine.test.mjs`).

## js/game.js — `DOZOR.Game(opts)` (без DOM, детерминирована при заданном `rng`)
`opts`: `{ rng, players=1|2, stage=1, maxStage=6, continues=2, onEvent(type,data), map?, boss?, pats?, levels? }`
(`map` — своя ASCII-карта по 20 символов для тестов; `levels(n)` — подмена генератора).

Экран 480×640: HUD 40 px, окно мира 480×600 (`VIEW_W×VIEW_H`), клетка `T=24`, 20 колонок — по ширине мир
целиком в кадре, камера только по Y и только вверх (`camY` убывает). Все объекты: `x, y` — центр.

API: `start()` → api · `update(dt)` (подшаги ≤ 1/60) · `setDir(pi, dx, dy)` (−1/0/1) · `setFire(pi, held)` ·
`sec(pi)` → bool (второе оружие) · `cont()` → bool (продолжение) · `state()` → S.
Отладка/тесты: `_S`, `_spawn(type,x,y)`, `_blast(x,y,r,dmg,{air,pi,enemy})`, `_kill(hero,src)`, `_boxFree(x,y,h)`,
`_cell(x,y)`, `_cellSolid(c,r)`, `_hurtBoss(d)`, `_clear()`.

`S`: `stage, maxStage, players, score, phase('play'|'cont'|'clear'|'over'|'won'), phaseT, contT, continues, time, banner,
name, bossKey, W, H, grid(Uint8, см. logic.CELL), hp(Float32 — прочность разрушаемых клеток), camY, nextLife,
heroes[{id,x,y,alive,out,lives,deadT,inv,face{x,y},ang,dx,dy,fire,cd,scd,tier,carried,unT,moving}],
enemies[{type,x,y,r,hp,max,cd,warn,burst,active,dead,air,solid,ang,aimX,aimY,flash,boss}], bullets[{x,y,vy,pi}],
shots[{pi,tier,x,y,vx,vy,d,range}], ebullets[{x,y,vx,vy,r,air,kind,from}], booms[{x,y,r,t,max,enemy}], marks[{x,y,t,max}],
pows[{x,y,vx,vy,t,master,wander}], barracks[{tx,ty,x,y,hp,max,flag,dead,flash,pows}], pads[{tx,ty,x,y,heliT}],
trains[{row,y,state:'wait'|'warn'|'run',t,dir,x,cars[{off,x,hp,max,dead,cd,warn,flash}],done,runs}], helis[y-меток],
boss{key,pats,x0,y0,x1,y1,x,y,hp,max,phase,shift,intro,active,dead,deadT,cd,flash,sweep}|null, rescued, totalRescued, lost, kills`.

События `onEvent`: `stage{stage}`, `mg{pi}`, `sec{pi,tier}`, `hit{x,y,type}`, `wall{x,y}`, `kill{type,x,y,how,pi}`, `boom{x,y,r,enemy}`,
`block{x,y,kind}`, `barracksHit`, `barracks{x,y,flag,n}`, `pow{pi,x,y,master}`, `upgrade{pi,tier,x,y}`, `deliver{pi,x,y,left}`,
`scatter{pi,n,x,y}`, `powLost{x,y}`, `eshot{x,y,kind}`, `heli{x}`, `trainWarn{y}`, `train{y}`, `heroDie{pi,x,y,src,carried}`, `out{pi}`,
`respawn{pi}`, `extraLife{pi}`, `contAsk{left}`, `continue{left}`, `bossIntro{key}`, `bossHit{x,y,hp}`, `phase{phase,x,y}`, `bossShot{pat}`,
`mortar`, `spawn`, `sweep`, `bossBoom`, `bossDie{x,y,key}`, `clear{stage,bonus,rescued}`, `gameover{score}`, `win{score}`.

Правила:
- Машина: скорость 108 (диагональ нормирована), коробка 20×20, попадание — радиус 8; рамки кадра 16 px; твёрдые враги выталкивают.
  Вода, бетон, скалы, лес, мешки, дома, бараки и ядро — непроезжие; мост, рельсы, дорога, щебень, площадка — проезжие.
- Пулемёт `MG`: 0.11 с, 430 px/с, урон 1, только вверх; гасится `blockB`-клетками (всё твёрдое, кроме воды).
- Второе оружие `SEC[tier]`: 1 граната (0.34 с, 230 px/с, дальность 132, радиус 30, урон 3, ≤ 2, без воздуха) · 2 ракета (0.28 с, 340,
  230, 34, 4, ≤ 3, рвётся о цель) · 3 самонаводка (0.26 с, 310, 300, 38, 5, ≤ 3, поворот 5 рад/с к цели в передней полуплоскости).
  Над стенами летит всё; взрыв ломает разрушаемые клетки (дом 5, дерево 2, мешки 3), бараки (6), бьёт врагов, вагоны и ядро.
- Пленные: барак (3, меченый — 4, первый из меченого — мастер: ступень +1, максимум 3) → бегут к машине (≤ 150 px, 46 px/с),
  подбор < 17 px, вместимость 8; на площадке — по одному раз в 0.2 с, +1000; гибель — разлёт (неподбираемы 0.9 с), ступень −1.
- Враги `ENEMIES` активируются у кадра, наземные исчезают далеко позади. Перед выстрелом — `warn` 0.42 с (вспышка), турели — очередь по
  одной точке через 0.17 с. Пехота не стреляет ближе 64 px и дальше 300. Темп огня ×(1+0.08·(этап−1)), скорость пуль ×(1+0.04·(этап−1));
  вдвоём здоровье ×1.5, темп ×1.25, пули ×1.06. Вертолёты — по меткам `g`, зависают на 110–170 px от верха кадра, через 13 с улетают.
- Бронепоезд `CAR`: строка рельсов в кадре → гудок 1.5 с → проход 118 px/с, вагоны 70×22 (прочность 8), касание — гибель; ушёл — через 3 с обратно.
- Крепость: 6×3 клетки за бетонной стеной (пулемёт не достаёт), здоровье 46+12·(этап−1) (×1.5 вдвоём), фазы по трети здоровья
  (смена — 0.8 с неуязвимости), приёмы `PATTERN_CD`: spread, ring, mortar (метки 1.35 с, радиус 26; в 3-й фазе — по две), spawn (≤ 6 пехоты), sweep.
  Пала → `clear` (бонус 3000·этап, пленные на борту засчитываются) → через 3.6 с следующий этап (выбывшие — с 1 жизнью) или `win`.
- Жизни 3, возрождение через 1.6 с с неуязвимостью 2.6 с (рядом с напарником); +1 жизнь каждые 27000 (вдвоём — 40500). Все выбыли → `cont` (10 с, `cont()`
  — всем по 3 жизни) или, без продолжений, `over` → `gameover`.

`DOZOR.logic`: константы, `BIND`, `MG`, `SEC`, `ENEMIES`, `CAR`, `SCORE`, `PATTERN_CD`, `STAGES` (куски карт, крепость, приёмы, пушки),
`CELL`, `solidV`, `blockB`, `breakable`, `parseMap`, `genStage(n)` (детерминированный генератор из кусков: поле, ограждение с проходами,
река с мостами и катерами, бараки, площадка, рельсы, танки, посад с домами, крепость), `solveMap` (достижимость), `params`, `mulberry32`.

## Рендер и интерфейс
`DOZOR.modern` / `DOZOR.classic` — палитры (`pixel`, цвета мира и интерфейса). `DOZOR.render.world(ctx, S, P, time)` — мир в мировых
координатах. `DOZOR.ui.render(g, ctx, S, P, {bare,toasts,shake})` — кадр (retro — буфер ½ и ×2), HUD, полоса крепости, баннеры, «Продолжить?».

## main.js
`Arcade.createGame({gameId:'dozor'})`, `useStandardScreens`, `usePlayers({bind: logic.BIND, actions:['fire','sec'], touch, hint, pad})`,
титул — панорама «Песчаного тракта», сцена `play` (ввод `g.input.player(i)` → `setDir/setFire`, нажатия → `sec`, в окне продолжения —
`cont`), P на паузе — продолжить. Отладка/QA: `DOZOR.g`, `DOZOR.app.game()`, `DOZOR.app.newGame({stage})`.

## Definition of Done
- `node dozor/tests/engine.test.mjs` — все тесты зелёные (включая баланс ботом); `node tools/smoke.mjs` — PASS dozor.
- В браузере: титул → игра (Enter) → пауза (P) → T/L/M работают; 2 игрока независимы; 0 ошибок консоли.
