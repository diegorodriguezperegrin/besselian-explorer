/* =========================================================================
   COSMOS MATARÓ - MOTOR ANALÍTICO BESSELIANO (besselian_engine.js)
   Cálculo canónico de elementos besselianos, Día Juliano de Meeus,
   circunstancias locales de eclipse, contactos topocéntricos y franjas
   geográficas de totalidad y anularidad.
   ========================================================================= */

var RAD = Math.PI / 180;
var DEG = 180 / Math.PI;

function getEarthRotationAngleDeg(dtSec) {
    return dtSec ? 1.0027379 * (dtSec / 240.0) : 0;
}

function getJulianDay(year, month, day, hour = 0) {
    let Y = year;
    let M = month;
    if (M <= 2) {
        Y -= 1;
        M += 12;
    }
    const D = day + hour / 24.0;
    const isGregorian = (year > 1582) || (year === 1582 && month > 10) || (year === 1582 && month === 10 && day >= 15);
    let B = 0;
    if (isGregorian) {
        const A = Math.floor(Y / 100);
        B = 2 - A + Math.floor(A / 4);
    }
    return Math.floor(365.25 * (Y + 4716)) + Math.floor(30.6001 * (M + 1)) + D + B - 1524.5;
}

function getEclipseMeeusAngles(eclipse, t = 0) {
    if (!eclipse) return { epsRad: 0.409, epsDeg: 23.44, sunLonDeg: 0, omegaDeg: 0, isDescending: false, eclipseNodeLonDeg: 0, deltaNodeDeg: 0 };
    const ttHour = (eclipse.t0 || 12) + (t || 0);
    const utHour = ttHour - (eclipse.dt || 0) / 3600;
    const jd = getJulianDay(eclipse.year || 2026, eclipse.month || 8, eclipse.day || 12, utHour);
    const T = (jd - 2451545.0) / 36525;

    const epsDeg = 23.4392911 - 0.0130042 * T - 0.00000016 * T * T + 0.000000504 * T * T * T;
    const epsRad = epsDeg * RAD;

    const L0 = 280.46646 + 36000.76983 * T;
    const Msun = (357.52911 + 35999.05029 * T) * RAD;
    const C = (1.914602 - 0.004817 * T) * Math.sin(Msun) + (0.019993 - 0.000101 * T) * Math.sin(2 * Msun) + 0.000289 * Math.sin(3 * Msun);
    const sunLonDeg = ((L0 + C) % 360 + 360) % 360;

    const omegaDeg = ((125.04452 - 1934.136261 * T + 0.0020708 * T * T) % 360 + 360) % 360;
    const isDescending = (eclipse.y1 !== undefined && eclipse.y1 < 0);
    const eclipseNodeLonDeg = isDescending ? ((omegaDeg + 180) % 360) : omegaDeg;

    let deltaNodeDeg = sunLonDeg - eclipseNodeLonDeg;
    while (deltaNodeDeg > 180) deltaNodeDeg -= 360;
    while (deltaNodeDeg < -180) deltaNodeDeg += 360;

    return { epsRad, epsDeg, sunLonDeg, omegaDeg, isDescending, eclipseNodeLonDeg, deltaNodeDeg };
}

function besselianXYToLatLng(eclipse, t, x, y) {
    if (x == null || y == null) return null;
    const d = ((eclipse.d0 || 0) + (eclipse.d1 || 0) * t + (eclipse.d2 || 0) * t * t) * RAD;
    let muDeg = (eclipse.mu0 || 0) + (eclipse.mu1 || 0) * t + (eclipse.mu2 || 0) * t * t;
    if (eclipse.dt) {
        muDeg -= getEarthRotationAngleDeg(eclipse.dt);
    }
    const mu = muDeg * RAD;

    const e2 = 0.006694385; // WGS84
    const sD = Math.sin(d), cD = Math.cos(d);

    const A = 1.0 - e2 * cD * cD;
    const rho1 = Math.sqrt(A);
    const y1 = y / rho1;
    const r1_sq = x * x + y1 * y1;

    if (r1_sq > 1.015) return null;

    let curX = x, curY = y;
    if (r1_sq > 1.0) {
        const scale = 1.0 / Math.sqrt(r1_sq);
        curX = x * scale;
        curY = y * scale;
    }

    const B = e2 * curY * sD * cD;
    const K = (1.0 - e2) * curX * curX + curY * curY * (1.0 - e2 * sD * sD);
    const C_term = K - (1.0 - e2);

    const discr = Math.max(0, B * B - A * C_term);
    const zeta = (-B + Math.sqrt(discr)) / A;

    const z_eq = curY * cD + zeta * sD;
    const x_eq = -curY * sD + zeta * cD;
    const y_eq = curX;

    const rhoCosPhi = Math.hypot(x_eq, y_eq);
    const tanPhi = z_eq / (rhoCosPhi * (1.0 - e2));
    const latGeodetic = Math.atan(tanPhi) * DEG;

    const theta = Math.atan2(y_eq, x_eq);
    let lng = (theta - mu) * DEG;
    lng = ((lng + 180) % 360 + 360) % 360 - 180;

    return { lat: latGeodetic, lon: lng, lng: lng, t: t };
}

function besselianToLatLng(eclipse, t) {
    const x = (eclipse.x0 || 0) + (eclipse.x1 || 0)*t + (eclipse.x2 || 0)*t*t + (eclipse.x3 || 0)*t*t*t;
    const y = (eclipse.y0 || 0) + (eclipse.y1 || 0)*t + (eclipse.y2 || 0)*t*t + (eclipse.y3 || 0)*t*t*t;
    return besselianXYToLatLng(eclipse, t, x, y);
}

function calculatePhysicalObscuration(d, rS, rM) {
    if (d >= rS + rM) return 0.0;
    if (d <= rM - rS) return 1.0;
    if (d <= rS - rM) return (rM * rM) / (rS * rS);
    const r1sq = rS * rS, r2sq = rM * rM;
    const cosAlpha = Math.max(-1.0, Math.min(1.0, (d * d + r1sq - r2sq) / (2.0 * d * rS)));
    const cosBeta = Math.max(-1.0, Math.min(1.0, (d * d + r2sq - r1sq) / (2.0 * d * rM)));
    const alpha = 2.0 * Math.acos(cosAlpha);
    const beta = 2.0 * Math.acos(cosBeta);
    const area = 0.5 * (r1sq * (alpha - Math.sin(alpha)) + r2sq * (beta - Math.sin(beta)));
    return Math.max(0.0, Math.min(1.0, area / (Math.PI * r1sq)));
}

