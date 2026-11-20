# Гефест Arcade — фреймворк (v2.6) · engine.js + host.js + mouse.js + platform.js + aspect.js

`engine.js` — vanilla JS, **0 зависимостей**. Расширен из микро-движка (v1) в фреймворк с общими
системами, которые игры дублировали. Критерии проходимость/играбельность/непресность — встроены.

## Системы
- **Цикл:** фикс-шаг (детерминированно) + realtime; `g.scene(name,{realtime,enter,update(dt),draw(ctx),press(a)})`.
- **Ввод (унифиц.):** клавиатура WASD/стрелки + тач-дпад `g.input.bindDpad(root)`; `g.input.dir`, `pressed`, `onPress`. Space=action, Enter=start, P/Esc=pause, M=mute, L=lang, T=theme. Ввод по игрокам (кооп) и `g.input.touchOnly` — раздел «v2.2» ниже.
- **i18n RU/EN:** `Arcade.createGame({strings:{ru,en}})`, `g.t(key,fallback)`, `g.i18n.toggle()`, `g.i18n.has(key)`; язык сохраняется (localStorage `arcade.lang`).
  **Единое правило выбора языка (v2.3, во всех играх):** 1) параметр адреса `?lang=en|ru` — приоритет, сразу сохраняется в `arcade.lang`
  (EN-страницы каталога ссылаются на игры как `/<slug>/?lang=en`); 2) иначе сохранённый `arcade.lang`; 3) иначе `opts.lang` игры, иначе **ru**.
  Неизвестное значение `?lang=` игнорируется. В «оболочках» (`host.js`) движок передаёт язык родной игре через `adapter.setLang` (первый кадр);
  `#lang=` в адресе оболочки по-прежнему действует только на этот запуск.
  **Перевод страницы:** элементы с `data-en="…"` движок переключает сам (исходная разметка запоминается в `data-ru`), `<html lang>` следует языку —
  так переводятся «← Каталог» (`data-en="← Catalog"`) и подсказки `.foot`. Заголовок/подзаголовок заставки в EN берутся из `strings.en.title/subtitle`,
  даже если в `useStandardScreens({title})` передан русский литерал. Тест: `node _shared/tests/i18n.test.mjs`.
- **Ссылка «← Каталог» (в каждой игре):** `<a class="back" href="../" data-catalog-back="1" data-en="← Catalog">← Каталог</a>`, **движок (v2.4) сам ведёт её в каталог текущего языка игры**: RU — `../`, EN (`?lang=en` / сохранённый выбор / клавиша L) — `../en/`, на `file://` — с `index.html`; href и подпись обновляются при каждой смене языка (`g.i18n.applyCatalogLink()`, вызывается из `applyDom`). Движок находит ссылку по атрибуту `data-catalog-back` — id/класс значения не имеют, ссылок может быть несколько. Подпись берётся из `data-en`; если `data-en` нет и внутри нет своей разметки — движок ставит «← Catalog» сам. В оболочках `#lang=en` (язык на один запуск) тоже переключает ссылку. Тесты — `i18n.test.mjs` (блок «каталог»). Вёрстка: стиль `position:fixed` + `z-index` выше canvas и тач-кнопок; видна и в игре (в оболочках в `play` — приглушена `opacity:.6`, но не скрыта). Проверка: `node tools/qa/ux-audit.mjs` (десктоп 1280×720 и iPhone 13 ландшафт).
- **Игровое время (v2.4):** `g.time` не бывает отрицательным — метка rAF первого кадра может быть раньше `performance.now()` из `start()`, такой `dt` движок обнуляет (раньше `g.time` на первом кадре уходил в минус и `Math.floor(g.time*k) % n` давал кадр спрайта `-1` — падал retro-рендер ЗАСЛОНа). Тест — `input.test.mjs`.
- **Темы retro/modern/neon:** `modern` — основная (чистый современный дизайн, вместо неона); `retro` — 8-бит/CGA; `neon` — опциональная (вкл. через `useStandardScreens({neon:true})`). Тема меняет палитру/шрифт/эффекты, НЕ логику: `g.th()` → {bg,panel,ink,muted,accent,good,bad,warn,grid,font,pixel,glow}. `g.setTheme()/toggleTheme()`, сохраняется (`arcade.theme`). Рисование (`clear/text/hud/overlay`) учитывает тему.
- **Звук:** 8-бит SFX `g.audio.beep(f,d,type,vol)`, `toggle()` (сохраняется). Музыка — см. раздел «Звук/музыка» ниже.
- **Меню:** `useStandardScreens({title,subtitle,lives,neon})` даёт сцены `title` (меню: Играть/Язык/Тема/Звук + показ рекорда), `pause` (Продолжить/Звук/В меню), `win`, `gameover`. Навигация ↑↓+action и клик/тап. Свои пункты — `g.menu.addItem(…)` (раздел «v2.2»). `Arcade.Menu` — переиспользуемый.
- **Счёт/рекорд:** `g.state{score,lives,level,best}`; `g.saveBest()` (вызывается на win/gameover) пишет `arcade.best.<gameId>`. Хук под рейтинг/звёзды — поверх best.
- **Проходимость/сложность:** `g.win()/gameover()/nextLevel()`, `g.difficulty(base,step,max)`.
- **Площадки (v2.5):** необязательный `_shared/platform.js` (Яндекс Игры / GamePush / свой сайт) — подключается только в сборках под площадку (`tools/platform-build.mjs`) ДО `engine.js`; движок сам связывается с `window.Platform`: пауза и звук на время рекламы, язык площадки, рекорд в облако, `gameplayStart/Stop` по сценам, реклама в паузах `win`/`gameover` (`adBreaks:false` — выключить), скрытие внешних ссылок. Без `platform.js` — всё как раньше. Подробно — `_shared/PLATFORMS.md`, тест — `platform.test.mjs`. **v2.6** — реклама за награду и старт после SDK, раздел ниже.
- **Утилиты:** `Arcade.Grid`, `g.particles`, `g.fit(maxCssWidth)`, `Arcade.loadSprites`, `Arcade.Store`.

