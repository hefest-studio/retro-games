# НЕОН × ЯРОСТЬ: NEON RAGE — контракт модулей

Оригинальный HTML5 beat 'em up студии «Гефест».
С волны 2 — на движке v2: `index.html` + `engine.js` + `js/host.js` + собранный `js/game.js`
(см. README); прежний автономный файл — `legacy.html`. Без CDN, шрифтов, картинок и аудиофайлов.
Внутренняя логическая сцена — **480×270** (16:9). Вся графика рисуется кодом на Canvas 2D,
вся музыка и звук синтезируются WebAudio. Языки: **русский (по умолчанию) и английский**.

Название в титрах: **НЕОН × ЯРОСТЬ**, подзаголовок **NEON RAGE**.
Герои, арт и мелодии — оригинальные.

## Сборка и проверка

```bash
node neon-rage/tools/build.mjs          # src/* -> js/game.js, src/style.css -> css/style.css
node --check neon-rage/src/<file>.js    # синтаксис
node neon-rage/tools/probe.mjs neon-rage/index.html reports/x.png \
     --w=1440 --h=900 --wait=1200 --eval='NR.state.mode'
```

`index.html` — **итоговый артефакт, собирает только Lead**. Агенты не редактируют
`index.html`, чужие `src/*` и `tools/*`. Свои тестовые страницы кладите в `tmp/`
(например `tmp/preview-modern.html`), скриншоты — в `reports/shots/`.
Все исходники — ES2019, без `import/export`, `type="module"`, top-level await и внешних
библиотек. Каждый файл — IIFE, пишет в глобал только свой неймспейс.

Порядок подключения (задан в `tools/build.mjs`):

1. `src/font.js` → `window.NR_FONT` (готовый пиксельный шрифт 6×8 с кириллицей, не менять)
2. `src/i18n.js` → `window.NR_I18N`, `window.NR_T`
3. `src/audio.js` → `window.NR_AUDIO`
4. `src/game.js` → `window.NR` (Lead)
5. `src/render-retro.js` → `window.NR_RENDER_RETRO`
6. `src/render-modern.js` → `window.NR_RENDER_MODERN`
7. `src/main.js` → оболочка, rAF, масштаб, ввод (Lead)

## Владение файлами

| Файл | Владелец |
|---|---|
| `src/render-retro.js` | retro-renderer |
| `src/render-modern.js` | modern-renderer |
| `src/audio.js` | audio-composer |
| `src/i18n.js`, `src/style.css`, `README.md` | localization-designer |
| `src/game.js`, `src/main.js`, `src/template.html`, `tools/*`, `index.html`, `docs/*` | Lead |
| `src/font.js` | общий, не редактировать |

---

# 1. Игра: режимы, персонажи, сюжет

Настройки (сохраняются в `localStorage` ключ `neon-rage.settings`; ключ прежней версии переносится при старте и удаляется):

```js
NR.settings = {
  lang: 'ru'|'en',              // ru по умолчанию
  gfx: 'retro'|'modern',        // переключатель графики, G
  audioStyle: 'chip'|'synth',   // 8-бит или синтвейв, по умолчанию chip
  music: true, sfx: true,
  volume: 0.8,                  // 0..1
  crt: true,                    // скан-линии в retro (в modern — лёгкое зерно)
  difficulty: 'easy'|'normal'|'hard',
  best: 0
}
```

Режимы `NR.state.mode` (рендереры обязаны нарисовать **каждый**):

| mode | что на экране |
|---|---|
| `title` | логотип, анимированный key-art, меню 4 пункта, чипы быстрых настроек |
| `select` | выбор героя (2 карточки), выбор сложности, кнопка старта |
| `intro` | сюжетная карточка «УКРАДЕННЫЙ ЧИП», ENTER — начать |
| `help` | управление, комбо, спецприёмы, советы |
| `settings` | строки настроек (язык/графика/музыка/стиль/звуки/громкость/CRT/сложность/рекорд) |
| `about` | об игре, трибьют, технологии |
| `play` | игра + HUD; сюда же входят баннеры волн, intro босса, «волна зачищена» |
| `paused` | затемнение + пауза-меню (продолжить/настройки/заново/в меню) |
| `dead` | игрок повержен, короткий оверлей, авто-респаун или gameover |
| `gameover` | итоги, рекорд, кнопки «Ещё раз» / «В меню» |
| `victory` | победа, статистика, «Ещё раз» / «В меню» |

