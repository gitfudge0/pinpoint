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

  /** @type {Array<{groupId:number, selector:string, tag:string, id:string, classes:string[], textSnippet:string, url:string, comments:Array<{commentId:number, comment:string}>}>} */
  let groups = [];

  function removeComment(group, commentId) {
    const idx = group.comments.findIndex((c) => c.commentId === commentId);
    if (idx === -1) return;
    group.comments.splice(idx, 1);
    if (group.comments.length === 0) {
      const gIdx = groups.indexOf(group);
      if (gIdx !== -1) groups.splice(gIdx, 1);
    }
    render();
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs && tabs[0];
      if (!tab || tab.id == null) return;
      chrome.tabs.sendMessage(tab.id, { type: "remove-comment", id: commentId }).catch(() => {});
    });
  }

  function focusGroup(group) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs && tabs[0];
      if (!tab || tab.id == null) return;
      chrome.tabs.sendMessage(tab.id, { type: "focus-group", groupId: group.groupId }).catch(() => {});
    });
  }

  function render() {
    listEl.querySelectorAll(".fbp-item").forEach((n) => n.remove());
    emptyEl.style.display = groups.length ? "none" : "block";

    groups.forEach((g, i) => {
      const item = document.createElement("div");
      item.className = "fbp-item";
      item.addEventListener("click", (e) => {
        if (e.target.closest(".fbp-item-delete") || e.target.closest(".fbp-subitem-delete")) return;
        focusGroup(g);
      });

      const head = document.createElement("div");
      head.className = "fbp-item-head";

      const labelSpan = document.createElement("span");
      labelSpan.className = "fbp-item-label";
      labelSpan.textContent = `${i + 1}. ${elementLabel(g)}`;

      head.appendChild(labelSpan);
      item.appendChild(head);

      if (g.textSnippet) {
        const textDiv = document.createElement("div");
        textDiv.className = "fbp-item-text";
        textDiv.textContent = `"${g.textSnippet}"`;
        item.appendChild(textDiv);
      }

      const subList = document.createElement("div");
      subList.className = "fbp-subitem-list";
      g.comments.forEach((c, j) => {
        const subItem = document.createElement("div");
        subItem.className = "fbp-subitem";

        const subLabel = document.createElement("span");
        subLabel.className = "fbp-subitem-comment";
        subLabel.textContent = `${j + 1}. ${c.comment}`;

        const subDelBtn = document.createElement("button");
        subDelBtn.className = "fbp-subitem-delete";
        subDelBtn.style.cssText += ";display:inline-flex;align-items:center;justify-content:center;";
        subDelBtn.innerHTML = ICON_X;
        subDelBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          removeComment(g, c.commentId);
        });

        subItem.appendChild(subLabel);
        subItem.appendChild(subDelBtn);
        subList.appendChild(subItem);
      });
      item.appendChild(subList);

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
    const url = groups.length ? groups[0].url : location.href;
    const date = new Date().toLocaleDateString("en-CA"); // local YYYY-MM-DD
    let md = `## UI Feedback — ${url} (${date})\n`;
    groups.forEach((g, i) => {
      md += `\n### ${i + 1}. ${markdownItemHead(g)}\n`;
      md += `- Selector: ${g.selector}\n`;
      md += `- Text: "${g.textSnippet}"\n`;
      md += `- Comments:\n`;
      g.comments.forEach((c, j) => {
        md += `  ${j + 1}. ${c.comment}\n`;
      });
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
    groups = [];
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
      const data = msg.data;
      let group = groups.find((g) => g.groupId === data.groupId);
      if (group) {
        group.comments.push({ commentId: data.commentId, comment: data.comment });
      } else {
        group = {
          groupId: data.groupId,
          selector: data.selector,
          tag: data.tag,
          id: data.id,
          classes: data.classes,
          textSnippet: data.textSnippet,
          url: data.url,
          comments: [{ commentId: data.commentId, comment: data.comment }],
        };
        groups.push(group);
      }
      render();
    } else if (msg.type === "restricted-page") {
      statusEl.style.display = "block";
    }
  });

  render();
})();
