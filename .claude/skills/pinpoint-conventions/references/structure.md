# Structure

## A note on what you are looking at

The source in this repo today is plain `.js` at the repo root: `background.js`, `content.js`, `sidepanel.js`, `content.css`, `sidepanel.html`. The rules below describe the target state, which is TypeScript under `src/` built by esbuild. If you are reading a root-level `.js` file, you are reading pre-conventions code. Do not treat it as the pattern to copy, and do not convert it as a side effect of an unrelated change.

## Layout

Keep the repo root flat. The manifest has to sit at the root, so it does, along with `sidepanel.html`, `package.json`, and the config files. All source lives under `src/`. Root level source files are what produced the 623 line `content.js`, because a flat root gives nobody anywhere to put the second file.

The tree:

```
src/
  shared/       messages.ts, settings.ts, dom.ts
  background/   index.ts, picking-state.ts, action-icon.ts
  content/      index.ts, picker.ts, overlay.ts, popup.ts, pins.ts,
                top-layer.ts, describe.ts, theme.ts
  sidepanel/    index.ts, components/, export/
  styles/       tokens.css, content.css, sidepanel.css
```

## Surface ownership

Each surface owns one thing and does not reach into another's job.

`background/` handles tab lifecycle, picking state, and the action icon. It carries no feature logic. If you are about to put a decision about annotations or geometry in the service worker, it belongs in the content script instead, because the service worker can be evicted between two user actions and any state it holds is a guess.

`content/` owns page DOM, geometry, pins, and the overlay. It is the only surface allowed to read the page.

`sidepanel/` owns list rendering, the settings UI, and export formatting. Formatting reads the mirror described in `architecture.md` and never writes to it.

A feature that spans surfaces starts by defining the message in `shared/messages.ts`, before any surface code is written. Starting from the code produces a message shape that fits whichever surface got written first.

## The shared layer

Every message type string lives in `shared/messages.ts`. Nowhere else declares one, and no listener compares against an inline literal. A string literal in two files drifts the moment one of them is renamed.

Setting defaults are declared once, in `shared/settings.ts`. Today `content.js:216` and `sidepanel.js:14` both hardcode `"#2563EB"` as the pin color default, which is two places to change and one place to forget.

## Components

A component is a function that takes a props object and returns an `HTMLElement`.

A component never reads module level mutable state. It gets everything it needs through props, so rendering it twice with the same props gives the same node.

A component never touches DOM outside its own subtree. To update it, replace the node. Today's `render()` in `sidepanel.js` reaches into `listEl`, queries `.fbp-item` nodes it created earlier, and removes them by selector, which means the list, the DOM, and the state all mutate each other and none of them is the source of truth.

Every node the content script injects into a page keeps the `fbp-` class prefix. It is the only thing that lets teardown find and remove its own nodes without guessing, and the page owns every other class name.

## Files

One cohesive concept per file. This means one concept, not one exported symbol: `shared/settings.ts` holding defaults plus get, set, and subscribe is one concept, because the settings contract is the thing the file is about.

No barrel files. A file that only re-exports a directory hides where a symbol actually lives, and the next reader has two hops instead of one.

200 line soft ceiling, counting code and not comments. Crossing it is a prompt to look for the seam. If there is no seam, the file is allowed to be long, and saying so in a comment is better than a bad split.

No file named `utils`, `helpers`, `misc`, or `common`. A file earns a name that says what it holds. Those four names are where unrelated functions accumulate because nobody had to decide where they went.

## Styles

`styles/tokens.css` is the only place a color value is defined. Right now the light and dark palette exists twice, once in the inline `<style>` in `sidepanel.html` and once in `content.css`, so the panel and the injected UI can drift out of visual agreement one hex value at a time.

## Doc comments on the public surface

One line of TSDoc on exports from `shared/` and on component props types, saying what the thing does. Nothing on private helpers. No `@param` and no `@returns`, because strict TypeScript already states the shapes and a prose copy is a second thing to keep in sync.

`shared/messages.ts` is the deliberate exception and carries heavier documentation than anything else in the repo. Every message type gets a comment naming which surface sends it, which surface receives it, and what the receiver does on arrival. It is the only API in this project, it spans three bundles that cannot see each other's source, and after the state ownership rule in `architecture.md` it is also the only way state moves.