Настройки, вызванные из паузы (`state.settingsFrom === 'paused'`), возвращаются в паузу;
из титула — в титул. `state.helpFrom`, `state.aboutFrom` аналогично.

**Сюжет.** НЕОН-СИТИ, 1987. Корпорация «ТОКСИК» украла чип `NEON-8` — сердце города.
Гаснут вывески, улицы делят банды. **Кай-Комета** и киборг-кузнец **Рок-Молот** идут возвращать чип.
В финале — корпоративный ИИ **ХРОМ-9** на крыше башни «ТОКСИК».

**Зоны и волны** (5 волн, один забег ~5–7 минут):

1. `street` «НЕОНОВЫЙ ПРОСПЕКТ» — волна 1 (2 гопника), волна 2 (2 гопника + ниндзя)
2. `arcade` «АРКАДНЫЙ ПЕРЕУЛОК» — волна 3 (2 ниндзя + бугай)
3. `roof` «КРЫША „ТОКСИК“» — волна 4 (2 бугая + 2 ниндзя), волна 5 — босс

Типы врагов: `punk` (маджента-ирокез), `ninja` (фиолетовый), `brute` (оранжевый, тяжёлый),
`boss` (`char:'khrom'`, ИИ ХРОМ-9 в теле ховер-погрузчика, парит). Босс: 2 фазы, телепорт,
удар силовым кабелем (атака `cable`), веер энергошаров, при 50 % HP призывает двух ниндзя.

---

# 2. `window.NR` — состояние и API (пишет Lead)

```js
NR.W === 480, NR.H === 270
NR.settings          // см. выше
NR.state             // см. ниже
NR.input             // см. §4
NR.t(key, vars)      // локализация: NR_T(key, vars), поддержка {n} и {name}
NR.saveSettings()
NR.toggleGfx()       // 'retro' <-> 'modern', сохраняет, main сам заметит
NR.toggleLang()      // 'ru' <-> 'en'
NR.toggleMusic()
NR.init()
NR.update(dt)        // dt в секундах, клампится main'ом
NR.startRun(charIdx, difficulty)
NR.press(action)     // дискретные действия (см. §4)
NR.setHeld(name, on) // held: left/right/up/down/jump/punch/kick/special
NR.pointerDown(x,y)  // логические координаты 480×270
NR.pointerUp(x,y)
NR.debug = { ... }   // §6
```

### `NR.state`

```js
{
  mode, modeT, t,                 // t — общее время, сек
  freeze,                         // true — симуляция play стоит (для скриншотов)
  menuIndex, pauseIndex, settingsIndex,
  settingsFrom, helpFrom, aboutFrom,
  select: { char: 0|1, diff: 0|1|2 },
  uiRects,                        // §5, статические прямоугольники меню
  camera: { x, shakeX, shakeY, shake },
  world: {
    width: 2200, minX, maxX, minY: 166, maxY: 250,
    groundTop: 158, groundBottom: 258
  },
  zones: [ {id:'street', nameKey:'zone.street', subKey:'zone.street.sub', start:0, end:760, accent:'#ff2e88'}, ... ],
  run: {
    char: 0|1, difficulty, score, best, newBest, lives,
    wave: 0..4, waveCount: 5, waveActive: bool,
    zone: 0|1|2, elapsed, kills, maxCombo,
    combo: 0, comboT,                  // текущее комбо, сек до сброса
    hitstop: 0,                        // сек заморозки симуляции
    shake: 0, flash: 0,
    bossIntro: 0,                      // >0 — кинематик появления босса (сек осталось)
    bossDefeated: false,
    victoryT: 0, deadT: 0,
    advance: false,                    // волна зачищена, иди вперёд
    banner: { kind, titleKey, subKey, vars, t, dur } | null,
    gate: { active: bool, left, right }, // невидимые стены арены (рисуются как барьер)
    stats: { hits, kills, maxCombo }   // для финального экрана
  },
  player: actor,
  enemies: [actor],                // босс тоже здесь
  boss: actor|null,
  props: [ { id, type:'crate'|'barrel'|'vending', x, y, w, h, broken, breakT, shakeT, contains } ],
  pickups: [ { id, kind:'coin'|'food', x, y, z, life, value, heal } ],
  projectiles: [ { id, kind:'orb'|'shock'|'cable', x, y, z, vx, vy, life, maxLife, r, dmg, owner } ],
  particles: [ particle ],
  popups: [ { text, sub, x, y, z, t, dur, color, kind } ]
}
```

