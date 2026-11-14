/* ПОДГОРЬЕ · tests/bot.mjs — граф проходимости по НАСТОЯЩЕЙ физике (P.phys.stepHero) и боты.
   Nav: узлы — точки опоры (пол/мостки), зацепы за стены, кольца, вода; рёбра — программы ввода
   (шаг, прыжки разной высоты и направления, второй прыжок, рывок, стена, раскачка на крюке, плавание),
   каждая прогоняется кадр за кадром через stepHero с переходами между комнатами (P.cross).
   Ломкие полы, световые двери, ложные стены и печать — «группы», открываются монотонно.
   Прогрессия: reach(abil) → достижимые узлы/предметы; solve() — перебор всех допустимых порядков способностей. */

export function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

const DT = 1 / 60;
export const ABIL = ['boots', 'dash', 'gloves', 'hook', 'hammer', 'bell', 'cloak', 'light'];

export function makeNav(P, W) {
  const T = P.T, K = P.K, ph = P.phys, SOLID = P.SOLID;
  const R = W.rooms;
  // группы открываемых клеток в исходных комнатах
  const OPENABLE = new Set([T.CRACK, T.IRON, T.LIGHT, T.FALSE, T.SEAL]);
  const groups = [];                         // {room, kind, cells[[c,r]], id}
  const groupAt = R.map(rm => new Int32Array(rm.W * rm.H).fill(-1));
  R.forEach(rm => {
    for (let r = 0; r < rm.H; r++) for (let c = 0; c < rm.W; c++) {
      const k = rm.t[r * rm.W + c];
      if (!OPENABLE.has(k) || groupAt[rm.i][r * rm.W + c] >= 0) continue;
      const cells = ph.group(rm, c, r), id = groups.length;
      cells.forEach(p => { groupAt[rm.i][p[1] * rm.W + p[0]] = id; });
      groups.push({ id, room: rm.i, kind: k, cells });
    }
  });
  // рабочие копии клеток с учётом открытых групп
  const work = R.map(rm => ({ i: rm.i, W: rm.W, H: rm.H, t: new Uint8Array(rm.t), rings: rm.rings, gx: rm.gx, gy: rm.gy, fWater: rm.fWater, fSteam: rm.fSteam, fHaz: rm.fHaz }));
  const Wn = { rooms: work, roomAt: (x, y) => { const r = W.roomAt(x, y); return r ? work[r.i] : null; } };
  let opened = new Set();
  function applyOpen(gs) {
    work.forEach((w, i) => w.t.set(R[i].t));
    opened = new Set(gs);
    for (const g of opened) { const G = groups[g], rm = R[G.room]; for (const [c, r] of G.cells) work[G.room].t[r * rm.W + c] = rm.wet ? T.WATER : T.AIR; }
  }

  const relevant = rm => {
    const s = new Set(['boots', 'dash', 'gloves']);
    if (rm.rings.length) s.add('hook');
    for (const k of rm.t) { if (k === T.WATER || k === T.HOTW) s.add('bell'); if (k === T.HEAT || k === T.HOTW) s.add('cloak'); }
    return s;
  };
  const relCache = R.map(relevant);
  // соседи комнаты (для ключа кэша)
  const nbrs = R.map(rm => [...new Set(rm.doors.map(d => d.to))]);

  // ---------- узлы ----------
  // локальный ключ: тип + координаты; глобальный id выдаётся по мере появления
  const nodeKey = [], nodeOf = new Map();
  function nid(ri, kind, a, b, c) { const k = ri + ':' + kind + ':' + a + ':' + b + ':' + (c || 0); let id = nodeOf.get(k); if (id === undefined) { id = nodeKey.length; nodeKey.push({ ri, kind, a, b, c: c || 0 }); nodeOf.set(k, id); } return id; }
  function freeBody(w, c, r, ab) {   // тело героини (2 клетки) свободно и без вреда
    for (let y = r - 2; y <= r - 1; y++) { const k = ph.tile(w, c, y); if (SOLID[k] || k === T.STEAM || k === T.SPIKE) return false; if ((k === T.HEAT || k === T.HOTW) && !ab.cloak) return false; }
    return true;
  }
  function support(w, c, r) { const k = ph.tile(w, c, r); return SOLID[k] || k === T.ONE; }
  function groundNodes(w, ab) {
    const out = [];
    for (let r = 2; r < w.H + 0; r++) for (let c = 0; c < w.W; c++) if (support(w, c, r) && freeBody(w, c, r, ab) && r <= w.H - 1) out.push([c, r]);
    return out;
  }

  // ---------- симуляция программы ----------
  function heroAt(x, y) { return ph.newHero(x, y); }
  // run: возвращает {end:{ri,kind,a,b,c}|null, items:[...], objs:[...]}
  const simBy = {}; let simKind = 'g'; let frames = 0;
  function sim(ri, h, prog, ab, opt = {}) {
    simBy[simKind] = (simBy[simKind] || 0) + 1;
    let cur = ri; const items = new Set(); const maxF = opt.maxF || 200;
    const st = {}; let wetT = 0;
    const wet0 = ph.isWater(ph.tile(work[ri], Math.floor(h.x), Math.floor(h.y - 0.85)));
    let offG = !h.ground, offW = !h.cling, offR = !h.hook, offWet = !wet0;
    for (let f = 0; f < maxF; f++) {
      const inp = prog(f, h, st, work[cur]); frames++;
      ph.stepHero(h, inp, work[cur], DT, ab, null);
      if (h.hit) return { end: null, items };
      const n = P.cross(Wn, cur, h); if (n !== cur) { cur = n; st.crossed = (st.crossed || 0) + 1; if (h.hook) h.hook = null; }
      const rm = R[cur];
      for (const it of rm.items) if (Math.abs(h.x - it.x) < 0.9 && h.y > it.y - 2.2 && h.y - K.HH < it.y + 0.2) items.add(it.id);
      if (!h.ground) offG = true; if (!h.cling) offW = true; if (!h.hook) offR = true; if (!h.wet) offWet = true;
      if (f < 2) continue;
      if (h.hook && offR) return { end: { ri: cur, kind: 'ring', a: h.hook.i, b: 0 }, items };
      if (h.ground && offG) { const y = Math.round(h.y), w = work[cur]; for (const cx of [Math.floor(h.x), Math.floor(h.x - K.HW + 0.02), Math.floor(h.x + K.HW - 0.02)]) if (support(w, cx, y) && freeBody(w, cx, y, ab)) return { end: { ri: cur, kind: 'g', a: cx, b: y }, items, x: h.x }; return { end: null, items }; }
      if (h.cling && h.vy >= 0 && offW) return { end: { ri: cur, kind: 'w', a: h.cling > 0 ? Math.floor(h.x + K.HW + 0.05) : Math.floor(h.x - K.HW - 0.05), b: Math.floor(h.y / 2) * 2 + 1, c: h.cling }, items };
      if (h.wet && (offWet || f > 40)) {
        if (ab.bell) { const ci = compIndex(cur, Math.floor(h.x), Math.floor(h.y), ab); if (ci < 0) return { end: null, items }; return { end: { ri: cur, kind: 'swc', a: ci, b: 0 }, items }; }
        wetT++; if (wetT > 20 && Math.abs(h.vy) < 1.2) return { end: { ri: cur, kind: 'fl', a: Math.floor(h.x), b: surfRow(work[cur], Math.floor(h.x), h.y) }, items };
      } else wetT = 0;
    }
    return { end: null, items };
  }
  function surfRow(w, c, y) { let r = Math.floor(y - 0.85); while (r > 0 && ph.isWater(ph.tile(w, c, r - 1))) r--; return r; }

  // программы ввода: (f, h, st, w) → inp
  const J = (hold, d, delay = 0) => f => ({ x: f >= delay ? d : 0, jump: f < hold });
  const progs = {
    walk: d => (f) => ({ x: d }),
    walkStop: d => (f, h, st) => { if (!h.ground) st.air = 1; return { x: st.air ? 0 : d }; },
    walkBack: d => (f, h, st) => { if (!h.ground) st.air = (st.air || 0) + 1; return { x: st.air > 4 ? -d : d }; },
    jump: (hold, d, delay) => J(hold, d, delay),
    dj: (fj, d, xd = 0) => f => ({ x: f >= xd ? d : 0, jump: f < 17 || (f >= fj && f < fj + 18) }),
    walkDj: d => (f, h, st) => { if (!h.ground && st.a == null) st.a = f; return { x: d, jump: st.a != null && f >= st.a + 7 && f < st.a + 25 }; },
    gdash: d => f => ({ x: d, dash: f < 2 }),
    jdash: (fd, d) => f => ({ x: d, jump: f < 18, dash: f >= fd && f < fd + 2 }),
    jdjdash: d => f => ({ x: d, jump: f < 17 || (f >= 20 && f < 38), dash: f >= 32 && f < 34 }),
    walkDash: d => (f, h, st) => { if (!h.ground && st.a == null) st.a = f; return { x: d, dash: st.a != null && f >= st.a + 4 && f < st.a + 6 }; },
    drop: d => f => ({ x: f < 3 ? 0 : d, y: f < 3 ? 1 : 0, jump: f === 1 }),
  };
  function withHook(prog, d) {
    return (f, h, st, w) => {
      const inp = prog(f, h, st, w);
      if (f > 3 && !h.ground && !h.hook && !st.hk && ph.ringFor(w, h, d) >= 0) { st.hk = 1; return Object.assign({}, inp, { hook: true }); }
      return inp;
    };
  }
  function groundProgs(ab, d, edge) {
    const L = [];
    if (edge) { L.push(progs.walk(d), progs.walkStop(d), progs.walkBack(d)); if (ab.boots) L.push(progs.walkDj(d)); if (ab.dash) L.push(progs.walkDash(d)); }
    L.push(progs.jump(18, d, 0), progs.jump(6, d, 0), progs.jump(11, d, 0), progs.jump(18, d, 10), progs.jump(18, d, 20));
    if (d > 0) L.push(progs.jump(18, 0, 0));
    if (ab.boots) { L.push(progs.dj(14, d), progs.dj(24, d), progs.dj(20, d, 22)); if (d > 0) L.push(progs.dj(20, 0)); }
    if (ab.dash) { L.push(progs.gdash(d), progs.jdash(10, d), progs.jdash(22, d)); if (ab.boots) L.push(progs.jdjdash(d)); }
    return L;
  }
  function clingProgs(ab, s) {   // s — сторона стены (+1 справа)
    const away = -s, L = [];
    L.push(f => ({ x: f < 7 ? away : s, jump: f < 18 }));            // отскок и назад к стене (подъём)
    L.push(f => ({ x: away, jump: f < 18 }));
    L.push(f => ({ x: f < 3 ? away : 0 }));                            // отпустить
    L.push(f => ({ x: s }));                                           // съехать вниз
    if (ab.boots) { L.push(f => ({ x: away, jump: f < 12 || (f >= 14 && f < 30) })); L.push(f => ({ x: f < 7 ? away : s, jump: f < 14 || (f >= 22 && f < 40) })); }
    if (ab.dash) L.push(f => ({ x: away, jump: f < 18, dash: f >= 8 && f < 10 }));
    return L;
  }
  function ringProgs(ab, d) {
    const L = [];
    for (const Tp of [30, 70, 120]) for (const rel of ['fwd', 'top']) {
      const base = (f, h, st) => {
        if (st.rel == null) {
          if (h.hook) {
            const w = h.hook.w, a = h.hook.a;
            const x = Math.abs(w) < 0.4 ? d : (w > 0 ? 1 : -1);
            const ready = f >= Tp && (rel === 'fwd' ? (w * d > 1.2 && a * d > -0.1) : (w * d > 0.3 && a * d > 0.5));
            if (ready || f > Tp + 120) { st.rel = f; return { x: d, jump: true }; }
            return { x };
          }
          st.rel = f;
        }
        const g = f - st.rel;
        return { x: d, jump: g < 1 || (ab.boots && st.dj && g >= st.dj && g < st.dj + 16) };
      };
      L.push(base);
      if (ab.boots) L.push((f, h, st) => { st.dj = 16; return base(f, h, st); });
      if (ab.dash) L.push((f, h, st) => { const o = base(f, h, st); if (st.rel != null && f - st.rel >= 10 && f - st.rel < 12) o.dash = true; return o; });
    }
    L.push((f, h) => ({ x: d, hook: f === 0 }));
    return L;
  }

  // ---------- рёбра комнаты ----------
  // Рёбра считаются «семействами программ» (base, boots, dash, bd = сапоги+рывок, +H — с крюком) при «физическом ключе»
  // (перчатки/колокол/плащ — то, что меняет исход любых программ). Результат семейства верен для любого набора,
  // где есть его способности и тот же физический ключ, — так кэш переиспользуется между наборами.
  const groupsOfRoom = R.map(() => []); groups.forEach(g => groupsOfRoom[g.room].push(g.id));
  // от каких групп зависят рёбра комнаты: свои + у соседей, лежащие у края (люки, двери)
  const nearEdgeG = groups.map(G => { const rm = R[G.room]; return G.cells.some(([c, r]) => c <= 1 || c >= rm.W - 2 || r <= 1 || r >= rm.H - 3); });
  const depGroups = R.map((rm, ri) => [...groupsOfRoom[ri], ...nbrs[ri].flatMap(n => groupsOfRoom[n].filter(g => nearEdgeG[g]))]);
  function modsKey(ri) { let s = ''; for (const g of depGroups[ri]) if (opened.has(g)) s += g + '.'; return s; }
  // перчатки не входят в физический ключ: без зацепа исходы те же (игрок может не прижиматься к стене),
  // а зацепы дают отдельное семейство 'gl' — те же программы с перчатками, только рёбра, где был зацеп.
  function physKey(ri, ab) { const rel = relCache[ri]; return (ab.bell && rel.has('bell') ? 'b' : '') + (ab.cloak && rel.has('cloak') ? 'c' : ''); }
  function abKey(ri, ab) { const rel = relCache[ri]; return ABIL.filter(a => ab[a] && (rel.has(a) || a === 'light' || a === 'hammer')).join(','); }
  function famsFor(ri, ab) {
    const f = ['base']; if (ab.boots) f.push('boots'); if (ab.dash) f.push('dash'); if (ab.boots && ab.dash) f.push('bd');
    if (ab.gloves) { f.push('gl'); if (ab.boots) f.push('glboots'); if (ab.dash) f.push('gldash'); }
    if (ab.hook && R[ri].rings.length) f.slice().forEach(x => f.push(x + 'H'));
    return f;
  }
  function famAb(fam, pk) {
    const a = { gloves: fam.startsWith('gl'), bell: pk.includes('b'), cloak: pk.includes('c') };
    if (/boots|bd/.test(fam)) a.boots = true; if (/dash|bd/.test(fam)) a.dash = true; if (fam.endsWith('H')) a.hook = true;
    return a;
  }
  function famProgs(fam, d, edge) {
    const L = [], base = fam.replace(/H$/, '').replace(/^gl$/, 'base').replace(/^gl/, '');
    if (base === 'base') {
      if (edge) L.push(progs.walk(d), progs.walkStop(d), progs.walkBack(d));
      L.push(progs.jump(18, d, 0), progs.jump(6, d, 0), progs.jump(11, d, 0), progs.jump(18, d, 10), progs.jump(18, d, 20));
      if (d > 0) L.push(progs.jump(18, 0, 0));
    } else if (base === 'boots') {
      if (edge) L.push(progs.walkDj(d));
      L.push(progs.dj(14, d), progs.dj(24, d), progs.dj(20, d, 22)); if (d > 0) L.push(progs.dj(20, 0));
    } else if (base === 'dash') {
      if (edge) L.push(progs.walkDash(d));
      L.push(progs.gdash(d), progs.jdash(10, d), progs.jdash(22, d));
    } else if (base === 'bd') L.push(progs.jdjdash(d));
    return L;
  }
  const famCache = new Map();
  let simCount = 0;
  function famEdges(ri, fam, pk) {
    const key = ri + '#' + fam + '#' + pk + '#' + modsKey(ri);
    let E = famCache.get(key); if (E) return E;
    E = []; const w = work[ri], rm = R[ri], ab = famAb(fam, pk), hook = fam.endsWith('H'); simKind = 'g:' + fam;
    const glOnly = fam.startsWith('gl');
    const add = (from, res, info) => { if (!res.end) return; const e = res.end; if (glOnly && e.kind !== 'w') return; const to = nid(e.ri, e.kind, e.a, e.b, e.c); if (to === from && !res.items.size) return; E.push({ from, to, items: [...res.items], info }); };
    const nearWall = (c, r, d) => { for (let s = 1; s <= 8; s++) for (let y = r - 9; y < r; y++) { const k = ph.tile(w, c + d * s, y); if (SOLID[k]) return true; } return false; };
    const gn = groundNodes(w, ab), isN = new Set(gn.map(([c, r]) => r * w.W + c));
    const inWater = (c, r) => ab.bell && (ph.isWater(ph.tile(w, c, r - 1)) || ph.isWater(ph.tile(w, c, r - 2)));
    for (const [c, r] of gn) {
      const id = nid(ri, 'g', c, r);
      if (fam === 'base') {
        for (const d of [-1, 1]) if (isN.has(r * w.W + c + d) && c + d >= 0 && c + d < w.W) E.push({ from: id, to: nid(ri, 'g', c + d, r), items: itemsAt(rm, c + d, r), info: null, walk: 1 });
        if (inWater(c, r)) { const ci = compIndex(ri, c, r, ab); if (ci >= 0) E.push({ from: id, to: nid(ri, 'swc', ci, 0), items: [], info: null, walk: 1 }); }
      }
      if (inWater(c, r)) continue;
      const edgeL = !isN.has(r * w.W + c - 1), edgeR = !isN.has(r * w.W + c + 1), nearEdge = !isN.has(r * w.W + c - 2) || !isN.has(r * w.W + c + 2);
      if (!(edgeL || edgeR || nearEdge || c % 4 === 0)) continue;
      for (const d of [-1, 1]) {
        const edge = d < 0 ? edgeL : edgeR;
        if (glOnly && !nearWall(c, r, d)) continue;
        famProgs(fam, d, edge).forEach((pg, pi) => { simCount++; const h = heroAt(c + 0.5, r); add(id, sim(ri, h, hook ? withHook(pg, d) : pg, ab), { kind: 'g', fam, d, pi, edge }); });
        if (fam === 'base' && ph.tile(w, c, r) === T.ONE) { const h = heroAt(c + 0.5, r); add(id, sim(ri, h, progs.drop(d), ab), { kind: 'drop', d }); }
        if (fam === 'gl' && ph.tile(w, c, r) === T.ONE) { const h = heroAt(c + 0.5, r); add(id, sim(ri, h, progs.drop(d), ab), { kind: 'drop', d }); }
      }
      if (fam === 'base' && ph.tile(w, c, r) === T.ONE) { const h = heroAt(c + 0.5, r); add(id, sim(ri, h, progs.drop(0), ab), { kind: 'drop', d: 0 }); }
    }
    famCache.set(key, E);
    return E;
  }
  function roomEdges(ri, ab) { const pk = physKey(ri, ab); let out = []; for (const f of famsFor(ri, ab)) out = out.concat(famEdges(ri, f, pk)); return out; }
  function itemsAt(rm, c, r) { const o = []; for (const it of rm.items) if (Math.abs(c + 0.5 - it.x) < 0.9 && Math.abs(r - it.y) < 1.5) o.push(it.id); return o; }
  // рёбра «особых» узлов (стена, кольцо, вода) — считаются по требованию
  const spCache = new Map();
  function specialEdges(id, ab) {
    const n = nodeKey[id], key = id + '#' + abKey(n.ri, ab) + '#' + modsKey(n.ri);
    let E = spCache.get(key); if (E) return E;
    E = []; const w = work[n.ri], rm = R[n.ri]; simKind = n.kind;
    const add = (res, info) => { if (!res.end) return; const e = res.end; const to = nid(e.ri, e.kind, e.a, e.b, e.c); if (to !== id || res.items.size) E.push({ from: id, to, items: [...res.items], info }); };
    if (n.kind === 'w') {
      const s = n.c, x = s > 0 ? n.a - K.HW - 0.001 : n.a + 1 + K.HW + 0.001;
      // каноническая точка зацепа в «корзине» из двух рядов: сначала самая низкая, где стена держит
      let yy = null; for (const y of [n.b + 0.95, n.b + 0.5, n.b, n.b - 0.5, n.b - 0.95, n.b - 1]) { const t = heroAt(x, y); if (ph.touchWall(w, t, s) && !ph.boxSolid(w, t, x, y)) { yy = y; break; } }
      if (yy != null) for (const pg of clingProgs(ab, s)) { const h = heroAt(x, yy); h.ground = false; h.cling = s; h.vy = 0; add(sim(n.ri, h, pg, ab), { kind: 'w' }); }
    } else if (n.kind === 'ring') {
      const rg = w.rings[n.a];
      for (const d of [-1, 1]) for (const pg of ringProgs(ab, d)) {
        const h = heroAt(rg.x, rg.y + K.ROPE + K.HH / 2); h.ground = false; h.hook = { i: n.a, L: K.ROPE, a: 0, w: 0 };
        add(sim(n.ri, h, pg, ab), { kind: 'ring', d });
        if (rm.rings.length > 1) { const h2 = heroAt(rg.x, rg.y + K.ROPE + K.HH / 2); h2.ground = false; h2.hook = { i: n.a, L: K.ROPE, a: 0, w: 0 }; add(sim(n.ri, h2, withHook(pg, d), ab), { kind: 'ring', d, hook: 1 }); }
      }
    } else if (n.kind === 'swc') {
      // вода с колоколом: один узел на связную область воды (заливка по клеткам, где помещается тело)
      const comp = compsOf(n.ri, ab).comps[n.a];
      if (comp.items.length) E.push({ from: id, to: id, items: comp.items, info: null, walk: 1 });
      for (const g of comp.ground) E.push({ from: id, to: nid(n.ri, 'g', g[0], g[1]), items: [], info: null, walk: 1 });
      for (const ex of comp.exits) { const h = heroAt(ex.x, ex.y); h.ground = false; add(sim(n.ri, h, f => ({ x: ex.dx, y: ex.dy, jump: ex.dy < 0 }), ab), { kind: 'swimx' }); }
      for (const [c, r] of comp.surf) for (const d of [-1, 1]) for (const pg of [progs.jump(18, d), progs.jump(18, d, 12), ...(ab.boots ? [progs.dj(16, d)] : [])]) { const h = heroAt(c + 0.5, r + 0.2); h.ground = false; h.wet = true; add(sim(n.ri, h, pg, ab), { kind: 'swimj' }); }
    } else if (n.kind === 'fl') {
      for (const d of [-1, 1]) for (const pg of [progs.walk(d), progs.jump(18, d), progs.jump(18, d, 12), progs.jump(8, d), ...(ab.boots ? [progs.dj(16, d), progs.dj(26, d)] : []), ...(ab.dash ? [progs.jdash(14, d)] : [])]) {
        const h = heroAt(n.a + 0.5, n.b + 1.2); h.ground = false; h.wet = true; add(sim(n.ri, h, (f, hh, st, ww) => f < 30 ? { x: 0 } : pg(f - 30, hh, st, ww), ab, { maxF: 260 }), { kind: 'fl' });
      }
    }
    spCache.set(key, E);
    return E;
  }
  const swCache = new Map();
  function compIndex(ri, c0, r0, ab) {
    const all = compsOf(ri, ab), w = work[ri];
    let ci = all.id[r0 * w.W + c0]; if (ci >= 0) return ci;
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0], [0, 2], [0, -2]]) { const y = r0 + dy, x = c0 + dx; if (x < 0 || x >= w.W || y < 0 || y > w.H) continue; ci = all.id[y * w.W + x]; if (ci >= 0) return ci; }
    return -1;
  }
  function compsOf(ri, ab) { swimComp(ri, 0, 0, ab); return swCache.get(ri + ':' + modsKey(ri) + ':' + (ab.cloak ? 1 : 0)); }
  function swimComp(ri, c0, r0, ab) {
    const w = work[ri], rm = R[ri];
    const fits = (c, r) => { for (let y = r - 2; y <= r - 1; y++) { const k = ph.tile(w, c, y); if (SOLID[k] || k === T.STEAM || k === T.SPIKE) return false; if ((k === T.HEAT || k === T.HOTW) && !ab.cloak) return false; } return ph.isWater(ph.tile(w, c, r - 1)) || ph.isWater(ph.tile(w, c, r - 2)); };
    const key = ri + ':' + modsKey(ri) + ':' + (ab.cloak ? 1 : 0);
    let all = swCache.get(key);
    if (!all) {
      all = { id: new Int32Array(w.W * (w.H + 2)).fill(-1), comps: [] };
      for (let r = 1; r <= w.H; r++) for (let c = 0; c < w.W; c++) {
        if (all.id[r * w.W + c] >= 0 || !fits(c, r)) continue;
        const comp = { cells: [], ground: [], exits: [], surf: [], items: [] }, ci = all.comps.length, st = [[c, r]]; all.id[r * w.W + c] = ci;
        while (st.length) {
          const [x, y] = st.pop(); comp.cells.push([x, y]);
          if (support(w, x, y) && freeBody(w, x, y, ab)) comp.ground.push([x, y]);
          if (!ph.isWater(ph.tile(w, x, y - 3)) && !SOLID[ph.tile(w, x, y - 3)] && y % 1 === 0) comp.surf.push([x, y]);
          for (const it of rm.items) if (Math.abs(x + 0.5 - it.x) < 1 && Math.abs(y - it.y) < 1.5 && !comp.items.includes(it.id)) comp.items.push(it.id);
          if (x === 0) comp.exits.push({ x: 0.4, y: y - 0.01, dx: -1, dy: 0 });
          if (x === w.W - 1) comp.exits.push({ x: w.W - 0.4, y: y - 0.01, dx: 1, dy: 0 });
          if (y - 2 <= 0) comp.exits.push({ x: x + 0.5, y: y, dx: 0, dy: -1 });
          if (y >= w.H - 1) comp.exits.push({ x: x + 0.5, y: y, dx: 0, dy: 1 });
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx, ny = y + dy; if (nx < 0 || nx >= w.W || ny < 1 || ny > w.H) continue;
            if (all.id[ny * w.W + nx] >= 0 || !fits(nx, ny)) continue; all.id[ny * w.W + nx] = ci; st.push([nx, ny]);
          }
        }
        comp.exits = comp.exits.filter((e, i) => i % 2 === 0);
        comp.surf = comp.surf.filter((e, i) => i % 3 === 0);
        all.comps.push(comp);
      }
      swCache.set(key, all);
    }
    const ci = all.id[r0 * w.W + c0];
    if (ci < 0) {   // узел у края воды — ищем рядом
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0], [0, 2]]) { const j = all.id[(r0 + dy) * w.W + c0 + dx]; if (j >= 0) return all.comps[j]; }
      return { cells: [], ground: [], exits: [], surf: [], items: [] };
    }
    return all.comps[ci];
  }

  // ---------- достижимость ----------
  const doorNode = new Map();
  function objNodes() {   // узлы объектов: наковальни, лифты, горны, арены, сердце
    const o = [];
    R.forEach(rm => rm.objs.forEach(ob => o.push({ ob, room: rm.i, id: nid(rm.i, 'g', Math.floor(ob.x), ob.y) })));
    return o;
  }
  // reach(ab, from?) → { seen:Set(nodeIds), items:Set, opened:Set(groups), forges:n, objs }
  function reach(abIn, opts = {}) {
    const ab = Object.assign({}, abIn);
    let gs = new Set(opts.opened || []);
    applyOpen(gs);
    const startId = nid(W.start.room, 'g', Math.floor(W.start.x), W.start.y);
    let res;
    for (let it = 0; it < 40; it++) {
      res = bfs([startId], ab);
      // монотонное открытие групп
      const add = [];
      for (const G of groups) {
        if (gs.has(G.id)) continue;
        if (G.kind === T.SEAL) { if (forgesLit(res) >= 5) add.push(G.id); continue; }
        if (canOpen(G, res.seen, ab)) add.push(G.id);
      }
      if (!add.length) break;
      add.forEach(g => gs.add(g)); applyOpen(gs);
    }
    res.opened = gs; res.ab = ab; res.startId = startId;
    return res;
  }
  function forgesLit(res) { let n = 0; for (const f of W.forges) { if (res.rooms.has(f.room)) n++; } return n; }
  function canOpen(G, seen, ab) {
    if (G.kind === T.LIGHT && !ab.light) return false;
    if ((G.kind === T.CRACK || G.kind === T.IRON) && !ab.hammer) return false;
    const rm = R[G.room];
    const cellSet = new Set(G.cells.map(([c, r]) => r * rm.W + c));
    for (const id of seenByRoom(seen, G.room)) {
      const n = nodeKey[id]; if (n.kind !== 'g' && n.kind !== 'w' && n.kind !== 'sw') continue;
      const hx = n.a + 0.5, hy = n.b;
      if (G.kind === T.CRACK || G.kind === T.IRON) { if (n.kind === 'g' && (cellSet.has(n.b * rm.W + n.a) || cellSet.has(n.b * rm.W + n.a + 1) || cellSet.has(n.b * rm.W + n.a - 1))) return true; continue; }
      if (G.kind === T.LIGHT) { for (const [c, r] of G.cells) { const dx = c + 0.5 - hx, dy = r + 0.5 - (hy - 0.85); if (dx * dx + dy * dy < K.LIGHT_R * K.LIGHT_R) return true; } continue; }
      if (G.kind === T.FALSE && n.kind === 'g') {   // выстрел искрой по горизонтали на уровне груди
        const row = Math.floor(hy - 1.05);
        for (const d of [-1, 1]) for (let s = 1; s <= 12; s++) { const c = n.a + d * s, k = ph.tile(work[G.room], c, row); if (cellSet.has(row * rm.W + c)) return true; if (SOLID[k] || k === T.STEAM) break; }
      }
    }
    return false;
  }
  let _seenRoomCache = null;
  function seenByRoom(seen, ri) { if (!_seenRoomCache || _seenRoomCache.seen !== seen) { const m = new Map(); for (const id of seen) { const r = nodeKey[id].ri; if (!m.has(r)) m.set(r, []); m.get(r).push(id); } _seenRoomCache = { seen, m }; } return _seenRoomCache.m.get(ri) || []; }
  // поиск в ширину по узлам; рёбра комнат — по требованию; лифты связаны между собой
  function liftIds() { return W.lifts.map(l => nid(l.room, 'g', Math.floor(l.x), l.y)); }
  function bfs(starts, ab, opt = {}) {
    const seen = new Set(starts), items = new Set(), rooms = new Set(), q = [...starts], prev = opt.prev ? new Map() : null;
    const edgesOf = id => { const n = nodeKey[id]; if (n.kind === 'g') { return roomIndex(n.ri, ab).get(id) || []; } return specialEdges(id, ab); };
    while (q.length) {
      const id = q.shift(); const n = nodeKey[id]; rooms.add(n.ri);
      let es = edgesOf(id);
      for (const e of es) {
        for (const it of e.items) items.add(it);
        if (!seen.has(e.to)) { seen.add(e.to); q.push(e.to); if (prev) prev.set(e.to, e); }
      }
    }
    return { seen, items, rooms, prev };
  }
  const idxCache = new Map();
  function roomIndex(ri, ab) {
    const key = ri + '#' + famsFor(ri, ab).join(',') + '#' + physKey(ri, ab) + '#' + modsKey(ri);
    let m = idxCache.get(key); if (m) return m;
    m = new Map(); for (const e of roomEdges(ri, ab)) { if (!m.has(e.from)) m.set(e.from, []); m.get(e.from).push(e); }
    idxCache.set(key, m); return m;
  }
  // обратная достижимость: из каждого достижимого узла можно вернуться к старту (нет ловушек)
  function trapCheck(res) {
    const ab = res.ab, rev = new Map();
    for (const id of res.seen) {
      const n = nodeKey[id]; const es = n.kind === 'g' ? (roomIndex(n.ri, ab).get(id) || []) : specialEdges(id, ab);
      for (const e of es) { if (!rev.has(e.to)) rev.set(e.to, []); rev.get(e.to).push(id); }
    }
    const lifts = liftIds().filter(l => res.seen.has(l));
    const back = new Set([res.startId, ...lifts]), q = [...back];
    while (q.length) { const id = q.shift(); for (const p of rev.get(id) || []) if (!back.has(p)) { back.add(p); q.push(p); } }
    const bad = []; for (const id of res.seen) if (!back.has(id)) bad.push(id);
    return bad;
  }
  function describe(id) { const n = nodeKey[id]; const rm = R[n.ri]; return n.kind + ' комн.' + n.ri + '(' + P.AREAS[rm.area].id + ' ' + rm.gx + ',' + rm.gy + ') ' + n.a + ',' + n.b; }
  // путь до узла (для бота): массив рёбер
  function pathTo(fromId, pred, ab) {
    const r = bfs([fromId], ab, { prev: true, noLift: true });
    let target = null; for (const id of r.seen) if (pred(id, nodeKey[id])) { target = id; break; }
    if (target == null) return null;
    const path = []; for (let id = target; id !== fromId; ) { const e = r.prev.get(id); path.unshift(e); id = e.from; }
    return path;
  }
  function progFor(info) { if (!info) return null; if (info.kind === 'drop') return progs.drop(info.d); if (info.kind === 'g') { const pg = famProgs(info.fam, info.d, info.edge)[info.pi]; return info.hook ? withHook(pg, info.d) : pg; } return null; }
  return { progFor, famProgs, stats: () => ({ sims: simCount, nodes: nodeKey.length, simBy, frames }), swimComp, reach, trapCheck, describe, nodeKey, nid, groups, roomEdges, specialEdges, sim, pathTo, work, applyOpen, progs, groundProgs, clingProgs, ringProgs, withHook, bfs, objNodes, heroAt, opened: () => opened };
}

