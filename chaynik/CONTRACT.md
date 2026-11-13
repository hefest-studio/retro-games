# ЧАЙНИК — контракт модулей

Игра аркады «Гефест» на фреймворке Гефест Arcade v2.2 (`engine.js`). Общий стандарт: офлайн, `file://`, без внешних
URL/шрифтов/ассетов, RU/EN, темы modern/retro (меняют только отрисовку), WebAudio-звук, рекорд в `localStorage`
(`arcade.best.chaynik`). Права: название, герой (заводной Чайник), Сервиз, враги, уровни, арт, палитры, звуки и музыка —
оригинальные; чужих имён и терминов нет (тест «правило имён», стоп-лист в base64).

## js/levels.js — `CHAYNIK.levels`
`T = 16` px. Коды клеток `C`: `E` пусто, `S` твердь, `P` полка (твёрда сверху, ↓+прыжок — спрыгнуть), `F` конфорка
(ожог, может мигать — `cycle{c0,c1,r,per,on,ph}`), `X` вилки-шипы (твердь, ранят и подбрасывают), `W` стенка чашки.
`KINDS = {1:'plat',2:'race',3:'plat',4:'puzzle',5:'fly',6:'boss'}`, `COUNT = 6`.
`build(n)` (для 1, 3, 6) → `{ n, kind, w, h, t: Uint8Array, start{x,y}, goal{x,y,k:'hole'|'raft'}, hooks[{id,x,y}],
taps[{id,x,y,len}], magnets[{id,x,y}], items[{id,k:'sugar'|'leaf'|'heart',x,y}], enemies[{id,k,x,y,x0?,x1?}], cps[{id,x,y}],
bubbles[{id,x0,x1,y0,y1}], signs[{x,y,key}], cycle[], bgKind, water?, surface?, arena?{x0,x1,floor} }`.
`raceTrack()` → `{ len, step, ys: Float32Array (высота скатерти), obs[{id,k,x,w,h?}], rival{v[[x,скорость]],trips[[x,с]]} }`,
препятствия `crumb|shaker|jam|hole|spoon|tap|sugar|leaf`. `PUZZLE = { limit, burnPer, burnOn, map[] }`
(`#` стена · `.` пол · `,` крошка · `o` чашка · `B` конфорка · `Z` будильник · `S` сахарок · `G` чашка-цель · `P` чайник · `W` кран).
`FLY = { len, cp, waves[{t,k,y,n?,gap?}] }`, `k`: `fly|moth|pop|bee|cloud|leaf|heart`.

## js/game.js — `CHAYNIK.Game(opts)` (без DOM; состояние — чистый JSON, детерминировано при `seed`)
`opts`: `{ seed, level=1, lives=3, continues=2, onEvent(type,data), god (тесты: без урона) }`.
API: `start()` · `update(dt)` (шаг 1/60) · `setInput({x,y,jump,fire,boil})` (кнопки — «зажато», фронты ловятся внутри) ·
`state()` → S · `level()` → карта · `continueGame()` · `restartLevel()` · `puzzleReset()` · `snapshot()`/`restore(json)` ·
`mute(on)`. Тест-хуки: `_goLevel(n)`, `_place(x,y)`, `_die(kind)`, `_hurt(n,x)`, `_pz(act)`, `_clear()`, `_charge(v)`.

`S`: `level, kind, phase('play'|'dead'|'clear'|'over'|'won'), phaseT, t, lvT, score, lives, cont, heat(0..1), over
(перегрев), charge(0..1), warm (тепло, ур. 3), hero, enemies[], puffs[] (пар/кипяток), eshots[], drops[], got{id}, magOff{id},
cp, idleStage(0..3), deathKind, race | pz | fly | boss, lastClear`.
Герой `hero`: `{ x, y (подошвы), vx, vy, ground, face, hp, inv, hook{ax,ay,L,th,w}|null, aim('f'|'u'|'d'), firing, water, idle }`.

Правила:
- **Физика** (px, с): g = 1500, бег 170, прыжок 520 (≈ 90 px), отпустил — срез до 240, койот 0,08, буфер 0,12.
  В воде: g = 520, падение ≤ 120, бег 120, прыжок с опоры 300, гребок 90 раз в 0,6 с (тратит тепло).