function calculateLocalSolarCircumstances(eclipse, latDeg, lonDeg) {
    if (!eclipse) return null;
    const phi = latDeg * RAD;
    
    const e2 = 0.006694385;
    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);
    const C = 1 / Math.sqrt(1 - e2 * sinPhi * sinPhi);
    const S = (1 - e2) * C;
    const rhoCosPhi = C * cosPhi;
    const rhoSinPhi = S * sinPhi;
    
    const t0 = eclipse.t0 || 0;
    const dt = eclipse.dt || 0;
    const tMin = (eclipse.tmin != null ? eclipse.tmin : -3.0) - 0.8;
    const tMax = (eclipse.tmax != null ? eclipse.tmax : 3.0) + 0.8;
    
    function evalPoly(c0, c1, c2, c3, t) {
        return (c0 || 0) + t * ((c1 || 0) + t * ((c2 || 0) + t * (c3 || 0)));
    }
    
    function getParamsAtT(t) {
        const x = evalPoly(eclipse.x0, eclipse.x1, eclipse.x2, eclipse.x3, t);
        const y = evalPoly(eclipse.y0, eclipse.y1, eclipse.y2, eclipse.y3, t);
        const d = evalPoly(eclipse.d0, eclipse.d1, eclipse.d2, 0, t) * RAD;
        let muDeg = evalPoly(eclipse.mu0, eclipse.mu1, eclipse.mu2, 0, t);
        if (dt) {
            muDeg -= getEarthRotationAngleDeg(dt);
        }
        const theta = (muDeg + lonDeg) * RAD;
        
        const sinD = Math.sin(d), cosD = Math.cos(d);
        const sinTheta = Math.sin(theta), cosTheta = Math.cos(theta);
        
        const xi = rhoCosPhi * sinTheta;
        const eta = rhoSinPhi * cosD - rhoCosPhi * sinD * cosTheta;
        const zeta = rhoSinPhi * sinD + rhoCosPhi * cosD * cosTheta;
        
        const u = x - xi;
        const v = y - eta;
        const delta = Math.sqrt(u * u + v * v);
        
        const l1 = evalPoly(eclipse.l10, eclipse.l11, eclipse.l12, 0, t);
        const l2 = evalPoly(eclipse.l20, eclipse.l21, eclipse.l22, 0, t);
        const tanF1 = eclipse.tan_f1 || 0.0046;
        const tanF2 = eclipse.tan_f2 || 0.00457;
        
        const L1 = l1 - zeta * tanF1;
        const L2 = l2 - zeta * tanF2;
        
        const sinH = Math.sin(phi) * sinD + Math.cos(phi) * cosD * Math.cos(theta);
        const alt = Math.asin(Math.max(-1, Math.min(1, sinH))) * DEG;
        const az = ((Math.atan2(-cosD * sinTheta, sinD * cosPhi - cosD * sinPhi * cosTheta) * DEG) + 360) % 360;
        
        const sinQ = cosPhi * sinTheta;
        const cosQ = sinPhi * cosD - cosPhi * sinD * cosTheta;
        const qDeg = Math.atan2(sinQ, cosQ) * DEG;
        const qRad = Math.atan2(sinQ, cosQ);

        return { t, x, y, xi, eta, zeta, u, v, delta, L1, L2, alt, az, qDeg, qRad, d, theta };
    }
    
    const step = 0.02;
    let minDelta = 999;
    let tMaxEclipse = 0;
    let hasVisibleDaylightEclipse = false;
    for (let t = tMin; t <= tMax; t += step) {
        const p = getParamsAtT(t);
        if (p.delta < minDelta) {
            minDelta = p.delta;
            tMaxEclipse = t;
        }
        if (p.delta < p.L1 && (p.alt > -1.0 || p.zeta > 0)) {
            hasVisibleDaylightEclipse = true;
        }
    }
    
    let left = tMaxEclipse - step, right = tMaxEclipse + step;
    for (let i = 0; i < 20; i++) {
        const m1 = left + (right - left) / 3;
        const m2 = right - (right - left) / 3;
        if (getParamsAtT(m1).delta < getParamsAtT(m2).delta) right = m2;
        else left = m1;
    }
    tMaxEclipse = (left + right) / 2;
    const maxP = getParamsAtT(tMaxEclipse);
    
    const isEclipsed = (maxP.delta < maxP.L1) && (hasVisibleDaylightEclipse || maxP.alt > -1.0 || maxP.zeta > 0);
    const maxMag = isEclipsed ? Math.max(0, (maxP.L1 - maxP.delta) / (maxP.L1 + maxP.L2)) : 0;
    const isTotal = isEclipsed && (maxP.delta < Math.abs(maxP.L2)) && (maxP.L2 < 0);
    const isAnnular = isEclipsed && (maxP.delta < Math.abs(maxP.L2)) && (maxP.L2 > 0);

    let maxObs = 0;
    if (isTotal) {
        maxObs = 1.0;
    } else if (isEclipsed) {
        const rS = (maxP.L1 + maxP.L2) / 2.0;
        const rM = (maxP.L1 - maxP.L2) / 2.0;
        const d = maxP.delta;
        if (d >= rS + rM) {
            maxObs = 0.0;
        } else if (d <= rM - rS) {
            maxObs = 1.0;
        } else if (d <= rS - rM) {
            maxObs = (rM * rM) / (rS * rS);
        } else {
            const r1sq = rS * rS, r2sq = rM * rM;
            const alpha = 2.0 * Math.acos(Math.max(-1.0, Math.min(1.0, (d * d + r1sq - r2sq) / (2.0 * d * rS))));
            const beta = 2.0 * Math.acos(Math.max(-1.0, Math.min(1.0, (d * d + r2sq - r1sq) / (2.0 * d * rM))));
            const area = 0.5 * (r1sq * (alpha - Math.sin(alpha)) + r2sq * (beta - Math.sin(beta)));
            maxObs = Math.max(0.0, Math.min(1.0, area / (Math.PI * r1sq)));
        }
    }
    
    function findRoot(targetFunc, tStart, tEnd) {
        let a = tStart, b = tEnd;
        let fa = targetFunc(a), fb = targetFunc(b);
        if (fa * fb > 0) {
            if (fa < 0 && fb < 0) {
                for (let ext = 0.5; ext <= 3.0; ext += 0.5) {
                    const testA = tStart - ext;
                    const fTest = targetFunc(testA);
                    if (fTest >= 0) { a = testA; fa = fTest; break; }
                }
            }
            if (fa * fb > 0 && fa < 0 && fb < 0) {
                for (let ext = 0.5; ext <= 3.0; ext += 0.5) {
                    const testB = tEnd + ext;
                    const fTest = targetFunc(testB);
                    if (fTest >= 0) { b = testB; fb = fTest; break; }
                }
            }
            if (fa * fb > 0) return null;
        }
        for (let i = 0; i < 25; i++) {
            const mid = (a + b) / 2;
            const fmid = targetFunc(mid);
            if (Math.abs(fmid) < 1e-6) return mid;
            if (fa * fmid < 0) { b = mid; fb = fmid; }
            else { a = mid; fa = fmid; }
        }
        return (a + b) / 2;
    }
    
    const penumbraFunc = (t) => getParamsAtT(t).delta - getParamsAtT(t).L1;
    const umbraFunc = (t) => getParamsAtT(t).delta - Math.abs(getParamsAtT(t).L2);
    
    const c1 = isEclipsed ? findRoot(penumbraFunc, tMin, tMaxEclipse) : null;
    const c4 = isEclipsed ? findRoot(penumbraFunc, tMaxEclipse, tMax) : null;
    const c2 = (isTotal || isAnnular) ? findRoot(umbraFunc, tMin, tMaxEclipse) : null;
    const c3 = (isTotal || isAnnular) ? findRoot(umbraFunc, tMaxEclipse, tMax) : null;

    const c1Params = c1 != null ? getParamsAtT(c1) : null;
    const c2Params = c2 != null ? getParamsAtT(c2) : null;
    const c3Params = c3 != null ? getParamsAtT(c3) : null;
    const c4Params = c4 != null ? getParamsAtT(c4) : null;

    const p1Deg = c1Params ? (Math.atan2(-c1Params.u, -c1Params.v) * DEG + 360) % 360 : null;
    const p2Deg = c2Params ? (Math.atan2(-c2Params.u, -c2Params.v) * DEG + 360) % 360 : null;
    const p3Deg = c3Params ? (Math.atan2(-c3Params.u, -c3Params.v) * DEG + 360) % 360 : null;
    const p4Deg = c4Params ? (Math.atan2(-c4Params.u, -c4Params.v) * DEG + 360) % 360 : null;

    return {
        isEclipsed,
        isTotal,
        isAnnular,
        maxMag,
        maxObs,
        t0,
        tMax: tMaxEclipse,
        maxParams: maxP,
        c1: c1Params,
        c2: c2Params,
        c3: c3Params,
        c4: c4Params,
        p1Deg,
        p2Deg,
        p3Deg,
        p4Deg,
        getParamsAtT
    };
}

function calculateGreatestEclipseCoords(eclipse) {
    if (!eclipse) return { lat: 0, lon: 0, t: 0, gamma: 0 };
    const xPoly = (t) => (eclipse.x0||0) + (eclipse.x1||0)*t + (eclipse.x2||0)*t*t + (eclipse.x3||0)*t*t*t;
    const yPoly = (t) => (eclipse.y0||0) + (eclipse.y1||0)*t + (eclipse.y2||0)*t*t + (eclipse.y3||0)*t*t*t;
    const dxPoly = (t) => (eclipse.x1||0) + 2*(eclipse.x2||0)*t + 3*(eclipse.x3||0)*t*t;
    const dyPoly = (t) => (eclipse.y1||0) + 2*(eclipse.y2||0)*t + 3*(eclipse.y3||0)*t*t;

    const f = (t) => xPoly(t)*dxPoly(t) + yPoly(t)*dyPoly(t);
    const df = (t) => {
        const h = 1e-6;
        return (f(t + h) - f(t - h)) / (2 * h);
    };

    let t = -((eclipse.x0||0)*(eclipse.x1||0) + (eclipse.y0||0)*(eclipse.y1||0)) / (((eclipse.x1||0)**2 + (eclipse.y1||0)**2) || 1);
    for (let i = 0; i < 20; i++) {
        const val = f(t);
        const dval = df(t);
        if (Math.abs(dval) < 1e-12) break;
        const nextT = t - val / dval;
        if (Math.abs(nextT - t) < 1e-12) { t = nextT; break; }
        t = nextT;
    }

    const x = xPoly(t);
    const y = yPoly(t);
    const pt = besselianXYToLatLng(eclipse, t, x, y);
    const gamma = (y >= 0 ? 1 : -1) * Math.sqrt(x*x + y*y);

    return { lat: pt ? pt.lat : 0, lon: pt ? pt.lng : 0, t: t, gamma };
}

function calculateGreatestDurationCoords(eclipse) {
    if (!eclipse || (eclipse.eclipse_type !== 'T' && eclipse.eclipse_type !== 'A' && eclipse.eclipse_type !== 'H')) {
        return { lat: eclipse?.lat_dd_ge || 0, lon: eclipse?.lng_dd_ge || 0, t: 0, durSec: 0 };
    }
    if (eclipse._cachedGD && eclipse._cachedGD.dt === eclipse.dt) {
        return eclipse._cachedGD.result;
    }

    const tMin = eclipse.tmin != null ? eclipse.tmin : -2.5;
    const tMax = eclipse.tmax != null ? eclipse.tmax : 2.5;

    function evalDuration(t) {
        const x = (eclipse.x0 || 0) + (eclipse.x1 || 0)*t + (eclipse.x2 || 0)*t*t + (eclipse.x3 || 0)*t*t*t;
        const y = (eclipse.y0 || 0) + (eclipse.y1 || 0)*t + (eclipse.y2 || 0)*t*t + (eclipse.y3 || 0)*t*t*t;
        const pt = besselianXYToLatLng(eclipse, t, x, y);
        if (!pt) return null;
        const res = calculateLocalSolarCircumstances(eclipse, pt.lat, pt.lng);
        if (res && res.c2 && res.c3) {
            const durSec = (res.c3.t - res.c2.t) * 3600;
            return { lat: pt.lat, lon: pt.lng, t, durSec };
        }
        return null;
    }

    let maxDur = -1, bestPt = null;
    let bestT = tMin;

    const coarseStep = 0.04;
    for (let t = tMin; t <= tMax; t += coarseStep) {
        const res = evalDuration(t);
        if (res && res.durSec > maxDur) {
            maxDur = res.durSec;
            bestPt = res;
            bestT = t;
        }
    }

    if (bestPt) {
        const fineMin = Math.max(tMin, bestT - coarseStep);
        const fineMax = Math.min(tMax, bestT + coarseStep);
        const fineStep = 0.002;
        for (let t = fineMin; t <= fineMax; t += fineStep) {
            const res = evalDuration(t);
            if (res && res.durSec > maxDur) {
                maxDur = res.durSec;
                bestPt = res;
            }
        }
    }

    const result = bestPt || { lat: eclipse.lat_dd_ge || 0, lon: eclipse.lng_dd_ge || 0, t: 0, durSec: 0 };
    eclipse._cachedGD = { dt: eclipse.dt, result };
    return result;
}

function getEclipseTimeBounds(eclipse) {
    const x0 = eclipse.x0 || 0, x1 = eclipse.x1 || 0;
    const y0 = eclipse.y0 || 0, y1 = eclipse.y1 || 0;
    const l10 = eclipse.l10 || 0.54;
    const v2 = x1 * x1 + y1 * y1;
    const v = Math.sqrt(v2) || 0.5;
    const r0_dot_v = x0 * x1 + y0 * y1;
    const tClosest = v2 > 0 ? -r0_dot_v / v2 : 0;
    const r0_sq = x0 * x0 + y0 * y0;
    const rMin_sq = Math.max(0, r0_sq - (r0_dot_v * r0_dot_v) / (v2 || 1));
    const rPenumbra = 1.0 + l10;
    const deltaT = (Math.sqrt(Math.max(0, rPenumbra * rPenumbra - rMin_sq)) / v) + 0.03;
    return { tClosest, deltaT, v, v2, rMin_sq };
}

