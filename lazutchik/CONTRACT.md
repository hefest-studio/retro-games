# ЛАЗУТЧИК — контракт модулей

Игра аркады «Гефест» на фреймворке Гефест Arcade v2.2 (`engine.js`). Общий стандарт: офлайн, `file://`, без внешних
URL/шрифтов/ассетов, RU/EN, темы modern/retro (меняют только отрисовку), WebAudio-звук, рекорд в `localStorage`.
Права: название, сеттинг (Ржавый Арсенал), герой (сторож Филин), стража, пёс-автомат, матрица-печать, будильник, карта
комплекса, арт, палитры, звуки и музыка — оригинальные; чужих имён нет (тест «правило имён», стоп-лист в base64).

Порядок подключения: `engine.js` → `js/music.js` → `js/i18n.js` → `js/map.js` → `js/game.js` → `js/audio.js` → `js/render.js` → `js/main.js`.
Всё, кроме `main.js` и `engine.js`, работает без DOM (тесты гоняют модули в `node:vm`).

## js/map.js — `LZ.MAP`
Константы: `T=32` (px клетки), `SW=20, SH=10` (клеток в экране), `CX=12, CY=6` (экранов), `W=240, H=60` (клеток карты),
`C = { E, S, L, H, D, G, V, O }` — пусто, твердь, лестница, люк, цветная дверь, створка тревоги, площадка лифта, решётка.
`ROWS` — сетка экранов (буква зоны или `.`), `ZONES`, `DARK`, `count()` → 62, `has(X,Y)`, `zoneOf(X,Y)`.
`build(diff)` → карта (детерминированно; геометрия одинакова на всех сложностях, меняется только стража):
`{ T, SW, SH, CX, CY, W, H, t:Uint8Array, C, diff, screens[CY*CX]:{X,Y,zone,dark,idx}|null,
doors[{tx,r0,r1,color,X,Y}], grates[…], shutters[…], ladders[{tx,r0,r1}], lifts[{id,tx,x,stops:[ряд пола]}],
hatches[{tx,ty}], cats[{X,Y,a,b,lc,ty}], covers[{tx,ty,w,h,kind,X,Y}], shadows[{x0,x1,y}], lamps[{x,y,fy,X,Y,dark}],
pools[{x0,x1,y}], items[{k,x,y,color?}], guards[{k,x,y,p0,p1,b0,b1,sleep,face,X,Y,id}], cart{y,a,b},
start{x,y}, exit{x1,y,X,Y}, plant{x,y} }`.
Пол экрана — ряд 9, потолок — ряд 0, мостки — ряд 5. Стены между экранами — колонка 0 правого экрана (проём 3 клетки:
дверь/решётка/створка). Лестница `[X,Y,c]` — от пола (X,Y) до пола (X,Y+1). Люк — клетка `H` в полу и проём в потолке ниже.

## js/game.js — `LZ.logic`, `LZ.Game(opts)`
`LZ.logic`: `K` (константы героя: скорости WALK 86 / RUN 170 / SNEAK 46 / CLIMB 100 px/с, HP 10, EN 100, радиусы шума…),
`ATK` (punch/kick/sweep/grab/toss), `KINDS` (boxer/heavy/thrower/dog), `ITEMS` (wrench/brick/crowbar/washer), `DIFF[5]`
(`{timer, lives, dmg, see, susp, spd, hp, block, cd, wind, stun, alarm}`), `World(map)`, `worldStep(Wd,dt)`, `newHero(x,y)`,
`heroStep(Wd,P,I,dt,cb)` (`I = {dx,dy,run,upP,downP}`), `supported`, `canSee(S,e,P)`, `isLit(map,P)`, `inShadow`, `hidden`,
`sightRange(S,e,P)`, `scrOf(x,y)`, `screenAt(map,x,y)`, `eyeY(e)`, `mulberry32`.
`World`: `solid(x,y)`, `support(x,y)` (стоять сверху: твердь, закрытые двери/люки/решётки, створки при тревоге, верх
лестницы или площадка на лестнице), `landing`, `tile`, `open:Uint8Array` (двери/решётки — навсегда, люки — на 1,4 с),
`shut` (створки), `keys` (карты), `cart{x,to,carry}`, `lifts[{y}]`.

