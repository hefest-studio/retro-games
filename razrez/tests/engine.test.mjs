/* РАЗРЕЗ · tests/engine.test.mjs — автотесты логики (Node, без зависимостей).
   Запуск: node razrez/tests/engine.test.mjs. Движок в node:vm с шимом window. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const sandbox = { window: null, globalThis: null, console, Math, Array, Uint8Array };
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/game.js'), 'utf8'), sandbox, { filename: 'game.js' });
const R = sandbox.RAZREZ;
const L = R.logic;

let passed = 0, failed = 0;
function test(name, fn){ try { fn(); passed++; console.log('ok   '+name); } catch(e){ failed++; console.log('FAIL '+name+' — '+e.message); } }
function eq(a,b,m){ if(a!==b) throw new Error((m||'')+' ждали '+JSON.stringify(b)+', получили '+JSON.stringify(a)); }
function ok(c,m){ if(!c) throw new Error(m||'ложь'); }
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

// Сетка из строк: '#' — суша, '.' — море, '*' — след
function gridFrom(lines){ const rows=lines.length, cols=lines[0].length, g=new Uint8Array(cols*rows);
  for(let y=0;y<rows;y++) for(let x=0;x<cols;x++){ const ch=lines[y][x]; g[y*cols+x]= ch==='#'?1: ch==='*'?2:0; }
  return { g, cols, rows }; }
function countVal(g,v){ let n=0; for(const c of g) if(c===v) n++; return n; }

// Прогон игры: шаги по 1/60 c, пока держим направление
function run(game, dx, dy, steps){ game.setDir(dx,dy); for(let i=0;i<steps;i++) game.update(1/60); }
function toPlay(game){ const S=game._S; S.phase='play'; S.phaseT=0; }

test('заливка: область без врага захватывается, с врагом — нет', () => {
  const { g, cols, rows } = gridFrom([
    '#########',
    '#...#...#',
    '#...#...#',
    '#...#...#',
    '#########',
  ]);
  const r = L.floodCapture(g, cols, rows, [{ x: 2, y: 2 }]);    // враг слева
  eq(r.count, 9, 'захвачено клеток');
  eq(g[2*cols+6], 1, 'правая область должна стать сушей');
  eq(g[2*cols+2], 0, 'левая область (с врагом) не должна заливаться');
  eq(r.mask[2*cols+6], 1, 'маска новых клеток');
});

test('заливка: две области с врагами — ничего не захвачено', () => {
  const { g, cols, rows } = gridFrom(['#######','#..#..#','#..#..#','#######']);
  const r = L.floodCapture(g, cols, rows, [{ x: 1, y: 1 }, { x: 5, y: 2 }]);
  eq(r.count, 0); eq(countVal(g,0), 8);
});

test('заливка: без врагов захватывается всё море; диагональ не соединяет', () => {
  const a = gridFrom(['#####','#...#','#####']);
  eq(L.floodCapture(a.g, a.cols, a.rows, []).count, 3);
  // области соприкасаются только по диагонали — враг в одной не защищает другую
  const b = gridFrom(['####','#.##','##.#','####']);
  const r = L.floodCapture(b.g, b.cols, b.rows, [{ x: 1, y: 1 }]);
  eq(r.count, 1, 'диагональная клетка должна залиться'); eq(b.g[2*4+2], 1);
});

test('процент захвата: рамка не считается, половина — 50%', () => {
  const { g, cols, rows } = gridFrom(['######','######','##..##','##..##','######','######']);
  eq(L.percent(g, cols, rows, 2), 0);
  g[2*cols+2]=1; g[3*cols+2]=1;
  eq(L.percent(g, cols, rows, 2), 50);
});

test('старт: рамка — суша, 0%, резец на кромке, враги по параметрам уровня', () => {
  const game = R.Game({ rng: mulberry32(1) }).start(); const S = game._S;
  eq(S.pct, 0); eq(S.grid[0], 1); eq(S.grid[5*S.cols+5], 0);
  eq(S.grid[S.player.y*S.cols+S.player.x], 1, 'резец на суше');
  eq(S.sea.length, L.levelParams(1).sea); eq(S.land.length, 0, 'на 1 уровне нет клещей');
});

test('сложность растёт: больше и быстрее врагов', () => {
  const p1 = L.levelParams(1), p5 = L.levelParams(5);
  ok(p5.sea > p1.sea, 'шаров больше'); ok(p5.seaSpeed > p1.seaSpeed, 'шары быстрее');
  ok(p5.land > p1.land, 'клещей больше'); ok(p5.landSpeed > p1.landSpeed, 'клещи быстрее');
  for (let lv=1; lv<5; lv++) ok(L.levelParams(lv+1).seaSpeed >= L.levelParams(lv).seaSpeed, 'монотонность');
});

test('разрез: проход клавишами отрезает угол, процент растёт, шар не заливается', () => {
  const game = R.Game({ rng: mulberry32(3) }).start(); const S = game._S; toPlay(game);
  S.sea = [{ x: 60.5, y: 40.5, vx: 0, vy: 0 }];      // неподвижный шар справа внизу
  S.player.x = 10; S.player.y = 1;
  run(game, 0, 1, 4);                                   // вниз в море
  ok(S.player.trailing, 'должен тянуться след');
  run(game, 0, 0, 30);                                  // в море движется сам (клавиши отпущены)
  run(game, -1, 0, 60);                                 // влево до рамки
  eq(S.player.trailing, false, 'след должен замкнуться');
  ok(S.pct > 1, 'процент вырос: '+S.pct.toFixed(2));
  ok(S.score > 0, 'очки начислены');
  eq(S.grid[40*S.cols+60], 0, 'область с шаром осталась морем');
  eq(countVal(S.grid, 2), 0, 'следа не осталось');
});

test('шар касается следа → потеря жизни, след стирается', () => {
  const game = R.Game({ rng: mulberry32(4) }).start(); const S = game._S; toPlay(game);
  S.sea = [{ x: 30.5, y: 20.5, vx: 0, vy: 0 }];
  S.player.x = 30; S.player.y = 1;
  run(game, 0, 1, 10); ok(S.player.trailing);
  // ведём след прямо на шар
  run(game, 0, 0, 90);
  eq(S.lives, 2, 'жизнь потеряна'); eq(S.phase, 'dead'); eq(countVal(S.grid, 2), 0, 'след стёрт');
  run(game, 0, 0, 80);                                  // респаун
  eq(S.phase, 'play'); eq(S.grid[S.player.y*S.cols+S.player.x], 1, 'резец вернулся на сушу');
});

test('столкновение со своим следом → потеря жизни', () => {
  const game = R.Game({ rng: mulberry32(5) }).start(); const S = game._S; toPlay(game);
  S.sea = [{ x: 70.5, y: 45.5, vx: 0, vy: 0 }];
  S.player.x = 20; S.player.y = 1;
  run(game, 0, 1, 24);                                  // вниз ~6 клеток
  run(game, 1, 0, 12); run(game, 0, -1, 8); run(game, -1, 0, 30);  // петля в свой след
  eq(S.lives, 2, 'должен погибнуть от своего следа');
});

test('разворот на 180° во время следа игнорируется', () => {
  const game = R.Game({ rng: mulberry32(6) }).start(); const S = game._S; toPlay(game);
  S.sea = [{ x: 70.5, y: 45.5, vx: 0, vy: 0 }];
  S.player.x = 20; S.player.y = 1;
  run(game, 0, 1, 16); const y0 = S.player.y;
  run(game, 0, -1, 8);
  ok(S.player.y > y0, 'резец продолжил вниз'); eq(S.lives, 3);
});

test('клещ на суше задевает резец → потеря жизни', () => {
  const game = R.Game({ rng: mulberry32(7) }).start(); const S = game._S; toPlay(game);
  S.sea = [];
  S.land = [{ x: S.player.x + 0.5, y: 0.5, vx: 0, vy: 0 }];
  game.update(1/60); eq(S.lives, 2);
});

test('шары не заходят на сушу, клещи — в море (2000 кадров)', () => {
  const game = R.Game({ rng: mulberry32(8), level: 5 }).start(); const S = game._S; toPlay(game);
  S.player.x = 0; S.player.y = 0; S.inv = 1e9;          // резец в углу, неуязвим к клещам
  for (let i=0;i<2000;i++){ game.update(1/60);
    for (const b of S.sea) ok(S.grid[Math.floor(b.y)*S.cols+Math.floor(b.x)] !== 1, 'шар на суше');
    for (const m of S.land) ok(S.grid[Math.floor(m.y)*S.cols+Math.floor(m.x)] === 1, 'клещ в море');
  }
});

test('≥75% → уровень пройден, следующий уровень строится заново', () => {
  const events=[]; const game = R.Game({ rng: mulberry32(9), onEvent: t=>events.push(t) }).start(); const S = game._S; toPlay(game);
  S.sea = [{ x: 70.5, y: 45.5, vx: 0, vy: 0 }];
  // залить почти всё поле, кроме угла с шаром
  for (let y=2;y<S.rows-2;y++) for (let x=2;x<S.cols-2;x++) if (x<62 || y<38) S.grid[y*S.cols+x]=1;
  S.player.trailing = true; game._close();
  ok(S.pct >= 75, 'pct '+S.pct); eq(S.phase, 'clear'); ok(events.includes('clear'));
  for (let i=0;i<200;i++) game.update(1/60);
  eq(S.level, 2); eq(S.pct, 0); ok(events.includes('level')); eq(S.land.length, L.levelParams(2).land);
  eq(S.lives, 4, 'бонусная жизнь за уровень');
  eq(countVal(S.grid, 1), 2*S.cols*2 + 2*(S.rows-4)*2, 'новое поле — только рамка');
});

test('победа после последнего уровня', () => {
  const events=[]; const game = R.Game({ rng: mulberry32(10), level: 5, onEvent: t=>events.push(t) }).start(); const S = game._S; toPlay(game);
  S.sea = [{ x: 70.5, y: 45.5, vx: 0, vy: 0 }];
  for (let y=2;y<S.rows-2;y++) for (let x=2;x<S.cols-2;x++) if (x<62 || y<38) S.grid[y*S.cols+x]=1;
  game._close();
  for (let i=0;i<200;i++) game.update(1/60);
  ok(S.won && S.over, 'должна быть победа'); ok(events.includes('win'));
});

test('поражение: 3 смерти → gameover', () => {
  const events=[]; const game = R.Game({ rng: mulberry32(11), onEvent: t=>events.push(t) }).start(); const S = game._S;
  for (let k=0;k<3;k++){ toPlay(game); game._die('test'); for (let i=0;i<80;i++) game.update(1/60); }
  eq(S.lives, 0); ok(S.over && !S.won, 'должен быть конец игры'); ok(events.includes('gameover'));
});

test('difficulty-хук: параметры берутся из переданной функции', () => {
  const calls=[]; const game = R.Game({ rng: mulberry32(12), level: 3, difficulty:(lv,b,s,m)=>{ calls.push(lv); return b+(lv-1)*s; } }).start();
  ok(calls.length>0 && calls.every(v=>v===3), 'хук вызван с уровнем 3'); eq(game._S.sea.length, 4);
});

console.log((failed? 'FAIL ':'OK ')+passed+'/'+(passed+failed));
process.exit(failed?1:0);
