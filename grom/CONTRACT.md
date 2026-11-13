# ГРОМ — контракт модулей

Игра аркады «Гефест» на фреймворке Гефест Arcade v2.2 (`engine.js`). Общий стандарт: офлайн, `file://`,
без внешних URL/шрифтов/ассетов, RU/EN, темы modern/retro (меняют только отрисовку), WebAudio-звук,
рекорд в `localStorage` (`arcade.best.grom`, пишет движок). Других ключей хранилища игра не заводит.
Права: название, герой, враги, боссы, зоны, оружие, арт, палитры, звуки и музыка — оригинальные;
чужих имён нет (тест «правило имён» в `tests/engine.test.mjs`, стоп-лист — в base64).

## js/game.js — `GROM.Game(opts)` (без DOM, детерминирована при заданном `rng`)
`opts`: `{ rng, onEvent(type,data), level=1, maxLevel=4, dmgMul=1 }`.

Единицы — клетки (1 клетка = 16 px), секунды; y вниз. Экран 640×384: HUD 32 px + окно 40×22 клеток. Тело: `x` — центр, `y` — низ.

API: `start()` → api · `update(dt)` (шаг 1/60) · `setInput({dx,dy,jump,fire,beam})` (удержания; −1/0/1) · `wheel()` (переключить форму) ·
`setForm('man'|'wheel')` · `thunder()` → bool · `cont()` → bool · `state()` → S.
Отладка/тесты: `_place(x,y)`, `_hurt(d,why)`, `_boom(x,y,r,dmg,src)`, `_startBoss()`, `_hitBoss(d)`, `_load(n)`, `_tileHit(c,r,d)`, `_spawn(type,x,y,o)`.

`S`: `level, lv (шаблон уровня), zone, W, H, t (Uint8: 0 пусто, 1 скала, 2 платформа, 3 трещина, 4 бонус-блок, 5 ворота), thp (прочность),
score, lives, conts, time, ltime (таймер уровня), phase('play'|'dead'|'cont'|'clear'|'over'|'won'), phaseT, banner, flash, cam{x,y},
hero{x,y,vx,vy,face,ground,form,hp,inv,charge,fireCd,beam{on,ang,len,ox,oy,ex,ey},aim{x,y},runT,shotT},
weapon{k:'S'|'L'|'B',lv:1..3}, thunder, enemies[{type,x,y,hw,hh,hp,max,dir,cd,warn,flash,dead,mount}], bullets[{x,y,vx,vy,dmg,k,life,bounces,len,hit}],
eb[{x,y,vx,vy,r,dmg,g,bomb}], mines[{x,y,t}], items[{k,x,y,w?,on?,got}], booms, waves[{x,dir,y,v,t}], marks[{x,t,warn,strike,y0,y1}],
boss{key,x,y,hw,hh,hp,max,phase,shift,intro,dead,deadT,…}|null, bossActive, bossDone, portal{x,y}|null, cp{x,y}, visited{room:1}, secrets, gems, kills, lastBonus`.

События `onEvent`: `level{n,zone}`, `jump`, `land`, `shot{k,lv}`, `bounce`, `wall`, `beam{on}`, `mine`, `boom{x,y,r,src}`, `thunder{n}`,
`wheel{on}`, `noWheel`, `hurt{x,y,why,hp}`, `die{x,y,why}`, `respawn`, `cont{conts}`, `continue`, `kill{type,x,y,pts,how}`, `hit{x,y}`,
`break{x,y,k:'crack'|'bonus'}`, `pickup{k,w,x,y}`, `weapon{k,lv}`, `beacon{x,y}`, `secret{x,y}`, `extraLife`, `eshot`, `hop`, `deflect`,
`bossIntro{key}`, `phase{phase,x,y}`, `bossHit`, `stomp`, `summon`, `markWarn`, `strike{x}`, `bossDie{x,y,key}`, `portal{x,y}`,
`clear{level,bonus}`, `timeLow`, `gameover{score}`, `win{score}`.

Правила:
- Физика: гравитация 60, бег 7, прыжок 24.5 (≈ 5 клеток), обрезка прыжка при отпускании до 9, буфер прыжка 0.12 с, «койот» 0.08 с;
  тело героя 0.76×1.8, колесо 0.76×0.85 (бег 9); оси раздельно, подшаги ≤ 0.4. Все непустые тайлы — твёрдые.
