# КАТАКОМБЫ — контракт модулей (переделка 2026-11 «Огненный обруч»)

Игра аркады «Гефест» на фреймворке Гефест Arcade v2.10 (`engine.js`). Общий стандарт:
офлайн, `file://`, без внешних URL/шрифтов/ассетов, RU/EN/TR/ES/PT, темы modern/retro (меняют только отрисовку),
WebAudio-звук, рекорд `arcade.best.katakomby` (+ облако площадки), число игроков — `arcade.players.katakomby` (движок),
миграция прежних правил — `KATAKOMBY.migrate(localStorage)` (`arcade.katakomby.v`, `arcade.katakomby.oldBest`).
Права: название, героиня, твари, Страж, карты, арт, палитры, звуки и музыка — оригинальные; чужих имён нет.

## js/game.js — `KATAKOMBY.Game(opts)` (без DOM, детерминирована при заданном `rng`)
`opts`: `{ rng, players=1|2, floor=1, maxFloor=9, noTutorial, wideAim, onEvent(type,data) }`.
Экран 960×600: HUD 40 px, окно мира 960×560, клетка `T=32`.

API: `start()` → api · `update(dt)` · `setDir(pi, dx, dy)` (аналог, |v| ≤ 1) · `setFire(pi, held)` (фронт нажатия — бросок/отзыв;
на прокачке — выбор) · `throwHoop(pi)` · `choose(pi, k)` (0 рикошет, 1 скорость, 2 стойкость) · `setWideAim(on)` ·
`reviveAd()` · `canBoost()` · `boost()` · `state()` → S. Служебные (тесты/промо): `_load(n)`, `_light(l)`, `_snuff(l)`, `_spawn(type,x,y)`, `_cam()`, `_clear()`.

`S`: `floor, maxFloor, players, score, phase('play'|'dying'|'clear'|'upgrade'|'won'|'over'), phaseT, time, over, won, banner, name,
tip, tut, W, H, grid[] ('#','.','D','E','L'), cam{x,y}, exit{tx,ty,x,y}|null, sealOpen, litCount, lampCount,
lamps[{tx,ty,x,y,hearth,lit,flash}], heroes[{id,x,y,r,hp,alive,face{x,y},hurtT,moving,leashed,deaths,up{bnc,spd,arm},
hoop{state('held'|'fly'|'back'),x,y,vx,vy,t,bounces,hot,hits,spin}}], enemies[{id,type,x,y,r,hp,max,biteCd,spitT,flash,wob,vx,vy,lit}],
rises[{x,y,kind,t}], boss{x,y,r,hp,max,ringT,spawnT,gustT,guardT,flash,biteCd,dead,deadT,wob}|null, items[{kind:'chest',tx,ty,x,y,taken}],
spits[{x,y,vx,vy,dmg,t,r}], upCursor[2], upDone[2], done{thrown,dipped,lit}`.

События: `floor, throw, recall, catch, bounce, rico, spent, ignite, cool, light, snuff, gate, seal, clang, clink, chest, hit, kill{type,src,mult,pts},
rise, spawn, fizzle, hurt, heroDie, revive, spit, ring, gust, bossHit, bossDie, clear, upgradeOpen, upgrade, boost, gameover, win`.

Карты (`FLOORS`): `#` стена · `.` пол · `S` старт · `F` очаг · `L` чаша · `D` решётка · `E` печать · `$` ларец · `s/m/x` тварь · `B` Страж.
`KATAKOMBY.logic`: константы (`HERO, HOOP, FLAME, DIP_R, LIGHT_R, HEAL, BURN, ENEMIES, BOSS, UPG, UPG_MAX, SCORE, MULT_MAX, MIX, AIM_CONE, AIM_WIDE`),
`BIND`, `FLOORS`, `parseFloor`, `gateGroups`, `losCells`, `solveFloor`, `params`, `heroStats`, `mulberry32`.

## Рендеры
`KATAKOMBY.modern` / `KATAKOMBY.classic`: `{ P, wall, floor, gate, seal, lamp, glow, item, rise, enemy, boss, hero, hoop, hoopRing, grave, spit, light, badge, heroBody }`.
`KATAKOMBY.ui.render(g, ctx, S, R, {bare,toasts})` — мир через камеру, HUD, подсказки, баннеры, полоса Стража, прокачка; тексты только через `g.t()`.

## main.js
Миграция до `Arcade.createGame({gameId:'katakomby', leaderboard:'katakomby'})`, `useStandardScreens`, `usePlayers({bind, actions:['fire'], pad, touch, hint})`,
стик (`ArcadeStick`), площадка (лидерборд, no_ads, ещё шанс, бонус, карточка с `adBreak`), титул — этаж с панорамой. Отладка: `KATAKOMBY.app`.

## Definition of Done
- `node katakomby/tests/engine.test.mjs` — все тесты зелёные (включая баланс ботом); `node tools/smoke.mjs` — PASS.
- В браузере: титул → игра (Enter) → пауза (P) → T/L/M работают; 0 ошибок консоли.