## Старт
```html
<canvas id="c" width="432" height="432"></canvas>
<div class="pad"><button data-d="U">▲</button>…</div>
<script src="./engine.js"></script>
<script>
  const g = Arcade.createGame({ canvas:'#c', width:432, height:432, gameId:'iskra',
      strings:{ ru:{play:'Играть',…}, en:{play:'Play',…} }, theme:'modern' });
  g.input.bindDpad(document.querySelector('.pad'));
  g.useStandardScreens({ title:'ИСКРА', subtitle:'…', lives:3 });   // title/pause/win/gameover + меню
  g.scene('play', { realtime:true, enter(d){ if(!(d&&d.resume)) setup(); }, update(dt){…}, draw(ctx){…}, press(a){ if(a==='pause')this.pause(); … } });
  g.start('title');
</script>
```
Рабочий образец — `example/index.html` (игра «ИСКРА»: сбор+уклонение, 5 уровней, retro/modern, RU/EN, пауза, best).
Тест playwright: 0 ошибок; переключение темы (modern↔retro) и языка (RU↔EN), меню/пауза/HUD/геймплей — работают (см. скриншоты).

## Звук/музыка (v2.1)
Встроенный процедурный секвенсор чиптюна на WebAudio: без файлов и зависимостей, 3 голоса — **бас**, **мелодия**, **ударные** (шум).
- **Подключение мелодии в игре** — файл `js/music.js` + `<script src="./js/music.js">` сразу ПОСЛЕ `engine.js`:
  ```js
  (function (A) { A.tracks = A.tracks || {};
    A.tracks.iskra = {            // ключ = gameId игры — движок подхватит сам в createGame
      bpm: 132, div: 2,           // div — шагов на долю: 2 = восьмые (8 шагов в такте 4/4), 3 = 6/8, 4 = шестнадцатые
      lead: { retro:'square', modern:'triangle' },   // необяз.: волна мелодии по теме (по умолч. square / triangle)
      vol: 1,                     // необяз.: множитель громкости трека
      melody: ['C5 - E5 G5 | …', '…'],   // строки/массив строк, 1 токен = 1 шаг
      bass:   'C3 . G2 . | …',
      drums:  'k . h . s . h . '
    };
  })(window.Arcade = window.Arcade || {});
  ```
  Или явно из кода: `g.setMusic(track)` / `g.audio.setMusic(track)` / `Arcade.createGame({ music: track })`.
