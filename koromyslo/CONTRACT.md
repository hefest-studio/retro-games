# КОРОМЫСЛО — контракт модулей

Игра аркады «Гефест» на фреймворке Гефест Arcade v2 (`engine.js`). Общий стандарт: офлайн, `file://`, без внешних URL/шрифтов/ассетов,
RU/EN/TR/ES/PT, темы modern/retro (меняют только отрисовку), WebAudio-звук, рекорд в `localStorage` (`arcade.best.koromyslo`).
Права: название, правила-формулировки, арт, палитры, музыка и звуки — оригинальные; чужих имён нет.

## js/game.js — `KOROMYSLO.Game(opts)` (без DOM)
`opts`: `{ rng, level=1, lives=3, tutorial=false, difficulty(level,base,step,max), onEvent(type,data) }`.

Чаши `0…7`: плечи `DIST = [4,3,2,1,1,2,3,4]`, стороны `SIDE = [-1×4, +1×4]`, зеркало `i ↔ 7−i`, вместимость `CAP = 4`.
Гирька `{ v (1…6), rust, id }`.

API: `start()` → api · `update(dt)` · `drop(i)` → bool · `setCursor(i)` · `moveCursor(±1)` · `canDrop(i)` · `params()` · `reviveAd()` ·
`canBoost()` / `boost()` · `state()` → S.
`S`: `pans[8][], cur, next, cursor, phase ('aim'|'fall'|'over'), falls[{pan,w,t,dur,from,player}], torque, angle, lives, score, level, clears,
lvlClears, combo, maxCombo, drops, fuse, fuseMax, tut (-1 — нет), hint, time, over, ver, tips`.

События `onEvent`: `start`, `drop{pan,v}`, `land{pan,v,rust,n}`, `debris{pan,v}`, `clear{a,b,d,sum,n,pts,mult,ws}`, `even{pts}`,
`tip{side,dumped[{pan,ws}],lives,jam}`, `level{level,lives}`, `fuse{pan}`, `full{pan}`, `tutDone`, `revive`, `boost{lives}`, `gameover{score}`.

Правила:
- Ход: `drop(i)` в фазе `aim` → гирька падает 0,26 с → кладётся → снятие пар → проверка перевеса. Окалина (если пора) падает после хода
  (0,42 с) в чашу, где не вызовет перевеса (если такой нет — в уменьшающую момент).
- Снятие: для каждого плеча d — чаши `i`, `7−i` непусты и суммы равны → обе пусты, `pts = sum·d·n·5·(1+combo)`.
- Перевес: `|T| > limit` → −1 жизнь, опрокидываются крайние непустые чаши тяжёлой стороны, пока `|T| ≤ limit`. Жизни 0 → `over`.
- Конец хода игрока: комбо (+1 при паре, иначе 0); `T = 0` без пары — бонус `10·level`; 4 пары — уровень (+1 жизнь на 4, 7, 10…);
  следующая гирька; некуда положить — опрокидывание «jam»; фитиль заново.
- Фитиль: `fuse ≤ 0` → бросок в чашу под кареткой (или ближайшую свободную).

`KOROMYSLO.logic`: константы, `GEO` (450×800), `mirror`, `sumPan`, `torque`, `levelParams(level, diff)` → `{ maxW, fuse, debrisEvery, debrisMax, limit }`,
`evalMoves`, `bestMove(pans, w, { noise, rng, limit })` (подсказка/демо/бот), `panAt`, `mulberry32`.

## js/daily.js — `KOROMYSLO.daily`
`dateKey(ts, tz)`, `seed(key)`, `label(key)`, `Daily(store, key)` → `{ rng(), best(), submit(score) → { best, isNew, streak }, streak() }`.
Ключи `arcade.koromyslo.daily` (YYYYMMDD·1e7 + очки), `arcade.koromyslo.streak` (YYYYMMDD·1e3 + дни) — облако сливает `max`.

## Рендер, интерфейс
`KOROMYSLO.render.draw(ctx, S, g, o)`; `o = { bare, fx, toasts, preview, limit, daily, tutText }`. Палитры `PAL.modern/retro`, `pal(g)`.
`KOROMYSLO.ui.init(g)` — подгонка канвы и подписи страницы. Тексты — только через `g.t()`.

## main.js
`Arcade.createGame({ gameId:'koromyslo', leaderboard:'koromyslo' })`, `useStandardScreens` (титул переопределён: живое коромысло + меню
движка, `menuFit`), сцены `play`, `card` (карточка уровня под межстраничную). Площадка: `useLeaderboard` (`koromyslo`, `koromysloDaily`),
`useNoAds`, `useRewardedContinue`, `useRewardedBonus('rwLife')`, `useOwnGames`, `useShortcut`, `useReview`, `persist`, `onCloud`.
Отладка/QA: `KOROMYSLO.app.game()`, `KOROMYSLO.g`, `KOROMYSLO.current`.

## Definition of Done
- `node koromyslo/tests/engine.test.mjs` — все зелёные; `node tools/smoke.mjs` — PASS koromyslo.
- Сборки `tools/platform-build.mjs koromyslo yandex|gamepush` → `platform-builds.browser.mjs` — 0 ошибок; `tools/promo/i18n-overflow.mjs koromyslo` — 0.
- В браузере: титул → игра (Enter / тап) → обучение → пары снимаются → пауза (P) → T/L работают; 0 ошибок консоли.
