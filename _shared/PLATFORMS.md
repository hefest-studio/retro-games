# Игровые площадки — `_shared/platform.js` (v1.2) + `tools/platform-build.mjs` + `tools/promo-build.mjs`

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
  <script src="./engine.js"></script>                      ← движок v2.7 сам находит window.Platform
```
Движок (`_shared/engine.js` v2.7) при наличии `window.Platform`:
- **старт** — экран «Загрузка…», пока SDK инициализируется (не дольше `initTimeout` = 6 с), затем меню и `ready()` (Яндекс 1.19.2); язык площадки применён ДО меню (2.14);
- **пауза и звук** — на время рекламы, окна покупки и события площадки «пауза» цикл стоит, `AudioContext` усыплён; после — продолжает;
- **язык** — язык площадки (`ru`/`be`/`uk`/`kk`/`uz` → RU, остальные → EN), если в адресе нет `?lang=` (Яндекс, п. 2.14); `<title>` сборки — название на языке (из `promo/<slug>/promo.json`);
- **рекорд** — `g.saveBest()` пишет и в облако (`Platform.save('best.<gameId>')`), при старте берётся максимум из локального и облачного;
- **разметка геймплея** — сцена `play` → `gameplayStart()`, любая другая (меню, пауза, победа, поражение) → `gameplayStop()`; `g.start()` → `ready()`;
- **реклама в паузах** — полноэкранная по **нажатию игрока** на экране `win`/`gameover` (неигровое действие, Яндекс 4.4) и `g.adBreak()` в паузах
  между уровнями (игра решает где); частоту режет адаптер: Яндекс — 60 с (площадка ещё и сама), GamePush — 180 с; отключить — `adBreaks: false`;
- **реклама за награду (v2.6)** — `g.rewarded({ reward() })`, `g.useRewardedContinue({ revive() })` («ещё один шанс» раз за партию на gameover),
  `g.useRewardedBonus({ key, scene:'pause', label, available(), grant() })` (пункт меню, раз за партию); на время показа цикл стоит и звук спит;
  без площадки с рекламой (сайт, блокировщик) экраны и пункты не появляются — см. `_shared/README.md`, раздел v2.6;
- **автопауза** — скрытая вкладка в `play` → меню паузы (GamePush); **без контекстного меню/выделения** (Яндекс 1.6.1.8, 1.6.2.7);
- **любая потеря фокуса (v2.7, Яндекс 1.3 с 18.08.2026)** — `blur` окна и `pagehide` → AudioContext спит, игра в `play` → пауза; `focus`/`pageshow` → звук снова разрешён (игра ждёт «Продолжить»). Без площадки — как раньше (только скрытая вкладка);
- **v2.7: лидерборд, флаги, покупки, серверное время, оценка, ярлык, свои игры** — обёртки `g.leaderboard`, `g.flags`, `g.purchase()`/`g.useNoAds()`, `g.daily()`, `g.requestReview()`, `g.addShortcut()`, `g.ownGames()` (см. ниже и `_shared/README.md`, раздел v2.7);
- **облако для своих ключей** — `g.persist(key, 'max'|'last')` + `g.storeSet(key, v)` (ОТБОЙНИК — дальность волн);
- **ссылки наружу** — при `Platform.allowExternalLinks === false` движок прячет все `<a href>` (кроме якорей `#…`), включая «← Каталог».