### Actor

```js
{
  id, kind: 'player'|'punk'|'ninja'|'brute'|'boss',
  char: 'comet'|'hammer'|'khrom',
  x, y, z,                 // x — по улице, y — глубина (ступни), z — высота прыжка
  vx, vy, vz, facing: 1|-1,
  hp, maxHp,
  state: 'idle'|'walk'|'jump'|'attack'|'hurt'|'down'|'getup'|'special'|'victory'|'dead'|'intro',
  anim: 'idle'|'walk'|'jump'|'punch1'|'punch2'|'punch3'|'kick'|'jumpkick'|'special'
       |'hurt'|'down'|'getup'|'victory'|'roar'|'slam'|'cable'|'charge'|'cast'|'dash',
  animT,                   // секунды в текущей анимации
  attack: null | { type, phase:'wind'|'hit'|'recover', t },
  hurtT, invuln, flash, dead, deadT,
  rage, maxRage, specialReady,
  comboStep,
  scale, alpha,            // 1 и 1 обычно; у босса scale 1.35, alpha для фейдов
  aiTag                    // подпись/маркер для отладки, рендерер может игнорировать
}
```

Игрок ходит по плоскости X/Y; Z — только прыжок. Экран: `sx = x - camera.x + shakeX`,
`sy = y + shakeY`, спрайт растёт вверх от `(sx, sy)`, прыжок поднимает на `z`.
Сортировка отрисовки — по `y` (глубина). Тени — эллипс под ступнями.

### Particle / Popup

```js
particle = { kind:'spark'|'dust'|'ring'|'shard'|'smoke'|'star'|'note'|'orb',
             x, y, z, vx, vy, vz, life, maxLife, size, color, rot }
popup    = { text, sub, x, y, z, t, dur, color, kind:'damage'|'score'|'combo'|'heal'|'info' }
```

---

# 3. `window.NR_AUDIO` — 8-бит музыка и звук

```js
NR_AUDIO.init()                // идемпотентно, безопасно в headless/file://
NR_AUDIO.unlock()              // по первому жесту; может быть Promise
NR_AUDIO.ready()               // bool
NR_AUDIO.setMusic(bool)
NR_AUDIO.setSfx(bool)
NR_AUDIO.setVolume(0..1)
NR_AUDIO.setStyle('chip'|'synth')
NR_AUDIO.playMusic(id)         // 'title'|'select'|'battle'|'boss'|'victory'|'gameover'
NR_AUDIO.stopMusic()
NR_AUDIO.duck(bool)            // приглушение на паузе
NR_AUDIO.intensity(0..1)       // плотность 'battle', 0..1
NR_AUDIO.sfx(id)
NR_AUDIO.state()               // { ready, playing, style, music, sfx, volume, notes }
```

SFX id: `ui_move, ui_select, ui_back, punch, kick, hit, hit_heavy, block, jump, land,
special, pickup, coin, heal, ko, crate, wave, boss_roar, explosion, player_hurt,
gameover, win`.
Требования: только WebAudio-синтез (pulse/square, triangle, noise), lookahead-секвенсор,
бесшовные циклы, оригинальные мелодии (не копии), 140–170 BPM для боя, 4+ канала,
лёгкая вариативность. `chip` — сухой 8-бит; `synth` — тот же материал, но detune-saw,
фильтр, дилей/ревер, «современный» саунд. Смена стиля на лету. Всё обязано работать
без звукового устройства и не спамить console.error.

