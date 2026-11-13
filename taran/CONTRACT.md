# ТАРАН — контракт модулей

Игра аркады «Гефест» на фреймворке Гефест Arcade v2.2 (`engine.js`). Общий стандарт: офлайн, `file://`,
без внешних URL/шрифтов/ассетов, RU/EN, темы modern/retro (меняют только отрисовку), WebAudio-звук,
рекорд призовых в `localStorage` (`arcade.best.taran`), число игроков — `arcade.players.taran` (движок).
Своё хранение: `arcade.taran.champ1` / `arcade.taran.champ2` (чемпионат на 1 / 2 игроков), `arcade.taran.laps`
(`{трасса: лучший круг, с}`), `arcade.taran.opts` (`{mode, team, ctrl, track}`).
Права: название, сеттинг, трассы, машины, соперники, арт, палитры, звуки и музыка — оригинальные; чужих имён нет
(тест «правило имён», стоп-лист в base64).

## js/game.js — `TARAN.Game(opts)` (без DOM, детерминирована при заданном `rng`)
`opts`: `{ track=0, players=1|2|0, humans:[cfg,cfg], rivals:[{ch, cfg}] (по умолч. 4 соперника лиги 0; mode 'time' — нет),
pace, laps=3, control:'tank'|'arcade', mode:'race'|'time', team:'coop'|'duel', countT=3, demo, rng, seed, onEvent(type,data) }`.
`cfg` машины: `{ body:0..2, up:{armor,tires,engine,weapon: 1..5}, rear:'oil'|'mine' }`.

Экран 640×480: HUD 34 px, окно обзора 640×446 (`VIEW`). Мир — пиксели трассы (выборки через ~8 px).

API: `start()` · `update(dt)` (подшаги ≤ 1/60) · `setInput(pi, {left,right,up,down,fire,rocket,drop,nitro})` ·
`setControl(m)` · `state()` → S · `results()` · `drive(car, V?, o?)` — водитель ИИ (V — запаздывающая «картина мира»
`{t, carts, drops}` для бота-человека) · `pressPhase(pr, t)` · `humanCar(pi)`.
Отладка/тесты: `_S`, `_damage(car, dmg, byIdx, how)`, `_boom(x,y,r,dmg,by,kind)`, `_respawn(car)`, `_finalize()`.

`S`: `t, raceT, phase('count'|'race'|'done'), countT, endT, laps, track, mode, team, control, players, demo,
cars[{idx,human(−1 — ИИ),ch,id,color,cfg,st,x,y,a,vx,vy,vf,si,s,lat,prog,lap,z,airT,hp,wreckT,invT,spinT,stunT,nitroT,
nitro,rockets,rear,rearType,rivets,cd,finished,finishT,place,pos,out,offT,lapTimes,bestLap,kills,wrecks,unstuck,inPit,auto}],
bullets, rockets, drops[{k:'oil'|'mine',x,y,owner,t,life,r,dmg}], booms, carts[{rail,i,lat,dir,t,active}], cam{x,y}, lead,
finish[idx], outs[idx], results[{idx,id,human,ch,place,time,best,kills,wrecks,out,finished,unstuck}]`.

События: `start`, `count{n}`, `go`, `shot`, `hit`, `rocket`, `boom{x,y,r,kind}`, `oilDrop`, `mineDrop`, `spin`, `ram{a,b,power}`,
`wall`, `wreck{car,by,how}`, `respawn`, `nitro`, `jump`, `land`, `slag`, `press`, `cart`, `cartHorn`, `pit`, `repaired`,
`lap{car,lap,time,best,human}`, `finish{car,place,human,time}`, `cut{car,human}`, `unstuck`, `raceEnd{results}`.

Правила:
- Трасса `buildTrack(i)`: опорные точки ×64 px → сплайн → 6 проходов сглаживания → равномерная выборка 8 px; старт — на 45 %
  первого отрезка. Препятствия ставятся по рецепту `r` детерминированно: только на прямых участках, с разносом, не у старта.
  Развилка раздвигает дорогу на 44 px и ставит остров (полуширина 30). `checkTrack(i)` → `{gap, minR, len, hazards, …}`.
- Физика: курс + скорость, боковое скольжение гасится сцеплением шин; руль слабее на месте и на максимальной скорости;
  бортики и острова выталкивают и гасят скорость (жёсткий удар > 160 px/с — урон). Масло: юз 0.8–1 с, затем 1.2 с иммунитета.
- Оружие: заклёпки 560 px/с, 0.6 с; ракета 380+ px/с, наведение ±0.7 рад, 2.6 рад/с; взрыв 42 px; мина взводится 0.5 с,
  владелец неуязвим к своему сбросу 1.5 с; нитро 1.4 с (скорость ×1.4, разгон ×1.8). Таран: `max(0, v−50)·0.11 · ram · (лоб 1 / бок 0.3) · (нитро 1.9)`.
- Трамплин: на скорости > 120 — полёт `0.24 + v/680` с; канава 34..124 px за трамплином жжёт 20/с. Пресс: цикл 3.4 с
  (1.9 поднят, 0.7 опускается, 0.8 внизу — твёрдый), удар 32. Вагонетка: 120–160 px/с поперёк, удар 14. Бокс: до 40 брони/с.
- Разбит: 1.8 с, затем на осевую линию с 60 % брони и 2.4 с неуязвимости. Застрял (скорость < 22 дольше 1.2 с) — задний ход
  0.7 с; дольше 4 с — на трассу (`unstuck`, для ИИ и автопилота).
- Камера ведёт лидирующего не финишировавшего игрока (вдвоём — середина между игроками, лидер всегда в кадре).
  Отставший за кадром > `CUT_T` (2 с) снят (`out`) — кроме первых 5 с, горящего и неуязвимого. Конец — когда все игроки
  финишировали или сняты (+2.6 с); места: финишировавшие по порядку, остальные по пройденному, снятые — последними.
- Кооп: игроки не наносят урон друг другу; дуэль — наносят.

## TARAN.champ — чемпионат (чистые функции над сериализуемым объектом)
`newChamp({players, team})` → `{v:1, players, team, league, race, tries, money:[…], cars:[cfg…], pts{}, total, done, log}`;
`price(ch, pi, item)` (`armor|tires|engine|weapon` — следующая ступень, `body1|body2` — корпус; `null` — нельзя) ·
`buy(ch, pi, item)` → bool (касса не уходит в минус; новый корпус — ступени −1) · `raceOpts(ch)` · `trackOf(ch)` ·
`applyRace(ch, results)` → `{prizes[{key,human,place,points,prize,kills}], leagueEnd, standings, qualified, champion, lost}` ·
`standings(ch)` · `serialize(ch)` / `load(str)` (проверка версии, лиги, касс, ступеней; битое → `null`) · `purse(ch, pi)`.
Призы `PRIZE·LEAGUE_MULT[лига] + 150 за разбитого`, очки `POINTS`; тройка лиги — дальше; иначе переигровка (2 раза), затем `done:'lose'`.

## Прочие модули
`js/render.js` — `TARAN.render.world(ctx, S, P, time, vw, vh)` (ctx в левом верхнем углу окна обзора), `car`, `minimap`, `geo`.
`js/ui.js` — `TARAN.ui.render/results/garage/txt/panel/fmtT`. `js/main.js` — сцены `title` (демо-заезд под меню),
`play`, `results`, `garage`, стандартные `pause/win/gameover`; `TARAN.app` — для отладки и автотестов в браузере.
`js/audio.js` — `TARAN.sfx(g, type, d, near)`. `js/modern.js` / `js/classic.js` — палитры (`set.shop|roof|rail|store`).