function getEdgeIntersection(prev, curr, pointAt) {
    if (!pointAt || prev.t == null || curr.t == null) {
        const d_x = curr.x - prev.x;
        const d_y = curr.y - prev.y;
        const a = d_x * d_x + d_y * d_y;
        if (a === 0) return null;
        const b = 2 * (prev.x * d_x + prev.y * d_y);
        const c = (prev.x * prev.x + prev.y * prev.y) - 1.0;
        const disc = b * b - 4 * a * c;
        if (disc >= 0) {
            const sqrtD = Math.sqrt(disc);
            const t1 = (-b - sqrtD) / (2 * a);
            const t2 = (-b + sqrtD) / (2 * a);
            let u = null;
            if (t1 >= 0 && t1 <= 1) u = t1;
            else if (t2 >= 0 && t2 <= 1) u = t2;
            if (u !== null) {
                const t_interp = prev.t + u * (curr.t - prev.t);
                return { x: prev.x + u * d_x, y: prev.y + u * d_y, t: t_interp };
            }
        }
        return null;
    }
    let a = prev.t, b = curr.t;
    const evalR2 = (p) => {
        if (!p) return 2.0;
        return p.r2 != null ? p.r2 : (p.x * p.x + p.y * p.y);
    };
    let fa = evalR2(prev) - 1.0;
    for (let k = 0; k < 40; k++) {
        const m = 0.5 * (a + b);
        const p = pointAt(m);
        if (!p) break;
        const fm = evalR2(p) - 1.0;
        if ((fa < 0) === (fm < 0)) { a = m; fa = fm; }
        else { b = m; }
    }
    const t_mid = 0.5 * (a + b);
    const p_mid = pointAt(t_mid);
    return p_mid ? { t: t_mid, x: p_mid.x, y: p_mid.y, r2: p_mid.r2 } : null;
}

function computeTerminatorIntersectionArc(eclipse, tVal, numSteps = 8) {
    const x = (eclipse.x0 || 0) + (eclipse.x1 || 0)*tVal + (eclipse.x2 || 0)*tVal*tVal + (eclipse.x3 || 0)*tVal*tVal*tVal;
    const y = (eclipse.y0 || 0) + (eclipse.y1 || 0)*tVal + (eclipse.y2 || 0)*tVal*tVal + (eclipse.y3 || 0)*tVal*tVal*tVal;
    const dx = (eclipse.x1 || 0) + 2*(eclipse.x2 || 0)*tVal + 3*(eclipse.x3 || 0)*tVal*tVal;
    const dy = (eclipse.y1 || 0) + 2*(eclipse.y2 || 0)*tVal + 3*(eclipse.y3 || 0)*tVal*tVal;
    const l2 = Math.abs((eclipse.l20 || 0.008) + (eclipse.l21 || 0)*tVal);
    const d = ((eclipse.d0 || 0) + (eclipse.d1 || 0)*tVal + (eclipse.d2 || 0)*tVal*tVal) * Math.PI / 180;
    const cosD = Math.cos(d);
    const rho1 = Math.sqrt(1.0 - 0.006694385 * cosD * cosD);

    const phiC = Math.atan2(y / rho1, x);
    const distAt = (phi) => Math.hypot(Math.cos(phi) - x, Math.sin(phi)*rho1 - y);

    let lowA = 0, highA = 0.35;
    for (let k = 0; k < 30; k++) {
        const mid = 0.5 * (lowA + highA);
        if (distAt(phiC + mid) < l2) lowA = mid;
        else highA = mid;
    }
    const phiA = phiC + 0.5 * (lowA + highA);

    let lowB = 0, highB = 0.35;
    for (let k = 0; k < 30; k++) {
        const mid = 0.5 * (lowB + highB);
        if (distAt(phiC - mid) < l2) lowB = mid;
        else highB = mid;
    }
    const phiB = phiC - 0.5 * (lowB + highB);

    const vlen = Math.hypot(dx, dy) || 1;
    const pxN_nom = x + l2 * (-dy / vlen);
    const pyN_nom = y + l2 * (dx / vlen);
    const dNomA = Math.hypot(Math.cos(phiA) - pxN_nom, Math.sin(phiA)*rho1 - pyN_nom);
    const dNomB = Math.hypot(Math.cos(phiB) - pxN_nom, Math.sin(phiB)*rho1 - pyN_nom);

    const phiNorth = dNomA < dNomB ? phiA : phiB;
    const phiSouth = dNomA < dNomB ? phiB : phiA;

    const arc = [];
    for (let i = 0; i <= numSteps; i++) {
        const frac = i / numSteps;
        const phi = phiNorth + frac * (phiSouth - phiNorth);
        const pt = besselianXYToLatLng(eclipse, tVal, Math.cos(phi), Math.sin(phi)*rho1);
        if (pt) {
            pt.t = tVal;
            arc.push(pt);
        }
    }
    return { arc, ptNorth: arc[0], ptSouth: arc[arc.length - 1], phiNorth, phiSouth };
}

let cachedEclipseGeometry = {
    eclipseKey: null,
    entersCompletely: false,
    centerCoords: [],
    totNorthCoords: [],
    totSouthCoords: [],
    corridorPolygons: [],
    corridorLoop: [],
    sunsetArc: [],
    sunriseArc: [],
    isoLines: [],
    sunriseLoop: [],
    sunsetLoop: [],
    fullEspenakLoop: [],
    espenakSunrisePart: [],
    espenakSunsetPart: [],
    utLines: []
};

