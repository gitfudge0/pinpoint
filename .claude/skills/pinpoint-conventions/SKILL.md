---
name: pinpoint-conventions
description: Use whenever writing, editing, refactoring, or reviewing code in the Pinpoint repo, including new files, new functions, bug fixes, tests, or config. Read before the first edit, not after. Covers how this project structures code, handles errors, tests, and gates merges.
---

# Pinpoint conventions

Generated 2026-08-19 by `hb:conventions`. `hb:conventions` is the generator and lives elsewhere; this file is the artifact and lives in this repo. Editing this file changes this project's rules; it does not change the generator.

Pinpoint is a Chrome MV3 extension with three surfaces: a service worker, a content script injected into arbitrary pages, and a side panel. Most rules here exist because one of those three surfaces can die, lie, or be lied to at any moment.

## The rules that matter most

These apply to every file. Everything else is in the references.

1. **The content script owns annotation state. The side panel holds a read-only mirror and never mutates it.** Two writers on the same list means the panel and the page silently disagree and nothing detects it, which is what today's `removeComment` does when it splices its own array and also sends `remove-comment`.
2. **Swallow a failure only through a named helper that says which expected failure it absorbs. A bare empty catch is banned.** An anonymous `.catch(() => {})` hides a real bug for as long as it takes someone to notice the feature stopped working.
3. **Page-derived strings reach the DOM only through `textContent`. `innerHTML` takes only string literals written in this repo.** The content script runs inside a page that is free to be hostile, and its text ends up in the user's clipboard and then in a GitHub issue.
4. **No network calls from any surface. No `fetch`, `XMLHttpRequest`, `WebSocket`, `eval`, or `new Function`.** The product claim is that nothing leaves the machine, and `npm run check` fails the build if any of those appears under `src/`.
5. **One cohesive concept per file, with a 200 line soft ceiling on code.** Crossing it is a prompt to find the seam, not to split arbitrarily. The 623 line `content.js` is what happens when nobody is looking for the seam.

## Adding or moving code

A new feature starts by naming which surface owns it: `background/` for tab lifecycle and picking state, `content/` for page DOM and geometry, `sidepanel/` for list rendering, settings UI, and export formatting. If the honest answer is "all three", it starts by defining the message in `shared/messages.ts` instead of by writing code. Imports flow from a surface into `shared/`, never between surfaces and never from `shared/` back out.

Read `references/structure.md` before creating a directory, a component, or anything exported.

## Errors, boundaries, and state

Expected chrome failures get absorbed by a named helper; everything else throws. The page is untrusted input and stops being untrusted at `textContent`. Messages are the second trust boundary: TypeScript types are a lie across `sendMessage`, so every listener narrows at runtime before touching a field.

Read `references/architecture.md` before adding an interface, a seam, a `chrome.*` call, or a comment.

## Tests and the check command

Changes to export output, selector generation, or the message protocol require a unit test. A bug fix in pure code starts with the failing test. The one command that checks everything is `npm run check`.

Read `references/testing.md` for shape, doubles, and determinism; `references/tooling.md` for what that command runs.

## Definition of done

- [ ] The change lives in the surface that owns it, and any cross-surface part went through `shared/messages.ts`.
- [ ] No new bare catch, no new `innerHTML` taking a page-derived string, no new network call.
- [ ] `npm run check` passes locally, output read, not assumed.
- [ ] A user-visible change states the manual side panel checklist result in the PR description.
- [ ] Rules touched by this change are still true; if one had to bend, say so rather than bending it silently.

## When this file doesn't cover it

Name the ambiguity and ask. Do not improvise a rule, and do not treat silence as permission. An uncovered case is a question for the user, not a gap to fill with judgement, because the invented rule becomes precedent nobody agreed to.

Why a rule is what it is: `references/rationale.md`, which also records which rules depend on which.
