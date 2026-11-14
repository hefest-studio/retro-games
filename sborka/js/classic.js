/* СБОРКА · тема retro: ограниченная 8-битная палитра без градиентов и теней; мир рисуется в буфер половинного
   размера и растягивается ×2 без сглаживания — крупный пиксель (ui.js). SBORKA.classic */
(function (global) {
  'use strict';
  var SB = global.SBORKA = global.SBORKA || {};
  SB.classic = {
    name: 'retro', pixel: true,
    biome: {
      meadow: { ground: '#305818', ground2: '#386020', speck: '#487828', rock: '#888888', rockDark: '#505050', rockLight: '#b8b8b8', swamp: '#003858', swamp2: '#005878', reed: '#58a038',
        cliff: '#503818', cliffTop: '#886030', cliffDark: '#281808', road: '#a88850', roadEdge: '#785828' },
      marsh: { ground: '#284818', ground2: '#305020', speck: '#406828', rock: '#787878', rockDark: '#484848', rockLight: '#a8a8a8', swamp: '#003048', swamp2: '#004868', reed: '#78b048',
        cliff: '#483010', cliffTop: '#785828', cliffDark: '#201008', road: '#988048', roadEdge: '#685020' },
      rust: { ground: '#584028', ground2: '#604830', speck: '#705838', rock: '#888078', rockDark: '#504840', rockLight: '#b0a898', swamp: '#283828', swamp2: '#384830', reed: '#887838',
        cliff: '#482010', cliffTop: '#784028', cliffDark: '#200800', road: '#b89058', roadEdge: '#886030' }
    },
    team: ['#f8d838', '#f83848'], teamDark: ['#a07800', '#901018'], teamLight: ['#f8f8a8', '#f8a8a8'], neutral: '#a8a8a8', neutralDark: '#585858',
    steel: '#d8d8d8', steelDark: '#787878', wheel: '#000000', track: '#202020', hover: '#58d8f8', visor: '#58d8f8', brain: '#58f898',
    bld: '#989898', bldDark: '#585858', bldRoof: '#c8c8c8', yard: '#706848', ruin: '#585048', smoke: '#a8a8a8',
    shell: '#f8f878', rocket: '#f8a830', trail: '#f87818', beam: ['#58f8f8', '#ffffff'], boom: ['#f8f8c0', '#f8a830', '#e04818', '#503828'],
    envelope: '#e87818', envelopeDark: '#883808', rib: '#b85810', gondola: '#383838', prop: '#d8d8d8', anvil: '#202020',
    sel: '#ffffff', capRing: '#ffffff', shadow: '#00000060',
    res: { metal: '#d8d8d8', energy: '#f8f838', drive: '#78c8f8', arms: '#f88858', chips: '#58f898' },
    ink: '#ffffff', muted: '#a8a8a8', accent: '#f8d838', good: '#58f858', bad: '#f85858', warn: '#f8f878', panel: '#000000', line: '#a07800',
    hudBg: '#000000', barBg: '#383838', mm: '#000000', font: '"Courier New", ui-monospace, monospace'
  };
})(typeof window !== 'undefined' ? window : globalThis);
