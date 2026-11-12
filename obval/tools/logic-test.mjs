#!/usr/bin/env node
/** Browser logic tests for ОБВАЛ. */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const ROOT = resolve(process.cwd());
const PORT = 9345;
const PAGE = `file://${join(ROOT, process.env.PAGE || "index.html")}`;
const profile = mkdtempSync(join(tmpdir(), "obval-logic-"));
const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--no-sandbox", "--mute-audio",
  "--allow-file-access-from-files", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "about:blank"],
  { stdio: "ignore" });
let ws, seq = 0; const pending = new Map(); const errors = [];
function send(method, params = {}) {
  const id = ++seq;
  return new Promise((res, rej) => { pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params })); });
}
async function connect() {
  for (let i = 0; i < 80; i++) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" }); if (r.ok) return r.json(); } catch {}
    await sleep(120);
  }
  throw new Error("no chrome");
}
async function setup() {
  const tab = await connect();
  ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
    else if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    else if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push(m.params.args.map(a => a.value ?? a.description).join(" "));
  };
  await send("Page.enable"); await send("Runtime.enable");
}
async function ev(expr, awaitPromise = false) {
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise });
  if (r.exceptionDetails) throw new Error((r.exceptionDetails.exception?.description || r.exceptionDetails.text) + "\\n" + expr);
  return r.result.value;
}
async function goto() {
  await send("Page.navigate", { url: PAGE });
  for (let i = 0; i < 50; i++) { if (await ev("!!window.__OBVAL_READY__")) break; await sleep(100); }
  await sleep(200);
}
let passed = 0, failed = 0;
function check(name, condition, extra = "") {
  if (condition) { passed++; console.log("  ✓", name); }
  else { failed++; console.log("  ✗", name, extra); }
}
async function json(expr) { return JSON.parse(await ev(expr)); }

