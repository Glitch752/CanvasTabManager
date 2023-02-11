// Add a listener for messages from the background script
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.type == "updateTabs") {
        // Update the tabs
        updateTabs(request.tabs);
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
    });
    document.querySelector(".button.settings").addEventListener("click", function() {
        // Open the settings page
        document.getElementById("settings").style.display = "block";       
    });
}