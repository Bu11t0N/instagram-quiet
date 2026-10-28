# Changelog

## 1.1.0 — 2026-10-28

### Added

- Optional direct navigation to posts and reels when the page shows evidence of logged-out browsing.
- Preservation of login dialogs explicitly requested by a trusted user click.
- Detection of button-only “Open app” prompts without an Instagram label or deep link.
- A public Chrome development key for a consistent unpacked extension ID.
- Automated checks for classification, navigation and content-script state transitions.
- Chromium extension integration tests and a GitHub Actions workflow.
- English project documentation and contribution guidelines.

### Fixed

- Restore inline `display: … !important` values when a hidden element is released.
- Release hidden wrapper containers when they gain unrelated page content.
- Reapply extension markers if page code removes them.
- Preserve modified clicks, link targets, download links and carousel query parameters during direct navigation.
- Stop navigation interception immediately when the extension, login filter or direct-navigation option is disabled.

## 1.0.0 — 2026-10-28

- Initial Chrome and Firefox Manifest V3 packages.
- Separate login/sign-up and app-prompt filters.
- Detection of related modal wrappers and backdrops.
- Conditional scroll unlocking and restoration of page accessibility attributes.
- Local processing without analytics, remote code or extension-initiated network requests.
