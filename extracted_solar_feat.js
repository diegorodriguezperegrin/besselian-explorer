function setupSolarSurfaceFeatures() {
    const details = {
        "feat-protuberancies": {
            desc: "Les **protuberàncies solars** són enormes estructures de gas relativament fred i dens aixecades des de la fotosfera fins a la calenta corona solar. Segueixen les línies invisibles del camp magnètic formant bucles gegantins. Es poden observar clarament a la vora del Sol amb telescopis d'H-Alfa.",
            highlight: "prominence"
        },
        "feat-facules": {
            desc: "Les **fàcules** o **màcules** són regions brillants i molt calentes que s'observen a la fotosfera, generalment a prop de les taques solars. Són causades per concentracions de línies de camp magnètic que fan que el gas sigui més brillant, compensant la pèrdua d'energia de les taques.",
            highlight: "faculae"
        },
        "feat-fulgures": {
            desc: "Les **fúlgures** o **flamarades** són alliberaments sobtats i violents d'energia a la corona solar. Són les tempestes magnètiques més violentes del Sistema Solar i poden enviar ràfegues de radiació (raigs X, UV) i partícules carregades cap a la Terra en pocs minuts, afectant les nostres telecomunicacions.",
            highlight: "flare"
        },
        "feat-granuls": {
            desc: "Els **grànuls** són la part superior de columnes de convecció tèrmica que pugen des de l'interior solar (com bombolles en aigua bullent). Cada grànul fa uns 1.000 km d'amplada i dura uns 10 minuts. Les **espícules** són raigs verticals ràpids de gas calent que s'eleven a la cromosfera.",
            highlight: "granules"
        }
    };

    const detailText = document.getElementById("solar-surface-detail-text");
    const prominenceLoop = document.getElementById("svg-prominence-loop");
    const flareBlast = document.getElementById("svg-flare-blast");

    if (!detailText) return;

    Object.keys(details).forEach(id => {
        const card = document.getElementById(id);
        if (!card) return;

        card.addEventListener("click", () => {
            // Remove border highlighting from all cards
            document.querySelectorAll("#screen-8 .obs-card").forEach(c => {
                c.style.borderColor = "rgba(255,255,255,0.05)";
                c.style.background = "rgba(255,255,255,0.02)";
            });

            // Add correct border highlighting according to its color category
            let color = "var(--solar-orange)";
            if (id === "feat-protuberancies") color = "var(--solar-red)";
            if (id === "feat-facules") color = "var(--solar-yellow)";
            if (id === "feat-fulgures") color = "var(--solar-orange)";
            if (id === "feat-granuls") color = "var(--accent-green)";
            
            card.style.borderColor = color;
            card.style.background = "rgba(255, 255, 255, 0.05)";

            // Update text with description
            detailText.innerHTML = details[id].desc.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

            // Reset SVG animations/highlights
            if (prominenceLoop) {
                prominenceLoop.setAttribute("stroke-width", "8");
                prominenceLoop.style.opacity = "0.4";
            }
            if (flareBlast) {
                flareBlast.style.opacity = "0.2";
            }

            // Apply specific highlights to SVG
            const highlight = details[id].highlight;
            if (highlight === "prominence" && prominenceLoop) {
                prominenceLoop.setAttribute("stroke-width", "16");
                prominenceLoop.style.opacity = "1";
            } else if (highlight === "flare" && flareBlast) {
                flareBlast.style.opacity = "0.9";
            }
        });
    });
}
