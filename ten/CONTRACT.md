# ТЕНЬ — контракт модулей

Игра аркады «Гефест» на фреймворке Гефест Arcade v2.2 (`engine.js`). Общий стандарт: офлайн, `file://`, без внешних
URL/шрифтов/ассетов, RU/EN, темы modern/retro (меняют только отрисовку), WebAudio-звук, рекорд в `localStorage`
(`arcade.best.ten`). Глобальное пространство имён — `TEN`.
Права: название, героиня (разведчица Тень), Ржавый Синдикат, враги, боссы, акты, сюжет, арт, палитры, звуки и музыка —
оригинальные; чужих имён и терминов нет (тест «Правило имён»).

## js/levels.js — `TEN.levels`
`build(act, scene)` → карта; `scene` 1..3 — сцены, 4 — арена босса. `T = 16` px, высота сцены `H = 30` рядов, арены 40×24.
Коды клеток `C`: `E` пусто, `S` твердь (за неё можно цепляться), `P` мосток (твёрд только сверху), `X` шипы (не твердь, ранят).
Карта: `{ act, scene, w, h, t: Uint8Array, start{x,y}, exit{x,y}|null, time (с), rings[{id,x,y}], enemies[{id,k,x,y,x0,x1}],
lamps[{id,x,y,item}], lights[{id,x,y,base,amp,len,sp,ph}], deco[{k:'tower',c,r0,r1}], counts{сегмент: n}, arena{x0,x1,floor,boss}|null }`.
Предметы фонарей: `c5|c10` (заряд), `hp`, `pts`, `life`, `sp:star|smoke|whirl|fire` (смена приёма).
Сегменты: `flat, pit, step, drop, chimney(deadly), rings, ledges, duct, pillars, guard, spikes`; рецепт сцены зависит от акта/сцены.
`BOSSES = ['foreman','boiler','crane','harpoon','pendulum','chancellor']`. `mulberry32(seed)`.

## js/game.js — `TEN.Game(opts)` (без DOM, детерминирована при заданном `rng`)
`opts`: `{ rng, act=1, scene=1, lives=3, onEvent(type,data), god (тесты: урон не наносится), autoCut (тесты: кат-сцены пропускаются) }`.
API: `start()` · `update(dt)` (шаг 1/60) · `setInput(dx, dy, jumpHeld)` · `press('jump'|'strike'|'hook'|'special')` ·
`nextAct()` (после кат-сцены) · `restartScene()` (−1 жизнь) · `continueGame()` (после конца игры) · `state()` → S.
Тестовые хуки: `_go(act, scene)`, `_place(x, y)`, `_die(why)`, `_hurt(n, x, why)`, `_alarm(x, y)`, `_hitBoss(n)`.

`S`: `act, scene, phase('play'|'dead'|'clear'|'cut'|'won'|'over'), phaseT, score, lives, hp, charge, special, LV (копия карты),
hero, enemies[], shots[], eshots[], fires[], pickups[], lamps[], boss, time, alarm, inv, atkT, atkCd, whirl, smoke, t, sceneT,
kills, deaths, why{}, continues, cleared[], lastClear, won, over`.
Героиня `hero`: `{ x, y (подошвы), vx, vy, face, ground, cling (−1 стена слева | 0 | 1 справа), crouch, slideT,
hook{x,y,L,id}|null, mantle|null, lockT, coyote, jbuf, runT, t, wj, hazard, fell }`.

События `onEvent`: `start`, `scene{act,scene}`, `jump`, `walljump`, `cling{side}`, `pull`, `mantle`, `land{v}`, `bonk`, `slide`,
`drop`, `hook{x,y}`, `hookMiss`, `unhook`, `fling`, `strike`, `special{k}`, `noCharge`, `kill{k,pts,how}`, `enemyHit`,
`parry`, `lamp`, `pickup{item}`, `hurt{hp,why}`, `die{why: hp|enemy|boss|shot|spikes|pit|time}`, `respawn`, `life`,
`alarm`, `hop`, `eshoot`, `baton`, `boom`, `respawnEnemy`, `boss{k}`, `bossWind`, `bossCharge`, `bossLeap`, `bossBump`,
`bossRage`, `bossHit{hp}`, `bossDown`, `clear{act,scene,bonus,time,boss}`, `cut{after}`, `win{score}`, `gameover{score}`, `continue`.

Правила:
- **Физика** (px, с): g = 1600, прыжок 470 (≈ 4,3 клетки; отпустил — срез до 210), бег 150, разгон 1500 (в воздухе 820),
  торможение 1700, падение ≤ 640, койот 0,08 с, буфер прыжка 0,12 с. Хитбокс 12×24 (присед/подкат — 12×12).
  Подшаги ≤ 4 px — без проскока сквозь клетку.
