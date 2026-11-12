/** QA: финальные скриншоты текущего состояния + мобильная раскладка + perf. */
import { openQa } from "./lib.mjs";

const log = (...a) => console.log(...a);
const out = {};
const qa = await openQa({ page: "index.html", width: 1440, height: 900 });
await qa.send("Page.bringToFront");

async function goto(url) { qa.clearLogs(); await qa.navigate(url, 900); }

/* ---------- desktop: все экраны в двух режимах ---------- */
async function screens(mode) {
  await goto(`index.html?mode=${mode}`);
  await qa.shot(`tmp/qa/final_title_${mode}.png`, 500);
  await qa.eval(`const b=Array.from(document.querySelectorAll('button')).find(x=>/Новая сага|New saga/.test(x.textContent)); b.click(); await sleep(500); return document.body.dataset.screen;`);
  await qa.shot(`tmp/qa/final_brief_${mode}.png`, 400);
  await qa.eval(`const b=Array.from(document.querySelectorAll('button')).find(x=>/В путь|Set out/.test(x.textContent)); b.click(); await sleep(900); return document.body.dataset.screen;`);
  await qa.shot(`tmp/qa/final_play1_${mode}.png`, 900);
  out["playErrors_" + mode] = qa.state.errors.slice(0, 5);
  await qa.eval(`await key('KeyP',90); await sleep(400); return true;`);
  await qa.shot(`tmp/qa/final_pause_${mode}.png`, 350);
  await qa.eval(`const b=Array.from(document.querySelectorAll('button')).find(x=>/Продолжить|Resume/.test(x.textContent)); b.click(); await sleep(500); return true;`);
  await qa.eval(`SAGA2.debug.win(); await sleep(1500); return true;`);
  await qa.shot(`tmp/qa/final_complete_${mode}.png`, 400);
  await qa.eval(`const b=Array.from(document.querySelectorAll('button')).find(x=>/Следующая сага|Next saga/.test(x.textContent)); b.click(); await sleep(500); return true;`);
  await qa.shot(`tmp/qa/final_brief2_${mode}.png`, 300);
  await qa.eval(`SAGA2.debug.startLevel(6); await sleep(400); SAGA2.debug.win(); await sleep(1500); const b=Array.from(document.querySelectorAll('button')).find(x=>/Следующая сага|Next saga/.test(x.textContent)); b.click(); await sleep(600); return document.body.dataset.screen;`);
  await qa.shot(`tmp/qa/final_ending_${mode}.png`, 400);
  out["endingScreen_" + mode] = await qa.eval(`return document.body.dataset.screen;`);
  await qa.eval(`SAGA2.debug.screen('levels',{unlocked:6,levels:SAGA2.LEVELS.map((lv,i)=>({index:i,name:lv.name,nameEn:lv.nameEn,stats:{done:true,runes:3}}))}); await sleep(500); return true;`);
  await qa.shot(`tmp/qa/final_levels_${mode}.png`, 400);
  await goto(`index.html?level=3&mode=${mode}`);
  await qa.shot(`tmp/qa/final_play3_${mode}.png`, 900);
  out["errors_" + mode] = qa.state.errors.slice(0, 8);
}
for (const m of ["aurora", "retro"]) await screens(m);

/* ---------- EN: все экраны ---------- */
await goto("index.html?lang=en&mode=aurora");
await qa.shot("tmp/qa/final_title_en.png", 400);
await qa.eval(`SAGA2.debug.startLevel(2); await sleep(300); const b=Array.from(document.querySelectorAll('[data-focus="hud-help"]')); if(b[0])b[0].click(); await sleep(500); return true;`);
await qa.shot("tmp/qa/final_help_en.png", 400);
await qa.eval(`await key('Escape',90); await sleep(300); return true;`);
await qa.shot("tmp/qa/final_play2_en.png", 600);
out.enUniq = await qa.eval(`
  const txt = document.body.innerText;
  const cyr = (txt.match(/[А-Яа-яЁё]+/g)||[]).slice(0,20);
  return { cyrillicInEn: cyr, sample: txt.slice(0, 400) };`);

