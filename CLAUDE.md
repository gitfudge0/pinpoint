# Pinpoint

Read `.claude/skills/pinpoint-conventions` before your first edit to any code,
test, or config here. It holds the rules; do not improvise around them.

Pinpoint is a Chrome MV3 extension with three surfaces that cannot see each
other's code: a service worker, a content script injected into arbitrary pages,
and a side panel. Most bugs come from one surface dying or being lied to.

The `.js` files at the repo root are pre-conventions code. The rules describe
TypeScript under `src/`, and that migration has not happened, so `npm run check`
fails at its first step, `tsc --noEmit`, with TS18003 and no inputs found.
That is expected. Do not convert root-level files as a side effect of
unrelated work.
