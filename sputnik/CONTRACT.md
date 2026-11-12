# СПУТНИК — контракт модулей

Игра аркады «Гефест» на фреймворке Гефест Arcade v2.2 (`engine.js`). Общий стандарт:
офлайн, `file://`, без внешних URL/шрифтов/ассетов, RU/EN, темы modern/retro (меняют
только отрисовку), WebAudio-звук, рекорд в `localStorage` (`arcade.best.sputnik`).
Права: название, корабль «Горн», дрон «Наковальня», оптики, враги, боссы, уровни, арт (пиксельный и векторный),
палитры, звуки и музыка — оригинальные; чужих имён и терминов нет (тест «Правило имён»).

## js/game.js — `SPUTNIK.Game(opts)` (без DOM, детерминирована при заданном `rng`)
`opts`: `{ rng, level=1, lives=3, maxLevel=6, difficulty(level,base,step,max), onEvent(type,data) }`.

Поле 640×360, полоса HUD до `TOP=26`. Все координаты мировые, камера `S.cx` едет вправо со скоростью `SCROLL=44` px/с
(стоит, пока жив полубосс, и на арене босса). Корабль: 160 px/с, хитбокс пуль ±11×±5, рельефа ±13×±6.
Рельеф — колонки по 8 px (`ceil[]`/`floor[]` — толщина потолка/пола), линейная интерполяция; механизмы: поршни (`piston`) и шестерни (`gear`).

API: `start()` → api · `update(dt)` · `setDir(dx, dy)` (−1/0/1) · `setFire(bool)` (удержание) · `tap()` (нажать-отпустить) ·
`drone()` (отстегнуть / вернуть; false — нельзя) · `state()` → S.
Тестовые хуки: `_setupLevel(n)`, `_ceilY(x)`, `_floorY(x)`, `_solid(x,y)`, `_terrainHit(x,y,hw,hh)`, `_mechRects(m, ahead)`, `_spawn(sp)`,
`_enemy(type,x,y,extra)`, `_bullet(x,y,vx,vy,kind)`, `_pickup(type)`, `_spawnBoss()`, `_layoutBoss(B,dt)`, `_shipHit(why)`, `_volley()`, `_beam(c)`, `_bossDamage(d)`.

`S`: `level, maxLevel, lives, score, phase('intro'|'play'|'dead'|'clear'|'over'), phaseT, time, over, won, name, lv{def,ceil,floor,N,len,total,midX,cps[3],mechs[],spawns[]}, prm,
cx, hold, cp, cpIdx, spawnIdx, extra, clearBonus, ship{x,y,dead,grace,vx,vy,tilt}, fire{held,heldT,charge,cd},
drone{state:'front'|'back'|'launch'|'free'|'return', x,y,vx,kind:null|'R'|'S'|'V', lvl:0..2, glow, spin, homeSX}, optics[{x,y}],
shots[{x,y,vx,vy,kind:'shot'|'opt'|'dshot'|'ric'|'crawl'|'fan'|'beam',dmg,…}], bullets[{x,y,vx,vy,r,kind:'spark'|'big'}],
enemies[{type,x,y,r,hp,max,…}], caps[{x,y,type}], boss{type,x,y,hp,max,open,weak{x,y,r},armor[{x,y,r,part?}],parts[],segs[],head,mode,enter,phase2}|null,
guard|null, laser{y,x0,x1,h,warn}|null, kills, deaths, absorbed`.

События `onEvent`: `level{level,name}`, `checkpoint{idx,x}`, `shoot`, `beam{c,dmg}`, `chargeFull`, `eshot{type}`, `hit`, `kill{x,y,type,pts,by}`, `crash`,
`burn`, `absorb{by:'drone'|'optic'}`, `ricochet`, `wallHit`, `bulletWall`, `droneLaunch{dir}`, `droneRecall`, `droneAttach{side}`, `capDrop{type}`,
`pickup{type,lvl,optics}`, `stingerWarn`, `guard`, `guardDie`, `boss{type}`, `bossHit{hp}`, `clang`, `bossRage`, `partHit`, `partDie`, `bossFire`,
`bossDie{pts}`, `playerHit{x,y,lives,why:'wall'|'bullet'|'enemy'|'boss'|'laser'}`, `respawn{cp}`, `life`, `clear{level,bonus}`, `gameover`, `win`.