- **Нотация:** нота `C5`, `F#4`, `Bb3`; `-` — тянуть предыдущую ноту; `.` — пауза; `|` — разделитель тактов (игнорируется). Ударные: `k` бочка, `s` малый, `h` хэт, `o` открытый хэт, комбинации (`kh`). Голоса зацикливаются **независимо** (бас на 4 такта под мелодию на 8 — норма; длины лучше делать кратными). Неизвестная нота → понятная ошибка при загрузке.
- **Тембр по теме (переключается на лету, T):** `retro` — квадрат/треугольник, жёсткие огибающие, шумовые ударные «как на 8-бит приставке»; `modern` (и `neon`) — мягче: синус/треугольник + октава через НЧ-фильтр, плавная атака и хвост.
- **Жизненный цикл — автоматически по сцене** (`musicAuto`, по умолчанию вкл): `play` — играет (с начала; `goto('play',{resume:true})` — с места паузы), `pause` — пауза с сохранением позиции, `title`/`win`/`gameover`/прочие — стоп (на финалах звучат SFX движка). Выключить: `createGame({ musicAuto:false })` и управлять самому `g.playMusic()/g.stopMusic()`.
- **Громкость** ниже SFX (пики голосов 0.03–0.2 через шину `g.audio.music.volume` = 0.8; SFX — 0.07 напрямую). **Звук выкл (M / меню)** — музыка встаёт на паузу и продолжает при включении. Скрытая вкладка — AudioContext засыпает.
- **Автоплей:** AudioContext создаётся только после первого жеста (клавиша/клик/тап). До жеста `beep()` и музыка молчат; если игра уже в `play` — музыка стартует на жесте.
- **Совместимость v2.0:** `g.playMusic()/g.stopMusic()` работают (играют/останавливают трек); `g.audio.registerMusic(theme, player)` с legacy-плеером `{start(ctx),stop()}` — как раньше; `registerMusic(theme, null)` — ничего (hrum); `registerMusic(theme, track)` — отдельный трек под тему.
- **Отладка/тесты:** `g.audio.music.stats` → `{scheduled, started, errors}`, `g.audio.music.playing`, `.step`. Тесты секвенсора и треков всех игр: `node _shared/tests/music.test.mjs`.
- Мелодии — только оригинальные (без цитат чужой музыки), 8–16 тактов.

## v2.2: API меню, ввод по игрокам, «только тач», общий host.js

### Меню — `g.menu`
Пункты стандартных экранов (`useStandardScreens`) имеют ключи: title — `play`, `lang`, `theme`, `sound`; pause — `resume`, `sound`, `menu`.
```js
g.menu.addItem({ key:'levels', label:()=>g.t('levels'), onSelect(){ /* this === g */ }, after:'play' }); // scene:'title' по умолчанию
g.menu.addItem({ key:'restart', label:'Заново', scene:'pause', before:'menu' });   // after | before | index | (в конец)
g.menu.removeItem('levels');            // (key, scene='title') → true/false
g.menu.items('title');                  // → ['play','levels','lang','theme','sound']
g.menu.get('pause');                    // → Arcade.Menu (sel, current(), add/remove/indexOf)
g.menu.setHint(()=>['строка', {text:'приглушённая', dim:true}], 'title');  // подсказка внизу экрана сцены (H-72, шаг 20)
```
Можно звать до `useStandardScreens` — пункты применятся при создании меню. Тот же `key` — пункт переезжает (без дублей); выбранный пункт при вставке не сдвигается. Лазить в `g.scenes.title._menu.items` больше не нужно.

