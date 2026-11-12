# НАЛЁТ — контракт модулей

Игра аркады «Гефест» на фреймворке Гефест Arcade v2.2 (`engine.js`). Общий стандарт: офлайн, `file://`,
без внешних URL/шрифтов/ассетов, RU/EN, темы modern/retro (меняют только отрисовку), WebAudio-звук,
рекорд в `localStorage` (`arcade.best.nalyot`), число игроков — `arcade.players.nalyot` (движок).
Права: название, герои, банда, оружие, машины, боссы, миссии, арт, палитры, звуки и музыка — оригинальные;
чужих имён, реальных армий и реального оружия нет (тест «правило имён» в `tests/engine.test.mjs`).

## js/game.js — `NALYOT.Game(opts)` (без DOM, детерминирована при заданном `rng`)
`opts`: `{ rng, players=1|2, mission=1, maxMission=6, onEvent(type,data), map?, arena?, boss?, levels? }`
(`map` — своя ASCII-карта из 20 строк для тестов; `levels` — подмена генератора).

Экран 960×520: HUD 40 px, окно мира 960×480 (`VIEW_W×VIEW_H`), клетка `T=24`, 20 строк — мир по высоте
целиком в кадре, камера только по X и только вперёд. Тело: `x` — центр, `y` — низ (ступни).

API: `start()` → api · `update(dt)` (подшаги ≤ 1/60) · `setDir(pi, dx, dy)` (−1/0/1) · `setFire(pi, held)` ·
`jump(pi)` · `grenade(pi)` → bool · `state()` → S.
Отладка/тесты: `_S`, `_spawn(type,x,y)`, `_vehicle(x,y)`, `_pickup(kind,w,x,y)`, `_startBoss()`, `_damageBoss(d)`, `_blast(...)`, `_cellSolid(c,r)`.

`S`: `mission, maxMission, players, score, phase('play'|'clear'|'won'|'over'), phaseT, time, banner, over, won, name, bossKey,
W, grid(Uint8: 0 воздух, 1 земля, 2 мостки), objMap, blocks[{kind:'crate'|'bldg',tx,ty,tw,th,hp,max,dead,flash,x,y}],
cam{x}, arenaX, locked, heroes[{id,x,y,w,hh,vx,vy,onGround,face,aim{x,y},crouch,lives,armor,alive,out,deadT,inv,weapon,ammo,grenades,ride,leashed,…}],
enemies[{type,x,y,w,hh,hp,max,face,cd,warn,active,dead,aim,…}], bullets[{x,y,vx,vy,dmg,kind,pierce,pi,…}], ebullets[{x,y,vx,vy,r,dmg,kind,from}],
grenades[{x,y,vx,vy,shell?}], bombs[{x,y,vx,vy,r,kind:'bolt'|'drop'|'shell'|'rain'}], pickups[{kind:'w'|'gren'|'life'|'medal'|'armor',w}],
hostages[{x,y,freed,t,bonus}], vehicles[{x,y,hp,max,rider,boom,aim,face,…}], booms, waves[{x,y,vx,h}], lasers[{y,low,warn,fire,x0,x1}], marks[{x,t,kind,drop?}],
boss{key,x,y,w,hh,hp,max,phase,phases,shift,intro,dead,deadT,warn,groundY,fly,lastPat}|null, rescued, kills, nextLife, lastBonus`.

События `onEvent`: `mission{mission}`, `jump{pi,kotel?}`, `shot{pi,w}`, `melee{pi,x,y}`, `grenade{pi}`, `shell{pi,x,y}`, `hit{x,y,type}`,
`wall{x,y}`, `kill{type,x,y,how}`, `blockHit{x,y}`, `block{kind,x,y,w,h}`, `boom{x,y,r,src}`, `eshot{x,y,kind}`, `throw`, `drop`,
`armor{pi,x,y,src}`, `heroDie{pi,x,y,src}`, `out{pi}`, `respawn{pi}`, `extraLife{pi}`, `rescue{x,y,bonus,pi}`, `pickup{pi,kind,w,x,y}`,
`weaponOut{pi}`, `board{pi,x,y}`, `eject{pi,x,y}`, `kotelHit{x,y,hp}`, `kotelCrit{x,y}`, `kotelBoom{x,y}`, `bossIntro{key}`,
`bossHit{x,y,hp}`, `phase{phase,x,y}`, `mortar`, `drones`, `stomp`, `laserWarn{low}`, `laser{low}`, `rain`, `bossBoom`, `bossDie{x,y,key}`,
`clear{mission,bonus}`, `gameover{score}`, `win{score}`.

