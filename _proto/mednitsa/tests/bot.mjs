/* МЕДНИЦА · бот-игрок и симулятор баланса (Node, без зависимостей).
   loadEcon(flags) — config.js + econ.js в node:vm; simulate(opts) — «живой» игрок: стучит по котлу, забирает заказы и посылки,
   покупает самое выгодное (окупаемость + ожидание), делает переплавку; сессии и офлайн по расписанию. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function loadEcon(flags) {
  const sb = { console, Math, JSON }; sb.window = sb; sb.globalThis = sb; vm.createContext(sb);
  for (const f of ['js/config.js', 'js/econ.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sb, { filename: f });
  const M = sb.MEDNITSA; const cfg = flags ? M.econ.applyFlags(M.CFG, (k) => flags[k]) : M.CFG;
  return { M, E: M.econ.Econ(cfg), cfg };
}

// Лучшая покупка: минимум (ожидание до цены + окупаемость). tapsPerSec — ценность улучшений удара.
export function bestBuy(E, s, tps) {
  const inc0 = E.income(s), tap0 = E.tapValue(s), val0 = inc0 + tap0 * tps; let best = null;
  const consider = (kind, id, cost, apply, undo) => {
    apply(); const v = E.income(s) + E.tapValue(s) * tps; undo();
    const d = v - val0; if (d <= 0) return;
    const wait = Math.max(0, (cost - s.copper) / Math.max(val0, 1e-9)), score = wait + cost / d;
    if (!best || score < best.score) best = { kind, id, cost, score, wait };
  };
  for (let i = 0; i < E.N; i++) {
    if (!E.unlocked(s, i)) continue;
    consider('ws', i, E.cost(i, s.lv[i], 1), () => { s.lv[i]++; }, () => { s.lv[i]--; });
  }
  for (const u of E.upsVisible(s)) consider('up', u.id, E.upCost(u), () => { s.ups[u.id] = 1; }, () => { delete s.ups[u.id]; });
  return best;
}

// «Стена»: даже самая дешёвая покупка (уровень любого открытого цеха или чертёж) дальше, чем wallSec секунд дохода
export function cheapestWait(E, s) {
  let c = Infinity; for (let i = 0; i < E.N; i++) if (E.unlocked(s, i)) c = Math.min(c, E.cost(i, s.lv[i], 1));
  for (const u of E.upsVisible(s)) c = Math.min(c, E.upCost(u));
  return Math.max(0, (c - s.copper) / Math.max(E.income(s) + E.tapValue(s) * 3, 1e-9));
}

export function simulate(opts = {}) {
  const { E, cfg } = loadEcon(opts.flags);
  const tps = opts.tps ?? 3, s = E.newState(), log = { buys: [], unlock: {}, prestige: [], perMin: [], gaps: [], walls: [] };
  let now = opts.start ?? 1767225600000, t = 0, lastAct = 0, active = 0;
  // расписание: [{ on: секунд игры }, { off: секунд }...]
  const plan = opts.plan || [{ on: 40 * 60 }];
  E.touch(s, now);
  const act = () => { log.gaps.push(t - lastAct); lastAct = t; };
  for (const step of plan) {
    if (step.off) {
      now += step.off * 1000; t += step.off; lastAct = t;
      const r = E.offline(s, now); const g = E.applyOffline(s, r, opts.offlineMult || 1); log.offline = (log.offline || []).concat([{ at: t, sec: r.sec, gain: g }]);
      continue;
    }
    const end = active + step.on;
    while (active < end) {
      for (let k = 0; k < tps; k++) E.tap(s);
      const ev = E.advance(s, 1); t++; active++; now += 1000; E.touch(s, now);
      if (s.chestLive > 0 && s.chestLive < cfg.chest.life - 3) { E.openChest(s, false); }
      for (const a of E.activeGoals(s, 3)) if (a.done) { E.claimGoal(s, a.goal.id); act(); }
      const d = E.daily(s, now); if (d.ready && opts.daily !== false) E.claimDaily(s, now);
      if (opts.prestige !== false && E.canPrestige(s)) { const g = E.prestigeGain(s); if (g >= Math.max(cfg.prestige.minGain, s.marks)) { E.prestige(s); log.prestige.push({ at: t, active, gain: g, marks: s.marks }); act(); } }
      for (let guard = 0; guard < 200; guard++) {
        const b = bestBuy(E, s, tps); if (!b || b.cost > s.copper) break;
        if (b.kind === 'ws') { const r = E.buy(s, b.id, 1); if (!r) break; if (r.first && log.unlock[b.id] == null) log.unlock[b.id] = active; }
        else if (!E.buyUp(s, b.id)) break;
        log.buys.push({ at: t, active, kind: b.kind, id: b.id }); act();
      }
      if (active <= (opts.wallWindow ?? 1800)) { const w = cheapestWait(E, s); if (w > (opts.wallSec ?? 60)) log.walls.push({ active, wait: Math.round(w) }); }
      if (active % 60 === 0) log.perMin.push({ min: active / 60, income: E.income(s), tap: E.tapValue(s), copper: s.copper, lv: s.lv.slice(), marks: s.marks, ups: E.upCount(s), life: s.lifeEarned });
    }
  }
  return { s, log, E, cfg };
}
