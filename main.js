// Add a listener for messages from the background script
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.type == "updateTabs") {
        // Get the tabs
        chrome.storage.sync.get("tabs", function(data) {
            // Update the tabs
            updateTabs(data.tabs);
        });
    }
});

function updateTabs(tabs) {
    let tabsElement = document.getElementById("tabs");
    tabsElement.innerHTML = "";
    for(let i = 0; i < tabs.length; i++) {
        let addedHTML = "";
        addedHTML  += `<div class="tabGroup"><input type="text" value="${tabs[i].name}" /><div class="tabList">`;
        for(let group in tabs[i].groups) {
            let groupData = tabs[i].groups[group];
            addedHTML += `<div class="groupColor ${groupData.color}">`
            for(let j = 0; j < groupData.tabs.length; j++) {
                addedHTML += `<img src="chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(groupData.tabs[j])}&size=64" />`;
            }
            addedHTML += `</div>`;
        }
        addedHTML += `</div><div class="buttons">
            <button class="load button">Load</button>
            <button class="close button">X</button>
        </div></div>`;
        tabsElement.appendChild(document.createRange().createContextualFragment(addedHTML));

        // Add listeners to the buttons
        let buttons = tabsElement.querySelectorAll(".buttons")[i];
        buttons.querySelectorAll(".load")[0].addEventListener("click", function() {
            loadTabs(i);
        });
        buttons.querySelectorAll(".close")[0].addEventListener("click", function() {
            deleteTabGroup(i);
        });

        // Add a listener to the text box
        let textBox = tabsElement.querySelectorAll("input")[i];
        textBox.addEventListener("change", function() {
            changeTabGroupName(i, textBox.value);
        });
    }
}

function loadTabs(index) {
    // Send a message to the background script to load the tabs
    chrome.runtime.sendMessage({type: "loadTabs", loadTabs: index});
}
function deleteTabGroup(index) {
    // Send a message to the background script to delete the tab group
    chrome.runtime.sendMessage({type: "deleteTabGroup", deleteTabGroup: index});
}
function changeTabGroupName(index, name) {
    // Send a message to the background script to change the tab group name
    chrome.runtime.sendMessage({type: "changeTabGroupName", changeTabGroupName: index, name: name});
}

window.onload = function() {
    // Send a message to the background script to get the tabs
    chrome.runtime.sendMessage({type: "updateTabs"});

    // Add button listeners
    document.querySelector(".button.bring-tabs").addEventListener("click", function() {
        // Send a message to the background script to save the tabs
        chrome.runtime.sendMessage({type: "saveTabs"});

        document.querySelector("#settings").classList.remove("open");
    });
    document.querySelector(".button.settings").addEventListener("click", function() {
        // Open the settings page
        document.getElementById("settings").classList.toggle("open");   
    });
    document.querySelector(".button.close-settings").addEventListener("click", function() {
        // Close the settings page
        document.getElementById("settings").classList.toggle("open");   
    });

    chrome.storage.sync.get("settings", function(data) {
        let settings = data.settings;
        if(!settings) {
            settings = {
                linkToCanvas: {
                    enabled: false,
                    domain: null,
                    token: null
                },
                extension: {
                    openOnStartup: false,
                    clickIcon: "bringInTabs"
                }
            };

            chrome.storage.sync.set({settings: settings});
        }

        function changeSetting(setting, key, value) {
            settings[setting][key] = value;
            chrome.storage.sync.set({settings: settings});
        }

        // Add listeners to settings and set the values
        let linkToCanvas = document.querySelector("#settings #linkToCanvas");
        linkToCanvas.addEventListener("change", function() {
            // If we don't have it, request the webRequest permission
            if(!settings.linkToCanvas.enabled) {
                // Check if we have the permission
                chrome.permissions.contains({
                    permissions: ["webRequest"],
                    origins: ["https://*.instructure.com/*"]
                }, function(result) {
                    if(result) {
                        // If we have the permission, change the setting
                        changeSetting("linkToCanvas", "enabled", true);
                        chrome.runtime.sendMessage({type: "addRequestListener"});
                    } else {
                        chrome.permissions.request({
                            permissions: ["webRequest"],
                            origins: ["https://*.instructure.com/*"]
                        }, function(granted) {
                            if(granted) {
                                // The user granted the permission, so change the setting. We don't need to check the checkbox because it's already checked.
                                changeSetting("linkToCanvas", "enabled", true);
                                chrome.runtime.sendMessage({type: "addRequestListener"});
                            } else {
                                // The user didn't grant the permission, so don't change the setting and uncheck the checkbox.
                                linkToCanvas.checked = false;
                                alert("You must enable the webRequest permission to use canvas linking. This is so we can access your account's courses.");
                            }
                        });
                    }
                });
            } else {
                // If we have it, change the setting
                changeSetting("linkToCanvas", "enabled", false);
            }
        });
        linkToCanvas.checked = settings.linkToCanvas.enabled;

        let linkToCanvasDomain = document.querySelector("#settings #canvasDomain");
        linkToCanvasDomain.addEventListener("input", function() {
            // Send a message to the background script to change the link to canvas domain setting
            changeSetting("linkToCanvas", "domain", this.value);
        });
        linkToCanvasDomain.value = settings.linkToCanvas.domain;

        let linkToCanvasToken = document.querySelector("#settings #canvasToken");
        linkToCanvasToken.addEventListener("input", function() {
            // Send a message to the background script to change the link to canvas token setting
            changeSetting("linkToCanvas", "token", this.value);
        });
        linkToCanvasToken.value = settings.linkToCanvas.token;

        let openOnStartup = document.querySelector("#settings #openOnStartup");
        openOnStartup.addEventListener("change", function() {
            // Send a message to the background script to change the open on startup setting
            changeSetting("extension", "openOnStartup", this.checked);
        });
        openOnStartup.checked = settings.extension.openOnStartup;

        let clickIcon = document.querySelector("#settings #clickExtensionIcon");
        clickIcon.addEventListener("change", function() {
            // Send a message to the background script to change the click icon setting
            changeSetting("extension", "clickIcon", this.value);
        });
        clickIcon.value = settings.extension.clickIcon;
    });
}