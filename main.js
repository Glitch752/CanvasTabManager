// Add a listener for messages from the background script
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if(request.type == "updateTabs") {
        // Get the tabs
        chrome.storage.sync.get("tabs", function(data) {
            // Update the tabs
            updateTabs(data.tabs);
        });
    } else if(request.type === "askClass") {
        updateAskClass();
    }
});

function updateAskClass() {
    let askClassBody = document.getElementById("askClassBody");
    askClassBody.innerHTML = "";

    chrome.storage.sync.get("tabs", function(data) {
        let tabs = data.tabs;
        let classes = 0;
        askClassBody.appendChild(document.createRange().createContextualFragment(`
            <div class="ask-class-class"><h1>No class</h1></div>
        `));
        let classElement = askClassBody.querySelectorAll(".ask-class-class")[0];
        classElement.addEventListener("click", function() {
            // Close the ask class window
            document.getElementById("askClass").classList.remove("open");
        });

        for(let category = 0; category < tabs.length; category++) {
            let categoryData = tabs[category];
            if(categoryData.class) {
                askClassBody.appendChild(document.createRange().createContextualFragment(`
                    <div class="ask-class-class"><h1>${categoryData.name}</h1><span class="class">${categoryData.class.code}</span></div>
                `));
                let classElement = askClassBody.querySelectorAll(".ask-class-class")[classes + 1];
                classElement.addEventListener("click", function() {
                    // Move the last element of the first category into the category that was clicked
                    let lastGroup = tabs[0].groups.pop();
                    if(!lastGroup) return;

                    tabs[category].groups.push(lastGroup);

                    // Save the tabs
                    chrome.storage.sync.set({tabs: tabs}, function() {
                        // Close the ask class window
                        document.getElementById("askClass").classList.remove("open");

                        updateTabs(tabs);
                    });
                });
                classes++;
            }
        }
    });
    
    document.getElementById("askClass").classList.add("open");
}

function updateTabs(tabs) {
    let tabsElement = document.getElementById("tabs");
    tabsElement.innerHTML = "";
    
    for(let category = 0; category < tabs.length; category++) {
        let groups = tabs[category].groups;
        tabsElement.appendChild(document.createRange().createContextualFragment(`<div class="category" data-index="${category}">${category === 0 ? `<h1><span>Uncategorized</span></h1>` : `
            <h1>${tabs[category].name}${tabs[category].class && tabs[category].class.code !== tabs[category].name ? `<span>${tabs[category].class.code}</span>` : ""}</h1>
        `}${groups.length === 0 ? `<div class="noTabs">No tabs in category. Drag a set of tabs to move them here.</div>` : ""}</div>`));

        let categoryElement = tabsElement.querySelectorAll(".category")[category];
        for(let group = 0; group < groups.length; group++) {
            let addedHTML = `<div class="tabGroup" data-index=${group}><input type="text" value="${groups[group].name}" /><div class="tabList">`;
            for(let groupId in groups[group].groups) {
                let groupData = groups[group].groups[groupId];
                addedHTML += `<div class="groupColor ${groupData.color}">`
                for(let tab = 0; tab < groupData.tabs.length; tab++) {
                    addedHTML += `<img src="chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(groupData.tabs[tab])}&size=64" />`;
                }
                addedHTML += `<div class="groupColorHover">`;

                if(groupData.color !== "none") {
                    addedHTML += `<h1>${groupData.name}</h1>`;
                }
                for(let tab = 0; tab < groupData.tabs.length; tab++) {
                    addedHTML += `<div class="groupColorPage">
                        <img src="chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(groupData.tabs[tab])}&size=64" />
                        <a href="${groupData.tabs[tab]}" target="_blank">${groupData.tabs[tab]}</a>
                    </div>`;
                }

                addedHTML += `<button class="button load loadCategory" data-group=${groupId}>Load</button></div></div>`;
            }
            addedHTML += `</div><div class="buttons">
                <button class="load button">Load</button>
                <button class="close button">X</button>
            </div></div>`;
            categoryElement.appendChild(document.createRange().createContextualFragment(addedHTML));
            
            let tabGroup = categoryElement.querySelectorAll(".tabGroup")[group];

            let loadButtons = tabGroup.querySelectorAll(".load.loadCategory");
            for(let i = 0; i < loadButtons.length; i++) {
                loadButtons[i].addEventListener("click", function() {
                    loadTabs(group, category, loadButtons[i].dataset.group);
                });
            }

            // Drag and drop
            tabGroup.draggable = true;
            tabGroup.addEventListener("dragstart", function(event) {
                event.dataTransfer.setData("group", group);
                event.dataTransfer.setData("category", category);
            });

            // Add listeners to the buttons
            let buttons = categoryElement.querySelectorAll(".buttons")[group];
            buttons.querySelectorAll(".load")[0].addEventListener("click", function() {
                loadTabs(group, category);
            });
            buttons.querySelectorAll(".close")[0].addEventListener("click", function() {
                deleteTabGroup(group, category);
            });

            // Add a listener to the text box
            let textBox = categoryElement.querySelectorAll("input")[group];
            textBox.addEventListener("change", function() {
                changeTabGroupName(group, category, textBox.value);
            });
        }

        // Listeners for drag and drop
        categoryElement.addEventListener("dragover", function(event) {
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
        });
        categoryElement.addEventListener("drop", function(event) {
            event.preventDefault();
            let newCategory = event.target.closest(".category");
            let newGroup = event.target.closest(".tabGroup");
            if(newCategory) {
                // Get the category and group index
                let newCategoryIndex = newCategory.dataset.index;
                let newGroupIndex = newGroup?.dataset?.index ?? -1;

                let group = event.dataTransfer.getData("group");
                let category = event.dataTransfer.getData("category");

                // Send a message to the background script to move the tab group
                chrome.runtime.sendMessage({type: "moveTabGroup", from: {category: category, group: group}, to: {category: newCategoryIndex, group: newGroupIndex}});
            }
        });
    }
}

