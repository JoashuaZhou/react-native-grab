export const getFabricUIManager = () => {
    if (typeof nativeFabricUIManager === "undefined") {
        throw new Error("React Native Grab requires New Architecture (Fabric) to be enabled.");
    }
    return nativeFabricUIManager;
};
//# sourceMappingURL=fabric.js.map