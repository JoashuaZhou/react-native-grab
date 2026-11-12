"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewActions = exports.useReviewState = exports.isReviewPaired = exports.getStoredPairingCode = exports.REVIEW_POLL_INTERVAL_MS = exports.PAIRING_CODE_STORAGE_KEY = void 0;
const react_1 = require("react");
const dev_server_1 = require("../dev-server");
const api_1 = require("./api");
const host_1 = require("./host");
exports.PAIRING_CODE_STORAGE_KEY = "rnGrabReview.pairingCode";
exports.REVIEW_POLL_INTERVAL_MS = 3000;
const listeners = new Set();
let pollTimer = null;
let state = {
    paired: false,
    stalePairing: false,
    review: null,
    items: [],
    runner: { busy: false, blocked: false },
    listVisible: false,
    composer: null,
    error: null,
};
const notify = () => {
    for (const listener of listeners) {
        listener();
    }
};
const subscribe = (listener) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};
const getSnapshot = () => state;
const getStoredPairingCode = () => {
    const storage = (0, host_1.getReviewHost)()?.storage;
    if (!storage)
        return null;
    try {
        const stored = storage.get(exports.PAIRING_CODE_STORAGE_KEY);
        // Host storage is not trusted: only a real 6-digit string counts as
        // paired, so cleared ("") or malformed values read as unpaired.
        if (typeof stored !== "string" || !/^\d{6}$/.test(stored))
            return null;
        return stored;
    }
    catch {
        return null;
    }
};
exports.getStoredPairingCode = getStoredPairingCode;
const isReviewPaired = () => (0, exports.getStoredPairingCode)() !== null;
exports.isReviewPaired = isReviewPaired;
const toReviewApiError = (error) => error instanceof api_1.ReviewApiError ? error : new api_1.ReviewApiError("network", 0);
// A code the server rejects with `bad_code` belongs to a previous review, so it is
// cleared from storage and the loaded review state goes with it; the error and the
// stalePairing flag stay for the pairing view to explain, until a successful pair.
const clearStalePairing = (error) => {
    try {
        (0, host_1.getReviewHost)()?.storage?.set(exports.PAIRING_CODE_STORAGE_KEY, "");
    }
    catch {
        // Nothing else can be done when the host storage fails.
    }
    setState((prevState) => ({
        ...prevState,
        paired: false,
        stalePairing: true,
        review: null,
        items: [],
        runner: { busy: false, blocked: false },
        error,
    }));
};
const createApiForCode = (code) => (0, api_1.createReviewApi)({ baseUrl: (0, dev_server_1.getDevServer)().url, code });
const shouldPoll = (current) => current.paired &&
    (current.listVisible ||
        current.items.some((item) => item.status === "queued" || item.status === "fixing"));
