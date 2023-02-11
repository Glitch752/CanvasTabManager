let extensionID = chrome.runtime.id;

chrome.action.onClicked.addListener(function(tab) {
    bringInTabs();
});

chrome.runtime.onStartup.addListener(function() {
    chrome.storage.sync.get("hasRunBefore", function(data) {
        if(!data.hasRunBefore) {
            chrome.storage.sync.set({hasRunBefore: true});
            startIntro();
        } else {
            chrome.storage.sync.get("openOnStartup", function(data) {
                if(data.openOnStartup) {
                    chrome.tabs.create({url: "/index.html"});
                }
            });
        }
    });
});

// Handle messages from the extension page
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    switch(request.type) {
        case "loadTabs": {
            let index = request.loadTabs;
            getTabs(function(tabs) {
                if(!tabs || !tabs[index]) return;

                for(let group in tabs[index].groups) {
                    let groupData = tabs[index].groups[group];

                    let openedTabIds = [];

                    for(let j = 0; j < groupData.tabs.length; j++) {
                        chrome.tabs.create({url: groupData.tabs[j]}, function(tab) {
                            openedTabIds.push(tab.id);

                            if(openedTabIds.length == groupData.tabs.length) {
                                // Check if this is a real group or the ungrouped tabs
                                if(parseInt(group) !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
                                    // Grouped tabs
                                    chrome.tabs.group({
                                        tabIds: openedTabIds
                                    }, function(groupId) {
                                        chrome.tabGroups.update(groupId, {
                                            title: groupData.name,
                                            color: groupData.color,
                                            collapsed: groupData.collapsed
                                        });
                                    });
                                }
                            }
                        });
                    }
                }
            });
            break;
        }
        case "updateTabs": {
            getTabs(function(tabs) {
                // Send a message to the extension page to update the tabs
                chrome.runtime.sendMessage({type: "updateTabs", tabs: tabs});
            });
            break;
        }
        case "deleteTabGroup": {
            let index = request.deleteTabGroup;
            getTabs(function(tabs) {
                if(!tabs || !tabs[index]) return;

                tabs.splice(index, 1);

                // Save the tabs
                saveTabs(tabs, function() {
                    // Send a message to the extension page to update the tabs
                    chrome.runtime.sendMessage({type: "updateTabs", tabs: tabs});
                });
            });
            break;
        }
        case "changeTabGroupName": {
            let index = request.changeTabGroupName;
            let name = request.name;
            getTabs(function(tabs) {
                if(!tabs || !tabs[index]) return;

                tabs[index].name = name;

                // Save the tabs
                saveTabs(tabs, function() {
                    // Send a message to the extension page to update the tabs
                    chrome.runtime.sendMessage({type: "updateTabs", tabs: tabs});
                });
            });
            break;
        }
        case "saveTabs": {
            bringInTabs();
            break;
        }
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

function bringInTabs() {
    // Get the current tabs
    chrome.tabs.query({}, function(tabs) {
        if(!tabs.find(tab => tab.url.startsWith("chrome-extension://" + extensionID))) {
            // Open the extension page if it isn't already open
            chrome.tabs.create({url: "/index.html"});
        }

        // Keys are group ids, values are an object with the properties:
        //   tabs (an array of tab urls)
        //   name (the name of the group)
        //   color (the color of the group)
        //   collapsed (whether the group is collapsed)

        let urls = {}; 
        for (let i = 0; i < tabs.length; i++) {
            // Don't save the extension page
            if (tabs[i].url.startsWith("chrome-extension://" + extensionID) || !tabs[i].url) continue;

            if(!urls[tabs[i].groupId]) {
                urls[tabs[i].groupId] = {tabs: [], name: "Group " + tabs[i].groupId, color: "none", collapsed: false};
                if(tabs[i].groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
                    chrome.tabGroups.get(tabs[i].groupId, function(group) {
                        urls[tabs[i].groupId].name = group.title;
                        urls[tabs[i].groupId].color = group.color;
                        urls[tabs[i].groupId].collapsed = group.collapsed;
                    });
                }
            }
            urls[tabs[i].groupId].tabs.push(tabs[i].url);

            // Close the tab
            chrome.tabs.remove(tabs[i].id);
        }

        getTabs(function(tabs) {
            if(!tabs) tabs = [];
            tabs.push({
                groups: urls,
                name: "Science"
            });

            // Save the tabs
            saveTabs(tabs, function() {
                // Send a message to the extension page to update the tabs
                chrome.runtime.sendMessage({type: "updateTabs", tabs: tabs});
            });
        });
    });
}