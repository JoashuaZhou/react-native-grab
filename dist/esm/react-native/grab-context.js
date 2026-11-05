import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext } from "react";
export const ReactNativeGrabInternalContext = createContext(null);
export const composeGrabContextValue = (parentValue, value) => {
    if (!parentValue) {
        return { ...value };
    }
    return { ...parentValue, ...value };
};
export const ReactNativeGrabContextProvider = ({ value, children, }) => {
    const parentValue = useContext(ReactNativeGrabInternalContext);
    const composedValue = composeGrabContextValue(parentValue, value);
    return (_jsx(ReactNativeGrabInternalContext.Provider, { value: composedValue, children: children }));
};
//# sourceMappingURL=grab-context.js.map