Музыка по режимам: `title`, `select`, `battle` (волны 1–4, intensity растёт),
`boss` (волна 5), `victory`, `gameover`. Пауза — `duck(true)`. Смена — кроссфейд ~0.4 c.
`NR_AUDIO.sfx` до `init/unlock` — тихий no-op.

---

# 4. Ввод (main.js)

`main.js` держит `NR.input`:

```js
NR.input = {
  left,right,up,down,        // held, bool
  jump,punch,kick,special,   // held, bool (для буфера атак)
  pointer: {x,y}
}
```

`NR.press(action)` вызывается по нажатию (edge), где action:
`up, down, left, right, confirm, back, pause, jump, punch, kick, special,
gfx, lang, music, fullscreen`.
`NR.setHeld(name, on)` — для удержаний (движение, атаки).
`NR.pointerDown/Up(x,y)` — клики/тапы по canvas в логических 480×270 (кнопки меню,
чипы настроек). `NR.state.uiRects` даёт хитбоксы.

Клавиатура: `←→↑↓`/`WASD`; `SPACE` прыжок; `J`/`Z` удар; `K`/`X` пинок;
`L`/`V` спец; `ENTER` подтвердить; `ESC`/`P` пауза/назад; `G` графика; `T` язык;
`M` музыка; `F` полный экран. В меню работают стрелки/WASD + Enter + Esc, мышь/тап.

---

# 5. `NR.state.uiRects` и экранная сетка

Координаты — логические 480×270. Начало — левый верх. `x,y,w,h` в пикселях.

```js
uiRects = {
  menu:    [ {x,y,w,h,action:'play'|'help'|'settings'|'about'} ],       // title/end
  quick:   [ {x,y,w,h,action:'gfx'|'lang'|'music'|'fullscreen'} ],       // top-right
  pause:   [ {x,y,w,h,action:'resume'|'settings'|'restart'|'title'} ],
  settings:[ {x,y,w,h,id:'lang'|'gfx'|'music'|'audioStyle'|'sfx'|'volume'|'crt'|'difficulty'|'reset'} ],
  chars:   [ {x,y,w,h,index:0|1} ],
  diffs:   [ {x,y,w,h,index:0|1|2} ],
  end:     [ {x,y,w,h,action:'retry'|'title'} ],
  back:    {x,y,w,h},                                                    // help/about/settings
  selectStart: {x,y,w,h}
}
```

Рекомендованная сетка (строки меню — из `uiRects`, рендерер обязан их использовать):

* title: логотип y≈18–120, меню x=160,w=160,h=18, y=164+i*21 (4 шт.), подсказка y≈248.
* select: карточки x=36/246, y=52, w=198, h=150; сложность — 3 пилюли y=216.
* settings: строки x=96,w=288,h=15, y=76+i*17 (9 шт.).
* help/about: контент x=40..440, y=52..236.
* pause: затемнение; меню x=160,w=160,h=18, y=112+i*21 (4 шт.).
* gameover/victory: заголовок y≈56, статистика y≈106–164, кнопки x=170,w=140,h=18,y=188+i*22.
* быстрые чипы: x=250+i*56, y=8, w=52, h=13 — рисуются на title/select/help/settings/about/paused,
  label строится из текущих значений (G · 8-БИТ, T · RU, M · ВКЛ, F · ⛶).
* HUD: здоровье x=12,y=10,w=150,h=10; ярость x=12,y=24,w=110,h=5; жизни x≈12,y=36;
  очки справа x≤468,y=12; волна по центру y=12; полоса босса x=110,y=34,w=260,h=10.
  Точную стилистику каждый рендерер выбирает сам, но данные и позиции — общие.

Экраны рисуют рендереры целиком, включая фон, меню, HUD и оверлеи. `main.js` только
масштабирует canvas и добавляет CRT/зерно поверх готового кадра в обоих режимах (лёгкое).

---

# 6. Отладка и скриншоты

