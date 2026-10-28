(() => {
  "use strict";
  const api = globalThis.browser || globalThis.chrome;
  const rules = globalThis.InstagramQuietRules;
  const HIDDEN = "data-ig-quiet-hidden";
  const suppressed = new Map();
  const backdrops = new Set();
  const accessibility = new Map();
  const inlineDisplays = new Map();
  const preservedLogins = new Set();
  let options = { ...rules.DEFAULTS };
  let loaded = false;
  let scheduled = false;
  let fixedScroll = null;
  let previousPath = location.pathname;
  let loginIntentUntil = 0;

  function hideElement(element, kind) {
    if (element.getAttribute(HIDDEN) !== kind) element.setAttribute(HIDDEN, kind);
    // Inline !important beats an author stylesheet. Override only this property
    // and keep the site's most recent value so disabling remains reversible.
    if (element.style.getPropertyPriority("display") === "important" && element.style.display !== "none") {
      inlineDisplays.set(element, element.style.display);
      element.style.setProperty("display", "none", "important");
    }
  }

  function showElement(element) {
    element.removeAttribute(HIDDEN);
    if (inlineDisplays.has(element)) {
      if (element.style.display === "none" && element.style.getPropertyPriority("display") === "important") {
        element.style.setProperty("display", inlineDisplays.get(element), "important");
      }
      inlineDisplays.delete(element);
    }
  }

  function preserved(candidate) {
    return Array.from(preservedLogins).some(root => root.contains(candidate) || candidate.contains(root));
  }

  function loggedOut() {
    if (Array.from(suppressed.values()).some(item => item.kind === "login")) return true;
    return Array.from(document.querySelectorAll('a[href*="/accounts/login"]')).some(anchor =>
      rules.linkKind(anchor.getAttribute("href")) === "login" &&
      !anchor.closest('article, [role="dialog"], [aria-modal="true"]') && visible(anchor));
  }

  function onClick(event) {
    if (!loaded || !options.enabled || rules.isAuthPage(location.pathname) || event.isTrusted === false) return;
    const control = event.target?.closest?.('a[href], button, [role="button"], input[type="submit"]');
    if (!control || !rules.plainClick(event, control)) return;
    if (rules.isLoginAction(control.textContent || control.value || control.getAttribute("aria-label"), control.getAttribute("href"))) {
      loginIntentUntil = Date.now() + 30000;
      schedule();
      return;
    }
    if (!options.directPosts || !options.hideLogin || !control.matches("a[href]") || preservedLogins.size || !loggedOut()) return;
    const target = rules.postTarget(control.getAttribute("href"), location.href);
    if (!target || target === location.href) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    location.assign(target);
  }

  function visible(element) {
    if (!element.isConnected || element.closest(`[${HIDDEN}]`)) return false;
    const style = getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden" && element.getClientRects().length > 0;
  }

  function floating(element) {
    const style = getComputedStyle(element);
    return style.position === "fixed" || style.position === "sticky" ||
      (style.position === "absolute" && style.zIndex !== "auto");
  }

  function decorative(element) {
    return !(element.textContent || "").trim() &&
      !element.matches('main, article, nav, header, footer, img, video, canvas, iframe, button, a, input') &&
      !element.querySelector('main, article, nav, header, footer, img, video, canvas, iframe, button, a, input, [role="dialog"]');
  }

  function shellFor(candidate) {
    let shell = candidate;
    let child = candidate;
    for (let depth = 0; depth < 7; depth++) {
      const parent = child.parentElement;
      if (!parent || parent === document.body || parent === document.documentElement ||
          parent.matches('main, article, nav, header, footer, #react-root, #root')) break;
      // Never absorb siblings with page content or interactive controls.
      if (Array.from(parent.children).some(sibling => sibling !== child && !decorative(sibling))) break;
      if (Array.from(parent.childNodes).some(node => node.nodeType === 3 && node.textContent.trim())) break;
      if (floating(parent)) shell = parent;
      child = parent;
    }
    return shell;
  }

  function backdropFor(element) {
    if (!decorative(element)) return false;
    const style = getComputedStyle(element);
    if (!["fixed", "absolute"].includes(style.position)) return false;
    if (backdrops.has(element) && element.hasAttribute(HIDDEN)) return true;
    const rect = element.getBoundingClientRect();
    if (rect.width < innerWidth * 0.7 || rect.height < innerHeight * 0.7) return false;
    const color = style.backgroundColor;
    return (color !== "transparent" && color !== "rgba(0, 0, 0, 0)") ||
      (style.backdropFilter && style.backdropFilter !== "none");
  }

  function findCandidates() {
    const result = new Set(document.querySelectorAll(rules.CANDIDATES));
    for (const anchor of document.querySelectorAll(rules.ANCHORS)) {
      let parent = anchor.parentElement;
      for (let depth = 0; parent && parent !== document.body && depth < 7; depth++, parent = parent.parentElement) {
        if (parent.matches('main, article, nav, header, footer, #react-root, #root')) break;
        if (floating(parent)) result.add(parent);
      }
    }
    // Some mobile prompts use buttons without deep links or ARIA dialog roles.
    for (const button of document.querySelectorAll('button, [role="button"]')) {
      if (!rules.isAppAction(button.textContent)) continue;
      let parent = button.parentElement;
      for (let depth = 0; parent && parent !== document.body && depth < 5; depth++, parent = parent.parentElement) {
        if (parent.matches('main, article, nav, header, footer')) break;
        if (floating(parent)) result.add(parent);
      }
    }
    return result;
  }

  function restoreAccessibility(restoreOriginal) {
    for (const [element, attrs] of accessibility) {
      if (!restoreOriginal || !element.isConnected) continue;
      for (const [name, value] of attrs) if (!element.hasAttribute(name)) element.setAttribute(name, value);
    }
    accessibility.clear();
  }

  function setUnlocked(unlock, restoreOriginal) {
    for (const element of [document.documentElement, document.body]) {
      if (!element) continue;
      element.toggleAttribute("data-ig-quiet-scroll", unlock);
    }
    const body = document.body;
    if (unlock && body && !body.hasAttribute("data-ig-quiet-fixed") && getComputedStyle(body).position === "fixed") {
      const top = parseFloat(getComputedStyle(body).top);
      fixedScroll = Number.isFinite(top) && top < 0 ? -top : scrollY;
      body.setAttribute("data-ig-quiet-fixed", "");
      window.scrollTo(0, fixedScroll);
    } else if (!unlock && body?.hasAttribute("data-ig-quiet-fixed")) {
      body.removeAttribute("data-ig-quiet-fixed");
      fixedScroll = null;
    }

    if (!unlock) {
      restoreAccessibility(restoreOriginal);
      return;
    }
    for (const element of document.querySelectorAll('[inert], main[aria-hidden="true"], #react-root[aria-hidden="true"], #root[aria-hidden="true"]')) {
      if (element.closest(`[${HIDDEN}]`)) continue;
      const attrs = accessibility.get(element) || new Map();
      for (const name of ["inert", "aria-hidden"]) {
        if (element.hasAttribute(name)) {
          if (!attrs.has(name)) attrs.set(name, element.getAttribute(name));
          element.removeAttribute(name);
        }
      }
      accessibility.set(element, attrs);
    }
  }

  function scan() {
    scheduled = false;
    if (!loaded || !document.body) return;
    previousPath = location.pathname;
    const active = options.enabled && !rules.isAuthPage(previousPath);
    for (const root of preservedLogins) {
      if (!visible(root) || rules.classify(root, { ...options, hideLogin: true, hideApp: false }) !== "login") preservedLogins.delete(root);
    }
    for (const [shell, item] of suppressed) {
      if (!active || !shell.isConnected || !item.candidate.isConnected || !shell.contains(item.candidate) ||
          shellFor(item.candidate) !== shell || rules.classify(item.candidate, options) !== item.kind) {
        showElement(shell);
        suppressed.delete(shell);
      } else {
        hideElement(shell, item.kind);
      }
    }

    if (active) {
      for (const candidate of findCandidates()) {
        if (!visible(candidate)) continue;
        const kind = rules.classify(candidate, options);
        if (!kind) continue;
        const loginCandidate = rules.classify(candidate, { ...options, hideLogin: true, hideApp: false }) === "login";
        if (loginCandidate && preserved(candidate)) continue;
        if (loginCandidate && Date.now() < loginIntentUntil) {
          preservedLogins.add(candidate);
          loginIntentUntil = 0;
          continue;
        }
        const shell = shellFor(candidate);
        hideElement(shell, kind);
        suppressed.set(shell, { candidate, kind });
      }
    }

    const otherModal = Array.from(document.querySelectorAll(rules.CANDIDATES))
      .some(element => visible(element) && !(element.matches("dialog") && !element.open));
    const unlock = suppressed.size > 0 && !otherModal;
    const wantedBackdrops = new Set();
    if (unlock) {
      for (const shell of suppressed.keys()) {
        let child = shell;
        for (let depth = 0; child?.parentElement && depth < 7; depth++, child = child.parentElement) {
          for (const sibling of child.parentElement.children) {
            if (sibling !== child && !suppressed.has(sibling) && backdropFor(sibling)) wantedBackdrops.add(sibling);
          }
          if (child.parentElement === document.body) break;
        }
      }
    }
    for (const element of backdrops) {
      if (!wantedBackdrops.has(element)) {
        showElement(element);
        backdrops.delete(element);
      }
    }
    for (const element of wantedBackdrops) {
      hideElement(element, "backdrop");
      backdrops.add(element);
    }
    // Do not resurrect an obsolete inert lock after the site removed a gate.
    setUnlocked(unlock, !active || otherModal);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    // Throttle mutation bursts; background tabs still get a timeout callback.
    setTimeout(scan, 80);
  }

  const observer = new MutationObserver(schedule);
  observer.observe(document, {
    subtree: true, childList: true, characterData: true, attributes: true,
    attributeFilter: ["role", "aria-modal", "class", "style", "href", "inert", "aria-hidden", "open", HIDDEN]
  });
  api.storage.sync.get(rules.DEFAULTS).then(value => {
    options = rules.settings(value);
  }).catch(() => {
    // Defaults also work while browser sync storage is temporarily unavailable.
  }).finally(() => { loaded = true; schedule(); });

  api.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    const next = { ...options };
    for (const key of Object.keys(rules.DEFAULTS)) {
      if (changes[key]) next[key] = changes[key].newValue ?? rules.DEFAULTS[key];
    }
    options = rules.settings(next);
    schedule();
  });
  api.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "instagram-quiet:status") return;
    sendResponse({ count: suppressed.size, authPage: rules.isAuthPage(location.pathname), enabled: options.enabled, loginPreserved: preservedLogins.size > 0 });
  });
  addEventListener("pageshow", schedule);
  addEventListener("popstate", schedule);
  addEventListener("resize", schedule);
  document.addEventListener("click", onClick, true);
  // pushState in the page's JS world is not intercepted by an isolated script.
  setInterval(() => { if (location.pathname !== previousPath) schedule(); }, 1000);
})();
