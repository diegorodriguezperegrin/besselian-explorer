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
        // MOTOR CINEMÁTICO: DIRECTOR MULTIRUTA
        // =========================================================================

        // Catálogo global de rutas cinematográficas indexadas por año/id
        window.ECLIPSE_ROUTES = window.ECLIPSE_ROUTES || {};

        function registerEclipseRoute(routeData) {
            if (!routeData || !routeData.year) return;
            window.ECLIPSE_ROUTES = window.ECLIPSE_ROUTES || {};
            window.ECLIPSE_ROUTES[routeData.year] = routeData;
            if (routeData.id) {
                window.ECLIPSE_ROUTES[routeData.id] = routeData;
            }
        }

        function getRouteForEclipse(eclipseOrYear) {
            if (!eclipseOrYear) return null;
            const year = (typeof eclipseOrYear === 'object') ? eclipseOrYear.year : eclipseOrYear;
            if (window.ECLIPSE_ROUTES && window.ECLIPSE_ROUTES[year]) {
                return window.ECLIPSE_ROUTES[year];
            }
            if (window.ECLIPSE_ROUTES && window.ECLIPSE_ROUTES[String(year)]) {
                return window.ECLIPSE_ROUTES[String(year)];
            }
            if (year === 2027 && window.DEFAULT_ROUTE_2027_DATA) {
                return window.DEFAULT_ROUTE_2027_DATA;
            }
            return null;
        }

        function hasRouteForEclipse(eclipseOrYear) {
            return !!getRouteForEclipse(eclipseOrYear);
        }

        function getCurrentRoute() {
            if (currentRouteData) return currentRouteData;
            const year = (typeof currentEclipse !== 'undefined' && currentEclipse) ? currentEclipse.year : 2027;
            return getRouteForEclipse(year) || getRouteForEclipse(2027) || window.DEFAULT_ROUTE_2027_DATA || null;
        }

        // El Director lee los datos de la ruta desde el catálogo, script cargado o fallback a JSON
        async function loadRouteData(target = 'route_eclipse_2027.json') {
            if (typeof target === 'number' || (typeof target === 'string' && !target.includes('.'))) {
                const found = getRouteForEclipse(target);
                if (found) {
                    currentRouteData = found;
                    return currentRouteData;
                }
            }
            if (currentRouteData) return currentRouteData;
            const activeYear = (typeof currentEclipse !== 'undefined' && currentEclipse) ? currentEclipse.year : 2027;
            const foundActive = getRouteForEclipse(activeYear);
            if (foundActive) {
                currentRouteData = foundActive;
                return currentRouteData;
            }
            if (window.DEFAULT_ROUTE_2027_DATA) {
                currentRouteData = window.DEFAULT_ROUTE_2027_DATA;
                return currentRouteData;
            }
            try {
                const response = await fetch(target);
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

        function getTargetVector(tg, curT = 0, cPos = null) {
            if (!tg) return new THREE.Vector3(0, 0, 0);
            if (tg instanceof THREE.Vector3) return tg.clone();
            const refCam = cPos || (typeof camera !== 'undefined' ? camera.position : new THREE.Vector3(0, 0, 100));

            if (typeof tg === 'string') {
                const s = tg.toLowerCase();
                if (s === 'moon') {
                    if (typeof moonMesh3D !== 'undefined' && moonMesh3D) {
                        const mDir = moonMesh3D.position.clone().sub(refCam).normalize();
                        return refCam.clone().add(mDir.multiplyScalar(120.0));
                    }
                    return new THREE.Vector3(0, 0, 0);
                }
                if (s === 'sun') {
                    if (typeof sunGroup3D !== 'undefined' && sunGroup3D) {
                        const sDir = sunGroup3D.position.clone().sub(refCam).normalize();
                        return refCam.clone().add(sDir.multiplyScalar(120.0));
                    }
                    return refCam.clone().add(new THREE.Vector3(0, 0.7, 0.7).multiplyScalar(120.0));
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
                if (b === 'moon') {
                    if (typeof moonMesh3D !== 'undefined' && moonMesh3D) {
                        const mDir = moonMesh3D.position.clone().sub(refCam).normalize();
                        return refCam.clone().add(mDir.multiplyScalar(120.0));
                    }
                    return new THREE.Vector3(0, 0, 0);
                }
                if (b === 'sun') {
                    if (typeof sunGroup3D !== 'undefined' && sunGroup3D) {
                        const sDir = sunGroup3D.position.clone().sub(refCam).normalize();
                        return refCam.clone().add(sDir.multiplyScalar(120.0));
                    }
                    return refCam.clone().add(new THREE.Vector3(0, 0.7, 0.7).multiplyScalar(120.0));
                }
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

        async function startCinematicRoute(targetYearOrData) {
            let route = null;
            if (targetYearOrData && typeof targetYearOrData === 'object' && targetYearOrData.scenes) {
                route = targetYearOrData;
            } else if (targetYearOrData) {
                route = getRouteForEclipse(targetYearOrData);
            } else {
                const activeYear = (typeof currentEclipse !== 'undefined' && currentEclipse) ? currentEclipse.year : 2027;
                route = getRouteForEclipse(activeYear);
                if (!route) {
                    route = getRouteForEclipse(2027) || await loadRouteData('route_eclipse_2027.json');
                }
            }

            if (!route) {
                console.warn('[Director] No se encontraron datos de la ruta.');
                return;
            }

            currentRouteData = route;

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
            routeCameraSpline = buildRouteCameraSpline(route);
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

            // Ocultar rótulos y marcador geográfico durante la ruta
            if (typeof observerMarkerGroup3D !== 'undefined' && observerMarkerGroup3D) {
                observerMarkerGroup3D.visible = false;
                if (observerMarkerGroup3D._routeLabelSprite) observerMarkerGroup3D._routeLabelSprite.visible = false;
            }

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
            if (typeof camera !== 'undefined' && camera && camera.up) {
                camera.up.set(0, 1, 0);
            }
            if (typeof controls !== 'undefined' && controls) {
                controls.enabled = true;
            }
            const routeHud = (typeof getDOM === 'function' ? getDOM('route-cinematic-hud') : document.getElementById('route-cinematic-hud'));
            if (routeHud) routeHud.style.display = 'none';

            const routeBadgeEl = (typeof getDOM === 'function' ? getDOM('route-scene-badge') : document.getElementById('route-scene-badge'));
            if (routeBadgeEl) routeBadgeEl.style.display = 'none';

            if (typeof observerMarkerGroup3D !== 'undefined' && observerMarkerGroup3D) {
                if (observerMarkerGroup3D._routeLabelSprite) {
                    observerMarkerGroup3D._routeLabelSprite.visible = false;
                }
                const chkObs = (typeof getDOM === 'function' ? getDOM('chk-show-observer') : document.getElementById('chk-show-observer'));
                if (chkObs) {
                    observerMarkerGroup3D.visible = chkObs.checked;
                }
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

        function updateRouteButtonState(eclipse) {
            const btnRoute = (typeof getDOM === 'function' ? getDOM('btn-mode-route') : document.getElementById('btn-mode-route'));
            if (!btnRoute) return;
            const ec = eclipse || (typeof currentEclipse !== 'undefined' ? currentEclipse : null);
            const hasRoute = !!getRouteForEclipse(ec?.year);
            const route = hasRoute ? getRouteForEclipse(ec?.year) : null;

            if (hasRoute) {
                btnRoute.disabled = false;
                btnRoute.classList.remove('disabled');
                btnRoute.style.opacity = '';
                btnRoute.style.cursor = 'pointer';
                btnRoute.title = route?.title ? `Vuelo virtual cinemático: ${route.title}` : `Vuelo virtual cinemático: Eclipse ${ec?.year}`;

                // Si el usuario ya estaba en modo ruta y cambia de eclipse con ruta disponible, cambiar de vuelo
                if (typeof currentActiveView !== 'undefined' && currentActiveView === 'route' && isRouteActive) {
                    if (currentRouteData !== route) {
                        startCinematicRoute(route);
                    }
                }
            } else {
                btnRoute.disabled = true;
                btnRoute.classList.add('disabled');
                btnRoute.style.opacity = '0.4';
                btnRoute.style.cursor = 'not-allowed';
                btnRoute.title = `Ruta cinemática no disponible para el eclipse de ${ec?.year || '--'}`;

                // Si estaba en modo ruta y se selecciona un eclipse sin ruta disponible, regresar a la vista 3D orbital
                if (typeof currentActiveView !== 'undefined' && currentActiveView === 'route') {
                    if (typeof switchMainView === 'function') {
                        switchMainView('3d');
                    }
                }
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
            const route = getCurrentRoute();
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
            const route = getCurrentRoute();
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
            const route = getCurrentRoute();
            if (!route) return;
            if (t > 0) routeIntroTimer = 0;
            routeCurrentTime = Math.max(0, Math.min(route.totalDurationSec, t));
            updateCinematicRoute(0);
            if (typeof requestRender === 'function') requestRender();
        }

        var routeCameraSpline = null;

        function buildRouteCameraSpline(routeData) {
            if (!routeData || !routeData.scenes || routeData.scenes.length === 0) return null;
            const scenes = routeData.scenes;
            const keyframes = [];
            keyframes.push({
                time: scenes[0].timeStart,
                lat: scenes[0].camStart.lat,
                lng: scenes[0].camStart.lng,
                radius: scenes[0].camStart.radius
            });
            for (let i = 0; i < scenes.length; i++) {
                const sc = scenes[i];
                keyframes.push({
                    time: sc.timeStart + sc.duration,
                    lat: sc.camEnd.lat,
                    lng: sc.camEnd.lng,
                    radius: sc.camEnd.radius
                });
            }

            const deltasLat = [];
            const deltasLng = [];
            const deltasRad = [];
            for (let i = 0; i < keyframes.length - 1; i++) {
                const dt = (keyframes[i + 1].time - keyframes[i].time) || 1.0;
                deltasLat.push((keyframes[i + 1].lat - keyframes[i].lat) / dt);
                deltasLng.push((keyframes[i + 1].lng - keyframes[i].lng) / dt);
                deltasRad.push((keyframes[i + 1].radius - keyframes[i].radius) / dt);
            }

            const vels = [];
            for (let i = 0; i < keyframes.length; i++) {
                if (i === 0) {
                    vels.push({ dLat: deltasLat[0], dLng: deltasLng[0], dRad: deltasRad[0] });
                } else if (i === keyframes.length - 1) {
                    vels.push({
                        dLat: deltasLat[deltasLat.length - 1],
                        dLng: deltasLng[deltasLng.length - 1],
                        dRad: deltasRad[deltasRad.length - 1]
                    });
                } else {
                    const calcPchip = (d0, d1) => {
                        if (d0 * d1 <= 0) return 0.0;
                        return (2.0 * d0 * d1) / (d0 + d1);
                    };
                    const dtSpan = (keyframes[i + 1].time - keyframes[i - 1].time) || 1.0;
                    vels.push({
                        dLat: (keyframes[i + 1].lat - keyframes[i - 1].lat) / dtSpan,
                        dLng: (keyframes[i + 1].lng - keyframes[i - 1].lng) / dtSpan,
                        dRad: calcPchip(deltasRad[i - 1], deltasRad[i])
                    });
                }
            }

            return { keyframes, vels, _routeId: routeData.id || 'default' };
        }

        function getSplineCameraPosition(t, splineData) {
            if (!splineData || !splineData.keyframes) return null;
            const kfs = splineData.keyframes;
            const vels = splineData.vels;
            if (t <= kfs[0].time) return latLngToVector3(kfs[0].lat, kfs[0].lng, kfs[0].radius);
            if (t >= kfs[kfs.length - 1].time) return latLngToVector3(kfs[kfs.length - 1].lat, kfs[kfs.length - 1].lng, kfs[kfs.length - 1].radius);

            for (let i = 0; i < kfs.length - 1; i++) {
                const t0 = kfs[i].time;
                const t1 = kfs[i + 1].time;
                if (t >= t0 && t <= t1) {
                    const dt = t1 - t0;
                    const u = dt > 0 ? (t - t0) / dt : 0;
                    const u2 = u * u;
                    const u3 = u2 * u;

                    const h00 = 2 * u3 - 3 * u2 + 1;
                    const h10 = u3 - 2 * u2 + u;
                    const h01 = -2 * u3 + 3 * u2;
                    const h11 = u3 - u2;

                    const curLat = h00 * kfs[i].lat + h10 * dt * vels[i].dLat + h01 * kfs[i + 1].lat + h11 * dt * vels[i + 1].dLat;
                    const curLng = h00 * kfs[i].lng + h10 * dt * vels[i].dLng + h01 * kfs[i + 1].lng + h11 * dt * vels[i + 1].dLng;
                    const curRad = h00 * kfs[i].radius + h10 * dt * vels[i].dRad + h01 * kfs[i + 1].radius + h11 * dt * vels[i + 1].dRad;

                    const safeRadius = Math.max(51.5, curRad);
                    return latLngToVector3(curLat, curLng, safeRadius);
                }
            }
            const last = kfs[kfs.length - 1];
            return latLngToVector3(last.lat, last.lng, last.radius);
        }

        function updateCinematicRoute(delta) {
            if (!isRouteActive) return;

            const route = getCurrentRoute(); if (!route) return;

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

            const rawT = Math.min(1.0, Math.max(0.0, (routeCurrentTime - activeScene.timeStart) / (activeScene.duration || 1.0)));

            // 1. Sombra y tiempo astronómico del eclipse: velocidad simulada estrictamente constante a lo largo de toda la ruta
            const curEclipseT = activeScene.tEclipseStart + (activeScene.tEclipseEnd - activeScene.tEclipseStart) * rawT;
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

            // 3. Marcador geográfico y rótulo 3D (eliminados por el momento según solicitud del usuario)
            if (typeof observerMarkerGroup3D !== 'undefined' && observerMarkerGroup3D) {
                observerMarkerGroup3D.visible = false;
                if (observerMarkerGroup3D._routeLabelSprite) {
                    observerMarkerGroup3D._routeLabelSprite.visible = false;
                }
            }

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

            // 5. Posicionamiento dinámico de cámara continuo tipo Spline (vuelo ininterrumpido sin paradas ni frenadas en empalmes)
            if (!routeCameraSpline || routeCameraSpline._routeId !== (route.id || 'default')) {
                routeCameraSpline = buildRouteCameraSpline(route);
            }
            let targetCamPos = routeCameraSpline ? getSplineCameraPosition(routeCurrentTime, routeCameraSpline) : null;
            if (!targetCamPos && activeScene.camStart && activeScene.camEnd) {
                const curLat = activeScene.camStart.lat + (activeScene.camEnd.lat - activeScene.camStart.lat) * rawT;
                const curLng = activeScene.camStart.lng + (activeScene.camEnd.lng - activeScene.camStart.lng) * rawT;
                const curRad = activeScene.camStart.radius + (activeScene.camEnd.radius - activeScene.camStart.radius) * rawT;
                targetCamPos = latLngToVector3(curLat, curLng, curRad);
            }

            if (targetCamPos) {
                camera.position.copy(targetCamPos);
            }

            // Interpolación de mirada (LookAt) continua sin singularidades ni cruces por el cuerpo de cámara
            const tStart = getTargetVector(activeScene.targetStart, curEclipseT, targetCamPos);
            const tEnd = getTargetVector(activeScene.targetEnd, curEclipseT, targetCamPos);
            let curDir;

            if (activeScene.targetStart === activeScene.targetEnd || !targetCamPos) {
                const vStart = tStart.clone().sub(targetCamPos);
                curDir = vStart.lengthSq() > 0.0001 ? vStart.normalize() : new THREE.Vector3(0, 0, -1);
            } else {
                const vStart = tStart.clone().sub(targetCamPos);
                const vEnd = tEnd.clone().sub(targetCamPos);
                const dStart = vStart.length();
                const dEnd = vEnd.length();
                const dirStart = dStart > 0.0001 ? vStart.multiplyScalar(1 / dStart) : new THREE.Vector3(0, 0, -1);
                const dirEnd = dEnd > 0.0001 ? vEnd.multiplyScalar(1 / dEnd) : new THREE.Vector3(0, 0, -1);

                // Soporte para giro suave de mirada en transiciones (targetTurnStart / targetTurnEnd):
                const turnStart = (activeScene.targetTurnStart != null) ? activeScene.targetTurnStart : 0.0;
                const turnEnd = (activeScene.targetTurnEnd != null) ? activeScene.targetTurnEnd : 1.0;
                let lookEase = 0.5 * (1.0 - Math.cos(rawT * Math.PI));
                if (turnStart !== 0.0 || turnEnd !== 1.0) {
                    const clampedTurnEnd = Math.max(turnStart + 0.001, turnEnd);
                    const turnRaw = Math.min(1.0, Math.max(0.0, (rawT - turnStart) / (clampedTurnEnd - turnStart)));
                    lookEase = 0.5 * (1.0 - Math.cos(turnRaw * Math.PI));
                }

                // Interpolación angular esférica exacta (Fórmula de Rodrigues en SO(3)):
                // Sin singularidades, sin cambios bruscos de eje y con velocidad angular perfectamente uniforme
                const dot = Math.max(-1.0, Math.min(1.0, dirStart.dot(dirEnd)));
                const totalAngle = Math.acos(dot);

                if (totalAngle < 0.0001) {
                    curDir = dirStart.clone();
                } else {
                    const cross = new THREE.Vector3().crossVectors(dirStart, dirEnd);
                    const len = cross.length();
                    let rotAxis;
                    if (len > 0.0001) {
                        rotAxis = cross.multiplyScalar(1.0 / len);
                    } else {
                        rotAxis = new THREE.Vector3().crossVectors(targetCamPos, new THREE.Vector3(0, 1, 0)).normalize();
                        if (rotAxis.lengthSq() < 0.0001) rotAxis = new THREE.Vector3(1, 0, 0);
                    }
                    curDir = dirStart.clone().applyAxisAngle(rotAxis, totalAngle * lookEase);
                }
            }

            // Orientación del sensor: Horizonte terrestre nivelado (visión desde cabina de pilotaje) vs Norte cósmico
            const rCam = targetCamPos ? targetCamPos.clone().normalize() : new THREE.Vector3(0, 1, 0);
            const crossLevel = new THREE.Vector3().crossVectors(curDir, rCam);
            let yLevel;
            if (crossLevel.lengthSq() > 0.0001) {
                const xLevel = crossLevel.normalize();
                yLevel = new THREE.Vector3().crossVectors(xLevel, curDir).normalize();
            } else {
                yLevel = new THREE.Vector3(0, 1, 0);
            }

            // Vector UP del mundo (Norte cósmico) proyectado en el sensor
            const uWorld = new THREE.Vector3(0, 1, 0);
            const zCam = curDir.clone().negate();
            const crossWorld = new THREE.Vector3().crossVectors(uWorld, zCam);
            let yWorld;
            if (crossWorld.lengthSq() > 0.0001) {
                const xWorld = crossWorld.normalize();
                yWorld = new THREE.Vector3().crossVectors(zCam, xWorld).normalize();
            } else {
                yWorld = yLevel;
            }

            // Mezcla suave (0.0 = Norte cósmico en espacio profundo, 1.0 = Horizonte terrestre nivelado al 100%)
            const bStart = (activeScene.horizonBlendStart != null) ? activeScene.horizonBlendStart : 0.0;
            const bEnd = (activeScene.horizonBlendEnd != null) ? activeScene.horizonBlendEnd : bStart;
            const turnStart = (activeScene.horizonBlendTurnStart != null) ? activeScene.horizonBlendTurnStart : 0.0;

            let blendEase = 0.0;
            if (rawT >= turnStart) {
                const u = (turnStart < 1.0) ? (rawT - turnStart) / (1.0 - turnStart) : 1.0;
                blendEase = 0.5 * (1.0 - Math.cos(Math.min(1.0, Math.max(0.0, u)) * Math.PI));
            }
            const w = Math.min(1.0, Math.max(0.0, bStart + (bEnd - bStart) * blendEase));

            const curUp = new THREE.Vector3().lerpVectors(yWorld, yLevel, w).normalize();
            camera.up.copy(curUp);

            // El target visual se proyecta al frente a distancia fija (evita colisión o paso por el sensor)
            const curTarget = targetCamPos.clone().add(curDir.multiplyScalar(100.0));
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
    window.registerEclipseRoute = registerEclipseRoute;
    window.getRouteForEclipse = getRouteForEclipse;
    window.hasRouteForEclipse = hasRouteForEclipse;
    window.updateRouteButtonState = updateRouteButtonState;
    window.getCurrentRoute = getCurrentRoute;
    window.RouteDirector = {
        start: startCinematicRoute,
        stop: stopCinematicRoute,
        togglePlay: toggleRoutePlay,
        restart: restartCinematicRoute,
        jumpStep: jumpRouteSceneStep,
        setTime: setRouteTime,
        update: updateCinematicRoute,
        getShadowWorldPosition: getShadowWorldPosition,
        getTargetVector: getTargetVector,
        registerRoute: registerEclipseRoute,
        getRoute: getRouteForEclipse,
        hasRoute: hasRouteForEclipse,
        updateButtonState: updateRouteButtonState,
        getCurrentRoute: getCurrentRoute,
        get isActive() { return isRouteActive; },
        get isPlaying() { return isRoutePlaying; },
        get isIntro() { return routeIntroTimer > 0; }
    };
}
