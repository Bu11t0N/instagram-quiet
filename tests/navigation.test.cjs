const { test } = require('node:test');
const assert = require('node:assert/strict');
const rules = require('../extension/rules.js');
const base = 'https://www.instagram.com/example/';

test('post URLs include profile-prefixed posts and reels and preserve carousel queries', () => {
  for (const href of ['/p/Ab_c-1/', '/example.name/p/Ab_c-1/?img_index=3', '/reel/A1/', '/example/reels/A1/']) {
    assert.equal(rules.postTarget(href, base), new URL(href, base).href);
  }
});

test('direct navigation excludes unrelated, external and credential-bearing URLs', () => {
  for (const href of ['/example/', '/accounts/login/', '/p/', '/p/abc/extra', 'https://example.com/p/abc/', '//evil.example/p/abc/', 'javascript:alert(1)', 'http://www.instagram.com/p/abc/', 'https://user@www.instagram.com/p/abc/', 'https://m.instagram.com/p/abc/']) {
    assert.equal(rules.postTarget(href, base), null, href);
  }
});

function anchor(attrs = {}) {
  return { getAttribute(name) { return attrs[name] ?? null; }, hasAttribute(name) { return name in attrs; } };
}

test('modified, cancelled, synthetic, new-tab and download clicks keep native behavior', () => {
  const event = { button: 0, isTrusted: true };
  assert.equal(rules.plainClick(event, anchor()), true);
  assert.equal(rules.plainClick(event, anchor({ target: '_self' })), true);
  for (const patch of [{ button: 1 }, { button: 2 }, { ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { defaultPrevented: true }, { isTrusted: false }]) {
    assert.equal(rules.plainClick({ ...event, ...patch }, anchor()), false);
  }
  for (const attrs of [{ target: '_blank' }, { target: '_parent' }, { target: 'other' }, { download: '' }]) {
    assert.equal(rules.plainClick(event, anchor(attrs)), false);
  }
});

test('intentional login is recognized from the control label or an Instagram auth URL', () => {
  for (const label of ['Log in', 'Sign up', 'Войти', 'Войти через Facebook', 'Se connecter', 'Anmelden']) {
    assert.equal(rules.isLoginAction(label), true, label);
  }
  assert.equal(rules.isLoginAction('', '/accounts/login/?next=%2Fp%2F123'), true);
  assert.equal(rules.isLoginAction('Read more', 'https://example.com/accounts/login/'), false);
  assert.equal(rules.isLoginAction('Close'), false);
  assert.equal(rules.isLoginAction('Open app'), false);
});
