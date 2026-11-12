/* РОЙ · tests/engine.test.mjs — автотесты логики (Node, без зависимостей).
   Запуск: node roy/tests/engine.test.mjs. Движок в node:vm с шимом window. */
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
const R = sandbox.ROY;
const C = R.consts;

let passed = 0, failed = 0;
function test(name, fn){ try { fn(); passed++; console.log('ok   '+name); } catch(e){ failed++; console.log('FAIL '+name+' — '+e.message); } }
function eq(a,b,m){ if(a!==b) throw new Error((m||'')+' ждали '+JSON.stringify(b)+', получили '+JSON.stringify(a)); }
function ok(c,m){ if(!c) throw new Error(m||'ложь'); }
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function run(g, sec, h=1/60){ for(let t=0;t<sec;t+=h) g.update(h); }
// Новая игра, строй уже собран (пропускаем заход), события пишутся в журнал.
function ready(seed=1, extra={}){
  const ev=[]; const g=R.Game(Object.assign({ rng:mulberry32(seed), onEvent:(t,d)=>ev.push([t,d]) }, extra)); g.start();
  const S=g._S; S.enemies.forEach(e=>{ e.state='form'; const s=g._slot(e.row,e.col); e.x=s.x; e.y=s.y; });
  S.phase='fight'; S.diveT=999; S.formFireT=999;
  return { g, S, ev };
}
const has=(ev,t)=>ev.some(e=>e[0]===t);

test('старт: волна 1, 3 жизни, счёт 0, 18 врагов', () => {
  const g=R.Game({rng:mulberry32(1)}); g.start(); const S=g.state();
  eq(S.wave,1); eq(S.lives,3); eq(S.score,0); eq(S.enemies.length,18); ok(S.player.alive);
});

test('волн ≥ 5, численность строя не убывает', () => {
  ok(C.WAVES>=5, 'меньше 5 волн');
  let prev=0; for(let w=1;w<=C.WAVES;w++){ const n=C.countLayout(w); ok(n>=prev, 'волна '+w+' меньше предыдущей'); prev=n; }
});

test('«дыхание» строя: ячейки двигаются и не выходят за экран', () => {
  const g=R.Game(); g.start(); const S=g._S;
  const a=g._slot(0,0); S.t=1.0; const b=g._slot(0,0); ok(a.x!==b.x, 'строй неподвижен');
  for(let t=0;t<30;t+=0.05){ S.t=t; for(const c of [0,7]){ const s=g._slot(4,c); ok(s.x>16 && s.x<C.W-16, 'ячейка вне экрана x='+s.x); } }
});

test('заход: через ~6 с весь строй на местах, фаза fight', () => {
  const g=R.Game({rng:mulberry32(2)}); g.start(); run(g, 6.5);
  const S=g._S; ok(S.enemies.every(e=>e.state!=='wait' && e.state!=='enter'), 'кто-то ещё заходит'); eq(S.phase,'fight');
});

test('сложность растёт с волной (через diff)', () => {
  const g=R.Game(); g.start(); const p1=g.params(); g._S.wave=5; const p5=g.params();
  ok(p5.diveEvery<p1.diveEvery, 'пике не чаще'); ok(p5.maxDivers>p1.maxDivers, 'пикирующих не больше');
  ok(p5.diveSpeed>p1.diveSpeed && p5.eBulletV>p1.eBulletV, 'скорости не растут'); eq(p1.formFireEvery,0,'в 1-й волне строй не стреляет');
});

test('коллизия: пуля сбивает Спору в строю → +50', () => {
  const { g, S, ev } = ready();
  const e=S.enemies.find(x=>x.kind==='spore'); S.player.x=e.x;
  S.pb.push({ x:e.x, y:e.y+20, vy:-580 }); g.update(0.1);
  eq(e.state,'dead','не убит'); eq(S.score,50); ok(has(ev,'kill'));
});

test('Медуза выдерживает 2 попадания', () => {
  const { g, S } = ready();
  const m=S.enemies.find(x=>x.kind==='medusa');
  g._damage(m); ok(m.state!=='dead' && m.hurt, 'умерла с 1 попадания'); g._damage(m); eq(m.state,'dead');
});

test('враг в пике даёт больше очков', () => {
  const { g, S } = ready();
  const e=S.enemies.find(x=>x.kind==='wedge'); g._startDive(e,false); run(g, 1.0);
  g._damage(e); eq(S.score, C.KINDS.wedge.divePts);
});

test('лимит пуль: удержание огня — не больше 2 пуль', () => {
  const { g, S } = ready(); S.enemies.forEach(e=>e.state='dead'); S.enemies.push({ state:'form', row:0,col:0,x:-500,y:-500,r:1, kind:'spore', id:999, hp:1 });
  g.setFire(true); let mx=0; for(let i=0;i<60;i++){ g.update(1/60); mx=Math.max(mx,S.pb.length); }
  ok(mx<=2 && mx>0, 'пуль в полёте: '+mx);
});

test('движение игрока ограничено краями экрана', () => {
  const { g, S } = ready(); g.setDir(-1); run(g, 3); ok(S.player.x>=18 && S.player.x<40); g.setDir(1); run(g, 4); ok(S.player.x<=C.W-18);
});

