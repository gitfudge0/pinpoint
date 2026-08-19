# Security

## Nothing leaves the machine

No network calls from any surface. No analytics, no telemetry, no crash reporting, no font CDN, no update check. This is the entire product claim, and right now it is true by accident rather than by rule, since no `fetch`, `XMLHttpRequest`, `WebSocket`, or `eval` appears anywhere in the current source.

`npm run check` greps `src/` for `fetch`, `XMLHttpRequest`, `WebSocket`, `eval`, and `new Function` and fails on a match. `e2e/` is exempt because Playwright's `page.evaluate` matches. A rule with a grep behind it survives contributors; a promise in a README does not.

Zero runtime dependencies is a hard rule, not an aspiration. devDependencies are allowed and now unavoidable, but a new one needs a stated reason in the PR, because a devDependency still executes on your machine and in CI.

## Permissions

Permissions stay at `sidePanel`, `activeTab`, `scripting`, and `storage`. Adding one requires an ADR that says what breaks without it.

No `host_permissions` and no declared content script in the manifest. `activeTab` plus injection on click is what makes this extension harmless by construction: it cannot touch a page until the user clicks the toolbar icon, and no permission prompt can be traded away for convenience later.

The `fonts/inter-var.woff2` entry in `web_accessible_resources` matches `<all_urls>`, which lets any page detect that Pinpoint is installed by fetching that URL. This is a known and accepted tradeoff recorded as an ADR. Inlining the font as base64 would remove the detection surface but put 352KB into the CSS injected into every annotated page. Do not "fix" it without reading the ADR.

## What crosses machines

`chrome.storage.sync` syncs to the user's Google account, so settings do leave the device. Settings only.

Nothing derived from page content ever enters storage: no URLs, no selectors, no text snippets, no comment text. This is the precise version of "nothing leaves your machine", and it holds only because annotations are never persisted (see the persistence rule in `architecture.md`). Reversing that rule invalidates this one, and both have to be revisited in the same change.

## The export path

Page text flows into `textSnippet`, into the clipboard, and then into someone's GitHub issue or Slack thread. Treat it as untrusted the whole way.

Exported content is never rendered as HTML anywhere in this extension. `innerHTML` takes only string literals written in this repo. This restates the trust boundary rule in `architecture.md` because it is load-bearing in two places.

Clipboard writes happen only on an explicit user click. Never on load, never on a timer, never as a side effect of something else.

## Failing closed

A restricted page (`chrome://`, the Web Store, and similar) fails closed with a visible message, which is what the existing `restricted-page` path does. Silence there is a bug, because the user is left clicking an icon that appears to do nothing and has no way to learn why.

## Disclosure

`SECURITY.md` carries a contact address. A security fix ships the same day as its own patch release, never batched behind a feature. For a published extension with a public repo, that is the difference between a disclosure that goes quietly and one that does not.
