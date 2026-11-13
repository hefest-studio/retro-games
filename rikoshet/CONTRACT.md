# РИКОШЕТ — контракт модулей

Игра аркады «Гефест» на фреймворке Гефест Arcade v2.2 (`engine.js`). Общий стандарт: офлайн, `file://`, без внешних
URL/шрифтов/ассетов, RU/EN, темы modern/retro (меняют только отрисовку), WebAudio-звук, рекорды в `localStorage`.
Права: название, сеттинг (наковальня и заклёпка мастерской «Гефест»), рисунки 30 стен, механизмы-боссы, арт обеих тем,
звуки и музыка — оригинальные; чужих имён и терминов нет (тест «Правило имён»).

## js/levels.js
`RIK.LEVELS[30]` — `{ id, rows[≤16 строк по 16 клеток], boss? }`; легенда клеток — в шапке файла.
`RIK.genLevel(n, rng)` — симметричная случайная стена «Бесконечного» (проверяется `logic.reach`).

## js/game.js — `RIK.Game(opts)` (без DOM, детерминирована при заданном `rng`)
`opts`: `{ mode:'campaign'|'endless', level=1, lives=3, rng, onEvent(type,data), rowsFor(n) (тесты), noPrizes, prizeMul, autoLaunch=true }`.

Поле 640×480: HUD 32, стены x 16/624, потолок y 48, сетка блоков 16×16 по 38×16 с y 64, ракетка y 440 (высота 12,
ширины 60/84/112/140), шар R=5, барьер y 466. Внутренний шаг 1/120 с.

API: `start()` · `update(dt)` (накопитель фикс-шагов) · `tick(dt)` (один шаг) · `setPointer(x|null)` · `setDir(-1|0|1)` ·
`setFire(bool)` (удержание — очередь лазеров) · `action()` (запуск/отпуск шаров, выстрел) · `state()` → S.
Тестовые хуки: `_apply(k)`, `_damage(b,n)`, `_ball(x,y,vx,vy)`, `_moveBall(b,dt)`, `_paddleBounce(b)`, `_load(n)`, `_hitBoss(n)`, `_zap()`.

`S`: `mode, level, score, lives, phase('play'|'lost'|'clear'|'won'|'over'), time, levelTime, over, won,
bricks[{c,r,x,y,w,h,type:'n'|'s'|'u'|'x'|'m'|'r'|'k'|'g',hp,maxHp,color,alive,req,regenT,vx}], grid, movers,
balls[{x,y,vx,vy,t,stuck,bounces,trail}], prizes[{k,x,y,bad}], bolts, shots, beams, boss{kind,x,y,w,h,hp,maxHp,inv,dead},
paddle{x,w,size,vx,stun}, fx{L,C,F,W,Q,H} (секунды), keysLeft, reqLeft, base, cap, stats{broken,paddleHits,nudges,lost,prizes,zaps}`.

События `onEvent`: `level{level,boss}`, `launch`, `paddle{off}`, `wall`, `barrier`, `hit{hp}`, `clank`, `break{type,color,pts}`,
`boom`, `regrow`, `gates`, `nudge`, `stick`, `laser`, `catch{k,bad}`, `shot`, `beamWarn`, `beam`, `zap`, `bossHit{hp}`, `bossDie`,
`lose{lives}`, `respawn`, `clear{level,bonus}`, `win{score}`, `gameover{score}`.

Правила:
- **Скорость** `min(cap, base + 6·t)·k`, `base = 290 + min(70, 2.4·n)`, `cap = 520 + min(110, 4·n)` (в «Бесконечном» n×1.4);
  k = 0.7 (медленнее) / 1.3 (быстрее).
- **Ракетка:** угол = смещение·60°, закрут `0.12·v_ракетки` (≤ 0.3 скорости), угол ≤ 70°; указатель — до 2600 px/с, клавиши — 620 px/с.
- **Анти-петли:** |vy| ≥ 0.26·скорость после отскоков; 18 отскоков или 14 с без прогресса → поворот на 10–25°.
- **Очки:** блок 50, прочный 60·прочность, бочонок 80, движущийся 120, живая руда 70, ключ 200, приз 50,
  удар по боссу 100, босс 5000, стена 1000 + 100·номер, победа в кампании +2000·жизни.
- **Призы:** шанс 13% (на стенах с боссом 20%); длительности: лазеры 12 с, липкая 15, огонь 8, медленнее 10, быстрее 8, барьер 12.
  Потеря жизни сбрасывает эффекты и ширину.
- **Боссы** (`BOSSES`): броня 14/22/30, оглушение наковальни 0,7 с и сужение на шаг; стена пройдена, когда механизм повержен.

`RIK.logic`: `K, PTS, PRIZES, DUR, BOSSES, mulberry32, sweepRect(px,py,dx,dy,x0,y0,x1,y1,r), overlap, reach(rows), cellType`.

## Рендер и сборка
`RIK.render.draw(ctx, g, S, {best})` — обе темы (`PM`/`PR`), спрайты блоков кэшируются по (тема, вид, цвет, прочность).
`main.js` — сцены движка (`useStandardScreens`), пункты меню `mode` и `start`, рекорды по режимам (переопределены
`g.loadBest/saveBest`), титул с демо-партией, ввод мышью/пальцем/клавишами. `RIK.app = { g, game(), mode(), setMode, setStart }` — для автотестов.

## tests
`engine.test.mjs` — логика, физика, уровни, имена; `bot.mjs` — `playRik(RIK, seed, opts)`: «человеческий» (реакция 150–250 мс)
и «идеальный» боты на том же вводе, что у игрока.
