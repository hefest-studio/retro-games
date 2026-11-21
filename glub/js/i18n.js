/* ГЛУБЬ · i18n (RU/EN/TR/ES/PT — движок v2.8 берёт языки из ключей strings; название: RU — ГЛУБЬ, EN/TR/ES/PT — LAMPDIVER). GLUB.STR — таблицы для Arcade.createGame({strings}).
   Ключи play/language/theme/... нужны стандартным экранам движка; остальные — игре. */
(function (global) {
  'use strict';
  var Gb = global.GLUB = global.GLUB || {};
  Gb.STR = {
    ru: {
      play: 'Играть', language: 'Язык', theme: 'Тема', sound: 'Звук', on: 'вкл', off: 'выкл',
      score: 'Счёт', level: 'Экран', best: 'Рекорд', bestTime: 'Лучшее время', time: 'Время',
      win: 'СЕРДЦЕ ГОРНА ПРОБУЖДЕНО!', gameover: 'ВОДОЛАЗ НЕ ВЕРНУЛСЯ',
      pause: 'ПАУЗА', resume: 'Продолжить', menu: 'В меню', tapstart: 'пробел / тап',
      title: 'ГЛУБЬ', subtitle: 'Шахта Древнего Горна под мастерской «Гефест»',
      sub2: 'Водолаз-рудознатец и механический крот Бурик · 8 кристаллов-ключей',
      back: 'Каталог', lives: 'Жизни', energy: 'ЭНЕРГИЯ',
      z_adit: 'Штольни мастерской', z_vein: 'Рудная жила', z_grotto: 'Мерцающие гроты', z_forge: 'Жар Горна', z_heart: 'Сердце Горна',
      c1: 'Огнецвет', c2: 'Синегор', c3: 'Зеленец', c4: 'Медовик', c5: 'Сиреневец', c6: 'Белояр', c7: 'Кровник', c8: 'Сумрачник',
      crystal: 'Кристалл', beacon: 'Маяк зажжён', refill: 'Энергия восполнена', gateOpen: 'Печать Горна открыта!', gateHint: 'Печать: нужны все 8 кристаллов',
      stun: 'Оглушён!', dug: 'Бурик прогрыз проход', clank: 'Твёрдая порода', tank: '+энергия', lost: 'СКАФАНДР ПРОБИТ', back2: 'к маяку',
      kill: 'ржавень', mole: 'БУРИК', moleOut: 'в деле', moleHome: 'рядом',
      map: 'КАРТА ШАХТЫ', mapHint: 'Tab / C — закрыть', mapLegend: '◆ кристалл · ▲ маяк · ┄ мягкая порода · ▼ провал',
      cont: 'Продолжить', rwLife: 'Реклама: +1 жизнь',
      rooms: 'экранов', start: 'Найди 8 кристаллов-ключей и открой Печать',
      hint: '←→ ходить · ↑/Пробел прыжок · ↑↓ лестницы · X крот · Tab карта · P пауза',
      foot: '<b>ГЛУБЬ</b> · ← → / A D — ходить · Пробел / Z / ↑ — прыжок · ↑ ↓ — лестницы · X / Shift — выпустить крота Бурика (с ↓ — копать вниз) · Tab / C — карта · P / Esc — пауза · L язык, T тема, M звук.'
    },
    en: {
      play: 'Play', language: 'Language', theme: 'Theme', sound: 'Sound', on: 'on', off: 'off',
      score: 'Score', level: 'Screen', best: 'Best', bestTime: 'Best time', time: 'Time',
      win: 'THE FORGE HEART AWAKENS!', gameover: 'THE DIVER IS LOST',
      pause: 'PAUSE', resume: 'Resume', menu: 'Menu', tapstart: 'space / tap',
      title: 'LAMPDIVER', subtitle: 'The Ancient Forge mine beneath the Hefest workshop',
      sub2: 'An ore-diver and Burik the mechanical mole · 8 key crystals',
      back: 'Catalog', lives: 'Lives', energy: 'ENERGY',
      z_adit: 'Workshop Adits', z_vein: 'Ore Vein', z_grotto: 'Glimmer Grottoes', z_forge: 'Forge Heat', z_heart: 'Forge Heart',
      c1: 'Firebloom', c2: 'Bluepeak', c3: 'Greenling', c4: 'Honeystone', c5: 'Lilacite', c6: 'Whiteblaze', c7: 'Bloodvein', c8: 'Duskstone',
      crystal: 'Crystal', beacon: 'Beacon lit', refill: 'Energy restored', gateOpen: 'The Forge Seal is open!', gateHint: 'The Seal needs all 8 crystals',
      stun: 'Stunned!', dug: 'Burik dug through', clank: 'Hard rock', tank: '+energy', lost: 'SUIT BREACHED', back2: 'to the beacon',
      kill: 'rustling', mole: 'BURIK', moleOut: 'digging', moleHome: 'ready',
      map: 'MINE MAP', mapHint: 'Tab / C — close', mapLegend: '◆ crystal · ▲ beacon · ┄ soft rock · ▼ drop',
      cont: 'Continue', rwLife: 'Watch ad: +1 life',
      rooms: 'screens', start: 'Find 8 key crystals and open the Seal',
      hint: '←→ walk · ↑/Space jump · ↑↓ ladders · X mole · Tab map · P pause',
      foot: '<b>LAMPDIVER</b> · ← → / A D — walk · Space / Z / ↑ — jump · ↑ ↓ — ladders · X / Shift — send Burik the mole (with ↓ — dig down) · Tab / C — map · P / Esc — pause · L language, T theme, M sound.'
    }
  };
  Gb.STR.tr = {
    play: 'Oyna', language: 'Dil', theme: 'Tema', sound: 'Ses', on: 'açık', off: 'kapalı',
    score: 'Puan', level: 'Ekran', best: 'Rekor', bestTime: 'En iyi süre', time: 'Süre',
    win: 'OCAK KALBİ UYANDI!', gameover: 'DALGIÇ DÖNMEDİ',
    pause: 'DURAKLATILDI', resume: 'Devam', menu: 'Menü', tapstart: 'boşluk / dokun',
    title: 'LAMPDIVER', subtitle: 'Hefest atölyesinin altındaki Kadim Ocak madeni',
    sub2: 'Maden dalgıcı ve mekanik köstebek Burik · 8 anahtar kristal',
    back: 'Katalog', lives: 'Can', energy: 'ENERJİ',
    z_adit: 'Atölye Galerileri', z_vein: 'Cevher Damarı', z_grotto: 'Parıltılı Mağaralar', z_forge: 'Ocak Sıcağı', z_heart: 'Ocak Kalbi',
    c1: 'Ateşçiçeği', c2: 'Mavitepe', c3: 'Yeşilce', c4: 'Baltaşı', c5: 'Leylakit', c6: 'Akalev', c7: 'Kandamar', c8: 'Alacakaranlık',
    crystal: 'Kristal', beacon: 'Fener yandı', refill: 'Enerji doldu', gateOpen: 'Ocak Mührü açıldı!', gateHint: 'Mühür için 8 kristalin hepsi gerek',
    stun: 'Sersemledi!', dug: 'Burik geçit açtı', clank: 'Sert kaya', tank: '+enerji', lost: 'GİYSİ DELİNDİ', back2: 'fenere',
    kill: 'pas böceği', mole: 'BURİK', moleOut: 'kazıyor', moleHome: 'yanında',
    map: 'MADEN HARİTASI', mapHint: 'Tab / C — kapat', mapLegend: '◆ kristal · ▲ fener · ┄ yumuşak kaya · ▼ çukur',
    cont: 'Devam et', rwLife: 'Reklam: +1 can',
    rooms: 'ekran', start: '8 anahtar kristali bul ve Mührü aç',
    hint: '←→ yürü · ↑/Boşluk zıpla · ↑↓ merdiven · X köstebek · Tab harita · P duraklat',
    foot: '<b>LAMPDIVER</b> · ← → / A D — yürü · Boşluk / Z / ↑ — zıpla · ↑ ↓ — merdiven · X / Shift — köstebek Burik’i gönder (↓ ile — aşağı kaz) · Tab / C — harita · P / Esc — duraklat · L dil, T tema, M ses.'
  };
  Gb.STR.es = {
    play: 'Jugar', language: 'Idioma', theme: 'Tema', sound: 'Sonido', on: 'sí', off: 'no',
    score: 'Puntos', level: 'Pantalla', best: 'Récord', bestTime: 'Mejor tiempo', time: 'Tiempo',
    win: '¡DESPIERTA EL CORAZÓN DE LA FRAGUA!', gameover: 'EL BUZO NO VOLVIÓ',
    pause: 'PAUSA', resume: 'Seguir', menu: 'Menú', tapstart: 'espacio / toca',
    title: 'LAMPDIVER', subtitle: 'La mina de la Fragua Antigua bajo el taller Hefest',
    sub2: 'Un buzo minero y Burik, el topo mecánico · 8 cristales llave',
    back: 'Catálogo', lives: 'Vidas', energy: 'ENERGÍA',
    z_adit: 'Galerías del taller', z_vein: 'Veta de mineral', z_grotto: 'Grutas brillantes', z_forge: 'Calor de la Fragua', z_heart: 'Corazón de la Fragua',
    c1: 'Flor de fuego', c2: 'Picoazul', c3: 'Verdín', c4: 'Piedramiel', c5: 'Lilita', c6: 'Albor', c7: 'Vena roja', c8: 'Ocaso',
    crystal: 'Cristal', beacon: 'Baliza encendida', refill: 'Energía repuesta', gateOpen: '¡El Sello de la Fragua se abrió!', gateHint: 'El Sello pide los 8 cristales',
    stun: '¡Aturdido!', dug: 'Burik abrió paso', clank: 'Roca dura', tank: '+energía', lost: 'TRAJE PERFORADO', back2: 'a la baliza',
    kill: 'herrumbrón', mole: 'BURIK', moleOut: 'cavando', moleHome: 'cerca',
    map: 'MAPA DE LA MINA', mapHint: 'Tab / C — cerrar', mapLegend: '◆ cristal · ▲ baliza · ┄ roca blanda · ▼ caída',
    cont: 'Continuar', rwLife: 'Anuncio: +1 vida',
    rooms: 'pantallas', start: 'Encuentra 8 cristales llave y abre el Sello',
    hint: '←→ andar · ↑/Espacio saltar · ↑↓ escaleras · X topo · Tab mapa · P pausa',
    foot: '<b>LAMPDIVER</b> · ← → / A D — andar · Espacio / Z / ↑ — saltar · ↑ ↓ — escaleras · X / Shift — enviar al topo Burik (con ↓ — cavar abajo) · Tab / C — mapa · P / Esc — pausa · L idioma, T tema, M sonido.'
  };
  Gb.STR.pt = {
    play: 'Jogar', language: 'Idioma', theme: 'Tema', sound: 'Som', on: 'lig.', off: 'desl.',
    score: 'Pontos', level: 'Tela', best: 'Recorde', bestTime: 'Melhor tempo', time: 'Tempo',
    win: 'O CORAÇÃO DA FORJA DESPERTOU!', gameover: 'O MERGULHADOR NÃO VOLTOU',
    pause: 'PAUSA', resume: 'Continuar', menu: 'Menu', tapstart: 'espaço / toque',
    title: 'LAMPDIVER', subtitle: 'A mina da Forja Antiga sob a oficina Hefest',
    sub2: 'Um mergulhador mineiro e Burik, a toupeira mecânica · 8 cristais-chave',
    back: 'Catálogo', lives: 'Vidas', energy: 'ENERGIA',
    z_adit: 'Galerias da oficina', z_vein: 'Veio de minério', z_grotto: 'Grutas cintilantes', z_forge: 'Calor da Forja', z_heart: 'Coração da Forja',
    c1: 'Flor-de-fogo', c2: 'Picoazul', c3: 'Verdinho', c4: 'Pedramel', c5: 'Lilasita', c6: 'Alvorada', c7: 'Veia-rubra', c8: 'Crepúsculo',
    crystal: 'Cristal', beacon: 'Farol aceso', refill: 'Energia restaurada', gateOpen: 'O Selo da Forja se abriu!', gateHint: 'O Selo precisa dos 8 cristais',
    stun: 'Atordoado!', dug: 'Burik abriu passagem', clank: 'Rocha dura', tank: '+energia', lost: 'TRAJE FURADO', back2: 'ao farol',
    kill: 'ferrugento', mole: 'BURIK', moleOut: 'cavando', moleHome: 'por perto',
    map: 'MAPA DA MINA', mapHint: 'Tab / C — fechar', mapLegend: '◆ cristal · ▲ farol · ┄ rocha mole · ▼ queda',
    cont: 'Continuar', rwLife: 'Anúncio: +1 vida',
    rooms: 'telas', start: 'Ache 8 cristais-chave e abra o Selo',
    hint: '←→ andar · ↑/Espaço pular · ↑↓ escadas · X toupeira · Tab mapa · P pausa',
    foot: '<b>LAMPDIVER</b> · ← → / A D — andar · Espaço / Z / ↑ — pular · ↑ ↓ — escadas · X / Shift — enviar a toupeira Burik (com ↓ — cavar para baixo) · Tab / C — mapa · P / Esc — pausa · L idioma, T tema, M som.'
  };
})(typeof window !== 'undefined' ? window : globalThis);