### Ввод по игрокам — `g.input.player(i)` (локальный кооп за одной клавиатурой)
```js
const conflicts = g.input.setPlayers({
  bind: { p1:{ left:['ArrowLeft'], right:['ArrowRight'], up:['ArrowUp'], down:['ArrowDown'], fire:['Slash','Period','Space'] },
          p2:{ left:['KeyA'], right:['KeyD'], up:['KeyW'], down:['KeyS'], fire:['KeyF','ShiftLeft'] } },  // или [map1, map2]
  actions:['fire'],          // какие имена шлют onPress (по умолчанию — все, кроме left/right/up/down)
  repeat:['fire'],           // для каких — и на автоповторе клавиши
  touch:{ L:'left', R:'right', U:'up', D:'down', A:'fire' },   // тач-дпад ([data-d], bindDpad) → только И1
  count: 1,                  // число игроков (g.input.setPlayerCount(n), g.input.playerCount)
  reserved:['Digit1']        // доп. занятые клавиши для проверки
});
const P1 = g.input.player(0), P2 = g.input.player(1);
P1.dir;               // {x,y} по left/right/up/down этого игрока
P2.pressed('fire');   // зажато ли
P1.onPress(name => …); // нажатие действия этого игрока
```
- **1 игрок** (`playerCount===1`): обе раскладки управляют И1, у `player(1)` ничего не зажато.
- `onPress` игроков — только в сцене `play` и не раньше 120 мс после входа в неё (клавиша старта не «стреляет»); в `play` у привязанных клавиш снимается действие браузера (Slash — быстрый поиск). `pressed` отслеживается всегда; `blur` окна сбрасывает зажатое.
- **Конфликты** проверяются при `setPlayers` (`console.warn` на каждый, результат — массив `{player,name,code,why:'hotkey'|'shared'}`): горячие клавиши движка `Arcade.hotkeys` = P, Esc, M, L, T, Enter, NumpadEnter, Space (Space допустим у И1 как действие, не как направление) и клавиши, общие для двух игроков. Для тестов — `Arcade.checkBindings(bind, {reserved})`.

### Кооп «под ключ» — `g.usePlayers(cfg)`
`cfg` — поля `setPlayers` (без `count`) + `hint:{ru:[…],en:[…]}` + `pad` (корень тач-кнопок). Даёт: пункт меню «Игроки: 1/2» (key `players`, после «Играть»; строки `players`, `touch1p`), клавиши 1/2 (и Numpad) на заставке, хранение выбора `arcade.players.<gameId>`, подсказку раскладки под меню (2-я строка яркая только при 2 игроках), кнопку `[data-pause]` в `pad` (пауза/продолжить). Возвращает `g.players = { count(), set(n) }`. Эталоны: `redut/`, `zvero-otryad/`, `zvero-otryad-2/` (бывший локальный `js/coop.js` удалён — всё в движке).

### «Только тач» — `g.input.touchOnly`
`true` на устройстве с грубым указателем без hover (`(hover: none) and (pointer: coarse)`), пока не было ни одного настоящего `keydown` (синтетические события экранных кнопок не в счёт); снимается первым же нажатием физической клавиши. `usePlayers` на «только тач» оставляет 1 игрока и показывает одну строку подсказки.

### Общая «оболочка» — `_shared/host.js` → `<игра>/js/host.js`
Для крупных игр со своим циклом/canvas (obval, rubikon, vihr, rubezh, proryv, saga, saga-2, neon-yarost): движок поверх игры даёт меню/паузу/финалы/тему/язык/звук/рекорд через адаптер `ArcadeHost.mount({ gameId, mount, width, height, scale, strings, extra, adapter, …опции })`. Источник один — `_shared/host.js`, `build.sh` копирует его в `js/host.js` каждой игры, которая подключает `./js/host.js` (копии руками не править; тест `_shared/tests/host.test.mjs` ловит рассинхрон). Адаптации игр — опциями (по умолчанию выкл.):
| опция | что делает | кто |
|---|---|---|
| `extra: 'key' \| ['k1','k2']` | доп. пункты меню после «Играть»; `adapter.openSub(key)`, необяз. `adapter.extraHint(key)` — приписка к подписи | все / saga, saga-2, neon-yarost — массив |
| `urlQuery: true` | параметры адреса из `?query` и `#hash` (hash важнее) | saga, saga-2 |
| `urlTheme(P)` | своя трактовка темы из адреса | saga-2 (`?mode=retro\|aurora`) |
| `gameKeys: {code:1}` | в play эти клавиши — только игре, даже «свои» для движка | saga-2 (`KeyL` — крюк) |
| `subKeys: {code:1}` | в режиме игры `sub` эти клавиши — родным экранам игры | neon-yarost (`Escape`, `KeyP`) |
| `rawGameKeys: true` | в play игровые клавиши не проходят через ввод движка; keyup клавиши, нажатой в меню движка, в игру не уходит | saga, saga-2 |
| `soundFromEngine: true` | при старте игра следует звуку движка (кроме `?mute=`) | saga, saga-2 |
| `bootKeep: true` | первый вход в title не сбрасывает игру (её мог запустить `?level=`) | saga, saga-2 |
| `bootAdopt: true` | игра при загрузке уже в `play`/`sub` (`#demo=`/`#scene=`/`#wave=`) — движок сразу следует за ней | neon-yarost |

