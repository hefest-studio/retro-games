/* КАСКАД · tests/engine.test.mjs — автотесты логики (Node, без зависимостей).
   Запуск: node kaskad/tests/engine.test.mjs. Движок в node:vm с шимом window. */
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
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/daily.js'), 'utf8'), sandbox, { filename: 'daily.js' });
const TT = sandbox.TT;
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const STR = vm.runInNewContext('(' + /const STR = (\{[\s\S]*?\n\});/.exec(HTML)[1] + ')');
const { checkLangs } = await import('./langs.check.mjs');

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

test('double/triple/quad по таблице счёта (×уровень+1)', () => {
  const g=TT.Game(); g.start(); const S=g._S; S.score=0; S.lines=0; S.level=0;
  for(let y=16;y<20;y++) for(let x=0;x<10;x++) S.board[y][x]=1;  // 4 полные линии
  g._clearLines(); eq(S.score, 800, 'quad (4 линии) должен дать 800 на уровне 0');
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

test('реклама за награду: revive после game over очищает верх и продолжает; повторный revive без game over — false', () => {
  const g=TT.Game({rng:mulberry32(5)}); g.start(); const S=g._S;
  for(let y=0;y<20;y++) for(let x=0;x<10;x++) if(x!==y%10) S.board[y][x]=1;
  g._spawn(); ok(S.over, 'game over'); ok(g.revive(), 'revive');
  ok(!S.over && S.cur, 'продолжили'); for(let y=0;y<10;y++) ok(S.board[y].every(c=>!c), 'верх пуст '+y);
  eq(g.revive(), false, 'без game over revive не действует');
  const w=TT.Game(); w.start(); w._S.over=true; w._S.won=true; eq(w.revive(), false, 'после победы — нет');
});
test('бонус за рекламу: clearBottom(2) убирает 2 нижних ряда без очков; filledRows', () => {
  const g=TT.Game({rng:mulberry32(9)}); g.start(); const S=g._S;
  for(let x=0;x<9;x++){ S.board[19][x]=1; S.board[18][x]=2; S.board[17][x]=3; }
  eq(g.filledRows(),3); const sc=S.score; g.clearBottom(2); eq(g.filledRows(),1); eq(S.board[19][0],3,'третий ряд опустился'); eq(S.score,sc,'без очков');
});

// ---------- испытание дня (мета-прогрессия) ----------
function memStore(init){ const m=new Map(Object.entries(init||{})); return { m, get:k=>m.has(k)?m.get(k):null, set:(k,v)=>m.set(k,String(v)) }; }
function seq(rng, n){ const g=TT.Game({rng}); g.start(); const out=[]; for(let i=0;i<n;i++){ out.push(g.state().cur.type); g._S.board=g._S.board.map(r=>r.fill(0)); g.hardDrop(); } return out.join(''); }
test('испытание дня: дата → YYYYMMDD по местному времени; вчера через границы месяца/года', () => {
  eq(TT.daily.dateKey(new Date(2026,10,20,0,5).getTime()), 20261120); eq(TT.daily.dateKey(new Date(2026,10,20,23,59).getTime()), 20261120);
  eq(TT.daily.dateKey(Date.UTC(2026,10,20,21,30), 3), 20261121, 'UTC+3: 00:30 МСК — уже 21-е'); eq(TT.daily.dateKey(Date.UTC(2026,10,20,20,30), 3), 20261120);
  eq(TT.daily.prevDay(20261201), 20261130); eq(TT.daily.prevDay(20270101), 20261231); eq(TT.daily.prevDay(20240301), 20240229); eq(TT.daily.label(20260305), '05.03');
});
test('испытание дня: одна дата → одна и та же последовательность фигур (50 фигур, два независимых запуска); другая дата — другая', () => {
  const st=memStore(), a=TT.daily.Daily(st,20261120), b=TT.daily.Daily(memStore(),20261120), c=TT.daily.Daily(st,20261121);
  const sa=seq(a.rng(),50), sb=seq(b.rng(),50), sc=seq(c.rng(),50);
  eq(sa, sb, 'тот же день'); ok(sa!==sc, 'соседний день совпал'); eq(sa.length, 50);
  ok(new Set([20261120,20261121,20261122,20261123,20261124].map(TT.daily.seed)).size===5, 'сиды дней различны');
  const d=TT.daily.Daily(memStore(),20261120); eq(seq(d.rng(),14), seq(d.rng(),14), 'rng() каждый раз с начала');
});
test('испытание дня: рекорд дня сохраняется и восстанавливается из хранилища; новый день — с нуля', () => {
  const st=memStore(); let d=TT.daily.Daily(st,20261120);
  eq(d.best(),0); let r=d.submit(4820); eq(r.best,4820); ok(r.isNew,'новый');
  r=d.submit(1000); eq(r.best,4820); ok(!r.isNew,'меньший счёт — не рекорд');
  d=TT.daily.Daily(memStore(Object.fromEntries(st.m)),20261120); eq(d.best(),4820,'после перезапуска (копия хранилища)');
  const n=TT.daily.Daily(st,20261121); eq(n.best(),0,'завтра пусто'); n.submit(300); eq(n.best(),300); eq(TT.daily.Daily(st,20261120).best(),0,'вчерашний вытеснен (одно число)');
});
test('испытание дня: число рекорда растёт со временем — облачное слияние max (g.persist) берёт свежий день и больший счёт', () => {
  const a=memStore(), b=memStore(); TT.daily.Daily(a,20261120).submit(9000); TT.daily.Daily(b,20261121).submit(10);
  const merged=String(Math.max(parseFloat(a.get(TT.daily.KEY_BEST)), parseFloat(b.get(TT.daily.KEY_BEST))));
  eq(TT.daily.Daily(memStore({[TT.daily.KEY_BEST]:merged}),20261121).best(),10,'свежий день важнее большого вчерашнего');
  ok(parseFloat(merged)<2**53,'точность double');
});
test('испытание дня: серия дней подряд (+1 за следующий день, пропуск — заново, повтор в тот же день — без изменений)', () => {
  const st=memStore(); eq(TT.daily.Daily(st,20261130).submit(1).streak,1);
  eq(TT.daily.Daily(st,20261130).submit(5).streak,1,'тот же день');
  eq(TT.daily.Daily(st,20261201).submit(1).streak,2,'через месяц');
  eq(TT.daily.Daily(st,20261202).streak(),2,'сегодня ещё не играл — серия вчерашняя');
  eq(TT.daily.Daily(st,20261204).streak(),0,'пропуск'); eq(TT.daily.Daily(st,20261204).submit(1).streak,1);
});
test('страница: daily.js после game.js (lang-x/i18n-x — нет); «Испытание дня», g.persist, серверное время; площадка v2.8 — лидеры kaskad/kaskadDaily, без рекламы, свои игры, ярлык, оценка, облако, P на паузе', () => {
  const src=[...HTML.matchAll(/<script src="\.\/([^"]+)"/g)].map(m=>m[1]); eq(src.join(','),'engine.js,js/music.js,js/game.js,js/daily.js');
  ok(/key:'daily'/.test(HTML) && /g\.persist\(TT\.daily\.KEY_BEST,'max'\)/.test(HTML), 'испытание/облако');
  ok(/typeof P\.serverTime==='function'/.test(HTML) && !/ArcadeLangX/.test(HTML), 'серверное время, без lang-x');
  ok(/g\.useLeaderboard\(\{[^\n]*id:'kaskad'[^\n]*id:'kaskadDaily'/.test(HTML) && /g\.leaderboard\.submit\(score\|0,\{ board \}\)/.test(HTML), 'лидеры');
  ok(/g\.useNoAds\(\{ scene:\['title','pause'\], after:'end' \}\)/.test(HTML) && /g\.useOwnGames\(\)/.test(HTML) && /g\.useShortcut\(\)/.test(HTML) && /g\.useReview\(/.test(HTML) && /g\.onCloud\(/.test(HTML), 'площадка');
  ok(/g\.scenes\.pause\.press=function\(a\)\{ if\(a==='pause'\) this\.goto\('play',\{resume:true\}\)/.test(HTML), 'P на паузе — в игру');
  ok(/data-tr=/.test(HTML) && /data-es=/.test(HTML) && /data-pt=/.test(HTML), 'подписи страницы TR/ES/PT');
});
await checkLangs({ ROOT, test, ok, eq, STR, title: 'CASCADE' });

console.log((failed? 'FAIL ':'OK ')+passed+'/'+(passed+failed));
process.exit(failed?1:0);