`LZ.Game(opts)`: `{ diff=1..5, rng, onEvent(type,data), god }` →
`start()` · `update(dt)` (шаг 1/60) · `setInput(dx, dy, run)` · `press('punch'|'kick'|'item'|'flash')` · `state()`.
Тестовые хуки: `_place(x,y,face)`, `_give('red'|'blue'|'yellow'|'matrix')`, `_plant()`.
Состояние `S`: `{ diff, D, map, wd, hero, enemies, items, proj, phase:'in'|'out'|'won'|'lost', time, bombT, alarmT, cards,
matrix, planted, lives, score, kos, takedowns, alarms, deaths, seen, over, won, lose:'caught'|'ring'|null, cp }`.
Герой: `{x,y,vx,vy,face,ground,crouch,climb,ride,atk,hurtT,inv,hp,en,held,running,flash,dead}`.
Страж: `{k,x,y,face,hp,st:'patrol'|'look'|'chase'|'sleep'|'out',susp,seenT,lx,atk,cd,stun,down,out,p0,p1,b0,b1}`.

Правила: зрение — тот же экран, спереди, дальность `K.SIGHT×D.see` (пёс ×0,55; в темноте без фонарика ×0,42; присед ×0,8;
тревога ×1,2), вертикальный раствор ±(20 + 0,32·dx), линия видимости по клеткам; присевший в тени укрытия невидим
(кроме того, кого только что видели в погоне). Подозрение копится `(0,35 + 1,1·d/дальность)/D.susp` с до тревоги.
Шум — `noise(x,y,r)`: стражи этого и соседних по горизонтали экранов в радиусе (пёс ×1,5) идут проверить, спящие просыпаются.
Тревога `D.alarm` с, продлевается, пока погоня видит героя; створки закрыты только в фазе `in`.
Удар сзади по неосведомлённому/спящему/лежащему — нокаут; блок вахтёра (рука, нога вдвое реже), пёс — рука стоя мимо,
кочегар — рука вполсилы, без оглушения, бросок нельзя. Попадание оглушает на `D.stun` с; страж контратакует быстро.
Будильник: у `plant` держать ↑ `K.PLANT` с при наличии матрицы → `bombT = D.timer`; выход — экран водостока левее `exit.x1`.

События `onEvent`: `screen, noise, step, climb, land, hatch, lift, liftStop, liftEnd, cart, cartCall, cartStop, door, locked,
grate, grateLocked, shutter, atk, swing, hit, block, whiff, tooHeavy, duck, ko, hurt, die, respawn, spot, hear, wake, alarm,
calm, eswing, nutThrow, nutHit, pick, toss, clang, thermos, card, matrix, needMatrix, planted, tick, flash, tired, noItem, win, gameover`.

## js/render.js — `LZ.render(g, ctx, S, ui)`, `LZ.R`
Кадр 640×360: панель 40 px + экран 640×320. `ui = { banner, tip, shake }`. Статика экрана кэшируется по (экран, тема).
`LZ.R`: `hero(ctx,x,y,{face,state,t,rt,held,flash,clock,alpha,scale})`, `guard(ctx,e,t,rt)`, `coneDraw`, `cover`, `clockIcon`,
`throwable`, `FX{add,ring,pop,step,clear}`, `text`, `rect`, `heroState`, `clearCache`.

## js/main.js
Сцены: `title` (пункт «Сложность», ← → на титуле), `brief`, `play`, `pause` (+ «Заново»), `win`/`gameover` (перерисованы).
Хранилище: `lazutchik.diff`, `lazutchik.time.d<N>` (лучшее время, с), `arcade.best.lazutchik` (счёт, движок).
Отладка: `LZ.app = { g, game(), setDiff(n) }`.

## tests/bot.mjs
`navFor(LZ,map)` — граф по физике, `stateGraph(nav,{noHatch})`, `forward`, `canWinSet`, `fastest`, `BIT`,
`playLaz(LZ, seed, {diff, react:[0.15,0.25], miss, maxT, nav, distCache})` → `{won, time, phase, deaths, kos, alarms, lose, …}`.
