# ОСКОЛОК — контракт модулей

Игра аркады «Гефест» на фреймворке Гефест Arcade v2.2 (`engine.js`). Общий стандарт: офлайн, `file://`, без внешних
URL/шрифтов/ассетов, RU/EN, темы modern/retro (меняют только отрисовку), WebAudio-звук, рекорд в `localStorage`.
Права: название, сеттинг (осколок чужого мира, Звёздный Горн, мастерская), Вера, дрон-светляк, Стеклодувы, Тени-ловцы,
Сердце осколка, эпизоды, арт, палитры, звуки и музыка — оригинальные; чужих имён нет (тест «правило имён»).

## js/levels.js — `OSKOLOK.SCREENS[16]`, `OSKOLOK.CHAPTERS = 5`, `OSKOLOK.CUTS`
Эпизод: `{ ch, ep, map[18 строк × 32], dark?, chase?, final? }`. Знаки карты: `.` пусто, `#` камень, `G` стекло (пробой),
`C` осыпающаяся плита, `^` иглы, `V` подвесной кристалл (→ блок `K`), `L`/`l` рычаг группы 1/2, `B`/`b` дальняя кнопка,
`D`/`d` дверь, `}` `{` излучатель луча, `/` `Z` зеркала, `R`/`r` приёмник, `g`/`h` Стеклодув (смотрит влево/вправо),
`s` Тень-ловец, `*` дрон-светляк, `P` старт (подошвы на ряд ниже), `X` выход, `O` разлом (финал A), `Q` Сердце (финал B).
`CUTS` — `{ c1..c5, drone, endA, endB }` → длительность, с.

## js/game.js — `OSKOLOK.Game(opts)` (без DOM, детерминирована)
`opts`: `{ idx | chapter, have (дрон с собой), elapsed, onEvent(type, data), sim (граф: без врагов, погони, обвала плит
и кат-сцен; выход — `S.exited`), noCut, god, def (тестовая карта) }`.
API: `start()` · `update(dt)` (шаг 1/60) · `setInput({ x:-1|0|1, jump, down, res, charge })` (удержания; фронты — внутри) ·
`sendDrone(x, y)` · `recallDrone()` · `skip()` (кат-сцена) · `restartScreen()` · `state()` · `key()` (изменяемый мир строкой).
Тестовые хуки: `_load(key)`, `_place(x, y, face)`, `_go(idx, o)`, `_die(why)`.

Координаты — в клетках: `x` — центр Веры, `y` — подошвы; пол клетки ряда `r` — на высоте `y = r`.
`S`: `phase ('cut'|'play'|'dead'|'won'), cut{id,t,dur}, idx, ch, ep, def, M{t[], open{}, tog{}, lit{}, crum{}, fall[], beams[]},
hero{x,y,vx,vy,face,ground,energy,shield,chargeT,pulseT,breachT,…}, drone{have,st:'off'|'follow'|'fly'|'hover'|'ret',x,y},
guards[{x,y,face,st:'patrol'|'wind'|'cool'|'look'|'stun',alive}], shards[], lurkers[{st:'patrol'|'hunt'|'burn'|'stun'}],
chase{x,v,t,delay}, time, deaths, ending ('A'|'B')`.
`O.logic`: `K` (константы), `stepHero(h, inp, M, dt, ev)` и `hazard(h, M)` — общая физика для игры, графа и бота;
`parse`, `cellSolid`, `tile`, `grp`, `floorBounds`, `mulberry32`.

События `onEvent`: `chapter, cut, screen, exit, jump, land, pulse, shield, charge, charged, breach, glass, droneGo, droneAt,
dronePick, lever, button, door, mirror, crystal, crash, shake, crumble, alert, shard, reflect, shardBreak, shatter, stun,
distract, burn, hunt, fade, chaseStart, die{why}, restart, ending, win{time, ending, deaths}`.

## js/render.js — `OSKOLOK.R`
`draw(g, ctx, S, ui{banner, hint, aim, shake})` — кадр (мир или кат-сцена + HUD); `cut(ctx, id, t, retro)`;
фигуры `vera`, `drone`, `glassblower`, `shadowFig`; `titleArt`. Статический слой эпизода кэшируется по карте и теме.

## js/main.js
Сцены движка (`useStandardScreens`): титул перерисован (+ «Продолжить»), пауза (+ «Эпизод заново»), win (финал, время,
рекорд, финалы n/2); своя сцена `play` (в ней и кат-сцены). Прицел дрона замедляет время до 30 %.
Хранилище: `arcade.save.oskolok` `{chapter, elapsed, deaths}`, `arcade.besttime.oskolok`, `arcade.endings.oskolok`.

## tests/
`engine.test.mjs` — логика, проходимость, бот; `bot.mjs` — `Nav` (граф эпизода по физике + поиск по «узел + ключ мира»),
`playScreens` (человеческий бот: реакция 150–250 мс, ошибки ±2 кадра, щит по реакции, погоня по чтению сцены).
