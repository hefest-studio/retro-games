/* КАСКАД · строки TR / ES / PT-BR (поверх RU/EN в index.html; подключает js/lang-x.js). Ключа нет — EN.
   Название внутри языка одно (Яндекс 5.1.3): в TR/ES/PT — EN-название CASCADE (см. README, «Языки»).
   Перевод — ИИ, вычитан обратным переводом и вторым проходом; носитель языка НЕ проверял. */
(function (global) {
  'use strict';
  var TT = global.TT = global.TT || {};
  TT.STR_X = {
    tr: {
      play: 'Oyna', language: 'Dil', theme: 'Tema', sound: 'Ses', on: 'açık', off: 'kapalı',
      score: 'Puan', level: 'Sv.', lines: 'Satır', best: 'Rekor', next: 'Sıradaki', hold: 'Yedek',
      win: 'KAZANDIN!', gameover: 'OYUN BİTTİ', pause: 'DURAKLATILDI', resume: 'Devam et', menu: 'Ana menü', tapstart: 'boşluk / dokun',
      title: 'CASCADE', subtitle: 'Satırları tamamla · hedef: 40',
      daily: 'Günlük mücadele', dailyBest: 'Günün rekoru', dailyNew: 'Yeni günlük rekor!', streak: 'Gün serisi', dayTag: 'GÜN', lb: 'Liderler',
      rwRows: 'Reklam: alttaki 2 sırayı sil',
      loading: 'Yükleniyor…', rw_title: 'BİR ŞANS DAHA?', rw_continue: 'Reklam izle: devam et', rw_no: 'Hayır, bitir', rw_fail: 'Reklam şu an yok', rw_hint: 'oyun başına bir kez', rw_got: 'Bonus alındı!'
    },
    es: {
      play: 'Jugar', language: 'Idioma', theme: 'Tema', sound: 'Sonido', on: 'sí', off: 'no',
      score: 'Puntos', level: 'Niv.', lines: 'Líneas', best: 'Récord', next: 'Siguiente', hold: 'Reserva',
      win: '¡VICTORIA!', gameover: 'FIN DEL JUEGO', pause: 'PAUSA', resume: 'Continuar', menu: 'Menú principal', tapstart: 'espacio / toca',
      title: 'CASCADE', subtitle: 'Completa líneas · meta: 40',
      daily: 'Reto diario', dailyBest: 'Récord del día', dailyNew: '¡Nuevo récord del día!', streak: 'Días seguidos', dayTag: 'DÍA', lb: 'Clasificación',
      rwRows: 'Anuncio: borra 2 filas de abajo',
      loading: 'Cargando…', rw_title: '¿OTRA OPORTUNIDAD?', rw_continue: 'Ver anuncio: continuar', rw_no: 'No, terminar', rw_fail: 'Anuncio no disponible', rw_hint: 'una vez por partida', rw_got: '¡Bonus obtenido!'
    },
    pt: {
      play: 'Jogar', language: 'Idioma', theme: 'Tema', sound: 'Som', on: 'ligado', off: 'desligado',
      score: 'Pontos', level: 'Nív.', lines: 'Linhas', best: 'Recorde', next: 'Próxima', hold: 'Reserva',
      win: 'VITÓRIA!', gameover: 'FIM DE JOGO', pause: 'PAUSA', resume: 'Continuar', menu: 'Menu principal', tapstart: 'espaço / toque',
      title: 'CASCADE', subtitle: 'Complete linhas · meta: 40',
      daily: 'Desafio diário', dailyBest: 'Recorde do dia', dailyNew: 'Novo recorde do dia!', streak: 'Dias seguidos', dayTag: 'DIA', lb: 'Ranking',
      rwRows: 'Anúncio: limpar 2 linhas de baixo',
      loading: 'Carregando…', rw_title: 'MAIS UMA CHANCE?', rw_continue: 'Ver anúncio: continuar', rw_no: 'Não, encerrar', rw_fail: 'Anúncio indisponível', rw_hint: 'uma vez por partida', rw_got: 'Bônus recebido!'
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
