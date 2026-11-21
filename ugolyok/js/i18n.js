/* УГОЛЁК · i18n (RU/EN/TR/ES/PT — движок v2.8 берёт языки из ключей strings; название и имя героя: RU — УГОЛЁК, EN/TR/ES/PT — STOKELING). UGOLYOK.STR — таблицы для Arcade.createGame({strings}).
   Ключи play/language/theme/... нужны стандартным экранам движка; остальные — игре. */
(function (global) {
  'use strict';
  var U = global.UGOLYOK = global.UGOLYOK || {};
  U.STR = {
    ru: {
      play: 'Играть', language: 'Язык', theme: 'Тема', sound: 'Звук', on: 'вкл', off: 'выкл',
      score: 'Счёт', level: 'Экран', best: 'Рекорд', bestTime: 'Лучшее время', time: 'Время',
      win: 'ГОРН РАЗГОРЕЛСЯ!', gameover: 'УГОЛЁК ОСТЫЛ',
      pause: 'ПАУЗА', resume: 'Продолжить', menu: 'В меню', tapstart: 'пробел / тап',
      title: 'УГОЛЁК', subtitle: 'Робот-кочегар мастерской «Гефест» и остывающий Горн',
      sub2: 'Собери весь уголь шахты · прессы, вагонетки, конвейеры',
      back: 'Каталог', lives: 'Жизни', coal: 'Уголь',
      z_shop: 'Мастерская', z_drift: 'Сырой штрек', z_belts: 'Конвейерный ярус', z_rails: 'Рельсовые галереи', z_press: 'Прессовый цех', z_bottom: 'Угольное дно',
      k1: 'Медный ключ', k2: 'Стальной ключ', k3: 'Латунный ключ',
      helmet: 'Каска! Неуязвим', helmetEnd: 'Каска сползла', gear: 'шестерня', roomClear: 'Экран чист!', life: '+1 жизнь',
      beacon: 'Маяк зажжён', gateOpen: 'Весь уголь собран — к Горну!', lost: 'УГОЛЁК ПОВРЕЖДЁН', back2: 'к маяку',
      why_press: 'раздавлен прессом', why_drip: 'залит каплей', why_cart: 'сбит вагонеткой', why_flyer: 'сажник', why_crawler: 'окалыш',
      why_fall: 'слишком высоко', why_spikes: 'обрыв с шипами',
      map: 'КАРТА ШАХТЫ', mapHint: 'Tab / C — закрыть', mapLegend: 'число — уголь на экране · ▲ маяк · цветная черта — дверь под ключ',
      cont: 'Продолжить', rwLife: 'Реклама: +1 жизнь', cardNext: 'пробел / тап — дальше', hintTouch: '◀ ▶ ходить · ● прыжок · ▲ ▼ лестницы · ▦ карта · II пауза',
      rooms: 'экранов', start: 'Собери весь уголь шахты и раздуй Горн',
      hint: '←→ ходить · ↑/Пробел прыжок · ↑↓ лестницы · Tab карта · P пауза',
      foot: '<b>УГОЛЁК</b> · ← → / A D — ходить · Пробел / Z / ↑ — прыжок · ↑ ↓ — лестницы и верёвки · Tab / C — карта шахты · P / Esc — пауза · L язык, T тема, M звук.'
    },
    en: {
      play: 'Play', language: 'Language', theme: 'Theme', sound: 'Sound', on: 'on', off: 'off',
      score: 'Score', level: 'Screen', best: 'Best', bestTime: 'Best time', time: 'Time',
      win: 'THE FORGE IS ABLAZE!', gameover: 'STOKELING WENT COLD',
      pause: 'PAUSE', resume: 'Resume', menu: 'Menu', tapstart: 'space / tap',
      title: 'STOKELING', subtitle: 'The stoker robot of the Hefest workshop and a cooling forge',
      sub2: 'Gather every lump of coal · presses, mine carts, conveyors',
      back: 'Catalog', lives: 'Lives', coal: 'Coal',
      z_shop: 'Workshop', z_drift: 'Damp Drift', z_belts: 'Conveyor Tier', z_rails: 'Rail Galleries', z_press: 'Press Hall', z_bottom: 'Coal Bottom',
      k1: 'Copper key', k2: 'Steel key', k3: 'Brass key',
      helmet: 'Hard hat! Invulnerable', helmetEnd: 'Hard hat slipped', gear: 'gear', roomClear: 'Screen clear!', life: '+1 life',
      beacon: 'Beacon lit', gateOpen: 'All coal gathered — to the forge!', lost: 'STOKELING DAMAGED', back2: 'to the beacon',
      why_press: 'crushed by a press', why_drip: 'hit by a drip', why_cart: 'run over by a cart', why_flyer: 'sootling', why_crawler: 'scaleback',
      why_fall: 'fell too far', why_spikes: 'spiked pit',
      map: 'MINE MAP', mapHint: 'Tab / C — close', mapLegend: 'number — coal left on screen · ▲ beacon · coloured bar — locked door',
      cont: 'Continue', rwLife: 'Watch ad: +1 life', cardNext: 'space / tap — go on', hintTouch: '◀ ▶ walk · ● jump · ▲ ▼ ladders · ▦ map · II pause',
      rooms: 'screens', start: 'Gather all the coal and rekindle the forge',
      hint: '←→ walk · ↑/Space jump · ↑↓ ladders · Tab map · P pause',
      foot: '<b>STOKELING</b> · ← → / A D — walk · Space / Z / ↑ — jump · ↑ ↓ — ladders and ropes · Tab / C — mine map · P / Esc — pause · L language, T theme, M sound.'
    }
  };
  U.STR.tr = {
    play: 'Oyna', language: 'Dil', theme: 'Tema', sound: 'Ses', on: 'açık', off: 'kapalı',
    score: 'Puan', level: 'Ekran', best: 'Rekor', bestTime: 'En iyi süre', time: 'Süre',
    win: 'OCAK ALEVLENDİ!', gameover: 'STOKELING SOĞUDU',
    pause: 'DURAKLATILDI', resume: 'Devam et', menu: 'Ana menü', tapstart: 'boşluk / dokun',
    title: 'STOKELING', subtitle: 'Hefest atölyesinin ateşçi robotu ve soğuyan ocak',
    sub2: 'Madendeki tüm kömürü topla · presler, vagonetler, konveyörler',
    back: 'Katalog', lives: 'Can', coal: 'Kömür',
    z_shop: 'Atölye', z_drift: 'Nemli galeri', z_belts: 'Konveyör katı', z_rails: 'Ray galerileri', z_press: 'Pres atölyesi', z_bottom: 'Kömür dibi',
    k1: 'Bakır anahtar', k2: 'Çelik anahtar', k3: 'Pirinç anahtar',
    helmet: 'Baret! Yenilmez', helmetEnd: 'Baret kaydı', gear: 'dişli', roomClear: 'Ekran temiz!', life: '+1 can',
    beacon: 'İşaret yandı', gateOpen: 'Tüm kömür toplandı — ocağa!', lost: 'STOKELING HASAR ALDI', back2: 'işarete',
    why_press: 'pres ezdi', why_drip: 'damla çarptı', why_cart: 'vagonet çarptı', why_flyer: 'isböceği', why_crawler: 'tufalcık',
    why_fall: 'çok yüksekten düştü', why_spikes: 'dikenli çukur',
    map: 'MADEN HARİTASI', mapHint: 'Tab / C — kapat', mapLegend: 'sayı — ekrandaki kömür · ▲ işaret · renkli çizgi — kilitli kapı',
    cont: 'Devam', rwLife: 'Reklam: +1 can', cardNext: 'boşluk / dokun — devam', hintTouch: '◀ ▶ yürü · ● zıpla · ▲ ▼ merdiven · ▦ harita · II duraklat',
    rooms: 'ekran', start: 'Tüm kömürü topla ve ocağı yeniden yak',
    hint: '←→ yürü · ↑/Boşluk zıpla · ↑↓ merdiven · Tab harita · P duraklat',
    foot: '<b>STOKELING</b> · ← → / A D — yürü · Boşluk / Z / ↑ — zıpla · ↑ ↓ — merdiven ve halatlar · Tab / C — maden haritası · P / Esc — duraklat · L dil, T tema, M ses.'
  };
  U.STR.es = {
    play: 'Jugar', language: 'Idioma', theme: 'Tema', sound: 'Sonido', on: 'sí', off: 'no',
    score: 'Puntos', level: 'Pantalla', best: 'Récord', bestTime: 'Mejor tiempo', time: 'Tiempo',
    win: '¡LA FRAGUA ARDE!', gameover: 'STOKELING SE ENFRIÓ',
    pause: 'PAUSA', resume: 'Continuar', menu: 'Menú principal', tapstart: 'espacio / toca',
    title: 'STOKELING', subtitle: 'El robot fogonero del taller Hefest y una fragua que se enfría',
    sub2: 'Recoge todo el carbón de la mina · prensas, vagonetas, cintas',
    back: 'Catálogo', lives: 'Vidas', coal: 'Carbón',
    z_shop: 'Taller', z_drift: 'Galería húmeda', z_belts: 'Nivel de cintas', z_rails: 'Galerías de raíles', z_press: 'Nave de prensas', z_bottom: 'Fondo de carbón',
    k1: 'Llave de cobre', k2: 'Llave de acero', k3: 'Llave de latón',
    helmet: '¡Casco! Invulnerable', helmetEnd: 'El casco se cayó', gear: 'engranaje', roomClear: '¡Pantalla limpia!', life: '+1 vida',
    beacon: 'Baliza encendida', gateOpen: 'Todo el carbón reunido: ¡a la fragua!', lost: 'STOKELING DAÑADO', back2: 'a la baliza',
    why_press: 'aplastado por una prensa', why_drip: 'alcanzado por una gota', why_cart: 'atropellado por una vagoneta', why_flyer: 'hollinero', why_crawler: 'escamado',
    why_fall: 'caída demasiado alta', why_spikes: 'foso con pinchos',
    map: 'MAPA DE LA MINA', mapHint: 'Tab / C — cerrar', mapLegend: 'número — carbón en pantalla · ▲ baliza · barra de color — puerta cerrada',
    cont: 'Continuar', rwLife: 'Anuncio: +1 vida', cardNext: 'espacio / toca — seguir', hintTouch: '◀ ▶ andar · ● saltar · ▲ ▼ escaleras · ▦ mapa · II pausa',
    rooms: 'pantallas', start: 'Recoge todo el carbón y aviva la fragua',
    hint: '←→ andar · ↑/Espacio saltar · ↑↓ escaleras · Tab mapa · P pausa',
    foot: '<b>STOKELING</b> · ← → / A D — andar · Espacio / Z / ↑ — saltar · ↑ ↓ — escaleras y cuerdas · Tab / C — mapa de la mina · P / Esc — pausa · L idioma, T tema, M sonido.'
  };
  U.STR.pt = {
    play: 'Jogar', language: 'Idioma', theme: 'Tema', sound: 'Som', on: 'lig.', off: 'desl.',
    score: 'Pontos', level: 'Tela', best: 'Recorde', bestTime: 'Melhor tempo', time: 'Tempo',
    win: 'A FORJA ARDE!', gameover: 'STOKELING ESFRIOU',
    pause: 'PAUSA', resume: 'Continuar', menu: 'Menu principal', tapstart: 'espaço / toque',
    title: 'STOKELING', subtitle: 'O robô foguista da oficina Hefest e uma forja esfriando',
    sub2: 'Junte todo o carvão da mina · prensas, vagonetes, esteiras',
    back: 'Catálogo', lives: 'Vidas', coal: 'Carvão',
    z_shop: 'Oficina', z_drift: 'Galeria úmida', z_belts: 'Nível das esteiras', z_rails: 'Galerias de trilhos', z_press: 'Pavilhão das prensas', z_bottom: 'Fundo de carvão',
    k1: 'Chave de cobre', k2: 'Chave de aço', k3: 'Chave de latão',
    helmet: 'Capacete! Invulnerável', helmetEnd: 'O capacete caiu', gear: 'engrenagem', roomClear: 'Tela limpa!', life: '+1 vida',
    beacon: 'Farol aceso', gateOpen: 'Todo o carvão reunido — para a forja!', lost: 'STOKELING DANIFICADO', back2: 'ao farol',
    why_press: 'esmagado pela prensa', why_drip: 'atingido por uma gota', why_cart: 'atropelado pelo vagonete', why_flyer: 'fuliginho', why_crawler: 'carepinha',
    why_fall: 'queda alta demais', why_spikes: 'fosso com espinhos',
    map: 'MAPA DA MINA', mapHint: 'Tab / C — fechar', mapLegend: 'número — carvão na tela · ▲ farol · barra colorida — porta trancada',
    cont: 'Continuar', rwLife: 'Anúncio: +1 vida', cardNext: 'espaço / toque — seguir', hintTouch: '◀ ▶ andar · ● pular · ▲ ▼ escadas · ▦ mapa · II pausa',
    rooms: 'telas', start: 'Junte todo o carvão e reacenda a forja',
    hint: '←→ andar · ↑/Espaço pular · ↑↓ escadas · Tab mapa · P pausa',
    foot: '<b>STOKELING</b> · ← → / A D — andar · Espaço / Z / ↑ — pular · ↑ ↓ — escadas e cordas · Tab / C — mapa da mina · P / Esc — pausa · L idioma, T tema, M som.'
  };
})(typeof window !== 'undefined' ? window : globalThis);
