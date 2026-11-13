/* ЧЕРТОГ · tests/bot.mjs — «человеческий» бот для проверки проходимости и баланса.
   Карту уровня знает (как игрок, прошедший уровень разок): ходит по графу проходимости (logic.Nav) теми же
   макро-действиями (logic.Driver), из которых граф построен, но управляет как человек:
   - реакция: каждое следующее действие — через 150–250 мс после окончания предыдущего;
   - момент толчка/отпускания при беге — с ошибкой (≈ ±0,05 клетки, т. е. ±15 мс);
   - ножницы: видит, когда лезвия разошлись, и трогается с задержкой реакции; если окна не хватает — ждёт следующее;
   - бой: на замах стража ставит защиту через 150–250 мс (иногда «прозевает»), контратакует после отбитого/пропущенного
     удара, сам атакует с паузами; сближается, если далеко;
   - двойник в финале: уводит его на шипы, пробегая мимо своих ножниц.
   opts: { react:[0.15,0.25], miss=0.12, god=false, level=1, only=false (только один уровень), maxT=1800 (игровых секунд) } */

export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

const NAVS = new Map();
export function navFor(L, idx, fallen){
  const key = idx + ':' + (fallen ? 'all' : '-');
  if (!NAVS.has(key)) NAVS.set(key, L.Nav(idx, { fallen: fallen ? 'all' : undefined }));
  return NAVS.get(key);
}
export function navCache(){ return NAVS; }
const FENCE = { en: 1, lunge: 1, parry: 1, adv: 1, ret: 1, recoil: 1, hit: 1 };
const BLANK = () => ({ x: 0, up: false, down: false, shift: false, atk: false });

// путь по графу: Дейкстра от узла до цели (узлы клетки goal), рёбра с рухнувшими плитами пропускаем
export function route(nav, from, isGoal, M, ban){
  const dist = new Map([[from, 0]]), prev = new Map(), heap = [[0, from]];
  const dead = e => e.loose && e.loose.some(k => M.t[k] === ' ');
  while (heap.length){
    let bi = 0; for (let j = 1; j < heap.length; j++) if (heap[j][0] < heap[bi][0]) bi = j;
    const [d, u] = heap.splice(bi, 1)[0]; if (d > dist.get(u)) continue;
    if (isGoal(u)){ const steps = []; let v = u; while (v !== from){ const p = prev.get(v); steps.unshift(p.x); v = p.u; } return steps; }
    for (const x of nav.adj(u)){
      if (x.e && (dead(x.e) || (ban && ban.has(x.e)))) continue;
      if (x.m && x.m.path.some(dead)) continue;
      const c = x.e ? x.e.t + 0.3 + (x.e.hurt ? 6 : 0) + (x.e.chops.length ? 0.8 : 0) : x.m.t + 0.5;
      const nd = d + c;
      if (nd < (dist.has(x.to) ? dist.get(x.to) : Infinity)){ dist.set(x.to, nd); prev.set(x.to, { u, x }); heap.push([nd, x.to]); }
    }
  }
  return null;
}

