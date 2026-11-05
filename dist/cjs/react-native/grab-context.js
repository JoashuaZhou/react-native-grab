"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReactNativeGrabContextProvider = exports.composeGrabContextValue = exports.ReactNativeGrabInternalContext = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
exports.ReactNativeGrabInternalContext = (0, react_1.createContext)(null);
const composeGrabContextValue = (parentValue, value) => {
    if (!parentValue) {
        return { ...value };
    }
    return { ...parentValue, ...value };
};
exports.composeGrabContextValue = composeGrabContextValue;
const ReactNativeGrabContextProvider = ({ value, children, }) => {
    const parentValue = (0, react_1.useContext)(exports.ReactNativeGrabInternalContext);
    const composedValue = (0, exports.composeGrabContextValue)(parentValue, value);
    return ((0, jsx_runtime_1.jsx)(exports.ReactNativeGrabInternalContext.Provider, { value: composedValue, children: children }));
};
exports.ReactNativeGrabContextProvider = ReactNativeGrabContextProvider;
//# sourceMappingURL=grab-context.js.map