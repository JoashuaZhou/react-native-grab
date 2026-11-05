export type DevServerInfo = {
    url: string;
    fullBundleUrl: string | null;
    bundleLoadedFromServer: boolean;
};
/**
 * Resolves the Metro dev server URL without deep-importing
 * `react-native/Libraries/Core/Devtools/getDevServer`, which is no longer part
 * of React Native's public API. `NativeModules` is a public root export, so
 * this keeps working across the Strict API cutover in 0.87.
 */
export declare const getDevServer: () => DevServerInfo;
export declare const resetDevServerCache: () => void;
//# sourceMappingURL=dev-server.d.ts.map