- **Пар**: облачко каждые 0,05 с, 380 px/с, 0,24 с (под водой 250 px/с, 0,15 с), урон 0,35. Жар +0,42/с при стрельбе
  (под водой ×2), остывание 0,32/с через 0,25 с (в перегреве 0,45/с), у крана ещё −1,8/с; перегрев при 1, снова можно при 0,25.
- **Кипяток**: заряд +0,07/с без стрельбы (на боссе +0,16/с), лист +0,34; выстрел 430 px/с, 0,7 с, урон 5, насквозь, +0,35 жара.
- **Хват**: радиус 48 от руки, длина 30–76, раскачка ±7 рад/с² в такт, отпуск прыжком: скорость маятника + 230 вверх.
- **Магнит**: тянет в радиусе 120 (до 3200 px/с² у центра), касание (< 20) — смерть `magnet`; кипяток выключает (+400).
- **Конфорка**: −1 давление и подброс 600; на последнем давлении — `boil`. Вилки: −1 и подброс 420. Падение — `fall`.
- **Уровень 3**: тепло −1/40 в секунду (стрельба −0,08/с), пузыри +0,6/с и тянут вверх до 175 px/с; 0 — `cold`.
- **Гонка**: склон 900·sin, сопротивление 0,0008·v², ←/→ — тормоз/наклон, пар +300 (жар ×1,3), предел 500 px/с;
  крошка ×0,55, солонка — авария 0,9 с, варенье вязнет, прорехи — откат на 260 px; соперник — профиль скоростей и 2 запинки.
  Финиш раньше перечницы — уровень пройден (бонус за отрыв), иначе — `race` (жизнь).
- **Головоломка** (`CHAYNIK.puzzle`: `parse`, `step(B,s,act)`, `solve(B)`, `burnOn`) — чистые правила, общие для игры и тестов.
- **Полёт**: 190/170 px/с, пар вперёд 520 px/с (жар ×0,85), облака холода, контрольная точка на 42-й секунде,
  на 84-й — Мухобойка (26 ед.; урон пара ×2 во время удара, кипяток 8).
- **Сервиз**: Сахарница 4, Заварник 5, Молочник 4 трещины. Пар — нагрев +0,15 (остывает 0,15/с), кипяток — трещина
  (по горячему ≥ 0,5 — две). Заварник под защитой, пока живы двое (кипяток проходит сквозь). Потом — прыжки и волны.
- Очки: сахар 50, лист 20, враги 100–300, трещина 300, осколки 3000, уровень: 1000 + время (до «нормы») ×20 + 2000 без потерь.

События `onEvent`: `level{n,kind}`, `jump`, `land`, `stroke`, `steam`, `overheat`, `cooled`, `tap`, `boil`, `noCharge`,
`grab`, `release`, `puffWall`, `kill{k,x,y,pts}`, `enemyHit`, `hop`, `toast`, `splat`, `sugar`, `leaf{full}`, `heart`,
`life`, `cp`, `demag`, `bubble`, `scald`, `hurt{hp}`, `die{kind}`, `respawn`, `idle{stage}`, `clear{level,time,tb,nb}`,
`gameover`, `continue`, `win`; гонка: `count`, `crash`, `bumpCrumb`, `jam`, `spoon`, `holeFall`, `respawnRace`, `rivalTrip`,
`blast`; головоломка: `pz_step|push|squash|pick|puff|blow|cool|clockOff`, `pzBump`, `pzHot`, `pzReset`; полёт: `dive`,
`sting`, `swatter`, `swatAim`, `swat`, `swatHit`, `swatDown`; босс: `ting`, `crack`, `shield`, `shatter`, `stage2`, `lob`,
`squirt`, `spit`, `slam`, `hopBoss`, `lidOut`, `lid`.

## js/render.js — `CHAYNIK.R`
`scene(g, ctx, S, {LV, cam, banner})` — кадр текущего режима + HUD + баннер; `kettle(ctx,x,y,opts)` — герой
(позы, прицел, перегрев, сценки, анимации смертей); `porcelain`, `enemy`, `sugarCube`, `item`, `FX` (частицы и всплывающий текст).

## js/main.js
Сцены движка + своя `cont` («Продолжить?», 10 с). Темы уровней — `g.setMusic(Arcade.tracks['chaynik:N'])` на событии `level`.
`CHAYNIK.app = { g, game(), cam() }` — для отладки и автотестов в браузере.
