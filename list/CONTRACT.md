# ЛИСТ — контракт модулей

Игра аркады «Гефест» на фреймворке Гефест Arcade v2.2 (`engine.js`). Общий стандарт: офлайн, `file://`, без внешних
URL/шрифтов/ассетов, RU/EN, темы modern/retro (меняют только отрисовку), WebAudio-звук, рекорд в `localStorage`
(`arcade.best.list`). Права: название, герой (печатник Литер), враги, боссы, сюжет, страницы, арт, палитры, звуки и
музыка — оригинальные; чужих имён и терминов нет (тест «правило имён», стоп-лист в base64).

## js/levels.js — `LIST.levels`
Панель: `H = 160`, верх пола `F = 144` (локальные единицы); лист `PAGE_W × PAGE_H = 960 × 530`.
Шаблоны страниц `T1` (8 панелей) и `T2` (6 панелей + арены `A`, `B`): `p[id] = {r, x, w, dir, ex|boss}`,
`to[id] = {F?: id|'END', D?: id}`. `dir` — направление чтения панели (−1 — зеркально), `ex`: `F` (дальняя рамка),
`D` (дыра у дальнего края), `FD` (развилка). `CHAPTERS[c] = {boss, pages:[{id: {k, en:[[тип…]…], it:[…], cap, pit}}]}`.
Архетипы `k`: `brawl` · `lever` (ворота + рычаг на тумбе) · `frame` (яма 88 + рамка на гвоздике) · `sketch`
(яма 92 + эскиз моста + подставка с карандашами) · `steps` (стена 72 + эскиз ступеней) · `blank` (пустая панель:
пол рисуется) · `wall` (запечатанная дальняя рамка — открыть броском).
`buildPanel(ch, pg, id)` → `{ ch, pg, id, x, y, w, h, F, dir, kind, cap, pits[{x0,x1,k:'pit'|'hole'}], blocks[], ledges[],
gate{x,w}, lever{x,y}, frame{pin{x,y}, rect, hangY}, sketch{kind, zone[x0,x1], parts[]}, stand{x}, seal, blank,
items[{k,x}], spawns[x], waves[[тип]], exits[{s:'R'|'L'|'D', to, need?:'tear', hole?}], entry{side,x,dropX}, boss?{type,variant} }`.
`pageIds(pg)`, `template(pg)`, `rowY(r)`, `COUNT = 3`, `PAGES = 2`.

## js/game.js — `LIST.Game(opts)` (без DOM; детерминирована при `seed`)
`opts`: `{ seed, ch=1, pg=1, lives=2, onEvent(type,data), god (тесты: без расхода чернил), inv }`.
API: `start()` · `update(dt)` (шаг 1/60) · `setInput({x, jump, atk, block, grab, use, slot, sel})` (кнопки «зажаты»,
фронты ловятся внутри; `sel` 1..3 — прямой выбор ячейки) · `state()` → S · `panel()` → рантайм панели · `spec()` →
панель из levels · `exitOpen(side)` · `restartPanel()`. Тест-хуки: `_spawn(type,x,drip)`, `_clearEnemies()`,
`_hurt(n,src)`, `_goto(ch,pg,id,from)`, `_place(x,y)`, `_give(k)`, `_solids()`, `_boss()`.

`S`: `ch, pg, pid, prevPid, phase('play'|'trans'|'turn'|'dead'|'ending'|'over'|'won'), phaseT, t, score, lives,
hero, inv[3], sel, en[], proj[], items[], boss, visited{}, route[], ending, endings[], deaths, kills, tears, msg`.
Герой: `{x, y (подошвы), w 12, h 26, vx, vy, ground, face, hp (чернила 0..100), atk, combo 0..2, jk, block, hurt, inv,
hold, shield, drawT, walkT}`. Рантайм панели: `{sol[] (опоры), gateOpen, leverOn, frame 'hang'|'fall'|'down', frameY,
drawn, drawT, cleared, sealOpen, wave, tears[], erased{}, eraseWarn{}, dmgTaken, chunks?}`.

Правила:
- **Физика** (ед., с): g = 1300, прыжок 400 (≈ 61 вверх, ≈ 61 вдаль), бег 100, койот 0,08. Опоры — прямоугольники;
  полки односторонние; боковые рамки — стены, пока выход не открыт.
