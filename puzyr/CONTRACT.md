# ПУЗЫРЬ — контракт модулей

Игра аркады «Гефест» на фреймворке Гефест Arcade v2.2 (`engine.js`). Общий стандарт:
офлайн, `file://`, без внешних URL/шрифтов/ассетов, RU/EN, темы modern/retro (меняют
только отрисовку), WebAudio-звук, рекорд в `localStorage` (`arcade.best.puzyr`).
Ключи хранилища: `arcade.best.puzyr`, `arcade.players.puzyr` (движок, `usePlayers`). Новая игра — миграций ключей нет.
Права: название, герои (Колба, Реторта), враги, механики-формулировки, уровни, арт, палитры, звуки и музыка — оригинальные; чужих имён нет.

## js/game.js — `PUZYR.Game(opts)` (без DOM, детерминирована при заданном `rng`)
`opts`: `{ rng, players=1|2, level=1, maxLevel=31, lives=3, difficulty(level,base,step,max), onEvent(type,data) }`.

Поле 32×24 клетки (`COLS`, `ROWS`), рендер — клетка 20 px под HUD 40 px. Стены — колонки 0–1 и 30–31,
потолок (ряд 0) и пол (ряд 23) с проёмом в колонках 14–17. Внутренние блоки — **односторонние** платформы
(снизу проходишь, сверху стоишь). Координаты тел: `x` — центр, `y` — ступни (в клетках, дробные).

API: `start()` → api · `update(dt)` (шаг 1/60) · `setInput(pi, dx, jumpHeld)` · `blow(pi)` → bool ·
`join(pi=1)` → bool (вход «на лету»/возврат выбывшего) · `state()` → S.

`S`: `level, maxLevel, score, phase('ready'|'play'|'clear'|'over'), phaseT, time, levelT, over, won, nextLife, letters[6], zone,
grid, segs (граф), wind{gather,zones[{x0,x1,y0,y1,vx,vy}]}, specials[], hurry, angryAll, chainBest, kills,
players[{i,x,y,vx,vy,w,h,ground,face,alive,lives,out,inv,deadT,blowCd,blowT,dir,jumpHeld,walk}],
enemies[{id,type,x,y,vx,vy,dir,vdir,angry,spawnT,charge,speed,fly,ground}],
bubbles[{id,x,y,r,vx,vy,phase('shoot'|'float'),t,kind('plain'|'fire'|'water'|'bolt'|'letter'),enemy{type,angry}|null,trapT,owner,letter,life}],
items[{id,kind,score,x,y,ground,t}], shots[{x,y,vx,vy,t,kind('spark'|'drop')}], effects[fire|water|bolt],
boss{x,y,w,h,vx,vy,hp,max,alive,trapped,spitT,flash,inv,spawnT}|null`.

События `onEvent`: `level{level,boss}`, `blow`, `jump`, `bounce`, `trap{type}`, `pop{x,y,type,score,chain,n,player}`, `burst`, `fizz`,
`item{kind,score}`, `letter{letter}`, `word{player}`, `special{kind}`, `burn`, `zap{type,kind}`, `escape{type}`, `charge`, `shoot`,
`hurry`, `angry`, `die{player,lives,why:'enemy'|'spark'|'drop'|'boss'}`, `respawn`, `join{player}`, `life`, `spawnLetter`,
`spit`, `douse`, `bossHit{hp}`, `bossTrap`, `bossDie`, `clear{level}`, `gameover{score}`, `win{score}`.

