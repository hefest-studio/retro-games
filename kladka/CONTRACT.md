# КЛАДКА — контракт модулей

Игра аркады «Гефест» на фреймворке Гефест Arcade v2 (`engine.js`). Общий стандарт:
офлайн, `file://`, без внешних URL/шрифтов/ассетов, RU/EN, темы modern/retro (меняют
только отрисовку), WebAudio-звук, рекорд в `localStorage` (`arcade.best.kladka`).
Права: название, правила-формулировки, уровни, арт, палитры, звуки и музыка — оригинальные; чужих имён нет.

## js/game.js — `KLADKA.Game(opts)` (без DOM, детерминирована при заданном `rng`)
`opts`: `{ rng, level=1, lives=3, maxLevel=10, difficulty(level,base,step,max), onEvent(type,data) }`.

Поле 480×640: стены `FX0=16`/`FX1=464`, потолок `FY0=52`, кладка 14×N клеток 32×16 от `BY0=84`,
мастерок — верх на `PADDLE_Y=596`, высота 12, ширина 72 (РАЗМАХ 108, ТЕСНОТА 46); ядро — радиус 5.

API: `start()` → api · `update(dt)` · `setDir(dx)` (клавиши −1/0/1; ≠0 сбрасывает цель указателя) ·
`setTarget(x|null)` (мышь/палец; мастерок едет к x до 1700 px/с) · `setFire(bool)` (удержание — автоогонь резака) ·
`action()` (пуск прилипших ядер, иначе выстрел резака) · `state()` → S.

`S`: `level, maxLevel, lives, score, phase('play'|'dead'|'clear'|'over'), phaseT, time, over, won,
paddle{x,w,stun,hitT}, balls[{x,y,vx,vy,stuck,off,stuckT,serve}], bricks[{c,r,x,y,w,h,hp,max,iron,gift,tone,flash,dead}],
grid[r*14+c], left, caps[{x,y,kind,t}], bolts[{x,y}], sparks[{x,y,vx,vy}],
boss{x,y,w,h,hp,max,vx,fireT,mouth,flash,hitCd,aim}|null, pow{wide,narrow,glue,cutter,chill} (секунды),
speed, prm, sinceTouch, sinceBreak, draft, banner, name, served, clearBonus`.

События `onEvent`: `level{level}`, `launch`, `unstick`, `stick`, `paddle{rel}`, `wall`, `hit{x,y,hp}`,
`break{x,y,tone,max,gift}`, `iron{x,y}`, `drop{kind}`, `power{kind}`, `bolt`, `mouth`, `spark{x,y}`,
`burn{x,y}`, `bossHit{x,y,hp}`, `bossDie{x,y}`, `lose{lives,x}`, `respawn`, `clear{level,bonus}`, `gameover{score}`, `win{score}`.

Правила:
- Ядро движется подшагами ≤3 px; стены/потолок — зеркально; блок — по оси входа (положение до подшага), бьётся ближайший пересечённый блок; вертикальная доля скорости ≥ 0.3.
- Мастерок: `paddleBounce` — угол = rel × 62°, rel = (x ядра − x мастерка)/(ширина/2), с ограничением ±1.
- Скорость: `params(level)` → `speed` 295+24·(L−1) (≤520), `maxSpeed` = speed × (1.45…1.68), `gain` +3…5 за удар по блоку; ОСТУДА — ×0.7 (не ниже 0.72 стартовой).
- Блок: `hp−1`; при 0 — убран, `left−1`, слиток с шансом 0.15 (у «подарка» — всегда). Чугун не считается в `left`.
- Слитки падают 115 px/с; веса: РАЗМАХ 20, ТЕСНОТА 11, ТРОЙНЯ 17 (не при ≥4 ядрах), СМОЛА 13, РЕЗАК 14, ОСТУДА 15, ЗАПАС 3 (не при 5 жизнях).
- 9 с без касания мастерка — траектория поворачивается на 10–20° (против зацикливания). «Тяга печи»: `left ≤ 5` и 4 с без разбитых — ядро вверх доворачивает к ближайшему блоку до 0.9 рад/с.
- Плавильня (10-й): сердце `hp=30`, удар ядром −1 (откат 0.15 с), лучи не ранят; печь ездит 48→118 px/с; выстрел каждые ~2.1→1.1 с с предупреждением 0.45 с, искра летит в мастерок (с половины hp — веер из трёх); искра в мастерок → оглушение 0.8 с.
- Все ядра потеряны → `lives−1`, бонусы сброшены, подача; `lives=0` → `gameover`. Кладка разобрана (или сердце погашено) → `clear` (+300×уровень) → следующий уровень или `win` после `maxLevel`.

`KLADKA.logic`: константы, `LEVELS` (10 ASCII-карт: `.` пусто, `a–f` блок, `+` подарок, `2`/`3` прочные, `#` чугун),
`POWERS`, `parseMap`, `paddleBounce`, `circleRect`, `hitAxis`, `params`.

## Рендеры
`KLADKA.modern` / `KLADKA.classic`: `{ P, bg(ctx,g), draw(ctx,S,g,{bare,toasts}), glyph(ctx,kind,x,y,scale,color) }`.
`bare` — без HUD (фон титула). `KLADKA.ui.hud/powers/banner/toasts(...)` — тексты только через `g.t()`.

## main.js
`Arcade.createGame({gameId:'kladka'})` с тёплыми палитрами тем, `useStandardScreens` (титул переопределён: демо-кладка
«играет сама» + меню движка), сцена `play`. Мышь: движение — цель мастерка, нажатие — `action()`; тач: перетаскивание
сдвигает мастерок на смещение пальца, короткий тап — `action()`. Сложность — `g.difficulty` через `opts.difficulty`.
Отладка/QA: `KLADKA.g`, `KLADKA.app.game()`.

## Definition of Done
- `node kladka/tests/engine.test.mjs` — все тесты зелёные; `node tools/smoke.mjs` — PASS kladka.
- В браузере: титул → игра (Enter) → пауза (P) → T/L/M работают; 0 ошибок консоли.
