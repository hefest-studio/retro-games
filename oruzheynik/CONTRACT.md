# ОРУЖЕЙНИК — контракт модулей

Игра аркады «Гефест» на фреймворке Гефест Arcade v2.2 (`engine.js`). Общий стандарт:
офлайн, `file://`, без внешних URL/шрифтов/ассетов, RU/EN, темы modern/retro (меняют только отрисовку),
WebAudio-звук, рекорд в `localStorage` (`arcade.best.oruzheynik`).
Права: название, герой (юный оружейник), Мастера, враги, цеха, оружие, крепость, арт, палитры, звуки и музыка —
оригинальные; чужих имён и терминов нет (тест «Правило имён», стоп-лист в base64).

Порядок подключения: `engine.js` → `js/music.js` → `js/i18n.js` → `js/levels.js` → `js/save.js` → `js/game.js` →
`js/audio.js` → `js/render.js` → `js/main.js`. Всё лежит в `window.ORUZH` (в Node — `globalThis.ORUZH`).

## js/levels.js — `ORUZH.STAGES[11]`, `ORUZH.level(i)`, `ORUZH.buildLevel(i)`, `ORUZH.levelTiles`
Этап: `{ key, boss, mini?, theme (0..9 — палитра), bpm, fort? (1..3), r }`. 0..7 — цеха (порядок = `logic.BOSSES`),
8..10 — ярусы крепости (`boss: 'rematch'` у третьего). `r` — рецепт: строка токенов, каждый — участок карты высотой 14 клеток:
`S` старт (5 клеток пола) · `fN` ровный пол · `uN`/`dN` ступень вверх/вниз (пол — ряды 7..12) · `pN` пропасть ·
`sN` шипы · `tN` тоннель высотой 1 клетка (только подкатом) · `wN` приподнятый пол на 2 · `o7`/`q7` площадка 3 клетки
над пропастью/шипами · `bN` цепочка из N мигающих плит (по 2 клетки, просветы по 2, группы 0..2) ·
`e:type[:dx[:dy]]` враг (crawler, hopper, flyer, turret) · `i:k[:dx[:dy]]` предмет (hp8, tank) · `c` отметка ·
`M:type` комната мини-босса (16 клеток, вход и запертые ворота 3 клетки) · `X` подход к арене + арена 24 клетки.
Неизвестный токен — ошибка с именем этапа. Результат `level(i)`: `{ W, R, t: Uint8Array (E 0, SOL 1, SPK 2, BLK 3, GATE 5),
grp (группа мигающей плиты), spawns, items, cps, start, mini{type,x0,x1,g}, arena{x0,x1}, blinks[{c0,cEnd,g,stones}] }`.

## js/game.js — `ORUZH.Game(opts)` (без DOM, детерминирована при заданном rng), `ORUZH.logic`
`opts`: `{ rng, onEvent(type,data), store ({get,set} — строка JSON; обычно `ORUZH.save.store(localStorage)`), dmgMul (тесты) }`.
Единицы — клетки (24 px) и секунды, y вниз; тело: `x` — центр, `y` — подошвы. Вид — 26×14 клеток.

API: `start()` → api · `update(dt)` (шаг 1/60) · `setInput({dx,down,jump,fire,slide})` (держимые; нажатия логика выделяет сама) ·
`canPick(i)` / `pick(i)` (0..7 — цех, 8 — крепость, открыта при 8 трофеях; ярус = `prog.fort`) · `owned(w)` ·
`selectWeapon(w)` / `cycleWeapon(±1)` · `useTank()` · `continueAfterGot()` · `newRun()` · `resetProgress()` ·
`password()` / `applyPassword(code)` · `state()` → S. Тестовые хуки: `_place(x,y)`, `_startBoss()`, `_hitBoss(k,lv)`,
`_beatAll()`, `_kill(why)`, `_hurt`, `_spawn`, `_fire(lv)`, `_bossDamage(boss,k,lv)`.

`S.phase`: `select` → `stage` (`dead` на 1,8 с) → `got` (трофей, 4,5 с) → `select`; в крепости `clear` → следующий ярус;
`won` / `over`. Прочее: `score, lives, prog{v,beaten[8],tanks,fort,tankGot}, stage, lv, W, hero, shots, eshots, enemies, items,
puddles, boss, bossState('none'|'intro'|'fight'|'dead'), queue, rush{i,walker}, mini, miniState, cam{x}, lock, cp, wsel, energy[9]`.

События: `select`, `stage{idx,key}`, `respawn`, `jump`, `land`, `slide`, `shot{k,lv}`, `charge{lv}`, `noEnergy`, `weapon{w}`,
`hit`, `kill{x,y,type,pts,mini}`, `hurt{x,y,d,why}`, `die{x,y,why}`, `pickup{k,x,y}`, `tank`, `checkpoint`, `miniIntro{type}`,
`gateOpen`, `bossIntro{key,rematch?,finale?,phase2?}`, `bossHit{x,y,weak,d}`, `bossDie{x,y,key,pts}`, `got{w,fresh}`,
`clear{fort}`, `win{score}`, `gameover{score}`; звуковые: `eshot, hop, dive, dash, stomp, gust, sizzle, tink, clang, dong, pour, crash`.

