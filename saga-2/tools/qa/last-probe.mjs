import { openQa } from "./lib.mjs";
const out = {};

/* 1. mobile touch=1 (как на реальном телефоне) */
for (const mode of ["aurora", "retro"]) {
  const m = await openQa({ page: "index.html", width: 390, height: 844, mobile: true, root: process.cwd() });
  await m.send("Page.bringToFront");
  m.clearLogs();
  await m.navigate(`index.html?mode=${mode}&touch=1`, 800);
  await m.shot(`tmp/qa/touch_title_${mode}.png`, 300);
  await m.eval(`const b=Array.from(document.querySelectorAll('button')).find(x=>/Новая сага/.test(x.textContent)); b.click(); await sleep(350); const b2=Array.from(document.querySelectorAll('button')).find(x=>/В путь/.test(x.textContent)); b2.click(); await sleep(900); return document.body.dataset.screen;`);
  await m.shot(`tmp/qa/touch_play_${mode}.png`, 700);
  out["touch_" + mode] = await m.eval(`
    const r = sel => Array.from(document.querySelectorAll(sel)).map(e=>{const b=e.getBoundingClientRect(); const s=getComputedStyle(e); return {cls:String(e.className),l:Math.round(b.left),r:Math.round(b.right),t:Math.round(b.top),b:Math.round(b.bottom),shown:s.display!=='none'&&s.visibility!=='hidden'&&b.width>0};});
    const c=document.getElementById('game').getBoundingClientRect();
    return { isTouch: document.body.classList.contains('is-touch'), canvas:{l:c.left,t:c.top,w:Math.round(c.width),h:Math.round(c.height)}, hud:r('.hud-top,.hud-bottom'), touch:r('.touch-btn'), errs:[] };`);
  out["touch_" + mode].errors = m.state.errors.slice(0,5);
  await m.close();
}

/* 2. механики: реальные key events, без debug-телепорта */
const qa = await openQa({ page: "index.html", width: 1440, height: 900 });
await qa.send("Page.bringToFront");
qa.clearLogs();
async function walkJump() {
  await qa.navigate("index.html?level=1", 800);
  const r = {};
  r.start = await qa.eval(`const g=LV.game,a=g.activeActor(); return {id:a.id,x:Math.round(a.x),y:Math.round(a.y),onGround:a.onGround};`);
  await qa.eval(`const fire=(t)=>window.dispatchEvent(new KeyboardEvent(t,{code:'ArrowRight',key:'ArrowRight',bubbles:true})); fire('keydown'); await sleep(700); fire('keyup'); await sleep(200); return true;`);
  r.afterRight = await qa.eval(`const a=LV.game.activeActor(); return {id:a.id,x:Math.round(a.x),y:Math.round(a.y),vx:Math.round(a.vx)};`);
  await qa.eval(`await key('Space',120); await sleep(120); return true;`);
  r.jumpApex = await qa.eval(`const a=LV.game.activeActor(); return {y:Math.round(a.y),vy:Math.round(a.vy)};`);
  await qa.eval(`await sleep(800); return true;`);
  r.landed = await qa.eval(`const a=LV.game.activeActor(); return {y:Math.round(a.y),onGround:a.onGround};`);
  await qa.eval(`await key('Digit2',80); await sleep(150); return true;`);
  r.switch2 = await qa.eval(`return LV.game.active;`);
  r.bowBefore = await qa.eval(`return (LV.game.projectiles||[]).length;`);
  await qa.eval(`await key('KeyK',90); await sleep(150); return true;`);
  r.bowAfter = await qa.eval(`return { n:(LV.game.projectiles||[]).length, list:(LV.game.projectiles||[]).map(p=>({x:Math.round(p.x),y:Math.round(p.y)})) };`);
  await qa.eval(`await key('Digit3',80); await sleep(150); return true;`);
  await qa.eval(`LV.input.set('action', true); await sleep(300); return true;`);
  r.olafShield = await qa.eval(`const a=LV.game.activeActor(); return {id:a.id, shieldUp:a.shieldUp, keys:Object.keys(a).filter(k=>/shield|block/i.test(k))};`);
  await qa.eval(`LV.input.set('action', false); await sleep(100); return true;`);
  await qa.eval(`await key('Digit1',80); await sleep(150); return true;`);
  await qa.eval(`LV.input.set('right', true); await sleep(400); LV.input.set('right', false); await sleep(100); return true;`);
  r.inputApiWalk = await qa.eval(`const a=LV.game.activeActor(); return {x:Math.round(a.x)};`);
  r.errors = qa.state.errors.slice(0,6);
  return r;
}
out.mech = await walkJump();

/* 3. аудио: появляется ли title-трек после жеста */
await qa.navigate("index.html", 800);
out.audio2 = await qa.eval(`
  const a=LV.audio,d=a._debug;
  const r={ boot:{ready:a.isReady(),id:d.getMusicId()} };
  await key('KeyG',80); await sleep(500);
  r.afterG={ready:a.isReady(),id:d.getMusicId(),ctx:d.getContextState(),sched:d.isSchedulerRunning()};
  await key('KeyY',80); await sleep(300);
  r.afterY={id:d.getMusicId()};
  return r;`);

/* 4. perf без --disable-gpu (проверка, что 8-13 fps — артефакт софт-рендера) */
try {
  const q2 = await openQa({ page: "index.html", width: 1440, height: 900, gpu: true });
  await q2.send("Page.bringToFront");
  await q2.navigate("index.html?level=1&mode=aurora", 2000);
  out.perf_gpu = await q2.eval(`const t0=performance.now();let n=0;const ts=[];await new Promise(res=>{let last=performance.now();function tick(t){ts.push(t-last);last=t;n++;if(t-t0<2500)requestAnimationFrame(tick);else res();}requestAnimationFrame(tick);});ts.sort((a,b)=>a-b);return {fps:Math.round(n/((performance.now()-t0)/1000)),p50:Math.round(ts[Math.floor(ts.length*.5)]*10)/10,p95:Math.round(ts[Math.floor(ts.length*.95)]*10)/10};`);
  await q2.close();
} catch (e) { out.perf_gpu = "ERROR: " + e.message; }

out.console = qa.state.console.slice(0,10);
await qa.close();
console.log(JSON.stringify(out, null, 2));
