"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewThumbnail = exports.storedScreenshotSource = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_native_1 = require("react-native");
const dev_server_1 = require("../dev-server");
const api_1 = require("./api");
const host_1 = require("./host");
const store_1 = require("./store");
const view_model_1 = require("./view-model");
const THUMB_WIDTH = 64;
const PLACEHOLDER_HEIGHT = 110;
const storedScreenshotSource = (screenshotUrl) => {
    if (!screenshotUrl) {
        return null;
    }
    const code = (0, host_1.getReviewHost)()?.storage?.get(store_1.PAIRING_CODE_STORAGE_KEY);
    if (!code) {
        return null;
    }
    const root = (0, dev_server_1.getDevServer)().url.replace(/\/+$/, "");
    return {
        uri: `${root}${screenshotUrl}`,
        headers: { [api_1.REVIEW_CODE_HEADER]: code },
    };
};
exports.storedScreenshotSource = storedScreenshotSource;
const ReviewThumbnail = ({ source, screen, rect }) => {
    const metrics = screen !== null
        ? (0, view_model_1.thumbnailMetrics)(screen, THUMB_WIDTH)
        : { width: THUMB_WIDTH, height: PLACEHOLDER_HEIGHT, scale: 1 };
    return ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [styles.thumbnail, { width: metrics.width, height: metrics.height }], children: [source !== null ? ((0, jsx_runtime_1.jsx)(react_native_1.Image, { source: source, style: styles.thumbnailImage, resizeMode: "cover" })) : ((0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.thumbnailPlaceholderText, children: "\u65E0\u622A\u56FE" })), source !== null && screen !== null && rect !== null && ((0, jsx_runtime_1.jsx)(react_native_1.View, { style: [
                    styles.thumbnailRect,
                    {
                        left: rect.x * metrics.scale,
                        top: rect.y * metrics.scale,
                        width: rect.width * metrics.scale,
                        height: rect.height * metrics.scale,
                    },
                ] }))] }));
};
exports.ReviewThumbnail = ReviewThumbnail;
const styles = react_native_1.StyleSheet.create({
    thumbnail: {
        borderRadius: 6,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(17, 17, 17, 0.06)",
    },
    thumbnailImage: {
        width: "100%",
        height: "100%",
    },
    thumbnailRect: {
        position: "absolute",
        borderWidth: 1.5,
        borderColor: "#FF3B30",
        backgroundColor: "rgba(255, 59, 48, 0.16)",
    },
    thumbnailPlaceholderText: {
        color: "#8A8A8A",
        fontSize: 11,
    },
});
//# sourceMappingURL=thumbnail.js.map