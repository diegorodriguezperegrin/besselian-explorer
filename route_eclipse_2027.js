// =========================================================================
// RUTA CINEMÁTICA: GRAN ECLIPSE TOTAL DEL 2 DE AGOSTO DE 2027
// Plano secuencia continuo sin cortes ni teletransportes
// =========================================================================
window.DEFAULT_ROUTE_2027_DATA = {
  "id": "eclipse_2027",
  "title": "Gran Eclipse Total del 2 de Agosto de 2027",
  "year": 2027,
  "cat_no": 9568,
  "totalDurationSec": 75.0,
  "introDuration": 4.0,
  "scenes": [
    {
      "timeStart": 0.0,
      "duration": 9.0,
      "title": "1/6 · Encuentro cósmico con la Luna",
      "desc": "La cámara enfoca la Luna en el espacio profundo y gira con prontitud hacia la Tierra, siendo testigo del nacimiento y avance de la umbra por el Atlántico hacia las costas de África.",
      "camStart": { "lat": 22.0, "lng": -50.0, "radius": 240.0 },
      "camEnd":   { "lat": 36.5, "lng": -20.0, "radius": 140.0 },
      "targetStart": "moon",
      "targetEnd":   "shadow",
      "targetTurnEnd": 0.40,
      "tEclipseStart": -1.450,
      "tEclipseEnd":   -1.120,
      "showSpaceCones": true
    },
    {
      "timeStart": 9.0,
      "duration": 12.0,
      "title": "2/6 · Persecución aérea en el Estrecho de Gibraltar",
      "desc": "Descendemos en vuelo rasante continuo detrás de la umbra a 2.500 km/h: la totalidad cubre Tarifa, Cádiz y la costa andaluza con 4m 24s de noche.",
      "camStart": { "lat": 36.5, "lng": -20.0, "radius": 140.0 },
      "camEnd":   { "lat": 33.5, "lng": 0.0, "radius": 78.0 },
      "targetStart": "shadow",
      "targetEnd":   "shadow",
      "tEclipseStart": -1.120,
      "tEclipseEnd":   -0.680,
      "showSpaceCones": false
    },
    {
      "timeStart": 21.0,
      "duration": 13.0,
      "title": "3/6 · Gran travesía por el desierto del Sahara",
      "desc": "La cámara sobrevuela a velocidad constante el desierto del Sahara, siguiendo la sombra lunar sobre las dunas de Argelia y Libia.",
      "camStart": { "lat": 33.5, "lng": 0.0, "radius": 78.0 },
      "camEnd":   { "lat": 28.0, "lng": 18.0, "radius": 95.0 },
      "targetStart": "shadow",
      "targetEnd":   "shadow",
      "tEclipseStart": -0.680,
      "tEclipseEnd":   -0.203,
      "showSpaceCones": false
    },
    {
      "timeStart": 34.0,
      "duration": 13.0,
      "title": "4/6 · Clímax en Luxor: El eclipse del siglo",
      "desc": "Avanzamos a velocidad constante sobre los templos del Nilo donde se alcanza la máxima duración en tierra: 6 minutos y 23 segundos de noche al mediodía.",
      "camStart": { "lat": 28.0, "lng": 18.0, "radius": 95.0 },
      "camEnd":   { "lat": 24.0, "lng": 30.0, "radius": 82.0 },
      "targetStart": "shadow",
      "targetEnd":   "sun",
      "tEclipseStart": -0.203,
      "tEclipseEnd":   0.273,
      "showSpaceCones": false
    },
    {
      "timeStart": 47.0,
      "duration": 13.0,
      "title": "5/6 · Contraluz hacia el Sol desde la estratosfera",
      "desc": "La cámara eleva suavemente su mirada sobre el Mar Rojo apuntando hacia el Sol: la silueta lunar oculta el disco solar en el espacio.",
      "camStart": { "lat": 24.0, "lng": 30.0, "radius": 82.0 },
      "camEnd":   { "lat": 18.0, "lng": 44.0, "radius": 120.0 },
      "targetStart": "sun",
      "targetEnd":   "sun",
      "tEclipseStart": 0.273,
      "tEclipseEnd":   0.750,
      "showSpaceCones": true
    },
    {
      "timeStart": 60.0,
      "duration": 15.0,
      "title": "6/6 · Despedida cósmica sobre el Océano Índico",
      "desc": "La mirada desciende del Sol hacia el globo terrestre y se aleja hacia el espacio profundo mientras la sombra se despide en el Índico.",
      "camStart": { "lat": 18.0, "lng": 44.0, "radius": 120.0 },
      "camEnd":   { "lat": 10.0, "lng": 65.0, "radius": 240.0 },
      "targetStart": "sun",
      "targetEnd":   "earth",
      "tEclipseStart": 0.750,
      "tEclipseEnd":   1.300,
      "showSpaceCones": true
    }
  ]
};