- Луч-кнут: пока держится — герой стоит (прыгать нельзя), угол поворачивается к направлению стрелок со скоростью 7 рад/с;
  длина ≤ 7 (до стены), урон 9/с врагам и боссу, трещинам/бонус-блокам; гасит вражеские пули; предметы на луче подтягиваются к герою.
- Оружие `WEAP`: S (cd 0.16, 3/5/5 пуль), L (cd 0.2, пробивает, урон 2/3/4), B (cd 0.18, 1/2/3 шара, отскоков 2/3/4).
- Колесо: свернуться можно при заряде ≥ 0.6; заряд 5 с, тратится 1/с, мина — 0.6; развернуться — только если хватает места; при нуле — само.
  Неуязвимо: урон 0, вражеские пули гаснут; касание врага — 4 урона/с врагу. Мина: радиус 2.3, урон 9 (боссу ×0.8), ломает K/B.
- Молния: −1 заряд, 20 урона врагам в кадре, 12 боссу, пули и метки гаснут. На новую жизнь — не меньше 2.
- Враги `FOES` активны в окне ±24×±14 клеток от героя; урон врагов и боссов ×(1 + 0.2·(уровень−1)).
- Жизнь: броня 8, неуязвимость после удара 1 с, после возврата 2.2 с; возврат — к последнему громоотводу (в бою и после — на арену);
  ступень оружия −1. Жизни кончились → `cont` 9 с (если есть продолжение: `cont()` — уровень заново, 3 жизни, счёт пополам) → `over`.
- Таймер уровня `LEVELS[n].time`; 0 — гибель, после возврата таймер ≥ 120 с. После победы над боссом таймер стоит.
- Боссы `BOSSES` (3 фазы по порогам здоровья, смена фазы — 1 с неуязвимости; гибель героя в бою — босс +20% здоровья).
  Победа → 2 с → портал; касание портала → `clear` (бонус: 10·секунды + 1000·уровень) → 3 с → следующий уровень или `won`.

`GROM.logic`: константы, `LEVELS`, `WEAP`, `FOES`, `BOSSES`, `buildLevel(n)` / `level(n)` (кэш; детерминированный генератор:
дерево комнат DFS + петли до ≥ 2 рёберно-независимых путей к предбаннику, тайники за `crack`/`hatch`/`tunnel`, шахты с лестницей уступов,
платформы, бонус-блоки, ящики, самоцветы, громоотводы, враги, арена с воротами), `solid`, `boxFree`, `move`, `heroPhys`, `setForm`, `los`,
`ACTS` + `Macro` (макросы движения: walk, jump, jumpD, roll), `simulate`, `nodeOf`, `isNode`, `Nav(lv,{broken,gates})` — граф проходимости,
рёбра которого проверены симуляцией физики с двух смещений старта (`edges`, `reach`, `field`), `mulberry32`.

## Рендеры
`GROM.makeRenderer(P)` — общее ядро процедурных спрайтов; `GROM.modern` / `GROM.classic` — палитры (P.pixel — стиль retro).
Методы: `bg, tiles, item, portal, mine, enemy, boss, wave, mark, hero(ctx,h,x,y,t,S,scale), beam, bullet, ebullet, boom, storm,
lifeIcon, weaponIcon, boltIcon, boltGlyph`. `GROM.ui.render(g, ctx, S, R, {bare,shake,cam,noHero})` — камера, мир, частицы,
подписи, полоса босса, баннеры, HUD с мини-картой; тексты только через `g.t()`.

## main.js
`Arcade.createGame({gameId:'grom'})`, `useStandardScreens`, `g.input.setPlayers` (одна раскладка, действия `wheel/thunder/fire/jump`,
тач-крестовина), тач-кнопки удержания (`data-hold`: jump/fire/beam) и нажатия (`data-tap`: wheel/thunder/pause), титул — панорама
Литейного двора с героем и колесом, сцена `play` (фикс-шаг 1/60), P на паузе — продолжить. Отладка/QA: `GROM.g`, `GROM.app.game()`,
`GROM.app.newGame({level})`.

## Definition of Done
- `node grom/tests/engine.test.mjs` — все тесты зелёные (включая баланс ботом); `node tools/smoke.mjs` — PASS grom.
- В браузере: титул → игра (Enter) → пауза (P) → T/L/M работают; 0 ошибок консоли.
