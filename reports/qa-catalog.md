# Приёмка каталога и 11 игр — QA-отчёт (task-3)

- **Дата:** 2026-10-28, исполнитель: `qa-runner`
- **Объект:** стартовая страница-каталог `/` и 11 игр в подпапках воркспейса `retro_games`
- **Вердикт: PASS** — блокирующих и заметных дефектов (P1/P2) не найдено ни локально, ни на проде, ни в режиме `file://`. P1/P2 отсутствуют; есть 4 мелких замечания P3.
- **Локально:** `/usr/bin/python3 -m http.server 8098 --bind 127.0.0.1` в корне воркспейса, `http://127.0.0.1:8098/`
- **Прод:** https://retro-games-psi.vercel.app
- **Инструменты:** Node v26.12.1, Google Chrome (headless, CDP), собственные скрипты `tools/qa/*.mjs` (не `tools/shot.mjs`).
- **Артефакты:** `reports/qa-shots/` (локально + `file://`), `reports/qa-shots/prod/` (прод), JSON-логи рядом.

---

## 1. Как проверялось

Каталог и игры открывались в настоящем headless Chrome через CDP; снимались скриншоты, собирались `console`-ошибки, `pageerror`, сетевые ответы (статусы, внешние домены), вычислялись лейаут-метрики, контраст, доступность и `prefers-reduced-motion`.

```bash
# локальный сервер
python3 -m http.server 8098 --bind 127.0.0.1   # в корне воркспейса

# игры (локально и прод)
node tools/qa/audit-games.mjs --base http://127.0.0.1:8098 \
  --out-dir reports/qa-shots --json reports/qa-shots/games-audit.json
node tools/qa/audit-games.mjs --base https://retro-games-psi.vercel.app \
  --out-dir reports/qa-shots/prod --json reports/qa-shots/prod/games-audit-prod.json

# каталог (локально и прод)
node tools/qa/audit-catalog.mjs --base http://127.0.0.1:8098 \
  --out-dir reports/qa-shots --json reports/qa-shots/catalog-audit.json
node tools/qa/audit-catalog.mjs --base https://retro-games-psi.vercel.app \
  --out-dir reports/qa-shots/prod --json reports/qa-shots/prod/catalog-audit-prod.json

# точечные UX-проверки и file://
node tools/qa/check-catalog-extras.mjs --base http://127.0.0.1:8098 --out-dir reports/qa-shots
node tools/qa/check-catalog-extras.mjs --base https://retro-games-psi.vercel.app --out-dir reports/qa-shots/prod
node tools/qa/check-file-proto.mjs --out-dir reports/qa-shots
```

Скрипты ничего не меняют в сайте: только читают страницу, взаимодействуют с ней в браузере и пишут скриншоты/JSON в `reports/`.

---

## 2. Игры: 11/11 PASS (локально и прод)

Для каждой игры проверено: HTTP 200, непустой `title`, наличие видимого `<canvas>` с ненулевыми размерами, `console`-ошибки, `pageerror`, запросы на внешние домены, горизонтальный скролл на 390 px. Скриншоты — ретро-вид по умолчанию на 1440×900 и мобильный 390×844.

