# ЭСКАДРИЛЬЯ — контракт модулей

Игра аркады «Гефест» на фреймворке Гефест Arcade v2.2 (`engine.js`). Общий стандарт: офлайн, `file://`,
без внешних URL/шрифтов/ассетов, RU/EN, темы modern/retro (меняют только отрисовку), WebAudio-звук,
рекорд в `localStorage` (`arcade.best.eskadrilya`). Права: название, мир, правила, перелёты, арт, палитры,
звуки и музыка — оригинальные; чужих имён, реальных стран/техники/сражений нет (тест «правило имён»).

## js/game.js — `ESKADRILYA.Game(opts)` (без DOM, детерминирована при заданном `rng`)
`opts`: `{ rng, level=1, lives=3, maxLevel=8, difficulty(level,base,step,max), onEvent(type,data) }`.

Поле 480×640, HUD сверху 44 px (`TOP`). Самолёт летает в `PX0..PX1 × PY0..PY1` (22..458 × 116..604), 225 px/с,
радиус попадания `PR=9`; ведомые — ±`WING_DX=32`, +`WING_DY=14`, радиус `WR=7`. Прокрутка `SCROLL=62` px/с,
мировая координата `wy` → экран `y = H − (wy − dist)`. Выстрел 680 px/с, залп раз в `FIRE_CD=0.15` с.

API: `start()` → api · `update(dt)` · `setDir(dx,dy)` (−1/0/1 по осям) · `setFire(bool)` (удержание) · `fire()` (один залп) ·
`loop()` (петля; false — нельзя) · `state()` → S.
Тестовые хуки: `_setupLevel(n)`, `_spawnAir(type,x,y,o)`, `_spawnGround(type,x,wy,dir)`, `_spawnBoss()`, `_hurt(dmg,x,y)`,
`_pickup(kind)`, `_drop(kind,x,y)`, `_aimShot(...)`, `_isLand(x,wy)`, `_sy(wy)`, `_runEvent(ev)`, `_finish()`.

`S`: `level, maxLevel, lives, score, phase('play'|'dead'|'clear'|'over'), phaseT, time, over, won, banner, clearBonus,
name, prm, terrain{Lw[],Rw[],isles[{x,wy,rx,ry,ph}],len}, script{air[{at,pat,x,side,seed}],ground[{type,x,wy}]}, dist, scroll,
stage('route'|'boss'), player{x,y,energy,dead,grace,loopT,loops,cool,power,wing[2],wx[2],wy[2],bank,low},
shots[{x,y,vx,vy,wing}], bullets[{x,y,vx,vy,kind:'shot'|'flak'|'shell',src}], air[{type:'bird'|'swift'|'blimp',x,y,hp,max,pat,red,…}],
ground[{type:'flak'|'boat'|'depot',x,wy,hp,vx,alive}], pickups[{kind:'fuel'|'wing'|'loop'|'power',x,y}],
boss{x,y,wy,anchored,turrets[{dx,dy,kind:'gun'|'twin',hp,max,aim,alive}],funnels[{dx,dy,w,h}],sinking,sinkT,total}|null, kills`.

События `onEvent`: `level{level,name}`, `raid{pat}`, `shoot{x,power}`, `hitAir/groundHit/turretHit{x,y}`, `kill{x,y,type,pts,red}`,
`groundKill{x,y,type,pts}`, `turretKill{x,y,left,pts}`, `clang{x,y}`, `enemyShot{x,y,kind,n}`, `hurt{x,y,energy,dmg,src}`, `lowEnergy`,
`wingLost{x,y,i}`, `loop{loops}`, `loopEnd`, `drop{kind,x,y}`, `pickup{kind,x,y}`, `pickupLost`, `bossArrive`, `bossAnchor`,
`bossSink{x,y,pts}`, `playerLost{x,y,lives}`, `respawn`, `life{lives}`, `clear{level,bonus}`, `gameover{score}`, `win{score}`.

Правила:
- Рельеф: секции по 640 px (`sea`, `isles`, `coastL`, `coastR`, `strait`, `land`) по `LEVELS[].terr`, ширина берегов
  сглажена и «изрезана»; старт и последние 200 px маршрута + зона крейсера — открытое море. Всё детерминировано по номеру перелёта.
- Сценарий: налёты каждые `airGap·(0.85…1.15)` px (`sine`/`cross`/`u`/`swifts`/`red`/`blimp`; каждый 4-й — «красная» стая);
  наземные цели каждые `groundGap·(0.8…1.2)` px: на суше — зенитка или склад (не чаще ~1000 px), на воде — катер.
- Энергия: `hurt(dmg)` → `energy −= round(dmg·dmgK)`, `grace=0.5`; в петле/неуязвимости урона нет. 0 → `playerLost`
  (жизнь −1, звено теряется, стволы −1, пули убираются), через 1.8 с — `respawn` (энергия 100, `grace=2`).
- Петля: `loops>0`, не в петле, фаза play → `loopT=1.1`, `loops−1`; пули проходят, тараны не действуют (и для ведомых);
  в петле нет огня, скорость ×0.6. На новом перелёте `loops=3`; бонус — до `LOOP_MAX=5`.
- Звено: ведомые тянутся к своим местам; пуля/таран в ведомого — `wingLost` (энергия ведущего не меняется);
  стреляют через залп.
- Огонь противника — прицельный, только с экрана (`TOP+8 < y < H−150`) и не в упор (> 90 px); турели — не ближе 40 px.
- Крейсер: появляется при `dist ≥ len`, прокрутка ×1.8 до `BOSS_Y=300`, затем `scroll=0`, лёгкое покачивание.
  До остановки турели неуязвимы (`clang`) и молчат. Выстрел игрока проверяется: воздух → трубы (глушат) → турели → наземные цели.
  Огонь турели раз в `turretFire·(n/3)^0.75·(1.3 у спаренной)·(0.85…1.3)` с; с 7-го перелёта — очередь из двух.
  С 3-го перелёта во время боя прилетают пары стрижей. Все турели погашены → `bossSink` (+2000+500·N), 2.6 с → `clear`
  (бонус: энергия×10 + петли×300 + 1000 без потерь), 2.8 с → следующий перелёт или `win` после `maxLevel`.

`ESKADRILYA.logic`: константы, `LEVELS` (8 записей `{name,len,terr,turrets}`), `SLOTS`, `FUNNELS`, `DROPS`, `PTS`, `DMG`,
`params(level, diff)`, `makeTerrain(level)`, `makeScript(level,T,prm)`, `isLand(T,x,wy)`, `mulberry32`.

## Рендеры
`ESKADRILYA.modern` / `ESKADRILYA.classic`: `{ P, draw(ctx,S,g,{bare,toasts,fx}), lifeIcon, loopIcon, wingIcon }`.
`bare` — без HUD (фон титула, паузы, финалов). `ESKADRILYA.ui.hud/banner/toasts(...)` — тексты только через `g.t()`.

## main.js
`Arcade.createGame({gameId:'eskadrilya'})` с палитрами тем, `useStandardScreens` (титул переопределён: демо-полёт на фоне + меню;
пауза — P/Esc повторно продолжает; фон паузы/финалов — кадр игры). Сложность — `g.difficulty` через хук `difficulty`.
Ввод: `g.input.dir` → `setDir`, `pressed('action')` → `setFire`; петля — `KeyX`/`KeyK`/`Shift`, кнопка `#bLoop`, двойной клик;
указатель по полю — самолёт идёт за пальцем со смещением, огонь пока палец на поле. `ESKADRILYA.app = { g, game() }` — для автотестов в браузере.
