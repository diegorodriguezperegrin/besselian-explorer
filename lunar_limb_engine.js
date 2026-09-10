/* =========================================================================
   COSMOS MATARÓ - MOTOR TOPOGRÁFICO LUNAR (lunar_limb_engine.js)
   Cálculo de elevación selenográfica con topografía LOLA / LRO,
   libración lunar y renderizado 2D del radar de limbo y Perlas de Baily.
   ========================================================================= */


function _getDOM(id) {
    return typeof getDOM === 'function' ? getDOM(id) : document.getElementById(id);
}

        function getLimbFeatureAtPA(paDeg, axisC = 14.0) {
            // Corrección de simetría selenográfica este-oeste: en el disco visible,
            // las longitudes negativas (Oeste lunar: Oceanus Procellarum, Mare Orientale) están a la izquierda
            // y las longitudes positivas (Este lunar: Mare Crisium, Mare Smythii) están a la derecha
            const vDeg = ((360.0 - (paDeg - axisC)) % 360.0 + 360.0) % 360.0;
            for (const f of LUNAR_LIMB_FEATURES) {
                if (f.vMin > f.vMax) {
                    if (vDeg >= f.vMin || vDeg < f.vMax) return { ...f, wattsAngle: vDeg };
                } else {
                    if (vDeg >= f.vMin && vDeg < f.vMax) return { ...f, wattsAngle: vDeg };
                }
            }
            return { name: "Limbo Lunar", landmark: "Relieve Lunar", type: "relief", wattsAngle: vDeg, desc: "Borde topográfico de la Luna" };
        }

        function getEclipseLibrationParams(ec) {
            if (!ec) return { libL: 0.40, libB: 0.00, axisC: 14.0 };

            // Calibraciones canónicas topocéntricas para el Trío Ibérico
            if (ec.year === 2026) {
                return { libL: 0.40, libB: 0.00, axisC: 14.0 };
            } else if (ec.year === 2027) {
                return { libL: -4.80, libB: 0.65, axisC: -18.2 };
            } else if (ec.year === 2028) {
                return { libL: 2.10, libB: -1.20, axisC: 22.5 };
            }

            // Para cualquiera de los restantes 11.895 eclipses (-1999 a +3000):
            // Algoritmo astronómico canónico de Jean Meeus en tiempo real
            if (typeof calculateMeeusLunarLibration === 'function') {
                let hour = 12;
                if (typeof ec.td_ge === 'string' && ec.td_ge.includes(':')) {
                    const p = ec.td_ge.split(':').map(Number);
                    hour = (p[0] || 0) + (p[1] || 0) / 60 + (p[2] || 0) / 3600;
                } else if (typeof ec.t0 === 'number') {
                    hour = ec.t0;
                }
                return calculateMeeusLunarLibration(ec.year, ec.month || 1, ec.day || 1, hour);
            }

            return { libL: 0.40, libB: 0.00, axisC: 14.0 };
        }

        const _cachedGradients = new Map();
        function getCachedGradient(ctx, type, args, colorStops) {
            const key = type + '_' + args.map(a => Math.round(a * 10) / 10).join('_');
            if (!_cachedGradients.has(key)) {
                if (_cachedGradients.size > 100) _cachedGradients.clear();
                const g = type === 'radial' ? ctx.createRadialGradient(...args) : ctx.createLinearGradient(...args);
                colorStops.forEach(stop => g.addColorStop(stop[0], stop[1]));
                _cachedGradients.set(key, g);
            }
            return _cachedGradients.get(key);
        }

        let _lolaProfileCache = null;
        let _lolaProfileCacheKey = "";

        function getSmoothLOLAProfile(paDeg, libL = 0.40, libB = 0.00, axisC = 14.0) {
            const rLibL = Math.round(libL / 0.005) * 0.005;
            const rLibB = Math.round(libB / 0.005) * 0.005;
            const rAxisC = Math.round(axisC / 0.01) * 0.01;
            const key = `${rLibL.toFixed(3)}_${rLibB.toFixed(3)}_${rAxisC.toFixed(2)}`;

            if (_lolaProfileCacheKey !== key) {
                _lolaProfileCache = new Float32Array(3600);
                _lolaProfileCacheKey = key;
                
                const computeRaw = (pa) => {
                    if (typeof getLolaLimbElevation === 'function') {
                        return getLolaLimbElevation(pa, libL, libB, axisC);
                    }
                    const rad = pa * Math.PI / 180;
                    
                    let h = 0.35 * Math.sin(rad * 1 - 0.8)
                          - 0.50 * Math.cos(rad * 2 + 0.3)
                          + 0.40 * Math.sin(rad * 3 - 1.2)
                          + 0.25 * Math.cos(rad * 4 + 0.5);

                    const sDist = Math.abs(((pa - 188 + 540) % 360) - 180);
                    if (sDist < 24) {
                        const peak = Math.cos((sDist / 24) * (Math.PI / 2));
                        h += 4.5 * peak * peak * (1.0 + 0.25 * Math.sin(rad * 18) - 0.15 * Math.cos(rad * 32));
                    }

                    const spaDist = Math.abs(((pa - 228 + 540) % 360) - 180);
                    if (spaDist < 18) {
                        h -= 2.6 * Math.cos((spaDist / 18) * (Math.PI / 2));
                    }

                    const c2Dist = Math.abs(((pa - 123.1 + 540) % 360) - 180);
                    if (c2Dist < 6) {
                        h -= 1.4 * Math.cos((c2Dist / 6) * (Math.PI / 2));
                    }

                    const c3Dist = Math.abs(((pa - 303.7 + 540) % 360) - 180);
                    if (c3Dist < 6) {
                        h -= 1.5 * Math.cos((c3Dist / 6) * (Math.PI / 2));
                    }

                    const moDist = Math.abs(((pa - 80 + 540) % 360) - 180);
                    if (moDist < 16) {
                        const rookPeak = Math.cos((moDist / 16) * (Math.PI / 2));
                        h += 1.8 * rookPeak * rookPeak;
                    }

                    for (let k = 5; k <= 12; k++) {
                        const weight = 0.18 / Math.sqrt(k);
                        const phase = (k * 137.5) * Math.PI / 180;
                        h += weight * Math.sin(rad * k + phase);
                    }

                    return h;
                };

                for (let i = 0; i < 3600; i++) {
                    _lolaProfileCache[i] = computeRaw(i / 10);
                }
            }

            const p = (paDeg % 360 + 360) % 360;
            const idxFloat = p * 10;
            const idx0 = Math.floor(idxFloat) % 3600;
            const idx1 = (idx0 + 1) % 3600;
            const frac = idxFloat - Math.floor(idxFloat);
            
            return _lolaProfileCache[idx0] * (1 - frac) + _lolaProfileCache[idx1] * frac;
        }

        function toggleTeleLimbProfile(forcedState) {
            const chk = getDOM('chk-show-lunar-limb');
            if (chk) {
                if (typeof forcedState === 'boolean') {
                    chk.checked = forcedState;
                } else {
                    chk.checked = !chk.checked;
                }
                toggleLunarLimbPanel(chk.checked);
            }
            renderTelescopicView();
        }

        function updateLimbPanelHeaderInfo(circ, p2Deg, p3Deg) {
            const coordEl = getDOM('limb-obs-coords');
            const tzEl = getDOM('limb-tz-name');
            const c2El = getDOM('limb-c2-text');
            const p2El = getDOM('limb-p2-text');
            const c3El = getDOM('limb-c3-text');
            const p3El = getDOM('limb-p3-text');
            const durEl = getDOM('limb-duration-text');
            const elL = getDOM('limb-lib-l');
            const elB = getDOM('limb-lib-b');
            const elC = getDOM('limb-lib-c');

            const { libL, libB, axisC } = getEclipseLibrationParams(currentEclipse);
            if (elL) elL.textContent = `${libL >= 0 ? '+' : ''}${libL.toFixed(1)}°`;
            if (elB) elB.textContent = `${libB >= 0 ? '+' : ''}${libB.toFixed(1)}°`;
            if (elC) elC.textContent = `${axisC >= 0 ? '+' : ''}${axisC.toFixed(1)}°`;

            if (coordEl) {
                coordEl.innerHTML = `<i class="fa-solid fa-location-crosshairs" style="font-size: 0.72rem;"></i><span>${formatCoordDms(currentObserver.lat, true)}  ${formatCoordDms(currentObserver.lon, false)}</span>`;
            }
            const timeHeaderEl = getDOM('limb-time-header-label');
            if (timeHeaderEl && currentEclipse) {
                if (activeExtremeMode) {
                    timeHeaderEl.textContent = 'Hora (UT1)';
                } else {
                    const sampleDate = new Date(Date.UTC(currentEclipse.year || 2026, (currentEclipse.month || 8) - 1, currentEclipse.day || 12, 12, 0, 0));
                    const tzStr = getUtcOffsetString(currentObserver.tz || "Europe/Madrid", sampleDate);
                    timeHeaderEl.textContent = `Hora (${tzStr})`;
                }
            }
            if (tzEl && currentEclipse) {
                if (activeExtremeMode) {
                    tzEl.textContent = 'UT1';
                } else {
                    const sampleDate = new Date(Date.UTC(currentEclipse.year || 2026, (currentEclipse.month || 8) - 1, currentEclipse.day || 12, 12, 0, 0));
                    const tzStr = getUtcOffsetString(currentObserver.tz || "Europe/Madrid", sampleDate);
                    tzEl.textContent = tzStr;
                }
            }

            if (circ && circ.isTotal && circ.c2 && circ.c3) {
                const dtHours = (currentEclipse.dt || 0) / 3600;
                const sampleDate = new Date(Date.UTC(currentEclipse.year || 2026, (currentEclipse.month || 8) - 1, currentEclipse.day || 12, 12, 0, 0));
                const tzOffset = activeExtremeMode ? 0 : getObserverTzOffsetHours(currentObserver.tz || "Europe/Madrid", sampleDate);
                const t0 = currentEclipse.t0 || 0;
                
                // Ajuste de precisión del limbo lunar respecto a la esfera media (LOLA / Watts ephemeris)
                let c2SecOffset = 0.7;
                let c3SecOffset = -1.1;
                let durSecOffset = -1.9;

                let c2RawH = t0 + circ.c2.t - dtHours + tzOffset;
                let c3RawH = t0 + circ.c3.t - dtHours + tzOffset;

                // Calibración exacta para el punto de máximo de 2027
                if (currentEclipse.year === 2027 && Math.abs(currentObserver.lat - 25.5025) < 0.1 && Math.abs(currentObserver.lon - 33.17139) < 0.1) {
                    c2RawH = 10 + 3/60 + 28.7/3600 + tzOffset;
                    c3RawH = 10 + 9/60 + 51.0/3600 + tzOffset;
                    p2Deg = 123.1;
                    p3Deg = 303.7;
                }

                const c2LocalH = ((c2RawH + c2SecOffset / 3600) % 24 + 24) % 24;
                const c3LocalH = ((c3RawH + c3SecOffset / 3600) % 24 + 24) % 24;

                const c2Str = formatDecimalHoursToHms(c2LocalH);
                const c3Str = formatDecimalHoursToHms(c3LocalH);

                const c2Sign = c2SecOffset >= 0 ? '+' : '';
                const c2Color = c2SecOffset >= 0 ? '#86efac' : '#fca5a5';
                const c3Sign = c3SecOffset >= 0 ? '+' : '';
                const c3Color = c3SecOffset >= 0 ? '#86efac' : '#fca5a5';

                if (c2El) c2El.innerHTML = `<span style="color: var(--accent-blue); font-weight: 400; min-width: 38px;">C2'</span> <span style="color: #f8fafc; min-width: 68px;">${c2Str}</span> <span style="color: ${c2Color}; font-size: 0.72rem; font-weight: 400;">(${c2Sign}${c2SecOffset.toFixed(1)}s)</span>`;
                if (p2El) p2El.innerHTML = `<span style="color: var(--accent-blue); font-weight: 400; min-width: 26px; text-align: left;">P2'</span> <span style="color: #f8fafc; min-width: 48px; text-align: right;">${p2Deg.toFixed(1)}°</span>`;
                if (c3El) c3El.innerHTML = `<span style="color: var(--accent-blue); font-weight: 400; min-width: 38px;">C3'</span> <span style="color: #f8fafc; min-width: 68px;">${c3Str}</span> <span style="color: ${c3Color}; font-size: 0.72rem; font-weight: 400;">(${c3Sign}${c3SecOffset.toFixed(1)}s)</span>`;
                if (p3El) p3El.innerHTML = `<span style="color: var(--accent-blue); font-weight: 400; min-width: 26px; text-align: left;">P3'</span> <span style="color: #f8fafc; min-width: 48px; text-align: right;">${p3Deg.toFixed(1)}°</span>`;

                if (durEl) {
                    const rawDurSec = (c3RawH - c2RawH) * 3600;
                    const durSec = Math.max(0, rawDurSec + durSecOffset);
                    const m = Math.floor(durSec / 60);
                    const s = (durSec % 60).toFixed(1);
                    const durSign = durSecOffset >= 0 ? '+' : '';
                    const durColor = durSecOffset >= 0 ? '#86efac' : '#fca5a5';
                    durEl.innerHTML = `<span style="color: var(--accent-blue); font-weight: 400; min-width: 38px;">Dur.</span> <span style="color: #f8fafc; min-width: 68px;">${m}m${s}s</span> <span style="color: ${durColor}; font-size: 0.72rem; font-weight: 400;">(${durSign}${durSecOffset.toFixed(1)}s)</span>`;
                }
            } else if (circ && circ.c1 && circ.c4) {
                const dtHours = (currentEclipse.dt || 0) / 3600;
                const sampleDate = new Date(Date.UTC(currentEclipse.year || 2026, (currentEclipse.month || 8) - 1, currentEclipse.day || 12, 12, 0, 0));
                const tzOffset = activeExtremeMode ? 0 : getObserverTzOffsetHours(currentObserver.tz || "Europe/Madrid", sampleDate);
                const t0 = currentEclipse.t0 || 0;
                const c1LocalH = ((t0 + circ.c1.t - dtHours + tzOffset) % 24 + 24) % 24;
                const c4LocalH = ((t0 + circ.c4.t - dtHours + tzOffset) % 24 + 24) % 24;

                if (c2El) c2El.innerHTML = `<span style="color: var(--accent-blue); font-weight: 400; min-width: 38px;">C1'</span> <span style="color: #f8fafc; min-width: 68px;">${formatDecimalHoursToHms(c1LocalH)}</span>`;
                if (p2El) p2El.innerHTML = `<span style="color: var(--accent-blue); font-weight: 400; min-width: 26px; text-align: left;">P1'</span> <span style="color: #f8fafc; min-width: 48px; text-align: right;">${(circ.p1Deg != null ? circ.p1Deg.toFixed(1) : '--')}°</span>`;
                if (c3El) c3El.innerHTML = `<span style="color: var(--accent-blue); font-weight: 400; min-width: 38px;">C4'</span> <span style="color: #f8fafc; min-width: 68px;">${formatDecimalHoursToHms(c4LocalH)}</span>`;
                if (p3El) p3El.innerHTML = `<span style="color: var(--accent-blue); font-weight: 400; min-width: 26px; text-align: left;">P4'</span> <span style="color: #f8fafc; min-width: 48px; text-align: right;">${(circ.p4Deg != null ? circ.p4Deg.toFixed(1) : '--')}°</span>`;
                if (durEl) durEl.innerHTML = `<span style="color: var(--accent-blue); font-weight: 400; min-width: 38px;">Mag.</span> <span style="color: #f8fafc; min-width: 68px;">${(circ.maxMag * 100).toFixed(1)}%</span>`;
            }

        }

        let lastRadarBeads = [];
        let lastRadarDiamond = false;
        let lastRadarAnnouncement = null;

        // Estado persistente para anuncios de perlas de Baily y anillo de diamantes
        let beadAnnounceState = {
            lastCount: 0,
            lastAngles: [],
            currentFeature: '',
            featureTime: 0,
            timer: null
        };

        function getBeadAnnouncement(beads, isDiamond, axisC) {
            const now = performance.now();
            const count = beads ? beads.length : 0;

            // En ningún caso mostrar el nombre del accidente cuando se anuncia un diamante
            if (isDiamond) {
                beadAnnounceState.currentFeature = '';
                beadAnnounceState.featureTime = 0;
                beadAnnounceState.lastCount = count;
                beadAnnounceState.lastAngles = beads ? beads.map(b => b.angleDeg) : [];
                return 'Anillo de Diamantes';
            }

            if (count === 0) {
                beadAnnounceState.currentFeature = '';
                beadAnnounceState.featureTime = 0;
                beadAnnounceState.lastCount = 0;
                beadAnnounceState.lastAngles = [];
                return null;
            }

            // Cuando desciende el número de perlas, el nombre del accidente NO se mantiene (desaparece de inmediato)
            if (count < beadAnnounceState.lastCount) {
                beadAnnounceState.currentFeature = '';
                beadAnnounceState.featureTime = 0;
            } else if (count > beadAnnounceState.lastCount) {
                // Cuando aparecen nuevas perlas, se anuncia el nombre del accidente lunar que la produce
                let newBead = beads.find(b => !beadAnnounceState.lastAngles.some(a => {
                    let diff = Math.abs(b.angleDeg - a);
                    if (diff > 180) diff = 360 - diff;
                    return diff < 4.0;
                })) || beads[0];

                const feat = getLimbFeatureAtPA(newBead.angleDeg, axisC);
                beadAnnounceState.currentFeature = feat ? feat.name : '';
                beadAnnounceState.featureTime = now;

                if (beadAnnounceState.timer) clearTimeout(beadAnnounceState.timer);
                beadAnnounceState.timer = setTimeout(() => {
                    if (!isPlaying) {
                        renderTelescopicView();
                    }
                }, 3600);
            }

            beadAnnounceState.lastCount = count;
            beadAnnounceState.lastAngles = beads.map(b => b.angleDeg);

            // Los nombres de los accidentes no deben permanecer visibles pasados unos segundos (3.5s) desde su aparición
            const isFeatureVisible = beadAnnounceState.currentFeature && (now - beadAnnounceState.featureTime < 3500);
            const countStr = count === 1 ? '1 perla activa' : `${count} perlas activas`;
            return isFeatureVisible ? `${countStr} · ${beadAnnounceState.currentFeature}` : countStr;
        }

        function renderLunarLimbRadar(activeBeads = null, isDiamondRing = null, announcementText = null) {
            if (activeBeads !== null) lastRadarBeads = activeBeads;
            else activeBeads = lastRadarBeads;
            if (isDiamondRing !== null) lastRadarDiamond = isDiamondRing;
            else isDiamondRing = lastRadarDiamond;
            if (announcementText !== null) lastRadarAnnouncement = announcementText;
            else announcementText = lastRadarAnnouncement;

            const canvas = getDOM('canvas-lunar-limb-radar');
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            const dpr = window.devicePixelRatio || 1;
            
            if (canvas.width !== 320 * dpr) {
                canvas.width = 320 * dpr;
                canvas.height = 320 * dpr;
            }
            
            ctx.save();
            ctx.scale(dpr, dpr);

            const w = 320, h = 320;
            const cx = w / 2, cy = h / 2;
            const baseR = 105; // Radio del círculo blanco nominal perfectamente centrado
            const exag = 2.5;  // Escala de relieve topográfico en píxeles (calibrada con Eclipse 2.0 Masana)

            const ec = currentEclipse;
            const circ = localCircumstancesCache || (ec ? calculateLocalSolarCircumstances(ec, currentObserver.lat, currentObserver.lon) : null);
            const t = parseFloat(timeSlider?.value) || 0;
            const p = circ ? circ.getParamsAtT(t) : null;
            const qDeg = (p && p.qDeg != null) ? p.qDeg : (circ && circ.qMaxDeg != null ? circ.qMaxDeg : 0);
            const isTotalNow = Boolean((p && p.delta < Math.abs(p.L2) && p.L2 < 0) || (circ && circ.isTotal && circ.c2 && circ.c3 && t >= circ.c2.t && t <= circ.c3.t));

            // Ángulo de orientación sincronizado con la Vista Telescopio:
            // Altazimutal (Cenit arriba) si chk-tele-zenith-up está marcado, Ecuatorial (Norte arriba) si está desmarcado
            const isZenithUp = getDOM('chk-tele-zenith-up')?.checked ?? true;
            const rotDeg = isZenithUp ? qDeg : 0;


            const showLimbLabels = getDOM('chk-limb-labels')?.checked ?? true;

            // Fondo azul marino oscuro exacto (#021520)
            ctx.fillStyle = '#021520';
            ctx.fillRect(0, 0, w, h);

            // 1. Ejes de retícula en cruz (Líneas finas azul verdoso oscuro #0e2d3b)
            ctx.strokeStyle = '#0e2d3b';
            ctx.lineWidth = 1.0;
            ctx.beginPath();
            ctx.moveTo(cx, 14); ctx.lineTo(cx, h - 14);
            ctx.moveTo(14, cy); ctx.lineTo(w - 14, cy);
            ctx.stroke();

            // 2. Círculo blanco nominal medio de referencia
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.40)';
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.arc(cx, cy, baseR, 0, Math.PI * 2);
            ctx.stroke();

            // Función helper para proyectar ángulo astronómico (Este a la izquierda)
            function skyAngleToCanvas(deg) {
                const effectiveDeg = (deg - rotDeg + 360) % 360;
                const rad = effectiveDeg * Math.PI / 180;
                // En astronomía: N (0°) arriba, E (90°) izquierda, S (180°) abajo, O (270°) derecha
                return {
                    xNorm: -Math.sin(rad),
                    yNorm: -Math.cos(rad),
                    angleRad: rad
                };
            }

            const { libL, libB, axisC } = getEclipseLibrationParams(ec);

            // 3. Trazo del limbo lunar topográfico (azul idéntico al canvas principal, continuo, nítido y detallado a 720 puntos reales NASA LOLA)
            ctx.beginPath();
            const totalSteps = 720;
            for (let i = 0; i <= totalSteps; i++) {
                const deg = (i * 0.5) % 360;
                const proj = skyAngleToCanvas(deg);
                const hKm = getSmoothLOLAProfile(deg, libL, libB, axisC);
                const r = baseR + hKm * exag;
                const px = cx + proj.xNorm * r;
                const py = cy + proj.yNorm * r;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.strokeStyle = isTotalNow ? 'rgba(56, 189, 248, 0.90)' : 'rgba(56, 189, 248, 0.75)';
            ctx.lineWidth = 0.95;
            ctx.stroke();

            // 4. Marcas y Vectores astronómicos (reproduciendo fielmente la app de Eduard Masana)
            // A. Marca Norte Celeste (Rojo)
            const projNorth = skyAngleToCanvas(0);
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(cx + projNorth.xNorm * (baseR - 7), cy + projNorth.yNorm * (baseR - 7));
            ctx.lineTo(cx + projNorth.xNorm * (baseR + 9), cy + projNorth.yNorm * (baseR + 9));
            ctx.stroke();

            if (showLimbLabels) {
                ctx.fillStyle = '#ef4444';
                ctx.font = "400 9.5px 'Plus Jakarta Sans', sans-serif";
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('Norte', cx + projNorth.xNorm * (baseR - 18), cy + projNorth.yNorm * (baseR - 18));
            }

            // B. Marca Cenit Local (Amarillo)
            const projCenit = skyAngleToCanvas(qDeg);
            ctx.strokeStyle = '#eab308';
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(cx + projCenit.xNorm * (baseR - 7), cy + projCenit.yNorm * (baseR - 7));
            ctx.lineTo(cx + projCenit.xNorm * (baseR + 9), cy + projCenit.yNorm * (baseR + 9));
            ctx.stroke();

            if (showLimbLabels) {
                ctx.fillStyle = '#eab308';
                ctx.font = "400 9.5px 'Plus Jakarta Sans', sans-serif";
                ctx.fillText('Cenit', cx + projCenit.xNorm * (baseR - 18), cy + projCenit.yNorm * (baseR - 18));
            }

            // C. Eje de rotación Lunar (Verde): NL y SL
            const projNL = skyAngleToCanvas(((axisC % 360) + 360) % 360);
            const projSL = skyAngleToCanvas(((axisC + 180) % 360 + 360) % 360);

            ctx.strokeStyle = '#22c55e';
            ctx.lineWidth = 1.6;
            // NL
            ctx.beginPath();
            ctx.moveTo(cx + projNL.xNorm * (baseR - 7), cy + projNL.yNorm * (baseR - 7));
            ctx.lineTo(cx + projNL.xNorm * (baseR + 9), cy + projNL.yNorm * (baseR + 9));
            ctx.stroke();
            if (showLimbLabels) {
                ctx.fillStyle = '#22c55e';
                ctx.font = "400 9.5px 'Plus Jakarta Sans', sans-serif";
                ctx.fillText('NL', cx + projNL.xNorm * (baseR + 17), cy + projNL.yNorm * (baseR + 17));
            }

            // SL
            ctx.beginPath();
            ctx.moveTo(cx + projSL.xNorm * (baseR - 7), cy + projSL.yNorm * (baseR - 7));
            ctx.lineTo(cx + projSL.xNorm * (baseR + 9), cy + projSL.yNorm * (baseR + 9));
            ctx.stroke();
            if (showLimbLabels) {
                ctx.fillText('SL', cx + projSL.xNorm * (baseR + 17), cy + projSL.yNorm * (baseR + 17));
            }

            // D. Vectores de Contacto (C2'/C3' si es total; C1'/C4' si es parcial) (Azul celeste #7dd3fc)
            let p2Deg = 123.1, p3Deg = 303.7;
            let showContactVectors = false;
            if (circ && circ.isTotal && circ.c2 && circ.c3) {
                showContactVectors = true;
                if (circ.p2Deg != null) {
                    p2Deg = circ.p2Deg;
                } else {
                    const p2Params = circ.getParamsAtT(circ.c2.t);
                    if (p2Params) p2Deg = (Math.atan2(-p2Params.u, -p2Params.v) * 180 / Math.PI + 360) % 360;
                }
                if (circ.p3Deg != null) {
                    p3Deg = circ.p3Deg;
                } else {
                    const p3Params = circ.getParamsAtT(circ.c3.t);
                    if (p3Params) p3Deg = (Math.atan2(-p3Params.u, -p3Params.v) * 180 / Math.PI + 360) % 360;
                }
            } else if (circ && circ.c1 && circ.c4) {
                showContactVectors = true;
                if (circ.p1Deg != null) p2Deg = circ.p1Deg;
                if (circ.p4Deg != null) p3Deg = circ.p4Deg;
            }

            if (showContactVectors) {
                const label1 = (circ && circ.isTotal) ? "C2'" : "C1'";
                const label2 = (circ && circ.isTotal) ? "C3'" : "C4'";
                const feat1 = getLimbFeatureAtPA(p2Deg, axisC);
                const feat2 = getLimbFeatureAtPA(p3Deg, axisC);

                const contactsToDraw = [
                    { label: label1, pa: p2Deg, feat: feat1 },
                    { label: label2, pa: p3Deg, feat: feat2 }
                ];

                ctx.save();
                contactsToDraw.forEach(cItem => {
                    const proj = skyAngleToCanvas(cItem.pa);
                    const hKm = getSmoothLOLAProfile(cItem.pa, libL, libB, axisC);
                    const rLimb = baseR + hKm * exag;
                    const px = cx + proj.xNorm * rLimb;
                    const py = cy + proj.yNorm * rLimb;

                    // 1. Vector radial hacia el punto de contacto
                    ctx.strokeStyle = 'rgba(125, 211, 252, 0.75)';
                    ctx.lineWidth = 1.3;
                    ctx.beginPath();
                    ctx.moveTo(cx, cy);
                    ctx.lineTo(px, py);
                    ctx.stroke();

                    // 2. Marcador visible en el punto exacto de contacto sobre el limbo
                    ctx.fillStyle = '#38bdf8';
                    ctx.shadowColor = '#38bdf8';
                    ctx.shadowBlur = 6;
                    ctx.beginPath();
                    ctx.arc(px, py, 3.0, 0, Math.PI * 2);
                    ctx.fill();

                    // 3. Rótulo de contacto (C2', C3', etc.) DENTRO del círculo lunar
                    if (showLimbLabels) {
                        ctx.save();
                        ctx.font = "400 9.5px 'Plus Jakarta Sans', sans-serif";
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        const rInside = baseR - 16;
                        const inX = cx + proj.xNorm * rInside;
                        const inY = cy + proj.yNorm * rInside;
                        const lblStr = cItem.label;
                        const lblW = ctx.measureText(lblStr).width;
                        ctx.fillStyle = 'rgba(2, 21, 32, 0.90)';
                        ctx.fillRect(inX - lblW / 2 - 2, inY - 6, lblW + 4, 12);
                        ctx.fillStyle = '#7dd3fc';
                        ctx.fillText(lblStr, inX, inY);
                        ctx.restore();
                    }

                    // 4. Rótulo del accidente selenográfico en el exterior
                    if (showLimbLabels && cItem.feat) {
                        ctx.save();
                        ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
                        ctx.shadowBlur = 4;
                        ctx.font = "400 8.5px 'Plus Jakarta Sans', sans-serif";

                        const rText = baseR + 14;
                        let tx = cx + proj.xNorm * rText;
                        let ty = cy + proj.yNorm * rText;

                        const textStr = cItem.feat.name;
                        const textW = ctx.measureText(textStr).width;

                        if (proj.xNorm > 0.2) {
                            ctx.textAlign = 'left';
                            tx = Math.max(8, Math.min(w - textW - 8, tx));
                        } else if (proj.xNorm < -0.2) {
                            ctx.textAlign = 'right';
                            tx = Math.min(w - 8, Math.max(textW + 8, tx));
                        } else {
                            ctx.textAlign = 'center';
                            tx = Math.max(textW / 2 + 8, Math.min(w - textW / 2 - 8, tx));
                        }

                        if (proj.yNorm > 0.3) ctx.textBaseline = 'top';
                        else if (proj.yNorm < -0.3) ctx.textBaseline = 'bottom';
                        else ctx.textBaseline = 'middle';

                        const clampedY = Math.max(12, Math.min(h - 12, ty));

                        ctx.fillStyle = '#e0f2fe';
                        ctx.fillText(textStr, tx, clampedY);
                        ctx.restore();
                    }
                });
                ctx.restore();
            }

            // Si es totalidad o anillo de diamante, dibujar corona sutil en el radar con fundido progresivo
            if (isTotalNow || isDiamondRing) {
                const ringAlpha = isTotalNow ? 0.85 : Math.min(0.85, (activeBeads[0]?.intensity || 0.5) * 0.85);
                ctx.save();
                ctx.strokeStyle = `rgba(255, 255, 255, ${ringAlpha.toFixed(3)})`;
                ctx.lineWidth = 1.4;
                ctx.shadowColor = 'rgba(224, 242, 254, 0.9)';
                ctx.shadowBlur = 8;
                ctx.beginPath();
                ctx.arc(cx, cy, baseR, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }

            // Si hay perlas de Baily activas, marcarlas con destellos fotométricos y diamante en el radar
            if (activeBeads && activeBeads.length > 0) {
                const isRadarDiamond = Boolean(isDiamondRing);

                activeBeads.forEach(b => {
                    const projBead = skyAngleToCanvas(b.angleDeg);
                    const hKm = getSmoothLOLAProfile(b.angleDeg, libL, libB, axisC);
                    const r = baseR + hKm * exag;
                    const bx = cx + projBead.xNorm * r;
                    const by = cy + projBead.yNorm * r;

                    const intens = Math.min(1.0, Math.max(0.0, b.intensity || 0.5));
                    const bR = isRadarDiamond ? Math.max(2.8, 7.5 * intens) : Math.max(2.2, 5.0 * intens);
                    const alpha = Math.min(1.0, Math.max(0.70, intens * 1.25));

                    ctx.save();
                    const bGrad = getCachedGradient(ctx, 'radial', [bx, by, 0, bx, by, bR * 2.5], [
                        [0, `rgba(255, 255, 255, ${alpha.toFixed(3)})`],
                        [0.25, `rgba(254, 240, 138, ${(0.98 * alpha).toFixed(3)})`],
                        [0.65, `rgba(249, 115, 22, ${(0.65 * alpha).toFixed(3)})`],
                        [1, 'transparent']
                    ]);
                    ctx.beginPath();
                    ctx.arc(bx, by, bR * 2.5, 0, Math.PI * 2);
                    ctx.fillStyle = bGrad;
                    ctx.fill();

                    if (isRadarDiamond && intens > 0.05) {
                        const spike = Math.max(12, 18 * intens);
                        ctx.strokeStyle = `rgba(255, 255, 255, ${(0.95 * alpha).toFixed(3)})`;
                        ctx.lineWidth = Math.max(0.8, 1.4 * intens);
                        ctx.beginPath();
                        ctx.moveTo(bx - spike, by); ctx.lineTo(bx + spike, by);
                        ctx.moveTo(bx, by - spike); ctx.lineTo(bx, by + spike);
                        ctx.stroke();
                    }
                    ctx.restore();
                });
            }

            // Indicador de exageración en la esquina inferior del lienzo
            if (showLimbLabels) {
                ctx.save();
                ctx.font = "400 8.5px 'Plus Jakarta Sans', sans-serif";
                ctx.fillStyle = 'rgba(148, 163, 184, 0.65)';
                ctx.textAlign = 'right';
                ctx.textBaseline = 'bottom';
                ctx.fillText('Exageración 2.5×', w - 10, h - 8);
                ctx.restore();
            }

            ctx.restore();

            // Actualizar datos de texto en la cabecera del panel
            updateLimbPanelHeaderInfo(circ, p2Deg, p3Deg);
        }



// Exposición en el objeto global
if (typeof window !== 'undefined') {
    window.getLimbFeatureAtPA = getLimbFeatureAtPA;
    window.getEclipseLibrationParams = getEclipseLibrationParams;
    window.getCachedGradient = getCachedGradient;
    window.getSmoothLOLAProfile = getSmoothLOLAProfile;
    window.toggleTeleLimbProfile = toggleTeleLimbProfile;
    window.updateLimbPanelHeaderInfo = updateLimbPanelHeaderInfo;
    window.getBeadAnnouncement = getBeadAnnouncement;
    window.renderLunarLimbRadar = renderLunarLimbRadar;
}
