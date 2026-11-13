# ЦЕПЬ — контракт модулей

Игра аркады «Гефест» на фреймворке Гефест Arcade v2.2 (`engine.js`). Общий стандарт: офлайн, `file://`, без внешних
URL/шрифтов/ассетов, RU/EN, темы modern/retro (меняют только отрисовку), WebAudio-звук, рекорд в `localStorage`.
Права: название, сеттинг (башня Остановленных Часов), герой (звонарь-обходчик «Гефеста»), цепь-кистень, орудия, искры и фонари-лампы,
враги, стражи-механизмы, этажи, арт, палитры, звуки и музыка — оригинальные; чужих имён нет (тест «правило имён», стоп-лист в base64).

Порядок подключения: `engine.js` → `js/music.js` → `js/i18n.js` → `js/levels.js` → `js/game.js` → `js/audio.js` → `js/render.js` → `js/main.js`.
Всё лежит в `window.TSEP` (в Node — `globalThis.TSEP`).

## js/levels.js — `TSEP.FLOORS`, `TSEP.ROUTES`, `TSEP.BRANCH`, `TSEP.build(key)`
Этаж: `{ key, boss, bhp, w, h, arena:{x, y}, branch?, final?, open?, paint(P) }`. Карта рисуется кистью `P`: `put fill ground ceil clear girder`,
`st(x, y, n, dir)` — лестница (нижняя точка — угол клетки на полу), `pend(px, py, len, amp, per, ph, from, to)`, `lift(x, y, w, h, per, ph, from, to)`.
Знаки — в шапке файла. Арена — последние 32 колонки (проверяется). `ROUTES.A/B` — по 6 ключей, общие первые 3 и финал `heart`.
`build(key)` → `{ key, W, H, t: Uint8Array (E 0, SOL 1, ONE 2, STR 3, STL 4, SAW 5), lamps[{x,y,k}], foes[{type,x,y}], start, cps[], boss, bossKind, bhp,
doors[{x,y,route}], gate{x,y}, arena{x0,x1,y0,y1}, stairs[{dir,n,bx,by,tx,ty}], mov[{id,kind,…,from,to}], branch, final, open, grid }`.

## js/game.js — `TSEP.Game(opts)` (без DOM, детерминирована при заданном сиде), `TSEP.logic`
`opts`: `{ rng, seed, onEvent(type,data), dmgMul (0 — неуязвимость, ямы губят), start {fi, route, chain, sub, sparks, score}, state (для клона) }`.
Единицы — клетки и секунды, y вниз; тело героя: `x` — центр, `y` — подошвы, 0,6×1,8 (присед 1,15). Вид — 32×16 клеток.

API: `start()` · `update(dt)` (шаг 1/60) · `setInput({dx, up, down, jump, atk, sub})` (держимые; нажатия логика выделяет сама) ·
`continueGame()` · `giveUp()` · `state()` · `clone()` (немая копия партии для упреждающих проверок бота) · `saveData()`.
Тестовые хуки: `_floor(fi, route)`, `_place(x,y)`, `_hurt(d, fromX)`, `_die(why)`, `_sub(k)`, `_chain(n)`, `_startBoss()`, `_bossDamage(n)`, `_spawn(type,x,y)`, `_useSub()`.

`S`: `phase ('play'|'dead'|'clear'|'cont'|'over'|'won'), phaseT, fi, route, key, lv, t (время этажа — по нему ходят опоры), time, hero, hp, lives, conts,
score, sparks, sub, chain, enemies[], nests[], shots[], eshots[], items[], fields[], freeze, wind, boss, bossState ('none'|'intro'|'fight'|'dead'),
gateClosed, cp, lampsOn[], doorsOn, doors[], cam{x,y}, rs (состояние ГСЧ)`.
Герой: `{x, y, vx, vy, face, ground, on (опора), stair {i, p}, atk {t, lvl, up, air, crouch, hit[]}, crouch, kb (отброс), inv, throwT, walkT}`.

События `onEvent`: `level{key,fi}`, `jump`, `land`, `thud`, `stair`, `swing{lvl}`, `hit`, `lamp{k}`, `clank`, `kill{type,pts}`, `pickup{k}`, `chain{lvl}`,
`sub{k}`, `nosparks`, `freeze`, `catch`, `flame`, `hurt{hp,why}`, `die{why}`, `respawn`, `checkpoint`, `life`, `boing`, `lob`, `ready`, `jab`, `dive`, `flutter`,
`bossIntro{k,final}`, `swoop`, `egg`, `crack`, `gearDrop`, `sweep`, `hop`, `stomp`, `breath`, `nut`, `blow`, `leap`, `strike`, `ring`, `dart`, `bossHit`,
`bossDie{k,pts}`, `branch`, `route{route}`, `clear{bonus,fi,route}`, `continueQ{left}`, `continued`, `gameover{score}`, `win{score}`.