Правила:
- Физика: гравитация 70, бег 6,5, прыжок 26 (≈4,8 клетки, запрыгнуть можно на 4 ряда вверх), падение ≤ 13 клеток/с; буфер прыжка 0,12 с, «койот» 0,08 с.
- Выдув: перезарядка 0,32 с; шар 15 клеток/с до `RANGE=5,5` или стены, затем всплытие 2,4 клетки/с по ветру уровня; под потолком дрейф к `wind.gather`. Шары расталкиваются.
- Захват — только в фазе полёта (враг в «появлении» не ловится). Свой свежий шар (< 0,3 с) касанием не лопается.
- Лопание: касание/прыжок снизу/падение сверху без прыжка; падение сверху с зажатым прыжком — отскок. Цепочка — все шары, касающиеся лопнувших (×1,2 суммы радиусов).
  Очки: враг в цепочке 1000·2ⁿ (n ≤ 5), пустой шар 10, спецшар 100, буква 500. Бонус-деталь: ранг = длина цепочки − 1 (+1, если враг был зол).
- Пустой шар живёт 11 с, спецшар 18 с, буква 16 с; враг в шаре — `max(5,5; 9 − 0,12·(уровень−1))` с, затем вырывается злым (×1,6).
- Таймер уровня: 45 с — «Сквозняк», 52 с — все враги злые.
- Проход низ→верх: тело, ушедшее ниже поля, появляется сверху (потолок пропускает только падающих).
- Враги: скорость × `difficulty(level, 1, 0.012, 1.35)`; на старте 1,4 с «появления» (безвредны).
- Буквы: шар с недостающей буквой из проёма раз в 12–20 с и за цепочку 3+; все 6 — +1 жизнь лопнувшему, +5000.
- Жизни: касание врага/искры/капли/Котла — −1, возрождение через 1,6 с с неуязвимостью 2,5 с; 0 — выбыл; все выбыли — `gameover`. +1 жизнь каждому в игре за каждые 20 000.
- Уровень пройден ⇔ врагов нет ни на поле, ни в шарах (и Котёл лопнут) → `clear` (3,5 с собрать бонусы) → следующий / `win`.
- Котёл (31-й): 40 HP, ГРОЗА −5 (молния летит в него), выдутый шар −1; плюётся 3 (с половины — 5) каплями; на нуле — в шаре; касание → +50 000, `bossDie`.

`PUZYR.logic`: константы, `BIND` (раскладки И1/И2 для `g.usePlayers`: `left,right,down,jump,blow`), `HAND` (ручные карты), `level(n)`, `windOf`,
`segments/buildGraph/route/reach/segAt/landing/validate` (граф проходимости), `drive/simEdge` (управление и прогон ребра), `moveBody`, `mulberry32`.

## Рендеры
`PUZYR.modern` / `PUZYR.classic`: `{ P, bg(ctx,g), draw(ctx,S,g,{bare,toasts}), face(ctx,x,y,i,scale), item(ctx,kind,x,y,scale) }`.
`bare` — без HUD (фон титула). `PUZYR.ui.hud/banner/toasts/panel(...)` — тексты только через `g.t()`.

## main.js
`Arcade.createGame({gameId:'puzyr'})` с палитрами тем, `useStandardScreens` (титул переопределён: уровень на фоне + меню движка),
`g.usePlayers({bind: PUZYR.logic.BIND, actions:['blow'], touch:{L,R,U:'jump',A:'blow'}, hint})`, сцена `play`
(ввод — `g.input.player(i).dir.x / pressed('jump') / onPress('blow')`, логика шагом 1/60). Клавиша `2`/`Num 2` в `play` — `game.join(1)` и
`g.players.set(2)`. Отладка/QA: `PUZYR.g`, `PUZYR.app.game()`.

## Definition of Done
- `node puzyr/tests/engine.test.mjs` — все тесты зелёные (уровни и проходимость, шары, захват, цепочки, озлобление, отскок, проём,
  спецшары, буквы, кооп и вход «на лету», Котёл, кооп-ввод через движок, музыка, строки, правило имён, баланс-бот); `node tools/smoke.mjs` — PASS puzyr.
- В браузере: титул → игра (Enter) → пауза (P) → T/L/M работают; в режиме 2 игроков оба двигаются независимо; `2` в игре — вход И2; 0 ошибок консоли.
