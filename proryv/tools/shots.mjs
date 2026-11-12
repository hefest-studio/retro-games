#!/usr/bin/env node
/**
 * QA-хелпер: пачка скриншотов через tools/probe.mjs (headless Chrome).
 *
 *   node proryv/tools/shots.mjs [--out=proryv/tmp/qa-shots] [--w=1280] [--h=900]
 *                               [--concurrency=4] [--list=title,play,help]
 *                               [--matrix] [--final] [--extras]
 *
 * Пишет <out>/<name>.png и печатает сводку: имя, размер, наличие ошибок консоли.
 * Ошибки probe (⚠) собираются в --errors-file (по умолчанию <out>/errors.txt).
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opt = (name, def) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : def;
};
const flag = (name) => args.includes(`--${name}`);

const OUT = resolve(opt("out", join(ROOT, "tmp", "qa-shots")));
const W = +opt("w", 1280);
const H = +opt("h", 900);
const CONC = Math.max(1, +opt("concurrency", 4));
const WAIT = +opt("wait", 1100);
const ERRORS_FILE = resolve(opt("errors-file", join(OUT, "errors.txt")));

// --storage: отдельный режим — проверка localStorage через reload (один профиль Chrome).
if (flag("storage")) {
  await runStorageTest();
  process.exit(process.exitCode || 0);
}

const STATES = ["title", "play", "exo", "briefing", "bonus", "paused", "settings", "help", "about", "levelclear", "gameover", "win"];
const GFX = ["retro", "modern"];
const LANG = ["ru", "en"];

/** job: {name, hash, w, h} */
const jobs = [];

function addJob(name, hash, w = W, h = H) {
  jobs.push({ name, hash, w, h });
}

// Матрица 12 состояний × (retro|modern) × (ru|en)
if (flag("matrix") || (!flag("final") && !flag("extras"))) {
  for (const st of STATES) {
    for (const g of GFX) {
      for (const l of LANG) addJob(`${st}_${g}_${l}`, `shot=${st}&gfx=${g}&lang=${l}`);
    }
  }
}

// Живые «игровые» кадры для README: разные темы/сектора.
if (flag("extras")) {
  const extras = [
    ["play_retro_ru_l1s1", "shot=play&gfx=retro&lang=ru&level=1&screen=1"],
    ["play_retro_ru_l2s4", "shot=play&gfx=retro&lang=ru&level=2&screen=4"],
    ["play_modern_ru_l3s2", "shot=play&gfx=modern&lang=ru&level=3&screen=2"],
    ["play_modern_ru_l4s3", "shot=play&gfx=modern&lang=ru&level=4&screen=3"],
    ["play_modern_ru_l5s2", "shot=play&gfx=modern&lang=ru&level=5&screen=2"],
    ["play_retro_en_l4s4", "shot=play&gfx=retro&lang=en&level=4&screen=4"],
    ["exo_retro_ru_l3s3", "shot=exo&gfx=retro&lang=ru&level=3&screen=3"],
    ["exo_modern_en_l5s5", "shot=exo&gfx=modern&lang=en&level=5&screen=5"],
    ["briefing_retro_ru_l2", "shot=briefing&gfx=retro&lang=ru&level=2&screen=1"],
    ["briefing_modern_ru_l5", "shot=briefing&gfx=modern&lang=ru&level=5&screen=1"],
    ["bonus_modern_ru_l3", "shot=bonus&gfx=modern&lang=ru&level=3&screen=5"],
    ["levelclear_retro_ru_l2", "shot=levelclear&gfx=retro&lang=ru&level=2&screen=5"],
    ["win_modern_en", "shot=win&gfx=modern&lang=en"],
    ["win_retro_ru", "shot=win&gfx=retro&lang=ru"],
    ["gameover_modern_ru", "shot=gameover&gfx=modern&lang=ru"],
    ["title_modern_en", "shot=title&gfx=modern&lang=en"],
    ["title_modern_ru", "shot=title&gfx=modern&lang=ru"],
    ["title_retro_en", "shot=title&gfx=retro&lang=en"],
    ["settings_retro_en", "shot=settings&gfx=retro&lang=en"],
    ["help_retro_ru", "shot=help&gfx=retro&lang=ru"],
    ["about_modern_en", "shot=about&gfx=modern&lang=en"],
    ["paused_modern_ru_l4", "shot=paused&gfx=modern&lang=ru&level=4&screen=2"],
  ];
  for (const [name, hash] of extras) addJob(name, hash);
}