Правила (константы — `logic.K`):
- **Физика:** ход 3,4 кл/с; прыжок 13,4 кл/с при g = 36 (≈ 2,5 вверх, ≈ 2,5 вперёд), дуга фиксируется при толчке; сход с края — отвесно;
  удар о стену в полёте гасит ход; балка — только сверху; лестница 2,3 кл/с; опоры — сверху, везут героя.
- **Цепь:** замах `WIND[lvl]`, удар 0,12 с, возврат 0,16 с; точки удара — по линии от кисти (вперёд или под 45° вверх) длиной `REACH[lvl]`,
  урон `DMG[lvl]`; бьёт врагов, стража, фонари и разрушаемые снаряды; одна цель — один раз за взмах.
- **Орудия:** `logic.SUB` — цена и лимит в полёте; пружина — поле `FIELDR` на `FIELD` с (×`SLOW`), стоп-маятник — `FREEZE` с.
- **Урон:** отброс `KBX`×`KBV`, неуязвимость `INV`; на лестнице — без отброса; ниже карты — гибель. Здоровье `HP` = 16.
- **Гибель:** через `DEAD` с — с отметки (у ворот арены — перед воротами), цепь −1 ступень, искр не меньше 5; без жизней — «Продолжить?».
- **Стражи:** `logic.BOSS`; при победе — шестерня хода (подобрать — этаж пройден), на этаже развилки — две двери, в финале — победа.

`TSEP.logic`: `K, SUB, SUBS, FOE, BOSS, mulberry32, tileAt, solid, platAt, sawHit, newHero, heroStep, chainPoints, chainShape, atkTotal, hh, simulate,
standable, nodeOf, pointNode, Nav, rideCtl, staticWorld, encode, decode, ALPH`.
- **Граф** `Nav(lv)`: узлы — «можно стоять» (клетка опоры), рёбра — прогон настоящей физики: `walk`, `drop{d}`, `jump{d, sx}` (принимается, только если
  толчок ±0,08 ведёт туда же, и траектория не задевает пилы и область, которую заметают подвижные опоры), `stair{s, up}`, `ride{m}`.
  `reach(u)`, `path(u, goal)` (Дейкстра), `startNode`.
- **Переправа** `rideCtl(lv, st, S, Wd)` — общий для тестов и бота контроллер: встать у края, прыгнуть/шагнуть на опору, когда прогон физики
  показывает посадку, ехать и сойти/спрыгнуть на целевой уступ, когда прогон показывает успех.
- **Пароль** `encode/decode`: 5 знаков из 32 (этаж, ветка, ступень цепи, орудие, искры/3) + 10 бит контроля.

## js/render.js — `TSEP.render(g, ctx, S, ui)`, `TSEP.R`, `TSEP.fx`
Канва 512×288: вид 32×16 клеток по 16 px + панель 32 px снизу (этаж, шкала здоровья, шкала стража, орудие, искры, ступень цепи, жизни, счёт/рекорд).
Статичный слой карты кэшируется по (этаж, тема). retro — кадр в буфере 256×144. `ui = { toasts[], banner{title,sub,code,a}, msg, shake, contT }`.
`R.heroFig/chainFig/foeFig/bossFig/itemFig/subIcon/gear/spark`, `R.PAL` — палитры этажей, `R.HERO` — палитра героя.

## js/main.js
Сцены движка: title (перерисован: звонарь с цепью, неподвижные шестерни), pause («Этаж заново»), win, gameover; свои — `pwd` (ввод пароля),
`play` (фикс-шаг 1/60, «Продолжить?» 9 с). Пункты меню «Продолжить» (`arcade.save.tsep`) и «Пароль» (`g.menu.addItem`). Музыка — `Arcade.tracks.tsep`
на этажах, `TSEP.MUSIC.boss` у стражей, `TSEP.MUSIC.heart` в финале. Отладка: `TSEP.app = { g, game(), ui, newGame }`.

## tests
`engine.test.mjs` — правила, физика, цепь, орудия, урон, опоры, проходимость (граф + переправы во всех фазах + путь подряд + бот), стражи, развилка,
жизни, сохранение и пароль, музыка, i18n, имена; `bot.mjs` — `playFloor(T, seed, opts)`: «человеческий» бот (реакция 150–250 мс, прозёвывает часть
решений, ошибка места толчка ±0,04; бой — перебор простых действий с проверкой на клоне партии), `navFor`, `route`, `makeExec`, `stepExec`.
