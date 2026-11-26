# ОТБОЙ (oruzheynik) — контракт модулей

Игра аркады «Гефест» на фреймворке Гефест Arcade v2.10 (`engine.js`). Общий стандарт:
офлайн, `file://`, без внешних URL/шрифтов/ассетов, RU/EN/TR/ES/PT, темы modern/retro (меняют только отрисовку),
WebAudio-звук, рекорд в `localStorage` (`arcade.best.oruzheynik`).
Права: название, герой (подмастерье с молотом), Мастера, враги, цеха, арт, палитры, звуки и музыка —
оригинальные; чужих имён и терминов нет (тест «Правило имён», стоп-лист в base64).

Порядок подключения: `engine.js` → `js/music.js` → `js/i18n.js` → `js/levels.js` → `js/game.js` → `js/audio.js` → `js/render.js` →
`js/stick.js` → `js/save.js` → `js/main.js`. Всё лежит в `window.ORUZH` (в Node — `globalThis.ORUZH`).

## js/levels.js — `ORUZH.STAGES[7]`, `ORUZH.level(i)`, `ORUZH.buildLevel(i)`, `ORUZH.levelTiles`
Этап: `{ key, boss, mini?, theme (0..9 — палитра), bpm, final?, r }`. 0..5 — цеха (порядок = `logic.BOSSES`), 6 — Чёрная Домна
(`boss: 'walker'`, затем Сердце `core`). `r` — рецепт: строка токенов, каждый — участок карты высотой 14 клеток:
`S` старт (5 клеток пола) · `fN` ровный пол · `uN`/`dN` ступень вверх/вниз (пол — ряды 7..12) · `pN` пропасть ·
`sN` шипы · `tN` тоннель высотой 1 клетка (только кувырком) · `wN` приподнятый пол на 2 · `o7`/`q7` площадка 3 клетки
над пропастью/шипами · `bN` цепочка из N мигающих плит (по 2 клетки, просветы по 2, группы 0..2) ·
`e:type[:dx[:dy]]` враг (crawler, hopper, flyer, turret) · `i:k[:dx[:dy]]` предмет (hp8) · `c` отметка ·
`M:type` комната мини-босса (16 клеток, вход и запертые ворота 3 клетки) · `X` подход к арене + арена 24 клетки.
Неизвестный токен — ошибка с именем этапа. Результат `level(i)`: `{ W, R, t: Uint8Array (E 0, SOL 1, SPK 2, BLK 3, GATE 5),
grp, spawns, items, cps, start, mini{type,x0,x1,g}, arena{x0,x1}, blinks[{c0,cEnd,g,stones}], final }`.

## js/game.js — `ORUZH.Game(opts)` (без DOM, детерминирована при заданном rng), `ORUZH.logic`
`opts`: `{ rng, onEvent(type,data), dmgMul (тесты), start: { si, score } (с какого этапа), tutorial (подсказки цеха 1; по умолчанию да) }`.
Единицы — клетки (24 px) и секунды, y вниз; тело: `x` — центр, `y` — подошвы. Вид — 26×14 клеток.

API: `start()` → api · `update(dt)` (шаг 1/60) · `setInput({dx,down,jump,hit,slide})` (держимые; нажатия логика выделяет сама) ·
`state()` → S · `saveData()` → `{si,score}` · `reviveAd()` / `canBoost()` / `boost()` (площадка). Тестовые хуки: `_place(x,y)`,
`_startBoss()`, `_hitBoss(dmg)`, `_kill(why)`, `_hurt`, `_spawn`, `_swing`, `_eshot`, `_bossDamage(boss,k,dmg)`.

`S.phase`: `stage` → (`dead` на 1,8 с → `stage`) → `clear` (3,2 с, потом следующий этап) → … ; `won` / `over`. Прочее: `score, lives, stage, lv, W,
hero{hp,heat,swingT,hot,...}, shots (отбитые), eshots, enemies, items, puddles, boss, bossState('none'|'intro'|'fight'|'dead'), mini, miniState,
cam{x}, lock, cp, reflects, clearBonus, hints`.

События: `stage{idx,key}`, `respawn`, `jump`, `land`, `slide`, `swing{hot}`, `thump{x,y}`, `reflect{x,y,hot,heat}`, `hit`, `kill{x,y,type,pts,mini}`,
`hurt{x,y,d,why}`, `die{x,y,why}`, `pickup{k,x,y}`, `checkpoint`, `miniIntro{type}`, `gateOpen`, `bossIntro{key,phase2?}`,
`bossHit{x,y,ref,d}`, `bossDie{x,y,key,pts}`, `clear{si,bonus}`, `win{score}`, `gameover{score}`, `revived`, `boost`, `hint{k}`;
звуковые: `eshot, hop, dive, dash, stomp, gust, sizzle, tink, clang, dong, pour, crash`.