## API адаптера
| Вызов | Что делает |
|---|---|
| `Platform.name` | `'web'` / `'yandex'` / `'gamepush'`. Определение: `?platform=` в адресе → `?platform=` в `src` самого `platform.js` → `<meta name="arcade-platform">` → окружение (`window.YaGames`, домен Яндекс Игр) → `web` |
| `Platform.init()` → `Promise` | загрузить/инициализировать SDK (один раз). SDK не загрузился за 6 с (блокировщик, офлайн) — игра идёт дальше: локальные сохранения, без рекламы |
| `Platform.ready()` | «игра загружена» — Яндекс `LoadingAPI.ready()`, GamePush `gameStart()` (один раз) |
| `Platform.gameplayStart()` / `gameplayStop()` | Яндекс `GameplayAPI.start/stop`, GamePush `gameplayStart/Stop` — только при смене состояния |
| `Platform.showRewarded(onReward)` → `Promise<bool>` | ролик за награду; `onReward()` — **только** при досмотре. На время показа — пауза и `gameplayStop` |
| `Platform.showInterstitial()` → `Promise<bool>` | полноэкранная реклама, не чаще `interstitialGap` с (Яндекс 60, GamePush 180) и не во время другого показа |
| `Platform.interstitialReady()` / `rewardedReady()` | показ сейчас возможен (SDK поднят, нет другого показа, интервал прошёл) — движок по ним решает, показывать ли кнопки/паузу |
| `Platform.save(key, data)` / `load(key)` / `peek(key)` / `flush()` | localStorage (`arcade.pf.<key>`) сразу + облако пачкой через 1,5 с (Яндекс `player.setData`, GamePush — JSON в поле игрока + `sync()`); чтение: облако → localStorage |
| `Platform.lang()` / `langFor(['ru','en'])` | язык площадки (ISO 639-1) / ближайший из поддерживаемых |
| `Platform.pauseHook(onPause, onResume)` → `unsubscribe` | подписка на паузу площадки; `Platform.paused` |
| `Platform.allowExternalLinks` | `false` на Яндексе; на GamePush — как разрешит площадка (`gp.platform.isExternalLinksAllowed`), до инициализации — `false` |
| `Platform.hasAds` | есть ли реклама (web — нет: кнопки «за награду» не показывать) |
| `Platform.leaderboard` (1.2) | `available`; `submit(score, { board, extra })` → `Promise<bool>` (Яндекс `leaderboards.setScore` — только вошедшему игроку, частые вызовы склеиваются до 1/с; GamePush — поле игрока `<board>` + `sync()`); `top({ limit ≤ 20, around, includeUser })` → `{ entries:[{ rank, score, name, me }], me }`; `me()` → `{ rank, score, name }` или `null`; `open()` — окно площадки (GamePush). Таблица по умолчанию `score` (Яндекс: «техническое имя» в Консоли; GamePush передаёт поле `score` в таблицу Яндекса `score`). Web — заглушка |
| `Platform.flags` (1.2) | `get(defaults)` → `Promise<{ ключ: строка }>` — Яндекс `getFlags({ defaultFlags })` (удалённое важнее), GamePush `variables.has/get` по ключам игры; `peek(key, def)`, `all()` |
| `Platform.serverTime()` / `now()` (1.2) | Яндекс `serverTime()` (мс), GamePush `serverTime` (ISO → мс); web — `null` / `Date.now()` |
| `Platform.review` (1.2) | `canRequest()`, `request()` → `Promise<bool>`: Яндекс `feedback.canReview()` → `{ value, reason }`, `requestReview()` → `{ feedbackSent }` (раз за сессию); GamePush `app.canRequestReview`, `app.requestReview()` → `{ success }`. На время окна — пауза |
| `Platform.shortcut` (1.2) | `canAdd()`, `add()` → `Promise<bool>`: Яндекс `shortcut.canShowPrompt()` → `{ canShow }`, `showPrompt()` → `{ outcome:'accepted' }`; GamePush `app.canAddShortcut`, `app.addShortcut()` → bool |
| `Platform.payments` (1.2) | `available`; `setup({ id: { consumable } })` → после init проверка необработанных (`getPurchases()` — обязательна при каждом запуске, 1.13.1): расходуемые → `onPurchase(id)` → `consumePurchase(token)`, постоянные → `owned(id)`; `catalog()` → `[{ id, title, description, price, priceValue, currency, image, currencyImage }]` (валюта из SDK, 1.13.2); `purchase(id, payload)` → `Promise<bool>` (окно покупки — пауза). Яндекс `ysdk.payments`; GamePush `payments.purchase/consume({ tag })` — id товара = тег в панели GamePush |
| `Platform.games` (1.2) | `available`; `list()` → `{ games:[{ id, title, url, icon, cover }], developerURL }` (Яндекс `features.GamesAPI.getAllGames()`, GamePush `gamesCollections.fetch({ tag:'ALL' })`); `open(game)` — Яндекс: только адреса Яндекс Игр, новая вкладка (8.4.1); GamePush — окно коллекции |
| `Platform.sticky` (1.2) | `show()` / `hide()` — Яндекс `adv.showBannerAdv/hideBannerAdv` (работают при опции Консоли «Использовать API для показа стики-баннера»; иначе баннер ведёт площадка), GamePush `ads.showSticky/closeSticky`; `showing` |
| `Platform.setInterstitialGap(sec)` (1.2) | интервал полноэкранной из флага; не меньше 30 с (Яндекс) / 180 с (GamePush) |

