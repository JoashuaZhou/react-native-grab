import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from "react";
import { Alert, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, } from "react-native";
import { reviewActions, useReviewState } from "./store";
import { ReviewThumbnail, storedScreenshotSource } from "./thumbnail";
import { footerState, groupItemsByStatus, revertHint } from "./view-model";
export const PAIRING_STALE_MESSAGE = "走查已更换，请输入新的配对码";
export const PAIRING_WRONG_CODE_MESSAGE = "配对码不正确，请重试";
const BUSY_BANNER = "agent 修复中…";
const BLOCKED_BANNER = "agent 运行异常，请联系工程师处理（rn-grab-review retry）";
const REVERT_CONFIRM_MESSAGE = "撤销后这条的代码改动会被还原，确定吗？";
const REVERT_CONFLICT_ERROR = "撤销失败：和后面的改动冲突，请联系工程师处理";
// `bad_code` after the view's own pair attempt means the typed code is wrong;
// the same error without an attempt comes from a stale stored code (the store
// clears it and keeps the error for this view to explain).
export const pairingErrorText = (error, hasPairAttempt) => {
    if (error === null) {
        return null;
    }
    if (error.code === "bad_code") {
        return hasPairAttempt ? PAIRING_WRONG_CODE_MESSAGE : PAIRING_STALE_MESSAGE;
    }
    if (error.code === "locked") {
        return "失败次数过多，请重启 Metro 后重试";
    }
    if (error.code === "network") {
        return "连接失败，请检查网络";
    }
    return `配对失败（${error.code}），请重试`;
};
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
const ActionButton = ({ disabled, label, onPress, primary, }) => (_jsx(Pressable, { disabled: disabled, onPress: onPress, style: ({ pressed }) => [
        styles.actionButton,
        primary ? styles.actionButtonPrimary : styles.actionButtonSecondary,
        disabled && styles.actionButtonDisabled,
        pressed && !disabled && styles.actionButtonPressed,
    ], children: _jsx(Text, { style: [
            primary ? styles.actionTextPrimary : styles.actionTextSecondary,
            disabled && styles.actionTextDisabled,
        ], children: label }) }));
