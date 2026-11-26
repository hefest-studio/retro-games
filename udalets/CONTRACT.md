# УДАЛЕЦ — контракт модулей (переделка 2026-11: кузнечные мехи)

Игра аркады «Гефест» на фреймворке Гефест Arcade (`engine.js`, копия `_shared/engine.js`). Общий стандарт:
офлайн, `file://`, без внешних URL/шрифтов/ассетов, RU/EN/TR/ES/PT, темы modern/retro (меняют только отрисовку),
WebAudio-звук, рекорд в `localStorage` (`arcade.best.udalets`, + облако площадки через `g.persist`).
Права: название, герой (подмастерье Удалец), обитатели (шестерняк, искрокрыл, клёпань, плевун), цеха, уровни,
арт, палитры, звуки и музыка — оригинальные; чужих имён и терминов нет (тест «Правило имён»).

## js/levels.js — `UDALETS.LEVELS[10]`
Уровень: `{ theme, rooms: [экран…], grid? }`. Экран — 15 строк по 26 знаков; `grid` — раскладка экранов
(по умолчанию в ряд, `null` — кладка). Знаки: `#` кладка, `=` балка, `u` продух, `H` заслонка (твердь, пока не поднята),
`%` ложная стена (проходима), `^` шипы, `~` огонь, `a` кислота; `P` старт, `O` горн, `Y` крыльчатка, `i` табличка;
находки `.` шестерня, `g` самоцвет, `b` сапфир, `R` рубин, `+` жизнь; обитатели `w` шестерняк, `f` искрокрыл,
`v` клёпань, `s` плевун. Неизвестный знак, нет старта или горнов — ошибка `build`.

## js/game.js — `UDALETS.Game(opts)` (без DOM, детерминирована)
`opts`: `{ lives=3, level=1, onEvent(type,data), god (только тесты: обитатели не трогают), levels }`.
Экраны склеиваются в одну карту `LV` (`w×h`, `t[]`, `items`, `spawns`, `start`, `furn`, `vanes`, `shut`, `vents`, `up`, `ver`).
Координаты — в клетках: `hero.x` — центр, `hero.y` — подошвы.

API: `start()` · `update(dt)` (шаг 1/60) · `setInput(dx, dy, jump)` · `puff(dir?)` (`'down'` | ±1; без аргумента —
вниз при зажатом «вниз», иначе по взгляду; перезарядка 0,32 с) · `reviveAd()` / `canBoost()` / `boost()` (площадка) ·
`state()` → S. Тестовые хуки: `_goLevel(n)`, `_place(c, r)`, `_die(why)`.

`S`: `phase('play'|'dead'|'clear'|'won'|'over'), phaseT, level, LV, score, lives, nextLife, hero{x,y,vx,vy,ground,face,coy,jb,jl,air,up,walkT},
got, heat[], lit, spun, enemies[{id,k,room,alive,x,y,dir,t,cd,stun,pt,pv,fall,mul}], eshots[], gusts[], time, levelTime, cp, room, inv, puffCd,
kills, deaths, puffs, over, won`.

События: `level{level,furn}`, `room`, `jump`, `land`, `lift`, `puff{dir}`, `heat{id,heat}`, `lit{id,pts,left}`, `vane{id,opened}`,
`stun`, `snuff`, `kill{k,pts,how:'snuff'|'drop'}`, `eshoot`, `item`, `die{why:'spike'|'fire'|'acid'|'enemy'|'shot'|'fall'}`,
`respawn`, `life`, `gameover`, `continue`, `clear{level,bonus}`, `win`.

Правила:
- **Физика:** бег 6 кл/с; прыжок 18,5 кл/с при g = 52 (≈ 3,3 клетки), «койот» 0,07 с, буфер 0,1 с; хитбокс 0,7×1,4.
  Подскок (выдох вниз в воздухе) — `vy = −15`, раз за прыжок. Поток над продухом — до 9 клеток вверх, держит у верха (6,5 кл/с).
- **Выдох:** область до тверди, не дальше 3,5 клетки (по горизонтали — на высоте тела; вниз — под героем). Горн: 3 выдоха;
  крыльчатка — заслонки своего экрана насовсем (`LV.ver++`). Искрокрыл и уголёк гаснут; шестерняк/клёпань/плевун оглушаются
  (1,3/1,6/2,0 с, безвредны) и отбрасываются; шестерняк в опасности или за краем — `drop` (+300).
- **Обитатели** двигаются, только когда герой рядом (16×11 клеток), не покидают свой экран; к 10-му цеху быстрее (+9 %/уровень).
- **Гибель:** −1 жизнь, через 1,3 с — возврат к `cp` (первая опора на экране или разожжённый горн), 2 с неуязвимости.
  Жизни 3, +1 за 30 000 (до 5).
- **Очки:** находки 50/150/300/500, горн 1000, обитатель 200, сдут 300, цех 500 + 10 × (150 − время, с).

`UDALETS.logic`: константы, `build`, `tile`, `isSolid`, `isHaz`, `free`, `roomAt`, `roomBox`, `updraft`, `openShutters`,
`newHero`, `heroStep` (общая физика), `hazardHit`, `gustBox`, `boxHitsCell`, `enemyStep`, `enemyBox`, `shotStep`, `heroTouches`,
`harmful`, `near`, `ACTS` (макро-действия: шаг, прыжок, прыжок с подскоком, подъём на потоке, спуск сквозь поток),
`drive`/`finished`, `isNode`, `nodeOf`, `spotsFor` (откуда выдох достаёт клетку), `Nav(LV)` — граф проходимости.

## js/render.js — `UDALETS.render(g, ctx, S, {toasts, banner, cam, prompt})`, `UDALETS.R`
Обе темы в одном модуле. Статичный слой экрана (фон, кладка, балки; без заслонок) кэшируется по (уровень, экран, тема); горны, крыльчатки, заслонки (с анимацией подъёма),
потоки, находки, обитатели, угольки, выдохи и герой — каждый кадр. HUD 40 px (счёт, уровень, горны, жизни).
`UDALETS.R` — примитивы для титула и финалов (`hero`, `furnace`, `enemy`, `roomLayer`, `camFor`, палитры).

## js/main.js
Сцены движка (`useStandardScreens`), титул перерисован, сцена `card` («цех ожил» → `g.adBreak()` по нажатию, только если
реклама готова), площадка: `leaderboard: 'udalets'`, `g.useLeaderboard`, `g.useNoAds`, `g.useRewardedContinue`,
`g.useRewardedBonus('rwLife')`, `g.persist('arcade.best.udalets')`, `g.onCloud`. Ввод: прыжок Z/J, выдох X/K/Ctrl/F,
тач — стик `js/stick.js` + `#bPuff`, `data-d="A"`, `#bPause`. `UDALETS.app = { g, game() }` — для автотестов.

## tests
`engine.test.mjs` — уровни, физика, правила мехов, проходимость (граф + бот), баланс, языки, страница, площадка, имена;
`bot.mjs` — `playUdalets(U, seed, opts)`: «человеческий» бот на тех же макро-действиях.