function precomputeEclipseGeometry(eclipse) {
    const key = `${eclipse.cat_no || eclipse.catalog_number || ''}_${eclipse.year || ''}-${eclipse.month || ''}-${eclipse.day || ''}_${eclipse.eclipse_type || ''}_${eclipse.t0 || ''}_${eclipse.dt || ''}`;
    if (cachedEclipseGeometry.eclipseKey === key) {
        return cachedEclipseGeometry;
    }

    // Si la magnitud del catálogo es imperceptible (<= 0.001), ningún punto en la Tierra
    // alcanzará el umbral de visibilidad (evaluado como 'No Visible' en clics locales).
    // Omitimos la generación de lóbulos, isolíneas y curvas de horizonte degeneradas
    // para mantener coherencia estricta entre las líneas del mapa y el análisis de visibilidad.
    if (eclipse.magnitude !== undefined && eclipse.magnitude <= 0.001) {
        cachedEclipseGeometry = {
            eclipseKey: key,
            entersCompletely: false,
            centerCoords: [],
            totNorthCoords: [],
            totSouthCoords: [],
            sunriseArc: [],
            sunsetArc: [],
            isoLines: [],
            sunriseLoop: [],
            sunsetLoop: [],
            fullEspenakLoop: [],
            espenakSunrisePart: [],
            espenakSunsetPart: [],
            utLines: []
        };
        return cachedEclipseGeometry;
    }

    const { tClosest, deltaT, rMin_sq } = getEclipseTimeBounds(eclipse);
    const tLoopMin = tClosest - deltaT - 0.3;
    const tLoopMax = tClosest + deltaT + 0.3;
    const dt = 0.004;
    const numSteps = Math.ceil((tLoopMax - tLoopMin) / dt);

    const getRho1 = (t_val) => {
        const d = ((eclipse.d0 || 0) + (eclipse.d1 || 0)*t_val + (eclipse.d2 || 0)*t_val*t_val) * Math.PI / 180;
        const cosD = Math.cos(d);
        return Math.sqrt(1.0 - 0.006694385 * cosD * cosD);
    };

    const getR1Sq = (t_val, px, py) => {
        const rho1 = getRho1(t_val);
        const y1 = py / rho1;
        return px * px + y1 * y1;
    };

    const computeTrajectoryWithExactBounds = (getPointFn) => {
        const coords = [];
        let prev = null;
        for (let i = 0; i <= numSteps; i++) {
            const t = tLoopMin + i * dt;
            const pt = getPointFn(t);
            if (!pt) {
                if (prev && prev.r2 <= 1.0) {
                    let a = prev.t, b = t;
                    for (let k = 0; k < 25; k++) {
                        const m = 0.5 * (a + b);
                        if (getPointFn(m)) a = m;
                        else b = m;
                    }
                    const pExact = getPointFn(a);
                    if (pExact && (pExact.r2 == null || pExact.r2 <= 1.0001)) {
                        const latLng = besselianXYToLatLng(eclipse, a, pExact.x, pExact.y);
                        if (latLng) {
                            latLng.t = a; latLng.x = pExact.x; latLng.y = pExact.y;
                            coords.push(latLng);
                        }
                    }
                }
                prev = null;
                continue;
            }

            if (!prev) {
                let a = t - dt, b = t;
                for (let k = 0; k < 25; k++) {
                    const m = 0.5 * (a + b);
                    if (getPointFn(m)) b = m;
                    else a = m;
                }
                const pExact = getPointFn(b);
                if (pExact) {
                    const latLng = besselianXYToLatLng(eclipse, b, pExact.x, pExact.y);
                    if (latLng) {
                        latLng.t = b; latLng.x = pExact.x; latLng.y = pExact.y;
                        coords.push(latLng);
                    }
                }
            }

            pt.t = t;
            const r2 = pt.r2 != null ? pt.r2 : getR1Sq(t, pt.x, pt.y);
            pt.r2 = r2;

            if (r2 <= 1.0) {
                if (prev && prev.r2 > 1.0) {
                    const edge = getEdgeIntersection(prev, pt, getPointFn);
                    if (edge) {
                        const r1_edge = Math.sqrt(getR1Sq(edge.t, edge.x, edge.y));
                        const scale = (r1_edge > 0) ? (1.0 / r1_edge) : 1.0;
                        const edgeX = edge.x * scale, edgeY = edge.y * scale;
                        const latLng = besselianXYToLatLng(eclipse, edge.t, edgeX, edgeY);
                        if (latLng) {
                            latLng.t = edge.t; latLng.x = edgeX; latLng.y = edgeY;
                            coords.push(latLng);
                        }
                    }
                }
                const latLng = besselianXYToLatLng(eclipse, t, pt.x, pt.y);
                if (latLng) {
                    latLng.t = t; latLng.x = pt.x; latLng.y = pt.y;
                    coords.push(latLng);
                }
            } else if (prev && prev.r2 <= 1.0) {
                const edge = getEdgeIntersection(prev, pt, getPointFn);
                if (edge) {
                    const r1_edge = Math.sqrt(getR1Sq(edge.t, edge.x, edge.y));
                    const scale = (r1_edge > 0) ? (1.0 / r1_edge) : 1.0;
                    const edgeX = edge.x * scale, edgeY = edge.y * scale;
                    const latLng = besselianXYToLatLng(eclipse, edge.t, edgeX, edgeY);
                    if (latLng) {
                        latLng.t = edge.t; latLng.x = edgeX; latLng.y = edgeY;
                        coords.push(latLng);
                    }
                }
            }
            prev = pt;
        }
        return coords;
    };

    // 1. Línea Central
    const centerCoords = computeTrajectoryWithExactBounds(t => {
        const x = (eclipse.x0 || 0) + (eclipse.x1 || 0)*t + (eclipse.x2 || 0)*t*t + (eclipse.x3 || 0)*t*t*t;
        const y = (eclipse.y0 || 0) + (eclipse.y1 || 0)*t + (eclipse.y2 || 0)*t*t + (eclipse.y3 || 0)*t*t*t;
        return { x, y, r2: getR1Sq(t, x, y), t };
    });

    // 2. Límites Norte y Sur
    const typeCode = (eclipse.eclipse_type || '').toUpperCase();
    const isHybrid = typeCode.startsWith('H');
    const isTotalType = typeCode.startsWith('T');
    const isCentral = !typeCode.startsWith('P');
    let totNorthCoords = [];
    let totSouthCoords = [];
    let sunsetArc = [];
    let sunriseArc = [];

    if (isCentral && centerCoords.length >= 2) {
        const computeEnvelopeLimitPoint = (t, isNorth) => {
            const x = (eclipse.x0 || 0) + (eclipse.x1 || 0)*t + (eclipse.x2 || 0)*t*t + (eclipse.x3 || 0)*t*t*t;
            const y = (eclipse.y0 || 0) + (eclipse.y1 || 0)*t + (eclipse.y2 || 0)*t*t + (eclipse.y3 || 0)*t*t*t;
            const xPrime = (eclipse.x1 || 0) + 2*(eclipse.x2 || 0)*t + 3*(eclipse.x3 || 0)*t*t;
            const yPrime = (eclipse.y1 || 0) + 2*(eclipse.y2 || 0)*t + 3*(eclipse.y3 || 0)*t*t;

            const d = ((eclipse.d0 || 0) + (eclipse.d1 || 0) * t + (eclipse.d2 || 0) * t * t) * Math.PI / 180;
            const dPrime = ((eclipse.d1 || 0) + 2 * (eclipse.d2 || 0) * t) * Math.PI / 180;
            const muPrime = ((eclipse.mu1 || 15.004) + 2 * (eclipse.mu2 || 0) * t) * Math.PI / 180;

            const sinD = Math.sin(d), cosD = Math.cos(d);
            const tanF2 = eclipse.tan_f2 || 0.00457;
            const l2 = (eclipse.l20 || 0.008) + (eclipse.l21 || 0)*t + (eclipse.l22 || 0)*t*t;

            const e2 = 0.006694385;
            const A = 1.0 - e2 * cosD * cosD;
            const rho1 = Math.sqrt(A);
            const rCenterSq = x * x + (y / rho1) * (y / rho1);
            if (rCenterSq > 1.3) return null;

            let xi = x, eta = y;
            const sign = isNorth ? 1 : -1;

            for (let iter = 0; iter < 10; iter++) {
                const B = e2 * eta * sinD * cosD;
                const K = (1.0 - e2) * xi * xi + eta * eta * (1.0 - e2 * sinD * sinD);
                const C_term = K - (1.0 - e2);
                const discr = B * B - A * C_term;
                const zeta = discr >= 0 ? (-B + Math.sqrt(discr)) / A : 0;

                let L2_eff = 0;
                if (isHybrid) {
                    const L2_local = l2 - zeta * tanF2;
                    if (L2_local >= 0) return null;
                    L2_eff = -L2_local;
                } else if (isTotalType) {
                    L2_eff = Math.abs(l2) + zeta * tanF2;
                } else {
                    L2_eff = Math.max(0.0001, l2 - zeta * tanF2);
                }

                if (L2_eff <= 0.00001) return null;

                const xiPrime = muPrime * (zeta * cosD - eta * sinD);
                const etaPrime = muPrime * xi * sinD - zeta * dPrime;
                const uPrime = xPrime - xiPrime;
                const vPrime = yPrime - etaPrime;
                const n = Math.hypot(uPrime, vPrime);
                if (n < 1e-6) return null;

                const newXi = x - sign * L2_eff * (vPrime / n);
                const newEta = y + sign * L2_eff * (uPrime / n);

                if (Math.hypot(newXi - xi, newEta - eta) < 1e-8) {
                    xi = newXi; eta = newEta;
                    break;
                }
                xi = newXi; eta = newEta;
            }

            return { x: xi, y: eta, r2: getR1Sq(t, xi, eta), t };
        };

        totNorthCoords = computeTrajectoryWithExactBounds(t => computeEnvelopeLimitPoint(t, true));
        totSouthCoords = computeTrajectoryWithExactBounds(t => computeEnvelopeLimitPoint(t, false));

        const buildTerminatorArc = (pA, pB, pointAtA, pointAtB, numStepsArc = 8) => {
            if (!pA || !pB || pA.t == null || pB.t == null) return [];
            let pA_x = pA.x, pA_y = pA.y;
            let pB_x = pB.x, pB_y = pB.y;
            if (pA_x == null || pA_y == null) {
                const pA_xy = pointAtA(pA.t);
                if (pA_xy) { pA_x = pA_xy.x; pA_y = pA_xy.y; }
            }
            if (pB_x == null || pB_y == null) {
                const pB_xy = pointAtB(pB.t);
                if (pB_xy) { pB_x = pB_xy.x; pB_y = pB_xy.y; }
            }
            if (pA_x == null || pA_y == null || pB_x == null || pB_y == null) return [];
            const rho1A = getRho1(pA.t);
            const rho1B = getRho1(pB.t);
            let phiA = Math.atan2(pA_y / rho1A, pA_x);
            let phiB = Math.atan2(pB_y / rho1B, pB_x);
            let dPhi = phiB - phiA;
            while (dPhi > Math.PI) dPhi -= 2 * Math.PI;
            while (dPhi < -Math.PI) dPhi += 2 * Math.PI;

            const arc = [];
            for (let i = 0; i <= numStepsArc; i++) {
                if (i === 0) {
                    arc.push({ lat: pA.lat, lon: pA.lng != null ? pA.lng : pA.lon, lng: pA.lng != null ? pA.lng : pA.lon, t: pA.t, x: pA_x, y: pA_y });
                    continue;
                }
                if (i === numStepsArc) {
                    arc.push({ lat: pB.lat, lon: pB.lng != null ? pB.lng : pB.lon, lng: pB.lng != null ? pB.lng : pB.lon, t: pB.t, x: pB_x, y: pB_y });
                    continue;
                }
                const frac = i / numStepsArc;
                const t = pA.t + frac * (pB.t - pA.t);
                const phi = phiA + frac * dPhi;
                const rho1 = getRho1(t);
                const x = Math.cos(phi);
                const y = Math.sin(phi) * rho1;
                const pt = besselianXYToLatLng(eclipse, t, x, y);
                if (pt) {
                    pt.t = t; pt.x = x; pt.y = y;
                    arc.push(pt);
                }
            }
            return arc;
        };

        if (totNorthCoords.length >= 2 && totSouthCoords.length >= 2) {
            const nFirst = totNorthCoords[0], nLast = totNorthCoords[totNorthCoords.length - 1];
            const sFirst = totSouthCoords[0], sLast = totSouthCoords[totSouthCoords.length - 1];
            const dStartDeg = Math.hypot(nFirst.lat - sFirst.lat, (nFirst.lng || nFirst.lon || 0) - (sFirst.lng || sFirst.lon || 0));
            const dEndDeg = Math.hypot(nLast.lat - sLast.lat, (nLast.lng || nLast.lon || 0) - (sLast.lng || sLast.lon || 0));

            // Solo construir arcos de terminador si los extremos tocan realmente el limbo/terminador terrestre (R1^2 >= 0.985).
            // Si el eclipse empieza o termina dentro del disco iluminado (e.g. eclipses híbridos o rasantes),
            // los límites norte y sur convergen en un ápice cerrado y no existe arco de terminador.
            const r2StartN = nFirst.r2 != null ? nFirst.r2 : getR1Sq(nFirst.t, nFirst.x, nFirst.y);
            const r2StartS = sFirst.r2 != null ? sFirst.r2 : getR1Sq(sFirst.t, sFirst.x, sFirst.y);
            const r2EndN = nLast.r2 != null ? nLast.r2 : getR1Sq(nLast.t, nLast.x, nLast.y);
            const r2EndS = sLast.r2 != null ? sLast.r2 : getR1Sq(sLast.t, sLast.x, sLast.y);

            const isStartAtTerminator = (r2StartN >= 0.985 && r2StartS >= 0.985);
            const isEndAtTerminator = (r2EndN >= 0.985 && r2EndS >= 0.985);

            sunsetArc = (isEndAtTerminator && dEndDeg > 0.02) ? buildTerminatorArc(nLast, sLast, t => computeEnvelopeLimitPoint(t, true), t => computeEnvelopeLimitPoint(t, false), 8) : [];
            sunriseArc = (isStartAtTerminator && dStartDeg > 0.02) ? buildTerminatorArc(sFirst, nFirst, t => computeEnvelopeLimitPoint(t, false), t => computeEnvelopeLimitPoint(t, true), 8) : [];
        }
    }

    // 3. Isomagnitudes
    const isoLines = [];
    const magFracs = [0.0, 0.20, 0.40, 0.60, 0.80];

    const getIsomagnitudePoint = (t_val, frac, isNorth) => {
        const x = (eclipse.x0 || 0) + (eclipse.x1 || 0)*t_val + (eclipse.x2 || 0)*t_val*t_val + (eclipse.x3 || 0)*t_val*t_val*t_val;
        const y = (eclipse.y0 || 0) + (eclipse.y1 || 0)*t_val + (eclipse.y2 || 0)*t_val*t_val + (eclipse.y3 || 0)*t_val*t_val*t_val;
        const x_prime = (eclipse.x1 || 0) + 2*(eclipse.x2 || 0)*t_val + 3*(eclipse.x3 || 0)*t_val*t_val;
        const y_prime = (eclipse.y1 || 0) + 2*(eclipse.y2 || 0)*t_val + 3*(eclipse.y3 || 0)*t_val*t_val;
        const L1 = (eclipse.l10 || 0.54) + (eclipse.l11 || 0)*t_val;
        const tanF1 = eclipse.tan_f1 || 0.0046;

        const d_rad = ((eclipse.d0 || 0) + (eclipse.d1 || 0)*t_val + (eclipse.d2 || 0)*t_val*t_val) * Math.PI / 180;
        const sinD = Math.sin(d_rad), cosD = Math.cos(d_rad);
        const mu_prime = (eclipse.mu1 || 15.004) * Math.PI / 180;
        const rho1 = getRho1(t_val);

        const rC2 = Math.min(0.99, x*x + (y / rho1)*(y / rho1));
        const zC = Math.sqrt(Math.max(0, 1.0 - rC2));
        let u = x_prime - mu_prime * (zC * cosD - y * sinD);
        let v = y_prime - mu_prime * x * sinD;

        let xi = x, eta = y;
        const sign = isNorth ? 1 : -1;
        let L1_z = Math.max(0.001, L1 - zC * tanF1);
        let dist = L1_z * (1.0 - frac);

        for (let iter = 0; iter < 5; iter++) {
            const vlen = Math.hypot(u, v) || 1;
            const nx = -v / vlen;
            const ny =  u / vlen;
            xi = x + sign * dist * nx;
            eta = y + sign * dist * ny;

            const r1_sq = xi*xi + (eta / rho1)*(eta / rho1);
            const zeta = r1_sq <= 1.0 ? Math.sqrt(1.0 - r1_sq) : 0;
            L1_z = Math.max(0.001, L1 - zeta * tanF1);
            dist = L1_z * (1.0 - frac);

            u = x_prime - mu_prime * (zeta * cosD - eta * sinD);
            v = y_prime - mu_prime * xi * sinD;
        }

        const vlen = Math.hypot(u, v) || 1;
        xi = x + sign * dist * (-v / vlen);
        eta = y + sign * dist * (u / vlen);
        const r1_sq = xi*xi + (eta / rho1)*(eta / rho1);
        return { x: xi, y: eta, r2: r1_sq, t: t_val };
    };

    magFracs.forEach(frac => {
        let isoNorthCoords = [];
        let isoSouthCoords = [];
        let prevN = null, prevS = null;

        for (let i = 0; i <= numSteps; i++) {
            const t = tLoopMin + i * dt;
            const currN = getIsomagnitudePoint(t, frac, true);
            const currS = getIsomagnitudePoint(t, frac, false);

            if (currN.r2 <= 1.0) {
                if (prevN && prevN.r2 > 1.0) {
                    const edge = getEdgeIntersection(prevN, currN, tVal => getIsomagnitudePoint(tVal, frac, true));
                    if (edge) {
                        const r1_edge = Math.sqrt(getR1Sq(edge.t, edge.x, edge.y));
                        const scale = (r1_edge > 0) ? (1.0 / r1_edge) : 1.0;
                        const edgeX = edge.x * scale, edgeY = edge.y * scale;
                        const ptEdge = besselianXYToLatLng(eclipse, edge.t, edgeX, edgeY);
                        if (ptEdge) isoNorthCoords.push(ptEdge);
                    }
                }
                const ptN = besselianXYToLatLng(eclipse, t, currN.x, currN.y);
                if (ptN) isoNorthCoords.push(ptN);
            } else if (prevN && prevN.r2 <= 1.0) {
                const edge = getEdgeIntersection(prevN, currN, tVal => getIsomagnitudePoint(tVal, frac, true));
                if (edge) {
                    const r1_edge = Math.sqrt(getR1Sq(edge.t, edge.x, edge.y));
                    const scale = (r1_edge > 0) ? (1.0 / r1_edge) : 1.0;
                    const edgeX = edge.x * scale, edgeY = edge.y * scale;
                    const ptEdge = besselianXYToLatLng(eclipse, edge.t, edgeX, edgeY);
                    if (ptEdge) isoNorthCoords.push(ptEdge);
                }
            }

            if (currS.r2 <= 1.0) {
                if (prevS && prevS.r2 > 1.0) {
                    const edge = getEdgeIntersection(prevS, currS, tVal => getIsomagnitudePoint(tVal, frac, false));
                    if (edge) {
                        const r1_edge = Math.sqrt(getR1Sq(edge.t, edge.x, edge.y));
                        const scale = (r1_edge > 0) ? (1.0 / r1_edge) : 1.0;
                        const edgeX = edge.x * scale, edgeY = edge.y * scale;
                        const ptEdge = besselianXYToLatLng(eclipse, edge.t, edgeX, edgeY);
                        if (ptEdge) isoSouthCoords.push(ptEdge);
                    }
                }
                const ptS = besselianXYToLatLng(eclipse, t, currS.x, currS.y);
                if (ptS) isoSouthCoords.push(ptS);
            } else if (prevS && prevS.r2 <= 1.0) {
                const edge = getEdgeIntersection(prevS, currS, tVal => getIsomagnitudePoint(tVal, frac, false));
                if (edge) {
                    const r1_edge = Math.sqrt(getR1Sq(edge.t, edge.x, edge.y));
                    const scale = (r1_edge > 0) ? (1.0 / r1_edge) : 1.0;
                    const edgeX = edge.x * scale, edgeY = edge.y * scale;
                    const ptEdge = besselianXYToLatLng(eclipse, edge.t, edgeX, edgeY);
                    if (ptEdge) isoSouthCoords.push(ptEdge);
                }
            }

            prevN = currN;
            prevS = currS;
        }

        let midPtN = null, midPtS = null;
        let magText = null;
        if (frac > 0) {
            magText = frac.toFixed(2);
            if (isoNorthCoords.length > 8) midPtN = isoNorthCoords[Math.floor(isoNorthCoords.length * 0.5)];
            if (isoSouthCoords.length > 8) midPtS = isoSouthCoords[Math.floor(isoSouthCoords.length * 0.5)];
        }

        isoLines.push({ frac, isoNorthCoords, isoSouthCoords, magText, midPtN, midPtS });
    });

    // 4. Curvas de Espenak (Máximo en el horizonte diurno)
    const srA = [], srB = [];
    const ssA = [], ssB = [];

    const l1Closest = (eclipse.l10 || 0.54) + (eclipse.l11 || 0) * tClosest;
    const rMin = Math.sqrt(rMin_sq != null ? rMin_sq : 0);
    const entersCompletely = (rMin < (1.0 - l1Closest));

    const findLimbContactPoint = (tA, tB, isOuter) => {
        let a = tA, b = tB;
        const evalDiff = (m) => {
            const xm = (eclipse.x0||0) + (eclipse.x1||0)*m + (eclipse.x2||0)*m*m + (eclipse.x3||0)*m*m*m;
            const ym = (eclipse.y0||0) + (eclipse.y1||0)*m + (eclipse.y2||0)*m*m + (eclipse.y3||0)*m*m*m;
            const l1m = (eclipse.l10||0.54) + (eclipse.l11||0)*m;
            const rm = Math.hypot(xm, ym);
            const target = isOuter ? (1.0 + l1m) : Math.abs(1.0 - l1m);
            return rm - target;
        };
        let fa = evalDiff(a);
        for (let k = 0; k < 35; k++) {
            const m = 0.5 * (a + b);
            const fm = evalDiff(m);
            if ((fm > 0) === (fa > 0)) a = m;
            else b = m;
        }
        const tMid = 0.5 * (a + b);
        const xMid = (eclipse.x0||0) + (eclipse.x1||0)*tMid + (eclipse.x2||0)*tMid*tMid + (eclipse.x3||0)*tMid*tMid*tMid;
        const yMid = (eclipse.y0||0) + (eclipse.y1||0)*tMid + (eclipse.y2||0)*tMid*tMid + (eclipse.y3||0)*tMid*tMid*tMid;
        const RMid = Math.hypot(xMid, yMid);
        if (RMid === 0) return null;
        const pt = besselianXYToLatLng(eclipse, tMid, xMid / RMid, yMid / RMid);
        if (pt) {
            pt.t = tMid; pt.x = xMid / RMid; pt.y = yMid / RMid;
        }
        return pt;
    };

    const getEspenakPoint = (t, isBranchA) => {
        const x = (eclipse.x0 || 0) + (eclipse.x1 || 0)*t + (eclipse.x2 || 0)*t*t + (eclipse.x3 || 0)*t*t*t;
        const y = (eclipse.y0 || 0) + (eclipse.y1 || 0)*t + (eclipse.y2 || 0)*t*t + (eclipse.y3 || 0)*t*t*t;
        const u = (eclipse.x1 || 0) + 2*(eclipse.x2 || 0)*t + 3*(eclipse.x3 || 0)*t*t;
        const v = (eclipse.y1 || 0) + 2*(eclipse.y2 || 0)*t + 3*(eclipse.y3 || 0)*t*t;
        const dDeg = (eclipse.d0 || 0) + (eclipse.d1 || 0)*t + (eclipse.d2 || 0)*t*t;
        const omega = Math.sin(dDeg * Math.PI / 180) * (eclipse.mu1 || 15.004) * Math.PI / 180;
        const u_eff = u + omega * y;
        const v_eff = v - omega * x;
        const c = u_eff*x + v_eff*y;
        const veff2 = u_eff*u_eff + v_eff*v_eff;
        if (veff2 <= 0) return null;
        const x_proj = c * u_eff / veff2;
        const y_proj = c * v_eff / veff2;
        const h2 = 1.0 - (x_proj*x_proj + y_proj*y_proj);
        if (h2 < 0) return null;
        const h = Math.sqrt(h2);
        const Veff = Math.sqrt(veff2);
        const sign = isBranchA ? 1 : -1;
        const xi = x_proj - sign * h * v_eff / Veff;
        const eta = y_proj + sign * h * u_eff / Veff;
        const l1 = (eclipse.l10 || 0.54) + (eclipse.l11 || 0)*t;
        const d = Math.hypot(xi - x, eta - y);
        return { t, xi, eta, d, l1, inside: (d <= l1 + 0.0001) };
    };

    const findEspenakBoundaryPoint = (tIn, tOut, isBranchA) => {
        let a = tIn, b = tOut;
        for (let iter = 0; iter < 20; iter++) {
            const m = 0.5 * (a + b);
            const pt = getEspenakPoint(m, isBranchA);
            if (!pt || !pt.inside) b = m;
            else a = m;
        }
        const pt = getEspenakPoint(a, isBranchA);
        if (!pt) return null;
        const p = besselianXYToLatLng(eclipse, pt.t, pt.xi, pt.eta);
        if (p) {
            p.t = pt.t; p.x = pt.xi; p.y = pt.eta;
        }
        return p;
    };

    let prevInA = false, prevInB = false, prevT = tLoopMin;

    for (let i = 0; i <= numSteps; i++) {
        const t = tLoopMin + i * dt;
        const ptA = getEspenakPoint(t, true);
        const ptB = getEspenakPoint(t, false);

        if (ptA && ptA.inside) {
            if (!prevInA) {
                const edge = findEspenakBoundaryPoint(t, prevT, true);
                if (edge) { if (t < tClosest) srA.push(edge); else ssA.push(edge); }
            }
            const p = besselianXYToLatLng(eclipse, t, ptA.xi, ptA.eta);
            if (p) {
                p.t = t; p.x = ptA.xi; p.y = ptA.eta;
                if (t < tClosest) srA.push(p); else ssA.push(p);
            }
            prevInA = true;
        } else {
            if (prevInA) {
                const edge = findEspenakBoundaryPoint(prevT, t, true);
                if (edge) { if (prevT < tClosest) srA.push(edge); else ssA.push(edge); }
            }
            prevInA = false;
        }

        if (ptB && ptB.inside) {
            if (!prevInB) {
                const edge = findEspenakBoundaryPoint(t, prevT, false);
                if (edge) { if (t < tClosest) srB.push(edge); else ssB.push(edge); }
            }
            const p = besselianXYToLatLng(eclipse, t, ptB.xi, ptB.eta);
            if (p) {
                p.t = t; p.x = ptB.xi; p.y = ptB.eta;
                if (t < tClosest) srB.push(p); else ssB.push(p);
            }
            prevInB = true;
        } else {
            if (prevInB) {
                const edge = findEspenakBoundaryPoint(prevT, t, false);
                if (edge) { if (prevT < tClosest) srB.push(edge); else ssB.push(edge); }
            }
            prevInB = false;
        }

        prevT = t;
    }

    // Puntos de tangencia en el limbo terrestre
    const ptSrOuter = findLimbContactPoint(tLoopMin, tClosest, true);
    const ptSrInner = entersCompletely ? findLimbContactPoint(tLoopMin, tClosest, false) : null;
    const ptSsInner = entersCompletely ? findLimbContactPoint(tClosest, tLoopMax, false) : null;
    const ptSsOuter = findLimbContactPoint(tClosest, tLoopMax, true);

    // Muestreo temporal continuo de las dos ramas analíticas de contacto en el limbo (p3 y p4)
    const sampleLimbBranches = (tStart, tEnd) => {
        const branch3 = [];
        const branch4 = [];
        const dtLobe = 0.003;
        const nSteps = Math.ceil(Math.abs(tEnd - tStart) / dtLobe);

        for (let i = 0; i <= nSteps; i++) {
            const t = tStart + i * (tEnd - tStart) / nSteps;
            const x = (eclipse.x0 || 0) + (eclipse.x1 || 0)*t + (eclipse.x2 || 0)*t*t + (eclipse.x3 || 0)*t*t*t;
            const y = (eclipse.y0 || 0) + (eclipse.y1 || 0)*t + (eclipse.y2 || 0)*t*t + (eclipse.y3 || 0)*t*t*t;
            const l1 = (eclipse.l10 || 0.54) + (eclipse.l11 || 0)*t;
            const R = Math.hypot(x, y);

            if (R > 0.001 && Math.abs(1.0 - l1) <= R && R <= (1.0 + l1)) {
                const a = (1.0 - l1*l1 + R*R) / (2.0 * R);
                const h_limb = Math.sqrt(Math.max(0, 1.0 - a*a));
                const x2 = a * x / R, y2 = a * y / R;

                const p3x = x2 + h_limb * y / R;
                const p3y = y2 - h_limb * x / R;
                const p4x = x2 - h_limb * y / R;
                const p4y = y2 + h_limb * x / R;

                const ll3 = besselianXYToLatLng(eclipse, t, p3x, p3y);
                const ll4 = besselianXYToLatLng(eclipse, t, p4x, p4y);

                if (ll3) { ll3.t = t; ll3.x = p3x; ll3.y = p3y; branch3.push(ll3); }
                if (ll4) { ll4.t = t; ll4.x = p4x; ll4.y = p4y; branch4.push(ll4); }
            }
        }
        return { branch3, branch4 };
    };

    // -------------------------------------------------------------
    // TOPOLOGÍA RIGUROSA DE LÓBULOS (CANÓNICA ESPENAK / BESSEL)
    // -------------------------------------------------------------
    let sunriseLoop = [];
    let sunsetLoop = [];

    if (entersCompletely) {
        // Eclipse con entrada completa: dos lazos cerrados independientes
        const srLimb = sampleLimbBranches(tLoopMin, tClosest);
        const ssLimb = sampleLimbBranches(tClosest, tLoopMax);

        if (srLimb.branch3.length > 0 || srLimb.branch4.length > 0) {
            sunriseLoop = (ptSrOuter ? [ptSrOuter] : [])
                .concat(srLimb.branch3)
                .concat(ptSrInner ? [ptSrInner] : [])
                .concat(srLimb.branch4.slice().reverse());
            if (ptSrOuter && sunriseLoop.length > 0) sunriseLoop.push(ptSrOuter);
        }

        if (ssLimb.branch3.length > 0 || ssLimb.branch4.length > 0) {
            sunsetLoop = (ptSsInner ? [ptSsInner] : [])
                .concat(ssLimb.branch3)
                .concat(ptSsOuter ? [ptSsOuter] : [])
                .concat(ssLimb.branch4.slice().reverse());
            if (ptSsInner && sunsetLoop.length > 0) sunsetLoop.push(ptSsInner);
        }
    } else {
        // Eclipse polar o rasante: la penumbra no se separa del limbo
        const allLimb = sampleLimbBranches(tLoopMin, tLoopMax);

        // El contorno cerrado continuo de la penumbra en el limbo:
        // Desde el ápice del Pacífico (ptSrOuter) a lo largo de la rama 3 hasta el ápice del Atlántico (ptSsOuter),
        // y de regreso continuo a lo largo de la rama 4 hacia el ápice del Pacífico.
        const contour = (ptSrOuter ? [ptSrOuter] : [])
            .concat(allLimb.branch3)
            .concat(ptSsOuter ? [ptSsOuter] : [])
            .concat(allLimb.branch4.slice().reverse());

        // Clasificación astronómica canónica y rigurosa en el plano fundamental de Bessel:
        // En el plano fundamental, el eje X apunta al este. El limbo oeste (x < 0) corresponde
        // estrictamente a la salida del Sol (Amanecer / Sunrise), y el limbo este (x >= 0)
        // corresponde estrictamente a la puesta del Sol (Atardecer / Sunset).
        const isSunrisePt = (p) => (p && p.x < 0);

        contour.forEach(p => { p.isSr = isSunrisePt(p); });

        let idxSrToSs = -1, idxSsToSr = -1;
        for (let i = 1; i < contour.length; i++) {
            if (contour[i - 1].isSr && !contour[i].isSr) idxSrToSs = i;
            if (!contour[i - 1].isSr && contour[i].isSr) idxSsToSr = i;
        }

        if (idxSrToSs !== -1 && idxSsToSr !== -1) {
            // Tramo de Puesta (Sunset): desde la transición a Sunset (Yamal/Siberia) recorriendo Europa/Mediterráneo/Atlántico hasta la transición a Sunrise (Taymyr)
            sunsetLoop = contour.slice(idxSrToSs, idxSsToSr);
            // Tramo de Salida (Sunrise): desde Taymyr rodeando el Pacífico norte / estrecho de Bering hasta Yamal
            sunriseLoop = contour.slice(idxSsToSr).concat(contour.slice(0, idxSrToSs));
        } else {
            sunriseLoop = contour.filter(p => p.isSr);
            sunsetLoop = contour.filter(p => !p.isSr);
        }
    }

    // Ensamblaje de curvas de horizonte (Espenak)
    let fullEspenakLoop = [];
    let espenakSunrisePart = [];
    let espenakSunsetPart = [];

    if (entersCompletely) {
        espenakSunrisePart = srB.slice().reverse().concat(srA);
        espenakSunsetPart = ssA.concat(ssB.slice().reverse());
    } else {
        // En eclipses que no entran completamente (rasantes o polares):
        // Identificar qué rama (A o B) recorre el cuerpo principal hacia tClosest,
        // y qué rama contiene los extremos que conectan con los lóbulos de penumbra (d = l1)
        // a través del punto de inflexión en el limbo (h = 0).
        if (srA.length >= srB.length) {
            espenakSunrisePart = srB.slice().reverse().concat(srA);
            espenakSunsetPart = ssA.concat(ssB.slice().reverse());
        } else {
            espenakSunrisePart = srA.slice().reverse().concat(srB);
            espenakSunsetPart = ssB.concat(ssA.slice().reverse());
        }
    }

    const snapToLobeApex = (curvePart, apexPt) => {
        if (!curvePart || curvePart.length === 0 || !apexPt) return;
        const dStart = Math.hypot(curvePart[0].lat - apexPt.lat, (curvePart[0].lng || curvePart[0].lon || 0) - (apexPt.lng || apexPt.lon || 0));
        const dEnd = Math.hypot(curvePart[curvePart.length - 1].lat - apexPt.lat, (curvePart[curvePart.length - 1].lng || curvePart[curvePart.length - 1].lon || 0) - (apexPt.lng || apexPt.lon || 0));
        if (dStart < dEnd && dStart < 5.0) {
            curvePart.unshift({ lat: apexPt.lat, lng: apexPt.lng != null ? apexPt.lng : apexPt.lon, lon: apexPt.lng != null ? apexPt.lng : apexPt.lon, t: apexPt.t });
        } else if (dEnd < 5.0) {
            curvePart.push({ lat: apexPt.lat, lng: apexPt.lng != null ? apexPt.lng : apexPt.lon, lon: apexPt.lng != null ? apexPt.lng : apexPt.lon, t: apexPt.t });
        }
    };

    if (ptSrOuter && espenakSunrisePart.length > 0) snapToLobeApex(espenakSunrisePart, ptSrOuter);
    if (ptSsOuter && espenakSunsetPart.length > 0) snapToLobeApex(espenakSunsetPart, ptSsOuter);

    // Ajuste milimétrico de contacto directo con los lóbulos diurnos (sunriseLoop y sunsetLoop)
    const snapToNearestInLobe = (curve, lobe, isStart, maxDistDeg = 5.0) => {
        if (!curve || curve.length === 0 || !lobe || lobe.length === 0) return;
        const targetPt = isStart ? curve[0] : curve[curve.length - 1];
        let bestPt = null, minDist = maxDistDeg;
        for (let i = 0; i < lobe.length; i++) {
            const lp = lobe[i];
            let dLon = (lp.lng != null ? lp.lng : lp.lon) - (targetPt.lng != null ? targetPt.lng : targetPt.lon);
            while (dLon > 180) dLon -= 360;
            while (dLon < -180) dLon += 360;
            const cosLat = Math.cos(0.5 * (lp.lat + targetPt.lat) * Math.PI / 180);
            const d = Math.hypot(lp.lat - targetPt.lat, dLon * cosLat);
            if (d < minDist) { minDist = d; bestPt = lp; }
        }
        if (bestPt) {
            const snapped = { lat: bestPt.lat, lng: bestPt.lng != null ? bestPt.lng : bestPt.lon, lon: bestPt.lng != null ? bestPt.lng : bestPt.lon, t: targetPt.t };
            if (isStart) curve[0] = snapped;
            else curve[curve.length - 1] = snapped;
        }
    };

    if (espenakSunrisePart.length > 0 && sunriseLoop.length > 0) {
        snapToNearestInLobe(espenakSunrisePart, sunriseLoop, true, 5.0);
    }
    if (espenakSunsetPart.length > 0 && sunsetLoop.length > 0) {
        snapToNearestInLobe(espenakSunsetPart, sunsetLoop, false, 5.0);
    }

    if (!entersCompletely && espenakSunrisePart.length > 0 && espenakSunsetPart.length > 0) {
        const p1 = espenakSunrisePart[espenakSunrisePart.length - 1];
        const p2 = espenakSunsetPart[0];
        let dLon = (p2.lng || p2.lon || 0) - (p1.lng || p1.lon || 0);
        while (dLon > 180) dLon -= 360;
        while (dLon < -180) dLon += 360;
        const distGap = Math.hypot(p2.lat - p1.lat, dLon);

        if (distGap < 5.0) {
            fullEspenakLoop = espenakSunrisePart.concat(espenakSunsetPart);
        } else {
            fullEspenakLoop = [];
        }
    } else if (!entersCompletely) {
        fullEspenakLoop = espenakSunrisePart.length > 0 ? espenakSunrisePart : espenakSunsetPart;
    } else {
        fullEspenakLoop = [];
    }

    // Remate suave de isomagnitudes con el horizonte diurno
    const allDiurnalBoundaryPts = [...espenakSunrisePart, ...espenakSunsetPart, ...sunriseLoop, ...sunsetLoop];
    if (allDiurnalBoundaryPts.length > 0) {
        const snapEndpointToHorizon = (coords, maxDistDeg = 15) => {
            if (!coords || coords.length < 2) return;
            const pStart = coords[0];
            let bestStart = null, minDStart = maxDistDeg;
            for (let i = 0; i < allDiurnalBoundaryPts.length; i++) {
                const dp = allDiurnalBoundaryPts[i];
                let dLon = (dp.lng != null ? dp.lng : dp.lon) - (pStart.lng != null ? pStart.lng : pStart.lon);
                while (dLon > 180) dLon -= 360;
                while (dLon < -180) dLon += 360;
                const d = Math.hypot(dp.lat - pStart.lat, dLon);
                if (d < minDStart) { minDStart = d; bestStart = dp; }
            }
            if (bestStart && minDStart > 0.001) {
                coords.unshift({ lat: bestStart.lat, lng: bestStart.lng != null ? bestStart.lng : bestStart.lon, lon: bestStart.lng != null ? bestStart.lng : bestStart.lon, t: pStart.t });
            }
            const pEnd = coords[coords.length - 1];
            let bestEnd = null, minDEnd = maxDistDeg;
            for (let i = 0; i < allDiurnalBoundaryPts.length; i++) {
                const dp = allDiurnalBoundaryPts[i];
                let dLon = (dp.lng != null ? dp.lng : dp.lon) - (pEnd.lng != null ? pEnd.lng : pEnd.lon);
                while (dLon > 180) dLon -= 360;
                while (dLon < -180) dLon += 360;
                const d = Math.hypot(dp.lat - pEnd.lat, dLon);
                if (d < minDEnd) { minDEnd = d; bestEnd = dp; }
            }
            if (bestEnd && minDEnd > 0.001) {
                coords.push({ lat: bestEnd.lat, lng: bestEnd.lng != null ? bestEnd.lng : bestEnd.lon, lon: bestEnd.lng != null ? bestEnd.lng : bestEnd.lon, t: pEnd.t });
            }
        };

        isoLines.forEach(iso => {
            if (iso.isoNorthCoords && iso.isoNorthCoords.length >= 2) snapEndpointToHorizon(iso.isoNorthCoords);
            if (iso.isoSouthCoords && iso.isoSouthCoords.length >= 2) snapEndpointToHorizon(iso.isoSouthCoords);
        });
    }

    // 5. Cierre de polígonos del pasillo
    let corridorLoop = [];
    let corridorPolygons = [];

    if (isCentral && totNorthCoords.length > 1 && totSouthCoords.length > 1) {
        const sunsetIntermediates = sunsetArc.length > 2 ? sunsetArc.slice(1, -1) : [];
        const sunriseIntermediates = sunriseArc.length > 2 ? sunriseArc.slice(1, -1) : [];

        corridorLoop = [
            ...totNorthCoords.map(p => ({ lat: p.lat, lng: p.lng != null ? p.lng : p.lon, t: p.t })),
            ...sunsetIntermediates.map(p => ({ lat: p.lat, lng: p.lng != null ? p.lng : p.lon, t: p.t })),
            ...totSouthCoords.slice().reverse().map(p => ({ lat: p.lat, lng: p.lng != null ? p.lng : p.lon, t: p.t })),
            ...sunriseIntermediates.map(p => ({ lat: p.lat, lng: p.lng != null ? p.lng : p.lon, t: p.t }))
        ];

        let hasCrossing = false;
        for (let i = 0; i < corridorLoop.length; i++) {
            const p1 = corridorLoop[i];
            const p2 = corridorLoop[(i + 1) % corridorLoop.length];
            if (Math.abs(p2.lng - p1.lng) > 180) {
                hasCrossing = true;
                break;
            }
        }

        if (!hasCrossing) {
            corridorPolygons = [corridorLoop.map(p => [p.lat, p.lng])];
        } else {
            const eastSegs = [], westSegs = [];
            let curEast = [], curWest = [];

            for (let i = 0; i < corridorLoop.length; i++) {
                const p1 = corridorLoop[i];
                const p2 = corridorLoop[(i + 1) % corridorLoop.length];
                const isEast1 = p1.lng >= 0;
                if (isEast1) curEast.push([p1.lat, p1.lng]);
                else curWest.push([p1.lat, p1.lng]);

                const dLng = p2.lng - p1.lng;
                if (Math.abs(dLng) > 180) {
                    if (isEast1) {
                        const frac = (180 - p1.lng) / ((p2.lng + 360) - p1.lng);
                        const latInt = p1.lat + frac * (p2.lat - p1.lat);
                        curEast.push([latInt, 179.9999]);
                        eastSegs.push(curEast);
                        curEast = [];
                        curWest.push([latInt, -179.9999]);
                    } else {
                        const frac = (-180 - p1.lng) / ((p2.lng - 360) - p1.lng);
                        const latInt = p1.lat + frac * (p2.lat - p1.lat);
                        curWest.push([latInt, -179.9999]);
                        westSegs.push(curWest);
                        curWest = [];
                        curEast.push([latInt, 179.9999]);
                    }
                }
            }
            if (curEast.length > 0) {
                if (eastSegs.length > 0) eastSegs[0] = [...curEast, ...eastSegs[0]];
                else eastSegs.push(curEast);
            }
            if (curWest.length > 0) {
                if (westSegs.length > 0) westSegs[0] = [...curWest, ...westSegs[0]];
                else westSegs.push(curWest);
            }
            eastSegs.forEach(seg => { if (seg.length >= 3) corridorPolygons.push(seg); });
            westSegs.forEach(seg => { if (seg.length >= 3) corridorPolygons.push(seg); });
        }
    }

    // 6. Líneas de Tiempo Universal (Horas UT)
    const utLines = [];
    const dtHours = (eclipse.dt || 0) / 3600;
    const utGE = (eclipse.t0 || 12) + tClosest - dtHours;
    const winHours = 1.25;
    const utMin = utGE - winHours;
    const utMax = utGE + winHours;
    const stepHours = 0.5;
    const startHalfHour = Math.ceil(utMin / stepHours) * stepHours;
    const endHalfHour = Math.floor(utMax / stepHours) * stepHours;

    for (let ut = startHalfHour; ut <= endHalfHour; ut += stepHours) {
        const t = ut + dtHours - (eclipse.t0 || 12);
        const x = (eclipse.x0 || 0) + (eclipse.x1 || 0)*t + (eclipse.x2 || 0)*t*t + (eclipse.x3 || 0)*t*t*t;
        const y = (eclipse.y0 || 0) + (eclipse.y1 || 0)*t + (eclipse.y2 || 0)*t*t + (eclipse.y3 || 0)*t*t*t;
        const x_prime = (eclipse.x1 || 0) + 2*(eclipse.x2 || 0)*t + 3*(eclipse.x3 || 0)*t*t;
        const y_prime = (eclipse.y1 || 0) + 2*(eclipse.y2 || 0)*t + 3*(eclipse.y3 || 0)*t*t;
        const L1 = (eclipse.l10 || 0.54) + (eclipse.l11 || 0)*t;

        const d_rad = ((eclipse.d0 || 0) + (eclipse.d1 || 0)*t + (eclipse.d2 || 0)*t*t) * Math.PI / 180;
        const sinD = Math.sin(d_rad), cosD = Math.cos(d_rad);
        const mu_prime = (eclipse.mu1 || 15.004) * Math.PI / 180;
        const rho1 = getRho1(t);

        const evalF = (xi, eta) => {
            const r2 = xi*xi + (eta / rho1)*(eta / rho1);
            if (r2 > 1.0001) return null;
            const zeta = Math.sqrt(Math.max(0, 1.0 - r2));
            const u = x_prime - mu_prime * (zeta * cosD - eta * sinD);
            const v = y_prime - mu_prime * xi * sinD;
            const F = (x - xi) * u + (y - eta) * v;
            return { F, u, v, zeta, r2 };
        };

        const rC2 = Math.min(0.99, x*x + (y / rho1)*(y / rho1));
        const zC = Math.sqrt(Math.max(0, 1.0 - rC2));
        const u0 = x_prime - mu_prime * (zC * cosD - y * sinD);
        const v0 = y_prime - mu_prime * x * sinD;
        const v0len = Math.hypot(u0, v0) || 1;

        const tx = -v0 / v0len, ty = u0 / v0len;
        const nx = u0 / v0len, ny = v0 / v0len;

        const solvePointAtS = (s_val) => {
            let xi = x + s_val * tx;
            let eta = y + s_val * ty;
            for (let iter = 0; iter < 5; iter++) {
                const ev = evalF(xi, eta);
                if (!ev) break;
                const gradN = ev.u * nx + ev.v * ny;
                if (Math.abs(gradN) < 1e-6) break;
                const delta = ev.F / gradN;
                xi += delta * nx;
                eta += delta * ny;
                if (Math.abs(delta) < 1e-6) break;
            }
            const r2 = xi*xi + (eta / rho1)*(eta / rho1);
            const dist = Math.hypot(x - xi, y - eta);
            return { xi, eta, r2, dist, valid: (r2 <= 1.00005 && dist <= L1 * 1.15) };
        };

        const ds = (L1 * 1.25) / 60;
        const bisectEdge = (sIn, sOut) => {
            let a_s = sIn, b_s = sOut;
            for (let k = 0; k < 32; k++) {
                const m = 0.5 * (a_s + b_s);
                const p = solvePointAtS(m);
                if (p && p.valid) a_s = m;
                else b_s = m;
            }
            const pEdge = solvePointAtS(a_s);
            if (!pEdge) return null;
            const r1 = Math.hypot(pEdge.xi, pEdge.eta / rho1);
            const scale = (r1 > 0) ? (1.0 / r1) : 1.0;
            const edgeX = (r1 > 0.98) ? (pEdge.xi * scale) : pEdge.xi;
            const edgeY = (r1 > 0.98) ? (pEdge.eta * scale) : pEdge.eta;
            return besselianXYToLatLng(eclipse, t, edgeX, edgeY);
        };

        const pCenter = solvePointAtS(0);
        const centerPt = pCenter && pCenter.valid ? besselianXYToLatLng(eclipse, t, pCenter.xi, pCenter.eta) : null;
        if (!centerPt) continue;

        const ptsPos = [];
        let lastValidPos = 0;
        for (let step = 1; step <= 80; step++) {
            const s = step * ds;
            const p = solvePointAtS(s);
            if (p && p.valid) {
                lastValidPos = s;
                const ll = besselianXYToLatLng(eclipse, t, p.xi, p.eta);
                if (ll) ptsPos.push(ll);
            } else {
                const edgePt = bisectEdge(lastValidPos, s);
                if (edgePt) ptsPos.push(edgePt);
                break;
            }
        }

        const ptsNeg = [];
        let lastValidNeg = 0;
        for (let step = 1; step <= 80; step++) {
            const s = -step * ds;
            const p = solvePointAtS(s);
            if (p && p.valid) {
                lastValidNeg = s;
                const ll = besselianXYToLatLng(eclipse, t, p.xi, p.eta);
                if (ll) ptsNeg.push(ll);
            } else {
                const edgePt = bisectEdge(lastValidNeg, s);
                if (edgePt) ptsNeg.push(edgePt);
                break;
            }
        }

        let pts = ptsNeg.reverse().concat([centerPt]).concat(ptsPos);

        if (pts.length >= 10) {
            const labelPt = pts[Math.floor(pts.length * 0.70)] || pts[pts.length - 1];
            const utH = Math.floor((ut % 24 + 24) % 24);
            const utM = Math.round(((ut - Math.floor(ut)) * 60 + 60) % 60);
            const labelText = `${String(utH).padStart(2,'0')}:${String(utM).padStart(2,'0')} UT1`;
            utLines.push({ pts, labelPt, labelText });
        }
    }

    cachedEclipseGeometry = {
        eclipseKey: key,
        entersCompletely,
        centerCoords,
        totNorthCoords,
        totSouthCoords,
        corridorPolygons,
        corridorLoop,
        sunsetArc,
        sunriseArc,
        isoLines,
        sunriseLoop,
        sunsetLoop,
        fullEspenakLoop,
        espenakSunrisePart,
        espenakSunsetPart,
        utLines
    };

    return cachedEclipseGeometry;
}

