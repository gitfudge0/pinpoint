(() => {
  // A stale instance's chrome.runtime handle dies on extension reload, so
  // accessing it can itself throw — treat that as "not alive".
  function contextAlive() {
    try { return !!(chrome.runtime && chrome.runtime.id); } catch { return false; }
  }

  if (window.__fbpInjected && contextAlive()) {
    // Live instance already present — just (re)start picking mode.
    window.__fbpStartPicking && window.__fbpStartPicking();
    return;
  }

  if (window.__fbpInjected) {
    // Stale instance from a previous extension load is squatting the page.
    try { window.__fbpTeardown && window.__fbpTeardown(); } catch {}
    document
      .querySelectorAll(".fbp-overlay, .fbp-label, .fbp-popup, .fbp-pin-container")
      .forEach((el) => el.remove());
  }

  window.__fbpInjected = true;

  function injectFontFace() {
    if (document.getElementById("__fbp-font-face")) return;
    const style = document.createElement("style");
    style.id = "__fbp-font-face";
    const fontUrl = chrome.runtime.getURL("fonts/inter-var.woff2");
    style.textContent = `@font-face {
  font-family: "Inter";
  src: url("${fontUrl}") format("woff2");
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
}`;
    (document.head || document.documentElement).appendChild(style);
  }
  injectFontFace();

  let picking = false;
  let hovered = null;
  let descentStack = []; // elements walked past while going up, for ArrowDown/scroll-down to return to
  let frozen = null; // element frozen for the comment popup
  let overlay = null;
  let label = null;
  let popup = null;
  let openClickEvent = null; // the click that opened the popup; outside-click must ignore it
  let nextCommentId = 1;
  let nextGroupId = 1;
  let groups = []; // { el, groupId, comments: [{id, comment}], pinEl }
  let pinContainer = null;

  function ensureOverlay() {
    if (overlay) return;
    overlay = document.createElement("div");
    overlay.className = "fbp-overlay";
    label = document.createElement("div");
    label.className = "fbp-label";
    document.documentElement.appendChild(overlay);
    document.documentElement.appendChild(label);
    overlay.style.setProperty("--fbp-accent", pinColor);
    label.style.setProperty("--fbp-accent", pinColor);
  }

  function describe(el) {
    const tag = el.tagName.toLowerCase();
    const id = el.id || "";
    const classes = el.className && typeof el.className === "string"
      ? el.className.trim().split(/\s+/).filter(Boolean)
      : [];
    return { tag, id, classes };
  }

  function labelText(el) {
    const { tag, id, classes } = describe(el);
    let text = tag;
    if (id) text += `#${id}`;
    if (classes.length) text += "." + classes.join(".");
    return text;
  }

  // Promote an element into the browser top layer so it paints above
  // <dialog>.showModal()/popover backdrops, which beat any z-index.
  // Re-shows each time to hop above dialogs opened after us.
  function topLayer(el) {
    if (!el || !el.showPopover) return;
    el.popover = "manual";
    try { el.hidePopover(); } catch {}
    try { el.showPopover(); } catch {}
  }

  function unTopLayer(el) {
    if (!el || !el.hidePopover) return;
    try { el.hidePopover(); } catch {}
  }

  // An open modal <dialog> makes everything outside its subtree inert,
  // so focus()/clicks on a popup parented to <html> silently no-op.
  // Find the topmost open modal dialog to host the popup instead.
  function modalHost() {
    const dialogs = document.querySelectorAll("dialog");
    for (let i = dialogs.length - 1; i >= 0; i--) {
      try {
        if (dialogs[i].matches(":modal")) return dialogs[i];
      } catch {}
    }
    return document.documentElement;
  }

  function positionOverlay(el) {
    ensureOverlay();
    const rect = el.getBoundingClientRect();
    overlay.style.top = `${rect.top}px`;
    overlay.style.left = `${rect.left}px`;
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;
    overlay.style.display = "block";

    label.textContent = labelText(el);
    label.style.display = "block";
    // Position label above the element, or below if not enough room.
    const labelHeight = 22;
    let top = rect.top - labelHeight;
    if (top < 0) top = rect.bottom;
    let left = rect.left;
    if (left + 200 > window.innerWidth) left = Math.max(0, window.innerWidth - 200);
    label.style.top = `${top}px`;
    label.style.left = `${left}px`;

    topLayer(overlay);
    topLayer(label);
  }

  function hideOverlay() {
    if (overlay) overlay.style.display = "none";
    if (label) label.style.display = "none";
    unTopLayer(overlay);
    unTopLayer(label);
  }

  function onMouseMove(e) {
    if (!picking || frozen) return;
    const el = e.target;
    if (!el || el === hovered) return;
    if (popup && popup.contains(el)) return;
    hovered = el;
    descentStack = [];
    positionOverlay(el);
  }

  function onWheel(e) {
    if (!picking || frozen || !hovered) return;
    if (!e.altKey) return;
    e.preventDefault();
    if (e.deltaY < 0) {
      walkUp();
    } else {
      walkDown();
    }
  }

  function walkUp() {
    if (!hovered) return;
    if (hovered === document.body) return;
    const parent = hovered.parentElement;
    if (!parent) return;
    descentStack.push(hovered);
    hovered = parent;
    positionOverlay(hovered);
  }

  function walkDown() {
    if (!descentStack.length) return;
    hovered = descentStack.pop();
    positionOverlay(hovered);
  }

  function selectorFor(el) {
    const parts = [];
    let node = el;
    let levels = 0;
    while (node && node.nodeType === 1 && levels < 5) {
      if (node.id) {
        parts.unshift(`#${node.id}`);
        break;
      }
      const parent = node.parentElement;
      if (!parent) {
        parts.unshift(node.tagName.toLowerCase());
        break;
      }
      const siblings = Array.from(parent.children);
      const index = siblings.indexOf(node) + 1;
      parts.unshift(`${node.tagName.toLowerCase()}:nth-child(${index})`);
      node = parent;
      levels++;
    }
    return parts.join(" > ");
  }

  function textSnippet(el) {
    const text = (el.innerText || el.textContent || "").trim().replace(/\s+/g, " ");
    return text.slice(0, 80);
  }

  function shortLabel(el) {
    const { tag, classes } = describe(el);
    return classes.length ? `${tag}.${classes[0]}` : tag;
  }

  let currentTheme = "system";
  const darkMedia = window.matchMedia("(prefers-color-scheme: dark)");
  let isDark = darkMedia.matches;
  let pinColor = "#2563EB";

  function computeIsDark() {
    return currentTheme === "dark" || (currentTheme === "system" && darkMedia.matches);
  }

  function applyThemeToPopup() {
    if (popup) popup.classList.toggle("fbp-dark", isDark);
  }

  function applyAccentColor() {
    for (const el of [overlay, label, popup, pinContainer]) {
      if (el) el.style.setProperty("--fbp-accent", pinColor);
    }
  }

  chrome.storage.sync.get({ theme: "system", pinColor: "#2563EB" }, (res) => {
    currentTheme = res.theme;
    isDark = computeIsDark();
    applyThemeToPopup();
    pinColor = res.pinColor;
    applyAccentColor();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes.theme) {
      currentTheme = changes.theme.newValue;
      isDark = computeIsDark();
      applyThemeToPopup();
    }
    if (area === "sync" && changes.pinColor) {
      pinColor = changes.pinColor.newValue;
      applyAccentColor();
    }
  });

  function onDarkMediaChange() {
    if (currentTheme === "system") {
      isDark = computeIsDark();
      applyThemeToPopup();
    }
  }
  darkMedia.addEventListener("change", onDarkMediaChange);

  function showPopup(el, group, anchorRect) {
    ensurePopup();
    const rect = el.getBoundingClientRect();
    popup.classList.toggle("fbp-dark", isDark);
    const header = popup.querySelector(".fbp-header");
    if (header) header.textContent = shortLabel(el);
    const host = modalHost();
    if (popup.parentNode !== host) host.appendChild(popup);
    popup.style.display = "block";
    topLayer(popup);
    popup.querySelector("textarea").value = "";

    const history = popup.querySelector(".fbp-history");
    if (history) {
      history.innerHTML = "";
      if (group) {
        group.comments.forEach((c, i) => {
          const item = document.createElement("div");
          item.className = "fbp-history-item";
          item.textContent = `${i + 1}. ${c.comment}`;
          history.appendChild(item);
        });
        history.classList.add("fbp-visible");
      } else {
        history.classList.remove("fbp-visible");
      }
    }

    // Measure then position, flipping to stay in viewport.
    const popupRect = popup.getBoundingClientRect();
    let top, left;
    if (anchorRect) {
      top = anchorRect.bottom + 8;
      left = anchorRect.right - popupRect.width;
      if (top + popupRect.height > window.innerHeight) {
        top = anchorRect.top - popupRect.height - 8;
        if (top < 0) top = Math.max(0, window.innerHeight - popupRect.height - 8);
      }
      if (left < 0) left = 0;
      if (left + popupRect.width > window.innerWidth) {
        left = Math.max(0, window.innerWidth - popupRect.width - 8);
      }
    } else {
      // Anchor at the element's top-right, matching where the pin will appear.
      top = rect.top + 8;
      if (top + popupRect.height > window.innerHeight) {
        top = Math.max(0, window.innerHeight - popupRect.height - 8);
      }
      left = rect.right - popupRect.width;
      if (left < 0) left = 0;
      if (left + popupRect.width > window.innerWidth) {
        left = Math.max(0, window.innerWidth - popupRect.width - 8);
      }
    }
    popup.style.top = `${top}px`;
    popup.style.left = `${left}px`;

    popup.querySelector("textarea").focus();
  }

  function hidePopup() {
    if (popup) popup.style.display = "none";
    unTopLayer(popup);
    // Don't leave the popup stranded inside a dialog the page may remove.
    if (popup && popup.parentNode !== document.documentElement) {
      document.documentElement.appendChild(popup);
    }
  }

  function ensurePopup() {
    if (popup) return;
    popup = document.createElement("div");
    popup.className = "fbp-popup";
    popup.innerHTML = `
      <div class="fbp-header"></div>
      <div class="fbp-history"></div>
      <textarea class="fbp-textarea" placeholder="Comment..."></textarea>
      <div class="fbp-popup-actions">
        <button type="button" class="fbp-btn fbp-btn-cancel">Cancel</button>
        <button type="button" class="fbp-btn fbp-btn-save">Save</button>
      </div>
    `;
    document.documentElement.appendChild(popup);
    popup.style.setProperty("--fbp-accent", pinColor);

    popup.querySelector(".fbp-btn-save").addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      saveAnnotation();
    });
    popup.querySelector(".fbp-btn-cancel").addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      cancelPopup();
    });
    popup.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        saveAnnotation();
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        cancelPopup();
      }
    });
    popup.addEventListener("click", (e) => e.stopPropagation());

    document.addEventListener("click", onOutsideClick, true);
  }

  function onOutsideClick(e) {
    if (!frozen || !popup || popup.style.display === "none") return;
    if (e === openClickEvent) return;
    if (popup.contains(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
    cancelPopup();
  }

  function saveAnnotation() {
    if (!frozen) return;
    const comment = popup.querySelector("textarea").value.trim();
    const { tag, id, classes } = describe(frozen);
    const commentId = nextCommentId++;

    let group = findGroup(frozen);
    if (!group) {
      group = { el: frozen, groupId: nextGroupId++, comments: [], pinEl: null };
      groups.push(group);
      group.pinEl = createPin(group);
      positionPin(group);
    }

    group.comments.push({ id: commentId, comment });
    renderPinContent(group.pinEl, group);
    positionPin(group);

    // Record locally first: after an extension reload the old content script
    // survives in the page with a dead chrome.runtime, and sendMessage then
    // throws synchronously rather than rejecting, so .catch() never runs.
    try {
      chrome.runtime
        .sendMessage({
          type: "annotation",
          data: {
            commentId: commentId,
            groupId: group.groupId,
            selector: selectorFor(frozen),
            tag,
            id,
            classes,
            textSnippet: textSnippet(frozen),
            comment,
            url: location.href,
          },
        })
        .catch(() => {});
    } catch {}

    showPopup(frozen, group, group.pinEl.getBoundingClientRect());
  }

  function findGroup(el) {
    for (const g of groups) {
      if (g.el === el) return g;
    }
    return null;
  }

  function ensurePinContainer() {
    if (pinContainer) return pinContainer;
    pinContainer = document.createElement("div");
    pinContainer.className = "fbp-pin-container";
    document.documentElement.appendChild(pinContainer);
    pinContainer.style.setProperty("--fbp-accent", pinColor);
    hostPinContainer();
    return pinContainer;
  }

  // Re-parent the pin container into the open modal dialog (if any) so pins
  // aren't inert, and re-promote it to the top layer so it paints above the
  // dialog too — same reasoning as modalHost()/topLayer() above for the popup.
  function hostPinContainer() {
    if (!pinContainer) return;
    const host = modalHost();
    if (pinContainer.parentNode !== host) host.appendChild(pinContainer);
    topLayer(pinContainer);
  }

  function createPin(group) {
    ensurePinContainer();
    const pinEl = document.createElement("div");
    pinEl.className = "fbp-pin";
    pinContainer.appendChild(pinEl);
    pinEl.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      positionOverlay(group.el);
      setTimeout(() => hideOverlay(), 1000);
      frozen = group.el;
      showPopup(group.el, group, group.pinEl.getBoundingClientRect());
    });
    return pinEl;
  }

  function renderPinContent(pinEl, group) {
    if (!pinEl) return;
    const count = group.comments.length;
    const bubbleSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="#ffffff" stroke="none"><path d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 4v-4H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/></svg>';
    let html = bubbleSvg;
    html += `<span class="fbp-pin-badge">${count}</span>`;
    pinEl.innerHTML = html;
  }

  // Container is top-layer, so its containing block is the viewport —
  // position against getBoundingClientRect() directly, no scroll offsets.
  function positionPin(group) {
    if (!group.pinEl) return;
    const rect = group.el.getBoundingClientRect();
    group.pinEl.style.left = `${rect.right - 14}px`;
    group.pinEl.style.top = `${rect.top - 14}px`;
  }

  function repositionAllPins() {
    hostPinContainer();
    for (const g of groups) {
      if (g.pinEl) positionPin(g);
    }
  }

  function cancelPopup() {
    hidePopup();
    frozen = null;
    if (picking) positionOverlay(hovered || document.body);
  }

  function onClick(e) {
    if (!picking || frozen) return;
    if (popup && popup.contains(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
    frozen = hovered || e.target;
    openClickEvent = e;
    showPopup(frozen, findGroup(frozen));
  }

  function onKeyDown(e) {
    if (!picking) return;
    if (frozen) return; // popup has its own keydown handler
    if (e.key === "ArrowUp") {
      e.preventDefault();
      walkUp();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      walkDown();
    } else if (e.key === "Escape") {
      e.preventDefault();
      stopPicking();
    }
  }

  function startPicking() {
    if (picking) return;
    picking = true;
    ensureOverlay();
    document.addEventListener("mousemove", onMouseMove, true);
    document.addEventListener("wheel", onWheel, { capture: true, passive: false });
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKeyDown, true);
  }

  function stopPicking() {
    picking = false;
    hovered = null;
    frozen = null;
    hideOverlay();
    hidePopup();
    document.removeEventListener("mousemove", onMouseMove, true);
    document.removeEventListener("wheel", onWheel, { capture: true });
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("keydown", onKeyDown, true);
    chrome.runtime.sendMessage({ type: "stopped-picking" }).catch(() => {});
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === "start-picking") {
      startPicking();
    } else if (msg && msg.type === "stop-picking") {
      stopPicking();
    } else if (msg && msg.type === "remove-comment") {
      for (const group of groups) {
        const idx = group.comments.findIndex((c) => c.id === msg.id);
        if (idx === -1) continue;
        group.comments.splice(idx, 1);
        if (group.comments.length === 0) {
          const gIdx = groups.indexOf(group);
          if (gIdx !== -1) groups.splice(gIdx, 1);
          if (group.pinEl && group.pinEl.parentNode) {
            group.pinEl.parentNode.removeChild(group.pinEl);
          }
          if (frozen === group.el && popup && popup.style.display !== "none") {
            cancelPopup();
          }
        } else {
          renderPinContent(group.pinEl, group);
        }
        break;
      }
    } else if (msg && msg.type === "focus-group") {
      const group = groups.find((g) => g.groupId === msg.groupId);
      if (group) {
        group.el.scrollIntoView({ behavior: "smooth", block: "center" });
        positionOverlay(group.el);
        setTimeout(() => hideOverlay(), 1000);
      }
    } else if (msg && msg.type === "clear-annotations") {
      for (const group of groups) {
        if (group.pinEl && group.pinEl.parentNode) {
          group.pinEl.parentNode.removeChild(group.pinEl);
        }
      }
      groups = [];
      if (popup && popup.style.display !== "none") {
        cancelPopup();
      }
    }
  });

  window.addEventListener("resize", repositionAllPins);
  window.addEventListener("scroll", repositionAllPins, { capture: true, passive: true });

  // Unwind this instance so a fresh injection can take over cleanly. Never
  // calls stopPicking() — that ends in a sendMessage() that throws
  // synchronously once this instance's chrome.runtime is dead.
  function teardown() {
    try {
      picking = false;
      hovered = null;
      frozen = null;
      document.removeEventListener("mousemove", onMouseMove, true);
      document.removeEventListener("wheel", onWheel, { capture: true });
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("click", onOutsideClick, true);
      window.removeEventListener("resize", repositionAllPins);
      window.removeEventListener("scroll", repositionAllPins, { capture: true });
      darkMedia.removeEventListener("change", onDarkMediaChange);

      for (const el of [overlay, label, popup, pinContainer]) {
        if (!el) continue;
        unTopLayer(el);
        if (el.parentNode) el.parentNode.removeChild(el);
      }
      const fontStyle = document.getElementById("__fbp-font-face");
      if (fontStyle && fontStyle.parentNode) fontStyle.parentNode.removeChild(fontStyle);

      window.__fbpInjected = false;
      window.__fbpStartPicking = null;
      window.__fbpTeardown = null;
    } catch {}
  }

  window.__fbpStartPicking = startPicking;
  window.__fbpTeardown = teardown;
})();
