# РАСКАТ (папка grom) — контракт модулей

Игра аркады «Гефест» на фреймворке Гефест Arcade v2.10 (`engine.js`). Общий стандарт: офлайн, `file://`,
без внешних URL/шрифтов/ассетов, RU/EN, темы modern/retro (меняют только отрисовку), WebAudio-звук,
рекорд в `localStorage` (`arcade.best.grom`, пишет движок). Других ключей хранилища игра не заводит.
Права: название, герой, враги, боссы, зоны, оружие, арт, палитры, звуки и музыка — оригинальные;
чужих имён нет (тест «правило имён» в `tests/engine.test.mjs`, стоп-лист — в base64).

## js/game.js — `GROM.Game(opts)` (без DOM, детерминирована при заданном `rng`)
`opts`: `{ rng, onEvent(type,data), level=1, maxLevel=4, dmgMul=1 }`.

Единицы — клетки (1 клетка = 16 px), секунды; y вниз. Экран 640×360 (16:9): HUD 40 px + окно 40×20 клеток. Тело: `x` — центр, `y` — низ.

API: `start()` → api · `update(dt)` (шаг 1/60) · `setInput({dx,dy,jump,fire})` (удержания; −1/0/1) · `dash()` → bool (бросок-молния в сторону
`dx,dy` последнего `setInput`) · `cont()` → bool · `revive()` → bool («ещё один шанс» за рекламу после `over`) · `canBoost()` / `boost()` (полная броня и заряд) · `state()` → S.
Отладка/тесты: `_place(x,y)`, `_hurt(d,why)`, `_boom(x,y,r,dmg,src)`, `_startBoss()`, `_hitBoss(d)`, `_load(n)`, `_tileHit(c,r,d)`, `_spawn(type,x,y,o)`.

`S`: `level, lv (шаблон уровня), zone, W, H, t (Uint8: 0 пусто, 1 скала, 2 платформа, 3 трещина, 4 бонус-блок, 5 ворота, 6 медная заслонка), thp (прочность),
score, lives, conts, time, ltime, phase('play'|'dead'|'cont'|'clear'|'over'|'won'), phaseT, banner, flash, cam{x,y},
hero{x,y,vx,vy,face,ground,hp,inv,charge (0..3),dash (остаток броска, с),ddx,ddy,dhit,fireCd,aim{x,y},runT,shotT},
weapon{k:'S'|'L'|'B',lv:1..3}, enemies[{type,x,y,hw,hh,hp,max,dir,cd,warn,flash,dead,mount}], bullets[…], eb[…], claps[{x,y,t}] (отложенные громы),
items[{k,x,y,…}] (`gem hp life charge cap beacon`), booms, waves, marks, boss{…}|null, bossActive, bossDone, portal{x,y}|null, cp{x,y}, visited{room:1}, secrets, gems, kills`.

События `onEvent`: `level`, `jump`, `land`, `shot{k,lv}`, `bounce`, `wall`, `dash{x,y,dx,dy}`, `noDash`, `clap{x,y}`, `boom{x,y,r,src}`,
`hurt`, `die`, `respawn`, `cont`, `continue`, `kill{type,x,y,pts,how}`, `hit`, `break{x,y,k}`, `pickup{k,w,x,y}`, `weapon`, `beacon`, `secret`, `extraLife`,
`eshot`, `hop`, `deflect`, `bossIntro`, `phase`, `bossHit`, `stomp`, `summon`, `markWarn`, `strike`, `bossDie`, `portal`, `clear{level,bonus}`, `timeLow`, `gameover`, `win`.

Правила:
- Физика: гравитация 60, бег 7, прыжок 24.5 (≈ 5 клеток), обрезка прыжка при отпускании до 9, буфер прыжка 0.12 с, «койот» 0.08 с; тело героя 0.76×1.8; оси раздельно.
- **Бросок-молния (`startDash`)**: заряд ≥ 1 (макс. `CHARGE` = 3); скорость 38 кл/с, длительность 0.17 с (вверх ×0.72, по диагонали ×0.8); без гравитации,
  неуязвим на время броска + 0.15 с; `S.pass` делает медные заслонки (тайл 6) проходимыми; если бросок кончился внутри заслонки — тянется дальше (≤ 0.3 с);
  удар о стену обрывает. Враг на пути — 3 урона (убийство возвращает 0.5 заряда), босс — 6 (раз за бросок). Вражеские пули при броске гаснут.
