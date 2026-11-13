# ГОРНИЛО — контракт модулей

Игра аркады «Гефест» на фреймворке Гефест Arcade v2.2 (`engine.js`). Общий стандарт: офлайн, `file://`,
без внешних URL/шрифтов/ассетов, RU/EN, темы modern/retro (меняют только отрисовку), WebAudio-звук,
рекорд в `localStorage` (`arcade.best.gornilo`), число игроков — `arcade.players.gornilo` (движок).
Права: название, герои, мастерская, враги, боссы, арены, арт, палитры, звуки и музыка — оригинальные;
чужих имён нет (тест «правило имён» в `tests/engine.test.mjs`, стоп-лист в base64).

## js/game.js — `GORNILO.Game(opts)` (без DOM, детерминирована при заданном `rng`)
`opts`: `{ rng, seed, players=1|2, stage=1, maxStage=3, continues=2, onEvent(type,data), map?, waves?(stage, room) }`
(`map` — своя карта, `waves` — подмена генератора волн для тестов).

Экран 640×512: HUD 32 px, арена 640×480 (`W×H`), стены 32 px, внутренность `[IX0..IX1]×[IY0..IY1]` = 32..608 × 32..448.
Ворота `GATES` N/S/W/E посередине сторон, полуширина проёма 34. Все объекты: `x, y` — центр.

API: `start()` → api · `update(dt)` (подшаги ≤ 1/60) · `setMove(pi, dx, dy)` и `setAim(pi, dx, dy)` (−1/0/1, раздельно;
`setAim(pi,0,0)` — не стрелять) · `cont()` → bool · `state()` → S.
Отладка/тесты: `_S`, `_spawn(type,x,y,o)`, `_kill(hero,src)`, `_blast(x,y,r,dmg,pi,enemyMade)`, `_drop(x,y,kind)`, `_takeExit(g)`,
`_roomCleared()`, `_loadRoom(room, entryGate)`, `_hurtBoss(d)`, `_wallHit`, `_inBlock`, `_los`.

`S`: `stage, maxStage, players, score, phase('play'|'trans'|'clear'|'cont'|'over'|'won'), phaseT, contT, continues, time, banner,
map, room{l,c,kind,reward,danger,layout,exits{W|N|E:{l,c}}}, roomNo, path[[l,c]], roomState('enter'|'fight'|'cleared'), roomT,
waves[[{type,n,gate}]], wave, waveT, queue, layout, blocks[[x,y,w,h]], hatches[[x,y]], entry, next, transT,
heroes[{id,x,y,alive,out,lives,deadT,inv,mx,my,ax,ay,ang,cd,weapon,wT,ring,hammers,hamA,moving,kills}],
enemies[{id,type,x,y,r,hp,max,speed,ang,dead,flash,t,cd,warn,fuse,enter,rise,state,vx,vy,stun}],
bullets[{k:'b'|'f'|'g'|'d',pi,x,y,vx,vy,dmg,r,life,…}], ebullets[{x,y,vx,vy,r,kind,life}], booms[{x,y,r,t,max,enemy}],
slams[{x,y,r,t,max}], pickups[{x,y,kind,t}], boss{key,x,y,r,hp,max,parts[{kind,ox,oy,x,y,r,hp,max,dead,cd,warn,on}],armored,intro,dead,rot}|null,
kills, peak, rooms, bossKey`.

События `onEvent`: `stage`, `room`, `wave{n,of}`, `spawn{type}`, `shot{pi,w}`, `hit`, `kill{type,x,y,pi,how}`, `boom{x,y,r}`, `fuse`,
`block`, `bounce`, `shove{pi}`, `eshot`, `windup`, `charge`, `thud`, `power{pi,kind,x,y}`, `powerEnd`, `gold`, `extraLife{pi}`, `absorb`,
`heroDie{pi,x,y,src}`, `out{pi}`, `respawn{pi}`, `roomClear{bonus,reward}`, `exit{gate,l,c}`, `bossIntro{key}`, `armor`, `bossHit`,
`partDie{x,y,kind}`, `coreOpen`, `slamWarn`, `slam`, `bellows`, `ring`, `bossDie`, `clear{stage,bonus}`, `contAsk`, `continue`, `gameover`, `win`.

Правила:
- Герой: скорость 150 (диагональ нормирована), радиус 9 (стены/наковальни), попадание — радиус 6. Огонь — только пока
  `aim ≠ 0`; клёпочник 0.11 с, 560 px/с. Открытые ворота пропускают героя за линию стены; заход за неё на 4 px — выход.
