/* ЗВЕРО-ОТРЯД · tests/bot.mjs — «человеческий» бот: играет в соло (один стик, прыжок, смена зверя), как игрок на телефоне.
   Без читов: только setInput / jump / swap. Решение по уровню — сценарий-генератор (шаги: go / jump / reel / wait / until); между шагами —
   «реакция» 0.12–0.38 с, допуск по позиции ±(3…9) px, с вероятностью miss шаг начинается с запозданием (промах по таймингу).
   Каждый уровень решается по-своему (см. SCRIPTS). playLevel(Z, lv, seed, opts) → { ok, t, deaths, why }. */
export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

export function playLevel(Z, lv, seed, opts = {}) {
  const brng = mulberry32(seed * 7919 + lv * 31 + 7);
  const R = (a, b) => a + brng() * (b - a);
  const react = opts.react || [0.12, 0.38], miss = opts.miss != null ? opts.miss : 0.08, jit = opts.jit != null ? opts.jit : 1;
  const maxT = opts.maxT || 240, DT = 1 / 60;
  const log = { deaths: 0 };
  const g = Z.Game({ rng: mulberry32(seed), noHints: true, players: 1, onEvent: (t) => { if (t === 'die') log.deaths++; } }).start(lv);
  const S = g.state(); S.phase = 'play'; S.introT = 99;
  let tm = 0, done = false;
  const A = (i) => S.an[i];
  const tr = (m) => { if (opts.trace) console.log('t=' + tm.toFixed(1), m, 'P', Math.round(S.an[0].x), Math.round(S.an[0].y), 'T', Math.round(S.an[1].x), Math.round(S.an[1].y), 'act', S.active, 'len', Math.round(S.len)); };
  const set = (x, up) => g.setInput(0, x, !!up, false);
  const rel = () => g.setInput(0, 0, false, false);
  const tol = () => (3 + brng() * 6) * jit;
  function* wait(sec) { for (let t = 0; t < sec; t += DT) { rel(); yield; } }
  function* think() { yield* wait(R(react[0], react[1])); }
  function* sel(i) { if (S.active !== i) { yield* think(); g.swap(); yield* wait(0.06); } }
  function* go(i, x, o = {}) {
    yield* sel(i); const a = A(i), tl = o.tol != null ? o.tol : tol(); let t = 0, lastx = a.x, st = 0;
    while (Math.abs(x - a.x) > tl && t < (o.max || 7)) {
      const dir = Math.sign(x - a.x); set(dir * (o.slow ? 0.5 : 1), false); t += DT; yield;
      if (Math.abs(a.x - lastx) < 0.2) { st += DT; if (st > 0.5 && !o.keep) break; } else st = 0; lastx = a.x;
    }
    rel(); yield* wait(o.settle != null ? o.settle : 0.1); tr('go ' + i + '→' + x);
  }
  // прыжок: dir — куда держим, hold — сколько держим «вверх» (высота), after — сколько ещё держим направление
  function* jump(i, dir, hold = 0.5, after = 0.25, pre = 0.18) {
    yield* sel(i); if (brng() < miss) yield* wait(R(0.05, 0.16));
    for (let t = 0; t < pre; t += DT) { set(dir, false); yield; }
    g.jump(0);
    for (let t = 0; t < hold; t += DT) { set(dir, true); yield; }
    for (let t = 0; t < after; t += DT) { set(dir, false); yield; }
    rel(); tr('jump ' + i);
  }
  function* jumpAt(i, x, dir, hold = 0.5, after = 0.3, pre = 0.15) {
    yield* go(i, x - dir * (pre * A(i).run + 3), { tol: 3 }); yield* jump(i, dir, hold, after, pre);
  }
  function* land(i, max = 2) { const a = A(i); let t = 0; while (!a.on && t < max) { set(0, false); t += DT; yield; } yield* wait(0.15); }
  function* reel(i, dir, cond, max = 6, up = true) {
    yield* sel(i); let t = 0; while (!cond() && t < max) { set(dir, up); t += DT; yield; } rel(); yield* wait(0.1);
  }
  function* until(cond, max = 10) { let t = 0; while (!cond() && t < max) { rel(); t += DT; yield; } }
  // жук: Тяпа бьёт сверху — ждём сближения и прыгаем навстречу
  function* stomp(i, range = 260, max = 9) {
    yield* sel(i); const a = A(i); let t = 0;
    while (t < max) {
      const en = S.enemies.filter((e) => e.alive && Math.abs(e.x - a.x) < Math.min(range, 130) && Math.abs(e.y - a.y) < 40).sort((p, q) => Math.abs(p.x - a.x) - Math.abs(q.x - a.x))[0];
      if (!en) break;
      const dx = en.x - a.x;
      if (Math.abs(dx) <= 52 && a.on) { yield* jump(i, Math.sign(dx), 0.25, 0.15, 0.02); yield* land(i, 1); }
      else { set(Math.abs(dx) > 120 ? Math.sign(dx) * 0.6 : 0, false); t += DT; yield; }
    }
    rel(); yield* wait(0.1);
  }
  const c = { g, S, A, set, rel, wait, think, sel, go, jump, jumpAt, land, reel, stomp, until, R, brng, DT, tr };
  const gen = (SCRIPTS[lv] || function* () {})(c);
  while (tm < maxT) {
    const r = gen.next(); tm += DT; g.update(DT);
    if (S.phase === 'clear' || S.phase === 'won') { done = true; break; }
    if (S.phase === 'over') break;
    if (r.done) { if (tm > 5) { /* сценарий кончился, а дверь не взята — ждём */ rel(); } }
  }
  return { ok: done, t: tm, deaths: log.deaths, stars: S.got, lives: S.lives, score: S.score, why: done ? '' : (S.phase === 'over' ? 'жизни' : 'время') };
}

