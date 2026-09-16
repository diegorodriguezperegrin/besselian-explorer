/* =========================================================================
   COSMOS MATARÓ - GESTOR DE PANELES Y NAVEGACIÓN UI (shared_ui_panels.js)
   Módulo unificado para Solar Eclipse Explorer (SEE) y Lunar Eclipse Explorer (LEE).
   Control de paneles flotantes arrastrables (drag & drop), elevación al frente
   (z-index dinámico), sincronización de barra superior y pila adaptativa para móviles.
   ========================================================================= */

var getDOM = window.getDOM || function(id) {
    return document.getElementById(id);
};

function _getDOM(id) {
    return getDOM(id);
}

function updateTopNavButtonsState() {
            const sidePanel = getDOM('sidebar-panel');
            const setPanel = getDOM('settings-panel');
            const limbPanel = getDOM('lunar-limb-panel');
            const dockPanel = getDOM('playback-dock');
            const navBar = getDOM('top-nav-bar');

            const sideOpen = sidePanel && !sidePanel.classList.contains('collapsed');
            const setOpen = setPanel && !setPanel.classList.contains('collapsed');
            const limbOpen = limbPanel && !limbPanel.classList.contains('collapsed');
            const dockOpen = dockPanel && !dockPanel.classList.contains('collapsed');

            const btnSide = getDOM('btn-reopen-left');
            const btnSet = getDOM('btn-reopen-right');
            const btnDock = getDOM('btn-reopen-dock');
            const btnLimb = getDOM('btn-reopen-limb');

            const isTeleView = (typeof currentActiveView !== 'undefined') && currentActiveView === 'telescopic';
            const showLimbBtn = isTeleView && getDOM('chk-show-lunar-limb')?.checked;

            if (btnSide) { btnSide.style.display = sideOpen ? 'none' : 'inline-flex'; btnSide.classList.remove('active-nav'); }
            if (btnSet) { btnSet.style.display = setOpen ? 'none' : 'inline-flex'; btnSet.classList.remove('active-nav'); }
            if (btnDock) { btnDock.style.display = dockOpen ? 'none' : 'inline-flex'; btnDock.classList.remove('active-nav'); }
            if (btnLimb) { btnLimb.style.display = (showLimbBtn && !limbOpen) ? 'inline-flex' : 'none'; btnLimb.classList.remove('active-nav'); }

            const activeView = (typeof currentActiveView !== 'undefined') ? currentActiveView : (window.currentActiveView || '3d');
            const isSmall = window.innerWidth <= 900;
            const anyPanelOpen = (sideOpen || setOpen || limbOpen);

            if (typeof document !== 'undefined' && document.body) {
                document.body.classList.toggle('panel-open-mobile', isSmall && anyPanelOpen);
                document.body.setAttribute('data-view-mode', activeView);
                document.body.classList.remove('view-3d', 'view-map', 'view-telescopic', 'view-route');
                document.body.classList.add('view-' + activeView);

                const search3D = getDOM('space-3d-search-container');
                const searchMap = getDOM('map-search-container');

                if (activeView === 'telescopic' || activeView === 'route') {
                    if (search3D) search3D.style.setProperty('display', 'none', 'important');
                    if (searchMap) searchMap.style.setProperty('display', 'none', 'important');
                } else if (activeView === '3d') {
                    if (searchMap) searchMap.style.setProperty('display', 'none', 'important');
                    if (search3D) {
                        if (isSmall && anyPanelOpen) {
                            search3D.style.setProperty('display', 'none', 'important');
                        } else {
                            search3D.style.removeProperty('display');
                            search3D.style.display = 'flex';
                        }
                    }
                } else if (activeView === 'map') {
                    if (search3D) search3D.style.setProperty('display', 'none', 'important');
                    if (searchMap) {
                        if (isSmall && anyPanelOpen) {
                            searchMap.style.setProperty('display', 'none', 'important');
                        } else {
                            searchMap.style.removeProperty('display');
                            searchMap.style.display = 'flex';
                        }
                    }
                }
            }

            if (navBar) {
                navBar.style.left = '15px';
                if (sideOpen && sidePanel) {
                    const sideBottom = sidePanel.offsetTop + sidePanel.offsetHeight;
                    navBar.style.top = `${sideBottom + 8}px`;
                    if (btnSide) {
                        btnSide.style.position = '';
                        btnSide.style.top = '';
                        btnSide.style.left = '';
                        btnSide.style.zIndex = '';
                    }
                } else if (isSmall && ((setOpen && setPanel) || (limbOpen && limbPanel))) {
                    const activePanel = (setOpen && setPanel) ? setPanel : limbPanel;
                    if (btnSide) {
                        btnSide.style.position = 'fixed';
                        btnSide.style.top = '15px';
                        btnSide.style.left = '15px';
                        btnSide.style.zIndex = '1350';
                    }
                    const panelBottom = activePanel.offsetTop + activePanel.offsetHeight;
                    navBar.style.top = `${panelBottom + 8}px`;
                } else {
                    if (btnSide) {
                        btnSide.style.position = '';
                        btnSide.style.top = '';
                        btnSide.style.left = '';
                        btnSide.style.zIndex = '';
                    }
                    navBar.style.top = '15px';
                }
            }
        }

        // =========================================================================
        // GESTOR DE VENTANAS FLOTANTES ARRASTRABLES (ESTILO HÍBRIDO ESCRITORIO / MÓVIL)
        // =========================================================================
        let maxPanelZIndex = 1100;

        function bringPanelToFront(panel) {
            if (!panel) return;
            maxPanelZIndex++;
            panel.style.zIndex = maxPanelZIndex;
        }

        function resetPanelDefaultPosition(panelId) {
            const panel = getDOM(panelId);
            if (!panel) return;
            panel.style.left = '';
            panel.style.top = '';
            panel.style.right = panelId === 'lunar-limb-panel' ? '375px' : '';
            panel.style.bottom = '';
            panel.style.margin = '';
        }

        function resetAllPanelsPositions() {
            ['sidebar-panel', 'settings-panel', 'lunar-limb-panel'].forEach(id => {
                resetPanelDefaultPosition(id);
            });
        }

        function initDraggablePanels() {
            const panels = [
                getDOM('sidebar-panel'),
                getDOM('settings-panel'),
                getDOM('lunar-limb-panel')
            ].filter(Boolean);

            panels.forEach(panel => {
                const header = panel.querySelector('.panel-header');
                if (!header) return;

                // Elevar al frente al hacer clic en cualquier parte del panel
                panel.addEventListener('pointerdown', () => {
                    bringPanelToFront(panel);
                });

                // Doble clic en la cabecera restablece su posición original anclada
                header.addEventListener('dblclick', (e) => {
                    if (window.innerWidth <= 900) return;
                    if (e.target.closest('.panel-toggle') || e.target.closest('button') || e.target.closest('a')) return;
                    resetPanelDefaultPosition(panel.id);
                });

                let isDragging = false;
                let startX = 0, startY = 0;
                let startLeft = 0, startTop = 0;

                header.addEventListener('pointerdown', (e) => {
                    // Desactivar arrastre libre en móviles o pantallas táctiles pequeñas
                    if (window.innerWidth <= 900) return;
                    // Evitar arrastre si se pulsa el botón de cerrar u otros controles interactivos
                    if (e.target.closest('.panel-toggle') || e.target.closest('button') || e.target.closest('input') || e.target.closest('select') || e.target.closest('a')) return;
                    // Solo responder al botón principal del ratón (0) o contacto táctil
                    if (e.button !== 0) return;

                    isDragging = true;
                    header.setPointerCapture(e.pointerId);
                    header.classList.add('is-dragging');
                    document.body.classList.add('is-dragging-panel');
                    bringPanelToFront(panel);

                    const rect = panel.getBoundingClientRect();
                    startX = e.clientX;
                    startY = e.clientY;
                    startLeft = rect.left;
                    startTop = rect.top;

                    // Fijar estilos en píxeles explícitos para movimiento fluido
                    panel.style.left = `${startLeft}px`;
                    panel.style.top = `${startTop}px`;
                    panel.style.right = 'auto';
                    panel.style.bottom = 'auto';
                    panel.style.margin = '0';

                    e.preventDefault();
                });

                header.addEventListener('pointermove', (e) => {
                    if (!isDragging) return;
                    const dx = e.clientX - startX;
                    const dy = e.clientY - startY;

                    const panelW = panel.offsetWidth;
                    const minLeft = 10;
                    const maxLeft = Math.max(10, window.innerWidth - panelW - 10);
                    const minTop = 10;
                    const maxTop = Math.max(10, window.innerHeight - 60); // Cabecera siempre accesible

                    let newLeft = startLeft + dx;
                    let newTop = startTop + dy;

                    newLeft = Math.max(minLeft, Math.min(maxLeft, newLeft));
                    newTop = Math.max(minTop, Math.min(maxTop, newTop));

                    panel.style.left = `${newLeft}px`;
                    panel.style.top = `${newTop}px`;
                });

                const endDrag = (e) => {
                    if (!isDragging) return;
                    isDragging = false;
                    try {
                        header.releasePointerCapture(e.pointerId);
                    } catch(err) {}
                    header.classList.remove('is-dragging');
                    document.body.classList.remove('is-dragging-panel');
                };

                header.addEventListener('pointerup', endDrag);
                header.addEventListener('pointercancel', endDrag);
            });
        }

        // -------------------------------------------------------------
        // PILA LIFO DE PANELES EN PANTALLAS PEQUEÑAS (<= 900px)
        // -------------------------------------------------------------
        const smallScreenPanelStack = [];
        const smallScreenPanels = ['sidebar-panel', 'settings-panel', 'lunar-limb-panel'];

        function pushPanelToSmallScreenStack(panelId) {
            if (window.innerWidth > 900) return;
            // Minimizar los otros paneles laterales abiertos manteniendo su registro y sincronización
            smallScreenPanels.forEach(id => {
                if (id !== panelId) {
                    const p = document.getElementById(id);
                    if (p && !p.classList.contains('collapsed')) {
                        if (id === 'sidebar-panel') {
                            p.classList.add('collapsed');
                            resetPanelDefaultPosition('sidebar-panel');
                        } else if (id === 'settings-panel') {
                            p.classList.add('collapsed');
                            resetPanelDefaultPosition('settings-panel');
                        } else if (id === 'lunar-limb-panel') {
                            toggleLunarLimbPanel(false, true);
                        }
                        if (!smallScreenPanelStack.includes(id)) {
                            smallScreenPanelStack.push(id);
                        }
                    }
                }
            });
            const existingIdx = smallScreenPanelStack.indexOf(panelId);
            if (existingIdx !== -1) {
                smallScreenPanelStack.splice(existingIdx, 1);
            }
            smallScreenPanelStack.push(panelId);
        }

        function popPanelFromSmallScreenStack(closedPanelId, wasActive = true) {
            if (window.innerWidth > 900) return;
            const idx = smallScreenPanelStack.indexOf(closedPanelId);
            if (idx !== -1) {
                smallScreenPanelStack.splice(idx, 1);
            }
            if (wasActive && smallScreenPanelStack.length > 0) {
                const prevId = smallScreenPanelStack[smallScreenPanelStack.length - 1];
                if (prevId === 'sidebar-panel') {
                    toggleSidebar(true, true);
                } else if (prevId === 'settings-panel') {
                    toggleSettingsPanel(true, true);
                } else if (prevId === 'lunar-limb-panel') {
                    toggleLunarLimbPanel(true, true);
                }
            }
        }

        function toggleSidebar(show = null, fromHistory = false) {
            const panel = getDOM('sidebar-panel');
            if (!panel) return;
            const isCurrentlyOpen = !panel.classList.contains('collapsed');
            const targetState = (show !== null) ? show : !isCurrentlyOpen;
            const isMobile = window.innerWidth <= 900;

            if (targetState) {
                resetPanelDefaultPosition('sidebar-panel');
                if (isMobile && !fromHistory) {
                    pushPanelToSmallScreenStack('sidebar-panel');
                }
                panel.classList.remove('collapsed');
                bringPanelToFront(panel);
            } else {
                const wasActive = isCurrentlyOpen;
                panel.classList.add('collapsed');
                resetPanelDefaultPosition('sidebar-panel');
                if (isMobile) {
                    popPanelFromSmallScreenStack('sidebar-panel', wasActive);
                }
            }
            updateTopNavButtonsState();
        }

        function toggleSettingsPanel(show = null, fromHistory = false) {
            const panel = getDOM('settings-panel');
            if (!panel) return;
            const isCurrentlyOpen = !panel.classList.contains('collapsed');
            const targetState = (show !== null) ? show : !isCurrentlyOpen;
            const isMobile = window.innerWidth <= 900;

            if (targetState) {
                resetPanelDefaultPosition('settings-panel');
                if (isMobile && !fromHistory) {
                    pushPanelToSmallScreenStack('settings-panel');
                }
                panel.classList.remove('collapsed');
                bringPanelToFront(panel);
            } else {
                const wasActive = isCurrentlyOpen;
                panel.classList.add('collapsed');
                resetPanelDefaultPosition('settings-panel');
                if (isMobile) {
                    popPanelFromSmallScreenStack('settings-panel', wasActive);
                }
            }
            updateTopNavButtonsState();
            if (typeof updateLiveBadgeState === 'function') updateLiveBadgeState();
        }

        function toggleLunarLimbPanel(show = null, fromHistory = false) {
            const panel = getDOM('lunar-limb-panel');
            if (!panel) return;
            const isCurrentlyOpen = !panel.classList.contains('collapsed');
            const targetState = (show !== null) ? show : !isCurrentlyOpen;
            const isMobile = window.innerWidth <= 900;

            if (targetState) {
                resetPanelDefaultPosition('lunar-limb-panel');
                if (isMobile && !fromHistory) {
                    pushPanelToSmallScreenStack('lunar-limb-panel');
                }
                panel.classList.remove('collapsed');
                bringPanelToFront(panel);

                const chk = getDOM('chk-show-lunar-limb');
                if (chk) chk.checked = true;
                toggleMoreTele(true);
                const chkLimbLbls = getDOM('chk-limb-labels');
                const lblLimbLbls = getDOM('lbl-limb-labels');
                if (chkLimbLbls && lblLimbLbls) {
                    chkLimbLbls.disabled = false;
                    lblLimbLbls.classList.remove('disabled');
                    lblLimbLbls.style.opacity = '1';
                    lblLimbLbls.style.pointerEvents = 'auto';
                }
                const chkActLog = getDOM('chk-show-activity-log');
                const lblActLog = getDOM('lbl-show-activity-log');
                if (chkActLog && lblActLog) {
                    chkActLog.disabled = false;
                    lblActLog.classList.remove('disabled');
                    lblActLog.style.opacity = '1';
                    lblActLog.style.pointerEvents = 'auto';
                }
                if (currentActiveView === 'telescopic') {
                    renderTelescopicView();
                } else {
                    renderLunarLimbRadar([], false);
                }
            } else {
                const wasActive = isCurrentlyOpen;
                panel.classList.add('collapsed');
                resetPanelDefaultPosition('lunar-limb-panel');
                const chk = getDOM('chk-show-lunar-limb');
                if (chk) chk.checked = false;
                const chkLimbLbls = getDOM('chk-limb-labels');
                const lblLimbLbls = getDOM('lbl-limb-labels');
                if (chkLimbLbls && lblLimbLbls) {
                    chkLimbLbls.disabled = true;
                    lblLimbLbls.classList.add('disabled');
                    lblLimbLbls.style.opacity = '0.5';
                    lblLimbLbls.style.pointerEvents = 'none';
                }
                const chkActLog = getDOM('chk-show-activity-log');
                const lblActLog = getDOM('lbl-show-activity-log');
                if (chkActLog && lblActLog) {
                    chkActLog.disabled = true;
                    lblActLog.classList.add('disabled');
                    lblActLog.style.opacity = '0.5';
                    lblActLog.style.pointerEvents = 'none';
                    if (chkActLog.checked) {
                        chkActLog.checked = false;
                        toggleActivityLog(false);
                    }
                }
                if (isMobile) {
                    popPanelFromSmallScreenStack('lunar-limb-panel', wasActive);
                }
                if (currentActiveView === 'telescopic') {
                    renderTelescopicView();
                }
            }
            updateTopNavButtonsState();
        }

        function togglePlaybackDock(show = null) {
            const panel = getDOM('playback-dock');
            if (!panel) return;
            const isCurrentlyOpen = !panel.classList.contains('collapsed');
            const targetState = (show !== null) ? show : !isCurrentlyOpen;

            if (targetState) {
                panel.classList.remove('collapsed');
            } else {
                panel.classList.add('collapsed');
            }
            updateTopNavButtonsState();
        }

