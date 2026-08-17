(() => {
  if (window.__fbpInjected) {
    // Already injected — just (re)start picking mode.
    window.__fbpStartPicking && window.__fbpStartPicking();
    return;
  }
  window.__fbpInjected = true;

  let picking = false;
  let hovered = null;
  let descentStack = []; // elements walked past while going up, for ArrowDown/scroll-down to return to
  let frozen = null; // element frozen for the comment popup
  let overlay = null;
  let label = null;
  let popup = null;

  function ensureOverlay() {
    if (overlay) return;
    overlay = document.createElement("div");
    overlay.className = "fbp-overlay";
    label = document.createElement("div");
    label.className = "fbp-label";
    document.documentElement.appendChild(overlay);
    document.documentElement.appendChild(label);
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
  }

  function hideOverlay() {
    if (overlay) overlay.style.display = "none";
    if (label) label.style.display = "none";
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

  function showPopup(el) {
    ensurePopup();
    const rect = el.getBoundingClientRect();
    popup.style.display = "block";
    popup.querySelector("textarea").value = "";

    // Measure then position, flipping to stay in viewport.
    const popupRect = popup.getBoundingClientRect();
    let top = rect.bottom + 8;
    if (top + popupRect.height > window.innerHeight) {
      top = rect.top - popupRect.height - 8;
      if (top < 0) top = Math.max(0, window.innerHeight - popupRect.height - 8);
    }
    let left = rect.left;
    if (left + popupRect.width > window.innerWidth) {
      left = Math.max(0, window.innerWidth - popupRect.width - 8);
    }
    popup.style.top = `${top}px`;
    popup.style.left = `${left}px`;

    popup.querySelector("textarea").focus();
  }

  function hidePopup() {
    if (popup) popup.style.display = "none";
  }

  function ensurePopup() {
    if (popup) return;
    popup = document.createElement("div");
    popup.className = "fbp-popup";
    popup.innerHTML = `
      <textarea class="fbp-textarea" placeholder="Comment..."></textarea>
      <div class="fbp-popup-actions">
        <button type="button" class="fbp-btn fbp-btn-cancel">Cancel</button>
        <button type="button" class="fbp-btn fbp-btn-save">Save</button>
      </div>
    `;
    document.documentElement.appendChild(popup);

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
  }

  function saveAnnotation() {
    if (!frozen) return;
    const comment = popup.querySelector("textarea").value.trim();
    const { tag, id, classes } = describe(frozen);
    chrome.runtime
      .sendMessage({
        type: "annotation",
        data: {
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
    cancelPopup();
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
    showPopup(frozen);
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
    }
  });

  window.__fbpStartPicking = startPicking;
})();
