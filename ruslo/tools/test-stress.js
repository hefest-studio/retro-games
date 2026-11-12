/* Стресс-проверки River Raid: состояния, переключения, память, сеть, WebAudio
   и localStorage, производительность. Запуск:
   node tools/cdp.mjs eval --page legacy.html --script tools/test-stress.js --wait 600 */
/* Стресс-проверки состояний, памяти, сети и производительности. */
const out = { checks: [], errors: [] };
const check = (n, ok, info) => out.checks.push({ n, ok: !!ok, info });
const st = () => RR.test.state();
const key = (k) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
const keyup = (k) => window.dispatchEvent(new KeyboardEvent('keyup', { key: k, bubbles: true }));
await sleep(400);

/* 1. Сеть: только локальные ресурсы, никаких http(s) */
const res = performance.getEntriesByType('resource').map((r) => r.name);
const external = res.filter((n) => /^https?:/i.test(n));
check('нет внешних сетевых запросов', external.length === 0, external);
check('все ресурсы из папки игры', res.every((n) => n.startsWith('file://')), res.map((n) => n.split('/').pop()));

/* 2. Быстрые переключения G/L/M в разных состояниях без ошибок */
const baseLang = RR.getLang(), baseSound = RR.cfg.sound, baseGfx = st().gfx;
RR.test.startGame();
RR.test.setInvuln(60);
for (let i = 0; i < 5; i++) { key('g'); key('l'); key('m'); await sleep(25); }
// возвращаем ровно в исходное состояние, сколько бы раз ни дёрнули
if (RR.getLang() !== baseLang) key('l');
if (RR.cfg.sound !== baseSound) key('m');
if (st().gfx !== baseGfx) key('g');
RR.test.step(0.3);
check('переключения в игре без ошибок', st().errors.length === 0, st().errors);
check('язык вернулся в исходный', RR.getLang() === baseLang, RR.getLang());
check('звук вернулся в исходный', RR.cfg.sound === baseSound, RR.cfg.sound);
check('графика вернулась в исходную', st().gfx === baseGfx, st().gfx);

/* 3. Смерть → переключения → возрождение */
RR.test.startGame();
RR.test.setInvuln(0);
RR.S.depots = []; RR.S.gen.depotY = RR.S.camY + 5000;
RR.test.setFuel(2);
RR.test.step(1.0);
check('смерть от топлива', st().mode === 'dying', st().mode);
const langBefore = RR.getLang(), gfxBefore = st().gfx;
for (let i = 0; i < 3; i++) { key('g'); key('l'); await sleep(20); }
if (RR.getLang() !== langBefore) key('l');
if (st().gfx !== gfxBefore) key('g');
RR.test.step(2.0);
check('возрождение после смены режимов', ['play', 'over'].includes(st().mode), st().mode);
check('смена графики во время смерти не ломает отрисовку', st().errors.length === 0, st().errors);

/* 4. Пауза + смена языка/графики + выход в меню */
RR.test.startGame();
RR.test.setInvuln(60);
key('p'); await sleep(50);
key('l'); await sleep(40); key('g'); await sleep(40);
RR.test.step(0.5);
check('на паузе мир стоит', st().paused === true);
RR.test.setPaused(false);
key('l'); await sleep(40);
RR.test.toMenu();
check('выход в меню из паузы', st().mode === 'menu' && document.body.dataset.state === 'menu');
check('меню после всех переключений без ошибок', st().errors.length === 0, st().errors);

/* 5. Заблокированные клавиши (blur) */
RR.test.startGame();
RR.test.setInvuln(999);
RR.test.setPlaneX(180);
const beforeX = st().planeX;
RR.test.hold('right', true);
window.dispatchEvent(new Event('blur'));
RR.test.step(0.9);
check('blur не даёт самолёту улететь на автопилоте', Math.abs(st().planeX - beforeX) < 40, { beforeX, after: st().planeX });

