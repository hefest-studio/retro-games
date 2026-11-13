# УГОЛЁК — контракт модулей

Игра аркады «Гефест» на фреймворке Гефест Arcade v2.2 (`engine.js`). Общий стандарт:
офлайн, `file://`, без внешних URL/шрифтов/ассетов, RU/EN, темы modern/retro (меняют
только отрисовку), WebAudio-звук, рекорд в `localStorage` (`arcade.best.ugolyok`, лучшее время — `arcade.besttime.ugolyok`).
Права: название, герой (робот-кочегар Уголёк), сажники и окалыши, мир, арт (пиксельный и векторный),
палитры, звуки и музыка — оригинальные; чужих имён и терминов нет (тест «Правило имён»).

## js/game.js — `UGOLYOK.Game(opts)` (без DOM; ловушки и обитатели — чистые функции времени)
`opts`: `{ lives=3, world, onEvent(type,data), safe=false (только тесты: ловушки не убивают) }`.

Экран 20×12 клеток (32 px, HUD 36 px сверху → канва 640×420). Мир 8×6 экранов строится один раз (`logic.world()`).
Клетки: `E` пусто, `R` скала, `LD` лестница/верёвка (верхняя клетка — опора; верёвка — `rm.rope[x]`), `PF` балка
(односторонняя), `DR` дверь (ключ `g`), `GT` заслонка Горна, `SP` шипы, `CL`/`CR` конвейер влево/вправо.
За краем экрана повторяется крайняя клетка (дверь/лестница «продолжаются» в соседа).
Экран: `rm.t, rm.g, rm.f (пол), rm.items[{k:'coal'|'key'|'helmet'|'gear'|'beacon'|'forge', c, r, id, key?}],
rm.hz { presses[{x,top,bot,per,ph}], drips[{x,y0,y1,per,ph}], carts[{s,e,y,x0,x1,v,stop,ph}], belts[{s,e,y,dir}], pits[{x,y}],
enemies[{type:'flyer'|'crawler', mode?, x0,x1|y0,y1, y, v, ph}] }`.

API: `start()` → api · `update(dt)` (шаг 1/60) · `setInput(dx, dy, jump)` (↑ без лестницы рядом = прыжок) ·
`canClimb()` · `roomLeft(rm)` · `state()` → S. Тестовые хуки: `_die(why)`, `_enter(room)`, `_place(room,c,r)`, `_giveKey(k)`, `_giveCoal(n)`.

`S`: `phase('play'|'dead'|'won'|'over'), phaseT, time, score, lives, over, won, room,
hero{room,x,y,vx,vy,ground,climb,face,coy,inv,belt,apex,walkT}, keys{k:true}, gate, got{itemId:true}, coal, total,
visited{room:true}, helmet (с), cp{room,x,y,id}, deaths, why{причина:n}, nextLife, roomsClear, finalBonus`.

События `onEvent`: `room{room,zone}`, `jump`, `thud{fall}`, `die{why,lives,x,y}` (why: press, drip, cart, flyer, crawler, fall, spikes),
`respawn`, `gameover`, `coal{n,total,x,y,left}`, `roomClear{pts}`, `key{key}`, `helmet`, `helmetEnd`, `gear{pts}`, `beacon{first}`,
`life{lives}`, `gateOpen`, `slam{x,y}`, `splash{x,y,near}`, `win{time,score,bonus}`.

Правила:
- **Физика:** бег 5,4 кл/с, прыжок 19,6 кл/с при g = 56 (≈3,4 клетки), обрезка прыжка при отпускании, «койот» 0,08 с,
  лестницы 4,4 кл/с, конвейер ±2,4 кл/с. Хитбокс героя 0,64×1,4. Падение ≥ 7,5 клетки (от высшей точки, через экраны) — гибель.
- **Прессы:** период 3,0–3,6 с: ожидание наверху (≥ 1,4 с) → дрожь 0,5 с → удар 0,12 с → внизу 0,45 с → подъём 0,55 с.
- **Капли:** набухают 0,7 с (безопасно), падают с ускорением 30 кл/с², брызги безопасны.
- **Вагонетки:** «маятник» по рельсам 6–9 клеток, 3–3,6 кл/с, стоянка 0,9 с у упоров; рельсы не ближе 3 клеток к дверям.
- **Сажники:** полоса полёта не задевает стоящего ни в одной опорной клетке (проверяется тестом); **окалыши** — по полу.
- **Каска:** 10 с неуязвимости к ловушкам и обитателям; после гибели — неуязвимость 2 с.
- **Очки:** уголь 100, экран чист 500, шестерня 250, ключ 500, каска 300, маяк 200; жизнь — каждые 5000.
  Весь уголь → `gate = true` (заслонка проходима); Горн — победа, бонус `5000 + 1000·жизни + 5·(1500 − время)`.

`UGOLYOK.logic`: константы, `MAP`, `world()`/`buildWorld()`, `tileAt(st,room,cx,cy)`, `isSolid`, `isStand`,
`heroStep(W,st,H,inp,dt)` (общая физика), опасности `swing`, `enemyAt`, `cartAt`, `pressAt`, `dripAt`, `hazards(rm,t)`,
`heroBox`, `overlap`; `ACTS` (макро-действия: шаг, прыжки с разным удержанием, лестница вверх/вниз), `drive`/`finished`,
`Nav(W)` — граф проходимости: узлы «стою в клетке», рёбра — симуляция `ACTS` настоящей физикой (смертельные падения
и шипы исключены); `solve()` — что достижимо с учётом ключей и заслонки.

## Рендеры
`UGOLYOK.modern` / `UGOLYOK.classic`: `{ P, KC, bg(ctx,g), draw(ctx,S,g,{bare,toasts,fade,intro,why}), hero(...), lifeIcon, coalIcon, keyIcon, helmetIcon }`.
Статичный слой экрана кэшируется по номеру экрана; двери, заслонка, конвейеры, механизмы и обитатели — живые.
`UGOLYOK.ui`: `hud`, `mapOverlay`, `banner`, `toasts`, DOM (`init/fit/sync`) — тексты только через `g.t()`.

## main.js
Сцены движка (`useStandardScreens`), титул — стартовый экран с Горном + меню; `play` — фикс-шаг 1/60, карта (`Tab`/`C`) ставит игру
на паузу; финальные экраны дополнены временем и лучшим временем. `UGOLYOK.app = { g, game(), map() }` — для автотестов в браузере.

## tests
`engine.test.mjs` — логика, мир, ловушки, граф, имена; `bot.mjs` — `playUgolyok(UGOLYOK, seed, opts)`: «человеческий» бот на тех же
макро-действиях, оценивает ловушки по их циклам на ~2,4 с вперёд.
