"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const devServer = {
    url: "http://localhost:8081/",
    fullBundleUrl: "http://localhost:8081/index.bundle",
    bundleLoadedFromServer: true,
};
vitest_1.vi.mock("../dev-server", () => ({
    getDevServer: () => devServer,
}));
const symbolicate_1 = require("../symbolicate");
const frame = {
    methodName: "Counter",
    file: "http://localhost:8081/index.bundle",
    lineNumber: 12,
    column: 3,
};
(0, vitest_1.beforeEach)(() => {
    devServer.bundleLoadedFromServer = true;
});
(0, vitest_1.afterEach)(() => {
    vitest_1.vi.unstubAllGlobals();
});
(0, vitest_1.describe)("symbolicateStackTrace", () => {
    (0, vitest_1.it)("posts the stack to Metro and returns the symbolicated result", async () => {
        const symbolicated = { stack: [{ ...frame, file: "src/Counter.tsx" }], codeFrame: null };
        const fetchMock = vitest_1.vi.fn(async () => ({
            ok: true,
            status: 200,
            json: async () => symbolicated,
        }));
        vitest_1.vi.stubGlobal("fetch", fetchMock);
        await (0, vitest_1.expect)((0, symbolicate_1.symbolicateStackTrace)([frame], { extra: true })).resolves.toEqual(symbolicated);
        const [url, init] = fetchMock.mock.calls[0];
        (0, vitest_1.expect)(url).toBe("http://localhost:8081/symbolicate");
        (0, vitest_1.expect)(init.method).toBe("POST");
        (0, vitest_1.expect)(JSON.parse(init.body)).toEqual({
            stack: [frame],
            extraData: { extra: true },
        });
    });
    (0, vitest_1.it)("throws when the bundle was not loaded from Metro", async () => {
        devServer.bundleLoadedFromServer = false;
        const fetchMock = vitest_1.vi.fn();
        vitest_1.vi.stubGlobal("fetch", fetchMock);
        await (0, vitest_1.expect)((0, symbolicate_1.symbolicateStackTrace)([frame])).rejects.toThrow("Bundle was not loaded from Metro");
        (0, vitest_1.expect)(fetchMock).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)("throws when Metro responds with an error status", async () => {
        vitest_1.vi.stubGlobal("fetch", vitest_1.vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })));
        await (0, vitest_1.expect)((0, symbolicate_1.symbolicateStackTrace)([frame])).rejects.toThrow("Symbolicate request failed with status 500");
    });
});
//# sourceMappingURL=symbolicate.test.js.map