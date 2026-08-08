/**
 * Puente CardioTwin -> Interactive-3D-Human-Heart-Visualization
 *
 * Copiar este archivo dentro del repo clonado e incluirlo AL FINAL de
 * index.html, despues de que three.js y el loader hayan corrido:
 *
 *     <script src="cardiotwin-bridge.js"></script>
 *
 * QUE HACE Y QUE NO
 * -----------------
 * NO es simulacion 3D. No hay propagacion espacial ni electromecanica.
 * Es el estado del modelo 0D pintado sobre anatomia. Decirlo asi da
 * credibilidad; venderlo como simulacion 3D no sobrevive la primera
 * pregunta de un jurado que sepa del tema.
 *
 * Mapeo:
 *   miocardio         -> oscurece con myocardium_ischemia
 *   arterias coronarias -> brillo con coronary_supply
 *   vasos pulmonares  -> tinte con pulmonary_congestion
 *   toda la malla     -> latido a bpm, tinte global por perfusion_index
 *
 * ATRIBUCION OBLIGATORIA (CC BY-SA 2.1 JP):
 *   Modelo anatomico: BodyParts3D, Database Center for Life Science.
 *   Ponlo visible en el demo, no en un README que nadie abre.
 */
(function () {
  "use strict";

  var API = window.CARDIOTWIN_API || "http://localhost:8000";
  var POLL_MS = 1000;

  // ---------------------------------------------------------------
  // Clasificacion de mallas.
  //
  // Los nombres vienen de BodyParts3D (nomenclatura FMA) y NO los
  // verifique. Abre la consola: el bridge imprime todos los nombres que
  // encontro. Ajusta estos patrones con lo que realmente veas. Es lo
  // primero que hay que corregir y toma dos minutos.
  // ---------------------------------------------------------------
  var PATTERNS = {
    myocardium: /myocard|ventricle|trabecul|muscle|cardiac muscle/i,
    coronary:   /coronary/i,
    pulmonary:  /pulmonary|lung/i,
    valve:      /valve|cusp/i,
  };

  var groups = { myocardium: [], coronary: [], pulmonary: [], valve: [], other: [] };
  var baseColors = new WeakMap();
  var scene = null;
  var indexed = false;

  function findScene() {
    if (window.scene && window.scene.traverse) return window.scene;
    for (var k in window) {
      try {
        var v = window[k];
        if (v && v.traverse && v.type === "Scene") return v;
      } catch (e) { /* getters que lanzan */ }
    }
    return null;
  }

  function indexMeshes() {
    scene = findScene();
    if (!scene) return false;

    var names = [];
    scene.traverse(function (o) {
      if (!o.isMesh || !o.material) return;
      var name = (o.name || "") + " " + ((o.parent && o.parent.name) || "");
      names.push(o.name);

      var bucket = "other";
      for (var key in PATTERNS) {
        if (PATTERNS[key].test(name)) { bucket = key; break; }
      }
      groups[bucket].push(o);

      var mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach(function (m) {
        if (m.color && !baseColors.has(m)) baseColors.set(m, m.color.clone());
      });
    });

    console.log("[cardiotwin] mallas encontradas:", names);
    console.log("[cardiotwin] clasificacion:", {
      miocardio: groups.myocardium.length,
      coronarias: groups.coronary.length,
      pulmonar: groups.pulmonary.length,
      valvulas: groups.valve.length,
      sin_clasificar: groups.other.length,
    });
    if (groups.myocardium.length === 0) {
      console.warn("[cardiotwin] Ninguna malla clasifico como miocardio. " +
                   "Ajusta PATTERNS con los nombres de arriba.");
    }
    indexed = true;
    return true;
  }

  // ---------------------------------------------------------------
  function eachMaterial(list, fn) {
    list.forEach(function (o) {
      var mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach(function (m) {
        var base = baseColors.get(m);
        if (base) fn(m, base);
      });
    });
  }

  var current = null;

  function apply(state) {
    if (!indexed && !indexMeshes()) return;
    current = state;

    // Miocardio isquemico: se oscurece y pierde saturacion.
    var isch = state.myocardium_ischemia || 0;
    eachMaterial(groups.myocardium, function (m, base) {
      m.color.copy(base).multiplyScalar(1.0 - 0.65 * isch);
      if (m.emissive) m.emissive.setRGB(0.22 * isch, 0, 0);
    });

    // Coronarias: brillo proporcional al aporte. Poca perfusion = apagadas.
    var sup = state.coronary_supply != null ? state.coronary_supply : 1;
    eachMaterial(groups.coronary, function (m, base) {
      m.color.copy(base).multiplyScalar(0.45 + 0.55 * sup);
      if (m.emissive) m.emissive.setRGB(0.30 * sup, 0.04 * sup, 0.04 * sup);
    });

    // Vasos pulmonares: la congestion los vuelve mas oscuros y azulados.
    var cong = state.pulmonary_congestion || 0;
    eachMaterial(groups.pulmonary, function (m, base) {
      m.color.copy(base);
      m.color.b = Math.min(1, m.color.b + 0.35 * cong);
      m.color.r = Math.max(0, m.color.r - 0.20 * cong);
    });

    // Tinte global por perfusion: todo pierde color cuando cae.
    var pi = state.perfusion_index != null ? state.perfusion_index : 1;
    eachMaterial(groups.other.concat(groups.valve), function (m, base) {
      m.color.copy(base).multiplyScalar(0.55 + 0.45 * pi);
    });
  }

  // ---------------------------------------------------------------
  // Latido. Escala sutil sincronizada con la FC.
  //
  // La onda del ECG se sintetiza EN EL CLIENTE, nunca se transmite: a
  // 250 Hz serian decenas de miles de mensajes en una demo de 5 minutos.
  // ---------------------------------------------------------------
  var t0 = performance.now();
  function beat() {
    requestAnimationFrame(beat);
    if (!scene || !current || !current.bpm) return;
    var period = 60000 / current.bpm;
    var phase = ((performance.now() - t0) % period) / period;
    // sistole rapida, diastole lenta
    var amp = phase < 0.35
      ? Math.sin((phase / 0.35) * Math.PI) * 0.018
      : 0;
    var s = 1 + amp * (current.perfusion_index != null
                       ? 0.4 + 0.6 * current.perfusion_index : 1);
    scene.scale.set(s, s, s);
  }
  requestAnimationFrame(beat);

  // ---------------------------------------------------------------
  // Dos vias de entrada.
  //
  // postMessage es la preferida: si el 3D vive en un iframe, el padre ya
  // recibe los eventos por Portal y solo los reenvia. Asi el iframe no
  // abre su propia conexion ni duplica trafico.
  // ---------------------------------------------------------------
  window.addEventListener("message", function (e) {
    if (e.data && e.data.type === "cardiotwin:heart3d") apply(e.data.payload);
  });

  // Polling como respaldo, solo si nadie manda postMessage.
  var gotMessage = false;
  window.addEventListener("message", function (e) {
    if (e.data && e.data.type === "cardiotwin:heart3d") gotMessage = true;
  });

  setInterval(function () {
    if (gotMessage) return;
    fetch(API + "/api/heart3d")
      .then(function (r) { return r.json(); })
      .then(apply)
      .catch(function () { /* servidor caido: la malla queda como este */ });
  }, POLL_MS);

  window.cardioTwinBridge = { apply: apply, groups: groups,
                              reindex: indexMeshes };
  console.log("[cardiotwin] bridge activo. API:", API);
})();
