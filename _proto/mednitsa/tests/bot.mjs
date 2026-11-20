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
  const L = loadEcon(opts.flags); if (opts.patch) opts.patch(L.cfg);   // patch(cfg) — правка баланса для подбора (тест/перебор)
  const E = opts.patch ? L.M.econ.Econ(L.cfg) : L.E, cfg = E.cfg;
  const tps = opts.tps ?? 3, s = opts.state || E.newState(), log = { buys: [], unlock: {}, prestige: [], perMin: [], gaps: [], walls: [], goals: [], events: [], acts: [] };
  let now = opts.start ?? 1767225600000, t = 0, lastAct = 0, active = 0;
  // расписание: [{ on: секунд игры }, { off: секунд }...]
  const plan = opts.plan || [{ on: 40 * 60 }];
  E.touch(s, now);
  const act = (kind) => { log.gaps.push(t - lastAct); lastAct = t; if (kind) log.acts.push({ at: t, active, kind }); };
  for (const step of plan) {
    if (step.off) {
      now += step.off * 1000; t += step.off; lastAct = t; E.eventSync(s, now);
      const r = E.offline(s, now); const g = E.applyOffline(s, r, opts.offlineMult || 1); log.offline = (log.offline || []).concat([{ at: t, sec: r.sec, gain: g }]);
      continue;
    }
    const end = active + step.on;
    while (active < end) {
      E.eventSync(s, now);
      for (let k = 0; k < tps; k++) E.tap(s);
      const ev = E.advance(s, 1); t++; active++; now += 1000; E.touch(s, now);
      if (E.eventReady(s)) { const g = E.claimEvent(s); log.events.push({ at: t, active, marks: g }); act('event'); }
      if (s.chestLive > 0 && s.chestLive < cfg.chest.life - 3) { E.openChest(s, false); }
      for (const wk of [0, 1]) for (const a of E.activeGoals(s, 3, wk)) if (a.done) { E.claimGoal(s, a.goal.id); log.goals.push({ at: t, active, id: a.goal.id }); act('goal'); }
      const d = E.daily(s, now); if (d.ready && opts.daily !== false) E.claimDaily(s, now);
      if (opts.prestige !== false && E.canPrestige(s)) { const g = E.prestigeGain(s); if (g >= Math.max(cfg.prestige.minGain, s.marks)) { E.prestige(s); log.prestige.push({ at: t, active, gain: g, marks: s.marks, n: s.prestiges }); act('prestige'); } }
      for (let guard = 0; guard < 200; guard++) {
        const b = bestBuy(E, s, tps); if (!b || b.cost > s.copper) break;
        let first = false;
        if (b.kind === 'ws') { const r = E.buy(s, b.id, 1); if (!r) break; if (r.first && log.unlock[b.id] == null) { log.unlock[b.id] = active; log.unlockAt = Object.assign(log.unlockAt || {}, { [b.id]: t }); first = true; } }
        else { if (!E.buyUp(s, b.id)) break; first = !(log.upSeen || (log.upSeen = {}))[b.id]; log.upSeen[b.id] = 1; }
        log.buys.push({ at: t, active, kind: b.kind, id: b.id }); act(first ? (b.kind === 'ws' ? 'newshop' : 'newup') : null);
      }
      if (active <= (opts.wallWindow ?? 1800)) { const w = cheapestWait(E, s); if (w > (opts.wallSec ?? 60)) log.walls.push({ active, wait: Math.round(w) }); }
      if (active % 60 === 0) log.perMin.push({ min: active / 60, at: t, income: E.income(s), tap: E.tapValue(s), copper: s.copper, lv: s.lv.slice(), marks: s.marks, ups: E.upCount(s), life: s.lifeEarned, prestiges: s.prestiges });
    }
  }
  return { s, log, E, cfg };
}

// расписание «долгой игры»: день 1 — 40 мин, потом 4 ч офлайн; дальше каждый день 3 сессии по 10 мин (офлайн 5 ч, 5 ч, ночь)
export function longPlan(days) {
  const plan = [{ on: 40 * 60 }, { off: 4 * 3600 }];
  for (let d = 0; d < days; d++) plan.push({ on: 600 }, { off: 5 * 3600 }, { on: 600 }, { off: 5 * 3600 }, { on: 600 }, { off: 14 * 3600 - 1800 });
  return plan;
}
// отчёт по дням (день = 24 ч от начала): переплавки, клейма, доход, открытые цеха, новые цели и самый долгий отрезок без них
export function dayReport(r, days) {
  const { log } = r, out = [], D = 86400;
  const news = log.acts.filter((a) => a.kind);
  for (let d = 0; d < days; d++) {
    const lo = d * D, hi = lo + D, inDay = (x) => x.at >= lo && x.at < hi;
    const last = log.perMin.filter(inDay).pop() || out[out.length - 1] || { lv: r.s.lv, marks: 0, income: 0, prestiges: 0 };
    const n = news.filter(inDay), mins = log.perMin.filter(inDay);
    // самый долгий отрезок активной игры (мин) между новыми целями внутри дня
    let gap = 0, prev = null; const marks = [mins.length ? mins[0].min - 1 : 0].concat(n.map((x) => x.active / 60), mins.length ? [mins[mins.length - 1].min] : []).sort((a, b) => a - b);
    for (const m of marks) { if (prev != null) gap = Math.max(gap, m - prev); prev = m; }
    const cnt = (k) => n.filter((x) => x.kind === k).length;
    out.push({ day: d + 1, prestiges: last.prestiges, marks: last.marks, income: last.income, lv: last.lv,
      forge: mins.reduce((m, p) => Math.max(m, p.lv.slice(0, 10).filter((v) => v > 0).length), 0),
      wharf: mins.reduce((m, p) => Math.max(m, p.lv.slice(10).filter((v) => v > 0).length), 0),
      goals: cnt('goal'), shops: cnt('newshop'), ups: cnt('newup'), pr: cnt('prestige'), ev: cnt('event'), news: n.length, gapMin: gap });
  }
  return out;
}
