function onRequest(request, sender, sendResponse) {
    if (request == "showIcon") {
        console.log("onRequest: showIcon");
        chrome.action.setIcon({ tabId: sender.tab.id, path: "icon.png" });
    }
}


chrome.runtime.onMessage.addListener(onRequest);
console.log("Service Worker Loaded");