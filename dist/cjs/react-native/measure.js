"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFabricWindowOffset = exports.findNodeAtPoint = exports.measureInWindow = void 0;
const fabric_1 = require("./fabric");
const measureInWindow = (node) => {
    let boundingClientRect = null;
    nativeFabricUIManager.measureInWindow(node, (x, y, width, height) => {
        boundingClientRect = [x, y, width, height];
    });
    if (!boundingClientRect) {
        throw new Error("Failed to measure node");
    }
    return boundingClientRect;
};
exports.measureInWindow = measureInWindow;
const findNodeAtPoint = (node, x, y) => {
    let fiberNode = null;
    nativeFabricUIManager.findNodeAtPoint(node, x, y, (internalNode) => {
        fiberNode = internalNode;
    });
    return fiberNode;
};
exports.findNodeAtPoint = findNodeAtPoint;
const findShadowNodeByTag = (tag) => {
    const nativeTag = typeof tag === "string" ? Number(tag) : tag;
    if (!nativeTag || Number.isNaN(nativeTag)) {
        return null;
    }
    try {
        return (0, fabric_1.getFabricUIManager)().findShadowNodeByTag_DEPRECATED(nativeTag) ?? null;
    }
    catch {
        return null;
    }
};
/**
 * Fabric measures in the coordinate space of the surface root, while touches
 * report `pageX`/`pageY` in the coordinate space of the native window hosting
 * that surface. The two only coincide when the surface root sits at the window
 * origin, which is why hit testing was accurate on iOS and a status bar too low
 * in Android's main window.
 *
 * A touch carries both spaces at once - `pageX`/`pageY` alongside `locationX`/
 * `locationY` relative to `target` - so the offset between them can be read off
 * the touch itself rather than guessed per platform. Read it once when the
 * gesture starts: the offset belongs to the window, not to the touched view, and
 * Android only guarantees that `location` matches `target` on the initial touch.
 */
const getFabricWindowOffset = (nativeEvent) => {
    const targetNode = findShadowNodeByTag(nativeEvent.target);
    if (!targetNode) {
        return [0, 0];
    }
    try {
        const targetRect = (0, exports.measureInWindow)(targetNode);
        return [
            targetRect[0] + nativeEvent.locationX - nativeEvent.pageX,
            targetRect[1] + nativeEvent.locationY - nativeEvent.pageY,
        ];
    }
    catch {
        return [0, 0];
    }
};
exports.getFabricWindowOffset = getFabricWindowOffset;
//# sourceMappingURL=measure.js.map