"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useDevMenu = void 0;
const react_1 = require("react");
const react_native_1 = require("react-native");
const utils_1 = require("./utils");
const useDevMenu = (onToggle) => {
    const onToggleRef = (0, utils_1.useLatest)(onToggle);
    // Add to React Native Dev Menu
    (0, react_1.useEffect)(() => {
        react_native_1.DevSettings.addMenuItem("React Native Grab", () => {
            onToggleRef.current();
        });
    }, []);
    // Add to Expo Dev Menu if available
    (0, react_1.useEffect)(() => {
        try {
            const expoDevMenuModule = require("expo-dev-menu");
            expoDevMenuModule.registerDevMenuItems([
                {
                    name: "React Native Grab",
                    callback: () => {
                        onToggleRef.current();
                    },
                },
            ]);
        }
        catch {
            // Nothing we can do about it, it's not installed in the project.
        }
    }, []);
};
exports.useDevMenu = useDevMenu;
//# sourceMappingURL=dev-menu.js.map