// ---------- прогрессия: все допустимые порядки способностей ----------
// itemAbility(id) → 'boots'… для предметов-способностей
export function solveOrders(P, W, nav, opts = {}) {
  const abItems = {}; W.items.forEach(it => { if (it.type.startsWith('ab:')) abItems[it.id] = it.type.slice(3); });
  const forbid = opts.forbid || null;
  const memo = new Map(); const out = { states: 0, complete: 0, softlocks: [], traps: [], orders: 0, maxDepth: 0 };
  const heart = W.rooms.find(r => r.kind === 'heart');
  function key(S) { return ABIL.filter(a => S.has(a)).join(','); }
  function go(S, depth) {
    const k = key(S); if (memo.has(k)) return memo.get(k);
    out.states++;
    const ab = {}; S.forEach(a => ab[a] = true);
    const res = nav.reach(ab);
    if (opts.traps) { const bad = nav.trapCheck(res); if (bad.length) out.traps.push({ S: k, n: bad.length, ex: bad.slice(0, 3).map(nav.describe) }); }
    const avail = new Set(); for (const it of res.items) { const a = abItems[it]; if (a && !S.has(a) && a !== forbid) avail.add(a); }
    let cnt = 0;
    const done = res.rooms.has(heart.i);
    if (done) { out.complete++; cnt = 1; }
    else if (!avail.size) { out.softlocks.push(k); cnt = 0; }
    for (const a of avail) { const S2 = new Set(S); S2.add(a); cnt += go(S2, depth + 1); }
    out.maxDepth = Math.max(out.maxDepth, depth);
    memo.set(k, cnt); return cnt;
  }
  out.orders = go(new Set(), 0);
  return out;
}