Реклама за награду в игре — через движок (он сам скрывает кнопки без рекламы, ставит паузу и глушит звук):
```js
g.useRewardedContinue({ revive() { game.revive(); } });                       // gameover → «Ещё один шанс?» (раз за партию)
g.useRewardedBonus({ key:'rwLife', scene:'pause', label:{ ru:'Реклама: +1 жизнь', en:'Watch ad: +1 life' },
  available() { return lives < MAX; }, grant() { lives++; } });              // пункт меню паузы (раз за партию)
```

### Движок 2.7 поверх адаптера 1.2
```js
const g = Arcade.createGame({ …, leaderboard: 'score',                     // таблица лидеров + автоотправка нового рекорда из g.saveBest()
  flags: { difficulty: 'normal' },                                          // значения в игре; площадка может переопределить
  products: { coins100: { consumable: true, grant() { coins += 100; } } }, // объявить товары ДО старта (проверка необработанных при запуске)
  sticky: false });                                                         // true — игра сама показывает стики (после проверки, что не закрывает кнопки)
g.useNoAds();                         // пункт меню «Без рекламы · <цена из SDK>»; после покупки — без межстраничной и стики, rewarded остаётся
g.flags.get('difficulty');            // 'normal' | удалённое значение (после g.flags.ready)
g.leaderboard.top({ limit: 10 }).then(({ entries, me }) => …);
const d = g.daily('gift'); if (d.ready && d.claim()) giveGift();          // раз в сутки по серверному времени (UTC+3)
g.requestReview(); g.addShortcut();   // после победы/рекорда, не во время игры
```
Служебные флаги рекламы (Консоль Яндекса → удалённая конфигурация; GamePush → переменные игры): `ad_interstitial_gap` (секунды), `ad_breaks`,
`ad_sticky`, `rewarded_continue`, `rewarded_bonus` (`'0'` — выключить). Без площадки всё безопасно: лидерборд недоступен, флаги = значения игры,
покупки → `false`, время — часы устройства.

## Сборка под площадку
```bash
node tools/platform-build.mjs <slug> yandex   /путь/вне/репо      # → <slug>-yandex/, <slug>-yandex.zip, <slug>-yandex.build.json
node tools/platform-build.mjs <slug> gamepush /путь/вне/репо --config /путь/вне/репо/gamepush.json
node tools/platform-build.mjs <slug> gamepush /путь/вне/репо --aspect 16:9   # порталы с холстом 16:9 → <slug>-gamepush-16x9/
node tools/promo-build.mjs <slug>                                  # промо в promo/<slug>/ (иконки, обложки, скриншоты, видео, тексты)
node _shared/tests/platform-builds.browser.mjs /путь/вне/репо     # headless-проверка всех сборок с мок-SDK
```
Сборщик копирует игру (без `tests/`, `*.md`, `legacy.html`), кладёт свежие `engine.js` и `js/platform.js`, убирает «← Каталог»,
внешние `<a>`, `canonical`, `og:url/og:image`, ставит `<title>` по языкам и CSS площадки (без прокрутки, pull-to-refresh, выделения, выноски
долгого тапа), с `--aspect 16:9` — `js/aspect.js` (копия `_shared/aspect.js`); проверяет: нет внешних адресов, пути латиницей без пробелов, размер ≤ 100 МБ,
**запрещённые слова** (yandex/gamepush; `tools/lib/banned-words.mjs`, Яндекс 1.15): «демо/demo», «trial version», «бета», «в разработке», «early access», TODO… в видимом
тексте игры (HTML, строки JS, JSON) → сборка падает с файлом, строкой и фразой; «полная версия», «скоро», Steam → предупреждения. Ложное срабатывание —
исключение в `EXCEPTIONS` модуля. `promo-build.mjs` проверяет то же в `promo.json` (+ 8.2.2: free/best/top/бесплатно в названии); `--check` — только проверка.
Названия для `<title>` сборщик берёт из `arcade-full/promo/<slug>/promo.json` (переменная `PROMO_DIR`; запасное место — `promo/` в репо).
Ключи GamePush — **не в репо**: файл конфигурации вне репо `{ "gamepush": { "projectId": "…", "publicToken": "…", "saveField": "arcade_save" } }`
или переменные `GP_PROJECT_ID`, `GP_PUBLIC_TOKEN`, `GP_SAVE_FIELD`. Без них в сборке плейсхолдеры (SDK не загрузится — сборка годится только для проверки).
`build.sh` обновляет `js/platform.js` в играх, где файл уже копия общего (метка «Источник — _shared/platform.js»).

