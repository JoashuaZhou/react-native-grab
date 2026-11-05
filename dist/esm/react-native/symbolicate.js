import { getDevServer } from "./dev-server";
/**
 * Posts a stack to Metro's `symbolicate` endpoint, replacing the deep import of
 * `react-native/Libraries/Core/Devtools/symbolicateStackTrace`. That module has
 * no public replacement, but it is a thin wrapper over this request.
 */
export const symbolicateStackTrace = async (stack, extraData) => {
    const devServer = getDevServer();
    if (!devServer.bundleLoadedFromServer) {
        throw new Error("Bundle was not loaded from Metro.");
    }
    const response = await fetch(`${devServer.url}symbolicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stack, extraData }),
    });
    if (!response.ok) {
        throw new Error(`Symbolicate request failed with status ${response.status}`);
    }
    return (await response.json());
};
//# sourceMappingURL=symbolicate.js.map