/* ОБВАЛ · бот-«человек» для проверки баланса головоломки. Он не знает решения: видит последствия на `depth` ходов вперёд (перебор), а если выигрыша
   в этом горизонте нет — берёт действие, после которого шахтёры ближе к выходам (манхэттен), очаги засыпаны, и не повторяет уже виденное состояние;
   5 % ходов — наугад. Сдаётся, когда ходов больше par + extra. Идеал — решатель (OBVAL.solve) — проходит каждую шахту ровно за par. */
export function rng(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function dist(L, st) {
  let d = 0; for (let k = 0; k < st.mp.length; k++) { if (st.ms[k] === 1) continue; if (st.ms[k] === 2) { d += 60; continue; } let b = 40; for (const e of L.exits) b = Math.min(b, Math.abs(e % L.W - st.mp[k] % L.W) + Math.abs(Math.floor(e / L.W) - Math.floor(st.mp[k] / L.W))); d += b; }
  for (const h of L.hazList) if (st.blk[h] !== 1) d += 4; return d;
}
function lookahead(OB, L, st0, depth) {   // первый ход выигрышной цепочки не длиннее depth (или -1)
  let frontier = [{ st: st0, first: -1 }]; const seen = new Set([OB.keyOf(st0)]);
  for (let d = 0; d < depth; d++) { const next = [];
    for (const n of frontier) for (const a of OB.actions(L, n.st)) { const r = OB.apply(L, n.st, a); if (!r) continue; const k = OB.keyOf(r.st); if (seen.has(k)) continue; seen.add(k);
      if (OB.lost(r.st)) continue; const first = n.first < 0 ? a : n.first; if (OB.won(L, r.st)) return first; next.push({ st: r.st, first }); }
    frontier = next; }
  return -1;
}
export function play(OB, def, { seed = 1, depth = 4, extra = 4, slip = 0.05 } = {}) {
  const r = rng(seed), g = OB.Game({ level: def, par: def.par }), seen = new Set(); let moves = 0;
  while (!g.state().cleared && moves < def.par + extra) {
    const S = g.state(), cur = { blk: S.blk.slice(), mp: S.mp.slice(), md: S.md.slice(), ms: S.ms.slice(), stock: S.stock }; seen.add(OB.keyOf(cur)); const acts = OB.actions(g.L, cur); let cell = -1;
    if (S.dead) break;
    if (r() >= slip) cell = lookahead(OB, g.L, cur, depth);
    if (cell < 0) { let best = 1e9, pool = [];
      for (const a of acts) { const rs = OB.apply(g.L, cur, a); if (!rs) continue; const sc = dist(g.L, rs.st) + (seen.has(OB.keyOf(rs.st)) ? 6 : 0) + r() * 2.5; if (sc < best) { best = sc; pool = [a]; } }
      cell = r() < slip ? acts[Math.floor(r() * acts.length)] : pool[0]; }
    if (cell == null || cell < 0) break; g.act(cell); moves++;
  }
  return { win: g.state().cleared, moves, stars: g.state().stars };
}
