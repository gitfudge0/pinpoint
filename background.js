chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;

  await chrome.sidePanel.open({ tabId: tab.id });

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
});
