# ПУЗЫРЬ — контракт модулей

Игра аркады «Гефест» на фреймворке Гефест Arcade v2.10 (`engine.js`). Общий стандарт: офлайн, `file://`, без внешних
URL/шрифтов/ассетов, RU/EN/TR/ES/PT, темы modern/retro (меняют только отрисовку), WebAudio-звук, рекорд в `localStorage`.
Ключи хранилища (прежние, переделка 2026-11 их не меняла): `arcade.best.puzyr` (и в облако площадки — `g.persist`),
`arcade.players.puzyr` (движок, `usePlayers`). Права: название, герои (Колба, Реторта), враги, механика, уровни, арт, палитры,
звуки и музыка — оригинальные; чужих имён нет.

## js/game.js — `PUZYR.Game(opts)` (без DOM, детерминирована при заданном `rng`)
`opts`: `{ rng, players=1|2, level=1, maxLevel=31, lives=3, difficulty(level,base,step,max), onEvent(type,data), waitAfter(level) → bool }`.

Поле 32×24 клетки (`COLS`, `ROWS`), рендер — клетка 20 px под HUD 40 px. Стены — колонки 0–1 и 30–31, потолок (ряд 0) сплошной,
пол (ряд 23) с 1–3 ваннами по 2 клетки (`VATS`: `C` — 15–16, `S` — 8–9 и 22–23, `CS` — все три). Внутренние блоки — **односторонние**
платформы. Координаты тел: `x` — центр, `y` — ступни (в клетках, дробные).

API: `start()` → api · `update(dt)` (шаг 1/60) · `setInput(pi, dx, jumpHeld, blowHeld)` · `blast(pi, power)` → bool (хлопок сразу) ·
`join(pi=1)` → bool · `revive()` (ещё шанс) · `canBoost()/boost()` (+1 жизнь) · `proceed()` (из фазы `rest`) · `state()` → S.

`S`: `level, maxLevel, score, phase('ready'|'play'|'clear'|'rest'|'over'), phaseT, time, levelT, over, won, nextLife, zone, grid, segs (граф),
vats[{c0,c1,x}], vatKind, combo, comboT, comboBest, melted, kills, total, timeBonus,
players[{i,x,y,vx,vy,w,h,ground,face,alive,lives,out,inv,deadT,cd,dir,jumpHeld,blowHeld,charge,charging,blastT,walk,why}],
enemies[{id,type,x,y,vx,vy,dir,vdir,mode('walk'|'tumble'|'daze'),daze,wake,downed,spawnT,charge,speed,fly,ground,by}],
shots[{x,y,vx,vy,t,kind('spark'|'drop'),back}], blasts[{x,y,face,range,pw,t,owner}], boss{x,y,w,h,vx,vy,hp,max,alive,dying,spitT,flash,spawnT}|null`.

События `onEvent`: `level{level,boss}`, `blast{player,x,y,power,hits}`, `hop`, `jump`, `melt{x,y,type,score,combo,player}`, `knock{score}`, `ledge`,
`bonk`, `thud`, `bop`, `bump`, `zap`, `reflect`, `douse`, `charge`, `shoot`, `spit`, `die{player,lives,why:'enemy'|'spark'|'drop'|'boss'|'vat'}`,
`respawn`, `join{player}`, `life`, `bossHit{hp}`, `bossFall`, `bossDie{score}`, `clear{level,time,bonus}`, `rest{level}`, `revive`, `gameover{score}`, `win{score}`.

Правила:
- Физика: гравитация 70, бег 6,5, прыжок 26 (≈4,8 клетки), отпущенный прыжок гасится; буфер прыжка 0,12 с, «койот» 0,08 с.
- Пузырь: удержание `blow` копит `charge` (на земле — стоишь, можно повернуться); отпускание — хлопок силой `power(charge)` = 0,35..1
  (полная за `CHARGE_MAX` 0,7 с), передержка `CHARGE_AUTO` 1,1 с — хлопок сам на полной; перезарядка 0,28 с; в воздухе — подскок (раз за прыжок).
