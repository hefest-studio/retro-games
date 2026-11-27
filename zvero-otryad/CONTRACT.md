# CONTRACT · ЗВЕРО-ОТРЯД (TWINLEASH)

Технический контракт игры (переделка 2026-11). Игра офлайн: HTML/CSS/Canvas, без сборки, CDN, сети, внешних картинок/шрифтов/звуков.

## Порядок загрузки
`engine.js` → `js/stick.js` → `js/music.js` → `js/i18n.js` → `js/levels.js` → `js/game.js` → `js/audio.js` → `js/render.js` → `js/ui.js` → `js/main.js`.
Один `<canvas id="c" width="960" height="544">` (сетка 30×17 клеток по 32 px).

## Пространство имён и API
Глобальный `ZVERO`: `STR` (ru/en/tr/es/pt), `LEVELS`, `logic` (`W,H,TS,COLS,ROWS,K,SPEC,PLATES,mulberry32`), `Game(opts)`, `sfx`, `render`, `ui`, `app` (отладка/съёмка).
`ZVERO.Game({ rng, onEvent, players, noHints })`: `start(n)`, `state()`, `setPlayers(n)`, `setInput(i, x, up, hold)`, `jump(i)`, `swap()`, `restart()`,
`nextLevel()`, `reviveAd()`, `canBoost()`, `boost()`, `update(dt)`. Фазы: intro | play | clear | won | over. Логика детерминирована (фикс. шаг 1/120).
Только `setInput/jump/swap` управляют игрой — на этом построен бот (`tests/bot.mjs`).

## Площадка и сохранения
`g.useNoAds`, `g.useLeaderboard` (`zvero`), `g.persist('arcade.best.zvero-otryad','max')`, `g.useRewardedContinue`, `g.useRewardedBonus`, `g.adBreak()` между уровнями.
Миграция: `arcade.zvero-otryad.ver` ≠ `2` → сброс рекорда прежней версии и уведомление.
