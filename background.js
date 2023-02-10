let extensionID = chrome.runtime.id;

chrome.browserAction.onClicked.addListener(function(tab) {
    // Open the extension page
    chrome.tabs.create({url: "/index.html"});
    // Get the current tabs
    chrome.tabs.query({}, function(tabs) {
        let urls = [];
        for (let i = 0; i < tabs.length; i++) {
            // Don't save the extension page
            if (tabs[i].url.startsWith("chrome-extension://" + extensionID) || !tabs[i].url) continue;

            urls.push(tabs[i].url);

            // Close the tab
            chrome.tabs.remove(tabs[i].id);
        }

        getTabs(function(tabs) {
            if(!tabs) tabs = [];
            tabs.push(urls);

            // Save the tabs
            saveTabs(tabs, function() {
                // Send a message to the extension page to update the tabs
                chrome.runtime.sendMessage({type: "updateTabs", tabs: tabs});
            });
        });
    });
});  

// Handle messages from the extension page
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.type == "loadTabs") {
        let index = request.loadTabs;
        getTabs(function(tabs) {
            if(!tabs || !tabs[index]) return;

            // Open the tabs
            for (let i = 0; i < tabs[index].length; i++) {
                chrome.tabs.create({url: tabs[index][i]});
            }
        });
    } else if (request.type == "updateTabs") {
        getTabs(function(tabs) {
            // Send a message to the extension page to update the tabs
            chrome.runtime.sendMessage({type: "updateTabs", tabs: tabs});
        });
    }
});

function saveTabs(tabs, callback) {
    // Save the tabs to storage
    chrome.storage.sync.set({tabs: tabs}, function() {
        if(callback) callback();
    });
}

function getTabs(callback) {
    // Get the tabs from storage
    chrome.storage.sync.get("tabs", function(data) {
        if(callback) callback(data.tabs);
    });
}