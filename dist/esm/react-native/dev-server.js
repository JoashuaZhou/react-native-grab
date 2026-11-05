import { NativeModules } from "react-native";
const FALLBACK_URL = "http://localhost:8081/";
let cachedDevServerUrl;
let cachedFullBundleUrl;
/**
 * `scriptURL` is exposed through `getConstants()` on the New Architecture, but
 * older React Native versions only expose it as a plain constant on the module.
 */
const getScriptUrl = () => {
    const sourceCode = NativeModules.SourceCode;
    if (!sourceCode)
        return null;
    try {
        return sourceCode.getConstants?.().scriptURL ?? sourceCode.scriptURL ?? null;
    }
    catch {
        return null;
    }
};
/**
 * Resolves the Metro dev server URL without deep-importing
 * `react-native/Libraries/Core/Devtools/getDevServer`, which is no longer part
 * of React Native's public API. `NativeModules` is a public root export, so
 * this keeps working across the Strict API cutover in 0.87.
 */
export const getDevServer = () => {
    if (cachedDevServerUrl === undefined) {
        const scriptUrl = getScriptUrl();
        const match = scriptUrl?.match(/^https?:\/\/.*?\//);
        cachedDevServerUrl = match ? match[0] : null;
        cachedFullBundleUrl = match ? scriptUrl : null;
    }
    return {
        url: cachedDevServerUrl ?? FALLBACK_URL,
        fullBundleUrl: cachedFullBundleUrl,
        bundleLoadedFromServer: cachedDevServerUrl !== null,
    };
};
export const resetDevServerCache = () => {
    cachedDevServerUrl = undefined;
    cachedFullBundleUrl = null;
};
//# sourceMappingURL=dev-server.js.map