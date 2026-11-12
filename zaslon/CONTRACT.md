# ЗАСЛОН — HTML5: контракт модулей

Оригинальная игра студии **«Гефест»** (жанр: вертикальный скролл-шутер с прокачкой и мастерской).
Открывается как `zaslon/index.html` по `file://` — **без сборки, CDN, npm и интернета**.
Весь контент рисуется/синтезируется кодом. Названия, спрайты, звуки, музыка — оригинальные;
ассеты, имена и узнаваемый вид чужих игр не используются.

## Файлы и порядок подключения
| Файл | Роль |
|---|---|
| `engine.js` | копия `_shared/engine.js` (фреймворк v2.2), обновляется `build.sh` |
| `js/music.js` | `Arcade.tracks.zaslon` — оригинальный трек для секвенсора движка |
| `js/i18n.js` | `ZASLON.STR` — RU/EN строки (ключи движка + игры) |
| `js/audio.js` | `ZASLON.sfx(g, type, data)` — SFX на `g.audio.beep` |
| `js/game.js` | `ZASLON.Game(opts)` — DOM-free логика, `ZASLON.consts` |
| `js/classic.js` | `ZASLON.classic` — рендер retro (пиксель-спрайты, блоки 4 px) |
| `js/modern.js` | `ZASLON.modern` — рендер modern (вектор, свечение) |
| `js/ui.js` | `ZASLON.ui` — подгонка canvas, DOM-подписи, тач-кнопки паузы/бомбы; общие HUD, мастерская, тосты |
| `js/main.js` | сборка: `Arcade.createGame`, `useStandardScreens`, титул, сцена `play`, клавиши B/X, тап в мастерской |

Рендеры имеют одинаковый интерфейс: `{ P (палитра), bg(ctx,g,scroll,sector), draw(ctx,S,g), icon(ctx,kind,x,y,g), ship(ctx,x,y,g,o), shopIcon(...), life(...) }`.

## ZASLON.Game(opts)
- `opts`: `rng` (детерминизм), `onEvent(type,data)`, `lives` (3), `diff(base,step,max)` (в игре — `g.difficulty`, уровень = сектор), `startSector`, `scrap`.
- Методы: `start()`, `update(dt)` (подшаги ≤1/120 с), `setDir(x,y)` (−1|0|1), `setFire(bool)`, `bomb()`,
  мастерская — `shopItems()`, `shopMove(±1)`, `shopSelect(i)`, `shopConfirm()`, `buy(key)`, `leaveShop()`, `price(key)`; `state()`, `params()`, `isOver()`.
- События: `start, sector, shoot, ray, eshoot, dive, kill{x,y,kind,pts}, scrap, capsule{type,lv,up|sw|bonus}, breach{x,dmg,base}, baseDown,
  shieldHit, shieldUp, die{src}, respawn, bomb, warn, bossIn, bossHit, spawn, beamWarn, beam, bossDie, clear{bonus,scrap}, shop, buy, deny, shopMove, shopOut, win, gameover{reason}`.
- Состояние: `sector/sectors, phase(intro|waves|warn|boss|clear|shop), score, lives, scrap, base(0..100), banner,
  enemies[{kind,x,y,r,hp,max,pat,hurtT,dead}], boss{kind,x,y,w,h,hp,max,vuln,beam,phaseN}, pb[], eb[], scraps[], caps[{x,y,ty}], booms[],
  player{x,y,alive,inv,shield,shMax,weapon,lv{spark,ray,shot},modules,bombs,ray}, shop{sel}`.

## Правила
- 5 секторов; в каждом 10–18 волн врагов (Клещ, Стриж, Ткач, Таран, Носитель), затем босс: Жернов, Клешня, Улей, Маятник, Горн. После 5-го босса — `win`.
- Враг, дошедший до нижнего края, бьёт заслон (−6…−20%); заслон 0% — `gameover` (причина `base`). Корабли кончились — `gameover` (`ship`).
- Оружие: Искра (веер 3/5/7), Луч (непрерывный, 8/12.5/18 урона в секунду), Дробь (6/8/11 дробин, короткая дальность). Капсула из Носителя меняет вид по кругу: свой вид — уровень +1, чужой — смена оружия. Потеря корабля — уровень текущего оружия −1.
- Энергощит: деления (1, до 3 в мастерской) гасят попадания, восстанавливаются по одному за 9 с. Мега-бомба: чистит пули, 30 урона всем врагам, 22 — боссу.
- Мастерская после секторов 1–4: оружие (60/120), модуль (80/150, до 2), щит (70/130), бомба (35, до 5), починка заслона +25% (40), корабль (150, до 5).
- Тема меняет только отрисовку; логика и состояние общие.

## Definition of Done
- `node zaslon/tests/engine.test.mjs` — все тесты проходят (включая баланс по «человеческому» боту).
- В браузере: меню → Enter → игра, Space — огонь, B/X — бомба, T/L/P/M работают, 0 ошибок консоли; `node tools/smoke.mjs` — PASS для `zaslon`.
