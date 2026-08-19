# Rationale

A register of contested calls, not a transcript. Each entry records what was decided, what was rejected, and why. Its job is to stop a future reader from reopening a settled argument from scratch.

This was a start-clean run. The rules were decided from first principles against the current code rather than inferred from existing habits, so where a rule matches what the code already does, that is agreement and not inheritance.

## Rule dependencies

One link matters enough to state on its own.

"Nothing page-derived enters storage" (`security.md`) holds only because "annotations are never persisted" (`architecture.md`) established the precondition. If annotations ever gain persistence, the storage rule stops being true automatically and has to be re-decided in the same change. Neither rule may be reversed without touching the other.

## Conflicts resolved during the interview

**The side panel owns export formatting, but the content script owns annotation state.** Read as a conflict, these cannot both hold. Resolved by separating data ownership from presentation: the content script owns the data, the side panel owns rendering and formatting, and formatting is a pure read of the panel's mirror. Writing is what the ownership rule restricts, not reading.

**"One primary export per file" versus `shared/settings.ts` holding defaults plus get, set, and subscribe.** Resolved by reading the rule as one cohesive concept per file rather than one exported symbol. The settings contract is a single concept. The rejected reading would have split it into three files that are never used apart.

**The network grep would fail on the test suite.** Playwright's `page.evaluate` contains the substring `eval`, so a repo-wide grep fails on `e2e/` immediately. Resolved by scoping the grep to `src/` and exempting `e2e/`. The alternative, a cleverer pattern that tries to distinguish `eval(` from `page.evaluate`, was rejected because a gate that produces false positives gets disabled, and a disabled gate is worse than a narrower one.

**Direct-to-main allows single-file fixes, but bug fixes must start with a failing test.** Together these made every bug fix a two-file change requiring a PR, which was not the intent. Resolved by not counting an accompanying test file toward the file count.

## Rejected alternatives, by round

### Structure

**Leaving message type strings and setting defaults as literals in each surface.** Zero setup cost, and it is what the code does today. Rejected because the duplication is already live: `content.js:216` and `sidepanel.js:14` both hardcode `"#2563EB"`, so the bug is not hypothetical, it is one edit away.

**Keeping a flat repo root with no `src/`.** This was the original proposal, on the grounds that four files do not earn a tree. The user then asked for real file splitting and components, which changes the calculation entirely: a flat root gives the second file nowhere to go, and that is how `content.js` reached 623 lines.

**Resolving imports without a bundler.** Several routes were on the table, including dynamic `import(chrome.runtime.getURL(...))` with the module files added to `web_accessible_resources`, and concatenating multiple files through repeated `executeScript` entries. All were mooted when the user chose TypeScript, because a build step became unavoidable and the bundler stopped being a separate decision. The `web_accessible_resources` route also carried a real cost: every exposed module becomes another extension-detection surface, on top of the font.

**Keeping zero-setup installation.** Cloning the repo and loading the folder directly in `chrome://extensions` was a genuine property worth something for an open-source extension, and TypeScript ends it. The user accepted the cost explicitly. Contributors now need Node and a build step, and the README and `CONTRIBUTING.md` have to say so.

### Testing

**Unit-testing geometry, pin placement, and cross-surface messaging with mocks.** Rejected because those tests pass while the extension is visibly broken on screen. Stubbing `getBoundingClientRect` and `showPopover` tests the stub, not the browser, and the browser is where every bug in this area has come from.

**Covering the side panel in end-to-end tests.** Rejected because Chrome's side panel is impractical to address from Playwright, and a faked panel would defeat the purpose of an end-to-end test. Replaced with a manual checklist kept in the repo. This is a real gap, accepted knowingly, which is why the workflow rules require the checklist result in the PR description for user-visible changes.

**A coverage percentage in CI.** Rejected because it produces tests written for the number. The pure modules should approach full coverage on their own, since they cost almost nothing to test.

### Workflow

**Pre-commit hooks via husky and lint-staged.** Rejected because a hook on every commit teaches `--no-verify`, after which it costs time and protects nothing. The gate lives in `npm run check` and in CI instead.

**Adding ESLint now.** Deferred rather than rejected outright. On a strict TypeScript codebase this size it is mostly config maintenance. The named trigger to revisit: if unawaited promises start causing bugs, add typescript-eslint with `no-floating-promises` alone. Given how much of this code is fire-and-forget `chrome.*` calls, that is a plausible future.

**Strict PR flow for all changes.** Rejected as a rule a solo project either lies about or abandons. The line between direct-to-main and PR-required is written down instead, so it can be followed honestly.

### Security

**Inlining `fonts/inter-var.woff2` as base64 to remove the extension-detection surface.** The `web_accessible_resources` entry matching `<all_urls>` lets any page detect the extension. Inlining removes that, but the file is 352KB and it would land in the CSS injected into every annotated page. Rejected on weight. The detection surface is recorded as an accepted risk.

## ADR policy

ADRs live in `docs/decisions/` as numbered files with three sections: context, decision, and what breaks if you reverse it.

Only three things earn an ADR. A browser workaround that took real debugging to find. An approach that was rejected and that someone will propose again. A change to the message protocol.

Library choices and process decisions do not get one, because the rules files already hold those, and duplicating them creates two places to disagree.

Four ADRs are pending. They record decisions that already exist in the code and are currently invisible, which makes them exactly the four things a well-meaning contributor would undo while cleaning up:

1. Promoting the overlay, label, popup, and pin container into the browser top layer with `showPopover`, because the top layer paints above `<dialog>` backdrops and those beat any z-index.
2. Re-parenting the popup and pin container into the topmost open modal dialog found via `:modal`, because an open modal makes everything outside its subtree inert, so `focus()` and clicks on a node parented to `<html>` silently do nothing.
3. Recording an annotation locally before sending it, because after an extension reload the stale content script's `chrome.runtime` handle is dead and `sendMessage` throws synchronously rather than rejecting, so a trailing `.catch()` never runs.
4. Single-owner annotation state, with the side panel holding a read-only mirror, replacing the two-writer arrangement in the current code.

These have not been written. The user has not approved creating them.
