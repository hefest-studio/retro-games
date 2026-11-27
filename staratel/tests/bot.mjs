/* СТАРАТЕЛЬ · бот-«человек» для проверки баланса головоломки. Он не знает решения: видит последствия на `depth` ходов вперёд (перебор), а если выигрыша
   в этом горизонте нет — берёт действие, после которого вагонетки ближе к подъёмникам (манхэттен) и не повторяет уже виденное состояние; 5 % ходов — наугад.
   Сдаётся, когда ходов больше par + extra. Идеал — решатель (STARATEL.solve) — проходит каждую шахту ровно за par. */
export function rng(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const key = (s) => s.gates + ',' + s.dug + ',' + s.carts.slice().sort((a, b) => a - b).join('.');
function dist(L, st) { let d = 0; const lifts = []; for (let i = 0; i < L.N; i++) if (L.lift[i]) lifts.push(i);
  for (const c of st.carts) { let b = 99; for (const l of lifts) b = Math.min(b, Math.abs(l % L.W - c % L.W) + Math.abs(Math.floor(l / L.W) - Math.floor(c / L.W))); d += b; } return d; }
function lookahead(SW, L, st0, depth) {   // первый ход выигрышной цепочки не длиннее depth (или -1)
  let frontier = [{ st: st0, first: -1 }]; const seen = new Set([key(st0)]);
  for (let d = 0; d < depth; d++) { const next = [];
    for (const n of frontier) for (const a of SW.actions(L, n.st)) { const r = SW.apply(L, n.st, a); if (!r) continue; const k = key(r.st); if (seen.has(k)) continue; seen.add(k);
      const first = n.first < 0 ? a : n.first; if (SW.won(L, r.st)) return first; next.push({ st: r.st, first }); }
    frontier = next; }
  return -1;
}
export function play(SW, def, { seed = 1, depth = 4, extra = 4, slip = 0.05 } = {}) {
  const r = rng(seed), g = SW.Game({ level: def, par: def.par }), seen = new Set(); let moves = 0;
  while (!g.state().cleared && moves < def.par + extra) {
    const S = g.state(), cur = { gates: S.gates, dug: S.dug, carts: S.carts }; seen.add(key(cur)); const acts = SW.actions(g.L, cur); let cell = -1;
    if (r() >= slip) cell = lookahead(SW, g.L, cur, depth);
    if (cell < 0) { let best = 1e9, pool = [];
      for (const a of acts) { const rs = SW.apply(g.L, cur, a); if (!rs) continue; const sc = dist(g.L, rs.st) + (seen.has(key(rs.st)) ? 6 : 0) + r() * 2.5; if (sc < best) { best = sc; pool = [a]; } }
      cell = r() < slip ? acts[Math.floor(r() * acts.length)] : pool[0]; }
    g.act(cell); moves++;
  }
  return { win: g.state().cleared, moves, stars: g.state().stars };
}