// Отфильтровать по --list
const only = (opt("list", "") || "").split(",").filter(Boolean);
const selected = only.length ? jobs.filter((j) => only.some((o) => j.name === o || j.name.startsWith(o + "_") || o === "*")) : jobs;

if (!selected.length) {
  console.error("нет задач: проверьте --out/--list");
  process.exit(2);
}

mkdirSync(OUT, { recursive: true });

const results = [];
const errorLines = [];

function runJob(job) {
  return new Promise((res) => {
    const outPath = join(OUT, `${job.name}.png`);
    const page = join(ROOT, "legacy.html") + "#" + job.hash; // родные экраны игры (index.html — движок v2)
    const p = spawn(process.execPath, [
      join(ROOT, "tools", "probe.mjs"),
      page,
      outPath,
      `--w=${job.w}`,
      `--h=${job.h}`,
      `--wait=${WAIT}`,
    ], { cwd: resolve(ROOT, ".."), stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (out += d));
    p.on("close", (code) => {
      const bad = /⚠/.test(out);
      const title = (out.match(/title="([^"]*)"/) || [])[1] || "";
      results.push({ name: job.name, outPath, code, bad, title });
      if (bad || code !== 0) errorLines.push(`### ${job.name} (exit ${code})\n${out.trim()}`);
      res();
    });
  });
}

let i = 0;
async function worker() {
  while (i < selected.length) {
    const job = selected[i++];
    await runJob(job);
  }
}

const started = Date.now();
await Promise.all(Array.from({ length: Math.min(CONC, selected.length) }, worker));
results.sort((a, b) => a.name.localeCompare(b.name));

let bad = 0;
for (const r of results) {
  if (r.bad || r.code !== 0) bad++;
  console.log(`${r.bad || r.code !== 0 ? "⚠" : "✓"} ${r.name}.png  ${r.title}`);
}
writeFileSync(ERRORS_FILE, errorLines.length ? errorLines.join("\n\n") : "нет ошибок консоли\n");
console.log(`\nитого: ${results.length}, с ошибками: ${bad}, время ${((Date.now() - started) / 1000).toFixed(1)} c`);
console.log(`скриншоты: ${OUT}`);
console.log(`ошибки: ${ERRORS_FILE}`);
process.exitCode = bad ? 3 : 0;

/* ============================================================
   Режим --storage: проверка персистентности localStorage с НАСТОЯЩИМ
   reload страницы. probe.mjs не умеет reload и создаёт временный
   профиль на каждый запуск, поэтому здесь свой минимальный CDP-клиент
   с одним и тем же --user-data-dir на оба шага.
   ============================================================ */
async function runStorageTest() {
  const { spawn } = await import("node:child_process");
  const { mkdtempSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { setTimeout: sleep } = await import("node:timers/promises");

  const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const port = 9800 + Math.floor(Math.random() * 190);
  const profile = mkdtempSync(join(tmpdir(), "proryv-storage-"));
  const chrome = spawn(CHROME, [
    "--headless=new", "--disable-gpu", "--no-sandbox", "--disable-crashpad",
    "--disable-breakpad", "--hide-scrollbars", "--no-first-run", "--mute-audio",
    "--autoplay-policy=no-user-gesture-required", "--allow-file-access-from-files",
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank",
  ], { stdio: "ignore" });

  const errors = [];
  try {
    let tab = null;
    for (let i = 0; i < 80 && !tab; i++) {
      try {
        const r = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" });
        if (r.ok) tab = await r.json();
      } catch { /* ещё поднимается */ }
      if (!tab) await sleep(150);
    }
    if (!tab) throw new Error("Chrome DevTools не отвечает");
    const ws = new WebSocket(tab.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let seq = 0;
    const pending = new Map();
    const listeners = new Map();
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const { res, rej } = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
        return;
      }
      if (msg.method === "Runtime.exceptionThrown") {
        errors.push("exception: " + (msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text));
      }
      if (msg.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(msg.params.type)) {
        errors.push("console." + msg.params.type + ": " + msg.params.args.map((a) => a.value ?? a.description).join(" "));
      }
      const arr = listeners.get(msg.method);
      if (arr) { listeners.delete(msg.method); arr.forEach((fn) => fn(msg.params)); }
    };
    const send = (method, params = {}) => {
      const id = ++seq;
      return new Promise((res, rej) => { pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params })); });
    };
    const once = (name, timeout = 20000) => new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error("timeout: " + name)), timeout);
      const arr = listeners.get(name) || [];
      arr.push((p) => { clearTimeout(t); res(p); });
      listeners.set(name, arr);
    });
    const evaluate = async (expr) => {
      const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error("eval: " + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
      return r.result?.value;
    };

    await send("Page.enable");
    await send("Runtime.enable");
    await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    const pageUrl = "file://" + join(ROOT, "legacy.html");
    let loaded = once("Page.loadEventFired");
    await send("Page.navigate", { url: pageUrl });
    await loaded;
    await sleep(900);

    const write = await evaluate(`(function(){
      var before = JSON.stringify(PR.settings);
      PR.toggleLang(); PR.toggleGfx(); PR.toggleMusic(); PR.toggleSfx(); PR.toggleCrt();
      PR.saveRecord(54321);
      return JSON.stringify({
        before: JSON.parse(before),
        after: PR.settings,
        lsSettings: localStorage.getItem('proryv.settings'),
        lsRecord: localStorage.getItem('proryv.record')
      });
    })()`);
    console.log("шаг 1 (запись):", write);

    loaded = once("Page.loadEventFired");
    await send("Page.reload", { ignoreCache: true });
    await loaded;
    await sleep(1000);

    const read = await evaluate(`JSON.stringify({
      settings: PR.settings,
      record: PR.loadRecord(),
      stateRecord: PR.state.record,
      languageMenu: PR.t('menu.play'),
      gfx: PR.settings.gfx, lang: PR.settings.lang,
      music: PR.settings.music, sfx: PR.settings.sfx, crt: PR.settings.crt,
      lsSettings: localStorage.getItem('proryv.settings'),
      lsRecord: localStorage.getItem('proryv.record'),
      canvas: (function(){var c=document.getElementById('stage');return [c.width,c.height];})(),
      stage: PR_MAIN.stage(),
      title: document.title
    })`);
    console.log("шаг 2 (после reload):", read);

    const a = JSON.parse(write), b = JSON.parse(read);
    const checks = [
      ["после reload язык EN", b.lang === a.after.lang && a.after.lang === "en"],
      ["после reload графика modern", b.gfx === a.after.gfx && a.after.gfx === "modern"],
      ["после reload музыка off", b.music === false],
      ["после reload звуки off", b.sfx === false],
      ["после reload CRT off", b.crt === false],
      ["запись настроек в proryv.settings", !!a.lsSettings && a.lsSettings === JSON.stringify(a.after)],
      ["рекорд в proryv.record", a.lsRecord === "54321"],
      ["рекорд прочитан после reload", b.record === 54321 && b.stateRecord === 54321],
      ["кадр отрисован", b.canvas[0] > 0 && b.stage && b.stage.w > 0],
    ];
    let fails = 0;
    for (const [name, okv] of checks) {
      if (!okv) fails++;
      console.log(`${okv ? "✓" : "⚠"} ${name}`);
    }
    const shot = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
    const outPath = join(OUT, "storage_after_reload.png");
    mkdirSync(OUT, { recursive: true });
    writeFileSync(outPath, Buffer.from(shot.data, "base64"));
    console.log(`скриншот после reload: ${outPath}`);
    console.log(`консольных ошибок: ${errors.length}${errors.length ? " — " + errors.slice(0, 6).join(" | ") : ""}`);
    console.log(fails ? `ИТОГ: FAIL (${fails} проверок не прошло)` : "ИТОГ: PASS (все проверки localStorage прошли)");
    process.exitCode = fails ? 4 : 0;
    ws.close();
  } catch (err) {
    console.error("✗ storage:", err.message);
    process.exitCode = 1;
  } finally {
    chrome.kill("SIGKILL");
  }
}
