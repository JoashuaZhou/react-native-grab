import type { ReactNode } from "react";
export type ReactNativeGrabContextValue = Record<string, string | number | boolean | null>;
export type ReactNativeGrabContextProviderProps = {
    value: ReactNativeGrabContextValue;
    children?: ReactNode;
};
type InternalReactNativeGrabContextValue = ReactNativeGrabContextValue | null;
export declare const ReactNativeGrabInternalContext: import("react").Context<InternalReactNativeGrabContextValue>;
export declare const composeGrabContextValue: (parentValue: InternalReactNativeGrabContextValue, value: ReactNativeGrabContextValue) => ReactNativeGrabContextValue;
export declare const ReactNativeGrabContextProvider: ({ value, children, }: ReactNativeGrabContextProviderProps) => import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=grab-context.d.ts.map