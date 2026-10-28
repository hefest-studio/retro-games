import { openQa } from "./lib.mjs";
const out = {};
const clickText = (re) => `const b=Array.from(document.querySelectorAll('button')).find(x=>${re}.test(x.textContent)); if(!b) return {ok:false, buttons:Array.from(document.querySelectorAll('button')).map(x=>x.textContent.trim())}; b.click(); await sleep(450); return {ok:true, screen:document.body.dataset.screen};`;

/* (a) обычный поток: title -> Новая сага -> В путь + ввод + музыка */
{
  const qa = await openQa({ page: "index.html", width: 1440, height: 900 });
  await qa.send("Page.bringToFront");
  qa.clearLogs();
  await qa.navigate("index.html", 900);
  const r = {};
  r.flow1 = await qa.eval(clickText("/Новая сага|New saga/"));
  r.flow2 = await qa.eval(clickText("/В путь|Set out/"));
  await qa.eval("await sleep(900); return true;");
  r.state = await qa.eval(`const g=LV.game,a=g.activeActor(); return {screen:document.body.dataset.screen, active:a.id, x:Math.round(a.x), y:Math.round(a.y), music:LV.audio._debug.getMusicId(), ready:LV.audio.isReady(), sched:LV.audio._debug.isSchedulerRunning()};`);
  await qa.eval(`await key('KeyD', 600); await sleep(250); return true;`);
  r.afterKeyD = await qa.eval(`const a=LV.game.activeActor(); return {x:Math.round(a.x), y:Math.round(a.y)};`);
  await qa.eval(`await key('Digit2',80); await sleep(200); return true;`);
  r.switch = await qa.eval(`return LV.game.active;`);
  await qa.eval(`await key('Space',100); await sleep(120); return true;`);
  r.jump = await qa.eval(`const a=LV.game.activeActor(); return {y:Math.round(a.y),vy:Math.round(a.vy)};`);
  await qa.shot("tmp/qa/check_flow_play_aurora.png", 500);
  r.external = qa.state.requests.map(x=>x.url).filter(u=>!/^file:/.test(u));
  r.errors = qa.state.errors.slice(0,8);
  r.console = qa.state.console.slice(0,8);
  out.flow = r;
  await qa.close();
}

/* (b) retro-геймплей уровня 2 */
{
  const qa = await openQa({ page: "index.html", width: 1440, height: 900 });
  await qa.send("Page.bringToFront");
  qa.clearLogs();
  await qa.navigate("index.html?level=2&mode=retro", 1000);
  await qa.eval("await sleep(1200); return true;");
  await qa.shot("tmp/qa/check_level2_retro.png", 400);
  const rgba = await qa.eval(`
    const cv=document.getElementById('game'); const g=cv.getContext('2d');
    const d=g.getImageData(0,0,cv.width,cv.height).data;
    let nonBlack=0, green=0, total=0;
    for(let i=0;i<d.length;i+=4*17){ total++; const r=d[i],gg=d[i+1],b=d[i+2]; if(r+gg+b>36) nonBlack++; if(gg>90&&gg>r+30&&gg>b+5) green++; }
    return {nonBlackPct: Math.round(nonBlack/total*100), greenPct: Math.round(green/total*1000)/10, size:[cv.width,cv.height]};`);
  out.retro = { screen: await qa.eval("return document.body.dataset.screen;"), state: await qa.eval("return LV.debug.state();"), pixels: rgba, errors: qa.state.errors.slice(0,8), external: qa.state.requests.map(x=>x.url).filter(u=>!/^file:/.test(u)) };
  await qa.close();
}

/* (c) мобильный 390x844 play (touch) */
{
  const qa = await openQa({ page: "index.html", width: 390, height: 844, mobile: true });
  await qa.send("Page.bringToFront");
  qa.clearLogs();
  await qa.navigate("index.html?touch=1", 900);
  const r = {};
  r.flow1 = await qa.eval(clickText("/Новая сага|New saga/"));
  r.flow2 = await qa.eval(clickText("/В путь|Set out/"));
  await qa.eval("await sleep(900); return true;");
  await qa.shot("tmp/qa/check_mobile_play.png", 600);
  r.geo = await qa.eval(`
    const c=document.getElementById('game').getBoundingClientRect();
    const hb=document.querySelector('.hud-bottom').getBoundingClientRect();
    const ht=document.querySelector('.hud-top').getBoundingClientRect();
    const tb=Array.from(document.querySelectorAll('.touch-btn')).filter(e=>e.getBoundingClientRect().width>0).map(e=>{const b=e.getBoundingClientRect();return [Math.round(b.top),Math.round(b.bottom)];});
    return { screen:document.body.dataset.screen, isTouch:document.body.classList.contains('is-touch'), vp:[innerWidth,innerHeight], canvas:[Math.round(c.left),Math.round(c.top),Math.round(c.width),Math.round(c.height)], hudTop:[Math.round(ht.top),Math.round(ht.bottom)], hudBottom:[Math.round(hb.top),Math.round(hb.bottom)], touchBtns:tb.length, touchTop:Math.min(...tb.map(x=>x[0])), touchBottom:Math.max(...tb.map(x=>x[1])), scroll:[document.documentElement.scrollWidth,document.documentElement.scrollHeight], active:LV.game.active, music:LV.audio._debug.getMusicId() };`);
  await qa.eval(`await key('KeyD', 500); await sleep(200); return true;`);
  r.afterKeyD = await qa.eval(`const a=LV.game.activeActor(); return Math.round(a.x);`);
  r.errors = qa.state.errors.slice(0,8);
  out.mobile = r;
  await qa.close();
}

out.resources = {};
console.log(JSON.stringify(out, null, 2));
