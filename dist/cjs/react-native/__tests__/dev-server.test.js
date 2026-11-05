"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const sourceCode = {};
vitest_1.vi.mock("react-native", () => ({
    NativeModules: {
        get SourceCode() {
            return sourceCode;
        },
    },
}));
const dev_server_1 = require("../dev-server");
const setScriptUrl = (scriptURL) => {
    sourceCode.getConstants = () => ({ scriptURL });
};
(0, vitest_1.beforeEach)(() => {
    (0, dev_server_1.resetDevServerCache)();
    delete sourceCode.getConstants;
    delete sourceCode.scriptURL;
});
(0, vitest_1.afterEach)(() => {
    (0, dev_server_1.resetDevServerCache)();
});
(0, vitest_1.describe)("getDevServer", () => {
    (0, vitest_1.it)("derives the dev server origin from the bundle scriptURL", () => {
        setScriptUrl("http://192.168.0.10:8081/index.bundle?platform=ios&dev=true");
        (0, vitest_1.expect)((0, dev_server_1.getDevServer)()).toEqual({
            url: "http://192.168.0.10:8081/",
            fullBundleUrl: "http://192.168.0.10:8081/index.bundle?platform=ios&dev=true",
            bundleLoadedFromServer: true,
        });
    });
    (0, vitest_1.it)("falls back to localhost when the bundle was not loaded from Metro", () => {
        setScriptUrl("file:///var/containers/Bundle/Application/main.jsbundle");
        (0, vitest_1.expect)((0, dev_server_1.getDevServer)()).toEqual({
            url: "http://localhost:8081/",
            fullBundleUrl: null,
            bundleLoadedFromServer: false,
        });
    });
    (0, vitest_1.it)("reads scriptURL as a plain constant when getConstants is unavailable", () => {
        sourceCode.scriptURL = "https://localhost:8082/index.bundle";
        (0, vitest_1.expect)((0, dev_server_1.getDevServer)().url).toBe("https://localhost:8082/");
    });
    (0, vitest_1.it)("falls back when the SourceCode module throws", () => {
        sourceCode.getConstants = () => {
            throw new Error("bridge unavailable");
        };
        (0, vitest_1.expect)((0, dev_server_1.getDevServer)().bundleLoadedFromServer).toBe(false);
    });
    (0, vitest_1.it)("caches the resolved URL across calls", () => {
        const getConstants = vitest_1.vi.fn(() => ({ scriptURL: "http://localhost:8081/index.bundle" }));
        sourceCode.getConstants = getConstants;
        (0, dev_server_1.getDevServer)();
        (0, dev_server_1.getDevServer)();
        (0, vitest_1.expect)(getConstants).toHaveBeenCalledTimes(1);
    });
});
//# sourceMappingURL=dev-server.test.js.map