- **Стена:** автоцепляние в полёте при касании стены, перекрывающей корпус (точки на 6 и 20 px над подошвой); висит
  (`vy = 0`), ↓ — скольжение 150 px/с. Прыжок от стены: `vx = 230` от стены, `vy = −470`, 0,13 с без руления, 0,1 с нельзя
  снова схватиться за ту же сторону. Подтягивание: верх стены не выше 44 px над подошвой и место для стоящей героини —
  ↑ или к стене, 0,16 с. Отпустить — держать направление от стены 0,16 с.
- **Крюк:** кольцо выше руки (рука — 20 px над подошвой) в радиусе 132; длина троса 36..150; маятник — ограничение
  длины с гашением радиальной скорости, раскачка 560 px/с² (пока ниже кольца), скорость ≤ 560; бросок — `vy` ещё −170,
  `vx` ×1,12; приземление на тросе — отцепляет.
- **Подкат:** ↓ на бегу быстрее 100 → 290 px/с на 0,34 с, затем присед; под потолком — ползком 70 px/с. ↓ + прыжок на
  мостке — спрыгнуть.
- **Серп:** 0,2 с анимации, первые 0,12 с бьёт в прямоугольнике 34×26 перед собой, перезарядка 0,24 с, урон 1.
- **Приёмы** (стоимость): звезда 3 (420 px/с, 0,9 с, ≤ 4 на экране), вихрь 8 (1 с, r 34, урон 2 раз в 0,3 с),
  огонь 10 (полоса до 170 px, 0,8 с, урон 2), дым 10 (3 с невидимости, гасит тревогу). Старт — звёзды, заряд 10.
- **Враги** (здоровье/очки): шагоход 1/100, прыгун 1/150, стрелок 2/200 (болт 190 px/с раз в ≈ 2,1 с на высоте 17 px),
  дрон 1/150, страж 3/300 (луч 150 px, ±0,3 рад, удар дубинкой вблизи −1, касание −2). Возрождение: точка появления
  дальше 380 px от героини и прошло ≥ 6 с. Тревога 5 с: скорость ×1,35, до 2 дронов-подкреплений за сцену.
- **Боссы** (здоровье): Бригадир 10 (касание −1), Котёл 14, Кран 14, Гарпунёр 16, Часовщик 16, Канцлер 24; с половины —
  ярость (×1,3 и новые атаки). 2 с представления — неуязвим. Неуязвимость после попадания 0,3 с.
- **Здоровье** 8, неуязвимость после раны 1,1 с, отброс. Жизни 3; +1 за 20 000 очков (до 9).

`TEN.logic`: `K, T, C, EN, BOSS, SPECIAL, tile, solid, solidAt, boxHits, boxHazard, floorY, newHero, heroH,
heroStep(LV, P, inp, dt, ev)` (вся физика героини; `inp = {dx, dy, jump, jumpP, hookP}`), `stateOf(P)`, `findRing`,
`mantleSpot`, `wallAt`, `getLV(act, scene)` (кэш), `onFloor`.

## js/render.js — `TEN.render(g, ctx, S, ui)`, `TEN.R`
`ui = { cam, toasts, banner, tip }`. Камера `R.camera(cam, S, dt, snap)` — упреждение по взгляду и скорости; на арене
фиксирована. Кэш клеток и фонов по (акт, тема). retro — буфер 320×180 → ×2, клетки — спрайты 8×8.
`R.FX` — частицы в координатах мира. `R.hero/enemy/boss/item/spIcon/gear/cone/art(ctx, id, w, h, t, rt)` — примитивы
(титул, финалы, кат-сцены).

## js/story.js — `TEN.STORY`
7 наборов панелей: 0 — вступление, 1..5 — после актов, 6 — финал. Панель `{ art, ru, en }`.

## main.js
Сцены движка (`useStandardScreens`), титул перерисован; пауза + «Сцена заново»; `gameover` — продолжение (Enter) или меню (Esc);
своя сцена `cut` (кат-сцены, Enter — дальше, Esc — пропустить). `play` — фикс-шаг 1/60. Доп. клавиши: прыжок Z, серп X/J,
крюк C/K, приём V/Shift; тач-кнопки `#bAtk`, `#bHook`, `#bSp`, `#bPause`, прыжок — `[data-d="A"]`.
`TEN.app = { g, game(), cam() }` — для отладки/автотестов в браузере.

## tests
`engine.test.mjs` — структура, физика (стены, подтягивание, крюк, подкат, мостки, «нет проваливания»), правила (шипы,
пропасть, таймер, серп, возрождение, тревога, дым, приёмы, фонари, боссы, продолжение, выход), проходимость (граф по 18 сценам),
рендер обеих тем, кат-сцены, i18n, музыка, имена, партии бота. `bot.mjs` — `navFor(TEN, LV)` (граф по настоящей физике:
стоять / висеть на стене; рёбра — шаги и макро-действия: разбег + прыжок, сход, крюк + раскачка + бросок, прыжок от стены,
подтягивание, скольжение, отпускание), `robust()` (ребро устойчиво к ±3 px и ±2 кадрам), `playTen(TEN, seed, opts)`.