Правила:
- Физика: гравитация 1500, бег 150, прыжок 580 (≈4.6 клетки), буфер прыжка 0.2 с, «койот» 0.1 с; оси раздельно, подшаги ≤ 8 px;
  мостки `=` — снизу проходимы, вниз+прыжок — спрыгнуть. Ниже мира — гибель (фартук не спасает).
- Прицел: вверх/вниз/диагонали по стрелкам; на земле вниз без стороны — присед (рост 20, огонь горизонтально низко).
  Огонь вплотную (зазор < 28 − w/2 по взгляду) — удар ключом, урон 4.
- Оружие `WEAPONS`: rivet ∞ (0.19 с, урон 1) · nail 160 · spark 40 (пробивает, урон 3) · torch 220 (струя 0.32 с) · scoop 24 (5 дробин).
- Граната: дуга (250, −420), взрыв при касании земли/врага/босса или через 1.6 с, радиус 60, урон 8 (постройкам ×1.2, боссу ×0.8).
- Котёл `KOTEL`: броня 30, бег 140, прыжок 540, пушка 0.12 с (урон 1.5, в упор — сразу), снаряд 0.9 с (урон 10, радиус 62);
  броня 0 → `boom` 1.6 с → взрыв (радиус 84, урон 12), водитель внутри гибнет.
- Враги `ENEMIES` активируются у правого края кадра, исчезают далеко позади; темп огня ×(1+0.06·(миссия−1)), скорость пуль ×(1+0.03·(миссия−1)),
  вдвоём здоровье ×1.5. Перед выстрелом/сбросом — `warn` (вспышка).
- Боссы `BOSSES`: фаза = доля потерянного здоровья × число фаз; смена фазы — `shift` 1 с (неуязвим); кооп — здоровье ×1.6.
  Приёмы `PATTERN_CD`: spread, mortar (метки 1.2 с), drones (≤ 3 живых), stomp (волна по земле, высота 18), laser (предупреждение 0.9 с:
  низкий — на 11 px над землёй, высокий — на 27), rain (метки, бомбы сверху).
- Жизни 3, «фартук» — 1 попадание на жизнь (неуязвимость 1.2 с), возрождение через 1.2 с с неуязвимостью 2.5 с, клепальником,
  гранат ≥ 5; +1 жизнь каждые 20000. Все выбыли → `over` → `gameover` через 1.6 с. Босс пал → `clear` (бонус 1000·миссия + 500·пленники)
  → через 3 с следующая миссия (снаряжение и жизни переходят) или `win`.

`NALYOT.logic`: константы, `BIND` (раскладка кооп-клавиатуры), `WEAPONS`, `ENEMIES`, `BLOCKS`, `KOTEL`, `BOSSES`, `PATTERN_CD`,
`MISSIONS`, `SCORE`, `EXTRA_LIFE`, `parseMap`, `genMission(n)` (детерминированный генератор из кусков: ямы ≤ 3, ступени ≤ 2,
мостки над широкими ямами, укрытия, постройки, турели на уступах, пленники ×3, оружие ×2, «Котёл», броневагоны, дроны),
`solveMap` (проходимость прыжками), `params`, `mulberry32`, `q8`.

## Рендеры
`NALYOT.modern` / `NALYOT.classic`: `{ P, scenes, bg, ground, plat, block, hostage, pickup, vehicle, enemy, boss, hero, bullet, ebullet,
grenade, bomb, wave, laser, mark, boom, badge, icon }`. `NALYOT.ui.render(g, ctx, S, R, {bare,toasts,shake})` — мир через камеру,
HUD, баннеры, полоса босса; тексты только через `g.t()`.

## main.js
`Arcade.createGame({gameId:'nalyot'})`, `useStandardScreens`, `usePlayers({bind: logic.BIND, actions:['jump','grenade'], touch, hint, pad})`,
титул — панорама «Ржавого двора», сцена `play` (ввод `g.input.player(i)` → `setDir/setFire`, нажатия → `jump/grenade`), P на паузе — продолжить.
Отладка/QA: `NALYOT.g`, `NALYOT.app.game()`, `NALYOT.app.newGame({mission})`.

## Definition of Done
- `node nalyot/tests/engine.test.mjs` — все тесты зелёные (включая баланс ботом); `node tools/smoke.mjs` — PASS nalyot.
- В браузере: титул → игра (Enter) → пауза (P) → T/L/M работают; 2 игрока независимы; 0 ошибок консоли.
