// Firefox-only, prepended to background.js by `npm run build:firefox`.

// RoValra rebuilds its context-menu items on right mousedown (removeAll, then
// async create). Firefox snapshots the menu when it opens and ignores items
// created afterwards unless menus.refresh() is called, so refresh after every
// change; refresh() is a no-op when no menu is open.
if (chrome.contextMenus && globalThis.browser?.menus?.refresh) {
    let refreshQueued = false;
    const queueRefresh = () => {
        if (refreshQueued) return;
        refreshQueued = true;
        setTimeout(() => {
            refreshQueued = false;
            browser.menus.refresh().catch(() => {});
        }, 0);
    };
    for (const method of ['create', 'update', 'remove', 'removeAll']) {
        const original = chrome.contextMenus[method].bind(chrome.contextMenus);
        chrome.contextMenus[method] = (...args) => {
            const result = original(...args);
            queueRefresh();
            return result;
        };
    }
}

// Performs the cross-origin fetches relayed from firefox/content-shim.js.
chrome.runtime.onMessage.addListener((request) => {
    if (request?.action !== 'rovalraFirefoxFetch') return undefined;
    return (async () => {
        try {
            const response = await fetch(request.url, {
                method: request.method,
                headers: request.headers,
                body: request.body ?? undefined,
                // relayed URLs are never same-origin, so only 'include' sends cookies
                credentials: request.credentials === 'include' ? 'include' : 'omit',
                cache: request.cache,
            });
            const headers = {};
            response.headers.forEach((value, key) => (headers[key] = value));
            return {
                status: response.status,
                statusText: response.statusText,
                headers,
                url: response.url,
                redirected: response.redirected,
                body: await response.arrayBuffer(),
            };
        } catch (e) {
            return { error: String(e) };
        }
    })();
});
