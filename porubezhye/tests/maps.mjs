#!/usr/bin/env node
/* ПОРУБЕЖЬЕ · tests/maps.mjs — карты скирмиша (без браузера).
   1) каждая карта (gen, grove «Чаща», pass «Перевал», wide «Раздолье») на сидах 1–4: центрально-симметрична, связна (базы и все месторождения),
      базы и месторождения на чистой земле; у wide — 88×66 и 4 месторождения вне баз (по два ближе к каждой стороне);
   2) на каждой новой карте ИИ каждой расы доигрывает партию: все три пары рас в обе стороны (6 партий, «Обычный» против «Обычного»),
      победа меньше чем за 25 мин игрового.
   Запуск: node porubezhye/tests/maps.mjs [карта]   (~3–5 мин) */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '..');
const sb = { console, Math, Array, Map, Set, Object, JSON, Uint8Array, Int32Array, Float32Array }; sb.window = sb; sb.globalThis = sb; vm.createContext(sb);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/game.js'), 'utf8'), sb, { filename: 'game.js' });
const P = sb.PORUB, ONLY = process.argv[2] || null, TR = P.TERR;
const NAME = { wright: 'Мастеровые', thicket: 'Живая чаща', barrow: 'Курганный род' };
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function ok(c, m) { if (!c) throw new Error(m || 'ложь'); }

const IDS = P.MAP_IDS.filter(id => !ONLY || id === ONLY);
test('список карт: gen, grove, pass, wide', () => ok(P.MAP_IDS.join() === 'gen,grove,pass,wide', P.MAP_IDS.join()));
for (const id of IDS) test(`карта ${id}: симметрия, связность, базы и месторождения на чистой земле (сиды 1–4)`, () => {
  for (let seed = 1; seed <= 4; seed++) {
    const g = P.create({ seed, mapId: id, playerRace: 'wright', aiRace: 'barrow', noAI: true }), W = g.MW, H = g.MH;
    ok(g.mapId === id, 'mapId ' + g.mapId);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) ok(g.terr[y * W + x] === g.terr[(H - 1 - y) * W + (W - 1 - x)], `асимметрия ${x},${y} (сид ${seed})`);
    ok(P.connectedL(P.skirmLayout(id, seed)), 'не связна, сид ' + seed);
    const a = g.ents.find(e => e.owner === 0 && e.kind === 'b'), b = g.ents.find(e => e.owner === 1 && e.kind === 'b');
    const path0 = g.pathToRect(Math.floor(a.x / P.T), a.ty + a.s, b, 1); ok(path0 && path0.found, 'базы не связаны (A*), сид ' + seed);
    g.ents.filter(e => e.kind === 'n').forEach(n => { for (let y = n.ty; y < n.ty + n.s; y++) for (let x = n.tx; x < n.tx + n.s; x++) { const t = g.terr[y * W + x]; ok(t === TR.GRASS || t === TR.HEATH, `${n.type} на ${x},${y}: земля ${t}`); } });
    const mine = g.ents.filter(e => e.kind === 'n' && (e.type === 'amber' || e.type === 'resin')).length, theirs = g.ents.filter(e => e.kind === 'n' && (e.type === 'stone' || e.type === 'ore')).length;
    ok(mine === theirs && mine > 0, 'месторождения поровну: ' + mine + ' / ' + theirs);
    if (id === 'wide') { ok(W === 88 && H === 66, 'размер ' + W + '×' + H); ok(g.ents.filter(e => e.type === 'resin').length === 3, 'жил у стороны: база + 2 на карте'); }
    else ok(W === 64 && H === 48, 'размер ' + W + '×' + H);
  }
  // рисованные карты не меняют облик от сида (кроме вереска/камешков) — проход всегда есть; разные карты различаются
});
test('карты различаются между собой', () => {
  const k = id => Array.from(P.create({ seed: 1, mapId: id, noAI: true }).terr).join('');
  const s = new Set(['gen', 'grove', 'pass'].map(k)); ok(s.size === 3, 'карты совпали');
});
test('неизвестная карта — генерируемая (как раньше)', () => { const g = P.create({ seed: 2, mapId: 'nope', noAI: true }); ok(g.mapId === 'gen' && g.seedKey === 2, g.mapId + ' ' + g.seedKey); });

const PAIRS = [['wright', 'thicket'], ['wright', 'barrow'], ['thicket', 'barrow']];
for (const id of IDS.filter(i => i !== 'gen')) {
  const rows = [];
  test(`карта ${id}: ИИ каждой расы доигрывает (3 пары × 2 стороны), < 25 мин`, () => {
    const bad = [];
    PAIRS.forEach(([A, B], i) => [0, 1].forEach(flip => {
      const left = flip ? B : A, right = flip ? A : B, seed = 1 + i * 2 + flip, g = P.create({ seed, mapId: id, playerRace: left, aiRace: right, aiBoth: true });
      while (g.winner < 0 && g.t < 25 * 60) g.update(1);
      const w = g.winner >= 0 ? g.races[g.winner] : null; rows.push(`${NAME[left]} – ${NAME[right]}: ${w ? NAME[w] : 'нет победителя'} за ${(g.t / 60).toFixed(1)} мин`);
      if (!w || g.t >= 25 * 60) bad.push(left + '–' + right);
    }));
    rows.forEach(r => console.log('     ' + r));
    ok(!bad.length, 'не доиграли: ' + bad.join(', '));
  });
}

console.log(`\n${passed} прошло, ${failed} упало`);
process.exit(failed ? 1 : 0);
