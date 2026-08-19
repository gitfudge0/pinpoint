# Workflow

## Branching

Branches are named `type/kebab-slug`, with `fix/`, `feat/`, `chore/`, and `docs/` as the types. `fix/top-layer-modal-dialog` is the model. No develop branch and no release branches; everything is short-lived off `main`.

## When to branch and when not to

Commit straight to `main` for README changes, docs, icons, and single-file fixes. A test file that accompanies a fix does not count toward the file count, so a one-file bug fix plus its regression test still qualifies.

Open a PR for anything that touches the message protocol, the build, CI, or more than one surface. Those are the changes where reading the diff as a single unit tells you something a series of commits would not.

This line exists because a solo project running strict PR flow either lies about it or stops doing it. Writing down where the line sits is the version that survives.

## Commits

Sentence case imperative subject, no conventional-commits prefix, no scope, 72 characters as a soft limit. "Survive extension reloads without a page refresh" is the model.

A body appears only when the reason is not visible in the diff. When it does appear, it explains the Chrome behavior that forced the change, not a restatement of the change itself.

No trailers. No AI co-author trailer, ever.

## Merging

Merge is blocked until `npm run check` is green in CI. See `tooling.md` for what that runs.

A user-visible change states the manual side panel checklist result in the PR description. This is a discipline rule rather than an enforceable one, and it is here because the side panel has no automated coverage by deliberate choice, so the checklist is the only thing standing between a panel regression and a release.

## Versioning

A manifest version bump is its own commit, never folded into a feature commit. The release workflow asserts that the version in the packaged manifest matches the git tag, so a version change buried in a feature commit turns into a failed release at the worst moment.

Release procedure and the Chrome Web Store upload steps live in `CONTRIBUTING.md`. They are a procedure a human follows once per release, not a rule to check on every change.
