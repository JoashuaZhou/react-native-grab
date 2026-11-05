import type { ReactNativeGrabRootProps } from "./grab-root";
import type { ReactNativeGrabScreenProps } from "./grab-screen";
import type { ReactNativeGrabSurfaceProps } from "./grab-surface";
import type { ReactNativeGrabContextProviderProps } from "./grab-context";
export type { ReactNativeGrabRootProps } from "./grab-root";
export type { ReactNativeGrabScreenProps } from "./grab-screen";
export type { ReactNativeGrabSurfaceProps } from "./grab-surface";
export type { ReactNativeGrabContextProviderProps, ReactNativeGrabContextValue, } from "./grab-context";
export declare const ReactNativeGrabRoot: React.ComponentType<ReactNativeGrabRootProps>;
export declare const ReactNativeGrabScreen: React.ComponentType<ReactNativeGrabScreenProps>;
export declare const ReactNativeGrabSurface: React.ComponentType<ReactNativeGrabSurfaceProps>;
export declare const ReactNativeGrabContextProvider: React.ComponentType<ReactNativeGrabContextProviderProps>;
export declare const enableGrabbing: () => void;
export declare const setFocusEffect: (impl: (cb: () => void) => void) => void;
//# sourceMappingURL=index.d.ts.map