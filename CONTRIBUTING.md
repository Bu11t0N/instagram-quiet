# Contributing

Bug reports and focused pull requests are welcome.

## Report a problem

Open an [issue](https://github.com/Bu11t0N/instagram-quiet/issues) and include:

- Browser and extension versions, operating system and whether this is a phone or computer.
- Instagram's display language and whether you were logged in.
- The affected page type: profile, post, reel or another view.
- Steps to reproduce, expected behavior and what happened instead.
- Which switches were enabled and whether disabling the extension restores the page.

Screenshots or a minimal HTML reproduction help. Remove account details, messages,
tokens and other personal information. Do not attach cookies, complete browser
profiles or authenticated network captures.

## Develop

Requirements: Node.js 20+, Python 3.9+, and a Chromium browser for integration tests.

```sh
npm install
npm run check
npm test
npm run build
npx playwright install chromium
npm run test:browser
```

`npm test` has no browser dependency. It checks the rules, navigation helpers and
actual content script using a deliberately limited DOM/API model. That model does
not simulate layout, CSS specificity or browser extension loading. Use the separate
browser suite for those concerns. Neither suite establishes compatibility with
every experiment on the live Instagram site.

The experimental browser suite changes settings through Chromium's DevTools API.
It has not completed successfully: both popup and HTTPS-fixture navigation stalled
in the initial CI setup. Popup UI interaction is not covered. The default Actions
job runs syntax/model checks and builds packages; opt into the browser suite using
the manual workflow's `browser_tests` input. Do not describe a green build badge as
a successful browser or live-site test.

For local debugging, load the matching unpacked build from `dist/chrome` or
`dist/firefox`, then reload the extension and the Instagram tab after changes.

## Keep changes focused

- Prefer semantic and structural evidence over generated CSS class names.
- Preserve ordinary post viewers, cookie consent, editors and deliberately opened login forms.
- Make all DOM/style changes reversible and scope them to a detected obstruction.
- Keep native modified-click behavior and stop interception when a related setting is off.
- Do not add telemetry, remote code, broad host access or downloads to solve a display problem.
- Add a regression test for a behavior change and update documentation when settings change.

`scripts/chrome-public-key.txt` contains a **public** key for a stable development
extension ID. It is not a signing credential. No private key belongs in this repo.

Run `npm run build` to regenerate packages. Do not commit `dist/`, local comparison
copies or third-party source snapshots. Do not claim that an unsigned Firefox ZIP
can be installed permanently in ordinary Firefox.
