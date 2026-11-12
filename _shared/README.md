# Гефест Arcade — фреймворк (v2) · engine.js

`engine.js` — vanilla JS, **0 зависимостей**. Расширен из микро-движка (v1) в фреймворк с общими
системами, которые игры дублировали. Критерии проходимость/играбельность/непресность — встроены.

## Системы
- **Цикл:** фикс-шаг (детерминированно) + realtime; `g.scene(name,{realtime,enter,update(dt),draw(ctx),press(a)})`.
- **Ввод (унифиц.):** клавиатура WASD/стрелки + тач-дпад `g.input.bindDpad(root)`; `g.input.dir`, `pressed`, `onPress`. Space=action, Enter=start, P/Esc=pause, M=mute, L=lang, T=theme.
- **i18n RU/EN:** `Arcade.createGame({strings:{ru,en}})`, `g.t(key,fallback)`, `g.i18n.toggle()`; язык сохраняется (localStorage `arcade.lang`).
- **Темы retro/modern/neon:** `modern` — основная (чистый современный дизайн, вместо неона); `retro` — 8-бит/CGA; `neon` — опциональная (вкл. через `useStandardScreens({neon:true})`). Тема меняет палитру/шрифт/эффекты, НЕ логику: `g.th()` → {bg,panel,ink,muted,accent,good,bad,warn,grid,font,pixel,glow}. `g.setTheme()/toggleTheme()`, сохраняется (`arcade.theme`). Рисование (`clear/text/hud/overlay`) учитывает тему.
- **Звук:** 8-бит SFX `g.audio.beep(f,d,type,vol)`, `toggle()` (сохраняется). Музыка — см. раздел «Звук/музыка» ниже.
- **Меню:** `useStandardScreens({title,subtitle,lives,neon})` даёт сцены `title` (меню: Играть/Язык/Тема/Звук + показ рекорда), `pause` (Продолжить/Звук/В меню), `win`, `gameover`. Навигация ↑↓+action и клик/тап. `Arcade.Menu` — переиспользуемый.
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

## План игр (ремейки на фреймворке с паритетом фич — retro+modern, i18n, звук; неон→modern)
Старые версии архивировать как `<game>/legacy.html` ПЕРЕД заменой; каждую новую — отдельным протестированным коммитом; аркада всегда рабочая. Эталон первым: **kaskad** или **hrum** (самые компактные: 628 / 759 строк).
Волна A: kaskad, hrum, zvero-otryad(×2), plashch, redut, bolt, kolobok. Волна B: ruslo, krot. Волна C (крупные, осторожно): rubikon, saga-2, obval, vihr, rubezh, proryv, saga, neon-rage.
