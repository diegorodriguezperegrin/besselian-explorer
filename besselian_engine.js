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

        // Cálculo astronómico riguroso del Día Juliano (Jean Meeus, "Astronomical Algorithms", cap. 7)
        // Soporta todo el rango de -1999 a 3000 sin el error de Date.UTC para años de 2 dígitos (0..99)
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

        // Algoritmos astronómicos de Meeus para longitud del Sol, oblicuidad de la Eclíptica y Nodos Lunares
        function getEclipseMeeusAngles(eclipse, t = 0) {
            if (!eclipse) return { epsRad: 0.409, epsDeg: 23.44, sunLonDeg: 0, omegaDeg: 0, isDescending: false, eclipseNodeLonDeg: 0, deltaNodeDeg: 0 };
            const RAD = Math.PI / 180;
            const ttHour = (eclipse.t0 || 12) + (t || 0);
            const utHour = ttHour - (eclipse.dt || 0) / 3600;
            const jd = getJulianDay(eclipse.year || 2026, eclipse.month || 8, eclipse.day || 12, utHour);
            const T = (jd - 2451545.0) / 36525;

            // 1. Oblicuidad de la Eclíptica (Meeus cap. 22)
            const epsDeg = 23.4392911 - 0.0130042 * T - 0.00000016 * T * T + 0.000000504 * T * T * T;
            const epsRad = epsDeg * RAD;

            // 2. Longitud eclíptica del Sol (Meeus cap. 25)
            const L0 = 280.46646 + 36000.76983 * T;
            const Msun = (357.52911 + 35999.05029 * T) * RAD;
            const C = (1.914602 - 0.004817 * T) * Math.sin(Msun) + (0.019993 - 0.000101 * T) * Math.sin(2 * Msun) + 0.000289 * Math.sin(3 * Msun);
            const sunLonDeg = ((L0 + C) % 360 + 360) % 360;

            // 3. Longitud del nodo ascendente lunar (Omega)
            const omegaDeg = ((125.04452 - 1934.136261 * T + 0.0020708 * T * T) % 360 + 360) % 360;
            const isDescending = (eclipse.y1 !== undefined && eclipse.y1 < 0);
            const eclipseNodeLonDeg = isDescending ? ((omegaDeg + 180) % 360) : omegaDeg;

            // 4. Distancia angular del Sol al nodo en la Eclíptica (positiva = hacia el Este del nodo, negativa = antes del nodo)
            let deltaNodeDeg = sunLonDeg - eclipseNodeLonDeg;
            while (deltaNodeDeg > 180) deltaNodeDeg -= 360;
            while (deltaNodeDeg < -180) deltaNodeDeg += 360;

            return { epsRad, epsDeg, sunLonDeg, omegaDeg, isDescending, eclipseNodeLonDeg, deltaNodeDeg };
        }


        function besselianXYToLatLng(eclipse, t, x, y) {
            const d = ((eclipse.d0 || 0) + (eclipse.d1 || 0)*t + (eclipse.d2 || 0)*t*t) * Math.PI / 180;
            let muDeg = (eclipse.mu0 || 0) + (eclipse.mu1 || 0)*t + (eclipse.mu2 || 0)*t*t;
            if (eclipse.dt) {
                // Conversión rigurosa de ángulo horario de efemérides (TT) al meridiano de referencia en UT1 mediante Delta T
                muDeg -= getEarthRotationAngleDeg(eclipse.dt);
            }
            const mu = muDeg * Math.PI / 180;

            const e2 = 0.006694385; // Excentricidad al cuadrado del elipsoide WGS84
            const sinD = Math.sin(d), cosD = Math.cos(d);

            // Cantidades auxiliares elipsoidales rigurosas de Bessel (rho1 y rho2):
            const rho1_sq = 1.0 - e2 * cosD * cosD;
            const rho1 = Math.sqrt(rho1_sq);
            const rho2 = Math.sqrt(1.0 - e2);

            const y1 = y / rho1;
            const r1_sq = x * x + y1 * y1;
            if (r1_sq > 1.015) return null;
            const z1 = Math.sqrt(Math.max(0, 1.0 - Math.min(1.0, r1_sq)));

            const sinD1 = (rho2 / rho1) * sinD;
            const cosD1 = Math.sqrt(Math.max(0, 1.0 - sinD1 * sinD1));

            const sinDec1 = y1 * cosD1 + z1 * sinD1;
            const cosDec1SinH = x;
            const cosDec1CosH = -y1 * sinD1 + z1 * cosD1;

            const beta = Math.atan2(sinDec1, Math.hypot(cosDec1SinH, cosDec1CosH));
            const latGeodetic = Math.atan((1.0 / rho2) * Math.tan(beta)) * 180 / Math.PI;

            const H = Math.atan2(cosDec1SinH, cosDec1CosH);
            let lng = (H - mu) * 180 / Math.PI;
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
            
            const e2 = 0.006694385; // WGS84
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
                
                // Altitud y Azimut del Sol para el observador
                const sinH = Math.sin(phi) * sinD + Math.cos(phi) * cosD * Math.cos(theta);
                const alt = Math.asin(Math.max(-1, Math.min(1, sinH))) * DEG;
                const az = ((Math.atan2(-cosD * sinTheta, sinD * cosPhi - cosD * sinPhi * cosTheta) * DEG) + 360) % 360;
                
                // Ángulo paraláctico q (fórmula sin singularidad en los polos: cosPhi*sinTheta y sinPhi*cosD - cosPhi*sinD*cosTheta)
                const sinQ = cosPhi * sinTheta;
                const cosQ = sinPhi * cosD - cosPhi * sinD * cosTheta;
                const qDeg = Math.atan2(sinQ, cosQ) * DEG;
                const qRad = Math.atan2(sinQ, cosQ);

                return { t, x, y, xi, eta, zeta, u, v, delta, L1, L2, alt, az, qDeg, qRad, d, theta };
            }
            
            // Muestreo temporal para encontrar el mínimo de delta
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

            // Cálculo riguroso de oscurecimiento (fracción de área del disco solar cubierta por la Luna)
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
                    // Si en el inicio 'a' ya está dentro de la sombra (fa < 0 y fb < 0),
                    // expandir hacia atrás en pasos progresivos
                    if (fa < 0 && fb < 0) {
                        for (let ext = 0.5; ext <= 3.0; ext += 0.5) {
                            const testA = tStart - ext;
                            const fTest = targetFunc(testA);
                            if (fTest >= 0) {
                                a = testA;
                                fa = fTest;
                                break;
                            }
                        }
                    }
                    // Si en el final 'b' aún sigue dentro de la sombra (fa < 0 y fb < 0),
                    // expandir hacia adelante en pasos progresivos
                    if (fa * fb > 0 && fa < 0 && fb < 0) {
                        for (let ext = 0.5; ext <= 3.0; ext += 0.5) {
                            const testB = tEnd + ext;
                            const fTest = targetFunc(testB);
                            if (fTest >= 0) {
                                b = testB;
                                fb = fTest;
                                break;
                            }
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
            
            const penumbraFunc = (t) => {
                const p = getParamsAtT(t);
                return p.delta - p.L1;
            };
            const umbraFunc = (t) => {
                const p = getParamsAtT(t);
                return p.delta - Math.abs(p.L2);
            };
            
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

            // Raíz analítica exacta de la mínima distancia al eje del cono de sombra: d/dt(x^2 + y^2) = 0
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
                if (Math.abs(nextT - t) < 1e-12) {
                    t = nextT;
                    break;
                }
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

            // Paso 1: Muestreo grueso (paso 0.04 h = 2.4 min)
            const coarseStep = 0.04;
            for (let t = tMin; t <= tMax; t += coarseStep) {
                const res = evalDuration(t);
                if (res && res.durSec > maxDur) {
                    maxDur = res.durSec;
                    bestPt = res;
                    bestT = t;
                }
            }

            // Paso 2: Refinamiento fino en la vecindad del máximo (paso 0.002 h = 7.2 s)
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
            const deltaT = Math.sqrt(Math.max(0, rPenumbra * rPenumbra - rMin_sq)) / v;
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
            let fa = (prev.r2 != null ? prev.r2 : (prev.x * prev.x + prev.y * prev.y)) - 1.0;
            for (let k = 0; k < 40; k++) {
                const m = 0.5 * (a + b);
                const p = pointAt(m);
                if (!p) break;
                const fm = (p.x * p.x + p.y * p.y) - 1.0;
                if ((fa < 0) === (fm < 0)) { a = m; fa = fm; }
                else { b = m; }
            }
            const t_mid = 0.5 * (a + b);
            const p_mid = pointAt(t_mid);
            return p_mid ? { t: t_mid, x: p_mid.x, y: p_mid.y } : null;
        }

        // Cache global para precomputar toda la geometría polinomial e integración numérica una sola vez por eclipse
        let cachedEclipseGeometry = {
            eclipseKey: null,
            centerCoords: [],
            totNorthCoords: [],
            totSouthCoords: [],
            isoLines: [],
            sunriseLoop: [],
            sunsetLoop: [],
            fullEspenakLoop: [],
            utLines: []
        };

        function precomputeEclipseGeometry(eclipse) {
            const key = `${eclipse.cat_no || eclipse.catalog_number || ''}_${eclipse.year || ''}-${eclipse.month || ''}-${eclipse.day || ''}_${eclipse.eclipse_type || ''}_${eclipse.t0 || ''}_${eclipse.dt || ''}`;
            if (cachedEclipseGeometry.eclipseKey === key) {
                return cachedEclipseGeometry;
            }

            // Cálculo dinámico riguroso del intervalo de tiempo de penumbra para cualquier eclipse
            const { tClosest, deltaT, v, v2, rMin_sq } = getEclipseTimeBounds(eclipse);

            const tLoopMin = tClosest - deltaT - 0.3;
            const tLoopMax = tClosest + deltaT + 0.3;
            const dt = 0.004; // 250 divisiones por hora (~14 segundos de paso, máxima resolución)
            const numSteps = Math.ceil((tLoopMax - tLoopMin) / dt);

            // Helper para calcular cualquier trayectoria con intersección exacta en el borde (r2 = 1.0)
            const computeTrajectoryWithExactBounds = (getPointFn) => {
                const coords = [];
                let prev = null;
                const tTrajMin = tClosest - deltaT - 0.3;
                const tTrajMax = tClosest + deltaT + 0.3;
                const dtTraj = 0.004;
                const numStepsTraj = Math.ceil((tTrajMax - tTrajMin) / dtTraj);
                for (let i = 0; i <= numStepsTraj; i++) {
                    const t = tTrajMin + i * dtTraj;
                    const pt = getPointFn(t);
                    if (!pt) continue;
                    pt.t = t;
                    const r2 = pt.x * pt.x + pt.y * pt.y;
                    pt.r2 = r2;

                    if (r2 <= 1.0) {
                        if (prev && prev.r2 > 1.0) {
                            const edge = getEdgeIntersection(prev, pt, getPointFn);
                            if (edge) {
                                const latLng = besselianXYToLatLng(eclipse, edge.t, edge.x, edge.y);
                                if (latLng) coords.push(latLng);
                            }
                        }
                        const latLng = besselianXYToLatLng(eclipse, t, pt.x, pt.y);
                        if (latLng) coords.push(latLng);
                    } else if (prev && prev.r2 <= 1.0) {
                        const edge = getEdgeIntersection(prev, pt, getPointFn);
                        if (edge) {
                            const latLng = besselianXYToLatLng(eclipse, edge.t, edge.x, edge.y);
                            if (latLng) coords.push(latLng);
                        }
                    }
                    prev = pt;
                }
                return coords;
            };

            // 1. Trayectoria Central (Naranja)
            const centerCoords = computeTrajectoryWithExactBounds(t => {
                const x = (eclipse.x0 || 0) + (eclipse.x1 || 0)*t + (eclipse.x2 || 0)*t*t + (eclipse.x3 || 0)*t*t*t;
                const y = (eclipse.y0 || 0) + (eclipse.y1 || 0)*t + (eclipse.y2 || 0)*t*t + (eclipse.y3 || 0)*t*t*t;
                return { x, y, r2: x*x + y*y, t };
            });

            // 2. Límites Extremos Norte y Sur de Totalidad / Anularidad (Rojo)
            const typeCode = (eclipse.eclipse_type || '').toUpperCase();
            const isCentral = !typeCode.startsWith('P');
            let totNorthCoords = [];
            let totSouthCoords = [];

            if (isCentral) {
                totNorthCoords = computeTrajectoryWithExactBounds(t => {
                    const x = (eclipse.x0 || 0) + (eclipse.x1 || 0)*t + (eclipse.x2 || 0)*t*t + (eclipse.x3 || 0)*t*t*t;
                    const y = (eclipse.y0 || 0) + (eclipse.y1 || 0)*t + (eclipse.y2 || 0)*t*t + (eclipse.y3 || 0)*t*t*t;
                    const dx = (eclipse.x1 || 0) + 2*(eclipse.x2 || 0)*t + 3*(eclipse.x3 || 0)*t*t;
                    const dy = (eclipse.y1 || 0) + 2*(eclipse.y2 || 0)*t + 3*(eclipse.y3 || 0)*t*t;
                    const l2 = Math.abs((eclipse.l20 || 0.008) + (eclipse.l21 || 0)*t);
                    if (l2 <= 0.0001) return null;
                    const vlen = Math.sqrt(dx*dx + dy*dy) || 1;
                    const px = x + l2 * (-dy / vlen), py = y + l2 * (dx / vlen);
                    return { x: px, y: py, r2: px*px + py*py, t };
                });

                totSouthCoords = computeTrajectoryWithExactBounds(t => {
                    const x = (eclipse.x0 || 0) + (eclipse.x1 || 0)*t + (eclipse.x2 || 0)*t*t + (eclipse.x3 || 0)*t*t*t;
                    const y = (eclipse.y0 || 0) + (eclipse.y1 || 0)*t + (eclipse.y2 || 0)*t*t + (eclipse.y3 || 0)*t*t*t;
                    const dx = (eclipse.x1 || 0) + 2*(eclipse.x2 || 0)*t + 3*(eclipse.x3 || 0)*t*t;
                    const dy = (eclipse.y1 || 0) + 2*(eclipse.y2 || 0)*t + 3*(eclipse.y3 || 0)*t*t;
                    const l2 = Math.abs((eclipse.l20 || 0.008) + (eclipse.l21 || 0)*t);
                    if (l2 <= 0.0001) return null;
                    const vlen = Math.sqrt(dx*dx + dy*dy) || 1;
                    const px = x - l2 * (-dy / vlen), py = y - l2 * (dx / vlen);
                    return { x: px, y: py, r2: px*px + py*py, t };
                });
            }

            // 3. ISOMAGNITUDES Opcionales (Curvas de Magnitud de Eclipse constante)
            const isoLines = [];
            const magFracs = [0.0, 0.20, 0.40, 0.60, 0.80];

            const getIsomagnitudePoint = (t_val, frac, isNorth) => {
                const x = (eclipse.x0 || 0) + (eclipse.x1 || 0)*t_val + (eclipse.x2 || 0)*t_val*t_val + (eclipse.x3 || 0)*t_val*t_val*t_val;
                const y = (eclipse.y0 || 0) + (eclipse.y1 || 0)*t_val + (eclipse.y2 || 0)*t_val*t_val + (eclipse.y3 || 0)*t_val*t_val*t_val;
                const x_prime = (eclipse.x1 || 0) + 2*(eclipse.x2 || 0)*t_val + 3*(eclipse.x3 || 0)*t_val*t_val;
                const y_prime = (eclipse.y1 || 0) + 2*(eclipse.y2 || 0)*t_val + 3*(eclipse.y3 || 0)*t_val*t_val;
                const L1 = (eclipse.l10 || 0.54) + (eclipse.l11 || 0)*t_val;
                const dist = L1 * (1.0 - frac);

                const d_rad = ((eclipse.d0 || 0) + (eclipse.d1 || 0)*t_val + (eclipse.d2 || 0)*t_val*t_val) * Math.PI / 180;
                const sinD = Math.sin(d_rad), cosD = Math.cos(d_rad);
                const mu_prime = (eclipse.mu1 || 15.004) * Math.PI / 180;

                const rC2 = Math.min(0.99, x*x + y*y);
                const zC = Math.sqrt(Math.max(0, 1.0 - rC2));
                let u = x_prime - mu_prime * (zC * cosD - y * sinD);
                let v = y_prime - mu_prime * x * sinD;

                let xi = x, eta = y;
                const sign = isNorth ? 1 : -1;

                // 4 iteraciones autocoherentes para acoplar la velocidad relativa del observador (u, v)
                for (let iter = 0; iter < 4; iter++) {
                    const vlen = Math.hypot(u, v) || 1;
                    const nx = -v / vlen;
                    const ny =  u / vlen;
                    xi = x + sign * dist * nx;
                    eta = y + sign * dist * ny;

                    const r2 = xi*xi + eta*eta;
                    const zeta = r2 <= 1.0 ? Math.sqrt(1.0 - r2) : 0;
                    u = x_prime - mu_prime * (zeta * cosD - eta * sinD);
                    v = y_prime - mu_prime * xi * sinD;
                }

                const r2 = xi*xi + eta*eta;
                return { x: xi, y: eta, r2: r2, t: t_val };
            };

            magFracs.forEach(frac => {
                let isoNorthCoords = [];
                let isoSouthCoords = [];
                let prevN = null, prevS = null;

                const pointAtNorth = (t_val) => getIsomagnitudePoint(t_val, frac, true);
                const pointAtSouth = (t_val) => getIsomagnitudePoint(t_val, frac, false);

                for (let i = 0; i <= numSteps; i++) {
                    const t = tLoopMin + i * dt;
                    const currN = pointAtNorth(t);
                    const currS = pointAtSouth(t);

                    if (currN.r2 <= 1.0) {
                        if (prevN && prevN.r2 > 1.0) {
                            const edge = getEdgeIntersection(prevN, currN, pointAtNorth);
                            if (edge) {
                                const ptEdge = besselianXYToLatLng(eclipse, edge.t, edge.x, edge.y);
                                if (ptEdge) isoNorthCoords.push(ptEdge);
                            }
                        }
                        const ptN = besselianXYToLatLng(eclipse, t, currN.x, currN.y);
                        if (ptN) isoNorthCoords.push(ptN);
                    } else if (prevN && prevN.r2 <= 1.0) {
                        const edge = getEdgeIntersection(prevN, currN, pointAtNorth);
                        if (edge) {
                            const ptEdge = besselianXYToLatLng(eclipse, edge.t, edge.x, edge.y);
                            if (ptEdge) isoNorthCoords.push(ptEdge);
                        }
                    }

                    if (currS.r2 <= 1.0) {
                        if (prevS && prevS.r2 > 1.0) {
                            const edge = getEdgeIntersection(prevS, currS, pointAtSouth);
                            if (edge) {
                                const ptEdge = besselianXYToLatLng(eclipse, edge.t, edge.x, edge.y);
                                if (ptEdge) isoSouthCoords.push(ptEdge);
                            }
                        }
                        const ptS = besselianXYToLatLng(eclipse, t, currS.x, currS.y);
                        if (ptS) isoSouthCoords.push(ptS);
                    } else if (prevS && prevS.r2 <= 1.0) {
                        const edge = getEdgeIntersection(prevS, currS, pointAtSouth);
                        if (edge) {
                            const ptEdge = besselianXYToLatLng(eclipse, edge.t, edge.x, edge.y);
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

                isoLines.push({
                    frac,
                    isoNorthCoords,
                    isoSouthCoords,
                    magText,
                    midPtN,
                    midPtS
                });
            });

            // -------------------------------------------------------------
            // Lóbulos del terminador y Máximo en horizonte (Formulación unificada analítica de Espenak)
            // -------------------------------------------------------------
            const sunriseBranch1 = [], sunriseBranch2 = [];
            const sunsetBranch1 = [], sunsetBranch2 = [];
            const fullBranch1 = [], fullBranch2 = [];
            const srA = [], srB = [];
            const ssA = [], ssB = [];

            const l1Closest = (eclipse.l10 || 0.54) + (eclipse.l11 || 0) * tClosest;
            const rMin = Math.sqrt(rMin_sq != null ? rMin_sq : 0);
            const entersCompletely = (rMin < (1.0 - l1Closest));

            const findLimbContactPoint = (tA, tB, isOuter) => {
                let a = tA, b = tB;
                for (let k = 0; k < 35; k++) {
                    const m = 0.5 * (a + b);
                    const xm = (eclipse.x0||0) + (eclipse.x1||0)*m + (eclipse.x2||0)*m*m + (eclipse.x3||0)*m*m*m;
                    const ym = (eclipse.y0||0) + (eclipse.y1||0)*m + (eclipse.y2||0)*m*m + (eclipse.y3||0)*m*m*m;
                    const l1m = (eclipse.l10||0.54) + (eclipse.l11||0)*m;
                    const rm = Math.hypot(xm, ym);
                    const target = isOuter ? (1.0 + l1m) : Math.abs(1.0 - l1m);
                    const fm = rm - target;

                    const xa = (eclipse.x0||0) + (eclipse.x1||0)*a + (eclipse.x2||0)*a*a + (eclipse.x3||0)*a*a*a;
                    const ya = (eclipse.y0||0) + (eclipse.y1||0)*a + (eclipse.y2||0)*a*a + (eclipse.y3||0)*a*a*a;
                    const l1a = (eclipse.l10||0.54) + (eclipse.l11||0)*a;
                    const ra = Math.hypot(xa, ya);
                    const targetA = isOuter ? (1.0 + l1a) : Math.abs(1.0 - l1a);
                    const fa = ra - targetA;

                    if ((fm > 0) === (fa > 0)) a = m;
                    else b = m;
                }
                const tMid = 0.5 * (a + b);
                const xMid = (eclipse.x0||0) + (eclipse.x1||0)*tMid + (eclipse.x2||0)*tMid*tMid + (eclipse.x3||0)*tMid*tMid*tMid;
                const yMid = (eclipse.y0||0) + (eclipse.y1||0)*tMid + (eclipse.y2||0)*tMid*tMid + (eclipse.y3||0)*tMid*tMid*tMid;
                const RMid = Math.hypot(xMid, yMid);
                if (RMid === 0) return null;
                return besselianXYToLatLng(eclipse, tMid, xMid / RMid, yMid / RMid);
            };

            const getH2AtT = (t_val) => {
                const x = (eclipse.x0||0)+(eclipse.x1||0)*t_val+(eclipse.x2||0)*t_val*t_val+(eclipse.x3||0)*t_val*t_val*t_val;
                const y = (eclipse.y0||0)+(eclipse.y1||0)*t_val+(eclipse.y2||0)*t_val*t_val+(eclipse.y3||0)*t_val*t_val*t_val;
                const u = (eclipse.x1||0)+2*(eclipse.x2||0)*t_val+3*(eclipse.x3||0)*t_val*t_val;
                const v = (eclipse.y1||0)+2*(eclipse.y2||0)*t_val+3*(eclipse.y3||0)*t_val*t_val;
                const dDeg = (eclipse.d0||0)+(eclipse.d1||0)*t_val+(eclipse.d2||0)*t_val*t_val;
                const omega = Math.sin(dDeg * Math.PI / 180) * (eclipse.mu1||15.004) * Math.PI / 180;
                const u_eff = u + omega * y;
                const v_eff = v - omega * x;
                const c = u_eff*x + v_eff*y;
                const veff2 = u_eff*u_eff + v_eff*v_eff;
                if (veff2 === 0) return -1;
                const x_proj = c * u_eff / veff2;
                const y_proj = c * v_eff / veff2;
                return 1.0 - (x_proj*x_proj + y_proj*y_proj);
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
                return pt ? besselianXYToLatLng(eclipse, pt.t, pt.xi, pt.eta) : null;
            };

            let ptSrOuter = null, ptSrInner = null;
            let ptSsInner = null, ptSsOuter = null;
            let ptFullOuterStart = null, ptFullOuterEnd = null;

            let prevSrInside = false, prevSsInside = false, prevFullInside = false;
            let prevInA = false, prevInB = false, prevT = tLoopMin;

            for (let i = 0; i <= numSteps; i++) {
                const t = tLoopMin + i * dt;
                const x = (eclipse.x0 || 0) + (eclipse.x1 || 0)*t + (eclipse.x2 || 0)*t*t + (eclipse.x3 || 0)*t*t*t;
                const y = (eclipse.y0 || 0) + (eclipse.y1 || 0)*t + (eclipse.y2 || 0)*t*t + (eclipse.y3 || 0)*t*t*t;
                const l1 = (eclipse.l10 || 0.54) + (eclipse.l11 || 0)*t;

                // 1. Curva analítica de Máximo Eclipse en el horizonte (Espenak)
                const ptA = getEspenakPoint(t, true);
                const ptB = getEspenakPoint(t, false);

                if (ptA && ptA.inside) {
                    if (!prevInA) {
                        const edge = findEspenakBoundaryPoint(t, prevT, true);
                        if (edge) { if (t < tClosest) srA.push(edge); else ssA.push(edge); }
                    }
                    const p = besselianXYToLatLng(eclipse, t, ptA.xi, ptA.eta);
                    if (p) { if (t < tClosest) srA.push(p); else ssA.push(p); }
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
                    if (p) { if (t < tClosest) srB.push(p); else ssB.push(p); }
                    prevInB = true;
                } else {
                    if (prevInB) {
                        const edge = findEspenakBoundaryPoint(prevT, t, false);
                        if (edge) { if (prevT < tClosest) srB.push(edge); else ssB.push(edge); }
                    }
                    prevInB = false;
                }

                // 2. Intersección de la penumbra con el limbo terrestre (Lóbulos del terminador)
                const R = Math.hypot(x, y);
                const inside = (Math.abs(1.0 - l1) <= R && R <= 1.0 + l1);

                if (entersCompletely) {
                    const isSunrise = (t < tClosest);
                    if (isSunrise) {
                        if (inside && !prevSrInside) {
                            ptSrOuter = findLimbContactPoint(prevT, t, true);
                        } else if (!inside && prevSrInside) {
                            ptSrInner = findLimbContactPoint(prevT, t, false);
                        }
                        prevSrInside = inside;
                    } else {
                        if (inside && !prevSsInside) {
                            ptSsInner = findLimbContactPoint(prevT, t, false);
                        } else if (!inside && prevSsInside) {
                            ptSsOuter = findLimbContactPoint(prevT, t, true);
                        }
                        prevSsInside = inside;
                    }
                } else {
                    if (inside && !prevFullInside) {
                        ptFullOuterStart = findLimbContactPoint(prevT, t, true);
                    } else if (!inside && prevFullInside) {
                        ptFullOuterEnd = findLimbContactPoint(prevT, t, true);
                    }
                    prevFullInside = inside;
                }

                if (inside) {
                    const a = (1.0 - l1*l1 + R*R) / (2.0 * R);
                    const h_limb = Math.sqrt(Math.max(0, 1.0 - a*a));
                    const x2 = a * x / R;
                    const y2 = a * y / R;
                    const x3 = x2 + h_limb * y / R;
                    const y3 = y2 - h_limb * x / R;
                    const x4 = x2 - h_limb * y / R;
                    const y4 = y2 + h_limb * x / R;

                    const p3 = besselianXYToLatLng(eclipse, t, x3, y3);
                    const p4 = besselianXYToLatLng(eclipse, t, x4, y4);

                    if (entersCompletely) {
                        if (t < tClosest) {
                            if (p3) sunriseBranch1.push(p3);
                            if (p4) sunriseBranch2.push(p4);
                        } else {
                            if (p3) sunsetBranch1.push(p3);
                            if (p4) sunsetBranch2.push(p4);
                        }
                    } else {
                        if (p3) fullBranch1.push(p3);
                        if (p4) fullBranch2.push(p4);
                    }
                }

                prevT = t;
            }

            let sunriseLoop = [];
            let sunsetLoop = [];

            if (entersCompletely) {
                if (sunriseBranch1.length > 0 || sunriseBranch2.length > 0) {
                    sunriseLoop = (ptSrOuter ? [ptSrOuter] : [])
                        .concat(sunriseBranch1)
                        .concat(ptSrInner ? [ptSrInner] : [])
                        .concat(sunriseBranch2.reverse());
                    if (sunriseLoop.length > 0) sunriseLoop.push(sunriseLoop[0]);
                }
                if (sunsetBranch1.length > 0 || sunsetBranch2.length > 0) {
                    sunsetLoop = (ptSsInner ? [ptSsInner] : [])
                        .concat(sunsetBranch1)
                        .concat(ptSsOuter ? [ptSsOuter] : [])
                        .concat(sunsetBranch2.reverse());
                    if (sunsetLoop.length > 0) sunsetLoop.push(sunsetLoop[0]);
                }
            } else {
                if (fullBranch1.length > 0 || fullBranch2.length > 0) {
                    sunriseLoop = (ptFullOuterStart ? [ptFullOuterStart] : [])
                        .concat(fullBranch1)
                        .concat(ptFullOuterEnd ? [ptFullOuterEnd] : [])
                        .concat(fullBranch2.reverse());
                    if (sunriseLoop.length > 0) sunriseLoop.push(sunriseLoop[0]);
                }
            }

            let fullEspenakLoop = [];
            if (entersCompletely) {
                const sunrisePart = srB.slice().reverse().concat(srA);
                const sunsetPart = ssA.concat(ssB.slice().reverse());
                fullEspenakLoop = sunrisePart.concat(sunsetPart);
            } else {
                if (srA.length > 0 || ssA.length > 0) {
                    fullEspenakLoop = srA.concat(ssA);
                } else {
                    fullEspenakLoop = srB.concat(ssB);
                }
            }

            // Líneas de Tiempo Universal (Horas UT) — Ecuación rigurosa de Máximo Eclipse de Bessel/Chauvenet
            // Se trazan las líneas alrededor del Máximo Eclipse (GE) para evitar ramas deformadas en el limbo
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

                // Función que evalúa la condición de máximo eclipse F(xi, eta) = 0
                const evalF = (xi, eta) => {
                    const r2 = xi*xi + eta*eta;
                    if (r2 > 1.0) return null;
                    const zeta = Math.sqrt(Math.max(0, 1.0 - r2));
                    const u = x_prime - mu_prime * (zeta * cosD - eta * sinD);
                    const v = y_prime - mu_prime * xi * sinD;
                    const F = (x - xi) * u + (y - eta) * v;
                    return { F, u, v, zeta };
                };

                // Velocidad aparente de referencia en el centro
                const rC2 = Math.min(0.99, x*x + y*y);
                const zC = Math.sqrt(Math.max(0, 1.0 - rC2));
                const u0 = x_prime - mu_prime * (zC * cosD - y * sinD);
                const v0 = y_prime - mu_prime * x * sinD;
                const v0len = Math.hypot(u0, v0) || 1;

                // Dirección tangente (perpendicular a la velocidad efectiva) y normal
                const tx = -v0 / v0len;
                const ty =  u0 / v0len;
                const nx =  u0 / v0len;
                const ny =  v0 / v0len;

                const pts = [];
                const numSubSteps = 50;
                let labelPt = null;
                let firstValidIndex = null, lastValidIndex = null;

                // Barrido transversal a lo largo del cono penumbral con refinamiento Newton-Raphson
                for (let i = -numSubSteps; i <= numSubSteps; i++) {
                    const s = (i / numSubSteps) * (L1 * 1.06);
                    let xi = x + s * tx;
                    let eta = y + s * ty;

                    for (let iter = 0; iter < 3; iter++) {
                        const ev = evalF(xi, eta);
                        if (!ev) break;
                        const gradN = ev.u * nx + ev.v * ny;
                        if (Math.abs(gradN) < 1e-6) break;
                        const delta = ev.F / gradN;
                        xi += delta * nx;
                        eta += delta * ny;
                        if (Math.abs(delta) < 1e-6) break;
                    }

                    const r2 = xi*xi + eta*eta;
                    const distToCenter = Math.hypot(x - xi, y - eta);

                    if (r2 <= 0.9999 && distToCenter <= L1 + 0.003) {
                        const ll = besselianXYToLatLng(eclipse, t, xi, eta);
                        if (ll) {
                            pts.push(ll);
                            if (firstValidIndex === null) firstValidIndex = i;
                            lastValidIndex = i;
                            if (i === Math.round(numSubSteps * 0.55)) {
                                labelPt = ll;
                            }
                        }
                    }
                }

                if (pts.length >= 15) {
                    // Refinamiento exacto por bisección de los extremos en el limbo o límite penumbral
                    const solvePointAtS = (s_val) => {
                        let xi = x + s_val * tx;
                        let eta = y + s_val * ty;
                        for (let iter = 0; iter < 4; iter++) {
                            const ev = evalF(xi, eta);
                            if (!ev) break;
                            const gradN = ev.u * nx + ev.v * ny;
                            if (Math.abs(gradN) < 1e-6) break;
                            const delta = ev.F / gradN;
                            xi += delta * nx;
                            eta += delta * ny;
                            if (Math.abs(delta) < 1e-6) break;
                        }
                        const r2 = xi*xi + eta*eta;
                        const dist = Math.hypot(x - xi, y - eta);
                        return { xi, eta, r2, dist, valid: (r2 <= 1.0001 && dist <= L1 + 0.0005) };
                    };

                    const ds = (L1 * 1.06) / numSubSteps;
                    const bisectEdge = (sIn, sOut) => {
                        let a = sIn, b = sOut;
                        for (let k = 0; k < 15; k++) {
                            const m = 0.5 * (a + b);
                            const p = solvePointAtS(m);
                            if (p.valid) a = m;
                            else b = m;
                        }
                        const pEdge = solvePointAtS(a);
                        return pEdge.valid ? besselianXYToLatLng(eclipse, t, pEdge.xi, pEdge.eta) : null;
                    };

                    if (firstValidIndex !== null && firstValidIndex > -numSubSteps) {
                        const sIn = (firstValidIndex / numSubSteps) * (L1 * 1.06);
                        const sOut = sIn - ds;
                        const ptEdgeStart = bisectEdge(sIn, sOut);
                        if (ptEdgeStart && Math.hypot(ptEdgeStart.lat - pts[0].lat, ptEdgeStart.lng - pts[0].lng) < 3.0) {
                            pts.unshift(ptEdgeStart);
                        }
                    }
                    if (lastValidIndex !== null && lastValidIndex < numSubSteps) {
                        const sIn = (lastValidIndex / numSubSteps) * (L1 * 1.06);
                        const sOut = sIn + ds;
                        const ptEdgeEnd = bisectEdge(sIn, sOut);
                        if (ptEdgeEnd && Math.hypot(ptEdgeEnd.lat - pts[pts.length-1].lat, ptEdgeEnd.lng - pts[pts.length-1].lng) < 3.0) {
                            pts.push(ptEdgeEnd);
                        }
                    }

                    if (!labelPt && pts.length > 0) {
                        labelPt = pts[Math.floor(pts.length * 0.75)] || pts[pts.length - 1];
                    }
                    const utH = Math.floor((ut % 24 + 24) % 24);
                    const utM = Math.round(((ut - Math.floor(ut)) * 60 + 60) % 60);
                    const labelText = `${String(utH).padStart(2,'0')}:${String(utM).padStart(2,'0')} UT1`;
                    utLines.push({
                        pts,
                        labelPt,
                        labelText
                    });
                }
            }

            cachedEclipseGeometry = {
                eclipseKey: key,
                centerCoords,
                totNorthCoords,
                totSouthCoords,
                isoLines,
                sunriseLoop,
                sunsetLoop,
                fullEspenakLoop,
                utLines
            };

            return cachedEclipseGeometry;
        }


// Exposición en el objeto global
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
    window.precomputeEclipseGeometry = precomputeEclipseGeometry;
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
        precomputeEclipseGeometry
    };
}