`NR.debug` (Lead) обязан уметь:

```js
NR.debug.scene('title'|'select'|'help'|'settings'|'about'|'intro'|'play'|'boss'|'paused'|'gameover'|'victory')
NR.debug.zone(0|1|2)     // перейти в зону в play
NR.debug.spawn('punk'|'ninja'|'brute')
NR.debug.killAll()       // зачистить волну
NR.debug.rage()          // полная шкала
NR.debug.hp(n)           // HP игрока
NR.debug.freeze(bool)    // остановить симуляцию для скриншота
NR.debug.demo()          // красивая боевая сцена: игрок, 3 врага, искры, комбо
```

main.js поддерживает URL-хэш для QA:
`#scene=play&gfx=modern&lang=en&freeze=1`, `#scene=boss`, `#scene=victory` и т.п.
После загрузки вызывает `NR.debug.scene(...)`, ставит gfx/lang.

Каждый рендерер делает превью `tmp/preview-<name>.html`, подключающее `src/*.js`
(обычные `<script src>`), с кнопками/хэшем, и проверяет себя через `probe.mjs`.
Скриншоты — в `reports/shots/<name>.png`. Скриншоты обязаны быть прочитаны глазами.

---

# 7. Визуальный стиль

**Общая идея: «неоновый аркадный ремастер»**. Тёмный сине-фиолетовый город, кислотный
лайм, горячая маджента, циан, янтарь. Крупная плакатная типографика, диагонали,
«стеклянные» панели, зерно/скан-линии, дождь, отражения.

**Retro:** 8-бит, ограниченная палитра (~14 цветов), чанки 2–3 px, дизеринг, пиксельный
шрифт `NR_FONT` (6×8), крупные пиксельные логотипы, CRT-полосы (main добавит сверху).
Цвета: `#0a0718` фон, `#1b1440` тени, `#ff2e88` маджента, `#22e6ff` циан,
`#b6ff3a` лайм, `#ffb300` янтарь, `#f4f0ff` белый.

**Modern:** гладкий вектор, градиенты, rim-light, glow/bloom, параллакс, дождь,
мокрый асфальт с отражениями, полупрозрачные HUD-панели, крупные системные шрифты
(`Impact, "Arial Black"` для логотипа; без внешних шрифтов). Те же композиция и герои,
но «ремастер»: объём, свет, частицы.

**Герои:**
* Кай «Комета» (`comet`) — стройный, светлая серебристая куртка с циановыми полосами,
  оранжевый шарф-«хвост кометы», острые чёрные волосы, эмблема-комета. Стиль: скорость, точность.
* Рок «Молот» (`hammer`) — человек-киборг, кузнец: массивный, бритая голова, борода,
  кибер-глаз в стальной оправе, кожаный фартук на лямках, голые руки; передняя рука —
  механическая, с раскалённым бойком молота вместо кулака, на другой — стальной наруч.
  Палитра: бронзовая кожа, сталь, кожа фартука, оранжевый «огонь горна». Стиль: сила, броня.
* Гопник — мадженты волосы-ирокез, косуха.
* Ниндзя — фиолетовый силуэт, маска, шарф.
* Бугай — оранжевый гигант, цепи.
* ИИ ХРОМ-9 (`khrom`) — корпоративный ИИ «ТОКСИК» в теле промышленного погрузчика:
  ховер-шасси с реактивными струями и полосой «осторожно», бронекорпус с пульсирующим
  реактором, голова-монитор с лицом-осциллограммой и антенной, два манипулятора с клешнями.
  Дальняя атака — силовой кабель с захватом из переднего манипулятора. Во 2-й фазе
  («перегрузка») экран и реактор из циановых становятся оранжевыми.

**Фоны:**
* street: небоскрёбы, луна, вывески «АРКАДА», «24/7», провода, дождь, лужи,
  полицейская лента/энергобарьер во время волны.
* arcade: узкий переулок, автоматы с неоновой подсветкой, граффити, пар, трубы.
* roof: крыша башни, город внизу, антенны, молнии, огромный неоновый логотип «ТОКСИК»,
  финальная арена.