| # | Игра (slug) | HTTP лок. | HTTP прод | Title | Console / page err (лок. / прод) | Canvas | Внеш. запросы | H-scroll 390 | Скриншоты |
|---|-------------|-----------|-----------|-------|----------------------------------|--------|----------------|--------------|-----------|
| 1 | river-raid | 200 | 200 | RIVER RAID · РЕЧНОЙ РЕЙД — HTML5 | 0 / 0 · 0 / 0 | 360×540, painted | 0 / 0 | нет | `qa-shots/river-raid-retro-1440.png`, `…-mobile-390.png` |
| 2 | digger | 200 | 200 | DIGGER · HTML5 | 0 / 0 · 0 / 0 | 960×600, painted | 0 / 0 | нет | `qa-shots/digger-retro-1440.png`, `…-mobile-390.png` |
| 3 | lode-runner | 200 | 200 | LODE RUNNER · Погружение — HTML5 | 0 / 0 · 0 / 0 | 1792×1024, painted | 0 / 0 | нет | `qa-shots/lode-runner-retro-1440.png`, `…-mobile-390.png` |
| 4 | boulder-dash | 200 | 200 | BOULDER DASH · Кристальные глубины | 0 / 0 · 0 / 0 | 1280×704, painted | 0 / 0 | нет | `qa-shots/boulder-dash-retro-1440.png`, `…-mobile-390.png` |
| 5 | contra | 200 | 200 | CONTRA: НЕОНОВЫЙ РАССВЕТ — HTML5 | 0 / 0 · 0 / 0 | 480×270, painted | 0 / 0 | нет | `qa-shots/contra-retro-1440.png`, `…-mobile-390.png` |
| 6 | exolon | 200 | 200 | EXOLON · HTML5 | 0 / 0 · 0 / 0 | 1440×900, painted | 0 / 0 | нет | `qa-shots/exolon-retro-1440.png`, `…-mobile-390.png` |
| 7 | the-last-mission | 200 | 200 | THE LAST MISSION · HTML5 | 0 / 0 · 0 / 0 | 320×200, painted | 0 / 0 | нет | `qa-shots/the-last-mission-retro-1440.png`, `…-mobile-390.png` |
| 8 | silkworm | 200 | 200 | SILKWORM · ШЕЛКОПРЯД · HTML5 | 0 / 0 · 0 / 0 | 320×224, painted | 0 / 0 | нет | `qa-shots/silkworm-retro-1440.png`, `…-mobile-390.png` |
| 9 | lost-vikings | 200 | 200 | ПОТЕРЯННЫЕ ВИКИНГИ · HTML5 | 0 / 0 · 0 / 0 | 1152×720, painted | 0 / 0 | нет | `qa-shots/lost-vikings-retro-1440.png`, `…-mobile-390.png` |
| 10 | double-dragon-battletoads | 200 | 200 | DOUBLE DRAGON × BATTLE TOADS: NEON RAGE | 0 / 0 · 0 / 0 | 1440×900, painted | 0 / 0 | нет | `qa-shots/double-dragon-battletoads-retro-1440.png`, `…-mobile-390.png` |
| 11 | lost-vikings-2 | 200 | 200 | Lost Vikings II · Северное сияние | 0 / 0 · 0 / 0 | 1440×900, титул рисует DOM-меню | 0 / 0 | нет | `qa-shots/lost-vikings-2-retro-1440.png`, `…-mobile-390.png` |

Пояснения к двум «неочевидным» пунктам (не дефекты, проверено дополнительно):

- **lost-vikings-2:** на титульном экране 2D-холст одноцветный, потому что титул/меню — DOM-оверлей. После нажатия «Новая сага» холст начинает рисовать игру: 546 цветов в сэмпле, ошибок нет — `qa-shots/lost-vikings-2-gameplay-1440.png`.
- **river-raid / silkworm / the-last-mission:** на титуле часть кадра — DOM-меню; после `Enter` холст тоже рисует игру (проверено, `*-started-1440.png`).
- lost-vikings по своему README стартует в **современном** стиле («Современный — по умолчанию»), поэтому его «ретро-скриншот по умолчанию» показывает современный вид — это заявленное поведение игры, не расхождение с каталогом.

Итого по играм: **11/11 PASS локально, 11/11 PASS на проде**, 0 console-ошибок, 0 pageerror, 0 внешних запросов.

---

## 3. Каталог: локально / прод / `file://`

Все проверки автоматизированы (`tools/qa/audit-catalog.mjs`, `check-catalog-extras.mjs`, `check-file-proto.mjs`).

