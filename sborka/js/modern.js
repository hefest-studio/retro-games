/* СБОРКА · тема modern (основная): мягкие тени, приглушённые тона долины, свечение антигравов и лучей. SBORKA.modern
   Мастерская «Гефест» — янтарь и латунь, округлые корпуса; Ржавая Артель — малиново-ржавые угловатые корпуса. */
(function (global) {
  'use strict';
  var SB = global.SBORKA = global.SBORKA || {};
  SB.modern = {
    name: 'modern', pixel: false,
    biome: {
      meadow: { ground: '#4b5a3a', ground2: '#52623f', speck: '#5f7048', rock: '#7a7468', rockDark: '#545048', rockLight: '#9a9488', swamp: '#2f4a44', swamp2: '#3c5e55', reed: '#5d7a4a',
        cliff: '#3a3330', cliffTop: '#5c514a', cliffDark: '#231f1d', road: '#8a7a5c', roadEdge: '#6e614a' },
      marsh: { ground: '#3f4f3c', ground2: '#455642', speck: '#52664a', rock: '#6f6c62', rockDark: '#4a4842', rockLight: '#8f8c82', swamp: '#24403c', swamp2: '#30544c', reed: '#6a8a52',
        cliff: '#34302c', cliffTop: '#544c45', cliffDark: '#201d1b', road: '#7e7058', roadEdge: '#625744' },
      rust: { ground: '#5a4a3a', ground2: '#615040', speck: '#6c5a48', rock: '#7c6e62', rockDark: '#544a42', rockLight: '#9c8e80', swamp: '#3a3c34', swamp2: '#4a4c40', reed: '#7a6a3a',
        cliff: '#3c2c26', cliffTop: '#5e463a', cliffDark: '#241a16', road: '#9a8264', roadEdge: '#7a644c' }
    },
    team: ['#f2b23a', '#e0484f'], teamDark: ['#9a6a1a', '#8a2430'], teamLight: ['#ffe2a0', '#ff9aa0'], neutral: '#9aa0aa', neutralDark: '#5a5f68',
    steel: '#c4c9d2', steelDark: '#6c727e', wheel: '#26282d', track: '#2e3036', hover: 'rgba(120,220,255,.55)', visor: '#7fd8ff', brain: '#9ff6c8',
    bld: '#8a8e96', bldDark: '#585c64', bldRoof: '#a8acb4', yard: '#6a6458', ruin: '#5a524a', smoke: 'rgba(200,200,210,.35)',
    shell: '#ffe08a', rocket: '#ffb04a', trail: 'rgba(255,200,120,.45)', beam: ['#aef6ff', '#ffffff'], boom: ['#fff3c0', '#ffb04a', '#e0502a', 'rgba(60,40,30,.5)'],
    envelope: '#d9893a', envelopeDark: '#8e5220', rib: '#b06a2a', gondola: '#3a3f48', prop: 'rgba(230,230,240,.7)', anvil: '#2a2e36',
    sel: '#ffffff', capRing: '#ffffff', shadow: 'rgba(0,0,0,.32)',
    res: { metal: '#c9ced8', energy: '#ffd84a', drive: '#8fd0ff', arms: '#ff8f6a', chips: '#9ff6c8' },
    ink: '#eef2f8', muted: '#9aa4b5', accent: '#f2b23a', good: '#6fd38c', bad: '#ff5f5f', warn: '#ffd35e', panel: 'rgba(14,16,22,.94)', line: '#343a48',
    hudBg: '#11141a', barBg: '#2a2f3a', mm: 'rgba(8,10,14,.82)', font: 'Inter, system-ui, sans-serif'
  };
})(typeof window !== 'undefined' ? window : globalThis);
