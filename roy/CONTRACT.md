# РОЙ — HTML5: контракт модулей

Оригинальная игра студии **«Гефест»** (жанр: вертикальный шутер со строем пришельцев).
Открывается как `roy/index.html` по `file://` — **без сборки, CDN, npm и интернета**.
Весь контент рисуется/синтезируется кодом. Названия, спрайты, звуки — оригинальные;
ассеты, имена и узнаваемый вид чужих игр не используются.

## Файлы и порядок подключения
| Файл | Роль |
|---|---|
| `engine.js` | копия `_shared/engine.js` (фреймворк v2), обновляется `build.sh` |
| `js/i18n.js` | `ROY.STR` — RU/EN строки (ключи движка + игры) |
| `js/audio.js` | `ROY.sfx(g, type, data)` — SFX на `g.audio.beep` |
| `js/game.js` | `ROY.Game(opts)` — DOM-free логика, `ROY.consts` |
| `js/classic.js` | `ROY.classic.{bg,draw,icon}` — рендер retro (пиксель-спрайты) |
| `js/modern.js` | `ROY.modern.{bg,draw,icon}` — рендер modern (вектор) |
| `js/ui.js` | `ROY.ui.init(g)` — подгонка canvas, локализация DOM, кнопка паузы |
| `js/main.js` | сборка: `Arcade.createGame`, `useStandardScreens`, сцена `play` |

## ROY.Game(opts)
- `opts`: `rng` (детерминизм), `onEvent(type,data)`, `lives` (3), `diff(base,step,max)` (в игре — `g.difficulty`, уровень = волна), `startWave`.
- Методы: `start()`, `update(dt)` (подшаги ≤1/120 с), `setDir(-1|0|1)`, `setFire(bool)`, `fire()`, `state()`, `params()`, `isOver()`.
- События: `wave, start, shoot, eshoot, dive, beam, captured, release, rescue, lost, hurt, kill{x,y,kind,pts}, hull, die, respawn, clear, win, gameover`.
- Состояние (`state()`): `wave/waves, score, lives, phase(intro|fight|clear), banner, enemies[{kind,row,col,state(wait|enter|form|dive|return|dead),sub,x,y,ang,hp,hurt,carry,beamT}], pb[], eb[], player{x,alive,dual,inv}, captive, rescue`.

## Правила
- 5 волн (`LAYOUTS`, 18→36 врагов); после 5-й — `win`; 0 кораблей — `gameover`.
- Сложность по волне: частота и число пике, скорость пике и пуль, шанс выстрела; стрельба из строя — с 2-й волны; при ≤4 врагах пике чаще.
- Тема меняет только отрисовку; логика и состояние общие.

## Definition of Done
- `node roy/tests/engine.test.mjs` — все тесты проходят.
- В браузере: меню → Enter → игра, Space — огонь, T/L/P работают, 0 ошибок консоли; `node tools/smoke.mjs` — PASS для `roy`.
