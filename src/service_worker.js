function onRequest(request, sender) {
    if (request === 'showIcon') {
        chrome.action.setIcon({ tabId: sender.tab.id, path: 'icon.png' });
    }
}

chrome.runtime.onMessage.addListener(onRequest);