## v2.6: реклама за награду, межстраничная по действию игрока, старт после SDK
Всё ниже работает **только при подключённом `platform.js` с рекламой** (сборки под Яндекс/GamePush). На сайте и без SDK (блокировщик, офлайн)
экраны и пункты не появляются, `g.rewarded()` и `g.adBreak()` сразу возвращают `false` — игра идёт как раньше.
| API | Что делает |
|---|---|
| `g.canRewarded()` / `g.adReady()` | показ ролика за награду / межстраничной сейчас возможен |
| `g.rewarded({ reward(), done(ok) })` → `Promise<bool>` | ролик за награду: `reward()` — ровно один раз и **только при досмотре**; на время показа цикл стоит, AudioContext спит; повторный вызов во время показа — `false` |
| `g.useRewardedContinue({ revive(), available(), label })` | `g.gameover()` сначала открывает сцену `continue` «Ещё один шанс?»: «Реклама: продолжить» → `revive()` и `goto('play',{resume:true})`; «Нет, завершить» → `gameover`; раз за партию (сброс — «Играть»); ролик не удался — «Реклама недоступна» → `gameover` |
| `g.useRewardedBonus({ key, scene:'pause'\|'title', label:{ru,en}\|fn, available(), grant(), once:true })` | пункт меню (в паузе — перед «В меню»); виден, только если реклама доступна, бонус ещё не взят в этой партии и `available()` |
| `g.adBreak()` → `Promise<bool>` | межстраничная в естественной паузе (между уровнями/волнами — по действию игрока); частоту режет адаптер (Яндекс 60 с, GamePush 180 с) |
| `g.persist(key, 'max'\|'last')`, `g.storeSet(key, v)` | свой ключ localStorage зеркалится в облако площадки; при старте — max (или облачное) |
| `createGame({ autoPause:false })` | отключить автопаузу при скрытой вкладке (по умолчанию вкл. при площадке) |
Поведение движка с площадкой: экран «Загрузка…» до `Platform.init()` (≤ 6 с), затем язык площадки → меню → `ready()`; межстраничная реклама —
по нажатию на экране победы/поражения (не при входе); скрытая вкладка в `play` → пауза; `contextmenu/selectstart/dragstart` подавлены.
Встроенные строки (`loading`, `rw_title`, `rw_continue`, `rw_no`, `rw_fail`, `rw_hint`) — RU/EN в движке, игра может переопределить в своих таблицах.
Пилоты: КАСКАД (ещё шанс — очистка верхней половины стакана; бонус — −2 нижних ряда), ОТБОЙНИК (ворота до 50 %; бонус — ремонт +6; реклама между
волнами), КЛАДКА (1 ядро; бонус — +1 ядро; реклама между уровнями по «Пробел / тап — дальше»). Тесты — `platform.test.mjs` (блок v2.6) и
`platform-builds.browser.mjs`. Режим 16:9 для порталов — `_shared/aspect.js` (только в сборках `tools/platform-build.mjs --aspect 16:9`).

## Мышь и тач — `_shared/mouse.js` → `<игра>/js/mouse.js` (v1.0)
Общий модуль указателя для игр, где мало дпада: стратегии, головоломки с выбором, редакторы. Отдельный файл, **от `engine.js` не зависит**;
ничего не знает об игре — переводит Pointer Events в жесты в логических координатах canvas (W×H, с учётом CSS-масштаба).
Вынесен из `porubezhye/js/mouse.js` (поведение сохранено 1:1) с добавлением щипка/зума, `touchDrag`, настраиваемых порогов, `cancel()`.

