/* =========================================================================
   COSMOS MATARÓ - DIRECTOR CINEMÁTICO (route_director.js)
   Controlador de trayectorias de cámara 3D, interpolación y HUD de vuelo
   cinemático para el eclipse.
   ========================================================================= */

// Variables de estado del modo Ruta cinemático
var isRouteActive = false;
var isRoutePlaying = false;
var routeCurrentTime = 0.0;
var currentRouteData = null;

        // -------------------------------------------------------------
                // =========================================================================
        // MOTOR CINEMÁTICO: MODO RUTA (ECLIPSE 2027)
        // =========================================================================
                // currentRouteData declarada arriba

        // El Director lee y parsea el archivo JSON externo de la ruta seleccionada
        async function loadRouteData(urlOrPath = 'route_eclipse_2027.json') {
            if (currentRouteData) return currentRouteData;
            try {
                const response = await fetch(urlOrPath);
                if (response.ok) {
                    currentRouteData = await response.json();
                    console.log('[Director] Ruta cinemática cargada exitosamente desde JSON:', urlOrPath);
                    return currentRouteData;
                }
            } catch (err) {
                console.warn('[Director] Fetch de JSON no disponible en modo file:// sin servidor local. Usando datos precargados:', err.message);
            }
            if (window.DEFAULT_ROUTE_2027_DATA) {
                currentRouteData = window.DEFAULT_ROUTE_2027_DATA;
                console.log('[Director] Ruta cargada desde DEFAULT_ROUTE_2027_DATA');
            }
            return currentRouteData;
        }

        function getTargetVector(tg) {
            if (!tg) return new THREE.Vector3(0, 0, 0);
            if (tg instanceof THREE.Vector3) return tg;
            if (tg.lat != null && tg.lng != null) {
                if (!tg.radius || tg.radius === 0) return new THREE.Vector3(0, 0, 0);
                return latLngToVector3(tg.lat, tg.lng, tg.radius);
            }
            return new THREE.Vector3(tg.x || 0, tg.y || 0, tg.z || 0);
        }

        // variables de ruta globales

        async function startCinematicRoute() {
            const route = await loadRouteData('route_eclipse_2027.json');
            if (!route) {
                console.error('[Director] No se encontraron datos de la ruta.');
                return;
            }

            const targetYear = route.year || 2027;
            if (!currentEclipse || currentEclipse.year !== targetYear) {
                const ecTarget = PRESET_ECLIPSES.find(e => e.year === targetYear) || PRESET_ECLIPSES[1];
                if (ecTarget) {
                    selectEclipse(ecTarget, false);
                }
            }

            if (isPlaying) {
                toggleSimulation();
            }

            cameraTransition = null;
            focusedBody = null;

            isRouteActive = true;
            isRoutePlaying = true;
            routeCurrentTime = 0.0;
            if (controls) controls.enabled = false;

            updateRoutePlayPauseIcon();
            updateRouteBadge(true);
            requestRender();
        }

        function stopCinematicRoute() {
            isRouteActive = false;
            isRoutePlaying = false;
            if (typeof controls !== 'undefined' && controls) {
                controls.enabled = true;
            }
            const routeHud = getDOM('route-cinematic-hud');
            if (routeHud) routeHud.style.display = 'none';
        }

        function toggleRoutePlay() {
            if (!isRouteActive) return;
            isRoutePlaying = !isRoutePlaying;
            updateRoutePlayPauseIcon();
            updateRouteBadge(isRoutePlaying);
        }

        function restartCinematicRoute() {
            routeCurrentTime = 0.0;
            isRoutePlaying = true;
            updateRoutePlayPauseIcon();
            updateRouteBadge(true);
            requestRender();
        }

        function updateRoutePlayPauseIcon() {
            const btn = getDOM('btn-route-playpause');
            const icon = getDOM('icon-route-playpause');
            if (icon) {
                icon.className = isRoutePlaying ? 'fa-solid fa-pause' : 'fa-solid fa-play';
            }
            if (btn) {
                btn.title = isRoutePlaying ? 'Pausar vuelo' : 'Reanudar vuelo';
            }
        }

        function updateRouteBadge(active) {
            const badge = getDOM('route-badge-live');
            if (badge) {
                if (active) {
                    badge.style.background = 'rgba(239, 68, 68, 0.2)';
                    badge.style.borderColor = 'rgba(239, 68, 68, 0.5)';
                    badge.style.color = '#f87171';
                    badge.innerText = 'EN VUELO';
                } else {
                    badge.style.background = 'rgba(234, 179, 8, 0.2)';
                    badge.style.borderColor = 'rgba(234, 179, 8, 0.5)';
                    badge.style.color = '#facc15';
                    badge.innerText = 'PAUSA';
                }
            }
        }

        function updateCinematicRoute(delta) {
            if (!isRouteActive || !isRoutePlaying) return;

            const route = currentRouteData || window.DEFAULT_ROUTE_2027_DATA; if (!route) return;
            routeCurrentTime += delta;

            if (routeCurrentTime >= route.totalDurationSec) {
                routeCurrentTime = route.totalDurationSec;
                isRoutePlaying = false;
                updateRoutePlayPauseIcon();
                updateRouteBadge(false);
            }

            const progressRatio = Math.min(1.0, Math.max(0.0, routeCurrentTime / route.totalDurationSec));
            const progressBar = getDOM('route-progress-bar');
            if (progressBar) {
                progressBar.style.width = (progressRatio * 100).toFixed(1) + '%';
            }

            let activeScene = route.scenes[0];
            for (let i = 0; i < route.scenes.length; i++) {
                const sc = route.scenes[i];
                if (routeCurrentTime >= sc.timeStart && routeCurrentTime < (sc.timeStart + sc.duration)) {
                    activeScene = sc;
                    break;
                }
                if (routeCurrentTime >= (sc.timeStart + sc.duration)) {
                    activeScene = sc;
                }
            }

            const rawT = Math.min(1.0, Math.max(0.0, (routeCurrentTime - activeScene.timeStart) / activeScene.duration));
            const ease = rawT < 0.5 ? 4 * rawT * rawT * rawT : 1 - Math.pow(-2 * rawT + 2, 3) / 2;

            const titleEl = getDOM('route-scene-title');
            const descEl = getDOM('route-scene-desc');
            if (titleEl && titleEl.innerText !== activeScene.title) {
                titleEl.innerText = activeScene.title;
            }
            if (descEl && descEl.innerText !== activeScene.desc) {
                descEl.innerText = activeScene.desc;
            }

            const curLat = activeScene.camStart.lat + (activeScene.camEnd.lat - activeScene.camStart.lat) * ease;
            const curLng = activeScene.camStart.lng + (activeScene.camEnd.lng - activeScene.camStart.lng) * ease;
            const curRad = activeScene.camStart.radius + (activeScene.camEnd.radius - activeScene.camStart.radius) * ease;
            const targetCamPos = latLngToVector3(curLat, curLng, curRad);
            camera.position.copy(targetCamPos);

            const tStart = getTargetVector(activeScene.targetStart);
            const tEnd = getTargetVector(activeScene.targetEnd);
            const curTarget = new THREE.Vector3().lerpVectors(tStart, tEnd, ease);
            if (controls) {
                controls.target.copy(curTarget);
            }
            camera.lookAt(curTarget);

            const curEclipseT = activeScene.tEclipseStart + (activeScene.tEclipseEnd - activeScene.tEclipseStart) * ease;
            simCurrentT = curEclipseT;
            if (timeSlider) {
                timeSlider.value = curEclipseT;
            }
            updateShadowAtTime(curEclipseT);
            requestRender();
        }

// Exposición en el objeto global
if (typeof window !== 'undefined') {
    window.isRouteActive = isRouteActive;
    window.isRoutePlaying = isRoutePlaying;
    window.routeCurrentTime = routeCurrentTime;
    window.currentRouteData = currentRouteData;
    window.loadRouteData = loadRouteData;
    window.getTargetVector = getTargetVector;
    window.startCinematicRoute = startCinematicRoute;
    window.stopCinematicRoute = stopCinematicRoute;
    window.toggleRoutePlay = toggleRoutePlay;
    window.restartCinematicRoute = restartCinematicRoute;
    window.updateRoutePlayPauseIcon = updateRoutePlayPauseIcon;
    window.updateRouteBadge = updateRouteBadge;
    window.updateCinematicRoute = updateCinematicRoute;
    window.RouteDirector = {
        start: startCinematicRoute,
        stop: stopCinematicRoute,
        togglePlay: toggleRoutePlay,
        restart: restartCinematicRoute,
        update: updateCinematicRoute,
        get isActive() { return isRouteActive; },
        get isPlaying() { return isRoutePlaying; }
    };
}
