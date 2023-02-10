function loadTabs(index) {
    // Send a message to the background script to load the tabs
    chrome.runtime.sendMessage({type: "loadTabs", loadTabs: index});
}

// Add a listener for messages from the background script
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.type == "updateTabs") {
        console.log(request.tabs);
        // Update the tabs
        updateTabs(request.tabs);
    }
});

function updateTabs(tabs) {
    let tabsElement = document.getElementById("tabs");
    for(let i = 0; i < tabs.length; i++) {
        let addedHTML = "";
        addedHTML  += `<div class="tabGroup"><h1>${"Science"}</h1><div class="tabList">`;
        for(let j = 0; j < tabs[i].length; j++) {
            addedHTML += `<img src="chrome://favicon/${tabs[i][j]}" />`;
        }
        addedHTML += `</div><div class="buttons">
            <button class="load button" onclick="loadTabs(${i})">Load</button>
            <button class="close button" onclick="closeTabs(${i})">X</button>
        </div></div>`;
        tabsElement.innerHTML += addedHTML;
    }
}

window.onload = function() {
    // Send a message to the background script to get the tabs
    chrome.runtime.sendMessage({type: "updateTabs"});
}