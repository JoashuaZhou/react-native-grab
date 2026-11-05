import { getDevServer } from "./dev-server";
const DEFAULT_COPY_ENDPOINT = "/__react-native-grab/copy";
const hasProtocol = (url) => /^https?:\/\//i.test(url);
const resolveEndpointUrl = (endpoint) => {
    const resolvedEndpoint = endpoint ?? DEFAULT_COPY_ENDPOINT;
    if (hasProtocol(resolvedEndpoint)) {
        return resolvedEndpoint;
    }
    const baseUrl = getDevServer().url;
    const normalizedEndpoint = resolvedEndpoint.startsWith("/")
        ? resolvedEndpoint.slice(1)
        : resolvedEndpoint;
    return `${baseUrl}${normalizedEndpoint}`;
};
export const copyViaMetro = async (text, options = {}) => {
    if (!text.trim()) {
        throw new Error("Text to copy cannot be empty");
    }
    const response = await fetch(resolveEndpointUrl(options.endpoint), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: options.signal,
    });
    let payload;
    try {
        payload = (await response.json());
    }
    catch {
        payload = undefined;
    }
    if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.error ?? `Copy request failed with status ${response.status}`);
    }
};
//# sourceMappingURL=copy.js.map