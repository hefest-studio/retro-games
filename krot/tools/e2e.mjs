/* ============================================================================
   DIGGER · tools/e2e.mjs — end-to-end проверка в реальном браузере (CDP).
   Владелец: Lead. Node 22+ (встроенный WebSocket), зависимостей нет.
   Запускает headless Chrome, проходит сценарий: титул → старт → движение/копание →
   выстрел → пауза → смена графики/языка → game over → рестарт → меню; проверяет
   отсутствие ошибок консоли и делает скриншоты в .tmp/e2e/.
   Запуск: node tools/e2e.mjs   (код возврата 0 — всё прошло)
   ========================================================================== */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ROOT = process.cwd();
const PROFILE = path.join(ROOT, '.tmp/e2e-profile');
const PORT = Number(process.env.E2E_PORT || 9333);
const URL = 'file://' + path.join(ROOT, 'index.html');
fs.mkdirSync(path.join(ROOT, '.tmp/e2e'), { recursive: true });
fs.rmSync(PROFILE, { recursive: true, force: true });

const chrome = spawn(CHROME, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
  '--autoplay-policy=no-user-gesture-required',
  '--remote-debugging-port=' + PORT,
  '--user-data-dir=' + PROFILE,
  '--window-size=1280,760',
  URL
], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitJson() {
  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch('http://127.0.0.1:' + PORT + '/json/list');
      const list = await r.json();
      const page = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page;
    } catch (e) {}
    await sleep(150);
  }
  throw new Error('no devtools target');
}

const results = [];
function check(name, ok, extra) { results.push({ name, ok: !!ok, extra: extra || '' }); }

let ws, msgId = 0;
const pending = new Map();
const consoleErrors = [];