/* ---------- mobile 390x844: title/play/pause, оба режима ---------- */
async function mobile(mode) {
  const m = await openQa({ page: "index.html", width: 390, height: 844, mobile: true, root: qa.opts.ROOT });
  await m.send("Page.bringToFront");
  m.clearLogs();
  await m.navigate(`index.html?mode=${mode}`, 900);
  await m.shot(`tmp/qa/final_mobile_title_${mode}.png`, 400);
  await m.eval(`const b=Array.from(document.querySelectorAll('button')).find(x=>/Новая сага|New saga/.test(x.textContent)); b.click(); await sleep(400); const b2=Array.from(document.querySelectorAll('button')).find(x=>/В путь|Set out/.test(x.textContent)); b2.click(); await sleep(900); return document.body.dataset.screen;`);
  await m.shot(`tmp/qa/final_mobile_play_${mode}.png`, 800);
  const geo = await m.eval(`
    const c = document.getElementById('game').getBoundingClientRect();
    const stage = document.getElementById('stage').getBoundingClientRect();
    const vis = [];
    for (const sel of ['.hud-top','.hud-bottom','.touch-layer','.touch-btn','.portrait-card','.hud-hint']) {
      document.querySelectorAll(sel).forEach(e=>{ const r=e.getBoundingClientRect(); const st=getComputedStyle(e); if (st.display!=='none'&&st.visibility!=='hidden') vis.push({sel, l:Math.round(r.left),r:Math.round(r.right),t:Math.round(r.top),b:Math.round(r.bottom),w:Math.round(r.width),h:Math.round(r.height)}); });
    }
    const g = SAGA2.game;
    return { screen: document.body.dataset.screen, vp:{w:innerWidth,h:innerHeight}, canvas:{l:c.left,t:c.top,w:Math.round(c.width),h:Math.round(c.height)}, stage:{l:stage.left,t:stage.top,w:Math.round(stage.width),h:Math.round(stage.height)}, bodyScroll:{w:document.documentElement.scrollWidth,h:document.documentElement.scrollHeight}, isTouch:document.body.classList.contains('is-touch'), touchBtns:document.querySelectorAll('.touch-btn').length, rects: vis, camera:g?{x:Math.round(g.camera.x),y:Math.round(g.camera.y)}:null, actors:g?g.actors.map(a=>({id:a.id,x:Math.round(a.x),y:Math.round(a.y)})):null, errors: [] };`);
  geo.errors = m.state.errors.slice(0, 8);
  out["mobile_" + mode] = geo;
  await m.eval(`await key('KeyP',90); await sleep(400); return true;`);
  await m.shot(`tmp/qa/final_mobile_pause_${mode}.png`, 350);
  await m.close();
}
await mobile("aurora");
await mobile("retro");

/* ---------- perf: 3 c, после прогрева, при активной вкладке ---------- */
for (const mode of ["aurora", "retro"]) {
  await goto(`index.html?level=1&mode=${mode}`);
  await qa.send("Page.bringToFront");
  await qa.eval(`await sleep(1200); return true;`);
  const perf = await qa.eval(`
    const t0 = performance.now(); const times = []; let frames = 0;
    await new Promise(res => { let last = performance.now(); function tick(t){ times.push(t-last); last=t; frames++; if (t-t0 < 3000) requestAnimationFrame(tick); else res(); } requestAnimationFrame(tick); });
    times.sort((a,b)=>a-b);
    return { frames, avgFps: Math.round(frames/((performance.now()-t0)/1000)), p50: Math.round(times[Math.floor(times.length*0.5)]*10)/10, p95: Math.round(times[Math.floor(times.length*0.95)]*10)/10, max: Math.round(times[times.length-1]*10)/10 };`);
  out["perf_" + mode] = perf;
  out["perfState_" + mode] = await qa.eval(`return { canvas: [document.getElementById('game').width, document.getElementById('game').height], css: [document.getElementById('game').clientWidth, document.getElementById('game').clientHeight], mode: document.body.dataset.mode };`);
}

/* ---------- audio: реальные id треков, mute/pause, scheduler ---------- */
await goto("index.html");
const audio = await qa.eval(`
  const a = SAGA2.audio, d = a._debug;
  const r = { before: { ready: a.isReady(), id: d.getMusicId(), ctx: d.getContextState(), sched: d.isSchedulerRunning() } };
  const btn = Array.from(document.querySelectorAll('button')).find(x=>/Новая сага|New saga/.test(x.textContent));
  r.title = { id: d.getMusicId(), tracks: d.getTrackIds(), sfx: d.getSfxNames().length, compileErrors: d.getCompileErrors() };
  btn.click(); await sleep(500);
  r.brief = { screen: document.body.dataset.screen, id: d.getMusicId() };
  const b2 = Array.from(document.querySelectorAll('button')).find(x=>/В путь|Set out/.test(x.textContent)); b2.click(); await sleep(900);
  r.play = { screen: document.body.dataset.screen, id: d.getMusicId(), sched: d.isSchedulerRunning(), errs: d.getSchedulerErrors() };
  await key('KeyP',90); await sleep(450); r.pause = { id: d.getMusicId(), sched: d.isSchedulerRunning(), ctx: d.getContextState() };
  await key('KeyP',90); await sleep(350); r.resume = { id: d.getMusicId(), sched: d.isSchedulerRunning() };
  await key('KeyM',90); await sleep(300); r.mute = { muted: a.getMuted(), id: d.getMusicId() };
  await key('KeyM',90); await sleep(250);
  await key('Digit2',90); await sleep(200); await key('KeyK',90); await sleep(250); await key('KeyJ',90); await sleep(200);
  await key('Digit3',90); await sleep(200); await key('KeyJ',200); await sleep(200); await key('KeyL',90); await sleep(200);
  r.sfxErrors = d.getSchedulerErrors();
  SAGA2.debug.win(); await sleep(1500); r.complete = { screen: document.body.dataset.screen, id: d.getMusicId(), sched: d.isSchedulerRunning() };
  const b3 = Array.from(document.querySelectorAll('button')).find(x=>/Следующая сага|Next saga/.test(x.textContent)); b3.click(); await sleep(500);
  await SAGA2.debug.startLevel(6); await sleep(400); SAGA2.debug.win(); await sleep(1500);
  const b4 = Array.from(document.querySelectorAll('button')).find(x=>/Следующая сага|Next saga/.test(x.textContent)); b4.click(); await sleep(600);
  r.ending = { screen: document.body.dataset.screen, id: d.getMusicId(), sched: d.isSchedulerRunning() };
  return r;`);
audio.errors = qa.state.errors.slice(0, 8);
out.audio = audio;

await qa.close();
console.log(JSON.stringify(out, null, 2));
