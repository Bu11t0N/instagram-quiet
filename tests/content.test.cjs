const { test } = require('node:test');
const assert = require('node:assert/strict');
const { environment, Element, login } = require('./dom-model.cjs');
const HIDDEN = 'data-ig-quiet-hidden';

test('unsolicited login is hidden and disabling restores an inline important display', async () => {
  const env = await environment();
  const gate = login(); gate.style.setProperty('display', 'flex', 'important');
  env.body.append(gate); await env.flush();
  assert.equal(gate.getAttribute(HIDDEN), 'login');
  assert.equal(gate.style.display, 'none');
  await env.change({ enabled: false });
  assert.equal(gate.hasAttribute(HIDDEN), false);
  assert.equal(gate.style.display, 'flex');
  assert.equal(gate.style.getPropertyPriority('display'), 'important');
});

test('a login dialog explicitly requested by the user remains visible', async () => {
  const env = await environment();
  const button = new Element('button', {}, 'Log in'); env.main.append(button);
  assert.equal(env.click(button).defaultPrevented, false);
  const gate = login(); env.body.append(gate); await env.flush();
  assert.equal(gate.hasAttribute(HIDDEN), false);
  assert.equal(env.status().loginPreserved, true);
  await env.flush();
  assert.equal(gate.hasAttribute(HIDDEN), false);
  gate.remove(); await env.flush();
  const unsolicited = login(); env.body.append(unsolicited); await env.flush();
  assert.equal(unsolicited.getAttribute(HIDDEN), 'login');
});

test('synthetic login clicks cannot preserve an unsolicited dialog', async () => {
  const env = await environment(); const button = new Element('button', {}, 'Log in'); env.main.append(button);
  env.click(button, { isTrusted: false });
  const gate = login(); env.body.append(gate); await env.flush();
  assert.equal(gate.getAttribute(HIDDEN), 'login');
});

test('a requested login modal remains visible even when it also advertises Open app', async () => {
  const env = await environment(); const button = new Element('button', {}, 'Log in'); env.main.append(button);
  env.click(button);
  const gate = login(); gate.append(new Element('button', {}, 'Open app')); env.body.append(gate);
  await env.flush(); await env.flush();
  assert.equal(gate.hasAttribute(HIDDEN), false);
  assert.equal(env.status().loginPreserved, true);
});

test('direct post navigation stops immediately when its setting or extension is disabled', async () => {
  const env = await environment();
  const loginLink = new Element('a', { href: '/accounts/login/' }, 'Log in');
  const post = new Element('a', { href: '/p/Abc/?img_index=2' }, 'Post'); env.main.append(loginLink, post);
  assert.equal(env.click(post).defaultPrevented, true);
  assert.deepEqual(env.assigned, ['https://www.instagram.com/p/Abc/?img_index=2']);
  await env.change({ directPosts: false }); assert.equal(env.click(post).defaultPrevented, false);
  await env.change({ directPosts: true, hideLogin: false }); assert.equal(env.click(post).defaultPrevented, false);
  await env.change({ hideLogin: true, enabled: false }); assert.equal(env.click(post).defaultPrevented, false);
  assert.equal(env.assigned.length, 1);
});

test('post clicks without logged-out evidence keep the normal site behavior', async () => {
  const env = await environment(); const post = new Element('a', { href: '/p/Abc/' }, 'Post'); env.main.append(post);
  assert.equal(env.click(post).defaultPrevented, false);
  assert.equal(env.assigned.length, 0);
});

test('button-only Open app panel is hidden while normal dialogs survive', async () => {
  const env = await environment();
  const panel = new Element('div'); panel.style.setProperty('position', 'fixed'); panel.append(new Element('button', {}, 'Open app'));
  const share = new Element('div', { role: 'dialog' }, 'Share this post');
  env.body.append(panel, share); await env.flush();
  assert.equal(panel.getAttribute(HIDDEN), 'app');
  assert.equal(share.hasAttribute(HIDDEN), false);
  assert.equal(env.body.hasAttribute('data-ig-quiet-scroll'), false);
});

test('a shell that gains unrelated content is released without revealing the login gate', async () => {
  const env = await environment();
  const shell = new Element('div'); shell.style.setProperty('position', 'fixed');
  const gate = login(); shell.append(gate); env.body.append(shell); await env.flush();
  assert.equal(shell.getAttribute(HIDDEN), 'login');
  const unrelated = new Element('article', {}, 'An actual publication'); shell.append(unrelated); await env.flush();
  assert.equal(shell.hasAttribute(HIDDEN), false);
  assert.equal(gate.getAttribute(HIDDEN), 'login');
  assert.equal(unrelated.closest(`[${HIDDEN}]`), null);
});

test('a marker removed by page code is reapplied', async () => {
  const env = await environment(); const gate = login(); env.body.append(gate); await env.flush();
  gate.removeAttribute(HIDDEN); await env.flush();
  assert.equal(gate.getAttribute(HIDDEN), 'login');
});
