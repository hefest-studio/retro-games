# ЭСКАДРИЛЬЯ (EN: HAZEWING) — контракт модулей

Игра аркады «Гефест» на фреймворке Гефест Arcade v2.10 (`engine.js`). Общий стандарт: офлайн, `file://`,
без внешних URL/шрифтов/ассетов, RU/EN/TR/ES/PT, темы modern/retro (меняют только отрисовку), WebAudio-звук,
рекорд в `localStorage` (`arcade.best.eskadrilya`, на площадке — облако через `g.persist`). Права: название, мир, правила,
перелёты, арт, палитры, звуки и музыка — оригинальные; чужих имён, реальных стран/техники/сражений нет (тест «правило имён»).
Переделка 2026-11 «Наводка и завеса» — см. README.

## js/game.js — `ESKADRILYA.Game(opts)` (без DOM, детерминирована при заданном `rng`)
`opts`: `{ rng, level=1, lives=3, maxLevel=8, difficulty(level,base,step,max), onEvent(type,data), noTut }`.

Поле 480×640, HUD сверху 44 px (`TOP`). Самолёт летает в `PX0..PX1 × PY0..PY1` (22..458 × 116..604), 225 px/с, радиус `PR=9`.
Прокрутка `SCROLL=62` px/с; мировая координата `wy` → экран `y = H − (wy − dist)`. Огонь автоматический: залп раз в `FIRE_CD=0.15` с.

API: `start()` → api · `update(dt)` · `setDir(dx,dy)` (−1…1 по осям) · `setFire(bool)` (по умолчанию вкл) · `setSmoke(bool)` (удержание дыма) ·
`fire()` (один залп) · `reviveAd()` / `canBoost()` / `boost()` (реклама за награду) · `state()` → S.
Хуки для тестов, бота и промо: `_setupLevel(n)`, `_spawnAir(type,x,y,o)`, `_spawnGround(type,x,wy,dir)`, `_spawnBoss()`, `_hurt(x,y)`,
`_pickup(kind)`, `_drop(kind,x,y)`, `_aimShot(...)`, `_puff(x,y,k,still)`, `_startAim(e,x,y)`, `_lineBlocked(ax,ay,bx,by)`, `_inSmoke(x,y)`,
`_wy(y)`, `_sy(wy)`, `_isLand(x,wy)`, `_runEvent(ev)`, `_finish()`.

`S`: `level, maxLevel, lives, score, phase('play'|'dead'|'clear'|'over'), phaseT, time, over, won, banner, clearBonus, name, prm,
terrain{Lw[],Rw[],isles[],len}, script{air[{at,pat,x,side,seed,calm}],ground[{type,x,wy,dir}]}, dist, scroll, stage('route'|'boss'),
player{x,y,hull,dead,grace,cool,power,bank,smoke,smoking}, shots[], bullets[{x,y,vx,vy,kind:'shot'|'flak'|'shell',src}],
air[{type:'bird'|'swift'|'blimp',x,y,hp,aimT,aimMax,blindT,sootT,…}], ground[{type:'flak'|'boat'|'depot',x,wy,hp,aimT,…}],
pickups[{kind:'smoke'|'patch'|'power',x,y}], puffs[{x,wy,t,life,k,vx,vw}], aims[{x,y,k}] (линии наводки этого кадра; k — доля готовности),
boss{x,y,anchored,pods[{dx,dy,kind:'gun'|'twin',hp,aimT,…}],fans[{dx,dy,spin}],core{hp,max,open,aimT,…},falling,alive,total}|null,
kills, broken, sooted, brokenHere, tip, tut`.

События `onEvent`: `level`, `raid`, `shoot`, `aim{x,y}`, `aimBroken{x,y,px,py,pts}`, `sooted{x,y}`, `smokeStart`, `enemyShot`, `swiftDive`,
`hitAir`, `kill{x,y,type,pts,soot}`, `groundHit`, `groundKill{…,soot}`, `clang`, `podHit`, `podKill{x,y,left,pts}`, `coreOpen`, `coreHit`, `bossDown`,
`bossArrive`, `bossAnchor`, `hurt{x,y,hull,src}`, `playerLost`, `respawn`, `life`, `drop`, `pickup`, `pickupLost`, `clear{level,bonus}`, `gameover`, `win`.

