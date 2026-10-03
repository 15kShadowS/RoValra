// Firefox-only, prepended to background.js by `npm run build:firefox`.
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