// ---------- «человеческий» бот: зона 1 (Ворота) и первый босс ----------
// Реакция 150–250 мс (9–15 кадров) на врагов, снаряды и атаки босса; путь — по графу настоящей физики (ребро = программа ввода);
// неточность: старт программы со сдвигом до ±0,08 клетки и с запаздыванием 0–2 кадра; после каждого ребра — сверка и перепланирование.
export function playZone1(P, W, nav, seed, opt = {}) {
  const rng = mulberry32(seed * 7919 + 13), K = P.K;
  const evs = {}; const game = P.Game({ seed, onEvent: (t) => { evs[t] = (evs[t] || 0) + 1; }, dmgMul: opt.dmgMul }).start();
  const S = game.state(), arena = W.bossRooms.gatekeeper, react = 9 + Math.floor(rng() * 7), ab = {};
  const maxF = (opt.maxT || 600) * 60;
  const ignore = new Map(); let fight = {};
  let plan = null, step = 0, mode = 'plan', prog = null, pf = 0, pst = null, delay = 0, align = 0, tx = 0, seen = new Map(), f = 0, stuck = 0, lastRoom = -1, replans = 0;
  const node = () => { const h = S.hero; return nav.nid(S.room, 'g', Math.floor(h.x), Math.round(h.y)); };
  function replan() {
    replans++; if (opt.traceRe && replans < opt.traceRe) console.log('replan', f, S.room, S.hero.x.toFixed(2), S.hero.y.toFixed(2), 'mode', mode, 'step', step, plan && plan[step] ? nav.describe(plan[step].from) + '->' + nav.describe(plan[step].to) + ' ' + JSON.stringify(plan[step].info) : '');
    nav.applyOpen(Object.keys(S.prog.opened).filter(k => S.prog.opened[k]).map(Number));
    const from = node();
    plan = nav.pathTo(from, (id, n) => n.ri === arena && n.kind === 'g' && n.a > 6 && n.a < 34, ab);
    step = 0; mode = plan ? 'walk' : 'stuck';
  }
  function threat() {   // видимые угрозы с учётом реакции
    const h = S.hero, R = S.R; let best = null;
    for (const e of R.ens) {
      if (e.dead || (e.type === 'icicle' && e.st !== 'fall')) { seen.delete(e); continue; }
      const dx = e.x - h.x, dy = (e.y - e.h / 2) - (h.y - 1.05);
      if (ignore.has(e) && ignore.get(e) > f) continue;
      const vis = Math.abs(dx) < 9 && Math.abs(dy) < Math.max(0.7, e.h / 2 + 0.2);
      if (!vis) { seen.delete(e); continue; }
      if (!seen.has(e)) seen.set(e, f);
      if (f - seen.get(e) >= react && (!best || Math.abs(dx) < Math.abs(best.x - h.x))) best = e;
    }
    return best;
  }
  function incoming() {
    const h = S.hero, R = S.R;
    for (const q of R.eshots) { const dx = q.x - h.x; if (Math.abs(dx) < 4 && Math.sign(q.vx) === -Math.sign(dx) && q.y > h.y - 2 && q.y < h.y + 0.3) { if (!seen.has(q)) seen.set(q, f); if (f - seen.get(q) >= react) return q; } }
    for (const z of R.haz) { if (z.t < z.warn) continue; const zx = (z.x0 + z.x1) / 2, dx = zx - h.x; if (z.y1 > h.y - 1.5 && Math.abs(dx) < 3.2 && (z.vx === 0 || Math.sign(z.vx) === -Math.sign(dx))) { if (!seen.has(z)) seen.set(z, f); if (f - seen.get(z) >= react) return z; } }
    return null;
  }
  let jumpT = 0;
  function bossInput() {
    const h = S.hero, B = S.boss, p = B.parts[0], dx = p.x - h.x, dist = Math.abs(dx);
    let x = 0, jump = false, shoot = (f % 10) < 3;
    if (!seen.has(B.st + B.cyc)) seen.set(B.st + B.cyc, f);
    const known = f - seen.get(B.st + B.cyc) >= react;
    if (dist < 6) x = dx > 0 ? -1 : 1; else if (dist > 11) x = dx > 0 ? 1 : -1;
    if ((h.x < 3.5 && x < 0) || (h.x > 36.5 && x > 0)) x = 0;
    const inc = incoming();
    if (inc && h.ground) jumpT = 18;
    if (known && B.st === 'charge' && B.t > 0.62 && h.ground && Math.sign(B.face) === Math.sign(-dx) && dist < 6.5) jumpT = 20;
    if (known && dist < 4 && h.ground && (h.x < 4 || h.x > 36)) { jumpT = 18; x = dx > 0 ? 1 : -1; }
    if (jumpT > 0) { jump = true; jumpT--; }
    if (x === 0 || dist > 6) { if ((dx > 0) !== (h.face > 0) && f % 6 === 0) x = dx > 0 ? 1 : -1; }
    return { x, jump, shoot };
  }
  for (f = 0; f < maxF; f++) {
    if (S.prog.bosses.gatekeeper) return { won: true, time: f / 60, deaths: S.deaths, evs, replans };
    if (S.phase === 'dead') { game.setInput({}); game.update(1 / 60); mode = 'plan'; continue; }
    const h = S.hero;
    if (S.room !== lastRoom) { lastRoom = S.room; seen = new Map(); }
    let inp = {};
    if (S.boss && !S.boss.dead) { inp = bossInput(); game.setInput(inp); game.update(1 / 60); continue; }
    if (S.room === arena && !S.boss && h.ground) { inp = { x: h.x < 20 ? 1 : -1 }; game.setInput(inp); game.update(1 / 60); continue; }
    if (mode === 'plan') { if (h.ground) replan(); else { game.setInput({}); game.update(1 / 60); continue; } }
    if (mode === 'stuck') { stuck++; inp = { x: rng() < 0.5 ? 1 : -1, jump: rng() < 0.3 }; if (stuck % 30 === 0 && h.ground) replan(); game.setInput(inp); game.update(1 / 60); continue; }
    const e = plan[step];
    if (!e) { mode = 'plan'; game.setInput({}); game.update(1 / 60); continue; }
    if (mode === 'walk' || mode === 'align') {
      // бой (только на земле, вне программы)
      const th = threat(), inc = incoming();
      if (inc && h.ground) { inp = { jump: true }; game.setInput(inp); game.update(1 / 60); mode = 'plan'; continue; }
      if (th && h.ground) {
        if (fight.e !== th) fight = { e: th, t: f };
        if (f - fight.t > 240) { ignore.set(th, f + 300); fight = {}; }
        const dx = th.x - h.x; inp = { x: (dx > 0) !== (h.face > 0) ? (dx > 0 ? 1 : -1) : 0, shoot: (f % 10) < 3 };
        if (th.type === 'flyer' && Math.abs(dx) < 1.5) inp.y = -1;
        game.setInput(inp); game.update(1 / 60); continue;
      }
      const tn = nav.nodeKey[e.to], fn = nav.nodeKey[e.from];
      if (e.walk) {
        if (fn.ri !== S.room) { mode = 'plan'; continue; }
        const target = tn.a + 0.5, dx = target - h.x;
        if (Math.abs(dx) < 0.3 || tn.ri !== S.room) { step++; continue; }
        inp = { x: dx > 0 ? 1 : -1 };
      } else {
        if (fn.ri !== S.room || !h.ground) { mode = 'plan'; game.setInput({}); game.update(1 / 60); continue; }
        if (mode === 'walk') { mode = 'align'; align = 0; tx = fn.a + 0.5 + (rng() - 0.5) * 0.16; delay = rng() < 0.3 ? 1 + Math.floor(rng() * 2) : 0; }
        const dx = tx - h.x; align++;
        if ((Math.abs(dx) < 0.07 && Math.abs(h.vx) < 0.3) || align > 90) {
          if (delay > 0) { delay--; inp = {}; }
          else { prog = nav.progFor(e.info); pf = 0; pst = {}; mode = 'prog'; if (!prog) { step++; mode = 'walk'; } }
        } else inp = { x: Math.abs(dx) > 0.22 ? (dx > 0 ? 1 : -1) : (Math.abs(h.vx) < 0.4 && f % 3 === 0 ? (dx > 0 ? 1 : -1) : 0) };
      }
    }
    if (opt.trace && f < opt.trace) console.log(f, mode, step, S.room, S.hero.x.toFixed(2), S.hero.y.toFixed(2), S.hero.ground, JSON.stringify(inp));
    if (mode === 'prog') {
      const pin = prog(pf, h, pst, S.R); inp = { x: pin.x, y: pin.y, jump: pin.jump, dash: pin.dash, hook: pin.hook };
      pf++;
      game.setInput(inp); game.update(1 / 60);
      if (!S.hero.ground) pst._left = 1;
      if (pf > 2 && ((S.hero.ground && pst._left) || pf > 240)) {
        const tn = nav.nodeKey[e.to];
        if (S.room === tn.ri && Math.abs(Math.floor(S.hero.x) - tn.a) <= 1 && Math.round(S.hero.y) === tn.b) { step++; mode = 'walk'; }
        else mode = 'plan';
      }
      continue;
    }
    game.setInput(inp); game.update(1 / 60);
  }
  if (opt.dump) console.log('dump', S.hero.x.toFixed(2), S.hero.y.toFixed(2), mode, step, plan && plan[step] && JSON.stringify(plan[step].info), S.R.ens.filter(e => !e.dead).map(e => e.type + '@' + e.x.toFixed(1) + ',' + e.y.toFixed(1) + ' hp' + e.hp).join(' '));
  return { won: false, time: maxF / 60, deaths: S.deaths, evs, room: S.room, area: P.AREAS[W.rooms[S.room].area].id, replans };
}

