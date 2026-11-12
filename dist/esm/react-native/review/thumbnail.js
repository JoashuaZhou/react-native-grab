import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Image, StyleSheet, Text, View } from "react-native";
import { getDevServer } from "../dev-server";
import { REVIEW_CODE_HEADER } from "./api";
import { getReviewHost } from "./host";
import { PAIRING_CODE_STORAGE_KEY } from "./store";
import { thumbnailMetrics } from "./view-model";
const THUMB_WIDTH = 64;
const PLACEHOLDER_HEIGHT = 110;
export const storedScreenshotSource = (screenshotUrl) => {
    if (!screenshotUrl) {
        return null;
    }
    const code = getReviewHost()?.storage?.get(PAIRING_CODE_STORAGE_KEY);
    if (!code) {
        return null;
    }
    const root = getDevServer().url.replace(/\/+$/, "");
    return {
        uri: `${root}${screenshotUrl}`,
        headers: { [REVIEW_CODE_HEADER]: code },
    };
};
export const ReviewThumbnail = ({ source, screen, rect }) => {
    const metrics = screen !== null
        ? thumbnailMetrics(screen, THUMB_WIDTH)
        : { width: THUMB_WIDTH, height: PLACEHOLDER_HEIGHT, scale: 1 };
    return (_jsxs(View, { style: [styles.thumbnail, { width: metrics.width, height: metrics.height }], children: [source !== null ? (_jsx(Image, { source: source, style: styles.thumbnailImage, resizeMode: "cover" })) : (_jsx(Text, { style: styles.thumbnailPlaceholderText, children: "\u65E0\u622A\u56FE" })), source !== null && screen !== null && rect !== null && (_jsx(View, { style: [
                    styles.thumbnailRect,
                    {
                        left: rect.x * metrics.scale,
                        top: rect.y * metrics.scale,
                        width: rect.width * metrics.scale,
                        height: rect.height * metrics.scale,
                    },
                ] }))] }));
};
const styles = StyleSheet.create({
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