"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewLayer = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const store_1 = require("./store");
const composer_1 = require("./composer");
const list_panel_1 = require("./list-panel");
const ReviewLayer = () => {
    (0, react_1.useEffect)(() => {
        // Restores a pairing code stored by an earlier session; without this
        // initial refresh the store stays unpaired until the list is opened.
        void store_1.reviewActions.refresh();
    }, []);
    return ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)(composer_1.ReviewComposer, {}), (0, jsx_runtime_1.jsx)(list_panel_1.ReviewListPanel, {})] }));
};
exports.ReviewLayer = ReviewLayer;
//# sourceMappingURL=review-layer.js.map