const pickingState = new Map();

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;

  chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});

  if (pickingState.get(tab.id)) {
    chrome.tabs.sendMessage(tab.id, { type: "stop-picking" }).catch(() => {});
    pickingState.set(tab.id, false);
    return;
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"],
    });
    await chrome.scripting.insertCSS({
      target: { tabId: tab.id },
      files: ["content.css"],
    });
  } catch (err) {
    // Restricted page (chrome://, Web Store, etc.) — tell the panel.
    chrome.runtime.sendMessage({ type: "restricted-page" }).catch(() => {});
    return;
  }

  chrome.tabs.sendMessage(tab.id, { type: "start-picking" }).catch(() => {
    chrome.runtime.sendMessage({ type: "restricted-page" }).catch(() => {});
  });
  pickingState.set(tab.id, true);
});

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type === "stopped-picking" && sender.tab && sender.tab.id != null) {
    pickingState.set(sender.tab.id, false);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  pickingState.delete(tabId);
});
