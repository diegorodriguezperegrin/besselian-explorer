/**
 * audit_worker.js
 * Worker de análisis analítico por lotes para el catálogo de 11.898 eclipses solares.
 * Diseñado para ser ejecutado en paralelo por audit_all_eclipses.py.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const args = process.argv.slice(2);
let startIdx = 0;
let endIdx = 100;
let jumpThreshold = 15.0;
let gapThreshold = 2.0;
let filterType = null;
let filterSaros = null;
let filterStartYear = -9999;
let filterEndYear = 9999;

let indicesArg = null;

for (let i = 0; i < args.length; i++) {
    if (args[i] === '--indices' && i + 1 < args.length) indicesArg = args[++i];
    else if (args[i] === '--start' && i + 1 < args.length) startIdx = parseInt(args[++i], 10);
    else if (args[i] === '--end' && i + 1 < args.length) endIdx = parseInt(args[++i], 10);
    else if (args[i] === '--jump' && i + 1 < args.length) jumpThreshold = parseFloat(args[++i]);
    else if (args[i] === '--gap' && i + 1 < args.length) gapThreshold = parseFloat(args[++i]);
    else if (args[i] === '--type' && i + 1 < args.length) filterType = args[++i].toUpperCase();
    else if (args[i] === '--saros' && i + 1 < args.length) filterSaros = parseInt(args[++i], 10);
    else if (args[i] === '--start-year' && i + 1 < args.length) filterStartYear = parseInt(args[++i], 10);
    else if (args[i] === '--end-year' && i + 1 < args.length) filterEndYear = parseInt(args[++i], 10);
}

const dir = __dirname;
const dataPath = path.join(dir, 'solar_eclipses_data.js');
const enginePath = path.join(dir, 'besselian_engine.js');

if (!fs.existsSync(dataPath) || !fs.existsSync(enginePath)) {
    console.error(JSON.stringify({ type: 'error', message: 'Archivos no encontrados: solar_eclipses_data.js o besselian_engine.js' }));
    process.exit(1);
}

const sandbox = { console, Math };
sandbox.global = sandbox;
sandbox.window = sandbox;
const ctx = vm.createContext(sandbox);

try {
    vm.runInContext(fs.readFileSync(dataPath, 'utf8') + '; this.NASA_SOLAR_ECLIPSES = NASA_SOLAR_ECLIPSES;', ctx);
    vm.runInContext(fs.readFileSync(enginePath, 'utf8') + '; this.precomputeEclipseGeometry = precomputeEclipseGeometry;', ctx);
} catch (err) {
    console.error(JSON.stringify({ type: 'error', message: 'Fallo al cargar scripts en VM: ' + err.message }));
    process.exit(1);
}

const eclipses = ctx.NASA_SOLAR_ECLIPSES;
if (!eclipses || eclipses.length === 0) {
    console.error(JSON.stringify({ type: 'error', message: 'No se encontraron eclipses en NASA_SOLAR_ECLIPSES' }));
    process.exit(1);
}

const effectiveEnd = Math.min(endIdx, eclipses.length);

function getMaxJump(arr) {
    if (!arr || arr.length < 2) return 0;
    let maxJump = 0;
    for (let i = 1; i < arr.length; i++) {
        const p1 = arr[i - 1], p2 = arr[i];
        if (!p1 || !p2) continue;
        const lng1 = p1.lng != null ? p1.lng : p1.lon;
        const lng2 = p2.lng != null ? p2.lng : p2.lon;
        if (p1.lat == null || p2.lat == null || lng1 == null || lng2 == null) continue;
        let dl = Math.abs(lng2 - lng1);
        if (dl > 180) dl = 360 - dl;
        const cosLat = Math.cos(0.5 * (p1.lat + p2.lat) * Math.PI / 180);
        const d = Math.hypot(p2.lat - p1.lat, dl * cosLat);
        if (d > maxJump) maxJump = d;
    }
    return maxJump;
}

function getMinDist(pTarget, loop) {
    if (!pTarget || !loop || loop.length === 0) return 999;
    const tLat = pTarget.lat;
    const tLng = pTarget.lng != null ? pTarget.lng : pTarget.lon;
    if (tLat == null || tLng == null) return 999;
    let minDist = 999;
    for (let i = 0; i < loop.length; i++) {
        const p = loop[i];
        const pLng = p.lng != null ? p.lng : p.lon;
        if (p.lat == null || pLng == null) continue;
        let dl = Math.abs(pLng - tLng);
        if (dl > 180) dl = 360 - dl;
        const cosLat = Math.cos(0.5 * (p.lat + tLat) * Math.PI / 180);
        const d = Math.hypot(p.lat - tLat, dl * cosLat);
        if (d < minDist) minDist = d;
    }
    return minDist;
}

function checkArcSpan(arc) {
    if (!arc || arc.length < 2) return 0;
    let maxSpan = 0;
    const p0 = arc[0];
    const p0Lng = p0.lng != null ? p0.lng : p0.lon;
    for (let i = 1; i < arc.length; i++) {
        const p = arc[i];
        const pLng = p.lng != null ? p.lng : p.lon;
        let dl = Math.abs(pLng - p0Lng);
        if (dl > 180) dl = 360 - dl;
        const cosLat = Math.cos(0.5 * (p.lat + p0.lat) * Math.PI / 180);
        const d = Math.hypot(p.lat - p0.lat, dl * cosLat);
        if (d > maxSpan) maxSpan = d;
    }
    return maxSpan;
}

let countProcessed = 0;
const reportInterval = 25;

let targetIndices = [];
if (indicesArg) {
    targetIndices = indicesArg.split(',').map(x => parseInt(x, 10)).filter(x => !isNaN(x));
} else {
    for (let k = startIdx; k < effectiveEnd; k++) targetIndices.push(k);
}

for (let k = 0; k < targetIndices.length; k++) {
    const idx = targetIndices[k];
    const e = eclipses[idx];
    if (!e) continue;

    // Filtros de búsqueda opcionales
    if (filterType && e.eclipse_type !== filterType) continue;
    if (filterSaros != null && e.saros !== filterSaros) continue;
    if (e.year < filterStartYear || e.year > filterEndYear) continue;

    const issues = [];
    try {
        const geom = ctx.precomputeEclipseGeometry(e);

        // 1. Verificación de Arcos de Terminador (sunriseArc y sunsetArc)
        if (geom.sunriseArc && geom.sunriseArc.length > 0) {
            const j = getMaxJump(geom.sunriseArc);
            const span = checkArcSpan(geom.sunriseArc);
            if (j > jumpThreshold) {
                issues.push({ code: 'SUNRISE_ARC_JUMP', desc: `Salto anómalo en sunriseArc: ${j.toFixed(1)}° (umbral ${jumpThreshold}°)` });
            }
            if (span > 25.0) {
                issues.push({ code: 'SUNRISE_ARC_SPAN', desc: `Extensión desmesurada en sunriseArc: ${span.toFixed(1)}° (esperado < 20°)` });
            }
        }

        if (geom.sunsetArc && geom.sunsetArc.length > 0) {
            const j = getMaxJump(geom.sunsetArc);
            const span = checkArcSpan(geom.sunsetArc);
            if (j > jumpThreshold) {
                issues.push({ code: 'SUNSET_ARC_JUMP', desc: `Salto anómalo en sunsetArc: ${j.toFixed(1)}° (umbral ${jumpThreshold}°)` });
            }
            if (span > 25.0) {
                issues.push({ code: 'SUNSET_ARC_SPAN', desc: `Extensión desmesurada en sunsetArc: ${span.toFixed(1)}° (esperado < 20°)` });
            }
        }

        // 2. Verificación de Curva de Espenak (Máximo en Horizonte)
        if (!geom.entersCompletely) {
            const hasLobes = (geom.sunriseLoop && geom.sunriseLoop.length > 0) || (geom.sunsetLoop && geom.sunsetLoop.length > 0);
            if (hasLobes && (!geom.fullEspenakLoop || geom.fullEspenakLoop.length === 0)) {
                issues.push({ code: 'ESPENAK_MISSING', desc: 'Curva fullEspenakLoop no generada (0 puntos) en eclipse no completo' });
            } else if (geom.fullEspenakLoop && geom.fullEspenakLoop.length > 0) {
                if (geom.sunriseLoop && geom.sunriseLoop.length > 0) {
                    const dSr = getMinDist(geom.fullEspenakLoop[0], geom.sunriseLoop);
                    if (dSr > gapThreshold) {
                        issues.push({ code: 'ESPENAK_GAP_SUNRISE', desc: `Brecha inicio Espenak a lóbulo amanecer: ${dSr.toFixed(2)}° (umbral ${gapThreshold}°)` });
                    }
                }
                if (geom.sunsetLoop && geom.sunsetLoop.length > 0) {
                    const dSs = getMinDist(geom.fullEspenakLoop[geom.fullEspenakLoop.length - 1], geom.sunsetLoop);
                    if (dSs > gapThreshold) {
                        issues.push({ code: 'ESPENAK_GAP_SUNSET', desc: `Brecha fin Espenak a lóbulo atardecer: ${dSs.toFixed(2)}° (umbral ${gapThreshold}°)` });
                    }
                }
                const j = getMaxJump(geom.fullEspenakLoop);
                if (j > jumpThreshold) {
                    issues.push({ code: 'ESPENAK_JUMP', desc: `Salto interno en fullEspenakLoop: ${j.toFixed(1)}° (umbral ${jumpThreshold}°)` });
                }
            }
        }

        // 3. Verificación de Corredor Central (corridorLoop)
        if (geom.corridorLoop && geom.corridorLoop.length > 0) {
            const j = getMaxJump(geom.corridorLoop);
            if (j > jumpThreshold) {
                issues.push({ code: 'CORRIDOR_JUMP', desc: `Salto anómalo en corridorLoop: ${j.toFixed(1)}° (umbral ${jumpThreshold}°)` });
            }
        }

        // 4. Verificación de Lóbulos de Penumbra (sunriseLoop y sunsetLoop)
        if (geom.sunriseLoop && geom.sunriseLoop.length > 0) {
            const j = getMaxJump(geom.sunriseLoop);
            if (j > jumpThreshold) {
                issues.push({ code: 'SUNRISE_LOOP_JUMP', desc: `Salto en sunriseLoop: ${j.toFixed(1)}°` });
            }
        }
        if (geom.sunsetLoop && geom.sunsetLoop.length > 0) {
            const j = getMaxJump(geom.sunsetLoop);
            if (j > jumpThreshold) {
                issues.push({ code: 'SUNSET_LOOP_JUMP', desc: `Salto en sunsetLoop: ${j.toFixed(1)}°` });
            }
        }

    } catch (err) {
        issues.push({ code: 'GEOMETRY_EXCEPTION', desc: 'Excepción en cálculo: ' + err.message });
    }

    if (issues.length > 0) {
        console.log(JSON.stringify({
            type: 'anomaly',
            idx,
            cat_no: e.cat_no || e.catalog_number,
            date: `${e.year}-${String(e.month).padStart(2,'0')}-${String(e.day).padStart(2,'0')}`,
            eclipse_type: e.eclipse_type,
            saros: e.saros,
            gamma: e.gamma,
            issues
        }));
    }

    countProcessed++;
    if (countProcessed % reportInterval === 0) {
        console.log(JSON.stringify({ type: 'progress', count: reportInterval }));
    }
}

// Resto no reportado en el bucle
const remainder = countProcessed % reportInterval;
if (remainder > 0) {
    console.log(JSON.stringify({ type: 'progress', count: remainder }));
}

console.log(JSON.stringify({ type: 'done', count: countProcessed }));