// ----- Сценарии -----
const SCRIPTS = {
  0: function* (c) {   // 1. Первая связка
    const { go, jump, land } = c;
    yield* go(1, 216); yield* go(0, 240); yield* jump(0, 1, 0.5, 0.3); yield* land(0);
    yield* go(1, 262); yield* jump(1, 1, 0.45, 0.3); yield* land(1);
    yield* go(0, 420); yield* go(1, 425); yield* go(0, 436); yield* jump(0, 1, 0.5, 0.35); yield* land(0);
    yield* go(1, 436); yield* jump(1, 1, 0.5, 0.3); yield* land(1);
    yield* go(0, 600); yield* go(1, 600); yield* go(0, 640);
    yield* jump(0, 1, 0.5, 0.5); yield* land(0); yield* go(1, 640); yield* jump(1, 1, 0.55, 0.5); yield* land(1);
    yield* go(0, 780); yield* go(1, 850); yield* go(0, 872, { tol: 10 }); yield* go(1, 876, { tol: 10 });
    yield* c.until(() => c.S.phase !== 'play', 4);
  },
  1: function* (c) {   // 2. Через пропасть (край: x=352 слева, x=448 справа)
    const { go, jump, land, reel, S, A } = c;
    yield* go(1, 215); yield* go(0, 300); yield* go(1, 322, { tol: 4 }); yield* c.wait(0.1);
    yield* jump(1, 1, 0.55, 0.45); yield* land(1, 3);
    yield* go(1, 470); yield* go(0, 335);
    // Пыж идёт к краю и падает — канат ловит; ↑ + вправо — вытащить себя на край
    yield* go(0, 360, { tol: 4, keep: true }); yield* reel(0, 1, () => A(0).on && A(0).x > 450, 7);
    yield* go(1, 560); yield* go(0, 600); yield* go(1, 700); yield* go(0, 750); yield* go(1, 840); yield* go(0, 848, { tol: 14 }); yield* go(1, 850, { tol: 14 });
    yield* c.until(() => S.phase !== 'play', 4);
  }
  ,
  2: function* (c) {   // 3. Нажми и проходи: Пыж на плите, Тяпа — в яму за защёлкой
    const { go, jump, land, S, A } = c;
    yield* go(0, 272, { tol: 6 }); yield* c.wait(0.2);
    yield* go(1, 330, { tol: 6 }); yield* go(1, 400, { tol: 6, keep: true, max: 4 });
    yield* c.until(() => S.latched.d, 3);
    yield* go(1, 372, { tol: 6 }); yield* jump(1, -1, 0.55, 0.3, 0.1); yield* land(1);
    yield* go(1, 300, { tol: 10 });
    yield* go(0, 330, { tol: 6 }); yield* go(0, 420, { tol: 6 }); yield* go(1, 420, { tol: 6 }); yield* go(0, 540, { tol: 6 });
    yield* go(1, 560, { tol: 6 }); yield* go(0, 690, { tol: 6 }); yield* go(1, 800); yield* go(0, 840, { tol: 10 }); yield* go(1, 856, { tol: 10 });
    yield* c.until(() => S.phase !== 'play', 4);
  },
  3: function* (c) {   // 4. Качели
    const { go, jump, land, reel, S, A } = c;
    yield* go(1, 98, { tol: 4 }); yield* jump(1, 1, 0.65, 0.55, 0.12); yield* land(1);
    yield* jump(1, 1, 0.5, 0.3, 0.1); yield* land(1);
    yield* go(0, 312, { tol: 4 }); yield* go(1, 440, { tol: 5 }); yield* go(1, 464, { tol: 4, slow: true });
    yield* go(0, 312, { tol: 5 });
    // Пыж идёт с края и качается: держим вправо, у края — ↑
    yield* reel(0, 1, () => A(0).on && A(0).x > 570, 8, false);
    yield* go(1, 470, { tol: 4 }); yield* jump(1, 1, 0.5, 0.8, 0.1); yield* land(1, 4);
    yield* go(0, 720); yield* go(1, 760); yield* go(0, 840, { tol: 8 }); yield* go(1, 850, { tol: 8 });
    yield* c.until(() => S.phase !== 'play', 4);
  }
  ,
  4: function* (c) {   // 5. Жуки: две пропасти (края: 288/384 и 576/672), на острове блок в 1 клетку (448…480)
    const { go, jump, jumpAt, land, reel, stomp, S, A } = c;
    yield* go(1, 200); yield* go(0, 272, { tol: 3 });
    yield* jumpAt(1, 286, 1, 0.55, 0.45); yield* land(1, 3);
    yield* stomp(1); yield* go(1, 410, { tol: 6 });
    yield* go(0, 280, { tol: 4 }); yield* go(0, 300, { tol: 4, keep: true, max: 2 }); yield* reel(0, 1, () => A(0).on && A(0).x > 392, 7);
    yield* go(0, 420, { tol: 6 }); yield* jumpAt(0, 446, 1, 0.5, 0.3); yield* land(0); yield* go(0, 515, { tol: 8 });
    yield* go(1, 420, { tol: 6 }); yield* jumpAt(1, 446, 1, 0.5, 0.3); yield* land(1); yield* go(1, 520, { tol: 8 });
    yield* go(0, 556, { tol: 6 }); yield* stomp(1, 130, 5);
    yield* jumpAt(1, 574, 1, 0.55, 0.45); yield* land(1, 3); yield* go(1, 690, { tol: 5 });
    yield* go(0, 570, { tol: 4 }); yield* go(0, 595, { tol: 4, keep: true, max: 2 }); yield* reel(0, 1, () => A(0).on && A(0).x > 675, 7);
    yield* stomp(0, 200, 4); yield* stomp(1, 200, 6);
    yield* go(1, 790); yield* go(0, 850); yield* go(1, 870, { tol: 10 }); yield* go(0, 876, { tol: 10 });
    yield* c.until(() => S.phase !== 'play', 4);
  },
  5: function* (c) {   // 6. Башня (подъёмы по 3 клетки: x=256, 480, 704; блоки-перегородки 352…384 и 576…608)
    const { go, jump, jumpAt, land, reel, stomp, S, A } = c;
    yield* go(1, 200); yield* go(0, 238, { tol: 5 });
    yield* go(1, 238, { tol: 4 }); yield* jump(1, 1, 0.7, 0.4, 0.1); yield* land(1);
    yield* go(0, 238, { tol: 4 }); yield* reel(0, 1, () => A(0).on && A(0).y < 330, 7);
    yield* jumpAt(0, 350, 1, 0.5, 0.3); yield* land(0); yield* go(0, 462, { tol: 6, max: 8 }); yield* stomp(0, 130, 3);
    yield* go(1, 345, { tol: 5 }); yield* jumpAt(1, 350, 1, 0.5, 0.3); yield* land(1); yield* go(1, 455, { tol: 6 });
    yield* go(1, 462, { tol: 4 }); yield* jump(1, 1, 0.7, 0.4, 0.1); yield* land(1);
    yield* go(0, 462, { tol: 4 }); yield* reel(0, 1, () => A(0).on && A(0).y < 235, 7);
    yield* jumpAt(0, 574, 1, 0.5, 0.3); yield* land(0); yield* go(0, 690, { tol: 8, max: 8 }); yield* stomp(0, 130, 3);
    yield* go(1, 570, { tol: 5 }); yield* jumpAt(1, 574, 1, 0.5, 0.3); yield* land(1); yield* go(1, 690, { tol: 6 });
    yield* go(1, 694, { tol: 4 }); yield* jump(1, 1, 0.7, 0.4, 0.1); yield* land(1);
    yield* go(0, 692, { tol: 4 }); yield* reel(0, 1, () => A(0).on && A(0).y < 140, 7);
    yield* go(1, 850); yield* go(0, 870, { tol: 10 }); yield* go(1, 878, { tol: 10 });
    yield* c.until(() => S.phase !== 'play', 4);
  },
  6: function* (c) {   // 7. Большие качели + плита и люк
    const { go, jump, land, reel, S, A } = c;
    yield* go(0, 300, { tol: 6 }); yield* c.wait(0.2);
    yield* go(1, 98, { tol: 4 }); yield* jump(1, 1, 0.65, 0.55, 0.12); yield* land(1);
    yield* jump(1, 1, 0.5, 0.3, 0.1); yield* land(1);
    yield* go(0, 312, { tol: 4 }); yield* go(1, 440, { tol: 5 }); yield* go(1, 464, { tol: 4, slow: true });
    yield* go(0, 312, { tol: 5 });
    yield* reel(0, 1, () => A(0).on && A(0).x > 570, 8, false);
    yield* go(1, 470, { tol: 4 }); yield* jump(1, 1, 0.5, 0.8, 0.1); yield* land(1, 4);
    yield* go(1, 640); yield* go(0, 688, { tol: 5 }); yield* c.wait(0.2);
    yield* go(1, 745, { tol: 6 }); yield* go(1, 784, { tol: 6, keep: true, max: 4 });
    yield* c.until(() => S.latched.d, 3);
    yield* go(1, 760, { tol: 6 }); yield* jump(1, -1, 0.55, 0.3, 0.1); yield* land(1);
    yield* go(1, 655, { tol: 10 });
    yield* go(0, 730, { tol: 6 }); yield* go(0, 790, { tol: 6 }); yield* go(1, 800, { tol: 6 }); yield* go(0, 870, { tol: 6 });
    yield* go(1, 905, { tol: 8 }); yield* go(0, 912, { tol: 8 });
    yield* c.until(() => S.phase !== 'play', 4);
  }
  ,
  7: function* (c) {   // 8. Колотун: канат поперёк арены, уворачиваемся от шестерёнок
    const { go, jump, jumpAt, land, sel, think, wait, S, A, set, rel, DT } = c;
    yield* go(1, 800, { tol: 2, keep: true, max: 3 }); yield* sel(0);
    let guard = 0;
    while (S.boss && S.boss.state !== 'dead' && S.phase === 'play' && guard < 6000) {
      guard++;
      const m = S.marks.find((mk) => mk.t < 0.95 && S.an.some((a) => a.dead <= 0 && Math.abs(a.x - mk.x) < 36));
      if (m) {
        const a = S.an.find((q) => q.dead <= 0 && Math.abs(q.x - m.x) < 36), dir = a.i === 0 ? 1 : -1;
        yield* think(); yield* sel(a.i);
        let t = 0; while (Math.abs(a.x - m.x) < 42 && t < 1.2) { set(dir, false); t += DT; yield; }
        rel();
        let t2 = 0; while (S.marks.length && t2 < 1.4) { rel(); t2 += DT; yield; }
        // снова натянуть канат: тянем в сторону от партнёра, пока не упрёмся
        let t3 = 0; while (!S.rope.taut && t3 < 2.5) { set(-dir, false); t3 += DT; yield; }
        rel(); yield* sel(0);
      } else if (!S.rope.taut) {
        yield* sel(0); let t3 = 0; while (!S.rope.taut && t3 < 2.5) { set(-1, false); t3 += DT; yield; } rel();
      } else { rel(); yield; }
    }
    yield* wait(1.2);
    yield* go(1, 880, { tol: 8 });
    yield* go(0, 690, { tol: 8, keep: true, max: 9 }); yield* jumpAt(0, 702, 1, 0.6, 0.4); yield* land(0);
    yield* go(0, 880, { tol: 10 }); yield* go(1, 876, { tol: 10 });
    yield* c.until(() => S.phase !== 'play', 5);
  }
};
export { SCRIPTS };
