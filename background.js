let extensionID = chrome.runtime.id;

chrome.action.onClicked.addListener(function(tab) {
    chrome.storage.sync.get("settings", function(data) {
        if(data.settings?.extension?.clickIcon === "bringInTabs") {
            bringInTabs();
        } else {
            chrome.tabs.create({url: "/index.html"});
        }
    });
});

chrome.runtime.onStartup.addListener(function() {
    chrome.storage.sync.get("settings", function(data) {
        if(data.settings?.extension?.openOnStartup) {
            chrome.tabs.create({url: "/index.html"});
        }

        if(data.settings?.linkToCanvas?.enabled) {
            addRequestListener();
            updateClasses();
        }
    });
});

// On install
chrome.runtime.onInstalled.addListener(function() {
    startIntro();
    addRequestListener();
    
    chrome.storage.sync.get("settings", function(data) {
        let settings = data.settings;
        if(!settings) {
            settings = {
                linkToCanvas: {
                    enabled: false,
                    domain: null,
                    token: null,
                    bringInTabs: "askClass"
                },
                extension: {
                    openOnStartup: false,
                    clickIcon: "bringInTabs"
                }
            };

            chrome.storage.sync.set({settings: settings});
        }

        if(settings?.linkToCanvas?.enabled) {
            updateClasses(false);
        }
    });
});

let listenerAdded = false;
let generatedToken = false;

function addRequestListener() {
    if(listenerAdded) return;
    listenerAdded = true;

    // Handling for grabbing canvas API keys so we can get classes.
    chrome.webRequest.onBeforeSendHeaders.addListener((data) => {
        let url = data.url;
        // If we are on a .instructure.com page
        if(url.match(/https:\/\/.*\.instructure\.com\/.*/)) {
			for(let i = 0; i < data.requestHeaders.length; i++) {
                let header = data.requestHeaders[i];
				if (header.name === 'X-CSRF-Token' && header.value !== undefined) {
					chrome.storage.sync.get("settings", function(data) {
                        let settings = data.settings;

                        settings.linkToCanvas.browserToken = header.value;
                        if(!generatedToken && !settings.linkToCanvas.token) {
                            generateToken(header.value, url.split(".")[0].slice(8), settings);
                            generatedToken = true;
                        }
                        chrome.storage.sync.set({settings: settings});
                    });
				}
			}
        }
    }, {urls: ["<all_urls>"]}, ["requestHeaders"]);
}

function generateToken(token, domain, settings) {
    // Trickery mostly copied from CanvasTools
	var data = {
        "_method": "post",
        "access_token[expires_at]": "",
        "access_token[purpose]": "Canvas Tab Manager",
        "authenticity_token": token,
        "expires_at": "",
        "purpose": "Canvas Tab Manager",
        "utf8": ""
	};

    fetch(`https://${domain}.instructure.com/profile/tokens`, {
        "method": "POST",
        "mode": "no-cors",
        "headers": {
            "accept": "application/json, text/javascript, application/json+canvas-string-ids, */*; q=0.01",
            "x-csrf-token": token,
            "x-requested-with": "XMLHttpRequest",
            "content-type": "application/x-www-form-urlencoded",
            "accept-language": "en-US,en;q=0.9"
        },
        "body": Object.keys(data).map(function(key) {
            return encodeURIComponent(key) + '=' + encodeURIComponent(data[key])
        }).join('&')
	}).then(response => response.json()).then(response => {
        var token = response['visible_token'];
        settings.linkToCanvas.token = token;
        settings.linkToCanvas.tokenID = response['id'];
        settings.linkToCanvas.domain = domain;
        chrome.storage.sync.set({settings: settings}, function() {
            updateClasses();
        });
    });
}

