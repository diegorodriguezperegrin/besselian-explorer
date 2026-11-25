import urllib.request
import urllib.error
import ssl
import time
import json
import datetime
import os

links_meta = [
    {
        "id": "meteorshowers",
        "title": "Meteor showers as seen from space",
        "url": "https://www.meteorshowers.org/",
        "desc_ca": "Simulació 3D orbital interactiva de les principals pluges d'estrelles creuant l'òrbita terrestre.",
        "desc_es": "Simulación 3D orbital interactiva de las principales lluvias de meteoros cruzando la órbita terrestre.",
        "category": "simulacions_3d",
        "icon": "fa-meteor"
    },
    {
        "id": "theskylive_3d",
        "title": "3D Solar System Simulator (TheSkyLive)",
        "url": "https://theskylive.com/3dsolarsystem",
        "desc_ca": "Simulador interactiu 3D del Sistema Solar amb planetes, cometes, asteroides i missions espacials.",
        "desc_es": "Simulador interactivo 3D del Sistema Solar con planetas, cometas, asteroides y misiones espaciales.",
        "category": "simulacions_3d",
        "icon": "fa-globe"
    },
    {
        "id": "exoplanet_transits",
        "title": "Find Exoplanet Transits (Swarthmore)",
        "url": "https://astro.swarthmore.edu/transits/transits.cgi",
        "desc_ca": "Càlcul i predicció de trànsits d'exoplanetes observables segons les coordenades de l'observador.",
        "desc_es": "Cálculo y predicción de tránsitos de exoplanetas observables según las coordenadas del observador.",
        "category": "observacio",
        "icon": "fa-satellite"
    },
    {
        "id": "in_the_sky",
        "title": "Guides to the night sky (In-The-Sky.org)",
        "url": "https://in-the-sky.org/",
        "desc_ca": "Guies detallades del cel nocturn, cartes interactives, passos de satèl·lits i esdeveniments celestes.",
        "desc_es": "Guías detalladas del cielo nocturno, cartas interactivas, pasos de satélites y eventos celestes.",
        "category": "observacio",
        "icon": "fa-compass"
    },
    {
        "id": "stellarium",
        "title": "Stellarium Web & Desktop",
        "url": "https://stellarium.org/",
        "desc_ca": "El planetari de codi obert per excel·lència. Mostra un cel realista en 3D tal com es veu a ull nu o amb telescopi.",
        "desc_es": "El planetario de código abierto por excelencia. Muestra un cielo realista en 3D a simple vista o con telescopio.",
        "category": "observacio",
        "icon": "fa-star"
    },
    {
        "id": "transit_finder",
        "title": "ISS TRANSIT FINDER",
        "url": "https://transit-finder.com/",
        "desc_ca": "Predicció precisa de trànsits de l'Estació Espacial Internacional (ISS) per davant del Sol o de la Lluna.",
        "desc_es": "Predicción precisa de tránsitos de la Estación Espacial Internacional (ISS) por delante del Sol o la Luna.",
        "category": "observacio",
        "icon": "fa-shuttle-space"
    },
    {
        "id": "suncalc",
        "title": "SunCalc",
        "url": "https://www.suncalc.org/",
        "desc_ca": "Càlcul de la posició del Sol, hores de sortida/posta, crepuscles, azimut i alçada solar sobre mapa.",
        "desc_es": "Cálculo de la posición del Sol, ortos, ocasos, crepúsculos, acimut y altura solar sobre mapa.",
        "category": "sol_lluna",
        "icon": "fa-sun"
    },
    {
        "id": "mooncalc",
        "title": "MoonCalc",
        "url": "https://www.mooncalc.org/",
        "desc_ca": "Càlcul i visualització de fases lunars, posició, azimut, alçada i trajectòria de la Lluna.",
        "desc_es": "Cálculo y visualización de fases lunares, posición, acimut, altura y trayectoria de la Luna.",
        "category": "sol_lluna",
        "icon": "fa-moon"
    },
    {
        "id": "quickmap",
        "title": "ACT-REACT QuickMap (LROC)",
        "url": "https://quickmap.lroc.im-ldi.com/",
        "desc_ca": "Mapa i visor 3D interactiu d'alta resolució de la superfície lunar (Lunar Reconnaissance Orbiter).",
        "desc_es": "Mapa y visor 3D interactivo de alta resolución de la superficie lunar (Lunar Reconnaissance Orbiter).",
        "category": "sol_lluna",
        "icon": "fa-map-location-dot"
    },
    {
        "id": "udeuschle_panorama",
        "title": "Create a panorama (Ulrich Deuschle)",
        "url": "https://www.udeuschle.de/panoramas/makepanoramas_en.htm",
        "desc_ca": "Generador de panorames i perfils d'horitzó per a avaluar la visibilitat de relleus i muntanyes llunyanes.",
        "desc_es": "Generador de panoramas y perfiles de horizonte para evaluar visibilidad de relieves y montañas lejanas.",
        "category": "horitzo",
        "icon": "fa-mountain-sun"
    },
    {
        "id": "peakfinder",
        "title": "PeakFinder",
        "url": "https://www.peakfinder.com/",
        "desc_ca": "Identificador panoràmic de cims i muntanyes a 360° des de qualsevol coordenada geogràfica de la Terra.",
        "desc_es": "Identificador panorámico de cumbres y montañas a 360° desde cualquier coordenada geográfica de la Tierra.",
        "category": "horitzo",
        "icon": "fa-mountain"
    },
    {
        "id": "peakvisor",
        "title": "PeakVisor",
        "url": "https://peakvisor.com/",
        "desc_ca": "Reconeixement de cims en 3D i modelat de terreny per a planificar observacions astronòmiques de camp.",
        "desc_es": "Reconocimiento de cumbres en 3D y modelado de terreno para planificar observaciones astronómicas de campo.",
        "category": "horitzo",
        "icon": "fa-binoculars"
    },
    {
        "id": "heywhatsthat",
        "title": "Hey Whats That Profiler",
        "url": "https://www.heywhatsthat.com/profiler.html",
        "desc_ca": "Dibuixa perfils d'elevació del terreny i línies de visió entre dos punts qualsevol de la Terra.",
        "desc_es": "Traza perfiles de elevación del terreno y líneas de visión entre dos puntos cualesquiera de la Tierra.",
        "category": "horitzo",
        "icon": "fa-chart-area"
    },
    {
        "id": "ptolemaeus",
        "title": "Ptolemaeus Arabus et Latinus (BAdW)",
        "url": "https://ptolemaeus.badw.de/start",
        "desc_ca": "Edició crítica i arxiu digital de les versions àrabs i llatines de l'Almagest i textos de Claudi Ptolomeu.",
        "desc_es": "Edición crítica y archivo digital de las versiones árabes y latinas del Almagesto y textos de Claudio Ptolomeo.",
        "category": "historia",
        "icon": "fa-book-atlas"
    },
    {
        "id": "deltav_calculator",
        "title": "Delta-V Calculator (Strout.net)",
        "url": "https://strout.net/info/science/delta-v/intro.html",
        "desc_ca": "Calculadora de l'equació de coets de Tsiolkovski i pressupost de Delta-V per a maniobres orbitals.",
        "desc_es": "Calculadora de la ecuación de cohetes de Tsiolkovski y presupuesto de Delta-V para maniobras orbitales.",
        "category": "historia",
        "icon": "fa-rocket"
    },
    {
        "id": "alexboxer_astrolabe",
        "title": "Interactive Astrolabe (Alex Boxer)",
        "url": "https://alexboxer.com/astrolabe/",
        "desc_ca": "Astrolabi interactiu al navegador: aprèn a utilitzar la xarxa, el timpà i l'alídada per calcular l'hora solar i estel·lar.",
        "desc_es": "Astrolabio interactivo en el navegador: aprende a usar la red, el tímpano y la alidada para calcular la hora solar y estelar.",
        "category": "historia",
        "icon": "fa-ring"
    },
    {
        "id": "astrometry_net",
        "title": "Astrometry.net",
        "url": "https://nova.astrometry.net/",
        "desc_ca": "Resolució astromètrica automàtica (plate solving) d'imatges del cel per identificar estrelles i objectes.",
        "desc_es": "Resolución astrométrica automática (plate solving) de imágenes del cielo para identificar estrellas y objetos.",
        "category": "observacio",
        "icon": "fa-crosshairs"
    },
    {
        "id": "telescopius",
        "title": "Telescopius",
        "url": "https://telescopius.com/",
        "desc_ca": "Planificador d'astrofotografia i observació del cel profund, simulador de camp visual i mosaics.",
        "desc_es": "Planificador de astrofotografía y observación de cielo profundo, simulador de campo visual y mosaicos.",
        "category": "observacio",
        "icon": "fa-camera"
    }
]

