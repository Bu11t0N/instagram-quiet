<p align="center">
  <img src="extension/icons/128.png" width="80" height="80" alt="Instagram Quiet logo">
</p>

<h1 align="center">Instagram Quiet</h1>

<p align="center">Browse the Instagram website with fewer login and app interruptions.</p>

<p align="center">
  <a href="https://github.com/Bu11t0N/instagram-quiet/actions/workflows/checks.yml"><img src="https://github.com/Bu11t0N/instagram-quiet/actions/workflows/checks.yml/badge.svg" alt="Checks"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-4ad6be" alt="License: MIT"></a>
  <img src="https://img.shields.io/badge/Manifest-V3-4ad6be" alt="Manifest V3">
</p>

Instagram Quiet is a small, local-only extension for Chrome and Firefox. It hides
unwanted login/sign-up dialogs and “Open app” prompts, removes related dimming
layers, and restores scrolling when a detected prompt has locked the page.

**It only changes the page your browser receives.** It cannot unlock private
profiles, fetch content that requires an account, or bypass server-side login
requirements.

[Features](#features) · [Installation](#installation) · [Settings](#settings) ·
[Privacy](#privacy-and-permissions) · [Development](#development) · [Contributing](CONTRIBUTING.md)

## Features

- **Separate filters** for login/sign-up interruptions and app-opening prompts.
- **Repeated prompt handling** as Instagram adds or replaces elements.
- **Targeted backdrop and scroll cleanup**, including some fixed-body and `inert` locks.
- **Direct post navigation** for logged-out browsing: open a post or reel as a page
  instead of asking Instagram's single-page interface to show it in a login-gated modal.
- **Intentional login protection:** a login dialog requested by clicking a recognized
  login/sign-up control is preserved. Dedicated authentication pages are excluded.
- **Reversible changes:** turning a filter off restores the elements and inline
  display values hidden by that filter.
- **Minimal access:** no background process, analytics, remote code or extension-initiated
  network requests.

Detection uses text, link destinations and structure rather than relying on a
single generated CSS class. English and Russian prompts are the main targets;
some Spanish, French and German phrases are also recognized. Coverage is not
exhaustive, and Instagram's markup experiments can require rule updates.

## Browser support

| Browser | Package target | Installation status |
| --- | --- | --- |
| Chrome on desktop | 102+ | Load the unpacked Chrome build |
| Firefox on desktop | 140+ | Temporary installation; Mozilla signing is needed for permanent installation |
| Firefox on Android | 142+ | Package compatibility is declared; normal distribution needs an Android-compatible AMO listing |
| Chrome on Android | — | Standard Chrome does not support installing extensions |
| Chrome / Firefox on iOS | — | These browsers cannot load this desktop/Android WebExtension |

The minimum versions are manifest targets, not a claim that every listed version
has been tested. See [Testing status](#testing-status) for the actual verification scope.

## Installation

The extension is **not published in Chrome Web Store or Firefox Add-ons (AMO)**.
The Firefox package is unsigned. There is currently no one-click store installation.

You can build locally with Python alone:

```sh
git clone https://github.com/Bu11t0N/instagram-quiet.git
cd instagram-quiet
python3 scripts/build.py
```

No Node dependencies are required to build the extension. Alternatively, download
the repository through **Code → Download ZIP**, extract it, and run the same build
command. Successful GitHub Actions runs also provide an
`instagram-quiet-packages` artifact containing the generated ZIPs; downloading
workflow artifacts may require a GitHub account.

### Chrome on desktop

1. Build the project, or extract `instagram-quiet-chrome.zip` from a generated package.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Choose **Load unpacked**.
4. Select `dist/chrome`, or the extracted folder containing `manifest.json`.
5. Reload any Instagram tabs that were already open.

Keep the loaded folder in place. After updating the files, click **Reload** on
the extension card and reload Instagram. The Chrome build includes a public
development key so unpacked installations use a consistent extension ID.

### Firefox on desktop

1. Build the project, or extract `instagram-quiet-firefox.zip`.
2. Open `about:debugging#/runtime/this-firefox`.
3. Choose **Load Temporary Add-on…**.
4. Select `dist/firefox/manifest.json`, or the extracted Firefox manifest.
5. Reload any Instagram tabs that were already open.

**Temporary add-ons are removed when Firefox restarts.** Permanent installation in
ordinary Firefox requires a Mozilla-signed XPI. The Firefox ZIP is prepared for
submission through the [AMO Developer Hub](https://addons.mozilla.org/developers/),
including unlisted distribution. Renaming an unsigned ZIP to `.xpi` does not
replace signing.

### Firefox on Android

This project declares an Android-compatible Firefox package, but it does not yet
have an AMO listing. The unsigned ZIP is not a normal permanent phone installer.
An Android-compatible AMO publication is the intended distribution route; temporary
development installation requires separate desktop/ADB setup. Real-device testing
is still needed before recommending it for everyday mobile use.

## Settings

Click the extension icon to open its settings. The current popup interface is in
Russian; the controls correspond to the following options:

| Option | Default | Behavior |
| --- | --- | --- |
| Enable extension | On | Enables or disables filtering and direct navigation |
| Hide login prompts | On | Hides recognized unsolicited login/sign-up overlays |
| Hide “Open app” prompts | On | Hides recognized app-opening or installation overlays/panels |
| Open posts directly | On | Uses direct post/reel navigation when logged-out browsing is detected and the login filter is enabled |

Changes apply to already loaded extension tabs without a page refresh. Direct
navigation preserves carousel query parameters and leaves Ctrl/Command/Shift/Alt
clicks, download links and links targeting other windows to the browser.

To identify logged-out browsing, the script looks for a recognized login prompt
or a visible login link outside a content viewer. It does not inspect your cookies
or use an authenticated API. If that evidence is absent, navigation stays unchanged.

Settings use the browser's `storage.sync`. They may sync when browser extension
sync is enabled, but installing the extension is still necessary on each device.
Chrome and Firefox do not share their sync systems. The popup's counter reports
currently hidden prompt containers in the active tab; it is not a lifetime total.

## How it works

1. A content script starts on the supported Instagram hosts.
2. A throttled `MutationObserver` detects DOM changes and finds candidate dialogs
   or floating panels near login/app controls.
3. Rules check text, destinations and structure. Content viewers, editors, search
   fields and recognized cookie-consent dialogs are excluded.
4. Recognized obstructions receive extension-owned markers. Related decorative
   wrappers/backdrops are handled without deleting the page's DOM.
5. Scroll and accessibility locks are relaxed when a prompt has been hidden and
   no other visible dialog needs its modal behavior.

Clicks on recognized login controls create a short intent window. A resulting
login dialog stays protected while it remains open. The extension does not
globally hide every modal, simulate cookie-consent choices, or replace the site's
`scrollTo`, `focus` or other browser functions.

## Privacy and permissions

All page analysis happens inside the current tab. The extension does not collect
history, messages, credentials, account details or usage analytics. It contains
no external runtime libraries, remote code or extension-initiated network requests.
When direct navigation is used, the browser makes the ordinary page request to
the selected Instagram post.

The only named permission is **`storage`**, used for the four switches. Content
scripts run only on:

- `https://instagram.com/*`
- `https://www.instagram.com/*`
- `https://m.instagram.com/*`

There is no `cookies`, `webRequest`, `downloads`, `scripting`, `history` or `tabs`
permission. Settings can be transferred by the browser's own sync service when
enabled. Page contents and prompt counters are not stored or synced.

Read the [privacy policy](PRIVACY.md) for details. Instagram Quiet is an independent
project and is not affiliated with Instagram or Meta.

## Limitations and troubleshooting

- **An empty page after hiding a prompt:** Instagram may not have sent any public
  content. Hiding an overlay cannot load missing or restricted data.
- **A redirect to the login page:** server-side authentication and redirects are
  not bypassed. Dedicated login, recovery, challenge, checkpoint, OAuth and direct
  message routes are excluded from filtering.
- **A prompt remains visible:** a new language, layout or transparent interception
  layer may not match the rules. Internal scroll containers are not universally unlocked.
- **Something useful disappears:** turn off the relevant filter or the whole
  extension, then report a minimal reproduction.
- **Login intent is missed:** protection currently depends on clicking a recognized
  control. Keyboard-only submission, unfamiliar labels or dialogs appearing more
  than 30 seconds later can fall outside that protection.
- **Nothing happens on an existing tab:** reload Instagram after installing or
  reloading the extension.
- **Firefox loses the extension after restart:** this is expected for a temporary,
  unsigned installation.

## Development

Requirements: **Node.js 20+**, **Python 3.9+**, and Chromium for browser integration
tests. There are no runtime dependencies; Playwright is a development dependency.

```sh
npm install
npm run check          # JavaScript syntax checks
npm test              # Rules, navigation and content-script model tests
npm run build         # Chrome, Firefox and source packages
npx playwright install chromium
npm run test:browser  # Load the actual extension in Chromium against local fixtures
```

On Linux, `npx playwright install --with-deps chromium` also installs required
system libraries. Browser tests use `CHROMIUM_PATH` when provided, otherwise
`/usr/bin/chromium` if available or Playwright's full Chromium build.

### Build output

```text
dist/
├── chrome/
├── firefox/
├── instagram-quiet-chrome.zip
├── instagram-quiet-firefox.zip
└── instagram-quiet-source.zip
```

The builder generates the icons, writes browser-specific manifests and packages
only project sources and documentation. A private signing key is not required or
included. `scripts/chrome-public-key.txt` is a public development ID key, not a
Chrome Web Store credential. Store publication may require using the store's key.

### Testing status

The project includes rule tests, click/navigation tests, content-script tests
using a limited DOM/API model, and a separate Chromium suite that loads the real
extension against controlled Instagram-like pages. GitHub Actions runs these
checks and builds installable development packages.

The model tests do not emulate browser layout or CSS. The Chromium fixtures do
not prove compatibility with every variant of the live site. Firefox, Android
and authenticated account flows require separate manual verification. The initial
development environment could not launch Chromium because of system-call
restrictions; the workflow status above reports subsequent CI results.

### Project structure

```text
extension/
  manifest.json        # Shared Manifest V3 source
  rules.js             # Classification and navigation helpers
  content.js           # DOM handling, click handling and restoration
  content.css          # Styles for marked elements
  popup.*              # Settings interface
  icons/               # Generated icons
scripts/
  build.py             # Dependency-free package builder
  chrome-public-key.txt
tests/
  rules.test.cjs
  navigation.test.cjs
  content.test.cjs
  dom-model.cjs
  browser.test.cjs
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, useful bug-report details and
implementation guidelines. Review the [changelog](CHANGELOG.md) for version history.
Please avoid attaching cookies, messages, credentials or full authenticated page captures.

## Related projects

[No Login](https://github.com/MartinBraquet/no-login) and
[Anti Instagram JS](https://github.com/anti-js/anti-instagram-js) address related
problems. Reviewing their approaches informed the direct-navigation feature and
regression cases in this project. The implementation here was written independently;
third-party source snapshots are not shipped with the extension.

## License

[MIT](LICENSE).
