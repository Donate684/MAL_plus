// background.js

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Check if the message is a request to fetch data.
    if (request.action === "fetchUrl") {
        const url = request.url;
        console.log(`Background: Fetching URL: ${url}`);

        // Headers can be added conditionally if needed.
        const headers = new Headers();
        // Example: Add a User-Agent if the domain is not myanimelist.net
        if (!url.includes("myanimelist.net")) {
            headers.append('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36');
        }

        fetch(url, { headers: headers })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status} for ${url}`);
                }
                return response.text();
            })
            .then(htmlText => {
                sendResponse({ success: true, data: htmlText });
            })
            .catch(error => {
                console.error('Error in background.js during fetch:', error);
                sendResponse({ success: false, error: error.message });
            });

        // Return true to indicate that the response will be sent asynchronously.
        // This is crucial for the sendResponse callback to work correctly in an async chain.
        return true;
    }
});