test('вражеская пуля: −1 жизнь, затем возрождение с неуязвимостью', () => {
  const { g, S, ev } = ready();
  S.eb.push({ x:S.player.x, y:C.PLAYER_Y-5, vx:0, vy:200 }); g.update(1/60);
  eq(S.lives,2); ok(!S.player.alive); ok(has(ev,'die'));
  run(g, 2.6); ok(S.player.alive, 'не возродился'); ok(S.player.inv>0, 'нет неуязвимости');
});

test('двойной корабль: попадание снимает корпус, а не жизнь', () => {
  const { g, S, ev } = ready(); S.player.dual=true; S.player.x=200;
  g._hitPlayer(200+C.HULL_GAP); eq(S.lives,3); ok(!S.player.dual && S.player.alive); ok(has(ev,'hull'));
});

test('луч Медузы захватывает корабль, отбив в полёте → двойной корабль', () => {
  const { g, S, ev } = ready(3);
  const m=S.enemies.find(x=>x.kind==='medusa'); S.player.x=m.x+20; g._startDive(m,true);
  S.enemies.forEach(e=>{ if(e!==m) e.state='dead'; });
  // держим игрока под Медузой
  for(let t=0;t<6 && !has(ev,'captured');t+=1/60){ if(S.player.alive) S.player.x=m.x; g.update(1/60); }
  ok(has(ev,'captured'),'захвата не было'); eq(S.lives,2);
  run(g, 1.6); ok(m.carry,'Медуза не несёт корабль');
  run(g, 4); ok(S.player.alive,'новый корабль не появился');
  // Медуза в пике с пленником — сбиваем
  m.hp=1; if(m.state==='form') g._startDive(m,false); run(g,0.3); g._damage(m); ok(S.rescue,'пленник не освобождён');
  S.player.inv=0; run(g, 4); ok(S.player.dual,'нет двойного корабля'); ok(has(ev,'rescue'));
});

test('зачистка волны → следующая волна', () => {
  const { g, S, ev } = ready(); S.enemies.forEach(e=>e.state='dead'); g.update(1/60);
  eq(S.phase,'clear'); run(g, 2.2); eq(S.wave,2); ok(has(ev,'wave'));
});

test('после последней волны — победа', () => {
  const { g, S, ev } = ready(1, { startWave: C.WAVES });
  S.enemies.forEach(e=>e.state='dead'); run(g, 2.5); ok(has(ev,'win'),'нет win'); ok(S.won && S.over);
});

test('3 потери — конец игры', () => {
  const { g, S, ev } = ready();
  for(let k=0;k<3;k++){ S.player.inv=0; S.player.alive=true; g._hitPlayer(S.player.x); }
  eq(S.lives,0); run(g, 2.5); ok(has(ev,'gameover'),'нет gameover'); ok(S.over && !S.won);
});

// Проходимость: простой бот (держится под ближайшим врагом, уходит от пуль, стреляет)
function bot(seed, waves=1, maxT=150){
  const ev=[]; const g=R.Game({ rng:mulberry32(seed), onEvent:(t)=>ev.push(t) }); g.start(); const S=g._S;
  let t=0; const h=1/60;
  while(t<maxT && !S.over && S.wave<=waves && !(S.wave===waves && S.phase==='clear')){
    const p=S.player; let tx=p.x;
    const live=S.enemies.filter(e=>e.state==='form'||e.state==='dive'||e.state==='return');
    if(live.length){ live.sort((a,b)=>Math.abs(a.x-p.x)-Math.abs(b.x-p.x)); tx=live[0].x; }
    // уклонение
    for(const q of S.eb){ if(q.y>C.PLAYER_Y-140 && q.y<C.PLAYER_Y && Math.abs(q.x-p.x)<22) tx = q.x>p.x ? p.x-60 : p.x+60; }
    for(const e of S.enemies){ if(e.state==='dive' && e.y>C.PLAYER_Y-170 && Math.abs(e.x-p.x)<34) tx = e.x>p.x ? p.x-70 : p.x+70; }
    g.setDir(Math.abs(tx-p.x)<4?0:Math.sign(tx-p.x)); g.setFire(true);
    g.update(h); t+=h;
  }
  return { cleared: S.wave>waves || (S.wave===waves && S.phase==='clear') || S.won, lives:S.lives, t, S };
}
test('играбельность: бот проходит 1-ю волну в ≥ 8 из 10 сидов', () => {
  let ok1=0; const lives=[];
  for(let s=1;s<=10;s++){ const r=bot(s,1); if(r.cleared) ok1++; lives.push(r.lives); }
  console.log('     волна 1: пройдено '+ok1+'/10, жизни '+lives.join(','));
  ok(ok1>=8, 'слишком сложно: '+ok1+'/10');
});
test('непресность: к 5-й волне бот теряет жизни (не все проходят без потерь)', () => {
  let lost=0, won=0;
  for(let s=1;s<=6;s++){ const r=bot(100+s,5,600); if(r.lives<3) lost++; if(r.S.won) won++; }
  console.log('     5 волн: с потерями '+lost+'/6, побед бота '+won+'/6');
  ok(lost>=3, 'игра пресная: бот почти не теряет жизни');
});

console.log((failed? 'FAIL ':'OK ')+passed+'/'+(passed+failed));
process.exit(failed?1:0);