function loadTabs(index, category, group = null) {
    if(group !== null) {
        // Send a message to the background script to load the tabs
        chrome.runtime.sendMessage({type: "loadTabsGroup", loadTabs: index, category: category, group: group});
    } else {
        // Send a message to the background script to load the tabs
        chrome.runtime.sendMessage({type: "loadTabs", loadTabs: index, category: category});
    }
}
function deleteTabGroup(index, category) {
    // Send a message to the background script to delete the tab group
    chrome.runtime.sendMessage({type: "deleteTabGroup", deleteTabGroup: index, category: category});
}
function changeTabGroupName(index, category, name) {
    // Send a message to the background script to change the tab group name
    chrome.runtime.sendMessage({type: "changeTabGroupName", changeTabGroupName: index, name: name, category: category});
}

window.onload = function() {
    // Send a message to the background script to get the tabs
    chrome.storage.sync.get("tabs", function(data) {
        // Update the tabs
        updateTabs(data.tabs);
    });

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
    document.querySelector(".button.export").addEventListener("click", function() {
        // Export the tabs
        chrome.storage.sync.get("tabs", function(data) {
            let tabs = data.tabs;

            let exportData = JSON.stringify(tabs);

            let a = document.createElement("a");
            a.href = "data:application/octet-stream," + encodeURIComponent(exportData);
            a.download = "tabs.json";
            a.click();
        });  
    });
    document.querySelector(".button.import").addEventListener("click", function() {
        // Import the tabs
        let fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = ".json";
        fileInput.addEventListener("change", function() {
            let file = fileInput.files[0];
            let reader = new FileReader();
            reader.onload = function() {
                let tabs = JSON.parse(reader.result);
                
                // Set the tabs
                chrome.storage.sync.set({tabs: tabs}, function() {
                    // Update the tabs
                    updateTabs(tabs);
                });
            };
            reader.readAsText(file);
        });
        fileInput.click();
    });

    document.querySelector(".button.close-settings").addEventListener("click", function() {
        // Close the settings page
        document.getElementById("settings").classList.toggle("open");   
    });
    document.querySelector(".button.close-ask-class").addEventListener("click", function() {
        // Close the ask class page
        document.getElementById("askClass").classList.toggle("open");
    });

    chrome.storage.sync.get("settings", function(data) {
        let settings = data.settings;

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
            changeSetting("linkToCanvas", "domain", this.value);
        });
        linkToCanvasDomain.value = settings.linkToCanvas.domain;

        let linkToCanvasToken = document.querySelector("#settings #canvasToken");
        linkToCanvasToken.addEventListener("input", function() {
            changeSetting("linkToCanvas", "token", this.value);
        });
        linkToCanvasToken.value = settings.linkToCanvas.token;

        let linkToCanvasAskClass = document.querySelector("#settings #bringInTabs");
        linkToCanvasAskClass.addEventListener("change", function() {
            changeSetting("linkToCanvas", "bringInTabs", this.value);
        });
        linkToCanvasAskClass.value = settings.linkToCanvas.bringInTabs;

        let openOnStartup = document.querySelector("#settings #openOnStartup");
        openOnStartup.addEventListener("change", function() {
            changeSetting("extension", "openOnStartup", this.checked);
        });
        openOnStartup.checked = settings.extension.openOnStartup;

        let clickIcon = document.querySelector("#settings #clickExtensionIcon");
        clickIcon.addEventListener("change", function() {
            changeSetting("extension", "clickIcon", this.value);
        });
        clickIcon.value = settings.extension.clickIcon;

        let newTabPage = document.querySelector("#settings #newTabPage");
        newTabPage.addEventListener("change", function() {
            changeSetting("newTabPage", "enabled", this.checked);
        });
        newTabPage.checked = settings.newTabPage.enabled;
    });
}