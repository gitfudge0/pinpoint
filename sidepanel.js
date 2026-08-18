(() => {
  const listEl = document.getElementById("list");
  const emptyEl = document.getElementById("empty");
  const statusEl = document.getElementById("status");
  const copyBtn = document.getElementById("copy-btn");
  const clearBtn = document.getElementById("clear-btn");
  const fallbackEl = document.getElementById("fallback");

  function iconSpan(svg) {
    const span = document.createElement("span");
    span.className = "fbp-icon";
    span.style.cssText = "display:inline-flex;align-items:center;justify-content:center;flex-shrink:0";
    span.innerHTML = svg;
    return span;
  }

  const ICON_COPY = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  const ICON_TRASH = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';
  const ICON_X = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

  copyBtn.style.cssText += ";display:inline-flex;align-items:center;justify-content:center;gap:6px;";
  clearBtn.style.cssText += ";display:inline-flex;align-items:center;justify-content:center;gap:6px;";
  copyBtn.innerHTML = "";
  copyBtn.appendChild(iconSpan(ICON_COPY));
  const copyLabelNode = document.createTextNode("Copy");
  copyBtn.appendChild(copyLabelNode);
  clearBtn.innerHTML = "";
  clearBtn.appendChild(iconSpan(ICON_TRASH));
  clearBtn.appendChild(document.createTextNode("Clear all"));

  /** @type {Array<{selector:string, tag:string, id:string, classes:string[], textSnippet:string, comment:string, url:string}>} */
  let annotations = [];

  function render() {
    listEl.querySelectorAll(".fbp-item").forEach((n) => n.remove());
    emptyEl.style.display = annotations.length ? "none" : "block";

    annotations.forEach((a, i) => {
      const item = document.createElement("div");
      item.className = "fbp-item";

      const head = document.createElement("div");
      head.className = "fbp-item-head";

      const labelSpan = document.createElement("span");
      labelSpan.className = "fbp-item-label";
      labelSpan.textContent = `${i + 1}. ${elementLabel(a)}`;

      const delBtn = document.createElement("button");
      delBtn.className = "fbp-item-delete";
      delBtn.style.cssText += ";display:inline-flex;align-items:center;justify-content:center;";
      delBtn.innerHTML = ICON_X;
      delBtn.addEventListener("click", () => {
        const removedCommentId = a.commentId;
        annotations.splice(i, 1);
        render();
        if (removedCommentId !== undefined) {
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs && tabs[0];
            if (!tab || tab.id == null) return;
            chrome.tabs.sendMessage(tab.id, { type: "remove-comment", id: removedCommentId }).catch(() => {});
          });
        }
      });

      head.appendChild(labelSpan);
      head.appendChild(delBtn);
      item.appendChild(head);

      if (a.textSnippet) {
        const textDiv = document.createElement("div");
        textDiv.className = "fbp-item-text";
        textDiv.textContent = `"${a.textSnippet}"`;
        item.appendChild(textDiv);
      }

      const commentDiv = document.createElement("div");
      commentDiv.className = "fbp-item-comment";
      commentDiv.textContent = a.comment;
      item.appendChild(commentDiv);

      listEl.appendChild(item);
    });
  }

  function elementLabel(a) {
    let s = a.tag;
    if (a.id) s += `#${a.id}`;
    if (a.classes && a.classes.length) s += "." + a.classes.join(".");
    return s;
  }

  function markdownItemHead(a) {
    let attrs = "";
    if (a.id) attrs += ` id="${a.id}"`;
    if (a.classes && a.classes.length) attrs += ` class="${a.classes.join(" ")}"`;
    return `<${a.tag}${attrs}> "${a.textSnippet}"`;
  }

  function buildMarkdown() {
    const url = annotations.length ? annotations[0].url : location.href;
    const date = new Date().toLocaleDateString("en-CA"); // local YYYY-MM-DD
    let md = `## UI Feedback — ${url} (${date})\n`;
    annotations.forEach((a, i) => {
      md += `\n### ${i + 1}. ${markdownItemHead(a)}\n`;
      md += `- Selector: ${a.selector}\n`;
      md += `- Text: "${a.textSnippet}"\n`;
      md += `- Comment: ${a.comment}\n`;
    });
    return md;
  }

  copyBtn.addEventListener("click", async () => {
    const md = buildMarkdown();
    try {
      await navigator.clipboard.writeText(md);
      fallbackEl.style.display = "none";
      copyLabelNode.textContent = "Copied ✓";
      setTimeout(() => {
        copyLabelNode.textContent = "Copy";
      }, 1500);
    } catch (err) {
      fallbackEl.value = md;
      fallbackEl.style.display = "block";
    }
  });

  clearBtn.addEventListener("click", () => {
    annotations = [];
    render();
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs && tabs[0];
      if (!tab || tab.id == null) return;
      chrome.tabs.sendMessage(tab.id, { type: "clear-annotations" }).catch(() => {});
    });
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg) return;
    if (msg.type === "annotation") {
      annotations.push(msg.data);
      render();
    } else if (msg.type === "restricted-page") {
      statusEl.style.display = "block";
    }
  });

  render();
})();
