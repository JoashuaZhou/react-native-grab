"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewListPanel = exports.pairingErrorText = exports.PAIRING_WRONG_CODE_MESSAGE = exports.PAIRING_STALE_MESSAGE = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const react_native_1 = require("react-native");
const react_native_safe_area_context_1 = require("react-native-safe-area-context");
const composer_1 = require("./composer");
const store_1 = require("./store");
const thumbnail_1 = require("./thumbnail");
const view_model_1 = require("./view-model");
exports.PAIRING_STALE_MESSAGE = "走查已更换，请输入新的配对码";
exports.PAIRING_WRONG_CODE_MESSAGE = "配对码不正确，请重试";
const BUSY_BANNER = "agent 修复中…";
const BLOCKED_BANNER = "agent 运行异常，请联系工程师处理（rn-grab-review retry）";
const REVERT_CONFIRM_MESSAGE = "撤销后这条的代码改动会被还原，确定吗？";
const REVERT_CONFLICT_ERROR = "撤销失败：和后面的改动冲突，请联系工程师处理";
// A stale stored code keeps its message via the store's stalePairing flag (openList
// clears `error` but not the flag). A failed manual pair attempt explains itself
// instead: `bad_code` then means the typed code was wrong.
const pairingErrorText = (error, hasPairAttempt, stalePairing) => {
    if (stalePairing && !(error !== null && hasPairAttempt)) {
        return exports.PAIRING_STALE_MESSAGE;
    }
    if (error === null) {
        return null;
    }
    if (error.code === "bad_code") {
        return hasPairAttempt ? exports.PAIRING_WRONG_CODE_MESSAGE : exports.PAIRING_STALE_MESSAGE;
    }
    if (error.code === "locked") {
        return "失败次数过多，请重启 Metro 后重试";
    }
    if (error.code === "network") {
        return "连接失败，请检查网络";
    }
    return `配对失败（${error.code}），请重试`;
};
exports.pairingErrorText = pairingErrorText;
const actionErrorText = (error) => {
    if (error === null) {
        return null;
    }
    if (error.code === "conflict") {
        return REVERT_CONFLICT_ERROR;
    }
    if (error.code === "runner_busy") {
        return "agent 修复中，请稍后再试";
    }
    return `操作失败（${error.code}），请重试`;
};
const latestRoundText = (item) => {
    const rounds = item.rounds;
    return rounds[rounds.length - 1]?.description ?? "";
};
const latestReplyText = (item) => {
    const rounds = [...item.rounds].reverse().find((round) => round.reply !== null);
    return rounds?.reply ?? null;
};
const ActionButton = ({ disabled, label, onPress, primary, }) => ((0, jsx_runtime_1.jsx)(react_native_1.Pressable, { disabled: disabled, onPress: onPress, style: ({ pressed }) => [
        styles.actionButton,
        primary ? styles.actionButtonPrimary : styles.actionButtonSecondary,
        disabled && styles.actionButtonDisabled,
        pressed && !disabled && styles.actionButtonPressed,
    ], children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [
            primary ? styles.actionTextPrimary : styles.actionTextSecondary,
            disabled && styles.actionTextDisabled,
        ], children: label }) }));
