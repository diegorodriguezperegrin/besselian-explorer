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

        function formatLatLonString(lat, lon, precision = 2) {
            const latDir = lat >= 0 ? 'N' : 'S';
            const lonDir = lon >= 0 ? 'E' : 'O';
            return `${Math.abs(lat).toFixed(precision)}°${latDir} ${Math.abs(lon).toFixed(precision)}°${lonDir}`;
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
            const gpsBtn = document.getElementById('btn-observer-gps');
            if (gpsBtn) gpsBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const lat = parseFloat(pos.coords.latitude.toFixed(2));
                    const lon = parseFloat(pos.coords.longitude.toFixed(2));
                    let userTz = 'UTC';
                    try {
                        userTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
                    } catch(e) {}

                    const coordsStr = formatLatLonString(lat, lon, 2);
                    const input = document.getElementById('observer-location-input');
                    if (input) input.value = coordsStr;
                    toggleCustomCoords(true);
                    const latIn = document.getElementById('custom-obs-lat');
                    const lonIn = document.getElementById('custom-obs-lon');
                    if (latIn) latIn.value = lat;
                    if (lonIn) lonIn.value = lon;

                    updateObserverPosition(lat, lon, coordsStr, userTz);

                    if (gpsBtn) gpsBtn.innerHTML = '<i class="fa-solid fa-crosshairs" style="color: #4ade80;"></i>';
                    setTimeout(() => {
                        if (gpsBtn) gpsBtn.innerHTML = '<i class="fa-solid fa-crosshairs"></i>';
                    }, 2000);
                },
                (err) => {
                    if (gpsBtn) gpsBtn.innerHTML = '<i class="fa-solid fa-crosshairs"></i>';
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
                renderMataroCircumstances();
            }
            updateTimeUI();
            if (currentActiveView === 'telescopic') renderTelescopicView();
            scene3DNeedsRender = true;
        }


        // =========================================================================
        // MODO SELECCIÓN INTERACTIVA DE UBICACIÓN EN EL GLOBO TERRÁQUEO 3D
        // =========================================================================
        var isGlobePickingMode = false;
        var preGlobePickingState = null;
        var tempPickedLat = null;
        var tempPickedLon = null;

        function toggleGlobePickingMode(enable = null) {
            const target = (enable !== null) ? enable : !isGlobePickingMode;
            if (target) {
                startGlobePickingMode();
            } else {
                confirmGlobePicking();
            }
        }

        function startGlobePickingMode() {
            if (isGlobePickingMode) return;
            isGlobePickingMode = true;

            const sidePanel = document.getElementById('sidebar-panel');
            const setPanel = document.getElementById('settings-panel');
            const dockPanel = document.getElementById('playback-dock');

            preGlobePickingState = {
                view: currentActiveView,
                camPos: camera3D ? camera3D.position.clone() : new THREE.Vector3(0, 130, 300),
                camTarget: controls3D ? controls3D.target.clone() : new THREE.Vector3(0, -10, -190),
                minDist: controls3D ? controls3D.minDistance : 2.0,
                maxDist: controls3D ? controls3D.maxDistance : 450000,
                sideOpen: sidePanel && !sidePanel.classList.contains('collapsed'),
                setOpen: setPanel && !setPanel.classList.contains('collapsed'),
                dockOpen: dockPanel && !dockPanel.classList.contains('collapsed'),
                prevLat: currentObserver.lat,
                prevLon: currentObserver.lon,
                prevName: currentObserver.name,
                prevTz: currentObserver.tz
            };

            tempPickedLat = currentObserver.lat;
            tempPickedLon = currentObserver.lon;

            if (currentActiveView !== '3d') {
                switchMainView('3d');
            }

            if (sidePanel) sidePanel.classList.add('collapsed');
            if (setPanel) setPanel.classList.add('collapsed');
            if (dockPanel) dockPanel.classList.add('collapsed');
            updateTopNavButtonsState();

            const banner = document.getElementById('globe-picking-banner');
            if (banner) banner.style.display = 'flex';
            const coordsText = document.getElementById('globe-picking-coords-text');
            if (coordsText) coordsText.textContent = formatLatLonString(currentObserver.lat, currentObserver.lon);

            if (renderer3D && renderer3D.domElement) {
                renderer3D.domElement.style.cursor = 'crosshair';
            }

            let camDir = new THREE.Vector3(0, 0.4, 1);
            if (earthMesh3D && observerMarkerGroup3D) {
                const obsWorldPos = new THREE.Vector3();
                observerMarkerGroup3D.getWorldPosition(obsWorldPos);
                if (obsWorldPos.lengthSq() > 0.1) {
                    camDir.copy(obsWorldPos).normalize();
                }
            }
            const targetCamPos = camDir.multiplyScalar(15.5);
            if (controls3D) {
                controls3D.minDistance = 7.0;
                controls3D.maxDistance = 60.0;
            }
            transitionCamera3D(new THREE.Vector3(0, 0, 0), targetCamPos, 7.0, 800);
            requestRender3D();
        }

        function handleGlobePickingClick(clientX, clientY) {
            if (!camera3D || !earthMesh3D) return;

            const rect = renderer3D.domElement.getBoundingClientRect();
            const mouse = new THREE.Vector2(
                ((clientX - rect.left) / rect.width) * 2 - 1,
                -((clientY - rect.top) / rect.height) * 2 + 1
            );

            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(mouse, camera3D);

            const intersects = raycaster.intersectObject(earthMesh3D, false);
            if (intersects.length > 0) {
                const hitPoint = intersects[0].point;
                const localPoint = earthMesh3D.worldToLocal(hitPoint.clone());
                const { lat, lon } = vector3ToLatLng(localPoint);

                tempPickedLat = Math.round(lat * 100) / 100;
                tempPickedLon = Math.round(lon * 100) / 100;

                if (observerMarkerGroup3D) {
                    observerMarkerGroup3D.position.copy(latLngToVector3(tempPickedLat, tempPickedLon, EARTH_RADIUS * 1.004));
                    observerMarkerGroup3D.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), latLngToVector3(tempPickedLat, tempPickedLon, 1.0).normalize());
                }

                const coordsText = document.getElementById('globe-picking-coords-text');
                if (coordsText) {
                    coordsText.textContent = formatLatLonString(tempPickedLat, tempPickedLon);
                }

                const latIn = document.getElementById('custom-obs-lat');
                const lonIn = document.getElementById('custom-obs-lon');
                if (latIn) latIn.value = tempPickedLat;
                if (lonIn) lonIn.value = tempPickedLon;

                requestRender3D();
            }
        }

        function confirmGlobePicking() {
            if (!isGlobePickingMode) return;
            isGlobePickingMode = false;

            const banner = document.getElementById('globe-picking-banner');
            if (banner) banner.style.display = 'none';

            if (renderer3D && renderer3D.domElement) {
                renderer3D.domElement.style.cursor = '';
            }

            if (tempPickedLat !== null && tempPickedLon !== null) {
                let matchedPreset = null;
                for (const p of OBSERVER_PRESETS) {
                    const dLat = (p.lat - tempPickedLat) * 111.0;
                    const dLon = (p.lon - tempPickedLon) * 111.0 * Math.cos(tempPickedLat * RAD);
                    const distKm = Math.hypot(dLat, dLon);
                    if (distKm < 40) {
                        matchedPreset = p;
                        break;
                    }
                }
                const name = matchedPreset ? matchedPreset.name : formatLatLonString(tempPickedLat, tempPickedLon, 2);
                const tz = matchedPreset ? matchedPreset.tz : (Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
                
                const input = document.getElementById('observer-location-input');
                if (input) input.value = name;
                updateObserverPosition(tempPickedLat, tempPickedLon, name, tz);
            }

            if (preGlobePickingState) {
                if (controls3D) {
                    controls3D.minDistance = preGlobePickingState.minDist;
                    controls3D.maxDistance = preGlobePickingState.maxDist;
                }
                if (preGlobePickingState.sideOpen) toggleSidebar(true);
                if (preGlobePickingState.setOpen) toggleSettingsPanel(true);
                if (preGlobePickingState.dockOpen) togglePlaybackDock(true);
                transitionCamera3D(preGlobePickingState.camTarget, preGlobePickingState.camPos, preGlobePickingState.minDist, 700);
                preGlobePickingState = null;
            }
            requestRender3D();
        }

        function cancelGlobePicking() {
            if (!isGlobePickingMode) return;
            isGlobePickingMode = false;

            const banner = document.getElementById('globe-picking-banner');
            if (banner) banner.style.display = 'none';

            if (renderer3D && renderer3D.domElement) {
                renderer3D.domElement.style.cursor = '';
            }

            if (preGlobePickingState) {
                updateObserverPosition(preGlobePickingState.prevLat, preGlobePickingState.prevLon, preGlobePickingState.prevName, preGlobePickingState.prevTz);
                const input = document.getElementById('observer-location-input');
                if (input) input.value = preGlobePickingState.prevName;

                if (controls3D) {
                    controls3D.minDistance = preGlobePickingState.minDist;
                    controls3D.maxDistance = preGlobePickingState.maxDist;
                }
                if (preGlobePickingState.sideOpen) toggleSidebar(true);
                if (preGlobePickingState.setOpen) toggleSettingsPanel(true);
                if (preGlobePickingState.dockOpen) togglePlaybackDock(true);
                transitionCamera3D(preGlobePickingState.camTarget, preGlobePickingState.camPos, preGlobePickingState.minDist, 700);
                preGlobePickingState = null;
            }
            requestRender3D();
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
    window.isGlobePickingMode = isGlobePickingMode;
    window.toggleGlobePickingMode = toggleGlobePickingMode;
    window.startGlobePickingMode = startGlobePickingMode;
    window.handleGlobePickingClick = handleGlobePickingClick;
    window.confirmGlobePicking = confirmGlobePicking;
    window.cancelGlobePicking = cancelGlobePicking;
}
