/* ПОДКОП · tests/solve.mjs — мини-язык записанных решений и «человеческий» исполнитель с шумом (для tests/bot.mjs и engine.test.mjs).
   Шаги (самокорректирующиеся — исполнитель повторяет, пока цель не достигнута): {go:x} дойти до колонки x; {collect:n,dx} накопать n зёрен, идя вдоль кучи;
   {pour:n,dx,walk?} насыпать n зёрен вперёд (walk — если впереди занято, шаг вперёд); {kill:i,xmax,dx} ждать врага i левее/на xmax и засыпать его сверху, повторять;
   {until:fn,max} ждать; {wait:s}; {dig:'F'|'U'|'D',n}. Шум: jit — случайная пауза перед шагом, react — реакция на врага, slip — шанс сделать лишний шаг при ходьбе. */
export function rng(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function runScript(g, steps, opt = {}) {
  const S = g.state(), h = () => S.hero, R = opt.rand || (() => 0.5), jit = opt.jit || 0, react = opt.react || 0, slip = opt.slip || 0, waste = opt.waste || 0, short = opt.short || 0, DT = 1 / 60;
  let clock = 0;
  const alive = () => S.mode === 'play';
  const adv = (sec, inp) => { g.setInput(inp || {}); const n = Math.max(1, Math.round(sec / DT)); for (let i = 0; i < n; i++) { g.step(DT); clock += DT; if (!alive()) break; } g.setInput({}); return alive(); };
  for (const st of steps) {
    if (!alive()) break;
    if (jit) adv(R() * jit, {});
    if (waste && st.pour && R() < waste) adv(0.1, { dx: st.dx || 1, pour: true });   // лишнее зерно не туда
    if (st.go != null) { let t = 0; while (h().x !== st.go && t < 8 && alive()) { adv(0.03, { dx: st.go > h().x ? 1 : -1 }); t += 0.03; } if (alive() && slip && R() < slip) adv(0.05, { dx: st.go > h().x ? -1 : 1 }); adv(0.12, {}); }
    else if (st.collect) { let c = 0; const need = st.collect - ((short && R() < short) ? 1 : 0); while (h().bag < need && c++ < 80 && alive()) { const b = h().bag; adv(0.2, { dx: st.dx || 1, dig: true }); adv(0.05, {}); if (h().bag === b) { if (st.stopx != null && h().x === st.stopx) adv(0.3, {}); else { adv(0.04, { dx: st.dx || 1 }); adv(0.12, {}); } } } }
    else if (st.pour) { const b0 = h().bag; let c = 0; while (b0 - h().bag < st.pour && h().bag > 0 && c++ < st.pour * 4 + 6 && alive()) { const b = h().bag; adv(0.1, { dx: st.dx || 1, pour: true }); adv(0.06, {}); if (h().bag === b && st.walk) { adv(0.04, { dx: st.dx || 1 }); adv(0.12, {}); } } }
    else if (st.kill != null) {
      for (let cyc = 0; cyc < 6 && alive(); cyc++) {
        const e = S.enemies[st.kill]; if (!e.alive) break;
        let t = 0; while (e.alive && !(e.x <= st.xmax) && t < 20 && alive()) { adv(0.02, {}); t += 0.02; }
        if (react) adv(react * (0.6 + R() * 0.8), {});
        if (alive() && e.alive) { adv(0.1, { dx: st.dx || 1, pour: true }); adv(0.7, {}); }
      }
    }
    else if (st.dig) { for (let k = 0; k < (st.n || 1) && alive(); k++) { adv(0.2, { dx: st.dx || 0, dy: st.dig === 'U' ? -1 : st.dig === 'D' ? 1 : 0, dig: true }); adv(0.05, {}); } }
    else if (st.wait != null) adv(st.wait, {});
    else if (st.until) { let t = 0; while (!st.until(S) && t < (st.max || 10) && alive()) { adv(0.02, {}); t += 0.02; } }
  }
  if (alive()) adv(0.4, {});
  return { mode: S.mode, time: S.t, clock };
}
// записанные решения уровней
export const SOLUTIONS = [
  /* 0 Первая горка */ [{ go: 3 }, { collect: 2 }, { go: 10 }, { pour: 1 }, { go: 16 }],
  /* 1 Шипы */ [{ go: 3 }, { collect: 6 }, { go: 9 }, { pour: 4 }, { go: 18 }],
  /* 2 Крутой склон */ [{ go: 3 }, { collect: 4 }, { go: 9 }, { pour: 1 }, { go: 10 }, { pour: 2 }, { go: 17 }],
  /* 3 Бухта */ [{ go: 3 }, { collect: 4 }, { go: 8 }, { kill: 0, xmax: 9 }, { go: 20 }],
  /* 4 Пескопад */ [{ wait: 12 }, { go: 7 }, { collect: 12, dx: -1, stopx: 6 }, { go: 11 }, { pour: 9, walk: true }, { wait: 1.5 }, { go: 16 }, { pour: 1 }, { go: 20 }],
  /* 5 Охотник */ [{ go: 2 }, { collect: 7 }, { go: 8 }, { kill: 0, xmax: 9 }, { go: 11 }, { pour: 8, walk: true }, { go: 20 }],
  /* 6 Большая дюна */ [{ go: 4 }, { wait: 6 }, { collect: 12, dx: -1, stopx: 4 }, { go: 8 }, { kill: 0, xmax: 9 }, { go: 13 }, { pour: 6, walk: true }, { wait: 1 }, { go: 15 }, { pour: 2 }, { wait: 0.3 }, { go: 16 }, { pour: 2 }, { wait: 0.3 }, { go: 17 }, { go: 20 }]
];
