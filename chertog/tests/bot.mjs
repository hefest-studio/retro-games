/* ЧЕРТОГ · бот. solveAll — точный решатель (поиск в ширину) по всем сценам; humanBot — «человеческий» игрок с ограниченным обзором:
   смотрит вперёд не более N состояний (бюджет), идёт по найденному решению, иначе — к выходу «на глаз»; каждый ход с шансом slip ошибается. */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function load() {
  const ctx = { console, Math, Date }; ctx.window = ctx; ctx.globalThis = ctx; vm.createContext(ctx);
  for (const f of ['js/game.js', 'js/levels.js', 'js/i18n.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  return ctx.CHERTOG;
}
function bounded(L, P, def, s, budget) {
  const seen = new Map(), q = [[s, null]]; let head = 0, best = null, bd = 1e9; seen.set(L.key(s), 1);
  const ex = P.exit;
  while (head < q.length && head < budget) {
    const [cur, first] = q[head++];
    for (const a of L.ACTS) {
      const n = L.step(P, cur, a); if (n === cur || n.dead) continue; const f = first || a;
      if (n.won) return { path: f, win: true };
      const k = L.key(n); if (seen.has(k)) continue; seen.set(k, 1); q.push([n, f]);
      const d = Math.abs(n.hx - ex[0]) + Math.abs(n.hy - ex[1]); if (d < bd) { bd = d; best = f; }
    }
  }
  return { path: best, win: false };
}
export function humanBot(C, def, { budget = 1500, slip = 0.04, rng, cap }) {
  const L = C.logic, P = L.parse(def); let s = L.init(def), moves = 0; cap = cap || def.par * 4;
  while (moves < cap) {
    let a;
    if (rng() < slip) a = L.ACTS[Math.floor(rng() * L.ACTS.length)];
    else { const r = bounded(L, P, def, s, budget); a = r.path; }
    if (!a) a = 'A';
    const n = L.step(P, s, a); moves++;
    if (n === s) continue;
    if (n.won) return { won: true, moves };
    if (n.dead) { s = L.init(def); continue; }   // «отмена хода/сцена заново»: человек начинает сцену заново, ходы засчитываются
    s = n;
  }
  return { won: false, moves };
}
export function rate(C, i, runs, opts, seed) {
  const L = C.logic; const rng = L.mulberry32(seed + i * 977); let w = 0;
  for (let k = 0; k < runs; k++) if (humanBot(C, C.LEVELS[i], Object.assign({ rng }, opts)).won) w++;
  return w / runs;
}
if (process.argv[1] && process.argv[1].endsWith('bot.mjs')) {
  const C = load(), runs = +process.argv[2] || 20, budget = +process.argv[3] || 1500;
  C.LEVELS.forEach((d, i) => { const sol = C.logic.solve(d); console.log('L' + (i + 1), d.id, 'решение', sol && sol.length, 'бот', Math.round(100 * rate(C, i, runs, { budget }, 5)) + '%'); });
}
