import { openQa } from "./lib.mjs";
const qa = await openQa({ page: "index.html", width: 1440, height: 900 });
await qa.send("Page.bringToFront");
qa.clearLogs();
await qa.navigate("index.html?level=1&mode=retro", 700);
for (const [i, wait] of [[0, 500], [1, 1500], [2, 3000], [3, 5000]].entries()) {
  await qa.eval(`await sleep(${wait}); return true;`);
  await qa.shot(`tmp/qa/retro_t${i}.png`, 0);
  const s = await qa.eval(`return { t: Math.round(LV.game.time*10)/10, mode: document.body.dataset.mode, glitch: (LV.render._debug?1:0) };`);
  console.log(i, wait, JSON.stringify(s));
}
// также через обычный поток: title -> brief -> play
await qa.navigate("index.html?mode=retro", 700);
await qa.eval(`const b=Array.from(document.querySelectorAll('button')).find(x=>/Новая сага/.test(x.textContent)); b.click(); await sleep(400); const b2=Array.from(document.querySelectorAll('button')).find(x=>/В путь/.test(x.textContent)); b2.click(); await sleep(2200); return true;`);
await qa.shot("tmp/qa/retro_flow.png", 0);
console.log("errors", JSON.stringify(qa.state.errors.slice(0,5)));
await qa.close();
