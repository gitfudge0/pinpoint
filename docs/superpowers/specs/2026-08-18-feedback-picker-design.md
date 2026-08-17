# Pinpoint — Chrome Extension Design

**Date:** 2026-08-18
**Status:** Approved

## Purpose

Annotate elements on a live web page with comments, then copy all annotations
as structured markdown to paste into a coding agent (Claude Code) as UI
feedback. Single user, clipboard-only output, no persistence.

## Scope decisions (agreed)

- Output consumer: the user pasting into Claude Code. No sharing, storage, or sync.
- Annotations are **ephemeral**: they live in the side panel while it stays open; page reload or closing the panel wipes them.
- Output format: **markdown** (see below), not JSON.
- Ancestor selection: **yes** — Alt+scroll or ↑/↓ arrow keys walk the ancestor chain before clicking.

## Architecture

Manifest V3, plain JS/CSS/HTML, no build step, no dependencies.

| File | Role |
|------|------|
| `manifest.json` | MV3 manifest: `sidePanel`, `activeTab`, `scripting` permissions |
| `background.js` | Service worker. Toolbar click → open side panel, inject/start content script |
| `content.js` + `content.css` | Picker mode: hover highlight overlay, ancestor walking, inline comment popup, selector generation |
| `sidepanel.html` + `sidepanel.js` | Annotation list (single source of truth), Copy and Clear all buttons |

Messaging: `content.js` → `chrome.runtime.sendMessage` → side panel. Side panel
→ `chrome.tabs.sendMessage` → content script (start/stop picking).

## Picker flow

1. Toolbar click starts picker mode and opens the side panel.
2. Hover: element under cursor gets an outline drawn via a positioned overlay
   div (never mutates page styles), plus a small label like `button.btn-primary`.
3. Alt+scroll or ↑/↓ moves the highlight up/down the ancestor chain of the
   hovered element.
4. Click freezes the pick and opens a comment popup anchored next to the
   element (flips to stay in viewport): textarea, **Save**, **Cancel**.
   Enter saves, Esc cancels. Click/keys are intercepted (capture phase +
   `preventDefault`) so the page doesn't react.
5. Save sends `{selector, tag, id, classes, textSnippet, comment}` to the side
   panel and returns to picking mode.
6. Esc while hovering exits picker mode entirely.

## Selector generation

Walk up from the element building a CSS path: stop at the nearest ancestor
with an `#id` (use it as anchor), otherwise use `tag:nth-child(n)` segments,
capped at ~5 levels. Always also capture tag name, id, class list, and first
80 chars of visible text — that context is what the agent greps the codebase
with when the CSS path is meaningless (hashed/utility class names).

## Side panel

- Numbered list; each row: element label (`tag#id.classes`), text snippet,
  comment, delete ✕.
- Footer: **Copy** (writes markdown to clipboard, flashes "Copied ✓") and
  **Clear all**.
- State is a plain array in `sidepanel.js`. No storage APIs.

## Output format

```markdown
## UI Feedback — <page URL> (<date>)

### 1. <button class="btn-primary"> "Save changes"
- Selector: #settings-form > div.actions > button:nth-child(2)
- Text: "Save changes"
- Comment: Make this full-width on mobile and disable while saving
```

One `###` block per annotation, in pick order.

## Error handling

- Restricted pages (`chrome://`, Web Store, etc.): script injection fails →
  side panel shows "Can't annotate this page".
- Cross-origin iframes: not pickable, out of scope for v1.
- Clipboard write failure: show the markdown in a selectable textarea in the
  panel as fallback.

## Testing

Manual: load unpacked → on a real page run pick → ancestor-walk → comment →
list → delete one → copy → paste into Claude Code and verify it's clean and
actionable. No test framework for a 5-file extension.

## Out of scope (v1)

Persistence, sharing/export formats, iframe support, screenshots per
annotation, editing a saved comment (delete + re-add instead).
