import { useEffect } from "react";
import { DevSettings } from "react-native";
import { useLatest } from "./utils";
export const useDevMenu = (onToggle) => {
    const onToggleRef = useLatest(onToggle);
    // Add to React Native Dev Menu
    useEffect(() => {
        DevSettings.addMenuItem("React Native Grab", () => {
            onToggleRef.current();
        });
    }, []);
    // Add to Expo Dev Menu if available
    useEffect(() => {
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
//# sourceMappingURL=dev-menu.js.map