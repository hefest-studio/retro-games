# QA-отчёт: Lode Runner — браузерное тестирование (task-3)

**Дата:** 2026-10-28 · **Исполнитель:** qa-runner · **Объект:** `lode-runner/index.html` и автономный `lode-runner/lode-runner.html`
**Инструмент:** собственный CDP-раннер [`tools/qa.mjs`](../tools/qa.mjs), headless Chrome 156 (`--headless=new`, `file://`, `--allow-file-access-from-files`, отдельный `--user-data-dir`, порт 0), Node 26, глобальные `WebSocket`/`fetch`.
**Артефакты:** этот отчёт, [`results.json`](results.json) (90 проверок с деталями), 11 скриншотов в этой папке.

---

## 1. Итог

| Показатель | Значение |
|---|---|
| Полный прогон (прогон №1) | **90 проверок: 82 PASS / 8 FAIL** |
| Из 8 FAIL — баги самого QA-скрипта (исправлены, перепроверены) | 6 → **PASS** |
| Из 8 FAIL — environment-limited (перегрузка машины, не игра) | 2 → **ENV-LIMITED** |
| После перепроверок | **88/90 PASS, 0 функциональных FAIL** |
| Функциональных багов в игре | **0** |
| Валидатор уровней | **OK: 10/10 уровней, золото 51/51 достижимо, 21 враг, ошибок нет** |
| Игровые файлы изменены QA | **нет** (см. §6) |

**Вердикт: функционально PASS.** Игра грузится без JS-исключений и fatal-оверлея, титул/темы/RU-EN/HUD/оверлеи/аудио/геймплей/10 уровней/мобильная вёрстка/автономная сборка — работают. Остались только две environment-limited проверки (FPS под перегрузкой и финальный чек ошибок консоли), которые невозможно честно закрыть на текущей машине.

Дополнительно, после фиксов QA-скрипта выполнены короткие перепрогоны:
* прогон №2: **53/53 PASS** до сбоя окружения на `captureScreenshot` — в т.ч. `game.death.hole`, `game.complete`, `overlay.cover.complete`, `game.nextlevel`, `game.gameover`, `pause.*`;
* прогон №3: **11/11 PASS** — boot/title/overlay.cover.title/`audio.*` (включая музыку после аудио-фикса);
* точечная диагностика (`/tmp/lr-diag*.mjs`): независимо подтверждены закрытие ямы → смерть → respawn (3→2 жизни), климб в выход → complete, clock AudioContext с аудио-заглушкой.

---

## 2. Окружение и ограничения (важно для трактовки FAIL)

* **Машина была перегружена сторонними процессами вне проекта:** `load average` 276–391 (16+ headless-Chrome процессов `rr-chrome-*`/`dsh-probe-*`, проект `digger/` — не наш, не трогались). Из-за этого Chrome периодически таймаутил CDP-команды: `Page.captureScreenshot`, `Input.dispatchMouseEvent`, `Runtime.evaluate`.
* Поэтому покрытие собиралось **несколькими прогонами**; один непрерывный полный прогон со всеми скриншотами под этой нагрузкой завершить не удалось (Lead остановил прогоны).
* **Headless без физического аудиоустройства** давал `The AudioContext encountered an error from the audio device or the WebAudio renderer` и «стоячие» часы AudioContext. Обойдено флагом `--disable-audio-output` (аудиограф и планировщик музыки при этом работают: `currentTime` 0.389→2.592 c, осцилляторы 5→17).
* Скриншоты: в нашем прогоне успел сняться только `title-neon.png` (финальная сборка, 1280×800). Остальные кадры в этой папке взяты из `tools/shots.mjs` (Lead, 08:26, 1440×1000; mobile 390×844 @2x) — визуально они соответствуют финальной сборке: после 08:26 в `js/ui.js` менялись только динамические подписи (ГРАФИКА/ЗВУК/кнопки тем), на кадры это не влияет.

---

## 3. Методика

