/* ПЕРЕПРАВА · tests/bot.mjs — боты для проверки проходимости и баланса.
   findPath — поиск пути по «время × ряд × x» на точной модели мира (мир — чистая функция времени):
     mode 'bfs' — в ширину по времени (самый быстрый путь; проверка проходимости);
     mode 'best' — «сначала вперёд» (как человек: ищет, куда продвинуться, а не кратчайшее).
     robust: n тиков — прыжок годится, только если он безопасен и при нажатии на n тиков позже.
   playPereprava — партия бота. Управляет только game.move(dir), как игрок.
   «Человеческий» бот (по умолчанию):
   - видит ту же картину, что на экране, и прокладывает маршрут «сначала вперёд» с запасом по времени (robust);
   - реакция 150–250 мс: маршрут начинается после «раздумья», а не с текущего кадра;
   - рука ошибается по времени: каждое нажатие уходит со сдвигом ε ~ N(0, σ);
   - после каждого прыжка проверяет, жив ли маршрут, иначе — прокладывает новый (снова с реакцией);
   - нет маршрута — стоит, а если стоять нельзя, прыгает туда, где проживёт дольше.
   opts: { levels=10, startLevel=1, sigma, robust, react:[0.15,0.25], perfect=false }
   perfect: true — «идеальный» бот: маршрут 'bfs' без запаса, исполняется тик в тик. */

export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

const DT = 1 / 60, STEP = 3;
const ACTS = ['up', 'left', 'right', 'wait', 'down'];

// Мини-куча по приоритету
function Heap(){ const a = []; return {
  get size(){ return a.length; },
  push(n){ a.push(n); let i = a.length - 1; while (i > 0){ const p = (i - 1) >> 1; if (a[p].f <= a[i].f) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } },
  pop(){ const top = a[0], last = a.pop(); if (a.length){ a[0] = last; let i = 0; for (;;){ const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l].f < a[m].f) m = l; if (r < a.length && a[r].f < a[m].f) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } } return top; } }; }

// Поиск пути. okBay(i) — годится ли ячейка i. → { path:[{tick, dir}], ticks, bay } | null
// Ходы: «ждать» 3 тика (0.05 с) или прыжок (до приземления, 9 тиков). Ключ состояния — тик, ряд, x с шагом 3 px.
export function findPath(K, cfg, hero0, t0, okBay, maxT, opts = {}){
  const L = K.logic, maxTick = Math.floor(maxT / DT), best = opts.mode === 'best', robust = opts.robust || 0;
  const maxNodes = opts.maxNodes || 4e5, hopK = Math.ceil(L.HOP_T / DT / STEP) * STEP;
  const waitK = opts.wait || STEP, xq = opts.xq || 3;
  const seen = new Set();
  // «сначала вперёд»: ряды до ячеек + клетки по горизонтали до ближайшей свободной ячейки (на подходе к ней)
  const bayXs = L.BAY_COLS.map((c, i) => okBay(i) ? L.colX(c) : null).filter(x => x !== null);
  const hval = h => { let d = 1e9; for (const x of bayXs) d = Math.min(d, Math.abs(h.x - x)); return h.row + (h.row <= 3 && bayXs.length ? d / L.CW * 0.8 : 0); };
  const root = { h: L.cloneHero(hero0), tick: 0, t: t0, parent: null, act: null, f: 0 };
  const heap = Heap(); heap.push(root);
  let nodes = 0;
  const sim = (h, t, k) => { let res = null; for (let i = 0; i < k; i++){ t += DT; res = L.stepHero(cfg, h, t, DT); if (res) return { res, t, i: i + 1 }; } return { res: null, t, i: k }; };
  while (heap.size){
    const n = heap.pop();
    if (++nodes > maxNodes) return null;
    for (const act of ACTS){
      const h = L.cloneHero(n.h);
      if (act !== 'wait' && !L.hopStart(cfg, h, act)) continue;
      const k = act === 'wait' ? waitK : hopK;
      const s = sim(h, n.t, k), tick = n.tick + s.i;
      if (s.res === 'bay'){
        const bi = L.bayAt(h.x);
        if (!(bi >= 0 && okBay(bi))) continue;
        if (robust){   // и при опоздании на robust тиков тоже в ту же ячейку
          const h2 = L.cloneHero(n.h), w = sim(h2, n.t, robust); if (w.res) continue;
          L.hopStart(cfg, h2, act); const s2 = sim(h2, w.t, hopK); if (s2.res !== 'bay' || L.bayAt(h2.x) !== bi) continue;
        }
        const path = [{ tick: n.tick, dir: act }]; let p = n;
        while (p.parent){ path.unshift({ tick: p.parent.tick, dir: p.act }); p = p.parent; }
        return { path: path.filter(st => st.dir !== 'wait'), ticks: tick, bay: bi, nodes };
      }
      if (s.res || tick > maxTick) continue;
      if (robust && act !== 'wait'){
        // опоздание: подождать robust тиков, прыгнуть и устоять после приземления
        const h2 = L.cloneHero(n.h), w = sim(h2, n.t, robust); if (w.res) continue;
        if (!L.hopStart(cfg, h2, act)) continue;
        const s2 = sim(h2, w.t, hopK + 3); if (s2.res) continue;
      }
      const key = (tick * 16 + h.row) * 1000 + Math.round(h.x / xq + 200);
      if (seen.has(key)) continue; seen.add(key);
      heap.push({ h, tick, t: s.t, parent: n, act, f: best ? hval(h) * 1e5 + tick : tick });
    }
  }
  return null;
}

