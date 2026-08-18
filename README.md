<div align="center">

<img src="icons/icon128.png" alt="Pinpoint logo" width="96" />

# Pinpoint

**Drop pins on any webpage. Leave comments. Copy structured feedback as markdown.**

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white)](#installation)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-34A853)](manifest.json)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](#contributing)

[Installation](#installation) · [Usage](#usage) · [Features](#features) · [Contributing](#contributing)

</div>

---

Pinpoint is a zero-dependency Chrome extension for giving pixel-precise feedback on any website. Click an element, pin a comment to it, and export everything as clean, structured markdown — ready to paste into a GitHub issue, Slack thread, or PR review.

No accounts. No servers. Everything stays in your browser.

## Features

- **Element-anchored pins** — pins attach to the element you click, positioned at its top-right, and survive scrolling
- **Threaded comments** — annotate each pin with as much context as you need
- **One-click export** — copy all feedback as Markdown, plain text, or JSON, with configurable content (selectors, text snippets)
- **Customizable** — pin color, copy format, light/dark theme, all from the side panel settings
- **Side panel UI** — review and manage every annotation on the page from Chrome's native side panel
- **Private by design** — `storage` + `activeTab` only; nothing ever leaves your machine

## Installation

### From source

```bash
git clone https://github.com/gitfudge0/pinpoint.git
```

1. Open `chrome://extensions` in Chrome
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** and select the cloned folder

### Release build

Grab the latest zip from [Releases](../../releases), or build it yourself:

```bash
./package.sh
```

The minified bundle lands in `dist/`.

## Usage

1. Click the Pinpoint toolbar icon to start picking — the icon stays lit while picking is active
2. Click any element on the page to drop a pin and write your comment
3. Review all annotations in the side panel; tweak format, theme, and pin color in settings
4. Hit **Copy** to grab everything in your chosen format

Example Markdown output:

```markdown
## UI Feedback — https://example.com (2026-08-18)

### 1. button "Get started"
- Selector: main .pricing-card:nth-child(2) > button
- Comments:
  1. Contrast fails WCAG AA on the CTA
```

## Project structure

```
├── manifest.json     # MV3 manifest
├── background.js     # Service worker (side panel wiring)
├── content.js        # Element picking, pins, overlay UI
├── content.css       # Injected styles
├── sidepanel.html    # Side panel + settings
└── sidepanel.js      # Panel logic, settings, markdown export
```

Plain JavaScript, no build step, no dependencies.

## Contributing

Issues and PRs welcome. Keep it dependency-free — that's the whole point.

1. Fork the repo
2. Create a branch (`git checkout -b fix/blurry-pins`)
3. Load unpacked and test in Chrome
4. Open a PR

---

<div align="center">
Made by <a href="https://github.com/gitfudge0">gitfudge0</a>
</div>
