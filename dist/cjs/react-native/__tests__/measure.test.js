"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const findShadowNodeByTag_DEPRECATED = vitest_1.vi.fn();
const measureInWindow = vitest_1.vi.fn();
vitest_1.vi.mock("../fabric", () => ({
    getFabricUIManager: () => ({ findShadowNodeByTag_DEPRECATED }),
}));
const measure_1 = require("../measure");
(0, vitest_1.beforeEach)(() => {
    vitest_1.vi.clearAllMocks();
    globalThis.nativeFabricUIManager = { measureInWindow };
});
const touch = (values) => ({
    target: "1",
    pageX: 0,
    pageY: 0,
    locationX: 0,
    locationY: 0,
    ...values,
});
const targetAt = (x, y) => {
    findShadowNodeByTag_DEPRECATED.mockReturnValue({});
    measureInWindow.mockImplementation((_node, callback) => {
        callback(x, y, 10, 10);
    });
};
(0, vitest_1.describe)("getFabricWindowOffset", () => {
    (0, vitest_1.it)("is zero when the surface root sits at the window origin", () => {
        targetAt(20, 300);
        (0, vitest_1.expect)((0, measure_1.getFabricWindowOffset)(touch({ pageX: 25, pageY: 310, locationX: 5, locationY: 10 }))).toEqual([0, 0]);
    });
    (0, vitest_1.it)("reports the gap when the surface root is offset inside its window", () => {
        // The target measures 48.8dp higher in Fabric space than the touch reports,
        // which is roughly how far Android's main surface starts below the window.
        targetAt(20, 251);
        (0, vitest_1.expect)((0, measure_1.getFabricWindowOffset)(touch({ pageX: 25, pageY: 310, locationX: 5, locationY: 10 }))).toEqual([0, -49]);
    });
    (0, vitest_1.it)("falls back to no offset when the touch target cannot be resolved", () => {
        findShadowNodeByTag_DEPRECATED.mockReturnValue(null);
        (0, vitest_1.expect)((0, measure_1.getFabricWindowOffset)(touch({ pageX: 25, pageY: 310 }))).toEqual([0, 0]);
        findShadowNodeByTag_DEPRECATED.mockImplementation(() => {
            throw new Error("unknown tag");
        });
        (0, vitest_1.expect)((0, measure_1.getFabricWindowOffset)(touch({ pageX: 25, pageY: 310 }))).toEqual([0, 0]);
        (0, vitest_1.expect)((0, measure_1.getFabricWindowOffset)(touch({ target: "0", pageX: 25, pageY: 310 }))).toEqual([
            0, 0,
        ]);
    });
});
//# sourceMappingURL=measure.test.js.map