- **Бой**: комбо 1 + 1 + 2 (окно 0,32 с, дальность 22/22/27), третий — отброс 170 и оглушение; пинок в прыжке 2.
  Блок (на земле, ↓) гасит удары спереди; волна Великой Кляксы не блокируется. Захват: клякса на земле, страж —
  только оглушённый, перо — воткнутое; держишь до 2,2 с; бросок 300 ед/с: попадание во врага −3 обоим, в рамку —
  разрыв бумаги (−5), в запечатанную дальнюю рамку — открывает выход.
- **Чернила**: старт 100; промах −1, по стене/рамке/воротам −2, ножницы −3, яма −12; враги: клякса 8, страж 12,
  перо 10 (×1,2 во 2-й главе, ×1,4 в 3-й). Чернильница +30, капля +10 (22 % из врагов). 0 — гибель.
- **Жизни**: 2 листа (основной + запасной); гибель — панель заново (100 чернил), без листов — конец игры.
- **Инвентарь** 3 ячейки: `scis` (бумеранг 0,42 с, урон 2), `flask` (взрыв r 50, урон 5), `mark` (щит 6 с),
  `pencil` (в зоне эскиза за 0,6 с дорисовывает опоры). Подставка выдаёт карандаш, если его нет.
- **Зачистка**: волны врагов по очереди; когда все повержены — выходы открыты, крышки дыр сняты, бонус 100
  (+200 без потерь при уходе). Запечатанная панель после зачистки подпускает новую кляксу каждые 1,4 с.
- **Боссы**: Великая Клякса (24, прыжок-удар с волной ±84, клякса раз в 8/6 с), Переплётчик (28, щит спереди от
  ближнего боя и ножниц; таран 225–260 — об стену оглушён на 1,9 с; скрепки), Злой Корректор (32, парит на 70 над
  полом, стирает 1–2 из 6 кусков пола с предупреждением 1 с на 3,6 с, замазка, каждый 3-й ход спускается на 2,4 с).
- Очки: клякса 100, перо 150, страж 200, удар 10, буквица 250, разрыв 150, зачистка 100, без потерь 200,
  босс 5000, концовка A 1500 / Б 1000.

События `onEvent`: `page{ch,pg}`, `panel{id,kind,from}`, `turn`, `chapter{ch}`, `jump`, `land`, `swingHero{combo}`,
`jkick`, `hit{x,y,dmg,big,src,boss?}`, `whiff`, `wall`, `ink{n,why}`, `eblock`, `blocked`, `hurt{dmg,kind}`, `kill`,
`grab`, `grabMiss`, `throw`, `escape`, `tear{side,x,y,opened}`, `bonk`, `lever`, `pin`, `frameDown`, `draw`, `drawn`,
`noSketch`, `empty`, `pick{k,swap}`, `slot`, `useScis`, `useFlask`, `useMark`, `boom`, `shieldHit`, `heal{n}`,
`letter`, `sheet`, `drip`, `formed`, `windup{type}`, `lunge`, `swing`, `hop`, `dive`, `stuck`, `fall`, `clear`,
`clean`, `die{why}`, `respawn`, `gameover`, `bossIn{type}`, `spit`, `leap`, `slam`, `charge`, `toss`, `bonkWall`,
`descend`, `erase`, `restore`, `splat`, `bossDown`, `ending{ch,v}`, `win`.

## js/render.js — `LIST.R`
`draw(g, ctx, S, game, {cam, banner})` — кадр: стол, лист с панелями (текущая — с врагами и героем, посещённые —
тушью, остальные — карандашным эскизом), разворот страницы, ономатопеи и подписи (экранный слой), HUD.
Retro — буфер 320×180 → 16 цветов → ×2. `hero`, `enemy`, `boss`, `itemIcon`, `FX` (частицы, `word` — ономатопея),
`wrap`, `Z = 1.45` (масштаб мира).

## js/main.js
Сцены движка (title перерисован разворотом книги), камера (плавный перелёт между панелями), ввод, тач-кнопки.
Музыка: `g.setMusic(Arcade.tracks.list | 'list:2' | 'list:3' | 'list:boss')` на событиях `page`/`bossIn`.
`LIST.app = { g, game(), cam() }` — для отладки и автотестов в браузере.