const ItemRow = ({ busy, item, onDelete, onEdit, onPass, onReject, onRevert, pending, }) => {
    const source = storedScreenshotSource(item.screenshotUrl);
    const hint = revertHint(item, busy);
    const reply = latestReplyText(item);
    return (_jsxs(View, { style: styles.itemRow, children: [_jsx(ReviewThumbnail, { source: source, screen: item.screen, rect: item.rect }), _jsxs(View, { style: styles.itemBody, children: [_jsxs(Text, { style: styles.itemNo, children: ["#", item.no] }), _jsx(Text, { style: styles.itemDescription, children: latestRoundText(item) }), reply !== null && (_jsxs(Text, { style: styles.itemReply, numberOfLines: 3, children: ["\u56DE\u590D\uFF1A", reply] })), _jsxs(View, { style: styles.itemActions, children: [item.actions.includes("edit") && (_jsx(ActionButton, { disabled: pending, label: "\u4FEE\u6539", onPress: onEdit })), item.actions.includes("delete") && (_jsx(ActionButton, { disabled: pending, label: "\u5220\u9664", onPress: onDelete })), item.actions.includes("pass") && (_jsx(ActionButton, { disabled: pending, label: "\u901A\u8FC7", onPress: onPass, primary: true })), item.actions.includes("reject") && (_jsx(ActionButton, { disabled: pending, label: "\u6253\u56DE", onPress: onReject })), item.actions.includes("revert") && (_jsx(ActionButton, { disabled: pending, label: "\u64A4\u9500", onPress: onRevert })), item.actions.includes("revert") === false && hint !== null && (_jsxs(_Fragment, { children: [_jsx(ActionButton, { disabled: true, label: "\u64A4\u9500", onPress: () => { } }), _jsx(Text, { style: styles.revertHint, children: hint })] }))] })] })] }));
};
const PairingView = ({ error }) => {
    const [code, setCode] = useState("");
    const [isPairing, setIsPairing] = useState(false);
    const [hasPairAttempt, setHasPairAttempt] = useState(false);
    const handlePair = async () => {
        if (isPairing || code.length !== 6) {
            return;
        }
        setIsPairing(true);
        setHasPairAttempt(true);
        await reviewActions.pair(code);
        setIsPairing(false);
    };
    return (_jsxs(View, { style: styles.centered, children: [_jsx(Text, { style: styles.pairingTitle, children: "\u8FDE\u63A5\u8D70\u67E5" }), _jsx(TextInput, { keyboardType: "number-pad", maxLength: 6, onChangeText: (text) => setCode(text.replace(/\D/g, "").slice(0, 6)), placeholder: "\u8BF7\u8F93\u5165 6 \u4F4D\u914D\u5BF9\u7801", style: styles.pairingInput, value: code }), pairingErrorText(error, hasPairAttempt) !== null && (_jsx(Text, { style: styles.errorText, children: pairingErrorText(error, hasPairAttempt) })), _jsx(ActionButton, { disabled: isPairing || code.length !== 6, label: isPairing ? "配对中…" : "配对", onPress: () => void handlePair(), primary: true })] }));
};
export const ReviewListPanel = () => {
    const { error, items, listVisible, paired, review, runner } = useReviewState();
    const [pending, setPending] = useState(false);
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
        Alert.alert("撤销", REVERT_CONFIRM_MESSAGE, [
            { text: "取消", style: "cancel" },
            {
                text: "确定",
                onPress: () => {
                    void runAction(() => reviewActions.revert(item.no));
                },
            },
        ]);
    };
    const footer = footerState(review, items);
    const groups = groupItemsByStatus(items);
    return (_jsx(Modal, { animationType: "slide", onRequestClose: reviewActions.closeList, statusBarTranslucent: true, visible: listVisible, children: _jsxs(View, { style: styles.panel, children: [_jsxs(View, { style: styles.header, children: [_jsx(Text, { style: styles.headerTitle, children: "\u8D70\u67E5\u5217\u8868" }), _jsx(Pressable, { hitSlop: 8, onPress: reviewActions.closeList, children: _jsx(Text, { style: styles.headerAction, children: "\u5173\u95ED" }) })] }), !paired ? (_jsx(PairingView, { error: error })) : (_jsxs(_Fragment, { children: [runner.busy && _jsx(Text, { style: styles.banner, children: BUSY_BANNER }), runner.blocked && (_jsx(Text, { style: [styles.banner, styles.bannerError], children: BLOCKED_BANNER })), _jsxs(ScrollView, { bounces: false, contentContainerStyle: styles.listContent, children: [groups.length === 0 && (_jsx(Text, { style: styles.emptyText, children: review === null ? "加载中…" : "暂无条目" })), groups.map((group) => (_jsxs(View, { children: [_jsx(Text, { style: styles.groupLabel, children: group.label }), group.items.map((item) => (_jsx(ItemRow, { busy: runner.busy, item: item, onDelete: () => void runAction(() => reviewActions.remove(item.no)), onEdit: () => reviewActions.openComposer({ mode: "edit", item }), onPass: () => void runAction(() => reviewActions.pass(item.no)), onReject: () => reviewActions.openComposer({ mode: "reject", item }), onRevert: () => confirmRevert(item), pending: pending }, item.no)))] }, group.status)))] }), actionErrorText(error) !== null && (_jsx(Text, { style: styles.errorText, children: actionErrorText(error) })), _jsxs(View, { style: styles.footer, children: [_jsx(ActionButton, { disabled: pending || footer.submitCount === 0, label: `提交（${footer.submitCount}）`, onPress: () => void runAction(() => reviewActions.submit()), primary: footer.submitCount > 0 }), footer.mrUrl !== null ? (_jsx(ActionButton, { disabled: false, label: "\u67E5\u770B MR", onPress: () => {
                                        void Linking.openURL(footer.mrUrl ?? "").catch(() => { });
                                    } })) : (footer.canFinish && (_jsx(ActionButton, { disabled: pending, label: "\u5B8C\u6210\u8D70\u67E5", onPress: () => void runAction(() => reviewActions.finish()), primary: true })))] })] }))] }) }));
};
const styles = StyleSheet.create({
    panel: {
        flex: 1,
        backgroundColor: "#F4F4F5",
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
        borderTopWidth: StyleSheet.hairlineWidth,
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