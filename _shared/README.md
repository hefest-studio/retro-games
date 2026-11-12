# Гефест Arcade — фреймворк (v2.2) · engine.js + host.js

`engine.js` — vanilla JS, **0 зависимостей**. Расширен из микро-движка (v1) в фреймворк с общими
системами, которые игры дублировали. Критерии проходимость/играбельность/непресность — встроены.

## Системы
- **Цикл:** фикс-шаг (детерминированно) + realtime; `g.scene(name,{realtime,enter,update(dt),draw(ctx),press(a)})`.
- **Ввод (унифиц.):** клавиатура WASD/стрелки + тач-дпад `g.input.bindDpad(root)`; `g.input.dir`, `pressed`, `onPress`. Space=action, Enter=start, P/Esc=pause, M=mute, L=lang, T=theme. Ввод по игрокам (кооп) и `g.input.touchOnly` — раздел «v2.2» ниже.
- **i18n RU/EN:** `Arcade.createGame({strings:{ru,en}})`, `g.t(key,fallback)`, `g.i18n.toggle()`; язык сохраняется (localStorage `arcade.lang`).
- **Темы retro/modern/neon:** `modern` — основная (чистый современный дизайн, вместо неона); `retro` — 8-бит/CGA; `neon` — опциональная (вкл. через `useStandardScreens({neon:true})`). Тема меняет палитру/шрифт/эффекты, НЕ логику: `g.th()` → {bg,panel,ink,muted,accent,good,bad,warn,grid,font,pixel,glow}. `g.setTheme()/toggleTheme()`, сохраняется (`arcade.theme`). Рисование (`clear/text/hud/overlay`) учитывает тему.
- **Звук:** 8-бит SFX `g.audio.beep(f,d,type,vol)`, `toggle()` (сохраняется). Музыка — см. раздел «Звук/музыка» ниже.
- **Меню:** `useStandardScreens({title,subtitle,lives,neon})` даёт сцены `title` (меню: Играть/Язык/Тема/Звук + показ рекорда), `pause` (Продолжить/Звук/В меню), `win`, `gameover`. Навигация ↑↓+action и клик/тап. Свои пункты — `g.menu.addItem(…)` (раздел «v2.2»). `Arcade.Menu` — переиспользуемый.
- **Счёт/рекорд:** `g.state{score,lives,level,best}`; `g.saveBest()` (вызывается на win/gameover) пишет `arcade.best.<gameId>`. Хук под рейтинг/звёзды — поверх best.
- **Проходимость/сложность:** `g.win()/gameover()/nextLevel()`, `g.difficulty(base,step,max)`.
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
Для крупных игр со своим циклом/canvas (obval, rubikon, vihr, rubezh, proryv, saga, saga-2, neon-rage): движок поверх игры даёт меню/паузу/финалы/тему/язык/звук/рекорд через адаптер `ArcadeHost.mount({ gameId, mount, width, height, scale, strings, extra, adapter, …опции })`. Источник один — `_shared/host.js`, `build.sh` копирует его в `js/host.js` каждой игры, которая подключает `./js/host.js` (копии руками не править; тест `_shared/tests/host.test.mjs` ловит рассинхрон). Адаптации игр — опциями (по умолчанию выкл.):
| опция | что делает | кто |
|---|---|---|
| `extra: 'key' \| ['k1','k2']` | доп. пункты меню после «Играть»; `adapter.openSub(key)`, необяз. `adapter.extraHint(key)` — приписка к подписи | все / saga, saga-2, neon-rage — массив |
| `urlQuery: true` | параметры адреса из `?query` и `#hash` (hash важнее) | saga, saga-2 |
| `urlTheme(P)` | своя трактовка темы из адреса | saga-2 (`?mode=retro\|aurora`) |
| `gameKeys: {code:1}` | в play эти клавиши — только игре, даже «свои» для движка | saga-2 (`KeyL` — крюк) |
| `subKeys: {code:1}` | в режиме игры `sub` эти клавиши — родным экранам игры | neon-rage (`Escape`, `KeyP`) |
| `rawGameKeys: true` | в play игровые клавиши не проходят через ввод движка; keyup клавиши, нажатой в меню движка, в игру не уходит | saga, saga-2 |
| `soundFromEngine: true` | при старте игра следует звуку движка (кроме `?mute=`) | saga, saga-2 |
| `bootKeep: true` | первый вход в title не сбрасывает игру (её мог запустить `?level=`) | saga, saga-2 |
| `bootAdopt: true` | игра при загрузке уже в `play`/`sub` (`#demo=`/`#scene=`/`#wave=`) — движок сразу следует за ней | neon-rage |

Тесты v2.2: `node _shared/tests/input.test.mjs` (меню, игроки, конфликты, touchOnly, usePlayers), `node _shared/tests/host.test.mjs`.

## План игр (ремейки на фреймворке с паритетом фич — retro+modern, i18n, звук; неон→modern)
Старые версии архивировать как `<game>/legacy.html` ПЕРЕД заменой; каждую новую — отдельным протестированным коммитом; аркада всегда рабочая. Эталон первым: **kaskad** или **hrum** (самые компактные: 628 / 759 строк).
Волна A: kaskad, hrum, zvero-otryad(×2), plashch, redut, bolt, kolobok. Волна B: ruslo, krot. Волна C (крупные, осторожно): rubikon, saga-2, obval, vihr, rubezh, proryv, saga, neon-rage.
