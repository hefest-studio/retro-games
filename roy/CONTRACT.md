# РОЙ — HTML5: контракт модулей

Оригинальная игра студии **«Гефест»** (жанр: аркада-стрелялка с цепным огнём). Открывается как `roy/index.html` по `file://` —
**без сборки, CDN, npm и интернета**. Весь контент рисуется/синтезируется кодом; названия, спрайты, звуки — свои.

## Файлы и порядок подключения
| Файл | Роль |
|---|---|
| `engine.js` | копия `_shared/engine.js` (фреймворк v2), обновляется `build.sh` |
| `js/music.js` | трек `Arcade.tracks.roy` |
| `js/i18n.js` | `ROY.STR` — RU/EN/TR/ES/PT (ключи движка + игры) |
| `js/audio.js` | `ROY.sfx(g, type, data)` — SFX на `g.audio.beep` |
| `js/game.js` | `ROY.Game(opts)` — DOM-free логика, `ROY.consts`, `ROY.migrate(localStorage)` |
| `js/ui.js` | `ROY.ui` — подгонка canvas, DOM-подписи, кнопка паузы; общий HUD, подсказки, баннеры, «цепь ×N» |
| `js/classic.js` / `js/modern.js` | `ROY.classic` / `ROY.modern` = `{ P, bg, draw(ctx, S, g, {bare}), icon }` |
| `js/stick.js` | копия `otsek/js/stick.js` (тач-стик) |
| `js/main.js` | сборка: `Arcade.createGame`, стандартные экраны, заставка, сцены `play` и `card`, ввод, площадка |

## ROY.Game(opts)
- `opts`: `rng`, `onEvent(type, data)`, `lives` (3), `diff(base, step, max)` (в игре — `g.difficulty`, уровень = волна), `startWave`.
- Методы: `start()`, `update(dt)` (подшаги ≤ 1/60 с), `setDir(dx, dy)` (−1…1), `setFire(bool)`, `fire()`, `lure()`, `reviveAd()`,
  `canBoost()`, `boost()`, `state()`, `params()`, `isOver()`.
- События: `wave, start, shoot, ignite{x,y,kind,n,pts}, crack, burnout, chain{n,pts}, lure, burst, fizzle, qhurt, queen{pts}, lay, spit,
  warn, surge, die{cause}, respawn, life, clear{wave,pts}, win, gameover`.
- Состояние: `wave/waves, score, lives, phase(intro|fight|clear), banner, tip(tut1…tut4), drones[{kind,state(live|burn|dead),shell,crackT,burnT,x,y}],
  queen{x,y,hp,max,alive,warn,hurtT}, sparks[], spores[], lure{x,y,state(fly|hover),t}, surge, player{x,y,alive,inv,charges,lureCd}, lastChain`.

## Правила
- Огонь: горит 0,5 с, с 0,12 с поджигает живых в радиусе `IGN` = 30 px (пороховик ×1,9); панцирь — первый огонь срывает
  (0,6 с иммунитет), второй поджигает. Очки — `pts × min(место в цепи, 20)`, цепь ≥ 8 — бонус `n × 20`.
- Манок: летит вверх 330 px/с до `max(150, y − 200)`, висит 3,6 с; живые в радиусе 430 px сбиваются к нему (дистанция 15 вместо 34);
  искра в висящий манок — вспышка радиусом 64 px (+2 урона Матке рядом). Откат 6 с.
- Матка: −1 за искру, −1 за каждую горящую рядом; погашена — бонус `300 + 200 × волна` и вспышка 90 px; волна отбита, когда Матки нет и рой сгорел.
- 5 волн (`WAVE_DEF`); после 5-й — `win`; 0 кораблей — `gameover`. Тема меняет только отрисовку.

## Definition of Done
- `node roy/tests/engine.test.mjs` — все тесты проходят; `node tools/smoke.mjs` — PASS для `roy`.
- В браузере: меню → Enter → игра, Space — искра, X — манок, T/L/P работают, 0 ошибок консоли.
