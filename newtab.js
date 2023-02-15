// Add a listener for messages from the background script
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if(request.type == "updateTabs") {
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

window.onload = function() {
    // Send a message to the background script to get the tabs
    chrome.storage.sync.get("tabs", function(data) {
        // Update the tabs
        updateTabs(data.tabs);
    });
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