| Жест | Мышь | Тач | Колбэк |
|---|---|---|---|
| выбор | ЛКМ | тап | `onClick(pt, {shift,ctrl,alt,double,touch})` (`double` — двойной клик/тап) |
| рамка | протяжка ЛКМ (> 6 px) | протяжка пальцем (> 12 px) | `onBoxStart(pt,mods)` → `onBox(box,mods)`… → `onBoxEnd(box,mods)` / `onBoxCancel()`; `m.box` — для отрисовки |
| приказ | ПКМ | долгий тап (480 мс, вибро) | `onRight(pt, info)` (тач: `{touch:true,long:true}`) |
| панорама | протяжка СКМ | два пальца; один палец при `touchDrag:'pan'` | `onPan(dx,dy)` — сдвиг указателя: `cam.x -= dx` |
| прокрутка | колесо (Shift — по горизонтали) | — | `onWheel(dx,dy,pt,mods)` |
| зум | колесо при `wheelZoom:true` | щипок | `onZoom(k, pt, {source:'wheel'|'pinch'})`, `k > 1` — приблизить, `pt` — якорь |
| наведение / край | движение без кнопок | — | `onHover(pt)`; `m.edge(margin)` → `{x,y} ∈ {-1,0,1}` для прокрутки краем экрана |
| UI-зона | любой жест, начатый там, где `hitUI(pt)` = true | то же | `onUi('down'|'move'|'up', pt, {btn,mods,touch})` — мини-карта, панель команд |

```html
<script src="./js/mouse.js"></script>   <!-- копия _shared/mouse.js; canvas { touch-action: none } -->
<script>
  var m = ArcadeMouse.attach(g.canvas, { W: g.W, H: g.H,
    enabled: function () { return g._sceneName === 'play'; },
    hitUI: function (pt) { return pt.y >= PANEL_Y; }, onUi: function (phase, pt, info) { /* кнопки, мини-карта */ },
    onClick: function (pt, info) { select(pt, info.shift, info.double); },
    onBoxEnd: function (box, mods) { selectIn(ArcadeMouse.normBox(box), mods.shift); },
    onRight: function (pt) { order(pt); },
    onPan: function (dx, dy) { cam.x -= dx; cam.y -= dy; },
    onZoom: function (k, pt) { zoomAt(pt, k); }, wheelZoom: true });
  // в draw: if (m.box) рисуем рамку; в update: var e = m.edge(12); cam.x += e.x * speed * dt; m.setCursor(hover ? 'select' : 'default');
</script>
```
- **Опции-пороги:** `dragThreshold` 6, `touchDragThreshold` 12, `longPress` 480 мс, `dblTime` 320 мс, `dblDist` 10, `zoomStep` 0.0015 (`k = exp(-dy·zoomStep)`).
- **Курсоры:** `m.setCursor(name)` — встроенные SVG `default, select, attack, amove, gather, repair, move, build` + системные `pan, deny`; свои — `cursors: { имя: css }`
  (важнее встроенных), собрать SVG — `ArcadeMouse.svgCursor(body, hx, hy, fallback[, size=24])`.
- **Состояние:** `m.x, m.y, m.inside, m.box, m.mods, m.pointerType`; `m.busy()` — идёт жест; `m.cancel()` — сорвать жест (пауза, смена сцены); `m.detach()` — снять все подписки.
- **Подключение/синхронизация:** файл игры `js/mouse.js` — копия общего. `build.sh` обновляет копию только там, где `js/mouse.js` уже несёт метку
  «Источник — _shared/mouse.js» (собственные модули игр не затираются). Новая игра: скопировать `_shared/mouse.js` в `<игра>/js/mouse.js` и подключить после `engine.js`.
- **Тесты:** `node _shared/tests/mouse.test.mjs` (43: мышь, тач, щипок, UI-зоны, enabled, масштаб canvas, курсоры, detach, сверка копий в играх).
- **На модуле:** `porubezhye`, `priisk` (с 11.2026, перевод — ниже). **Ещё на своих модулях:** прототипы `_proto/fabrika/js/pointer.js`, `_proto/rts-c/js/main.js`.

### Перевод `priisk` на общий модуль — выполнен (11.2026; таблица — для истории и для переноса других игр)
`priisk/js/mouse.js` — тот же `ArcadeMouse`, но с другим контрактом. При переводе файл заменяется копией `_shared/mouse.js`, а в `priisk/js/main.js` (вызов `ArcadeMouse.attach`, ~стр. 108–190) меняется:

