# КАТАКОМБЫ — контракт модулей

Игра аркады «Гефест» на фреймворке Гефест Arcade v2.2 (`engine.js`). Общий стандарт:
офлайн, `file://`, без внешних URL/шрифтов/ассетов, RU/EN, темы modern/retro (меняют только отрисовку),
WebAudio-звук, рекорд в `localStorage` (`arcade.best.katakomby`), выбор героев — `arcade.katakomby.hero1/2`,
число игроков — `arcade.players.katakomby` (движок). Права: название, герои, враги, Страж, карты, арт, палитры,
звуки и музыка — оригинальные; чужих имён нет.

## js/game.js — `KATAKOMBY.Game(opts)` (без DOM, детерминирована при заданном `rng`)
`opts`: `{ rng, players=1|2, heroes=['smith','spark'], floor=1, maxFloor=9, onEvent(type,data) }`.

Экран 960×600: HUD 40 px, окно мира 960×560 (`VIEW_W×VIEW_H`), клетка `T=32`.

API: `start()` → api · `update(dt)` · `setDir(pi, dx, dy)` (−1/0/1) · `setFire(pi, held)` (держать — автоогонь;
на прокачке — фронт нажатия = выбор) · `bomb(pi)` → bool · `choose(pi, k)` (k: 0 сила, 1 скорость, 2 броня) · `state()` → S.

`S`: `floor, maxFloor, players, score, keys, potions, phase('play'|'dying'|'clear'|'upgrade'|'won'|'over'), phaseT, time,
over, won, banner, name, W, H, grid[] ('#','.','D','E'), cam{x,y}, exit{tx,ty,x,y}|null,
heroes[{id,cls,x,y,r,hp,alive,face{x,y},cd,hurtT,swingT,moving,leashed,up{str,spd,arm}}],
enemies[{type,x,y,r,hp,max,lair,biteCd,spitT,flash,wob,vx,vy}], lairs[{kind,tx,ty,x,y,hp,max,t,flash}],
boss{x,y,r,hp,max,ringT,spawnT,aimT,flash,biteCd,dead,deadT,wob}|null, items[{kind,tx,ty,x,y,taken}],
shots[{x,y,vx,vy,dmg,t,pi,r}], spits[{x,y,vx,vy,dmg,t,r}], swings[{x,y,r,t,fx,fy,pi}], bombFlash, upCursor[2], upDone[2]`.

События `onEvent`: `floor{floor,boss}`, `swing{pi}`, `shot{pi}`, `hit{x,y}`, `wall{x,y}`, `kill{type,x,y,src}`,
`lairHit{x,y,hp}`, `lairDie{kind,x,y}`, `spawn{kind,x,y}`, `hurt{pi,dmg,x,y,src}`, `heroDie{pi,x,y}`, `revive{pi}`,
`key|chest|food|potion{pi,x,y}`, `door{x,y}`, `bomb{pi,x,y}`, `spit{x,y}`, `ring{x,y}`, `bossHit{x,y,hp}`, `bossDie{x,y}`,
`clear{floor,bonus}`, `upgradeOpen`, `upgrade{pi,kind,level}`, `gameover{score}`, `win{score}`.

Правила:
- Движение — подшаги ≤4 px, оси раздельно, «обтекание» углов (≤12 px) для входа в коридор в клетку. Стены, закрытые двери, живые логова — твёрдые.
- Взгляд = направление хода (8 направлений). Искорка, пока зажат огонь, взгляд не меняет. Кузнец: дуга R=28 в 26 px перед собой; Искорка: искра 430 px/с, 0.95 с, автоприцел к ближайшей цели в конусе ±0.42 рад.
- `heroStats`: скорость ×(1+0.1·spd), перезарядка ÷(1+0.12·spd), урон ×(1+0.35·str), броня = база + 0.08·arm (≤0.65), здоровье = база + 10·arm.
- Таяние `DRAIN=1`/с; еда +40 (не при полном здоровье). Новый этаж +20 здоровья; перед Стражем — полное; павший в коопе — 50%.
- Враги идут по полю потока (BFS от живых героев каждые 0.25 с, дальность `AGGRO=18` шагов); укус при касании раз в 0.6 с. Плевун держит дистанцию 3.5 клетки, плюёт в радиусе 6.
- Логово: просыпается при герое ближе 11 клеток, период `params().lairCd` (4.6 → 2.0 с к 9-му этажу), ≤6 своих живых, всего ≤40 врагов.
- Дверь: упор в `D` с ключом → открывается вся связная группа, ключ −1. Выход `E` — касание любым живым героем.
- Кооп: «поводок» — по X не дальше `VIEW_W − 2·LEASH_PAD − 2r`, по Y `VIEW_H − 2·LEASH_PAD − 2r` (`LEASH_PAD=48`); камера — середина живых, с упором в края карты. Вдвоём: `lairCd×0.65`, здоровье врагов и логов ×1.5, Страж ×2.2.
- Страж: 230 здоровья, 50 px/с (ярость ×1.35), кольцо из 9 плевков каждые 3 с (ярость: 13 и 2.1 с + веер из 3 прицельных каждые 2.4 с), 2 тени каждые 6 с, укус 10, толкает героя.

`KATAKOMBY.logic`: константы, `BIND` (раскладка кооп-клавиатуры), `FLOORS` (9 ASCII-карт), `HEROES`, `ENEMIES`, `BOSS`, `UPG`,
`parseFloor`, `doorGroups`, `solveFloor` (проходимость при любом порядке открывания дверей), `params`, `heroStats`, `mulberry32`.

## Рендеры
`KATAKOMBY.modern` / `KATAKOMBY.classic`: `{ P, wall, floor, door, exit, item, lair, enemy, boss, hero, grave, shot, spit, swing, light, badge, heroBody }`.
`KATAKOMBY.ui.render(g, ctx, S, R, {bare,toasts})` — мир через камеру, HUD, баннеры, полоса Стража, прокачка; тексты только через `g.t()`.

## main.js
`Arcade.createGame({gameId:'katakomby'})`, `useStandardScreens`, `usePlayers({bind: logic.BIND, actions:['bomb'], touch, hint, pad})`,
пункты меню `hero1`/`hero2`, титул — тёмный этаж с панорамой, сцена `play` (ввод `g.input.player(i)` → `setDir/setFire`), P на паузе — продолжить.
Отладка/QA: `KATAKOMBY.g`, `KATAKOMBY.app.game()`.

## Definition of Done
- `node katakomby/tests/engine.test.mjs` — все тесты зелёные (включая баланс ботом); `node tools/smoke.mjs` — PASS katakomby.
- В браузере: титул → игра (Enter) → пауза (P) → T/L/M работают; 0 ошибок консоли.
