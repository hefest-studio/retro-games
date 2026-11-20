/* КЛАДКА · строки TR / ES / PT-BR (поверх RU/EN из js/i18n.js; подключает js/lang-x.js). Ключа нет — EN.
   Название внутри языка одно (Яндекс 5.1.3): в TR/ES/PT — EN-название MASONRY (см. README, «Языки»).
   Перевод — ИИ, вычитан обратным переводом и вторым проходом; носитель языка НЕ проверял. */
(function (global) {
  'use strict';
  var K = global.KLADKA = global.KLADKA || {};
  var ENG = {
    tr: { loading: 'Yükleniyor…', rw_title: 'BİR ŞANS DAHA?', rw_continue: 'Reklam izle: devam et', rw_no: 'Hayır, bitir', rw_fail: 'Reklam şu an yok', rw_hint: 'oyun başına bir kez', rw_got: 'Bonus alındı!' },
    es: { loading: 'Cargando…', rw_title: '¿OTRA OPORTUNIDAD?', rw_continue: 'Ver anuncio: continuar', rw_no: 'No, terminar', rw_fail: 'Anuncio no disponible', rw_hint: 'una vez por partida', rw_got: '¡Bonus obtenido!' },
    pt: { loading: 'Carregando…', rw_title: 'MAIS UMA CHANCE?', rw_continue: 'Ver anúncio: continuar', rw_no: 'Não, encerrar', rw_fail: 'Anúncio indisponível', rw_hint: 'uma vez por partida', rw_got: 'Bônus recebido!' }
  };
  K.STR_X = {
    tr: Object.assign({
      play: 'Oyna', language: 'Dil', theme: 'Tema', sound: 'Ses', on: 'açık', off: 'kapalı',
      score: 'Puan', level: 'Sv.', best: 'Rekor', win: 'FIRIN SÖNDÜRÜLDÜ!', gameover: 'DUVAR AYAKTA KALDI',
      pause: 'DURAKLATILDI', resume: 'Devam et', menu: 'Ana menü', tapstart: 'boşluk / dokun',
      title: 'MASONRY', subtitle: 'Duvarı yık · 10 seviye · fırının kalbi',
      back: 'Katalog', lives: 'Canlar',
      ready: 'SEVİYE', launch: 'Boşluk / tıkla — çekirdeği fırlat', bossSub: 'Fırının kalbine vur, malayı kıvılcımlardan koru',
      clear: 'DUVAR YIKILDI', bonus: 'Bonus', lost: 'ÇEKİRDEK KAYBOLDU', heart: 'Fırının kalbi', draft: 'FIRIN ÇEKİŞİ',
      lv_base: 'Temel', lv_arch: 'Kemer', lv_checker: 'Dama', lv_gates: 'Kapılar', lv_flue: 'Baca',
      lv_stairs: 'Merdiven', lv_grate: 'Izgara', lv_bastion: 'Burç', lv_hearth: 'Ocak', lv_smelter: 'Ergitme fırını',
      pw_wide: 'GENİŞLİK', pw_narrow: 'DARLIK', pw_triple: 'ÜÇLÜ', pw_glue: 'REÇİNE', pw_cutter: 'KESİCİ', pw_chill: 'SOĞUTMA', pw_life: 'YEDEK',
      hint: 'Fare / ← → — mala · Boşluk — fırlat ve kesici · P — duraklat',
      nextLevel: 'Boşluk / dokun — devam', revived: 'BİR ÇEKİRDEK DAHA', rwLife: 'Reklam: +1 çekirdek',
      lvPick: 'Seviye', unlockedLv: 'Açık', st_clear: 'Duvar yıkıldı', st_safe: 'Çekirdek kaybı yok', st_fast: '{n} sn altında', opened: 'SEVİYE {n} AÇILDI',
      foot: '<b>MASONRY</b> · fare, parmak veya ← → / A D — mala · Boşluk / tıklama / dokunma — çekirdeği fırlat ve kesiciyi ateşle · P — duraklat · L dil, T tema, M ses.'
    }, ENG.tr),
    es: Object.assign({
      play: 'Jugar', language: 'Idioma', theme: 'Tema', sound: 'Sonido', on: 'sí', off: 'no',
      score: 'Puntos', level: 'Niv.', best: 'Récord', win: '¡FUNDICIÓN APAGADA!', gameover: 'EL MURO RESISTE',
      pause: 'PAUSA', resume: 'Continuar', menu: 'Menú principal', tapstart: 'espacio / toca',
      title: 'MASONRY', subtitle: 'Derriba el muro · 10 niveles · corazón del horno',
      back: 'Catálogo', lives: 'Vidas',
      ready: 'NIVEL', launch: 'Espacio / clic — lanza el núcleo', bossSub: 'Golpea el corazón del horno, protege la llana de las chispas',
      clear: 'MURO DERRIBADO', bonus: 'Bonus', lost: 'NÚCLEO PERDIDO', heart: 'Corazón del horno', draft: 'TIRO DEL HORNO',
      lv_base: 'Cimientos', lv_arch: 'Arco', lv_checker: 'Damero', lv_gates: 'Puertas', lv_flue: 'Chimenea',
      lv_stairs: 'Escalera', lv_grate: 'Rejilla', lv_bastion: 'Bastión', lv_hearth: 'Fragua', lv_smelter: 'Fundición',
      pw_wide: 'AMPLITUD', pw_narrow: 'ESTRECHEZ', pw_triple: 'TRIPLE', pw_glue: 'RESINA', pw_cutter: 'CORTADOR', pw_chill: 'FRÍO', pw_life: 'REPUESTO',
      hint: 'Ratón / ← → — llana · Espacio — lanzar y cortador · P — pausa',
      nextLevel: 'Espacio / toca — seguir', revived: 'UN NÚCLEO MÁS', rwLife: 'Anuncio: +1 núcleo',
      lvPick: 'Nivel', unlockedLv: 'Abiertos', st_clear: 'Muro derribado', st_safe: 'Sin perder núcleo', st_fast: 'En menos de {n} s', opened: 'NIVEL {n} DESBLOQUEADO',
      foot: '<b>MASONRY</b> · ratón, dedo o ← → / A D — llana · Espacio / clic / toque — lanza el núcleo y dispara el cortador · P — pausa · L idioma, T tema, M sonido.'
    }, ENG.es),
    pt: Object.assign({
      play: 'Jogar', language: 'Idioma', theme: 'Tema', sound: 'Som', on: 'ligado', off: 'desligado',
      score: 'Pontos', level: 'Fase', best: 'Recorde', win: 'FUNDIÇÃO APAGADA!', gameover: 'O MURO RESISTIU',
      pause: 'PAUSA', resume: 'Continuar', menu: 'Menu principal', tapstart: 'espaço / toque',
      title: 'MASONRY', subtitle: 'Derrube o muro · 10 fases · coração da fornalha',
      back: 'Catálogo', lives: 'Vidas',
      ready: 'FASE', launch: 'Espaço / clique — lance o núcleo', bossSub: 'Acerte o coração da fornalha, proteja a colher das faíscas',
      clear: 'MURO DERRUBADO', bonus: 'Bônus', lost: 'NÚCLEO PERDIDO', heart: 'Coração da fornalha', draft: 'TIRAGEM DA FORNALHA',
      lv_base: 'Alicerce', lv_arch: 'Arco', lv_checker: 'Xadrez', lv_gates: 'Portões', lv_flue: 'Chaminé',
      lv_stairs: 'Escada', lv_grate: 'Grelha', lv_bastion: 'Bastião', lv_hearth: 'Forja', lv_smelter: 'Fundição',
      pw_wide: 'AMPLO', pw_narrow: 'ESTREITO', pw_triple: 'TRIPLO', pw_glue: 'RESINA', pw_cutter: 'CORTADOR', pw_chill: 'FRIO', pw_life: 'RESERVA',
      hint: 'Mouse / ← → — colher de pedreiro · Espaço — lançar e cortador · P — pausa',
      nextLevel: 'Espaço / toque — continuar', revived: 'MAIS UM NÚCLEO', rwLife: 'Anúncio: +1 núcleo',
      lvPick: 'Fase', unlockedLv: 'Liberadas', st_clear: 'Muro derrubado', st_safe: 'Sem perder núcleo', st_fast: 'Em menos de {n} s', opened: 'FASE {n} LIBERADA',
      foot: '<b>MASONRY</b> · mouse, dedo ou ← → / A D — colher de pedreiro · Espaço / clique / toque — lança o núcleo e dispara o cortador · P — pausa · L idioma, T tema, M som.'
    }, ENG.pt)
  };
})(typeof window !== 'undefined' ? window : globalThis);
