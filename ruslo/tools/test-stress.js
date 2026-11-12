/* Стресс-проверки РУСЛО: состояния, переключения, память, сеть, WebAudio
   и localStorage, производительность. Запуск:
   node tools/cdp.mjs eval --page legacy.html --script tools/test-stress.js --wait 600 */
/* Стресс-проверки состояний, памяти, сети и производительности. */
const out = { checks: [], errors: [] };
const check = (n, ok, info) => out.checks.push({ n, ok: !!ok, info });
const st = () => RUSLO.test.state();
const key = (k) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
const keyup = (k) => window.dispatchEvent(new KeyboardEvent('keyup', { key: k, bubbles: true }));
await sleep(400);

/* 1. Сеть: только локальные ресурсы, никаких http(s) */
const res = performance.getEntriesByType('resource').map((r) => r.name);
const external = res.filter((n) => /^https?:/i.test(n));
check('нет внешних сетевых запросов', external.length === 0, external);
check('все ресурсы из папки игры', res.every((n) => n.startsWith('file://')), res.map((n) => n.split('/').pop()));

/* 2. Быстрые переключения G/L/M в разных состояниях без ошибок */
const baseLang = RUSLO.getLang(), baseSound = RUSLO.cfg.sound, baseGfx = st().gfx;
RUSLO.test.startGame();
RUSLO.test.setInvuln(60);
for (let i = 0; i < 5; i++) { key('g'); key('l'); key('m'); await sleep(25); }
// возвращаем ровно в исходное состояние, сколько бы раз ни дёрнули
if (RUSLO.getLang() !== baseLang) key('l');
if (RUSLO.cfg.sound !== baseSound) key('m');
if (st().gfx !== baseGfx) key('g');
RUSLO.test.step(0.3);
check('переключения в игре без ошибок', st().errors.length === 0, st().errors);
check('язык вернулся в исходный', RUSLO.getLang() === baseLang, RUSLO.getLang());
check('звук вернулся в исходный', RUSLO.cfg.sound === baseSound, RUSLO.cfg.sound);
check('графика вернулась в исходную', st().gfx === baseGfx, st().gfx);

/* 3. Смерть → переключения → возрождение */
RUSLO.test.startGame();
RUSLO.test.setInvuln(0);
RUSLO.S.depots = []; RUSLO.S.gen.depotY = RUSLO.S.camY + 5000;
RUSLO.test.setFuel(2);
RUSLO.test.step(1.0);
check('смерть от топлива', st().mode === 'dying', st().mode);
const langBefore = RUSLO.getLang(), gfxBefore = st().gfx;
for (let i = 0; i < 3; i++) { key('g'); key('l'); await sleep(20); }
if (RUSLO.getLang() !== langBefore) key('l');
if (st().gfx !== gfxBefore) key('g');
RUSLO.test.step(2.0);
check('возрождение после смены режимов', ['play', 'over'].includes(st().mode), st().mode);
check('смена графики во время смерти не ломает отрисовку', st().errors.length === 0, st().errors);

/* 4. Пауза + смена языка/графики + выход в меню */
RUSLO.test.startGame();
RUSLO.test.setInvuln(60);
key('p'); await sleep(50);
key('l'); await sleep(40); key('g'); await sleep(40);
RUSLO.test.step(0.5);
check('на паузе мир стоит', st().paused === true);
RUSLO.test.setPaused(false);
key('l'); await sleep(40);
RUSLO.test.toMenu();
check('выход в меню из паузы', st().mode === 'menu' && document.body.dataset.state === 'menu');
check('меню после всех переключений без ошибок', st().errors.length === 0, st().errors);

/* 5. Заблокированные клавиши (blur) */
RUSLO.test.startGame();
RUSLO.test.setInvuln(999);
RUSLO.test.setPlaneX(180);
const beforeX = st().planeX;
RUSLO.test.hold('right', true);
window.dispatchEvent(new Event('blur'));
RUSLO.test.step(0.9);
check('blur не даёт самолёту улететь на автопилоте', Math.abs(st().planeX - beforeX) < 40, { beforeX, after: st().planeX });

/* 6. Память: 2 минуты симуляции с постоянной стрельбой */
RUSLO.test.startGame();
RUSLO.test.setInvuln(999);
RUSLO.S.depots = []; RUSLO.S.gen.depotY = RUSLO.S.camY + 99999;
RUSLO.test.hold('fire', true);
RUSLO.test.hold('up', true);
let maxEnemies = 0, maxParticles = 0, maxIslands = 0;
for (let i = 0; i < 120 * 60; i++) {
  RUSLO.test.update(1 / 60);
  if (i % 300 === 0) {
    maxEnemies = Math.max(maxEnemies, RUSLO.S.enemies.length);
    maxParticles = Math.max(maxParticles, RUSLO.S.particles.length);
    maxIslands = Math.max(maxIslands, RUSLO.S.islands.length);
    if (RUSLO.S.mode === 'over') break;
    if (RUSLO.S.mode === 'dying') { RUSLO.test.setInvuln(999); }
  }
}
RUSLO.test.hold('fire', false); RUSLO.test.hold('up', false);
const now = st();
check('массивы не растут бесконечно', RUSLO.S.particles.length < 500 && RUSLO.S.enemies.length < 200 && RUSLO.S.islands.length < 80,
  { particles: RUSLO.S.particles.length, enemies: RUSLO.S.enemies.length, islands: RUSLO.S.islands.length, maxEnemies, maxParticles, maxIslands });