- **Раскат**: `dash()` кладёт в `S.claps` точку старта; через `CLAP_T` = 0.45 с — `boom` радиусом 2.7, урон 6 (боссу ×0.8), ломает трещины и блоки.
- Заряд копится на земле 1/с, в воздухе ×0.35; пикап `charge` — полный; на новую жизнь — полный.
- Оружие `WEAP`: S (cd 0.16, 3/5/5 пуль), L (cd 0.2, пробивает, урон 2/3/4), B (cd 0.18, 1/2/3 шара, отскоков 2/3/4). Во время броска не стреляет.
- Враги `FOES` активны в окне ±24×±14 клеток от героя; урон врагов и боссов ×(1 + 0.18·(уровень−1)).
- Жизнь: броня 8, неуязвимость после удара 1 с, после возврата 2.2 с; возврат — к последнему громоотводу (в бою и после — на арену); ступень оружия −1.
  Жизни кончились → `cont` 9 с (если есть продолжение: `cont()` — уровень заново, 3 жизни, счёт пополам) → `over`; из `over` — `revive()`.
- Таймер уровня `LEVELS[n].time`; 0 — гибель, после возврата таймер ≥ 120 с. После победы над боссом таймер стоит.
- Боссы `BOSSES` (3 фазы по порогам здоровья, смена фазы — 1 с неуязвимости; гибель героя в бою — босс +20% здоровья).
  Победа → 2 с → портал; касание портала → `clear` (бонус: 10·секунды + 1000·уровень) → 3 с → следующий уровень или `won`.

`GROM.logic`: константы, `LEVELS`, `WEAP`, `FOES`, `BOSSES`, `buildLevel(n)` / `level(n)` (кэш; детерминированный генератор:
дерево комнат DFS + петли до ≥ 2 рёберно-независимых путей к предбаннику, тайники за `crack`/`hatch`/медной заслонкой (`tunnel` в `conns`), шахты с лестницей уступов,
платформы, бонус-блоки, ящики, самоцветы, громоотводы, враги, арена с воротами), `solid`, `boxFree`, `move`, `heroPhys`, `startDash`, `los`,
`ACTS` + `Macro` (макросы движения: walk, jump, jumpD, dash), `simulate`, `nodeOf`, `isNode`, `Nav(lv,{broken,gates})` — граф проходимости,
рёбра которого проверены симуляцией физики с двух смещений старта (`edges`, `reach`, `field`), `mulberry32`.

## Рендеры
`GROM.makeRenderer(P)` — общее ядро процедурных спрайтов; `GROM.modern` / `GROM.classic` — палитры (P.pixel — стиль retro).
Методы: `bg, tiles (в т.ч. медная заслонка), item, portal, clap (кольцо отложенного грома), enemy, boss, wave, mark, hero(ctx,h,x,y,t,S,scale; при `h.dash > 0` — молния со следом), bullet, ebullet, boom, storm,
lifeIcon, weaponIcon, boltIcon, boltGlyph`. `GROM.ui.render(g, ctx, S, R, {bare,shake,cam,noHero})` — камера, мир, частицы,
подписи, полоса босса, баннеры, HUD с мини-картой; тексты только через `g.t()`.

## main.js
`Arcade.createGame({gameId:'grom', leaderboard:'grom'})`, `useStandardScreens`, `g.input.setPlayers` (одна раскладка, действия `jump/fire/dash`; геймпад: A/B/X),
плавающий стик `js/stick.js` + тач-кнопки удержания (`data-hold`: fire/jump) и нажатия (`data-tap`: dash/pause), титул — панорама Литейного двора
с героем и броском, сцена `play` (фикс-шаг 1/60), подсказки 1-го уровня, площадка (лидерборд, «Без рекламы», реклама за награду, `adBreak` после уровня),
миграция `arcade.grom.v`. Отладка/QA: `GROM.g`, `GROM.app.game()`, `GROM.app.newGame({level})`.

## Definition of Done
- `node grom/tests/engine.test.mjs` — все тесты зелёные (включая баланс ботом); `node tools/smoke.mjs` — PASS grom.
- В браузере: титул → игра (Enter) → пауза (P) → T/L/M работают; 0 ошибок консоли.
