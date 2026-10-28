const { test } = require("node:test");
const assert = require("node:assert/strict");
const rules = require("../extension/rules.js");

test("only boolean settings are accepted; missing keys keep defaults", () => {
  assert.deepEqual(rules.settings({ enabled: false, hideLogin: "false", unknown: true }), {
    enabled: false, hideLogin: true, hideApp: true, directPosts: true
  });
  assert.deepEqual(rules.settings(null), rules.DEFAULTS);
});

function candidate(text, { links = [], buttons = [], protectedContent = false, password = false } = {}) {
  return {
    textContent: text, matches() { return false; },
    querySelector(selector) { return selector === 'input[type="password"]' ? (password ? {} : null) : (protectedContent ? {} : null); },
    querySelectorAll(selector) {
      if (selector === 'a[href]') return links.map(href => ({ getAttribute() { return href; }, textContent: '' }));
      return buttons.map(textContent => ({ textContent }));
    }
  };
}

test("button-only English app prompts are recognized without a brand or link", () => {
  const app = candidate("Open app Continue in browser", { buttons: ["Open app", "Continue in browser"] });
  assert.equal(rules.classify(app), "app");
  assert.equal(rules.classify(app, { ...rules.DEFAULTS, hideApp: false }), null);
});

test("app prompt detection preserves content viewers and cookie consent", () => {
  assert.equal(rules.classify(candidate("Open app", { buttons: ["Open app"], protectedContent: true })), null);
  assert.equal(rules.classify(candidate("Allow Instagram cookies? Open app", { buttons: ["Open app"] })), null);
  assert.equal(rules.isAppAction("Open application settings"), false);
  assert.equal(rules.isAppAction("Open the app"), true);
  assert.equal(rules.isAppAction("Открыть приложение"), true);
});

test("authentication, recovery and direct messages are excluded", () => {
  for (const path of ["/accounts/login/", "/accounts/password/reset/", "/accounts/two_factor_authentication/", "/challenge/abc/", "/checkpoint/", "/direct/inbox/", "/oauth/authorize/"]) {
    assert.equal(rules.isAuthPage(path), true, path);
  }
  for (const path of ["/", "/example/", "/p/123/", "/reel/123/", "/accounts_photography/"]) {
    assert.equal(rules.isAuthPage(path), false, path);
  }
});

test("only Instagram auth and app destinations are evidence", () => {
  const examples = [
    ["/accounts/login/?next=%2F", "login"],
    ["https://www.instagram.com/accounts/emailsignup/", "signup"],
    ["https://m.instagram.com/accounts/signup/", "signup"],
    ["instagram://user?username=example", "app"],
    ["intent://instagram.com/#Intent;package=com.instagram.android;end", "app"],
    ["https://play.google.com/store/apps/details?id=com.instagram.android", "app"],
    ["https://apps.apple.com/us/app/instagram/id389801252", "app"],
    ["https://www.instagram.com/download/", "app"],
    ["https://example.org/accounts/login/", null],
    ["https://instagram.com.example.org/accounts/login/", null],
    ["https://play.google.com/store/apps/details?id=com.other.app", null],
    ["https://apps.apple.com/us/app/other/id12345", null],
    ["javascript:alert(1)", null],
    ["/p/123/", null],
  ];
  for (const [href, expected] of examples) assert.equal(rules.linkKind(href), expected, href);
});
