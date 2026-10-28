import { openQa } from "./lib.mjs";
const qa = await openQa({ page: "index.html", width: 1440, height: 900 });
await qa.send("Page.bringToFront");
qa.clearLogs();
const out = {};
const screens = ["title", "levels", "brief", "play", "pause", "complete", "ending", "help"];
const badKey = /(?:a11y|title|brand|hud|brief|pause|complete|ending|help|levels|ability|touch)\.[a-z]/i;
for (const lang of ["ru", "en"]) {
  await qa.navigate(`index.html?lang=${lang}`, 800);
  for (const scr of screens) {
    const txt = await qa.eval(`
      const LVx = LV; let s = document.body.dataset.screen;
      if (${JSON.stringify(scr)} === 'levels') { LV.debug.screen('levels',{unlocked:6,levels:LV.LEVELS.map((lv,i)=>({index:i,name:lv.name,nameEn:lv.nameEn,stats:{done:true,runes:3,score:1000,time:60,deaths:0}}))}); }
      else if (${JSON.stringify(scr)} === 'brief') { LV.debug.startLevel(2); }
      else if (${JSON.stringify(scr)} === 'play') { LV.debug.startLevel(2); }
      else if (${JSON.stringify(scr)} === 'pause') { LV.debug.startLevel(2); await sleep(200); await key('KeyP',80); }
      else if (${JSON.stringify(scr)} === 'complete') { LV.debug.startLevel(2); await sleep(200); LV.debug.win(); await sleep(1400); }
      else if (${JSON.stringify(scr)} === 'ending') { LV.debug.startLevel(6); await sleep(200); LV.debug.win(); await sleep(1400); const b=Array.from(document.querySelectorAll('button')).find(x=>/Следующая сага|Next saga/.test(x.textContent)); if(b)b.click(); await sleep(500); }
      else if (${JSON.stringify(scr)} === 'help') { const b=document.querySelector('[data-focus="hud-help"], [data-focus="title-help"]'); if(b)b.click(); else { const all=document.querySelectorAll('button'); all[all.length-1] && all[all.length-1].click(); } await sleep(400); }
      await sleep(250);
      const el = document.querySelector('.screen, .help-modal');
      return { screen: document.body.dataset.screen, text: el ? el.innerText : document.body.innerText };`);
    const t = txt.text || "";
    out[lang + "_" + scr] = {
      screen: txt.screen,
      len: t.length,
      cyr: (t.match(/[А-Яа-яЁё]+/g) || []).slice(0, 12),
      i18nKeys: (t.match(badKey) || []).slice(0, 8),
      sample: t.replace(/\s+/g, " ").slice(0, 180)
    };
  }
}
out.errors = qa.state.errors.slice(0, 10);
await qa.close();
console.log(JSON.stringify(out, null, 2));