/* 6. Память: 2 минуты симуляции с постоянной стрельбой */
RR.test.startGame();
RR.test.setInvuln(999);
RR.S.depots = []; RR.S.gen.depotY = RR.S.camY + 99999;
RR.test.hold('fire', true);
RR.test.hold('up', true);
let maxEnemies = 0, maxParticles = 0, maxIslands = 0;
for (let i = 0; i < 120 * 60; i++) {
  RR.test.update(1 / 60);
  if (i % 300 === 0) {
    maxEnemies = Math.max(maxEnemies, RR.S.enemies.length);
    maxParticles = Math.max(maxParticles, RR.S.particles.length);
    maxIslands = Math.max(maxIslands, RR.S.islands.length);
    if (RR.S.mode === 'over') break;
    if (RR.S.mode === 'dying') { RR.test.setInvuln(999); }
  }
}
RR.test.hold('fire', false); RR.test.hold('up', false);
const now = st();
check('массивы не растут бесконечно', RR.S.particles.length < 500 && RR.S.enemies.length < 200 && RR.S.islands.length < 80,
  { particles: RR.S.particles.length, enemies: RR.S.enemies.length, islands: RR.S.islands.length, maxEnemies, maxParticles, maxIslands });
check('симуляция 2 минут без ошибок', st().errors.length === 0, st().errors.slice(-3));

/* 7. FPS: 120 кадров современного режима с кучей врагов и частиц */
RR.test.startGame();
RR.test.setInvuln(999);
RR.test.clearEnemies();
for (let i = 0; i < 40; i++) RR.test.spawnEnemyAt(i % 3 ? 'boat' : 'heli', RR.S.camY + 80 + i * 60, 40 + (i * 53) % 280);
let frames = 0, last = performance.now(), sum = 0, maxDt = 0;
await new Promise((resolve) => {
  function tick(t) {
    const dt = t - last; last = t; frames++; sum += dt; maxDt = Math.max(maxDt, dt);
    if (frames < 120) requestAnimationFrame(tick); else resolve();
  }
  requestAnimationFrame(tick);
});
out.fps = { avgMs: +(sum / frames).toFixed(2), avgFps: +(1000 / (sum / frames)).toFixed(1), maxMs: +maxDt.toFixed(1) };
check('кадр в среднем < 33 мс', sum / frames < 33, out.fps);

/* 8. Без WebAudio: подменяем AudioContext и стартуем */
const savedAC = window.AudioContext, savedWAC = window.webkitAudioContext;
try {
  window.AudioContext = undefined; window.webkitAudioContext = undefined;
  window.Chiptune.init();
  RR.test.startGame();
  RR.test.step(0.5);
  check('игра работает без WebAudio', st().errors.length === 0, st().errors);
} finally {
  window.AudioContext = savedAC; window.webkitAudioContext = savedWAC;
}

/* 9. localStorage отключён */
const savedLS = Object.getOwnPropertyDescriptor(window, 'localStorage');
try {
  Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new Error('denied'); } });
  RR.store.set('hi', 999); RR.store.get('hi', 1);
  check('localStorage-ошибки не ломают игру', true);
} catch (e) {
  check('localStorage-ошибки не ломают игру', false, String(e));
} finally {
  if (savedLS) Object.defineProperty(window, 'localStorage', savedLS);
}

/* 10. Локализация: RU/EN canvas-строки и DOM */
key('l'); await sleep(60);
const enMissing = [...document.querySelectorAll('[data-i18n]')].filter((el) => !el.textContent.trim());
check('EN: все data-i18n заполнены', enMissing.length === 0, enMissing.map((e) => e.getAttribute('data-i18n')));
const enKeys = [...new Set([...document.querySelectorAll('[data-i18n]')].map((el) => el.getAttribute('data-i18n')))].filter((k) => RR.t(k) === k);
check('EN: все ключи есть в словаре', enKeys.length === 0, enKeys);
key('l'); await sleep(50);

out.passed = out.checks.filter((c) => c.ok).length;
out.failed = out.checks.filter((c) => !c.ok).length;
return out;
