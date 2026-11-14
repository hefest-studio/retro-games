/* СБОРКА · tests/bot.mjs — бот-полководец для проверки баланса и проходимости карт.
   Играет за мастерскую «Гефест» только командами игрока: build (конструктор), order (приказы), setShip (дирижабль).
   «Человеческие» ограничения:
   - решения раз в 150–250 мс игрового времени (реакция), между решениями ничего не делает;
   - угрозу базе замечает с вероятностью opts.notice (0.7) за решение;
   - собирает по плану из типовых сборок; ждёт ресурсы, если не хватает; не управляет роботами поштучно (кроме натиска).
   opts: { react:[0.15,0.25], maxT=1500, notice=0.7, plan } → { won, lost, time, built, lostN, caps, stuckFrac } */

export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

const PLAN = ['scout', 'scout', 'tank', 'tank', 'scout', 'tank', 'sapper', 'tank', 'raider', 'tank', 'artillery', 'tank'];

export function playMap(SB, spec, seed, opts = {}){
  const L = SB.logic, brng = mulberry32(seed * 7919 + 13);
  const [r0, r1] = opts.react || [0.15, 0.25], maxT = opts.maxT || 1500, notice = opts.notice != null ? opts.notice : 0.7;
  const plan = opts.plan || PLAN;
  const game = SB.Game({ spec, seed: seed * 101 + spec.seed }), S = game.state(), dt = 1 / 30;
  let next = 0, pi = 0, waitT = 0, stuck = 0, robotT = 0, lastPush = -99; const last = new Map();
  const D = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  function decide(){
    const base = game.baseOf(0); if (!base) return;
    const my = S.robots.filter(r => r.side === 0), en = S.robots.filter(r => r.side === 1);
    // сборка по плану; если долго не хватает — дешёвый разведчик
    let name = plan[pi % plan.length];
    if (!L.canAfford(S.res[0], L.costOf(L.TPL[name]))) { waitT += r0; if (waitT > 25) name = 'scout'; }
    if (L.canAfford(S.res[0], L.costOf(L.TPL[name]))) {
      const b = game.build(0, L.TPL[name], base.id, L.TPL_ORDER[name]);
      if (b.ok){ pi++; waitT = 0; }
    }
    // защита базы
    if (en.some(e => D(e, base) < 220) && brng() < notice){
      const ids = my.filter(r => D(r, base) < 420 && r.order.kind !== 'robots').map(r => r.id);
      if (ids.length) game.order(ids, 'robots');
    }
    // натиск: собралось 5+ бойцов — все на захват (в т.ч. базы Артели)
    const fighters = my.filter(r => r.order.kind === 'robots');
    if (fighters.length >= 5 && S.time - lastPush > 20){ lastPush = S.time; game.order(fighters.map(r => r.id), 'capture'); }
    // дирижабль — над центром своих роботов
    if (my.length){ const cx = my.reduce((a, r) => a + r.x, 0) / my.length, cy = my.reduce((a, r) => a + r.y, 0) / my.length; game.setShip(cx, cy); }
  }
  while (S.phase === 'play' && S.time < maxT){
    if (S.time >= next){ decide(); next = S.time + r0 + brng() * (r1 - r0); }
    game.update(dt);
    for (const r of S.robots) { robotT += dt; const p = last.get(r.id); if (p && r.path && Math.hypot(r.x - p.x, r.y - p.y) < 0.05) stuck += dt; last.set(r.id, { x: r.x, y: r.y }); }
  }
  return { seed, won: S.phase === 'won', lost: S.phase === 'lost', time: S.time, built: S.stats.built.slice(), lostN: S.stats.lost.slice(), caps: S.stats.caps.slice(), how: S.result && S.result.how, stuckFrac: robotT ? stuck / robotT : 0 };
}
