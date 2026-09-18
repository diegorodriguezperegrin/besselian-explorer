/* =========================================================================
   COSMOS MATARÓ - MAPA 2D INTERACTIVO DE ECLIPSES (eclipse_map_2d.js)
   Visualizador cartográfico 2D (Leaflet) de alta resolución para trayectorias,
   franjas de totalidad/anularidad, búsqueda geográfica y circunstancias NASA.
   ========================================================================= */

const EclipseMap2D = (() => {
    let map = null;
    let isLoaded = false;
    let isLoading = false;
    let activeBasemapKey = 'dark';
    const tileLayers = {};
    let currentEclipse = null;
    let currentInspectedLocation = null;

    // Grupos de capas vectoriales
    let eclipsePathGroup = null;
    let pathShadeLayer = null;
    let pathLimitsLayer = null;
    let pathCenterLineLayer = null;
    let observerMarkerGroup = null;

    const layerVisibility = {
        centerLine: true,
        limits: true,
        shade: true
    };

    // Sombra lunar dinámica — vector nítido (umbra) + canvas offscreen (penumbra opcional)
    let umbraPolygon = null;           // L.polygon vectorial nítido de totalidad/anularidad
    let shadowCanvas = null;           // <canvas> de renderizado CPU offscreen para penumbra
    let shadowOverlay = null;          // L.ImageOverlay superpuesto al mapa para penumbra
    let _lastShadowKey = null;         // dirty-check para evitar redibujados innecesarios

    // URLs de teselas de alta velocidad sin API Key y sin marcas de agua
    const BASEMAP_CONFIGS = {
        dark: {
            name: '🌌 Oscuro',
            isLayerGroup: true,
            layers: [
                {
                    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
                    options: { maxZoom: 16, attribution: '&copy; Esri, HERE, Garmin, &copy; OpenStreetMap' }
                },
                {
                    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
                    options: { maxZoom: 16, pane: 'labelsPane' }
                }
            ]
        },
        streets: {
            name: '🗺️ Callejero',
            url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
            attribution: '&copy; <a href="https://www.esri.com/" target="_blank">Esri</a>, HERE, Garmin, OpenStreetMap',
            subdomains: '',
            maxZoom: 19
        },
        satellite: {
            name: '🛰️ Satélite',
            url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            attribution: '&copy; <a href="https://www.esri.com/" target="_blank">Esri</a>, Maxar, Earthstar, IGN',
            subdomains: '',
            maxZoom: 19
        }
    };

    /**
     * Carga bajo demanda de Leaflet (CSS + JS) desde CDN con fallback
     */
    function loadLeafletDependencies() {
        return new Promise((resolve, reject) => {
            if (window.L && window.L.map) {
                return resolve(window.L);
            }

            // Inyectar CSS de Leaflet si no existe
            if (!document.getElementById('leaflet-css')) {
                const link = document.createElement('link');
                link.id = 'leaflet-css';
                link.rel = 'stylesheet';
                link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css';
                link.crossOrigin = 'anonymous';
                document.head.appendChild(link);
            }

            // Inyectar JS de Leaflet si no existe
            if (!document.getElementById('leaflet-js')) {
                const script = document.createElement('script');
                script.id = 'leaflet-js';
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js';
                script.crossOrigin = 'anonymous';
                script.onload = () => {
                    if (window.L && window.L.map) resolve(window.L);
                    else reject(new Error('Leaflet cargó pero window.L no está disponible'));
                };
                script.onerror = () => reject(new Error('Error cargando Leaflet desde CDN'));
                document.head.appendChild(script);
            } else {
                const checkInterval = setInterval(() => {
                    if (window.L && window.L.map) {
                        clearInterval(checkInterval);
                        resolve(window.L);
                    }
                }, 50);
            }
        });
    }

    /**
     * Sincroniza el estado visual activo de los botones de estilo de mapa en la interfaz
     */
    function syncBasemapButtons(key = activeBasemapKey) {
        document.querySelectorAll('.map-basemap-btn, .map-basemap-side-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.basemap === key);
        });
    }

    /**
     * Inicialización del mapa y montaje de la UI flotante
     */
    async function initMap(containerId = 'leaflet-map-container') {
        if (map) return map;
        isLoading = true;

        await loadLeafletDependencies();
        const L = window.L;

        const container = document.getElementById(containerId);
        if (!container) throw new Error(`Contenedor #${containerId} no encontrado en el DOM`);

        map = L.map(containerId, {
            center: [40.0, -3.5], // Por defecto centrado en la península ibérica
            zoom: 5,
            zoomControl: false,
            attributionControl: false
        });

        // Crear panel para etiquetas por encima de vectores si se necesita
        map.createPane('labelsPane');
        map.getPane('labelsPane').style.zIndex = 350;
        map.getPane('labelsPane').style.pointerEvents = 'none';

        // Crear panel para la sombra penumbral dinámica: entre tiles (200) y franja vectorial (380)
        map.createPane('shadowPane');
        map.getPane('shadowPane').style.zIndex = 250;
        map.getPane('shadowPane').style.pointerEvents = 'none';

        // Panel para el relleno del pasillo de totalidad/anularidad
        map.createPane('corridorPane');
        map.getPane('corridorPane').style.zIndex = 380;
        map.getPane('corridorPane').style.pointerEvents = 'none';

        // Panel para la sombra vectorial móvil de totalidad (por encima del relleno del pasillo)
        map.createPane('umbraPane');
        map.getPane('umbraPane').style.zIndex = 410;
        map.getPane('umbraPane').style.pointerEvents = 'none';

        // Panel para las líneas de límite norte/sur y eje central (por encima de la umbra móvil)
        map.createPane('corridorLinesPane');
        map.getPane('corridorLinesPane').style.zIndex = 420;
        map.getPane('corridorLinesPane').style.pointerEvents = 'none';

        // Añadir atribución compacta discreta en la esquina inferior derecha
        L.control.attribution({ position: 'bottomright', prefix: false }).addTo(map);

        // Crear las capas base
        Object.keys(BASEMAP_CONFIGS).forEach(key => {
            const cfg = BASEMAP_CONFIGS[key];
            if (cfg.isLayerGroup) {
                const grp = L.layerGroup();
                cfg.layers.forEach(lCfg => {
                    L.tileLayer(lCfg.url, lCfg.options).addTo(grp);
                });
                tileLayers[key] = grp;
            } else {
                tileLayers[key] = L.tileLayer(cfg.url, {
                    attribution: cfg.attribution,
                    subdomains: cfg.subdomains || 'abc',
                    maxZoom: cfg.maxZoom || 19
                });
            }
        });

        // Capa base inicial (Oscuro por defecto, coherente con el estilo de la app)
        try {
            localStorage.removeItem('cosmos_eclipse_map_basemap');
        } catch (e) {}
        activeBasemapKey = 'dark';
        if (tileLayers[activeBasemapKey]) {
            tileLayers[activeBasemapKey].addTo(map);
        }
        syncBasemapButtons(activeBasemapKey);

        // Grupos de capas vectoriales
        eclipsePathGroup = L.featureGroup().addTo(map);
        observerMarkerGroup = L.featureGroup().addTo(map);

        // Montar controles flotantes personalizados
        setupFloatingControls(container);

        // Escuchar clics en el mapa para inspeccionar circunstancias locales
        map.on('click', onMapClick);
        map.on('popupclose', () => {
            currentInspectedLocation = null;
        });

        isLoaded = true;
        isLoading = false;
        return map;
    }

    /**
     * Alternar capa base (Dark / Streets / Satellite)
     */
    function switchBasemap(key) {
        if (!map || !tileLayers[key] || key === activeBasemapKey) return;
        map.removeLayer(tileLayers[activeBasemapKey]);
        tileLayers[key].addTo(map);
        activeBasemapKey = key;

        // Actualizar estado activo en todos los botones (flotante y lateral)
        syncBasemapButtons(key);
    }

    /**
     * Alternar visibilidad de capas individuales (línea central, límites, sombra)
     */
    function toggleLayer(layerKey, isVisible) {
        layerVisibility[layerKey] = isVisible;
        if (!map) return;
        if (layerKey === 'shade') {
            // Franja estática de totalidad/anularidad
            if (pathShadeLayer) {
                if (isVisible) pathShadeLayer.addTo(map);
                else map.removeLayer(pathShadeLayer);
            }
            // Sombra dinámica vectorial (umbra)
            if (umbraPolygon) {
                if (isVisible) {
                    if (!map.hasLayer(umbraPolygon)) umbraPolygon.addTo(map);
                } else {
                    map.removeLayer(umbraPolygon);
                }
            }
            // Sombra dinámica del canvas overlay (penumbra)
            if (shadowOverlay) {
                if (isVisible) {
                    if (!map.hasLayer(shadowOverlay)) shadowOverlay.addTo(map);
                } else {
                    map.removeLayer(shadowOverlay);
                }
            }
            // Forzar redibujado la próxima vez que se reactive
            if (!isVisible) _lastShadowKey = null;
        } else if (layerKey === 'limits' && pathLimitsLayer) {
            if (isVisible) pathLimitsLayer.addTo(map);
            else map.removeLayer(pathLimitsLayer);
        } else if (layerKey === 'centerLine' && pathCenterLineLayer) {
            if (isVisible) pathCenterLineLayer.addTo(map);
            else map.removeLayer(pathCenterLineLayer);
        }
    }

    const MERCATOR_MAX_LAT = 85.05112878;

    /**
     * Interpola el cruce con el antimeridiano (±180°) entre dos puntos
     */
    function getAntimeridianInterp(prev, curr) {
        const deltaLng = curr.lng - prev.lng;
        if (Math.abs(deltaLng) <= 180) return null;
        if (deltaLng < -180) {
            // De Este a Oeste (+180 a -180)
            const unwrappedCurrLng = curr.lng + 360;
            const frac = (180 - prev.lng) / (unwrappedCurrLng - prev.lng);
            const latInt = prev.lat + frac * (curr.lat - prev.lat);
            return { east: [latInt, 179.9999], west: [latInt, -179.9999] };
        } else {
            // De Oeste a Este (-180 a +180)
            const unwrappedCurrLng = curr.lng - 360;
            const frac = (-180 - prev.lng) / (unwrappedCurrLng - prev.lng);
            const latInt = prev.lat + frac * (curr.lat - prev.lat);
            return { east: [latInt, 179.9999], west: [latInt, -179.9999] };
        }
    }

    /**
     * Divide una lista continua de coordenadas en múltiples segmentos:
     * 1) Al sobrepasar la latitud límite de Mercator EPSG:3857 (±85.051129°), segmenta sin unir por el polo.
     * 2) Al detectar cruce/sobrevuelo polar (|lat| > 80° y |Δlng| > 90°), cierra el segmento actual y abre uno nuevo.
     * 3) Al cruzar el antimeridiano (±180°), divide limpiamente para evitar trazos horizontales espurios en Web Mercator.
     */
    function splitCoordsAtAntimeridian(coords) {
        if (!coords || coords.length === 0) return [];
        const rawPts = coords.map(p => Array.isArray(p) ? { lat: p[0], lng: p[1] } : { lat: p.lat, lng: p.lng != null ? p.lng : p.lon });
        
        // Fase 1: Segmentar por límite estricto de latitud Mercator (EPSG:3857)
        const latSegments = [];
        let curLatSeg = [];

        for (let i = 0; i < rawPts.length; i++) {
            const curr = rawPts[i];
            const isInside = Math.abs(curr.lat) <= MERCATOR_MAX_LAT;

            if (i === 0) {
                if (isInside) curLatSeg.push({ lat: curr.lat, lng: curr.lng });
                continue;
            }

            const prev = rawPts[i - 1];
            const wasInside = Math.abs(prev.lat) <= MERCATOR_MAX_LAT;

            if (wasInside && isInside) {
                curLatSeg.push({ lat: curr.lat, lng: curr.lng });
            } else if (wasInside && !isInside) {
                // Sale de los límites hacia el polo: interpolar en el límite de Mercator
                const poleLat = (curr.lat < 0 ? -1 : 1) * MERCATOR_MAX_LAT;
                const frac = (poleLat - prev.lat) / (curr.lat - prev.lat);
                let lngInt = prev.lng + frac * (curr.lng - prev.lng);
                if (lngInt > 180) lngInt -= 360;
                if (lngInt < -180) lngInt += 360;
                curLatSeg.push({ lat: poleLat, lng: lngInt });
                if (curLatSeg.length > 0) latSegments.push(curLatSeg);
                curLatSeg = [];
            } else if (!wasInside && isInside) {
                // Entra de regreso a los límites desde el polo: interpolar en el límite de Mercator
                const poleLat = (prev.lat < 0 ? -1 : 1) * MERCATOR_MAX_LAT;
                const frac = (poleLat - prev.lat) / (curr.lat - prev.lat);
                let lngInt = prev.lng + frac * (curr.lng - prev.lng);
                if (lngInt > 180) lngInt -= 360;
                if (lngInt < -180) lngInt += 360;
                curLatSeg = [{ lat: poleLat, lng: lngInt }, { lat: curr.lat, lng: curr.lng }];
            }
        }
        if (curLatSeg.length > 0) latSegments.push(curLatSeg);

        // Fase 2: Para cada segmento de latitud, detectar saltos polares y cortes en antimeridiano
        const finalSegments = [];

        latSegments.forEach(segPts => {
            if (segPts.length === 0) return;
            let currentSegment = [];

            for (let i = 0; i < segPts.length; i++) {
                const curr = segPts[i];
                if (currentSegment.length === 0) {
                    currentSegment.push([curr.lat, curr.lng]);
                    continue;
                }

                const prev = segPts[i - 1];
                const dLngRaw = Math.abs(curr.lng - prev.lng);
                const isPolarJump = (Math.abs(prev.lat) > 80 || Math.abs(curr.lat) > 80) &&
                                    dLngRaw > 90 && (360 - dLngRaw) > 90;

                if (isPolarJump) {
                    // Cruce polar: cerrar segmento actual y abrir uno nuevo en el otro extremo
                    if (currentSegment.length > 0) {
                        finalSegments.push(currentSegment);
                    }
                    currentSegment = [[curr.lat, curr.lng]];
                    continue;
                }

                const interp = getAntimeridianInterp(prev, curr);
                if (interp) {
                    const deltaLng = curr.lng - prev.lng;
                    if (deltaLng < -180) {
                        currentSegment.push(interp.east);
                        finalSegments.push(currentSegment);
                        currentSegment = [interp.west, [curr.lat, curr.lng]];
                    } else {
                        currentSegment.push(interp.west);
                        finalSegments.push(currentSegment);
                        currentSegment = [interp.east, [curr.lat, curr.lng]];
                    }
                } else {
                    currentSegment.push([curr.lat, curr.lng]);
                }
            }

            if (currentSegment.length > 0) {
                finalSegments.push(currentSegment);
            }
        });

        return finalSegments;
    }

    /**
     * Construye un polígono de pasillo cerrado a partir de una sección norte y sur,
     * recortándolo limpiamente al cruzar el antimeridiano.
     */
    function buildSingleCorridorPolygons(northCoords, southCoords, customSunsetArc = null, customSunriseArc = null) {
        if (!northCoords || !southCoords || northCoords.length < 2 || southCoords.length < 2) return [];

        const nFirst = northCoords[0], nLast = northCoords[northCoords.length - 1];
        const sFirst = southCoords[0], sLast = southCoords[southCoords.length - 1];

        // Arco de corte en terminador: si no se provee arco astronómico exacto (ej. ramas polares),
        // interpola a lo largo del arco geodésico continuo
        const buildTerminalArc = (pA, pB, numSteps = 8) => {
            if (!pA || !pB) return [];
            const pAlon = pA.lng != null ? pA.lng : pA.lon;
            const pBlon = pB.lng != null ? pB.lng : pB.lon;
            let dLng = pBlon - pAlon;
            if (dLng > 180) dLng -= 360;
            if (dLng < -180) dLng += 360;

            const arc = [];
            for (let i = 0; i <= numSteps; i++) {
                const frac = i / numSteps;
                let lng = pAlon + frac * dLng;
                if (lng > 180) lng -= 360;
                if (lng < -180) lng += 360;
                arc.push({
                    lat: pA.lat + frac * (pB.lat - pA.lat),
                    lng: lng,
                    lon: lng,
                    t: (pA.t != null && pB.t != null) ? (pA.t + frac * (pB.t - pA.t)) : null
                });
            }
            return arc;
        };

        const sunsetArc = (customSunsetArc && customSunsetArc.length > 0)
            ? customSunsetArc
            : buildTerminalArc(nLast, sLast);
        const sunriseArc = (customSunriseArc && customSunriseArc.length > 0)
            ? customSunriseArc
            : buildTerminalArc(sFirst, nFirst);

        const sunsetIntermediates = sunsetArc.length > 2 ? sunsetArc.slice(1, -1) : [];
        const sunriseIntermediates = sunriseArc.length > 2 ? sunriseArc.slice(1, -1) : [];

        const loop = [
            ...northCoords.map(p => ({ lat: p.lat, lng: p.lng != null ? p.lng : p.lon })),
            ...sunsetIntermediates.map(p => ({ lat: p.lat, lng: p.lng != null ? p.lng : p.lon })),
            ...southCoords.slice().reverse().map(p => ({ lat: p.lat, lng: p.lng != null ? p.lng : p.lon })),
            ...sunriseIntermediates.map(p => ({ lat: p.lat, lng: p.lng != null ? p.lng : p.lon }))
        ];

        let hasCrossing = false;
        for (let i = 0; i < loop.length; i++) {
            const p1 = loop[i];
            const p2 = loop[(i + 1) % loop.length];
            if (Math.abs(p2.lng - p1.lng) > 180) {
                hasCrossing = true;
                break;
            }
        }

        if (!hasCrossing) {
            return [loop.map(p => [p.lat, p.lng])];
        }

        const eastSegs = [];
        const westSegs = [];
        let curEast = [];
        let curWest = [];

        for (let i = 0; i < loop.length; i++) {
            const p1 = loop[i];
            const p2 = loop[(i + 1) % loop.length];
            const isEast1 = p1.lng >= 0;
            if (isEast1) curEast.push([p1.lat, p1.lng]);
            else curWest.push([p1.lat, p1.lng]);

            const dLng = p2.lng - p1.lng;
            if (Math.abs(dLng) > 180) {
                if (isEast1) {
                    const frac = (180 - p1.lng) / ((p2.lng + 360) - p1.lng);
                    const latInt = p1.lat + frac * (p2.lat - p1.lat);
                    curEast.push([latInt, 179.9999]);
                    eastSegs.push(curEast);
                    curEast = [];
                    curWest.push([latInt, -179.9999]);
                } else {
                    const frac = (-180 - p1.lng) / ((p2.lng - 360) - p1.lng);
                    const latInt = p1.lat + frac * (p2.lat - p1.lat);
                    curWest.push([latInt, -179.9999]);
                    westSegs.push(curWest);
                    curWest = [];
                    curEast.push([latInt, 179.9999]);
                }
            }
        }
        if (curEast.length > 0) {
            if (eastSegs.length > 0) eastSegs[0] = [...curEast, ...eastSegs[0]];
            else eastSegs.push(curEast);
        }
        if (curWest.length > 0) {
            if (westSegs.length > 0) westSegs[0] = [...curWest, ...westSegs[0]];
            else westSegs.push(curWest);
        }

        const polys = [];
        eastSegs.forEach(seg => { if (seg.length >= 3) polys.push(seg); });
        westSegs.forEach(seg => { if (seg.length >= 3) polys.push(seg); });
        return polys;
    }

    /**
     * Construye los polígonos de relleno del pasillo de totalidad/anularidad.
     * En caso de cruce/sobrevuelo polar (|lat| > 80° o corte en ±85.051129°), divide el pasillo
     * en dos tramos independientes (tramo que desciende/entra al polo y tramo que asciende/sale del polo),
     * cerrando cada uno contra el borde polar sin cruzarse entre sí (evitando la franja diagonal fantasma
     * y trazos horizontales sobre el polo).
     */
    function buildCorridorPolygons(northCoords, southCoords, espenakLoop = null, customSunsetArc = null, customSunriseArc = null, precomputedPolygons = null) {
        if (!northCoords || !southCoords || northCoords.length < 2 || southCoords.length < 2) return [];

        const hasPolarCrossing = (coords) => {
            let hasExceed = false;
            let hasJump = false;
            let poleSign = -1;
            for (let i = 0; i < coords.length; i++) {
                const p = coords[i];
                if (Math.abs(p.lat) > 85.0) {
                    hasExceed = true;
                    poleSign = p.lat < 0 ? -1 : 1;
                }
                if (i > 0) {
                    const prev = coords[i - 1];
                    const dLng = Math.abs(p.lng != null ? p.lng : p.lon - (prev.lng != null ? prev.lng : prev.lon));
                    if ((Math.abs(p.lat) > 80 || Math.abs(prev.lat) > 80) && dLng > 90 && (360 - dLng) > 90) {
                        hasJump = true;
                        poleSign = (p.lat + prev.lat) < 0 ? -1 : 1;
                    }
                }
            }
            return { isPolar: hasExceed || hasJump, poleSign };
        };

        const northPolar = hasPolarCrossing(northCoords);
        const southPolar = hasPolarCrossing(southCoords);

        if (!northPolar.isPolar && !southPolar.isPolar) {
            if (precomputedPolygons && precomputedPolygons.length > 0) {
                return precomputedPolygons;
            }
            return buildSingleCorridorPolygons(northCoords, southCoords, customSunsetArc, customSunriseArc);
        }

        const poleSign = northPolar.isPolar ? northPolar.poleSign : southPolar.poleSign;
        const targetPoleLat = poleSign * MERCATOR_MAX_LAT;

        // Función para recortar una línea al entrar o salir del límite polar de Mercator
        const clipToPoleMercator = (coords) => {
            const result = [];
            for (let i = 0; i < coords.length; i++) {
                const curr = coords[i];
                const isInside = Math.abs(curr.lat) <= MERCATOR_MAX_LAT;
                if (i === 0) {
                    if (isInside) result.push(curr);
                    continue;
                }
                const prev = coords[i - 1];
                const wasInside = Math.abs(prev.lat) <= MERCATOR_MAX_LAT;

                if (wasInside && isInside) {
                    // También comprobar salto polar directo
                    const dLng = Math.abs((curr.lng != null ? curr.lng : curr.lon) - (prev.lng != null ? prev.lng : prev.lon));
                    if ((Math.abs(curr.lat) > 80 || Math.abs(prev.lat) > 80) && dLng > 90 && (360 - dLng) > 90) {
                        // Salto polar entre dos puntos: marcar separación
                        result.push({ lat: targetPoleLat, lng: prev.lng != null ? prev.lng : prev.lon, isPolarBreak: true });
                        result.push({ lat: targetPoleLat, lng: curr.lng != null ? curr.lng : curr.lon, isPolarEntry: true });
                    }
                    result.push(curr);
                } else if (wasInside && !isInside) {
                    const frac = (targetPoleLat - prev.lat) / (curr.lat - prev.lat);
                    let lngInt = (prev.lng != null ? prev.lng : prev.lon) + frac * ((curr.lng != null ? curr.lng : curr.lon) - (prev.lng != null ? prev.lng : prev.lon));
                    if (lngInt > 180) lngInt -= 360;
                    if (lngInt < -180) lngInt += 360;
                    result.push({ lat: targetPoleLat, lng: lngInt, isPolarBreak: true });
                } else if (!wasInside && isInside) {
                    const frac = (targetPoleLat - prev.lat) / (curr.lat - prev.lat);
                    let lngInt = (prev.lng != null ? prev.lng : prev.lon) + frac * ((curr.lng != null ? curr.lng : curr.lon) - (prev.lng != null ? prev.lng : prev.lon));
                    if (lngInt > 180) lngInt -= 360;
                    if (lngInt < -180) lngInt += 360;
                    result.push({ lat: targetPoleLat, lng: lngInt, isPolarEntry: true });
                    result.push(curr);
                }
            }
            return result;
        };

        const clippedNorth = clipToPoleMercator(northCoords);
        const clippedSouth = clipToPoleMercator(southCoords);

        // Separar cada límite en dos ramas: tramo 1 (antes del polo) y tramo 2 (después del polo)
        const breakNorthIdx = clippedNorth.findIndex(p => p.isPolarBreak);
        const entryNorthIdx = clippedNorth.findIndex(p => p.isPolarEntry);
        const breakSouthIdx = clippedSouth.findIndex(p => p.isPolarBreak);
        const entrySouthIdx = clippedSouth.findIndex(p => p.isPolarEntry);

        const northBranch1 = breakNorthIdx !== -1 ? clippedNorth.slice(0, breakNorthIdx + 1) : clippedNorth;
        const northBranch2 = entryNorthIdx !== -1 ? clippedNorth.slice(entryNorthIdx) : [];
        const southBranch1 = breakSouthIdx !== -1 ? clippedSouth.slice(0, breakSouthIdx + 1) : clippedSouth;
        const southBranch2 = entrySouthIdx !== -1 ? clippedSouth.slice(entrySouthIdx) : [];

        const allPolys = [];

        // Generar Polígono de la Rama 1 (hacia el polo)
        if (northBranch1.length >= 2 && southBranch1.length >= 2) {
            const polys1 = buildSingleCorridorPolygons(northBranch1, southBranch1, null, customSunriseArc);
            allPolys.push(...polys1);
        }

        // Generar Polígono de la Rama 2 (saliendo del polo)
        if (northBranch2.length >= 2 && southBranch2.length >= 2) {
            const polys2 = buildSingleCorridorPolygons(northBranch2, southBranch2, customSunsetArc, null);
            allPolys.push(...polys2);
        }

        return allPolys.length > 0 ? allPolys : buildSingleCorridorPolygons(northCoords, southCoords, customSunsetArc, customSunriseArc);
    }

    /**
     * Renderiza la penumbra lunar en un <canvas> offscreen 512×256 en proyección Web Mercator estricta
     * (coincidente pixel a pixel con el CRS EPSG:3857 de Leaflet entre ±85.05112878°).
     * Solo se ejecuta si la opción "Gradiente penumbral" está activada.
     */
    function renderShadowCanvas({ x, y, l1, l2, dRad, muRad, tanF1, tanF2 }) {
        const W = 512, H = 256;
        if (!shadowCanvas) {
            shadowCanvas = document.createElement('canvas');
            shadowCanvas.width = W;
            shadowCanvas.height = H;
        }
        const ctx = shadowCanvas.getContext('2d');
        const imgData = ctx.createImageData(W, H);
        const data = imgData.data;

        const sinD = Math.sin(dRad), cosD = Math.cos(dRad);
        const e2 = 0.006694385; // WGS84

        for (let py = 0; py < H; py++) {
            // y_merc en [-π, +π] de Norte a Sur (py=0 es lat +85.0511°, py=H-1 es lat -85.0511°)
            const v = 1.0 - (2.0 * (py + 0.5)) / H;
            const yMerc = Math.PI * v;
            const expY = Math.exp(yMerc);
            const expNegY = 1.0 / expY;
            const coshY = 0.5 * (expY + expNegY);
            const sinhY = 0.5 * (expY - expNegY);
            const sinPhi = sinhY / coshY;
            const cosPhi = 1.0 / coshY;

            // Coordenadas geocéntricas en el elipsoide WGS84
            const C = 1.0 / Math.sqrt(1.0 - e2 * sinPhi * sinPhi);
            const rhoCosPhi = C * cosPhi;
            const rhoSinPhi = (1.0 - e2) * C * sinPhi;

            for (let px = 0; px < W; px++) {
                // lon en [-π, +π] de Oeste a Este
                const lon = (((px + 0.5) / W) * 2.0 - 1.0) * Math.PI;

                // Ángulo horario local del observador: θ = μ + λ
                const theta = muRad + lon;
                const sinTheta = Math.sin(theta), cosTheta = Math.cos(theta);

                // Coordenadas Besselianas del observador en el plano fundamental
                const xi   = rhoCosPhi * sinTheta;
                const eta  = rhoSinPhi * cosD - rhoCosPhi * sinD * cosTheta;
                const zeta = rhoSinPhi * sinD + rhoCosPhi * cosD * cosTheta;

                if (zeta <= 0.0) continue;  // Cara nocturna: no hay sombra

                // Corrección de los radios de penumbra y umbra por la altura ζ del observador
                const L1 = l1 - zeta * tanF1;
                const L2abs = Math.abs(l2 - zeta * tanF2);

                const dx = xi  - x;
                const dy = eta - y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist > L1) continue;  // Fuera de la penumbra exterior

                const idx = (py * W + px) * 4;

                // ---- PENUMBRA (eclipse parcial) ----
                const norm = Math.max(0.0, dist - L2abs) / Math.max(1e-6, L1 - L2abs);
                const factor = Math.max(0.0, Math.min(1.0, 1.0 - norm));
                const alpha = Math.pow(factor, 1.35) * 0.85;
                data[idx]     = 5;
                data[idx + 1] = 10;
                data[idx + 2] = 23;
                data[idx + 3] = Math.round(alpha * 255) | 0;
            }
        }
        ctx.putImageData(imgData, 0, 0);
    }

    /**
     * API pública: recibe los parámetros Besselianos calculados en updateShadowAtTime()
     * y actualiza el mapa 2D:
     * 1) Polígono vectorial exacto de la sombra de totalidad/anularidad (L.polygon en umbraPane).
     * 2) Marcador central de totalidad sobre el eje de la franja.
     * 3) Gradiente penumbral offscreen en proyección Web Mercator (solo si está activado).
     */
    function updateShadow(params) {
        if (!map) return;
        const L = window.L;
        if (!L) return;

        const activeEclipse = params.eclipse || currentEclipse || (typeof window !== 'undefined' && window.currentEclipse) || null;
        const t = params.t != null ? params.t : (parseFloat(document.getElementById('time-slider')?.value) || 0);
        const { x, y, l1, l2, dRad, muRad, tanF1, tanF2, showPenumbra } = params;

        // Si la visibilidad de la sombra/franja está desactivada por el usuario
        if (!layerVisibility.shade) {
            if (umbraPolygon && map.hasLayer(umbraPolygon)) map.removeLayer(umbraPolygon);
            if (shadowOverlay && map.hasLayer(shadowOverlay)) map.removeLayer(shadowOverlay);
            return;
        }

        // =========================================================================
        // 1. POLÍGONO VECTORIAL DE TOTALIDAD / ANULARIDAD (Umbra / Antumbra)
        // =========================================================================
        if (activeEclipse) {
            const isAnnular = (activeEclipse.eclipse_type || '').toUpperCase().startsWith('A');
            const polyFill = isAnnular ? '#261a0d' : '#000000';
            const polyFillOpacity = isAnnular ? 0.82 : 0.88;

            let polyPoints = null;
            if (typeof computeUmbraPolygon === 'function') {
                polyPoints = computeUmbraPolygon(activeEclipse, t);
            } else if (typeof window !== 'undefined' && typeof window.computeUmbraPolygon === 'function') {
                polyPoints = window.computeUmbraPolygon(activeEclipse, t);
            } else if (typeof BesselianEngine !== 'undefined' && typeof BesselianEngine.computeUmbraPolygon === 'function') {
                polyPoints = BesselianEngine.computeUmbraPolygon(activeEclipse, t);
            } else if (typeof window !== 'undefined' && window.BesselianEngine && typeof window.BesselianEngine.computeUmbraPolygon === 'function') {
                polyPoints = window.BesselianEngine.computeUmbraPolygon(activeEclipse, t);
            }

            if (polyPoints && polyPoints.length >= 3) {
                const latLngs = polyPoints.map(p => [p.lat, p.lng]);
                if (!umbraPolygon) {
                    umbraPolygon = L.polygon(latLngs, {
                        pane: 'umbraPane',
                        fillColor: polyFill,
                        fillOpacity: polyFillOpacity,
                        stroke: false,
                        interactive: false,
                        className: 'eclipse-umbra-polygon'
                    });
                    umbraPolygon.addTo(map);
                } else {
                    umbraPolygon.setStyle({
                        fillColor: polyFill,
                        fillOpacity: polyFillOpacity,
                        stroke: false
                    });
                    umbraPolygon.setLatLngs(latLngs);
                    if (!map.hasLayer(umbraPolygon)) umbraPolygon.addTo(map);
                }
            } else {
                // La umbra no está tocando la superficie terrestre en este instante
                if (umbraPolygon && map.hasLayer(umbraPolygon)) map.removeLayer(umbraPolygon);
            }
        }

        // =========================================================================
        // 2. GRADIENTE PENUMBRAL (Solo si la casilla "Gradiente penumbral" está activa)
        // =========================================================================
        if (showPenumbra) {
            const key = `${x.toFixed(4)},${y.toFixed(4)},${l1.toFixed(4)},${l2.toFixed(4)},${dRad.toFixed(5)},${muRad.toFixed(5)}`;
            if (key !== _lastShadowKey) {
                _lastShadowKey = key;
                renderShadowCanvas({ x, y, l1, l2, dRad, muRad, tanF1, tanF2 });

                const dataUrl = shadowCanvas.toDataURL('image/png');
                const bounds = [[-85.0511287798, -180], [85.0511287798, 180]];

                if (shadowOverlay && map.hasLayer(shadowOverlay)) {
                    shadowOverlay.setUrl(dataUrl);
                } else {
                    if (shadowOverlay) map.removeLayer(shadowOverlay);
                    shadowOverlay = L.imageOverlay(dataUrl, bounds, {
                        opacity: 1.0,
                        interactive: false,
                        pane: 'shadowPane',
                        className: 'eclipse-shadow-overlay'
                    }).addTo(map);
                }
            }
        } else {
            // Si el gradiente penumbral está apagado, liberar la capa del mapa
            if (shadowOverlay && map.hasLayer(shadowOverlay)) {
                map.removeLayer(shadowOverlay);
            }
        }
    }

    /**
     * Dibuja la franja del eclipse (línea central, límites y sombra de totalidad)
     */
    function renderEclipsePath(eclipse) {
        if (!map || !eclipse) return;
        currentEclipse = eclipse;

        if (pathShadeLayer) map.removeLayer(pathShadeLayer);
        if (pathLimitsLayer) map.removeLayer(pathLimitsLayer);
        if (pathCenterLineLayer) map.removeLayer(pathCenterLineLayer);
        if (umbraPolygon && map.hasLayer(umbraPolygon)) map.removeLayer(umbraPolygon);
        _lastShadowKey = null;

        pathShadeLayer = L.featureGroup();
        pathLimitsLayer = L.featureGroup();
        pathCenterLineLayer = L.featureGroup();

        const precomputeFn = (typeof precomputeEclipseGeometry === 'function')
            ? precomputeEclipseGeometry
            : (typeof window !== 'undefined' && typeof window.precomputeEclipseGeometry === 'function')
                ? window.precomputeEclipseGeometry
                : (typeof BesselianEngine !== 'undefined' && typeof BesselianEngine.precomputeEclipseGeometry === 'function')
                    ? BesselianEngine.precomputeEclipseGeometry
                    : null;
        if (!precomputeFn) return;
        const geom = precomputeFn(eclipse);
        if (!geom) return;

        const isAnnular = (eclipse.eclipse_type || '').toUpperCase().startsWith('A');
        const primaryColor = isAnnular ? '#ea580c' : '#dc2626'; // Naranja/rojo para línea central
        const limitColor = isAnnular ? '#f59e0b' : '#2563eb';   // Ámbar para anular, azul real para total
        const fillColor = isAnnular ? 'rgba(234, 88, 12, 0.16)' : 'rgba(220, 38, 38, 0.16)';

        const hasCentral = geom.centerCoords && geom.centerCoords.length > 1;
        const hasNorth = geom.totNorthCoords && geom.totNorthCoords.length > 1;
        const hasSouth = geom.totSouthCoords && geom.totSouthCoords.length > 1;

        // 1. Pasillo sombreado de totalidad/anularidad (Polígonos cerrados en los extremos y cortados limpiamente en el antimeridiano)
        if (hasNorth && hasSouth) {
            const corridorPolygons = buildCorridorPolygons(
                geom.totNorthCoords,
                geom.totSouthCoords,
                geom.fullEspenakLoop,
                geom.sunsetArc,
                geom.sunriseArc,
                geom.corridorPolygons
            );
            corridorPolygons.forEach(polyCoords => {
                const poly = L.polygon(polyCoords, {
                    pane: 'corridorPane',
                    color: 'transparent',
                    fillColor: fillColor,
                    fillOpacity: 1,
                    interactive: false
                });
                poly.addTo(pathShadeLayer);
            });
        }

        // 2. Límite Norte y Sur (Multi-polylines si cruzan el antimeridiano)
        if (hasNorth) {
            const northSegs = splitCoordsAtAntimeridian(geom.totNorthCoords);
            const northLine = L.polyline(northSegs.length > 1 ? northSegs : northSegs[0], {
                pane: 'corridorLinesPane',
                color: limitColor,
                weight: 2,
                opacity: 0.85,
                lineCap: 'round',
                lineJoin: 'round',
                interactive: false
            });
            northLine.addTo(pathLimitsLayer);
        }

        if (hasSouth) {
            const southSegs = splitCoordsAtAntimeridian(geom.totSouthCoords);
            const southLine = L.polyline(southSegs.length > 1 ? southSegs : southSegs[0], {
                pane: 'corridorLinesPane',
                color: limitColor,
                weight: 2,
                opacity: 0.85,
                lineCap: 'round',
                lineJoin: 'round',
                interactive: false
            });
            southLine.addTo(pathLimitsLayer);
        }

        // 3. Línea Central (Multi-polyline si cruza el antimeridiano)
        if (hasCentral) {
            const centerSegs = splitCoordsAtAntimeridian(geom.centerCoords);
            const centerLine = L.polyline(centerSegs.length > 1 ? centerSegs : centerSegs[0], {
                pane: 'corridorLinesPane',
                color: primaryColor,
                weight: 3.5,
                opacity: 0.95,
                lineCap: 'round',
                lineJoin: 'round',
                interactive: false
            });
            centerLine.addTo(pathCenterLineLayer);
        }

        // Añadir las capas según visibilidad activa
        if (layerVisibility.shade) pathShadeLayer.addTo(map);
        if (layerVisibility.limits) pathLimitsLayer.addTo(map);
        if (layerVisibility.centerLine) pathCenterLineLayer.addTo(map);

        // Auto-centrar el mapa en la franja si no hay vista fijada previa
        fitEclipse();
    }

    /**
     * Coloca o actualiza el marcador del observador
     */
    function setObserverMarker(lat, lon, name = null) {
        if (!map || lat == null || lon == null) return;
        observerMarkerGroup.clearLayers();

        const customIcon = L.divIcon({
            className: 'custom-observer-pin',
            html: `
                <div style="position: relative; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center;">
                    <span style="position: absolute; width: 22px; height: 22px; border-radius: 50%; background: rgba(56, 189, 248, 0.35); animation: mapPulse 2s infinite ease-out;"></span>
                    <span style="position: absolute; width: 12px; height: 12px; border-radius: 50%; background: #38bdf8; border: 2px solid #ffffff; box-shadow: 0 0 8px rgba(56,189,248,0.9);"></span>
                </div>
            `,
            iconSize: [22, 22],
            iconAnchor: [11, 11]
        });

        const marker = L.marker([lat, lon], { icon: customIcon, zIndexOffset: 1000 });
        marker.addTo(observerMarkerGroup);
    }

    /**
     * Evento al hacer clic en el mapa: calcula circunstancias y abre cuadro NASA
     */
    function onMapClick(e) {
        const { lat, lng } = e.latlng;
        inspectLocation(lat, lng, null, false);
    }

    /**
     * Formatea una hora en UT (HH:MM:SS) a partir del instante relativo t
     */
    function formatUtTimeFromT(eclipse, tVal) {
        const activeEclipse = eclipse || currentEclipse || (typeof window !== 'undefined' && window.currentEclipse) || null;
        if (tVal == null || !activeEclipse) return '--:--:--';
        const dtHours = (activeEclipse.dt || 0) / 3600;
        const totalHours = (activeEclipse.t0 || 0) + tVal - dtHours;
        const baseMidnightUtc = Date.UTC(activeEclipse.year || 2026, (activeEclipse.month || 1) - 1, activeEclipse.day || 1, 0, 0, 0);
        const d = new Date(baseMidnightUtc + Math.round(totalHours * 3600 * 1000));
        const hh = String(d.getUTCHours()).padStart(2, '0');
        const mm = String(d.getUTCMinutes()).padStart(2, '0');
        const ss = String(d.getUTCSeconds()).padStart(2, '0');
        return `${hh}:${mm}:${ss}`;
    }

    /**
     * Fija o sincroniza el eclipse activo
     */
    function setEclipse(eclipse) {
        if (eclipse) currentEclipse = eclipse;
    }

    /**
     * Inspecciona una ubicación concreta (por clic o búsqueda) y muestra el cuadro estilo NASA
     */
    function inspectLocation(lat, lng, locationName = null, autoSetObserver = false) {
        const activeEclipse = currentEclipse || (typeof window !== 'undefined' && window.currentEclipse) || null;
        if (!map || !activeEclipse) return;

        // Normalizar longitud a [-180, 180]
        let normLng = ((lng + 180) % 360 + 360) % 360 - 180;
        let normLat = Math.max(-90, Math.min(90, lat));

        // Calcular circunstancias locales astronómicas rigurosas
        let circ = null;
        if (typeof calculateLocalSolarCircumstances === 'function') {
            circ = calculateLocalSolarCircumstances(currentEclipse, normLat, normLng);
        }

        // Si autoSetObserver está activo, actualizar la app global y el marcador de inmediato
        if (autoSetObserver && typeof updateObserverPosition === 'function') {
            const defaultName = locationName || `${Math.abs(normLat).toFixed(4)}° ${normLat >= 0 ? 'N' : 'S'} · ${Math.abs(normLng).toFixed(4)}° ${normLng >= 0 ? 'E' : 'O'}`;
            if (typeof clearObserverExtremeMode === 'function') {
                clearObserverExtremeMode();
            }
            updateObserverPosition(normLat, normLng, defaultName);
            setObserverMarker(normLat, normLng, defaultName);
        }

        currentInspectedLocation = { lat: normLat, lon: normLng, name: locationName };

        // Construir contenido HTML del popup interactivo estilo NASA
        const popupContent = buildNasaPopupHtml(normLat, normLng, circ, locationName);

        L.popup({
            offset: [0, -10],
            className: 'nasa-eclipse-popup',
            minWidth: 320,
            maxWidth: 320,
            closeButton: true
        })
        .setLatLng([normLat, normLng])
        .setContent(popupContent)
        .openOn(map);
    }

    /**
     * Construye el popup HTML detallado estilo NASA unificado con el panel lateral
     */
    function buildNasaPopupHtml(lat, lon, circ, locationName, eclipse = null) {
        const activeEclipse = eclipse || currentEclipse || (typeof window !== 'undefined' && window.currentEclipse) || null;
        const latStr = `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'N' : 'S'}`;
        const lonStr = `${Math.abs(lon).toFixed(4)}° ${lon >= 0 ? 'E' : 'O'}`;
        const locTitle = locationName ? `<div style="font-weight: 700; color: #38bdf8; font-size: 0.84rem; padding-right: 22px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${locationName}">${locationName}</div>` : '';

        const isEclipsed = !!(circ && circ.isEclipsed && (circ.maxMag == null || circ.maxMag > 0.0005));
        let badgeText = 'NO VISIBLE';
        let badgeClass = 'vis-none';

        if (isEclipsed) {
            if (circ.isTotal) {
                const durSec = (circ.c3 && circ.c2) ? Math.round((circ.c3.t - circ.c2.t) * 3600) : 0;
                badgeText = `TOTAL (${Math.floor(durSec / 60)}m ${String(durSec % 60).padStart(2, '0')}s)`;
                badgeClass = 'vis-total';
            } else if (circ.isAnnular) {
                const durSec = (circ.c3 && circ.c2) ? Math.round((circ.c3.t - circ.c2.t) * 3600) : 0;
                badgeText = `ANULAR (${Math.floor(durSec / 60)}m ${String(durSec % 60).padStart(2, '0')}s)`;
                badgeClass = 'vis-annular';
            } else if (circ.maxParams && circ.maxParams.alt > 0) {
                badgeText = `PARCIAL (Mag. ${(circ.maxMag * 100).toFixed(1)}% · Ocul. ${(circ.maxObs * 100).toFixed(1)}%)`;
                badgeClass = 'vis-partial';
            } else {
                badgeText = 'BAJO EL HORIZONTE';
                badgeClass = 'vis-none';
            }
        }

        const allContacts = [
            { key: 'C1', name: 'Inicio Parcial', data: isEclipsed ? circ.c1 : null },
            { key: 'C2', name: (isEclipsed && circ.isTotal) ? 'Inicio Totalidad' : ((isEclipsed && circ.isAnnular) ? 'Inicio Anularidad' : 'Inicio Total/Anular'), data: isEclipsed ? circ.c2 : null },
            { key: 'MÁX', name: isEclipsed ? `Máximo (Mag. ${(circ.maxMag * 100).toFixed(1)}% · Ocul. ${(circ.maxObs * 100).toFixed(1)}%)` : 'Máximo', data: (isEclipsed && circ.maxParams) ? { t: circ.tMax, ...circ.maxParams } : null },
            { key: 'C3', name: (isEclipsed && circ.isTotal) ? 'Fin Totalidad' : ((isEclipsed && circ.isAnnular) ? 'Fin Anularidad' : 'Fin Total/Anular'), data: isEclipsed ? circ.c3 : null },
            { key: 'C4', name: 'Fin Parcial', data: isEclipsed ? circ.c4 : null }
        ];

        let rowsHtml = '';
        allContacts.forEach(c => {
            if (!c.data) {
                rowsHtml += `
                    <tr class="placeholder-row" style="pointer-events: none; cursor: default;">
                        <td><strong style="color: #f8fafc; font-weight: 600; opacity: 0.5;">${c.key}</strong></td>
                        <td style="color: var(--text-dim, #64748b); opacity: 0.35;">--:--:--</td>
                        <td style="color: var(--text-dim, #64748b); opacity: 0.35;"><span style="visibility: hidden; margin-right: 3px;">↗</span>--</td>
                        <td style="color: var(--text-dim, #64748b); opacity: 0.35;">--</td>
                    </tr>
                `;
                return;
            }

            const p = c.data;
            const isAbove = p.alt > 0;
            const nextAlt = circ.getParamsAtT ? circ.getParamsAtT(c.data.t + 0.005).alt : p.alt;
            const isRising = nextAlt >= p.alt;
            const arrowClass = isRising ? 'arrow-rising' : 'arrow-setting';
            const arrowUnicode = `<span class="popup-alt-arrow ${arrowClass}" style="font-weight: 700; margin-right: 3px;">${isRising ? '↗' : '↘'}</span>`;
            const timeStr = formatUtTimeFromT(activeEclipse, c.data.t);
            const altStr = `${arrowUnicode}${p.alt.toFixed(1)}°`;
            const azVal = p.az != null ? p.az : (p.azm != null ? p.azm : null);
            const azStr = azVal != null ? `${azVal.toFixed(0)}°` : '--';

            rowsHtml += `
                <tr id="row-popup-contact-${c.key}" onclick="if(typeof jumpToContact==='function') jumpToContact('${c.key}', ${c.data.t})" style="cursor: pointer;" title="Clic para saltar a ${c.key} (${c.name})">
                    <td><strong class="popup-phase-key" style="font-weight: 600;">${c.key}</strong></td>
                    <td class="popup-time-cell">${timeStr}</td>
                    <td class="popup-alt-cell" style="font-weight: 500;">${altStr}</td>
                    <td class="popup-az-cell">${azStr}</td>
                </tr>
            `;
        });

        const isCurrentObs = (typeof currentObserver !== 'undefined' && currentObserver && currentObserver.lat != null)
            ? (Math.abs(currentObserver.lat - lat) < 0.005 && Math.abs(currentObserver.lon - lon) < 0.005)
            : false;
        const btnText = isCurrentObs
            ? '<i class="fa-solid fa-check"></i> Ubicación actual'
            : '<i class="fa-solid fa-location-crosshairs"></i> Fijar como mi ubicación';
        const btnBg = isCurrentObs
            ? 'rgba(34, 197, 94, 0.25)'
            : 'rgba(56, 189, 248, 0.18)';
        const btnBorder = isCurrentObs
            ? '#22c55e'
            : 'var(--accent-blue, #38bdf8)';
        const btnColor = isCurrentObs
            ? '#22c55e'
            : '#38bdf8';
        const obsClass = isCurrentObs ? 'is-active-obs' : 'is-preview-obs';

        return `
            <div class="nasa-popup-inner ${obsClass}" style="font-family: var(--font-body, system-ui); width: 100%; box-sizing: border-box; display: flex; flex-direction: column; gap: 4px; padding: 0; margin: 0;">
                ${locTitle}
                <div style="font-size: 0.74rem; font-family: var(--font-mono, monospace); display: flex; align-items: center; gap: 5px; padding-right: 22px;">
                    <i class="fa-solid fa-location-crosshairs" style="color: var(--accent-blue, #38bdf8); font-size: 0.70rem;"></i>
                    <span class="popup-coords-val">${latStr} · ${lonStr}</span>
                </div>

                <div class="observer-badge-header">
                    <span class="vis-badge-tag ${badgeClass}">${badgeText}</span>
                </div>

                <table class="contacts-table" style="width: 100%; border-collapse: collapse; font-size: 0.76rem; font-family: var(--font-mono, monospace); table-layout: fixed;">
                    <colgroup>
                        <col style="width: 17%;">
                        <col style="width: 37%;">
                        <col style="width: 26%;">
                        <col style="width: 20%;">
                    </colgroup>
                    <thead>
                        <tr>
                            <th>Fase</th>
                            <th>Hora (UT)</th>
                            <th>Altitud</th>
                            <th>Azimut</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>

                <button type="button" class="btn-set-obs-map" onclick="EclipseMap2D.setAsActiveObserver(${lat}, ${lon}, '${(locationName || '').replace(/'/g, "\\'")}')" style="width: 100%; height: 28px; background: ${btnBg}; border: 1px solid ${btnBorder}; border-radius: 6px; color: ${btnColor}; font-size: 0.74rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; transition: all 0.2s; margin-top: 4px;">
                    ${btnText}
                </button>
            </div>
        `;
    }

    /**
     * Fija la coordenada como observador de la aplicación global
     */
    function setAsActiveObserver(lat, lon, name = null) {
        const finalName = name || `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'N' : 'S'} · ${Math.abs(lon).toFixed(4)}° ${lon >= 0 ? 'E' : 'O'}`;
        if (typeof clearObserverExtremeMode === 'function') {
            clearObserverExtremeMode();
        }
        if (typeof updateObserverPosition === 'function') {
            updateObserverPosition(lat, lon, finalName);
        }
        if (isLoaded) {
            setObserverMarker(lat, lon, finalName);
        }
        document.querySelectorAll('.btn-set-obs-map').forEach(btn => {
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Ubicación fijada';
            btn.style.background = 'rgba(34, 197, 94, 0.25)';
            btn.style.borderColor = '#22c55e';
            btn.style.color = '#22c55e';
        });
        document.querySelectorAll('.nasa-popup-inner').forEach(card => {
            card.classList.remove('is-preview-obs');
            card.classList.add('is-active-obs');
        });
    }

    /**
     * Configura los controles flotantes en el mapa (Selector de capas, Buscador, Zoom)
     */
    function setupFloatingControls(container) {
        if (!document.getElementById('eclipse-map-custom-css')) {
            const style = document.createElement('style');
            style.id = 'eclipse-map-custom-css';
            style.textContent = `
                @keyframes mapPulse {
                    0% { transform: scale(0.6); opacity: 0.9; }
                    100% { transform: scale(1.8); opacity: 0; }
                }
                .nasa-eclipse-popup .leaflet-popup-content-wrapper {
                    background: linear-gradient(135deg, rgba(14, 165, 233, 0.08), rgba(249, 115, 22, 0.06)), rgba(11, 19, 41, 0.96) !important;
                    backdrop-filter: blur(16px) !important;
                    -webkit-backdrop-filter: blur(16px) !important;
                    border: 1px solid rgba(56, 189, 248, 0.25) !important;
                    border-radius: 12px !important;
                    box-shadow: 0 12px 36px rgba(0, 0, 0, 0.75) !important;
                    padding: 8px 10px !important;
                    width: 320px !important;
                    box-sizing: border-box !important;
                }
                .nasa-eclipse-popup .leaflet-popup-content {
                    margin: 0 !important;
                    padding: 0 !important;
                    width: 100% !important;
                    box-sizing: border-box !important;
                    line-height: 1.35 !important;
                }
                .nasa-eclipse-popup .leaflet-popup-tip {
                    background: rgba(11, 19, 41, 0.96) !important;
                    border: 1px solid rgba(56, 189, 248, 0.25) !important;
                }
                .nasa-eclipse-popup a.leaflet-popup-close-button {
                    color: #94a3b8 !important;
                    padding: 2px 6px !important;
                    top: 8px !important;
                    right: 8px !important;
                    font-size: 14px !important;
                    width: auto !important;
                    height: auto !important;
                    z-index: 20 !important;
                }
                .nasa-eclipse-popup a.leaflet-popup-close-button:hover {
                    color: #f8fafc !important;
                }
                .nasa-eclipse-popup .contacts-table,
                .globe-3d-popup-card .contacts-table {
                    width: 100% !important;
                    border-collapse: collapse !important;
                    font-size: 0.76rem !important;
                    font-family: var(--font-mono, monospace) !important;
                    table-layout: fixed !important;
                }
                .nasa-eclipse-popup .contacts-table th,
                .globe-3d-popup-card .contacts-table th {
                    text-align: left !important;
                    color: var(--accent-blue, #38bdf8) !important;
                    padding: 0 4px !important;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.04) !important;
                    font-size: 0.72rem !important;
                    font-weight: 500 !important;
                    height: 18px !important;
                    line-height: 17px !important;
                    white-space: nowrap !important;
                }
                .nasa-eclipse-popup .contacts-table tr,
                .globe-3d-popup-card .contacts-table tr {
                    height: 18px !important;
                    max-height: 18px !important;
                    min-height: 18px !important;
                    cursor: pointer;
                    transition: background 0.15s ease;
                }
                .nasa-eclipse-popup .contacts-table td,
                .globe-3d-popup-card .contacts-table td {
                    height: 18px !important;
                    max-height: 18px !important;
                    min-height: 18px !important;
                    line-height: 17px !important;
                    vertical-align: middle !important;
                    padding: 0 4px !important;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.04) !important;
                    font-size: 0.76rem !important;
                    color: #f8fafc !important;
                    font-weight: 400 !important;
                    white-space: nowrap !important;
                    overflow: hidden !important;
                    text-overflow: ellipsis !important;
                }
                .nasa-eclipse-popup .contacts-table tr.placeholder-row,
                .globe-3d-popup-card .contacts-table tr.placeholder-row {
                    cursor: default !important;
                    user-select: none !important;
                    pointer-events: none !important;
                }
                .nasa-eclipse-popup .contacts-table tr:hover td,
                .globe-3d-popup-card .contacts-table tr:hover td {
                    background: rgba(56, 189, 248, 0.12) !important;
                    color: #fff !important;
                }
                .nasa-eclipse-popup .contacts-table tr:hover td strong,
                .globe-3d-popup-card .contacts-table tr:hover td strong {
                    color: var(--accent-blue, #38bdf8) !important;
                }
                .nasa-eclipse-popup .contacts-table tr.placeholder-row:hover td,
                .globe-3d-popup-card .contacts-table tr.placeholder-row:hover td {
                    background: transparent !important;
                }
                .nasa-popup-inner {
                    transition: all 0.25s ease;
                }
                .nasa-popup-inner.is-preview-obs .popup-coords-val {
                    color: #94a3b8 !important;
                    transition: color 0.25s ease;
                }
                .nasa-popup-inner.is-preview-obs .vis-badge-tag {
                    color: #94a3b8 !important;
                    transition: color 0.25s ease;
                }
                .nasa-popup-inner.is-preview-obs .contacts-table td {
                    color: #94a3b8 !important;
                    transition: color 0.25s ease;
                }
                .nasa-popup-inner.is-preview-obs .contacts-table td strong {
                    color: #94a3b8 !important;
                    transition: color 0.25s ease;
                }
                .nasa-popup-inner.is-preview-obs .popup-alt-arrow {
                    color: #94a3b8 !important;
                    transition: color 0.25s ease;
                }
                .nasa-popup-inner.is-active-obs .popup-coords-val {
                    color: #f8fafc !important;
                    transition: color 0.25s ease;
                }
                .nasa-popup-inner.is-active-obs .vis-badge-tag {
                    color: #f8fafc !important;
                    transition: color 0.25s ease;
                }
                .nasa-popup-inner.is-active-obs .contacts-table td {
                    color: #f8fafc !important;
                    transition: color 0.25s ease;
                }
                .nasa-popup-inner.is-active-obs .contacts-table td strong {
                    color: #f8fafc !important;
                    transition: color 0.25s ease;
                }
                .nasa-popup-inner.is-active-obs .popup-alt-arrow.arrow-rising {
                    color: #4ade80 !important;
                    transition: color 0.25s ease;
                }
                .nasa-popup-inner.is-active-obs .popup-alt-arrow.arrow-setting {
                    color: #f59e0b !important;
                    transition: color 0.25s ease;
                }
                .nasa-popup-inner .contacts-table tr.placeholder-row td,
                .nasa-popup-inner .contacts-table tr.placeholder-row td strong {
                    color: #94a3b8 !important;
                    opacity: 0.35 !important;
                }
                .map-basemap-btn.active {
                    background: rgba(56, 189, 248, 0.25) !important;
                    border-color: #38bdf8 !important;
                    color: #38bdf8 !important;
                }
                .btn-set-obs-map:hover {
                    background: rgba(56, 189, 248, 0.35) !important;
                    color: #ffffff !important;
                }
                .map-search-result-item:hover {
                    background: rgba(56, 189, 248, 0.2) !important;
                    color: #38bdf8 !important;
                }
            `;
            document.head.appendChild(style);
        }

        const overlay = document.createElement('div');
        overlay.id = 'map-ui-overlay';
        overlay.style.cssText = 'position: absolute; inset: 0; pointer-events: none; z-index: 500; overflow: hidden;';

        overlay.innerHTML = `
            <!-- BARRA SUPERIOR CENTRADA (Buscador de Dirección y Coordenadas con Acciones Rápidas) -->
            <div id="map-search-container" class="floating-top-search-container" style="position: absolute; top: 16px; left: 50%; transform: translateX(-50%); display: flex; align-items: center; justify-content: center; pointer-events: auto; max-width: calc(100vw - 32px); width: max-content; z-index: 500;">
                <!-- Buscador de Dirección y Coordenadas -->
                <div style="position: relative; width: 440px; max-width: calc(100vw - 32px);">
                    <div style="display: flex; align-items: center; background: rgba(11, 19, 41, 0.92); backdrop-filter: blur(16px); border: 1px solid rgba(56, 189, 248, 0.4); border-radius: 10px; height: 35px; padding: 0 6px 0 10px; box-shadow: 0 8px 24px rgba(0,0,0,0.65); gap: 4px;">
                        <i class="fa-solid fa-magnifying-glass" style="color: #38bdf8; font-size: 0.78rem; margin-right: 4px; flex-shrink: 0;"></i>
                        <input type="text" id="map-search-input" placeholder="Buscar municipio o coordenadas..." autocomplete="off" style="flex: 1; min-width: 0; background: transparent; border: none; outline: none; color: #f8fafc; font-size: 0.78rem; font-family: var(--font-body, system-ui);">
                        <button type="button" id="map-search-clear" style="display: none; background: none; border: none; color: #94a3b8; cursor: pointer; padding: 0 4px; font-size: 0.78rem; flex-shrink: 0;" title="Limpiar"><i class="fa-solid fa-xmark"></i></button>
                        <div style="width: 1px; height: 16px; background: rgba(255, 255, 255, 0.15); margin: 0 2px; flex-shrink: 0;"></div>
                        <button type="button" class="capsule-action-btn btn-observer-gps" id="btn-map-gps" onclick="detectUserLocation()" title="Detectar mi ubicación actual (GPS)" aria-label="Usar GPS"><i class="fa-solid fa-location-crosshairs"></i></button>
                        <button type="button" class="capsule-action-btn btn-obs-ge" id="btn-map-ge" onclick="switchObserverExtreme('GE')" title="Mayor Eclipse (GE): Mínima distancia del eje de sombra al centro de la Tierra" aria-label="Mayor Eclipse">GE</button>
                        <button type="button" class="capsule-action-btn btn-obs-gd" id="btn-map-gd" onclick="switchObserverExtreme('GD')" title="Máxima Duración (GD): Punto de mayor duración de la fase central" aria-label="Máxima Duración">GD</button>
                    </div>
                    <!-- Dropdown de resultados de autocompletado -->
                    <div id="map-search-dropdown" style="display: none; position: absolute; top: calc(100% + 4px); left: 0; width: 100%; background: rgba(11, 19, 41, 0.96); backdrop-filter: blur(16px); border: 1px solid rgba(56, 189, 248, 0.4); border-radius: 10px; box-shadow: 0 12px 28px rgba(0,0,0,0.85); max-height: 230px; overflow-y: auto; font-size: 0.78rem; padding: 4px 0; z-index: 1005;">
                    </div>
                </div>
            </div>

            <!-- BOTONES INFERIORES / DERECHA: Zoom -->
            <div class="map-bottom-controls" id="map-bottom-controls" style="position: absolute; bottom: 85px; right: 380px; display: flex; align-items: flex-end; gap: 8px; pointer-events: auto; z-index: 505; transition: right 0.25s ease;">
                <div style="display: flex; flex-direction: column; background: rgba(11, 19, 41, 0.92); backdrop-filter: blur(16px); border: 1px solid rgba(56, 189, 248, 0.4); border-radius: 9px; overflow: hidden; box-shadow: 0 6px 18px rgba(0,0,0,0.65);">
                    <button type="button" onclick="EclipseMap2D.zoomIn()" title="Acercar" style="width: 34px; height: 34px; background: transparent; border: none; border-bottom: 1px solid rgba(255,255,255,0.08); color: #f8fafc; font-size: 0.84rem; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                        <i class="fa-solid fa-plus"></i>
                    </button>
                    <button type="button" onclick="EclipseMap2D.zoomOut()" title="Alejar" style="width: 34px; height: 34px; background: transparent; border: none; color: #f8fafc; font-size: 0.84rem; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                        <i class="fa-solid fa-minus"></i>
                    </button>
                </div>
            </div>
        `;

        container.appendChild(overlay);

        // Sincronizar estado inicial de botones GE / GD y nombre del observador
        if (typeof activeExtremeMode !== 'undefined' && activeExtremeMode) {
            const geBtn = document.getElementById('btn-map-ge');
            const gdBtn = document.getElementById('btn-map-gd');
            if (geBtn) geBtn.classList.toggle('active', activeExtremeMode === 'GE');
            if (gdBtn) gdBtn.classList.toggle('active', activeExtremeMode === 'GD');
        }
        if (typeof currentObserver !== 'undefined' && currentObserver && currentObserver.name) {
            const mapInp = document.getElementById('map-search-input');
            if (mapInp) mapInp.value = currentObserver.name;
        }

        // Ajustar posición dinámica de los controles inferiores según estado del panel derecho
        function syncControlsWithRightPanel() {
            const bottomCtrls = document.getElementById('map-bottom-controls');
            const setPanel = document.getElementById('settings-panel');
            if (!bottomCtrls) return;
            const isPanelOpen = setPanel && !setPanel.classList.contains('collapsed') && window.innerWidth > 1024;
            bottomCtrls.style.right = isPanelOpen ? '380px' : '20px';
        }

        window.addEventListener('resize', syncControlsWithRightPanel);
        const setPanel = document.getElementById('settings-panel');
        if (setPanel && window.MutationObserver) {
            const obs = new MutationObserver(syncControlsWithRightPanel);
            obs.observe(setPanel, { attributes: true, attributeFilter: ['class'] });
        }
        syncControlsWithRightPanel();

        setupSearchListeners();
    }

    /**
     * Búsqueda en tiempo real (coordenadas o geocodificación Photon)
     */
    function setupSearchListeners() {
        const input = document.getElementById('map-search-input');
        const clearBtn = document.getElementById('map-search-clear');
        const dropdown = document.getElementById('map-search-dropdown');
        if (!input || !dropdown) return;

        let debounceTimer = null;

        input.addEventListener('input', (e) => {
            const val = e.target.value.trim();
            if (clearBtn) clearBtn.style.display = val.length > 0 ? 'block' : 'none';
            clearTimeout(debounceTimer);

            if (val.length < 2) {
                dropdown.style.display = 'none';
                return;
            }

            // 1. Si son coordenadas directas (decimales o DMS), sugerir salto inmediato
            const parsedCoords = parseCoordinatesInput(val);
            if (parsedCoords) {
                dropdown.innerHTML = `
                    <div class="map-search-result-item" onclick="EclipseMap2D.goToCoords(${parsedCoords.lat}, ${parsedCoords.lon})" style="padding: 7px 12px; cursor: pointer; color: #f8fafc; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid rgba(255,255,255,0.06);">
                        <i class="fa-solid fa-location-dot" style="color: #38bdf8;"></i>
                        <div>
                            <div>Ir a coordenadas: <strong>${parsedCoords.lat.toFixed(4)}°, ${parsedCoords.lon.toFixed(4)}°</strong></div>
                            <div style="font-size: 0.68rem; color: #94a3b8;">Presiona Enter o haz clic para viajar a este punto</div>
                        </div>
                    </div>
                `;
                dropdown.style.display = 'block';
                return;
            }

            // 2. Si es texto:
            // a) Buscar primero en el catálogo de presets locales
            const cleanQ = val.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            const catalog = (typeof OBSERVER_PRESETS !== 'undefined' && OBSERVER_PRESETS) ||
                            (typeof window !== 'undefined' && window.OBSERVER_LOCATIONS_CATALOG) || [];
            const matchedPresets = catalog.filter(p => {
                const pName = (p.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                return pName.includes(cleanQ);
            }).slice(0, 3);

            // b) Consultar geocoder Photon (OpenStreetMap) con sesgo geográfico y ordenación inteligente
            debounceTimer = setTimeout(async () => {
                try {
                    const center = (map) ? map.getCenter() : { lat: 40.0, lng: -3.5 };
                    const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(val)}&lat=${center.lat}&lon=${center.lng}&limit=12`);
                    if (!res.ok) {
                        if (matchedPresets.length > 0) renderSearchResults([], val, matchedPresets);
                        return;
                    }
                    const data = await res.json();
                    const rawFeatures = data.features || [];

                    // Puntuación inteligente por relevancia administrativa y proximidad al centro del mapa
                    rawFeatures.sort((a, b) => {
                        const score = f => {
                            const p = f.properties || {};
                            let s = 1;
                            if (p.countrycode === 'ES') s *= 6;
                            if (['city', 'town', 'municipality', 'administrative'].includes(p.osm_value) || ['city', 'town'].includes(p.type)) s *= 5;
                            if (p.osm_value === 'isolated_dwelling') s *= 0.2;
                            return s;
                        };
                        const dA = Math.hypot(a.geometry.coordinates[1] - center.lat, a.geometry.coordinates[0] - center.lng) / score(a);
                        const dB = Math.hypot(b.geometry.coordinates[1] - center.lat, b.geometry.coordinates[0] - center.lng) / score(b);
                        return dA - dB;
                    });

                    renderSearchResults(rawFeatures.slice(0, 6), val, matchedPresets);
                } catch(err) {
                    console.warn('[Mapa 2D] Error en geocoder Photon:', err);
                    renderSearchResults([], val, matchedPresets);
                }
            }, 180);
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const val = input.value.trim();
                const parsedCoords = parseCoordinatesInput(val);
                if (parsedCoords) {
                    goToCoords(parsedCoords.lat, parsedCoords.lon);
                    dropdown.style.display = 'none';
                } else {
                    const firstItem = dropdown.querySelector('.map-search-result-item');
                    if (firstItem) firstItem.click();
                }
            } else if (e.key === 'Escape') {
                dropdown.style.display = 'none';
            }
        });

        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                input.value = '';
                clearBtn.style.display = 'none';
                dropdown.style.display = 'none';
                input.focus();
            });
        }

        document.addEventListener('click', (e) => {
            if (!e.target.closest('#map-search-input') && !e.target.closest('#map-search-dropdown')) {
                dropdown.style.display = 'none';
            }
        });
    }

    /**
     * Parsea coordenadas numéricas (decimales, con hemisferio o DMS)
     */
    function parseCoordinatesInput(str) {
        if (!str) return null;
        if (typeof window !== 'undefined' && typeof window.parseCoordinatesInput === 'function') {
            return window.parseCoordinatesInput(str);
        }
        const decMatch = str.match(/^\s*([+-]?\d+(?:\.\d+)?)\s*[,;\s]\s*([+-]?\d+(?:\.\d+)?)\s*$/);
        if (decMatch) {
            const lat = parseFloat(decMatch[1]);
            const lon = parseFloat(decMatch[2]);
            if (!isNaN(lat) && !isNaN(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
                return { lat, lon };
            }
        }
        return null;
    }

    /**
     * Renderiza los resultados de búsqueda combinando presets locales y geocoder Photon
     */
    function renderSearchResults(features, originalQuery, matchedPresets = []) {
        const dropdown = document.getElementById('map-search-dropdown');
        if (!dropdown) return;

        if ((!features || features.length === 0) && matchedPresets.length === 0) {
            const offlineNotice = (!navigator.onLine)
                ? `<div style="font-size: 0.70rem; color: #f59e0b; margin-top: 4px; display: flex; align-items: center; gap: 5px;"><i class="fa-solid fa-triangle-exclamation"></i> Sin conexión: escribe coordenadas (ej: 41.54, 2.44) o una ciudad del catálogo.</div>`
                : '';
            dropdown.innerHTML = `<div style="padding: 8px 12px; color: #94a3b8; font-size: 0.74rem;">No se encontraron localidades para "${originalQuery}"${offlineNotice}</div>`;
            dropdown.style.display = 'block';
            return;
        }

        let html = '';

        // 1. Mostrar coincidencias en Presets Locales
        matchedPresets.forEach(preset => {
            const safeName = (preset.name || '').replace(/'/g, "\\'");
            html += `
                <div class="map-search-result-item" onclick="EclipseMap2D.selectSearchResult(${preset.lat}, ${preset.lon}, '${safeName}')" style="padding: 7px 12px; cursor: pointer; color: #f8fafc; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; align-items: center; gap: 8px; background: rgba(56, 189, 248, 0.08);">
                    <i class="fa-solid fa-star" style="color: #facc15; font-size: 0.80rem; flex-shrink: 0;"></i>
                    <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        <div style="font-weight: 600; color: #f8fafc;">${preset.name}</div>
                        <div style="font-size: 0.68rem; color: #38bdf8;">Ubicación destacada · ${preset.lat.toFixed(2)}°, ${preset.lon.toFixed(2)}°</div>
                    </div>
                </div>
            `;
        });

        // 2. Mostrar resultados de Photon
        (features || []).forEach(f => {
            const props = f.properties || {};
            const name = props.name || props.street || originalQuery;
            const contextParts = [props.city, props.state, props.country].filter(Boolean);
            const context = contextParts.join(', ') || props.country || '';
            const lon = f.geometry.coordinates[0];
            const lat = f.geometry.coordinates[1];
            const safeName = name.replace(/'/g, "\\'");
            html += `
                <div class="map-search-result-item" onclick="EclipseMap2D.selectSearchResult(${lat}, ${lon}, '${safeName}')" style="padding: 7px 12px; cursor: pointer; color: #f8fafc; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; align-items: center; gap: 8px;">
                    <i class="fa-solid fa-location-dot" style="color: #38bdf8; font-size: 0.80rem; flex-shrink: 0;"></i>
                    <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        <div style="font-weight: 600; color: #f8fafc;">${name}</div>
                        <div style="font-size: 0.68rem; color: #94a3b8;">${context}</div>
                    </div>
                </div>
            `;
        });

        dropdown.innerHTML = html;
        dropdown.style.display = 'block';
    }

    /**
     * Selecciona un resultado del buscador y vuela hacia él
     */
    function selectSearchResult(lat, lon, name) {
        const dropdown = document.getElementById('map-search-dropdown');
        const input = document.getElementById('map-search-input');
        if (dropdown) dropdown.style.display = 'none';
        if (input) input.value = name;

        if (map) {
            map.flyTo([lat, lon], 12, { duration: 1.2 });
            setTimeout(() => {
                inspectLocation(lat, lon, name, false);
            }, 1200);
        }
    }

    /**
     * Vuela directamente a unas coordenadas numéricas
     */
    function goToCoords(lat, lon) {
        if (map) {
            map.flyTo([lat, lon], 11, { duration: 1.0 });
            setTimeout(() => {
                inspectLocation(lat, lon, null, false);
            }, 1000);
        }
    }

    /**
     * Ajusta la vista para encuadrar la franja del eclipse
     */
    function fitEclipse() {
        if (!map || typeof L === 'undefined') return;
        const grp = L.featureGroup();
        if (pathCenterLineLayer) pathCenterLineLayer.eachLayer(l => grp.addLayer(l));
        if (pathLimitsLayer) pathLimitsLayer.eachLayer(l => grp.addLayer(l));
        if (pathShadeLayer) pathShadeLayer.eachLayer(l => grp.addLayer(l));
        const bounds = grp.getBounds();
        if (bounds.isValid()) {
            const spanLng = bounds.getEast() - bounds.getWest();
            if (spanLng > 300 && pathCenterLineLayer) {
                let maxSubBounds = null;
                let maxPoints = 0;
                pathCenterLineLayer.eachLayer(layer => {
                    if (layer.getLatLngs) {
                        const lls = layer.getLatLngs();
                        if (Array.isArray(lls) && lls.length > 0) {
                            if (Array.isArray(lls[0])) {
                                lls.forEach(sub => {
                                    if (sub.length > maxPoints) {
                                        maxPoints = sub.length;
                                        maxSubBounds = L.latLngBounds(sub);
                                    }
                                });
                            } else if (lls.length > maxPoints) {
                                maxPoints = lls.length;
                                maxSubBounds = L.latLngBounds(lls);
                            }
                        }
                    }
                });
                if (maxSubBounds && maxSubBounds.isValid()) {
                    map.fitBounds(maxSubBounds, { padding: [70, 70], maxZoom: 6 });
                    return;
                }
            }
            map.fitBounds(bounds, { padding: [70, 70], maxZoom: 6 });
        }
    }

    /**
     * Controles de zoom
     */
    function zoomIn() { if (map) map.zoomIn(); }
    function zoomOut() { if (map) map.zoomOut(); }

    /**
     * Muestra la vista de Mapa 2D
     */
    async function show(eclipse, observer) {
        const layerMap = document.getElementById('layer-map');
        if (layerMap) {
            layerMap.style.display = 'block';
            layerMap.classList.add('active');
        }

        if (!map) {
            await initMap();
        }

        syncBasemapButtons(activeBasemapKey);

        if (eclipse) {
            renderEclipsePath(eclipse);
        }

        if (observer && observer.lat != null && observer.lon != null) {
            setObserverMarker(observer.lat, observer.lon, observer.name);
        }

        setTimeout(() => {
            if (map) map.invalidateSize();
            // Forzar redibujado de la sombra al entrar en vista mapa
            // (el dirty-check bloquearía el primer dibujo si los parámetros no han cambiado)
            _lastShadowKey = null;
            if (typeof window.updateShadowAtTime === 'function') {
                const slider = document.getElementById('time-slider');
                const tNow = slider ? parseFloat(slider.value) || 0 : 0;
                window.updateShadowAtTime(tNow);
            }
        }, 80);
    }

    /**
     * Oculta la vista de Mapa 2D
     */
    function hide() {
        const layerMap = document.getElementById('layer-map');
        if (layerMap) {
            layerMap.style.display = 'none';
            layerMap.classList.remove('active');
        }
    }

    // API pública expuesta
    return {
        show,
        hide,
        switchBasemap,
        syncBasemapButtons,
        getActiveBasemap: () => activeBasemapKey,
        toggleLayer,
        renderEclipsePath,
        drawEclipsePath: renderEclipsePath,
        updateShadow,
        setObserverMarker,
        setAsActiveObserver,
        selectSearchResult,
        goToCoords,
        fitEclipse,
        zoomIn,
        zoomOut,
        buildNasaPopupHtml,
        formatUtTimeFromT,
        setEclipse,
        inspectLocation,
        getInspectedLocation: () => currentInspectedLocation,
        clearInspectedLocation: () => {
            currentInspectedLocation = null;
            if (map) map.closePopup();
        },
        get isLoaded() { return isLoaded; }
    };
})();

// Exposición global
if (typeof window !== 'undefined') {
    window.EclipseMap2D = EclipseMap2D;
    window.buildNasaPopupHtml = EclipseMap2D.buildNasaPopupHtml;
    window.formatUtTimeFromT = EclipseMap2D.formatUtTimeFromT;
    window.setAsActiveObserver = EclipseMap2D.setAsActiveObserver;
    window.setEclipseMap2D = EclipseMap2D.setEclipse;
}
