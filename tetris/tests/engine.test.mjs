/* TETRIS · tests/engine.test.mjs — автотесты логики (Node, без зависимостей).
   Запуск: node tetris/tests/engine.test.mjs. Движок в node:vm с шимом window. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const sandbox = { window: null, globalThis: null, console, Math, Array };
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/game.js'), 'utf8'), sandbox, { filename: 'game.js' });
const TT = sandbox.TT;

let passed = 0, failed = 0;
function test(name, fn){ try { fn(); passed++; console.log('ok   '+name); } catch(e){ failed++; console.log('FAIL '+name+' — '+e.message); } }
function eq(a,b,m){ if(a!==b) throw new Error((m||'')+' ждали '+JSON.stringify(b)+', получили '+JSON.stringify(a)); }
function ok(c,m){ if(!c) throw new Error(m||'ложь'); }
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

test('размеры поля 10×20', () => { const g=TT.Game(); eq(g.COLS,10); eq(g.ROWS,20); });

test('старт даёт фигуру и пустое поле 20×10', () => {
  const g=TT.Game(); g.start(); const s=g.state();
  ok(s.cur, 'нет текущей фигуры'); eq(s.board.length,20); eq(s.board[0].length,10);
  let filled=0; s.board.forEach(r=>r.forEach(c=>{ if(c) filled++; })); eq(filled,0,'поле не пустое');
});

test('7-bag: 7 подряд фигур — перестановка 7 типов', () => {
  const g=TT.Game({rng:mulberry32(42)}); g.start();
  const seen={}; for(let i=0;i<7;i++){ const t=g.state().cur.type; seen[t]=(seen[t]||0)+1; g.hardDrop(); }
  eq(Object.keys(seen).length,7,'в мешке не 7 уникальных'); Object.values(seen).forEach(v=>eq(v,1,'тип повторился в мешке'));
});

test('движение влево/вправо на 1 клетку', () => {
  const g=TT.Game({rng:mulberry32(1)}); g.start(); const x0=g.state().cur.x;
  g.left(); eq(g.state().cur.x, x0-1, 'влево');
  g.right(); g.right(); eq(g.state().cur.x, x0+1, 'вправо');
});

test('4×rotateCW возвращает исходную матрицу (инвариант)', () => {
  const g=TT.Game({rng:mulberry32(7)}); g.start();
  const before=JSON.stringify(g.state().cur.m);
  g.rotateCW(); g.rotateCW(); g.rotateCW(); g.rotateCW();
  eq(JSON.stringify(g.state().cur.m), before, 'после 4 поворотов форма не совпала');
});

test('очистка заполненной линии: +1 линия, счёт растёт, ряд уходит', () => {
  const g=TT.Game(); g.start(); const S=g._S;
  for(let x=0;x<10;x++) S.board[19][x]=3;              // заполнить нижний ряд
  const sc0=S.score, ln0=S.lines;
  const n=g._clearLines();
  eq(n,1,'очищена не 1 линия'); eq(S.lines,ln0+1,'lines'); ok(S.score>sc0,'счёт не вырос');
  let bottomFilled=0; for(let x=0;x<10;x++) if(S.board[19][x]) bottomFilled++; eq(bottomFilled,0,'ряд не сдвинулся');
});

test('double/triple/tetris по таблице счёта (×уровень+1)', () => {
  const g=TT.Game(); g.start(); const S=g._S; S.score=0; S.lines=0; S.level=0;
  for(let y=16;y<20;y++) for(let x=0;x<10;x++) S.board[y][x]=1;  // 4 полные линии
  g._clearLines(); eq(S.score, 800, 'tetris (4 линии) должен дать 800 на уровне 0');
});

test('game over: спавн в занятую зону → over', () => {
  const g=TT.Game(); g.start(); const S=g._S;
  for(let x=0;x<10;x++){ S.board[0][x]=1; S.board[1][x]=1; }   // забить верх
  g._spawn(); ok(S.over, 'ожидали game over');
});

test('коллизия со стеной/полом', () => {
  const g=TT.Game({rng:mulberry32(3)}); g.start();
  ok(g._collides(g.state().cur.m, -5, 0), 'за левой стеной нет коллизии');
  ok(g._collides(g.state().cur.m, 0, 30), 'за полом нет коллизии');
});

console.log((failed? 'FAIL ':'OK ')+passed+'/'+(passed+failed));
process.exit(failed?1:0);
