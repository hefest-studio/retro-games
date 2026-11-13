/* ГОРНИЛО · тема modern (основная): палитра арены-кузни и интерфейса для общего рендера (js/render.js).
   Тёмный чугун плит, тлеющие швы расплава, мягкие тени и свечение. GORNILO.modern */
(function (global) {
  'use strict';
  var G = global.GORNILO = global.GORNILO || {};
  G.modern = {
    name: 'modern', pixel: false,
    floor: '#1c1d22', floor2: '#202127', seam: '#2b2a2c', glow: '#ff7a2a', glowSoft: 'rgba(255,122,42,.16)',
    wall: '#35343a', wallTop: '#4a4850', wallDark: '#1a191d', rivet: '#6a6670',
    gate: '#0d0d10', gateBar: '#5a5560', gateHot: '#ff8a3a', gateOpen: '#58e0c0', gateLock: '#a83a2a',
    anvil: '#3a3d46', anvilTop: '#5a5e6a', anvilDark: '#22242a', hatch: '#2a2b31', hatchRing: '#56545c',
    hero: ['#f2b84b', '#5ad1c7'], heroDark: ['#9a6a1e', '#2a7d78'], heroLight: ['#ffe2a0', '#b5f2ea'], apron: '#5a3d2a', visor: '#1b1c20',
    blank: '#8d8f96', blankDark: '#55575e', blankEye: '#ffb03a',
    runner: '#d4572e', runnerDark: '#7a2a16', fuse: '#fff1a0',
    turret: '#6b6f7a', turretDark: '#3a3d45', turretBarrel: '#22242a',
    shield: '#7c8590', shieldDark: '#454b54', shieldPlate: '#d8dde4',
    roller: '#5d5550', rollerDark: '#2e2a28', rollerBand: '#c09a4a',
    bullet: '#fff2b0', bulletCore: '#ffffff', ebullet: '#ff5a3a', eglow: 'rgba(255,90,58,.30)', flame: ['#fff0b0', '#ffb040', '#ff6020'],
    disc: '#7ee8ff', grenade: '#3a3d40', boom: ['#fff3c0', '#ffb04a', '#e0502a', 'rgba(60,40,30,.6)'],
    ring: 'rgba(120,230,255,.55)', hammer: '#c9ccd3', hammerHead: '#8a8d96',
    pick: { fan: '#ffcf4a', flame: '#ff7a2a', grenade: '#9ccc65', disc: '#7ee8ff', ring: '#8fa8ff', hammers: '#d9d9e0', gold: '#ffd34d', life: '#ff6a7a' },
    boss: '#4c4a52', bossDark: '#2a292e', bossLight: '#77737e', core: '#ff7a2a', coreArmor: '#5c5a62', mark: 'rgba(255,74,42,.30)', markEdge: '#ff4a2a',
    shadow: 'rgba(0,0,0,.35)',
    ink: '#f3eee4', muted: '#a3a9b3', accent: '#ff8f3f', good: '#5fd38a', bad: '#ff5f5f', warn: '#ffd35e', panel: 'rgba(16,16,20,.94)', line: '#3a3a44',
    hudBg: '#121216', barBg: '#2a2a32', font: 'Inter, system-ui, sans-serif'
  };
})(typeof window !== 'undefined' ? window : globalThis);
