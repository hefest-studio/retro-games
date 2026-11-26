# СПУТНИК — контракт модулей

Игра аркады «Гефест» на фреймворке Гефест Arcade (`engine.js`). Общий стандарт:
офлайн, `file://`, без внешних URL/шрифтов/ассетов, RU/EN/TR/ES/PT, темы modern/retro (меняют
только отрисовку), WebAudio-звук, рекорд в `localStorage` (`arcade.best.sputnik`, на площадках — и в облако).
Права: название, корабль «Спутник», мастерская «Горн», враги, боссы, уровни, арт (пиксельный и векторный),
палитры, звуки и музыка — оригинальные; чужих имён и терминов нет (тест «Правило имён»).
Переделка 2026-11: главная механика — калильный жар и закалка (README, раздел «Переделка 2026-11»).

## js/game.js — `SPUTNIK.Game(opts)` (без DOM, детерминирована при заданном `rng`)
`opts`: `{ rng, level=1, lives=3, maxLevel=6, difficulty(level,base,step,max), onEvent(type,data) }`.

Поле 640×360, полоса HUD до `TOP=26`. Все координаты мировые, камера `S.cx` едет вправо со скоростью `SCROLL=44` px/с
(стоит, пока жив полубосс, и на арене босса). Корабль: 160 px/с, хитбокс пуль ±10×±4, рельефа ±12×±5.
Рельеф — колонки по 8 px (`ceil[]`/`floor[]` — толщина потолка/пола), линейная интерполяция; механизмы: поршни (`piston`) и шестерни (`gear`).

API: `start()` → api · `update(dt)` · `setDir(dx, dy)` (−1/0/1) · `quench()` (закалка; false — нельзя) · `canQuench()` ·
`reviveAd()` (ещё шанс после последнего корабля) · `canBoost()` / `boost()` (+1 корабль и полный жар) · `state()` → S.
Тестовые хуки: `_setupLevel(n)`, `_ceilY(x)`, `_floorY(x)`, `_solid(x,y)`, `_terrainHit(x,y,hw,hh)`, `_mechRects(m, ahead)`, `_skimGap(x,y)`,
`_spawn(sp)`, `_enemy(type,x,y,extra)`, `_bullet(x,y,vx,vy,kind)` → пуля, `_heat(v)`, `_spawnBoss()`, `_layoutBoss(B,dt)`, `_shipHit(why)`, `_volley()`, `_bossDamage(d)`.

`S`: `level, maxLevel, lives, score, phase('intro'|'play'|'dead'|'clear'|'over'), phaseT, time, over, won, name, lv{def,ceil,floor,N,len,total,midX,cps[3],mechs[],spawns[]}, prm,
cx, hold, cp, cpIdx, spawnIdx, extra, clearBonus, ship{x,y,dead,grace,vx,vy,tilt},
heat (0..100), tier (0|1|2), skim (0..1), skimSide ('c'|'f'|'m'|null), skimX, skimY, heatHold, qcd, ring{x,y,r,R,dmg,heat,t}|null, fireCd,
shots[{x,y,vx,vy,kind:'shot'|'hot'|'spark',dmg,…}], bullets[{x,y,vx,vy,r,kind:'spark'|'big'}],
enemies[{type,x,y,r,hp,max,…}], boss{type,x,y,hp,max,open,weak{x,y,r},armor[{x,y,r,part?}],parts[],segs[],hot,head,mode,enter,phase2}|null,
guard|null, laser{y,x0,x1,h,warn}|null, kills, deaths, quenches, doused, skimT, tutor{quench,quenched}`.

События `onEvent`: `level{level,name}`, `checkpoint{idx,x}`, `shoot{tier}`, `skim{x,y,k,side}` (≈ 11/с), `tier{tier,up}`, `tutorQuench`,
`quench{x,y,heat,R}`, `douse{n,x,y}`, `eshot{type}`, `hit`, `kill{x,y,type,pts,by,heat}`, `crash`, `wallHit`, `bulletWall`, `stingerWarn`,
`guard`, `guardDie`, `boss{type}`, `bossHit{hp,by}`, `clang`, `bossRage`, `partHit`, `partDie`, `bossFire`, `bossDie{pts}`,
`playerHit{x,y,lives,why:'wall'|'bullet'|'enemy'|'boss'|'laser'}`, `respawn{cp,ad?}`, `life{lives,ad?}`, `clear{level,bonus}`, `gameover`, `win`.

