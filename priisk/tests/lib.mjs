/* ПРИИСК · tests/lib.mjs — общее для тестов кампании (публичных и полной сборки): загрузка логики в node:vm, мини-раннер,
   хранилище в памяти, шаги мира, мини-миссия, бот с реакцией 150–250 мс, проверка проходимости (A*).
   Миссии грузятся через реестр js/missions/index.js — те, что перечислены для флага сборки из js/edition.js и есть на диске
   (отсутствующий файл пропускается и попадает в missing — как в браузере). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '..');

// opts.search — location.search в песочнице (?edition=…); opts.build — подменить флаг сборки (имитация другой сборки)
export function loadGame(opts = {}) {
  const sandbox = { console, Math, setTimeout, clearTimeout, Date, JSON, location: { search: opts.search || '' } };
  sandbox.window = sandbox; sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  const run = f => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
  for (const f of ['js/i18n.js', 'js/edition.js', 'js/game.js', 'js/campaign-core.js', 'js/campaign.js', 'js/missions/index.js']) run(f);
  const P = sandbox.PRIISK;
  if (opts.build) { P.Edition.BUILD = opts.build; P.EDITION = P.Edition.resolve(opts.search || '', opts.build); }
  const missing = [];
  for (const id of P.missionFiles(P.Edition.BUILD)) {
    const f = 'js/missions/' + id + '.js';
    if (fs.existsSync(path.join(ROOT, f))) run(f); else missing.push(id);
  }
  return { sandbox, P, L: P.logic, C: P.campaign, STR: P.STR, missing };
}

// ---------- мини-раннер ----------
const queue = [];
export function test(name, fn) { queue.push([name, fn]); }
export function eq(a, b, m) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
export function ok(c, m) { if (!c) throw new Error(m || 'ложь'); }
export async function runAll() {
  let passed = 0, failed = 0;
  for (const [name, fn] of queue) {
    try { await fn(); passed++; console.log('ok   ' + name); }
    catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); }
  }
  console.log(`\n${passed} прошло, ${failed} упало`);
  process.exit(failed ? 1 : 0);
}

export function memStore() { const m = new Map(); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), m }; }

export function helpers(G) {
  const { L, C } = G;
  function tickN(W, sec, dt = 1 / 30, until) { const n = Math.round(sec / dt); for (let i = 0; i < n; i++) { C.tick(W, dt); W.events.length = 0; if (until && until()) return true; } return false; }
  // мини-миссия для модульных проверок
  function tiny(extra = {}) {
    return Object.assign({
      id: 't1', n: 99, title: 'т', brief: 'т',
      map: [
        '####################',
        '#S.......#.........#',
        '#........#....E....#',
        '#..==....#.........#',
        '#..==..............#',
        '#........#.....K...#',
        '#oo......#.........#',
        '####################'],
      legend: {},
      zones: { k: { at: 'K', r: 2 }, ice: { x: 3, y: 3, w: 2, h: 2 }, right: { x: 10, y: 1, w: 9, h: 6 } },
      player: { copper: 100, build: ['boiler'], units: [], start: [{ type: 'rifleman', at: 'S', n: 2 }] },
      enemy: { start: [] },
      objectives: [{ id: 'go', icon: 'eye', text: 'дойди', done: { t: 'zone', zone: 'k' } }],
      triggers: []
    }, extra);
  }
  function reach(W, from, to, tol = 1.6) { const p = L.findPath(W, from.x, from.y, to.x, to.y); const e = p.length ? p[p.length - 1] : from; return Math.hypot(e.x - to.x, e.y - to.y) <= tol; }
  // Бот: каждое решение исполняется с задержкой реакции 150–250 мс игрового времени, одно действие за раз.
  function bot(W, plan, seed = 1) {
    const rng = L.mulberry32(seed); let pend = null; const st = { acts: 0 };
    st.step = () => { if (pend) { if (W.time >= pend.at) { pend.fn(); pend = null; st.acts++; } return; } const fn = plan(W, st); if (fn) pend = { at: W.time + 0.15 + rng() * 0.1, fn }; };
    return st;
  }
  const activeObj = W => W.mission.objs.find(o => o.state === 'active' && o.def.kind !== 'opt' && o.id !== 'defend');
  const foesNear = (W, x, y, r) => W.units.filter(e => e.owner === 1 && Math.hypot(e.x - x, e.y - y) < r);
  // тексты миссии: у реплик, целей и звёзд есть RU и EN; брифинг — не длиннее 2 фраз
  function checkTexts(id) {
    const d = C.byId(id);
    const chk = (o, w) => ok(o && o.ru && o.en, id + ': нет RU/EN у ' + w);
    chk(d.title, 'title'); chk(d.brief, 'brief'); ok((d.brief.ru.match(/[.!?…]/g) || []).length <= 2, id + ': длинный брифинг');
    d.objectives.forEach(o => chk(o.text, o.id)); (d.stars || []).forEach((s, i) => chk(s.text, 'star' + i));
    d.triggers.forEach(t => t.do.forEach(a => { if (a.text) chk(a.text, t.id); }));
  }
  // карта миссии: прямоугольная, рамка из скал, все точки на проходимых клетках
  function checkMap(id) {
    const d = C.byId(id), m = C.parseMap(d.map, d.legend);
    for (let i = 0; i < m.w; i++) { eq(m.t[i], L.ROCK, id + ' верх'); eq(m.t[(m.h - 1) * m.w + i], L.ROCK, id + ' низ'); }
    for (const k of Object.keys(m.points)) m.points[k].forEach(c => ok(L.walkable(m.t[c.j * m.w + c.i]), id + ': точка ' + k + ' в скале'));
  }
  return { tickN, tiny, reach, bot, activeObj, foesNear, checkTexts, checkMap };
}
