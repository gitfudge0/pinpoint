(() => {
  const listEl = document.getElementById("list");
  const emptyEl = document.getElementById("empty");
  const statusEl = document.getElementById("status");
  const copyBtn = document.getElementById("copy-btn");
  const clearBtn = document.getElementById("clear-btn");
  const fallbackEl = document.getElementById("fallback");

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
      delBtn.textContent = "✕";
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
      const original = copyBtn.textContent;
      copyBtn.textContent = "Copied ✓";
      setTimeout(() => {
        copyBtn.textContent = original;
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