- Оружие `GUN`: fan (5 пуль, ±0.34 рад), flame (0.035 с, 0.30 с жизни, пробивает до 4, игнорирует щиты), grenade (180 px или
  удар, радиус 54, урон 5), disc (3 отскока, пробивает, отражается щитом); на 14 с. `AUX`: ring 9 с (неуязвимость, гасит пули,
  разбивает болванки и самоходки), hammers 12 с (2 молота на радиусе 46, урон 2 раз в 0.25 с по цели, гасят пули).
- Враги `ENEMIES`: blank, runner (фитиль 0.45 с при ≤ 42 px, взрыв 40 — бьёт и героев, и своих), turret (подъём 0.9 с, предупреждение
  0.45 с, 1/2/3 пули по кругам), shield (дуга ±1.05 рад гасит пули; касание — толчок и «раскрытие» на 0.8 с), roller (раз в ~3.4 с
  разгон 0.9 с → таран 310 px/с до стены → оглушение 0.8 с; давит своих). Толпа обходит наковальни по полю потока (BFS, клетка 16 px),
  расталкивается (пространственная сетка 40 px). Скорость ×(1+0.08·(круг−1)).
- Волны `makeWaves(stage, room, players, rng)`: болванок `(14 + 2.4·слой + 6·(круг−1))·(вдвоём 1.6)`, 3 волны (+1 со слоя 4, +1 со 2-го круга;
  кладовая — 2), состав по виду комнаты; ворота «все» — пачками. Следующая волна — при ≤ 10 живых или через 11 с.
- Карта `genStage(n, seed)`: слой 0 — старт (колонка 1), слои 1..7 по 3 комнаты (в слоях 2..6 иногда «дыра»), слой 8 — босс;
  выходы W/N/E → колонки c−1/c/c+1 следующего слоя, у некоторых комнат одна боковая дверь закрыта; входящие двери гарантируются.
  `solveMap(map)` → `{ok, reach, rooms, minLen, maxLen, boss}`.
- Награда комнаты (`reward`): weapon (жетон оружия; кладовая — ещё кольцо/молоты и слитки), gold (4 слитка), life; бонус зачистки
  500·круг·опасность. Из врагов падает: болванка 2.2%, прочие 6.6%, каток 70% (четверть — слитки).
- Босс `BOSSES`: press (4 узла: 2 молота, 2 пушки), wheel (4 сопла, 2 люка самоходок), colossus (2 меха, 2 молота, 2 люка);
  узлы `part + 4·(круг−1)` (вдвоём ×1.8), сердцевина под бронёй до гибели всех узлов, затем кольца пуль. Подкрепление из ворот W/E/S
  раз в 4.2 с, пока живых < 20 (вдвоём < 24). Касание корпуса — гибель. Пал → `clear` (бонус 5000·круг) → следующий круг или `won`.
- Жизни 3, возрождение 1.4 с у входа (неуязвимость 2.5 с, «искра» — мелочь в радиусе 90 гибнет), +1 жизнь за 35000 (вдвоём 52500).
  Все выбыли → `cont` (10 с, `cont()` — всем по 3 жизни) или, без продолжений, `over`.

`GORNILO.logic`: константы, `BIND`, `GUN`, `AUX`, `ENEMIES`, `LAYOUTS`, `KINDS`, `BOSSES`, `SCORE`, `genStage`, `solveMap`, `roomAt`,
`makeWaves`, `mulberry32`, `angDiff`.

## Рендер и интерфейс
`GORNILO.modern` / `GORNILO.classic` — палитры (`pixel`, цвета арены и интерфейса). `GORNILO.render.world(ctx, S, P, time)` — арена
(пол кэшируется по теме/планировке); `render.map(...)` — карта круга. `GORNILO.ui.render(g, ctx, S, P, {bare,toasts,shake})` — кадр
(retro — буфер ½ и ×2), HUD (очки, жизни/оружие с таймером, круг/комната, рекорд, полоса босса), баннеры, карта перехода, «Продолжить?».

## main.js
`Arcade.createGame({gameId:'gornilo'})`, `useStandardScreens`, `usePlayers({bind: logic.BIND, actions:['aimL','aimR','aimU','aimD'], hint, pad})`,
тач — два стика `[data-stick=move|aim]` (pointer events, 8 направлений, только И1), титул — арена с толпой, сцена `play`
(ввод `g.input.player(i)` → `setMove/setAim`, нажатие огня в окне продолжения — `cont`). Отладка/QA: `GORNILO.g`, `GORNILO.app.game()`,
`GORNILO.app.newGame({stage, seed})`.

## Definition of Done
- `node gornilo/tests/engine.test.mjs` — все тесты зелёные (включая баланс ботом); `node tools/smoke.mjs` — PASS gornilo.
- В браузере: титул → игра (Enter) → пауза (P) → T/L/M работают; 2 игрока независимы; 0 ошибок консоли.
