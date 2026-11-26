# КИСТЕНЬ (папка dospeh) — контракт модулей

Игра аркады «Гефест» на фреймворке Гефест Arcade v2.10 (`engine.js`). Общий стандарт:
офлайн, `file://`, без внешних URL/шрифтов/ассетов, RU/EN, темы modern/retro (меняют только отрисовку),
WebAudio-звук, рекорд в `localStorage` (`arcade.best.dospeh`, пишет движок).
Права: название, герой (кочегар), Ржавый Кощей (свой, механический), враги, стражи, места, оружие, арт, палитры, звуки
и музыка — оригинальные; чужих имён и терминов нет (тест «Правило имён», стоп-лист в base64).

Порядок подключения: `engine.js` → `js/music.js` → `js/i18n.js` → `js/levels.js` → `js/game.js` → `js/audio.js` →
`js/render.js` → `js/main.js`. Всё лежит в `window.DOSPEH` (в Node — `globalThis.DOSPEH`).

## js/levels.js — `DOSPEH.LEVELS[7]`, `DOSPEH.build(i)`, `DOSPEH.TILES`
Уровень: `{ key, liquid ('rust'|'lava'|null), rise (интервал окалышей, с), boss, bhp, final?, r }`. `r` — рецепт из токенов
(описание — в шапке файла): `S fN uN dN pN tH o:H:N LH mN vH c k[:что] e:тип[:dx[:dy]] B:страж`. Неизвестный токен,
пропасть шире 3, ступень выше 2, плот над пропастью короче 7, земля вне рядов 5..13 — ошибка с именем уровня.
`build(i)` → `{ idx, key, def, W, R=16, t: Uint8Array (E 0, SOL 1, ONE 2, LAD 3), plats[{kind 'h'|'v', x0,x1,y0,y1,w,sp,dwell}],
spawns[{type,x,y}], chests[{x,y,c}], cps[{x,y}], start{x,y}, arena{x0,x1,y,boss}, pits[] (столбцы жижи, откуда прыгают бульки;
под плотами/подъёмниками — тихо), liquid, rise, final }`.

## js/game.js — `DOSPEH.Game(opts)` (без DOM, детерминирована при заданном rng), `DOSPEH.logic`
`opts`: `{ rng, onEvent(type,data), dmgMul (0 — неуязвимость для тестов) }`. Единицы — клетки (16 px) и секунды, y вниз;
тело: `x` — центр, `y` — подошвы. Вид — 32×16 клеток.

API: `start()` → api · `update(dt)` (шаг 1/60) · `setInput({dx,up,down,jump,fire})` (держимые; нажатия логика выделяет сама) ·
`continueGame()` · `giveUp()` · `skipLoopEnd()` · `state()` → S. Тестовые хуки: `_level(i, loop)`, `_place(x,y)`, `_hurt(why,fromX)`,
`_die`, `_weapon`, `_throw(special)` (цепь / вихрь), `_spawn(type,x,y,extra)`, `_startBoss`, `_bossDamage(dmg,k)`, `_openChest`, `_pickup`, `_beginLoop2`, `_score`.

`S.phase`: `play` → `dead` (1,8 с) → `play`/`cont`/`over`; `clear` (3,2 с) → следующий уровень; финал: круг 1 — `loopEnd` (7 с или
`skipLoopEnd`) → круг 2 с уровня 1; круг 2 — `won`. Прочее: `loop, li, lv, t (время уровня — по нему ходят плоты), time, timer, lives,
conts, score, hero, weapon, chain, eshots, enemies, items, chests, flames, ring, boss, bossState ('none'|'intro'|'fight'|'dead'),
cam{x}, cp, warn[] (пузыри перед бульком)`.

События: `level{idx,key,loop}`, `respawn`, `jump`, `land`, `throw{w}`, `special{w}`, `charged`, `hit`, `kill{type}`, `knock`, `chest{c}`,
`trap`, `heatDown{why,heat}`, `hint{k}`, `die{why}`, `pickup{k}`, `weapon{w}`, `life`, `checkpoint`, `rise`, `bubble`, `splash`, `kiteWarn`, `dive`,
`spit`, `hop`, `stomp`, `dash`, `cast`, `clink`, `block`, `flame`, `clank`, `bossIntro{key,final,loop}`, `bossHit`, `bossDie{key,pts}`,
`clear{bonus|final,loop}`, `loopEnd`, `loop2`, `continueQ{left}`, `continued`, `win{score}`, `gameover{score}`.

Правила:
- **Физика:** ход 4,2 кл/с; прыжок 14 кл/с при g = 38 (≈ 2,5 вверх, ≈ 3,1 вперёд), дуга фиксируется при толчке; сход с края —
  отвесно; удар о стену в полёте гасит ход; лестница 3,2 кл/с, верхняя клетка лестницы держит сверху; мостки — только сверху;
  плоты/подъёмники — опора сверху, везут героя. Хитбокс 0,64×1,7, присед 1,1.