function computeUmbraPolygon(eclipse, t) {
    if (!eclipse) return null;
    const x = (eclipse.x0 || 0) + (eclipse.x1 || 0)*t + (eclipse.x2 || 0)*t*t + (eclipse.x3 || 0)*t*t*t;
    const y = (eclipse.y0 || 0) + (eclipse.y1 || 0)*t + (eclipse.y2 || 0)*t*t + (eclipse.y3 || 0)*t*t*t;
    const l2 = (eclipse.l20 || 0.008) + (eclipse.l21 || 0)*t + (eclipse.l22 || 0)*t*t;

    const d = ((eclipse.d0 || 0) + (eclipse.d1 || 0)*t + (eclipse.d2 || 0)*t*t) * Math.PI / 180;
    const cosD = Math.cos(d);
    const rho1_sq = 1.0 - 0.006694385 * cosD * cosD;
    const rho1 = Math.sqrt(rho1_sq);

    const y1 = y / rho1;
    const r_center_sq = x*x + y1*y1;

    if (r_center_sq > (1.0 + Math.abs(l2) * 1.5) * (1.0 + Math.abs(l2) * 1.5)) return null;

    const tanF2 = eclipse.tan_f2 || 0.00457;
    const zetaCenter = Math.sqrt(Math.max(0.0, 1.0 - r_center_sq));
    const typeCode = (eclipse.eclipse_type || '').toUpperCase();
    const isHybrid = typeCode.startsWith('H');
    const isTotal = typeCode.startsWith('T');

    let L2_eff = 0;
    if (isHybrid) {
        const L2_local = l2 - zetaCenter * tanF2;
        if (L2_local >= 0) return null;
        L2_eff = -L2_local;
    } else if (isTotal) {
        L2_eff = Math.abs(l2) + zetaCenter * tanF2;
    } else {
        L2_eff = Math.max(0.0001, l2 - zetaCenter * tanF2);
    }

    if (L2_eff <= 0.00001) return null;

    const N = 64;
    const getPointAtAngle = (ang) => {
        const cosA = Math.cos(ang), sinA = Math.sin(ang);
        const px = x + L2_eff * cosA;
        const py = y + L2_eff * sinA;
        const py1 = py / rho1;
        const r1_sq = px * px + py1 * py1;
        return { ang, px, py, py1, r1_sq, inside: r1_sq <= 1.0 };
    };

    const circlePts = [];
    for (let i = 0; i < N; i++) {
        circlePts.push(getPointAtAngle((i / N) * 2 * Math.PI));
    }

    const allInside = circlePts.every(p => p.inside);
    if (circlePts.every(p => !p.inside)) return null;

    const pts = [];
    if (allInside) {
        for (const p of circlePts) {
            const ll = besselianXYToLatLng(eclipse, t, p.px, p.py);
            if (ll && !isNaN(ll.lat) && !isNaN(ll.lng)) pts.push({ lat: ll.lat, lng: ll.lng });
        }
    } else {
        const transitions = [];
        for (let i = 0; i < N; i++) {
            const cur = circlePts[i];
            const nxt = circlePts[(i + 1) % N];
            if (cur.inside !== nxt.inside) {
                let a = cur.ang, b = nxt.ang;
                if (b < a) b += 2 * Math.PI;
                for (let k = 0; k < 25; k++) {
                    const m = 0.5 * (a + b);
                    const pMid = getPointAtAngle(m);
                    if (pMid.inside === cur.inside) a = m;
                    else b = m;
                }
                const m = 0.5 * (a + b);
                const pExact = getPointAtAngle(m);
                const norm = Math.hypot(pExact.px, pExact.py1) || 1;
                const phi = Math.atan2(pExact.py1 / norm, pExact.px / norm);
                transitions.push({ ang: m, fromInside: cur.inside, phi });
            }
        }

        if (transitions.length >= 2) {
            const exit = transitions.find(tr => tr.fromInside) || transitions[0];
            const entry = transitions.find(tr => !tr.fromInside) || transitions[transitions.length - 1];

            let curAng = entry.ang, targetAng = exit.ang;
            if (targetAng < curAng) targetAng += 2 * Math.PI;
            const numCircleSteps = 32;
            for (let i = 0; i <= numCircleSteps; i++) {
                const ang = curAng + (i / numCircleSteps) * (targetAng - curAng);
                const pArc = getPointAtAngle(ang);
                let ll = null;
                if (pArc.inside) {
                    ll = besselianXYToLatLng(eclipse, t, pArc.px, pArc.py);
                } else {
                    const norm = Math.hypot(pArc.px, pArc.py1) || 1.0;
                    ll = besselianXYToLatLng(eclipse, t, pArc.px / norm, (pArc.py1 / norm) * rho1);
                }
                if (ll && !isNaN(ll.lat) && !isNaN(ll.lng)) pts.push({ lat: ll.lat, lng: ll.lng });
            }

            let dPhi = entry.phi - exit.phi;
            while (dPhi > Math.PI) dPhi -= 2 * Math.PI;
            while (dPhi < -Math.PI) dPhi += 2 * Math.PI;

            const numTermSteps = 16;
            for (let i = 1; i < numTermSteps; i++) {
                const phi = exit.phi + (i / numTermSteps) * dPhi;
                const ll = besselianXYToLatLng(eclipse, t, Math.cos(phi), Math.sin(phi) * rho1);
                if (ll && !isNaN(ll.lat) && !isNaN(ll.lng)) pts.push({ lat: ll.lat, lng: ll.lng });
            }
        }
    }

    if (pts.length < 3) return null;

    const centerLL = besselianXYToLatLng(eclipse, t, x, y);
    const refLng = (centerLL && !isNaN(centerLL.lng)) ? centerLL.lng : pts[0].lng;
    for (let i = 0; i < pts.length; i++) {
        let dLng = pts[i].lng - refLng;
        while (dLng > 180) dLng -= 360;
        while (dLng < -180) dLng += 360;
        pts[i].lng = refLng + dLng;
    }

    for (let i = 1; i < pts.length; i++) {
        let dLng = pts[i].lng - pts[i - 1].lng;
        while (dLng > 180) { pts[i].lng -= 360; dLng -= 360; }
        while (dLng < -180) { pts[i].lng += 360; dLng += 360; }
    }

    if (pts.length >= 3) {
        const closeDiff = pts[pts.length - 1].lng - pts[0].lng;
        if (Math.abs(closeDiff) > 180) {
            pts[pts.length - 1].lng -= Math.round(closeDiff / 360) * 360;
        }
    }

    return pts;
}

