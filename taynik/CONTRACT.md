# ТАЙНИК — контракт модулей

Игра аркады «Гефест» на фреймворке Гефест Arcade v2.2 (`engine.js`). Общий стандарт:
офлайн, `file://`, без внешних URL/шрифтов/ассетов, RU/EN, темы modern/retro (меняют
только отрисовку), WebAudio-звук, рекорд в `localStorage` (`arcade.best.taynik`).
Права: название, герой, сеттинг, обитатели, уровни, арт, палитры, звуки и музыка — оригинальные; чужих имён нет.

## js/game.js — `TAYNIK.Game(opts)` (без DOM, детерминирована при заданном `rng`)
`opts`: `{ rng, level=1, maxLevel=6, lives=3, onEvent(type,data) }`.

Канва 512×384: HUD 32 px сверху, окно мира 512×352. Мир — тайлы 20 px (`0` пусто, `1` кладка, `2` кислота);
зал 12×8 тайлов; лабиринт `cols×rows` залов (4×3 … 8×6). Шаг логики фиксированный, 1/60 с.

API: `start()` → api · `update(dt)` (накапливает и делает шаги) · `step()` · `setInput({l,r,u,d})` (зажатые) ·
`fire()` · `state()` → S · `_loadLevel(n)`, `_damage(n,src)`, `_die(reason)` (тесты/QA).

`S`: `level, maxLevel, lives, score, energy, ammo, phase('play'|'dead'|'clear'|'over'|'won'), phaseT, time, over, won,
lv, hero{x,y(ступни),vx,vy,mode('ground'|'air'|'rope'),rope,face,...}, enemies[], items[], bullets[], checkpoint{x,y},
hint{t,i,j,path[[i,j]…]}|null, banner, cam{x,y}, inv, fireCd, death{reason,x,y}|null, kills, found, nextExtra`.

`lv`: `n, cols, rows, tw, th, pw, ph, tiles(Uint8Array), cells[{i,j,e,s,hx,ux,acid{a,w},ledge,deg}], ropes[{x,top,bot,kind('link'|'pit'|'exit'),exit}],
start{x,y}, startCell, exitCell, exitRope, cellDist, plan{nodes,exitReachable,count}, items, enemies`.

Обитатели: `spider{x,top,lo,hi,per,ph}` (y — функция времени), `spark{x,y,vx,vy,rx0..ry1}`, `drop{x,top,floorY,per,ph}`
(функция времени: набухание 0,7 с → падение 600 px/с² → брызги 0,3 с), `ghost{x,y,hx,hy,v,cool}`, `cham{x,y,minX,maxX,v,shown,cool,face}`;
у всех `hp, alive`.

События `onEvent`: `level{level}`, `jump`, `grab`, `land{hard}`, `shot{x,y,face}`, `empty`, `spark{x,y}` (пуля погасла),
`hit{type,x,y}`, `kill{type,x,y,pts}`, `reveal{x,y}`, `hurt{n,src,x,y,energy}`, `treasure{type,x,y,pts}`, `ammo{ammo}`, `oil{energy}`,
`map`, `lamp{x,y}`, `extra{lives}`, `die{reason('acid'|'energy'),x,y,lives}`, `respawn`, `clear{level,bonus}`, `gameover{score}`, `win{score}`.

Правила:
- Ходьба 80 px/с; прыжок с пола — новым нажатием ↑ (vy −290, vx ±100, g 900); в воздухе управления нет.
- Верёвка: ↑ (или ↓ у края люка) в пределах 16 px — хват; подъём/спуск 70 px/с; в полёте хват автоматически (±8 px),
  кроме только что покинутой (0,35 с); ←/→ новым нажатием — прыжок (vy −160, vx ±140); внизу верёвки новое ↓ — отпустить.
  Спуск до пола — снова на ногах. Верх верёвки выхода — переход (`clear`).
- Кислота под центром героя — `die('acid')`. Падение > 100 px — урон 30, > 230 px — 60.
- Касание обитателя — урон (`DMG`: паук 20, искра 15, капля 15, призрак 20, хамелеон 25), затем неуязвимость 1,2 с.
  Сила 0 — `die('energy')`; через 1,4 с возрождение у последнего зажжённого фонаря с полной силой и 2 с защиты.
- Пуля 380 px/с, дальность 260 px, гаснет в кладке; кулдаун 0,25 с; капли пули не берут, скрытый хамелеон — тоже.
- Очки: камень 200, деталь 100, фонарь 50, паук 100, искра 150, призрак 250, хамелеон 300; люк 1000 + 5×сила + 20×заряд.

`TAYNIK.logic`: константы, `LEVELS`, `PTS`, `DMG`, `HP`, `stepHero`, `runMacro`, `analyze`, `distToExit`, `buildMaze`, `makeLevel`,
`cellOf/cellAt/cellPath/neighbors`, `dropAt`, `spiderY`, `enemyBox`, `heroBox`, `hit`, `tileAt`, `overlapSolid`, `supported`, `acidUnder`,
`newHero`, `cloneHero`, `heroKey`, `macrosFor`, `ropeMinY/MaxY`.

## Рендеры
`TAYNIK.modern` / `TAYNIK.classic`: `{ P, world(ctx,S,g,cam{x,y,bare}), light(ctx,S,g,cx,cy,o)|null, lifeIcon, ammoIcon, hero(ctx,h,t) }`.
Статичный слой уровня кэшируется на отдельной канве. `TAYNIK.ui.frame(g,ctx,S,R,{bare,toasts,fx})` — кадр целиком
(мир через камеру → свет → HUD → карта-подсказка → баннер). Тексты — только через `g.t()`.

## main.js
`Arcade.createGame({gameId:'taynik'})` с палитрами тем, `useStandardScreens` (титул переопределён: камера плывёт по ярусу + меню;
на паузе P/Esc — продолжить), сцена `play`. Ввод: стрелки/WASD зажатием, пробел (action) / Z / X — выстрел; тач — `bindDpad` (U/D/L/R/A).
Отладка/QA: `TAYNIK.g`, `TAYNIK.app.game()`, `TAYNIK.current`.

## Definition of Done
- `node taynik/tests/engine.test.mjs` — все тесты зелёные; `node tools/smoke.mjs` — PASS taynik.
- В браузере: титул → игра (Enter) → пауза (P) → T/L/M работают; 0 ошибок консоли.