// Партия бота с startLevel на levels уровней.
export function playPereprava(K, seed, opts = {}){
  const L = K.logic, levels = opts.levels || 10, start = opts.startLevel || 1, perfect = !!opts.perfect;
  const brng = mulberry32(seed * 7919 + 17);
  const gauss = () => { let u = 0; for (let i = 0; i < 4; i++) u += brng(); return (u - 2) / 0.577; };
  const sigma = perfect ? 0 : (opts.sigma == null ? 0.075 : opts.sigma);
  const robust = perfect ? 0 : (opts.robust == null ? 8 : opts.robust);
  const [r0, r1] = perfect ? [0, 0] : (opts.react || [0.15, 0.25]);
  const lost = {}, causes = {};
  const game = K.Game({ rng: mulberry32(seed), level: start, maxLevel: start + levels - 1,
    onEvent: (type, d) => { if (type === 'die'){ lost[S.level] = (lost[S.level] || 0) + 1; causes[d.reason] = (causes[d.reason] || 0) + 1; } } }).start();
  const S = game.state();
  const maxTicks = (opts.maxT || 160 * levels) / DT;
  let tick = 0, plan = null, retryAt = 0, plans = 0;

  const freeBay = i => { const b = S.bays[i]; return !!b && !b.filled && b.trap <= 0 && b.warn <= 0; };
  const sim = (h, t, k) => { for (let i = 0; i < k; i++){ t += DT; const r = L.stepHero(S.cfg, h, t, DT); if (r) return { res: r, t, i }; } return { res: null, t, i: k }; };

  // Проложить маршрут: «раздумье» (react) — герой это время стоит, маршрут — с момента, когда руки готовы
  function makePlan(){
    const rt = perfect ? 0 : Math.round((r0 + brng() * (r1 - r0)) / DT);
    const h = L.cloneHero(S.hero), w = sim(h, S.time, rt);
    if (w.res) return null;
    plans++;
    const r = findPath(K, S.cfg, h, w.t, freeBay, Math.max(0.3, S.timer - rt * DT - 0.1),
      perfect ? { mode: 'bfs' } : { mode: 'best', robust, maxNodes: opts.maxNodes || 8000, wait: 6, xq: 6 });
    if (!r) return null;
    const base = tick + rt;
    return { hero: S.hero, bay: r.bay, steps: r.path.map(s => ({ at: base + s.tick, dir: s.dir, err: perfect ? 0 : Math.round(Math.abs(gauss()) * sigma / DT) })) };
  }
  // Жив ли маршрут из текущего состояния (без ошибок руки)?
  function planAlive(p){
    const h = L.cloneHero(S.hero); let t = S.time, tk = tick, i = 0;
    const last = p.steps.length ? p.steps[p.steps.length - 1].at : tick;
    while (tk <= last + 30){
      if (i < p.steps.length && tk >= p.steps[i].at && !h.hop){ if (!L.hopStart(S.cfg, h, p.steps[i].dir)) return false; i++; }
      t += DT; tk++; const r = L.stepHero(S.cfg, h, t, DT);
      if (r === 'bay') return L.bayAt(h.x) === p.bay && freeBay(p.bay);
      if (r) return false;
    }
    return false;
  }
  // Нет маршрута: стоять, если можно; иначе — туда, где проживёт дольше
  function survive(){
    const h = L.cloneHero(S.hero), w = sim(h, S.time, 24); if (!w.res) return;
    let bestDir = null, bestLife = w.i;
    for (const d of ['up', 'left', 'right', 'down']){ const h2 = L.cloneHero(S.hero); if (!L.hopStart(S.cfg, h2, d)) continue; const s = sim(h2, S.time, 40); const life = s.res ? (s.res === 'bay' && freeBay(L.bayAt(h2.x)) ? 99 : s.i) : 99; if (life > bestLife){ bestLife = life; bestDir = d; } }
    if (bestDir) game.move(bestDir);
  }

  let wasHop = false;
  while (!S.over && !S.won && tick < maxTicks){
    if (S.phase === 'play'){
      if (plan && plan.hero !== S.hero) plan = null;                      // ячейка заполнена/гибель — новый герой
      if (plan && plan.bay >= 0 && !freeBay(plan.bay)) plan = null;         // ячейку закрыл капкан
      const landed = wasHop && !S.hero.hop; wasHop = !!S.hero.hop;
      if (plan && landed && !perfect && !planAlive(plan)) plan = null;     // ошибка руки сломала маршрут
      if (!plan && !S.hero.hop && tick >= retryAt){ plan = makePlan(); if (!plan) retryAt = tick + 12; }
      if (plan && !S.hero.hop && plan.steps.length){
        const s = plan.steps[0];
        if (tick >= s.at + s.err){ plan.steps.shift(); game.move(s.dir); wasHop = true; }
      }
      if (!plan && !S.hero.hop && !perfect) survive();
    } else { plan = null; wasHop = false; }
    game.update(DT); tick++;
  }
  const passed = S.won ? levels : S.level - start;
  return { won: S.won, passed, level: S.level, score: S.score, lost, causes, plans, time: tick * DT, stuck: !S.won && !S.over };
}
