/* ЗАСТАВА · i18n (RU/EN/TR/ES/PT — движок v2.8 берёт языки из ключей strings; название: RU — ЗАСТАВА, EN/TR/ES/PT — ANVILWATCH). ZASTAVA.STR — таблицы для Arcade.createGame({strings}).
   Ключи play/language/theme/... нужны стандартным экранам движка; остальные — игре. */
(function (global) {
  'use strict';
  var Z = global.ZASTAVA = global.ZASTAVA || {};
  Z.STR = {
    ru: {
      play: 'Играть', language: 'Язык', theme: 'Тема', sound: 'Звук', on: 'вкл', off: 'выкл',
      score: 'Счёт', level: 'Волна', best: 'Рекорд', win: 'ЗАСТАВА ЦЕЛА!', gameover: 'ЗАСТАВА ПАЛА',
      pause: 'ПАУЗА', resume: 'Продолжить', menu: 'В меню', tapstart: 'пробел / тап',
      title: 'ЗАСТАВА', subtitle: 'Ржавь идёт рядами · 10 волн · удержи мастерскую',
      back: 'Каталог', lives: 'Лафеты',
      wave: 'ВОЛНА', ready: 'К бою!', clear: 'ВОЛНА ОТБИТА', bonus: 'Бонус', lost: 'ЛАФЕТ ПОДБИТ', invaded: 'РЖАВЬ ДОШЛА ДО ЗЕМЛИ',
      sub_grid: 'Строй идёт ступенями — не дай ему дойти до земли',
      sub_birds: 'Коршуны закрываются щитом — бей, когда раскроют крылья',
      sub_boss: 'Пробей конвейерный пояс и попади в горн-ядро',
      core: 'Ядро матки', extra: '+1 ЛАФЕТ', probe: 'ЗОНД',
      wv_dawn: 'Ржавый рассвет', wv_cogs: 'Шестерни', wv_kites: 'Коршуны', wv_drills: 'Сверлильщики', wv_mother: 'Матка-конвейер',
      wv_flock: 'Стальная стая', wv_scale: 'Окалина', wv_onslaught: 'Натиск', wv_storm: 'Буря крыльев', wv_heart: 'Сердце ржави',
      cardNext: 'пробел / тап — дальше', rwLife: 'Реклама: +1 лафет', hintTouch: '◀ ▶ или палец — лафет · ● / тап — огонь · II — пауза',
      hint: '← → — лафет · Пробел — огонь · P — пауза',
      foot: '<b>ЗАСТАВА</b> · ← → / A D — лафет · Пробел / ● — огонь (удержание — очередь) · P / Esc — пауза · L язык, T тема, M звук.'
    },
    en: {
      play: 'Play', language: 'Language', theme: 'Theme', sound: 'Sound', on: 'on', off: 'off',
      score: 'Score', level: 'Wave', best: 'Best', win: 'OUTPOST HOLDS!', gameover: 'OUTPOST FALLEN',
      pause: 'PAUSE', resume: 'Resume', menu: 'Menu', tapstart: 'space / tap',
      title: 'ANVILWATCH', subtitle: 'Rust marches in rows · 10 waves · hold the workshop',
      back: 'Catalog', lives: 'Cannons',
      wave: 'WAVE', ready: 'Battle stations!', clear: 'WAVE REPELLED', bonus: 'Bonus', lost: 'CANNON DOWN', invaded: 'THE RUST REACHED THE GROUND',
      sub_grid: 'The rows step down — do not let them reach the ground',
      sub_birds: 'Kites close their shields — hit them when the wings open',
      sub_boss: 'Break the conveyor belt, then hit the furnace core',
      core: 'Mother core', extra: '+1 CANNON', probe: 'PROBE',
      wv_dawn: 'Rusty Dawn', wv_cogs: 'Cogs', wv_kites: 'Kites', wv_drills: 'Drillers', wv_mother: 'Conveyor Mother',
      wv_flock: 'Steel Flock', wv_scale: 'Mill Scale', wv_onslaught: 'Onslaught', wv_storm: 'Wing Storm', wv_heart: 'Heart of Rust',
      cardNext: 'space / tap — go on', rwLife: 'Watch ad: +1 cannon', hintTouch: '◀ ▶ or finger — cannon · ● / tap — fire · II — pause',
      hint: '← → — cannon · Space — fire · P — pause',
      foot: '<b>ANVILWATCH</b> · ← → / A D — cannon · Space / ● — fire (hold for bursts) · P / Esc — pause · L language, T theme, M sound.'
    }
  };
  Z.STR.tr = {
    play: 'Oyna', language: 'Dil', theme: 'Tema', sound: 'Ses', on: 'açık', off: 'kapalı',
    score: 'Puan', level: 'Dalga', best: 'Rekor', win: 'KARAKOL AYAKTA!', gameover: 'KARAKOL DÜŞTÜ',
    pause: 'DURAKLATILDI', resume: 'Devam et', menu: 'Ana menü', tapstart: 'boşluk / dokun',
    title: 'ANVILWATCH', subtitle: 'Pas sıra sıra geliyor · 10 dalga · atölyeyi koru',
    back: 'Katalog', lives: 'Kuleler',
    wave: 'DALGA', ready: 'Savaş düzeni!', clear: 'DALGA PÜSKÜRTÜLDÜ', bonus: 'Bonus', lost: 'KULE VURULDU', invaded: 'PAS YERE ULAŞTI',
    sub_grid: 'Saflar basamak basamak iniyor — yere ulaşmalarına izin verme',
    sub_birds: 'Çaylaklar kalkan kapatır — kanatlarını açınca vur',
    sub_boss: 'Konveyör kuşağını kır, sonra ocak çekirdeğini vur',
    core: 'Ana çekirdek', extra: '+1 KULE', probe: 'SONDA',
    wv_dawn: 'Paslı Şafak', wv_cogs: 'Dişliler', wv_kites: 'Çaylaklar', wv_drills: 'Matkapçılar', wv_mother: 'Konveyör Ana',
    wv_flock: 'Çelik Sürü', wv_scale: 'Tufal', wv_onslaught: 'Hücum', wv_storm: 'Kanat Fırtınası', wv_heart: 'Pasın Kalbi',
    cardNext: 'boşluk / dokun — devam', rwLife: 'Reklam: +1 kule', hintTouch: '◀ ▶ ya da parmak — kule · ● / dokun — ateş · II — duraklat',
    hint: '← → — kule · Boşluk — ateş · P — duraklat',
    foot: '<b>ANVILWATCH</b> · ← → / A D — kule · Boşluk / ● — ateş (basılı tut: seri atış) · P / Esc — duraklat · L dil, T tema, M ses.'
  };
  Z.STR.es = {
    play: 'Jugar', language: 'Idioma', theme: 'Tema', sound: 'Sonido', on: 'sí', off: 'no',
    score: 'Puntos', level: 'Oleada', best: 'Récord', win: '¡EL PUESTO RESISTE!', gameover: 'EL PUESTO HA CAÍDO',
    pause: 'PAUSA', resume: 'Continuar', menu: 'Menú principal', tapstart: 'espacio / toca',
    title: 'ANVILWATCH', subtitle: 'El óxido avanza en filas · 10 oleadas · defiende el taller',
    back: 'Catálogo', lives: 'Cañones',
    wave: 'OLEADA', ready: '¡A sus puestos!', clear: 'OLEADA REPELIDA', bonus: 'Bonus', lost: 'CAÑÓN DERRIBADO', invaded: 'EL ÓXIDO LLEGÓ AL SUELO',
    sub_grid: 'Las filas bajan escalón a escalón: que no lleguen al suelo',
    sub_birds: 'Los milanos cierran el escudo: dispara cuando abran las alas',
    sub_boss: 'Rompe la cinta transportadora y acierta en el núcleo-horno',
    core: 'Núcleo madre', extra: '+1 CAÑÓN', probe: 'SONDA',
    wv_dawn: 'Alba oxidada', wv_cogs: 'Engranajes', wv_kites: 'Milanos', wv_drills: 'Taladradores', wv_mother: 'Madre transportadora',
    wv_flock: 'Bandada de acero', wv_scale: 'Cascarilla', wv_onslaught: 'Embestida', wv_storm: 'Tormenta de alas', wv_heart: 'Corazón de óxido',
    cardNext: 'espacio / toca — seguir', rwLife: 'Anuncio: +1 cañón', hintTouch: '◀ ▶ o dedo — cañón · ● / toque — disparo · II — pausa',
    hint: '← → — cañón · Espacio — disparo · P — pausa',
    foot: '<b>ANVILWATCH</b> · ← → / A D — cañón · Espacio / ● — disparo (mantén para ráfagas) · P / Esc — pausa · L idioma, T tema, M sonido.'
  };
  Z.STR.pt = {
    play: 'Jogar', language: 'Idioma', theme: 'Tema', sound: 'Som', on: 'lig.', off: 'desl.',
    score: 'Pontos', level: 'Onda', best: 'Recorde', win: 'O POSTO RESISTE!', gameover: 'O POSTO CAIU',
    pause: 'PAUSA', resume: 'Continuar', menu: 'Menu principal', tapstart: 'espaço / toque',
    title: 'ANVILWATCH', subtitle: 'A ferrugem avança em fileiras · 10 ondas · defenda a oficina',
    back: 'Catálogo', lives: 'Canhões',
    wave: 'ONDA', ready: 'Aos postos!', clear: 'ONDA REPELIDA', bonus: 'Bônus', lost: 'CANHÃO ATINGIDO', invaded: 'A FERRUGEM CHEGOU AO CHÃO',
    sub_grid: 'As fileiras descem em degraus — não deixe que cheguem ao chão',
    sub_birds: 'Os milhafres fecham o escudo — atire quando abrirem as asas',
    sub_boss: 'Quebre a esteira e acerte o núcleo-fornalha',
    core: 'Núcleo-mãe', extra: '+1 CANHÃO', probe: 'SONDA',
    wv_dawn: 'Aurora enferrujada', wv_cogs: 'Engrenagens', wv_kites: 'Milhafres', wv_drills: 'Perfuradores', wv_mother: 'Mãe-esteira',
    wv_flock: 'Bando de aço', wv_scale: 'Carepa', wv_onslaught: 'Investida', wv_storm: 'Tempestade de asas', wv_heart: 'Coração da ferrugem',
    cardNext: 'espaço / toque — seguir', rwLife: 'Anúncio: +1 canhão', hintTouch: '◀ ▶ ou dedo — canhão · ● / toque — tiro · II — pausa',
    hint: '← → — canhão · Espaço — tiro · P — pausa',
    foot: '<b>ANVILWATCH</b> · ← → / A D — canhão · Espaço / ● — tiro (segure para rajadas) · P / Esc — pausa · L idioma, T tema, M som.'
  };
})(typeof window !== 'undefined' ? window : globalThis);
