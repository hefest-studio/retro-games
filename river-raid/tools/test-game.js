/* Проверка механики и интерфейса River Raid в headless Chrome.
   Запуск: node tools/cdp.mjs eval --page index.html --script tools/test-game.js --wait 600 */
const out = { checks: [], errors: [], state: null };
const check = (name, ok, info) => {
  out.checks.push({ name, ok: !!ok, info: info === undefined ? '' : info });
  if (!ok) out.errors.push(name + (info !== undefined ? ': ' + JSON.stringify(info) : ''));
};
const st = () => RR.test.state();
const key = (k) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
const keyup = (k) => window.dispatchEvent(new KeyboardEvent('keyup', { key: k, bubbles: true }));

await sleep(400);
out.state = st();
check('загрузка без JS-ошибок', out.state.errors.length === 0, out.state.errors);
check('стартовое состояние — меню', st().mode === 'menu' && document.body.dataset.state === 'menu');
check('звуковой модуль доступен', !!window.Chiptune && typeof window.Chiptune.create === 'function');
check('до жеста аудио не создано', RR.cfg.audioReady === false);

/* --- старт с клавиатуры --- */
key('Enter');
await sleep(80);
check('Enter запускает игру', st().mode === 'play' && document.body.dataset.state === 'play');
check('аудио инициализировано жестом', RR.cfg.audioReady === true);
check('мост создан', !!st().bridge && st().bridge.alive);

/* --- движение и тяга --- */
const x0 = st().planeX;
RR.test.hold('right', true);
RR.test.step(0.8);
RR.test.hold('right', false);
const x1 = st().planeX;
check('самолёт летит вправо', x1 > x0 + 40, { x0, x1 });
const sp0 = st().speed;
RR.test.hold('up', true);
RR.test.step(0.6);
RR.test.hold('up', false);
check('ускорение увеличивает скорость', st().speed > sp0 + 10, { sp0, now: st().speed });
RR.test.hold('down', true);
RR.test.step(0.9);
RR.test.hold('down', false);
check('торможение уменьшает скорость', st().speed < sp0, { sp0, now: st().speed });

/* --- стрельба и уничтожение врага (свежий забег) --- */
RR.test.startGame();
RR.test.setInvuln(30);
RR.test.clearEnemies();
RR.test.setPlaneX(180);
const scoreBefore = st().score;
for (let i = 0; i < 8; i++) {
  RR.test.spawnEnemyAt('boat', RR.test.state().camY + 120, 180);
}
RR.test.hold('fire', true);
RR.test.step(1.2);
RR.test.hold('fire', false);
check('выстрелы расходуются', st().bullets >= 0 && RR.S.shotsFired > 0, RR.S.shotsFired);
check('враг сбит, очки начислены', st().score > scoreBefore, { before: scoreBefore, after: st().score });
check('патроны не копятся бесконечно', RR.S.bullets.length <= 4, RR.S.bullets.length);

/* --- топливо и смерть --- */
RR.test.startGame();
RR.test.setInvuln(0);
RR.S.depots = [];
RR.S.gen.depotY = RR.S.camY + 5000;
RR.test.setFuel(2);
RR.test.step(1.2);
check('без топлива самолёт падает', st().mode === 'dying' || st().mode === 'over', st().mode);
RR.test.step(1.6);
check('после смерти есть возрождение или финал', ['play', 'over'].includes(st().mode), st().mode);
out.afterFuelDeath = st();

/* --- новый забег: мост --- */
RR.test.startGame();
RR.test.setInvuln(30);
RR.test.clearEnemies();
RR.test.nearBridge(300);
check('мост впереди', st().bridge.ahead > 200 && st().bridge.ahead < 400, st().bridge.ahead);
RR.test.bridgeHits(1);
check('первое попадание по мосту', st().bridge.hp === 2, st().bridge.hp);
RR.test.bridgeHits(2);
check('мост уничтожен', st().bridge.alive === false);
check('бонус за мост начислен', st().score >= 550, st().score);
RR.test.step(2.1);
check('уровень повышен', st().level === 2, { level: st().level, bridge: st().bridge });

/* --- столкновение с мостом --- */
RR.test.startGame();
RR.test.clearEnemies();
RR.test.setInvuln(0);
RR.test.nearBridge(40);
RR.test.step(0.45);
check('столкновение с мостом убивает', st().mode === 'dying', { mode: st().mode, bridge: st().bridge });
RR.test.step(1.8);

/* --- пауза --- */
RR.test.startGame();
RR.test.setInvuln(20);
key('p');
await sleep(60);
check('пауза включается', st().paused === true && document.body.dataset.state === 'pause');
const camPaused = st().camY;
RR.test.step(0.8);
check('на паузе мир не движется', st().camY === camPaused, { camPaused, now: st().camY });
key('p');
await sleep(60);
check('пауза выключается', st().paused === false && document.body.dataset.state === 'play');

/* --- переключения: по умолчанию ретро, G уводит в модерн --- */
check('по умолчанию включён ретро-режим', st().gfx === 'retro', st().gfx);
check('ретро — пиксельный backing store', document.getElementById('game').width === 360, document.getElementById('game').width);
const modernW = (window.devicePixelRatio || 1) >= 2 ? 720 : 540;
key('g');
await sleep(80);
check('G переключает графику на модерн', st().gfx === 'modern', st().gfx);
check('модерн — увеличенный backing store', document.getElementById('game').width === modernW, { got: document.getElementById('game').width, want: modernW });
check('dataset.gfx синхронизирован', document.documentElement.dataset.gfx === 'modern');
key('g');
await sleep(80);
check('G возвращает ретро', st().gfx === 'retro' && document.getElementById('game').width === 360, st().gfx);

key('l');
await sleep(80);
check('L переключает язык на EN', RR.getLang() === 'en');
check('текст меню переведён', (document.querySelector('[data-action="play"] .m-label') || {}).textContent === 'Play');
check('язык сохранён', RR.store.get('lang') === 'en');
key('l');
await sleep(60);
check('L возвращает русский', RR.getLang() === 'ru');

key('m');
await sleep(60);
check('M выключает звук', RR.cfg.sound === false);
key('m');
await sleep(40);
check('M включает звук', RR.cfg.sound === true);

/* --- локальный рекорд и финал --- */
RR.S.score = 12345;
RR.test.forceGameOver();
check('финал показывается', st().mode === 'over' && document.body.dataset.state === 'over');
check('рекорд записан', RR.store.get('hi') === 12345, RR.store.get('hi'));
check('очки в финальном окне', document.getElementById('scoreOver').textContent === '012345');
key('Enter');
await sleep(80);
check('Enter начинает новый забег', st().mode === 'play' && st().score === 0);
RR.test.step(0.2);

/* --- локализация DOM --- */
const empty = [...document.querySelectorAll('[data-i18n]')].filter((el) => !el.textContent.trim());
check('все data-i18n заполнены', empty.length === 0, empty.map((e) => e.getAttribute('data-i18n')));
const keys = [...document.querySelectorAll('[data-i18n]')].map((el) => el.getAttribute('data-i18n'));
const missing = [...new Set(keys)].filter((k) => typeof RR.t(k) !== 'string' || RR.t(k) === k);
check('все ключи перевода существуют', missing.length === 0, missing);

/* --- отсутствие ошибок за прогон --- */
out.state = st();
check('за прогон нет JS-ошибок', st().errors.length === 0, st().errors);
out.passed = out.checks.filter((c) => c.ok).length;
out.failed = out.checks.filter((c) => !c.ok).length;
return out;
