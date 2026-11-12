"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewComposer = exports.ComposerSheet = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const react_native_1 = require("react-native");
const react_native_safe_area_context_1 = require("react-native-safe-area-context");
const types_1 = require("../../review-core/types");
const store_1 = require("./store");
const thumbnail_1 = require("./thumbnail");
const view_model_1 = require("./view-model");
const NO_SCREENSHOT_HINT = "未截图：请安装包含走查截图功能的测试包";
const captureSource = (screenshot) => ({
    uri: `data:image/jpeg;base64,${screenshot.jpegBase64}`,
});
const toFormState = (composer) => {
    if (composer.mode === "create") {
        const draft = composer.draft;
        return {
            description: draft.description,
            scope: draft.scope ?? "local",
            figmaUrl: draft.figmaUrl ?? "",
            supplement: "",
        };
    }
    const rounds = composer.item.rounds;
    return {
        description: rounds[rounds.length - 1]?.description ?? "",
        scope: composer.item.scope,
        figmaUrl: composer.item.figmaUrl ?? "",
        supplement: "",
    };
};
const toTitle = (composer) => {
    if (composer.mode === "create") {
        return composer.draft.kind === "page" ? "走查整页" : "走查控件";
    }
    return composer.mode === "edit" ? "修改草稿" : "打回并补充";
};
const toSaveLabel = (composer) => composer.mode === "reject" ? "打回" : "保存";
const toErrorText = (error) => {
    if (error === null) {
        return null;
    }
    return `保存失败（${error.code}），请重试`;
};
const ComposerSheet = ({ composer, error, }) => {
    const [form, setForm] = (0, react_1.useState)(() => toFormState(composer));
    const [lastComposer, setLastComposer] = (0, react_1.useState)(composer);
    const [isSaving, setIsSaving] = (0, react_1.useState)(false);
    // A fresh composer object means a new sheet; the form resets during render
    // so no stale draft ever flashes.
    if (lastComposer !== composer) {
        setLastComposer(composer);
        setForm(toFormState(composer));
        setIsSaving(false);
    }
    const canSave = composer.mode === "reject"
        ? form.supplement.trim().length > 0
        : (0, view_model_1.canSaveComposer)({ description: form.description });
    const handleSave = async () => {
        if (isSaving || !canSave) {
            return;
        }
        setIsSaving(true);
        const saved = await store_1.reviewActions.saveComposer(composer.mode === "reject"
            ? { supplement: form.supplement.trim() }
            : {
                description: form.description.trim(),
                scope: form.scope,
                figmaUrl: form.figmaUrl.trim().length > 0 ? form.figmaUrl.trim() : null,
            });
        // Failed saves keep the sheet open; the error renders inline below.
        if (saved) {
            return;
        }
        setIsSaving(false);
    };
    const source = composer.mode === "create"
        ? composer.screenshot !== null
            ? captureSource(composer.screenshot)
            : null
        : (0, thumbnail_1.storedScreenshotSource)(composer.item.screenshotUrl);
    const screen = composer.mode === "create" ? (composer.draft.screen ?? null) : composer.item.screen;
    const rect = composer.mode === "create" ? (composer.draft.rect ?? null) : composer.item.rect;
    return (
    // The same source of the status-bar inset as `grab-controls.tsx`; while the
    // keyboard pushes the sheet up, its content stays below the status bar.
    (0, jsx_runtime_1.jsxs)(react_native_1.KeyboardAvoidingView, { behavior: "padding", style: [styles.backdrop, { paddingTop: react_native_safe_area_context_1.initialWindowMetrics?.insets.top ?? 0 }], children: [(0, jsx_runtime_1.jsx)(react_native_1.Pressable, { onPress: () => {
                    if (!isSaving) {
                        store_1.reviewActions.closeComposer();
                    }
                }, style: styles.backdropPress }), (0, jsx_runtime_1.jsx)(react_native_1.ScrollView, { bounces: false, keyboardShouldPersistTaps: "handled", contentContainerStyle: styles.sheetContent, children: (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: styles.sheet, children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.sheetTitle, children: toTitle(composer) }), composer.mode === "create" && source === null ? ((0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.hintText, children: NO_SCREENSHOT_HINT })) : ((0, jsx_runtime_1.jsx)(thumbnail_1.ReviewThumbnail, { source: source, screen: screen, rect: rect })), composer.mode !== "reject" ? ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.fieldLabel, children: "\u63CF\u8FF0" }), (0, jsx_runtime_1.jsx)(react_native_1.TextInput, { multiline: true, onChangeText: (text) => setForm((prev) => ({ ...prev, description: text })), placeholder: "\u63CF\u8FF0\uFF08\u5FC5\u586B\uFF09", style: styles.textInput, textAlignVertical: "top", value: form.description }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.fieldLabel, children: "\u4FEE\u6539\u8303\u56F4" }), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: styles.scopeRow, children: ["local", "shared"].map((scope) => ((0, jsx_runtime_1.jsx)(react_native_1.Pressable, { onPress: () => setForm((prev) => ({ ...prev, scope })), style: [styles.scopeChip, form.scope === scope && styles.scopeChipActive], children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [
                                                styles.scopeChipText,
                                                form.scope === scope && styles.scopeChipTextActive,
                                            ], children: types_1.SCOPE_LABELS[scope] }) }, scope))) }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.fieldLabel, children: "Figma \u94FE\u63A5" }), (0, jsx_runtime_1.jsx)(react_native_1.TextInput, { autoCapitalize: "none", autoCorrect: false, onChangeText: (text) => setForm((prev) => ({ ...prev, figmaUrl: text })), keyboardType: "url", placeholder: "Figma \u94FE\u63A5\uFF08\u9009\u586B\uFF09", style: styles.textInput, value: form.figmaUrl })] })) : ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.fieldLabel, children: "\u8865\u5145\u8BF4\u660E" }), (0, jsx_runtime_1.jsx)(react_native_1.TextInput, { multiline: true, onChangeText: (text) => setForm((prev) => ({ ...prev, supplement: text })), placeholder: "\u8865\u5145\u8BF4\u660E\uFF08\u5FC5\u586B\uFF09", style: [styles.textInput, styles.supplementInput], textAlignVertical: "top", value: form.supplement })] })), toErrorText(error) !== null && ((0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.errorText, children: toErrorText(error) })), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: styles.actionRow, children: [(0, jsx_runtime_1.jsx)(react_native_1.Pressable, { disabled: isSaving, onPress: store_1.reviewActions.closeComposer, style: ({ pressed }) => [
                                        styles.actionButton,
                                        styles.actionButtonSecondary,
                                        pressed && styles.actionButtonPressed,
                                    ], children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.actionTextSecondary, children: "\u53D6\u6D88" }) }), (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { disabled: isSaving || !canSave, onPress: () => void handleSave(), style: ({ pressed }) => [
                                        styles.actionButton,
                                        styles.actionButtonPrimary,
                                        (isSaving || !canSave) && styles.actionButtonDisabled,
                                        pressed && !isSaving && canSave && styles.actionButtonPressed,
                                    ], children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [
                                            styles.actionTextPrimary,
                                            (isSaving || !canSave) && styles.actionTextDisabled,
                                        ], children: toSaveLabel(composer) }) })] })] }) })] }));
};
exports.ComposerSheet = ComposerSheet;
const ReviewComposer = () => {
    const { composer, error, listVisible } = (0, store_1.useReviewState)();
    // iOS cannot present a second Modal over the full-screen list; while the
    // list is visible the sheet mounts inside the list Modal tree instead.
    if (listVisible) {
        return null;
    }
    return ((0, jsx_runtime_1.jsx)(react_native_1.Modal, { animationType: "slide", onRequestClose: store_1.reviewActions.closeComposer, transparent: true, visible: composer !== null, children: composer !== null && (0, jsx_runtime_1.jsx)(exports.ComposerSheet, { composer: composer, error: error }) }));
};
exports.ReviewComposer = ReviewComposer;
const styles = react_native_1.StyleSheet.create({
    backdrop: {
        flex: 1,
        justifyContent: "flex-end",
        backgroundColor: "rgba(0, 0, 0, 0.4)",
    },
    backdropPress: {
        flex: 1,
    },
    sheetContent: {
        justifyContent: "flex-end",
    },
    sheet: {
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        backgroundColor: "#FFFFFF",
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 28,
        gap: 8,
    },
    sheetTitle: {
        color: "#111111",
        fontSize: 17,
        fontWeight: "600",
        textAlign: "center",
    },
    hintText: {
        color: "#8A8A8A",
        fontSize: 13,
        paddingVertical: 12,
        textAlign: "center",
    },
    fieldLabel: {
        color: "#666666",
        fontSize: 12,
        fontWeight: "600",
        marginTop: 4,
    },
    textInput: {
        borderWidth: 1,
        borderColor: "rgba(17, 17, 17, 0.14)",
        borderRadius: 8,
        color: "#111111",
        fontSize: 15,
        minHeight: 44,
        padding: 10,
    },
    supplementInput: {
        minHeight: 88,
    },
    scopeRow: {
        flexDirection: "row",
        gap: 8,
    },
    scopeChip: {
        borderRadius: 999,
        borderWidth: 1,
        borderColor: "rgba(17, 17, 17, 0.14)",
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    scopeChipActive: {
        backgroundColor: "#111111",
        borderColor: "#111111",
    },
    scopeChipText: {
        color: "#111111",
        fontSize: 13,
        fontWeight: "500",
    },
    scopeChipTextActive: {
        color: "#FFFFFF",
    },
    errorText: {
        color: "#D93025",
        fontSize: 13,
        paddingTop: 4,
    },
    actionRow: {
        flexDirection: "row",
        gap: 12,
        marginTop: 8,
    },
    actionButton: {
        flex: 1,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        minHeight: 44,
    },
    actionButtonPrimary: {
        backgroundColor: "#111111",
    },
    actionButtonSecondary: {
        backgroundColor: "rgba(17, 17, 17, 0.06)",
    },
    actionButtonDisabled: {
        opacity: 0.4,
    },
    actionButtonPressed: {
        opacity: 0.72,
    },
    actionTextPrimary: {
        color: "#FFFFFF",
        fontSize: 15,
        fontWeight: "600",
    },
    actionTextSecondary: {
        color: "#111111",
        fontSize: 15,
        fontWeight: "600",
    },
    actionTextDisabled: {
        color: "rgba(255, 255, 255, 0.8)",
    },
});
//# sourceMappingURL=composer.js.map