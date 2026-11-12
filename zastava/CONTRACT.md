# ЗАСТАВА — контракт модулей

Игра аркады «Гефест» на фреймворке Гефест Arcade v2.2 (`engine.js`). Общий стандарт:
офлайн, `file://`, без внешних URL/шрифтов/ассетов, RU/EN, темы modern/retro (меняют
только отрисовку), WebAudio-звук, рекорд в `localStorage` (`arcade.best.zastava`).
Права: название, правила-формулировки, волны, арт (пиксельный и векторный), палитры, звуки и музыка — оригинальные; чужих имён нет.

## js/game.js — `ZASTAVA.Game(opts)` (без DOM, детерминирована при заданном `rng`)
`opts`: `{ rng, wave=1, lives=3, maxWave=10, difficulty(level,base,step,max), onEvent(type,data) }`.

Поле 480×640: стены `FX0=12`/`FX1=468`, верх `FY0=52`, зонд на `PROBE_Y=76`, лафет — центр `PLAYER_Y=594`
(34×16, 215 px/с), земля `GROUND_Y=616`, линия вторжения `INVADE_Y=574`. Строй 10×5 клеток 36×30, паразит 26×18,
шаг 4 px, ступенька 12 px. Укрытия: 4 наковальни 22×15 клеток по 3 px от `BK_Y=494`. Коршун 46×28. Выстрел лафета 700 px/с.

API: `start()` → api · `update(dt)` · `setDir(dx)` (−1/0/1) · `setFire(bool)` (удержание — очередь) · `action()` (выстрел; false, если уже летит) · `state()` → S.
Тестовые хуки: `_setupWave(n)`, `_march()`, `_interval()`, `_alienPos(a)`, `_shooters()`, `_gridFire()`, `_blast(x,y,r)`, `_cellAt(x,y)`, `_ringAt(x,y)`, `_playerHit()`, `_fleetBounds()`.

`S`: `wave, maxWave, lives, score, phase('intro'|'play'|'dead'|'clear'|'over'), phaseT, time, over, won, invaded,
kind('grid'|'birds'|'boss'), name, prm, extra, clearBonus, banner, player{x,dead,grace,cool,recoil}, shot{x,y}|null,
bullets[{x,y,vx,vy,kind:'spark'|'drill'|'bomb'|'bolt'}], bunkers[{x,y,cells[]}], fleet{x,y,dir,timer,frame,aliens[{c,r,type,alive}],alive,total,drops}|null,
probe{x,y,vx,pts}|null, probeT, birds[{hx,hy,x,y,hp,max,state:'form'|'dive',shield,shT,s,dur,tx,yLow,flash,alive}], diveT,
boss{x,y,vx,rc,rings[{r1,r2,n,max,rot,spin,hp[]}],hp,max,fireT,flash,repairT,alive}|null, fireT, kills, shots`.

События `onEvent`: `wave{wave,kind}`, `march{frame,beat}`, `drop{y}`, `shoot{x}`, `miss`, `alienShot{x,kind}`, `kill{x,y,type,pts}`,
`clash{x,y,kill}`, `bunker{x,y}`, `ground{x}`, `probe{dir}`, `probeKill{x,y,pts}`, `probeGone`, `shieldOn/shieldOff{x,y}`, `deflect{x,y}`,
`birdDive{x,y}`, `bomb{x}`, `birdHit{x,y}`, `birdKill{x,y,pts}`, `bossSeg{x,y,broken,ring}`, `bossCore{x,y,hp}`, `clang{x,y}`, `repair{ring,idx}`,
`bossFire{x,y,n}`, `bossDie{x,y,pts}`, `playerHit{x,y,lives}`, `respawn`, `life{lives}`, `clear{wave,bonus}`, `invade`, `gameover{score}`, `win{score}`.

Правила:
- Строй: таймер шага; интервал `iMin + (iMax − iMin)·((alive−1)/(total−1))^1.5`. Если следующий шаг выводит крайнего живого за стену —
  вместо шага `y += DROP`, `dir = −dir`. Нижний край строя ≥ `INVADE_Y` → `invade` + `gameover` (жизни не спасают).
- Огонь строя: раз в `fireMin…fireMax` (×(1−0.3·доля убыли)), не больше `maxShots` пуль; стрелок — нижний живой в колонне;
  с вероятностью `aimProb` — колонна, ближайшая к лафету; доля свёрл `drillP`.
- Выстрел лафета — один на экране, движется подшагами ≤3 px; порядок проверок: пули (искру/болт/бомбу сбивает, сверло поглощает выстрел),
  укрытие (взрыв r≈1.9 клетки), паразиты, зонд, коршуны (щит в строю отражает), матка (ядро → пластина пояса → броня корпуса).
- Пули противника: укрытие (взрыв 1.8, у сверла и бомбы 2.4), лафет (−1 жизнь, пули убираются, 1.7 с до возрождения, 1 с неуязвимости), земля.
- Зонд: при `kind=grid` и ≥ 6 живых, раз в ~19 с (×0.85…1.2), 92 px/с, очки из `PROBE_PTS`.
- Коршуны: щит переключается сам (`shOn`/`shOff` с разбросом); нырок раз в `diveEvery` (не больше `maxDivers` одновременно):
  к x лафета, глубина 430–566, длительность `diveT`, две бомбы на снижении, таран лафета, стирание укрытий.
- Матка: пояс(а) вращаются (`spin` рад/с), пластина — `max` попаданий; ядро — `hp` попаданий (10 / 16); ремонт одной выбитой пластины
  на пояс раз в `repair` с; огонь болтами в лафет раз в `bossFire` с (с половины hp — веер из трёх), гондолы роняют искры.
- Волна отбита → `clear` (+100×номер), 2 с → следующая волна (новые укрытия) или `win` после `maxWave`. +1 жизнь при 5000 и 10000 очков.

`ZASTAVA.logic`: константы, `WAVES` (10 записей `{kind,name,…}`), `PTS`, `PROBE_PTS`, `params(wave, diff)`, `inAnvil(c,r)`, `makeBunkers()`.

## Рендеры
`ZASTAVA.modern` / `ZASTAVA.classic`: `{ P, bg(ctx,g), draw(ctx,S,g,{bare,toasts,fx}), lifeIcon(ctx,x,y,on) }`.
`bare` — без HUD (фон титула). `ZASTAVA.ui.hud/banner/toasts(...)` — тексты только через `g.t()`.

## main.js
`Arcade.createGame({gameId:'zastava'})` с палитрами тем, `useStandardScreens` (титул переопределён: демо-волна на фоне + меню движка;
пауза — P/Esc повторно продолжает; на финале «до земли» — доп. подпись). Сложность — `g.difficulty` через хук `difficulty`.
Ввод: `g.input.dir.x` → `setDir`, `pressed('action')` → `setFire`, `action` → выстрел; палец по полю — лафет едет к пальцу, тап — выстрел.
`ZASTAVA.app = { g, game() }` — для автотестов в браузере.