| Проверка | Локально (8098) | Прод (Vercel) | `file://` |
|---|---|---|---|
| `/` отдаёт 200 + HTML каталога | ✅ 200, `text/html`, title «Зал ретро-игр…» | ✅ 200, `text/html`, тот же title | ✅ открывается `index.html` |
| Тема по умолчанию — retro | ✅ `data-theme="retro"`, чистое `localStorage`, светлая янтарная тема | ✅ то же | ✅ то же |
| Клавиша `G` → modern | ✅ переключилось, `aria-pressed` → `true`, превью сменились на `-modern` | ✅ | ✅ |
| Кнопка-переключатель (клик) | ✅ возвращает retro, `aria-pressed` меняется | ✅ | ✅ |
| `localStorage` `retro-games-catalog-theme` + сохранение после reload | ✅ `modern` после перезагрузки, тема сохранилась | ✅ | ✅ тема сохраняется после reload (`localStorage` на `file://` работает) |
| 11 карточек, порядок по годам 1982→1997 | ✅ 11, порядок верный | ✅ | ✅ 11 |
| Все 11 ссылок → HTTP 200 | ✅ 11/11 | ✅ 11/11 | ✅ все `slug/index.html` |
| `href` относительные с завершающим `/` | ✅ (`river-raid/`, …) | ✅ | — (там `slug/index.html` — так задумано) |
| Превью retro / modern | ✅ 11/11 `naturalWidth=720` в обеих темах | ✅ 11/11 | ✅ 11/11 |
| `alt` у всех превью | ✅ 11/11 непустые | ✅ | ✅ |
| Смена превью при теме | ✅ `…-retro.webp` ↔ `…-modern.webp` | ✅ | ✅ |
| Фильтры жанров: «Все» + 6 жанров | ✅ `Все=11`, `Shoot'em-up=2`, `Аркада=5`, `Головоломка=4`, `Run-and-gun=2`, `Платформер=6`, `Beat'em-up=1`; `aria-pressed` корректно | ✅ те же числа | ✅ (фильтры работают) |
| Поиск по названию | ✅ все 11 названий находят свою игру, пустое состояние + «Сбросить фильтры» работают, очистка возвращает 11 | ✅ | ✅ |
| Нет внешних запросов (офлайн) | ✅ только 127.0.0.1 | ✅ только свой домен | ✅ |
| Console / page errors | ✅ 0 / 0 | ✅ 0 / 0 | ✅ 0 / 0 |
| 1440×900: нет h-scroll, карточки не наезжают | ✅ `scrollWidth=1440`, пересечений карточек 0, элементов за экраном 0 | ✅ | ✅ |
| 390×844: нет h-scroll, фильтры/карточки вписываются | ✅ `scrollWidth=390`, 1 колонка, вылетов 0 | ✅ | ✅ |
| Клавиатура: Tab до переключателя и карточек, Enter переходит | ✅ 14 остановок, переключатель и карточка достигнуты, Enter → `river-raid/` (title игры) | ✅ | ✅ |
| `aria-label` / `aria-pressed` / видимый focus | ✅ label + pressed меняются, focus-ring виден, есть skip-link, `role=status` у счётчика | ✅ | ✅ |
| Контраст основного текста ≥ 4.5:1 | ✅ 115 текстов на сплошном фоне проверено, нарушений 0 | ✅ | ✅ |
| `prefers-reduced-motion` | ✅ CSS-правило есть, CDP-эмуляция срабатывает, анимаций 2→0, transition → 0s | ✅ | ✅ |
| «Случайная игра» | ✅ ведёт на случайную игру (`/silkworm/` в прогоне) | ✅ | ✅ |
| Якорь «Смотреть каталог» (`#games`) не прячется под sticky-шапкой | ✅ заголовок ниже шапки (73 px > 69 px) | ✅ | ✅ |
| 404 | ✅ статус 404 (стандартная страница python) | ✅ статус 404 (страница Vercel «404: NOT_FOUND») | — |

Скриншоты каталога (локально): `qa-shots/catalog-retro-1440.png`, `catalog-modern-1440.png`, `catalog-modern-after-reload-1440.png`, `catalog-retro-1440-grid.png`, `catalog-modern-1440-grid.png`, `catalog-retro-390.png`, `catalog-modern-390.png`, `catalog-anchor-games.png`, `catalog-retro-empty.png`, `catalog-modern-empty.png`, `catalog-reduced-motion-1440.png`, `catalog-404.png`.
Прод-скриншоты: `qa-shots/prod/` (те же сцены, снятые с прода).

---

## 4. Прод: спецпроверки (как просил Lead)