function send(method, params = {}) {
  const id = ++msgId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error('timeout ' + method)); } }, 15000);
  });
}
async function evalJS(expr, awaitPromise = false) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise });
  if (r.exceptionDetails) throw new Error('eval: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result?.value;
}
async function key(code, keyName, vk, type = 'keyDown') {
  await send('Input.dispatchKeyEvent', { type, code, key: keyName, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
}
async function tapKey(code, keyName, vk) {
  await key(code, keyName, vk, 'keyDown');
  await sleep(30);
  await key(code, keyName, vk, 'keyUp');
}
async function screenshot(file) {
  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const buf = Buffer.from(r.data, 'base64');
  fs.writeFileSync(file, buf);
  return buf.length;
}

try {
  const target = await waitJson();
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id);
      if (m.error) p.reject(new Error(m.error.message)); else p.resolve(m.result);
    } else if (m.method === 'Runtime.exceptionThrown') {
      consoleErrors.push('exception: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
    } else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      consoleErrors.push('console.error: ' + m.params.args.map(a => a.value ?? a.description ?? '').join(' '));
    }
  };
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.bringToFront');
  await sleep(1800);

  const boot = await evalJS(`({
    mode: DG.engine.state.mode,
    gfx: DG.settings.gfx,
    lang: DG.i18n.lang,
    ui: DG.ui.current(),
    renderers: !!(DG.render.classic && DG.render.modern),
    audio: !!(DG.audio && DG.audio.sfx),
    canvas: [document.getElementById('game').width, document.getElementById('game').height].join('x'),
    errBox: getComputedStyle(document.getElementById('err')).display,
    title: document.title
  })`);
  check('boot: title mode + ui title', boot.mode === 'title' && boot.ui === 'title', JSON.stringify(boot));
  check('boot: renderers/audio/canvas', boot.renderers && boot.audio && boot.canvas === '960x600', boot.canvas);
  check('boot: no error box', boot.errBox === 'none', boot.errBox);

  // Enter → старт
  await tapKey('Enter', 'Enter', 13);
  await sleep(120);
  const st1 = await evalJS(`({ mode: DG.engine.state.mode, ui: DG.ui.current(), audioReady: DG.audio.isReady() })`);
  check('Enter starts game (ready)', st1.mode === 'ready', st1.mode);
  check('ui hidden during game', st1.ui === null || st1.ui === undefined, String(st1.ui));
  check('audio unlocked after gesture', st1.audioReady === true, String(st1.audioReady));
  await sleep(2200);
  const st2 = await evalJS(`({ mode: DG.engine.state.mode, time: DG.engine.state.time })`);
  check('mode -> play after ready', st2.mode === 'play', st2.mode);

  // движение: держим вправо 500мс
  const before = await evalJS(`({ cx: DG.engine.state.player.cx, dug: DG.engine.state.stats.dug })`);
  await key('ArrowRight', 'ArrowRight', 39, 'keyDown');
  await sleep(500);
  await key('ArrowRight', 'ArrowRight', 39, 'keyUp');
  const after = await evalJS(`({ cx: DG.engine.state.player.cx, cy: DG.engine.state.player.cy, dug: DG.engine.state.stats.dug, x: DG.engine.state.player.x })`);
  check('arrow moves/digs player', (after.cx !== before.cx || after.cy !== before.cy) && after.dug > before.dug, JSON.stringify({ before, after }));

  // выстрел
  const shots0 = await evalJS(`DG.engine.state.stats.shots`);
  await tapKey('Space', ' ', 32);
  await sleep(120);
  const shots1 = await evalJS(`DG.engine.state.stats.shots`);
  check('space fires', shots1 > shots0, shots0 + '->' + shots1);

  // пауза
  await tapKey('KeyP', 'p', 80);
  await sleep(150);
  const p1 = await evalJS(`({ paused: DG.engine.state.paused, ui: DG.ui.current() })`);
  check('P pauses + pause ui', p1.paused === true && p1.ui === 'pause', JSON.stringify(p1));
  await tapKey('KeyP', 'p', 80);
  await sleep(150);
  const p2 = await evalJS(`({ paused: DG.engine.state.paused, ui: DG.ui.current() })`);
  check('P resumes', p2.paused === false && (p2.ui === null || p2.ui === undefined), JSON.stringify(p2));

  // графика/язык/музыка/CRT
  await tapKey('KeyG', 'g', 71);
  await sleep(350);
  const g1 = await evalJS(`({ gfx: DG.settings.gfx, cls: document.body.className,
    stored: (function () { try { return JSON.parse(localStorage.getItem('digger.settings.v1') || 'null'); } catch (e) { return null; } })() })`);
  check('G switches to modern (in session)', g1.gfx === 'modern' && /gfx-modern/.test(g1.cls) &&
    (!g1.stored || g1.stored.gfx === undefined), JSON.stringify(g1));
  const shotSize = await screenshot(path.join(ROOT, '.tmp/e2e/e2e_modern.png'));
  check('modern screenshot non-trivial', shotSize > 60000, String(shotSize));

  await tapKey('KeyL', 'l', 76);
  await sleep(250);
  const l1 = await evalJS(`({ lang: DG.i18n.lang, htmlLang: document.documentElement.lang })`);
  check('L switches language', l1.lang === 'en' && l1.htmlLang === 'en', JSON.stringify(l1));
  await tapKey('KeyL', 'l', 76);
  await sleep(150);

  await tapKey('KeyM', 'm', 77);
  await sleep(120);
  const m1 = await evalJS(`({ music: DG.settings.music, audioMusic: DG.audio.getMusicEnabled ? DG.audio.getMusicEnabled() : null })`);
  check('M toggles music', m1.music === false && m1.audioMusic === false, JSON.stringify(m1));
  await tapKey('KeyM', 'm', 77);
  await sleep(120);

  // пауза через Esc и возврат в меню (сначала гарантируем игровое состояние)
  await evalJS(`(function(){
    var S=DG.engine.state;
    if (S.mode !== 'play' && S.mode !== 'bonus') { DG.engine.start(); S.mode='play'; }
    S.paused=false; S.player.alive=true; S.player.invuln=99; S.readyT=0;
    DG.ui.show(null);
  })()`);
  await sleep(150);
  await tapKey('Escape', 'Escape', 27);
  await sleep(200);
  const esc1 = await evalJS(`({ ui: DG.ui.current(), paused: DG.engine.state.paused })`);
  check('Esc opens pause', esc1.ui === 'pause', JSON.stringify(esc1));
  await tapKey('Escape', 'Escape', 27);
  await sleep(200);
  check('Esc closes pause', (await evalJS(`DG.ui.current()`)) === null);

  // помощь H
  await tapKey('KeyH', 'h', 72);
  await sleep(250);
  check('H opens help', (await evalJS(`DG.ui.current()`)) === 'help');
  await screenshot(path.join(ROOT, '.tmp/e2e/e2e_help.png'));
  await tapKey('Escape', 'Escape', 27);
  await sleep(200);

  // gameover: убираем жизни и ставим монстра на игрока
  await evalJS(`(function(){
    var S = DG.engine.state;
    S.lives = 1; S.player.invuln = 0; S.mode = 'play';
    var p = S.player;
    S.monsters.push({kind:'nobbin', cx:p.cx, cy:p.cy, x:p.x, y:p.y, tx:p.x, ty:p.y, dir:0, scared:false, dying:0, spawnT:1, moving:false, think:0.2, fromX:p.cx, fromY:p.cy, walkPhase:0});
  })()`);
  await sleep(300);
  const d1 = await evalJS(`DG.engine.state.mode`);
  check('death starts dying', d1 === 'dying', d1);
  await sleep(2000);
  const over = await evalJS(`({ mode: DG.engine.state.mode, ui: DG.ui.current(), lives: DG.engine.state.lives, score: DG.engine.state.score })`);
  check('game over + ui', over.mode === 'gameover' && over.ui === 'gameover' && over.lives === 0, JSON.stringify(over));
  await screenshot(path.join(ROOT, '.tmp/e2e/e2e_gameover.png'));

  // Enter на gameover → рестарт
  await tapKey('Enter', 'Enter', 13);
  await sleep(300);
  const rs = await evalJS(`({ mode: DG.engine.state.mode, lives: DG.engine.state.lives, score: DG.engine.state.score, level: DG.engine.state.level })`);
  check('restart from gameover', (rs.mode === 'ready' || rs.mode === 'play') && rs.lives === 3 && rs.score === 0 && rs.level === 1, JSON.stringify(rs));

  // возврат в меню: Esc → pause → кнопка "В меню" через ui API
  await sleep(200);
  const menuOk = await evalJS(`(function(){
    if (DG.engine.state.mode === 'ready' || DG.engine.state.mode === 'play') { DG.engine.pause(true); }
    DG.ui.show('pause');
    return DG.ui.current();
  })()`);
  check('pause overlay via ui', menuOk === 'pause', String(menuOk));
  await evalJS(`DG.ui.init; void 0`); // no-op
  const back = await evalJS(`(function(){
    var btn = Array.prototype.slice.call(document.querySelectorAll('#ui button')).find(function(b){ return /В меню|Main menu/i.test(b.textContent); });
    if (btn) { btn.click(); return 'clicked'; } return 'no-btn';
  })()`);
  await sleep(300);
  const menuState = await evalJS(`({ mode: DG.engine.state.mode, ui: DG.ui.current() })`);
  check('menu button returns to title', menuState.mode === 'title' && menuState.ui === 'title', back + ' ' + JSON.stringify(menuState));

  // финальный скриншот титула modern
  await screenshot(path.join(ROOT, '.tmp/e2e/e2e_title.png'));

  // перезагрузка: по умолчанию снова ретро-режим (8-бит)
  await send('Page.reload', { ignoreCache: true });
  await sleep(2400);
  const reloaded = await evalJS(`({ gfx: DG.settings.gfx, cls: document.body.className,
    mode: DG.engine.state.mode, ui: DG.ui.current() })`);
  check('reload starts in retro (8-bit) mode',
    reloaded.gfx === 'classic' && /gfx-classic/.test(reloaded.cls) && reloaded.mode === 'title',
    JSON.stringify(reloaded));

  check('no console errors', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
} catch (e) {
  consoleErrors.push('E2E fatal: ' + e.stack);
  check('e2e completed', false, e.message);
} finally {
  try { ws && ws.close(); } catch (e) {}
  chrome.kill('SIGKILL');
}

const pass = results.filter(r => r.ok).length;
console.log('E2E ' + pass + '/' + results.length + (pass === results.length ? ' PASS' : ' FAIL'));
for (const r of results) console.log((r.ok ? 'PASS ' : 'FAIL ') + r.name + (r.extra ? '  — ' + r.extra : ''));
if (consoleErrors.length) { console.log('--- errors:'); consoleErrors.forEach(e => console.log(' ', e)); }
process.exit(pass === results.length ? 0 : 1);