Правила:
- **Физика:** бег 5,2 кл/с; прыжок 16,5 кл/с при g = 42 (≈ 3,2 клетки вверх, пропасть до 3 клеток с разбега), отпускание
  срезает взлёт до 5 кл/с; «койот» 0,07 с, буфер прыжка 0,1 с. Хитбокс 0,7×1,5; в подкате 0,75 высоты, 8,5 кл/с, 0,42 с
  (не встаёт под низким потолком). Шипы и падение в пропасть — гибель; удар врага — отброс 0,3 с и 1,3 с неуязвимости.
- **Мигающие плиты:** такт 3 с, горят 2 с, группы сдвинуты на 1 с; за 0,45 с до исчезновения мерцают.
- **Оружие** (`logic.WEAP`, 0 — наруч, 1..8 — трофеи в порядке `BOSSES`): стоимость/лимит в полёте — boomer 1/1, gear 3/1,
  mine 2/1, fan 2/3, frost 2/2, harpoon 2/1, chain ⅓/6 (очередь при удержании), smoke 3/1 (только с земли). Заряд 28 на
  оружие, полный при входе на этап. Наруч: болт 1 урон (до 3 в полёте); удержание 0,55 с — 2 урона, 1,25 с — 3 урона и пробивает.
- **Слабости** (`logic.WEAK`): hammer→smoke, gear→fan, magnet→chain, fan→boomer, frost→mine, spring→gear, volt→harpoon,
  bell→frost — биекция и один круг из 8; крепость: ladle→chain, crane→boomer, walker→smoke, core→fan.
  Урон по Мастеру: слабость 4 (+оглушение 0,5 с), наруч 1/2/3, прочее 1. Здоровье Мастера 28, в повторных боях 14.
- **Крепость:** ярус 3 — 8 повторных боёв по порядку `BOSSES` (пройденные в заходе — `S.rush.i` — после гибели не повторяются),
  затем Шагающая Домна и Сердце Домны; победа над Сердцем — `won`, `prog.fort = 3`.
- **Жизни:** 3; гибель — с последней отметки (после мини-босса — за его воротами); 0 жизней — `over` (прогресс сохранён).

## js/save.js — `ORUZH.save`
`KEY = 'arcade.save.oruzheynik'`, формат v1 `{ v:1, beaten[8], tanks 0..4, fort 0..3, tankGot{} }`.
`migrate(o)` — любая версия → v1 (v0 — черновой формат без `v` и с 4 ярусами крепости; ярусы без 8 трофеев сбрасываются;
будущая версия → null). `store(localStorage)` — `{get,set}`, при чтении старой версии сразу переписывает ключ.
`encode(prog)` → 6 цифр 1..8 (8 бит побед + 3 бита фляг + 2 бита ярусов + 5 бит контрольной суммы, перемешано), `decode(code)` → prog | null.

## js/render.js — `ORUZH.render(g, ctx, S, ui, game)`, `ORUZH.R`, `ORUZH.renderFx`
Канва 624×360: HUD 24 px сверху (здоровье, оружие и заряд, жизни, фляги, счёт, полоса Мастера) + вид 26×14 клеток.
`ui = { toasts[{text,color,x,y,t,big}], banner{title,sub,a}, msg{text,color,a}, shake, sel, selMsg }`.
Экраны: выбор цеха (2 ряда по 4 карточки + крепость справа, пароль внизу), трофей, этап. retro — кадр в буфере 312×180.

## js/main.js
Сцены движка title (перерисован; пункты «Ввести пароль», «Сбросить прогресс» — с подтверждением), pause, win, gameover
(с паролем), своя `pass` (ввод пароля: ←→ позиция, ↑↓ или цифры 1–8, Enter). Сцена `play` ведёт выбор цеха, этап,
трофей; музыка цеха — `Arcade.tracks.oruzheynik`, на арене — `ORUZH.MUSIC.boss`. Отладка: `ORUZH.app = { g, game(), ui }`.

## tests/bot.mjs — `playStage(OZ, seed, opts)`, `navFor(OZ, idx)`
«Человеческий» бот: решения раз в 150–250 мс, видит только кадр, не замечает часть врагов (`miss`), уворачивается
с вероятностью `dodge`, стреляет тапами, заряд — иногда; путь — по рёбрам графа проходимости (`logic.Nav`), исполняя те же
макросы, по которым граф построен. `opts: { stage, react, miss, dodge, chargeP, dmgMul, maxT, prep }` →
`{ cleared, over, deaths, why, stuck, bossT, miniT, t, score }`.
