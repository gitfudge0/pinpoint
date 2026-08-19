# Testing

## What gets a unit test and what does not

Vitest. Unit tests sit beside the source they cover, as `*.test.ts`.

Unit tests cover the pure core: the three export formatters, `selectorFor`, `textSnippet`, the label builders (`describe`, `labelText`, `shortLabel`), settings default merging, and the runtime narrowing guards for messages. These are plain input to output functions, they hold the observable behavior of the product, and they cost almost nothing to cover well.

Do not write unit tests for overlay positioning, pin placement, top layer promotion, or cross-surface messaging. Testing those means stubbing `getBoundingClientRect`, `showPopover`, and `chrome.tabs`, and the result is a test that passes while the extension is visibly broken on screen. That is worse than having no test, because it reports confidence that does not exist.

## End to end

One Playwright spec drives the unpacked build in a persistent Chrome context against local fixture pages in `e2e/fixtures/`.

The fixtures exist to encode the browser behaviors that have already caused bugs here: a page with a modal `<dialog>`, a page with a `popover` backdrop, a long scrolling page, and a page with an element close enough to the viewport edge that the popup flip logic runs.

The side panel stays out of e2e by design. Chrome's side panel is impractical to address from Playwright, and faking it would defeat the point of an end to end test. It is covered by a manual checklist kept in the repo, which is honest about being manual rather than pretending otherwise.

## Determinism

The export date is a parameter passed in by the caller. No `new Date()` inside a formatter. `buildMarkdown` currently calls `new Date().toLocaleDateString("en-CA")` inline, which makes the export impossible to assert against without freezing time.

## The floor for merging

A change to export output, selector generation, or the message protocol requires a unit test. Those three are what other people's workflows depend on, and a silent change to any of them shows up as corrupted feedback in someone's issue tracker.

A bug fix in pure code starts with the failing test. You already have the repro, so writing the assertion first costs nothing and proves the fix does something.

A reproducible DOM or geometry bug gets a fixture case in the Playwright spec. One that cannot be reproduced reliably gets a line in the manual checklist naming the browser behavior involved.

Features get their tests written alongside, not after. Full test-first is the wrong promise in a codebase where half the bugs are "Chrome does something surprising" and the surprise is the part you learn last.

## Doubles

Use real objects wherever possible.

Exactly one chrome stub exists, at `test/chrome-stub.ts`. Nothing else stubs chrome. More than one stub means two different fictional versions of the extension API, and tests start disagreeing about which fiction is correct.

Mocking your own modules is banned. A module you need to mock is a module that wants splitting, and the split is the real fix.

## Coverage and flakes

No coverage gate and no coverage number. The pure modules should sit near complete coverage because it costs so little; a percentage in CI invites tests written for the number.

A flaky test gets skipped with an issue filed the same day, and deleted if it is still skipped a week later. Playwright retries stay at zero. A test that passes on the second attempt found something real, and retrying until green throws that information away.
