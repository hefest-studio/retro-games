# Игровые площадки — `_shared/platform.js` (v1.0) + `tools/platform-build.mjs`

Один адаптер для всех игр аркады: игра пишется один раз, сборка под площадку собирается командой.
Сейчас поддержаны **Яндекс Игры** (SDK v2), **GamePush** (агрегатор: VK, OK, Pikabu, CrazyGames, GameDistribution, Y8 и др.)
и **web** (наш сайт arcade.hefest.ru, itch.io — без SDK и без рекламы). На сайте игры `platform.js` **не подключают**:
движок без него работает как раньше.

## Как это устроено
```
index.html (сборка под площадку)
  <meta name="arcade-platform" content="yandex">
  <script src="/sdk.js"></script>                         ← только Яндекс: SDK отдаёт площадка
  <script src="./js/platform.js?platform=yandex"></script> ← адаптер (копия _shared/platform.js)
  <script src="./engine.js"></script>                      ← движок v2.5 сам находит window.Platform
```
Движок (`_shared/engine.js` v2.5) при наличии `window.Platform`:
- **пауза и звук** — на время рекламы, окна покупки и события площадки «пауза» цикл стоит, `AudioContext` усыплён; после — продолжает;
- **язык** — язык площадки (`ru`/`be`/`uk`/`kk`/`uz` → RU, остальные → EN), если в адресе нет `?lang=` (Яндекс, п. 2.14);
- **рекорд** — `g.saveBest()` пишет и в облако (`Platform.save('best.<gameId>')`), при старте берётся максимум из локального и облачного;
- **разметка геймплея** — сцена `play` → `gameplayStart()`, любая другая (меню, пауза, победа, поражение) → `gameplayStop()`; `g.start()` → `ready()`;
- **реклама в паузах** — при входе в `win`/`gameover` показывается полноэкранная реклама (адаптер не чаще 60 с; Яндекс ограничивает частоту сам);
  отключить — `Arcade.createGame({ adBreaks: false })` или `g.adBreaks = false`;
- **ссылки наружу** — при `Platform.allowExternalLinks === false` движок прячет все `<a href>` (кроме якорей `#…`), включая «← Каталог».

## API адаптера
| Вызов | Что делает |
|---|---|
| `Platform.name` | `'web'` / `'yandex'` / `'gamepush'`. Определение: `?platform=` в адресе → `?platform=` в `src` самого `platform.js` → `<meta name="arcade-platform">` → окружение (`window.YaGames`, домен Яндекс Игр) → `web` |
| `Platform.init()` → `Promise` | загрузить/инициализировать SDK (один раз). SDK не загрузился за 6 с (блокировщик, офлайн) — игра идёт дальше: локальные сохранения, без рекламы |
| `Platform.ready()` | «игра загружена» — Яндекс `LoadingAPI.ready()`, GamePush `gameStart()` (один раз) |
| `Platform.gameplayStart()` / `gameplayStop()` | Яндекс `GameplayAPI.start/stop`, GamePush `gameplayStart/Stop` — только при смене состояния |
| `Platform.showRewarded(onReward)` → `Promise<bool>` | ролик за награду; `onReward()` — **только** при досмотре. На время показа — пауза и `gameplayStop` |
| `Platform.showInterstitial()` → `Promise<bool>` | полноэкранная реклама, не чаще `interstitialGap` с (60) и не во время другого показа |
| `Platform.save(key, data)` / `load(key)` / `peek(key)` / `flush()` | localStorage (`arcade.pf.<key>`) сразу + облако пачкой через 1,5 с (Яндекс `player.setData`, GamePush — JSON в поле игрока + `sync()`); чтение: облако → localStorage |
| `Platform.lang()` / `langFor(['ru','en'])` | язык площадки (ISO 639-1) / ближайший из поддерживаемых |
| `Platform.pauseHook(onPause, onResume)` → `unsubscribe` | подписка на паузу площадки; `Platform.paused` |
| `Platform.allowExternalLinks` | `false` на Яндексе; на GamePush — как разрешит площадка (`gp.platform.isExternalLinksAllowed`), до инициализации — `false` |
| `Platform.hasAds` | есть ли реклама (web — нет: кнопки «за награду» не показывать) |
| `Platform.leaderboard` | заготовка `{ available:false, submit(), open() }` — методы площадок не подключены |

