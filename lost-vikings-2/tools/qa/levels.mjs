/** QA: все 6 уровней (оба режима), HUD-перекрытие, спавны, механики, камера, ошибки. */
import { openQa } from "./lib.mjs";

const out = { runs: [] };
const qa = await openQa({ page: "index.html", width: 1440, height: 900 });
qa.clearLogs();

for (const mode of ["aurora", "retro"]) {
  for (let n = 1; n <= 6; n++) {
    qa.clearLogs();
    await qa.navigate(`index.html?level=${n}&mode=${mode}`, 900);
    const data = await qa.eval(`
      const g = LV.game;
      const c = document.getElementById('game').getBoundingClientRect();
      const VW = 1024, VH = 576, sx = c.width / VW, sy = c.height / VH;
      const act = g.activeActor();
      const rectOf = (a) => ({ l: c.left + (a.x - a.w/2 - g.camera.x)*sx, r: c.left + (a.x + a.w/2 - g.camera.x)*sx, t: c.top + (a.y - a.h - g.camera.y)*sy, b: c.top + (a.y - g.camera.y)*sy });
      const ar = rectOf(act);
      const hud = Array.from(document.querySelectorAll('.hud-top, .hud-bottom, .hud-panel, .hud-hint, .portrait-card')).map(e => { const r = e.getBoundingClientRect(); return { cls: String(e.className), l:r.left, r:r.right, t:r.top, b:r.bottom }; });
      const overl = hud.filter(r => !(ar.r <= r.l || ar.l >= r.r || ar.b <= r.t || ar.t >= r.b));
      const ui = g.getUIState();
      return {
        screen: document.body.dataset.screen, mode: document.body.dataset.mode,
        level: { index: g.levelIndex, name: g.level.name, nameEn: g.level.nameEn, cols: g.level.rows[0].length, rows: g.level.rows.length },
        camera: { x: Math.round(g.camera.x), y: Math.round(g.camera.y) },
        canvas: { w: Math.round(c.width), h: Math.round(c.height), top: Math.round(c.top), left: Math.round(c.left) },
        actors: g.actors.map(a => ({ id: a.id, x: Math.round(a.x), y: Math.round(a.y), hp: a.hp, dead: a.dead, exited: a.exited })),
        active: act.id, activeRect: ar, overlappingHud: overl,
        actorsOnCanvas: g.actors.every(a => { const r = rectOf(a); return r.r > c.left && r.l < c.right && r.b > c.top && r.t < c.bottom; }),
        ui: { runes: ui.runes, runesTotal: ui.runesTotal, exitCollected: ui.exitCollected, exitTotal: ui.exitTotal, active: ui.active },
        bodyH: document.documentElement.scrollHeight, winH: innerHeight
      };`);
    await qa.shot(`tmp/qa/lv${n}_${mode}.png`, 300);
    out.runs.push({
      mode, n, ...data,
      errors: qa.state.errors.slice(0, 5), console: qa.state.console.slice(0, 5),
      requests: qa.state.requests.map(r => r.url).filter(u => !/^file:/.test(u)),
      failed: qa.state.failed.slice(),
    });
  }
}

// механики на уровне 1 (aurora): ходьба, прыжок, смена героя, J/K/L без исключений
qa.clearLogs();
await qa.navigate("index.html?level=1", 900);
const mech = await qa.eval(`
  const g = LV.game; const snap = () => ({ active: g.active, x: Math.round(g.activeActor().x), y: Math.round(g.activeActor().y) });
  const r = { start: snap() };
  input_set = (k, v) => LV.input.set(k, v);
  LV.input.set('right', true); await sleep(700); LV.input.set('right', false); await sleep(120);
  r.afterRight = snap();
  await key('Space', 120); await sleep(500);
  r.afterJump = snap();
  await key('Digit2', 90); await sleep(200); r.switch2 = snap();
  await key('KeyK', 90); await sleep(300); r.bow = { proj: (g.projectiles||[]).length, active: g.active };
  await key('Digit3', 90); await sleep(200); r.switch3 = snap();
  await key('KeyJ', 200); await sleep(300); r.shield = { active: g.active, hasShield: !!g.activeActor().shield };
  await key('Digit1', 90); await sleep(150);
  await key('KeyJ', 90); await sleep(300); r.headbutt = { active: g.active };
  await key('KeyL', 90); await sleep(200); r.hookOnErik = true;
  r.err = 'none';
  return r;`);
mech.errors = qa.state.errors.slice();
await qa.shot("tmp/qa/mech_lv1.png", 200);
out.mechanics = mech;

// производительность: rAF 2 c в двух режимах на уровне 1
for (const mode of ["aurora", "retro"]) {
  await qa.navigate(`index.html?level=1&mode=${mode}`, 800);
  const perf = await qa.eval(`
    const t0 = performance.now(); let frames = 0; const times = [];
    await new Promise(res => { let last = performance.now(); function tick(t) { times.push(t - last); last = t; frames++; if (t - t0 < 2000) requestAnimationFrame(tick); else res(); } requestAnimationFrame(tick); });
    times.sort((a,b)=>a-b);
    return { frames, avgFps: Math.round(frames / ((performance.now()-t0)/1000)), p50: Math.round(times[Math.floor(times.length*0.5)]*10)/10, p95: Math.round(times[Math.floor(times.length*0.95)]*10)/10, max: Math.round(times[times.length-1]*10)/10, mem: performance.memory ? Math.round(performance.memory.usedJSHeapSize/1048576) : null };`);
  out["perf_" + mode] = perf;
}

// аудио: user gesture -> isReady, music id на title/play/complete; mute/pause; утечки scheduler
qa.clearLogs();
await qa.navigate("index.html", 900);
const audio = await qa.eval(`
  const a = LV.audio, d = a._debug;
  const r = { beforeGesture: { ready: a.isReady(), id: d.getMusicId(), ctx: d.getContextState() } };
  await key('KeyG', 60); await sleep(300);
  r.afterGesture = { ready: a.isReady(), id: d.getMusicId(), ctx: d.getContextState(), sched: d.isSchedulerRunning() };
  document.querySelectorAll('button')[0].click(); await sleep(400);
  r.brief = { id: d.getMusicId() };
  const b = Array.from(document.querySelectorAll('button')).find(x=>/В путь|Set out/.test(x.textContent)); b.click(); await sleep(900);
  r.play = { id: d.getMusicId(), sched: d.isSchedulerRunning(), errs: d.getSchedulerErrors(), tracks: d.getTrackIds(), sfx: d.getSfxNames().length };
  await key('KeyP', 90); await sleep(400); r.pause = { id: d.getMusicId(), sched: d.isSchedulerRunning() };
  await key('KeyP', 90); await sleep(300);
  await key('KeyM', 90); await sleep(300); r.muted = { muted: a.getMuted(), id: d.getMusicId() };
  await key('KeyM', 90); await sleep(200);
  LV.debug.win(); await sleep(1400); r.complete = { id: d.getMusicId(), screen: document.body.dataset.screen };
  r.err = 'none';
  return r;`);
audio.errors = qa.state.errors.slice();
out.audio = audio;

await qa.close();
console.log(JSON.stringify(out, null, 2));
