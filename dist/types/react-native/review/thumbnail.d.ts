import { type ImageSourcePropType } from "react-native";
import type { ScreenInfo, WindowRect } from "../../review-core/types";
export declare const storedScreenshotSource: (screenshotUrl: string | null) => ImageSourcePropType | null;
export type ReviewThumbnailProps = {
    source: ImageSourcePropType | null;
    screen: ScreenInfo | null;
    rect: WindowRect | null;
};
export declare const ReviewThumbnail: ({ source, screen, rect }: ReviewThumbnailProps) => import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=thumbnail.d.ts.map