Пример кнопки «за награду» в игре:
```js
if (window.Platform && Platform.hasAds) showContinueButton(function () {
  Platform.showRewarded(function () { game.revive(); });   // награда — только если ролик досмотрен
});
```

## Сборка под площадку
```bash
node tools/platform-build.mjs <slug> yandex   /путь/вне/репо      # → <slug>-yandex/, <slug>-yandex.zip, <slug>-yandex.build.json
node tools/platform-build.mjs <slug> gamepush /путь/вне/репо --config /путь/вне/репо/gamepush.json
node _shared/tests/platform-builds.browser.mjs /путь/вне/репо     # headless-проверка всех сборок с мок-SDK
```
Сборщик копирует игру (без `tests/`, `*.md`, `legacy.html`), кладёт свежие `engine.js` и `js/platform.js`, убирает «← Каталог»,
внешние `<a>`, `canonical`, `og:url/og:image`, проверяет: нет внешних адресов, пути латиницей без пробелов, размер ≤ 100 МБ.
Ключи GamePush — **не в репо**: файл конфигурации вне репо `{ "gamepush": { "projectId": "…", "publicToken": "…", "saveField": "arcade_save" } }`
или переменные `GP_PROJECT_ID`, `GP_PUBLIC_TOKEN`, `GP_SAVE_FIELD`. Без них в сборке плейсхолдеры (SDK не загрузится — сборка годится только для проверки).
`build.sh` обновляет `js/platform.js` в играх, где файл уже копия общего (метка «Источник — _shared/platform.js»).

**Пилот (11.2026):** КАСКАД (падающие фигуры), ОТБОЙНИК (пинбол + оборона), КЛАДКА (разбей стену) — портретный холст под телефон,
короткие сессии, одна рука/тап, счёт и рекорд, движок v2. ХРУМ отложен: облик героя и врагов близок к классике жанра — риск отказа
модерации как клона (Яндекс 3.6) и правило «узнаваемости» от 13.11.

## Чек-лист модерации (по `claude/research/game-platforms-registry-2026-11.md`, раздел 3)
**Техника**
- [x] ZIP с `index.html` в корне, пути латиницей без пробелов, без абсолютных URL (Яндекс 1.7, 1.22) — проверяет сборщик
- [x] Распакованный размер ≤ 100 МБ (Яндекс 1.21) — проверяет сборщик (пилоты 120–155 КБ)
- [x] SDK: `ready()` когда можно играть, `gameplayStart/Stop` на старт/паузы/меню, обработчики pause/resume глушат звук и останавливают игру (1.19, 4.7) — движок v2.5
- [x] Звук выключается при сворачивании вкладки и при показе рекламы — движок (visibilitychange + пауза площадки)
- [x] Игра работает с блокировщиком рекламы и без SDK (таймаут инициализации, реклама → `false`)
- [ ] Мобильная адаптация: полный экран, нет прокрутки, свайп не обновляет страницу, долгий тап не выделяет текст, поворот экрана (1.6.1, 1.10) — проверить на телефоне каждую игру
**Сохранения**
- [x] Рекорд сохраняется сразу (localStorage) и в облако площадки (1.9, 1.11; Pikabu — облачные сохранения обязательны)
- [ ] Прогресс сверх рекорда (уровень, настройки) — по игре, через `Platform.save`
- [ ] Покупки — не делаем в пилоте (если появятся — только через SDK и на сервере площадки, 1.13.3)
**Реклама**
- [x] Только через SDK, своих рекламных блоков нет (4.1, 4.6)
- [x] Полноэкранная — только в логических паузах: победа/поражение (4.4), не чаще 60 с
- [ ] Rewarded — только по кнопке игрока, на кнопке видно награду, награда — бонус (4.5): API есть, кнопки в пилотных играх **не добавлены**
**Локализация**
- [x] Язык из SDK автоматически (2.14), RU + EN
- [ ] Название одинаковое на всех языках и уникальное в каталоге (5.1.3, 5.12) — у пилотов: КАСКАД/KASKAD и КЛАДКА/KLADKA — транслит, ОТБОЙНИК/BUMPERWRIGHT — разные: согласовать с владельцем
**Контент и ссылки**
- [x] Никаких ссылок наружу (8.4.2, 8.4.4; Pikabu) — сборщик + движок
- [ ] Нет двух похожих игр в одном каталоге (3.6) — перед подачей проверить пары похожих аркад
**Промоматериалы** (по каждой игре — свои, не повторять, 5.1.1.1, 5.11)
- [ ] Иконка (GamePush — 1024×1024; Pikabu — квадрат + 16:9); у Яндекса без скриншотов, рамок, UI, бейджей (5.2, 5.6, 8.3)
- [ ] Обложка 1920×1080 с названием (GamePush); ≥ 4 скриншота 1280×720 или 720×1280, без белого фона
- [ ] Видео — не на YouTube (3.9)
**Перед подачей**
- [ ] Прогон на бюджетном Android и в десктопном Chrome; отладка в тестовом режиме SDK (Яндекс: `&debug-mode=16`)
- [ ] Финальное ревью владельцем и явное «ок» на публикацию

