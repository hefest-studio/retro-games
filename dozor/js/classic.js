/* ДОЗОР · тема retro: «8-битная» палитра из 16 цветов, без градиентов и мягких теней; мир рисуется
   в буфер половинного размера (240×300) и растягивается ×2 без сглаживания — крупный пиксель (ui.js). DOZOR.classic */
(function (global) {
  'use strict';
  var D = global.DOZOR = global.DOZOR || {};
  D.classic = {
    name: 'retro', pixel: true, scale: 2,
    ground: { sand: '#c8a050', wharf: '#58a038', rail: '#a08858', slag: '#887058', quarter: '#a09078', hold: '#806850', test: '#a09078' },
    road: '#d8b878', rubble: '#585048', wall: '#909098', wallTop: '#d0d0d8', wallDark: '#484850', rock: '#685840', rockTop: '#988060',
    tree: '#287820', treeTop: '#58b838', treeDark: '#104010', water: '#2050c8', waterLight: '#60a0f8', waterDeep: '#1030a0',
    bridge: '#885020', plank: '#c08040', sleeper: '#503018', railMetal: '#c0c0c8', sandbag: '#c8a060', sandbagDark: '#806030',
    roof: '#b83820', roofTop: '#e86040', bldWall: '#e8d0a8', barracks: '#886838', barracksRoof: '#584020', barracksDoor: '#201810', flag: '#f8e038',
    pad: '#484850', padRing: '#f8f8f8', padMark: '#f8e038', core: '#583030', coreTop: '#784848', coreGlow: '#f87818', coreDark: '#201010',
    rust: '#c85818', rustDark: '#783010', metal: '#787068', metalLight: '#a8a098', metalDark: '#383028', eye: '#f83818', warn: '#f8f878',
    hero: ['#f8d838', '#38c8f8'], heroDark: ['#987810', '#1868a0'], heroLight: ['#f8f0a0', '#a8e8f8'], tire: '#101010', gun: '#202020',
    pow: '#f8c890', powShirt: '#f8f8f8', powCap: '#f8e038', bullet: '#f8f8a0', ebullet: '#f83818', eglow: '#f83818', shell: '#f8a030',
    grenade: '#305020', rocket: '#f8f8f8', flame: '#f8a030', boom: ['#f8f8c0', '#f8a030', '#e04018', '#503828'], mark: '#f83818',
    rescue: '#f8f8f8', rescueStripe: '#e86010', shadow: '#00000040',
    ink: '#ffffff', muted: '#a8a8a8', accent: '#c8e050', good: '#58f858', bad: '#f85858', panel: '#000000', line: '#5858f8',
    hudBg: '#000000', barBg: '#383838', boss: '#f85818', font: '"Courier New", ui-monospace, monospace'
  };
})(typeof window !== 'undefined' ? window : globalThis);