function updateClasses(send = true) {
    chrome.storage.sync.get(["settings", "tabs"], function(data) {
        let settings = data.settings;
        if(!settings) return;

        if(settings.linkToCanvas.token) {
            fetch(`https://${settings.linkToCanvas.domain}.instructure.com/api/v1/courses?access_token=${settings.linkToCanvas.token}`).then(response => response.json()).then(response => {
                let classes = [];
                for(let i = 0; i < response.length; i++) {
                    let course = response[i];
                    classes.push({
                        id: course.id,
                        name: course.name,
                        code: course.course_code
                    });
                }
                let tabs = data.tabs;
                if(!tabs) tabs = [ { name: "", groups: [] }];
                if(tabs[0].class) tabs.unshift({ name: "", groups: [] });
                // Add classes to tabs that don't already exist
                for(let i = 0; i < tabs.length; i++) {
                    let tab = tabs[i];
                    let classID = tab.class?.id ?? null;
                    // If the class already exists, update it
                    let classData = classes.find(c => c.id === classID);
                    if(classData) {
                        tab.class = classData;
                        tab.name = classData.name;
                    } else {
                        // If the class doesn't exist and this once was a class category, remove it
                        if(tab.class) {
                            tabs.splice(i, 1);
                            i--;
                        }
                    }
                }

                // Add classes to tabs that don't already exist
                for(let i = 0; i < classes.length; i++) {
                    let classData = classes[i];
                    let classID = classData.id;
                    // If the class already exists, update it
                    let tab = tabs.find(t => t.class?.id === classID);
                    if(!tab) {
                        tabs.push({
                            class: classData,
                            groups: [],
                            name: classData.name
                        });
                    }
                }

                chrome.storage.sync.set({tabs: tabs}, function() {
                    if(send) chrome.runtime.sendMessage({type: "updateTabs"});
                });
            });
        }
    });
}

function startIntro() {
}

// Handle messages from the extension page
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    switch(request.type) {
        case "loadTabs": {
            let index = request.loadTabs;
            let category = request.category;
            getTabs(function(tabs) {
                if(!tabs?.[category]?.groups?.[index]) return;

                for(let group in tabs[category].groups[index].groups) {
                    let groupData = tabs[category].groups[index].groups[group];

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
        case "deleteTabGroup": {
            let index = request.deleteTabGroup;
            let category = request.category;
            getTabs(function(tabs) {
                if(!tabs?.[category]?.groups?.[index]) return;

                tabs[category].groups.splice(index, 1);

                // Save the tabs
                saveTabs(tabs, function() {
                    // Send a message to the extension page to update the tabs
                    chrome.runtime.sendMessage({type: "updateTabs"});
                });
            });
            break;
        }
        case "changeTabGroupName": {
            let index = request.changeTabGroupName;
            let name = request.name;
            getTabs(function(tabs) {
                if(!tabs?.[0]?.[index]) return;

                tabs[0].groups[index].name = name;

                // Save the tabs
                saveTabs(tabs, function() {
                    // Send a message to the extension page to update the tabs
                    chrome.runtime.sendMessage({type: "updateTabs"});
                });
            });
            break;
        }
        case "saveTabs": {
            bringInTabs();
            break;
        }
        case "addRequestListener": {
            addRequestListener();
            break;
        }
        case "moveTabGroup": {
            let fromCategory = request.from.category;
            let fromGroup = request.from.group;
            let toCategory = request.to.category;
            let toGroup = request.to.group;

            getTabs(function(tabs) {
                if(!tabs?.[fromCategory]?.groups?.[fromGroup]) return;
                if(toGroup === -1) {
                    if(!tabs?.[toCategory]) return;
                } else {
                    if(!tabs?.[toCategory]?.groups?.[toGroup]) return;
                }

                let tabGroup = tabs[fromCategory].groups[fromGroup];
                tabs[fromCategory].groups.splice(fromGroup, 1);
                if(toGroup === -1) tabs[toCategory].groups.push(tabGroup)
                else tabs[toCategory].groups.splice(toGroup, 0, tabGroup);

                // Save the tabs
                saveTabs(tabs, function() {
                    // Send a message to the extension page to update the tabs
                    chrome.runtime.sendMessage({type: "updateTabs"});
                });
            });
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

        chrome.storage.sync.get("settings", function(data) {
            let settings = data.settings;
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
                if(!tabs?.[0]?.groups) tabs = [{name: "", groups: []}]; // If there are no categories, add a default one for uncategorized tabs
                tabs[0].groups.push({
                    groups: urls,
                    name: "Tab group"
                });

                // Save the tabs
                saveTabs(tabs, function() {
                    // Check if we need to ask what category to put the tabs in
                    if(settings?.linkToCanvas?.enabled && settings?.linkToCanvas?.bringInTabs === "askClass") {
                        // Send a message to the extension page to ask what class to put the tabs in
                        chrome.runtime.sendMessage({type: "askClass"});
                    }

                    // Send a message to the extension page to update the tabs
                    chrome.runtime.sendMessage({type: "updateTabs"});
                });
            });
        });
    });
}