**Пилот (11.2026):** КАСКАД (падающие фигуры), ОТБОЙНИК (пинбол + оборона), КЛАДКА (разбей стену) — портретный холст под телефон,
короткие сессии, одна рука/тап, счёт и рекорд, движок v2. ХРУМ отложен: облик героя и врагов близок к классике жанра — риск отказа
модерации как клона (Яндекс 3.6) и правило «узнаваемости» от 13.11.

## Чек-лист модерации
Полный чек-лист по официальным требованиям Яндекс Игр и GamePush с отметками по пилотным играм — **`_shared/PLATFORM-CHECKLIST.md`** (20.11.2026).
Названия (решение владельца 20.11): RU и EN свои — КАСКАД / CASCADE, ОТБОЙНИК / BUMPERWRIGHT, КЛАДКА / MASONRY; внутри языка одно название
везде (Яндекс 5.1.3) — в игре, `<title>` сборки, промо и текстах (`promo/<slug>/promo.json`). Язык — из SDK на старте (2.14), заявляем RU и EN.

## Промо-материалы — `tools/promo-build.mjs` → `arcade-full/promo/<slug>/` (приватный репо; путь — переменная PROMO_DIR)
Из `promo/<slug>/promo.json` (названия, тексты, теги, категории, подписи, палитра), `shots.mjs` (сценарии кадров и видео) и `art.js`
(рисунок иконки/обложки; без него — `tools/promo/art-default.js`): иконки 512 (Яндекс) и 1024 (GamePush) без текста; обложки 800×470 и
1920×1080 с названием на языке; 4 скриншота 720×1280 и 4 — 1280×720 на язык из реального геймплея (canvas ×2, без интерфейса браузера);
видео 16:9 ≈ 24 с (MP4); `listing.md` с текстами для форм и проверкой длины полей; `report.json`. Размеры и форматы — по форме черновика
Яндекса и докам GamePush (ссылки в шапке скрипта и в чек-листе).

## Отчёт метрик — `tools/yandex-metrics-report.mjs`
`node tools/yandex-metrics-report.mjs <выгрузка.csv> [ещё.csv …] [--game "Отбойник"] [--days 14] [--out отчёт.md] [--map metric=Столбец]` —
таблица гейтов плейбука §5.4 (рейтинг > 30, D1 ≥ 15 %, время на игрока ≥ 7 мин, CTR иконки ≥ 4 %, ARPDAU ≥ 0,3 / 1,5 / > 2 ₽, DAU ≥ 10 / 100) и итог
(продолжаем / патч / под угрозой снятия / стоп). Консоль отдаёт таблицу по дням с каждого виджета; точный формат файла в документации не описан —
маппинг столбцов гибкий (RU/EN-имена метрик, широкая таблица или файл на виджет, `;`/`,`/таб, десятичная запятая, %, доли, мм:сс). Пример — `tools/fixtures/yandex-metrics-sample.csv`.

## Что нужно от владельца (без личных данных в репо и чате)
1. Статус самозанятого (если ещё нет) — для Яндекс Игр (ЕЛС), GamePush, VK.
2. Аккаунт разработчика **Яндекс Игр** (Яндекс ID), принять ЕЛС, реквизиты — сам владелец. ID приложения в сборку не нужен: SDK `/sdk.js` отдаёт площадка.
3. Аккаунт **GamePush** (вход через Google-аккаунт), проект на каждую игру → **ID проекта** и **публичный токен** (кладутся в конфиг вне репо);
   в панели проекта — поле игрока типа «data» с ключом `arcade_save` (или своё имя → `saveField`).