async function run() {
  await setup(); await goto();
  console.log("\\nDEFAULTS");
  const defaultGraphics = await ev("OBVAL.state.graphics");
  // index.html — движок v2: тема по умолчанию modern; legacy.html — старая страница: retro
  const expectGfx = /legacy/.test(PAGE) ? "retro" : "modern";
  check("default graphics is " + expectGfx, defaultGraphics === expectGfx, defaultGraphics);
  await ev("OBVAL.setGraphics('modern', true)");
  check("graphics toggles to neo", await ev("OBVAL.state.graphics") === "modern");
  await ev("OBVAL.setGraphics('retro', true)");
  check("graphics toggles back to retro", await ev("OBVAL.state.graphics") === "retro");

  console.log("\\nLEVEL DATA");
  const levels = await json("JSON.stringify(OBVAL.levels)");
  check("8 levels", levels.length === 8);
  check("all quotas <= 30", levels.every(l => l.quota > 0));
  const validation = await json("JSON.stringify(OBVAL.validateLevels())");
  check("level structural validation", validation.length === 0, JSON.stringify(validation));

  console.log("\\nPLAYER MOVEMENT");
  // Real keyboard gesture: starts the game and unlocks WebAudio.
  await send("Input.dispatchKeyEvent", { type: "keyDown", code: "Enter", key: "Enter", windowsVirtualKeyCode: 13 });
  await send("Input.dispatchKeyEvent", { type: "keyUp", code: "Enter", key: "Enter", windowsVirtualKeyCode: 13 });
  await sleep(250);
  await sleep(150);
  let st = await json("JSON.stringify(OBVAL.state)");
  check("starts in playing state", st.screen === "playing");
  const p0 = st.player;
  await ev("OBVAL.debug.setHeld(1)"); await sleep(180); await ev("OBVAL.debug.clearHeld()");
  await sleep(150);
  st = await json("JSON.stringify(OBVAL.state)");
  check("moves right", st.player.x > p0.x, JSON.stringify([p0, st.player]));

  console.log("\\nGEM COLLECTION");
  await ev(`(() => {
    const D = OBVAL.debug, S = D.S;
    S.enemies = [];
    S.screen = 'playing';
    S.gems = 0; S.quota = 1; S.score = 0; S.exitOpen = false;
    S.player.x = 5; S.player.y = 5; S.player.dir = 1;
    S.grid[5][5] = ' '; S.grid[5][6] = '*';
    D.tryMove(1);
  })()`);
  await sleep(50);
  st = await json("JSON.stringify(OBVAL.state)");
  check("collect gem increments counter", st.gems === 1, JSON.stringify(st));
  check("collect gem adds score", st.score >= 100, String(st.score));
  check("collecting quota opens exit", st.exitOpen === true);

  console.log("\\nGRAVITY");
  await ev(`(() => {
    const D = OBVAL.debug, S = D.S;
    S.enemies = []; S.screen = 'playing'; S.player.x = 2; S.player.y = 2;
    for (let y = 1; y < 21; y++) for (let x = 2; x < 39; x++) S.grid[y][x] = ' ';
    S.grid[4][10] = 'O';
  })()`);
  for (let i = 0; i < 8; i++) await ev("OBVAL.debug.updateGame()");
  const rockY = await ev("OBVAL.debug.S.grid.findIndex(r => r[10] === 'O')");
  check("rock falls downward", rockY > 4, String(rockY));

  console.log("\\nCRUSH ENEMY");
  await ev(`(() => {
    const D = OBVAL.debug, S = D.S;
    S.enemies = [{ x: 10, y: 8, dir: 1, type: 'firefly', alive: true, frame: 0, phase: 0 }];
    S.screen = 'playing'; S.player.x = 2; S.player.y = 2;
    for (let y = 1; y < 21; y++) for (let x = 2; x < 39; x++) S.grid[y][x] = ' ';
    S.grid[7][10] = 'O';
    S.score = 0;
    D.updateGame();
  })()`);
  st = await json("JSON.stringify(OBVAL.state)");
  check("falling rock kills enemy", st.enemies.length === 0);
  check("crush awards score", st.score >= 50, String(st.score));

  console.log("\\nPLAYER DEATH");
  await ev(`(() => {
    const D = OBVAL.debug, S = D.S;
    S.enemies = []; S.screen = 'playing'; S.lives = 3;
    S.player.x = 10; S.player.y = 8;
    for (let y = 1; y < 21; y++) for (let x = 2; x < 39; x++) S.grid[y][x] = ' ';
    S.grid[7][10] = 'O';
    D.updateGame();
  })()`);
  st = await json("JSON.stringify(OBVAL.state)");
  check("falling rock kills player", st.screen === "dying", st.screen);
  check("death costs a life", st.lives === 2, String(st.lives));

  console.log("\\nENEMY MOVEMENT / DAMAGE");
  await ev(`(() => {
    const D = OBVAL.debug, S = D.S;
    S.screen = 'playing'; S.lives = 3; S.player.x = 5; S.player.y = 5;
    for (let y = 1; y < 21; y++) for (let x = 2; x < 39; x++) S.grid[y][x] = ' ';
    S.enemies = [{ x: 6, y: 5, dir: 3, type: 'firefly', alive: true, frame: 0, phase: 0 }];
    D.updateGame();
    D.updateGame();
  })()`);
  st = await json("JSON.stringify(OBVAL.state)");
  check("enemy reaching player is lethal", st.screen === "dying", st.screen);

  console.log("\\nEND GAME FLOWS");
  await ev("OBVAL.start(0); OBVAL.debug.S.lives = 1; OBVAL.debug.killPlayer('rock');");
  await sleep(1350);
  st = await json("JSON.stringify(OBVAL.state)");
  check("last death -> gameover", st.screen === "gameover", st.screen);
  check("gameover overlay shown", await ev("document.getElementById('overlay').dataset.screen") === "gameover");

  await ev(`OBVAL.debug.loadLevel(7, {score: 1234, screen: 'playing'}); OBVAL.debug.S.gems = OBVAL.debug.S.quota; OBVAL.debug.S.exitOpen = true; OBVAL.debug.completeLevel();`);
  await sleep(1050);
  st = await json("JSON.stringify(OBVAL.state)");
  check("final level -> victory", st.screen === "victory", st.screen);
  check("victory overlay shown", await ev("document.getElementById('overlay').dataset.screen") === "victory");

  console.log("\\nLEVEL FLOW");
  await ev("OBVAL.start(0)");
  await sleep(120);
  await ev("OBVAL.debug.completeLevel()");
  await sleep(1000);
  st = await json("JSON.stringify(OBVAL.state)");
  check("complete -> clear overlay", st.screen === "clear", st.screen);
  await ev("OBVAL.debug.nextLevel()");
  await sleep(120);
  st = await json("JSON.stringify(OBVAL.state)");
  check("next level starts level 2", st.level === 1 && st.screen === "playing", JSON.stringify(st));

  console.log("\\nALL LEVELS SIM");
  for (let i = 0; i < 8; i++) {
    await ev(`OBVAL.debug.loadLevel(${i}, {score: 0, screen: 'playing'})`);
    // 250 random ticks: movement + gravity + enemies
    const result = await ev(`(() => {
      const D = OBVAL.debug, S = D.S;
      let moved = 0;
      for (let k = 0; k < 250 && S.screen === 'playing'; k++) {
        D.setHeld((Math.random() * 4) | 0);
        D.updateGame();
        if (S.screen !== 'playing') break;
        if (k % 8 === 0) D.clearHeld();
      }
      D.clearHeld();
      const flat = S.grid.flat();
      return JSON.stringify({
        screen: S.screen, level: S.level, gems: S.gems,
        badTiles: flat.filter(c => !'#. O*E'.includes(c)).length,
        gridOk: S.grid.length === 22 && S.grid.every(r => r.length === 40),
      });
    })()`);
    const r = JSON.parse(result);
    check(`level ${i + 1} simulation valid`, r.gridOk && r.badTiles === 0, JSON.stringify(r));
  }

  console.log("\\nAUDIO");
  const audio = await json(`JSON.stringify({
    ready: OBVAL.debug.Sound.ready,
    state: OBVAL.debug.Sound.ctx ? OBVAL.debug.Sound.ctx.state : null,
    track: OBVAL.debug.Sound.currentTrack,
    scheduler: !!OBVAL.debug.Sound.timer,
    musicOn: OBVAL.debug.Sound.musicOn,
  })`);
  console.log("  audio:", audio);
  check("audio context created", audio.ready === true);
  check("audio context running after gesture", audio.state === "running", audio.state);
  check("music scheduler running", audio.scheduler === true);

  console.log("\\nerrors:", errors.length ? errors : "none");
  console.log(`\\n${passed} passed, ${failed} failed`);
  process.exitCode = failed ? 1 : 0;
}
try { await run(); } catch (e) { console.error("TEST CRASH", e); process.exitCode = 1; }
finally { try { ws?.close(); } catch {} chrome.kill("SIGTERM"); await sleep(250); try { rmSync(profile, { recursive: true, force: true }); } catch {} }