**Обязательные эффекты:** тряска камеры, hitstop/вспышка при попадании, искры/пыль,
всплывающие цифры урона, счётчик комбо, шкала ярости, подсветка телеграфов атак врагов,
баннеры волн, появление босса, замедление на победе, «мокрые» отражения (modern),
дизеринг/CRT (retro).

---

# 8. `window.NR_RENDER_RETRO` / `NR_RENDER_MODERN`

```js
window.NR_RENDER_RETRO = { draw(ctx, view) };
window.NR_RENDER_MODERN = { draw(ctx, view) };
// view = { w:480, h:270, t:NR.state.t }
```

* Обе функции **полностью** заполняют кадр и рисуют **все** mode из §1.
* Читают только `NR.state`, `NR.settings`, `NR.t()`, `NR_FONT`, локальные константы.
  Не мутируют состояние игры (кроме безопасных кэшей).
* Canvas уже трансформирован: 1 единица = 1 логический пиксель. Retro рисуется в
  offscreen 480×270 с `imageSmoothingEnabled=false`; modern — в полноразмерный canvas,
  но тоже в координатах 480×270.
* Тряска камеры: мир рисуйте со смещением `camera.shakeX/shakeY`; HUD/меню — без тряски.
* Глубина: сортировка всех актёров/пропов/пикапов по `y`; тени под ступнями.
* Производительность: 60 fps, без тяжёлых фильтров на каждый объект; кэшируйте
  градиенты/фоновые слои, если нужно.
* Никаких внешних файлов, картинок, шрифтов, `fetch`, `import`.
* Проверка: `node --check`, превью, screenshot, отсутствие ошибок консоли.

---

# 9. Канонические ключи локализации

`src/i18n.js` обязан содержать **все** ключи ниже в `ru` и `en` (одинаковый набор).
`NR_T(key, vars)` подставляет `{n}`, `{total}`, `{name}`, `{score}`, `{value}`.
Рендереры и `game.js` используют только эти ключи (или сообщите Lead о новом).

```text
app.title, app.subtitle, app.tribute, app.footer, app.loading

menu.play, menu.help, menu.settings, menu.about, menu.resume,
menu.restart, menu.retry, menu.mainmenu

title.tagline, title.press, title.best, title.hint, title.version

select.title, select.subtitle, select.difficulty, select.hint, select.start

char.comet.name, char.comet.alias, char.comet.desc, char.comet.spec,
char.hammer.name, char.hammer.alias, char.hammer.desc, char.hammer.spec
stat.power, stat.speed, stat.armor, stat.range
diff.easy, diff.normal, diff.hard

intro.chapter, intro.title, intro.text1, intro.text2, intro.text3,
intro.start, intro.skip

help.title, help.move, help.moveKeys, help.jump, help.jumpKeys,
help.punch, help.punchKeys, help.kick, help.kickKeys,
help.special, help.specialKeys, help.pause, help.pauseKeys,
help.quick, help.quickKeys, help.combo, help.comboText,
help.air, help.airText, help.rage, help.rageText,
help.tipTitle, help.tip, help.back

settings.title, settings.lang, settings.gfx, settings.music,
settings.audioStyle, settings.sfx, settings.volume, settings.crt,
settings.difficulty, settings.reset, settings.resetDone, settings.hint

common.on, common.off, common.back, common.hint
gfx.retro, gfx.modern
audio.chip, audio.synth

quick.gfx, quick.lang, quick.music, quick.full

zone.street, zone.streetSub, zone.arcade, zone.arcadeSub,
zone.roof, zone.roofSub

hud.score, hud.best, hud.lives, hud.wave, hud.rage, hud.combo,
hud.boss, hud.fight, hud.clear, hud.advance, hud.specialReady,
hud.ready, hud.go, hud.mul, hud.x, hud.time

banner.wave, banner.final, banner.clear, banner.advance, banner.zone,
banner.boss, banner.bossSub, banner.victory, banner.defeat
popup.heal, popup.rage, popup.score

boss.name, boss.sub, boss.taunt1, boss.taunt2, boss.phase2

pause.title, pause.hint

end.gameoverTitle, end.gameoverSub, end.victoryTitle, end.victorySub,
end.score, end.time, end.kills, end.maxCombo, end.newBest, end.best

about.title, about.text1, about.text2, about.text3, about.tech,
about.credits, about.back
```

