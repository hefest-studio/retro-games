# ЖЕОДА — контракт модулей

Игра аркады «Гефест» на фреймворке Гефест Arcade v2.2 (`engine.js`). Общий стандарт: офлайн, `file://`,
без внешних URL/шрифтов/ассетов, RU/EN, темы modern/retro (меняют только отрисовку), WebAudio-звук,
рекорд в `localStorage` (`arcade.best.zheoda`), открытый эпизод — `arcade.zheoda.reached`.
Права: название, героиня, обитатели, уровни, арт, палитры, звуки и музыка — оригинальные; чужих имён нет.

## js/game.js — `ZHEODA.Game(opts)` (без DOM, детерминирована при заданном `rng`)
`opts`: `{ rng, level=1 (стартовый: 1 или 9), lives=3, maxLevel=17, difficulty(level,base,step,max), onEvent(type,data), noEnemies }`.

Единицы — клетки (32 px) и секунды; окно камеры 20×11.25 клетки. Героиня 0.7×1.4, бег 6 кл/с,
прыжок `JUMP_V=19` при `G=55` (≈3.1 клетки, отпустил раньше — ×0.4), койот 0.08 с, буфер прыжка 0.1 с.

API: `start()` (→ хаб) · `update(dt)` (шаг 1/60) · `setInput(dx∈[−1,1], jumpHeld)` · `fire()` · `down()` (рычаг, иначе взрывчатка)
· `hubMove(d)` · `enter(n?)` (только открытый и не пройденный) · `canEnter(n)` · `loadLevel(n)` · `state()` → S · `world()` → мир физики.

`S`: `phase('hub'|'play'|'dead'|'clear'|'over'|'won'), level, maxLevel, lives, hp, score, ammo, dyn, keys{R,B,Y}, chan, gs(±1),
open, cleared{}, hubSel, cols, rows, grid[] (символы), items[{k,cx,cy,x,y,taken}], crystals, crystalsLeft, exitOpen, exit{cx,cy},
levers[], orbs[], lifts[{x,w,y,yB,yT,dir,wait,dy}], stal[{cx,cy,x,y,state:'hang'|'shake'|'fall'|'gone'}], enemies[{type,x,y,w,h,vx,vy,hp,face}],
shots[], pebbles[], shards[], waves[], dynas[{x,y,t}], blasts[], secrets[{cells,found}], secretsFound, boss|null, pl{x,y,w,h,vx,vy,gs,ground,face,inv}, cam{x,y}, banner, levelT, clearBonus`.

События `onEvent`: `level{level,name}`, `hub{open}`, `hubMove`, `locked`, `jump`, `land`, `flip{gs,x,y}`, `crystal{x,y,left}`, `exitOpen`,
`gem`, `heal`, `ammo{ammo}`, `dyn`, `key{k}`, `door{k}`, `lever{on}`, `secret`, `place`, `blast{broke}`, `wall`, `shot`, `empty`, `spark`,
`hit`, `kill{type}`, `hurt{hp,src}`, `die{lives,src}`, `respawn`, `spit`, `hop`, `crack`, `shatter`, `lift`, `tele`, `shard`, `slam`, `thud`,
`bossHit{hp}`, `bossDie`, `clear{level,bonus}`, `gameover{score}`, `win{score}`.

Правила:
- Карты — ASCII (легенда в начале `game.js`). Края — скала. Карниз `-` держит только со стороны гравитации.
- Рычаг: один «канал» на уровень; `|` твёрда при выкл., `:` — при вкл. Все рычаги уровня показывают одно положение.
- Сфера: вход (не стояние) переворачивает `gs`; ходоки (`c`, `j`) и Исполин падают по `gs`.
- Лифт: `H` в ряду пола (ширина — подряд), `=` в колонке его левого края — верхняя остановка; 3 кл/с, стоянка 1.4 с.
- Ключ отпирает всю связную дверь своего цвета при касании. Взрыв: радиус разрушения 1.7, убийства 2.0, урона героине 1.5.
- Бластер: заряды 6/12, ящик +4 (при полном не берётся), выстрел 16 кл/с, дальность 9, на высоте колена.
- Урон −1 здоровья (3 на жизнь), неуязвимость 1.4 с; кислота — сразу минус жизнь; потеря жизни — уровень заново
  (заряды/взрывчатка — как на входе); Исполин не заживает между попытками (`S.bossKeep`).
- Хаб: открыт `open`; пройденный уровень открывает следующий; после 17-го — `won`.

`ZHEODA.logic`: константы, `LEVELS`, `parseLevel`, `makeWorld`, `makeBody`, `stepPlayer` (общая с ботом физика), `moveX/moveY`, `boxHits`, `cellSolid`, `shotY`, `mulberry32`.

## Рендеры
`ZHEODA.ui.drawWorld(ctx,S,g,R)` — общий порядок слоёв; тема `R = ZHEODA.modern | ZHEODA.classic`:
`{ P, bg, tile, item, exit, lever, orb, lift, stal, dynaLit, enemy, boss, hero, heroDown, shot, pebble, shard, wave, blast, icon, hubBg, hubPath, hubNode, light? }`.
`ui.hud/hub/banner/toasts` — тексты только через `g.t()`.

## main.js
`Arcade.createGame({gameId:'zheoda'})`, ввод — `g.input.setPlayers` (1 игрок, тач-кнопки), `useStandardScreens` (титул переопределён:
пещера на фоне + меню движка + пункт «Эпизод»), сцена `play` (хаб и уровни). Отладка/QA: `ZHEODA.g`, `ZHEODA.app.game()`.

## Definition of Done
- `node zheoda/tests/engine.test.mjs` — все тесты зелёные; `node tools/smoke.mjs` — PASS zheoda.
- В браузере: титул → хаб (Enter) → уровень (Пробел) → пауза (P) → T/L/M работают; 0 ошибок консоли.
