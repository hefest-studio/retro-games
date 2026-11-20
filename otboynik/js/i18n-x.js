/* ОТБОЙНИК · строки TR / ES / PT-BR (поверх RU/EN из js/i18n.js; подключает js/lang-x.js). Ключа нет — EN.
   Название внутри языка одно (Яндекс 5.1.3): в TR/ES/PT — EN-название BUMPERWRIGHT (см. README, «Языки»).
   Перевод — ИИ, вычитан обратным переводом и вторым проходом; носитель языка НЕ проверял. */
(function (global) {
  'use strict';
  var G = global.OTBOYNIK = global.OTBOYNIK || {};
  var ENG = {
    tr: { loading: 'Yükleniyor…', rw_title: 'BİR ŞANS DAHA?', rw_continue: 'Reklam izle: devam et', rw_no: 'Hayır, bitir', rw_fail: 'Reklam şu an yok', rw_hint: 'oyun başına bir kez', rw_got: 'Bonus alındı!' },
    es: { loading: 'Cargando…', rw_title: '¿OTRA OPORTUNIDAD?', rw_continue: 'Ver anuncio: continuar', rw_no: 'No, terminar', rw_fail: 'Anuncio no disponible', rw_hint: 'una vez por partida', rw_got: '¡Bonus obtenido!' },
    pt: { loading: 'Carregando…', rw_title: 'MAIS UMA CHANCE?', rw_continue: 'Ver anúncio: continuar', rw_no: 'Não, encerrar', rw_fail: 'Anúncio indisponível', rw_hint: 'uma vez por partida', rw_got: 'Bônus recebido!' }
  };
  G.STR_X = {
    tr: Object.assign({
      play: 'Oyna', language: 'Dil', theme: 'Tema', sound: 'Ses', on: 'açık', off: 'kapalı',
      score: 'Puan', level: 'Dalga', best: 'Rekor', win: 'ATÖLYE AYAKTA!', gameover: 'KAPI DÜŞTÜ',
      pause: 'DURAKLATILDI', resume: 'Devam et', menu: 'Ana menü', tapstart: 'boşluk / dokun',
      title: 'BUMPERWRIGHT', subtitle: 'Atölye pinbol savunması · yapı destesi',
      hint1: 'Z / ← / A — sol palet · M / → / D — sağ', hint2: 'Boşluk — topu fırlat · ↑ / W / X — sarsma (üst üste en fazla iki)',
      wave: 'DALGA', waveShort: 'Dalga', bossWave: 'KAZIK ÇAKICI GELİYOR', bossSub: 'Kapıya varmadan dişlilerini kır',
      gate: 'Kapı', reach: 'En uzak', bestWave: 'dalga', launchHint: 'Boşluk / dokun — topu fırlat',
      waveClear: 'DALGA PÜSKÜRTÜLDÜ', bonus: 'Bonus',
      pick: 'BİR KART SEÇ', pickHint: '← → seç · boşluk — al · karta dokun', slot: 'NEREYE KURULSUN?', slotHint: '← → yer · boşluk — kur · yere dokun',
      k_build: 'yapı', k_up: 'geliştirme', k_now: 'anında', lvl: 'sv.',
      c_forge: 'Demirci ocağı', c_bell: 'Çan kulesi', c_spring: 'Yaylı duvar', c_magnet: 'Mıknatıs', c_splitter: 'Bölücü', c_repair: 'Kapı onarımı', c_flip: 'Dövme paletler',
      cd_forge: 'Top kızışır: çift hasar ve tutuşturma', cd_bell: 'Çan sesi yakındaki makineleri sersemletir', cd_spring: 'Topu güçle sektirir, makineler etrafından dolaşır',
      cd_magnet: 'Topu kendine çeker, makineler yavaşlar', cd_splitter: 'Bir top daha çıkarır', cd_repair: '+6 kapı dayanıklılığı', cd_flip: 'Paletler daha hızlı ve güçlü vurur',
      e_beetle: 'Kurmalı böcek', e_cart: 'Araba', e_fly: 'Teneke yusufçuk', e_ram: 'Dişli koçbaşı', boss: 'KAZIK ÇAKICI',
      tilt: 'SARSMA', tiltLock: 'EĞİLDİ! paletler kilitlendi', drain: 'top kaçtı: −1 kapı',
      revived: 'KAPI YAMANDI', repaired: 'ONARIM +6', rwRepair: 'Reklam: kapı onarımı +6',
      deck: 'Deste', dk_bench: 'Tezgâh', dk_forge: 'Ocak', dk_bell: 'Çan', dk_magnet: 'Mıknatıs', dk_splitter: 'Bölücü', dk_master: 'Usta',
      dd_bench: 'Boş masa — kartlarla kur', dd_start: 'Baştan masada: {x}', cards: 'Kartlar', nextUnlock: 'Sıradaki', needWave: '{n}. dalgaya ulaş',
      needWin: 'Kazık Çakıcı’yı yen', newUnlock: 'AÇILDI', allOpen: 'Her şey açık'
    }, ENG.tr),
    es: Object.assign({
      play: 'Jugar', language: 'Idioma', theme: 'Tema', sound: 'Sonido', on: 'sí', off: 'no',
      score: 'Puntos', level: 'Oleada', best: 'Récord', win: '¡EL TALLER RESISTE!', gameover: 'LA PUERTA HA CAÍDO',
      pause: 'PAUSA', resume: 'Continuar', menu: 'Menú principal', tapstart: 'espacio / toca',
      title: 'BUMPERWRIGHT', subtitle: 'Pinball de defensa del taller · mazo de construcciones',
      hint1: 'Z / ← / A — aleta izquierda · M / → / D — derecha', hint2: 'Espacio — lanzar bola · ↑ / W / X — empujón (máximo dos seguidos)',
      wave: 'OLEADA', waveShort: 'Oleada', bossWave: 'LLEGA EL MARTINETE', bossSub: 'Rompe sus engranajes antes de que llegue a la puerta',
      gate: 'Puerta', reach: 'Alcance', bestWave: 'oleada', launchHint: 'Espacio / toca — lanza la bola',
      waveClear: 'OLEADA REPELIDA', bonus: 'Bonus',
      pick: 'ELIGE UNA CARTA', pickHint: '← → elegir · espacio — tomar · toca una carta', slot: '¿DÓNDE CONSTRUIR?', slotHint: '← → lugar · espacio — construir · toca un lugar',
      k_build: 'construcción', k_up: 'mejora', k_now: 'al instante', lvl: 'niv.',
      c_forge: 'Fragua', c_bell: 'Campanario', c_spring: 'Muro de resortes', c_magnet: 'Imán', c_splitter: 'Divisor', c_repair: 'Reparar puerta', c_flip: 'Aletas forjadas',
      cd_forge: 'La bola se calienta: daño doble e incendia', cd_bell: 'Su tañido aturde a las máquinas cercanas', cd_spring: 'Rebota la bola con fuerza; las máquinas lo rodean',
      cd_magnet: 'Atrae la bola; las máquinas se atascan', cd_splitter: 'Suelta una bola más', cd_repair: '+6 de resistencia de la puerta', cd_flip: 'Las aletas golpean más rápido y fuerte',
      e_beetle: 'Escarabajo de cuerda', e_cart: 'Carretilla', e_fly: 'Libélula de hojalata', e_ram: 'Ariete de engranajes', boss: 'MARTINETE',
      tilt: 'EMPUJÓN', tiltLock: '¡TILT! aletas trabadas', drain: 'bola perdida: −1 puerta',
      revived: 'PUERTA REMENDADA', repaired: 'REPARACIÓN +6', rwRepair: 'Anuncio: reparar puerta +6',
      deck: 'Mazo', dk_bench: 'Banco de trabajo', dk_forge: 'Fragua', dk_bell: 'Campana', dk_magnet: 'Imán', dk_splitter: 'Divisor', dk_master: 'Maestro',
      dd_bench: 'Mesa vacía — construye con las cartas', dd_start: 'Empieza en la mesa: {x}', cards: 'Cartas', nextUnlock: 'Siguiente', needWave: 'llega a la oleada {n}',
      needWin: 'vence al Martinete', newUnlock: 'DESBLOQUEADO', allOpen: 'Todo desbloqueado'
    }, ENG.es),
    pt: Object.assign({
      play: 'Jogar', language: 'Idioma', theme: 'Tema', sound: 'Som', on: 'ligado', off: 'desligado',
      score: 'Pontos', level: 'Onda', best: 'Recorde', win: 'A OFICINA RESISTIU!', gameover: 'O PORTÃO CAIU',
      pause: 'PAUSA', resume: 'Continuar', menu: 'Menu principal', tapstart: 'espaço / toque',
      title: 'BUMPERWRIGHT', subtitle: 'Pinball de defesa da oficina · baralho de construções',
      hint1: 'Z / ← / A — palheta esquerda · M / → / D — direita', hint2: 'Espaço — lançar a bola · ↑ / W / X — tranco (no máximo dois seguidos)',
      wave: 'ONDA', waveShort: 'Onda', bossWave: 'O BATE-ESTACAS CHEGOU', bossSub: 'Quebre as engrenagens antes que ele chegue ao portão',
      gate: 'Portão', reach: 'Alcance', bestWave: 'onda', launchHint: 'Espaço / toque — lance a bola',
      waveClear: 'ONDA REPELIDA', bonus: 'Bônus',
      pick: 'ESCOLHA UMA CARTA', pickHint: '← → escolher · espaço — pegar · toque numa carta', slot: 'ONDE CONSTRUIR?', slotHint: '← → lugar · espaço — construir · toque num lugar',
      k_build: 'construção', k_up: 'melhoria', k_now: 'na hora', lvl: 'nív.',
      c_forge: 'Forja', c_bell: 'Campanário', c_spring: 'Parede de molas', c_magnet: 'Ímã', c_splitter: 'Divisor', c_repair: 'Reparo do portão', c_flip: 'Palhetas forjadas',
      cd_forge: 'A bola esquenta: dano dobrado e incendeia', cd_bell: 'O badalo atordoa as máquinas por perto', cd_spring: 'Rebate a bola com força; as máquinas contornam',
      cd_magnet: 'Atrai a bola; as máquinas atolam', cd_splitter: 'Solta mais uma bola', cd_repair: '+6 de resistência do portão', cd_flip: 'As palhetas batem mais rápido e forte',
      e_beetle: 'Besouro de corda', e_cart: 'Carrinho', e_fly: 'Libélula de lata', e_ram: 'Aríete de engrenagens', boss: 'BATE-ESTACAS',
      tilt: 'TRANCO', tiltLock: 'TILT! palhetas travadas', drain: 'bola perdida: −1 portão',
      revived: 'PORTÃO REMENDADO', repaired: 'REPARO +6', rwRepair: 'Anúncio: reparar portão +6',
      deck: 'Baralho', dk_bench: 'Bancada', dk_forge: 'Forja', dk_bell: 'Sino', dk_magnet: 'Ímã', dk_splitter: 'Divisor', dk_master: 'Mestre',
      dd_bench: 'Mesa vazia — construa com as cartas', dd_start: 'Começa na mesa: {x}', cards: 'Cartas', nextUnlock: 'Próximo', needWave: 'chegue à onda {n}',
      needWin: 'vença o Bate-estacas', newUnlock: 'LIBERADO', allOpen: 'Tudo liberado'
    }, ENG.pt)
  };
})(typeof window !== 'undefined' ? window : globalThis);