Правила:
- **Жар:** зазор `d` от корпуса до кромки (порода — пол/потолок, у 1-го уровня потолка нет; поршни; шестерни) < `SKIM=30` →
  `+SKIM_RATE·(1−d/SKIM)` в секунду (`SKIM_RATE=48`), очки до 30/с; иначе жар держится `HEAT_HOLD=0.8` с и остывает на 5/с.
  Сбитый враг +3 (слиток +22, полубосс +35), тоже с задержкой остывания. Ступени: `TIER1=35`, `TIER2=70`.
- **Огонь** автоматический раз в 0.15 с (в `intro` и `play`): ступень 0 — `shot` ×1; 1 — `shot` ×2 (±4 px); 2 — `hot` ×2 (урон 1.5) + `spark` ×2 (±0.2 рад, 0.55 с).
- **Закалка:** жар ≥ `QUENCH_MIN=25`, перезарядка 0.8 с → `ring` радиуса `60+1.6·жар` растёт на 560 px/с вокруг корабля: гасит пули,
  бьёт врагов (`2+жар/12`, раз каждого), открытое слабое место босса (×2) и пушки-руки; корабль неуязвим 0.45 с; жар → 0.
- **Гибель:** рельеф/механизм, пуля, таран врага/босса, луч Зерцала. −1 жизнь, жар → 0, 1.6 с → возврат к последней контрольной
  точке (`cps`: старт, перед полубоссом, арена) с 2 с неуязвимости; враги после точки появляются заново, полубосс — если не убит.
- **Полубосс** (`guard`, посередине уровня): камера стоит, пока он жив; прицельные тройки и кольца; гибель — +2000 и жар.
- **Боссы** (арена в конце уровня, `B.enter` — выход на сцену): Горнило (пасть открыта 2.2 с из 4.2), Молот (глаз за качающимся бойком, бросок вперёд),
  Цепь (10 звеньев «восьмёркой», уязвимо раскалённое звено `B.hot` 9→1, по 1.2 с), Улей (ядро открыто 2 с из 5, выпускает моль),
  Зерцало (глаз открыт при накачке, затем луч поперёк экрана на своей высоте), Сердце Окалины (две пушки-руки по 12 ед. и ядро со створками).
  С половины прочности — `phase2`. Повержен → `clear` (+1000×уровень), 2.6 с → следующий уровень или `win` после 6-го.
  +1 жизнь при 25 000, 60 000 и 100 000 очков (не больше 5).
- **1-й уровень — обучение:** рельеф 160–900 px — ровный низкий пол, враги — с 900 px, первый слиток — с 1300 px.

`SPUTNIK.logic`: константы, `LEVELS` (6 записей `{name,boss,len,c,f,bumps,gap,pistons,gears,pool,space}`), `EN`,
`params(level, diff)`, `buildLevel(n)` (детерминированно от номера), `tierOf(heat)`, `mulberry32`.

## Рендеры
`SPUTNIK.modern` / `SPUTNIK.classic`: `{ P, bg(ctx,g,S), draw(ctx,S,g,{bare,toasts,fx,game}), lifeIcon(ctx,x,y,on), ship(ctx,x,y,t,{heat,tilt,thrust}), ring(ctx,ring,sx) }`.
`P.heat[0..2]` — цвета ступеней, `P.steam` — цвет пара. `game` — экземпляр игры (рельеф/механизмы читаются через `_ceilY/_floorY/_mechRects`).
`bare` — без HUD (фон титула и карточки). `SPUTNIK.ui.hud/bossBar/banner/toasts(...)` — тексты только через `g.t()`.

## main.js
`Arcade.createGame({gameId:'sputnik', leaderboard:'sputnik'})` с палитрами тем, `useStandardScreens` (титул переопределён: демо-полёт на фоне + меню движка;
пауза — P/Esc повторно продолжает). Сложность — `g.difficulty` через хук `difficulty`.
Ввод: `g.input.dir` или тач-стик (`ArcadeStick`, порог 0.3) → `setDir`; `action` (Пробел, геймпад A) и X/Z/K/J/Shift (геймпад B), кнопка ◆ → `quench()`.
Площадка: `g.persist('arcade.best.sputnik','max')`, `useLeaderboard` (таблица `sputnik`), `useNoAds` (меню и пауза), `onCloud` → досылка рекорда,
`useRewardedContinue` → `reviveAd()`, `useRewardedBonus` (пауза) → `boost()`, сцена `card` между уровнями → `g.adBreak()` по нажатию (если `g.adReady()`).
Подсказки 1-го уровня — `tutor()` поверх кадра. `SPUTNIK.app = { g, game() }` — для автотестов в браузере.
