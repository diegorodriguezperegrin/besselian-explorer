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

        function getShadowWorldPosition(t, radius) {
            const eclipse = (typeof currentEclipse !== 'undefined' && currentEclipse) ? currentEclipse : ((typeof PRESET_ECLIPSES !== 'undefined') ? PRESET_ECLIPSES.find(e => e.year === 2027) : null);
            if (!eclipse) return new THREE.Vector3(0, 0, 0);
            const centerLL = (typeof besselianToLatLng === 'function') ? besselianToLatLng(eclipse, t) : null;
            if (!centerLL) return new THREE.Vector3(0, 0, 0);
            const r = (radius != null) ? radius : ((typeof EARTH_RADIUS !== 'undefined') ? EARTH_RADIUS * 1.002 : 50.1);
            const rotY = (typeof earthGroup !== 'undefined' && earthGroup && earthGroup.rotation) ? earthGroup.rotation.y : 0;
            return latLngToVector3(centerLL.lat, centerLL.lng, r).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
        }

        function getTargetVector(tg, curT = 0) {
            if (!tg) return new THREE.Vector3(0, 0, 0);
            if (tg instanceof THREE.Vector3) return tg.clone();
            if (typeof tg === 'string') {
                const s = tg.toLowerCase();
                if (s === 'moon') {
                    return (typeof moonMesh3D !== 'undefined' && moonMesh3D) ? moonMesh3D.position.clone() : new THREE.Vector3(0, 0, 0);
                }
                if (s === 'sun') {
                    return (typeof sunGroup3D !== 'undefined' && sunGroup3D) ? sunGroup3D.position.clone() : new THREE.Vector3(0, 0, 100000);
                }
                if (s === 'shadow') {
                    return getShadowWorldPosition(curT);
                }
                if (s === 'earth') {
                    return new THREE.Vector3(0, 0, 0);
                }
            }
            if (tg.body) {
                const b = tg.body.toLowerCase();
                if (b === 'moon') return (typeof moonMesh3D !== 'undefined' && moonMesh3D) ? moonMesh3D.position.clone() : new THREE.Vector3(0, 0, 0);
                if (b === 'sun') return (typeof sunGroup3D !== 'undefined' && sunGroup3D) ? sunGroup3D.position.clone() : new THREE.Vector3(0, 0, 100000);
                if (b === 'shadow') return getShadowWorldPosition(curT);
                if (b === 'earth') return new THREE.Vector3(0, 0, 0);
            }
            if (tg.lat != null && tg.lng != null) {
                if (!tg.radius || tg.radius === 0) return new THREE.Vector3(0, 0, 0);
                const rotY = (typeof earthGroup !== 'undefined' && earthGroup && earthGroup.rotation && tg.rotateWithEarth !== false) ? earthGroup.rotation.y : 0;
                return latLngToVector3(tg.lat, tg.lng, tg.radius).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
            }
            return new THREE.Vector3(tg.x || 0, tg.y || 0, tg.z || 0);
        }

        // Rótulo 3D flotante sobre el pin geográfico del observador en la Tierra
        function updateRoute3DLocationLabel(locationObj) {
            if (typeof observerMarkerGroup3D === 'undefined' || !observerMarkerGroup3D) return;

            if (!locationObj) {
                if (observerMarkerGroup3D._routeLabelSprite) {
                    observerMarkerGroup3D._routeLabelSprite.visible = false;
                }
                return;
            }

            const earthR = (typeof EARTH_RADIUS !== 'undefined') ? EARTH_RADIUS : 50.0;
            observerMarkerGroup3D.position.copy(latLngToVector3(locationObj.lat, locationObj.lon, earthR * 1.004));
            observerMarkerGroup3D.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), latLngToVector3(locationObj.lat, locationObj.lon, 1.0).normalize());
            observerMarkerGroup3D.visible = true;

            const labelText = locationObj.name || locationObj.label;
            if (!labelText) {
                if (observerMarkerGroup3D._routeLabelSprite) observerMarkerGroup3D._routeLabelSprite.visible = false;
                return;
            }

            if (!observerMarkerGroup3D._routeLabelSprite) {
                const canvas = document.createElement('canvas');
                canvas.width = 512;
                canvas.height = 128;
                const texture = new THREE.CanvasTexture(canvas);
                const mat = new THREE.SpriteMaterial({
                    map: texture,
                    transparent: true,
                    depthTest: false,
                    depthWrite: false
                });
                const sprite = new THREE.Sprite(mat);
                sprite.scale.set(7.5, 1.875, 1);
                sprite.position.set(0, 1.5, 0);
                observerMarkerGroup3D.add(sprite);
                observerMarkerGroup3D._routeLabelSprite = sprite;
                observerMarkerGroup3D._routeLabelCanvas = canvas;
                observerMarkerGroup3D._routeLabelTexture = texture;
                observerMarkerGroup3D._lastLabelText = '';
            }

            const sprite = observerMarkerGroup3D._routeLabelSprite;
            sprite.visible = true;

            if (observerMarkerGroup3D._lastLabelText !== labelText) {
                observerMarkerGroup3D._lastLabelText = labelText;
                const canvas = observerMarkerGroup3D._routeLabelCanvas;
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);

                ctx.font = '700 36px "Outfit", "Plus Jakarta Sans", -apple-system, sans-serif';
                const textWidth = ctx.measureText(labelText).width;
                const padX = 26;
                const boxW = Math.min(490, Math.max(160, textWidth + padX * 2));
                const boxH = 74;
                const boxX = (512 - boxW) / 2;
                const boxY = (128 - boxH) / 2;
                const r = 20;

                ctx.fillStyle = 'rgba(11, 19, 38, 0.88)';
                ctx.strokeStyle = 'rgba(56, 189, 248, 0.9)';
                ctx.lineWidth = 4;
                ctx.shadowColor = 'rgba(56, 189, 248, 0.6)';
                ctx.shadowBlur = 14;

                ctx.beginPath();
                if (typeof ctx.roundRect === 'function') {
                    ctx.roundRect(boxX, boxY, boxW, boxH, r);
                } else {
                    ctx.rect(boxX, boxY, boxW, boxH);
                }
                ctx.fill();
                ctx.stroke();

                ctx.shadowBlur = 0;
                ctx.fillStyle = '#f8fafc';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(labelText, 256, 64);

                observerMarkerGroup3D._routeLabelTexture.needsUpdate = true;
            }
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

            // Guardar preferencia previa de conos volumétricos
            const chkCones = (typeof getDOM === 'function' ? getDOM('chk-show-space-cones') : document.getElementById('chk-show-space-cones'));
            window._savedRouteSpaceConesPref = chkCones ? chkCones.checked : true;

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

            const routeBadgeEl = (typeof getDOM === 'function' ? getDOM('route-scene-badge') : document.getElementById('route-scene-badge'));
            if (routeBadgeEl) routeBadgeEl.style.display = 'none';

            if (typeof observerMarkerGroup3D !== 'undefined' && observerMarkerGroup3D && observerMarkerGroup3D._routeLabelSprite) {
                observerMarkerGroup3D._routeLabelSprite.visible = false;
            }

            // Restaurar conos volumétricos a la preferencia previa del usuario
            if (window._savedRouteSpaceConesPref != null) {
                const chkCones = (typeof getDOM === 'function' ? getDOM('chk-show-space-cones') : document.getElementById('chk-show-space-cones'));
                if (chkCones) chkCones.checked = window._savedRouteSpaceConesPref;
                if (typeof umbraConeMesh3D !== 'undefined' && umbraConeMesh3D) umbraConeMesh3D.visible = window._savedRouteSpaceConesPref;
                if (typeof penumbraConeMesh3D !== 'undefined' && penumbraConeMesh3D) penumbraConeMesh3D.visible = window._savedRouteSpaceConesPref;
            }

            const dockBadge = (typeof getDOM === 'function' ? getDOM('player-phase-label') : document.getElementById('player-phase-label'));
            if (dockBadge) {
                dockBadge.style.display = '';
            }

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
            // En modo ruta se oculta el badge del reproductor inferior (no duplicar información con el minutaje)
            const dockBadge = (typeof getDOM === 'function' ? getDOM('player-phase-label') : document.getElementById('player-phase-label'));
            if (dockBadge && typeof currentActiveView !== 'undefined' && currentActiveView === 'route') {
                dockBadge.style.display = 'none';
                dockBadge.innerHTML = '';
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
                restartCinematicRoute();
                return;
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

            // 1. Sombra y tiempo astronómico del eclipse (calcular antes de la cámara para que los cuerpos y la Tierra estén en su posición física)
            const curEclipseT = activeScene.tEclipseStart + (activeScene.tEclipseEnd - activeScene.tEclipseStart) * ease;
            simCurrentT = curEclipseT;
            if (timeSlider && !(window.isSliderInteracting) && typeof currentActiveView !== 'undefined' && currentActiveView === 'route') {
                timeSlider.value = curEclipseT;
            }
            if (typeof updateShadowAtTime === 'function') {
                updateShadowAtTime(curEclipseT);
            }

            // 2. Capa de conos volumétricos por escena (Punto B)
            if (typeof activeScene.showSpaceCones === 'boolean') {
                if (typeof umbraConeMesh3D !== 'undefined' && umbraConeMesh3D) umbraConeMesh3D.visible = activeScene.showSpaceCones;
                if (typeof penumbraConeMesh3D !== 'undefined' && penumbraConeMesh3D) penumbraConeMesh3D.visible = activeScene.showSpaceCones;
                const chkCones = (typeof getDOM === 'function' ? getDOM('chk-show-space-cones') : document.getElementById('chk-show-space-cones'));
                if (chkCones) chkCones.checked = activeScene.showSpaceCones;
            }

            // 3. Marcador geográfico y rótulo 3D flotante sobre la ubicación en la Tierra (Punto D - Opción 1)
            updateRoute3DLocationLabel(activeScene.observerLocation);

            // 4. Textos flotantes del HUD (Presentación inicial limpia de 4s y estética documental sin pastillas)
            const isIntro = (routeIntroTimer > 0) || (routeCurrentTime === 0 && !isRoutePlaying && route.title);
            const targetTitle = isIntro ? (route.title || '') : (activeScene.title || '');
            const targetDesc = isIntro ? '' : (activeScene.desc || '');

            const titleEl = (typeof getDOM === 'function' ? getDOM('route-scene-title') : document.getElementById('route-scene-title'));
            const descEl = (typeof getDOM === 'function' ? getDOM('route-scene-desc') : document.getElementById('route-scene-desc'));
            const badgeEl = (typeof getDOM === 'function' ? getDOM('route-scene-badge') : document.getElementById('route-scene-badge'));

            if (titleEl && titleEl.textContent !== targetTitle) {
                titleEl.textContent = targetTitle;
            }
            if (descEl && descEl.textContent !== targetDesc) {
                descEl.textContent = targetDesc;
            }
            if (badgeEl) {
                badgeEl.style.display = 'none';
            }

            // 5. Posicionamiento dinámico de cámara y objetivo visual
            let targetCamPos = null;
            let curTarget = null;

            if (activeScene.follow === 'shadow') {
                // MODO PERSECUCIÓN DE LA SOMBRA (SHADOW CHASE / AVIÓN)
                const shadowPos = getShadowWorldPosition(curEclipseT);
                const prevShadowPos = getShadowWorldPosition(curEclipseT - 0.012);
                let dir = shadowPos.clone().sub(prevShadowPos);
                if (dir.lengthSq() > 0.0001) {
                    dir.normalize();
                } else {
                    dir = new THREE.Vector3(1, 0, 0);
                }

                const distBehind = activeScene.distBehind != null ? activeScene.distBehind : 16.0;
                const altitude = activeScene.altitude != null ? activeScene.altitude : 24.0;
                const earthR = (typeof EARTH_RADIUS !== 'undefined') ? EARTH_RADIUS : 50.0;
                const totalRadius = earthR + altitude;

                targetCamPos = shadowPos.clone().sub(dir.clone().multiplyScalar(distBehind));
                targetCamPos.setLength(totalRadius);

                curTarget = shadowPos.clone().add(dir.clone().multiplyScalar(4.0));
            } else {
                const curLat = activeScene.camStart.lat + (activeScene.camEnd.lat - activeScene.camStart.lat) * ease;
                const curLng = activeScene.camStart.lng + (activeScene.camEnd.lng - activeScene.camStart.lng) * ease;
                const curRad = activeScene.camStart.radius + (activeScene.camEnd.radius - activeScene.camStart.radius) * ease;
                targetCamPos = latLngToVector3(curLat, curLng, curRad);

                const tStart = getTargetVector(activeScene.targetStart, curEclipseT);
                const tEnd = getTargetVector(activeScene.targetEnd, curEclipseT);
                curTarget = new THREE.Vector3().lerpVectors(tStart, tEnd, ease);
            }

            camera.position.copy(targetCamPos);
            if (controls) {
                controls.target.copy(curTarget);
            }
            camera.lookAt(curTarget);

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
