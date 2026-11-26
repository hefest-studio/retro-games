# ЩЁЛК (TICKFLIP, слаг `tsep`) — контракт модулей

Игра аркады «Гефест» на фреймворке Гефест Arcade v2.10 (`engine.js`). Офлайн, `file://`, без сборки, CDN и шрифтов из сети, 5 языков
(ru, en, tr, es, pt), темы modern/retro (меняют только отрисовку), WebAudio, рекорд и платформенные хуки через движок. Название, сеттинг
(часовой завод), герой (наладчик «Гефеста»), враги, стражи, арт, звуки и музыка — оригинальные; чужих имён нет (проверяет тест).

Порядок подключения: `engine.js` → `js/music.js` → `js/i18n.js` → `js/levels.js` → `js/game.js` → `js/audio.js` → `js/render.js` → `js/stick.js` → `js/main.js`.
Всё лежит в `window.TSEP` (в Node — `globalThis.TSEP`).

## js/levels.js — `TSEP.FLOORS`, `TSEP.ROUTE`, `TSEP.floorKey(fi)`, `TSEP.build(key)`
Этаж: `{ key, boss, bhp, w, h, arena:{x, y}, final?, paint(P) }`. Шесть этажей: works, pendulum, springs, gears, flywheel, heart. Карта рисуется
кистью `P` (`put fill ground ceil clear st pend lift …`). Тайлы: E 0, SOL 1, ONE 2, STR 3, STL 4, SAW 5, **PA 6** (твёрд в фазе 0), **PB 7** (твёрд в фазе 1).
Арена — последние 32 колонки (проверяется). `build(key)` → `{ W, H, t, items[{x,y,k}], foes, start, cps, boss, bhp, gate, arena, stairs, mov, hasPh, ph, final }`;
предметы: `spark` (винтик), `spark5`, `coil` (катушка), `oil` (масло, здоровье), `token` (жетон).

## js/game.js — `TSEP.Game(opts)` (без DOM, детерминирована), `TSEP.logic`
API: `start()`, `update(dt)` (шаг 1/60), `setInput({dx, up, down, jump, flick})`, `continueGame()`, `giveUp()`, `reviveAd()`, `canBoost()`, `boost()`,
`state()`, `clone()`, `saveData()` → `{fi, coil, sparks, score}`. Тестовые хуки: `_floor(fi)`, `_place(x,y)`, `_hurt(d, fromX)`, `_die()`, `_coil(n)`,
`_startBoss()`, `_bossDamage(n)`, `_spawn(type,x,y)`, `_flick()`.
Фаза мира живёт в `S.ph` (0 — ТИК, 1 — ТАК) и синхронизируется в `lv.ph` в начале `update` и в `flick` (клоны делят `lv` — читать фазу только из `S.ph`).
Щелчок: откат `K.FLICK_CD` (0,7 с); заклинивает (событие `jam`), если новая фаза замуровала бы героя; давит врагов в выросших блоках (`crush`);
волна радиусом `K.R[coil]` и уроном `K.DMG[coil]` бьёт врагов, стража и сбивает снаряды.
События `onEvent`: `level, flick, jam, crush, pickup, coil, kill, hit, hurt, die, respawn, checkpoint, life, boost, revived, bossIntro, bossHit, bossDie,
clear, continueQ, continued, gameover, win` и звуки стражей (`swoop`, `egg`, `stomp`, `breath` …).
`TSEP.logic`: `K, FOE, BOSS, tileAt, solid, platAt, sawHit, newHero, heroStep, simulate, flickOk, standable, nodeOf, pointNode, Nav, rideCtl, staticWorld, encode, decode`.
- **Граф** `Nav(lv)`: узел — клетка × фаза (`id = ph*W*H + r*W + c`); рёбра прогоняются настоящей физикой: шаг, спуск, прыжок (в том числе со щелчком в воздухе),
  щелчок на месте, лестница, переправа на опоре. Для тестов и бота.
- **Пароль** `encode/decode`: 5 знаков (этаж, катушка, винтики) + бит магии 22 и контрольная сумма.
- `TSEP.migrate(io)` — разовая миграция записей (маркер `arcade.tsep.v='2'`): старое сохранение стирается, прежний рекорд сохраняется отдельно.

## js/render.js — `TSEP.render(g, ctx, S, ui)`, `TSEP.R`, `TSEP.fx`
Канва 512×288: вид 32×16 клеток по 16 px + панель снизу (этаж, здоровье, плашка фазы, откат щелчка, винтики, катушка, жизни, счёт). Цвета фаз — `R.PH`.
Статичный слой кэшируется по (этаж, тема, фаза). retro — буфер 256×144.

## js/main.js
Сцены движка: title, pause, play, card (карточка этажа, `adBreak`), pwd, over/continue. Тач: `js/stick.js` + кнопки ● и ✦. Геймпад: A — прыжок, B — щелчок.
Платформы: `useRewardedContinue`, `useRewardedBonus`, `useNoAds`, `useLeaderboard('tsep')`, `persist`. Отладка: `TSEP.current` — текущая партия.

## tests
`engine.test.mjs` (37 тестов, `QUICK=1` — без партий бота), `bot.mjs` — `playFloor(T, seed, opts)`: «человеческий» бот (реакция 150–250 мс, промахи, упреждение на клонах).
