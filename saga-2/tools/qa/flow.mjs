/** QA: сквозной поток экранов, оба режима, RU/EN, мобильный. */
import { openQa, helpers } from "./lib.mjs";

const OUT = {};
const H = helpers;
const log = (...a) => console.log(...a);

async function st(qa) { return qa.eval(H.screen); }

async function run(w, h, tag, mobile) {
  const qa = await openQa({ page: "index.html", width: w, height: h, mobile });
  const res = { viewport: `${w}x${h}`, steps: {} };
  qa.clearLogs();
  await qa.navigate("index.html", 900);
  res.steps.title = await st(qa);
  await qa.shot(`tmp/qa/${tag}_01_title_aurora.png`);

  // network/resources
  res.resources = await qa.eval(`return performance.getEntriesByType('resource').map(r=>r.name)`);
  res.external = (res.resources || []).filter((u) => !/^file:/.test(u));

  // клик "Новая сага" -> brief
  res.steps.toBrief = await qa.eval(H.clickText("Новая сага"));
  res.steps.brief = await st(qa);
  await qa.shot(`tmp/qa/${tag}_02_brief_aurora.png`);

  // "В путь" -> play
  res.steps.toPlay = await qa.eval(H.clickText("В путь"));
  await qa.eval("await sleep(900); return true;");
  res.steps.play = await st(qa);
  res.playState = await qa.eval(`const g=SAGA2.game; return { ui: g.getUIState(), dbg: g.getDebugState(), camera:g.camera, music: SAGA2.audio.getCurrentMusic && SAGA2.audio.getCurrentMusic() };`);
  await qa.shot(`tmp/qa/${tag}_03_play_aurora.png`);

  // HUD-геометрия: не перекрывает активного героя
  res.hudGeom = await qa.eval(`
    const g = SAGA2.game, c = document.getElementById('game').getBoundingClientRect();
    const VW = 1024, VH = 576;
    const sx = c.width / VW, sy = c.height / VH;
    const a = g.actors.find(x => x.id === g.active);
    const ax = c.left + (a.x - g.camera.x) * sx, ay = c.top + (a.y - g.camera.y) * sy;
    const actorRect = { l: c.left + (a.x - a.w/2 - g.camera.x)*sx, r: c.left + (a.x + a.w/2 - g.camera.x)*sx, t: c.top + (a.y - a.h - g.camera.y)*sy, b: ay };
    const rects = Array.from(document.querySelectorAll('.hud-top, .hud-bottom, .hud-panel, .hud-hint, .portrait-card')).filter(e => e.offsetParent !== null || getComputedStyle(e).position === 'fixed').map(e => { const r=e.getBoundingClientRect(); return { cls:e.className, l:r.left,r:r.right,t:r.top,b:r.bottom, w:r.width,h:r.height }; });
    const overl = rects.filter(r => !(actorRect.r <= r.l || actorRect.l >= r.r || actorRect.b <= r.t || actorRect.t >= r.b));
    return { canvas:c.toJSON(), scale:[sx,sy], actor: {id:a.id,x:a.x,y:a.y}, actorRect, hudRects: rects, overlapping: overl };`);

  // P -> pause
  res.steps.toPause = await qa.eval(`await key('KeyP', 90); await sleep(350); return ${H.screen};`);
  await qa.shot(`tmp/qa/${tag}_04_pause_aurora.png`);
  res.pauseMusic = await qa.eval(`return { id: SAGA2.audio._debug.getMusicId(), sched: SAGA2.audio._debug.isSchedulerRunning(), ready: SAGA2.audio.isReady(), ctx: SAGA2.audio._debug.getContextState() };`);

  // P -> resume
  res.steps.resume = await qa.eval(`await key('KeyP', 90); await sleep(250); return ${H.screen};`);

  // Esc -> pause -> Esc resume
  res.steps.escPause = await qa.eval(`await key('Escape', 90); await sleep(250); return ${H.screen};`);
  res.steps.escResume = await qa.eval(`await key('Escape', 90); await sleep(250); return ${H.screen};`);

  // H -> hint toast
  res.hint = await qa.eval(`await key('KeyH', 90); await sleep(250); const t=document.querySelector('.toast__text'); return t ? t.textContent : null;`);

  // R -> restart
  res.steps.restart = await qa.eval(`await key('KeyR', 90); await sleep(500); return { screen: document.body.dataset.screen, state: SAGA2.game.getDebugState(), time: SAGA2.game.getUIState().time };`);

  // G -> retro
  res.steps.retro = await qa.eval(`await key('KeyG', 90); await sleep(400); return ${H.screen};`);
  await qa.shot(`tmp/qa/${tag}_05_play_retro.png`);

  // pause в retro
  res.steps.pauseRetro = await qa.eval(`await key('KeyP', 90); await sleep(300); return ${H.screen};`);
  await qa.shot(`tmp/qa/${tag}_06_pause_retro.png`);
  await qa.eval(`await key('KeyP', 90); await sleep(200); return true;`);

  // help из play
  res.steps.help = await qa.eval(`await key('KeyH', 80); await sleep(100); document.querySelector('[data-focus="hud-help"]')?.click(); await sleep(400); return ${H.screen};`);
  res.helpOpen = await qa.eval(`return { open: document.body.classList.contains('help-open'), visible: !!(document.querySelector('.help-modal') && getComputedStyle(document.querySelector('.help-modal')).display !== 'none'), title: document.querySelector('.help-modal h2')?.textContent };`);
  await qa.shot(`tmp/qa/${tag}_07_help_retro.png`);
  res.steps.helpClose = await qa.eval(`await key('Escape', 90); await sleep(300); return { screen: document.body.dataset.screen, helpOpen: document.body.classList.contains('help-open') };`);

  // EN на play
  res.steps.en = await qa.eval(`await key('KeyY', 90); await sleep(400); return ${H.screen};`);
  await qa.shot(`tmp/qa/${tag}_08_play_retro_en.png`);
  res.steps.ru = await qa.eval(`await key('KeyY', 90); await sleep(300); return ${H.screen};`);

  // debug win -> complete
  res.steps.win = await qa.eval(`SAGA2.debug.win(); await sleep(1500); return { screen: document.body.dataset.screen, pending: SAGA2.main.state.pendingStats };`);
  await qa.shot(`tmp/qa/${tag}_09_complete_aurora.png`);
  res.complete = await qa.eval(`return { screen: document.body.dataset.screen, text: (document.querySelector('.screen')||{}).innerText };`);

  // next -> brief
  res.steps.next = await qa.eval(H.clickText("Следующая сага"));
  await qa.shot(`tmp/qa/${tag}_10_brief2_aurora.png`);
  res.steps.brief2 = await st(qa);

  // EN brief
  res.steps.briefEn = await qa.eval(`await key('KeyY', 80); await sleep(350); return { screen: document.body.dataset.screen, text: (document.querySelector('.screen')||{}).innerText };`);
  await qa.shot(`tmp/qa/${tag}_11_brief2_en.png`);
  await qa.eval(`await key('KeyY', 80); await sleep(250); return true;`);

  // levels screen
  res.steps.levels = await qa.eval(`SAGA2.debug.screen('levels', { unlocked: SAGA2.main.state.progress.unlocked, levels: SAGA2.LEVELS.map((lv,i)=>({index:i,name:lv.name,nameEn:lv.nameEn,stats:null})) }); await sleep(400); return ${H.screen};`);
  await qa.shot(`tmp/qa/${tag}_12_levels_aurora.png`);

  // ending (через уровень 6 + win + next)
  res.steps.endingSetup = await qa.eval(`SAGA2.debug.startLevel(6); await sleep(400); SAGA2.debug.win(); await sleep(1500); return { screen: document.body.dataset.screen };`);
  res.steps.ending = await qa.eval(H.clickText("Следующая сага"));
  await qa.eval("await sleep(500); return true;");
  res.ending = await qa.eval(`return { screen: document.body.dataset.screen, text: (document.querySelector('.screen')||{}).innerText };`);
  await qa.shot(`tmp/qa/${tag}_13_ending_aurora.png`);

  // нелишние ошибки/запросы
  res.console = qa.state.console.slice(0, 30);
  res.errors = qa.state.errors.slice(0, 30);
  res.logs = qa.state.logs.slice(0, 30);
  res.requests = qa.state.requests;
  res.failed = qa.state.failed;
  res.responses = qa.state.responses.filter((r) => r.status >= 400);

  // EN на ending
  res.steps.endingEn = await qa.eval(`await key('KeyY', 80); await sleep(350); return { screen: document.body.dataset.screen, text: (document.querySelector('.screen')||{}).innerText };`);
  await qa.shot(`tmp/qa/${tag}_14_ending_en.png`);

  // reload + continue
  await qa.navigate("index.html", 900);
  res.steps.afterReload = await st(qa);
  res.continueVisible = await qa.eval(`return { buttons: Array.from(document.querySelectorAll('button')).map(b=>b.textContent.trim()), save: localStorage.getItem('saga2.progress') };`);
  await qa.shot(`tmp/qa/${tag}_15_title_continue_aurora.png`);

  // mobile touch layer check
  if (mobile) {
    res.touch = await qa.eval(`return { isTouch: document.body.classList.contains('is-touch'), touchLayer: !!document.querySelector('.touch-layer'), touchBtns: document.querySelectorAll('.touch-btn').length };`);
  }

  await qa.close();
  return res;
}

const desktop = await run(1440, 900, "d", false);
OUT.desktop = desktop;
const mobile = await run(390, 844, "m", true);
OUT.mobile = mobile;
console.log(JSON.stringify(OUT, null, 2));
