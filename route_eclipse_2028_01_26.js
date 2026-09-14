// =========================================================================
// RUTA CINEMÁTICA: GRAN ECLIPSE ANULAR DEL 26 DE ENERO DE 2028
// Plano secuencia continuo sin cortes ni teletransportes
// =========================================================================
window.ECLIPSE_ROUTES = window.ECLIPSE_ROUTES || {};
window.ECLIPSE_ROUTES["2028_01_26"] = {
  "id": "eclipse_2028_01_26",
  "title": "Gran Eclipse Anular del 26 de Enero de 2028",
  "date": "2028-01-26",
  "year": 2028,
  "month": 1,
  "day": 26,
  "cat_no": 9569,
  "totalDurationSec": 75.0,
  "introDuration": 4.0,
  "scenes": [
    {
      "timeStart": 0.0,
      "duration": 10.0,
      "title": "1/6 · Encuentro en el Pacífico y selva amazónica",
      "desc": "La cámara enfoca la Luna en el espacio y gira hacia la Tierra ecuatorial: la antumbra nace en el Pacífico y cruza los Andes hacia la inmensa cuenca del Amazonas.",
      "camStart": { "lat": 2.0,  "lng": -105.0, "radius": 240.0 },
      "camEnd":   { "lat": -2.0, "lng": -65.0,  "radius": 84.0 },
      "targetStart": "moon",
      "targetEnd":   "shadow",
      "targetTurnEnd": 0.38,
      "horizonBlendStart": 0.0,
      "horizonBlendEnd": 1.0,
      "horizonBlendTurnStart": 0.38,
      "tEclipseStart": -1.650,
      "tEclipseEnd":   -0.500,
      "showSpaceCones": true
    },
    {
      "timeStart": 10.0,
      "duration": 12.0,
      "title": "2/6 · El Anillo de Fuego en la desembocadura del Amazonas",
      "desc": "Vuelo orbital rasante sobre el delta del Amazonas (Amapá): aquí se alcanza el clímax planetario con 10 minutos y 27 segundos de majestuosa anularidad.",
      "camStart": { "lat": -2.0, "lng": -65.0, "radius": 84.0 },
      "camEnd":   { "lat": 3.0,  "lng": -48.0, "radius": 76.0 },
      "targetStart": "shadow",
      "targetEnd":   "shadow",
      "horizonBlendStart": 1.0,
      "horizonBlendEnd": 1.0,
      "tEclipseStart": -0.500,
      "tEclipseEnd":   0.300,
      "showSpaceCones": false
    },
    {
      "timeStart": 22.0,
      "duration": 13.0,
      "title": "3/6 · Gran salto transatlántico",
      "desc": "Persecución supersónica de la antumbra sobre las aguas abiertas del Atlántico central, manteniendo el horizonte nivelado en rumbo noreste hacia Europa.",
      "camStart": { "lat": 3.0,  "lng": -48.0, "radius": 76.0 },
      "camEnd":   { "lat": 25.0, "lng": -25.0, "radius": 76.0 },
      "targetStart": "shadow",
      "targetEnd":   "shadow",
      "horizonBlendStart": 1.0,
      "horizonBlendEnd": 1.0,
      "tEclipseStart": 0.300,
      "tEclipseEnd":   1.700,
      "showSpaceCones": false
    },
    {
      "timeStart": 35.0,
      "duration": 13.0,
      "title": "4/6 · Entrada por el Golfo de Cádiz y Andalucía",
      "desc": "La anularidad toca tierra española por Huelva, Sevilla y Córdoba: un deslumbrante Anillo de Fuego corona el cielo andaluz a baja altitud solar.",
      "camStart": { "lat": 25.0, "lng": -25.0, "radius": 76.0 },
      "camEnd":   { "lat": 36.5, "lng": -7.0,  "radius": 73.0 },
      "targetStart": "shadow",
      "targetEnd":   "shadow",
      "horizonBlendStart": 1.0,
      "horizonBlendEnd": 1.0,
      "tEclipseStart": 1.700,
      "tEclipseEnd":   1.945,
      "showSpaceCones": false
    },
    {
      "timeStart": 48.0,
      "duration": 13.0,
      "title": "5/6 · Travesía de La Mancha hacia el Levante y Valencia",
      "desc": "La sombra cruza Ciudad Real, Albacete y la huerta valenciana mientras la cámara orienta su mirada hacia el Sol en los instantes previos al ocaso.",
      "camStart": { "lat": 36.5, "lng": -7.0, "radius": 73.0 },
      "camEnd":   { "lat": 39.5, "lng": -0.5, "radius": 76.0 },
      "targetStart": "shadow",
      "targetEnd":   "sun",
      "horizonBlendStart": 1.0,
      "horizonBlendEnd": 1.0,
      "tEclipseStart": 1.945,
      "tEclipseEnd":   1.970,
      "showSpaceCones": false
    },
    {
      "timeStart": 61.0,
      "duration": 14.0,
      "title": "6/6 · Ocaso del Anillo de Fuego en el Mar Balear",
      "desc": "Contraluz sobrecogedor hacia el Sol anular que se sumerge en el horizonte marino entre Valencia y Baleares antes de ascender hacia el espacio profundo.",
      "camStart": { "lat": 39.5, "lng": -0.5, "radius": 76.0 },
      "camEnd":   { "lat": 37.0, "lng": 10.0, "radius": 240.0 },
      "targetStart": "sun",
      "targetEnd":   "earth",
      "horizonBlendStart": 1.0,
      "horizonBlendEnd": 0.0,
      "tEclipseStart": 1.970,
      "tEclipseEnd":   2.000,
      "showSpaceCones": true
    }
  ]
};

// Indexación canónica adicional por número de catálogo NASA
window.ECLIPSE_ROUTES[9569] = window.ECLIPSE_ROUTES["2028_01_26"];
