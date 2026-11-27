/* ПОДКОП · бот-«человек» для проверки баланса: проигрывает записанные решения (tests/solve.mjs) с человеческим шумом — паузы перед действием (jit),
   реакция на врага (react), лишний шаг при ходьбе (slip; у шипов и обрыва это смерть). Каждая партия: 7 уровней подряд, 3 жизни (+1 после 3-го и 6-го), смерть — уровень заново.
   Запуск: node podkop/tests/bot.mjs [партий=20] [seed=1] [jit] [react] [slip] */
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { runScript, SOLUTIONS, rng } from './solve.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sb = { console, Math, Date, JSON }; sb.window = sb; sb.globalThis = sb; vm.createContext(sb);
for (const f of ['js/game.js', 'js/levels.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sb, { filename: f });
export const PK = sb.PODKOP;
export function playRun(seed, o = {}) {
  const R = rng(seed), opt = { rand: R, jit: o.jit ?? 0.3, react: o.react ?? 0.4, slip: o.slip ?? 0.05, waste: o.waste ?? 0.08, short: o.short ?? 0.2 };
  const g = PK.Game({ level: 0, seed }); const first = [], tries = [];
  let lv = -1, att = 0, guard = 0;
  while (!g.isOver() && guard++ < 60) {
    const S = g.state(); if (S.level !== lv) { lv = S.level; att = 0; }
    att++;
    const r = runScript(g, SOLUTIONS[S.level], opt);
    if (first[S.level] === undefined) first[S.level] = r.mode === 'clear' ? 1 : 0;
    if (r.mode === 'clear') { tries[S.level] = att; for (let i = 0; i < 400 && g.state().mode === 'clear'; i++) g.step(1 / 30); }   // авто-переход
    else { for (let i = 0; i < 400 && g.state().mode === 'dying'; i++) g.step(1 / 30); }
  }
  const E = g.state(); return { won: E.mode === 'victory', score: E.score, level: E.level, first, tries };
}
if (process.argv[1] && process.argv[1].endsWith('bot.mjs')) {
  const n = +process.argv[2] || 20, seed0 = +process.argv[3] || 1, o = { jit: process.argv[4] ? +process.argv[4] : undefined, react: process.argv[5] ? +process.argv[5] : undefined, slip: process.argv[6] ? +process.argv[6] : undefined };
  const L = PK.consts.MAX_LEVEL, ok = new Array(L).fill(0), tot = new Array(L).fill(0); let wins = 0, sc = 0;
  for (let i = 0; i < n; i++) { const r = playRun(seed0 + i, o); if (r.won) wins++; sc += r.score; r.first.forEach((v, k) => { tot[k]++; ok[k] += v; }); }
  console.log('партий ' + n + ', побед ' + wins + ' (' + Math.round(100 * wins / n) + '%), средний счёт ' + Math.round(sc / n));
  console.log('успех с первой попытки по уровням: ' + ok.map((v, k) => (k + 1) + ':' + Math.round(100 * v / Math.max(1, tot[k])) + '%').join('  '));
}
