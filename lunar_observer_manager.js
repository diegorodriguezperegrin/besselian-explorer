/* =========================================================================
   COSMOS MATARÓ - GESTIÓN DE OBSERVADOR Y SELECCIÓN GEOGRÁFICA (lunar_observer_manager.js)
   Catálogo de ubicaciones, autocompletado, geolocalización por satélite,
   cálculo de husos horarios / UTC offset y selección interactiva sobre el globo.
   ========================================================================= */

function _getDOM(id) {
    return (typeof getDOM === 'function') ? getDOM(id) : document.getElementById(id);
}

        function formatCoordDms(val, isLat) {
            if (val == null || isNaN(val)) return '--';
            const dir = isLat ? (val >= 0 ? 'N' : 'S') : (val >= 0 ? 'E' : 'O');
            const abs = Math.abs(val);
            const deg = Math.floor(abs);
            const minFloat = (abs - deg) * 60;
            const min = Math.floor(minFloat);
            const sec = Math.round((minFloat - min) * 60);
            return `${deg}° ${String(min).padStart(2, '0')}' ${String(sec).padStart(2, '0')}" ${dir}`;
        }

        function formatLatLonString(lat, lon, precision = 4) {
            const latDir = lat >= 0 ? 'N' : 'S';
            const lonDir = lon >= 0 ? 'E' : 'O';
            return `${Math.abs(lat).toFixed(precision)}° ${latDir} · ${Math.abs(lon).toFixed(precision)}° ${lonDir}`;
        }



        // 3. Circunstancias Locales del Observador
        var _intlOffsetFormatters = (typeof window !== 'undefined' && window._intlOffsetFormatters) ? window._intlOffsetFormatters : new Map();

        function getUtcOffsetString(tz, dateObj = new Date()) {
            if (!tz || tz === 'UTC') return 'UTC';
            if (!dateObj || !(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
                dateObj = new Date();
            }
            try {
                let fmt = _intlOffsetFormatters.get(tz);
                if (!fmt) {
                    fmt = new Intl.DateTimeFormat('en-US', {
                        timeZone: tz,
                        timeZoneName: 'shortOffset'
                    });
                    _intlOffsetFormatters.set(tz, fmt);
                }
                const parts = fmt.formatToParts(dateObj);
                const tzPart = parts.find(p => p.type === 'timeZoneName');
                if (tzPart && tzPart.value) {
                    let v = tzPart.value.replace(/^GMT/, 'UTC');
                    if (v === 'UTC+0' || v === 'UTC-0' || v === 'UTC+00:00' || v === 'UTC' || v === 'UTC+00' || v === 'UTC-00') return 'UTC';
                    return v;
                }
            } catch(e) {}
            try {
                const utcDate = new Date(dateObj.toLocaleString('en-US', { timeZone: 'UTC' }));
                const tzDate = new Date(dateObj.toLocaleString('en-US', { timeZone: tz }));
                const diffMin = Math.round((tzDate.getTime() - utcDate.getTime()) / 60000);
                if (isNaN(diffMin) || diffMin === 0) return 'UTC';
                const sign = diffMin >= 0 ? '+' : '-';
                const absMin = Math.abs(diffMin);
                const h = Math.floor(absMin / 60);
                const m = absMin % 60;
                if (isNaN(h) || isNaN(m) || (h === 0 && m === 0)) return 'UTC';
                return m === 0 ? ('UTC' + sign + h) : ('UTC' + sign + h + ':' + String(m).padStart(2, '0'));
            } catch(e) {
                return 'UTC';
            }
        }

        function updateObserverHeaderTz() {
            const tzEl = document.getElementById('observer-header-tz');
            if (!tzEl) return;
            const sampleDate = currentEclipse && currentEclipse.maxMs
                ? new Date(currentEclipse.maxMs)
                : new Date();
            const tzStr = getUtcOffsetString(currentObserver.tz || "Europe/Madrid", sampleDate);
            tzEl.textContent = tzStr;
        }

        function getTzAbbr(date, tz) {
            return getUtcOffsetString(tz, date);
        }

        let activeDropdownIndex = -1;

        function populateObserverSelect() {
            filterObserverDropdown('', false);
        }

        function openObserverDropdown() {
            const input = document.getElementById('observer-location-input');
            filterObserverDropdown(input ? input.value : '', true);
            const menu = document.getElementById('observer-dropdown-menu');
            if (menu) menu.style.display = 'block';
        }

        function closeObserverDropdown() {
            const menu = document.getElementById('observer-dropdown-menu');
            if (menu) menu.style.display = 'none';
            activeDropdownIndex = -1;
        }

        function filterObserverDropdown(query = '', showMenu = true) {
            const menu = document.getElementById('observer-dropdown-menu');
            if (!menu) return;
            menu.innerHTML = '';
            menu.style.display = showMenu ? 'block' : 'none';

            const cleanQuery = (query || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

            // Filtrado sucesivo: al teclear cada letra ('P', 'Pa', 'Par'...) filtra solo las que comiencen por ese prefijo
            let matches = OBSERVER_PRESETS.filter(p => {
                if (!cleanQuery) return true;
                const cleanName = p.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                return cleanName.startsWith(cleanQuery);
            });

            if (matches.length === 0 && cleanQuery) {
                // Fallback secundario si no coincide por inicio
                matches = OBSERVER_PRESETS.filter(p => {
                    const cleanName = p.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                    return cleanName.includes(cleanQuery);
                });
            }

            if (matches.length === 0) {
                const noResult = document.createElement('div');
                noResult.style.padding = '8px 12px';
                noResult.style.fontSize = '0.78rem';
                noResult.style.color = '#94a3b8';
                noResult.textContent = 'Sin coincidencias. Pulsa ⚙️ para fijar Lat/Lon.';
                menu.appendChild(noResult);
                return;
            }

            let lastCat = null;
            matches.forEach((preset, idx) => {
                if (!cleanQuery && preset.category && preset.category !== lastCat) {
                    lastCat = preset.category;
                    const catHeader = document.createElement('div');
                    catHeader.style.padding = (idx > 0 ? '6px' : '2px') + ' 10px 2px 10px';
                    catHeader.style.fontSize = '0.68rem';
                    catHeader.style.fontWeight = '700';
                    catHeader.style.textTransform = 'uppercase';
                    catHeader.style.letterSpacing = '0.07em';
                    catHeader.style.color = '#38bdf8';
                    catHeader.style.borderBottom = '1px solid rgba(56, 189, 248, 0.20)';
                    catHeader.style.marginBottom = '2px';
                    catHeader.textContent = preset.category;
                    menu.appendChild(catHeader);
                }
                const item = document.createElement('div');
                item.className = 'dropdown-option-item';
                item.style.padding = '1px 10px';
                item.style.fontFamily = 'var(--font-mono)';
                item.style.fontSize = '0.78rem';
                item.style.lineHeight = '20px';
                item.style.height = '21px';
                item.style.minHeight = '21px';
                item.style.color = (preset.name === currentObserver.name) ? 'var(--accent-blue)' : '#f8fafc';
                item.style.fontWeight = (preset.name === currentObserver.name) ? '600' : '400';
                item.style.cursor = 'pointer';
                item.style.borderRadius = '6px';
                item.style.transition = 'background 0.15s';
                item.style.display = 'flex';
                item.style.alignItems = 'center';
                item.style.justifyContent = 'space-between';

                let displayHtml = preset.name;
                const cleanName = preset.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                if (cleanQuery && cleanName.startsWith(cleanQuery)) {
                    const matchLen = cleanQuery.length;
                    displayHtml = `<strong style="color: var(--accent-blue);">${preset.name.slice(0, matchLen)}</strong>${preset.name.slice(matchLen)}`;
                }

                item.innerHTML = `<span>${displayHtml}</span><span style="font-size: 0.70rem; color: #64748b; margin-left: 8px;">${formatLatLonString(preset.lat, preset.lon, 1)}</span>`;

                item.onmouseenter = () => { item.style.background = 'rgba(56, 189, 248, 0.18)'; };
                item.onmouseleave = () => { if (idx !== activeDropdownIndex) item.style.background = 'transparent'; };

                item.onclick = (e) => {
                    e.stopPropagation();
                    selectObserverPreset(preset);
                };

                menu.appendChild(item);
            });
        }

        function selectObserverPreset(preset) {
            const input = document.getElementById('observer-location-input');
            if (input) input.value = preset.name;
            const customBox = document.getElementById('observer-custom-coords');
            if (customBox) customBox.style.display = 'none';
            const toggleBtn = document.getElementById('btn-toggle-custom-coords');
            if (toggleBtn) {
                toggleBtn.classList.remove('active');
            }
            updateObserverPosition(preset.lat, preset.lon, preset.name, preset.tz);
            closeObserverDropdown();
            triggerLocationConfirmationPulse();
        }

        function onObserverInputKeyDown(e) {
            const menu = document.getElementById('observer-dropdown-menu');
            if (!menu || menu.style.display === 'none') {
                if (e.key === 'ArrowDown' || e.key === 'Enter') {
                    openObserverDropdown();
                    e.preventDefault();
                }
                return;
            }

            const items = menu.querySelectorAll('.dropdown-option-item');
            if (items.length === 0) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                activeDropdownIndex = (activeDropdownIndex + 1) % items.length;
                updateDropdownHighlight(items);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                activeDropdownIndex = (activeDropdownIndex - 1 + items.length) % items.length;
                updateDropdownHighlight(items);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (activeDropdownIndex >= 0 && activeDropdownIndex < items.length) {
                    items[activeDropdownIndex].click();
                } else if (items.length > 0) {
                    items[0].click();
                }
            } else if (e.key === 'Escape') {
                closeObserverDropdown();
            }
        }

        function updateDropdownHighlight(items) {
            items.forEach((it, idx) => {
                if (idx === activeDropdownIndex) {
                    it.style.background = 'rgba(56, 189, 248, 0.25)';
                    it.scrollIntoView({ block: 'nearest' });
                } else {
                    it.style.background = 'transparent';
                }
            });
        }

        document.addEventListener('click', (e) => {
            const container = document.getElementById('observer-combobox-container');
            if (container && !container.contains(e.target)) {
                closeObserverDropdown();
            }
        });

        function toggleCustomCoords(forceShow = null) {
            const customBox = document.getElementById('observer-custom-coords');
            if (!customBox) return;
            const isVisible = customBox.style.display === 'flex';
            const show = forceShow !== null ? forceShow : !isVisible;
            customBox.style.display = show ? 'flex' : 'none';
            const toggleBtn = document.getElementById('btn-toggle-custom-coords');
            if (toggleBtn) {
                toggleBtn.classList.toggle('active', show);
            }
            if (show) {
                const latIn = document.getElementById('custom-obs-lat');
                const lonIn = document.getElementById('custom-obs-lon');
                if (latIn) latIn.value = currentObserver.lat;
                if (lonIn) lonIn.value = currentObserver.lon;
            }
        }

        function onCustomCoordsChange() {
            const latIn = document.getElementById('custom-obs-lat');
            const lonIn = document.getElementById('custom-obs-lon');
            let lat = latIn ? parseFloat(latIn.value) : 0;
            let lon = lonIn ? parseFloat(lonIn.value) : 0;
            if (isNaN(lat)) lat = 0;
            if (isNaN(lon)) lon = 0;
            lat = Math.max(-90, Math.min(90, lat));
            lon = Math.max(-180, Math.min(180, lon));
            
            const coordsStr = formatLatLonString(lat, lon, 2);
            const input = document.getElementById('observer-location-input');
            if (input) input.value = coordsStr;
            updateObserverPosition(lat, lon, coordsStr, null);
        }

        function detectUserLocation() {
            if (!navigator.geolocation) {
                alert("La geolocalización no está soportada por su navegador.");
                return;
            }
            const gpsBtns = document.querySelectorAll('.btn-observer-gps');
            gpsBtns.forEach(b => b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>');

            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const lat = parseFloat(pos.coords.latitude.toFixed(4));
                    const lon = parseFloat(pos.coords.longitude.toFixed(4));
                    let userTz = 'UTC';
                    try {
                        userTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
                    } catch(e) {}

                    const coordsStr = `GPS (${formatLatLonString(lat, lon, 2)})`;
                    const input = document.getElementById('observer-location-input');
                    if (input) input.value = coordsStr;
                    const spaceInput = document.getElementById('space-3d-search-input');
                    if (spaceInput) spaceInput.value = coordsStr;
                    const latIn = document.getElementById('custom-obs-lat');
                    const lonIn = document.getElementById('custom-obs-lon');
                    if (latIn) latIn.value = lat;
                    if (lonIn) lonIn.value = lon;

                    updateObserverPosition(lat, lon, coordsStr, userTz);
                    if (typeof recenterEarth === 'function') {
                        recenterEarth(lat, lon);
                    }
                    collapseLocationSearch();
                    triggerLocationConfirmationPulse();

                    gpsBtns.forEach(b => b.innerHTML = '<i class="fa-solid fa-crosshairs" style="color: #4ade80;"></i>');
                    setTimeout(() => {
                        gpsBtns.forEach(b => b.innerHTML = '<i class="fa-solid fa-crosshairs"></i>');
                    }, 2000);
                },
                (err) => {
                    gpsBtns.forEach(b => b.innerHTML = '<i class="fa-solid fa-crosshairs"></i>');
                    alert(`No se pudo obtener la ubicación GPS: ${err.message || 'Permiso denegado'}`);
                },
                { timeout: 10000, maximumAge: 60000 }
            );
        }

        function updateObserverPosition(lat, lon, name, tz) {
            currentObserver.lat = lat;
            currentObserver.lon = lon;
            if (name) currentObserver.name = name;
            currentObserver.tz = tz;

            if (observerMarkerGroup3D) {
                observerMarkerGroup3D.position.copy(latLngToVector3(lat, lon, EARTH_RADIUS * 1.004));
                observerMarkerGroup3D.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), latLngToVector3(lat, lon, 1.0).normalize());
            }

            // Sincronizar inputs numéricos de coordenadas
            const latIn = document.getElementById('custom-obs-lat');
            const lonIn = document.getElementById('custom-obs-lon');
            if (latIn && document.activeElement !== latIn) latIn.value = lat;
            if (lonIn && document.activeElement !== lonIn) lonIn.value = lon;

            const locInput = document.getElementById('observer-location-input');
            if (locInput && document.activeElement !== locInput) {
                locInput.value = currentObserver.name;
            }

            // Actualizar etiquetas en la interfaz
            const subtitleEl = document.getElementById('observer-header-subtitle');
            if (subtitleEl) {
                subtitleEl.textContent = `${formatCoordDms(lat, true)}  ${formatCoordDms(lon, false)}`;
            }

            const sideLocName = document.getElementById('side-panel-location-name');
            if (sideLocName) {
                sideLocName.textContent = currentObserver.name || 'Ubicación activa';
                sideLocName.title = currentObserver.name || '';
                sideLocName.style.display = 'block';
            }
            updatePillLabel(currentObserver.name);

            const obsChkLbl = document.querySelector('#lbl-show-observer span');
            if (obsChkLbl) {
                obsChkLbl.textContent = 'Observador';
            }

            const telePill = document.getElementById('tele-pill-location');
            if (telePill) {
                telePill.innerHTML = `<i class="fa-solid fa-location-dot" style="color: #38bdf8;"></i> <span>${currentObserver.name}</span>`;
            }

            const timeLocalLabel = document.getElementById('player-time-local-label');
            if (timeLocalLabel) {
                timeLocalLabel.textContent = 'Obs.:';
            }

            updateObserverHeaderTz();
            if (currentEclipse) {
                renderLocalLunarCircumstances();
            }
            updateTimeUI();
            if (currentActiveView === 'telescopic') renderTelescopicView();
            scene3DNeedsRender = true;
        }

        /**
         * Dispara la animación de confirmación de ubicación (idéntica a SEE):
         * - Muestra estado "Ubicación fijada" con verde esmeralda y destello en el botón de confirmación si existe.
         * - Genera un pulso verde (location-target-pulse) en la tarjeta de Visibilidad Local (o en el botón de reapertura si está colapsado).
         * - Genera un pulso suave en la píldora flotante superior de búsqueda.
         * - Hace rebotar el marcador del observador 3D (pin bounce).
         */
        function triggerLocationConfirmationPulse(btn = null) {
            // 1. Efecto en el botón (si fue accionado directamente o pasado como parámetro)
            if (btn && document.body.contains(btn)) {
                btn.style.pointerEvents = 'none';
                btn.innerHTML = '<i class="fa-solid fa-check"></i> Ubicación fijada';
                btn.style.background = 'rgba(34, 197, 94, 0.25)';
                btn.style.borderColor = '#22c55e';
                btn.style.color = '#22c55e';
                btn.style.boxShadow = '0 0 14px rgba(34, 197, 94, 0.5)';
            }

            // 2. Destello verde en la tarjeta de Visibilidad Local o botón de reapertura
            const setPanel = document.getElementById('settings-panel');
            const isPanelCollapsed = !setPanel || setPanel.classList.contains('collapsed');

            let targetEl = null;
            if (isPanelCollapsed) {
                targetEl = document.getElementById('btn-reopen-right');
            } else {
                targetEl = document.querySelector('#settings-panel .observer-card') ||
                           document.getElementById('observer-contacts-table') ||
                           setPanel;
            }

            if (targetEl) {
                targetEl.classList.remove('location-target-pulse');
                void targetEl.offsetWidth; // Forzar reflujo para reiniciar la animación
                targetEl.classList.add('location-target-pulse');
                setTimeout(() => {
                    if (targetEl && targetEl.classList) {
                        targetEl.classList.remove('location-target-pulse');
                    }
                }, 1200);
            }

            // 3. Destello sutil en el botón / píldora de búsqueda flotante
            const pillToggle = document.getElementById('search-pill-toggle');
            if (pillToggle) {
                pillToggle.classList.remove('location-target-pulse');
                void pillToggle.offsetWidth;
                pillToggle.classList.add('location-target-pulse');
                setTimeout(() => {
                    if (pillToggle && pillToggle.classList) {
                        pillToggle.classList.remove('location-target-pulse');
                    }
                }, 1200);
            }

            // 4. Animación de rebote (bounce / pulse) en el pin 3D del observador
            if (typeof observerMarkerGroup3D !== 'undefined' && observerMarkerGroup3D) {
                const startScale = 1.0;
                const peakScale = 1.65;
                const dur = 600;
                const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
                function pulsePin(now) {
                    const elapsed = now - t0;
                    if (elapsed < dur) {
                        const progress = elapsed / dur;
                        const s = startScale + (peakScale - startScale) * Math.sin(progress * Math.PI);
                        observerMarkerGroup3D.scale.set(s, s, s);
                        if (typeof scene3DNeedsRender !== 'undefined') scene3DNeedsRender = true;
                        if (typeof requestRender3D === 'function') requestRender3D();
                        requestAnimationFrame(pulsePin);
                    } else {
                        observerMarkerGroup3D.scale.set(startScale, startScale, startScale);
                        if (typeof scene3DNeedsRender !== 'undefined') scene3DNeedsRender = true;
                        if (typeof requestRender3D === 'function') requestRender3D();
                    }
                }
                requestAnimationFrame(pulsePin);
            }
        }


        // =========================================================================
        // POPUP FLOTANTE INTERACTIVO 3D EN EL GLOBO TERRÁQUEO (Estilo SEE / NASA)
        // =========================================================================
        var isGlobePopupOpen = false;
        var activeGlobePopupPoint = null;
        var lastInspectedLocation3D = null;

        function closeGlobe3DPopup() {
            isGlobePopupOpen = false;
            activeGlobePopupPoint = null;
            lastInspectedLocation3D = null;
            const popupEl = document.getElementById('globe-3d-popup');
            if (popupEl) {
                popupEl.style.display = 'none';
                popupEl.style.visibility = 'hidden';
                popupEl.style.opacity = '1';
                popupEl.style.pointerEvents = 'auto';
            }
            if (typeof requestRender3D === 'function') requestRender3D();
        }

        function showGlobe3DPopup(lat, lon, locationName = null) {
            const popupEl = document.getElementById('globe-3d-popup');
            const contentEl = document.getElementById('globe-3d-popup-content');
            if (!popupEl || !contentEl) return;

            contentEl.innerHTML = buildGlobe3DPopupHtml(lat, lon, locationName);

            isGlobePopupOpen = true;
            popupEl.style.display = 'block';
            popupEl.style.visibility = 'visible';
            popupEl.style.opacity = '1';
            popupEl.style.pointerEvents = 'auto';
            updateGlobe3DPopupPosition();
            if (typeof requestRender3D === 'function') requestRender3D();
        }

        function updateGlobe3DPopupPosition() {
            const popupEl = document.getElementById('globe-3d-popup');
            if (!popupEl || popupEl.style.display === 'none' || !activeGlobePopupPoint || typeof earthMesh3D === 'undefined' || !earthMesh3D || typeof camera3D === 'undefined' || !camera3D) {
                return;
            }

            // Convertir punto local a coordenadas de mundo
            const worldPos = activeGlobePopupPoint.clone();
            earthMesh3D.localToWorld(worldPos);

            // Comprobar si el punto está de espaldas a la cámara (horizon culling)
            const earthCenter = new THREE.Vector3();
            earthMesh3D.getWorldPosition(earthCenter);
            const surfaceNormal = worldPos.clone().sub(earthCenter).normalize();
            const toCamera = camera3D.position.clone().sub(worldPos).normalize();
            const dot = surfaceNormal.dot(toCamera);

            // Proyectar a coordenadas de pantalla
            const proj = worldPos.clone().project(camera3D);

            if (proj.z > 1.0 || dot <= 0.05) {
                popupEl.style.visibility = 'hidden';
                return;
            }

            popupEl.style.visibility = 'visible';
            const screenX = (proj.x * 0.5 + 0.5) * window.innerWidth;
            const screenY = (-(proj.y * 0.5) + 0.5) * window.innerHeight;

            popupEl.style.left = `${Math.round(screenX)}px`;
            popupEl.style.top = `${Math.round(screenY)}px`;
        }

        function inspectGlobeLocation(lat, lon, locationName = null, autoSetObserver = false, localPoint = null) {
            if (autoSetObserver) {
                const coordsStr = formatLatLonString(lat, lon, 4);
                updateObserverPosition(lat, lon, locationName || coordsStr, null);
            }

            if (!localPoint && typeof latLngToVector3 === 'function') {
                localPoint = latLngToVector3(lat, lon, EARTH_RADIUS * 1.004);
            }
            activeGlobePopupPoint = localPoint ? localPoint.clone() : null;
            lastInspectedLocation3D = { lat, lon, locationName };
            isGlobePopupOpen = true;

            showGlobe3DPopup(lat, lon, locationName);
        }

        function buildGlobe3DPopupHtml(lat, lon, locationName = null) {
            const ec = currentEclipse;
            const latStr = `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'N' : 'S'}`;
            const lonStr = `${Math.abs(lon).toFixed(4)}° ${lon >= 0 ? 'E' : 'O'}`;
            const locTitle = locationName
                ? `<div style="font-weight: 700; color: #38bdf8; font-size: 0.84rem; padding-right: 22px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${locationName}">${locationName}</div>`
                : '';

            let badgeText = 'NO VISIBLE';
            let badgeClass = 'vis-none';
            let rowsHtml = '';

            if (ec) {
                const contacts = [
                    { key: 'P1', name: 'Inicio Penumbra', jumpKey: 'p1', ms: ec.p1Ms },
                    { key: 'U1', name: 'Inicio Umbra (Parcial)', jumpKey: 'u1', ms: ec.u1Ms },
                    { key: 'U2', name: 'Inicio Totalidad', jumpKey: 'u2', ms: ec.u2Ms },
                    { key: 'MÁX', name: 'Máximo Eclipse', jumpKey: 'max', ms: ec.maxMs },
                    { key: 'U3', name: 'Fin Totalidad', jumpKey: 'u3', ms: ec.u3Ms },
                    { key: 'U4', name: 'Fin Umbra (Parcial)', jumpKey: 'u4', ms: ec.u4Ms },
                    { key: 'P4', name: 'Fin Penumbra', jumpKey: 'p4', ms: ec.p4Ms }
                ].filter(c => c.ms !== null);

                let visibleCount = 0;
                contacts.forEach(c => {
                    const coords = (typeof getMoonHorizontalCoords === 'function')
                        ? getMoonHorizontalCoords(ec.zenLat, ec.zenLon, c.ms, ec.maxMs, lat, lon)
                        : { alt: 0, az: 0 };
                    const isAbove = coords.alt > 0;
                    if (isAbove) visibleCount++;

                    const nextCoords = (typeof getMoonHorizontalCoords === 'function')
                        ? getMoonHorizontalCoords(ec.zenLat, ec.zenLon, c.ms + 60000, ec.maxMs, lat, lon)
                        : coords;
                    const isRising = nextCoords.alt >= coords.alt;
                    const arrowClass = isRising ? 'arrow-rising' : 'arrow-setting';
                    const arrowUnicode = `<span class="popup-alt-arrow ${arrowClass}" style="font-weight: 700; margin-right: 3px;">${isRising ? '↗' : '↘'}</span>`;
                    const timeStr = new Date(c.ms).toISOString().slice(11, 19);
                    const altStr = `${arrowUnicode}${coords.alt.toFixed(1)}°`;
                    const azStr = `${coords.az.toFixed(0)}°`;

                    rowsHtml += `
                        <tr id="row-popup-contact-${c.key}" onclick="if(typeof jumpToContact==='function') jumpToContact('${c.jumpKey}')" style="cursor: pointer;" title="Clic para saltar a ${c.key} (${c.name})">
                            <td><strong class="popup-phase-key" style="font-weight: 600;">${c.key}</strong></td>
                            <td class="popup-time-cell">${timeStr}</td>
                            <td class="popup-alt-cell" style="font-weight: 500;">${altStr}</td>
                            <td class="popup-az-cell">${azStr}</td>
                        </tr>
                    `;
                });

                if (visibleCount === contacts.length) {
                    badgeClass = 'vis-total';
                    badgeText = (ec.type === 'T') ? 'TOTAL VISIBLE' : 'VISIBLE COMPLETO';
                } else if (visibleCount > 0) {
                    const firstCoords = (typeof getMoonHorizontalCoords === 'function')
                        ? getMoonHorizontalCoords(ec.zenLat, ec.zenLon, contacts[0].ms, ec.maxMs, lat, lon)
                        : { alt: 0 };
                    badgeClass = 'vis-partial';
                    badgeText = (firstCoords.alt <= 0) ? 'VISIBLE AL ORTO' : 'VISIBLE AL OCASO';
                } else {
                    badgeClass = 'vis-none';
                    badgeText = 'BAJO EL HORIZONTE';
                }
            }

            const isCurrentObs = (typeof currentObserver !== 'undefined' && currentObserver && currentObserver.lat != null)
                ? (Math.abs(currentObserver.lat - lat) < 0.005 && Math.abs(currentObserver.lon - lon) < 0.005)
                : false;
            const btnText = isCurrentObs
                ? '<i class="fa-solid fa-check"></i> Ubicación actual'
                : '<i class="fa-solid fa-location-crosshairs"></i> Fijar como ubicación';
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
            const safeName = (locationName || '').replace(/'/g, "\\'");

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

                    <button type="button" class="btn-set-obs-map" onclick="setAsActiveObserver(${lat}, ${lon}, '${safeName}')" style="width: 100%; height: 28px; background: ${btnBg}; border: 1px solid ${btnBorder}; border-radius: 6px; color: ${btnColor}; font-size: 0.74rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; transition: all 0.2s; margin-top: 4px; ${isCurrentObs ? 'pointer-events: none;' : ''}">
                        ${btnText}
                    </button>
                </div>
            `;
        }

        function setAsActiveObserver(lat, lon, name = null) {
            let matchedPreset = null;
            if (!name) {
                for (const p of OBSERVER_PRESETS) {
                    const dLat = (p.lat - lat) * 111.0;
                    const dLon = (p.lon - lon) * 111.0 * Math.cos(lat * RAD);
                    if (Math.hypot(dLat, dLon) < 40) {
                        matchedPreset = p;
                        break;
                    }
                }
            }
            const finalName = name || (matchedPreset ? matchedPreset.name : formatLatLonString(lat, lon, 2));
            const tz = matchedPreset ? matchedPreset.tz : (currentObserver.tz || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");

            const input = document.getElementById('observer-location-input');
            if (input) input.value = finalName;
            const spaceInput = document.getElementById('space-3d-search-input');
            if (spaceInput) spaceInput.value = finalName;

            updateObserverPosition(lat, lon, finalName, tz);

            document.querySelectorAll('.btn-set-obs-map').forEach(btn => {
                animateLocationFixedDisplacement(btn);
            });
            document.querySelectorAll('.nasa-popup-inner').forEach(card => {
                card.classList.remove('is-preview-obs');
                card.classList.add('is-active-obs');
            });
        }

        function animateLocationFixedDisplacement(btn) {
            if (!btn || !document.body.contains(btn)) return;

            btn.style.pointerEvents = 'none';

            // 1. Mostrar estado "Ubicación fijada" en el botón
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Ubicación fijada';
            btn.style.background = 'rgba(34, 197, 94, 0.25)';
            btn.style.borderColor = '#22c55e';
            btn.style.color = '#22c55e';
            btn.style.boxShadow = '0 0 14px rgba(34, 197, 94, 0.5)';

            // 2. Disparar el destello verde en Visibilidad Local y píldora flotante
            triggerLocationConfirmationPulse(null);

            // 3. Tras ~800ms, desvanecer y cerrar con suavidad el popup flotante
            setTimeout(() => {
                const popupContainer = btn.closest('#globe-3d-popup') || document.getElementById('globe-3d-popup');

                if (popupContainer) {
                    popupContainer.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
                    popupContainer.style.opacity = '0';
                    popupContainer.style.pointerEvents = 'none';
                }

                setTimeout(() => {
                    closeGlobe3DPopup();
                    if (popupContainer) {
                        popupContainer.style.transition = '';
                        popupContainer.style.opacity = '1';
                        popupContainer.style.pointerEvents = 'auto';
                    }
                }, 350);
            }, 800);
        }

        function toggleGlobePickingMode(enable = null) {
            if (typeof currentActiveView !== 'undefined' && currentActiveView !== '3d') {
                if (typeof switchMainView === 'function') switchMainView('3d');
            }
            if (currentObserver && currentObserver.lat != null && currentObserver.lon != null) {
                if (typeof recenterEarth === 'function') {
                    recenterEarth(currentObserver.lat, currentObserver.lon);
                }
                inspectGlobeLocation(currentObserver.lat, currentObserver.lon, currentObserver.name || null, false);
            }
            expandLocationSearch();
        }

        function confirmGlobePicking() {
            closeGlobe3DPopup();
        }

        function cancelGlobePicking() {
            closeGlobe3DPopup();
        }


        // =========================================================================
        // BUSCADOR SUPERIOR FLOTANTE: PÍLDORA INTELIGENTE COLAPSABLE (Estilo SEE)
        // =========================================================================

        function parseCoordinatesInput(str) {
            if (!str || typeof str !== 'string') return null;
            const s = str.trim();
            if (!s) return null;

            // 1. Decimal simple (ej: 41.54, 2.44 o 41.54 -2.44)
            const decSimple = s.match(/^\s*([+-]?\d+(?:\.\d+)?)\s*[,;\s]\s*([+-]?\d+(?:\.\d+)?)\s*$/);
            if (decSimple) {
                const lat = parseFloat(decSimple[1]);
                const lon = parseFloat(decSimple[2]);
                if (!isNaN(lat) && !isNaN(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
                    return { lat, lon };
                }
            }

            // 2. Decimal con hemisferios (Lat, Lon)
            const decHemi1 = s.match(/^\s*([+-]?\d+(?:\.\d+)?)\s*°?\s*([NSns])\s*[,;\s]\s*([+-]?\d+(?:\.\d+)?)\s*°?\s*([EWewOo])\s*$/);
            if (decHemi1) {
                let lat = parseFloat(decHemi1[1]);
                if (/s/i.test(decHemi1[2])) lat = -Math.abs(lat);
                let lon = parseFloat(decHemi1[3]);
                if (/w|o/i.test(decHemi1[4])) lon = -Math.abs(lon);
                if (!isNaN(lat) && !isNaN(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
                    return { lat, lon };
                }
            }

            // 2b. Decimal con hemisferios invertido (Lon, Lat)
            const decHemi2 = s.match(/^\s*([+-]?\d+(?:\.\d+)?)\s*°?\s*([EWewOo])\s*[,;\s]\s*([+-]?\d+(?:\.\d+)?)\s*°?\s*([NSns])\s*$/);
            if (decHemi2) {
                let lon = parseFloat(decHemi2[1]);
                if (/w|o/i.test(decHemi2[2])) lon = -Math.abs(lon);
                let lat = parseFloat(decHemi2[3]);
                if (/s/i.test(decHemi2[4])) lat = -Math.abs(lat);
                if (!isNaN(lat) && !isNaN(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
                    return { lat, lon };
                }
            }

            // 3. DMS estándar: 41° 29' 43" N, 2° 22' 45" E
            const dms1 = s.match(/^\s*(\d{1,2})[°\s]+(\d{1,2})['\s]+(?:(\d+(?:\.\d+)?)["]?\s*)?([NSns])\s*[,;\s]\s*(\d{1,3})[°\s]+(\d{1,2})['\s]+(?:(\d+(?:\.\d+)?)["]?\s*)?([EWewOo])\s*$/);
            if (dms1) {
                let lat = parseFloat(dms1[1]) + parseFloat(dms1[2]) / 60 + (dms1[3] ? parseFloat(dms1[3]) / 3600 : 0);
                if (/s/i.test(dms1[4])) lat = -lat;
                let lon = parseFloat(dms1[5]) + parseFloat(dms1[6]) / 60 + (dms1[7] ? parseFloat(dms1[7]) / 3600 : 0);
                if (/w|o/i.test(dms1[8])) lon = -lon;
                if (!isNaN(lat) && !isNaN(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
                    return { lat, lon };
                }
            }

            // 3b. DMS invertido
            const dms2 = s.match(/^\s*(\d{1,3})[°\s]+(\d{1,2})['\s]+(?:(\d+(?:\.\d+)?)["]?\s*)?([EWewOo])\s*[,;\s]\s*(\d{1,2})[°\s]+(\d{1,2})['\s]+(?:(\d+(?:\.\d+)?)["]?\s*)?([NSns])\s*$/);
            if (dms2) {
                let lon = parseFloat(dms2[1]) + parseFloat(dms2[2]) / 60 + (dms2[3] ? parseFloat(dms2[3]) / 3600 : 0);
                if (/w|o/i.test(dms2[4])) lon = -lon;
                let lat = parseFloat(dms2[5]) + parseFloat(dms2[6]) / 60 + (dms2[7] ? parseFloat(dms2[7]) / 3600 : 0);
                if (/s/i.test(dms2[8])) lat = -lat;
                if (!isNaN(lat) && !isNaN(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
                    return { lat, lon };
                }
            }

            return null;
        }

        function expandLocationSearch() {
            const container = document.getElementById('space-3d-search-container');
            const input = document.getElementById('space-3d-search-input');
            if (!container) return;
            container.classList.remove('is-collapsed');
            if (input) {
                const curName = (currentObserver && currentObserver.name && !currentObserver.name.startsWith('Punto Sublunar')) ? currentObserver.name : '';
                input.value = curName;
                const clearBtn = document.getElementById('space-3d-search-clear');
                if (clearBtn) clearBtn.style.display = curName.length > 0 ? 'block' : 'none';
                setTimeout(() => {
                    input.focus();
                    input.select();
                }, 40);
            }
        }

        function collapseLocationSearch() {
            const container = document.getElementById('space-3d-search-container');
            const dropdown = document.getElementById('space-3d-search-dropdown');
            if (container) container.classList.add('is-collapsed');
            if (dropdown) dropdown.style.display = 'none';
            updatePillLabel();
        }

        function updatePillLabel(customName = null) {
            const pillLabel = document.getElementById('search-pill-label');
            if (!pillLabel) return;
            let label = customName;
            if (!label) {
                if (currentObserver && currentObserver.name) {
                    label = currentObserver.name;
                } else {
                    label = 'Elegir ubicación...';
                }
            }
            pillLabel.textContent = label;
            pillLabel.title = `Ubicación activa: ${label} (Clic para buscar)`;
        }

        function setupSpace3DSearchListeners() {
            const input = document.getElementById('space-3d-search-input');
            const clearBtn = document.getElementById('space-3d-search-clear');
            const dropdown = document.getElementById('space-3d-search-dropdown');
            const container = document.getElementById('space-3d-search-container');
            if (!input || !dropdown) return;

            if (container) {
                container.addEventListener('pointerdown', (e) => e.stopPropagation());
                container.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true });
            }
            const popupEl = document.getElementById('globe-3d-popup');
            if (popupEl) {
                popupEl.addEventListener('pointerdown', (e) => e.stopPropagation());
                popupEl.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true });
            }

            let debounceTimer = null;

            input.addEventListener('input', (e) => {
                const val = e.target.value.trim();
                if (clearBtn) clearBtn.style.display = val.length > 0 ? 'block' : 'none';
                clearTimeout(debounceTimer);

                if (val.length < 2) {
                    dropdown.style.display = 'none';
                    return;
                }

                // 1. Coordenadas numéricas directas
                const parsedCoords = parseCoordinatesInput(val);
                if (parsedCoords) {
                    dropdown.innerHTML = `
                        <div class="space-3d-search-result-item" onclick="select3DSearchCoords(${parsedCoords.lat}, ${parsedCoords.lon})">
                            <i class="fa-solid fa-location-dot" style="color: #38bdf8;"></i>
                            <div>
                                <div>Ir a coordenadas: <strong>${parsedCoords.lat.toFixed(4)}°, ${parsedCoords.lon.toFixed(4)}°</strong></div>
                                <div style="font-size: 0.68rem; color: #94a3b8;">Presiona Enter o haz clic para enfocar este punto en el globo</div>
                            </div>
                        </div>
                    `;
                    dropdown.style.display = 'block';
                    return;
                }

                // 2. Presets locales del catálogo
                const cleanQ = val.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                const catalog = (typeof OBSERVER_PRESETS !== 'undefined' && OBSERVER_PRESETS) ||
                                (typeof window !== 'undefined' && window.OBSERVER_LOCATIONS_CATALOG) || [];
                const matchedPresets = catalog.filter(p => {
                    const pName = (p.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                    return pName.includes(cleanQ);
                }).slice(0, 3);

                // 3. Geocoder Photon con sesgo geográfico
                debounceTimer = setTimeout(async () => {
                    try {
                        const center = (currentObserver && currentObserver.lat != null)
                            ? { lat: currentObserver.lat, lng: currentObserver.lon }
                            : { lat: 40.0, lng: -3.5 };
                        const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(val)}&lat=${center.lat}&lon=${center.lng}&limit=12`);
                        if (!res.ok) {
                            if (matchedPresets.length > 0) render3DSearchResults([], val, matchedPresets);
                            return;
                        }
                        const data = await res.json();
                        const rawFeatures = data.features || [];

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

                        render3DSearchResults(rawFeatures.slice(0, 6), val, matchedPresets);
                    } catch(err) {
                        console.warn('[Espacio 3D] Error en geocoder Photon:', err);
                        render3DSearchResults([], val, matchedPresets);
                    }
                }, 180);
            });

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    const val = input.value.trim();
                    const parsedCoords = parseCoordinatesInput(val);
                    if (parsedCoords) {
                        select3DSearchCoords(parsedCoords.lat, parsedCoords.lon);
                    } else {
                        const firstItem = dropdown.querySelector('.space-3d-search-result-item');
                        if (firstItem) firstItem.click();
                    }
                } else if (e.key === 'Escape') {
                    collapseLocationSearch();
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
                if (container && !container.contains(e.target)) {
                    collapseLocationSearch();
                }
            });
        }

        function render3DSearchResults(features, originalQuery, matchedPresets = []) {
            const dropdown = document.getElementById('space-3d-search-dropdown');
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

            matchedPresets.forEach(preset => {
                const safeName = (preset.name || '').replace(/'/g, "\\'");
                html += `
                    <div class="space-3d-search-result-item" onclick="select3DSearchResult(${preset.lat}, ${preset.lon}, '${safeName}')" style="background: rgba(56, 189, 248, 0.08);">
                        <i class="fa-solid fa-star" style="color: #facc15; font-size: 0.80rem; flex-shrink: 0;"></i>
                        <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                            <div style="font-weight: 600; color: #f8fafc;">${preset.name}</div>
                            <div style="font-size: 0.68rem; color: #38bdf8;">Ubicación destacada · ${preset.lat.toFixed(2)}°, ${preset.lon.toFixed(2)}°</div>
                        </div>
                    </div>
                `;
            });

            (features || []).forEach(f => {
                const props = f.properties || {};
                const name = props.name || props.street || originalQuery;
                const contextParts = [props.city, props.state, props.country].filter(Boolean);
                const context = contextParts.join(', ') || props.country || '';
                const lon = f.geometry.coordinates[0];
                const lat = f.geometry.coordinates[1];
                const safeName = name.replace(/'/g, "\\'");
                html += `
                    <div class="space-3d-search-result-item" onclick="select3DSearchResult(${lat}, ${lon}, '${safeName}')">
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

        function select3DSearchResult(lat, lon, name) {
            const dropdown = document.getElementById('space-3d-search-dropdown');
            const input = document.getElementById('space-3d-search-input');
            if (dropdown) dropdown.style.display = 'none';
            if (input) input.value = name;

            if (typeof recenterEarth === 'function') {
                recenterEarth(lat, lon);
            }
            inspectGlobeLocation(lat, lon, name, false);
            collapseLocationSearch();
        }

        function select3DSearchCoords(lat, lon) {
            const dropdown = document.getElementById('space-3d-search-dropdown');
            const input = document.getElementById('space-3d-search-input');
            if (dropdown) dropdown.style.display = 'none';
            const coordsStr = `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`;
            if (input) input.value = coordsStr;

            if (typeof recenterEarth === 'function') {
                recenterEarth(lat, lon);
            }
            inspectGlobeLocation(lat, lon, null, false);
            collapseLocationSearch();
        }

        function selectZenithLocation() {
            if (!currentEclipse || currentEclipse.zenLat == null) return;
            const lat = currentEclipse.zenLat;
            const lon = currentEclipse.zenLon;
            const name = `Punto Sublunar (${formatCoordDms(lat, true)}, ${formatCoordDms(lon, false)})`;
            if (typeof recenterEarth === 'function') {
                recenterEarth(lat, lon);
            }
            inspectGlobeLocation(lat, lon, name, false);
            collapseLocationSearch();
        }


// Exposición global
if (typeof window !== 'undefined') {
    window.getUtcOffsetString = getUtcOffsetString;
    window.updateObserverHeaderTz = updateObserverHeaderTz;
    window.getTzAbbr = getTzAbbr;
    window.populateObserverSelect = populateObserverSelect;
    window.openObserverDropdown = openObserverDropdown;
    window.closeObserverDropdown = closeObserverDropdown;
    window.filterObserverDropdown = filterObserverDropdown;
    window.selectObserverPreset = selectObserverPreset;
    window.onObserverInputKeyDown = onObserverInputKeyDown;
    window.updateDropdownHighlight = updateDropdownHighlight;
    window.toggleCustomCoords = toggleCustomCoords;
    window.onCustomCoordsChange = onCustomCoordsChange;
    window.detectUserLocation = detectUserLocation;
    window.formatCoordDms = formatCoordDms;
    window.formatLatLonString = formatLatLonString;
    window.updateObserverPosition = updateObserverPosition;
    window.triggerLocationConfirmationPulse = triggerLocationConfirmationPulse;
    window.isGlobePopupOpen = isGlobePopupOpen;
    window.closeGlobe3DPopup = closeGlobe3DPopup;
    window.showGlobe3DPopup = showGlobe3DPopup;
    window.updateGlobe3DPopupPosition = updateGlobe3DPopupPosition;
    window.inspectGlobeLocation = inspectGlobeLocation;
    window.buildGlobe3DPopupHtml = buildGlobe3DPopupHtml;
    window.setAsActiveObserver = setAsActiveObserver;
    window.animateLocationFixedDisplacement = animateLocationFixedDisplacement;
    window.toggleGlobePickingMode = toggleGlobePickingMode;
    window.confirmGlobePicking = confirmGlobePicking;
    window.cancelGlobePicking = cancelGlobePicking;
    window.parseCoordinatesInput = parseCoordinatesInput;
    window.expandLocationSearch = expandLocationSearch;
    window.collapseLocationSearch = collapseLocationSearch;
    window.updatePillLabel = updatePillLabel;
    window.setupSpace3DSearchListeners = setupSpace3DSearchListeners;
    window.render3DSearchResults = render3DSearchResults;
    window.select3DSearchResult = select3DSearchResult;
    window.select3DSearchCoords = select3DSearchCoords;
    window.selectZenithLocation = selectZenithLocation;
}