4. Выбор первых игр и «ок» на публикацию каждой; промоматериалы пилота готовы в `arcade-full/promo/<slug>/` (приватный репо; путь — переменная PROMO_DIR) — посмотреть и одобрить.

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
- **v1.2 (сверено 20.11.2026):** Яндекс — лидерборды `ysdk.leaderboards.setScore/getEntries/getPlayerEntry/getDescription` (лимиты: setScore 1/с, getEntries 20 за 5 мин, getPlayerEntry 60 за 5 мин; `getLeaderboards()` устарел) — https://yandex.com/dev/games/doc/en/sdk/sdk-leaderboard ;
  удалённая конфигурация `await ysdk.getFlags({ defaultFlags, clientFeatures })` → `{ ключ: строка }` — https://yandex.com/dev/games/doc/en/sdk/sdk-config ;
  серверное время `ysdk.serverTime()` → мс — https://yandex.com/dev/games/doc/en/sdk/sdk-server-time ;
  оценка `feedback.canReview()` → `{ value, reason }`, `requestReview()` → `{ feedbackSent }` (раз за сессию; пример на странице пишет `sentFeedback` без `await` — ошибка примера, в адаптере по описанию) — https://yandex.com/dev/games/doc/en/sdk/sdk-review ;
  ярлык `shortcut.canShowPrompt()` → `{ canShow }`, `showPrompt()` → `{ outcome }` — https://yandex.com/dev/games/doc/en/sdk/sdk-shortcut ;
  покупки `ysdk.payments` / `getPayments()`, `purchase({ id, developerPayload })`, `getPurchases()`, `getCatalog()`, `consumePurchase(token)` — https://yandex.com/dev/games/doc/en/sdk/sdk-purchases ;
  свои игры `features.GamesAPI.getAllGames()` / `getGameByID(appID)` — https://yandex.com/dev/games/doc/en/sdk/sdk-other-games ; стики `adv.showBannerAdv/hideBannerAdv/getBannerAdvStatus` — https://yandex.com/dev/games/doc/en/sdk/sdk-adv .
  GamePush — лидерборд `leaderboard.open/fetch` — https://docs.gamepush.com/docs/leaderboards/leaderboard/ , `fetchPlayerRating` — https://docs.gamepush.com/docs/leaderboards/player-rating/ ;
  переменные `variables.fetch/get/has/type` — https://docs.gamepush.com/docs/game-variables/ ; серверное время `gp.serverTime` (ISO) — https://docs.gamepush.com/docs/get-start/common-features/ ;
  отзывы `app.canRequestReview`, `app.requestReview()` → `{ success, rating, error }` — https://docs.gamepush.com/docs/application/reviews/ ;
  ярлык `app.canAddShortcut`, `app.addShortcut()` → bool — https://docs.gamepush.com/docs/application/shortcut/ ;
  покупки `payments.isAvailable/products/purchases/purchase/consume/has` — https://docs.gamepush.com/docs/purchases/payments/ ;
  коллекции игр `gamesCollections.fetch/open` — https://docs.gamepush.com/docs/games-collections/ ; стики `ads.showSticky/closeSticky/isStickyAvailable` — https://docs.gamepush.com/docs/advertising/ .
- Не сверено: GamePush — как `has(tag)` и `purchases` ведут себя для неизрасходованных разовых покупок при старте (документация требует «consume сразу»);
  у GamePush коллекции игр недоступны на части порталов (GameDistribution, Poki и др. — по документации коллекций). Яндекс `getFlags` в сигнатуре
  описан как синхронный, в примерах — `await` (адаптер принимает оба).
- Не сверено: точный адрес загрузчика GamePush — официальный сниппет минифицирован и перебирает зеркала
  (`gamepush.com/sdk/game-score.js`, `s3.gamepush.com/files/gs/sdk/game-score.js`, …); адаптер берёт первое, свой адрес — `<meta name="arcade-sdk-url">`.
  Перед первой выкладкой сверить с кабинетом GamePush.

## Тесты
- `node _shared/tests/platform.test.mjs` — адаптер с мок-SDK (`_shared/tests/mocks/`) и связка с движком (36 проверок, в т.ч. v2.6: старт после init, `g.rewarded`, «ещё шанс», бонус, `adBreak`, `persist`; v1.2/v2.7: лидерборды Яндекс/GamePush, флаги, серверное время, оценка, ярлык, покупки и необработанные платежи, свои игры, стики, `blur`/`pagehide`, «Без рекламы», `g.daily`).
- `node _shared/tests/banned-words.test.mjs` — запрещённые слова (RU/EN, исключения, извлечение текста, `platform-build` и `promo-build`; ПРИИСК/ПОРУБЕЖЬЕ под площадку падают).
- `node _shared/tests/metrics-report.test.mjs` — отчёт метрик по фикстуре.
- `node _shared/tests/platform-builds.browser.mjs <папка-сборок>` — каждая сборка в Chromium с мок-SDK: 0 ошибок, язык до меню, ready после init, start/stop, «ещё шанс» за рекламу (пауза, звук, одна награда, пропуск), частота рекламы, автопауза, потеря фокуса (`blur` → пауза и тишина), адаптер 1.2 через мок-SDK (лидерборд, флаги, время, покупки, свои игры), контекстное меню, облако, нет ссылок и внешних запросов; телефон/планшет/десктоп без прокрутки; сборки `-16x9` — сцена 16:9.
