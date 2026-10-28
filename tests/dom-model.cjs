// Small, deterministic DOM/API model for running the actual content script.
// Does not emulate a rendering engine; browser layout tests remain separate.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function matches(element, selector) {
  return selector.split(',').some(part => {
    const text = part.trim();
    const tag = text.match(/^[a-z]+/i)?.[0];
    const id = text.match(/#([\w-]+)/)?.[1];
    if ((tag && element.tag !== tag.toLowerCase()) || (id && element.getAttribute('id') !== id)) return false;
    const attrs = [...text.matchAll(/\[([^\s\]=*^]+)(?:([*^]?=)"([^"]*)")?\]/g)];
    return attrs.every(([, name, op, value]) => {
      const actual = element.getAttribute(name);
      if (!op) return actual !== null;
      return actual !== null && (op === '=' ? actual === value : op === '*=' ? actual.includes(value) : actual.startsWith(value));
    });
  });
}

class Style {
  constructor() { this.properties = new Map(); }
  get display() { return this.getPropertyValue('display'); }
  setProperty(name, value, priority = '') { this.properties.set(name, { value, priority }); }
  getPropertyValue(name) { return this.properties.get(name)?.value || ''; }
  getPropertyPriority(name) { return this.properties.get(name)?.priority || ''; }
}

class Element {
  constructor(tag, attrs = {}, text = '') {
    this.tag = tag;
    this.attrs = new Map(Object.entries(attrs));
    this.ownText = text;
    this.children = [];
    this.parentElement = null;
    this.style = new Style();
    this.nodeType = 1;
    this.connectedRoot = false;
  }
  get textContent() { return this.ownText + this.children.map(child => child.textContent).join(' '); }
  get childNodes() { return this.children; }
  get isConnected() { return this.connectedRoot || Boolean(this.parentElement?.isConnected); }
  get open() { return this.hasAttribute('open'); }
  append(...children) { for (const child of children) { child.remove(); child.parentElement = this; this.children.push(child); } return this; }
  remove() {
    if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(child => child !== this);
    this.parentElement = null;
  }
  getAttribute(name) { return this.attrs.get(name) ?? null; }
  hasAttribute(name) { return this.attrs.has(name); }
  setAttribute(name, value) { this.attrs.set(name, String(value)); }
  removeAttribute(name) { this.attrs.delete(name); }
  toggleAttribute(name, force) { if (force) this.setAttribute(name, ''); else this.removeAttribute(name); }
  matches(selector) { return matches(this, selector); }
  closest(selector) { for (let node = this; node; node = node.parentElement) if (node.matches(selector)) return node; return null; }
  contains(other) { for (let node = other; node; node = node.parentElement) if (node === this) return true; return false; }
  querySelectorAll(selector) {
    return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  getClientRects() {
    for (let node = this; node; node = node.parentElement) if (computed(node).display === 'none') return [];
    return this.isConnected ? [this.getBoundingClientRect()] : [];
  }
  getBoundingClientRect() { return { width: 1280, height: 720, top: 0, left: 0 }; }
}

function computed(element) {
  const result = { display: 'block', visibility: 'visible', position: 'static', zIndex: 'auto', backgroundColor: 'rgba(0, 0, 0, 0)', backdropFilter: 'none', top: 'auto' };
  for (const [name, property] of element.style.properties) result[name] = property.value;
  if (element.hasAttribute('data-ig-quiet-hidden') && element.style.getPropertyPriority('display') !== 'important') result.display = 'none';
  if (element.hasAttribute('data-ig-quiet-fixed')) result.position = 'static';
  return result;
}

async function environment(settings = {}) {
  const html = new Element('html'); html.connectedRoot = true;
  const body = new Element('body'); const main = new Element('main'); html.append(body); body.append(main);
  const tasks = [];
  const events = {};
  const assigned = [];
  let changed;
  let message;
  let observed;
  const location = { href: 'https://www.instagram.com/example/', pathname: '/example/', assign(url) { assigned.push(url); } };
  const document = {
    documentElement: html, body,
    querySelectorAll(selector) { return html.querySelectorAll(selector); },
    addEventListener(type, handler) { events[type] = handler; }
  };
  const context = vm.createContext({
    document, location, URL, innerWidth: 1280, innerHeight: 720, scrollY: 0,
    getComputedStyle: computed,
    window: { scrollTo() {} }, addEventListener() {},
    setTimeout(fn) { tasks.push(fn); }, setInterval() {},
    MutationObserver: class { constructor(callback) { observed = callback; } observe() {} },
    chrome: {
      storage: {
        sync: { get(defaults) { return Promise.resolve({ ...defaults, ...settings }); } },
        onChanged: { addListener(handler) { changed = handler; } }
      },
      runtime: { onMessage: { addListener(handler) { message = handler; } } }
    }
  });
  for (const file of ['rules.js', 'content.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../extension', file), 'utf8'), context);
  async function flush() {
    for (let i = 0; i < 5; i++) await Promise.resolve();
    observed();
    for (let i = 0; tasks.length && i < 30; i++) tasks.shift()();
    if (tasks.length) throw new Error('Unbounded scheduled work');
  }
  function click(target, patch = {}) {
    const event = { target, button: 0, isTrusted: true, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, stopImmediatePropagation() { this.stopped = true; }, ...patch };
    events.click(event);
    return event;
  }
  async function change(values) {
    changed(Object.fromEntries(Object.entries(values).map(([key, newValue]) => [key, { newValue }])), 'sync');
    await flush();
  }
  function status() { let response; message({ type: 'instagram-quiet:status' }, {}, value => { response = value; }); return response; }
  await flush();
  return { html, body, main, assigned, location, flush, click, change, status };
}

function login() {
  const root = new Element('div', { role: 'dialog' }, 'Log in to continue using Instagram');
  root.style.setProperty('position', 'fixed');
  root.append(new Element('a', { href: '/accounts/login/' }, 'Log in'), new Element('a', { href: '/accounts/emailsignup/' }, 'Sign up'));
  return root;
}

module.exports = { environment, Element, login };
