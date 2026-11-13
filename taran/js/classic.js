/* ТАРАН · тема retro: ограниченная палитра без градиентов и мягких теней; мир рисуется в буфер половинного
   размера и растягивается ×2 без сглаживания — крупный пиксель (render.js). TARAN.classic */
(function (global) {
  'use strict';
  var T = global.TARAN = global.TARAN || {};
  T.classic = {
    name: 'retro', pixel: true,
    set: {
      shop: { ground: '#202020', ground2: '#303030', tile: 64, road: '#484848', road2: '#505050', edge: '#000000', curbA: '#f8b800', curbB: '#000000', isl: '#585868', islTop: '#7878a0', prop: '#505060', propTop: '#787890', propAcc: '#f87800' },
      roof: { ground: '#782818', ground2: '#601810', tile: 24, road: '#282028', road2: '#302830', edge: '#000000', curbA: '#c84820', curbB: '#f8d8b0', isl: '#883020', islTop: '#a84830', prop: '#686060', propTop: '#989090', propAcc: '#f8f8f8' },
      rail: { ground: '#484030', ground2: '#383020', tile: 40, road: '#786848', road2: '#806c50', edge: '#201810', curbA: '#402818', curbB: '#a08860', isl: '#605840', islTop: '#807050', prop: '#604830', propTop: '#887058', propAcc: '#b0b0b8' },
      store: { ground: '#684820', ground2: '#583818', tile: 32, road: '#808890', road2: '#889098', edge: '#303840', curbA: '#2058c8', curbB: '#f8f8f8', isl: '#987040', islTop: '#b88848', prop: '#987040', propTop: '#b88848', propAcc: '#d8b878' }
    },
    start: ['#f8f8f8', '#000000'], ramp: '#d8a838', rampDark: '#806020', chevron: '#000000', slag: '#f87818', slagDark: '#a82000', slagGlow: '#f8381880',
    oil: '#000000', oilSheen: '#3838a8', rail: '#a8a8b0', sleeper: '#503820', cart: '#705838', cartTop: '#987850', ore: '#383840',
    press: '#606878', pressTop: '#8890a0', pressWarn: '#f8381860', pressFrame: '#202830', pit: '#00a84830', pitEdge: '#58f858',
    mine: '#c0c0c8', mineDark: '#606068', mineLed: '#f83800', rivet: '#f8f878', rocket: '#e0e0e8', rocketFin: '#d82800', flame: ['#f8f8a0', '#f8a030', '#e83800'],
    boom: ['#f8f8c0', '#f8a030', '#e04018', '#503828'], smoke: 'rgba(200,200,200,', steam: 'rgba(248,248,248,',
    carDark: '#00000060', carLight: '#ffffff50', boiler: '#505868', boilerBand: '#d8a030', bumper: '#a8b0b8', wheel: '#000000', chimney: '#202020',
    shadow: '#00000060', ink: '#ffffff', muted: '#a8a8a8', accent: '#f86848', good: '#58f858', bad: '#f85858', warn: '#f8f878',
    panel: '#000000', line: '#a84828', hudBg: '#000000', barBg: '#383838', font: '"Courier New", ui-monospace, monospace', mapBg: '#00000090'
  };
})(typeof window !== 'undefined' ? window : globalThis);
