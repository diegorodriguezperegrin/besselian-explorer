/**
 * =========================================================================================
 * TERRAIN ELEVATION & ECLIPSE VISIBILITY PROFILE (ESTILO IGN / VISUALIZADORES)
 * =========================================================================================
 * Calcula y dibuja el perfil topográfico del terreno entre el observador y el horizonte
 * a lo largo del acimut del Sol en el máximo del eclipse (o contactos C1-C4).
 *
 * Fuentes de elevación:
 * 1. Primaria: AWS / Mapzen Terrarium Tiles (S3) en formato RGB decodificado en Canvas cliente.
 *    Fórmula Terrarium: h = (R * 256 + G + B / 256) - 32768 (metros).
 * 2. Fallback resiliente: Open-Meteo Global Elevation API (COP-DEM / SRTM) para máxima estabilidad.
 *
 * Cosmología y Óptica:
 * - Curvatura terrestre y refracción atmosférica estándar (k = 0.13, R_eff ≈ 7.323 km).
 * - Detección de colisiones/obstrucciones orográficas con el rayo visual del Sol.
 * - Margen angular libre sobre el relieve y localización de obstáculos críticos.
 * =========================================================================================
 */

(function(window) {
    'use strict';

    // Constantes geodésicas y físicas
    const EARTH_RADIUS = 6371000; // Radio medio WGS84 en metros
    const REFRACTION_K = 0.13;
    const R_EFF = EARTH_RADIUS / (1 - REFRACTION_K); // ~7.323.000 m (7.322.989 m con k = 0.13)
    const EYE_HEIGHT = 2.0; // Altura estándar de los ojos / trípode sobre el suelo (metros)

    // Configuración de Teselas DEM
    const TERRARIUM_URL_TEMPLATE = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
    const DEFAULT_ZOOM = 12; // ~30m de resolución espacial en latitudes medias
    const MAX_TILE_CACHE = 40;

    // Cachés en memoria
    const tileCache = new Map(); // key -> Uint8ClampedArray (256x256x4)
    const profileCache = new Map(); // key -> profileResult

    // Estado activo
    let activeDistanceKm = 10; // 10 km por defecto (igual que visualizadores IGN)
    let activePhaseKey = 'MÁX'; // 'MÁX', 'C1', 'C2', 'C3', 'C4'
    let currentProfileData = null;
    let showSightlineOnMap = true;
    let mapSightlineLayer = null;
    let lastQueryParams = null;
    let isFetching = false;

    /**
     * Calcula la refracción atmosférica astronómica en minutos de arco (Fórmula de Bennett 1982 / Meeus)
     * R = cot(h + 7.31 / (h + 4.4)) en condiciones atmosféricas estándar (1010 hPa, 10°C).
     * Eleva ópticamente la posición aparente del Sol sobre su posición geométrica pura.
     */
    function computeAtmosphericRefraction(trueAltitudeDeg) {
        if (trueAltitudeDeg < -1.0) return 0;
        const h = Math.max(-0.5, trueAltitudeDeg);
        const rad = (h + (7.31 / (h + 4.4))) * (Math.PI / 180);
        return 1.0 / Math.tan(rad); // en minutos de arco
    }

    /**
     * Calcula las coordenadas de destino a lo largo de una línea geodésica (Gran Círculo)
     */
    function destinationPoint(latDeg, lonDeg, distanceMeters, bearingDeg) {
        const d = distanceMeters / EARTH_RADIUS;
        const brng = bearingDeg * Math.PI / 180;
        const lat1 = latDeg * Math.PI / 180;
        const lon1 = lonDeg * Math.PI / 180;

        const sinLat2 = Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng);
        const lat2 = Math.asin(sinLat2);
        const y = Math.sin(brng) * Math.sin(d) * Math.cos(lat1);
        const x = Math.cos(d) - Math.sin(lat1) * sinLat2;
        const lon2 = lon1 + Math.atan2(y, x);

        let outLon = lon2 * 180 / Math.PI;
        outLon = ((outLon + 540) % 360) - 180; // Normalizar a [-180, 180]

        return {
            lat: lat2 * 180 / Math.PI,
            lon: outLon
        };
    }

    /**
     * Convierte coordenadas lat/lon a coordenadas de tesela Slippy Map
     */
    function latLonToTile(lat, lon, zoom) {
        const n = Math.pow(2, zoom);
        const x = Math.floor((lon + 180) / 360 * n);
        const latRad = lat * Math.PI / 180;
        const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
        return { z: zoom, x: Math.max(0, Math.min(n - 1, x)), y: Math.max(0, Math.min(n - 1, y)) };
    }

    /**
     * Descarga y decodifica una tesela Terrarium (PNG RGB) en un canvas offscreen
     */
    async function fetchTerrariumTile(z, x, y) {
        const key = `${z}/${x}/${y}`;
        if (tileCache.has(key)) {
            return tileCache.get(key);
        }

        const url = TERRARIUM_URL_TEMPLATE.replace('{z}', z).replace('{x}', x).replace('{y}', y);

        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = 256;
                    canvas.height = 256;
                    const ctx = canvas.getContext('2d', { willReadFrequently: true });
                    ctx.drawImage(img, 0, 0);
                    const imgData = ctx.getImageData(0, 0, 256, 256).data;

                    if (tileCache.size >= MAX_TILE_CACHE) {
                        const firstKey = tileCache.keys().next().value;
                        tileCache.delete(firstKey);
                    }
                    tileCache.set(key, imgData);
                    resolve(imgData);
                } catch (err) {
                    reject(err);
                }
            };
            img.onerror = () => {
                reject(new Error(`Error cargando tesela Terrarium: ${url}`));
            };
            img.src = url;
        });
    }

    /**
     * Extrae la altitud en metros para una coordenada lat/lon dentro de una tesela decodificada
     */
    function getElevationFromTileData(tileData, lat, lon, z, x, y) {
        const n = Math.pow(2, z);
        const exactX = (lon + 180) / 360 * n;
        const latRad = lat * Math.PI / 180;
        const exactY = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n;

        const px = Math.max(0, Math.min(255, Math.floor((exactX - x) * 256)));
        const py = Math.max(0, Math.min(255, Math.floor((exactY - y) * 256)));

        const idx = (py * 256 + px) * 4;
        const r = tileData[idx];
        const g = tileData[idx + 1];
        const b = tileData[idx + 2];

        // Fórmula Terrarium: (R * 256 + G + B / 256) - 32768
        return (r * 256 + g + b / 256) - 32768;
    }

    /**
     * Fallback por API de Open-Meteo si falla la carga directa de teselas S3
     */
    async function fetchElevationsOpenMeteo(points) {
        const maxBatch = 80;
        const pts = points.slice(0, maxBatch);
        const lats = pts.map(p => p.lat.toFixed(5)).join(',');
        const lons = pts.map(p => p.lon.toFixed(5)).join(',');
        const url = `https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lons}`;

        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`Open-Meteo HTTP ${resp.status}`);
        const data = await resp.json();
        return data.elevation || [];
    }

    /**
     * Genera el conjunto de puntos y resuelve las altitudes del perfil
     */
    async function computeProfileData(lat, lon, azimuth, altitude, distanceKm = 10, numSamples = 80) {
        const cacheKey = `${lat.toFixed(4)},${lon.toFixed(4)},${azimuth.toFixed(2)},${altitude.toFixed(2)},${distanceKm}`;
        if (profileCache.has(cacheKey)) {
            return profileCache.get(cacheKey);
        }

        const maxDistanceMeters = distanceKm * 1000;
        const stepMeters = maxDistanceMeters / numSamples;
        const points = [];

        for (let i = 0; i <= numSamples; i++) {
            const d = i * stepMeters;
            const pt = destinationPoint(lat, lon, d, azimuth);
            points.push({
                distance: d,
                lat: pt.lat,
                lon: pt.lon,
                terrainAlt: 0,
                rayAlt: 0,
                clearance: 0,
                obstacleAngle: 0
            });
        }

        // Determinar qué teselas se necesitan
        const tileCoordsMap = new Map();
        points.forEach(p => {
            const t = latLonToTile(p.lat, p.lon, DEFAULT_ZOOM);
            const key = `${t.z}/${t.x}/${t.y}`;
            if (!tileCoordsMap.has(key)) {
                tileCoordsMap.set(key, t);
            }
        });

        let elevationsObtained = false;

        // Intentar descargar teselas de AWS S3 Terrarium
        try {
            const tilePromises = Array.from(tileCoordsMap.values()).map(t =>
                fetchTerrariumTile(t.z, t.x, t.y).then(data => ({ key: `${t.z}/${t.x}/${t.y}`, data, tile: t }))
            );

            const loadedTiles = await Promise.all(tilePromises);
            const tilesLookup = new Map();
            loadedTiles.forEach(item => tilesLookup.set(item.key, item));

            points.forEach(p => {
                const t = latLonToTile(p.lat, p.lon, DEFAULT_ZOOM);
                const key = `${t.z}/${t.x}/${t.y}`;
                const tileObj = tilesLookup.get(key);
                if (tileObj && tileObj.data) {
                    p.terrainAlt = getElevationFromTileData(tileObj.data, p.lat, p.lon, t.z, t.x, t.y);
                }
            });
            elevationsObtained = true;
        } catch (terrariumErr) {
            console.warn('[TerrainElevationProfile] Fallo en teselas Terrarium, activando fallback Open-Meteo:', terrariumErr.message);
        }

        // Si Terrarium falló, recurrir a Open-Meteo
        if (!elevationsObtained) {
            try {
                const omElevations = await fetchElevationsOpenMeteo(points);
                points.forEach((p, idx) => {
                    p.terrainAlt = (omElevations[idx] != null) ? omElevations[idx] : 0;
                });
                elevationsObtained = true;
            } catch (omErr) {
                console.error('[TerrainElevationProfile] Fallaron ambos motores DEM:', omErr);
                // Si ambos fallan, usar cota 0 como emergencia
                points.forEach(p => { p.terrainAlt = 0; });
            }
        }

        // Altura del observador (cota del terreno + altura de ojos/trípode)
        const observerGroundAlt = Math.max(0, points[0].terrainAlt);
        const observerEyeAlt = observerGroundAlt + EYE_HEIGHT;

        // Refracción atmosférica astronómica:
        // Eleva ópticamente la posición aparente del Sol sobre el horizonte geométrico
        let refractionArcmin = 0;
        let refractionDeg = 0;
        let apparentAltitude = altitude;

        if (altitude >= -1.0) {
            refractionArcmin = computeAtmosphericRefraction(altitude);
            refractionDeg = refractionArcmin / 60.0;
            apparentAltitude = altitude + refractionDeg;
        }

        const appAltRad = apparentAltitude * Math.PI / 180;
        const tanAppAlt = Math.tan(appAltRad);

        let isObstructed = false;
        let worstClearance = Infinity;
        let criticalObstacle = null;
        let maxTerrainAlt = -Infinity;
        let maxObstacleAngle = -90;

        points.forEach((p, idx) => {
            const d = p.distance;
            // Curvatura terrestre y refracción geodésica efectiva (R_EFF ≈ 7.323.000 m con k = 0.13):
            // En un perfil rectificado con nivel del mar horizontal (estilo IGN), la curvatura terrestre
            // hace caer la superficie del geoide respecto a la tangente del observador.
            // Por consiguiente, la cota del rayo solar sobre el nivel del mar a distancia d aumenta:
            const curvatureDrop = (d * d) / (2 * R_EFF);
            p.rayAlt = observerEyeAlt + (d * tanAppAlt) + curvatureDrop;
            p.clearance = p.rayAlt - p.terrainAlt;

            if (p.terrainAlt > maxTerrainAlt) {
                maxTerrainAlt = p.terrainAlt;
            }

            // Calcular el ángulo aparente del relieve visto desde el observador (la cumbre se ve más baja por curvatura)
            if (d > 40) { // Ignorar los primeros metros inmediatos a los pies
                const apparentObstacleH = (p.terrainAlt - curvatureDrop) - observerEyeAlt;
                const elevAngleDeg = Math.atan2(apparentObstacleH, d) * 180 / Math.PI;
                p.obstacleAngle = elevAngleDeg;
                if (elevAngleDeg > maxObstacleAngle) {
                    maxObstacleAngle = elevAngleDeg;
                }

                if (p.clearance < 0) {
                    isObstructed = true;
                    if (p.clearance < worstClearance) {
                        worstClearance = p.clearance;
                        criticalObstacle = {
                            distance: d,
                            terrainAlt: p.terrainAlt,
                            rayAlt: p.rayAlt,
                            deficitMeters: Math.abs(p.clearance),
                            obstacleAngle: elevAngleDeg,
                            deficitDeg: (elevAngleDeg - apparentAltitude)
                        };
                    }
                }
            }
        });

        const marginDeg = apparentAltitude - maxObstacleAngle;
        const allTerrainAlts = points.map(p => p.terrainAlt);
        const minTerrainAlt = Math.min(...allTerrainAlts, observerGroundAlt);
        const rayEndAlt = points[points.length - 1].rayAlt;
        const scale = computeVerticalScale(minTerrainAlt, maxTerrainAlt, rayEndAlt);

        const result = {
            observerLat: lat,
            observerLon: lon,
            azimuth,
            altitude,              // Altitud geométrica pura
            apparentAltitude,      // Altitud aparente con refracción atmosférica
            refractionArcmin,      // Refracción en minutos de arco
            refractionDeg,         // Refracción en grados
            distanceKm,
            observerGroundAlt,
            observerEyeAlt,
            minTerrainAlt,
            maxTerrainAlt,
            minY: scale.minY,
            maxY: scale.maxY,
            isObstructed: isObstructed && apparentAltitude > 0,
            isSunBelowHorizon: apparentAltitude <= 0,
            worstClearance,
            criticalObstacle,
            maxObstacleAngle,
            marginDeg,
            points
        };

        if (profileCache.size >= 25) {
            const fKey = profileCache.keys().next().value;
            profileCache.delete(fKey);
        }
        profileCache.set(cacheKey, result);

        return result;
    }

    /**
     * Calcula los límites del eje vertical (minY, maxY) según el relieve y la geometría solar
     */
    function computeVerticalScale(minTerrainAlt, maxTerrainAlt, rayEndAlt) {
        let minY;
        if (minTerrainAlt <= 100) {
            minY = 0;
        } else if (minTerrainAlt < 1000) {
            minY = Math.max(0, Math.floor((minTerrainAlt - 50) / 100) * 100);
        } else {
            minY = Math.max(0, Math.floor((minTerrainAlt - 100) / 250) * 250);
        }

        const localReliefSpan = Math.max(100, maxTerrainAlt - minY);
        const maxAllowedRayAlt = maxTerrainAlt + Math.max(350, localReliefSpan * 0.65);

        let maxY;
        if (rayEndAlt <= maxAllowedRayAlt) {
            const peakVal = Math.max(maxTerrainAlt, rayEndAlt);
            const span = peakVal - minY;
            const rawMax = peakVal + Math.max(120, span * 0.12);

            let step = 100;
            if (rawMax - minY > 5000) step = 1000;
            else if (rawMax - minY > 2500) step = 500;
            else if (rawMax - minY > 800) step = 250;

            maxY = Math.ceil(rawMax / step) * step;
            if (maxY - minY < 200) maxY = minY + 200;
        } else {
            const rawMax = Math.max(minY + 350, maxTerrainAlt + Math.max(250, localReliefSpan * 0.35));
            let step = (rawMax - minY > 2000) ? 500 : 250;
            if (rawMax - minY <= 800) step = 100;
            maxY = Math.ceil(rawMax / step) * step;
        }

        return { minY, maxY };
    }

    /**
     * Dibuja un marcador de Sol Radiante idéntico a fa-sun (8 rayos y núcleo central)
     */
    function drawRadiantSunMarker(ctx, cx, cy) {
        ctx.save();

        // Resplandor cálido exterior
        ctx.shadowColor = 'rgba(245, 158, 11, 0.75)';
        ctx.shadowBlur = 8;

        const numRays = 8;
        const outerR = 9.0;
        const innerR = 5.5;
        const coreR = 3.3;

        // 1. Cuerpo estrellado de 8 rayos radiantes
        ctx.beginPath();
        for (let i = 0; i < numRays * 2; i++) {
            const angle = (i * Math.PI) / numRays - Math.PI / 2;
            const r = (i % 2 === 0) ? outerR : innerR;
            const x = cx + r * Math.cos(angle);
            const y = cy + r * Math.sin(angle);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fillStyle = '#f59e0b'; // Naranja/ámbar brillante
        ctx.fill();
        ctx.strokeStyle = '#fef08a'; // Resalte amarillo claro en bordes
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // 2. Núcleo circular interior característico con aro de contraste
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
        ctx.fillStyle = '#f59e0b';
        ctx.fill();
        ctx.strokeStyle = '#0b1329'; // Aro oscuro de contraste idéntico a la silueta de fa-sun
        ctx.lineWidth = 1.3;
        ctx.stroke();

        ctx.restore();
    }

    /**
     * Dibuja el gráfico completo de visibilidad en un elemento <canvas> (Estilo idéntico a IGN)
     */
    function renderProfileChart(canvas, profileData, options = {}) {
        if (!canvas || !profileData || !profileData.points || profileData.points.length === 0) return;

        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;

        // Ajuste nítido para pantallas Retina/HiDPI
        const rect = canvas.getBoundingClientRect();
        const displayWidth = rect.width > 0 ? rect.width : (canvas.parentElement?.clientWidth || 320);
        const displayHeight = rect.height > 0 ? rect.height : 180;

        canvas.width = Math.round(displayWidth * dpr);
        canvas.height = Math.round(displayHeight * dpr);

        ctx.resetTransform();
        ctx.scale(dpr, dpr);

        if (typeof ResizeObserver !== 'undefined' && canvas.parentElement && !canvas._hasResizeObserver) {
            canvas._hasResizeObserver = true;
            const ro = new ResizeObserver(() => {
                if (canvas._profileMeta && canvas._profileMeta.profileData) {
                    renderProfileChart(canvas, canvas._profileMeta.profileData);
                }
            });
            ro.observe(canvas.parentElement);
        }

        const w = displayWidth;
        const h = displayHeight;

        // Márgenes del gráfico con mayor separación para etiquetas numéricas
        const padLeft = 52;
        const padRight = 30;
        const padTop = 24;
        const padBottom = 32;

        const plotW = Math.max(10, w - padLeft - padRight);
        const plotH = Math.max(10, h - padTop - padBottom);

        const maxDist = profileData.distanceKm * 1000;
        const points = profileData.points;

        // Determinar límites del eje Y (Altitud) según el modelo oficial IGN:
        // Se aplica como escala la mayor altura calculada a 30 km en la dirección del Sol,
        // manteniéndola constante en 10, 20 y 30 km para que el relieve no sufra saltos de proporción.
        let minY = (profileData.referenceMinY != null) ? profileData.referenceMinY : profileData.minY;
        let maxY = (profileData.referenceMaxY != null) ? profileData.referenceMaxY : profileData.maxY;

        if (minY == null || maxY == null) {
            const allTerrainAlts = points.map(p => p.terrainAlt);
            const minTerrainAlt = Math.min(...allTerrainAlts, profileData.observerGroundAlt);
            const maxTerrainAlt = Math.max(...allTerrainAlts, profileData.observerEyeAlt);
            const rayEndAlt = points[points.length - 1].rayAlt;
            const scale = computeVerticalScale(minTerrainAlt, maxTerrainAlt, rayEndAlt);
            minY = scale.minY;
            maxY = scale.maxY;
        }

        const rayEndAlt = points[points.length - 1].rayAlt;
        const rayExitsTop = (rayEndAlt > maxY);

        // Funciones de mapeo de coordenadas mundo a pantalla
        function toScreenX(dist) {
            return padLeft + (dist / maxDist) * plotW;
        }

        function toScreenY(alt) {
            return (padTop + plotH) - ((alt - minY) / (maxY - minY)) * plotH;
        }

        // Limpiar fondo
        ctx.clearRect(0, 0, w, h);

        // Fondo del área de trazado
        ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
        ctx.fillRect(padLeft, padTop, plotW, plotH);

        // Rejilla y etiquetas del eje Y (Altitud)
        const yTickCount = (maxY - minY > 3000) ? 4 : 3;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1;
        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px var(--font-mono, monospace)';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';

        // Título del eje Y
        ctx.save();
        ctx.translate(11, padTop + plotH / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#64748b';
        ctx.font = '9px var(--font-body, system-ui)';
        ctx.fillText('Altitud (m)', 0, 0);
        ctx.restore();

        for (let i = 0; i <= yTickCount; i++) {
            const val = minY + (maxY - minY) * (i / yTickCount);
            const sy = toScreenY(val);

            // Línea horizontal
            ctx.beginPath();
            ctx.setLineDash(i === 0 ? [] : [3, 4]);
            ctx.moveTo(padLeft, sy);
            ctx.lineTo(padLeft + plotW, sy);
            ctx.stroke();

            // Etiqueta limpia
            let labelStr;
            if (val >= 1000) {
                const kVal = val / 1000;
                labelStr = (val % 1000 === 0) ? `${kVal}k` : `${kVal.toFixed(1)}k`;
            } else {
                labelStr = `${Math.round(val)}`;
            }
            // Separación del eje vertical (9 px)
            ctx.fillText(labelStr, padLeft - 9, sy);
        }

        // Rejilla y etiquetas del eje X (Distancia)
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const xTicks = [0, maxDist / 2, maxDist];
        xTicks.forEach(dist => {
            const sx = toScreenX(dist);

            ctx.beginPath();
            ctx.setLineDash([3, 4]);
            ctx.moveTo(sx, padTop);
            ctx.lineTo(sx, padTop + plotH);
            ctx.stroke();

            const distLabel = dist === 0 ? '0' : (dist >= 1000 ? `${dist / 1000}k` : `${dist}`);
            // Separación del eje horizontal (8 px)
            ctx.fillText(distLabel, sx, padTop + plotH + 8);
        });

        // Etiqueta del eje X
        ctx.fillStyle = '#64748b';
        ctx.font = '9px var(--font-body, system-ui)';
        ctx.fillText('Distancia (m)', padLeft + plotW / 2, padTop + plotH + 20);

        ctx.setLineDash([]); // Restaurar línea continua

        // 1 y 2. Relieve topográfico (estilo IGN, acotado limpiamente al área de trazado)
        ctx.save();
        ctx.beginPath();
        ctx.rect(padLeft, padTop, plotW, plotH);
        ctx.clip();

        // 1. Relleno topográfico
        ctx.beginPath();
        ctx.moveTo(toScreenX(0), toScreenY(minY));
        points.forEach(p => {
            ctx.lineTo(toScreenX(p.distance), toScreenY(Math.max(minY, p.terrainAlt)));
        });
        ctx.lineTo(toScreenX(maxDist), toScreenY(minY));
        ctx.closePath();

        const terrainGrad = ctx.createLinearGradient(0, padTop, 0, padTop + plotH);
        terrainGrad.addColorStop(0, 'rgba(194, 65, 12, 0.40)');
        terrainGrad.addColorStop(1, 'rgba(194, 65, 12, 0.05)');
        ctx.fillStyle = terrainGrad;
        ctx.fill();

        // 2. Línea superior del relieve (terracota IGN)
        ctx.beginPath();
        points.forEach((p, idx) => {
            const sx = toScreenX(p.distance);
            const sy = toScreenY(Math.max(minY, p.terrainAlt));
            if (idx === 0) ctx.moveTo(sx, sy);
            else ctx.lineTo(sx, sy);
        });
        ctx.strokeStyle = '#c2410c'; // Terracota IGN
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();

        // 3. Línea de visibilidad (Rayo solar estilo IGN: discontinua amarilla/ámbar)
        const obsSx = toScreenX(0);
        const obsSy = toScreenY(profileData.observerEyeAlt);

        let rayEndSx = toScreenX(maxDist);
        let rayEndSy = toScreenY(rayEndAlt);

        if (rayExitsTop) {
            // Buscar punto exacto de corte con el techo
            let exitDist = maxDist;
            for (let i = 0; i < points.length; i++) {
                if (points[i].rayAlt >= maxY) {
                    const p0 = (i > 0) ? points[i - 1] : { distance: 0, rayAlt: profileData.observerEyeAlt };
                    const p1 = points[i];
                    const denom = Math.max(0.1, p1.rayAlt - p0.rayAlt);
                    const frac = Math.max(0, Math.min(1, (maxY - p0.rayAlt) / denom));
                    exitDist = p0.distance + frac * (p1.distance - p0.distance);
                    break;
                }
            }
            // Calcular el punto exacto de corte en el techo (línea perfectamente recta)
            rayEndSx = toScreenX(exitDist);
            rayEndSy = padTop;
        }

        ctx.save();
        ctx.beginPath();
        ctx.rect(padLeft, padTop, plotW, plotH);
        ctx.clip(); // Cortar estrictamente al área de trazado

        ctx.beginPath();
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = '#fbbf24'; // Amarillo discontinuo IGN
        ctx.lineWidth = 2.2;
        ctx.moveTo(obsSx, obsSy);

        if (rayExitsTop) {
            for (let i = 0; i < points.length; i++) {
                const p = points[i];
                if (p.rayAlt < maxY) {
                    ctx.lineTo(toScreenX(p.distance), toScreenY(p.rayAlt));
                } else {
                    break;
                }
            }
            ctx.lineTo(rayEndSx, rayEndSy);
        } else {
            points.forEach(p => {
                ctx.lineTo(toScreenX(p.distance), toScreenY(p.rayAlt));
            });
        }
        ctx.stroke();
        ctx.restore();

        // Rótulo de Elevación centrado arriba en el panel del gráfico
        ctx.save();
        const geomAlt = (profileData.altitude != null) ? profileData.altitude : 0;
        const dispAlt = (profileData.apparentAltitude != null) ? profileData.apparentAltitude : geomAlt;
        const hasRefr = (profileData.refractionArcmin != null && profileData.refractionArcmin >= 1.0 && dispAlt.toFixed(1) !== geomAlt.toFixed(1));
        const phaseStr = profileData.phaseLabel ? ` (${profileData.phaseLabel})` : '';

        let angleText;
        if (dispAlt <= 0) {
            angleText = `Elevación${phaseStr}: ${dispAlt.toFixed(1)}° (bajo horizonte)`;
            ctx.fillStyle = '#f87171';
        } else if (hasRefr) {
            const refrMin = profileData.refractionArcmin >= 10 
                ? profileData.refractionArcmin.toFixed(0) 
                : profileData.refractionArcmin.toFixed(1);
            angleText = `Elevación${phaseStr}: ${geomAlt.toFixed(1)}° + ${refrMin}' = ${dispAlt.toFixed(1)}°`;
            ctx.fillStyle = '#fbbf24';
        } else {
            angleText = `Elevación${phaseStr}: ${dispAlt.toFixed(1)}°`;
            ctx.fillStyle = '#fbbf24';
        }

        ctx.font = 'bold 10px var(--font-mono, monospace)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
        ctx.shadowBlur = 4;
        ctx.fillText(angleText, padLeft + plotW / 2, 12);
        ctx.restore();

        // 4. Marcador del Observador (Punto azul en x=0 sobre su cota, estilo IGN)
        ctx.beginPath();
        ctx.arc(obsSx, obsSy, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#38bdf8'; // Azul cian observador
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();

        // 5. Marcador del Sol (Sol radiante con 8 rayos unificado en todos los casos)
        const clampedSunSx = Math.max(padLeft, Math.min(padLeft + plotW, rayEndSx));
        const clampedSunSy = Math.max(padTop - 2, Math.min(padTop + plotH + 4, rayEndSy));
        drawRadiantSunMarker(ctx, clampedSunSx, clampedSunSy);

        // 6. Si hay obstrucción, dibujar un indicador rojo destacado en el obstáculo crítico
        if (profileData.isObstructed && profileData.criticalObstacle) {
            const obsPt = profileData.criticalObstacle;
            const obstSx = toScreenX(obsPt.distance);
            const obstSy = toScreenY(obsPt.terrainAlt);

            ctx.beginPath();
            ctx.arc(obstSx, obstSy, 5, 0, Math.PI * 2);
            ctx.fillStyle = '#ef4444'; // Rojo aviso obstáculo
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Flecha vertical de interferencia
            ctx.beginPath();
            ctx.strokeStyle = '#ef4444';
            ctx.setLineDash([2, 2]);
            ctx.moveTo(obstSx, obstSy);
            ctx.lineTo(obstSx, toScreenY(obsPt.rayAlt));
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Guardar mapeos en el canvas para tooltips interactivos
        canvas._profileMeta = {
            profileData,
            padLeft,
            padRight,
            padTop,
            padBottom,
            plotW,
            plotH,
            maxDist,
            minY,
            maxY
        };
    }

    /**
     * Configura la interactividad del tooltip en el canvas (hover / touch)
     */
    function setupCanvasInteractions(canvas, tooltipEl) {
        if (!canvas || canvas._hasInteractions) return;
        canvas._hasInteractions = true;

        function handlePointerMove(e) {
            const meta = canvas._profileMeta;
            if (!meta || !meta.profileData || !tooltipEl) return;

            const rect = canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            if (mouseX < meta.padLeft || mouseX > meta.padLeft + meta.plotW || mouseY < meta.padTop || mouseY > meta.padTop + meta.plotH) {
                tooltipEl.style.display = 'none';
                return;
            }

            const distFraction = (mouseX - meta.padLeft) / meta.plotW;
            const distMeters = distFraction * meta.maxDist;

            // Buscar punto más cercano
            const pts = meta.profileData.points;
            let closest = pts[0];
            let minDiff = Infinity;
            pts.forEach(p => {
                const diff = Math.abs(p.distance - distMeters);
                if (diff < minDiff) {
                    minDiff = diff;
                    closest = p;
                }
            });

            const distKm = (closest.distance / 1000).toFixed(2);
            const terrM = Math.round(closest.terrainAlt);
            const rayM = Math.round(closest.rayAlt);
            const clrM = Math.round(closest.clearance);
            const clrColor = clrM >= 0 ? '#4ade80' : '#f87171';

            const geomAlt = (meta.profileData && meta.profileData.altitude != null) ? meta.profileData.altitude : 0;
            const dispAlt = (meta.profileData && meta.profileData.apparentAltitude != null) ? meta.profileData.apparentAltitude : geomAlt;
            const hasRefr = (meta.profileData && meta.profileData.refractionArcmin != null && meta.profileData.refractionArcmin >= 1.0 && dispAlt.toFixed(1) !== geomAlt.toFixed(1));
            const refrNotice = hasRefr
                ? `<div style="color: #38bdf8; font-size: 0.68rem; margin-top: 2px;">Elevación: ${geomAlt.toFixed(1)}° + ${meta.profileData.refractionArcmin.toFixed(1)}' = <strong>${dispAlt.toFixed(1)}°</strong></div>`
                : '';

            const phaseStr = (meta.profileData && meta.profileData.phaseLabel) ? ` · ${meta.profileData.phaseLabel}` : '';
            tooltipEl.innerHTML = `
                <div style="font-weight: 700; color: #f8fafc; margin-bottom: 2px;">Distancia: ${distKm} km${phaseStr}</div>
                <div style="color: #c2410c;">Terreno: <strong>${terrM} m</strong></div>
                <div style="color: #fbbf24;">Rayo solar: <strong>${rayM} m</strong></div>
                <div style="color: ${clrColor}; margin-top: 2px; font-weight: 600;">Margen: ${clrM >= 0 ? '+' : ''}${clrM} m</div>
                ${refrNotice}
            `;
            tooltipEl.style.display = 'block';

            // Posicionar tooltip
            const tipW = tooltipEl.offsetWidth || 110;
            let leftPos = mouseX + 12;
            if (leftPos + tipW > rect.width - 10) {
                leftPos = mouseX - tipW - 12;
            }
            tooltipEl.style.left = `${leftPos}px`;
            tooltipEl.style.top = `${Math.max(6, mouseY - 40)}px`;
        }

        function handlePointerLeave() {
            if (tooltipEl) tooltipEl.style.display = 'none';
        }

        canvas.addEventListener('mousemove', handlePointerMove);
        canvas.addEventListener('mouseleave', handlePointerLeave);
        canvas.addEventListener('touchstart', (e) => {
            if (e.touches && e.touches[0]) handlePointerMove(e.touches[0]);
        }, { passive: true });
        canvas.addEventListener('touchmove', (e) => {
            if (e.touches && e.touches[0]) handlePointerMove(e.touches[0]);
        }, { passive: true });
        canvas.addEventListener('touchend', handlePointerLeave);
    }

    /**
     * Dibuja o actualiza la traza del rayo de visibilidad (azimut solar y dirección hacia el Sol) en el mapa 2D de Leaflet
     */
    function updateMapSightline(map, profileData) {
        if (!map || typeof L === 'undefined') return;

        if (mapSightlineLayer) {
            map.removeLayer(mapSightlineLayer);
            mapSightlineLayer = null;
        }

        if (!showSightlineOnMap || !profileData || !profileData.points || profileData.points.length === 0) return;

        const obsPt = profileData.points[0];
        const latlngs = profileData.points.map(p => [p.lat, p.lon]);
        const endPt = profileData.points[profileData.points.length - 1];

        const azVal = (profileData.azimuth != null) ? Math.round(profileData.azimuth) : 0;
        const geomAlt = (profileData.altitude != null) ? profileData.altitude : 0;
        const dispAlt = (profileData.apparentAltitude != null) ? profileData.apparentAltitude : geomAlt;
        const altVal = dispAlt.toFixed(1);
        const distKm = profileData.distanceKm || 10;
        const hasRefr = (profileData.refractionArcmin != null && profileData.refractionArcmin >= 1.0 && dispAlt.toFixed(1) !== geomAlt.toFixed(1));
        const refrTooltipStr = hasRefr
            ? ` (${geomAlt.toFixed(1)}° + ${profileData.refractionArcmin >= 10 ? profileData.refractionArcmin.toFixed(0) : profileData.refractionArcmin.toFixed(1)}' = ${altVal}°)`
            : '';
        const phaseStr = profileData.phaseLabel ? ` (${profileData.phaseLabel})` : '';

        const line = L.polyline(latlngs, {
            color: '#f59e0b',
            weight: 3,
            opacity: 0.88,
            dashArray: '6, 6'
        });

        line.bindTooltip(`Dirección hacia el Sol${phaseStr} · Azimut: ${azVal}° · Elevación: ${altVal}°${refrTooltipStr} (${distKm} km)`, {
            sticky: true,
            direction: 'top',
            className: 'sightline-leaflet-tooltip'
        });

        // 1. Icono radiante del Sol en el extremo del rayo (10, 20 o 30 km)
        const sunIcon = L.divIcon({
            className: 'sightline-sun-marker',
            html: `
                <div style="position: relative; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; pointer-events: none;">
                    <span style="position: absolute; width: 24px; height: 24px; border-radius: 50%; background: rgba(245, 158, 11, 0.45); animation: mapPulse 2s infinite ease-out;"></span>
                    <span style="font-size: 14px; color: #fbbf24; text-shadow: 0 0 6px rgba(0,0,0,0.9);"><i class="fa-solid fa-sun"></i></span>
                </div>
            `,
            iconSize: [22, 22],
            iconAnchor: [11, 11]
        });
        const sunMarker = L.marker([endPt.lat, endPt.lon], { icon: sunIcon, interactive: false });

        // 2. Indicador de Azimut próximo al punto de observación (sin borde ni fondo)
        const azRad = azVal * Math.PI / 180;
        const uX = Math.sin(azRad);
        const uY = -Math.cos(azRad);
        const distAlong = 36;
        const perpOffset = 9;
        const nX = Math.cos(azRad);
        const nY = Math.sin(azRad);

        const totalX = Math.round(uX * distAlong + nX * perpOffset);
        const totalY = Math.round(uY * distAlong + nY * perpOffset);

        const azIcon = L.divIcon({
            className: 'sightline-az-label',
            html: `
                <div style="position: absolute; left: ${totalX}px; top: ${totalY}px; transform: translate(-50%, -50%); pointer-events: none; white-space: nowrap;">
                    <span style="font-family: var(--font-mono, monospace); font-size: 11px; font-weight: 700; color: #fbbf24; text-shadow: 0 1px 3px rgba(0,0,0,0.95), 0 0 5px rgba(0,0,0,0.9), 0 0 2px #000; letter-spacing: 0.3px;">
                        Az ${azVal}°
                    </span>
                </div>
            `,
            iconSize: [0, 0],
            iconAnchor: [0, 0]
        });
        const azMarker = L.marker([obsPt.lat, obsPt.lon], { icon: azIcon, interactive: false });

        mapSightlineLayer = L.featureGroup([line, sunMarker, azMarker]);
        mapSightlineLayer.addTo(map);
    }

    /**
     * Actualiza el panel lateral y el gráfico para las circunstancias del observador actual
     */
    async function updateForCircumstances(observer, eclipse, circumstances, targetPhaseKey = null) {
        if (targetPhaseKey) activePhaseKey = targetPhaseKey;
        if (!observer || observer.lat == null || observer.lon == null) return;

        const canvas = document.getElementById('canvas-elevation-profile');
        const tooltipEl = document.getElementById('elevation-profile-tooltip');
        const statusEl = document.getElementById('profile-visibility-status');

        // Si no hay circunstancias o el eclipse no es visible desde este punto
        if (!circumstances || !circumstances.isEclipsed || (circumstances.maxMag != null && circumstances.maxMag <= 0.001)) {
            currentProfileData = null;
            if (canvas) {
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
            if (statusEl) {
                statusEl.innerHTML = `<span style="color: #94a3b8;"><i class="fa-solid fa-ban" style="margin-right: 5px;"></i>Eclipse <strong>no visible</strong> desde esta ubicación</span>`;
            }
            if (typeof EclipseMap2D !== 'undefined' && EclipseMap2D.map) {
                updateMapSightline(EclipseMap2D.map, null);
            }
            return;
        }

        // Determinar qué fase inspeccionar
        const normKey = (activePhaseKey || 'MÁX').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        let targetParam = circumstances.maxParams;
        let phaseLabel = 'MÁX';

        if (normKey === 'C1' && circumstances.c1) {
            targetParam = circumstances.c1;
            phaseLabel = 'C1';
        } else if (normKey === 'C2' && circumstances.c2) {
            targetParam = circumstances.c2;
            phaseLabel = 'C2';
        } else if (normKey === 'C3' && circumstances.c3) {
            targetParam = circumstances.c3;
            phaseLabel = 'C3';
        } else if (normKey === 'C4' && circumstances.c4) {
            targetParam = circumstances.c4;
            phaseLabel = 'C4';
        } else {
            targetParam = circumstances.maxParams;
            phaseLabel = 'MÁX';
        }

        if (!targetParam) {
            targetParam = circumstances.maxParams;
            phaseLabel = 'MÁX';
        }

        const solarAlt = targetParam ? targetParam.alt : 0;
        const solarAz = targetParam ? (targetParam.az != null ? targetParam.az : 0) : 0;

        isFetching = true;
        try {
            // 1. Obtener siempre el perfil de referencia a 30 km en dirección al Sol para la fase seleccionada
            const profile30 = await computeProfileData(observer.lat, observer.lon, solarAz, solarAlt, 30, 80);

            // 2. Obtener el perfil para la distancia activa (10, 20 o 30 km)
            let profile;
            if (activeDistanceKm === 30) {
                profile = profile30;
            } else {
                profile = await computeProfileData(observer.lat, observer.lon, solarAz, solarAlt, activeDistanceKm, 80);
            }

            // 3. Aplicar como escala vertical la mayor altura a 30 km y mantenerla constante en 10, 20 y 30 km
            profile.referenceMinY = profile30.minY;
            profile.referenceMaxY = profile30.maxY;
            profile.maxTerrainAlt30 = profile30.maxTerrainAlt;
            profile.phaseLabel = phaseLabel;
            currentProfileData = profile;
            isFetching = false;

            // Renderizar gráfico
            if (canvas) {
                renderProfileChart(canvas, profile);
                setupCanvasInteractions(canvas, tooltipEl);
            }

            // Actualizar estado de visibilidad estilo IGN con la fase seleccionada (C1, MÁX, etc.)
            const statusEl = document.getElementById('profile-visibility-status');
            if (statusEl) {
                const phaseName = profile.phaseLabel || 'El eclipse';
                if (profile.isSunBelowHorizon) {
                    statusEl.innerHTML = `<span style="color: #f87171;"><i class="fa-solid fa-triangle-exclamation" style="margin-right: 5px;"></i>${phaseName} está <strong>bajo el horizonte</strong> astronómico</span>`;
                } else if (profile.isObstructed || (profile30 && profile30.isObstructed)) {
                    const crit = profile.isObstructed ? profile.criticalObstacle : profile30.criticalObstacle;
                    const distKm = (crit && crit.distance) ? (crit.distance / 1000).toFixed(1) : '';
                    const obstM = crit ? ` (obstáculo a ${distKm} km · cota ${Math.round(crit.terrainAlt)} m)` : '';
                    statusEl.innerHTML = `<span style="color: #f87171;"><i class="fa-solid fa-circle-xmark" style="margin-right: 5px;"></i>${phaseName} <strong>NO es visible</strong> desde el punto de observación${obstM}</span>`;
                } else {
                    statusEl.innerHTML = `<span style="color: #4ade80;"><i class="fa-solid fa-circle-check" style="margin-right: 5px;"></i>${phaseName} <strong>ES visible</strong> desde el punto de observación</span>`;
                }
            }

            // Actualizar traza en Leaflet si el mapa está abierto
            if (typeof EclipseMap2D !== 'undefined' && EclipseMap2D.map) {
                updateMapSightline(EclipseMap2D.map, profile);
            }
        } catch (err) {
            isFetching = false;
            console.error('[TerrainElevationProfile] Error al actualizar perfil:', err);
        }
    }

    /**
     * Cambia la distancia de muestreo del perfil (10, 20 o 30 km)
     */
    function setDistance(km) {
        activeDistanceKm = parseInt(km, 10) || 10;

        // Actualizar estado de los botones chips / segmentos en el DOM
        const chips = document.querySelectorAll('.btn-dist-chip, .btn-dist-segment');
        chips.forEach(btn => {
            const d = parseInt(btn.getAttribute('data-dist'), 10);
            if (d === activeDistanceKm) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Forzar recálculo
        if (typeof localCircumstancesCache !== 'undefined' && typeof currentObserver !== 'undefined' && typeof currentEclipse !== 'undefined') {
            updateForCircumstances(currentObserver, currentEclipse, localCircumstancesCache, activePhaseKey);
        }
    }

    /**
     * Alterna la visualización de la línea de dirección del Sol (azimut) en el mapa 2D
     */
    function toggleSightlineOnMap(enabled = null) {
        showSightlineOnMap = (enabled !== null) ? !!enabled : !showSightlineOnMap;
        const chk = document.getElementById('chk-map-sightline');
        if (chk && chk.checked !== showSightlineOnMap) {
            chk.checked = showSightlineOnMap;
        }
        if (typeof EclipseMap2D !== 'undefined' && EclipseMap2D.map) {
            updateMapSightline(EclipseMap2D.map, currentProfileData);
        }
    }

    /**
     * Abre un cuadro modal emergente con el perfil de visibilidad para cualquier ubicación
     * (útil para clics en el mapa o 3D sin fijar de inmediato el observador)
     */
    async function openModalForLocation(lat, lon, locationName = null) {
        const modalContainer = document.getElementById('visibility-profile-modal');
        if (!modalContainer) {
            createProfileModalDOM();
        }
        const modal = document.getElementById('visibility-profile-modal');
        if (!modal) return;

        const titleEl = document.getElementById('modal-profile-title');
        if (titleEl) {
            titleEl.textContent = locationName ? `Perfil de visibilidad · ${locationName}` : `Perfil de visibilidad (${lat.toFixed(4)}°, ${lon.toFixed(4)}°)`;
        }

        modal.style.display = 'flex';

        // Calcular circunstancias para este punto
        const circ = (typeof calculateLocalSolarCircumstances === 'function' && typeof currentEclipse !== 'undefined')
            ? calculateLocalSolarCircumstances(currentEclipse, lat, lon)
            : null;

        const modalCanvas = document.getElementById('modal-canvas-profile');
        const modalTooltip = document.getElementById('modal-profile-tooltip');

        if (!circ || !circ.maxParams) {
            return;
        }

        const solarAlt = circ.maxParams.alt;
        const solarAz = circ.maxParams.az;

        try {
            const profile30 = await computeProfileData(lat, lon, solarAz, solarAlt, 30, 80);
            let profile;
            if (activeDistanceKm === 30) {
                profile = profile30;
            } else {
                profile = await computeProfileData(lat, lon, solarAz, solarAlt, activeDistanceKm, 80);
            }
            profile.referenceMinY = profile30.minY;
            profile.referenceMaxY = profile30.maxY;
            profile.maxTerrainAlt30 = profile30.maxTerrainAlt;

            if (modalCanvas) {
                renderProfileChart(modalCanvas, profile);
                setupCanvasInteractions(modalCanvas, modalTooltip);
            }
        } catch (err) {
            console.error(err);
        }
    }

    function closeModal() {
        const modal = document.getElementById('visibility-profile-modal');
        if (modal) modal.style.display = 'none';
    }

    /**
     * Inyecta el modal en el DOM si no existe
     */
    function createProfileModalDOM() {
        const div = document.createElement('div');
        div.id = 'visibility-profile-modal';
        div.style.cssText = `
            display: none;
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0, 0, 0, 0.78);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            z-index: 10000;
            align-items: center;
            justify-content: center;
            padding: 16px;
            box-sizing: border-box;
        `;
        div.innerHTML = `
            <div style="background: #0b1329; border: 1px solid rgba(56, 189, 248, 0.35); border-radius: 14px; width: 100%; max-width: 540px; box-shadow: 0 20px 50px rgba(0,0,0,0.85); padding: 14px 18px; box-sizing: border-box; display: flex; flex-direction: column; gap: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 8px;">
                    <div style="font-weight: 700; color: #f8fafc; font-size: 0.95rem; display: flex; align-items: center; gap: 8px;">
                        <i class="fa-solid fa-mountain-sun" style="color: var(--accent-blue, #38bdf8); font-size: 0.70rem;"></i>
                        <span id="modal-profile-title">Perfil de visibilidad</span>
                    </div>
                    <button type="button" onclick="TerrainElevationProfile.closeModal()" style="background: none; border: none; color: #94a3b8; font-size: 1.1rem; cursor: pointer; padding: 2px 6px;"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div style="position: relative; width: 100%; height: 220px; background: rgba(15, 23, 42, 0.6); border-radius: 10px; border: 1px solid rgba(56, 189, 248, 0.15); overflow: hidden; margin-top: 4px;">
                    <canvas id="modal-canvas-profile" style="width: 100%; height: 100%; display: block;"></canvas>
                    <div id="modal-profile-tooltip" style="display: none; position: absolute; pointer-events: none; background: rgba(11, 19, 41, 0.95); border: 1px solid #38bdf8; border-radius: 6px; padding: 4px 8px; font-size: 0.70rem; font-family: var(--font-mono, monospace); color: #f8fafc; box-shadow: 0 4px 12px rgba(0,0,0,0.6); z-index: 10;"></div>
                </div>
            </div>
        `;
        document.body.appendChild(div);
    }

    // Exponer API global
    window.TerrainElevationProfile = {
        computeProfileData,
        renderProfileChart,
        updateForCircumstances,
        setDistance,
        toggleSightlineOnMap,
        openModalForLocation,
        closeModal,
        getCurrentProfile: () => currentProfileData,
        getActivePhaseKey: () => activePhaseKey
    };

})(window);
