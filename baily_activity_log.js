/* =========================================================================
   COSMOS MATARÓ - REGISTRO DE ACTIVIDAD DEL LIMBO LUNAR (baily_activity_log.js)
   Generador de cronogramas de Perlas de Baily y Anillos de Diamantes con
   topografía selenográfica IAU y LOLA/LRO.
   ========================================================================= */

        const LUNAR_LIMB_FEATURES = [
            { name: "Polo Norte Lunar", landmark: "Cráteres Peary, Byrd y Hermite", type: "polar", vMin: 350, vMax: 12, desc: "Región polar ártica lunar con cráteres de sombra perpetua." },
            { name: "Cráteres Meton y Barrow", landmark: "Murallas de Meton y Barrow", type: "crater", vMin: 12, vMax: 30, desc: "Complejo de cráteres antiguos en el limbo nor-noreste." },
            { name: "Cráter Endymion", landmark: "Muralla oriental de Endymion", type: "crater", vMin: 30, vMax: 48, desc: "Cráter circular de 125 km con suelo de lava basáltica oscura." },
            { name: "Mare Humboldtianum", landmark: "Cuenca Humboldtianum / Cráter Bel'kovich", type: "basin", vMin: 48, vMax: 68, desc: "Gran cuenca de impacto multianular visible en libración noreste." },
            { name: "Montes D'Alembert", landmark: "Cumbres D'Alembert / Cráter Gauss", type: "mountain", vMin: 68, vMax: 82, desc: "Elevaciones montañosas (+3 km) en el limbo este-noreste." },
            { name: "Mare Marginis", landmark: "Llanura de Mare Marginis / Cráter Goddard", type: "basin", vMin: 82, vMax: 96, desc: "Mar lunar de borde irregular en el ecuador oriental." },
            { name: "Mare Smythii", landmark: "Borde de Mare Smythii / Cráter Kästner", type: "basin", vMin: 96, vMax: 114, desc: "Cuenca circular ecuatorial oriental; típico valle de contacto C2." },
            { name: "Mare Australe", landmark: "Cuenca Australe / Cráter Humboldt", type: "basin", vMin: 114, vMax: 136, desc: "Vasta cuenca inundada de basaltos en el limbo suroriental." },
            { name: "Cráteres Hanno y Pontécoulant", landmark: "Murallas de Hanno y Pontécoulant", type: "crater", vMin: 136, vMax: 154, desc: "Terreno craterizado escarpado del limbo suroriental." },
            { name: "Cráteres Demonax y Boguslawsky", landmark: "Depresiones de Demonax y Boussingault", type: "crater", vMin: 154, vMax: 172, desc: "Profundos cráteres polares del cuadrante meridional." },
            { name: "Polo Sur Lunar", landmark: "Macizo de Malapert / Cráter Shackleton", type: "polar", vMin: 172, vMax: 186, desc: "Polo Sur lunar con crestas iluminadas y profundos valles en sombra." },
            { name: "Montes Leibniz", landmark: "Pico Leibniz / Cumbres de Cabeus (+5.2 km)", type: "mountain", vMin: 186, vMax: 204, desc: "Las cumbres más altas del limbo lunar (+5 km); recortan las últimas perlas del sur." },
            { name: "Cráteres Drygalski y Boltzmann", landmark: "Muralla de Drygalski / Valle de Boltzmann", type: "crater", vMin: 204, vMax: 218, desc: "Impresionante cráter de impacto de 162 km con pico central prominente." },
            { name: "Cuenca Polo Sur-Aitken (SPA)", landmark: "Gran Depresión SPA / Cráter Zeeman", type: "basin", vMin: 218, vMax: 238, desc: "La mayor y más profunda cuenca de impacto del sistema solar (-3 km)." },
            { name: "Montes Doerfel / Cráter Bailly", landmark: "Cordillera Doerfel / Muralla de Bailly", type: "mountain", vMin: 238, vMax: 256, desc: "Bailly es el mayor cráter del limbo visible (287 km); picos Doerfel (+4 km)." },
            { name: "Mare Orientale (Montes Cordillera)", landmark: "Anillo Exterior: Montes Cordillera (+3.8 km)", type: "mountain", vMin: 256, vMax: 274, desc: "Anillo exterior concéntrico de la cuenca multianular de Orientale." },
            { name: "Mare Orientale (Montes Rook)", landmark: "Anillo Interior: Montes Rook / Cráter Lowell", type: "mountain", vMin: 274, vMax: 294, desc: "Anillo montañoso interior de Orientale; genera espectaculares anillos de diamantes en C3." },
            { name: "Cráteres Grimaldi y Riccioli", landmark: "Cuenca Grimaldi / Cordillera Norte", type: "crater", vMin: 294, vMax: 312, desc: "Una de las zonas más oscuras del limbo occidental sobre el ecuador lunar." },
            { name: "Oceanus Procellarum Oeste", landmark: "Costa de Procellarum / Cráter Hevelius", type: "basin", vMin: 312, vMax: 330, desc: "Llanuras basálticas occidentales y cráteres marginales." },
            { name: "Cráteres Pythagoras y Xenophanes", landmark: "Murallas de Pythagoras y Anaximander", type: "crater", vMin: 330, vMax: 350, desc: "Cráter de 130 km con pico central de 3 km en el limbo noroccidental." }
        ];

if (typeof window !== 'undefined') window.LUNAR_LIMB_FEATURES = LUNAR_LIMB_FEATURES;

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

