/* =========================================================================
   COSMOS MATARÓ - WIDGETS E INTERFAZ DE USUARIO 3D (simulador3d_widgets.js)
   Itinerario guiado (Tour de meses lunares), widgets de resonancia orbital
   (Saros y Exeligmos), registro de eventos astronómicos, sliders de velocidad,
   diales orbitales y control colapsable de paneles laterales.
   ========================================================================= */

// Add an entry to the scrollable event log
        function addLogEntry(day, text) {
            if (!_eventLogContainerEl) _eventLogContainerEl = document.getElementById('event-log-container');
            if (!_eventLogContainerEl) return;
            
            const entry = document.createElement('div');
            entry.style.padding = '1px 0px';
            entry.style.color = 'var(--text-primary)';
            entry.style.lineHeight = '1.3';
            entry.style.fontSize = '0.78rem';
            entry.style.fontFamily = 'var(--font-body)';
            
            // Highlight the day number (simple text without color bars or empty spacing)
            entry.innerHTML = `<strong style="color: var(--solar-yellow); font-family: var(--font-heading); margin-right: 4px;">${MESSAGES.dayLogPrefix(day)}</strong> ${text}`;
            
            // Prepend so the newest event is always at the top
            _eventLogContainerEl.prepend(entry);
            
            // Limit the event log to the 10 most recent events
            while (_eventLogContainerEl.children.length > 10) {
                _eventLogContainerEl.removeChild(_eventLogContainerEl.lastChild);
            }
        }

        // Clear the entire event log
        function clearEventLog() {
            if (!_eventLogContainerEl) _eventLogContainerEl = document.getElementById('event-log-container');
            if (_eventLogContainerEl) _eventLogContainerEl.innerHTML = "";
            lastMoonPhase = "";
            lastEclipseState = "Ninguno";
        }