if (typeof window !== 'undefined') {
    window.RAD = RAD;
    window.DEG = DEG;
    window.getEarthRotationAngleDeg = getEarthRotationAngleDeg;
    window.getJulianDay = getJulianDay;
    window.getEclipseMeeusAngles = getEclipseMeeusAngles;
    window.besselianXYToLatLng = besselianXYToLatLng;
    window.besselianToLatLng = besselianToLatLng;
    window.calculatePhysicalObscuration = calculatePhysicalObscuration;
    window.calculateLocalSolarCircumstances = calculateLocalSolarCircumstances;
    window.calculateGreatestEclipseCoords = calculateGreatestEclipseCoords;
    window.calculateGreatestDurationCoords = calculateGreatestDurationCoords;
    window.getEclipseTimeBounds = getEclipseTimeBounds;
    window.getEdgeIntersection = getEdgeIntersection;
    window.computeTerminatorIntersectionArc = computeTerminatorIntersectionArc;
    window.precomputeEclipseGeometry = precomputeEclipseGeometry;
    window.computeUmbraPolygon = computeUmbraPolygon;
    window.BesselianEngine = {
        RAD,
        DEG,
        getJulianDay,
        getEclipseMeeusAngles,
        getEarthRotationAngleDeg,
        besselianXYToLatLng,
        besselianToLatLng,
        calculatePhysicalObscuration,
        calculateLocalSolarCircumstances,
        calculateGreatestEclipseCoords,
        calculateGreatestDurationCoords,
        getEclipseTimeBounds,
        getEdgeIntersection,
        computeTerminatorIntersectionArc,
        precomputeEclipseGeometry,
        computeUmbraPolygon
    };
}