| Было (priisk) | Стало (общий модуль) |
|---|---|
| `onDown(p, info) → 'capture'`, `onDrag(p)`, `onUp(p)` — захват панели/мини-карты | `hitUI(p)` = `!inView(p) \|\| !!R.groupAt(p.x, p.y)` и `onUi(phase, p, info)`: `down` → тело `onDown`, `move` → `onDrag`, `up` → `onUp`; `info.ctrl` → `info.mods.ctrl` |
| `onCommand(p, info)` — ПКМ **на нажатии** / долгий тап | `onRight(p, info)` — ПКМ **на отпускании** (долгий тап — как был); `info.touch` есть только у долгого тапа |
| `onBoxing(r \| null)` — рамка тянется (нормализована) | `onBox(box)` + `onBoxCancel()`; либо читать `m.box` в отрисовке; нормализация — `ArcadeMouse.normBox(box)` |
| `onBox(r, info)` — рамку отпустили | `onBoxEnd(box, mods)` → `ArcadeMouse.normBox(box)`; `mods` = `{shift,ctrl,alt}` |
| `onClick(p, info)`, `info.dbl` | `onClick(p, info)`, `info.double` |
| `onPan(dx, dy)` — сдвиг **камеры** (`cam += d`) | `onPan(dx, dy)` — сдвиг **указателя**: поменять знак (`cam -= d`) |
| `onWheel(dx, dy)` | без изменений (добавились `pt, mods`) |
| `mouse.pos` (`{x,y}`) | сам `mouse` (`mouse.x, mouse.y`): `updatePlacing(mouse)` |
| `mouse.edgeDir()` (опция `edge: 14`) | `mouse.edge(14)` |
| `cursors: {…}` + `setCursor(kind)`, неизвестное имя → CSS как есть | `cursors: {…}` — так же; неизвестное имя → `default` (все имена priisk уже в словаре; `normal: 'default'` оставить) |
| `ArcadeMouse.svgCursor(body, hx, hy, fb)` — холст 32×32 | `ArcadeMouse.svgCursor(body, hx, hy, fb, 32)` — размер пятым аргументом |
| опции `dragThreshold, longPress, dblTime, dblDist` | те же имена; порог тача был `dragThreshold × 2` → `touchDragThreshold: 12` (по умолчанию) |
| `mouse.cancel()`, `mouse.detach()` | те же |
| подписки `pointermove/up` на canvas | на `window` (жест не теряется за пределами canvas) — проверить, что HTML-кнопки поверх canvas не ждут этих событий |

Как сделано в `priisk/js/main.js`: `hitUI` = `!inView(p) || R.groupAt(…)`; в `onUi` ЛКМ/тап — бывший `onDown` (кнопки групп с Ctrl/долгим
нажатием, мини-карта с перетаскиванием, панель), ПКМ (`btn 2`) — приказ на отпускании (назначить группу / отмена в панели / приказ по
мини-карте), СКМ (`btn 1`) над панелью — панорама (как было); `P.mouse.cursor` — имя курсора (`'lift'`, `'attack'`…), сам модуль хранит CSS.
После перевода: тесты `priisk/tests/engine.test.mjs` (блок «ArcadeMouse», стр. ~248–300) переписать под новый контракт или заменить ссылкой на `_shared/tests/mouse.test.mjs`;
браузером проверить рамку, приказ ПКМ, мини-карту (перетаскивание), группы (долгое нажатие ≥ 480 мс = назначить), размещение зданий на таче, панораму двумя пальцами.

Тесты v2.2–2.4: `node _shared/tests/i18n.test.mjs` (правило языка, ссылка «← Каталог»), `node _shared/tests/mouse.test.mjs` (мышь и тач), `node _shared/tests/input.test.mjs` (меню, игроки, конфликты, touchOnly, usePlayers), `node _shared/tests/host.test.mjs`.

## План игр (ремейки на фреймворке с паритетом фич — retro+modern, i18n, звук; неон→modern)
Старые версии архивировать как `<game>/legacy.html` ПЕРЕД заменой; каждую новую — отдельным протестированным коммитом; аркада всегда рабочая. Эталон первым: **kaskad** или **hrum** (самые компактные: 628 / 759 строк).
Волна A: kaskad, hrum, zvero-otryad(×2), plashch, redut, bolt, kolobok. Волна B: ruslo, krot. Волна C (крупные, осторожно): rubikon, saga-2, obval, vihr, rubezh, proryv, saga, neon-yarost.
