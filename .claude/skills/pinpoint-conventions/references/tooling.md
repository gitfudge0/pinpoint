# Tooling

## Status

None of the configuration described here exists in the repo yet. The rules were agreed; the config files are pending the user's approval, one yes per file. Do not create `package.json`, `tsconfig.json`, `.prettierrc`, the Playwright config, or the npm scripts as a side effect of another change. If a task needs one of them, ask.

Today the build is `package.sh`, which shells out to `npx --yes esbuild` and fetches whatever version is current at build time.

## The one command

`npm run check` is the only gate. It runs four steps in this order and exits nonzero on any of them:

1. `tsc --noEmit`, the type gate. esbuild strips types without checking them, so this is the only thing that type checks the project.
2. `vitest run`, the unit tests.
3. The production build, so a change that type checks but does not bundle fails here rather than at release.
4. A grep over `src/` for `fetch`, `XMLHttpRequest`, `WebSocket`, `eval`, and `new Function`, failing the build on a match.

If a check is not in `npm run check`, it is not a gate. Adding a verification step that only runs somewhere else means it stops running.

The grep in step 4 is scoped to `src/` and exempts `e2e/`. Playwright's `page.evaluate` contains the substring `eval`, and a gate that false-positives on the test suite gets disabled within a week.

## No pre-commit hooks

No husky, no lint-staged, nothing on commit. A hook that fires on every commit teaches you to type `--no-verify`, and at that point it protects nothing while still costing time. The gate lives in CI and in `npm run check`.

## No ESLint, for now

Strict TypeScript on a codebase this size makes ESLint mostly config maintenance. The trigger to revisit is specific: if unawaited promises start causing bugs, add typescript-eslint with `no-floating-promises` and nothing else. Given how much of this code is fire-and-forget `chrome.*` calls, that day may come.

## Configuration facts

These were decided during the interview and belong in config, not in prose rules. They are recorded here so nobody re-argues them and so an agent knows what the config should say.

TypeScript runs in strict mode, set in `tsconfig.json`.

Prettier runs with default config and no overrides. `npm run format` writes, and CI runs `prettier --check`.

esbuild is a pinned devDependency with a lockfile, not `npx --yes`. It handles transpile and bundle in one pass.

Three bundle entry points: `src/background/index.ts`, `src/content/index.ts`, `src/sidepanel/index.ts`. The content script bundles to a single file so it stays injectable through `chrome.scripting.executeScript` with no module loading workarounds and no additional `web_accessible_resources` exposure.

`@types/chrome` is a devDependency. Runtime dependencies stay at zero, so the shipped extension is unaffected.

Squash merge is set as the repository default on GitHub, keeping `main` at one commit per change.

Playwright retries are configured to 0.

The unpacked build output is what gets loaded in `chrome://extensions` during development, which means contributors need Node and a build step. `CONTRIBUTING.md` carries that setup, and the README's install section reflects it.
