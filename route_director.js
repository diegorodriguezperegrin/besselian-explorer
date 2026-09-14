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
var routeSpeedMultiplier = 1.0;
var ROUTE_SPEED_STEPS = [0.25, 0.5, 1.0, 2.0, 4.0];
var isRouteUserInteracting = false;
var routeResumeTransition = null;
var routeUserSpaceConesPref = true;

// Scratchpad pool estático preasignado para el bucle de vuelo a 60 FPS (Zero Garbage Collection Churn)
var _vAxisY = (typeof THREE !== 'undefined') ? new THREE.Vector3(0, 1, 0) : null;
var _vZero = (typeof THREE !== 'undefined') ? new THREE.Vector3(0, 0, 0) : null;
var _vDefaultFwd = (typeof THREE !== 'undefined') ? new THREE.Vector3(0, 0, -1) : null;
var _vCamPos = (typeof THREE !== 'undefined') ? new THREE.Vector3() : null;
var _rCam = (typeof THREE !== 'undefined') ? new THREE.Vector3() : null;
var _tStart = (typeof THREE !== 'undefined') ? new THREE.Vector3() : null;
var _tEnd = (typeof THREE !== 'undefined') ? new THREE.Vector3() : null;
var _vStart = (typeof THREE !== 'undefined') ? new THREE.Vector3() : null;
var _vEnd = (typeof THREE !== 'undefined') ? new THREE.Vector3() : null;
var _curDir = (typeof THREE !== 'undefined') ? new THREE.Vector3() : null;
var _rotAxis = (typeof THREE !== 'undefined') ? new THREE.Vector3() : null;
var _uFrom = (typeof THREE !== 'undefined') ? new THREE.Vector3() : null;
var _uTo = (typeof THREE !== 'undefined') ? new THREE.Vector3() : null;
var _uRot = (typeof THREE !== 'undefined') ? new THREE.Vector3() : null;
var _uCross = (typeof THREE !== 'undefined') ? new THREE.Vector3() : null;
var _vCamDir = (typeof THREE !== 'undefined') ? new THREE.Vector3() : null;
var _resumeFromPos = (typeof THREE !== 'undefined') ? new THREE.Vector3() : null;
var _resumeFromTarget = (typeof THREE !== 'undefined') ? new THREE.Vector3() : null;
var _zCam = (typeof THREE !== 'undefined') ? new THREE.Vector3() : null;
var _xWorld = (typeof THREE !== 'undefined') ? new THREE.Vector3() : null;
var _yWorld = (typeof THREE !== 'undefined') ? new THREE.Vector3() : null;
var _crossWorld = (typeof THREE !== 'undefined') ? new THREE.Vector3() : null;
var _crossLevel = (typeof THREE !== 'undefined') ? new THREE.Vector3() : null;
var _xLevel = (typeof THREE !== 'undefined') ? new THREE.Vector3() : null;
var _yPure = (typeof THREE !== 'undefined') ? new THREE.Vector3() : null;
var _yLevel = (typeof THREE !== 'undefined') ? new THREE.Vector3() : null;
var _camRight = (typeof THREE !== 'undefined') ? new THREE.Vector3() : null;
var _curUp = (typeof THREE !== 'undefined') ? new THREE.Vector3() : null;
var _curTarget = (typeof THREE !== 'undefined') ? new THREE.Vector3() : null;
var _resumeTarget = (typeof THREE !== 'undefined') ? new THREE.Vector3() : null;
var _lastTelemetryDomTime = 0;