def check_all():
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    results = []
    now_iso = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    print(f"[{now_iso}] Comprovant {len(links_meta)} enllaços astronòmics...")

    for item in links_meta:
        url = item["url"]
        t0 = time.time()
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
            }
        )
        entry = {
            "id": item["id"],
            "title": item["title"],
            "url": item["url"],
            "desc_ca": item["desc_ca"],
            "desc_es": item["desc_es"],
            "category": item["category"],
            "icon": item["icon"],
            "checked_at": now_iso
        }
        try:
            with urllib.request.urlopen(req, timeout=12, context=ctx) as resp:
                latency = round((time.time() - t0) * 1000)
                final_url = resp.geturl()
                status = resp.getcode()
                redirected = (final_url.rstrip("/") != url.rstrip("/"))
                entry.update({
                    "status": status,
                    "alive": True,
                    "latency_ms": latency,
                    "final_url": final_url,
                    "redirected": redirected,
                    "note": f"Redirigeix a: {final_url}" if redirected else None,
                    "error": None
                })
                redirect_msg = f" (Redirigit a: {final_url})" if redirected else ""
                print(f"  [OK {status}] {latency}ms | {item['title']}{redirect_msg}")
        except urllib.error.HTTPError as e:
            latency = round((time.time() - t0) * 1000)
            is_cf_or_waf = e.code in [403, 429] and any(k.lower() in ['cf-ray', 'cloudflare', 'server'] for k in e.headers.keys())
            alive = True if is_cf_or_waf else (False if e.code in [404, 410, 500, 502, 503] else True)
            entry.update({
                "status": e.code,
                "alive": alive,
                "latency_ms": latency,
                "final_url": url,
                "redirected": False,
                "note": "Actiu al navegador (Protecció WAF/Cloudflare)" if is_cf_or_waf else None,
                "error": None if is_cf_or_waf else f"HTTP {e.code}: {e.reason}"
            })
            waf_msg = " [Actiu al navegador - WAF/Cloudflare]" if is_cf_or_waf else f" [ERROR {e.code}]"
            print(f"  [HTTP {e.code}] {latency}ms | {item['title']}{waf_msg}")
        except Exception as e:
            latency = round((time.time() - t0) * 1000)
            entry.update({
                "status": 0,
                "alive": False,
                "latency_ms": latency,
                "final_url": None,
                "redirected": False,
                "note": None,
                "error": str(e)
            })
            print(f"  [FALLADA] {latency}ms | {item['title']} - {e}")

        results.append(entry)

    data = {
        "last_updated": now_iso,
        "total": len(results),
        "online": sum(1 for r in results if r["alive"]),
        "offline": sum(1 for r in results if not r["alive"]),
        "redirected_count": sum(1 for r in results if r.get("redirected")),
        "links": results
    }

    output_path = os.path.join(os.path.dirname(__file__), "enllacos_astronomia_status.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"\nFinalitzat amb èxit! {data['online']}/{data['total']} enllaços actius.")
    return data

if __name__ == "__main__":
    check_all()