if (typeof window !== 'undefined') window.getLimbFeatureAtPA = getLimbFeatureAtPA;

        // -------------------------------------------------------------
        // REGISTRO DE ACTIVIDAD DEL LIMBO LUNAR (PERLAS Y DIAMANTES)
        // -------------------------------------------------------------
        function generateBailyActivityLog(circ, ec, contactKey = 'c2') {
            if (!circ || !ec) return { events: [], contactLabel: 'C2', baseT: 0, stats: {} };
            const { libL, libB, axisC } = getEclipseLibrationParams(ec);

            let contact = null;
            let contactLabel = 'C2';
            const isC2 = contactKey === 'c2' && circ.c2 && circ.c2.t != null;
            const isC3 = contactKey === 'c3' && circ.c3 && circ.c3.t != null;

            if (isC2) {
                contact = circ.c2;
                contactLabel = 'C2';
            } else if (isC3) {
                contact = circ.c3;
                contactLabel = 'C3';
            } else if (circ.tMax != null) {
                contact = { t: circ.tMax };
                contactLabel = 'Máx';
            } else {
                return { events: [], contactLabel: 'N/A', baseT: 0, stats: {} };
            }

            const baseT = contact.t;
            const rSunPx = 180;
            const rawEvents = [];
            let prevBeads = [];

            let maxSimultaneousBeads = 0;
            let collarStartDt = null;
            let collarEndDt = null;

            for (let dt = -30.0; dt <= 30.0; dt += 0.5) {
                const t = baseT + dt / 3600.0;
                const p = circ.getParamsAtT ? circ.getParamsAtT(t) : null;
                if (!p) continue;
                const kRatio = (p.L1 - p.L2) / (p.L1 + p.L2);
                const rMoonPx = rSunPx * kRatio;
                const sepNorm = p.delta / ((p.L1 + p.L2) / 2);
                const sepDistPx = sepNorm * rSunPx;
                const paMoonDeg = (Math.atan2(p.u, p.v) * DEG + 360) % 360;
                const radMoon = paMoonDeg * RAD;
                const moonX = -Math.sin(radMoon) * sepDistPx;
                const moonY = Math.cos(radMoon) * sepDistPx;
                const pxPerKm = rMoonPx / 1737.4;
                const magNow = (p && p.delta < p.L1) ? Math.max(0, (p.L1 - p.delta) / (p.L1 + p.L2)) : 0;
                const isTotalNow = (p && p.delta < Math.abs(p.L2) && p.L2 < 0);
                const isContactZone = (Math.abs(p.delta - Math.abs(p.L2)) <= 0.002);
                const minClearance = isContactZone ? -0.22 : 0.05;

                const rawBeadPoints = [];
                for (let step = 0; step < 720; step++) {
                    const pa = step * 0.5;
                    const rad = pa * RAD;
                    const hKm = getSmoothLOLAProfile(pa, libL, libB, axisC);
                    const rLimb = rMoonPx + hKm * pxPerKm;
                    const px = moonX - Math.sin(rad) * rLimb;
                    const py = moonY + Math.cos(rad) * rLimb;
                    const distToSun = Math.hypot(px, py);
                    const clearance = rSunPx - distToSun;
                    if (clearance > minClearance) {
                        rawBeadPoints.push({ pa, step, clearance: Math.max(0.01, clearance + (isContactZone ? 0.22 : 0)) });
                    }
                }

                const clusters = [];
                let currentCluster = [];
                for (let i = 0; i < rawBeadPoints.length; i++) {
                    if (currentCluster.length === 0) {
                        currentCluster.push(rawBeadPoints[i]);
                    } else {
                        const prev = currentCluster[currentCluster.length - 1];
                        let stepDiff = rawBeadPoints[i].step - prev.step;
                        if (stepDiff === 1 || (prev.step === 719 && rawBeadPoints[i].step === 0)) {
                            currentCluster.push(rawBeadPoints[i]);
                        } else {
                            clusters.push(currentCluster);
                            currentCluster = [rawBeadPoints[i]];
                        }
                    }
                }
                if (currentCluster.length > 0) clusters.push(currentCluster);
                if (clusters.length > 1) {
                    const first = clusters[0], last = clusters[clusters.length - 1];
                    if (first[0].step === 0 && last[last.length - 1].step === 719) {
                        clusters[0] = last.concat(first);
                        clusters.pop();
                    }
                }

                const currentBeads = [];
                clusters.forEach(c => {
                    const widthDeg = c.length * 0.5;
                    if (widthDeg <= 10.0 || (widthDeg <= 14.0 && magNow >= 0.997)) {
                        let maxPt = c[0];
                        c.forEach(pt => { if (pt.clearance > maxPt.clearance) maxPt = pt; });
                        if (maxPt.clearance >= 0.08) {
                            currentBeads.push({
                                pa: maxPt.pa,
                                clearance: maxPt.clearance,
                                widthDeg
                            });
                        }
                    }
                });

                if (currentBeads.length > maxSimultaneousBeads) maxSimultaneousBeads = currentBeads.length;
                if (currentBeads.length >= 3) {
                    if (collarStartDt === null) collarStartDt = dt;
                    collarEndDt = dt;
                }

                const ANG_TOL = 3.5;
                const nextPrevBeads = [];

                currentBeads.forEach(cb => {
                    const match = prevBeads.find(pb => {
                        let d = Math.abs(cb.pa - pb.pa);
                        if (d > 180) d = 360 - d;
                        return d <= ANG_TOL;
                    });
                    if (!match) {
                        const feat = getLimbFeatureAtPA(cb.pa, axisC);
                        const ev = {
                            dt,
                            t,
                            fenomeno: 'Perla de Baily',
                            pa: cb.pa,
                            feature: feat.name,
                            landmark: feat.landmark,
                            lastDt: dt,
                            maxClearance: cb.clearance
                        };
                        rawEvents.push(ev);
                        nextPrevBeads.push({ pa: cb.pa, eventRef: ev });
                    } else {
                        match.eventRef.lastDt = dt;
                        if (cb.clearance > match.eventRef.maxClearance) match.eventRef.maxClearance = cb.clearance;
                        nextPrevBeads.push({ pa: cb.pa, eventRef: match.eventRef });
                    }
                });

                prevBeads = nextPrevBeads;
            }

            // Filtrar parpadeos de duración nula (< 0.5s) y holgura insignificante
            const validEvents = rawEvents.filter(e => (e.lastDt - e.dt) >= 0.4 || e.maxClearance >= 0.20);

            let diamondEvent = null;
            // El Anillo de Diamantes es un fenómeno exclusivo de eclipses totales (contraste de la corona solar)
            if (circ && circ.isTotal) {
                if (isC2 && validEvents.length > 0) {
                    const candidates = validEvents.filter(e => e.lastDt <= 10.0);
                    if (candidates.length > 0) {
                        diamondEvent = candidates.reduce((prev, curr) => (curr.lastDt > prev.lastDt) ? curr : prev, candidates[0]);
                        diamondEvent.fenomeno = 'Anillo de Diamantes';
                    }
                } else if (isC3 && validEvents.length > 0) {
                    diamondEvent = validEvents[0];
                    diamondEvent.fenomeno = 'Anillo de Diamantes';
                }
            }

            const stats = {
                maxSimultaneousBeads,
                collarWindow: collarStartDt !== null ? [collarStartDt, collarEndDt] : null,
                diamondFeature: diamondEvent ? diamondEvent.feature + ' (PA ' + Math.round(diamondEvent.pa) + '°)' : null
            };

            return { events: validEvents, contactLabel, baseT, stats };
        }

        function buildActivityLogPageHtml(circ, ec, obs, defaultKey = 'c2') {
            const hasC2 = circ && (circ.isTotal || circ.isAnnular) && circ.c2 && circ.c2.t != null;
            const hasC3 = circ && (circ.isTotal || circ.isAnnular) && circ.c3 && circ.c3.t != null;

            const dataC2 = hasC2 ? generateBailyActivityLog(circ, ec, 'c2') : { events: [], contactLabel: 'C2', baseT: 0 };
            const dataC3 = hasC3 ? generateBailyActivityLog(circ, ec, 'c3') : { events: [], contactLabel: 'C3', baseT: 0 };
            const dataMax = (!hasC2 && !hasC3 && circ && circ.tMax != null) ? generateBailyActivityLog(circ, ec, 'max') : null;

            const isAnnular = Boolean(circ && circ.isAnnular);
            const initialKey = hasC2 ? defaultKey : (dataMax ? 'max' : 'c2');
            const dataPayload = JSON.stringify({
                c2: dataC2,
                c3: dataC3,
                max: dataMax,
                isAnnular: isAnnular,
                isTotal: Boolean(circ && circ.isTotal),
                eclipseName: ec.name || ('Eclipse Solar ' + (ec.year || '')),
                observerName: (obs.name || 'Observador') + ' (' + (obs.lat ? obs.lat.toFixed(2) : '') + '°, ' + (obs.lon ? obs.lon.toFixed(2) : '') + '°)',
                dtSec: ec.dt || 0,
                t0: ec.t0 || 12
            });

            const docTitle = isAnnular
                ? 'Registro de actividad — Perlas de Baily'
                : 'Registro de actividad — Perlas de Baily y Anillo de Diamantes';
            const pageH1 = isAnnular
                ? 'Registro de actividad: Perlas de Baily'
                : 'Registro de actividad: Perlas y Diamantes';

            const htmlParts = [
                '<!DOCTYPE html>',
                '<html lang="es">',
                '<head>',
                '    <meta charset="UTF-8">',
                '    <meta name="viewport" content="width=device-width, initial-scale=1.0">',
                '    <title>' + docTitle + '</title>',
                '    <link rel="preconnect" href="https://fonts.googleapis.com">',
                '    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
                '    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">',
                '    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">',
                '    <style>',
                '        :root {',
                '            --bg-body: #060913;',
                '            --bg-card: #0c1220;',
                '            --bg-card-hover: rgba(56, 189, 248, 0.10);',
                '            --border-card: rgba(255, 255, 255, 0.08);',
                '            --accent-blue: #38bdf8;',
                '            --accent-yellow: #fbbf24;',
                '            --text-main: #f1f5f9;',
                '            --text-soft: #cbd5e1;',
                '            --text-muted: #94a3b8;',
                '            --text-dim: #64748b;',
                '            --font-main: "Plus Jakarta Sans", system-ui, -apple-system, sans-serif;',
                '            --font-mono: "JetBrains Mono", ui-monospace, Menlo, Consolas, monospace;',
                '        }',
                '        * { box-sizing: border-box; margin: 0; padding: 0; }',
                '        body {',
                '            background: var(--bg-body);',
                '            color: var(--text-main);',
                '            font-family: var(--font-main);',
                '            padding: 16px 20px;',
                '            line-height: 1.45;',
                '        }',
                '        .header-container {',
                '            display: flex;',
                '            justify-content: space-between;',
                '            align-items: flex-start;',
                '            border-bottom: 1px solid var(--border-card);',
                '            padding-bottom: 12px;',
                '            margin-bottom: 14px;',
                '            flex-wrap: wrap;',
                '            gap: 12px;',
                '        }',
                '        .title-group h1 {',
                '            font-size: 1.18rem;',
                '            font-weight: 600;',
                '            display: flex;',
                '            align-items: center;',
                '            gap: 8px;',
                '            color: #ffffff;',
                '        }',
                '        .title-group p {',
                '            font-size: 0.80rem;',
                '            color: var(--text-muted);',
                '            margin-top: 3px;',
                '            font-family: var(--font-mono);',
                '        }',
                '        .btn-action {',
                '            background: transparent;',
                '            color: #ffffff;',
                '            border: 1px solid var(--border-card);',
                '            padding: 5px 12px;',
                '            border-radius: 6px;',
                '            font-size: 0.78rem;',
                '            font-family: var(--font-mono);',
                '            cursor: pointer;',
                '            display: inline-flex;',
                '            align-items: center;',
                '            gap: 6px;',
                '            transition: all 0.15s;',
                '        }',
                '        .btn-action:hover {',
                '            background: rgba(255, 255, 255, 0.1);',
                '            border-color: rgba(255, 255, 255, 0.3);',
                '        }',
                '        .tabs-container {',
                '            display: flex;',
                '            gap: 8px;',
                '            margin-bottom: 12px;',
                '        }',
                '        .tab-btn {',
                '            background: rgba(15, 23, 42, 0.6);',
                '            color: var(--text-muted);',
                '            border: 1px solid var(--border-card);',
                '            padding: 6px 14px;',
                '            border-radius: 6px;',
                '            font-size: 0.82rem;',
                '            font-family: var(--font-mono);',
                '            cursor: pointer;',
                '            display: inline-flex;',
                '            align-items: center;',
                '            gap: 6px;',
                '            transition: all 0.15s;',
                '        }',
                '        .tab-btn.active {',
                '            background: rgba(56, 189, 248, 0.15);',
                '            border-color: var(--accent-blue);',
                '            color: #ffffff;',
                '            font-weight: 600;',
                '        }',
                '        .stats-banner {',
                '            display: flex;',
                '            flex-wrap: wrap;',
                '            gap: 8px;',
                '            background: rgba(15, 23, 42, 0.5);',
                '            border: 1px solid var(--border-card);',
                '            border-radius: 8px;',
                '            padding: 8px 12px;',
                '            margin-bottom: 12px;',
                '            font-size: 0.76rem;',
                '            font-family: var(--font-mono);',
                '            align-items: center;',
                '        }',
                '        .stat-pill {',
                '            background: transparent;',
                '            color: var(--text-muted);',
                '            margin-right: 6px;',
                '        }',
                '        .stat-pill strong { color: #ffffff; }',
                '        .filter-toolbar {',
                '            display: flex;',
                '            justify-content: space-between;',
                '            align-items: center;',
                '            gap: 10px;',
                '            margin-bottom: 12px;',
                '            flex-wrap: wrap;',
                '        }',
                '        .filter-pills {',
                '            display: flex;',
                '            gap: 6px;',
                '            flex-wrap: wrap;',
                '        }',
                '        .filter-btn {',
                '            background: transparent;',
                '            border: 1px solid var(--border-card);',
                '            color: var(--text-muted);',
                '            padding: 3px 10px;',
                '            border-radius: 6px;',
                '            font-size: 0.74rem;',
                '            font-family: var(--font-mono);',
                '            cursor: pointer;',
                '            transition: all 0.15s;',
                '        }',
                '        .filter-btn.active {',
                '            background: rgba(255, 255, 255, 0.12);',
                '            border-color: rgba(255, 255, 255, 0.4);',
                '            color: #ffffff;',
                '            font-weight: 600;',
                '        }',
                '        .search-box {',
                '            background: rgba(15, 23, 42, 0.7);',
                '            border: 1px solid var(--border-card);',
                '            border-radius: 6px;',
                '            padding: 5px 10px;',
                '            color: #ffffff;',
                '            font-size: 0.78rem;',
                '            font-family: var(--font-mono);',
                '            min-width: 240px;',
                '            outline: none;',
                '        }',
                '        .search-box:focus { border-color: var(--accent-blue); }',
                '        .table-container {',
                '            background: var(--bg-card);',
                '            border: 1px solid var(--border-card);',
                '            border-radius: 8px;',
                '            overflow: hidden;',
                '            box-shadow: 0 4px 18px rgba(0,0,0,0.35);',
                '        }',
                '        table {',
                '            width: 100%;',
                '            border-collapse: collapse;',
                '            text-align: left;',
                '            font-size: 0.78rem;',
                '            font-family: var(--font-mono);',
                '            table-layout: fixed;',
                '            color: var(--text-soft);',
                '        }',
                '        thead {',
                '            position: sticky;',
                '            top: 0;',
                '            background: #0f1626;',
                '            z-index: 10;',
                '            box-shadow: 0 1px 0 rgba(255, 255, 255, 0.08);',
                '        }',
                '        th {',
                '            height: 21px;',
                '            max-height: 21px;',
                '            line-height: 20px;',
                '            vertical-align: middle;',
                '            padding: 0 4px;',
                '            font-size: 0.75rem;',
                '            font-weight: 500;',
                '            color: var(--text-muted);',
                '            text-transform: uppercase;',
                '            letter-spacing: 0.04em;',
                '            font-family: var(--font-mono);',
                '            white-space: nowrap;',
                '            box-sizing: border-box;',
                '            border-bottom: 1px solid rgba(255, 255, 255, 0.08);',
                '        }',
                '        tbody tr {',
                '            height: 21px;',
                '            max-height: 21px;',
                '            min-height: 21px;',
                '            box-sizing: border-box;',
                '            cursor: pointer;',
                '            transition: background 0.15s ease;',
                '        }',
                '        td {',
                '            height: 21px;',
                '            max-height: 21px;',
                '            min-height: 21px;',
                '            line-height: 20px;',
                '            vertical-align: middle;',
                '            padding: 0 4px;',
                '            border-bottom: 1px solid rgba(255, 255, 255, 0.04);',
                '            font-size: 0.78rem;',
                '            color: var(--text-soft);',
                '            font-family: var(--font-mono);',
                '            font-variant-numeric: tabular-nums;',
                '            white-space: nowrap;',
                '            overflow: hidden;',
                '            text-overflow: ellipsis;',
                '            box-sizing: border-box;',
                '        }',
                '        tbody tr:hover td {',
                '            background: rgba(56, 189, 248, 0.12);',
                '            color: #ffffff;',
                '        }',
                '        tbody tr.row-selected td {',
                '            color: var(--accent-blue);',
                '            font-weight: 700;',
                '            background: rgba(56, 189, 248, 0.16);',
                '        }',
                '        @media print {',
                '            body { background: #ffffff; color: #000000; padding: 0; }',
                '            .btn-action, .tabs-container, .filter-toolbar { display: none !important; }',
                '            .table-container { box-shadow: none; border: 1px solid #ccc; }',
                '            th { color: #555555 !important; border-color: #ddd; }',
                '            td { border-color: #ddd; color: #000000 !important; }',
                '            thead { background: #f1f5f9; }',
                '        }',
                '    </style>',
                '</head>',
                '<body>',
                '    <div class="header-container">',
                '        <div class="title-group">',
                '            <h1>' + pageH1 + '</h1>',
                '            <p id="sub-header"></p>',
                '        </div>',
                '        <div style="display: flex; gap: 8px; align-items: center;">',
                '            <button class="btn-action" onclick="copyCsv()"><i class="fa-solid fa-file-csv"></i> Copiar CSV</button>',
                '            <button class="btn-action" onclick="window.print()"><i class="fa-solid fa-print"></i> Imprimir</button>',
                '        </div>',
                '    </div>',
                '    <div class="tabs-container" id="tabs-box"></div>',
                '    <div class="stats-banner" id="stats-box"></div>',
                '    <div class="filter-toolbar">',
                '        <div class="filter-pills" id="filter-pills-box">',
                '            <button class="filter-btn active" data-filter="todos" onclick="setFilter(\'todos\', this)">Todos</button>',
                '            <button class="filter-btn" data-filter="Diamante" onclick="setFilter(\'Diamante\', this)">Diamante</button>',
                '            <button class="filter-btn" data-filter="Perla" onclick="setFilter(\'Perla\', this)">Perlas</button>',
                '        </div>',
                '        <input type="text" id="input-search" class="search-box" placeholder="Filtrar por relieve, ángulo..." oninput="handleSearch(this.value)">',
                '    </div>',
                '    <div class="table-container">',
                '        <table>',
                '            <colgroup>',
                '                <col style="width: 36px;">',
                '                <col style="width: 96px;">',
                '                <col style="width: 48px;">',
                '                <col style="width: 148px;">',
                '                <col style="width: 66px;">',
                '                <col style="width: 46px;">',
                '                <col>',
                '            </colgroup>',
                '            <thead>',
                '                <tr>',
                '                    <th style="text-align: center;">#</th>',
                '                    <th>Hora (UT1)</th>',
                '                    <th style="text-align: right;" title="Diferencia de tiempo en segundos respecto al contacto">Δt</th>',
                '                    <th>Fenómeno</th>',
                '                    <th style="text-align: right;" title="Duración del fenómeno en segundos">Duración</th>',
                '                    <th style="text-align: right;" title="Ángulo de posición (Position Angle) en grados respecto al norte celeste">PA</th>',
                '                    <th>Accidente Lunar (NASA LOLA)</th>',
                '                </tr>',
                '            </thead>',
                '            <tbody id="table-body"></tbody>',
                '        </table>',
                '    </div>',
                '    <script>',
                '        const APP_DATA = ' + dataPayload + ';',
                '        let currentKey = "' + initialKey + '";',
                '        let currentFilter = "todos";',
                '        let searchQuery = "";',
                '        let selectedRowIndex = -1;',
                '        function init() {',
                '            document.getElementById("sub-header").textContent = APP_DATA.eclipseName + " — " + APP_DATA.observerName;',
                '            if (APP_DATA.isAnnular) {',
                '                const btnDia = document.querySelector(\'#filter-pills-box [data-filter="Diamante"]\');',
                '                if (btnDia) btnDia.style.display = "none";',
                '            }',
                '            renderTabs();',
                '            renderCurrentData();',
                '        }',
                '        function renderTabs() {',
                '            const box = document.getElementById("tabs-box");',
                '            box.innerHTML = "";',
                '            if (APP_DATA.c2 && APP_DATA.c2.events.length > 0) {',
                '                const btnC2 = document.createElement("button");',
                '                btnC2.className = "tab-btn " + (currentKey === "c2" ? "active" : "");',
                '                btnC2.innerHTML = APP_DATA.isAnnular ? \'Contacto C2 (Formación del Anillo)\' : \'Contacto C2 (Entrada a Totalidad)\';',
                '                btnC2.onclick = () => switchKey("c2");',
                '                box.appendChild(btnC2);',
                '            }',
                '            if (APP_DATA.c3 && APP_DATA.c3.events.length > 0) {',
                '                const btnC3 = document.createElement("button");',
                '                btnC3.className = "tab-btn " + (currentKey === "c3" ? "active" : "");',
                '                btnC3.innerHTML = APP_DATA.isAnnular ? \'Contacto C3 (Ruptura del Anillo)\' : \'Contacto C3 (Salida de Totalidad)\';',
                '                btnC3.onclick = () => switchKey("c3");',
                '                box.appendChild(btnC3);',
                '            }',
                '            if (APP_DATA.max && APP_DATA.max.events.length > 0) {',
                '                const btnMax = document.createElement("button");',
                '                btnMax.className = "tab-btn " + (currentKey === "max" ? "active" : "");',
                '                btnMax.innerHTML = \'Máximo del Eclipse\';',
                '                btnMax.onclick = () => switchKey("max");',
                '                box.appendChild(btnMax);',
                '            }',
                '        }',
                '        function switchKey(key) {',
                '            currentKey = key;',
                '            selectedRowIndex = -1;',
                '            renderTabs();',
                '            renderCurrentData();',
                '        }',
                '        function formatUT1(t) {',
                '            const dtH = (APP_DATA.dtSec || 0) / 3600;',
                '            const utDec = (APP_DATA.t0 || 12) + t - dtH;',
                '            let totalTenths = Math.round((((utDec % 24 + 24) % 24) * 3600) * 10);',
                '            const frac = totalTenths % 10;',
                '            const totalSec = Math.floor(totalTenths / 10) % 86400;',
                '            const h = Math.floor(totalSec / 3600);',
                '            const m = Math.floor((totalSec % 3600) / 60);',
                '            const s = totalSec % 60;',
                '            return String(h).padStart(2,"0") + ":" + String(m).padStart(2,"0") + ":" + String(s).padStart(2,"0") + "." + frac;',
                '        }',
                '        function renderCurrentData() {',
                '            const cur = APP_DATA[currentKey];',
                '            if (!cur) return;',
                '            const events = cur.events || [];',
                '            const refTimeStr = cur.baseT ? formatUT1(cur.baseT) : "--:--:--";',
                '            const total = events.length;',
                '            const st = cur.stats || {};',
                '            let statsHtml = ',
                '                \'<span class="stat-pill">Hora \' + cur.contactLabel + \': <strong>\' + refTimeStr + \' UT1</strong></span>\' + ',
                '                \'<span class="stat-pill">Ventana: <strong>[-30 s, +30 s]</strong></span>\' + ',
                '                \'<span class="stat-pill">Total perlas: <strong>\' + total + \'</strong></span>\';',
                '            if (st.diamondFeature) {',
                '                statsHtml += \'<span class="stat-pill">Gema del Diamante: <strong>\' + st.diamondFeature + \'</strong></span>\';',
                '            }',
                '            if (st.maxSimultaneousBeads >= 3) {',
                '                statsHtml += \'<span class="stat-pill">Collar de perlas: <strong>Sí (máx. \' + st.maxSimultaneousBeads + \' perlas)</strong></span>\';',
                '            }',
                '            document.getElementById("stats-box").innerHTML = statsHtml;',
                '            renderRows();',
                '        }',
                '        function renderRows() {',
                '            const cur = APP_DATA[currentKey];',
                '            const tbody = document.getElementById("table-body");',
                '            tbody.innerHTML = "";',
                '            if (!cur || !cur.events || cur.events.length === 0) {',
                '                tbody.innerHTML = \'<tr><td colspan="7" style="text-align:center; padding: 24px; color: #64748b;">No hay actividad de perlas en esta ventana.</td></tr>\';',
                '                return;',
                '            }',
                '            let visibleCount = 0;',
                '            cur.events.forEach((e, idx) => {',
                '                if (currentFilter !== "todos") {',
                '                    if (currentFilter === "Diamante" && !e.fenomeno.includes("Diamante")) return;',
                '                    if (currentFilter === "Perla" && !e.fenomeno.includes("Perla")) return;',
                '                }',
                '                if (searchQuery) {',
                '                    const q = searchQuery.toLowerCase();',
                '                    const hay = (e.feature + " " + e.landmark + " " + e.pa.toFixed(1) + " " + e.fenomeno).toLowerCase();',
                '                    if (!hay.includes(q)) return;',
                '                }',
                '                visibleCount++;',
                '                const tr = document.createElement("tr");',
                '                if (idx === selectedRowIndex) tr.className = "row-selected";',
                '                tr.onclick = () => jumpTo(e.t, idx);',
                '                tr.title = "Clic para reproducir en este instante en el visor telescópico";',
                '                const timeStr = formatUT1(e.t);',
                '                let dtRound = Math.round(e.dt);',
                '                if (Object.is(dtRound, -0) || dtRound === 0) dtRound = 0;',
                '                const dtStr = (dtRound > 0 ? "+" : "") + dtRound;',
                '                const paRound = Math.round(e.pa);',
                '                const fenoClean = e.fenomeno.replace(/💎|📿|✨/g, "").trim();',
                '                const featureFull = e.feature + (e.landmark ? " — " + e.landmark : "");',
                '                const durVal = Math.max(0.5, ((e.lastDt != null ? e.lastDt : e.dt) - e.dt));',
                '                const durStr = durVal.toFixed(1);',
                '                tr.innerHTML = ',
                '                    \'<td style="color:var(--text-dim); text-align:center;">\' + (idx + 1) + \'</td>\' + ',
                '                    \'<td style="color:var(--text-soft); font-weight:500;">\' + timeStr + \'</td>\' + ',
                '                    \'<td style="color:var(--text-soft); text-align:right;">\' + dtStr + \'</td>\' + ',
                '                    \'<td style="color:var(--text-main); font-weight:500;">\' + fenoClean + \'</td>\' + ',
                '                    \'<td style="color:var(--text-soft); text-align:right; font-variant-numeric: tabular-nums;">\' + durStr + \'</td>\' + ',
                '                    \'<td style="color:var(--text-soft); text-align:right;">\' + paRound + \'</td>\' + ',
                '                    \'<td style="color:var(--text-muted);" title="\' + featureFull.replace(/"/g, "&quot;") + \'">\' + featureFull + \'</td>\';',
                '                tbody.appendChild(tr);',
                '            });',
                '            if (visibleCount === 0) {',
                '                tbody.innerHTML = \'<tr><td colspan="7" style="text-align:center; padding: 20px; color: #64748b;">No se encontraron eventos con los filtros aplicados.</td></tr>\';',
                '            }',
                '        }',
                '        function setFilter(filt, btn) {',
                '            currentFilter = filt;',
                '            document.querySelectorAll("#filter-pills-box .filter-btn").forEach(b => b.classList.remove("active"));',
                '            if (btn) btn.classList.add("active");',
                '            renderRows();',
                '        }',
                '        function handleSearch(val) {',
                '            searchQuery = val.trim();',
                '            renderRows();',
                '        }',
                '        function jumpTo(t, idx) {',
                '            selectedRowIndex = idx;',
                '            renderRows();',
                '            try {',
                '                if (window.opener && !window.opener.closed && typeof window.opener.jumpToSpecificTime === "function") {',
                '                    window.opener.jumpToSpecificTime(t);',
                '                } else if (window.parent && typeof window.parent.jumpToSpecificTime === "function") {',
                '                    window.parent.jumpToSpecificTime(t);',
                '                }',
                '            } catch(e) {',
                '                console.warn("jumpTo opener restricted:", e);',
                '            }',
                '        }',
                '        function copyCsv() {',
                '            const cur = APP_DATA[currentKey];',
                '            if (!cur || !cur.events) return;',
                '            let csv = "#,Hora_UT1,dt_segundos,Fenomeno,Duracion_s,PA_grados,Accidente,Relieve\\n";',
                '            cur.events.forEach((e, i) => {',
                '                let dtRound = Math.round(e.dt);',
                '                if (Object.is(dtRound, -0) || dtRound === 0) dtRound = 0;',
                '                const dtStr = (dtRound > 0 ? "+" : "") + dtRound;',
                '                const paRound = Math.round(e.pa);',
                '                const fenoClean = e.fenomeno.replace(/💎|📿|✨/g, "").trim();',
                '                const durVal = Math.max(0.5, ((e.lastDt != null ? e.lastDt : e.dt) - e.dt));',
                '                csv += (i+1) + "," + formatUT1(e.t) + "," + dtStr + "," + ',
                '                       \'"\' + fenoClean + \'",\' + durVal.toFixed(1) + \',"\' + paRound + \'","\' + ',
                '                       \'"\' + e.feature + \'","\' + \'"\' + e.landmark + \'"\\n\';',
                '            });',
                '            navigator.clipboard.writeText(csv).then(() => {',
                '                alert("¡Registro CSV copiado al portapapeles!");',
                '            }).catch(() => {',
                '                prompt("Copia el CSV:", csv);',
                '            });',
                '        }',
                '        window.onload = init;',
                '    ' + '<' + '/script>',
                '</body>',
                '</html>'
            ];

            return htmlParts.join('\n');
        }

        let activityLogWindowRef = null;

        function toggleActivityLog(show = null) {
            if (activityLogWindowRef && activityLogWindowRef.closed) {
                activityLogWindowRef = null;
                const c = (typeof getDOM === 'function' ? getDOM('chk-show-activity-log') : document.getElementById('chk-show-activity-log'));
                if (c && show === null) c.checked = false;
            }
            const chk = (typeof getDOM === 'function' ? getDOM('chk-show-activity-log') : document.getElementById('chk-show-activity-log'));
            const targetState = (show !== null) ? show : (chk ? chk.checked : false);
            if (chk) chk.checked = targetState;

            if (targetState) {
                openActivityLogWindow();
            } else {
                closeInAppActivityLogModal();
                if (activityLogWindowRef && !activityLogWindowRef.closed) {
                    try {
                        activityLogWindowRef.close();
                    } catch(e) {}
                    activityLogWindowRef = null;
                }
            }
        }

        function openActivityLogWindow(contactKey = null) {
            const chk = (typeof getDOM === 'function' ? getDOM('chk-show-activity-log') : document.getElementById('chk-show-activity-log'));
            if (!currentEclipse) {
                if (chk) chk.checked = false;
                return;
            }
            const circ = localCircumstancesCache || (currentObserver ? calculateLocalSolarCircumstances(currentEclipse, currentObserver.lat, currentObserver.lon) : null);
            if (!circ || !circ.isEclipsed) {
                alert('El observador seleccionado no experimenta el eclipse.');
                if (chk) chk.checked = false;
                return;
            }

            const hasC2 = circ && (circ.isTotal || circ.isAnnular) && circ.c2 && circ.c2.t != null;
            const targetKey = contactKey || (hasC2 ? 'c2' : 'max');

            const fullHtml = buildActivityLogPageHtml(circ, currentEclipse, currentObserver || { name: 'Observador', lat: 0, lon: 0 }, targetKey);

            try {
                activityLogWindowRef = window.open('', 'RegistroActividadCosmos', 'width=1040,height=780,scrollbars=yes,resizable=yes');
                const checkClosedTimer = setInterval(() => {
                    if (activityLogWindowRef && activityLogWindowRef.closed) {
                        activityLogWindowRef = null;
                        const c = (typeof getDOM === 'function' ? getDOM('chk-show-activity-log') : document.getElementById('chk-show-activity-log'));
                        if (c) c.checked = false;
                        clearInterval(checkClosedTimer);
                    }
                }, 500);
            } catch(e) {
                activityLogWindowRef = null;
            }

            let popupSuccess = false;
            if (activityLogWindowRef && !activityLogWindowRef.closed && typeof activityLogWindowRef.closed !== 'undefined') {
                try {
                    activityLogWindowRef.document.open();
                    activityLogWindowRef.document.write(fullHtml);
                    activityLogWindowRef.document.close();
                    if (activityLogWindowRef.focus) activityLogWindowRef.focus();
                    try {
                        const onPopupBeforeUnload = () => {
                            const c = (typeof getDOM === 'function' ? getDOM('chk-show-activity-log') : document.getElementById('chk-show-activity-log'));
                            if (c) c.checked = false;
                            activityLogWindowRef = null;
                        };
                        activityLogWindowRef.removeEventListener('beforeunload', onPopupBeforeUnload);
                        activityLogWindowRef.addEventListener('beforeunload', onPopupBeforeUnload, { once: true });
                    } catch(e) {}
                    popupSuccess = true;
                } catch(err) {
                    console.warn('[ActivityLog] Error escribiendo en popup, usando modal interno:', err);
                    popupSuccess = false;
                }
            }
            if (!popupSuccess) {
                showInAppActivityLogModal(fullHtml);
            }
            if (chk) chk.checked = true;
        }

        function showInAppActivityLogModal(fullHtml) {
            let modal = document.getElementById('activity-log-inapp-modal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'activity-log-inapp-modal';
                modal.style.cssText = 'position:fixed;inset:0;background:rgba(2,6,23,0.85);backdrop-filter:blur(8px);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;';
                document.body.appendChild(modal);
            }

            modal.innerHTML = `
                <div style="position:relative;width:100%;max-width:1040px;height:90vh;max-height:850px;background:#060913;border:1px solid rgba(255,255,255,0.12);border-radius:14px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 12px 40px rgba(0,0,0,0.8);">
                    <button type="button" onclick="closeInAppActivityLogModal()" style="position:absolute;top:12px;right:14px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);color:#cbd5e1;padding:6px 12px;border-radius:8px;cursor:pointer;font-size:0.82rem;z-index:100;transition:all 0.2s;" onmouseover="this.style.background='rgba(244,63,94,0.2)';this.style.color='#f43f5e'" onmouseout="this.style.background='rgba(255,255,255,0.08)';this.style.color='#cbd5e1'">
                        ✕ Cerrar
                    </button>
                    <iframe id="activity-log-iframe" style="width:100%;height:100%;border:none;background:#060913;"></iframe>
                </div>
            `;
            modal.style.display = 'flex';
            const iframe = document.getElementById('activity-log-iframe');
            if (iframe) {
                try {
                    if (iframe.contentDocument) {
                        iframe.contentDocument.open();
                        iframe.contentDocument.write(fullHtml);
                        iframe.contentDocument.close();
                    } else if (iframe.contentWindow) {
                        iframe.contentWindow.document.open();
                        iframe.contentWindow.document.write(fullHtml);
                        iframe.contentWindow.document.close();
                    }
                } catch(e) {
                    iframe.srcdoc = fullHtml;
                }
            }
        }

        function closeInAppActivityLogModal() {
            const modal = document.getElementById('activity-log-inapp-modal');
            if (modal) modal.style.display = 'none';
            const chk = (typeof getDOM === 'function' ? getDOM('chk-show-activity-log') : document.getElementById('chk-show-activity-log'));
            if (chk) chk.checked = false;
        }


// Exposición en el objeto global para acceso desde la UI y otros módulos
if (typeof window !== 'undefined') {
    window.generateBailyActivityLog = generateBailyActivityLog;
    window.buildActivityLogPageHtml = buildActivityLogPageHtml;
    window.toggleActivityLog = toggleActivityLog;
    window.openActivityLogWindow = openActivityLogWindow;
    window.showInAppActivityLogModal = showInAppActivityLogModal;
    window.closeInAppActivityLogModal = closeInAppActivityLogModal;
}
