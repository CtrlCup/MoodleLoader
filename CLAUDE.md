# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

MoodleLoader is a cross-browser extension (Chrome/Firefox/Safari) built with [WXT](https://wxt.dev) that downloads
entire Moodle courses (files, folders, assignment attachments, external cloud share links) with one click, into a
structured local folder tree under the browser's Downloads directory.

## Commands

- `npm install` — install dependencies (also runs `wxt prepare` via postinstall)
- `npm run dev` / `npm run dev:firefox` — start the dev server with hot reload
- `npm run compile` — TypeScript type-check only (`tsc --noEmit`)
- `npm run build` — production build for Chrome (`.output/chrome-mv3`)
- `npm run build:firefox` — production build for Firefox (`.output/firefox-mv2`)
- `npm run build:safari` — production build for Safari (`.output/safari-mv3`, still needs `safari-web-extension-converter` + Xcode on macOS to become an installable app)
- `npm run zip` / `npm run zip:firefox` / `npm run zip:safari` — zipped builds for distribution

There is no test suite yet.

## Architecture

- `entrypoints/content.ts` — runs on every page (`matches: ["*://*/*"]"`), cheaply detects whether the page is a
  Moodle instance (`lib/moodle-scraper.ts#isMoodleSite`), and responds to `moodleloader:detect` / `moodleloader:scan`
  messages from the popup/background.
- `entrypoints/background.ts` — receives `moodleloader:download-batch` requests and runs `lib/download-manager.ts#runBatchDownload`,
  which orchestrates scanning + downloading one or more courses sequentially. This intentionally lives in the
  background (not the popup), since popups are destroyed by the browser as soon as they lose focus — the background
  script is what keeps a multi-course download running and its progress persisted (`browser.storage.local`) across
  popup open/close cycles.
- `entrypoints/popup/` and `entrypoints/options/` — vanilla TS/HTML/CSS UI (no framework), theming via CSS variables
  in `lib/theme.css` with light/dark/system modes.
- `lib/moodle-scraper.ts` — the actual Moodle DOM/HTML scraping logic (course/activity detection, section names,
  pluginfile.php resolution, external URL redirect handling, course-format-tiles lazy-section expansion). This is
  the most fragile/version-sensitive part of the codebase; see inline comments for the reasoning behind each
  heuristic before changing selectors.
- `lib/download-manager.ts` — conflict resolution (`replace` / `copy` with `(01)`-style suffixes / `skip`), using
  `browser.downloads.search()` against the browser's own download history as the only available "does this file
  already exist" signal (extensions cannot stat the filesystem directly).
- `lib/path-utils.ts`, `lib/cloud-links.ts`, `lib/settings.ts`, `lib/types.ts` — small, single-purpose helpers/shared types.

## Known, inherent limitations (not bugs — do not "fix" without re-reading this)

- Browser extensions can only write inside the browser's default Downloads directory (relative sub-paths only);
  there is no API for an arbitrary absolute filesystem path.
- Some Moodle course formats (e.g. `format_tiles`) load a section's activities via AJAX only once a real (trusted)
  click occurs; a content script's synthetic `.click()` *can* trigger the same AJAX (it is not blocked by
  `isTrusted`), but there is no way to know in advance how long that AJAX call will take, so very slow Moodle
  instances may still miss some tiles within the scan's wait budget.
- A `mod_url` activity that immediately 302-redirects to a cross-origin destination without CORS headers cannot
  have its final target URL read from a content script (`fetch()` throws) — this is deliberate browser security
  behavior preventing JS from reading cross-origin redirect targets, not something to work around with a different
  `fetch()` mode. The fallback is to hand the original Moodle link straight to `chrome.downloads.download()`, which
  follows the whole redirect chain itself outside of any CORS restriction.
- Chrome may show its own "Speichern unter" / file-reputation prompt for downloads from external domains it has no
  reputation data for (e.g. first-time Nextcloud/ownCloud share downloads). This is a Chrome download-protection
  heuristic, not something an extension can suppress.
