/* Gameplay probe: dispatches real DOM key events, lets the game run, reports state.
   Run via: node tools/cdp.mjs eval --page "index.html#shot=play&stage=1&x=1500" --script tools/probe.js --shot screenshots/probe.png */
const out = { start: __RUBEZH_DBG.state() };
function kd(code) { window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true })); }
function ku(code) { window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true })); }

kd('ArrowRight');
kd('KeyJ');
await sleep(450);
out.running = __RUBEZH_DBG.state();
kd('Space');
await sleep(140);
ku('Space');
await sleep(550);
out.air = __RUBEZH_DBG.state();
await sleep(450);
ku('ArrowRight');
ku('KeyJ');
out.end = __RUBEZH_DBG.state();
out.audio = (function () {
  try {
    const a = RUBEZH_AUDIO;
    return { present: !!a, ready: a && a.isReady(), muted: a && a.getMuted() };
  } catch (e) { return { error: String(e) }; }
})();
return out;