export function playChertog(C, seed, opts = {}){
  const L = C.logic, K = L.K, dt = 1 / 60;
  const rng = mulberry32(seed * 7919 + 13);
  const gauss = () => { let u = 0; for (let i = 0; i < 4; i++) u += rng(); return (u - 2) / 0.577; };
  const [r0, r1] = opts.react || [0.15, 0.25], miss = opts.miss == null ? 0.12 : opts.miss;
  const react = () => r0 + rng() * (r1 - r0);
  const startLevel = opts.level || 1, maxT = opts.maxT || 1800;
  let drv = null, queue = [], wait = react(), pend = null, now = 0;
  const fails = new Map(), ban = new Set();   // действие, дважды приведшее не туда, человек больше не повторяет
  const stats = { seed, won: false, cleared: 0, deaths: 0, why: {}, hurt: 0, time: 0, level: startLevel, stuck: false, kills: 0, firstClear: null };
  const game = C.Game({ level: startLevel, rng: mulberry32(seed * 31 + 7), god: !!opts.god, onEvent: (t, d) => {
    if (t === 'die'){ stats.deaths++; stats.why[d.why] = (stats.why[d.why] || 0) + 1; drv = null; queue = []; wait = 0.5; }
    if (t === 'hurt') stats.hurt++;
    if (t === 'kill') stats.kills++;
    if (t === 'clear'){ stats.cleared++; if (stats.firstClear == null) stats.firstClear = S.time; }
    if (t === 'level' || t === 'restart'){ drv = null; queue = []; wait = react(); }
  } }).start();
  const S = game.state();
  let parryAt = -1, atkAt = -1, lastOppSt = null, nextAtk = 0, upHeld = false, atkHeld = false, lastProgress = 0, lastKey = null;
  let twinRun = 0;

  function chopDelay(e, H){
    if (!e.chopT || !Object.keys(e.chopT).length) return 0;
    const lead = H.face !== (e.a.f || H.face) ? K.TURN_T : 0;
    // ждём, пока лезвия разойдутся, затем — реакция; проверяем, что всё время в зоне лезвия открыты
    for (let d = 0; d < 4; d += 1 / 60){
      let ok = true;
      for (const k in e.chopT){
        const q = S.LV.chops.find(c => c.r * S.LV.W + c.c === +k); if (!q) continue;
        const [a, b] = e.chopT[k];
        for (let t = a - 0.12; t <= b + 0.12; t += 0.03){ const ph = (S.clock + d + lead + t + q.off) % K.CHOP_P; if (ph < K.CHOP_C + 0.02) { ok = false; break; } }
        if (!ok) break;
      }
      if (ok) return d;
    }
    return 0;
  }
  function startEdge(e, H){
    const d = chopDelay(e, H);
    if (d > 0.02){ pend = e; wait = d; return; }
    drv = L.Driver(e.a, { jit: gauss() * 0.05 }); drv.edge = e;
  }
  function plan(H, goalCell){
    const key = L.nodeKey(H.x, H.y);
    const exitPlate = goalCell || (S.LV.exitPlate && !S.doorOpen ? S.LV.exitPlate : null);
    for (const fallen of [false, true]){
      const nav = navFor(L, S.level, fallen);
      if (!nav.nodes.has(key)) continue;
      const goal = exitPlate ? (u => { const n = nav.nodes.get(u); return n.c === exitPlate.c && n.r === exitPlate.r; }) : (u => nav.isExit(u));
      const steps = route(nav, key, goal, S.M, ban);
      if (!steps) continue;
      if (!steps.length) return 'here';
      const x = steps[0];
      queue = x.e ? [x.e] : x.m.path.slice();
      return 'go';
    }
    return null;
  }
  function fight(H, O){
    const inp = BLANK(), toward = O.x > H.x ? 1 : -1, d = Math.abs(O.x - H.x), wind = L.STYLE[O.k].wind;
    if (O.st === 'lunge' && lastOppSt !== 'lunge'){ if (rng() > miss) parryAt = now + react(); nextAtk = Math.max(nextAtk, now + 0.2); }
    if ((O.st === 'recoil' || O.st === 'hit') && lastOppSt !== O.st && atkAt < 0) atkAt = now + react();
    lastOppSt = O.st;
    if (parryAt >= 0 && now >= parryAt){ parryAt = -1; inp.up = true; return inp; }
    if (H.st !== 'en') return inp;
    if (d > K.REACH - 0.06){ inp.x = toward; return inp; }
    if (atkAt < 0 && now >= nextAtk && O.st === 'en' && parryAt < 0) { atkAt = now + react(); nextAtk = now + 0.7 + rng() * 0.9; }
    if (atkAt >= 0 && now >= atkAt){ atkAt = -1; inp.atk = true; return inp; }
    return inp;
  }
  function decide(){
    const H = S.hero;
    if (S.phase !== 'play') return BLANK();
    // бой
    const O = S.guards.find(g => g.alive && Math.abs(g.y - H.y) < 0.01 && Math.abs(g.x - H.x) < K.DISENGAGE && g.room.x === S.room.x && g.room.y === S.room.y);
    if (FENCE[H.st] && O){ drv = null; queue = []; wait = react(); return fight(H, O); }
    parryAt = -1; atkAt = -1; lastOppSt = null;
    if (drv){
      const r = drv.next(S, dt);
      if (r === 'done'){
        const e = drv.edge; drv = null; wait = queue.length ? react() * 0.7 : react();
        if (e && e.to && L.nodeKey(H.x, H.y) !== e.to){ fails.set(e, (fails.get(e) || 0) + 1); if (fails.get(e) >= 2) ban.add(e); queue = []; }
      }
      else if (r === 'dead' || r === 'fail'){ drv = null; queue = []; wait = react(); }
      else return r;
    }
    if (wait > 0){ wait -= dt; return BLANK(); }
    if (pend){ const e = pend; pend = null; drv = L.Driver(e.a, { jit: gauss() * 0.05 }); drv.edge = e; return BLANK(); }
    if (H.st !== 'stand' || Math.abs(H.y - Math.round(H.y)) > 1e-6) return BLANK();
    if (!L.atMark(S.M, H.x, H.y)){ drv = L.Driver({ k: 'snap' }); return BLANK(); }
    const r = Math.round(H.y) - 1, c = Math.floor(H.x), pk = r * S.M.W + c, pot = S.M.potions[pk];
    if (pot && pot !== 'p' && (pot === 'H' || S.hp < S.maxHp)) { wait = 1.1; return Object.assign(BLANK(), { down: true }); }
    // финал: увести двойника на шипы — встать слева от центра зала и пробежать мимо своих ножниц
    const T = S.twin, MI = S.LV.mirror;
    let goalCell = null;
    if (T && S.bossDown && !T.done){
      if (!T.on){ wait = 0.2; return BLANK(); }
      if (c === MI.cx - 2 && Math.abs(H.y - (MI.row + 1)) < 0.01){
        const a = { k: 'run', f: -1, n: Math.ceil(H.x - (MI.cx - 4.4)) }, sim = L.simulate(S.level, { x: H.x, y: H.y, face: -1 }, a, {});
        twinRun++; queue = []; startEdge({ a, chopT: sim.chopT, t: sim.t }, H); return BLANK();
      }
      goalCell = { c: MI.cx - 2, r: MI.row }; queue = [];
    }
    // выход
    const tl = L.tile(S.M, c, r);
    if ((tl === 'E' && S.doorOpen) || (tl === 'T' && (!T || T.done))){ wait = 2; return Object.assign(BLANK(), { up: true }); }
    if (!queue.length){
      const p = plan(H, goalCell);
      if (p === 'here'){ wait = 0.5; return BLANK(); }
      if (!p){ drv = L.Driver({ k: 'step', f: rng() < 0.5 ? 1 : -1, n: 1 }); return BLANK(); }
    }
    const e = queue.shift();
    if (e.from !== L.nodeKey(H.x, H.y)){ queue = []; return BLANK(); }
    startEdge(e, H);
    return BLANK();
  }
  // кнопки «на нажатие»: up/atk отпускаем между нажатиями, чтобы движок видел фронт
  while (S.phase !== 'won' && S.phase !== 'over' && S.time < maxT){
    let inp = decide();
    if (inp.up && upHeld && FENCE[S.hero.st]) inp.up = false;
    if (inp.atk && atkHeld) inp.atk = false;
    upHeld = inp.up; atkHeld = inp.atk;
    game.setInput(inp); game.update(dt); now += dt;
    const key = S.level + ':' + Math.floor(S.hero.x) + ':' + Math.round(S.hero.y);
    if (key !== lastKey){ lastKey = key; lastProgress = S.time; }
    if (S.time - lastProgress > 120){ stats.stuck = true; break; }
    if (opts.only && S.level !== startLevel) break;
  }
  stats.won = S.won; stats.time = S.time; stats.level = S.level; stats.twinRun = twinRun;
  return stats;
}