Рекомендуемые русские значения (локализатор может улучшить формулировки):

```text
app.title        НЕОН × ЯРОСТЬ
app.subtitle     NEON RAGE
app.tribute      оригинал студии «Гефест»
app.footer       Canvas 2D · WebAudio · один HTML-файл
app.loading      ЗАГРУЗКА НЕОНА...

menu.play ИГРАТЬ · menu.help УПРАВЛЕНИЕ · menu.settings НАСТРОЙКИ · menu.about ОБ ИГРЕ
menu.resume ПРОДОЛЖИТЬ · menu.restart ЗАНОВО · menu.retry ЕЩЁ РАЗ · menu.mainmenu В МЕНЮ
title.tagline    ДВА БОЙЦА. ОДНА УЛИЦА. НОЛЬ ПОЩАДЫ.
title.press      НАЖМИ ENTER
title.best       РЕКОРД
title.hint       ↑ ↓ — выбор · ENTER — ок · мышь/тап — тоже работает
select.title     ВЫБЕРИ БОЙЦА
select.subtitle  ДВА СТИЛЯ. ОДНА ЦЕЛЬ.
select.difficulty СЛОЖНОСТЬ
select.hint      ← → — боец · ↑ ↓ — сложность · ENTER — в бой
select.start     ENTER — В БОЙ
char.comet.name КАЙ
char.comet.alias КОМЕТА
char.comet.desc Быстрый и точный. Серии из трёх ударов и огненный апперкот.
char.comet.spec СПЕЦ: ОГНЕННОЕ КОЛЬЦО
char.hammer.name   РОК
char.hammer.alias  МОЛОТ
char.hammer.desc   Киборг-кузнец с рукой-молотом. Больше здоровья.
char.hammer.spec   СПЕЦ: ЗЕМЛЯНОЙ СЛЭМ
stat.power СИЛА · stat.speed СКОРОСТЬ · stat.armor БРОНЯ · stat.range РАДИУС
diff.easy ЛЕГКО · diff.normal НОРМА · diff.hard ХАРД
intro.chapter    ГЛАВА 1
intro.title      УКРАДЕННЫЙ ЧИП
intro.text1      НЕОН-СИТИ, 1987. Корпорация «ТОКСИК» украла чип NEON-8 — сердце города.
intro.text2      Без него гаснут вывески, а улицы делят банды. Город вот-вот замолчит.
intro.text3      Кай-Комета и Рок-Молот выходят на улицу. Вдвоём. Но играть будешь одним.
intro.start      ENTER — НАЧАТЬ
intro.skip       ESC — ПРОПУСТИТЬ
help.title       УПРАВЛЕНИЕ
help.move ДВИЖЕНИЕ · help.moveKeys ← → ↑ ↓ / WASD
help.jump ПРЫЖОК · help.jumpKeys SPACE
help.punch УДАР · help.punchKeys J / Z — серия из 3
help.kick ПИНОК · help.kickKeys K / X — тяжёлый
help.special ЯРОСТЬ · help.specialKeys L / V — при полной шкале
help.pause ПАУЗА · help.pauseKeys ESC / P
help.quick БЫСТРО · help.quickKeys G графика · T язык · M музыка · F экран
help.combo КОМБО · help.comboText Чередуй удары и пинки — множитель очков растёт.
help.air В ВОЗДУХЕ · help.airText Атака в прыжке бьёт по площади.
help.rage ШКАЛА ЯРОСТИ · help.rageText Заполняется от попаданий. Спецприём бьёт всех вокруг.
help.tipTitle СОВЕТ · help.tip Бей по одному, не давай окружить. Еда в ящиках лечит.
help.back ESC — НАЗАД
settings.title   НАСТРОЙКИ
settings.lang ЯЗЫК · settings.gfx ГРАФИКА · settings.music МУЗЫКА
settings.audioStyle СТИЛЬ МУЗЫКИ · settings.sfx ЗВУКИ · settings.volume ГРОМКОСТЬ
settings.crt CRT-ФИЛЬТР · settings.difficulty СЛОЖНОСТЬ · settings.reset СБРОСИТЬ РЕКОРД
settings.resetDone РЕКОРД СБРОШЕН · settings.hint ← → — изменить · ESC — назад
common.on ВКЛ · common.off ВЫКЛ · common.back НАЗАД
gfx.retro 8-БИТ · gfx.modern НЕОН · audio.chip 8-БИТ · audio.synth СИНТВЕЙВ
quick.gfx ГРАФИКА · quick.lang ЯЗЫК · quick.music МУЗЫКА · quick.full ЭКРАН
zone.street НЕОНОВЫЙ ПРОСПЕКТ · zone.streetSub КВАРТАЛ 7 · НОЧЬ
zone.arcade АРКАДНЫЙ ПЕРЕУЛОК · zone.arcadeSub ПОД ВЫВЕСКОЙ «24/7»
zone.roof КРЫША «ТОКСИК» · zone.roofSub ВЫСОТА 300 М · ВЕТЕР
hud.score ОЧКИ · hud.best РЕКОРД · hud.lives ЖИЗНИ · hud.wave ВОЛНА
hud.rage ЯРОСТЬ · hud.combo КОМБО · hud.boss ИИ ХРОМ-9
hud.fight В БОЙ! · hud.clear ЗАЧИЩЕНО · hud.advance ВПЕРЁД →
hud.specialReady ЯРОСТЬ ГОТОВА · hud.ready ГОТОВ · hud.go ВПЕРЁД
hud.mul МНОЖИТЕЛЬ · hud.x × · hud.time ВРЕМЯ
banner.wave ВОЛНА {n}/{total} · banner.final ФИНАЛЬНАЯ ВОЛНА
banner.clear ВОЛНА ЗАЧИЩЕНА · banner.advance ВПЕРЁД →
banner.zone {name} · banner.boss ФИНАЛЬНЫЙ БОСС
banner.bossSub ЯДРО КОРПОРАЦИИ «ТОКСИК» · banner.victory ГОРОД СВОБОДЕН
banner.defeat УЛИЦА СИЛЬНЕЕ
popup.heal +{n} HP · popup.rage ЯРОСТЬ ГОТОВА! · popup.score +{n}
boss.name ИИ ХРОМ-9 · boss.sub ЯДРО КОРПОРАЦИИ «ТОКСИК»
boss.taunt1 «Вы опоздали. Город уже подключён ко мне.»
boss.taunt2 «Весь неон города — моё питание.»
boss.phase2 «ПЕРЕГРУЗКА!»
pause.title ПАУЗА · pause.hint ESC — продолжить
end.gameoverTitle ИГРА ОКОНЧЕНА · end.gameoverSub УЛИЦА ЗАБРАЛА ЕЩЁ ОДНОГО
end.victoryTitle ГОРОД СПАСЁН · end.victorySub ЧИП NEON-8 ВОЗВРАЩЁН. ГОРОД СНОВА ЗВУЧИТ.
end.score ОЧКИ · end.time ВРЕМЯ · end.kills ПОБЕД · end.maxCombo МАКС. КОМБО
end.newBest НОВЫЙ РЕКОРД! · end.best РЕКОРД
about.title ОБ ИГРЕ
about.text1 Оригинальный beat-em-up студии «Гефест».
about.text2 Все персонажи, графика и музыка оригинальны и созданы кодом — без внешних ассетов.
about.text3 Retro- и modern-рендеры рисуют один и тот же бой; музыка синтезируется WebAudio.
about.tech Canvas 2D · WebAudio · ES2019 · 0 внешних файлов
about.credits СТУДИЯ ГЕФЕСТ · 2026
about.back ESC — НАЗАД
```

Английские значения — живые, короткие, в духе аркадного плаката. Никаких непереведённых
русских строк в `en` и наоборот.
