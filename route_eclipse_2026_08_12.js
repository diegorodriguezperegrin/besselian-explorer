// =========================================================================
// RUTA CINEMÁTICA: GRAN ECLIPSE TOTAL DEL 12 DE AGOSTO DE 2026
// Plano secuencia continuo sin cortes ni teletransportes
// =========================================================================
window.ECLIPSE_ROUTES = window.ECLIPSE_ROUTES || {};
window.ECLIPSE_ROUTES["2026_08_12"] = {
  "id": "eclipse_2026_08_12",
  "title": "Gran Eclipse Total del 12 de Agosto de 2026",
  "date": "2026-08-12",
  "year": 2026,
  "month": 8,
  "day": 12,
  "cat_no": 9566,
  "totalDurationSec": 75.0,
  "introDuration": 4.0,
  "scenes": [
    {
      "timeStart": 0.0,
      "duration": 10.0,
      "title": "1/6 · Encuentro polar y despertar de la umbra",
      "desc": "La cámara enfoca la Luna en el espacio profundo y gira hacia el Polo Norte, siendo testigo del nacimiento de la umbra en Siberia y su descenso por el casquete polar hacia Groenlandia.",
      "camStart": { "lat": 78.0, "lng": 110.0, "radius": 240.0 },
      "camEnd":   { "lat": 76.0, "lng": -24.0, "radius": 84.0 },
      "targetStart": "moon",
      "targetEnd":   "shadow",
      "targetTurnEnd": 0.38,
      "horizonBlendStart": 0.0,
      "horizonBlendEnd": 1.0,
      "horizonBlendTurnStart": 0.38,
      "tEclipseStart": -0.990,
      "tEclipseEnd":   -0.550,
      "showSpaceCones": true
    },
    {
      "timeStart": 10.0,
      "duration": 12.0,
      "title": "2/6 · Glaciares de Groenlandia y fiordos de Islandia",
      "desc": "Vuelo orbital rasante sobre el océano helado y las costas volcánicas de Islandia, donde se alcanza el punto de máximo eclipse y mayor duración del fenómeno en tierra.",
      "camStart": { "lat": 76.0, "lng": -24.0, "radius": 84.0 },
      "camEnd":   { "lat": 63.0, "lng": -23.0, "radius": 76.0 },
      "targetStart": "shadow",
      "targetEnd":   "shadow",
      "horizonBlendStart": 1.0,
      "horizonBlendEnd": 1.0,
      "tEclipseStart": -0.550,
      "tEclipseEnd":   -0.150,
      "showSpaceCones": false
    },
    {
      "timeStart": 22.0,
      "duration": 13.0,
      "title": "3/6 · Gran salto por el Atlántico Norte",
      "desc": "Persecución aérea de la umbra a más de 3.000 km/h sobre las aguas abiertas del Atlántico, manteniendo el horizonte nivelado en dirección al Golfo de Vizcaya.",
      "camStart": { "lat": 63.0, "lng": -23.0, "radius": 76.0 },
      "camEnd":   { "lat": 47.0, "lng": -11.0, "radius": 74.0 },
      "targetStart": "shadow",
      "targetEnd":   "shadow",
      "horizonBlendStart": 1.0,
      "horizonBlendEnd": 1.0,
      "tEclipseStart": -0.150,
      "tEclipseEnd":   0.440,
      "showSpaceCones": false
    },
    {
      "timeStart": 35.0,
      "duration": 13.0,
      "title": "4/6 · Entrada en la Península: De la Costa Cantábrica a la Meseta",
      "desc": "La totalidad toca tierra en España barriendo Galicia, Asturias y Cantabria: la umbra cubre a gran velocidad León, Palencia, Burgos y Valladolid con una dramática caída de luz.",
      "camStart": { "lat": 47.0, "lng": -11.0, "radius": 74.0 },
      "camEnd":   { "lat": 42.5, "lng": -3.5,  "radius": 73.0 },
      "targetStart": "shadow",
      "targetEnd":   "shadow",
      "horizonBlendStart": 1.0,
      "horizonBlendEnd": 1.0,
      "tEclipseStart": 0.440,
      "tEclipseEnd":   0.515,
      "showSpaceCones": false
    },
    {
      "timeStart": 48.0,
      "duration": 13.0,
      "title": "5/6 · Valle del Ebro y Sistema Ibérico hacia el ocaso",
      "desc": "La cámara persigue la sombra a través de Soria, Zaragoza, Lleida, Tarragona y Castellón mientras el Sol desciende hacia los montes en un cielo de profundo crepúsculo.",
      "camStart": { "lat": 42.5, "lng": -3.5,  "radius": 73.0 },
      "camEnd":   { "lat": 39.5, "lng": 1.5,   "radius": 80.0 },
      "targetStart": "shadow",
      "targetEnd":   "sun",
      "horizonBlendStart": 1.0,
      "horizonBlendEnd": 1.0,
      "tEclipseStart": 0.515,
      "tEclipseEnd":   0.550,
      "showSpaceCones": false
    },
    {
      "timeStart": 61.0,
      "duration": 14.0,
      "title": "6/6 · Apoteosis crepuscular en las Islas Baleares",
      "desc": "Contraluz sublime hacia el disco solar eclipsado que roza el horizonte marítimo sobre Mallorca e Ibiza: una puesta de sol en totalidad antes de alejarnos hacia el espacio.",
      "camStart": { "lat": 39.5, "lng": 1.5,   "radius": 80.0 },
      "camEnd":   { "lat": 34.0, "lng": 12.0,  "radius": 240.0 },
      "targetStart": "sun",
      "targetEnd":   "earth",
      "horizonBlendStart": 1.0,
      "horizonBlendEnd": 0.0,
      "tEclipseStart": 0.550,
      "tEclipseEnd":   0.575,
      "showSpaceCones": true
    }
  ]
};

// Indexación canónica adicional por número de catálogo NASA
window.ECLIPSE_ROUTES[9566] = window.ECLIPSE_ROUTES["2026_08_12"];