const ReplyText = ({ reply }) => {
    const [expanded, setExpanded] = (0, react_1.useState)(false);
    const [overflows, setOverflows] = (0, react_1.useState)(false);
    return ((0, jsx_runtime_1.jsxs)(react_native_1.View, { children: [(0, jsx_runtime_1.jsxs)(react_native_1.Text, { accessible: false, accessibilityElementsHidden: true, importantForAccessibility: "no-hide-descendants", pointerEvents: "none", style: [styles.itemReply, styles.replyMeasurement], onTextLayout: ({ nativeEvent }) => setOverflows(nativeEvent.lines.length > 3), children: ["\u56DE\u590D\uFF1A", reply] }), (0, jsx_runtime_1.jsxs)(react_native_1.Text, { style: styles.itemReply, numberOfLines: expanded ? undefined : 3, children: ["\u56DE\u590D\uFF1A", reply] }), overflows && ((0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityState: { expanded }, hitSlop: 8, onPress: () => setExpanded((value) => !value), style: styles.replyToggle, children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.itemReply, children: expanded ? "收起" : "展开" }) }))] }));
};
const ItemRow = ({ busy, item, onDelete, onEdit, onPass, onReject, onRevert, pending, }) => {
    const source = (0, thumbnail_1.storedScreenshotSource)(item.screenshotUrl);
    const hint = (0, view_model_1.revertHint)(item, busy);
    const reply = latestReplyText(item);
    return ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: styles.itemRow, children: [(0, jsx_runtime_1.jsx)(thumbnail_1.ReviewThumbnail, { source: source, screen: item.screen, rect: item.rect }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: styles.itemBody, children: [(0, jsx_runtime_1.jsxs)(react_native_1.Text, { style: styles.itemNo, children: ["#", item.no] }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.itemDescription, children: latestRoundText(item) }), reply !== null && (0, jsx_runtime_1.jsx)(ReplyText, { reply: reply }, reply), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: styles.itemActions, children: [item.actions.includes("edit") && ((0, jsx_runtime_1.jsx)(ActionButton, { disabled: pending, label: "\u4FEE\u6539", onPress: onEdit })), item.actions.includes("delete") && ((0, jsx_runtime_1.jsx)(ActionButton, { disabled: pending, label: "\u5220\u9664", onPress: onDelete })), item.actions.includes("pass") && ((0, jsx_runtime_1.jsx)(ActionButton, { disabled: pending, label: "\u901A\u8FC7", onPress: onPass, primary: true })), item.actions.includes("reject") && ((0, jsx_runtime_1.jsx)(ActionButton, { disabled: pending, label: "\u6253\u56DE", onPress: onReject })), item.actions.includes("revert") && ((0, jsx_runtime_1.jsx)(ActionButton, { disabled: pending, label: "\u64A4\u9500", onPress: onRevert })), item.actions.includes("revert") === false && hint !== null && ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)(ActionButton, { disabled: true, label: "\u64A4\u9500", onPress: () => { } }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.revertHint, children: hint })] }))] })] })] }));
};
const PairingView = ({ error, stalePairing, }) => {
    const [code, setCode] = (0, react_1.useState)("");
    const [isPairing, setIsPairing] = (0, react_1.useState)(false);
    const [hasPairAttempt, setHasPairAttempt] = (0, react_1.useState)(false);
    const handlePair = async () => {
        if (isPairing || code.length !== 6) {
            return;
        }
        setIsPairing(true);
        setHasPairAttempt(true);
        await store_1.reviewActions.pair(code);
        setIsPairing(false);
    };
    return ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: styles.centered, children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.pairingTitle, children: "\u8FDE\u63A5\u8D70\u67E5" }), (0, jsx_runtime_1.jsx)(react_native_1.TextInput, { keyboardType: "number-pad", maxLength: 6, onChangeText: (text) => setCode(text.replace(/\D/g, "").slice(0, 6)), placeholder: "\u8BF7\u8F93\u5165 6 \u4F4D\u914D\u5BF9\u7801", style: styles.pairingInput, value: code }), (0, exports.pairingErrorText)(error, hasPairAttempt, stalePairing) !== null && ((0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.errorText, children: (0, exports.pairingErrorText)(error, hasPairAttempt, stalePairing) })), (0, jsx_runtime_1.jsx)(ActionButton, { disabled: isPairing || code.length !== 6, label: isPairing ? "配对中…" : "配对", onPress: () => void handlePair(), primary: true })] }));
};
const ReviewListPanel = () => {
    const { composer, error, items, listVisible, paired, review, runner, stalePairing } = (0, store_1.useReviewState)();
    const [pending, setPending] = (0, react_1.useState)(false);
    const runAction = async (task) => {
        if (pending) {
            return;
        }
        setPending(true);
        try {
            await task();
        }
        finally {
            setPending(false);
        }
    };
    const confirmRevert = (item) => {
        react_native_1.Alert.alert("撤销", REVERT_CONFIRM_MESSAGE, [
            { text: "取消", style: "cancel" },
            {
                text: "确定",
                onPress: () => {
                    void runAction(() => store_1.reviewActions.revert(item.no));
                },
            },
        ]);
    };
    const footer = (0, view_model_1.footerState)(review, items);
    const groups = (0, view_model_1.groupItemsByStatus)(items);
    return ((0, jsx_runtime_1.jsx)(react_native_1.Modal, { animationType: "slide", onRequestClose: store_1.reviewActions.closeList, statusBarTranslucent: true, visible: listVisible, children: (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: styles.panel, children: [(0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [styles.header, { paddingTop: react_native_safe_area_context_1.initialWindowMetrics?.insets.top ?? 0 }], children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.headerTitle, children: "\u8D70\u67E5\u5217\u8868" }), (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { hitSlop: 8, onPress: store_1.reviewActions.closeList, children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.headerAction, children: "\u5173\u95ED" }) })] }), !paired ? ((0, jsx_runtime_1.jsx)(PairingView, { error: error, stalePairing: stalePairing })) : ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [runner.busy && (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.banner, children: BUSY_BANNER }), runner.blocked && ((0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [styles.banner, styles.bannerError], children: BLOCKED_BANNER })), (0, jsx_runtime_1.jsxs)(react_native_1.ScrollView, { bounces: false, contentContainerStyle: styles.listContent, children: [groups.length === 0 && ((0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.emptyText, children: review === null ? "加载中…" : "暂无条目" })), groups.map((group) => ((0, jsx_runtime_1.jsxs)(react_native_1.View, { children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.groupLabel, children: group.label }), group.items.map((item) => ((0, jsx_runtime_1.jsx)(ItemRow, { busy: runner.busy, item: item, onDelete: () => void runAction(() => store_1.reviewActions.remove(item.no)), onEdit: () => store_1.reviewActions.openComposer({ mode: "edit", item }), onPass: () => void runAction(() => store_1.reviewActions.pass(item.no)), onReject: () => store_1.reviewActions.openComposer({ mode: "reject", item }), onRevert: () => confirmRevert(item), pending: pending }, item.no)))] }, group.status)))] }), actionErrorText(error) !== null && ((0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.errorText, children: actionErrorText(error) })), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: styles.footer, children: [(0, jsx_runtime_1.jsx)(ActionButton, { disabled: pending || footer.submitCount === 0, label: `提交（${footer.submitCount}）`, onPress: () => void runAction(() => store_1.reviewActions.submit()), primary: footer.submitCount > 0 }), footer.mrUrl !== null ? ((0, jsx_runtime_1.jsx)(ActionButton, { disabled: false, label: "\u67E5\u770B MR", onPress: () => {
                                        void react_native_1.Linking.openURL(footer.mrUrl ?? "").catch(() => { });
                                    } })) : (footer.canFinish && ((0, jsx_runtime_1.jsx)(ActionButton, { disabled: pending, label: "\u5B8C\u6210\u8D70\u67E5", onPress: () => void runAction(() => store_1.reviewActions.finish()), primary: true })))] })] })), listVisible && composer !== null && ((0, jsx_runtime_1.jsx)(react_native_1.View, { style: styles.composerOverlay, children: (0, jsx_runtime_1.jsx)(composer_1.ComposerSheet, { composer: composer, error: error }) }))] }) }));
};
exports.ReviewListPanel = ReviewListPanel;
const styles = react_native_1.StyleSheet.create({
    panel: {
        flex: 1,
        backgroundColor: "#F4F4F5",
    },
    composerOverlay: {
        ...react_native_1.StyleSheet.absoluteFill,
        zIndex: 2,
    },
    header: {
        alignItems: "center",
        backgroundColor: "#FFFFFF",
        flexDirection: "row",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        paddingVertical: 14,
    },
    headerTitle: {
        color: "#111111",
        fontSize: 17,
        fontWeight: "600",
    },
    headerAction: {
        color: "#007AFF",
        fontSize: 15,
        fontWeight: "600",
    },
    banner: {
        backgroundColor: "rgba(255, 159, 10, 0.16)",
        color: "#8A5B00",
        fontSize: 13,
        fontWeight: "500",
        paddingVertical: 8,
        paddingHorizontal: 20,
        textAlign: "center",
    },
    bannerError: {
        backgroundColor: "rgba(217, 48, 37, 0.12)",
        color: "#D93025",
    },
    listContent: {
        padding: 16,
        gap: 12,
    },
    groupLabel: {
        color: "#666666",
        fontSize: 13,
        fontWeight: "600",
        marginTop: 8,
        marginBottom: 4,
    },
    emptyText: {
        color: "#8A8A8A",
        fontSize: 14,
        paddingVertical: 24,
        textAlign: "center",
    },
    itemRow: {
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        flexDirection: "row",
        gap: 12,
        padding: 12,
    },
    itemBody: {
        flex: 1,
        gap: 4,
    },
    itemNo: {
        color: "#8A8A8A",
        fontSize: 12,
        fontWeight: "600",
    },
    itemDescription: {
        color: "#111111",
        fontSize: 14,
    },
    itemReply: {
        color: "#007AFF",
        fontSize: 12,
    },
    replyMeasurement: {
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        opacity: 0,
    },
    replyToggle: {
        alignSelf: "flex-start",
        paddingVertical: 4,
    },
    itemActions: {
        flexDirection: "row",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 6,
        marginTop: 4,
    },
    revertHint: {
        color: "#8A8A8A",
        fontSize: 11,
        width: "100%",
    },
    footer: {
        borderTopWidth: react_native_1.StyleSheet.hairlineWidth,
        borderTopColor: "rgba(17, 17, 17, 0.1)",
        flexDirection: "row",
        gap: 12,
        padding: 16,
    },
    centered: {
        alignItems: "center",
        flex: 1,
        gap: 12,
        justifyContent: "center",
        padding: 24,
    },
    pairingTitle: {
        color: "#111111",
        fontSize: 17,
        fontWeight: "600",
    },
    pairingInput: {
        borderWidth: 1,
        borderColor: "rgba(17, 17, 17, 0.14)",
        borderRadius: 8,
        color: "#111111",
        fontSize: 18,
        letterSpacing: 4,
        minWidth: 180,
        padding: 10,
        textAlign: "center",
    },
    errorText: {
        color: "#D93025",
        fontSize: 13,
        paddingVertical: 4,
        textAlign: "center",
    },
    actionButton: {
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 12,
        minHeight: 32,
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
        fontSize: 13,
        fontWeight: "600",
    },
    actionTextSecondary: {
        color: "#111111",
        fontSize: 13,
        fontWeight: "600",
    },
    actionTextDisabled: {
        color: "#8A8A8A",
    },
});
//# sourceMappingURL=list-panel.js.map