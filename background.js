const pickingState = new Map();

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;

  chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});

  if (pickingState.get(tab.id)) {
    chrome.tabs.sendMessage(tab.id, { type: "stop-picking" }).catch(() => {});
    pickingState.set(tab.id, false);
    chrome.action.setIcon({tabId: tab.id, path: {16:"icons/icon16.png",32:"icons/icon32.png",48:"icons/icon48.png",128:"icons/icon128.png"}}).catch(()=>{});
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
  chrome.action.setIcon({tabId: tab.id, path: {16:"icons/icon-active16.png",32:"icons/icon-active32.png",48:"icons/icon-active48.png",128:"icons/icon-active128.png"}}).catch(()=>{});
});

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type === "stopped-picking" && sender.tab && sender.tab.id != null) {
    pickingState.set(sender.tab.id, false);
    chrome.action.setIcon({tabId: sender.tab.id, path: {16:"icons/icon16.png",32:"icons/icon32.png",48:"icons/icon48.png",128:"icons/icon128.png"}}).catch(()=>{});
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  pickingState.delete(tabId);
});

// Side panel holds a port open; when it closes, stop picking everywhere.
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "sidepanel") return;
  port.onDisconnect.addListener(() => {
    for (const [tabId, picking] of pickingState) {
      if (!picking) continue;
      chrome.tabs.sendMessage(tabId, { type: "stop-picking" }).catch(() => {});
      pickingState.set(tabId, false);
      chrome.action.setIcon({tabId, path: {16:"icons/icon16.png",32:"icons/icon32.png",48:"icons/icon48.png",128:"icons/icon128.png"}}).catch(()=>{});
    }
  });
});