Правила:
- **Физика:** бег 5,2 кл/с; прыжок 16,5 кл/с при g = 42 (≈ 3,2 клетки вверх, пропасть до 3 клеток с разбега), отпускание
  срезает взлёт до 5 кл/с; «койот» 0,07 с, буфер прыжка 0,1 с. Хитбокс 0,7×1,5; в кувырке 0,75 высоты, 8,5 кл/с, 0,42 с
  (не встаёт под низким потолком). Шипы и падение в пропасть — гибель. Удар врага — неуязвимость 1,3 с, сброс жара; на земле —
  отброс 0,3 с (не к шипам и пропасти), в воздухе — без потери управления.
- **Молот:** замах 0,42 с (`SW_TOT`), активное окно 0,05–0,25 с, охват вперёд 2,1 (`REACH`; раскалённый 3,0), по высоте 2,4 над ногами.
  Враги: 2 (раскалённый 4). Мастер: 1 (3). Снаряды (`eshots`, кроме `NOREF = wave, crate`) отбиваются в `shots` (`k:'ref'`): скорость ×1,5
  (не меньше 13), цель — Мастер в бою / ближайший враг впереди / вперёд, доворот к цели; урон врагу 4 (6), Мастеру 4 (6); отбой даёт 0,3 с
  неуязвимости и +1 жара (до 3); `hero.hot` — удар раскалённым (жар сгорает).
- **Мастера** (`BOSS_HP` 27, финал `FINAL_HP` 28): отбитый снаряд оглушает на 0,45 с; неуязвимость после попадания 0,5 с (удар — 0,3 с). Каждый
  стреляет отбиваемыми снарядами (тест). Шагающая Домна держит дистанцию 6–8,5.
- **Жизни:** 3; гибель — с последней отметки (после мини-босса — за его воротами); 0 жизней — `over`; площадка — `reviveAd()`.

## js/save.js — `ORUZH.save`
`KEY = 'arcade.save.oruzheynik'`, формат v3 `{ v:3, si 0..6, score }` (`parse` → объект | null, `serialize`).
`migrate(io)` — `io = { get, set, del }`: если нет маркера `arcade.oruzheynik.v = '3'`, стирает старое сохранение, прежний рекорд сохраняет
в `arcade.oruzheynik.oldBest` и ставит `arcade.oruzheynik.notice = '1'`; возвращает `{ migrated, oldBest, notice }`.

## js/render.js — `ORUZH.render(g, ctx, S, ui)`, `ORUZH.R`, `ORUZH.renderFx`
Канва 624×360: HUD 24 px сверху (здоровье, жар, жизни, счёт, полоса Мастера/мини-босса/название цеха) + вид 26×14 клеток.
`ui = { toasts[{text,color,x,y,t,big}], banner{title,sub,a}, msg{text,color,a}, shake }`. retro — кадр в буфере 312×180.
`R.heroFig(c, x, y, face, pose{run,air,slide,el,hot,heat}, K, retro, t)` — герой с молотом (замах по `el` — секундам от начала замаха).

## js/main.js
Сцены движка title (перерисован: демонстрация отбоя), pause (+«Цех заново»), win, gameover; своя `card` («Цех отвоёван» перед межстраничной, только
если площадка её показывает) и `play`. Пункт меню «Продолжить» — с сохранения. Площадка: `useLeaderboard`, `useNoAds`, `useRewardedContinue`,
`useRewardedBonus`, `g.persist`. Музыка цеха — `Arcade.tracks.oruzheynik`, на арене — `ORUZH.MUSIC.boss`. Отладка: `ORUZH.app = { g, game(), ui, newGame, mig }`.

## tests/bot.mjs — `playGame(OZ, seed, opts)`, `playStage(OZ, seed, opts)`, `navFor(OZ, idx)`
«Человеческий» бот: решения раз в 150–250 мс, видит только кадр, не замечает часть врагов (`miss`), отбивает долю снарядов (`parry`),
уворачивается с вероятностью `dodge`; путь — по рёбрам графа проходимости (`logic.Nav`), исполняя те же макросы, по которым граф построен.
`opts: { from, single, react, miss, dodge, parry, dmgMul, maxT }` → `{ won, over, cleared, deaths, why, stuck, stages[], reflects, t, score }`.
