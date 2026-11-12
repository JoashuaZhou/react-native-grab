import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("react-native", () => ({
    Image: "Image",
    NativeModules: {
        SourceCode: { getConstants: () => ({ scriptURL: "http://localhost:8081/index.bundle" }) },
    },
    StyleSheet: { create: (styles) => styles },
    Text: "Text",
    View: "View",
}));
import { configureReview } from "../host";
import { ReviewThumbnail, storedScreenshotSource } from "../thumbnail";
const rect = { x: 100, y: 200, width: 80, height: 40 };
const screen = { width: 402, height: 874, scale: 2 };
const source = { uri: "data:image/jpeg;base64,aGk=" };
const asElement = (value) => value;
const styleNumbers = (element) => element.props.style[1];
describe("ReviewThumbnail", () => {
    it("sizes the box from the screen points and scales the rect by 64/402", () => {
        const thumb = asElement(ReviewThumbnail({ source, screen, rect }));
        expect(styleNumbers(thumb)).toEqual({ width: 64, height: 139 });
        const children = thumb.props.children;
        const overlay = asElement(children[1]);
        const overlayStyle = styleNumbers(overlay);
        expect(overlayStyle.left).toBeCloseTo(15.9204, 3);
        expect(overlayStyle.top).toBeCloseTo(31.8408, 3);
        expect(overlayStyle.width).toBeCloseTo(12.7363, 3);
        expect(overlayStyle.height).toBeCloseTo(6.3682, 3);
    });
    it("uses a fixed 64x110 box and hides the rect without a screen", () => {
        const thumb = asElement(ReviewThumbnail({ source, screen: null, rect }));
        expect(styleNumbers(thumb)).toEqual({ width: 64, height: 110 });
        expect(thumb.props.children[1]).toBeFalsy();
        const noRectThumb = asElement(ReviewThumbnail({ source, screen: null, rect: null }));
        expect(styleNumbers(noRectThumb)).toEqual({ width: 64, height: 110 });
        expect(noRectThumb.props.children[1]).toBeFalsy();
    });
    it("shows the 无截图 placeholder without a source", () => {
        const thumb = asElement(ReviewThumbnail({ source: null, screen, rect: null }));
        const children = thumb.props.children;
        expect(asElement(children[0]).props.children).toBe("无截图");
        expect(children[1]).toBeFalsy();
    });
});
describe("storedScreenshotSource", () => {
    beforeEach(() => {
        configureReview({
            storage: {
                get: (key) => (key === "rnGrabReview.pairingCode" ? "012345" : null),
                set: () => { },
            },
        });
    });
    it("joins the dev server root and sends the pairing header", () => {
        const source = storedScreenshotSource("/__react-native-grab/review/screenshots/1.jpg");
        expect(source.uri).toBe("http://localhost:8081/__react-native-grab/review/screenshots/1.jpg");
        expect(source.headers).toEqual({ "x-rn-grab-review-code": "012345" });
    });
    it("returns null without a URL or without a stored code", () => {
        expect(storedScreenshotSource(null)).toBe(null);
        configureReview({
            storage: {
                get: () => null,
                set: () => { },
            },
        });
        expect(storedScreenshotSource("/__react-native-grab/review/screenshots/1.jpg")).toBe(null);
    });
});
//# sourceMappingURL=thumbnail.test.js.map