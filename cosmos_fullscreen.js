/* =========================================================================
   COSMOS MATARÓ - CONTROLADOR DE PANTALLA COMPLETA (cosmos_fullscreen.js)
   Intenta activar la API nativa Fullscreen sobre document.documentElement.
   Si el contenedor (p. ej. iframe de Google Sites o iOS Safari) bloquea
   Fullscreen, abre la simulación limpia en una pestaña nueva manteniendo
   el idioma activo.
   ========================================================================= */
(function () {
  const ICON_EXPAND =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<polyline points="15 3 21 3 21 9"></polyline>' +
    '<polyline points="9 21 3 21 3 15"></polyline>' +
    '<line x1="21" y1="3" x2="14" y2="10"></line>' +
    '<line x1="3" y1="21" x2="10" y2="14"></line>' +
    '</svg>';

  const ICON_COMPRESS =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<polyline points="4 14 10 14 10 20"></polyline>' +
    '<polyline points="20 10 14 10 14 4"></polyline>' +
    '<line x1="14" y1="10" x2="21" y2="3"></line>' +
    '<line x1="3" y1="21" x2="10" y2="14"></line>' +
    '</svg>';

  const LABELS = {
    es: {
      enter: 'Pantalla completa',
      exit: 'Salir de pantalla completa',
      newTab: 'Abrir a pantalla completa (nueva pestaña)'
    },
    ca: {
      enter: 'Pantalla completa',
      exit: 'Sortir de pantalla completa',
      newTab: 'Obrir a pantalla completa (pestanya nova)'
    },
    en: {
      enter: 'Fullscreen',
      exit: 'Exit fullscreen',
      newTab: 'Open fullscreen (new tab)'
    }
  };

  function getLang() {
    const l = (document.documentElement.lang || 'es').toLowerCase().slice(0, 2);
    return LABELS[l] ? l : 'es';
  }

  function isFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }

  function canNativeFullscreen() {
    const root = document.documentElement;
    const enabled = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
    const hasMethod = !!(root && (root.requestFullscreen || root.webkitRequestFullscreen));
    return enabled && hasMethod;
  }

  function openCleanTab() {
    try {
      const url = new URL(window.location.href);
      const lang = (document.documentElement.lang || '').toLowerCase().slice(0, 2);
      if (lang === 'es' || lang === 'ca' || lang === 'en') {
        url.searchParams.set('lang', lang);
      }
      window.open(url.toString(), '_blank', 'noopener,noreferrer');
    } catch (e) {
      window.open(window.location.href, '_blank', 'noopener,noreferrer');
    }
  }

  function updateButtons() {
    const active = isFullscreen();
    const nativeOk = canNativeFullscreen();
    const t = LABELS[getLang()];
    const label = active ? t.exit : (nativeOk ? t.enter : t.newTab);

    document.querySelectorAll('.cosmos-fs-btn').forEach((btn) => {
      btn.innerHTML = active ? ICON_COMPRESS : ICON_EXPAND;
      btn.title = label;
      btn.setAttribute('aria-label', label);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      btn.classList.toggle('is-fullscreen', active);
    });
  }

  function toggleCosmosFullscreen(event) {
    if (event) {
      event.stopPropagation();
    }

    if (isFullscreen()) {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit) {
        try {
          const p = exit.call(document);
          if (p && typeof p.catch === 'function') p.catch(() => {});
        } catch (e) {}
      }
      return;
    }

    if (!canNativeFullscreen()) {
      openCleanTab();
      return;
    }

    const root = document.documentElement;
    const req = root.requestFullscreen || root.webkitRequestFullscreen;
    try {
      const p = req.call(root);
      if (p && typeof p.catch === 'function') {
        p.catch(() => {
          openCleanTab();
        });
      }
    } catch (e) {
      openCleanTab();
    }
  }

  window.toggleCosmosFullscreen = toggleCosmosFullscreen;

  function init() {
    updateButtons();
    document.addEventListener('fullscreenchange', updateButtons);
    document.addEventListener('webkitfullscreenchange', updateButtons);

    if (typeof MutationObserver === 'function') {
      const obs = new MutationObserver(updateButtons);
      obs.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