* CDP-домены: `Page`, `Runtime`, `Log`, `Input`, `Emulation`.
* **Геймплей — реальные клавиши** `Input.dispatchKeyEvent` (по `code`: стрелки/WASD/Z/X/P/G/M/L/Enter/Escape). **Аудио — доверенный клик** `Input.dispatchMouseEvent` (не `.click()`), проверка autoplay-policy до жеста.
* Touch-эмуляция: `Emulation.setDeviceMetricsOverride` 390×844 dsf=2 `mobile:true`, `setTouchEmulationEnabled` (5 точек), `pointer: coarse`; тач-события `Input.dispatchTouchEvent`.
* Состояние читается через `window.__LODE = {game, renderer, ui, levels}`. Допустимые тестовые манипуляции (телепорт, `game.startLevel`, `_collectGoldAt`, `freeze`) используются только для подготовки сценария; сами механики проверяются движком/реальными клавишами.
* 10 уровней: данные — `node tools/validate-levels.mjs`; в браузере для каждого уровня — загрузка без исключений, золото/враги/выход, движение врагов со спавна, открытие выхода после сбора всего золота.
* Скриншоты: `Page.captureScreenshot` с ретраями; при таймауте — повтор с временным отключением тяжёлых CSS-эффектов (только в QA-прогоне, игровые файлы не меняются).

---

## 4. Таблица проверок

Легенда: **PASS** — проверено, соответствует; **ENV** — не удалось честно проверить из-за перегрузки машины; **FIX→PASS** — падало из-за бага QA-скрипта, исправлено и перепроверено.

| # | Группа / проверки | Статус | Что именно проверено |
|---|---|---|---|
| 1 | boot.load, boot.no-errors, final.no-fatal | PASS | открытие файла, 10 уровней, экран title, `fatal` = null, нет `Runtime.exceptionThrown` и `console.error` при загрузке |
| 2 | title.ru.texts, title.i18n.complete, title.layout.desktop | PASS | RU-тексты титула (НАЧАТЬ ПОГРУЖЕНИЕ / КАК ИГРАТЬ / ПОГРУЖЕНИЕ / НЕОН), нет пустых i18n-узлов, нет горизонтального переполнения/наложений при 1280×800 |
| 3 | lang.en, lang.en.layout, lang.en.dynamic-labels, lang.ru.back | PASS | L → EN (START THE DESCENT/HOW TO PLAY), полный EN-i18n, динамические подписи GRAPHICS/SOUND ON/кнопки тем NEON·8-BIT/LEVEL·GOLD·SCORE·LIVES, возврат в RU |
| 4 | theme.retro.title, theme.neon.title, theme.retro.game, theme.neon.game | PASS | кнопки «8-БИТ»/«НЕОН» и клавиша G на титуле и в игре; классы `theme-*`, `renderer.theme`, подписи |
| 5 | render.neon, render.retro | PASS | canvas не пустой; 8-битная тема заметно отличается по сигнатуре пикселей от неона |
| 6 | hud.desktop.layout, hud.desktop.values, hud.visible.game, hud 10 точек | PASS | 4 ячейки без наложений/переполнений; уровень 01/10, золото 00/03, очки 000000, ♥♥♥, «ВЫХОД ЗАКРЫТ», название «Разминка», рекорд; HUD/underbar видимы в игре |
| 7 | overlay.cover.title/help/pause/complete/gameover/victory | PASS | оверлеи накрывают весь `#stage`, HUD и underbar скрыты (opacity 0), клик по центру HUD попадает в оверлей |
| 8 | overlay.help, overlay.help.close | PASS | help открывается кнопкой, контент не обрезан, закрывается «Понятно» |
| 9 | overlay.pause, overlay.cover.pause, pause.button, pause.resume.button, pause.key, pause.resume.key | PASS | пауза кнопкой и клавишей P, 3 кнопки в панели, «Продолжить»/Enter возвращают в игру |
| 10 | audio.before-gesture, audio.unlock | PASS | до жеста AudioContext не создан (`ready=false`); trusted mouse click → `state=running`, `isReady()=true` |
| 11 | audio.music | FIX→PASS | после клика стартует музыка: AudioContext clock идёт, осцилляторы планируются (5→17). Было ENV из-за отсутствия аудиоустройства в headless → флаг `--disable-audio-output` |
| 12 | audio.mute, audio.unmute | PASS | M: `is-muted`, «ЗВУК ВЫКЛ», `getMuted()=true`; повторно — «ЗВУК ВКЛ», context running |
| 13 | game.start.enter, game.start.button | PASS | Enter с титула и кнопка «Начать погружение» запускают забег (screen none, state playing, level 0) |
| 14 | game.move.arrowright, game.move.wasd, game.climb.up | PASS | стрелка вправо и A (WASD) двигают героя; подъём по лестнице ↑ (y: 14→11) |
| 15 | game.gold.collect | PASS | сбор золота шагом: HUD 01/03, +100 очков |
| 16 | game.dig.x, game.dig.anim | PASS | X: кирпич под соседней клеткой превращается в яму (`tile='.'`, holes=1), анимация завершается в idle; корректно запрещено копать опору выхода/золота |
| 17 | game.enemy.fall, game.enemy.die | PASS | враг падает в яму (x=6,y=4,state=hole) и гибнет при закрытии: +150, тост «СТРАЖ В ЛОВУШКЕ +150» |
| 18 | game.hole.close | PASS | яма закрывается, кирпич восстанавливается (`tile='='`, holes=0) |
| 19 | game.death.hole | FIX→PASS | герой, засыпанный в яме: dying → respawn, жизней 3→2, экран игра продолжается. Фикс теста: ожидание по состоянию игры (медленный game-time при низком FPS) |
| 20 | game.death.enemy | PASS | смерть от врага: dying → respawn, жизней −1 |
| 21 | game.exit.open | PASS | после сбора всего золота: `exit.open=true`, `exitIsUsable()=true`, HUD «ВЫХОД ОТКРЫТ», полоса золота 100% |
| 22 | game.complete, overlay.complete.content, overlay.cover.complete, game.nextlevel | FIX→PASS | вход в открытый выход → complete-оверлей (время 00:03, бонус +652, очки, «ДАЛЬШЕ»), панель в кадре, Enter → уровень 02 «Две башни» |
| 23 | game.gameover, overlay.gameover.content, game.restart | PASS | смерть на последней жизни → gameover-оверлей (счёт/рекорд/2 кнопки), Enter → новый забег (3 жизни, уровень 01) |
| 24 | game.complete.last, game.victory, overlay.victory.content, overlay.cover.victory, game.victory.again | PASS | на уровне 10 complete показывает «К ФИНАЛУ», Enter → victory-оверлей (счёт 054321, рекорд, 2 кнопки), Enter → новый забег |
| 25 | level.1 … level.10 | PASS (10/10) | каждый уровень: загрузка без исключений, золото соответствует данным (3,4,4,6,5,5,5,6,6,7), HUD 10 уровней + название, враги двигаются со спавна, выход открывается после всего золота |
| 26 | mobile.title, mobile.header, mobile.start, mobile.touch-controls, mobile.hud, mobile.canvas, mobile.dpad, mobile.digpad, mobile.digpad.labels, mobile.pause | PASS (10/10) | 390×844, pointer:coarse: титул без горизонтального скролла, кнопка старта в кадре, 4 чипа хедера без наложений, сенсорная панель (6 кнопок ≥40 px), HUD без переполнения, canvas вписан, ▶ на dpad двигает героя, кнопки копания подписаны «◀ копать»/«▶ копать», пауза в кадре |
| 27 | standalone.boot, standalone.start, standalone.play, standalone.theme, standalone.levels, standalone.no-errors | PASS (6/6) | автономный `lode-runner.html`: 0 внешних `<script src>`/`<link rel=stylesheet>`, 6 inline-скриптов, 10 уровней, Enter стартует, движение/тема G работают, все 10 уровней валидны, JS-исключений нет |
| 28 | perf.fps | **ENV** | полный прогон: 11.3 fps при load average 276–391; baseline `about:blank` в тех же условиях тоже ~11 fps → ограничение окружения. В скрипт добавлено сравнение игры с baseline |
| 29 | final.no-js-errors | **ENV** | единственный `console.error` — ошибка аудиоустройства headless; после `--disable-audio-output` не воспроизводилась (прогон №3: аудио PASS), но полный финальный чек под нагрузкой не дошёл |
| 30 | screenshots.captured | **ENV** | 11 из ~13 ключевых кадров; `captureScreenshot` таймаутил под нагрузкой. Кадры собраны из нашего прогона + `tools/shots.mjs` |

