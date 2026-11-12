# РАЗРЕЗ — контракт модулей

Игра аркады «Гефест» на фреймворке Гефест Arcade v2 (`engine.js`). Общий стандарт:
офлайн, `file://`, без внешних URL/шрифтов/ассетов, RU/EN, темы modern/retro (меняют
только отрисовку), WebAudio-звук, рекорд в `localStorage` (`arcade.best.razrez`).
Права: название, правила-формулировки, арт, палитры и звуки — оригинальные; чужих имён нет.

## js/game.js — `RAZREZ.Game(opts)` (без DOM)
`opts`: `{ rng, level=1, lives=3, maxLevel=5, target=75, cols=78, rows=50, difficulty(level,base,step,max), onEvent(type,data) }`.

Сетка `Uint8Array`: `0` — поле (море), `1` — суша, `2` — след. Рамка 2 клетки — суша.

API: `start()` → api · `update(dt)` · `setDir(dx,dy)` (0,0 — клавиши отпущены) · `state()` → S.
`S`: `grid, cols, rows, level, maxLevel, lives, score, pct, target, player{x,y,dx,dy,trailing,sx,sy}, trail[], sea[{x,y,vx,vy}], land[...], phase('ready'|'play'|'dead'|'clear'), ver, flash, flashT, clearBonus, over, won, time`.

События `onEvent`: `step{n}`, `capture{count,pct,gain}`, `clear{level,pct,bonus}`, `level{level,lives}`, `go`, `death{lives,x,y,reason}`, `gameover{score}`, `win{score}`.

Правила:
- На суше резец двигается, пока держат клавишу; в поле идёт сам, разворот на 180° игнорируется.
- Шаг в клетку следа — смерть; шар (AABB 0.45) касается клетки следа или резца — смерть; клещ (0.40) касается резца на неуязвимости ≤0 — смерть. После смерти след стирается, резец — в точку ухода (1.5 с неуязвимости).
- Замыкание: след → суша; затем `floodCapture` от всех клеток, перекрытых шарами (4-связность); всё свободное и недостижимое → суша.
- `pct` — доля суши во внутренней части (без рамки). `pct ≥ target` → фаза `clear` → следующий уровень (+1 жизнь, макс. 5) или `win` после `maxLevel`. `lives = 0` → `gameover`.

`RAZREZ.logic`: `floodCapture(grid,cols,rows,seeds) → {count,mask}`, `percent(grid,cols,rows,border)`, `levelParams(level,diff)`, константы.

## Рендеры
`RAZREZ.modern.draw(ctx, st, g, L, bare)` / `RAZREZ.classic.draw(...)`; `L = {W,H,CELL,OX,OY,COLS,ROWS}`; `bare` — без HUD (фон титула). Слой суши кэшируется по `st.ver`. `RAZREZ.ui.hud/banner(g,ctx,st,P,L)` — тексты только через `g.t()`.

## main.js
`Arcade.createGame({gameId:'razrez'})`, `useStandardScreens` (титул переопределён: живой фон + меню движка), сцена `play`. Сложность — `g.difficulty` через `opts.difficulty`. Отладка/QA: `RAZREZ.g`, `RAZREZ.current`.

## Definition of Done
- `node razrez/tests/engine.test.mjs` — все тесты зелёные; `node tools/smoke.mjs` — PASS razrez.
- В браузере: титул → игра (Enter) → разрез растит % → пауза (P) → T/L работают; 0 ошибок консоли.
