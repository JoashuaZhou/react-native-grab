import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from "react";
import { reviewActions } from "./store";
import { ReviewComposer } from "./composer";
import { ReviewListPanel } from "./list-panel";
export const ReviewLayer = () => {
    useEffect(() => {
        // Restores a pairing code stored by an earlier session; without this
        // initial refresh the store stays unpaired until the list is opened.
        void reviewActions.refresh();
    }, []);
    return (_jsxs(_Fragment, { children: [_jsx(ReviewComposer, {}), _jsx(ReviewListPanel, {})] }));
};
//# sourceMappingURL=review-layer.js.map