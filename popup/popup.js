document.addEventListener('DOMContentLoaded', () => {
    const peopleToggle = document.getElementById('peoplePlusToggle');
    const staffToggle = document.getElementById('staffPlusToggle');
    const clearCacheLink = document.getElementById('clearCacheLink');

    // Load the saved settings. Both modules are enabled by default.
    chrome.storage.sync.get({
        peoplePlusEnabled: true,
        staffPlusEnabled: true
    }, (items) => {
        peopleToggle.checked = items.peoplePlusEnabled;
        staffToggle.checked = items.staffPlusEnabled;
    });

    // Save the state when the People+ toggle is changed.
    peopleToggle.addEventListener('change', () => {
        chrome.storage.sync.set({ peoplePlusEnabled: peopleToggle.checked });
    });

    // Save the state when the Staff+ toggle is changed.
    staffToggle.addEventListener('change', () => {
        chrome.storage.sync.set({ staffPlusEnabled: staffToggle.checked });
    });

    // Add event listener for the clear cache link
    clearCacheLink.addEventListener('click', (event) => {
        event.preventDefault(); // Prevent the link's default behavior

        // Find the active tab and send a message to clear the cache.
        // The content script on the anime page will receive this message.
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const activeTab = tabs[0];
            if (activeTab && activeTab.id) {
                chrome.tabs.sendMessage(activeTab.id, { action: "clearCacheAndReload" }, (response) => {
                    if (chrome.runtime.lastError) {
                        // This can happen if the content script isn't on the page (e.g., not a MAL anime page)
                        console.log('Error sending message:', chrome.runtime.lastError.message);
                        alert('Could not connect to the page. Please ensure you are on a MyAnimeList anime page and refresh it.');
                    } else if (response && response.success) {
                        window.close(); // Close the popup without an alert
                    } else {
                        alert('Failed to clear cache. The content script might not be active.');
                    }
                });
            } else {
                alert('Could not find an active tab to clear the cache for.');
            }
        });
    });
});