Правила:
- **Наводка:** стрелок (птица на подлёте, стриж, дирижабль, зенитка, катер, гондола, горн) сначала `startAim` — `aimT = prm.aimT` (0,72 → 0,45 с
  к 8-му перелёту), каждый кадр линия попадает в `S.aims`; по окончании — выстрел. Не целится вплотную (< 80 px), под HUD и у нижнего края,
  ослеплённым (`blindT`) и закопчённым (`sootT`).
- **Дым:** `setSmoke(true)` при запасе > 0 тратит `SM_USE=45`/с и раз в 0,045 с выпускает клуб вперёд по курсу (тормозит, повисает перед носом,
  уплывает назад с миром; живёт `PUFF_LIFE=2.4` с, радиус до `PUFF_R=24`). Отпустил — через `SM_DELAY=0.6` с запас копится `SM_REGEN=3.5`/с.
- **Срыв:** клуб на отрезке «стрелок → самолёт» (`lineBlocked`) обрывает наводку: выстрела нет, `blindT=0.8` с, `aimBroken`, +25 очков
  (не больше `BROKEN_CAP=120` срывов за перелёт; в бонус перелёта — ×30). Выпущенные пули дым не гасит.
- **Копоть:** враг, вошедший в дым, — `sootT=2.4` с: не целится, ход ×0.55, сбитый даёт очки ×2.
- **Обшивка:** 3 заплаты; попадание/таран −1 и 0,6 с неуязвимости; 0 → самолёт потерян (стволы −1), через 1,8 с — новый (полная обшивка и дым, 2 с
  неуязвимости). +1 самолёт за 40 000 очков (до 5).
- **Летучая кузня:** при `dist ≥ len` подходит сверху до `BOSS_Y=150` и встаёт (`scroll=0`); до остановки гондолы неуязвимы (`clang`) и молчат.
  Гондолы (3→7 по перелётам; `twin` — веер) целятся и бьют; все сбиты → горн открыт (`coreOpen`, веер из 5); горн сбит → `bossDown`
  (+2000+500·N), падение 2,6 с → `clear` (обшивка×500 + срывы×30 + 1000 без потерь), 2,8 с → следующий перелёт или `win`.
  **Винты** (`FANS`, радиус `FAN_R=120`) втягивают и съедают дым. Со 2-го перелёта во время боя прилетают стрижи.
- **Обучение** (1-й перелёт, без `noTut`): подсказки `tut1…tut5` держатся, пока игрок не сделал шаг (полёт → увидел линию → поставил дым → срыв);
  налёты до 900 px — без огня, наземные цели — после 900 px.

`ESKADRILYA.migrate(localStorage)` — переделка: прежний рекорд → `arcade.eskadrilya.oldBest`, `arcade.eskadrilya.v = 2`; возвращает прежний рекорд (один раз).
`ESKADRILYA.logic`: константы, `LEVELS` (8 записей `{name,len,terr,pods}`), `SLOTS`, `FANS`, `PTS`, `puffR`, `segDist`,
`params(level, diff)`, `makeTerrain(level)`, `makeScript(level,T,prm)`, `isLand(T,x,wy)`, `mulberry32`.

## Рендеры
`ESKADRILYA.modern` / `ESKADRILYA.classic`: `{ P, draw(ctx,S,g,{bare,toasts,fx}), lifeIcon, hullIcon, puffs, … }`. Порядок: рельеф → цели → враги →
кузня → дым → паролёт → линии наводки → пули → HUD. `bare` — без HUD (фон титула, паузы, финалов). Тексты — только через `g.t()`.

## main.js
`Arcade.createGame({ gameId:'eskadrilya', leaderboard:'eskadrilya' })`, `useStandardScreens` (титул свой: демо-полёт + «кто есть кто»: линия → дым → ×2),
сцена `card` между перелётами (межстраничная по нажатию, только когда площадка готова). Ввод: `g.input.dir`/стик (`js/stick.js`)/палец по полю → `setDir`;
дым — `X`/`K`/`Shift`/пробел/геймпад A·B/кнопка `☁` (через `Arcade.touchOk`). Площадка: `useLeaderboard`, `useNoAds`, `useRewardedContinue`, `useRewardedBonus`,
`g.persist('arcade.best.eskadrilya','max')`, `menuFit`. `ESKADRILYA.app = { g, game() }` — для автотестов и промо.
