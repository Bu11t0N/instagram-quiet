const { test, before, after, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { chromium } = require("playwright");

const extension = path.resolve(__dirname, "../dist/chrome");
const manifest = JSON.parse(fs.readFileSync(path.join(extension, 'manifest.json'), 'utf8'));
const extensionId = crypto.createHash("sha256").update(manifest.key ? Buffer.from(manifest.key, 'base64') : extension).digest("hex").slice(0, 32)
  .replace(/[0-9a-f]/g, char => String.fromCharCode(97 + parseInt(char, 16)));
const login = '<h2>See more from example</h2><p>Log in to continue viewing Instagram.</p><a href="/accounts/login/">Log in</a><a href="/accounts/emailsignup/">Sign up</a>';
const loginRu = '<h2>Войдите в Instagram</h2><p>Войдите, чтобы увидеть больше публикаций.</p><a href="/accounts/login/">Войти</a><a href="/accounts/emailsignup/">Зарегистрироваться</a>';
const app = '<h2>Open Instagram in the app</h2><a href="https://play.google.com/store/apps/details?id=com.instagram.android">Open app</a>';
let context;
let profile;
let settingsPage;
let page;
let errors;
const serveFixture = route => route.fulfill({
  contentType: "text/html",
  body: '<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0}main{min-height:3000px}.modal{position:fixed;inset:20% 15%;z-index:20;background:white}.shade{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:19}.panel{position:fixed;bottom:0;left:0;right:0;z-index:30;background:white}</style></head><body><main id="content"><h1>Public profile</h1><p>A visible publication.</p></main></body></html>'
});

before(async () => {
  profile = fs.mkdtempSync(path.join(os.tmpdir(), "instagram-quiet-test-"));
  const executablePath = process.env.CHROMIUM_PATH || (fs.existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);
  context = await chromium.launchPersistentContext(profile, {
    executablePath,
    channel: executablePath ? undefined : 'chromium',
    headless: process.env.HEADED !== '1',
    ignoreDefaultArgs: ['--disable-extensions'],
    args: ["--no-sandbox", "--disable-crashpad-for-testing", "--enable-unsafe-extension-debugging"],
  });
  const cdp = await context.browser().newBrowserCDPSession();
  const installed = await cdp.send('Extensions.loadUnpacked', { path: extension, enableInIncognito: true });
  assert.equal(installed.id, extensionId, 'Chrome development key must determine the extension ID');
  console.info(`Loaded Instagram Quiet ${manifest.version} in ${context.browser().version()} (${installed.id})`);
  console.info('Installed extensions:', JSON.stringify(await cdp.send('Extensions.getExtensions')));
  const nextPage = context.waitForEvent('page');
  await cdp.send('Target.createTarget', { url: `chrome-extension://${extensionId}/popup.html` });
  settingsPage = await nextPage;
  await cdp.detach();
  context.setDefaultTimeout(5000);
  settingsPage.on('pageerror', error => console.error('Popup script error:', error.message));
  settingsPage.on('requestfailed', request => console.error('Popup request failed:', request.url(), request.failure()?.errorText));
  await settingsPage.waitForFunction(() => {
    const status = document.getElementById('status');
    return status && status.textContent !== 'Проверяем текущую вкладку…';
  });
  console.info('Popup initialized:', await settingsPage.title());
  // This also verifies that Chromium really loaded the packaged extension.
  assert.equal(await settingsPage.title(), "Instagram Quiet");
});

after(async () => {
  await context?.close();
  if (profile) fs.rmSync(profile, { recursive: true, force: true });
});

beforeEach(async () => {
  await settingsPage.evaluate(() => chrome.storage.sync.clear());
  page = await context.newPage();
  // Scope fixture routes to the site tab, leaving extension popup requests alone.
  await page.route("https://www.instagram.com/**", serveFixture);
  errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("https://www.instagram.com/example/");
});

afterEach(async () => {
  assert.deepEqual(errors, []);
  await page?.close();
});

async function add(html) {
  await page.evaluate(html => document.body.insertAdjacentHTML("beforeend", html), html);
}

async function hidden(selector) {
  await page.waitForFunction(selector => getComputedStyle(document.querySelector(selector)).display === "none", selector);
}

async function shown(selector) {
  await page.waitForFunction(selector => {
    const element = document.querySelector(selector);
    return getComputedStyle(element).display !== "none" && element.getClientRects().length > 0;
  }, selector);
}

async function change(value) {
  await settingsPage.evaluate(value => chrome.storage.sync.set(value), value);
}

test("real extension hides a dynamic login dialog and restores scrolling", async () => {
  await page.evaluate(() => { document.body.style.overflow = "hidden"; document.documentElement.style.overflow = "hidden"; });
  await add(`<div id="login" class="modal" role="dialog">${login}</div>`);
  await hidden("#login");
  assert.equal(await page.$eval("body", el => getComputedStyle(el).overflowY), "auto");
  assert.equal(await page.$eval("main", el => getComputedStyle(el).display), "block");
  await page.evaluate(() => window.scrollTo(0, 600));
  assert.ok(await page.evaluate(() => scrollY) >= 590);
});

test("Russian and repeated prompts are handled after DOM replacement", async () => {
  await add(`<div id="first" role="dialog" class="modal">${loginRu}</div>`);
  await hidden("#first");
  await page.$eval("#first", el => el.remove());
  await add(`<div id="second" role="dialog" class="modal">${loginRu}</div>`);
  await hidden("#second");
  await shown("main");
});

test("app banner without ARIA role is hidden, ordinary app links remain", async () => {
  await add(`<div id="banner" class="panel">${app}</div><p id="normal">${app}</p>`);
  await hidden("#banner");
  await shown("#normal");
});

test("mobile button-only app prompt is recognized", async () => {
  await add('<div id="banner" class="panel"><p>Откройте Instagram в приложении</p><button>Открыть приложение</button></div>');
  await hidden("#banner");
});

test("standalone backdrop stays hidden across unrelated page mutations", async () => {
  await add(`<div id="shade" class="shade"></div><div id="login" role="dialog" class="modal">${login}</div>`);
  await hidden("#login");
  await hidden("#shade");
  await page.$eval("main", el => el.insertAdjacentHTML("beforeend", "<p>New content</p>"));
  await page.waitForTimeout(250);
  await hidden("#shade");
  await change({ enabled: false });
  await shown("#login");
  await shown("#shade");
});

test("modal shell with decorative siblings is hidden as a unit", async () => {
  await add(`<div id="shell" class="shade"><div id="login" role="dialog" class="modal">${login}</div><div></div></div>`);
  await hidden("#shell");
  await shown("main");
});

test("filters operate independently and disabling restores original elements", async () => {
  await page.$eval("body", el => el.style.overflow = "hidden");
  await add(`<div id="login" role="dialog" class="modal">${login}</div><div id="app" role="dialog" class="modal">${app}</div>`);
  await hidden("#login");
  await hidden("#app");
  await change({ hideLogin: false });
  await shown("#login");
  await hidden("#app");
  assert.equal(await page.$eval("body", el => getComputedStyle(el).overflowY), "hidden");
  await change({ enabled: false });
  await shown("#app");
  assert.equal(await page.locator("[data-ig-quiet-hidden]").count(), 0);
  await change({ enabled: true, hideLogin: true });
  await hidden("#login");
  await hidden("#app");
});

test("cookie, post, comment and share dialogs remain intact", async () => {
  await add(`<div id="cookies" role="dialog" class="modal"><h2>Allow the use of cookies from Instagram?</h2><button>Allow all cookies</button><a href="/accounts/login/">Log in</a><a href="/accounts/emailsignup/">Sign up</a></div>
    <div id="post" role="dialog" class="modal"><article>A post</article>${login}</div>
    <div id="comment" role="dialog" class="modal"><textarea placeholder="Comment"></textarea>${login}</div>
    <div id="share" role="dialog" class="modal"><h2>Share to…</h2><button>Copy link</button></div>`);
  await page.waitForTimeout(250);
  for (const selector of ["#cookies", "#post", "#comment", "#share"]) await shown(selector);
  assert.equal(await page.locator("[data-ig-quiet-hidden]").count(), 0);
});

test("another genuine modal retains backdrop and its scroll lock", async () => {
  await page.$eval("body", el => el.style.overflow = "hidden");
  await add(`<div id="shade" class="shade"></div><div id="login" role="dialog" class="modal">${login}</div><div id="share" role="dialog" class="modal"><h2>Share</h2><button>Copy link</button></div>`);
  await hidden("#login");
  await shown("#share");
  await shown("#shade");
  assert.equal(await page.$eval("body", el => getComputedStyle(el).overflowY), "hidden");
  await page.$eval("#share", el => el.remove());
  await hidden("#shade");
  assert.equal(await page.$eval("body", el => getComputedStyle(el).overflowY), "auto");
});

test("intentional login page is untouched, including SPA route changes", async () => {
  await add(`<div id="login" role="dialog" class="modal">${login}</div>`);
  await hidden("#login");
  await page.evaluate(() => history.pushState({}, "", "/accounts/login/"));
  await shown("#login");
  await page.evaluate(() => history.pushState({}, "", "/example/"));
  await hidden("#login");
});

test("a hidden container reused for ordinary content is restored", async () => {
  await add(`<div id="login" role="dialog" class="modal">${login}</div>`);
  await hidden("#login");
  await page.$eval("#login", el => el.innerHTML = '<h2>Share</h2><button>Copy link</button>');
  await shown("#login");
});

test("fixed body and inert page content are unlocked reversibly", async () => {
  await page.evaluate(() => {
    document.body.style.cssText = "position:fixed;top:-400px;overflow:hidden;width:100%";
    document.querySelector("main").setAttribute("inert", "");
    document.querySelector("main").setAttribute("aria-hidden", "true");
  });
  await add(`<div id="login" role="dialog" class="modal">${login}</div>`);
  await hidden("#login");
  assert.equal(await page.$eval("body", el => getComputedStyle(el).position), "static");
  assert.equal(await page.$eval("main", el => el.hasAttribute("inert")), false);
  assert.ok(await page.evaluate(() => scrollY) >= 390);
  await change({ enabled: false });
  await shown("#login");
  assert.equal(await page.$eval("body", el => getComputedStyle(el).position), "fixed");
  assert.equal(await page.$eval("main", el => el.hasAttribute("inert")), true);
});

test("popup saves changes and communicates with a matching active tab", async () => {
  await add(`<div id="login" role="dialog" class="modal">${login}</div>`);
  await hidden("#login");
  await settingsPage.reload();
  await settingsPage.locator("#hideLogin").uncheck();
  await shown("#login");
  assert.equal(await settingsPage.evaluate(async () => (await chrome.storage.sync.get("hideLogin")).hideLogin), false);
  await settingsPage.locator("#enabled").uncheck();
  await settingsPage.waitForFunction(() => document.getElementById("hideLogin").disabled);
  assert.equal(await settingsPage.locator("#hideApp").isDisabled(), true);
});

test('button-only English app prompts without a brand name are hidden', async () => {
  await add('<div id="app" role="dialog" class="modal"><button>Open app</button><button>Continue in browser</button></div>');
  await hidden('#app');
});

test('an explicit login click preserves the resulting modal across mutations', async () => {
  await add('<button id="request-login">Log in</button>');
  await page.click('#request-login');
  await add(`<div id="requested" role="dialog" class="modal">${login}<button>Open app</button></div>`);
  await page.waitForTimeout(200);
  await shown('#requested');
  await page.$eval('main', el => el.insertAdjacentHTML('beforeend', '<p>Page update</p>'));
  await page.waitForTimeout(200);
  await shown('#requested');
  await page.$eval('#requested', el => el.remove());
  await add(`<div id="unsolicited" role="dialog" class="modal">${login}</div>`);
  await hidden('#unsolicited');
});

test('inline important display values are restored when the extension is disabled', async () => {
  await add(`<div id="login" role="dialog" class="modal" style="display:flex!important">${login}</div>`);
  await hidden('#login');
  await change({ enabled: false });
  await shown('#login');
  assert.equal(await page.$eval('#login', el => el.style.display), 'flex');
  assert.equal(await page.$eval('#login', el => el.style.getPropertyPriority('display')), 'important');
});

test('an explicit login click restores an existing hidden dialog', async () => {
  await add(`<button id="request-login">Log in</button><div id="login" role="dialog" class="modal">${login}</div>`);
  await hidden('#login');
  await page.click('#request-login');
  await shown('#login');
});

test('post navigation preserves carousel query and stops when its filter is disabled', async () => {
  await add('<a id="login-link" href="/accounts/login/">Log in</a><a id="post-link" href="/p/Example/?img_index=2">Open post</a>');
  await page.evaluate(() => document.querySelector('#post-link').addEventListener('click', event => {
    event.preventDefault(); document.body.dataset.nativeHandler = 'called';
  }));
  await Promise.all([
    page.waitForURL('https://www.instagram.com/p/Example/?img_index=2'),
    page.click('#post-link')
  ]);
  await page.goto('https://www.instagram.com/example/');
  await change({ directPosts: false });
  await add('<a id="login-link" href="/accounts/login/">Log in</a><a id="post-link" href="/p/Example/">Open post</a>');
  await page.evaluate(() => document.querySelector('#post-link').addEventListener('click', event => {
    event.preventDefault(); document.body.dataset.nativeHandler = 'called';
  }));
  await page.click('#post-link');
  assert.equal(await page.$eval('body', el => el.dataset.nativeHandler), 'called');
  assert.equal(new URL(page.url()).pathname, '/example/');
});
