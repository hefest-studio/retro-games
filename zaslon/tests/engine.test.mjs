/* ЗАСЛОН · tests/engine.test.mjs — автотесты логики (Node, без зависимостей).
   Запуск: node zaslon/tests/engine.test.mjs. Логика в node:vm с шимом window. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const sandbox = { console, Math, Array };
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/game.js'), 'utf8'), sandbox, { filename: 'game.js' });
const Z = sandbox.ZASLON;
const C = Z.consts;

let passed = 0, failed = 0;
function test(name, fn){ try { fn(); passed++; console.log('ok   '+name); } catch(e){ failed++; console.log('FAIL '+name+' — '+e.message); } }
function eq(a,b,m){ if(a!==b) throw new Error((m||'')+' ждали '+JSON.stringify(b)+', получили '+JSON.stringify(a)); }
function ok(c,m){ if(!c) throw new Error(m||'ложь'); }
function near(a,b,eps,m){ if(Math.abs(a-b)>eps) throw new Error((m||'')+' ждали ≈'+b+', получили '+a); }
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function run(g, sec, h=1/60){ for(let t=0;t<sec;t+=h) g.update(h); }
// Новая игра в фазе волн без спавна (чистое поле), события пишутся в журнал.
function ready(seed=1, extra={}){
  const ev=[]; const g=Z.Game(Object.assign({ rng:mulberry32(seed), onEvent:(t,d)=>ev.push([t,d]) }, extra)); g.start();
  const S=g._S; S.phase='waves'; S.waveIdx=S.waveCount; S.spawnQ=[]; S.enemies=[]; S.player.inv=0; S.banner=null;
  return { g, S, ev };
}
// «Глушилка» волн: фаза waves не перейдёт к боссу, пока висит этот враг вне экрана
function hold(g){ const e=g._spawn({ kind:'hulk', x:240, pat:'hulk' }); e.y=-500; e.vy=0; e.stopY=-1000; e.hang=1e9; e.fireT=1e9; return e; }
const has=(ev,t)=>ev.some(e=>e[0]===t);
const cnt=(ev,t)=>ev.filter(e=>e[0]===t).length;

test('старт: сектор 1, 3 корабля, заслон 100%, Искра ур.1, 2 бомбы, щит 1', () => {
  const g=Z.Game({rng:mulberry32(1)}); g.start(); const S=g.state();
  eq(S.sector,1); eq(S.lives,3); eq(S.base,100); eq(S.score,0); eq(S.scrap,0);
  eq(S.player.weapon,'spark'); eq(S.player.lv.spark,1); eq(S.player.bombs,2); eq(S.player.shield,C.SHIELD_BASE); eq(S.phase,'intro');
});

test('5 секторов, 5 разных боссов, прочность боссов растёт', () => {
  eq(C.SECTORS,5); eq(C.BOSSES.length,5);
  eq(new Set(C.BOSSES.map(b=>b.kind)).size,5,'боссы повторяются');
  for(let i=1;i<5;i++) ok(C.BOSSES[i].hp>C.BOSSES[i-1].hp,'босс '+(i+1)+' не прочнее');
});

test('сложность растёт с сектором (через diff)', () => {
  const g=Z.Game(); g.start(); const p1=g.params(); g._S.sector=5; const p5=g.params();
  ok(p5.spdMul>p1.spdMul && p5.hpMul>p1.hpMul && p5.eBulletV>p1.eBulletV && p5.fireMul>p1.fireMul, 'параметры не растут');
  ok(p5.gap<p1.gap && p5.maxLive>p1.maxLive && p5.waves>p1.waves, 'темп волн не растёт');
});

test('сектор 1: волны → предупреждение → босс Жернов', () => {
  const g=Z.Game({rng:mulberry32(3)}); g.start(); const S=g._S;
  let sawWaves=false;
  for(let t=0;t<400 && !S.boss;t+=1/60){ S.player.inv=9; S.enemies.forEach(e=>{ if(!e.dead && e.y>0) g._damage(e,99); }); g.update(1/60); if(S.phase==='waves') sawWaves=true; }
  ok(sawWaves,'не было волн'); ok(S.boss,'босс не появился'); eq(S.boss.kind,'millstone'); eq(S.waveIdx,S.waveCount);
});

test('коллизия: пуля Искры сбивает Клеща → очки, событие kill', () => {
  const { g, S, ev } = ready(); hold(g);
  const e=g._spawn({ kind:'mite', x:240, pat:'sine' }); e.y=200; e.vy=0; e.amp=0;
  S.pb.push({ x:240, y:230, vx:0, vy:-600, dmg:1, life:2, k:'spark' }); g.update(0.1);
  ok(e.dead,'не убит'); eq(S.score,C.KINDS.mite.pts); ok(has(ev,'kill'));
});

test('Искра: веер 3 / 5 / 7 пуль по уровням', () => {
  for (const [lv,n] of [[1,3],[2,5],[3,7]]) {
    const { g, S } = ready(); hold(g); S.player.lv.spark=lv; g.setFire(true); g.update(1/120);
    eq(S.pb.length,n,'ур.'+lv);
  }
});

test('Дробь: 6 / 8 / 11 дробин, разлёт и ограниченная дальность', () => {
  for (const [lv,n] of [[1,6],[2,8],[3,11]]) {
    const { g, S } = ready(); hold(g); S.player.weapon='shot'; S.player.lv.shot=lv; g.setFire(true); g.update(1/120);
    eq(S.pb.length,n,'ур.'+lv);
    const xs=S.pb.map(b=>b.vx); ok(Math.max(...xs)-Math.min(...xs)>300,'нет разлёта');
  }
  const { g, S } = ready(); hold(g); S.player.weapon='shot'; g.setFire(true); g.update(1/120); g.setFire(false);
  run(g, C.GUN.shot.life + 0.05); eq(S.pb.length,0,'дробь летит дальше положенного');
});

test('Луч: бьёт ближайшую цель над кораблём, урон = dps × время, растёт с уровнем', () => {
  const dmg=[];
  for (const lv of [1,2,3]) {
    const { g, S } = ready(); hold(g); S.player.weapon='ray'; S.player.lv.ray=lv; S.player.x=240; S.player.y=560;
    const front=g._spawn({ kind:'hulk', x:240, pat:'hulk' }); front.y=300; front.vy=0; front.stopY=0; front.hang=1e9; front.hp=front.max=999; front.fireT=1e9;
    const back=g._spawn({ kind:'hulk', x:240, pat:'hulk' }); back.y=150; back.vy=0; back.stopY=0; back.hang=1e9; back.hp=back.max=999; back.fireT=1e9;
    front.x0=back.x0=240;
    g.setFire(true); run(g, 1.0, 1/120);
    near(999-front.hp, C.GUN.ray.dps[lv-1], 0.6, 'ур.'+lv); eq(back.hp,999,'луч прошёл сквозь цель');
    ok(S.player.ray && S.player.ray.y1>front.y,'луч не упирается в цель');
    dmg.push(999-front.hp);
  }
  ok(dmg[0]<dmg[1] && dmg[1]<dmg[2],'урон не растёт с уровнем');
});

test('капсула: свой вид — уровень (до 3, дальше +500), чужой — смена оружия с его уровнем', () => {
  const { g, S, ev } = ready();
  g._take('spark'); eq(S.player.lv.spark,2); g._take('spark'); eq(S.player.lv.spark,3);
  const sc=S.score; g._take('spark'); eq(S.player.lv.spark,3); eq(S.score,sc+500);
  g._take('ray'); eq(S.player.weapon,'ray'); eq(S.player.lv.ray,1); eq(S.player.lv.spark,3,'уровень Искры потерян');
  eq(cnt(ev,'capsule'),4);
});

test('капсула выпадает из Носителя и меняет вид по кругу', () => {
  const { g, S } = ready(); hold(g);
  const e=g._spawn({ kind:'carrier', x:240, pat:'carrier' }); e.y=100; g._damage(e,99);
  eq(S.caps.length,1); const c=S.caps[0]; S.player.x=20; S.player.y=600;
  const seen=new Set(); for(let t=0;t<C.CAPSULE_CYCLE*3.2;t+=1/60){ g.update(1/60); if(S.caps[0]) seen.add(S.caps[0].ty); }
  eq(seen.size,3,'виды не меняются: '+[...seen]); void c;
});

test('боковые модули: до 2, стреляют сами по бокам', () => {
  const { g, S } = ready(); hold(g); S.player.modules=2; g.setFire(true); g.update(1/120);
  const mods=S.pb.filter(b=>b.k==='mod'); eq(mods.length,2);
  near(Math.min(...mods.map(b=>b.x)), S.player.x-C.MOD_DX, 0.5); near(Math.max(...mods.map(b=>b.x)), S.player.x+C.MOD_DX, 0.5);
});

test('энергощит: попадание снимает деление щита, а не корабль; восстанавливается', () => {
  const { g, S, ev } = ready(); hold(g);
  S.eb.push({ x:S.player.x, y:S.player.y-3, vx:0, vy:100, r:5 }); g.update(1/60);
  eq(S.lives,3); eq(S.player.shield,0); ok(has(ev,'shieldHit')); ok(S.player.alive);
  run(g, 9.5); eq(S.player.shield,1,'щит не восстановился'); ok(has(ev,'shieldUp'));
});

test('без щита: попадание — потеря корабля, уровень оружия −1, возрождение с неуязвимостью', () => {
  const { g, S, ev } = ready(); hold(g); S.player.shield=0; S.player.lv.spark=3;
  g._hitPlayer('bullet'); eq(S.lives,2); ok(!S.player.alive); eq(S.player.lv.spark,2); ok(has(ev,'die'));
  run(g, 2.0); ok(S.player.alive,'не возродился'); ok(S.player.inv>0); eq(S.player.shield,S.player.shMax);
});

test('таран: враг сбивает щит и получает урон', () => {
  const { g, S } = ready(); hold(g);
  const e=g._spawn({ kind:'mite', x:S.player.x, pat:'sine' }); e.y=S.player.y-4; e.vy=0; e.amp=0; e.x0=S.player.x;
  g.update(1/60); eq(S.player.shield,0); ok(e.dead,'клещ не разбился');
});

test('заслон: прорвавшийся враг отнимает прочность', () => {
  const { g, S, ev } = ready(); hold(g); S.player.x=20;
  const e=g._spawn({ kind:'hulk', x:400, pat:'sine' }); e.x0=400; e.y=C.BREACH_Y-2; e.vy=200; e.fireT=1e9;
  g.update(0.05); ok(e.dead && e.breached,'нет прорыва'); eq(S.base,100-C.KINDS.hulk.breach); ok(has(ev,'breach'));
});

test('заслон на нуле — конец игры (причина base)', () => {
  const { g, S, ev } = ready(); hold(g); S.player.x=20; S.base=5;
  const e=g._spawn({ kind:'mite', x:400, pat:'sine' }); e.x0=400; e.amp=0; e.y=C.BREACH_Y-1; e.vy=200;
  g.update(0.05); eq(S.base,0); ok(has(ev,'baseDown'));
  run(g, 2); ok(S.over && !S.won); const go=ev.find(x=>x[0]==='gameover'); ok(go && go[1].reason==='base','причина не base');
});

test('мега-бомба: чистит пули, бьёт врагов и босса, запас ограничен', () => {
  const { g, S, ev } = ready(); hold(g);
  for(let i=0;i<4;i++){ const e=g._spawn({ kind:'mite', x:60+i*100, pat:'sine' }); e.y=200; }
  S.eb.push({ x:100, y:100, vx:0, vy:100, r:5 }, { x:300, y:200, vx:0, vy:100, r:5 });
  ok(g.bomb()); eq(S.eb.length,0); eq(S.enemies.filter(e=>e.kind==='mite'&&!e.dead).length,0,'клещи живы'); eq(S.player.bombs,1); ok(has(ev,'bomb'));
  S.phase='boss'; g._spawnBoss(); S.boss.vuln=true; const hp=S.boss.hp; ok(g.bomb()); eq(S.boss.hp,hp-22); eq(S.player.bombs,0);
  ok(!g.bomb(),'бомба без запаса');
});

test('боссы: каждый стреляет, неуязвим до выхода на позицию', () => {
  for (let n=1;n<=5;n++){
    const { g, S, ev } = ready(n, { startSector:n }); S.phase='boss'; g._spawnBoss();
    eq(S.boss.kind, C.BOSSES[n-1].kind); ok(!S.boss.vuln,'уязвим сразу');
    g._hitBoss(50); eq(S.boss.hp,S.boss.max,'урон до выхода');
    S.player.inv=1e9; run(g, 12);
    ok(S.boss.vuln && !S.boss.entering,'не вышел на позицию'); ok(cnt(ev,'eshoot')>3,'босс '+n+' не стреляет');
  }
});

test('Маятник: столб-луч с предупреждением бьёт корабль в колонне', () => {
  const { g, S, ev } = ready(4, { startSector:4 }); S.phase='boss'; g._spawnBoss();
  const B=S.boss; B.y=112; B.entering=false; B.vuln=true; B.ta=B.tb=99; B.tc=0;
  S.player.shield=0; S.player.inv=0;
  for(let t=0;t<3 && S.player.alive;t+=1/60){ S.eb=[]; if(B.beam) S.player.x=B.beam.x; g.update(1/60); }
  ok(has(ev,'beamWarn'),'нет предупреждения'); ok(has(ev,'beam'),'нет луча'); eq(S.lives,2,'луч не попал');
  const wi=ev.findIndex(e=>e[0]==='beamWarn'), bi=ev.findIndex(e=>e[0]==='beam'); ok(wi<bi,'луч без предупреждения');
});

test('победа над боссом → бонус → мастерская (сектора 1–4)', () => {
  const { g, S, ev } = ready(); S.phase='boss'; g._spawnBoss(); S.boss.vuln=true;
  const sc=S.scrap; g._hitBoss(1e6); ok(has(ev,'bossDie')); eq(S.phase,'clear'); ok(S.scrap>sc,'нет лома за босса');
  run(g, 3); eq(S.phase,'shop'); ok(has(ev,'shop'));
});

test('мастерская: цены, лимиты, отказ без лома, починка до 100%', () => {
  const { g, S, ev } = ready(); S.phase='shop'; S.shop.t=1; S.scrap=10000; const p=S.player;
  eq(g.price('weapon'),C.PRICES.weapon[0]); ok(g.buy('weapon')); eq(p.lv.spark,2); eq(g.price('weapon'),C.PRICES.weapon[1]);
  ok(g.buy('weapon')); eq(p.lv.spark,3); eq(g.price('weapon'),null); ok(!g.buy('weapon'),'ур.4');
  eq(g.price('module'),C.PRICES.module[0]); g.buy('module'); eq(g.price('module'),C.PRICES.module[1]); g.buy('module'); eq(p.modules,2); eq(g.price('module'),null);
  for(let i=0;i<5;i++) g.buy('shield'); eq(p.shMax,C.SHIELD_MAX); eq(p.shield,p.shMax);
  for(let i=0;i<9;i++) g.buy('bomb'); eq(p.bombs,C.BOMBS_MAX);
  for(let i=0;i<9;i++) g.buy('life'); eq(S.lives,C.LIVES_MAX);
  eq(g.price('repair'),null,'починка при 100%'); S.base=90; ok(g.buy('repair')); eq(S.base,100,'больше 100%');
  const spent = 10000 - S.scrap;
  const exp = C.PRICES.weapon[0]+C.PRICES.weapon[1]+C.PRICES.module[0]+C.PRICES.module[1]+C.PRICES.shield[0]+C.PRICES.shield[1]+3*C.PRICES.bomb[0]+2*C.PRICES.life[0]+C.PRICES.repair[0];
  eq(spent, exp, 'сумма покупок');
  S.scrap=5; const before=S.scrap; S.base=50; ok(!g.buy('repair')); eq(S.scrap,before); ok(has(ev,'deny'));
  const it=g.shopItems(); eq(it.length,C.SHOP.length); eq(it[it.length-1].key,'next'); ok(it.find(i=>i.key==='weapon').maxed);
});

test('мастерская: выбор стрелками, «В бой» → следующий сектор; защита от случайного нажатия', () => {
  const { g, S } = ready(); S.phase='shop'; S.shop.sel=0; S.shop.t=0;
  ok(!g.shopConfirm(),'покупка в первые 0.5 с'); S.shop.t=1;
  g.shopMove(-1); eq(C.SHOP[S.shop.sel],'next'); ok(g.shopConfirm()); eq(S.sector,2); eq(S.phase,'intro');
});

test('после 5-го сектора — победа', () => {
  const { g, S, ev } = ready(1, { startSector: 5 }); S.phase='boss'; g._spawnBoss(); S.boss.vuln=true; g._hitBoss(1e6);
  run(g, 3); ok(has(ev,'win'),'нет win'); ok(S.won && S.over); ok(!has(ev,'shop'),'мастерская после финала');
});

test('3 потери корабля — конец игры', () => {
  const { g, S, ev } = ready(); hold(g);
  for(let k=0;k<3;k++){ S.player.inv=0; S.player.alive=true; S.player.shield=0; g._hitPlayer('bullet'); }
  eq(S.lives,0); run(g, 2.5); ok(has(ev,'gameover'),'нет gameover'); ok(S.over && !S.won);
});

test('детерминизм: один сид — одна партия', () => {
  const play = s => { const g=Z.Game({rng:mulberry32(s)}); g.start(); g.setFire(true); for(let i=0;i<60*40;i++){ g.setDir(Math.sin(i/50)>0?1:-1,0); g.update(1/60);} const S=g.state(); return [S.score,S.scrap,S.base,S.lives,S.sector].join(); };
  eq(play(7), play(7));
});

// Баланс: «человеческий» бот (tests/bot.mjs) — реакция 150–250 мс, решения ~12/с, внимание ~190 px,
// ошибка оценки скорости пуль, моторный разброс, ввод только через setDir/setFire/bomb/мастерскую.
// 100 детерминированных сидов (1..100), ~40 с. Цели: сектор 1 ≥ 90%, все 5 секторов 20–40%.
const { playZaslon } = await import('./bot.mjs');
const BAL = []; for (let s=1; s<=100; s++) BAL.push(playZaslon(Z, s));
const perSector = w => { const reach=BAL.filter(r=>r.passed>=w-1).length; let lost=0; for(const r of BAL) lost+=(r.lost[w]||0); return lost/Math.max(1,reach); };
test('баланс: бот проходит 1-й сектор в ≥ 90% партий', () => {
  const n=BAL.filter(r=>r.passed>=1).length;
  console.log('     сектор 1: '+n+'/100');
  ok(n>=90, 'слишком сложно: '+n+'/100');
});
test('баланс: все 5 секторов — 20–40% партий бота', () => {
  const n=BAL.filter(r=>r.won).length, dist=[0,0,0,0,0,0]; BAL.forEach(r=>dist[r.passed]++);
  const base=BAL.filter(r=>r.causes.base>0).length;
  console.log('     все 5: '+n+'/100; пройдено секторов 0..5: '+dist.join(',')+'; проигрышей из-за заслона: '+base);
  ok(n>=20, 'слишком сложно: '+n+'/100'); ok(n<=40, 'слишком легко: '+n+'/100');
});
test('непресность: потери кораблей за сектор растут от 1-го к 4–5-му', () => {
  const L=[1,2,3,4,5].map(perSector);
  console.log('     потерь кораблей на сектор: '+L.map(v=>v.toFixed(2)).join(' / '));
  ok(L[0]<L[2] && L[2]<L[4] && L[0]<L[3], 'нет нарастания: '+L.join(','));
});
test('заслон под давлением: прорывы растут к поздним секторам', () => {
  const B=[1,5].map(w=>{ const reach=BAL.filter(r=>r.passed>=w-1).length; let s=0; for(const r of BAL) s+=(r.breach[w]||0); return s/Math.max(1,reach); });
  console.log('     потеря заслона, %: сектор 1 — '+B[0].toFixed(1)+', сектор 5 — '+B[1].toFixed(1));
  ok(B[1]>B[0]*3, 'заслон не под давлением');
});

console.log((failed? 'FAIL ':'OK ')+passed+'/'+(passed+failed));
process.exit(failed?1:0);