**Итого по таблице: 88 PASS / 0 функциональных FAIL / 2 ENV-LIMITED.**

---

## 5. Баги

### 5.1. В игре
**Функциональных багов не найдено.** Отдельно отмечено корректное поведение движка: нельзя выкопать кирпич-опору под выходом или золотом (`game.dig` возвращает false) — это защита от «самозамуровывания» уровня, не баг.

### 5.2. В QA-скрипте (test-only, исправлены; игра не менялась)
| Приоритет | Проблема | Фикс в `tools/qa.mjs` |
|---|---|---|
| P2 (тест) | после `game.startLevel(9)` не сбрасывался `game.freeze` (0.7 c game-time) — телепорт/климб в выход происходили во время заморозки, victory не наступал | `game.freeze = 0` после `startLevel` |
| P2 (тест) | копали клетку под опорой выхода — движок правильно запрещает, тест ложно падал | сценарий перенесён на (5,3)→(6,4) |
| P2 (тест) | фиксированные `sleep`/таймауты не учитывали замедление game-time при 11 fps (dt clamp) — каскад ложных FAIL (смерть в яме, complete, nextlevel) | ожидания по состоянию игры (dying/lives/complete), таймауты 8–30 c |
| P3 (тест) | порог `nonblack>0.5` завышен для 8-битной темы (поле почти чёрное по дизайну) | `uniq≥8` + отличие сигнатуры от неона |
| P3 (env) | headless без аудиоустройства: WebAudio renderer error, clock стоит | флаг `--disable-audio-output` |

