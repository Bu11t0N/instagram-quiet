# Privacy policy

Last updated: October 28, 2026. Applies to Instagram Quiet 1.1.0.

## Data collection

Instagram Quiet does not collect or transmit browsing history, page contents,
messages, passwords, account details or usage analytics. It includes no advertising,
tracking SDKs, external runtime libraries or remote code.

The content script reads the structure, text and destinations already present in
the page to identify login/app interruptions. It does not read password field
values or cookies. It does not make extension-initiated network requests. Optional
direct post navigation causes the browser's ordinary request to the selected
Instagram page.

## Site access

The script runs only on HTTPS pages at `instagram.com`, `www.instagram.com` and
`m.instagram.com`. Filtering and click interception are disabled on `/accounts/`,
`/challenge/`, `/checkpoint/`, `/direct/` and `/oauth/` routes.

## Stored settings

The `storage` permission stores four Boolean switches: whether the extension,
login filter, app filter and direct post navigation are enabled. The browser's own
`storage.sync` service may transfer these switches between signed-in browser
installations when the user enables extension sync. Chrome and Firefox use their
respective services.

Page contents, URLs, login intent and hidden-prompt counters are not written to
extension storage or synced. Temporary state exists only in the current tab's
memory. No data is sent to the extension developer.

## Browser APIs

The popup queries the active tab's ID and exchanges a local status message with
the content script. The extension does not request permission to read browsing
history, cookies, downloads or arbitrary tab URLs.

## Project relationship

Instagram Quiet is independent of Instagram and Meta. This policy describes the
extension; Instagram's website and the browser's own sync service have their own
privacy policies.

Questions and reports: [GitHub issues](https://github.com/Bu11t0N/instagram-quiet/issues).
Do not include private account information, cookies or credentials in public reports.
