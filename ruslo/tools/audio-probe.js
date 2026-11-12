/*
 * tools/audio-probe.js — проба аудиодвижка ruslo.
 * Выполняется в странице tools/audio-test.html как async-функция (см. tools/cdp.mjs):
 * доступны args и sleep(ms), возвращаемый объект печатается JSON-ом.
 *
 * Что проверяем:
 *   1) API и отсутствие автозапуска до init();
 *   2) живой AudioContext: init/startMusic/смена трека/mute/volume/pause/sfx;
 *   3) три трека в OfflineAudioContext: RMS, peak, отсутствие тишины по секундам,
 *      энергия после шва лупа, различие треков;
 *   4) все SFX: не бросают и дают ненулевую энергию;
 *   5) setMuted / setPaused обнуляют выход, setVolume меняет RMS линейно;
 *   6) кроссфейд треков не ломается.
 */

const out = {
  api: {}, preInit: {}, live: {}, tracks: {}, tracksExtra: {}, sfx: {},
  gates: {}, failures: [], errors: [],
};
const SR = 44100;
const DUR = { // длительность лупа = такты * 4 доли * 60 / BPM
  menu: (16 * 4 * 60) / 132,
  game: (16 * 4 * 60) / 154,
  over: (4 * 4 * 60) / 128,
};
const SFX_NAMES = ['shot', 'enemyShot', 'explosion', 'bigExplosion', 'crash', 'fuel',
  'select', 'start', 'levelUp', 'gameOver', 'tick', 'pause', 'bonus'];

function gate(name, ok, detail) {
  out.gates[name] = (ok ? 'OK' : 'FAIL') + (detail ? ' — ' + detail : '');
  if (!ok) out.failures.push(name + (detail ? ': ' + detail : ''));
}

/* Разбор буфера: peak, общий RMS, RMS по секундам, zero-crossing rate. */
function analyze(buf) {
  const L = buf.getChannelData(0);
  const R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L;
  const n = buf.length, sr = buf.sampleRate;
  let peak = 0, sum = 0, sumL = 0, sumR = 0, zc = 0, prev = 0;
  for (let i = 0; i < n; i++) {
    const l = L[i], r = R[i];
    const al = Math.abs(l), ar = Math.abs(r);
    if (al > peak) peak = al;
    if (ar > peak) peak = ar;
    sumL += l * l;
    sumR += r * r;
    const m = (l + r) * 0.5;
    sum += m * m;
    if ((m >= 0) !== (prev >= 0)) zc++;
    prev = m;
  }
  const secs = Math.floor(n / sr);
  const rmsPerSec = [];
  for (let s = 0; s < secs; s++) {
    let acc = 0, cnt = 0;
    for (let i = s * sr; i < Math.min((s + 1) * sr, n); i++) {
      const m = (L[i] + R[i]) * 0.5;
      acc += m * m;
      cnt++;
    }
    rmsPerSec.push(+Math.sqrt(acc / cnt).toFixed(3));
  }
  return {
    rms: +Math.sqrt(sum / n).toFixed(4),
    rmsL: +Math.sqrt(sumL / n).toFixed(4),
    rmsR: +Math.sqrt(sumR / n).toFixed(4),
    peak: +peak.toFixed(4),
    zcr: +(zc / n).toFixed(4),
    seconds: secs,
    rmsPerSec,
  };
}

async function renderMusic(name, seconds) {
  const oac = new OfflineAudioContext(2, Math.ceil(SR * seconds), SR);
  const eng = Chiptune.create(oac);
  const t0 = performance.now();
  eng.startMusic(name);
  const buf = await oac.startRendering();
  const st = analyze(buf);
  st.renderMs = Math.round(performance.now() - t0);
  st.engineCtxOk = eng.ctx === oac;
  return st;
}

async function renderShort(setup, seconds) {
  const oac = new OfflineAudioContext(2, Math.ceil(SR * seconds), SR);
  const eng = Chiptune.create(oac);
  if (setup) setup(eng);
  eng.startMusic('game');
  const buf = await oac.startRendering();
  return analyze(buf);
}

