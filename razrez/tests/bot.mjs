/* РАЗРЕЗ · tests/bot.mjs — «человеческий» бот для проверки баланса.
   Без читов: видит поле, резец, шары и клещей (то же, что на экране), управляет
   только через setDir(dx,dy) — как игрок стрелками.
   Человеческие ограничения:
   - реакция: шары/клещи видны с задержкой 150–250 мс (буфер кадров), решения ~12 раз/с;
   - предсказание шаров — линейное с отскоками от ТЕКУЩЕЙ суши на ≤1.2 с вперёд
     (дальше — только запас по расстоянию, растущий со временем);
   - стратегия умелого игрока: короткие прямоугольные «надрезы» от кромки суши,
     выгодные по площади; если шар подлетает к следу — сворачивает на ближайшую сушу;
   - на суше уходит от клещей, а перед выходом в поле ждёт, пока шары отойдут. */

export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

const DIRS = [[1,0],[-1,0],[0,1],[0,-1]];

/* opts: { levels=5, maxT=1500, react:[0.15,0.25], decide=1/12, margin=2.2, angErr=0.14, focus=3, patience:[1,2.5] } */
export function playRazrez(R, seed, opts={}){
  const L = R.logic, FREE = L.FREE, LAND = L.LAND, TRAIL = L.TRAIL;
  const levels = opts.levels || 5, maxT = opts.maxT || 1500;
  const brng = mulberry32(seed*7919 + 29);
  const [r0, r1] = opts.react || [0.15, 0.25];
  const react = r0 + brng()*(r1-r0);
  const decideDt = opts.decide || 1/12;
  const margin = opts.margin == null ? 2.2 : opts.margin;
  const angErr = opts.angErr == null ? 0.14 : opts.angErr;   // ~8°
  const focus = opts.focus || 3;                                // сколько шаров держит во внимании
  const deaths = { ball:0, self:0, mite:0 }, lostBy = {};
  let memoLevel = 0;
  const game = R.Game({ rng: mulberry32(seed), maxLevel: levels, onEvent:(t,d)=>{
    if (t === 'death'){ deaths[d.reason] = (deaths[d.reason]||0) + 1; lostBy[S.level] = (lostBy[S.level]||0) + 1; }
  } }).start();
  const S = game.state(), cols = S.cols, rows = S.rows, G = S.grid, h = 1/60;
  const hist = [];
  let t = 0, nextDecide = 0;
  let plan = null;          // { moves:[[dx,dy]...], i, kind:'walk'|'cut'|'escape', startX, startY }
  let holdT = 0, maxLevel = 1;
  // Нетерпение: прождав на суше дольше patience, игрок рискует — запас сокращается.
  const patience = opts.patience || [1.0, 2.5];
  let waitStart = -1, patT = patience[0] + brng()*(patience[1]-patience[0]), bold = 1;

  const at = (x,y) => (x<0||y<0||x>=cols||y>=rows) ? -1 : G[y*cols+x];
  function stale(){ let s = hist[0]; for (let i = hist.length-1; i >= 0; i--) if (hist[i].t <= t - react){ s = hist[i]; break; } return s; }

  // Предсказание шара: шаги 1/30 с, отскок от суши (как видно глазом).
  function predictBall(b, horizon){
    const out = []; let x = b.x, y = b.y, vx = b.vx, vy = b.vy; const dt = 1/30;
    const solid = (cx,cy) => { const c = at(cx,cy); return c === LAND || c === -1; };
    const hit = (px,py) => { const r = 0.45; for (let cy = Math.floor(py-r); cy <= Math.floor(py+r); cy++) for (let cx = Math.floor(px-r); cx <= Math.floor(px+r); cx++) if (solid(cx,cy)) return true; return false; };
    for (let tau = 0; tau <= horizon + 1e-9; tau += dt){
      out.push([x, y]);
      const nx = x + vx*dt; if (hit(nx, y)) vx = -vx; else x = nx;
      const ny = y + vy*dt; if (hit(x, ny)) vy = -vy; else y = ny;
    }
    return out;
  }

  const cutSeen = new Int32Array(cols*rows); let cutStamp = 0;
  // Путь надреза от (x,y): d шагов в dir, m шагов вбок, затем обратно до суши.
  function buildCut(x, y, dir, side, d, m){
    const moves = [], cells = []; let cx = x, cy = y; const st = ++cutStamp;
    const legs = [[dir, d], [side, m], [[-dir[0], -dir[1]], 80]];
    for (const [v, n] of legs){
      for (let k = 0; k < n; k++){
        const nx = cx + v[0], ny = cy + v[1], c = at(nx, ny);
        if (c === -1 || c === TRAIL) return null;
        const key = ny*cols + nx; if (cutSeen[key] === st) return null;
        moves.push(v); cx = nx; cy = ny;
        if (c === LAND) return cells.length ? { moves, cells, ex:cx, ey:cy } : null;
        cutSeen[key] = st; cells.push(key);
      }
    }
    return null;
  }

  // Сколько клеток даст надрез: области по обе стороны следа без шаров (+ сам след).
  // Обход каждой области прерывается, как только в ней встречен шар.
  const mark = new Int32Array(cols*rows), ballAt = new Int32Array(cols*rows); let stamp = 0;
  function gainOf(cells, balls){
    const base = stamp + 1, ballSt = ++stamp, cutSt = ++stamp;
    for (const b of balls) for (let cy = Math.floor(b.y-0.45); cy <= Math.floor(b.y+0.45); cy++) for (let cx = Math.floor(b.x-0.45); cx <= Math.floor(b.x+0.45); cx++) if (cx>=0&&cy>=0&&cx<cols&&cy<rows) ballAt[cy*cols+cx] = ballSt;
    for (const k of cells) mark[k] = cutSt;
    let total = cells.length; const stack = [];
    for (const k0 of cells){
      for (const [dx,dy] of DIRS){
        const x = k0 % cols + dx, y = (k0/cols|0) + dy, k = y*cols + x;
        if (at(x,y) !== FREE || mark[k] >= base) continue;
        const rid = ++stamp;
        let cnt = 0, hasBall = false; stack.length = 0; stack.push(k); mark[k] = rid;
        while (stack.length){
          const i = stack.pop(); cnt++;
          if (ballAt[i] === ballSt){ hasBall = true; break; }
          const ix = i % cols, iy = i / cols | 0;
          for (const [ex,ey] of DIRS){ const nx = ix+ex, ny = iy+ey, j = ny*cols+nx;
            if (at(nx,ny) !== FREE) continue;
            const m = mark[j];
            if (m === rid || m === cutSt) continue;
            if (m >= base){ hasBall = true; stack.length = 0; break; }   // прерванная область с шаром
            mark[j] = rid; stack.push(j); }
        }
        if (!hasBall) total += cnt;
      }
    }
    return total;
  }

  // Безопасен ли надрез, начатый через t0 с: шары не подходят к следу ближе запаса.
  function safeCut(cut, preds, t0){
    const sp = S.params.playerSpeed, n = cut.cells.length, T = t0 + (cut.moves.length)/sp;
    const cx = cut.cx || (cut.cx = cut.cells.map(k => k % cols + 0.5));
    const cy = cut.cy || (cut.cy = cut.cells.map(k => (k / cols | 0) + 0.5));
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (let k = 0; k < n; k++){ if (cx[k] < x0) x0 = cx[k]; if (cx[k] > x1) x1 = cx[k]; if (cy[k] < y0) y0 = cy[k]; if (cy[k] > y1) y1 = cy[k]; }
    for (const pr of preds){
      for (let j = Math.max(0, Math.floor((t0 - 0.2)*30)); j < pr.length; j++){
        const tau = j/30; if (tau > T + 0.15) break;
        const mg = margin*bold + Math.max(0, tau - 0.6) * 1.2*bold;   // дальний прогноз — неточный
        const bx = pr[j][0], by = pr[j][1];
        if (bx < x0 - mg || bx > x1 + mg || by < y0 - mg || by > y1 + mg) continue;
        const laid = Math.min(n, Math.floor((tau - t0)*sp) + 1);
        for (let k = 0; k < laid; k++) if (Math.abs(cx[k] - bx) < mg && Math.abs(cy[k] - by) < mg) return false;
      }
    }
    return true;
  }

  // BFS по клеткам, для которых ok(c) истинно; возвращает ходы до первой клетки goal.
  function bfs(x0, y0, ok, goal, limit){
    const prev = new Int32Array(cols*rows).fill(-1), q = [y0*cols+x0]; prev[q[0]] = q[0];
    for (let qi = 0; qi < q.length && qi < (limit||1e9); qi++){
      const i = q[qi], x = i % cols, y = i / cols | 0;
      if (qi > 0 && goal(x, y, i)){
        const moves = []; let j = i;
        while (j !== q[0]){ const p = prev[j]; moves.push([(j%cols)-(p%cols), ((j/cols)|0)-((p/cols)|0)]); j = p; }
        return moves.reverse();
      }
      for (const [dx,dy] of DIRS){
        const nx = x+dx, ny = y+dy, c = at(nx,ny), k = ny*cols+nx;
        if (c === -1 || prev[k] !== -1) continue;
        if (!ok(c, nx, ny) && !goal(nx, ny, k)) continue;
        prev[k] = i; q.push(k);
      }
    }
    return null;
  }

  // Как игрок «видит» шары: кадр с задержкой реакции; направление и скорость — на глаз
  // (ошибка угла до ±angErr рад, скорости ±10%). Внимание ограничено: при каждом решении
  // игрок смотрит на `focus` ближайших шаров и на один случайный; остальные помнит с
  // момента последнего взгляда и мысленно ведёт их по прямой (без отскоков).
  const memo = [];
  function seen(s){
    if (memoLevel !== S.level){ memo.length = 0; memoLevel = S.level; }
    const age = t - s.t, P = S.player;
    const order = s.sea.map((b, i) => [Math.abs(b.x - P.x) + Math.abs(b.y - P.y), i]).sort((a, b) => a[0] - b[0]);
    const look = new Set(order.slice(0, focus).map(o => o[1]));
    if (s.sea.length) look.add(Math.floor(brng()*s.sea.length));
    return s.sea.map((b, i) => {
      if (look.has(i) || !memo[i]){
        const a = (brng()*2-1)*angErr, k = 1 + (brng()*2-1)*0.1, c = Math.cos(a)*k, sn = Math.sin(a)*k;
        memo[i] = { x:b.x + b.vx*age, y:b.y + b.vy*age, vx:b.vx*c - b.vy*sn, vy:b.vx*sn + b.vy*c, t };
      }
      const m = memo[i], dt = t - m.t;
      return { x:Math.max(2, Math.min(cols-2, m.x + m.vx*dt)), y:Math.max(2, Math.min(rows-2, m.y + m.vy*dt)), vx:m.vx, vy:m.vy };
    });
  }

  function miteNear(s, x, y, rad, ahead){
    for (const m of s.land){
      const age = t - s.t + ahead, mx = m.x + m.vx*age, my = m.y + m.vy*age;
      if (Math.abs(mx - (x+0.5)) < rad && Math.abs(my - (y+0.5)) < rad) return true;
    }
    return false;
  }

  function planOnLand(s){
    const P = S.player, sp = S.params.playerSpeed;
    const balls = seen(s);
    // кандидаты: клетки суши у кромки моря в радиусе ходьбы
    const dist = new Map(); const q = [[P.x, P.y, 0]]; dist.set(P.y*cols+P.x, 0);
    const cands = [];
    for (let qi = 0; qi < q.length; qi++){
      const [x, y, d] = q[qi]; if (d > 40) continue;
      for (const v of DIRS){ if (at(x+v[0], y+v[1]) === FREE) cands.push([x, y, v, d]); }
      for (const [dx,dy] of DIRS){ const nx=x+dx, ny=y+dy, k=ny*cols+nx; if (at(nx,ny)===LAND && !dist.has(k)){ dist.set(k,d+1); q.push([nx,ny,d+1]); } }
    }
    if (!cands.length) return null;
    // равномерная выборка кандидатов (не больше ~36 стартов)
    const stride = Math.max(1, Math.floor(cands.length / 24)), off = Math.floor(brng()*stride);
    const preds = balls.map(b => predictBall(b, 3.5));
    const sizes = [[2,5],[4,8],[5,14],[8,10],[8,20],[12,16],[14,26]];
    const safe = [];
    for (let ci = off; ci < cands.length; ci += stride){
      const [x, y, dir, d] = cands[ci];
      const walkT = d / sp;
      for (const side of [[dir[1], dir[0]], [-dir[1], -dir[0]]]){
        for (const [dd, mm] of sizes){
          const cut = buildCut(x, y, dir, side, dd, mm); if (!cut) continue;
          const T = walkT + cut.moves.length / sp;
          if (!safeCut(cut, preds, walkT)) continue;
          if (miteNear(s, cut.ex, cut.ey, 2.5, T)) continue;
          safe.push({ x, y, cut, d, T, proxy: (dd*mm + cut.cells.length) / (T + 1) });
        }
      }
    }
    // точную площадь считаем только для самых «прямоугольно» выгодных (как глазомер игрока)
    safe.sort((a, b) => b.proxy - a.proxy);
    let best = null;
    for (let i = 0; i < safe.length && i < 16; i++){
      const c = safe[i], gain = gainOf(c.cut.cells, balls); if (gain < 8) continue;
      c.val = gain / (c.T + 1.0) - c.cut.cells.length*0.15;
      if (!best || c.val > best.val) best = c;
    }
    return best;
  }

  function decide(){
    const P = S.player, s = stale();
    if (S.phase !== 'play'){ plan = null; game.setDir(0,0); return; }
    if (P.trailing){
      // в поле: следим, не подлетает ли шар к следу/резцу
      const balls = seen(s);
      const preds = balls.map(b => predictBall(b, 0.6));
      let danger = false;
      for (const pr of preds){ for (const [bx,by] of pr){
        if (Math.abs(bx - (P.x+0.5)) < margin+0.5 && Math.abs(by - (P.y+0.5)) < margin+0.5) danger = true;
        for (const key of S.trail){ const cx = key % cols + 0.5, cy = (key/cols|0) + 0.5; if (Math.abs(cx-bx) < margin*0.8 && Math.abs(cy-by) < margin*0.8){ danger = true; break; } }
        if (danger) break; } if (danger) break; }
      if (!plan || (danger && plan.kind !== 'escape')){
        const rem = plan && plan.kind === 'cut' ? plan.moves.length - plan.i : 1e9;
        const esc = bfs(P.x, P.y, c => c === FREE, (x,y) => at(x,y) === LAND, 4000);
        if (esc && esc.length < rem) plan = { kind:'escape', moves:esc, i:0 };
      }
      return;
    }
    // на суше
    if (miteNear(s, P.x, P.y, 3.2, 0.25)){
      // уходим от клеща по суше (или ныряем в поле — риск)
      let bestM = null, bestD = -1;
      for (const [dx,dy] of DIRS){ const c = at(P.x+dx, P.y+dy); if (c !== LAND) continue;
        let md = 1e9; for (const m of s.land){ const age = t-s.t+0.2; md = Math.min(md, Math.hypot(m.x+m.vx*age-(P.x+dx+0.5), m.y+m.vy*age-(P.y+dy+0.5))); }
        if (md > bestD){ bestD = md; bestM = [dx,dy]; } }
      if (bestM){ plan = { kind:'walk', moves:[bestM, bestM], i:0, flee:true }; return; }
    }
    if (plan && plan.kind === 'walk' && !plan.flee && plan.i < plan.moves.length) return;
    if (!plan && t < holdT) return;                       // ждём, пока шары отойдут
    if (plan && plan.kind === 'cut' && plan.i === 0){
      const balls = seen(s);
      if (safeCut(plan.cut, balls.map(b => predictBall(b, 3.5)), 0)) return;   // всё ещё безопасно — пошли
      plan = null;
    }
    const best = planOnLand(s);
    if (!best){
      if (waitStart < 0) waitStart = t;
      bold = t - waitStart > patT ? 0.55 : 1;
      game.setDir(0,0); plan = null; holdT = t + 0.3; return;
    }
    waitStart = -1; bold = 1; patT = patience[0] + brng()*(patience[1]-patience[0]);
    if (best.x === P.x && best.y === P.y) plan = { kind:'cut', moves:best.cut.moves, i:0, cut:best.cut };
    else {
      const walk = bfs(P.x, P.y, c => c === LAND, (x,y) => x === best.x && y === best.y, 6000);
      plan = walk ? { kind:'walk', moves:walk, i:0 } : null;
    }
  }

  let lastPos = -1;
  while (t < maxT && !S.over){
    hist.push({ t, sea:S.sea.map(b=>({x:b.x,y:b.y,vx:b.vx,vy:b.vy})), land:S.land.map(m=>({x:m.x,y:m.y,vx:m.vx,vy:m.vy})) });
    if (hist.length > 30) hist.shift();
    if (t >= nextDecide){ decide(); nextDecide = t + decideDt*(0.8 + brng()*0.4); }
    // исполнение плана: ход сменяется, когда резец сделал шаг
    const P = S.player, pos = P.y*cols + P.x;
    if (plan && S.phase === 'play'){
      if (lastPos !== -1 && pos !== lastPos) plan.i++;
      if (plan.i >= plan.moves.length){ plan = null; game.setDir(0,0); }
      else { const v = plan.moves[plan.i]; game.setDir(v[0], v[1]); }
    } else if (!P.trailing) game.setDir(0,0);
    lastPos = S.phase === 'play' ? pos : -1;
    if (S.phase !== 'play') plan = null;
    game.update(h); t += h;
    maxLevel = Math.max(maxLevel, S.level);
  }
  const passed = S.won ? levels : S.level - 1;
  return { seed, won: S.won, passed, level: S.level, lives: S.lives, score: S.score, pct: S.pct, t, react, deaths, lost: lostBy };
}
