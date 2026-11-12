"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
vitest_1.vi.mock("react-native", () => ({
    Image: "Image",
    NativeModules: {
        SourceCode: { getConstants: () => ({ scriptURL: "http://localhost:8081/index.bundle" }) },
    },
    StyleSheet: { create: (styles) => styles },
    Text: "Text",
    View: "View",
}));
const host_1 = require("../host");
const thumbnail_1 = require("../thumbnail");
const rect = { x: 100, y: 200, width: 80, height: 40 };
const screen = { width: 402, height: 874, scale: 2 };
const source = { uri: "data:image/jpeg;base64,aGk=" };
const asElement = (value) => value;
const styleNumbers = (element) => element.props.style[1];
(0, vitest_1.describe)("ReviewThumbnail", () => {
    (0, vitest_1.it)("sizes the box from the screen points and scales the rect by 64/402", () => {
        const thumb = asElement((0, thumbnail_1.ReviewThumbnail)({ source, screen, rect }));
        (0, vitest_1.expect)(styleNumbers(thumb)).toEqual({ width: 64, height: 139 });
        const children = thumb.props.children;
        const overlay = asElement(children[1]);
        const overlayStyle = styleNumbers(overlay);
        (0, vitest_1.expect)(overlayStyle.left).toBeCloseTo(15.9204, 3);
        (0, vitest_1.expect)(overlayStyle.top).toBeCloseTo(31.8408, 3);
        (0, vitest_1.expect)(overlayStyle.width).toBeCloseTo(12.7363, 3);
        (0, vitest_1.expect)(overlayStyle.height).toBeCloseTo(6.3682, 3);
    });
    (0, vitest_1.it)("uses a fixed 64x110 box and hides the rect without a screen", () => {
        const thumb = asElement((0, thumbnail_1.ReviewThumbnail)({ source, screen: null, rect }));
        (0, vitest_1.expect)(styleNumbers(thumb)).toEqual({ width: 64, height: 110 });
        (0, vitest_1.expect)(thumb.props.children[1]).toBeFalsy();
        const noRectThumb = asElement((0, thumbnail_1.ReviewThumbnail)({ source, screen: null, rect: null }));
        (0, vitest_1.expect)(styleNumbers(noRectThumb)).toEqual({ width: 64, height: 110 });
        (0, vitest_1.expect)(noRectThumb.props.children[1]).toBeFalsy();
    });
    (0, vitest_1.it)("shows the 无截图 placeholder without a source", () => {
        const thumb = asElement((0, thumbnail_1.ReviewThumbnail)({ source: null, screen, rect: null }));
        const children = thumb.props.children;
        (0, vitest_1.expect)(asElement(children[0]).props.children).toBe("无截图");
        (0, vitest_1.expect)(children[1]).toBeFalsy();
    });
});
(0, vitest_1.describe)("storedScreenshotSource", () => {
    (0, vitest_1.beforeEach)(() => {
        (0, host_1.configureReview)({
            storage: {
                get: (key) => (key === "rnGrabReview.pairingCode" ? "012345" : null),
                set: () => { },
            },
        });
    });
    (0, vitest_1.it)("joins the dev server root and sends the pairing header", () => {
        const source = (0, thumbnail_1.storedScreenshotSource)("/__react-native-grab/review/screenshots/1.jpg");
        (0, vitest_1.expect)(source.uri).toBe("http://localhost:8081/__react-native-grab/review/screenshots/1.jpg");
        (0, vitest_1.expect)(source.headers).toEqual({ "x-rn-grab-review-code": "012345" });
    });
    (0, vitest_1.it)("returns null without a URL or without a stored code", () => {
        (0, vitest_1.expect)((0, thumbnail_1.storedScreenshotSource)(null)).toBe(null);
        (0, host_1.configureReview)({
            storage: {
                get: () => null,
                set: () => { },
            },
        });
        (0, vitest_1.expect)((0, thumbnail_1.storedScreenshotSource)("/__react-native-grab/review/screenshots/1.jpg")).toBe(null);
    });
});
//# sourceMappingURL=thumbnail.test.js.map