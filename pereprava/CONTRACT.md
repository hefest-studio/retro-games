# ПЕРЕПРАВА — контракт модулей

Игра аркады «Гефест» на фреймворке Гефест Arcade v2.2 (`engine.js`). Общий стандарт:
офлайн, `file://`, без внешних URL/шрифтов/ассетов, RU/EN, темы modern/retro (меняют
только отрисовку), WebAudio-звук, рекорд в `localStorage` (`arcade.best.pereprava`).
Права: название, герои, правила-формулировки, уровни, арт, палитры, звуки и музыка — оригинальные; чужих имён нет.

## js/game.js — `PEREPRAVA.Game(opts)` (без DOM, детерминирована при заданном `rng`)
`opts`: `{ rng, level=1, maxLevel=10, lives=3, time=0, difficulty(level,base,step,max), onEvent(type,data) }`.

Поле 480×640: клетка 32×40, 15 столбцов × 13 рядов от `TOP=48`. Ряды: `0` склад (ячейки в столбцах 1,4,7,10,13,
допуск ±20 px), `1–5` канал, `6` насыпь, `7–11` проезд, `12` старт (столбец 7). Низ 568–640 — панель таймера.

API: `start()` → api · `update(dt)` · `move('up'|'down'|'left'|'right')` → true, если прыжок начат
(только в фазе `play` и не во время прыжка) · `state()` → S · `mateX()` · `_loadLevel()` (тесты/QA).

`S`: `level, maxLevel, lives, score, phase('play'|'dead'|'clear'|'over'|'won'), phaseT, time, over, won,
cfg{level,layout,mul,lanes[13],spiders[{sp,ph}],time,dive{per,under},trap,prize,mate}, hero{x,row,face,hop{t,fx,fr,tx,tr}|null},
bays[5]{col,x,filled,prize,trap,warn,mate}, timer, bestRow, carry, mate{row,idx,off,dir,life,len}|null,
banner, death{reason,x,row,carry}|null, filled, nextExtra`.

Полоса: `{row, kind:'road'|'river', pat, v (px/с, знак — направление), P (период), M, objs[{off,len,type,idx,ph}]}`;
`objX(lane,o,t) = mod(off + v·t, P) − M` — мир зависит только от времени.

События `onEvent`: `level{level}`, `jump{dir}`, `row{row}`, `bay{bay,x,secs}`, `prize{bay,x}`, `mate{bay,x}`, `pickup{x}`,
`prizeShow`, `mateShow`, `trap{x}`, `extra{lives}`, `die{reason,x,y,lives}`, `respawn`, `clear{level}`, `gameover{score}`, `win{score}`.
Причины гибели: `car`, `water`, `edge`, `fish`, `spider`, `wall`, `trap`, `time`.

Правила:
- Прыжок длится `HOP_T=0.15` с; на суше край экрана — стена (прыжок не начинается), после приземления x выравнивается по столбцу;
  на воде прыжок за край — гибель `edge` при приземлении.
- Транспорт: пересечение `|x − объект| < HERO_HALF(10)` с отступом 3 px — `car` (проверяется и в полёте — по ряду середины прыжка).
- Канал: опора — объект под x (отступ 3 px), не погружённый поплавок (`diveDepth < 1`); стоя на опоре, герой едет `x += v·dt`;
  `x < 4` или `x > 476` — `edge`. Голова сома (передняя клетка по ходу) — `fish`.
- Ячейка: занятая/стена — `wall`; капкан активен после 1 с предупреждения, держится 3,5 с — `trap`; приз живёт 6 с.
- Очки: ряд вперёд (новый) +10, ячейка +50 + 10×целые секунды таймера, приз +200, напарник +200, смена +1000. Доп. жизнь — каждые 10 000 (≤5).
- Таймер переправы `30 − 0,6·(L−1)` с; при 0 — `time`. Гибель: `lives−1`, пауза 1,3 с, новый герой (напарник теряется).
- Смена: раскладка `LAYOUTS[floor((L−1)/2)]`, скорость ×1,0 (нечётная) / ×1,06 (чётная) / ×1,18 (10-я), × `difficulty(L,1,0,2)`.
  Пауки — с 3-й (2 — с 8-й), капканы — с 4-й, напарник — со 2-й, сом — в раскладках 3–5 (с 5-й смены).

`PEREPRAVA.logic`: константы, `LAYOUTS`, `TYPES`, `PTS`, `makeLane`, `buildLevel`, `objX`, `diveDepth`, `supportAt`, `fishHead`,
`carHit`, `spiderX/Dir/Hit`, `newHero`, `cloneHero`, `heroPos`, `hopStart`, `stepHero`, `bayAt`, `colX`, `rowY`, `snapX`, `mod`.

## Рендеры
`PEREPRAVA.modern` / `PEREPRAVA.classic`: `{ P, bg(ctx,g), draw(ctx,S,g,{bare,toasts}), lifeIcon(ctx,x,y,on) }`.
`bare` — без героя и HUD (фон титула). `PEREPRAVA.ui.hud/footer/banner/toasts(...)` — тексты только через `g.t()`.

## main.js
`Arcade.createGame({gameId:'pereprava'})` с палитрами тем, `useStandardScreens` (титул переопределён: живой двор + меню движка;
на паузе P/Esc — продолжить), сцена `play`. Ввод: нажатие — прыжок, удержание — повтор (0,28 с, затем каждые 0,2 с),
нажатие во время прыжка — буфер; тач — `bindDpad` (U/D/L/R), свайп ≥18 px по канве, короткий тап — вперёд.
Отладка/QA: `PEREPRAVA.g`, `PEREPRAVA.app.game()`.

## Definition of Done
- `node pereprava/tests/engine.test.mjs` — все тесты зелёные; `node tools/smoke.mjs` — PASS pereprava.
- В браузере: титул → игра (Enter) → пауза (P) → T/L/M работают; 0 ошибок консоли.
