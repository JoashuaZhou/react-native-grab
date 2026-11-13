import { useState } from "react";
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { initialWindowMetrics } from "react-native-safe-area-context";
import type { DeviceItemView } from "../../review-core/types";
import { type ReviewApiError } from "./api";
import { ComposerSheet } from "./composer";
import { reviewActions, useReviewState } from "./store";
import { ReviewThumbnail, storedScreenshotSource } from "./thumbnail";
import { footerState, groupItemsByStatus, revertHint } from "./view-model";

export const PAIRING_STALE_MESSAGE = "走查已更换，请输入新的配对码";
export const PAIRING_WRONG_CODE_MESSAGE = "配对码不正确，请重试";

const BUSY_BANNER = "agent 修复中…";
const BLOCKED_BANNER = "agent 运行异常，请联系工程师处理（rn-grab-review retry）";
const REVERT_CONFIRM_MESSAGE = "撤销后这条的代码改动会被还原，确定吗？";
const REVERT_CONFLICT_ERROR = "撤销失败：和后面的改动冲突，请联系工程师处理";

// A stale stored code keeps its message via the store's stalePairing flag (openList
// clears `error` but not the flag). A failed manual pair attempt explains itself
// instead: `bad_code` then means the typed code was wrong.
export const pairingErrorText = (
  error: ReviewApiError | null,
  hasPairAttempt: boolean,
  stalePairing: boolean,
): string | null => {
  if (stalePairing && !(error !== null && hasPairAttempt)) {
    return PAIRING_STALE_MESSAGE;
  }
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

const actionErrorText = (error: ReviewApiError | null): string | null => {
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

const latestRoundText = (item: DeviceItemView): string => {
  const rounds = item.rounds;
  return rounds[rounds.length - 1]?.description ?? "";
};

const latestReplyText = (item: DeviceItemView): string | null => {
  const rounds = [...item.rounds].reverse().find((round) => round.reply !== null);
  return rounds?.reply ?? null;
};

const ActionButton = ({
  disabled,
  label,
  onPress,
  primary,
}: {
  disabled: boolean;
  label: string;
  onPress: () => void;
  primary?: boolean;
}) => (
  <Pressable
    disabled={disabled}
    onPress={onPress}
    style={({ pressed }) => [
      styles.actionButton,
      primary ? styles.actionButtonPrimary : styles.actionButtonSecondary,
      disabled && styles.actionButtonDisabled,
      pressed && !disabled && styles.actionButtonPressed,
    ]}
  >
    <Text
      style={[
        primary ? styles.actionTextPrimary : styles.actionTextSecondary,
        disabled && styles.actionTextDisabled,
      ]}
    >
      {label}
    </Text>
  </Pressable>
);

type ItemRowProps = {
  busy: boolean;
  item: DeviceItemView;
  onDelete: () => void;
  onEdit: () => void;
  onPass: () => void;
  onReject: () => void;
  onRevert: () => void;
  pending: boolean;
};

const ReplyText = ({ reply }: { reply: string }) => {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  return (
    <View>
      {/* Measure the untruncated text: iOS may report only the visible lines
          for a Text with numberOfLines. This copy does not affect row height. */}
      <Text
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        style={[styles.itemReply, styles.replyMeasurement]}
        onTextLayout={({ nativeEvent }) => setOverflows(nativeEvent.lines.length > 3)}
      >
        回复：{reply}
      </Text>
      <Text style={styles.itemReply} numberOfLines={expanded ? undefined : 3}>
        回复：{reply}
      </Text>
      {overflows && (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          hitSlop={8}
          onPress={() => setExpanded((value) => !value)}
          style={styles.replyToggle}
        >
          <Text style={styles.itemReply}>{expanded ? "收起" : "展开"}</Text>
        </Pressable>
      )}
    </View>
  );
};

const ItemRow = ({
  busy,
  item,
  onDelete,
  onEdit,
  onPass,
  onReject,
  onRevert,
  pending,
}: ItemRowProps) => {
  const source = storedScreenshotSource(item.screenshotUrl);
  const hint = revertHint(item, busy);
  const reply = latestReplyText(item);

  return (
    <View style={styles.itemRow}>
      <ReviewThumbnail source={source} screen={item.screen} rect={item.rect} />

      <View style={styles.itemBody}>
        <Text style={styles.itemNo}>#{item.no}</Text>
        <Text style={styles.itemDescription}>{latestRoundText(item)}</Text>
        {reply !== null && <ReplyText key={reply} reply={reply} />}

        <View style={styles.itemActions}>
          {item.actions.includes("edit") && (
            <ActionButton disabled={pending} label="修改" onPress={onEdit} />
          )}
          {item.actions.includes("delete") && (
            <ActionButton disabled={pending} label="删除" onPress={onDelete} />
          )}
          {item.actions.includes("pass") && (
            <ActionButton disabled={pending} label="通过" onPress={onPass} primary />
          )}
          {item.actions.includes("reject") && (
            <ActionButton disabled={pending} label="打回" onPress={onReject} />
          )}
          {item.actions.includes("revert") && (
            <ActionButton disabled={pending} label="撤销" onPress={onRevert} />
          )}
          {item.actions.includes("revert") === false && hint !== null && (
            <>
              <ActionButton disabled label="撤销" onPress={() => {}} />
              <Text style={styles.revertHint}>{hint}</Text>
            </>
          )}
        </View>
      </View>
    </View>
  );
};

const PairingView = ({
  error,
  stalePairing,
}: {
  error: ReviewApiError | null;
  stalePairing: boolean;
}) => {
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

  return (
    <View style={styles.centered}>
      <Text style={styles.pairingTitle}>连接走查</Text>
      <TextInput
        keyboardType="number-pad"
        maxLength={6}
        onChangeText={(text) => setCode(text.replace(/\D/g, "").slice(0, 6))}
        placeholder="请输入 6 位配对码"
        style={styles.pairingInput}
        value={code}
      />
      {pairingErrorText(error, hasPairAttempt, stalePairing) !== null && (
        <Text style={styles.errorText}>
          {pairingErrorText(error, hasPairAttempt, stalePairing)}
        </Text>
      )}
      <ActionButton
        disabled={isPairing || code.length !== 6}
        label={isPairing ? "配对中…" : "配对"}
        onPress={() => void handlePair()}
        primary
      />
    </View>
  );
};

export const ReviewListPanel = () => {
  const { composer, error, items, listVisible, paired, review, runner, stalePairing } =
    useReviewState();
  const [pending, setPending] = useState(false);

  const runAction = async (task: () => Promise<boolean>) => {
    if (pending) {
      return;
    }
    setPending(true);
    try {
      await task();
    } finally {
      setPending(false);
    }
  };

  const confirmRevert = (item: DeviceItemView) => {
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

  return (
    <Modal
      animationType="slide"
      onRequestClose={reviewActions.closeList}
      statusBarTranslucent
      visible={listVisible}
    >
      <View style={styles.panel}>
        <View style={[styles.header, { paddingTop: initialWindowMetrics?.insets.top ?? 0 }]}>
          <Text style={styles.headerTitle}>走查列表</Text>
          <Pressable hitSlop={8} onPress={reviewActions.closeList}>
            <Text style={styles.headerAction}>关闭</Text>
          </Pressable>
        </View>

        {!paired ? (
          <PairingView error={error} stalePairing={stalePairing} />
        ) : (
          <>
            {runner.busy && <Text style={styles.banner}>{BUSY_BANNER}</Text>}
            {runner.blocked && (
              <Text style={[styles.banner, styles.bannerError]}>{BLOCKED_BANNER}</Text>
            )}

            <ScrollView bounces={false} contentContainerStyle={styles.listContent}>
              {groups.length === 0 && (
                <Text style={styles.emptyText}>{review === null ? "加载中…" : "暂无条目"}</Text>
              )}
              {groups.map((group) => (
                <View key={group.status}>
                  <Text style={styles.groupLabel}>{group.label}</Text>
                  {group.items.map((item) => (
                    <ItemRow
                      key={item.no}
                      busy={runner.busy}
                      item={item}
                      onDelete={() => void runAction(() => reviewActions.remove(item.no))}
                      onEdit={() => reviewActions.openComposer({ mode: "edit", item })}
                      onPass={() => void runAction(() => reviewActions.pass(item.no))}
                      onReject={() => reviewActions.openComposer({ mode: "reject", item })}
                      onRevert={() => confirmRevert(item)}
                      pending={pending}
                    />
                  ))}
                </View>
              ))}
            </ScrollView>

            {actionErrorText(error) !== null && (
              <Text style={styles.errorText}>{actionErrorText(error)}</Text>
            )}

            <View style={styles.footer}>
              <ActionButton
                disabled={pending || footer.submitCount === 0}
                label={`提交（${footer.submitCount}）`}
                onPress={() => void runAction(() => reviewActions.submit())}
                primary={footer.submitCount > 0}
              />
              {footer.mrUrl !== null ? (
                <ActionButton
                  disabled={false}
                  label="查看 MR"
                  onPress={() => {
                    void Linking.openURL(footer.mrUrl ?? "").catch(() => {});
                  }}
                />
              ) : (
                footer.canFinish && (
                  <ActionButton
                    disabled={pending}
                    label="完成走查"
                    onPress={() => void runAction(() => reviewActions.finish())}
                    primary
                  />
                )
              )}
            </View>
          </>
        )}

        {listVisible && composer !== null && (
          <View style={styles.composerOverlay}>
            <ComposerSheet composer={composer} error={error} />
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    backgroundColor: "#F4F4F5",
  },
  composerOverlay: {
    ...StyleSheet.absoluteFill,
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
