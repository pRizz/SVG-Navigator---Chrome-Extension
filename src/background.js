// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Called when a message is passed.  We assume that the content script
// wants to show the page action.
function onRequest(request, sender, sendResponse) {
    // Show the page action for the tab that the sender (content script) was on.
    if(request == "showIcon"){
        chrome.pageAction.show(sender.tab.id);
    }
    // return the localStorage when requested
	if(request == "localStorage"){
        sendResponse(localStorage);
	}
};

// Listen for the content script to send a message to the background page.
chrome.extension.onRequest.addListener(onRequest);