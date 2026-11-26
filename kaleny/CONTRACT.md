# КАЛЁНЫЙ ДВОР — контракт модулей

Игра аркады «Гефест» на фреймворке Гефест Arcade v2 (`engine.js`, v2.10). Общий стандарт: офлайн, `file://`, без внешних URL/шрифтов/ассетов,
RU/EN/TR/ES/PT, темы modern/retro (меняют только отрисовку), WebAudio-звук, рекорд в `localStorage` (`arcade.best.kaleny`).
Права: название, команды, облик, дворы, арт, палитры, музыка и звуки — оригинальные; чужих имён нет (тест «правило имён» в `tests/engine.test.mjs`, стоп-лист в base64).

## js/game.js — `KALENY.Game(opts)` (без DOM, детерминирована при заданном `rng`)
`opts`: `{ rng | seed, level=0…6, arena (по умолч. level % 7), humans=[1] (id юнитов под людей; [] — все ИИ), time=100, enemy?, friend?, hero? (перекрытие параметров ИИ), onEvent(type,data) }`.
Мир 450×800 (`GEO`): поле `CX=25…CR=425`, `TOP=130…BOT=670`, `MID=400`; зоны выбывших `STT=84…TOP` (команда 0 — за врагами, сверху) и `BOT…STB=716` (команда 1 — снизу).
Команда 0 — игрок (низ), команда 1 — соперник (верх). Юниты 0–2 / 3–5, радиус 16; шар радиус 9.
API: `update(dt)` (подшаги ≤ 1/60), `setInput(uid, mx, my, aDown)` (мировые оси; `a` — удержание броска), `pressB(uid)` (ловля при угрозе, иначе рывок), `state()` → S,
`counts()` → [живых 0, живых 1], `threatOf(u)` → `{ ball, eta, cross }|null`, `pickTarget(u, mx, my)` (автоприцел/пас), `reinforce()` / `canReinforce()` (бонус за рекламу),
`think(u, P, dt)` (ИИ-ввод в `u.in`), отладка: `_S`, `_throw`, `_toStrip`, `_revive`.
`S`: `time, left, sudden, phase('play'|'over'), result('win'|'lose'|'draw'), level, arena, units[], balls[], shields[], stats[2]{hits,catches,perfect,outs}, points, hum{}`.
Юнит: `{ id, team, slot, x, y, state('in'|'out'), hp(2), hold(ball id|-1), fx, fy, stance, stanceMax, lock, dashT, dashCd, stun, charge, inv, human(pi|-1), in{mx,my,a,b,dash,tgt} }`.
Шар: `{ id, x, y, vx, vy, heat(0…1), state('held'|'fly'|'loose'), team, owner, pass, bounces, t, sid }`. Щит: `{ k:'plate'|'steam', x,y,w,h, period,on,ph }`.

Правила (константы в `game.js`): скорость юнита 150 (заряд ×0,55, ловля ×0,5); рывок 0,2 с, откат 1 с; окно ловли `stanceLen(heat)=0,52−0,34·heat`, откат +0,45 с; шар: скорость
`250+330·heat0`, нагрев в полёте +0,28/с, остывание на полу −0,35/с, отскок от стен ×0,85 (2 отскока или 1,8 с → шар «ложится»); накал в руках 0,25→0,95 за 1,1 с, ожог > 1,7 с;
пас — 340 px/с, не бьёт. Попадание: `hp−1` (+1 с неуязвимости), 0 → выбыл за линию соперника; ловля: бросавший выбыл при шаре ≥ 0,35, «закалка» (≥ 0,7) — возврат выбывшего (hp 1).
`LEVELS[0…6]` (ИИ), `FRIEND` (ИИ-напарник), `ARENAS[0…6]`.
События `onEvent`: `throw{uid,team,heat,x,y}`, `pass`, `got`, `pick`, `stance`, `dash`, `dodge`, `wound{uid,team,hp,x,y}`, `hit{uid,team,heat,x,y,by}` (выбыл), `catch{uid,team,heat,perfect,x,y,thrower}`,
`burn`, `revive`, `wall`, `plate`, `steam`, `time`, `end{result,points}`.

## js/render.js — `KALENY.render`
`draw(ctx, S, g, { toasts, fx, api, score, matchNo, tutText })` — мир (в альбоме `setTransform(0,1,−1,0,W,0)`), затем HUD в экранных координатах; `bare(ctx, S, g)` — только поле (титул, карточка);
`pal(g, level)`, `toScreen(g, x, y)`, `land(g)`, `heatColor`, `disc`, `rr`. Кольцо-подсказка ловли рисуется для юнитов-людей под угрозой.

## js/ui.js — `KALENY.ui`: `init(g)`, `fit(g)` — выбор ориентации (800×450 или 450×800 по окну), подгонка без прокрутки, подписи страницы по языку.
## js/main.js — сборка: `createGame({ gameId:'kaleny', leaderboard:'kaleny', lives:2 })`, `useStandardScreens`, `usePlayers` (раскладка `bind`, действия `throw`/`catch`),
`useLeaderboard`, `useNoAds`, `useRewardedContinue`, `useRewardedBonus`, `adBreak` на карточке `card`, титул с ИИ-матчем. Для автотестов: `KALENY.app = { g, game(), tour(), newMatch(), clear() }`.
