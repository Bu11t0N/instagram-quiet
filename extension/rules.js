(function (root) {
  "use strict";

  const DEFAULTS = Object.freeze({ enabled: true, hideLogin: true, hideApp: true, directPosts: true });
  const CANDIDATES = '[role="dialog"], [role="alertdialog"], [aria-modal="true"], dialog';
  const ANCHORS = 'a[href*="/accounts/login"], a[href*="/accounts/emailsignup"], a[href*="/accounts/signup"], a[href^="instagram:"], a[href^="intent:"], a[href*="apps.apple.com"], a[href*="itunes.apple.com"], a[href*="play.google.com"], a[href*="/download"]';
  const APP_TEXT = /(?:open|use|continue|switch|view|watch|try|download|get)\b.{0,45}\b(?:instagram\s+)?app\b|откр(?:ыть|ойте).{0,35}(?:приложени|instagram|инстаграм)|перей(?:ти|дите).{0,35}приложени|продолж.{0,35}приложени|скача(?:ть|йте).{0,35}(?:instagram|инстаграм|приложени)|использ.{0,35}приложени|abrir.{0,25}(?:app|aplicaci[oó]n)|ouvrir.{0,25}(?:app|application)|in der app [oö]ffnen/iu;
  const LOGIN_TEXT = /log\s?in|sign\s?(?:up|in)|в(?:ойти|ход|ойдите)|зарегистр|регистрац|inicia(?:r)? sesi[oó]n|reg[ií]str|se connecter|inscri[pr]|anmelden|registrieren/iu;
  const GATE_TEXT = /see more|continue (?:viewing|watching|using)|log\s?in to|sign\s?up to|join instagram|don.t miss|больше|продолж|чтобы|войдите в instagram|войдите в инстаграм|зарегистрируйтесь в instagram|присоедин|inicia sesi[oó]n para|connectez.vous pour/iu;
  const CONSENT_TEXT = /(?:allow|accept|reject|manage|optional|essential|decline|use|using|about|your)\b.{0,45}\bcookies?\b|\bcookies?\b.{0,45}\b(?:allow|accept|reject|manage|optional|essential|decline|settings|policy)|файл.{0,12}cookie|настройк.{0,18}cookie|разрешить.{0,18}cookie/iu;
  const APP_ACTION = /^(?:open (?:the )?(?:instagram )?app|use (?:the )?(?:instagram )?app|continue in (?:the )?app|открыть (?:в )?приложени[еи]|перейти в приложение|abrir (?:la )?(?:app|aplicaci[oó]n)|ouvrir l.application|in der app [oö]ffnen)$/iu;

  function isAppAction(label) {
    return APP_ACTION.test((label || "").replace(/\s+/g, " ").trim());
  }

  function isLoginAction(label, href) {
    if (["login", "signup"].includes(linkKind(href || ""))) return true;
    const text = (label || "").replace(/\s+/g, " ").trim();
    return text.length <= 80 && /^(?:log\s?in|sign\s?(?:in|up)|войти|вход|зарегистрироваться|регистрация|iniciar sesi[oó]n|se connecter|anmelden|registrieren)(?:$|\s)/iu.test(text);
  }

  function plainClick(event, anchor) {
    return event.button === 0 && event.isTrusted !== false && !event.defaultPrevented &&
      !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey &&
      (!anchor?.getAttribute("target") || anchor.getAttribute("target").toLowerCase() === "_self") &&
      !anchor?.hasAttribute("download");
  }

  function postTarget(href, base) {
    try {
      const url = new URL(href, base);
      const current = new URL(base);
      if (url.protocol !== "https:" || url.origin !== current.origin ||
          !["instagram.com", "www.instagram.com", "m.instagram.com"].includes(url.hostname) ||
          url.username || url.password) return null;
      if (!/^\/(?:[\w.]+\/)?(?:p|reel|reels)\/[\w-]+\/?$/.test(url.pathname)) return null;
      return url.href;
    } catch { return null; }
  }

  function settings(value) {
    const result = { ...DEFAULTS };
    for (const key of Object.keys(DEFAULTS)) {
      if (typeof value?.[key] === "boolean") result[key] = value[key];
    }
    return result;
  }

  function isAuthPage(pathname) {
    return /^\/(?:accounts|challenge|checkpoint|direct|oauth)(?:\/|$)/i.test(pathname);
  }

  function linkKind(href) {
    try {
      const url = new URL(href, "https://www.instagram.com/");
      if (url.protocol === "instagram:") return "app";
      if (url.protocol === "intent:" && /(?:package=com\.instagram\.android|instagram)/i.test(href)) return "app";
      if (["apps.apple.com", "itunes.apple.com"].includes(url.hostname) && /instagram|id389801252/i.test(url.pathname)) return "app";
      if (url.hostname === "play.google.com" && url.searchParams.get("id") === "com.instagram.android") return "app";
      if (!["instagram.com", "www.instagram.com", "m.instagram.com"].includes(url.hostname)) return null;
      if (/^\/accounts\/login(?:\/|$)/i.test(url.pathname)) return "login";
      if (/^\/accounts\/(?:emailsignup|signup)(?:\/|$)/i.test(url.pathname)) return "signup";
      if (/^\/download(?:\/|$)/i.test(url.pathname)) return "app";
    } catch { /* Invalid links are not a signal. */ }
    return null;
  }

  function classify(element, options = DEFAULTS) {
    const text = (element.textContent || "").replace(/\s+/g, " ").trim();
    if (!text || text.length > 10000 || CONSENT_TEXT.test(text)) return null;
    // Actual post viewers, composers and controls must remain usable.
    if (element.matches("main, article, nav, header, footer") ||
        element.querySelector('main, article, video, textarea, [contenteditable="true"], input[type="search"], [role="menu"]')) return null;

    const kinds = new Set(Array.from(element.querySelectorAll("a[href]"), a => linkKind(a.getAttribute("href"))));
    const password = Boolean(element.querySelector('input[type="password"]'));
    const loginButton = Array.from(element.querySelectorAll('button, [role="button"], input[type="submit"]'))
      .some(button => LOGIN_TEXT.test(button.textContent || button.value || ""));
    const appButton = Array.from(element.querySelectorAll('button, [role="button"], a[href]'))
      .some(button => isAppAction(button.textContent));

    if (options.hideApp && ((APP_TEXT.test(text) && (kinds.has("app") || /instagram|инстаграм|приложени/iu.test(text))) || appButton)) return "app";
    if (options.hideLogin && LOGIN_TEXT.test(text) && (kinds.has("login") || password || loginButton) &&
        (kinds.has("signup") || password || GATE_TEXT.test(text))) return "login";
    return null;
  }

  const api = Object.freeze({ DEFAULTS, CANDIDATES, ANCHORS, settings, isAuthPage, linkKind, classify, isAppAction, isLoginAction, plainClick, postTarget });
  root.InstagramQuietRules = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis);
