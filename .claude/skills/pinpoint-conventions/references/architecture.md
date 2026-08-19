# Architecture

## State has one owner

`content/` is the single owner of annotation state. It holds the element references that give an annotation its meaning, so it is the only surface that can tell whether an annotation still points at anything.

The side panel holds a read-only mirror and never mutates it locally. Reading it is fine, and export formatting is exactly that kind of read.

The panel sends intent. The content script applies the change and broadcasts the resulting state, and the panel re-renders from what it receives.

The failure this prevents is live in the current code. `removeComment` in `sidepanel.js` splices its own `groups` array and also sends `remove-comment` to the content script, which splices its own copy. Two writers, no reconciliation, and no way to detect that they have diverged. The first time a message is dropped, the panel shows a comment the page no longer has, forever.

## Messages

Messages are one-way notifications. No request and response, no awaiting a reply. The other end of this channel can be evicted, reloaded, or navigated away between the send and the receive, so a call that waits for an answer is a call that hangs.

Message payloads form a discriminated union on `type`, and every listener narrows at runtime before touching a field. TypeScript types do not survive `sendMessage`. The union gives you authoring ergonomics; the runtime narrowing is what actually protects the listener.

`GroupId` and `CommentId` are branded types, never bare numbers. The current protocol already invites the mistake: `remove-comment` carries a field named `id` that means a comment, while `focus-group` carries `groupId`. Both are `number` today, so passing one where the other belongs compiles and then deletes the wrong thing.

## Errors

Swallow an expected failure only through a named helper that says which failure it absorbs. There are two: one for "the other end is gone", one for "this page is restricted". Both live in `shared/`.

A bare empty catch is banned. Anything not on the expected list throws. The current code has roughly fifteen anonymous `.catch(() => {})` calls, and none of them distinguishes "the side panel closed" from "we have a bug", which means a real bug looks exactly like normal operation.

Extension reload is a first-class failure mode, handled in one shared module. After a reload, the old content script survives in the page with a dead runtime handle, and accessing `chrome.runtime` can itself throw. That makes `sendMessage` throw synchronously rather than returning a rejected promise, so a trailing `.catch()` never runs. Any code path that can execute after a reload goes through that shared module.

## The page is hostile

The content script runs inside a document that is free to work against it. It can define `window.__fbpInjected` itself, remove a node out from under a pin, open a modal `<dialog>` that makes everything outside it inert, and carry any class name it likes.

Page-derived strings reach the DOM only through `textContent`.

`innerHTML` takes only string literals written in this repo, such as the inline SVG markup for icons and pin badges. A page-derived string passed to `innerHTML` is script execution in the user's browser.

Geometry is read fresh from `getBoundingClientRect()` and never cached. The page can reflow at any time for reasons this extension cannot observe, and a cached rect puts the pin somewhere the element no longer is.

Promotion into the browser top layer via `showPopover` and the re-parenting into an open modal dialog found with `:modal` are the two mechanisms that make the overlay and pins usable on pages that use `<dialog>`. Both are documented as ADRs. Do not simplify either one without reading them, because both look like unnecessary indirection and neither is.

## Seams and dependencies

`chrome.*` calls stay inside named modules. Export formatters, selector generation, and text snippet logic have no `chrome` in scope. Not for dependency injection ceremony, but because those are the functions worth testing, and a `chrome` reference makes them untestable without a stub.

No abstraction until the third caller. An interface with one implementation costs two files of indirection and buys nothing until a second implementation exists.

## Persistence

Settings live in `chrome.storage.sync`. Annotations are never persisted. Annotations being per page session is a product decision, not an oversight, so nobody should helpfully add persistence later. The security rule that nothing page-derived enters storage depends on this one; see `rationale.md` before reversing it.

No storage schema version. Every read supplies defaults, unknown keys are ignored, and removing a setting leaves an orphaned key rather than triggering a migration. With five flat settings, a migration framework costs more than the problem.

## Comments

A comment says only what the code cannot: a browser behavior, a spec quirk, or why the obvious approach was rejected. A comment restating the line it sits above is noise that trains the reader to skim.

A comment that would survive being pasted into another project gets cut. It is describing programming, not this program.

A browser behavior comment has to be specific enough that a reader can go and verify it. "Top layer paints above `<dialog>` backdrops, which beat any z-index" passes. "Dialog hack" does not, because the next reader cannot tell whether it is still true.

No ticket numbers and no names in comments. Git has both, and a comment naming a person outlives their involvement.