| URL | Статус |
|---|---|
| `/` | **200** `text/html; charset=utf-8` |
| `/river-raid/`, `/digger/`, `/lode-runner/`, `/boulder-dash/`, `/contra/`, `/exolon/`, `/the-last-mission/`, `/silkworm/`, `/lost-vikings/`, `/double-dragon-battletoads/`, `/lost-vikings-2/` | **200** (11/11) |
| `/digger/css/style.css` | **200** `text/css` |
| `/lost-vikings-2/js/main.js` | **200** `application/javascript` |
| `/contra` | **308** → `/contra/` (как и заявлено) |
| `/contra/` после редиректа | **200** |
| `/assets/catalog/games.json` | **200** |
| `/tools/`, `/tools/qa/`, `/tools/shot.mjs`, `/reports/`, `/reports/qa-catalog.md` | **404** |
| `/digger/src/`, `/lost-vikings/src/`, `/contra/src/`, `/boulder-dash/src/`, `/digger/tests/`, `/digger/tools/` | **404** |
| `/.gitignore`, `/README.md`, `/robots.txt` | **404** |

Файлы прода и локальные совпадают побайтно (md5): `index.html`, `assets/catalog/catalog.css`, `assets/catalog/catalog.js`, `assets/catalog/games.json`.

Поведение прод-каталога в браузере полностью совпало с локальным: тема по умолчанию, `G`, клик по кнопке, `aria-pressed`, `localStorage` + reload, 11 ссылок 200, превью 11/11 в обеих темах, фильтры/поиск, нет console/page errors и внешних запросов, мобильный/десктопный лейаут без h-scroll.

---

## 5. `file://` (двойной клик по index.html)

Проверено `tools/qa/check-file-proto.mjs`:

- 11 карточек, порядок и данные совпадают с `games.json` (в `file://` используется встроенный `FALLBACK_GAMES`, т.к. `fetch` недоступен);
- `href` карточек — `river-raid/index.html`, … (11/11), логотип — `index.html`;
- тема по умолчанию retro, `G` переключает на modern, превью меняются;
- превью загрузились 11/11, `alt` заданы;
- клик по карточке открывает игру: `file:///…/river-raid/index.html`, title `RIVER RAID · РЕЧНОЙ РЕЙД — HTML5`, canvas есть — **не листинг каталога**;
- console/page errors — 0.
- Скриншоты: `qa-shots/catalog-file-retro-1440.png`, `catalog-file-modern-1440.png`, `catalog-file-card-click.png`.

---

## 6. Данные каталога (`assets/catalog/games.json`)

- 11 игр, все обязательные поля схемы на месте, дублей/неизвестных slug нет, порядок по годам верный (1982, 1983, 1983, 1984, 1987, 1987, 1987, 1988, 1992, 1993, 1997).
- 22 превью `retro/modern` существуют и отдаются с HTTP 200 (и локально, и на проде), размеры в норме.
- Встроенный `FALLBACK_GAMES` в `catalog.js` сверен с `games.json` программно: расхождений по `title/subtitle/year/developer/genre/tags/summary/accent` нет.

---

## 7. Дефекты и замечания

### P1 — блокирующие
**Нет.**

### P2 — заметные визуальные/UX
**Нет.**

### P3 — мелочи

1. **Фильтр по жанру учитывает ещё и `tags`, поэтому выдача шире жанра.**
   «Аркада» показывает 5 игр (в т.ч. River Raid с жанром `Shoot'em-up`, Contra с `Run-and-gun`), «Платформер» — 6, «Головоломка» — 4. Карточки при этом подписаны своим жанром, из-за чего связь «чип → карточка» неочевидна.
   - Шаги: открыть `/` → кликнуть чип «Аркада» → в выдаче River Raid/Contra, у которых на карточке другой жанр.
   - Причина: `matchesGenre()` в `catalog.js` сравнивает и `genre`, и `tags`.
   - Что сделать: либо фильтровать строго по полю `genre`, либо назвать чипы «жанры и теги» и не удивлять пользователя. Не блокирует.
2. **`/favicon.ico` → 404** на части игр: в финальном прогоне — contra (локально и на проде); в промежуточных прогонах так же наблюдались lost-vikings-2 и the-last-mission (зависит от того, когда Chrome решает «прозондировать» favicon). Это стандартный «probe» браузера для страниц без `<link rel="icon">`, на вид и работу не влияет. Каталог использует inline data-URI favicon, у него 404 нет.
   - Что сделать при желании: положить `/favicon.ico` в корень или добавить `<link rel="icon">` в игры.
