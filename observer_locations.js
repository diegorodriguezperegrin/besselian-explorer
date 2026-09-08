/**
 * Catálogo Maestro de Ubicaciones de Observación (Cosmos Mataró)
 * 
 * Localidades seleccionadas con coordenadas astronómicas topocéntricas y husos horarios IANA.
 * Categorías:
 *   - España (todas las capitales de provincia, Mataró y principales ciudades)
 *   - Observatorios Astronómicos (profesionales de España, ESO/Chile, Hawái y referencia mundial)
 *   - América Latina (capitales de países y principales áreas metropolitanas)
 *   - Europa y Resto del Mundo (capitales y centros astronómicos mundiales)
 */

const OBSERVER_LOCATIONS_CATALOG = [
    // =========================================================================
    // ESPAÑA
    // =========================================================================
    { name: "Mataró (Cosmos Mataró, ES)", lat: 41.54, lon: 2.44, tz: "Europe/Madrid", category: "España" },
    { name: "A Coruña (ES)", lat: 43.37, lon: -8.40, tz: "Europe/Madrid", category: "España" },
    { name: "Albacete (ES)", lat: 38.99, lon: -1.86, tz: "Europe/Madrid", category: "España" },
    { name: "Alicante (ES)", lat: 38.35, lon: -0.48, tz: "Europe/Madrid", category: "España" },
    { name: "Almería (ES)", lat: 36.84, lon: -2.46, tz: "Europe/Madrid", category: "España" },
    { name: "Ávila (ES)", lat: 40.66, lon: -4.70, tz: "Europe/Madrid", category: "España" },
    { name: "Badajoz (ES)", lat: 38.88, lon: -6.97, tz: "Europe/Madrid", category: "España" },
    { name: "Barcelona (ES)", lat: 41.39, lon: 2.17, tz: "Europe/Madrid", category: "España" },
    { name: "Bilbao (ES)", lat: 43.26, lon: -2.93, tz: "Europe/Madrid", category: "España" },
    { name: "Burgos (ES)", lat: 42.34, lon: -3.70, tz: "Europe/Madrid", category: "España" },
    { name: "Cáceres (ES)", lat: 39.48, lon: -6.37, tz: "Europe/Madrid", category: "España" },
    { name: "Cádiz (ES)", lat: 36.53, lon: -6.29, tz: "Europe/Madrid", category: "España" },
    { name: "Castellón de la Plana (ES)", lat: 39.99, lon: -0.05, tz: "Europe/Madrid", category: "España" },
    { name: "Ceuta (ES)", lat: 35.89, lon: -5.32, tz: "Europe/Madrid", category: "España" },
    { name: "Ciudad Real (ES)", lat: 38.99, lon: -3.93, tz: "Europe/Madrid", category: "España" },
    { name: "Córdoba (ES)", lat: 37.89, lon: -4.78, tz: "Europe/Madrid", category: "España" },
    { name: "Cuenca (ES)", lat: 40.07, lon: -2.14, tz: "Europe/Madrid", category: "España" },
    { name: "Gallocanta (ES)", lat: 40.9969, lon: -1.5129, tz: "Europe/Madrid", category: "España" },
    { name: "Gijón (ES)", lat: 43.54, lon: -5.66, tz: "Europe/Madrid", category: "España" },
    { name: "Girona (ES)", lat: 41.98, lon: 2.82, tz: "Europe/Madrid", category: "España" },
    { name: "Granada (ES)", lat: 37.18, lon: -3.60, tz: "Europe/Madrid", category: "España" },
    { name: "Guadalajara (ES)", lat: 40.63, lon: -3.17, tz: "Europe/Madrid", category: "España" },
    { name: "Huelva (ES)", lat: 37.26, lon: -6.94, tz: "Europe/Madrid", category: "España" },
    { name: "Huesca (ES)", lat: 42.14, lon: -0.41, tz: "Europe/Madrid", category: "España" },
    { name: "Jaén (ES)", lat: 37.77, lon: -3.79, tz: "Europe/Madrid", category: "España" },
    { name: "Las Palmas de Gran Canaria (ES)", lat: 28.12, lon: -15.43, tz: "Atlantic/Canary", category: "España" },
    { name: "León (ES)", lat: 42.60, lon: -5.57, tz: "Europe/Madrid", category: "España" },
    { name: "Lleida (ES)", lat: 41.62, lon: 0.62, tz: "Europe/Madrid", category: "España" },
    { name: "Logroño (ES)", lat: 42.47, lon: -2.45, tz: "Europe/Madrid", category: "España" },
    { name: "Lugo (ES)", lat: 43.01, lon: -7.56, tz: "Europe/Madrid", category: "España" },
    { name: "Madrid (ES)", lat: 40.42, lon: -3.70, tz: "Europe/Madrid", category: "España" },
    { name: "Málaga (ES)", lat: 36.72, lon: -4.42, tz: "Europe/Madrid", category: "España" },
    { name: "Melilla (ES)", lat: 35.29, lon: -2.94, tz: "Europe/Madrid", category: "España" },
    { name: "Murcia (ES)", lat: 37.99, lon: -1.13, tz: "Europe/Madrid", category: "España" },
    { name: "Ourense (ES)", lat: 42.34, lon: -7.86, tz: "Europe/Madrid", category: "España" },
    { name: "Oviedo (ES)", lat: 43.36, lon: -5.84, tz: "Europe/Madrid", category: "España" },
    { name: "Palencia (ES)", lat: 42.01, lon: -4.53, tz: "Europe/Madrid", category: "España" },
    { name: "Palma de Mallorca (ES)", lat: 39.57, lon: 2.65, tz: "Europe/Madrid", category: "España" },
    { name: "Pamplona (ES)", lat: 42.81, lon: -1.64, tz: "Europe/Madrid", category: "España" },
    { name: "Pontevedra (ES)", lat: 42.43, lon: -8.64, tz: "Europe/Madrid", category: "España" },
    { name: "Salamanca (ES)", lat: 40.97, lon: -5.66, tz: "Europe/Madrid", category: "España" },
    { name: "San Sebastián (ES)", lat: 43.32, lon: -1.98, tz: "Europe/Madrid", category: "España" },
    { name: "Santa Cruz de Tenerife (ES)", lat: 28.47, lon: -16.25, tz: "Atlantic/Canary", category: "España" },
    { name: "Santander (ES)", lat: 43.46, lon: -3.80, tz: "Europe/Madrid", category: "España" },
    { name: "Santiago de Compostela (ES)", lat: 42.88, lon: -8.54, tz: "Europe/Madrid", category: "España" },
    { name: "Segovia (ES)", lat: 40.95, lon: -4.12, tz: "Europe/Madrid", category: "España" },
    { name: "Sevilla (ES)", lat: 37.39, lon: -5.98, tz: "Europe/Madrid", category: "España" },
    { name: "Soria (ES)", lat: 41.76, lon: -2.47, tz: "Europe/Madrid", category: "España" },
    { name: "Tarragona (ES)", lat: 41.12, lon: 1.25, tz: "Europe/Madrid", category: "España" },
    { name: "Teruel (ES)", lat: 40.34, lon: -1.11, tz: "Europe/Madrid", category: "España" },
    { name: "Toledo (ES)", lat: 39.86, lon: -4.02, tz: "Europe/Madrid", category: "España" },
    { name: "Valencia (ES)", lat: 39.47, lon: -0.38, tz: "Europe/Madrid", category: "España" },
    { name: "Valladolid (ES)", lat: 41.65, lon: -4.72, tz: "Europe/Madrid", category: "España" },
    { name: "Vigo (ES)", lat: 42.24, lon: -8.72, tz: "Europe/Madrid", category: "España" },
    { name: "Vitoria-Gasteiz (ES)", lat: 42.85, lon: -2.67, tz: "Europe/Madrid", category: "España" },
    { name: "Zamora (ES)", lat: 41.50, lon: -5.74, tz: "Europe/Madrid", category: "España" },
    { name: "Zaragoza (ES)", lat: 41.65, lon: -0.88, tz: "Europe/Madrid", category: "España" },

    // =========================================================================
    // OBSERVATORIOS ASTRONÓMICOS
    // =========================================================================
    { name: "Obs. del Teide / Izaña (Tenerife, ES)", lat: 28.30, lon: -16.51, tz: "Atlantic/Canary", category: "Observatorios Astronómicos" },
    { name: "Obs. del Roque de los Muchachos (La Palma, ES)", lat: 28.76, lon: -17.89, tz: "Atlantic/Canary", category: "Observatorios Astronómicos" },
    { name: "Obs. de Calar Alto (Almería, ES)", lat: 37.22, lon: -2.55, tz: "Europe/Madrid", category: "Observatorios Astronómicos" },
    { name: "Obs. de Sierra Nevada (Granada, ES)", lat: 37.06, lon: -3.39, tz: "Europe/Madrid", category: "Observatorios Astronómicos" },
    { name: "Obs. Astrofísico de Javalambre (Teruel, ES)", lat: 40.04, lon: -1.02, tz: "Europe/Madrid", category: "Observatorios Astronómicos" },
    { name: "Obs. Fabra (Barcelona, ES)", lat: 41.42, lon: 2.12, tz: "Europe/Madrid", category: "Observatorios Astronómicos" },
    { name: "Obs. del Montsec (Lleida, ES)", lat: 42.05, lon: 0.73, tz: "Europe/Madrid", category: "Observatorios Astronómicos" },
    { name: "Real Obs. de Madrid (ES)", lat: 40.41, lon: -3.69, tz: "Europe/Madrid", category: "Observatorios Astronómicos" },
    { name: "Real Obs. de la Armada (San Fernando, ES)", lat: 36.46, lon: -6.20, tz: "Europe/Madrid", category: "Observatorios Astronómicos" },
    { name: "Obs. La Silla (ESO, CL)", lat: -29.26, lon: -70.73, tz: "America/Santiago", category: "Observatorios Astronómicos" },
    { name: "Obs. Paranal / VLT (ESO, CL)", lat: -24.63, lon: -70.40, tz: "America/Santiago", category: "Observatorios Astronómicos" },
    { name: "Obs. ALMA / Chajnantor (CL)", lat: -23.03, lon: -67.75, tz: "America/Santiago", category: "Observatorios Astronómicos" },
    { name: "Obs. Las Campanas (CL)", lat: -29.01, lon: -70.69, tz: "America/Santiago", category: "Observatorios Astronómicos" },
    { name: "Obs. Mauna Kea (Hawái, US)", lat: 19.82, lon: -155.47, tz: "Pacific/Honolulu", category: "Observatorios Astronómicos" },
    { name: "Obs. Real de Greenwich (GB)", lat: 51.48, lon: 0.00, tz: "Europe/London", category: "Observatorios Astronómicos" },

    // =========================================================================
    // AMÉRICA LATINA
    // =========================================================================
    { name: "Asunción (PY)", lat: -25.26, lon: -57.58, tz: "America/Asuncion", category: "América Latina" },
    { name: "Bogotá (CO)", lat: 4.71, lon: -74.07, tz: "America/Bogota", category: "América Latina" },
    { name: "Buenos Aires (AR)", lat: -34.60, lon: -58.38, tz: "America/Argentina/Buenos_Aires", category: "América Latina" },
    { name: "Cali (CO)", lat: 3.45, lon: -76.53, tz: "America/Bogota", category: "América Latina" },
    { name: "Caracas (VE)", lat: 10.48, lon: -66.90, tz: "America/Caracas", category: "América Latina" },
    { name: "Ciudad de Guatemala (GT)", lat: 14.63, lon: -90.51, tz: "America/Guatemala", category: "América Latina" },
    { name: "Ciudad de México (MX)", lat: 19.43, lon: -99.13, tz: "America/Mexico_City", category: "América Latina" },
    { name: "Córdoba (AR)", lat: -31.42, lon: -64.18, tz: "America/Argentina/Cordoba", category: "América Latina" },
    { name: "Guadalajara (MX)", lat: 20.66, lon: -103.35, tz: "America/Mexico_City", category: "América Latina" },
    { name: "Guayaquil (EC)", lat: -2.19, lon: -79.89, tz: "America/Guayaquil", category: "América Latina" },
    { name: "La Habana (CU)", lat: 23.11, lon: -82.37, tz: "America/Havana", category: "América Latina" },
    { name: "La Paz (BO)", lat: -16.50, lon: -68.15, tz: "America/La_Paz", category: "América Latina" },
    { name: "Lima (PE)", lat: -12.05, lon: -77.04, tz: "America/Lima", category: "América Latina" },
    { name: "Managua (NI)", lat: 12.14, lon: -86.27, tz: "America/Managua", category: "América Latina" },
    { name: "Medellín (CO)", lat: 6.24, lon: -75.58, tz: "America/Bogota", category: "América Latina" },
    { name: "Mendoza (AR)", lat: -32.89, lon: -68.83, tz: "America/Argentina/Mendoza", category: "América Latina" },
    { name: "Monterrey (MX)", lat: 25.69, lon: -100.32, tz: "America/Monterrey", category: "América Latina" },
    { name: "Montevideo (UY)", lat: -34.90, lon: -56.16, tz: "America/Montevideo", category: "América Latina" },
    { name: "Panamá (PA)", lat: 8.98, lon: -79.52, tz: "America/Panama", category: "América Latina" },
    { name: "Puebla (MX)", lat: 19.04, lon: -98.20, tz: "America/Mexico_City", category: "América Latina" },
    { name: "Quito (EC)", lat: -0.18, lon: -78.47, tz: "America/Guayaquil", category: "América Latina" },
    { name: "Río de Janeiro (BR)", lat: -22.91, lon: -43.17, tz: "America/Sao_Paulo", category: "América Latina" },
    { name: "Rosario (AR)", lat: -32.95, lon: -60.64, tz: "America/Argentina/Cordoba", category: "América Latina" },
    { name: "San José (CR)", lat: 9.93, lon: -84.09, tz: "America/Costa_Rica", category: "América Latina" },
    { name: "San Juan (PR)", lat: 18.47, lon: -66.11, tz: "America/Puerto_Rico", category: "América Latina" },
    { name: "San Salvador (SV)", lat: 13.69, lon: -89.22, tz: "America/El_Salvador", category: "América Latina" },
    { name: "Santiago (CL)", lat: -33.45, lon: -70.67, tz: "America/Santiago", category: "América Latina" },
    { name: "Santo Domingo (DO)", lat: 18.49, lon: -69.93, tz: "America/Santo_Domingo", category: "América Latina" },
    { name: "São Paulo (BR)", lat: -23.55, lon: -46.63, tz: "America/Sao_Paulo", category: "América Latina" },
    { name: "Sucre (BO)", lat: -19.03, lon: -65.26, tz: "America/La_Paz", category: "América Latina" },
    { name: "Tegucigalpa (HN)", lat: 14.07, lon: -87.21, tz: "America/Tegucigalpa", category: "América Latina" },
    { name: "Valparaíso (CL)", lat: -33.05, lon: -71.62, tz: "America/Santiago", category: "América Latina" },

    // =========================================================================
    // EUROPA Y RESTO DEL MUNDO
    // =========================================================================
    { name: "Ámsterdam (NL)", lat: 52.37, lon: 4.89, tz: "Europe/Amsterdam", category: "Europa y Resto del Mundo" },
    { name: "Atenas (GR)", lat: 37.98, lon: 23.73, tz: "Europe/Athens", category: "Europa y Resto del Mundo" },
    { name: "Berlín (DE)", lat: 52.52, lon: 13.40, tz: "Europe/Berlin", category: "Europa y Resto del Mundo" },
    { name: "Berna (CH)", lat: 46.95, lon: 7.45, tz: "Europe/Zurich", category: "Europa y Resto del Mundo" },
    { name: "Bruselas (BE)", lat: 50.85, lon: 4.35, tz: "Europe/Brussels", category: "Europa y Resto del Mundo" },
    { name: "Copenhague (DK)", lat: 55.68, lon: 12.57, tz: "Europe/Copenhagen", category: "Europa y Resto del Mundo" },
    { name: "Dublín (IE)", lat: 53.35, lon: -6.26, tz: "Europe/Dublin", category: "Europa y Resto del Mundo" },
    { name: "El Cairo (EG)", lat: 30.04, lon: 31.24, tz: "Africa/Cairo", category: "Europa y Resto del Mundo" },
    { name: "Estocolmo (SE)", lat: 59.33, lon: 18.07, tz: "Europe/Stockholm", category: "Europa y Resto del Mundo" },
    { name: "Fráncfort (DE)", lat: 50.11, lon: 8.68, tz: "Europe/Berlin", category: "Europa y Resto del Mundo" },
    { name: "Ginebra (CH)", lat: 46.20, lon: 6.14, tz: "Europe/Zurich", category: "Europa y Resto del Mundo" },
    { name: "Helsinki (FI)", lat: 60.17, lon: 24.94, tz: "Europe/Helsinki", category: "Europa y Resto del Mundo" },
    { name: "Johannesburgo (ZA)", lat: -26.20, lon: 28.04, tz: "Africa/Johannesburg", category: "Europa y Resto del Mundo" },
    { name: "Lisboa (PT)", lat: 38.72, lon: -9.14, tz: "Europe/Lisbon", category: "Europa y Resto del Mundo" },
    { name: "Londres (GB)", lat: 51.51, lon: -0.13, tz: "Europe/London", category: "Europa y Resto del Mundo" },
    { name: "Los Ángeles (US)", lat: 34.05, lon: -118.24, tz: "America/Los_Angeles", category: "Europa y Resto del Mundo" },
    { name: "Luxor (EG)", lat: 25.68, lon: 32.64, tz: "Africa/Cairo", category: "Europa y Resto del Mundo" },
    { name: "Miami (US)", lat: 25.76, lon: -80.19, tz: "America/New_York", category: "Europa y Resto del Mundo" },
    { name: "Montreal (CA)", lat: 45.50, lon: -73.57, tz: "America/Toronto", category: "Europa y Resto del Mundo" },
    { name: "Moscú (RU)", lat: 55.76, lon: 37.62, tz: "Europe/Moscow", category: "Europa y Resto del Mundo" },
    { name: "Nueva Delhi (IN)", lat: 28.61, lon: 77.21, tz: "Asia/Kolkata", category: "Europa y Resto del Mundo" },
    { name: "Nueva York (US)", lat: 40.71, lon: -74.01, tz: "America/New_York", category: "Europa y Resto del Mundo" },
    { name: "Oslo (NO)", lat: 59.91, lon: 10.75, tz: "Europe/Oslo", category: "Europa y Resto del Mundo" },
    { name: "París (FR)", lat: 48.86, lon: 2.35, tz: "Europe/Paris", category: "Europa y Resto del Mundo" },
    { name: "Pekín (CN)", lat: 39.90, lon: 116.40, tz: "Asia/Shanghai", category: "Europa y Resto del Mundo" },
    { name: "Praga (CZ)", lat: 50.08, lon: 14.44, tz: "Europe/Prague", category: "Europa y Resto del Mundo" },
    { name: "Reikiavik (IS)", lat: 64.15, lon: -21.94, tz: "Atlantic/Reykjavik", category: "Europa y Resto del Mundo" },
    { name: "Roma (IT)", lat: 41.90, lon: 12.50, tz: "Europe/Rome", category: "Europa y Resto del Mundo" },
    { name: "San Francisco (US)", lat: 37.77, lon: -122.42, tz: "America/Los_Angeles", category: "Europa y Resto del Mundo" },
    { name: "Sídney (AU)", lat: -33.87, lon: 151.21, tz: "Australia/Sydney", category: "Europa y Resto del Mundo" },
    { name: "Tokio (JP)", lat: 35.68, lon: 139.69, tz: "Asia/Tokyo", category: "Europa y Resto del Mundo" },
    { name: "Toronto (CA)", lat: 43.65, lon: -79.38, tz: "America/Toronto", category: "Europa y Resto del Mundo" },
    { name: "Viena (AT)", lat: 48.21, lon: 16.37, tz: "Europe/Vienna", category: "Europa y Resto del Mundo" },
    { name: "Washington D.C. (US)", lat: 38.91, lon: -77.04, tz: "America/New_York", category: "Europa y Resto del Mundo" },
    { name: "Zúrich (CH)", lat: 47.38, lon: 8.54, tz: "Europe/Zurich", category: "Europa y Resto del Mundo" }
];

if (typeof window !== 'undefined') {
    window.OBSERVER_LOCATIONS_CATALOG = OBSERVER_LOCATIONS_CATALOG;
    window.OBSERVER_PRESETS = OBSERVER_LOCATIONS_CATALOG;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OBSERVER_LOCATIONS_CATALOG;
}
