# Гефест Arcade — общий микро-движок

`engine.js` — vanilla JS, **0 зависимостей**. Выносит повторяющийся бойлерплейт игр аркады и
встраивает критерии: **проходимость** (win/lose + финал), **играбельность** (отзывчивый ввод
клавиатура+тач-дпад, звук/частицы/HUD), **непресность** (рампа сложности, обратная связь).
Игры остаются самодостаточными: `build.sh` копирует `engine.js` в каждую игру (ссылка `./engine.js`).

## Быстрый старт
```html
<canvas id="c" width="432" height="432"></canvas>
<div class="pad"><button data-d="U">▲</button>…</div>
<script src="./engine.js"></script>
<script>
  const g = Arcade.createGame({ canvas:'#c', width:432, height:432 }); // pixel-art по умолчанию
  g.input.bindDpad(document.querySelector('.pad'));                    // тач-дпад телефона
  g.useStandardScreens({ title:'ИГРА', subtitle:'…', accent:'#ffd15e' }); // title/win/gameover
  g.scene('play', { realtime:true, enter(){…}, update(dt){…}, draw(ctx){…}, press(a){…} });
  g.start('title');
</script>
```

## API (кратко)
- `Arcade.createGame({canvas,width,height,step?,lives?,pixel?})` → движок `g`.
- **Сцены:** `g.scene(name,{realtime?,enter,update(dt),draw(ctx),press(action)})`, `g.goto(name,data)`, `g.start(name)`, `g.stop()`.
  `realtime:false` — фикс-шаг (детерминированная физика, накопитель); `true` — update получает реальный dt.
- **Ввод:** `g.input.dir{x,y}`, `g.input.pressed('up'|'down'|'left'|'right'|'action')`, `g.input.onPress(cb)`, `g.input.bindDpad(root)`.
  Клавиши: WASD/стрелки, Space=action, Enter=start, P=pause, M=mute.
- **Звук:** `g.audio.beep(freq,dur,type,vol)`, `g.audio.toggle()`.
- **Рисование:** `g.clear(c)`, `g.rect(x,y,w,h,c)`, `g.sprite(img,x,y,w,h)`, `g.text(s,x,y,{size,color,align,weight})`, `g.hud({score,level,lives})`, `g.overlay(title,sub,color)`.
- **Сетка:** `new Arcade.Grid(cols,rows,tile,fill)` → `get/set/inside/forEach/fill/px`.
- **Частицы:** `g.particles.spawn(x,y,{count,speed,life,color,size})` (обновляются/рисуются сами).
- **Спрайты:** `Arcade.loadSprites({key:dataURI},done)` → `{key:Image}`.
- **Проходимость/сложность:** `g.state{score,lives,level}`, `g.win()`, `g.gameover()`, `g.nextLevel()`,
  `g.difficulty(base,step,max)`, `g.useStandardScreens({title,subtitle,accent,bg,lives})`.
- **Адаптив:** `g.fit(maxCssWidth)` (вызывать на `resize`).

Рабочий образец — `_shared/example/index.html` (игра «ИСКРА»: сбор + уклонение, 5 уровней, победа).

## Порядок портирования игр (волнами)
Простые модульные сначала, крупные одиночные — отдельными волнами с браузерным смоуком:
1. rubikon, kaskad, zvero-otryad(1/2), plashch, redut, saga-2
2. hrum, kolobok, bolt, ruslo, krot
3. крупные single-file: obval, vihr, rubezh, proryv, saga, neon-rage (осторожно, по одной)
Старатель — эталон механики (уже финальный), переводится в волну 1 как референс.
