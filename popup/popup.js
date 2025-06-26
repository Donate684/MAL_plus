document.addEventListener('DOMContentLoaded', () => {
    const peopleToggle = document.getElementById('peoplePlusToggle');
    const staffToggle = document.getElementById('staffPlusToggle');

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
});