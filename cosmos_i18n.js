/* =========================================================================
   COSMOS MATARÓ - MOTOR COMPARTIDO DE INTERNACIONALIZACIÓN (cosmos_i18n.js)
   Sincroniza idioma (ES / CA / EN) entre todas las simulaciones mediante:
     1) Parámetro URL ?lang=es|ca|en
     2) localStorage('cosmos_lang')
     3) Idioma del navegador (inglés / catalán)
     4) Idioma por defecto del portal: 'ca' (Catalán)
   Soporta traducción declarativa (data-i18n*) y traducción automática de
   nodos de texto y atributos (con preservación exacta del español original
   en WeakMap y MutationObserver optimizado para contenido dinámico).
   ========================================================================= */
(function (global) {
  'use strict';

  const DEFAULT_SITE_LANG = 'ca';
  const VALID_LANGS = ['es', 'ca', 'en'];
  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'TEXTAREA']);
  const ATTRS_TO_TRANSLATE = ['title', 'placeholder', 'aria-label'];
  const PURE_NUMERIC_RE = /^[\d\s:.,+\-°'"%#\/xX–—()•·↗↘▼▲]+$/;

  let currentLang = DEFAULT_SITE_LANG;
  let config = {
    pageTitle: null,
    exact: { ca: {}, en: {} },
    patterns: { ca: [], en: [] },
    htmlBlocks: {},
    onApply: null
  };

  const origTextMap = new WeakMap();
  const lastTextMap = new WeakMap();
  const origAttrMap = new WeakMap(); // Element -> { attr: origVal }
  const lastAttrMap = new WeakMap(); // Element -> { attr: lastVal }
  const origHtmlMap = new WeakMap(); // Element -> orig innerHTML (ES)

  let isApplying = false;
  let observer = null;
  let pendingNodes = new Set();
  let rafScheduled = false;

  function normalizeLang(lang) {
    if (!lang) return null;
    const l = String(lang).toLowerCase().slice(0, 2);
    return VALID_LANGS.includes(l) ? l : null;
  }

  function detectInitialLang() {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlLang = normalizeLang(params.get('lang'));
      if (urlLang) return urlLang;
    } catch (e) {}

    try {
      const saved = normalizeLang(localStorage.getItem('cosmos_lang'));
      if (saved) return saved;
    } catch (e) {}

    const nav = (navigator.language || navigator.userLanguage || '').toLowerCase();
    if (nav.startsWith('ca')) return 'ca';
    if (nav.startsWith('en')) return 'en';

    return DEFAULT_SITE_LANG;
  }

  function translateString(raw, lang) {
    if (lang === 'es' || !raw) return raw;
    if (PURE_NUMERIC_RE.test(raw)) return raw;

    const leadMatch = raw.match(/^(\s*)/);
    const trailMatch = raw.match(/(\s*)$/);
    const lead = leadMatch ? leadMatch[1] : '';
    const trail = trailMatch ? trailMatch[1] : '';
    const trimmed = raw.trim();
    if (!trimmed) return raw;

    const exactTable = config.exact[lang];
    if (exactTable && Object.prototype.hasOwnProperty.call(exactTable, trimmed)) {
      return lead + exactTable[trimmed] + trail;
    }

    // Normalizar espacios múltiples internos para emparejar texto HTML multilínea
    const collapsed = trimmed.replace(/\s+/g, ' ');
    if (collapsed !== trimmed && exactTable && Object.prototype.hasOwnProperty.call(exactTable, collapsed)) {
      return lead + exactTable[collapsed] + trail;
    }

    // Reglas de expresiones regulares ordenadas (cadenas dinámicas)
    const rules = config.patterns[lang];
    if (rules && rules.length) {
      let out = collapsed;
      let changed = false;
      for (let i = 0; i < rules.length; i++) {
        const [re, rep] = rules[i];
        const next = out.replace(re, rep);
        if (next !== out) {
          out = next;
          changed = true;
        }
      }
      if (changed) return lead + out + trail;
    }

    return raw;
  }

  function isSkippedElement(el) {
    if (!el || el.nodeType !== 1) return false;
    if (SKIP_TAGS.has(el.tagName)) return true;
    if (el.hasAttribute('data-no-i18n')) return true;
    return false;
  }

  function translateAttributes(el, lang) {
    if (!el || el.nodeType !== 1 || isSkippedElement(el)) return;
    let origObj = origAttrMap.get(el);
    let lastObj = lastAttrMap.get(el);

    for (let i = 0; i < ATTRS_TO_TRANSLATE.length; i++) {
      const attr = ATTRS_TO_TRANSLATE[i];
      if (!el.hasAttribute(attr)) continue;
      const val = el.getAttribute(attr);
      if (!val || PURE_NUMERIC_RE.test(val)) continue;

      if (!origObj) {
        origObj = {};
        origAttrMap.set(el, origObj);
      }
      if (!lastObj) {
        lastObj = {};
        lastAttrMap.set(el, lastObj);
      }

      if (origObj[attr] === undefined || val !== lastObj[attr]) {
        origObj[attr] = val;
      }

      const translated = translateString(origObj[attr], lang);
      lastObj[attr] = translated;
      if (val !== translated) {
        el.setAttribute(attr, translated);
      }
    }
  }

  function translateTextNode(node, lang) {
    const val = node.nodeValue;
    if (!val || !val.trim() || PURE_NUMERIC_RE.test(val)) return;

    const parent = node.parentElement;
    if (parent && (isSkippedElement(parent) || parent.closest('[data-no-i18n], [data-i18n-block]'))) {
      return;
    }

    const last = lastTextMap.get(node);
    if (!origTextMap.has(node) || val !== last) {
      origTextMap.set(node, val);
    }

    const canonical = origTextMap.get(node);
    const translated = translateString(canonical, lang);
    lastTextMap.set(node, translated);
    if (val !== translated) {
      node.nodeValue = translated;
    }
  }

  function applyHtmlBlocks(root, lang) {
    if (!config.htmlBlocks) return;
    const selector = '[data-i18n-block]';
    const els = [];
    if (root && root.nodeType === 1 && root.matches && root.matches(selector)) {
      els.push(root);
    }
    if (root && root.querySelectorAll) {
      root.querySelectorAll(selector).forEach((el) => els.push(el));
    }
    els.forEach((el) => {
      const key = el.getAttribute('data-i18n-block');
      const block = config.htmlBlocks[key];
      if (!block) return;
      if (!origHtmlMap.has(el)) {
        origHtmlMap.set(el, el.innerHTML);
      }
      const nextHtml = lang === 'es' ? origHtmlMap.get(el) : (block[lang] || origHtmlMap.get(el));
      if (el.innerHTML !== nextHtml) {
        el.innerHTML = nextHtml;
      }
    });
  }

  function walkAndTranslate(root, lang) {
    if (!root) return;
    if (root.nodeType === 3) {
      translateTextNode(root, lang);
      return;
    }
    if (root.nodeType !== 1 && root.nodeType !== 9) return;
    if (root.nodeType === 1 && isSkippedElement(root)) return;

    applyHtmlBlocks(root, lang);

    if (root.nodeType === 1) {
      translateAttributes(root, lang);
    }

    const doc = root.nodeType === 9 ? root : root.ownerDocument;
    if (!doc) return;

    // Atributos de elementos descendientes
    if (root.querySelectorAll) {
      const attrEls = root.querySelectorAll('[title], [placeholder], [aria-label]');
      for (let i = 0; i < attrEls.length; i++) {
        const el = attrEls[i];
        if (!el.closest('[data-no-i18n], [data-i18n-block]')) {
          translateAttributes(el, lang);
        }
      }
    }

    // Nodos de texto descendientes
    const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        const p = node.parentElement;
        if (!p || SKIP_TAGS.has(p.tagName)) return NodeFilter.FILTER_REJECT;
        if (p.closest('[data-no-i18n], [data-i18n-block]')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    let current;
    while ((current = walker.nextNode())) {
      translateTextNode(current, lang);
    }
  }

  function flushPendingMutations() {
    rafScheduled = false;
    if (!pendingNodes.size) return;
    const nodes = Array.from(pendingNodes);
    pendingNodes.clear();

    isApplying = true;
    try {
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        if (n && n.isConnected) {
          walkAndTranslate(n, currentLang);
        }
      }
    } finally {
      isApplying = false;
    }
  }

  function startObserver() {
    if (observer || typeof MutationObserver !== 'function' || !document.body) return;
    observer = new MutationObserver((mutations) => {
      if (isApplying) return;
      for (let i = 0; i < mutations.length; i++) {
        const m = mutations[i];
        if (m.type === 'characterData') {
          pendingNodes.add(m.target);
        } else if (m.type === 'attributes') {
          if (m.target && m.target.nodeType === 1) pendingNodes.add(m.target);
        } else if (m.type === 'childList') {
          for (let j = 0; j < m.addedNodes.length; j++) {
            pendingNodes.add(m.addedNodes[j]);
          }
        }
      }
      if (pendingNodes.size && !rafScheduled) {
        rafScheduled = true;
        requestAnimationFrame(flushPendingMutations);
      }
    });

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ATTRS_TO_TRANSLATE
    });
  }

  function updateLangButtons(lang) {
    document.querySelectorAll('.lang-btn[data-lang]').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
    });
  }

  function setLanguage(lang) {
    const normalized = normalizeLang(lang) || DEFAULT_SITE_LANG;
    currentLang = normalized;

    document.documentElement.lang = normalized;
    if (config.pageTitle && config.pageTitle[normalized]) {
      document.title = config.pageTitle[normalized];
    }

    updateLangButtons(normalized);

    isApplying = true;
    try {
      if (document.body) {
        walkAndTranslate(document.body, normalized);
      }
      if (typeof config.onApply === 'function') {
        config.onApply(normalized);
      }
    } finally {
      isApplying = false;
    }

    try {
      localStorage.setItem('cosmos_lang', normalized);
    } catch (e) {}
  }

  function init(appConfig) {
    if (appConfig) {
      config = {
        pageTitle: appConfig.pageTitle || null,
        exact: {
          ca: (appConfig.exact && appConfig.exact.ca) || {},
          en: (appConfig.exact && appConfig.exact.en) || {}
        },
        patterns: {
          ca: (appConfig.patterns && appConfig.patterns.ca) || [],
          en: (appConfig.patterns && appConfig.patterns.en) || []
        },
        htmlBlocks: appConfig.htmlBlocks || {},
        onApply: appConfig.onApply || null
      };
    }

    const start = () => {
      const initial = detectInitialLang();
      setLanguage(initial);
      startObserver();
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start);
    } else {
      start();
    }
  }

  const api = {
    init,
    setLanguage,
    getLang: () => currentLang,
    getLocale: () => (currentLang === 'ca' ? 'ca-ES' : (currentLang === 'en' ? 'en-GB' : 'es-ES')),
    translate: (str, lang) => translateString(str, lang || currentLang)
  };

  global.CosmosI18n = api;
  global.setLanguage = setLanguage;
})(window);