3. **Нет кастомной 404-страницы.** Локально — стандартная страница python, на проде — «404: NOT_FOUND» от Vercel. Статус 404 корректный; по заданию «не критично», просто отмечаю.
4. **Дублирование данных в `catalog.js` (`FALLBACK_GAMES`).** Сейчас полностью совпадает с `games.json` (проверено автоматически), но при обновлении `games.json` может разойтись — риск поддерживаемости, не дефект поведения.

Прочее (не дефекты): поиск «The Lost Vikings» находит 2 игры (вторая — «The Lost Vikings 2») — ожидаемое поведение поиска по подстроке; локальный dev-сервер python отдаёт листинг `/tools/` (на проде 404) — это локальная особенность, не утечка прод-конфига.

---

## 8. Ограничения проверки

- **Контраст modern-темы:** 95 из 120 текстовых элементов лежат на градиентах/`background-image`, где программный расчёт контраста некорректен. На сплошных фонах нарушений нет (retro: 115 проверено, 0 < 4.5:1; modern: 25 проверено, 0). Визуально текст читаем на всех просмотренных скриншотах. Для формальной WCAG-проверки нужен axe/Pa11y.
- Скриншоты и метрики сняты в headless Chrome; поведение соответствует Chromium, отличия в Safari/Firefox не проверялись.
- Локальный `python http.server` изредка сбрасывает параллельные соединения (ECONNRESET) — QA-скрипты ходят последовательно/с ретраями; на прод-сайте это не воспроизводится.
- `prefers-reduced-motion` проверялся эмуляцией CDP + наличием CSS-правила; реальные настройки ОС не менялись.

---

## 9. Артефакты

| Что | Путь |
|---|---|
| Сырые результаты игр (локально) | `qa-shots/games-audit.json` |
| Сырые результаты каталога (локально) | `qa-shots/catalog-audit.json` |
| Сырые результаты игр (прод) | `qa-shots/prod/games-audit-prod.json` |
| Сырые результаты каталога (прод) | `qa-shots/prod/catalog-audit-prod.json` |
| Скриншоты локально + file:// | `qa-shots/*.png` (59 файлов) |
| Скриншоты прода | `qa-shots/prod/*.png` (52 файла) |
| QA-скрипты | `tools/qa/lib.mjs`, `tools/qa/audit-games.mjs`, `tools/qa/audit-catalog.mjs`, `tools/qa/check-catalog-extras.mjs`, `tools/qa/check-file-proto.mjs` |

Ключевые скриншоты:

- Каталог: [retro 1440](qa-shots/catalog-retro-1440.png) · [modern 1440](qa-shots/catalog-modern-1440.png) · [сетка retro](qa-shots/catalog-retro-1440-grid.png) · [сетка modern](qa-shots/catalog-modern-1440-grid.png) · [retro 390](qa-shots/catalog-retro-390.png) · [modern 390](qa-shots/catalog-modern-390.png) · [после reload (modern)](qa-shots/catalog-modern-after-reload-1440.png) · [пустой поиск](qa-shots/catalog-retro-empty.png) · [reduced-motion](qa-shots/catalog-reduced-motion-1440.png) · [404](qa-shots/catalog-404.png) · [file:// retro](qa-shots/catalog-file-retro-1440.png) · [file:// переход в игру](qa-shots/catalog-file-card-click.png)
- Игры: `qa-shots/<slug>-retro-1440.png`, `qa-shots/<slug>-mobile-390.png` для всех 11 slug; `qa-shots/lost-vikings-2-gameplay-1440.png`.
- Прод: `qa-shots/prod/` (каталог в обеих темах, 1440/390, сетки, поиск, пустое состояние, 404, каталог-якорь; игры — 11 шт. на 1440 и 390).

---

## 10. Итог

Каталог и все 11 игр **готовы к git/деплою** по результатам независимой приёмки: P1/P2 отсутствуют, прод-деплой https://retro-games-psi.vercel.app работает идентично локальной версии, `file://`-режим рабочий. Замечания P3 не блокируют релиз.