// --- 10. INTERFAZ DE USUARIO E INTERACCIÓN ---
        function togglePlay() {
            isPlaying = !isPlaying;
            const btn = document.getElementById('btn-play');
            if (btn) {
                btn.innerHTML = isPlaying ? '<i class="fa-solid fa-pause" style="margin-right: 4px;"></i> Pausar' : '<i class="fa-solid fa-play" style="margin-right: 4px;"></i> Reanudar';
                btn.className = isPlaying ? "btn btn-primary" : "btn btn-primary btn-danger";
            }
        }

        function updateTimeScale(val) {
            multipliers.timeScale = parseFloat(val);
            document.getElementById('val-time-scale').innerText = multipliers.timeScale.toFixed(1) + 'x';
        }

        function updateSpeed(type, val) {
            multipliers[type] = parseFloat(val);
            
            // Map keys to labels
            let labelId = "";
            if (type === 'rotSun') labelId = 'val-rot-sun';
            else if (type === 'rotEarth') labelId = 'val-rot-earth';
            else if (type === 'rotMoon') labelId = 'val-rot-moon';
            else if (type === 'orbitEarth') labelId = 'val-orbit-earth';
            else if (type === 'orbitMoon') labelId = 'val-orbit-moon';
            else if (type === 'precessionEarth') labelId = 'val-precession-earth';
            else if (type === 'precessionMoon') labelId = 'val-precession-moon';
            else if (type === 'apsidesMoon') labelId = 'val-precession-apsides';
            
            document.getElementById(labelId).innerText = multipliers[type].toFixed(1) + 'x';
            
            // If locked and we changed orbit speed, keep rotation speed in sync
            if (type === 'orbitMoon' && isTidalLocked) {
                multipliers.rotMoon = multipliers.orbitMoon;
                const srm = document.getElementById('slider-rot-moon'); if (srm) srm.value = multipliers.orbitMoon.toFixed(1);
                const vrm = document.getElementById('val-rot-moon'); if (vrm) vrm.innerText = multipliers.orbitMoon.toFixed(1) + 'x';
            }
            
            // If user manually tweaks rotation speed, it must be different from orbit speed to break lock
            if (type === 'rotMoon' && isTidalLocked && multipliers.rotMoon !== multipliers.orbitMoon) {
                document.getElementById('check-tidal-lock').checked = false;
                isTidalLocked = false;
                const srm2 = document.getElementById('slider-rot-moon'); if (srm2) srm2.disabled = false;
            }
        }

        function toggleTidalLock(checked) {
            isTidalLocked = checked;
            const rotSlider = document.getElementById('slider-rot-moon');
            if (rotSlider) {
                if (checked) {
                    multipliers.rotMoon = multipliers.orbitMoon;
                    rotSlider.value = multipliers.orbitMoon.toFixed(1);
                    const rotVal = document.getElementById('val-rot-moon');
                    if (rotVal) rotVal.innerText = multipliers.orbitMoon.toFixed(1) + 'x';
                    rotSlider.disabled = true;
                } else {
                    rotSlider.disabled = false;
                }
            }
        }

        function updateAngle(type, val) {
            angles[type] = parseFloat(val);
            
            let labelId = "";
            if (type === 'obliqEarth') {
                labelId = 'val-obliq-earth';
                document.getElementById(labelId).innerText = angles.obliqEarth.toFixed(1) + '°';
            } else if (type === 'incMoon') {
                labelId = 'val-inc-moon';
                document.getElementById(labelId).innerText = angles.incMoon.toFixed(1) + '°';
            } else if (type === 'eccentricityMoon') {
                labelId = 'val-ecc-moon';
                document.getElementById(labelId).innerText = angles.eccentricityMoon.toFixed(3);
            }
            
            updatePositionsAndTilts();
            
            // Rebuild eclipse sectors: their angle depends on Moon's inclination
            if (type === 'incMoon' && eclipseSectorsMesh) {
                scene.remove(eclipseSectorsMesh);
                eclipseSectorsMesh = createEclipseSectorsMesh();
                eclipseSectorsMesh.visible = showHelpers.eclipseSectors;
                eclipseSectorsMesh.rotation.y = states.precessionMoon;
                scene.add(eclipseSectorsMesh);
            }
        }

        function toggleHelper(type, checked) {
            showHelpers[type] = checked;
            
            if (type === 'constellations') {
                if (constellationLines) constellationLines.visible = checked;
            } else if (type === 'orbits') {
                if (earthOrbitLine) earthOrbitLine.visible = checked;
                if (moonOrbitLine) moonOrbitLine.visible = checked;
                if (lineOfApsides) lineOfApsides.visible = checked;
            } else if (type === 'eclipticPlane') {
                if (eclipticPlaneMesh) eclipticPlaneMesh.visible = checked;
            } else if (type === 'eclipseSectors') {
                if (eclipseSectorsMesh) eclipseSectorsMesh.visible = checked;
            } else if (type === 'shadowFootprint') {
                showHelpers.shadowFootprint = checked;
                // shader uniform updated live each frame in animate loop
            } else if (type === 'axes') {
                if (earthAxisLine) earthAxisLine.visible = checked;
                if (eclipticAxisLine) eclipticAxisLine.visible = checked;
                if (moonAxisLine) moonAxisLine.visible = checked;
                if (moonOrbitAxisLine) moonOrbitAxisLine.visible = checked;
                if (moonDepthLine) moonDepthLine.visible = checked;
            } else if (type === 'celestialGrid') {
                if (celestialGrid) celestialGrid.visible = checked;
                if (celestialPrecessionCircle) celestialPrecessionCircle.visible = checked;
                if (celestialPrecessionCross) celestialPrecessionCross.visible = checked;
            } else if (type === 'geoGrids') {
                if (earthGeoGrid) earthGeoGrid.visible = checked;
                if (moonGeoGrid) moonGeoGrid.visible = checked;
            } else if (type === 'precessionEarth') {
                const rowPrec = document.getElementById('row-precession-earth');
                if (rowPrec) {
                    rowPrec.style.opacity = checked ? '1' : '0.45';
                    rowPrec.style.pointerEvents = checked ? 'auto' : 'none';
                    rowPrec.querySelectorAll('input').forEach(el => el.disabled = !checked);
                }
                // Do NOT reset states.precessionEarth — deactivating only pauses the movement
            } else if (type === 'axisProjectionLine') {
                if (axisProjectionLine) axisProjectionLine.visible = checked;
                updateAxisProjectionLine();
            } else if (type === 'precessionMoon') {
                // Lunar nodal precession and Earth axis nutation are causally inseparable (same 18.6-yr period)
                const secPrec = document.getElementById('section-precession-moon');
                if (secPrec) {
                    secPrec.style.opacity = checked ? '1' : '0.45';
                    secPrec.style.pointerEvents = checked ? 'auto' : 'none';
                    secPrec.querySelectorAll('input').forEach(el => el.disabled = !checked);
                }
                nutationEnabled = checked;
                earthPrecessionHistory = [];
                updatePositionsAndTilts();
                // Do NOT reset states.precessionMoon — deactivating only pauses the movement
            } else if (type === 'subsolarPoint') {
                if (subsolarMarker) subsolarMarker.visible = checked;
                if (sublunarMarker) sublunarMarker.visible = checked;
                if (terminatorRing) terminatorRing.visible = checked;
            }
        }

        function updateNutationAmplitude(val) {
            nutationAmplitude = parseFloat(val);
            document.getElementById('val-nutation-amplitude').innerText = parseFloat(val).toFixed(1) + '°';
            earthPrecessionHistory = []; // Clear trail to avoid jump artefact
        }

        function updateStarBrightness(val) {
            const factor = parseFloat(val);
            if (starsMaterial) {
                starsMaterial.opacity = factor;
                // Dynamically scale star point size from 0.5 to 5.0 to drastically increase perceived brightness
                starsMaterial.size = 0.5 + factor * 4.5;
            }
            document.getElementById('val-star-brightness').innerText = factor.toFixed(2) + 'x';
        }

        function updateGridBrightness(val) {
            const factor = parseFloat(val);
            const gridOpacity = factor * 0.4;
            if (celestialGrid && celestialGrid.material) {
                celestialGrid.material.opacity = gridOpacity;
            }
            if (celestialPrecessionCircle && celestialPrecessionCircle.material) {
                celestialPrecessionCircle.material.opacity = Math.min(1.0, gridOpacity * 2.5);
            }
            if (celestialPrecessionCross && celestialPrecessionCross.material) {
                celestialPrecessionCross.material.opacity = Math.min(1.0, gridOpacity * 5.0);
            }
            if (starsMaterial) {
                starsMaterial.opacity = Math.min(1.0, factor * 1.5);
                starsMaterial.size = 0.5 + factor * 4.5;
            }
            const displayEl = document.getElementById('val-grid-brightness');
            if (displayEl) displayEl.innerText = factor.toFixed(2) + 'x';
        }



        function resetSimulation() {
            // Restore default sliders values
            multipliers = {
                rotSun: 1.0,
                rotEarth: 1.0,
                rotMoon: 1.0,
                orbitEarth: 1.0,
                orbitMoon: 1.0,
                precessionEarth: 1.0,
                precessionMoon: 1.0,
                apsidesMoon: 1.0,
                timeScale: 1.0
            };
            angles = {
                obliqEarth: 23.4,
                incMoon: 5.1,
                eccentricityMoon: 0.055
            };
            isTidalLocked = true;
            isPlaying = true;
            
            // Reset sliders UI
            document.getElementById('slider-time-scale').value = 1.0;
            document.getElementById('slider-obliq-earth').value = 23.4;
            document.getElementById('slider-inc-moon').value = 5.1;

            // Reset labels UI
            document.getElementById('val-time-scale').innerText = '1.0x';
            document.getElementById('val-obliq-earth').innerText = '23.4°';
            document.getElementById('val-inc-moon').innerText = '5.1°';
            document.getElementById('slider-ecc-moon').value = 0.055;
            document.getElementById('val-ecc-moon').innerText = '0.055';

            document.getElementById('check-tidal-lock').checked = true;
            document.getElementById('btn-play').innerText = "Pausar";
            document.getElementById('btn-play').className = "btn btn-primary";
            
            // Starfield and Celestial Grid reset
            if (document.getElementById('check-show-constellations')) document.getElementById('check-show-constellations').checked = true;
            if (document.getElementById('check-show-grid')) document.getElementById('check-show-grid').checked = true;
            if (document.getElementById('check-show-geo-grids')) document.getElementById('check-show-geo-grids').checked = true;
            const gridSlider = document.getElementById('slider-grid-brightness');
            if (gridSlider) {
                gridSlider.value = 0.5;
                const gridVal = document.getElementById('val-grid-brightness');
                if (gridVal) gridVal.innerText = '0.50x';
            }
            showHelpers.constellations = true;
            showHelpers.celestialGrid = true;
            showHelpers.geoGrids = true;
            if (constellationLines) constellationLines.visible = true;
            updateGridBrightness(0.5);
            
            // Scale reset
            currentScale = { ...VISUAL_SCALE };
            
            // Reset shadow camera properties
            if (shadowLight && shadowLight.shadow && shadowLight.shadow.camera) {
                shadowLight.shadow.camera.left = -35;
                shadowLight.shadow.camera.right = 35;
                shadowLight.shadow.camera.top = 35;
                shadowLight.shadow.camera.bottom = -35;
                shadowLight.shadow.camera.near = 20;
                shadowLight.shadow.camera.far = 130;
                shadowLight.shadow.camera.updateProjectionMatrix();
            }
            
            // Precessions and Helpers reset
            showHelpers.precessionEarth = false;
            showHelpers.precessionMoon = false;
            showHelpers.subsolarPoint = false;
            multipliers.precessionEarth = 1.0;
            multipliers.precessionMoon = 1.0;
            
            document.getElementById('check-precession-earth').checked = false;
            document.getElementById('check-precession-moon').checked = false;
            if (document.getElementById('check-show-subsolar')) document.getElementById('check-show-subsolar').checked = false;
            document.getElementById('slider-precession-earth').value = 1.0;
            document.getElementById('slider-precession-moon').value = 1.0;
            document.getElementById('slider-precession-apsides').value = 1.0;
            document.getElementById('val-precession-earth').innerText = '1.0x';
            document.getElementById('val-precession-moon').innerText = '1.0x';
            document.getElementById('val-precession-apsides').innerText = '1.0x';
            document.getElementById('row-precession-earth').style.display = 'none';
            document.getElementById('section-precession-moon').style.display = 'none';
            // Nutation reset (auto-linked to lunar nodal precession)
            nutationEnabled   = false;
            nutationAmplitude = 2.0;
            document.getElementById('slider-nutation-amplitude').value = 2.0;
            document.getElementById('val-nutation-amplitude').innerText = '2.0°';
            earthPrecessionHistory = [];
            moonPrecessionHistory  = [];
            
            // Re-create universe with full GPU memory disposal
            if (sunGroup) { dispose3DObject(sunGroup); scene.remove(sunGroup); }
            if (earthGroup) { dispose3DObject(earthGroup); scene.remove(earthGroup); }
            
            // Clear Event Log
            clearEventLog();
            lastLoggedYear = 1;
            lastSeason = "";
            
            if (earthOrbitLine) { dispose3DObject(earthOrbitLine); scene.remove(earthOrbitLine); }
            if (celestialGrid && scene) { dispose3DObject(celestialGrid); scene.remove(celestialGrid); }
            if (starfield && scene) { dispose3DObject(starfield); scene.remove(starfield); }
            if (constellationLines && scene) { dispose3DObject(constellationLines); scene.remove(constellationLines); }
            if (celestialPrecessionCircle && scene) { dispose3DObject(celestialPrecessionCircle); scene.remove(celestialPrecessionCircle); }
            if (celestialPrecessionCross && scene) { dispose3DObject(celestialPrecessionCross); scene.remove(celestialPrecessionCross); }
            if (axisProjectionLine && scene) { dispose3DObject(axisProjectionLine); scene.remove(axisProjectionLine); }
            if (earthPrecessionTrail && scene) { dispose3DObject(earthPrecessionTrail); scene.remove(earthPrecessionTrail); }
            if (eclipticPlaneMesh && scene) { dispose3DObject(eclipticPlaneMesh); scene.remove(eclipticPlaneMesh); }
            if (eclipseSectorsMesh && scene) { dispose3DObject(eclipseSectorsMesh); scene.remove(eclipseSectorsMesh); }
            
            createUniverse();
            createVisualHelpers();
            
            // Reset animation variables
            states = {
                rotSun: 0,
                rotEarth: 0,
                rotMoon: 0,
                orbitEarth: INITIAL_EARTH_ORBIT,
                orbitMoon: 0,
                precessionEarth: 0,
                precessionMoon: 0,
                days: 0
            };
            
            earthPrecessionHistory = [];
            moonPrecessionHistory = [];
            if (earthPrecessionTrail) earthPrecessionTrail.visible = false;
            if (moonPrecessionTrail) moonPrecessionTrail.visible = false;
            
            setCameraPreset('sun');
            controls.reset();
        }

        function toggleHelp() {
            document.getElementById('help-modal-overlay').classList.toggle('open');
        }

        // Control de Colapso y Reapertura de Paneles (Izquierdo y Derecho)
        const panelLeft = document.getElementById('main-panel');
        const panelRight = document.getElementById('settings-panel');
        const btnToggleLeft = document.getElementById('btn-toggle-left');
        const btnToggleRight = document.getElementById('btn-toggle-right');
        const btnReopenLeft = document.getElementById('btn-reopen-left');
        const btnReopenRight = document.getElementById('btn-reopen-right');

        function openLeftPanel() {
            if (panelLeft) panelLeft.style.display = 'flex';
            if (btnReopenLeft) btnReopenLeft.style.display = 'none';
            if (window.innerWidth <= 768 && panelRight) {
                panelRight.style.display = 'none';
                if (btnReopenRight) btnReopenRight.style.display = 'inline-flex';
            }
        }

        function closeLeftPanel() {
            if (panelLeft) panelLeft.style.display = 'none';
            if (btnReopenLeft) btnReopenLeft.style.display = 'inline-flex';
        }

        function openRightPanel() {
            if (panelRight) panelRight.style.display = 'flex';
            if (btnReopenRight) btnReopenRight.style.display = 'none';
            if (window.innerWidth <= 768 && panelLeft) {
                panelLeft.style.display = 'none';
                if (btnReopenLeft) btnReopenLeft.style.display = 'inline-flex';
            }
        }

        function closeRightPanel() {
            if (panelRight) panelRight.style.display = 'none';
            if (btnReopenRight) btnReopenRight.style.display = 'inline-flex';
        }

        function togglePanel() {
            if (panelLeft && panelLeft.style.display === 'none') {
                openLeftPanel();
            } else {
                closeLeftPanel();
            }
        }

        function appendToRightPanelsContainer(panelEl) {
            const container = document.getElementById('right-panels-container');
            if (container && panelEl) {
                container.appendChild(panelEl);
            }
        }

        function toggleEventLog(show) {
            const panel = document.getElementById('dashboard-panel');
            const chk = document.getElementById('check-show-event-log');
            if (chk) chk.checked = show;

            if (show) {
                appendToRightPanelsContainer(panel);
                if (panel) panel.style.display = 'flex';
            } else {
                if (panel) panel.style.display = 'none';
            }
        }

        function closeEventLog() {
            toggleEventLog(false);
        }

        // ═════════════════════════════════════════════════════════════════════════════
        // MÓDULO ITINERARIO EDUCATIVO GUIADO (MESES LUNARES 3D)
        // ═════════════════════════════════════════════════════════════════════════════
        const TOUR_STEPS = [
            {
                title: "1. Mes sinódico (fases lunares)",
                sub: "Duración media: 29.53059 días (Varía 29.18 - 29.93d)",
                text: "Mide el ciclo completo de las fases (de Luna Nueva a Luna Nueva). Debido a la excentricidad de la órbita lunar y terrestre, su duración real varía entre 29.18 y 29.93 días (con una media de 29.53 días). Como la Tierra se mueve alrededor del Sol, la Luna debe girar ~389° para alinearse.",
                presetCam: "earth",
                timeScale: 0.8,
                color: "#38bdf8",
                incMoon: 5.1,
                showOrbits: true,
                showNodes: false
            },
            {
                title: "2. Mes draconítico o nodal (eclipses)",
                sub: "Duración: 27.21222 días • Inclinación 5.14° y Nodos ☊/☋",
                text: "Mide el tiempo entre dos pasos por el mismo Nodo orbital. La órbita lunar está inclinada 5.14° respecto a la Eclíptica. ¡Solo hay eclipses cuando la Luna pasa cerca de un nodo en Luna Nueva o Llena!",
                presetCam: "earth",
                timeScale: 0.5,
                color: "#38bdf8",
                incMoon: 5.1,
                showOrbits: true,
                showNodes: true
            },
            {
                title: "3. Mes anomalístico (perigeo y apogeo)",
                sub: "Duración: 27.55455 días • Órbita Elíptica y Distancia",
                text: "Mide el tiempo entre dos pasos por el Perigeo (máxima cercanía). La excentricidad cambia el tamaño aparente de la Luna: si un eclipse solar ocurre en Perigeo es TOTAL; cerca del Apogeo es ANULAR.",
                presetCam: "earth",
                timeScale: 0.4,
                color: "#38bdf8",
                incMoon: 5.1,
                showOrbits: true,
                showNodes: true
            },
            {
                title: "4. Sinfonía de Saros (resonancia)",
                sub: "223 Sinódicos ≈ 242 Draconíticos ≈ 239 Anomalísticos",
                text: "¡La gran coincidencia astronómica! Al cabo de 18 años, 11 días y 8 horas (6585.32 días), los 3 períodos coinciden simultáneamente. Esto hace que se repita exactamente la misma disposición relativa entre los tres marcadores orbitales (y, si ocurre en Luna Nueva/Llena cerca de un nodo, la misma serie o familia de eclipses).",
                presetCam: "earth",
                timeScale: 0.4,
                color: "#38bdf8",
                incMoon: 5.1,
                showOrbits: true,
                showNodes: true
            },
            {
                title: "5. El Exeligmos (Trisaros / gran rueda)",
                sub: "54 años y 33 días • 669 Sinódicos ≈ 726 Draconíticos ≈ 717 Anomalísticos",
                text: "El Exeligmos (o Trisaros) es la gran resonancia de 3 ciclos Saros (54 años y 33 días). Al triplicar las 8 horas sobrantes del Saros (3 × 8h = 24h), la Tierra completa un número entero exacto de giros diurnos. ¡El eclipse se repite no solo con la misma geometría orbital, sino en la misma longitud geográfica y hora local en la Tierra!",
                presetCam: "earth",
                timeScale: 0.4,
                color: "#a855f7",
                incMoon: 5.1,
                showOrbits: true,
                showNodes: true
            }
        ];

        let currentTourStep = 0;
        let isTourActive = false;
        let isTourPanelOpen = false;

        function uncollapsePrecessionSection() {
            openLeftPanel();

            // Marcar checkboxes y desplegar subpaneles de la sección Precesión y Bamboleo
            const chkEarth = document.getElementById('check-precession-earth');
            const rowEarth = document.getElementById('row-precession-earth');
            if (chkEarth) chkEarth.checked = true;
            if (rowEarth) rowEarth.style.display = 'flex';

            const chkMoon = document.getElementById('check-precession-moon');
            const secMoon = document.getElementById('section-precession-moon');
            if (chkMoon) chkMoon.checked = true;
            if (secMoon) secMoon.style.display = 'block';

            // Activar visualización en el motor 3D
            if (typeof toggleHelper === 'function') {
                toggleHelper('precessionEarth', true);
                toggleHelper('precessionMoon', true);
            }
        }

        function toggleTourPanel(forceState) {
            const card = document.getElementById('tour-card');
            
            if (typeof forceState === 'boolean') {
                isTourPanelOpen = forceState;
            } else {
                isTourPanelOpen = !isTourPanelOpen;
            }

            const chkMain = document.getElementById('check-show-tour');
            if (chkMain) chkMain.checked = isTourPanelOpen;

            if (isTourPanelOpen) {
                appendToRightPanelsContainer(card);
                if (card) card.style.display = 'flex';
                uncollapsePrecessionSection();
                setTourActive(true);
                applyTourStep(currentTourStep);
            } else {
                if (card) card.style.display = 'none';
                setTourActive(false);
            }
        }

        function setTourActive(active) {
            isTourActive = active;
            const precSection = document.getElementById('section-precession-container');
            if (precSection) {
                if (active) {
                    precSection.classList.add('disabled-by-tour');
                    precSection.querySelectorAll('input, button').forEach(el => el.disabled = true);
                } else {
                    precSection.classList.remove('disabled-by-tour');
                    precSection.querySelectorAll('input, button').forEach(el => el.disabled = false);
                }
            }
        }

        function applyTourStep(stepIdx) {
            currentTourStep = stepIdx;
            const step = TOUR_STEPS[stepIdx];

            // Bloquear los controles de Precesión y Ángulos
            setTourActive(true);

            const titleEl = document.getElementById('tour-step-title');
            if (titleEl) titleEl.innerText = step.title;

            const subEl = document.getElementById('tour-step-sub');
            if (subEl) {
                subEl.innerText = step.sub;
                subEl.style.color = step.color;
            }

            const textEl = document.getElementById('tour-step-text');
            if (textEl) textEl.innerText = step.text;

            const contentBox = document.getElementById('tour-content-box');
            if (contentBox) contentBox.style.borderLeftColor = step.color;

            const dots = document.querySelectorAll('.tour-dot');
            dots.forEach((dot, idx) => {
                dot.classList.toggle('active', idx === stepIdx);
                if (idx === stepIdx) dot.style.background = step.color;
                else dot.style.background = 'rgba(255, 255, 255, 0.15)';
            });

            const prevBtn = document.getElementById('btn-tour-prev');
            if (prevBtn) {
                prevBtn.style.display = stepIdx === 0 ? 'none' : 'inline-flex';
            }

            const nextBtn = document.getElementById('btn-tour-next');
            if (nextBtn) nextBtn.innerText = stepIdx === TOUR_STEPS.length - 1 ? 'Reiniciar 🔄' : 'Siguiente ▶';

            // Activar ajustes de simulación Three.js
            if (typeof setCameraPreset === 'function') setCameraPreset(step.presetCam);
            if (typeof updateTimeScale === 'function') {
                const timeSlider = document.getElementById('slider-time-scale');
                if (timeSlider) timeSlider.value = step.timeScale;
                updateTimeScale(step.timeScale);
            }
            if (typeof updateAngle === 'function') {
                const incSlider = document.getElementById('slider-inc-moon');
                if (incSlider) incSlider.value = step.incMoon;
                updateAngle('incMoon', step.incMoon);
            }
            if (typeof toggleHelper === 'function') {
                const chkOrbits = document.getElementById('check-show-orbits');
                if (chkOrbits) { chkOrbits.checked = step.showOrbits; toggleHelper('orbits', step.showOrbits); }
                const chkNodes = document.getElementById('check-precession-moon');
                if (chkNodes) { chkNodes.checked = step.showNodes; toggleHelper('precessionMoon', step.showNodes); }
            }

            if (stepIdx === 3) {
                sarosStartDays = states.days;
                const badgeEl = document.getElementById('saros-coincidence-badge');
                if (badgeEl) badgeEl.style.display = 'none';
            } else if (stepIdx === 4) {
                exeligmosStartDays = states.days;
            }
            updateSarosWidget();
            updateExeligmosWidget();
        }

        // ═════════════════════════════════════════════════════════════════════════════
        // WIDGET TELEMETRÍA DE RESONANCIA DE SAROS (PASO 4)
        // ═════════════════════════════════════════════════════════════════════════════
        let sarosStartDays = 0;

        function updateSarosWidget() {
            if (currentTourStep !== 3 || !isTourActive || !isTourPanelOpen) {
                const widget = document.getElementById('saros-widget');
                if (widget) widget.style.display = 'none';
                return;
            }

            let widget = document.getElementById('saros-widget');
            if (!widget) {
                const contentBox = document.getElementById('tour-content-box');
                if (!contentBox) return;
                widget = document.createElement('div');
                widget.id = 'saros-widget';
                widget.style.cssText = 'margin-top: 14px; padding: 12px; background: rgba(10, 14, 22, 0.85); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 10px; font-family: "Plus Jakarta Sans", sans-serif;';
                widget.innerHTML = `
                    <div style="margin-bottom: 4px;">
                        <button id="btn-fast-saros" class="btn btn-primary" style="width: 100%; font-size: 0.82rem; font-weight: 700; padding: 8px 12px; border-radius: 8px; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer;" onclick="fastForwardSaros()">
                            <i class="fa-solid fa-bolt"></i> Simular Saros (18a 11d 8h)
                        </button>
                    </div>
                    <div id="saros-coincidence-badge" style="display: none; margin-top: 10px; padding: 8px 10px; background: rgba(52, 211, 153, 0.18); border: 1px solid #34d399; border-radius: 8px; text-align: center; color: #34d399; font-weight: 700; font-size: 0.82rem; line-height: 1.35; box-shadow: 0 0 12px rgba(52, 211, 153, 0.25);">
                        <div><i class="fa-solid fa-circle-check"></i> ¡1 CICLO SAROS COMPLETADO!</div>
                        <div style="font-weight: 500; font-size: 0.74rem; color: #cbd5e1; margin-top: 3px;">+223 Sinódicos ≈ +242 Draconíticos ≈ +239 Anomalísticos.<br><span style="color: #67e8f9;">Simulación pausada para comprobar los marcadores.</span></div>
                    </div>
                `;
                contentBox.appendChild(widget);
            }
            widget.style.display = 'block';
        }

        function fastForwardSaros() {
            const SAROS_DAYS = 6585.32135; // 18 años, 11 días, 7.7 horas (223 meses sinódicos exactos)
            const deltaYears = SAROS_DAYS / 365.24219;
            const deltaAngleEarth = deltaYears * Math.PI * 2;
            
            // Avanzar el sistema orbital por la resonancia armónica de Saros:
            // 1 Saros = 223 meses Sinódicos ≈ 242 meses Draconíticos ≈ 239 meses Anomalísticos
            states.orbitEarth += deltaAngleEarth;
            states.orbitMoon += 239 * Math.PI * 2;
            states.precessionMoon -= (deltaYears / 18.61) * Math.PI * 2;
            states.apsidesMoon += (deltaYears / 8.8504 + deltaYears / 18.61) * Math.PI * 2;
            
            // En 1 Saros (8h sobrantes), la rotación diurna terrestre se desplaza 1/3 de vuelta (120° al Oeste)
            states.rotEarth += deltaAngleEarth + (1 / 3) * Math.PI * 2;
            
            states.days += Math.floor(SAROS_DAYS);
            
            // Pausar la simulación para permitir inspeccionar los marcadores con calma
            if (isPlaying) {
                togglePlay();
            }
            
            updatePositionsAndTilts();
            
            const badgeEl = document.getElementById('saros-coincidence-badge');
            if (badgeEl) {
                badgeEl.style.display = 'block';
            }
        }

        // ═════════════════════════════════════════════════════════════════════════════
        // WIDGET TELEMETRÍA DE RESONANCIA DE EXELIGMOS / TRISAROS (PASO 5)
        // ═════════════════════════════════════════════════════════════════════════════
        let exeligmosStartDays = 0;

        function updateExeligmosWidget() {
            if (currentTourStep !== 4 || !isTourActive || !isTourPanelOpen) {
                const widget = document.getElementById('exeligmos-widget');
                if (widget) widget.style.display = 'none';
                return;
            }

            let widget = document.getElementById('exeligmos-widget');
            if (!widget) {
                const contentBox = document.getElementById('tour-content-box');
                if (!contentBox) return;
                widget = document.createElement('div');
                widget.id = 'exeligmos-widget';
                widget.style.cssText = 'margin-top: 14px; padding: 12px; background: rgba(18, 12, 28, 0.85); border: 1px solid rgba(168, 85, 247, 0.4); border-radius: 10px; font-family: "Plus Jakarta Sans", sans-serif;';
                widget.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <span style="font-size: 0.82rem; font-weight: 600; color: #cbd5e1;">Meses Sinódicos:</span>
                        <span id="exeligmos-count-num" style="font-size: 0.92rem; font-weight: 700; color: #c084fc;">0 / 669</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <span style="font-size: 0.78rem; font-weight: 600; color: #94a3b8;">Ciclos Saros completados:</span>
                        <span id="exeligmos-saros-num" style="font-size: 0.82rem; font-weight: 700; color: #fef08a;">0 / 3 Saros</span>
                    </div>
                    <div style="width: 100%; height: 8px; background: rgba(255, 255, 255, 0.08); border-radius: 4px; overflow: hidden; margin-bottom: 10px;">
                        <div id="exeligmos-progress-fill" style="width: 0%; height: 100%; background: linear-gradient(90deg, #c084fc, #38bdf8, #fef08a); transition: width 0.1s linear;"></div>
                    </div>
                    <div style="margin-bottom: 6px;">
                        <button id="btn-fast-exeligmos" class="btn" style="width: 100%; font-size: 0.78rem; padding: 6px 12px; border-radius: 6px; background: rgba(168, 85, 247, 0.2); border: 1px solid #a855f7; color: #e9d5ff; font-weight: 700; cursor: pointer;" onclick="fastForwardExeligmos()">⚡ Simular Exeligmos (54a 33d)</button>
                    </div>
                    <div id="exeligmos-coincidence-badge" style="display: none; margin-top: 10px; padding: 8px 10px; background: rgba(168, 85, 247, 0.22); border: 1px solid #a855f7; border-radius: 8px; text-align: center; color: #f3e8ff; font-weight: 700; font-size: 0.84rem; box-shadow: 0 0 14px rgba(168, 85, 247, 0.35);">
                        ¡GRAN RESONANCIA DE EXELIGMOS ALCANZADA!
                        <div style="font-weight: 500; font-size: 0.74rem; color: #cbd5e1; margin-top: 3px;">Misma hora local y misma longitud geográfica en la Tierra</div>
                    </div>
                `;
                contentBox.appendChild(widget);
            }
            widget.style.display = 'block';

            const elapsedDays = Math.max(0, states.days - exeligmosStartDays);
            const synodicCount = Math.floor(elapsedDays / 29.53059);
            const sarosCount = Math.min(3, Math.floor(synodicCount / 223));
            const pct = Math.min(100, Math.floor((synodicCount / 669) * 100));

            const countNumEl = document.getElementById('exeligmos-count-num');
            if (countNumEl) countNumEl.innerText = `${synodicCount} / 669 (${pct}%)`;

            const sarosNumEl = document.getElementById('exeligmos-saros-num');
            if (sarosNumEl) sarosNumEl.innerText = `${sarosCount} / 3 Saros`;

            const fillEl = document.getElementById('exeligmos-progress-fill');
            if (fillEl) fillEl.style.width = `${pct}%`;

            const badgeEl = document.getElementById('exeligmos-coincidence-badge');
            if (badgeEl) {
                badgeEl.style.display = synodicCount >= 669 ? 'block' : 'none';
            }
        }

        function fastForwardExeligmos() {
            const EXELIGMOS_DAYS = 3 * 6585.32135; // 54 años, 33 días (669 meses sinódicos exactos = 3 Saros)
            const deltaYears = EXELIGMOS_DAYS / 365.24219;
            const deltaAngleEarth = deltaYears * Math.PI * 2;
            
            // Avanzar el sistema orbital por la gran resonancia entera exacta de Exeligmos (3 Saros):
            // +669 meses Sinódicos, +726 meses Draconíticos, +717 meses Anomalísticos
            states.orbitEarth += deltaAngleEarth;
            states.orbitMoon += 717 * Math.PI * 2;
            states.precessionMoon -= (deltaYears / 18.61) * Math.PI * 2;
            states.apsidesMoon += (deltaYears / 8.8504 + deltaYears / 18.61) * Math.PI * 2;
            
            // Giro diurno de la Tierra: En 3 Saros (1 Exeligmos), 3 x (1/3 de vuelta) = 1 vuelta entera (360° = 0° desplazamiento relativo)
            // La rotación de la Tierra vuelve a presentar la EXACTA MATEIXA cara/longitud geográfica de cara al Sol/Luna
            states.rotEarth += deltaAngleEarth;
            
            states.days += Math.floor(EXELIGMOS_DAYS);
            
            // Establecer el nuevo día actual como la base para el siguiente Exeligmos
            exeligmosStartDays = states.days;
            
            if (isPlaying) {
                togglePlay();
            }
            
            updatePositionsAndTilts();
            updateExeligmosWidget();
        }

        function navigateTour(direction) {
            let nextStep = currentTourStep + direction;
            if (nextStep < 0) nextStep = 0;
            if (nextStep >= TOUR_STEPS.length) nextStep = 0;
            applyTourStep(nextStep);
        }

// Exposición en ámbito global window para compatibilidad file:/// y desacoplamiento
if (typeof window !== 'undefined') {
    window.addLogEntry = addLogEntry;
    window.clearEventLog = clearEventLog;
    window.togglePlay = togglePlay;
    window.updateTimeScale = updateTimeScale;
    window.updateSpeed = updateSpeed;
    window.toggleTidalLock = toggleTidalLock;
    window.updateAngle = updateAngle;
    window.toggleHelper = toggleHelper;
    window.updateNutationAmplitude = updateNutationAmplitude;
    window.updateStarBrightness = updateStarBrightness;
    window.updateGridBrightness = updateGridBrightness;
    window.resetSimulation = resetSimulation;
    window.toggleHelp = toggleHelp;
    window.openLeftPanel = openLeftPanel;
    window.closeLeftPanel = closeLeftPanel;
    window.openRightPanel = openRightPanel;
    window.closeRightPanel = closeRightPanel;
    window.togglePanel = togglePanel;
    window.toggleEventLog = toggleEventLog;
    window.closeEventLog = closeEventLog;
    window.uncollapsePrecessionSection = uncollapsePrecessionSection;
    window.toggleTourPanel = toggleTourPanel;
    window.setTourActive = setTourActive;
    window.applyTourStep = applyTourStep;
    window.navigateTour = navigateTour;
    window.updateSarosWidget = updateSarosWidget;
    window.fastForwardSaros = fastForwardSaros;
    window.updateExeligmosWidget = updateExeligmosWidget;
    window.fastForwardExeligmos = fastForwardExeligmos;
}