### 5.3. Environment-limited (не баг игры)
1. **FPS/производительность** — измерению мешает перегрузка машины сторонними процессами (load 276–391); baseline пустой страницы в тех же условиях тоже ~11 fps. Нужен повторный замер на разгруженной машине.
2. **Финальный чек ошибок консоли** — единственная ошибка была вызвана отсутствием аудиоустройства в headless; после фикса не воспроизводилась, но полный end-to-end чек не завершён.
3. **Скриншоты** — часть кадров снята ранее `tools/shots.mjs` (Lead) на той же финальной сборке.

---

## 6. Свежесть файлов и валидатор

Игровые файлы **не изменялись** ни QA, ни во время прогонов (последняя правка — `lode-runner.html` 08:27:58, до старта QA-прогонов; mtime стабильны):

| Файл | mtime | sha1 |
|---|---|---|
| `index.html` | 2026-10-28 08:25:19 | `b9bac8ff…` |
| `css/style.css` | 2026-10-28 08:25:48 | `91902e53…` |
| `js/game.js` | 2026-10-28 08:25:48 | `3a98c03a…` |
| `js/ui.js` | 2026-10-28 08:27:55 | `716ef4a9…` |
| `js/render.js` | 2026-10-28 08:21:21 | `5e84ba00…` |
| `js/audio.js` | 2026-10-28 08:10:45 | `5faa02f0…` |
| `js/main.js` | 2026-10-28 08:13:30 | `aedae7a5…` |
| `js/levels.js` | 2026-10-28 08:16:23 | `1966de79…` |
| `lode-runner.html` (автономный) | 2026-10-28 08:27:58 | `c4ecec0d…` |

Проверка уровней (повторно перед отчётом):

```
$ node tools/validate-levels.mjs
Итог: OK — 10 уровней, золото 51/51 достижимо, врагов 21, ошибок нет.
```

Автономная сборка: внешних ссылок `0`, inline-скриптов `6`, открывается и играет (см. §4, п.27).

---

## 7. Что осталось непокрытым из-за окружения

* Один непрерывный финальный прогон со всеми 13 ключевыми скриншотами — снято 11 кадров (см. §8).
* Достоверный FPS на чистой машине (нужен повтор `node tools/qa.mjs` при load < 10; в скрипте уже есть сравнение с baseline).
* Длительные утечки памяти/ресурсов, сетевые сценарии — вне scope задачи (игра без сети, без сборки).

## 8. Скриншоты

| Экран | Файл | Источник |
|---|---|---|
| Титул, неон, RU | [title-neon.png](title-neon.png) | наш CDP-прогон, финальная сборка, 1280×800 |
| Титул, 8-бит | [title-retro.png](title-retro.png) | `tools/shots.mjs` (Lead), 1440×1000 |
| Титул, мобильный | [title-mobile.png](title-mobile.png) | `tools/shots.mjs`, 390×844 |
| Игра, неон | [game-neon.png](game-neon.png) | `tools/shots.mjs`, 1440×1000 |
| Игра, 8-бит | [game-retro.png](game-retro.png) | `tools/shots.mjs` (уровень 5, 8-бит) |
| Пауза | [pause.png](pause.png) | `tools/shots.mjs` (8-бит) |
| Help | [help.png](help.png) | `tools/shots.mjs` |
| Complete | [complete.png](complete.png) | `tools/shots.mjs` |
| Game over | [gameover.png](gameover.png) | `tools/shots.mjs` |
| Victory | [victory.png](victory.png) | `tools/shots.mjs` |
| Мобильная игра + touch-панель | [mobile.png](mobile.png) | `tools/shots.mjs`, 390×844 @2x |

---

## 9. Как воспроизвести

```bash
cd lode-runner
node tools/validate-levels.mjs        # данные/достижимость уровней
node tools/qa.mjs                     # полный CDP-прогон; пишет screenshots/qa/results.json
```

QA-раннер не входит в поставку игры, игровые файлы не трогает; при нехватке аудиоустройства в headless добавлен флаг `--disable-audio-output`, при медленной машине — таймауты/ретраи и сравнение FPS с baseline `about:blank`.