try {
  /* ---------- 1. API ---------- */
  out.api.keys = Object.keys(Chiptune).sort().join(',');
  out.api.types = {
    init: typeof Chiptune.init, create: typeof Chiptune.create,
    startMusic: typeof Chiptune.startMusic, stopMusic: typeof Chiptune.stopMusic,
    sfx: typeof Chiptune.sfx, setMuted: typeof Chiptune.setMuted,
    isMuted: typeof Chiptune.isMuted, setVolume: typeof Chiptune.setVolume,
    getVolume: typeof Chiptune.getVolume, setPaused: typeof Chiptune.setPaused,
  };
  gate('api/init', typeof Chiptune.init === 'function');
  gate('api/create', typeof Chiptune.create === 'function');
  gate('api/music+sfx', ['startMusic', 'stopMusic', 'sfx'].every((k) => typeof Chiptune[k] === 'function'));
  gate('api/mute+volume+pause',
    ['setMuted', 'isMuted', 'setVolume', 'getVolume', 'setPaused']
      .every((k) => typeof Chiptune[k] === 'function'));

  /* ---------- 2. До init(): никаких контекстов, никаких исключений ---------- */
  out.preInit.acCalls = window.__acCalls;
  Chiptune.sfx('shot');
  Chiptune.sfx('__unknown__');
  Chiptune.setVolume(0.8);
  Chiptune.setMuted(false);
  Chiptune.setPaused(false);
  Chiptune.startMusic('menu'); // запомнится и применится в init()
  out.preInit.acCallsAfterCalls = window.__acCalls;
  out.preInit.volume = Chiptune.getVolume();
  gate('no-autoplay-before-init', window.__acCalls === 0, 'AudioContext создан до init(): ' + window.__acCalls);
  gate('preinit/no-throw', true);

  /* ---------- 3. Живой контекст ---------- */
  const ctx = Chiptune.init();
  out.live.context = !!ctx;
  out.live.acCallsAfterInit = window.__acCalls;
  out.live.state = ctx && ctx.state;
  out.live.volumeAfterInit = Chiptune.getVolume();
  gate('init/context', !!ctx);
  gate('init/one-context', window.__acCalls === 1, 'вызовов: ' + window.__acCalls);
  gate('init/pending-volume-applied', Math.abs(Chiptune.getVolume() - 0.8) < 1e-6);
  Chiptune.init(); Chiptune.init(); // повторные init() не создают новые контексты
  gate('init/idempotent', window.__acCalls === 1, 'вызовов: ' + window.__acCalls);

  await sleep(250);
  out.live.stateAfterWait = ctx && ctx.state;
  const clockA = ctx ? ctx.currentTime : 0;
  await sleep(400);
  out.live.timeAdvanced = ctx ? +(ctx.currentTime - clockA).toFixed(3) : 0;
  gate('live/running', !!ctx && ctx.state === 'running', 'state=' + (ctx && ctx.state));
  if (out.live.timeAdvanced > 0.15) {
    gate('live/clock-advances', true, 'delta=' + out.live.timeAdvanced);
  } else {
    // В headless-Chrome без устройства вывода аудиочасы иногда «стоят» —
    // это свойство окружения, а не движка; фиксируем предупреждением.
    out.gates['live/clock-advances'] = 'WARN — delta=' + out.live.timeAdvanced;
  }

  Chiptune.startMusic('game'); // кроссфейд menu -> game
  await sleep(400);
  Chiptune.startMusic('game'); // повторный вызов — no-op
  await sleep(100);
  Chiptune.setVolume(0.55);
  out.live.volume = Chiptune.getVolume();
  gate('live/volume', Math.abs(Chiptune.getVolume() - 0.55) < 1e-6);
  Chiptune.setMuted(true);
  out.live.muted = Chiptune.isMuted();
  gate('live/muted', Chiptune.isMuted() === true);
  await sleep(80);
  Chiptune.setMuted(false);
  Chiptune.setPaused(true);
  out.live.paused = Chiptune.isPaused();
  gate('live/paused', Chiptune.isPaused() === true);
  await sleep(150);
  Chiptune.setPaused(false);
  gate('live/resumed', Chiptune.isPaused() === false);
  Chiptune.stopMusic(0.12);
  await sleep(200);
  for (let i = 0; i < SFX_NAMES.length; i++) { Chiptune.sfx(SFX_NAMES[i]); await sleep(20); }
  Chiptune.sfx('__unknown__');
  await sleep(200);
  out.live.stateEnd = ctx && ctx.state;
  gate('live/sfx-no-throw', true);

  /* ---------- 4. Треки в OfflineAudioContext ---------- */
  for (const name of ['menu', 'game', 'over']) {
    const st = await renderMusic(name, DUR[name] + 1.5);
    out.tracks[name] = st;
    const minAfterFirst = Math.min.apply(null, st.rmsPerSec.slice(1));
    const tail = st.rmsPerSec.slice(-2);
    gate('track/' + name + '/rms', st.rms >= 0.1 && st.rms <= 0.22, 'rms=' + st.rms);
    gate('track/' + name + '/peak', st.peak < 1.0, 'peak=' + st.peak);
    gate('track/' + name + '/not-empty', st.rms > 0.05);
    gate('track/' + name + '/no-silence', minAfterFirst > 0.02, 'min RMS по секундам=' + minAfterFirst);
    // Последние 2 секунды рендера уже за швом лупа — там звук обязан продолжаться.
    gate('track/' + name + '/loop-tail', Math.min.apply(null, tail) > 0.03, 'tail=' + tail.join(','));
    gate('track/' + name + '/engine-ctx', st.engineCtxOk === true);
    gate('track/' + name + '/length', Math.abs(st.seconds - Math.round(DUR[name] + 1.5)) <= 1,
      'seconds=' + st.seconds + ' expected≈' + (DUR[name] + 1.5).toFixed(1));
  }

  /* Треки должны различаться: длительность, RMS-профиль, «яркость» (ZCR). */
  const t = out.tracks;
  const names = ['menu', 'game', 'over'];
  const sig = names.map((n) => t[n].rmsPerSec.slice(0, 8).join(','));
  const zcr = names.map((n) => t[n].zcr);
  out.tracksExtra = {
    durations: { menu: +DUR.menu.toFixed(2), game: +DUR.game.toFixed(2), over: +DUR.over.toFixed(2) },
    zcr: { menu: zcr[0], game: zcr[1], over: zcr[2] },
    peak: { menu: t.menu.peak, game: t.game.peak, over: t.over.peak },
  };
  gate('tracks/differ', new Set(sig).size === 3 && new Set(zcr).size === 3,
    'профили RMS/яркость совпали');
  gate('tracks/zcr-order', zcr[1] > zcr[2], 'game должен быть ярче over');

  /* ---------- 5. SFX ---------- */
  for (const n of SFX_NAMES) {
    const oac = new OfflineAudioContext(2, Math.ceil(SR * 0.9), SR);
    const eng = Chiptune.create(oac);
    let threw = null;
    try { eng.sfx(n); } catch (e) { threw = String((e && e.message) || e); }
    const st = analyze(await oac.startRendering());
    out.sfx[n] = { rms: st.rms, peak: st.peak, threw };
    gate('sfx/' + n, !threw && st.rms > 0.001 && st.peak > 0.02 && st.peak < 1.0,
      'rms=' + st.rms + ' peak=' + st.peak + (threw ? ' threw=' + threw : ''));
  }
  // Неизвестное имя не должно бросать и не должно давать звук.
  {
    const oac = new OfflineAudioContext(2, Math.ceil(SR * 0.6), SR);
    const eng = Chiptune.create(oac);
    let threw = null;
    try { eng.sfx('__unknown__'); } catch (e) { threw = String(e); }
    const st = analyze(await oac.startRendering());
    out.sfx.unknown = { rms: st.rms, peak: st.peak, threw };
    gate('sfx/unknown-silent', !threw && st.peak < 1e-4, 'threw=' + threw + ' peak=' + st.peak);
  }
  // У всех 13 эффектов должна быть разная «подпись» (RMS или peak).
  {
    const fingerprints = new Set(SFX_NAMES.map((n) => out.sfx[n].rms + ':' + out.sfx[n].peak));
    gate('sfx/distinct', fingerprints.size >= 11, 'уникальных ' + fingerprints.size + ' из 13');
  }

  /* ---------- 6. Mute / volume / pause на оффлайне ---------- */
  const base = await renderShort(null, 2.5);
  const half = await renderShort((e) => e.setVolume(0.5), 2.5);
  const muted = await renderShort((e) => e.setMuted(true), 2.5);
  const paused = await renderShort((e) => e.setPaused(true), 2.5);
  out.control = { base, half, muted, paused };
  const volRatio = base.rms > 1e-6 ? half.rms / base.rms : 0;
  out.control.volumeRatio = +volRatio.toFixed(3);
  gate('volume/linear', volRatio > 0.42 && volRatio < 0.58, 'half/base=' + volRatio.toFixed(3));
  // Mute/pause гасятся коротким фейдом (20–30 мс, чтобы не щёлкало),
  // поэтому допускаем микроскопический переходный пик, но RMS должен быть нулевым.
  gate('muted/silent', muted.peak < 0.02 && muted.rms < 5e-4,
    'peak=' + muted.peak + ' rms=' + muted.rms);
  gate('paused/silent', paused.peak < 0.02 && paused.rms < 5e-4,
    'peak=' + paused.peak + ' rms=' + paused.rms);
  gate('control/base-audible', base.rms > 0.05, 'rms=' + base.rms);

  /* ---------- 7. Кроссфейд: два startMusic подряд ---------- */
  {
    const oac = new OfflineAudioContext(2, Math.ceil(SR * 2), SR);
    const eng = Chiptune.create(oac);
    let threw = null;
    try { eng.startMusic('menu'); eng.startMusic('game'); eng.stopMusic(0.2); eng.startMusic('over'); }
    catch (e) { threw = String((e && e.message) || e); }
    const st = analyze(await oac.startRendering());
    out.crossfade = { rms: st.rms, peak: st.peak, threw };
    gate('crossfade/no-throw', !threw, threw || '');
    gate('crossfade/audible', st.rms > 0.01 && st.peak < 1.0, 'rms=' + st.rms + ' peak=' + st.peak);
  }

  /* ---------- Итог ---------- */
  out.summary = {
    gates: Object.keys(out.gates).length,
    failed: out.failures.length,
    tracks: {
      menu: { rms: t.menu.rms, peak: t.menu.peak, seconds: t.menu.seconds, renderMs: t.menu.renderMs },
      game: { rms: t.game.rms, peak: t.game.peak, seconds: t.game.seconds, renderMs: t.game.renderMs },
      over: { rms: t.over.rms, peak: t.over.peak, seconds: t.over.seconds, renderMs: t.over.renderMs },
    },
    sfxCount: SFX_NAMES.length,
  };
} catch (e) {
  out.errors.push(String((e && e.stack) || e));
  out.failures.push('exception: ' + String((e && e.message) || e));
}

return out;
