# ЛИВЕНЬ — контракт модулей

Игра аркады «Гефест» на фреймворке Гефест Arcade v2.2 (`engine.js`). Общий стандарт: офлайн, `file://`,
без внешних URL/шрифтов/ассетов, RU/EN, темы modern/retro (меняют только отрисовку), WebAudio-звук.
Хранилище: `arcade.best.liven.<easy|normal|hard>` — рекорд по сложности, `arcade.best.liven` — общий (для каталога),
`arcade.liven.diff`, `arcade.liven.form` — выбор в меню. Ключей с чужими именами нет (миграция не нужна).
Права: название, челнок, Звонари, этапы, перезвоны, арт, палитры, звуки и музыка — оригинальные; чужих имён и
фирменных терминов жанра нет (тест «правило имён», стоп-лист — в base64).

## js/game.js — `LIVEN.Game(opts)` (без DOM, детерминирована при заданном `rng`)
`opts`: `{ rng, diff='normal'|'easy'|'hard', form='fan'|'blade', stage=1, maxStage, lives, onEvent(type,a,b,c), noHit, frozen }`
(`noHit` — бессмертие для тестов/титула, `frozen` — челнок не двигается и не стреляет).

Поле 400×600 (x вправо, y вниз), фикс-шаг 1/60 с. Пули — пул `Bullets` на Float32Array/Uint8Array (`MAXB` = 3200),
удаление перестановкой последнего, без аллокаций в тике. Выстрелы (`PS`, 360) и предметы (`IT`, 1400) — пулы `Bodies`.

API: `start()` → api · `tick(dt)` · `update(dt)` (накопитель, ≤ 6 шагов) · `setInput(dx,dy,focus)` · `setFocus(f)` ·
`drag(dx,dy)` (относительное ведение, ≤ 2,4× скорости за кадр) · `setForm(f)` · `bomb()` → bool · `cont()` → bool · `giveUp()` · `state()` → S.
Тестовые хуки: `_G` (API узоров), `_card(id,ci,mid)`, `_stageOnly(n)`, `_fill(n)`, `_hit()`, `_die()`, `_kill(e)`, `_spawn(ev)`,
`_boss(id,mid)`, `_add(n,raw)`, `_sparks(n)`, `_collect(i)`.

`S`: `phase ('idle'|'play'|'clear'|'cont'|'over'|'won'), diff, D, stage, stages, time, stageT, score, lives, bombs, conts, contT,
graze, sparks, mult, maxMult, P{x,y,focus,form,inv,dead,hitT,bombT,…}, B, PS, IT, E[{on,type,x,y,hp,r,…}],
boss{on,mid,def,id,ci,hp,mhp,t,enter,gap,inv,capture,dead,leave,timeout,…}, clearBonus, magnetT, stats{deaths,bombs,captures,cards,kills,grazes,timeouts,deathbombs,stageDeaths}`.

События `onEvent(type,a,b,c)`: `stage(n)`, `shot`, `graze(x,y,n)`, `hit`, `die(x,y,lives)`, `respawn`, `bomb(x,y,bombs)`, `cancel(n)`,
`kill(x,y,pts)`, `enemyHit`, `bossHit`, `spark(x,y,sparks)`, `midboss`/`boss`, `card(ci,count,mid)`, `cardEnd(bonus,timeout,capture)`,
`midDown`/`bossDown`, `clear(stage,bonus)`, `extend`, `contAsk(left)`, `continue(conts)`, `gameover(score)`, `win(score,final)`.

Правила:
- Хитбокс `HB` 2,5 px; грейз — пуля ближе `r + 18`, один раз на пулю, очки `20 + 0,2·min(грейз,1000)`.
- Скорость 255, в фокусе 112; огонь 15 залпов/с; Веер — 5 пуль (широко / узко в фокусе), Клинок — 3 пули ×1,75 урона.
- Попадание → окно 0,13 с (разряд спасает) → смерть: −1 жизнь, половина искр, разряды = 3, все пули гаснут,
  перезвон теряет бонус; 1 с — возрождение с 3 с неуязвимости.
- Разряд: 3 с неуязвимости, первые 0,8 с гасит пули в окалину и бьёт врагов (60/с) и босса (18/с); перезвон теряет бонус.
- Множитель `1 + 0,01·искры` (≤ ×5) умножает все очки, кроме финального бонуса. Магнит предметов: 46 px (фокус 70),
  после перезвона/разряда/этапа — всё к челноку.
- Перезвон: `hp`, `time`, `bonus`; бонус = `bonus · D.bonus · (0,5 + 0,5·(1 − t/time)) · mult`, только без смерти и разряда;
  таймаут — без бонуса. Между перезвонами 1,3 с, в начале каждого 1 с неуязвимости босса.
- Этап пройден → бонус `(50000·этап + 10·грейз) · D.bonus · mult`, 4,2 с, следующий этап. После 5-го — `won`,
  финальный бонус `(200000·жизни + 50000·разряды) · D.bonus`.
- Жизни за очки `D.ext`; продолжения `CONTS` = 3, отсчёт 10 с.

`LIVEN.logic`: `K`, `BR` (радиусы пуль по виду), `DIFF`, `DIFFS`, `FORMS`, `SHOT`, `ET`, `PATHS`, `mulberry32`, `Bullets`, `Bodies`.

## js/patterns.js
`LIVEN.PAT` — огонь врагов этапов; `LIVEN.BOSSES[id] = { n:{ru,en}, look, home, cards:[{ n:{ru,en}, hp, time, bonus, mv:'c'|'s'|'d', f(G,b,dt) }] }`.
API узоров `G`: `fire(x,y,a,s)`, `ring`, `fan`, `aim`, `N(n)` (плотность), `R(iv)` (темп), `every(o,key,iv,dt)`, `sp0()` → `SP{k,c,w,ac,st,rt,ra,rs,f,bn}`, `rnd`.
Помощники `LIVEN.flower`, `LIVEN.star`.

## js/stages.js
`LIVEN.STAGES[{ n:{ru,en}, sky, ev:[волна | {t,boss,mid}] }]`, `LIVEN.expandScript(stage)`.

## js/render.js — `LIVEN.render`
`draw(ctx,g,S,{best,banner,touch,fps,noHero,noPanel})`, `field`, `update(dt)`, частицы `spawn/pop/wave/flash/shake/clearFx`,
палитры `PM` (modern) / `PR` (retro), `ringer(ctx,P,look,x,y,s,t,hit)`, `shuttle(ctx,P,h,t)`, `txt`, `spriteM/spriteR`.
Тексты — только через `g.t()`; retro — поле в 200×300 с растяжением без сглаживания.

## js/main.js
`Arcade.createGame({gameId:'liven'})`, `useStandardScreens`, пункты меню `diff`/`form`, рекорды по сложности,
титул с живыми перезвонами за панелью, ввод (клавиатура, палец/мышь — относительное ведение, тач-кнопки ФОКУС/РАЗРЯД/II).
Отладка/QA: `LIVEN.g`, `LIVEN.app.game()`, `LIVEN.app.setDiff(d)`, `LIVEN.app.newGame()`, `LIVEN.showFps = true`.

## Definition of Done
- `node liven/tests/engine.test.mjs` — все тесты зелёные (включая бота); `node tools/smoke.mjs` — PASS liven.
- В браузере: титул → игра (Enter) → пауза (P) → T/L/M работают; 0 ошибок консоли.
