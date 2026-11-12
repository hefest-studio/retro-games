# Гефест Arcade — фреймворк (v2) · engine.js

`engine.js` — vanilla JS, **0 зависимостей**. Расширен из микро-движка (v1) в фреймворк с общими
системами, которые игры дублировали. Критерии проходимость/играбельность/непресность — встроены.

## Системы
- **Цикл:** фикс-шаг (детерминированно) + realtime; `g.scene(name,{realtime,enter,update(dt),draw(ctx),press(a)})`.
- **Ввод (унифиц.):** клавиатура WASD/стрелки + тач-дпад `g.input.bindDpad(root)`; `g.input.dir`, `pressed`, `onPress`. Space=action, Enter=start, P/Esc=pause, M=mute, L=lang, T=theme.
- **i18n RU/EN:** `Arcade.createGame({strings:{ru,en}})`, `g.t(key,fallback)`, `g.i18n.toggle()`; язык сохраняется (localStorage `arcade.lang`).
- **Темы retro/modern/neon:** `modern` — основная (чистый современный дизайн, вместо неона); `retro` — 8-бит/CGA; `neon` — опциональная (вкл. через `useStandardScreens({neon:true})`). Тема меняет палитру/шрифт/эффекты, НЕ логику: `g.th()` → {bg,panel,ink,muted,accent,good,bad,warn,grid,font,pixel,glow}. `g.setTheme()/toggleTheme()`, сохраняется (`arcade.theme`). Рисование (`clear/text/hud/overlay`) учитывает тему.
- **Звук:** 8-бит SFX `g.audio.beep(f,d,type,vol)`, `toggle()` (сохраняется). **Интерфейс музыки (задел):** `g.audio.registerMusic(name,{start(ctx),stop()})` + `playMusic/stopMusic` — под modern-тему позже регистрируется richer-плеер (сэмплы), без 8-бит; сейчас no-op, если плеер не зарегистрирован.
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

## План игр (ремейки на фреймворке с паритетом фич — retro+modern, i18n, звук; неон→modern)
Старые версии архивировать как `<game>/legacy.html` ПЕРЕД заменой; каждую новую — отдельным протестированным коммитом; аркада всегда рабочая. Эталон первым: **kaskad** или **hrum** (самые компактные: 628 / 759 строк).
Волна A: kaskad, hrum, zvero-otryad(×2), plashch, redut, bolt, kolobok. Волна B: ruslo, krot. Волна C (крупные, осторожно): rubikon, saga-2, obval, vihr, rubezh, proryv, saga, neon-rage.