Правила:
- **Дрон «Наковальня»** (r=11, неуязвим): `front`/`back` — у носа/кормы (±20 px). `drone()` с носа — вылет вперёд 340 px/с до x экрана W−70
  (с кормы — назад до 40), затем `free`: держит x на экране, по высоте тянется к кораблю (80 px/с). Повторный `drone()` — `return` (280 px/с к кораблю).
  Стыковка при касании (дистанция < 26): дрон правее корабля → `front`, левее → `back`. Глотает любые вражеские пули; жжёт врагов касанием
  7 ед/с (в полёте ×2), у босса — только открытое слабое место.
- **Лучи дрона** (по нажатию огня, только пристыкованный; с кормы — зеркально назад): `R` рикошет — 3 луча (0, ±0.45 рад; ур.2 — 5),
  отражаются от рельефа до 2 раз; `S` змейка — 2 «ползуна» вверх/вниз до рельефа и дальше по его кромке (ур.2 — плюс прямой);
  `V` веер — 5 коротких лучей ±0.44 рад (ур.2 — 7, шире и дальше). Урон 1, на ур.2 — 2. Отстёгнутый дрон стреляет прямо.
- **Капсулы** (выпадают из носителей и полубосса): R/S/V — смена луча (уровень сохраняется, тот же тип → ур.+1, максимум 2); O — оптика (до 2, сверх — +500).
- **Огонь корабля:** нажатие — залп (выстрел корабля + оптик + луч дрона; ≤ 6 выстрелов корабля на экране, пауза 0.09 с).
  Удержание > 0.14 с копит заряд (полный за 1 с); отпускание при заряде ≥ 0.3 — пробивной луч: урон `3+9·c`, пробивает врагов, пока хватает урона.
- **Гибель:** рельеф/механизм, пуля, таран врага/босса, луч Зерцала. −1 жизнь, оптики теряются, уровень дрона −1 (на 0 — без луча),
  1.6 с → возврат к последней контрольной точке (`cps`: старт, перед полубоссом, арена) с 2 с неуязвимости; враги после точки появляются заново, полубосс — если не убит.
- **Полубосс** (`guard`, посередине уровня): камера стоит, пока он жив; прицельные тройки и кольца; гибель — капсула, +2000.
- **Боссы** (арена в конце уровня, `B.enter` — выход на сцену): Горнило (пасть открыта 2.2 с из 4.2), Молот (глаз за качающимся бойком, бросок вперёд),
  Многоножка (10 сегментов «восьмёркой», уязвим хвост), Улей (ядро открыто 2 с из 5, выпускает моль), Зерцало (глаз открыт при накачке,
  затем луч поперёк экрана на своей высоте), Сердце Окалины (две пушки-руки по 12 ед. и ядро со створками). С половины прочности — `phase2` (злее).
  Повержен → `clear` (+1000×уровень), 2.6 с → следующий уровень или `win` после 6-го. +1 жизнь при 50 000 очков.

`SPUTNIK.logic`: константы, `LEVELS` (6 записей `{name,boss,len,c,f,bumps,gap,pistons,gears,pool,space,caps}`), `EN`, `CAPS`,
`params(level, diff)`, `buildLevel(n)` (детерминированно от номера), `mulberry32`.

## Рендеры
`SPUTNIK.modern` / `SPUTNIK.classic`: `{ P, bg(ctx,g,S), draw(ctx,S,g,{bare,toasts,fx,game}), lifeIcon(ctx,x,y,on), ship(...), drone(...) }`.
`game` — экземпляр игры (рельеф/механизмы читаются через `_ceilY/_floorY/_mechRects`). `bare` — без HUD (фон титула).
`SPUTNIK.ui.hud/bossBar/banner/toasts(...)` — тексты только через `g.t()`.

## main.js
`Arcade.createGame({gameId:'sputnik'})` с палитрами тем, `useStandardScreens` (титул переопределён: демо-полёт на фоне + меню движка;
пауза — P/Esc повторно продолжает). Сложность — `g.difficulty` через хук `difficulty`.
Ввод: `g.input.dir` → `setDir`, `pressed('action')` или Z/J → `setFire`; X/K/Shift и кнопка `◎` → `drone()`; тач-дпад ▲▼◀▶ и `●`.
`SPUTNIK.app = { g, game() }` — для автотестов в браузере.