// ---------- бот без урона против босса ----------
export function bossBot(P, W, id, opt = {}) {
  const g = P.Game({ god: true, seed: opt.seed || 3 }).start(), S = g.state();
  g._give('boots', 'dash', 'gloves', 'hook', 'hammer', 'bell', 'cloak', 'light');
  if (opt.ups !== false) ['spread', 'pierce', 'charge', 'rapid'].forEach(u => { S.prog.ups[u] = true; });
  const ri = W.bossRooms[id]; g._place(ri, 20, 19);
  const maxF = (opt.maxT || 240) * 60;
  for (let f = 0; f < maxF; f++) {
    const B = S.boss, h = S.hero; let inp = {};
    if (!B) inp = { x: h.x < 20 ? 1 : -1 };
    else if (B.dead) return { won: true, time: f / 60 };
    else {
      const p = B.parts[B.weak[0]], dx = p.x - h.x, chest = h.y - 1.05;
      const vert = Math.abs(p.y - chest) < p.h / 2 + 0.2, above = p.y < chest - 0.5;
      if (vert) { inp = { x: (dx > 0) !== (h.face > 0) ? (dx > 0 ? 1 : -1) : 0, shoot: f % 8 < 2 }; }
      else if (above && Math.abs(dx) < p.w / 2 + 0.3) inp = { y: -1, shoot: f % 8 < 2 };
      else if (above) { inp = { x: Math.abs(dx) > 0.6 ? (dx > 0 ? 1 : -1) : 0, shoot: f % 8 < 2, y: -1 }; if (p.y > chest - 4.5 && h.ground && f % 30 < 2) inp = { jump: true, x: dx > 0 ? 1 : -1 }; }
      else inp = { x: dx > 0 ? 1 : -1, shoot: f % 8 < 2 };
      if (B.id === 'drill' && B.st === 'out') inp = { x: Math.abs(dx) > 2 ? (dx > 0 ? 1 : -1) : 0, shoot: f % 8 < 2, y: Math.abs(dx) < 1.2 ? -1 : 0 };
    }
    g.setInput(inp); g.update(1 / 60);
  }
  return { won: false, hp: S.boss && S.boss.hp };
}
