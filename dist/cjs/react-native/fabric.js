"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFabricUIManager = void 0;
const getFabricUIManager = () => {
    if (typeof nativeFabricUIManager === "undefined") {
        throw new Error("React Native Grab requires New Architecture (Fabric) to be enabled.");
    }
    return nativeFabricUIManager;
};
exports.getFabricUIManager = getFabricUIManager;
//# sourceMappingURL=fabric.js.map