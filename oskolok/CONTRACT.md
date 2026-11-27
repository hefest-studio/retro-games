# ОСКОЛОК (SHARDSWAP, слаг `oskolok`) — контракт модулей

Игра аркады «Гефест» на Гефест Arcade v2.10 (`engine.js`). Офлайн, `file://`, без внешних URL/шрифтов/ассетов, 5 языков (ru, en, tr, es, pt), темы modern/retro
(меняют только отрисовку), WebAudio. Название, сеттинг (заброшенная стекловарня), подмастерье, осколок, враги, арт, звук и музыка — оригинальные; чужих имён нет (тест).
Порядок подключения: `engine.js` → `js/music.js` → `js/i18n.js` → `js/levels.js` → `js/game.js` → `js/audio.js` → `js/render.js` → `js/stick.js` → `js/main.js`. Всё в `window.OSKOLOK`.

## js/levels.js — `OSKOLOK.LEVELS[6]`, `OSKOLOK.KEYS`, `OSKOLOK.Brush(W,H)`
Зал: `{ key, W, H, map[H строк × W], zones[{x0,x1,k}] }` (zones — подсказки первого зала). Знаки: `.` пусто, `#` камень, `g` стекло (герой упирается, осколок проходит),
`^` стекляшки, `P` старт, `X` дверь горна, `o` бусина, `h` сердечко, `k` лампа-отметка, `e` ползун, `b` мотылёк, `t`/`T` лампа-стрелок (влево/вправо).
Кисть: `put fill frame ground pit dip ledge slab pane wall ceil spikes beads mob out`. Залы: yard, works, tower (36×40), hot, glasshouse, furnace.

## js/game.js — `OSKOLOK.Game(opts)` (без DOM, детерминирована), `OSKOLOK.logic`, `OSKOLOK.migrate(io)`
`opts`: `{ onEvent, rng, start:{fi, score, lives}, calm (без врагов — для графа) }`. API: `start() update(dt) setInput({dx, dy, jump, act, recall}) state() continueGame() giveUp()
reviveAd() canBoost() boost() saveData()`; хуки: `_level _place _spawn _hurt _die _clear _reset`. Ввод — удержания, фронты внутри.
`S`: `phase ('play'|'dead'|'clear'|'won'|'cont'|'over'), fi, key, lv{W,H,t[]}, hero{x,y,vx,vy,face,ground,inv,kb}, shard{st:'hand'|'fly'|'plant'|'lost',x,y,kind:'floor'|'wall'|'ceil',dir},
enemies[{k:'crawler'|'bat'|'turret',x,y,alive}], sparks, items, hp, lives, conts, score, cp, safe, cam`.
Осколок: `act` при `hand` — бросок (вид по `dx,dy`: 0 прямо, 1 диагональ вверх, 2 вверх, 3 диагональ вниз, 4 вниз), при `plant` — обмен (`landing` подбирает свободное место
не дальше 1 клетки, иначе `fizzle`); `recall` — в руку. События: `level throw plant swap fizzle recall lost kill pickup hurt respawnSafe die respawn checkpoint life clear continueQ continued
revived boost gameover win spark jump land`.
`logic`: `K, THROWS, parse, tile, solid, shardSolid, bodyFree, newHero, stepHero, hazard, overlapsTile, aimKind, newShard, stepShard, landing`.
`migrate(io)` — разовая миграция записей (маркер `arcade.oskolok.v='2'`).

## js/render.js — `OSKOLOK.render(g, ctx, S, ui)`, `OSKOLOK.R` (`heroFig shardFig foeFig PAL`), `OSKOLOK.fx` (частицы, след обмена)
Вид 32×16 клеток по 16 px (512×256) + панель 32 px; retro рисуется в буфере вдвое меньше. `ui`: `{ toasts, banner, msg, shake, contT, throwT }`.

## js/main.js
Сцены `useStandardScreens` + `card` («зал пройден» перед межстраничной) + `play`. Ввод: ←→ ход, Пробел/Z прыжок, X/J осколок, C/K вернуть, ↑↓ наклон; тач — стик + ● ✦ ↺ + II.
Хранилище: `arcade.save.oskolok` `{v:2, fi, score, lives}`, `arcade.best.oskolok` (очки, облако), `arcade.oskolok.v / oldBest / notice`.

## tests/
`bot.mjs` — `makeNav(O, li, {noShard})` (граф по настоящей игре, ленивая раскрутка, Дейкстра) и `playGame(O, seed, opts)` («человеческий» бот).
`engine.test.mjs` — логика, граф, боты, i18n, правило имён, платформенные хуки.
