/* МЕДНИЦА · сохранение: localStorage (ключ arcade.mednitsa.save) + облако площадки (Platform.save('mednitsa.save')).
   Из двух копий берётся «дальше продвинутая»: больше клейм за всё время, затем больше заработано за всё время, затем свежее.
   Без DOM: хранилища передаются снаружи — так это проверяется в тестах. */
(function (global) {
  'use strict';
  var M = global.MEDNITSA = global.MEDNITSA || {};
  var KEY = 'arcade.mednitsa.save', CLOUD = 'mednitsa.save';

  function parse(raw) { if (raw == null || raw === '') return null; try { var o = typeof raw === 'string' ? JSON.parse(raw) : raw; return o && typeof o === 'object' && Array.isArray(o.lv) ? o : null; } catch (e) { return null; } }
  function rank(s) { return s ? [s.marksEver || 0, s.lifeEarned || 0, s.saved || 0] : [-1, -1, -1]; }
  function better(a, b) { var A = rank(a), B = rank(b); for (var i = 0; i < 3; i++) { if (A[i] > B[i]) return a; if (B[i] > A[i]) return b; } return a || b; }

  // io = { get(key), set(key, v) } — localStorage; cloud = { peek(key), save(key, v) } | null
  function Saver(io, cloud) {
    var lastCloud = 0;
    return {
      KEY: KEY, CLOUD: CLOUD,
      local: function () { return parse(io.get(KEY)); },
      cloud: function () { return cloud ? parse(cloud.peek(CLOUD)) : null; },
      // лучшее из локального и облака (null — новой игры)
      pick: function () { return better(this.local(), this.cloud()); },
      write: function (s, now, toCloud) {
        s.saved = now || s.saved || 0; var json = JSON.stringify(s); io.set(KEY, json);
        if (cloud && (toCloud || now - lastCloud > 15000)) { lastCloud = now; try { cloud.save(CLOUD, json); } catch (e) {} }
        return json.length;
      }
    };
  }
  M.save = { Saver: Saver, parse: parse, better: better, KEY: KEY, CLOUD: CLOUD };
})(typeof window !== 'undefined' ? window : globalThis);