function _ensureRouteScratchpadPool() {
    if (_vAxisY) return;
    if (typeof THREE === 'undefined') return;
    _vAxisY = new THREE.Vector3(0, 1, 0);
    _vZero = new THREE.Vector3(0, 0, 0);
    _vDefaultFwd = new THREE.Vector3(0, 0, -1);
    _vCamPos = new THREE.Vector3();
    _rCam = new THREE.Vector3();
    _tStart = new THREE.Vector3();
    _tEnd = new THREE.Vector3();
    _vStart = new THREE.Vector3();
    _vEnd = new THREE.Vector3();
    _curDir = new THREE.Vector3();
    _rotAxis = new THREE.Vector3();
    _uFrom = new THREE.Vector3();
    _uTo = new THREE.Vector3();
    _uRot = new THREE.Vector3();
    _uCross = new THREE.Vector3();
    _vCamDir = new THREE.Vector3();
    _resumeFromPos = new THREE.Vector3();
    _resumeFromTarget = new THREE.Vector3();
    _zCam = new THREE.Vector3();
    _xWorld = new THREE.Vector3();
    _yWorld = new THREE.Vector3();
    _crossWorld = new THREE.Vector3();
    _crossLevel = new THREE.Vector3();
    _xLevel = new THREE.Vector3();
    _yPure = new THREE.Vector3();
    _yLevel = new THREE.Vector3();
    _camRight = new THREE.Vector3();
    _curUp = new THREE.Vector3();
    _curTarget = new THREE.Vector3();
    _resumeTarget = new THREE.Vector3();
}

        // -------------------------------------------------------------
        // =========================================================================
        // MOTOR CINEMÁTICO: DIRECTOR MULTIRUTA
        // =========================================================================

        // Genera la clave unívoca canónica para un eclipse: YYYY_MM_DD
        function getEclipseRouteKey(eclipse) {
            if (!eclipse) return null;
            if (typeof eclipse === 'string') {
                return eclipse.replace(/-/g, '_');
            }
            if (typeof eclipse === 'number') {
                return String(eclipse);
            }
            const y = eclipse.year;
            if (y == null) return null;
            const m = String(eclipse.month || 1).padStart(2, '0');
            const d = String(eclipse.day || 1).padStart(2, '0');
            return `${y}_${m}_${d}`;
        }

        // Catálogo global de rutas cinematográficas indexadas por fecha canónica (YYYY_MM_DD) y cat_no
        window.ECLIPSE_ROUTES = window.ECLIPSE_ROUTES || {};

        function registerEclipseRoute(routeData) {
            if (!routeData) return;
            window.ECLIPSE_ROUTES = window.ECLIPSE_ROUTES || {};
            const key = getEclipseRouteKey(routeData);
            if (key) {
                window.ECLIPSE_ROUTES[key] = routeData;
            }
            if (routeData.id) {
                window.ECLIPSE_ROUTES[routeData.id] = routeData;
            }
            if (routeData.cat_no != null) {
                window.ECLIPSE_ROUTES[routeData.cat_no] = routeData;
            }
        }

        function getRouteForEclipse(eclipseOrKey) {
            if (!eclipseOrKey) return null;
            if (typeof eclipseOrKey === 'object') {
                const key = getEclipseRouteKey(eclipseOrKey);
                if (key && window.ECLIPSE_ROUTES && window.ECLIPSE_ROUTES[key]) {
                    return window.ECLIPSE_ROUTES[key];
                }
                if (eclipseOrKey.cat_no != null && window.ECLIPSE_ROUTES && window.ECLIPSE_ROUTES[eclipseOrKey.cat_no]) {
                    return window.ECLIPSE_ROUTES[eclipseOrKey.cat_no];
                }
                if (eclipseOrKey.id && window.ECLIPSE_ROUTES && window.ECLIPSE_ROUTES[eclipseOrKey.id]) {
                    return window.ECLIPSE_ROUTES[eclipseOrKey.id];
                }
                return null;
            }
            const strKey = String(eclipseOrKey).replace(/-/g, '_');
            if (window.ECLIPSE_ROUTES && window.ECLIPSE_ROUTES[strKey]) {
                return window.ECLIPSE_ROUTES[strKey];
            }
            if (window.ECLIPSE_ROUTES && window.ECLIPSE_ROUTES[eclipseOrKey]) {
                return window.ECLIPSE_ROUTES[eclipseOrKey];
            }
            return null;
        }

        function hasRouteForEclipse(eclipseOrKey) {
            return !!getRouteForEclipse(eclipseOrKey);
        }

        function getCurrentRoute() {
            if (currentRouteData) return currentRouteData;
            const ec = (typeof currentEclipse !== 'undefined') ? currentEclipse : null;
            return getRouteForEclipse(ec) || null;
        }

        // El Director lee los datos de la ruta desde el catálogo o archivo
        async function loadRouteData(target) {
            if (target) {
                const found = getRouteForEclipse(target);
                if (found) {
                    currentRouteData = found;
                    return currentRouteData;
                }
            }
            const ec = (typeof currentEclipse !== 'undefined') ? currentEclipse : null;
            const foundActive = getRouteForEclipse(ec);
            if (foundActive) {
                currentRouteData = foundActive;
                return currentRouteData;
            }
            if (typeof target === 'string' && target.includes('.')) {
                try {
                    const response = await fetch(target);
                    if (response.ok) {
                        currentRouteData = await response.json();
                        return currentRouteData;
                    }
                } catch (err) {}
            }
            return currentRouteData;
        }

        function getShadowWorldPosition(t, radius, targetVec = null) {
            _ensureRouteScratchpadPool();
            const out = targetVec || new THREE.Vector3();
            const eclipse = (typeof currentEclipse !== 'undefined' && currentEclipse) ? currentEclipse : ((typeof PRESET_ECLIPSES !== 'undefined') ? PRESET_ECLIPSES.find(e => e.year === 2027) : null);
            if (!eclipse) return out.set(0, 0, 0);
            const centerLL = (typeof besselianToLatLng === 'function') ? besselianToLatLng(eclipse, t) : null;
            if (!centerLL) return out.set(0, 0, 0);
            const r = (radius != null) ? radius : ((typeof EARTH_RADIUS !== 'undefined') ? EARTH_RADIUS * 1.002 : 50.1);
            const rotY = (typeof earthGroup !== 'undefined' && earthGroup && earthGroup.rotation) ? earthGroup.rotation.y : 0;
            const phi = (90 - centerLL.lat) * (Math.PI / 180);
            const theta = (centerLL.lng + 180) * (Math.PI / 180);
            out.set(
                -r * Math.sin(phi) * Math.cos(theta),
                r * Math.cos(phi),
                r * Math.sin(phi) * Math.sin(theta)
            );
            if (rotY !== 0) {
                out.applyAxisAngle(_vAxisY, rotY);
            }
            return out;
        }

        function getTargetVector(tg, curT = 0, cPos = null, targetVec = null) {
            _ensureRouteScratchpadPool();
            const out = targetVec || new THREE.Vector3();
            if (!tg) return out.set(0, 0, 0);
            if (tg instanceof THREE.Vector3) return out.copy(tg);
            const refCam = cPos || (typeof camera !== 'undefined' ? camera.position : _vZero);

            if (typeof tg === 'string') {
                const s = tg.toLowerCase();
                if (s === 'moon') {
                    if (typeof moonMesh3D !== 'undefined' && moonMesh3D) {
                        out.subVectors(moonMesh3D.position, refCam).normalize().multiplyScalar(120.0).add(refCam);
                        return out;
                    }
                    return out.set(0, 0, 0);
                }
                if (s === 'sun') {
                    if (typeof sunGroup3D !== 'undefined' && sunGroup3D) {
                        out.subVectors(sunGroup3D.position, refCam).normalize().multiplyScalar(120.0).add(refCam);
                        return out;
                    }
                    out.set(0, 84.0, 84.0).add(refCam);
                    return out;
                }
                if (s === 'shadow') {
                    return getShadowWorldPosition(curT, null, out);
                }
                if (s === 'earth') {
                    return out.set(0, 0, 0);
                }
            }
            if (tg.body) {
                const b = tg.body.toLowerCase();
                if (b === 'moon') {
                    if (typeof moonMesh3D !== 'undefined' && moonMesh3D) {
                        out.subVectors(moonMesh3D.position, refCam).normalize().multiplyScalar(120.0).add(refCam);
                        return out;
                    }
                    return out.set(0, 0, 0);
                }
                if (b === 'sun') {
                    if (typeof sunGroup3D !== 'undefined' && sunGroup3D) {
                        out.subVectors(sunGroup3D.position, refCam).normalize().multiplyScalar(120.0).add(refCam);
                        return out;
                    }
                    out.set(0, 84.0, 84.0).add(refCam);
                    return out;
                }
                if (b === 'shadow') return getShadowWorldPosition(curT, null, out);
                if (b === 'earth') return out.set(0, 0, 0);
            }
            if (tg.lat != null && tg.lng != null) {
                if (!tg.radius || tg.radius === 0) return out.set(0, 0, 0);
                const rotY = (typeof earthGroup !== 'undefined' && earthGroup && earthGroup.rotation && tg.rotateWithEarth !== false) ? earthGroup.rotation.y : 0;
                const phi = (90 - tg.lat) * (Math.PI / 180);
                const theta = (tg.lng + 180) * (Math.PI / 180);
                out.set(
                    -tg.radius * Math.sin(phi) * Math.cos(theta),
                    tg.radius * Math.cos(phi),
                    tg.radius * Math.sin(phi) * Math.sin(theta)
                );
                if (rotY !== 0) out.applyAxisAngle(_vAxisY, rotY);
                return out;
            }
            return out.set(tg.x || 0, tg.y || 0, tg.z || 0);
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

        async function startCinematicRoute(targetEclipseOrData) {
            let route = null;
            if (targetEclipseOrData && typeof targetEclipseOrData === 'object' && targetEclipseOrData.scenes) {
                route = targetEclipseOrData;
            } else if (targetEclipseOrData) {
                route = getRouteForEclipse(targetEclipseOrData);
            } else {
                const ec = (typeof currentEclipse !== 'undefined') ? currentEclipse : null;
                route = getRouteForEclipse(ec);
            }

            if (!route) {
                console.warn('[Director] No se encontraron datos de la ruta para el eclipse seleccionado.');
                return;
            }

            currentRouteData = route;

            // Sincronizar el eclipse seleccionado si no coincide con la ruta
            if (typeof selectEclipse === 'function' && typeof PRESET_ECLIPSES !== 'undefined') {
                const routeKey = getEclipseRouteKey(route);
                const currentKey = getEclipseRouteKey(currentEclipse);
                const matchCat = (route.cat_no != null && currentEclipse?.cat_no !== route.cat_no);
                if (matchCat || (routeKey && currentKey !== routeKey)) {
                    const ecTarget = PRESET_ECLIPSES.find(e => (route.cat_no != null && e.cat_no === route.cat_no) || getEclipseRouteKey(e) === routeKey);
                    if (ecTarget) {
                        selectEclipse(ecTarget, false);
                    }
                }
            }

            if (isPlaying) {
                toggleSimulation();
            }

            cameraTransition = null;
            focusedBody = null;

            isRouteActive = true;
            isRoutePlaying = false;
            isRouteUserInteracting = false;
            routeResumeTransition = null;
            routeCurrentTime = 0.0;
            routeIntroTimer = (route.introDuration != null) ? route.introDuration : 4.0;
            routeCameraSpline = buildRouteCameraSpline(route);
            if (typeof controls !== 'undefined' && controls) controls.enabled = false;

            // Guardar preferencia previa de conos volumétricos
            const chkCones = (typeof getDOM === 'function' ? getDOM('chk-show-space-cones') : document.getElementById('chk-show-space-cones'));
            window._savedRouteSpaceConesPref = chkCones ? chkCones.checked : true;
            routeUserSpaceConesPref = window._savedRouteSpaceConesPref;

            routeSpeedMultiplier = 1.0;

            const slider = (typeof getDOM === 'function' ? getDOM('time-slider') : document.getElementById('time-slider'));
            if (slider && typeof currentEclipse !== 'undefined' && currentEclipse) {
                slider.min = currentEclipse.tmin != null ? currentEclipse.tmin : -2.5;
                slider.max = currentEclipse.tmax != null ? currentEclipse.tmax : 2.5;
                slider.step = 'any';
                const initialT = (route.scenes && route.scenes[0] && route.scenes[0].tEclipseStart != null) ? route.scenes[0].tEclipseStart : ((currentEclipse.tmin != null) ? currentEclipse.tmin : -2.0);
                slider.value = initialT;
                simCurrentT = initialT;
                if (typeof positionDockMarkers === 'function') {
                    positionDockMarkers(currentEclipse);
                }
            }
            updateRouteSpeedUI();

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
            isRouteUserInteracting = false;
            routeResumeTransition = null;
            routeIntroTimer = 0.0;
            if (typeof camera !== 'undefined' && camera && camera.up) {
                camera.up.set(0, 1, 0);
            }
            if (typeof controls !== 'undefined' && controls) {
                controls.enabled = true;
                if (controls.target) controls.target.set(0, 0, 0);
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
                const lblCones = (typeof getDOM === 'function' ? getDOM('lbl-show-space-cones') : document.getElementById('lbl-show-space-cones'));
                if (chkCones) {
                    chkCones.checked = window._savedRouteSpaceConesPref;
                    chkCones.disabled = false;
                }
                if (lblCones) {
                    lblCones.style.opacity = '';
                    lblCones.style.cursor = '';
                    lblCones.title = '';
                }
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
            routeSpeedMultiplier = 1.0;
            if (typeof updateSpeedUI === 'function') {
                updateSpeedUI();
            }
            if (typeof updateRecenterBtnState === 'function') {
                updateRecenterBtnState();
            }
        }

        function setRouteSpaceConesUserPref(enabled) {
            routeUserSpaceConesPref = !!enabled;
            window._savedRouteSpaceConesPref = routeUserSpaceConesPref;
            if (isRouteActive) {
                updateCinematicRoute(0);
                if (typeof requestRender === 'function') requestRender();
            }
        }

        function updateRouteButtonState(eclipse) {
            const btnRoute = (typeof getDOM === 'function' ? getDOM('btn-mode-route') : document.getElementById('btn-mode-route'));
            if (!btnRoute) return;
            const ec = eclipse || (typeof currentEclipse !== 'undefined' ? currentEclipse : null);
            const hasRoute = !!getRouteForEclipse(ec);
            const route = hasRoute ? getRouteForEclipse(ec) : null;
            const dateStr = ec ? `${ec.day || ''}/${ec.month || ''}/${ec.year || ''}` : '--';

            if (hasRoute) {
                btnRoute.disabled = false;
                btnRoute.classList.remove('disabled');
                btnRoute.style.opacity = '';
                btnRoute.style.cursor = 'pointer';
                btnRoute.title = route?.title ? `Vuelo virtual cinemático: ${route.title}` : `Vuelo virtual cinemático: Eclipse ${dateStr}`;

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
                btnRoute.title = `Ruta cinemática no disponible para el eclipse del ${dateStr}`;

                // Si estaba en modo ruta y se selecciona un eclipse sin ruta disponible, regresar a la vista 3D orbital
                if (typeof currentActiveView !== 'undefined' && currentActiveView === 'route') {
                    if (typeof switchMainView === 'function') {
                        switchMainView('3d');
                    }
                }
            }
        }

        function getOrbitPivotFromCamera(camPos, dir) {
            if (!camPos || !dir) return new THREE.Vector3(0, 0, 0);
            const R = (typeof EARTH_RADIUS !== 'undefined') ? EARTH_RADIUS : 50.0;
            const b = camPos.dot(dir);
            const c = camPos.lengthSq() - R * R;
            const discr = b * b - c;
            if (discr >= 0) {
                const s = -b - Math.sqrt(discr);
                if (s > 0.5 && s < 250) {
                    return camPos.clone().addScaledVector(dir, s);
                }
            }
            const fallbackDist = Math.max(15, Math.min(80, camPos.length() * 0.5));
            return camPos.clone().addScaledVector(dir, fallbackDist);
        }

        function pauseRouteForUserInteraction() {
            if (!isRouteActive) return;
            if (routeIntroTimer > 0) {
                routeIntroTimer = 0;
            }
            isRoutePlaying = false;
            isRouteUserInteracting = true;
            routeResumeTransition = null;

            updateRoutePlayPauseIcon();
            updateRouteBadge(false);

            if (typeof controls !== 'undefined' && controls) {
                controls.enabled = true;
                if (typeof camera !== 'undefined' && camera) {
                    if (!_vCamDir) _ensureRouteScratchpadPool();
                    camera.getWorldDirection(_vCamDir);
                    const pivot = getOrbitPivotFromCamera(camera.position, _vCamDir);
                    controls.target.copy(pivot);
                }
            }
            if (typeof requestRender === 'function') requestRender();
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

            if (isRoutePlaying) {
                if (typeof controls !== 'undefined' && controls) {
                    controls.enabled = false;
                }
                // Si el usuario interactuó con la cámara durante la pausa, transición orbital esférica de retorno
                if (isRouteUserInteracting && typeof camera !== 'undefined' && camera) {
                    const route = getCurrentRoute();
                    let targetCamPos = routeCameraSpline ? getSplineCameraPosition(routeCurrentTime, routeCameraSpline) : null;
                    if (targetCamPos && camera.position.distanceTo(targetCamPos) > 0.2) {
                        if (!_resumeFromPos) _ensureRouteScratchpadPool();
                        _resumeFromPos.copy(camera.position);
                        _resumeFromTarget.copy((controls && controls.target) ? controls.target : _vZero);

                        // Duración adaptativa basada en la separación angular geocéntrica
                        let dynDuration = 700;
                        const rFrom = _resumeFromPos.length();
                        const rTarget = targetCamPos.length();
                        if (rFrom > 1e-4 && rTarget > 1e-4) {
                            _uFrom.copy(_resumeFromPos).divideScalar(rFrom);
                            _uTo.copy(targetCamPos).divideScalar(rTarget);
                            const dot = Math.max(-1.0, Math.min(1.0, _uFrom.dot(_uTo)));
                            const angle = Math.acos(dot);
                            dynDuration = Math.round(Math.max(700, Math.min(1800, 700 + angle * 350)));
                        }

                        routeResumeTransition = {
                            startTime: performance.now(),
                            duration: dynDuration,
                            fromPos: _resumeFromPos,
                            fromTarget: _resumeFromTarget
                        };
                    } else {
                        isRouteUserInteracting = false;
                        routeResumeTransition = null;
                    }
                }
            } else {
                if (typeof controls !== 'undefined' && controls) {
                    controls.enabled = true;
                    if (typeof camera !== 'undefined' && camera) {
                        if (!_vCamDir) _ensureRouteScratchpadPool();
                        camera.getWorldDirection(_vCamDir);
                        const pivot = getOrbitPivotFromCamera(camera.position, _vCamDir);
                        controls.target.copy(pivot);
                    }
                }
                isRouteUserInteracting = true;
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
            isRouteUserInteracting = false;
            routeResumeTransition = null;
            if (controls) controls.enabled = false;
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
            isRouteUserInteracting = false;
            routeResumeTransition = null;
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
            isRouteUserInteracting = false;
            routeResumeTransition = null;
            routeCurrentTime = Math.max(0, Math.min(route.totalDurationSec, t));
            updateCinematicRoute(0);
            if (typeof requestRender === 'function') requestRender();
        }

        function getRouteCurrentSimulationSpeed() {
            const route = getCurrentRoute();
            if (!route || !route.scenes || route.scenes.length === 0) return 132;
            let sc = route.scenes[0];
            for (let i = 0; i < route.scenes.length; i++) {
                const s = route.scenes[i];
                if (routeCurrentTime >= s.timeStart && routeCurrentTime < (s.timeStart + s.duration)) {
                    sc = s;
                    break;
                }
                if (routeCurrentTime >= (s.timeStart + s.duration)) {
                    sc = s;
                }
            }
            const dtHours = Math.abs(sc.tEclipseEnd - sc.tEclipseStart);
            const durSec = sc.duration || 1.0;
            return Math.round((dtHours * 3600 / durSec) * routeSpeedMultiplier);
        }

        function updateRouteSpeedUI() {
            if (!isRouteActive) return;
            const effectiveSpeed = getRouteCurrentSimulationSpeed();
            const badge = (typeof getDOM === 'function' ? getDOM('speed-indicator-badge') : document.getElementById('speed-indicator-badge'));
            if (badge) {
                badge.textContent = `${effectiveSpeed}x`;
            }
            const fastBtn = (typeof getDOM === 'function' ? getDOM('btn-fast-forward') : document.getElementById('btn-fast-forward'));
            const rewBtn = (typeof getDOM === 'function' ? getDOM('btn-rewind') : document.getElementById('btn-rewind'));
            const curIdx = ROUTE_SPEED_STEPS.indexOf(routeSpeedMultiplier);
            if (fastBtn) {
                fastBtn.title = `Aumentar velocidad de simulación (${effectiveSpeed}x)`;
                fastBtn.style.opacity = (curIdx === ROUTE_SPEED_STEPS.length - 1) ? '0.4' : '1';
            }
            if (rewBtn) {
                rewBtn.title = `Reducir velocidad de simulación (${effectiveSpeed}x)`;
                rewBtn.style.opacity = (curIdx === 0) ? '0.4' : '1';
            }
        }

        function changeRouteSpeedStep(dir) {
            if (!isRouteActive) return;
            const curIdx = ROUTE_SPEED_STEPS.indexOf(routeSpeedMultiplier);
            let nextIdx = 2; // 1.0x por defecto
            if (curIdx !== -1) {
                nextIdx = Math.max(0, Math.min(ROUTE_SPEED_STEPS.length - 1, curIdx + dir));
            } else {
                nextIdx = dir > 0 ? 3 : 1;
            }
            routeSpeedMultiplier = ROUTE_SPEED_STEPS[nextIdx];
            updateRouteSpeedUI();
            if (typeof requestRender === 'function') requestRender();
        }

        function setRouteTimeFromEclipseT(t) {
            const route = getCurrentRoute();
            if (!route || !route.scenes || route.scenes.length === 0) return;
            const spline = routeCameraSpline;
            if (spline && spline.timeSpline) {
                const nodes = spline.timeSpline.nodes;
                const n = nodes.length;
                const minT = nodes[0].T;
                const maxT = nodes[n - 1].T;
                const clampedT = Math.max(minT, Math.min(maxT, t));

                // Búsqueda del intervalo monótono con bisección rápida
                for (let i = 0; i < n - 1; i++) {
                    if (clampedT <= nodes[i + 1].T || i === n - 2) {
                        let lowTau = nodes[i].tau;
                        let highTau = nodes[i + 1].tau;
                        for (let step = 0; step < 6; step++) {
                            const midTau = 0.5 * (lowTau + highTau);
                            const midT = getSplineEclipseT(midTau, spline);
                            if (midT < clampedT) {
                                lowTau = midTau;
                            } else {
                                highTau = midTau;
                            }
                        }
                        setRouteTime(0.5 * (lowTau + highTau));
                        return;
                    }
                }
            }

            const scenes = route.scenes;
            const minT = scenes[0].tEclipseStart;
            const maxT = scenes[scenes.length - 1].tEclipseEnd;
            const clampedT = Math.max(minT, Math.min(maxT, t));

            for (let i = 0; i < scenes.length; i++) {
                const sc = scenes[i];
                if (clampedT <= sc.tEclipseEnd || i === scenes.length - 1) {
                    const dt = sc.tEclipseEnd - sc.tEclipseStart;
                    const frac = Math.abs(dt) > 0.00001 ? Math.max(0, Math.min(1, (clampedT - sc.tEclipseStart) / dt)) : 0;
                    const targetRouteTime = sc.timeStart + frac * sc.duration;
                    setRouteTime(targetRouteTime);
                    break;
                }
            }
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

            // Desenvolver longitudes para evitar giros espurios de 360° al cruzar el antimeridiano (+/-180°)
            for (let i = 1; i < keyframes.length; i++) {
                let diff = keyframes[i].lng - keyframes[i - 1].lng;
                while (diff > 180) {
                    keyframes[i].lng -= 360;
                    diff -= 360;
                }
                while (diff < -180) {
                    keyframes[i].lng += 360;
                    diff += 360;
                }
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

            // Spline temporal C1 monótono PCHIP para simCurrentT (elimina quiebros de velocidad en fronteras de escenas)
            const timeNodes = [];
            timeNodes.push({ tau: scenes[0].timeStart, T: scenes[0].tEclipseStart });
            for (let i = 0; i < scenes.length; i++) {
                const sc = scenes[i];
                timeNodes.push({ tau: sc.timeStart + sc.duration, T: sc.tEclipseEnd });
            }
            const nTime = timeNodes.length;
            const timeDeltas = [];
            for (let i = 0; i < nTime - 1; i++) {
                const dTau = (timeNodes[i + 1].tau - timeNodes[i].tau) || 1.0;
                timeDeltas.push((timeNodes[i + 1].T - timeNodes[i].T) / dTau);
            }
            const timeVels = new Array(nTime);
            timeVels[0] = timeDeltas[0];
            timeVels[nTime - 1] = timeDeltas[nTime - 2];
            for (let i = 1; i < nTime - 1; i++) {
                const d0 = timeDeltas[i - 1];
                const d1 = timeDeltas[i];
                if (d0 * d1 <= 0) {
                    timeVels[i] = 0.0;
                } else {
                    timeVels[i] = (2.0 * d0 * d1) / (d0 + d1);
                }
            }
            const timeSpline = { nodes: timeNodes, vels: timeVels };

            return { keyframes, vels, timeSpline, _routeId: routeData.id || 'default' };
        }

        function _setLatLngToVector3(targetVec, lat, lng, radius) {
            const latRad = lat * (Math.PI / 180);
            const lngRad = lng * (Math.PI / 180);
            const x =  radius * Math.cos(latRad) * Math.cos(lngRad);
            const y =  radius * Math.sin(latRad);
            const z = -radius * Math.cos(latRad) * Math.sin(lngRad);
            if (targetVec) {
                targetVec.set(x, y, z);
                return targetVec;
            }
            return (typeof THREE !== 'undefined') ? new THREE.Vector3(x, y, z) : { x, y, z };
        }

        function getSplineCameraPosition(t, splineData, targetVec = null) {
            if (!splineData || !splineData.keyframes) return null;
            const kfs = splineData.keyframes;
            const vels = splineData.vels;
            if (t <= kfs[0].time) return _setLatLngToVector3(targetVec, kfs[0].lat, kfs[0].lng, kfs[0].radius);
            if (t >= kfs[kfs.length - 1].time) return _setLatLngToVector3(targetVec, kfs[kfs.length - 1].lat, kfs[kfs.length - 1].lng, kfs[kfs.length - 1].radius);

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
                    return _setLatLngToVector3(targetVec, curLat, curLng, safeRadius);
                }
            }
            const last = kfs[kfs.length - 1];
            return _setLatLngToVector3(targetVec, last.lat, last.lng, last.radius);
        }

        function getSplineEclipseT(tau, splineData) {
            if (!splineData || !splineData.timeSpline) return null;
            const nodes = splineData.timeSpline.nodes;
            const vels = splineData.timeSpline.vels;
            const n = nodes.length;
            if (tau <= nodes[0].tau) return nodes[0].T;
            if (tau >= nodes[n - 1].tau) return nodes[n - 1].T;

            for (let i = 0; i < n - 1; i++) {
                const tau0 = nodes[i].tau;
                const tau1 = nodes[i + 1].tau;
                if (tau >= tau0 && tau <= tau1) {
                    const h = tau1 - tau0;
                    const u = h > 0 ? (tau - tau0) / h : 0;
                    const u2 = u * u;
                    const u3 = u2 * u;

                    const h00 = 2 * u3 - 3 * u2 + 1;
                    const h10 = u3 - 2 * u2 + u;
                    const h01 = -2 * u3 + 3 * u2;
                    const h11 = u3 - u2;

                    return h00 * nodes[i].T + h10 * h * vels[i] + h01 * nodes[i + 1].T + h11 * h * vels[i + 1];
                }
            }
            return nodes[n - 1].T;
        }

        function updateCinematicRoute(delta) {
            if (!isRouteActive) return;

            const route = getCurrentRoute(); if (!route) return;

            _ensureRouteScratchpadPool();

            // Manejo de la presentación inicial (4 segundos en pausa mostrando solo el título)
            if (routeIntroTimer > 0) {
                routeIntroTimer = Math.max(0, routeIntroTimer - delta);
                if (routeIntroTimer === 0) {
                    isRoutePlaying = true;
                    updateRoutePlayPauseIcon();
                    updateRouteBadge(true);
                }
            } else if (isRoutePlaying) {
                routeCurrentTime += delta * routeSpeedMultiplier;
            }

            if (routeCurrentTime >= route.totalDurationSec) {
                restartCinematicRoute();
                return;
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

            // 1. Sombra y tiempo astronómico del eclipse: interpolación C1 monótona PCHIP (elimina tirones)
            let curEclipseT = null;
            if (routeCameraSpline && routeCameraSpline.timeSpline) {
                curEclipseT = getSplineEclipseT(routeCurrentTime, routeCameraSpline);
            }
            if (curEclipseT === null) {
                curEclipseT = activeScene.tEclipseStart + (activeScene.tEclipseEnd - activeScene.tEclipseStart) * rawT;
            }
            simCurrentT = curEclipseT;
            if (typeof timeSlider !== 'undefined' && timeSlider && !(window.isSliderInteracting) && typeof currentActiveView !== 'undefined' && currentActiveView === 'route') {
                timeSlider.value = curEclipseT;
            }

            // 2. Capa de conos volumétricos por escena (controlada por el director respetando preferencia del usuario si la escena lo permite)
            const sceneAllows = (typeof activeScene.showSpaceCones === 'boolean') ? activeScene.showSpaceCones : true;
            const effectiveShow = sceneAllows && routeUserSpaceConesPref;

            const chkCones = (typeof getDOM === 'function' ? getDOM('chk-show-space-cones') : document.getElementById('chk-show-space-cones'));
            const lblCones = (typeof getDOM === 'function' ? getDOM('lbl-show-space-cones') : document.getElementById('lbl-show-space-cones'));
            if (chkCones) {
                if (chkCones.disabled !== !sceneAllows) chkCones.disabled = !sceneAllows;
                if (chkCones.checked !== effectiveShow) chkCones.checked = effectiveShow;
            }
            if (lblCones) {
                const targetOpacity = sceneAllows ? '1' : '0.45';
                if (lblCones.style.opacity !== targetOpacity) lblCones.style.opacity = targetOpacity;
                const targetCursor = sceneAllows ? 'pointer' : 'not-allowed';
                if (lblCones.style.cursor !== targetCursor) lblCones.style.cursor = targetCursor;
                const targetTitle = sceneAllows ? '' : 'Desactivado por el director durante este tramo de la ruta';
                if (lblCones.title !== targetTitle) lblCones.title = targetTitle;
            }
            if (typeof umbraConeMesh3D !== 'undefined' && umbraConeMesh3D && umbraConeMesh3D.visible !== effectiveShow) {
                umbraConeMesh3D.visible = effectiveShow;
            }
            if (typeof penumbraConeMesh3D !== 'undefined' && penumbraConeMesh3D && penumbraConeMesh3D.visible !== effectiveShow) {
                penumbraConeMesh3D.visible = effectiveShow;
            }

            if (typeof updateShadowAtTime === 'function') {
                updateShadowAtTime(curEclipseT);
            }
            updateRouteSpeedUI();

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
            let targetCamPos = routeCameraSpline ? getSplineCameraPosition(routeCurrentTime, routeCameraSpline, _vCamPos) : null;
            if (!targetCamPos && activeScene.camStart && activeScene.camEnd) {
                const curLat = activeScene.camStart.lat + (activeScene.camEnd.lat - activeScene.camStart.lat) * rawT;
                const curLng = activeScene.camStart.lng + (activeScene.camEnd.lng - activeScene.camStart.lng) * rawT;
                const curRad = activeScene.camStart.radius + (activeScene.camEnd.radius - activeScene.camStart.radius) * rawT;
                targetCamPos = _setLatLngToVector3(_vCamPos, curLat, curLng, curRad);
            }

            // 5b. Cenit local de la trayectoria de vuelo
            if (targetCamPos) {
                _rCam.copy(targetCamPos).normalize();
            } else {
                _rCam.copy(_vAxisY);
            }

            // Interpolación de mirada (LookAt) continua sin singularidades
            getTargetVector(activeScene.targetStart, curEclipseT, targetCamPos, _tStart);
            getTargetVector(activeScene.targetEnd, curEclipseT, targetCamPos, _tEnd);

            if (activeScene.targetStart === activeScene.targetEnd || !targetCamPos) {
                _vStart.subVectors(_tStart, targetCamPos);
                if (_vStart.lengthSq() > 0.0001) {
                    _curDir.copy(_vStart).normalize();
                } else {
                    _curDir.copy(_vDefaultFwd);
                }
            } else {
                _vStart.subVectors(_tStart, targetCamPos).normalize();
                _vEnd.subVectors(_tEnd, targetCamPos).normalize();

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
                // Sin singularidades, sin temblores ni giros inducidos en el eje óptico
                const dot = Math.max(-1.0, Math.min(1.0, _vStart.dot(_vEnd)));
                const totalAngle = Math.acos(dot);
                if (totalAngle < 0.0001) {
                    _curDir.copy(_vStart);
                } else {
                    _rotAxis.crossVectors(_vStart, _vEnd);
                    const len = _rotAxis.length();
                    if (len > 0.0001) {
                        _rotAxis.multiplyScalar(1.0 / len);
                    } else {
                        _rotAxis.crossVectors(_rCam, _vAxisY).normalize();
                        if (_rotAxis.lengthSq() < 0.0001) _rotAxis.set(1, 0, 0);
                    }
                    _curDir.copy(_vStart).applyAxisAngle(_rotAxis, totalAngle * lookEase);
                }
            }

            // Orientación del sensor: Horizonte terrestre nivelado vs Norte cósmico estabilizado
            _zCam.copy(_curDir).negate();
            _crossWorld.crossVectors(_vAxisY, _zCam);
            if (_crossWorld.lengthSq() > 0.0001) {
                _xWorld.copy(_crossWorld).normalize();
                _yWorld.crossVectors(_zCam, _xWorld).normalize();
            } else {
                _yWorld.copy(_rCam);
            }

            // yLevel: Horizonte terrestre nivelado (evita volteo de 180º en el cenit transicionando a yWorld cuando pitch > 75º)
            const sinPitch = Math.min(1.0, Math.max(-1.0, _curDir.dot(_rCam)));
            const cosPitchSq = Math.max(0, 1.0 - sinPitch * sinPitch);
            const cosPitch = Math.sqrt(cosPitchSq);
            const pitchDeg = Math.asin(sinPitch) * (180 / Math.PI);

            _crossLevel.crossVectors(_curDir, _rCam);
            if (cosPitch > 0.25 && _crossLevel.lengthSq() > 0.0001) {
                _xLevel.copy(_crossLevel).normalize();
                _yPure.crossVectors(_xLevel, _curDir).normalize();
                if (cosPitch < 0.45) {
                    const blendZenith = (cosPitch - 0.25) / 0.20;
                    _yLevel.lerpVectors(_yWorld, _yPure, blendZenith).normalize();
                } else {
                    _yLevel.copy(_yPure);
                }
            } else {
                _yLevel.copy(_yWorld);
            }

            // Mezcla suave según la escena (w = 1.0 en vuelo rasante, w = 0.0 en el espacio profundo)
            const bStart = (activeScene.horizonBlendStart != null) ? activeScene.horizonBlendStart : 0.0;
            const bEnd = (activeScene.horizonBlendEnd != null) ? activeScene.horizonBlendEnd : bStart;
            const turnStart = (activeScene.horizonBlendTurnStart != null) ? activeScene.horizonBlendTurnStart : 0.0;

            let blendEase = 0.0;
            if (rawT >= turnStart) {
                const u = (turnStart < 1.0) ? (rawT - turnStart) / (1.0 - turnStart) : 1.0;
                blendEase = 0.5 * (1.0 - Math.cos(Math.min(1.0, Math.max(0.0, u)) * Math.PI));
            }
            const w = Math.min(1.0, Math.max(0.0, bStart + (bEnd - bStart) * blendEase));

            _curUp.lerpVectors(_yWorld, _yLevel, w).normalize();

            // Ortogonalización estricta del triedro de cámara
            _camRight.crossVectors(_curDir, _curUp).normalize();
            _curUp.crossVectors(_camRight, _curDir).normalize();

            // Throttling DOM updates a 15 Hz (~66ms) para la barra de progreso
            const nowPerf = performance.now();
            const isScrubbingOrJump = (delta === 0);
            if (isScrubbingOrJump || (nowPerf - _lastTelemetryDomTime > 66)) {
                _lastTelemetryDomTime = nowPerf;
                const progressRatio = Math.min(1.0, Math.max(0.0, routeCurrentTime / route.totalDurationSec));
                const progressBar = (typeof getDOM === 'function' ? getDOM('route-progress-bar') : document.getElementById('route-progress-bar'));
                if (progressBar) {
                    progressBar.style.width = (progressRatio * 100).toFixed(1) + '%';
                }
            }

            // El target visual se proyecta al frente a distancia fija (evita colisión o paso por el sensor)
            if (targetCamPos) {
                _curTarget.copy(targetCamPos).addScaledVector(_curDir, 100.0);
            } else {
                _curTarget.set(0, 0, 0);
            }

            if (routeResumeTransition) {
                const now = performance.now();
                const elapsed = now - routeResumeTransition.startTime;
                const p = Math.min(1.0, elapsed / routeResumeTransition.duration);
                // Ease in-out cubic
                const ease = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;

                if (targetCamPos) {
                    // Reanudación esférica orbital geocéntrica (evita atravesar el núcleo/manto de la Tierra)
                    const rFrom = routeResumeTransition.fromPos.length();
                    const rTarget = targetCamPos.length();
                    if (rFrom < 1e-4 || rTarget < 1e-4) {
                        camera.position.lerpVectors(routeResumeTransition.fromPos, targetCamPos, ease);
                    } else {
                        _uFrom.copy(routeResumeTransition.fromPos).divideScalar(rFrom);
                        _uTo.copy(targetCamPos).divideScalar(rTarget);
                        const dot = Math.max(-1.0, Math.min(1.0, _uFrom.dot(_uTo)));
                        const angle = Math.acos(dot);
                        if (angle < 1e-3) {
                            camera.position.lerpVectors(routeResumeTransition.fromPos, targetCamPos, ease);
                        } else {
                            _rotAxis.crossVectors(_uFrom, _uTo);
                            const axisLen = _rotAxis.length();
                            if (axisLen < 1e-4) {
                                if (Math.abs(_uFrom.y) < 0.9) {
                                    _rotAxis.set(0, 1, 0).cross(_uFrom).normalize();
                                } else {
                                    _rotAxis.set(1, 0, 0).cross(_uFrom).normalize();
                                }
                            } else {
                                _rotAxis.divideScalar(axisLen);
                            }
                            const currentAngle = angle * ease;
                            const cosTheta = Math.cos(currentAngle);
                            const sinTheta = Math.sin(currentAngle);
                            _uRot.copy(_uFrom).multiplyScalar(cosTheta);
                            _uCross.crossVectors(_rotAxis, _uFrom).multiplyScalar(sinTheta);
                            _uRot.add(_uCross);
                            const rInterp = rFrom + (rTarget - rFrom) * ease;
                            const balloon = Math.sin(ease * Math.PI) * (angle * 3.5);
                            const rSafe = Math.max(51.5, rInterp + balloon);
                            camera.position.copy(_uRot).multiplyScalar(rSafe);
                        }
                    }
                }
                camera.up.copy(_curUp);
                _resumeTarget.lerpVectors(routeResumeTransition.fromTarget, _curTarget, ease);
                camera.lookAt(_resumeTarget);
                if (typeof controls !== 'undefined' && controls && controls.target) controls.target.copy(_resumeTarget);

                if (p >= 1.0) {
                    routeResumeTransition = null;
                    isRouteUserInteracting = false;
                }
            } else if (isRoutePlaying || !isRouteUserInteracting) {
                if (targetCamPos) {
                    camera.position.copy(targetCamPos);
                }
                camera.up.copy(_curUp);
                if (typeof controls !== 'undefined' && controls && controls.target) {
                    controls.target.copy(_curTarget);
                }
                camera.lookAt(_curTarget);
            }

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
    window.routeSpeedMultiplier = routeSpeedMultiplier;
    window.changeRouteSpeedStep = changeRouteSpeedStep;
    window.updateRouteSpeedUI = updateRouteSpeedUI;
    window.setRouteTimeFromEclipseT = setRouteTimeFromEclipseT;
    window.registerEclipseRoute = registerEclipseRoute;
    window.getEclipseRouteKey = getEclipseRouteKey;
    window.getRouteForEclipse = getRouteForEclipse;
    window.hasRouteForEclipse = hasRouteForEclipse;
    window.updateRouteButtonState = updateRouteButtonState;
    window.getCurrentRoute = getCurrentRoute;
    window.pauseRouteForUserInteraction = pauseRouteForUserInteraction;
    window.isRouteUserInteracting = isRouteUserInteracting;
    window.setRouteSpaceConesUserPref = setRouteSpaceConesUserPref;
    window.RouteDirector = {
        start: startCinematicRoute,
        stop: stopCinematicRoute,
        togglePlay: toggleRoutePlay,
        pauseForInteraction: pauseRouteForUserInteraction,
        restart: restartCinematicRoute,
        jumpStep: jumpRouteSceneStep,
        setTime: setRouteTime,
        setTimeFromEclipseT: setRouteTimeFromEclipseT,
        changeSpeedStep: changeRouteSpeedStep,
        updateSpeedUI: updateRouteSpeedUI,
        setSpaceConesPref: setRouteSpaceConesUserPref,
        update: updateCinematicRoute,
        getShadowWorldPosition: getShadowWorldPosition,
        getTargetVector: getTargetVector,
        registerRoute: registerEclipseRoute,
        getRouteKey: getEclipseRouteKey,
        getRoute: getRouteForEclipse,
        hasRoute: hasRouteForEclipse,
        updateButtonState: updateRouteButtonState,
        getCurrentRoute: getCurrentRoute,
        get isActive() { return isRouteActive; },
        get isPlaying() { return isRoutePlaying; },
        get isIntro() { return routeIntroTimer > 0; },
        get isUserInteracting() { return isRouteUserInteracting; },
        get speedMultiplier() { return routeSpeedMultiplier; }
    };
}
