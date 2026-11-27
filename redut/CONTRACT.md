# CONTRACT · РЕДУТ (v3, переделка 2026-11)

Технический контракт игры. Игра офлайн: чистый HTML/CSS/Canvas, без сборки, без CDN/npm/сети, без внешних картинок/шрифтов/звуков.
Открывается двойным кликом по `index.html` (`file://`). Оболочка — Гефест Arcade v2 (`engine.js`).

## Порядок загрузки
`engine.js` → `js/stick.js` → `js/music.js` → `js/i18n.js` → `js/game.js` → `js/audio.js` → `js/modern.js` → `js/classic.js` → `js/render.js` → `js/ui.js` → `js/main.js`.
Классические `<script>`, общий глобальный объект `REDUT` (`REDUT.STR`, `REDUT.Game`, `REDUT.logic`, `REDUT.modern`, `REDUT.classic`, `REDUT.render`, `REDUT.ui`, `REDUT.sfx`).
Один `<canvas id="c" width="480" height="640">` (HUD 44 px сверху, поле 480×596).

## Логика (`js/game.js`) — DOM-free, детерминирована при заданном `rng`
`REDUT.Game({ rng, onEvent(type, data), wave, maxWave, noHints })` → `start()`, `update(dt)`, `state()`, `setDir(x, y)` (−1…1, стик),
`place()` (опора: поставить / снять у последней), `flare()`, `reviveAd()`, `canBoost()`, `boost()`. Состояние: `phase` (intro | play | clear | won | over),
`hero`, `pylons`, `enemies`, `queue`, `marks`, `trail`, `charge`, `coreHp`, `lives`, `lmax`, `maxP`, `beamR`, `flareR`, `score`, `hint`, `hold`.
События: wave, spawn, kill, zap, pylon, unpylon, noPlace, flare, hurt, respawn, coreHit, splat, pylonDie, leap, bossSpawn, bossHit, bossDie, clear, win, gameover, revive, boost.
Правила: луч — отрезки маяк → опоры → Смотритель; касание (радиус врага + ширина луча) даёт ожог раз в 0.3 с (босс — 0.5 с), шлейф ~0.45 с жжёт тоже;
гаситель иммунен к лучу; прыгун в воздухе неуязвим; свет маяка (радиус 92) замедляет мглу вдвое; вспышка — круг `flareR`, полный заряд 100.

## Оболочка (`js/main.js`)
`g.useStandardScreens`, `g.useLeaderboard({ boards: [redut] })`, `g.useNoAds`, `g.useRewardedContinue`, `g.useRewardedBonus`, `g.persist('arcade.best.redut')`,
`g.adBreak()` на карточке между волнами; миграция рекорда прежней версии — ключ `arcade.redut.ver` = '2'. Ввод: стрелки/WASD (движок), Пробел/Z/J — опора, X/K/F/Shift — вспышка,
тач — `js/stick.js` + кнопки `data-d="A"` (опора) и `#bFlare` (вспышка), геймпад — движком (A → Space, B → KeyX).