- **Жар:** `hero.heat` 1…`HEAT_MAX` (4). Удар: `heat > 1` → `heat--`, отброс 0,45 с, неуязвимость 1,6 с; при `heat === 1` — гибель. Пропасть, жижа, таймер — гибель всегда. После гибели и на новом уровне — жар ≥ 3.
  Угли (`ember`) +1 (при 4 — 500 очков), горн (`horn`) → 4.
- **Цепь** (`logic.WEAP`: ball 8,5/1, spike 6/2, coal 8/1 — предел длины/урон; `CHN`: выход 26 кл/с, возврат 34, минимум 2,2, висит на пределе ≤ 0,7 с): `S.chain = {w,dx,dy,len,st:'out'|'hold'|'back',x,y,hit[]}`; одна цепь за раз,
  направление фиксируется при запуске (вперёд / ↑ / ↑ + ход). Бьёт точками вдоль цепи (r 0,4, голова 0,6) на выходе и (список попаданий сбрасывается) на возврате; гасит `eshots`; стена → возврат; уголь оставляет огонь под врагом.
  Вихрь — `S.ring` (2,6 с, два шара на радиусе 2,2): при `heat === HEAT_MAX`, удержание ≥ `CHARGE` и отпускание; `heat--`.
- **Круг 2:** первый тигель каждого уровня — `horn`; враги ×1,15 по скорости, окалыши ×1,3 чаще и до 4 одновременно, стражи ×1,25 здоровья; Кощея бьёт любая голова. Окалыш — капля шлака сверху (0,9 с безвреден).
- **Жизни** 3, +1 за 20 000 и каждые 30 000; продолжений 3 (жизни 3, счёт 0, с начала уровня).

Граф проходимости: `logic.Nav(lv)` → `{ set, edges, nodeAt, reach, field }` — узлы «можно стоять», рёбра: шаг, прыжок
(`{jump,d,sx}` — с точки `sx`, принимается, только если промах ±0,08 ведёт туда же), сход с края (`drop`), лестница (`climb`),
переправа (`ride` — `logic.rideCtl(lv, i, st, hero, t, react)`, общий для бота и тестов). `logic.simulate`, `logic.heroStep`,
`logic.world(lv,t,dt)`, `logic.platPhase(p,t)`.

## js/render.js — `DOSPEH.render(g, ctx, S, ui)`, `DOSPEH.R`, `DOSPEH.fx`
Канва 512×288: HUD 32 px (жар с колосниками, голова цепи, счёт/рекорд, место и круг, таймер, жизни/продолжения) + вид 32×16 клеток по 16 px.
`ui = { toasts[{text,color,x,y,t,big}], banner{title,sub,a}, msg{text,color,a}, shake, contT }`. Экраны поверх: «Продолжить?»,
«Наковальня-Сердце холодна» (конец круга 1). retro — кадр в буфере 256×144. `R.heroFig/weaponFig/foeFig/bossFig/chestFig/itemFig` —
фигуры, `R.PAL` — палитры уровней.

## js/main.js
Сцены движка title (перерисован), pause, win, gameover (с фигурой кочегара). Сцена `play`: уровни, «Продолжить?» (9 с, пробел —
да, Esc — нет), конец первого круга. Музыка — `Arcade.tracks.dospeh` на уровнях, `DOSPEH.MUSIC.boss` на арене. Отладка: `DOSPEH.app = { g, game(), ui }`.

## tests/bot.mjs — `playLevel(D, seed, opts)`, `navFor(D, idx)`
«Человеческий» бот: решения раз в 150–250 мс, часть врагов и снарядов замечает с опозданием, ошибка места толчка до ±0,04;
путь — по рёбрам графа, теми же приёмами; уворачивается, проверяя простые действия (стоять, шаг, присед, прыжок) той же физикой.
`opts: { level, loop, lives, react, miss, dodge, chargeP, dmgMul, noFoes, maxT, prep }` → `{ cleared, over, deaths, why, armorLost, stuck, bossT, t, score }`.


## Площадка (v2.10) и тач
`main.js`: `createGame({leaderboard:'dospeh'})`, `g.persist('arcade.best.dospeh','max')`, `useLeaderboard`, `useNoAds`, `onCloud`, `useRewardedContinue({revive})` → `game.reviveAd()` (с отметки, 1 жизнь, жар 3), `useRewardedBonus({key:'rwHeal'})` → `canBoost()/boost()` (жар 4, раз за партию), сцена `card` + `g.adBreak()` между уровнями, `menuFit`, стик `js/stick.js`. Подсказки — `Game({tutorial})`, событие `hint{k}`.