## Что нужно от владельца (без личных данных в репо и чате)
1. Статус самозанятого (если ещё нет) — для Яндекс Игр (ЕЛС), GamePush, VK.
2. Аккаунт разработчика **Яндекс Игр** (Яндекс ID), принять ЕЛС, реквизиты — сам владелец. ID приложения в сборку не нужен: SDK `/sdk.js` отдаёт площадка.
3. Аккаунт **GamePush** (вход через Google-аккаунт), проект на каждую игру → **ID проекта** и **публичный токен** (кладутся в конфиг вне репо);
   в панели проекта — поле игрока типа «data» с ключом `arcade_save` (или своё имя → `saveField`).
4. Выбор первых игр и «ок» на публикацию каждой; промоматериалы (иконка, обложка, скриншоты) — отдельной задачей.

## Источники по SDK (сверено 20.11.2026)
- Яндекс Игры: подключение SDK и `YaGames.init()` — https://yandex.com/dev/games/doc/en/sdk/sdk-about ;
  `LoadingAPI.ready()`, `GameplayAPI.start/stop()` — https://yandex.com/dev/games/doc/en/sdk/sdk-game-events ;
  `game_api_pause` / `game_api_resume` — https://yandex.com/dev/games/doc/en/sdk/sdk-events ;
  реклама `showFullscreenAdv` / `showRewardedVideo` (колбэки onOpen/onClose/onError/onRewarded; частоту полноэкранной контролирует площадка) — https://yandex.com/dev/games/doc/en/sdk/sdk-adv ;
  данные игрока `getPlayer()`, `setData(data, flush)` / `getData(keys)` (200 КБ, 100 запросов за 5 мин) — https://yandex.com/dev/games/doc/en/sdk/sdk-player ;
  язык `environment.i18n.lang` — https://yandex.com/dev/games/doc/en/sdk/sdk-environment ; требования — https://yandex.ru/dev/games/doc/ru/concepts/requirements
- GamePush: подключение (`?projectId&publicToken&callback=onGPInit`, `await gp.player.ready`) — https://docs.gamepush.com/docs/get-start/getting-started/ ;
  `gameStart`, `gameplayStart/Stop`, `language`, `on('pause'|'resume')` — https://docs.gamepush.com/docs/get-start/common-features/ ;
  реклама `showFullscreen` / `showRewardedVideo` → успех, `ads.on('start'|'close')` — https://docs.gamepush.com/docs/advertising/ ;
  поля игрока `get/set/sync` (поля заводятся в панели) — https://docs.gamepush.com/docs/player/player-state/ , https://docs.gamepush.com/docs/player/cloud-saves/ ;
  `platform.isExternalLinksAllowed` — https://gamepush.com/sdk/docs/classes/Platform.html
- Не сверено: точный адрес загрузчика GamePush — официальный сниппет минифицирован и перебирает зеркала
  (`gamepush.com/sdk/game-score.js`, `s3.gamepush.com/files/gs/sdk/game-score.js`, …); адаптер берёт первое, свой адрес — `<meta name="arcade-sdk-url">`.
  Перед первой выкладкой сверить с кабинетом GamePush. Лидерборды обеих площадок не подключены.

## Тесты
- `node _shared/tests/platform.test.mjs` — адаптер с мок-SDK (`_shared/tests/mocks/`) и связка с движком (18 проверок).
- `node _shared/tests/platform-builds.browser.mjs <папка-сборок>` — каждая сборка в Chromium с мок-SDK: 0 ошибок, ready/start/stop, награда, частота рекламы, облачное сохранение, нет ссылок и внешних запросов.