const syncPolling = () => {
    if (shouldPoll(state)) {
        if (pollTimer === null) {
            pollTimer = setInterval(() => {
                void exports.reviewActions.refresh();
            }, exports.REVIEW_POLL_INTERVAL_MS);
        }
        return;
    }
    if (pollTimer !== null) {
        clearInterval(pollTimer);
        pollTimer = null;
    }
};
const setState = (updater) => {
    state = typeof updater === "function" ? updater(state) : updater;
    state = { ...state, paired: (0, exports.isReviewPaired)() };
    syncPolling();
    notify();
};
const useReviewState = () => (0, react_1.useSyncExternalStore)(subscribe, getSnapshot, getSnapshot);
exports.useReviewState = useReviewState;
const fetchDeviceInfo = async () => {
    const getDeviceInfo = (0, host_1.getReviewHost)()?.getDeviceInfo;
    if (!getDeviceInfo)
        return null;
    try {
        return await getDeviceInfo();
    }
    catch {
        return null;
    }
};
const runAction = async (perform) => {
    const code = (0, exports.getStoredPairingCode)();
    if (code === null)
        return false;
    setState((prevState) => ({ ...prevState, error: null }));
    try {
        await perform(createApiForCode(code));
    }
    catch (error) {
        const apiError = toReviewApiError(error);
        if (apiError.code === "bad_code") {
            clearStalePairing(apiError);
        }
        else {
            setState((prevState) => ({ ...prevState, error: apiError }));
        }
        return false;
    }
    await exports.reviewActions.refresh();
    return true;
};
exports.reviewActions = {
    pair: async (code) => {
        setState((prevState) => ({ ...prevState, error: null }));
        try {
            await createApiForCode(code).pair(code);
            (0, host_1.getReviewHost)()?.storage?.set(exports.PAIRING_CODE_STORAGE_KEY, code);
            // Pairing with the current review's code ends any stale-code message.
            setState((prevState) => ({ ...prevState, stalePairing: false }));
        }
        catch (error) {
            setState((prevState) => ({ ...prevState, error: toReviewApiError(error) }));
            return false;
        }
        await exports.reviewActions.refresh();
        return true;
    },
    refresh: async () => {
        const code = (0, exports.getStoredPairingCode)();
        if (code === null) {
            setState((prevState) => ({ ...prevState, paired: false }));
            return;
        }
        try {
            const payload = await createApiForCode(code).state();
            setState((prevState) => ({
                ...prevState,
                review: payload.review,
                items: payload.items,
                runner: payload.runner,
                error: null,
            }));
        }
        catch (error) {
            const apiError = toReviewApiError(error);
            if (apiError.code === "bad_code") {
                clearStalePairing(apiError);
            }
            else {
                setState((prevState) => ({ ...prevState, error: apiError }));
            }
        }
    },
    openList: () => {
        setState((prevState) => ({ ...prevState, error: null, listVisible: true }));
        // The panel always reloads from the dev server when it opens.
        if ((0, exports.isReviewPaired)()) {
            void exports.reviewActions.refresh();
        }
    },
    closeList: () => {
        setState((prevState) => ({ ...prevState, listVisible: false }));
    },
    openComposer: (composer) => {
        setState((prevState) => ({ ...prevState, error: null, composer }));
    },
    closeComposer: () => {
        setState((prevState) => ({ ...prevState, composer: null }));
    },
    saveComposer: async (fields) => {
        const composer = state.composer;
        if (composer === null)
            return false;
        let perform;
        if (composer.mode === "create") {
            const device = await fetchDeviceInfo();
            const draft = {
                ...composer.draft,
                description: fields.description ?? composer.draft.description,
                scope: fields.scope ?? composer.draft.scope,
                figmaUrl: fields.figmaUrl ?? composer.draft.figmaUrl,
                device,
            };
            const screenshotJpegBase64 = composer.screenshot?.jpegBase64 ?? null;
            perform = async (api) => {
                await api.createItem(draft, screenshotJpegBase64);
            };
        }
        else if (composer.mode === "edit") {
            const patch = {
                ...(fields.description !== undefined ? { description: fields.description } : {}),
                ...(fields.scope !== undefined ? { scope: fields.scope } : {}),
                ...(fields.figmaUrl !== undefined ? { figmaUrl: fields.figmaUrl } : {}),
            };
            perform = async (api) => {
                await api.updateItem(composer.item.no, patch);
            };
        }
        else {
            const supplement = fields.supplement ?? "";
            perform = async (api) => {
                await api.reject(composer.item.no, supplement);
            };
        }
        const saved = await runAction(perform);
        // Errors stay visible inline while the sheet remains open.
        if (saved) {
            setState((prevState) => ({ ...prevState, composer: null }));
        }
        return saved;
    },
    submit: () => runAction((api) => api.submit()),
    pass: (no) => runAction((api) => api.pass(no)),
    reject: (no, supplement) => runAction((api) => api.reject(no, supplement)),
    revert: (no) => runAction((api) => api.revert(no)),
    remove: (no) => runAction((api) => api.deleteItem(no)),
    finish: () => runAction((api) => api.finish()),
};
//# sourceMappingURL=store.js.map