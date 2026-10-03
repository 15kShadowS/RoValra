// Firefox-only, prepended to content.js by `npm run build:firefox`.
(() => {
    if (typeof cloneInto !== 'function') return;

    // Firefox applies the page CSP (and origin-less CORS) to content-script
    // fetches, so requests to anything but *.roblox.com are relayed through the
    // background script, which has host permissions and no page CSP.
    const nativeFetch = globalThis.fetch.bind(globalThis);
    const NULL_BODY_STATUS = [101, 204, 205, 304];

    const shouldRelay = (url) => {
        if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
        return !(url.hostname === 'roblox.com' || url.hostname.endsWith('.roblox.com'));
    };

    const toPlainHeaders = (headers) => {
        const result = {};
        if (!headers) return result;
        if (typeof headers.forEach === 'function' && !Array.isArray(headers)) {
            headers.forEach((value, key) => (result[key] = value));
        } else if (Array.isArray(headers)) {
            for (const [key, value] of headers) result[key] = value;
        } else {
            Object.assign(result, headers);
        }
        return result;
    };

    const relayFetch = async (input, init = {}) => {
        const isRequest = input instanceof Request;
        const url = new URL(isRequest ? input.url : String(input), location.href);
        const body = init.body ?? null;
        if (
            !shouldRelay(url) ||
            (isRequest && init.body === undefined && input.method !== 'GET' && input.method !== 'HEAD') ||
            (body !== null && typeof body !== 'string' && !(body instanceof ArrayBuffer) && !ArrayBuffer.isView(body))
        ) {
            return nativeFetch(input, init);
        }
        if (init.signal?.aborted) throw new DOMException('Aborted', 'AbortError');

        const res = await chrome.runtime.sendMessage({
            action: 'rovalraFirefoxFetch',
            url: url.href,
            method: init.method || (isRequest ? input.method : 'GET'),
            headers: toPlainHeaders(init.headers || (isRequest ? input.headers : null)),
            body,
            credentials: init.credentials || (isRequest ? input.credentials : 'same-origin'),
            cache: init.cache,
        });
        if (init.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        if (!res || res.error) throw new TypeError(`NetworkError (relayed): ${res?.error || 'no response'}`);

        const response = new Response(NULL_BODY_STATUS.includes(res.status) ? null : res.body, {
            status: res.status,
            statusText: res.statusText,
            headers: res.headers,
        });
        Object.defineProperty(response, 'url', { value: res.url });
        Object.defineProperty(response, 'redirected', { value: res.redirected });
        return response;
    };
    globalThis.fetch = relayFetch;

    // Objects created here are invisible to page / world:MAIN scripts unless
    // cloned into the page compartment, so do that for every CustomEvent detail.
    const NativeCustomEvent = globalThis.CustomEvent;
    const pageWindow = window;
    function CustomEventShim(type, init) {
        if (init && init.detail !== null && typeof init.detail === 'object') {
            try {
                init = {
                    ...init,
                    detail: cloneInto(init.detail, pageWindow, {
                        cloneFunctions: true,
                        wrapReflectors: true,
                    }),
                };
            } catch (e) {
                console.warn('RoValra: could not clone CustomEvent detail', type, e);
            }
        }
        return new NativeCustomEvent(type, init);
    }
    CustomEventShim.prototype = NativeCustomEvent.prototype;
    globalThis.CustomEvent = CustomEventShim;
})();
