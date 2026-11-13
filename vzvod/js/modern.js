/* ВЗВОД · тема modern (основная): мягкие тени, свечение, приглушённые индустриальные тона. VZVOD.modern
   Болванчики — латунь и бирюза с голубым визором и заводным ключом; механизмы Улья — ржавчина с оранжевым «глазом». */
(function (global) {
  'use strict';
  var V = global.VZVOD = global.VZVOD || {};
  V.modern = {
    name: 'modern', pixel: false,
    biome: {
      factory: { ground: '#2a2c31', ground2: '#2f3137', seam: '#24262b', decor: '#3a3c42', oil: '#1f2024', wall: '#43454f', wallTop: '#575a66', wallFront: '#2c2d34',
        liq: '#16252a', liq2: '#1f3540', crate: '#8a6a44', crateDark: '#5a4128', pipe: '#b0763e', pipeDark: '#6e4522', rail: '#6c7078', sleeper: '#3a2e26', rubble: '#3c3a3a' },
      snow: { ground: '#d9e2ea', ground2: '#cfd9e3', seam: '#c3cfdb', decor: '#eef3f7', oil: '#b7c4d1', wall: '#5d6c7d', wallTop: '#7b8b9c', wallFront: '#414d5b',
        liq: '#2b5876', liq2: '#4b86a8', crate: '#8a6a44', crateDark: '#5a4128', pipe: '#9a7a5a', pipeDark: '#5e4630', rail: '#8a96a4', sleeper: '#7a6a5a', rubble: '#9aa6b2' },
      swamp: { ground: '#47452f', ground2: '#4d4a33', seam: '#3d3b28', decor: '#6a7a3c', oil: '#38361f', wall: '#4b4a46', wallTop: '#64625c', wallFront: '#302f2c',
        liq: '#26473c', liq2: '#3a6a58', crate: '#7e6440', crateDark: '#4e3c24', pipe: '#b8823e', pipeDark: '#704a20', rail: '#6a6a5e', sleeper: '#3a3020', rubble: '#5a5446' }
    },
    unit: ['#e2b04a', '#57c9c0'], unitDark: ['#8e6a22', '#2a7a74'], unitLight: ['#ffe2a0', '#b6f1ea'], visor: '#7fd8ff', key: '#c9ccd3', tool: '#d9d9e0', toolTip: '#9ff6ff',
    rust: '#a05a34', rustDark: '#5e3420', rustLight: '#c98458', eye: '#ffad3a', rush: '#b8452e', rushDark: '#6e2618', turret: '#6b5f58', turretDark: '#3a312c',
    heavy: '#7a5c48', heavyDark: '#40302a', smoke: 'rgba(120,110,100,.45)',
    hive: '#7a3f2a', hiveDark: '#43221a', hiveCell: '#a65a32', hiveGlow: 'rgba(255,120,40,.35)', hiveCore: '#ffb04a',
    vip: '#5fd38a', vipDark: '#2d7a4a', cart: '#8b939e', cartDark: '#4a5058', skimmer: '#6aa0c8', skimmerDark: '#355a78',
    beam: '#aef6ff', beamCore: '#ffffff', bolt: '#ff6a3a', boltGlow: 'rgba(255,106,58,.35)', shell: '#ffd35e',
    boom: ['#fff3c0', '#ffb04a', '#e0502a', 'rgba(60,40,30,.5)'], spark: '#ffe08a',
    pickGear: '#ffd35e', pickRocket: '#ff8f5a', crateBox: '#6a5238',
    zone: '#5fb3ff', exit: '#5fd38a', mark: '#ffffff', cross: '#ffffff', crossFire: '#ff6a3a',
    shadow: 'rgba(0,0,0,.35)',
    ink: '#eef2f8', muted: '#9aa4b5', accent: '#8bd450', good: '#5fd38a', bad: '#ff5f5f', warn: '#ffd35e', panel: 'rgba(14,16,22,.94)', line: '#343a48',
    hudBg: '#101318', barBg: '#2a2f3a', mm: 'rgba(8,10,14,.78)', font: 'Inter, system-ui, sans-serif'
  };
})(typeof window !== 'undefined' ? window : globalThis);
