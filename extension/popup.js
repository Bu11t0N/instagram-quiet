(() => {
  "use strict";
  const api = globalThis.browser || globalThis.chrome;
  const rules = globalThis.InstagramQuietRules;
  const status = document.getElementById("status");
  const keys = Object.keys(rules.DEFAULTS);
  let current = { ...rules.DEFAULTS };

  function render() {
    for (const key of keys) document.getElementById(key).checked = current[key];
    for (const key of ["hideLogin", "hideApp", "directPosts"]) document.getElementById(key).disabled = !current.enabled;
    document.getElementById("directPosts").disabled = !current.enabled || !current.hideLogin;
  }

  async function updateStatus() {
    if (!current.enabled) { status.textContent = "Отключено. Скрытые окна восстановлены."; return; }
    try {
      const [tab] = await api.tabs.query({ active: true, currentWindow: true });
      const result = await api.tabs.sendMessage(tab.id, { type: "instagram-quiet:status" });
      status.textContent = result.authPage ? "На этой странице фильтрация приостановлена." : result.loginPreserved ? "Окно входа, открытое вами, сохранено." :
        `Работает на этой вкладке · Скрыто окон: ${result.count}`;
    } catch {
      status.textContent = "Откройте Instagram. Если он уже открыт — обновите страницу.";
    }
  }

  async function init() {
    try {
      current = rules.settings(await api.storage.sync.get(rules.DEFAULTS));
      render();
      await updateStatus();
      for (const key of keys) document.getElementById(key).addEventListener("change", async event => {
        const checked = event.target.checked;
        for (const item of keys) document.getElementById(item).disabled = true;
        try {
          await api.storage.sync.set({ [key]: checked });
          current[key] = checked;
          // Let the content script apply a storage change before reading its count.
          setTimeout(updateStatus, 200);
        } catch {
          status.textContent = "Не удалось сохранить настройку. Попробуйте ещё раз.";
        } finally {
          for (const item of keys) document.getElementById(item).disabled = false;
          render();
        }
      });
    } catch {
      status.textContent = "Хранилище настроек недоступно. Откройте окно заново.";
      for (const key of keys) document.getElementById(key).disabled = true;
    }
  }
  init();
})();