check('симуляция 2 минут без ошибок', st().errors.length === 0, st().errors.slice(-3));

/* 7. FPS: 120 кадров современного режима с кучей врагов и частиц */
RUSLO.test.startGame();
RUSLO.test.setInvuln(999);
RUSLO.test.clearEnemies();
for (let i = 0; i < 40; i++) RUSLO.test.spawnEnemyAt(i % 3 ? 'boat' : 'heli', RUSLO.S.camY + 80 + i * 60, 40 + (i * 53) % 280);
let frames = 0, last = performance.now(), sum = 0, maxDt = 0;
await new Promise((resolve) => {
  function tick(t) {
    const dt = t - last; last = t; frames++; sum += dt; maxDt = Math.max(maxDt, dt);
    if (frames < 120) requestAnimationFrame(tick); else resolve();
  }
  requestAnimationFrame(tick);
});
out.fps = { avgMs: +(sum / frames).toFixed(2), avgFps: +(1000 / (sum / frames)).toFixed(1), maxMs: +maxDt.toFixed(1) };
/* Порог кадра зависит от окружения (см. README, «Порог FPS»):
   • RUSLO_FRAME_MS (или --args '{"frameMs":N}') — порог в мс, по умолчанию 33;
   • RUSLO_STRICT_FPS=1 (или "strictFps":true) — строгий режим: превышение = провал всегда;
   • иначе в headless/без аппаратного GPU (SwiftShader/llvmpipe/нет WebGL) превышение порога —
     мягкое предупреждение (out.warnings), а не провал: там рисует CPU и FPS ничего не говорит об игре. */
const ENV = (args && args.env) || {};
const FRAME_MS = Number(args.frameMs || ENV.RUSLO_FRAME_MS) || 33;
const STRICT_FPS = args.strictFps === true || String(ENV.RUSLO_STRICT_FPS || '') === '1';
const gpuInfo = (() => {
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    if (!gl) return 'нет WebGL';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  } catch (e) { return 'нет WebGL'; }
})();
const SOFT_ENV = /HeadlessChrome/i.test(navigator.userAgent) || /swiftshader|llvmpipe|software|нет WebGL/i.test(gpuInfo);
Object.assign(out.fps, { limitMs: FRAME_MS, strict: STRICT_FPS, softEnv: SOFT_ENV, gpu: gpuInfo });
const fpsOk = sum / frames < FRAME_MS;
out.warnings = [];
if (!fpsOk && SOFT_ENV && !STRICT_FPS) {
  out.warnings.push('кадр ' + out.fps.avgMs + ' мс ≥ ' + FRAME_MS + ' мс — headless/программный рендер, не провал (RUSLO_STRICT_FPS=1 — строго)');
  check('кадр в среднем < ' + FRAME_MS + ' мс (мягко: headless без GPU)', true, out.fps);
} else {
  check('кадр в среднем < ' + FRAME_MS + ' мс', fpsOk, out.fps);
}

/* 8. Без WebAudio: подменяем AudioContext и стартуем */
const savedAC = window.AudioContext, savedWAC = window.webkitAudioContext;
try {
  window.AudioContext = undefined; window.webkitAudioContext = undefined;
  window.Chiptune.init();
  RUSLO.test.startGame();
  RUSLO.test.step(0.5);
  check('игра работает без WebAudio', st().errors.length === 0, st().errors);
} finally {
  window.AudioContext = savedAC; window.webkitAudioContext = savedWAC;
}

/* 9. localStorage отключён */
const savedLS = Object.getOwnPropertyDescriptor(window, 'localStorage');
try {
  Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new Error('denied'); } });
  RUSLO.store.set('hi', 999); RUSLO.store.get('hi', 1);
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
const enKeys = [...new Set([...document.querySelectorAll('[data-i18n]')].map((el) => el.getAttribute('data-i18n')))].filter((k) => RUSLO.t(k) === k);
check('EN: все ключи есть в словаре', enKeys.length === 0, enKeys);
key('l'); await sleep(50);

out.passed = out.checks.filter((c) => c.ok).length;
out.failed = out.checks.filter((c) => !c.ok).length;
return out;
