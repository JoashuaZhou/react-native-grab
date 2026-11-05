"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.symbolicateStackTrace = void 0;
const dev_server_1 = require("./dev-server");
/**
 * Posts a stack to Metro's `symbolicate` endpoint, replacing the deep import of
 * `react-native/Libraries/Core/Devtools/symbolicateStackTrace`. That module has
 * no public replacement, but it is a thin wrapper over this request.
 */
const symbolicateStackTrace = async (stack, extraData) => {
    const devServer = (0, dev_server_1.getDevServer)();
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
exports.symbolicateStackTrace = symbolicateStackTrace;
//# sourceMappingURL=symbolicate.js.map