// Contención y recentrado en redimensionamiento de ventana
window.addEventListener('resize', () => {
    const isSmall = window.innerWidth <= 900;
    const panelIds = ['sidebar-panel', 'settings-panel', 'lunar-limb-panel'];
    
    panelIds.forEach(id => {
        const p = _getDOM(id);
        if (!p || p.classList.contains('collapsed')) return;
        
        if (isSmall) {
            p.style.left = '';
            p.style.top = '';
            p.style.right = '';
            p.style.bottom = '';
            p.style.margin = '';
        } else {
            const maxL = Math.max(10, window.innerWidth - p.offsetWidth - 10);
            const maxT = Math.max(10, window.innerHeight - 60);
            if (p.offsetLeft > maxL) p.style.left = `${maxL}px`;
            if (p.offsetTop > maxT) p.style.top = `${maxT}px`;
        }
    });
    
    updateTopNavButtonsState();
});

// Exposición global en window
if (typeof window !== 'undefined') {
    window.updateTopNavButtonsState = updateTopNavButtonsState;
    window.bringPanelToFront = bringPanelToFront;
    window.resetPanelDefaultPosition = resetPanelDefaultPosition;
    window.resetAllPanelsPositions = resetAllPanelsPositions;
    window.initDraggablePanels = initDraggablePanels;
    window.toggleSidebar = toggleSidebar;
    window.toggleSettingsPanel = toggleSettingsPanel;
    window.togglePlaybackDock = togglePlaybackDock;
    if (typeof toggleLunarLimbPanel === 'function') {
        window.toggleLunarLimbPanel = toggleLunarLimbPanel;
    }
}
