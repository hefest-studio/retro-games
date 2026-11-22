#!/usr/bin/env node
/* ПОРУБЕЖЬЕ · tests/difficulty.mjs — уровни сложности ИИ скирмиша (без браузера).
   1) «Обычный» = прежний ИИ: отпечатки трёх партий ИИ против ИИ (5 мин игрового, генерируемая карта) совпадают с записанными до введения уровней;
   2) «Трудный» бьёт «Обычного» той же расы ≥ 70 % на 10 сидах — для каждой из трёх рас (нечётный сид — трудный слева сверху, чётный — справа снизу);
   3) «Обычный» бьёт «Лёгкого» той же расы ≥ 70 % на 10 сидах — для каждой расы.
   Запуск: node porubezhye/tests/difficulty.mjs [fp | hard | easy] [раса]   (всё — ~8–12 мин; GAME_JS=<путь> — проверить другой game.js) */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '..');
const sb = { console, Math, Array, Map, Set, Object, JSON, Uint8Array, Int32Array, Float32Array }; sb.window = sb; sb.globalThis = sb; vm.createContext(sb);
vm.runInContext(fs.readFileSync(process.env.GAME_JS || path.join(ROOT, 'js/game.js'), 'utf8'), sb, { filename: 'game.js' });
const P = sb.PORUB, PART = process.argv[2] || 'all', ONLY = process.argv[3] || null;
const NAME = { wright: 'Мастеровые', thicket: 'Живая чаща', barrow: 'Курганный род' }, RACES = ['wright', 'thicket', 'barrow'].filter(r => !ONLY || r === ONLY);
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], LIMIT = 25 * 60;
let failed = 0;

// отпечаток партии: все живые сущности (id, тип, сторона, координаты, здоровье) + статистика + ресурсы + исход
function fingerprint(a, b, seed, sec) {
  const g = P.create({ seed, playerRace: a, aiRace: b, aiBoth: true });
  for (let i = 0; i < sec && g.winner < 0; i++) g.update(1);
  const st = g.ents.filter(e => !e.dead).map(e => [e.id, e.type, e.owner, Math.round(e.x * 100), Math.round(e.y * 100), Math.round(e.hp * 100)].join(':')).join('|');
  return crypto.createHash('sha1').update(st + JSON.stringify(g.stats) + JSON.stringify(g.res) + g.winner + ':' + g.t.toFixed(3)).digest('hex').slice(0, 12);
}
// записано на game.js до введения уровней сложности (волна 34)
const FP = { 'wright-thicket-1': 'b9e22718be50', 'thicket-barrow-2': 'f1a4b6aa1002', 'barrow-wright-3': 'c5e30f336dd8' };

// серия: раса race уровня hi против той же расы уровня lo; возвращает победы hi
function series(race, hi, lo) {
  let w = 0; const games = [];
  for (const s of SEEDS) {
    const left = s % 2 === 1, g = P.create({ seed: s, playerRace: race, aiRace: race, ai0: left ? hi : lo, ai: left ? lo : hi, aiBoth: true });
    while (g.winner < 0 && g.t < LIMIT) g.update(1);
    const hiWon = g.winner >= 0 && (g.winner === 0) === left; if (hiWon) w++;
    games.push((g.winner < 0 ? '=' : hiWon ? '+' : '−') + (g.t / 60).toFixed(1));
  }
  return { w, games };
}

if (PART === 'all' || PART === 'fp') {
  for (const k of Object.keys(FP)) { const [a, b, s] = k.split('-'), h = fingerprint(a, b, +s, 300), ok = h === FP[k]; if (!ok) failed++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} отпечаток «Обычного» ${k}: ${h}${ok ? '' : ' (ждали ' + FP[k] + ')'}`); }
}
const table = [];
for (const [part, hi, lo] of [['hard', 'hard', 'normal'], ['easy', 'normal', 'easy']]) {
  if (PART !== 'all' && PART !== part) continue;
  for (const r of RACES) {
    const { w, games } = series(r, hi, lo), ok = w / SEEDS.length >= 0.7; if (!ok) failed++;
    const row = `${ok ? 'ok  ' : 'FAIL'} ${NAME[r]}: ${hi} ${w} : ${SEEDS.length - w} ${lo}  (${w * 10} %) — ${games.join(' ')}`;
    table.push(row); console.log(row);
  }
}
console.log(`\nсложность: ${failed ? failed + ' нарушений' : 'всё в норме'}`);
process.exit(failed ? 1 : 0);
