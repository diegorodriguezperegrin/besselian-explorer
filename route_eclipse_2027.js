// =========================================================================
// RUTA CINEMÁTICA: GRAN ECLIPSE TOTAL DEL 2 DE AGOSTO DE 2027
// =========================================================================
window.DEFAULT_ROUTE_2027_DATA = {
  "id": "eclipse_2027",
  "title": "Gran Eclipse Total del 2 de Agosto de 2027",
  "year": 2027,
  "cat_no": 9568,
  "totalDurationSec": 56.0,
  "introDuration": 4.0,
  "scenes": [
    {
      "timeStart": 0.0,
      "duration": 9.0,
      "title": "1/6 · Encuentro cósmico con la Luna",
      "desc": "La cámara enfoca directamente a la Luna mientras sus conos volumétricos de umbra y penumbra convergen hacia la Tierra en el espacio profundo.",
      "badge": "🌑 Enfoque: Luna",
      "camStart": { "lat": 20.0, "lng": -45.0, "radius": 260.0 },
      "camEnd":   { "lat": 30.0, "lng": -35.0, "radius": 210.0 },
      "targetStart": "moon",
      "targetEnd":   "moon",
      "tEclipseStart": -1.1,
      "tEclipseEnd":   -0.55,
      "showSpaceCones": true
    },
    {
      "timeStart": 9.0,
      "duration": 10.0,
      "title": "2/6 · Persecución aérea en el Estrecho de Gibraltar",
      "desc": "Volando como un avión de escolta detrás de la umbra a 2.500 km/h: la totalidad cubre Tarifa, Cádiz y la costa andaluza con 4m 24s de noche.",
      "badge": "📍 Tarifa (Cádiz) · Totalidad: 4m 24s",
      "follow": "shadow",
      "altitude": 24.0,
      "distBehind": 16.0,
      "observerLocation": { "lat": 36.01, "lon": -5.60, "name": "Tarifa" },
      "tEclipseStart": -0.55,
      "tEclipseEnd":   -0.25,
      "showSpaceCones": false
    },
    {
      "timeStart": 19.0,
      "duration": 8.0,
      "title": "3/6 · Bullet-Time sobre el desierto del Sahara",
      "desc": "El tiempo astronómico se congela mientras la cámara realiza un giro orbital 3D sobre la mancha de totalidad entre Argelia y Libia.",
      "badge": "⏱ Bullet-Time · Tiempo congelado",
      "camStart": { "lat": 33.0, "lng": -4.0, "radius": 145.0 },
      "camEnd":   { "lat": 24.0, "lng": 16.0, "radius": 120.0 },
      "targetStart": "shadow",
      "targetEnd":   "shadow",
      "tEclipseStart": -0.15,
      "tEclipseEnd":   -0.15,
      "showSpaceCones": false
    },
    {
      "timeStart": 27.0,
      "duration": 11.0,
      "title": "4/6 · Clímax en Luxor: El eclipse del siglo",
      "desc": "Avanzamos a cámara lenta sobre los templos del Nilo donde se alcanza la máxima duración en tierra: 6 minutos y 23 segundos de noche al mediodía.",
      "badge": "📍 Luxor (Egipto) · 6m 23s (Máximo en tierra)",
      "camStart": { "lat": 28.0, "lng": 28.0, "radius": 120.0 },
      "camEnd":   { "lat": 25.5, "lng": 34.0, "radius": 105.0 },
      "targetStart": { "lat": 25.68, "lng": 32.64, "radius": 25.0 },
      "targetEnd":   { "lat": 25.68, "lng": 32.64, "radius": 25.0 },
      "observerLocation": { "lat": 25.68, "lon": 32.64, "name": "Luxor" },
      "tEclipseStart": 0.02,
      "tEclipseEnd":   0.08,
      "showSpaceCones": false
    },
    {
      "timeStart": 38.0,
      "duration": 9.0,
      "title": "5/6 · Contraluz hacia el Sol desde la estratosfera",
      "desc": "La cámara eleva su objetivo apuntando directamente hacia el Sol: la silueta lunar oculta el disco solar creando la corona en el espacio.",
      "badge": "☀️ Enfoque: Sol a contraluz",
      "camStart": { "lat": 22.0, "lng": 37.0, "radius": 110.0 },
      "camEnd":   { "lat": 16.0, "lng": 43.0, "radius": 135.0 },
      "targetStart": "sun",
      "targetEnd":   "sun",
      "tEclipseStart": 0.12,
      "tEclipseEnd":   0.35,
      "showSpaceCones": true
    },
    {
      "timeStart": 47.0,
      "duration": 9.0,
      "title": "6/6 · Despedida cósmica sobre el Océano Índico",
      "desc": "El cono de sombra roza las costas de Somalia y Yemen antes de fundirse de nuevo en el océano y en el espacio exterior.",
      "badge": "🌊 Océano Índico",
      "camStart": { "lat": 16.0, "lng": 43.0, "radius": 135.0 },
      "camEnd":   { "lat": 8.0, "lng": 65.0, "radius": 235.0 },
      "targetStart": "shadow",
      "targetEnd":   "earth",
      "tEclipseStart": 0.35,
      "tEclipseEnd":   0.85,
      "showSpaceCones": true
    }
  ]
};