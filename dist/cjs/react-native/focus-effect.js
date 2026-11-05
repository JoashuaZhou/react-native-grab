"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setFocusEffect = exports.getFocusEffect = void 0;
const react_1 = require("react");
const getDefaultFocusEffectFactory = () => {
    try {
        return require("expo-router").useFocusEffect;
    }
    catch {
        // Nothing we can do about it, it's not installed in the project.
    }
    try {
        return require("@react-navigation/native").useFocusEffect;
    }
    catch {
        // Nothing we can do about it, it's not installed in the project.
    }
    console.warn("[react-native-grab] No supported router found — falling back to useEffect. This may cause issues. Provide a custom focus effect using the setFocusEffect function.");
    const useFallbackFocusEffect = (cb) => {
        (0, react_1.useEffect)(() => {
            return cb();
        }, [cb]);
    };
    return useFallbackFocusEffect;
};
let cachedFocusEffect = null;
const getFocusEffect = () => {
    if (!cachedFocusEffect) {
        cachedFocusEffect = getDefaultFocusEffectFactory();
    }
    return cachedFocusEffect;
};
exports.getFocusEffect = getFocusEffect;
const setFocusEffect = (impl) => {
    cachedFocusEffect = impl;
};
exports.setFocusEffect = setFocusEffect;
//# sourceMappingURL=focus-effect.js.map