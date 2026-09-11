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
var routeIntroTimer = 0.0;

        // -------------------------------------------------------------
                // =========================================================================
        // MOTOR CINEMÁTICO: MODO RUTA (ECLIPSE 2027)
        // =========================================================================
                // currentRouteData declarada arriba

        // El Director lee los datos de la ruta desde route_eclipse_2027.js (o fallback a JSON)
        async function loadRouteData(urlOrPath = 'route_eclipse_2027.json') {
            if (currentRouteData) return currentRouteData;
            if (window.DEFAULT_ROUTE_2027_DATA) {
                currentRouteData = window.DEFAULT_ROUTE_2027_DATA;
                return currentRouteData;
            }
            try {
                const response = await fetch(urlOrPath);
                if (response.ok) {
                    currentRouteData = await response.json();
                    return currentRouteData;
                }
            } catch (err) {}
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

            const targetYear = route.year;
            if (targetYear && (!currentEclipse || currentEclipse.year !== targetYear)) {
                const ecTarget = (typeof PRESET_ECLIPSES !== 'undefined' ? PRESET_ECLIPSES.find(e => e.year === targetYear) : null);
                if (ecTarget && typeof selectEclipse === 'function') {
                    selectEclipse(ecTarget, false);
                }
            }

            if (isPlaying) {
                toggleSimulation();
            }

            cameraTransition = null;
            focusedBody = null;

            isRouteActive = true;
            isRoutePlaying = false;
            routeCurrentTime = 0.0;
            routeIntroTimer = (route.introDuration != null) ? route.introDuration : 4.0;
            if (controls) controls.enabled = false;

            const slider = (typeof getDOM === 'function' ? getDOM('time-slider') : document.getElementById('time-slider'));
            if (slider) {
                slider.min = 0;
                slider.max = route.totalDurationSec;
                slider.step = 0.1;
                slider.value = 0;
            }
            ['marker-c1', 'marker-c2', 'marker-max', 'marker-c3', 'marker-c4'].forEach(id => {
                const el = (typeof getDOM === 'function' ? getDOM(id) : document.getElementById(id));
                if (el) el.style.display = 'none';
            });

            updateRoutePlayPauseIcon();
            updateRouteBadge(false);
            if (typeof updateRecenterBtnState === 'function') updateRecenterBtnState();
            updateCinematicRoute(0);
            requestRender();
        }

        function stopCinematicRoute() {
            isRouteActive = false;
            isRoutePlaying = false;
            routeIntroTimer = 0.0;
            if (typeof controls !== 'undefined' && controls) {
                controls.enabled = true;
            }
            const routeHud = (typeof getDOM === 'function' ? getDOM('route-cinematic-hud') : document.getElementById('route-cinematic-hud'));
            if (routeHud) routeHud.style.display = 'none';

            const slider = (typeof getDOM === 'function' ? getDOM('time-slider') : document.getElementById('time-slider'));
            if (slider && typeof currentEclipse !== 'undefined' && currentEclipse) {
                slider.min = currentEclipse.tmin != null ? currentEclipse.tmin : -2.5;
                slider.max = currentEclipse.tmax != null ? currentEclipse.tmax : 2.5;
                slider.step = 'any';
                slider.value = (typeof simCurrentT !== 'undefined') ? simCurrentT : 0;
                if (typeof positionDockMarkers === 'function') {
                    positionDockMarkers(currentEclipse);
                }
            }
            const playMain = (typeof getDOM === 'function' ? getDOM('btn-play-pause') : document.getElementById('btn-play-pause'));
            if (playMain) {
                playMain.innerHTML = (typeof isPlaying !== 'undefined' && isPlaying) ? '<i class="fa-solid fa-pause" aria-hidden="true"></i>' : '<i class="fa-solid fa-play" aria-hidden="true"></i>';
                playMain.title = 'Reproducir / Pausar';
            }
            if (typeof updateShadowAtTime === 'function' && typeof simCurrentT !== 'undefined') {
                updateShadowAtTime(simCurrentT);
            }
            if (typeof updateRecenterBtnState === 'function') {
                updateRecenterBtnState();
            }
        }

        function toggleRoutePlay() {
            if (!isRouteActive) return;
            if (routeIntroTimer > 0) {
                // Si el usuario pulsa reproducir durante la pausa inicial, finaliza la espera y vuela de inmediato
                routeIntroTimer = 0;
                isRoutePlaying = true;
            } else {
                isRoutePlaying = !isRoutePlaying;
            }
            updateRoutePlayPauseIcon();
            updateRouteBadge(isRoutePlaying);
            updateCinematicRoute(0);
            if (typeof requestRender === 'function') requestRender();
        }

        function restartCinematicRoute() {
            const route = currentRouteData || window.DEFAULT_ROUTE_2027_DATA;
            routeCurrentTime = 0.0;
            routeIntroTimer = (route && route.introDuration != null) ? route.introDuration : 4.0;
            isRoutePlaying = false;
            updateCinematicRoute(0);
            updateRoutePlayPauseIcon();
            updateRouteBadge(false);
            requestRender();
        }

        function updateRoutePlayPauseIcon() {
            const btn = (typeof getDOM === 'function' ? getDOM('btn-route-playpause') : document.getElementById('btn-route-playpause'));
            const icon = (typeof getDOM === 'function' ? getDOM('icon-route-playpause') : document.getElementById('icon-route-playpause'));
            if (icon) {
                icon.className = isRoutePlaying ? 'fa-solid fa-pause' : 'fa-solid fa-play';
            }
            if (btn) {
                btn.title = isRoutePlaying ? 'Pausar vuelo' : 'Reanudar vuelo';
            }
            // Sincronizar también el botón principal del reproductor inferior
            const playMain = (typeof getDOM === 'function' ? getDOM('btn-play-pause') : document.getElementById('btn-play-pause'));
            if (playMain && typeof currentActiveView !== 'undefined' && currentActiveView === 'route') {
                playMain.innerHTML = isRoutePlaying ? '<i class="fa-solid fa-pause" aria-hidden="true"></i>' : '<i class="fa-solid fa-play" aria-hidden="true"></i>';
                playMain.title = isRoutePlaying ? 'Pausar vuelo cinemático' : 'Reanudar vuelo cinemático';
            }
        }

        function updateRouteBadge(active) {
            const badge = (typeof getDOM === 'function' ? getDOM('route-badge-live') : document.getElementById('route-badge-live'));
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
            // Sincronizar el badge del reproductor inferior (fases universales para cualquier ruta)
            const dockBadge = (typeof getDOM === 'function' ? getDOM('player-phase-label') : document.getElementById('player-phase-label'));
            if (dockBadge && typeof currentActiveView !== 'undefined' && currentActiveView === 'route') {
                dockBadge.className = active ? 'player-phase-badge tot' : 'player-phase-badge';
                dockBadge.style.display = 'inline-flex';
                if (active) {
                    dockBadge.innerHTML = '<span style="color: #fca5a5;"><span class="phase-dot total"></span>En vuelo</span>';
                } else {
                    dockBadge.innerHTML = '<span style="color: #fde047;"><span class="phase-dot" style="background:#eab308; box-shadow:0 0 6px rgba(234,179,8,0.6);"></span>En pausa</span>';
                }
            }
        }

        function jumpRouteSceneStep(dir) {
            routeIntroTimer = 0;
            const route = currentRouteData || window.DEFAULT_ROUTE_2027_DATA;
            if (!route || !route.scenes || route.scenes.length === 0) return;
            
            let curIdx = 0;
            for (let i = 0; i < route.scenes.length; i++) {
                if (routeCurrentTime >= (route.scenes[i].timeStart - 0.2)) {
                    curIdx = i;
                }
            }
            const nextIdx = Math.max(0, Math.min(route.scenes.length - 1, curIdx + dir));
            routeCurrentTime = route.scenes[nextIdx].timeStart;
            updateCinematicRoute(0);
            updateRoutePlayPauseIcon();
            updateRouteBadge(isRoutePlaying);
            if (typeof requestRender === 'function') requestRender();
        }

        function setRouteTime(t) {
            const route = currentRouteData || window.DEFAULT_ROUTE_2027_DATA;
            if (!route) return;
            if (t > 0) routeIntroTimer = 0;
            routeCurrentTime = Math.max(0, Math.min(route.totalDurationSec, t));
            updateCinematicRoute(0);
            if (typeof requestRender === 'function') requestRender();
        }

        function updateCinematicRoute(delta) {
            if (!isRouteActive) return;

            const route = currentRouteData || window.DEFAULT_ROUTE_2027_DATA; if (!route) return;

            // Manejo de la presentación inicial (4 segundos en pausa mostrando solo el título)
            if (routeIntroTimer > 0) {
                routeIntroTimer = Math.max(0, routeIntroTimer - delta);
                if (routeIntroTimer === 0) {
                    isRoutePlaying = true;
                    updateRoutePlayPauseIcon();
                    updateRouteBadge(true);
                }
            } else if (isRoutePlaying) {
                routeCurrentTime += delta;
            }

            if (routeCurrentTime >= route.totalDurationSec) {
                routeCurrentTime = route.totalDurationSec;
                isRoutePlaying = false;
                updateRoutePlayPauseIcon();
                updateRouteBadge(false);
            }

            const progressRatio = Math.min(1.0, Math.max(0.0, routeCurrentTime / route.totalDurationSec));
            const progressBar = (typeof getDOM === 'function' ? getDOM('route-progress-bar') : document.getElementById('route-progress-bar'));
            if (progressBar) {
                progressBar.style.width = (progressRatio * 100).toFixed(1) + '%';
            }

            // Sincronizar slider y tiempo en el dock inferior
            const dockSlider = (typeof getDOM === 'function' ? getDOM('time-slider') : document.getElementById('time-slider'));
            if (dockSlider && !(window.isSliderInteracting) && typeof currentActiveView !== 'undefined' && currentActiveView === 'route') {
                dockSlider.value = routeCurrentTime;
            }

            const timeLocal = (typeof getDOM === 'function' ? getDOM('time-local-text') : document.getElementById('time-local-text'));
            if (timeLocal && typeof currentActiveView !== 'undefined' && currentActiveView === 'route') {
                const curM = Math.floor(routeCurrentTime / 60);
                const curS = Math.floor(routeCurrentTime % 60);
                const totM = Math.floor(route.totalDurationSec / 60);
                const totS = Math.floor(route.totalDurationSec % 60);
                const pad = (n) => String(n).padStart(2, '0');
                timeLocal.textContent = `${pad(curM)}:${pad(curS)} / ${pad(totM)}:${pad(totS)}`;
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

            // Presentación inicial: durante los 4 segundos en pausa solo se muestra el título (sin descripción)
            const isIntro = (routeIntroTimer > 0) || (routeCurrentTime === 0 && !isRoutePlaying && route.title);
            const targetTitle = isIntro ? (route.title || '') : (activeScene.title || '');
            const targetDesc = isIntro ? '' : (activeScene.desc || '');

            const titleEl = (typeof getDOM === 'function' ? getDOM('route-scene-title') : document.getElementById('route-scene-title'));
            const descEl = (typeof getDOM === 'function' ? getDOM('route-scene-desc') : document.getElementById('route-scene-desc'));
            if (titleEl && titleEl.textContent !== targetTitle) {
                titleEl.textContent = targetTitle;
            }
            if (descEl && descEl.textContent !== targetDesc) {
                descEl.textContent = targetDesc;
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
    window.jumpRouteSceneStep = jumpRouteSceneStep;
    window.setRouteTime = setRouteTime;
    window.updateRoutePlayPauseIcon = updateRoutePlayPauseIcon;
    window.updateRouteBadge = updateRouteBadge;
    window.updateCinematicRoute = updateCinematicRoute;
    window.routeIntroTimer = routeIntroTimer;
    window.RouteDirector = {
        start: startCinematicRoute,
        stop: stopCinematicRoute,
        togglePlay: toggleRoutePlay,
        restart: restartCinematicRoute,
        jumpStep: jumpRouteSceneStep,
        setTime: setRouteTime,
        update: updateCinematicRoute,
        get isActive() { return isRouteActive; },
        get isPlaying() { return isRoutePlaying; },
        get isIntro() { return routeIntroTimer > 0; }
    };
}