- Хлопок: волна вперёд на `blastRange(pw)` = 2,6 + 3,4·pw клетки, по высоте — рост героя (+ запас для искр/капель); враг → кувырок со скоростью
  (8 + 10·pw)·`WEIGHT[type]`·спад по расстоянию; летающая копоть сбивается (`downed`). Искры/капли в волне разворачиваются (капли — в Котёл), рядом — гаснут.
- Кувырок: трение 14 (на полу 7); о стену быстрее 4 — отскок ×0,75 и оглушение 1,8 с; приземление с высоты ≥ 2,5 — оглушение 1,4 с;
  остановка — оглушение ≥ 0,8 с; кувыркающийся быстрее 5 сбивает стоящих (+100, «кегли»). Над ванной на полу — проваливается.
- Ванна: враг ниже пола → переплав, 500·серия (≤ ×5, серия — 2,5 с); герой — гибель (`vat`).
- Касания: опасен только враг в `walk` (не просыпающийся); падение сверху — отскок героя и оглушение врага 1 с; снизу под стоящим — отброс без вреда.
- Жизни: −1, возрождение через 1,6 с с неуязвимостью 2,5 с; 0 — выбыл; все выбыли — `gameover`. +1 жизнь каждому в игре за каждые 11 000.
- Уровень пройден ⇔ врагов нет (и Котёл повержен) → `clear` (3,2 с; бонус 20 за каждую секунду до 60) → `rest` (если `waitAfter`) → следующий / `win`.
- Котёл (31-й): 8 HP, капли 4 клетки/с веером 3 (с половины — 4); попадание отбитой капли −1; на нуле — `bossFall`, тонет в ванне → +20 000, `bossDie`.

`PUZYR.logic`: константы, `BIND` (раскладки И1/И2: `left,right,down,jump,blow`), `HAND` (ручные карты), `VATS`, `level(n)`, `vatsOf/inVat`,
`segments/buildGraph/route/reach/segAt/landing/validate` (граф проходимости), `drive/simEdge`, `moveBody`, `solidUnder/cellAt`, `power/blastRange`, `mulberry32`.

## Рендеры
`PUZYR.modern` / `PUZYR.classic`: `{ P, bg(ctx,g), draw(ctx,S,g,{bare,toasts}), face(ctx,x,y,i,scale) }` (+ `hero`, `enemy`, `glassBall` у modern).
`bare` — без HUD (фон титула и карточки). `PUZYR.ui.hud/banner/toasts/panel(...)` — тексты только через `g.t()`.

## main.js
`Arcade.createGame({gameId:'puzyr', leaderboard:'puzyr'})`, `useStandardScreens` (титул переопределён: живой уровень + меню движка, `menuFit`),
`g.usePlayers({bind, actions:['jump','blow'], touch:{L,R,U:'jump',A:'blow'}})`, геймпад A — прыжок, B — пузырь; сцена `play`
(ввод — `g.input.player(i).dir.x / pressed('jump') / pressed('blow')`, логика шагом 1/60; пробел старта не раздувает пузырь, пока не отпущен);
сцена `card` (между уровнями, только если площадка готова к межстраничной: нажатие → `g.adBreak()` → `proceed()`).
Площадка: `g.persist('arcade.best.puzyr')`, `useLeaderboard`, `useNoAds`, `useRewardedContinue` (`revive`), `useRewardedBonus` (`boost`).
Клавиша `2` в `play` — `game.join(1)`. Отладка/QA: `PUZYR.g`, `PUZYR.app.game()`.

## Definition of Done
- `node puzyr/tests/engine.test.mjs` — все тесты зелёные; `node tools/smoke.mjs` — PASS puzyr.
- В браузере: титул → игра (Enter) → пауза (P) → T/L/M работают; в режиме 2 игроков оба двигаются независимо; `2` в игре — вход И2; 0 ошибок консоли.
