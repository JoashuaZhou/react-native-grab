import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const hooks = vi.hoisted(() => ({
    order: 0,
    values: [],
}));
const runtime = vi.hoisted(() => ({
    reviewState: null,
    pairCalls: [],
}));
vi.mock("react", async (importOriginal) => ({
    ...(await importOriginal()),
    useState: (initial) => {
        const index = hooks.order++;
        const current = hooks.values[index] ?? initial;
        return [
            current,
            (value) => {
                hooks.values[index] =
                    typeof value === "function"
                        ? value(hooks.values[index] ?? initial)
                        : value;
            },
        ];
    },
}));
vi.mock("react-native", () => ({
    Alert: { alert: () => { } },
    Image: "Image",
    Linking: { openURL: async () => { } },
    Modal: "Modal",
    NativeModules: {
        SourceCode: { getConstants: () => ({ scriptURL: "http://localhost:8081/index.bundle" }) },
    },
    Pressable: "Pressable",
    ScrollView: "ScrollView",
    StyleSheet: {
        absoluteFill: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
        hairlineWidth: 1,
        create: (styles) => styles,
    },
    Text: "Text",
    TextInput: "TextInput",
    View: "View",
}));
vi.mock("../store", () => ({
    PAIRING_CODE_STORAGE_KEY: "rnGrabReview.pairingCode",
    reviewActions: {
        pair: async (...args) => {
            runtime.pairCalls.push(args);
            runtime.reviewState.error = { code: "bad_code", status: 401 };
            return false;
        },
        closeList: () => { },
        openComposer: () => { },
    },
    useReviewState: () => runtime.reviewState,
}));
import { ReviewListPanel } from "../list-panel";
const asElement = (value) => value;
const baseState = () => ({
    paired: false,
    review: null,
    items: [],
    runner: { busy: false, blocked: false },
    listVisible: true,
    composer: null,
    error: null,
});
const renderPanel = () => {
    hooks.order = 0;
    const panel = asElement(ReviewListPanel());
    const content = asElement(panel.props.children);
    const pairing = asElement(content.props.children[1]);
    return asElement(pairing.type(pairing.props));
};
afterEach(() => {
    hooks.values.length = 0;
});
describe("pairing view errors", () => {
    beforeEach(() => {
        runtime.reviewState = baseState();
        runtime.pairCalls.length = 0;
    });
    it("tells the designer the review was replaced when a stored code goes stale", () => {
        runtime.reviewState.error = { code: "bad_code", status: 401 };
        const pairing = renderPanel();
        const errorText = asElement(pairing.props.children[2]);
        expect(errorText.props.children).toBe("走查已更换，请输入新的配对码");
    });
    it("tells the designer the code was wrong after a failed pairing attempt", async () => {
        const pairing = renderPanel();
        const input = asElement(pairing.props.children[1]);
        input.props.onChangeText("012345");
        expect(hooks.values).toContain("012345");
        const reRendered = renderPanel();
        const button = asElement(reRendered.props.children[3]);
        const pressable = asElement(button.type(button.props));
        await pressable.props.onPress();
        const pairingAfter = renderPanel();
        const errorText = asElement(pairingAfter.props.children[2]);
        expect(runtime.pairCalls).toEqual([["012345"]]);
        expect(errorText.props.children).toBe("配对码不正确，请重试");
    });
});
//# sourceMappingURL=list-panel.test.js.map